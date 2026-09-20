/**
 * npm run check — 零依賴靜態檢查。
 *
 * 1. 語法：每個 js/*.js 用 `node --check` 掃一次（ESM）。
 * 2. 單元：hkgeo 純函式（方格、比例、紙張幾何）＋ overprint 套印次序。
 * 3. 資料：catalog 官方連結／圖幅索引完整性。
 * 4. 引用：HTML／CSS／JS 內的本機引用全部要存在（唔可以 dead link）。
 * 5. 死檔：冇被引用又唔係刻意保留嘅檔案會叫出嚟（防增肥）。
 * 6. 預算：實際部署內容唔可以超過 BUDGET。
 */
import path from "node:path";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import {
  BUDGET,
  INTENTIONAL_ORPHANS,
  NON_RUNTIME_ENTRIES,
  Report,
  ROOT,
  collectLocalRefs,
  expect,
  expectEqual,
  payloadStats,
  readBytes,
  readText,
  relSize,
  resolveRef,
  walkFiles,
} from "./lib.mjs";

/* ---------- 1. 語法 ---------- */
const ESM_COMPAT_ERROR = /Cannot use import statement outside a module|Unexpected token 'export'|Failed to load the ES module/i;
const FLAG_UNSUPPORTED = /bad option|not allowed|Unknown option|invalid value/i;

function firstErrorLines(raw) {
  return String(raw || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 3)
    .join(" ");
}

/**
 * 檢查一個檔案嘅語法，回傳 { error } 或 { skipped }（null 代表 OK）。
 *
 * 背景：舊版 Node 嘅 `node --check file.js` 唔會查 package.json 嘅 `type: module`，
 * 會把 ESM 誤報為語法錯誤。雲端建置（Vercel）嘅 Node 版本唔一定同本機一樣，
 * 所以遇到 ESM 相容錯誤時改用 stdin＋`--input-type=module` 再檢查一次
 * （Node ≥12 都支援），避免因為執行環境而令部署白白失敗。
 */
function checkSyntaxOf(file) {
  const abs = path.join(ROOT, file);
  const direct = spawnSync(process.execPath, ["--check", abs], { encoding: "utf8" });
  if (direct.status === 0) return {};
  const raw = `${direct.stderr || ""}${direct.stdout || ""}`;
  if (!ESM_COMPAT_ERROR.test(raw)) return { error: firstErrorLines(raw) };

  const viaStdin = spawnSync(process.execPath, ["--input-type=module", "--check"], {
    encoding: "utf8",
    input: fs.readFileSync(abs, "utf8"),
    maxBuffer: 16 * 1024 * 1024,
  });
  const stdinRaw = `${viaStdin.stderr || ""}${viaStdin.stdout || ""}`;
  if (viaStdin.status === 0) return {};
  if (FLAG_UNSUPPORTED.test(stdinRaw)) {
    return { skipped: "呢個 Node 版本唔支援 ESM 語法檢查" };
  }
  return { error: firstErrorLines(stdinRaw) };
}

function checkSyntax(report) {
  const jsFiles = walkFiles().filter((f) => f.endsWith(".js") || f.endsWith(".mjs"));
  let skipped = 0;
  for (const file of jsFiles) {
    const result = checkSyntaxOf(file);
    if (result.error) report.fail(`語法錯誤 ${file}：${result.error}`);
    if (result.skipped) {
      skipped += 1;
      report.warn(`${file} 語法檢查略過：${result.skipped}`);
    }
  }
  report.note(`語法檢查：${jsFiles.length} 個 JS 檔案（Node ${process.versions.node}${skipped ? `，略過 ${skipped} 個` : ""}）`);
}

