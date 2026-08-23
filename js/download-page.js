import {
  COUNTRYSIDE_PACKS,
  EHKG_GROUPS,
  EHKG_META,
  FEATURE_IDEAS,
  IB20000,
} from "./catalog.js";

function fileCard(f) {
  return `<a class="file" href="${f.href}" target="_blank" rel="noopener">
    <b>${f.code}　${f.name}</b>
    <small>官方 GeoPDF　${f.size}　·　地政總署</small>
  </a>`;
}

function renderIb() {
  return `
    <section class="card">
      <h2>電子版 HM20C　<span class="badge-free">免費</span></h2>
      <p class="ok">紙本 HM20C <strong>沒有</strong>官方彩色掃描 PDF。對應電子產品是 <strong>iB20000 數碼地形圖</strong>，同一測繪處、同一 1:20 000 比例，2026 年 2 月價目表為 HK$0。</p>
      <p>${IB20000.sheets}。格式：${IB20000.formats.join("、")}。</p>
      <h3>成員下載步驟（香港地圖服務 2.0）</h3>
      <ol class="ol-steps">${IB20000.steps.map((s) => `<li>${s}</li>`).join("")}</ol>
      <div class="file-grid" style="margin-top:12px">
        ${IB20000.links.map((l) => `<a class="file" href="${l.href}" target="_blank" rel="noopener"><b>${l.label}</b><small>官方網站</small></a>`).join("")}
      </div>
      <p class="notice" style="margin-top:12px">本系統地圖畫面已用官方地形圖 API 顯示同一套 iB 資料，設計路線不必等下載完成。下載原檔是為了 QGIS、離線備份或自行出圖。</p>
    </section>`;
}

function renderCountry() {
  return `
    <section class="card">
      <h2>電子版郊遊圖／郊區地圖</h2>
      <p class="warn">官方 <strong>5 幅紙本郊區地圖</strong>目前<strong>沒有</strong>免費電子掃描版，仍是地政總署印刷品（防水合成紙）。成員不能「一鍵下載整張郊遊圖 PDF」。</p>
      <p>以下是<strong>合法免費</strong>、最接近郊遊圖用途的電子包：e香港街 2026 小比例 GeoPDF（可 A3/A4 列印、可用 Avenza 定位）＋ iB20000 ＋ 漁護署郊野樂行。</p>
      <p><a href="${EHKG_META.paperCountryside}" target="_blank" rel="noopener">紙本郊區地圖產品頁</a>　·　
      <a href="${EHKG_META.hiking}" target="_blank" rel="noopener">郊野樂行</a>　·　
      <a href="${EHKG_META.copyright}" target="_blank" rel="noopener">e香港街版權告示</a></p>
    </section>
    ${COUNTRYSIDE_PACKS.map(
      (p) => `<section class="card">
        <h2>${p.name}</h2>
        <p class="notice">${p.paper}　→　建議先下載下列官方 GeoPDF 作電子預習</p>
        <div class="file-grid">${p.files.map(fileCard).join("")}</div>
      </section>`
    ).join("")}`;
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
      <h2>e香港街 2026（官方免費 GeoPDF）</h2>
      <p>最適合<strong>城市定向</strong>：街道、公園、碼頭都清楚，可列印 A4/A3，手機用 Avenza 可顯示自己位置。資料截至 2026 年 6 月。僅供非商業用途，請先讀<a href="${EHKG_META.copyright}" target="_blank" rel="noopener">版權告示</a>。</p>
      <div class="file-grid">
        <a class="file" href="${EHKG_META.zip}" target="_blank" rel="noopener"><b>下載完整包</b><small>538 MB ZIP　·　119 幅＋索引</small></a>
        <a class="file" href="${EHKG_META.official}" target="_blank" rel="noopener"><b>地政總署官方頁</b><small>e香港街 2026 年 7 月版</small></a>
        <a class="file" href="${EHKG_META.guide}" target="_blank" rel="noopener"><b>使用者指南</b><small>如何用 Avenza／Adobe</small></a>
        <a class="file" href="${EHKG_META.legend}" target="_blank" rel="noopener"><b>圖例</b><small>1.4 MB</small></a>
      </div>
      <input class="filter" id="ehkg-q" placeholder="搜尋地區，例如：尖沙咀、西貢、東涌" value="${filter.replace(/"/g, "&quot;")}" />
    </section>
    ${groups
      .map(
        (g) => `<section class="card"><h2>${g.name}</h2><div class="file-grid">${g.files.map(fileCard).join("")}</div></section>`
      )
      .join("") || `<section class="card"><p>沒有符合「${filter}」的圖幅。</p></section>`}`;
}

function renderPrint() {
  return `
    <section class="card">
      <h2>用 Scout System 列印／匯出</h2>
      <p>設計好路線後，可在地圖頁：</p>
      <ul>
        <li><strong>列印路線</strong> — 連檢查點表、HK1980 方格、段距與方位</li>
        <li><strong>匯出 JSON</strong> — 給其他領袖繼續編輯</li>
        <li><strong>匯出 GPX</strong> — 放進手機地圖預習（地圖頁新增）</li>
      </ul>
      <p class="notice">列印畫面用的是官方地形圖 API 圖磚，必須保留「Map from Lands Department」。這<strong>不是</strong>紙本 HM20C／郊區地圖的複製品，山藝考核請用正版紙圖。</p>
      <p><a class="solid" href="index.html" style="display:inline-block;text-decoration:none">返回設計地圖</a></p>
    </section>`;
}

function renderIdeas() {
  return `
    <section class="card">
      <h2>下一步：可以幫設計定向的功能</h2>
      <p>地圖下載先做好。以下是建議加入的設計工具，你可告訴我優先做哪幾項。</p>
      ${FEATURE_IDEAS.map(
        (f) => `<div class="idea"><div class="for">${f.for}</div><div><strong>${f.title}</strong><div class="notice">${f.note}</div></div></div>`
      ).join("")}
    </section>`;
}

const panels = {
  hm20c: renderIb,
  country: renderCountry,
  ehkg: () => renderEhkg(""),
  print: renderPrint,
  ideas: renderIdeas,
};

const root = document.getElementById("panel");
function show(id, extra) {
  document.querySelectorAll(".tabs button").forEach((b) => b.classList.toggle("active", b.dataset.tab === id));
  root.innerHTML = id === "ehkg" ? renderEhkg(extra || "") : panels[id]();
  if (id === "ehkg") {
    const input = document.getElementById("ehkg-q");
    input?.addEventListener("input", () => show("ehkg", input.value));
    input?.focus();
    if (extra) input.selectionStart = input.selectionEnd = input.value.length;
  }
}

document.querySelector(".tabs").addEventListener("click", (e) => {
  const b = e.target.closest("button[data-tab]");
  if (b) show(b.dataset.tab);
});

show("hm20c");
