/**
 * npm run smoke — 用最小 DOM／Leaflet 替身真正「開一次 app」，行完成條使用者流程。
 *
 * 目的：確保改版之後核心功能冇壞（唔需要瀏覽器、唔需要 jsdom／puppeteer）。
 * 流程：載入 → 放 △ ○ ◎ → 拖移 → 改檢查點資料 → 返回／重做 → 鎖比例 → 改紙張／方向
 *      → 白紙外警告 → 列印 → 方格跳轉 → 搜尋 → 切底圖 → 清除暫存。
 */
import { Report, expect, expectEqual } from "./lib.mjs";

const report = new Report("smoke");
let mapFireCount = 0;

/* ---------- 最小 DOM ---------- */
function createElement(tag = "div") {
  const classes = new Set();
  const el = {
    tagName: String(tag).toUpperCase(),
    id: "",
    _handlers: {},
    _attrs: {},
    value: "",
    textContent: "",
    innerHTML: "",
    hidden: false,
    disabled: false,
    checked: false,
    title: "",
    children: [],
    dataset: {},
    clientWidth: 0,
    clientHeight: 0,
    selectionStart: 0,
    selectionEnd: 0,
    style: { setProperty(name, value) { this[name] = value; }, removeProperty() {} },
    classList: {
      add: (...c) => c.forEach((x) => classes.add(x)),
      remove: (...c) => c.forEach((x) => classes.delete(x)),
      contains: (c) => classes.has(c),
      toggle: (c, force) => {
        const on = force === undefined ? !classes.has(c) : Boolean(force);
        if (on) classes.add(c);
        else classes.delete(c);
        return on;
      },
    },
    addEventListener(type, fn) {
      (this._handlers[type] ||= []).push(fn);
    },
    removeEventListener() {},
    dispatch(type, event = {}) {
      for (const fn of this._handlers[type] || []) fn({ target: this, type, ...event });
    },
    setAttribute(name, value) {
      this._attrs[name] = String(value);
      if (name === "id") this.id = String(value);
    },
    getAttribute(name) {
      return this._attrs[name] ?? null;
    },
    appendChild(child) {
      this.children.push(child);
      if (child && child.id) byId.set(child.id, child);
      return child;
    },
    querySelectorAll: () => [],
    querySelector: () => null,
    closest: () => null,
    matches: () => false,
    focus() {
      documentStub.activeElement = this;
    },
    remove() {},
  };
  return el;
}

const byId = new Map();
const getEl = (id) => {
  if (!byId.has(id)) {
    const el = createElement("div");
    el.id = id;
    byId.set(id, el);
  }
  return byId.get(id);
};

const toolButtons = ["pan", "start", "control", "finish", "measure", "delete", "clear-measure"].map((tool) => {
  const el = createElement("button");
  el.dataset.tool = tool;
  return el;
});
const basemapButtons = ["hm20c", "countryside", "imagery"].map((layer) => {
  const el = createElement("button");
  el.dataset.layer = layer;
  return el;
});
const mapwrap = createElement("main");
mapwrap.clientWidth = 1200;
mapwrap.clientHeight = 800;

const documentStub = {
  activeElement: null,
  body: createElement("body"),
  head: createElement("head"),
  documentElement: createElement("html"),
  getElementById: getEl,
  querySelectorAll(selector) {
    if (selector === ".tool") return toolButtons;
    if (selector === ".basemaps button") return basemapButtons;
    return [];
  },
  querySelector(selector) {
    if (selector === ".mapwrap") return mapwrap;
    return this.querySelectorAll(selector)[0] || null;
  },
  createElement,
  addEventListener(type, fn) {
    (this._handlers ||= {});
    (this._handlers[type] ||= []).push(fn);
  },
  dispatch(type, event = {}) {
    for (const fn of this._handlers?.[type] || []) fn({ type, ...event });
  },
};

