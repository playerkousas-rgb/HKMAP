/* HKMAP v1.1.0 · © SCOUT SYSTEM. Loaded synchronously in each page's head. */
if (typeof initStoreGate === 'function') {
  const decision = initStoreGate({
    appKey: 'hkmap',
    mode: 'entry-gate',
    portalIds: ['appstore'],
    silentPortalIds: ['library'],
    allowStandalone: true,
    autoRedirectSeconds: 0
  });

  // Only the toolbar binding waits for the DOM; admission has already run.
  if (decision.allowed) document.addEventListener('DOMContentLoaded', () => {
    const link = document.getElementById('storeSupportTop');
    if (!link || typeof globalThis.ScoutStoreGate?.getAppStoreUrl !== 'function') return;
    link.href = ScoutStoreGate.getAppStoreUrl('hkmap');
    link.hidden = false;
  }, { once: true });
}
