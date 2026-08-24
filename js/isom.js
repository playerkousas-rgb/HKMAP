/**
 * ISOM 2017-2 地圖符號 — 微地形／可跑性標記(畫喺地圖上面)
 * 色版依 ISOM 2017-2「Colour and Runnability」:
 *   白=典型可跑林地(405) · 黃=開闢地(401) · 黃50%=粗糙開闢地(403)
 *   綠30%=慢跑能見(407) · 綠=慢跑(406) · 綠60%=難行(408/410) · 深綠=不能行(411)
 * 這套用嚟喺政府底圖上加可跑性同微地形,唔係提示符號(提示符號喺 iof.js)。
 *
 * 每個符號比 Leaflet 直接用嘅樣式;繪圖工具用面(多邊形)/點/線三種。
 */

// 棕(地貌)／黑(石/人造)／綠(植被)／藍(水) 標準色
export const ISOM = {
  brown: "#AC7B2A",
  black: "#000000",
  darkGreen: "#1F5E1A",
  blue: "#2E6FB6",
};

/** 可跑性面(多邊形填色)。color=填色、edge=邊線(可選)。 */
export const RUNNABILITY = {
  forest: {
    t: "林地(可跑)",
    en: "Forest, runnable",
    sym: "405",
    color: "#FFFFFF",
    opacity: 0.82,
    edge: "#cfcfcf",
  },
  open: {
    t: "開闢地",
    en: "Open land",
    sym: "401",
    color: "#FFEB00",
    opacity: 0.82,
    edge: null,
  },
  roughOpen: {
    t: "粗糙開闢地",
    en: "Rough open land",
    sym: "403",
    color: "#FFF083",
    opacity: 0.85,
    edge: null,
  },
  slowVis: {
    t: "慢跑(能見)",
    en: "Slow running, good visibility",
    sym: "407",
    color: "#BCDB93",
    opacity: 0.85,
    edge: null,
  },
  slow: {
    t: "慢跑(密)",
    en: "Slow running",
    sym: "406",
    color: "#7CB342",
    opacity: 0.82,
    edge: null,
  },
  walk: {
    t: "難行/步行",
    en: "Walk",
    sym: "408",
    color: "#4E8A33",
    opacity: 0.85,
    edge: null,
  },
  fight: {
    t: "不能通行",
    en: "Fight / impassable",
    sym: "411",
    color: "#1F5E1A",
    opacity: 0.9,
    edge: "#10360C",
  },
};

/** 點狀微地形(按一下即蓋印)。shape: dot/square/ring/tree;color=色;base=基準直徑(px@1:15k)。 */
export const POINT_SYM = {
  boulder: { t: "大石", shape: "dot", color: ISOM.black, base: 9 },
  knoll: { t: "小丘", shape: "dot", color: ISOM.brown, base: 8 },
  smallKnoll: { t: "細小丘", shape: "dot", color: ISOM.brown, base: 5 },
  depression: { t: "陷地", shape: "ring", color: ISOM.brown, base: 11 },
  distinctTree: { t: "獨樹", shape: "tree", color: "#2E7D32", base: 12 },
  pit: { t: "地洞", shape: "ring", color: ISOM.brown, base: 10 },
  building: { t: "建築物", shape: "square", color: ISOM.black, base: 12 },
  cairn: { t: "石標", shape: "dot", color: ISOM.black, base: 6 },
};

/** 點符號的 HTML(放喺 divIcon 內),按 shape 畫方/圓/環/樹。 */
export function pointHTML(p, size) {
  const box = "display:block;width:100%;height:100%;box-sizing:border-box;";
  if (p.shape === "square")
    return `<span style="${box}background:${p.color}"></span>`;
  if (p.shape === "ring") {
    const w = Math.max(1.2, size * 0.16);
    return `<span style="${box}border-radius:50%;border:${w}px solid ${p.color}"></span>`;
  }
  if (p.shape === "tree") {
    const inset = Math.max(1, size * 0.16);
    return `<span style="${box}position:relative"><span style="position:absolute;inset:0;border-radius:50%;background:#fff"></span><span style="position:absolute;inset:${inset}px;border-radius:50%;background:${p.color}"></span></span>`;
  }
  return `<span style="${box}border-radius:50%;background:${p.color}"></span>`;
}