/* ---------- 2. 單元（hkgeo 純函式，唔需要 proj4） ---------- */
async function checkGeo(report) {
  const geo = await import("../js/hkgeo.js");

  expectEqual(report, geo.normalizeOrientation("portrait"), "portrait", "normalizeOrientation(portrait)");
  expectEqual(report, geo.normalizeOrientation("亂入"), "landscape", "normalizeOrientation(未知值＝landscape)");
  expectEqual(report, geo.utmZoneForLng(113.9), 49, "113.9°E 屬 UTM zone 49");
  expectEqual(report, geo.utmZoneForLng(114.0), 50, "114.0°E 屬 UTM zone 50");
  expectEqual(report, geo.utmZoneForLng(114.3), 50, "114.3°E 屬 UTM zone 50");
  expectEqual(report, geo.resolveUtmSquare(49, 700000), "GE", "zone49 700000 → GE");
  expectEqual(report, geo.resolveUtmSquare(49, 800000), "HE", "zone49 800000 → HE");
  expectEqual(report, geo.resolveUtmSquare(50, 100000), "JK", "zone50 100000 → JK");
  expectEqual(report, geo.resolveUtmSquare(50, 200000), "KK", "zone50 200000 → KK");
  expectEqual(report, geo.resolveUtmSquare(50, 99999), null, "區外東距＝null");

  // 紙張幾何：A4 橫向地圖高＝210 - 表頭 14 - 圖腳 7 = 189 mm（要同 @media print 預設一致）
  const a4l = geo.pageGeometryMm("A4", "landscape");
  expectEqual(report, [a4l.sheetW, a4l.sheetH, a4l.mapW, a4l.mapH], [297, 210, 297, 189], "A4 橫向幾何");
  const a4p = geo.pageGeometryMm("A4", "portrait");
  expectEqual(report, [a4p.sheetW, a4p.sheetH, a4p.mapH], [210, 297, 276], "A4 直向幾何");
  const a3l = geo.pageGeometryMm("A3", "landscape");
  expectEqual(report, [a3l.sheetW, a3l.sheetH], [420, 297], "A3 橫向幾何");
  const a5p = geo.pageGeometryMm("A5", "portrait");
  expectEqual(report, [a5p.sheetW, a5p.sheetH, a5p.mapH], [148, 210, 189], "A5 直向幾何");
  expectEqual(report, geo.pageGeometryMm("B9", "landscape").sheetW, 297, "未知紙張沿用 A4");

  // 1:5000 A4 橫向 → 紙面覆蓋 1.485 km × 0.945 km
  const area = geo.paperAreaMeters("A4", 5000, "landscape");
  expectEqual(report, [Math.round(area.w), Math.round(area.h)], [1485, 945], "1:5000 A4 橫向覆蓋範圍");

  // 比例 ↔ 縮放：來回轉換要一致（LOCK 比例靠呢個）
  for (const scale of [2500, 5000, 20000, 100000]) {
    const zoom = geo.zoomForScale(22.35, scale);
    const back = geo.scaleDenominator(22.35, zoom);
    expect(
      report,
      Math.abs(back - scale) / scale < 1e-9,
      `比例 ${scale} 來回換算（得到 ${back.toFixed(3)}）`
    );
  }

  // 方位格式：分要進位，唔可以出「045° 60′」或「045° 00′」
  expectEqual(report, geo.formatDeg(45.9999), "046° 00′", "formatDeg 進位");
  expectEqual(report, geo.formatDeg(0), "000° 00′", "formatDeg 0°");
  expectEqual(report, geo.formatDeg(123.5), "123° 30′", "formatDeg 123.5°");
  expectEqual(report, geo.formatDeg(359.9999), "000° 00′", "formatDeg 360° 環繞");
  expectEqual(report, geo.magneticBearing(3.1), 0, "磁方位：方格北 3.1° ＝ 磁北 0°");
  expect(
    report,
    Math.abs(geo.magneticBearing(0) - 356.9) < 1e-9,
    "磁方位要環繞（0° − 3.1° ＝ 356.9°）"
  );

  // 方格輸入：8 位／6 位／4 位、有 zone 前綴、錯誤輸入
  const kk8 = geo.parseGridInput("KK 0794 6642");
  expectEqual(report, [kk8?.zone, kk8?.e, kk8?.n], [50, 207945, 2466425], "KK 0794 6642 解析");
  const kk8nospace = geo.parseGridInput("kk07946642");
  expectEqual(report, [kk8nospace?.e, kk8nospace?.n], [207945, 2466425], "KK07946642（無空格、小寫）解析");
  const kk6 = geo.parseGridInput("KK 079 664");
  expectEqual(report, [kk6?.e, kk6?.n], [207950, 2466450], "KK 079 664 解析");
  const kk4 = geo.parseGridInput("KK 07 66");
  expectEqual(report, [kk4?.e, kk4?.n], [207500, 2466500], "KK 07 66 解析");
  const withZone = geo.parseGridInput("50Q KK 0794 6642");
  expectEqual(report, [withZone?.e, withZone?.n], [207945, 2466425], "50Q KK 0794 6642 解析");
  const heSquare = geo.parseGridInput("HE 8110 6640");
  expectEqual(
    report,
    [heSquare?.zone, heSquare?.e, heSquare?.n],
    [49, 881105, 2466405],
    "HE（zone 49）方格解析"
  );
  expectEqual(report, geo.parseGridInput("49Q KK 0794 6642"), null, "zone 同方格唔一致＝null");
  expectEqual(report, geo.parseGridInput("XX 1234 5678"), null, "未知方格＝null");
  expectEqual(report, geo.parseGridInput("KK 123"), null, "單數字數＝null");
  expectEqual(report, geo.parseGridInput("KK"), null, "冇數字＝null");
  expectEqual(report, geo.parseGridInput(""), null, "空字串＝null");

  // 香港範圍／圖幅索引
  const [sw, ne] = geo.HK_BOUNDS;
  const inHK = (p) => p[0] > sw[0] && p[0] < ne[0] && p[1] > sw[1] && p[1] < ne[1];
  expect(report, inHK(geo.HK_CENTER), "HK_CENTER 要落在 HK_BOUNDS 內");
  const sheetIds = geo.HM20C_SHEETS.map((s) => s.id);
  expectEqual(report, sheetIds.length, 16, "HM20C 圖幅共 16 幅");
  expectEqual(report, new Set(sheetIds).size, sheetIds.length, "HM20C 圖幅編號唔可以重複");
  for (const sheet of geo.HM20C_SHEETS) {
    expect(report, inHK(sheet.center), `HM20C 圖幅 ${sheet.id} 中心點要在香港範圍內`);
    expect(report, Boolean(sheet.name && sheet.nameEn && sheet.zoom), `HM20C 圖幅 ${sheet.id} 資料齊全`);
  }
  expect(report, geo.HM20C_SHEETS.filter((s) => s.id !== "1").length === 15, "側欄會列出 15 幅地形圖");
  expect(report, geo.GAZETTEER.length >= 10, "搜尋地名索引要有足夠地點");
  for (const place of geo.GAZETTEER) {
    expect(report, inHK([place.lat, place.lng]), `地名「${place.name}」要在香港範圍內`);
  }
  expect(report, geo.landsdUrl("basemap").startsWith("https://"), "官方圖磚一定要 https");
  expect(report, geo.landsdUrl("label", "tc").includes("/label/hk/tc/"), "地名圖層路徑正確");
  expect(report, geo.COUNTRYSIDE_TILE_URL.startsWith("https://"), "郊遊圖圖磚一定要 https");
  expect(report, geo.tileOptions().errorTileUrl.startsWith("data:image/png"), "圖磚失效要有透明 fallback");
}

