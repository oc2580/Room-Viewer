// <jv-gallery> - the Studio's public Interactive Gallery.
//
// Talks to the backend through "jv-rpc" events { id, method, args }; the page
// code runs the web method and answers via the "rpc-result" attribute. A host
// page can instead set element.rpcHandler = async (method, args) => result.
// The page sets the "ready" attribute once it is listening.
//
// Attributes: analytics="on" (visitor allowed analytics cookies),
// shared-shortlist="id,id", open-print="productId", start-tour="slug",
// speech-fallback (demo only: read stories
// with the browser's voice when no recording exists yet).

// Poppins matches the typeface used across the JVS website.
const FONT_HREF = 'https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600&display=swap';
const FLUSH_MS = 15000;
const TOUR_PAUSE_SEC = 6;
const FRAME_STYLES = {
  black: { label: 'Black', color: '#1b1918', edge: '#000' },
  walnut: { label: 'Walnut', color: '#5a3b26', edge: '#3d2717' },
  gilt: { label: 'Gilt', color: '#b8954f', edge: '#8a6c33' },
  ivory: { label: 'Ivory', color: '#efe8da', edge: '#cfc6b4' },
};
const WALLS = ['#e9e2d6', '#c9d0c8', '#2f3a40', '#7a2e2a'];
const PRICE_BANDS = { '': 'Any price', low: 'Under £700', mid: '£700 to £1,500', high: 'Over £1,500' };
const SORTS = { featured: 'Featured', 'price-asc': 'Price, low to high', 'price-desc': 'Price, high to low', title: 'Title A to Z' };

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = (n) => Number(n).toLocaleString('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 });
const when = (d) => new Date(d).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
const day = (d) => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'long' });
const clock = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const paragraphs = (t) => String(t || '').split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
const sizeText = (s) => (s ? `${s[0]} × ${s[1]} cm` : '');
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* private mode */ } },
};