/* ---------- localStorage／window ---------- */
const store = new Map();
globalThis.localStorage = {
  getItem: (key) => (store.has(key) ? store.get(key) : null),
  setItem: (key, value) => store.set(key, String(value)),
  removeItem: (key) => store.delete(key),
  clear: () => store.clear(),
};

let printed = 0;
const navigations = [];
globalThis.document = documentStub;
globalThis.location = { href: "http://localhost:8080/index.html", search: "", pathname: "/index.html", hash: "" };
Object.defineProperty(globalThis.location, "href", {
  get: () => globalThis.location._href || "http://localhost:8080/index.html",
  set: (value) => {
    navigations.push(value);
    globalThis.location._href = value;
  },
});
// Node 21+ 有唯讀的 navigator，要用 defineProperty 覆寫
Object.defineProperty(globalThis, "navigator", {
  configurable: true,
  writable: true,
  value: { geolocation: { getCurrentPosition: (ok) => ok({ coords: { latitude: 22.3, longitude: 114.17 } }) } },
});
globalThis.requestAnimationFrame = (fn) => setTimeout(fn, 0);
globalThis.window = {
  screen: { width: 1512 },
  innerWidth: 1512,
  innerHeight: 900,
  print: () => { printed += 1; },
  history: { replaceState() {} },
  location: globalThis.location,
  addEventListener(type, fn) {
    (this._handlers ||= {});
    (this._handlers[type] ||= []).push(fn);
  },
};

