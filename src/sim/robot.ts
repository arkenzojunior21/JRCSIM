import { ARENA, ROBOT } from './constants';
import { computeBodyVelocity, type DriveCommand, type DriveMode } from './driveModes';

export interface RobotState {
  x: number;
  z: number;
  yaw: number;
  vx: number;
  vz: number;
  omega: number;
}

const HALF = ROBOT.transporter.footprint / 2;
const MIN_X = HALF;
const MAX_X = ARENA.lengthX - HALF;
const MIN_Z = HALF;
const MAX_Z = ARENA.widthZ - HALF;

function approach(current: number, target: number, maxDelta: number): number {
  if (current < target) {
    return Math.min(current + maxDelta, target);
  }
  return Math.max(current - maxDelta, target);
}

function normalizeAngle(angle: number): number {
  let value = angle;
  while (value > Math.PI) value -= Math.PI * 2;
  while (value < -Math.PI) value += Math.PI * 2;
  return value;
}

export class Transporter {
  readonly state: RobotState;

  constructor(x: number, z: number, yaw = 0) {
    this.state = { x, z, yaw, vx: 0, vz: 0, omega: 0 };
  }

  reset(x: number, z: number, yaw = 0): void {
    this.state.x = x;
    this.state.z = z;
    this.state.yaw = yaw;
    this.state.vx = 0;
    this.state.vz = 0;
    this.state.omega = 0;
  }

  update(dt: number, command: DriveCommand, mode: DriveMode): void {
    const target = computeBodyVelocity(mode, command, this.state.yaw);
    const maxDelta = ROBOT.transporter.accel * dt;

    this.state.vx = approach(this.state.vx, target.vx, maxDelta);
    this.state.vz = approach(this.state.vz, target.vz, maxDelta);
    this.state.omega = target.omega;

    const nextX = this.state.x + this.state.vx * dt;
    const nextZ = this.state.z + this.state.vz * dt;

    if (nextX < MIN_X && this.state.vx < 0) this.state.vx = 0;
    if (nextX > MAX_X && this.state.vx > 0) this.state.vx = 0;
    if (nextZ < MIN_Z && this.state.vz < 0) this.state.vz = 0;
    if (nextZ > MAX_Z && this.state.vz > 0) this.state.vz = 0;

    this.state.x = Math.min(MAX_X, Math.max(MIN_X, nextX));
    this.state.z = Math.min(MAX_Z, Math.max(MIN_Z, nextZ));
    this.state.yaw = normalizeAngle(this.state.yaw + this.state.omega * dt);
  }
}
