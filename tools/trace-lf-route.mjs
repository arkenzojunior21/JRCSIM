import sharp from 'sharp';
import fs from 'node:fs';

const BANNER = 'assets-src/Track Banner LF (2,53m × 2,468m)-20261114T084716Z-1-001/Track Banner LF (2,53m × 2,468m)/Track LF JRC 14 SMA Red.jpg';
const OUT_JSON = 'tools/lf-route.json';
const OUT_OVERLAY = 'tools/lf-route-overlay.png';

const banner = await sharp(BANNER, { limitInputPixels: false }).resize({ width: 1265 }).raw().toBuffer({ resolveWithObject: true });
const W = banner.info.width;
const H = banner.info.height;
const C = banner.info.channels;
const data = banner.data;

const isBlack = (i) => data[i] < 70 && data[i + 1] < 70 && data[i + 2] < 70;

// --- Marker detection for banner -> plan mapping -------------------------
const isRed = (i) => data[i] > 190 && data[i + 1] < 70 && data[i + 2] < 70;
const isGreen = (i) => data[i] < 90 && data[i + 1] > 170 && data[i + 2] < 90;
const isYellow = (i) => data[i] > 190 && data[i + 1] > 170 && data[i + 2] < 90;

const colorBoxes = (pred, minArea) => {
  const seen = new Uint8Array(W * H);
  const out = [];
  const stack = [];
  for (let p = 0; p < W * H; p++) {
    if (seen[p] || !pred(p * C)) continue;
    const box = { area: 0, x0: W, y0: H, x1: 0, y1: 0 };
    seen[p] = 1;
    stack.push(p);
    while (stack.length) {
      const q = stack.pop();
      const x = q % W;
      const y = (q - x) / W;
      box.area++;
      if (x < box.x0) box.x0 = x;
      if (x > box.x1) box.x1 = x;
      if (y < box.y0) box.y0 = y;
      if (y > box.y1) box.y1 = y;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const n = ny * W + nx;
        if (seen[n] || !pred(n * C)) continue;
        seen[n] = 1;
        stack.push(n);
      }
    }
    if (box.area >= minArea) out.push(box);
  }
  return out;
};

const scaleX = 2.53 / W;
const scaleY = 2.468 / H;
const toBox = (b) => ({
  x0: +(b.x0 * scaleX).toFixed(3),
  x1: +((b.x1 + 1) * scaleX).toFixed(3),
  z0: +(1.0 + b.y0 * scaleY).toFixed(3),
  z1: +(1.0 + (b.y1 + 1) * scaleY).toFixed(3),
});
const markers = {
  red: colorBoxes(isRed, 300).map(toBox),
  green: colorBoxes(isGreen, 120).map(toBox),
  yellow: colorBoxes(isYellow, 3000).map(toBox),
};
console.log('markers', JSON.stringify(markers, null, 1));

// --- Black mask + morphological opening to strip the solid finish block ---
const black = new Uint8Array(W * H);
for (let p = 0; p < W * H; p++) if (isBlack(p * C)) black[p] = 1;
const sat = new Float64Array((W + 1) * (H + 1));
for (let y = 0; y < H; y++) {
  let rowSum = 0;
  for (let x = 0; x < W; x++) {
    rowSum += black[y * W + x];
    sat[(y + 1) * (W + 1) + (x + 1)] = sat[y * (W + 1) + (x + 1)] + rowSum;
  }
}
const rectSum = (x0, y0, x1, y1) =>
  sat[(y1 + 1) * (W + 1) + (x1 + 1)] - sat[y0 * (W + 1) + (x1 + 1)] -
  sat[(y1 + 1) * (W + 1) + x0] + sat[y0 * (W + 1) + x0];

