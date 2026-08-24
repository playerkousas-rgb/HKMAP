/**
 * IOF 國際控制點提示符號(Control Description / 提示符號表)
 * 依香港童軍總會《野外定向訓練筆記》第 19-20 頁規格:
 *   八欄 A 序號 · B 編號 · C 同類中哪個 · D 特徵物 · E 外觀 · F 大小 · G 旗幟位置 · H 其他
 * 符號為 SVG 象形圖(40×40 viewBox),可縮放至約 6 mm 格。
 * 顏色:ISOM overprint 紫(magenta)。提示符號表印於地圖同一張紙的角落,不疊在地形上。
 *
 * 符號為求簡明可辨,對照 IOF 標準象形;可在 SYM 內逐個精修。
 */

/** Overprint 紫(ISOM purple),提示符號表專用色。 */
export const CD_PURPLE = "#a02480";

/** 將一段 inner SVG 包成獨立 <svg>(給 picker / 預覽用)。 */
export function symbolIcon(inner, size = 28, color = CD_PURPLE) {
  return `<svg viewBox="0 0 40 40" width="${size}" height="${size}" 
    style="display:block" fill="${color}" stroke="${color}" stroke-width="3.2" 
    stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;
}

/* ============ D 列:特徵物 ============ */
// 每個符號:inner SVG(40×40)。地貌/石/水/植被/人造 五大類。
const _tri = (cx, w, h, top) =>
  `${cx - w},${top + h} ${cx},${top} ${cx + w},${top + h}`;
const _v = (cx, w, top, h) =>
  `${cx},${top + h} ${cx - w},${top} ${cx + w},${top}`;

export const FEATURE = {
  // ── 地貌 landforms ──
  terrace:    { c: "地貌", t: "台地",     s: `<path d="M6 28 L18 28 L18 20 L34 20 L34 14 L6 14 Z" fill="none"/>` },
  spur:       { c: "地貌", t: "山咀",     s: `<path d="${_tri(20, 11, 22, 8)}" fill="none"/>` },
  reentrant:  { c: "地貌", t: "山窩",     s: `<path d="${_v(20, 12, 8, 24)}" fill="none"/>` },
  earthBank:  { c: "地貌", t: "土堤／堤", s: `<line x1="6" y1="16" x2="34" y2="16"/><path d="M10 16 l4 8 M18 16 l4 8 M26 16 l4 8" fill="none" stroke-width="2.4"/>` },
  earthWall:  { c: "地貌", t: "土牆",     s: `<line x1="6" y1="20" x2="34" y2="20"/><path d="M10 20 v-7 M10 20 v7 M20 20 v-7 M20 20 v7 M30 20 v-7 M30 20 v7" stroke-width="2.4"/>` },
  gully:      { c: "地貌", t: "侵蝕溝",   s: `<path d="${_v(20, 10, 8, 22)}" fill="none"/><path d="M16 24 l-3 6 M24 24 l3 6" fill="none" stroke-width="2.4"/>` },
  dryDitch:   { c: "地貌", t: "小乾溝",   s: `<path d="${_v(20, 7, 12, 16)}" fill="none"/>` },
  hill:       { c: "地貌", t: "山丘",     s: `<path d="${_tri(20, 13, 24, 8)}"/>` },
  knoll:      { c: "地貌", t: "小丘",     s: `<circle cx="20" cy="20" r="5"/>` },
  saddle:     { c: "地貌", t: "鞍部",     s: `<path d="${_tri(12, 7, 16, 12)}" fill="none"/><path d="${_tri(28, 7, 16, 12)}" fill="none"/>` },
  depression: { c: "地貌", t: "陷地",     s: `<path d="${_v(20, 11, 10, 20)}" fill="none"/><path d="M14 30 l-2 4 M26 30 l2 4" fill="none" stroke-width="2.4"/>` },
  smDepress:  { c: "地貌", t: "小陷地",   s: `<path d="${_v(20, 6, 13, 14)}" fill="none"/>` },
  pit:        { c: "地貌", t: "地洞",     s: `<path d="M10 14 L30 14 L20 30 Z" fill="none"/>` },
  // ── 石系 rock ──
  cliff:      { c: "石系", t: "陡崖／峭壁", s: `<path d="M8 14 L32 14 L32 30 L8 30 Z" /><line x1="8" y1="14" x2="32" y2="14" stroke="#fff" stroke-width="2"/>` },
  rockPillar: { c: "石系", t: "石柱",     s: `<rect x="16" y="8" width="8" height="24" rx="2"/>` },
  cave:       { c: "石系", t: "山洞",     s: `<path d="M8 30 L8 18 Q20 8 32 18 L32 30" fill="none"/>` },
  boulder:    { c: "石系", t: "大石",     s: `<circle cx="20" cy="20" r="8"/>` },
  boulderCl:  { c: "石系", t: "石群",     s: `<circle cx="14" cy="16" r="4.5"/><circle cx="26" cy="14" r="4"/><circle cx="20" cy="25" r="5"/><circle cx="29" cy="25" r="3.5"/>` },
  boulderFd:  { c: "石系", t: "大石堆",   s: `<g fill="none"><circle cx="12" cy="13" r="3"/><circle cx="22" cy="11" r="3"/><circle cx="30" cy="16" r="3"/><circle cx="14" cy="22" r="3"/><circle cx="24" cy="22" r="3"/><circle cx="31" cy="27" r="3"/><circle cx="13" cy="30" r="3"/><circle cx="22" cy="31" r="3"/></g>` },
  bareRock:   { c: "石系", t: "岩石地",   s: `<rect x="7" y="10" width="26" height="20" fill="none"/><path d="M7 18 L33 18 M16 10 L16 30" fill="none" stroke-width="2"/>` },
  passage:    { c: "石系", t: "崖間狹路", s: `<rect x="6" y="8" width="9" height="24" /><rect x="25" y="8" width="9" height="24" />` },
  // ── 水系 water ──
  lake:       { c: "水系", t: "湖／水塘", s: `<ellipse cx="20" cy="20" rx="14" ry="8" fill="none"/>` },
  pond:       { c: "水系", t: "池塘",     s: `<ellipse cx="20" cy="20" rx="8" ry="5" fill="none"/>` },
  waterhole:  { c: "水系", t: "水洞",     s: `<ellipse cx="20" cy="20" rx="7" ry="5"/>` },
  stream:     { c: "水系", t: "河溪／水道", s: `<path d="M8 10 Q14 20 20 16 Q26 12 32 22 Q34 26 30 30" fill="none"/>` },
  ditch:      { c: "水系", t: "小水道／溝渠", s: `<path d="M10 12 Q20 26 30 12" fill="none"/>` },
  nMarsh:     { c: "水系", t: "狹窄沼澤", s: `<path d="M8 16 H32 M8 24 H32" fill="none" stroke-dasharray="5 4"/>` },
  marsh:      { c: "水系", t: "沼澤",     s: `<path d="M8 12 H32 M8 20 H32 M8 28 H32" fill="none" stroke-dasharray="5 4"/>` },
  well:       { c: "水系", t: "水井",     s: `<circle cx="20" cy="20" r="8" fill="none"/><circle cx="20" cy="20" r="2.5"/>` },
  spring:     { c: "水系", t: "泉源",     s: `<path d="M8 30 Q20 8 32 30" fill="none"/>` },
  // ── 植被 vegetation ──
  openLand:   { c: "植被", t: "空曠地",   s: `<rect x="7" y="11" width="26" height="18" fill="none"/>` },
  semiOpen:   { c: "植被", t: "半空曠地", s: `<rect x="7" y="11" width="26" height="18" fill="none"/><circle cx="14" cy="17" r="1.6"/><circle cx="24" cy="23" r="1.6"/>` },
  clearing:   { c: "植被", t: "林中空地", s: `<rect x="7" y="11" width="26" height="18" fill="none" stroke-dasharray="5 4"/>` },
  forestCorner:{ c: "植被", t: "樹林之角", s: `<path d="M8 8 L8 32 L24 32 L24 16 L32 16 L32 8 Z" fill="none"/>` },
  thicket:    { c: "植被", t: "密林／密植叢", s: `<circle cx="20" cy="20" r="8"/><circle cx="20" cy="20" r="3" fill="#fff" stroke="none"/>` },
  hedge:      { c: "植被", t: "密樹籬",   s: `<rect x="6" y="17" width="28" height="6" rx="3"/>` },
  vegBound:   { c: "植被", t: "植物分界", s: `<path d="M6 20 H34" fill="none" stroke-dasharray="3 4"/>` },
  copse:      { c: "植被", t: "矮樹叢",   s: `<circle cx="14" cy="16" r="4" fill="none"/><circle cx="26" cy="24" r="4" fill="none"/>` },
  tree:       { c: "植被", t: "獨樹",     s: `<circle cx="20" cy="16" r="6" fill="none"/><line x1="20" y1="22" x2="20" y2="32"/>` },
  rootStock:  { c: "植被", t: "倒樹根",   s: `<path d="M8 30 Q20 12 32 30" fill="none"/><path d="M14 28 l-3 4 M20 26 v6 M26 28 l3 4" fill="none" stroke-width="2.4"/>` },
  // ── 人造物 man-made ──
  road:       { c: "人造", t: "大路",     s: `<line x1="6" y1="14" x2="34" y2="14" fill="none"/><line x1="6" y1="26" x2="34" y2="26" fill="none"/>` },
  path:       { c: "人造", t: "小徑／小道", s: `<path d="M6 20 H34" fill="none" stroke-dasharray="6 4"/>` },
  ride:       { c: "人造", t: "林中間隙", s: `<line x1="6" y1="20" x2="34" y2="20" fill="none"/>` },
  bridge:     { c: "人造", t: "行人橋",   s: `<line x1="6" y1="14" x2="34" y2="14" fill="none"/><line x1="6" y1="26" x2="34" y2="26" fill="none"/><line x1="6" y1="14" x2="6" y2="26" fill="none" stroke-width="2"/><line x1="34" y1="14" x2="34" y2="26" fill="none" stroke-width="2"/>` },
  powerLine:  { c: "人造", t: "電纜",     s: `<line x1="6" y1="20" x2="34" y2="20" fill="none"/><circle cx="12" cy="20" r="2"/><circle cx="28" cy="20" r="2"/>` },
  pylon:      { c: "人造", t: "電纜架／桿", s: `<path d="M10 30 L20 10 L30 30" fill="none"/><line x1="13" y1="22" x2="27" y2="22" fill="none"/>` },
  tunnel:     { c: "人造", t: "隧道",     s: `<path d="M6 14 L34 14" fill="none"/><path d="M6 14 Q6 30 20 30 Q34 30 34 14" fill="none"/>` },
  wall:       { c: "人造", t: "石牆",     s: `<line x1="6" y1="20" x2="34" y2="20" fill="none"/><path d="M10 20 v-4 M20 20 v-4 M30 20 v-4" stroke-width="2.4"/>` },
  fence:      { c: "人造", t: "圍欄",     s: `<line x1="6" y1="20" x2="34" y2="20" fill="none"/><path d="M10 20 v-6 M20 20 v-6 M30 20 v-6" stroke-width="2"/>` },
  crossing:   { c: "人造", t: "橫越點",   s: `<line x1="6" y1="14" x2="34" y2="14" fill="none"/><line x1="6" y1="26" x2="34" y2="26" fill="none"/><line x1="14" y1="10" x2="14" y2="30" stroke-width="2"/><line x1="26" y1="10" x2="26" y2="30" stroke-width="2"/>` },
  building:   { c: "人造", t: "建築物",   s: `<rect x="9" y="11" width="22" height="18"/>` },
  paved:      { c: "人造", t: "水泥地／鋪面", s: `<rect x="7" y="11" width="26" height="18" fill="none"/><path d="M7 20 H33 M16 11 V29" fill="none" stroke-width="2"/>` },
  ruin:       { c: "人造", t: "破毀房屋", s: `<rect x="9" y="11" width="22" height="18" fill="none"/>` },
  pipeline:   { c: "人造", t: "管道",     s: `<line x1="6" y1="20" x2="34" y2="20" fill="none" stroke-dasharray="2 3"/><circle cx="13" cy="20" r="2.4" fill="none"/><circle cx="27" cy="20" r="2.4" fill="none"/>` },
  tower:      { c: "人造", t: "塔架",     s: `<path d="M14 30 L20 12 L26 30" fill="none"/><line x1="16" y1="24" x2="24" y2="24" fill="none"/>` },
  highSeat:   { c: "人造", t: "射擊台／高座", s: `<line x1="8" y1="30" x2="32" y2="30" fill="none"/><path d="M20 30 L20 14 L28 10" fill="none"/>` },
  cairn:      { c: "人造", t: "石標誌／界石", s: `<path d="M12 30 L16 18 L24 18 L28 30 Z"/>` },
  monument:   { c: "人造", t: "紀念碑／塑像", s: `<line x1="20" y1="32" x2="20" y2="16" fill="none"/><circle cx="20" cy="12" r="4"/>` },
  steps:      { c: "人造", t: "階梯",     s: `<path d="M8 30 L14 30 L14 24 L20 24 L20 18 L26 18 L26 12 L32 12" fill="none"/>` },
};

/* ============ C 列:同類中哪一個 ============ */
export const WHICH = {
  upper:   { t: "上面的",     s: `<line x1="8" y1="12" x2="32" y2="12" fill="none"/><path d="${_tri(20,8,12,16)}" fill="none"/>` },
  lower:   { t: "下面的",     s: `<line x1="8" y1="28" x2="32" y2="28" fill="none"/><path d="${_tri(20,8,16,16)}" fill="none"/>` },
  middle:  { t: "中間的",     s: `<rect x="8" y="8" width="24" height="24" fill="none"/><rect x="16" y="16" width="8" height="8"/>` },
  north:   { t: "北方的",     s: northTick(20) },
  south:   { t: "南方的",     s: northTick(200) },
  east:    { t: "東方的",     s: northTick(110) },
  west:    { t: "西方的",     s: northTick(290) },
};
function northTick(deg) {
  const r = 13, cx = 20, cy = 20;
  const a = (deg - 90) * Math.PI / 180;
  const x = cx + r * Math.cos(a), y = cy + r * Math.sin(a);
  return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none"/><circle cx="${+x.toFixed(1)}" cy="${+y.toFixed(1)}" r="3.4"/>`;
}

