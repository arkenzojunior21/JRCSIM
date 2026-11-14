import { describe, expect, it } from 'vitest';
import { MATCH, SCORING } from '../src/sim/constants';
import { World } from '../src/sim/world';
import { LEX_DROP_ZONES, ZONES } from '../src/sim/trackLayout';

const dt = MATCH.fixedDt;
const neutral = { forward: 0, turn: 0, strafe: 0 };
const idle = { command: neutral, grip: false, liftUp: false, liftDown: false };

function run(world: World, seconds: number, input = idle): void {
  const steps = Math.round(seconds / dt);
  for (let i = 0; i < steps; i += 1) {
    world.update(dt, input);
  }
}

describe('World', () => {
  it('objek muncul sesuai aturan: 2 LEX + 4 LATERES', () => {
    const world = new World('free');
    expect(world.objects.filter((o) => o.kind === 'LEX')).toHaveLength(2);
    expect(world.objects.filter((o) => o.kind === 'LATERES')).toHaveLength(4);
  });

  it('transporter mencengkeram objek di depan gripper', () => {
    const world = new World('free');
    world.start();
    world.transporter.reset(1.0, 1.2, 0);
    const lex = world.objects.find((o) => o.kind === 'LEX');
    if (!lex) throw new Error('LEX tidak ada');
    lex.x = 1.24;
    lex.z = 1.2;

    run(world, 0.2, { ...idle, grip: true });
    expect(lex.carrier).toBe('transporter');

    run(world, 0.2, { ...idle, grip: false });
    expect(lex.carrier).toBeNull();
  });

  it('LF menunggu di depan gate CATARACTA 1 yang tertutup', () => {
    const world = new World('free');
    world.objects = [];
    world.start();
    run(world, 30);
    const waitingPose = { ...world.lineFollower.state };
    expect(waitingPose.waiting).toBe(true);
    expect(waitingPose.z).toBeGreaterThan(2.79);
    expect(waitingPose.z).toBeLessThan(2.95);

    const gate = world.gates.find((g) => g.id === 'catarata1');
    if (!gate) throw new Error('gate tidak ada');
    gate.open = true;
    gate.angleDeg = 90;
    run(world, 10);
    const finish = ZONES.finish;
    expect(world.lineFollower.state.x).toBeGreaterThan(finish.x);
    expect(world.lineFollower.state.x).toBeLessThan(finish.x + finish.w);
    expect(world.lineFollower.state.z).toBeGreaterThan(finish.z);
    expect(world.lineFollower.state.z).toBeLessThan(finish.z + finish.d);
  });

  it('skor bertambah saat objek ditaruh di drop zone yang benar', () => {
    const world = new World('free');
    const lex = world.objects.find((o) => o.kind === 'LEX');
    const lateres = world.objects.find((o) => o.kind === 'LATERES');
    if (!lex || !lateres) throw new Error('objek tidak lengkap');
    const zone = LEX_DROP_ZONES[0];
    lex.x = zone.x + zone.w / 2;
    lex.z = zone.z + zone.d / 2;
    lateres.x = ZONES.dropLateres.x + ZONES.dropLateres.w / 2;
    lateres.z = ZONES.dropLateres.z + ZONES.dropLateres.d / 2;
    world.update(dt, idle);
    expect(world.scoreTracker.breakdown.lex).toBe(SCORING.lex);
    expect(world.scoreTracker.breakdown.lateres).toBe(SCORING.lateres);
  });

  it('misi selesai saat 6 objek benar dan kedua robot finish', () => {
    const world = new World('free');
    world.start();
    const lex = world.objects.filter((o) => o.kind === 'LEX');
    const lateres = world.objects.filter((o) => o.kind === 'LATERES');

    for (const object of world.objects) {
      object.x = ZONES.transfer.x + ZONES.transfer.w / 2;
      object.z = ZONES.transfer.z + ZONES.transfer.d / 2;
    }
    world.update(dt, idle);

    lex.forEach((object, index) => {
      const zone = LEX_DROP_ZONES[index % LEX_DROP_ZONES.length];
      object.x = zone.x + zone.w / 2;
      object.z = zone.z + zone.d / 2;
    });
    for (const object of lateres) {
      object.x = ZONES.dropLateres.x + ZONES.dropLateres.w / 2;
      object.z = ZONES.dropLateres.z + ZONES.dropLateres.d / 2;
    }
    world.transporter.state.x = ZONES.finish.x + 0.1;
    world.transporter.state.z = ZONES.finish.z + 0.1;
    world.lineFollower.state.x = ZONES.finish.x + 0.2;
    world.lineFollower.state.z = ZONES.finish.z + 0.2;
    world.update(dt, idle);
    expect(world.mission.phase).toBe('COMPLETE');
    expect(world.scoreTracker.breakdown.total).toBe(SCORING.totalPenyisihan);
  });

  it('reset mengembalikan objek dan skor', () => {
    const world = new World('free');
    const lex = world.objects.find((o) => o.kind === 'LEX');
    if (!lex) throw new Error('LEX tidak ada');
    const zone = LEX_DROP_ZONES[0];
    lex.x = zone.x + 0.02;
    lex.z = zone.z + 0.02;
    world.update(dt, idle);
    expect(world.scoreTracker.breakdown.lex).toBeGreaterThan(0);

    world.reset('free');
    expect(world.scoreTracker.breakdown.total).toBe(0);
    expect(world.objects.every((object) => object.x === object.homeX && object.z === object.homeZ)).toBe(true);
  });
});
