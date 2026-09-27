/**
 * TitleScreen.ts — l'écran-titre.
 *
 * Pas de menu : la vallée en plan large vit derrière (scène 3D), le titre
 * apparaît en fondu, et un seul mot invite à commencer — « Toucher pour
 * commencer ». Toute la surface de l'écran est la porte d'entrée ; les
 * quelques entrées discrètes (Continuer, Chapitres, Réglages, Recueil)
 * vivent en bas, accessibles au clavier seul.
 *
 * Le premier geste du joueur démarre aussi le contexte audio (contrainte
 * d'autoplay) — voir AudioDirector.unlock.
 */
import { UI } from '@/config';
import { i18n } from '@i18n/i18n';
import { el, type UIPanel } from './UIRoot';

export interface TitleScreenOptions {
  /** Toucher l'écran, Entrée ou Espace : commencer / continuer la partie. */
  readonly onStart: () => void;
  readonly onChapters?: () => void;
  readonly onSettings?: () => void;
  readonly onProverbs?: () => void;
  /** Vrai si une partie existe (fait apparaître « Chapitres »). */
  readonly hasProgress: () => boolean;
}

export class TitleScreen implements UIPanel {
  readonly element: HTMLElement;

  private readonly options: TitleScreenOptions;
  private readonly startButton: HTMLButtonElement;
  private readonly menuButtons: HTMLButtonElement[] = [];
  private readonly menu: HTMLElement;

  constructor(options: TitleScreenOptions) {
    this.options = options;
    this.element = el('section', 'ui-panel ui-title');
    this.element.setAttribute('aria-label', 'BӀOV : Les Tours du Silence');

    // Voile doux : le texte ne flotte jamais directement sur la scène
    // (docs/ART_DIRECTION.md § 7) — mais la vallée reste la vedette.
    const scrim = el('div', 'ui-title__scrim');
    scrim.setAttribute('aria-hidden', 'true');

    const core = el('div', 'ui-title__core');
    const name = el('h1', 'ui-title__name', i18n.t('game.title'));
    const subtitle = el('p', 'ui-title__subtitle', i18n.t('game.subtitle'));
    core.append(name, subtitle);

    // Toute la surface est un bouton : « Toucher pour commencer ».
    this.startButton = el('button', 'ui-title__touch');
    this.startButton.type = 'button';
    this.startButton.textContent = i18n.t('ui.touchStart');
    this.startButton.addEventListener('click', () => this.options.onStart());

    this.menu = el('nav', 'ui-title__menu');
    this.menu.setAttribute('aria-label', i18n.t('game.title'));
    const entries: readonly (readonly [string, (() => void) | undefined])[] = [
      [i18n.t('ui.chapters'), options.onChapters],
      [i18n.t('ui.settings'), options.onSettings],
      [i18n.t('ui.proverbs'), options.onProverbs],
    ];
    for (const [label, handler] of entries) {
      const button = el('button', 'ui-title__menu-item', label);
      button.type = 'button';
      if (handler !== undefined) button.addEventListener('click', handler);
      this.menu.appendChild(button);
      this.menuButtons.push(button);
    }

    this.element.append(scrim, core, this.startButton, this.menu);
    this.element.style.setProperty('--title-delay', `${UI.titleDelayMs}ms`);
  }

  /** Réétiquette après un changement de langue (i18n.onChange). */
  refresh(): void {
    this.startButton.textContent = i18n.t('ui.touchStart');
    this.element.setAttribute('aria-label', `${i18n.t('game.title')} — ${i18n.t('game.subtitle')}`);
    this.menu.setAttribute('aria-label', i18n.t('game.title'));
    const labels = [i18n.t('ui.chapters'), i18n.t('ui.settings'), i18n.t('ui.proverbs')];
    for (let i = 0; i < this.menuButtons.length; i += 1) {
      const button = this.menuButtons[i];
      const label = labels[i];
      if (button !== undefined && label !== undefined) button.textContent = label;
    }
    // « Chapitres » n'a de sens qu'avec une progression.
    const chaptersItem = this.menuButtons[0];
    if (chaptersItem !== undefined) {
      chaptersItem.classList.toggle('is-hidden', !this.options.hasProgress());
    }
  }

  show(): void {
    this.refresh();
    this.element.classList.remove('is-hidden');
    this.startButton.focus();
  }

  hide(): void {
    this.element.classList.add('is-hidden');
  }

  dispose(): void {
    this.element.remove();
  }
}
