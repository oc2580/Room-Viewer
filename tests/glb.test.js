import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildArtworkGLB } from '../js/glb.js';

// Smallest valid PNG (1x1) — content is irrelevant to the container checks.
const PNG = Uint8Array.from(
  Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64')
);

function parse(glb) {
  const dv = new DataView(glb.buffer, glb.byteOffset, glb.byteLength);
  const jsonLen = dv.getUint32(12, true);
  const json = JSON.parse(new TextDecoder().decode(glb.subarray(20, 20 + jsonLen)));
  const binHeader = 20 + jsonLen;
  const binLen = dv.getUint32(binHeader, true);
  return { dv, json, jsonLen, binLen, bin: glb.subarray(binHeader + 8, binHeader + 8 + binLen), binHeader };
}

const glb = buildArtworkGLB({ width: 0.66, height: 0.86, depth: 0.035, image: PNG, mimeType: 'image/png', sideColor: [0.1, 0.1, 0.1] });

test('GLB header and chunks are well formed', () => {
  const { dv, jsonLen, binLen, binHeader } = parse(glb);
  assert.equal(dv.getUint32(0, true), 0x46546c67);
  assert.equal(dv.getUint32(4, true), 2);
  assert.equal(dv.getUint32(8, true), glb.byteLength);
  assert.equal(dv.getUint32(16, true), 0x4e4f534a);
  assert.equal(dv.getUint32(binHeader + 4, true), 0x004e4942);
  assert.equal(jsonLen % 4, 0);
  assert.equal(binLen % 4, 0);
  assert.equal(20 + jsonLen + 8 + binLen, glb.byteLength);
});

test('buffer views and accessors stay in bounds and aligned', () => {
  const { json, binLen } = parse(glb);
  assert.equal(json.buffers[0].byteLength, binLen);
  for (const v of json.bufferViews) {
    assert.ok(v.byteOffset + v.byteLength <= binLen);
  }
  const sizes = { SCALAR: 1, VEC2: 2, VEC3: 3 };
  const bytes = { 5126: 4, 5123: 2 };
  for (const a of json.accessors) {
    const v = json.bufferViews[a.bufferView];
    assert.equal(v.byteOffset % bytes[a.componentType], 0);
    assert.equal(a.count * sizes[a.type] * bytes[a.componentType], v.byteLength);
  }
});

test('model has real-world dimensions in metres', () => {
  const { json } = parse(glb);
  const pos = json.accessors.filter((a) => a.min);
  const min = [0, 1, 2].map((k) => Math.min(...pos.map((a) => a.min[k])));
  const max = [0, 1, 2].map((k) => Math.max(...pos.map((a) => a.max[k])));
  const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-6, `${a} != ${b}`);
  close(max[0] - min[0], 0.66);
  close(max[1] - min[1], 0.86);
  close(max[2] - min[2], 0.035);
});

test('front face points +Z with counter-clockwise winding, and texture is embedded', () => {
  const { json, bin } = parse(glb);
  const prim = json.meshes[0].primitives[0];
  const read = (idx, Arr) => {
    const a = json.accessors[idx];
    const v = json.bufferViews[a.bufferView];
    return new Arr(bin.buffer.slice(bin.byteOffset + v.byteOffset, bin.byteOffset + v.byteOffset + v.byteLength));
  };
  const p = read(prim.attributes.POSITION, Float32Array);
  const n = read(prim.attributes.NORMAL, Float32Array);
  const i = read(prim.indices, Uint16Array);
  assert.deepEqual([...n.slice(0, 3)], [0, 0, 1]);
  const v = (k) => [p[k * 3], p[k * 3 + 1], p[k * 3 + 2]];
  const [a, b, c] = [v(i[0]), v(i[1]), v(i[2])];
  const crossZ = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  assert.ok(crossZ > 0, 'front triangle should face the viewer');
  const img = json.images[0];
  const view = json.bufferViews[img.bufferView];
  assert.deepEqual([...bin.subarray(view.byteOffset, view.byteOffset + view.byteLength)], [...PNG]);
  assert.equal(json.materials[0].pbrMetallicRoughness.baseColorTexture.index, 0);
});
