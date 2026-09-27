/**
 * Toast.ts — notifications discrètes.
 *
 * Une phrase, en bas de l'écran, sur son propre calque : jamais un blocant,
 * jamais un bouton à fermer. `aria-live="polite"` suffit — le lecteur
 * d'écran la dit sans voler le focus (WCAG 4.1.3).
 *
 * Un seul toast à la fois : le suivant remplace le précédent. Ce n'est pas
 * une file d'attente — trois messages empilés, c'est déjà un bandeau.
 */
import { UI } from '@/config';

export interface ToastOptions {
  /** Conteneur (défaut : body). Le toast vit sur son propre calque. */
  readonly container?: HTMLElement;
}

const LIVE_REGION_RECHECK_MS = 60;

export class Toast {
  readonly element: HTMLElement;

  private readonly textNode: HTMLElement;
  private hideTimer: ReturnType<typeof setTimeout> | null = null;
  private swapTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(options: ToastOptions = {}) {
    this.element = document.createElement('div');
    this.element.className = 'ui-toast is-hidden';
    this.element.setAttribute('aria-live', 'polite');
    this.element.setAttribute('aria-atomic', 'true');
    this.textNode = document.createElement('p');
    this.textNode.className = 'ui-toast__text';
    this.element.appendChild(this.textNode);
    (options.container ?? document.body).appendChild(this.element);
  }

  /** Affiche un message, remplace l'éventuel message courant. */
  show(text: string, durationMs?: number): void {
    if (this.hideTimer !== null) clearTimeout(this.hideTimer);
    if (this.swapTimer !== null) clearTimeout(this.swapTimer);

    // Changement de texte en deux temps : la région vive réannonce la nouveauté
    // même si le lecteur venait de lire l'ancienne.
    this.textNode.textContent = '';
    this.element.classList.remove('is-hidden');
    this.swapTimer = setTimeout(() => {
      this.textNode.textContent = text;
    }, LIVE_REGION_RECHECK_MS);

    this.hideTimer = setTimeout(() => this.hide(), durationMs ?? UI.toastMs);
  }

  hide(): void {
    if (this.hideTimer !== null) {
      clearTimeout(this.hideTimer);
      this.hideTimer = null;
    }
    if (this.swapTimer !== null) {
      clearTimeout(this.swapTimer);
      this.swapTimer = null;
    }
    this.element.classList.add('is-hidden');
    this.textNode.textContent = '';
  }

  dispose(): void {
    this.hide();
    this.element.remove();
  }
}
