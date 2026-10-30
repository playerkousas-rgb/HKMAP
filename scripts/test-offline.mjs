/**
 * 離線底圖（Service Worker ＋ 預先下載）的結構測試：
 *  - sw.js 喺根目錄（scope 才是整個網站），tile cache 名要同 js/offline.js 一致；
 *  - 下載只用官方 LandsD API、no-cors（圖磚唔需要 CORS）、cache: "reload"（要最新版本）；
 *  - 頁面有入口、dialog、狀態 chip，app.js 有接駁。
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";

const root = new URL("../", import.meta.url);
const read = (file) => readFileSync(new URL(file, root), "utf8");

test("Service Worker 喺根目錄，cache 名同頁面一致", () => {
  assert.ok(existsSync(new URL("sw.js", root)), "缺少 sw.js");
  const sw = read("sw.js");
  const offline = read("js/offline.js");
  const cacheName = (text) => text.match(/["'](landsd-tiles-v\d+)["']/)?.[1];
  assert.ok(cacheName(sw), "sw.js 未定義圖磚 cache 名");
  assert.equal(cacheName(sw), cacheName(offline), "sw.js 同 js/offline.js 的 cache 名要一樣");
  assert.match(sw, /mapapi\.geodata\.gov\.hk/);
  assert.match(sw, /addEventListener\("fetch"/);
});

test("下載只用官方 API、no-cors、要求最新版本", () => {
  const offline = read("js/offline.js");
  assert.match(offline, /landsdUrl\("basemap"\)/);
  assert.match(offline, /landsdUrl\("label", "tc"\)/);
  assert.match(offline, /mode: "no-cors"/);
  assert.match(offline, /cache: "reload"/);
  assert.match(offline, /MAX_TILES/);
  assert.match(offline, /caches\.open\(TILE_CACHE\)/);
});

test("頁面有離線入口、dialog、狀態 chip，app.js 有接駁", () => {
  const html = read("index.html");
  assert.match(html, /id="btn-offline"/);
  assert.match(html, /id="offline"/);
  assert.match(html, /id="offline-start"/);
  assert.match(html, /id="offline-clear"/);
  assert.match(html, /id="offline-chip"/);
  assert.match(read("js/app.js"), /setupOffline\(map, \{ t, toast, askConfirm \}\)/);
});
