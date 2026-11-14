import type { DriveCommand, DriveMode } from '../sim/driveModes';
import type { Action } from './bindings';

function clamp(value: number, min = -1, max = 1): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Menggabungkan aksi analog dan tombol menjadi perintah penggerak. Tank
 * memakai selisih track; arcade/mecanum memakai gas-belok langsung.
 */
export function composeCommand(
  mode: DriveMode,
  value: (action: Action) => number,
): DriveCommand {
  const fwd = clamp(value('forward') - value('backward'));
  const turnButton = clamp(value('turnRight') - value('turnLeft'));
  const strafeButton = clamp(value('strafeRight') - value('strafeLeft'));

  if (mode === 'tank') {
    const left = clamp(value('leftTrack') + fwd - turnButton);
    const right = clamp(value('rightTrack') + fwd + turnButton);
    return { forward: (left + right) / 2, turn: (right - left) / 2, strafe: 0 };
  }

  const forward = clamp(value('throttle') + fwd);
  const turn = clamp(value('steer') + turnButton);
  if (mode === 'arcade') {
    return { forward, turn, strafe: 0 };
  }
  return { forward, turn, strafe: clamp(value('strafe') + strafeButton) };
}
