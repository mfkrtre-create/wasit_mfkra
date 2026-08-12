import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, ChevronDown, ChevronUp, Layers } from 'lucide-react';
import type { Listing } from '@/ui/types';
import { PROPERTY_TYPE_LABELS, statusLabel } from '@/ui/types';
import { useDB } from '@/ui/lib/db';
import { useApp } from '@/ui/context/AppContext';
import { fmtMoney } from '@/ui/lib/format';
import { configureMapLibre } from '@/lib/maplibre-config';
import { rasterMapStyle } from '@/lib/map-style';
import { cn } from '@/ui/lib/utils';

const TYPE_EMOJI: Record<string, string> = { land: '🗺️', villa: '🏡', apartment: '🏢', building: '🏬', block: '🧱', warehouse: '🏭', rest_house: '🏝️', office: '🏢', shop: '🏪', farm: '🌴', tower: '🏙️', other: '📍' };
type Filter = 'all' | 'offer' | 'request';

function pinColor(listing: Listing) {
  if (listing.status === 'closed' || listing.status === 'fulfilled') return '#94a3b8';
  return listing.kind === 'offer' ? '#22c55e' : '#3b82f6';
}

function markerElement(listing: Listing) {
  const element = document.createElement('button');
  element.type = 'button';
  element.className = 'wasit-map-marker';
  element.style.backgroundColor = pinColor(listing);
  element.textContent = TYPE_EMOJI[listing.propertyType] ?? '📍';
  element.setAttribute('aria-label', listing.title);
  return element;
}