/* ---------- Leaflet 替身 ---------- */
function installLeaflet(geo) {
  const boundsOf = (map) => {
    const center = map.getCenter();
    const mpp = geo.metersPerPixel(center.lat, map.getZoom());
    const halfW = (mapwrap.clientWidth / 2) * mpp;
    const halfH = (mapwrap.clientHeight / 2) * mpp;
    const dLat = halfH / 111132;
    const dLng = halfW / (111320 * Math.cos((center.lat * Math.PI) / 180));
    const south = center.lat - dLat;
    const north = center.lat + dLat;
    const west = center.lng - dLng;
    const east = center.lng + dLng;
    return {
      getSouth: () => south,
      getNorth: () => north,
      getWest: () => west,
      getEast: () => east,
      getCenter: () => ({ lat: (south + north) / 2, lng: (west + east) / 2 }),
      contains: (ll) => {
        const [lat, lng] = Array.isArray(ll) ? ll : [ll.lat, ll.lng];
        return lat >= south && lat <= north && lng >= west && lng <= east;
      },
      pad: (ratio) => {
        const dLatPad = (north - south) * ratio;
        const dLngPad = (east - west) * ratio;
        return boundsOfFrom(south - dLatPad, west - dLngPad, north + dLatPad, east + dLngPad);
      },
    };
  };
  const boundsOfFrom = (south, west, north, east) => ({
    getSouth: () => south,
    getNorth: () => north,
    getWest: () => west,
    getEast: () => east,
    getCenter: () => ({ lat: (south + north) / 2, lng: (west + east) / 2 }),
    contains: (ll) => {
      const [lat, lng] = Array.isArray(ll) ? ll : [ll.lat, ll.lng];
      return lat >= south && lat <= north && lng >= west && lng <= east;
    },
    pad: (ratio) => boundsOfFrom(south - (north - south) * ratio, west - (east - west) * ratio, north + (north - south) * ratio, east + (east - west) * ratio),
  });

  const layers = new Set();
  const handlers = {};
  const map = {
    __center: { lat: 22.352, lng: 114.158 },
    __zoom: 13,
    on(names, fn) {
      for (const name of names.split(" ")) (handlers[name] ||= []).push(fn);
      return this;
    },
    off() { return this; },
    fire(name, data = {}) {
      mapFireCount += 1;
      if (mapFireCount > 500) throw new Error("地圖事件疑似無限循環");
      for (const fn of handlers[name] || []) fn(data);
      return this;
    },
    getCenter: () => ({ ...map.__center }),
    getZoom: () => map.__zoom,
    setZoom(zoom, options) {
      const changed = Math.abs(zoom - map.__zoom) > 1e-9;
      map.__zoom = zoom;
      if (changed && !options?.animate) this.fire("zoomend");
      if (changed) this.fire("moveend");
      return this;
    },
    setView(latlng, zoom) {
      map.__center = Array.isArray(latlng) ? { lat: latlng[0], lng: latlng[1] } : { ...latlng };
      if (typeof zoom === "number") map.__zoom = zoom;
      this.fire("zoomend");
      this.fire("moveend");
      return this;
    },
    panTo(latlng) {
      map.__center = Array.isArray(latlng) ? { lat: latlng[0], lng: latlng[1] } : { ...latlng };
      this.fire("moveend");
      return this;
    },
    fitBounds(bounds) {
      const center = bounds.getCenter();
      const rad = (center.lat * Math.PI) / 180;
      const heightMeters = (bounds.getNorth() - bounds.getSouth()) * 111132;
      const widthMeters = (bounds.getEast() - bounds.getWest()) * 111320 * Math.cos(rad);
      const needed = Math.max(heightMeters, widthMeters);
      const mppNeeded = needed / Math.min(mapwrap.clientWidth, mapwrap.clientHeight);
      const mppAtZoom = (z) => (156543.03392804097 * Math.cos(rad)) / 2 ** z;
      let zoom = Math.log2(156543.03392804097 * Math.cos(rad) / mppNeeded);
      while (zoom > 10 && mppAtZoom(zoom) * mapwrap.clientHeight < heightMeters) zoom -= 0.01;
      map.__center = { lat: center.lat, lng: center.lng };
      map.__zoom = Math.max(10, Math.min(zoom, 20));
      this.fire("zoomend");
      this.fire("moveend");
      return this;
    },
    getBounds: () => boundsOf(map),
    invalidateSize() { return this; },
    getContainer: () => ({ style: { cursor: "" } }),
    hasLayer: (layer) => layers.has(layer),
    addLayer(layer) { layers.add(layer); return this; },
    removeLayer(layer) { layers.delete(layer); return this; },
    _panes: {},
    zoomControl: { enable() {}, disable() {} },
    dragging: { enable() {}, disable() {} },
    scrollWheelZoom: { enable() {}, disable() {} },
    boxZoom: { enable() {}, disable() {} },
    doubleClickZoom: { enable() {}, disable() {} },
    touchZoom: { enable() {}, disable() {} },
    keyboard: { enable() {}, disable() {} },
  };

  const markers = [];
  const L = {
    map: () => map,
    tileLayer: (url) => ({ url, addTo: () => L.tileLayer(url) }),
    layerGroup: () => ({
      clearLayers() {},
      addLayer() { return this; },
      addTo: () => L.layerGroup(),
    }),
    polyline: (points, style) => ({ points, style, addTo: () => ({ points, style }) }),
    marker: (latlng, options) => {
      const marker = {
        latlng: { lat: latlng[0], lng: latlng[1] },
        options,
        handlers: {},
        on(name, fn) {
          (this.handlers[name] ||= []).push(fn);
          return this;
        },
        getLatLng: () => marker.latlng,
        setLatLng(next) { marker.latlng = next; return marker; },
        addTo: () => marker,
      };
      markers.push(marker);
      return marker;
    },
    circleMarker: () => ({ addTo: () => ({}) }),
    tooltip: () => ({ setLatLng() { return this; }, setContent() { return this; }, addTo() { return this; } }),
    divIcon: (options) => ({ ...options }),
    latLng: (lat, lng) => ({ lat, lng }),
    latLngBounds: (list) => {
      const lats = list.map((p) => (Array.isArray(p) ? p[0] : p.lat));
      const lngs = list.map((p) => (Array.isArray(p) ? p[1] : p.lng));
      return boundsOfFrom(Math.min(...lats), Math.min(...lngs), Math.max(...lats), Math.max(...lngs));
    },
    DomEvent: { stopPropagation() {} },
    __map: map,
    __markers: markers,
  };
  globalThis.L = L;
  return L;
}

