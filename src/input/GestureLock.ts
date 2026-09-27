/**
 * GestureLock.ts — verrou des gestes navigateur sur le canvas.
 *
 * Sur mobile, le navigateur revendique un certain nombre de gestes : zoom par
 * pincement, double-tap zoom, pull-to-refresh, défilement élastique, zoom
 * molette. Pour un jeu contemplatif au cadrage composé (ADR-002), aucun de
 * ces gestes ne doit jamais se produire : « Pincer, double-tap, molette →
 * rien du tout » (docs/CONTROLS.md § 1).
 *
 * Le CSS (`touch-action: none`, `overscroll-behavior`, `user-scalable=no`)
 * couvre l'essentiel ; cette classe verrouille ce que le CSS ne peut pas :
 * `touchmove` non passif, gestes iOS (`gesturestart` et compagnie), molette
 * avec Ctrl (pinch-zoom trackpad) et double-clic. Tout est limité au canvas :
 * l'UI garde ses gestes normaux pour les panneaux défilants.
 */

export interface GestureLockTarget {
  addEventListener(
    type: string,
    listener: (event: Event) => void,
    options?: AddEventListenerOptions,
  ): void;
  removeEventListener(
    type: string,
    listener: (event: Event) => void,
    options?: EventListenerOptions,
  ): void;
}

/** Écouteurs posés en `{ passive: false }` pour pouvoir appeler preventDefault. */
const BLOCKING_OPTIONS: AddEventListenerOptions = { passive: false };
/** Écouteurs « capturants » pour voir les gestes iOS avant le navigateur. */
const CAPTURE_OPTIONS: AddEventListenerOptions = { passive: false, capture: true };

export class GestureLock {
  constructor(private readonly element: GestureLockTarget) {
    this.element.addEventListener('touchstart', this.blockIfOnCanvas, BLOCKING_OPTIONS);
    this.element.addEventListener('touchmove', this.blockIfOnCanvas, BLOCKING_OPTIONS);
    // iOS Safari : pinch et zoom ne passent pas par touch events.
    this.element.addEventListener('gesturestart', this.blockAlways, CAPTURE_OPTIONS);
    this.element.addEventListener('gesturechange', this.blockAlways, CAPTURE_OPTIONS);
    this.element.addEventListener('gestureend', this.blockAlways, CAPTURE_OPTIONS);
    // Molette : le jeu ne zoome pas ; Ctrl+molette (trackpad) non plus.
    this.element.addEventListener('wheel', this.blockAlways, BLOCKING_OPTIONS);
    // Double-tap / double-clic zoom.
    this.element.addEventListener('dblclick', this.blockAlways, BLOCKING_OPTIONS);
  }

  dispose(): void {
    this.element.removeEventListener('touchstart', this.blockIfOnCanvas, BLOCKING_OPTIONS);
    this.element.removeEventListener('touchmove', this.blockIfOnCanvas, BLOCKING_OPTIONS);
    this.element.removeEventListener('gesturestart', this.blockAlways, CAPTURE_OPTIONS);
    this.element.removeEventListener('gesturechange', this.blockAlways, CAPTURE_OPTIONS);
    this.element.removeEventListener('gestureend', this.blockAlways, CAPTURE_OPTIONS);
    this.element.removeEventListener('wheel', this.blockAlways, BLOCKING_OPTIONS);
    this.element.removeEventListener('dblclick', this.blockAlways, BLOCKING_OPTIONS);
  }

  /**
   * Bloque les événements tactiles qui atteignent le canvas — mais laisse
   * vivre ceux de l'UI (panneaux défilants) qui remontent jusqu'à window.
   */
  private readonly blockIfOnCanvas = (event: Event): void => {
    if (event.target === this.element) event.preventDefault();
  };

  private readonly blockAlways = (event: Event): void => {
    event.preventDefault();
  };
}
