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
  fromHk80,
  gridBearing,
  gridRefs,
  landsdUrl,
  magneticBearing,
  parseGridInput,
  planarDistance,
  scaleDenominator,
  tileOptions,
  toHk80,
  zoomForScale,
} from "./hkgeo.js";
import { drawOverprint } from "./overprint.js";

const STORAGE_KEY = "scout-system-courses-v1";
const TERMS_KEY = "scout-system-landsd-terms";

const state = {
  layer: "hm20c",
  tool: "pan",
  lang: "zh",
  gridOn: true,
  labelsOn: true,
  course: emptyCourse(),
  selectedId: null,
  measure: [],
};

function emptyCourse() {
  return {
    version: 1,
    system: "Scout System",
    name: "未命名定向路線",
    type: "urban",
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

/* ---------- map ---------- */
const map = L.map("map", {
  center: HK_CENTER,
  zoom: 13,
  minZoom: 10,
  maxZoom: 20,
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
  state.layer = id;
  if (id === "countryside") state.course.type = "countryside";
  if (id === "hm20c" && state.course.type === "countryside") {
    /* keep */
  }
  applyBasemap();
  persist();
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
  const starts = state.course.controls.filter((c) => c.kind === "start");
  const mids = state.course.controls.filter((c) => c.kind === "control");
  const fins = state.course.controls.filter((c) => c.kind === "finish");
  return [...starts, ...mids, ...fins];
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
    lines: true,
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
  renderPrintTable();
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
  };
  state.course.controls.push(ctrl);
  state.selectedId = ctrl.id;
  renderCourse();
  renderSidebar();
  persist();
}

function removeControl(id) {
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
map.on("click", (e) => {
  if (state.tool === "start" || state.tool === "control" || state.tool === "finish") {
    addControl(e.latlng.lat, e.latlng.lng, state.tool);
    return;
  }
  if (state.tool === "measure") {
    state.measure.push({ lat: e.latlng.lat, lng: e.latlng.lng });
    renderMeasure();
  }
});

map.on("mousemove", (e) => updateReadout(e.latlng));
map.on("moveend zoomend", () => {
  renderGrid();
  updateScaleChip();
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

function updateScaleChip() {
  const c = map.getCenter();
  const scale = scaleDenominator(c.lat, map.getZoom());
  document.getElementById("scale-chip").textContent = `比例 1 : ${Math.round(scale).toLocaleString("en-HK")}`;
}

function setTool(tool) {
  state.tool = tool;
  document.querySelectorAll(".tool").forEach((b) => b.classList.toggle("active", b.dataset.tool === tool));
  const cursor =
    tool === "pan" ? "" : tool === "delete" ? "not-allowed" : "crosshair";
  map.getContainer().style.cursor = cursor;
  if (tool !== "measure") {
    /* keep last measure until cleared */
  }
}

/* ---------- sidebar ---------- */
function renderSheets() {
  const hm = document.getElementById("hm20c-grid");
  hm.innerHTML = HM20C_SHEETS.filter((s) => s.id !== "1")
    .map(
      (s) =>
        `<button class="sheet" data-series="hm20c" data-id="${s.id}"><b>${s.id}</b>${s.name}</button>`
    )
    .join("");
  const cm = document.getElementById("cm-grid");
  cm.innerHTML = COUNTRYSIDE_SHEETS.map(
    (s) =>
      `<button class="sheet" data-series="cm" data-id="${s.id}"><b>${s.id.replace("CM-", "")}</b>${s.name}</button>`
  ).join("");
}

function flySheet(series, id) {
  const list = series === "cm" ? COUNTRYSIDE_SHEETS : HM20C_SHEETS;
  const s = list.find((x) => x.id === id);
  if (!s) return;
  map.setView(s.center, s.zoom);
  document.querySelectorAll(".sheet").forEach((b) => b.classList.toggle("active", b.dataset.id === id));
}

function renderSidebar() {
  document.getElementById("course-name").value = state.course.name;
  document.getElementById("course-type").value = state.course.type;
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

  const list = orderedControls();
  const box = document.getElementById("ctrl-list");
  if (!list.length) {
    box.innerHTML = `<div class="empty">用上方工具在地圖上放置起點 △、檢查點 ○、終點 ◎。</div>`;
  } else {
    box.innerHTML = list
      .map((c, i) => {
        const hk = toHk80(c.lat, c.lng);
        const g = gridRefs(hk.e, hk.n);
        const leg = i > 0 ? stats.legs[i - 1] : null;
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
  }
}

function renderPrintTable() {
  const stats = courseStats();
  const list = orderedControls();
  const rows = list
    .map((c, i) => {
      const hk = toHk80(c.lat, c.lng);
      const g = gridRefs(hk.e, hk.n);
      const leg = i > 0 ? stats.legs[i - 1] : null;
      return `<tr>
        <td>${c.code}</td>
        <td>${c.kind === "start" ? "起點" : c.kind === "finish" ? "終點" : "檢查點"}</td>
        <td>${c.name || ""}</td>
        <td>${c.clue || ""}</td>
        <td>${g.full}</td>
        <td>${g.fig6}</td>
        <td>${leg ? Math.round(leg.d) + " m" : "—"}</td>
        <td>${leg ? formatDeg(leg.g) : "—"}</td>
      </tr>`;
    })
    .join("");
  document.getElementById("print-body").innerHTML = `
    <h2>Scout System　${state.course.name}</h2>
    <p>類型：${state.course.type === "urban" ? "城市定向" : "野外／郊遊定向"}　·　總距 ${
      stats.dist >= 1000 ? (stats.dist / 1000).toFixed(2) + " km" : Math.round(stats.dist) + " m"
    }　·　估計步行 ${walkMinutes(stats.dist, state.course.type !== "urban")} 分鐘　·　磁偏角 ${MAG_DECLINATION_WEST}°W　·　© Scout System</p>
    <p>集合／撤退：${state.course.meet || "（未填）"}　·　截止：${state.course.cutoff || "（未填）"}　·　緊急：${state.course.sos || "（未填）"}</p>
    <p>底圖：地政總署地形圖 API（對應 HM20C／免費 iB20000 數碼地形圖）${
      state.layer === "countryside" ? "；郊遊圖層：漁農自然護理署（CSDI）" : ""
    }。Map from Lands Department.</p>
    <table>
      <thead><tr><th>編號</th><th>種類</th><th>名稱</th><th>提示</th><th>HK1980</th><th>100m 方格</th><th>段距</th><th>方格方位</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  `;
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

function importCourse(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      if (!data || !Array.isArray(data.controls)) throw new Error("format");
      state.course = { ...emptyCourse(), ...data, system: "Scout System" };
      renderCourse();
      renderSidebar();
      persist();
      if (state.course.controls[0]) {
        map.setView([state.course.controls[0].lat, state.course.controls[0].lng], 15);
      }
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
  if (kind === "urban") {
    state.layer = "hm20c";
    state.course = {
      version: 1,
      system: "Scout System",
      name: "尖沙咀海濱城市定向（示範）",
      type: "urban",
      created: new Date().toISOString(),
      meet: "尖沙咀鐘樓",
      cutoff: "活動開始後 90 分鐘",
      sos: "領袖電話／999",
      controls: [
        { id: uid(), kind: "start", lat: 22.2939, lng: 114.1697, code: "S", name: "鐘樓", clue: "古蹟鐘樓南面空地", note: "" },
        { id: uid(), kind: "control", lat: 22.2948, lng: 114.172, code: "31", name: "星光大道", clue: "海濱欄杆／牌匾", note: "" },
        { id: uid(), kind: "control", lat: 22.2972, lng: 114.1691, code: "32", name: "香港文化中心", clue: "廣場旗杆附近", note: "" },
        { id: uid(), kind: "control", lat: 22.2956, lng: 114.1665, code: "33", name: "天星碼頭", clue: "碼頭入口告示", note: "" },
        { id: uid(), kind: "finish", lat: 22.2939, lng: 114.1697, code: "F", name: "返回鐘樓", clue: "起點集合", note: "" },
      ],
    };
    map.setView([22.2952, 114.1695], 16);
  } else {
    state.layer = "countryside";
    state.course = {
      version: 1,
      system: "Scout System",
      name: "西貢北潭涌郊遊定向（示範）",
      type: "countryside",
      created: new Date().toISOString(),
      controls: [
        { id: uid(), kind: "start", lat: 22.3968, lng: 114.3212, code: "S", name: "北潭涌", clue: "郊野公園遊客中心附近", note: "" },
        { id: uid(), kind: "control", lat: 22.4005, lng: 114.3238, code: "31", name: "麥理浩徑起點", clue: "徑道石碑／標距柱", note: "" },
        { id: uid(), kind: "control", lat: 22.3982, lng: 114.3285, code: "32", name: "郊遊徑分岔", clue: "小路交匯", note: "" },
        { id: uid(), kind: "finish", lat: 22.3968, lng: 114.3212, code: "F", name: "返回遊客中心", clue: "集合點", note: "" },
      ],
    };
    map.setView([22.398, 114.324], 15);
  }
  applyBasemap();
  renderCourse();
  renderSidebar();
  persist();
}

/* ---------- boot ---------- */
function bind() {
  document.querySelectorAll(".basemaps button").forEach((b) => {
    b.addEventListener("click", () => setLayer(b.dataset.layer));
  });
  document.querySelectorAll(".tool").forEach((b) => {
    b.addEventListener("click", () => {
      if (b.dataset.tool === "clear-measure") {
        state.measure = [];
        renderMeasure();
        return;
      }
      setTool(b.dataset.tool);
    });
  });
  document.getElementById("hm20c-grid").addEventListener("click", (e) => {
    const s = e.target.closest(".sheet");
    if (s) flySheet("hm20c", s.dataset.id);
  });
  document.getElementById("cm-grid").addEventListener("click", (e) => {
    const s = e.target.closest(".sheet");
    if (s) flySheet("cm", s.dataset.id);
  });
  document.getElementById("course-name").addEventListener("input", (e) => {
    state.course.name = e.target.value;
    persist();
  });
  document.getElementById("course-type").addEventListener("change", (e) => {
    state.course.type = e.target.value;
    persist();
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
  ["ed-code", "ed-name", "ed-clue", "ed-note"].forEach((id) => {
    document.getElementById(id).addEventListener("input", (e) => {
      const sel = state.course.controls.find((c) => c.id === state.selectedId);
      if (!sel) return;
      const key = id.replace("ed-", "");
      sel[key] = e.target.value;
      renderCourse();
      persist();
    });
  });
  document.getElementById("btn-grid").addEventListener("click", () => {
    state.gridOn = !state.gridOn;
    document.getElementById("btn-grid").classList.toggle("on", state.gridOn);
    renderGrid();
  });
  document.getElementById("btn-scale").addEventListener("click", () => {
    const z = zoomForScale(map.getCenter().lat, 20000);
    map.setZoom(z);
    toast(t("已對齊約 1:20 000（HM20C 比例）", "Locked near 1:20 000"));
  });
  document.getElementById("btn-locate").addEventListener("click", () => {
    if (!navigator.geolocation) return toast("此瀏覽器不支援定位");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        map.setView([latitude, longitude], 16);
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
  document.getElementById("btn-print").addEventListener("click", () => {
    persist();
    window.location.href = "print.html";
  });
  document.getElementById("btn-export").addEventListener("click", exportCourse);
  document.getElementById("btn-gpx").addEventListener("click", exportGpx);
  ["course-meet", "course-cutoff", "course-sos"].forEach((id) => {
    document.getElementById(id).addEventListener("input", (e) => {
      const key = id.replace("course-", "");
      state.course[key] = e.target.value;
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
  document.getElementById("btn-new").addEventListener("click", () => {
    if (!confirm(t("開新路線？未匯出的檢查點會留在本機暫存。", "Start a new course?"))) return;
    state.course = emptyCourse();
    state.selectedId = null;
    renderCourse();
    renderSidebar();
    persist();
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
    map.setView([Number(b.dataset.lat), Number(b.dataset.lng)], 16);
    sug.classList.remove("open");
  });
  document.addEventListener("click", (e) => {
    if (!e.target.closest(".search")) sug.classList.remove("open");
  });

  document.addEventListener("keydown", (e) => {
    if (e.target.matches("input, textarea")) return;
    const mapKey = { 1: "hm20c", 2: "countryside", 3: "imagery", s: "start", c: "control", f: "finish", m: "measure", p: "pan", g: "grid", Escape: "pan" };
    if (e.key === "g" && !e.metaKey) {
      document.getElementById("btn-grid").click();
      return;
    }
    if (mapKey[e.key] && ["hm20c", "countryside", "imagery"].includes(mapKey[e.key])) setLayer(mapKey[e.key]);
    else if (mapKey[e.key]) setTool(mapKey[e.key] === "grid" ? state.tool : mapKey[e.key]);
  });
}

function gotoGrid() {
  const parsed = parseGridInput(document.getElementById("grid-input").value);
  if (!parsed) return toast(t("無法辨識方格坐標", "Cannot parse grid"));
  const ll = fromHk80(parsed.e, parsed.n);
  map.setView([ll.lat, ll.lng], 16);
  L.circleMarker([ll.lat, ll.lng], { radius: 8, color: "#d7b056" }).addTo(map);
}

function boot() {
  const saved = loadAll().current;
  if (saved && Array.isArray(saved.controls)) state.course = { ...emptyCourse(), ...saved };
  renderSheets();
  bind();
  applyBasemap();
  renderCourse();
  renderSidebar();
  updateScaleChip();
  updateReadout(L.latLng(HK_CENTER[0], HK_CENTER[1]));
  document.getElementById("btn-grid").classList.toggle("on", state.gridOn);
  if (!localStorage.getItem(TERMS_KEY)) {
    document.getElementById("terms").classList.add("open");
  }
  const fit = () => map.invalidateSize();
  requestAnimationFrame(fit);
  setTimeout(fit, 250);
  window.addEventListener("resize", fit);
}

boot();
