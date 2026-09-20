import {
  GAZETTEER,
  HK_BOUNDS,
  HK_CENTER,
  HM20C_SHEETS,
  MAG_DECLINATION_WEST,
  COUNTRYSIDE_TILE_URL,
  formatDeg,
  fromUtm,
  gridBearing,
  gridRefs,
  landsdUrl,
  magneticBearing,
  normalizeOrientation,
  pageGeometryMm,
  paperAreaMeters,
  parseGridInput,
  planarDistance,
  scaleDenominator,
  tileOptions,
  countrysideTileOptions,
  toUtmInZone,
  utmZoneForLng,
  zoomForScale,
} from "./hkgeo.js";
import { drawOverprint, orderedControls as orderControls } from "./overprint.js";

const STORAGE_KEY = "scout-system-courses-v1";
const TERMS_KEY = "scout-system-landsd-terms";
const SCREEN_MM_PX = 96 / 25.4;
let lastScreenScale = SCREEN_MM_PX;
let pageStyleEl = null;

const state = {
  layer: "hm20c",
  tool: "pan",
  lang: "zh",
  gridOn: true,
  gridLabelsOn: true,
  labelsOn: true,
  linesOn: true,
  leaderOn: false,
  previewMode: "actual",
  screenWidthCm: 0,
  course: emptyCourse(),
  selectedId: null,
  measure: [],
};

function emptyCourse() {
  return {
    version: 2,
    system: "Scout System",
    name: "未命名定向路線",
    type: "urban",
    playMode: "linear",
    paperSize: "A4",
    orientation: "landscape",
    scaleLock: 5000,
    scaleLocked: false,
    created: new Date().toISOString(),
    meet: "",
    cutoff: "",
    sos: "",
    controls: [],
    annotations: [],
  };
}

function walkMinutes(meters) {
  return Math.max(1, Math.round(meters / 80));
}

/** 還原舊暫存時固定轉為城市路線，並移除不再支援的舊標記。 */
function normalizeCourse(data) {
  const source = data && typeof data === "object" ? data : {};
  const course = { ...emptyCourse(), ...source, type: "urban", system: "Scout System" };
  const scale = Number(course.scaleLock);
  course.scaleLock = Number.isFinite(scale) && scale >= 500 && scale <= 100000 ? Math.round(scale) : 5000;
  delete course.frame;
  course.controls = Array.isArray(source.controls)
    ? source.controls.map((control) => {
        const clean = { ...control };
        delete clean.cd;
        return clean;
      })
    : [];
  course.annotations = Array.isArray(source.annotations) ? source.annotations : [];
  return course;
}

function uid() {
  return Math.random().toString(36).slice(2, 9);
}

function toast(msg) {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.remove("show"), 2400);
}

function t(zh, en) {
  return state.lang === "zh" ? zh : en;
}

/** 使用者輸入的文字要放入 innerHTML 前先轉義，否則 < & " 會令列印內容走樣。 */
function esc(value) {
  return String(value ?? "").replace(
    /[&<>"']/g,
    (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch])
  );
}

const hist = { past: [], future: [], ignore: false };
let textBurst = false;
let textBurstTimer = 0;

function cloneState() {
  return JSON.parse(
    JSON.stringify({
      course: state.course,
      layer: state.layer,
      selectedId: state.selectedId,
      measure: state.measure,
    })
  );
}

function remember() {
  if (hist.ignore) return;
  hist.past.push(cloneState());
  if (hist.past.length > 50) hist.past.shift();
  hist.future = [];
  updateHistoryButtons();
}

function rememberText() {
  if (!textBurst) {
    remember();
    textBurst = true;
  }
  clearTimeout(textBurstTimer);
  textBurstTimer = setTimeout(() => {
    textBurst = false;
  }, 800);
}

function updateHistoryButtons() {
  const undoBtns = ["btn-undo", "btn-undo-side"].map((id) => document.getElementById(id));
  const redoBtn = document.getElementById("btn-redo");
  undoBtns.forEach((b) => {
    if (b) b.disabled = hist.past.length === 0;
  });
  if (redoBtn) redoBtn.disabled = hist.future.length === 0;
}

function hideRestore() {
  const bar = document.getElementById("restore-bar");
  if (bar) bar.hidden = true;
}

function showRestore(name) {
  const bar = document.getElementById("restore-bar");
  const msg = document.getElementById("restore-msg");
  if (!bar) return;
  if (msg) {
    msg.textContent = name
      ? t(`已還原瀏覽器暫存：「${name}」。卡著可按「清除暫存」。`, `Restored “${name}” from this browser. Use Clear if you are stuck.`)
      : t("已還原瀏覽器暫存的路線。卡著可按「清除暫存」。", "Restored the course saved in this browser. Use Clear if you are stuck.");
  }
  bar.hidden = false;
}

function hasMeaningfulCourse(course) {
  if (!course) return false;
  return Boolean(
    (course.controls && course.controls.length) ||
      course.scaleLocked ||
      course.meet ||
      course.cutoff ||
      course.sos ||
      (course.name && course.name !== "未命名定向路線")
  );
}

function applySnapshot(snap) {
  hist.ignore = true;
  const prevScaleLocked = state.course.scaleLocked;
  const copy = JSON.parse(JSON.stringify(snap));
  state.course = copy.course;
  state.layer = copy.layer || "hm20c";
  state.selectedId = copy.selectedId || null;
  state.measure = copy.measure || [];
  if (prevScaleLocked && !state.course.scaleLocked) setZoomControls(true);
  if (!prevScaleLocked && state.course.scaleLocked) setZoomControls(false);
  applyBasemap();
  applyPaper();
  renderCourse();
  renderMeasure();
  renderSidebar();
  syncScaleSelect();
  syncScaleLockButton();
  if (state.course.scaleLocked) {
    map.setZoom(zoomForScale(map.getCenter().lat, currentScaleLock()), { animate: false });
  }
  updateScaleChip();
  persist();
  updateHistoryButtons();
  hist.ignore = false;
}

function undo() {
  if (!hist.past.length) {
    toast(t("沒有可返回的步驟", "Nothing to undo"));
    return;
  }
  hist.future.push(cloneState());
  applySnapshot(hist.past.pop());
  toast(t("已返回上一動", "Undone"));
}

function redo() {
  if (!hist.future.length) {
    toast(t("沒有可重做的步驟", "Nothing to redo"));
    return;
  }
  hist.past.push(cloneState());
  applySnapshot(hist.future.pop());
  toast(t("已重做", "Redone"));
}

function askConfirm({ title, body, ok, danger }) {
  return new Promise((resolve) => {
    const modal = document.getElementById("confirm");
    const yes = document.getElementById("confirm-yes");
    const no = document.getElementById("confirm-no");
    document.getElementById("confirm-title").textContent = title;
    document.getElementById("confirm-body").textContent = body;
    yes.textContent = ok || t("確定", "OK");
    yes.classList.toggle("danger-solid", !!danger);
    modal.classList.add("open");
    const done = (value) => {
      modal.classList.remove("open");
      yes.removeEventListener("click", onYes);
      no.removeEventListener("click", onNo);
      modal.removeEventListener("click", onBackdrop);
      resolve(value);
    };
    const onYes = () => done(true);
    const onNo = () => done(false);
    const onBackdrop = (e) => {
      if (e.target === modal) done(false);
    };
    yes.addEventListener("click", onYes);
    no.addEventListener("click", onNo);
    modal.addEventListener("click", onBackdrop);
  });
}

