import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { pageGeometryMm, PAPER_MM } from "../js/hkgeo.js";

const css = readFileSync(new URL("../css/app.css", import.meta.url), "utf8");

/** 取出某個選擇器的第一段規則（夠用嘅簡單 CSS 讀取，避免加依賴）。 */
function rule(selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = css.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`));
  assert.ok(match, `找不到 ${selector} 規則`);
  return match[1];
}

/* 背景：Chrome 列印多頁文件（地圖＋檢查點說明）時，如果 #map 用咗
   transform: translate(-50%, -50%) 置中，Leaflet 圖層（圖磚、方格網、標記）
   會整層印低幾十 mm——即「列印／另存 PDF 時地圖移位」。
   所以置中一定要用 left／top + calc，唔可以用百分比 translate。 */
test("列印：地圖用 left/top calc 置中，不再用百分比 translate", () => {
  const mapRule = rule("#map");
  assert.doesNotMatch(
    mapRule,
    /translate\([^)]*%/,
    "#map 用百分比 translate 會令列印多頁 PDF 時 Leaflet 圖層移位"
  );
  assert.match(mapRule, /left:\s*calc\(/, "#map 要用 left: calc() 置中");
  assert.match(mapRule, /top:\s*calc\(/, "#map 要用 top: calc() 置中");
  assert.match(mapRule, /--map-box-w/, "#map 闊度要用 --map-box-w（實際盒闊）");
  assert.match(mapRule, /--map-box-h/, "#map 高度要用 --map-box-h（實際盒高）");
  assert.match(mapRule, /rotate\(var\(--map-rot/, "#map 仍然要按方格北轉動");
});

test("方格北向上：放大盒轉動後仍然蓋滿整個圖框（預留到 1.2°）", () => {
  const frame = rule(".map-frame");
  const c = Number(frame.match(/--rot-c:\s*([\d.]+)/)?.[1]);
  const s = Number(frame.match(/--rot-s:\s*([\d.]+)/)?.[1]);
  assert.ok(Number.isFinite(c) && Number.isFinite(s), "要有 --rot-c／--rot-s");
  // 轉動後的放大盒：闊＝W·c＋H·s、高＝H·c＋W·s（同 CSS 計法一致）。
  const gridFrame = rule('body[data-paper-north="grid"] .map-frame');
  assert.match(gridFrame, /--map-box-w:\s*calc\(var\(--map-w\) \* var\(--rot-c\) \+ var\(--map-h\) \* var\(--rot-s\)\)/);
  // 圖框的四隻角，在「轉了 θ 的放大盒」座標系內要全部落在盒內，四角才不會露白。
  for (const paper of Object.keys(PAPER_MM)) {
    for (const orientation of ["landscape", "portrait"]) {
      const { mapW: w, mapH: h } = pageGeometryMm(paper, orientation);
      const boxW = w * c + h * s;
      const boxH = h * c + w * s;
      for (let deg = -1.2; deg <= 1.2 + 1e-9; deg += 0.1) {
        const rad = (deg * Math.PI) / 180;
        for (const [x, y] of [
          [-w / 2, -h / 2],
          [w / 2, -h / 2],
          [-w / 2, h / 2],
          [w / 2, h / 2],
        ]) {
          const rx = x * Math.cos(rad) + y * Math.sin(rad);
          const ry = -x * Math.sin(rad) + y * Math.cos(rad);
          assert.ok(
            Math.abs(rx) <= boxW / 2 + 1e-6 && Math.abs(ry) <= boxH / 2 + 1e-6,
            `${paper} ${orientation} ${deg.toFixed(1)}°：圖框角落露出放大盒`
          );
        }
      }
    }
  }
});

test("列印：紙張／方向同 mm 排版尺寸一致（圖框＋圖名＋圖腳＝紙高）", () => {
  for (const paper of Object.keys(PAPER_MM)) {
    for (const orientation of ["landscape", "portrait"]) {
      const g = pageGeometryMm(paper, orientation);
      assert.equal(g.mapW, g.sheetW, `${paper} ${orientation} 圖框闊度要等於紙闊`);
      assert.ok(
        Math.abs(g.headH + g.mapH + g.footH - g.sheetH) < 1e-9,
        `${paper} ${orientation}：head ${g.headH} + map ${g.mapH} + foot ${g.footH} ≠ 紙高 ${g.sheetH}`
      );
    }
  }
});

test("列印：地圖尺寸改用 -print 變數（畫面＝列印）", () => {
  // 列印區塊要將 --map-w／--map-h 換成 -print 版本，否則列印會用錯紙。
  const printBlock = css.slice(css.indexOf("@media print"));
  assert.match(printBlock, /--map-w:\s*var\(--map-w-print/);
  assert.match(printBlock, /--map-h:\s*var\(--map-h-print/);
});

test("列印：起點三角形用 inline SVG，唔靠 CSS 背景圖（背景圖形關掉都印得見）", () => {
  const overprint = readFileSync(new URL("../js/overprint.js", import.meta.url), "utf8");
  const startIcon = overprint.match(/kind === "start"[\s\S]*?\n  \}/)?.[0] || "";
  const startHtml = startIcon.match(/html:\s*(`[^`]*`)/)?.[1] || "";
  assert.match(startHtml, /<svg[^>]*class="course-start"/, "起點要用 inline <svg class=\"course-start\">");
  assert.match(startHtml, /viewBox="0 0 24 22"/, "起點 SVG 要有 24×22 viewBox");
  assert.match(startHtml, /<path d="M12 2 L22 20 H2 Z"/, "起點 SVG 要畫三角形");
  assert.match(startHtml, /stroke="#d00070"/, "起點三角形要紫紅色描邊");
  assert.doesNotMatch(startHtml, /background-image|url\(/, "起點唔可以用 CSS 背景圖（列印會消失）");
  // 起點標記要喺最頂層，唔好被方格數字／其他標記蓋住。
  assert.match(overprint, /zIndexOffset:\s*1000/, "路線標記要 zIndexOffset 1000");
});

test("列印：起點／路線標記容器全透明，並有 print-color-adjust", () => {
  const startRule = rule(".course-start");
  assert.doesNotMatch(startRule, /background-image|url\(/, "起點容器唔可以用背景圖");
  assert.match(startRule, /background:\s*transparent/, "起點容器要透明，唔可以有白底");
  assert.match(startRule, /print-color-adjust:\s*exact/, "起點要 print-color-adjust: exact");
  const iconRule = rule(".course-icon");
  assert.match(iconRule, /background:\s*transparent/, "標記容器要透明");
  assert.match(iconRule, /border:\s*0/, "標記容器唔可以有邊框");
});
