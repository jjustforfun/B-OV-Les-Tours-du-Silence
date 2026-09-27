/**
 * Slider.ts — bloc qui coulisse le long d'un rail, tiré au doigt.
 *
 * Statut : squelette. C'est le mécanisme « tactile » par excellence : le bloc
 * suit le doigt en direct, puis s'aimante sur la position de grille la plus
 * proche au relâchement. Cette réponse immédiate est ce qui rend le jeu
 * agréable au toucher ; elle sera testée sur mobile avant tout le reste.
 */
import { Group, type Object3D } from 'three';
import { BaseMechanism } from './Mechanism';
import type { NavGraph } from '../NavGraph';

export interface SliderOptions {
  readonly axis?: 'x' | 'y' | 'z';
  /** Course totale en cellules. */
  readonly travel?: number;
  /** Nombre de positions d'arrêt. */
  readonly stops?: number;
}

export class Slider extends BaseMechanism {
  readonly root: Object3D = new Group();

  private position = 0;

  constructor(
    id: string,
    private readonly options: SliderOptions = {},
  ) {
    super(id);
    this.root.name = `Slider:${id}`;
  }

  get normalizedPosition(): number {
    return this.position;
  }

  actuate(amount = 1): void {
    if (!this.interactive) return;
    const stops = Math.max(this.options.stops ?? 2, 2);
    this.position = Math.min(Math.max(this.position + amount / (stops - 1), 0), 1);
    // TODO(phase Mécanismes) : suivi du doigt en direct + aimantation au relâchement.
  }

  applyToGraph(_graph: NavGraph): void {
    // TODO(phase Mécanismes) : connecter le rail au reste du graphe selon la position.
  }
}
