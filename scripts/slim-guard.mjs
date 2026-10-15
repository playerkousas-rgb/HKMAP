#!/usr/bin/env node
/**
 * 瘦身系統 — 防增肥守門（2026 Scout System 全家標準）
 *
 * 對齊 AYP/scripts/check.js ＋ drawtheroute/scripts/slim-guard.mjs 嘅思路：
 * 「人會忘記，機器不會」——所有規範落喺呢個零依賴腳本，違反即 exit 1，
 * 防止 Vercel 儲存配額爆滿，同時要求**功能／UI／體驗 100% 零倒退**。
 *
 * 用法：`npm run check:slim`（或 `node scripts/slim-guard.mjs`）
 * 規則解釋與預算點名表：docs/瘦身與防增肥守則.md
 *
 * 守門規則（違反即 FAIL）：
 *  1. 必備檔案齊（4 個 HTML＋css/js/assets 骨架＋守門三寶）
 *  2. `.vercelignore` 必須存在且涵蓋必要黑名單模式
 *  3. 倉庫內不得出現備份／暫存檔、`uploads/`；已廢棄死重檔案不得復活
 *  4. 部署包（＝未被 .vercelignore 排除嘅檔案）逐檔尺寸 ＋ 總和預算
 *  5. 部署包完整性雙向核對：被引用嘅必須喺包內；喺包內無引用嘅＝死重
 *  6. 引用完整性：HTML／CSS／JS 入面所有本機引用都要對到實際檔案
 *  7. 回報系統（Scout Admin 統一 widget）接入完整，且列印時唔會出現
 *  8. `node_modules/`、`dist/`、`*.md`（教學頁除外）不得被誤部署／誤追蹤
 */

import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { join, relative, extname, dirname, resolve } from "node:path";
import { execSync } from "node:child_process";

// ROOT = 倉庫根（本檔喺 scripts/ 入面）
const ROOT = resolve(import.meta.dirname ? join(import.meta.dirname, "..") : process.cwd());
const problems = [];
const warns = [];
let checked = 0;

const ok = (msg) => { checked++; console.log(`  ✅ ${msg}`); };
const fail = (msg) => { problems.push(msg); console.log(`  ❌ ${msg}`); };
const warn = (msg) => { warns.push(msg); console.log(`  ⚠️  ${msg}`); };
const KB = (bytes) => `${(bytes / 1024).toFixed(1)} KB`;

/* ── 預算（byte）——要改預算＝刻意改呢度＋更新 docs/瘦身與防增肥守則.md＋落 changelog ── */
const BUDGET = {
  IMG: 64 * 1024, // assets/ 單一圖片／圖示
  HTML: 48 * 1024, // 單一 HTML 頁
  CODE: 128 * 1024, // 單一 js／css
  DEPLOY_TOTAL: 320 * 1024, // 部署包總和（上線體積）
  WARN_RATIO: 0.8, // 達預算 80% 即提示
};
/** 根目錄 HTML：entry ＋ 舊連結回落 stub（唔准因為「冇人 link」而刪）。 */
const ROOT_STUBS = ["print.html"];
/** 已廢棄死重：入返嚟即 FAIL（git history 係備份，唔准再放返）。 */
const DEAD_FILES = ["MD", "index.legacy.html", "js/app.legacy.js"];
/** 守門三寶。 */
const GUARD_FILES = [".vercelignore", "scripts/slim-guard.mjs", "docs/瘦身與防增肥守則.md"];
const CORE_FILES = [
  "index.html", "download.html", "mock.html", "print.html", "vercel.json",
  "css/app.css", "js/app.js", "js/report.js", "assets/mark.svg",
];
/** 回報系統（統一回報格式 v1）——全家標準，缺一项即紅。 */
const REPORT = {
  WIDGET_URL: "https://scout-admin-blue.vercel.app/widget.js",
  STANDALONE: "https://scout-admin-blue.vercel.app/report.html?app=",
  APP_NAME: "定向地圖",
};

/* ── 工具 ── */
const SKIP_DIRS = new Set([".git", ".vercel", "node_modules", "dist", ".idea", ".vscode", "coverage", ".cache"]);
const BAD_EXT = new Set([".bak", ".tmp", ".old", ".orig", ".swp", ".swo", ".log"]);

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(relative(ROOT, full).split("\\").join("/"));
  }
  return out;
}

const read = (rel) => { try { return readFileSync(join(ROOT, rel), "utf8"); } catch { return ""; } };
const sizeOf = (rel) => { try { return statSync(join(ROOT, rel)).size; } catch { return 0; } };

