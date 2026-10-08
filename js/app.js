import { CONFIG, FRAMES, MATS, REFERENCES } from './config.js';
import { drawImageInQuad, pointInQuad, isConvexQuad, distance, distanceToSegment } from './geometry.js';
import { renderFramed, hexToRgb01, edgeColor } from './framing.js';
import { buildArtworkGLB } from './glb.js';
import { createSampleRoom, createSampleArtwork } from './samples.js';

const CM_PER_IN = 2.54;
const MAX_PHOTO_PX = 2400;
const PREVIEW_ART_PX = 1400;
const EXPORT_ART_PX = 3000;
const AR_TEXTURE_PX = 2048;
const MODEL_VIEWER_SRC = [
  'https://cdn.jsdelivr.net/npm/@google/model-viewer@3.5.0/dist/model-viewer.min.js',
  'https://unpkg.com/@google/model-viewer@3.5.0/dist/model-viewer.min.js',
];
const QR_SRC = 'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js';

const $ = (id) => document.getElementById(id);
const stage = $('stage');
const ctx = stage.getContext('2d');
const inIframe = (() => {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
})();

const state = {
  unit: CONFIG.defaultUnit,
  photo: null, // canvas holding the (downscaled) wall photo
  isSample: false,
  pxPerCm: 1,
  frameWidth: null, // cm, overrides the frame style's default width
  scaleSource: 'estimate', // 'estimate' | 'measured' | 'sample'
  art: null, // { image, title, artist, sizes:[{w,h}], sizeIndex, tainted, url }
  frameKey: CONFIG.defaultFrame,
  matIndex: 0,
  shadow: true,
  brightness: 1,
  pos: [0, 0], // centre of the framed piece in photo pixels
  persp: null, // per-corner offsets as fractions of the piece size, or null
  mode: 'place', // 'place' | 'perspective' | 'measure'
  measure: { a: null, b: null, step: 0 }, // step 0: tap first end, 1: tap second end, 2: adjust
  buyUrl: null,
};

const view = { scale: 1, ox: 0, oy: 0, dpr: 1 };
let drag = null;
let framedCache = { key: '', canvas: null };
let renderQueued = false;
let toastTimer = 0;
let hintTimer = 0;

// ---------- units ----------

function toDisplay(cm) {
  return state.unit === 'in' ? cm / CM_PER_IN : cm;
}
function fromDisplay(v) {
  return state.unit === 'in' ? v * CM_PER_IN : v;
}
function fmtNum(cm) {
  const v = toDisplay(cm);
  const r = state.unit === 'in' ? Math.round(v * 4) / 4 : Math.round(v * 10) / 10;
  return String(+r.toFixed(2));
}
function fmtSize(w, h) {
  return `${fmtNum(w)} × ${fmtNum(h)} ${state.unit}`;
}

// ---------- artwork geometry ----------

function currentSize() {
  return state.art.sizes[state.art.sizeIndex];
}
function frame() {
  const f = FRAMES[state.frameKey] || FRAMES.none;
  // Per-artwork frame width (e.g. the publisher's frame), applied to every frame colour.
  return state.frameWidth && f.width ? { ...f, width: state.frameWidth } : f;
}
function matCm() {
  return MATS[state.matIndex]?.width || 0;
}
function framedDims() {
  const { w, h } = currentSize();
  const border = 2 * (matCm() + frame().width);
  return { w: w + border, h: h + border, depth: frame().depth };
}

/** Corners (TL, TR, BR, BL) of the framed piece in photo pixels. */
function baseQuad() {
  const { w, h } = framedDims();
  const W = w * state.pxPerCm;
  const H = h * state.pxPerCm;
  const [cx, cy] = state.pos;
  return [
    [cx - W / 2, cy - H / 2],
    [cx + W / 2, cy - H / 2],
    [cx + W / 2, cy + H / 2],
    [cx - W / 2, cy + H / 2],
  ];
}
function artQuad() {
  const base = baseQuad();
  if (!state.persp) return base;
  const { w, h } = framedDims();
  const W = w * state.pxPerCm;
  const H = h * state.pxPerCm;
  return base.map((p, i) => [p[0] + state.persp[i][0] * W, p[1] + state.persp[i][1] * H]);
}

function getFramed(maxPx) {
  const { w, h } = currentSize();
  const key = [state.art.id, w, h, state.frameKey, state.matIndex, state.brightness, maxPx].join('|');
  if (framedCache.key === key) return framedCache.canvas;
  const canvas = renderFramed(
    state.art.image,
    { artW: w, artH: h, frame: frame(), matCm: matCm(), brightness: state.brightness },
    maxPx
  );
  framedCache = { key, canvas };
  return canvas;
}

// ---------- view / rendering ----------

function layoutStage() {
  const rect = stage.getBoundingClientRect();
  view.dpr = Math.min(window.devicePixelRatio || 1, 2.5);
  stage.width = Math.max(1, Math.round(rect.width * view.dpr));
  stage.height = Math.max(1, Math.round(rect.height * view.dpr));
  if (state.photo) {
    view.scale = Math.min(stage.width / state.photo.width, stage.height / state.photo.height);
    view.ox = (stage.width - state.photo.width * view.scale) / 2;
    view.oy = (stage.height - state.photo.height * view.scale) / 2;
  }
  requestRender();
}
const toScreen = ([x, y]) => [view.ox + x * view.scale, view.oy + y * view.scale];
const toPhoto = ([x, y]) => [(x - view.ox) / view.scale, (y - view.oy) / view.scale];

function requestRender() {
  if (renderQueued) return;
  renderQueued = true;
  requestAnimationFrame(() => {
    renderQueued = false;
    render();
  });
}

