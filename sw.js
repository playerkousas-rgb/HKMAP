/* Scout System · 離線底圖 Service Worker
 *
 * 目的：活動前用手機下載底圖磚（見 js/offline.js），之後冇網絡都睇得到、印得到。
 * 策略：
 *  - 地政總署圖磚（mapapi.geodata.gov.hk）：cache-first（有就用，冇就上網並存起來）
 *  - 本站檔案（HTML／JS／CSS／圖示）：network-first（永遠開到最新版），斷網回落快取
 *  - CDN（Leaflet／proj4／字型／回報 widget／等高線 API）：stale-while-revalidate
 * 圖磚 cache 名要同 js/offline.js 的 TILE_CACHE 一致。
 * 本檔在根目錄，scope 才會是整個網站。
 */
// ⚠️ 圖磚 cache 名唔好隨便改：改名＝activate 時會清走用家已下載的離線底圖。
const TILE_CACHE = "landsd-tiles-v1";
const APP_CACHE = "scout-app-v1";
const TILE_HOSTS = new Set(["mapapi.geodata.gov.hk"]);

/* 開網站一次就已經有齊「App 本身」，斷網都開得返。 */
const CORE_FILES = [
  "index.html",
  "css/app.css",
  "assets/mark.svg",
  "js/app.js",
  "js/hkgeo.js",
  "js/overprint.js",
  "js/contours.js",
  "js/catalog.js",
  "js/offline.js",
  "js/report.js",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(APP_CACHE);
      await Promise.all(
        CORE_FILES.map((file) =>
          cache.add(new Request(file, { cache: "reload" })).catch(() => {})
        )
      );
      await self.skipWaiting();
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keep = new Set([TILE_CACHE, APP_CACHE]);
      for (const name of await caches.keys()) {
        if (!keep.has(name)) await caches.delete(name);
      }
      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  let url;
  try {
    url = new URL(request.url);
  } catch {
    return;
  }
  // 平台自帶（Vercel Insights／API）：唔好掂。
  if (url.pathname.startsWith("/_vercel/") || url.pathname.startsWith("/api/")) return;

  if (TILE_HOSTS.has(url.hostname)) {
    // 頁面「📥 離線」下載時用 cache: "reload" 要求最新版本 → 一定要上網抓。
    if (request.cache === "reload" || request.cache === "no-store") {
      event.respondWith(refreshTile(request));
    } else {
      event.respondWith(cacheFirst(request, TILE_CACHE));
    }
    return;
  }
  if (url.origin === self.location.origin) {
    // 本站檔案（HTML／JS／CSS／圖示）一律先上網攞最新版，斷網先回落快取，
    // 免得改版後仲派舊 JS。
    event.respondWith(networkFirst(request, APP_CACHE));
    return;
  }
  event.respondWith(staleWhileRevalidate(request, APP_CACHE));
});

/** 圖磚：有快取即回（離線照用），冇就上網攞並存起來。 */
async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(request, { ignoreVary: true });
  if (hit) return hit;
  const response = await fetch(request);
  if (canStore(response)) cache.put(request, response.clone()).catch(() => {});
  return response;
}

/** 指定要最新版本（cache: reload）的圖磚：上網抓並覆寫快取；失敗才回落舊快取。 */
async function refreshTile(request) {
  const cache = await caches.open(TILE_CACHE);
  try {
    const response = await fetch(request);
    if (canStore(response)) await cache.put(request, response.clone());
    return response;
  } catch (error) {
    const hit = await cache.match(request, { ignoreVary: true });
    if (hit) return hit;
    throw error;
  }
}

/** 本站檔案：先上網攞最新版，慢過 3.5 秒或斷網就用快取。 */
async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const response = await withTimeout(fetch(request), 3500);
    if (canStore(response)) cache.put(request, response.clone()).catch(() => {});
    return response;
  } catch {
    const hit =
      (await cache.match(request, { ignoreVary: true })) ||
      (request.mode === "navigate" ? await cache.match("index.html") : null);
    if (hit) return hit;
    if (request.mode === "navigate") {
      return new Response(
        "<!doctype html><meta charset=\"utf-8\"><h1>離線</h1><p>未下載呢一頁。連一次網再開，就會自動存起來。</p>",
        { status: 503, headers: { "content-type": "text/html; charset=utf-8" } }
      );
    }
    return new Response("", { status: 503, statusText: "offline" });
  }
}

/** 其他資源：先回快取（快），背景順便更新。 */
async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(request, { ignoreVary: true });
  const update = fetch(request)
    .then((response) => {
      if (canStore(response)) cache.put(request, response.clone()).catch(() => {});
      return response;
    })
    .catch(() => null);
  if (hit) {
    update.catch(() => {});
    return hit;
  }
  const response = await update;
  if (response) return response;
  throw new Error("offline");
}

function canStore(response) {
  return Boolean(response) && (response.ok || response.type === "opaque");
}

function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timeout")), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}
