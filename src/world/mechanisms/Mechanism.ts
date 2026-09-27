/**
 * Mechanism.ts — contrat commun à tout élément d'architecture manipulable.
 *
 * Règles de game design, valables pour tous les mécanismes :
 *  1. le mécanisme montre toujours qu'il est manipulable (affordance visuelle) ;
 *  2. il se déplace lentement (PACING.mechanismDurationMs) — le joueur voit
 *     l'architecture penser ;
 *  3. il ne peut jamais enfermer le joueur dans un état sans issue ;
 *  4. il émet un son unique, reconnaissable, qui devient sa signature.
 */
import type { Object3D } from 'three';
import type { NavGraph } from '../NavGraph';

export interface MechanismContext {
  readonly graph: NavGraph;
  /** Temps écoulé, en secondes. */
  readonly elapsed: number;
}

export interface Mechanism {
  readonly id: string;
  readonly root: Object3D;
  /** Le joueur peut-il l'actionner en ce moment ? */
  readonly interactive: boolean;
  /** Une animation est-elle en cours ? (le jeu bloque les entrées pendant.) */
  readonly isAnimating: boolean;

  /** Actionne le mécanisme. `amount` = glissement normalisé pour les gestes. */
  actuate(amount?: number): void;
  update(context: MechanismContext, delta: number): void;
  /** Reconnecte le graphe selon la position courante. */
  applyToGraph(graph: NavGraph): void;
  dispose(): void;
}

/** Base commune : gère l'identité, la racine et le drapeau d'animation. */
export abstract class BaseMechanism implements Mechanism {
  abstract readonly root: Object3D;

  protected animating = false;
  protected enabled = true;

  constructor(readonly id: string) {}

  get interactive(): boolean {
    return this.enabled && !this.animating;
  }

  get isAnimating(): boolean {
    return this.animating;
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  abstract actuate(amount?: number): void;
  abstract applyToGraph(graph: NavGraph): void;

  update(_context: MechanismContext, _delta: number): void {
    /* Par défaut : rien. Les sous-classes animées surchargent. */
  }

  dispose(): void {
    this.root.removeFromParent();
  }
}