/* ============ E 列:外觀 ============ */
export const APPEARANCE = {
  low:      { t: "低矮的",   s: `<rect x="9" y="16" width="22" height="8" fill="none"/>` },
  shallow:  { t: "淺的",     s: `<rect x="9" y="20" width="22" height="6" fill="none"/>` },
  deep:     { t: "深的",     s: `<rect x="9" y="12" width="22" height="16" fill="none"/>` },
  overgrown:{ t: "茂密的",   s: `<circle cx="14" cy="20" r="3"/><circle cx="20" cy="20" r="3"/><circle cx="26" cy="20" r="3"/>` },
  open:     { t: "開闊的",   s: `<circle cx="20" cy="20" r="9" fill="none"/>` },
  rocky:    { t: "多岩石的", s: `<circle cx="14" cy="16" r="2.6" fill="none"/><circle cx="24" cy="15" r="2.6" fill="none"/><circle cx="19" cy="24" r="2.6" fill="none"/><circle cx="27" cy="24" r="2.6" fill="none"/>` },
  marshy:   { t: "濕軟的",   s: `<path d="M8 18 H32 M8 26 H32" fill="none" stroke-dasharray="4 3"/>` },
  sandy:    { t: "多沙的",   s: `<circle cx="13" cy="15" r="1.5"/><circle cx="20" cy="13" r="1.5"/><circle cx="27" cy="16" r="1.5"/><circle cx="15" cy="24" r="1.5"/><circle cx="24" cy="26" r="1.5"/><circle cx="29" cy="22" r="1.5"/>` },
  conifer:  { t: "針葉的",   s: `<path d="${_tri(20,8,18,10)}" fill="none"/><line x1="20" y1="28" x2="20" y2="32" fill="none"/>` },
  broadleaf:{ t: "闊葉的",   s: `<circle cx="20" cy="16" r="7" fill="none"/><line x1="20" y1="23" x2="20" y2="32" fill="none"/>` },
  ruined:   { t: "倒塌的",   s: `<line x1="10" y1="10" x2="30" y2="30" fill="none"/><line x1="30" y1="10" x2="10" y2="30" fill="none"/>` },
};