export function MapPage() {
  const { listings } = useDB();
  const { setViewingListing } = useApp();
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import('maplibre-gl').Map | null>(null);
  const markersRef = useRef<import('maplibre-gl').Marker[]>([]);
  const [filter, setFilter] = useState<Filter>('all');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState('');

  const visible = useMemo(() => listings.filter((listing) => !listing.deletedAt && listing.lat !== undefined && listing.lng !== undefined && listing.status !== 'archived' && (filter === 'all' || listing.kind === filter)), [filter, listings]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!containerRef.current || mapRef.current) return;
      const maplibregl = await import('maplibre-gl');
      await configureMapLibre(maplibregl);
      if (cancelled || !containerRef.current) return;
      const map = new maplibregl.Map({ container: containerRef.current, style: rasterMapStyle, center: [46.6753, 24.7136], zoom: 10.5, attributionControl: { compact: true } });
      map.addControl(new maplibregl.NavigationControl(), 'bottom-left');
      if (window.isSecureContext && navigator.geolocation) {
        map.addControl(new maplibregl.GeolocateControl({ positionOptions: { enableHighAccuracy: true } }), 'bottom-left');
      }
      mapRef.current = map;
      map.on('load', () => {
        map.resize();
        setMapReady(true);
      });
      map.on('error', () => setMapError('تعذر تحميل الخريطة. تحقق من الاتصال أو مزود الخرائط.'));
    })();
    return () => { cancelled = true; markersRef.current.forEach((marker) => marker.remove()); markersRef.current = []; mapRef.current?.remove(); mapRef.current = null; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const map = mapRef.current;
      if (!mapReady || !map) return;
      const maplibregl = await import('maplibre-gl');
      if (cancelled || !mapRef.current) return;
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = visible.map((listing) => {
        const element = markerElement(listing);
        element.addEventListener('click', () => setSelectedId(listing.id));
        const popupNode = document.createElement('div');
        popupNode.className = 'wasit-map-popup';
        const title = document.createElement('strong'); title.textContent = listing.title; popupNode.appendChild(title);
        const detail = document.createElement('p'); detail.textContent = `${PROPERTY_TYPE_LABELS[listing.propertyType]} • ${statusLabel(listing.kind, listing.status)} • ${fmtMoney(listing.priceAsk ?? listing.priceBid)}`; popupNode.appendChild(detail);
        const actions = document.createElement('div');
        const detailsButton = document.createElement('button'); detailsButton.type = 'button'; detailsButton.textContent = 'فتح التفاصيل'; detailsButton.onclick = () => setViewingListing(listing); actions.appendChild(detailsButton);
        const mapsLink = document.createElement('a'); mapsLink.textContent = 'التوجيه عبر Google Maps'; mapsLink.href = `https://www.google.com/maps/dir/?api=1&destination=${listing.lat},${listing.lng}`; mapsLink.target = '_blank'; mapsLink.rel = 'noreferrer'; actions.appendChild(mapsLink); popupNode.appendChild(actions);
        const popup = new maplibregl.Popup({ offset: 24, closeButton: true }).setDOMContent(popupNode);
        return new maplibregl.Marker({ element, anchor: 'bottom' }).setLngLat([listing.lng!, listing.lat!]).setPopup(popup).addTo(mapRef.current!);
      });
      if (visible.length > 1) {
        const bounds = new maplibregl.LngLatBounds(); visible.forEach((listing) => bounds.extend([listing.lng!, listing.lat!])); mapRef.current.fitBounds(bounds, { padding: 70, maxZoom: 14 });
      } else if (visible.length === 1) mapRef.current.flyTo({ center: [visible[0].lng!, visible[0].lat!], zoom: 14 });
    })();
    return () => { cancelled = true; };
  }, [mapReady, setViewingListing, visible]);

  const flyTo = (listing: Listing) => { if (listing.lat === undefined || listing.lng === undefined) return; mapRef.current?.flyTo({ center: [listing.lng, listing.lat], zoom: 15 }); setSelectedId(listing.id); markersRef.current[visible.findIndex((item) => item.id === listing.id)]?.togglePopup(); };
  const filterBar = <div className="flex items-center gap-1.5"><Layers className="w-4 h-4 text-[#e5bc55]" />{([['all', 'الكل'], ['offer', 'العروض'], ['request', 'الطلبات']] as [Filter, string][]).map(([value, label]) => <button key={value} onClick={() => setFilter(value)} className={cn('text-xs font-extrabold px-3 py-1.5 rounded-full border', filter === value ? 'gold-gradient text-[#0f1f3d] border-transparent' : 'bg-secondary/70 border-border text-slate-300')}>{label}</button>)}</div>;
  const legend = <div className="flex flex-wrap gap-3 text-[10px] text-muted-foreground"><Legend color="#22c55e" label="عرض نشط" /><Legend color="#3b82f6" label="طلب نشط" /><Legend color="#94a3b8" label="مغلق / مباع / مؤجر" /></div>;
  const list = <div className="divide-y divide-border/60">{visible.map((listing) => <button key={listing.id} onClick={() => flyTo(listing)} onDoubleClick={() => setViewingListing(listing)} className={cn('w-full text-start px-4 py-3 hover:bg-secondary/50 flex items-center gap-3', selectedId === listing.id && 'bg-[#c9972f]/10')}><span className="w-3 h-3 rounded-full" style={{ backgroundColor: pinColor(listing) }} /><span className="flex-1 min-w-0"><span className="block text-sm font-bold text-white truncate">{listing.title}</span><span className="block text-[11px] text-muted-foreground">{listing.city} {listing.district && `— ${listing.district}`} • {statusLabel(listing.kind, listing.status)}</span></span><span className="text-xs font-extrabold text-[#e5bc55] nums-latin">{fmtMoney(listing.priceAsk ?? listing.priceBid)}</span></button>)}{visible.length === 0 && <p className="text-sm text-muted-foreground text-center py-10">لا توجد سجلات بمواقع محددة.</p>}</div>;

  return (
    <div className="h-screen flex flex-col md:flex-row">
      <div className="hidden md:flex flex-col w-1/2 border-l border-border bg-[#0c1a36]"><div className="p-4 border-b border-border space-y-3"><h1 className="text-xl font-extrabold text-white">خريطة الإعلانات</h1>{filterBar}{legend}</div><div className="flex-1 overflow-y-auto scrollbar-thin">{list}</div><div className="p-3 border-t border-border text-[11px] text-muted-foreground text-center">{visible.length} سجلاً على OpenFreeMap</div></div>
      <div className="relative flex-1 h-full"><div ref={containerRef} className="absolute inset-0" />{!mapReady && !mapError && <div className="absolute inset-0 grid place-items-center bg-[#0a1730]/85 text-sm font-extrabold text-slate-200">جاري تحميل الخريطة...</div>}{mapError && <div className="absolute inset-0 grid place-items-center bg-[#0a1730]/90 px-4 text-center text-sm font-bold text-red-200"><span className="inline-flex items-center gap-2"><AlertCircle className="w-5 h-5" />{mapError}</span></div>}<div className="md:hidden absolute top-3 inset-x-3 z-10 rounded-2xl bg-[#0c1a36]/95 border border-border p-2.5 space-y-2">{filterBar}{legend}</div><div className={cn('md:hidden absolute inset-x-0 bottom-0 z-10 bg-[#0c1a36] border-t border-[#c9972f]/30 rounded-t-2xl flex flex-col transition-all', sheetOpen ? 'h-[62%]' : 'h-14')}><button onClick={() => setSheetOpen((value) => !value)} className="h-14 flex items-center justify-center gap-2 font-extrabold text-sm text-white">{sheetOpen ? <ChevronDown className="w-5 h-5 text-[#e5bc55]" /> : <ChevronUp className="w-5 h-5 text-[#e5bc55]" />}قائمة الإعلانات ({visible.length})</button>{sheetOpen && <div className="flex-1 overflow-y-auto">{list}</div>}</div></div>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) { return <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />{label}</span>; }
