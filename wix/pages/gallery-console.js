// Dashboard page "Gallery" (Editor: Pages > Dashboard Pages > Add).
// Add a Custom Element: Source = Velo file public/custom-elements/jv-console.js,
// tag name "jv-console", ID "jvConsole", full width.
import * as studio from 'backend/gallery-console.web';
// Runs server-side only when called, so the console works before
// @anthropic-ai/sdk is installed (see SETUP.md).
import { draftStoryWithClaude } from 'backend/gallery-claude.web';

const ALLOWED = [
  'listCatalogue', 'importStarterContent', 'addStory', 'saveStory', 'setStoryStatus', 'generateStoryAudio',
  'listTours', 'saveTour', 'setTourStatus', 'deleteTour',
  'listLeads', 'getLeadDetail', 'updateLead', 'listRequests', 'respondToRequest', 'getInsights',
];

$w.onReady(() => {
  const el = $w('#jvConsole');
  el.on('jv-rpc', async (event) => {
    const { id, method, args } = event.detail;
    try {
      let fn = ALLOWED.includes(method) ? studio[method] : null;
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
  el.setAttribute('ready', '');
});
