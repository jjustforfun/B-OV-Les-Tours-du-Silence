/**
 * Celebrate.ts — micro-célébrations.
 *
 * Statut : squelette, mais c'est une pièce de game design centrale : le
 * joueur doit se sentir intelligent. Chaque réussite — même partielle —
 * déclenche une réponse du monde :
 *
 *  - mécanisme aligné  → onde de poussière + note de pondar + vibration 'snap' ;
 *  - passage découvert → la lumière monte d'un demi-ton pendant 2 s ;
 *  - chapitre résolu   → rais de lumière, envol d'oiseaux, proverbe.
 *
 * Règle : jamais de texte du type « Bravo ! ». Le monde félicite, pas l'interface.
 */
import type { Object3D } from 'three';
import { haptic } from '@input/Haptics';

export type CelebrationKind = 'align' | 'discover' | 'solve';

export interface CelebrationContext {
  /** Endroit du monde où la célébration se produit. */
  readonly at: Object3D;
}

export function celebrate(kind: CelebrationKind, _context: CelebrationContext): void {
  switch (kind) {
    case 'align':
      haptic('snap');
      break;
    case 'discover':
      haptic('tick');
      break;
    case 'solve':
      haptic('celebrate');
      break;
    default:
      break;
  }
  // TODO(phase FX) : timeline GSAP — poussière, lumière, son, léger zoom caméra.
}
