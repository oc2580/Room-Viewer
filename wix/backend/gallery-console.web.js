// Studio console web methods. Admin only: called from the Gallery dashboard page.
import { Permissions, webMethod } from 'wix-web-module';
import wixData from 'wix-data';
import {
  COLLECTIONS, LEAD_POINTS, MAX_TOUR_PRINTS, THEMES,
} from 'backend/gallery.config';
import {
  AUTH, cleanText, getActiveHolds, getPricedPrints, getProducts, hash, holdExpiry,
  now, parseIds, parseThemes, productSummary, queryAll,
} from 'backend/gallery-lib';
import { updateVisitor } from 'backend/gallery-notify';
import { synthesiseStory } from 'backend/gallery-audio';
import { STARTER_STORIES, STARTER_TOURS } from 'backend/gallery-seed';

const STORY_STATUSES = ['draft', 'approved', 'removed'];
const LEAD_STATUSES = ['new', 'contacted', 'negotiating', 'won', 'lost'];
const STORY_FIELDS = ['title', 'transcript', 'edition', 'medium', 'signed', 'imageSizeCm', 'mountSizeCm', 'framedSizeCm', 'reviewNotes', 'themes'];

function wordStats(transcript) {
  const words = String(transcript || '').trim().split(/\s+/).filter(Boolean).length;
  return { wordCount: words, estDurationSec: Math.round((words / 150) * 60) };
}

// ---------- Story library ----------

export const listCatalogue = webMethod(Permissions.Admin, async () => {
  const [products, stories] = await Promise.all([getPricedPrints(), queryAll(wixData.query(COLLECTIONS.stories))]);
  const byProduct = new Map(stories.map((s) => [s.productId, s]));
  return products.map((p) => {
    const s = byProduct.get(p._id);
    return {
      ...productSummary(p),
      story: s ? {
        _id: s._id, status: s.status, transcript: s.transcript || '', edition: s.edition || '', medium: s.medium || '',
        signed: !!s.signed, imageSizeCm: s.imageSizeCm || '', mountSizeCm: s.mountSizeCm || '', framedSizeCm: s.framedSizeCm || '',
        reviewNotes: s.reviewNotes || '', themes: s.themes || '', estDurationSec: s.estDurationSec || 0,
        audioUrl: s.audioUrl || '', audioCurrent: !!s.audioUrl && s.audioScriptHash === hash(s.transcript),
      } : null,
    };
  });
});

// One-off import of the starter scripts (as drafts) and tours (as drafts).
// Skips anything that already exists, so it is safe to run again.
export const importStarterContent = webMethod(Permissions.Admin, async () => {
  const [stories, tours] = await Promise.all([queryAll(wixData.query(COLLECTIONS.stories)), queryAll(wixData.query(COLLECTIONS.tours))]);
  const haveStory = new Set(stories.map((s) => s.productId));
  const haveTour = new Set(tours.map((t) => t.slug));
  const newStories = STARTER_STORIES.filter((s) => !haveStory.has(s.productId));
  const newTours = STARTER_TOURS.filter((t) => !haveTour.has(t.slug));
  for (let i = 0; i < newStories.length; i += 50) await wixData.bulkInsert(COLLECTIONS.stories, newStories.slice(i, i + 50), AUTH);
  if (newTours.length) await wixData.bulkInsert(COLLECTIONS.tours, newTours, AUTH);
  // Stories imported earlier pick up recorded narration if their script still
  // matches the recording and they have no current audio of their own.
  const seedBySlug = new Map(STARTER_STORIES.filter((s) => s.audioUrl).map((s) => [s.productId, s]));
  const withAudio = stories.filter((s) => {
    const seed = seedBySlug.get(s.productId);
    return seed && seed.audioScriptHash === hash(s.transcript) && s.audioScriptHash !== hash(s.transcript);
  }).map((s) => ({ ...s, audioUrl: seedBySlug.get(s.productId).audioUrl, audioScriptHash: hash(s.transcript), audioGeneratedAt: now() }));
  for (let i = 0; i < withAudio.length; i += 50) await wixData.bulkUpdate(COLLECTIONS.stories, withAudio.slice(i, i + 50), AUTH);
  return { stories: newStories.length, tours: newTours.length, audio: withAudio.length };
});

