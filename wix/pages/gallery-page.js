// Page "Gallery Tour" (/gallery-tour). Add a Custom Element: Source = Velo file
// public/custom-elements/jv-gallery.js, tag name "jv-gallery", ID "jvGallery",
// stretched to full width.
import wixWindowFrontend from 'wix-window-frontend';
import wixLocationFrontend from 'wix-location-frontend';
import wixStoresFrontend from 'wix-stores-frontend';
import {
  getGallery, getPrintOptions, getMyActivity, submitRequest, answerCounterOffer, logEvents,
} from 'backend/gallery.web';

console.log('Gallery: page code loaded');

// Fails with a message instead of waiting forever.
function withTimeout(promise, ms, message) {
  return Promise.race([promise, new Promise((_, reject) => { setTimeout(() => reject(new Error(message)), ms); })]);
}

// Adds the print, with the framed or unframed option the visitor chose, the
// same way the Wix Stores product page does. Wix opens its side basket.
async function addToBasket(productId, variantId) {
  const item = { productId, quantity: 1 };
  if (variantId) {
    const options = await getPrintOptions(productId);
    const chosen = options.find((o) => o.variantId === variantId);
    if (chosen && Object.keys(chosen.choices || {}).length) item.options = { choices: chosen.choices };
  }
  await withTimeout(wixStoresFrontend.cart.addProducts([item]), 20000, 'The basket did not respond.');
  return { added: true };
}

const METHODS = { getGallery, getPrintOptions, getMyActivity, submitRequest, answerCounterOffer, logEvents, addToBasket };

function analyticsAllowed() {
  try {
    const { policy } = wixWindowFrontend.consentPolicy.getCurrentConsentPolicy();
    return !!policy.analytics;
  } catch (e) {
    return false;
  }
}

$w.onReady(() => {
  console.log('Gallery: page code started');
  const el = $w('#jvGallery');
  if (!el || typeof el.setAttribute !== 'function') {
    console.error('Gallery: no element with the ID jvGallery on this page. Check the custom element\'s ID.');
    return;
  }
  const q = wixLocationFrontend.query;
  if (q.shortlist) el.setAttribute('shared-shortlist', String(q.shortlist).slice(0, 500));
  if (q.print) el.setAttribute('open-print', String(q.print));
  if (q.tour) el.setAttribute('start-tour', String(q.tour));
  el.setAttribute('share-url', 'https://www.jackvettriano.studio/gallery-tour');
  el.setAttribute('analytics', analyticsAllowed() ? 'on' : 'off');
  try {
    wixWindowFrontend.consentPolicy.onConsentPolicyChanged(() => el.setAttribute('analytics', analyticsAllowed() ? 'on' : 'off'));
  } catch (e) { /* older sites without the consent banner */ }

  const handled = new Set();
  el.on('jv-rpc', async (event) => {
    const { id, method, args } = event.detail;
    // The element resends until it sees this acknowledgement; answer each request once.
    if (handled.has(id)) return;
    handled.add(id);
    el.setAttribute('rpc-ack', id);
    const started = Date.now();
    // These lines appear in Developer Tools > Logging Tools, to diagnose problems.
    if (method !== 'logEvents') console.log(`Gallery: ${method} requested`);
    try {
      if (!METHODS[method]) throw new Error('Unknown action');
      const result = await METHODS[method](...args);
      const json = JSON.stringify({ id, ok: true, result });
      if (method !== 'logEvents') console.log(`Gallery: ${method} answered in ${Date.now() - started} ms (${Math.round(json.length / 1024)} KB)`);
      el.setAttribute('rpc-result', json);
    } catch (err) {
      console.error(`Gallery: ${method} failed after ${Date.now() - started} ms: ${err.message}`);
      el.setAttribute('rpc-result', JSON.stringify({ id, ok: false, error: err.message }));
    }
  });
  el.setAttribute('ready', '');
  console.log('Gallery: page code ready');
});
