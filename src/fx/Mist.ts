/**
 * Mist.ts — la brume des gorges.
 *
 * Statut : squelette. L'effet le plus important du jeu pour l'ambiance :
 * c'est elle qui donne l'échelle, sépare les plans et fait « respirer »
 * l'image. Implémentation visée : 2 ou 3 quads très larges, texture de bruit
 * défilant très lentement (shaders/mist.glsl), jamais de particules.
 */
import { Group } from 'three';

export interface MistOptions {
  readonly layers?: number;
  readonly density?: number;
  readonly color?: number;
}

export class Mist {
  readonly root = new Group();

  constructor(private readonly options: MistOptions = {}) {
    this.root.name = 'Mist';
  }

  get density(): number {
    return this.options.density ?? 0.5;
  }

  update(_elapsed: number): void {
    // TODO(phase FX) : avancer uTime sur les matériaux de couche.
  }

  dispose(): void {
    this.root.removeFromParent();
    this.root.clear();
  }
}
