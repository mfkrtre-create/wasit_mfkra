"use client";

import { useState } from "react";
import { FileText, Mic2 } from "lucide-react";
import { ProcessingSteps, type ProcessingStage } from "@/components/ProcessingSteps";
import { PropertyForm } from "@/components/PropertyForm";
import { TextInputPanel } from "@/components/TextInputPanel";
import { VoiceRecorder } from "@/components/VoiceRecorder";
import { defaultPropertyData, type PropertyData } from "@/lib/property-schema";

type InputMode = "text" | "voice";
type FieldName = keyof PropertyData;

function isFilled(value: PropertyData[FieldName]) {
  if (Array.isArray(value)) {
    return value.length > 0;
  }

  if (typeof value === "number") {
    return value > 0;
  }

  return value !== null && value !== "";
}

function getAutoFilledFields(data: PropertyData): FieldName[] {
  return (Object.keys(data) as FieldName[]).filter((key) => key !== "missingFields" && isFilled(data[key]));
}

async function readJsonResponse<T>(response: Response): Promise<T & { error?: string }> {
  try {
    return (await response.json()) as T & { error?: string };
  } catch {
    return { error: "تعذر قراءة استجابة الخادم." } as T & { error?: string };
  }
}

export default function Home() {
  const [inputMode, setInputMode] = useState<InputMode>("text");
  const [text, setText] = useState("");
  const [originalText, setOriginalText] = useState("");
  const [propertyData, setPropertyData] = useState<PropertyData>(defaultPropertyData);
  const [autoFilledFields, setAutoFilledFields] = useState<FieldName[]>([]);
  const [stage, setStage] = useState<ProcessingStage>("idle");
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function analyzeText(value = text) {
    const cleanText = value.trim();
    if (!cleanText) {
      setError("أدخل نصاً عقارياً أولاً.");
      return;
    }

    setIsProcessing(true);
    setError(null);
    setStage("analyzing");

    try {
      const response = await fetch("/api/extract-property", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: cleanText }),
      });
      const body = await readJsonResponse<PropertyData>(response);

      if (!response.ok) {
        throw new Error(body.error ?? "فشل تحليل النص.");
      }

      setOriginalText(cleanText);
      setPropertyData(body);
      setAutoFilledFields(getAutoFilledFields(body));
      setStage("success");
    } catch (caughtError) {
      setStage("idle");
      setError(caughtError instanceof Error ? caughtError.message : "حدث خطأ غير متوقع.");
    } finally {
      setIsProcessing(false);
    }
  }

  async function transcribeAudio(file: File) {
    setIsProcessing(true);
    setError(null);
    setStage("uploading");

    try {
      const formData = new FormData();
      formData.append("audio", file);

      await new Promise((resolve) => setTimeout(resolve, 250));
      setStage("transcribing");

      const response = await fetch("/api/transcribe", {
        method: "POST",
        body: formData,
      });
      const body = await readJsonResponse<{ text: string }>(response);

      if (!response.ok) {
        throw new Error(body.error ?? "فشل تحويل الصوت إلى نص.");
      }

      setText(body.text);
      await analyzeText(body.text);
    } catch (caughtError) {
      setStage("idle");
      setError(caughtError instanceof Error ? caughtError.message : "حدث خطأ غير متوقع.");
      setIsProcessing(false);
    }
  }

  return (
    <main className="min-h-screen px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto grid max-w-7xl gap-5">
        <header className="grid gap-3">
          <p className="text-sm font-bold text-teal-800">MVP إدخال عقاري</p>
          <h1 className="text-3xl font-black tracking-normal text-slate-950 sm:text-4xl">
            تجربة الإدخال العقاري الذكي
          </h1>
        </header>

        <div className="inline-grid w-full grid-cols-2 rounded-lg border border-slate-200 bg-white p-1 shadow-sm sm:w-fit">
          <button
            type="button"
            onClick={() => setInputMode("text")}
            className={[
              "inline-flex h-11 items-center justify-center gap-2 rounded-md px-4 text-sm font-bold transition",
              inputMode === "text" ? "bg-teal-700 text-white" : "text-slate-700 hover:bg-slate-50",
            ].join(" ")}
          >
            <FileText className="size-4" aria-hidden="true" />
            لصق نص عقاري
          </button>
          <button
            type="button"
            onClick={() => setInputMode("voice")}
            className={[
              "inline-flex h-11 items-center justify-center gap-2 rounded-md px-4 text-sm font-bold transition",
              inputMode === "voice" ? "bg-teal-700 text-white" : "text-slate-700 hover:bg-slate-50",
            ].join(" ")}
          >
            <Mic2 className="size-4" aria-hidden="true" />
            تسجيل رسالة صوتية
          </button>
        </div>

        <ProcessingSteps stage={stage} />

        {error ? (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 font-semibold text-rose-800">
            {error}
          </div>
        ) : null}

        <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="grid content-start gap-5">
            {inputMode === "text" ? (
              <TextInputPanel
                text={text}
                onTextChange={setText}
                onAnalyze={() => void analyzeText()}
                disabled={isProcessing}
              />
            ) : (
              <VoiceRecorder onTranscribe={transcribeAudio} disabled={isProcessing} />
            )}
          </div>

          <PropertyForm data={propertyData} originalText={originalText || text} autoFilledFields={autoFilledFields} />
        </div>
      </div>
    </main>
  );
}
