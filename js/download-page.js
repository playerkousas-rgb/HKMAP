import {
  EHKG_GROUPS,
  EHKG_META,
  COUNTRYSIDE_MAPS,
  COUNTRYSIDE_META,
  HM20C_DOWNLOAD_SHEETS,
  IB20000_TILES,
  IB20000,
} from "./catalog.js";

function fileCard(f) {
  return `<a class="file" href="${f.href}" target="_blank" rel="noopener">
    <b>${f.code}　${f.name}</b>
    <small>官方 GeoPDF　${f.size}　·　地政總署</small>
  </a>`;
}

function sheetTileHM20C(s) {
  // 一格格像主頁：點一下就去 HKMS 下載該幅對應的 iB20000
  const href = `https://www.hkmapservice.gov.hk/OneStopSystem/map-search?product=OSSCatB&series=iB20000`;
  return `<a class="sheet-tile" href="${href}" target="_blank" rel="noopener" data-id="${s.id}" title="前往香港地圖服務 2.0 下載 Sheet ${s.id}">
    <b>${s.id}</b>
    <span class="sheet-name">${s.name}</span>
    <small>${s.en}　·　1:20 000</small>
  </a>`;
}

function tileIB20(s) {
  const href = `https://www.hkmapservice.gov.hk/OneStopSystem/map-search?product=OSSCatB&series=iB20000`;
  return `<a class="sheet-tile ib" href="${href}" target="_blank" rel="noopener" title="iB20000 Tile ${s.id}">
    <b>${s.id}</b>
    <span class="sheet-name">${s.name}</span>
    <small>${s.en}　·　GeoTIFF/GML</small>
  </a>`;
}

function countrysideTile(m) {
  return `<div class="countryside-tile">
    <div class="countryside-head">
      <b>${m.code}</b>
      <span class="sheet-name">${m.name}</span>
      <small>${m.scale}　${m.edition}　·　${m.size}</small>
    </div>
    <div class="countryside-body">
      <div class="notice" style="margin:0 0 8px">包括：${m.areas}</div>
      <div class="file-grid" style="margin:0">
        <a class="file" href="${m.href}" target="_blank" rel="noopener"><b>📥 一按下載高清 JPG</b><small>官方預覽　·　地政總署</small></a>
        <a class="file" href="${COUNTRYSIDE_META.official}" target="_blank" rel="noopener"><b>官方專題地圖頁</b><small>紙本地圖購買資訊</small></a>
        <a class="file" href="index.html#${m.center[0]},${m.center[1]}" data-fly="${m.center[0]},${m.center[1]}" class="fly"><b>🗺 在主頁開啟此區</b><small>底圖切到郊遊圖設計</small></a>
      </div>
    </div>
  </div>`;
}

