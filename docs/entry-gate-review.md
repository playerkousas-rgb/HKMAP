# HKMAP 準入驗收 · v1.1.0 · 2026-11-18

App：HKMAP ｜ APPKEY：`hkmap` ｜ 正式 host：`hkmap.vercel.app`。以下改動喺工作分支，唔係 production 驗收。

## 【REVIEW】改動前（`d7f66ec`）

1. **Vercel 發佈根目錄**：倉內實查 **是**：`.vercelignore:2` 指明根目錄即產物，`vercel.json` 係 `framework: null`，冇 public/web 或 build 步。Dashboard 實查 **否**：項目查詢回覆 Access denied，讀唔到線上覆寫。新版在 `vercel.json:4` 明訂 `outputDirectory: "."`。
2. **本機儲存 keys**：掃全倉（本站程式在根目錄及 `js/`；冇 `src/web/public/app` 四個目錄）。
   - `localStorage: scout-system-courses-v1`：**用家自建路線草稿**（名、起終點、CP、註記、集合／截止／緊急資料）＋紙圖／圖層／螢幕設定及下載頁跳圖位置。唔係淨係偏好。原版 `js/app.js:33,63–80,1607–1623`、`js/download-page.js:408–415`。
   - `localStorage: scout-system-landsd-terms`：記住同意地政總署條款。
   - `sessionStorage: scout-offline-hint`：本分頁曾否提示下載底圖。冇 IndexedDB、冇小遊戲分數。
   - **處理決定**：先因「有草稿、冇備份」停手；用戶確認路線唔係重要紀錄，唔做匯出／匯入。保留原 key、origin 及格式。
3. **Service Worker**：離線快取，冇 Web Push。`landsd-tiles-v1` 存圖磚，`scout-app-v1` 存網頁等資源。冇 standalone manifest。冇本站 `/api`；瀏覽器會向地政總署／OpenTopoMap 取底圖、向 ArcGIS 取等高線。屬專業製圖工具；原版可直接開網址／書籤，冇實際入口流量數據。
4. **雙語 L1–L6**：未做齊。右上角有 `EN`，原本只改記憶體狀態同部分提示，冇同步 HTML 語言、冇記住選擇。HKMAP 早於 docs/44 定案，舊 App 唔追溯。
5. **版號一致**：否。原本只有 `package.json` 寫 `1.0.0`，交付 HTML 無 app-version；新版保留固定路徑例外（見第 9 項）。
6. **自己跑嘅檢查**：`npm run check`：22/22 測試 PASS；slim guard 46 項通過，1 WARN（278.3 / 320.0 KB），0 FAIL。
7. **揭到嘅問題**：開新路線叫用戶先匯出 JSON，實際冇匯出操作。離線註冊放咗喺復原歷史快照而唔係正常開頁；教學／下載頁亦缺少 description。守門核對嘅本機引用冇漏檔；唔代表驗過每個第三方網址。

## 【UPGRADE】

8. **修咗**：`js/app.js:367,1842–1860,2016` 修正文案、語言掣及一次性離線初始化；`js/offline.js:109–114` 延後寫提示狀態失敗時靜默略過。`package.json:3,10`、四頁 HTML head 同可見版號統一 `v1.1.0`。`教學.md` 合併重複步驟，講清楚草稿同離線入場限制，保留原有 320 KB 預算。
9. **唔做**：按用戶決定唔加匯出／匯入；唔新增語言儲存 key。部分工具列／提示及 SG18 支援中英，唔當全站已符合 L1–L6。`EXCEPTION: V1`：舊有固定 HTML、SW、資源路徑唔改名，保留書籤／離線相容；新版接線檔檔名同內文一致。

## 【白名單】

