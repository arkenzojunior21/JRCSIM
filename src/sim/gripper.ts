import { ROBOT } from './constants';

export interface GripperState {
  closed: boolean;
  /** 0 = turun, 1 = terangkat penuh. */
  lift: number;
}

export interface GripperInput {
  grip: boolean;
  up: boolean;
  down: boolean;
}

export const GRIP_REACH = 0.1;
export const GRIP_OFFSET = 0.24;
export const LIFT_SECONDS = 0.55;
export const CARRY_HEIGHT = 0.02;

export function createGripper(): GripperState {
  return { closed: false, lift: 0 };
}

export function gripperPoint(x: number, z: number, yaw: number): { x: number; z: number } {
  return {
    x: x + Math.cos(yaw) * GRIP_OFFSET,
    z: z + Math.sin(yaw) * GRIP_OFFSET,
  };
}

export function updateGripper(state: GripperState, input: GripperInput, dt: number): void {
  state.closed = input.grip;
  const step = dt / LIFT_SECONDS;
  if (input.up) {
    state.lift = Math.min(1, state.lift + step);
  } else if (input.down) {
    state.lift = Math.max(0, state.lift - step);
  }
}

export function liftHeight(state: GripperState): number {
  return CARRY_HEIGHT + state.lift * 0.09;
}

/** Gripper hanya bisa mencengkeram saat sudah diturunkan mendekati lantai. */
export function canCapture(state: GripperState): boolean {
  return state.closed && state.lift < 0.35;
}

export function transporterGripPoint(transporter: { x: number; z: number; yaw: number }): {
  x: number;
  z: number;
} {
  return gripperPoint(transporter.x, transporter.z, transporter.yaw);
}

export function gripReach(): number {
  return GRIP_REACH + ROBOT.transporter.footprint * 0.15;
}
