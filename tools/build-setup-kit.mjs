// Builds docs/setup-kit.html: the Wix setup steps in order, with every file
// to paste into the Editor and a Copy button for each. Open it next to the
// Wix Editor and work down the list.
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const backend = [
  ['gallery.config.js', 'Settings: reservation length, offer floor, narrator voice, email templates'],
  ['gallery-lib.js', 'Shared helpers'],
  ['gallery.web.js', 'What visitors can do: see the gallery, prices, reserve, offer, ask, analytics'],
  ['gallery-console.web.js', 'What the Studio console can do (admins only)'],
  ['gallery-notify.js', 'Email notifications (switched on later)'],
  ['gallery-audio.js', 'Re-records a story with ElevenLabs after its script changes'],
  ['gallery-claude.web.js', '"Draft with Claude" for prints added later'],
  ['gallery-seed.js', 'The 68 stories with George\'s recordings and the 5 tours (large file)'],
  ['gallery-jobs.js', 'Releases 48-hour reservations when they run out'],
  ['jobs.config', 'Runs that job every hour'],
];

let n = 0;
const file = (label, path, note) => {
  n += 1;
  const body = read(path);
  return `<div class="file"><div class="fhead"><div><code>${esc(label)}</code><span>${esc(note)}</span></div>
    <button class="copy" data-for="f${n}">Copy</button></div>
    <textarea id="f${n}" readonly spellcheck="false">${esc(body)}</textarea>
    <div class="lines">${body.split('\n').length} lines</div></div>`;
};

const steps = [
  {
    title: 'Packages',
    body: `<p>In the Editor, open the <b>Code</b> panel (the <b>{ }</b> icon on the left), then <b>Packages &amp; Apps</b> → <b>+</b> → <b>Install from npm</b>. Install each of these, one at a time:</p>
      <ul class="pk">${['@wix/stores', '@wix/ecom', '@wix/media', '@wix/essentials'].map((p) => `<li><code>${p}</code> <button class="copy small" data-text="${p}">Copy</button></li>`).join('')}</ul>`,
  },
  {
    title: 'Backend files',
    body: `<p>In the Code panel, under <b>Backend</b>, click <b>+</b> → <b>Add new file</b> for each file below. Give it <b>exactly</b> the name shown, then Copy and paste the contents in, replacing anything Wix put there. Wix saves as you go.</p>
      ${backend.map(([f, note]) => file(`backend/${f}`, `wix/backend/${f}`, note)).join('')}`,
  },
  {
    title: 'The Gallery Tour page',
    body: `<ol>
      <li>Go to your <b>Gallery Tour</b> page. In <b>Page settings</b> → <b>SEO basics</b>, check the URL ends in <code>gallery-tour</code>.</li>
      <li>Click <b>Add</b> (+) → <b>Embed Code</b> → <b>Custom Element</b>, and drag it onto the page.</li>
      <li>Click the element → <b>Choose Source</b> → <b>Velo file</b> → <b>Add a new file</b>, name it <code>jv-gallery.js</code>, and paste in the file below. Set the <b>Tag name</b> to <code>jv-gallery</code>.</li>
      <li>With the element selected, open the <b>Properties &amp; Events</b> panel (bottom of the Code panel) and set its <b>ID</b> to <code>jvGallery</code>.</li>
      <li>Click <b>Stretch</b> (the ↔ icon) to make it full width, and drag its height to about 1,500 px. It grows to fit when the page runs.</li>
      <li>Open the page's code (the panel at the bottom of the Editor, tab <b>Gallery Tour</b>), delete what's there and paste in the page code below.</li>
    </ol>
    ${file('public/custom-elements/jv-gallery.js', 'wix/public/custom-elements/jv-gallery.js', 'The gallery itself')}
    ${file('Gallery Tour page code', 'wix/pages/gallery-page.js', 'Connects the gallery to the backend and the basket')}`,
  },
  {
    title: 'The Studio console (dashboard page)',
    body: `<ol>
      <li>Open <b>Pages</b> → <b>Dashboard Pages</b> → <b>+ Add Dashboard Page</b>, and name it <b>Gallery</b>.</li>
      <li>Add a <b>Custom Element</b> as before. <b>Choose Source</b> → <b>Velo file</b> → new file <code>jv-console.js</code> with the file below. Tag name <code>jv-console</code>, ID <code>jvConsole</code>, stretched to full width.</li>
      <li>Paste the console page code below into this dashboard page's code.</li>
    </ol>
    ${file('public/custom-elements/jv-console.js', 'wix/public/custom-elements/jv-console.js', 'The Studio console')}
    ${file('Dashboard page code', 'wix/pages/gallery-console.js', 'Connects the console to the backend')}`,
  },
  {
    title: 'Publish and load the stories',
    body: `<ol>
      <li>Click <b>Publish</b>.</li>
      <li>Open your site's <b>Dashboard</b> → the new <b>Gallery</b> page → <b>Story library</b> → <b>Import</b>. The 68 stories (with George's narration) and 5 tours arrive as drafts.</li>
      <li>Approve the stories you're happy with and publish the tours. Each approved story appears on the Gallery Tour page straight away.</li>
      <li>Open <code>jackvettriano.studio/gallery-tour</code> and try it: play a story, start a tour, reserve a print.</li>
    </ol>
    <p class="note">Tell Claude when you reach this step: it can check from its side that the stories and tours arrived.</p>`,
  },
];

