/**
 * npm run lint — 零依賴 lint（唔用 ESLint，唔加 devDependency）。
 *
 * 規則針對本專案真正會出事嘅位：
 *   1. no-console / no-debugger — 出貨檔案唔可以有除錯殘留
 *   2. no-eval / no-new-function — 唔可以動態執行程式碼
 *   3. no-insecure-url — 唔可以用 http:// 載入外部資源
 *   4. no-localhost — 瀏覽器端唔可以寫死 localhost（要用相對路徑；預覽／正式都靠呢點）
 *   5. escaped-interpolation — 使用者輸入放入 HTML 前一定要 esc()
 *   6. no-duplicate-class-attr — 同一個 tag 唔可以有兩個 class 屬性（HTML 只認第一個）
 *   7. html-meta / img-alt / target=_blank rel=noopener
 *   8. orphan-css-class（警告）— CSS 定義咗但冇人用嘅 class（防增肥）
 *   9. 出貨目錄唔可以有測試檔、*.bak／*.tmp／*.log 殘留
 */
import { Report, readText, walkFiles } from "./lib.mjs";

/** 使用者可以改、放入 HTML 前一定要轉義嘅來源（c＝CP、ctrl＝套印、filter＝搜尋框…）。 */
const USER_ROOTS = new Set(["c", "ctrl", "control", "selected", "course", "state", "filter", "raw", "out"]);

/** CSS class 由 Leaflet 自己加嘅，唔使掃。 */
const CLASS_PREFIX_ALLOW = ["leaflet-"];

const HTML_SINK = /(innerHTML|outerHTML|insertAdjacentHTML|document\.write)\s*(?:\+)?=\s*$|\bhtml\s*:\s*$/;
const HAS_MARKUP = /<[a-zA-Z][^>]*>/;

/** 逐行。 */
function eachLine(source, fn) {
  source.split("\n").forEach((line, i) => fn(line, i + 1));
}

/** 找出原始碼內所有 template literal（支援 ${} 內再嵌 template literal）。 */
function templateLiterals(source) {
  const out = [];
  for (let i = 0; i < source.length; i++) {
    if (source[i] !== "`") continue;
    const start = i;
    let depth = 0;
    let body = "";
    let j = i + 1;
    for (; j < source.length; j++) {
      const ch = source[j];
      if (ch === "\\") {
        body += ch + (source[j + 1] ?? "");
        j++;
        continue;
      }
      if (ch === "$" && source[j + 1] === "{") {
        depth++;
        body += "${";
        j++;
        continue;
      }
      if (ch === "}" && depth > 0) {
        depth--;
        body += ch;
        continue;
      }
      if (ch === "`" && depth === 0) break;
      if (ch === "`") {
        // 巢狀 template literal：整個跳過
        let nested = 0;
        let k = j + 1;
        for (; k < source.length; k++) {
          if (source[k] === "\\") {
            k++;
            continue;
          }
          if (source[k] === "$" && source[k + 1] === "{") {
            nested++;
            k++;
            continue;
          }
          if (source[k] === "}" && nested > 0) {
            nested--;
            continue;
          }
          if (source[k] === "`" && nested === 0) break;
        }
        body += source.slice(j, k + 1);
        j = k;
        continue;
      }
      body += ch;
    }
    out.push({ start, end: j, body });
    i = j;
  }
  return out;
}

/** 抽取一段字串內所有 ${...} 表達式。 */
function interpolations(text) {
  const out = [];
  let start = text.indexOf("${");
  while (start !== -1) {
    let depth = 0;
    let end = -1;
    for (let i = start + 1; i < text.length; i++) {
      if (text[i] === "{") depth++;
      else if (text[i] === "}") {
        depth--;
        if (depth === 0) {
          end = i;
          break;
        }
      }
    }
    if (end === -1) break;
    out.push(text.slice(start + 2, end));
    start = text.indexOf("${", end);
  }
  return out;
}

function lineOf(source, index) {
  return source.slice(0, index).split("\n").length;
}

