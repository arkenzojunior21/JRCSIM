import fs from 'node:fs';
import path from 'node:path';
import occtimportjs from 'occt-import-js';

const OUT_DIR = 'public/assets/models';
const STEP_FILE = '3d file/Transporter/REVISI ROBOT TEAM 1 v15.step';
const LF_DIR = '3d file/LTM/line-follower-jb8620221013-59-12xnjn5/jb86/line-follower-jb86';

const LF_COLORS = {
  base: [0.13, 0.16, 0.2],
  cover: [0.16, 0.45, 0.78],
  cover_add_on: [0.16, 0.45, 0.78],
  sharp: [0.06, 0.06, 0.06],
  wheel: [0.05, 0.05, 0.05],
};

const LF_WHEEL = { x: 50, y: 60, z: 10 };

function readAsciiStl(file) {
  const text = fs.readFileSync(file, 'latin1');
  const positions = [];
  const normals = [];
  let normal = [0, 0, 1];
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed.startsWith('facet normal')) {
      const parts = trimmed.split(/\s+/);
      normal = [Number(parts[2]), Number(parts[3]), Number(parts[4])];
    } else if (trimmed.startsWith('vertex')) {
      const parts = trimmed.split(/\s+/);
      positions.push(Number(parts[1]), Number(parts[2]), Number(parts[3]));
      normals.push(normal[0], normal[1], normal[2]);
    }
  }
  return { positions, normals };
}

function rotateAboutY([x, y, z], radians) {
  const c = Math.cos(radians);
  const s = Math.sin(radians);
  return [x * c + z * s, y, -x * s + z * c];
}

/** Z-up (CAD) -> Y-up (three), lalu diputar agar depan model menghadap +X. */
function toScene([x, y, z], forwardYaw) {
  const p = rotateAboutY([x, z, -y], forwardYaw);
  return p;
}

function createGroup() {
  return { positions: [], normals: [], indices: [], colors: new Map() };
}

function addPart(group, positions, normals, color, options = {}) {
  const { forwardYaw = 0, translate = [0, 0, 0], rotateY = 0 } = options;
  const key = color.map((v) => Math.round(v * 50) / 50).join(',');
  if (!group.colors.has(key)) {
    group.colors.set(key, { color, positions: [], normals: [], count: 0 });
  }
  const bucket = group.colors.get(key);
  for (let i = 0; i < positions.length; i += 3) {
    let p = [positions[i], positions[i + 1], positions[i + 2]];
    if (rotateY) {
      p = rotateAboutY(p, rotateY);
    }
    p = [p[0] + translate[0], p[1] + translate[1], p[2] + translate[2]];
    const scene = toScene(p, forwardYaw);
    bucket.positions.push(scene[0], scene[1], scene[2]);
    const n = toScene([normals[i], normals[i + 1], normals[i + 2]], forwardYaw);
    bucket.normals.push(n[0], n[1], n[2]);
    bucket.count++;
  }
}

function finishGroup(group) {
  const bbox = {
    min: [Infinity, Infinity, Infinity],
    max: [-Infinity, -Infinity, -Infinity],
  };
  for (const bucket of group.colors.values()) {
    const p = bucket.positions;
    for (let i = 0; i < p.length; i += 3) {
      for (let a = 0; a < 3; a++) {
        if (p[i + a] < bbox.min[a]) bbox.min[a] = p[i + a];
        if (p[i + a] > bbox.max[a]) bbox.max[a] = p[i + a];
      }
    }
  }
  if (!Number.isFinite(bbox.min[0])) {
    throw new Error('Model kosong');
  }
  const center = [
    (bbox.min[0] + bbox.max[0]) / 2,
    0,
    (bbox.min[2] + bbox.max[2]) / 2,
  ];
  const scale = 0.001;
  const primitives = [];
  for (const bucket of group.colors.values()) {
    const p = bucket.positions;
    const nrm = bucket.normals;
    const count = bucket.count;
    const positions = new Float32Array(count * 3);
    const normals = new Float32Array(count * 3);
    const indices = new Uint32Array(count);
    for (let i = 0; i < count; i++) {
      for (let a = 0; a < 3; a++) {
        positions[i * 3 + a] = (p[i * 3 + a] - center[a]) * scale;
        normals[i * 3 + a] = nrm[i * 3 + a];
      }
      indices[i] = i;
    }
    primitives.push({
      positions: minimizePrecision(positions),
      normals: minimizePrecision(normals),
      indices,
      color: bucket.color,
    });
  }
  const size = [
    (bbox.max[0] - bbox.min[0]) * scale,
    (bbox.max[1] - bbox.min[1]) * scale,
    (bbox.max[2] - bbox.min[2]) * scale,
  ];
  return { primitives, size };
}

