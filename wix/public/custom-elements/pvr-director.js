// <pvr-director> - the Studio's console for Private Viewing Rooms.
// Lives on an admin-only dashboard page. Talks to the backend the same way as
// <pvr-room>: "pvr-rpc" events answered via the "rpc-result" attribute, or an
// element.rpcHandler for local previews.

const MAX_PRINTS = 8;
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = (n) => Number(n || 0).toLocaleString('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 });
const day = (d) => (d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '-');
const stamp = (d) => (d ? new Date(d).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '-');
const isoDate = (d) => (d ? new Date(d).toISOString().slice(0, 10) : '');
const mins = (s) => (s >= 60 ? `${Math.round(s / 60)} min` : `${Math.round(s || 0)} s`);
const sizeStr = (v) => (Array.isArray(v) ? v.join(' x ') : v || '');

const STYLE = `
:host { all: initial; display: block; font: 14px/1.5 Inter, system-ui, -apple-system, sans-serif; color: #1d1b18; }
* { box-sizing: border-box; }
.app { background: #f6f4f0; min-height: 100%; padding: 24px; }
h1 { font-size: 22px; margin: 0 0 4px; }
h2 { font-size: 17px; margin: 0 0 12px; }
h3 { font-size: 14px; margin: 18px 0 8px; text-transform: uppercase; letter-spacing: .06em; color: #6b645a; }
.sub { color: #6b645a; margin: 0 0 18px; }
.tabs { display: flex; gap: 4px; border-bottom: 1px solid #e2ddd4; margin-bottom: 20px; flex-wrap: wrap; }
.tab { border: 0; background: none; padding: 10px 14px; font: inherit; cursor: pointer; color: #6b645a; border-bottom: 2px solid transparent; }
.tab.on { color: #1d1b18; border-color: #a77b3a; font-weight: 600; }
.count { background: #a77b3a; color: #fff; border-radius: 999px; padding: 0 7px; font-size: 11px; margin-left: 4px; }
.card { background: #fff; border: 1px solid #e7e2d9; border-radius: 12px; padding: 18px; margin-bottom: 14px; }
.row { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
.spread { justify-content: space-between; }
.grow { flex: 1; min-width: 0; }
button.b { border: 1px solid #cfc6b6; background: #fff; border-radius: 8px; padding: 7px 12px; font: inherit; font-size: 13px; cursor: pointer; color: #1d1b18; }
button.b:hover { background: #f3efe8; }
button.b.primary { background: #1d1b18; border-color: #1d1b18; color: #fff; }
button.b.gold { background: #a77b3a; border-color: #a77b3a; color: #fff; }
button.b.danger { color: #a3392b; border-color: #e6c3bd; }
button.b:disabled { opacity: .5; cursor: default; }
button:focus-visible, input:focus-visible, textarea:focus-visible, select:focus-visible { outline: 2px solid #a77b3a; outline-offset: 2px; }
table { width: 100%; border-collapse: collapse; }
th, td { text-align: left; padding: 9px 8px; border-bottom: 1px solid #efebe4; vertical-align: top; font-size: 13px; }
th { color: #6b645a; font-weight: 600; font-size: 12px; }
td.num, th.num { text-align: right; }
.chip { display: inline-block; font-size: 11px; padding: 2px 8px; border-radius: 999px; background: #efebe4; color: #5a544b; white-space: nowrap; }
.chip.live, .chip.approved, .chip.confirmed, .chip.answered, .chip.ok { background: #e3efe1; color: #2f6b2a; }
.chip.draft, .chip.pending, .chip.warn { background: #f8ecd6; color: #8a5a12; }
.chip.closed, .chip.removed, .chip.declined, .chip.expired, .chip.none { background: #eee; color: #777; }
label.f { display: block; font-size: 12px; color: #6b645a; margin: 10px 0 4px; }
input.t, textarea.t, select.t { width: 100%; border: 1px solid #d9d2c6; border-radius: 8px; padding: 8px 10px; font: inherit; background: #fff; color: #1d1b18; }
textarea.t { min-height: 80px; resize: vertical; }
textarea.script { min-height: 260px; line-height: 1.6; }
.grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 0 16px; }
.grid3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0 12px; }
.item { display: grid; grid-template-columns: 64px 1fr auto; gap: 14px; padding: 14px 0; border-bottom: 1px solid #efebe4; }
.item img, .pick img { width: 64px; height: 78px; object-fit: cover; border-radius: 4px; background: #e7e2d9; }
.picker { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 12px; max-height: 520px; overflow: auto; padding: 4px; }
.pick { border: 1px solid #e7e2d9; border-radius: 10px; padding: 10px; background: #fff; display: grid; grid-template-columns: 64px 1fr; gap: 10px; }
.pick .t1 { font-weight: 600; font-size: 13px; line-height: 1.3; }
.muted { color: #6b645a; font-size: 12px; }
.note { background: #fbf4e6; border: 1px solid #f0dfbd; border-radius: 8px; padding: 8px 10px; font-size: 12px; color: #6d4c12; margin-top: 8px; }
.err { color: #a3392b; font-size: 13px; }
.stats { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; margin-bottom: 8px; }
.stat { background: #faf8f4; border: 1px solid #efebe4; border-radius: 10px; padding: 10px 12px; }
.stat b { display: block; font-size: 20px; }
.toast { position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%); background: #1d1b18; color: #fff; padding: 10px 16px; border-radius: 8px; display: none; z-index: 10; }
.toast.show { display: block; }
.link { font-family: ui-monospace, monospace; font-size: 12px; background: #f3efe8; padding: 4px 8px; border-radius: 6px; word-break: break-all; }
audio { height: 32px; vertical-align: middle; }
.rec { color: #a3392b; font-weight: 600; }
@media (max-width: 760px) { .grid2, .grid3, .stats { grid-template-columns: 1fr; } .item { grid-template-columns: 48px 1fr; } .app { padding: 14px; } }
`;

class PvrDirector extends HTMLElement {
  static get observedAttributes() { return ['rpc-result']; }

  constructor() {
    super();
    this.root = this.attachShadow({ mode: 'open' });
    this.pending = new Map();
    // A host page may set rpcHandler before the element upgrades; keep it.
    if (!Object.prototype.hasOwnProperty.call(this, 'rpcHandler')) this.rpcHandler = null;
    this.state = { tab: 'rooms', rooms: [], requests: [], catalogue: [], room: null, storyFilter: 'all', storyQuery: '', openStory: null, pickQuery: '', pickInStock: true, reqFilter: 'pending' };
  }

  get siteUrl() { return (this.getAttribute('site-url') || 'https://www.jackvettriano.studio').replace(/\/$/, ''); }

  connectedCallback() {
    this.root.innerHTML = `<style>${STYLE}</style><div class="app" id="app"></div><div class="toast" id="toast" role="status"></div>`;
    this.root.addEventListener('click', (e) => this.onClick(e));
    this.root.addEventListener('input', (e) => this.onInput(e));
    this.root.addEventListener('change', (e) => this.onInput(e));
    this.refreshAll();
  }

  attributeChangedCallback(name, _o, value) {
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
      this.dispatchEvent(new CustomEvent('pvr-rpc', { detail: { id, method, args }, bubbles: true, composed: true }));
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
    this.render();
    const [rooms, requests, catalogue] = await Promise.all([
      this.rpc('listRooms'), this.rpc('listRequests', ''), this.rpc('listCatalogue'),
    ]).catch((err) => { this.toast(err.message); return [[], [], []]; });
    Object.assign(this.state, { rooms, requests, catalogue });
    this.render();
  }

  // ---------- rendering ----------
  render() {
    const s = this.state;
    const pending = s.requests.filter((r) => r.status === 'pending').length;
    const app = this.root.getElementById('app');
    app.innerHTML = `
      <h1>Private Viewing Rooms</h1>
      <p class="sub">Curate rooms for individual collectors, answer their requests, and manage the story behind every print.</p>
      <div class="tabs" role="tablist">
        <button class="tab ${s.tab === 'rooms' ? 'on' : ''}" data-tab="rooms" role="tab">Rooms</button>
        <button class="tab ${s.tab === 'requests' ? 'on' : ''}" data-tab="requests" role="tab">Requests${pending ? `<span class="count">${pending}</span>` : ''}</button>
        <button class="tab ${s.tab === 'stories' ? 'on' : ''}" data-tab="stories" role="tab">Story library</button>
      </div>
      <div id="view">${s.tab === 'rooms' ? (s.room ? this.roomEditorHtml() : this.roomsHtml()) : s.tab === 'requests' ? this.requestsHtml() : this.storiesHtml()}</div>`;
  }

  roomsHtml() {
    const rows = this.state.rooms.map((r) => `<tr>
      <td><strong>${esc(r.collectorName)}</strong><div class="muted">${esc(r.collectorEmail || '')}</div></td>
      <td><span class="chip ${esc(r.status)}">${esc(r.status)}</span></td>
      <td class="num">${r.printCount}</td>
      <td class="num">${r.openCount || 0}</td>
      <td>${stamp(r.lastOpenedAt)}</td>
      <td class="num">${r.stats ? mins(r.stats.dwellSec) : '-'}</td>
      <td class="num">${r.stats && r.stats.pending ? `<span class="chip pending">${r.stats.pending}</span>` : '0'}</td>
      <td>${day(r.expiresAt)}</td>
      <td><button class="b" data-edit-room="${esc(r._id)}">Open</button></td>
    </tr>`).join('');
    return `<div class="row spread"><h2>Rooms</h2><button class="b primary" data-new-room>New room</button></div>
      <div class="card" style="overflow:auto">${this.state.rooms.length ? `<table>
        <thead><tr><th>Collector</th><th>Status</th><th class="num">Prints</th><th class="num">Visits</th><th>Last visit</th><th class="num">Time viewing</th><th class="num">Pending</th><th>Closes</th><th></th></tr></thead>
        <tbody>${rows}</tbody></table>` : '<p class="muted">No rooms yet. Create one for your next collector.</p>'}</div>`;
  }

  storyChip(p) {
    const st = p.story;
    if (!st) return '<span class="chip none">No story</span>';
    if (st.status === 'removed') return '<span class="chip removed">Removed</span>';
    if (st.status === 'draft') return '<span class="chip draft">Story in draft</span>';
    return st.audioCurrent ? '<span class="chip approved">Story + audio</span>' : '<span class="chip warn">Approved, no audio</span>';
  }

  roomEditorHtml() {
    const r = this.state.room;
    const byId = new Map(this.state.catalogue.map((p) => [p.productId, p]));
    const items = r.items.map((it, idx) => {
      const p = byId.get(it.productId) || it.product || { title: 'Unknown print' };
      const warn = !p.story || p.story.status !== 'approved'
        ? '<div class="note">This story is not approved yet. The collector will see the print but cannot hear or read its story.</div>' : '';
      return `<div class="item">
        <img src="${esc(p.image || '')}" alt="">
        <div class="grow">
          <div class="row"><strong>${esc(p.title)}</strong> ${this.storyChip(p)} ${p.inStock === false ? '<span class="chip closed">Out of stock</span>' : ''}</div>
          <div class="muted">List price ${money(p.price)}</div>
          ${warn}
          <label class="f">Your note to the collector</label>
          <textarea class="t" data-item="${idx}" data-field="curatorNote" placeholder="Why you chose this for them">${esc(it.curatorNote || '')}</textarea>
          <div class="grid2">
            <div><label class="f">Private offer price (£, optional)</label><input class="t" type="number" min="0" step="5" data-item="${idx}" data-field="offerPrice" value="${it.offerPrice || ''}"></div>
            <div><label class="f">Offer open until</label><input class="t" type="date" data-item="${idx}" data-field="offerExpiresAt" value="${isoDate(it.offerExpiresAt)}"></div>
          </div>
        </div>
        <div class="row" style="flex-direction:column;align-items:stretch">
          <button class="b" data-move="${idx}" data-dir="-1" ${idx === 0 ? 'disabled' : ''} aria-label="Move up">↑</button>
          <button class="b" data-move="${idx}" data-dir="1" ${idx === r.items.length - 1 ? 'disabled' : ''} aria-label="Move down">↓</button>
          <button class="b danger" data-remove-item="${idx}">Remove</button>
        </div>
      </div>`;
    }).join('');

    const inRoom = new Set(r.items.map((i) => i.productId));
    const q = this.state.pickQuery.toLowerCase();
    const picks = this.state.catalogue
      .filter((p) => !inRoom.has(p.productId))
      .filter((p) => !(p.story && p.story.status === 'removed'))
      .filter((p) => !this.state.pickInStock || p.inStock)
      .filter((p) => !q || p.title.toLowerCase().includes(q))
      .map((p) => `<div class="pick"><img src="${esc(p.image)}" alt="" loading="lazy">
        <div><div class="t1">${esc(p.title)}</div><div class="muted">${money(p.price)}${p.ribbon ? ` · ${esc(p.ribbon)}` : ''}</div>
        <div style="margin:6px 0">${this.storyChip(p)}</div>
        <button class="b" data-add-item="${esc(p.productId)}" ${r.items.length >= MAX_PRINTS ? 'disabled' : ''}>Add to room</button></div></div>`).join('');

    const url = r._id ? `${this.siteUrl}${r.url}` : '';
    const a = r.analytics || {};
    const room = a._room || {};
    const totalDwell = Object.values(a).reduce((t, x) => t + (x.dwellSec || 0), 0);
    const plays = Object.values(a).reduce((t, x) => t + (x.audioPlays || 0), 0);
    const analytics = r._id ? `<div class="card"><h2>Engagement</h2>
      <div class="stats">
        <div class="stat"><span class="muted">Visits</span><b>${r.openCount || 0}</b></div>
        <div class="stat"><span class="muted">First opened</span><b style="font-size:14px">${stamp(r.firstOpenedAt)}</b></div>
        <div class="stat"><span class="muted">Time with the prints</span><b>${mins(totalDwell)}</b></div>
        <div class="stat"><span class="muted">Stories played</span><b>${plays}</b></div>
      </div>
      <table><thead><tr><th>Print</th><th class="num">Time viewed</th><th class="num">Story plays</th><th class="num">Furthest listened</th><th class="num">Read story</th><th class="num">On their wall</th></tr></thead><tbody>
      ${r.items.map((it) => { const x = a[it.productId] || {}; const p = byId.get(it.productId) || {}; return `<tr><td>${esc(p.title || '')}</td><td class="num">${mins(x.dwellSec || 0)}</td><td class="num">${x.audioPlays || 0}</td><td class="num">${x.audioMaxPct ? `${x.audioMaxPct}%` : '-'}</td><td class="num">${x.transcriptOpens || 0}</td><td class="num">${x.viewInRoom || 0}</td></tr>`; }).join('')}
      </tbody></table>${room.opens ? '' : '<p class="muted">Analytics appear once the collector opens the room.</p>'}</div>` : '';

    const reqs = (r.requests || []).map((q2) => this.requestCardHtml(q2, true)).join('');

    return `<div class="row spread">
        <div><button class="b" data-back>← All rooms</button></div>
        <div class="row">
          ${r._id ? `<span class="chip ${esc(r.status)}">${esc(r.status)}</span>
            ${r.status !== 'live' ? '<button class="b gold" data-room-status="live">Go live</button>' : ''}
            ${r.status === 'live' ? '<button class="b" data-room-status="closed">Close room</button>' : ''}
            ${r.status === 'closed' ? '<button class="b" data-room-status="draft">Back to draft</button>' : ''}
            <a class="b" style="text-decoration:none;display:inline-block;border:1px solid #cfc6b6;border-radius:8px;padding:7px 12px;color:#1d1b18;font-size:13px" href="${esc(url)}" target="_blank" rel="noopener">Preview</a>` : ''}
          <button class="b primary" data-save-room>Save room</button>
        </div>
      </div>
      ${url ? `<div class="card"><div class="row"><span class="muted">Private link</span><span class="link grow">${esc(url)}</span><button class="b" data-copy="${esc(url)}">Copy link</button></div>
        <p class="muted" style="margin:8px 0 0">${r.status === 'live' ? 'The room is live. Anyone with this link can view it until it closes.' : 'Only you can open this link until the room goes live.'}</p></div>` : ''}
      <div class="card"><h2>Collector</h2>
        <div class="grid3">
          <div><label class="f">Name (as you would greet them)</label><input class="t" data-room-field="collectorName" value="${esc(r.collectorName || '')}" placeholder="Mr & Mrs Johnson"></div>
          <div><label class="f">Email (for replies and hold confirmations)</label><input class="t" type="email" data-room-field="collectorEmail" value="${esc(r.collectorEmail || '')}"></div>
          <div><label class="f">Room open until</label><input class="t" type="date" data-room-field="expiresAt" value="${isoDate(r.expiresAt)}"></div>
        </div>
        <label class="f">Welcome note</label>
        <textarea class="t" data-room-field="greeting" placeholder="A personal note that opens the room">${esc(r.greeting || '')}</textarea>
        <label class="f">Personal voice note (optional)</label>
        <div class="row">
          ${r.greetingAudioUrl ? `<audio controls src="${esc(r.greetingAudioUrl)}"></audio><button class="b danger" data-clear-greeting>Remove</button>` : '<span class="muted">None yet.</span>'}
          <button class="b" data-record>${this.recorder ? '<span class="rec">● Stop recording</span>' : 'Record a voice note'}</button>
          <button class="b" data-upload-audio>Upload audio file</button>
          <input type="file" id="audioFile" accept="audio/mpeg,audio/mp4,audio/x-m4a,audio/wav" hidden>
        </div>
      </div>
      <div class="card"><div class="row spread"><h2>Prints in this room (${r.items.length}/${MAX_PRINTS})</h2><span class="muted">Three to five works feels personal; up to ${MAX_PRINTS} allowed.</span></div>
        ${items || '<p class="muted">No prints yet. Add some from the catalogue below.</p>'}
      </div>
      <div class="card"><div class="row spread"><h2>Add prints</h2>
        <div class="row"><input class="t" style="width:220px" placeholder="Search prints" data-pick-query value="${esc(this.state.pickQuery)}">
        <label class="muted"><input type="checkbox" data-pick-instock ${this.state.pickInStock ? 'checked' : ''}> In stock only</label></div></div>
        <div class="picker">${picks || '<p class="muted">No matching prints.</p>'}</div>
      </div>
      ${reqs ? `<div class="card"><h2>Requests from this collector</h2>${reqs}</div>` : ''}
      ${analytics}`;
  }

  requestCardHtml(r, compact) {
    const kind = { hold: '48-hour hold', question: 'Question', offer: `Accepted offer${r.offerPrice ? ` at ${money(r.offerPrice)}` : ''}` }[r.type];
    const open = r.status === 'pending';
    const actions = open ? `
      <label class="f">Reply to the collector${r.type === 'question' ? '' : ' (optional)'}</label>
      <textarea class="t" id="reply-${esc(r._id)}" placeholder="This appears in their room and is emailed to them"></textarea>
      <div class="row" style="margin-top:8px">
        ${r.type === 'hold' ? `<button class="b gold" data-respond="${esc(r._id)}" data-action="confirm">Confirm 48-hour hold</button>` : ''}
        ${r.type === 'offer' ? `<button class="b gold" data-respond="${esc(r._id)}" data-action="confirm">Confirm sale</button>` : ''}
        ${r.type === 'question' ? `<button class="b gold" data-respond="${esc(r._id)}" data-action="answer">Send reply</button>` : ''}
        ${r.type !== 'question' ? `<button class="b danger" data-respond="${esc(r._id)}" data-action="decline">Decline</button>` : ''}
      </div>` : (r.reply ? `<div class="muted" style="margin-top:6px"><strong>Your reply:</strong> ${esc(r.reply)}</div>` : '');
    return `<div class="card" style="${compact ? 'margin:10px 0;' : ''}">
      <div class="row spread"><div><strong>${esc(kind)}</strong> · ${esc(r.printTitle || '')}${compact ? '' : ` · <span class="muted">${esc(r.collectorName || '')}</span>`}</div>
      <div class="row"><span class="chip ${esc(r.status)}">${esc(r.status)}</span><span class="muted">${stamp(r._createdDate)}</span></div></div>
      ${r.message ? `<p style="margin:8px 0 0">${esc(r.message)}</p>` : ''}
      ${r.type === 'hold' && r.status === 'confirmed' && r.holdExpiresAt ? `<p class="muted">Held until ${stamp(r.holdExpiresAt)}. Released automatically afterwards.</p>` : ''}
      ${!compact && r.roomSlug ? `<p class="muted" style="margin:6px 0 0">Room: ${esc(r.roomSlug)}</p>` : ''}
      ${actions}
    </div>`;
  }

  requestsHtml() {
    const f = this.state.reqFilter;
    const list = this.state.requests.filter((r) => (f === 'pending' ? r.status === 'pending' : true));
    return `<div class="row spread"><h2>Requests</h2>
      <div class="row"><button class="b ${f === 'pending' ? 'primary' : ''}" data-req-filter="pending">Waiting for you</button><button class="b ${f === 'all' ? 'primary' : ''}" data-req-filter="all">All</button></div></div>
      ${list.map((r) => this.requestCardHtml(r, false)).join('') || '<div class="card muted">Nothing waiting. Collectors’ holds, questions and accepted offers will appear here.</div>'}`;
  }

  storiesHtml() {
    const s = this.state;
    const q = s.storyQuery.toLowerCase();
    const counts = { all: 0, approved: 0, draft: 0, none: 0, removed: 0 };
    const status = (p) => (p.story ? p.story.status : 'none');
    for (const p of s.catalogue) { counts[status(p)] += 1; if (status(p) !== 'removed') counts.all += 1; }
    const list = s.catalogue
      .filter((p) => (s.storyFilter === 'all' ? status(p) !== 'removed' : status(p) === s.storyFilter))
      .filter((p) => !q || p.title.toLowerCase().includes(q));
    const rows = list.map((p) => {
      const st = p.story;
      const open = s.openStory === p.productId;
      return `<tr>
        <td><strong>${esc(p.title)}</strong><div class="muted">${money(p.price)}${p.inStock ? '' : ' · out of stock'}${p.ribbon ? ` · ${esc(p.ribbon)}` : ''}</div></td>
        <td>${this.storyChip(p)}</td>
        <td class="num">${st && st.estDurationSec ? `${st.estDurationSec}s` : '-'}</td>
        <td>${st && st.audioUrl ? `<audio controls preload="none" src="${esc(st.audioUrl)}"></audio>${st.audioCurrent ? '' : '<div class="muted">Script changed since recording</div>'}` : '-'}</td>
        <td>${st ? `<button class="b" data-open-story="${esc(p.productId)}">${open ? 'Close' : 'Edit'}</button>`
          : `<button class="b" data-add-story="${esc(p.productId)}">Add to library</button>`}</td>
      </tr>${open && st ? `<tr><td colspan="5">${this.storyEditorHtml(p)}</td></tr>` : ''}`;
    }).join('');
    const tab = (k, label) => `<button class="b ${s.storyFilter === k ? 'primary' : ''}" data-story-filter="${k}">${label} (${counts[k]})</button>`;
    return `<div class="row spread"><h2>Story library</h2><input class="t" style="width:240px" placeholder="Search prints" data-story-query value="${esc(s.storyQuery)}"></div>
      ${s.catalogue.length && !s.catalogue.some((p) => p.story) ? `<div class="card" style="background:#fbf4e6;border-color:#f0dfbd"><div class="row spread"><div><strong>Import the starter stories</strong><div class="muted">Curator scripts for every priced print, written from the Studio's product copy. They arrive as drafts for you to check and approve.</div></div><button class="b gold" data-import-stories>Import stories</button></div></div>` : ''}
      <div class="row" style="margin-bottom:12px">${tab('all', 'In library')}${tab('approved', 'Approved')}${tab('draft', 'Drafts')}${tab('none', 'No story yet')}${tab('removed', 'Removed')}</div>
      <p class="muted">Every priced print in the store is listed. Add a print to write its story; remove one to hide it from the room builder (its story is kept and can be restored).</p>
      <div class="card" style="overflow:auto"><table><thead><tr><th>Print</th><th>Story</th><th class="num">Length</th><th>Audio</th><th></th></tr></thead><tbody>${rows || '<tr><td colspan="5" class="muted">Nothing here.</td></tr>'}</tbody></table></div>`;
  }

  storyEditorHtml(p) {
    const st = p.story;
    const id = esc(st._id);
    return `<div style="padding:8px 0 14px">
      ${st.reviewNotes ? `<div class="note"><strong>Review notes:</strong> ${esc(st.reviewNotes)}</div>` : ''}
      <label class="f">Voice-over script (about 150-200 words; paragraphs become natural pauses)</label>
      <textarea class="t script" data-story="${id}" data-sfield="transcript">${esc(st.transcript)}</textarea>
      <div class="grid3">
        <div><label class="f">Edition</label><input class="t" data-story="${id}" data-sfield="edition" value="${esc(st.edition)}"></div>
        <div><label class="f">Medium</label><input class="t" data-story="${id}" data-sfield="medium" value="${esc(st.medium)}"></div>
        <div><label class="f">Signed by the artist</label><select class="t" data-story="${id}" data-sfield="signed"><option value="true" ${st.signed ? 'selected' : ''}>Yes</option><option value="false" ${st.signed ? '' : 'selected'}>No</option></select></div>
        <div><label class="f">Image size (cm, as "w x h")</label><input class="t" data-story="${id}" data-sfield="imageSizeCm" value="${esc(sizeStr(st.imageSizeCm))}"></div>
        <div><label class="f">Mount size (cm)</label><input class="t" data-story="${id}" data-sfield="mountSizeCm" value="${esc(sizeStr(st.mountSizeCm))}"></div>
        <div><label class="f">Framed size (cm)</label><input class="t" data-story="${id}" data-sfield="framedSizeCm" value="${esc(sizeStr(st.framedSizeCm))}"></div>
      </div>
      <label class="f">Review notes</label>
      <input class="t" data-story="${id}" data-sfield="reviewNotes" value="${esc(st.reviewNotes)}">
      <div class="row" style="margin-top:12px">
        <button class="b primary" data-save-story="${id}">Save</button>
        ${st.status !== 'approved' && st.status !== 'removed' ? `<button class="b gold" data-story-status="${id}" data-status="approved">Approve</button>` : ''}
        ${st.status === 'approved' ? `<button class="b gold" data-gen-audio="${id}">${st.audioUrl ? 'Regenerate audio' : 'Generate audio'}</button>` : ''}
        ${st.status !== 'removed' ? `<button class="b" data-claude="${id}">Draft with Claude</button>` : ''}
        ${st.status === 'removed' ? `<button class="b" data-story-status="${id}" data-status="draft">Restore to library</button>`
          : `<button class="b danger" data-story-status="${id}" data-status="removed">Remove from library</button>`}
      </div>
      <p class="muted">Approve after checking every fact against the product page. Editing an approved script returns it to draft until re-approved, and its audio must be regenerated.</p>
    </div>`;
  }

  // ---------- events ----------
  findStory(storyId) { return this.state.catalogue.find((p) => p.story && p.story._id === storyId); }

  // Reload from the backend so story status and audio freshness are authoritative.
  async reloadCatalogue() {
    this.state.catalogue = await this.rpc('listCatalogue');
  }

  collectStoryChanges(storyId) {
    const changes = {};
    this.root.querySelectorAll(`[data-story="${CSS.escape(storyId)}"]`).forEach((el) => {
      changes[el.dataset.sfield] = el.dataset.sfield === 'signed' ? el.value === 'true' : el.value;
    });
    return changes;
  }

  async openRoom(id) {
    const detail = await this.run(null, () => this.rpc('getRoomDetail', id));
    if (!detail) return;
    this.state.room = {
      ...detail.room,
      items: detail.items.map((i) => ({ productId: i.productId, curatorNote: i.curatorNote, offerPrice: i.offerPrice, offerExpiresAt: i.offerExpiresAt, product: i.product })),
      requests: detail.requests,
      analytics: detail.analytics,
    };
    this.render();
  }

  async saveRoom(btn) {
    const r = this.state.room;
    const saved = await this.run(btn, async () => {
      const room = await this.rpc('saveRoom', {
        _id: r._id, collectorName: r.collectorName, collectorEmail: r.collectorEmail,
        greeting: r.greeting, greetingAudioUrl: r.greetingAudioUrl, expiresAt: r.expiresAt,
      });
      await this.rpc('setRoomItems', room._id, r.items.map((i) => ({
        productId: i.productId, curatorNote: i.curatorNote, offerPrice: i.offerPrice, offerExpiresAt: i.offerExpiresAt,
      })));
      return room;
    }, 'Room saved');
    if (!saved) return;
    this.state.rooms = await this.rpc('listRooms');
    await this.openRoom(saved._id);
  }

  async uploadAudio(blob, name) {
    const url = await this.rpc('getAudioUploadUrl', blob.type, name);
    const res = await fetch(`${url}?filename=${encodeURIComponent(name)}`, { method: 'PUT', headers: { 'Content-Type': blob.type }, body: blob });
    if (!res.ok) throw new Error(`Upload failed (${res.status})`);
    const { file } = await res.json();
    this.state.room.greetingAudioUrl = file.url;
    this.render();
    this.toast('Voice note added. Save the room to keep it.');
  }

  async toggleRecording() {
    if (this.recorder) {
      const blob = this.recorder.stop();
      this.recorder = null;
      this.render();
      await this.run(null, () => this.uploadAudio(blob, `greeting-${Date.now()}.wav`));
      return;
    }
    try {
      this.recorder = await startWavRecorder();
      this.render();
    } catch (err) {
      this.toast('Microphone unavailable. You can upload an audio file instead.');
    }
  }

  onInput(e) {
    const t = e.target;
    const s = this.state;
    if (t.dataset.roomField) s.room[t.dataset.roomField] = t.value;
    else if (t.dataset.item) {
      const v = t.dataset.field === 'offerPrice' ? (t.value ? Number(t.value) : null) : t.value;
      s.room.items[Number(t.dataset.item)][t.dataset.field] = v;
    } else if ('pickQuery' in t.dataset && e.type === 'input') { s.pickQuery = t.value; this.renderKeepFocus(t); }
    else if ('pickInstock' in t.dataset) { s.pickInStock = t.checked; this.render(); }
    else if ('storyQuery' in t.dataset && e.type === 'input') { s.storyQuery = t.value; this.renderKeepFocus(t); }
    else if (t.id === 'audioFile' && e.type === 'change' && t.files[0]) {
      const f = t.files[0];
      this.run(null, () => this.uploadAudio(f, f.name));
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
    const b = e.target.closest('button, [data-copy]');
    if (!b) return;
    const d = b.dataset;
    const s = this.state;
    if (d.tab) { s.tab = d.tab; s.room = null; this.render(); }
    else if ('newRoom' in d) { s.room = { collectorName: '', collectorEmail: '', greeting: '', expiresAt: new Date(Date.now() + 14 * 86400000).toISOString(), items: [] }; this.render(); }
    else if (d.editRoom) this.openRoom(d.editRoom);
    else if ('back' in d) { s.room = null; this.render(); }
    else if ('saveRoom' in d) this.saveRoom(b);
    else if (d.roomStatus) {
      const saved = await this.run(b, () => this.rpc('setRoomStatus', s.room._id, d.roomStatus), d.roomStatus === 'live' ? 'Room is live' : 'Room updated');
      if (saved) { s.rooms = await this.rpc('listRooms'); await this.openRoom(saved._id); }
    } else if (d.copy) { navigator.clipboard.writeText(d.copy).then(() => this.toast('Link copied')); }
    else if (d.addItem) {
      if (s.room.items.length >= MAX_PRINTS) return;
      s.room.items.push({ productId: d.addItem, curatorNote: '', offerPrice: null, offerExpiresAt: null });
      this.render();
      this.toast('Added. Save the room to publish the change.');
    } else if (d.removeItem) { s.room.items.splice(Number(d.removeItem), 1); this.render(); this.toast('Removed. Save the room to publish the change.'); }
    else if (d.move) {
      const i = Number(d.move);
      const j = i + Number(d.dir);
      [s.room.items[i], s.room.items[j]] = [s.room.items[j], s.room.items[i]];
      this.render();
    } else if ('record' in d) this.toggleRecording();
    else if ('uploadAudio' in d) this.root.getElementById('audioFile').click();
    else if ('clearGreeting' in d) { s.room.greetingAudioUrl = ''; this.render(); }
    else if (d.reqFilter) { s.reqFilter = d.reqFilter; this.render(); }
    else if (d.respond) {
      const reply = (this.root.getElementById(`reply-${d.respond}`) || {}).value || '';
      const saved = await this.run(b, () => this.rpc('respondToRequest', d.respond, d.action, reply), 'Collector updated');
      if (saved) {
        s.requests = await this.rpc('listRequests', '');
        if (s.room && s.room._id) await this.openRoom(s.room._id); else this.render();
      }
    } else if ('importStories' in d) {
      const res = await this.run(b, () => this.rpc('importStarterStories'));
      if (res) { await this.reloadCatalogue(); this.toast(`Imported ${res.imported} stories as drafts`); this.render(); }
    } else if (d.storyFilter) { s.storyFilter = d.storyFilter; this.render(); }
    else if (d.openStory) { s.openStory = s.openStory === d.openStory ? null : d.openStory; this.render(); }
    else if (d.addStory) {
      const saved = await this.run(b, () => this.rpc('addStory', d.addStory), 'Added to the story library');
      if (saved) { await this.reloadCatalogue(); s.openStory = saved.productId; s.storyFilter = 'all'; this.render(); }
    } else if (d.saveStory) {
      const saved = await this.run(b, () => this.rpc('saveStory', d.saveStory, this.collectStoryChanges(d.saveStory)), 'Story saved');
      if (saved) { await this.reloadCatalogue(); this.render(); }
    } else if (d.storyStatus) {
      if (d.status === 'approved') {
        const changes = this.collectStoryChanges(d.storyStatus);
        const saved = await this.run(b, () => this.rpc('saveStory', d.storyStatus, changes));
        if (!saved) return;
      }
      const saved = await this.run(b, () => this.rpc('setStoryStatus', d.storyStatus, d.status),
        { approved: 'Approved. Collectors can now read it.', removed: 'Removed from the library', draft: 'Restored to the library' }[d.status]);
      if (saved) { await this.reloadCatalogue(); if (d.status === 'removed') s.openStory = null; this.render(); }
    } else if (d.genAudio) {
      b.textContent = 'Generating… (about 20 seconds)';
      const saved = await this.run(b, () => this.rpc('generateStoryAudio', d.genAudio), 'Audio ready');
      if (saved) await this.reloadCatalogue();
      this.render();
    } else if (d.claude) {
      const st = this.findStory(d.claude).story;
      if (st.transcript && !window.confirm('Replace the current script with a new Claude draft?')) return;
      b.textContent = 'Drafting…';
      const saved = await this.run(b, () => this.rpc('draftStoryWithClaude', d.claude), 'Draft ready. Check every fact before approving.');
      if (saved) await this.reloadCatalogue();
      this.render();
    }
  }
}

// Minimal mono 16 kHz WAV recorder. Wix Media accepts WAV, unlike browser-native WebM.
async function startWavRecorder() {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const ctx = new AudioContext();
  const source = ctx.createMediaStreamSource(stream);
  const node = ctx.createScriptProcessor(4096, 1, 1);
  const chunks = [];
  node.onaudioprocess = (e) => chunks.push(new Float32Array(e.inputBuffer.getChannelData(0)));
  source.connect(node);
  node.connect(ctx.destination);
  return {
    stop() {
      node.disconnect(); source.disconnect(); stream.getTracks().forEach((t) => t.stop());
      const rate = 16000;
      const ratio = ctx.sampleRate / rate;
      const input = chunks.reduce((acc, c) => { const out = new Float32Array(acc.length + c.length); out.set(acc); out.set(c, acc.length); return out; }, new Float32Array(0));
      const len = Math.floor(input.length / ratio);
      const buf = new DataView(new ArrayBuffer(44 + len * 2));
      const str = (o, s) => [...s].forEach((ch, i) => buf.setUint8(o + i, ch.charCodeAt(0)));
      str(0, 'RIFF'); buf.setUint32(4, 36 + len * 2, true); str(8, 'WAVE'); str(12, 'fmt ');
      buf.setUint32(16, 16, true); buf.setUint16(20, 1, true); buf.setUint16(22, 1, true);
      buf.setUint32(24, rate, true); buf.setUint32(28, rate * 2, true); buf.setUint16(32, 2, true); buf.setUint16(34, 16, true);
      str(36, 'data'); buf.setUint32(40, len * 2, true);
      for (let i = 0; i < len; i += 1) {
        const v = Math.max(-1, Math.min(1, input[Math.floor(i * ratio)]));
        buf.setInt16(44 + i * 2, v < 0 ? v * 0x8000 : v * 0x7fff, true);
      }
      ctx.close();
      return new Blob([buf], { type: 'audio/wav' });
    },
  };
}

if (!customElements.get('pvr-director')) customElements.define('pvr-director', PvrDirector);
