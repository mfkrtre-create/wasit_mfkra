import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuthenticatedRequest } from "@/lib/app-auth";
import { normalizePropertyData } from "@/lib/normalize-property-data";
import { propertyJsonSchema } from "@/lib/property-schema";
import { getServerAiKey } from "@/lib/server-ai-keys";

export const runtime = "nodejs";

const requestSchema = z.object({
  text: z.string().trim().min(1, "النص مطلوب.").max(6000, "النص طويل جداً. الحد الأقصى 6000 حرف."),
});

const SYSTEM_INSTRUCTION = `You are a strict Saudi real-estate message parser. Understand Modern Standard Arabic and Saudi broker dialect, including informal WhatsApp and spoken phrasing.

Core classification:
- "للبيع", "للإيجار", "عندي", "متوفر", "الحد", and "السوم" normally describe an offer.
- "مطلوب", "عندي زبون", "عميل يبي", "يدور", and "أبحث عن" describe a request, even when no word equivalent to request is used.
- For an offer, sale/rent belongs in transactionType sale/rent. For a request, buying/renting belongs in buy/rent_request.

Saudi numeric language:
- Normalize Arabic-Indic digits and spoken values such as "ثلاثة مليون وثلاثمية", "3 مليون و330 ألف", "مليون و100", and "15 ألف للمتر" into full numeric values.
- Never confuse total price with price per meter. "15 ألف للمتر" goes only to pricePerMeter; calculate no total unless an exact total is stated.
- "الحد", "الصافي", "البيع", and the main stated offer amount go to price. "السوم", "سيمت", and "وصلت" go to priceBid. A request ceiling such as "ما يتجاوز" or "الميزانية" goes to maximumBudget.

Field placement:
- Put every district mentioned in districts. Put exact area in area; requested ranges in minimumArea/maximumArea.
- Preserve the visible property phrase for titles in customPropertyType when the text uses a compound, dual, or plural form. Examples: "مبنى مكتبي" stays customPropertyType "مبنى مكتبي" with propertyType office; "برجين" stays "برجين" with propertyType tower; "شقتين" stays "شقتين" with propertyType apartment; "فلتين" stays "فلتين" with propertyType villa; "عمارتين" stays "عمارتين" with propertyType building.
- Put all directions in facades. Put exact age in propertyAge and request ceilings such as "لا يتجاوز عمره 10 سنوات" in maximumPropertyAge.
- Distinguish FAL license from real-estate advertisement/advertiser number. Use falLicenseNumber only when FAL is explicit; use advertisementNumber for "رقم الإعلان", "رقم المعلن", or an explicitly identified ad license. If the text merely says "رقم الترخيص" and context is ambiguous, use licenseNumber and flag it in missingFields.
- Preserve meaningful facts without dedicated fields, such as income, financing, occupancy, furnishing, contract duration, building details, and payment terms, in description or technicalRequirements.
- Set category only when residential/commercial/industrial/agricultural is explicit or linguistically inseparable from the type (for example "أرض سكنية").

Safety:
- Extract only facts in the supplied message. Never infer city, district, contact, price, license, or property characteristics.
- Unknown scalar fields must be null and unknown lists must be empty.
- missingFields must name important review items that are absent or genuinely ambiguous.
- description must be concise Arabic and faithful to the message, with no marketing inventions.
- Return only JSON matching the required schema.`;

type GeminiInteractionClient = {
  interactions?: {
    create(args: {
      model: string;
      input: string;
      system_instruction?: string;
      response_format: {
        type: "text";
        mime_type: "application/json";
        schema: unknown;
      };
    }): Promise<unknown>;
  };
  models?: {
    generateContent(args: {
      model: string;
      contents: string;
      config: {
        systemInstruction: string;
        responseMimeType: "application/json";
        responseSchema: unknown;
      };
    }): Promise<unknown>;
  };
};

function errorResponse(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function extractResponseText(response: unknown): string | null {
  if (typeof response !== "object" || response === null) {
    return null;
  }

  const record = response as Record<string, unknown>;
  if (typeof record.output_text === "string") {
    return record.output_text;
  }

  if (typeof record.outputText === "string") {
    return record.outputText;
  }

  if (typeof record.text === "string") {
    return record.text;
  }

  if (typeof record.text === "function") {
    const text = (record.text as () => unknown)();
    return typeof text === "string" ? text : null;
  }

  return null;
}

async function extractWithGemini(client: GoogleGenAI, text: string) {
  const model = process.env.GEMINI_MODEL || "gemini-3.6-flash";
  const typedClient = client as unknown as GeminiInteractionClient;
  const input = `النص العقاري:\n${text}`;

  if (typedClient.interactions?.create) {
    return typedClient.interactions.create({
      model,
      input,
      system_instruction: SYSTEM_INSTRUCTION,
      response_format: {
        type: "text",
        mime_type: "application/json",
        schema: propertyJsonSchema,
      },
    });
  }

  if (typedClient.models?.generateContent) {
    return typedClient.models.generateContent({
      model,
      contents: input,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseSchema: propertyJsonSchema,
      },
    });
  }

  throw new Error("Gemini SDK does not expose a supported content method.");
}

export async function POST(request: Request) {
  const { response: authFailure } = await requireAuthenticatedRequest();
  if (authFailure) {
    return authFailure;
  }

  const apiKey = getServerAiKey("GEMINI_API_KEY");
  if (!apiKey) {
    return errorResponse("مفتاح Gemini غير مضبوط على الخادم.", 500);
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return errorResponse("صيغة الطلب غير صحيحة. أرسل JSON يحتوي على text.");
  }

  const parsedRequest = requestSchema.safeParse(payload);
  if (!parsedRequest.success) {
    return errorResponse(parsedRequest.error.issues[0]?.message ?? "النص غير صالح.");
  }

  try {
    const client = new GoogleGenAI({ apiKey });
    const response = await extractWithGemini(client, parsedRequest.data.text);
    const responseText = extractResponseText(response);

    if (!responseText) {
      return errorResponse("لم يرجع Gemini بيانات قابلة للقراءة.", 502);
    }

    const json = JSON.parse(responseText) as unknown;
    const normalized = normalizePropertyData(json);
    return NextResponse.json(normalized);
  } catch (error) {
    if (error instanceof SyntaxError) {
      return errorResponse("رجع Gemini نتيجة ليست بصيغة JSON صحيحة.", 502);
    }

    return errorResponse("فشل تحليل البيانات العقارية. تحقق من مفتاح Gemini أو جرّب نصاً أوضح.", 502);
  }
}
