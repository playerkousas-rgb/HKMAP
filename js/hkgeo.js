/**
 * Scout System — Hong Kong geodesy, official map layers, sheet indexes.
 * Map tiles: Lands Department Map API (Topographic / Imagery / Labels).
 */
export const MAG_DECLINATION_WEST = 3.1; // degrees, approx. 2026 Hong Kong（UTM 方格北↔磁北修正）
export const LANDSD_API = "https://mapapi.geodata.gov.hk/gs/api/v1.0.0";

export const HK_BOUNDS = [
  [22.13, 113.80],
  [22.58, 114.51],
];

export const HK_CENTER = [22.352, 114.158];

/* ---------- HM20C / UTM 方格（zone 49Q / 50Q，KK · JK · HE · GE）----------
 * 紙本 HM20C 與童軍慣用的「KK 1234 5678」8 位方格，採用 UTM（環球橫墨卡托）
 * 100 km 方格。香港橫跨 114° 子午線：以西 UTM zone 49（GE／HE），以東 zone 50（JK／KK）。
 * 轉換方式與另一 app drawtheroute 一致；童軍不習慣 HK1980，故全面改用此制。 */
export const UTM49_PROJ = "+proj=utm +zone=49 +datum=WGS84 +units=m +no_defs";
export const UTM50_PROJ = "+proj=utm +zone=50 +datum=WGS84 +units=m +no_defs";

/** MGRS 100 km 方格（香港範圍）。eastBase = 方格西邊的 UTM 東距；row = 北距字母行。 */
export const UTM_SQUARES = {
  GE: { zone: 49, eastBase: 700000, row: "E" },
  HE: { zone: 49, eastBase: 800000, row: "E" },
  JK: { zone: 50, eastBase: 100000, row: "K" },
  KK: { zone: 50, eastBase: 200000, row: "K" },
};

const UTM_NORTH_LETTERS_ODD = "ABCDEFGHJKLMNPQRSTUV";
const UTM_NORTH_LETTERS_EVEN = "FGHJKLMNPQRSTUVABCDE";

export function ensureUtm() {
  if (!window.proj4) throw new Error("proj4 not loaded");
  if (!proj4.defs("EPSG:32649")) proj4.defs("EPSG:32649", UTM49_PROJ);
  if (!proj4.defs("EPSG:32650")) proj4.defs("EPSG:32650", UTM50_PROJ);
}

/** 114° 以西 zone 49，以東 zone 50。 */
export function utmZoneForLng(lng) {
  return lng < 114.0 ? 49 : 50;
}

function utmEpsg(zone) {
  return zone === 49 ? "EPSG:32649" : "EPSG:32650";
}

/** WGS84 → UTM，自動按經度選 zone。 */
export function toUtm(lat, lng) {
  ensureUtm();
  const zone = utmZoneForLng(lng);
  const [e, n] = proj4("EPSG:4326", utmEpsg(zone), [lng, lat]);
  return { e, n, zone };
}

/** 強制以指定 zone 投影（方格繪圖與跨 114° 路段計算用）。 */
export function toUtmInZone(lat, lng, zone) {
  ensureUtm();
  const [e, n] = proj4("EPSG:4326", utmEpsg(zone), [lng, lat]);
  return { e, n };
}

/** UTM → WGS84（需提供 zone）。 */
export function fromUtm(e, n, zone) {
  ensureUtm();
  const [lng, lat] = proj4(utmEpsg(zone), "EPSG:4326", [e, n]);
  return { lat, lng };
}

export function resolveUtmSquare(zone, e) {
  if (zone === 49) {
    if (e >= 700000 && e < 800000) return "GE";
    if (e >= 800000 && e < 900000) return "HE";
  } else {
    if (e >= 100000 && e < 200000) return "JK";
    if (e >= 200000 && e < 300000) return "KK";
  }
  return null;
}

/** 該方格字母行在 UTM 北距的底邊（取 2,000,000 m 週期中最接近香港的一個）。 */
function utmNorthBase(zone, rowLetter) {
  const set = zone % 2 === 1 ? UTM_NORTH_LETTERS_ODD : UTM_NORTH_LETTERS_EVEN;
  const row = set.indexOf(rowLetter);
  if (row < 0) return 0;
  const base = row * 100000;
  const k = Math.round((2470000 - base) / 2000000); // 香港約在 N≈2,470,000
  return base + k * 2000000;
}

export function planarDistance(a, b) {
  const A = toUtm(a.lat, a.lng);
  const B = toUtmInZone(b.lat, b.lng, A.zone); // 兩端同一 zone，跨 114° 亦連續
  return Math.hypot(B.e - A.e, B.n - A.n);
}

