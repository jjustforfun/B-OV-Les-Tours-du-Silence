/**
 * GravityPath.ts — chemin dont la gravité change d'orientation.
 *
 * Statut : squelette. Quand Turpal franchit une arête « bascule », le monde
 * pivote et ce qui était un mur devient un sol. Réservé aux chapitres tardifs
 * (« pardon », « humilité ») : c'est la mécanique qui demande le plus de
 * lâcher-prise au joueur — thématiquement juste.
 */
import { Group, type Object3D } from 'three';
import { BaseMechanism } from './Mechanism';
import type { NavGraph, NodeId } from '../NavGraph';

export type GravityDirection = 'down' | 'up' | 'north' | 'south' | 'east' | 'west';

export interface GravityPathOptions {
  readonly from: GravityDirection;
  readonly to: GravityDirection;
  /** Nœuds où la bascule se déclenche. */
  readonly pivotNodes: readonly NodeId[];
}

export class GravityPath extends BaseMechanism {
  readonly root: Object3D = new Group();

  private direction: GravityDirection;

  constructor(
    id: string,
    private readonly options: GravityPathOptions,
  ) {
    super(id);
    this.root.name = `GravityPath:${id}`;
    this.direction = options.from;
  }

  get currentDirection(): GravityDirection {
    return this.direction;
  }

  get pivotNodes(): readonly NodeId[] {
    return this.options.pivotNodes;
  }

  actuate(): void {
    if (!this.interactive) return;
    this.direction = this.direction === this.options.from ? this.options.to : this.options.from;
    // TODO(phase Mécanismes) : rotation de la caméra ET du personnage, jamais du monde
    // (faire tourner le monde donne la nausée en 3D ; Monument Valley triche ainsi).
  }

  applyToGraph(_graph: NavGraph): void {
    // TODO(phase Mécanismes) : réorienter les arêtes verticales selon la gravité.
  }
}