function renderIb(filter = "") {
  const q = filter.trim().toLowerCase();
  const hmSheets = HM20C_DOWNLOAD_SHEETS.filter(
    (s) => !q || `${s.id} ${s.name} ${s.en}`.toLowerCase().includes(q)
  );
  const ibTiles = IB20000_TILES.filter(
    (s) => !q || `${s.id} ${s.name} ${s.en}`.toLowerCase().includes(q)
  );
  return `
    <section class="card">
      <h2>電子版 HM20C　<span class="badge-free">免費</span>　<span class="badge-free" style="background:#2f6b52">一格一按即下載</span></h2>
      <p class="ok">紙本 HM20C <strong>沒有</strong>官方彩色掃描 PDF。對應電子產品是 <strong>iB20000 數碼地形圖</strong>，同一測繪處、同一 1:20 000 比例，2026 年 2 月價目表為 HK$0。</p>
      <p>${IB20000.sheets}。格式：${IB20000.formats.join("、")}。</p>
      <h3>成員下載步驟（香港地圖服務 2.0）</h3>
      <ol class="ol-steps">${IB20000.steps.map((s) => `<li>${s}</li>`).join("")}</ol>
      <div class="file-grid" style="margin-top:12px">
        ${IB20000.links.map((l) => `<a class="file" href="${l.href}" target="_blank" rel="noopener"><b>${l.label}</b><small>官方網站</small></a>`).join("")}
      </div>
      <p class="notice" style="margin-top:12px">本系統地圖畫面已用官方地形圖 API 顯示同一套 iB 資料，設計路線不必等下載完成。下載原檔是為了 QGIS、離線備份或自行出圖。<a href="download.html?tab=qgis"><strong>QGIS 簡易教學（框線＋等高線）→</strong></a></p>
      <input class="filter" id="hm20c-q" placeholder="搜尋 HM20C 圖幅，例如：11 香港、沙田、13 石壁" value="${filter.replace(/"/g, "&quot;")}" />
    </section>

    <section class="card">
      <h2>HM20C 圖幅　一格格按即下載（像主頁）</h2>
      <p class="notice">每格對應紙本 HM20C 一幅，點一下即前往香港地圖服務 2.0 下載對應 iB20000 數碼檔（免費）。排版同主頁 HM20C 圖幅區，方便對照。</p>
      <div class="sheet-grid">
        ${hmSheets.map(sheetTileHM20C).join("")}
      </div>
      ${hmSheets.length ? "" : `<p>沒有符合「${filter}」的 HM20C 圖幅。</p>`}
    </section>

    <section class="card">
      <h2>iB20000 18 幅 Tile　一格格按即下載</h2>
      <p class="notice">iB20000 實際為 18 幅數碼分幅，與 HM20C 紙圖分幅略有不同，全部免費 GeoTIFF / GML / FGDB。點一格即去下載頁選格式。</p>
      <div class="sheet-grid">
        ${ibTiles.map(tileIB20).join("")}
      </div>
      ${ibTiles.length ? "" : `<p>沒有符合「${filter}」的 iB20000 分幅。</p>`}
    </section>`;
}

function renderEhkg(filter = "") {
  const q = filter.trim().toLowerCase();
  const groups = EHKG_GROUPS.map((g) => ({
    ...g,
    files: g.files.filter(
      (f) => !q || `${f.code} ${f.name}`.toLowerCase().includes(q)
    ),
  })).filter((g) => g.files.length);
  return `
    <section class="card">
      <h2>e香港街 2026（官方免費 GeoPDF）　一格格按即下載</h2>
      <p>最適合<strong>城市定向</strong>：街道、公園、碼頭都清楚，可列印 A4/A3，手機用 Avenza 可顯示自己位置。資料截至 2026 年 6 月。僅供非商業用途，請先讀<a href="${EHKG_META.copyright}" target="_blank" rel="noopener">版權告示</a>。</p>
      <div class="file-grid">
        <a class="file" href="${EHKG_META.zip.href}" target="_blank" rel="noopener"><b>下載完整包</b><small>538 MB ZIP　·　119 幅＋索引</small></a>
        <a class="file" href="${EHKG_META.official}" target="_blank" rel="noopener"><b>地政總署官方頁</b><small>e香港街 2026 年 7 月版</small></a>
        <a class="file" href="${EHKG_META.guide}" target="_blank" rel="noopener"><b>使用者指南</b><small>如何用 Avenza／Adobe</small></a>
        <a class="file" href="${EHKG_META.legend}" target="_blank" rel="noopener"><b>圖例</b><small>1.4 MB</small></a>
      </div>
      <input class="filter" id="ehkg-q" placeholder="搜尋地區，例如：尖沙咀、西貢、東涌" value="${filter.replace(/"/g, "&quot;")}" />
    </section>
    ${
      groups
        .map(
          (g) => `<section class="card"><h2>${g.name}　<span class="badge-free">${g.files.length} 幅</span></h2><div class="file-grid">${g.files.map(fileCard).join("")}</div></section>`
        )
        .join("") || `<section class="card"><p>沒有符合「${filter}」的圖幅。</p></section>`
    }`;
}