const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Gallery setup kit</title>
<style>
  :root { --red: #b3140f; --text: #141414; --muted: #5f5f5f; --line: #e4e2de; --soft: #f6f5f3; }
  * { box-sizing: border-box; }
  body { margin: 0; background: #fff; color: var(--text); font: 15px/1.6 'Helvetica Neue', Arial, sans-serif; }
  main { max-width: 860px; margin: 0 auto; padding: 32px 16px 80px; }
  h1 { color: var(--red); font-size: 30px; margin: 0 0 6px; }
  .lede { color: var(--muted); margin: 0 0 24px; }
  .progress { position: sticky; top: 0; background: rgba(255,255,255,.96); padding: 10px 0; border-bottom: 1px solid var(--line); font-size: 13px; z-index: 2; }
  section { border: 1px solid var(--line); margin: 18px 0; }
  section > label { display: flex; gap: 12px; align-items: center; padding: 14px 18px; background: var(--soft); cursor: pointer; font-weight: 600; font-size: 17px; }
  section > label input { width: 20px; height: 20px; accent-color: var(--red); }
  section.done > label { color: var(--muted); text-decoration: line-through; }
  .inner { padding: 4px 18px 18px; }
  section.done .inner { display: none; }
  code { background: var(--soft); padding: 1px 5px; font-size: 13px; }
  .file { border: 1px solid var(--line); margin: 14px 0; }
  .fhead { display: flex; justify-content: space-between; gap: 12px; align-items: center; padding: 10px 12px; border-bottom: 1px solid var(--line); }
  .fhead code { font-weight: 600; background: none; padding: 0; font-size: 14px; }
  .fhead span { display: block; color: var(--muted); font-size: 13px; }
  textarea { width: 100%; height: 120px; border: 0; padding: 10px 12px; font: 12px/1.45 ui-monospace, Menlo, monospace; color: #333; resize: vertical; display: block; }
  .lines { font-size: 12px; color: var(--muted); padding: 4px 12px 8px; }
  button.copy { background: #262626; color: #fff; border: 0; padding: 8px 16px; font: inherit; font-size: 13px; cursor: pointer; white-space: nowrap; }
  button.copy.small { padding: 3px 10px; font-size: 12px; }
  button.copy.ok { background: #2f7d3b; }
  ul.pk { list-style: none; padding: 0; } ul.pk li { margin: 6px 0; }
  ol li { margin: 6px 0; }
  .note { background: var(--soft); padding: 10px 12px; border-left: 2px solid var(--red); }
</style></head><body><main>
<h1>Gallery setup kit</h1>
<p class="lede">Work down the steps with this page open beside the Wix Editor. Every Copy button puts the exact text on your clipboard. Tick each step when it's done; your ticks are remembered on this computer.</p>
<div class="progress" id="progress"></div>
${steps.map((s, i) => `<section id="s${i}"><label><input type="checkbox" data-step="${i}"> ${i + 1}. ${esc(s.title)}</label><div class="inner">${s.body}</div></section>`).join('\n')}
</main>
<script>
(function () {
  var KEY = 'jvs-setup-kit';
  var done = {};
  try { done = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (e) {}
  var boxes = document.querySelectorAll('[data-step]');
  function paint() {
    var count = 0;
    boxes.forEach(function (b) {
      b.checked = !!done[b.dataset.step];
      document.getElementById('s' + b.dataset.step).classList.toggle('done', b.checked);
      if (b.checked) count++;
    });
    document.getElementById('progress').textContent = count + ' of ' + boxes.length + ' steps done';
  }
  boxes.forEach(function (b) {
    b.addEventListener('change', function () {
      done[b.dataset.step] = b.checked;
      try { localStorage.setItem(KEY, JSON.stringify(done)); } catch (e) {}
      paint();
    });
  });
  document.addEventListener('click', function (e) {
    var btn = e.target.closest('button.copy');
    if (!btn) return;
    var text = btn.dataset.text || document.getElementById(btn.dataset.for).value;
    function ok() { var t = btn.textContent; btn.textContent = 'Copied'; btn.classList.add('ok'); setTimeout(function () { btn.textContent = t; btn.classList.remove('ok'); }, 1500); }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(ok, fallback); else fallback();
    function fallback() {
      var ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); ok(); } catch (err) {} document.body.removeChild(ta);
    }
  });
  paint();
})();
</script></body></html>`;

writeFileSync(join(root, 'docs/setup-kit.html'), html);
console.log(`docs/setup-kit.html: ${(html.length / 1024).toFixed(0)} KB, ${steps.length} steps, ${n} files`);
