import { GATES } from './constants';
import { gripperPoint, type GripperState } from './gripper';
import type { Rect } from './trackLayout';

export type GateId = 'catarata1' | 'catarata2';

export interface GateState {
  id: GateId;
  /** Sudut buka 0..90 derajat. */
  angleDeg: number;
  open: boolean;
}

export interface GatePlacement extends Rect {
  /** Sisi tempat engsel berada: gate menutup melintang dari sisi ini. */
  hingeSide: 'lowZ' | 'highZ' | 'lowX' | 'highX';
}

export const OPEN_ANGLE = GATES.openAngleDeg;
const PULL_DISTANCE = 0.14;
const OPEN_SPEED = 55;

export function createGates(placements: Record<GateId, GatePlacement>): GateState[] {
  return (Object.keys(placements) as GateId[]).map((id) => ({
    id,
    angleDeg: 0,
    open: false,
  }));
}

/** Titik tuas tempat gripper mencengkeram untuk membuka gate. */
export function leverPoint(placement: GatePlacement): { x: number; z: number } {
  if (placement.hingeSide === 'lowX') {
    return { x: placement.x + 0.08, z: placement.z + placement.d / 2 };
  }
  if (placement.hingeSide === 'highX') {
    return { x: placement.x + placement.w - 0.08, z: placement.z + placement.d / 2 };
  }
  return {
    x: placement.x + placement.w / 2,
    z: placement.z + (placement.hingeSide === 'lowZ' ? placement.d - 0.08 : 0.08),
  };
}

/**
 * Gate terbuka jika tuas dicengkeram di dekat titik tuas. Menahan capit pada
 * tuas membuat progres bertambah; progres tidak kembali saat capit dilepas.
 */
export function updateGates(
  gates: readonly GateState[],
  placements: Record<GateId, GatePlacement>,
  transporter: { x: number; z: number; yaw: number },
  gripper: GripperState,
  dt: number,
): void {
  const point = gripperPoint(transporter.x, transporter.z, transporter.yaw);

  for (const gate of gates) {
    if (gate.open) continue;
    const placement = placements[gate.id];
    const lever = leverPoint(placement);
    const near = Math.hypot(point.x - lever.x, point.z - lever.z) < PULL_DISTANCE;
    if (gripper.closed && near) {
      gate.angleDeg = Math.min(90, gate.angleDeg + OPEN_SPEED * dt);
      if (gate.angleDeg >= OPEN_ANGLE) {
        gate.open = true;
      }
    }
  }
}

export function gateObstacle(
  gate: GateState,
  placement: GatePlacement,
): Rect | null {
  if (gate.open) {
    return null;
  }
  return { x: placement.x, z: placement.z, w: placement.w, d: placement.d };
}

/**
 * LF menunggu di depan gate tertutup. Mengembalikan jarak berhenti bila gate
 * berada pada arah gerak LF, atau null jika jalur bebas.
 */
export function blockedDistance(
  x: number,
  z: number,
  headingX: number,
  headingZ: number,
  gates: readonly GateState[],
  placements: Record<GateId, GatePlacement>,
  lookahead = 0.45,
): number | null {
  let nearest: number | null = null;
  for (const gate of gates) {
    if (gate.open) continue;
    const placement = placements[gate.id];
    const centerX = placement.x + placement.w / 2;
    const centerZ = placement.z + placement.d / 2;
    const dx = centerX - x;
    const dz = centerZ - z;
    const forward = dx * headingX + dz * headingZ;
    if (forward <= 0 || forward > lookahead) continue;
    const lateral = Math.abs(dx * headingZ - dz * headingX);
    if (lateral > placement.d / 2 + 0.1) continue;
    const distance = forward - placement.w / 2 - 0.12;
    nearest = nearest === null ? distance : Math.min(nearest, distance);
  }
  return nearest;
}
