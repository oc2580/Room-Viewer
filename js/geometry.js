// Geometry helpers: perspective (homography) mapping and hit testing.
// Pure functions with no DOM access so they can be unit tested in Node.

/**
 * Solve the 3x3 homography H that maps 4 source points onto 4 destination points.
 * Points are [x, y] arrays. Returns a 9-element row-major array, or null if degenerate.
 */
export function solveHomography(src, dst) {
  const A = [];
  const b = [];
  for (let i = 0; i < 4; i++) {
    const [x, y] = src[i];
    const [u, v] = dst[i];
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]);
    b.push(u);
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y]);
    b.push(v);
  }
  const h = solveLinear(A, b);
  return h ? [...h, 1] : null;
}

/** Map a point through homography H. */
export function applyHomography(H, x, y) {
  const w = H[6] * x + H[7] * y + H[8];
  return [(H[0] * x + H[1] * y + H[2]) / w, (H[3] * x + H[4] * y + H[5]) / w];
}

/** Gaussian elimination with partial pivoting. Mutates copies only. */
function solveLinear(A, b) {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let r = col + 1; r < n; r++) {
      if (Math.abs(M[r][col]) > Math.abs(M[pivot][col])) pivot = r;
    }
    if (Math.abs(M[pivot][col]) < 1e-12) return null;
    [M[col], M[pivot]] = [M[pivot], M[col]];
    for (let r = col + 1; r < n; r++) {
      const f = M[r][col] / M[col][col];
      for (let c = col; c <= n; c++) M[r][c] -= f * M[col][c];
    }
  }
  const x = new Array(n);
  for (let r = n - 1; r >= 0; r--) {
    let s = M[r][n];
    for (let c = r + 1; c < n; c++) s -= M[r][c] * x[c];
    x[r] = s / M[r][r];
  }
  return x;
}

/** True if point p lies inside the convex quad (any winding). */
export function pointInQuad(p, quad) {
  let sign = 0;
  for (let i = 0; i < 4; i++) {
    const [ax, ay] = quad[i];
    const [bx, by] = quad[(i + 1) % 4];
    const cross = (bx - ax) * (p[1] - ay) - (by - ay) * (p[0] - ax);
    if (Math.abs(cross) < 1e-9) continue;
    const s = Math.sign(cross);
    if (sign === 0) sign = s;
    else if (s !== sign) return false;
  }
  return true;
}

/** True if the quad is convex and non-degenerate (corners in order). */
export function isConvexQuad(quad) {
  let sign = 0;
  for (let i = 0; i < 4; i++) {
    const [ax, ay] = quad[i];
    const [bx, by] = quad[(i + 1) % 4];
    const [cx, cy] = quad[(i + 2) % 4];
    const cross = (bx - ax) * (cy - by) - (by - ay) * (cx - bx);
    if (Math.abs(cross) < 1e-6) return false;
    const s = Math.sign(cross);
    if (sign === 0) sign = s;
    else if (s !== sign) return false;
  }
  return true;
}

export function distance(a, b) {
  return Math.hypot(b[0] - a[0], b[1] - a[1]);
}

/** Distance from point p to segment ab. */
export function distanceToSegment(p, a, b) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return distance(p, a);
  let t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return distance(p, [a[0] + t * dx, a[1] + t * dy]);
}

/**
 * Draw `img` (any CanvasImageSource with width/height) warped into `quad`
 * (TL, TR, BR, BL) by subdividing into affine triangles.
 */
export function drawImageInQuad(ctx, img, quad, subdivisions = 12) {
  const iw = img.width;
  const ih = img.height;
  const H = solveHomography([[0, 0], [1, 0], [1, 1], [0, 1]], quad);
  if (!H) return;
  const n = subdivisions;
  const pts = [];
  for (let j = 0; j <= n; j++) {
    const row = [];
    for (let i = 0; i <= n; i++) row.push(applyHomography(H, i / n, j / n));
    pts.push(row);
  }
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const s00 = [(i / n) * iw, (j / n) * ih];
      const s10 = [((i + 1) / n) * iw, (j / n) * ih];
      const s11 = [((i + 1) / n) * iw, ((j + 1) / n) * ih];
      const s01 = [(i / n) * iw, ((j + 1) / n) * ih];
      drawTriangle(ctx, img, s00, s10, s11, pts[j][i], pts[j][i + 1], pts[j + 1][i + 1]);
      drawTriangle(ctx, img, s00, s11, s01, pts[j][i], pts[j + 1][i + 1], pts[j + 1][i]);
    }
  }
}

/** Affine transform mapping source triangle (s0,s1,s2) onto destination (d0,d1,d2). */
export function triangleAffine(s0, s1, s2, d0, d1, d2) {
  const sx1 = s1[0] - s0[0], sy1 = s1[1] - s0[1];
  const sx2 = s2[0] - s0[0], sy2 = s2[1] - s0[1];
  const dx1 = d1[0] - d0[0], dy1 = d1[1] - d0[1];
  const dx2 = d2[0] - d0[0], dy2 = d2[1] - d0[1];
  const det = sx1 * sy2 - sx2 * sy1;
  if (Math.abs(det) < 1e-12) return null;
  const a = (dx1 * sy2 - dx2 * sy1) / det;
  const b = (dy1 * sy2 - dy2 * sy1) / det;
  const c = (sx1 * dx2 - sx2 * dx1) / det;
  const d = (sx1 * dy2 - sx2 * dy1) / det;
  const e = d0[0] - a * s0[0] - c * s0[1];
  const f = d0[1] - b * s0[0] - d * s0[1];
  return [a, b, c, d, e, f];
}

function drawTriangle(ctx, img, s0, s1, s2, d0, d1, d2) {
  const m = triangleAffine(s0, s1, s2, d0, d1, d2);
  if (!m) return;
  // Grow the clip triangle slightly so neighbouring triangles overlap (hides seams).
  const cx = (d0[0] + d1[0] + d2[0]) / 3;
  const cy = (d0[1] + d1[1] + d2[1]) / 3;
  const grow = (p) => {
    const dx = p[0] - cx, dy = p[1] - cy;
    const len = Math.hypot(dx, dy) || 1;
    return [p[0] + (dx / len) * 0.75, p[1] + (dy / len) * 0.75];
  };
  const g0 = grow(d0), g1 = grow(d1), g2 = grow(d2);
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(g0[0], g0[1]);
  ctx.lineTo(g1[0], g1[1]);
  ctx.lineTo(g2[0], g2[1]);
  ctx.closePath();
  ctx.clip();
  ctx.transform(m[0], m[1], m[2], m[3], m[4], m[5]);
  ctx.drawImage(img, 0, 0);
  ctx.restore();
}