function renderCountryside(filter = "") {
  const q = filter.trim().toLowerCase();
  const maps = COUNTRYSIDE_MAPS.filter(
    (m) => !q || `${m.code} ${m.name} ${m.areas}`.toLowerCase().includes(q)
  );
  return `
    <section class="card">
      <h2>郊遊圖（郊區地圖）　<span class="badge-free">免費預覽一按下載</span>　<span class="badge-free" style="background:#2f6b52">一格格像街道圖</span></h2>
      <p>官方郊區地圖共 5 幅，1:20 000／1:25 000，防水雙面，顯示郊外小徑、郊野公園、等高線。紙本需購買，但地政總署提供<strong>高清 JPG 預覽</strong>可一按下載，策劃野外定向可用。</p>
      <p class="notice">以下每格即一幅郊遊圖，點「一按下載高清 JPG」即官方 JPG；另可跳回主頁用「郊遊圖」底圖（OpenTopoMap）直接設計路線，列印紙圖。</p>
      <div class="file-grid">
        <a class="file" href="${COUNTRYSIDE_META.index}" target="_blank" rel="noopener"><b>郊區地圖索引圖</b><small>官方索引（2026）一按下載</small></a>
        <a class="file" href="${COUNTRYSIDE_META.official}" target="_blank" rel="noopener"><b>地政總署官方頁</b><small>紙本地圖購買及版次</small></a>
        <a class="file" href="${COUNTRYSIDE_META.hiking}" target="_blank" rel="noopener"><b>遠足徑／封閉消息</b><small>hiking.gov.hk　出發前查看</small></a>
        <a class="file" href="index.html" target="_blank" rel="noopener"><b>在主頁用郊遊圖底圖設計</b><small>切到底圖「郊遊圖」即 OpenTopoMap</small></a>
      </div>
      <input class="filter" id="country-q" placeholder="搜尋郊遊圖，例如：大嶼山、西貢、香港島" value="${filter.replace(/"/g, "&quot;")}" />
    </section>
    <section class="card">
      <h2>5 幅郊遊圖　一格格按即下載（像街道圖）</h2>
      <div class="countryside-grid">
        ${maps.map(countrysideTile).join("")}
      </div>
      ${maps.length ? "" : `<p>沒有符合「${filter}」的郊遊圖。</p>`}
    </section>`;
}

/* ---------- QGIS 簡易教學：(1)(2)(3)… 逐步做，每步有「✔ 檢查」 ---------- */

/** QGIS 介面名稱：英文（大部分人用英文介面）＋括號內 QGIS 繁體中文介面名稱。 */
function ui(en, zh) {
  return `<b class="ui">${en}</b>${zh ? `<span class="ui-zh">（${zh}）</span>` : ""}`;
}

