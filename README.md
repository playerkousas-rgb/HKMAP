# Scout System · 香港城市定向地圖

**v1.1.0 · 由 SCOUT APP STORE 或通告圖書館進入，即可設計城市定向紙圖。不用登記或登入。** 新分頁直打網址會見到一粒「前往 APP STORE」掣；已放行嘅同一分頁可以重整。如瀏覽器支援加入主畫面，先經入口開到 **HKMAP**，再用瀏覽器選單加入。

### 入口、草稿同離線

- `vercel.json`：純靜態，`framework: null`、`outputDirectory: "."`；根目錄嘅 HTML／SW 直接部署。四個 HTML 入口都喺 charset 之後、title 之前同步載入同一份設定：`js/entry_v1.1.0.js`。
- `appKey: 'hkmap'`、`mode: 'entry-gate'`、`portalIds: ['appstore']`、`silentPortalIds: ['library']`、`allowStandalone: true`、`autoRedirectSeconds: 0`。冇 `supportNudge`、額外追蹤或後端驗票。`store_gate_v1.0.js` [原檔](https://github.com/playerkousas-rgb/readme/blob/4c63ac3096bf87fcff760b45b34adab14b1b2576/templates/vercel/store_gate_v1.0.js)由測試核對 SHA-256，唔直接改。
- 頂欄「讚好／收藏」只開新分頁去主站詳情卡，該頁先可以讚好／收藏。`getAppStoreUrl('hkmap')` 嘅 slug 係按 `hkmap.vercel.app` 對[主站 seed 第 43 行](https://github.com/playerkousas-rgb/website/blob/4d2e4dd2b5bc2c42987f261117755243edf88b01/migrations/20261116-app-slug-seed.sql#L43)核實；HKMAP 唔連主站資料庫。
- **路線係本機工作草稿，唔做匯出／匯入或上傳。** `localStorage` 原樣保留 `scout-system-courses-v1`（路線、CP、紙圖設定）及 `scout-system-landsd-terms`（條款）；`sessionStorage` 原有 `scout-offline-hint` 只記離線提示，閘門用 `hkmap.store_pass` 只記同一分頁已放行。冇 IndexedDB。停用／再開放 App 本身唔會清草稿；同一瀏覽器、同一 origin、未清網站資料先可以還原。換裝置、無痕或系統清理唔保證留得住。
- SW 只做離線快取（`landsd-tiles-v1`／`scout-app-v1`），冇 Push，冇 standalone manifest。出發前請**在線經入口打開**並試離線；全新一般分頁在冇網絡時無法經主站重新入場。

**既有交付約定：** `EXCEPTION: V1` — 保留已發佈嘅固定 HTML、`sw.js` 同原有資源路徑，避免破壞書籤及舊離線拷貝。新接線檔用檔名＋內文版號，HTML meta／title 同 `package.json` 同步；共用 gate 嘅 `v1.0` 唔係 App 版號。雙語方面，呢個 App 早於 docs/44 定案：設計頁有中英工具列／提示切換，SG18 文字、title、aria-label 跟住轉，但未全頁英化，語言亦唔寫入路線資料。

[準入驗收紀錄：本機模擬／真機待測](docs/entry-gate-review.md)

新使用者請先看：

- [mock.html](mock.html) — 畫面 MOCK／四步教學
- [教學.md](教學.md) — 完整文字說明
- [download.html?tab=qgis](download.html?tab=qgis) — QGIS 簡易教學：(1)(2)(3)… 逐步載入底圖、加等高線＋高度數字、地圖框線及方格網

## 已連結的香港政府地圖

紙本 **HM20C**（1:20 000 地形圖）是地政總署有版權的印刷品，並沒有整幅掃描公開圖磚。對應的電子產品是 **iB20000 數碼地形圖**（2026 年 2 月官方價目表：**免費 HK$0**）。本系統即時底圖來自同一套 i-系列資料。

| 模式 | 來源 | 說明 |
| --- | --- | --- |
| HM20C / iB20000 | [地政總署 Topographic Map API](https://portal.csdi.gov.hk/csdi-webpage/apidoc/TopographicMapAPI) | XYZ 圖磚，對應 iB20000／HM20C（道路、建築、小徑） |
| iB20000 原檔下載 | [香港地圖服務 2.0](https://www.hkmapservice.gov.hk/OneStopSystem/map-search?product=OSSCatB&series=iB20000) · [CSDI](https://portal.csdi.gov.hk/geoportal/?datasetId=landsd_rcd_1637224132564_22637) | FGDB / GML / DWG / DGN / GeoTIFF，供 QGIS／CAD／離線製圖 |
| 地名注記 | [Map Label API](https://portal.csdi.gov.hk/csdi-webpage/apidoc/MapLabelAPI) | 中文地名疊加 |
| 航空照片 | [Imagery Map API](https://portal.csdi.gov.hk/csdi-webpage/apidoc/ImageryMapAPI) | 官方航空照片，方便核對現場 |
| 等高線（可開關） | 地政總署 iB20000 `ELEVLINE`，經 [Esri China (HK) ArcGIS Online 公開圖層](https://www.arcgis.com/home/item.html?id=566289c35c214178b572a7e934a1cd9a) 即時查詢 | 每 20 m 一條、每 100 m 加粗，附高度數字（米）；比例約 1:33 000 或更大先顯示，只供參考 |

**注意：** iB20000 是數碼地形**資料**，不是紙本 HM20C 的彩色 PDF 掃描。HM20C / iB20000 模式的底圖、地名及等高線只調整顯示顏色，盡量接近紙本配色；地圖資料、坐標及比例不變。航空照片及郊遊圖保留原有配色。下載原檔適合 QGIS／CAD／離線列印。

### 同紙本 HM20C 一樣的方位（方格北向上）

紙本 HM20C 的圖廓同 UTM 方格線平行，即**方格北向上**；香港離 UTM 中央子午線（zone 49＝111°E、zone 50＝117°E）2–3°，所以紙上真北其實斜約 **0.9–1.2°**（zone 49 向東、zone 50 向西）。本系統**按 16 幅 HM20C 逐幅計**：每幅用自己中心的方格收斂角 γ = `atan(tan Δλ · sin φ)`，把整幅底圖轉 **−γ**，方格網打直、紙邊同方格線平行；同一幅內角度固定（同紙本一樣唔會邊行邊轉），幅與幅（尤其 114° 分界兩邊）角度唔同：

- 圖框右上角**北針**同時顯示方格北／真北／磁北，並會一齊列印（同紙本圖邊資料一樣）
- 右上角 **🧭 方格北 xx°** 顯示目前屬第幾幅同角度，可一按切回「真北向上」（方格線會斜返）
- 改動紙中心跨去另一幅（含跨 114° 分區）時，角度自動換成該幅的固定角度；圖名列會印明方位同幅號
- 分幅用 16 幅公佈中心做最近點（近似幅界）；角度本身是逐幅精算，唔影響方格／坐標讀數
- 底圖仍是 iB20000 數碼圖磚，所以只做到「方位、方格、比例、圖廓同紙圖一致」，地物符號同印刷配色始終同紙本有分別

## 離線底圖（活動前先下載）

現場冇訊號就冇圖，所以頂欄新增 **📥 離線**：預先把你會用到的地圖磚存入瀏覽器，之後斷網都睇得到、印得到。

- 範圍：**呢張紙**（白紙範圍＋邊界）或 **全港**；細節：到 1:20 000／1:10 000／1:5 000／1:2 500
- 下載前顯示「約 N 張圖磚（約 X MB）」，一次上限 2 000 張；有進度條、可中途停止
- 每次「開始下載」都**重新抓最新版本**（繞過舊快取），完成後顯示已存張數
- 斷網時顯示 **📴 離線模式** chip；HTML／CSS／JS 由 service worker 快取，連網站都開得返
- 上網時正常睇過的地圖磚亦會自動存起來（圖磚行 cache-first），所以即使未按「下載」，睇過嘅範圍斷網都仲有圖；想保證最新版本，出發前按一次「開始下載」
- 圖磚只存在用家部機（Cache Storage），唔會上傳、唔經本站後端；只快取地政總署 `basemap`／`label` 圖磚，郊遊圖（OpenTopoMap）同航空照片唔會大量抓取
- 需要 HTTPS（或 localhost）；iOS 等系統會在長期冇用後清理網站資料，出發前再按一次下載即可更新

程式：`sw.js`（service worker，根目錄）＋ `js/offline.js`（下載、估算、UI）。

## 城市定向功能

- 放置起點 △、檢查點 ○、終點 ◎，拖移調整
- **起點三角形列印唔會消失**：三角形用 inline SVG 繪畫（唔靠 CSS 背景圖），所以就算瀏覽器「背景圖形」關閉、或列印／另存 PDF，都照樣印得出；標記容器全透明，並固定喺圖磚、方格網、等高線同其他標記之上
- 自動計算平面距離、方格方位、磁方位（約 3.1°W）
- 即時坐標：WGS84、**UTM 方格（KK／QK 8 位）**、6 位／8 位方格
- 可疊加 **UTM 方格網**，並在網線邊緣顯示 **E 東距／N 北距數字**，方便讀取 `KK 0794 6642`
- 預設 **方格北向上**（同紙本 HM20C 一樣，整幅轉約 0.9–1.2°），附方格北／真北／磁北北針；可切回真北向上
- **等高線顯示／隱藏**：地圖右上角「等高線」、左欄勾選或快捷鍵 **E**。iB20000 每 20 m 一條（粗線每 100 m），高度數字沿線排列並避開檢查點；開咗會一齊列印，紙圖底部加圖例。航空照片底圖自動改用淺色線
- 城市定向常用比例：**1:2 500、1:4 000、1:5 000、1:7 500、1:10 000、1:15 000、1:20 000、1:25 000**；亦可輸入 **1:500–1:100 000 自訂比例**
- 可 **LOCK 比例**（停用縮放，比例不會漂移）；白紙上就是該比例印出
- **設計＝列印（WYSIWYG）**：中央白紙就是實際列印頁（A3/A4/A5、直向／橫向），紙外不會印。白紙上的地圖永遠按**真實 mm** 排版，所以畫面見到的範圍＝列印範圍。
- **換紙不改比例**：更換紙張／方向時比例保持不變（鎖定與否都一樣），紙張越大，畫面及列印的範圍越大。例如 1:5 000 橫向：A5 約 1 050 m × 635 m、A4 約 1 485 m × 945 m、A3 約 2 100 m × 1 380 m。想同一地區印大一點，就改用較細的比例分母（例如 1:4 000）。
- 桌面預設顯示實際 mm；手機／平板預設「預覽（自動貼合視窗）」——預覽只是把整張紙縮放顯示，地圖範圍與列印完全相同；「實際 mm」仍可用「螢幕寬度（cm）」校準成物理真實大小
- 列印檢查點說明表
- 本機暫存、返回／重做、量距
- **🐛 問題回報／意見回饋**：頂欄一個掣，Scout Admin 統一格式（可匿名，唔經本站後端）

## 版權與條款

- 應用程式 © Scout System
- 底圖與航空照片 © 香港特別行政區政府地政總署 — 畫面已按規定標示 *Map from Lands Department* / *Aerial Photograph from Lands Department*
- 使用前請同意 [LandsD Map API 條款](https://portal.csdi.gov.hk/csdi-webpage/doc/TNC)

## 本機開啟

```bash
python3 -m http.server 8080 --bind 0.0.0.0
```

用新分頁開本機位址可檢查單掣入口卡；`npm run check` 可離線驗兩個入口、分頁通行證、standalone 同 SG18 接線，唔需要加任何本機放行例外。圖磚由使用者瀏覽器直接向 `mapapi.geodata.gov.hk` 讀取；開啟等高線時，瀏覽器會向 `services3.arcgis.com`（Esri China (HK) 公開的 iB20000 等高線圖層）查詢，程式見 `js/contours.js`。

## 全家標準：瘦身系統 ＋ 統一回報系統

```bash
npm run check:slim      # 防增肥守門（零依賴，違反即 exit 1）
```

- **瘦身系統**：`.vercelignore`（上傳黑名單）＋ `scripts/slim-guard.mjs`（守門腳本）＋ `package.json`（命令入口）＋ `docs/瘦身與防增肥守則.md`（預算與流程）。本倉**零依賴、零 build**：Vercel 直接上傳靜態檔，所以「上線用唔到嘅嘢」一律靠黑名單擋住。守門同時檢查：單檔／總和體積預算、`css|js|assets` 死重、HTML 引用漏檔（防線上 404）、備份暫存檔、`uploads/`。PR／push 由 `.github/workflows/slim-check.yml` 自動跑。
- **統一回報系統**：`index.html` 一行接入 Scout Admin widget（`data-app="定向地圖"`），頂欄「🐛 回報」開 modal；資料直送區會 Apps Script——**唔經本站後端、唔使 API key、可匿名**。`download.html`／`mock.html` 用獨立回報頁連結（零 JS）；列印時 modal 自動收埋。詳見 `js/report.js` 與守則 §6。

## 成員下載電子地圖

開啟 `download.html`：

1. **電子 HM20C** — 官方免費 iB20000（香港地圖服務 2.0 登記後下載）
2. **e香港街** — 官方免費 GeoPDF，適合城市定向
3. **QGIS 簡易教學（框線＋等高線）** — (1)–(12) 逐步做：安裝 QGIS、載入 GeoTIFF／GML／FGDB、等高線（`ELEVLINE`）改棕色＋加高度數字（`HEIGHT`）、設定 A3/A4、加地圖外框／UTM 方格網並匯出 PDF。**要等高線必須下載 GML 或 FGDB**（GeoTIFF 是圖片，抽不出線）
4. **列印地圖** — `index.html` 內直接列印，紙圖上套印紫紅 CP 圓圈與檢查點說明
