import {
  COUNTRYSIDE_SHEETS,
  DATASETS,
  GAZETTEER,
  HK_BOUNDS,
  HK_CENTER,
  HM20C_SHEETS,
  MAG_DECLINATION_WEST,
  csdiExportLayer,
  formatDeg,
  frameBounds,
  frameValid,
  fromHk80,
  gridBearing,
  gridRefs,
  landsdUrl,
  magneticBearing,
  paperAreaMeters,
  parseGridInput,
  planarDistance,
  scaleDenominator,
  tileOptions,
  toHk80,
  zoomForScale,
} from "./hkgeo.js";
import { drawOverprint, orderedControls as orderControls } from "./overprint.js";

const STORAGE_KEY = "scout-system-courses-v1";
const TERMS_KEY = "scout-system-landsd-terms";

const state = {
  layer: "hm20c",
  tool: "pan",
  lang: "zh",
  gridOn: true,
  labelsOn: true,
  linesOn: true,
  leaderOn: false,
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
    scaleLock: 20000,
    scaleLocked: false,
    created: new Date().toISOString(),
    meet: "",
    cutoff: "",
    sos: "",
    controls: [],
  };
}

function walkMinutes(meters, countryside) {
  const mPerMin = countryside ? 60 : 80;
  return Math.max(1, Math.round(meters / mPerMin));
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
      body: t("會清空檢查點與鎖定，並覆寫本機暫存。建議先匯出 JSON。", "Clears controls and locks, and overwrites the browser draft. Export JSON first if you need it."),
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
      body: t("瀏覽器記住的路線、比例鎖定都會刪除，畫面會重新載入。未匯出的資料無法復原。條款同意會保留。", "The saved course and scale lock in this browser will be deleted and the page will reload. Unexported work cannot be recovered. Terms agreement is kept."),
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
  zoomSnap: 0, // 允許小數縮放，才能精確落在 1:5 000–1:20 000（LOCK 比例用）
  zoomControl: true,
  maxBounds: HK_BOUNDS,
  maxBoundsViscosity: 0.7,
});

const labels = L.tileLayer(landsdUrl("label", "tc"), tileOptions({ pane: "overlayPane", opacity: 0.95 }));
const basemap = L.tileLayer(landsdUrl("basemap"), tileOptions({ minZoom: 10 }));
const imagery = L.tileLayer(landsdUrl("imagery"), tileOptions({ minZoom: 10 }));

map.createPane("csdiParks");
map.getPane("csdiParks").style.zIndex = 350;
map.createPane("csdiTrails");
map.getPane("csdiTrails").style.zIndex = 360;
map.createPane("csdiPosts");
map.getPane("csdiPosts").style.zIndex = 370;

const parks = csdiExportLayer(DATASETS.parks, "csdiParks");
const trails = csdiExportLayer(DATASETS.trails, "csdiTrails");
const posts = csdiExportLayer(DATASETS.posts, "csdiPosts");

const courseLayer = L.layerGroup().addTo(map);
const measureLayer = L.layerGroup().addTo(map);
const gridLayer = L.layerGroup().addTo(map);

function applyBasemap() {
  [basemap, imagery, parks, trails, posts].forEach((l) => {
    if (map.hasLayer(l)) map.removeLayer(l);
  });
  if (state.layer === "imagery") {
    imagery.addTo(map);
  } else {
    basemap.addTo(map);
  }
  if (state.layer === "countryside") {
    parks.addTo(map);
    trails.addTo(map);
    posts.addTo(map);
  }
  if (state.labelsOn) labels.addTo(map);
  else if (map.hasLayer(labels)) map.removeLayer(labels);

  document.querySelectorAll(".basemaps button").forEach((b) => {
    b.classList.toggle("active", b.dataset.layer === state.layer);
  });
  document.getElementById("sheet-hm20c").hidden = state.layer === "countryside";
  document.getElementById("sheet-cm").hidden = state.layer !== "countryside";
  renderGrid();
}

function setLayer(id) {
  if (id !== state.layer) remember();
  state.layer = id;
  if (id === "countryside") state.course.type = "countryside";
  applyBasemap();
  renderSheetInfo();
  persist();
}

/* ---------- 紙張（設計畫布＝列印頁） ---------- */
function applyPaper() {
  const paper = state.course.paperSize || "A4";
  document.body.dataset.paper = paper;
  map.invalidateSize();
  updatePaperInfo();
}