/* ---------- 開 app ---------- */
const STORAGE_KEY_ = "scout-system-courses-v1";
if (process.env.SMOKE_SEED === "1") {
  // 模擬舊版暫存：有 frame、type=classic、CP 有已棄用嘅 cd 欄位
  store.set(
    STORAGE_KEY_,
    JSON.stringify({
      layer: "countryside",
      previewMode: "fit",
      screenWidthCm: 34,
      current: {
        version: 1,
        system: "Scout System",
        name: "舊路線",
        type: "classic",
        frame: { a: 1 },
        scaleLock: 20000,
        scaleLocked: false,
        controls: [
          { id: "a1", kind: "start", lat: 22.2944, lng: 114.1694, code: "S", name: "起點", clue: "", note: "", score: 0 },
          { id: "b2", kind: "control", lat: 22.3, lng: 114.18, code: "12", name: "舊 CP", clue: "舊說明", note: "", score: 5, cd: "legacy" },
          { id: "c3", kind: "control", lat: 22.31, lng: 114.19, code: "13", name: "", clue: "", note: "", score: 0, cd: "legacy" },
        ],
      },
    })
  );
}

const { install } = await import("./fake-proj4.mjs");
install();
const geo = await import("../js/hkgeo.js");
const L = installLeaflet(geo);
await import("../js/app.js");
L.__map.fire("moveend"); // 模擬第一次佈局完成後嘅事件

const el = getEl;
const STORAGE_KEY = "scout-system-courses-v1";

if (process.env.SMOKE_SEED === "1") {
  // 還原舊暫存：路線、底圖、螢幕設定都要回來，舊欄位要清走
  expectEqual(report, el("restore-bar").hidden, false, "有暫存就要顯示還原提示");
  expect(report, el("restore-msg").textContent.includes("舊路線"), "還原提示要講出路線名");
  expectEqual(report, el("course-name").value, "舊路線", "要還原路線名");
  expectEqual(report, el("stat-n").textContent, "2", "要還原 2 個檢查點");
  expectEqual(report, el("stat-legs").textContent, "2", "要還原 2 段路");
  expect(report, !el("restore-bar").hidden, "還原提示要一直顯示到使用者操作");
  expectEqual(report, documentStub.body.dataset.preview, "fit", "要還原螢幕預覽模式");
  expectEqual(report, el("screen-calib").value, 34, "要還原螢幕寬度校準");
  expectEqual(report, el("scale-select").value, "20000", "比例選單要顯示還原嘅 1:20000");
  expectEqual(report, basemapButtons.find((b) => b.dataset.layer === "countryside").classList.contains("active"), true, "要還原郊遊圖底圖");
  expectEqual(report, el("restore-keep").hidden, false, "還原提示要有「繼續編輯」");
  el("restore-keep").dispatch("click");
  expectEqual(report, el("restore-bar").hidden, true, "按繼續編輯要收埋還原提示");
  el("btn-undo").dispatch("click");
  expectEqual(report, JSON.parse(localStorage.getItem(STORAGE_KEY)).current.controls.length, 0, "還原後要可以返回空白路線");
  el("btn-redo").dispatch("click");
  expectEqual(report, JSON.parse(localStorage.getItem(STORAGE_KEY)).current.controls.length, 3, "重做要還原返 3 個點");
  // 任何一次操作都會改寫暫存：舊格式欄位應該被清走（normalizeCourse）
  el("play-mode").value = "score";
  el("play-mode").dispatch("change");
  expectEqual(report, documentStub.body.classList.contains("score-mode"), true, "奪分式要加 body.score-mode");
  const restored = JSON.parse(localStorage.getItem(STORAGE_KEY)).current;
  expectEqual(report, restored.type, "urban", "舊 classic 路線要轉城市定向");
  expectEqual(report, "frame" in restored, false, "已棄用嘅 frame 欄位要清走");
  expectEqual(report, "cd" in restored.controls[1], false, "已棄用嘅 CP cd 欄位要清走");
  report.note(`舊暫存還原成功：${el("stat-dist").textContent}、${el("stat-time").textContent}`);
  const seededOk = report.print();
  process.exitCode = seededOk ? 0 : 1;
  process.exit(process.exitCode);
}

