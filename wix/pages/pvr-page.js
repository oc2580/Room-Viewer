// Router page "pvr-page" (Pages > Router Pages > Pvr Pages).
// Add a Custom Element to the page: Source = Velo file
// public/custom-elements/pvr-room.js, tag name "pvr-room", ID "pvrRoom",
// stretched to full width.
import wixWindowFrontend from 'wix-window-frontend';
import { getRoom, submitRequest, logEvents } from 'backend/pvr.web';

const METHODS = { getRoom, submitRequest, logEvents };

$w.onReady(() => {
  const el = $w('#pvrRoom');
  el.on('pvr-rpc', async (event) => {
    const { id, method, args } = event.detail;
    try {
      if (!METHODS[method]) throw new Error('Unknown action');
      const result = await METHODS[method](...args);
      el.setAttribute('rpc-result', JSON.stringify({ id, ok: true, result }));
    } catch (err) {
      el.setAttribute('rpc-result', JSON.stringify({ id, ok: false, error: err.message }));
    }
  });
  el.setAttribute('room', JSON.stringify(wixWindowFrontend.getRouterData()));
});