export const addStory = webMethod(Permissions.Admin, async (productId) => {
  const existing = await wixData.query(COLLECTIONS.stories).eq('productId', productId).find(AUTH);
  if (existing.items.length) {
    const s = existing.items[0];
    return s.status === 'removed' ? wixData.update(COLLECTIONS.stories, { ...s, status: 'draft' }, AUTH) : s;
  }
  const p = (await getProducts([productId])).get(productId);
  if (!p) throw new Error('Product not found in the store.');
  return wixData.insert(COLLECTIONS.stories, {
    productId, title: p.name, slug: p.slug, transcript: '', status: 'draft', themes: '', wordCount: 0, estDurationSec: 0,
  }, AUTH);
});

export const saveStory = webMethod(Permissions.Admin, async (storyId, changes) => {
  const story = await wixData.get(COLLECTIONS.stories, storyId, AUTH);
  if (!story) throw new Error('Story not found.');
  const next = { ...story };
  for (const key of STORY_FIELDS) {
    if (!(key in changes)) continue;
    if (key === 'signed') next.signed = !!changes.signed;
    else if (key === 'themes') next.themes = parseThemes(changes.themes).filter((t) => THEMES.includes(t)).join(', ');
    else next[key] = cleanText(changes[key], 8000);
  }
  if (next.transcript !== story.transcript) {
    Object.assign(next, wordStats(next.transcript));
    // An edited script needs re-approval before visitors hear it.
    if (story.status === 'approved') next.status = 'draft';
  }
  return wixData.update(COLLECTIONS.stories, next, AUTH);
});

// approved = on show in the gallery; removed = hidden but kept.
export const setStoryStatus = webMethod(Permissions.Admin, async (storyId, status) => {
  if (!STORY_STATUSES.includes(status)) throw new Error('Unknown status.');
  const story = await wixData.get(COLLECTIONS.stories, storyId, AUTH);
  if (status === 'approved' && !String(story.transcript || '').trim()) throw new Error('Write the script before approving it.');
  return wixData.update(COLLECTIONS.stories, { ...story, status }, AUTH);
});

export const generateStoryAudio = webMethod(Permissions.Admin, async (storyId) => {
  const story = await wixData.get(COLLECTIONS.stories, storyId, AUTH);
  if (!story || story.status !== 'approved') throw new Error('Approve the script before generating audio.');
  const audioUrl = await synthesiseStory(story);
  return wixData.update(COLLECTIONS.stories, { ...story, audioUrl, audioScriptHash: hash(story.transcript), audioGeneratedAt: now() }, AUTH);
});

// ---------- Tours ----------

export const listTours = webMethod(Permissions.Admin, async () => {
  const tours = await queryAll(wixData.query(COLLECTIONS.tours).ascending('sortOrder'));
  return tours.map((t) => ({ ...t, productIds: parseIds(t.productIds) }));
});

export const saveTour = webMethod(Permissions.Admin, async (input) => {
  const title = cleanText(input.title, 120);
  if (!title) throw new Error('Give the tour a title.');
  const ids = [...new Set((input.productIds || []).map(String))];
  if (ids.length > MAX_TOUR_PRINTS) throw new Error(`A tour can include up to ${MAX_TOUR_PRINTS} prints.`);
  const fields = { title, intro: cleanText(input.intro, 1000), productIds: JSON.stringify(ids) };
  if (input._id) {
    const t = await wixData.get(COLLECTIONS.tours, input._id, AUTH);
    return wixData.update(COLLECTIONS.tours, { ...t, ...fields }, AUTH);
  }
  const count = await wixData.query(COLLECTIONS.tours).count(AUTH);
  const slug = `${title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40)}-${Date.now().toString(36).slice(-4)}`;
  return wixData.insert(COLLECTIONS.tours, { ...fields, slug, status: 'draft', sortOrder: count }, AUTH);
});

