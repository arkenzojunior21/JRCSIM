import { describe, expect, it } from 'vitest';
import { createGamepadBindings, createKeyboardBindings } from '../src/input/bindings';
import { composeCommand } from '../src/input/compose';
import { readPad, tuneAxis, type PadLike } from '../src/input/gamepad';
import {
  conflicts,
  createGamepadProfile,
  exportProfile,
  importProfile,
  type AxisTuning,
} from '../src/input/profiles';

const tuning: AxisTuning = {
  deadzone: 0.1,
  sensitivity: 1,
  curve: 'linear',
  invert: false,
};

function value(input: Partial<Record<string, number>>) {
  return (action: string): number => input[action] ?? 0;
}

function fakePad(axes: number[], pressed: number[] = []): PadLike {
  return {
    id: 'Fake Pad (STANDARD GAMEPAD Vendor: 054c Product: 05c4)',
    mapping: 'standard',
    axes,
    buttons: Array.from({ length: 16 }, (_, index) => ({
      pressed: pressed.includes(index),
      value: pressed.includes(index) ? 1 : 0,
    })),
  };
}

describe('tuneAxis', () => {
  it('membuang nilai di dalam deadzone', () => {
    expect(tuneAxis(0.08, tuning)).toBe(0);
  });

  it('me-rescale nilai di atas deadzone', () => {
    expect(tuneAxis(0.55, tuning)).toBeCloseTo(0.5, 6);
  });

  it('membalik arah saat invert aktif', () => {
    expect(tuneAxis(0.55, { ...tuning, invert: true })).toBeCloseTo(-0.5, 6);
  });

  it('kurva eksponensial memperkecil input tengah', () => {
    expect(tuneAxis(0.55, { ...tuning, curve: 'exponential' })).toBeCloseTo(0.25, 6);
  });

  it('sensitivitas dibatasi pada nilai maksimum 1', () => {
    expect(tuneAxis(1, { ...tuning, sensitivity: 2 })).toBe(1);
  });
});

describe('readPad', () => {
  it('stik kiri atas menghasilkan gas positif pada preset PS4', () => {
    const profile = createGamepadProfile();
    const result = readPad(fakePad([0, -1, 0, 0]), profile);
    expect(result.values.get('throttle')).toBeCloseTo(1, 6);
    expect(result.values.get('leftTrack')).toBeCloseTo(1, 6);
    expect(result.values.get('rightTrack')).toBeCloseTo(0, 6);
  });

  it('tombol L1 memicu capit', () => {
    const profile = createGamepadProfile();
    const result = readPad(fakePad([0, 0, 0, 0], [4]), profile);
    expect(result.values.get('grip')).toBe(1);
  });

  it('mengabaikan pad saat tidak terhubung', () => {
    const result = readPad(null, createGamepadProfile());
    expect(result.connected).toBe(false);
    expect(result.values.size).toBe(0);
  });

  it('tukar stik memindahkan pembacaan ke stik kanan', () => {
    const profile = createGamepadProfile();
    profile.swapSticks = true;
    const result = readPad(fakePad([0, 0, 0, -1]), profile);
    expect(result.values.get('throttle')).toBeCloseTo(1, 6);
  });
});

describe('composeCommand', () => {
  it('tank memakai selisih track', () => {
    const command = composeCommand('tank', value({ leftTrack: 1, rightTrack: -1 }));
    expect(command.forward).toBeCloseTo(0, 6);
    expect(command.turn).toBeCloseTo(-1, 6);
  });

  it('tank dengan tombol belok kanan', () => {
    const command = composeCommand('tank', value({ turnRight: 1 }));
    expect(command.forward).toBeCloseTo(0, 6);
    expect(command.turn).toBeCloseTo(1, 6);
  });

  it('arcade mengabaikan strafe', () => {
    const command = composeCommand('arcade', value({ throttle: 0.5, strafe: 1 }));
    expect(command.forward).toBeCloseTo(0.5, 6);
    expect(command.strafe).toBe(0);
  });

  it('mecanum meneruskan strafe', () => {
    const command = composeCommand('mecanum', value({ throttle: 0.5, strafe: 1 }));
    expect(command.strafe).toBeCloseTo(1, 6);
  });
});

describe('profil input', () => {
  it('default keyboard dan gamepad punya jumlah aksi sama', () => {
    expect(Object.keys(createKeyboardBindings()).sort()).toEqual(
      Object.keys(createGamepadBindings()).sort(),
    );
  });

  it('tidak ada konflik pada preset PS4', () => {
    expect(conflicts(createGamepadProfile())).toHaveLength(0);
  });

  it('mengizinkan aksi analog berbagi sumbu antar mode', () => {
    const profile = createGamepadProfile();
    profile.actions.throttle = [{ kind: 'axis', index: 1, sign: -1, threshold: 0.35 }];
    profile.actions.leftTrack = [{ kind: 'axis', index: 1, sign: -1, threshold: 0.35 }];
    expect(conflicts(profile)).toHaveLength(0);
  });

  it('mendeteksi konflik saat tombol dipakai dua aksi', () => {
    const profile = createGamepadProfile();
    profile.actions.grip = [{ kind: 'button', index: 4 }];
    profile.actions.liftUp = [{ kind: 'button', index: 4 }];
    const list = conflicts(profile);
    expect(list).toHaveLength(1);
    expect(list[0].actions.sort()).toEqual(['grip', 'liftUp']);
  });

  it('ekspor lalu impor mengembalikan profil yang sama', () => {
    const profile = createGamepadProfile('Test');
    profile.axes['0'].deadzone = 0.2;
    const restored = importProfile(exportProfile(profile));
    expect(restored).not.toBeNull();
    expect(restored?.name).toBe('Test');
    expect(restored?.axes['0'].deadzone).toBeCloseTo(0.2, 6);
  });

  it('menolak JSON profil yang tidak valid', () => {
    expect(importProfile('{"kind":"gamepad"}')).toBeNull();
    expect(importProfile('bukan json')).toBeNull();
  });
});
