import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";

const targetUrl = process.argv[2] ?? "http://127.0.0.1:3100";
const port = 9400 + Math.floor(Math.random() * 500);
const chromeCandidates = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
];

async function fileExists(path) {
  try {
    await import("node:fs/promises").then(({ access }) => access(path));
    return true;
  } catch {
    return false;
  }
}

async function findBrowser() {
  for (const candidate of chromeCandidates) {
    if (await fileExists(candidate)) {
      return candidate;
    }
  }
  throw new Error("Chrome or Edge was not found in the default Windows install paths.");
}

async function waitForJsonEndpoint(url, timeoutMs = 12000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return response.json();
      }
    } catch {
      // keep polling while Chrome starts
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

function connect(wsUrl) {
  const socket = new WebSocket(wsUrl);
  let id = 0;
  const pending = new Map();
  const events = [];

  socket.addEventListener("message", (event) => {
    const data = JSON.parse(event.data);
    if (data.id && pending.has(data.id)) {
      pending.get(data.id).resolve(data);
      pending.delete(data.id);
      return;
    }
    events.push(data);
  });

  function send(method, params = {}) {
    const messageId = ++id;
    socket.send(JSON.stringify({ id: messageId, method, params }));
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        pending.delete(messageId);
        reject(new Error(`Timed out: ${method}`));
      }, 15000);
      pending.set(messageId, {
        resolve: (value) => {
          clearTimeout(timeout);
          resolve(value);
        },
      });
    });
  }

  return new Promise((resolve) => {
    socket.addEventListener("open", () => resolve({ socket, send, events }), { once: true });
  });
}

async function evaluate(send, expression) {
  const result = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  if (result.result.exceptionDetails) {
    throw new Error(result.result.exceptionDetails.text);
  }
  return result.result.result.value;
}