/** Grid bearing in degrees, 0 = north, clockwise（UTM 方格北）。 */
export function gridBearing(from, to) {
  const A = toUtm(from.lat, from.lng);
  const B = toUtmInZone(to.lat, to.lng, A.zone);
  const de = B.e - A.e;
  const dn = B.n - A.n;
  let deg = (Math.atan2(de, dn) * 180) / Math.PI;
  if (deg < 0) deg += 360;
  return deg;
}

export function magneticBearing(gridDeg) {
  let mag = gridDeg - MAG_DECLINATION_WEST;
  if (mag < 0) mag += 360;
  return mag;
}

export function formatDeg(deg) {
  // 先把「分」四捨五入再一次換算，避免 45.9999° 變成「045° 00′」這類度數冇進位的顯示。
  const total = Math.round(deg * 60);
  const d = Math.floor(total / 60) % 360;
  const m = total % 60;
  return `${String(d).padStart(3, "0")}° ${String(m).padStart(2, "0")}′`;
}

function pad4(x) {
  return String(x).padStart(4, "0");
}
function pad3(x) {
  return String(x).padStart(3, "0");
}

/**
 * HM20C 風格方格參照（UTM 100 km 方格）。
 * 回傳 KK 1234 5678（8 位／10 m）與 KK 123 456（6 位／100 m）等格式。
 * @param {number} lat
 * @param {number} lng
 */
export function gridRefs(lat, lng) {
  const { e: eRaw, n: nRaw, zone } = toUtm(lat, lng);
  const e = Math.round(eRaw);
  const n = Math.round(nRaw);
  const square = resolveUtmSquare(zone, e);
  if (!square) {
    return {
      e,
      n,
      zone,
      square: null,
      fig6: "?? ??? ???",
      fig8: `${zone}Q ?? ???? ????`,
      full: `${zone}Q ?? ???? ????`,
    };
  }
  const eastBase = UTM_SQUARES[square].eastBase;
  const eIn = e - eastBase; // 0..99999 方格內東距
  const nIn = ((n % 100000) + 100000) % 100000; // 0..99999 方格內北距
  const ref8 = `${zone}Q ${square} ${pad4(Math.floor(eIn / 10))} ${pad4(
    Math.floor(nIn / 10)
  )}`;
  return {
    e,
    n,
    zone,
    square,
    fig6: `${square} ${pad3(Math.floor(eIn / 100))} ${pad3(
      Math.floor(nIn / 100)
    )}`,
    fig8: ref8,
    full: ref8,
  };
}

/**
 * 解析「KK 1234 5678」式方格輸入。接受：
 *   KK 1234 5678（8 位／10 m）、KK 123 456（6 位／100 m）、KK 12 34（4 位／1 km）
 *   KK12345678、50Q KK 1234 5678、kk 1234 5678；GE／HE／JK／KK 任一方格。
 * 回傳 { e, n, zone }（UTM 東距／北距／zone），或 null。
 */
export function parseGridInput(raw) {
  const s = String(raw || "")
    .trim()
    .toUpperCase()
    .replace(/[,;|]+/g, " ")
    .replace(/\s+/g, " ");
  if (!s) return null;
  let rest = s;
  let zone = null;
  const zm = rest.match(/^(49|50)Q\s*/);
  if (zm) {
    zone = Number(zm[1]);
    rest = rest.slice(zm[0].length);
  }
  const sm = rest.match(/^(GE|HE|JK|KK)\s*/);
  if (!sm) return null;
  const square = sm[1];
  rest = rest.slice(sm[0].length);
  const info = UTM_SQUARES[square];
  if (zone && zone !== info.zone) return null;
  zone = info.zone;
  const digs = rest.replace(/\D/g, "");
  if (!digs || digs.length % 2 !== 0 || digs.length < 4) return null;
  const half = digs.length / 2;
  const eDig = digs.slice(0, half);
  const nDig = digs.slice(half);
  // 解析度：4 位/邊 = 10 m，3 位 = 100 m，2 位 = 1 km。取格中央。
  const res = half >= 4 ? 10 : half === 3 ? 100 : 1000;
  const eVal = Number(eDig) * res + res / 2;
  const nVal = Number(nDig) * res + res / 2;
  if (Number.isNaN(eVal) || Number.isNaN(nVal)) return null;
  const E = info.eastBase + eVal;
  const N = utmNorthBase(zone, info.row) + nVal;
  return { e: E, n: N, zone, square };
}

export function metersPerPixel(lat, zoom) {
  return (
    (156543.03392804097 * Math.cos((lat * Math.PI) / 180)) / Math.pow(2, zoom)
  );
}

export function scaleDenominator(lat, zoom, dpi = 96) {
  const mpp = metersPerPixel(lat, zoom);
  const metersPerInch = 0.0254;
  return (mpp * dpi) / metersPerInch;
}

