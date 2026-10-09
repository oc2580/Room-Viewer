// Dashboard page "Viewing Rooms" (Editor: Pages > Dashboard Pages > Add).
// Add a Custom Element: Source = Velo file public/custom-elements/pvr-director.js,
// tag name "pvr-director", ID "pvrDirector", full width.
import * as director from 'backend/pvr-director.web';
// Runs server-side only when called, so the rest of the console works even
// before @anthropic-ai/sdk is installed (see SETUP.md).
import { draftStoryWithClaude } from 'backend/pvr-claude.web';

const ALLOWED = [
  'listCatalogue', 'importStarterStories', 'addStory', 'saveStory', 'setStoryStatus', 'generateStoryAudio',
  'getAudioUploadUrl', 'listRooms', 'getRoomDetail', 'saveRoom', 'setRoomStatus',
  'setRoomItems', 'listRequests', 'respondToRequest',
];

$w.onReady(() => {
  const el = $w('#pvrDirector');
  el.on('pvr-rpc', async (event) => {
    const { id, method, args } = event.detail;
    try {
      let fn = ALLOWED.includes(method) ? director[method] : null;
      if (method === 'draftStoryWithClaude') fn = draftStoryWithClaude;
      if (!fn) throw new Error('Unknown action');
      const result = await fn(...args).catch((err) => {
        if (method === 'draftStoryWithClaude' && /anthropic|secret/i.test(err.message)) {
          throw new Error('Claude drafting is not set up yet: install @anthropic-ai/sdk and add the ANTHROPIC_API_KEY secret.');
        }
        throw err;
      });
      el.setAttribute('rpc-result', JSON.stringify({ id, ok: true, result }));
    } catch (err) {
      el.setAttribute('rpc-result', JSON.stringify({ id, ok: false, error: err.message }));
    }
  });
});
