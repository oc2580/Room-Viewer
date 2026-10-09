// Director-facing web methods. Admin only: called from the PVR dashboard page.
import { Permissions, webMethod } from 'wix-web-module';
import wixData from 'wix-data';
import { files } from '@wix/media';
import { auth } from '@wix/essentials';
import {
  COLLECTIONS, DEFAULT_ROOM_DAYS, MAX_ROOM_ITEMS, ROOM_URL_PREFIX,
} from 'backend/pvr.config';
import {
  cleanText, getPricedPrints, getProducts, hash, holdExpiry, makeRoomSlug,
  productSummary, queryAll, now,
} from 'backend/pvr-lib';
import { updateCollector } from 'backend/pvr-notify';
import { synthesiseStory } from 'backend/pvr-audio';
import { STARTER_STORIES } from 'backend/pvr-seed';

const AUTH = { suppressAuth: true };
const ROOM_STATUSES = ['draft', 'live', 'closed'];
const STORY_STATUSES = ['draft', 'approved', 'removed'];
const STORY_FIELDS = [
  'title', 'transcript', 'edition', 'medium', 'signed', 'imageSizeCm',
  'mountSizeCm', 'framedSizeCm', 'reviewNotes',
];

function wordStats(transcript) {
  const words = String(transcript || '').trim().split(/\s+/).filter(Boolean).length;
  return { wordCount: words, estDurationSec: Math.round((words / 150) * 60) };
}

// ---------- Catalogue & story library ----------

// Every priced print in the store, joined with its story (if any).
export const listCatalogue = webMethod(Permissions.Admin, async () => {
  const [products, stories] = await Promise.all([
    getPricedPrints(),
    queryAll(wixData.query(COLLECTIONS.stories)),
  ]);
  const byProduct = new Map(stories.map((s) => [s.productId, s]));
  return products.map((p) => {
    const s = byProduct.get(p._id);
    return {
      ...productSummary(p),
      story: s ? {
        _id: s._id,
        status: s.status,
        transcript: s.transcript,
        edition: s.edition || '',
        medium: s.medium || '',
        signed: !!s.signed,
        imageSizeCm: s.imageSizeCm || '',
        mountSizeCm: s.mountSizeCm || '',
        framedSizeCm: s.framedSizeCm || '',
        reviewNotes: s.reviewNotes || '',
        estDurationSec: s.estDurationSec || 0,
        audioUrl: s.audioUrl || '',
        audioCurrent: !!s.audioUrl && s.audioScriptHash === hash(s.transcript),
      } : null,
    };
  });
});

// One-off import of the curator scripts written for the launch catalogue.
// Skips any print that already has a story, so it is safe to run again.
export const importStarterStories = webMethod(Permissions.Admin, async () => {
  const existing = await queryAll(wixData.query(COLLECTIONS.stories));
  const have = new Set(existing.map((s) => s.productId));
  const rows = STARTER_STORIES.filter((s) => !have.has(s.productId));
  for (let i = 0; i < rows.length; i += 50) {
    await wixData.bulkInsert(COLLECTIONS.stories, rows.slice(i, i + 50), AUTH);
  }
  return { imported: rows.length, skipped: STARTER_STORIES.length - rows.length };
});

// Adds a print to the story library with an empty draft to write or generate.
export const addStory = webMethod(Permissions.Admin, async (productId) => {
  const existing = await wixData.query(COLLECTIONS.stories).eq('productId', productId).find(AUTH);
  if (existing.items.length) {
    const s = existing.items[0];
    return s.status === 'removed'
      ? wixData.update(COLLECTIONS.stories, { ...s, status: 'draft' }, AUTH)
      : s;
  }
  const products = await getProducts([productId]);
  const p = products.get(productId);
  if (!p) throw new Error('Product not found in the store.');
  return wixData.insert(COLLECTIONS.stories, {
    productId, title: p.name, slug: p.slug, transcript: '', status: 'draft',
    wordCount: 0, estDurationSec: 0,
  }, AUTH);
});

export const saveStory = webMethod(Permissions.Admin, async (storyId, changes) => {
  const story = await wixData.get(COLLECTIONS.stories, storyId, AUTH);
  if (!story) throw new Error('Story not found.');
  const next = { ...story };
  for (const key of STORY_FIELDS) {
    if (key in changes) next[key] = key === 'signed' ? !!changes[key] : cleanText(changes[key], 8000);
  }
  if (next.transcript !== story.transcript) {
    Object.assign(next, wordStats(next.transcript));
    // An edited script needs re-approval before collectors hear it.
    if (story.status === 'approved') next.status = 'draft';
  }
  return wixData.update(COLLECTIONS.stories, next, AUTH);
});

// draft -> approved, or "remove" a print from the library (kept, hidden).
export const setStoryStatus = webMethod(Permissions.Admin, async (storyId, status) => {
  if (!STORY_STATUSES.includes(status)) throw new Error('Unknown status.');
  const story = await wixData.get(COLLECTIONS.stories, storyId, AUTH);
  if (status === 'approved' && !String(story.transcript || '').trim()) {
    throw new Error('Write the script before approving it.');
  }
  return wixData.update(COLLECTIONS.stories, { ...story, status }, AUTH);
});

