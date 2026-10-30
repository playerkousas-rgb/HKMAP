import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { CONTOUR_INDEX_M, CONTOUR_INTERVAL_M, contourStyleForBasemap } from "../js/contours.js";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const css = readFileSync(new URL("../css/app.css", import.meta.url), "utf8");

function filterFor(id) {
  const filter = html.match(new RegExp(`<filter id="${id}"[^>]*>([\\s\\S]*?)<\\/filter>`));
  assert.ok(filter, `missing ${id}`);
  assert.match(filter[0], /color-interpolation-filters="sRGB"/);
  return filter[1];
}

function applyBaseColours(rgb) {
  const filter = filterFor("hm20c-basemap-colours");
  const saturation = Number(filter.match(/<feColorMatrix type="saturate" values="([^"]+)"/)?.[1]);
  assert.ok(Number.isFinite(saturation));
  assert.match(filter, /<feFuncA type="identity"\s*\/>/);
  const tables = ["R", "G", "B"].map((channel) => {
    const match = filter.match(new RegExp(`<feFunc${channel} type="table" tableValues="([^"]+)"`));
    assert.ok(match, `missing ${channel} table`);
    const table = match[1].trim().split(/\s+/).map(Number);
    assert.ok(table.length >= 2 && table.every(Number.isFinite));
    assert.equal(table[0], 0);
    assert.equal(table.at(-1), 1);
    assert.ok(table.every((value, i) => i === 0 || value >= table[i - 1]), "tones must remain monotonic");
    return table;
  });
  const luminosity = 0.213 * rgb[0] + 0.715 * rgb[1] + 0.072 * rgb[2];
  return rgb.map((value, i) => {
    const saturated = (luminosity + saturation * (value - luminosity)) / 255;
    const position = saturated * (tables[i].length - 1);
    const left = Math.min(tables[i].length - 2, Math.floor(position));
    const amount = position - left;
    return Math.round((tables[i][left] * (1 - amount) + tables[i][left + 1] * amount) * 255);
  });
}

function applyLabelColours(rgb) {
  const filter = filterFor("hm20c-label-colours");
  const match = filter.match(/<feColorMatrix[^>]*values="([^"]+)"/);
  assert.ok(match, "missing label colour matrix");
  const matrix = match[1].trim().split(/\s+/).map(Number);
  assert.equal(matrix.length, 20);
  assert.ok(matrix.every(Number.isFinite));
  assert.deepEqual(matrix.slice(15), [0, 0, 0, 1, 0], "opacity must remain unchanged");
  const inputs = [...rgb.map((value) => value / 255), 1, 1];
  return [0, 1, 2].map((row) => {
    const value = inputs.reduce((sum, input, col) => sum + input * matrix[row * 5 + col], 0);
    return Math.round(Math.max(0, Math.min(1, value)) * 255);
  });
}

test("紙圖底色偏白、水色偏淺藍，文字和地物仍有對比", () => {
  const land = applyBaseColours([247, 248, 230]);
  const sea = applyBaseColours([206, 237, 255]);
  const trail = applyBaseColours([145, 148, 140]);
  assert.ok(land[0] > 245 && land[1] > 245 && land[2] > 242, `land: ${land}`);
  assert.ok(sea[0] >= 210 && sea[0] <= 220 && sea[1] >= 240 && sea[2] >= 250, `sea: ${sea}`);
  assert.ok(trail.every((channel) => channel < 120), `trail: ${trail}`);
});

test("底圖藍色溪澗、綠色植被和棕色地物保持可辨別", () => {
  const stream = applyBaseColours([100, 200, 220]);
  const vegetation = applyBaseColours([100, 180, 130]);
  const brown = applyBaseColours([205, 181, 150]);
  assert.ok(stream[2] > stream[1] && stream[1] > stream[0], `stream: ${stream}`);
  assert.ok(vegetation[1] > vegetation[0] && vegetation[1] > vegetation[2], `vegetation: ${vegetation}`);
  assert.ok(brown[0] > brown[1] && brown[1] > brown[2], `brown: ${brown}`);
});

test("地名偏深色，水域地名保持藍色", () => {
  const hillName = applyLabelColours([160, 128, 80]);
  const waterName = applyLabelColours([56, 128, 152]);
  assert.ok(hillName.every((channel) => channel < 100), `hill: ${hillName}`);
  assert.ok(waterName[0] < waterName[1] && waterName[1] < waterName[2], `water: ${waterName}`);
});

test("濾鏡只套在 HM20C 底圖和地名字磚，並適用列印", () => {
  assert.match(css, /body\[data-basemap="hm20c"\] \.hm20c-base-tiles \.leaflet-tile\s*\{\s*filter:\s*url\("#hm20c-basemap-colours"\)/);
  assert.match(css, /body\[data-basemap="hm20c"\] \.landsd-label-tiles \.leaflet-tile\s*\{\s*filter:\s*url\("#hm20c-label-colours"\)/);
  assert.match(css, /\.contour-label-pane\.on-hm20c \.contour-label span\s*\{\s*color:\s*#9d7a6e/);
  assert.match(css, /body\[data-basemap="hm20c"\] \.contour-swatch\s*\{\s*border-top-color:\s*#be998a/);
});

test("等高線只改顏色，不改間距、線寬或其他底圖的配色", () => {
  assert.equal(CONTOUR_INTERVAL_M, 20);
  assert.equal(CONTOUR_INDEX_M, 100);
  assert.deepEqual(contourStyleForBasemap("hm20c", false), { color: "#be998a", opacity: 0.85, weight: 0.75 });
  assert.deepEqual(contourStyleForBasemap("hm20c", true), { color: "#be998a", opacity: 0.85, weight: 1.5 });
  assert.deepEqual(contourStyleForBasemap("countryside", false), { color: "#8a4a14", opacity: 0.85, weight: 0.75 });
  assert.deepEqual(contourStyleForBasemap("imagery", true), { color: "#ffd27f", opacity: 0.92, weight: 1.5 });
});
