import { checkinUrl, ensureIds, publishCourse } from "./urban.js";

const STORAGE_KEY = "scout-system-courses-v1";

function loadCourse() {
  try {
    const all = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    return all.current || null;
  } catch {
    return null;
  }
}

const course = loadCourse();
const out = document.getElementById("out");

if (!course || !Array.isArray(course.controls) || !course.controls.length) {
  out.innerHTML = `<section class="card"><h2>未有路線</h2><p>請先在地圖頁放置檢查點。<a href="index.html">返回設計</a></p></section>`;
} else {
  ensureIds(course);
  publishCourse(course);
  const list = [
    ...course.controls.filter((c) => c.kind === "start"),
    ...course.controls.filter((c) => c.kind === "control"),
    ...course.controls.filter((c) => c.kind === "finish"),
  ];
  out.innerHTML = `
    <section class="card" id="clues">
      <h2>隊員提示冊　${escapeHtml(course.name)}</h2>
      <p>集合：${escapeHtml(course.meet || "—")}　截止：${escapeHtml(course.cutoff || "—")}　緊急：${escapeHtml(course.sos || "—")}</p>
      ${list
        .map(
          (c) => `<div class="clue-card">
          ${c.photo ? `<img src="${c.photo}" alt="" />` : `<div style="background:#efe8d8;border-radius:8px;display:grid;place-items:center;font-weight:800">${escapeHtml(c.code)}</div>`}
          <div>
            <strong>${escapeHtml(c.code)}　${escapeHtml(c.name || "")}</strong>
            <div class="notice">${escapeHtml(c.clue || "到站後掃描 QR 打卡。")}</div>
          </div>
        </div>`
        )
        .join("")}
      <p class="notice">© Scout System　提示冊不含地圖坐標，避免未到站就知道答案。</p>
    </section>
    <section class="card" id="qrs">
      <h2>站點 QR（貼在現場）</h2>
      <div id="posters"></div>
    </section>
  `;
  const posters = document.getElementById("posters");
  list.forEach((c) => {
    const wrap = document.createElement("div");
    wrap.className = "poster";
    wrap.innerHTML = `
      <div class="notice">Scout System 城市定向</div>
      <div style="font:800 42px/1 Outfit,sans-serif;color:#16362c">${escapeHtml(c.code)}</div>
      <p style="margin:6px 0 10px"><strong>${escapeHtml(c.name || "")}</strong></p>
      <canvas></canvas>
      <p class="notice">用手機相機掃描打卡　© Scout System</p>
    `;
    posters.appendChild(wrap);
    const url = checkinUrl(course, c);
    if (window.QRCode?.toCanvas) {
      QRCode.toCanvas(wrap.querySelector("canvas"), url, { width: 220, margin: 1, color: { dark: "#16362c" } });
    }
  });
}

document.getElementById("btn-print")?.addEventListener("click", () => window.print());
document.getElementById("btn-clues")?.addEventListener("click", () => {
  document.getElementById("qrs").style.display = "none";
  document.getElementById("clues").style.display = "";
  window.print();
});
document.getElementById("btn-qr")?.addEventListener("click", () => {
  document.getElementById("clues").style.display = "none";
  document.getElementById("qrs").style.display = "";
  window.print();
});

function escapeHtml(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