async function waitFor(send, expression, timeoutMs = 20000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const value = await evaluate(send, expression);
    if (value) {
      return value;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Timed out waiting for expression: ${expression}`);
}

function summarizeEvents(events) {
  const consoleEvents = [];
  const failedRequests = [];
  const watchedResponses = [];

  for (const event of events) {
    if (event.method === "Runtime.consoleAPICalled") {
      consoleEvents.push({
        type: event.params.type,
        text: event.params.args.map((arg) => arg.value ?? arg.description ?? "").join(" "),
      });
    }
    if (event.method === "Runtime.exceptionThrown") {
      consoleEvents.push({
        type: "exception",
        text: event.params.exceptionDetails.exception?.description ?? event.params.exceptionDetails.text,
      });
    }
    if (event.method === "Network.loadingFailed") {
      failedRequests.push({
        requestId: event.params.requestId,
        type: event.params.type,
        errorText: event.params.errorText,
      });
    }
    if (event.method === "Network.responseReceived") {
      const { url, status, mimeType } = event.params.response;
      if (/basemaps\.cartocdn|maplibre|mapbox-gl-rtl-text|\.png|env-status/.test(url)) {
        watchedResponses.push({ url, status, mimeType });
      }
    }
  }

  return { consoleEvents, failedRequests, watchedResponses };
}

async function runScenario(send, mobile = false) {
  if (mobile) {
    await send("Emulation.setDeviceMetricsOverride", {
      width: 390,
      height: 844,
      deviceScaleFactor: 2,
      mobile: true,
    });
  } else {
    await send("Emulation.setDeviceMetricsOverride", {
      width: 1440,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false,
    });
  }

  await send("Page.navigate", { url: targetUrl });
  await waitFor(send, "document.readyState === 'complete'", 20000);
  await evaluate(
    send,
    `(() => {
      const button = Array.from(document.querySelectorAll('button')).find((item) => {
        if (!item.textContent?.includes('الخريطة')) return false;
        const rect = item.getBoundingClientRect();
        const style = getComputedStyle(item);
        return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
      });
      button?.click();
      return Boolean(button);
    })()`,
  );
  if (mobile) {
    await waitFor(
      send,
      `(() => {
        const button = Array.from(document.querySelectorAll('button')).find((item) => {
          if (!item.textContent?.includes('عرض الخريطة')) return false;
          const rect = item.getBoundingClientRect();
          const style = getComputedStyle(item);
          return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
        });
        button?.click();
        return Boolean(button);
      })()`,
      10000,
    );
  }
  await waitFor(send, "Boolean(document.querySelector('.maplibregl-canvas'))", 20000);
  await new Promise((resolve) => setTimeout(resolve, 12000));

  const beforeInteraction = await evaluate(
    send,
    `(() => {
      const body = document.body.innerText || '';
      const canvas = document.querySelector('.maplibregl-canvas');
      const attribution = document.querySelector('.maplibregl-ctrl-attrib')?.textContent || '';
      const rect = canvas?.getBoundingClientRect();
      const rtlStatus = window.__wasitMapLibreConfig?.rtlStatus || 'unknown';
      return {
        canvas: Boolean(canvas),
        canvasWidth: canvas?.clientWidth || 0,
        canvasHeight: canvas?.clientHeight || 0,
        loadingVisible: body.includes('جاري تحميل الخريطة الحقيقية'),
        timeoutVisible: body.includes('طال تحميل الخريطة'),
        errorVisible: body.includes('تعذر تحميل الخريطة') || body.includes('حدث خطأ أثناء تحميل الخريطة'),
        attributionVisible: attribution.includes('CARTO') || attribution.includes('OpenStreetMap'),
        rtlStatus,
        rect: rect ? { x: rect.x, y: rect.y, width: rect.width, height: rect.height } : null
      };
    })()`,
  );

  if (!beforeInteraction.rect) {
    throw new Error("Map canvas rect was not available.");
  }

  const centerX = beforeInteraction.rect.x + beforeInteraction.rect.width / 2;
  const centerY = beforeInteraction.rect.y + beforeInteraction.rect.height / 2;
  await send("Input.dispatchMouseEvent", { type: "mouseWheel", x: centerX, y: centerY, deltaY: -400 });
  await send("Input.dispatchMouseEvent", { type: "mousePressed", x: centerX, y: centerY, button: "left", buttons: 1, clickCount: 1 });
  await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: centerX + 60, y: centerY + 30, button: "left", buttons: 1 });
  await send("Input.dispatchMouseEvent", { type: "mouseReleased", x: centerX + 60, y: centerY + 30, button: "left", buttons: 0, clickCount: 1 });
  await new Promise((resolve) => setTimeout(resolve, 1200));

  const afterInteraction = await evaluate(
    send,
    `(() => {
      const body = document.body.innerText || '';
      const markers = document.querySelectorAll('.maplibregl-canvas').length;
      return {
        loadingVisible: body.includes('جاري تحميل الخريطة الحقيقية'),
        timeoutVisible: body.includes('طال تحميل الخريطة'),
        errorVisible: body.includes('تعذر تحميل الخريطة') || body.includes('حدث خطأ أثناء تحميل الخريطة'),
        canvasStillMounted: markers > 0
      };
    })()`,
  );

  return { mobile, beforeInteraction, afterInteraction };
}

const browser = await findBrowser();
const profileDir = await mkdtemp(join(tmpdir(), "wasit-map-smoke-"));
const chrome = spawn(browser, [
  "--headless=new",
  "--disable-gpu",
  "--disable-extensions",
  "--no-first-run",
  `--remote-debugging-port=${port}`,
  `--user-data-dir=${profileDir}`,
  "about:blank",
]);

try {
  const targets = await waitForJsonEndpoint(`http://127.0.0.1:${port}/json`);
  const page = targets.find((target) => target.type === "page");
  if (!page) {
    throw new Error("No browser page target was available.");
  }

  const { socket, send, events } = await connect(page.webSocketDebuggerUrl);
  await send("Runtime.enable");
  await send("Network.enable");
  await send("Page.enable");

  const desktop = await runScenario(send, false);
  const mobile = await runScenario(send, true);
  const summary = summarizeEvents(events);

  socket.close();

  const hasRtlPlugin = summary.watchedResponses.some((response) => response.url.includes("mapbox-gl-rtl-text") && response.status === 200);
  const rtlConfigured = [desktop, mobile].every((scenario) => ["loaded", "loading", "deferred"].includes(scenario.beforeInteraction.rtlStatus));
  const hasRasterTiles = summary.watchedResponses.some((response) => response.url.includes("basemaps.cartocdn.com") && response.status === 200);
  const hasFailure = summary.failedRequests.length > 0;
  const visibleAndUsable = [desktop, mobile].every(
    (scenario) =>
      scenario.beforeInteraction.canvas &&
      scenario.beforeInteraction.canvasWidth > 0 &&
      scenario.beforeInteraction.canvasHeight > 0 &&
      scenario.beforeInteraction.attributionVisible &&
      !scenario.beforeInteraction.loadingVisible &&
      !scenario.beforeInteraction.timeoutVisible &&
      !scenario.beforeInteraction.errorVisible &&
      scenario.afterInteraction.canvasStillMounted &&
      !scenario.afterInteraction.loadingVisible &&
      !scenario.afterInteraction.timeoutVisible &&
      !scenario.afterInteraction.errorVisible,
  );

  const result = {
    targetUrl,
    passed: visibleAndUsable && (hasRtlPlugin || rtlConfigured) && hasRasterTiles && !hasFailure,
    desktop,
    mobile,
    hasRtlPlugin,
    rtlConfigured,
    hasRasterTiles,
    failedRequests: summary.failedRequests,
    consoleEvents: summary.consoleEvents,
    watchedResponses: summary.watchedResponses.slice(-30),
  };

  console.log(JSON.stringify(result, null, 2));
  if (!result.passed) {
    process.exitCode = 1;
  }
} finally {
  chrome.kill();
  await new Promise((resolve) => setTimeout(resolve, 1000));
  await rm(profileDir, { recursive: true, force: true }).catch(() => {});
}
