# Scout System · 香港城市定向地圖

**不用登記、不用登入。打開網頁即可設計城市定向紙圖。**

新使用者請先看：

- [mock.html](mock.html) — 畫面 MOCK／四步教學
- [教學.md](教學.md) — 完整文字說明

## 已連結的香港政府地圖

紙本 **HM20C**（1:20 000 地形圖）是地政總署有版權的印刷品，並沒有整幅掃描公開圖磚。對應的電子產品是 **iB20000 數碼地形圖**（2026 年 2 月官方價目表：**免費 HK$0**）。本系統即時底圖來自同一套 i-系列資料。

| 模式 | 來源 | 說明 |
| --- | --- | --- |
| HM20C / iB20000 | [地政總署 Topographic Map API](https://portal.csdi.gov.hk/csdi-webpage/apidoc/TopographicMapAPI) | XYZ 圖磚，對應 iB20000／HM20C（道路、建築、小徑） |
| iB20000 原檔下載 | [香港地圖服務 2.0](https://www.hkmapservice.gov.hk/OneStopSystem/map-search?product=OSSCatB&series=iB20000) · [CSDI](https://portal.csdi.gov.hk/geoportal/?datasetId=landsd_rcd_1637224132564_22637) | FGDB / GML / DWG / DGN / GeoTIFF，供 QGIS／CAD／離線製圖 |
| 地名注記 | [Map Label API](https://portal.csdi.gov.hk/csdi-webpage/apidoc/MapLabelAPI) | 中文地名疊加 |
| 航空照片 | [Imagery Map API](https://portal.csdi.gov.hk/csdi-webpage/apidoc/ImageryMapAPI) | 官方航空照片，方便核對現場 |

**注意：** iB20000 是數碼地形**資料**，不是紙本 HM20C 的彩色 PDF 掃描。下載原檔適合 QGIS／CAD／離線列印。

## 城市定向功能

- 放置起點 △、檢查點 ○、終點 ◎，拖移調整
- 自動計算平面距離、方格方位、磁方位（約 3.1°W）
- 即時坐標：WGS84、**UTM 方格（KK／QK 8 位）**、6 位／8 位方格
- 可疊加 **UTM 方格網**，並在網線邊緣顯示 **E 東距／N 北距數字**，方便讀取 `KK 0794 6642`
- 城市定向常用比例：**1:2 500、1:4 000、1:5 000、1:7 500、1:10 000、1:15 000、1:20 000、1:25 000**；亦可輸入 **1:500–1:100 000 自訂比例**
- 可 **LOCK 比例**（停用縮放，比例不會漂移）；白紙上就是該比例印出
- **設計＝列印（WYSIWYG）**：中央白紙就是實際列印頁（A3/A4/A5、直向／橫向），紙外不會印；「實際 mm」顯示可用「螢幕寬度（cm）」校準成物理真實大小
- 列印檢查點說明表
- 本機暫存、返回／重做、量距

## 版權與條款

- 應用程式 © Scout System
- 底圖與航空照片 © 香港特別行政區政府地政總署 — 畫面已按規定標示 *Map from Lands Department* / *Aerial Photograph from Lands Department*
- 使用前請同意 [LandsD Map API 條款](https://portal.csdi.gov.hk/csdi-webpage/doc/TNC)

## 本機開啟

```bash
python3 -m http.server 8080 --bind 0.0.0.0
```

瀏覽器開啟該位址即可。圖磚由使用者瀏覽器直接向 `mapapi.geodata.gov.hk` 讀取。

## 成員下載電子地圖

開啟 `download.html`：

1. **電子 HM20C** — 官方免費 iB20000（香港地圖服務 2.0 登記後下載）
2. **e香港街** — 官方免費 GeoPDF，適合城市定向
3. **列印地圖** — `index.html` 內直接列印，紙圖上套印紫紅 CP 圓圈與檢查點說明
