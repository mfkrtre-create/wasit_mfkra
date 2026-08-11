import { Link } from 'react-router';
import {
  Tag,
  Inbox,
  AlarmClock,
  Banknote,
  Plus,
  TrendingUp,
  ChevronLeft,
  Activity as ActivityIcon,
} from 'lucide-react';
import { useApp } from '@/ui/context/AppContext';
import { db, isOverdue, useDB } from '@/ui/lib/db';
import { fmtMoney, monthKey, timeAgo, waLink } from '@/ui/lib/format';
import { buildRefreshMessage } from '@/ui/lib/share';
import { ListingCard } from '@/ui/components/ListingCard';
import { cn } from '@/ui/lib/utils';

const ACTIVITY_ICONS: Record<string, string> = {
  created: '➕',
  updated: '✏️',
  price_update: '💰',
  refreshed: '🟢',
  archived: '🗄️',
  restored: '♻️',
  shared: '📤',
  status_change: '🔁',
};

export function Dashboard() {
  const { listings, activity, profile } = useDB();
  const { openQuickAdd, setViewingListing } = useApp();

  const activeListings = listings.filter((l) => !l.deletedAt);
  const offers = activeListings.filter((l) => l.kind === 'offer' && l.status !== 'archived' && l.status !== 'closed');
  const requests = activeListings.filter((l) => l.kind === 'request' && l.status !== 'archived' && l.status !== 'fulfilled');
  const totalOffers = activeListings.filter((l) => l.kind === 'offer').length;
  const totalRequests = activeListings.filter((l) => l.kind === 'request').length;
  const overdue = activeListings.filter(isOverdue);
  const thisMonth = monthKey(new Date().toISOString());
  const monthCommission = activeListings
    .filter((l) => l.commission && monthKey(l.commission.date) === thisMonth)
    .reduce((sum, l) => sum + (l.commission?.amount ?? 0), 0);
  const totalCommission = activeListings.reduce((sum, l) => sum + (l.commission?.amount ?? 0), 0);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'صباح الخير' : hour < 17 ? 'مساء الخير' : 'مساء النور';

  const kpis = [
    { label: `عروض نشطة من ${totalOffers}`, value: offers.length, icon: Tag, tone: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/25', to: '/offers' },
    { label: `طلبات نشطة من ${totalRequests}`, value: requests.length, icon: Inbox, tone: 'text-violet-300 bg-violet-500/10 border-violet-500/25', to: '/requests' },
    { label: 'تحتاج تحديث', value: overdue.length, icon: AlarmClock, tone: 'text-red-300 bg-red-500/10 border-red-500/25', to: '/' },
    { label: 'عمولة الشهر', value: fmtMoney(monthCommission), icon: Banknote, tone: 'text-[#e5bc55] bg-[#c9972f]/10 border-[#c9972f]/25', to: '/account' },
  ];

  return (
    <div className="max-w-6xl mx-auto px-4 py-5 md:py-8 space-y-6">
      {/* header */}
      <header className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[#c9972f] text-sm font-bold">{greeting} 👋</p>
          <h1 className="text-2xl md:text-3xl font-extrabold text-white mt-0.5">{profile.name}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {profile.tier} • رخصة فال {profile.falLicense}
          </p>
        </div>
        <button
          onClick={() => openQuickAdd('offer')}
          className="hidden sm:flex gold-gradient text-[#0f1f3d] font-extrabold rounded-xl px-5 py-3 items-center gap-2 shadow-lg hover:brightness-110 active:scale-[0.98] transition-all"
        >
          <Plus className="w-5 h-5" strokeWidth={3} />
          إضافة سريعة
        </button>
      </header>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {kpis.map(({ label, value, icon: Icon, tone, to }) => (
          <Link
            key={label}
            to={to}
            className={cn('rounded-2xl border p-4 card-glow bg-card hover:-translate-y-0.5 transition-transform', tone.split(' ')[2])}
          >
            <div className={cn('w-10 h-10 rounded-xl border flex items-center justify-center mb-3', tone)}>
              <Icon className="w-5 h-5" />
            </div>
            <p className="text-xl md:text-2xl font-extrabold text-white nums-latin">{value}</p>
            <p className="text-xs text-muted-foreground font-semibold mt-0.5">{label}</p>
          </Link>
        ))}
      </div>

      {/* overdue alerts */}
      {overdue.length > 0 && (
        <section className="rounded-2xl border border-red-500/30 bg-red-500/5 p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-extrabold text-red-300 flex items-center gap-2">
              <AlarmClock className="w-5 h-5" />
              إعلانات تجاوزت موعد تحديثها ({overdue.length})
            </h2>
          </div>
          <div className="space-y-2">
            {overdue.map((l) => {
              const phone = l.kind === 'offer' ? l.ownerPhone : l.clientPhone;
              return (
                <div key={l.id} className="flex flex-wrap items-center gap-2 rounded-xl bg-card border border-red-500/20 px-3.5 py-2.5">
                  <span className="font-bold text-sm text-white flex-1 min-w-40 truncate">{l.title}</span>
                  <span className="text-[11px] text-muted-foreground">{l.kind === 'offer' ? l.ownerName : l.clientName}</span>
                  <div className="flex gap-1.5 ms-auto">
                    <a
                      href={waLink(phone, buildRefreshMessage(l, profile))}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[11px] font-bold px-2.5 py-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-500 transition-colors"
                    >
                      💬 مراسلة لتحديث العقار
                    </a>
                    <button
                      onClick={() => db.refreshListing(l.id)}
                      className="text-[11px] font-bold px-2.5 py-1.5 rounded-lg bg-secondary border border-border text-slate-200 hover:border-emerald-500/40"
                    >
                      🟢 تم التحديث
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* quick actions */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'إضافة عرض', emoji: '🏷️', action: () => openQuickAdd('offer') },
          { label: 'إضافة طلب', emoji: '📥', action: () => openQuickAdd('request') },
          { label: 'الخريطة', emoji: '🗺️', to: '/map' },
          { label: 'الإحصائيات', emoji: '📊', to: '/account' },
        ].map((a) =>
          a.to ? (
            <Link
              key={a.label}
              to={a.to}
              className="rounded-2xl border border-border bg-card card-glow p-4 text-center hover:border-[#c9972f]/40 hover:-translate-y-0.5 transition-all"
            >
              <span className="text-2xl">{a.emoji}</span>
              <p className="text-sm font-bold text-slate-200 mt-1.5">{a.label}</p>
            </Link>
          ) : (
            <button
              key={a.label}
              onClick={a.action}
              className="rounded-2xl border border-border bg-card card-glow p-4 text-center hover:border-[#c9972f]/40 hover:-translate-y-0.5 transition-all"
            >
              <span className="text-2xl">{a.emoji}</span>
              <p className="text-sm font-bold text-slate-200 mt-1.5">{a.label}</p>
            </button>
          ),
        )}
      </section>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* recent listings */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-extrabold text-white flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-[#c9972f]" />
              أحدث الإعلانات
            </h2>
            <Link to="/offers" className="text-xs font-bold text-[#e5bc55] flex items-center gap-0.5 hover:underline">
              عرض الكل
              <ChevronLeft className="w-3.5 h-3.5" />
            </Link>
          </div>
          <div className="space-y-3">
            {activeListings
              .filter((l) => l.status !== 'archived')
              .slice(0, 3)
              .map((l) => (
                <ListingCard key={l.id} listing={l} onView={setViewingListing} />
              ))}
            {activeListings.filter((l) => l.status !== 'archived').length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">لا توجد إعلانات بعد — أضف أول إعلان ⚡</p>
            )}
          </div>
        </section>

        {/* activity feed */}
        <section>
          <h2 className="font-extrabold text-white flex items-center gap-2 mb-3">
            <ActivityIcon className="w-5 h-5 text-[#c9972f]" />
            سجل النشاط
          </h2>
          <div className="rounded-2xl border border-border bg-card card-glow divide-y divide-border/60 max-h-[520px] overflow-y-auto scrollbar-thin">
            {activity.slice(0, 20).map((a) => (
              <div key={a.id} className="flex items-start gap-3 px-4 py-3">
                <span className="text-lg mt-0.5">{ACTIVITY_ICONS[a.type] ?? '•'}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-100 leading-snug">{a.detail}</p>
                  {a.listingTitle && <p className="text-[11px] text-[#e5bc55]/80 mt-0.5 truncate">{a.listingTitle}</p>}
                  <p className="text-[10px] text-muted-foreground mt-0.5">{timeAgo(a.createdAt)}</p>
                </div>
              </div>
            ))}
            {activity.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">لا يوجد نشاط بعد</p>}
          </div>
        </section>
      </div>

      {/* commission summary strip */}
      {totalCommission > 0 && (
        <section className="rounded-2xl border border-[#c9972f]/30 navy-gradient p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground font-semibold">إجمالي العمولات المحققة</p>
            <p className="text-2xl font-extrabold text-[#e5bc55] nums-latin mt-0.5">{fmtMoney(totalCommission)}</p>
          </div>
          <Link to="/account" className="text-xs font-bold text-[#e5bc55] flex items-center gap-1 hover:underline">
            التفاصيل المالية
            <ChevronLeft className="w-4 h-4" />
          </Link>
        </section>
      )}
    </div>
  );
}
