/**
 * Settings.ts — les réglages.
 *
 * Volontairement court à lire : Son (quatre curseurs), Affichage (qualité,
 * langue), Accessibilité (mouvement, taille du texte, contraste, vibrations)
 * et Touches (remappage complet). Tout s'applique et se sauvegarde
 * immédiatement — jamais de bouton « Appliquer ».
 *
 * Le panneau ne décide rien : il lit l'état via `getState` et rapporte les
 * changements via `onChange` ; la composition (GameFlow) applique les effets
 * et persiste. Le remappage capture les **codes physiques** (ADR-023), rend
 * la touche à son ancienne action sans ambiguïté et signale les conflits.
 *
 * Tous les libellés passent par un registre `(nœud, clé i18n)` : changer de
 * langue réétiquette l'écran entier sans le reconstruire.
 */
import { LOCALES, LOCALE_NAMES, i18n, type Locale } from '@i18n/i18n';
import { INPUT_ACTIONS, type InputAction } from '@input/InputManager';
import { keyLabel } from '@input/KeyboardInput';
import type { QualityTier } from '@/config';
import { el, type UIPanel } from './UIRoot';

export type QualityChoice = 'auto' | QualityTier;
export type MotionChoice = 'auto' | 'reduced' | 'full';
export type FontScaleChoice = 'small' | 'normal' | 'large';
export type VolumeChannel = 'master' | 'music' | 'ambience' | 'sfx';

export interface UiSettingsState {
  readonly volumes: Readonly<Record<VolumeChannel, number>>;
  readonly quality: QualityChoice;
  readonly locale: Locale;
  readonly reducedMotion: MotionChoice;
  readonly fontScale: FontScaleChoice;
  readonly highContrast: boolean;
  readonly subtitles: boolean;
  readonly haptics: boolean;
}

export interface SettingsPanelOptions {
  readonly getState: () => UiSettingsState;
  readonly getBindings: () => Readonly<Record<string, InputAction>>;
  readonly onChange: (partial: Partial<UiSettingsState>) => void;
  readonly onBindingsChange: (bindings: Readonly<Record<string, InputAction>>) => void;
  readonly onResetBindings: () => void;
  readonly onClose: () => void;
}

const VOLUME_CHANNELS: readonly VolumeChannel[] = ['master', 'music', 'ambience', 'sfx'];
const QUALITY_CHOICES: readonly QualityChoice[] = ['auto', 'low', 'medium', 'high'];
const MOTION_CHOICES: readonly MotionChoice[] = ['auto', 'reduced', 'full'];
const FONT_CHOICES: readonly FontScaleChoice[] = ['small', 'normal', 'large'];

/** Touches qui ne veulent rien dire seules : jamais assignables. */
const UNBINDABLE_CODE = /^(Shift|Control|Alt|Meta|Fn|OS|Caps|Num|Scroll|Pause)/;

interface TextBinding {
  readonly node: HTMLElement;
  readonly key: string;
}

interface VolumeRow {
  readonly channel: VolumeChannel;
  readonly slider: HTMLInputElement;
  readonly readout: HTMLElement;
}

interface RemapRow {
  readonly action: InputAction;
  readonly button: HTMLButtonElement;
  readonly keysNode: HTMLElement;
}

export class Settings implements UIPanel {
  readonly element: HTMLElement;

  private readonly options: SettingsPanelOptions;
  private readonly textBindings: TextBinding[] = [];
  private readonly volumeRows: VolumeRow[] = [];
  private readonly selects: HTMLSelectElement[] = [];
  private readonly selectChoices: (readonly string[])[] = [];
  private readonly selectLabelers: ((choice: string) => string)[] = [];
  private readonly toggles: HTMLInputElement[] = [];
  private readonly remapRows: RemapRow[] = [];
  private readonly remapHint: HTMLElement = el('p', 'ui-settings__hint');
  private readonly conflictNode: HTMLElement = el('p', 'ui-settings__conflict is-hidden');
  private readonly resetButton: HTMLButtonElement;
  private readonly closeButton: HTMLButtonElement;
  private captureTarget: InputAction | null = null;

