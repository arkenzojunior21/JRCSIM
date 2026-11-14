import {
  isAnalogAction,
  type Action,
  type AxisBinding,
  type Binding,
} from './bindings';
import { defaultAxisTuning, type AxisTuning, type InputProfile } from './profiles';

export interface PadLike {
  id: string;
  mapping: string;
  axes: readonly number[];
  buttons: readonly { pressed: boolean; value: number }[];
}

export interface PadReadResult {
  connected: boolean;
  id: string;
  mapping: string;
  values: Map<Action, number>;
  rawAxes: number[];
  rawButtons: boolean[];
}

const EMPTY_RESULT: PadReadResult = {
  connected: false,
  id: '',
  mapping: '',
  values: new Map(),
  rawAxes: [],
  rawButtons: [],
};

function swapIndex(index: number): number {
  if (index === 0) return 2;
  if (index === 1) return 3;
  if (index === 2) return 0;
  if (index === 3) return 1;
  return index;
}

export function tuneAxis(raw: number, tuning: AxisTuning): number {
  const value = tuning.invert ? -raw : raw;
  const magnitude = Math.abs(value);
  if (magnitude <= tuning.deadzone) {
    return 0;
  }
  const scaled = Math.min(
    1,
    ((magnitude - tuning.deadzone) / (1 - tuning.deadzone)) * tuning.sensitivity,
  );
  const curved = tuning.curve === 'exponential' ? scaled * scaled : scaled;
  return Math.sign(value) * curved;
}

function bindingValue(
  binding: Binding,
  profile: InputProfile,
  readAxis: (index: number) => number,
  readButton: (index: number) => number,
): { analog: number; digital: boolean } {
  if (binding.kind === 'key') {
    return { analog: 0, digital: false };
  }
  if (binding.kind === 'button') {
    const value = readButton(binding.index);
    return { analog: value, digital: value >= profile.triggerThreshold };
  }
  const axisBinding = binding as AxisBinding;
  const value = readAxis(axisBinding.index) * axisBinding.sign;
  return { analog: value, digital: Math.abs(value) >= axisBinding.threshold };
}

export function readPad(pad: PadLike | null, profile: InputProfile): PadReadResult {
  if (!pad) {
    return { ...EMPTY_RESULT };
  }

  const readAxis = (index: number): number => {
    const logical = profile.swapSticks ? swapIndex(index) : index;
    const tuning = profile.axes[String(logical)] ?? defaultAxisTuning();
    return tuneAxis(pad.axes[logical] ?? 0, tuning);
  };
  const readButton = (index: number): number => {
    const button = pad.buttons[index];
    if (!button) return 0;
    return Math.max(button.value, button.pressed ? 1 : 0);
  };

  const values = new Map<Action, number>();
  for (const [action, bindings] of Object.entries(profile.actions) as Array<[Action, Binding[]]>) {
    let best = 0;
    let digital = false;
    for (const binding of bindings) {
      const result = bindingValue(binding, profile, readAxis, readButton);
      if (isAnalogAction(action) && Math.abs(result.analog) > Math.abs(best)) {
        best = result.analog;
      }
      digital = digital || result.digital;
    }
    values.set(action, isAnalogAction(action) ? best : digital ? 1 : 0);
  }

  return {
    connected: true,
    id: pad.id,
    mapping: pad.mapping,
    values,
    rawAxes: Array.from(pad.axes),
    rawButtons: pad.buttons.map((button) => button.pressed),
  };
}

export function pickGamepad(): PadLike | null {
  if (typeof navigator === 'undefined' || typeof navigator.getGamepads !== 'function') {
    return null;
  }
  for (const pad of navigator.getGamepads()) {
    if (pad && pad.connected) {
      return pad as unknown as PadLike;
    }
  }
  return null;
}
