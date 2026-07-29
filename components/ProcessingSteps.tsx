"use client";

import { Check, FileAudio, LoaderCircle, Sparkles, Upload } from "lucide-react";

export type ProcessingStage = "idle" | "uploading" | "transcribing" | "analyzing" | "success";

const steps: Array<{
  key: Exclude<ProcessingStage, "idle">;
  label: string;
  icon: typeof Upload;
}> = [
  { key: "uploading", label: "جاري رفع التسجيل", icon: Upload },
  { key: "transcribing", label: "جاري تحويل الصوت إلى نص", icon: FileAudio },
  { key: "analyzing", label: "جاري تحليل البيانات", icon: Sparkles },
  { key: "success", label: "تم استخراج البيانات بنجاح", icon: Check },
];

const stepIndex: Record<ProcessingStage, number> = {
  idle: -1,
  uploading: 0,
  transcribing: 1,
  analyzing: 2,
  success: 3,
};

export function ProcessingSteps({ stage }: { stage: ProcessingStage }) {
  const activeIndex = stepIndex[stage];

  return (
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="مراحل المعالجة">
      {steps.map((step, index) => {
        const Icon = step.icon;
        const isActive = stage === step.key;
        const isDone = activeIndex >= index && stage !== "idle";

        return (
          <div
            key={step.key}
            className={[
              "flex min-h-16 items-center gap-3 rounded-lg border bg-white px-4 py-3 shadow-sm transition",
              isDone ? "border-teal-300" : "border-slate-200",
              isActive ? "ring-2 ring-teal-500/25" : "",
            ].join(" ")}
          >
            <span
              className={[
                "grid size-9 shrink-0 place-items-center rounded-full",
                isDone ? "bg-teal-700 text-white" : "bg-slate-100 text-slate-500",
              ].join(" ")}
            >
              {isActive && step.key !== "success" ? (
                <LoaderCircle className="size-5 animate-spin" aria-hidden="true" />
              ) : (
                <Icon className="size-5" aria-hidden="true" />
              )}
            </span>
            <span className="text-sm font-semibold text-slate-800">{step.label}</span>
          </div>
        );
      })}
    </section>
  );
}
