import {
  ACTION_GROUPS,
  ACTION_LABELS,
  describeBinding,
  isAnalogAction,
  type Action,
} from '../input/bindings';
import { pickGamepad, tuneAxis } from '../input/gamepad';
import type { InputManager } from '../input/inputManager';
import {
  conflictsToText,
  defaultAxisTuning,
  exportProfile,
  GAMEPAD_PROFILE_ID,
  getProfile,
  importProfile,
  KEYBOARD_PROFILE_ID,
  profileForGamepad,
  resetProfiles,
  updateProfile,
  type InputProfile,
} from '../input/profiles';
import { captureBinding } from '../input/remap';

const AXIS_LABELS = ['Sumbu 0', 'Sumbu 1', 'Sumbu 2', 'Sumbu 3'];
const LIVE_INTERVAL_MS = 140;

interface Target {
  profileId: string;
  profile: InputProfile;
}

export class SettingsPanel {
  readonly element: HTMLElement;
  private readonly actionsEl: HTMLElement;
  private readonly tuningEl: HTMLElement;
  private readonly padEl: HTMLElement;
  private readonly liveEl: HTMLElement;
  private readonly conflictEl: HTMLElement;
  private tab: 'gamepad' | 'keyboard' = 'gamepad';
  private capturing = false;
  private lastLive = 0;
  private lastPadKey = '';
  private abort: AbortController | null = null;

  constructor(
    private readonly input: InputManager,
    private readonly onProfileChange: () => void,
  ) {
    this.element = this.buildSkeleton();
    this.actionsEl = this.require('#settings-actions');
    this.tuningEl = this.require('#settings-tuning');
    this.padEl = this.require('#settings-pad');
    this.liveEl = this.require('#settings-live');
    this.conflictEl = this.require('#settings-conflicts');
    document.body.appendChild(this.element);
    this.render();
  }

  get isOpen(): boolean {
    return !this.element.classList.contains('hidden');
  }

  open(): void {
    this.element.classList.remove('hidden');
    this.render();
  }

  close(): void {
    this.abort?.abort();
    this.element.classList.add('hidden');
  }

  toggle(): void {
    if (this.isOpen) this.close();
    else this.open();
  }

  updateLive(now: number): void {
    if (!this.isOpen || now - this.lastLive < LIVE_INTERVAL_MS) {
      return;
    }
    this.lastLive = now;
    const pad = this.input.padInfo;
    const padKey = `${pad.connected}|${pad.id}`;
    if (padKey !== this.lastPadKey) {
      this.lastPadKey = padKey;
      this.render();
      return;
    }
    this.refreshStatus();
  }

  private currentTarget(): Target {
    if (this.tab === 'keyboard') {
      return {
        profileId: KEYBOARD_PROFILE_ID,
        profile: getProfile(KEYBOARD_PROFILE_ID),
      };
    }
    const pad = pickGamepad();
    if (pad) {
      return profileForGamepad(pad.id);
    }
    return {
      profileId: GAMEPAD_PROFILE_ID,
      profile: getProfile(GAMEPAD_PROFILE_ID),
    };
  }

  private buildSkeleton(): HTMLElement {
    const panel = document.createElement('div');
    panel.id = 'settings';
    panel.className = 'settings hidden';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'true');
    panel.innerHTML = `
      <div class="settings-card">
        <header class="settings-head">
          <h2>Pengaturan Kontrol</h2>
          <button type="button" class="settings-close" aria-label="Tutup">×</button>
        </header>
        <div class="settings-body">
          <div id="settings-pad" class="pad-line">Gamepad belum terdeteksi</div>
          <div id="settings-live" class="live-line"></div>
          <div class="settings-tabs" role="tablist">
            <button type="button" data-tab="gamepad" class="active">Gamepad</button>
            <button type="button" data-tab="keyboard">Keyboard</button>
          </div>
          <p class="settings-hint">Tekan “Tambah” pada aksi, lalu tekan tombol/stick. Pengaturan tersimpan otomatis.</p>
          <div id="settings-actions" class="settings-actions"></div>
          <div id="settings-tuning" class="settings-tuning"></div>
          <div class="settings-tools">
            <button type="button" id="settings-export">Ekspor profil</button>
            <button type="button" id="settings-import">Impor profil</button>
            <button type="button" id="settings-reset">Reset ke default</button>
            <input type="file" id="settings-file" accept="application/json" hidden />
          </div>
          <p id="settings-conflicts" class="settings-warn"></p>
        </div>
      </div>`;