const QGIS_PARTS = [
  {
    id: "qgis-load",
    tag: "A",
    title: "載入地圖",
    note: "必做　·　(1)–(4)",
    steps: [
      {
        title: "安裝 QGIS",
        do: [
          `到 <a href="https://qgis.org/download/" target="_blank" rel="noopener">QGIS 官網</a>下載 <strong>Long Term Release（LTR 長期版）</strong>，安裝後開啟。`,
        ],
        check: `看到 QGIS 主畫面，左下角有 ${ui("Layers", "圖層")} 面板。`,
      },
      {
        title: "下載 iB20000，再解壓",
        do: [
          `在本頁「<a href="download.html?tab=hm20c">1. 電子 HM20C</a>」進入香港地圖服務 2.0，選活動地區的圖幅。`,
          `選格式：只要底圖 → <strong>GeoTIFF</strong>；要等高線 → <strong>GML</strong> 或 <strong>FGDB</strong>。`,
          `下載後，在 ZIP 檔按右鍵 →「全部解壓縮」。`,
        ],
        check: `資料夾內有 <code>.tif</code>（GeoTIFF）、<code>.gml</code>（GML）或 <code>.gdb</code> 資料夾（FGDB）。`,
      },
      {
        title: "把地圖拖入 QGIS",
        do: [
          `把 <code>.tif</code>／<code>.gml</code> 檔直接拖進 QGIS 中間的地圖區；FGDB 就拖整個 <code>.gdb</code> 資料夾。`,
          `如彈出 ${ui("Select Items to Add", "選擇要新增的專案")} 視窗：剔選要用的圖層（要等高線就一定要剔 <strong>ELEVLINE</strong>），再按 ${ui("Add Layers", "新增圖層")}。`,
        ],
        check: `${ui("Layers")} 面板出現新圖層，地圖區看到地圖。`,
      },
      {
        title: "縮放到地圖，儲存專案",
        do: [
          `在圖層上按右鍵 → ${ui("Zoom to Layer(s)", "縮放至圖層")}。`,
          `選單 ${ui("Project → Save", "專案 → 儲存")}，存成 <code>.qgz</code> 檔。`,
        ],
        check: `看到整幅地圖；下次開啟 <code>.qgz</code> 會回到同一畫面。`,
        hint: `座標系統跟隨檔案即可（香港 1980 方格 EPSG:2326），不用自己更改。`,
      },
    ],
  },
  {
    id: "qgis-contour",
    tag: "B",
    title: "等高線＋高度數字",
    note: "要用 GML／FGDB　·　(5)–(8)",
    intro: `<p class="warn qg-pre"><strong>前提：載入時必須選 GML 或 FGDB 格式。</strong>等高線是「向量」資料（一條條線，每條都記住高度）。GeoTIFF 只是一張圖片，QGIS 抽不出裏面的線，也無法另外加上高度數字。</p>`,
    steps: [
      {
        title: "確認已載入等高線圖層",
        do: [
          `在 ${ui("Layers")} 面板找 <strong>ELEVLINE</strong>（iB20000 的等高線，每 20 m 一條）。其他資料可能叫 <code>Contour</code> 或其他與高度有關的名稱。`,
          `找不到？重做 (3)，記得剔選 ELEVLINE。`,
        ],
        check: `圖層名稱左邊的圖示是「一條線」，不是「一張圖片」。如果是圖片，即是載入了 GeoTIFF，要改下載 GML／FGDB。`,
      },
      {
        title: "改顏色和粗幼",
        do: [
          `在 ELEVLINE 上按右鍵 → ${ui("Properties…", "屬性…")} → 左邊選 ${ui("Symbology", "符號學")}。`,
          `${ui("Color", "顏色")} 選棕色或赭色（例如 <code>#B5651D</code>），${ui("Width", "寬度")} 填 <strong>0.2</strong> mm → 按 ${ui("OK", "確定")}。`,
        ],
        check: `地圖上的等高線變成棕色幼線。`,
      },
      {
        title: "加上高度數字",
        do: [
          `再開 ${ui("Properties…", "屬性…")} → 左邊選 ${ui("Labels", "標註")}。`,
          `最上方的選單選 ${ui("Single Labels", "單一標註")}。`,
          `${ui("Value", "值")} 選高度欄位 <strong>HEIGHT</strong>（其他資料可能叫 <code>CONTOUR</code>）。`,
          `按 ${ui("Apply", "套用")}，視窗先不要關，接着做 (8)。`,
        ],
        check: `放大地圖，等高線旁出現 20、40、60… 等數字（單位：米）。`,
      },
      {
        title: "讓數字沿線排列",
        do: [
          `同一視窗按 ${ui("Placement", "放置")}。`,
          `${ui("Mode", "模式")} 選 ${ui("Curved", "曲線")}（數字跟着線彎）或 ${ui("Parallel", "平行")}；${ui("Allowed positions", "允許的位置")} 只剔 ${ui("On line", "線上")}。`,
          `按 ${ui("Apply", "套用")} → ${ui("OK", "確定")}。`,
        ],
        check: `放大地圖，每條等高線上都有順着線方向的高度數字。`,
      },
    ],
    tip: `<strong>可選：令等高線更易讀</strong>
      <ul>
        <li><b>數字太密</b>：在 (7) 的 ${ui("Value")} 欄改為輸入 <code>if("HEIGHT" % 100 = 0, "HEIGHT", '')</code>，只標每 100 m 的線。</li>
        <li><b>數字被線蓋住</b>：${ui("Labels")} → ${ui("Buffer", "環域")} → 剔 ${ui("Draw text buffer", "繪製文字緩衝區")}，數字會有白邊。</li>
        <li><b>每 100 m 加粗（計曲線）</b>：${ui("Symbology")} 最上方選 ${ui("Rule-based", "基於規則")} → 按 <b>＋</b> 加一條規則，Filter 填 <code>"HEIGHT" % 100 = 0</code>，寬度 0.4 mm。</li>
        <li><b>山頂高度點</b>：用 (3) 的方法再載入 <strong>ELEVSYMBOL</strong>（高程點），${ui("Labels")} 的 ${ui("Value")} 同樣選 HEIGHT。</li>
      </ul>
      <p style="margin:6px 0 0">不想裝 QGIS？<a href="index.html?contours=1">Scout System 設計頁</a>右上角「等高線」按一下就可以顯示／隱藏 iB20000 等高線，並連數字一起列印。</p>`,
  },
  {
    id: "qgis-print",
    tag: "C",
    title: "A3／A4 版面、框線、列印",
    note: "(9)–(12)",
    steps: [
      {
        title: "開列印版面，選紙張",
        do: [
          `選單 ${ui("Project → New Print Layout…", "專案 → 新增列印版面配置…")}，輸入名稱 → ${ui("OK", "確定")}。`,
          `在白紙上按右鍵 → ${ui("Page Properties…", "頁面屬性…")}：${ui("Size", "大小")} 選 <strong>A4</strong> 或 <strong>A3</strong>，${ui("Orientation", "方向")} 選 Landscape（橫式）或 Portrait（直式）。`,
        ],
        check: `版面視窗中間的白紙變成你要的大小和方向。`,
      },
      {
        title: "放地圖，加上四邊框線",
        do: [
          `左邊工具列按 ${ui("Add Map", "新增地圖")}，在白紙上拖出一個長方形，地圖就會放進去。`,
          `右邊 ${ui("Item Properties")}（中文介面顯示為「專案屬性」）向下捲 → 剔 ${ui("Frame", "框架")}，${ui("Color", "顏色")} 選黑色，${ui("Thickness", "厚度")} 填 <strong>0.3</strong> mm。`,
        ],
        check: `地圖四邊出現黑色框線（沒有剔 Frame 就不會有框線）。`,
        hint: `框線只加在列印版面上，不會改動官方下載的原檔。`,
      },
      {
        title: "設定比例（可選：方格網）",
        do: [
          `${ui("Item Properties")} → ${ui("Scale", "比例尺")} 輸入比例分母，例如 <code>5000</code>＝1:5 000、<code>20000</code>＝1:20 000。`,
          `要方格網：${ui("Grids", "方格")} → 按 <b>＋</b> → ${ui("Modify Grid…", "修改網格…")} → ${ui("CRS")} 選 <strong>EPSG:32650</strong>（活動在東經 114° 以東）或 <strong>EPSG:32649</strong>（以西）→ ${ui("Interval", "間隔")} X、Y 都填 <strong>1000</strong>（1 km）→ 剔 ${ui("Draw Coordinates", "繪製座標")}。`,
        ],
        check: `比例正確；開了方格網就看到 1 km 方格線和座標數字。`,
      },
      {
        title: "加版權字，匯出 PDF",
        do: [
          `用 ${ui("Add Label", "新增標籤")} 寫上圖名及 <strong>Map from Lands Department</strong>（必須標示）。`,
          `選單 ${ui("Layout → Export as PDF…", "圖面配置 → 匯出為PDF…")} → 存檔。`,
          `列印時選同一紙張，縮放選 <strong>100%／實際大小</strong>（不要選「符合頁面」）。`,
        ],
        check: `用尺量印出來的 1 km 方格：1:5 000 應為 20 cm，1:20 000 應為 5 cm。`,
      },
    ],
  },
];

