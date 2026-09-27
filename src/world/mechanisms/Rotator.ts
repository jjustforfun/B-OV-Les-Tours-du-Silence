/**
 * Rotator.ts — plateforme ou passerelle qui pivote autour d'un axe.
 *
 * Statut : squelette. Le mécanisme le plus fondamental : le joueur fait
 * tourner un fragment d'architecture pour aligner deux chemins. La rotation
 * est toujours par pas de 90° et se termine parfaitement alignée sur la
 * grille — jamais d'angle intermédiaire persistant.
 */
import { Group, type Object3D } from 'three';
import { BaseMechanism } from './Mechanism';
import type { NavGraph } from '../NavGraph';

export type RotatorAxis = 'x' | 'y' | 'z';

export interface RotatorOptions {
  readonly axis?: RotatorAxis;
  readonly stepDeg?: number;
  readonly steps?: number;
}

export class Rotator extends BaseMechanism {
  readonly root: Object3D = new Group();

  private step = 0;

  constructor(
    id: string,
    private readonly options: RotatorOptions = {},
  ) {
    super(id);
    this.root.name = `Rotator:${id}`;
  }

  get currentStep(): number {
    return this.step;
  }

  actuate(amount = 1): void {
    if (!this.interactive) return;
    const steps = this.options.steps ?? 4;
    this.step = (this.step + Math.round(amount)) % steps;
    // TODO(phase Mécanismes) : tween GSAP sur root.rotation, easeStone,
    // puis applyToGraph() et son de pierre à l'arrivée.
  }

  applyToGraph(_graph: NavGraph): void {
    // TODO(phase Mécanismes) : activer/couper les arêtes selon this.step.
  }
}
