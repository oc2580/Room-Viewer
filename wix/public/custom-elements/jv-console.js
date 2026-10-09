// <jv-console> - the Studio's console for the Interactive Gallery.
// Lives on an admin-only dashboard page. Talks to the backend through
// "jv-rpc" events answered via the "rpc-result" attribute, or an
// element.rpcHandler for local previews. The page sets "ready" when listening.

const MAX_TOUR_PRINTS = 10;
const THEMES = ['By the sea', 'After dark', 'Romance', 'Quiet moments', 'Style & society', 'Portraits', 'Final editions', 'Rare editions'];
const LEAD_STATUSES = { new: 'New', contacted: 'Contacted', negotiating: 'Negotiating', won: 'Won', lost: 'Lost' };
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = (n) => Number(n || 0).toLocaleString('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 });
const stamp = (d) => (d ? new Date(d).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '-');
const mins = (s) => (s >= 3600 ? `${(s / 3600).toFixed(1)} h` : s >= 60 ? `${Math.round(s / 60)} min` : `${Math.round(s || 0)} s`);
const pct = (x) => `${Math.round((x || 0) * 100)}%`;
const heat = (score) => (score >= 60 ? ['hot', 'Hot'] : score >= 25 ? ['warm', 'Warm'] : ['cool', 'Browsing']);

const STYLE = `
:host { all: initial; display: block; font: 14px/1.5 Inter, system-ui, -apple-system, sans-serif; color: #1d1b18;
  --bg: #f6f4f0; --card: #fff; --line: #e7e2d9; --soft: #efebe4; --muted: #6b645a; --ink: #1d1b18; --accent: #a77b3a; --accent-soft: #f6ead6;
  --ok-bg: #e3efe1; --ok: #2f6b2a; --warn-bg: #f8ecd6; --warn: #8a5a12; --bad-bg: #f6e1dc; --bad: #a3392b; }
* { box-sizing: border-box; }
.app { background: var(--bg); min-height: 100%; padding: 24px; }
h1 { font-size: 22px; margin: 0 0 4px; }
h2 { font-size: 17px; margin: 0 0 12px; }
h3 { font-size: 12px; margin: 18px 0 8px; text-transform: uppercase; letter-spacing: .06em; color: var(--muted); }
.sub { color: var(--muted); margin: 0 0 18px; }
.tabs { display: flex; gap: 4px; border-bottom: 1px solid var(--line); margin-bottom: 20px; flex-wrap: wrap; }
.tab { border: 0; background: none; padding: 10px 14px; font: inherit; cursor: pointer; color: var(--muted); border-bottom: 2px solid transparent; }
.tab.on { color: var(--ink); border-color: var(--accent); font-weight: 600; }
.count { background: var(--accent); color: #fff; border-radius: 999px; padding: 0 7px; font-size: 11px; margin-left: 4px; }
.card { background: var(--card); border: 1px solid var(--line); border-radius: 12px; padding: 18px; margin-bottom: 14px; }
.row { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
.spread { justify-content: space-between; }
.grow { flex: 1; min-width: 0; }
button.b, a.b { border: 1px solid #cfc6b6; background: #fff; border-radius: 8px; padding: 7px 12px; font: inherit; font-size: 13px; cursor: pointer; color: var(--ink); text-decoration: none; display: inline-block; }
button.b:hover { background: #f3efe8; }
button.b.primary { background: var(--ink); border-color: var(--ink); color: #fff; }
button.b.gold { background: var(--accent); border-color: var(--accent); color: #fff; }
button.b.danger { color: var(--bad); border-color: #e6c3bd; }
button.b:disabled { opacity: .5; cursor: default; }
button:focus-visible, input:focus-visible, textarea:focus-visible, select:focus-visible, a:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.scroll { overflow-x: auto; }
table { width: 100%; border-collapse: collapse; }
th, td { text-align: left; padding: 9px 8px; border-bottom: 1px solid var(--soft); vertical-align: top; font-size: 13px; }
th { color: var(--muted); font-weight: 600; font-size: 12px; white-space: nowrap; }
td.num, th.num { text-align: right; font-variant-numeric: tabular-nums; }
tr.click { cursor: pointer; }
tr.click:hover td { background: #faf8f4; }
.chip { display: inline-block; font-size: 11px; padding: 2px 8px; border-radius: 999px; background: var(--soft); color: #5a544b; white-space: nowrap; }
.chip.live, .chip.approved, .chip.confirmed, .chip.answered, .chip.won, .chip.ok { background: var(--ok-bg); color: var(--ok); }
.chip.draft, .chip.pending, .chip.warn, .chip.countered, .chip.negotiating, .chip.warm { background: var(--warn-bg); color: var(--warn); }
.chip.hot, .chip.accepted { background: var(--accent); color: #fff; }
.chip.declined, .chip.expired, .chip.removed, .chip.lost, .chip.none, .chip.declined_by_visitor, .chip.cool { background: #eee; color: #777; }
label.f { display: block; font-size: 12px; color: var(--muted); margin: 10px 0 4px; }
input.t, textarea.t, select.t { width: 100%; border: 1px solid #d9d2c6; border-radius: 8px; padding: 8px 10px; font: inherit; background: #fff; color: var(--ink); }
textarea.t { min-height: 80px; resize: vertical; }
textarea.script { min-height: 260px; line-height: 1.6; }
.grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 0 16px; }
.grid3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0 12px; }
.cols { display: grid; grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr); gap: 14px; align-items: start; }
.muted { color: var(--muted); font-size: 12px; }
.note { background: #fbf4e6; border: 1px solid #f0dfbd; border-radius: 8px; padding: 8px 10px; font-size: 12px; color: #6d4c12; margin-top: 8px; }
.next { background: var(--accent-soft); border-radius: 10px; padding: 12px 14px; margin-bottom: 14px; }
.stats { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; margin-bottom: 14px; }
.stat { background: var(--card); border: 1px solid var(--line); border-radius: 10px; padding: 12px 14px; }
.stat b { display: block; font-size: 24px; font-variant-numeric: tabular-nums; }
.stat .muted { display: block; }
.barcell { display: flex; align-items: center; gap: 8px; justify-content: flex-end; }
.bar { height: 6px; border-radius: 0 3px 3px 0; background: var(--accent); min-width: 2px; }
.pick { display: grid; grid-template-columns: 44px 1fr auto; gap: 10px; align-items: center; padding: 8px 0; border-bottom: 1px solid var(--soft); }
.pick img { width: 44px; height: 54px; object-fit: cover; border-radius: 3px; background: var(--line); }
.picker { max-height: 420px; overflow: auto; }
.themes { display: flex; flex-wrap: wrap; gap: 6px 12px; }
.themes label { font-size: 13px; display: inline-flex; gap: 5px; align-items: center; }
.toast { position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%); background: var(--ink); color: #fff; padding: 10px 16px; border-radius: 8px; display: none; z-index: 10; max-width: calc(100% - 32px); }
.toast.show { display: block; }
audio { height: 32px; vertical-align: middle; max-width: 100%; }
.empty { padding: 14px 0; color: var(--muted); }
@media (max-width: 860px) { .grid2, .grid3, .cols { grid-template-columns: 1fr; } .stats { grid-template-columns: 1fr 1fr; } .app { padding: 14px; } }
`;

class JvConsole extends HTMLElement {
  static get observedAttributes() { return ['rpc-result', 'ready']; }

  constructor() {
    super();
    this.root = this.attachShadow({ mode: 'open' });
    if (!Object.prototype.hasOwnProperty.call(this, 'rpcHandler')) this.rpcHandler = null;
    this.pending = new Map();
    this.s = {
      tab: 'leads', leads: [], requests: [], catalogue: [], tours: [], insights: null, days: 30,
      lead: null, tour: null, storyFilter: 'all', storyQuery: '', openStory: null, reqFilter: 'waiting', pickQuery: '',
    };
  }

  connectedCallback() {
    this.root.innerHTML = `<style>${STYLE}</style><div class="app" id="app"><p class="muted">Loading…</p></div><div class="toast" id="toast" role="status"></div>`;
    this.root.addEventListener('click', (e) => this.onClick(e));
    this.root.addEventListener('input', (e) => this.onInput(e));
    this.root.addEventListener('change', (e) => this.onInput(e));
    this.root.addEventListener('keydown', (e) => {
      if ((e.key === 'Enter' || e.key === ' ') && e.target.matches && e.target.matches('tr.click')) { e.preventDefault(); this.onClick(e); }
    });
    queueMicrotask(() => { if (this.rpcHandler || this.hasAttribute('ready')) this.refreshAll(); });
  }

  attributeChangedCallback(name, _o, value) {
    if (name === 'ready' && value !== null && this.isConnected && !this.loaded) this.refreshAll();
    if (name !== 'rpc-result' || !value) return;
    const res = JSON.parse(value);
    const p = this.pending.get(res.id);
    if (!p) return;
    this.pending.delete(res.id);
    if (res.ok) p.resolve(res.result); else p.reject(new Error(res.error || 'Request failed'));
  }

  rpc(method, ...args) {
    if (this.rpcHandler) return this.rpcHandler(method, args);
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.dispatchEvent(new CustomEvent('jv-rpc', { detail: { id, method, args }, bubbles: true, composed: true }));
      setTimeout(() => { if (this.pending.delete(id)) reject(new Error('Timed out. Please try again.')); }, 120000);
    });
  }

  toast(msg) {
    const t = this.root.getElementById('toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(this.tt);
    this.tt = setTimeout(() => t.classList.remove('show'), 3500);
  }

  async run(btn, fn, okMsg) {
    if (btn) btn.disabled = true;
    try {
      const out = await fn();
      if (okMsg) this.toast(okMsg);
      return out;
    } catch (err) {
      this.toast(err.message);
      return undefined;
    } finally {
      if (btn && btn.isConnected) btn.disabled = false;
    }
  }

  async refreshAll() {
    this.loaded = true;
    try {
      const [leads, requests, catalogue, tours, insights] = await Promise.all([
        this.rpc('listLeads'), this.rpc('listRequests', ''), this.rpc('listCatalogue'), this.rpc('listTours'), this.rpc('getInsights', this.s.days),
      ]);
      Object.assign(this.s, { leads, requests, catalogue, tours, insights });
    } catch (err) {
      this.toast(err.message);
    }
    this.render();
  }

  byId(id) { return this.s.catalogue.find((p) => p.productId === id); }

  waiting() { return this.s.requests.filter((r) => r.status === 'pending' || r.status === 'accepted'); }

  // ---------- rendering ----------
  render() {
    const s = this.s;
    const w = this.waiting().length;
    const tabs = [['leads', 'Leads'], ['requests', 'Requests'], ['tours', 'Tours'], ['stories', 'Story library'], ['insights', 'Insights']];
    let view;
    if (s.tab === 'leads') view = s.lead ? this.leadHtml() : this.leadsHtml();
    else if (s.tab === 'requests') view = this.requestsHtml();
    else if (s.tab === 'tours') view = s.tour ? this.tourEditorHtml() : this.toursHtml();
    else if (s.tab === 'stories') view = this.storiesHtml();
    else view = this.insightsHtml();
    this.root.getElementById('app').innerHTML = `
      <h1>Gallery</h1>
      <p class="sub">Who is looking at what, the requests waiting for you, and the stories and tours visitors see.</p>
      <div class="tabs" role="tablist">${tabs.map(([k, l]) => `<button class="tab ${s.tab === k ? 'on' : ''}" role="tab" aria-selected="${s.tab === k}" data-tab="${k}">${l}${k === 'requests' && w ? `<span class="count">${w}</span>` : ''}</button>`).join('')}</div>
      <div>${view}</div>`;
  }

  // ----- leads -----
  leadsHtml() {
    const rows = this.s.leads.map((l) => {
      const [cls, label] = heat(l.score);
      return `<tr class="click" data-lead="${esc(l._id)}" tabindex="0">
        <td><strong>${esc(l.name)}</strong><div class="muted">${esc(l.email)}${l.phone ? ` · ${esc(l.phone)}` : ''}</div></td>
        <td><span class="chip ${cls}" title="Engagement score ${l.score}">${label}</span></td>
        <td><span class="chip ${esc(l.status)}">${esc(LEAD_STATUSES[l.status] || l.status)}</span></td>
        <td class="num">${l.pending ? `<span class="chip pending">${l.pending} waiting</span>` : l.requests}</td>
        <td class="num">${l.shortlist}</td>
        <td class="num">${l.storiesPlayed}</td>
        <td>${stamp(l.lastSeenAt)}</td>
      </tr>`;
    }).join('');
    return `<div class="card scroll">${this.s.leads.length ? `<table>
      <thead><tr><th>Visitor</th><th>Interest</th><th>Status</th><th class="num">Requests</th><th class="num">Shortlisted</th><th class="num">Stories heard</th><th>Last seen</th></tr></thead>
      <tbody>${rows}</tbody></table>` : '<p class="empty">No leads yet. Visitors become leads when they reserve a print, make an offer or ask a question.</p>'}</div>
      <p class="muted">Interest is ranked from what visitors do in the gallery: listening to stories, viewing prints on their wall, shortlisting and sending requests. Activity is only recorded for visitors who accept analytics cookies.</p>`;
  }

  suggestion(d) {
    const accepted = d.requests.find((r) => r.status === 'accepted');
    if (accepted) return `They accepted your counter-offer of ${money(accepted.counterPrice)} for ${esc(accepted.printTitle)}. Confirm the sale and send an invoice.`;
    const pending = d.requests.find((r) => r.status === 'pending');
    if (pending) return `Reply to their ${pending.type === 'hold' ? 'reservation request' : pending.type} about ${esc(pending.printTitle)}.`;
    const top = d.prints.find((p) => p.viewInRoom || p.audioMaxPct >= 100) || d.prints[0];
    if (top) return `Most interest is in ${esc(top.title)}${top.viewInRoom ? `, which they put on their wall ${top.viewInRoom} time${top.viewInRoom === 1 ? '' : 's'}` : ''}. A call about framing or a private price could help them decide.`;
    return 'Thank them for their enquiry and ask what they are looking for.';
  }

  leadHtml() {
    const d = this.s.lead;
    const l = d.lead;
    const [cls, label] = heat(d.score);
    return `<div class="row spread" style="margin-bottom:12px"><button class="b" data-back-lead>← All leads</button>
      <div class="row"><label class="muted" for="leadStatus">Status</label><select class="t" style="width:auto" id="leadStatus">${Object.entries(LEAD_STATUSES).map(([k, v]) => `<option value="${k}" ${l.status === k ? 'selected' : ''}>${v}</option>`).join('')}</select></div></div>
      <div class="card"><div class="row spread"><div><h2 style="margin:0">${esc(l.name)}</h2>
        <div class="muted">${esc(l.email)}${l.phone ? ` · ${esc(l.phone)}` : ''} · first seen ${stamp(l.firstSeenAt)} · last seen ${stamp(l.lastSeenAt)}</div></div>
        <span class="chip ${cls}">${label} · score ${d.score}</span></div></div>
      <div class="next"><strong>Suggested next step:</strong> ${this.suggestion(d)}</div>
      <div class="cols">
        <div>
          <div class="card"><h2>Requests</h2>${d.requests.map((r) => this.requestCardHtml({ ...r, leadName: l.name, leadEmail: l.email, leadPhone: l.phone }, true)).join('') || '<p class="empty">No requests.</p>'}</div>
          <div class="card scroll"><h2>What they looked at</h2>${d.prints.length ? `<table><thead><tr><th>Print</th><th class="num">Time</th><th class="num">Story</th><th class="num">On wall</th><th class="num">Basket</th></tr></thead><tbody>
            ${d.prints.map((p) => `<tr><td>${esc(p.title)}</td><td class="num">${mins(p.dwellSec)}</td><td class="num">${p.audioPlays ? `${p.audioMaxPct || 0}%` : '-'}</td><td class="num">${p.viewInRoom || '-'}</td><td class="num">${p.basket || '-'}</td></tr>`).join('')}
            </tbody></table>` : '<p class="empty">No activity recorded (they may not have accepted analytics cookies).</p>'}
            ${d.tours.length ? `<p class="muted">Tours started: ${esc(d.tours.map((slug) => (this.s.tours.find((t) => t.slug === slug) || { title: slug }).title).join(', '))}</p>` : ''}
          </div>
        </div>
        <div>
          <div class="card"><h2>Shortlist</h2>${d.shortlist.length ? d.shortlist.map((p) => `<div class="row spread" style="padding:6px 0;border-bottom:1px solid var(--soft)"><span>${esc(p.title)}</span><span class="muted">${p.price ? money(p.price) : ''}</span></div>`).join('') : '<p class="empty">Nothing shortlisted.</p>'}</div>
          <div class="card"><h2>Notes</h2><textarea class="t" id="leadNotes" placeholder="Calls, preferences, framing, budget">${esc(l.notes || '')}</textarea>
            <div style="margin-top:8px"><button class="b primary" data-save-notes>Save notes</button></div></div>
        </div>
      </div>`;
  }

  // ----- requests -----
  requestCardHtml(r, compact) {
    const kind = { hold: '48-hour reservation', question: 'Question', offer: 'Offer', shortlist: 'Shortlist enquiry' }[r.type];
    const share = r.offerPrice && r.listPrice ? ` (${pct(r.offerPrice / r.listPrice)} of ${money(r.listPrice)})` : '';
    const prints = r.type === 'shortlist' ? (r.productIds || []).map((id) => (this.byId(id) || { title: 'Removed print' }).title).join(', ') : '';
    const id = esc(r._id);
    let actions = '';
    if (r.status === 'pending' || r.status === 'accepted') {
      actions = `<label class="f" for="reply-${id}">Reply${r.type === 'question' || r.type === 'shortlist' ? '' : ' (optional)'}: shown in their gallery and emailed</label>
        <textarea class="t" id="reply-${id}"></textarea>
        ${r.type === 'offer' && r.status === 'pending' ? `<label class="f" for="counter-${id}">Counter-offer (£), between their offer and the list price</label><input class="t" type="number" id="counter-${id}" style="max-width:200px" min="${(r.offerPrice || 0) + 5}" step="5">` : ''}
        <div class="row" style="margin-top:8px">
          ${r.type === 'hold' ? `<button class="b gold" data-respond="${id}" data-action="confirm">Confirm 48-hour reservation</button><button class="b danger" data-respond="${id}" data-action="decline">Decline</button>` : ''}
          ${r.type === 'offer' && r.status === 'pending' ? `<button class="b gold" data-respond="${id}" data-action="confirm">Accept ${money(r.offerPrice)}</button><button class="b" data-respond="${id}" data-action="counter">Send counter-offer</button><button class="b danger" data-respond="${id}" data-action="decline">Decline</button>` : ''}
          ${r.status === 'accepted' ? `<button class="b gold" data-respond="${id}" data-action="confirm">Confirm sale at ${money(r.counterPrice)}</button>` : ''}
          ${r.type === 'question' || r.type === 'shortlist' ? `<button class="b gold" data-respond="${id}" data-action="answer">Send reply</button>` : ''}
        </div>`;
    } else if (r.reply || r.counterPrice) {
      actions = `<p class="muted" style="margin:6px 0 0">${r.counterPrice ? `Counter-offer ${money(r.counterPrice)}. ` : ''}${r.reply ? `Your reply: ${esc(r.reply)}` : ''}</p>`;
    }
    return `<div class="card" style="${compact ? 'margin:10px 0;box-shadow:none' : ''}">
      <div class="row spread"><div><strong>${kind}${r.type === 'offer' ? ` · ${money(r.offerPrice)}${share}` : ''}</strong> · ${esc(r.printTitle)}</div>
        <div class="row"><span class="chip ${esc(r.status)}">${esc(r.status === 'accepted' ? 'counter accepted' : r.status.replace(/_/g, ' '))}</span><span class="muted">${stamp(r._createdDate)}</span></div></div>
      ${compact ? '' : `<div class="muted">${esc(r.leadName)} · ${esc(r.leadEmail)}${r.leadPhone ? ` · ${esc(r.leadPhone)}` : ''} · <button class="b" style="padding:2px 8px" data-lead="${esc(r.leadId)}">View lead</button></div>`}
      ${prints ? `<p class="muted" style="margin:6px 0 0">Prints: ${esc(prints)}</p>` : ''}
      ${r.message ? `<p style="margin:8px 0 0">${esc(r.message)}</p>` : ''}
      ${r.type === 'hold' && r.status === 'confirmed' && r.holdExpiresAt ? `<p class="muted">Reserved until ${stamp(r.holdExpiresAt)}; released automatically after that.</p>` : ''}
      ${actions}
    </div>`;
  }

  requestsHtml() {
    const f = this.s.reqFilter;
    const list = f === 'waiting' ? this.waiting() : this.s.requests;
    return `<div class="row spread"><h2>Requests</h2>
      <div class="row"><button class="b ${f === 'waiting' ? 'primary' : ''}" data-req-filter="waiting">Waiting for you</button><button class="b ${f === 'all' ? 'primary' : ''}" data-req-filter="all">All</button></div></div>
      ${list.map((r) => this.requestCardHtml(r, false)).join('') || '<div class="card empty">Nothing waiting. Reservations, offers and questions from the gallery appear here.</div>'}`;
  }

  // ----- tours -----
  toursHtml() {
    const stats = new Map(((this.s.insights && this.s.insights.tours) || []).map((t) => [t.slug, t]));
    const rows = this.s.tours.map((t) => {
      const st = stats.get(t.slug) || { starts: 0, completes: 0 };
      return `<tr class="click" data-tour="${esc(t._id)}" tabindex="0"><td><strong>${esc(t.title)}</strong><div class="muted">${esc(t.intro).slice(0, 110)}</div></td>
        <td><span class="chip ${esc(t.status)}">${t.status === 'live' ? 'Live' : 'Draft'}</span></td>
        <td class="num">${t.productIds.length}</td><td class="num">${st.starts}</td><td class="num">${st.starts ? pct(st.completes / st.starts) : '-'}</td></tr>`;
    }).join('');
    return `<div class="row spread"><h2>Guided tours</h2><button class="b primary" data-new-tour>New tour</button></div>
      <div class="card scroll">${this.s.tours.length ? `<table><thead><tr><th>Tour</th><th>Status</th><th class="num">Prints</th><th class="num">Started (${this.s.days} days)</th><th class="num">Finished</th></tr></thead><tbody>${rows}</tbody></table>`
        : '<p class="empty">No tours yet. Import the starter content from the Story library, or create one.</p>'}</div>`;
  }

  tourEditorHtml() {
    const t = this.s.tour;
    const inTour = new Set(t.productIds);
    const q = this.s.pickQuery.toLowerCase();
    const approved = this.s.catalogue.filter((p) => p.story && p.story.status === 'approved');
    const picks = approved.filter((p) => !inTour.has(p.productId) && (!q || p.title.toLowerCase().includes(q) || (p.story.themes || '').toLowerCase().includes(q)));
    return `<div class="row spread" style="margin-bottom:12px"><button class="b" data-back-tour>← All tours</button>
      <div class="row">${t._id ? `<span class="chip ${esc(t.status)}">${t.status === 'live' ? 'Live' : 'Draft'}</span>
        <button class="b ${t.status === 'live' ? '' : 'gold'}" data-tour-status="${t.status === 'live' ? 'draft' : 'live'}">${t.status === 'live' ? 'Unpublish' : 'Publish'}</button>
        <button class="b danger" data-delete-tour>${this.confirmDelete ? 'Confirm delete' : 'Delete'}</button>` : ''}
        <button class="b primary" data-save-tour>Save tour</button></div></div>
      <div class="card"><label class="f" for="tTitle">Title</label><input class="t" id="tTitle" value="${esc(t.title)}">
        <label class="f" for="tIntro">Introduction (shown before the tour starts)</label><textarea class="t" id="tIntro">${esc(t.intro || '')}</textarea></div>
      <div class="cols">
        <div class="card"><h2>In this tour (${t.productIds.length}/${MAX_TOUR_PRINTS})</h2>
          ${t.productIds.map((id, i) => { const p = this.byId(id) || { title: 'Removed print', image: '' }; return `<div class="pick"><img src="${esc(p.image)}" alt=""><div><strong>${i + 1}. ${esc(p.title)}</strong><div class="muted">${money(p.price)}${p.story && p.story.status !== 'approved' ? ' · story not approved, hidden from visitors' : ''}</div></div>
            <div class="row"><button class="b" data-tmove="${i}" data-dir="-1" ${i === 0 ? 'disabled' : ''} aria-label="Move up">↑</button><button class="b" data-tmove="${i}" data-dir="1" ${i === t.productIds.length - 1 ? 'disabled' : ''} aria-label="Move down">↓</button><button class="b danger" data-tremove="${i}">Remove</button></div></div>`; }).join('') || '<p class="empty">Add prints from the list.</p>'}
          <p class="muted">Stories play in this order, with a short pause between prints.</p></div>
        <div class="card"><div class="row spread"><h2>Add prints</h2><input class="t" style="max-width:200px" placeholder="Search title or theme" data-pick-query value="${esc(this.s.pickQuery)}"></div>
          <div class="picker">${picks.map((p) => `<div class="pick"><img src="${esc(p.image)}" alt="" loading="lazy"><div><strong>${esc(p.title)}</strong><div class="muted">${money(p.price)} · ${esc(p.story.themes || 'no theme')}${p.inStock ? '' : ' · sold out'}</div></div>
            <button class="b" data-tadd="${esc(p.productId)}" ${t.productIds.length >= MAX_TOUR_PRINTS ? 'disabled' : ''}>Add</button></div>`).join('') || '<p class="empty">No matching approved prints.</p>'}</div></div>
      </div>`;
  }

  // ----- story library -----
  storyChip(p) {
    const st = p.story;
    if (!st) return '<span class="chip none">No story</span>';
    if (st.status === 'removed') return '<span class="chip removed">Hidden</span>';
    if (st.status === 'draft') return '<span class="chip draft">Draft, not on show</span>';
    return st.audioCurrent ? '<span class="chip approved">On show with audio</span>' : '<span class="chip warn">On show, no audio yet</span>';
  }

  storiesHtml() {
    const s = this.s;
    const q = s.storyQuery.toLowerCase();
    const status = (p) => (p.story ? p.story.status : 'none');
    const counts = { all: 0, approved: 0, draft: 0, none: 0, removed: 0 };
    for (const p of s.catalogue) { counts[status(p)] += 1; if (status(p) !== 'removed') counts.all += 1; }
    const list = s.catalogue
      .filter((p) => (s.storyFilter === 'all' ? status(p) !== 'removed' : status(p) === s.storyFilter))
      .filter((p) => !q || p.title.toLowerCase().includes(q));
    const tab = (k, label) => `<button class="b ${s.storyFilter === k ? 'primary' : ''}" data-story-filter="${k}">${label} (${counts[k]})</button>`;
    const rows = list.map((p) => {
      const st = p.story;
      const open = s.openStory === p.productId;
      return `<tr><td><strong>${esc(p.title)}</strong><div class="muted">${money(p.price)}${p.inStock ? '' : ' · sold out'}${st && st.themes ? ` · ${esc(st.themes)}` : ''}</div></td>
        <td>${this.storyChip(p)}</td>
        <td class="num">${st && st.estDurationSec ? `${st.estDurationSec}s` : '-'}</td>
        <td>${st && st.audioUrl ? `<audio controls preload="none" src="${esc(st.audioUrl)}"></audio>${st.audioCurrent ? '' : '<div class="muted">Script changed since recording</div>'}` : '-'}</td>
        <td>${st ? `<button class="b" data-open-story="${esc(p.productId)}">${open ? 'Close' : 'Edit'}</button>` : `<button class="b" data-add-story="${esc(p.productId)}">Add to gallery</button>`}</td>
      </tr>${open && st ? `<tr><td colspan="5">${this.storyEditorHtml(p)}</td></tr>` : ''}`;
    }).join('');
    return `${s.catalogue.length && !s.catalogue.some((p) => p.story) ? `<div class="card" style="background:#fbf4e6;border-color:#f0dfbd"><div class="row spread"><div><strong>Import the starter content</strong><div class="muted">68 curator scripts with themes, and five guided tours. Everything arrives as a draft for you to check, approve and publish.</div></div><button class="b gold" data-import>Import</button></div></div>` : ''}
      <div class="row spread"><h2>Story library</h2><input class="t" style="max-width:240px" placeholder="Search prints" data-story-query value="${esc(s.storyQuery)}"></div>
      <div class="row" style="margin-bottom:12px">${tab('all', 'All')}${tab('approved', 'On show')}${tab('draft', 'Drafts')}${tab('none', 'No story yet')}${tab('removed', 'Hidden')}</div>
      <p class="muted">A print appears in the gallery once its story is approved. Hide a print to take it out of the gallery and tours; its story is kept and can be restored.</p>
      <div class="card scroll"><table><thead><tr><th>Print</th><th>In the gallery</th><th class="num">Length</th><th>Audio</th><th></th></tr></thead><tbody>${rows || '<tr><td colspan="5" class="empty">Nothing here.</td></tr>'}</tbody></table></div>`;
  }

  storyEditorHtml(p) {
    const st = p.story;
    const id = esc(st._id);
    const themes = String(st.themes || '').split(',').map((x) => x.trim());
    return `<div style="padding:8px 0 14px">
      ${st.reviewNotes ? `<div class="note"><strong>Review notes:</strong> ${esc(st.reviewNotes)}</div>` : ''}
      <label class="f">Voice-over script (about 150-200 words; paragraphs become natural pauses)</label>
      <textarea class="t script" data-story="${id}" data-sfield="transcript">${esc(st.transcript)}</textarea>
      <label class="f">Themes (used for gallery filters and tours)</label>
      <div class="themes">${THEMES.map((t) => `<label><input type="checkbox" data-theme-box="${id}" value="${esc(t)}" ${themes.includes(t) ? 'checked' : ''}> ${esc(t)}</label>`).join('')}</div>
      <div class="grid3">
        <div><label class="f">Edition</label><input class="t" data-story="${id}" data-sfield="edition" value="${esc(st.edition)}"></div>
        <div><label class="f">Medium</label><input class="t" data-story="${id}" data-sfield="medium" value="${esc(st.medium)}"></div>
        <div><label class="f">Signed by the artist</label><select class="t" data-story="${id}" data-sfield="signed"><option value="true" ${st.signed ? 'selected' : ''}>Yes</option><option value="false" ${st.signed ? '' : 'selected'}>No</option></select></div>
        <div><label class="f">Image size (cm)</label><input class="t" data-story="${id}" data-sfield="imageSizeCm" value="${esc(st.imageSizeCm)}"></div>
        <div><label class="f">Mount size (cm)</label><input class="t" data-story="${id}" data-sfield="mountSizeCm" value="${esc(st.mountSizeCm)}"></div>
        <div><label class="f">Framed size (cm)</label><input class="t" data-story="${id}" data-sfield="framedSizeCm" value="${esc(st.framedSizeCm)}"></div>
      </div>
      <label class="f">Review notes</label><input class="t" data-story="${id}" data-sfield="reviewNotes" value="${esc(st.reviewNotes)}">
      <div class="row" style="margin-top:12px">
        <button class="b primary" data-save-story="${id}">Save</button>
        ${st.status === 'draft' ? `<button class="b gold" data-story-status="${id}" data-status="approved">Approve and show in gallery</button>` : ''}
        ${st.status === 'approved' ? `<button class="b gold" data-gen-audio="${id}">${st.audioUrl ? 'Regenerate audio' : 'Generate audio'}</button>` : ''}
        ${st.status !== 'removed' ? `<button class="b" data-claude="${id}">${this.confirmClaude === id ? 'Replace script with a new draft?' : 'Draft with Claude'}</button>` : ''}
        ${st.status === 'removed' ? `<button class="b" data-story-status="${id}" data-status="draft">Restore</button>` : `<button class="b danger" data-story-status="${id}" data-status="removed">Hide from gallery</button>`}
      </div>
      <p class="muted">Approve only after checking every fact against the product page. Editing an approved script takes it out of the gallery until you approve it again, and its audio must be regenerated.</p>
    </div>`;
  }

  // ----- insights -----
  insightsHtml() {
    const d = this.s.insights;
    if (!d) return '<p class="empty">No data yet.</p>';
    const max = Math.max(1, ...d.prints.map((p) => p.dwellSec));
    return `<div class="row spread"><h2>Insights</h2><select class="t" style="width:auto" id="days" aria-label="Period">${[7, 30, 90].map((n) => `<option value="${n}" ${d.days === n ? 'selected' : ''}>Last ${n} days</option>`).join('')}</select></div>
      <div class="stats">
        <div class="stat"><span class="muted">Visitors</span><b>${d.visitors}</b><span class="muted">${d.sessions} visits</span></div>
        <div class="stat"><span class="muted">Stories played</span><b>${d.storiesPlayed}</b></div>
        <div class="stat"><span class="muted">Added to basket</span><b>${d.basketAdds}</b></div>
        <div class="stat"><span class="muted">New leads</span><b>${d.newLeads}</b><span class="muted">${pct(d.leadRate)} of visitors · ${d.requests} requests</span></div>
      </div>
      <div class="card scroll"><h2>Prints by attention</h2><p class="muted" style="margin:-6px 0 8px">Ranked by time viewed, with each request counting as ten minutes.</p>${d.prints.length ? `<table><thead><tr><th>Print</th><th class="num">Time viewed</th><th class="num">Opened</th><th class="num">Stories finished</th><th class="num">On a wall</th><th class="num">Shortlisted</th><th class="num">Basket</th><th class="num">Requests</th></tr></thead><tbody>
        ${d.prints.slice(0, 25).map((p) => `<tr><td>${esc(p.title)}</td>
          <td class="num"><div class="barcell" title="${esc(p.title)}: ${mins(p.dwellSec)} viewed"><div class="bar" style="width:${Math.round((p.dwellSec / max) * 90)}px"></div><span>${mins(p.dwellSec)}</span></div></td>
          <td class="num">${p.opens}</td><td class="num">${p.audioPlays ? `${p.audioCompletes} of ${p.audioPlays}` : '-'}</td><td class="num">${p.viewInRoom}</td><td class="num">${p.shortlists}</td><td class="num">${p.basket}</td><td class="num">${p.requests}</td></tr>`).join('')}
        </tbody></table>` : '<p class="empty">Nothing recorded in this period.</p>'}</div>
      <div class="card scroll"><h2>Tours</h2><table><thead><tr><th>Tour</th><th class="num">Started</th><th class="num">Finished</th><th class="num">Completion</th></tr></thead><tbody>
        ${d.tours.map((t) => `<tr><td>${esc(t.title)}</td><td class="num">${t.starts}</td><td class="num">${t.completes}</td><td class="num">${t.starts ? pct(t.completes / t.starts) : '-'}</td></tr>`).join('')}
      </tbody></table></div>
      <p class="muted">Viewing, listening and basket figures cover visitors who accepted analytics cookies. Leads and requests are counted for everyone.</p>`;
  }

  // ---------- events ----------
  async openLead(id) {
    const detail = await this.run(null, () => this.rpc('getLeadDetail', id));
    if (!detail) return;
    this.s.tab = 'leads';
    this.s.lead = detail;
    this.render();
  }

  async reloadAfterRequest() {
    const [requests, leads] = await Promise.all([this.rpc('listRequests', ''), this.rpc('listLeads')]);
    Object.assign(this.s, { requests, leads });
    if (this.s.lead) await this.openLead(this.s.lead.lead._id); else this.render();
  }

  collectStoryChanges(storyId) {
    const changes = {};
    this.root.querySelectorAll(`[data-story="${CSS.escape(storyId)}"]`).forEach((el) => {
      changes[el.dataset.sfield] = el.dataset.sfield === 'signed' ? el.value === 'true' : el.value;
    });
    const boxes = [...this.root.querySelectorAll(`[data-theme-box="${CSS.escape(storyId)}"]`)];
    if (boxes.length) changes.themes = boxes.filter((b) => b.checked).map((b) => b.value).join(', ');
    return changes;
  }

  onInput(e) {
    const t = e.target;
    if ('pickQuery' in t.dataset && e.type === 'input') { this.s.pickQuery = t.value; this.renderKeepFocus(t); }
    else if ('storyQuery' in t.dataset && e.type === 'input') { this.s.storyQuery = t.value; this.renderKeepFocus(t); }
    else if (t.id === 'tTitle') this.s.tour.title = t.value;
    else if (t.id === 'tIntro') this.s.tour.intro = t.value;
    else if (t.id === 'leadStatus' && e.type === 'change') {
      this.run(null, () => this.rpc('updateLead', this.s.lead.lead._id, { status: t.value }), 'Status updated').then((saved) => {
        if (saved) { this.s.lead.lead.status = saved.status; this.rpc('listLeads').then((leads) => { this.s.leads = leads; }); }
      });
    } else if (t.id === 'days' && e.type === 'change') {
      this.s.days = Number(t.value);
      this.run(null, () => this.rpc('getInsights', this.s.days)).then((ins) => { if (ins) { this.s.insights = ins; this.render(); } });
    }
  }

  renderKeepFocus(input) {
    const key = Object.keys(input.dataset)[0];
    const pos = input.selectionStart;
    this.render();
    const el = this.root.querySelector(`[data-${key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}]`);
    if (el) { el.focus(); el.setSelectionRange(pos, pos); }
  }

  async onClick(e) {
    const row = e.target.closest('tr[data-lead], tr[data-tour]');
    const b = e.target.closest('button') || row;
    if (!b) return;
    const d = b.dataset;
    const s = this.s;
    if (d.deleteTour === undefined) this.confirmDelete = false;
    if (d.claude === undefined) this.confirmClaude = null;
    if (d.tab) { s.tab = d.tab; s.lead = null; s.tour = null; this.render(); }
    else if (d.lead) this.openLead(d.lead);
    else if ('backLead' in d) { s.lead = null; this.render(); }
    else if ('saveNotes' in d) {
      const notes = this.root.getElementById('leadNotes').value;
      const saved = await this.run(b, () => this.rpc('updateLead', s.lead.lead._id, { notes }), 'Notes saved');
      if (saved) s.lead.lead.notes = saved.notes;
    } else if (d.reqFilter) { s.reqFilter = d.reqFilter; this.render(); }
    else if (d.respond) {
      const reply = (this.root.getElementById(`reply-${d.respond}`) || {}).value || '';
      const counter = (this.root.getElementById(`counter-${d.respond}`) || {}).value || '';
      if (d.action === 'counter' && !counter) { this.toast('Enter the counter-offer amount first.'); return; }
      const saved = await this.run(b, () => this.rpc('respondToRequest', d.respond, d.action, reply, Number(counter) || null),
        { confirm: 'Confirmed. The visitor has been told.', decline: 'Declined. The visitor has been told.', answer: 'Reply sent', counter: 'Counter-offer sent' }[d.action]);
      if (saved) await this.reloadAfterRequest();
    } else if (d.tour && row) {
      const t = s.tours.find((x) => x._id === d.tour);
      s.tour = { ...t, productIds: [...t.productIds] };
      s.pickQuery = '';
      this.render();
    } else if ('newTour' in d) { s.tour = { title: '', intro: '', productIds: [], status: 'draft' }; s.pickQuery = ''; this.render(); }
    else if ('backTour' in d) { s.tour = null; this.render(); }
    else if (d.tadd) { s.tour.productIds.push(d.tadd); this.render(); }
    else if (d.tremove) { s.tour.productIds.splice(Number(d.tremove), 1); this.render(); }
    else if (d.tmove) {
      const i = Number(d.tmove); const j = i + Number(d.dir);
      [s.tour.productIds[i], s.tour.productIds[j]] = [s.tour.productIds[j], s.tour.productIds[i]];
      this.render();
    } else if ('saveTour' in d) {
      const saved = await this.run(b, () => this.rpc('saveTour', { _id: s.tour._id, title: s.tour.title, intro: s.tour.intro, productIds: s.tour.productIds }), 'Tour saved');
      if (saved) { s.tours = await this.rpc('listTours'); s.tour = s.tours.find((t) => t._id === saved._id); s.tour = { ...s.tour, productIds: [...s.tour.productIds] }; this.render(); }
    } else if (d.tourStatus) {
      const saved = await this.run(b, () => this.rpc('setTourStatus', s.tour._id, d.tourStatus), d.tourStatus === 'live' ? 'Tour is live in the gallery' : 'Tour unpublished');
      if (saved) { s.tours = await this.rpc('listTours'); s.tour.status = saved.status; this.render(); }
    } else if ('deleteTour' in d) {
      if (!this.confirmDelete) { this.confirmDelete = true; this.render(); return; }
      this.confirmDelete = false;
      const ok = await this.run(b, () => this.rpc('deleteTour', s.tour._id), 'Tour deleted');
      if (ok) { s.tours = await this.rpc('listTours'); s.tour = null; this.render(); }
    } else if ('import' in d) {
      const res = await this.run(b, () => this.rpc('importStarterContent'));
      if (res) {
        [s.catalogue, s.tours] = await Promise.all([this.rpc('listCatalogue'), this.rpc('listTours')]);
        this.toast(`Imported ${res.stories} stories and ${res.tours} tours as drafts`);
        this.render();
      }
    } else if (d.storyFilter) { s.storyFilter = d.storyFilter; this.render(); }
    else if (d.openStory) { s.openStory = s.openStory === d.openStory ? null : d.openStory; this.render(); }
    else if (d.addStory) {
      const saved = await this.run(b, () => this.rpc('addStory', d.addStory), 'Added. Write or draft its story, then approve it.');
      if (saved) { s.catalogue = await this.rpc('listCatalogue'); s.openStory = saved.productId; s.storyFilter = 'all'; this.render(); }
    } else if (d.saveStory) {
      const saved = await this.run(b, () => this.rpc('saveStory', d.saveStory, this.collectStoryChanges(d.saveStory)), 'Story saved');
      if (saved) { s.catalogue = await this.rpc('listCatalogue'); this.render(); }
    } else if (d.storyStatus) {
      if (d.status === 'approved' && !(await this.run(b, () => this.rpc('saveStory', d.storyStatus, this.collectStoryChanges(d.storyStatus))))) return;
      const saved = await this.run(b, () => this.rpc('setStoryStatus', d.storyStatus, d.status),
        { approved: 'Approved. The print is now in the gallery.', removed: 'Hidden from the gallery', draft: 'Restored as a draft' }[d.status]);
      if (saved) { s.catalogue = await this.rpc('listCatalogue'); if (d.status === 'removed') s.openStory = null; this.render(); }
    } else if (d.genAudio) {
      b.textContent = 'Generating… (about 20 seconds)';
      const saved = await this.run(b, () => this.rpc('generateStoryAudio', d.genAudio), 'Audio ready');
      if (saved) s.catalogue = await this.rpc('listCatalogue');
      this.render();
    } else if (d.claude) {
      const st = this.s.catalogue.find((p) => p.story && p.story._id === d.claude).story;
      if (st.transcript && this.confirmClaude !== d.claude) { this.confirmClaude = d.claude; this.render(); return; }
      this.confirmClaude = null;
      b.textContent = 'Drafting…';
      const saved = await this.run(b, () => this.rpc('draftStoryWithClaude', d.claude), 'Draft ready. Check every fact before approving.');
      if (saved) s.catalogue = await this.rpc('listCatalogue');
      this.render();
    }
  }
}

if (!customElements.get('jv-console')) customElements.define('jv-console', JvConsole);
