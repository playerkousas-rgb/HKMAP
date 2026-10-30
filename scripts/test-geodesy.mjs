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
  hm20cSheetAngles,
  nearestHm20cSheet,
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

test("HM20C 16 幅各有自己固定的方位（幅 1 圖例除外）", () => {
  const sheets = hm20cSheetAngles();
  assert.equal(sheets.length, 15);
  // 每幅角度不同（同紙本一樣，幅幅自己一個擺法）
  assert.ok(new Set(sheets.map((s) => s.rotation.toFixed(2))).size >= 8);
  for (const sheet of sheets) {
    assert.ok(Math.abs(sheet.rotation) > 0.5 && Math.abs(sheet.rotation) < 1.5, `${sheet.id}: ${sheet.rotation}`);
    // 114° 以西（zone 49）方格北在真北以東 → 逆時針（負）；以東（zone 50）相反。
    assert.equal(sheet.rotation > 0, sheet.zone === 50, `${sheet.id} zone ${sheet.zone} rotation ${sheet.rotation}`);
  }
});

test("地圖中心按最近圖幅中心分幅（幅 1 圖例永遠唔會被選中）", () => {
  assert.equal(nearestHm20cSheet(22.3815, 114.1898).id, "7"); // 沙田
  assert.equal(nearestHm20cSheet(22.289, 113.941).id, "9"); // 東涌
  assert.equal(nearestHm20cSheet(22.4, 114.3).id, "8"); // 西貢
  assert.equal(nearestHm20cSheet(22.209, 114.029).id, "14"); // 長洲
  assert.notEqual(nearestHm20cSheet(22.352, 114.158).id, "1");
  // 同一幅內任取兩點，角度一定相同（同紙本一樣唔會邊行邊轉）。
  const a = nearestHm20cSheet(22.375, 114.185);
  const b = nearestHm20cSheet(22.39, 114.2);
  if (a.id === b.id) assert.equal(a.rotation, b.rotation);
});
