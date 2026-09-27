/**
 * Elder.ts — l'ancien (chapitre « respect des anciens ».)
 *
 * Statut : squelette. Il ne parle pas : il désigne. Un geste lent de la main
 * ouvre un chemin. Le joueur comprend qu'écouter un ancien, ici, c'est
 * simplement regarder où il pointe.
 *
 * Représentation : silhouette voûtée mais debout, bâton, papakha claire
 * (l'âge). Jamais comique, jamais fragile — respecté.
 */
import { Group } from 'three';
import type { NodeId } from '@world/NavGraph';

export class Elder {
  readonly root = new Group();

  constructor(
    readonly id: string,
    /** Nœud que l'ancien désigne. */
    readonly pointsTo: NodeId,
  ) {
    this.root.name = `Elder:${id}`;
  }

  /** Geste d'indication : lent, une seule fois, puis retour au repos. */
  gesture(): void {
    // TODO(phase PNJ) : animation du bras + halo doux sur le nœud désigné.
  }

  dispose(): void {
    this.root.removeFromParent();
    this.root.clear();
  }
}
