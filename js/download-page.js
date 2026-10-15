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
      <p class="notice" style="margin-top:12px">本系統地圖畫面已用官方地形圖 API 顯示同一套 iB 資料，設計路線不必等下載完成。下載原檔是為了 QGIS、離線備份或自行出圖。<a href="download.html?tab=qgis"><strong>下載 QGIS 及加圖框線教學 →</strong></a></p>
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

function renderQgisGuide() {
  return `
    <section class="card qgis-intro" id="qgis-install">
      <h2>QGIS 安裝＋加圖框線教學</h2>
      <p class="ok"><strong>先講重點：</strong>iB20000 下載的是有座標的地圖資料，不是已排版的紙圖。要加四邊圖框、方格網及設定 A3/A4，請在 QGIS 的「列印版面配置（Print Layout）」處理；只在地圖主畫面看圖，不會自動出現圖框。</p>
      <div class="file-grid qgis-links">
        <a class="file qgis-download" href="https://qgis.org/download/" target="_blank" rel="noopener"><b>📥 下載 QGIS（官方網站）</b><small>Windows、macOS、Linux；一般新手建議選 Long Term Release（LTR）</small></a>
        <a class="file" href="https://docs.qgis.org/latest/en/docs/user_manual/" target="_blank" rel="noopener"><b>QGIS 官方使用手冊</b><small>更多版本及功能說明</small></a>
        <a class="file" href="download.html?tab=hm20c"><b>返回 iB20000 官方下載</b><small>選 GeoTIFF 或 GML 等格式</small></a>
        <a class="file" href="https://portal.csdi.gov.hk/csdi-webpage/doc/TNC" target="_blank" rel="noopener"><b>地政總署使用條款</b><small>列印／分享前請確認版權要求</small></a>
      </div>
    </section>

    <section class="card">
      <h2>一、下載地圖並載入 QGIS</h2>
      <ol class="ol-steps qgis-steps">
        <li>在「1. 電子 HM20C」登入香港地圖服務 2.0，選擇活動地區的 <strong>iB20000</strong> 圖幅，按官方指示下載。簡單出圖可先選 <strong>GeoTIFF</strong>；需要逐層調整道路、地物樣式才選 GML／FGDB。</li>
        <li>如果下載的是 ZIP，先在電腦解壓縮；GeoTIFF 的 <code>.tif</code> 檔及同一資料夾的附屬檔案請一併保留。</li>
        <li>開啟 QGIS：選單「圖層 → 加入圖層 → 加入 Raster Layer（GeoTIFF）」；若下載 GML，選「加入 Vector Layer」，再選檔案並按「加入」。FGDB 通常要選取解壓後的 <code>.gdb</code> 資料夾，再揀要載入的圖層。</li>
        <li>圖層載入後，在圖層清單按右鍵，選「Layer CRS → Set Project CRS from Layer（以圖層 CRS 設定專案座標系統）」。先跟隨下載檔的座標系統；只有中繼資料明確寫出時才選 EPSG:2326（Hong Kong 1980 Grid System），不要盲目把座標系統改成 Google/Web Mercator。</li>
        <li>按工具列「縮放至圖層」看完整圖幅，確認底圖顯示正常，再用「專案 → 儲存」存成 <code>.qgz</code> 專案檔。</li>
      </ol>
      <p class="warn"><strong>看不到地圖？</strong>先確認 ZIP 已解壓、選對 .tif／GML 檔，並按「縮放至圖層」。若 GML 沒有樣式或圖層很多，初學者可改用 GeoTIFF 先完成圖框及列印。</p>
    </section>

    <section class="card">
      <h2>二、設定 A3/A4 紙張，為地圖加上四邊框線</h2>
      <ol class="ol-steps qgis-steps">
        <li>選「專案 → 新增列印版面配置（Project → New Print Layout）」，輸入版面名稱。</li>
        <li>在空白紙張上按右鍵開啟頁面屬性，選紙張 <strong>A3</strong> 或 <strong>A4</strong>，再選直向／橫向。</li>
        <li>在版面左側工具列選「加入地圖（Add Map）」，在紙上拖曳一個矩形；地圖會放進這個矩形圖框。拖動地圖項目可調整位置／範圍。</li>
        <li>選取剛加入的地圖，在右側「項目屬性（Item Properties）」勾選 <strong>Frame（框線）</strong>。建議先用黑色、約 <strong>0.3 mm</strong> 線寬；這條線就是地圖四周的外框。只載入底圖而未勾選 Frame，不會有外框。</li>
        <li>如要印比例尺，可在版面工具列加入「比例尺（Add Scale Bar）」；再加入「標籤（Add Label）」寫上圖名及 <strong>Map from Lands Department</strong> 版權標示。</li>
      </ol>
      <div class="qgis-tip"><strong>注意：</strong>QGIS 的圖框是在「列印版面配置」的地圖項目上設定，不是替 GeoTIFF 原檔永久畫線；修改版面不會改動官方下載檔。</div>
    </section>

    <section class="card">
      <h2>三、（可選）加 UTM 方格網及匯出 PDF</h2>
      <ol class="ol-steps qgis-steps">
        <li>在列印版面選取地圖項目，打開「項目屬性 → Grids（網格）」，按 <strong>＋</strong> 新增網格並啟用。要跟 Scout System 的 UTM 方格，活動地點在 114° 經線以西選 WGS 84 / UTM zone 49N（EPSG:32649），以東選 zone 50N（EPSG:32650）；香港跨兩個帶，按活動區選一個即可。間距設 <strong>1,000 m</strong> 是 1 km 方格，<strong>100 m</strong> 則更密。若只要一般方格，可選下載圖層所用的米制投影 CRS；不要用經緯度格網當作米距。</li>
        <li>在網格設定內開啟格線、外框或座標註記；調整線色／線寬及標籤位置，避免蓋住地圖細節。不同 QGIS 版本的按鈕名稱可能略有不同。</li>
        <li>按「匯出為 PDF（Export as PDF）」，確認版面是 A3/A4 及方向正確。列印時選相同紙張、縮放 100%；如要精確比例，先在地圖項目的屬性設定比例尺，再用尺核對輸出。</li>
      </ol>
      <p class="notice">若只需要現成城市街道圖，可改用上方「e香港街」官方 GeoPDF；若要自行選比例、加框線、方格及標註，則用 iB20000＋QGIS。官方底圖版權與署方條款仍然適用。</p>
      <a class="cta-link" href="download.html?tab=hm20c">← 返回 iB20000 下載</a>
    </section>`;
}

const panels = {
  hm20c: (f) => renderIb(f || ""),
  ehkg: (f) => renderEhkg(f || ""),
  countryside: (f) => renderCountryside(f || ""),
  qgis: () => renderQgisGuide(),
};

const root = document.getElementById("panel");
function show(id, extra) {
  document.querySelectorAll(".tabs button").forEach((b) => b.classList.toggle("active", b.dataset.tab === id));
  const fn = panels[id];
  if (!fn) {
    root.innerHTML = `<section class="card"><p>未知分類 ${id}</p></section>`;
    return;
  }
  root.innerHTML = fn(extra || "");

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

// 支援 ?tab= 參數
const params = new URLSearchParams(location.search);
const tab = params.get("tab");
if (tab && panels[tab]) show(tab);
else show("hm20c");
