import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";
import { z } from "zod";
import { normalizePropertyData } from "@/lib/normalize-property-data";
import { propertyJsonSchema } from "@/lib/property-schema";
import { requireAuthenticatedRequest } from "@/lib/server-auth";
import { getServerAiKey } from "@/lib/server-ai-keys";

export const runtime = "nodejs";

const requestSchema = z.object({
  text: z.string().trim().min(1, "النص مطلوب.").max(6000, "النص طويل جداً. الحد الأقصى 6000 حرف."),
});

const SYSTEM_INSTRUCTION = `You are a Saudi real-estate data extraction engine.
Extract only information explicitly contained in the supplied text.
Do not guess or invent values.
Understand Modern Standard Arabic and common Saudi dialect.
Convert written Arabic numbers into numeric values.
Classify the text as an offer or request.
Return only data matching the required schema.
Use null for unknown scalar values and empty arrays for unknown lists.`;

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
  const authFailure = await requireAuthenticatedRequest(request);
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
