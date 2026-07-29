"use client";

import { ClipboardPaste, WandSparkles } from "lucide-react";

const exampleText =
  "للبيع أرض سكنية في حي العارض بمدينة الرياض، المساحة 450 متر، شارع 20 متر، واجهة شمالية، السعر مليون و350 ألف صافي، رقم ترخيص الإعلان 123456، والتواصل على الرقم 0501234567.";

export function TextInputPanel({
  text,
  onTextChange,
  onAnalyze,
  disabled,
}: {
  text: string;
  onTextChange: (value: string) => void;
  onAnalyze: () => void;
  disabled: boolean;
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-slate-950">لصق نص عقاري</h2>
        <button
          type="button"
          onClick={() => onTextChange(exampleText)}
          className="inline-flex h-10 items-center gap-2 rounded-md border border-teal-700 px-3 text-sm font-semibold text-teal-800 transition hover:bg-teal-50"
        >
          <ClipboardPaste className="size-4" aria-hidden="true" />
          إدراج مثال
        </button>
      </div>
      <textarea
        value={text}
        onChange={(event) => onTextChange(event.target.value)}
        maxLength={6000}
        rows={7}
        placeholder="اكتب أو الصق رسالة عقارية عربية هنا..."
        className="w-full resize-y rounded-md border border-slate-300 bg-slate-50 p-3 leading-8 text-slate-950 outline-none transition focus:border-teal-700 focus:bg-white focus:ring-2 focus:ring-teal-600/20"
      />
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <span className="text-sm text-slate-500">{text.length} / 6000</span>
        <button
          type="button"
          onClick={onAnalyze}
          disabled={disabled || text.trim().length === 0}
          className="inline-flex h-11 items-center gap-2 rounded-md bg-teal-700 px-5 text-sm font-bold text-white shadow-sm transition hover:bg-teal-800"
        >
          <WandSparkles className="size-4" aria-hidden="true" />
          تحليل النص
        </button>
      </div>
    </section>
  );
}
