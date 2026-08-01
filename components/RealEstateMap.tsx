"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { configureMapLibre } from "@/lib/maplibre-config";
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
type MapLayerMouseEvent = import("maplibre-gl").MapLayerMouseEvent;
type MapMouseEvent = import("maplibre-gl").MapMouseEvent;
type MapGeoJSONFeature = import("maplibre-gl").MapGeoJSONFeature;
type MaplibreEventName = "load" | "styledata" | "sourcedata" | "idle" | "error" | "render" | "style.load";

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
  body.textContent = `${properties.city}، ${properties.district} | ${properties.statusLabel} | المساحة: ${
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

function hasWebGlSupport() {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl2") ?? canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

function logMapEvent(name: string, event?: unknown) {
  if (process.env.NODE_ENV !== "development") {
    return;
  }

  if (name === "error") {
    console.error("[wasit-map]", name, event);
    return;
  }

  console.debug("[wasit-map]", name, event);
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
  const layersReadyRef = useRef(false);
  const mapUsableRef = useRef(false);
  const [mapReady, setMapReady] = useState(false);
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
    let loadingTimeout: number | null = null;
    let resizeObserver: ResizeObserver | null = null;
    const cleanupHandlers: Array<() => void> = [];

    function cleanupMap() {
      if (loadingTimeout !== null) {
        window.clearTimeout(loadingTimeout);
        loadingTimeout = null;
      }

      for (const cleanup of cleanupHandlers.splice(0)) {
        cleanup();
      }

      resizeObserver?.disconnect();
      resizeObserver = null;
      popupRef.current?.remove();
      popupRef.current = null;
      mapRef.current?.remove();
      mapRef.current = null;
      layersReadyRef.current = false;
      mapUsableRef.current = false;
    }

    async function setupMap() {
      if (!containerRef.current) {
        return;
      }

      setMapReady(false);
      setMapError(null);
      layersReadyRef.current = false;
      mapUsableRef.current = false;

      if (!hasWebGlSupport()) {
        setMapError("المتصفح أو الجهاز لا يدعم WebGL المطلوب لتشغيل الخريطة التفاعلية.");
        return;
      }

      const maplibregl = await import("maplibre-gl");
      if (cancelled || !containerRef.current) {
        return;
      }

      moduleRef.current = maplibregl;
      await configureMapLibre(maplibregl);
      if (cancelled || !containerRef.current) {
        return;
      }

      const map = new maplibregl.Map({
        container: containerRef.current,
        style: openFreeMapStyleUrl,
        center: [riyadhCenter.longitude, riyadhCenter.latitude],
        zoom: riyadhCenter.zoom,
        attributionControl: { compact: true },
      });

      mapRef.current = map;
      map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "top-left");
      map.addControl(new maplibregl.FullscreenControl(), "top-left");
      map.addControl(
        new maplibregl.GeolocateControl({
          positionOptions: { enableHighAccuracy: true },
          trackUserLocation: false,
        }),
        "top-left",
      );

      const resizeMap = () => {
        window.requestAnimationFrame(() => {
          if (!cancelled && mapRef.current) {
            mapRef.current.resize();
          }
        });
      };

      resizeObserver = new ResizeObserver(resizeMap);
      resizeObserver.observe(containerRef.current);
      window.addEventListener("resize", resizeMap);
      cleanupHandlers.push(() => window.removeEventListener("resize", resizeMap));
      resizeMap();
      window.setTimeout(resizeMap, 150);
      window.setTimeout(resizeMap, 600);

      const register = (name: MaplibreEventName, handler: (event: unknown) => void) => {
        map.on(name, handler);
        cleanupHandlers.push(() => map.off(name, handler));
      };

      const failMap = (message = "تعذر تحميل الخريطة أو البلاطات. تحقق من الاتصال ثم أعد المحاولة.") => {
        if (cancelled || mapUsableRef.current) {
          return;
        }

        if (loadingTimeout !== null) {
          window.clearTimeout(loadingTimeout);
          loadingTimeout = null;
        }
        setMapReady(false);
        setMapError(message);
      };

      const markMapUsable = () => {
        if (cancelled || mapUsableRef.current || !layersReadyRef.current || (!map.loaded() && !map.areTilesLoaded())) {
          return;
        }

        mapUsableRef.current = true;
        if (loadingTimeout !== null) {
          window.clearTimeout(loadingTimeout);
          loadingTimeout = null;
        }
        resizeMap();
        setMapError(null);
        setMapReady(true);
      };

      const addPropertyLayers = () => {
        if (cancelled || layersReadyRef.current) {
          return false;
        }

        try {
          if (!map.getStyle()?.version || map.getSource(sourceId)) {
            return false;
          }

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

          layersReadyRef.current = true;
          return true;
        } catch (error) {
          const message = error instanceof Error ? error.message : "";
          if (message.includes("Style is not done loading")) {
            return false;
          }

          failMap(error instanceof Error ? `تعذر تجهيز طبقات الخريطة: ${error.message}` : "تعذر تجهيز طبقات الخريطة.");
          return false;
        }
      };

      const onClusterClick = async (event: MapMouseEvent) => {
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
      };

      const onPointClick = (event: MapLayerMouseEvent) => {
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
      };

      const setPointerCursor = () => {
        map.getCanvas().style.cursor = "pointer";
      };
      const clearPointerCursor = () => {
        map.getCanvas().style.cursor = "";
      };

      const bindLayerInteractions = () => {
        if (!layersReadyRef.current) {
          return;
        }

        map.on("click", clusterLayerId, onClusterClick);
        map.on("click", pointLayerId, onPointClick);
        map.on("mouseenter", pointLayerId, setPointerCursor);
        map.on("mouseleave", pointLayerId, clearPointerCursor);
        map.on("mouseenter", clusterLayerId, setPointerCursor);
        map.on("mouseleave", clusterLayerId, clearPointerCursor);
        cleanupHandlers.push(() => {
          map.off("click", clusterLayerId, onClusterClick);
          map.off("click", pointLayerId, onPointClick);
          map.off("mouseenter", pointLayerId, setPointerCursor);
          map.off("mouseleave", pointLayerId, clearPointerCursor);
          map.off("mouseenter", clusterLayerId, setPointerCursor);
          map.off("mouseleave", clusterLayerId, clearPointerCursor);
        });
      };

      let interactionsBound = false;
      const readyAndBind = () => {
        const added = addPropertyLayers();
        if (added && !interactionsBound) {
          interactionsBound = true;
          bindLayerInteractions();
        }
        if (layersReadyRef.current) {
          markMapUsable();
        }
      };

      register("load", (event) => {
        logMapEvent("load", event);
        readyAndBind();
      });
      register("style.load", (event) => {
        logMapEvent("style.load", event);
        const added = addPropertyLayers();
        if (added && !interactionsBound) {
          interactionsBound = true;
          bindLayerInteractions();
        }
      });
      register("styledata", (event) => {
        logMapEvent("styledata", event);
      });
      register("sourcedata", (event) => {
        logMapEvent("sourcedata", event);
      });
      register("render", (event) => {
        logMapEvent("render", event);
      });
      register("idle", (event) => {
        logMapEvent("idle", event);
        readyAndBind();
      });
      register("error", (event) => {
        logMapEvent("error", event);
        setMapError("حدث خطأ أثناء تحميل الخريطة أو إحدى طبقاتها. إذا لم تظهر البلاطات، اضغط إعادة المحاولة.");
      });

      loadingTimeout = window.setTimeout(() => {
        readyAndBind();
        if (!mapUsableRef.current) {
          failMap("طال تحميل الخريطة. تحقق من اتصال المتصفح بـ OpenFreeMap ثم اضغط إعادة المحاولة.");
        }
      }, 12000);
    }

    void setupMap();

    return () => {
      cancelled = true;
      cleanupMap();
      setMapReady(false);
    };
  }, [retryKey]);

  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map) {
      return;
    }

    const source = map.getSource(sourceId) as GeoJSONSource | undefined;
    source?.setData(featureCollection);
  }, [featureCollection, mapReady]);

  useEffect(() => {
    const map = mapRef.current;
    const maplibregl = moduleRef.current;
    if (!mapReady || !map || !maplibregl) {
      return;
    }

    window.requestAnimationFrame(() => map.resize());

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
  }, [featureCollection, mapReady]);

  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map || !map.getLayer(pointLayerId)) {
      return;
    }

    map.resize();
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
  }, [featureCollection, hoveredId, mapReady, selectedId]);

  if (featureCollection.features.length === 0) {
    return (
      <div className={`flex h-[62vh] min-h-[460px] items-center justify-center rounded-lg border border-dashed border-slate-300 bg-white p-6 text-center ${className}`}>
        <div>
          <p className="text-lg font-black text-slate-950">لا توجد سجلات بإحداثيات صالحة</p>
          <p className="mt-2 text-sm text-slate-600">أضف موقعاً للعقار من نموذج العرض أو الطلب حتى يظهر على الخريطة.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative h-[62vh] min-h-[460px] overflow-hidden rounded-lg border border-slate-200 bg-slate-100 shadow-sm ${className}`}>
      <div ref={containerRef} className="absolute inset-0 h-full w-full" data-testid="real-maplibre-map" />
      {!mapReady && !mapError ? (
        <div className="pointer-events-none absolute inset-0 grid place-items-center bg-white/80">
          <p className="rounded-md bg-white px-4 py-3 text-sm font-black text-slate-800 shadow-sm">جاري تحميل الخريطة الحقيقية...</p>
        </div>
      ) : null}
      {mapError ? (
        <div className="absolute inset-x-4 top-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm font-bold text-rose-800 shadow-sm">
          <p>{mapError}</p>
          <button
            type="button"
            onClick={() => {
              setMapError(null);
              setRetryKey((value) => value + 1);
            }}
            className="secondary-button mt-2"
          >
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