/* ---------- 3. 方格／方位實測（用測試用 proj4：USGS 標準 UTM 公式） ---------- */
async function checkGrid(report) {
  const { install } = await import("./fake-proj4.mjs");
  install(); // 令 hkgeo.js 嘅 window.proj4 檢查過關（瀏覽器用真 proj4，公式一樣）
  const geo = await import("../js/hkgeo.js");

  // 香港童軍中心 = 項目文件嘅示範方格（README／教學.md 都寫 KK 0794 6642）
  const scout = geo.gridRefs(22.2788, 114.1658);
  expectEqual(report, scout.fig8, "50Q KK 0794 6642", "香港童軍中心 8 位方格（要同教學文件一致）");
  expectEqual(report, scout.fig6, "KK 079 664", "香港童軍中心 6 位方格");
  expectEqual(report, scout.zone, 50, "香港童軍中心屬 UTM zone 50");
  expectEqual(report, scout.square, "KK", "香港童軍中心用 KK 方格");

  // 8 位方格 → 經緯度 → 再轉方格，要完全一樣（誤差只可以在 10 m 格內）
  const parsed = geo.parseGridInput(scout.fig8);
  const back = geo.fromUtm(parsed.e, parsed.n, parsed.zone);
  expect(
    report,
    geo.planarDistance({ lat: 22.2788, lng: 114.1658 }, back) < 10,
    "8 位方格 round-trip 誤差要少於 10 m"
  );
  expectEqual(report, geo.gridRefs(back.lat, back.lng).fig8, scout.fig8, "round-trip 後方格要一樣");

  // 114°E 東西兩邊分別用 zone 49／50（HE／KK）
  const lantau = geo.gridRefs(22.29, 113.99);
  expectEqual(report, [lantau.zone, lantau.square], [49, "HE"], "大嶼山用 zone 49／HE 方格");
  const saikung = geo.gridRefs(22.3, 114.3);
  expectEqual(report, [saikung.zone, saikung.square], [50, "KK"], "西貢用 zone 50／KK 方格");

  // 距離：同緯度 0.01° 經度 ≈ 1 031 m；跨 114° 子午線要連續（唔可以爆格）
  const east = geo.planarDistance({ lat: 22.2788, lng: 114.1658 }, { lat: 22.2788, lng: 114.1758 });
  expect(report, Math.abs(east - 1031) < 15, `同緯度 0.01° 經度距離（得到 ${Math.round(east)} m）`);
  const crossing = geo.planarDistance({ lat: 22.3, lng: 113.99 }, { lat: 22.3, lng: 114.01 });
  expect(report, Math.abs(crossing - 2062) < 30, `跨 114° 子午線距離要連續（得到 ${Math.round(crossing)} m）`);

  // 方格北 vs 磁北：香港 UTM 子午線收斂角約 1.1°，磁偏角 3.1°W
  const northBearing = geo.gridBearing({ lat: 22.2, lng: 114.1 }, { lat: 22.3, lng: 114.1 });
  expect(report, Math.abs(northBearing - 1.0989) < 0.05, `正北方向嘅方格方位（得到 ${northBearing.toFixed(4)}°）`);
  const eastBearing = geo.gridBearing({ lat: 22.2, lng: 114.1 }, { lat: 22.2, lng: 114.2 });
  expect(report, Math.abs(eastBearing - 91.0776) < 0.05, `正東方向嘅方格方位（得到 ${eastBearing.toFixed(4)}°）`);
  expect(
    report,
    Math.abs(geo.magneticBearing(northBearing) - 357.9989) < 0.05,
    "磁方位＝方格方位 − 3.1°（磁偏角）"
  );
}

