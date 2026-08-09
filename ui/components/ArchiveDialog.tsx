import { useMemo, useState } from 'react';
import { Archive, Banknote, ChevronRight } from 'lucide-react';
import type { ArchiveReason, Listing } from '@/ui/types';
import { ARCHIVE_REASON_LABELS } from '@/ui/types';
import { db } from '@/ui/lib/db';
import { fmtMoney } from '@/ui/lib/format';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/ui/components/ui/dialog';
import { cn } from '@/ui/lib/utils';
import { toast } from 'sonner';

const REASONS: Array<{ key: ArchiveReason; emoji: string; hint: string }> = [
  { key: 'sold_by_me', emoji: '🎉', hint: 'تُحتسب العمولة وتُسجَّل في الإحصائيات المالية' },
  { key: 'sold_externally', emoji: '🔄', hint: 'تم البيع عن طريق وسيط آخر أو المالك مباشرة' },
  { key: 'owner_changed_mind', emoji: '↩️', hint: 'المالك قرر عدم البيع/التأجير حالياً' },
  { key: 'client_cancelled', emoji: '❌', hint: 'العميل لم يعد بحاجة للطلب' },
];

export function ArchiveDialog({
  listing,
  open,
  onOpenChange,
}: {
  listing: Listing;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [reason, setReason] = useState<ArchiveReason | null>(null);
  const dealBase = listing.priceBid ?? listing.priceAsk ?? 0;
  const [percent, setPercent] = useState(2.5);
  const [dealPrice, setDealPrice] = useState(dealBase);

  const commission = useMemo(() => Math.round((dealPrice * percent) / 100), [dealPrice, percent]);

  const reset = () => {
    setReason(null);
    setPercent(2.5);
    setDealPrice(listing.priceBid ?? listing.priceAsk ?? 0);
  };

  const confirm = () => {
    if (!reason) return;
    db.archiveListing(
      listing.id,
      reason,
      reason === 'sold_by_me' ? { percent, amount: commission, date: new Date().toISOString(), dealPrice } : undefined,
    );
    toast.success(
      reason === 'sold_by_me'
        ? `🎉 مبروك الصفقة! سُجّلت عمولة ${fmtMoney(commission)} في الإحصائيات`
        : 'تمت الأرشفة — يمكنك استعادته في أي وقت من تبويب مؤرشف',
    );
    onOpenChange(false);
    reset();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) reset();
      }}
    >
      <DialogContent className="max-w-md bg-[#0f1f3d] border-[#c9972f]/25 text-white">
        <DialogHeader>
          <DialogTitle className="text-lg font-extrabold flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg bg-zinc-600/40 flex items-center justify-center">
              <Archive className="w-4.5 h-4.5 text-zinc-300" />
            </span>
            أرشفة — {listing.title}
          </DialogTitle>
        </DialogHeader>

        <p className="text-sm text-muted-foreground">ما سبب إنهاء هذا الإعلان؟</p>

        <div className="space-y-2 mt-1">
          {REASONS.map(({ key, emoji, hint }) => (
            <button
              key={key}
              onClick={() => setReason(key)}
              className={cn(
                'w-full text-start rounded-xl border px-3.5 py-3 transition-all flex items-center gap-3',
                reason === key
                  ? 'border-[#c9972f] bg-[#c9972f]/10 shadow-[0_0_0_1px_#c9972f]'
                  : 'border-border bg-secondary/40 hover:border-[#c9972f]/40',
              )}
            >
              <span className="text-xl">{emoji}</span>
              <span className="flex-1">
                <span className="block font-bold text-sm text-white">{ARCHIVE_REASON_LABELS[key]}</span>
                <span className="block text-[11px] text-muted-foreground mt-0.5">{hint}</span>
              </span>
              {reason === key && <ChevronRight className="w-4 h-4 text-[#e5bc55] rotate-180" />}
            </button>
          ))}
        </div>

        {/* commission step */}
        {reason === 'sold_by_me' && (
          <div className="mt-3 rounded-xl border border-[#c9972f]/40 bg-[#c9972f]/5 p-4 space-y-3">
            <div className="flex items-center gap-2 font-extrabold text-[#e5bc55]">
              <Banknote className="w-5 h-5" />
              حساب العمولة
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <label className="space-y-1">
                <span className="text-[11px] text-muted-foreground font-semibold">سعر الصفقة (ر.س)</span>
                <input
                  type="number"
                  value={dealPrice || ''}
                  onChange={(e) => setDealPrice(Number(e.target.value))}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm nums-latin outline-none focus:border-[#c9972f]"
                />
              </label>
              <label className="space-y-1">
                <span className="text-[11px] text-muted-foreground font-semibold">نسبة العمولة % (قابلة للتعديل)</span>
                <input
                  type="number"
                  step="0.1"
                  value={percent}
                  onChange={(e) => setPercent(Number(e.target.value))}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm nums-latin outline-none focus:border-[#c9972f]"
                />
              </label>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-background/70 border border-[#c9972f]/30 px-3.5 py-2.5">
              <span className="text-sm font-bold text-slate-300">العمولة المستحقة</span>
              <span className="text-lg font-extrabold text-[#e5bc55] nums-latin">{fmtMoney(commission)}</span>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2.5 mt-4">
          <button
            onClick={() => {
              onOpenChange(false);
              reset();
            }}
            className="rounded-xl border border-border bg-secondary/50 text-slate-200 font-bold py-2.5 hover:bg-secondary transition-colors"
          >
            إلغاء
          </button>
          <button
            onClick={confirm}
            disabled={!reason}
            className={cn(
              'rounded-xl font-extrabold py-2.5 transition-all',
              reason ? 'gold-gradient text-[#0f1f3d] hover:brightness-110' : 'bg-secondary/40 text-muted-foreground cursor-not-allowed',
            )}
          >
            تأكيد الأرشفة
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
