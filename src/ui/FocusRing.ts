/**
 * FocusRing.ts — contour braise du mécanisme sélectionné au clavier.
 *
 * Docs/CONTROLS.md § 2.3 : `Tab` cycle entre les mécanismes par proximité
 * écran ; le sélectionné reçoit un **contour braise de 2 px** et une
 * pulsation à 0,5 Hz — la même affordance que le survol souris, donc rien à
 * réapprendre.
 *
 * Implémenté en DOM plutôt qu'en 3D : un liseré de 2 px CSS est net sur tous
 * les DPR, gratuit en draw calls, et respecte `prefers-reduced-motion` par
 * une simple classe CSS (pas de pulsation).
 */
import { el } from './UIRoot';

const PULSE_CLASS = 'ui-focus-ring--pulse';

export class FocusRing {
  readonly element: HTMLElement;

  private visible = false;

  constructor(parent: HTMLElement = document.body) {
    this.element = el('div', 'ui-focus-ring');
    this.element.setAttribute('aria-hidden', 'true');
    this.element.style.display = 'none';
    parent.appendChild(this.element);
  }

  get isVisible(): boolean {
    return this.visible;
  }

  /**
   * Place l'anneau sur un mécanisme projeté à l'écran.
   * `radius` = rayon écran de la poignée, en pixels CSS.
   */
  show(x: number, y: number, radius: number): void {
    this.visible = true;
    this.element.style.display = 'block';
    this.move(x, y, radius);
  }

  move(x: number, y: number, radius: number): void {
    if (!this.visible) return;
    const size = Math.max(28, radius * 2 + 18);
    this.element.style.width = `${size}px`;
    this.element.style.height = `${size}px`;
    this.element.style.transform = `translate(${x - size / 2}px, ${y - size / 2}px)`;
  }

  hide(): void {
    this.visible = false;
    this.element.style.display = 'none';
  }

  /** Pulsation 0,5 Hz — désactivée quand le mouvement est réduit. */
  setPulsing(enabled: boolean): void {
    this.element.classList.toggle(PULSE_CLASS, enabled);
  }

  dispose(): void {
    this.element.remove();
  }
}
