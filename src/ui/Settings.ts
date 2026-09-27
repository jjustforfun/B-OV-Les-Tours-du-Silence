/**
 * Settings.ts — réglages.
 *
 * Statut : squelette. Volontairement court : volumes (musique, ambiance,
 * effets), qualité graphique (auto par défaut), vibrations, langue, et deux
 * options d'accessibilité — « animations réduites » et « contraste renforcé ».
 * Tout se sauvegarde immédiatement, sans bouton « Appliquer ».
 */
import { el, type UIPanel } from './UIRoot';
import type { QualityTier } from '@/config';

export interface SettingsState {
  music: number;
  ambience: number;
  sfx: number;
  quality: QualityTier | 'auto';
  haptics: boolean;
  reducedMotion: boolean;
  highContrast: boolean;
  locale: string;
}

export const DEFAULT_SETTINGS: SettingsState = {
  music: 0.7,
  ambience: 0.6,
  sfx: 0.85,
  quality: 'auto',
  haptics: true,
  reducedMotion: false,
  highContrast: false,
  locale: 'fr',
};

export class Settings implements UIPanel {
  readonly element: HTMLElement;

  private state: SettingsState = { ...DEFAULT_SETTINGS };

  constructor(private readonly onChange: (state: Readonly<SettingsState>) => void) {
    this.element = el('section', 'ui-panel ui-settings is-hidden');
    this.element.setAttribute('aria-label', 'Réglages');
    // TODO(phase UI) : construire les contrôles (sliders, interrupteurs, langues).
  }

  get current(): Readonly<SettingsState> {
    return this.state;
  }

  patch(partial: Partial<SettingsState>): void {
    this.state = { ...this.state, ...partial };
    this.onChange(this.state);
  }

  show(): void {
    this.element.classList.remove('is-hidden');
  }

  hide(): void {
    this.element.classList.add('is-hidden');
  }

  dispose(): void {
    this.element.remove();
  }
}
