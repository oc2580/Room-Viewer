// Shared helpers for Private Viewing Rooms. Backend only.
import wixData from 'wix-data';
import crypto from 'crypto';
import { COLLECTIONS, HOLD_HOURS, MIN_PRINT_PRICE } from 'backend/pvr.config';

const AUTH = { suppressAuth: true };

export function now() {
  return new Date();
}

export function randomToken(bytes = 9) {
  return crypto.randomBytes(bytes).toString('base64url').replace(/[-_]/g, '').toLowerCase();
}

// "Mr & Mrs Johnson" -> "johnson-k3f9q2m7x1"
export function makeRoomSlug(collectorName) {
  const words = String(collectorName || 'collector').toLowerCase().match(/[a-z0-9]+/g) || ['collector'];
  const base = words[words.length - 1].slice(0, 24);
  return `${base}-${randomToken().slice(0, 10)}`;
}

export function cleanText(value, max) {
  return String(value == null ? '' : value).replace(/\s+\n/g, '\n').trim().slice(0, max);
}

// wix:image://v1/<id>/<name>#... -> https://static.wixstatic.com/media/<id>
export function mediaUrl(src) {
  if (!src) return '';
  if (/^https?:\/\//.test(src)) return src;
  const m = String(src).match(/^wix:image:\/\/v1\/([^/]+)\//);
  return m ? `https://static.wixstatic.com/media/${m[1]}` : '';
}

export function hash(text) {
  return crypto.createHash('sha256').update(String(text)).digest('hex').slice(0, 16);
}

export async function queryAll(query) {
  let res = await query.limit(1000).find(AUTH);
  const items = [...res.items];
  while (res.hasNext()) {
    res = await res.next();
    items.push(...res.items);
  }
  return items;
}

export async function getProducts(ids) {
  if (!ids.length) return new Map();
  const items = await queryAll(wixData.query('Stores/Products').hasSome('_id', ids));
  return new Map(items.map((p) => [p._id, p]));
}

export async function getPricedPrints() {
  return queryAll(wixData.query('Stores/Products').ge('price', MIN_PRINT_PRICE).ascending('name'));
}

export function productSummary(p) {
  if (!p) return null;
  const framed = (p.additionalInfoSections || [])
    .map((s) => String(s.description || '').match(/Framed size:\s*([\d.]+)\s*x\s*([\d.]+)\s*cm/i))
    .find(Boolean);
  return {
    productId: p._id,
    title: p.name,
    price: p.price,
    formattedPrice: p.formattedPrice,
    inStock: p.inStock !== false,
    ribbon: p.ribbon || '',
    image: mediaUrl(p.mainMedia),
    productUrl: p.productPageUrl ? `https://www.jackvettriano.studio${p.productPageUrl}` : '',
    framedSizeFromStore: framed ? [Number(framed[1]), Number(framed[2])] : null,
  };
}

export async function getStoriesByProduct(productIds, { approvedOnly } = {}) {
  if (!productIds.length) return new Map();
  let q = wixData.query(COLLECTIONS.stories).hasSome('productId', productIds);
  if (approvedOnly) q = q.eq('status', 'approved');
  const items = await queryAll(q);
  return new Map(items.map((s) => [s.productId, s]));
}

export async function findRoomBySlug(slug) {
  if (!/^[a-z0-9-]{6,60}$/.test(String(slug || ''))) return null;
  const res = await wixData.query(COLLECTIONS.rooms).eq('slug', slug).limit(1).find(AUTH);
  return res.items[0] || null;
}

export function roomIsOpen(room) {
  return room && room.status === 'live' && (!room.expiresAt || new Date(room.expiresAt) > now());
}

export async function getRoomItems(roomId) {
  const items = await queryAll(wixData.query(COLLECTIONS.items).eq('roomId', roomId).ascending('sortOrder'));
  return items;
}

// Active holds anywhere on the site for these products (confirmed, unexpired).
export async function getActiveHolds(productIds) {
  if (!productIds.length) return [];
  return queryAll(
    wixData.query(COLLECTIONS.requests)
      .hasSome('productId', productIds)
      .eq('type', 'hold')
      .eq('status', 'confirmed')
      .gt('holdExpiresAt', now())
  );
}

export function holdExpiry() {
  return new Date(Date.now() + HOLD_HOURS * 3600 * 1000);
}

export function storyForRoom(story) {
  if (!story || story.status !== 'approved') return null;
  return {
    transcript: story.transcript,
    audioUrl: story.audioUrl && story.audioScriptHash === hash(story.transcript) ? story.audioUrl : '',
    estDurationSec: story.estDurationSec || 0,
    edition: story.edition || '',
    medium: story.medium || '',
    signed: !!story.signed,
    imageSizeCm: parseSize(story.imageSizeCm),
    mountSizeCm: parseSize(story.mountSizeCm),
    framedSizeCm: parseSize(story.framedSizeCm),
  };
}

// Stored as "w x h" text in the CMS; returns [w, h] or null.
export function parseSize(value) {
  if (Array.isArray(value)) return value.length === 2 ? value.map(Number) : null;
  const m = String(value || '').match(/([\d.]+)\s*[x×,]\s*([\d.]+)/);
  return m ? [Number(m[1]), Number(m[2])] : null;
}

// Everything the collector's room needs. Never includes other collectors' data.
export async function buildRoomPayload(room) {
  const items = await getRoomItems(room._id);
  const productIds = items.map((i) => i.productId);
  const [products, stories, holds, requests] = await Promise.all([
    getProducts(productIds),
    getStoriesByProduct(productIds, { approvedOnly: true }),
    getActiveHolds(productIds),
    queryAll(wixData.query(COLLECTIONS.requests).eq('roomId', room._id).descending('_createdDate')),
  ]);
  const t = now();
  return {
    room: {
      slug: room.slug,
      collectorName: room.collectorName,
      greeting: room.greeting || '',
      greetingAudioUrl: room.greetingAudioUrl || '',
      expiresAt: room.expiresAt || null,
      holdHours: HOLD_HOURS,
    },
    prints: items
      .filter((i) => products.has(i.productId))
      .map((i) => {
        const product = productSummary(products.get(i.productId));
        const mine = requests.filter((r) => r.productId === i.productId);
        const hold = holds.find((h) => h.productId === i.productId);
        const offerOpen = i.offerPrice > 0 && (!i.offerExpiresAt || new Date(i.offerExpiresAt) > t);
        let availability = product.inStock ? 'available' : 'out_of_stock';
        if (hold) availability = hold.roomId === room._id ? 'held_by_you' : 'reserved';
        else if (mine.some((r) => r.type === 'hold' && r.status === 'pending')) availability = 'hold_pending';
        return {
          ...product,
          curatorNote: i.curatorNote || '',
          offer: offerOpen ? { price: i.offerPrice, expiresAt: i.offerExpiresAt || null } : null,
          availability,
          holdExpiresAt: hold && hold.roomId === room._id ? hold.holdExpiresAt : null,
          story: storyForRoom(stories.get(i.productId)),
          requests: mine.map((r) => ({
            type: r.type, message: r.message, status: r.status, reply: r.reply || '',
            createdAt: r._createdDate, holdExpiresAt: r.holdExpiresAt || null,
          })),
        };
      }),
  };
}