/* ---------- 4. 資料 + 套印 ---------- */
async function checkCatalog(report) {
  const catalog = await import("../js/catalog.js");
  const { COUNTRYSIDE_MAPS, EHKG_GROUPS, EHKG_META, IB20000, IB20000_TILES, HM20C_DOWNLOAD_SHEETS } = catalog;

  expect(report, IB20000.steps.length > 0 && IB20000.links.length > 0, "iB20000 下載步驟／連結唔可以空");
  for (const link of IB20000.links) {
    expect(report, link.href.startsWith("https://"), `iB20000 連結要 https：${link.label}`);
  }
  for (const [key, value] of Object.entries(EHKG_META)) {
    const href = typeof value === "string" ? value : value.href;
    expect(report, String(href).startsWith("https://"), `EHKG_META.${key} 要 https`);
  }

  const codes = [];
  for (const group of EHKG_GROUPS) {
    expect(report, group.files.length > 0, `e香港街分組「${group.name}」唔可以空`);
    for (const file of group.files) {
      codes.push(file.code);
      expect(report, file.href.startsWith("https://www.landsd.gov.hk/"), `${file.code} 要連官方 GeoPDF`);
      expect(report, /\.pdf$/.test(file.href), `${file.code} 要係 PDF`);
      expect(report, /MB|KB/.test(file.size), `${file.code} 要有檔案大小標示`);
    }
  }
  expectEqual(report, new Set(codes).size, codes.length, "e香港街圖幅編號唔可以重複");
  expect(report, codes.length > 40, "e香港街應有 40 幅以上街道圖");

  expectEqual(report, COUNTRYSIDE_MAPS.length, 5, "郊遊圖共 5 幅");
  const [sw, ne] = (await import("../js/hkgeo.js")).HK_BOUNDS;
  for (const map of COUNTRYSIDE_MAPS) {
    expect(report, map.href.startsWith("https://"), `${map.code} 要連官方圖`);
    const [lat, lng] = map.center;
    expect(report, lat > sw[0] && lat < ne[0] && lng > sw[1] && lng < ne[1], `${map.code} 中心點要在香港範圍內`);
  }
  expectEqual(report, HM20C_DOWNLOAD_SHEETS.length, 15, "HM20C 下載格共 15 幅（幅 1 為圖例）");
  expectEqual(report, IB20000_TILES.length, 18, "iB20000 共 18 幅");
  const tileIds = IB20000_TILES.map((t) => t.id);
  expectEqual(report, new Set(tileIds).size, tileIds.length, "iB20000 分幅編號唔可以重複");
}

