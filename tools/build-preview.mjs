// Builds preview/index.html: a self-contained demo of the collector's room
// using real stories and store images, with the backend mocked in-page.
// Usage: node tools/build-preview.mjs [--artifact] [slug ...]
// --artifact writes preview/artifact.html for claude.ai artifact hosting, whose
// sandbox blocks the Wix image CDN, so prints show labelled placeholder art.
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const stories = JSON.parse(readFileSync(join(root, 'data/stories.json'), 'utf8'));
const element = readFileSync(join(root, 'wix/public/custom-elements/pvr-room.js'), 'utf8');

const artifact = process.argv.includes('--artifact');
const argSlugs = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const picks = argSlugs.length ? argSlugs : [
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
const PALETTES = [['#5b3a2e', '#1f2a36'], ['#3c2a3e', '#16191f'], ['#2f3d3a', '#1a1714'], ['#6a4a2b', '#24303a']];
function placeholder(title, i) {
  const [a, b] = PALETTES[i % PALETTES.length];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="1000" viewBox="0 0 800 1000">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs>
<rect width="800" height="1000" fill="url(#g)"/><rect x="40" y="40" width="720" height="920" fill="none" stroke="#c89d5c" stroke-opacity=".35"/>
<text x="400" y="480" fill="#f3ece0" font-family="Georgia, serif" font-style="italic" font-size="52" text-anchor="middle">${title.replace(/&/g, '&amp;')}</text>
<text x="400" y="540" fill="#c89d5c" font-family="Helvetica, Arial, sans-serif" font-size="20" letter-spacing="6" text-anchor="middle">IMAGE SHOWN ON THE LIVE SITE</text></svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
}
const prints = picks.map((slug, i) => {
  const s = stories.find((x) => x.slug === slug);
  if (!s) throw new Error(`No story for ${slug}`);
  return {
    productId: s.id,
    title: s.title,
    price: s.price,
    inStock: s.inStock,
    ribbon: s.ribbon || '',
    image: artifact ? placeholder(s.title, i) : `https://static.wixstatic.com/media/${s.media}`,
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

const head = `<title>Private Viewing Room</title>
<style>:root { color-scheme: dark; } html, body { margin: 0; background: #15120f; color: #f3ece0; } .demo { font: 13px/1.5 system-ui, sans-serif; background: #2a231b; color: #e8dcc6; padding: 10px 16px; text-align: center; }</style>`;
const demoNote = artifact
  ? 'Demo of a Private Viewing Room for Jack Vettriano Studio. Requests are simulated, print images appear on the live site, and the browser voice stands in for the recorded narration.'
  : 'Demo of a Private Viewing Room. Requests are simulated; recorded narration replaces the browser voice once audio is generated.';
const body = `<div class="demo">${demoNote}</div>
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
</script>`;
// Artifact hosting supplies its own document skeleton.
const html = artifact ? `${head}\n${body}\n`
  : `<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n${head}\n</head>\n<body>\n${body}\n</body>\n</html>\n`;
const out = artifact ? 'preview/artifact.html' : 'preview/index.html';
writeFileSync(join(root, out), html);
console.log(`${out}: ${prints.length} prints, ${(html.length / 1024).toFixed(0)} KB`);