  constructor(options: SettingsPanelOptions) {
    this.options = options;
    this.element = el('section', 'ui-panel ui-settings is-hidden');
    this.element.setAttribute('role', 'dialog');
    this.element.setAttribute('aria-modal', 'true');

    const card = el('div', 'ui-card ui-settings__card');
    const scroller = el('div', 'ui-settings__scroller');

    this.closeButton = el('button', 'ui-settings__close');
    this.closeButton.type = 'button';
    this.closeButton.addEventListener('click', () => this.options.onClose());

    // ——— Son : quatre curseurs, application immédiate.
    const soundBody = el('div', 'ui-settings__section-body');
    for (const channel of VOLUME_CHANNELS) {
      const labelKey = channel === 'master' ? 'settings.master' : `settings.${channel}`;
      const row = el('div', 'ui-settings__row');
      const label = el('label', 'ui-settings__label');
      const slider = document.createElement('input');
      slider.className = 'ui-settings__slider';
      slider.type = 'range';
      slider.min = '0';
      slider.max = '1';
      slider.step = '0.05';
      slider.id = `ui-volume-${channel}`;
      label.setAttribute('for', slider.id);
      const readout = el('span', 'ui-settings__readout');
      slider.addEventListener('input', () => {
        const value = Number(slider.value);
        const state = this.options.getState();
        this.options.onChange({ volumes: { ...state.volumes, [channel]: value } });
      });
      this.textBindings.push({ node: label, key: labelKey }, { node: slider, key: labelKey });
      row.append(label, slider, readout);
      soundBody.appendChild(row);
      this.volumeRows.push({ channel, slider, readout });
    }
    this.attachSection(scroller, 'settings.audio', soundBody);

    // ——— Affichage : qualité (fige l'adaptation, ADR-013) et langue.
    const displayBody = el('div', 'ui-settings__section-body');
    const qualitySelect = this.buildSelect(QUALITY_CHOICES, qualityLabel, (choice) =>
      this.options.onChange({ quality: choice }),
    );
    const localeSelect = this.buildSelect(
      LOCALES,
      (locale) => LOCALE_NAMES[locale],
      (locale) => this.options.onChange({ locale }),
    );
    displayBody.append(
      this.wrapRow('settings.quality', qualitySelect),
      this.wrapRow('settings.language', localeSelect),
    );
    this.attachSection(scroller, 'settings.quality', displayBody);

    // ——— Accessibilité : mouvement, texte, contraste, vibrations.
    const a11yBody = el('div', 'ui-settings__section-body');
    const motionSelect = this.buildSelect(
      MOTION_CHOICES,
      (choice) => i18n.t(`settings.reducedMotion.${choice}`),
      (choice) => this.options.onChange({ reducedMotion: choice }),
    );
    const fontSelect = this.buildSelect(
      FONT_CHOICES,
      (choice) => i18n.t(`settings.textSize.${choice}`),
      (choice) => this.options.onChange({ fontScale: choice }),
    );
    const contrastToggle = this.buildToggle('settings.highContrast', (checked) =>
      this.options.onChange({ highContrast: checked }),
    );
    const subtitlesToggle = this.buildToggle('settings.subtitles', (checked) =>
      this.options.onChange({ subtitles: checked }),
    );
    const hapticsToggle = this.buildToggle('settings.haptics', (checked) =>
      this.options.onChange({ haptics: checked }),
    );
    a11yBody.append(
      this.wrapRow('settings.reducedMotion', motionSelect),
      this.wrapRow('settings.textSize', fontSelect),
      contrastToggle,
      subtitlesToggle,
      hapticsToggle,
    );
    this.attachSection(scroller, 'settings.accessibility', a11yBody);

    // ——— Touches : remappage complet, capture de code physique.
    const keysBody = el('div', 'ui-settings__section-body');
    this.remapHint.textContent = i18n.t('settings.keys.hint');
    this.conflictNode.setAttribute('role', 'alert');
    keysBody.append(this.remapHint, this.conflictNode);

    const keyList = el('div', 'ui-settings__keys');
    for (const action of INPUT_ACTIONS) {
      const button = el('button', 'ui-settings__keybutton');
      button.type = 'button';
      button.addEventListener('click', () => this.beginCapture(action));
      const labelNode = el('span', 'ui-settings__label');
      this.textBindings.push({ node: labelNode, key: `actions.${action}` });
      const keysNode = el('span', 'ui-settings__keys-value');
      button.append(labelNode, keysNode);
      keyList.appendChild(button);
      this.remapRows.push({ action, button, keysNode });
    }
    keysBody.appendChild(keyList);

    this.resetButton = el('button', 'ui-menu__item ui-settings__reset');
    this.resetButton.type = 'button';
    this.resetButton.addEventListener('click', () => this.options.onResetBindings());
    this.textBindings.push({ node: this.resetButton, key: 'settings.keys.reset' });
    keysBody.appendChild(this.resetButton);
    this.attachSection(scroller, 'settings.keys', keysBody);

    this.textBindings.push({ node: this.closeButton, key: 'ui.close' });
    card.append(scroller, this.closeButton);
    this.element.appendChild(card);
  }

