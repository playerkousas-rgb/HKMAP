import {
  DATASETS,
  MAG_DECLINATION_WEST,
  csdiExportLayer,
  frameBounds,
  frameValid,
  fromHk80,
  gridBearing,
  gridRefs,
  landsdUrl,
  planarDistance,
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
  const distTxt = dist >= 1000 ? `${(dist / 1000).toFixed(2)} km` : `${Math.round(dist)} m`;
  meta.textContent = `${kind}　·　${list.length} 個點　·　約 ${distTxt}　·　磁偏角 ${MAG_DECLINATION_WEST}°W`;
  if (course?.meet) meta.textContent += `　·　集合 ${course.meet}`;
  if (course?.cutoff) meta.textContent += `　·　截止 ${course.cutoff}`;
  if (frameValid(course?.frame)) meta.textContent += "　·　按策劃者圈選範圍出圖";

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
        <td>${what}${c.name ? "　" + c.name : ""}${c.clue ? "　—　" + c.clue : ""}</td>
        <td class="leader-only">${g.full}</td>
        <td class="leader-only">${g.fig6}</td>
        <td>${leg}</td>
      </tr>`;
    })
    .join("");
}

function fit() {
  const list = orderedControls(course?.controls || []);
  const scale = Number(document.getElementById("scale").value);
  if (frameValid(course?.frame)) {
    map.fitBounds(frameBounds(course.frame), { padding: [6, 6], animate: false });
  } else if (list.length) {
    const bounds = L.latLngBounds(list.map((c) => [c.lat, c.lng])).pad(0.35);
    map.fitBounds(bounds, { animate: false });
    map.setZoom(zoomForScale(map.getCenter().lat, scale), { animate: false });
  } else {
    map.setView([22.302, 114.172], 15);
  }
  map.invalidateSize();
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