function render() {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, stage.width, stage.height);
  if (!state.photo) return;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(state.photo, view.ox, view.oy, state.photo.width * view.scale, state.photo.height * view.scale);
  if (!state.art) return;

  const quad = artQuad().map(toScreen);
  const depthPx = framedDims().depth * state.pxPerCm * view.scale;
  // Fade the artwork while measuring so it doesn't hide the reference object.
  ctx.globalAlpha = state.mode === 'measure' ? 0.2 : 1;
  drawArtwork(ctx, getFramed(PREVIEW_ART_PX), quad, depthPx, state.shadow && state.mode !== 'measure');
  ctx.globalAlpha = 1;

  const dpr = view.dpr;
  if (state.mode === 'perspective') {
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 1.5 * dpr;
    ctx.setLineDash([6 * dpr, 5 * dpr]);
    pathQuad(ctx, quad);
    ctx.stroke();
    ctx.setLineDash([]);
    quad.forEach((p) => drawHandle(p));
  } else if (drag?.type === 'art') {
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = 1 * dpr;
    pathQuad(ctx, quad);
    ctx.stroke();
  }

  if (state.mode !== 'measure') drawSizeLabel(quad);
  if (state.mode === 'measure') drawMeasureLine();
  if (drag?.pointer) {
    if (drag.type === 'measure-a' || drag.type === 'measure-b') {
      drawLoupe(state.measure[drag.type === 'measure-a' ? 'a' : 'b'], drag.pointer);
    } else if (drag.type === 'corner') {
      drawLoupe(artQuad()[drag.index], drag.pointer);
    }
  }
}

/**
 * Magnifier shown above the finger while placing a precise point, so the
 * finger doesn't hide what's underneath. `focus` is in photo pixels.
 */
function drawLoupe(focus, finger) {
  const dpr = view.dpr;
  const R = 58 * dpr;
  const zoom = 3;
  const gap = 46 * dpr;
  let cx = finger[0];
  let cy = finger[1] - R - gap;
  if (cy - R < 4) cy = finger[1] + R + gap;
  cx = Math.min(Math.max(cx, R + 4), stage.width - R - 4);
  const half = R / (view.scale * zoom); // half-size of the magnified area, photo pixels
  const k = R / half; // photo px -> loupe px
  const toLoupe = ([x, y]) => [cx + (x - focus[0]) * k, cy + (y - focus[1]) * k];

  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.fillStyle = '#111';
  ctx.fill();
  ctx.clip();
  // Draw only the part of the photo that exists (some browsers skip out-of-bounds source rects).
  const P = state.photo;
  const sx0 = Math.max(0, focus[0] - half), sy0 = Math.max(0, focus[1] - half);
  const sx1 = Math.min(P.width, focus[0] + half), sy1 = Math.min(P.height, focus[1] + half);
  if (sx1 > sx0 && sy1 > sy0) {
    const [dx0, dy0] = toLoupe([sx0, sy0]);
    ctx.drawImage(P, sx0, sy0, sx1 - sx0, sy1 - sy0, dx0, dy0, (sx1 - sx0) * k, (sy1 - sy0) * k);
  }
  const { a, b } = state.measure;
  if (state.mode === 'measure' && a && b) {
    ctx.strokeStyle = '#ffd25e';
    ctx.lineWidth = 2 * dpr;
    ctx.beginPath();
    ctx.moveTo(...toLoupe(a));
    ctx.lineTo(...toLoupe(b));
    ctx.stroke();
  }
  // Crosshair marking the exact point.
  ctx.lineWidth = 3 * dpr;
  ctx.strokeStyle = 'rgba(0,0,0,0.6)';
  crosshair(cx, cy, 7 * dpr, R);
  ctx.lineWidth = 1.5 * dpr;
  ctx.strokeStyle = '#ffd25e';
  crosshair(cx, cy, 7 * dpr, R);
  ctx.restore();
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.lineWidth = 3 * dpr;
  ctx.strokeStyle = '#fff';
  ctx.stroke();
  ctx.lineWidth = 1 * dpr;
  ctx.strokeStyle = 'rgba(0,0,0,0.5)';
  ctx.beginPath();
  ctx.arc(cx, cy, R + 2 * dpr, 0, Math.PI * 2);
  ctx.stroke();
}

function crosshair(x, y, inner, outer) {
  ctx.beginPath();
  ctx.moveTo(x - outer, y); ctx.lineTo(x - inner, y);
  ctx.moveTo(x + inner, y); ctx.lineTo(x + outer, y);
  ctx.moveTo(x, y - outer); ctx.lineTo(x, y - inner);
  ctx.moveTo(x, y + inner); ctx.lineTo(x, y + outer);
  ctx.stroke();
}

function drawArtwork(g, img, quad, depthPx, shadow) {
  if (shadow) {
    g.save();
    g.shadowColor = 'rgba(0,0,0,0.38)';
    g.shadowBlur = Math.max(2, depthPx * 1.6);
    g.shadowOffsetX = depthPx * 0.15;
    g.shadowOffsetY = depthPx * 0.55;
    pathQuad(g, quad);
    g.fillStyle = '#000';
    g.fill();
    g.restore();
  }
  const axisAligned =
    Math.abs(quad[0][1] - quad[1][1]) < 0.01 &&
    Math.abs(quad[2][1] - quad[3][1]) < 0.01 &&
    Math.abs(quad[0][0] - quad[3][0]) < 0.01 &&
    Math.abs(quad[1][0] - quad[2][0]) < 0.01;
  g.imageSmoothingQuality = 'high';
  if (axisAligned) {
    g.drawImage(img, quad[0][0], quad[0][1], quad[1][0] - quad[0][0], quad[3][1] - quad[0][1]);
  } else {
    drawImageInQuad(g, img, quad, 14);
  }
}

function pathQuad(g, quad) {
  g.beginPath();
  quad.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
  g.closePath();
}

