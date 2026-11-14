import * as THREE from 'three';
import { InputManager } from '../input/inputManager';
import { buildArena, type FloorState } from '../render/arena';
import { CameraRig } from '../render/cameraRig';
import { loadTrackModel } from '../render/trackModel';
import { WorldView } from '../render/worldView';
import { MATCH, ROBOT } from '../sim/constants';
import type { DriveCommand, DriveMode } from '../sim/driveModes';
import type { GameMode } from '../sim/mission';
import { START_POSES } from '../sim/trackLayout';
import { World } from '../sim/world';
import { Hud } from '../ui/hud';
import { SettingsPanel } from '../ui/settings';

const STEP = MATCH.fixedDt;
const MAX_STEPS_PER_FRAME = 5;
const LF_SPEED_STEP = 0.02;

export class App {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene: THREE.Scene;
  private readonly cameraRig: CameraRig;
  private readonly input: InputManager;
  private readonly world: World;
  private readonly worldView: WorldView;
  private readonly hud: Hud;
  private readonly settings: SettingsPanel;
  private mode: DriveMode = 'tank';
  private paused = false;
  private pausedBySettings = false;
  private frame = 0;
  private lastTime = 0;
  private accumulator = 0;
  private lastPhase = '';

  constructor(private readonly container: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x070b11);
    this.scene.fog = new THREE.Fog(0x070b11, 12, 30);

    this.cameraRig = new CameraRig(this.renderer.domElement);
    this.addLights();
    const arena = buildArena(this.scene, this.renderer, (state) => this.onFloorState(state));

    this.world = new World('free');
    this.worldView = new WorldView();
    this.worldView.setObjects(this.world.objects);
    this.scene.add(this.worldView.group);

    this.input = new InputManager();
    this.settings = new SettingsPanel(this.input, () => {
      this.world.mode = this.mode;
    });

    this.hud = new Hud({
      onStart: () => this.startSession(),
      onReset: () => this.resetSession(),
      onRetry: () => this.retrySession(),
      onGameMode: (mode) => this.setGameMode(mode),
      onDriveMode: (mode) => this.setMode(mode),
      onLfSpeed: (speed) => this.world.setLfSpeed(speed),
      onLfToggle: () => this.toggleLineFollower(),
      onCameraReset: () => {
        this.cameraRig.reset();
        this.cameraRig.persist();
        this.hud.setStatus('Kamera direset ke isometrik');
      },
      onCameraLock: () => this.toggleCameraLock(),
      onSettings: () => this.openSettings(),
    });
    this.hud.setLfSpeed(ROBOT.lineFollower.defaultSpeed);
    this.hud.updateGameMode(this.world.mission.mode);
    this.hud.updateDriveMode(this.mode);

    loadTrackModel(this.scene, (loaded) => {
      if (!loaded) {
        return;
      }
      arena.visible = false;
      this.hud.setStatus('Model trek resmi dimuat');
    });

    window.addEventListener('resize', () => this.resize());
    window.addEventListener('beforeunload', () => this.cameraRig.persist());
    this.resize();
    this.worldView.sync(this.world);

