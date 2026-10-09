// <pvr-room> - the collector's Private Viewing Room.
//
// Data in:  attribute "room" = JSON from the router (backend/pvr-lib buildRoomPayload).
// Calls out: dispatches "pvr-rpc" events { id, method, args }; the page code runs
//            the backend web method and answers via attribute "rpc-result".
//            A host page can instead set element.rpcHandler = async (method, args) => result.
// Optional attribute "speech-fallback": read scripts with the browser's voice
//            when a print has no recorded audio yet (preview/demo only).

const FONT_HREF = 'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,500;0,600;1,500&family=Inter:wght@400;500;600&display=swap';
const FLUSH_MS = 15000;
const FRAME_STYLES = {
  black: { label: 'Black', color: '#1b1918', edge: '#000' },
  walnut: { label: 'Walnut', color: '#5a3b26', edge: '#3d2717' },
  gilt: { label: 'Gilt', color: '#b8954f', edge: '#8a6c33' },
  ivory: { label: 'Ivory', color: '#efe8da', edge: '#cfc6b4' },
};
const WALLS = ['#e9e2d6', '#c9d0c8', '#2f3a40', '#7a2e2a'];

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = (n) => Number(n).toLocaleString('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 });
const when = (d) => new Date(d).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
const day = (d) => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
const clock = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const paragraphs = (t) => String(t || '').split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
const sizeText = (s) => (s ? `${s[0]} × ${s[1]} cm` : '');

const STYLE = `
:host { all: initial; display: block; font-family: Inter, system-ui, sans-serif; color: var(--ivory); }
* { box-sizing: border-box; }
:host {
  --ink: #15120f; --panel: #1e1a16; --panel2: #262019; --ivory: #f3ece0; --muted: #b8ad9b;
  --brass: #c89d5c; --brass2: #e0bb80; --line: rgba(243,236,224,.13); --ok: #8fbf8a; --warn: #e3b25f;
}
.room { background: var(--ink); min-height: 100%; padding-bottom: 64px; }
.wrap { max-width: 1180px; margin: 0 auto; padding: 0 24px; }
.serif { font-family: 'Cormorant Garamond', Georgia, serif; }
.banner { background: var(--brass); color: #1a140c; text-align: center; font-size: 13px; padding: 8px 16px; font-weight: 600; }
header.hero { padding: 72px 0 48px; border-bottom: 1px solid var(--line); }
.eyebrow { letter-spacing: .22em; text-transform: uppercase; font-size: 11px; color: var(--brass); font-weight: 600; }
h1 { font-family: 'Cormorant Garamond', Georgia, serif; font-weight: 500; font-size: clamp(38px, 6vw, 64px); line-height: 1.05; margin: 14px 0 18px; }
.greeting { max-width: 680px; color: var(--muted); font-size: 17px; line-height: 1.7; white-space: pre-line; }
.meta { margin-top: 22px; color: var(--muted); font-size: 13px; display: flex; gap: 18px; flex-wrap: wrap; }
.chapter { display: grid; grid-template-columns: minmax(0, 1.05fr) minmax(0, 1fr); gap: 56px; padding: 64px 0; border-bottom: 1px solid var(--line); align-items: start; }
.figure { position: sticky; top: 24px; }
.figure img { width: 100%; height: auto; display: block; box-shadow: 0 30px 60px rgba(0,0,0,.45); background: #2a241d; }
.figure .num { margin-top: 14px; color: var(--muted); font-size: 12px; letter-spacing: .18em; text-transform: uppercase; }
h2 { font-family: 'Cormorant Garamond', Georgia, serif; font-weight: 500; font-size: 40px; line-height: 1.1; margin: 8px 0 12px; }
.badges { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 18px; }
.badge { border: 1px solid var(--line); border-radius: 999px; font-size: 11px; padding: 4px 10px; color: var(--muted); letter-spacing: .04em; }
.badge.gold { border-color: var(--brass); color: var(--brass2); }
.price { font-size: 22px; margin: 6px 0 4px; }
.price s { color: var(--muted); font-size: 16px; margin-right: 10px; }
.offer-note { color: var(--brass2); font-size: 13px; }
.status { margin: 14px 0 0; font-size: 13px; display: flex; align-items: center; gap: 8px; color: var(--muted); }
.dot { width: 8px; height: 8px; border-radius: 50%; background: var(--muted); flex: none; }
.status.available .dot { background: var(--ok); }
.status.held_by_you .dot, .status.hold_pending .dot { background: var(--brass); }
.status.reserved .dot, .status.out_of_stock .dot { background: #8a7f70; }
.player { margin: 28px 0 8px; background: var(--panel); border: 1px solid var(--line); border-radius: 14px; padding: 16px 18px; display: grid; grid-template-columns: 48px 1fr; gap: 14px; align-items: center; }
.play { width: 48px; height: 48px; border-radius: 50%; border: 0; background: var(--brass); color: #1a140c; cursor: pointer; display: grid; place-items: center; }
.play:hover { background: var(--brass2); }
.play:focus-visible, button:focus-visible, summary:focus-visible { outline: 2px solid var(--brass2); outline-offset: 3px; }
.play svg { width: 18px; height: 18px; }
.ptitle { font-size: 13px; font-weight: 600; }
.psub { font-size: 12px; color: var(--muted); margin-top: 2px; }
.bar { height: 4px; background: rgba(243,236,224,.15); border-radius: 4px; margin-top: 10px; cursor: pointer; position: relative; }
.bar i { position: absolute; inset: 0 auto 0 0; width: 0; background: var(--brass); border-radius: 4px; }
.linkbtn { background: none; border: 0; color: var(--brass2); cursor: pointer; font: inherit; font-size: 13px; padding: 6px 0; text-decoration: underline; text-underline-offset: 3px; }
.transcript { display: none; margin: 8px 0 0; padding: 4px 0 0 18px; border-left: 2px solid var(--line); }
.transcript.open { display: block; }
.transcript p { color: var(--muted); line-height: 1.75; font-size: 15px; margin: 0 0 14px; transition: color .3s; }
.transcript p.on { color: var(--ivory); }
.note { margin: 24px 0 0; padding: 18px 20px; background: var(--panel2); border-radius: 12px; }
.note .who { font-size: 11px; letter-spacing: .18em; text-transform: uppercase; color: var(--brass); margin-bottom: 8px; font-weight: 600; }
.note p { margin: 0; font-family: 'Cormorant Garamond', Georgia, serif; font-size: 20px; line-height: 1.5; font-style: italic; white-space: pre-line; }
details.prov { margin-top: 22px; border-top: 1px solid var(--line); border-bottom: 1px solid var(--line); }
details.prov summary { cursor: pointer; padding: 14px 0; font-size: 13px; font-weight: 600; list-style: none; display: flex; justify-content: space-between; }
details.prov summary::after { content: '+'; color: var(--brass); font-size: 18px; line-height: 1; }
details.prov[open] summary::after { content: '–'; }
dl { display: grid; grid-template-columns: 140px 1fr; gap: 10px 16px; margin: 0 0 18px; font-size: 14px; }
dt { color: var(--muted); }
dd { margin: 0; }
.actions { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 26px; }
.btn { border: 1px solid var(--brass); background: transparent; color: var(--ivory); padding: 12px 18px; border-radius: 999px; font: inherit; font-size: 14px; cursor: pointer; }
.btn:hover { background: rgba(200,157,92,.12); }
.btn.solid { background: var(--brass); color: #1a140c; font-weight: 600; }
.btn.solid:hover { background: var(--brass2); }
.btn[disabled] { opacity: .45; cursor: default; }
.history { margin-top: 22px; display: grid; gap: 10px; }
.req { font-size: 13px; padding: 12px 14px; border: 1px solid var(--line); border-radius: 10px; }
.req .row { display: flex; justify-content: space-between; gap: 12px; color: var(--muted); }
.req .msg { margin-top: 6px; }
.req .reply { margin-top: 8px; padding-top: 8px; border-top: 1px dashed var(--line); color: var(--ivory); }
.chip { font-size: 11px; padding: 2px 8px; border-radius: 999px; background: rgba(243,236,224,.08); }
.chip.confirmed, .chip.answered { background: rgba(143,191,138,.18); color: var(--ok); }
.chip.pending { background: rgba(227,178,95,.16); color: var(--warn); }
footer { padding: 56px 0 0; color: var(--muted); font-size: 14px; line-height: 1.7; }
footer a { color: var(--brass2); }
.closed { padding: 120px 24px; text-align: center; }
.closed p { color: var(--muted); max-width: 520px; margin: 0 auto; line-height: 1.7; }
.modal { position: fixed; inset: 0; background: rgba(8,6,4,.78); display: none; align-items: center; justify-content: center; padding: 16px; z-index: 50; }
.modal.open { display: flex; }
.sheet { background: var(--panel); border: 1px solid var(--line); border-radius: 16px; width: min(560px, 100%); max-height: calc(100vh - 32px); overflow: auto; padding: 26px; }
.sheet.wide { width: min(1100px, 100%); }
.sheet h3 { font-family: 'Cormorant Garamond', Georgia, serif; font-weight: 500; font-size: 30px; margin: 0 0 8px; }
.sheet p { color: var(--muted); line-height: 1.6; margin: 0 0 16px; font-size: 14px; }
textarea { width: 100%; min-height: 120px; background: var(--ink); color: var(--ivory); border: 1px solid var(--line); border-radius: 10px; padding: 12px; font: inherit; font-size: 14px; resize: vertical; }
.sheet .actions { justify-content: flex-end; }
.err { color: #f0a08e; font-size: 13px; margin-top: 10px; min-height: 1em; }
.toast { position: fixed; left: 50%; bottom: 24px; transform: translateX(-50%) translateY(120px); background: var(--ivory); color: #1a140c; padding: 12px 18px; border-radius: 999px; font-size: 14px; transition: transform .3s; z-index: 60; box-shadow: 0 10px 30px rgba(0,0,0,.35); max-width: calc(100% - 32px); }
.toast.show { transform: translateX(-50%) translateY(0); }
.vir-grid { display: grid; grid-template-columns: minmax(0, 1fr) 240px; gap: 20px; }
.stage { position: relative; aspect-ratio: 16 / 10; overflow: hidden; border-radius: 10px; background: #e9e2d6; touch-action: none; user-select: none; }
.stage .floor { position: absolute; left: 0; right: 0; bottom: 0; height: 9%; background: linear-gradient(#8b6a4c, #6d5039); }
.stage .skirting { position: absolute; left: 0; right: 0; bottom: 9%; height: 1.4%; background: rgba(255,255,255,.55); }
.stage .photo { position: absolute; inset: 0; background-size: cover; background-position: center; }
.stage svg.sofa { position: absolute; bottom: 9%; left: 50%; transform: translateX(-50%); }
.art { position: absolute; cursor: grab; box-shadow: 0 14px 24px rgba(0,0,0,.35); }
.art:active { cursor: grabbing; }
.art .mount { position: absolute; background: #f6f2ea; }
.art img { position: absolute; width: 100%; height: 100%; object-fit: cover; pointer-events: none; }
.controls label { display: block; font-size: 12px; color: var(--muted); margin: 14px 0 6px; }
.swatches { display: flex; gap: 8px; flex-wrap: wrap; }
.sw { width: 30px; height: 30px; border-radius: 50%; border: 2px solid transparent; cursor: pointer; }
.sw.on { border-color: var(--brass2); }
.seg { display: flex; flex-wrap: wrap; gap: 6px; }
.seg button { border: 1px solid var(--line); background: none; color: var(--ivory); border-radius: 999px; padding: 6px 10px; font: inherit; font-size: 12px; cursor: pointer; }
.seg button.on { border-color: var(--brass); color: var(--brass2); }
input[type=range] { width: 100%; accent-color: var(--brass); }
.small { font-size: 12px; color: var(--muted); line-height: 1.5; margin-top: 12px; }
@media (max-width: 860px) {
  .chapter { grid-template-columns: 1fr; gap: 28px; padding: 44px 0; }
  .figure { position: static; }
  .vir-grid { grid-template-columns: 1fr; }
  dl { grid-template-columns: 110px 1fr; }
  header.hero { padding: 48px 0 36px; }
  .wrap { padding: 0 16px; }
}
@media (prefers-reduced-motion: reduce) { .toast, .transcript p { transition: none; } }
`;

const ICON_PLAY = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 4.5v15l13-7.5z"/></svg>';
const ICON_PAUSE = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M6 4h4v16H6zM14 4h4v16h-4z"/></svg>';

class PvrRoom extends HTMLElement {
  static get observedAttributes() { return ['room', 'rpc-result']; }

  constructor() {
    super();
    this.root = this.attachShadow({ mode: 'open' });
    this.pending = new Map();
    this.queue = [];
    this.dwell = new Map();
    this.sessionId = Math.random().toString(36).slice(2, 12);
    this.players = new Map();
    this.vir = null;
    this.rpcHandler = null;
  }

  connectedCallback() {
    if (!document.querySelector(`link[href="${FONT_HREF}"]`)) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = FONT_HREF;
      document.head.appendChild(link);
    }
    this.flushTimer = setInterval(() => this.flush(), FLUSH_MS);
    this.onHide = () => { if (document.visibilityState === 'hidden') this.flush(); };
    document.addEventListener('visibilitychange', this.onHide);
    if (this.getAttribute('room')) this.load(this.getAttribute('room'));
  }

  disconnectedCallback() {
    clearInterval(this.flushTimer);
    document.removeEventListener('visibilitychange', this.onHide);
    if (this.observer) this.observer.disconnect();
    this.flush();
  }

  attributeChangedCallback(name, _old, value) {
    if (!value) return;
    if (name === 'room' && this.isConnected) this.load(value);
    if (name === 'rpc-result') {
      const res = JSON.parse(value);
      const p = this.pending.get(res.id);
      if (!p) return;
      this.pending.delete(res.id);
      if (res.ok) p.resolve(res.result); else p.reject(new Error(res.error || 'Something went wrong.'));
    }
  }

  rpc(method, ...args) {
    if (this.rpcHandler) return this.rpcHandler(method, args);
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.dispatchEvent(new CustomEvent('pvr-rpc', { detail: { id, method, args }, bubbles: true, composed: true }));
      setTimeout(() => {
        if (this.pending.delete(id)) reject(new Error('The Studio could not be reached. Please try again.'));
      }, 30000);
    });
  }

  load(json) {
    this.data = JSON.parse(json);
    this.render();
    if (!this.data.closed) this.track('room_open', '', 1);
  }

  // ---------- analytics ----------
  track(type, productId, value) {
    if (!this.data || this.data.preview) return;
    this.queue.push({ type, productId, value, sessionId: this.sessionId });
  }

  flush() {
    const now = Date.now();
    for (const [pid, d] of this.dwell) {
      if (d.since) { d.total += (now - d.since) / 1000; d.since = now; }
      if (d.total >= 1) { this.track('print_dwell', pid, Math.round(d.total)); d.total = 0; }
    }
    if (!this.queue.length || !this.data) return;
    const batch = this.queue.splice(0, 50);
    this.rpc('logEvents', batch).catch(() => {});
  }

  observeDwell() {
    if (this.observer) this.observer.disconnect();
    this.observer = new IntersectionObserver((entries) => {
      const now = Date.now();
      for (const e of entries) {
        const pid = e.target.dataset.pid;
        const d = this.dwell.get(pid) || { total: 0, since: 0 };
        if (e.isIntersecting && !d.since) d.since = now;
        if (!e.isIntersecting && d.since) { d.total += (now - d.since) / 1000; d.since = 0; }
        this.dwell.set(pid, d);
      }
    }, { threshold: 0.5 });
    this.root.querySelectorAll('.chapter').forEach((el) => this.observer.observe(el));
  }

  // ---------- rendering ----------
  render() {
    const d = this.data;
    if (d.closed) {
      this.root.innerHTML = `<style>${STYLE}</style><div class="room"><div class="closed">
        <div class="eyebrow">Jack Vettriano Studio</div>
        <h1>This viewing room has closed</h1>
        <p>Thank you for visiting${d.collectorName ? `, ${esc(d.collectorName)}` : ''}. If you would like to see these works again, or anything else from the collection, we would be delighted to hear from you at <a style="color:var(--brass2)" href="mailto:info@jackvettriano.studio">info@jackvettriano.studio</a>.</p>
      </div></div>`;
      return;
    }
    const { room, prints } = d;
    this.root.innerHTML = `<style>${STYLE}</style>
      <div class="room">
        ${d.preview ? '<div class="banner">Director preview: analytics are paused while you are signed in.</div>' : ''}
        <header class="hero"><div class="wrap">
          <div class="eyebrow">Private viewing · Jack Vettriano Studio</div>
          <h1>A selection for ${esc(room.collectorName)}</h1>
          ${room.greeting ? `<div class="greeting">${esc(room.greeting)}</div>` : ''}
          ${room.greetingAudioUrl ? this.playerHtml('_greeting', 'A note from the Studio', 'Personal message', true) : ''}
          <div class="meta">
            <span>${prints.length} work${prints.length === 1 ? '' : 's'} chosen for you</span>
            ${room.expiresAt ? `<span>Open until ${esc(day(room.expiresAt))}</span>` : ''}
            <span>Each story is about a minute long</span>
          </div>
        </div></header>
        <main class="wrap">${prints.map((p, i) => this.chapterHtml(p, i, prints.length)).join('')}</main>
        <footer class="wrap">
          Every print comes with a certificate of authenticity and fully insured UK delivery; international delivery on enquiry.<br>
          Prefer to talk? Email <a href="mailto:info@jackvettriano.studio">info@jackvettriano.studio</a> or call 07825 128 995.
        </footer>
      </div>
      <div class="modal" id="reqModal" role="dialog" aria-modal="true" aria-labelledby="reqTitle"><div class="sheet" id="reqSheet"></div></div>
      <div class="modal" id="virModal" role="dialog" aria-modal="true" aria-label="See it on your wall"><div class="sheet wide" id="virSheet"></div></div>
      <div class="toast" id="toast" role="status"></div>`;
    this.bind();
    this.observeDwell();
  }

  playerHtml(pid, title, sub, hasAudio) {
    return `<div class="player" data-player="${esc(pid)}">
      <button class="play" aria-label="Play ${esc(title)}" ${hasAudio ? '' : 'disabled'}>${ICON_PLAY}</button>
      <div><div class="ptitle">${esc(title)}</div><div class="psub">${esc(sub)}</div>
      <div class="bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><i></i></div></div>
    </div>`;
  }

  chapterHtml(p, i, total) {
    const s = p.story;
    const hasAudio = !!(s && (s.audioUrl || this.hasAttribute('speech-fallback')));
    const sub = s ? (s.audioUrl ? `The story behind the print · ${clock(s.estDurationSec || 60)}`
      : hasAudio ? 'Preview voice · recorded narration coming soon' : 'Narration coming soon - read the story below')
      : '';
    const badges = [];
    if (s && s.signed) badges.push('<span class="badge gold">Hand-signed</span>');
    if (s && /estate/i.test(s.edition)) badges.push('<span class="badge gold">Estate stamped</span>');
    if (/proof/i.test(p.ribbon)) badges.push(`<span class="badge gold">${esc(p.ribbon)}</span>`);
    else if (p.ribbon && !/price on application/i.test(p.ribbon)) badges.push(`<span class="badge">${esc(p.ribbon)}</span>`);
    if (s && /silkscreen/i.test(s.medium)) badges.push('<span class="badge">Silkscreen</span>');
    return `<section class="chapter" data-pid="${esc(p.productId)}">
      <div class="figure">
        <img src="${esc(p.image)}" alt="${esc(p.title)} by Jack Vettriano" loading="${i ? 'lazy' : 'eager'}">
        <div class="num">${i + 1} of ${total}</div>
      </div>
      <div>
        <div class="eyebrow">Jack Vettriano</div>
        <h2>${esc(p.title)}</h2>
        <div class="badges">${badges.join('')}</div>
        ${p.offer ? `<div class="price"><s>${money(p.price)}</s>${money(p.offer.price)}</div>
          <div class="offer-note">A private offer for you${p.offer.expiresAt ? `, open until ${esc(when(p.offer.expiresAt))}` : ''}</div>`
          : `<div class="price">${money(p.price)}</div>`}
        <div data-status="${esc(p.productId)}">${this.statusHtml(p)}</div>
        ${s ? `${this.playerHtml(p.productId, 'The story behind the print', sub, hasAudio)}
          <button class="linkbtn" data-transcript="${esc(p.productId)}" aria-expanded="false">Read the story</button>
          <div class="transcript" id="t-${esc(p.productId)}">${paragraphs(s.transcript).map((t, k) => `<p data-k="${k}">${esc(t)}</p>`).join('')}</div>` : ''}
        ${p.curatorNote ? `<div class="note"><div class="who">From the director</div><p>${esc(p.curatorNote)}</p></div>` : ''}
        ${this.provenanceHtml(p)}
        <div data-actions="${esc(p.productId)}">${this.actionsHtml(p)}</div>
      </div>
    </section>`;
  }

  statusHtml(p) {
    const labels = {
      available: 'Available',
      held_by_you: p.holdExpiresAt ? `Held for you until ${when(p.holdExpiresAt)}` : 'Held for you',
      hold_pending: 'Hold requested. The Studio will confirm shortly.',
      reserved: 'Currently reserved for another collector',
      out_of_stock: 'Not currently in stock. We can try to source an example for you.',
    };
    return `<div class="status ${esc(p.availability)}"><span class="dot"></span>${esc(labels[p.availability] || '')}</div>`;
  }

  provenanceHtml(p) {
    const s = p.story || {};
    const framed = s.framedSizeCm || p.framedSizeFromStore;
    const rows = [
      ['Edition', s.edition],
      ['Signature', s.signed ? 'Signed and numbered by Jack Vettriano' : /estate/i.test(s.edition || '') ? 'Numbered and embossed with the Estate of Jack Vettriano stamp' : ''],
      ['Medium', s.medium],
      ['Image size', sizeText(s.imageSizeCm)],
      ['Mount size', sizeText(s.mountSizeCm)],
      ['Framed size', sizeText(framed)],
      ['Authenticity', 'Certificate of authenticity included'],
      ['Delivery', 'Fully insured UK delivery; international on enquiry'],
    ].filter((r) => r[1]);
    return `<details class="prov" data-prov="${esc(p.productId)}"><summary>Provenance &amp; edition</summary>
      <dl>${rows.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl>
      ${p.productUrl ? `<p class="small"><a style="color:var(--brass2)" href="${esc(p.productUrl)}" target="_blank" rel="noopener">View on the Studio website</a></p>` : ''}
    </details>`;
  }

  actionsHtml(p) {
    const offerTaken = p.requests.some((r) => r.type === 'offer' && ['pending', 'confirmed'].includes(r.status));
    const btns = [];
    if (p.offer && !offerTaken && p.availability !== 'reserved') {
      btns.push(`<button class="btn solid" data-req="offer" data-pid="${esc(p.productId)}">Accept private offer</button>`);
    }
    if (p.availability === 'available') {
      btns.push(`<button class="btn ${p.offer && !offerTaken ? '' : 'solid'}" data-req="hold" data-pid="${esc(p.productId)}">Request a ${this.data.room.holdHours}-hour hold</button>`);
    }
    btns.push(`<button class="btn" data-req="question" data-pid="${esc(p.productId)}">${p.availability === 'out_of_stock' ? 'Ask us to source one' : 'Ask the Studio'}</button>`);
    btns.push(`<button class="btn" data-vir="${esc(p.productId)}">See it on your wall</button>`);
    const names = { hold: 'Hold request', question: 'Your question', offer: 'Offer accepted' };
    const chip = { pending: 'Awaiting the Studio', confirmed: 'Confirmed', declined: 'Not possible', answered: 'Answered', expired: 'Hold ended' };
    const history = p.requests.map((r) => `<div class="req">
      <div class="row"><span>${esc(names[r.type])} · ${esc(day(r.createdAt))}</span><span class="chip ${esc(r.status)}">${esc(chip[r.status] || r.status)}</span></div>
      ${r.message ? `<div class="msg">${esc(r.message)}</div>` : ''}
      ${r.reply ? `<div class="reply"><strong>The Studio:</strong> ${esc(r.reply)}</div>` : ''}
    </div>`).join('');
    return `<div class="actions">${btns.join('')}</div>${history ? `<div class="history">${history}</div>` : ''}`;
  }

  refreshPrint(pid) {
    const p = this.data.prints.find((x) => x.productId === pid);
    if (!p) return;
    this.root.querySelector(`[data-status="${CSS.escape(pid)}"]`).innerHTML = this.statusHtml(p);
    this.root.querySelector(`[data-actions="${CSS.escape(pid)}"]`).innerHTML = this.actionsHtml(p);
  }

  // ---------- behaviour ----------
  bind() {
    const r = this.root;
    r.querySelectorAll('details.prov').forEach((el) => el.addEventListener('toggle', () => {
      if (el.open) this.track('provenance_open', el.dataset.prov, 1);
    }));
    if (this.bound) return;
    this.bound = true;
    r.addEventListener('click', (e) => {
      const t = e.target.closest('button, .bar, .modal');
      if (!t) return;
      if (t.dataset.req) this.openRequest(t.dataset.pid, t.dataset.req);
      else if (t.dataset.vir) this.openViewInRoom(t.dataset.vir);
      else if (t.dataset.transcript) this.toggleTranscript(t);
      else if (t.classList.contains('play')) this.togglePlay(t.closest('.player').dataset.player);
      else if (t.classList.contains('bar')) this.seek(t, e);
      else if (t.classList.contains('modal') && e.target === t) this.closeModals();
    });
    r.addEventListener('keydown', (e) => { if (e.key === 'Escape') this.closeModals(); });
  }

  toggleTranscript(btn) {
    const pid = btn.dataset.transcript;
    const box = this.root.getElementById(`t-${pid}`);
    const open = !box.classList.contains('open');
    box.classList.toggle('open', open);
    btn.setAttribute('aria-expanded', String(open));
    btn.textContent = open ? 'Hide the story' : 'Read the story';
    if (open) this.track('transcript_open', pid, 1);
  }

  sourceFor(pid) {
    if (pid === '_greeting') return { url: this.data.room.greetingAudioUrl, text: '' };
    const p = this.data.prints.find((x) => x.productId === pid);
    return { url: p.story.audioUrl, text: p.story.transcript, est: p.story.estDurationSec };
  }

  stopAll(except) {
    for (const [pid, pl] of this.players) {
      if (pid === except) continue;
      if (pl.audio) pl.audio.pause();
      if (pl.speaking) { speechSynthesis.cancel(); pl.speaking = false; }
      this.setPlaying(pid, false);
    }
  }

  setPlaying(pid, on) {
    const btn = this.root.querySelector(`[data-player="${CSS.escape(pid)}"] .play`);
    if (btn) { btn.innerHTML = on ? ICON_PAUSE : ICON_PLAY; btn.setAttribute('aria-label', on ? 'Pause' : 'Play'); }
  }

  progress(pid, frac) {
    const el = this.root.querySelector(`[data-player="${CSS.escape(pid)}"] .bar`);
    if (el) { el.firstElementChild.style.width = `${Math.min(100, frac * 100)}%`; el.setAttribute('aria-valuenow', String(Math.round(frac * 100))); }
    const pl = this.players.get(pid);
    for (const mark of [25, 50, 75, 100]) {
      if (frac * 100 >= mark - 0.5 && !pl.marks.has(mark)) { pl.marks.add(mark); this.track('audio_progress', pid, mark); }
    }
    const box = this.root.getElementById(`t-${pid}`);
    if (!box || pid === '_greeting') return;
    const ps = [...box.querySelectorAll('p')];
    const words = ps.map((p) => p.textContent.split(/\s+/).length);
    const total = words.reduce((a, b) => a + b, 0);
    let acc = 0;
    let active = ps.length - 1;
    for (let k = 0; k < ps.length; k += 1) { acc += words[k]; if (frac * total < acc) { active = k; break; } }
    ps.forEach((p, k) => p.classList.toggle('on', k === active && frac > 0 && frac < 1));
  }

  togglePlay(pid) {
    const src = this.sourceFor(pid);
    let pl = this.players.get(pid);
    if (!pl) { pl = { marks: new Set() }; this.players.set(pid, pl); }
    this.stopAll(pid);
    if (src.url) {
      if (!pl.audio) {
        pl.audio = new Audio(src.url);
        pl.audio.preload = 'auto';
        pl.audio.addEventListener('timeupdate', () => pl.audio.duration && this.progress(pid, pl.audio.currentTime / pl.audio.duration));
        pl.audio.addEventListener('ended', () => { this.setPlaying(pid, false); this.progress(pid, 1); });
      }
      if (pl.audio.paused) { pl.audio.play(); this.setPlaying(pid, true); this.track('audio_play', pid, 1); } else { pl.audio.pause(); this.setPlaying(pid, false); }
      return;
    }
    // Preview fallback: read the script with the browser's own voice.
    if (pl.speaking) { speechSynthesis.cancel(); pl.speaking = false; this.setPlaying(pid, false); return; }
    const parts = paragraphs(src.text);
    const total = parts.join(' ').split(/\s+/).length;
    let done = 0;
    pl.speaking = true;
    this.setPlaying(pid, true);
    this.track('audio_play', pid, 1);
    parts.forEach((text, k) => {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'en-GB';
      u.rate = 0.95;
      const voice = speechSynthesis.getVoices().find((v) => /en-GB/i.test(v.lang));
      if (voice) u.voice = voice;
      u.onboundary = (ev) => { if (ev.name === 'word') this.progress(pid, (done + text.slice(0, ev.charIndex).split(/\s+/).length) / total); };
      u.onend = () => {
        done += text.split(/\s+/).length;
        this.progress(pid, done / total);
        if (k === parts.length - 1) { pl.speaking = false; this.setPlaying(pid, false); }
      };
      speechSynthesis.speak(u);
    });
  }

  seek(bar, e) {
    const pid = bar.closest('.player').dataset.player;
    const pl = this.players.get(pid);
    if (!pl || !pl.audio || !pl.audio.duration) return;
    const rect = bar.getBoundingClientRect();
    pl.audio.currentTime = ((e.clientX - rect.left) / rect.width) * pl.audio.duration;
  }

  toast(msg) {
    const t = this.root.getElementById('toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => t.classList.remove('show'), 4200);
  }

  closeModals() {
    this.root.querySelectorAll('.modal.open').forEach((m) => m.classList.remove('open'));
    if (this.lastFocus) this.lastFocus.focus();
  }

  // ---------- requests ----------
  openRequest(pid, type) {
    const p = this.data.prints.find((x) => x.productId === pid);
    const hours = this.data.room.holdHours;
    const copy = {
      hold: [`Hold ${p.title}`, `Ask the Studio to reserve this print for you for ${hours} hours while you decide. Nothing is charged. We will confirm the hold personally.`, 'Anything we should know? (optional)', 'Request hold'],
      question: [`Ask about ${p.title}`, 'Your question goes straight to the director who prepared this room. You will see the reply here, and by email.', 'Your question', 'Send question'],
      offer: [`Accept our offer on ${p.title}`, `You are accepting the private price of ${money(p.offer ? p.offer.price : p.price)}. The Studio will confirm and send an invoice with framing and delivery options. No payment is taken here.`, 'Delivery or framing notes (optional)', 'Accept offer'],
    }[type];
    this.lastFocus = this.root.activeElement;
    const sheet = this.root.getElementById('reqSheet');
    sheet.innerHTML = `<h3 id="reqTitle">${esc(copy[0])}</h3><p>${esc(copy[1])}</p>
      <textarea id="reqMsg" placeholder="${esc(copy[2])}" maxlength="2000"></textarea>
      <div class="err" id="reqErr"></div>
      <div class="actions"><button class="btn" id="reqCancel">Cancel</button><button class="btn solid" id="reqSend">${esc(copy[3])}</button></div>`;
    this.root.getElementById('reqModal').classList.add('open');
    this.root.getElementById('reqMsg').focus();
    this.root.getElementById('reqCancel').onclick = () => this.closeModals();
    this.root.getElementById('reqSend').onclick = async (ev) => {
      const btn = ev.currentTarget;
      const message = this.root.getElementById('reqMsg').value.trim();
      if (type === 'question' && !message) { this.root.getElementById('reqErr').textContent = 'Please write your question.'; return; }
      btn.disabled = true;
      btn.textContent = 'Sending…';
      try {
        const payload = await this.rpc('submitRequest', this.data.room.slug, { productId: pid, type, message });
        this.data.prints = payload.prints;
        this.refreshPrint(pid);
        this.closeModals();
        this.toast(type === 'question' ? 'Sent. The Studio will reply here shortly.' : 'Thank you. The Studio will confirm shortly.');
      } catch (err) {
        this.root.getElementById('reqErr').textContent = err.message;
        btn.disabled = false;
        btn.textContent = copy[3];
      }
    };
  }

  // ---------- view in room ----------
  // Store copy mixes "H x W" and "W x H", so orient every size from the
  // image itself: a portrait image gets the larger number as its height.
  orient(pair, portrait) {
    if (!pair) return null;
    const [a, b] = pair.map(Number);
    return portrait ? { w: Math.min(a, b), h: Math.max(a, b) } : { w: Math.max(a, b), h: Math.min(a, b) };
  }

  frameSize(p, portrait) {
    const s = p.story || {};
    const framed = this.orient(s.framedSizeCm || p.framedSizeFromStore, portrait);
    if (framed) return { ...framed, exact: true };
    const mount = this.orient(s.mountSizeCm, portrait);
    if (mount) return { w: mount.w + 6, h: mount.h + 6, exact: false };
    const img = this.orient(s.imageSizeCm, portrait);
    // Premium editions sit straight in the frame; paper prints have a mount.
    const pad = /lacquer|board mounted|no glass/i.test(s.medium || '') ? 10 : 24;
    if (img) return { w: img.w + pad, h: img.h + pad, exact: false };
    return portrait ? { w: 60, h: 72, exact: false } : { w: 72, h: 60, exact: false };
  }

  openViewInRoom(pid) {
    const p = this.data.prints.find((x) => x.productId === pid);
    this.track('view_in_room', pid, 1);
    this.lastFocus = this.root.activeElement;
    const size = this.frameSize(p, true);
    this.vir = { p, size, portrait: true, wall: WALLS[0], frame: 'black', widthCm: 420, photo: null, x: 0.5, centreCm: 150 };
    const probe = new Image();
    probe.onload = () => {
      if (!this.vir || this.vir.p !== p) return;
      this.vir.portrait = probe.naturalHeight >= probe.naturalWidth;
      this.vir.size = this.frameSize(p, this.vir.portrait);
      const note = this.root.getElementById('virSize');
      if (note) note.textContent = `${this.vir.size.w} × ${this.vir.size.h} cm`;
      this.drawStage();
    };
    probe.src = p.image;
    const sheet = this.root.getElementById('virSheet');
    sheet.innerHTML = `<h3>${esc(p.title)} on your wall</h3>
      <p>Shown at true scale: ${size.exact ? 'framed' : 'approximately framed'} <span id="virSize">${size.w} × ${size.h} cm</span> (width × height), hung at 150 cm to the centre, the gallery standard. Drag the print to move it.</p>
      <div class="vir-grid">
        <div class="stage" id="stage"></div>
        <div class="controls">
          <label>Your own wall</label>
          <button class="btn" id="photoBtn" style="width:100%">Use a photo of my wall</button>
          <input type="file" id="photoIn" accept="image/*" hidden>
          <div id="photoOpts" hidden>
            <label for="wallW">Width of wall in the photo: <span id="wallWv"></span></label>
            <input type="range" id="wallW" min="100" max="900" step="10">
            <button class="linkbtn" id="photoClear">Back to the sample room</button>
          </div>
          <div id="wallOpts"><label>Wall colour</label><div class="swatches">${WALLS.map((c) => `<button class="sw" data-wall="${c}" style="background:${c}" aria-label="Wall colour ${c}"></button>`).join('')}</div></div>
          <label>Frame</label>
          <div class="seg">${Object.entries(FRAME_STYLES).map(([k, f]) => `<button data-frame="${k}">${f.label}</button>`).join('')}</div>
          <p class="small">Your photo stays on your device and is never uploaded.${size.exact ? '' : ' Frame size is estimated from the mount; the Studio can confirm exact dimensions.'}</p>
          <div class="actions" style="justify-content:flex-start"><button class="btn" id="virClose">Close</button></div>
        </div>
      </div>`;
    this.root.getElementById('virModal').classList.add('open');
    const $ = (id) => this.root.getElementById(id);
    $('virClose').onclick = () => this.closeModals();
    $('photoBtn').onclick = () => $('photoIn').click();
    $('photoIn').onchange = (e) => {
      const f = e.target.files[0];
      if (!f) return;
      if (this.vir.photo) URL.revokeObjectURL(this.vir.photo);
      this.vir.photo = URL.createObjectURL(f);
      this.vir.widthCm = 300;
      this.drawStage();
    };
    $('photoClear').onclick = () => { URL.revokeObjectURL(this.vir.photo); this.vir.photo = null; this.vir.widthCm = 420; this.drawStage(); };
    $('wallW').oninput = (e) => { this.vir.widthCm = Number(e.target.value); this.drawStage(); };
    sheet.querySelectorAll('[data-wall]').forEach((b) => { b.onclick = () => { this.vir.wall = b.dataset.wall; this.drawStage(); }; });
    sheet.querySelectorAll('[data-frame]').forEach((b) => { b.onclick = () => { this.vir.frame = b.dataset.frame; this.drawStage(); }; });
    this.drawStage();
    if (this.stageObserver) this.stageObserver.disconnect();
    this.stageObserver = new ResizeObserver(() => this.drawStage());
    this.stageObserver.observe($('stage'));
  }

  drawStage() {
    const v = this.vir;
    const stage = this.root.getElementById('stage');
    if (!v || !stage) return;
    const W = stage.clientWidth;
    const H = stage.clientHeight;
    const px = W / v.widthCm;
    const floorPx = v.photo ? 0 : H * 0.09;
    const fw = v.size.w * px;
    const fh = v.size.h * px;
    const frame = FRAME_STYLES[v.frame];
    const border = Math.max(2, 3 * px);
    const s = v.p.story || {};
    const img = this.orient(s.imageSizeCm, v.portrait);
    const innerW = fw - 2 * border;
    const innerH = fh - 2 * border;
    const imgW = img ? Math.min(innerW, img.w * px) : innerW * 0.72;
    const imgH = img ? Math.min(innerH, img.h * px) : innerH * 0.72;
    const premium = /lacquer|board mounted|no glass/i.test(s.medium || '');
    const left = v.x * W - fw / 2;
    const top = H - floorPx - v.centreCm * px - fh / 2;
    const sofaW = 220 * px;
    const sofaH = 85 * px;
    this.root.querySelectorAll('[data-wall]').forEach((b) => b.classList.toggle('on', b.dataset.wall === v.wall));
    this.root.querySelectorAll('[data-frame]').forEach((b) => b.classList.toggle('on', b.dataset.frame === v.frame));
    this.root.getElementById('photoOpts').hidden = !v.photo;
    this.root.getElementById('wallOpts').hidden = !!v.photo;
    this.root.getElementById('wallW').value = v.widthCm;
    this.root.getElementById('wallWv').textContent = `${v.widthCm} cm`;
    stage.style.background = v.wall;
    stage.innerHTML = `
      ${v.photo ? `<div class="photo" style="background-image:url('${v.photo}')"></div>` : `
        <div class="skirting"></div><div class="floor"></div>
        <svg class="sofa" width="${sofaW}" height="${sofaH}" viewBox="0 0 220 85" preserveAspectRatio="none" aria-hidden="true">
          <rect x="0" y="22" width="220" height="48" rx="8" fill="#5b5f63"/><rect x="10" y="8" width="200" height="40" rx="10" fill="#6b7075"/>
          <rect x="0" y="30" width="22" height="40" rx="8" fill="#55595d"/><rect x="198" y="30" width="22" height="40" rx="8" fill="#55595d"/>
          <rect x="14" y="70" width="6" height="15" fill="#2e2a26"/><rect x="200" y="70" width="6" height="15" fill="#2e2a26"/>
        </svg>`}
      <div class="art" id="art" style="left:${left}px;top:${top}px;width:${fw}px;height:${fh}px;background:${premium ? '#000' : frame.color};border:1px solid ${frame.edge}">
        ${premium ? `<img src="${esc(v.p.image)}" alt="" style="inset:${border}px;width:${innerW}px;height:${innerH}px">`
          : `<div class="mount" style="inset:${border}px"></div>
             <img src="${esc(v.p.image)}" alt="" style="left:${(fw - imgW) / 2}px;top:${(fh - imgH) / 2}px;width:${imgW}px;height:${imgH}px">`}
      </div>`;
    const art = this.root.getElementById('art');
    art.onpointerdown = (e) => {
      art.setPointerCapture(e.pointerId);
      const start = { x: e.clientX, y: e.clientY, vx: v.x, c: v.centreCm };
      art.onpointermove = (m) => {
        v.x = Math.min(1, Math.max(0, start.vx + (m.clientX - start.x) / W));
        v.centreCm = Math.max(v.size.h / 2, start.c - (m.clientY - start.y) / px);
        art.style.left = `${v.x * W - fw / 2}px`;
        art.style.top = `${H - floorPx - v.centreCm * px - fh / 2}px`;
      };
      art.onpointerup = () => { art.onpointermove = null; };
    };
  }
}

if (!customElements.get('pvr-room')) customElements.define('pvr-room', PvrRoom);
