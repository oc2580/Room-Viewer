// Renders the artwork with its mat and frame into a single image whose
// proportions match the real framed piece.

/**
 * @param {CanvasImageSource & {width:number,height:number}} art
 * @param {object} o
 * @param {number} o.artW  artwork width, cm
 * @param {number} o.artH  artwork height, cm
 * @param {object} o.frame entry from FRAMES
 * @param {number} o.matCm mat border width, cm
 * @param {number} o.brightness 1 = unchanged; <1 darker, >1 lighter (to match room light)
 * @param {number} maxPx longest side of the output in pixels
 */
export function renderFramed(art, { artW, artH, frame, matCm, brightness = 1 }, maxPx) {
  const fw = frame.width || 0;
  const totalW = artW + 2 * (matCm + fw);
  const totalH = artH + 2 * (matCm + fw);
  const s = maxPx / Math.max(totalW, totalH);
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(totalW * s));
  c.height = Math.max(1, Math.round(totalH * s));
  const g = c.getContext('2d');
  const F = fw * s;
  const M = matCm * s;

  if (F > 0) drawFrame(g, c.width, c.height, F, frame);
  if (M > 0) {
    g.fillStyle = '#f7f5f0';
    g.fillRect(F, F, c.width - 2 * F, c.height - 2 * F);
    // Bevelled inner edge of the mat.
    g.strokeStyle = 'rgba(255,255,255,0.9)';
    g.lineWidth = Math.max(1, s * 0.25);
    g.strokeRect(F + M - g.lineWidth, F + M - g.lineWidth, c.width - 2 * (F + M) + 2 * g.lineWidth, c.height - 2 * (F + M) + 2 * g.lineWidth);
  }
  g.drawImage(art, F + M, F + M, c.width - 2 * (F + M), c.height - 2 * (F + M));
  if (F > 0) {
    // Inner shadow cast by the frame lip onto the mat/art.
    const lip = Math.max(2, s * 0.6);
    g.fillStyle = 'rgba(0,0,0,0.18)';
    g.fillRect(F, F, c.width - 2 * F, lip);
    g.fillRect(F, F, lip, c.height - 2 * F);
  }
  applyBrightness(g, c.width, c.height, brightness);
  return c;
}

function drawFrame(g, w, h, F, frame) {
  const base = frame.color;
  // Four mitred sides, each lit differently (light from the top-left).
  const sides = [
    { pts: [[0, 0], [w, 0], [w - F, F], [F, F]], shade: 0.12 }, // top
    { pts: [[w, 0], [w, h], [w - F, h - F], [w - F, F]], shade: -0.1 }, // right
    { pts: [[w, h], [0, h], [F, h - F], [w - F, h - F]], shade: -0.2 }, // bottom
    { pts: [[0, h], [0, 0], [F, F], [F, h - F]], shade: 0.05 }, // left
  ];
  for (const side of sides) {
    g.save();
    g.beginPath();
    side.pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
    g.closePath();
    g.clip();
    g.fillStyle = shadeColor(base, side.shade);
    g.fillRect(0, 0, w, h);
    if (frame.grain) drawGrain(g, w, h, F, side === sides[0] || side === sides[2]);
    if (frame.metallic) {
      const sheen = g.createLinearGradient(0, 0, w, h);
      sheen.addColorStop(0, 'rgba(255,240,200,0.35)');
      sheen.addColorStop(0.5, 'rgba(255,240,200,0)');
      sheen.addColorStop(1, 'rgba(80,60,20,0.25)');
      g.fillStyle = sheen;
      g.fillRect(0, 0, w, h);
    }
    g.restore();
  }
  // Outer and inner edge highlights.
  g.strokeStyle = 'rgba(0,0,0,0.35)';
  g.lineWidth = 1;
  g.strokeRect(0.5, 0.5, w - 1, h - 1);
  g.strokeStyle = 'rgba(255,255,255,0.18)';
  g.strokeRect(F - 0.5, F - 0.5, w - 2 * F + 1, h - 2 * F + 1);
}

function drawGrain(g, w, h, F, horizontal) {
  let seed = horizontal ? 11 : 23;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  g.lineWidth = Math.max(1, F / 18);
  const lines = 60;
  for (let i = 0; i < lines; i++) {
    g.strokeStyle = `rgba(40,20,5,${0.05 + rand() * 0.1})`;
    g.beginPath();
    if (horizontal) {
      const y = rand() * h;
      g.moveTo(0, y);
      g.bezierCurveTo(w * 0.3, y + (rand() - 0.5) * F * 0.3, w * 0.6, y + (rand() - 0.5) * F * 0.3, w, y);
    } else {
      const x = rand() * w;
      g.moveTo(x, 0);
      g.bezierCurveTo(x + (rand() - 0.5) * F * 0.3, h * 0.3, x + (rand() - 0.5) * F * 0.3, h * 0.6, x, h);
    }
    g.stroke();
  }
}

function applyBrightness(g, w, h, b) {
  if (Math.abs(b - 1) < 0.005) return;
  g.save();
  if (b < 1) {
    g.globalCompositeOperation = 'multiply';
    const v = Math.round(255 * b);
    g.fillStyle = `rgb(${v},${v},${v})`;
  } else {
    g.globalCompositeOperation = 'screen';
    const v = Math.round(255 * Math.min(1, b - 1));
    g.fillStyle = `rgb(${v},${v},${v})`;
  }
  g.fillRect(0, 0, w, h);
  g.restore();
}

export function shadeColor(hex, amount) {
  const n = parseInt(hex.slice(1), 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) =>
    Math.round(amount >= 0 ? v + (255 - v) * amount : v * (1 + amount))
  );
  return `rgb(${ch.join(',')})`;
}

export function hexToRgb01(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

/** Average colour of the image's outer edge, 0..1 sRGB (used for canvas-wrap sides in AR). */
export function edgeColor(img) {
  const c = document.createElement('canvas');
  c.width = 32;
  c.height = 32;
  const g = c.getContext('2d', { willReadFrequently: true });
  g.drawImage(img, 0, 0, 32, 32);
  const { data } = g.getImageData(0, 0, 32, 32);
  let r = 0, gr = 0, b = 0, n = 0;
  for (let y = 0; y < 32; y++) {
    for (let x = 0; x < 32; x++) {
      if (x > 1 && x < 30 && y > 1 && y < 30) continue;
      const i = (y * 32 + x) * 4;
      r += data[i];
      gr += data[i + 1];
      b += data[i + 2];
      n++;
    }
  }
  return [r / n / 255, gr / n / 255, b / n / 255];
}