const savedAll = () => JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
const place = (tool, lat, lng) => {
  el("btn-tool") && null;
  toolButtons.find((b) => b.dataset.tool === tool).dispatch("click");
  L.__map.fire("click", { latlng: { lat, lng } });
};

/* ---------- 1. 開機狀態 ---------- */
expect(report, el("terms").classList.contains("open"), "首次使用要自動彈出地圖 API 條款");
expect(report, /KK \d{4} \d{4}|\d{2}Q [A-Z]{2} \d{4} \d{4}/.test(el("readout").innerHTML), "即時坐標要有 KK／QK 方格");
expect(report, el("hm20c-grid").innerHTML.includes("沙田"), "側欄要列出 HM20C 圖幅");
expect(report, el("scale-select").innerHTML.includes("1 : 20,000"), "比例選單要有 1:20,000");
el("terms-ok").dispatch("click");
expect(report, !el("terms").classList.contains("open"), "按「我已閱讀」要關閉條款");

/* ---------- 2. 放起點／CP／終點 ---------- */
place("start", 22.2944, 114.1694);
place("control", 22.3, 114.18);
place("finish", 22.31, 114.19);
const course = savedAll().current;
expectEqual(report, course.controls.length, 3, "三個點都要入暫存");
expectEqual(report, course.controls.filter((c) => c.kind === "control")[0].code, "31", "第一個 CP 代碼由 31 開始");
expectEqual(report, el("stat-n").textContent, "1", "檢查點統計＝1");
expectEqual(report, el("stat-legs").textContent, "2", "路段統計＝2");
expect(report, /km|m$/.test(el("stat-dist").textContent), "要有路線長度");
expect(report, el("stat-time").textContent.includes("分鐘"), "要有估計步行時間");
expectEqual(report, (el("ctrl-list").innerHTML.match(/class="ctrl/g) || []).length, 3, "側欄列出 3 個點");
expect(
  report,
  ["起點", "檢查點", "終點"].every((label) => el("desc-body").innerHTML.includes(label)),
  "檢查點說明表要有起點／檢查點／終點"
);
expect(report, el("desc-body").innerHTML.includes("31"), "說明表要有 CP 編號");
report.note(`路線總長 ${el("stat-dist").textContent}、估計 ${el("stat-time").textContent}`);

/* ---------- 3. 編輯檢查點資料 ---------- */
const cpId = savedAll().current.controls.find((c) => c.kind === "control").id;
el("ctrl-list").dispatch("click", {
  target: {
    closest: (sel) => (sel === "[data-del]" ? null : sel === ".ctrl" ? { dataset: { id: cpId } } : null),
  },
});
expectEqual(report, el("editor").hidden, false, "按側欄 CP 要打開編輯器");
el("ed-code").value = "CP-7";
el("ed-code").dispatch("input");
el("ed-name").value = "鐘樓";
el("ed-name").dispatch("input");
el("ed-clue").value = "公園入口告示板";
el("ed-clue").dispatch("input");
el("ed-score").value = "20";
el("ed-score").dispatch("input");
const edited = savedAll().current.controls.find((c) => c.kind === "control");
expectEqual(report, [edited.code, edited.name, edited.clue, edited.score], ["CP-7", "鐘樓", "公園入口告示板", 20], "檢查點資料要即時入暫存");
expectEqual(report, typeof edited.score, "number", "分值要保持數字型別");
expect(report, el("desc-body").innerHTML.includes("公園入口告示板"), "說明表要印出檢查點說明");

/* ---------- 4. 拖移標記 + 返回／重做 ---------- */
const before = savedAll().current.controls.find((c) => c.kind === "control");
const cpMarker = [...L.__markers].reverse().find((m) => (m.options.icon?.html || "").includes("course-control"));
expect(report, Boolean(cpMarker), "要搵到 CP 標記");
const marker = cpMarker;
for (const handler of marker.handlers.dragstart || []) handler();
marker.setLatLng({ lat: before.lat + 0.004, lng: before.lng + 0.004 });
for (const handler of marker.handlers.dragend || []) handler();
const moved = savedAll().current.controls.find((c) => c.id === before.id);
expect(report, Boolean(moved), "拖移後 CP 仍然存在（唔會被刪）");
expect(report, Math.abs(moved.lat - before.lat - 0.004) < 1e-9, "拖移後經緯度要更新");
el("btn-undo").dispatch("click");
const undone = savedAll().current.controls.find((c) => c.id === before.id);
expect(report, Math.abs(undone.lat - before.lat) < 1e-9, "「返回」要還原拖移");
el("btn-redo").dispatch("click");
expect(report, Math.abs(savedAll().current.controls.find((c) => c.id === before.id).lat - moved.lat) < 1e-9, "「重做」要再套用");

/* ---------- 5. 比例（LOCK／解鎖／自訂） ---------- */
el("btn-scale-lock").dispatch("click");
const lockedCourse = savedAll().current;
expectEqual(report, lockedCourse.scaleLocked, true, "鎖定比例要入暫存");
expect(report, el("btn-scale-lock").textContent.includes("解鎖"), "鎖定後按鈕要變成解鎖");
expect(report, el("scale-chip").textContent.includes("🔒"), "比例晶片要顯示鎖定");
const expectedZoom = geo.zoomForScale(L.__map.getCenter().lat, 5000);
expect(report, Math.abs(L.__map.getZoom() - expectedZoom) < 1e-6, "鎖定 1:5000 要對齊螢幕縮放");
el("scale-select").value = "20000";
el("scale-select").dispatch("change");
expectEqual(report, savedAll().current.scaleLock, 20000, "選單改比例要入暫存");
el("scale-select").value = "2500";
el("scale-select").dispatch("change");
el("btn-scale-lock").dispatch("click");
expectEqual(report, savedAll().current.scaleLocked, false, "再按要解鎖");
el("scale-custom").value = "6000";
el("btn-scale-custom").dispatch("click");
expectEqual(report, savedAll().current.scaleLock, 6000, "自訂比例 1:6000 要生效");
el("scale-custom").value = "999999";
el("btn-scale-custom").dispatch("click");
expectEqual(report, savedAll().current.scaleLock, 6000, "超出範圍的自訂比例要拒絕");

/* ---------- 6. 紙張／方向／螢幕模式 ---------- */
el("paper-size").value = "A3";
el("paper-size").dispatch("change");
expectEqual(report, documentStub.body.dataset.paper, "A3", "紙張要套用到 body");
el("paper-orientation").value = "portrait";
el("paper-orientation").dispatch("change");
expectEqual(report, documentStub.body.dataset.orientation, "portrait", "方向要套用到 body");
const pageRule = el("dyn-page").textContent;
expect(report, pageRule.includes("297mm 420mm"), `@page 規則要跟紙張（得到 ${pageRule}）`);
el("paper-size").value = "A4";
el("paper-size").dispatch("change");
el("paper-orientation").value = "landscape";
el("paper-orientation").dispatch("change");
expect(report, el("dyn-page").textContent.includes("297mm 210mm"), "@page 要回到 A4 橫向");
el("screen-preview").value = "fit";
el("screen-preview").dispatch("change");
expectEqual(report, documentStub.body.dataset.preview, "fit", "螢幕預覽模式要生效");
expectEqual(report, savedAll().previewMode, "fit", "螢幕預覽模式要入暫存");
el("screen-calib").value = "34.4";
el("screen-calib").dispatch("input");
expectEqual(report, savedAll().screenWidthCm, 34.4, "螢幕寬度校準要入暫存");

/* ---------- 7. 方格選項／路線名稱／集合資料 ---------- */
el("opt-grid").checked = false;
el("opt-grid").dispatch("change");
expectEqual(report, el("btn-grid").classList.contains("on"), false, "關閉方格網要同步晶片狀態");
el("opt-grid").checked = true;
el("opt-grid").dispatch("change");
el("btn-grid").dispatch("click");
expectEqual(report, el("opt-grid").checked, false, "晶片要同步方格 checkbox");
el("btn-grid").dispatch("click");
el("opt-leader").checked = true;
el("opt-leader").dispatch("change");
expect(report, documentStub.body.classList.contains("leader"), "領袖版要加 body.leader");
el("course-name").value = "測試路線 A&B <1>";
el("course-name").dispatch("input");
expectEqual(report, savedAll().current.name, "測試路線 A&B <1>", "路線名稱要入暫存");
expect(report, el("sheet-title").textContent === "測試路線 A&B <1>", "圖名用 textContent（唔會爛 HTML）");
expect(report, !el("desc-body").innerHTML.includes("<1>"), "說明表內的使用者文字要轉義");
el("course-meet").value = "鐘樓";
el("course-meet").dispatch("input");
expect(report, el("sheet-meta").textContent.includes("集合 鐘樓"), "集合點要印在圖名下方");

/* ---------- 8. 底圖切換 ---------- */
basemapButtons.find((b) => b.dataset.layer === "countryside").dispatch("click");
expectEqual(report, savedAll().layer, "countryside", "切郊遊圖要入暫存");
expect(report, basemapButtons.find((b) => b.dataset.layer === "countryside").classList.contains("active"), "郊遊圖按鈕要 active");
basemapButtons.find((b) => b.dataset.layer === "imagery").dispatch("click");
expectEqual(report, savedAll().layer, "imagery", "切航空照片要入暫存");
basemapButtons.find((b) => b.dataset.layer === "hm20c").dispatch("click");

/* ---------- 9. 方格跳轉 + 搜尋 + 我的位置 ---------- */
el("grid-input").value = "KK 0794 6642";
el("btn-goto").dispatch("click");
const gotoCenter = L.__map.getCenter();
expect(
  report,
  Math.abs(gotoCenter.lat - 22.2788) < 0.01 && Math.abs(gotoCenter.lng - 114.1658) < 0.01,
  `前往 KK 0794 6642 要去到童軍中心（得到 ${gotoCenter.lat.toFixed(4)}, ${gotoCenter.lng.toFixed(4)}）`
);
el("q").value = "沙田";
el("q").dispatch("input");
expect(report, el("suggest").innerHTML.includes("沙田大會堂"), "搜尋建議要有沙田大會堂");
el("suggest").dispatch("click", {
  target: { closest: (sel) => (sel === "button" ? { dataset: { lat: "22.3815", lng: "114.1898" } } : null) },
});
expect(report, Math.abs(L.__map.getCenter().lat - 22.3815) < 1e-6, "按搜尋建議要跳去該地點");
el("btn-locate").dispatch("click");
expect(report, Math.abs(L.__map.getCenter().lng - 114.17) < 1e-6, "「我的位置」要跟瀏覽器定位");

/* ---------- 10. 白紙外警告 + 列印 ---------- */
place("control", 22.5, 114.4); // 遠離紙面
L.__map.fire("moveend");
expectEqual(report, el("offpaper-chip").hidden, false, "有檢查點在白紙外要出警告");
expect(report, el("offpaper-chip").textContent.includes("白紙外"), "警告文字要講清楚");
printed = 0;
el("btn-print").dispatch("click");
await new Promise((resolve) => setTimeout(resolve, 60));
expect(report, el("confirm").classList.contains("open"), "有檢查點在白紙外，列印前要先問");
el("confirm-no").dispatch("click");
await new Promise((resolve) => setTimeout(resolve, 260));
expectEqual(report, printed, 0, "取消就唔可以列印");
el("offpaper-chip").dispatch("click"); // 對齊路線（比例未鎖定 → fitBounds）
L.__map.fire("moveend");
expectEqual(report, el("offpaper-chip").hidden, true, "對齊路線後唔應該再有白紙外警告");
el("btn-print").dispatch("click");
await new Promise((resolve) => setTimeout(resolve, 260));
expectEqual(report, printed, 1, "白紙內列印要即刻開列印對話框");

/* ---------- 11. 快捷鍵 + 對話框保護 + 清除檢查點 + 清除暫存 ---------- */
const gridWasOn = el("btn-grid").classList.contains("on");
el("btn-clear-cps").dispatch("click"); // 開確認對話框
expect(report, el("confirm").classList.contains("open"), "清除檢查點要先確認");
documentStub.querySelector = (selector) => (selector === ".modal.open" ? el("confirm") : selector === ".mapwrap" ? mapwrap : null);
printed = 0;
documentStub.dispatch("keydown", { key: "g", ctrlKey: false, target: { matches: () => false }, preventDefault() {} });
expectEqual(report, el("btn-grid").classList.contains("on"), gridWasOn, "對話框打開時快捷鍵 G 唔可以轉方格網");
documentStub.dispatch("keydown", { key: "p", ctrlKey: true, target: { matches: () => false }, preventDefault() {} });
await new Promise((resolve) => setTimeout(resolve, 260));
expectEqual(report, printed, 0, "對話框打開時 Ctrl+P 唔可以列印");
documentStub.dispatch("keydown", { key: "z", ctrlKey: true, target: { matches: () => false }, preventDefault() {} });
expectEqual(report, el("confirm").classList.contains("open"), true, "對話框打開時 Ctrl+Z 唔應該在背後返回");
documentStub.dispatch("keydown", { key: "Escape", target: { matches: () => false }, preventDefault() {} });
expectEqual(report, el("confirm").classList.contains("open"), false, "Escape 要關閉對話框");
documentStub.querySelector = (selector) => (selector === ".mapwrap" ? mapwrap : null);

const rowsBefore = (el("ctrl-list").innerHTML.match(/class="ctrl/g) || []).length;
documentStub.dispatch("keydown", { key: "z", ctrlKey: true, shiftKey: false, target: { matches: () => false }, preventDefault() {} });
expectEqual(report, (el("ctrl-list").innerHTML.match(/class="ctrl/g) || []).length, rowsBefore - 1, "Ctrl+Z 要返回上一動");
el("btn-clear-cps").dispatch("click");
expect(report, el("confirm").classList.contains("open"), "清除檢查點要確認");
el("confirm-yes").dispatch("click");
await new Promise((resolve) => setTimeout(resolve, 20));
expectEqual(report, savedAll().current.controls.length, 0, "確認後要清空檢查點");
el("btn-wipe").dispatch("click");
el("confirm-yes").dispatch("click");
await new Promise((resolve) => setTimeout(resolve, 20));
expectEqual(report, store.has(STORAGE_KEY), false, "清除本機暫存要真的清空");
expect(report, navigations.length === 1, "清除暫存後要重新載入頁面");

/* ---------- 12. 善後 ---------- */
expect(report, mapFireCount < 500, `地圖事件次數合理（${mapFireCount}）`);
const ok = report.print();
process.exitCode = ok ? 0 : 1;