function drawHandle([x, y], label) {
  const r = 9 * view.dpr;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = '#fff';
  ctx.fill();
  ctx.lineWidth = 2 * view.dpr;
  ctx.strokeStyle = '#1f1d1a';
  ctx.stroke();
  if (label) {
    ctx.fillStyle = '#1f1d1a';
    ctx.font = `600 ${10 * view.dpr}px ${getComputedStyle(document.body).fontFamily}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, x, y + 0.5);
  }
}

function drawPill(text, x, y) {
  const dpr = view.dpr;
  ctx.font = `${12 * dpr}px ${getComputedStyle(document.body).fontFamily}`;
  const w = ctx.measureText(text).width + 18 * dpr;
  const h = 22 * dpr;
  x = Math.min(Math.max(x, w / 2 + 4), stage.width - w / 2 - 4);
  y = Math.min(Math.max(y, h / 2 + 4), stage.height - h / 2 - 4);
  ctx.fillStyle = 'rgba(20,18,16,0.82)';
  ctx.beginPath();
  ctx.roundRect(x - w / 2, y - h / 2, w, h, h / 2);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y + 0.5);
}

function drawSizeLabel(quad) {
  const { w, h } = currentSize();
  const fd = framedDims();
  let text = fmtSize(w, h);
  if (fd.w !== w) text += `  ·  framed ${fmtSize(fd.w, fd.h)}`;
  const bottom = Math.max(quad[2][1], quad[3][1]);
  const cx = (quad[2][0] + quad[3][0]) / 2;
  drawPill(text, cx, bottom + 22 * view.dpr);
}

function drawMeasureLine() {
  if (!state.measure.a) return;
  const a = toScreen(state.measure.a);
  if (!state.measure.b) {
    drawTarget(a);
    return;
  }
  const b = toScreen(state.measure.b);
  ctx.save();
  ctx.lineCap = 'round';
  ctx.strokeStyle = 'rgba(0,0,0,0.55)';
  ctx.lineWidth = 5 * view.dpr;
  ctx.beginPath();
  ctx.moveTo(...a);
  ctx.lineTo(...b);
  ctx.stroke();
  ctx.strokeStyle = '#ffd25e';
  ctx.lineWidth = 2.5 * view.dpr;
  ctx.stroke();
  ctx.restore();
  drawTarget(a);
  drawTarget(b);
  const len = parseFloat($('refLength').value);
  if (len > 0 && state.measure.step === 2) {
    drawPill(`${len} ${state.unit}`, (a[0] + b[0]) / 2 + 40 * view.dpr, (a[1] + b[1]) / 2);
  }
}

/** Hollow ring with a centre dot, so the exact point stays visible. */
function drawTarget([x, y]) {
  const dpr = view.dpr;
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, 13 * dpr, 0, Math.PI * 2);
  ctx.lineWidth = 5 * dpr;
  ctx.strokeStyle = 'rgba(0,0,0,0.5)';
  ctx.stroke();
  ctx.lineWidth = 2.5 * dpr;
  ctx.strokeStyle = '#ffd25e';
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x, y, 2 * dpr, 0, Math.PI * 2);
  ctx.fillStyle = '#ffd25e';
  ctx.fill();
  ctx.restore();
}

// ---------- pointer interaction ----------

function eventPoint(e) {
  const rect = stage.getBoundingClientRect();
  return [(e.clientX - rect.left) * view.dpr, (e.clientY - rect.top) * view.dpr];
}

const coarsePointer = matchMedia('(pointer: coarse)').matches;

function hitTest(p) {
  const r = (coarsePointer ? 32 : 22) * view.dpr;
  if (state.mode === 'measure') {
    const { step } = state.measure;
    if (step < 2) return { type: step === 0 ? 'measure-a' : 'measure-b', place: true };
    const a = toScreen(state.measure.a);
    const b = toScreen(state.measure.b);
    if (distance(p, a) < r) return { type: 'measure-a' };
    if (distance(p, b) < r) return { type: 'measure-b' };
    if (distanceToSegment(p, a, b) < r * 0.6) return { type: 'measure-line' };
    return null;
  }
  if (!state.art) return null;
  const quad = artQuad().map(toScreen);
  if (state.mode === 'perspective') {
    const i = quad.findIndex((q) => distance(p, q) < r);
    if (i >= 0) return { type: 'corner', index: i };
  }
  if (pointInQuad(p, quad)) return { type: 'art' };
  return null;
}

stage.addEventListener('pointerdown', (e) => {
  if (!state.photo) return;
  const p = eventPoint(e);
  const hit = hitTest(p);
  if (!hit) return;
  e.preventDefault();
  stage.setPointerCapture(e.pointerId);
  if (hit.place) state.measure[hit.type === 'measure-a' ? 'a' : 'b'] = clampToPhoto(toPhoto(p));
  const { a, b } = state.measure;
  drag = { ...hit, start: toPhoto(p), pos: [...state.pos], a: a && [...a], b: b && [...b], pointer: p };
  stage.style.cursor = 'grabbing';
  requestRender();
});

stage.addEventListener('pointermove', (e) => {
  const p = eventPoint(e);
  if (!drag) {
    const hit = hitTest(p);
    stage.style.cursor = !hit ? 'default' : hit.place ? 'crosshair' : hit.type === 'art' || hit.type === 'measure-line' ? 'grab' : 'pointer';
    return;
  }
  const q = clampToPhoto(toPhoto(p));
  drag.pointer = p;
  const dx = q[0] - drag.start[0];
  const dy = q[1] - drag.start[1];
  if (drag.type === 'art') {
    state.pos = [drag.pos[0] + dx, drag.pos[1] + dy];
  } else if (drag.type === 'corner') {
    setCorner(drag.index, q);
  } else if (drag.type === 'measure-a' || drag.type === 'measure-b') {
    // Move the point by the finger's movement (not to the finger), so a
    // small slide nudges it precisely.
    const from = drag.type === 'measure-a' ? drag.a : drag.b;
    state.measure[drag.type === 'measure-a' ? 'a' : 'b'] = clampToPhoto([from[0] + dx, from[1] + dy]);
  } else if (drag.type === 'measure-line') {
    state.measure.a = [drag.a[0] + dx, drag.a[1] + dy];
    state.measure.b = [drag.b[0] + dx, drag.b[1] + dy];
  }
  requestRender();
});

function endDrag() {
  if (!drag) return;
  const placed = drag.place;
  drag = null;
  if (placed) {
    state.measure.step++;
    updateMeasureUI();
  }
  stage.style.cursor = 'default';
  requestRender();
}
stage.addEventListener('pointerup', endDrag);
stage.addEventListener('pointercancel', endDrag);

function clampToPhoto([x, y]) {
  return [Math.min(Math.max(x, 0), state.photo.width), Math.min(Math.max(y, 0), state.photo.height)];
}

function setCorner(i, point) {
  const base = baseQuad();
  const { w, h } = framedDims();
  const W = w * state.pxPerCm;
  const H = h * state.pxPerCm;
  const next = (state.persp || [[0, 0], [0, 0], [0, 0], [0, 0]]).map((o) => [...o]);
  next[i] = [(point[0] - base[i][0]) / W, (point[1] - base[i][1]) / H];
  const quad = base.map((p, k) => [p[0] + next[k][0] * W, p[1] + next[k][1] * H]);
  if (isConvexQuad(quad)) state.persp = next;
}

stage.addEventListener('keydown', (e) => {
  if (!state.art || !state.photo) return;
  const step = (e.shiftKey ? 10 : 1) * state.pxPerCm;
  const moves = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
  const m = moves[e.key];
  if (!m) return;
  e.preventDefault();
  state.pos = clampToPhoto([state.pos[0] + m[0], state.pos[1] + m[1]]);
  requestRender();
});

// ---------- loading images ----------

function loadImage(url, cors) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    if (cors) img.crossOrigin = 'anonymous';
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Could not load image: ${url}`));
    img.src = url;
  });
}

