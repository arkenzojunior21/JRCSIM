import type { Binding } from './bindings';

export interface RemapResult {
  binding: Binding | null;
  reason?: 'timeout' | 'cancelled';
}

const AXIS_THRESHOLD = 0.6;
const POLL_MS = 60;

/**
 * Menunggu satu input baru dari keyboard atau gamepad. Dipakai halaman
 * Pengaturan untuk merekam tombol yang akan dipetakan ke sebuah aksi.
 */
export function captureBinding(timeoutMs = 10000, signal?: AbortSignal): Promise<RemapResult> {
  return new Promise((resolve) => {
    let finished = false;

    const finish = (result: RemapResult): void => {
      if (finished) return;
      finished = true;
      cleanup();
      resolve(result);
    };

    const onKeyDown = (event: KeyboardEvent): void => {
      event.preventDefault();
      event.stopPropagation();
      finish({ binding: { kind: 'key', code: event.code } });
    };

    const poll = window.setInterval(() => {
      const pads = navigator.getGamepads?.() ?? [];
      for (const pad of pads) {
        if (!pad || !pad.connected) continue;
        for (let index = 0; index < pad.buttons.length; index += 1) {
          if (pad.buttons[index]?.pressed) {
            finish({ binding: { kind: 'button', index } });
            return;
          }
        }
        for (let index = 0; index < pad.axes.length; index += 1) {
          const value = pad.axes[index] ?? 0;
          if (Math.abs(value) > AXIS_THRESHOLD) {
            finish({
              binding: {
                kind: 'axis',
                index,
                sign: value > 0 ? 1 : -1,
                threshold: 0.35,
              },
            });
            return;
          }
        }
      }
    }, POLL_MS);

    const timeout = window.setTimeout(() => finish({ binding: null, reason: 'timeout' }), timeoutMs);

    const onAbort = (): void => finish({ binding: null, reason: 'cancelled' });

    function cleanup(): void {
      window.clearInterval(poll);
      window.clearTimeout(timeout);
      window.removeEventListener('keydown', onKeyDown, true);
      signal?.removeEventListener('abort', onAbort);
    }

    window.addEventListener('keydown', onKeyDown, true);
    signal?.addEventListener('abort', onAbort);
  });
}
