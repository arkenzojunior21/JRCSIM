const PREVENT_DEFAULT = new Set([
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'Space',
  'Tab',
]);

/**
 * Sumber tombol keyboard mentah. Pemetaan ke aksi dilakukan InputManager
 * supaya tombol bisa di-remap seperti gamepad.
 */
export class KeyboardSource {
  private readonly down = new Set<string>();

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (PREVENT_DEFAULT.has(event.code)) {
      event.preventDefault();
    }
    this.down.add(event.code);
  };

  private readonly onKeyUp = (event: KeyboardEvent): void => {
    this.down.delete(event.code);
  };

  private readonly onBlur = (): void => {
    this.down.clear();
  };

  constructor() {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);
  }

  get pressed(): ReadonlySet<string> {
    return this.down;
  }

  dispose(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onBlur);
  }
}