/** 線狀特徵。Leaflet polyline 樣式。 */
export const LINE_SYM = {
  vegBoundary: { t: "林界", color: ISOM.darkGreen, weight: 2.2, dashArray: "5 4" },
  cliff: { t: "崖／峭壁", color: ISOM.black, weight: 3.2 },
  earthBank: { t: "土堤", color: ISOM.brown, weight: 2.6 },
  earthWall: { t: "土牆", color: ISOM.brown, weight: 2, dashArray: "2 3" },
  path: { t: "小徑", color: ISOM.black, weight: 2, dashArray: "6 4" },
  ride: { t: "林中間隙", color: ISOM.black, weight: 1.6, dashArray: "8 4" },
  stream: { t: "河溪", color: ISOM.blue, weight: 2.4 },
  wall: { t: "石牆", color: ISOM.black, weight: 2 },
};

/* ============ 城市定向 ISSprOM(獨立符號集,與 ISOM 分開,不混用)============ */

/** 城市面狀(建築/鋪面/禁區等)。 */
export const URBAN_RUN = {
  building: { t: "建築物(不可過)", color: "#6f6f6f", opacity: 0.92, edge: "#000000" },
  paved: { t: "鋪面／硬地", color: "#d2d2d2", opacity: 0.82, edge: null },
  openUrban: { t: "草地／開闊地", color: "#FFEB00", opacity: 0.72, edge: null },
  impassVeg: { t: "不能通行植被", color: "#1F5E1A", opacity: 0.9, edge: "#10360C" },
  outOfBounds: { t: "禁區", color: "#b3a01e", opacity: 0.5, edge: "#000000" },
};

/** 城市點狀特徵。 */
export const URBAN_POINT = {
  statue: { t: "紀念碑／塑像", shape: "dot", color: ISOM.black, base: 9 },
  tower: { t: "塔／高塔", shape: "dot", color: ISOM.black, base: 9 },
  fountain: { t: "噴泉／水池", shape: "ring", color: ISOM.blue, base: 10 },
  distinctTreeU: { t: "獨樹", shape: "tree", color: "#2E7D32", base: 12 },
  manmade: { t: "人造特徵", shape: "square", color: ISOM.black, base: 8 },
  passage: { t: "通道／隧道口", shape: "ring", color: ISOM.black, base: 9 },
};

/** 城市線狀特徵(牆/圍欄/樓梯等,可過 vs 不可過)。 */
export const URBAN_LINE = {
  passWall: { t: "可過牆", color: ISOM.black, weight: 2 },
  impassWall: { t: "不可過牆", color: ISOM.black, weight: 4 },
  passFence: { t: "可過圍欄", color: ISOM.black, weight: 1.6, dashArray: "3 3" },
  impassFence: { t: "不可過圍欄", color: ISOM.black, weight: 2.4 },
  stairs: { t: "樓梯", color: ISOM.black, weight: 2, dashArray: "1 2.5" },
  railing: { t: "欄桿", color: ISOM.black, weight: 1.6, dashArray: "1 2" },
  pipeline: { t: "管道", color: ISOM.black, weight: 1.6, dashArray: "2 3" },
  passRoad: { t: "可跑路徑", color: ISOM.black, weight: 2.4 },
};

// 合併查表(給 annotationLayer 用;兩套各自命名不衝突)
const ALL_RUN = { ...RUNNABILITY, ...URBAN_RUN };
const ALL_POINT = { ...POINT_SYM, ...URBAN_POINT };
const ALL_LINE = { ...LINE_SYM, ...URBAN_LINE };

/**
 * 由一個標記物件產生對應嘅 Leaflet 圖層(放喺 "ann" pane,低於 CP 套印)。
 * opts: { pointScale=1, interactive=false, draggable=false }
 */
export function annotationLayer(ann, L, opts = {}) {
  const ps = opts.pointScale || 1;
  const inter = opts.interactive !== false;
  if (ann.type === "fill") {
    const r = ALL_RUN[ann.sym] || RUNNABILITY.forest;
    return L.polygon(ann.latlngs, {
      pane: "ann",
      color: r.edge || "rgba(0,0,0,0.25)",
      weight: r.edge ? 1 : 0.6,
      fillColor: r.color,
      fillOpacity: r.opacity,
      interactive: inter,
    });
  }
  if (ann.type === "point") {
    const p = ALL_POINT[ann.sym] || POINT_SYM.boulder;
    const size = Math.max(4, (p.base || 10) * ps);
    return L.marker(ann.latlngs[0], {
      pane: "ann",
      keyboard: false,
      interactive: inter,
      draggable: !!opts.draggable,
      icon: L.divIcon({
        className: "ann-pt-wrap",
        html: pointHTML(p, size),
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
      }),
    });
  }
  if (ann.type === "line") {
    const l = ALL_LINE[ann.sym] || LINE_SYM.vegBoundary;
    return L.polyline(ann.latlngs, {
      pane: "ann",
      color: l.color,
      weight: (l.weight || 2) * (0.7 + ps * 0.3),
      dashArray: l.dashArray,
      interactive: inter,
    });
  }
  return null;
}
