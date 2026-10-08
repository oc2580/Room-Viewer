// Procedurally drawn sample room and sample artwork, so the viewer works
// before the visitor uploads anything (and without any network requests).

/** Sample living room. Returns { canvas, pxPerCm, suggestedCenter }. */
export function createSampleRoom() {
  const W = 2000;
  const H = 1250;
  const pxPerCm = 4; // the image represents a 5 m wide wall
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d');
  const floorY = 1010;

  // Wall with soft light falloff.
  const wall = g.createLinearGradient(0, 0, W, 0);
  wall.addColorStop(0, '#d9d3c9');
  wall.addColorStop(0.45, '#ebe6dd');
  wall.addColorStop(1, '#d4cdc2');
  g.fillStyle = wall;
  g.fillRect(0, 0, W, floorY);
  const glow = g.createRadialGradient(W * 0.42, 120, 50, W * 0.42, 300, 1100);
  glow.addColorStop(0, 'rgba(255,250,240,0.45)');
  glow.addColorStop(1, 'rgba(255,250,240,0)');
  g.fillStyle = glow;
  g.fillRect(0, 0, W, floorY);
  speckle(g, 0, 0, W, floorY, 9000, 0.025);

  // Floor: oak planks.
  const floor = g.createLinearGradient(0, floorY, 0, H);
  floor.addColorStop(0, '#a27d57');
  floor.addColorStop(1, '#7d5c3e');
  g.fillStyle = floor;
  g.fillRect(0, floorY, W, H - floorY);
  g.strokeStyle = 'rgba(60,40,25,0.25)';
  g.lineWidth = 2;
  for (let y = floorY + 30, k = 0; y < H; y += 30 + k * 6, k++) {
    g.beginPath();
    g.moveTo(0, y);
    g.lineTo(W, y);
    g.stroke();
  }
  // Baseboard (10 cm).
  g.fillStyle = '#f4f1ea';
  g.fillRect(0, floorY - 40, W, 40);
  g.fillStyle = 'rgba(0,0,0,0.08)';
  g.fillRect(0, floorY - 4, W, 4);

  // Sofa: 220 cm wide, back 85 cm tall, centred under the art position.
  const sofaW = 220 * pxPerCm;
  const sofaX = W / 2 - sofaW / 2;
  const backTop = floorY - 85 * pxPerCm;
  const seatTop = floorY - 45 * pxPerCm;
  g.fillStyle = 'rgba(0,0,0,0.18)';
  g.beginPath();
  g.ellipse(W / 2, floorY + 18, sofaW * 0.55, 26, 0, 0, Math.PI * 2);
  g.fill();
  roundRect(g, sofaX + 20, backTop, sofaW - 40, seatTop - backTop + 40, 28, '#5f6f6a');
  roundRect(g, sofaX, seatTop - 10, sofaW, 120, 24, '#566560');
  roundRect(g, sofaX - 10, seatTop - 80, 100, 210, 26, '#4f5d58');
  roundRect(g, sofaX + sofaW - 90, seatTop - 80, 100, 210, 26, '#4f5d58');
  for (let i = 0; i < 2; i++) {
    roundRect(g, sofaX + 100 + i * ((sofaW - 200) / 2) + 6, seatTop - 18, (sofaW - 200) / 2 - 12, 70, 18, '#63736d');
  }
  roundRect(g, sofaX + 140, backTop + 60, 150, 130, 30, '#c9a46a');
  roundRect(g, sofaX + sofaW - 300, backTop + 70, 150, 120, 30, '#e7e0d2');
  g.fillStyle = '#2b2522';
  g.fillRect(sofaX + 40, seatTop + 110, 16, 70);
  g.fillRect(sofaX + sofaW - 56, seatTop + 110, 16, 70);

  // Side table with a plant.
  const tX = sofaX + sofaW + 70;
  g.fillStyle = '#3a2f28';
  g.fillRect(tX, floorY - 55 * pxPerCm, 170, 16);
  g.fillRect(tX + 75, floorY - 55 * pxPerCm, 20, 55 * pxPerCm);
  g.fillRect(tX + 30, floorY - 10, 110, 10);
  roundRect(g, tX + 45, floorY - 55 * pxPerCm - 90, 80, 90, 12, '#d8cfc1');
  g.fillStyle = '#4c6b45';
  for (let i = 0; i < 9; i++) {
    const a = -Math.PI / 2 + (i - 4) * 0.28;
    g.beginPath();
    g.ellipse(tX + 85 + Math.cos(a) * 70, floorY - 55 * pxPerCm - 120 + Math.sin(a) * 70, 22, 60, a + Math.PI / 2, 0, Math.PI * 2);
    g.fill();
  }

  // Floor lamp on the left.
  const lX = sofaX - 130;
  g.fillStyle = '#2b2522';
  g.fillRect(lX, floorY - 160 * pxPerCm, 8, 160 * pxPerCm);
  g.fillRect(lX - 40, floorY - 8, 88, 8);
  g.fillStyle = '#f1e7d2';
  g.beginPath();
  g.moveTo(lX - 60, floorY - 160 * pxPerCm);
  g.lineTo(lX + 68, floorY - 160 * pxPerCm);
  g.lineTo(lX + 44, floorY - 160 * pxPerCm - 110);
  g.lineTo(lX - 36, floorY - 160 * pxPerCm - 110);
  g.closePath();
  g.fill();

  return { canvas: c, pxPerCm, suggestedCenter: [W / 2, backTop - 40 * pxPerCm] };
}

/** Sample abstract painting (colour-field study). Portrait 3:4. */
export function createSampleArtwork() {
  const W = 1200;
  const H = 1600;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d');
  g.fillStyle = '#c6532f';
  g.fillRect(0, 0, W, H);
  const fields = [
    { y: 80, h: 520, color: '#f0b04a' },
    { y: 660, h: 300, color: '#8c2f22' },
    { y: 1020, h: 500, color: '#2e3d52' },
  ];
  for (const f of fields) {
    g.save();
    g.filter = 'blur(14px)';
    g.fillStyle = f.color;
    g.fillRect(80, f.y, W - 160, f.h);
    g.restore();
    speckle(g, 80, f.y, W - 160, f.h, 4000, 0.06);
  }
  // Canvas weave texture.
  g.globalAlpha = 0.05;
  g.fillStyle = '#000';
  for (let x = 0; x < W; x += 4) g.fillRect(x, 0, 1, H);
  for (let y = 0; y < H; y += 4) g.fillRect(0, y, W, 1);
  g.globalAlpha = 1;
  return c;
}

function roundRect(g, x, y, w, h, r, fill) {
  g.fillStyle = fill;
  g.beginPath();
  g.roundRect(x, y, w, h, r);
  g.fill();
}

function speckle(g, x, y, w, h, count, alpha) {
  // Deterministic pseudo-random noise so the sample looks the same every time.
  let seed = 7;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < count; i++) {
    g.fillStyle = rand() > 0.5 ? `rgba(255,255,255,${alpha})` : `rgba(0,0,0,${alpha})`;
    g.fillRect(x + rand() * w, y + rand() * h, 2, 2);
  }
}