/* ============ F 列:大小／組合(文字為主,符號輔助) ============ */
export const SIZE_SYMBOLS = {
  junction:  { t: "連接處", s: `<path d="M8 12 V28 M8 20 H28" fill="none"/>` },
  crossing:  { t: "交叉處", s: `<line x1="9" y1="9" x2="31" y2="31" fill="none"/><line x1="31" y1="9" x2="9" y2="31" fill="none"/>` },
  end:       { t: "盡頭",   s: `<line x1="10" y1="20" x2="30" y2="20" fill="none"/><line x1="30" y1="12" x2="30" y2="28"/>` },
  bend:      { t: "彎位",   s: `<path d="M8 12 Q26 12 26 30" fill="none"/>` },
};

/* ============ G 列:旗幟位置(羅盤式圓形 + 標記) ============ */
// 圓 + 在指定方位標一粗點/角標
function posCircle(deg, corner = false) {
  const r = 12, cx = 20, cy = 20;
  const a = (deg - 90) * Math.PI / 180;
  const x = cx + r * Math.cos(a), y = cy + r * Math.sin(a);
  if (corner) {
    return `<rect x="7" y="7" width="26" height="26" fill="none"/><path d="M${x.toFixed(1)} ${y.toFixed(1)} l${(-5 * Math.cos(a)).toFixed(1)} ${( -5 * Math.sin(a)).toFixed(1)} l${(5 * Math.cos(a + Math.PI/2)).toFixed(1)} ${(5 * Math.sin(a + Math.PI/2)).toFixed(1)} Z"/>`;
  }
  return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none"/><circle cx="${+x.toFixed(1)}" cy="${+y.toFixed(1)}" r="3.6"/>`;
}
export const POSITION = {
  nSide:  { t: "北面",     s: posCircle(0) },
  neSide: { t: "東北面",   s: posCircle(45) },
  eSide:  { t: "東面",     s: posCircle(90) },
  seSide: { t: "東南面",   s: posCircle(135) },
  sSide:  { t: "南面",     s: posCircle(180) },
  swSide: { t: "西南面",   s: posCircle(225) },
  wSide:  { t: "西面",     s: posCircle(270) },
  nwSide: { t: "西北面",   s: posCircle(315) },
  neCorner:{ t: "東北角",  s: posCircle(45, true) },
  seCorner:{ t: "東南角",  s: posCircle(135, true) },
  swCorner:{ t: "西南角",  s: posCircle(225, true) },
  nwCorner:{ t: "西北角",  s: posCircle(315, true) },
  onTop:  { t: "在頂上",   s: `<line x1="8" y1="13" x2="32" y2="13" fill="none"/><path d="M16 20 L20 14 L24 20 Z"/>` },
  beneath:{ t: "在底下",   s: `<path d="M16 20 L20 26 L24 20 Z"/><line x1="8" y1="27" x2="32" y2="27" fill="none"/>` },
  upper:  { t: "上部",     s: `<rect x="9" y="9" width="22" height="22" fill="none"/><rect x="9" y="9" width="22" height="10"/>` },
  lower:  { t: "下部",     s: `<rect x="9" y="9" width="22" height="22" fill="none"/><rect x="9" y="21" width="22" height="10"/>` },
  foot:   { t: "腳下",     s: `<path d="${_tri(20,8,16,9)}" fill="none"/><line x1="8" y1="28" x2="32" y2="28" fill="none"/>` },
  bend:   { t: "彎位",     s: `<path d="M8 12 Q26 12 26 30" fill="none"/><circle cx="26" cy="30" r="3"/>` },
  end:    { t: "盡頭",     s: `<line x1="9" y1="20" x2="29" y2="20" fill="none"/><circle cx="29" cy="20" r="3.4"/>` },
  junction:{ t: "連接處",  s: `<line x1="9" y1="9" x2="9" y2="31" fill="none"/><line x1="9" y1="20" x2="31" y2="20" fill="none"/>` },
  crossing:{ t: "交叉處",  s: `<line x1="9" y1="9" x2="31" y2="31" fill="none"/><line x1="31" y1="9" x2="9" y2="31" fill="none"/>` },
  between:{ t: "在兩者之間", s: `<line x1="8" y1="20" x2="32" y2="20" fill="none"/><circle cx="14" cy="20" r="2.6" fill="none"/><circle cx="26" cy="20" r="2.6" fill="none"/>` },
};

