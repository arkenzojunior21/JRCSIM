import {
  ACTION_LABELS,
  bindingSignature,
  createGamepadBindings,
  createKeyboardBindings,
  isAnalogAction,
  type Action,
  type Binding,
} from './bindings';

export interface AxisTuning {
  deadzone: number;
  sensitivity: number;
  curve: 'linear' | 'exponential';
  invert: boolean;
}

export interface InputProfile {
  name: string;
  kind: 'gamepad' | 'keyboard';
  actions: Record<Action, Binding[]>;
  axes: Record<string, AxisTuning>;
  triggerThreshold: number;
  swapSticks: boolean;
}

export interface ProfileStore {
  version: 1;
  activeProfileId: string;
  profiles: Record<string, InputProfile>;
  gamepadProfiles: Record<string, string>;
}

export const KEYBOARD_PROFILE_ID = 'keyboard';
export const GAMEPAD_PROFILE_ID = 'gamepad-default';
const STORAGE_KEY = 'jrcsim.input-profiles.v1';

export function defaultAxisTuning(): AxisTuning {
  return { deadzone: 0.12, sensitivity: 1, curve: 'linear', invert: false };
}

function cloneBindings(source: Record<Action, Binding[]>): Record<Action, Binding[]> {
  return JSON.parse(JSON.stringify(source)) as Record<Action, Binding[]>;
}

export function createKeyboardProfile(): InputProfile {
  return {
    name: 'Keyboard',
    kind: 'keyboard',
    actions: cloneBindings(createKeyboardBindings()),
    axes: {},
    triggerThreshold: 0.5,
    swapSticks: false,
  };
}

export function createGamepadProfile(name = 'Gamepad standar'): InputProfile {
  return {
    name,
    kind: 'gamepad',
    actions: cloneBindings(createGamepadBindings()),
    axes: {
      '0': defaultAxisTuning(),
      '1': defaultAxisTuning(),
      '2': defaultAxisTuning(),
      '3': defaultAxisTuning(),
    },
    triggerThreshold: 0.5,
    swapSticks: false,
  };
}

export function defaultStore(): ProfileStore {
  return {
    version: 1,
    activeProfileId: KEYBOARD_PROFILE_ID,
    profiles: {
      [KEYBOARD_PROFILE_ID]: createKeyboardProfile(),
      [GAMEPAD_PROFILE_ID]: createGamepadProfile(),
    },
    gamepadProfiles: {},
  };
}

function isBinding(value: unknown): value is Binding {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const binding = value as Record<string, unknown>;
  if (binding.kind === 'button') {
    return typeof binding.index === 'number' && binding.index >= 0;
  }
  if (binding.kind === 'axis') {
    return (
      typeof binding.index === 'number' &&
      binding.index >= 0 &&
      (binding.sign === 1 || binding.sign === -1) &&
      typeof binding.threshold === 'number'
    );
  }
  if (binding.kind === 'key') {
    return typeof binding.code === 'string' && binding.code.length > 0;
  }
  return false;
}

function normalizeProfile(raw: unknown): InputProfile | null {
  if (typeof raw !== 'object' || raw === null) {
    return null;
  }
  const source = raw as Partial<InputProfile>;
  if (source.kind !== 'gamepad' && source.kind !== 'keyboard') {
    return null;
  }
  if (typeof source.actions !== 'object' || source.actions === null) {
    return null;
  }
  const template = source.kind === 'gamepad' ? createGamepadProfile() : createKeyboardProfile();
  const actions = {} as Record<Action, Binding[]>;
  for (const action of Object.keys(template.actions) as Action[]) {
    const list = (source.actions as Record<string, unknown>)[action];
    actions[action] = Array.isArray(list) ? list.filter(isBinding) : [];
  }
  const axes: Record<string, AxisTuning> = {};
  if (typeof source.axes === 'object' && source.axes !== null) {
    for (const [index, tuning] of Object.entries(source.axes)) {
      if (typeof tuning !== 'object' || tuning === null) {
        continue;
      }
      const value = tuning as Partial<AxisTuning>;
      axes[index] = {
        deadzone:
          typeof value.deadzone === 'number' ? Math.min(0.5, Math.max(0, value.deadzone)) : 0.12,
        sensitivity:
          typeof value.sensitivity === 'number'
            ? Math.min(2, Math.max(0.5, value.sensitivity))
            : 1,
        curve: value.curve === 'exponential' ? 'exponential' : 'linear',
        invert: value.invert === true,
      };
    }
  }
  return {
    name: typeof source.name === 'string' && source.name ? source.name : template.name,
    kind: source.kind,
    actions,
    axes,
    triggerThreshold:
      typeof source.triggerThreshold === 'number'
        ? Math.min(0.9, Math.max(0.2, source.triggerThreshold))
        : 0.5,
    swapSticks: source.swapSticks === true,
  };
}

