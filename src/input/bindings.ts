export type Action =
  | 'throttle'
  | 'steer'
  | 'strafe'
  | 'leftTrack'
  | 'rightTrack'
  | 'forward'
  | 'backward'
  | 'turnLeft'
  | 'turnRight'
  | 'strafeLeft'
  | 'strafeRight'
  | 'grip'
  | 'liftUp'
  | 'liftDown'
  | 'lfToggle'
  | 'lfFaster'
  | 'lfSlower'
  | 'reset'
  | 'pause'
  | 'retry'
  | 'cameraLock';

export interface ButtonBinding {
  kind: 'button';
  index: number;
}

export interface AxisBinding {
  kind: 'axis';
  index: number;
  sign: 1 | -1;
  threshold: number;
}

export interface KeyBinding {
  kind: 'key';
  code: string;
}

export type Binding = ButtonBinding | AxisBinding | KeyBinding;

export const ANALOG_ACTIONS: ReadonlySet<Action> = new Set<Action>([
  'throttle',
  'steer',
  'strafe',
  'leftTrack',
  'rightTrack',
]);

export function isAnalogAction(action: Action): boolean {
  return ANALOG_ACTIONS.has(action);
}

export const ACTION_LABELS: Record<Action, string> = {
  throttle: 'Gas / mundur (analog)',
  steer: 'Belok (analog)',
  strafe: 'Geser samping (analog)',
  leftTrack: 'Track kiri (tank)',
  rightTrack: 'Track kanan (tank)',
  forward: 'Maju (tombol)',
  backward: 'Mundur (tombol)',
  turnLeft: 'Belok kiri (tombol)',
  turnRight: 'Belok kanan (tombol)',
  strafeLeft: 'Geser kiri (tombol)',
  strafeRight: 'Geser kanan (tombol)',
  grip: 'Capit',
  liftUp: 'Naikkan lengan',
  liftDown: 'Turunkan lengan',
  lfToggle: 'Line Follower mulai / jeda',
  lfFaster: 'LF lebih cepat',
  lfSlower: 'LF lebih lambat',
  reset: 'Reset robot',
  pause: 'Jeda sesi',
  retry: 'Retry',
  cameraLock: 'Kunci / buka kamera',
};

export const ACTION_GROUPS: ReadonlyArray<{ title: string; actions: Action[] }> = [
  {
    title: 'Penggerak',
    actions: [
      'throttle',
      'steer',
      'strafe',
      'leftTrack',
      'rightTrack',
      'forward',
      'backward',
      'turnLeft',
      'turnRight',
      'strafeLeft',
      'strafeRight',
    ],
  },
  { title: 'Gripper', actions: ['grip', 'liftUp', 'liftDown'] },
  { title: 'Line Follower', actions: ['lfToggle', 'lfFaster', 'lfSlower'] },
  { title: 'Sistem', actions: ['reset', 'pause', 'retry', 'cameraLock'] },
];

const axis = (index: number, sign: 1 | -1, threshold = 0.35): AxisBinding => ({
  kind: 'axis',
  index,
  sign,
  threshold,
});

const button = (index: number): ButtonBinding => ({ kind: 'button', index });

const key = (code: string): KeyBinding => ({ kind: 'key', code });

export function createKeyboardBindings(): Record<Action, Binding[]> {
  return {
    throttle: [],
    steer: [],
    strafe: [],
    leftTrack: [],
    rightTrack: [],
    forward: [key('KeyW'), key('ArrowUp')],
    backward: [key('KeyS'), key('ArrowDown')],
    turnLeft: [key('KeyA'), key('ArrowLeft')],
    turnRight: [key('KeyD'), key('ArrowRight')],
    strafeLeft: [key('KeyQ')],
    strafeRight: [key('KeyE')],
    grip: [key('Space')],
    liftUp: [key('KeyF')],
    liftDown: [key('KeyC')],
    lfToggle: [key('KeyL')],
    lfFaster: [key('BracketRight')],
    lfSlower: [key('BracketLeft')],
    reset: [key('KeyR')],
    pause: [key('KeyP')],
    retry: [key('KeyT')],
    cameraLock: [key('KeyK')],
  };
}

/**
 * Preset PS3/PS4 (Gamepad API standard mapping): stik kiri gas + belok,
 * stik kanan untuk tank/mecanum, L1 capit, R1 angkat, L2 turun.
 */
export function createGamepadBindings(): Record<Action, Binding[]> {
  return {
    throttle: [axis(1, -1)],
    steer: [axis(0, 1)],
    strafe: [axis(2, 1)],
    leftTrack: [axis(1, -1)],
    rightTrack: [axis(3, -1)],
    forward: [],
    backward: [],
    turnLeft: [],
    turnRight: [],
    strafeLeft: [],
    strafeRight: [],
    grip: [button(4)],
    liftUp: [button(5)],
    liftDown: [button(6)],
    lfToggle: [button(7)],
    lfFaster: [button(12)],
    lfSlower: [button(13)],
    reset: [button(8)],
    pause: [button(9)],
    retry: [button(10)],
    cameraLock: [button(11)],
  };
}

export const KEY_NAMES: Record<string, string> = {
  Space: 'Spasi',
  ArrowUp: 'Panah atas',
  ArrowDown: 'Panah bawah',
  ArrowLeft: 'Panah kiri',
  ArrowRight: 'Panah kanan',
  BracketLeft: '[',
  BracketRight: ']',
  ShiftLeft: 'Shift kiri',
  ShiftRight: 'Shift kanan',
  ControlLeft: 'Ctrl kiri',
  ControlRight: 'Ctrl kanan',
  AltLeft: 'Alt kiri',
  AltRight: 'Alt kanan',
};

export function describeBinding(binding: Binding): string {
  if (binding.kind === 'button') {
    return `Tombol ${binding.index}`;
  }
  if (binding.kind === 'axis') {
    return `Sumbu ${binding.index}${binding.sign > 0 ? '+' : '−'}`;
  }
  const name = KEY_NAMES[binding.code] ?? binding.code.replace(/^Key/, '');
  return `Keyboard ${name}`;
}

export function bindingSignature(binding: Binding): string {
  if (binding.kind === 'button') {
    return `button:${binding.index}`;
  }
  if (binding.kind === 'axis') {
    return `axis:${binding.index}:${binding.sign}`;
  }
  return `key:${binding.code}`;
}
