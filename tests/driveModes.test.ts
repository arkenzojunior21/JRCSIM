import { describe, expect, it } from 'vitest';
import { ROBOT } from '../src/sim/constants';
import { computeBodyVelocity, type DriveCommand } from '../src/sim/driveModes';

const neutral: DriveCommand = { forward: 0, turn: 0, strafe: 0 };

describe('computeBodyVelocity', () => {
  it('maju penuh mengikuti arah yaw', () => {
    const result = computeBodyVelocity('tank', { ...neutral, forward: 1 }, 0);
    expect(result.vx).toBeCloseTo(ROBOT.transporter.maxSpeed, 6);
    expect(result.vz).toBeCloseTo(0, 6);
  });

  it('maju dengan yaw 90 derajat bergerak ke sumbu z', () => {
    const result = computeBodyVelocity('arcade', { ...neutral, forward: 1 }, Math.PI / 2);
    expect(result.vx).toBeCloseTo(0, 6);
    expect(result.vz).toBeCloseTo(ROBOT.transporter.maxSpeed, 6);
  });

  it('tank dan arcade mengabaikan strafe', () => {
    for (const mode of ['tank', 'arcade'] as const) {
      const result = computeBodyVelocity(mode, { ...neutral, strafe: 1 }, 0);
      expect(result.vx).toBeCloseTo(0, 6);
      expect(result.vz).toBeCloseTo(0, 6);
    }
  });

  it('mecanum memakai strafe 70 persen kecepatan', () => {
    const result = computeBodyVelocity('mecanum', { ...neutral, strafe: 1 }, 0);
    expect(result.vx).toBeCloseTo(0, 6);
    expect(result.vz).toBeCloseTo(ROBOT.transporter.maxSpeed * 0.7, 6);
  });

  it('perintah dibatasi pada rentang -1..1', () => {
    const result = computeBodyVelocity('tank', { forward: 4, turn: 9, strafe: 0 }, 0);
    expect(result.vx).toBeCloseTo(ROBOT.transporter.maxSpeed, 6);
    expect(result.omega).toBeCloseTo(ROBOT.transporter.turnRate, 6);
  });
});
