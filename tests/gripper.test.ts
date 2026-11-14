import { describe, expect, it } from 'vitest';
import { MATCH } from '../src/sim/constants';
import {
  canCapture,
  CARRY_HEIGHT,
  createGripper,
  liftHeight,
  updateGripper,
} from '../src/sim/gripper';

const dt = MATCH.fixedDt;

describe('gripper', () => {
  it('lengan naik penuh dalam waktu yang ditentukan lalu turun kembali', () => {
    const gripper = createGripper();
    for (let i = 0; i < 60; i += 1) {
      updateGripper(gripper, { grip: false, up: true, down: false }, dt);
    }
    expect(gripper.lift).toBe(1);
    for (let i = 0; i < 60; i += 1) {
      updateGripper(gripper, { grip: false, up: false, down: true }, dt);
    }
    expect(gripper.lift).toBe(0);
  });

  it('tinggi angkat naik dari 2 cm ke 11 cm', () => {
    const gripper = createGripper();
    expect(liftHeight(gripper)).toBeCloseTo(CARRY_HEIGHT);
    gripper.lift = 1;
    expect(liftHeight(gripper)).toBeCloseTo(0.11);
  });

  it('hanya bisa mencengkeram saat capit tertutup dan lengan turun', () => {
    const gripper = createGripper();
    expect(canCapture(gripper)).toBe(false);
    gripper.closed = true;
    expect(canCapture(gripper)).toBe(true);
    gripper.lift = 0.5;
    expect(canCapture(gripper)).toBe(false);
  });
});