export const setTourStatus = webMethod(Permissions.Admin, async (tourId, status) => {
  if (!['draft', 'live'].includes(status)) throw new Error('Unknown status.');
  const t = await wixData.get(COLLECTIONS.tours, tourId, AUTH);
  if (status === 'live' && !parseIds(t.productIds).length) throw new Error('Add prints before publishing the tour.');
  return wixData.update(COLLECTIONS.tours, { ...t, status }, AUTH);
});

export const deleteTour = webMethod(Permissions.Admin, async (tourId) => {
  await wixData.remove(COLLECTIONS.tours, tourId, AUTH);
  return { removed: true };
});

// ---------- Leads ----------

function scoreEvents(events, requestCount) {
  let score = requestCount * LEAD_POINTS.request;
  for (const e of events) {
    if (e.type === 'print_dwell') score += Math.floor((e.value || 0) / 60) * LEAD_POINTS.print_dwell_minute;
    else if (e.type === 'audio_progress' && e.value >= 100) score += LEAD_POINTS.audio_complete;
    else if (LEAD_POINTS[e.type]) score += LEAD_POINTS[e.type];
  }
  return score;
}

// Net shortlist from add/remove events, most recent first.
function shortlistFrom(events) {
  const state = new Map();
  [...events].sort((a, b) => new Date(a._createdDate) - new Date(b._createdDate)).forEach((e) => {
    if (e.type === 'shortlist_add') state.set(e.productId, e._createdDate);
    if (e.type === 'shortlist_remove') state.delete(e.productId);
  });
  return [...state.keys()].reverse();
}

export const listLeads = webMethod(Permissions.Admin, async () => {
  const leads = await queryAll(wixData.query(COLLECTIONS.leads).descending('lastSeenAt'));
  if (!leads.length) return [];
  const visitorIds = leads.flatMap((l) => parseIds(l.visitorIds));
  const [events, requests] = await Promise.all([
    queryAll(wixData.query(COLLECTIONS.events).hasSome('visitorId', visitorIds)),
    queryAll(wixData.query(COLLECTIONS.requests).hasSome('leadId', leads.map((l) => l._id))),
  ]);
  return leads.map((l) => {
    const ids = new Set(parseIds(l.visitorIds));
    const ev = events.filter((e) => ids.has(e.visitorId));
    const rq = requests.filter((r) => r.leadId === l._id);
    return {
      _id: l._id, name: l.name, email: l.email, phone: l.phone || '', status: l.status, notes: l.notes || '',
      firstSeenAt: l.firstSeenAt, lastSeenAt: l.lastSeenAt,
      score: scoreEvents(ev, rq.length),
      pending: rq.filter((r) => r.status === 'pending' || r.status === 'accepted').length,
      requests: rq.length,
      shortlist: shortlistFrom(ev).length,
      storiesPlayed: new Set(ev.filter((e) => e.type === 'audio_play').map((e) => e.productId)).size,
    };
  }).sort((a, b) => b.score - a.score);
});

