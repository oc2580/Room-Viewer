// Builds demo/pvr-demo.html: one offline file that runs the director console
// and the collector's room together against an in-browser copy of the backend.
// Requests made in the room appear in the console and replies flow back.
// Data is kept in this browser's localStorage; "Reset demo" starts again.
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const stories = JSON.parse(readFileSync(join(root, 'data/stories.json'), 'utf8'));
const roomEl = readFileSync(join(root, 'wix/public/custom-elements/pvr-room.js'), 'utf8');
const directorEl = readFileSync(join(root, 'wix/public/custom-elements/pvr-director.js'), 'utf8');

const seed = stories.map((s) => ({
  productId: s.id, title: s.title, price: s.price, inStock: s.inStock, ribbon: s.ribbon || '',
  media: s.media, slug: s.slug,
  story: {
    status: 'draft', transcript: s.transcript, edition: s.edition || '', medium: s.medium || '',
    signed: !!s.signed, imageSizeCm: (s.imageSizeCm || []).join(' x '), mountSizeCm: (s.mountSizeCm || []).join(' x '),
    framedSizeCm: (s.framedSizeCm || []).join(' x '), reviewNotes: s.reviewNotes || '', estDurationSec: s.estDurationSec,
  },
}));

const backend = String.raw`
const SEED = __SEED__;
const KEY = 'pvr-demo-v1';
const HOLD_HOURS = 48;
const PALETTES = [['#5b3a2e', '#1f2a36'], ['#3c2a3e', '#16191f'], ['#2f3d3a', '#1a1714'], ['#6a4a2b', '#24303a']];
let online = false;

function placeholder(title, i) {
  const [a, b] = PALETTES[i % PALETTES.length];
  const t = title.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="1000"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="' + a + '"/><stop offset="1" stop-color="' + b + '"/></linearGradient></defs><rect width="800" height="1000" fill="url(#g)"/><rect x="40" y="40" width="720" height="920" fill="none" stroke="#c89d5c" stroke-opacity=".35"/><text x="400" y="490" fill="#f3ece0" font-family="Georgia, serif" font-style="italic" font-size="50" text-anchor="middle">' + t + '</text><text x="400" y="545" fill="#c89d5c" font-family="Arial, sans-serif" font-size="18" letter-spacing="5" text-anchor="middle">IMAGE LOADS WHEN ONLINE</text></svg>';
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}
const imageFor = (p, i) => (online ? 'https://static.wixstatic.com/media/' + p.media : placeholder(p.title, i));

function fresh() {
  const db = { catalogue: JSON.parse(JSON.stringify(SEED)), rooms: [], items: [], requests: [], events: [] };
  db.catalogue.forEach((p, i) => { p.story._id = 'story-' + p.productId; if (i % 3 !== 2) p.story.status = 'approved'; });
  const pick = ['narcissistic-bathers', 'jack-vettriano-print-an-imperfect-past', 'jack-vettriano-print-yesterdays-dreams', 'young-hearts'];
  pick.forEach((slug) => { db.catalogue.find((p) => p.slug === slug).story.status = 'approved'; });
  const room = { _id: 'room-johnson', slug: 'johnson-k3f9q2m7x1', collectorName: 'Mr & Mrs Johnson', collectorEmail: 'johnson@example.com',
    greeting: 'It was a pleasure to meet you both at the Studio. As promised, here are the pieces we talked about, along with a couple I think you will love. Press play on any of them to hear the story behind the print, and take your time: this room is yours for the next fortnight.',
    greetingAudioUrl: '', status: 'live', expiresAt: new Date(Date.now() + 14 * 864e5).toISOString(), openCount: 0, _createdDate: new Date().toISOString() };
  db.rooms.push(room);
  pick.forEach((slug, i) => db.items.push({ roomId: room._id, productId: db.catalogue.find((p) => p.slug === slug).productId, sortOrder: i,
    curatorNote: i === 0 ? 'You mentioned you wanted something from his final signed releases. This is the one I would choose: there will never be more of these.'
      : i === 1 ? 'Silkscreens of this image almost never come up. I held this one back for you before it goes on the website.' : '',
    offerPrice: i === 1 ? 1595 : null, offerExpiresAt: i === 1 ? new Date(Date.now() + 5 * 864e5).toISOString() : null }));
  return db;
}
function load() { try { const s = localStorage.getItem(KEY); if (s) return JSON.parse(s); } catch (e) {} return fresh(); }
let db = load();
function save() { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) {} }
const uid = () => Math.random().toString(36).slice(2, 12);
const now = () => new Date();
const product = (id) => db.catalogue.find((p) => p.productId === id);
const parseSize = (v) => { const m = String(v || '').match(/([\d.]+)\s*[x×]\s*([\d.]+)/); return m ? [Number(m[1]), Number(m[2])] : null; };
const summary = (p) => ({ productId: p.productId, title: p.title, price: p.price, inStock: p.inStock, ribbon: p.ribbon,
  image: imageFor(p, db.catalogue.indexOf(p)), productUrl: 'https://www.jackvettriano.studio/product-page/' + p.slug, framedSizeFromStore: null });
const activeHold = (pid) => db.requests.find((r) => r.productId === pid && r.type === 'hold' && r.status === 'confirmed' && new Date(r.holdExpiresAt) > now());
const roomOpen = (r) => r && r.status === 'live' && new Date(r.expiresAt) > now();

function roomPayload(room) {
  const items = db.items.filter((i) => i.roomId === room._id).sort((a, b) => a.sortOrder - b.sortOrder);
  return {
    room: { slug: room.slug, collectorName: room.collectorName, greeting: room.greeting || '', greetingAudioUrl: room.greetingAudioUrl || '', expiresAt: room.expiresAt, holdHours: HOLD_HOURS },
    prints: items.map((i) => {
      const p = product(i.productId);
      const mine = db.requests.filter((r) => r.roomId === room._id && r.productId === i.productId).sort((a, b) => b._createdDate.localeCompare(a._createdDate));
      const hold = activeHold(i.productId);
      const offerOpen = i.offerPrice > 0 && (!i.offerExpiresAt || new Date(i.offerExpiresAt) > now());
      let availability = p.inStock ? 'available' : 'out_of_stock';
      if (hold) availability = hold.roomId === room._id ? 'held_by_you' : 'reserved';
      else if (mine.some((r) => r.type === 'hold' && r.status === 'pending')) availability = 'hold_pending';
      const st = p.story;
      return { ...summary(p), curatorNote: i.curatorNote || '', offer: offerOpen ? { price: i.offerPrice, expiresAt: i.offerExpiresAt } : null,
        availability, holdExpiresAt: hold && hold.roomId === room._id ? hold.holdExpiresAt : null,
        story: st && st.status === 'approved' ? { transcript: st.transcript, audioUrl: '', estDurationSec: st.estDurationSec, edition: st.edition, medium: st.medium,
          signed: st.signed, imageSizeCm: parseSize(st.imageSizeCm), mountSizeCm: parseSize(st.mountSizeCm), framedSizeCm: parseSize(st.framedSizeCm) } : null,
        requests: mine.map((r) => ({ type: r.type, message: r.message, status: r.status, reply: r.reply || '', createdAt: r._createdDate, holdExpiresAt: r.holdExpiresAt || null })) };
    }),
  };
}

const api = {
  // collector
  getRoom: (slug) => roomPayload(db.rooms.find((r) => r.slug === slug)),
  submitRequest: (slug, input) => {
    const room = db.rooms.find((r) => r.slug === slug);
    if (!roomOpen(room)) throw new Error('This viewing room is no longer open.');
    const item = db.items.find((i) => i.roomId === room._id && i.productId === input.productId);
    if (input.type !== 'question' && db.requests.some((r) => r.roomId === room._id && r.productId === input.productId && r.type === input.type && ['pending', 'confirmed'].includes(r.status))) throw new Error('This request is already with the Studio.');
    db.requests.push({ _id: uid(), roomId: room._id, productId: input.productId, printTitle: product(input.productId).title, collectorName: room.collectorName,
      type: input.type, message: String(input.message || '').slice(0, 2000), offerPrice: input.type === 'offer' ? item.offerPrice : null, status: 'pending', _createdDate: now().toISOString() });
    save();
    return roomPayload(room);
  },
  logEvents: (slug, events) => { const room = db.rooms.find((r) => r.slug === slug); if (!room) return { logged: 0 };
    events.forEach((e) => db.events.push({ roomId: room._id, productId: e.productId || '', type: e.type, value: Number(e.value) || 0 })); save(); return { logged: events.length }; },
  // director
  listCatalogue: () => db.catalogue.map((p) => ({ ...summary(p), story: p.story ? { ...p.story, audioUrl: '', audioCurrent: false } : null })),
  importStarterStories: () => ({ imported: 0, skipped: db.catalogue.length }),
  addStory: (pid) => { const p = product(pid); p.story = p.story || { _id: 'story-' + pid, status: 'draft', transcript: '' }; if (p.story.status === 'removed') p.story.status = 'draft'; save(); return p.story; },
  saveStory: (id, ch) => { const p = db.catalogue.find((x) => x.story && x.story._id === id); const changed = 'transcript' in ch && ch.transcript !== p.story.transcript;
    Object.assign(p.story, ch); if (changed) { p.story.estDurationSec = Math.round(p.story.transcript.split(/\s+/).length / 150 * 60); if (p.story.status === 'approved') p.story.status = 'draft'; } save(); return p.story; },
  setStoryStatus: (id, st) => { const p = db.catalogue.find((x) => x.story && x.story._id === id);
    if (st === 'approved' && !p.story.transcript.trim()) throw new Error('Write the script before approving it.'); p.story.status = st; save(); return p.story; },
  generateStoryAudio: () => { throw new Error('In this offline demo the room reads stories with your computer\'s voice. Recorded ElevenLabs audio is generated on the live site.'); },
  draftStoryWithClaude: () => { throw new Error('Claude drafting runs on the live site.'); },
  getAudioUploadUrl: () => { throw new Error('Voice notes are uploaded on the live site.'); },
  listRooms: () => db.rooms.slice().sort((a, b) => b._createdDate.localeCompare(a._createdDate)).map((r) => {
    const ev = db.events.filter((e) => e.roomId === r._id);
    return { ...r, url: '/pvr/' + r.slug, printCount: db.items.filter((i) => i.roomId === r._id).length,
      stats: { pending: db.requests.filter((q) => q.roomId === r._id && q.status === 'pending').length,
        dwellSec: ev.filter((e) => e.type === 'print_dwell').reduce((t, e) => t + e.value, 0), audioPlays: ev.filter((e) => e.type === 'audio_play').length } };
  }),
  getRoomDetail: (id) => {
    const r = db.rooms.find((x) => x._id === id);
    const a = {};
    db.events.filter((e) => e.roomId === id).forEach((e) => { const k = e.productId || '_room'; const s = a[k] = a[k] || { dwellSec: 0, audioPlays: 0, audioMaxPct: 0, viewInRoom: 0, transcriptOpens: 0, opens: 0 };
      if (e.type === 'print_dwell') s.dwellSec += e.value; if (e.type === 'audio_play') s.audioPlays += 1; if (e.type === 'audio_progress') s.audioMaxPct = Math.max(s.audioMaxPct, e.value);
      if (e.type === 'view_in_room') s.viewInRoom += 1; if (e.type === 'transcript_open') s.transcriptOpens += 1; if (e.type === 'room_open') s.opens += 1; });
    return { room: { ...r, url: '/pvr/' + r.slug }, items: db.items.filter((i) => i.roomId === id).sort((x, y) => x.sortOrder - y.sortOrder).map((i) => ({ ...i, product: summary(product(i.productId)) })),
      requests: db.requests.filter((q) => q.roomId === id).sort((x, y) => y._createdDate.localeCompare(x._createdDate)), analytics: a };
  },
  saveRoom: (input) => {
    if (!String(input.collectorName || '').trim()) throw new Error('Collector name is required.');
    const fields = { collectorName: input.collectorName, collectorEmail: input.collectorEmail || '', greeting: input.greeting || '', greetingAudioUrl: input.greetingAudioUrl || '',
      expiresAt: new Date(input.expiresAt || Date.now() + 14 * 864e5).toISOString() };
    if (input._id) { const r = db.rooms.find((x) => x._id === input._id); Object.assign(r, fields); save(); return r; }
    const last = (input.collectorName.toLowerCase().match(/[a-z0-9]+/g) || ['collector']).pop();
    const r = { ...fields, _id: uid(), slug: last + '-' + uid().slice(0, 10), status: 'draft', openCount: 0, _createdDate: now().toISOString() };
    db.rooms.push(r); save(); return r;
  },
  setRoomStatus: (id, st) => { const r = db.rooms.find((x) => x._id === id); r.status = st; save(); return r; },
  setRoomItems: (id, items) => {
    if (items.length > 8) throw new Error('A room can hold up to 8 prints.');
    db.items = db.items.filter((i) => i.roomId !== id).concat(items.map((i, k) => ({ roomId: id, productId: i.productId, sortOrder: k, curatorNote: i.curatorNote || '',
      offerPrice: Number(i.offerPrice) > 0 ? Number(i.offerPrice) : null, offerExpiresAt: i.offerExpiresAt || null })));
    save(); return items;
  },
  listRequests: () => db.requests.slice().sort((a, b) => b._createdDate.localeCompare(a._createdDate)).map((q) => ({ ...q, roomSlug: (db.rooms.find((r) => r._id === q.roomId) || {}).slug })),
  respondToRequest: (id, action, reply) => {
    const q = db.requests.find((x) => x._id === id);
    if (action === 'answer' && !String(reply).trim()) throw new Error('Write a reply first.');
    if (action === 'confirm' && q.type === 'hold') {
      const clash = activeHold(q.productId);
      if (clash && clash._id !== q._id) throw new Error('This print is already held for another collector.');
      q.holdExpiresAt = new Date(Date.now() + HOLD_HOURS * 3600e3).toISOString();
    }
    q.status = { confirm: 'confirmed', decline: 'declined', answer: 'answered' }[action]; q.reply = reply || ''; q.respondedAt = now().toISOString();
    save(); return q;
  },
};

const handler = async (method, args) => {
  await new Promise((r) => setTimeout(r, 200));
  if (!api[method]) throw new Error('Unknown action ' + method);
  return JSON.parse(JSON.stringify(api[method](...args)));
};

// ---------- shell ----------
const $ = (s) => document.querySelector(s);
function show(view) {
  $('#directorView').hidden = view !== 'director';
  $('#roomView').hidden = view !== 'room';
  document.querySelectorAll('[data-view]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.view === view)));
  if (view === 'room') openRoom();
  else { const d = $('pvr-director'); d.state.room = null; d.refreshAll(); }
  window.scrollTo(0, 0);
}
function fillRoomPicker() {
  const sel = $('#roomPick');
  const cur = sel.value;
  sel.innerHTML = db.rooms.map((r) => '<option value="' + r.slug + '">' + r.collectorName.replace(/</g, '&lt;') + ' (' + r.status + ')</option>').join('');
  if (cur && db.rooms.some((r) => r.slug === cur)) sel.value = cur;
}
function openRoom() {
  fillRoomPicker();
  const slug = $('#roomPick').value;
  const room = db.rooms.find((r) => r.slug === slug);
  const host = $('#roomHost');
  host.innerHTML = '';
  const el = document.createElement('pvr-room');
  el.setAttribute('speech-fallback', '');
  el.rpcHandler = handler;
  host.appendChild(el);
  $('#roomNote').textContent = room.status === 'live' ? '' : 'This room is in ' + room.status + ', so on the live site only you could open it. Shown here as the director preview.';
  room.openCount = (room.openCount || 0) + 1; room.lastOpenedAt = now().toISOString(); room.firstOpenedAt = room.firstOpenedAt || room.lastOpenedAt; save();
  const payload = roomPayload(room);
  if (!roomOpen(room) && room.status === 'closed') el.setAttribute('room', JSON.stringify({ closed: true, collectorName: room.collectorName }));
  else el.setAttribute('room', JSON.stringify(payload));
}

const probe = new Image();
const start = () => {
  const d = document.createElement('pvr-director');
  d.rpcHandler = handler;
  d.setAttribute('site-url', 'https://www.jackvettriano.studio');
  $('#directorHost').appendChild(d);
  document.querySelectorAll('[data-view]').forEach((b) => b.addEventListener('click', () => show(b.dataset.view)));
  $('#roomPick').addEventListener('change', openRoom);
  $('#reset').addEventListener('click', () => { db = fresh(); save(); show('director'); });
  show('room');
};
let started = false;
const go = (ok) => { if (started) return; started = true; online = ok; start(); };
probe.onload = () => go(true);
probe.onerror = () => go(false);
setTimeout(() => go(false), 2500);
probe.src = 'https://static.wixstatic.com/media/' + SEED[0].media + '/v1/fit/w_20,h_20/file.jpg';
`.replace('__SEED__', JSON.stringify(seed));

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Viewing Room Demo</title>
<style>
  :root { --bar: #1d1b18; --bar-fg: #f3ece0; --gold: #c89d5c; --line: rgba(243,236,224,.18); color-scheme: light; }
  html, body { margin: 0; background: #f6f4f0; }
  .bar { position: relative; z-index: 20; background: var(--bar); color: var(--bar-fg); font: 13px/1.4 system-ui, -apple-system, sans-serif;
    display: flex; flex-wrap: wrap; gap: 10px 16px; align-items: center; padding: 10px 16px; border-bottom: 1px solid var(--line); }
  .bar strong { font-size: 14px; margin-right: 6px; }
  .bar button, .bar select { font: inherit; border-radius: 999px; padding: 6px 12px; border: 1px solid var(--line); background: transparent; color: var(--bar-fg); cursor: pointer; }
  .bar select { border-radius: 8px; max-width: 220px; }
  .bar select option { color: #1d1b18; }
  .bar button[aria-pressed="true"] { background: var(--gold); border-color: var(--gold); color: #1a140c; font-weight: 600; }
  .bar button:focus-visible, .bar select:focus-visible { outline: 2px solid var(--gold); outline-offset: 2px; }
  .bar .spacer { flex: 1; }
  .bar .hint { color: #b8ad9b; flex-basis: 100%; }
  #roomView { background: #15120f; min-height: 100vh; }
  #roomNote { color: #e0bb80; font: 13px system-ui, sans-serif; padding: 0 16px; }
  #roomNote:empty { display: none; }
  [hidden] { display: none !important; }
</style>
</head>
<body>
<div class="bar">
  <strong>Private Viewing Rooms · offline demo</strong>
  <button data-view="director" aria-pressed="false">Director console</button>
  <button data-view="room" aria-pressed="true">Collector's room</button>
  <label for="roomPick" style="color:#b8ad9b">Room</label><select id="roomPick"></select>
  <span class="spacer"></span>
  <button id="reset" title="Clear everything you have changed and start again">Reset demo</button>
  <span class="hint">Everything runs in this file. Make a request in the collector's room, then answer it in the director console. Stories are read by your computer's voice; recorded narration, emails and payments run on the live site.</span>
</div>
<div id="directorView" hidden><div id="directorHost"></div></div>
<div id="roomView"><p id="roomNote"></p><div id="roomHost"></div></div>
<script>(() => {
${roomEl}
})();</script>
<script>(() => {
${directorEl}
})();</script>
<script>${backend}</script>
</body>
</html>
`;
writeFileSync(join(root, 'demo/pvr-demo.html'), html);
console.log(`demo/pvr-demo.html: ${(html.length / 1024).toFixed(0)} KB, ${seed.length} prints`);
