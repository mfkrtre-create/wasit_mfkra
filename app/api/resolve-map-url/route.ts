import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuthenticatedRequest } from "@/lib/app-auth";
import { extractGoogleMapsUrl, parseCoordinatesFromGoogleMapsUrl } from "@/lib/google-maps";

export const runtime = "nodejs";

const requestSchema = z.object({
  url: z.string().trim().url(),
});

function errorResponse(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request: Request) {
  const { response: authFailure } = await requireAuthenticatedRequest();
  if (authFailure) return authFailure;

  const payload = await request.json().catch(() => null);
  const parsed = requestSchema.safeParse(payload);
  if (!parsed.success) return errorResponse("رابط الخريطة غير صالح.");

  const url = extractGoogleMapsUrl(parsed.data.url) ?? parsed.data.url;
  const direct = parseCoordinatesFromGoogleMapsUrl(url);
  if (direct) return NextResponse.json({ ...direct, resolvedUrl: url });

  try {
    const response = await fetch(url, {
      redirect: "follow",
      headers: {
        "user-agent": "Mozilla/5.0 WasitMapResolver/1.0",
      },
    });
    const resolvedUrl = response.url || url;
    const coordinates = parseCoordinatesFromGoogleMapsUrl(resolvedUrl);
    if (coordinates) return NextResponse.json({ ...coordinates, resolvedUrl });
  } catch {
    return errorResponse("تعذر فتح رابط خرائط قوقل.", 502);
  }

  return errorResponse("لم نستطع استخراج الإحداثيات من رابط خرائط قوقل. يمكن تثبيت الدبوس يدوياً.", 422);
}
