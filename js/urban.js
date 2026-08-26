/**
 * 城市定向地圖標記：建築、鋪面、街道設施與通行特徵。
 * 這些是疊加在官方底圖上的規劃標記，不會修改底圖資料。
 */

const COLORS = {
  black: "#000000",
  blue: "#2E6FB6",
  green: "#1F5E1A",
};

/** 城市面狀特徵。 */
export const URBAN_RUN = {
  building: { t: "建築物（不可過）", color: "#6f6f6f", opacity: 0.92, edge: "#000000" },
  paved: { t: "鋪面／硬地", color: "#d2d2d2", opacity: 0.82, edge: null },
  openUrban: { t: "草地／開闊地", color: "#FFEB00", opacity: 0.72, edge: null },
  impassVeg: { t: "不能通行植被", color: COLORS.green, opacity: 0.9, edge: "#10360C" },
  outOfBounds: { t: "禁區", color: "#b3a01e", opacity: 0.5, edge: "#000000" },
};

/** 城市點狀特徵。 */
export const URBAN_POINT = {
  statue: { t: "紀念碑／塑像", shape: "dot", color: COLORS.black, base: 9 },
  tower: { t: "塔／高塔", shape: "dot", color: COLORS.black, base: 9 },
  fountain: { t: "噴泉／水池", shape: "ring", color: COLORS.blue, base: 10 },
  distinctTree: { t: "獨樹", shape: "tree", color: "#2E7D32", base: 12 },
  manmade: { t: "人造特徵", shape: "square", color: COLORS.black, base: 8 },
  passage: { t: "通道／隧道口", shape: "ring", color: COLORS.black, base: 9 },
};

/** 城市線狀特徵。 */
export const URBAN_LINE = {
  passWall: { t: "可過牆", color: COLORS.black, weight: 2 },
  impassWall: { t: "不可過牆", color: COLORS.black, weight: 4 },
  passFence: { t: "可過圍欄", color: COLORS.black, weight: 1.6, dashArray: "3 3" },
  impassFence: { t: "不可過圍欄", color: COLORS.black, weight: 2.4 },
  stairs: { t: "樓梯", color: COLORS.black, weight: 2, dashArray: "1 2.5" },
  railing: { t: "欄桿", color: COLORS.black, weight: 1.6, dashArray: "1 2" },
  pipeline: { t: "管道", color: COLORS.black, weight: 1.6, dashArray: "2 3" },
  passRoad: { t: "可通行路徑", color: COLORS.black, weight: 2.4 },
};

const ALL_RUN = URBAN_RUN;
const ALL_POINT = URBAN_POINT;
const ALL_LINE = URBAN_LINE;

export function isUrbanAnnotation(ann) {
  if (!ann || !Array.isArray(ann.latlngs) || !ann.latlngs.length) return false;
  if (ann.type === "fill") return Boolean(ALL_RUN[ann.sym]);
  if (ann.type === "point") return Boolean(ALL_POINT[ann.sym]);
  if (ann.type === "line") return Boolean(ALL_LINE[ann.sym]);
  return false;
}

/** 點符號的 HTML，按 shape 畫方、圓、環或樹。 */
function pointHTML(p, size) {
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

/**
 * 由城市標記物件產生 Leaflet 圖層。
 * opts: { pointScale=1, interactive=false, draggable=false }
 */
export function annotationLayer(ann, L, opts = {}) {
  if (!isUrbanAnnotation(ann)) return null;
  const ps = opts.pointScale || 1;
  const inter = opts.interactive !== false;
  if (ann.type === "fill") {
    const r = ALL_RUN[ann.sym];
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
    const p = ALL_POINT[ann.sym];
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
  const line = ALL_LINE[ann.sym];
  return L.polyline(ann.latlngs, {
    pane: "ann",
    color: line.color,
    weight: (line.weight || 2) * (0.7 + ps * 0.3),
    dashArray: line.dashArray,
    interactive: inter,
  });
}
