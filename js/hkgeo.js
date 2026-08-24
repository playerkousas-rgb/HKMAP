/**
 * Scout System — Hong Kong geodesy, official map layers, sheet indexes.
 * Map tiles: Lands Department Map API (Topographic / Imagery / Labels).
 * Countryside overlays: AFCD via CSDI Portal.
 */
export const HK80_PROJ =
  "+proj=tmerc +lat_0=22.31213333333334 +lon_0=114.1785555555556 +k=1 +x_0=836694.05 +y_0=819069.8 +ellps=intl +towgs84=-162.619,-276.959,-161.764,0.067753,-2.24365,-1.15883,-1.09425 +units=m +no_defs";

export const MAG_DECLINATION_WEST = 3.1; // degrees, approx. 2026 Hong Kong（UTM 方格北↔磁北修正）
export const LANDSD_API = "https://mapapi.geodata.gov.hk/gs/api/v1.0.0";
export const CSDI_MAP = "https://portal.csdi.gov.hk/server/rest/services/common";

export const HK_BOUNDS = [
  [22.13, 113.80],
  [22.58, 114.51],
];

export const HK_CENTER = [22.352, 114.158];

export const DATASETS = {
  trails: "afcd_rcd_1665568199103_4360",
  parks: "afcd_rcd_1635129924112_81508",
  posts: "afcd_rcd_1635136039113_86105",
  ib20000: "landsd_rcd_1637224132564_22637",
};

export const LINKS = {
  terms: "https://portal.csdi.gov.hk/csdi-webpage/doc/TNC",
  topoApi: "https://portal.csdi.gov.hk/csdi-webpage/apidoc/TopographicMapAPI",
  hm20c: "https://www.landsd.gov.hk/tc/survey-mapping/mapping/multi-scale-topographic-mapping/paper-map.html",
  ib20000:
    "https://www.landsd.gov.hk/tc/survey-mapping/mapping/multi-scale-topographic-mapping/digital-map.html",
  ib20000Order:
    "https://www.hkmapservice.gov.hk/OneStopSystem/map-search?product=OSSCatB&series=iB20000",
  ib20000Csdi:
    "https://portal.csdi.gov.hk/geoportal/?datasetId=landsd_rcd_1637224132564_22637",
  ib20000Data:
    "https://data.gov.hk/tc-data/dataset/hk-landsd-openmap-development-hkms-digital-b20k",
  priceList:
    "https://www.landsd.gov.hk/doc/en/mapping/digital-map/common/doc/pricelist.pdf",
  countryside:
    "https://www.landsd.gov.hk/tc/survey-mapping/mapping/thematic-mapping.html",
  geoinfo: "https://www.map.gov.hk/",
  csdi: "https://portal.csdi.gov.hk/",
  landsd: "https://www.landsd.gov.hk/",
  afcd: "https://www.afcd.gov.hk/",
  hkms: "https://www.hkmapservice.gov.hk/",
};

export function ensureProj() {
  if (!window.proj4) throw new Error("proj4 not loaded");
  if (!proj4.defs("EPSG:2326")) proj4.defs("EPSG:2326", HK80_PROJ);
}

export function toHk80(lat, lng) {
  ensureProj();
  const [e, n] = proj4("EPSG:4326", "EPSG:2326", [lng, lat]);
  return { e, n };
}

export function fromHk80(e, n) {
  ensureProj();
  const [lng, lat] = proj4("EPSG:2326", "EPSG:4326", [e, n]);
  return { lat, lng };
}

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
  const d = Math.floor(deg);
  const m = Math.round((deg - d) * 60);
  return `${String(d).padStart(3, "0")}° ${String(m % 60).padStart(2, "0")}′`;
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

export function normalizeFrame(a, b) {
  return {
    south: Math.min(a.lat, b.lat),
    north: Math.max(a.lat, b.lat),
    west: Math.min(a.lng, b.lng),
    east: Math.max(a.lng, b.lng),
  };
}

