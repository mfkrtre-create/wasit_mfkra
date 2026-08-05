import { readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { NextResponse } from "next/server";
import { requireAuthenticatedRequest } from "@/lib/app-auth";

export const runtime = "nodejs";

const contentTypes: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

function imageRoot() {
  return process.env.PROPERTY_IMAGE_DIR || join(process.cwd(), ".data", "property-images");
}

function extensionFor(id: string) {
  const match = id.match(/\.(jpg|jpeg|png|webp)$/i);
  return match ? `.${match[1].toLowerCase()}` : "";
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, response } = await requireAuthenticatedRequest();
  if (response || !user) {
    return response;
  }

  const { id } = await params;
  const decodedId = decodeURIComponent(id);
  if (!/^[a-zA-Z0-9_-]+_[a-f0-9]{32}\.(jpg|jpeg|png|webp)$/i.test(decodedId) || !decodedId.startsWith(`${user.id}_`)) {
    return NextResponse.json({ error: "الصورة غير متاحة لهذا الحساب." }, { status: 404 });
  }

  const filePath = join(imageRoot(), decodedId);
  const fileStat = await stat(filePath).catch(() => null);
  if (!fileStat?.isFile()) {
    return NextResponse.json({ error: "الصورة غير موجودة." }, { status: 404 });
  }

  const file = await readFile(filePath);
  return new Response(file, {
    headers: {
      "Content-Type": contentTypes[extensionFor(decodedId)] ?? "application/octet-stream",
      "Cache-Control": "private, max-age=3600",
    },
  });
}
