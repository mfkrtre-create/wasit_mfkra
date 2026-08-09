import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { Crosshair, Search, Loader2 } from 'lucide-react';

export interface LatLng {
  lat: number;
  lng: number;
}

const RIYADH: LatLng = { lat: 24.7136, lng: 46.6753 };

function makePinIcon(color: string) {
  return L.divIcon({
    className: '',
    html: `<div class="map-pin" style="background:${color}"><span>📍</span></div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 28],
  });
}

export function MapPicker({
  value,
  onChange,
  onDistrictFound,
  height = 260,
}: {
  value: LatLng | null;
  onChange: (v: LatLng) => void;
  onDistrictFound?: (district: string) => void;
  height?: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [hint, setHint] = useState('انقر على الخريطة لتثبيت الدبوس 📍');

  async function reverseGeocode(ll: LatLng) {
    if (!onDistrictFound) return;
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${ll.lat}&lon=${ll.lng}&accept-language=ar&zoom=16`,
      );
      const data = await res.json();
      const district =
        data?.address?.neighbourhood || data?.address?.suburb || data?.address?.quarter || data?.address?.city_district;
      if (district) onDistrictFound(String(district).replace(/^حي\s+/, ''));
    } catch {
      /* offline — ignore */
    }
  }

  // init map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, {
      center: [value?.lat ?? RIYADH.lat, value?.lng ?? RIYADH.lng],
      zoom: value ? 15 : 11,
      zoomControl: true,
      attributionControl: false,
    });
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      subdomains: 'abcd',
      maxZoom: 19,
    }).addTo(map);

    map.on('click', (e: L.LeafletMouseEvent) => {
      const ll = { lat: e.latlng.lat, lng: e.latlng.lng };
      onChange(ll);
      setHint('تم تثبيت الدبوس ✅ يمكنك النقر مجدداً للتعديل');
      reverseGeocode(ll);
    });
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // keep marker synced with value
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (value) {
      if (!markerRef.current) {
        markerRef.current = L.marker([value.lat, value.lng], { icon: makePinIcon('#c9972f') }).addTo(map);
      } else {
        markerRef.current.setLatLng([value.lat, value.lng]);
      }
    } else if (markerRef.current) {
      markerRef.current.remove();
      markerRef.current = null;
    }
  }, [value]);

  const search = async () => {
    if (!query.trim()) return;
    setSearching(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&countrycodes=sa&accept-language=ar&limit=1&q=${encodeURIComponent(query)}`,
      );
      const data = await res.json();
      if (data?.[0]) {
        const ll = { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
        mapRef.current?.flyTo([ll.lat, ll.lng], 15, { duration: 0.8 });
        onChange(ll);
        setHint(`تم الانتقال إلى: ${data[0].display_name?.split('،')[0] ?? query} ✅`);
        if (onDistrictFound && query.trim().length < 30) onDistrictFound(query.trim().replace(/^حي\s+/, ''));
      } else {
        setHint('لم يتم العثور على الحي — جرّب اسماً آخر');
      }
    } catch {
      setHint('تعذر البحث — تحقق من الاتصال');
    } finally {
      setSearching(false);
    }
  };

  const locateMe = () => {
    if (!navigator.geolocation) {
      setHint('المتصفح لا يدعم تحديد الموقع');
      return;
    }
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const ll = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        mapRef.current?.flyTo([ll.lat, ll.lng], 16, { duration: 0.8 });
        onChange(ll);
        setHint('تم تحديد موقعك الحالي ✅');
        reverseGeocode(ll);
        setGpsLoading(false);
      },
      () => {
        setHint('تعذر الوصول للموقع — فعّل صلاحية الموقع');
        setGpsLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && search()}
            placeholder="ابحث عن حي… مثال: حي الياسمين الرياض"
            className="w-full bg-secondary/50 border border-border rounded-xl px-3 py-2.5 pe-9 text-sm text-white placeholder:text-muted-foreground outline-none focus:border-[#c9972f]/60"
          />
          <button
            onClick={search}
            disabled={searching}
            className="absolute end-2 top-1/2 -translate-y-1/2 text-[#e5bc55] disabled:opacity-50"
          >
            {searching ? <Loader2 className="w-4.5 h-4.5 animate-spin" /> : <Search className="w-4.5 h-4.5" />}
          </button>
        </div>
        <button
          onClick={locateMe}
          disabled={gpsLoading}
          className="shrink-0 flex items-center gap-1.5 rounded-xl bg-[#c9972f]/15 border border-[#c9972f]/40 text-[#e5bc55] text-xs font-extrabold px-3 hover:bg-[#c9972f]/25 transition-colors disabled:opacity-60"
        >
          {gpsLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Crosshair className="w-4 h-4" />}
          GPS — أنا هنا
        </button>
      </div>

      <div
        ref={containerRef}
        style={{ height }}
        className="rounded-xl overflow-hidden border border-border relative z-0"
      />
      <p className="text-[11px] text-muted-foreground">{hint}</p>
    </div>
  );
}