    (window as unknown as { jrcsim?: unknown }).jrcsim = {
      world: this.world,
      hud: this.hud,
      robot: this.world.transporter.state,
      input: this.input,
      setMode: (mode: DriveMode) => this.setMode(mode),
      drive: (seconds: number, command: DriveCommand) => this.driveFor(seconds, command),
      command: () => this.input.commandFor(this.mode),
    };
  }

  start(): void {
    this.lastTime = 0;
    const tick = (time: number): void => {
      const delta = this.lastTime === 0 ? 0 : (time - this.lastTime) / 1000;
      this.lastTime = time;
      this.input.update();
      this.settings.updateLive(time);
      if (this.pausedBySettings && !this.settings.isOpen) {
        this.pausedBySettings = false;
        this.paused = false;
      }
      this.handleShortcuts();

      const frozen = this.paused || this.settings.isOpen;
      this.accumulator = frozen
        ? 0
        : Math.min(this.accumulator + delta, STEP * MAX_STEPS_PER_FRAME);
      while (this.accumulator >= STEP) {
        this.step(STEP);
        this.accumulator -= STEP;
      }

      this.worldView.sync(this.world);
      this.hud.update(this.world, this.input, this.paused);
      this.cameraRig.update();
      this.renderer.render(this.scene, this.cameraRig.camera);
      this.frame = window.requestAnimationFrame(tick);
    };
    this.frame = window.requestAnimationFrame(tick);
  }

  stop(): void {
    window.cancelAnimationFrame(this.frame);
    this.input.keyboard.dispose();
  }

  private step(dt: number): void {
    this.world.update(dt, {
      command: this.input.commandFor(this.mode),
      grip: this.input.held('grip'),
      liftUp: this.input.held('liftUp'),
      liftDown: this.input.held('liftDown'),
    });
    if (this.world.mission.phase !== this.lastPhase) {
      this.onPhaseChange();
    }
  }

  private driveFor(seconds: number, command: DriveCommand): void {
    const count = Math.max(0, Math.min(600, Math.round(seconds / STEP)));
    for (let i = 0; i < count; i += 1) {
      this.world.update(STEP, {
        command,
        grip: false,
        liftUp: false,
        liftDown: false,
      });
    }
    this.worldView.sync(this.world);
  }

  private handleShortcuts(): void {
    if (this.settings.isOpen) {
      return;
    }
    if (this.input.pressed('cameraLock')) {
      this.toggleCameraLock();
    }
    if (this.input.pressed('pause')) {
      this.paused = !this.paused;
      this.hud.setStatus(this.paused ? 'Simulasi dijeda' : 'Simulasi dilanjutkan');
    }
    if (this.input.pressed('retry')) {
      this.retrySession();
    }
    if (this.input.pressed('reset')) {
      this.world.transporter.reset(
        START_POSES.transporter.x,
        START_POSES.transporter.z,
        START_POSES.transporter.yaw,
      );
      this.hud.setStatus('Transporter kembali ke zona start');
    }
    if (this.input.pressed('lfToggle')) {
      this.toggleLineFollower();
    }
    if (this.input.pressed('lfFaster')) {
      this.hud.setLfSpeed(
        Math.min(ROBOT.lineFollower.maxSpeed, this.world.lineFollower.state.speed + LF_SPEED_STEP),
      );
    }
    if (this.input.pressed('lfSlower')) {
      this.hud.setLfSpeed(
        Math.max(ROBOT.lineFollower.minSpeed, this.world.lineFollower.state.speed - LF_SPEED_STEP),
      );
    }
  }

  private onPhaseChange(): void {
    const phase = this.world.mission.phase;
    this.lastPhase = phase;
    if (phase === 'ARMED') {
      this.hud.setStatus('Bersiap — hitung mundur 3 detik');
    } else if (phase === 'RUNNING') {
      this.hud.setStatus('Sesi berjalan — buka CATARACTA dan mulai transfer');
    } else if (phase === 'COMPLETE') {
      this.hud.setStatus('Misi selesai — semua syarat terpenuhi');
      this.setCameraLock(false);
    } else if (phase === 'TIME_UP') {
      this.hud.setStatus('Waktu habis');
      this.setCameraLock(false);
    } else if (phase === 'SETUP') {
      this.hud.setStatus('Arena siap — atur kamera lalu tekan Mulai');
    }
  }

  private startSession(): void {
    if (this.world.mission.phase !== 'SETUP') {
      return;
    }
    this.paused = false;
    this.world.start();
    this.lastPhase = this.world.mission.phase;
    this.setCameraLock(true);
    this.hud.setStatus(
      this.world.mission.mode === 'free'
        ? 'Free Test berjalan — tanpa timer dan skor akhir'
        : 'Penyisihan dimulai — hitung mundur 3 detik',
    );
  }

  private resetSession(): void {
    this.paused = false;
    this.world.reset(this.world.mission.mode);
    this.worldView.setObjects(this.world.objects);
    this.hud.setLfSpeed(ROBOT.lineFollower.defaultSpeed);
    this.lastPhase = this.world.mission.phase;
    this.hud.hideResults();
    this.setCameraLock(false);
    this.hud.setStatus('Sesi direset — atur kamera lalu tekan Mulai');
  }

  private retrySession(): void {
    if (this.world.mission.phase === 'SETUP') {
      return;
    }
    this.paused = false;
    this.world.retry();
    this.worldView.setObjects(this.world.objects);
    this.lastPhase = this.world.mission.phase;
    this.hud.hideResults();
    this.setCameraLock(true);
    this.hud.setStatus(
      this.world.mission.mode === 'free'
        ? 'Retry — robot kembali ke zona start'
        : 'Retry — penalti 5 detik',
    );
  }

  private toggleLineFollower(): void {
    this.world.toggleLfRunning();
    this.hud.setStatus(
      this.world.lineFollower.state.running
        ? 'Line Follower berjalan'
        : 'Line Follower dijeda',
    );
  }

  private setGameMode(mode: GameMode): void {
    this.world.reset(mode);
    this.worldView.setObjects(this.world.objects);
    this.hud.updateGameMode(mode);
    this.hud.setLfSpeed(ROBOT.lineFollower.defaultSpeed);
    this.paused = false;
    this.lastPhase = this.world.mission.phase;
    this.hud.hideResults();
    this.setCameraLock(false);
    this.hud.setStatus(
      mode === 'free'
        ? 'Free Test — tanpa timer dan skor akhir'
        : 'Penyisihan — 240 detik, skor maksimal 130',
    );
  }

  private setMode(mode: DriveMode): void {
    this.mode = mode;
    this.world.mode = mode;
    this.hud.updateDriveMode(mode);
  }

  private openSettings(): void {
    this.paused = true;
    this.pausedBySettings = true;
    this.settings.open();
  }

  private toggleCameraLock(): void {
    this.setCameraLock(!this.cameraRig.isLocked);
  }

  private setCameraLock(locked: boolean): void {
    this.cameraRig.setLocked(locked);
    this.hud.setCameraLocked(locked);
  }

  private addLights(): void {
    const hemisphere = new THREE.HemisphereLight(0xdfefff, 0x18222c, 1.15);
    this.scene.add(hemisphere);

    const key = new THREE.DirectionalLight(0xffffff, 2.4);
    key.position.set(4.5, 7.5, 5);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.camera.left = -5;
    key.shadow.camera.right = 5;
    key.shadow.camera.top = 5;
    key.shadow.camera.bottom = -5;
    key.shadow.camera.near = 0.5;
    key.shadow.camera.far = 25;
    key.shadow.bias = -0.0005;
    this.scene.add(key);

    const fill = new THREE.DirectionalLight(0x88bbff, 0.45);
    fill.position.set(-5, 4, -4);
    this.scene.add(fill);
  }

  private onFloorState(state: FloorState): void {
    if (!this.hud) {
      return;
    }
    if (state === 'loading') {
      this.hud.setStatus('Memuat tekstur trek...');
    } else if (state === 'loaded') {
      this.hud.setStatus('Arena siap — atur kamera lalu tekan Mulai');
    } else {
      this.hud.setStatus('Tekstur trek belum ada — jalankan npm run assets');
    }
  }

  private resize(): void {
    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;
    this.renderer.setSize(width, height);
    this.cameraRig.resize(width, height);
  }
}