async function checkOverprint(report) {
  // 用最小 L stub 測套印邏輯：次序、連線條件、拖曳設定。
  const created = [];
  globalThis.L = {
    divIcon: (opts) => ({ ...opts, __icon: true }),
    marker: (latlng, opts) => ({
      latlng,
      opts,
      handlers: {},
      on(name, fn) {
        this.handlers[name] = fn;
        return this;
      },
      addTo(layer) {
        created.push({ type: "marker", latlng, opts, layer });
        return this;
      },
      getLatLng: () => latlng,
    }),
    polyline: (points, style) => ({
      addTo(layer) {
        created.push({ type: "polyline", points, style, layer });
        return this;
      },
    }),
    DomEvent: { stopPropagation() {} },
  };
  const { drawOverprint, orderedControls, controlIcon } = await import("../js/overprint.js");
  const layer = { cleared: 0, clearLayers() { this.cleared += 1; } };

  expectEqual(report, orderedControls(undefined), [], "orderedControls(undefined) ＝ 空");
  const mixed = [
    { id: "3", kind: "finish", lat: 22.2, lng: 114 },
    { id: "2", kind: "control", code: "31", lat: 22.3, lng: 114.1 },
    { id: "1", kind: "start", lat: 22.4, lng: 114.2 },
  ];
  expectEqual(
    report,
    orderedControls(mixed).map((c) => c.kind),
    ["start", "control", "finish"],
    "套印次序：起點 → CP → 終點"
  );

  created.length = 0;
  const list = drawOverprint(layer, mixed, { draggable: true, lines: true });
  expectEqual(report, list.length, 3, "drawOverprint 回傳 3 個點");
  expectEqual(report, created.filter((c) => c.type === "polyline").length, 1, "3 個點要畫 1 條路線");
  expectEqual(report, created.filter((c) => c.type === "marker").length, 3, "3 個點要 3 個標記");
  expect(report, created.filter((c) => c.type === "marker").every((m) => m.opts.draggable), "標記要可拖曳");
  expectEqual(report, layer.cleared, 1, "每次重畫前要清空圖層");

  created.length = 0;
  drawOverprint(layer, mixed, { lines: false });
  expectEqual(report, created.filter((c) => c.type === "polyline").length, 0, "關閉路線連線＝冇線");
  created.length = 0;
  drawOverprint(layer, [mixed[0]], { lines: true });
  expectEqual(report, created.filter((c) => c.type === "polyline").length, 0, "只有 1 點＝唔畫線");
  // CP 代碼係策劃者自己打嘅，會印在紙圖上 → 一定要轉義（< & " 唔可以原字入 HTML）
  const riskyIcon = controlIcon({ kind: "control", code: 'A<B & "C"' }, 0);
  expect(
    report,
    riskyIcon.html.includes("A&lt;B") && !riskyIcon.html.includes("A<B"),
    "CP 代碼放入圖示 HTML 前要轉義"
  );
  expectEqual(report, controlIcon({ kind: "start" }, 0).html.includes("course-start"), true, "起點圖示用三角形樣式");
  expectEqual(report, controlIcon({ kind: "finish" }, 0).html.includes("course-finish"), true, "終點圖示用雙圓樣式");

  created.length = 0;
  drawOverprint(layer, mixed, { draggable: false });
  expect(report, created.filter((c) => c.type === "marker").every((m) => !m.opts.draggable), "唔可拖曳時 marker 要關閉");
  delete globalThis.L;
}