async function fileToCanvas(file, maxPx) {
  let source;
  try {
    source = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    const url = URL.createObjectURL(file);
    try {
      source = await loadImage(url, false);
    } finally {
      URL.revokeObjectURL(url);
    }
  }
  return downscale(source, maxPx);
}

function downscale(source, maxPx) {
  const s = Math.min(1, maxPx / Math.max(source.width, source.height));
  const c = document.createElement('canvas');
  c.width = Math.round(source.width * s);
  c.height = Math.round(source.height * s);
  const g = c.getContext('2d');
  g.imageSmoothingQuality = 'high';
  g.drawImage(source, 0, 0, c.width, c.height);
  source.close?.();
  return c;
}

function safeUrl(value) {
  if (!value) return null;
  try {
    const u = new URL(value, location.href);
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.href : null;
  } catch {
    return null;
  }
}

// ---------- wall photo ----------

function setPhoto(canvas, { sample = false, pxPerCm, center } = {}) {
  state.photo = canvas;
  state.isSample = sample;
  state.persp = null;
  if (sample) {
    state.pxPerCm = pxPerCm;
    state.scaleSource = 'sample';
  } else {
    state.pxPerCm = canvas.width / CONFIG.assumedWallWidthCm;
    state.scaleSource = 'estimate';
  }
  state.pos = center || [canvas.width / 2, canvas.height * 0.42];
  $('stageWrap').style.setProperty('--photo-aspect', `${canvas.width} / ${canvas.height}`);
  if (state.mode === 'measure') exitMeasure();
  layoutStage();
  syncScaleUI();
}

async function handlePhotoFile(file) {
  if (!file || !file.type.startsWith('image/')) {
    toast('Please choose an image file.');
    return;
  }
  try {
    const canvas = await fileToCanvas(file, MAX_PHOTO_PX);
    setPhoto(canvas);
    toast('Photo added. Now set the scale so the artwork shows at its true size.', 5000);
    flashHint('Drag the artwork to where you would hang it');
  } catch (err) {
    console.error(err);
    toast("Sorry, that photo couldn't be opened. Try a JPEG or PNG.");
  }
}

function useSampleRoom() {
  const room = createSampleRoom();
  setPhoto(room.canvas, { sample: true, pxPerCm: room.pxPerCm, center: room.suggestedCenter });
  if (state.art) {
    // Hang so the bottom of the piece sits ~25 cm above the sofa back.
    const { h } = framedDims();
    state.pos = [room.suggestedCenter[0], room.suggestedCenter[1] + (40 - 25 - h / 2) * room.pxPerCm];
  }
  requestRender();
}

// ---------- artwork ----------

let artCounter = 0;

/**
 * @param {object} a
 * @param {HTMLImageElement|HTMLCanvasElement} a.image
 * @param {{w:number,h:number}[]} a.sizes  in cm
 */
function setArtwork(a) {
  state.art = {
    id: ++artCounter,
    image: a.image,
    title: a.title || 'Untitled',
    artist: a.artist || '',
    sizes: a.sizes,
    sizeIndex: Math.min(a.sizeIndex || 0, a.sizes.length - 1),
    tainted: !!a.tainted,
    url: a.url || null,
    sizeUnknown: !!a.sizeUnknown,
  };
  limitFrames(a.frames);
  if (a.frame && FRAMES[a.frame]) state.frameKey = a.frame;
  if (a.mat != null && a.mat >= 0) {
    let idx = MATS.findIndex((m) => Math.abs(m.width - a.mat) < 0.05);
    if (idx < 0) {
      // A mount width the gallery specified for this piece, e.g. a publisher's mount.
      MATS.push({ label: 'Mount as supplied', width: a.mat });
      idx = MATS.length - 1;
      $('matSelect').add(new Option(MATS[idx].label, String(idx)));
    }
    state.matIndex = idx;
  }
  state.frameWidth = a.frameWidth > 0 ? a.frameWidth : null;
  syncArtUI();
  if (state.isSample) useSampleRoom();
  requestRender();
}

/** Show only the frame styles the gallery sells for this piece, e.g. "none,publisher". */
function limitFrames(list) {
  const keys = String(list || '').split(',').map((k) => k.trim()).filter((k) => FRAMES[k]);
  document.querySelectorAll('.swatch').forEach((s) => {
    s.hidden = keys.length > 0 && !keys.includes(s.dataset.frame);
  });
  if (keys.length && !keys.includes(state.frameKey)) state.frameKey = keys[0];
}