function startFresh({ wipe = false, reload = false } = {}) {
  const wasLocked = state.course.scaleLocked;
  hist.ignore = true;
  hist.past = [];
  hist.future = [];
  state.course = emptyCourse();
  state.selectedId = null;
  state.measure = [];
  state.tool = "pan";
  if (wasLocked) setZoomControls(true);
  if (wipe) localStorage.removeItem(STORAGE_KEY);
  else persist();
  if (reload) {
    const url = new URL("index.html", location.href);
    location.href = url.href;
    return;
  }
  document.querySelectorAll(".tool").forEach((b) => b.classList.toggle("active", b.dataset.tool === "pan"));
  map.getContainer().style.cursor = "";
  map.dragging.enable();
  applyBasemap();
  applyPaper();
  renderCourse();
  renderMeasure();
  renderSidebar();
  syncScaleSelect();
  syncScaleLockButton();
  updateScaleChip();
  updateHistoryButtons();
  map.setView(HK_CENTER, 13);
  hideRestore();
  hist.ignore = false;
}

function clearControlsOnly() {
  if (!state.course.controls.length) {
    toast(t("沒有檢查點可清除", "No controls to clear"));
    return;
  }
  remember();
  state.course.controls = [];
  state.selectedId = null;
  renderCourse();
  renderSidebar();
  persist();
  toast(t("已清除檢查點", "Controls cleared"));
}

function clearMeasure() {
  if (!state.measure.length) {
    toast(t("沒有量距可清除", "No measurement to clear"));
    return;
  }
  remember();
  state.measure = [];
  renderMeasure();
  toast(t("已清除量距", "Measurement cleared"));
}

function wipeStorageAndReload() {
  localStorage.removeItem(STORAGE_KEY);
  const url = new URL("index.html", location.href);
  location.href = url.href;
}

async function runClearAction(action) {
  if (action === "undo") {
    undo();
    return;
  }
  if (action === "measure") {
    clearMeasure();
    return;
  }
  if (action === "cps") {
    const ok = await askConfirm({
      title: t("清除檢查點？", "Clear controls?"),
      body: t("只刪除起點／CP／終點，紙張與比例設定會保留。可用「返回」復原。", "Deletes start / controls / finish. Paper and scale stay. Undo still works."),
      ok: t("清除檢查點", "Clear controls"),
      danger: true,
    });
    if (ok) clearControlsOnly();
    return;
  }
  if (action === "course") {
    const ok = await askConfirm({
      title: t("開新路線？", "New course?"),
      body: t("會清空檢查點與比例鎖定，並覆寫這部瀏覽器嘅暫存，之前嘅內容無法復原。", "Clears controls and the scale lock and overwrites the browser draft — earlier work cannot be recovered."),
      ok: t("全新路線", "Start fresh"),
      danger: true,
    });
    if (ok) {
      startFresh();
      toast(t("已開新路線，本機暫存已覆寫", "New course — browser draft replaced"));
    }
    return;
  }
  if (action === "storage") {
    const ok = await askConfirm({
      title: t("清除本機暫存？", "Clear browser storage?"),
      body: t("瀏覽器記住的路線、比例鎖定都會刪除，畫面會重新載入。資料無法復原。條款同意會保留。", "The saved course and scale lock in this browser will be deleted and the page will reload. Work cannot be recovered. Terms agreement is kept."),
      ok: t("清除並重新開始", "Clear and restart"),
      danger: true,
    });
    if (ok) wipeStorageAndReload();
  }
}

/* ---------- map（白紙＝列印頁，地圖大小＝實際圖面 mm） ---------- */
const map = L.map("map", {
  center: HK_CENTER,
  zoom: 13,
  minZoom: 10,
  maxZoom: 20,
  zoomSnap: 0, // 允許小數縮放，讓自訂比例也能精確對齊（LOCK 比例用）
  zoomControl: true,
  maxBounds: HK_BOUNDS,
  maxBoundsViscosity: 0.7,
});

const labels = L.tileLayer(landsdUrl("label", "tc"), tileOptions({ pane: "overlayPane", opacity: 0.95 }));
const basemap = L.tileLayer(landsdUrl("basemap"), tileOptions({ minZoom: 10 }));
const imagery = L.tileLayer(landsdUrl("imagery"), tileOptions({ minZoom: 10 }));
const countryside = L.tileLayer(COUNTRYSIDE_TILE_URL, countrysideTileOptions());

const courseLayer = L.layerGroup().addTo(map);
const measureLayer = L.layerGroup().addTo(map);
const gridLayer = L.layerGroup().addTo(map);

function applyBasemap() {
  [basemap, imagery, countryside].forEach((l) => {
    if (map.hasLayer(l)) map.removeLayer(l);
  });
  if (state.layer === "imagery") imagery.addTo(map);
  else if (state.layer === "countryside") countryside.addTo(map);
  else basemap.addTo(map);

  // 郊遊圖已有自帶地名，不疊加 LandsD label；其餘兩種保留
  const wantLabels = state.labelsOn && state.layer !== "countryside";
  if (wantLabels) labels.addTo(map);
  else if (map.hasLayer(labels)) map.removeLayer(labels);

  document.querySelectorAll(".basemaps button").forEach((b) => {
    b.classList.toggle("active", b.dataset.layer === state.layer);
  });
  renderGrid();
}

function normalizeLayer(id) {
  if (id === "imagery") return "imagery";
  if (id === "countryside") return "countryside";
  return "hm20c";
}

function setLayer(id) {
  const layer = normalizeLayer(id);
  if (layer !== state.layer) remember();
  state.layer = layer;
  applyBasemap();
  renderSheetInfo();
  persist();
}

/* ---------- 紙張（設計畫布＝列印頁） ---------- */
function currentOrientation() {
  return normalizeOrientation(state.course.orientation || "landscape");
}

function currentPreviewMode() {
  return state.previewMode === "actual" ? "actual" : "fit";
}

function orientationLabel(dir, en = false) {
  if (en) return dir === "portrait" ? "portrait" : "landscape";
  return dir === "portrait" ? "直向" : "橫向";
}

/** 校準後：螢幕每 1mm 對應幾多 CSS px（screen.width ÷ 螢幕實際寬度）。 */
function calibratedPxPerMm() {
  const cm = Number(state.screenWidthCm);
  if (!cm || cm <= 0) return null;
  const w = (window.screen && window.screen.width) || window.innerWidth;
  return w / (cm * 10);
}

function applyPaperLayout() {
  const paper = state.course.paperSize || "A4";
  const orientation = currentOrientation();
  const g = pageGeometryMm(paper, orientation);
  const host = document.querySelector(".mapwrap");
  const hostW = host?.clientWidth || window.innerWidth || 1280;
  const hostH = host?.clientHeight || window.innerHeight || 900;
  const preview = currentPreviewMode();
  const fitScale = Math.min((hostW - 72) / g.sheetW, (hostH - 72) / g.sheetH, 6);
  const calibrated = calibratedPxPerMm();
  const screenScale =
    preview === "fit" ? Math.max(0.7, fitScale) : calibrated || SCREEN_MM_PX;
  lastScreenScale = screenScale;
  const root = document.body.style;
  const setPx = (name, mm) => root.setProperty(name, `${(mm * screenScale).toFixed(2)}px`);
  const setMm = (name, mm) => root.setProperty(name, `${mm}mm`);
  setPx("--sheet-w-screen", g.sheetW);
  setPx("--sheet-h-screen", g.sheetH);
  setPx("--map-w-screen", g.mapW);
  setPx("--map-h-screen", g.mapH);
  setPx("--head-h-screen", g.headH);
  setPx("--foot-h-screen", g.footH);
  setPx("--desc-head-h-screen", g.descHeadH);
  setPx("--pad-x-screen", g.padX);
  setPx("--pad-y-screen", g.padY);
  setMm("--sheet-w-print", g.sheetW);
  setMm("--sheet-h-print", g.sheetH);
  setMm("--map-w-print", g.mapW);
  setMm("--map-h-print", g.mapH);
  setMm("--head-h-print", g.headH);
  setMm("--foot-h-print", g.footH);
  setMm("--desc-head-h-print", g.descHeadH);
  setMm("--pad-x-print", g.padX);
  setMm("--pad-y-print", g.padY);
}

