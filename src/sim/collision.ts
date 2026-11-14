import type { Rect } from './trackLayout';

export interface MoveResult {
  x: number;
  z: number;
  vx: number;
  vz: number;
  hit: boolean;
}

/**
 * Mendorong lingkaran robot keluar dari persegi (AABB). Cukup untuk dinding,
 * gate, dan polisi tidur karena semua rintangan sejajar sumbu arena.
 */
export function resolveCircleRect(
  x: number,
  z: number,
  radius: number,
  rect: Rect,
): { x: number; z: number; hit: boolean } {
  const minX = rect.x;
  const maxX = rect.x + rect.w;
  const minZ = rect.z;
  const maxZ = rect.z + rect.d;
  const closestX = Math.min(maxX, Math.max(minX, x));
  const closestZ = Math.min(maxZ, Math.max(minZ, z));
  const dx = x - closestX;
  const dz = z - closestZ;
  const distanceSq = dx * dx + dz * dz;

  if (distanceSq >= radius * radius) {
    return { x, z, hit: false };
  }

  if (distanceSq > 1e-9) {
    const distance = Math.sqrt(distanceSq);
    const push = radius - distance;
    return { x: x + (dx / distance) * push, z: z + (dz / distance) * push, hit: true };
  }

  const penetrations = [
    { amount: x - minX + radius, axis: 'x' as const, sign: -1 },
    { amount: maxX - x + radius, axis: 'x' as const, sign: 1 },
    { amount: z - minZ + radius, axis: 'z' as const, sign: -1 },
    { amount: maxZ - z + radius, axis: 'z' as const, sign: 1 },
  ].sort((a, b) => a.amount - b.amount);
  const best = penetrations[0];
  return {
    x: best.axis === 'x' ? x + best.sign * best.amount : x,
    z: best.axis === 'z' ? z + best.sign * best.amount : z,
    hit: true,
  };
}

/**
 * Move-and-slide sederhana: geser robot, lalu dorong keluar dari setiap
 * rintangan. Kecepatan pada sumbu yang menabrak dinolkan agar tidak menempel.
 */
export function slideAgainstRects(
  x: number,
  z: number,
  radius: number,
  vx: number,
  vz: number,
  rects: readonly Rect[],
): MoveResult {
  let currentX = x;
  let currentZ = z;
  let hit = false;

  for (let pass = 0; pass < 2; pass += 1) {
    for (const rect of rects) {
      const result = resolveCircleRect(currentX, currentZ, radius, rect);
      if (result.hit) {
        hit = true;
        currentX = result.x;
        currentZ = result.z;
      }
    }
  }

  const moved = Math.hypot(currentX - x, currentZ - z);
  if (hit && moved > 1e-9) {
    const dot = vx * (currentX - x) + vz * (currentZ - z);
    if (dot < 0) {
      return { x: currentX, z: currentZ, vx: 0, vz: 0, hit };
    }
  }
  return { x: currentX, z: currentZ, vx, vz, hit };
}

export function circleOverlapsRect(x: number, z: number, radius: number, rect: Rect): boolean {
  const closestX = Math.min(rect.x + rect.w, Math.max(rect.x, x));
  const closestZ = Math.min(rect.z + rect.d, Math.max(rect.z, z));
  return Math.hypot(x - closestX, z - closestZ) < radius;
}