const STYLE = `
:host { all: initial; display: block; font-family: Poppins, 'Helvetica Neue', Arial, sans-serif; font-weight: 300; color: var(--text);
  --bg: #ffffff; --soft: #f6f5f3; --text: #141414; --muted: #5f5f5f; --red: #b3140f; --red-dark: #8d0f0b;
  --dark: #262626; --line: #e4e2de; --ok: #2f7d3b; --warn: #9a6200; --bad: #b3140f; }
* { box-sizing: border-box; }
button { font: inherit; }
strong, b { font-weight: 500; }
.gal { background: var(--bg); min-height: 100%; padding-bottom: 72px; }
.wrap { max-width: 1100px; margin: 0 auto; padding: 0 24px; }
.eyebrow { letter-spacing: .26em; text-transform: uppercase; font-size: 11px; color: var(--text); font-weight: 400; }
h1, h2, h3 { font-family: Poppins, 'Helvetica Neue', Arial, sans-serif; font-weight: 500; margin: 0; text-wrap: balance; letter-spacing: -.01em; }
h1 { font-size: clamp(38px, 5.6vw, 60px); line-height: 1.08; margin: 12px 0 0; color: var(--red); font-weight: 600; }
.rule { width: 74px; height: 2px; background: var(--red); border: 0; margin: 22px auto; }
.lede { max-width: 700px; margin: 0 auto; color: var(--text); font-size: 16px; line-height: 1.7; }
header.hero { padding: 56px 0 8px; text-align: center; }
.banner { margin: 22px auto 0; max-width: 700px; padding: 14px 18px; border: 1px solid var(--text); display: flex; gap: 12px; align-items: center; flex-wrap: wrap; text-align: left; }
.banner span { flex: 1; min-width: 200px; }
.tours-wrap { background: var(--soft); margin-top: 40px; padding: 34px 0 30px; }
.tours-wrap .eyebrow.center { text-align: center; }
.tours { display: flex; flex-wrap: wrap; justify-content: center; gap: 18px; padding: 18px 0 6px; text-align: left; }
.tours .tour { flex: 0 1 calc((100% - 36px) / 3); min-width: 280px; }
.tour { background: var(--bg); border: 1px solid var(--line); padding: 22px; display: flex; flex-direction: column; gap: 10px; min-width: 0; }
.tour .eyebrow { color: var(--red); }
.tour h3 { font-size: 21px; line-height: 1.25; }
.tour p { color: var(--muted); font-size: 14px; line-height: 1.6; margin: 0; flex: 1; }
.tour .thumbs { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 6px; max-width: 270px; }
.tour .thumbs img { width: 100%; aspect-ratio: 5 / 6; height: auto; object-fit: cover; background: var(--soft); display: block; }
.tour .meta { font-size: 12px; color: var(--muted); }
.toolbar { position: sticky; top: 0; z-index: 5; background: rgba(255,255,255,.96); backdrop-filter: blur(8px); border-bottom: 1px solid var(--line); margin-top: 0; }
.toolbar .wrap { display: flex; flex-wrap: wrap; gap: 10px 14px; align-items: center; padding-top: 14px; padding-bottom: 14px; }
.chips { display: flex; gap: 4px 18px; flex-wrap: wrap; flex: 1 1 420px; }
.chip { border: 0; border-bottom: 1px solid transparent; background: none; color: var(--text); padding: 6px 0; font-size: 13px; letter-spacing: .06em; text-transform: uppercase; cursor: pointer; font-weight: 300; }
.chip:hover { color: var(--red); }
.chip[aria-pressed="true"] { color: var(--red); border-bottom-color: var(--red); }
select, input[type=text], input[type=email], input[type=tel], input[type=number] { background: var(--bg); color: var(--text); border: 1px solid var(--text); border-radius: 0; padding: 8px 10px; font: inherit; font-size: 14px; }
.tools { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; }
.toggle { display: inline-flex; gap: 6px; align-items: center; font-size: 13px; color: var(--text); cursor: pointer; }
.toggle input { accent-color: var(--red); }
.count { color: var(--muted); font-size: 13px; padding: 22px 0 4px; }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 40px 28px; padding-top: 12px; }
.card { position: relative; display: flex; flex-direction: column; gap: 8px; min-width: 0; }
.card .frame { background: var(--soft); aspect-ratio: 4 / 5; display: grid; place-items: center; padding: 22px; cursor: pointer; border: 0; width: 100%; }
.card .frame img { max-width: 100%; max-height: 100%; object-fit: contain; box-shadow: 0 10px 22px rgba(0,0,0,.22); transition: transform .3s; }
.card .frame:hover img { transform: translateY(-3px); }
.card h3 { font-size: 17px; line-height: 1.3; font-weight: 500; }
.card .line { display: flex; justify-content: space-between; gap: 10px; font-size: 14px; }
.card .sub { color: var(--muted); font-size: 12px; }
.heart { position: absolute; top: 10px; right: 10px; width: 36px; height: 36px; border-radius: 50%; border: 0; background: rgba(255,255,255,.92); color: var(--text); cursor: pointer; display: grid; place-items: center; box-shadow: 0 1px 4px rgba(0,0,0,.15); }
.heart[aria-pressed="true"] { color: var(--red); }
.heart svg { width: 17px; height: 17px; }
.tag { position: absolute; top: 12px; left: 12px; font-size: 10px; letter-spacing: .14em; text-transform: uppercase; padding: 4px 8px; background: var(--bg); color: var(--text); }
.tag.gold { background: var(--red); color: #fff; }
.empty { padding: 60px 0; color: var(--muted); text-align: center; }
.badges { display: flex; gap: 6px; flex-wrap: wrap; }
.badge { border: 1px solid var(--line); font-size: 11px; padding: 3px 9px; color: var(--muted); }
.badge.gold { border-color: var(--red); color: var(--red); }
.btn { border: 1px solid var(--text); background: transparent; color: var(--text); padding: 11px 20px; border-radius: 0; font-size: 14px; cursor: pointer; letter-spacing: .02em; }
.btn:hover { background: var(--soft); }
.btn.solid { background: var(--dark); border-color: var(--dark); color: #fff; font-weight: 400; }
.btn.solid:hover { background: #000; }
.btn.quiet { border-color: var(--line); }
.btn.small { padding: 7px 13px; font-size: 13px; }
.btn[disabled] { opacity: .45; cursor: default; }
.btn svg { width: 15px; height: 15px; vertical-align: -2px; margin-right: 2px; }
.actions, .tools { align-items: center; }
button:focus-visible, select:focus-visible, input:focus-visible, textarea:focus-visible, summary:focus-visible, a:focus-visible { outline: 2px solid var(--red); outline-offset: 3px; }
a { color: var(--text); text-underline-offset: 3px; }
a:hover { color: var(--red); }
.linkbtn { background: none; border: 0; color: var(--text); cursor: pointer; font-size: 13px; padding: 6px 0; text-decoration: underline; text-underline-offset: 3px; }
.linkbtn:hover { color: var(--red); }
.overlay { position: fixed; inset: 0; z-index: 30; background: var(--bg); overflow-y: auto; display: none; }
.overlay.open { display: block; }
.ptop { position: sticky; top: 0; z-index: 2; background: rgba(255,255,255,.97); border-bottom: 1px solid var(--line); }
.ptop .wrap { display: flex; align-items: center; gap: 10px; padding-top: 10px; padding-bottom: 10px; flex-wrap: wrap; }
.ptop .where { flex: 1; color: var(--muted); font-size: 13px; min-width: 150px; }
.ptop .where strong { color: var(--text); }
.iconbtn { width: 40px; height: 40px; border-radius: 50%; border: 1px solid var(--line); background: var(--bg); color: var(--text); cursor: pointer; font-size: 18px; }
.iconbtn:hover:not([disabled]) { border-color: var(--text); }
.iconbtn[disabled] { opacity: .35; cursor: default; }
.print { display: grid; grid-template-columns: minmax(0, 1.05fr) minmax(0, 1fr); gap: 56px; padding: 40px 0 64px; align-items: start; }
.figure { position: sticky; top: 84px; background: var(--soft); padding: 36px; }
.figure img { width: 100%; height: auto; display: block; box-shadow: 0 18px 36px rgba(0,0,0,.25); background: var(--line); }
.print .eyebrow { color: var(--red); }
.print h2 { font-size: 40px; line-height: 1.1; margin: 10px 0 12px; font-weight: 600; }
.price { font-size: 22px; font-weight: 400; margin: 16px 0 6px; display: flex; gap: 12px; align-items: center; flex-wrap: wrap; }
.status { margin: 6px 0 0; font-size: 13px; display: flex; align-items: center; gap: 8px; color: var(--muted); }
.dot { width: 8px; height: 8px; border-radius: 50%; background: var(--muted); flex: none; }
.status.available .dot { background: var(--ok); }
.status.held_by_you .dot, .status.hold_pending .dot { background: var(--red); }
.actions { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 22px; }
.player { margin: 28px 0 8px; background: var(--soft); border: 0; border-left: 2px solid var(--red); padding: 16px 18px; display: grid; grid-template-columns: 48px 1fr; gap: 14px; align-items: center; }
.play { width: 48px; height: 48px; border-radius: 50%; border: 0; background: var(--red); color: #fff; cursor: pointer; display: grid; place-items: center; }
.play:hover { background: var(--red-dark); }
.play svg { width: 18px; height: 18px; }
.ptitle { font-size: 13px; font-weight: 500; }
.psub { font-size: 12px; color: var(--muted); margin-top: 2px; }
.bar { height: 3px; background: var(--line); margin-top: 10px; cursor: pointer; position: relative; }
.bar i { position: absolute; inset: 0 auto 0 0; width: 0; background: var(--red); }
.transcript { display: none; margin: 8px 0 0; padding-left: 18px; border-left: 1px solid var(--line); }
.transcript.open { display: block; }
.transcript p { color: var(--muted); line-height: 1.8; font-size: 15px; margin: 0 0 14px; transition: color .3s; max-width: 62ch; }
.transcript p.on { color: var(--text); }
details.prov { margin-top: 22px; border-top: 1px solid var(--line); border-bottom: 1px solid var(--line); }
details.prov summary { cursor: pointer; padding: 14px 0; font-size: 12px; font-weight: 400; letter-spacing: .18em; text-transform: uppercase; list-style: none; display: flex; justify-content: space-between; }
details.prov summary::after { content: '+'; color: var(--red); font-size: 18px; line-height: 1; }
details.prov[open] summary::after { content: '–'; }
dl { display: grid; grid-template-columns: 140px 1fr; gap: 10px 16px; margin: 0 0 18px; font-size: 14px; }
dt { color: var(--muted); }
dd { margin: 0; }
.history { margin-top: 22px; display: grid; gap: 10px; }
.req { font-size: 13px; padding: 12px 14px; border: 1px solid var(--line); }
.req .row { display: flex; justify-content: space-between; gap: 12px; color: var(--muted); flex-wrap: wrap; }
.req .row strong { color: var(--text); }
.req .msg { margin-top: 6px; }
.req .reply { margin-top: 8px; padding-top: 8px; border-top: 1px dashed var(--line); }
.req .counter { margin-top: 10px; display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
.pill { font-size: 11px; padding: 2px 8px; background: var(--soft); white-space: nowrap; }
.pill.confirmed, .pill.answered, .pill.accepted { background: #e7f2e8; color: var(--ok); }
.pill.pending, .pill.countered { background: #fbf0dc; color: var(--warn); }
.pill.declined, .pill.declined_by_visitor, .pill.expired { color: var(--muted); }
.tourbar { background: var(--soft); border-bottom: 1px solid var(--line); }
.tourbar .wrap { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; padding-top: 10px; padding-bottom: 10px; font-size: 13px; }
.tourbar .prog { flex: 1; min-width: 120px; height: 3px; background: var(--line); position: relative; }
.tourbar .prog i { position: absolute; inset: 0 auto 0 0; background: var(--red); }
.next-up { margin-top: 18px; padding: 14px 16px; background: var(--soft); display: flex; gap: 12px; align-items: center; flex-wrap: wrap; }
.next-up span { flex: 1; min-width: 180px; }
.done { padding: 90px 0; text-align: center; max-width: 620px; margin: 0 auto; }
.done h2 { color: var(--red); font-weight: 600; }
.done p { color: var(--muted); line-height: 1.7; }
.done .actions { justify-content: center; }
.drawer { position: fixed; top: 0; right: 0; bottom: 0; width: min(440px, 100%); background: var(--bg); border-left: 1px solid var(--line); z-index: 40; transform: translateX(105%); transition: transform .25s; display: flex; flex-direction: column; box-shadow: -10px 0 30px rgba(0,0,0,.08); }
.drawer.open { transform: none; }
.drawer header { padding: 18px 20px; border-bottom: 1px solid var(--line); display: flex; justify-content: space-between; align-items: center; gap: 10px; }
.drawer h3 { font-size: 22px; }
.drawer .body { padding: 16px 20px; overflow-y: auto; flex: 1; }
.drawer footer { padding: 16px 20px; border-top: 1px solid var(--line); display: flex; gap: 8px; flex-wrap: wrap; }
.sl { display: grid; grid-template-columns: 56px 1fr auto; gap: 12px; align-items: center; padding: 10px 0; border-bottom: 1px solid var(--line); }
.sl img { width: 56px; height: 68px; object-fit: cover; background: var(--soft); }
.sl .t { font-size: 15px; font-weight: 500; line-height: 1.3; background: none; border: 0; color: var(--text); text-align: left; padding: 0; cursor: pointer; font-family: inherit; }
.sl .t:hover { color: var(--red); }
.sl .s { color: var(--muted); font-size: 12px; }
.scrim { position: fixed; inset: 0; background: rgba(0,0,0,.35); z-index: 35; display: none; }
.scrim.open { display: block; }
.modal { position: fixed; inset: 0; background: rgba(0,0,0,.45); display: none; align-items: center; justify-content: center; padding: 16px; z-index: 50; }
.modal.open { display: flex; }
.sheet { background: var(--bg); width: min(560px, 100%); max-height: calc(100vh - 32px); overflow: auto; padding: 30px; box-shadow: 0 20px 60px rgba(0,0,0,.25); }
.sheet.wide { width: min(1100px, 100%); }
.sheet h3 { font-size: 24px; margin-bottom: 8px; }
.sheet .eyebrow { color: var(--red); }
.sheet p { color: var(--muted); line-height: 1.65; margin: 0 0 14px; font-size: 14px; }
.form { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.form label { display: grid; gap: 6px; font-size: 12px; color: var(--muted); }
.form .full { grid-column: 1 / -1; }
.form input, .form textarea { width: 100%; }
textarea { width: 100%; min-height: 100px; background: var(--bg); color: var(--text); border: 1px solid var(--text); border-radius: 0; padding: 10px 12px; font: inherit; font-size: 14px; resize: vertical; }
.fine { font-size: 12px; color: var(--muted); line-height: 1.5; margin-top: 12px; }
.err { color: var(--bad); font-size: 13px; margin-top: 10px; min-height: 1em; }
.sheet .actions { justify-content: flex-end; }
.compare { overflow-x: auto; }
.compare table { border-collapse: collapse; min-width: 560px; width: 100%; font-size: 13px; }
.compare th, .compare td { text-align: left; vertical-align: top; padding: 10px; border-bottom: 1px solid var(--line); }
.compare th { color: var(--muted); font-weight: 400; width: 120px; }
.compare img { width: 110px; height: 135px; object-fit: contain; background: var(--soft); }
.compare td { font-variant-numeric: tabular-nums; }
.toast { position: fixed; left: 50%; bottom: 24px; transform: translateX(-50%) translateY(140px); background: var(--dark); color: #fff; padding: 12px 18px; font-size: 14px; transition: transform .3s; z-index: 60; box-shadow: 0 10px 30px rgba(0,0,0,.25); max-width: calc(100% - 32px); display: flex; gap: 12px; align-items: center; }
.toast a, .toast .linkbtn { color: #fff; font-weight: 500; font-size: 14px; padding: 0; }
.toast.show { transform: translateX(-50%) translateY(0); }
.vir-grid { display: grid; grid-template-columns: minmax(0, 1fr) 240px; gap: 20px; }
.stage { position: relative; aspect-ratio: 16 / 10; max-width: 100%; overflow: hidden; background: #e9e2d6; touch-action: none; user-select: none; }
.stage .floor { position: absolute; left: 0; right: 0; bottom: 0; height: 9%; background: linear-gradient(#8b6a4c, #6d5039); }
.stage .skirting { position: absolute; left: 0; right: 0; bottom: 9%; height: 1.4%; background: rgba(255,255,255,.55); }
.stage .photo { position: absolute; inset: 0; background-size: cover; background-position: center; }
.stage svg.sofa { position: absolute; bottom: 9%; left: 50%; transform: translateX(-50%); }
.art { position: absolute; cursor: grab; box-shadow: 0 14px 24px rgba(0,0,0,.35); }
.art .mount { position: absolute; background: #f6f2ea; }
.art img { position: absolute; width: 100%; height: 100%; object-fit: cover; pointer-events: none; }
.controls label { display: block; font-size: 12px; color: var(--muted); margin: 14px 0 6px; }
.swatches, .seg { display: flex; gap: 8px; flex-wrap: wrap; }
.sw { width: 30px; height: 30px; border-radius: 50%; border: 2px solid var(--line); cursor: pointer; }
.sw.on { border-color: var(--red); }
.seg button { border: 1px solid var(--line); background: none; color: var(--text); padding: 6px 10px; font-size: 12px; cursor: pointer; }
.seg button.on { border-color: var(--text); background: var(--dark); color: #fff; }
input[type=range] { width: 100%; accent-color: var(--red); }
.small { font-size: 12px; color: var(--muted); line-height: 1.5; margin-top: 12px; }
.loading { padding: 120px 0; text-align: center; color: var(--muted); }
@media (max-width: 860px) {
  .print { grid-template-columns: 1fr; gap: 26px; padding-top: 20px; }
  .figure { position: static; padding: 20px; }
  .vir-grid { grid-template-columns: 1fr; }
  dl { grid-template-columns: 110px 1fr; }
  .wrap { padding: 0 16px; }
  header.hero { padding-top: 36px; }
  .grid { grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 28px 14px; }
  .card h3 { font-size: 15px; }
  .form { grid-template-columns: 1fr; }
  .print h2 { font-size: 32px; }
  .chips { gap: 2px 14px; }
  .tours { flex-wrap: nowrap; justify-content: flex-start; overflow-x: auto; scroll-snap-type: x mandatory; scrollbar-width: thin; }
  .tours .tour { flex: 0 0 84%; min-width: 0; scroll-snap-align: start; }
}
@media (prefers-reduced-motion: reduce) { .toast, .drawer, .card .frame img, .transcript p { transition: none; } }
`;

