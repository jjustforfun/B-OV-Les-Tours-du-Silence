/**
 * LightShafts.ts — rais de lumière traversant la brume.
 *
 * Statut : squelette. Le geste artistique signature des moments de grâce :
 * quand un chapitre se résout, la lumière trouve un passage entre les tours.
 * Implémentation visée : cônes additifs à faces arrière, pas de volumétrique
 * (impossible à 60 fps sur mobile milieu de gamme).
 */
import { Group } from 'three';

export interface LightShaftOptions {
  readonly count?: number;
  readonly intensity?: number;
  readonly color?: number;
}

export class LightShafts {
  readonly root = new Group();

  constructor(private readonly options: LightShaftOptions = {}) {
    this.root.name = 'LightShafts';
  }

  get intensity(): number {
    return this.options.intensity ?? 0.6;
  }

  /** Fait naître les rais progressivement (utilisé à la résolution d'un niveau). */
  reveal(_durationSeconds = 2.5): void {
    // TODO(phase FX) : rampe d'opacité + rotation très lente.
  }

  dispose(): void {
    this.root.removeFromParent();
    this.root.clear();
  }
}
