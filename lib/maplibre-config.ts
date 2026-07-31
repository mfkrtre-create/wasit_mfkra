const mapLibreWorkerPath = "/maplibre-gl-csp-worker.js";
const rtlTextPluginPath = "/mapbox-gl-rtl-text.js";

type MapLibreModule = typeof import("maplibre-gl");

let workerConfigured = false;
let rtlPluginConfigured = false;

function exposeMapLibreStatus(maplibregl: MapLibreModule) {
  if (typeof window === "undefined") {
    return;
  }

  (window as unknown as { __wasitMapLibreConfig?: { workerConfigured: boolean; rtlStatus: string } }).__wasitMapLibreConfig = {
    workerConfigured,
    rtlStatus: maplibregl.getRTLTextPluginStatus(),
  };
}

export async function configureMapLibre(maplibregl: MapLibreModule) {
  if (!workerConfigured) {
    maplibregl.setWorkerUrl(new URL(mapLibreWorkerPath, window.location.origin).toString());
    maplibregl.setWorkerCount(1);
    maplibregl.prewarm();
    workerConfigured = true;
  }

  if (rtlPluginConfigured) {
    exposeMapLibreStatus(maplibregl);
    return;
  }

  const rtlStatus = maplibregl.getRTLTextPluginStatus();
  if (rtlStatus === "unavailable") {
    await maplibregl.setRTLTextPlugin(new URL(rtlTextPluginPath, window.location.origin).toString(), false);
  }

  rtlPluginConfigured = true;
  exposeMapLibreStatus(maplibregl);
}