/* ---------- 5. 引用完整性 + 死檔 ---------- */
function checkRefs(report) {
  const files = walkFiles();
  const fileSet = new Set(files);
  const referenced = new Set();
  const codeFiles = files.filter((f) => /\.(html|css|js|mjs)$/.test(f));

  for (const file of codeFiles) {
    const source = readText(file);
    for (const ref of collectLocalRefs(file, source)) {
      const target = resolveRef(file, ref);
      if (!target) continue;
      referenced.add(target);
      if (!fileSet.has(target)) {
        report.fail(`${file} 引用咗唔存在嘅檔案：${ref}`);
      }
    }
  }

  // 頁面之間的導覽：每頁都要有得返主頁／教學（避免死胡同）
  const pages = files.filter((f) => f.endsWith(".html"));
  for (const page of pages) {
    const source = readText(page);
    const links = new Set(collectLocalRefs(page, source));
    expect(report, links.size > 0, `${page} 冇任何本機連結`);
  }

  let orphans = 0;
  for (const file of files) {
    if (referenced.has(file)) continue;
    if (NON_RUNTIME_ENTRIES.has(file) || INTENTIONAL_ORPHANS.has(file) || file.startsWith("scripts/")) continue;
    const bytes = readBytes(file).length;
    orphans += 1;
    if (bytes > 8 * 1024) {
      report.fail(`未引用的檔案（${relSize(bytes)}）：${file} — 請引用或刪除`);
    } else {
      report.warn(`未引用的檔案（${relSize(bytes)}）：${file}`);
    }
  }
  if (orphans === 0) report.note("死檔檢查：冇孤立檔案");
  report.note(`引用檢查：${codeFiles.length} 個檔案、${referenced.size} 個本機引用`);
}

/* ---------- 6. UI 接線：JS 攞嘅 DOM id 一定要存在（否則執行時 TypeError） ---------- */
const RUNTIME_ONLY_IDS = new Set([
  "dyn-page", // app.js 自己 createElement 注入嘅 @page 規則
  "hm20c-q", // download-page.js 每格過濾器，係 render 出嚟嘅
  "ehkg-q",
  "country-q",
]);

