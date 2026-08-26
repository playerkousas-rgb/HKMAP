/** Official free map downloads for Scout members. © Scout System */
const PDF = "https://www.landsd.gov.hk/doc/en/mapping/ehkg/MapPages/GeoPDF";

export const IB20000 = {
  title: "HM20C 電子版＝iB20000 數碼地形圖",
  price: "免費 HK$0（2026 年 2 月價目表）",
  formats: ["GeoTIFF（較易列印／QGIS）", "GML（開放向量）", "FGDB（ArcGIS）", "DWG / DGN（CAD）"],
  sheets: "全港約 18 幅，比例 1:20 000（與 HM20C 同一套測繪；紙本印 UTM 方格 KK／QK）",
  steps: [
    "開啟香港地圖服務 2.0，右上角「登入／登記」→ 個人用戶，完成電郵驗證。",
    "進入「空間數據與地形圖」，搜尋 iB20000。",
    "選格式：一般成員建議 GeoTIFF；要用 QGIS 選 GML 或 FGDB。",
    "加入購物車（應付金額應為 $0），通過驗證碼後下載。請用 Chrome／Edge／Firefox。",
    "使用時必須標示 Map from Lands Department，並遵守地政總署條款。",
  ],
  links: [
    { label: "香港地圖服務 2.0　iB20000", href: "https://www.hkmapservice.gov.hk/OneStopSystem/map-search?product=OSSCatB&series=iB20000" },
    { label: "下載公開數碼地圖 FAQ", href: "https://www.hkmapservice.gov.hk/OneStopSystem/faqDownloadOpenDigitalMaps?locale=zh_hk" },
    { label: "CSDI 數據集", href: "https://portal.csdi.gov.hk/geoportal/?datasetId=landsd_rcd_1637224132564_22637" },
    { label: "價目表 PDF", href: "https://www.landsd.gov.hk/doc/en/mapping/digital-map/common/doc/pricelist.pdf" },
  ],
};