function parseSizes(sizesParam, w, h, unit, aspect) {
  const k = unit === 'in' ? CM_PER_IN : 1;
  const sizes = [];
  if (sizesParam) {
    for (const part of sizesParam.split(',')) {
      const m = /^\s*(\d+(?:\.\d+)?)\s*[x×X*]\s*(\d+(?:\.\d+)?)\s*$/.exec(part);
      if (m) sizes.push({ w: +m[1] * k, h: +m[2] * k });
    }
  }
  if (!sizes.length && w > 0 && h > 0) sizes.push({ w: w * k, h: h * k });
  if (!sizes.length && w > 0) sizes.push({ w: w * k, h: w * k * aspect });
  if (!sizes.length && h > 0) sizes.push({ w: (h * k) / aspect, h: h * k });
  return sizes;
}

/** Load artwork described by URL params or a postMessage payload. */
async function loadArtworkSpec(spec) {
  const url = safeUrl(spec.img);
  let image;
  let tainted = false;
  if (url) {
    try {
      image = await loadImage(url, true);
    } catch {
      try {
        image = await loadImage(url, false);
        tainted = true;
      } catch {
        toast("The artwork image couldn't be loaded.");
      }
    }
  }
  const isSample = !image;
  if (isSample) image = createSampleArtwork();
  const aspect = image.height / image.width;
  const unit = spec.unit === 'in' ? 'in' : 'cm';
  let sizes = parseSizes(spec.sizes, parseFloat(spec.w), parseFloat(spec.h), unit, aspect);
  let sizeUnknown = false;
  if (!sizes.length) {
    sizeUnknown = !isSample;
    const longSide = 80;
    sizes = aspect >= 1 ? [{ w: longSide / aspect, h: longSide }] : [{ w: longSide, h: longSide * aspect }];
  }
  if (spec.buy) state.buyUrl = safeUrl(spec.buy);
  setArtwork({
    image,
    url: isSample ? null : url,
    title: isSample ? spec.title || 'Sample artwork' : spec.title,
    artist: spec.artist,
    sizes,
    sizeIndex: parseInt(spec.size, 10) || 0,
    tainted,
    sizeUnknown,
    frame: spec.frame,
    frames: spec.frames,
    mat: spec.mat != null && spec.mat !== '' ? parseFloat(spec.mat) * (unit === 'in' ? CM_PER_IN : 1) : null,
    frameWidth: parseFloat(spec.framew) * (unit === 'in' ? CM_PER_IN : 1),
  });
  if (tainted) {
    toast("Heads up: this image host doesn't allow downloads or AR (CORS). The preview still works.", 6000);
  }
}

async function handleArtFile(file) {
  if (!file || !file.type.startsWith('image/')) return;
  const canvas = await fileToCanvas(file, 3000);
  const aspect = canvas.height / canvas.width;
  const w = aspect >= 1 ? 60 / aspect : 60;
  const h = w * aspect;
  setArtwork({ image: canvas, title: file.name.replace(/\.[^.]+$/, ''), sizes: [{ w, h }] });
  $('ownW').value = fmtNum(w);
  $('ownH').value = fmtNum(h);
}

function setOwnSize(changed) {
  if (!state.art) return;
  const aspect = state.art.image.height / state.art.image.width;
  const wIn = $('ownW');
  const hIn = $('ownH');
  let w, h;
  if (changed === 'w') {
    w = fromDisplay(parseFloat(wIn.value));
    h = w * aspect;
    if (!(w > 0)) return;
    hIn.value = fmtNum(h);
  } else {
    h = fromDisplay(parseFloat(hIn.value));
    w = h / aspect;
    if (!(h > 0)) return;
    wIn.value = fmtNum(w);
  }
  state.art.sizes = [{ w, h }];
  state.art.sizeIndex = 0;
  state.art.sizeUnknown = false;
  syncArtUI();
  requestRender();
}

// ---------- scale / measuring ----------

function enterMeasure() {
  if (!state.photo) return;
  setMode('measure');
  state.measure = { a: null, b: null, step: 0 };
  setHint('');
  clearTimeout(toastTimer);
  $('toast').hidden = true;
  $('scaleIdle').hidden = true;
  $('scaleMeasuring').hidden = false;
  $('measureBar').hidden = false;
  onReferenceChange();
  // On phones the controls are below the photo: bring the photo into view.
  $('stageWrap').scrollIntoView({ block: 'start', behavior: 'smooth' });
}

function restartMeasure() {
  state.measure = { a: null, b: null, step: 0 };
  updateMeasureUI();
  requestRender();
}

function exitMeasure() {
  $('scaleIdle').hidden = false;
  $('scaleMeasuring').hidden = true;
  $('measureBar').hidden = true;
  setMode('place');
  setHint('');
}

function updateMeasureUI() {
  const ref = REFERENCES[$('refSelect').value] || REFERENCES[0];
  const { step } = state.measure;
  const el = $('measureStep');
  const tip = coarsePointer ? 'Keep your finger down and slide to fine-tune.' : 'Hold the mouse button and drag to fine-tune.';
  if (step === 0) el.innerHTML = `<strong>Step 1 of 2:</strong> tap ${ref.ends[0]}.<small>${tip}</small>`;
  else if (step === 1) el.innerHTML = `<strong>Step 2 of 2:</strong> now tap ${ref.ends[1]}.<small>${tip}</small>`;
  else el.innerHTML = 'Check the line covers it exactly, then tap <strong>Apply scale</strong>.<small>Drag either end to adjust it.</small>';
  $('applyMeasureBtn').disabled = step < 2;
}

function onReferenceChange() {
  const ref = REFERENCES[$('refSelect').value];
  const input = $('refLength');
  if (ref?.cm) input.value = fmtNum(ref.cm);
  else {
    input.value = '';
    input.focus();
  }
  updateMeasureUI();
  requestRender();
}

