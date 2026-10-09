// Shared helpers for the Interactive Gallery. Backend only.
import wixData from 'wix-data';
import crypto from 'crypto';
import { COLLECTIONS, HOLD_HOURS, MIN_PRINT_PRICE } from 'backend/gallery.config';

export const AUTH = { suppressAuth: true };

export const now = () => new Date();

export function cleanText(value, max) {
  return String(value == null ? '' : value).replace(/\s+\n/g, '\n').trim().slice(0, max);
}

export function validVisitorId(id) {
  return /^[a-z0-9]{16,40}$/.test(String(id || ''));
}

export function validEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(email || ''));
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

// Stored as "w x h" text in the CMS; returns [w, h] or null.
export function parseSize(value) {
  const m = String(value || '').match(/([\d.]+)\s*[x×,]\s*([\d.]+)/);
  return m ? [Number(m[1]), Number(m[2])] : null;
}

export function parseThemes(value) {
  return String(value || '').split(',').map((t) => t.trim()).filter(Boolean);
}

export function parseIds(value) {
  try {
    const ids = JSON.parse(value || '[]');
    return Array.isArray(ids) ? ids.filter((x) => typeof x === 'string') : [];
  } catch (e) {
    return [];
  }
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
    inStock: p.inStock !== false,
    ribbon: p.ribbon || '',
    image: mediaUrl(p.mainMedia),
    productUrl: p.productPageUrl ? `https://www.jackvettriano.studio${p.productPageUrl}` : '',
    hasOptions: !!(p.productOptions && Object.keys(p.productOptions).length),
    framedSizeFromStore: framed ? [Number(framed[1]), Number(framed[2])] : null,
  };
}

export function storyForVisitor(story) {
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

// Confirmed, unexpired holds anywhere on the site.
export async function getActiveHolds() {
  return queryAll(
    wixData.query(COLLECTIONS.requests).eq('type', 'hold').eq('status', 'confirmed').gt('holdExpiresAt', now())
  );
}

export function holdExpiry() {
  return new Date(Date.now() + HOLD_HOURS * 3600 * 1000);
}

export async function findLeadByVisitor(visitorId) {
  if (!validVisitorId(visitorId)) return null;
  const res = await wixData.query(COLLECTIONS.leads).eq('visitorId', visitorId).limit(1).find(AUTH);
  return res.items[0] || null;
}