export const EHKG_GROUPS = [
  {
    id: "urban",
    name: "市區大圖（城市定向常用）",
    files: [
      { code: "SP01", name: "九龍", href: `${PDF}/SP01_Kowloon.pdf`, size: "15.4 MB" },
      { code: "SP02", name: "港島北", href: `${PDF}/SP02_HongKongIslandNorth.pdf`, size: "13.3 MB" },
    ],
  },
  {
    id: "hk",
    name: "香港島街道圖",
    files: [
      ["HK01", "堅尼地城", "HK01_KennedyTown.pdf", "2.5 MB"],
      ["HK02", "西環／西營盤", "HK02_SaiWan_SaiYingPun.pdf", "3.7 MB"],
      ["HK03", "上環／中環", "HK03_SheungWan_CentralDistrict.pdf", "4.1 MB"],
      ["HK04", "灣仔／銅鑼灣", "HK04_WanChai_CausewayBay.pdf", "4.1 MB"],
      ["HK05", "北角／鰂魚涌", "HK05_NorthPoint_QuarryBay.pdf", "4.0 MB"],
      ["HK06", "太古／西灣河", "HK06_TaiKoo_SaiWanHo.pdf", "3.6 MB"],
      ["HK07", "筲箕灣／杏花邨", "HK07_ShauKeiWan_HengFaChuen.pdf", "3.5 MB"],
      ["HK08", "柴灣／小西灣", "HK08_ChaiWan_SiuSaiWan.pdf", "3.7 MB"],
      ["HK09", "薄扶林", "HK09_PokFuLam.pdf", "3.0 MB"],
      ["HK10", "山頂／馬己仙峽", "HK10_ThePeak_MagazineGap.pdf", "4.0 MB"],
      ["HK11", "灣仔峽／跑馬地", "HK11_WanChaiGap_HappyValley.pdf", "3.9 MB"],
      ["HK12", "大坑／渣甸山", "HK12_TaiHang_JardinesLookout.pdf", "3.7 MB"],
      ["HK13", "華富／田灣", "HK13_WahFu_TinWan.pdf", "3.3 MB"],
      ["HK14", "香港仔／黃竹坑", "HK14_Aberdeen_WongChukHang.pdf", "3.4 MB"],
      ["HK15", "壽臣山／黃泥涌", "HK15_ShousonHill_WongNaiChung.pdf", "3.2 MB"],
      ["HK16", "香港仔／鴨脷洲", "HK16_Aberdeen_ApLeiChau.pdf", "3.2 MB"],
      ["HK17", "海洋公園", "HK17_OceanPark.pdf", "3.5 MB"],
      ["HK18", "深水灣／淺水灣", "HK18_DeepWaterBay_RepulseBay.pdf", "4.1 MB"],
      ["HK19", "舂坎角／赤柱", "HK19_ChungHomKok_Stanley.pdf", "4.3 MB"],
      ["HK20", "紅山半島／石澳", "HK20_RedHillPeninsula_ShekO.pdf", "4.1 MB"],
    ].map(([code, name, file, size]) => ({ code, name, href: `${PDF}/${file}`, size })),
  },
  {
    id: "kn",
    name: "九龍街道圖",
    files: [
      ["KN01", "荔景／荔枝角", "KN01_LaiKing_LaiChiKok.pdf", "3.5 MB"],
      ["KN02", "長沙灣／石硤尾", "KN02_CheungShaWan_ShekKipMei.pdf", "4 MB"],
      ["KN03", "九龍塘／黃大仙", "KN03_KowloonTong_WongTaiSin.pdf", "4.1 MB"],
      ["KN04", "鑽石山／牛池灣", "KN04_DiamondHill_NgauChiWan.pdf", "5 MB"],
      ["KN06", "深水埗／旺角", "KN06_ShamShuiPo_MongKok.pdf", "4.3 MB"],
      ["KN07", "九龍塘／馬頭圍", "KN07_KowloonTong_MaTauWai.pdf", "3.9 MB"],
      ["KN08", "啟德／九龍灣", "KN08_KaiTak_KowloonBay.pdf", "4.4 MB"],
      ["KN10", "油麻地／旺角", "KN10_YauMaTei_MongKok.pdf", "3.7 MB"],
      ["KN11", "何文田／土瓜灣", "KN11_HoManTin_ToKwaWan.pdf", "4.1 MB"],
      ["KN12", "尖沙咀", "KN12_TsimShaTsui.pdf", "3.5 MB"],
      ["KN13", "西九龍", "KN13_WestKowloon.pdf", "2.5 MB"],
      ["KN14", "紅磡", "KN14_HungHom.pdf", "2.6 MB"],
      ["KN15", "郵輪碼頭／觀塘", "KN15_CruiseTerminal_KwunTong.pdf", "3.8 MB"],
      ["KN16", "藍田", "KN16_LamTin.pdf", "3.6 MB"],
      ["KN17", "油塘", "KN17_YauTong.pdf", "3.2 MB"],
    ].map(([code, name, file, size]) => ({ code, name, href: `${PDF}/${file}`, size })),
  },
  {
    id: "ne",
    name: "新界東街道圖",
    files: [
      ["NE01", "將軍澳／坑口", "NE01_TseungKwanO_HangHau.pdf", "4.1 MB"],
      ["NE04", "清水灣半島", "NE04_ClearWaterBayPeninsula.pdf", "3 MB"],
      ["NE05", "清水灣", "NE05_ClearWaterBay.pdf", "3.1 MB"],
      ["NE07", "蠔涌／白沙灣", "NE07_HoChung_HebeHaven.pdf", "3.4 MB"],
      ["NE08", "西貢", "NE08_SaiKung.pdf", "3.6 MB"],
      ["NE09", "顯徑／大圍", "NE09_HinKeng_TaiWai.pdf", "4 MB"],
      ["NE10", "美林／沙田市中心", "NE10_MeiLam_ShaTinTownCentre.pdf", "4.3 MB"],
      ["NE16", "烏溪沙／西沙", "NE16_WuKaiSha_SaiSha.pdf", "3.4 MB"],
      ["NE17", "馬鞍山", "NE17_MaOnShan.pdf", "3.5 MB"],
      ["NE19", "大埔", "NE19_TaiPo.pdf", "5.1 MB"],
      ["NE23", "大美督", "NE23_TaiMeiTuk.pdf", "2.6 MB"],
      ["NE26", "上水／粉嶺", "NE26_SheungShui_Fanling.pdf", "6.2 MB"],
    ].map(([code, name, file, size]) => ({ code, name, href: `${PDF}/${file}`, size })),
  },
  {
    id: "nw",
    name: "新界西街道圖",
    files: [
      ["NW04", "天水圍", "NW04_TinShuiWai.pdf", "6.4 MB"],
      ["NW08", "元朗", "NW08_YuenLong.pdf", "6.0 MB"],
      ["NW14", "屯門", "NW14_TuenMun.pdf", "4.6 MB"],
      ["NW21", "柴灣角／荃灣", "NW21_ChaiWanKok_TsuenWan.pdf", "4.2 MB"],
      ["NW22", "上葵涌", "NW22_SheungKwaiChung.pdf", "4.1 MB"],
      ["NW23", "下葵涌", "NW23_HaKwaiChung.pdf", "4.4 MB"],
    ].map(([code, name, file, size]) => ({ code, name, href: `${PDF}/${file}`, size })),
  },
  {
    id: "is",
    name: "離島街道圖",
    files: [
      ["IS03", "坪洲", "IS03_PengChau.pdf", "2.8 MB"],
      ["IS04", "長洲", "IS04_CheungChau.pdf", "3.9 MB"],
      ["IS07", "東涌", "IS07_TungChung.pdf", "3.4 MB"],
      ["IS08", "大澳", "IS08_TaiO.pdf", "2.8 MB"],
      ["IS09", "昂坪", "IS09_NgongPing.pdf", "2.1 MB"],
      ["IS10", "愉景灣", "IS10_DiscoveryBay.pdf", "4.1 MB"],
      ["IS12", "梅窩", "IS12_MuiWo.pdf", "3.4 MB"],
      ["IS13", "榕樹灣", "IS13_YungShueWan.pdf", "3.0 MB"],
    ].map(([code, name, file, size]) => ({ code, name, href: `${PDF}/${file}`, size })),
  },
];