export const generateStoryAudio = webMethod(Permissions.Admin, async (storyId) => {
  const story = await wixData.get(COLLECTIONS.stories, storyId, AUTH);
  if (!story || story.status !== 'approved') throw new Error('Approve the script before generating audio.');
  const audioUrl = await synthesiseStory(story);
  return wixData.update(COLLECTIONS.stories, {
    ...story, audioUrl, audioScriptHash: hash(story.transcript), audioGeneratedAt: now(),
  }, AUTH);
});

// Signed upload URL so the director's browser can upload a recorded greeting
// straight to the Media Manager without routing audio through a web method.
export const getAudioUploadUrl = webMethod(Permissions.Admin, async (mimeType, fileName) => {
  if (!/^audio\//.test(String(mimeType))) throw new Error('Audio files only.');
  const generate = auth.elevate(files.generateFileUploadUrl);
  const res = await generate(mimeType, { fileName: cleanText(fileName, 80) || 'greeting.wav' });
  return res.uploadUrl;
});

// ---------- Rooms ----------

async function roomStats(roomIds) {
  if (!roomIds.length) return new Map();
  const [requests, events] = await Promise.all([
    queryAll(wixData.query(COLLECTIONS.requests).hasSome('roomId', roomIds)),
    queryAll(wixData.query(COLLECTIONS.events).hasSome('roomId', roomIds)),
  ]);
  const stats = new Map(roomIds.map((id) => [id, { pending: 0, requests: 0, dwellSec: 0, audioPlays: 0 }]));
  for (const r of requests) {
    const s = stats.get(r.roomId);
    s.requests += 1;
    if (r.status === 'pending') s.pending += 1;
  }
  for (const e of events) {
    const s = stats.get(e.roomId);
    if (e.type === 'print_dwell') s.dwellSec += e.value || 0;
    if (e.type === 'audio_play') s.audioPlays += 1;
  }
  return stats;
}

export const listRooms = webMethod(Permissions.Admin, async () => {
  const rooms = await queryAll(wixData.query(COLLECTIONS.rooms).descending('_createdDate'));
  if (!rooms.length) return [];
  const [items, stats] = await Promise.all([
    queryAll(wixData.query(COLLECTIONS.items).hasSome('roomId', rooms.map((r) => r._id))),
    roomStats(rooms.map((r) => r._id)),
  ]);
  return rooms.map((r) => ({
    ...r,
    url: `${ROOM_URL_PREFIX}${r.slug}`,
    printCount: items.filter((i) => i.roomId === r._id).length,
    stats: stats.get(r._id),
  }));
});

export const getRoomDetail = webMethod(Permissions.Admin, async (roomId) => {
  const room = await wixData.get(COLLECTIONS.rooms, roomId, AUTH);
  if (!room) throw new Error('Room not found.');
  const [items, requests, events] = await Promise.all([
    queryAll(wixData.query(COLLECTIONS.items).eq('roomId', roomId).ascending('sortOrder')),
    queryAll(wixData.query(COLLECTIONS.requests).eq('roomId', roomId).descending('_createdDate')),
    queryAll(wixData.query(COLLECTIONS.events).eq('roomId', roomId)),
  ]);
  const products = await getProducts(items.map((i) => i.productId));
  const perPrint = {};
  for (const e of events) {
    const k = e.productId || '_room';
    perPrint[k] = perPrint[k] || { dwellSec: 0, audioPlays: 0, audioMaxPct: 0, viewInRoom: 0, transcriptOpens: 0, opens: 0 };
    const s = perPrint[k];
    if (e.type === 'print_dwell') s.dwellSec += e.value || 0;
    if (e.type === 'audio_play') s.audioPlays += 1;
    if (e.type === 'audio_progress') s.audioMaxPct = Math.max(s.audioMaxPct, e.value || 0);
    if (e.type === 'view_in_room') s.viewInRoom += 1;
    if (e.type === 'transcript_open') s.transcriptOpens += 1;
    if (e.type === 'room_open') s.opens += 1;
  }
  return {
    room: { ...room, url: `${ROOM_URL_PREFIX}${room.slug}` },
    items: items.map((i) => ({ ...i, product: productSummary(products.get(i.productId)) })),
    requests,
    analytics: perPrint,
  };
});

export const saveRoom = webMethod(Permissions.Admin, async (input) => {
  const fields = {
    collectorName: cleanText(input.collectorName, 120),
    collectorEmail: cleanText(input.collectorEmail, 200).toLowerCase(),
    greeting: cleanText(input.greeting, 3000),
    greetingAudioUrl: cleanText(input.greetingAudioUrl, 500),
    expiresAt: input.expiresAt ? new Date(input.expiresAt)
      : new Date(Date.now() + DEFAULT_ROOM_DAYS * 86400 * 1000),
  };
  if (!fields.collectorName) throw new Error('Collector name is required.');
  if (input._id) {
    const room = await wixData.get(COLLECTIONS.rooms, input._id, AUTH);
    return wixData.update(COLLECTIONS.rooms, { ...room, ...fields }, AUTH);
  }
  return wixData.insert(COLLECTIONS.rooms, {
    ...fields, slug: makeRoomSlug(fields.collectorName), status: 'draft', openCount: 0,
  }, AUTH);
});

export const setRoomStatus = webMethod(Permissions.Admin, async (roomId, status) => {
  if (!ROOM_STATUSES.includes(status)) throw new Error('Unknown status.');
  const room = await wixData.get(COLLECTIONS.rooms, roomId, AUTH);
  return wixData.update(COLLECTIONS.rooms, { ...room, status }, AUTH);
});

// Replaces the room's print list in one go - this is how prints are added,
// removed and reordered. items: [{ productId, curatorNote, offerPrice, offerExpiresAt }]
export const setRoomItems = webMethod(Permissions.Admin, async (roomId, items) => {
  if (!Array.isArray(items)) throw new Error('Expected a list of prints.');
  if (items.length > MAX_ROOM_ITEMS) throw new Error(`A room can hold up to ${MAX_ROOM_ITEMS} prints.`);
  const ids = items.map((i) => i.productId);
  if (new Set(ids).size !== ids.length) throw new Error('Each print can only appear once.');
  const products = await getProducts(ids);
  const missing = ids.filter((id) => !products.has(id));
  if (missing.length) throw new Error('Some prints are no longer in the store.');

  const current = await queryAll(wixData.query(COLLECTIONS.items).eq('roomId', roomId));
  const byProduct = new Map(current.map((i) => [i.productId, i]));
  const keep = new Set(ids);
  const removed = current.filter((i) => !keep.has(i.productId)).map((i) => i._id);
  if (removed.length) await wixData.bulkRemove(COLLECTIONS.items, removed, AUTH);

  const rows = items.map((i, index) => ({
    ...(byProduct.get(i.productId) || {}),
    roomId,
    productId: i.productId,
    sortOrder: index,
    curatorNote: cleanText(i.curatorNote, 3000),
    offerPrice: Number(i.offerPrice) > 0 ? Number(i.offerPrice) : null,
    offerExpiresAt: i.offerExpiresAt ? new Date(i.offerExpiresAt) : null,
  }));
  if (rows.length) await wixData.bulkSave(COLLECTIONS.items, rows, AUTH);
  return queryAll(wixData.query(COLLECTIONS.items).eq('roomId', roomId).ascending('sortOrder'));
});

// ---------- Requests ----------

export const listRequests = webMethod(Permissions.Admin, async (status) => {
  let q = wixData.query(COLLECTIONS.requests).descending('_createdDate');
  if (status) q = q.eq('status', status);
  const requests = await queryAll(q);
  if (!requests.length) return [];
  const rooms = await queryAll(wixData.query(COLLECTIONS.rooms).hasSome('_id', [...new Set(requests.map((r) => r.roomId))]));
  const roomById = new Map(rooms.map((r) => [r._id, r]));
  return requests.map((r) => ({ ...r, roomSlug: (roomById.get(r.roomId) || {}).slug || '' }));
});

// action: confirm | decline | answer
export const respondToRequest = webMethod(Permissions.Admin, async (requestId, action, reply) => {
  const r = await wixData.get(COLLECTIONS.requests, requestId, AUTH);
  if (!r) throw new Error('Request not found.');
  const room = await wixData.get(COLLECTIONS.rooms, r.roomId, AUTH);
  const next = { ...r, reply: cleanText(reply, 3000), respondedAt: now() };
  let headline;

  if (action === 'confirm' && r.type === 'hold') {
    const clash = await wixData.query(COLLECTIONS.requests)
      .eq('productId', r.productId).eq('type', 'hold').eq('status', 'confirmed')
      .gt('holdExpiresAt', now()).ne('_id', r._id).count(AUTH);
    if (clash) throw new Error('This print is already held for another collector.');
    next.status = 'confirmed';
    next.holdExpiresAt = holdExpiry();
    headline = `${r.printTitle} is now held for you for 48 hours`;
  } else if (action === 'confirm' && r.type === 'offer') {
    next.status = 'confirmed';
    headline = `Your acceptance of our offer on ${r.printTitle} is confirmed`;
  } else if (action === 'decline') {
    next.status = 'declined';
    headline = `An update on ${r.printTitle}`;
  } else if (action === 'answer') {
    if (!next.reply) throw new Error('Write a reply first.');
    next.status = 'answered';
    headline = `A reply about ${r.printTitle}`;
  } else {
    throw new Error('Unknown action.');
  }
  const saved = await wixData.update(COLLECTIONS.requests, next, AUTH);
  await updateCollector({ room, print: r.printTitle, headline, reply: next.reply });
  return saved;
});