const ICON_PLAY = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 4.5v15l13-7.5z"/></svg>';
const ICON_PAUSE = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M6 4h4v16H6zM14 4h4v16h-4z"/></svg>';
const ICON_HEART = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20.5s-7.5-4.6-9.3-9.2C1.4 7.9 3.6 4.5 7 4.5c2 0 3.6 1.1 5 3 1.4-1.9 3-3 5-3 3.4 0 5.6 3.4 4.3 6.8-1.8 4.6-9.3 9.2-9.3 9.2z" fill="FILL" stroke="currentColor" stroke-width="1.6"/></svg>';
// Devices ship several voices; the neural ones ("Natural", "Online", "Premium",
// "Enhanced", Google's) sound far less robotic than the default. Prefer those,
// British English first.
function bestVoice() {
  const voices = window.speechSynthesis ? speechSynthesis.getVoices() : [];
  const score = (v) => (/en-GB/i.test(v.lang) ? 4 : /^en/i.test(v.lang) ? 1 : -9)
    + (/natural|neural|online|premium|enhanced/i.test(v.name) ? 6 : 0)
    + (/google/i.test(v.name) ? 3 : 0)
    + (/daniel|ryan|thomas|oliver|arthur|george|sonia|libby|serena|kate/i.test(v.name) ? 1 : 0)
    - (/compact|espeak|robot/i.test(v.name) ? 5 : 0);
  return voices.slice().sort((a, b) => score(b) - score(a))[0] || null;
}
if (typeof window !== 'undefined' && window.speechSynthesis) speechSynthesis.getVoices();

const heart = (on) => ICON_HEART.replace('FILL', on ? 'currentColor' : 'none');

// Wix can also load this file where there is no browser page (no window or
// HTMLElement); everything browser-only below is guarded so that is harmless.
const Base = typeof HTMLElement === 'undefined' ? class {} : HTMLElement;

class JvGallery extends Base {
  static get observedAttributes() { return ['rpc-result', 'rpc-ack', 'ready', 'analytics']; }

