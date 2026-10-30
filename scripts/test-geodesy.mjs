/**
 * 紙圖方位（方格北向上）的單元測試：
 *  1. UTM 方格收斂角 γ 的數值、正負號與對稱性；
 *  2. 「方格北向上」＝轉 −γ；
 *  3. index.html／css 有齊紙圖方位需要的接駁（#map-frame、#north-point、方格北向上規則）。
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  gridConvergenceDeg,
  gridNorthUpRotationDeg,
  utmZoneForLng,
} from "../js/hkgeo.js";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const css = readFileSync(new URL("../css/app.css", import.meta.url), "utf8");

test("UTM 中央子午線上收斂角為 0", () => {
  assert.ok(Math.abs(gridConvergenceDeg(22.35, 117, 50)) < 1e-9);
  assert.ok(Math.abs(gridConvergenceDeg(22.35, 111, 49)) < 1e-9);
});

test("香港：方格北偏離真北約 ±1°（向西／東）", () => {
  const central = gridConvergenceDeg(22.352, 114.158, 50); // 市區，zone 50
  const west = gridConvergenceDeg(22.352, 113.85, 49); // 大嶼山以西，zone 49
  // 114° 以東用 zone 50（中央子午線 117°E）→ 方格北在真北以西（負）
  assert.ok(central < -0.9 && central > -1.25, `central: ${central}`);
  // 114° 以西用 zone 49（中央子午線 111°E）→ 方格北在真北以東（正）
  assert.ok(west > 0.9 && west < 1.25, `west: ${west}`);
});

test("左右對稱：同一緯度、離中央子午線相同經差 → 角度相反", () => {
  const east = gridConvergenceDeg(22.35, 113.9, 49); // Δλ = +2.9°
  const west = gridConvergenceDeg(22.35, 114.1, 50); // Δλ = -2.9°
  assert.ok(Math.abs(east + west) < 1e-9, `${east} vs ${west}`);
});

test("全港（113.76–114.51°E、22.13–22.58°N）收斂角都在 1.5° 以內", () => {
  for (let lat = 22.13; lat <= 22.581; lat += 0.05) {
    for (let lng = 113.76; lng <= 114.511; lng += 0.05) {
      const zone = utmZoneForLng(lng);
      const deg = Math.abs(gridConvergenceDeg(lat, lng, zone));
      assert.ok(deg < 1.5, `${lat},${lng}: ${deg}`);
      assert.ok(deg > 0.5, `${lat},${lng}: ${deg}`); // 轉動量真係有需要
    }
  }
});

test("方格北向上＝轉 −γ（紙圖方向同 CSS rotate 一致）", () => {
  for (const [lat, lng] of [
    [22.352, 114.158],
    [22.45, 113.85],
    [22.2, 114.44],
  ]) {
    const zone = utmZoneForLng(lng);
    assert.equal(gridNorthUpRotationDeg(lat, lng, zone), -gridConvergenceDeg(lat, lng, zone));
  }
  // 市區：γ < 0（方格北在真北以西）→ 要順時針轉（正數）先可以令方格北向上。
  assert.ok(gridNorthUpRotationDeg(22.352, 114.158, 50) > 0);
});

test("頁面有齊紙圖方位的接駁", () => {
  assert.match(html, /id="map-frame"/);
  assert.match(html, /id="north-point"/);
  assert.match(html, /id="btn-paper-north"/);
  assert.match(css, /\.map-frame\s*\{/);
  assert.match(css, /body\[data-paper-north="grid"\] #map/);
  assert.match(css, /rotate\(var\(--map-rot/);
});