const K = 14; // 29x29 kernel: tape is ~25 px wide, finish block is solid
const eroded = new Uint8Array(W * H);
for (let y = K; y < H - K; y++) {
  for (let x = K; x < W - K; x++) {
    if (!black[y * W + x]) continue;
    if (rectSum(x - K, y - K, x + K, y + K) === (2 * K + 1) ** 2) eroded[y * W + x] = 1;
  }
}
const platform = new Uint8Array(W * H);
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    if (!eroded[y * W + x]) continue;
    for (let dy = -K; dy <= K; dy++) {
      for (let dx = -K; dx <= K; dx++) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        if (black[ny * W + nx]) platform[ny * W + nx] = 1;
      }
    }
  }
}
let platformCount = 0;
for (let p = 0; p < W * H; p++) if (platform[p]) platformCount++;
console.log('platform px removed', platformCount);

const lineMask = new Uint8Array(W * H);
for (let p = 0; p < W * H; p++) lineMask[p] = black[p] && !platform[p] ? 1 : 0;

// --- Zhang-Suen thinning -------------------------------------------------
const img = new Uint8Array(lineMask);
const neighbors = (x, y) => {
  const get = (dx, dy) => {
    const nx = x + dx;
    const ny = y + dy;
    if (nx < 0 || ny < 0 || nx >= W || ny >= H) return 0;
    return img[ny * W + nx];
  };
  return [get(0, -1), get(1, -1), get(1, 0), get(1, 1), get(0, 1), get(-1, 1), get(-1, 0), get(-1, -1)];
};
let changed = true;
let iter = 0;
while (changed && iter < 200) {
  changed = false;
  for (let phase = 0; phase < 2; phase++) {
    const del = [];
    for (let y = 1; y < H - 1; y++) {
      for (let x = 1; x < W - 1; x++) {
        if (!img[y * W + x]) continue;
        const n = neighbors(x, y);
        const sum = n.reduce((a, b) => a + b, 0);
        if (sum < 2 || sum > 6) continue;
        let transitions = 0;
        for (let k = 0; k < 8; k++) if (n[k] === 0 && n[(k + 1) % 8] === 1) transitions++;
        if (transitions !== 1) continue;
        const [p2, p3, p4, p5, p6, p7, p8] = n;
        if (phase === 0 && (p2 * p4 * p6 || p4 * p6 * p8)) continue;
        if (phase === 1 && (p2 * p4 * p8 || p2 * p6 * p8)) continue;
        del.push(y * W + x);
      }
    }
    if (del.length) {
      changed = true;
      for (const p of del) img[p] = 0;
    }
  }
  iter++;
}
let skeletonCount = 0;
for (let p = 0; p < W * H; p++) if (img[p]) skeletonCount++;
console.log('skeleton px', skeletonCount, 'passes', iter);

// --- Prune short spurs (marker stubs) ------------------------------------
const dirs = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
const count = (p) => {
  const x = p % W;
  const y = (p - x) / W;
  let d = 0;
  for (const [dx, dy] of dirs) {
    const nx = x + dx;
    const ny = y + dy;
    if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
    if (img[ny * W + nx]) d++;
  }
  return d;
};
const prune = (maxLen) => {
  let removed = 0;
  for (let y = 1; y < H - 1; y++) {
    for (let x = 1; x < W - 1; x++) {
      const p = y * W + x;
      if (!img[p] || count(p) !== 1) continue;
      const branch = [p];
      let cur = p;
      let prev = -1;
      while (branch.length <= maxLen) {
        let next = -1;
        for (const [dx, dy] of dirs) {
          const nx = cur % W + dx;
          const ny = (cur - (cur % W)) / W + dy;
          if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
          const n = ny * W + nx;
          if (n === prev || !img[n]) continue;
          next = n;
          break;
        }
        if (next < 0) break;
        if (count(next) > 2) break;
        branch.push(next);
        prev = cur;
        cur = next;
      }
      if (branch.length <= maxLen) {
        for (const b of branch) img[b] = 0;
        removed += branch.length;
      }
    }
  }
  return removed;
};
for (let round = 0; round < 3; round++) {
  const removed = prune(45);
  if (!removed) break;
  console.log('pruned px', removed);
}

