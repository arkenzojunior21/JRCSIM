import { OBJECTS } from './constants';
import type { Rect } from './trackLayout';

export type ObjectKind = 'LEX' | 'LATERES';
export type Carrier = 'transporter' | 'lineFollower' | null;

export interface SimObject {
  id: string;
  kind: ObjectKind;
  homeX: number;
  homeZ: number;
  x: number;
  z: number;
  y: number;
  carrier: Carrier;
  /** Posisi gripper robot saat objek mulai dibawa, untuk animasi sederhana. */
  carriedFrom: { x: number; z: number } | null;
}

export function objectExtent(kind: ObjectKind): number {
  return kind === 'LEX' ? OBJECTS.lex.width : OBJECTS.lateres.width;
}

export function objectHeight(kind: ObjectKind): number {
  return kind === 'LEX' ? OBJECTS.lex.height : OBJECTS.lateres.height;
}

export function createObject(
  id: string,
  kind: ObjectKind,
  x: number,
  z: number,
): SimObject {
  return {
    id,
    kind,
    homeX: x,
    homeZ: z,
    x,
    z,
    y: 0,
    carrier: null,
    carriedFrom: null,
  };
}

export function isCarried(object: SimObject): boolean {
  return object.carrier !== null;
}

function overlapLength(aMin: number, aMax: number, bMin: number, bMax: number): number {
  return Math.max(0, Math.min(aMax, bMax) - Math.max(aMin, bMin));
}

/**
 * Luas irisan persegi objek dengan zona dibagi luas objek. Dipakai untuk
 * aturan LEX sah jika minimal 25% luas objek masuk drop zone.
 */
export function overlapRatio(object: SimObject, rect: Rect): number {
  const extent = objectExtent(object.kind);
  const half = extent / 2;
  const width = overlapLength(object.x - half, object.x + half, rect.x, rect.x + rect.w);
  const depth = overlapLength(object.z - half, object.z + half, rect.z, rect.z + rect.d);
  return (width * depth) / (extent * extent);
}

export function centerInside(object: SimObject, rect: Rect): boolean {
  return (
    object.x >= rect.x &&
    object.x <= rect.x + rect.w &&
    object.z >= rect.z &&
    object.z <= rect.z + rect.d
  );
}

export function distanceBetween(ax: number, az: number, bx: number, bz: number): number {
  return Math.hypot(ax - bx, az - bz);
}

export function nearestObject(
  objects: readonly SimObject[],
  x: number,
  z: number,
  predicate: (object: SimObject) => boolean,
  maxDistance = Number.POSITIVE_INFINITY,
): SimObject | null {
  let best: SimObject | null = null;
  let bestDistance = maxDistance;
  for (const object of objects) {
    if (!predicate(object)) continue;
    const distance = distanceBetween(x, z, object.x, object.z);
    if (distance <= bestDistance) {
      best = object;
      bestDistance = distance;
    }
  }
  return best;
}
