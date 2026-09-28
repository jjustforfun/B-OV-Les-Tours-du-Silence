/**
 * NavGraphViz.ts — visualisation du graphe de navigation.
 *
 * Outil de level design : il affiche les nœuds, les arêtes actives en vert,
 * les arêtes inactives en rouge, les conditions et les illusions. Le module
 * reste léger et activable par URL (`?debug=nav`) ou par la touche G en dev.
 */
import {
  BufferGeometry,
  Group,
  Line,
  LineBasicMaterial,
  Mesh,
  MeshBasicMaterial,
  SphereGeometry,
  Vector3,
  type Material,
} from 'three';
import type { NavEdge, NavGraph, NavNode } from '@world/NavGraph';

export const NAV_GRAPH_VIZ_COLORS = {
  node: 0xfff2b5,
  nodeDisabled: 0x596170,
  edge: 0x42e66f,
  edgeDisabled: 0xff4d4d,
  conditionalOpen: 0x42e66f,
  conditionalClosed: 0xff4d4d,
  illusionOpen: 0x42e66f,
  illusionClosed: 0xff4d4d,
} as const;

export type NavGraphVizEdgeKind =
  | 'edge'
  | 'edge-disabled'
  | 'conditional-open'
  | 'conditional-closed'
  | 'illusion-open'
  | 'illusion-closed';

export interface NavGraphVizEdgeUserData {
  readonly vizKind: 'edge';
  readonly state: NavGraphVizEdgeKind;
  readonly from: string;
  readonly to: string;
  readonly enabled: boolean;
  readonly illusory: boolean;
  readonly conditional: boolean;
}

export interface NavGraphVizNodeUserData {
  readonly vizKind: 'node';
  readonly id: string;
  readonly enabled: boolean;
  readonly tags: readonly string[];
}

const NODE_RADIUS = 0.085;

/** Lit le flag URL. Supporte `?debug=nav` et `?debug=stats,nav`. */
export function isNavGraphDebugEnabled(search: string): boolean {
  const params = new URLSearchParams(search.startsWith('?') ? search : `?${search}`);
  for (const value of params.getAll('debug')) {
    const flags = value.split(',').map((flag) => flag.trim().toLowerCase());
    if (flags.includes('nav')) return true;
  }
  return false;
}

export class NavGraphViz {
  readonly root = new Group();

  private readonly edgeGeometries: BufferGeometry[] = [];
  private readonly edgeLines: Line[] = [];
  private readonly edgeData: NavGraphVizEdgeUserData[] = [];
  private readonly nodeMeshes: Mesh[] = [];
  private readonly nodeData: NavGraphVizNodeUserData[] = [];
  private readonly nodeGeometry = new SphereGeometry(NODE_RADIUS, 12, 8);
  private readonly nodeMaterial = new MeshBasicMaterial({
    color: NAV_GRAPH_VIZ_COLORS.node,
    depthTest: false,
  });
  private readonly nodeDisabledMaterial = new MeshBasicMaterial({
    color: NAV_GRAPH_VIZ_COLORS.nodeDisabled,
    depthTest: false,
    transparent: true,
    opacity: 0.62,
  });
  private readonly edgeMaterial = this.lineMaterial(NAV_GRAPH_VIZ_COLORS.edge, 0.66);
  private readonly edgeDisabledMaterial = this.lineMaterial(
    NAV_GRAPH_VIZ_COLORS.edgeDisabled,
    0.34,
  );
  private readonly conditionalOpenMaterial = this.lineMaterial(
    NAV_GRAPH_VIZ_COLORS.conditionalOpen,
    0.86,
  );
  private readonly conditionalClosedMaterial = this.lineMaterial(
    NAV_GRAPH_VIZ_COLORS.conditionalClosed,
    0.8,
  );
  private readonly illusionOpenMaterial = this.lineMaterial(
    NAV_GRAPH_VIZ_COLORS.illusionOpen,
    0.95,
  );
  private readonly illusionClosedMaterial = this.lineMaterial(
    NAV_GRAPH_VIZ_COLORS.illusionClosed,
    0.72,
  );

  constructor() {
    this.root.name = 'NavGraphViz';
    this.root.visible = false;
    this.root.renderOrder = 900;
  }

  get nodeVisualCount(): number {
    return this.nodeMeshes.length;
  }

  get edgeVisualCount(): number {
    return this.edgeLines.length;
  }

  get nodes(): readonly NavGraphVizNodeUserData[] {
    return this.nodeData;
  }

