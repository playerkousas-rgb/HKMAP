import {
  DATASETS,
  MAG_DECLINATION_WEST,
  csdiExportLayer,
  frameBounds,
  frameSize,
  frameValid,
  fromHk80,
  gridBearing,
  gridRefs,
  landsdUrl,
  paperAreaMeters,
  planarDistance,
  scaleDenominator,
  tileOptions,
  toHk80,
  zoomForScale,
} from "./hkgeo.js";
import { drawOverprint, orderedControls } from "./overprint.js";

const STORAGE_KEY = "scout-system-courses-v1";

function loadState() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}

const saved = loadState();
const course = saved.current;
const layerId = saved.layer || (course?.type === "countryside" ? "countryside" : "hm20c");
if (course) document.body.dataset.paper = course.paperSize || "A4";
if (course?.playMode === "score") document.body.classList.add("score-mode");

/* 設計頁鎖定／選定的標準比例，預設帶入列印（例如 LOCK 死 1:20 000）。 */
const SCALE_PRESETS = [5000, 10000, 15000, 20000];
const scaleSel = document.getElementById("scale");
if (course?.scaleLock && SCALE_PRESETS.includes(Number(course.scaleLock))) {
  scaleSel.value = String(course.scaleLock);
}

const title = document.getElementById("title");
const meta = document.getElementById("meta");
const descBody = document.getElementById("desc-body");

if (!course || !Array.isArray(course.controls) || !course.controls.length) {
  title.textContent = "未有路線";
  meta.textContent = "請先返回設計頁，在地圖上放置起點、檢查點與終點。";
} else {
  title.textContent = course.name || "定向地圖";
}

const map = L.map("print-map", {
  zoomControl: false,
  attributionControl: true,
  minZoom: 10,
  maxZoom: 20,
  zoomSnap: 0, // 精確比例出圖（避免四捨五入成 1:18 990 之類）
});
const labels = L.tileLayer(landsdUrl("label", "tc"), tileOptions({ opacity: 0.95 }));
const basemap = L.tileLayer(landsdUrl("basemap"), tileOptions());
const imagery = L.tileLayer(landsdUrl("imagery"), tileOptions());
map.createPane("csdiParks");
map.getPane("csdiParks").style.zIndex = 350;
map.createPane("csdiTrails");
map.getPane("csdiTrails").style.zIndex = 360;
const parks = csdiExportLayer(DATASETS.parks, "csdiParks");
const trails = csdiExportLayer(DATASETS.trails, "csdiTrails");
const gridLayer = L.layerGroup().addTo(map);
const courseLayer = L.layerGroup().addTo(map);

if (layerId === "imagery") imagery.addTo(map);
else basemap.addTo(map);
if (layerId === "countryside") {
  parks.addTo(map);
  trails.addTo(map);
}
labels.addTo(map);

function statsOf(list) {
  const legs = [];
  let dist = 0;
  for (let i = 1; i < list.length; i++) {
    const d = planarDistance(list[i - 1], list[i]);
    dist += d;
    legs.push({ d, g: gridBearing(list[i - 1], list[i]) });
  }
  return { dist, legs };
}

let lastScale = null; // 實際出圖比例（fit() 後更新），印在圖上
let lastFrameNote = false;

