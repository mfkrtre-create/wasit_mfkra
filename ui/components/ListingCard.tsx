import { useState } from 'react';
import Image from 'next/image';
import {
  MapPin,
  Share2,
  RefreshCw,
  Archive,
  AlertTriangle,
  Check,
  X,
  RotateCcw,
  Phone,
  User,
  BadgeCheck,
  Pencil,
  ChevronLeft,
} from 'lucide-react';
import type { Listing } from '@/ui/types';
import { ARCHIVE_REASON_LABELS, statusLabel } from '@/ui/types';
import { db, isOverdue, daysUntilDue } from '@/ui/lib/db';
import { fmtMoney, timeAgo, waLink } from '@/ui/lib/format';
import { summaryChips } from '@/ui/lib/fieldDefs';
import { buildRefreshMessage } from '@/ui/lib/share';
import { getProfile } from '@/ui/lib/db';
import { cn } from '@/ui/lib/utils';
import { ShareDialog } from '@/ui/components/ShareDialog';
import { ArchiveDialog } from '@/ui/components/ArchiveDialog';
import { toast } from 'sonner';

const TYPE_EMOJI: Record<string, string> = {
  land: '🗺️',
  villa: '🏡',
  apartment: '🏢',
  building: '🏬',
  farm: '🌴',
  tower: '🏙️',
  other: '🏪',
};

const STATUS_STYLES: Record<string, string> = {
  for_sale: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  for_rent: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
  buy: 'bg-violet-500/15 text-violet-300 border-violet-500/30',
  rent: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30',
  closed: 'bg-[#c9972f]/15 text-[#e5bc55] border-[#c9972f]/40',
  fulfilled: 'bg-[#c9972f]/15 text-[#e5bc55] border-[#c9972f]/40',
  archived: 'bg-zinc-500/15 text-zinc-400 border-zinc-500/30',
};

function InlinePrice({ value, label, onSave }: { value?: number; label: string; onSave: (v: number) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');

  if (!editing) {
    return (
      <button
        onClick={(e) => {
          e.stopPropagation();
          setDraft(value ? String(value) : '');
          setEditing(true);
        }}
        className="group flex items-center gap-1.5 text-start"
        title={`تحديث ${label}`}
      >
        <span className="font-extrabold text-white nums-latin">{value ? fmtMoney(value) : '—'}</span>
        <Pencil className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
      </button>
    );
  }
  return (
    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
      <input
        autoFocus
        type="number"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && draft) {
            onSave(Number(draft));
            setEditing(false);
          }
          if (e.key === 'Escape') setEditing(false);
        }}
        className="w-28 bg-background border border-[#c9972f]/50 rounded-md px-2 py-1 text-sm text-white nums-latin outline-none"
      />
      <button
        onClick={() => {
          if (draft) onSave(Number(draft));
          setEditing(false);
        }}
        className="p-1 rounded-md bg-emerald-500/20 text-emerald-300"
      >
        <Check className="w-3.5 h-3.5" />
      </button>
      <button onClick={() => setEditing(false)} className="p-1 rounded-md bg-zinc-500/20 text-zinc-300">
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

