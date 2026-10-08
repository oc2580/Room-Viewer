import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  solveHomography,
  applyHomography,
  pointInQuad,
  isConvexQuad,
  triangleAffine,
  distanceToSegment,
} from '../js/geometry.js';

const unit = [[0, 0], [1, 0], [1, 1], [0, 1]];
const close = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} != ${b}`);

test('homography maps the four corners exactly', () => {
  const quad = [[100, 120], [420, 90], [400, 380], [130, 350]];
  const H = solveHomography(unit, quad);
  unit.forEach(([x, y], i) => {
    const [u, v] = applyHomography(H, x, y);
    close(u, quad[i][0]);
    close(v, quad[i][1]);
  });
});

test('homography of a rectangle is affine (centre maps to centre)', () => {
  const H = solveHomography(unit, [[10, 20], [110, 20], [110, 70], [10, 70]]);
  const [u, v] = applyHomography(H, 0.5, 0.5);
  close(u, 60);
  close(v, 45);
});

test('degenerate quad has no homography', () => {
  assert.equal(solveHomography(unit, [[0, 0], [0, 0], [0, 0], [0, 0]]), null);
});

test('pointInQuad', () => {
  const q = [[0, 0], [10, 0], [12, 10], [-2, 10]];
  assert.ok(pointInQuad([5, 5], q));
  assert.ok(!pointInQuad([20, 5], q));
  assert.ok(pointInQuad([5, 5], [...q].reverse()));
});

test('isConvexQuad rejects self-intersecting and collapsed quads', () => {
  assert.ok(isConvexQuad([[0, 0], [10, 0], [10, 10], [0, 10]]));
  assert.ok(!isConvexQuad([[0, 0], [10, 10], [10, 0], [0, 10]]));
  assert.ok(!isConvexQuad([[0, 0], [5, 0], [10, 0], [0, 10]]));
});

test('triangleAffine maps source triangle onto destination', () => {
  const s = [[0, 0], [100, 0], [0, 50]];
  const d = [[10, 10], [60, 30], [5, 80]];
  const [a, b, c, dd, e, f] = triangleAffine(...s, ...d);
  s.forEach(([x, y], i) => {
    close(a * x + c * y + e, d[i][0]);
    close(b * x + dd * y + f, d[i][1]);
  });
});

test('distanceToSegment', () => {
  close(distanceToSegment([5, 3], [0, 0], [10, 0]), 3);
  close(distanceToSegment([-4, 3], [0, 0], [10, 0]), 5);
});
