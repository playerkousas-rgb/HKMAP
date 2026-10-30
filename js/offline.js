/**
 * Scout System · 離線底圖（活動前先用手機下載）
 *
 * 為什麼要：活動現場常常冇訊號，圖磚抓唔到就「行著行著冇圖」。
 * 做法：把白紙（或全港）範圍、指定級別的 iB20000 圖磚＋地名圖磚，
 *      預先寫入瀏覽器 Cache Storage（由 sw.js 離線供應）。全部只存喺用家部機，
 *      唔會經本站後端、唔會上傳。
 *
 * 只快取 LandsD 的 basemap／label 圖磚（官方 API 條款見頁尾）；郊遊圖（OpenTopoMap）
 * 同航空照片唔會納入，避免大量抓取第三方圖磚。
 */
import { HK_BOUNDS, landsdUrl, zoomForScale } from "./hkgeo.js";

const TILE_CACHE = "landsd-tiles-v1"; // 要同 sw.js 一致
const BASE_LEVEL = 11; // 由 z11 起儲，縮細睇都仲有圖
const MAX_LEVEL = 18;
const MAX_TILES = 2000; // 一次最多下載幾多張（避免誤按抓爆對方 API）
const PARALLEL = 5;
const BYTES_PER_TILE = 12 * 1024; // 粗略估算，只用嚟顯示

let map = null;
let ui = null;
let running = false;
let cancelRequested = false;
let swReady = false;
let swPromise = null;

export function setupOffline(mapInstance, deps = {}) {
  map = mapInstance;
  const t = deps.t || ((zh) => zh);
  const toast = deps.toast || (() => {});
  const askConfirm = deps.askConfirm || (async () => true);

  const modal = document.getElementById("offline");
  if (!modal) return;
  ui = {
    modal,
    start: document.getElementById("offline-start"),
    clear: document.getElementById("offline-clear"),
    close: document.getElementById("offline-close"),
    estimate: document.getElementById("offline-estimate"),
    status: document.getElementById("offline-status"),
    bar: document.getElementById("offline-bar"),
    fill: modal.querySelector("#offline-bar > i"),
    open: document.getElementById("btn-offline"),
    chip: document.getElementById("offline-chip"),
    t,
    toast,
    askConfirm,
  };

  ui.open?.addEventListener("click", () => openModal());
  ui.close?.addEventListener("click", closeModal);
  modal.addEventListener("click", (event) => {
    if (event.target === modal && !running) closeModal();
  });
  modal.querySelectorAll('input[name="offline-area"], input[name="offline-detail"]').forEach((input) => {
    input.addEventListener("change", updateEstimate);
  });
  ui.start?.addEventListener("click", () => {
    if (running) {
      cancelRequested = true;
      ui.status.textContent = t("正在停止…", "Stopping…");
      return;
    }
    startDownload();
  });
  ui.clear?.addEventListener("click", clearCache);

  swPromise = registerWorker().then((registration) => {
    swReady = Boolean(registration);
    return swReady;
  });
  syncNetwork();
  suggestDownloadOnce(deps.toast);
  window.addEventListener("online", () => {
    syncNetwork();
    toast(t("網絡已恢復，可以更新離線底圖", "Back online — you can refresh the offline map"));
  });
  window.addEventListener("offline", () => {
    syncNetwork();
    toast(t("已離線：地圖會用已下載的底圖", "Offline — using downloaded map tiles"));
  });
}

function openModal() {
  ui.modal.classList.add("open");
  updateEstimate();
  refreshStatus();
}

function closeModal() {
  ui.modal.classList.remove("open");
}

function syncNetwork() {
  const offline = navigator.onLine === false;
  if (ui.chip) ui.chip.hidden = !offline;
  document.body.classList.toggle("is-offline", offline);
}

/**
 * 未下載過底圖時，開站 8 秒後輕輕提一次（每次 session 只提一次）：
 * 免得帶隊到現場才發現冇圖。
 */
async function suggestDownloadOnce(toast) {
  if (!toast || !(await storageReady())) return;
  try {
    if (sessionStorage.getItem("scout-offline-hint") === "1") return;
    const cache = await caches.open(TILE_CACHE);
    if ((await cache.keys()).length) return;
    setTimeout(() => {
      sessionStorage.setItem("scout-offline-hint", "1");
      toast(
        ui.t(
          "活動前可按頂欄「📥 離線」下載底圖，現場冇網絡都用得",
          "Download map tiles from “📥 Offline” before the event so the map still works without network"
        )
      );
    }, 8000);
  } catch {
    /* 私隱模式／未支援：靜靜跳過 */
  }
}