10. `mode='entry-gate'`　`portalIds=['appstore']`　`silentPortalIds=['library']`　`allowStandalone=true`　`autoRedirectSeconds=0`　`supportNudge=關`。只新增 **session** key `hkmap.store_pass`（同分頁放行），冇新增 localStorage key。
11. **SG18 slug**：`hkmap`，按正式 host 對[主站 20261116-app-slug-seed.sql:43](https://github.com/playerkousas-rgb/website/blob/4d2e4dd2b5bc2c42987f261117755243edf88b01/migrations/20261116-app-slug-seed.sql#L43)。唔讀寫主站 Supabase。
12. **改咗**：`store_gate_v1.0.js:1–904` 原封抄自真理倉 `4c63ac30`；`js/entry_v1.1.0.js:1–19` 同步落閘、獲放行先綁 SG18。四頁 `:4–6` 載入；`index.html:84–90`、`download.html:37–41`、`mock.html:37–41` 有頂欄掣。`css/app.css:163–167,1040–1044,1210–1221` 處理 hidden、focus、觸控、窄屏及列印。`index.html:407–409`、`download.html:56–58` 唔喺攔截卡背後執行 App；`print.html:12–14` 放行後先轉去設計頁。`js/download-page.js:139` 站內返回設計沿用同一分頁。`sw.js:17–42,120–134` 同批快取閘門，斷網用新版入口，唔清草稿／圖磚。`scripts/test-entry.mjs`、`scripts/test-offline.mjs`、`scripts/slim-guard.mjs` 守接線、版本及離線資源。

## 【驗收】本機模擬 / 真機實測

本機：Headless Chromium 140、同一個本機 HTTPS origin，模擬 clean URLs。入口網頁、主站目的頁及外部資源用本機測試替身，地圖 JS 用原版 Leaflet 1.9.4／proj4 2.11.0；冇撳 production 主站、冇寫任何讚好或收藏。

| 項目 | 本機模擬 | 真機實測 |
|---|---|---|
| 13 APP STORE 入 | PASS：新分頁由入口連結入，`matchedPortalId=appstore`；同分頁重整保留通行證 | 真機未做 |
| 14 圖書館入 | PASS：`matchedPortalId=library`；由下載頁返設計可繼續用 | 真機未做 |
| 15 直打見 1 粒掣 | PASS：設計／下載／教學／舊列印入口都只見「前往 APP STORE」，唔見 SG18 或圖書館掣 | 真機未做 |
| 16 主畫面 | PASS：無 Referer／通行證，模擬 `display-mode: standalone` 放行；冇聲稱裝過 PWA | 真機未做 |
| 17 SG18 掣 | PASS：開新分頁至 `/?app=hkmap`、`opener` 為 null；中英文字／aria-label／title 一齊切換；360／430 px 冇水平溢出，掣高 40 px。阻擋 gate JS 時無 href 且保持隱藏。**未驗線上詳情卡** | 真機未做 |
| 18 列印隱藏 | PASS：模擬 print media，按鈕不顯示，紙圖仍可見 | 真機未做 |

**草稿回歸**：先用舊版實際建立一條有 1 個 CP 嘅路線，關分頁，喺同源換新版。新分頁直打 `?reset=1` 被攔後，原草稿字串逐字相同；由入口打開可還原、修改，重整仍有原 CP。另測 SW 更新前已有嘅圖磚快取項目仍在；已放行分頁離線重整可還原草稿，離線新分頁即使有舊 query URL 快取亦會見新版入口卡。

## 【其他】

19. **未做／風險**：冇部署、冇真機測試、冇改入口站或其他 repo。要在正式部署後用手機由兩個真入口撳入，確認 Referer、主站詳情卡、主畫面行為及列印。唔好用真實用戶草稿測清除。`npm run check` 改後 **30/30 PASS，guard 47 項通過、1 WARN、0 FAIL**（319.6 / 320.0 KB）。瀏覽器資料被清除、私隱分頁關閉、換瀏覽器或換網域，都唔保證能夠還原；前端閘門唔係登入或存取控制後端。