  /** Réétiquette tout après un changement de langue, puis resynchronise. */
  refresh(): void {
    for (const binding of this.textBindings) {
      const text = i18n.t(binding.key);
      if (binding.node instanceof HTMLInputElement || binding.node instanceof HTMLSelectElement) {
        binding.node.setAttribute('aria-label', text);
      } else {
        binding.node.textContent = text;
      }
    }
    for (let i = 0; i < this.selects.length; i += 1) {
      const select = this.selects[i];
      const choices = this.selectChoices[i];
      const labeler = this.selectLabelers[i];
      if (select === undefined || choices === undefined || labeler === undefined) continue;
      for (let j = 0; j < choices.length; j += 1) {
        const choice = choices[j];
        const option = select.options[j];
        if (choice !== undefined && option !== undefined) option.textContent = labeler(choice);
      }
    }
    this.remapHint.textContent = i18n.t(
      this.captureTarget === null ? 'settings.keys.hint' : 'settings.keys.capturing',
    );
    this.syncControls();
  }

  /** La pile lui donne chaque touche : seule la capture la consomme. */
  onKeydown(event: KeyboardEvent): void {
    if (this.captureTarget === null) return;
    event.preventDefault(); // y compris Échap, qui ici annule la capture
    if (event.key === 'Escape') {
      this.endCapture();
      return;
    }
    if (UNBINDABLE_CODE.test(event.code)) return;

    const action = this.captureTarget;
    const bindings = { ...this.options.getBindings() };
    const owner = bindings[event.code];
    if (owner !== undefined && owner !== action) {
      this.showConflict(owner);
      return;
    }
    this.hideConflict();
    // Une action, une touche : la nouvelle chasse l'ancienne partout ailleurs.
    for (const [code, bound] of Object.entries(bindings)) {
      if (code !== event.code && bound === action) delete bindings[code];
    }
    bindings[event.code] = action;
    this.options.onBindingsChange(bindings);
    this.endCapture();
  }

  show(): void {
    this.refresh();
    this.element.classList.remove('is-hidden');
    this.closeButton.focus();
  }

  hide(): void {
    this.element.classList.add('is-hidden');
    this.endCapture();
  }

  dispose(): void {
    this.element.remove();
  }

  // ————————————————————————————————— Construction

  private attachSection(parent: HTMLElement, titleKey: string, body: HTMLElement): void {
    const section = el('section', 'ui-settings__section');
    const heading = el('h3', 'ui-settings__heading');
    this.textBindings.push({ node: heading, key: titleKey });
    section.append(heading, body);
    parent.appendChild(section);
  }

