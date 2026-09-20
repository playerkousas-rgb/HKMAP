/**
 * npm run build — 部署前守門員（唔會產生 dist／唔會 copy 任何檔案）。
 *
 * 本專案刻意唔用打包器：Vercel 直接食根目錄嘅靜態檔（outputDirectory 預設＝根目錄），
 * 所以「build」＝跑齊 check ＋ lint，再驗證 vercel.json／.vercelignore／package.json，
 * 最後印出實際上傳清單同容量。呢個設計令部署內容永遠等於 source，唔會出現重複嘅建置產物。
 */
import fs from "node:fs";
import path from "node:path";
import { readVercelIgnore, ROOT, readText, relSize, walkFiles } from "./lib.mjs";
import { run as runCheck } from "./check.mjs";
import { run as runLint } from "./lint.mjs";

const problems = [];

/** 驗證 vercel.json（部署設定）。 */
function verifyVercelConfig() {
  const file = path.join(ROOT, "vercel.json");
  if (!fs.existsSync(file)) {
    problems.push("缺少 vercel.json");
    return {};
  }
  let config;
  try {
    config = JSON.parse(readText("vercel.json"));
  } catch (error) {
    problems.push(`vercel.json 唔係合法 JSON：${error.message}`);
    return {};
  }

  // outputDirectory 係「有 build command 之後」嘅必需品：
  // Vercel 一跑 build 就會用 static-build pipeline，並要求 Output Directory 存在；
  // 本網站係根目錄直接部署，所以一定要明確寫 "."，唔可以靠 dashboard 嘅預設值（可能仲係 public）。
  if (config.outputDirectory !== ".") {
    problems.push(
      `vercel.json outputDirectory 必須係 "."（現在：${JSON.stringify(config.outputDirectory)}）；` +
        "否則 Vercel 跑 build 之後會報 No Output Directory found"
    );
  } else {
    const dir = path.join(ROOT, config.outputDirectory);
    if (!fs.existsSync(dir)) problems.push(`vercel.json outputDirectory 指向唔存在嘅資料夾：${config.outputDirectory}`);
  }
  if (!config.buildCommand) {
    problems.push("vercel.json 缺少 buildCommand：npm run build（部署前跑檢查）");
  }
  if (config.buildCommand && config.buildCommand !== "npm run build") {
    problems.push(`vercel.json buildCommand 唔係預期嘅 "npm run build"：${config.buildCommand}`);
  }
  if (config.installCommand && config.installCommand !== "npm install") {
    problems.push(`vercel.json installCommand 唔係預期嘅 "npm install"：${config.installCommand}`);
  }
  for (const rule of config.headers || []) {
    if (!rule.source || !Array.isArray(rule.headers)) {
      problems.push(`vercel.json headers 格式有問題：${JSON.stringify(rule)}`);
      continue;
    }
    for (const header of rule.headers) {
      if (!header.key || typeof header.value !== "string") {
        problems.push(`vercel.json header 缺少 key／value：${JSON.stringify(header)}`);
      }
      // 呢兩個 header 會令頁面唔可以嵌入 iframe（預覽會白畫面）
      if (/^x-frame-options$/i.test(header.key)) {
        problems.push(`vercel.json 唔應該加 X-Frame-Options（會擋住預覽 iframe）`);
      }
      if (/^content-security-policy$/i.test(header.key) && /frame-ancestors/i.test(header.value)) {
        problems.push("vercel.json 唔應該加 CSP frame-ancestors（會擋住預覽 iframe）");
      }
    }
  }
  return config;
}

/** 驗證 .vercelignore 真係擋得住應該擋嘅檔。 */
function verifyVercelIgnore() {
  const ignore = readVercelIgnore();
  const mustIgnore = [
    ".git/config",
    "node_modules/leaflet/dist/leaflet.js",
    "src/app.js.bak",
    "debug.log",
    "草稿.tmp",
    "old/index.old",
    "uploads/scan-01.jpg",
    ".DS_Store",
    "dist/index.html",
    "coverage/lcov.info",
    "README.md",
  ];
  const mustKeep = [
    "index.html",
    "download.html",
    "mock.html",
    "print.html",
    "css/app.css",
    "js/app.js",
    "assets/mark.svg",
    "教學.md",
    "vercel.json",
    "package.json",
    "scripts/build.mjs",
  ];
  for (const relPath of mustIgnore) {
    if (!ignore.isIgnored(relPath)) problems.push(`.vercelignore 漏咗：${relPath}（會白白上傳）`);
  }
  for (const relPath of mustKeep) {
    if (ignore.isIgnored(relPath)) problems.push(`.vercelignore 唔應該排除：${relPath}（會令網站／建置爛）`);
  }
  return ignore;
}

/** 驗證 package.json：零執行期依賴、工具放 devDependencies。 */
function verifyPackageJson() {
  let pkg;
  try {
    pkg = JSON.parse(readText("package.json"));
  } catch (error) {
    problems.push(`package.json 唔係合法 JSON：${error.message}`);
    return {};
  }
  const runtimeDeps = Object.keys(pkg.dependencies || {});
  if (runtimeDeps.length) {
    problems.push(`dependencies 唔應該有套件（本網站係純靜態，零執行期依賴）：${runtimeDeps.join(", ")}`);
  }
  const devDeps = Object.keys(pkg.devDependencies || {});
  for (const name of devDeps) {
    if (!/eslint|prettier|test|check|lint|typescript|vite|tailwind|rollup|esbuild|serve|live-server/i.test(name)) {
      problems.push(`devDependencies 出現唔似建置工具嘅套件：${name}（請確認真係需要）`);
    }
  }
  for (const script of ["check", "lint", "build"]) {
    if (!pkg.scripts?.[script]) problems.push(`package.json 缺少 npm run ${script}`);
  }
  if (pkg.type !== "module") problems.push('package.json 應該有 "type": "module"');
  return pkg;
}

