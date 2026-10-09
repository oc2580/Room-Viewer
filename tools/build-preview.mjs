// Builds preview/index.html: a self-contained demo of the collector's room
// using real stories and store images, with the backend mocked in-page.
// Usage: node tools/build-preview.mjs [slug ...]
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const stories = JSON.parse(readFileSync(join(root, 'data/stories.json'), 'utf8'));
const element = readFileSync(join(root, 'wix/public/custom-elements/pvr-room.js'), 'utf8');

const picks = process.argv.slice(2).length ? process.argv.slice(2) : [
  'narcissistic-bathers',
  'jack-vettriano-print-an-imperfect-past',
  'jack-vettriano-print-yesterdays-dreams',
  'young-hearts',
];
const notes = {
  'narcissistic-bathers': 'You mentioned you wanted something from his final signed releases. This is the one I would choose: there will never be more of these.',
  'jack-vettriano-print-an-imperfect-past': 'Silkscreens of this image almost never come up. I held this one back for you before it goes on the website.',
};
const offers = { 'jack-vettriano-print-an-imperfect-past': 1595 };

const day = 86400000;
const prints = picks.map((slug) => {
  const s = stories.find((x) => x.slug === slug);
  if (!s) throw new Error(`No story for ${slug}`);
  return {
    productId: s.id,
    title: s.title,
    price: s.price,
    inStock: s.inStock,
    ribbon: s.ribbon || '',
    image: `https://static.wixstatic.com/media/${s.media}`,
    productUrl: `https://www.jackvettriano.studio/product-page/${s.slug}`,
    framedSizeFromStore: null,
    curatorNote: notes[slug] || '',
    offer: offers[slug] ? { price: offers[slug], expiresAt: new Date(Date.now() + 5 * day).toISOString() } : null,
    availability: s.inStock ? 'available' : 'out_of_stock',
    holdExpiresAt: null,
    story: {
      transcript: s.transcript,
      audioUrl: '',
      estDurationSec: s.estDurationSec,
      edition: s.edition,
      medium: s.medium || '',
      signed: !!s.signed,
      imageSizeCm: s.imageSizeCm || null,
      mountSizeCm: s.mountSizeCm || null,
      framedSizeCm: s.framedSizeCm || null,
    },
    requests: [],
  };
});

const payload = {
  room: {
    slug: 'johnson-demo',
    collectorName: 'Mr & Mrs Johnson',
    greeting: 'It was a pleasure to meet you both at the Studio. As promised, here are the pieces we talked about, along with a couple I think you will love. Press play on any of them to hear the story behind the print, and take your time: this room is yours for the next fortnight.',
    greetingAudioUrl: '',
    expiresAt: new Date(Date.now() + 14 * day).toISOString(),
    holdHours: 48,
  },
  prints,
};

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Private Viewing Room</title>
<style>html, body { margin: 0; background: #15120f; } .demo { font: 13px/1.5 system-ui, sans-serif; background: #2a231b; color: #e8dcc6; padding: 10px 16px; text-align: center; }</style>
</head>
<body>
<div class="demo">Demo of a Private Viewing Room. Requests are simulated; recorded narration replaces the browser voice once audio is generated.</div>
<pvr-room speech-fallback></pvr-room>
<script>
${element}
</script>
<script>
const data = ${JSON.stringify(payload)};
const el = document.querySelector('pvr-room');
el.rpcHandler = async (method, args) => {
  await new Promise((r) => setTimeout(r, 500));
  if (method === 'logEvents') { console.log('analytics', args[0]); return { logged: args[0].length }; }
  if (method === 'submitRequest') {
    const { productId, type, message } = args[1];
    const p = data.prints.find((x) => x.productId === productId);
    p.requests.unshift({ type, message, status: 'pending', reply: '', createdAt: new Date().toISOString() });
    if (type === 'hold') p.availability = 'hold_pending';
    return data;
  }
  throw new Error('Unknown method ' + method);
};
el.setAttribute('room', JSON.stringify(data));
</script>
</body>
</html>
`;
writeFileSync(join(root, 'preview/index.html'), html);
console.log(`preview/index.html: ${prints.length} prints, ${(html.length / 1024).toFixed(0)} KB`);