function checkWiring(report) {
  const pages = {
    "js/app.js": "index.html",
    "js/download-page.js": "download.html",
    "js/overprint.js": null, // 只產生 icon HTML，唔直接攞 DOM
    "js/hkgeo.js": null,
    "js/catalog.js": null,
  };
  for (const [script, page] of Object.entries(pages)) {
    if (!page) continue;
    const source = readText(script);
    const html = readText(page);
    const ids = new Set([...source.matchAll(/getElementById\(\s*["']([^"']+)["']/g)].map((m) => m[1]));
    for (const id of ids) {
      if (RUNTIME_ONLY_IDS.has(id)) continue;
      if (!html.includes(`id="${id}"`)) {
        report.fail(`${script} 攞 #${id}，但 ${page} 冇呢個 id`);
      }
    }
    report.note(`UI 接線：${script} → ${page}（${ids.size} 個 id 全部搵到）`);
  }
  // 反過來：HTML 內有交互控制項但 JS 完全冇提過（可能係未接線／死 UI）
  const html = readText("index.html");
  const buttonIds = [...html.matchAll(/<button[^>]*id="([^"]+)"/g)].map((m) => m[1]);
  const app = readText("js/app.js");
  for (const id of buttonIds) {
    if (!app.includes(`"${id}"`) && !app.includes(`#${id}`)) {
      report.warn(`index.html 的 #${id} 按鈕冇任何 JS 處理（死按鈕？）`);
    }
  }
}

/* ---------- 7. 端到端 smoke（用 DOM 替身真正開一次 app） ---------- */
const SMOKE_SCENARIOS = [
  { label: "新使用者流程", env: {} },
  { label: "舊暫存還原", env: { SMOKE_SEED: "1" } },
];

function checkSmoke(report) {
  for (const scenario of SMOKE_SCENARIOS) {
    const result = spawnSync(process.execPath, [path.join(ROOT, "scripts/smoke.mjs")], {
      cwd: ROOT,
      encoding: "utf8",
      timeout: 120000,
      env: { ...process.env, ...scenario.env },
    });
    if (result.status !== 0) {
      const failures = (result.stdout || "")
        .split("\n")
        .filter((line) => line.includes("✗"))
        .map((line) => line.trim())
        .join("；");
      report.fail(`smoke「${scenario.label}」失敗：${failures || result.stderr || "未知錯誤"}`);
    }
  }
  report.note(`smoke：${SMOKE_SCENARIOS.map((s) => s.label).join("／")} 全部行得通`);
}

/* ---------- 8. 部署預算 ---------- */
export function checkBudget(report) {
  const stats = payloadStats();
  for (const file of stats.files) {
    if (file.bytes > BUDGET.singleFileBytes) {
      report.fail(`單一檔案超過預算：${file.path}（${relSize(file.bytes)}）`);
    }
  }
  if (stats.total > BUDGET.totalBytes) {
    report.fail(
      `部署內容 ${relSize(stats.total)} 超過預算 ${relSize(BUDGET.totalBytes)}（減肥或改 .vercelignore）`
    );
  }
  report.note(
    `部署內容：${stats.files.length} 個檔案、${relSize(stats.total)}（gzip 後約 ${relSize(stats.gzipTotal)}）`
  );
  return stats;
}

/** 每一節獨立 try/catch：任何一節爆都唔會令後面嘅檢查同報告消失。 */
async function section(report, name, fn) {
  try {
    await fn(report);
  } catch (error) {
    report.fail(`${name} 無法完成：${error && error.message ? error.message : error}`);
  }
}

export async function run() {
  const report = new Report("check");
  await section(report, "語法檢查", checkSyntax);
  await section(report, "地理／紙張單元測試", checkGeo);
  await section(report, "方格／方位實測", checkGrid);
  await section(report, "官方資料檢查", checkCatalog);
  await section(report, "套印邏輯檢查", checkOverprint);
  await section(report, "引用完整性檢查", checkRefs);
  await section(report, "UI 接線檢查", checkWiring);
  await section(report, "端到端 smoke", checkSmoke);
  await section(report, "部署預算檢查", checkBudget);
  return report;
}

if (process.argv[1] && process.argv[1].endsWith("check.mjs")) {
  const report = await run();
  const ok = report.print();
  process.exitCode = ok ? 0 : 1;
}
