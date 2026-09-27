/**
 * NavGraphViz.ts — visualisation du graphe de navigation.
 *
 * Statut : squelette. Outil de level design avant tout : afficher les nœuds
 * (sphères), les arêtes (lignes), et distinguer en couleur les arêtes
 * illusoires. C'est ce qui permettra de vérifier d'un coup d'œil qu'un
 * puzzle n'a pas d'impasse.
 */
import { BufferGeometry, Group, Line, LineBasicMaterial, Vector3 } from 'three';
import type { NavGraph } from '@world/NavGraph';

export class NavGraphViz {
  readonly root = new Group();

  /** Géométries créées, conservées pour un dispose() exhaustif. */
  private readonly geometries: BufferGeometry[] = [];
  private readonly material = new LineBasicMaterial({
    color: 0xd9a441,
    transparent: true,
    opacity: 0.6,
  });
  private readonly illusoryMaterial = new LineBasicMaterial({
    color: 0x6ad9c8,
    transparent: true,
    opacity: 0.8,
  });

  constructor() {
    this.root.name = 'NavGraphViz';
    this.root.visible = false;
  }

  /** Reconstruit entièrement la visualisation (appelé rarement, hors boucle). */
  rebuild(graph: NavGraph): void {
    this.clear();

    for (const node of graph.allNodes()) {
      for (const edge of graph.neighbors(node.id)) {
        const target = graph.getNode(edge.to);
        if (!target) continue;
        const geometry = new BufferGeometry().setFromPoints([
          new Vector3(node.position.x, node.position.y, node.position.z),
          new Vector3(target.position.x, target.position.y, target.position.z),
        ]);
        this.geometries.push(geometry);
        this.root.add(new Line(geometry, edge.illusory ? this.illusoryMaterial : this.material));
      }
    }
  }

  setVisible(visible: boolean): void {
    this.root.visible = visible;
  }

  clear(): void {
    for (const geometry of this.geometries) geometry.dispose();
    this.geometries.length = 0;
    this.root.clear();
  }

  dispose(): void {
    this.clear();
    this.material.dispose();
    this.illusoryMaterial.dispose();
    this.root.removeFromParent();
  }
}
