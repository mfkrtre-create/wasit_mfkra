import { useMemo, useState } from 'react';
import {
  BadgeCheck,
  Banknote,
  Bell,
  CalendarClock,
  Check,
  ClipboardCopy,
  Copy,
  Gift,
  Link2,
  LogOut,
  MessageCircle,
  RotateCcw,
  Save,
  Send,
  Share2,
  Trash2,
  UserCircle,
  XCircle,
} from 'lucide-react';
import { db, useDB } from '@/ui/lib/db';
import { fmtDate, fmtDateTime, fmtMoney, monthKey, monthLabel, waLink } from '@/ui/lib/format';
import { buildShareMessage, xShareUrl } from '@/ui/lib/share';
import { createPublicShare, revokePublicShare, type PublicShareLink, type PublicShareOptions } from '@/ui/lib/public-share';
import { cn } from '@/ui/lib/utils';
import { toast } from 'sonner';

type Section = 'account' | 'reminders' | 'notifications' | 'sharing' | 'trash';

const SECTIONS = [
  { key: 'account', label: 'الحساب والإحصائيات', icon: UserCircle },
  { key: 'reminders', label: 'التذكيرات', icon: CalendarClock },
  { key: 'notifications', label: 'الإشعارات', icon: Bell },
  { key: 'sharing', label: 'روابط المشاركة', icon: Link2 },
  { key: 'trash', label: 'سلة المحذوفات', icon: Trash2 },
] as const;