  constructor() {
    super();
    this.root = this.attachShadow({ mode: 'open' });
    if (!Object.prototype.hasOwnProperty.call(this, 'rpcHandler')) this.rpcHandler = null;
    this.pending = new Map();
    this.queue = [];
    this.players = new Map();
    this.sessionId = Math.random().toString(36).slice(2, 12);
    this.filters = { theme: '', price: '', signed: false, inStock: false, sort: 'featured' };
    this.shortlist = store.get('jvg-shortlist', []);
    this.contact = store.get('jvg-contact', { name: '', email: '', phone: '' });
    let vid = store.get('jvg-visitor', '');
    if (!/^[a-z0-9]{16,40}$/.test(vid)) {
      vid = Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => (b % 36).toString(36)).join('') + Date.now().toString(36);
      store.set('jvg-visitor', vid);
    }
    this.visitorId = vid;
    this.view = null; // { list:[ids], index, tour }
    this.options = new Map();
  }

  connectedCallback() {
    if (!document.querySelector(`link[href="${FONT_HREF}"]`)) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = FONT_HREF;
      document.head.appendChild(link);
    }
    this.root.innerHTML = `<style>${STYLE}</style><div class="gal"><div class="loading">Opening the gallery…</div></div>`;
    this.flushTimer = setInterval(() => this.flush(), FLUSH_MS);
    this.onHide = () => { if (document.visibilityState === 'hidden') { this.endDwell(); this.flush(); } };
    document.addEventListener('visibilitychange', this.onHide);
    queueMicrotask(() => { if (this.rpcHandler || this.hasAttribute('ready')) this.init(); });
  }

  disconnectedCallback() {
    clearInterval(this.flushTimer);
    document.removeEventListener('visibilitychange', this.onHide);
    this.flush();
  }

  attributeChangedCallback(name, _old, value) {
    if (name === 'rpc-ack' && value) {
      const p = this.pending.get(value);
      if (p) { p.acked = true; clearInterval(p.retry); }
      return;
    }
    if (name === 'ready' && value !== null && this.isConnected) this.init();
    if (name === 'rpc-result' && value) {
      const res = JSON.parse(value);
      const p = this.pending.get(res.id);
      if (!p) return;
      clearInterval(p.retry);
      this.pending.delete(res.id);
      if (res.ok) p.resolve(res.result); else p.reject(new Error(res.error || 'Something went wrong.'));
    }
  }

  rpc(method, ...args) {
    if (this.rpcHandler) return this.rpcHandler(method, args);
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    return new Promise((resolve, reject) => {
      const send = () => this.dispatchEvent(new CustomEvent('jv-rpc', { detail: { id, method, args }, bubbles: true, composed: true }));
      // Wix can attach the page code's listener a moment after the element is
      // told it is ready, so resend until the page code confirms (rpc-ack).
      const retry = setInterval(() => {
        const p = this.pending.get(id);
        if (p && !p.acked) send(); else clearInterval(retry);
      }, 1500);
      this.pending.set(id, { resolve, reject, retry });
      send();
      setTimeout(() => {
        const p = this.pending.get(id);
        if (!p) return;
        clearInterval(p.retry);
        this.pending.delete(id);
        reject(new Error('The Studio could not be reached. Please try again.'));
      }, 30000);
    });
  }

  async init() {
    if (this.started) return;
    this.started = true;
    try {
      this.data = await this.rpc('getGallery', this.visitorId);
    } catch (err) {
      this.root.querySelector('.gal').innerHTML = `<div class="loading">The gallery could not be loaded. Please refresh the page.<br><small>${esc(err.message)}</small></div>`;
      return;
    }
    const known = new Set(this.data.prints.map((p) => p.productId));
    this.shortlist = this.shortlist.filter((id) => known.has(id));
    this.shared = (this.getAttribute('shared-shortlist') || '').split(',').filter((id) => known.has(id));
    this.renderShell();
    this.track('gallery_open', '', 1);
    const open = this.getAttribute('open-print');
    const tour = this.getAttribute('start-tour');
    if (tour && this.data.tours.some((t) => t.slug === tour)) this.openTourIntro(tour);
    else if (open && known.has(open)) this.openPrint(open);
  }

  print(id) { return this.data.prints.find((p) => p.productId === id); }

  // ---------- analytics (only with consent) ----------
  get analyticsOn() { return this.getAttribute('analytics') === 'on'; }

  track(type, productId, value, extra = {}) {
    if (!this.analyticsOn) return;
    this.queue.push({ type, productId, value, sessionId: this.sessionId, ...extra });
  }

  flush() {
    if (!this.queue.length || !this.data) return;
    const batch = this.queue.splice(0, 50);
    this.rpc('logEvents', this.visitorId, batch).catch(() => {});
  }

  startDwell(pid) { this.endDwell(); this.dwell = { pid, since: Date.now() }; }

  endDwell() {
    if (!this.dwell) return;
    const secs = Math.round((Date.now() - this.dwell.since) / 1000);
    if (secs >= 2) this.track('print_dwell', this.dwell.pid, secs);
    this.dwell = null;
  }

  // ---------- shell ----------
  renderShell() {
    const d = this.data;
    const g = this.root.querySelector('.gal');
    g.innerHTML = `
      <header class="hero"><div class="wrap">
        <div class="eyebrow">Jack Vettriano Studio</div>
        <h1>The Gallery</h1>
        <hr class="rule">
        <p class="lede">Every print here has its story. Press play to hear it, see the print at true size on your own wall, and save the ones you love. When you are ready, buy it, reserve it for 48 hours or make us an offer.</p>
        ${this.shared.length ? `<div class="banner"><span>Someone has shared ${this.shared.length} print${this.shared.length === 1 ? '' : 's'} with you.</span><button class="btn small" data-act="shared">See them</button></div>` : ''}
      </div></header>
      ${d.tours.length ? `<section class="tours-wrap"><div class="wrap"><div class="eyebrow center">Guided audio tours</div><div class="tours">${d.tours.map((t) => this.tourCardHtml(t)).join('')}</div></div></section>` : ''}
      <div class="toolbar"><div class="wrap">
        <div class="chips" role="group" aria-label="Themes">
          <button class="chip" data-theme="" aria-pressed="true">All works</button>
          ${d.themes.map((t) => `<button class="chip" data-theme="${esc(t)}" aria-pressed="false">${esc(t)}</button>`).join('')}
        </div>
        <div class="tools">
          <label class="toggle"><input type="checkbox" id="fSigned"> Signed by the artist</label>
          <label class="toggle"><input type="checkbox" id="fStock"> In stock</label>
          <select id="fPrice" aria-label="Price">${Object.entries(PRICE_BANDS).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select>
          <select id="fSort" aria-label="Sort">${Object.entries(SORTS).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select>
          <button class="btn small quiet" data-act="shortlist">${heart(true)} Shortlist <span id="slCount">${this.shortlist.length}</span></button>
          <button class="btn small quiet" data-act="requests" id="reqBtn">My requests <span id="rqCount">${d.me.requests.length}</span></button>
        </div>
      </div></div>
      <main class="wrap"><div class="count" id="count"></div><div class="grid" id="grid"></div></main>
      <div class="overlay" id="panel" role="dialog" aria-modal="true" aria-label="Print"></div>
      <div class="scrim" id="scrim"></div>
      <aside class="drawer" id="drawer" aria-label="Shortlist"></aside>
      <div class="modal" id="modal" role="dialog" aria-modal="true"><div class="sheet" id="sheet"></div></div>
      <div class="toast" id="toast" role="status"></div>`;
    if (!this.bound) this.bind();
    this.renderGrid();
  }

  tourCardHtml(t) {
    const prints = t.productIds.map((id) => this.print(id)).filter(Boolean);
    const mins = Math.max(1, Math.round(prints.reduce((s, p) => s + (p.story.estDurationSec || 60), 0) / 60));
    return `<article class="tour">
      <div class="eyebrow">Guided tour</div>
      <h3>${esc(t.title)}</h3>
      <p>${esc(t.intro)}</p>
      <div class="thumbs">${prints.slice(0, 6).map((p) => `<img src="${esc(p.image)}" alt="" loading="lazy">`).join('')}</div>
      <div class="meta">${prints.length} prints · about ${mins} minutes with the stories</div>
      <div><button class="btn small solid" data-tour="${esc(t.slug)}">Start the tour</button></div>
    </article>`;
  }

  filtered() {
    const f = this.filters;
    const band = (p) => (p.price < 700 ? 'low' : p.price <= 1500 ? 'mid' : 'high');
    const list = this.data.prints.filter((p) => (!f.theme || p.themes.includes(f.theme))
      && (!f.price || band(p) === f.price)
      && (!f.signed || p.story.signed)
      && (!f.inStock || (p.inStock && p.availability !== 'reserved')));
    const rank = (p) => (p.availability === 'available' || p.availability === 'held_by_you' ? 0 : p.availability === 'hold_pending' ? 1 : 2);
    const sorts = {
      featured: (a, b) => rank(a) - rank(b) || (b.themes.includes('Final editions') - a.themes.includes('Final editions')) || a.title.localeCompare(b.title),
      'price-asc': (a, b) => a.price - b.price,
      'price-desc': (a, b) => b.price - a.price,
      title: (a, b) => a.title.localeCompare(b.title),
    };
    return list.sort(sorts[f.sort]);
  }

  tagFor(p) {
    if (p.availability === 'reserved') return '<span class="tag">Reserved</span>';
    if (p.availability === 'held_by_you') return '<span class="tag gold">Held for you</span>';
    if (p.availability === 'out_of_stock') return '<span class="tag">Sold out · we can source</span>';
    if (p.themes.includes('Final editions')) return '<span class="tag gold">Final edition</span>';
    if (/proof/i.test(p.ribbon)) return `<span class="tag gold">${esc(p.ribbon)}</span>`;
    return '';
  }

  renderGrid() {
    const list = this.filtered();
    this.root.getElementById('count').textContent = `${list.length} work${list.length === 1 ? '' : 's'}${this.filters.theme ? ` in ${this.filters.theme}` : ''}`;
    this.root.getElementById('grid').innerHTML = list.length ? list.map((p) => `
      <article class="card">
        <button class="frame" data-open="${esc(p.productId)}" aria-label="Open ${esc(p.title)}"><img src="${esc(p.image)}" alt="${esc(p.title)} by Jack Vettriano" loading="lazy"></button>
        ${this.tagFor(p)}
        <button class="heart" data-heart="${esc(p.productId)}" aria-pressed="${this.shortlist.includes(p.productId)}" aria-label="Save ${esc(p.title)} to your shortlist">${heart(this.shortlist.includes(p.productId))}</button>
        <h3>${esc(p.title)}</h3>
        <div class="line"><span>${money(p.price)}</span><span class="sub">${p.story.signed ? 'Signed' : /estate/i.test(p.story.edition) ? 'Estate stamped' : ''}</span></div>
        <div class="sub">${esc(p.story.edition.split(/[;(]/)[0])}</div>
      </article>`).join('') : '<div class="empty">No works match these filters. Try another theme or price.</div>';
  }

  refreshCounts() {
    this.root.getElementById('slCount').textContent = this.shortlist.length;
    this.root.getElementById('rqCount').textContent = this.data.me.requests.length;
  }

  // ---------- events ----------
  bind() {
    this.bound = true;
    const r = this.root;
    r.addEventListener('click', (e) => this.onClick(e));
    r.addEventListener('change', (e) => {
      const t = e.target;
      if (t.id === 'fSigned') this.filters.signed = t.checked;
      else if (t.id === 'fStock') this.filters.inStock = t.checked;
      else if (t.id === 'fPrice') this.filters.price = t.value;
      else if (t.id === 'fSort') this.filters.sort = t.value;
      else if (t.id === 'optSel') { this.renderPrice(t.dataset.pid); return; } else return;
      this.renderGrid();
    });
    r.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (r.getElementById('modal').classList.contains('open')) this.closeModal();
        else if (r.getElementById('drawer').classList.contains('open')) this.closeDrawer();
        else if (this.view) this.closePrint();
      }
      if (this.view && !r.getElementById('modal').classList.contains('open') && !/INPUT|TEXTAREA|SELECT/.test((e.composedPath()[0] || {}).tagName || '')) {
        if (e.key === 'ArrowRight') this.step(1);
        if (e.key === 'ArrowLeft') this.step(-1);
      }
    });
  }

  onClick(e) {
    const b = e.target.closest('button, [data-open], .bar, .scrim, .modal');
    if (!b) return;
    const d = b.dataset;
    if (b.classList.contains('modal') && e.target === b) return this.closeModal();
    if (b.classList.contains('scrim')) return this.closeDrawer();
    if (b.classList.contains('bar')) return this.seek(b, e);
    if (d.theme !== undefined) {
      this.filters.theme = d.theme;
      this.root.querySelectorAll('[data-theme]').forEach((c) => c.setAttribute('aria-pressed', String(c === b)));
      this.track('filter', '', 1);
      return this.renderGrid();
    }
    if (d.open) return this.openPrint(d.open);
    if (d.heart) return this.toggleShortlist(d.heart);
    if (d.tour) return this.openTourIntro(d.tour);
    if (d.req) return this.openRequest(d.req, d.pid);
    if (d.vir) return this.openViewInRoom(d.vir);
    if (d.transcript) return this.toggleTranscript(b);
    if (d.counter) return this.answerCounter(d.counter, d.accept === '1', b);
    if (d.basket) return this.addToBasket(d.basket, b);
    if (b.classList.contains('play')) return this.togglePlay(b.closest('.player').dataset.player);
    const act = d.act;
    if (act === 'close') this.closePrint();
    else if (act === 'prev') this.step(-1);
    else if (act === 'next') this.step(1);
    else if (act === 'shortlist') this.openDrawer('shortlist');
    else if (act === 'requests') this.openDrawer('requests');
    else if (act === 'shared') this.openDrawer('shared');
    else if (act === 'closeDrawer') this.closeDrawer();
    else if (act === 'compare') this.openCompare(d.ids ? d.ids.split(',') : this.shortlist);
    else if (act === 'share') this.shareShortlist();
    else if (act === 'askShortlist') this.openRequest('shortlist');
    else if (act === 'saveShared') { this.shared.forEach((id) => { if (!this.shortlist.includes(id)) this.toggleShortlist(id); }); this.openDrawer('shortlist'); }
    else if (act === 'closeModal') this.closeModal();
    else if (act === 'tourGo') this.startTour(d.slug);
    else if (act === 'tourPause') this.pauseTour();
    else if (act === 'tourExit') this.closePrint();
    else if (act === 'nextNow') this.step(1);
    else if (act === 'viewBasket') this.viewBasket();
  }

  // The page code opens the site's side basket, as its basket icon does.
  async viewBasket() {
    try { await this.rpc('openBasket'); } catch (err) { this.toast(esc(err.message)); }
  }

  toast(html, ms = 4200) {
    const t = this.root.getElementById('toast');
    t.innerHTML = html;
    t.classList.add('show');
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => t.classList.remove('show'), ms);
  }

  // ---------- shortlist ----------
  toggleShortlist(pid) {
    const on = !this.shortlist.includes(pid);
    this.shortlist = on ? [pid, ...this.shortlist] : this.shortlist.filter((x) => x !== pid);
    store.set('jvg-shortlist', this.shortlist);
    this.track(on ? 'shortlist_add' : 'shortlist_remove', pid, 1);
    this.root.querySelectorAll(`[data-heart="${CSS.escape(pid)}"]`).forEach((h) => {
      h.setAttribute('aria-pressed', String(on));
      if (h.classList.contains('heart')) h.innerHTML = heart(on);
      else if (h.classList.contains('btn')) h.innerHTML = `${heart(on)} ${on ? 'Saved to shortlist' : 'Save to shortlist'}`;
    });
    this.refreshCounts();
    if (this.root.getElementById('drawer').classList.contains('open') && this.drawerMode === 'shortlist') this.openDrawer('shortlist');
    if (on) this.toast(`Saved to your shortlist. <a href="#" data-act-link="shortlist">View shortlist</a>`);
    const link = this.root.querySelector('[data-act-link]');
    if (link) link.onclick = (ev) => { ev.preventDefault(); this.openDrawer('shortlist'); };
  }

  openDrawer(mode) {
    this.drawerMode = mode;
    const dr = this.root.getElementById('drawer');
    const rows = (ids) => ids.map((id) => this.print(id)).filter(Boolean).map((p) => `
      <div class="sl"><img src="${esc(p.image)}" alt="">
        <div><button class="t" data-open="${esc(p.productId)}">${esc(p.title)}</button><div class="s">${money(p.price)} · ${esc(this.statusLabel(p))}</div></div>
        ${mode === 'shortlist' ? `<button class="iconbtn" data-heart="${esc(p.productId)}" aria-label="Remove ${esc(p.title)}">×</button>` : ''}
      </div>`).join('');
    if (mode === 'requests') {
      const reqs = this.data.me.requests;
      dr.innerHTML = `<header><h3>My requests</h3><button class="iconbtn" data-act="closeDrawer" aria-label="Close">×</button></header>
        <div class="body">${reqs.length ? `<div class="history">${reqs.map((q) => this.requestHtml(q, true)).join('')}</div>`
          : '<p class="small">Holds, offers and questions you send to the Studio appear here with the Studio’s replies.</p>'}</div>`;
      this.rpc('getMyActivity', this.visitorId).then((me) => {
        if (JSON.stringify(me.requests) !== JSON.stringify(this.data.me.requests)) { this.data.me = me; this.refreshCounts(); if (this.drawerMode === 'requests') this.openDrawer('requests'); }
      }).catch(() => {});
    } else if (mode === 'shared') {
      dr.innerHTML = `<header><h3>Shared with you</h3><button class="iconbtn" data-act="closeDrawer" aria-label="Close">×</button></header>
        <div class="body">${rows(this.shared)}</div>
        <footer><button class="btn small solid" data-act="saveShared">Save to my shortlist</button>${this.shared.length > 1 ? `<button class="btn small" data-act="compare" data-ids="${esc(this.shared.join(','))}">Compare</button>` : ''}</footer>`;
    } else {
      const n = this.shortlist.length;
      dr.innerHTML = `<header><h3>Your shortlist</h3><button class="iconbtn" data-act="closeDrawer" aria-label="Close">×</button></header>
        <div class="body">${n ? rows(this.shortlist) : '<p class="small">Tap the heart on any print to save it here. Your shortlist stays on this device.</p>'}</div>
        ${n ? `<footer>
          ${n > 1 ? '<button class="btn small" data-act="compare">Compare side by side</button>' : ''}
          <button class="btn small" data-act="share">Copy a link to share</button>
          <button class="btn small solid" data-act="askShortlist">Ask the Studio about these</button>
        </footer>` : ''}`;
    }
    dr.classList.add('open');
    this.root.getElementById('scrim').classList.add('open');
    const first = dr.querySelector('button');
    if (first) first.focus();
  }

  closeDrawer() {
    this.root.getElementById('drawer').classList.remove('open');
    this.root.getElementById('scrim').classList.remove('open');
    this.drawerMode = null;
  }

  shareShortlist() {
    const base = this.getAttribute('share-url') || (location.origin + location.pathname);
    const url = `${base}?shortlist=${this.shortlist.join(',')}`;
    this.track('shortlist_share', '', this.shortlist.length);
    const done = () => this.toast('Link copied. Send it to anyone you would like to share your shortlist with.');
    if (navigator.clipboard) navigator.clipboard.writeText(url).then(done, () => this.showLink(url));
    else this.showLink(url);
  }

  showLink(url) {
    this.openModal(`<h3>Share your shortlist</h3><p>Copy this link and send it to anyone.</p>
      <input type="text" id="shareUrl" value="${esc(url)}" readonly style="width:100%">
      <div class="actions"><button class="btn" data-act="closeModal">Done</button></div>`);
    const i = this.root.getElementById('shareUrl');
    i.focus(); i.select();
  }

  openCompare(ids) {
    const ps = ids.map((id) => this.print(id)).filter(Boolean);
    const row = (label, fn) => `<tr><th>${label}</th>${ps.map((p) => `<td>${fn(p)}</td>`).join('')}</tr>`;
    this.openModal(`<h3>Compare</h3>
      <div class="compare"><table>
        <tr><th></th>${ps.map((p) => `<td><img src="${esc(p.image)}" alt=""><div style="margin-top:8px"><button class="linkbtn" data-open="${esc(p.productId)}">${esc(p.title)}</button></div></td>`).join('')}</tr>
        ${row('Price', (p) => money(p.price))}
        ${row('Edition', (p) => esc(p.story.edition))}
        ${row('Signature', (p) => (p.story.signed ? 'Signed by the artist' : /estate/i.test(p.story.edition) ? 'Estate stamp' : 'Unsigned'))}
        ${row('Medium', (p) => esc(p.story.medium))}
        ${row('Size', (p) => esc(sizeText(p.story.framedSizeCm || p.framedSizeFromStore) ? `Framed ${sizeText(p.story.framedSizeCm || p.framedSizeFromStore)}` : sizeText(p.story.mountSizeCm) ? `Mount ${sizeText(p.story.mountSizeCm)}` : sizeText(p.story.imageSizeCm)))}
        ${row('Availability', (p) => esc(this.statusLabel(p)))}
        ${row('Themes', (p) => esc(p.themes.join(', ')))}
      </table></div>
      <div class="actions"><button class="btn" data-act="closeModal">Close</button></div>`, true);
  }

  // ---------- print view ----------
  statusLabel(p) {
    return {
      available: 'Available',
      held_by_you: p.holdExpiresAt ? `Held for you until ${when(p.holdExpiresAt)}` : 'Held for you',
      hold_pending: 'Hold requested. The Studio will confirm shortly.',
      reserved: 'Reserved for another collector',
      out_of_stock: 'Sold out. We can try to source an example for you.',
    }[p.availability] || '';
  }

  openPrint(pid, tour) {
    this.closeDrawer();
    this.closeModal();
    const list = tour ? tour.productIds : this.filtered().map((p) => p.productId);
    const ids = list.includes(pid) ? list : [pid, ...list];
    this.view = { list: ids, index: ids.indexOf(pid), tour: tour || null };
    this.lastFocus = this.root.activeElement;
    this.renderPrint();
    this.root.getElementById('panel').classList.add('open');
  }

  closePrint() {
    this.endDwell();
    this.stopAll();
    clearInterval(this.countdown);
    this.view = null;
    this.root.getElementById('panel').classList.remove('open');
    this.renderGrid();
    if (this.lastFocus && this.lastFocus.isConnected) this.lastFocus.focus();
  }

  step(dir) {
    if (!this.view) return;
    const next = this.view.index + dir;
    clearInterval(this.countdown);
    if (this.view.tour && next >= this.view.list.length) return this.finishTour();
    if (next < 0 || next >= this.view.list.length) return;
    this.stopAll();
    this.view.index = next;
    this.renderPrint();
    if (this.view.tour && !this.view.tour.paused) this.togglePlay(this.view.list[next]);
  }

  renderPrint() {
    const v = this.view;
    const pid = v.list[v.index];
    const p = this.print(pid);
    const s = p.story;
    const panel = this.root.getElementById('panel');
    this.startDwell(pid);
    this.track('print_open', pid, 1);
    const hasAudio = !!(s.audioUrl || this.hasAttribute('speech-fallback'));
    const badges = [];
    if (s.signed) badges.push('<span class="badge gold">Hand-signed</span>');
    if (/estate/i.test(s.edition)) badges.push('<span class="badge gold">Estate stamped</span>');
    if (/proof/i.test(p.ribbon)) badges.push(`<span class="badge gold">${esc(p.ribbon)}</span>`);
    if (/silkscreen/i.test(s.medium)) badges.push('<span class="badge">Silkscreen</span>');
    if (/lacquer|board mounted/i.test(s.medium)) badges.push('<span class="badge">Original size, no glass</span>');
    const t = v.tour;
    panel.innerHTML = `
      <div class="ptop"><div class="wrap">
        <button class="iconbtn" data-act="close" aria-label="Back to the gallery">×</button>
        <div class="where">${t ? `<strong>${esc(t.title)}</strong> · print ${v.index + 1} of ${v.list.length}` : `${v.index + 1} of ${v.list.length}`}</div>
        <button class="iconbtn" data-act="prev" aria-label="Previous print" ${v.index === 0 ? 'disabled' : ''}>‹</button>
        <button class="iconbtn" data-act="next" aria-label="Next print" ${!t && v.index === v.list.length - 1 ? 'disabled' : ''}>›</button>
      </div></div>
      ${t ? `<div class="tourbar"><div class="wrap">
        <span>Guided tour</span><div class="prog"><i style="width:${((v.index + 1) / v.list.length) * 100}%"></i></div>
        <button class="btn small quiet" data-act="tourPause">${t.paused ? 'Resume tour' : 'Pause tour'}</button>
        <button class="btn small quiet" data-act="tourExit">Leave tour</button>
      </div></div>` : ''}
      <div class="wrap"><div class="print">
        <div class="figure"><img src="${esc(p.image)}" alt="${esc(p.title)} by Jack Vettriano"></div>
        <div>
          <div class="eyebrow">${esc(p.themes.join(' · ') || 'Jack Vettriano')}</div>
          <h2>${esc(p.title)}</h2>
          <div class="badges">${badges.join('')}</div>
          <div class="price" id="price-${esc(pid)}">${money(p.price)}</div>
          <div class="status ${esc(p.availability)}" id="status-${esc(pid)}"><span class="dot"></span>${esc(this.statusLabel(p))}</div>
          <div id="actions-${esc(pid)}">${this.actionsHtml(p)}</div>
          <div class="player" data-player="${esc(pid)}">
            <button class="play" aria-label="Play the story of ${esc(p.title)}" ${hasAudio ? '' : 'disabled'}>${ICON_PLAY}</button>
            <div><div class="ptitle">The story behind the print</div>
              <div class="psub">${s.audioUrl ? `Narrated · ${clock(s.estDurationSec || 60)}` : hasAudio ? 'Read aloud by your device · narration coming soon' : 'Narration coming soon. Read the story below.'}</div>
              <div class="bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><i></i></div></div>
          </div>
          <button class="linkbtn" data-transcript="${esc(pid)}" aria-expanded="false">Read the story</button>
          <div class="transcript" id="t-${esc(pid)}">${paragraphs(s.transcript).map((x) => `<p>${esc(x)}</p>`).join('')}</div>
          <div id="next-${esc(pid)}"></div>
          ${this.provenanceHtml(p)}
          <div class="history" id="hist-${esc(pid)}">${this.historyHtml(pid)}</div>
        </div>
      </div></div>`;
    panel.scrollTop = 0;
    panel.querySelector('details.prov').addEventListener('toggle', (e) => { if (e.target.open) this.track('provenance_open', pid, 1); });
    panel.querySelector('[data-act="close"]').focus({ preventScroll: true });
    this.loadOptions(pid);
  }

  actionsHtml(p) {
    const id = esc(p.productId);
    const saved = this.shortlist.includes(p.productId);
    const offerOpen = this.data.me.requests.some((r) => r.productId === p.productId && r.type === 'offer' && ['pending', 'countered', 'accepted'].includes(r.status));
    const btns = [];
    if (p.inStock && (p.availability === 'available' || p.availability === 'held_by_you')) {
      btns.push(`<button class="btn solid" data-basket="${id}">Add to basket</button>`);
    }
    if (p.availability === 'available') btns.push(`<button class="btn" data-req="hold" data-pid="${id}">Reserve for 48 hours</button>`);
    if (p.inStock && p.availability !== 'reserved' && !offerOpen) btns.push(`<button class="btn" data-req="offer" data-pid="${id}">Make an offer</button>`);
    btns.push(`<button class="btn" data-req="question" data-pid="${id}">${p.availability === 'out_of_stock' || p.availability === 'reserved' ? 'Ask us to find one' : 'Ask a question'}</button>`);
    btns.push(`<button class="btn quiet" data-vir="${id}">See it on your wall</button>`);
    btns.push(`<button class="btn quiet" data-heart="${id}" aria-pressed="${saved}">${heart(saved)} ${saved ? 'Saved to shortlist' : 'Save to shortlist'}</button>`);
    return `<div class="actions">${btns.join('')}</div>`;
  }

  async loadOptions(pid) {
    const p = this.print(pid);
    if (!p.hasOptions || !p.inStock) return;
    let opts = this.options.get(pid);
    if (!opts) {
      try { opts = await this.rpc('getPrintOptions', pid); } catch (e) { return; }
      this.options.set(pid, opts);
    }
    if (!opts.length || !this.view || this.view.list[this.view.index] !== pid) return;
    this.renderPrice(pid);
  }

  renderPrice(pid) {
    const p = this.print(pid);
    const opts = this.options.get(pid) || [];
    const box = this.root.getElementById(`price-${pid}`);
    if (!box) return;
    const sel = this.root.getElementById('optSel');
    const chosen = sel ? sel.value : (opts.find((o) => /unframed/i.test(o.label)) || opts[0] || {}).variantId;
    const opt = opts.find((o) => o.variantId === chosen) || opts[0];
    if (opts.length < 2) { box.textContent = money(opt && opt.price != null ? opt.price : p.price); return; }
    box.innerHTML = `<span id="priceVal">${money(opt.price != null ? opt.price : p.price)}</span>
      <select id="optSel" data-pid="${esc(pid)}" aria-label="Choose framing">${opts.map((o) => `<option value="${esc(o.variantId)}" ${o.variantId === opt.variantId ? 'selected' : ''} ${o.inStock ? '' : 'disabled'}>${esc(o.label)}${o.price != null ? ` · ${money(o.price)}` : ''}</option>`).join('')}</select>`;
  }

  async addToBasket(pid, btn) {
    const sel = this.root.getElementById('optSel');
    const variantId = sel ? sel.value : ((this.options.get(pid) || [])[0] || {}).variantId;
    btn.disabled = true;
    const label = btn.textContent;
    btn.textContent = 'Adding…';
    try {
      await this.rpc('addToBasket', pid, variantId || null);
      this.track('add_to_basket', pid, 1);
      this.toast('Added to your basket. <button class="linkbtn" data-act="viewBasket">View basket</button>', 6000);
    } catch (err) {
      // Fall back to the store's own product page, which always works.
      const p = this.print(pid);
      this.toast(p && p.productUrl
        ? `We couldn't add it to your basket just now. <a href="${esc(p.productUrl)}" target="_top">Buy it on the product page</a>`
        : esc(err.message), 10000);
    }
    btn.disabled = false;
    btn.textContent = label;
  }

  provenanceHtml(p) {
    const s = p.story;
    const framed = s.framedSizeCm || p.framedSizeFromStore;
    const rows = [
      ['Edition', s.edition],
      ['Signature', s.signed ? 'Signed and numbered by Jack Vettriano' : /estate/i.test(s.edition) ? 'Numbered and embossed with the Estate of Jack Vettriano stamp' : ''],
      ['Medium', s.medium],
      ['Image size', sizeText(s.imageSizeCm)],
      ['Mount size', sizeText(s.mountSizeCm)],
      ['Framed size', sizeText(framed)],
      ['Authenticity', 'Certificate of authenticity included'],
      ['Delivery', 'Fully insured UK delivery; international on enquiry'],
    ].filter((r) => r[1]);
    return `<details class="prov"><summary>Provenance &amp; edition</summary>
      <dl>${rows.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl>
      ${p.productUrl ? `<p class="small"><a href="${esc(p.productUrl)}" target="_top">Full details on the product page</a></p>` : ''}
    </details>`;
  }

  requestHtml(r, withTitle) {
    const names = { hold: '48-hour reservation', question: 'Your question', offer: `Your offer of ${r.offerPrice ? money(r.offerPrice) : ''}`, shortlist: 'Question about your shortlist' };
    const pill = { pending: 'With the Studio', confirmed: r.type === 'hold' ? 'Reserved for you' : r.type === 'offer' ? 'Offer accepted' : 'Confirmed', declined: 'Not possible this time', answered: 'Answered', expired: 'Reservation ended', countered: 'The Studio has replied', accepted: 'You accepted', declined_by_visitor: 'You declined' };
    return `<div class="req">
      <div class="row"><span>${esc(names[r.type])}${withTitle ? ` · <strong>${esc(r.printTitle)}</strong>` : ''} · ${esc(day(r.createdAt))}</span><span class="pill ${esc(r.status)}">${esc(pill[r.status] || r.status)}</span></div>
      ${r.message ? `<div class="msg">${esc(r.message)}</div>` : ''}
      ${r.status === 'confirmed' && r.type === 'hold' && r.holdExpiresAt ? `<div class="msg">Held for you until ${esc(when(r.holdExpiresAt))}.</div>` : ''}
      ${r.reply ? `<div class="reply"><strong>The Studio:</strong> ${esc(r.reply)}</div>` : ''}
      ${r.status === 'countered' ? `<div class="counter"><span>We can offer it to you at <strong>${money(r.counterPrice)}</strong>.</span>
        <button class="btn small solid" data-counter="${esc(r._id)}" data-accept="1">Accept ${money(r.counterPrice)}</button>
        <button class="btn small" data-counter="${esc(r._id)}" data-accept="0">No, thank you</button></div>` : ''}
      ${r.status === 'accepted' ? `<div class="msg">Thank you. The Studio will be in touch to arrange payment and delivery at ${money(r.counterPrice)}.</div>` : ''}
    </div>`;
  }

  historyHtml(pid) {
    return this.data.me.requests.filter((r) => r.productId === pid || (r.type === 'shortlist' && r.productIds.includes(pid)))
      .map((r) => this.requestHtml(r, false)).join('');
  }

  refreshPrintParts(pid) {
    const p = this.print(pid);
    const set = (id, html) => { const el = this.root.getElementById(id); if (el) el.innerHTML = html; };
    const st = this.root.getElementById(`status-${pid}`);
    if (st) { st.className = `status ${p.availability}`; st.innerHTML = `<span class="dot"></span>${esc(this.statusLabel(p))}`; }
    set(`actions-${pid}`, this.actionsHtml(p));
    set(`hist-${pid}`, this.historyHtml(pid));
    this.refreshCounts();
  }

  async answerCounter(requestId, accept, btn) {
    btn.disabled = true;
    try {
      this.data.me = await this.rpc('answerCounterOffer', this.visitorId, requestId, accept);
      this.toast(accept ? 'Thank you. The Studio will be in touch to complete your purchase.' : 'Thank you for letting us know.');
      if (this.view) this.refreshPrintParts(this.view.list[this.view.index]);
      if (this.drawerMode === 'requests') this.openDrawer('requests');
      this.refreshCounts();
    } catch (err) {
      this.toast(esc(err.message));
      btn.disabled = false;
    }
  }

  // ---------- requests (lead capture) ----------
  openModal(html, wide) {
    const sheet = this.root.getElementById('sheet');
    sheet.className = `sheet${wide ? ' wide' : ''}`;
    sheet.innerHTML = html;
    this.modalReturn = this.root.activeElement;
    this.root.getElementById('modal').classList.add('open');
  }

  closeModal() {
    const m = this.root.getElementById('modal');
    if (!m || !m.classList.contains('open')) return;
    m.classList.remove('open');
    if (this.stageObserver) this.stageObserver.disconnect();
    if (this.modalReturn && this.modalReturn.isConnected) this.modalReturn.focus();
  }

  openRequest(type, pid) {
    const p = pid ? this.print(pid) : null;
    const minOffer = p ? Math.ceil((p.price * (this.data.minOfferShare || 0)) / 5) * 5 : 0;
    const copy = {
      hold: [`Reserve ${p && p.title}`, 'We will hold this print for you for 48 hours while you decide. Nothing is charged, and the Studio will confirm personally.', 'Anything we should know? (optional)', 'Request reservation'],
      offer: [`Make an offer on ${p && p.title}`, `Listed at ${p && money(p.price)}. Tell us what you would like to pay and the Studio will reply, usually within one working day.`, 'Anything else? (optional)', 'Send offer'],
      question: [`Ask about ${p && p.title}`, 'Framing, edition numbers, delivery, or how it would look in your room: the Studio will reply by email and here in the gallery.', 'Your question', 'Send question'],
      shortlist: [`Ask about your shortlist`, `We will see the ${this.shortlist.length} print${this.shortlist.length === 1 ? '' : 's'} you have saved and can advise on which would suit you, framing, and any private terms for more than one.`, 'What would you like to know?', 'Send to the Studio'],
    }[type];
    const c = this.contact;
    this.openModal(`<h3>${esc(copy[0])}</h3><p>${esc(copy[1])}</p>
      <form class="form" id="reqForm" novalidate>
        ${type === 'offer' ? `<label class="full">Your offer (£)<input type="number" id="fOffer" min="${minOffer}" step="5" inputmode="numeric" placeholder="${minOffer ? `${minOffer} or more` : ''}"></label>` : ''}
        <label class="full">${esc(copy[2])}<textarea id="fMsg" maxlength="2000"></textarea></label>
        <label>Your name<input type="text" id="fName" autocomplete="name" value="${esc(c.name)}"></label>
        <label>Email<input type="email" id="fEmail" autocomplete="email" value="${esc(c.email)}"></label>
        <label class="full">Phone (optional, if you would like a call)<input type="tel" id="fPhone" autocomplete="tel" value="${esc(c.phone)}"></label>
      </form>
      <p class="fine">The Studio uses these details only to reply about these prints. ${this.analyticsOn ? 'So we can advise you well, your reply will include which stories and prints you looked at in the gallery.' : ''}</p>
      <div class="err" id="fErr"></div>
      <div class="actions"><button class="btn" data-act="closeModal">Cancel</button><button class="btn solid" id="fSend">${esc(copy[3])}</button></div>`);
    const $ = (id) => this.root.getElementById(id);
    ($('fOffer') || $('fMsg')).focus();
    $('reqForm').addEventListener('submit', (e) => e.preventDefault());
    $('fSend').onclick = async () => {
      const contact = { name: $('fName').value.trim(), email: $('fEmail').value.trim(), phone: $('fPhone').value.trim() };
      const message = $('fMsg').value.trim();
      const offerPrice = $('fOffer') ? Number($('fOffer').value) : null;
      const fail = (m) => { $('fErr').textContent = m; };
      if (type === 'offer' && !(offerPrice > 0)) return fail('Please enter your offer.');
      if (type === 'question' && !message) return fail('Please write your question.');
      if (!contact.name) return fail('Please tell us your name.');
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(contact.email)) return fail('Please enter a valid email address so the Studio can reply.');
      const btn = $('fSend');
      btn.disabled = true;
      btn.textContent = 'Sending…';
      try {
        const input = type === 'shortlist' ? { type, productIds: this.shortlist, message } : { type, productId: pid, message, offerPrice };
        this.data.me = await this.rpc('submitRequest', this.visitorId, contact, input);
        this.contact = contact;
        store.set('jvg-contact', contact);
        if (type === 'hold') p.availability = 'hold_pending';
        this.closeModal();
        if (pid && this.view) this.refreshPrintParts(pid);
        this.refreshCounts();
        this.toast({ hold: 'Thank you. The Studio will confirm your reservation shortly.', offer: 'Thank you. Your offer is with the Studio.', question: 'Sent. The Studio will reply by email and in My requests.', shortlist: 'Sent. The Studio will be in touch about your shortlist.' }[type], 5000);
      } catch (err) {
        fail(err.message);
        btn.disabled = false;
        btn.textContent = copy[3];
      }
    };
  }

  // ---------- tours ----------
  openTourIntro(slug) {
    const t = this.data.tours.find((x) => x.slug === slug);
    const prints = t.productIds.map((id) => this.print(id)).filter(Boolean);
    this.openModal(`<div class="eyebrow">Guided tour</div><h3>${esc(t.title)}</h3><p>${esc(t.intro)}</p>
      <p>${prints.length} prints: ${esc(prints.map((p) => p.title).join(', '))}. Each story plays in turn, then the tour moves on by itself. You can pause, skip or leave at any time.</p>
      <div class="actions"><button class="btn" data-act="closeModal">Not now</button><button class="btn solid" data-act="tourGo" data-slug="${esc(slug)}">Begin the tour</button></div>`);
  }

  startTour(slug) {
    const t = this.data.tours.find((x) => x.slug === slug);
    this.track('tour_start', '', 1, { tourSlug: slug });
    this.openPrint(t.productIds[0], { ...t, paused: false });
    this.togglePlay(t.productIds[0]);
  }

  // Pausing stops the narration and the move to the next print; resuming
  // carries on from the same point (or moves on if the story had finished).
  pauseTour() {
    const t = this.view && this.view.tour;
    if (!t) return;
    const pid = this.view.list[this.view.index];
    const pl = this.players.get(pid);
    const playing = !!pl && ((pl.audio && !pl.audio.paused) || !!pl.speaking);
    const finished = !!pl && !!pl.audio && pl.audio.ended;
    t.paused = !t.paused;
    clearInterval(this.countdown);
    this.root.getElementById(`next-${pid}`).innerHTML = '';
    if (t.paused && playing) this.togglePlay(pid);
    if (!t.paused) {
      if (finished) this.storyEnded(pid);
      else if (!playing) this.togglePlay(pid);
    }
    this.root.querySelectorAll('.tourbar [data-act="tourPause"]').forEach((b) => { b.textContent = t.paused ? 'Resume tour' : 'Pause tour'; });
  }

  storyEnded(pid) {
    const v = this.view;
    if (!v || !v.tour || v.tour.paused || v.list[v.index] !== pid) return;
    const isLast = v.index === v.list.length - 1;
    const nextP = isLast ? null : this.print(v.list[v.index + 1]);
    let left = TOUR_PAUSE_SEC;
    const box = this.root.getElementById(`next-${pid}`);
    const paint = () => {
      box.innerHTML = `<div class="next-up"><span>${isLast ? 'That is the end of the tour.' : `Next: <strong>${esc(nextP.title)}</strong> in ${left} seconds`}</span>
        <button class="btn small solid" data-act="nextNow">${isLast ? 'Finish' : 'Go now'}</button><button class="btn small quiet" data-act="tourPause">Stay here</button></div>`;
    };
    paint();
    clearInterval(this.countdown);
    this.countdown = setInterval(() => {
      left -= 1;
      if (left <= 0) { clearInterval(this.countdown); this.step(1); } else paint();
    }, 1000);
  }

  finishTour() {
    const t = this.view.tour;
    this.track('tour_complete', '', 1, { tourSlug: t.slug });
    this.endDwell();
    this.stopAll();
    const others = this.data.tours.filter((x) => x.slug !== t.slug);
    this.root.getElementById('panel').innerHTML = `
      <div class="ptop"><div class="wrap"><button class="iconbtn" data-act="close" aria-label="Back to the gallery">×</button><div class="where"><strong>${esc(t.title)}</strong> · complete</div></div></div>
      <div class="wrap"><div class="done">
        <div class="eyebrow">Thank you for joining the tour</div>
        <h2 style="font-size:40px;margin:12px 0">${esc(t.title)}</h2>
        <p>Save the prints you liked to your shortlist, see one on your wall, or ask the Studio for advice. ${others.length ? 'Or carry on with another tour.' : ''}</p>
        <div class="actions">
          <button class="btn solid" data-act="shortlist">My shortlist (${this.shortlist.length})</button>
          ${others.slice(0, 2).map((o) => `<button class="btn" data-tour="${esc(o.slug)}">${esc(o.title)}</button>`).join('')}
          <button class="btn quiet" data-act="close">Back to the gallery</button>
        </div>
      </div></div>`;
  }

  // ---------- audio ----------
  toggleTranscript(btn) {
    const pid = btn.dataset.transcript;
    const box = this.root.getElementById(`t-${pid}`);
    const open = !box.classList.contains('open');
    box.classList.toggle('open', open);
    btn.setAttribute('aria-expanded', String(open));
    btn.textContent = open ? 'Hide the story' : 'Read the story';
    if (open) this.track('transcript_open', pid, 1);
  }

  stopAll(except) {
    for (const [pid, pl] of this.players) {
      if (pid === except) continue;
      if (pl.audio && !pl.audio.paused) pl.audio.pause();
      if (pl.speaking) { pl.cancelled = true; speechSynthesis.cancel(); pl.speaking = false; }
      this.setPlaying(pid, false);
    }
  }

  setPlaying(pid, on) {
    const btn = this.root.querySelector(`[data-player="${CSS.escape(pid)}"] .play`);
    if (btn) { btn.innerHTML = on ? ICON_PAUSE : ICON_PLAY; btn.setAttribute('aria-label', on ? 'Pause the story' : 'Play the story'); }
  }

  progress(pid, frac) {
    const el = this.root.querySelector(`[data-player="${CSS.escape(pid)}"] .bar`);
    if (el) { el.firstElementChild.style.width = `${Math.min(100, frac * 100)}%`; el.setAttribute('aria-valuenow', String(Math.round(frac * 100))); }
    const pl = this.players.get(pid);
    for (const mark of [25, 50, 75, 100]) {
      if (frac * 100 >= mark - 0.5 && !pl.marks.has(mark)) { pl.marks.add(mark); this.track('audio_progress', pid, mark); }
    }
    const box = this.root.getElementById(`t-${pid}`);
    if (!box) return;
    const ps = [...box.querySelectorAll('p')];
    const words = ps.map((p) => p.textContent.split(/\s+/).length);
    const total = words.reduce((a, b) => a + b, 0);
    let acc = 0;
    let active = ps.length - 1;
    for (let k = 0; k < ps.length; k += 1) { acc += words[k]; if (frac * total < acc) { active = k; break; } }
    ps.forEach((p, k) => p.classList.toggle('on', k === active && frac > 0 && frac < 1));
  }

  ended(pid) {
    this.setPlaying(pid, false);
    this.progress(pid, 1);
    this.storyEnded(pid);
  }

  togglePlay(pid) {
    const p = this.print(pid);
    let pl = this.players.get(pid);
    if (!pl) { pl = { marks: new Set() }; this.players.set(pid, pl); }
    this.stopAll(pid);
    if (p.story.audioUrl) {
      if (!pl.audio) {
        pl.audio = new Audio(p.story.audioUrl);
        pl.audio.preload = 'auto';
        pl.audio.addEventListener('timeupdate', () => pl.audio.duration && this.progress(pid, pl.audio.currentTime / pl.audio.duration));
        pl.audio.addEventListener('ended', () => this.ended(pid));
      }
      if (pl.audio.paused) {
        pl.audio.play().catch(() => this.setPlaying(pid, false));
        this.setPlaying(pid, true);
        this.track('audio_play', pid, 1);
      } else { pl.audio.pause(); this.setPlaying(pid, false); }
      return;
    }
    if (!this.hasAttribute('speech-fallback') || !window.speechSynthesis) return;
    if (pl.speaking) { pl.cancelled = true; speechSynthesis.cancel(); pl.speaking = false; this.setPlaying(pid, false); return; }
    const parts = paragraphs(p.story.transcript);
    const total = parts.join(' ').split(/\s+/).length;
    let done = 0;
    pl.speaking = true;
    pl.cancelled = false;
    this.setPlaying(pid, true);
    this.track('audio_play', pid, 1);
    parts.forEach((text, k) => {
      const u = new SpeechSynthesisUtterance(text);
      const voice = bestVoice();
      u.lang = voice ? voice.lang : 'en-GB';
      if (voice) u.voice = voice;
      u.rate = 0.92;
      u.pitch = 0.95;
      u.onboundary = (ev) => { if (ev.name === 'word') this.progress(pid, (done + text.slice(0, ev.charIndex).split(/\s+/).length) / total); };
      u.onend = () => {
        if (pl.cancelled) return;
        done += text.split(/\s+/).length;
        this.progress(pid, done / total);
        if (k === parts.length - 1) { pl.speaking = false; this.ended(pid); }
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

  // ---------- view on your wall ----------
  orient(pair, portrait) {
    if (!pair) return null;
    const [a, b] = pair.map(Number);
    return portrait ? { w: Math.min(a, b), h: Math.max(a, b) } : { w: Math.max(a, b), h: Math.min(a, b) };
  }

  frameSize(p, portrait) {
    const s = p.story;
    const framed = this.orient(s.framedSizeCm || p.framedSizeFromStore, portrait);
    if (framed) return { ...framed, exact: true };
    const mount = this.orient(s.mountSizeCm, portrait);
    if (mount) return { w: mount.w + 6, h: mount.h + 6, exact: false };
    const img = this.orient(s.imageSizeCm, portrait);
    const pad = /lacquer|board mounted|no glass/i.test(s.medium || '') ? 10 : 24;
    if (img) return { w: img.w + pad, h: img.h + pad, exact: false };
    return portrait ? { w: 60, h: 72, exact: false } : { w: 72, h: 60, exact: false };
  }

  openViewInRoom(pid) {
    const p = this.print(pid);
    this.track('view_in_room', pid, 1);
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
    this.openModal(`<h3>${esc(p.title)} on your wall</h3>
      <p>Shown at true scale: ${size.exact ? 'framed' : 'approximately framed'} <span id="virSize">${size.w} × ${size.h} cm</span> (width × height), hung at 150 cm to the centre, the gallery standard. Drag the print to move it.</p>
      <div class="vir-grid">
        <div class="stage" id="stage"></div>
        <div class="controls">
          <label>Your own wall</label>
          <button class="btn small" id="photoBtn" style="width:100%">Use a photo of my wall</button>
          <input type="file" id="photoIn" accept="image/*" hidden>
          <div id="photoOpts" hidden>
            <label for="wallW">Width of wall in the photo: <span id="wallWv"></span></label>
            <input type="range" id="wallW" min="100" max="900" step="10">
            <button class="linkbtn" id="photoClear">Back to the sample room</button>
          </div>
          <div id="wallOpts"><label>Wall colour</label><div class="swatches">${WALLS.map((c) => `<button class="sw" data-wall="${c}" style="background:${c}" aria-label="Wall colour ${c}"></button>`).join('')}</div></div>
          <label>Frame</label>
          <div class="seg">${Object.entries(FRAME_STYLES).map(([k, f]) => `<button data-frame="${k}">${f.label}</button>`).join('')}</div>
          <p class="small">Your photo stays on your device and is never uploaded.${size.exact ? '' : ' Frame size is estimated; the Studio can confirm exact dimensions.'}</p>
          <div class="actions" style="justify-content:flex-start"><button class="btn small" data-act="closeModal">Close</button></div>
        </div>
      </div>`, true);
    const $ = (id) => this.root.getElementById(id);
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
    this.root.querySelectorAll('[data-wall]').forEach((b) => { b.onclick = () => { this.vir.wall = b.dataset.wall; this.drawStage(); }; });
    this.root.querySelectorAll('[data-frame]').forEach((b) => { b.onclick = () => { this.vir.frame = b.dataset.frame; this.drawStage(); }; });
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
    const s = v.p.story;
    const img = this.orient(s.imageSizeCm, v.portrait);
    const innerW = fw - 2 * border;
    const innerH = fh - 2 * border;
    const imgW = img ? Math.min(innerW, img.w * px) : innerW * 0.72;
    const imgH = img ? Math.min(innerH, img.h * px) : innerH * 0.72;
    const premium = /lacquer|board mounted|no glass/i.test(s.medium || '');
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
      <div class="art" id="art" style="left:${v.x * W - fw / 2}px;top:${H - floorPx - v.centreCm * px - fh / 2}px;width:${fw}px;height:${fh}px;background:${premium ? '#000' : frame.color};border:1px solid ${frame.edge}">
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

if (typeof customElements !== 'undefined' && !customElements.get('jv-gallery')) customElements.define('jv-gallery', JvGallery);