export function frameValid(frame) {
  return (
    frame &&
    Number.isFinite(frame.south) &&
    Number.isFinite(frame.north) &&
    Number.isFinite(frame.west) &&
    Number.isFinite(frame.east) &&
    frame.north > frame.south &&
    frame.east > frame.west
  );
}

export function frameSize(frame) {
  if (!frameValid(frame)) return { w: 0, h: 0 };
  const sw = toHk80(frame.south, frame.west);
  const ne = toHk80(frame.north, frame.east);
  return { w: Math.abs(ne.e - sw.e), h: Math.abs(ne.n - sw.n) };
}

export function frameBounds(frame) {
  return L.latLngBounds(
    [frame.south, frame.west],
    [frame.north, frame.east]
  );
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

/** Official countryside map series — 5 sheets. */
export const COUNTRYSIDE_SHEETS = [
  {
    id: "CM-HK",
    name: "香港島及鄰近島嶼",
    nameEn: "Hong Kong Island & Neighbouring Islands",
    center: [22.26, 114.17],
    zoom: 12,
  },
  {
    id: "CM-LT",
    name: "大嶼山及鄰近島嶼",
    nameEn: "Lantau Island & Neighbouring Islands",
    center: [22.26, 113.95],
    zoom: 12,
  },
  {
    id: "CM-NW",
    name: "新界西北部",
    nameEn: "North West New Territories",
    center: [22.43, 114.0],
    zoom: 12,
  },
  {
    id: "CM-NE",
    name: "新界東北及中部",
    nameEn: "North East & Central New Territories",
    center: [22.45, 114.2],
    zoom: 12,
  },
  {
    id: "CM-SK",
    name: "西貢及清水灣",
    nameEn: "Sai Kung & Clear Water Bay",
    center: [22.36, 114.3],
    zoom: 12,
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
  { name: "西貢萬宜水庫東壩", q: "East Dam", lat: 22.3615, lng: 114.372, tag: "郊遊" },
  { name: "西貢北潭涌", q: "Pak Tam Chung", lat: 22.397, lng: 114.321, tag: "郊遊" },
  { name: "麥理浩夫人度假村", q: "Sai Kung Outdoor Recreation", lat: 22.393, lng: 114.32, tag: "童軍" },
  { name: "橋頭郊野公園", q: "Hok Tau", lat: 22.492, lng: 114.181, tag: "郊遊" },
  { name: "大帽山", q: "Tai Mo Shan", lat: 22.4117, lng: 114.123, tag: "郊遊" },
  { name: "城門水塘", q: "Shing Mun Reservoir", lat: 22.388, lng: 114.145, tag: "郊遊" },
  { name: "獅子山", q: "Lion Rock", lat: 22.3522, lng: 114.187, tag: "郊遊" },
  { name: "飛鵝山", q: "Kowloon Peak", lat: 22.341, lng: 114.223, tag: "郊遊" },
  { name: "龍脊", q: "Dragon's Back", lat: 22.243, lng: 114.243, tag: "郊遊" },
  { name: "太平山", q: "Victoria Peak", lat: 22.2759, lng: 114.1455, tag: "郊遊" },
  { name: "南朗山", q: "Nam Long Shan", lat: 22.239, lng: 114.175, tag: "郊遊" },
  { name: "鳳凰山", q: "Lantau Peak", lat: 22.2578, lng: 113.9216, tag: "郊遊" },
  { name: "大東山", q: "Sunset Peak", lat: 22.257, lng: 113.953, tag: "郊遊" },
  { name: "東涌舊碼頭", q: "Tung Chung", lat: 22.2898, lng: 113.941, tag: "郊遊" },
  { name: "大澳", q: "Tai O", lat: 22.2547, lng: 113.863, tag: "郊遊" },
  { name: "南丫島榕樹灣", q: "Yung Shue Wan", lat: 22.226, lng: 114.11, tag: "郊遊" },
  { name: "長洲北帝廟", q: "Cheung Chau", lat: 22.2085, lng: 114.0288, tag: "郊遊" },
  { name: "新娘潭", q: "Bride's Pool", lat: 22.503, lng: 114.24, tag: "郊遊" },
  { name: "八仙嶺", q: "Pat Sin Leng", lat: 22.49, lng: 114.216, tag: "郊遊" },
  { name: "船灣淡水湖主壩", q: "Plover Cove", lat: 22.47, lng: 114.23, tag: "郊遊" },
  { name: "白沙灣", q: "Pak Sha Wan", lat: 22.365, lng: 114.26, tag: "郊遊" },
  { name: "清水灣第二灣", q: "Clear Water Bay", lat: 22.286, lng: 114.291, tag: "郊遊" },
  { name: "石澳", q: "Shek O", lat: 22.2305, lng: 114.251, tag: "郊遊" },
  { name: "赤柱廣場", q: "Stanley", lat: 22.219, lng: 114.21, tag: "城市" },
  { name: "薄扶林水塘", q: "Pok Fu Lam Reservoir", lat: 22.266, lng: 114.138, tag: "郊遊" },
  { name: "金山郊野公園", q: "Kam Shan", lat: 22.355, lng: 114.153, tag: "郊遊" },
  { name: "圓洲角公園", q: "Yuen Chau Kok", lat: 22.381, lng: 114.204, tag: "城市" },
  { name: "科學園", q: "Science Park", lat: 22.426, lng: 114.211, tag: "城市" },
  { name: "馬鞍山白石", q: "Ma On Shan", lat: 22.425, lng: 114.243, tag: "郊遊" },
  { name: "烏溪沙青年新村", q: "Wu Kai Sha Youth Village", lat: 22.429, lng: 114.244, tag: "童軍" },
  { name: "西貢萬宜地質公園", q: "Geopark Sai Kung", lat: 22.36, lng: 114.35, tag: "郊遊" },
  { name: "塔門", q: "Tap Mun", lat: 22.473, lng: 114.36, tag: "郊遊" },
  { name: "吉澳", q: "Kat O", lat: 22.545, lng: 114.305, tag: "郊遊" },
  { name: "米埔", q: "Mai Po", lat: 22.497, lng: 114.042, tag: "郊遊" },
  { name: "流浮山", q: "Lau Fau Shan", lat: 22.468, lng: 113.985, tag: "郊遊" },
  { name: "屯門蝴蝶灣", q: "Butterfly Beach", lat: 22.374, lng: 113.96, tag: "城市" },
  { name: "青山禪院", q: "Tsing Shan Monastery", lat: 22.388, lng: 113.96, tag: "郊遊" },
  { name: "嘉道理農場", q: "Kadoorie Farm", lat: 22.433, lng: 114.122, tag: "郊遊" },
  { name: "林村許願樹", q: "Lam Tsuen", lat: 22.453, lng: 114.14, tag: "郊遊" },
];

const TRANSPARENT_PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=";

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

function mercatorTileBbox(coords, tileSize = 256) {
  const origin = 20037508.342789244;
  const n = 2 ** coords.z;
  const size = (origin * 2) / n;
  const minX = -origin + coords.x * size;
  const maxX = minX + size;
  const maxY = origin - coords.y * size;
  const minY = maxY - size;
  return [minX, minY, maxX, maxY];
}

export function csdiExportLayer(datasetId, pane) {
  const CSDILayer = L.GridLayer.extend({
    createTile(coords, done) {
      const img = document.createElement("img");
      img.alt = "";
      img.setAttribute("role", "presentation");
      const [minX, minY, maxX, maxY] = mercatorTileBbox(coords);
      const bbox = [minX, minY, maxX, maxY].join(",");
      img.src = `${CSDI_MAP}/${datasetId}/MapServer/export?bbox=${encodeURIComponent(
        bbox
      )}&bboxSR=3857&imageSR=3857&size=256,256&dpi=96&format=png32&transparent=true&f=image`;
      img.onload = () => done(null, img);
      img.onerror = () => done(null, img);
      return img;
    },
  });
  return new CSDILayer({
    pane,
    tileSize: 256,
    minZoom: 10,
    maxZoom: 18,
    opacity: 0.92,
    className: "csdi-overlay",
  });
}