function updatePaperInfo() {
  const el = document.getElementById("paper-info");
  if (!el) return;
  const paper = state.course.paperSize || "A4";
  const locked = !!state.course.scaleLocked;
  const s = locked ? currentScaleLock() : Math.round(scaleDenominator(map.getCenter().lat, map.getZoom()));
  const a = paperAreaMeters(paper, s);
  el.innerHTML =
    `白紙＝列印範圍：<strong>${paper} 橫向</strong> @ <strong>${scaleLabel(s)}</strong>` +
    (locked ? "（已鎖定）" : "（未鎖定，隨畫面縮放）") +
    `，紙面覆蓋約 <strong>${fmtLen(a.w)} × ${fmtLen(a.h)}</strong>。紙以外不會列印。`;
}

function fmtLen(m) {
  return m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`;
}

/* ---------- HK1980 1 km grid ---------- */
function renderGrid() {
  gridLayer.clearLayers();
  if (!state.gridOn) return;
  const b = map.getBounds();
  const sw = toHk80(b.getSouth(), b.getWest());
  const ne = toHk80(b.getNorth(), b.getEast());
  const step = map.getZoom() >= 15 ? 100 : 1000;
  const pad = step;
  const e0 = Math.floor((sw.e - pad) / step) * step;
  const e1 = Math.ceil((ne.e + pad) / step) * step;
  const n0 = Math.floor((sw.n - pad) / step) * step;
  const n1 = Math.ceil((ne.n + pad) / step) * step;
  const major = step === 1000;
  const style = {
    color: state.layer === "imagery" ? "#f3ead0" : "#5b2d86",
    weight: major ? 1 : 0.5,
    opacity: major ? 0.45 : 0.28,
    interactive: false,
  };
  const maxLines = 80;
  let count = 0;
  for (let e = e0; e <= e1 && count < maxLines; e += step, count++) {
    const a = fromHk80(e, n0);
    const c = fromHk80(e, n1);
    L.polyline(
      [
        [a.lat, a.lng],
        [c.lat, c.lng],
      ],
      style
    ).addTo(gridLayer);
    if (major && map.getZoom() >= 12) {
      const lab = fromHk80(e, Math.min(ne.n, n1) - 80);
      L.marker([lab.lat, lab.lng], {
        interactive: false,
        icon: L.divIcon({
          className: "grid-lab",
          html: `<span style="color:${style.color};font:700 10px/1 ui-monospace,monospace;opacity:.75">${Math.floor(e / 1000)}</span>`,
        }),
      }).addTo(gridLayer);
    }
  }
  count = 0;
  for (let n = n0; n <= n1 && count < maxLines; n += step, count++) {
    const a = fromHk80(e0, n);
    const c = fromHk80(e1, n);
    L.polyline(
      [
        [a.lat, a.lng],
        [c.lat, c.lng],
      ],
      style
    ).addTo(gridLayer);
    if (major && map.getZoom() >= 12) {
      const lab = fromHk80(Math.max(sw.e, e0) + 80, n);
      L.marker([lab.lat, lab.lng], {
        interactive: false,
        icon: L.divIcon({
          className: "grid-lab",
          html: `<span style="color:${style.color};font:700 10px/1 ui-monospace,monospace;opacity:.75">${Math.floor(n / 1000)}</span>`,
        }),
      }).addTo(gridLayer);
    }
  }
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
  const hk = toHk80(ll.lat, ll.lng);
  const g = gridRefs(hk.e, hk.n);
  document.getElementById("readout").innerHTML = `
    <div><span class="k">WGS84</span> <b>${ll.lat.toFixed(6)}</b>, <b>${ll.lng.toFixed(6)}</b></div>
    <div><span class="k">HK1980</span> E <b>${g.e}</b>　N <b>${g.n}</b></div>
    <div><span class="k">方格</span> 1km <b>${g.km4}</b>　100m <b>${g.fig6}</b>　10m <b>${g.fig8}</b></div>
  `;
}

const SCALE_PRESETS = [5000, 10000, 15000, 20000];

function currentScaleLock() {
  const s = Number(state.course.scaleLock);
  return SCALE_PRESETS.includes(s) ? s : 20000;
}

function formatScale(n) {
  return Math.round(n).toLocaleString("en-HK");
}

function scaleLabel(s) {
  return `1 : ${formatScale(s)}`;
}

function syncScaleSelect() {
  document.getElementById("scale-select").value = String(currentScaleLock());
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
        `<button class="sheet-btn" data-series="hm20c" data-id="${s.id}"><b>${s.id}</b>${s.name}</button>`
    )
    .join("");
  const cm = document.getElementById("cm-grid");
  cm.innerHTML = COUNTRYSIDE_SHEETS.map(
    (s) =>
      `<button class="sheet-btn" data-series="cm" data-id="${s.id}"><b>${s.id.replace("CM-", "")}</b>${s.name}</button>`
  ).join("");
}

function flySheet(series, id) {
  const list = series === "cm" ? COUNTRYSIDE_SHEETS : HM20C_SHEETS;
  const s = list.find((x) => x.id === id);
  if (!s) return;
  map.setView(s.center, state.course.scaleLocked ? map.getZoom() : s.zoom);
  document.querySelectorAll(".sheet-btn").forEach((b) => b.classList.toggle("active", b.dataset.id === id));
}

function renderSidebar() {
  document.getElementById("course-name").value = state.course.name;
  document.getElementById("course-type").value = state.course.type;
  document.getElementById("play-mode").value = state.course.playMode || "linear";
  document.getElementById("paper-size").value = state.course.paperSize || "A4";
  const stats = courseStats();
  document.getElementById("stat-dist").textContent =
    stats.dist >= 1000 ? `${(stats.dist / 1000).toFixed(2)} km` : `${Math.round(stats.dist)} m`;
  document.getElementById("stat-n").textContent = String(stats.count);
  document.getElementById("stat-legs").textContent = String(stats.legs.length);
  document.getElementById("stat-time").textContent = stats.dist
    ? `約 ${walkMinutes(stats.dist, state.course.type !== "urban")} 分鐘`
    : "—";
  document.getElementById("course-meet").value = state.course.meet || "";
  document.getElementById("course-cutoff").value = state.course.cutoff || "";
  document.getElementById("course-sos").value = state.course.sos || "";

  const stats2 = stats;
  const list = orderedControls();
  const box = document.getElementById("ctrl-list");
  if (!list.length) {
    box.innerHTML = `<div class="empty">用上方工具在白紙上放置起點 △、檢查點 ○、終點 ◎。</div>`;
  } else {
    box.innerHTML = list
      .map((c, i) => {
        const hk = toHk80(c.lat, c.lng);
        const g = gridRefs(hk.e, hk.n);
        const leg = i > 0 ? stats2.legs[i - 1] : null;
        const extra = leg
          ? `${Math.round(leg.d)} m · 方格 ${formatDeg(leg.g)} · 磁北 ${formatDeg(leg.m)}`
          : t("出發", "Start");
        return `<div class="ctrl ${c.kind}" data-id="${c.id}">
          <div class="num">${c.kind === "start" ? "△" : c.kind === "finish" ? "◎" : c.code}</div>
          <div>
            <strong>${c.name || (c.kind === "control" ? "檢查點 " + c.code : c.kind)}</strong>
            <div class="meta">${g.fig6}　${extra}</div>
          </div>
          <button class="del" data-del="${c.id}" title="刪除">×</button>
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
  const descBody = document.getElementById("desc-body");
  if (!titleEl || !metaEl || !descBody) return;
  const stats = courseStats();
  const list = orderedControls();
  titleEl.textContent = state.course.name || "定向地圖";
  const kind = state.course.type === "countryside" ? "野外／郊遊定向" : "城市定向";
  const mode = state.course.playMode === "score" ? "奪分式（自由路線）" : "越野式（按順序）";
  const distTxt = stats.dist >= 1000 ? `${(stats.dist / 1000).toFixed(2)} km` : `${Math.round(stats.dist)} m`;
  const s = state.course.scaleLocked
    ? currentScaleLock()
    : Math.round(scaleDenominator(map.getCenter().lat, map.getZoom()));
  let meta = `${kind}　·　${mode}　·　比例 ${scaleLabel(s)}${state.course.scaleLocked ? "（鎖定）" : ""}　·　${list.length} 個點　·　約 ${distTxt}　·　磁偏角 ${MAG_DECLINATION_WEST}°W`;
  if (state.course.meet) meta += `　·　集合 ${state.course.meet}`;
  if (state.course.cutoff) meta += `　·　截止 ${state.course.cutoff}`;
  if (state.course.sos) meta += `　·　緊急 ${state.course.sos}`;
  metaEl.textContent = meta;

  descBody.innerHTML = list
    .map((c, i) => {
      const hk = toHk80(c.lat, c.lng);
      const g = gridRefs(hk.e, hk.n);
      const leg = i > 0 ? `${Math.round(stats.legs[i - 1].d)} m` : "—";
      const what = c.kind === "start" ? "起點" : c.kind === "finish" ? "終點" : "檢查點";
      const score =
        state.course.playMode === "score" && c.kind === "control" ? `　·　${c.score ?? 0} 分` : "";
      return `<tr>
        <td><strong>${c.code}</strong></td>
        <td>${what}${c.name ? "　" + c.name : ""}${c.clue ? "　—　" + c.clue : ""}${score}</td>
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
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
}

function loadAll() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}

function exportCourse() {
  const blob = new Blob([JSON.stringify(state.course, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${state.course.name || "scout-course"}.scout.json`;
  a.click();
}

function exportGpx() {
  const esc = (s) =>
    String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const list = orderedControls();
  const wpts = list
    .map((c) => {
      const what = c.kind === "start" ? "起點" : c.kind === "finish" ? "終點" : "檢查點";
      const desc = [what, c.name, c.clue].filter(Boolean).join(" — ");
      return [
        `  <wpt lat="${c.lat.toFixed(6)}" lon="${c.lng.toFixed(6)}">`,
        `    <name>${esc(c.code)}</name>`,
        `    <desc>${esc(desc)}</desc>`,
        `  </wpt>`,
      ].join("\n");
    })
    .join("\n");
  const rtepts = list
    .map((c) => `    <rtept lat="${c.lat.toFixed(6)}" lon="${c.lng.toFixed(6)}"><name>${esc(c.code)}</name></rtept>`)
    .join("\n");
  const gpx = [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<gpx version="1.1" creator="Scout System" xmlns="http://www.topografix.com/GPX/1/1">`,
    `  <metadata>`,
    `    <name>${esc(state.course.name)}</name>`,
    `    <desc>${esc(state.course.type === "urban" ? "城市定向" : "野外／郊遊定向")}</desc>`,
    `  </metadata>`,
    wpts,
    `  <rte>`,
    `    <name>${esc(state.course.name)}</name>`,
    rtepts,
    `  </rte>`,
    `</gpx>`,
  ].join("\n") + "\n";
  const blob = new Blob([gpx], { type: "application/gpx+xml" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${state.course.name || "scout-course"}.gpx`;
  a.click();
}

function importCourse(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      if (!data || !Array.isArray(data.controls)) throw new Error("format");
      remember();
      const wasLocked = state.course.scaleLocked;
      state.course = { ...emptyCourse(), ...data, system: "Scout System" };
      if (!SCALE_PRESETS.includes(Number(state.course.scaleLock))) state.course.scaleLock = 20000;
      if (wasLocked && !state.course.scaleLocked) setZoomControls(true);
      applyPaper();
      renderCourse();
      renderSidebar();
      syncScaleSelect();
      persist();
      /* 舊版檔案有「圈選範圍」：對齊一次，之後以白紙為準 */
      if (frameValid(state.course.frame)) {
        map.fitBounds(frameBounds(state.course.frame), { animate: false });
      } else if (state.course.controls.length) {
        fitCourse();
      }
      if (state.course.scaleLocked) {
        lockScale(true);
        toast(t(`已匯入路線（比例已鎖定 ${scaleLabel(currentScaleLock())}）`, `Imported (scale locked at ${scaleLabel(currentScaleLock())})`));
        return;
      }
      syncScaleLockButton();
      toast(t("已匯入路線", "Course imported"));
    } catch {
      toast(t("檔案格式不正確", "Invalid file"));
    }
  };
  reader.readAsText(file);
}

/* ---------- search ---------- */
function searchPlaces(q) {
  const s = q.trim().toLowerCase();
  if (!s) return [];
  return GAZETTEER.filter(
    (p) => p.name.toLowerCase().includes(s) || p.q.toLowerCase().includes(s)
  ).slice(0, 8);
}

/* ---------- sample ---------- */
function loadSample(kind) {
  remember();
  const wasLocked = state.course.scaleLocked;
  if (wasLocked) {
    state.course.scaleLocked = false;
    setZoomControls(true);
  }
  if (kind === "urban") {
    state.layer = "hm20c";
    state.course = {
      ...emptyCourse(),
      name: "尖沙咀海濱城市定向（示範）",
      type: "urban",
      meet: "尖沙咀鐘樓",
      cutoff: "活動開始後 90 分鐘",
      sos: "領袖電話／999",
      controls: [
        { id: uid(), kind: "start", lat: 22.2939, lng: 114.1697, code: "S", name: "鐘樓", clue: "古蹟鐘樓南面空地", note: "", score: 0 },
        { id: uid(), kind: "control", lat: 22.2948, lng: 114.172, code: "31", name: "星光大道", clue: "海濱欄杆／牌匾", note: "", score: 0 },
        { id: uid(), kind: "control", lat: 22.2972, lng: 114.1691, code: "32", name: "香港文化中心", clue: "廣場旗杆附近", note: "", score: 0 },
        { id: uid(), kind: "control", lat: 22.2956, lng: 114.1665, code: "33", name: "天星碼頭", clue: "碼頭入口告示", note: "", score: 0 },
        { id: uid(), kind: "finish", lat: 22.2939, lng: 114.1697, code: "F", name: "返回鐘樓", clue: "起點集合", note: "", score: 0 },
      ],
    };
  } else {
    state.layer = "countryside";
    state.course = {
      ...emptyCourse(),
      name: "西貢北潭涌郊遊定向（示範）",
      type: "countryside",
      controls: [
        { id: uid(), kind: "start", lat: 22.3968, lng: 114.3212, code: "S", name: "北潭涌", clue: "郊野公園遊客中心附近", note: "", score: 0 },
        { id: uid(), kind: "control", lat: 22.4005, lng: 114.3238, code: "31", name: "麥理浩徑起點", clue: "徑道石碑／標距柱", note: "", score: 0 },
        { id: uid(), kind: "control", lat: 22.3982, lng: 114.3285, code: "32", name: "郊遊徑分岔", clue: "小路交匯", note: "", score: 0 },
        { id: uid(), kind: "finish", lat: 22.3968, lng: 114.3212, code: "F", name: "返回遊客中心", clue: "集合點", note: "", score: 0 },
      ],
    };
  }
  syncScaleSelect();
  syncScaleLockButton();
  applyBasemap();
  applyPaper();
  renderCourse();
  renderSidebar();
  persist();
  fitCourse();
}

/* ---------- boot ---------- */
function bind() {
  document.querySelectorAll(".basemaps button").forEach((b) => {
    b.addEventListener("click", () => setLayer(b.dataset.layer));
  });
  document.querySelectorAll(".tool").forEach((b) => {
    b.addEventListener("click", () => {
      if (b.dataset.tool === "clear-measure") {
        clearMeasure();
        return;
      }
      setTool(b.dataset.tool);
    });
  });
  document.getElementById("hm20c-grid").addEventListener("click", (e) => {
    const s = e.target.closest(".sheet-btn");
    if (s) flySheet("hm20c", s.dataset.id);
  });
  document.getElementById("cm-grid").addEventListener("click", (e) => {
    const s = e.target.closest(".sheet-btn");
    if (s) flySheet("cm", s.dataset.id);
  });
  document.getElementById("course-name").addEventListener("input", (e) => {
    rememberText();
    state.course.name = e.target.value;
    renderSheetInfo();
    persist();
  });
  document.getElementById("course-type").addEventListener("change", (e) => {
    remember();
    state.course.type = e.target.value;
    renderSheetInfo();
    persist();
  });
  document.getElementById("play-mode").addEventListener("change", (e) => {
    remember();
    state.course.playMode = e.target.value;
    renderSidebar();
    renderCourse();
    persist();
  });
  document.getElementById("paper-size").addEventListener("change", (e) => {
    remember();
    state.course.paperSize = e.target.value;
    applyPaper();
    renderSheetInfo();
    persist();
    toast(t(`紙張已改為 ${state.course.paperSize}，白紙＝列印頁`, `Paper set to ${state.course.paperSize}`));
  });
  document.getElementById("opt-lines").addEventListener("change", (e) => {
    state.linesOn = e.target.checked;
    renderCourse();
  });
  document.getElementById("opt-grid").addEventListener("change", (e) => {
    state.gridOn = e.target.checked;
    document.getElementById("btn-grid").classList.toggle("on", state.gridOn);
    renderGrid();
  });
  document.getElementById("opt-leader").addEventListener("change", (e) => {
    state.leaderOn = e.target.checked;
    document.body.classList.toggle("leader", state.leaderOn);
  });
  document.getElementById("ctrl-list").addEventListener("click", (e) => {
    const del = e.target.closest("[data-del]");
    if (del) {
      removeControl(del.dataset.del);
      return;
    }
    const row = e.target.closest(".ctrl");
    if (!row) return;
    state.selectedId = row.dataset.id;
    const c = state.course.controls.find((x) => x.id === row.dataset.id);
    if (c) map.panTo([c.lat, c.lng]);
    renderSidebar();
  });
  ["ed-code", "ed-name", "ed-clue", "ed-note", "ed-score"].forEach((id) => {
    document.getElementById(id).addEventListener("input", (e) => {
      const sel = state.course.controls.find((c) => c.id === state.selectedId);
      if (!sel) return;
      rememberText();
      const key = id.replace("ed-", "");
      sel[key] = e.target.value;
      renderCourse();
      persist();
    });
  });
  document.getElementById("btn-grid").addEventListener("click", () => {
    state.gridOn = !state.gridOn;
    document.getElementById("btn-grid").classList.toggle("on", state.gridOn);
    const cb = document.getElementById("opt-grid");
    if (cb) cb.checked = state.gridOn;
    renderGrid();
  });
  document.getElementById("btn-fit-course").addEventListener("click", fitCourse);
  document.getElementById("offpaper-chip").addEventListener("click", fitCourse);
  document.getElementById("scale-select").addEventListener("change", (e) => {
    const s = Number(e.target.value);
    if (!SCALE_PRESETS.includes(s)) return;
    remember();
    state.course.scaleLock = s;
    map.setZoom(zoomForScale(map.getCenter().lat, s), { animate: false });
    updatePaperInfo();
    renderSheetInfo();
    toast(
      state.course.scaleLocked
        ? t(`已鎖定 ${scaleLabel(s)}（縮放停用）`, `Locked at ${scaleLabel(s)}`)
        : t(`已對齊約 ${scaleLabel(s)}`, `Aligned near ${scaleLabel(s)}`)
    );
    persist();
  });
  document.getElementById("btn-scale-lock").addEventListener("click", () => {
    if (state.course.scaleLocked) {
      unlockScale();
      toast(t("比例已解鎖，可自由縮放", "Scale unlocked"));
    } else {
      lockScale();
      toast(t(`已 LOCK 死 ${scaleLabel(currentScaleLock())}：白紙上就是這個比例印出`, `Scale locked at ${scaleLabel(currentScaleLock())}`));
    }
  });
  document.getElementById("btn-locate").addEventListener("click", () => {
    if (!navigator.geolocation) return toast("此瀏覽器不支援定位");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
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
  document.getElementById("btn-export").addEventListener("click", exportCourse);
  document.getElementById("btn-gpx").addEventListener("click", exportGpx);
  ["course-meet", "course-cutoff", "course-sos"].forEach((id) => {
    document.getElementById(id).addEventListener("input", (e) => {
      rememberText();
      const key = id.replace("course-", "");
      state.course[key] = e.target.value;
      renderSheetInfo();
      persist();
    });
  });
  document.getElementById("btn-import").addEventListener("click", () => {
    document.getElementById("file-import").click();
  });
  document.getElementById("file-import").addEventListener("change", (e) => {
    const f = e.target.files[0];
    if (f) importCourse(f);
    e.target.value = "";
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
  const clearBtn = document.getElementById("btn-clear-menu");
  const closeClearMenu = () => {
    clearMenu.hidden = true;
    clearBtn.setAttribute("aria-expanded", "false");
  };
  clearBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    const open = clearMenu.hidden;
    clearMenu.hidden = !open;
    clearBtn.setAttribute("aria-expanded", open ? "true" : "false");
  });
  clearMenu.addEventListener("click", (e) => {
    const item = e.target.closest("[data-clear]");
    if (!item) return;
    closeClearMenu();
    runClearAction(item.dataset.clear);
  });
  document.addEventListener("click", (e) => {
    if (!e.target.closest(".hist-clear")) closeClearMenu();
  });
  document.getElementById("btn-sample-u").addEventListener("click", () => loadSample("urban"));
  document.getElementById("btn-sample-c").addEventListener("click", () => loadSample("country"));
  document.getElementById("btn-lang").addEventListener("click", () => {
    state.lang = state.lang === "zh" ? "en" : "zh";
    document.getElementById("btn-lang").textContent = state.lang === "zh" ? "EN" : "中";
    toast(state.lang === "zh" ? "介面以中文為主" : "Labels stay bilingual; UI notes in English");
  });
  document.getElementById("btn-goto").addEventListener("click", gotoGrid);
  document.getElementById("grid-input").addEventListener("keydown", (e) => {
    if (e.key === "Enter") gotoGrid();
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

  const q = document.getElementById("q");
  const sug = document.getElementById("suggest");
  q.addEventListener("input", () => {
    const hits = searchPlaces(q.value);
    if (!hits.length) {
      sug.classList.remove("open");
      sug.innerHTML = "";
      return;
    }
    sug.innerHTML = hits
      .map(
        (h) =>
          `<button data-lat="${h.lat}" data-lng="${h.lng}"><span class="tag">${h.tag}</span>${h.name}</button>`
      )
      .join("");
    sug.classList.add("open");
  });
  sug.addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    if (state.course.scaleLocked) map.setView([Number(b.dataset.lat), Number(b.dataset.lng)], map.getZoom());
    else map.setView([Number(b.dataset.lat), Number(b.dataset.lng)], 16);
    sug.classList.remove("open");
  });
  document.addEventListener("click", (e) => {
    if (!e.target.closest(".search")) sug.classList.remove("open");
  });

  document.addEventListener("keydown", (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
      if (e.target.matches("input, textarea")) return;
      e.preventDefault();
      if (e.shiftKey) redo();
      else undo();
      return;
    }
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "y") {
      if (e.target.matches("input, textarea")) return;
      e.preventDefault();
      redo();
      return;
    }
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "p") {
      e.preventDefault();
      doPrint();
      return;
    }
    if (e.key === "Escape") {
      closeClearMenu();
      document.getElementById("confirm").classList.remove("open");
      document.getElementById("about").classList.remove("open");
    }
    if (e.target.matches("input, textarea")) return;
    const mapKey = { 1: "hm20c", 2: "countryside", 3: "imagery", s: "start", c: "control", f: "finish", m: "measure", p: "pan", Escape: "pan" };
    if (e.key === "g" && !e.metaKey) {
      document.getElementById("btn-grid").click();
      return;
    }
    if (mapKey[e.key] && ["hm20c", "countryside", "imagery"].includes(mapKey[e.key])) setLayer(mapKey[e.key]);
    else if (mapKey[e.key]) setTool(mapKey[e.key]);
  });

  window.addEventListener("beforeprint", () => map.invalidateSize());
  window.addEventListener("afterprint", () => map.invalidateSize());
}