  get edges(): readonly NavGraphVizEdgeUserData[] {
    return this.edgeData;
  }

  /** Reconstruit entièrement la visualisation (appelé rarement, hors boucle). */
  rebuild(graph: NavGraph): void {
    this.clear();

    for (const edge of graph.allEdges()) this.addEdge(graph, edge);
    for (const node of graph.allNodes()) this.addNode(node);
  }

  setVisible(visible: boolean): void {
    this.root.visible = visible;
  }

  clear(): void {
    for (const geometry of this.edgeGeometries) geometry.dispose();
    this.edgeGeometries.length = 0;
    this.edgeLines.length = 0;
    this.edgeData.length = 0;
    this.nodeMeshes.length = 0;
    this.nodeData.length = 0;
    this.root.clear();
  }

  dispose(): void {
    this.clear();
    this.nodeGeometry.dispose();
    this.nodeMaterial.dispose();
    this.nodeDisabledMaterial.dispose();
    this.edgeMaterial.dispose();
    this.edgeDisabledMaterial.dispose();
    this.conditionalOpenMaterial.dispose();
    this.conditionalClosedMaterial.dispose();
    this.illusionOpenMaterial.dispose();
    this.illusionClosedMaterial.dispose();
    this.root.removeFromParent();
  }

  private addNode(node: NavNode): void {
    const mesh = new Mesh(
      this.nodeGeometry,
      node.enabled ? this.nodeMaterial : this.nodeDisabledMaterial,
    );
    mesh.name = `NavGraphVizNode:${node.id}`;
    mesh.position.set(node.position.x, node.position.y + NODE_RADIUS * 1.35, node.position.z);
    mesh.renderOrder = this.root.renderOrder + 1;
    const data = {
      vizKind: 'node',
      id: node.id,
      enabled: node.enabled,
      tags: [...node.tags],
    } satisfies NavGraphVizNodeUserData;
    mesh.userData = data;
    this.nodeMeshes.push(mesh);
    this.nodeData.push(data);
    this.root.add(mesh);
  }

  private addEdge(graph: NavGraph, edge: NavEdge): void {
    const from = graph.getNode(edge.from);
    const to = graph.getNode(edge.to);
    if (!from || !to) return;

    const state = this.edgeState(graph, edge);
    const geometry = new BufferGeometry().setFromPoints([
      new Vector3(from.position.x, from.position.y + NODE_RADIUS, from.position.z),
      new Vector3(to.position.x, to.position.y + NODE_RADIUS, to.position.z),
    ]);
    const line = new Line(geometry, this.materialForState(state));
    line.name = `NavGraphVizEdge:${edge.from}->${edge.to}`;
    line.renderOrder = this.root.renderOrder;
    const data = {
      vizKind: 'edge',
      state,
      from: edge.from,
      to: edge.to,
      enabled: edge.enabled,
      illusory: edge.illusory,
      conditional: edge.conditions.length > 0,
    } satisfies NavGraphVizEdgeUserData;
    line.userData = data;

    this.edgeGeometries.push(geometry);
    this.edgeLines.push(line);
    this.edgeData.push(data);
    this.root.add(line);
  }

  private edgeState(graph: NavGraph, edge: NavEdge): NavGraphVizEdgeKind {
    const conditionMet = edge.conditions.every(
      (condition) => graph.getMechanismState(condition.mechanism) === condition.equals,
    );

    if (edge.conditions.length > 0 && !conditionMet) return 'conditional-closed';
    if (edge.illusory) return edge.enabled ? 'illusion-open' : 'illusion-closed';
    if (edge.conditions.length > 0) return 'conditional-open';
    return edge.enabled ? 'edge' : 'edge-disabled';
  }

  private materialForState(state: NavGraphVizEdgeKind): Material {
    switch (state) {
      case 'edge':
        return this.edgeMaterial;
      case 'edge-disabled':
        return this.edgeDisabledMaterial;
      case 'conditional-open':
        return this.conditionalOpenMaterial;
      case 'conditional-closed':
        return this.conditionalClosedMaterial;
      case 'illusion-open':
        return this.illusionOpenMaterial;
      case 'illusion-closed':
        return this.illusionClosedMaterial;
    }
  }

  private lineMaterial(color: number, opacity: number): LineBasicMaterial {
    return new LineBasicMaterial({
      color,
      transparent: opacity < 1,
      opacity,
      depthTest: false,
      depthWrite: false,
    });
  }
}
