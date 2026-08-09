import { useState } from 'react';
import {
  Share2,
  Archive,
  RotateCcw,
  MapPin,
  Phone,
  BadgeCheck,
  AlertTriangle,
  RefreshCw,
  History,
  Trash2,
} from 'lucide-react';
import { useApp } from '@/ui/context/AppContext';
import { db, isOverdue, useDB } from '@/ui/lib/db';
import { ARCHIVE_REASON_LABELS, PROPERTY_TYPE_LABELS, statusLabel } from '@/ui/types';
import { TYPE_FIELDS } from '@/ui/lib/fieldDefs';
import { fmtDate, fmtDateTime, fmtMoney, timeAgo, waLink } from '@/ui/lib/format';
import { buildRefreshMessage } from '@/ui/lib/share';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/ui/components/ui/sheet';
import { ShareDialog } from '@/ui/components/ShareDialog';
import { ArchiveDialog } from '@/ui/components/ArchiveDialog';
import { toast } from 'sonner';

export function ListingDetails() {
  const { viewingListing, setViewingListing } = useApp();
  const { listings, shareLogs, activity, profile } = useDB();
  const [shareOpen, setShareOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);

  // always read the freshest version from the store
  const listing = listings.find((l) => l.id === viewingListing?.id) ?? null;
  const open = Boolean(listing);

  if (!listing) {
    return <Sheet open={false} onOpenChange={() => setViewingListing(null)} />;
  }

  const archived = listing.status === 'archived';
  const terminal = listing.status === 'closed' || listing.status === 'fulfilled';
  const overdue = isOverdue(listing);
  const isRequest = listing.kind === 'request';
  const contactName = isRequest ? listing.clientName : listing.ownerName;
  const contactPhone = isRequest ? listing.clientPhone : listing.ownerPhone;
  const listingShares = shareLogs.filter((s) => s.listingId === listing.id);
  const listingActivity = activity.filter((a) => a.listingId === listing.id).slice(0, 10);
  const headline = listing.priceMode === 'bid' ? listing.priceBid : listing.priceAsk;

  const fieldRows = TYPE_FIELDS[listing.propertyType]
    .filter((f) => listing.fields[f.key] !== undefined && listing.fields[f.key] !== '' && listing.fields[f.key] !== false)
    .map((f) => ({
      label: f.label,
      value:
        typeof listing.fields[f.key] === 'boolean'
          ? 'نعم ✅'
          : typeof listing.fields[f.key] === 'number'
            ? `${(listing.fields[f.key] as number).toLocaleString('en-US')}${f.unit ? ` ${f.unit}` : ''}`
            : String(listing.fields[f.key]),
    }));

  return (
    <>
      <Sheet open={open} onOpenChange={(v) => !v && setViewingListing(null)}>
        <SheetContent side="left" className="w-full sm:max-w-lg bg-[#0f1f3d] border-[#c9972f]/25 text-white p-0 flex flex-col">
          <SheetHeader className="px-5 pt-5 pb-4 border-b border-border shrink-0">
            <div className="flex items-start justify-between gap-3">
              <SheetTitle className="text-lg font-extrabold text-white leading-snug text-start">{listing.title}</SheetTitle>
              <span className="shrink-0 text-[11px] font-bold px-2.5 py-1 rounded-full border border-[#c9972f]/40 bg-[#c9972f]/10 text-[#e5bc55]">
                {statusLabel(listing.kind, listing.status)}
              </span>
            </div>
            <p className="text-sm text-muted-foreground flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-[#c9972f]" />
              {listing.city}
              {listing.district ? ` — حي ${listing.district}` : ''}
              {listing.lat && <BadgeCheck className="w-4 h-4 text-emerald-400" />}
            </p>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto scrollbar-thin px-5 py-4 space-y-5">
            {/* price hero */}
            <div className="rounded-2xl navy-gradient border border-[#c9972f]/30 p-4">
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-[11px] text-muted-foreground font-semibold">
                    {listing.priceMode === 'bid' ? '💬 السوم الحالي' : '🏷️ سعر البيع / الحد'}
                  </p>
                  <p className="text-3xl font-extrabold text-[#e5bc55] nums-latin mt-1">{fmtMoney(headline)}</p>
                </div>
                <div className="text-end">
                  <p className="text-[11px] text-muted-foreground font-semibold">
                    {listing.priceMode === 'bid' ? '🏷️ الحد' : '💬 السوم'}
                  </p>
                  <p className="text-lg font-bold text-slate-200 nums-latin mt-1">
                    {fmtMoney(listing.priceMode === 'bid' ? listing.priceAsk : listing.priceBid)}
                  </p>
                </div>
              </div>
              {listing.commission && (
                <div className="mt-3 pt-3 border-t border-[#c9972f]/20 flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">🎉 عمولة الصفقة ({listing.commission.percent}%)</span>
                  <span className="font-extrabold text-emerald-300 nums-latin">{fmtMoney(listing.commission.amount)}</span>
                </div>
              )}
            </div>

            {/* details grid */}
            <section>
              <h3 className="text-sm font-extrabold text-[#e5bc55] mb-2">📋 تفاصيل {PROPERTY_TYPE_LABELS[listing.propertyType]}</h3>
              <div className="grid grid-cols-2 gap-2">
                {fieldRows.map((r) => (
                  <div key={r.label} className="rounded-xl bg-secondary/50 border border-border px-3 py-2.5">
                    <p className="text-[10px] text-muted-foreground font-semibold">{r.label}</p>
                    <p className="text-sm font-bold text-white mt-0.5 nums-latin">{r.value}</p>
                  </div>
                ))}
              </div>
            </section>

            {/* licenses */}
            <section className="grid grid-cols-2 gap-2">
              <div className="rounded-xl bg-secondary/50 border border-border px-3 py-2.5">
                <p className="text-[10px] text-muted-foreground font-semibold">🪪 رخصة فال</p>
                <p className="text-sm font-bold text-white mt-0.5 nums-latin">{listing.falLicense || '—'}</p>
              </div>
              <div className="rounded-xl bg-secondary/50 border border-border px-3 py-2.5">
                <p className="text-[10px] text-muted-foreground font-semibold">📢 رقم الإعلان العقاري</p>
                <p className="text-sm font-bold text-white mt-0.5 nums-latin">{listing.adLicense || '—'}</p>
              </div>
            </section>
            {!isRequest && !listing.adLicense && (
              <div className="flex items-center gap-2 text-[11px] font-semibold text-amber-300/90 bg-amber-500/10 border border-amber-500/20 rounded-lg px-2.5 py-1.5">
                <AlertTriangle className="w-3.5 h-3.5" />
                رقم الإعلان العقاري غير مسجّل — تنبيه غير مانع
              </div>
            )}

            {/* contact */}
            {(contactName || contactPhone) && (
              <section className="rounded-xl border border-border bg-secondary/40 p-3.5 flex items-center justify-between">
                <div>
                  <p className="text-[10px] text-muted-foreground font-semibold">{isRequest ? 'العميل' : 'المالك'}</p>
                  <p className="font-bold text-white">{contactName || '—'}</p>
                  <p className="text-xs text-muted-foreground nums-latin">{contactPhone}</p>
                </div>
                {contactPhone && (
                  <a
                    href={waLink(contactPhone, buildRefreshMessage(listing, profile))}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-xl bg-emerald-600 text-white hover:bg-emerald-500 transition-colors"
                  >
                    <Phone className="w-4 h-4" />
                    واتساب
                  </a>
                )}
              </section>
            )}

            {/* archive info */}
            {(archived || terminal) && listing.archiveReason && (
              <section className="rounded-xl border border-zinc-500/30 bg-zinc-500/10 p-3.5 text-sm">
                <p className="font-bold text-zinc-200">🗄️ {ARCHIVE_REASON_LABELS[listing.archiveReason]}</p>
                <p className="text-xs text-muted-foreground mt-1">أُرشف في {fmtDate(listing.archivedAt)}</p>
              </section>
            )}

            {/* refresh status */}
            {!archived && !terminal && (
              <section className="rounded-xl border border-border bg-secondary/40 p-3.5 flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 text-slate-200">
                  <RefreshCw className={overdue ? 'w-4 h-4 text-red-400' : 'w-4 h-4 text-emerald-400'} />
                  {overdue ? 'متأخر عن التحديث!' : `التذكير كل ${listing.refreshIntervalDays} يوم`}
                </span>
                <span className="text-xs text-muted-foreground">آخر تحديث: {timeAgo(listing.lastRefreshedAt)}</span>
              </section>
            )}

            {/* notes */}
            {listing.notes && (
              <section className="rounded-xl border border-border bg-secondary/40 p-3.5">
                <p className="text-[10px] text-muted-foreground font-semibold mb-1">📝 ملاحظات</p>
                <p className="text-sm text-slate-100 leading-relaxed">{listing.notes}</p>
              </section>
            )}

            {/* raw source text */}
            {listing.rawText && (
              <details className="rounded-xl border border-border bg-secondary/30 p-3.5">
                <summary className="text-xs font-bold text-muted-foreground cursor-pointer">
                  النص الأصلي ({listing.source === 'whatsapp' ? 'واتساب' : listing.source === 'voice' ? 'صوتي' : 'يدوي'})
                </summary>
                <p className="text-xs text-slate-300 mt-2 leading-relaxed whitespace-pre-wrap">{listing.rawText}</p>
              </details>
            )}

            {/* share history */}
            <section>
              <h3 className="text-sm font-extrabold text-[#e5bc55] mb-2 flex items-center gap-1.5">
                <History className="w-4 h-4" />
                سجل المشاركات ({listingShares.length})
              </h3>
              {listingShares.length > 0 ? (
                <div className="space-y-2">
                  {listingShares.map((s) => (
                    <div key={s.id} className="rounded-xl bg-secondary/40 border border-border px-3 py-2.5 text-sm flex items-center gap-2.5">
                      <span className="text-base">{s.platform === 'whatsapp' ? '🟢' : '⚫'}</span>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-slate-100 truncate">
                          {s.platform === 'whatsapp' ? 'واتساب' : 'منصة X'} — {s.recipientName}
                        </p>
                        <p className="text-[10px] text-muted-foreground">{fmtDateTime(s.createdAt)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">لم تتم مشاركة هذا الإعلان بعد</p>
              )}
            </section>

            {/* activity */}
            {listingActivity.length > 0 && (
              <section>
                <h3 className="text-sm font-extrabold text-[#e5bc55] mb-2">🕘 آخر الأحداث</h3>
                <div className="space-y-1.5">
                  {listingActivity.map((a) => (
                    <div key={a.id} className="text-xs text-slate-300 flex items-center justify-between gap-2 rounded-lg bg-secondary/30 px-3 py-2">
                      <span>{a.detail}</span>
                      <span className="text-[10px] text-muted-foreground shrink-0">{timeAgo(a.createdAt)}</span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            <p className="text-[10px] text-muted-foreground text-center">
              أُنشئ في {fmtDate(listing.createdAt)} • المصدر:{' '}
              {listing.source === 'whatsapp' ? 'لصق واتساب' : listing.source === 'voice' ? 'إدخال صوتي' : 'يدوي'}
            </p>
          </div>

          {/* actions */}
          <div className="shrink-0 border-t border-border p-4 bg-[#0c1a36] space-y-2">
            {archived || terminal ? (
              <button
                onClick={() => {
                  db.restoreListing(listing.id);
                  toast.success('تمت استعادة الإعلان نشطاً ♻️');
                }}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold py-3 transition-colors"
              >
                <RotateCcw className="w-5 h-5" />
                استعادة العقار نشط
              </button>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setShareOpen(true)}
                  className="flex items-center justify-center gap-2 rounded-xl gold-gradient text-[#0f1f3d] font-extrabold py-3 hover:brightness-110 transition-all"
                >
                  <Share2 className="w-5 h-5" />
                  مشاركة ذكية
                </button>
                <button
                  onClick={() => setArchiveOpen(true)}
                  className="flex items-center justify-center gap-2 rounded-xl border border-zinc-500/40 bg-zinc-600/20 text-zinc-200 font-extrabold py-3 hover:bg-zinc-600/40 transition-colors"
                >
                  <Archive className="w-5 h-5" />
                  أرشفة
                </button>
              </div>
            )}
            <button
              onClick={() => {
                db.deleteListing(listing.id);
                setViewingListing(null);
                toast.success('تم حذف الإعلان نهائياً');
              }}
              className="w-full flex items-center justify-center gap-1.5 rounded-xl text-red-400/80 hover:text-red-300 text-xs font-bold py-1.5 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              حذف نهائي
            </button>
          </div>
        </SheetContent>
      </Sheet>

      <ShareDialog listing={listing} open={shareOpen} onOpenChange={setShareOpen} />
      <ArchiveDialog listing={listing} open={archiveOpen} onOpenChange={setArchiveOpen} />
    </>
  );
}