function gotoGrid() {
  const parsed = parseGridInput(document.getElementById("grid-input").value);
  if (!parsed) return toast(t("無法辨識方格坐標", "Cannot parse grid"));
  const ll = fromHk80(parsed.e, parsed.n);
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
  if (savedAll.layer) state.layer = savedAll.layer;
  if (saved && Array.isArray(saved.controls)) state.course = { ...emptyCourse(), ...saved };
  const restored = hasMeaningfulCourse(state.course) || frameValid(state.course.frame);
  renderSheets();
  bind();
  applyBasemap();
  applyPaper();
  renderCourse();
  renderMeasure();
  renderSidebar();
  syncScaleSelect();
  /* 還原上次視圖：舊版「圈選範圍」對齊一次；否則對齊路線第一點 */
  if (frameValid(state.course.frame)) {
    map.fitBounds(frameBounds(state.course.frame), { animate: false });
  } else if (state.course.controls[0]) {
    map.setView([state.course.controls[0].lat, state.course.controls[0].lng], 15);
  }
  if (state.course.scaleLocked) {
    lockScale(true);
    toast(t(`比例已鎖定 ${scaleLabel(currentScaleLock())}`, `Scale locked at ${scaleLabel(currentScaleLock())}`));
  }
  syncScaleLockButton();
  updateScaleChip();
  updateHistoryButtons();
  updateReadout(L.latLng(HK_CENTER[0], HK_CENTER[1]));
  document.getElementById("btn-grid").classList.toggle("on", state.gridOn);
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
  const fit = () => map.invalidateSize();
  requestAnimationFrame(fit);
  setTimeout(fit, 250);
  window.addEventListener("resize", fit);
}

boot();
