// Builds a binary glTF (GLB) of a framed artwork: a thin box, sized in metres,
// whose front face carries the artwork texture. Used for AR (model-viewer
// shows it in WebXR on Android and converts it to USDZ for iOS Quick Look).
// No DOM access, so it can be unit tested in Node.

const FLOAT = 5126;
const UNSIGNED_SHORT = 5123;
const ARRAY_BUFFER = 34962;
const ELEMENT_ARRAY_BUFFER = 34963;

/**
 * @param {object} o
 * @param {number} o.width   metres (total, including frame)
 * @param {number} o.height  metres
 * @param {number} o.depth   metres (distance the piece sticks out from the wall)
 * @param {Uint8Array} o.image  encoded PNG/JPEG for the front face
 * @param {string} o.mimeType   "image/jpeg" | "image/png"
 * @param {number[]} o.sideColor sRGB [r,g,b] 0..1 for the edges and back
 * @returns {Uint8Array} GLB bytes
 */
export function buildArtworkGLB({ width, height, depth, image, mimeType, sideColor = [0.1, 0.1, 0.1] }) {
  const w = width / 2, h = height / 2, d = depth / 2;

  // Each face: centre, normal, u axis, v axis, with u x v = normal so the
  // vertex order (c-u-v, c+u-v, c+u+v, c-u+v) is counter-clockwise from outside.
  const front = face([0, 0, d], [0, 0, 1], [w, 0, 0], [0, h, 0]);
  const sides = [
    face([0, 0, -d], [0, 0, -1], [-w, 0, 0], [0, h, 0]), // back
    face([w, 0, 0], [1, 0, 0], [0, 0, -d], [0, h, 0]), // right
    face([-w, 0, 0], [-1, 0, 0], [0, 0, d], [0, h, 0]), // left
    face([0, h, 0], [0, 1, 0], [w, 0, 0], [0, 0, -d]), // top
    face([0, -h, 0], [0, -1, 0], [w, 0, 0], [0, 0, d]), // bottom
  ];

  // glTF UV origin is top-left: BL, BR, TR, TL.
  const frontUV = [0, 1, 1, 1, 1, 0, 0, 0];
  const quadIdx = (base) => [base, base + 1, base + 2, base, base + 2, base + 3];

  const sidePos = sides.flatMap((f) => f.positions);
  const sideNrm = sides.flatMap((f) => f.normals);
  const sideIdx = sides.flatMap((_, i) => quadIdx(i * 4));

  const chunks = [];
  const bufferViews = [];
  const accessors = [];
  let offset = 0;

  const addView = (bytes, target) => {
    const pad = (4 - (offset % 4)) % 4;
    if (pad) {
      chunks.push(new Uint8Array(pad));
      offset += pad;
    }
    const view = { buffer: 0, byteOffset: offset, byteLength: bytes.byteLength };
    if (target) view.target = target;
    bufferViews.push(view);
    chunks.push(new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength));
    offset += bytes.byteLength;
    return bufferViews.length - 1;
  };
  const addAccessor = (array, type, componentType, target, withBounds) => {
    const typed = componentType === FLOAT ? new Float32Array(array) : new Uint16Array(array);
    const size = { SCALAR: 1, VEC2: 2, VEC3: 3 }[type];
    const acc = {
      bufferView: addView(typed, target),
      componentType,
      count: array.length / size,
      type,
    };
    if (withBounds) {
      acc.min = [0, 1, 2].map((k) => Math.min(...array.filter((_, i) => i % 3 === k)));
      acc.max = [0, 1, 2].map((k) => Math.max(...array.filter((_, i) => i % 3 === k)));
    }
    accessors.push(acc);
    return accessors.length - 1;
  };

  const fPos = addAccessor(front.positions, 'VEC3', FLOAT, ARRAY_BUFFER, true);
  const fNrm = addAccessor(front.normals, 'VEC3', FLOAT, ARRAY_BUFFER);
  const fUV = addAccessor(frontUV, 'VEC2', FLOAT, ARRAY_BUFFER);
  const fIdx = addAccessor(quadIdx(0), 'SCALAR', UNSIGNED_SHORT, ELEMENT_ARRAY_BUFFER);
  const sPos = addAccessor(sidePos, 'VEC3', FLOAT, ARRAY_BUFFER, true);
  const sNrm = addAccessor(sideNrm, 'VEC3', FLOAT, ARRAY_BUFFER);
  const sIdx = addAccessor(sideIdx, 'SCALAR', UNSIGNED_SHORT, ELEMENT_ARRAY_BUFFER);
  const imageView = addView(image);

  const toLinear = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));

  const json = {
    asset: { version: '2.0', generator: 'Room Viewer' },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0, name: 'Artwork' }],
    meshes: [
      {
        name: 'Artwork',
        primitives: [
          { attributes: { POSITION: fPos, NORMAL: fNrm, TEXCOORD_0: fUV }, indices: fIdx, material: 0 },
          { attributes: { POSITION: sPos, NORMAL: sNrm }, indices: sIdx, material: 1 },
        ],
      },
    ],
    materials: [
      {
        name: 'Front',
        pbrMetallicRoughness: { baseColorTexture: { index: 0 }, metallicFactor: 0, roughnessFactor: 0.85 },
      },
      {
        name: 'Edges',
        pbrMetallicRoughness: {
          baseColorFactor: [...sideColor.map(toLinear), 1],
          metallicFactor: 0,
          roughnessFactor: 0.7,
        },
      },
    ],
    textures: [{ sampler: 0, source: 0 }],
    samplers: [{ magFilter: 9729, minFilter: 9987, wrapS: 33071, wrapT: 33071 }],
    images: [{ bufferView: imageView, mimeType }],
    accessors,
    bufferViews,
    buffers: [{ byteLength: 0 }],
  };

  const binPad = (4 - (offset % 4)) % 4;
  if (binPad) chunks.push(new Uint8Array(binPad));
  const binLength = offset + binPad;
  json.buffers[0].byteLength = binLength;

  let jsonBytes = new TextEncoder().encode(JSON.stringify(json));
  const jsonPad = (4 - (jsonBytes.length % 4)) % 4;
  if (jsonPad) {
    const padded = new Uint8Array(jsonBytes.length + jsonPad).fill(0x20);
    padded.set(jsonBytes);
    jsonBytes = padded;
  }

  const total = 12 + 8 + jsonBytes.length + 8 + binLength;
  const out = new Uint8Array(total);
  const dv = new DataView(out.buffer);
  dv.setUint32(0, 0x46546c67, true); // "glTF"
  dv.setUint32(4, 2, true);
  dv.setUint32(8, total, true);
  dv.setUint32(12, jsonBytes.length, true);
  dv.setUint32(16, 0x4e4f534a, true); // "JSON"
  out.set(jsonBytes, 20);
  let p = 20 + jsonBytes.length;
  dv.setUint32(p, binLength, true);
  dv.setUint32(p + 4, 0x004e4942, true); // "BIN\0"
  p += 8;
  for (const c of chunks) {
    out.set(c, p);
    p += c.byteLength;
  }
  return out;
}

function face(c, n, u, v) {
  const corner = (su, sv) => [0, 1, 2].map((k) => c[k] + su * u[k] + sv * v[k]);
  const positions = [...corner(-1, -1), ...corner(1, -1), ...corner(1, 1), ...corner(-1, 1)];
  const normals = [...n, ...n, ...n, ...n];
  return { positions, normals };
}