function applyPageRule() {
  // 用普通 @page（而非命名 page）：舊版 Chrome／Safari 不支援命名頁，
  // 只認得「@page { size: ... }」。JS 按目前紙張／方向即時更新，列印預覽就會是正確頁大小。
  if (!pageStyleEl) {
    pageStyleEl = document.createElement("style");
    pageStyleEl.id = "dyn-page";
    document.head.appendChild(pageStyleEl);
  }
  const g = pageGeometryMm(state.course.paperSize || "A4", currentOrientation());
  pageStyleEl.textContent = `@page { size: ${g.sheetW}mm ${g.sheetH}mm; margin: 0; }`;
}

function applyPaper() {
  const paper = state.course.paperSize || "A4";
  document.body.dataset.paper = paper;
  document.body.dataset.orientation = currentOrientation();
  document.body.dataset.preview = currentPreviewMode();
  applyPageRule();
  applyPaperLayout();
  map.invalidateSize();
  renderGrid();
  updatePaperInfo();
}

function updatePaperInfo() {
  const el = document.getElementById("paper-info");
  if (!el) return;
  const paper = state.course.paperSize || "A4";
  const orientation = currentOrientation();
  const locked = !!state.course.scaleLocked;
  const s = locked ? currentScaleLock() : Math.round(scaleDenominator(map.getCenter().lat, map.getZoom()));
  const a = paperAreaMeters(paper, s, orientation);
  const g = pageGeometryMm(paper, orientation);
  const calibrated = calibratedPxPerMm();
  const shown = lastScreenScale || SCREEN_MM_PX;
  let screenNote;
  if (currentPreviewMode() === "actual") {
    screenNote = calibrated
      ? `螢幕顯示：<strong>真實 mm</strong>（已按螢幕寬 ${Number(state.screenWidthCm)} cm 校準，${paper}＝${g.sheetW}×${g.sheetH} mm）。`
      : `螢幕顯示：實際 mm，按 96 dpi 假設（高密度／已縮放螢幕會比真實 ${paper} 細；填「螢幕寬度」即可校準）。`;
  } else if (calibrated) {
    screenNote = `螢幕顯示：約為真實 ${paper} 嘅 <strong>${Math.round((shown / calibrated) * 100)}%</strong>（預覽自動貼合視窗）。`;
  } else {
    screenNote = `螢幕顯示：${Math.round((shown / SCREEN_MM_PX) * 100)}%（96 dpi 預覽，自動貼合視窗，唔係真實大小）。`;
  }
  el.innerHTML =
    `白紙＝列印範圍：<strong>${paper} ${orientationLabel(orientation)}</strong> @ <strong>${scaleLabel(s)}</strong>` +
    (locked ? "（已鎖定）" : "（未鎖定，隨畫面縮放）") +
    `，紙面覆蓋約 <strong>${fmtLen(a.w)} × ${fmtLen(a.h)}</strong>。` +
    screenNote +
    `頁邊距已設為 <strong>0 mm</strong>（實際可印到幾貼邊，視瀏覽器／打印機支援的無邊框列印而定）。`;
}