/* ============ H 列:其他 ============ */
export const OTHER = {
  firstAid:   { t: "救護站",         s: `<rect x="8" y="14" width="24" height="12" rx="2" fill="none"/><line x1="20" y1="16" x2="20" y2="24" fill="none"/><line x1="16" y1="20" x2="24" y2="20" fill="none"/>` },
  refresh:    { t: "水站／補給",     s: `<path d="M14 10 L14 30 M14 14 Q22 14 22 20 Q22 26 14 26" fill="none"/>` },
  radioTV:    { t: "電視／無線電站", s: `<path d="${_tri(20,9,16,10)}" fill="none"/><path d="M14 22 q6 -6 12 0 M11 26 q9 -9 18 0" fill="none" stroke-width="2"/>` },
  checkCard:  { t: "檢查控制咭",     s: `<rect x="9" y="11" width="22" height="18" rx="2" fill="none"/><line x1="13" y1="17" x2="27" y2="17" fill="none" stroke-width="2"/><line x1="13" y1="23" x2="27" y2="23" fill="none" stroke-width="2"/>` },
  manned:     { t: "有工作人員",     s: `<circle cx="20" cy="15" r="4" fill="none"/><path d="M12 30 Q20 20 28 30" fill="none"/>` },
};

/* ============ 起點 / 終點 符號 ============ */
export const START_SYM = `<path d="${_tri(20, 11, 18, 11)}" fill="none"/>`;
export const FINISH_SYM = `<circle cx="20" cy="20" r="10" fill="none"/><circle cx="20" cy="20" r="5" fill="none"/>`;

