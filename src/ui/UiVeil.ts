/**
 * UiVeil.ts — le voile noir des transitions de chapitre.
 *
 * Un simple rectangle plein écran dont l'opacité se fond sur
 * `PACING.chapterFadeMs` : on entre dans un chapitre et on en sort par le
 * noir, jamais par un cut. La promesse se résout quand le fondu est fini —
 * la composition peut charger le niveau pendant l'obscurité, le joueur ne
 * voit jamais la couture.
 *
 * Le voile ne capture jamais le pointeur : c'est un décor, pas un écran.
 */
import { PACING } from '@/config';
import { motionDurationScale } from '@core/motion';

export class UiVeil {
  readonly element: HTMLDivElement;

  constructor(parent: HTMLElement) {
    this.element = document.createElement('div');
    this.element.className = 'ui-veil';
    this.element.setAttribute('aria-hidden', 'true');
    parent.appendChild(this.element);
  }

  /** Le voile est-il déjà noir ? (amorce des transitions sans attente) */
  get isBlack(): boolean {
    return this.element.classList.contains('ui-veil--black');
  }

  /** Fond instantané, sans transition (amorçage du premier chapitre). */
  setInstant(black: boolean): void {
    this.element.style.transitionDuration = '0ms';
    this.element.classList.toggle('ui-veil--black', black);
    // Forcer le recompte pour que le prochain fondu parte de cet état.
    void this.element.offsetHeight;
    this.element.style.transitionDuration = '';
  }

  /** Fondu vers le noir. Se résout quand l'écran est entièrement sombre. */
  fadeToBlack(durationMs: number = PACING.chapterFadeMs): Promise<void> {
    return this.transition(true, durationMs);
  }

  /** Fondu depuis le noir vers la scène. */
  reveal(durationMs: number = PACING.chapterFadeMs): Promise<void> {
    return this.transition(false, durationMs);
  }

  dispose(): void {
    this.element.remove();
  }

  private transition(black: boolean, durationMs: number): Promise<void> {
    const effectiveDurationMs = durationMs * motionDurationScale();
    if (effectiveDurationMs <= 0) {
      this.setInstant(black);
      return Promise.resolve();
    }
    this.element.style.transitionDuration = `${effectiveDurationMs}ms`;
    this.element.classList.toggle('ui-veil--black', black);
    return new Promise((resolve) => {
      let settled = false;
      const done = (): void => {
        if (settled) return;
        settled = true;
        this.element.removeEventListener('transitionend', done);
        clearTimeout(fallback);
        this.element.style.transitionDuration = '';
        resolve();
      };
      // Filet de sécurité : si `transitionend` ne vient pas (onglet caché,
      // préférence de mouvement réduite qui tuerait la transition), on rend
      // la main au bout du temps prévu, jamais avant.
      const fallback = setTimeout(done, effectiveDurationMs + 60);
      this.element.addEventListener('transitionend', done, { once: true });
    });
  }
}
