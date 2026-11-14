import type { DriveCommand, DriveMode } from '../sim/driveModes';
import { isAnalogAction, type Action, type Binding } from './bindings';
import { composeCommand } from './compose';
import { pickGamepad, readPad } from './gamepad';
import { KeyboardSource } from './keyboard';
import {
  getStore,
  profileForGamepad,
  KEYBOARD_PROFILE_ID,
  type InputProfile,
} from './profiles';

export interface ControlState {
  forward: number;
  turn: number;
  strafe: number;
  leftTrack: number;
  rightTrack: number;
  grip: boolean;
  liftUp: boolean;
  liftDown: boolean;
}

export interface PadInfo {
  connected: boolean;
  id: string;
  mapping: string;
}

const ANALOG_THRESHOLD = 0.02;
const DIGITAL_THRESHOLD = 0.5;

export class InputManager {
  readonly keyboard = new KeyboardSource();
  padInfo: PadInfo = { connected: false, id: '', mapping: '' };
  keyboardProfile: InputProfile;
  gamepadProfile: InputProfile;

  private values = new Map<Action, number>();
  private active = new Set<Action>();
  private previous = new Set<Action>();
  private cachedPadId = '';

  constructor() {
    const store = getStore();
    this.keyboardProfile = store.profiles[KEYBOARD_PROFILE_ID];
    this.gamepadProfile =
      store.profiles[store.activeProfileId] ??
      store.profiles[KEYBOARD_PROFILE_ID];
  }

  setKeyboardProfile(profile: InputProfile): void {
    this.keyboardProfile = profile;
  }

  setGamepadProfile(profile: InputProfile): void {
    this.gamepadProfile = profile;
    this.cachedPadId = '';
  }

  update(): void {
    const merged = new Map<Action, number>();

    for (const [action, bindings] of Object.entries(this.keyboardProfile.actions) as Array<
      [Action, Binding[]]
    >) {
      const pressed = bindings.some(
        (binding) => binding.kind === 'key' && this.keyboard.pressed.has(binding.code),
      );
      if (pressed) {
        merged.set(action, 1);
      }
    }

    const pad = pickGamepad();
    this.padInfo = pad
      ? { connected: true, id: pad.id, mapping: pad.mapping }
      : { connected: false, id: '', mapping: '' };

    if (pad) {
      if (this.cachedPadId !== pad.id) {
        this.cachedPadId = pad.id;
        this.gamepadProfile = profileForGamepad(pad.id).profile;
      }
      const result = readPad(pad, this.gamepadProfile);
      for (const [action, value] of result.values) {
        const current = merged.get(action) ?? 0;
        if (isAnalogAction(action)) {
          merged.set(action, Math.abs(value) > Math.abs(current) ? value : current);
        } else if (value > 0) {
          merged.set(action, 1);
        }
      }
    }

    this.previous = this.active;
    this.active = new Set<Action>();
    for (const [action, value] of merged) {
      const threshold = isAnalogAction(action) ? ANALOG_THRESHOLD : DIGITAL_THRESHOLD;
      if (Math.abs(value) > threshold) {
        this.active.add(action);
      }
    }
    this.values = merged;
  }

  value(action: Action): number {
    return this.values.get(action) ?? 0;
  }

  held(action: Action): boolean {
    return this.active.has(action);
  }

  pressed(action: Action): boolean {
    return this.active.has(action) && !this.previous.has(action);
  }

  get state(): ControlState {
    return {
      forward: this.value('forward') - this.value('backward'),
      turn: this.value('turnRight') - this.value('turnLeft'),
      strafe: this.value('strafeRight') - this.value('strafeLeft'),
      leftTrack: this.value('leftTrack'),
      rightTrack: this.value('rightTrack'),
      grip: this.held('grip'),
      liftUp: this.held('liftUp'),
      liftDown: this.held('liftDown'),
    };
  }

  commandFor(mode: DriveMode): DriveCommand {
    return composeCommand(mode, (action) => this.value(action));
  }

  snapshot(): Map<Action, number> {
    return new Map(this.values);
  }
}