  private buildSelect<C extends string>(
    choices: readonly C[],
    labelOf: (choice: C) => string,
    apply: (choice: C) => void,
  ): HTMLSelectElement {
    const select = document.createElement('select');
    select.className = 'ui-settings__select';
    for (const choice of choices) {
      const option = document.createElement('option');
      option.value = choice;
      option.textContent = labelOf(choice);
      select.appendChild(option);
    }
    select.addEventListener('change', () => {
      const choice = choices.find((candidate) => candidate === select.value);
      if (choice !== undefined) apply(choice);
    });
    this.selects.push(select);
    this.selectChoices.push(choices);
    this.selectLabelers.push((choice: string) => labelOf(choice as C));
    return select;
  }

  private wrapRow(labelKey: string, control: HTMLElement): HTMLElement {
    const row = el('div', 'ui-settings__row');
    const label = el('label', 'ui-settings__label');
    this.textBindings.push({ node: label, key: labelKey });
    row.append(label, control);
    return row;
  }

  private buildToggle(labelKey: string, apply: (checked: boolean) => void): HTMLElement {
    const row = el('div', 'ui-settings__row');
    const label = el('label', 'ui-settings__label');
    this.textBindings.push({ node: label, key: labelKey });
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.className = 'ui-settings__toggle';
    input.addEventListener('change', () => apply(input.checked));
    row.append(label, input);
    this.toggles.push(input);
    return row;
  }

  // ————————————————————————————————— Synchronisation

  private syncControls(): void {
    const state = this.options.getState();
    for (const row of this.volumeRows) {
      const value = state.volumes[row.channel];
      row.slider.value = String(value);
      row.readout.textContent = `${Math.round(value * 100)} %`;
    }
    if (this.selects[0] !== undefined) this.selects[0].value = state.quality;
    if (this.selects[1] !== undefined) this.selects[1].value = state.locale;
    if (this.selects[2] !== undefined) this.selects[2].value = state.reducedMotion;
    if (this.selects[3] !== undefined) this.selects[3].value = state.fontScale;
    const contrast = this.toggles[0];
    const subtitles = this.toggles[1];
    const haptics = this.toggles[2];
    if (contrast !== undefined) contrast.checked = state.highContrast;
    if (subtitles !== undefined) subtitles.checked = state.subtitles;
    if (haptics !== undefined) haptics.checked = state.haptics;
    this.syncKeyRows();
  }

  private syncKeyRows(): void {
    const bindings = this.options.getBindings();
    for (const remap of this.remapRows) {
      const codes = Object.entries(bindings)
        .filter(([, bound]) => bound === remap.action)
        .map(([code]) => code);
      // Libellé réel de la disposition (AZERTY…) — asynchrone, sans blocage.
      void Promise.all(codes.map((code) => keyLabel(code))).then((labels) => {
        if (remap.keysNode.isConnected) remap.keysNode.textContent = labels.join(' · ');
      });
      remap.button.classList.toggle('is-capturing', this.captureTarget === remap.action);
      remap.button.setAttribute(
        'aria-pressed',
        this.captureTarget === remap.action ? 'true' : 'false',
      );
    }
  }

  private beginCapture(action: InputAction): void {
    this.hideConflict();
    this.captureTarget = action;
    this.remapHint.textContent = i18n.t('settings.keys.capturing');
    this.syncKeyRows();
  }

  private endCapture(): void {
    if (this.captureTarget === null) return;
    this.captureTarget = null;
    this.remapHint.textContent = i18n.t('settings.keys.hint');
    this.syncKeyRows();
  }

  private showConflict(owner: InputAction): void {
    this.conflictNode.textContent = i18n.t('settings.keys.conflict', {
      action: i18n.t(`actions.${owner}`),
    });
    this.conflictNode.classList.remove('is-hidden');
  }

  private hideConflict(): void {
    this.conflictNode.classList.add('is-hidden');
  }
}

function qualityLabel(choice: QualityChoice): string {
  if (choice === 'auto') return i18n.t('settings.quality.auto');
  if (choice === 'low') return i18n.t('settings.quality.low');
  if (choice === 'medium') return i18n.t('settings.quality.medium');
  return i18n.t('settings.quality.high');
}
