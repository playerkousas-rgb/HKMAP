import { addCheckin, loadPublished } from "./urban.js";

const q = new URLSearchParams(location.search);
const courseId = q.get("c") || "";
const controlId = q.get("p") || "";
const secret = q.get("k") || "";
const code = q.get("code") || "—";
const name = q.get("n") || "檢查點";
const eventName = q.get("event") || "城市定向";

const published = courseId ? loadPublished(courseId) : null;
const pubCtrl = published?.controls?.find((c) => c.id === controlId) || null;
const valid = Boolean(courseId && controlId && secret);
const secretOk = !pubCtrl || pubCtrl.secret === secret;

const box = document.getElementById("box");

function teamKey() {
  return "scout-system-team-name";
}

if (!valid) {
  box.innerHTML = `<section class="card"><h2>未能讀取此站</h2><p>請掃描領袖張貼的官方 QR。© Scout System</p></section>`;
} else if (!secretOk) {
  box.innerHTML = `<section class="card"><h2>此站代碼不正確</h2><p>可能掃到舊路線的 QR。請聯絡領袖。</p></section>`;
} else {
  const title = pubCtrl?.name || name;
  const clue = pubCtrl?.clue || "";
  const photo = pubCtrl?.photo || "";
  const savedTeam = localStorage.getItem(teamKey()) || "";
  box.innerHTML = `
    <section class="card stamp">
      <div class="notice">Scout System　${escapeHtml(published?.name || eventName)}</div>
      <div class="code">${escapeHtml(pubCtrl?.code || code)}</div>
      <h2>${escapeHtml(title)}</h2>
      ${photo ? `<img src="${photo}" alt="此站提示" style="max-width:100%;border-radius:12px;margin:8px 0" />` : ""}
      ${clue ? `<p>${escapeHtml(clue)}</p>` : ""}
      <div class="team-box">
        <label class="field">隊伍／姓名
          <input id="team" maxlength="40" value="${escapeHtml(savedTeam)}" placeholder="例如：飛龍隊 / 陳小明" />
        </label>
        <button class="solid" id="go" type="button" style="width:100%">確認到站打卡</button>
        <p class="notice">打卡紀錄存在這部手機。到達終點請給領袖查看此畫面。</p>
      </div>
      <div id="result"></div>
    </section>
  `;
  document.getElementById("go").addEventListener("click", () => {
    const team = document.getElementById("team").value.trim();
    if (!team) {
      document.getElementById("result").innerHTML = `<p class="warn">請先填隊伍或姓名。</p>`;
      return;
    }
    localStorage.setItem(teamKey(), team);
    const rec = {
      courseId,
      controlId,
      code: pubCtrl?.code || code,
      name: title,
      team,
      at: new Date().toISOString(),
    };
    const out = addCheckin(rec);
    const time = new Date(out.rec.at).toLocaleString("zh-HK", { hour12: false });
    if (!out.ok) {
      document.getElementById("result").innerHTML = `<div class="ok">此隊已在 ${time} 打過本站。</div>`;
      return;
    }
    document.getElementById("result").innerHTML = `
      <div class="stamp-ok">到站證明</div>
      <p><strong>${escapeHtml(team)}</strong><br />${escapeHtml(pubCtrl?.code || code)}　${escapeHtml(title)}<br />${time}</p>
    `;
  });
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
