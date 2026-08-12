import { useState } from 'react';
import { Calculator, ChevronDown, ChevronUp } from 'lucide-react';
import { fmtMoney } from '@/ui/lib/format';

export function OfferCalculator({ price }: { price?: number }) {
  const [open, setOpen] = useState(false);
  const base = price ?? 0;
  const transferTax = base * 0.05;
  const commission = base * 0.025;
  const total = base + transferTax + commission;
  return (
    <section className="rounded-xl border border-[#c9972f]/25 bg-[#c9972f]/5 p-3.5">
      <button type="button" onClick={() => setOpen((value) => !value)} className="w-full flex items-center justify-between gap-3 text-start">
        <span className="text-sm font-extrabold text-[#e5bc55] flex items-center gap-2">
          <Calculator className="w-4 h-4" />
          الحاسبة العقارية السعودية
        </span>
        {open ? <ChevronUp className="w-4 h-4 text-[#e5bc55]" /> : <ChevronDown className="w-4 h-4 text-[#e5bc55]" />}
      </button>
      {open && (
        <>
          <div className="grid grid-cols-2 gap-2 mt-3 text-xs">
            <Row label="السعر الصافي" value={base} />
            <Row label="ضريبة التصرفات 5%" value={transferTax} />
            <Row label="عمولة السعي 2.5%" value={commission} />
          </div>
          <div className="mt-3 border-t border-[#c9972f]/20 pt-3 flex items-center justify-between"><span className="text-sm font-bold text-slate-200">إجمالي المشتري التقديري</span><span className="font-extrabold text-[#e5bc55] nums-latin">{fmtMoney(total)}</span></div>
        </>
      )}
    </section>
  );
}

function Row({ label, value }: { label: string; value: number }) {
  return <div className="rounded-lg border border-border bg-secondary/40 px-2.5 py-2"><p className="text-[10px] text-muted-foreground">{label}</p><p className="font-bold text-white nums-latin mt-0.5">{fmtMoney(value)}</p></div>;
}
