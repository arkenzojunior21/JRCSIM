import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { basename, join, resolve } from 'node:path';
import sharp from 'sharp';

const root = resolve(import.meta.dirname, '..');
const sourceDir = join(root, 'assets-src');
const trackDir = join(root, 'public/assets/track');
const modelDir = join(root, 'public/assets/models');

if (!existsSync(sourceDir)) {
  throw new Error('assets-src belum ada. Jalankan: npm run assets:extract');
}

mkdirSync(trackDir, { recursive: true });
mkdirSync(modelDir, { recursive: true });

function walk(dir) {
  const files = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const info = statSync(full);
    if (info.isDirectory()) {
      files.push(...walk(full));
    } else {
      files.push(full);
    }
  }
  return files;
}

const sourceFiles = walk(sourceDir);

async function convertImage(source, destination, maxSize) {
  const metadata = await sharp(source, { limitInputPixels: false, failOn: 'none' }).metadata();
  const width = metadata.width ?? 0;
  const height = metadata.height ?? 0;

  let pipeline = sharp(source, { limitInputPixels: false, failOn: 'none' });
  if (width > maxSize || height > maxSize) {
    pipeline = pipeline.resize({
      width: maxSize,
      height: maxSize,
      fit: 'inside',
      withoutEnlargement: true,
    });
  }

  await pipeline.webp({ quality: 82, effort: 5 }).toFile(destination);
  const output = await sharp(destination).metadata();
  const bytes = statSync(destination).size;
  console.log(
    `[gambar] ${basename(source)} ${width}x${height} -> ${basename(destination)} ${output.width}x${output.height} (${(bytes / 1024 / 1024).toFixed(2)} MB)`,
  );
}

function percentile(sorted, ratio) {
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.floor(ratio * (sorted.length - 1))),
  );
  return sorted[index];
}

function parseBinarySTL(buffer) {
  if (buffer.byteLength < 84) {
    return null;
  }
  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  const triangleCount = view.getUint32(80, true);
  const expected = 84 + triangleCount * 50;
  if (buffer.byteLength < expected) {
    return null;
  }

  const triangles = [];
  for (let i = 0; i < triangleCount; i += 1) {
    const base = 84 + i * 50 + 12;
    const vertices = [];
    for (let v = 0; v < 3; v += 1) {
      const offset = base + v * 12;
      vertices.push([
        view.getFloat32(offset, true),
        view.getFloat32(offset + 4, true),
        view.getFloat32(offset + 8, true),
      ]);
    }
    triangles.push(vertices);
  }
  return triangles;
}

function sanitizeTriangles(triangles) {
  const xs = [];
  const ys = [];
  const zs = [];

  for (const triangle of triangles) {
    for (const vertex of triangle) {
      xs.push(vertex[0]);
      ys.push(vertex[1]);
      zs.push(vertex[2]);
    }
  }

  xs.sort((a, b) => a - b);
  ys.sort((a, b) => a - b);
  zs.sort((a, b) => a - b);

  const low = [percentile(xs, 0.005), percentile(ys, 0.005), percentile(zs, 0.005)];
  const high = [percentile(xs, 0.995), percentile(ys, 0.995), percentile(zs, 0.995)];
  const pad = high.map((value, index) => Math.max((value - low[index]) * 3, 1));

  return triangles.filter((triangle) =>
    triangle.every((vertex) =>
      vertex.every(
        (value, index) => value >= low[index] - pad[index] && value <= high[index] + pad[index],
      ),
    ),
  );
}

function boundsOf(triangles) {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (const triangle of triangles) {
    for (const vertex of triangle) {
      for (let i = 0; i < 3; i += 1) {
        min[i] = Math.min(min[i], vertex[i]);
        max[i] = Math.max(max[i], vertex[i]);
      }
    }
  }
  return { min, max };
}