/* ---------- Service Worker ---------- */

async function registerWorker() {
  if (!("serviceWorker" in navigator)) return null;
  try {
    // 唔用 scope 參數：sw.js 在根目錄，預設 scope 就是整個網站。
    return await navigator.serviceWorker.register("sw.js");
  } catch {
    // 例如喺跨網域 iframe 內、或者用 http + 地區 IP 開（非安全來源）。
    return null;
  }
}

/** 要有 service worker ＋ Cache Storage，下載先有意義（斷網時由 sw.js 供應）。 */
async function storageReady() {
  if (swPromise) await swPromise;
  return swReady && typeof caches !== "undefined";
}

/* ---------- 圖磚清單 ---------- */

function tileX(lng, z) {
  return Math.floor(((lng + 180) / 360) * 2 ** z);
}

function tileY(lat, z) {
  const rad = (lat * Math.PI) / 180;
  return Math.floor(
    ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * 2 ** z
  );
}

function tileUrl(template, z, x, y) {
  return template.replace("{z}", z).replace("{x}", x).replace("{y}", y);
}

function currentOptions() {
  const area =
    ui.modal.querySelector('input[name="offline-area"]:checked')?.value === "hk" ? "hk" : "paper";
  const detail = Number(ui.modal.querySelector('input[name="offline-detail"]:checked')?.value) || 10000;
  return { area, detail };
}

function targetBounds(area) {
  // 「呢張紙」加少少邊界：現場走位／放大都仲有圖。
  return area === "hk" ? L.latLngBounds(HK_BOUNDS) : map.getBounds().pad(0.15);
}

function levelRange(detail) {
  const lat = map.getCenter().lat;
  const maxZ = Math.min(
    MAX_LEVEL,
    Math.max(BASE_LEVEL, Math.ceil(zoomForScale(lat, detail)))
  );
  return { minZ: BASE_LEVEL, maxZ };
}

/** 要下載的圖磚範圍（唔會即刻建立 URL，先計數量做估算）。 */
function makePlan() {
  const { area, detail } = currentOptions();
  const bounds = targetBounds(area);
  const { minZ, maxZ } = levelRange(detail);
  const spans = [];
  let count = 0;
  for (let z = minZ; z <= maxZ; z++) {
    const x0 = tileX(bounds.getWest(), z);
    const x1 = tileX(bounds.getEast(), z);
    const y0 = tileY(bounds.getNorth(), z);
    const y1 = tileY(bounds.getSouth(), z);
    spans.push({ z, x0, x1, y0, y1 });
    count += (x1 - x0 + 1) * (y1 - y0 + 1) * 2; // 底圖 ＋ 地名，每格兩張
  }
  return { area, detail, bounds, minZ, maxZ, spans, count };
}

function planUrls(plan) {
  const basemap = landsdUrl("basemap");
  const label = landsdUrl("label", "tc");
  const urls = [];
  for (const span of plan.spans) {
    for (let x = span.x0; x <= span.x1; x++) {
      for (let y = span.y0; y <= span.y1; y++) {
        urls.push(tileUrl(basemap, span.z, x, y));
        urls.push(tileUrl(label, span.z, x, y));
      }
    }
  }
  return urls;
}

/* ---------- 估算與狀態 ---------- */

function fmtBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 MB";
  const mb = bytes / (1024 * 1024);
  if (mb < 1) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${mb < 10 ? mb.toFixed(1) : Math.round(mb)} MB`;
}

function updateEstimate() {
  if (!ui?.estimate) return;
  const plan = makePlan();
  const size = fmtBytes(plan.count * BYTES_PER_TILE);
  const where = plan.area === "hk" ? ui.t("全港", "all Hong Kong") : ui.t("白紙範圍", "the paper area");
  const line = `${where}　·　z${plan.minZ}–z${plan.maxZ}　·　約 ${plan.count} 張圖磚（約 ${size}）`;
  ui.estimate.textContent =
    plan.count > MAX_TILES
      ? `${line}　—　${ui.t(
          `太大，一次最多 ${MAX_TILES} 張；請改「呢張紙」或降低細節。`,
          `too big — limit is ${MAX_TILES} tiles; use the paper area or a lower detail.`
        )}`
      : line;
  if (ui.start && !running) {
    ui.start.disabled = plan.count > MAX_TILES;
    ui.start.textContent = ui.t("開始下載", "Download");
  }
}

async function refreshStatus() {
  if (!ui?.status) return;
  if (!(await storageReady())) {
    ui.status.textContent = ui.t(
      "此環境未支援離線儲存：要用 HTTPS 直接開網站（喺 iframe 內或用 http + 地區 IP 開都會失敗）。",
      "Offline storage is unavailable here — open the site over HTTPS in its own tab (blocked inside iframes or over plain http)."
    );
    return;
  }
  try {
    const cache = await caches.open(TILE_CACHE);
    const keys = await cache.keys();
    const estimate = await navigator.storage?.estimate?.();
    const used = estimate && estimate.usage ? `　·　${ui.t("本機已用", "storage used")} ${fmtBytes(estimate.usage)}` : "";
    ui.status.textContent = keys.length
      ? ui.t(`已存 ${keys.length} 張圖磚${used}。冇網絡時會自動用佢哋。`, `${keys.length} tiles stored${used}. They are used automatically when offline.`)
      : ui.t("仲未下載任何圖磚。", "No tiles downloaded yet.");
  } catch {
    ui.status.textContent = "";
  }
}

/* ---------- 下載 ---------- */

async function startDownload() {
  if (!(await storageReady())) {
    ui.toast(
      ui.t(
        "此環境未支援離線儲存：請用 HTTPS 直接開網站（iframe 內或 http 地區 IP 都會失敗）。",
        "Offline storage needs HTTPS in a normal tab (blocked inside iframes or over plain http)."
      )
    );
    return;
  }
  const plan = makePlan();
  if (plan.count > MAX_TILES) {
    ui.toast(ui.t(`太多圖磚（上限 ${MAX_TILES} 張），請收窄範圍。`, `Too many tiles (limit ${MAX_TILES}).`));
    return;
  }

  running = true;
  cancelRequested = false;
  const urls = planUrls(plan);
  const total = urls.length;
  let done = 0;
  let failed = 0;
  let cursor = 0;

  if (ui.start) {
    ui.start.disabled = false;
    ui.start.textContent = ui.t("停止", "Stop");
  }
  if (ui.clear) ui.clear.disabled = true;
  if (ui.bar) ui.bar.hidden = false;
  if (ui.fill) ui.fill.style.width = "0%";
  ui.status.textContent = ui.t(`開始下載 0 / ${total} 張…`, `Downloading 0 / ${total}…`);

  // 要求持久儲存（支援的瀏覽器會問一次／自動批），避免被系統當暫存清走。
  navigator.storage?.persist?.().catch(() => {});

  const cache = await caches.open(TILE_CACHE);
  const tick = () => {
    const pct = total ? Math.round((done / total) * 100) : 0;
    if (ui.fill) ui.fill.style.width = `${pct}%`;
    ui.status.textContent = ui.t(
      `已下載 ${done} / ${total} 張${failed ? `（失敗 ${failed}）` : ""}…`,
      `Downloaded ${done} / ${total}${failed ? ` (${failed} failed)` : ""}…`
    );
  };

  const worker = async () => {
    while (!cancelRequested && cursor < urls.length) {
      const url = urls[cursor++];
      try {
        // cache: "reload" → 一定要最新版本（唔會用舊快取），符合「先下載最新底圖」。
        const response = await fetch(url, { mode: "no-cors", cache: "reload" });
        await cache.put(url, response);
      } catch {
        failed++;
      }
      done++;
      if (done % 4 === 0 || done === total) tick();
    }
  };

  await Promise.all(Array.from({ length: PARALLEL }, worker));

  running = false;
  cancelRequested = false;
  if (ui.start) ui.start.textContent = ui.t("開始下載", "Download");
  if (ui.clear) ui.clear.disabled = false;
  if (ui.bar) ui.bar.hidden = true;
  tick();
  await refreshStatus();
  ui.toast(
    ui.t(
      `離線底圖完成：${done} 張${failed ? `（${failed} 張失敗，可再按一次補）` : ""}`,
      `Offline tiles done: ${done}${failed ? ` (${failed} failed — run again to retry)` : ""}`
    )
  );
  updateEstimate();
}

async function clearCache() {
  if (typeof caches === "undefined") return;
  const ok = await ui.askConfirm({
    title: ui.t("清除離線底圖？", "Clear offline map?"),
    body: ui.t(
      "會刪除這部機已下載的地圖磚（路線與檢查點不受影響）。下次冇網絡就冇底圖。",
      "Deletes the downloaded map tiles on this device (courses and controls are kept). You will have no map without network until you download again."
    ),
    ok: ui.t("清除", "Clear"),
    danger: true,
  });
  if (!ok) return;
  await caches.delete(TILE_CACHE);
  await refreshStatus();
  updateEstimate();
  ui.toast(ui.t("已清除離線底圖", "Offline map cleared"));
}
