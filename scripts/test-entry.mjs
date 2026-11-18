import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const read = file => readFileSync(new URL('../' + file, import.meta.url), 'utf8');
const version = 'v' + JSON.parse(read('package.json')).version;
const vendorFile = 'store_gate_v1.0.js';
const entryFile = `js/entry_${version}.js`;
const vendor = read(vendorFile);
const entry = read(entryFile);
const pages = ['index', 'download', 'mock', 'print'];

test('stock SG18/19 helper and synchronous, version-matched entry in every HTML head', () => {
  // readme@4c63ac30 · templates/vercel/store_gate_v1.0.js (not an app fork)
  assert.equal(createHash('sha256').update(vendor).digest('hex'),
    '45de189d68e9fbf64d560a4306987d1a03cd03f03e56dd24222a4343011e3d5b');
  assert.ok(entry.startsWith(`/* HKMAP ${version} `));
  assert.equal(JSON.parse(read('vercel.json')).outputDirectory, '.');
  for (const page of pages) {
    const html = read(`${page}.html`);
    const head = html.split('<head>')[1].split('<title>')[0];
    assert.deepEqual([...head.matchAll(/<script\b[^>]*>/g)].map(m => m[0]),
      [`<script src="/${vendorFile}">`, `<script src="/${entryFile}">`], page);
    assert.match(head, /<meta charset="utf-8"\s*\/>\s*<script/i);
    assert.ok(head.includes(`<meta name="app-version" content="${version}"`));
    assert.ok(html.match(/<title>(.*?)<\/title>/)[1].includes(version));
    if (page !== 'print') {
      const link = html.match(/<header class="topbar">[\s\S]*?(<a id="storeSupportTop"[^>]*>)/)?.[1];
      assert.ok(link, page);
      for (const attr of ['hidden', 'target="_blank"', 'rel="noopener"', 'aria-label=', 'title=']) assert.ok(link.includes(attr));
      assert.doesNotMatch(link, /\bhref\s*=/);
    }
  }
});

// Exercise the actual HKMAP options against the unmodified helper. Rendering, print
// and real link clicks are separate browser checks; this VM has no rendered DOM.
function visit({ from, standalone = false, pass = false, helper = true } = {}) {
  const session = new Map(pass ? [['hkmap.store_pass', '1']] : []);
  const callbacks = [];
  const link = { hidden: true };
  const document = {
    referrer: '', getElementById: () => link,
    addEventListener(event, fn) { if (event === 'DOMContentLoaded') callbacks.push(fn); },
  };
  const window = { document, location: { origin: 'https://hkmap.vercel.app' },
    matchMedia: q => ({ matches: standalone && q === '(display-mode: standalone)' }),
    sessionStorage: { getItem: k => session.get(k), setItem: (k, v) => session.set(k, v) },
  };
  window.self = window.top = window;
  const scope = vm.createContext({ URL, window, document });
  vm.runInContext(vendor, scope);
  const api = scope.ScoutStoreGate;
  if (from) document.referrer = api.getPortal(from).url;
  let decision, options;
  scope.initStoreGate = config => {
    options = JSON.parse(JSON.stringify(config));
    return decision = api.initStoreGate(config, window);
  };
  vm.runInContext(entry, scope);
  if (!helper) vm.runInContext('globalThis.ScoutStoreGate = undefined', scope);
  callbacks.forEach(fn => fn());
  return { options, decision, session, link, api };
}

test('fresh direct visit: denied, one visible portal, no grant or support link', () => {
  const { options, decision, session, link, api } = visit();
  assert.deepEqual(options, { appKey: 'hkmap', mode: 'entry-gate', portalIds: ['appstore'],
    silentPortalIds: ['library'], allowStandalone: true, autoRedirectSeconds: 0 });
  assert.equal(decision.allowed, false);
  assert.equal(session.size, 0);
  assert.deepEqual(Array.from(api.normalizePortals(options)).filter(p => !p.silent).map(p => p.id), ['appstore']);
  assert.deepEqual(link, { hidden: true });
});

for (const from of ['appstore', 'library']) {
  test(`fresh visit from ${from}: attributed pass, HKMAP detail link`, () => {
    const { decision, session, link, api } = visit({ from });
    assert.equal(decision.allowed, true);
    assert.equal(decision.matchedPortalId, from);
    assert.deepEqual([...session], [['hkmap.store_pass', '1']]);
    const url = new URL(link.href);
    assert.equal(url.origin, new URL(api.getPortal('appstore').url).origin);
    assert.equal(url.pathname + url.search, '/?app=hkmap');
    assert.equal(link.hidden, false);
  });
}

test('standalone and admitted reload are allowed; missing support helper gives no dead link', () => {
  assert.equal(visit({ standalone: true }).decision.reason, 'standalone-pwa');
  assert.equal(visit({ pass: true }).decision.reason, 'session-pass');
  assert.deepEqual(visit({ from: 'library', helper: false }).link, { hidden: true });
});

test('a blocked document never starts the editor (including its ?reset handler) or download page', async () => {
  for (const [page, app] of [['index', 'js/app.js'], ['download', 'js/download-page.js']]) {
    const html = read(`${page}.html`);
    assert.ok(!html.includes(`src="${app}"`), 'no unconditional app script');
    const boot = html.match(/<script type="module">([\s\S]*?)<\/script>/)[1];
    assert.ok(boot.includes(`import('./${app}')`));
    await vm.runInNewContext(`(async () => { ${boot} })()`, {
      document: { documentElement: { hasAttribute: name => name === 'data-store-gated' } },
    }); // An attempted import would reject: there is no module loader in this context.
  }
});
