/**
 * 測試用嘅 proj4 替身：只實作本專案用到嘅 WGS84 UTM（zone 49／50）。
 * 用美國 USGS 標準級數公式（誤差 < 1 m，足夠驗證方格格式），
 * 令 hkgeo.js 嘅方格／距離／比例可以在 Node 直接測試 —— 唔需要裝任何套件。
 */
const A = 6378137.0;
const F = 1 / 298.257223563;
const K0 = 0.9996;
const E0 = 500000;
const E2 = F * (2 - F);
const E2P = E2 / (1 - E2);
const RAD = Math.PI / 180;
const DEG = 180 / Math.PI;

function zoneOf(def) {
  const text = String(def);
  const projString = text.match(/\+zone=(\d+)/);
  if (projString) return Number(projString[1]);
  const epsg = text.match(/(\d{2})$/);
  return epsg ? Number(epsg[1]) : 50;
}

function centralMeridian(zone) {
  return zone * 6 - 183; // zone 50 → 117°E；zone 49 → 111°E
}

function mercatorArc(phi) {
  return (
    A *
    ((1 - E2 / 4 - (3 * E2 ** 2) / 64 - (5 * E2 ** 3) / 256) * phi -
      ((3 * E2) / 8 + (3 * E2 ** 2) / 32 + (45 * E2 ** 3) / 1024) * Math.sin(2 * phi) +
      ((15 * E2 ** 2) / 256 + (45 * E2 ** 3) / 1024) * Math.sin(4 * phi) -
      ((35 * E2 ** 3) / 3072) * Math.sin(6 * phi))
  );
}

/** WGS84 經緯度 → UTM 東距／北距。 */
export function forward(lng, lat, zone) {
  const phi = lat * RAD;
  const lam = lng * RAD;
  const lam0 = centralMeridian(zone) * RAD;
  const sinPhi = Math.sin(phi);
  const cosPhi = Math.cos(phi);
  const tanPhi = Math.tan(phi);
  const N = A / Math.sqrt(1 - E2 * sinPhi ** 2);
  const T = tanPhi ** 2;
  const C = E2P * cosPhi ** 2;
  const Aa = (lam - lam0) * cosPhi;
  const M = mercatorArc(phi);
  const east =
    K0 *
      N *
      (Aa +
        ((1 - T + C) * Aa ** 3) / 6 +
        ((5 - 18 * T + T ** 2 + 72 * C - 58 * E2P) * Aa ** 5) / 120) +
    E0;
  const north =
    K0 *
    (M +
      N *
        tanPhi *
        (Aa ** 2 / 2 +
          ((5 - T + 9 * C + 4 * C ** 2) * Aa ** 4) / 24 +
          ((61 - 58 * T + T ** 2 + 600 * C - 330 * E2P) * Aa ** 6) / 720));
  return [east, north];
}

/** UTM 東距／北距 → WGS84 經緯度。 */
export function inverse(east, north, zone) {
  const x = east - E0;
  const y = north;
  const M = y / K0;
  const mu = M / (A * (1 - E2 / 4 - (3 * E2 ** 2) / 64 - (5 * E2 ** 3) / 256));
  const e1 = (1 - Math.sqrt(1 - E2)) / (1 + Math.sqrt(1 - E2));
  const phi1 =
    mu +
    ((3 * e1) / 2 - (27 * e1 ** 3) / 32) * Math.sin(2 * mu) +
    ((21 * e1 ** 2) / 16 - (55 * e1 ** 4) / 32) * Math.sin(4 * mu) +
    ((151 * e1 ** 3) / 96) * Math.sin(6 * mu) +
    ((1097 * e1 ** 4) / 512) * Math.sin(8 * mu);
  const sinPhi1 = Math.sin(phi1);
  const cosPhi1 = Math.cos(phi1);
  const tanPhi1 = Math.tan(phi1);
  const N1 = A / Math.sqrt(1 - E2 * sinPhi1 ** 2);
  const T1 = tanPhi1 ** 2;
  const C1 = E2P * cosPhi1 ** 2;
  const R1 = (A * (1 - E2)) / (1 - E2 * sinPhi1 ** 2) ** 1.5;
  const D = x / (N1 * K0);
  const lat =
    phi1 -
    ((N1 * tanPhi1) / R1) *
      (D ** 2 / 2 -
        ((5 + 3 * T1 + 10 * C1 - 4 * C1 ** 2 - 9 * E2P) * D ** 4) / 24 +
        ((61 + 90 * T1 + 298 * C1 + 45 * T1 ** 2 - 252 * E2P - 3 * C1 ** 2) * D ** 6) / 720);
  const lng =
    centralMeridian(zone) * RAD +
    (D -
      ((1 + 2 * T1 + C1) * D ** 3) / 6 +
      ((5 - 2 * C1 + 28 * T1 - 3 * C1 ** 2 + 8 * E2P + 24 * T1 ** 2) * D ** 5) / 120) /
      cosPhi1;
  return [lng * DEG, lat * DEG];
}

/** 同 proj4 一樣嘅呼叫介面。 */
export function createProj4() {
  const defs = new Map();
  const proj4 = (fromProj, toProj, coord) => {
    const from = defs.get(fromProj) || fromProj;
    const to = defs.get(toProj) || toProj;
    const isWgs = (p) => /4326|longlat|WGS84/i.test(String(p));
    const isUtm = (p) => /326\d\d|utm/i.test(String(p));
    if (isWgs(from) && isUtm(to)) return forward(coord[0], coord[1], zoneOf(to));
    if (isUtm(from) && isWgs(to)) return inverse(coord[0], coord[1], zoneOf(from));
    throw new Error(`測試用 proj4 唔支援：${fromProj} → ${toProj}`);
  };
  proj4.defs = (name, value) => {
    if (value === undefined) return defs.get(name) || null;
    defs.set(name, value);
    return value;
  };
  return proj4;
}

/** 裝好 window.proj4／全域 proj4（同瀏覽器一樣兩個都要有）。 */
export function install() {
  const proj4 = createProj4();
  globalThis.proj4 = proj4;
  globalThis.window = globalThis.window || {};
  globalThis.window.proj4 = proj4;
  return proj4;
}
