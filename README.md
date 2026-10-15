# Scout System · 香港城市定向地圖

**不用登記、不用登入。打開網頁即可設計城市定向紙圖。**

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

**注意：** iB20000 是數碼地形**資料**，不是紙本 HM20C 的彩色 PDF 掃描。下載原檔適合 QGIS／CAD／離線列印。

## 城市定向功能

- 放置起點 △、檢查點 ○、終點 ◎，拖移調整
- 自動計算平面距離、方格方位、磁方位（約 3.1°W）
- 即時坐標：WGS84、**UTM 方格（KK／QK 8 位）**、6 位／8 位方格
- 可疊加 **UTM 方格網**，並在網線邊緣顯示 **E 東距／N 北距數字**，方便讀取 `KK 0794 6642`
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

瀏覽器開啟該位址即可。圖磚由使用者瀏覽器直接向 `mapapi.geodata.gov.hk` 讀取；開啟等高線時，瀏覽器會向 `services3.arcgis.com`（Esri China (HK) 公開的 iB20000 等高線圖層）查詢，程式見 `js/contours.js`。

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
