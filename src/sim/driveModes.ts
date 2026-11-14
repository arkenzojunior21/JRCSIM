import { ROBOT } from './constants';

export type DriveMode = 'tank' | 'arcade' | 'mecanum';

export interface DriveCommand {
  forward: number;
  turn: number;
  strafe: number;
}

export interface BodyVelocity {
  vx: number;
  vz: number;
  omega: number;
}

export const NEUTRAL_COMMAND: DriveCommand = { forward: 0, turn: 0, strafe: 0 };

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function computeBodyVelocity(
  mode: DriveMode,
  command: DriveCommand,
  yaw: number,
): BodyVelocity {
  const forward = clamp(command.forward, -1, 1);
  const turn = clamp(command.turn, -1, 1);
  const strafe = mode === 'mecanum' ? clamp(command.strafe, -1, 1) : 0;

  const speed = forward * ROBOT.transporter.maxSpeed;
  const lateral = strafe * ROBOT.transporter.maxSpeed * 0.7;

  const forwardX = Math.cos(yaw);
  const forwardZ = Math.sin(yaw);
  const rightX = -Math.sin(yaw);
  const rightZ = Math.cos(yaw);

  return {
    vx: forwardX * speed + rightX * lateral,
    vz: forwardZ * speed + rightZ * lateral,
    omega: turn * ROBOT.transporter.turnRate,
  };
}
