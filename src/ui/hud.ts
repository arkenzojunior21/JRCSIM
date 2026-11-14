import type { InputManager } from '../input/inputManager';
import { SCORING } from '../sim/constants';
import type { DriveMode } from '../sim/driveModes';
import type { GameMode } from '../sim/mission';
import { centerInside, overlapRatio, type SimObject } from '../sim/objects';
import { LEX_DROP_ZONES, TRANSFER_ZONES, ZONES } from '../sim/trackLayout';
import type { World } from '../sim/world';
import { saveBestScore } from '../state/storage';

export interface HudHandlers {
  onStart(): void;
  onReset(): void;
  onRetry(): void;
  onGameMode(mode: GameMode): void;
  onDriveMode(mode: DriveMode): void;
  onLfSpeed(speed: number): void;
  onLfToggle(): void;
  onCameraReset(): void;
  onCameraLock(): void;
  onSettings(): void;
}

const PHASE_LABELS: Record<string, string> = {
  SETUP: 'SIAP',
  ARMED: 'HITUNG MUNDUR',
  RUNNING: 'BERJALAN',
  COMPLETE: 'SELESAI',
  TIME_UP: 'WAKTU HABIS',
};

const DRIVE_LABELS: Record<DriveMode, string> = {
  tank: 'Tank',
  arcade: 'Arcade',
  mecanum: 'Mecanum',
};

const GATE_NAMES: Record<string, string> = {
  catarata1: 'Cataracta 1',
  catarata2: 'Cataracta 2',
};

function formatTime(seconds: number): string {
  const whole = Math.max(0, Math.ceil(seconds));
  const minutes = Math.floor(whole / 60);
  const rest = whole % 60;
  return `${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`;
}

function objectState(object: SimObject): { text: string; state: string } {
  if (object.carrier === 'transporter') return { text: 'dibawa Transporter', state: 'carried' };
  if (object.carrier === 'lineFollower') return { text: 'dibawa LF', state: 'carried' };
  if (object.kind === 'LEX') {
    if (LEX_DROP_ZONES.some((zone) => overlapRatio(object, zone) >= SCORING.lexValidOverlap)) {
      return { text: 'di Drop LEX', state: 'scored' };
    }
  } else if (centerInside(object, ZONES.dropLateres)) {
    return { text: 'di Drop LATERES', state: 'scored' };
  }
  if (TRANSFER_ZONES.some((zone) => centerInside(object, zone))) {
    return { text: 'di Transfer', state: 'transfer' };
  }
  return { text: 'di area awal', state: 'home' };
}

export class Hud {
  private readonly phaseEl: HTMLElement;
  private readonly timerEl: HTMLElement;
  private readonly scoreEl: HTMLElement;
  private readonly scoreDetailEl: HTMLElement;
  private readonly objectListEl: HTMLElement;
  private readonly gateListEl: HTMLElement;
  private readonly statusEl: HTMLElement;
  private readonly driveStatusEl: HTMLElement;
  private readonly startButton: HTMLButtonElement;
  private readonly retryButton: HTMLButtonElement;
  private readonly cameraLockButton: HTMLButtonElement;
  private readonly lfSpeedEl: HTMLInputElement;
  private readonly lfSpeedValueEl: HTMLElement;
  private readonly lfToggleEl: HTMLButtonElement;
  private readonly gameModeButtons: HTMLButtonElement[];
  private readonly driveModeButtons: HTMLButtonElement[];
  private readonly resultsEl: HTMLElement;
  private readonly resultsTitleEl: HTMLElement;
  private readonly resultsReasonEl: HTMLElement;
  private readonly resultsScoreEl: HTMLElement;
  private readonly resultsBestEl: HTMLElement;
  private lastObjectSignature = '';
  private lastGateSignature = '';
  private resultsShownFor = '';

