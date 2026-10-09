// Page "Gallery" (/gallery). Add a Custom Element: Source = Velo file
// public/custom-elements/jv-gallery.js, tag name "jv-gallery", ID "jvGallery",
// stretched to full width.
import wixWindowFrontend from 'wix-window-frontend';
import wixLocationFrontend from 'wix-location-frontend';
import wixEcomFrontend from 'wix-ecom-frontend';
import { currentCartV2 } from '@wix/ecom';
import {
  getGallery, getPrintOptions, getMyActivity, submitRequest, answerCounterOffer, logEvents,
} from 'backend/gallery.web';

const STORES_APP_ID = '215238eb-22a5-4c36-9e7b-e7c08025e04e';

async function addToBasket(productId, variantId) {
  await currentCartV2.addLineItemsToCurrentCart({
    catalogItems: [{
      catalogReference: { catalogItemId: productId, appId: STORES_APP_ID, ...(variantId ? { options: { variantId } } : {}) },
      quantity: 1,
    }],
  });
  try { await wixEcomFrontend.refreshCart(); } catch (e) { /* cart icon refreshes on next page */ }
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
  const el = $w('#jvGallery');
  const q = wixLocationFrontend.query;
  if (q.shortlist) el.setAttribute('shared-shortlist', String(q.shortlist).slice(0, 500));
  if (q.print) el.setAttribute('open-print', String(q.print));
  if (q.tour) el.setAttribute('start-tour', String(q.tour));
  el.setAttribute('share-url', 'https://www.jackvettriano.studio/gallery');
  el.setAttribute('analytics', analyticsAllowed() ? 'on' : 'off');
  try {
    wixWindowFrontend.consentPolicy.onConsentPolicyChanged(() => el.setAttribute('analytics', analyticsAllowed() ? 'on' : 'off'));
  } catch (e) { /* older sites without the consent banner */ }

  el.on('jv-rpc', async (event) => {
    const { id, method, args } = event.detail;
    try {
      if (!METHODS[method]) throw new Error('Unknown action');
      const result = await METHODS[method](...args);
      el.setAttribute('rpc-result', JSON.stringify({ id, ok: true, result }));
    } catch (err) {
      el.setAttribute('rpc-result', JSON.stringify({ id, ok: false, error: err.message }));
    }
  });
  el.setAttribute('ready', '');
});
