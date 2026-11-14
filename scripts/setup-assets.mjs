import {
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { basename, dirname, join, relative, resolve } from 'node:path';
import { unzipSync } from 'fflate';

const root = resolve(import.meta.dirname, '..');
const sourceDir = join(root, 'Track and Regulation');
const outDir = join(root, 'assets-src');

function findArchives(dir) {
  const result = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isFile() && entry.toLowerCase().endsWith('.zip')) {
      result.push(full);
    }
  }
  return result;
}

function assertSafeEntry(name) {
  const normalized = name.replace(/\\/g, '/');
  if (normalized.startsWith('/') || normalized.split('/').includes('..')) {
    throw new Error(`Entri zip tidak aman: ${name}`);
  }
  return normalized;
}

const archives = findArchives(sourceDir);
if (archives.length === 0) {
  throw new Error(`Tidak ada file .zip di ${sourceDir}`);
}

mkdirSync(outDir, { recursive: true });

const manifest = {
  extractedAt: new Date().toISOString(),
  archives: [],
};

for (const archive of archives) {
  const folder = basename(archive, '.zip');
  const entries = unzipSync(new Uint8Array(readFileSync(archive)));
  let fileCount = 0;
  let totalBytes = 0;

  for (const [rawName, data] of Object.entries(entries)) {
    if (rawName.endsWith('/')) {
      continue;
    }
    const name = assertSafeEntry(rawName);
    const destination = join(outDir, folder, name);
    mkdirSync(dirname(destination), { recursive: true });
    writeFileSync(destination, data);
    fileCount += 1;
    totalBytes += data.byteLength;
  }

  manifest.archives.push({
    file: relative(root, archive),
    folder,
    files: fileCount,
    bytes: totalBytes,
  });
  console.log(`[aset] ${basename(archive)} -> ${fileCount} file (${(totalBytes / 1024 / 1024).toFixed(1)} MB)`);
}

writeFileSync(join(outDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`[aset] Selesai. Sumber ada di ${relative(root, outDir)}`);
