// Visitor-facing web methods for the public gallery. Anyone can call these.
// A visitor is identified only by a random ID kept in their browser; they
// become a lead when they choose to send a request with their name and email.
import { Permissions, webMethod } from 'wix-web-module';
import wixData from 'wix-data';
import { currentCart } from 'wix-ecom-backend';
import { products as storeProducts } from '@wix/stores';
import { auth } from '@wix/essentials';
import {
  COLLECTIONS, EVENT_TYPES, MAX_MESSAGE_LENGTH, MAX_REQUESTS_PER_VISITOR_PER_DAY,
  MIN_OFFER_SHARE, THEMES,
} from 'backend/gallery.config';
import {
  AUTH, cleanText, findLeadByVisitor, getActiveHolds, getProducts, now, parseIds,
  parseThemes, productSummary, queryAll, storyForVisitor, validEmail, validVisitorId,
} from 'backend/gallery-lib';
import { alertStudio, contactIdFor } from 'backend/gallery-notify';

const REQUEST_TYPES = ['hold', 'question', 'offer', 'shortlist'];

function requestView(r) {
  return {
    _id: r._id, type: r.type, productId: r.productId || '', productIds: parseIds(r.productIds),
    printTitle: r.printTitle, message: r.message, offerPrice: r.offerPrice || null,
    counterPrice: r.counterPrice || null, status: r.status, reply: r.reply || '',
    createdAt: r._createdDate, holdExpiresAt: r.holdExpiresAt || null,
  };
}

async function visitorActivity(visitorId) {
  const lead = await findLeadByVisitor(visitorId);
  if (!lead) return { lead: null, requests: [] };
  const requests = await queryAll(wixData.query(COLLECTIONS.requests).eq('leadId', lead._id).descending('_createdDate'));
  return { lead, requests };
}

// Everything the gallery page needs in one call.
export const getGallery = webMethod(Permissions.Anyone, async (visitorId) => {
  const stories = await queryAll(wixData.query(COLLECTIONS.stories).eq('status', 'approved'));
  const products = await getProducts(stories.map((s) => s.productId));
  const [holds, tours, mine] = await Promise.all([
    getActiveHolds(),
    queryAll(wixData.query(COLLECTIONS.tours).eq('status', 'live').ascending('sortOrder')),
    visitorActivity(visitorId),
  ]);
  const leadId = mine.lead && mine.lead._id;
  const prints = stories
    .filter((s) => products.has(s.productId) && products.get(s.productId).visible !== false)
    .map((s) => {
      const summary = productSummary(products.get(s.productId));
      const hold = holds.find((h) => h.productId === s.productId);
      let availability = summary.inStock ? 'available' : 'out_of_stock';
      if (hold) availability = hold.leadId === leadId ? 'held_by_you' : 'reserved';
      else if (mine.requests.some((r) => r.productId === s.productId && r.type === 'hold' && r.status === 'pending')) availability = 'hold_pending';
      return {
        ...summary,
        themes: parseThemes(s.themes),
        availability,
        holdExpiresAt: hold && hold.leadId === leadId ? hold.holdExpiresAt : null,
        story: storyForVisitor(s),
      };
    })
    .sort((a, b) => a.title.localeCompare(b.title));
  const onShow = new Set(prints.map((p) => p.productId));
  return {
    prints,
    themes: THEMES.filter((t) => prints.some((p) => p.themes.includes(t))),
    tours: tours.map((t) => ({
      slug: t.slug, title: t.title, intro: t.intro || '',
      productIds: parseIds(t.productIds).filter((id) => onShow.has(id)),
    })).filter((t) => t.productIds.length),
    me: {
      name: mine.lead ? mine.lead.name : '',
      requests: mine.requests.map(requestView),
    },
    minOfferShare: MIN_OFFER_SHARE,
  };
});

