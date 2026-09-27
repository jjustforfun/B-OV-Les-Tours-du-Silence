/**
 * TurpalAnimator.ts — façade d'animation de Turpal.
 *
 * Le modèle procédural possède déjà ses clips et ses fondus ; cette classe
 * isole le gameplay de cette implémentation. Quand Turpal passera en GLB, la
 * façade pilotera des `AnimationAction` three.js sans changer `Turpal.ts`.
 */
import type { CharacterClip, ICharacterModel } from '@entities/ICharacterModel';
import { TURPAL } from '@/config';

export type TurpalClip = CharacterClip;

export class TurpalAnimator {
  private currentClip: TurpalClip = 'idle';

  constructor(private readonly model: ICharacterModel) {}

  get clip(): TurpalClip {
    return this.currentClip;
  }

  play(clip: TurpalClip, fadeSeconds = TURPAL.animationBlendMs / 1000): void {
    if (clip === this.currentClip) return;
    this.currentClip = clip;
    this.model.play(clip, fadeSeconds);
  }

  update(delta: number): void {
    this.model.update(delta);
  }

  dispose(): void {
    this.model.dispose();
  }
}