function renderSheet() {
  const list = orderedControls(course?.controls || []);
  const showLines = document.getElementById("opt-lines").checked;
  drawOverprint(courseLayer, list, { draggable: false, lines: showLines, weight: 3 });

  gridLayer.clearLayers();
  if (document.getElementById("opt-grid").checked && list.length) {
    const lats = list.map((c) => c.lat);
    const lngs = list.map((c) => c.lng);
    const sw = toHk80(Math.min(...lats) - 0.01, Math.min(...lngs) - 0.01);
    const ne = toHk80(Math.max(...lats) + 0.01, Math.max(...lngs) + 0.01);
    const step = 1000;
    const e0 = Math.floor(sw.e / step) * step;
    const e1 = Math.ceil(ne.e / step) * step;
    const n0 = Math.floor(sw.n / step) * step;
    const n1 = Math.ceil(ne.n / step) * step;
    const style = { color: "#5b2d86", weight: 1, opacity: 0.35, interactive: false };
    for (let e = e0; e <= e1; e += step) {
      const a = fromHk80(e, n0);
      const b = fromHk80(e, n1);
      L.polyline(
        [
          [a.lat, a.lng],
          [b.lat, b.lng],
        ],
        style
      ).addTo(gridLayer);
    }
    for (let n = n0; n <= n1; n += step) {
      const a = fromHk80(e0, n);
      const b = fromHk80(e1, n);
      L.polyline(
        [
          [a.lat, a.lng],
          [b.lat, b.lng],
        ],
        style
      ).addTo(gridLayer);
    }
  }

  const { dist, legs } = statsOf(list);
  const kind = course?.type === "countryside" ? "野外／郊遊定向" : "城市定向";
  const mode = course?.playMode === "score" ? "奪分式（自由設計路線）" : "越野式（按順序到檢查點）";
  const distTxt = dist >= 1000 ? `${(dist / 1000).toFixed(2)} km` : `${Math.round(dist)} m`;
  meta.textContent = `${kind}　·　${mode}　·　${list.length} 個點　·　約 ${distTxt}　·　磁偏角 ${MAG_DECLINATION_WEST}°W`;
  if (course?.meet) meta.textContent += `　·　集合 ${course.meet}`;
  if (course?.cutoff) meta.textContent += `　·　截止 ${course.cutoff}`;
  if (frameValid(course?.frame)) meta.textContent += "　·　按策劃者圈選範圍出圖";
  if (lastScale) {
    const sTxt = `1 : ${Math.round(lastScale).toLocaleString("en-HK")}`;
    meta.textContent += lastFrameNote
      ? `　·　⚠ 圈選範圍超出選定比例，已放大裝入範圍（實際 ${sTxt}）`
      : `　·　比例 ${sTxt}`;
  }

  const leader = document.getElementById("opt-coords").checked;
  document.body.classList.toggle("leader", leader);
  descBody.innerHTML = list
    .map((c, i) => {
      const hk = toHk80(c.lat, c.lng);
      const g = gridRefs(hk.e, hk.n);
      const leg = i > 0 ? `${Math.round(legs[i - 1].d)} m` : "—";
      const what = c.kind === "start" ? "起點" : c.kind === "finish" ? "終點" : "檢查點";
      return `<tr>
        <td><strong>${c.code}</strong></td>
        <td>${what}${c.name ? "　" + c.name : ""}${c.clue ? "　—　" + c.clue : ""}${course?.playMode === "score" && c.kind === "control" ? `　·　${c.score ?? 0} 分` : ""}</td>
        <td class="leader-only">${g.full}</td>
        <td class="leader-only">${g.fig6}</td>
        <td>${leg}</td>
      </tr>`;
    })
    .join("");
}

function effectiveScale() {
  return scaleDenominator(map.getCenter().lat, map.getZoom());
}

function fit() {
  const list = orderedControls(course?.controls || []);
  const scale = Number(scaleSel.value);
  let frameNote = false;
  if (frameValid(course?.frame)) {
    /* 優先按選定（LOCK）比例出圖；判斷是否裝得下用「實際列印頁」尺寸
       （landscape、8 mm 頁邊距），不是螢幕預覽框。裝得下就精確到該
       比例，裝不下才退回「放大裝入範圍」，避免 1:18 990 這類怪比例。 */
    const f = course.frame;
    const { w, h } = frameSize(f);
    const center = [(f.south + f.north) / 2, (f.west + f.east) / 2];
    const z = zoomForScale(center[0], scale);
    const area = paperAreaMeters(course.paperSize || "A4", scale);
    const fits = w <= area.w - 40 && h <= area.h - 40; // 留約 2 mm 邊
    if (fits) {
      map.setView(center, z, { animate: false });
    } else {
      map.fitBounds(frameBounds(course.frame), { padding: [6, 6], animate: false });
      frameNote = true;
    }
  } else if (list.length) {
    const bounds = L.latLngBounds(list.map((c) => [c.lat, c.lng])).pad(0.35);
    map.fitBounds(bounds, { animate: false });
    map.setZoom(zoomForScale(map.getCenter().lat, scale), { animate: false });
  } else {
    map.setView([22.302, 114.172], 15);
  }
  map.invalidateSize();
  lastScale = effectiveScale();
  lastFrameNote = frameNote;
  renderSheet();
}

document.getElementById("scale").addEventListener("change", fit);
document.getElementById("opt-grid").addEventListener("change", renderSheet);
document.getElementById("opt-lines").addEventListener("change", renderSheet);
document.getElementById("opt-coords").addEventListener("change", renderSheet);
document.getElementById("btn-print").addEventListener("click", () => {
  map.invalidateSize();
  setTimeout(() => window.print(), 250);
});
window.addEventListener("beforeprint", () => map.invalidateSize());

fit();
setTimeout(fit, 400);
