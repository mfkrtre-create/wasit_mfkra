import { useMemo, useState } from 'react';
import { MessageCircle, X as XIcon, Copy, Check } from 'lucide-react';
import type { Listing, ShareOptions, SharePlatform } from '@/ui/types';
import { db, useDB } from '@/ui/lib/db';
import { buildShareMessage, xShareUrl } from '@/ui/lib/share';
import { waLink } from '@/ui/lib/format';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/ui/components/ui/dialog';
import { Checkbox } from '@/ui/components/ui/checkbox';
import { Input } from '@/ui/components/ui/input';
import { Label } from '@/ui/components/ui/label';
import { toast } from 'sonner';

const OPTION_DEFS: Array<{ key: keyof ShareOptions; label: string; emoji: string }> = [
  { key: 'showPrice', label: 'إظهار السعر', emoji: '💰' },
  { key: 'showBrokerNumber', label: 'إظهار رقم الوسيط', emoji: '📞' },
  { key: 'showBidInstead', label: 'إظهار السوم بدل الحد', emoji: '💬' },
  { key: 'includeQuickLink', label: 'تضمين رابط تصفح سريع', emoji: '🔗' },
];

export function ShareDialog({
  listing,
  open,
  onOpenChange,
}: {
  listing: Listing;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { profile } = useDB();
  const [opts, setOpts] = useState<ShareOptions>({
    showPrice: true,
    showBrokerNumber: true,
    showBidInstead: false,
    includeQuickLink: false,
  });
  const [recipientName, setRecipientName] = useState('');
  const [recipientPhone, setRecipientPhone] = useState('');
  const [copied, setCopied] = useState(false);

  const message = useMemo(() => buildShareMessage(listing, opts, profile), [listing, opts, profile]);

  const send = (platform: SharePlatform) => {
    db.addShareLog({
      listingId: listing.id,
      listingTitle: listing.title,
      listingKind: listing.kind,
      recipientName: recipientName || (platform === 'whatsapp' ? 'جهة واتساب' : 'متابعو X'),
      recipientPhone: recipientPhone || undefined,
      platform,
      message,
      options: opts,
    });
    const url = platform === 'whatsapp' ? waLink(recipientPhone || undefined, message) : xShareUrl(message);
    window.open(url, '_blank', 'noopener');
    toast.success(`تم فتح ${platform === 'whatsapp' ? 'واتساب' : 'X'} وسُجّلت المشاركة في سجل العملاء`);
    onOpenChange(false);
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error('تعذر النسخ');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg bg-[#0f1f3d] border-[#c9972f]/25 text-white max-h-[90vh] overflow-y-auto scrollbar-thin">
        <DialogHeader>
          <DialogTitle className="text-lg font-extrabold flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg gold-gradient flex items-center justify-center text-base">📤</span>
            مشاركة ذكية — {listing.title}
          </DialogTitle>
        </DialogHeader>

        {/* toggles */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mt-2">
          {OPTION_DEFS.map(({ key, label, emoji }) => (
            <label
              key={key}
              className="flex items-center gap-2.5 rounded-xl border border-border bg-secondary/40 px-3 py-2.5 cursor-pointer hover:border-[#c9972f]/40 transition-colors"
            >
              <Checkbox
                checked={opts[key]}
                onCheckedChange={(v) => setOpts((o) => ({ ...o, [key]: Boolean(v) }))}
                className="border-[#c9972f]/50 data-[state=checked]:bg-[#c9972f] data-[state=checked]:text-[#0f1f3d]"
              />
              <span className="text-sm font-semibold text-slate-200">
                {emoji} {label}
              </span>
            </label>
          ))}
        </div>

        {/* recipient */}
        <div className="grid grid-cols-2 gap-2.5 mt-3">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">اسم المستلم (للسجل)</Label>
            <Input
              value={recipientName}
              onChange={(e) => setRecipientName(e.target.value)}
              placeholder="مثال: أبو سارة"
              className="bg-secondary/50 border-border"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">جوال المستلم (اختياري)</Label>
            <Input
              value={recipientPhone}
              onChange={(e) => setRecipientPhone(e.target.value)}
              placeholder="05xxxxxxxx"
              className="bg-secondary/50 border-border nums-latin"
            />
          </div>
        </div>

        {/* live preview */}
        <div className="mt-3">
          <div className="flex items-center justify-between mb-1.5">
            <Label className="text-xs text-muted-foreground">معاينة الرسالة</Label>
            <button onClick={copy} className="flex items-center gap-1 text-[11px] font-bold text-[#e5bc55] hover:underline">
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'تم النسخ' : 'نسخ'}
            </button>
          </div>
          <pre className="whitespace-pre-wrap text-sm leading-relaxed rounded-xl border border-[#c9972f]/20 bg-[#0a1730] p-3.5 font-[inherit] text-slate-100 max-h-48 overflow-y-auto scrollbar-thin">
            {message}
          </pre>
        </div>

        {/* actions */}
        <div className="grid grid-cols-2 gap-2.5 mt-4">
          <button
            onClick={() => send('whatsapp')}
            className="flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold py-3 transition-colors"
          >
            <MessageCircle className="w-5 h-5" />
            واتساب
          </button>
          <button
            onClick={() => send('x')}
            className="flex items-center justify-center gap-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-zinc-600 text-white font-extrabold py-3 transition-colors"
          >
            <XIcon className="w-5 h-5" />
            منصة X
          </button>
        </div>
        <p className="text-[11px] text-muted-foreground text-center mt-2">
          تُسجَّل كل مشاركة تلقائياً في سجل العملاء مع الوقت والمنصة 📋
        </p>
      </DialogContent>
    </Dialog>
  );
}
