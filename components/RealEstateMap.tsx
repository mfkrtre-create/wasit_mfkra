"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { buildGoogleMapsUrl, riyadhCenter, toMapFeatureCollection, type MapFeatureProperties, type MapRecord } from "@/lib/map-records";

const sourceId = "property-records";
const clusterLayerId = "clusters";
const clusterCountLayerId = "cluster-count";
const pointLayerId = "unclustered-point";
const selectedLayerId = "selected-point";
const openFreeMapStyleUrl = "https://tiles.openfreemap.org/styles/liberty";

type MapLibreModule = typeof import("maplibre-gl");
type MapInstance = import("maplibre-gl").Map;
type GeoJSONSource = import("maplibre-gl").GeoJSONSource;
type MapMouseEvent = import("maplibre-gl").MapMouseEvent;
type MapLayerMouseEvent = import("maplibre-gl").MapLayerMouseEvent;
type MapGeoJSONFeature = import("maplibre-gl").MapGeoJSONFeature;

function formatMoney(value: number | null) {
  if (value === null || !Number.isFinite(value)) {
    return "غير محدد";
  }

  return new Intl.NumberFormat("ar-SA", {
    style: "currency",
    currency: "SAR",
    maximumFractionDigits: 0,
  }).format(value);
}

function getFeatureProperties(feature: MapGeoJSONFeature) {
  return feature.properties as MapFeatureProperties;
}

function buildPopupElement(properties: MapFeatureProperties) {
  const container = document.createElement("div");
  container.className = "map-popup";

  if (properties.thumbnailUrl) {
    const image = document.createElement("img");
    image.src = properties.thumbnailUrl;
    image.alt = properties.propertyType;
    image.className = "map-popup__image";
    container.appendChild(image);
  }

  const title = document.createElement("p");
  title.className = "map-popup__title";
  title.textContent = properties.propertyType;
  container.appendChild(title);

  const body = document.createElement("p");
  body.className = "map-popup__body";
  body.textContent = `${properties.city}، ${properties.district} | ${properties.status} | المساحة: ${
    properties.area ? `${properties.area} م²` : "غير محدد"
  } | القيمة: ${formatMoney(properties.price ?? properties.budget)}`;
  container.appendChild(body);

  const actions = document.createElement("div");
  actions.className = "map-popup__actions";

  const internalLink = document.createElement("a");
  internalLink.href = properties.detailsUrl;
  internalLink.textContent = "فتح التفاصيل";
  internalLink.className = "map-popup__button";
  actions.appendChild(internalLink);

  const navigationLink = document.createElement("a");
  navigationLink.href = properties.googleMapsUrl;
  navigationLink.target = "_blank";
  navigationLink.rel = "noreferrer";
  navigationLink.textContent = "فتح في Google Maps";
  navigationLink.className = "map-popup__button map-popup__button--light";
  actions.appendChild(navigationLink);

  container.appendChild(actions);
  return container;
}