function minimizePrecision(array) {
  const out = new Float32Array(array.length);
  for (let i = 0; i < array.length; i++) {
    out[i] = Math.round(array[i] * 10000) / 10000;
  }
  return out;
}

function buildGlb(name, primitives) {
  const chunks = [];
  const bufferViews = [];
  const accessors = [];
  const materials = [];
  let offset = 0;

  const pushView = (array, target, componentType) => {
    const bytes = Buffer.from(array.buffer, array.byteOffset, array.byteLength);
    const padding = (4 - (offset % 4)) % 4;
    if (padding) {
      chunks.push(Buffer.alloc(padding));
      offset += padding;
    }
    chunks.push(bytes);
    const view = {
      buffer: 0,
      byteOffset: offset,
      byteLength: bytes.length,
      target,
    };
    bufferViews.push(view);
    offset += bytes.length;
    return { view: bufferViews.length - 1, componentType };
  };

  for (const primitive of primitives) {
    const bounds = { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] };
    for (let i = 0; i < primitive.positions.length; i += 3) {
      for (let a = 0; a < 3; a++) {
        const v = primitive.positions[i + a];
        if (v < bounds.min[a]) bounds.min[a] = v;
        if (v > bounds.max[a]) bounds.max[a] = v;
      }
    }

    const positionView = pushView(primitive.positions, 34962);
    accessors.push({
      bufferView: positionView.view,
      componentType: 5126,
      count: primitive.positions.length / 3,
      type: 'VEC3',
      min: bounds.min,
      max: bounds.max,
    });
    const positionAccessor = accessors.length - 1;

    const normalView = pushView(primitive.normals, 34962);
    accessors.push({
      bufferView: normalView.view,
      componentType: 5126,
      count: primitive.normals.length / 3,
      type: 'VEC3',
    });
    const normalAccessor = accessors.length - 1;

    const indexView = pushView(primitive.indices, 34963);
    accessors.push({
      bufferView: indexView.view,
      componentType: 5125,
      count: primitive.indices.length,
      type: 'SCALAR',
    });
    const indexAccessor = accessors.length - 1;

    materials.push({
      name: `color-${materials.length}`,
      pbrMetallicRoughness: {
        baseColorFactor: [...primitive.color, 1],
        metallicFactor: 0.25,
        roughnessFactor: 0.6,
      },
      doubleSided: true,
    });

    primitive.accessors = {
      position: positionAccessor,
      normal: normalAccessor,
      index: indexAccessor,
      material: materials.length - 1,
    };
  }

  const gltf = {
    asset: { version: '2.0', generator: 'JRCSIM build-robots' },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0, name }],
    meshes: [
      {
        name,
        primitives: primitives.map((primitive) => ({
          attributes: {
            POSITION: primitive.accessors.position,
            NORMAL: primitive.accessors.normal,
          },
          indices: primitive.accessors.index,
          material: primitive.accessors.material,
        })),
      },
    ],
    materials,
    accessors,
    bufferViews,
    buffers: [{ byteLength: offset }],
  };

  const json = Buffer.from(JSON.stringify(gltf), 'utf8');
  const jsonPadding = (4 - (json.length % 4)) % 4;
  const jsonChunk = Buffer.concat([json, Buffer.alloc(jsonPadding, 0x20)]);
  const bin = Buffer.concat(chunks);
  const binPadding = (4 - (bin.length % 4)) % 4;
  const binChunk = Buffer.concat([bin, Buffer.alloc(binPadding)]);

  const header = Buffer.alloc(12);
  header.writeUInt32LE(0x46546c67, 0);
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(12 + 8 + jsonChunk.length + 8 + binChunk.length, 8);

  const jsonHeader = Buffer.alloc(8);
  jsonHeader.writeUInt32LE(jsonChunk.length, 0);
  jsonHeader.writeUInt32LE(0x4e4f534a, 4);

  const binHeader = Buffer.alloc(8);
  binHeader.writeUInt32LE(binChunk.length, 0);
  binHeader.writeUInt32LE(0x004e4942, 4);

  return Buffer.concat([header, jsonHeader, jsonChunk, binHeader, binChunk]);
}

