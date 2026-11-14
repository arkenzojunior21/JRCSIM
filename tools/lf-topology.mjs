import sharp from 'sharp';

const BANNER = 'assets-src/Track Banner LF (2,53m × 2,468m)-20261114T084716Z-1-001/Track Banner LF (2,53m × 2,468m)/Track LF JRC 14 SMA Red.jpg';
const banner = await sharp(BANNER, { limitInputPixels: false }).resize({ width: 2530 }).raw().toBuffer({ resolveWithObject: true });
const W = banner.info.width;
const H = banner.info.height;
const C = banner.info.channels;
const data = banner.data;
const PX_PER_M = 1000;
const X_OFF = 0.01;
const Z_OFF = 1.112;
const toPlan = (x, y) => ({ x: +(x / PX_PER_M + X_OFF).toFixed(3), z: +(y / PX_PER_M + Z_OFF).toFixed(3) });

const isBlack = (i) => data[i] < 70 && data[i + 1] < 70 && data[i + 2] < 70;
const black = new Uint8Array(W * H);
for (let p = 0; p < W * H; p++) if (isBlack(p * C)) black[p] = 1;

// Morphological opening (29x29) removes the solid finish block.
const sat = new Float64Array((W + 1) * (H + 1));
for (let y = 0; y < H; y++) {
  let rowSum = 0;
  for (let x = 0; x < W; x++) {
    rowSum += black[y * W + x];
    sat[(y + 1) * (W + 1) + (x + 1)] = sat[y * (W + 1) + (x + 1)] + rowSum;
  }
}
const rectSum = (x0, y0, x1, y1) => sat[(y1 + 1) * (W + 1) + (x1 + 1)] - sat[y0 * (W + 1) + (x1 + 1)] - sat[(y1 + 1) * (W + 1) + x0] + sat[y0 * (W + 1) + x0];
const K = 14;
const eroded = new Uint8Array(W * H);
for (let y = K; y < H - K; y++) for (let x = K; x < W - K; x++) {
  if (black[y * W + x] && rectSum(x - K, y - K, x + K, y + K) === (2 * K + 1) ** 2) eroded[y * W + x] = 1;
}
const platform = new Uint8Array(W * H);
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  if (!eroded[y * W + x]) continue;
  for (let dy = -K; dy <= K; dy++) for (let dx = -K; dx <= K; dx++) {
    const nx = x + dx; const ny = y + dy;
    if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
    if (black[ny * W + nx]) platform[ny * W + nx] = 1;
  }
}
let platformBox = { x0: W, y0: H, x1: 0, y1: 0 };
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (platform[y * W + x]) {
  platformBox.x0 = Math.min(platformBox.x0, x); platformBox.x1 = Math.max(platformBox.x1, x);
  platformBox.y0 = Math.min(platformBox.y0, y); platformBox.y1 = Math.max(platformBox.y1, y);
}
console.log('finish block plan', toPlan(platformBox.x0, platformBox.y0), toPlan(platformBox.x1, platformBox.y1));

const img = new Uint8Array(W * H);
for (let p = 0; p < W * H; p++) img[p] = black[p] && !platform[p] ? 1 : 0;

// thinning
const nb = (x, y) => {
  const g = (dx, dy) => (x + dx < 0 || y + dy < 0 || x + dx >= W || y + dy >= H) ? 0 : img[(y + dy) * W + (x + dx)];
  return [g(0, -1), g(1, -1), g(1, 0), g(1, 1), g(0, 1), g(-1, 1), g(-1, 0), g(-1, -1)];
};
let changed = true;
while (changed) {
  changed = false;
  for (let phase = 0; phase < 2; phase++) {
    const del = [];
    for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
      if (!img[y * W + x]) continue;
      const n = nb(x, y);
      const sum = n.reduce((a, b) => a + b, 0);
      if (sum < 2 || sum > 6) continue;
      let tr = 0;
      for (let k = 0; k < 8; k++) if (!n[k] && n[(k + 1) % 8]) tr++;
      if (tr !== 1) continue;
      if (phase === 0 && (n[0] * n[2] * n[4] || n[2] * n[4] * n[6])) continue;
      if (phase === 1 && (n[0] * n[2] * n[6] || n[0] * n[4] * n[6])) continue;
      del.push(y * W + x);
    }
    if (del.length) { changed = true; for (const p of del) img[p] = 0; }
  }
}