// --- Graph diameter over remaining skeleton (BFS twice) ------------------
const nodeId = new Int32Array(W * H).fill(-1);
const nodes = [];
for (let p = 0; p < W * H; p++) {
  if (!img[p]) continue;
  nodeId[p] = nodes.length;
  nodes.push(p);
}
const adj = nodes.map((p) => {
  const x = p % W;
  const y = (p - x) / W;
  const list = [];
  for (const [dx, dy] of dirs) {
    const nx = x + dx;
    const ny = y + dy;
    if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
    const n = ny * W + nx;
    if (img[n]) list.push(nodeId[n]);
  }
  return list;
});
const bfs = (src) => {
  const dist = new Int32Array(nodes.length).fill(-1);
  const parent = new Int32Array(nodes.length).fill(-1);
  const queue = [src];
  dist[src] = 0;
  let head = 0;
  while (head < queue.length) {
    const u = queue[head++];
    for (const v of adj[u]) {
      if (dist[v] >= 0) continue;
      dist[v] = dist[u] + 1;
      parent[v] = u;
      queue.push(v);
    }
  }
  let far = src;
  for (let i = 0; i < dist.length; i++) if (dist[i] > dist[far]) far = i;
  return { far, dist, parent };
};
console.log('nodes', nodes.length);
const first = bfs(0);
const a = first.far;
const second = bfs(a);
const b = second.far;
console.log('diameter', second.dist[b], 'px  ends', a, b);
const chain = [];
for (let u = b; u >= 0; u = second.parent[u]) chain.push(u);
chain.reverse();
const path = chain.map((u) => {
  const p = nodes[u];
  const x = p % W;
  const y = (p - x) / W;
  return { x, y };
});

// --- Simplify and map to plan coordinates --------------------------------
const rdp = (pts, eps) => {
  if (pts.length < 3) return pts;
  const a0 = pts[0];
  const b0 = pts[pts.length - 1];
  let maxD = -1;
  let idx = 0;
  for (let i = 1; i < pts.length - 1; i++) {
    const p = pts[i];
    const dx = b0.x - a0.x;
    const dy = b0.y - a0.y;
    const len = Math.hypot(dx, dy) || 1;
    const d = Math.abs(dy * p.x - dx * p.y + b0.x * a0.y - b0.y * a0.x) / len;
    if (d > maxD) {
      maxD = d;
      idx = i;
    }
  }
  if (maxD <= eps) return [a0, b0];
  return [...rdp(pts.slice(0, idx + 1), eps).slice(0, -1), ...rdp(pts.slice(idx), eps)];
};
const simplified = rdp(path, 4);
const route = simplified.map((p) => ({
  x: +(p.x * scaleX).toFixed(3),
  z: +(1.0 + p.y * scaleY).toFixed(3),
}));
console.log('route points', route.length);
console.log(JSON.stringify(route));
fs.writeFileSync(OUT_JSON, JSON.stringify({ route, markers }, null, 2));

// --- Overlay -------------------------------------------------------------
const overlay = Buffer.from(data);
const paint = (x, y, r, g, b, rad = 2) => {
  for (let dy = -rad; dy <= rad; dy++) {
    for (let dx = -rad; dx <= rad; dx++) {
      if (dx * dx + dy * dy > rad * rad) continue;
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const i = (ny * W + nx) * C;
      overlay[i] = r;
      overlay[i + 1] = g;
      overlay[i + 2] = b;
    }
  }
};
for (let p = 0; p < W * H; p++) {
  if (img[p]) {
    const x = p % W;
    const y = (p - x) / W;
    const i = p * C;
    overlay[i] = 255;
    overlay[i + 1] = 0;
    overlay[i + 2] = 255;
  }
}
for (const p of simplified) paint(p.x, p.y, 0, 110, 255, 6);
await sharp(overlay, { raw: { width: W, height: H, channels: C } }).png().toFile(OUT_OVERLAY);
console.log('wrote', OUT_JSON, OUT_OVERLAY);
