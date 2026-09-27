/**
 * Toast.ts — messages éphémères.
 *
 * Statut : squelette fonctionnel. Réservé aux informations neutres
 * (« Progression enregistrée », « Hors ligne : le jeu reste jouable »).
 * Jamais utilisé pour féliciter : la célébration appartient au monde 3D.
 */
import { el, type UIPanel } from './UIRoot';

export class Toast implements UIPanel {
  readonly element: HTMLElement;

  private timer: number | null = null;

  constructor() {
    this.element = el('output', 'ui-toast is-hidden');
    this.element.setAttribute('aria-live', 'polite');
  }

  notify(message: string, durationMs = 2600): void {
    this.element.textContent = message;
    this.show();
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = window.setTimeout(() => this.hide(), durationMs);
  }

  show(): void {
    this.element.classList.remove('is-hidden');
  }

  hide(): void {
    this.element.classList.add('is-hidden');
  }

  dispose(): void {
    if (this.timer !== null) clearTimeout(this.timer);
    this.element.remove();
  }
}