function lintShippedJs(report, file, source) {
  eachLine(source, (line, no) => {
    const where = `${file}:${no}`;
    if (!line.includes("lint-allow")) {
      if (/\bconsole\.(log|info|warn|error|debug|trace)\s*\(/.test(line)) {
        report.fail(`${where} 出貨檔案唔可以有 console.*（除錯殘留）`);
      }
      if (/\b(localhost|127\.0\.0\.1)\b/.test(line)) {
        report.fail(`${where} 瀏覽器端唔可以寫死 localhost — 請用相對路徑`);
      }
    }
    if (/\bdebugger\b/.test(line)) report.fail(`${where} 唔可以有 debugger`);
    if (/\beval\s*\(/.test(line) || /new\s+Function\s*\(/.test(line)) {
      report.fail(`${where} 唔可以動態執行字串程式碼（eval / new Function）`);
    }
    if (/["'`(]http:\/\//.test(line)) report.fail(`${where} 唔可以用 http://（要 https）`);
    for (const tag of line.match(/<[a-zA-Z][^>]*>/g) || []) {
      if ((tag.match(/\bclass\s*=/g) || []).length > 1) {
        report.fail(`${where} 同一個 tag 出現兩個 class 屬性（HTML 只認第一個）：${tag.slice(0, 80)}`);
      }
    }
  });

  // 使用者文字放入 HTML 前要 esc()
  for (const lit of templateLiterals(source)) {
    const prefix = source.slice(Math.max(0, lit.start - 90), lit.start);
    const intoHtml = HTML_SINK.test(prefix.replace(/\s+/g, " ").trimEnd()) || HAS_MARKUP.test(lit.body);
    if (!intoHtml) continue;
    for (const expr of interpolations(lit.body)) {
      const head = expr.trim().split(/[^A-Za-z_$]/)[0];
      if (!USER_ROOTS.has(head)) continue;
      if (/\besc(?:ape)?\s*\(/.test(expr)) continue;
      if (expr.includes("lint-allow")) continue;
      report.fail(
        `${file}:${lineOf(source, lit.start)} 使用者輸入 \${${expr.trim().slice(0, 40)}} 放入 HTML 前要 esc()`
      );
    }
  }
}

function lintHtml(report, file, source) {
  const rules = [
    [/<meta\s+charset=/i, "<meta charset>"],
    [/<meta\s+name="viewport"/i, "viewport meta"],
    [/<html[^>]*\blang=/i, "<html lang>"],
    [/<title>[^<]+<\/title>/i, "<title>"],
  ];
  for (const [re, label] of rules) {
    if (!re.test(source)) report.fail(`${file} 缺少 ${label}`);
  }
  for (const m of source.matchAll(/<img\b[^>]*>/gi)) {
    if (!/\balt\s*=/.test(m[0])) report.fail(`${file} <img> 缺少 alt：${m[0].slice(0, 70)}`);
  }
  for (const m of source.matchAll(/<a\b[^>]*target\s*=\s*"_blank"[^>]*>/gi)) {
    if (!/rel\s*=\s*"[^"]*noopener/.test(m[0])) {
      report.fail(`${file} target="_blank" 要加 rel="noopener"：${m[0].slice(0, 70)}`);
    }
  }
}

/** CSS class 有冇人用（包括 JS 動態砌出嚟嘅 `prefix-${}` 寫法）。 */
function checkOrphanClasses(report) {
  // 只計真正出貨嘅檔案：scripts/ 係工具，唔應該當成「有用家」（否則死 CSS 走得甩）
  const codeFiles = walkFiles().filter((f) => f.startsWith("js/") || f.endsWith(".html"));
  const haystack = codeFiles.map((f) => readText(f)).join("\n");
  const cssFiles = walkFiles().filter((f) => f.endsWith(".css"));
  const defined = new Map();
  for (const file of cssFiles) {
    const source = readText(file)
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/url\([^)]*\)/g, "");
    for (const m of source.matchAll(/\.(-?[A-Za-z_][\w-]*)/g)) {
      const name = m[1];
      if (!defined.has(name)) defined.set(name, file);
    }
  }
  for (const [name, file] of defined) {
    if (CLASS_PREFIX_ALLOW.some((p) => name.startsWith(p))) continue;
    const wordRe = new RegExp(`(^|[^\\w-])${name.replace(/-/g, "\\-")}([^\\w-]|$)`);
    if (wordRe.test(haystack)) continue;
    // grid-label-east → JS 有 `grid-label-${axis}` 呢種動態寫法
    const parts = name.split("-");
    let dynamic = false;
    for (let cut = parts.length - 1; cut >= 1 && !dynamic; cut--) {
      dynamic = haystack.includes(`${parts.slice(0, cut).join("-")}-\${`);
    }
    if (dynamic) continue;
    report.warn(`${file} 的 .${name} 冇任何 HTML／JS 用到（死 CSS，可以刪）`);
  }
  report.note(`CSS class 掃描：${defined.size} 個 class`);
}

export function run() {
  const report = new Report("lint");
  const files = walkFiles();
  const jsFiles = files.filter((f) => f.startsWith("js/") && f.endsWith(".js"));
  for (const file of jsFiles) lintShippedJs(report, file, readText(file));
  const htmlFiles = files.filter((f) => f.endsWith(".html"));
  for (const file of htmlFiles) lintHtml(report, file, readText(file));

  for (const file of files) {
    if (/\.(test|spec)\.(js|mjs)$/.test(file)) {
      report.fail(`測試檔唔應該放在出貨目錄：${file}（測試請放 scripts/）`);
    }
    if (/\.(bak|tmp|old|orig|rej|swp|log)$/.test(file)) {
      report.fail(`殘留備份／暫存檔：${file}`);
    }
  }

  checkOrphanClasses(report);
  report.note(`掃描檔案：${jsFiles.length} 個 JS、${htmlFiles.length} 個 HTML、共 ${files.length} 個檔案`);
  return report;
}

if (process.argv[1] && process.argv[1].endsWith("lint.mjs")) {
  const report = run();
  const ok = report.print();
  process.exitCode = ok ? 0 : 1;
}
