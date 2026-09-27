/**
 * PressurePlate.ts — dalle qui s'enfonce sous Turpal ou sous Borz.
 *
 * Statut : squelette. Sert surtout la dramaturgie de la coopération : la
 * plupart des dalles demandent que *quelqu'un d'autre* reste dessus, ce qui
 * met Borz en valeur (chapitres « parole donnée » et « pardon »).
 */
import { Group, type Object3D } from 'three';
import { BaseMechanism } from './Mechanism';
import type { NavGraph, NodeId } from '../NavGraph';

export interface PressurePlateOptions {
  /** Nœud sur lequel il faut se tenir. */
  readonly triggerNode: NodeId;
  /** Reste enfoncée une fois activée. */
  readonly latching?: boolean;
}

export class PressurePlate extends BaseMechanism {
  readonly root: Object3D = new Group();

  private pressed = false;

  constructor(
    id: string,
    private readonly options: PressurePlateOptions,
  ) {
    super(id);
    this.root.name = `PressurePlate:${id}`;
  }

  get isPressed(): boolean {
    return this.pressed;
  }

  get triggerNode(): NodeId {
    return this.options.triggerNode;
  }

  /** Appelé quand une entité entre ou sort du nœud déclencheur. */
  setOccupied(occupied: boolean): void {
    if (this.pressed && this.options.latching === true) return;
    this.pressed = occupied;
  }

  actuate(): void {
    this.setOccupied(!this.pressed);
  }

  applyToGraph(_graph: NavGraph): void {
    // TODO(phase Mécanismes) : ouvrir/fermer le passage associé.
  }
}