// Framed / unframed choices with their prices, fetched when a print is opened.
export const getPrintOptions = webMethod(Permissions.Anyone, async (productId) => {
  const query = auth.elevate(storeProducts.queryProductVariants);
  const res = await query(String(productId), {});
  return (res.variants || [])
    .filter((v) => !v.variant || v.variant.visible !== false)
    .map((v) => ({
      variantId: v._id,
      label: Object.values(v.choices || {}).join(' / ') || 'Standard',
      price: v.variant && v.variant.priceData ? v.variant.priceData.price : null,
      inStock: !(v.stock && v.stock.inStock === false),
    }));
});

// Adds one print (the chosen framed or unframed option) to this visitor's
// basket. Done in the backend with wix-ecom-backend, which needs no packages.
const STORES_APP_ID = '215238eb-22a5-4c36-9e7b-e7c08025e04e';
export const addToBasket = webMethod(Permissions.Anyone, async (productId, variantId) => {
  const catalogReference = { appId: STORES_APP_ID, catalogItemId: String(productId) };
  if (variantId) catalogReference.options = { variantId: String(variantId) };
  await currentCart.addToCurrentCart({ lineItems: [{ catalogReference, quantity: 1 }] });
  return { added: true };
});

export const getMyActivity = webMethod(Permissions.Anyone, async (visitorId) => {
  const mine = await visitorActivity(visitorId);
  return { name: mine.lead ? mine.lead.name : '', requests: mine.requests.map(requestView) };
});

async function findOrCreateLead(visitorId, contact) {
  const email = cleanText(contact.email, 200).toLowerCase();
  const name = cleanText(contact.name, 120);
  const phone = cleanText(contact.phone, 40);
  let lead = await findLeadByVisitor(visitorId);
  if (!lead) {
    const byEmail = await wixData.query(COLLECTIONS.leads).eq('email', email).limit(1).find(AUTH);
    lead = byEmail.items[0] || null;
  }
  let contactId = lead && lead.contactId;
  if (!contactId) {
    try { contactId = await contactIdFor(email, name); } catch (err) { console.error('Contact create failed', err); }
  }
  const t = now();
  if (lead) {
    const visitorIds = new Set(parseIds(lead.visitorIds));
    visitorIds.add(visitorId);
    return wixData.update(COLLECTIONS.leads, {
      ...lead, name: name || lead.name, phone: phone || lead.phone, contactId: contactId || '',
      visitorIds: JSON.stringify([...visitorIds]), lastSeenAt: t,
    }, AUTH);
  }
  return wixData.insert(COLLECTIONS.leads, {
    visitorId, visitorIds: JSON.stringify([visitorId]), name, email, phone, contactId: contactId || '',
    status: 'new', notes: '', firstSeenAt: t, lastSeenAt: t,
  }, AUTH);
}