export const getLeadDetail = webMethod(Permissions.Admin, async (leadId) => {
  const lead = await wixData.get(COLLECTIONS.leads, leadId, AUTH);
  if (!lead) throw new Error('Lead not found.');
  const ids = parseIds(lead.visitorIds);
  const [events, requests] = await Promise.all([
    ids.length ? queryAll(wixData.query(COLLECTIONS.events).hasSome('visitorId', ids)) : [],
    queryAll(wixData.query(COLLECTIONS.requests).eq('leadId', leadId).descending('_createdDate')),
  ]);
  const perPrint = {};
  for (const e of events) {
    if (!e.productId) continue;
    const s = perPrint[e.productId] = perPrint[e.productId] || { opens: 0, dwellSec: 0, audioPlays: 0, audioMaxPct: 0, viewInRoom: 0, transcriptOpens: 0, basket: 0 };
    if (e.type === 'print_open') s.opens += 1;
    if (e.type === 'print_dwell') s.dwellSec += e.value || 0;
    if (e.type === 'audio_play') s.audioPlays += 1;
    if (e.type === 'audio_progress') s.audioMaxPct = Math.max(s.audioMaxPct, e.value || 0);
    if (e.type === 'view_in_room') s.viewInRoom += 1;
    if (e.type === 'transcript_open') s.transcriptOpens += 1;
    if (e.type === 'add_to_basket') s.basket += 1;
  }
  const shortlist = shortlistFrom(events);
  const products = await getProducts([...new Set([...Object.keys(perPrint), ...shortlist, ...requests.flatMap((r) => parseIds(r.productIds))])]);
  const title = (id) => (products.get(id) ? products.get(id).name : 'Removed print');
  return {
    lead: { ...lead, visitorIds: ids },
    score: scoreEvents(events, requests.length),
    visits: new Set(events.map((e) => e.sessionId).filter(Boolean)).size,
    shortlist: shortlist.map((id) => ({ productId: id, title: title(id), price: products.get(id) ? products.get(id).price : null })),
    prints: Object.entries(perPrint).map(([id, s]) => ({ productId: id, title: title(id), ...s }))
      .sort((a, b) => b.dwellSec - a.dwellSec),
    tours: [...new Set(events.filter((e) => e.type === 'tour_start').map((e) => e.tourSlug))],
    requests,
  };
});

export const updateLead = webMethod(Permissions.Admin, async (leadId, changes) => {
  const lead = await wixData.get(COLLECTIONS.leads, leadId, AUTH);
  const next = { ...lead };
  if ('status' in changes) {
    if (!LEAD_STATUSES.includes(changes.status)) throw new Error('Unknown status.');
    next.status = changes.status;
  }
  if ('notes' in changes) next.notes = cleanText(changes.notes, 5000);
  return wixData.update(COLLECTIONS.leads, next, AUTH);
});

// ---------- Requests ----------

export const listRequests = webMethod(Permissions.Admin, async (status) => {
  let q = wixData.query(COLLECTIONS.requests).descending('_createdDate');
  if (status) q = q.eq('status', status);
  const requests = await queryAll(q);
  if (!requests.length) return [];
  const leads = await queryAll(wixData.query(COLLECTIONS.leads).hasSome('_id', [...new Set(requests.map((r) => r.leadId))]));
  const byId = new Map(leads.map((l) => [l._id, l]));
  return requests.map((r) => {
    const l = byId.get(r.leadId) || {};
    return { ...r, productIds: parseIds(r.productIds), leadName: l.name || r.visitorName || '', leadEmail: l.email || '', leadPhone: l.phone || '' };
  });
});