export const COUNTRYSIDE_MAPS = [
  { code: "CM-HK", name: "香港島及鄰近島嶼", edition: "第十一版（2025）", size: "610 × 880 mm", scale: "1:20 000", href: "https://www.landsd.gov.hk/images/en/mapping/paper-map/lic/CM-HKIs_n_NeighbourIs_MAP-2025_11.jpg", areas: "香港島、南丫島、東龍洲、蒲台等", center: [22.25, 114.17] },
  { code: "CM-LT", name: "大嶼山及鄰近島嶼", edition: "第十一版（2025）", size: "880 × 610 mm", scale: "1:25 000", href: "https://www.landsd.gov.hk/images/en/mapping/paper-map/lic/CM-LantauIs_n_NeighbourIs_MAP-2025_11.jpg", areas: "大嶼山、長洲、坪洲、索罟群島、龍鼓洲、沙洲等", center: [22.26, 113.93] },
  { code: "CM-NW", name: "新界西北部", edition: "第十二版（2023）", size: "610 × 880 mm", scale: "1:25 000", href: "https://www.landsd.gov.hk/images/en/mapping/paper-map/lic/CM-NTNW_MAP-2023_12.jpg", areas: "元朗、屯門、大欖涌、荃灣、青衣等", center: [22.42, 114.02] },
  { code: "CM-NE", name: "新界東北及中部", edition: "第十版（2023）", size: "610 × 880 mm", scale: "1:25 000", href: "https://www.landsd.gov.hk/images/en/mapping/paper-map/lic/CM-NTNE_n_Central_MAP.jpg", areas: "沙田、大埔、粉嶺、沙頭角、吉澳、平洲等", center: [22.47, 114.20] },
  { code: "CM-SK", name: "西貢及清水灣", edition: "第十七版（2026）", size: "880 × 610 mm", scale: "1:25 000", href: "https://www.landsd.gov.hk/images/en/mapping/paper-map/lic/cm-sk_n_cwb_map-2026.jpg", areas: "馬鞍山、將軍澳、塔門、果洲群島等", center: [22.38, 114.33] },
];

