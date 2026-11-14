import { describe, expect, it } from 'vitest';
import { GATES, MATCH } from '../src/sim/constants';
import {
  createGates,
  gateObstacle,
  leverPoint,
  updateGates,
  type GateId,
  type GatePlacement,
} from '../src/sim/gates';
import { createGripper } from '../src/sim/gripper';
import { GATE_PLACES } from '../src/sim/trackLayout';

const placements = GATE_PLACES as Record<GateId, GatePlacement>;
const dt = MATCH.fixedDt;
const lever = leverPoint(placements.catarata1);
const approachPose = { x: lever.x - 0.24, z: lever.z, yaw: 0 };

describe('gates', () => {
  it('gate tertutup menjadi penghalang bagi Transporter', () => {
    const [gate] = createGates(placements);
    const obstacle = gateObstacle(gate, placements.catarata1);
    expect(obstacle).not.toBeNull();
    expect(obstacle?.w).toBeCloseTo(placements.catarata1.w);
    expect(obstacle?.d).toBeCloseTo(GATES.catarata1.thickness);
  });

  it('menahan capit di tuas membuka gate hingga minimal 70 derajat', () => {
    const [gate] = createGates(placements);
    const gripper = createGripper();
    gripper.closed = true;
    for (let i = 0; i < 120; i += 1) {
      updateGates([gate], placements, approachPose, gripper, dt);
    }
    expect(gate.open).toBe(true);
    expect(gate.angleDeg).toBeGreaterThanOrEqual(GATES.openAngleDeg);
  });

  it('capit terbuka atau jauh dari tuas tidak membuka gate', () => {
    const [gate] = createGates(placements);
    const gripper = createGripper();
    const farPose = { x: 0.5, z: 0.5, yaw: 0 };

    for (let i = 0; i < 120; i += 1) {
      updateGates([gate], placements, approachPose, gripper, dt);
      updateGates([gate], placements, farPose, { closed: true, lift: 0 }, dt);
    }
    expect(gate.angleDeg).toBe(0);
    expect(gate.open).toBe(false);
  });

  it('gate terbuka tidak lagi menjadi penghalang', () => {
    const [gate] = createGates(placements);
    gate.open = true;
    gate.angleDeg = 90;
    expect(gateObstacle(gate, placements.catarata1)).toBeNull();
  });

  it('titik tuas mengikuti sisi engsel', () => {
    const first = leverPoint(placements.catarata1);
    expect(first.x).toBeCloseTo(placements.catarata1.x + 0.08);
    expect(first.z).toBeCloseTo(placements.catarata1.z + placements.catarata1.d / 2);
    const second = leverPoint(placements.catarata2);
    expect(second.x).toBeCloseTo(placements.catarata2.x + 0.08);
    expect(second.z).toBeCloseTo(placements.catarata2.z + placements.catarata2.d / 2);
  });
});