    panel.querySelector('.settings-close')?.addEventListener('click', () => this.close());
    panel.addEventListener('click', (event) => {
      if (event.target === panel) {
        this.close();
      }
    });
    for (const button of panel.querySelectorAll<HTMLButtonElement>('[data-tab]')) {
      button.addEventListener('click', () => {
        this.tab = button.dataset.tab === 'keyboard' ? 'keyboard' : 'gamepad';
        this.render();
      });
    }
    panel.querySelector('#settings-export')?.addEventListener('click', () => this.downloadProfile());
    panel.querySelector('#settings-import')?.addEventListener('click', () => {
      this.require<HTMLInputElement>('#settings-file').click();
    });
    panel.querySelector('#settings-file')?.addEventListener('change', (event) => {
      const file = (event.target as HTMLInputElement).files?.[0];
      if (file) {
        void this.importFromFile(file);
      }
    });
    panel.querySelector('#settings-reset')?.addEventListener('click', () => {
      resetProfiles();
      this.input.setKeyboardProfile(getProfile(KEYBOARD_PROFILE_ID));
      this.input.setGamepadProfile(getProfile(GAMEPAD_PROFILE_ID));
      this.onProfileChange();
      this.render();
    });
    return panel;
  }

  private render(): void {
    for (const button of this.element.querySelectorAll<HTMLButtonElement>('[data-tab]')) {
      button.classList.toggle('active', button.dataset.tab === this.tab);
    }
    this.renderActions();
    this.renderTuning();
    this.refreshStatus();
  }

  private renderActions(): void {
    const { profile } = this.currentTarget();
    this.actionsEl.replaceChildren();

    for (const group of ACTION_GROUPS) {
      const section = document.createElement('section');
      section.className = 'settings-group';
      const title = document.createElement('h3');
      title.textContent = group.title;
      section.appendChild(title);

      for (const action of group.actions) {
        section.appendChild(this.buildActionRow(action, profile));
      }
      this.actionsEl.appendChild(section);
    }
  }

  private buildActionRow(action: Action, profile: InputProfile): HTMLElement {
    const row = document.createElement('div');
    row.className = 'action-row';

    const label = document.createElement('span');
    label.className = 'action-label';
    label.textContent = ACTION_LABELS[action] + (isAnalogAction(action) ? ' ⟳' : '');
    row.appendChild(label);

    const chips = document.createElement('div');
    chips.className = 'action-chips';
    const bindings = profile.actions[action] ?? [];
    if (bindings.length === 0) {
      const empty = document.createElement('span');
      empty.className = 'chip-empty';
      empty.textContent = 'belum ada';
      chips.appendChild(empty);
    }
    bindings.forEach((binding, index) => {
      const chip = document.createElement('span');
      chip.className = 'chip';
      chip.textContent = describeBinding(binding);
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.textContent = '×';
      remove.setAttribute('aria-label', 'Hapus pemetaan');
      remove.addEventListener('click', () => {
        profile.actions[action].splice(index, 1);
        this.commit(profile);
      });
      chip.appendChild(remove);
      chips.appendChild(chip);
    });
    row.appendChild(chips);

    const add = document.createElement('button');
    add.type = 'button';
    add.className = 'action-add';
    add.textContent = this.capturing ? 'Tunggu…' : 'Tambah';
    add.disabled = this.capturing;
    add.addEventListener('click', () => void this.captureFor(action, profile));
    row.appendChild(add);

    return row;
  }

  private async captureFor(action: Action, profile: InputProfile): Promise<void> {
    if (this.capturing) return;
    this.capturing = true;
    this.abort = new AbortController();
    const buttons = this.actionsEl.querySelectorAll<HTMLButtonElement>('.action-add');
    for (const button of buttons) {
      button.disabled = true;
      button.textContent = 'Tunggu…';
    }

    const result = await captureBinding(10000, this.abort.signal);
    this.capturing = false;
    this.abort = null;

    if (result.binding) {
      profile.actions[action] = [...(profile.actions[action] ?? []), result.binding];
      this.commit(profile);
    } else {
      this.render();
    }
  }

  private commit(profile: InputProfile): void {
    const target = this.currentTarget();
    updateProfile(target.profileId, profile);
    if (this.tab === 'keyboard') {
      this.input.setKeyboardProfile(profile);
    } else {
      this.input.setGamepadProfile(profile);
    }
    this.onProfileChange();
    this.render();
  }

  private renderTuning(): void {
    this.tuningEl.replaceChildren();
    if (this.tab === 'keyboard') {
      this.tuningEl.hidden = true;
      return;
    }
    this.tuningEl.hidden = false;
    const { profile } = this.currentTarget();

    const heading = document.createElement('h3');
    heading.textContent = 'Tuning analog';
    this.tuningEl.appendChild(heading);

    const globalRow = document.createElement('div');
    globalRow.className = 'tuning-global';
    globalRow.appendChild(
      this.buildCheckbox('Tukar stik kiri/kanan', profile.swapSticks, (checked) => {
        profile.swapSticks = checked;
        this.commit(profile);
      }),
    );
    globalRow.appendChild(
      this.buildRange(
        'Ambang tombol',
        profile.triggerThreshold,
        0.2,
        0.9,
        0.05,
        (value) => {
          profile.triggerThreshold = value;
          this.commit(profile);
        },
      ),
    );
    this.tuningEl.appendChild(globalRow);

    for (let index = 0; index < 4; index += 1) {
      const keyIndex = String(index);
      const tuning = profile.axes[keyIndex] ?? defaultAxisTuning();
      profile.axes[keyIndex] = tuning;

      const card = document.createElement('div');
      card.className = 'tuning-card';
      const title = document.createElement('h4');
      title.textContent = AXIS_LABELS[index];
      card.appendChild(title);

      const preview = document.createElement('span');
      preview.className = 'axis-preview';
      preview.textContent = 'nilai: 0.00';
      card.appendChild(preview);

      card.appendChild(
        this.buildRange('Deadzone', tuning.deadzone, 0, 0.5, 0.01, (value) => {
          tuning.deadzone = value;
          this.commit(profile);
        }),
      );
      card.appendChild(
        this.buildRange('Sensitivitas', tuning.sensitivity, 0.5, 2, 0.05, (value) => {
          tuning.sensitivity = value;
          this.commit(profile);
        }),
      );

      const curveRow = document.createElement('label');
      curveRow.className = 'tuning-row';
      curveRow.append('Kurva');
      const select = document.createElement('select');
      for (const value of ['linear', 'exponential'] as const) {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = value === 'linear' ? 'Linear' : 'Eksponensial';
        option.selected = tuning.curve === value;
        select.appendChild(option);
      }
      select.addEventListener('change', () => {
        tuning.curve = select.value === 'exponential' ? 'exponential' : 'linear';
        this.commit(profile);
      });
      curveRow.appendChild(select);
      card.appendChild(curveRow);

      card.appendChild(
        this.buildCheckbox('Invert', tuning.invert, (checked) => {
          tuning.invert = checked;
          this.commit(profile);
        }),
      );

      this.tuningEl.appendChild(card);
    }
  }

  private buildRange(
    labelText: string,
    value: number,
    min: number,
    max: number,
    step: number,
    onCommit: (value: number) => void,
  ): HTMLElement {
    const row = document.createElement('label');
    row.className = 'tuning-row';
    const label = document.createElement('span');
    label.textContent = labelText;
    const input = document.createElement('input');
    input.type = 'range';
    input.min = String(min);
    input.max = String(max);
    input.step = String(step);
    input.value = String(value);
    const readout = document.createElement('output');
    readout.textContent = value.toFixed(2);
    input.addEventListener('input', () => {
      readout.textContent = Number(input.value).toFixed(2);
    });
    input.addEventListener('change', () => onCommit(Number(input.value)));
    row.append(label, input, readout);
    return row;
  }

  private buildCheckbox(
    labelText: string,
    checked: boolean,
    onCommit: (checked: boolean) => void,
  ): HTMLElement {
    const row = document.createElement('label');
    row.className = 'tuning-row tuning-check';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = checked;
    input.addEventListener('change', () => onCommit(input.checked));
    row.append(input, labelText);
    return row;
  }

  private refreshStatus(): void {
    const pad = this.input.padInfo;
    if (pad.connected) {
      const standard = pad.mapping === 'standard' ? 'standar' : 'non-standar';
      this.padEl.textContent = `Gamepad: ${pad.id} (${standard})`;
      this.padEl.classList.toggle('warn', pad.mapping !== 'standard');
    } else {
      this.padEl.textContent = 'Gamepad belum terdeteksi — keyboard tetap aktif';
      this.padEl.classList.remove('warn');
    }

    const values = this.input.snapshot();
    const active: string[] = [];
    for (const [action, value] of values) {
      if (Math.abs(value) > 0.25) {
        const text = isAnalogAction(action) ? `${ACTION_LABELS[action]} ${value.toFixed(2)}` : ACTION_LABELS[action];
        active.push(text);
      }
    }
    this.liveEl.textContent = active.length > 0
      ? `Input aktif: ${active.slice(0, 6).join(' · ')}`
      : 'Input aktif: —';

    const { profile } = this.currentTarget();
    const conflicts = conflictsToText(profile);
    this.conflictEl.textContent = conflicts.length
      ? `Konflik pemetaan: ${conflicts.join(' | ')}`
      : '';
    this.refreshAxisPreview(profile);
  }

  private refreshAxisPreview(profile: InputProfile): void {
    if (this.tab === 'keyboard') return;
    const pad = pickGamepad();
    if (!pad) return;
    const previews = this.tuningEl.querySelectorAll<HTMLElement>('.tuning-card');
    previews.forEach((card, index) => {
      const readout = card.querySelector<HTMLElement>('.axis-preview');
      const tuning = profile.axes[String(index)] ?? defaultAxisTuning();
      const value = tuneAxis(pad.axes[index] ?? 0, tuning);
      if (readout) {
        readout.textContent = `nilai: ${value.toFixed(2)}`;
      }
    });
  }

  private downloadProfile(): void {
    const { profile } = this.currentTarget();
    const blob = new Blob([exportProfile(profile)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `jrcsim-profil-${this.tab}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  private async importFromFile(file: File): Promise<void> {
    const text = await file.text();
    const profile = importProfile(text);
    if (!profile) {
      this.conflictEl.textContent = 'File profil tidak valid.';
      return;
    }
    const target = this.currentTarget();
    updateProfile(target.profileId, profile);
    if (this.tab === 'keyboard') {
      this.input.setKeyboardProfile(profile);
    } else {
      this.input.setGamepadProfile(profile);
    }
    this.onProfileChange();
    this.render();
  }

  private require<T extends HTMLElement = HTMLElement>(selector: string, root: ParentNode = this.element): T {
    const element = root.querySelector<T>(selector);
    if (!element) {
      throw new Error(`Elemen ${selector} tidak ditemukan di panel pengaturan`);
    }
    return element;
  }
}
