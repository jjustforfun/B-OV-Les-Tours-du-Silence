/**
 * PauseMenu.ts — pause.
 *
 * Statut : squelette. Trois entrées, pas plus : Reprendre, Réglages,
 * Recommencer le chapitre. Pas de « Quitter » : on ne quitte pas un lieu
 * où l'on est invité. Le monde reste visible derrière, simplement ralenti
 * et désaturé.
 */
import { el, type UIPanel } from './UIRoot';

export interface PauseMenuOptions {
  readonly onResume: () => void;
  readonly onSettings: () => void;
  readonly onRestart: () => void;
}

export class PauseMenu implements UIPanel {
  readonly element: HTMLElement;

  constructor(options: PauseMenuOptions) {
    this.element = el('section', 'ui-panel ui-pause is-hidden');
    this.element.setAttribute('role', 'dialog');
    this.element.setAttribute('aria-modal', 'true');

    const entries: readonly (readonly [string, () => void])[] = [
      ['Reprendre', options.onResume],
      ['Réglages', options.onSettings],
      ['Recommencer le chapitre', options.onRestart],
    ];

    for (const [label, handler] of entries) {
      const button = el('button', 'ui-pause__item', label);
      button.type = 'button';
      button.addEventListener('click', handler);
      this.element.appendChild(button);
    }
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