export const HM20C_DOWNLOAD_SHEETS = [
  { id: "2", name: "新田", en: "San Tin", center: [22.502, 114.078] },
  { id: "3", name: "上水及粉嶺", en: "Sheung Shui & Fanling", center: [22.508, 114.138] },
  { id: "4", name: "吉澳洲", en: "Kat O", center: [22.545, 114.305] },
  { id: "5", name: "青山", en: "Castle Peak", center: [22.395, 113.973] },
  { id: "6", name: "元朗", en: "Yuen Long", center: [22.445, 114.035] },
  { id: "7", name: "沙田", en: "Sha Tin", center: [22.382, 114.19] },
  { id: "8", name: "西貢半島", en: "Sai Kung Peninsula", center: [22.4, 114.3] },
  { id: "9", name: "東涌", en: "Tung Chung", center: [22.289, 113.941] },
  { id: "10", name: "銀礦灣", en: "Silver Mine Bay", center: [22.268, 114.001] },
  { id: "11", name: "香港及九龍", en: "HK & Kowloon", center: [22.302, 114.172] },
  { id: "12", name: "清水灣", en: "Clear Water Bay", center: [22.295, 114.289] },
  { id: "13", name: "石壁", en: "Shek Pik", center: [22.227, 113.895] },
  { id: "14", name: "長洲", en: "Cheung Chau", center: [22.209, 114.029] },
  { id: "15", name: "香港南部及南丫島", en: "South & Lamma", center: [22.226, 114.145] },
  { id: "16", name: "橫瀾島", en: "Waglan", center: [22.182, 114.303] },
];

export const IB20000_TILES = [
  { id: "01", name: "新田東", en: "San Tin E" },
  { id: "02", name: "上水", en: "Sheung Shui" },
  { id: "03", name: "沙頭角", en: "Sha Tau Kok" },
  { id: "04", name: "吉澳", en: "Kat O" },
  { id: "05", name: "屯門西", en: "Tuen Mun W" },
  { id: "06", name: "元朗", en: "Yuen Long" },
  { id: "07", name: "大埔", en: "Tai Po" },
  { id: "08", name: "西貢北", en: "Sai Kung N" },
  { id: "09", name: "屯門東", en: "Tuen Mun E" },
  { id: "10", name: "荃灣", en: "Tsuen Wan" },
  { id: "11", name: "沙田", en: "Sha Tin" },
  { id: "12", name: "西貢", en: "Sai Kung" },
  { id: "13", name: "大嶼山北", en: "Lantau N" },
  { id: "14", name: "青衣", en: "Tsing Yi" },
  { id: "15", name: "九龍", en: "Kowloon" },
  { id: "16", name: "清水灣", en: "Clear Water Bay" },
  { id: "17", name: "大嶼山南", en: "Lantau S" },
  { id: "18", name: "香港島", en: "HK Island" },
];

export const COUNTRYSIDE_META = {
  official: "https://www.landsd.gov.hk/tc/survey-mapping/mapping/thematic-mapping.html#2",
  index: "https://www.landsd.gov.hk/images/en/mapping/paper-map/index/Index_Jul2026.jpg",
  hiking: "https://www.hiking.gov.hk/news",
  purchase: "https://www.landsd.gov.hk/tc/survey-mapping/mapping/paper-map.html",
};

export const EHKG_META = {
  zip: {
    label: "e香港街 2026 年 7 月版（完整包 538 MB）",
    href: "https://www.landsd.gov.hk/doc/en/mapping/ehkg/eHKG2026_Jul_Edition.zip",
  },
  official: "https://www.landsd.gov.hk/tc/resources/mapping-information/ehkg.html",
  guide: "https://www.landsd.gov.hk/doc/en/mapping/ehkg/individual_PDF/eHKG2026_Chinese_User_Guide.pdf",
  legend: "https://www.landsd.gov.hk/doc/en/mapping/ehkg/individual_PDF/5_Legend.pdf",
  copyright: "https://www.landsd.gov.hk/tc/resources/mapping-information/mapping-teaching-resources/copyright.html",
};

export const FEATURE_IDEAS = [
  { id: "print", title: "A4 紙圖＋CP 圓圈", for: "城市", note: "已做：策劃者放點，列印給參加者用紙圖玩。" },
  { id: "card", title: "參加者控制卡（打孔空格）", for: "城市", note: "另頁列印到達時間／答案空格，不用手機。" },
  { id: "master", title: "領袖答案圖", for: "城市", note: "同一張圖加坐標與正確路線，只給策劃者。" },
  { id: "multi", title: "A／B／C 多條路線", for: "城市", note: "同一底圖分難度，分色套印。" },
];
