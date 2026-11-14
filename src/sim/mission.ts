import { MATCH, PENALTIES } from './constants';

export type GameMode = 'free' | 'qualifying';
export type MatchPhase = 'SETUP' | 'ARMED' | 'RUNNING' | 'COMPLETE' | 'TIME_UP';

export interface MissionSnapshot {
  mode: GameMode;
  phase: MatchPhase;
  remaining: number;
  countdown: number;
  penaltySeconds: number;
}

export class Mission {
  mode: GameMode;
  phase: MatchPhase = 'SETUP';
  remaining: number = MATCH.durationSeconds;
  countdown = 0;
  penaltySeconds = 0;

  constructor(mode: GameMode) {
    this.mode = mode;
  }

  get isRunning(): boolean {
    return this.phase === 'RUNNING';
  }

  get isFinished(): boolean {
    return this.phase === 'COMPLETE' || this.phase === 'TIME_UP';
  }

  setMode(mode: GameMode): void {
    this.mode = mode;
    this.reset();
  }

  reset(): void {
    this.phase = 'SETUP';
    this.remaining = MATCH.durationSeconds;
    this.countdown = 0;
    this.penaltySeconds = 0;
  }

  start(): void {
    if (this.phase === 'RUNNING' || this.phase === 'ARMED') {
      return;
    }
    if (this.mode === 'free') {
      this.phase = 'RUNNING';
      return;
    }
    this.phase = 'ARMED';
    this.countdown = MATCH.countdownSeconds;
  }

  retry(): void {
    if (this.mode === 'qualifying') {
      this.applyTimePenalty(PENALTIES.invalidRetrySeconds);
    }
    this.phase = 'ARMED';
    this.countdown = MATCH.countdownSeconds;
  }

  applyTimePenalty(seconds: number): void {
    if (this.mode !== 'qualifying') {
      return;
    }
    this.penaltySeconds += seconds;
    this.remaining = Math.max(0, this.remaining - seconds);
    if (this.remaining <= 0) {
      this.phase = 'TIME_UP';
    }
  }

  update(dt: number, objectiveComplete: boolean): void {
    if (this.phase === 'ARMED') {
      this.countdown -= dt;
      if (this.countdown <= 1e-9) {
        this.countdown = 0;
        this.phase = 'RUNNING';
      }
      return;
    }
    if (this.phase !== 'RUNNING') {
      return;
    }
    if (this.mode === 'qualifying') {
      this.remaining = Math.max(0, this.remaining - dt);
      if (this.remaining <= 0) {
        this.phase = 'TIME_UP';
        return;
      }
    }
    if (objectiveComplete) {
      this.phase = 'COMPLETE';
    }
  }

  snapshot(): MissionSnapshot {
    return {
      mode: this.mode,
      phase: this.phase,
      remaining: this.remaining,
      countdown: this.countdown,
      penaltySeconds: this.penaltySeconds,
    };
  }
}
