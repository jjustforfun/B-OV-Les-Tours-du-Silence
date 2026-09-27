/**
 * TitleScreen.ts — écran-titre.
 *
 * Statut : squelette. Intention : pas de menu. Le titre apparaît sur une
 * scène jouable (une tour dans la brume), et un seul mot invite à commencer.
 * Les réglages sont accessibles mais discrets. Le premier geste du joueur
 * démarre aussi le contexte audio (contrainte d'autoplay).
 */
import { el, type UIPanel } from './UIRoot';

export interface TitleScreenOptions {
  readonly onStart: () => void;
  readonly onSettings?: () => void;
}

export class TitleScreen implements UIPanel {
  readonly element: HTMLElement;

  constructor(private readonly options: TitleScreenOptions) {
    this.element = el('section', 'ui-panel ui-title');
    this.element.setAttribute('aria-label', 'Écran titre');

    const title = el('h1', 'ui-title__name', 'BӀOV');
    const subtitle = el('p', 'ui-title__subtitle', 'Les Tours du Silence');
    const start = el('button', 'ui-title__start', 'Commencer');
    start.type = 'button';
    start.addEventListener('click', () => this.options.onStart());

    this.element.append(title, subtitle, start);
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
