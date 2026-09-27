/**
 * Hints.ts — indices visuels d'inactivité, sans jamais punir.
 *
 * Docs/tasks Phase 7 : après 90 s sans interaction, une lueur désigne
 * discrètement l'élément utile ; après 180 s, Borz regarde dans la bonne
 * direction. Toute interaction réinitialise les minuteries et efface l'indice
 * en 900 ms. Un indice demandé explicitement (touche H, appui long) passe au
 * palier suivant immédiatement.
 *
 * La classe ne sait pas *quoi* désigner : on lui fournit deux callbacks
 * (lueur, regard) et le candidat est choisi par le runtime du niveau. Elle ne
 * décide que du *quand* — c'est du rythme, pas du gameplay.
 */
import { PACING } from '@/config';

export type HintStage = 'none' | 'glow' | 'gaze';

export interface HintCallbacks {
  /** Palier de lueur atteint / quitté. `stage` ne redescend jamais seul. */
  readonly onStage: (stage: HintStage) => void;
}

export class Hints {
  private idleMs = 0;
  private stage: HintStage = 'none';

  constructor(
    private readonly callbacks: HintCallbacks,
    private readonly glowDelayMs: number = PACING.hintGlowDelayMs,
    private readonly gazeDelayMs: number = PACING.hintGazeDelayMs,
  ) {}

  get currentStage(): HintStage {
    return this.stage;
  }

  /** Toute interaction du joueur repart de zéro. */
  notifyActivity(): void {
    this.idleMs = 0;
    if (this.stage !== 'none') {
      this.stage = 'none';
      this.callbacks.onStage('none');
    }
  }

  /** Indice demandé (touche H, appui long sur Borz) : palier suivant. */
  request(): HintStage {
    const next: HintStage = this.stage === 'none' ? 'glow' : 'gaze';
    this.stage = next;
    // Le palier demandé reste affiché un temps, puis se dissout : le joueur
    // qui demande a déjà regardé ailleurs.
    this.idleMs = 0;
    this.callbacks.onStage(next);
    return next;
  }

  /** À appeler chaque image. `deltaMs` borné par la boucle de jeu. */
  update(deltaMs: number): void {
    if (this.stage === 'gaze') return;
    this.idleMs += deltaMs;
    if (this.stage === 'none' && this.idleMs >= this.glowDelayMs) {
      this.stage = 'glow';
      this.callbacks.onStage('glow');
    } else if (this.stage === 'glow' && this.idleMs >= this.gazeDelayMs) {
      this.stage = 'gaze';
      this.callbacks.onStage('gaze');
    }
  }

  dispose(): void {
    this.idleMs = 0;
    this.stage = 'none';
  }
}
