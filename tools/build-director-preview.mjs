// Builds preview/director.html: the director console running against an
// in-memory mock of the Wix backend, seeded with the real catalogue and stories.
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const stories = JSON.parse(readFileSync(join(root, 'data/stories.json'), 'utf8'));
const element = readFileSync(join(root, 'wix/public/custom-elements/pvr-director.js'), 'utf8');

const catalogue = stories.map((s) => ({
  productId: s.id, title: s.title, price: s.price, inStock: s.inStock, ribbon: s.ribbon || '',
  image: `https://static.wixstatic.com/media/${s.media}`,
  story: {
    _id: `story-${s.id}`, status: 'draft', transcript: s.transcript, edition: s.edition || '',
    medium: s.medium || '', signed: !!s.signed, imageSizeCm: s.imageSizeCm || '', mountSizeCm: s.mountSizeCm || '',
    framedSizeCm: s.framedSizeCm || '', reviewNotes: s.reviewNotes || '', estDurationSec: s.estDurationSec,
    audioUrl: '', audioCurrent: false,
  },
}));

const mock = `
const db = { catalogue: ${JSON.stringify(catalogue)}, rooms: [], items: [], requests: [] };
const wait = () => new Promise((r) => setTimeout(r, 250));
const uid = () => Math.random().toString(36).slice(2, 10);
const findStory = (id) => db.catalogue.find((p) => p.story && p.story._id === id);
db.catalogue.slice(0, 6).forEach((p) => { p.story.status = 'approved'; });
const room0 = { _id: 'room-1', slug: 'johnson-k3f9q2m7x1', collectorName: 'Mr & Mrs Johnson', collectorEmail: 'johnson@example.com',
  greeting: 'It was a pleasure to meet you both at the Studio.', greetingAudioUrl: '', status: 'live',
  expiresAt: new Date(Date.now() + 12 * 864e5).toISOString(), openCount: 3,
  firstOpenedAt: new Date(Date.now() - 2 * 864e5).toISOString(), lastOpenedAt: new Date(Date.now() - 3600e3).toISOString() };
db.rooms.push(room0);
[2, 0, 5].forEach((k, i) => db.items.push({ roomId: 'room-1', productId: db.catalogue[k].productId, sortOrder: i, curatorNote: i ? '' : 'The one I would choose for your hallway.', offerPrice: i === 1 ? 1595 : null, offerExpiresAt: null }));
db.requests.push({ _id: 'req-1', roomId: 'room-1', productId: db.catalogue[2].productId, printTitle: db.catalogue[2].title, collectorName: 'Mr & Mrs Johnson', type: 'hold', message: 'Could you hold this until we see it on Saturday?', status: 'pending', _createdDate: new Date(Date.now() - 5400e3).toISOString() });
db.requests.push({ _id: 'req-2', roomId: 'room-1', productId: db.catalogue[0].productId, printTitle: db.catalogue[0].title, collectorName: 'Mr & Mrs Johnson', type: 'question', message: 'Is the framed option the same moulding as the original?', status: 'pending', _createdDate: new Date(Date.now() - 7200e3).toISOString() });
const analytics = { _room: { opens: 3 } };
analytics[db.catalogue[2].productId] = { dwellSec: 412, audioPlays: 3, audioMaxPct: 100, viewInRoom: 2, transcriptOpens: 1 };
analytics[db.catalogue[0].productId] = { dwellSec: 133, audioPlays: 1, audioMaxPct: 50, viewInRoom: 0, transcriptOpens: 0 };
const api = {
  listCatalogue: () => JSON.parse(JSON.stringify(db.catalogue)),
  addStory: (pid) => { const p = db.catalogue.find((x) => x.productId === pid); p.story = p.story || { _id: 'story-' + pid, status: 'draft', transcript: '' }; if (p.story.status === 'removed') p.story.status = 'draft'; return { ...p.story, productId: pid }; },
  saveStory: (id, ch) => { const p = findStory(id); const changed = ch.transcript !== undefined && ch.transcript !== p.story.transcript; Object.assign(p.story, ch); if (changed) { p.story.audioCurrent = false; if (p.story.status === 'approved') p.story.status = 'draft'; } return { ...p.story, productId: p.productId }; },
  setStoryStatus: (id, st) => { const p = findStory(id); p.story.status = st; return { ...p.story, productId: p.productId }; },
  generateStoryAudio: (id) => { throw new Error('Audio generation runs on the live site (ElevenLabs).'); },
  draftStoryWithClaude: () => { throw new Error('Claude drafting runs on the live site.'); },
  getAudioUploadUrl: () => { throw new Error('Uploads run on the live site.'); },
  listRooms: () => db.rooms.map((r) => ({ ...r, url: '/pvr/' + r.slug, printCount: db.items.filter((i) => i.roomId === r._id).length,
    stats: { pending: db.requests.filter((q) => q.roomId === r._id && q.status === 'pending').length, dwellSec: r._id === 'room-1' ? 545 : 0, audioPlays: 4 } })),
  getRoomDetail: (id) => { const r = db.rooms.find((x) => x._id === id); return { room: { ...r, url: '/pvr/' + r.slug },
    items: db.items.filter((i) => i.roomId === id).sort((a, b) => a.sortOrder - b.sortOrder).map((i) => ({ ...i, product: db.catalogue.find((p) => p.productId === i.productId) })),
    requests: db.requests.filter((q) => q.roomId === id), analytics: id === 'room-1' ? analytics : {} }; },
  saveRoom: (input) => { if (input._id) { const r = db.rooms.find((x) => x._id === input._id); Object.assign(r, input); return r; }
    const r = { ...input, _id: uid(), slug: (input.collectorName.split(' ').pop() || 'collector').toLowerCase() + '-' + uid(), status: 'draft', openCount: 0 }; db.rooms.unshift(r); return r; },
  setRoomStatus: (id, st) => { const r = db.rooms.find((x) => x._id === id); r.status = st; return r; },
  setRoomItems: (id, items) => { db.items = db.items.filter((i) => i.roomId !== id).concat(items.map((i, k) => ({ ...i, roomId: id, sortOrder: k }))); return items; },
  listRequests: () => db.requests.map((q) => ({ ...q, roomSlug: (db.rooms.find((r) => r._id === q.roomId) || {}).slug })),
  respondToRequest: (id, action, reply) => { const q = db.requests.find((x) => x._id === id);
    if (action === 'answer' && !reply.trim()) throw new Error('Write a reply first.');
    q.status = { confirm: 'confirmed', decline: 'declined', answer: 'answered' }[action]; q.reply = reply;
    if (action === 'confirm' && q.type === 'hold') q.holdExpiresAt = new Date(Date.now() + 48 * 3600e3).toISOString(); return q; },
};
const el = document.querySelector('pvr-director');
el.rpcHandler = async (method, args) => { await wait(); if (!api[method]) throw new Error('Unknown ' + method); return api[method](...args); };
`;

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Viewing Rooms Console</title>
<style>html, body { margin: 0; background: #f6f4f0; } .demo { font: 13px/1.5 system-ui, sans-serif; background: #1d1b18; color: #f3ece0; padding: 10px 16px; text-align: center; }</style>
</head>
<body>
<div class="demo">Demo of the director console with sample data. Changes are kept in this tab only; audio, uploads and Claude drafting run on the live Wix site.</div>
<pvr-director></pvr-director>
<script>${mock}</script>
<script>${element}</script>
</body>
</html>
`;
writeFileSync(join(root, 'preview/director.html'), html);
console.log(`preview/director.html: ${(html.length / 1024).toFixed(0)} KB`);
