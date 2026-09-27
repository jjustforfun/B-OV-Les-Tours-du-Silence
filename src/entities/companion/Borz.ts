/**
 * Borz.ts — le loup de pierre. [À VÉRIFIER : « borz » = loup en tchétchène]
 *
 * Statut : squelette.
 *
 * Borz est l'équivalent du Totem de Monument Valley, mais vivant : un loup
 * taillé dans la pierre, figure tutélaire tchétchène. Il fait trois choses :
 *  1. il sert de plateforme mobile (le joueur le déplace, Turpal monte dessus) ;
 *  2. il attend — et son attente crée l'attachement ;
 *  3. il regarde Turpal quand celui-ci s'éloigne.
 *
 * Contrainte émotionnelle : Borz n'est jamais détruit, jamais blessé, jamais
 * sacrifié. Le lien ne se paie pas par une perte ; c'est ce qui distingue ce
 * jeu de la convention du genre.
 */
import { Group } from 'three';
import type { NavGraph, NodeId } from '@world/NavGraph';

export type BorzState = 'waiting' | 'following' | 'carrying' | 'watching';

export class Borz {
  readonly root = new Group();

  state: BorzState = 'waiting';
  currentNode: NodeId | null = null;

  constructor() {
    this.root.name = 'Borz';
  }

  placeAt(graph: NavGraph, nodeId: NodeId): void {
    const node = graph.getNode(nodeId);
    if (!node) return;
    this.currentNode = nodeId;
    this.root.position.set(node.position.x, node.position.y, node.position.z);
  }

  update(_delta: number): void {
    // TODO(phase Compagnon) : suivi le long du graphe, regard tourné vers Turpal,
    // et rôle de plateforme (il devient un nœud mobile du NavGraph).
  }

  dispose(): void {
    this.root.removeFromParent();
    this.root.clear();
  }
}
