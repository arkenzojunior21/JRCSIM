import { SCORING } from './constants';
import { centerInside, overlapRatio, type SimObject } from './objects';
import type { Rect } from './trackLayout';

export interface ScoreZones {
  transfer: readonly Rect[];
  dropLex: readonly Rect[];
  dropLateres: readonly Rect[];
  finish: Rect;
}

export interface ScoreBreakdown {
  lex: number;
  lateres: number;
  transfer: number;
  finish: number;
  total: number;
}

/**
 * Skor bersifat latch: setelah objek sah ditempatkan, poin tidak berkurang
 * meskipun objek kemudian dipindahkan lagi.
 */
export class ScoreTracker {
  private readonly dropScored = new Set<string>();
  private readonly transferScored = new Set<string>();
  private finishScored = false;

  reset(): void {
    this.dropScored.clear();
    this.transferScored.clear();
    this.finishScored = false;
  }

  update(objects: readonly SimObject[], zones: ScoreZones, bothFinished: boolean): void {
    for (const object of objects) {
      if (object.carrier) {
        continue;
      }
      if (object.kind === 'LEX') {
        if (zones.dropLex.some((zone) => overlapRatio(object, zone) >= SCORING.lexValidOverlap)) {
          this.dropScored.add(object.id);
        }
      } else if (zones.dropLateres.some((zone) => centerInside(object, zone))) {
        this.dropScored.add(object.id);
      }

      if (zones.transfer.some((zone) => centerInside(object, zone))) {
        this.transferScored.add(object.id);
      }
    }
    if (bothFinished) {
      this.finishScored = true;
    }
  }

  get breakdown(): ScoreBreakdown {
    let lex = 0;
    let lateres = 0;
    for (const id of this.dropScored) {
      if (id.startsWith('LEX')) {
        lex += SCORING.lex;
      } else {
        lateres += SCORING.lateres;
      }
    }
    const transfer = this.transferScored.size * SCORING.transferPlacement;
    const finish = this.finishScored ? SCORING.finish : 0;
    return { lex, lateres, transfer, finish, total: lex + lateres + transfer + finish };
  }

  get scoredDropCount(): number {
    return this.dropScored.size;
  }

  get scoredTransferCount(): number {
    return this.transferScored.size;
  }

  get hasFinished(): boolean {
    return this.finishScored;
  }
}
