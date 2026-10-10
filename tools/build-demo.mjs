// Builds demo/gallery-demo.html: one offline file that runs the visitor's
// gallery and the Studio console together against an in-browser copy of the
// backend. Reservations, offers and questions made in the gallery appear in
// the console, and replies and counter-offers flow back to the visitor.
// Data is kept in this browser's localStorage; "Reset demo" starts again.
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { starterTours } from './tours.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const stories = JSON.parse(readFileSync(join(root, 'data/stories.json'), 'utf8'));
const galleryEl = readFileSync(join(root, 'wix/public/custom-elements/jv-gallery.js'), 'utf8');
const consoleEl = readFileSync(join(root, 'wix/public/custom-elements/jv-console.js'), 'utf8');

const size = (v) => (Array.isArray(v) ? v.join(' x ') : '');
// Recorded narration: the copy in the site's Media Manager (data/audio.json) so
// the demo plays anywhere online, else a local file from generate-audio.mjs.
// A recording only counts while its script is unchanged.
const audioPath = join(root, 'data/audio.json');
const uploaded = existsSync(audioPath) ? JSON.parse(readFileSync(audioPath, 'utf8')) : {};
const scriptHash = (t) => createHash('sha256').update(String(t)).digest('hex').slice(0, 16);
const recorded = (s) => {
  const a = uploaded[s.slug];
  if (a && a.scriptHash === scriptHash(s.transcript)) return a.url;
  return existsSync(join(root, 'audio', `${s.slug}.mp3`)) ? `../audio/${s.slug}.mp3` : '';
};
const seed = {
  prints: stories.map((s) => ({
    productId: s.id, title: s.title, price: s.price, inStock: s.inStock, ribbon: s.ribbon || '', media: s.media, slug: s.slug,
    hasOptions: s.price < 1000 && !/framed/i.test(s.ribbon || ''),
    story: {
      _id: `story-${s.id}`, status: 'approved', transcript: s.transcript, edition: s.edition || '', medium: s.medium || '',
      signed: !!s.signed, imageSizeCm: size(s.imageSizeCm), mountSizeCm: size(s.mountSizeCm), framedSizeCm: size(s.framedSizeCm),
      reviewNotes: s.reviewNotes || '', estDurationSec: s.estDurationSec, themes: s.themes.join(', '),
      audioUrl: recorded(s),
    },
  })),
  tours: starterTours(stories).map((t, i) => ({ _id: `tour-${i}`, ...t, status: 'live', sortOrder: i })),
};

