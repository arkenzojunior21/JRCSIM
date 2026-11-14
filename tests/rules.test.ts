import { describe, expect, it } from 'vitest';
import { circleOverlapsRect, resolveCircleRect, slideAgainstRects } from '../src/sim/collision';
import { Mission } from '../src/sim/mission';
import { createObject } from '../src/sim/objects';
import { ScoreTracker } from '../src/sim/scoring';
import { LEX_DROP_ZONES, SCORE_ZONES, ZONES } from '../src/sim/trackLayout';
import { MATCH, SCORING } from '../src/sim/constants';

const dt = MATCH.fixedDt;

describe('collision', () => {
  const rect = { x: 1, z: 1, w: 0.5, d: 0.5 };

  it('mendorong lingkaran keluar dari sisi terdekat', () => {
    const result = resolveCircleRect(0.9, 1.25, 0.15, rect);
    expect(result.hit).toBe(true);
    expect(result.x).toBeLessThanOrEqual(1 - 0.15 + 1e-6);
  });

  it('tidak mengubah posisi saat sudah di luar', () => {
    const result = resolveCircleRect(0.5, 0.5, 0.15, rect);
    expect(result.hit).toBe(false);
    expect(result.x).toBe(0.5);
  });

  it('mendorong keluar saat pusat robot di dalam persegi', () => {
    const result = resolveCircleRect(1.25, 1.25, 0.15, rect);
    expect(result.hit).toBe(true);
    expect(result.x <= 1 || result.x >= 1.5 || result.z <= 1 || result.z >= 1.5).toBe(true);
  });

  it('slide mempertahankan posisi bebas rintangan', () => {
    const result = slideAgainstRects(2, 2, 0.2, 0.5, 0, [rect]);
    expect(result).toMatchObject({ x: 2, z: 2, vx: 0.5, hit: false });
  });

  it('circleOverlapsRect mendeteksi tepi', () => {
    expect(circleOverlapsRect(0.9, 1.25, 0.11, rect)).toBe(true);
    expect(circleOverlapsRect(0.7, 1.25, 0.11, rect)).toBe(false);
  });
});

describe('mission', () => {
  it('mode kualifikasi memakai hitung mundur 3 detik', () => {
    const mission = new Mission('qualifying');
    mission.start();
    expect(mission.phase).toBe('ARMED');
    for (let i = 0; i < 180; i += 1) mission.update(dt, false);
    expect(mission.phase).toBe('RUNNING');
  });

  it('waktu habis menjadi TIME_UP', () => {
    const mission = new Mission('qualifying');
    mission.start();
    for (let i = 0; i < 3 / dt; i += 1) mission.update(dt, false);
    mission.remaining = 0.05;
    for (let i = 0; i < 5; i += 1) mission.update(dt, false);
    expect(mission.phase).toBe('TIME_UP');
  });

  it('tujuan selesai mengubah fase menjadi COMPLETE', () => {
    const mission = new Mission('free');
    mission.start();
    mission.update(dt, true);
    expect(mission.phase).toBe('COMPLETE');
  });

  it('mode bebas tidak memotong waktu', () => {
    const mission = new Mission('free');
    mission.start();
    for (let i = 0; i < 600; i += 1) mission.update(dt, false);
    expect(mission.remaining).toBe(MATCH.durationSeconds);
  });

  it('retry mengurangi sisa waktu pada mode kualifikasi', () => {
    const mission = new Mission('qualifying');
    mission.start();
    mission.retry();
    expect(mission.remaining).toBe(MATCH.durationSeconds - 5);
  });
});

describe('scoring', () => {
  function place(objectCount: { lex: number; lateres: number }) {
    const tracker = new ScoreTracker();
    const objects = [];
    for (let i = 0; i < objectCount.lex; i += 1) {
      const zone = LEX_DROP_ZONES[i % LEX_DROP_ZONES.length];
      objects.push(createObject(`LEX-${i + 1}`, 'LEX', zone.x + zone.w / 2, zone.z + zone.d / 2));
    }
    for (let i = 0; i < objectCount.lateres; i += 1) {
      objects.push(
        createObject(
          `LATERES-${i + 1}`,
          'LATERES',
          ZONES.dropLateres.x + ZONES.dropLateres.w / 2,
          ZONES.dropLateres.z + ZONES.dropLateres.d / 2,
        ),
      );
    }
    // Fase transfer: semua objek sempat sah berada di Transfer Zone.
    for (const object of objects) {
      object.x = ZONES.transfer.x + ZONES.transfer.w / 2;
      object.z = ZONES.transfer.z + ZONES.transfer.d / 2;
    }
    tracker.update(objects, SCORE_ZONES, false);
    for (let i = 0; i < objectCount.lex; i += 1) {
      const zone = LEX_DROP_ZONES[i % LEX_DROP_ZONES.length];
      objects[i].x = zone.x + zone.w / 2;
      objects[i].z = zone.z + zone.d / 2;
    }
    for (let i = objectCount.lex; i < objects.length; i += 1) {
      objects[i].x = ZONES.dropLateres.x + ZONES.dropLateres.w / 2;
      objects[i].z = ZONES.dropLateres.z + ZONES.dropLateres.d / 2;
    }
    tracker.update(objects, SCORE_ZONES, true);
    return { tracker, objects };
  }

  it('sesi sempurna menghasilkan 130', () => {
    const { tracker } = place({ lex: 2, lateres: 4 });
    expect(tracker.breakdown.total).toBe(SCORING.totalPenyisihan);
  });

  it('hanya 1 LEX + 2 LATERES menghasilkan 45 + transfer + finish', () => {
    const { tracker } = place({ lex: 1, lateres: 2 });
    expect(tracker.breakdown.lex).toBe(15);
    expect(tracker.breakdown.lateres).toBe(30);
    expect(tracker.breakdown.finish).toBe(10);
  });

  it('skor tidak berkurang saat objek diambil kembali', () => {
    const { tracker, objects } = place({ lex: 2, lateres: 4 });
    const before = tracker.breakdown.total;
    for (const object of objects) {
      object.x = 0.5;
      object.z = 0.5;
    }
    tracker.update(objects, SCORE_ZONES, false);
    expect(tracker.breakdown.total).toBe(before);
  });

  it('LEX dengan irisan 24% tidak sah, 25% sah', () => {
    const tracker = new ScoreTracker();
    const rect = LEX_DROP_ZONES[0];
    const object = createObject('LEX-1', 'LEX', rect.x + rect.w / 2, rect.z + rect.d / 2);
    object.z = rect.z + rect.d + 0.014;
    tracker.update([object], SCORE_ZONES, false);
    expect(tracker.breakdown.lex).toBe(0);

    object.z = rect.z + rect.d + 0.013;
    tracker.update([object], SCORE_ZONES, false);
    expect(tracker.breakdown.lex).toBe(15);
  });

  it('penempatan sah di transfer memberi 5 poin per objek', () => {
    const tracker = new ScoreTracker();
    const object = createObject(
      'LATERES-1',
      'LATERES',
      ZONES.transfer.x + ZONES.transfer.w / 2,
      ZONES.transfer.z + ZONES.transfer.d / 2,
    );
    tracker.update([object], SCORE_ZONES, false);
    expect(tracker.breakdown.transfer).toBe(5);
  });
});
