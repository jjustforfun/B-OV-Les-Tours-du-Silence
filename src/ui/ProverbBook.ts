/**
 * ProverbBook.ts — le recueil de proverbes.
 *
 * Statut : squelette. La seule « collection » du jeu : chaque chapitre
 * terminé y ajoute un proverbe. On peut le rouvrir à tout moment. Il n'y a
 * ni pourcentage, ni case manquante mise en avant — rien qui transforme la
 * curiosité en obligation.
 */
import { el, type UIPanel } from './UIRoot';

export interface ProverbEntry {
  readonly key: string;
  readonly text: string;
  readonly virtue: string;
}

export class ProverbBook implements UIPanel {
  readonly element: HTMLElement;

  private readonly list: HTMLElement;

  constructor() {
    this.element = el('section', 'ui-panel ui-proverbs is-hidden');
    this.element.setAttribute('aria-label', 'Recueil de proverbes');
    this.list = el('ul', 'ui-proverbs__list');
    this.element.appendChild(this.list);
  }

  setEntries(entries: readonly ProverbEntry[]): void {
    this.list.replaceChildren();
    for (const entry of entries) {
      const item = el('li', 'ui-proverbs__item');
      item.append(
        el('p', 'ui-proverbs__text', entry.text),
        el('p', 'ui-proverbs__virtue', entry.virtue),
      );
      this.list.appendChild(item);
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
