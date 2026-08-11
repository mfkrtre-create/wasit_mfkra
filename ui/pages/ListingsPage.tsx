import { useMemo, useState } from 'react';
import { Loader2, Plus, Search, Sparkles, Tag, Inbox } from 'lucide-react';
import type { ListingKind, ListingStatus } from '@/ui/types';
import { allStatuses, statusLabel } from '@/ui/types';
import { useDB } from '@/ui/lib/db';
import { useApp } from '@/ui/context/AppContext';
import { ListingCard } from '@/ui/components/ListingCard';
import { cn } from '@/ui/lib/utils';
import { analyzeListingSearch, matchesAiSearch, type ListingSearchFilters } from '@/ui/lib/ai-search';
import { toast } from 'sonner';

export function ListingsPage({ kind }: { kind: ListingKind }) {
  const { listings } = useDB();
  const { openQuickAdd, setViewingListing } = useApp();
  const statuses = allStatuses(kind);
  const [activeTab, setActiveTab] = useState<ListingStatus | 'all'>('all');
  const [query, setQuery] = useState('');
  const [aiFilters, setAiFilters] = useState<ListingSearchFilters | null>(null);
  const [aiBusy, setAiBusy] = useState(false);

  const mine = useMemo(() => listings.filter((l) => !l.deletedAt && l.kind === kind), [listings, kind]);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    c.all = mine.length;
    for (const s of statuses) c[s] = mine.filter((l) => l.status === s).length;
    return c;
  }, [mine, statuses]);

  const filtered = useMemo(() => {
    const q = query.trim();
    return mine
      .filter((l) => activeTab === 'all' || l.status === activeTab)
      .filter((l) => !aiFilters || matchesAiSearch(l, aiFilters))
      .filter(
        (l) =>
          Boolean(aiFilters) ||
          !q ||
          l.title.includes(q) ||
          l.district.includes(q) ||
          l.city.includes(q) ||
          (l.ownerName ?? '').includes(q) ||
          (l.clientName ?? '').includes(q),
      );
  }, [mine, activeTab, aiFilters, query]);

  const runAiSearch = async () => {
    if (!query.trim()) return;
    setAiBusy(true);
    try {
      setAiFilters(await analyzeListingSearch(query));
      toast.success('تم تطبيق فهم البحث الذكي');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'تعذر البحث الذكي.');
    } finally {
      setAiBusy(false);
    }
  };

  const Icon = kind === 'offer' ? Tag : Inbox;
  const pageTitle = kind === 'offer' ? 'العروض' : 'الطلبات';
  const pageDesc =
    kind === 'offer'
      ? 'عقارات تعرضها لعملائك — للبيع أو للإيجار'
      : 'طلبات عملائك — شراء أو استئجار تبحث لهم عنه';

  return (
    <div className="max-w-6xl mx-auto px-4 py-5 md:py-8 space-y-5">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-white flex items-center gap-2.5">
            <span className="w-10 h-10 rounded-xl gold-gradient flex items-center justify-center">
              <Icon className="w-5 h-5 text-[#0f1f3d]" strokeWidth={2.5} />
            </span>
            {pageTitle}
          </h1>
          <p className="text-sm text-muted-foreground mt-1.5">{pageDesc}</p>
        </div>
        <button
          onClick={() => openQuickAdd(kind)}
          className="gold-gradient text-[#0f1f3d] font-extrabold rounded-xl px-4 sm:px-5 py-2.5 sm:py-3 flex items-center gap-2 shadow-lg hover:brightness-110 active:scale-[0.98] transition-all text-sm"
        >
          <Plus className="w-4.5 h-4.5" strokeWidth={3} />
          {kind === 'offer' ? 'إضافة عرض' : 'إضافة طلب'}
        </button>
      </header>

      {/* status tabs */}
      <div className="flex gap-1.5 overflow-x-auto scrollbar-thin pb-1 -mx-1 px-1">
        {(['all', ...statuses] as const).map((s) => (
          <button
            key={s}
            onClick={() => setActiveTab(s)}
            className={cn(
              'shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-extrabold transition-all',
              activeTab === s
                ? 'gold-gradient text-[#0f1f3d] border-transparent shadow-lg'
                : 'bg-card border-border text-slate-300 hover:border-[#c9972f]/40',
            )}
          >
            {s === 'all' ? 'الكل' : statusLabel(kind, s)}
            <span
              className={cn(
                'min-w-6 h-6 px-1.5 rounded-full text-xs font-extrabold flex items-center justify-center',
                activeTab === s ? 'bg-[#0f1f3d]/20 text-[#0f1f3d]' : 'bg-secondary text-slate-300',
              )}
            >
              {counts[s] ?? 0}
            </span>
          </button>
        ))}
      </div>

      {/* search */}
      <div className="grid grid-cols-[1fr_auto] gap-2">
        <div className="relative">
        <Search className="absolute start-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(event) => { if (event.key === 'Enter') void runAiSearch(); }}
          placeholder="بحث ذكي: أرض في العارض مساحتها بين 400 - 500 متر"
          className="w-full bg-card border border-border rounded-2xl ps-11 pe-4 py-3 text-sm text-white outline-none focus:border-[#c9972f]/60 placeholder:text-muted-foreground/70"
        />
        </div>
        <button disabled={aiBusy || !query.trim()} onClick={() => void runAiSearch()} className="gold-gradient text-[#0f1f3d] rounded-xl px-4 text-xs font-extrabold flex items-center gap-1.5 disabled:opacity-50">
          {aiBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          بحث ذكي
        </button>
      </div>
      {aiFilters && <button onClick={() => setAiFilters(null)} className="text-xs font-bold text-[#e5bc55]">إلغاء فلاتر AI والعودة للبحث العادي</button>}

      {/* grid */}
      {filtered.length > 0 ? (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3.5">
          {filtered.map((l) => (
            <ListingCard key={l.id} listing={l} onView={setViewingListing} />
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-border bg-card/50 p-10 text-center">
          <span className="text-4xl">{activeTab === 'archived' ? '🗄️' : kind === 'offer' ? '🏷️' : '📥'}</span>
          <p className="font-bold text-slate-200 mt-3">
            {query ? 'لا نتائج مطابقة للبحث' : `لا توجد عناصر في «${activeTab === 'all' ? 'الكل' : statusLabel(kind, activeTab)}»`}
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            {activeTab === 'archived' ? 'الإعلانات المنتهية تظهر هنا مع سبب الأرشفة' : 'ابدأ بإضافة إعلان جديد بالزر أعلاه'}
          </p>
        </div>
      )}
    </div>
  );
}