// prune spurs up to 25 px (tape junctions create tiny spurs)
const dirs = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
const pix = (x, y) => x >= 0 && y >= 0 && x < W && y < H && img[y * W + x];
const deg = (x, y) => {
  let d = 0;
  for (const [dx, dy] of dirs) if (pix(x + dx, y + dy)) d++;
  return d;
};
for (let round = 0; round < 4; round++) {
  const drop = [];
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
    if (!img[y * W + x] || deg(x, y) !== 1) continue;
    const path = [[x, y]];
    let [cx, cy] = [x, y];
    let [px, py] = [-1, -1];
    while (path.length <= 25) {
      let next = null;
      for (const [dx, dy] of dirs) {
        const nx = cx + dx; const ny = cy + dy;
        if ((nx === px && ny === py) || !pix(nx, ny)) continue;
        next = [nx, ny]; break;
      }
      if (!next) break;
      if (deg(next[0], next[1]) > 2) break;
      path.push(next); px = cx; py = cy; [cx, cy] = next;
    }
    if (path.length <= 25) for (const [qx, qy] of path) drop.push(qy * W + qx);
  }
  if (!drop.length) break;
  for (const p of drop) img[p] = 0;
}

// Graph over skeleton pixels, find junctions and endpoints, then walk edges.
const id = new Int32Array(W * H).fill(-1);
const nodes = [];
for (let p = 0; p < W * H; p++) if (img[p]) { id[p] = nodes.length; nodes.push(p); }
const isNode = new Uint8Array(nodes.length);
for (let i = 0; i < nodes.length; i++) {
  const p = nodes[i]; const x = p % W; const y = (p - x) / W;
  const d = deg(x, y);
  if (d !== 2) isNode[i] = 1;
}
const nodeList = [];
for (let i = 0; i < nodes.length; i++) {
  if (!isNode[i]) continue;
  const p = nodes[i]; const x = p % W; const y = (p - x) / W;
  nodeList.push({ i, x, y, deg: deg(x, y), plan: toPlan(x, y) });
}
console.log('nodes', nodeList.length);
for (const n of nodeList) console.log(`  (${n.plan.x},${n.plan.z}) deg=${n.deg}`);

// Walk edges from each node.
const seenEdge = new Set();
const edges = [];
for (const start of nodeList) {
  const sx = start.x; const sy = start.y;
  for (const [dx, dy] of dirs) {
    let cx = sx + dx; let cy = sy + dy;
    if (!pix(cx, cy)) continue;
    const key = [start.i, cy * W + cx].sort().join(',');
    if (seenEdge.has(`d${key}`)) continue;
    const path = [[sx, sy]];
    let px = sx; let py = sy;
    let guard = 0;
    while (guard++ < 20000) {
      path.push([cx, cy]);
      seenEdge.add(`d${[id[py * W + px], id[cy * W + cx]].sort().join(',')}`);
      if (isNode[id[cy * W + cx]]) break;
      let next = null;
      for (const [ex, ey] of dirs) {
        const nx = cx + ex; const ny = cy + ey;
        if ((nx === px && ny === py) || !pix(nx, ny)) continue;
        next = [nx, ny]; break;
      }
      if (!next) break;
      px = cx; py = cy; [cx, cy] = next;
    }
    const len = path.length / PX_PER_M;
    if (len > 0.04) edges.push({ from: start.plan, to: toPlan(cx, cy), len: +len.toFixed(3), pts: path.length });
  }
}
console.log('edges', edges.length);
for (const e of edges) console.log(`  (${e.from.x},${e.from.z}) -> (${e.to.x},${e.to.z}) len=${e.len}`);
