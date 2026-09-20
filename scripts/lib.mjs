/**
 * Scout System — 檢查工具共用函式（零依賴，只用 Node 內建模組）。
 * 這裡的規則同時是「防增肥」守門員：任何新檔案都要解釋得通，否則 check 會叫。
 */
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** 掃描時永遠跳過的資料夾（開發環境、依賴、快取）。 */
export const SKIP_DIRS = new Set([
  ".git",
  ".github",
  ".vercel",
  "node_modules",
  ".cache",
  ".next",
  ".nuxt",
  ".output",
  ".parcel-cache",
  ".svelte-kit",
  ".turbo",
  "coverage",
  "dist",
  "build",
  "out",
  ".venv",
  "__pycache__",
  ".idea",
  ".vscode",
]);

/** 唔需要被任何頁面引用的檔案（專案本身的說明／設定檔）。 */
export const NON_RUNTIME_ENTRIES = new Set([
  ".gitignore",
  ".vercelignore",
  "package.json",
  "package-lock.json",
  "vercel.json",
  "README.md",
  "防增肥規範.md",
  "教學.md",
]);

/**
 * 刻意保留、冇被任何頁面引用的檔案：
 *   print.html — 舊網址 /print 仍會 redirect 去設計頁，刪咗會 404（只有 0.8 KB）。
 */
export const INTENTIONAL_ORPHANS = new Set(["print.html"]);

/** 部署預算（未壓縮）。一旦超標就代表有人把大檔塞入嚟。 */
export const BUDGET = {
  totalBytes: 1.5 * 1024 * 1024, // 整個上傳內容 1.5 MB
  singleFileBytes: 400 * 1024, // 任何單一檔案 400 KB
};

/** 遞迴列出專案內所有檔案（相對路徑，用 / 分隔）。 */
export function walkFiles(dir = ROOT, base = ROOT, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      walkFiles(path.join(dir, entry.name), base, out);
    } else if (entry.isFile()) {
      out.push(path.relative(base, path.join(dir, entry.name)).split(path.sep).join("/"));
    }
  }
  return out;
}

export function readText(relPath) {
  return fs.readFileSync(path.join(ROOT, relPath), "utf8");
}

export function readBytes(relPath) {
  return fs.readFileSync(path.join(ROOT, relPath));
}

export function relSize(bytes) {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}

export function gzipSize(bytes) {
  return zlib.gzipSync(bytes, { level: 9 }).length;
}

function globToRegExp(pattern) {
  // 支援 * (單層)、** (任意層)、? (單字元)
  let re = "";
  for (let i = 0; i < pattern.length; i++) {
    const ch = pattern[i];
    if (ch === "*") {
      if (pattern[i + 1] === "*") {
        re += ".*";
        i++;
      } else {
        re += "[^/]*";
      }
    } else if (ch === "?") {
      re += "[^/]";
    } else if ("\\^$.|+()[]{}".includes(ch)) {
      re += `\\${ch}`;
    } else {
      re += ch;
    }
  }
  return new RegExp(`^${re}$`);
}

/**
 * 讀取 .vercelignore（gitignore 風格）並回傳判斷函式：
 * 「呢個檔案會唔會被上傳到 Vercel？」
 */
export function readVercelIgnore() {
  const file = path.join(ROOT, ".vercelignore");
  const lines = fs.existsSync(file)
    ? fs
        .readFileSync(file, "utf8")
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l && !l.startsWith("#"))
        .map((l) => l.replace(/\/+$/, ""))
    : [];
  const rules = lines.map((raw) => {
    const negated = raw.startsWith("!");
    const body = (negated ? raw.slice(1) : raw).replace(/^\/+/, "");
    return { negated, pattern: body, re: globToRegExp(body), hasSlash: body.includes("/") };
  });
  return {
    patterns: lines,
    isIgnored(relPath) {
      let ignored = false;
      const segments = relPath.split("/");
      for (const rule of rules) {
        const hit = rule.hasSlash
          ? rule.re.test(relPath)
          : segments.some((seg) => rule.re.test(seg));
        if (hit) ignored = !rule.negated;
      }
      return ignored;
    },
  };
}

