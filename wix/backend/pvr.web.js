// Collector-facing web methods. Anyone can call these, so every method
// authorises by the unguessable room slug and only touches that room's data.
import { Permissions, webMethod } from 'wix-web-module';
import wixData from 'wix-data';
import {
  COLLECTIONS, EVENT_TYPES, MAX_MESSAGE_LENGTH, MAX_REQUESTS_PER_ROOM_PER_DAY,
} from 'backend/pvr.config';
import {
  buildRoomPayload, cleanText, findRoomBySlug, getRoomItems, roomIsOpen, now,
} from 'backend/pvr-lib';
import { alertDirector } from 'backend/pvr-notify';

const AUTH = { suppressAuth: true };
const REQUEST_TYPES = ['hold', 'question', 'offer'];

async function openRoom(slug) {
  const room = await findRoomBySlug(slug);
  if (!roomIsOpen(room)) throw new Error('This viewing room is no longer open.');
  return room;
}

export const getRoom = webMethod(Permissions.Anyone, async (slug) => {
  return buildRoomPayload(await openRoom(slug));
});

export const submitRequest = webMethod(Permissions.Anyone, async (slug, input) => {
  const room = await openRoom(slug);
  const type = String(input && input.type);
  if (!REQUEST_TYPES.includes(type)) throw new Error('Unknown request type.');
  const items = await getRoomItems(room._id);
  const item = items.find((i) => i.productId === input.productId);
  if (!item) throw new Error('That print is not in this room.');

  const since = new Date(Date.now() - 24 * 3600 * 1000);
  const recent = await wixData.query(COLLECTIONS.requests)
    .eq('roomId', room._id).gt('_createdDate', since).count(AUTH);
  if (recent >= MAX_REQUESTS_PER_ROOM_PER_DAY) {
    throw new Error('Thank you - we have your messages and will be in touch shortly.');
  }

  const existing = await wixData.query(COLLECTIONS.requests)
    .eq('roomId', room._id).eq('productId', item.productId).eq('type', type)
    .hasSome('status', ['pending', 'confirmed']).count(AUTH);
  if (type !== 'question' && existing) throw new Error('This request is already with the Studio.');
  if (type === 'offer' && !(item.offerPrice > 0 && (!item.offerExpiresAt || new Date(item.offerExpiresAt) > now()))) {
    throw new Error('This offer is no longer available.');
  }

  const message = cleanText(input.message, MAX_MESSAGE_LENGTH);
  if (type === 'question' && !message) throw new Error('Please write your question.');

  const products = await wixData.query('Stores/Products').eq('_id', item.productId).find(AUTH);
  const printTitle = products.items[0] ? products.items[0].name : 'a print';
  await wixData.insert(COLLECTIONS.requests, {
    roomId: room._id,
    productId: item.productId,
    printTitle,
    collectorName: room.collectorName,
    type,
    message,
    offerPrice: type === 'offer' ? item.offerPrice : null,
    status: 'pending',
  }, AUTH);
  await alertDirector({ room, print: printTitle, type, message });
  return buildRoomPayload(room);
});

export const logEvents = webMethod(Permissions.Anyone, async (slug, events) => {
  const room = await findRoomBySlug(slug);
  if (!roomIsOpen(room) || !Array.isArray(events)) return { logged: 0 };
  const rows = events.slice(0, 50)
    .filter((e) => e && EVENT_TYPES.includes(e.type))
    .map((e) => ({
      roomId: room._id,
      productId: cleanText(e.productId, 64),
      type: e.type,
      value: Math.max(0, Math.min(Number(e.value) || 0, 3600)),
      sessionId: cleanText(e.sessionId, 32),
    }));
  if (rows.length) await wixData.bulkInsert(COLLECTIONS.events, rows, AUTH);
  return { logged: rows.length };
});
