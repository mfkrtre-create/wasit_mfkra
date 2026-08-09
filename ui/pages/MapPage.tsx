import { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import { ChevronUp, ChevronDown, Layers } from 'lucide-react';
import type { Listing } from '@/ui/types';
import { PROPERTY_TYPE_LABELS, statusLabel } from '@/ui/types';
import { useDB } from '@/ui/lib/db';
import { useApp } from '@/ui/context/AppContext';
import { fmtMoney } from '@/ui/lib/format';
import { cn } from '@/ui/lib/utils';

const PIN_COLORS: Record<string, string> = {
  'offer:for_sale': '#c9972f',
  'offer:for_rent': '#38bdf8',
  'offer:closed': '#34d399',
  'request:buy': '#a78bfa',
  'request:rent': '#22d3ee',
  'request:fulfilled': '#34d399',
};

const LEGEND = [
  { label: 'عرض للبيع', color: '#c9972f' },
  { label: 'عرض للإيجار', color: '#38bdf8' },
  { label: 'طلب شراء', color: '#a78bfa' },
  { label: 'طلب استئجار', color: '#22d3ee' },
  { label: 'صفقة منجزة', color: '#34d399' },
];

const TYPE_EMOJI: Record<string, string> = {
  land: '🗺️',
  villa: '🏡',
  apartment: '🏢',
  building: '🏬',
  farm: '🌴',
  tower: '🏙️',
  other: '🏪',
};

type Filter = 'all' | 'offer' | 'request';

function pinIcon(color: string, emoji: string) {
  return L.divIcon({
    className: '',
    html: `<div class="map-pin" style="background:${color}"><span>${emoji}</span></div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 28],
    popupAnchor: [0, -26],
  });
}

export function MapPage() {
  const { listings } = useDB();
  const { setViewingListing } = useApp();
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.LayerGroup | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const visible = useMemo(
    () =>
      listings.filter(
        (l) =>
          l.lat !== undefined &&
          l.lng !== undefined &&
          l.status !== 'archived' &&
          (filter === 'all' || l.kind === filter),
      ),
    [listings, filter],
  );

  // init map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, {
      center: [24.75, 46.68],
      zoom: 11,
      zoomControl: false,
      attributionControl: false,
    });
    L.control.zoom({ position: 'bottomleft' }).addTo(map);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      subdomains: 'abcd',
      maxZoom: 19,
    }).addTo(map);
    markersRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    // ensure proper size after mount (split-screen container)
    setTimeout(() => map.invalidateSize(), 250);
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // sync markers
  useEffect(() => {
    const group = markersRef.current;
    const map = mapRef.current;
    if (!group || !map) return;
    group.clearLayers();
    visible.forEach((l) => {
      const color = PIN_COLORS[`${l.kind}:${l.status}`] ?? '#94a3b8';
      const marker = L.marker([l.lat!, l.lng!], { icon: pinIcon(color, TYPE_EMOJI[l.propertyType] ?? '📍') });
      const price = l.priceMode === 'bid' && l.priceBid ? l.priceBid : l.priceAsk;
      marker.bindPopup(
        `<div style="min-width:190px">
          <div style="font-weight:800;font-size:13px;margin-bottom:4px">${l.title}</div>
          <div style="font-size:11px;color:#c9d4ea;margin-bottom:6px">${PROPERTY_TYPE_LABELS[l.propertyType]} • ${statusLabel(l.kind, l.status)}</div>
          ${price ? `<div style="font-weight:800;color:#e5bc55;font-size:13px">${price.toLocaleString('en-US')} ر.س</div>` : ''}
        </div>`,
      );
      marker.on('click', () => setSelectedId(l.id));
      marker.addTo(group);
    });
  }, [visible]);

  const flyTo = (l: Listing) => {
    if (!l.lat || !l.lng) return;
    mapRef.current?.flyTo([l.lat, l.lng], 14, { duration: 0.7 });
    setSelectedId(l.id);
  };

  const listContent = (
    <div className="divide-y divide-border/60">
      {visible.map((l) => {
        const color = PIN_COLORS[`${l.kind}:${l.status}`] ?? '#94a3b8';
        const price = l.priceMode === 'bid' && l.priceBid ? l.priceBid : l.priceAsk;
        return (
          <button
            key={l.id}
            onClick={() => flyTo(l)}
            onDoubleClick={() => setViewingListing(l)}
            className={cn(
              'w-full text-start px-4 py-3 hover:bg-secondary/50 transition-colors flex items-center gap-3',
              selectedId === l.id && 'bg-[#c9972f]/10',
            )}
          >
            <span className="w-3 h-3 rounded-full shrink-0 border border-white/40" style={{ background: color }} />
            <span className="flex-1 min-w-0">
              <span className="block text-sm font-bold text-white truncate">{l.title}</span>
              <span className="block text-[11px] text-muted-foreground mt-0.5">
                {l.city} {l.district && `— ${l.district}`} • {statusLabel(l.kind, l.status)}
              </span>
            </span>
            {price && <span className="text-xs font-extrabold text-[#e5bc55] nums-latin shrink-0">{fmtMoney(price)}</span>}
          </button>
        );
      })}
      {visible.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-10">لا توجد إعلانات بمواقع محددة لهذا الفلتر</p>
      )}
    </div>
  );

  const filterBar = (
    <div className="flex items-center gap-1.5">
      <Layers className="w-4 h-4 text-[#e5bc55] shrink-0" />
      {(
        [
          ['all', 'الكل'],
          ['offer', 'العروض'],
          ['request', 'الطلبات'],
        ] as [Filter, string][]
      ).map(([v, label]) => (
        <button
          key={v}
          onClick={() => setFilter(v)}
          className={cn(
            'text-xs font-extrabold px-3 py-1.5 rounded-full border transition-colors',
            filter === v
              ? 'gold-gradient text-[#0f1f3d] border-transparent'
              : 'bg-secondary/70 border-border text-slate-300 hover:border-[#c9972f]/40',
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );

  return (
    <div className="h-screen md:h-screen flex flex-col md:flex-row">
      {/* ===== List panel: right side on desktop (RTL first), bottom sheet on mobile ===== */}
      <div className="hidden md:flex flex-col w-1/2 border-l border-border bg-[#0c1a36]">
        <div className="p-4 border-b border-border space-y-3">
          <h1 className="text-xl font-extrabold text-white">🗺️ خريطة الإعلانات</h1>
          {filterBar}
          <div className="flex flex-wrap gap-x-4 gap-y-1.5 pt-1">
            {LEGEND.map((g) => (
              <span key={g.label} className="flex items-center gap-1.5 text-[11px] text-muted-foreground font-semibold">
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: g.color }} />
                {g.label}
              </span>
            ))}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto scrollbar-thin">{listContent}</div>
        <div className="p-3 border-t border-border text-[11px] text-muted-foreground text-center">
          {visible.length} إعلان على الخريطة — نقرة للانتقال، نقرة مزدوجة للتفاصيل
        </div>
      </div>

      {/* ===== Map ===== */}
      <div className="relative flex-1 h-full">
        <div ref={containerRef} className="absolute inset-0 z-0" />

        {/* mobile: top filter bar */}
        <div className="md:hidden absolute top-3 inset-x-3 z-[500] rounded-2xl bg-[#0c1a36]/90 backdrop-blur border border-border p-2.5 space-y-2">
          {filterBar}
          <div className="flex flex-wrap gap-x-3 gap-y-1">
            {LEGEND.map((g) => (
              <span key={g.label} className="flex items-center gap-1 text-[10px] text-muted-foreground font-semibold">
                <span className="w-2 h-2 rounded-full" style={{ background: g.color }} />
                {g.label}
              </span>
            ))}
          </div>
        </div>

        {/* mobile: bottom sheet */}
        <div
          className={cn(
            'md:hidden absolute inset-x-0 bottom-0 z-[500] bg-[#0c1a36] border-t border-[#c9972f]/30 rounded-t-3xl shadow-2xl transition-all duration-300 flex flex-col',
            sheetOpen ? 'h-[62%]' : 'h-14',
          )}
        >
          <button
            onClick={() => setSheetOpen((v) => !v)}
            className="h-14 shrink-0 flex items-center justify-center gap-2 font-extrabold text-sm text-white"
          >
            {sheetOpen ? <ChevronDown className="w-5 h-5 text-[#e5bc55]" /> : <ChevronUp className="w-5 h-5 text-[#e5bc55]" />}
            قائمة الإعلانات ({visible.length})
          </button>
          {sheetOpen && <div className="flex-1 overflow-y-auto scrollbar-thin">{listContent}</div>}
        </div>
      </div>
    </div>
  );
}