export function zoomForScale(lat, scale, dpi = 96) {
  const metersPerInch = 0.0254;
  const targetMpp = (scale * metersPerInch) / dpi;
  const num = 156543.03392804097 * Math.cos((lat * Math.PI) / 180);
  return Math.log2(num / targetMpp);
}

/** A-series finished paper sizes in mm. */
export const PAPER_MM = {
  A3: { w: 420, h: 297 },
  A4: { w: 297, h: 210 },
  A5: { w: 210, h: 148 },
};

/** 設計＝列印：盡量滿版，頁邊距交由瀏覽器 / 打印機自己處理。
 *  第一頁保留很薄的圖名列與圖底列，其餘都給地圖。 */
export const PAPER_LAYOUT_MM = {
  head: 14,
  foot: 7,
  descHead: 12,
  padX: 4,
  padY: 2,
};

export function normalizeOrientation(orientation = "landscape") {
  return orientation === "portrait" ? "portrait" : "landscape";
}

export function pageGeometryMm(paper, orientation = "landscape") {
  const base = PAPER_MM[paper] || PAPER_MM.A4;
  const dir = normalizeOrientation(orientation);
  const sheetW = dir === "portrait" ? Math.min(base.w, base.h) : Math.max(base.w, base.h);
  const sheetH = dir === "portrait" ? Math.max(base.w, base.h) : Math.min(base.w, base.h);
  const mapW = sheetW;
  const mapH = Math.max(40, sheetH - PAPER_LAYOUT_MM.head - PAPER_LAYOUT_MM.foot);
  return {
    sheetW,
    sheetH,
    mapW,
    mapH,
    headH: PAPER_LAYOUT_MM.head,
    footH: PAPER_LAYOUT_MM.foot,
    descHeadH: PAPER_LAYOUT_MM.descHead,
    padX: PAPER_LAYOUT_MM.padX,
    padY: PAPER_LAYOUT_MM.padY,
  };
}

/** 各紙張 / 方向下第一頁地圖實際可印圖面（mm）。 */
export const PRINT_AREA_MM = Object.fromEntries(
  Object.keys(PAPER_MM).map((paper) => [
    paper,
    {
      landscape: (() => {
        const g = pageGeometryMm(paper, "landscape");
        return { w: g.mapW, h: g.mapH };
      })(),
      portrait: (() => {
        const g = pageGeometryMm(paper, "portrait");
        return { w: g.mapW, h: g.mapH };
      })(),
    },
  ])
);

/** 指定比例＋紙張下，列印圖面可容納的最大實際範圍（米）。 */
export function paperAreaMeters(paper, scale, orientation = "landscape") {
  const dir = normalizeOrientation(orientation);
  const area = PRINT_AREA_MM[paper]?.[dir] || PRINT_AREA_MM.A4.landscape;
  const mPerMm = scale / 1000; // 1:20 000 → 1 mm = 20 m
  return { w: area.w * mPerMm, h: area.h * mPerMm };
}

/** HM20C 1:20 000 series — sheet centres for navigation (not paper-map copyright). */
export const HM20C_SHEETS = [
  {
    id: "1",
    name: "圖例",
    nameEn: "Legend / Title",
    note: "紙本圖幅 1 為標題及圖例，不含地形。",
    center: HK_CENTER,
    zoom: 11,
  },
  { id: "2", name: "新田", nameEn: "San Tin", center: [22.502, 114.078], zoom: 13 },
  {
    id: "3",
    name: "上水及粉嶺",
    nameEn: "Sheung Shui & Fanling",
    center: [22.508, 114.138],
    zoom: 13,
  },
  {
    id: "4",
    name: "吉澳洲",
    nameEn: "Kat O (Crooked Island)",
    center: [22.545, 114.305],
    zoom: 13,
  },
  {
    id: "5",
    name: "青山",
    nameEn: "Castle Peak",
    center: [22.395, 113.973],
    zoom: 13,
  },
  { id: "6", name: "元朗", nameEn: "Yuen Long", center: [22.445, 114.035], zoom: 13 },
  { id: "7", name: "沙田", nameEn: "Sha Tin", center: [22.382, 114.19], zoom: 13 },
  {
    id: "8",
    name: "西貢半島",
    nameEn: "Sai Kung Peninsula",
    center: [22.4, 114.3],
    zoom: 13,
  },
  { id: "9", name: "東涌", nameEn: "Tung Chung", center: [22.289, 113.941], zoom: 13 },
  {
    id: "10",
    name: "銀礦灣",
    nameEn: "Silver Mine Bay",
    center: [22.268, 114.001],
    zoom: 13,
  },
  {
    id: "11",
    name: "香港及九龍",
    nameEn: "Hong Kong Island & Kowloon",
    center: [22.302, 114.172],
    zoom: 13,
  },
  {
    id: "12",
    name: "清水灣",
    nameEn: "Clear Water Bay",
    center: [22.295, 114.289],
    zoom: 13,
  },
  { id: "13", name: "石壁", nameEn: "Shek Pik", center: [22.227, 113.895], zoom: 13 },
  {
    id: "14",
    name: "長洲",
    nameEn: "Cheung Chau",
    center: [22.209, 114.029],
    zoom: 13,
  },
  {
    id: "15",
    name: "香港南部及南丫島",
    nameEn: "Hong Kong South & Lamma",
    center: [22.226, 114.145],
    zoom: 13,
  },
  {
    id: "16",
    name: "橫瀾島",
    nameEn: "Waglan Island",
    center: [22.182, 114.303],
    zoom: 13,
  },
];

