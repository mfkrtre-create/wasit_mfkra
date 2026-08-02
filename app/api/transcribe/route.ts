import Groq from "groq-sdk";
import { NextResponse } from "next/server";
import { requireAuthenticatedRequest } from "@/lib/app-auth";
import { getServerAiKey } from "@/lib/server-ai-keys";

export const runtime = "nodejs";

const MAX_AUDIO_BYTES = 20 * 1024 * 1024;
const SUPPORTED_MIME_TYPES = new Set([
  "audio/flac",
  "audio/mp3",
  "audio/mp4",
  "audio/mpeg",
  "audio/mpga",
  "audio/m4a",
  "audio/x-m4a",
  "audio/ogg",
  "audio/wav",
  "audio/webm",
  "video/webm",
  "video/mp4",
]);

function errorResponse(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function isSupportedAudio(file: File) {
  const mime = file.type.split(";")[0].toLowerCase();
  if (mime && SUPPORTED_MIME_TYPES.has(mime)) {
    return true;
  }

  return /\.(flac|mp3|mp4|mpeg|mpga|m4a|ogg|wav|webm)$/i.test(file.name);
}

export async function POST(request: Request) {
  const { response: authFailure } = await requireAuthenticatedRequest();
  if (authFailure) {
    return authFailure;
  }

  const apiKey = getServerAiKey("GROQ_API_KEY");
  if (!apiKey) {
    return errorResponse("مفتاح Groq غير مضبوط على الخادم.", 500);
  }

  let file: FormDataEntryValue | null;

  try {
    const formData = await request.formData();
    file = formData.get("audio");
  } catch {
    return errorResponse("تعذر قراءة ملف التسجيل المرسل.");
  }

  if (!(file instanceof File)) {
    return errorResponse("يرجى إرسال ملف صوتي باسم audio.");
  }

  if (file.size <= 0) {
    return errorResponse("ملف التسجيل فارغ.");
  }

  if (file.size > MAX_AUDIO_BYTES) {
    return errorResponse("حجم التسجيل كبير جداً. الحد الأقصى 20 ميجابايت.");
  }

  if (!isSupportedAudio(file)) {
    return errorResponse("صيغة التسجيل غير مدعومة. استخدم webm أو mp3 أو wav أو m4a.");
  }

  try {
    const groq = new Groq({ apiKey });
    const transcription = await groq.audio.transcriptions.create({
      file,
      model: "whisper-large-v3-turbo",
      language: "ar",
      response_format: "json",
      temperature: 0,
    });

    const text = transcription.text?.trim();
    if (!text) {
      return errorResponse("لم يتم العثور على نص واضح في التسجيل.", 422);
    }

    return NextResponse.json({ text });
  } catch {
    return errorResponse("فشل تحويل الصوت إلى نص. تحقق من المفتاح أو جودة التسجيل.", 502);
  }
}