function applyMeasure() {
  const lenCm = fromDisplay(parseFloat($('refLength').value));
  if (state.measure.step < 2) return;
  const px = distance(state.measure.a, state.measure.b);
  if (!(lenCm > 0)) {
    toast('Enter the real length of the object you marked.');
    $('refLength').focus();
    return;
  }
  if (px < 10) {
    toast('The two points are too close together. Tap Start again and mark both ends of the object.');
    return;
  }
  // Keep the piece anchored at its centre while the scale changes.
  state.pxPerCm = px / lenCm;
  state.scaleSource = 'measured';
  exitMeasure();
  syncScaleUI();
  toast('Scale set — the artwork is now shown at its true size.');
  requestRender();
}

function onWallWidthChange() {
  const cm = fromDisplay(parseFloat($('wallWidth').value));
  if (!(cm > 0) || !state.photo) return;
  state.pxPerCm = state.photo.width / cm;
  state.scaleSource = 'estimate';
  syncScaleUI(true);
  requestRender();
}

// ---------- modes / UI sync ----------

function setMode(mode) {
  state.mode = mode;
  const btn = $('perspectiveBtn');
  btn.setAttribute('aria-pressed', String(mode === 'perspective'));
  if (mode === 'perspective') {
    state.persp ||= [[0, 0], [0, 0], [0, 0], [0, 0]];
    setHint('Drag the corners to match the angle of your wall');
  } else if (mode === 'place') {
    setHint('');
  }
  requestRender();
}

function setHint(text) {
  clearTimeout(hintTimer);
  const el = $('stageHint');
  el.textContent = text;
  el.hidden = !text;
}
function flashHint(text) {
  setHint(text);
  hintTimer = setTimeout(() => state.mode === 'place' && setHint(''), 4000);
}

function toast(text, ms = 3500) {
  const el = $('toast');
  el.textContent = text;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (el.hidden = true), ms);
}

function syncScaleUI(skipWallInput) {
  const pill = $('scaleStatus');
  const labels = { estimate: 'Estimated', measured: 'Measured', sample: 'True size' };
  pill.textContent = labels[state.scaleSource];
  pill.classList.toggle('ok', state.scaleSource !== 'estimate');
  if (!skipWallInput && state.photo) $('wallWidth').value = fmtNum(state.photo.width / state.pxPerCm);
}

function syncUnitUI() {
  document.querySelectorAll('.unit-toggle button').forEach((b) => {
    b.setAttribute('aria-pressed', String(b.dataset.unit === state.unit));
  });
  document.querySelectorAll('.unit-label').forEach((el) => (el.textContent = state.unit));
}

function syncArtUI() {
  const art = state.art;
  if (!art) return;
  $('artTitle').textContent = art.title;
  const { w, h } = currentSize();
  const sizeText = art.sizeUnknown ? 'size not specified' : fmtSize(w, h);
  $('artMeta').textContent = [art.artist, sizeText].filter(Boolean).join(' · ');
  document.title = `${art.title} — View on Your Wall`;

  const sizeField = $('sizeField');
  const sel = $('sizeSelect');
  sizeField.hidden = art.sizes.length < 2;
  sel.innerHTML = '';
  art.sizes.forEach((s, i) => sel.add(new Option(fmtSize(s.w, s.h), String(i))));
  sel.value = String(art.sizeIndex);

  document.querySelectorAll('.swatch').forEach((s) => {
    s.setAttribute('aria-checked', String(s.dataset.frame === state.frameKey));
  });
  $('matSelect').value = String(state.matIndex);

  const buy = $('buyLink');
  buy.hidden = !state.buyUrl;
  if (state.buyUrl) buy.href = state.buyUrl;
}

function buildStaticUI() {
  $('brand').textContent = CONFIG.galleryName;
  if (CONFIG.galleryUrl) $('brand').href = CONFIG.galleryUrl;
  else $('brand').removeAttribute('href');

  const swatches = $('frameSwatches');
  for (const [key, f] of Object.entries(FRAMES)) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'swatch';
    b.dataset.frame = key;
    b.setAttribute('role', 'radio');
    b.setAttribute('aria-label', f.label);
    b.title = f.label;
    const inner = document.createElement('span');
    if (f.color) inner.style.setProperty('--c', f.color);
    if (f.slip) inner.style.setProperty('--c2', f.slip.color);
    b.append(inner);
    b.addEventListener('click', () => {
      state.frameKey = key;
      syncArtUI();
      requestRender();
    });
    swatches.append(b);
  }
  MATS.forEach((m, i) => $('matSelect').add(new Option(m.label, String(i))));
  REFERENCES.forEach((r, i) => $('refSelect').add(new Option(r.label, String(i))));
  $('cameraBtn').hidden = !matchMedia('(pointer: coarse)').matches;
  syncUnitUI();
}

function setUnit(unit) {
  if (unit === state.unit) return;
  // Convert any lengths typed into inputs so they keep the same real value.
  const inputs = ['wallWidth', 'refLength', 'ownW', 'ownH'].map($);
  const cms = inputs.map((el) => (el.value ? fromDisplay(parseFloat(el.value)) : null));
  state.unit = unit;
  inputs.forEach((el, i) => {
    if (cms[i] != null && !Number.isNaN(cms[i])) el.value = fmtNum(cms[i]);
  });
  syncUnitUI();
  syncArtUI();
  requestRender();
}

// ---------- export ----------

