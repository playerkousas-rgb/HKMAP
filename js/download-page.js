import {
  EHKG_GROUPS,
  EHKG_META,
  COUNTRYSIDE_MAPS,
  COUNTRYSIDE_META,
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

function renderCountryside() {
  return `
    <section class="card">
      <h2>郊區地圖（官方地圖預覽）</h2>
      <p>你講得啱：呢套郊遊圖之前應該係清理「野外定向」資料時一齊刪咗。補番五幅官方郊區地圖，顯示郊外小徑，城市定向去到郊野公園、郊區公園或大嶼山時都可以用。</p>
      <p class="notice">以下連結係地政總署官方高清彩色地圖預覽（JPG），原產品係防水雙面摺本；請保留官方來源及版權告示。需要遠足路線最新封閉消息，請查看漁護署 hiking.gov.hk。</p>
      <div class="file-grid">
        <a class="file" href="${COUNTRYSIDE_META.index}" target="_blank" rel="noopener"><b>郊區地圖索引圖</b><small>官方索引（2026）</small></a>
        <a class="file" href="${COUNTRYSIDE_META.official}" target="_blank" rel="noopener"><b>地政總署官方頁</b><small>地圖資料及各版本</small></a>
        <a class="file" href="${COUNTRYSIDE_META.hiking}" target="_blank" rel="noopener"><b>遠足徑／封閉消息</b><small>hiking.gov.hk　出發前查看</small></a>
      </div>
    </section>
    ${COUNTRYSIDE_MAPS.map((m) => `<section class="card"><h2>${m.name}</h2><p>${m.edition}　·　圖幅尺寸 ${m.size}<br /><span class="notice">包括：${m.areas}</span></p><a class="file" href="${m.href}" target="_blank" rel="noopener"><b>開啟高清郊區地圖</b><small>${m.code}　·　地政總署官方 JPG 預覽</small></a></section>`).join("")}`;
}

function renderPrint() {
  return `
    <section class="card">
      <h2>用 Scout System 列印／匯出</h2>
      <p>本系統定位是<strong>策劃者畫圖工具</strong>：在官方底圖上放 CP 圓圈，列印紙圖給參加者，不是手機遊戲。</p>
      <ul>
        <li><strong>列印地圖</strong> — 紙圖上有紫紅起點 △、檢查點 ○、終點 ◎</li>
        <li><strong>檢查點說明表</strong> — 印在圖下方，參加者對照尋點</li>
        <li><strong>匯出 JSON</strong> — 給其他策劃者繼續改圖</li>
      </ul>
      <p class="notice">列印底圖來自官方地形圖 API，須保留「Map from Lands Department」。不是紙本 HM20C 複製品。</p>
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