function readStorage(): ProfileStore {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return defaultStore();
    }
    const parsed = JSON.parse(raw) as Partial<ProfileStore>;
    const store = defaultStore();
    if (typeof parsed.profiles === 'object' && parsed.profiles !== null) {
      for (const [id, profile] of Object.entries(parsed.profiles)) {
        const normalized = normalizeProfile(profile);
        if (normalized) {
          store.profiles[id] = normalized;
        }
      }
    }
    if (typeof parsed.gamepadProfiles === 'object' && parsed.gamepadProfiles !== null) {
      for (const [padId, profileId] of Object.entries(parsed.gamepadProfiles)) {
        if (typeof profileId === 'string' && store.profiles[profileId]) {
          store.gamepadProfiles[padId] = profileId;
        }
      }
    }
    if (typeof parsed.activeProfileId === 'string' && store.profiles[parsed.activeProfileId]) {
      store.activeProfileId = parsed.activeProfileId;
    }
    return store;
  } catch {
    return defaultStore();
  }
}

let cachedStore: ProfileStore | null = null;

export function getStore(): ProfileStore {
  if (!cachedStore) {
    cachedStore = readStorage();
  }
  return cachedStore;
}

export function saveStore(store: ProfileStore): void {
  cachedStore = store;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    // Penyimpanan bisa diblokir; profil tetap aktif selama sesi.
  }
}

export function reloadStore(): ProfileStore {
  cachedStore = readStorage();
  return cachedStore;
}

export function getProfile(id: string): InputProfile {
  const store = getStore();
  return store.profiles[id] ?? store.profiles[KEYBOARD_PROFILE_ID];
}

export function getActiveProfile(): InputProfile {
  return getProfile(getStore().activeProfileId);
}

export function updateProfile(id: string, profile: InputProfile): void {
  const store = getStore();
  store.profiles[id] = profile;
  saveStore(store);
}

/**
 * Profil per controller: id gamepad dipetakan ke profil tersimpan, atau
 * dibuat dari preset standar saat controller baru pertama kali terdeteksi.
 */
export function profileForGamepad(gamepadId: string): { profileId: string; profile: InputProfile } {
  const store = getStore();
  const existingId = store.gamepadProfiles[gamepadId];
  if (existingId && store.profiles[existingId]) {
    return { profileId: existingId, profile: store.profiles[existingId] };
  }
  const profileId = `gamepad:${gamepadId}`;
  const profile = createGamepadProfile(gamepadId.slice(0, 42));
  store.profiles[profileId] = profile;
  store.gamepadProfiles[gamepadId] = profileId;
  saveStore(store);
  return { profileId, profile };
}

export function conflicts(profile: InputProfile): Array<{ signature: string; actions: Action[] }> {
  const usage = new Map<string, Action[]>();
  for (const [action, bindings] of Object.entries(profile.actions) as Array<[Action, Binding[]]>) {
    for (const binding of bindings) {
      const signature = bindingSignature(binding);
      const list = usage.get(signature) ?? [];
      if (!list.includes(action)) {
        list.push(action);
      }
      usage.set(signature, list);
    }
  }
  const result: Array<{ signature: string; actions: Action[] }> = [];
  for (const [signature, actions] of usage) {
    // Aksi analog memang berbagi sumbu antar mode (mis. gas dan track kiri).
    const analogCount = actions.filter((action) => isAnalogAction(action)).length;
    if (actions.length > 1 && analogCount !== actions.length) {
      result.push({ signature, actions });
    }
  }
  return result;
}

export function conflictsToText(profile: InputProfile): string[] {
  return conflicts(profile).map(
    (conflict) => `${conflict.signature} dipakai oleh: ${conflict.actions.map((a) => ACTION_LABELS[a]).join(', ')}`,
  );
}

export function exportProfile(profile: InputProfile): string {
  return JSON.stringify(profile, null, 2);
}

export function importProfile(json: string): InputProfile | null {
  try {
    return normalizeProfile(JSON.parse(json));
  } catch {
    return null;
  }
}

export function resetProfiles(): ProfileStore {
  const store = defaultStore();
  saveStore(store);
  return store;
}