export function ListingCard({ listing, onView }: { listing: Listing; onView: (l: Listing) => void }) {
  const [shareOpen, setShareOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const overdue = isOverdue(listing);
  const dueIn = daysUntilDue(listing);
  const archived = listing.status === 'archived';
  const terminal = listing.status === 'closed' || listing.status === 'fulfilled';
  const chips = summaryChips(listing.propertyType, listing.fields);
  const contactName = listing.kind === 'offer' ? listing.ownerName : listing.clientName;
  const contactPhone = listing.kind === 'offer' ? listing.ownerPhone : listing.clientPhone;
  const mainImage = listing.images.find((image) => image.main) ?? listing.images[0];

  const refreshMsg = buildRefreshMessage(listing, getProfile());

  return (
    <>
      <div
        onClick={() => onView(listing)}
        className={cn(
          'relative rounded-2xl border bg-card card-glow p-4 cursor-pointer transition-all hover:border-[#c9972f]/40 hover:-translate-y-0.5',
          overdue ? 'border-red-500/50' : 'border-border',
          archived && 'opacity-60 grayscale-[0.6]',
        )}
      >
        {mainImage && (
          <div className="relative mb-3 aspect-[16/9] overflow-hidden rounded-xl border border-border bg-secondary/40">
            <Image src={mainImage.url} alt={mainImage.name} fill sizes="(min-width: 768px) 30vw, 100vw" unoptimized className="object-cover" />
          </div>
        )}
        {/* overdue red strip */}
        {overdue && (
          <div className="absolute -top-2.5 right-4 flex items-center gap-1 bg-red-500 text-white text-[11px] font-bold px-2.5 py-0.5 rounded-full shadow-lg">
            <RefreshCw className="w-3 h-3" />
            تجاوز موعد التحديث
          </div>
        )}

        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className="text-2xl w-11 h-11 rounded-xl bg-secondary/70 border border-border flex items-center justify-center shrink-0">
              {TYPE_EMOJI[listing.propertyType]}
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-white leading-snug line-clamp-1">{listing.title}</h3>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
                <MapPin className="w-3.5 h-3.5 text-[#c9972f]" />
                <span className="truncate">
                  {listing.city}
                  {listing.district ? ` — حي ${listing.district}` : ''}
                </span>
                {listing.lat && <BadgeCheck className="w-3.5 h-3.5 text-emerald-400" />}
              </div>
            </div>
          </div>
          <span
            className={cn(
              'shrink-0 text-[11px] font-bold px-2.5 py-1 rounded-full border',
              STATUS_STYLES[listing.status] ?? STATUS_STYLES.archived,
            )}
          >
            {statusLabel(listing.kind, listing.status)}
          </span>
        </div>

        {/* chips */}
        {chips.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {chips.map((c) => (
              <span key={c} className="text-[11px] font-semibold px-2 py-1 rounded-lg bg-secondary/80 text-slate-200 border border-border">
                {c}
              </span>
            ))}
          </div>
        )}

        {/* prices: سوم vs حد */}
        <div className="grid grid-cols-2 gap-2 mt-3">
          <div
            className={cn(
              'rounded-xl border p-2.5',
              listing.priceMode === 'bid' ? 'border-[#c9972f]/40 bg-[#c9972f]/10' : 'border-border bg-secondary/40',
            )}
          >
            <p className="text-[11px] font-bold text-muted-foreground mb-0.5">
              💬 سعر السوم {listing.priceMode === 'bid' && <span className="text-[#e5bc55]">• الأساسي</span>}
            </p>
            <InlinePrice
              value={listing.priceBid}
              label="السوم"
              onSave={(v) => {
                db.updatePrice(listing.id, 'priceBid', v);
                toast.success('تم تحديث سعر السوم');
              }}
            />
          </div>
          <div
            className={cn(
              'rounded-xl border p-2.5',
              listing.priceMode === 'ask' ? 'border-[#c9972f]/40 bg-[#c9972f]/10' : 'border-border bg-secondary/40',
            )}
          >
            <p className="text-[11px] font-bold text-muted-foreground mb-0.5">
              🏷️ سعر البيع / الحد {listing.priceMode === 'ask' && <span className="text-[#e5bc55]">• الأساسي</span>}
            </p>
            <InlinePrice
              value={listing.priceAsk}
              label="الحد"
              onSave={(v) => {
                db.updatePrice(listing.id, 'priceAsk', v);
                toast.success('تم تحديث سعر الحد');
              }}
            />
          </div>
        </div>

        {/* soft warning: missing ad license (offers only — it's a publishing requirement) */}
        {listing.kind === 'offer' && !listing.adLicense && !archived && !terminal && (
          <div className="flex items-center gap-2 mt-3 text-[11px] font-semibold text-amber-300/90 bg-amber-500/10 border border-amber-500/20 rounded-lg px-2.5 py-1.5">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            رقم الإعلان العقاري غير مسجّل — يُنصح بإضافته قبل النشر
          </div>
        )}

        {/* archive reason */}
        {(archived || terminal) && listing.archiveReason && (
          <div className="flex items-center gap-2 mt-3 text-[11px] font-semibold text-zinc-300 bg-zinc-500/10 border border-zinc-500/20 rounded-lg px-2.5 py-1.5">
            <Archive className="w-3.5 h-3.5 shrink-0" />
            {ARCHIVE_REASON_LABELS[listing.archiveReason]}
            {listing.commission && (
              <span className="text-[#e5bc55]">— عمولة {fmtMoney(listing.commission.amount)}</span>
            )}
          </div>
        )}

        {/* footer */}
        <div className="flex items-center justify-between mt-4 pt-3 border-t border-border/70">
          <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
            {contactName && (
              <>
                <User className="w-3.5 h-3.5" />
                <span className="font-semibold text-slate-300">{contactName}</span>
                <span className="mx-1">•</span>
              </>
            )}
            <span>
              {overdue ? (
                <span className="text-red-400 font-bold">متأخر {Math.abs(dueIn)} يوم</span>
              ) : (
                `تحديث بعد ${dueIn} يوم`
              )}
            </span>
          </div>
          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
            {archived || terminal ? (
              <button
                onClick={() => {
                  db.restoreListing(listing.id);
                  toast.success('تمت استعادة الإعلان نشطاً');
                }}
                className="flex items-center gap-1 text-[11px] font-bold px-2.5 py-1.5 rounded-lg bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/25 transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                استعادة العقار نشط
              </button>
            ) : (
              <>
                {overdue && (
                  <>
                    <a
                      href={waLink(contactPhone, refreshMsg)}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1 text-[11px] font-bold px-2.5 py-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-500 transition-colors"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Phone className="w-3.5 h-3.5" />
                      💬 مراسلة لتحديث العقار
                    </a>
                    <button
                      onClick={() => {
                        db.refreshListing(listing.id);
                        toast.success('🟢 تم التحديث — أُعيد ضبط المؤقت');
                      }}
                      className="text-[11px] font-bold px-2 py-1.5 rounded-lg bg-secondary border border-border text-slate-200 hover:border-emerald-500/40 transition-colors"
                      title="تم التحديث"
                    >
                      🟢
                    </button>
                    <button
                      onClick={() => setArchiveOpen(true)}
                      className="text-[11px] font-bold px-2 py-1.5 rounded-lg bg-secondary border border-border text-slate-200 hover:border-red-500/40 transition-colors"
                      title="أرشفة"
                    >
                      🔴
                    </button>
                  </>
                )}
                <button
                  onClick={() => setShareOpen(true)}
                  className="flex items-center gap-1 text-[11px] font-bold px-2.5 py-1.5 rounded-lg bg-[#c9972f]/15 text-[#e5bc55] border border-[#c9972f]/30 hover:bg-[#c9972f]/25 transition-colors"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  مشاركة
                </button>
              </>
            )}
            <ChevronLeft className="w-4 h-4 text-muted-foreground" />
          </div>
        </div>

        <div className="absolute bottom-2 left-3 text-[10px] text-muted-foreground/60">{timeAgo(listing.updatedAt)}</div>
      </div>

      <ShareDialog listing={listing} open={shareOpen} onOpenChange={setShareOpen} />
      <ArchiveDialog listing={listing} open={archiveOpen} onOpenChange={setArchiveOpen} />
    </>
  );
}