function fmtLen(m) {
  return m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`;
}

/* ---------- UTM 方格網與方格數字 ---------- */
function renderGrid() {
  gridLayer.clearLayers();
  if (!state.gridOn) return;
  const b = map.getBounds();
  const step = map.getZoom() >= 15 ? 100 : 1000;
  const major = step === 1000;
  const style = {
    color:
      state.layer === "imagery"
        ? "#f3ead0"
        : state.layer === "countryside"
        ? "#2f5a3a"
        : "#5b2d86",
    weight: major ? 1 : 0.5,
    opacity: major ? 0.45 : 0.28,
    interactive: false,
  };
  // 香港以 114° 為界，分別用 UTM zone 49／50 繪製，避免接邊錯位。
  const zones = new Set();
  [
    [b.getSouth(), b.getWest()],
    [b.getSouth(), b.getEast()],
    [b.getNorth(), b.getWest()],
    [b.getNorth(), b.getEast()],
    [b.getCenter().lat, b.getCenter().lng],
  ].forEach(([lat, lng]) => zones.add(utmZoneForLng(lng)));
  zones.forEach((zone) => drawZoneGrid(zone, b, step, style, major));
}

/** 繪製單一 UTM zone 的方格，並按經度裁剪到該 zone 一側。 */
function drawZoneGrid(zone, b, step, style, major) {
  const lngW = zone === 49 ? -200 : 113.999;
  const lngE = zone === 49 ? 114.001 : 200;
  const corners = [
    [b.getSouth(), b.getWest()],
    [b.getSouth(), b.getEast()],
    [b.getNorth(), b.getWest()],
    [b.getNorth(), b.getEast()],
  ];
  let eMin = Infinity;
  let eMax = -Infinity;
  let nMin = Infinity;
  let nMax = -Infinity;
  for (const [lat, lng] of corners) {
    const p = toUtmInZone(lat, lng, zone);
    eMin = Math.min(eMin, p.e);
    eMax = Math.max(eMax, p.e);
    nMin = Math.min(nMin, p.n);
    nMax = Math.max(nMax, p.n);
  }
  const pad = step;
  const e0 = Math.floor((eMin - pad) / step) * step;
  const e1 = Math.ceil((eMax + pad) / step) * step;
  const n0 = Math.floor((nMin - pad) / step) * step;
  const n1 = Math.ceil((nMax + pad) / step) * step;
  const samples = 16;
  const maxLines = 120;
  const zoneWest = Math.max(b.getWest(), zone === 49 ? -180 : 114.001);
  const zoneEast = Math.min(b.getEast(), zone === 49 ? 113.999 : 180);
  const labelLng = zoneWest < zoneEast ? (zoneWest + zoneEast) / 2 : zone === 49 ? 113.999 : 114.001;
  const labelEasting = toUtmInZone(b.getCenter().lat, labelLng, zone).e;
  let count = 0;
  // 數字顏色用中性灰（接近一般地圖注記），不用網線紫。
  const labelColor = state.layer === "imagery" ? "#3f3b34" : "#57534a";

  // 垂直線（固定東距 E，北距 n0→n1）。
  for (let e = e0; e <= e1 && count < maxLines; e += step, count++) {
    drawClippedLine(zone, lngW, lngE, samples, true, e, n0, n1, style);
    if (shouldLabelGridLine(e, step, major)) {
      labelLineAt(zone, lngW, lngE, e, nMax, "east", step, labelColor);
    }
  }
  count = 0;
  // 水平線（固定北距 N，東距 e0→e1）。
  for (let n = n0; n <= n1 && count < maxLines; n += step, count++) {
    drawClippedLine(zone, lngW, lngE, samples, false, n, e0, e1, style);
    if (shouldLabelGridLine(n, step, major)) {
      labelLineAt(zone, lngW, lngE, labelEasting, n, "north", step, labelColor);
    }
  }
}

/** 1 km 網格每條線標示；放大到 100 m 網格時每 1 km 標示一次，避免文字重疊。 */
function shouldLabelGridLine(coord, step, major) {
  if (!state.gridLabelsOn) return false;
  if (major) return true;
  const inSquare = ((coord % 100000) + 100000) % 100000;
  return Math.abs(inSquare % 1000) < 1;
}

function gridLineNumber(coord, axis, step) {
  const inSquare = ((coord % 100000) + 100000) % 100000;
  const units = Math.round(inSquare / step);
  const width = step >= 1000 ? 2 : 3;
  return String(units).padStart(width, "0");
}

/** 沿一條方格線取樣，按 zone 經度裁剪後繪出（可能切成多段）。 */
function drawClippedLine(zone, lngW, lngE, samples, vertical, fixedCoord, v0, v1, style) {
  const segs = [];
  let seg = [];
  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    const easting = vertical ? fixedCoord : v0 + (v1 - v0) * t;
    const northing = vertical ? v0 + (v1 - v0) * t : fixedCoord;
    const ll = fromUtm(easting, northing, zone);
    if (ll.lng >= lngW && ll.lng <= lngE) {
      seg.push([ll.lat, ll.lng]);
    } else if (seg.length >= 2) {
      segs.push(seg);
      seg = [];
    } else {
      seg = [];
    }
  }
  if (seg.length >= 2) segs.push(seg);
  for (const segment of segs) L.polyline(segment, style).addTo(gridLayer);
}

/** 在方格線靠近地圖邊緣放置 E／N 數字，讓成員可直接讀出方格內東距及北距。 */
function labelLineAt(zone, lngW, lngE, fixedCoord, otherCoord, axis, step, color) {
  const ll = fromUtm(fixedCoord, otherCoord, zone);
  if (!Number.isFinite(ll.lat) || !Number.isFinite(ll.lng)) return;
  if (ll.lng < lngW || ll.lng > lngE) return;
  const coordinate = axis === "east" ? fixedCoord : otherCoord;
  const number = gridLineNumber(coordinate, axis, step);
  const label = axis === "east" ? `E ${number}` : `N ${number}`;
  const iconSize = axis === "east" ? [42, 17] : [42, 17];
  L.marker([ll.lat, ll.lng], {
    interactive: false,
    zIndexOffset: 100,
    icon: L.divIcon({
      className: `grid-label grid-label-${axis}`,
      html: `<span style="color:${color}" title="${label}">${label}</span>`,
      iconSize,
      iconAnchor: axis === "east" ? [21, 0] : [0, 9],
    }),
  }).addTo(gridLayer);
}

/* ---------- course graphics ---------- */
function orderedControls() {
  return orderControls(state.course.controls);
}

function nextCode() {
  const used = new Set(
    state.course.controls.filter((c) => c.kind === "control").map((c) => Number(c.code))
  );
  let n = 31;
  while (used.has(n)) n += 1;
  return String(n);
}

function renderCourse() {
  drawOverprint(courseLayer, state.course.controls, {
    draggable: true,
    lines: state.linesOn,
    onDragStart() {
      remember();
    },
    onDrag(ctrl, ll) {
      ctrl.lat = ll.lat;
      ctrl.lng = ll.lng;
      renderCourse();
      renderSidebar();
      persist();
    },
    onClick(ctrl) {
      if (state.tool === "delete") {
        removeControl(ctrl.id);
        return;
      }
      state.selectedId = ctrl.id;
      renderSidebar();
    },
  });
  renderSheetInfo();
  updateOffPaper();
}

function addControl(lat, lng, kind) {
  if (kind === "start" && state.course.controls.some((c) => c.kind === "start")) {
    toast(t("已有起點，可拖移現有三角形。", "Start already placed."));
    return;
  }
  if (kind === "finish" && state.course.controls.some((c) => c.kind === "finish")) {
    toast(t("已有終點，可拖移現有雙圓。", "Finish already placed."));
    return;
  }
  const ctrl = {
    id: uid(),
    kind,
    lat,
    lng,
    code: kind === "control" ? nextCode() : kind === "start" ? "S" : "F",
    name: kind === "start" ? "起點" : kind === "finish" ? "終點" : "",
    clue: "",
    note: "",
    score: 0,
  };
  remember();
  state.course.controls.push(ctrl);
  state.selectedId = ctrl.id;
  renderCourse();
  renderSidebar();
  persist();
}

function removeControl(id) {
  remember();
  state.course.controls = state.course.controls.filter((c) => c.id !== id);
  if (state.selectedId === id) state.selectedId = null;
  renderCourse();
  renderSidebar();
  persist();
}

function courseStats() {
  const list = orderedControls();
  let dist = 0;
  const legs = [];
  for (let i = 1; i < list.length; i++) {
    const d = planarDistance(list[i - 1], list[i]);
    const g = gridBearing(list[i - 1], list[i]);
    dist += d;
    legs.push({ from: list[i - 1], to: list[i], d, g, m: magneticBearing(g) });
  }
  return { dist, legs, count: list.filter((c) => c.kind === "control").length };
}

/* ---------- measure ---------- */
function renderMeasure() {
  measureLayer.clearLayers();
  if (state.measure.length === 0) return;
  const latlngs = state.measure.map((p) => [p.lat, p.lng]);
  L.polyline(latlngs, { color: "#c27a00", weight: 3 }).addTo(measureLayer);
  state.measure.forEach((p) => {
    L.circleMarker([p.lat, p.lng], { radius: 4, color: "#c27a00", fillOpacity: 1 }).addTo(
      measureLayer
    );
  });
  let d = 0;
  for (let i = 1; i < state.measure.length; i++) {
    d += planarDistance(state.measure[i - 1], state.measure[i]);
  }
  const last = state.measure[state.measure.length - 1];
  L.tooltip({ permanent: true, direction: "right", offset: [8, 0], className: "meas-tip" })
    .setLatLng([last.lat, last.lng])
    .setContent(d >= 1000 ? `${(d / 1000).toFixed(2)} km` : `${Math.round(d)} m`)
    .addTo(measureLayer);
}

/* ---------- events ---------- */
map.on("mousemove", (e) => {
  updateReadout(e.latlng);
});

map.on("click", (e) => {
  if (state.tool === "start" || state.tool === "control" || state.tool === "finish") {
    addControl(e.latlng.lat, e.latlng.lng, state.tool);
    return;
  }
  if (state.tool === "measure") {
    remember();
    state.measure.push({ lat: e.latlng.lat, lng: e.latlng.lng });
    renderMeasure();
  }
});

map.on("moveend zoomend", () => {
  renderGrid();
  resnapScale();
  updateScaleChip();
  updatePaperInfo();
  renderSheetInfo();
  updateOffPaper();
});

function updateReadout(ll) {
  if (!ll) return;
  const g = gridRefs(ll.lat, ll.lng);
  document.getElementById("readout").innerHTML = `
    <div><span class="k">WGS84</span> <b>${ll.lat.toFixed(6)}</b>, <b>${ll.lng.toFixed(6)}</b></div>
    <div><span class="k">方格</span> <b>${g.fig8}</b>　（UTM ${g.zone}Q · HM20C 制）</div>
    <div><span class="k">UTM</span> ${g.zone}Q ${g.square || "??"}　E <b>${g.e}</b>　N <b>${g.n}</b>　·　6 位 <b>${g.fig6}</b></div>
  `;
}

// 城市定向常用比例；最後一項仍保留 HM20C 常用的 1:20 000。
const SCALE_PRESETS = [2500, 4000, 5000, 7500, 10000, 15000, 20000, 25000];
const MIN_CUSTOM_SCALE = 500;
const MAX_CUSTOM_SCALE = 100000;

function validScale(value) {
  return Number.isFinite(value) && value >= MIN_CUSTOM_SCALE && value <= MAX_CUSTOM_SCALE;
}

function currentScaleLock() {
  const s = Number(state.course.scaleLock);
  return validScale(s) ? Math.round(s) : 5000;
}

function formatScale(n) {
  return Math.round(n).toLocaleString("en-HK");
}

function scaleLabel(s) {
  return `1 : ${formatScale(s)}`;
}

function syncScaleSelect() {
  const sel = document.getElementById("scale-select");
  if (!sel) return;
  const current = currentScaleLock();
  const scales = SCALE_PRESETS.includes(current)
    ? SCALE_PRESETS
    : [...SCALE_PRESETS, current].sort((a, b) => a - b);
  sel.innerHTML = scales
    .map((s) => {
      const custom = !SCALE_PRESETS.includes(s) ? "（自訂）" : "";
      return `<option value="${s}">${scaleLabel(s)}${custom}</option>`;
    })
    .join("");
  sel.value = String(current);
  const customInput = document.getElementById("scale-custom");
  if (customInput && document.activeElement !== customInput)
    customInput.value = SCALE_PRESETS.includes(current) ? "" : String(current);
}

function applyScale(value) {
  const scale = Math.round(Number(value));
  if (!validScale(scale)) {
    toast(t(`請輸入 ${MIN_CUSTOM_SCALE.toLocaleString("en-HK")} 至 ${MAX_CUSTOM_SCALE.toLocaleString("en-HK")} 的比例分母`, `Enter a denominator from ${MIN_CUSTOM_SCALE.toLocaleString("en-HK")} to ${MAX_CUSTOM_SCALE.toLocaleString("en-HK")}`));
    return false;
  }
  remember();
  state.course.scaleLock = scale;
  map.setZoom(zoomForScale(map.getCenter().lat, scale), { animate: false });
  syncScaleSelect();
  updatePaperInfo();
  renderSheetInfo();
  toast(
    state.course.scaleLocked
      ? t(`已鎖定 ${scaleLabel(scale)}（縮放停用）`, `Locked at ${scaleLabel(scale)}`)
      : t(`已對齊 ${scaleLabel(scale)}`, `Aligned to ${scaleLabel(scale)}`)
  );
  persist();
  return true;
}

function setZoomControls(on) {
  map.zoomControl[on ? "enable" : "disable"]();
  map.scrollWheelZoom[on ? "enable" : "disable"]();
  map.boxZoom[on ? "enable" : "disable"]();
  map.doubleClickZoom[on ? "enable" : "disable"]();
  map.touchZoom[on ? "enable" : "disable"]();
  map.keyboard[on ? "enable" : "disable"]();
}

function syncScaleLockButton() {
  const btn = document.getElementById("btn-scale-lock");
  btn.classList.toggle("on", state.course.scaleLocked);
  btn.textContent = state.course.scaleLocked ? "🔓 解鎖比例" : "🔒 鎖定比例";
}

function lockScale(silent) {
  if (!silent) remember();
  const scale = currentScaleLock();
  state.course.scaleLocked = true;
  setZoomControls(false);
  map.setZoom(zoomForScale(map.getCenter().lat, scale), { animate: false });
  syncScaleLockButton();
  updateScaleChip();
  updatePaperInfo();
  renderSheetInfo();
  if (!silent) persist();
}

function unlockScale() {
  remember();
  state.course.scaleLocked = false;
  setZoomControls(true);
  syncScaleLockButton();
  updateScaleChip();
  updatePaperInfo();
  renderSheetInfo();
  persist();
}

/** 鎖定比例時，任何移動／縮放後都把畫面拉回正確縮放，比例不會飄（例如 1:18 990）。 */
let resnapping = false;
function resnapScale() {
  if (!state.course.scaleLocked) return;
  const target = zoomForScale(map.getCenter().lat, currentScaleLock());
  if (resnapping || Math.abs(map.getZoom() - target) < 1e-3) return;
  resnapping = true;
  map.setZoom(target, { animate: false });
  resnapping = false;
}

function updateScaleChip() {
  const el = document.getElementById("scale-chip");
  if (state.course.scaleLocked) {
    el.textContent = `🔒 1 : ${formatScale(currentScaleLock())}`;
    el.classList.add("on");
    el.title = t("比例已鎖定，縮放已停用；平移仍可", "Scale locked; zoom disabled, panning still works");
  } else {
    const c = map.getCenter();
    const scale = scaleDenominator(c.lat, map.getZoom());
    el.textContent = `比例 1 : ${formatScale(scale)}`;
    el.classList.remove("on");
    el.title = "";
  }
}

function setTool(tool) {
  state.tool = tool;
  document.querySelectorAll(".tool").forEach((b) => b.classList.toggle("active", b.dataset.tool === tool));
  const cursor =
    tool === "pan" ? "" : tool === "delete" ? "not-allowed" : "crosshair";
  map.getContainer().style.cursor = cursor;
}

/* ---------- 白紙外檢查（設計不會超出列印範圍） ---------- */
function controlsOffPaper() {
  const b = map.getBounds();
  return (state.course.controls || []).filter((c) => !b.contains([c.lat, c.lng]));
}

function updateOffPaper() {
  const chip = document.getElementById("offpaper-chip");
  if (!chip) return;
  const out = controlsOffPaper();
  if (!out.length) {
    chip.hidden = true;
    return;
  }
  chip.hidden = false;
  chip.textContent = t(
    `⚠ ${out.length} 個點在白紙外，唔會印出 — 按此對齊`,
    `⚠ ${out.length} point(s) off the paper — click to fit`
  );
}

function fitCourse() {
  const list = orderedControls();
  if (!list.length) {
    toast(t("未有起點／CP／終點", "No controls yet"));
    return;
  }
  const bounds = L.latLngBounds(list.map((c) => [c.lat, c.lng]));
  if (state.course.scaleLocked) {
    map.setView(bounds.getCenter(), map.getZoom(), { animate: true });
    setTimeout(() => {
      if (controlsOffPaper().length) {
        toast(t("比例已鎖定，路線仍超出紙面：請改大分母比例或改大紙張", "Scale locked and course still exceeds the paper — use a coarser scale or larger paper"));
      }
    }, 350);
  } else {
    map.fitBounds(bounds.pad(0.25), { animate: true });
  }
}

/* ---------- 列印（＝畫面白紙，所見即所得） ---------- */
async function doPrint() {
  persist();
  if (!state.course.controls.length) {
    const ok = await askConfirm({
      title: t("未有檢查點", "No controls yet"),
      body: t("紙上仲未有起點／CP／終點。要照樣列印空白底圖嗎？", "No start / controls / finish yet. Print the base map anyway?"),
      ok: t("照樣列印", "Print anyway"),
    });
    if (!ok) return;
  } else {
    const out = controlsOffPaper();
    if (out.length) {
      const ok = await askConfirm({
        title: t("有檢查點在白紙外", "Controls off the paper"),
        body: t(
          `${out.length} 個點唔喺白紙範圍內，列印唔會印到（編號：${out.map((c) => c.code).join("、")}）。可先按「對齊路線」或移動紙面。仍要列印？`,
          `${out.length} control(s) are outside the paper and will not print. Fit the course or pan first. Print anyway?`
        ),
        ok: t("照樣列印", "Print anyway"),
        danger: true,
      });
      if (!ok) return;
    }
  }
  map.invalidateSize();
  setTimeout(() => window.print(), 200);
}

/* ---------- sidebar ---------- */
function renderSheets() {
  const hm = document.getElementById("hm20c-grid");
  hm.innerHTML = HM20C_SHEETS.filter((s) => s.id !== "1")
    .map(
      (s) =>
        `<button class="sheet-btn" data-id="${s.id}"><b>${s.id}</b>${s.name}</button>`
    )
    .join("");
}

function flySheet(id) {
  const s = HM20C_SHEETS.find((x) => x.id === id);
  if (!s) return;
  map.setView(s.center, state.course.scaleLocked ? map.getZoom() : s.zoom);
  document.querySelectorAll(".sheet-btn").forEach((b) => b.classList.toggle("active", b.dataset.id === id));
}

function renderSidebar() {
  document.getElementById("course-name").value = state.course.name;
  document.getElementById("play-mode").value = state.course.playMode || "linear";
  document.getElementById("paper-size").value = state.course.paperSize || "A4";
  document.getElementById("paper-orientation").value = currentOrientation();
  document.getElementById("screen-preview").value = currentPreviewMode();
  document.getElementById("screen-calib").value = state.screenWidthCm || "";
  const stats = courseStats();
  document.getElementById("stat-dist").textContent =
    stats.dist >= 1000 ? `${(stats.dist / 1000).toFixed(2)} km` : `${Math.round(stats.dist)} m`;
  document.getElementById("stat-n").textContent = String(stats.count);
  document.getElementById("stat-legs").textContent = String(stats.legs.length);
  document.getElementById("stat-time").textContent = stats.dist
    ? `約 ${walkMinutes(stats.dist)} 分鐘`
    : "—";
  document.getElementById("course-meet").value = state.course.meet || "";
  document.getElementById("course-cutoff").value = state.course.cutoff || "";
  document.getElementById("course-sos").value = state.course.sos || "";

  const stats2 = stats;
  const list = orderedControls();
  const box = document.getElementById("ctrl-list");
  if (!list.length) {
    box.innerHTML = "";
  } else {
    box.innerHTML = list
      .map((c, i) => {
        const g = gridRefs(c.lat, c.lng);
        const leg = i > 0 ? stats2.legs[i - 1] : null;
        const extra = leg
          ? `${Math.round(leg.d)} m · 方格 ${formatDeg(leg.g)} · 磁北 ${formatDeg(leg.m)}`
          : t("出發", "Start");
        return `<div class="ctrl ${esc(c.kind)}" data-id="${esc(c.id)}">
          <div class="num">${c.kind === "start" ? "△" : c.kind === "finish" ? "◎" : esc(c.code)}</div>
          <div>
            <strong>${esc(c.name || (c.kind === "control" ? "檢查點 " + c.code : c.kind))}</strong>
            <div class="meta">${g.fig6}　${extra}</div>
          </div>
          <button class="del" data-del="${esc(c.id)}" title="刪除">×</button>
        </div>`;
      })
      .join("");
  }

  const sel = state.course.controls.find((c) => c.id === state.selectedId);
  const ed = document.getElementById("editor");
  if (!sel) {
    ed.hidden = true;
  } else {
    ed.hidden = false;
    document.getElementById("ed-code").value = sel.code;
    document.getElementById("ed-name").value = sel.name;
    document.getElementById("ed-clue").value = sel.clue;
    document.getElementById("ed-note").value = sel.note;
    document.getElementById("ed-score").value = sel.score ?? 0;
  }
  document.body.classList.toggle("score-mode", state.course.playMode === "score");
  updatePaperInfo();
  updateHistoryButtons();
}

/* ---------- 紙面圖名／說明表（直接印出的內容） ---------- */
function renderSheetInfo() {
  const titleEl = document.getElementById("sheet-title");
  const metaEl = document.getElementById("sheet-meta");
  const descTitleEl = document.getElementById("desc-title");
  const descMetaEl = document.getElementById("desc-meta");
  const descBody = document.getElementById("desc-body");
  if (!titleEl || !metaEl || !descBody || !descTitleEl || !descMetaEl) return;
  const stats = courseStats();
  const list = orderedControls();
  titleEl.textContent = state.course.name || "定向地圖";
  const kind = "城市定向";
  const mode = state.course.playMode === "score" ? "奪分式（自由路線）" : "按順序";
  const orientation = currentOrientation();
  const distTxt = stats.dist >= 1000 ? `${(stats.dist / 1000).toFixed(2)} km` : `${Math.round(stats.dist)} m`;
  const s = state.course.scaleLocked
    ? currentScaleLock()
    : Math.round(scaleDenominator(map.getCenter().lat, map.getZoom()));
  let meta = `${kind}　·　${mode}　·　${state.course.paperSize || "A4"} ${orientationLabel(orientation)}　·　比例 ${scaleLabel(s)}${state.course.scaleLocked ? "（鎖定）" : ""}　·　${list.length} 個點　·　約 ${distTxt}　·　磁偏角 ${MAG_DECLINATION_WEST}°W`;
  if (state.course.meet) meta += `　·　集合 ${state.course.meet}`;
  if (state.course.cutoff) meta += `　·　截止 ${state.course.cutoff}`;
  if (state.course.sos) meta += `　·　緊急 ${state.course.sos}`;
  metaEl.textContent = meta;
  descTitleEl.textContent = `${state.course.name || "定向地圖"} · 檢查點說明`;
  descMetaEl.textContent = `${state.course.paperSize || "A4"} ${orientationLabel(orientation)}　·　第 2 頁　·　${list.length} 個點`;

  descBody.innerHTML = list
    .map((c, i) => {
      const g = gridRefs(c.lat, c.lng);
      const leg = i > 0 ? `${Math.round(stats.legs[i - 1].d)} m` : "—";
      const what = c.kind === "start" ? "起點" : c.kind === "finish" ? "終點" : "檢查點";
      const score =
        state.course.playMode === "score" && c.kind === "control" ? `　·　${Number(c.score) || 0} 分` : "";
      return `<tr>
        <td><strong>${esc(c.code)}</strong></td>
        <td>${what}${c.name ? "　" + esc(c.name) : ""}${c.clue ? "　—　" + esc(c.clue) : ""}${score}</td>
        <td class="leader-only">${g.full}</td>
        <td class="leader-only">${g.fig6}</td>
        <td>${leg}</td>
      </tr>`;
    })
    .join("");
}

/* ---------- persistence ---------- */
function persist() {
  const all = loadAll();
  all.current = state.course;
  all.layer = state.layer;
  all.previewMode = state.previewMode;
  all.screenWidthCm = state.screenWidthCm;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
}

function loadAll() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}

/* ---------- search ---------- */
function searchPlaces(q) {
  const s = q.trim().toLowerCase();
  if (!s) return [];
  return GAZETTEER.filter(
    (p) => p.name.toLowerCase().includes(s) || p.q.toLowerCase().includes(s)
  ).slice(0, 8);
}

/* ---------- boot ---------- */
function bind() {
  document.querySelectorAll(".basemaps button").forEach((button) => {
    button.addEventListener("click", () => setLayer(button.dataset.layer));
  });
  document.querySelectorAll(".tool").forEach((button) => {
    button.addEventListener("click", () => {
      if (button.dataset.tool === "clear-measure") {
        clearMeasure();
        return;
      }
      setTool(button.dataset.tool);
    });
  });
  document.getElementById("hm20c-grid").addEventListener("click", (event) => {
    const sheet = event.target.closest(".sheet-btn");
    if (sheet) flySheet(sheet.dataset.id);
  });
  document.getElementById("course-name").addEventListener("input", (event) => {
    rememberText();
    state.course.name = event.target.value;
    renderSheetInfo();
    persist();
  });
  document.getElementById("play-mode").addEventListener("change", (event) => {
    remember();
    state.course.playMode = event.target.value;
    renderSidebar();
    renderCourse();
    persist();
  });
  document.getElementById("paper-size").addEventListener("change", (event) => {
    remember();
    state.course.paperSize = event.target.value;
    applyPaper();
    renderSheetInfo();
    persist();
    toast(t(`紙張已改為 ${state.course.paperSize}，白紙＝列印頁`, `Paper set to ${state.course.paperSize}`));
  });
  document.getElementById("paper-orientation").addEventListener("change", (event) => {
    remember();
    state.course.orientation = normalizeOrientation(event.target.value);
    applyPaper();
    renderSheetInfo();
    persist();
    toast(t(`紙張已改為 ${orientationLabel(currentOrientation())}`, `Orientation set to ${orientationLabel(currentOrientation(), true)}`));
  });
  document.getElementById("screen-preview").addEventListener("change", (event) => {
    state.previewMode = event.target.value === "actual" ? "actual" : "fit";
    applyPaper();
    persist();
    toast(
      state.previewMode === "fit"
        ? t("已切換到螢幕預覽模式（自動貼合視窗）", "Screen preview on")
        : t("已切換到實際 mm 顯示（填螢幕寬度＝物理真實大小）", "Actual mm view — calibrate screen width for physical size")
    );
  });
  const calib = document.getElementById("screen-calib");
  calib.addEventListener("input", () => {
    const v = Number(calib.value);
    state.screenWidthCm = v > 0 ? Math.min(200, v) : 0;
    applyPaper();
    persist();
  });
  document.getElementById("opt-lines").addEventListener("change", (event) => {
    state.linesOn = event.target.checked;
    renderCourse();
  });
  document.getElementById("opt-grid").addEventListener("change", (event) => {
    state.gridOn = event.target.checked;
    document.getElementById("btn-grid").classList.toggle("on", state.gridOn);
    renderGrid();
  });
  document.getElementById("opt-grid-labels").addEventListener("change", (event) => {
    state.gridLabelsOn = event.target.checked;
    renderGrid();
  });
  document.getElementById("opt-leader").addEventListener("change", (event) => {
    state.leaderOn = event.target.checked;
    document.body.classList.toggle("leader", state.leaderOn);
  });
  document.getElementById("ctrl-list").addEventListener("click", (event) => {
    const del = event.target.closest("[data-del]");
    if (del) {
      removeControl(del.dataset.del);
      return;
    }
    const row = event.target.closest(".ctrl");
    if (!row) return;
    state.selectedId = row.dataset.id;
    const control = state.course.controls.find((item) => item.id === row.dataset.id);
    if (control) map.panTo([control.lat, control.lng]);
    renderSidebar();
  });
  ["ed-code", "ed-name", "ed-clue", "ed-note", "ed-score"].forEach((id) => {
    document.getElementById(id).addEventListener("input", (event) => {
      const selected = state.course.controls.find((control) => control.id === state.selectedId);
      if (!selected) return;
      const key = id.replace("ed-", "");
      rememberText();
      // score 保持數字型別，令暫存 JSON 同其他地方一致
      selected[key] = key === "score" ? Number(event.target.value) || 0 : event.target.value;
      renderCourse();
      persist();
    });
  });
  document.getElementById("btn-grid").addEventListener("click", () => {
    state.gridOn = !state.gridOn;
    document.getElementById("btn-grid").classList.toggle("on", state.gridOn);
    const checkbox = document.getElementById("opt-grid");
    if (checkbox) checkbox.checked = state.gridOn;
    renderGrid();
  });
  document.getElementById("btn-fit-course").addEventListener("click", fitCourse);
  document.getElementById("offpaper-chip").addEventListener("click", fitCourse);
  document.getElementById("scale-select").addEventListener("change", (event) => {
    applyScale(event.target.value);
  });
  const customScale = document.getElementById("scale-custom");
  const applyCustomScale = () => {
    if (customScale?.value.trim()) applyScale(customScale.value);
  };
  document.getElementById("btn-scale-custom").addEventListener("click", applyCustomScale);
  customScale.addEventListener("keydown", (event) => {
    if (event.key === "Enter") applyCustomScale();
  });
  document.getElementById("btn-scale-lock").addEventListener("click", () => {
    if (state.course.scaleLocked) {
      unlockScale();
      toast(t("比例已解鎖，可自由縮放", "Scale unlocked"));
    } else {
      lockScale();
      toast(t(`已鎖定 ${scaleLabel(currentScaleLock())}：白紙上就是這個比例印出`, `Scale locked at ${scaleLabel(currentScaleLock())}`));
    }
  });
  document.getElementById("btn-locate").addEventListener("click", () => {
    if (!navigator.geolocation) return toast("此瀏覽器不支援定位");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        if (state.course.scaleLocked) map.setView([latitude, longitude], map.getZoom());
        else map.setView([latitude, longitude], 16);
        L.circleMarker([latitude, longitude], {
          radius: 7,
          color: "#1d4ed8",
          fillColor: "#60a5fa",
          fillOpacity: 0.9,
        }).addTo(map);
      },
      () => toast(t("未能取得位置", "Location unavailable"))
    );
  });
  document.getElementById("btn-print").addEventListener("click", doPrint);
  document.getElementById("btn-print-side").addEventListener("click", doPrint);
  ["course-meet", "course-cutoff", "course-sos"].forEach((id) => {
    document.getElementById(id).addEventListener("input", (event) => {
      rememberText();
      state.course[id.replace("course-", "")] = event.target.value;
      renderSheetInfo();
      persist();
    });
  });
  document.getElementById("btn-new").addEventListener("click", () => runClearAction("course"));
  document.getElementById("btn-undo").addEventListener("click", undo);
  document.getElementById("btn-undo-side").addEventListener("click", undo);
  document.getElementById("btn-redo").addEventListener("click", redo);
  document.getElementById("btn-clear-cps").addEventListener("click", () => runClearAction("cps"));
  document.getElementById("btn-wipe").addEventListener("click", () => runClearAction("storage"));
  document.getElementById("restore-keep").addEventListener("click", hideRestore);
  document.getElementById("restore-undo").addEventListener("click", undo);
  document.getElementById("restore-wipe").addEventListener("click", () => runClearAction("storage"));
  const clearMenu = document.getElementById("clear-menu");
  const clearButton = document.getElementById("btn-clear-menu");
  const closeClearMenu = () => {
    clearMenu.hidden = true;
    clearButton.setAttribute("aria-expanded", "false");
  };
  clearButton.addEventListener("click", (event) => {
    event.stopPropagation();
    const open = clearMenu.hidden;
    clearMenu.hidden = !open;
    clearButton.setAttribute("aria-expanded", open ? "true" : "false");
  });
  clearMenu.addEventListener("click", (event) => {
    const item = event.target.closest("[data-clear]");
    if (!item) return;
    closeClearMenu();
    runClearAction(item.dataset.clear);
  });
  document.addEventListener("click", (event) => {
    if (!event.target.closest(".hist-clear")) closeClearMenu();
  });
  document.getElementById("btn-lang").addEventListener("click", () => {
    state.lang = state.lang === "zh" ? "en" : "zh";
    document.getElementById("btn-lang").textContent = state.lang === "zh" ? "EN" : "中";
    toast(state.lang === "zh" ? "介面以中文為主" : "Labels stay bilingual; UI notes in English");
  });
  document.getElementById("btn-goto").addEventListener("click", gotoGrid);
  document.getElementById("grid-input").addEventListener("keydown", (event) => {
    if (event.key === "Enter") gotoGrid();
  });
  document.getElementById("btn-about").addEventListener("click", () => {
    document.getElementById("about").classList.add("open");
  });
  document.getElementById("about-close").addEventListener("click", () => {
    document.getElementById("about").classList.remove("open");
  });
  document.getElementById("terms-ok").addEventListener("click", () => {
    localStorage.setItem(TERMS_KEY, "1");
    document.getElementById("terms").classList.remove("open");
  });

  const query = document.getElementById("q");
  const suggestions = document.getElementById("suggest");
  query.addEventListener("input", () => {
    const hits = searchPlaces(query.value);
    if (!hits.length) {
      suggestions.classList.remove("open");
      suggestions.innerHTML = "";
      return;
    }
    suggestions.innerHTML = hits
      .map((hit) => `<button data-lat="${hit.lat}" data-lng="${hit.lng}"><span class="tag">${hit.tag}</span>${hit.name}</button>`)
      .join("");
    suggestions.classList.add("open");
  });
  suggestions.addEventListener("click", (event) => {
    const button = event.target.closest("button");
    if (!button) return;
    const lat = Number(button.dataset.lat);
    const lng = Number(button.dataset.lng);
    map.setView([lat, lng], state.course.scaleLocked ? map.getZoom() : 16);
    suggestions.classList.remove("open");
  });
  document.addEventListener("click", (event) => {
    if (!event.target.closest(".search")) suggestions.classList.remove("open");
  });

  document.addEventListener("keydown", (event) => {
    // 有對話框（條款／地圖來源／確認）打開時，唔可以喺後面偷偷返回、列印或轉工具。
    const modalOpen = Boolean(document.querySelector(".modal.open"));
    if (event.key === "Escape") {
      closeClearMenu();
      document.getElementById("confirm").classList.remove("open");
      document.getElementById("about").classList.remove("open");
      setTool("pan");
      return;
    }
    if (modalOpen) return;
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z") {
      if (event.target.matches("input, textarea, select")) return;
      event.preventDefault();
      if (event.shiftKey) redo();
      else undo();
      return;
    }
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "y") {
      if (event.target.matches("input, textarea, select")) return;
      event.preventDefault();
      redo();
      return;
    }
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "p") {
      event.preventDefault();
      doPrint();
      return;
    }
    // select 聚焦時打字係揀選項，唔應該當成快捷鍵
    if (event.target.matches("input, textarea, select")) return;
    const mapKey = { 1: "hm20c", 2: "countryside", 3: "imagery", s: "start", c: "control", f: "finish", m: "measure", p: "pan" };
    if (event.key.toLowerCase() === "g" && !event.metaKey) {
      document.getElementById("btn-grid").click();
      return;
    }
    if (mapKey[event.key]) {
      if (["hm20c", "countryside", "imagery"].includes(mapKey[event.key])) setLayer(mapKey[event.key]);
      else setTool(mapKey[event.key]);
    }
  });

  window.addEventListener("beforeprint", () => map.invalidateSize());
  window.addEventListener("afterprint", () => map.invalidateSize());
}

function gotoGrid() {
  const parsed = parseGridInput(document.getElementById("grid-input").value);
  if (!parsed) return toast(t("無法辨識方格坐標（請用 KK 1234 5678 格式）", "Cannot parse grid (use e.g. KK 1234 5678)"));
  const ll = fromUtm(parsed.e, parsed.n, parsed.zone);
  if (state.course.scaleLocked) map.setView([ll.lat, ll.lng], map.getZoom());
  else map.setView([ll.lat, ll.lng], 16);
  L.circleMarker([ll.lat, ll.lng], { radius: 8, color: "#d7b056" }).addTo(map);
}

function boot() {
  const params = new URLSearchParams(location.search);
  let wiped = false;
  if (params.has("reset") || params.has("clear")) {
    localStorage.removeItem(STORAGE_KEY);
    params.delete("reset");
    params.delete("clear");
    const q = params.toString();
    window.history.replaceState({}, "", location.pathname + (q ? "?" + q : "") + location.hash);
    wiped = true;
  }
  const savedAll = loadAll();
  const saved = savedAll.current;
  if (savedAll.layer) state.layer = normalizeLayer(savedAll.layer);
  if (savedAll.previewMode === "actual" || savedAll.previewMode === "fit") {
    state.previewMode = savedAll.previewMode;
  }
  if (typeof savedAll.screenWidthCm === "number" && savedAll.screenWidthCm > 0) {
    state.screenWidthCm = savedAll.screenWidthCm;
  }
  if (saved && Array.isArray(saved.controls)) state.course = normalizeCourse(saved);
  state.course.orientation = normalizeOrientation(state.course.orientation);
  const restored = hasMeaningfulCourse(state.course);

  // 支援從 download.html 跳過來：?fly=lat,lng&layer=countryside
  let flyTarget = null;
  if (params.has("layer")) {
    state.layer = normalizeLayer(params.get("layer"));
  }
  // 用過即清：第一次讀到 flyTo 就由暫存刪除，避免之後每次開頁都自動飛去同一區。
  const storedFly =
    savedAll.flyTo && Number.isFinite(savedAll.flyTo.lat) && Number.isFinite(savedAll.flyTo.lng)
      ? savedAll.flyTo
      : null;
  if (savedAll.flyTo) {
    try {
      delete savedAll.flyTo;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(savedAll));
    } catch {}
  }
  if (params.has("fly")) {
    const parts = params.get("fly").split(",").map(Number);
    if (parts.length >= 2 && Number.isFinite(parts[0]) && Number.isFinite(parts[1])) {
      flyTarget = { lat: parts[0], lng: parts[1], zoom: 13 };
    }
  } else if (storedFly) {
    flyTarget = storedFly;
  }

  renderSheets();
  bind();
  applyBasemap();
  applyPaper();
  renderCourse();
  renderMeasure();
  renderSidebar();
  syncScaleSelect();
  /* 還原上次視圖：有路線時先把第一個點放在畫面中心，否則若有 fly 參數則飛過去。 */
  if (flyTarget) {
    map.setView([flyTarget.lat, flyTarget.lng], flyTarget.zoom || 13);
    toast(t(`已切換到 ${state.layer === "countryside" ? "郊遊圖" : state.layer} 並飛往此區`, `Switched to ${state.layer} and flew to area`));
  } else if (state.course.controls[0]) map.setView([state.course.controls[0].lat, state.course.controls[0].lng], 15);
  if (state.course.scaleLocked) {
    lockScale(true);
    toast(t(`比例已鎖定 ${scaleLabel(currentScaleLock())}`, `Scale locked at ${scaleLabel(currentScaleLock())}`));
  }
  syncScaleLockButton();
  updateScaleChip();
  updateHistoryButtons();
  updateReadout(L.latLng(HK_CENTER[0], HK_CENTER[1]));
  document.getElementById("btn-grid").classList.toggle("on", state.gridOn);
  const gridCheckbox = document.getElementById("opt-grid");
  if (gridCheckbox) gridCheckbox.checked = state.gridOn;
  const gridLabelCheckbox = document.getElementById("opt-grid-labels");
  if (gridLabelCheckbox) gridLabelCheckbox.checked = state.gridLabelsOn;
  document.body.classList.toggle("leader", state.leaderOn);
  if (!localStorage.getItem(TERMS_KEY)) {
    document.getElementById("terms").classList.add("open");
  }
  if (wiped) toast(t("已清除本機暫存，從空白路線開始", "Browser draft cleared"));
  else if (restored) {
    hist.past.push({
      course: emptyCourse(),
      layer: "hm20c",
      selectedId: null,
      measure: [],
    });
    updateHistoryButtons();
    showRestore(state.course.name);
  }
  const fit = () => {
    applyPaperLayout();
    map.invalidateSize();
    renderGrid();
  };
  requestAnimationFrame(fit);
  setTimeout(fit, 250);
  window.addEventListener("resize", fit);
}

boot();
