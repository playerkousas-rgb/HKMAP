# Scout System · 香港定向地圖

童軍成員設計 **城市定向**、**野外定向** 的地圖工作台。

版權 © Scout System

## 已連結的香港政府地圖

紙本 **HM20C**（1:20 000 地形圖）與 **郊區地圖（郊遊圖）** 是地政總署有版權的印刷品，並沒有整幅掃描公開圖磚。本系統改為連接**同一測繪處的官方開放服務**：

| 模式 | 來源 | 說明 |
| --- | --- | --- |
| HM20C 地形圖 | [地政總署 Topographic Map API](https://portal.csdi.gov.hk/csdi-webpage/apidoc/TopographicMapAPI) | XYZ 圖磚，對應數碼地形圖／HM20C 系列（等高線 20 m、道路、建築、小徑） |
| 地名注記 | [Map Label API](https://portal.csdi.gov.hk/csdi-webpage/apidoc/MapLabelAPI) | 中文地名疊加 |
| 郊遊圖 | 地形圖 + 漁護署 CSDI | 郊野公園、遠足徑、標距柱 |
| 航空照片 | [Imagery Map API](https://portal.csdi.gov.hk/csdi-webpage/apidoc/ImageryMapAPI) | 官方航空照片 |

圖幅索引可飛往 HM20C 15 幅地形圖，以及郊區地圖 5 幅（港島、大嶼山、新界西北、新界東北及中部、西貢及清水灣）。

## 定向功能

- 放置起點 △、檢查點 ○、終點 ◎，拖移調整
- 自動計算 **HK1980 平面距離**、方格方位、磁方位（約 3.1°W）
- 即時坐標：WGS84、HK1980 E/N、1 km / 100 m / 10 m 方格
- 可疊加 HK1980 1 km 方格網，對齊約 1:20 000
- 路線 JSON 匯出／匯入、列印檢查點表
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