export const GAZETTEER = [
  { name: "尖沙咀鐘樓", q: "Tsim Sha Tsui Clock Tower", lat: 22.2936, lng: 114.1694, tag: "城市" },
  { name: "中環碼頭", q: "Central Pier", lat: 22.287, lng: 114.16, tag: "城市" },
  { name: "金鐘太古廣場", q: "Pacific Place", lat: 22.2776, lng: 114.1655, tag: "城市" },
  { name: "灣仔修頓球場", q: "Southorn Playground", lat: 22.2774, lng: 114.1728, tag: "城市" },
  { name: "銅鑼灣維園", q: "Victoria Park", lat: 22.282, lng: 114.1886, tag: "城市" },
  { name: "沙田大會堂", q: "Sha Tin Town Hall", lat: 22.3815, lng: 114.1898, tag: "城市" },
  { name: "大埔海濱公園", q: "Tai Po Waterfront", lat: 22.4512, lng: 114.175, tag: "城市" },
  { name: "荃灣西樓角", q: "Tsuen Wan", lat: 22.373, lng: 114.117, tag: "城市" },
  { name: "將軍澳 Renfrew", q: "Tseung Kwan O", lat: 22.307, lng: 114.26, tag: "城市" },
  { name: "觀塘海濱", q: "Kwun Tong Promenade", lat: 22.3095, lng: 114.2205, tag: "城市" },
  { name: "香港童軍中心", q: "Hong Kong Scout Centre", lat: 22.2788, lng: 114.1658, tag: "童軍" },
  { name: "赤柱廣場", q: "Stanley", lat: 22.219, lng: 114.21, tag: "城市" },
  { name: "圓洲角公園", q: "Yuen Chau Kok", lat: 22.381, lng: 114.204, tag: "城市" },
  { name: "科學園", q: "Science Park", lat: 22.426, lng: 114.211, tag: "城市" },
  { name: "烏溪沙青年新村", q: "Wu Kai Sha Youth Village", lat: 22.429, lng: 114.244, tag: "童軍" },
  { name: "屯門蝴蝶灣", q: "Butterfly Beach", lat: 22.374, lng: 113.96, tag: "城市" },
];

const TRANSPARENT_PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=";

/* 郊遊圖底圖：OpenTopoMap 突顯山徑、等高線，適合野外定向；官方郊區地圖仍是紙本，此圖磚作規劃用 */
export const COUNTRYSIDE_TILE_URL =
  "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png";
export const COUNTRYSIDE_SUBDOMAINS = ["a", "b", "c"];
export const COUNTRYSIDE_ATTRIBUTION =
  "© OpenTopoMap (CC-BY-SA) © OpenStreetMap contributors · 郊遊圖參考，底圖含 LandsD 地形 · © Scout System";

export function landsdUrl(kind, lang = "tc") {
  if (kind === "basemap") return `${LANDSD_API}/xyz/basemap/WGS84/{z}/{x}/{y}.png`;
  if (kind === "imagery") return `${LANDSD_API}/xyz/imagery/WGS84/{z}/{x}/{y}.png`;
  return `${LANDSD_API}/xyz/label/hk/${lang}/WGS84/{z}/{x}/{y}.png`;
}

export function tileOptions(extra = {}) {
  return {
    minZoom: 10,
    maxZoom: 20,
    maxNativeZoom: 20,
    errorTileUrl: TRANSPARENT_PNG,
    attribution:
      'Map from Lands Department · Aerial Photograph from Lands Department · © Scout System',
    ...extra,
  };
}

export function countrysideTileOptions(extra = {}) {
  return {
    minZoom: 10,
    maxZoom: 17,
    maxNativeZoom: 17,
    subdomains: COUNTRYSIDE_SUBDOMAINS,
    errorTileUrl: TRANSPARENT_PNG,
    attribution: COUNTRYSIDE_ATTRIBUTION,
    ...extra,
  };
}