function buildLineFollower() {
  if (!fs.existsSync(LF_DIR)) {
    console.warn(`Folder LF tidak ditemukan: ${LF_DIR}`);
    return;
  }
  const group = createGroup();
  // Depan model LF menghadap +Y, diputar -90° agar menghadap +X di scene.
  const forwardYaw = -Math.PI / 2;

  const bodyParts = [
    ['base.stl', LF_COLORS.base],
    ['cover.stl', LF_COLORS.cover],
    ['cover_add_on.stl', LF_COLORS.cover_add_on],
    ['sharp%2B10.stl', LF_COLORS.sharp],
  ];
  for (const [file, color] of bodyParts) {
    const full = path.join(LF_DIR, file);
    if (!fs.existsSync(full)) {
      console.warn(`Bagian LF hilang: ${file}`);
      continue;
    }
    const { positions, normals } = readAsciiStl(full);
    addPart(group, positions, normals, color, { forwardYaw });
  }

  const wheelFile = path.join(LF_DIR, 'wheel.stl');
  if (fs.existsSync(wheelFile)) {
    const { positions, normals } = readAsciiStl(wheelFile);
    for (const side of [-1, 1]) {
      addPart(group, positions, normals, LF_COLORS.wheel, {
        forwardYaw,
        rotateY: Math.PI / 2,
        translate: [side * LF_WHEEL.x, LF_WHEEL.y, LF_WHEEL.z],
      });
    }
  }

  const { primitives, size } = finishGroup(group);
  const glb = buildGlb('line-follower', primitives);
  const out = path.join(OUT_DIR, 'line-follower.glb');
  fs.writeFileSync(out, glb);
  console.log(`line-follower.glb  ${(glb.length / 1024 / 1024).toFixed(2)} MB  ukuran ${size.map((v) => (v * 100).toFixed(1)).join(' x ')} cm`);
}

async function buildTransporter() {
  if (!fs.existsSync(STEP_FILE)) {
    console.warn(`STEP transporter tidak ditemukan: ${STEP_FILE}`);
    return;
  }
  const occt = await occtimportjs();
  const buffer = fs.readFileSync(STEP_FILE);
  const result = occt.ReadStepFile(new Uint8Array(buffer), {
    linearUnit: 'millimeter',
    linearDeflection: 0.5,
    angularDeflection: 0.5,
  });
  if (!result.success) {
    throw new Error('STEP transporter gagal dibaca');
  }

  const group = createGroup();
  // Capit berada di -X pada model, jadi model diputar 180° agar menghadap +X.
  const forwardYaw = Math.PI;
  for (const mesh of result.meshes) {
    const positions = Array.from(mesh.attributes.position.array);
    const normals = mesh.attributes.normal
      ? Array.from(mesh.attributes.normal.array)
      : new Array(positions.length).fill(0);
    const color = mesh.color ?? [0.7, 0.7, 0.7];
    addPart(group, positions, normals, color, { forwardYaw });
  }

  const { primitives, size } = finishGroup(group);
  const glb = buildGlb('transporter', primitives);
  const out = path.join(OUT_DIR, 'transporter.glb');
  fs.writeFileSync(out, glb);
  console.log(`transporter.glb    ${(glb.length / 1024 / 1024).toFixed(2)} MB  ukuran ${size.map((v) => (v * 100).toFixed(1)).join(' x ')} cm`);
}

fs.mkdirSync(OUT_DIR, { recursive: true });
buildLineFollower();
await buildTransporter();
