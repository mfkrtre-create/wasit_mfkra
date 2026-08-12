import { useEffect, useRef, useState } from 'react';
import { Crosshair, Loader2, Search } from 'lucide-react';
import { configureMapLibre } from '@/lib/maplibre-config';
import { rasterMapStyle } from '@/lib/map-style';

export interface LatLng { lat: number; lng: number }

const RIYADH: LatLng = { lat: 24.7136, lng: 46.6753 };

export function MapPicker({ value, onChange, onDistrictFound, height = 260 }: { value: LatLng | null; onChange: (value: LatLng) => void; onDistrictFound?: (district: string) => void; height?: number }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import('maplibre-gl').Map | null>(null);
  const markerRef = useRef<import('maplibre-gl').Marker | null>(null);
  const onChangeRef = useRef(onChange);
  const onDistrictFoundRef = useRef(onDistrictFound);
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [hint, setHint] = useState('انقر على الخريطة لتثبيت الدبوس');
  const selectedLat = value?.lat;
  const selectedLng = value?.lng;

  useEffect(() => { onChangeRef.current = onChange; onDistrictFoundRef.current = onDistrictFound; }, [onChange, onDistrictFound]);

  async function reverseGeocode(point: LatLng) {
    if (!onDistrictFoundRef.current) return;
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${point.lat}&lon=${point.lng}&accept-language=ar&zoom=16`);
      const data = await response.json();
      const district = data?.address?.neighbourhood || data?.address?.suburb || data?.address?.quarter || data?.address?.city_district;
      if (district) onDistrictFoundRef.current(String(district).replace(/^حي\s+/, ''));
    } catch { /* Location remains usable without reverse geocoding. */ }
  }

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!containerRef.current || mapRef.current) return;
      const maplibregl = await import('maplibre-gl');
      await configureMapLibre(maplibregl);
      if (cancelled || !containerRef.current) return;
      const map = new maplibregl.Map({ container: containerRef.current, style: rasterMapStyle, center: [value?.lng ?? RIYADH.lng, value?.lat ?? RIYADH.lat], zoom: value ? 15 : 11, attributionControl: { compact: true } });
      map.addControl(new maplibregl.NavigationControl(), 'bottom-left');
      map.on('click', (event) => {
        const point = { lat: event.lngLat.lat, lng: event.lngLat.lng };
        onChangeRef.current(point);
        setHint('تم تثبيت الدبوس. يمكنك النقر مجدداً للتعديل');
        void reverseGeocode(point);
      });
      mapRef.current = map;
      setMapReady(true);
      window.setTimeout(() => map.resize(), 0);
      map.once('load', () => {
        map.resize();
      });
      map.once('idle', () => map.resize());
    })();
    return () => { cancelled = true; markerRef.current?.remove(); markerRef.current = null; mapRef.current?.remove(); mapRef.current = null; };
    // Initialization must run only once; current callbacks are held in refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const map = mapRef.current;
      if (!mapReady || !map || selectedLat === undefined || selectedLng === undefined) { markerRef.current?.remove(); markerRef.current = null; return; }
      if (!markerRef.current) {
        const maplibregl = await import('maplibre-gl');
        if (cancelled || !mapRef.current) return;
        markerRef.current = new maplibregl.Marker({ color: '#c9972f' }).setLngLat([selectedLng, selectedLat]).addTo(mapRef.current);
      } else markerRef.current.setLngLat([selectedLng, selectedLat]);
      map.flyTo({ center: [selectedLng, selectedLat], zoom: 15, essential: true });
      setHint('تم تحديد الموقع على الخريطة. يمكنك النقر للتعديل');
    })();
    return () => { cancelled = true; };
  }, [mapReady, selectedLat, selectedLng]);

  const search = async () => {
    if (!query.trim()) return;
    setSearching(true);
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&countrycodes=sa&accept-language=ar&limit=1&q=${encodeURIComponent(query)}`);
      const data = await response.json();
      if (!data?.[0]) { setHint('لم يتم العثور على الحي.'); return; }
      const point = { lat: Number(data[0].lat), lng: Number(data[0].lon) };
      mapRef.current?.flyTo({ center: [point.lng, point.lat], zoom: 15 });
      onChange(point);
      onDistrictFound?.(query.trim().replace(/^حي\s+/, ''));
      setHint(`تم الانتقال إلى ${data[0].display_name?.split('،')[0] ?? query}`);
    } catch { setHint('تعذر البحث. تحقق من الاتصال.'); }
    finally { setSearching(false); }
  };

  const locateMe = () => {
    if (!navigator.geolocation) { setHint('المتصفح لا يدعم تحديد الموقع.'); return; }
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition((position) => {
      const point = { lat: position.coords.latitude, lng: position.coords.longitude };
      mapRef.current?.flyTo({ center: [point.lng, point.lat], zoom: 16 });
      onChange(point); void reverseGeocode(point); setHint('تم تحديد موقعك الحالي'); setGpsLoading(false);
    }, () => { setHint('تعذر الوصول للموقع. فعّل صلاحية الموقع.'); setGpsLoading(false); }, { enableHighAccuracy: true, timeout: 10000 });
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <div className="relative flex-1"><input value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); void search(); } }} placeholder="ابحث عن حي… مثال: حي الياسمين الرياض" className="w-full bg-secondary/50 border border-border rounded-xl px-3 py-2.5 pe-9 text-sm text-white outline-none focus:border-[#c9972f]/60" /><button type="button" onClick={() => void search()} disabled={searching} className="absolute end-2 top-1/2 -translate-y-1/2 text-[#e5bc55]">{searching ? <Loader2 className="w-4.5 h-4.5 animate-spin" /> : <Search className="w-4.5 h-4.5" />}</button></div>
        <button type="button" onClick={locateMe} disabled={gpsLoading} className="shrink-0 flex items-center gap-1.5 rounded-xl bg-[#c9972f]/15 border border-[#c9972f]/40 text-[#e5bc55] text-xs font-extrabold px-3">{gpsLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Crosshair className="w-4 h-4" />}GPS — أنا هنا</button>
      </div>
      <div ref={containerRef} style={{ height }} className="rounded-xl overflow-hidden border border-border relative z-0" />
      <p className="text-[11px] text-muted-foreground">{hint}</p>
    </div>
  );
}
