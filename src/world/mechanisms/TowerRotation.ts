/**
 * TowerRotation.ts — rotation d'une tour vainakh entière.
 *
 * Statut : squelette. Le mécanisme signature du jeu, et son image de marque :
 * la tour pivote sur son axe vertical, révélant des escaliers qui n'existaient
 * pas sous cet angle. C'est aussi le moment le plus « cinématographique » :
 * caméra qui respire, montée du pondar, poussière qui tombe des pierres.
 *
 * Contrainte culturelle : la tour reste toujours debout et intacte. Elle ne
 * se brise jamais, ne s'effondre jamais. Ces tours sont des monuments réels.
 */
import { Group, type Object3D } from 'three';
import { BaseMechanism } from './Mechanism';
import type { NavGraph } from '../NavGraph';

export interface TowerRotationOptions {
  /** Nombre de faces utiles de la tour (4 par défaut). */
  readonly faces?: number;
  /** Rotation possible dans les deux sens. */
  readonly bidirectional?: boolean;
}

export class TowerRotation extends BaseMechanism {
  readonly root: Object3D = new Group();

  private face = 0;

  constructor(
    id: string,
    private readonly options: TowerRotationOptions = {},
  ) {
    super(id);
    this.root.name = `TowerRotation:${id}`;
  }

  get currentFace(): number {
    return this.face;
  }

  actuate(amount = 1): void {
    if (!this.interactive) return;
    const faces = this.options.faces ?? 4;
    const direction = this.options.bidirectional === false ? 1 : Math.sign(amount) || 1;
    this.face = (this.face + direction + faces) % faces;
    // TODO(phase Mécanismes) : tween long (1,2 s), poussière, montée sonore.
  }

  applyToGraph(_graph: NavGraph): void {
    // TODO(phase Mécanismes) : recâbler les escaliers visibles sur la face courante.
  }
}
