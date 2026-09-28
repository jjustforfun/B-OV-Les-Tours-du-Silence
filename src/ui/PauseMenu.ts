/**
 * PauseMenu.ts — la pause.
 *
 * Cinq entrées, pas plus : Reprendre, Recommencer le chapitre, Réglages,
 * Recueil, Retour au titre. Pas de « Quitter » : on ne quitte pas un lieu où l'on est invité.
 * Le monde reste visible derrière, immobile — la simulation est gelée, jamais
 * le rendu (docs/GDD.md), sur un voile de verre qui assombrit sans cacher.
 */
import { i18n } from '@i18n/i18n';
import { el, type UIPanel } from './UIRoot';

export interface PauseMenuOptions {
  readonly onResume: () => void;
  readonly onRestart: () => void;
  readonly onSettings: () => void;
  readonly onProverbs: () => void;
  /** Repartir vers l'écran titre (la sauvegarde est déjà faite). */
  readonly onBackToTitle: () => void;
}

interface PauseEntry {
  readonly button: HTMLButtonElement;
  readonly labelKey: string;
}

export class PauseMenu implements UIPanel {
  readonly element: HTMLElement;

  private readonly entries: PauseEntry[] = [];
  private readonly titleNode: HTMLElement;

  constructor(options: PauseMenuOptions) {
    this.element = el('section', 'ui-panel ui-pause is-hidden');
    this.element.setAttribute('role', 'dialog');
    this.element.setAttribute('aria-modal', 'true');
    this.element.setAttribute('aria-labelledby', 'ui-pause-title');

    const card = el('div', 'ui-card ui-pause__card');
    this.titleNode = el('h2', 'ui-pause__title', i18n.t('ui.paused'));
    this.titleNode.id = 'ui-pause-title';
    const list = el('div', 'ui-pause__list');

    const definitions: readonly (readonly [string, () => void])[] = [
      ['ui.resume', options.onResume],
      ['ui.restart', options.onRestart],
      ['ui.settings', options.onSettings],
      ['ui.proverbs', options.onProverbs],
      ['ui.backToTitle', options.onBackToTitle],
    ];
    for (const [labelKey, handler] of definitions) {
      const button = el('button', 'ui-menu__item', i18n.t(labelKey));
      button.type = 'button';
      button.addEventListener('click', handler);
      list.appendChild(button);
      this.entries.push({ button, labelKey });
    }

    card.append(this.titleNode, list);
    this.element.appendChild(card);
  }

  /** Réétiquette après un changement de langue. */
  refresh(): void {
    this.titleNode.textContent = i18n.t('ui.paused');
    for (const entry of this.entries) {
      entry.button.textContent = i18n.t(entry.labelKey);
    }
  }

  show(): void {
    this.refresh();
    this.element.classList.remove('is-hidden');
    const first = this.entries[0];
    first?.button.focus();
  }

  hide(): void {
    this.element.classList.add('is-hidden');
  }

  dispose(): void {
    this.element.remove();
  }
}
