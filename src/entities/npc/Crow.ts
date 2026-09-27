/**
 * Crow.ts — les oiseaux (corneilles des gorges, et plus haut, les aigles).
 *
 * Statut : squelette. Purement décoratifs et purement essentiels : ils
 * donnent l'échelle des tours et la profondeur du ciel. Ils réagissent
 * discrètement au joueur (ils s'envolent quand Turpal approche), ce qui
 * récompense la curiosité sans jamais rien exiger.
 *
 * Implémentation visée : InstancedMesh, trajectoires en courbes de Bézier
 * précalculées, zéro physique.
 */
import { Group } from 'three';

export interface CrowFlockOptions {
  readonly count?: number;
  readonly radius?: number;
  readonly altitude?: number;
}

export class Crow {
  readonly root = new Group();

  constructor(private readonly options: CrowFlockOptions = {}) {
    this.root.name = 'CrowFlock';
  }

  get count(): number {
    return this.options.count ?? 5;
  }

  update(_elapsed: number): void {
    // TODO(phase FX) : avancer les instances le long de leurs courbes.
  }

  /** Effarouchement : le vol se disperse puis se reforme plus haut. */
  startle(): void {
    // TODO(phase FX)
  }

  dispose(): void {
    this.root.removeFromParent();
    this.root.clear();
  }
}