export function AccountPage() {
  const { profile, listings, reminders, notifications } = useDB();
  const [section, setSection] = useState<Section>('account');
  const [name, setName] = useState(profile.name);
  const [phone, setPhone] = useState(profile.phone);
  const [fal, setFal] = useState(profile.falLicense);
  const [links, setLinks] = useState<PublicShareLink[]>([]);
  const [linksBusy, setLinksBusy] = useState(false);
  const [selectedShareId, setSelectedShareId] = useState('');
  const [publicUrl, setPublicUrl] = useState('');
  const [shareMessage, setShareMessage] = useState('');
  const [shareBusy, setShareBusy] = useState(false);
  const [copiedShare, setCopiedShare] = useState(false);
  const [publicOptions, setPublicOptions] = useState<PublicShareOptions>({
    includePrice: true,
    includeAskingPrice: true,
    includeArea: true,
    includeContact: false,
    includeNotes: false,
    includeMap: true,
    includeImage: false,
    expiresInDays: 30,
  });

  const active = useMemo(() => listings.filter((item) => !item.deletedAt), [listings]);
  const trashed = useMemo(() => listings.filter((item) => item.deletedAt), [listings]);
  const deals = useMemo(
    () => active.filter((listing) => listing.commission).sort((a, b) => (b.commission!.date > a.commission!.date ? 1 : -1)),
    [active],
  );
  const monthly = useMemo(() => {
    const map = new Map<string, number>();
    for (const deal of deals) {
      const key = monthKey(deal.commission!.date);
      map.set(key, (map.get(key) ?? 0) + deal.commission!.amount);
    }
    return [...map.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1)).slice(-6);
  }, [deals]);
  const maxMonth = Math.max(1, ...monthly.map(([, value]) => value));
  const total = deals.reduce((sum, deal) => sum + deal.commission!.amount, 0);
  const selectedShareRecord = active.find((listing) => listing.id === selectedShareId) ?? active[0] ?? null;
  const currentShareText = selectedShareRecord
    ? buildShareMessage(
        selectedShareRecord,
        {
          showPrice: publicOptions.includePrice,
          showBrokerNumber: publicOptions.includeContact,
          showBidInstead: publicOptions.includeAskingPrice,
          includeArea: publicOptions.includeArea,
          includeMap: publicOptions.includeMap,
          includeImage: publicOptions.includeImage,
          includeQuickLink: Boolean(publicUrl),
        },
        profile,
      )
    : '';
  const textWithLink = publicUrl ? `${currentShareText}\n\nرابط التفاصيل\n${publicUrl}` : currentShareText;

  const loadLinks = () => {
    setLinksBusy(true);
    void fetch('/api/shares', { cache: 'no-store' })
      .then(async (response) => {
        const body = (await response.json().catch(() => null)) as { shares?: PublicShareLink[]; error?: string } | null;
        if (!response.ok) throw new Error(body?.error || 'تعذر تحميل الروابط.');
        setLinks(body?.shares ?? []);
      })
      .catch((error) => toast.error(error instanceof Error ? error.message : 'تعذر تحميل الروابط.'))
      .finally(() => setLinksBusy(false));
  };

  const selectSection = (nextSection: Section) => {
    setSection(nextSection);
    if (nextSection === 'sharing') loadLinks();
  };

  const shareOptionsForLog = () => ({
    showPrice: publicOptions.includePrice,
    showBrokerNumber: publicOptions.includeContact,
    showBidInstead: publicOptions.includeAskingPrice,
    includeArea: publicOptions.includeArea,
    includeMap: publicOptions.includeMap,
    includeImage: publicOptions.includeImage,
    includeQuickLink: Boolean(publicUrl),
  });

  const updatePublicOptions = (patch: Partial<PublicShareOptions>) => {
    setPublicOptions((current) => ({ ...current, ...patch }));
    setPublicUrl('');
    setShareMessage('تم تحديث خيارات المشاركة. أنشئ رابطاً جديداً لتطبيق الخيارات.');
  };

  const createLink = async () => {
    if (!selectedShareRecord) {
      setShareMessage('أضف سجلاً أولاً حتى يمكن إنشاء رابط مشاركة.');
      return;
    }
    setShareBusy(true);
    setShareMessage('جاري إنشاء رابط المشاركة...');
    try {
      const result = await createPublicShare(selectedShareRecord, publicOptions);
      setPublicUrl(result.url);
      setLinks((current) => [result.share, ...current.filter((link) => link.id !== result.share.id)]);
      setShareMessage('تم إنشاء رابط عام آمن لهذا السجل.');
    } catch (error) {
      setShareMessage(error instanceof Error ? error.message : 'تعذر إنشاء رابط المشاركة.');
    } finally {
      setShareBusy(false);
    }
  };

  const logShare = (platform: 'whatsapp' | 'x', message: string) => {
    if (!selectedShareRecord) return;
    db.addShareLog({
      listingId: selectedShareRecord.id,
      listingTitle: selectedShareRecord.title,
      listingKind: selectedShareRecord.kind,
      recipientName: platform === 'whatsapp' ? 'جهة واتساب' : 'متابعو X',
      platform,
      message,
      options: shareOptionsForLog(),
    });
  };

  const copyShareText = async () => {
    if (!textWithLink) return;
    await navigator.clipboard?.writeText(textWithLink);
    setCopiedShare(true);
    setTimeout(() => setCopiedShare(false), 1500);
    logShare('whatsapp', textWithLink);
    toast.success('تم نسخ نص المشاركة');
  };

  const saveProfile = () => {
    db.updateProfile({ name: name.trim() || profile.name, phone: phone.trim(), falLicense: fal.trim() });
    toast.success('تم حفظ بيانات الحساب');
  };

  const signOut = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.reload();
  };

  const renderSharing = () => (
    <section className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
      <div className="rounded-2xl border border-border bg-card card-glow p-5 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-extrabold text-white flex items-center gap-2"><Share2 className="w-5 h-5 text-[#e5bc55]" />اختيار سجل للمشاركة</h2>
          <button type="button" onClick={loadLinks} className="text-xs font-extrabold text-[#e5bc55]">تحديث الروابط</button>
        </div>
        {active.length > 0 ? (
          <>
            <label className="grid gap-1.5 text-xs font-bold text-muted-foreground">
              السجل
              <select value={selectedShareRecord?.id ?? ''} onChange={(event) => { setSelectedShareId(event.target.value); setPublicUrl(''); }} className="rounded-xl border border-border bg-[#0a1730] px-3 py-2.5 text-sm font-bold text-white outline-none">
                {active.map((listing) => <option key={listing.id} value={listing.id}>{listing.title}</option>)}
              </select>
            </label>
            <div className="grid grid-cols-2 gap-2">
              {[
                ['includePrice', 'إظهار السعر أو الميزانية'],
                ['includeAskingPrice', 'إظهار السوم'],
                ['includeArea', 'إظهار المساحة'],
                ['includeContact', 'إظهار بيانات التواصل'],
                ['includeNotes', 'إظهار الملاحظات'],
                ['includeMap', 'إظهار الموقع'],
                ['includeImage', 'إظهار صورة العقار'],
              ].map(([key, label]) => (
                <label key={key} className="flex items-center gap-2 rounded-xl border border-border bg-secondary/40 px-3 py-2 text-xs font-bold text-slate-200">
                  <input type="checkbox" checked={Boolean(publicOptions[key as keyof PublicShareOptions])} onChange={(event) => updatePublicOptions({ [key]: event.target.checked } as Partial<PublicShareOptions>)} />
                  {label}
                </label>
              ))}
            </div>
            <select value={publicOptions.expiresInDays ?? 'never'} onChange={(event) => updatePublicOptions({ expiresInDays: event.target.value === 'never' ? null : Number(event.target.value) })} className="w-full rounded-xl border border-border bg-[#0a1730] px-3 py-2.5 text-sm font-bold text-white outline-none">
              <option value="7">صلاحية 7 أيام</option>
              <option value="30">صلاحية 30 يوم</option>
              <option value="90">صلاحية 90 يوم</option>
              <option value="never">بدون انتهاء</option>
            </select>
            <button type="button" disabled={shareBusy} onClick={() => void createLink()} className="w-full gold-gradient rounded-xl py-3 font-extrabold text-[#0f1f3d] disabled:opacity-60">
              {shareBusy ? 'جاري إنشاء الرابط...' : 'إنشاء رابط عام'}
            </button>
            {shareMessage && <p className="rounded-xl border border-[#c9972f]/25 bg-[#c9972f]/10 px-3 py-2 text-sm font-bold leading-7 text-slate-200">{shareMessage}</p>}
            {publicUrl && (
              <button type="button" onClick={() => void navigator.clipboard?.writeText(publicUrl)} className="w-full rounded-xl border border-[#c9972f]/35 bg-[#c9972f]/10 px-3 py-2 text-xs font-extrabold text-[#e5bc55] break-all">
                <ClipboardCopy className="inline-block w-4 h-4 ms-1" />
                نسخ الرابط العام
              </button>
            )}
            <div className="grid grid-cols-3 gap-2">
              <a href={waLink(undefined, textWithLink)} target="_blank" rel="noreferrer" onClick={() => logShare('whatsapp', textWithLink)} className="rounded-xl bg-emerald-600 px-3 py-2.5 text-center text-xs font-extrabold text-white"><MessageCircle className="inline-block w-4 h-4 ms-1" />واتساب</a>
              <a href={xShareUrl(textWithLink)} target="_blank" rel="noreferrer" onClick={() => logShare('x', textWithLink)} className="rounded-xl border border-zinc-600 bg-zinc-800 px-3 py-2.5 text-center text-xs font-extrabold text-white"><Send className="inline-block w-4 h-4 ms-1" />X</a>
              <button type="button" onClick={() => void copyShareText()} className="rounded-xl border border-border bg-secondary/50 px-3 py-2.5 text-xs font-extrabold text-slate-200">{copiedShare ? <Check className="inline-block w-4 h-4 ms-1 text-emerald-300" /> : <Copy className="inline-block w-4 h-4 ms-1" />}{copiedShare ? 'نُسخ' : 'نسخ النص'}</button>
            </div>
          </>
        ) : <Empty text="أضف أول عرض أو طلب حتى تظهر أدوات المشاركة." />}
      </div>

      <div className="rounded-2xl border border-border bg-card card-glow p-5 space-y-4">
        <h2 className="font-extrabold text-white">نص المشاركة</h2>
        <pre className="min-h-64 max-h-80 overflow-y-auto whitespace-pre-wrap rounded-xl border border-[#c9972f]/20 bg-[#0a1730] p-4 text-sm leading-8 text-slate-100 font-[inherit] scrollbar-thin">
          {textWithLink || 'اختر سجلاً لتجهيز نص المشاركة.'}
        </pre>
        <div className="flex items-center justify-between gap-2">
          <p className="font-extrabold text-white">روابط تم إنشاؤها</p>
          {linksBusy && <span className="text-xs font-bold text-muted-foreground">جاري التحميل...</span>}
        </div>
        <div className="space-y-2">
          {!linksBusy && links.length ? links.slice(0, 8).map((link) => (
            <div key={link.id} className="rounded-xl border border-border bg-secondary/40 p-3.5 flex flex-wrap items-center gap-3">
              <div className="flex-1 min-w-48"><p className="font-bold text-white">{link.title}</p><p className="text-xs text-muted-foreground mt-1">{link.revoked_at ? 'ملغى' : link.expires_at ? `ينتهي ${fmtDateTime(link.expires_at)}` : 'بدون انتهاء'}</p></div>
              {!link.revoked_at && <button onClick={async () => { await revokePublicShare(link.id); setLinks((current) => current.map((item) => item.id === link.id ? { ...item, revoked_at: new Date().toISOString() } : item)); }} className="text-xs font-extrabold text-red-300">إلغاء الرابط</button>}
            </div>
          )) : <Empty text="لم يتم إنشاء روابط عامة بعد." />}
        </div>
      </div>
    </section>
  );

  return (
    <div className="max-w-5xl mx-auto px-4 py-5 md:py-8 space-y-5">
      <header>
        <h1 className="text-2xl md:text-3xl font-extrabold text-white flex items-center gap-2.5">
          <span className="w-10 h-10 rounded-xl gold-gradient flex items-center justify-center">
            <UserCircle className="w-5 h-5 text-[#0f1f3d]" strokeWidth={2.5} />
          </span>
          حسابي
        </h1>
        <p className="text-sm text-muted-foreground mt-1.5">الحساب، المتابعات، وإدارة البيانات الخاصة</p>
      </header>

      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {SECTIONS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => selectSection(key)}
            className={cn(
              'shrink-0 flex items-center gap-2 rounded-xl border px-3.5 py-2.5 text-xs font-extrabold transition-colors',
              section === key ? 'gold-gradient border-transparent text-[#0f1f3d]' : 'border-border bg-card text-slate-300',
            )}
          >
            <Icon className="w-4 h-4" />
            {label}
            {key === 'notifications' && notifications.some((item) => !item.read) && <span className="w-2 h-2 rounded-full bg-red-500" />}
            {key === 'trash' && trashed.length > 0 && <span className="nums-latin">({trashed.length})</span>}
          </button>
        ))}
      </div>

      {section === 'account' && (
        <div className="space-y-5">
          <section className="rounded-2xl border border-[#c9972f]/25 navy-gradient card-glow p-5">
            <div className="flex items-start justify-between flex-wrap gap-3">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl gold-gradient flex items-center justify-center text-2xl font-extrabold text-[#0f1f3d]">{profile.name.charAt(0)}</div>
                <div>
                  <p className="text-xl font-extrabold text-white">{profile.name}</p>
                  <p className="text-sm text-muted-foreground mt-0.5">{profile.email}</p>
                  <p className="text-sm text-muted-foreground flex items-center gap-1.5 mt-0.5"><BadgeCheck className="w-4 h-4 text-[#e5bc55]" />رخصة فال: <span className="nums-latin">{profile.falLicense}</span></p>
                </div>
              </div>
              <div className="rounded-xl bg-[#0a1730]/70 border border-[#c9972f]/20 px-4 py-3 text-center">
                <p className="text-[10px] text-muted-foreground font-semibold flex items-center gap-1"><Gift className="w-3.5 h-3.5 text-[#e5bc55]" />كود الإحالة</p>
                <p className="font-extrabold text-[#e5bc55] nums-latin mt-1">{profile.referralCode}</p>
              </div>
            </div>
            <div className="grid sm:grid-cols-3 gap-2.5 mt-4">
              <Field label="الاسم" value={name} onChange={setName} />
              <Field label="الجوال" value={phone} onChange={setPhone} />
              <Field label="رخصة فال" value={fal} onChange={setFal} />
            </div>
            <div className="mt-4">
              <p className="text-xs font-bold text-muted-foreground mb-2">فترة التذكير الافتراضية</p>
              <div className="flex gap-2">
                {([7, 14, 30] as const).map((days) => (
                  <button key={days} onClick={() => db.updateProfile({ defaultReminderDays: days })} className={cn('rounded-xl border px-4 py-2 text-xs font-extrabold', profile.defaultReminderDays === days ? 'border-[#c9972f] bg-[#c9972f]/15 text-[#e5bc55]' : 'border-border bg-secondary/50 text-slate-300')}>كل {days} يوم</button>
                ))}
              </div>
              <input type="number" min={1} max={365} value={profile.defaultReminderDays} onChange={(event) => db.updateProfile({ defaultReminderDays: Math.max(1, Math.min(365, Number(event.target.value) || 14)) })} className="mt-2 w-40 bg-[#0a1730]/70 border border-border rounded-xl px-3 py-2 text-sm text-white nums-latin" aria-label="فترة التذكير الافتراضية بالأيام" />
            </div>
            <div className="flex flex-wrap gap-2 mt-4">
              <button onClick={saveProfile} className="flex items-center gap-1.5 text-sm font-extrabold px-4 py-2.5 rounded-xl gold-gradient text-[#0f1f3d]"><Save className="w-4 h-4" />حفظ البيانات</button>
              <button onClick={() => void signOut()} className="flex items-center gap-1.5 text-sm font-extrabold px-4 py-2.5 rounded-xl border border-border text-slate-200"><LogOut className="w-4 h-4" />تسجيل الخروج</button>
            </div>
          </section>

          <section className="rounded-2xl border border-border bg-card card-glow p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-extrabold text-white flex items-center gap-2"><Banknote className="w-5 h-5 text-[#e5bc55]" />إحصائيات الأداء والصفقات</h2>
              <p className="font-extrabold text-[#e5bc55] nums-latin">{fmtMoney(total)}</p>
            </div>
            <div className="grid grid-cols-3 gap-2 mb-5">
              <Metric label="إجمالي السجلات" value={active.length} />
              <Metric label="الصفقات المنجزة" value={deals.length} />
              <Metric label="إجمالي العمولات" value={fmtMoney(total)} />
            </div>
            {monthly.length > 0 ? (
              <div className="flex items-end gap-3 h-40 border-b border-border pb-1">
                {monthly.map(([key, value]) => (
                  <div key={key} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end">
                    <span className="text-[10px] font-bold text-[#e5bc55] nums-latin">{value >= 1000 ? `${Math.round(value / 1000)}k` : value}</span>
                    <div className="w-full max-w-14 rounded-t-lg gold-gradient" style={{ height: `${Math.max(6, (value / maxMonth) * 100)}%` }} />
                    <span className="text-[10px] text-muted-foreground">{monthLabel(key).split(' ')[0]}</span>
                  </div>
                ))}
              </div>
            ) : <Empty text="لا توجد عمولات مسجلة بعد." />}
          </section>
        </div>
      )}

      {section === 'reminders' && (
        <section className="rounded-2xl border border-border bg-card card-glow p-5 space-y-3">
          {reminders.length ? reminders.map((reminder) => {
            const listing = listings.find((item) => item.id === reminder.listingId);
            const effectiveStatus = reminder.status;
            return (
              <div key={reminder.id} className="rounded-xl border border-border bg-secondary/40 p-3.5 flex flex-wrap items-center gap-3">
                <div className="flex-1 min-w-48"><p className="font-bold text-white">{listing?.title ?? reminder.title}</p><p className="text-xs text-muted-foreground mt-1">{fmtDateTime(reminder.dueAt)}</p></div>
                <select value={effectiveStatus} onChange={(event) => db.updateReminder(reminder.id, event.target.value as typeof reminder.status)} className="rounded-xl border border-border bg-[#0a1730] px-3 py-2 text-xs font-bold text-slate-200">
                  <option value="scheduled">مجدول</option><option value="due">مستحق</option><option value="completed">مكتمل</option>
                </select>
              </div>
            );
          }) : <Empty text="لا توجد تذكيرات بعد." />}
        </section>
      )}

      {section === 'notifications' && (
        <section className="rounded-2xl border border-border bg-card card-glow p-5 space-y-3">
          <div className="flex justify-end"><button onClick={() => db.markAllNotificationsRead()} className="text-xs font-extrabold text-[#e5bc55]">تعليم الكل كمقروء</button></div>
          {notifications.length ? notifications.map((item) => (
            <div key={item.id} className={cn('rounded-xl border p-3.5', item.read ? 'border-border bg-secondary/30' : 'border-[#c9972f]/35 bg-[#c9972f]/10')}>
              <p className="font-bold text-white">{item.title}</p><p className="text-sm text-slate-300 mt-1">{item.body.replace(/\s*\[[^\]]+\]$/, '')}</p><p className="text-[10px] text-muted-foreground mt-2">{fmtDateTime(item.createdAt)}</p>
            </div>
          )) : <Empty text="لا توجد إشعارات." />}
        </section>
      )}

      {section === 'sharing' && renderSharing()}

      {section === 'trash' && (
        <section className="rounded-2xl border border-border bg-card card-glow p-5 space-y-3">
          <p className="text-xs text-muted-foreground">تُحذف العناصر تلقائياً بعد 30 يوماً. يمكن استعادتها قبل ذلك.</p>
          {trashed.length ? trashed.map((listing) => (
            <div key={listing.id} className="rounded-xl border border-border bg-secondary/40 p-3.5 flex flex-wrap items-center gap-3">
              <div className="flex-1 min-w-48"><p className="font-bold text-white">{listing.title}</p><p className="text-xs text-muted-foreground mt-1">حُذف {fmtDate(listing.deletedAt)}</p></div>
              <button onClick={() => db.restoreDeletedListing(listing.id)} className="inline-flex items-center gap-1.5 text-xs font-extrabold text-emerald-300"><RotateCcw className="w-4 h-4" />استعادة</button>
              <button onClick={() => { if (window.confirm(`حذف "${listing.title}" نهائياً؟`)) db.deleteListingPermanently(listing.id); }} className="inline-flex items-center gap-1.5 text-xs font-extrabold text-red-300"><XCircle className="w-4 h-4" />حذف نهائي</button>
            </div>
          )) : <Empty text="سلة المحذوفات فارغة." />}
        </section>
      )}
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="space-y-1"><span className="text-[11px] font-bold text-muted-foreground">{label}</span><input value={value} onChange={(event) => onChange(event.target.value)} className="w-full bg-[#0a1730]/70 border border-border rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-[#c9972f]/60" /></label>;
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return <div className="rounded-xl border border-border bg-secondary/40 p-3 text-center"><p className="font-extrabold text-white nums-latin">{value}</p><p className="text-[10px] text-muted-foreground mt-1">{label}</p></div>;
}

function Empty({ text }: { text: string }) {
  return <p className="text-sm text-muted-foreground text-center py-8">{text}</p>;
}