function renderMockup() {
  const P = state.photo;
  const caption = CONFIG.captionOnDownload;
  const capH = caption ? Math.round(Math.max(48, P.width * 0.035)) : 0;
  const out = document.createElement('canvas');
  out.width = P.width;
  out.height = P.height + capH;
  const g = out.getContext('2d');
  g.drawImage(P, 0, 0);
  const maxSide = Math.max(...artQuad().flat().map(Math.abs));
  const artPx = Math.min(EXPORT_ART_PX, Math.max(PREVIEW_ART_PX, maxSide));
  drawArtwork(g, getFramed(Math.round(artPx)), artQuad(), framedDims().depth * state.pxPerCm, state.shadow);
  if (caption) {
    g.fillStyle = '#ffffff';
    g.fillRect(0, P.height, out.width, capH);
    const fs = Math.round(capH * 0.36);
    g.font = `${fs}px Georgia, serif`;
    g.fillStyle = '#1f1d1a';
    g.textBaseline = 'middle';
    const y = P.height + capH / 2;
    const left = [state.art.title, state.art.artist].filter(Boolean).join(' — ');
    g.textAlign = 'left';
    g.fillText(left, capH * 0.4, y);
    const { w, h } = currentSize();
    g.textAlign = 'right';
    g.fillStyle = '#6d675f';
    g.fillText([fmtSize(w, h), CONFIG.galleryName].filter(Boolean).join('  ·  '), out.width - capH * 0.4, y);
  }
  return out;
}

async function mockupFile() {
  const canvas = renderMockup();
  const blob = await new Promise((resolve, reject) => {
    try {
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('empty'))), 'image/jpeg', 0.92);
    } catch (err) {
      reject(err);
    }
  });
  const slug = (state.art.title || 'artwork').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return new File([blob], `${slug || 'artwork'}-on-my-wall.jpg`, { type: 'image/jpeg' });
}

async function downloadMockup() {
  if (state.art.tainted) {
    toast("This artwork's image host doesn't allow downloads (CORS). Ask the gallery to enable it.", 5000);
    return;
  }
  try {
    const file = await mockupFile();
    const url = URL.createObjectURL(file);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  } catch (err) {
    console.error(err);
    toast("Sorry, the mockup couldn't be saved.");
  }
}

async function shareMockup() {
  try {
    const file = await mockupFile();
    await navigator.share({ files: [file], title: state.art.title, text: `${state.art.title} on my wall` });
  } catch (err) {
    if (err.name !== 'AbortError') toast("Sharing isn't available here — try Download instead.");
  }
}

// ---------- AR ----------

let modelViewerLoading = null;
let currentModelUrl = null;

function loadScript(src, type) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    if (type) s.type = type;
    s.src = src;
    s.onload = resolve;
    s.onerror = () => {
      s.remove();
      reject(new Error(`Failed to load ${src}`));
    };
    document.head.append(s);
  });
}

async function ensureModelViewer() {
  if (customElements.get('model-viewer')) return;
  modelViewerLoading ||= (async () => {
    for (const src of MODEL_VIEWER_SRC) {
      try {
        await loadScript(src, 'module');
        await customElements.whenDefined('model-viewer');
        return;
      } catch {
        /* try next CDN */
      }
    }
    throw new Error('model-viewer unavailable');
  })();
  try {
    await modelViewerLoading;
  } catch (err) {
    modelViewerLoading = null;
    throw err;
  }
}

function shareableUrl({ ar } = {}) {
  const u = new URL(location.href);
  if (ar) u.searchParams.set('ar', '1');
  else u.searchParams.delete('ar');
  u.searchParams.set('frame', state.frameKey);
  u.searchParams.set('size', String(state.art.sizeIndex));
  return u.href;
}

async function buildModelUrl() {
  const { w, h } = currentSize();
  const fd = framedDims();
  const f = frame();
  const tex = renderFramed(
    state.art.image,
    { artW: w, artH: h, frame: f, matCm: matCm(), brightness: 1 },
    AR_TEXTURE_PX
  );
  const blob = await new Promise((resolve, reject) =>
    tex.toBlob((b) => (b ? resolve(b) : reject(new Error('texture'))), 'image/jpeg', 0.9)
  );
  const glb = buildArtworkGLB({
    width: fd.w / 100,
    height: fd.h / 100,
    depth: fd.depth / 100,
    image: new Uint8Array(await blob.arrayBuffer()),
    mimeType: 'image/jpeg',
    sideColor: f.color ? hexToRgb01(f.color) : edgeColor(state.art.image),
  });
  if (currentModelUrl) URL.revokeObjectURL(currentModelUrl);
  currentModelUrl = URL.createObjectURL(new Blob([glb], { type: 'model/gltf-binary' }));
  return currentModelUrl;
}

async function openAR() {
  if (!state.art) return;
  if (state.art.tainted) {
    toast("This artwork's image host doesn't allow AR (CORS). Ask the gallery to enable it.", 5000);
    return;
  }
  // AR needs a top-level page (cross-origin iframes such as a Wix embed block it),
  // so break out into a new tab when the artwork can be passed by URL.
  if (inIframe && state.art.url) {
    const win = window.open(shareableUrl({ ar: true }), '_blank');
    if (win) {
      win.opener = null;
      return;
    }
    // Popup blocked: fall back to trying AR inside the frame.
  }

  const dialog = $('arDialog');
  const viewer = $('arViewer');
  const fd = framedDims();
  $('arSize').textContent = `${state.art.title} · ${fmtSize(fd.w, fd.h)}${fd.w !== currentSize().w ? ' framed' : ''}`;
  $('arMobile').hidden = true;
  $('arDesktop').hidden = true;
  $('arNote').textContent = '';
  viewer.innerHTML = '<p class="loading">Preparing 3D model…</p>';
  if (!dialog.open) dialog.showModal();

  try {
    const [src] = await Promise.all([buildModelUrl(), ensureModelViewer()]);
    const mv = document.createElement('model-viewer');
    mv.setAttribute('src', src);
    mv.setAttribute('alt', `${state.art.title}, ${fmtSize(fd.w, fd.h)}`);
    mv.setAttribute('ar', '');
    mv.setAttribute('ar-modes', 'webxr quick-look');
    mv.setAttribute('ar-placement', 'wall');
    mv.setAttribute('ar-scale', 'fixed');
    mv.setAttribute('camera-controls', '');
    mv.setAttribute('touch-action', 'pan-y');
    mv.setAttribute('shadow-intensity', '0.8');
    mv.setAttribute('environment-image', 'neutral');
    mv.setAttribute('camera-orbit', '-20deg 80deg auto');
    const btn = document.createElement('button');
    btn.slot = 'ar-button';
    btn.className = 'btn primary ar-launch';
    btn.textContent = 'View in your space';
    mv.append(btn);
    mv.addEventListener('load', () => updateARHelp(mv), { once: true });
    mv.addEventListener('ar-status', (e) => {
      if (e.detail.status === 'failed') {
        $('arNote').textContent = "AR couldn't start on this device. Make sure camera access is allowed.";
      }
    });
    viewer.innerHTML = '';
    viewer.append(mv);
  } catch (err) {
    console.error(err);
    viewer.innerHTML = '<p class="loading">The 3D viewer couldn\'t load. Check your connection and try again.</p>';
  }
}

