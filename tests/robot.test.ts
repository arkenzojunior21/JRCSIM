import { describe, expect, it } from 'vitest';
import { ARENA, MATCH, ROBOT } from '../src/sim/constants';
import { Transporter } from '../src/sim/robot';
import { START_POSES } from '../src/sim/trackLayout';

const dt = MATCH.fixedDt;

function run(robot: Transporter, seconds: number, command = { forward: 1, turn: 0, strafe: 0 }) {
  const steps = Math.round(seconds / dt);
  for (let i = 0; i < steps; i += 1) {
    robot.update(dt, command, 'tank');
  }
}

describe('Transporter', () => {
  it('maju selama 1 detik mendekati jarak tempuh maksimum', () => {
    const robot = new Transporter(3, 2, 0);
    run(robot, 1);
    const moved = robot.state.x - 3;
    expect(moved).toBeGreaterThan(0.4);
    expect(moved).toBeLessThanOrEqual(ROBOT.transporter.maxSpeed);
  });

  it('berhenti di dinding timur tanpa melewati batas', () => {
    const robot = new Transporter(ARENA.lengthX - 0.3, 2, 0);
    run(robot, 5);
    expect(robot.state.x).toBeLessThanOrEqual(ARENA.lengthX - ROBOT.transporter.footprint / 2 + 1e-9);
    expect(robot.state.vx).toBe(0);
  });

  it('reset mengembalikan posisi start dan kecepatan nol', () => {
    const robot = new Transporter(3, 2, 0);
    run(robot, 1, { forward: 1, turn: 1, strafe: 0 });
    const spawn = START_POSES.transporter;
    robot.reset(spawn.x, spawn.z, spawn.yaw);
    expect(robot.state).toEqual({ x: spawn.x, z: spawn.z, yaw: spawn.yaw, vx: 0, vz: 0, omega: 0 });
  });

  it('strafe hanya bergerak pada mode mecanum', () => {
    const tank = new Transporter(3, 2, 0);
    run(tank, 1, { forward: 0, turn: 0, strafe: 1 });
    expect(tank.state.z).toBeCloseTo(2, 6);

    const mecanum = new Transporter(3, 2, 0);
    for (let i = 0; i < 60; i += 1) {
      mecanum.update(dt, { forward: 0, turn: 0, strafe: 1 }, 'mecanum');
    }
    expect(mecanum.state.z).toBeGreaterThan(2.2);
  });
});