function qgisStep(step, no) {
  return `<li class="qg-step" id="qgis-step-${no}">
    <div class="qg-no" aria-hidden="true">(${no})</div>
    <div class="qg-body">
      <h3><span class="sr-only">第 ${no} 步：</span>${step.title}</h3>
      <ul class="qg-do">${step.do.map((d) => `<li>${d}</li>`).join("")}</ul>
      <p class="qg-check"><b>✔ 檢查</b>${step.check}</p>
      ${step.hint ? `<p class="qg-hint">💡 ${step.hint}</p>` : ""}
    </div>
  </li>`;
}

function renderQgisGuide() {
  let no = 0;
  const parts = QGIS_PARTS.map((part) => {
    const steps = part.steps.map((step) => qgisStep(step, (no += 1))).join("");
    return `
    <section class="card qg-part" id="${part.id}">
      <div class="qg-part-head">
        <span class="qg-part-tag">${part.tag}</span>
        <h2>${part.title}</h2>
        <span class="qg-part-note">${part.note}</span>
      </div>
      ${part.intro || ""}
      <ol class="qg-steps">${steps}</ol>
      ${part.tip ? `<div class="qgis-tip">${part.tip}</div>` : ""}
    </section>`;
  }).join("");

  return `
    <section class="card qgis-intro" id="qgis-install">
      <h2>QGIS 簡易教學：框線＋等高線</h2>
      <p class="qg-lead">跟着 (1)、(2)、(3)… 逐步做；每步做完，對一對「✔ 檢查」才做下一步。先選你要做甚麼：</p>
      <div class="qg-choose">
        <a class="qg-route" href="#qgis-load">
          <b>只要底圖＋框線＋列印</b>
          <span>下載 <strong>GeoTIFF</strong> → 做 A → C</span>
        </a>
        <a class="qg-route is-contour" href="#qgis-contour">
          <b>要等高線＋高度數字</b>
          <span>下載 <strong>GML</strong> 或 <strong>FGDB</strong> → 做 A → B → C</span>
        </a>
      </div>
      <p class="warn"><strong>要等高線，一定要選 GML 或 FGDB。</strong>等高線是向量資料（線），GeoTIFF 是圖片，抽不出線，也加不到高度數字。</p>
      <div class="file-grid qgis-links">
        <a class="file qgis-download" href="https://qgis.org/download/" target="_blank" rel="noopener"><b>📥 下載 QGIS（官方網站）</b><small>Windows、macOS、Linux；新手選 Long Term Release（LTR）</small></a>
        <a class="file" href="download.html?tab=hm20c"><b>iB20000 官方下載</b><small>GeoTIFF、GML、FGDB 都免費</small></a>
        <a class="file" href="https://docs.qgis.org/latest/en/docs/user_manual/" target="_blank" rel="noopener"><b>QGIS 官方使用手冊</b><small>更多功能說明</small></a>
        <a class="file" href="https://portal.csdi.gov.hk/csdi-webpage/doc/TNC" target="_blank" rel="noopener"><b>地政總署使用條款</b><small>列印／分享前請確認版權要求</small></a>
      </div>
      <p class="notice" style="margin:10px 0 0">按鈕名稱以 QGIS 英文介面為主，括號內是 QGIS 繁體中文介面的名稱；不同版本可能略有不同。</p>
    </section>
    ${parts}
    <section class="card qg-faq">
      <h2>常見問題</h2>
      <dl>
        <dt>看不到地圖？</dt>
        <dd>先確認 ZIP 已解壓，然後做 (4) ${ui("Zoom to Layer(s)", "縮放至圖層")}。</dd>
        <dt>找不到 ELEVLINE，或圖示是一張圖片？</dt>
        <dd>你載入的是 GeoTIFF。重新下載 <strong>GML</strong> 或 <strong>FGDB</strong>，再做 (3)。</dd>
        <dt>高度數字不出現？</dt>
        <dd>(7) 要選 ${ui("Single Labels", "單一標註")}，${ui("Value", "值")} 要選 <strong>HEIGHT</strong>；然後放大地圖再看。</dd>
        <dt>只需要現成城市街道圖？</dt>
        <dd>可改用「<a href="download.html?tab=ehkg">2. e香港街</a>」官方 GeoPDF；要自選比例、加框線、方格及等高線，才用 iB20000＋QGIS。</dd>
      </dl>
      <a class="cta-link" href="#qgis-install">↑ 回到頂部</a>
    </section>`;
}