function recenter(triangles) {
  const { min, max } = boundsOf(triangles);
  const offset = [(min[0] + max[0]) / 2, min[1], (min[2] + max[2]) / 2];
  return {
    triangles: triangles.map((triangle) =>
      triangle.map((vertex) => [
        vertex[0] - offset[0],
        vertex[1] - offset[1],
        vertex[2] - offset[2],
      ]),
    ),
    size: [max[0] - min[0], max[1] - min[1], max[2] - min[2]],
  };
}

function writeBinarySTL(triangles) {
  const buffer = Buffer.alloc(84 + triangles.length * 50);
  buffer.write('JRCSIM sanitized STL', 0, 'ascii');
  buffer.writeUInt32LE(triangles.length, 80);

  let offset = 84;
  for (const triangle of triangles) {
    const [a, b, c] = triangle;
    const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const ac = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    const normal = [
      ab[1] * ac[2] - ab[2] * ac[1],
      ab[2] * ac[0] - ab[0] * ac[2],
      ab[0] * ac[1] - ab[1] * ac[0],
    ];
    const length = Math.hypot(normal[0], normal[1], normal[2]) || 1;

    for (const value of normal) {
      buffer.writeFloatLE(value / length, offset);
      offset += 4;
    }
    for (const vertex of triangle) {
      for (const value of vertex) {
        buffer.writeFloatLE(value, offset);
        offset += 4;
      }
    }
    buffer.writeUInt16LE(0, offset);
    offset += 2;
  }

  return buffer;
}

const floorSource = sourceFiles.find((file) => file.toLowerCase().endsWith('full track.jpg'));
if (!floorSource) {
  throw new Error('Full Track.jpg tidak ditemukan di assets-src.');
}

const floorOutput = join(trackDir, 'floor.webp');
try {
  await convertImage(floorSource, floorOutput, 8192);
} catch (error) {
  console.warn('[gambar] Gagal pada 8192 px, mencoba 4096 px.');
  console.warn(error);
  await convertImage(floorSource, floorOutput, 4096);
}

const bannerSource = sourceFiles.find(
  (file) =>
    file.toLowerCase().endsWith('.jpg') &&
    file.toLowerCase().includes('track lf jrc 14 sma blue'),
);
if (bannerSource) {
  await convertImage(bannerSource, join(trackDir, 'banner-lf.webp'), 8192);
}

const modelSources = new Map([
  ['lex.stl', 'lex.stl'],
  ['lateres.stl', 'lateres.stl'],
  ['aqvae.stl', 'aqvae.stl'],
]);
const modelManifest = [];

for (const file of sourceFiles) {
  const name = basename(file).toLowerCase();
  const outputName = modelSources.get(name);
  if (!outputName) {
    continue;
  }

  const buffer = readFileSync(file);
  const parsed = parseBinarySTL(buffer);
  if (!parsed) {
    console.warn(`[model] ${basename(file)} bukan STL biner yang valid, dilewati.`);
    continue;
  }

  const filtered = sanitizeTriangles(parsed);
  if (filtered.length === 0) {
    console.warn(`[model] ${basename(file)} tidak menyisakan segitiga setelah sanitasi.`);
    continue;
  }

  const recentered = recenter(filtered);
  writeFileSync(join(modelDir, outputName), writeBinarySTL(recentered.triangles));
  modelManifest.push({
    file: outputName,
    source: basename(file),
    triangles: recentered.triangles.length,
    droppedTriangles: parsed.length - recentered.triangles.length,
    sizeMm: {
      width: Number(recentered.size[0].toFixed(3)),
      height: Number(recentered.size[1].toFixed(3)),
      depth: Number(recentered.size[2].toFixed(3)),
    },
    unit: 'mm',
  });
  console.log(
    `[model] ${basename(file)} -> ${outputName} (${recentered.triangles.length} segitiga, ${recentered.size[0].toFixed(1)} x ${recentered.size[1].toFixed(1)} x ${recentered.size[2].toFixed(1)} mm)`,
  );
}

writeFileSync(
  join(modelDir, 'models.json'),
  `${JSON.stringify({ generatedAt: new Date().toISOString(), models: modelManifest }, null, 2)}\n`,
);

console.log('[aset] Selesai membangun tekstur dan model.');