/** 把頁面／程式碼內引用到的本機檔案抽出來（http(s)、data:、#、mailto 除外）。 */
export function collectLocalRefs(relPath, source) {
  const refs = new Set();
  const ext = path.extname(relPath);
  const add = (raw) => {
    if (!raw) return;
    let value = raw.trim().replace(/^['"]|['"]$/g, "");
    if (
      !value ||
      value.startsWith("http://") ||
      value.startsWith("https://") ||
      value.startsWith("//") ||
      value.startsWith("data:") ||
      value.startsWith("mailto:") ||
      value.startsWith("#") ||
      value.startsWith("tel:") ||
      value.includes("${") ||
      value.includes("\\")
    ) {
      return;
    }
    const clean = value.split(/[?#]/)[0];
    if (!clean || clean.startsWith("#")) return;
    if (/^[a-z][a-z0-9+.-]*:/i.test(clean)) return; // scheme:剩下嘅都唔係本機檔案
    refs.add(decodeURI(clean));
  };

  if (ext === ".html") {
    for (const m of source.matchAll(/\b(?:src|href)\s*=\s*"([^"]*)"|\b(?:src|href)\s*=\s*'([^']*)'/gi)) {
      add(m[1] ?? m[2]);
    }
    for (const m of source.matchAll(/url\(\s*['"]?([^'")]+)['"]?\s*\)/gi)) add(m[1]);
  }
  if (ext === ".css") {
    for (const m of source.matchAll(/url\(\s*['"]?([^'")]+)['"]?\s*\)/gi)) add(m[1]);
  }
  if (ext === ".js") {
    for (const m of source.matchAll(/\bfrom\s*["']([^"']+)["']/g)) add(m[1]);
    for (const m of source.matchAll(/\bimport\s*\(\s*["']([^"']+)["']\s*\)/g)) add(m[1]);
  }
  return refs;
}

/** 由引用檔案的所在位置解析成專案相對路徑（只回傳檔案，唔回傳根目錄）。 */
export function resolveRef(fromRelPath, ref) {
  if (!ref.startsWith("./") && !ref.startsWith("../") && !ref.includes("/") && !path.extname(ref)) return null;
  const dir = path.posix.dirname(fromRelPath);
  const target = path.posix.normalize(path.posix.join(dir, ref));
  if (target.startsWith("..")) return null;
  return target.replace(/^\//, "");
}

/**
 * 依 .vercelignore 計出「實際會上傳到 Vercel 嘅檔案清單同大小」。
 * 同時檢查有冇人漏咗排除開發檔（例如 node_modules、備份檔）。
 */
export function payloadStats() {
  const ignore = readVercelIgnore();
  const files = [];
  let total = 0;
  let gz = 0;
  for (const relPath of walkFiles()) {
    if (ignore.isIgnored(relPath)) continue;
    const bytes = fs.statSync(path.join(ROOT, relPath)).size;
    files.push({ path: relPath, bytes });
    total += bytes;
    gz += gzipSize(fs.readFileSync(path.join(ROOT, relPath)));
  }
  files.sort((a, b) => b.bytes - a.bytes || a.path.localeCompare(b.path));
  return { files, total, gzipTotal: gz, ignore };
}

/** 收集到嘅問題／提示。 */
export class Report {
  constructor(title) {
    this.title = title;
    this.errors = [];
    this.warnings = [];
    this.notes = [];
  }
  fail(message) {
    this.errors.push(message);
  }
  warn(message) {
    this.warnings.push(message);
  }
  note(message) {
    this.notes.push(message);
  }
  get ok() {
    return this.errors.length === 0;
  }
  print() {
    console.log(`\n=== ${this.title} ===`);
    for (const n of this.notes) console.log(`  · ${n}`);
    for (const w of this.warnings) console.log(`  ⚠ ${w}`);
    for (const e of this.errors) console.log(`  ✗ ${e}`);
    if (this.ok) {
      console.log(`  ${this.title}：全部通過（警告 ${this.warnings.length} 個）`);
    } else {
      console.log(`  ${this.title}：失敗，${this.errors.length} 個錯誤`);
    }
    return this.ok;
  }
}

/** 簡易 assert。 */
export function expect(report, condition, message) {
  if (!condition) report.fail(message);
  return Boolean(condition);
}

export function expectEqual(report, actual, expected, message) {
  const same = JSON.stringify(actual) === JSON.stringify(expected);
  if (!same) report.fail(`${message}（得到 ${JSON.stringify(actual)}，預期 ${JSON.stringify(expected)}）`);
  return same;
}
