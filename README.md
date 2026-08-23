# Scout System · 香港定向地圖

**不用登記、不用登入。打開網頁即可畫圖出紙。**

新使用者請先看：

- [mock.html](mock.html) — 畫面 MOCK／四步教學
- [教學.md](教學.md) — 完整文字說明

## 已連結的香港政府地圖

紙本 **HM20C**（1:20 000 地形圖）與 **郊區地圖（郊遊圖）** 是地政總署有版權的印刷品，並沒有整幅掃描公開圖磚。對應的電子產品是 **iB20000 數碼地形圖**（2026 年 2 月官方價目表：**免費 HK$0**）。本系統即時底圖來自同一套 i-系列資料。

| 模式 | 來源 | 說明 |
| --- | --- | --- |
| HM20C / iB20000 | [地政總署 Topographic Map API](https://portal.csdi.gov.hk/csdi-webpage/apidoc/TopographicMapAPI) | XYZ 圖磚，對應 iB20000／HM20C（等高線 20 m、道路、建築、小徑） |
| iB20000 原檔下載 | [香港地圖服務 2.0](https://www.hkmapservice.gov.hk/OneStopSystem/map-search?product=OSSCatB&series=iB20000) · [CSDI](https://portal.csdi.gov.hk/geoportal/?datasetId=landsd_rcd_1637224132564_22637) | FGDB / GML / DWG / DGN / GeoTIFF，約 18 幅，供 QGIS／CAD／離線 |
| 地名注記 | [Map Label API](https://portal.csdi.gov.hk/csdi-webpage/apidoc/MapLabelAPI) | 中文地名疊加 |
| 郊遊圖 | 地形圖 + 漁護署 CSDI | 郊野公園、遠足徑、標距柱 |
| 航空照片 | [Imagery Map API](https://portal.csdi.gov.hk/csdi-webpage/apidoc/ImageryMapAPI) | 官方航空照片 |

**注意：** iB20000 是數碼地形**資料**，不是紙本 HM20C 的彩色 PDF 掃描。山藝考核請繼續用正版紙圖。

圖幅索引可飛往 HM20C 15 幅地形圖，以及郊區地圖 5 幅（港島、大嶼山、新界西北、新界東北及中部、西貢及清水灣）。

## 定向功能

- 放置起點 △、檢查點 ○、終點 ◎，拖移調整
- 自動計算 **HK1980 平面距離**、方格方位、磁方位（約 3.1°W）
- 即時坐標：WGS84、HK1980 E/N、1 km / 100 m / 10 m 方格
- 可疊加 HK1980 1 km 方格網
- 標準比例 **1:5 000–1:20 000**：選定即對齊，可 **LOCK 比例**（🔒 停用縮放，比例不會飄成 1:18 990 之類）；鎖定比例會帶入列印頁
- 圈選範圍時即時顯示**該比例＋紙張下圖面可容納的最大範圍**（例如 A4 @ 1:20 000 ≈ 5.6 km × 3.4 km），超出會建議換比例或換紙張
- 列印頁預覽 = 實際列印頁（landscape 整頁），範圍裝得下就按該比例精確出圖
- 路線 JSON／GPX 匯出、匯入、列印檢查點表
- 本機暫存（瀏覽器 localStorage）

## 版權與條款

- 應用程式 © Scout System
- 底圖與航空照片 © 香港特別行政區政府地政總署 — 畫面已按規定標示 *Map from Lands Department* / *Aerial Photograph from Lands Department*
- 郊遊圖層 © 漁農自然護理署，經 [空間數據共享平台](https://portal.csdi.gov.hk/)
- 使用前請同意 [LandsD Map API 條款](https://portal.csdi.gov.hk/csdi-webpage/doc/TNC)
- **不要**把本系統當成山藝考核用紙本地圖的替代品

## 本機開啟

```bash
python3 -m http.server 8080 --bind 0.0.0.0
```

瀏覽器開啟該位址即可。圖磚由使用者瀏覽器直接向 `mapapi.geodata.gov.hk` 讀取。

## 成員下載電子地圖

開啟 `download.html`：

1. **電子 HM20C** — 官方免費 iB20000（香港地圖服務 2.0 登記後下載）
2. **電子郊遊圖** — 紙本 5 幅郊區地圖沒有掃描 PDF；改下 e香港街小比例 GeoPDF（按 5 個郊區對應）
3. **e香港街** — 2026 年 7 月版官方免費 GeoPDF，適合城市定向
4. **列印地圖**（`print.html`）：紙圖上套印紫紅 CP 圓圈與檢查點說明，給參加者使用