export function RealEstateMap({
  records,
  selectedId,
  hoveredId,
  className = "",
  onSelect,
}: {
  records: MapRecord[];
  selectedId: string | null;
  hoveredId: string | null;
  className?: string;
  onSelect: (id: string) => void;
}) {
  const featureCollection = useMemo(() => toMapFeatureCollection(records), [records]);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapInstance | null>(null);
  const moduleRef = useRef<MapLibreModule | null>(null);
  const popupRef = useRef<import("maplibre-gl").Popup | null>(null);
  const latestFeatureCollectionRef = useRef(featureCollection);
  const latestOnSelectRef = useRef(onSelect);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    latestFeatureCollectionRef.current = featureCollection;
  }, [featureCollection]);

  useEffect(() => {
    latestOnSelectRef.current = onSelect;
  }, [onSelect]);

  useEffect(() => {
    let cancelled = false;
    let layersReady = false;
    let loadingTimeout: number | null = null;

    async function setupMap() {
      if (!containerRef.current) {
        return;
      }

      setMapLoaded(false);
      setMapError(null);

      const maplibregl = await import("maplibre-gl");
      if (cancelled || !containerRef.current) {
        return;
      }

      moduleRef.current = maplibregl;
      const map = new maplibregl.Map({
        container: containerRef.current,
        style: openFreeMapStyleUrl,
        center: [riyadhCenter.longitude, riyadhCenter.latitude],
        zoom: riyadhCenter.zoom,
        attributionControl: { compact: true },
      });

      mapRef.current = map;
      map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "top-left");
      if (maplibregl.FullscreenControl) {
        map.addControl(new maplibregl.FullscreenControl(), "top-left");
      }
      map.addControl(
        new maplibregl.GeolocateControl({
          positionOptions: { enableHighAccuracy: true },
          trackUserLocation: false,
        }),
        "top-left",
      );

      function failMap(message = "تعذر تحميل الخريطة أو البلاطات. تحقق من الاتصال ثم أعد المحاولة.") {
        if (cancelled) {
          return;
        }
        setMapLoaded(false);
        setMapError(message);
      }

      function finishMapSetup() {
        if (cancelled || layersReady || !map.isStyleLoaded()) {
          return;
        }

        try {
          layersReady = true;

          map.addSource(sourceId, {
            type: "geojson",
            data: latestFeatureCollectionRef.current,
            cluster: true,
            clusterMaxZoom: 14,
            clusterRadius: 48,
            promoteId: "id",
          });

          map.addLayer({
            id: clusterLayerId,
            type: "circle",
            source: sourceId,
            filter: ["has", "point_count"],
            paint: {
              "circle-color": "#0f766e",
              "circle-radius": ["step", ["get", "point_count"], 18, 5, 24, 15, 32],
              "circle-stroke-width": 3,
              "circle-stroke-color": "#ffffff",
            },
          });

          map.addLayer({
            id: clusterCountLayerId,
            type: "symbol",
            source: sourceId,
            filter: ["has", "point_count"],
            layout: {
              "text-field": ["get", "point_count_abbreviated"],
              "text-size": 13,
            },
            paint: { "text-color": "#ffffff" },
          });

          map.addLayer({
            id: pointLayerId,
            type: "circle",
            source: sourceId,
            filter: ["!", ["has", "point_count"]],
            paint: {
              "circle-color": ["get", "markerColor"],
              "circle-radius": 8,
              "circle-stroke-width": 3,
              "circle-stroke-color": "#ffffff",
            },
          });

          map.addLayer({
            id: selectedLayerId,
            type: "circle",
            source: sourceId,
            filter: ["all", ["!", ["has", "point_count"]], ["==", ["get", "id"], ""]],
            paint: {
              "circle-color": "rgba(20,184,166,0.18)",
              "circle-radius": 22,
              "circle-stroke-color": "#0f766e",
              "circle-stroke-width": 2,
            },
          });

          map.on("click", clusterLayerId, async (event: MapMouseEvent) => {
            const features = map.queryRenderedFeatures(event.point, { layers: [clusterLayerId] });
            const cluster = features[0];
            if (!cluster) {
              return;
            }

            const clusterId = cluster.properties?.cluster_id as number | undefined;
            const source = map.getSource(sourceId) as GeoJSONSource;
            if (clusterId === undefined) {
              return;
            }

            const zoom = await source.getClusterExpansionZoom(clusterId);
            const coordinates = cluster.geometry.type === "Point" ? cluster.geometry.coordinates : null;
            if (coordinates) {
              map.easeTo({ center: coordinates as [number, number], zoom });
            }
          });

          map.on("click", pointLayerId, (event: MapLayerMouseEvent) => {
            const feature = event.features?.[0];
            if (!feature || feature.geometry.type !== "Point") {
              return;
            }

            const properties = getFeatureProperties(feature);
            latestOnSelectRef.current(properties.id);
            popupRef.current?.remove();
            popupRef.current = new maplibregl.Popup({ closeButton: true, maxWidth: "320px" })
              .setLngLat(feature.geometry.coordinates as [number, number])
              .setDOMContent(buildPopupElement(properties))
              .addTo(map);
          });

          map.on("mouseenter", pointLayerId, () => {
            map.getCanvas().style.cursor = "pointer";
          });
          map.on("mouseleave", pointLayerId, () => {
            map.getCanvas().style.cursor = "";
          });
          map.on("mouseenter", clusterLayerId, () => {
            map.getCanvas().style.cursor = "pointer";
          });
          map.on("mouseleave", clusterLayerId, () => {
            map.getCanvas().style.cursor = "";
          });

          setMapError(null);
          setMapLoaded(true);
        } catch (error) {
          layersReady = false;
          failMap(error instanceof Error ? `تعذر تجهيز طبقات الخريطة: ${error.message}` : "تعذر تجهيز طبقات الخريطة.");
        }
      }

      map.on("error", (event) => {
        console.error("MapLibre error", event.error);
        setMapError("تعذر تحميل الخريطة أو البلاطات. تحقق من الاتصال ثم أعد المحاولة.");
      });

      map.on("load", finishMapSetup);
      map.on("styledata", finishMapSetup);
      loadingTimeout = window.setTimeout(() => {
        if (!layersReady) {
          finishMapSetup();
        }
        if (!layersReady) {
          failMap("طال تحميل الخريطة. اضغط إعادة المحاولة أو تحقق من وصول المتصفح إلى OpenFreeMap.");
        }
      }, 9000);
    }

    void setupMap();

    return () => {
      cancelled = true;
      if (loadingTimeout) {
        window.clearTimeout(loadingTimeout);
      }
      popupRef.current?.remove();
      popupRef.current = null;
      mapRef.current?.remove();
      mapRef.current = null;
      setMapLoaded(false);
    };
  }, [retryKey]);

  useEffect(() => {
    const map = mapRef.current;
    if (!mapLoaded || !map) {
      return;
    }

    const source = map.getSource(sourceId) as GeoJSONSource | undefined;
    source?.setData(featureCollection);
  }, [featureCollection, mapLoaded]);

  useEffect(() => {
    const map = mapRef.current;
    const maplibregl = moduleRef.current;
    if (!mapLoaded || !map || !maplibregl) {
      return;
    }

    if (featureCollection.features.length === 0) {
      map.easeTo({ center: [riyadhCenter.longitude, riyadhCenter.latitude], zoom: riyadhCenter.zoom });
      return;
    }

    if (featureCollection.features.length === 1) {
      map.easeTo({ center: featureCollection.features[0].geometry.coordinates, zoom: 13 });
      return;
    }

    const bounds = new maplibregl.LngLatBounds();
    for (const feature of featureCollection.features) {
      bounds.extend(feature.geometry.coordinates);
    }
    map.fitBounds(bounds, { padding: 70, maxZoom: 14, duration: 600 });
  }, [featureCollection, mapLoaded]);

  useEffect(() => {
    const map = mapRef.current;
    if (!mapLoaded || !map || !map.getLayer(pointLayerId)) {
      return;
    }

    map.setPaintProperty(pointLayerId, "circle-radius", [
      "case",
      ["==", ["get", "id"], selectedId ?? ""],
      12,
      ["==", ["get", "id"], hoveredId ?? ""],
      11,
      8,
    ]);
    map.setFilter(selectedLayerId, ["all", ["!", ["has", "point_count"]], ["==", ["get", "id"], selectedId ?? ""]]);

    const selectedFeature = featureCollection.features.find((feature) => feature.properties.id === selectedId);
    if (selectedFeature) {
      map.flyTo({ center: selectedFeature.geometry.coordinates, zoom: Math.max(map.getZoom(), 12), essential: true });
    }
  }, [featureCollection, hoveredId, mapLoaded, selectedId]);

  if (featureCollection.features.length === 0) {
    return (
      <div className={`flex min-h-[460px] items-center justify-center rounded-lg border border-dashed border-slate-300 bg-white p-6 text-center ${className}`}>
        <div>
          <p className="text-lg font-black text-slate-950">لا توجد سجلات بإحداثيات صالحة</p>
          <p className="mt-2 text-sm text-slate-600">أضف موقعاً للعقار من نموذج العرض أو الطلب حتى يظهر على الخريطة.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative min-h-[460px] overflow-hidden rounded-lg border border-slate-200 bg-slate-100 shadow-sm ${className}`}>
      <div ref={containerRef} className="h-full min-h-[460px] w-full" data-testid="real-maplibre-map" />
      {!mapLoaded ? (
        <div className="absolute inset-0 grid place-items-center bg-white/80">
          <p className="rounded-md bg-white px-4 py-3 text-sm font-black text-slate-800 shadow-sm">جاري تحميل الخريطة الحقيقية...</p>
        </div>
      ) : null}
      {mapError ? (
        <div className="absolute inset-x-4 top-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm font-bold text-rose-800 shadow-sm">
          <p>{mapError}</p>
          <button type="button" onClick={() => setRetryKey((value) => value + 1)} className="secondary-button mt-2">
            إعادة المحاولة
          </button>
        </div>
      ) : null}
    </div>
  );
}

export function buildRecordNavigationUrl(latitude: number, longitude: number) {
  return buildGoogleMapsUrl(latitude, longitude);
}