export const submitRequest = webMethod(Permissions.Anyone, async (visitorId, contact, input) => {
  if (!validVisitorId(visitorId)) throw new Error('Please refresh the page and try again.');
  if (!contact || !cleanText(contact.name, 120)) throw new Error('Please tell us your name.');
  if (!validEmail(contact.email)) throw new Error('Please enter a valid email address so the Studio can reply.');
  const type = String(input && input.type);
  if (!REQUEST_TYPES.includes(type)) throw new Error('Unknown request.');

  const since = new Date(Date.now() - 24 * 3600 * 1000);
  const recent = await wixData.query(COLLECTIONS.requests).eq('visitorId', visitorId).gt('_createdDate', since).count(AUTH);
  if (recent >= MAX_REQUESTS_PER_VISITOR_PER_DAY) {
    throw new Error('Thank you, the Studio has your messages and will be in touch shortly.');
  }

  const ids = type === 'shortlist' ? parseIds(JSON.stringify(input.productIds || [])).slice(0, 20) : [String(input.productId || '')];
  const approved = await queryAll(wixData.query(COLLECTIONS.stories).eq('status', 'approved').hasSome('productId', ids));
  if (!ids.length || approved.length !== new Set(ids).size) throw new Error('One of these prints is no longer in the gallery.');
  const products = await getProducts(ids);
  const product = products.get(ids[0]);

  const message = cleanText(input.message, MAX_MESSAGE_LENGTH);
  if (type === 'question' && !message) throw new Error('Please write your question.');
  let offerPrice = null;
  if (type === 'offer') {
    offerPrice = Math.round(Number(input.offerPrice));
    if (!(offerPrice > 0)) throw new Error('Please enter the amount you would like to offer.');
    if (offerPrice >= product.price) throw new Error('That is at or above the listed price; you can buy it directly or request a hold.');
    if (offerPrice < product.price * MIN_OFFER_SHARE) {
      throw new Error(`We are unable to consider offers below ${Math.round(MIN_OFFER_SHARE * 100)}% of the listed price for this print.`);
    }
  }
  if (type === 'hold') {
    const holds = await getActiveHolds();
    if (holds.some((h) => h.productId === product._id)) throw new Error('This print is currently reserved for another collector.');
  }

  const lead = await findOrCreateLead(visitorId, contact);
  if (type === 'hold' || type === 'offer') {
    const dup = await wixData.query(COLLECTIONS.requests).eq('leadId', lead._id).eq('type', type)
      .eq('productId', product._id).hasSome('status', ['pending', 'countered']).count(AUTH);
    if (dup) throw new Error('This request is already with the Studio.');
  }
  const printTitle = type === 'shortlist'
    ? `Shortlist of ${ids.length} print${ids.length === 1 ? '' : 's'}`
    : product.name;
  await wixData.insert(COLLECTIONS.requests, {
    leadId: lead._id, visitorId, visitorName: lead.name, type,
    productId: type === 'shortlist' ? '' : product._id,
    productIds: JSON.stringify(ids), printTitle, message, offerPrice,
    listPrice: type === 'shortlist' ? null : product.price, status: 'pending',
  }, AUTH);
  await alertStudio({ lead, print: printTitle, type, message: offerPrice ? `Offer of £${offerPrice}. ${message}` : message });
  return { name: lead.name, requests: (await visitorActivity(visitorId)).requests.map(requestView) };
});

// The visitor accepts or declines the Studio's counter-offer.
export const answerCounterOffer = webMethod(Permissions.Anyone, async (visitorId, requestId, accept) => {
  const lead = await findLeadByVisitor(visitorId);
  const r = await wixData.get(COLLECTIONS.requests, String(requestId), AUTH);
  if (!lead || !r || r.leadId !== lead._id || r.status !== 'countered') throw new Error('This offer is no longer open.');
  await wixData.update(COLLECTIONS.requests, {
    ...r, status: accept ? 'accepted' : 'declined_by_visitor', respondedAt: now(),
  }, AUTH);
  await alertStudio({ lead, print: r.printTitle, type: accept ? 'counter-offer accepted' : 'counter-offer declined', message: `Counter-offer £${r.counterPrice}` });
  return { name: lead.name, requests: (await visitorActivity(visitorId)).requests.map(requestView) };
});

// Engagement events. The page only sends these when the visitor has allowed
// analytics cookies in the site's cookie banner.
export const logEvents = webMethod(Permissions.Anyone, async (visitorId, events) => {
  if (!validVisitorId(visitorId) || !Array.isArray(events)) return { logged: 0 };
  const rows = events.slice(0, 50)
    .filter((e) => e && EVENT_TYPES.includes(e.type))
    .map((e) => ({
      visitorId,
      productId: cleanText(e.productId, 64),
      tourSlug: cleanText(e.tourSlug, 64),
      type: e.type,
      value: Math.max(0, Math.min(Number(e.value) || 0, 3600)),
      sessionId: cleanText(e.sessionId, 32),
    }));
  if (rows.length) await wixData.bulkInsert(COLLECTIONS.events, rows, AUTH);
  const lead = await findLeadByVisitor(visitorId);
  if (lead) await wixData.update(COLLECTIONS.leads, { ...lead, lastSeenAt: now() }, AUTH);
  return { logged: rows.length };
});