  constructor(private readonly handlers: HudHandlers) {
    this.phaseEl = this.require('phase');
    this.timerEl = this.require('timer');
    this.scoreEl = this.require('score');
    this.scoreDetailEl = this.require('score-detail');
    this.objectListEl = this.require('object-status');
    this.gateListEl = this.require('gate-status');
    this.statusEl = this.require('status');
    this.driveStatusEl = this.require('drive-status');
    this.startButton = this.require<HTMLButtonElement>('session-start');
    this.retryButton = this.require<HTMLButtonElement>('session-retry');
    this.cameraLockButton = this.require<HTMLButtonElement>('camera-lock');
    this.lfSpeedEl = this.require<HTMLInputElement>('lf-speed');
    this.lfSpeedValueEl = this.require('lf-speed-value');
    this.lfToggleEl = this.require<HTMLButtonElement>('lf-toggle');
    this.resultsEl = this.require('results');
    this.resultsTitleEl = this.require('results-title');
    this.resultsReasonEl = this.require('results-reason');
    this.resultsScoreEl = this.require('results-score');
    this.resultsBestEl = this.require('results-best');

    this.gameModeButtons = Array.from(
      this.require('game-modes').querySelectorAll<HTMLButtonElement>('button[data-gamemode]'),
    );
    this.driveModeButtons = Array.from(
      this.require('drive-modes').querySelectorAll<HTMLButtonElement>('button[data-mode]'),
    );

    this.startButton.addEventListener('click', handlers.onStart);
    this.retryButton.addEventListener('click', handlers.onRetry);
    this.require('session-reset').addEventListener('click', handlers.onReset);
    this.require('camera-reset').addEventListener('click', handlers.onCameraReset);
    this.cameraLockButton.addEventListener('click', handlers.onCameraLock);
    this.require('open-settings').addEventListener('click', handlers.onSettings);
    this.lfToggleEl.addEventListener('click', handlers.onLfToggle);
    this.lfSpeedEl.addEventListener('input', () => {
      handlers.onLfSpeed(Number(this.lfSpeedEl.value));
    });
    this.require('results-retry').addEventListener('click', () => {
      this.hideResults();
      handlers.onRetry();
    });
    this.require('results-close').addEventListener('click', () => this.hideResults());
    for (const button of this.gameModeButtons) {
      button.addEventListener('click', () => {
        const mode = button.dataset.gamemode as GameMode | undefined;
        if (mode) handlers.onGameMode(mode);
      });
    }
    for (const button of this.driveModeButtons) {
      button.addEventListener('click', () => {
        const mode = button.dataset.mode as DriveMode | undefined;
        if (mode) handlers.onDriveMode(mode);
      });
    }

    this.setLfSpeed(0.32);
    this.updateGameMode('free');
  }

  setStatus(text: string): void {
    this.statusEl.textContent = text;
  }

  setCameraLocked(locked: boolean): void {
    this.cameraLockButton.classList.toggle('active', locked);
    this.cameraLockButton.textContent = locked ? 'Buka kamera' : 'Kunci kamera';
  }

  setLfSpeed(speed: number): void {
    this.lfSpeedEl.value = speed.toFixed(2);
    this.lfSpeedValueEl.textContent = `${speed.toFixed(2).replace('.', ',')} m/s`;
    this.handlers.onLfSpeed(speed);
  }

  updateGameMode(mode: GameMode): void {
    for (const button of this.gameModeButtons) {
      button.classList.toggle('active', button.dataset.gamemode === mode);
    }
  }

  updateDriveMode(mode: DriveMode): void {
    for (const button of this.driveModeButtons) {
      button.classList.toggle('active', button.dataset.mode === mode);
    }
  }

  update(world: World, input: InputManager, paused: boolean): void {
    const mission = world.mission;
    const score = world.scoreTracker.breakdown;
    const running = mission.phase === 'RUNNING';

    this.phaseEl.textContent = paused && running ? 'JEDA' : PHASE_LABELS[mission.phase] ?? mission.phase;
    this.timerEl.textContent =
      mission.mode === 'free' ? '∞' : formatTime(mission.remaining);
    this.scoreEl.textContent = String(score.total);
    this.scoreDetailEl.textContent =
      `LEX ${score.lex} · LATERES ${score.lateres} · Transfer ${score.transfer} · Finish ${score.finish}` +
      (world.penaltyPoints > 0 ? ` · Penalti +${world.penaltyPoints}` : '');

    this.startButton.disabled = mission.phase !== 'SETUP';
    this.retryButton.disabled = mission.phase === 'SETUP';
    this.lfToggleEl.textContent = world.lineFollower.state.running ? 'Jeda LF' : 'Mulai LF';
    this.lfToggleEl.classList.toggle('active', world.lineFollower.state.running);

    const { vx, vz } = world.transporter.state;
    const speed = Math.hypot(vx, vz);
    this.driveStatusEl.textContent = `${DRIVE_LABELS[world.mode]} · ${speed.toFixed(2)} m/s · ${input.padInfo.connected ? 'gamepad' : 'keyboard'}`;

    this.renderObjects(world);
    this.renderGates(world);
    if (mission.isFinished) {
      this.renderResults(world);
    } else if (this.resultsShownFor) {
      this.resultsShownFor = '';
      this.hideResults();
    }
  }

