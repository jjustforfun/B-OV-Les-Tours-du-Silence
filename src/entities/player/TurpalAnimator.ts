/**
 * TurpalAnimator.ts — pilotage des animations de Turpal.
 *
 * Statut : squelette. Le jeu de clips visé est court et volontairement
 * sobre : idle (respiration), idle_long (il regarde la vallée), walk,
 * step_up, contemplate (main sur le cœur — geste de respect), arrive.
 *
 * Règle d'animation : les transitions durent 250 à 400 ms. Turpal ne
 * « claque » jamais d'une pose à l'autre : sa dignité est dans la continuité.
 */
import { AnimationMixer, type Object3D } from 'three';

export type TurpalClip = 'idle' | 'idleLong' | 'walk' | 'stepUp' | 'contemplate' | 'arrive';

export class TurpalAnimator {
  private readonly mixer: AnimationMixer;
  private currentClip: TurpalClip = 'idle';

  constructor(target: Object3D) {
    this.mixer = new AnimationMixer(target);
  }

  get clip(): TurpalClip {
    return this.currentClip;
  }

  play(clip: TurpalClip, _fadeSeconds = 0.3): void {
    // TODO(phase Animation) : crossFadeTo sur les AnimationActions du glTF.
    this.currentClip = clip;
  }

  update(delta: number): void {
    this.mixer.update(delta);
  }

  dispose(): void {
    this.mixer.stopAllAction();
  }
}