// action: confirm | decline | answer | counter
export const respondToRequest = webMethod(Permissions.Admin, async (requestId, action, reply, counterPrice) => {
  const r = await wixData.get(COLLECTIONS.requests, requestId, AUTH);
  if (!r) throw new Error('Request not found.');
  const lead = await wixData.get(COLLECTIONS.leads, r.leadId, AUTH);
  const next = { ...r, reply: cleanText(reply, 3000), respondedAt: now() };
  let headline;
  if (action === 'confirm' && r.type === 'hold') {
    const holds = await getActiveHolds();
    if (holds.some((h) => h.productId === r.productId && h._id !== r._id)) throw new Error('This print is already held for someone else.');
    next.status = 'confirmed';
    next.holdExpiresAt = holdExpiry();
    headline = `${r.printTitle} is held for you for 48 hours`;
  } else if (action === 'confirm' && r.status === 'accepted') {
    next.status = 'confirmed';
    headline = `Your purchase of ${r.printTitle} at £${r.counterPrice} is confirmed`;
  } else if (action === 'confirm' && r.type === 'offer') {
    next.status = 'confirmed';
    headline = `Your offer on ${r.printTitle} has been accepted`;
  } else if (action === 'counter' && r.type === 'offer') {
    const price = Math.round(Number(counterPrice));
    if (!(price > (r.offerPrice || 0))) throw new Error('A counter-offer should be above the visitor’s offer.');
    if (r.listPrice && price >= r.listPrice) throw new Error('A counter-offer should be below the listed price.');
    next.status = 'countered';
    next.counterPrice = price;
    headline = `The Studio has replied to your offer on ${r.printTitle}`;
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
  if (lead && lead.status === 'new') await wixData.update(COLLECTIONS.leads, { ...lead, status: next.status === 'countered' ? 'negotiating' : 'contacted' }, AUTH);
  await updateVisitor({ lead, print: r.printTitle, headline, reply: next.reply + (next.counterPrice && next.status === 'countered' ? ` We can offer it to you at £${next.counterPrice}.` : '') });
  return saved;
});

// ---------- Insights ----------

export const getInsights = webMethod(Permissions.Admin, async (days = 30) => {
  const since = new Date(Date.now() - Math.min(Number(days) || 30, 365) * 86400000);
  const [events, requests, leads, tours] = await Promise.all([
    queryAll(wixData.query(COLLECTIONS.events).gt('_createdDate', since)),
    queryAll(wixData.query(COLLECTIONS.requests).gt('_createdDate', since)),
    queryAll(wixData.query(COLLECTIONS.leads).gt('firstSeenAt', since)),
    queryAll(wixData.query(COLLECTIONS.tours)),
  ]);
  const perPrint = {};
  const bump = (id, k, v = 1) => {
    if (!id) return;
    const s = perPrint[id] = perPrint[id] || { opens: 0, dwellSec: 0, audioPlays: 0, audioCompletes: 0, viewInRoom: 0, shortlists: 0, basket: 0, requests: 0 };
    s[k] += v;
  };
  const tourStats = {};
  for (const e of events) {
    if (e.type === 'print_open') bump(e.productId, 'opens');
    if (e.type === 'print_dwell') bump(e.productId, 'dwellSec', e.value || 0);
    if (e.type === 'audio_play') bump(e.productId, 'audioPlays');
    if (e.type === 'audio_progress' && e.value >= 100) bump(e.productId, 'audioCompletes');
    if (e.type === 'view_in_room') bump(e.productId, 'viewInRoom');
    if (e.type === 'shortlist_add') bump(e.productId, 'shortlists');
    if (e.type === 'add_to_basket') bump(e.productId, 'basket');
    if (e.type === 'tour_start' || e.type === 'tour_complete') {
      const t = tourStats[e.tourSlug] = tourStats[e.tourSlug] || { starts: 0, completes: 0 };
      t[e.type === 'tour_start' ? 'starts' : 'completes'] += 1;
    }
  }
  for (const r of requests) parseIds(r.productIds).forEach((id) => bump(id, 'requests'));
  const products = await getProducts(Object.keys(perPrint));
  const visitors = new Set(events.map((e) => e.visitorId));
  return {
    days: Number(days) || 30,
    visitors: visitors.size,
    sessions: new Set(events.map((e) => e.sessionId).filter(Boolean)).size,
    storiesPlayed: events.filter((e) => e.type === 'audio_play').length,
    basketAdds: events.filter((e) => e.type === 'add_to_basket').length,
    newLeads: leads.length,
    requests: requests.length,
    leadRate: visitors.size ? leads.length / visitors.size : 0,
    prints: Object.entries(perPrint).map(([id, s]) => ({ productId: id, title: products.get(id) ? products.get(id).name : 'Removed print', ...s }))
      .sort((a, b) => (b.dwellSec + b.requests * 600) - (a.dwellSec + a.requests * 600)),
    tours: tours.map((t) => ({ slug: t.slug, title: t.title, ...(tourStats[t.slug] || { starts: 0, completes: 0 }) })),
  };
});