const backend = String.raw`
const SEED = __SEED__;
const KEY = 'jv-gallery-demo-v2';
const HOLD_HOURS = 48;
const MIN_OFFER_SHARE = 0.7;
const THEMES = ['By the sea', 'After dark', 'Romance', 'Quiet moments', 'Style & society', 'Portraits', 'Final editions', 'Rare editions'];
const PALETTES = [['#5b3a2e', '#1f2a36'], ['#3c2a3e', '#16191f'], ['#2f3d3a', '#1a1714'], ['#6a4a2b', '#24303a']];
let online = false;
const uid = () => Math.random().toString(36).slice(2, 12);
const now = () => new Date();
const iso = (ms) => new Date(Date.now() + ms).toISOString();

function placeholder(title, i) {
  const [a, b] = PALETTES[i % PALETTES.length];
  const t = title.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="1000"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="' + a + '"/><stop offset="1" stop-color="' + b + '"/></linearGradient></defs><rect width="800" height="1000" fill="url(#g)"/><rect x="40" y="40" width="720" height="920" fill="none" stroke="#ffffff" stroke-opacity=".25"/><text x="400" y="490" fill="#ffffff" font-family="Poppins, Arial, sans-serif" font-size="48" text-anchor="middle">' + t + '</text><text x="400" y="545" fill="#e7e2da" font-family="Arial, sans-serif" font-size="18" letter-spacing="5" text-anchor="middle">IMAGE LOADS WHEN ONLINE</text></svg>';
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}

// A few example visitors so the console has something to show. Marked as examples.
function exampleData(db) {
  const by = (slug) => db.prints.find((p) => p.slug === slug).productId;
  const mk = (name, email, phone, status, daysAgo) => ({ _id: uid(), visitorId: 'example' + uid() + uid(), name, email, phone, status, notes: '', firstSeenAt: iso(-daysAgo * 864e5), lastSeenAt: iso(-daysAgo * 3e6) });
  const a = mk('Example: Fiona Grant', 'fiona@example.com', '07700 900123', 'new', 3);
  const b = mk('Example: David Okafor', 'david@example.com', '', 'negotiating', 6);
  const c = mk('Example: Margaret Hall', 'margaret@example.com', '', 'contacted', 12);
  [a, b, c].forEach((l) => { l.visitorIds = [l.visitorId]; db.leads.push(l); });
  const ev = (l, type, slug, value, ago) => db.events.push({ visitorId: l.visitorId, productId: slug ? by(slug) : '', type, value: value || 1, sessionId: 's' + l._id.slice(0, 4), tourSlug: '', _createdDate: iso(-ago) });
  ['narcissistic-bathers', 'young-hearts', 'jack-vettriano-print-an-imperfect-past'].forEach((s, i) => { ev(a, 'print_open', s, 1, 9e6 - i); ev(a, 'print_dwell', s, 240 - i * 60, 9e6 - i); ev(a, 'audio_play', s, 1, 9e6 - i); ev(a, 'audio_progress', s, i ? 50 : 100, 9e6 - i); });
  ev(a, 'view_in_room', 'narcissistic-bathers', 1, 8e6); ev(a, 'view_in_room', 'narcissistic-bathers', 1, 7e6); ev(a, 'shortlist_add', 'narcissistic-bathers', 1, 7e6); ev(a, 'shortlist_add', 'young-hearts', 1, 7e6);
  ['jack-vettriano-print-bird-on-the-wire', 'jack-vettriano-print-yesterdays-dreams'].forEach((s) => { ev(b, 'print_open', s, 1, 4e8); ev(b, 'print_dwell', s, 420, 4e8); ev(b, 'audio_play', s, 1, 4e8); ev(b, 'audio_progress', s, 100, 4e8); });
  ev(c, 'print_open', 'the-very-thought-of-you', 1, 9e8); ev(c, 'print_dwell', 'the-very-thought-of-you', 95, 9e8);
  const req = (l, type, slug, extra) => db.requests.push({ _id: uid(), leadId: l._id, visitorId: l.visitorId, visitorName: l.name, type, productId: by(slug), productIds: [by(slug)],
    printTitle: db.prints.find((p) => p.slug === slug).title, message: '', listPrice: db.prints.find((p) => p.slug === slug).price, status: 'pending', _createdDate: iso(-3e6), ...extra });
  req(a, 'hold', 'narcissistic-bathers', { message: 'We are coming to Edinburgh on Saturday and would love to decide then.' });
  req(b, 'offer', 'jack-vettriano-print-bird-on-the-wire', { offerPrice: 1400, message: 'Collected unframed if that helps.' });
  req(c, 'question', 'the-very-thought-of-you', { message: 'Is the framed version glazed with glass or acrylic?', status: 'answered', reply: 'It is glazed with true colour acrylic, which is lighter and safer to post.', _createdDate: iso(-9e8) });
}

function fresh() {
  const db = { prints: JSON.parse(JSON.stringify(SEED.prints)), tours: JSON.parse(JSON.stringify(SEED.tours)), leads: [], requests: [], events: [] };
  ['the-billy-boys', 'jack-vettriano-portrait-by-ian-mcilgorm', 'the-blue-gown'].forEach((slug) => { db.prints.find((p) => p.slug === slug).story.status = 'draft'; });
  exampleData(db);
  return db;
}
function load() { try { const s = localStorage.getItem(KEY); if (s) return JSON.parse(s); } catch (e) {} return fresh(); }
let db = load();
function save() { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) {} }

const product = (id) => db.prints.find((p) => p.productId === id);
const imageFor = (p) => (online ? 'https://static.wixstatic.com/media/' + p.media : placeholder(p.title, db.prints.indexOf(p)));
const parseSize = (v) => { const m = String(v || '').match(/([\d.]+)\s*[x×]\s*([\d.]+)/); return m ? [Number(m[1]), Number(m[2])] : null; };
const themesOf = (p) => String(p.story.themes || '').split(',').map((t) => t.trim()).filter(Boolean);
const summary = (p) => ({ productId: p.productId, title: p.title, price: p.price, inStock: p.inStock, ribbon: p.ribbon, image: imageFor(p),
  productUrl: 'https://www.jackvettriano.studio/product-page/' + p.slug, hasOptions: p.hasOptions, framedSizeFromStore: null });
const activeHolds = () => db.requests.filter((r) => r.type === 'hold' && r.status === 'confirmed' && new Date(r.holdExpiresAt) > now());
const leadByVisitor = (vid) => db.leads.find((l) => l.visitorIds.includes(vid));
const reqView = (r) => ({ _id: r._id, type: r.type, productId: r.productId || '', productIds: r.productIds || [], printTitle: r.printTitle, message: r.message, offerPrice: r.offerPrice || null,
  counterPrice: r.counterPrice || null, status: r.status, reply: r.reply || '', createdAt: r._createdDate, holdExpiresAt: r.holdExpiresAt || null });
const myRequests = (vid) => { const l = leadByVisitor(vid); return l ? db.requests.filter((r) => r.leadId === l._id).sort((a, b) => b._createdDate.localeCompare(a._createdDate)) : []; };
const me = (vid) => { const l = leadByVisitor(vid); return { name: l ? l.name : '', requests: myRequests(vid).map(reqView) }; };
const hash = (s) => String(s).length + ':' + String(s).slice(0, 40);

const POINTS = { print_open: 1, audio_play: 2, transcript_open: 1, provenance_open: 2, view_in_room: 4, shortlist_add: 5, tour_complete: 3, add_to_basket: 8 };
function score(events, nreq) {
  let s = nreq * 15;
  events.forEach((e) => { if (e.type === 'print_dwell') s += Math.floor((e.value || 0) / 60); else if (e.type === 'audio_progress' && e.value >= 100) s += 4; else if (POINTS[e.type]) s += POINTS[e.type]; });
  return s;
}
function shortlistFrom(events) {
  const st = new Map();
  events.slice().sort((a, b) => a._createdDate.localeCompare(b._createdDate)).forEach((e) => { if (e.type === 'shortlist_add') st.set(e.productId, 1); if (e.type === 'shortlist_remove') st.delete(e.productId); });
  return [...st.keys()].reverse();
}

const api = {
  // ---- visitor ----
  getGallery(vid) {
    const l = leadByVisitor(vid);
    const holds = activeHolds();
    const mine = myRequests(vid);
    const prints = db.prints.filter((p) => p.story && p.story.status === 'approved').map((p) => {
      const hold = holds.find((h) => h.productId === p.productId);
      let availability = p.inStock ? 'available' : 'out_of_stock';
      if (hold) availability = l && hold.leadId === l._id ? 'held_by_you' : 'reserved';
      else if (mine.some((r) => r.productId === p.productId && r.type === 'hold' && r.status === 'pending')) availability = 'hold_pending';
      const st = p.story;
      return { ...summary(p), themes: themesOf(p), availability, holdExpiresAt: hold && l && hold.leadId === l._id ? hold.holdExpiresAt : null,
        story: { transcript: st.transcript, audioUrl: st.audioUrl || '', estDurationSec: st.estDurationSec, edition: st.edition, medium: st.medium, signed: st.signed,
          imageSizeCm: parseSize(st.imageSizeCm), mountSizeCm: parseSize(st.mountSizeCm), framedSizeCm: parseSize(st.framedSizeCm) } };
    }).sort((a, b) => a.title.localeCompare(b.title));
    const onShow = new Set(prints.map((p) => p.productId));
    return { prints, themes: THEMES.filter((t) => prints.some((p) => p.themes.includes(t))),
      tours: db.tours.filter((t) => t.status === 'live').sort((a, b) => a.sortOrder - b.sortOrder).map((t) => ({ slug: t.slug, title: t.title, intro: t.intro, productIds: t.productIds.filter((id) => onShow.has(id)) })).filter((t) => t.productIds.length),
      me: me(vid), minOfferShare: MIN_OFFER_SHARE };
  },
  getPrintOptions(pid) {
    const p = product(pid);
    if (!p.hasOptions) return [];
    return [{ variantId: pid + '-u', label: 'Unframed', price: p.price, inStock: true }, { variantId: pid + '-f', label: 'Framed', price: p.price + 150, inStock: true }];
  },
  getMyActivity: (vid) => me(vid),
  submitRequest(vid, contact, input) {
    if (!contact.name) throw new Error('Please tell us your name.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(contact.email || '')) throw new Error('Please enter a valid email address so the Studio can reply.');
    const ids = input.type === 'shortlist' ? input.productIds : [input.productId];
    const p = product(ids[0]);
    let offerPrice = null;
    if (input.type === 'offer') {
      offerPrice = Math.round(Number(input.offerPrice));
      if (offerPrice >= p.price) throw new Error('That is at or above the listed price; you can buy it directly or request a hold.');
      if (offerPrice < p.price * MIN_OFFER_SHARE) throw new Error('We are unable to consider offers below ' + Math.round(MIN_OFFER_SHARE * 100) + '% of the listed price for this print.');
    }
    if (input.type === 'hold' && activeHolds().some((h) => h.productId === p.productId)) throw new Error('This print is currently reserved for another collector.');
    let l = leadByVisitor(vid) || db.leads.find((x) => x.email === contact.email.toLowerCase());
    if (!l) { l = { _id: uid(), visitorId: vid, visitorIds: [vid], name: contact.name, email: contact.email.toLowerCase(), phone: contact.phone || '', status: 'new', notes: '', firstSeenAt: now().toISOString(), lastSeenAt: now().toISOString() }; db.leads.push(l); }
    else { if (!l.visitorIds.includes(vid)) l.visitorIds.push(vid); l.name = contact.name || l.name; l.phone = contact.phone || l.phone; l.lastSeenAt = now().toISOString(); }
    if ((input.type === 'hold' || input.type === 'offer') && db.requests.some((r) => r.leadId === l._id && r.type === input.type && r.productId === p.productId && ['pending', 'countered'].includes(r.status))) throw new Error('This request is already with the Studio.');
    db.requests.push({ _id: uid(), leadId: l._id, visitorId: vid, visitorName: l.name, type: input.type, productId: input.type === 'shortlist' ? '' : p.productId, productIds: ids,
      printTitle: input.type === 'shortlist' ? 'Shortlist of ' + ids.length + ' print' + (ids.length === 1 ? '' : 's') : p.title, message: String(input.message || '').slice(0, 2000),
      offerPrice, listPrice: input.type === 'shortlist' ? null : p.price, status: 'pending', _createdDate: now().toISOString() });
    save();
    return me(vid);
  },
  answerCounterOffer(vid, id, accept) {
    const l = leadByVisitor(vid); const r = db.requests.find((x) => x._id === id);
    if (!l || !r || r.leadId !== l._id || r.status !== 'countered') throw new Error('This offer is no longer open.');
    r.status = accept ? 'accepted' : 'declined_by_visitor'; save(); return me(vid);
  },
  logEvents(vid, events) {
    events.forEach((e) => db.events.push({ visitorId: vid, productId: e.productId || '', tourSlug: e.tourSlug || '', type: e.type, value: Number(e.value) || 0, sessionId: e.sessionId, _createdDate: now().toISOString() }));
    const l = leadByVisitor(vid); if (l) l.lastSeenAt = now().toISOString();
    save(); return { logged: events.length };
  },
  addToBasket() { return { added: true }; },
  // ---- studio ----
  listCatalogue: () => db.prints.map((p) => ({ ...summary(p), story: p.story ? { ...p.story, audioCurrent: !!p.story.audioUrl } : null })),
  importStarterContent: () => ({ stories: 0, tours: 0 }),
  addStory(pid) { const p = product(pid); p.story = p.story || { _id: 'story-' + pid, status: 'draft', transcript: '', themes: '' }; if (p.story.status === 'removed') p.story.status = 'draft'; save(); return { ...p.story, productId: pid }; },
  saveStory(id, ch) {
    const p = db.prints.find((x) => x.story && x.story._id === id);
    const changed = 'transcript' in ch && ch.transcript !== p.story.transcript;
    Object.assign(p.story, ch);
    if (changed) { p.story.estDurationSec = Math.round(p.story.transcript.split(/\s+/).length / 150 * 60); if (p.story.status === 'approved') p.story.status = 'draft'; }
    save(); return { ...p.story, productId: p.productId };
  },
  setStoryStatus(id, st) { const p = db.prints.find((x) => x.story && x.story._id === id); if (st === 'approved' && !p.story.transcript.trim()) throw new Error('Write the script before approving it.'); p.story.status = st; save(); return { ...p.story, productId: p.productId }; },
  generateStoryAudio() { throw new Error('In this demo every story is already recorded. On the live site this button re-records a story after its script is edited.'); },
  draftStoryWithClaude() { throw new Error('Claude drafting runs on the live site.'); },
  listTours: () => db.tours.slice().sort((a, b) => a.sortOrder - b.sortOrder).map((t) => ({ ...t, productIds: [...t.productIds] })),
  saveTour(input) {
    if (!String(input.title || '').trim()) throw new Error('Give the tour a title.');
    if (input.productIds.length > 10) throw new Error('A tour can include up to 10 prints.');
    if (input._id) { const t = db.tours.find((x) => x._id === input._id); Object.assign(t, { title: input.title, intro: input.intro, productIds: input.productIds }); save(); return t; }
    const t = { _id: uid(), slug: input.title.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + uid().slice(0, 4), title: input.title, intro: input.intro, productIds: input.productIds, status: 'draft', sortOrder: db.tours.length };
    db.tours.push(t); save(); return t;
  },
  setTourStatus(id, st) { const t = db.tours.find((x) => x._id === id); if (st === 'live' && !t.productIds.length) throw new Error('Add prints before publishing the tour.'); t.status = st; save(); return t; },
  deleteTour(id) { db.tours = db.tours.filter((t) => t._id !== id); save(); return { removed: true }; },
  listLeads() {
    return db.leads.map((l) => {
      const ev = db.events.filter((e) => l.visitorIds.includes(e.visitorId));
      const rq = db.requests.filter((r) => r.leadId === l._id);
      return { _id: l._id, name: l.name, email: l.email, phone: l.phone, status: l.status, notes: l.notes, firstSeenAt: l.firstSeenAt, lastSeenAt: l.lastSeenAt,
        score: score(ev, rq.length), pending: rq.filter((r) => r.status === 'pending' || r.status === 'accepted').length, requests: rq.length,
        shortlist: shortlistFrom(ev).length, storiesPlayed: new Set(ev.filter((e) => e.type === 'audio_play').map((e) => e.productId)).size };
    }).sort((a, b) => b.score - a.score);
  },
  getLeadDetail(id) {
    const l = db.leads.find((x) => x._id === id);
    const ev = db.events.filter((e) => l.visitorIds.includes(e.visitorId));
    const rq = db.requests.filter((r) => r.leadId === id).sort((a, b) => b._createdDate.localeCompare(a._createdDate));
    const per = {};
    ev.forEach((e) => { if (!e.productId) return; const s = per[e.productId] = per[e.productId] || { opens: 0, dwellSec: 0, audioPlays: 0, audioMaxPct: 0, viewInRoom: 0, transcriptOpens: 0, basket: 0 };
      if (e.type === 'print_open') s.opens++; if (e.type === 'print_dwell') s.dwellSec += e.value; if (e.type === 'audio_play') s.audioPlays++; if (e.type === 'audio_progress') s.audioMaxPct = Math.max(s.audioMaxPct, e.value);
      if (e.type === 'view_in_room') s.viewInRoom++; if (e.type === 'transcript_open') s.transcriptOpens++; if (e.type === 'add_to_basket') s.basket++; });
    const title = (pid) => (product(pid) || { title: 'Removed print' }).title;
    return { lead: l, score: score(ev, rq.length), visits: new Set(ev.map((e) => e.sessionId)).size,
      shortlist: shortlistFrom(ev).map((pid) => ({ productId: pid, title: title(pid), price: (product(pid) || {}).price })),
      prints: Object.entries(per).map(([pid, s]) => ({ productId: pid, title: title(pid), ...s })).sort((a, b) => b.dwellSec - a.dwellSec),
      tours: [...new Set(ev.filter((e) => e.type === 'tour_start').map((e) => e.tourSlug))], requests: rq };
  },
  updateLead(id, ch) { const l = db.leads.find((x) => x._id === id); Object.assign(l, ch); save(); return l; },
  listRequests: () => db.requests.slice().sort((a, b) => b._createdDate.localeCompare(a._createdDate)).map((r) => { const l = db.leads.find((x) => x._id === r.leadId) || {}; return { ...r, leadName: l.name, leadEmail: l.email, leadPhone: l.phone }; }),
  respondToRequest(id, action, reply, counterPrice) {
    const r = db.requests.find((x) => x._id === id);
    const l = db.leads.find((x) => x._id === r.leadId);
    r.reply = String(reply || ''); r.respondedAt = now().toISOString();
    if (action === 'confirm' && r.type === 'hold') {
      if (activeHolds().some((h) => h.productId === r.productId && h._id !== r._id)) throw new Error('This print is already held for someone else.');
      r.status = 'confirmed'; r.holdExpiresAt = iso(HOLD_HOURS * 3600e3);
    } else if (action === 'confirm') r.status = 'confirmed';
    else if (action === 'counter') {
      const price = Math.round(Number(counterPrice));
      if (!(price > (r.offerPrice || 0))) throw new Error('A counter-offer should be above the visitor’s offer.');
      if (price >= r.listPrice) throw new Error('A counter-offer should be below the listed price.');
      r.status = 'countered'; r.counterPrice = price;
    } else if (action === 'decline') r.status = 'declined';
    else if (action === 'answer') { if (!r.reply.trim()) throw new Error('Write a reply first.'); r.status = 'answered'; }
    if (l && l.status === 'new') l.status = r.status === 'countered' ? 'negotiating' : 'contacted';
    save(); return r;
  },
  getInsights(days) {
    const since = Date.now() - days * 864e5;
    const ev = db.events.filter((e) => new Date(e._createdDate) > since);
    const rq = db.requests.filter((r) => new Date(r._createdDate) > since);
    const per = {}; const tours = {};
    const bump = (pid, k, v) => { if (!pid) return; const s = per[pid] = per[pid] || { opens: 0, dwellSec: 0, audioPlays: 0, audioCompletes: 0, viewInRoom: 0, shortlists: 0, basket: 0, requests: 0 }; s[k] += v || 1; };
    ev.forEach((e) => { if (e.type === 'print_open') bump(e.productId, 'opens'); if (e.type === 'print_dwell') bump(e.productId, 'dwellSec', e.value); if (e.type === 'audio_play') bump(e.productId, 'audioPlays');
      if (e.type === 'audio_progress' && e.value >= 100) bump(e.productId, 'audioCompletes'); if (e.type === 'view_in_room') bump(e.productId, 'viewInRoom'); if (e.type === 'shortlist_add') bump(e.productId, 'shortlists');
      if (e.type === 'add_to_basket') bump(e.productId, 'basket');
      if (e.type === 'tour_start' || e.type === 'tour_complete') { const t = tours[e.tourSlug] = tours[e.tourSlug] || { starts: 0, completes: 0 }; t[e.type === 'tour_start' ? 'starts' : 'completes']++; } });
    rq.forEach((r) => (r.productIds || []).forEach((pid) => bump(pid, 'requests')));
    const visitors = new Set(ev.map((e) => e.visitorId));
    const leads = db.leads.filter((l) => new Date(l.firstSeenAt) > since);
    return { days, visitors: visitors.size, sessions: new Set(ev.map((e) => e.sessionId)).size, storiesPlayed: ev.filter((e) => e.type === 'audio_play').length,
      basketAdds: ev.filter((e) => e.type === 'add_to_basket').length, newLeads: leads.length, requests: rq.length, leadRate: visitors.size ? leads.length / visitors.size : 0,
      prints: Object.entries(per).map(([pid, s]) => ({ productId: pid, title: (product(pid) || { title: 'Removed print' }).title, ...s })).sort((a, b) => (b.dwellSec + b.requests * 600) - (a.dwellSec + a.requests * 600)),
      tours: db.tours.map((t) => ({ slug: t.slug, title: t.title, ...(tours[t.slug] || { starts: 0, completes: 0 }) })) };
  },
};

const handler = async (method, args) => {
  await new Promise((r) => setTimeout(r, 150));
  if (!api[method]) throw new Error('Unknown action ' + method);
  return JSON.parse(JSON.stringify(api[method](...args)));
};

// ---------- shell ----------
const $ = (s) => document.querySelector(s);
function mount(view) {
  const host = $('#host');
  host.innerHTML = '';
  document.body.dataset.view = view;
  document.querySelectorAll('.bar [data-view]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.view === view)));
  const el = document.createElement(view === 'studio' ? 'jv-console' : 'jv-gallery');
  el.rpcHandler = handler;
  if (view === 'gallery') { el.setAttribute('analytics', 'on'); el.setAttribute('speech-fallback', ''); el.setAttribute('share-url', 'https://www.jackvettriano.studio/gallery'); }
  host.appendChild(el);
  window.scrollTo(0, 0);
}
function start() {
  document.querySelectorAll('.bar [data-view]').forEach((b) => b.addEventListener('click', () => mount(b.dataset.view)));
  $('#newVisitor').addEventListener('click', () => {
    try { ['jvg-visitor', 'jvg-shortlist', 'jvg-contact'].forEach((k) => localStorage.removeItem(k)); } catch (e) {}
    mount('gallery');
  });
  $('#reset').addEventListener('click', () => {
    db = fresh(); save();
    try { ['jvg-visitor', 'jvg-shortlist', 'jvg-contact'].forEach((k) => localStorage.removeItem(k)); } catch (e) {}
    mount('gallery');
  });
  mount('gallery');
}
let started = false;
const go = (ok) => { if (started) return; started = true; online = ok; start(); };
const probe = new Image();
probe.onload = () => go(true);
probe.onerror = () => go(false);
setTimeout(() => go(false), 2500);
probe.src = 'https://static.wixstatic.com/media/' + SEED.prints[0].media + '/v1/fit/w_20,h_20/file.jpg';
`.replace('__SEED__', JSON.stringify(seed));

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Gallery Demo</title>
<style>
  html, body { margin: 0; background: #fff; }
  body[data-view="studio"] { background: #f6f5f3; }
  .bar { background: #262626; color: #fff; font: 13px/1.4 system-ui, -apple-system, sans-serif; display: flex; flex-wrap: wrap; gap: 10px 14px; align-items: center; padding: 10px 16px; border-bottom: 2px solid #b3140f; }
  .bar strong { font-size: 14px; margin-right: 4px; }
  .bar button { font: inherit; border-radius: 0; padding: 6px 12px; border: 1px solid rgba(255,255,255,.35); background: transparent; color: #fff; cursor: pointer; }
  .bar button[aria-pressed="true"] { background: #b3140f; border-color: #b3140f; color: #fff; font-weight: 600; }
  .bar button:focus-visible { outline: 2px solid #fff; outline-offset: 2px; }
  .bar .spacer { flex: 1; }
  .bar .hint { color: #d6d6d6; flex-basis: 100%; }
</style>
</head>
<body data-view="gallery">
<div class="bar">
  <strong>Interactive Gallery · offline demo</strong>
  <button data-view="gallery" aria-pressed="true">Visitor's gallery</button>
  <button data-view="studio" aria-pressed="false">Studio console</button>
  <span class="spacer"></span>
  <button id="newVisitor" title="Browse as a different visitor, with an empty shortlist">Be a new visitor</button>
  <button id="reset" title="Clear everything you have changed and start again">Reset demo</button>
  <span class="hint">Runs in this one file; nothing you do here reaches the live site. Reserve a print, make an offer or ask a question in the gallery, then answer it in the Studio console. Stories are narrated by George (ElevenLabs), print images and narration load from the Studio's Wix site, and "Add to basket" is simulated. People marked "Example" are sample data.</span>
</div>
<div id="host"></div>
<script>(() => {
${galleryEl}
})();</script>
<script>(() => {
${consoleEl}
})();</script>
<script>${backend}</script>
</body>
</html>
`;
mkdirSync(join(root, 'demo'), { recursive: true });
writeFileSync(join(root, 'demo/gallery-demo.html'), html);
console.log(`demo/gallery-demo.html: ${(html.length / 1024).toFixed(0)} KB, ${seed.prints.length} prints, ${seed.tours.length} tours`);