const panels = {
  hm20c: (f) => renderIb(f || ""),
  ehkg: (f) => renderEhkg(f || ""),
  countryside: (f) => renderCountryside(f || ""),
  qgis: () => renderQgisGuide(),
};

const root = document.getElementById("panel");
function show(id, extra, opts = {}) {
  document.querySelectorAll(".tabs button").forEach((b) => b.classList.toggle("active", b.dataset.tab === id));
  const fn = panels[id];
  if (!fn) {
    root.innerHTML = `<section class="card"><p>未知分類 ${id}</p></section>`;
    return;
  }
  root.innerHTML = fn(extra || "");

  // 例如 download.html?tab=qgis#qgis-contour：首次開啟時跳到指定段落。
  if (opts.scrollToHash && location.hash.length > 1) {
    const target = document.getElementById(decodeURIComponent(location.hash.slice(1)));
    if (target) requestAnimationFrame(() => target.scrollIntoView({ block: "start" }));
  }

  if (id === "ehkg") {
    const input = document.getElementById("ehkg-q");
    input?.addEventListener("input", () => show("ehkg", input.value));
    input?.focus();
    if (extra) input.selectionStart = input.selectionEnd = input.value.length;
  } else if (id === "hm20c") {
    const input = document.getElementById("hm20c-q");
    input?.addEventListener("input", () => show("hm20c", input.value));
    input?.focus();
    if (extra) input.selectionStart = input.selectionEnd = input.value.length;
  } else if (id === "countryside") {
    const input = document.getElementById("country-q");
    input?.addEventListener("input", () => show("countryside", input.value));
    input?.focus();
    if (extra) input.selectionStart = input.selectionEnd = input.value.length;
    root.querySelectorAll("[data-fly]").forEach((a) => {
      a.addEventListener("click", (e) => {
        e.preventDefault();
        const [lat, lng] = a.dataset.fly.split(",").map(Number);
        // 存到 localStorage 讓主頁飛過去並切郊遊圖
        try {
          const raw = localStorage.getItem("scout-system-courses-v1");
          const all = raw ? JSON.parse(raw) : {};
          all.layer = "countryside";
          all.flyTo = { lat, lng, zoom: 13 };
          localStorage.setItem("scout-system-courses-v1", JSON.stringify(all));
        } catch {}
        window.location.href = a.getAttribute("href").split("#")[0] + `?fly=${lat},${lng}&layer=countryside`;
      });
    });
  }
}

document.querySelector(".tabs").addEventListener("click", (e) => {
  const b = e.target.closest("button[data-tab]");
  if (b) show(b.dataset.tab);
});

// 支援 ?tab= 參數；只有 #qgis-… 錨點時亦自動開 QGIS 教學。
const params = new URLSearchParams(location.search);
const tab = params.get("tab") || (location.hash.startsWith("#qgis") ? "qgis" : null);
if (tab && panels[tab]) show(tab, "", { scrollToHash: true });
else show("hm20c");