async function updateARHelp(mv) {
  if (mv.canActivateAR) {
    $('arMobile').hidden = false;
    return;
  }
  $('arDesktop').hidden = false;
  const qr = $('qr');
  qr.innerHTML = '';
  const link = shareableUrl({ ar: true });
  if (!state.art.url) {
    $('arNote').textContent =
      'Your uploaded artwork stays on this device, so the code opens the viewer without it — upload the image again on your phone.';
  }
  try {
    if (!window.QRCode) await loadScript(QR_SRC);
    new window.QRCode(qr, { text: link, width: 180, height: 180, correctLevel: window.QRCode.CorrectLevel.M });
  } catch {
    qr.hidden = true;
    $('arNote').textContent = `Open this link on your phone: ${link}`;
  }
}

// ---------- wiring ----------

function wireUI() {
  $('photoInput').addEventListener('change', (e) => handlePhotoFile(e.target.files[0]));
  $('cameraInput').addEventListener('change', (e) => handlePhotoFile(e.target.files[0]));
  $('sampleRoomBtn').addEventListener('click', useSampleRoom);
  $('measureBtn').addEventListener('click', enterMeasure);
  $('applyMeasureBtn').addEventListener('click', applyMeasure);
  $('cancelMeasureBtn').addEventListener('click', exitMeasure);
  $('restartMeasureBtn').addEventListener('click', restartMeasure);
  $('refSelect').addEventListener('change', onReferenceChange);
  $('refLength').addEventListener('input', requestRender);
  $('wallWidth').addEventListener('change', onWallWidthChange);
  $('sizeSelect').addEventListener('change', (e) => {
    state.art.sizeIndex = parseInt(e.target.value, 10);
    syncArtUI();
    requestRender();
  });
  $('matSelect').addEventListener('change', (e) => {
    state.matIndex = parseInt(e.target.value, 10);
    requestRender();
  });
  $('brightness').addEventListener('input', (e) => {
    state.brightness = parseFloat(e.target.value);
    requestRender();
  });
  $('shadowToggle').addEventListener('change', (e) => {
    state.shadow = e.target.checked;
    requestRender();
  });
  $('perspectiveBtn').addEventListener('click', () => {
    if (state.mode === 'measure') exitMeasure();
    setMode(state.mode === 'perspective' ? 'place' : 'perspective');
  });
  $('resetBtn').addEventListener('click', () => {
    if (!state.photo) return;
    state.persp = null;
    state.pos = [state.photo.width / 2, state.photo.height * 0.42];
    if (state.mode === 'perspective') setMode('place');
    requestRender();
  });
  $('artInput').addEventListener('change', (e) => handleArtFile(e.target.files[0]));
  $('ownW').addEventListener('change', () => setOwnSize('w'));
  $('ownH').addEventListener('change', () => setOwnSize('h'));
  document.querySelectorAll('.unit-toggle button').forEach((b) => b.addEventListener('click', () => setUnit(b.dataset.unit)));
  $('downloadBtn').addEventListener('click', downloadMockup);
  $('arBtn').addEventListener('click', openAR);
  $('arClose').addEventListener('click', () => $('arDialog').close());
  $('arDialog').addEventListener('close', () => {
    $('arViewer').innerHTML = '';
  });

  if (navigator.canShare?.({ files: [new File([''], 'x.jpg', { type: 'image/jpeg' })] })) {
    $('shareBtn').hidden = false;
    $('shareBtn').addEventListener('click', shareMockup);
  }

  // Drag & drop a wall photo onto the stage.
  const wrap = $('stageWrap');
  const overlay = $('dropOverlay');
  wrap.addEventListener('dragover', (e) => {
    e.preventDefault();
    overlay.hidden = false;
  });
  wrap.addEventListener('dragleave', (e) => {
    if (!wrap.contains(e.relatedTarget)) overlay.hidden = true;
  });
  wrap.addEventListener('drop', (e) => {
    e.preventDefault();
    overlay.hidden = true;
    handlePhotoFile(e.dataTransfer.files[0]);
  });

  new ResizeObserver(layoutStage).observe(stage);

  // Host pages (e.g. Wix Velo) can send the artwork with postMessage.
  window.addEventListener('message', (e) => {
    const d = e.data;
    if (!d || typeof d !== 'object' || d.type !== 'roomviewer:setArtwork') return;
    const spec = { ...d };
    if (Array.isArray(d.sizes)) spec.sizes = d.sizes.map((s) => (typeof s === 'string' ? s : `${s.w}x${s.h}`)).join(',');
    loadArtworkSpec(spec);
  });
}

async function init() {
  const params = Object.fromEntries(new URLSearchParams(location.search));
  if (params.display === 'in' || params.display === 'cm') state.unit = params.display;
  else if (params.unit === 'in' || params.unit === 'cm') state.unit = params.unit;
  buildStaticUI();
  wireUI();
  useSampleRoom();
  await loadArtworkSpec(params);
  syncScaleUI();
  if (inIframe) window.parent.postMessage({ type: 'roomviewer:ready' }, '*');
  if (params.ar === '1') openAR();
}

init();
