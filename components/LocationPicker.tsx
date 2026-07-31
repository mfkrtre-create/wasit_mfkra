"use client";

import { useEffect, useRef, useState } from "react";
import { riyadhCenter } from "@/lib/map-records";

type MapLibreModule = typeof import("maplibre-gl");
type MapInstance = import("maplibre-gl").Map;
type MarkerInstance = import("maplibre-gl").Marker;

const openFreeMapStyleUrl = "https://tiles.openfreemap.org/styles/liberty";

export function LocationPicker({
  latitudeName = "latitude",
  longitudeName = "longitude",
  initialLatitude = null,
  initialLongitude = null,
}: {
  latitudeName?: string;
  longitudeName?: string;
  initialLatitude?: number | null;
  initialLongitude?: number | null;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapInstance | null>(null);
  const markerRef = useRef<MarkerInstance | null>(null);
  const moduleRef = useRef<MapLibreModule | null>(null);
  const [latitude, setLatitude] = useState<number | null>(initialLatitude);
  const [longitude, setLongitude] = useState<number | null>(initialLongitude);
  const [error, setError] = useState<string | null>(null);

  function setLocation(nextLongitude: number, nextLatitude: number) {
    setLongitude(Number(nextLongitude.toFixed(6)));
    setLatitude(Number(nextLatitude.toFixed(6)));

    const maplibregl = moduleRef.current;
    const map = mapRef.current;
    if (!maplibregl || !map) {
      return;
    }

    if (!markerRef.current) {
      markerRef.current = new maplibregl.Marker({ draggable: true, color: "#0f766e" })
        .setLngLat([nextLongitude, nextLatitude])
        .addTo(map);
      markerRef.current.on("dragend", () => {
        const position = markerRef.current?.getLngLat();
        if (position) {
          setLongitude(Number(position.lng.toFixed(6)));
          setLatitude(Number(position.lat.toFixed(6)));
        }
      });
    } else {
      markerRef.current.setLngLat([nextLongitude, nextLatitude]);
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function setupPicker() {
      if (!containerRef.current) {
        return;
      }

      const maplibregl = await import("maplibre-gl");
      if (cancelled || !containerRef.current) {
        return;
      }

      moduleRef.current = maplibregl;
      const map = new maplibregl.Map({
        container: containerRef.current,
        style: openFreeMapStyleUrl,
        center: [initialLongitude ?? riyadhCenter.longitude, initialLatitude ?? riyadhCenter.latitude],
        zoom: initialLatitude && initialLongitude ? 13 : 10,
        attributionControl: { compact: true },
      });
      mapRef.current = map;
      map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "top-left");

      map.on("load", () => {
        if (initialLatitude !== null && initialLongitude !== null) {
          setLocation(initialLongitude, initialLatitude);
        }
      });
      map.on("click", (event) => {
        setLocation(event.lngLat.lng, event.lngLat.lat);
      });
    }

    void setupPicker();

    return () => {
      cancelled = true;
      markerRef.current?.remove();
      markerRef.current = null;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [initialLatitude, initialLongitude]);

  function useCurrentLocation() {
    setError(null);
    if (!navigator.geolocation) {
      setError("المتصفح لا يدعم تحديد الموقع.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation(position.coords.longitude, position.coords.latitude);
        mapRef.current?.flyTo({ center: [position.coords.longitude, position.coords.latitude], zoom: 14 });
      },
      () => setError("تعذر الحصول على الموقع. تأكد من منح الإذن."),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  function clearLocation() {
    setLatitude(null);
    setLongitude(null);
    markerRef.current?.remove();
    markerRef.current = null;
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 md:col-span-3">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-black text-slate-950">موقع العقار</p>
          <p className="mt-1 text-xs text-slate-500">اضغط على الخريطة، اسحب المؤشر، أو أدخل الإحداثيات يدوياً.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={useCurrentLocation} className="secondary-button">
            استخدام موقعي
          </button>
          <button type="button" onClick={clearLocation} className="danger-button">
            مسح الموقع
          </button>
        </div>
      </div>
      <div ref={containerRef} className="h-72 overflow-hidden rounded-md border border-slate-200 bg-white" />
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="text-sm font-bold text-slate-700">
          خط العرض
          <input
            name={latitudeName}
            type="number"
            step="0.000001"
            value={latitude ?? ""}
            onChange={(event) => {
              const next = event.target.value === "" ? null : Number(event.target.value);
              setLatitude(next);
              if (next !== null && longitude !== null) {
                setLocation(longitude, next);
              }
            }}
            className="mt-2 h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
          />
        </label>
        <label className="text-sm font-bold text-slate-700">
          خط الطول
          <input
            name={longitudeName}
            type="number"
            step="0.000001"
            value={longitude ?? ""}
            onChange={(event) => {
              const next = event.target.value === "" ? null : Number(event.target.value);
              setLongitude(next);
              if (latitude !== null && next !== null) {
                setLocation(next, latitude);
              }
            }}
            className="mt-2 h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
          />
        </label>
      </div>
      {error ? <p className="mt-3 rounded-md border border-rose-200 bg-rose-50 p-3 text-sm font-bold text-rose-800">{error}</p> : null}
    </div>
  );
}