/** 核心功能清單：每個頁面／模組／資產都要在。 */
function verifyCoreFiles() {
  const required = {
    "index.html": "設計＝列印主頁",
    "download.html": "電子地圖下載中心",
    "mock.html": "新使用者 MOCK／四步教學",
    "print.html": "舊網址 /print 轉址（保護 bookmark）",
    "css/app.css": "主介面＋列印樣式",
    "css/download.css": "下載頁樣式",
    "css/mock.css": "教學頁樣式",
    "js/app.js": "地圖、CP、比例、列印、暫存",
    "js/hkgeo.js": "UTM 方格／比例／紙張幾何",
    "js/overprint.js": "紫紅套印路線與 CP 圖示",
    "js/catalog.js": "官方下載資料",
    "js/download-page.js": "下載頁互動",
    "assets/mark.svg": "標誌／favicon",
    "教學.md": "文字教學（網站內有連結）",
  };
  const missing = Object.keys(required).filter((f) => !fs.existsSync(path.join(ROOT, f)));
  for (const f of missing) problems.push(`核心檔案唔見咗：${f}（${required[f]}）`);
  return { required, missing };
}

function printPayload(ignore) {
  const files = walkFiles();
  const kept = [];
  const dropped = [];
  let keptBytes = 0;
  let droppedBytes = 0;
  for (const relPath of files) {
    const size = fs.statSync(path.join(ROOT, relPath)).size;
    if (ignore.isIgnored(relPath)) {
      dropped.push({ path: relPath, size });
      droppedBytes += size;
    } else {
      kept.push({ path: relPath, size });
      keptBytes += size;
    }
  }
  kept.sort((a, b) => b.size - a.size);
  dropped.sort((a, b) => b.size - a.size);

  console.log("\n=== 實際上傳到 Vercel 嘅內容 ===");
  for (const file of kept) console.log(`  ${String(file.size).padStart(8)} B  ${file.path}`);
  console.log(`  ${"-".repeat(40)}`);
  console.log(`  合計 ${kept.length} 個檔案、${relSize(keptBytes)}（未壓縮）`);

  console.log("\n=== .vercelignore 擋住、唔會上傳 ===");
  if (!dropped.length) console.log("  （冇）");
  for (const file of dropped.slice(0, 20)) console.log(`  ${String(file.size).padStart(8)} B  ${file.path}`);
  if (dropped.length > 20) console.log(`  …另外 ${dropped.length - 20} 個`);
  console.log(`  ${"-".repeat(40)}`);
  console.log(`  擋住 ${dropped.length} 個檔案、省回 ${relSize(droppedBytes)}`);

  const gitDir = path.join(ROOT, ".git");
  if (fs.existsSync(gitDir)) {
    let gitBytes = 0;
    const stack = [gitDir];
    while (stack.length) {
      const dir = stack.pop();
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) stack.push(full);
        else gitBytes += fs.statSync(full).size;
      }
    }
    console.log(`  （另外 .git 約 ${relSize(gitBytes)} 亦唔會上傳）`);
  }
  return { keptBytes, droppedBytes, kept: kept.length, dropped: dropped.length };
}

async function main() {
  console.log("Scout System · 部署前檢查（零依賴，唔會產生 dist）");

  const checkReport = await runCheck();
  const checkOk = checkReport.print();
  const lintReport = runLint();
  const lintOk = lintReport.print();

  const config = verifyVercelConfig();
  const ignore = verifyVercelIgnore();
  const pkg = verifyPackageJson();
  verifyCoreFiles();
  const payload = printPayload(ignore);

  console.log("\n=== 部署設定 ===");
  console.log(`  vercel.json：cleanUrls=${config.cleanUrls ? "on" : "off"}、trailingSlash=${config.trailingSlash ?? "default"}`);
  console.log(`  建置指令：${config.buildCommand || "（未設定；Vercel 偵測到 npm run build 會自動執行）"}`);
  console.log(`  輸出路徑：${config.outputDirectory}（＝專案根目錄；網站冇獨立建置產物）`);
  console.log(`  執行期依賴：${Object.keys(pkg.dependencies || {}).length} 個（應為 0）`);
  console.log(`  header 規則：${(config.headers || []).length} 條`);

  console.log("\n=== build ===");
  if (problems.length) {
    for (const problem of problems) console.log(`  ✗ ${problem}`);
  }
  if (!checkOk || !lintOk || problems.length) {
    if (!checkOk) console.log("  ✗ npm run check 未通過");
    if (!lintOk) console.log("  ✗ npm run lint 未通過");
    console.log(`  build：失敗（${problems.length} 個設定錯誤）`);
    process.exitCode = 1;
    return;
  }
  console.log(`  build：全部通過 — 上傳 ${payload.kept} 個檔案／${relSize(payload.keptBytes)}，冇建置產物要同步`);
}

if (process.argv[1] && process.argv[1].endsWith("build.mjs")) {
  await main();
}