  hideResults(): void {
    this.resultsEl.classList.add('hidden');
  }

  private renderObjects(world: World): void {
    const signature = world.objects
      .map((object) => `${object.id}:${objectState(object).state}`)
      .join('|');
    if (signature !== this.lastObjectSignature) {
      this.lastObjectSignature = signature;
      this.objectListEl.replaceChildren(
        ...world.objects.map((object) => {
          const state = objectState(object);
          const item = document.createElement('li');
          item.className = `status-item ${state.state}`;
          const name = document.createElement('span');
          name.textContent = object.id;
          const value = document.createElement('span');
          value.textContent = state.text;
          item.append(name, value);
          return item;
        }),
      );
    }
  }

  private renderGates(world: World): void {
    const signature = world.gates
      .map((gate) => `${gate.id}:${gate.open ? 1 : 0}:${Math.round(gate.angleDeg / 5)}`)
      .join('|');
    if (signature === this.lastGateSignature) {
      return;
    }
    this.lastGateSignature = signature;
    this.gateListEl.replaceChildren(
      ...world.gates.map((gate) => {
        const item = document.createElement('li');
        item.className = `status-item ${gate.open ? 'scored' : 'home'}`;
        const name = document.createElement('span');
        name.textContent = GATE_NAMES[gate.id] ?? gate.id;
        const value = document.createElement('span');
        value.textContent = gate.open
          ? `terbuka ${Math.round(gate.angleDeg)}°`
          : `tertutup ${Math.round(gate.angleDeg)}°`;
        item.append(name, value);
        return item;
      }),
    );
  }

  private renderResults(world: World): void {
    const mission = world.mission;
    if (!mission.isFinished || this.resultsShownFor === mission.phase) {
      return;
    }
    this.resultsShownFor = mission.phase;
    const score = world.scoreTracker.breakdown;
    const best = saveBestScore(mission.mode === 'free' ? 'free' : 'qualifying', score.total);

    this.resultsTitleEl.textContent =
      mission.phase === 'COMPLETE' ? 'Misi selesai' : 'Waktu habis';
    this.resultsReasonEl.textContent =
      mission.phase === 'COMPLETE'
        ? 'Semua objek berada di drop zone yang benar dan kedua robot finish.'
        : 'Timer habis sebelum seluruh syarat misi terpenuhi.';

    const rows: Array<[string, string]> = [
      ['LEX', `${score.lex} / ${SCORING.lex * 2}`],
      ['LATERES', `${score.lateres} / ${SCORING.lateres * 4}`],
      ['Transfer Zone', `${score.transfer} / ${SCORING.transferPlacement * 6}`],
      ['Finish', `${score.finish} / ${SCORING.finish}`],
      ['Skor total', String(score.total)],
      ['Sisa waktu', mission.mode === 'free' ? '∞' : formatTime(mission.remaining)],
      ['Penalti', `${world.penaltyPoints} poin · ${mission.penaltySeconds} dtk`],
    ];
    this.resultsScoreEl.replaceChildren(
      ...rows.flatMap(([label, value]) => {
        const dt = document.createElement('dt');
        dt.textContent = label;
        const dd = document.createElement('dd');
        dd.textContent = value;
        return [dt, dd];
      }),
    );
    const bestScore = mission.mode === 'free' ? best.free : best.qualifying;
    this.resultsBestEl.textContent = `Skor terbaik ${mission.mode === 'free' ? 'Free Test' : 'Penyisihan'}: ${bestScore}`;
    this.resultsEl.classList.remove('hidden');
  }

  private require<T extends HTMLElement = HTMLElement>(id: string): T {
    const element = document.getElementById(id);
    if (!element) {
      throw new Error(`Elemen #${id} tidak ditemukan`);
    }
    return element as T;
  }
}