/** 極簡 gitignore 語意（夠用得嚅唔會養出第二個 bug）：支援 `*` glob、尾 `/`、頭 `/`、`!` 唔支援（本倉用唔到）。 */
function compileIgnore(text) {
  return text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith("#")).map((raw) => {
    const dirOnly = raw.endsWith("/");
    const pat = (dirOnly ? raw.slice(0, -1) : raw).replace(/^\//, "");
    const anchored = raw.includes("/");
    const re = new RegExp(
      anchored ? "^" + globSource(pat) + "(/|$)" : "(^|/)" + globSource(pat) + "(/|$)|(^|/)" + globSource(pat) + "$"
    );
    return { raw, re };
  });
}
function globSource(pat) {
  return pat.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, "[^/]*").replace(/\?/g, "[^/]");
}
const isIgnored = (rel, rules) => rules.some(({ re }) => re.test(rel));

/** 由一份檔案攞本機引用（html／css／js 通用）。 */
function localRefs(rel, text) {
  const out = new Set();
  const push = (raw) => {
    if (!raw) return;
    const clean = raw.trim().split("#")[0].split("?")[0];
    if (!clean || /^[a-z][a-z0-9+.-]*:/i.test(clean) || clean.startsWith("//") || clean.startsWith("data:") || clean.startsWith("mailto:") || clean.startsWith("tel:")) return;
    if (clean.startsWith("/")) {
      // 根對路徑：Vercel 平台自帶嘢（Insights 等）唔喺倉庫內，跳過。
      if (/^\/(_vercel|api)\//.test(clean)) return;
      out.add(clean.replace(/^\/+/, ""));
      return;
    }
    out.add(relative(ROOT, resolve(dirname(join(ROOT, rel)), clean)).split("\\").join("/"));
  };
  const file = rel;
  if (file.endsWith(".html")) {
    for (const m of text.matchAll(/(?:href|src|action)\s*=\s*["']([^"']+)["']/gi)) push(m[1]);
  } else if (file.endsWith(".css")) {
    for (const m of text.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/gi)) push(m[1]);
  } else {
    for (const m of text.matchAll(/(?:from|import)\s*\(?\s*["']([^"']+)["']/gi)) push(m[1]);
    for (const m of text.matchAll(/["'](assets\/[^"']+)["']/g)) push(m[1]);
  }
  return [...out].filter((p) => p && !p.startsWith("../"));
}

const allFiles = walk(ROOT).sort();
const htmlFiles = allFiles.filter((f) => f.endsWith(".html"));

/* ── 1. 必備檔案 ── */
console.log("\n1️⃣  必備檔案");
for (const f of [...CORE_FILES, ...GUARD_FILES]) {
  if (existsSync(join(ROOT, f))) ok(f);
  else fail(`缺少必備檔案：${f}（瘦身／回報系統嘅骨架，唔准刪）`);
}

/* ── 2. .vercelignore ── */
console.log("\n2️⃣  .vercelignore 部署黑名單");
const ignorePath = join(ROOT, ".vercelignore");
let ignoreRules = [];
if (!existsSync(ignorePath)) {
  fail(".vercelignore 不存在 — 部署會把文件、腳本、備份全部上傳");
} else {
  const ignoreText = read(".vercelignore");
  ignoreRules = compileIgnore(ignoreText);
  const REQUIRED = ["node_modules", ".git", "docs", "scripts", "*.log", "*.bak", "*.tmp", "*.old", ".DS_Store", "Thumbs.db", "*.map", "uploads/", "dist", "coverage"];
  for (const pat of REQUIRED) {
    if (ignoreText.includes(pat)) ok(`已排除 ${pat}`);
    else fail(`.vercelignore 缺少必要模式：${pat}`);
  }
  if (/(^|\n)MD(\n|\/)/.test(ignoreText)) ok("已排除根目錄死重雜檔 MD");
  else warn("未喺 .vercelignore 列明 MD（如果已刪除，保留黑名單可防復活）");
}

/* ── 3. 備份／暫存／死重 ── */
console.log("\n3️⃣  備份／暫存檔 ＋ 已廢棄死重（ uploads/ 、 *.bak 、MD …）");
const junk = allFiles.filter((f) => BAD_EXT.has(extname(f).toLowerCase()) || f.endsWith("~"));
if (!junk.length) ok("沒有備份／暫存／日誌檔");
else junk.forEach((f) => fail(`發現備份／暫存檔：${f} — 請刪除，版本控制交返畀 Git`));
if (allFiles.some((f) => f.startsWith("uploads/"))) fail("發現 uploads/ — 嚴禁引入會持續累積儲存空間嘅機制");
else ok("沒有 uploads/");
const revived = DEAD_FILES.filter((f) => existsSync(join(ROOT, f)));
if (!revived.length) ok(`已廢棄檔案零復活（${DEAD_FILES.length} 項黑名單）`);
else revived.forEach((f) => fail(`已廢棄死重檔案復活：${f} — git history 先係備份，唔准再入倉`));
const dotJunk = allFiles.filter((f) => /(^|\/)\.DS_Store$|Thumbs\.db$/.test(f));
if (!dotJunk.length) ok("沒有 .DS_Store／Thumbs.db");
else dotJunk.forEach((f) => fail(`系統暫存檔入咗倉：${f}`));

/* ── 4. 部署包尺寸預算 ── */
console.log("\n4️⃣  部署包體積（逐檔 ＋ 總和）");
const deploySet = ignoreRules.length ? allFiles.filter((f) => !isIgnored(f, ignoreRules)) : allFiles;
let deployTotal = 0;
for (const f of deploySet) {
  const size = sizeOf(f);
  deployTotal += size;
  const ext = extname(f).toLowerCase();
  let limit = BUDGET.CODE;
  if (/\.(png|jpe?g|gif|webp|avif|svg|ico)$/.test(ext)) limit = BUDGET.IMG;
  else if (ext === ".html") limit = BUDGET.HTML;
  if (size > limit) fail(`肥重檔案：${f}（${KB(size)} > ${KB(limit)}）— 壓縮／拆細／搬走，唔准調高預算`);
  else if (size > limit * BUDGET.WARN_RATIO) warn(`接近上限：${f}（${KB(size)} / ${KB(limit)}）`);
}
if (deployTotal > BUDGET.DEPLOY_TOTAL) fail(`部署總和超標：${KB(deployTotal)} > ${KB(BUDGET.DEPLOY_TOTAL)}`);
else if (deployTotal > BUDGET.DEPLOY_TOTAL * BUDGET.WARN_RATIO) warn(`部署總和 ${KB(deployTotal)} 已達預算 ${KB(BUDGET.DEPLOY_TOTAL)} 嘅 80%`);
else ok(`部署總和 ${KB(deployTotal)} ≤ 預算 ${KB(BUDGET.DEPLOY_TOTAL)}（${deploySet.length} 檔）`);
console.log(`  📦 最大 3 檔：${deploySet.map((f) => [f, sizeOf(f)]).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([f, s]) => `${f} ${KB(s)}`).join(" · ")}`);

/* ── 5. 部署包雙向核對：漏檔／死重 ── */
console.log("\n5️⃣  部署包完整性（引用 ↔ 實際檔案）");
const refsByFile = new Map();
for (const f of allFiles.filter((x) => /\.(html|css|js)$/.test(x))) refsByFile.set(f, localRefs(f, read(f)));
const referenced = new Set();
for (const refs of refsByFile.values()) for (const r of refs) referenced.add(r);
const deploySet2 = new Set(deploySet);
let missing = 0;
for (const r of referenced) {
  if (r.startsWith("node_modules/") || r.startsWith("http")) continue;
  const existsInRepo = existsSync(join(ROOT, r)) || existsSync(join(ROOT, `${r}.html`));
  const willDeploy = deploySet2.has(r) || deploySet2.has(`${r}.html`) || ROOT_STUBS.includes(r);
  if (!existsInRepo) { fail(`引用咗但檔案唔存在：${r}（死 link）`); missing++; }
  else if (!willDeploy) { fail(`引用咗但被 .vercelignore 排除 → 線上會 404：${r} — 要嘛改引用，要嘛由黑名單拎走`); missing++; }
}
if (!missing) ok(`全部本機引用都存在且會部署（${referenced.size} 項）`);
// css/ js/ assets/ 入面冇人引用嘅檔＝死重（放低咗忘記刪）
const reallyDead = deploySet.filter((f) => /^(css|js|assets)\//.test(f) && !referenced.has(f));
if (!reallyDead.length) ok("css/ js/ assets/ 無死重（每個檔都有人引用）");
else reallyDead.forEach((f) => fail(`死重資源（冇人引用仲上線）：${f} — 刪除或喺入面引用返佢`));
const rootStrays = allFiles.filter((f) => !f.includes("/") && !/^(index|download|mock|print)\.html$|^vercel\.json$|^package\.json$|^\.vercelignore$|^\.gitignore$|^README\.md$|^MD$|^教學\.md$/ .test(f));
if (!rootStrays.length) ok("根目錄冇額外雜檔");
else rootStrays.forEach((f) => warn(`根目錄新檔：${f} — 問一句「上線用唔用到？」用唔到就放 docs/ 或加黑名單`));

/* ── 6. 回報系統（Scout Admin 統一 widget） ── */
console.log("\n6️⃣  統一回報系統接入（Scout Admin · 統一回報格式 v1）");
const indexHtml = read("index.html");
const cssApp = read("css/app.css");
const reportJs = read("js/report.js");
const widgetRe = new RegExp(`<script src="${REPORT.WIDGET_URL.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}" data-app="${REPORT.APP_NAME}"></script>`);
if (widgetRe.test(indexHtml)) ok(`index.html 有 widget 一行（data-app=\"${REPORT.APP_NAME}\"）`);
else fail(`index.html 缺少回報 widget：<script src=\"${REPORT.WIDGET_URL}\" data-app=\"${REPORT.APP_NAME}\"></script>`);
if (/<script type="module" src="js\/report\.js"><\/script>/.test(indexHtml)) ok("index.html 載入 js/report.js（入口按鈕）");
else fail("index.html 未載入 js/report.js —「🐛 回報」按鈕會冇反應");
if (/id="btn-report"[^>]*data-report-open/.test(indexHtml)) ok("頂欄有「🐛 回報」入口（data-report-open）");
else fail("index.html 頂欄缺 [data-report-open] 入口");
if (/data-report-open/.test(reportJs) && /scoutw-overlay/.test(reportJs) && /report\.html\?app=/.test(reportJs)) ok("js/report.js：綁定入口 ＋ 開 modal ＋ 獨立頁回落");
else fail("js/report.js 唔完整（要綁定 [data-report-open]、開 #scoutw-overlay、回落 report.html?app=）");
if (/#scoutw-fab\s*{\s*display:\s*none/.test(cssApp)) ok("css/app.css 收起 widget 自帶 FAB（唔會瞓住 .credit）");
else fail("css/app.css 冇收 #scoutw-fab — 右下角浮動掣會蓋住地政總署版權聲明");
if (/#scoutw-root/.test(cssApp.slice(cssApp.indexOf("@media print")))) ok("@media print 收埋 #scoutw-root（回報 modal 唔會印落紙）");
else fail("@media print 冇收 #scoutw-root — 列印時可能印出回報表格");
for (const page of ["download.html", "mock.html"]) {
  const html = read(page);
  if (html.includes(`${REPORT.STANDALONE}${encodeURIComponent(REPORT.APP_NAME)}`) || html.includes(`${REPORT.STANDALONE}${REPORT.APP_NAME}`)) ok(`${page} 有獨立回報頁連結（零 JS、零體重）`);
  else fail(`${page} 冇回報入口：加 <a class="nav" href="${REPORT.STANDALONE}${REPORT.APP_NAME}">（呢啲頁唔使掛完整 widget）`);
}
const strayWidget = htmlFiles.filter((f) => read(f).includes("widget.js") && !["index.html"].includes(f));
if (!strayWidget.length) ok("print.html／其他頁冇多掛 widget（減少外連＋列印雜訊）");
else strayWidget.forEach((f) => fail(`${f} 唔该掛 widget：呢頁要靜／要列印，用獨立回報頁連結即可`));

/* ── 7. Git 追蹤範圍 ── */
console.log("\n7️⃣  Git 追蹤範圍");
try {
  const tracked = execSync("git ls-files", { cwd: ROOT, encoding: "utf8" }).split("\n").filter(Boolean);
  const leaked = tracked.filter((f) => f.startsWith("node_modules/") || f.startsWith("dist/") || f.startsWith(".vercel/"));
  if (!leaked.length) ok("node_modules/、dist/、.vercel/ 未被 git 追蹤");
  else leaked.slice(0, 5).forEach((f) => fail(`git 唔應追蹤：${f}`));
  const total = tracked.reduce((sum, f) => sum + sizeOf(f), 0);
  console.log(`  📦 Git 追蹤總量：${KB(total)}（${tracked.length} 檔）· 部署包 ${KB(deployTotal)}（${deploySet.length} 檔）`);
} catch {
  warn("讀唔到 git ls-files（唔係 git 倉？）— 跳過追蹤範圍檢查");
}

/* ── 結果 ── */
console.log("\n──────────────────────────────────────────");
if (!problems.length) {
  console.log(`✅ 瘦身守門通過：${checked} 項檢查全綠${warns.length ? `（${warns.length} 項提示）` : ""}`);
  console.log("   回報系統：widget ＋ 頂欄入口 ＋ 列印遮蔽 ＋ 獨立頁回落，全部就緒。");
  process.exit(0);
}
console.log(`❌ 瘦身守門失敗：${problems.length} 項違規`);
for (const p of problems) console.log(`   · ${p}`);
console.log("   修法見 docs/瘦身與防增肥守則.md（唔准為咗過 check 而調高預算）");
process.exit(1);
