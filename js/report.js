/*!
 * Scout Admin 統一回報系統 · 入口（統一回報格式 v1 · 2026 Scout System 全家標準）
 *
 * 全部 APP（圖書館、APP STORE、支部系統、旅系統、區系統、專章系統、路線規劃…）
 * 共用同一個 widget、同一個 payload、同一個 Apps Script 接收端、同一組 Sheet 欄位。
 * 新系統上線只貼一行 <script> 改 data-app，後端／後台一律唔使改。
 *
 * 本檔只負責「入口」，唔自己寫表格：
 *   1. 頂欄「🐛 回報」→ 打開 widget 自帶嘅 modal（#scoutw-overlay）
 *   2. widget 未 load 完 → 每 150 ms 重試，約 5 秒（用家一㩒就有得報）
 *   3. 真係 load 唔到（離線／被擋）→ 跌落 scout-admin 獨立回報頁
 *   4. script tag 冇咗（例如有人改 HTML 時刪咗）→ 主動補插一次
 *
 * widget 自帶嘅右下角浮動掣喺 app.css 收咗（佢會瞓喺 .credit 上面），
 * 入口一律用 [data-report-open] 按鈕／連結。資料唔經本站、唔使 API key、可匿名。
 */

const APP_NAME = "定向地圖";
const WIDGET_URL = "https://scout-admin-blue.vercel.app/widget.js";
const REPORT_PAGE = `https://scout-admin-blue.vercel.app/report.html?app=${encodeURIComponent(APP_NAME)}`;
const WAIT_MS = 150;
const MAX_TRIES = 34; // 約 5 秒

/** 搵到 modal 就開；冇就當未準備好（回 false）。 */
function openModal() {
  const overlay = document.getElementById("scoutw-overlay");
  if (overlay) {
    overlay.classList.add("open");
    const first = document.getElementById("scoutw_i_title");
    if (first && typeof first.focus === "function") first.focus({ preventScroll: true });
    return true;
  }
  const fab = document.getElementById("scoutw-fab");
  if (fab) {
    fab.click();
    return true;
  }
  return false;
}

function hasWidgetTag() {
  return !!document.querySelector('script[src*="widget.js"]');
}

/** widget 未掛入嚟 → 補插一行（widget 自己有 window flag，重覆載入安全）。 */
function ensureWidget() {
  if (hasWidgetTag() || document.getElementById("scoutw-fab")) return;
  const el = document.createElement("script");
  el.src = WIDGET_URL;
  el.async = true;
  el.setAttribute("data-app", APP_NAME);
  document.body.appendChild(el);
}

function openStandalonePage() {
  const win = window.open(REPORT_PAGE, "_blank", "noopener");
  // 彈窗被擋 → 直接帶用家去獨立回報頁，唔好報咗個錯就算。
  if (!win) window.location.href = REPORT_PAGE;
}

let waiting = false;

/** 打開回報 modal；必要時等 widget，等唔到就開獨立回報頁。 */
export function openScoutReport() {
  if (openModal()) return;
  ensureWidget();
  if (waiting) return;
  waiting = true;
  let tries = 0;
  const timer = setInterval(() => {
    tries += 1;
    if (openModal()) {
      clearInterval(timer);
      waiting = false;
      return;
    }
    if (tries >= MAX_TRIES) {
      clearInterval(timer);
      waiting = false;
      openStandalonePage();
    }
  }, WAIT_MS);
}

function bind() {
  document.querySelectorAll("[data-report-open]").forEach((el) => {
    if (el.dataset.reportBound === "1") return;
    el.dataset.reportBound = "1";
    el.addEventListener("click", (event) => {
      event.preventDefault();
      openScoutReport();
    });
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bind);
} else {
  bind();
}

// 俾 inline onclick／其他模組直接用（同 cubsbadge、member-portal 同一個函名）。
window.openScoutReport = openScoutReport;
window.SCOUT_REPORT_PAGE = REPORT_PAGE;
window.SCOUT_REPORT_APP = APP_NAME;