/* ============ 渲染 ============ */
function lookup(table, id) {
  return id && table[id] ? table[id].s : null;
}

/** 單格 HTML:已知 inner SVG 直接畫(響應式,隨格仔縮放);否則文字;空格留空。 */
function cell(inner, text, opts = {}) {
  const w = opts.w || 1;
  const cls = opts.cls || "";
  const body = inner
    ? `<svg class="cd-svg" viewBox="0 0 40 40" fill="${CD_PURPLE}" stroke="${CD_PURPLE}" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`
    : text
    ? `<span class="cd-txt">${text}</span>`
    : "";
  return `<td class="cd-c ${cls}" colspan="${w}">${body}</td>`;
}

/**
 * 產生整張提示符號表 HTML(紫紅格仔表)。
 * @param controls  排好序的控制點(含 cd 欄: {which,feature,appearance,size,position,other})
 * @param meta      { classes, lengthKm, climb }
 * @param finishM   由最後控制點至終點的距離(米)
 */
export function clueTableHTML(controls, meta = {}, finishM = 0) {
  const rows = [];
  // 表頭:組別 | 賽程長度 | 總爬升
  rows.push(
    `<tr class="cd-head">
      ${cell(null, meta.classes || "", { w: 2 })}
      ${cell(null, meta.lengthKm ? `${meta.lengthKm} km` : "", {})}
      ${cell(null, meta.climb ? `${meta.climb} m` : {}, { w: 5 })}
    </tr>`
  );
  // 起點行
  rows.push(
    `<tr><td class="cd-c cd-start" colspan="8">${symbolIcon(START_SYM, 18)}<span class="cd-txt cd-s">S</span></td></tr>`
  );
  // 各控制點(只計 kind=control;start/finish 另行處理)
  let seq = 0;
  controls.forEach((c) => {
    if (c.kind === "start" || c.kind === "finish") return;
    seq += 1;
    const cd = c.cd || {};
    const fInner = lookup(FEATURE, cd.feature);
    const wInner = lookup(WHICH, cd.which);
    const aInner = lookup(APPEARANCE, cd.appearance);
    const pInner = lookup(POSITION, cd.position);
    const oInner = lookup(OTHER, cd.other);
    const sizeTxt =
      cd.size != null && cd.size !== "" ? String(cd.size) : "";
    rows.push(
      `<tr>
        ${cell(null, String(seq), { cls: "cd-seq" })}             <!-- A 序號 -->
        ${cell(null, String(c.code), { cls: "cd-code" })}          <!-- B 編號 -->
        ${cell(wInner, "")}                                        <!-- C 哪個 -->
        ${cell(fInner, FEATURE[cd.feature]?.t?.[0] || "", { cls: "cd-feat" })}  <!-- D 特徵 -->
        ${cell(aInner, "")}                                        <!-- E 外觀 -->
        ${cell(null, sizeTxt, { cls: "cd-size" })}                 <!-- F 大小 -->
        ${cell(pInner, "")}                                        <!-- G 位置 -->
        ${cell(oInner, "")}                                        <!-- H 其他 -->
      </tr>`
    );
  });
  // 終點行
  rows.push(
    `<tr><td class="cd-c cd-finish" colspan="8">${
      finishM ? `<span class="cd-txt">${Math.round(finishM)} m</span>` : ""
    } ${symbolIcon(FINISH_SYM, 16)}</td></tr>`
  );
  return `<table class="cd-table">${rows.join("")}</table>`;
}

/** 給 picker UI 用:某分類的所有符號選項。 */
export function symbolOptions(table) {
  return Object.entries(table).map(([id, v]) => ({ id, t: v.t, c: v.c, inner: v.s }));
}
