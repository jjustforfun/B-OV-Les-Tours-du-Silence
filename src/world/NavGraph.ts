/**
 * NavGraph.ts — graphe de navigation du niveau.
 *
 * Le cœur logique du jeu. Turpal ne marche jamais « sur de la géométrie » :
 * il marche sur un graphe de nœuds. C'est ce qui rend les géométries
 * impossibles possibles — deux nœuds éloignés en 3D peuvent être reliés
 * parce qu'ils se touchent *à l'écran* (voir Illusion.ts). Le graphe est
 * une structure pure, sans three.js : donc entièrement testable.
 */

export interface NavPosition {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export type NodeId = string;

/** Orientation du « haut » local d'un nœud. Voir ADR-004. */
export interface NavUp {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export type NavSurface = 'stone' | 'grass' | 'snow' | 'wood';

/** Gravité par défaut : le sol est sous les pieds. */
export const DEFAULT_UP: NavUp = { x: 0, y: 1, z: 0 };

/** Surface par défaut : pierre, cohérente avec les tours et escaliers. */
export const DEFAULT_SURFACE: NavSurface = 'stone';

export interface NavNode {
  readonly id: NodeId;
  readonly position: NavPosition;
  /**
   * Direction du « haut » quand on se tient sur ce nœud (ADR-004).
   * C'est ce qui permet de marcher sur un mur ou un plafond : la gravité
   * n'est pas une propriété du monde, c'est une propriété du sol.
   */
  readonly up: NavUp;
  /** Matière du sol sous les pieds : pas, particules et snapping de picking. */
  readonly surface: NavSurface;
  /** Nœud désactivé : présent mais temporairement infranchissable. */
  enabled: boolean;
  /** Étiquettes libres : 'goal', 'door', 'borz', 'elder'… */
  readonly tags: ReadonlySet<string>;
}

/** Valeur d'état qu'un mécanisme peut prendre (angle, cran, booléen). */
export type MechanismValue = number | string | boolean;

/**
 * Condition d'activation d'une arête (ADR-003) : « ce passage existe
 * seulement si le rotateur R est à 90° ». Exprimée en données du niveau,
 * jamais en code — c'est ce qui rend les illusions écrites par un level
 * designer plutôt que codées.
 */
export interface EdgeCondition {
  readonly mechanism: string;
  readonly equals: MechanismValue;
}

export interface NavEdgeOptions {
  /** Arête à sens unique (rampes, illusions dirigées). Défaut : false. */
  readonly oneWay?: boolean;
  /** Coût de déplacement (1 = un pas normal). */
  readonly cost?: number;
  /** Arête née d'une illusion d'optique : coupée si la caméra tourne. */
  readonly illusory?: boolean;
  /** N'existe que si un mécanisme est dans un état donné (ADR-003). */
  readonly condition?: EdgeCondition;
}

export interface NavEdge {
  readonly from: NodeId;
  readonly to: NodeId;
  readonly cost: number;
  readonly illusory: boolean;
  readonly condition: EdgeCondition | null;
  /** Alignement écran courant pour les arêtes illusoires. */
  illusionActive: boolean;
  enabled: boolean;
}

export class NavGraph {
  private readonly nodes = new Map<NodeId, NavNode>();
  private readonly adjacency = new Map<NodeId, Map<NodeId, NavEdge>>();
  /** État courant de chaque mécanisme, pour évaluer les arêtes conditionnelles. */
  private readonly mechanismStates = new Map<string, MechanismValue>();

  get nodeCount(): number {
    return this.nodes.size;
  }

  get edgeCount(): number {
    let count = 0;
    for (const edges of this.adjacency.values()) count += edges.size;
    return count;
  }

  addNode(
    id: NodeId,
    position: NavPosition,
    tags: readonly string[] = [],
    up: NavUp = DEFAULT_UP,
    surface: NavSurface = DEFAULT_SURFACE,
  ): NavNode {
    const existing = this.nodes.get(id);
    if (existing) return existing;

    const node: NavNode = { id, position, up, surface, enabled: true, tags: new Set(tags) };
    this.nodes.set(id, node);
    this.adjacency.set(id, new Map());
    return node;
  }

  getNode(id: NodeId): NavNode | undefined {
    return this.nodes.get(id);
  }

  hasNode(id: NodeId): boolean {
    return this.nodes.has(id);
  }

  /** Itère les nœuds dans l'ordre d'insertion (déterminisme des tests). */
  allNodes(): readonly NavNode[] {
    return [...this.nodes.values()];
  }

  setNodeEnabled(id: NodeId, enabled: boolean): void {
    const node = this.nodes.get(id);
    if (node) node.enabled = enabled;
  }

  /**
   * Relie deux nœuds. Bidirectionnel par défaut : marcher est réversible,
   * sauf mention contraire (une chute ne se remonte pas).
   */
  connect(from: NodeId, to: NodeId, options: NavEdgeOptions = {}): void {
    if (!this.nodes.has(from) || !this.nodes.has(to) || from === to) return;
    const cost = options.cost ?? 1;
    const illusory = options.illusory ?? false;
    const condition = options.condition ?? null;

    this.putEdge(from, to, cost, illusory, condition);
    if (!options.oneWay) this.putEdge(to, from, cost, illusory, condition);
  }

  disconnect(from: NodeId, to: NodeId, bothWays = true): void {
    this.adjacency.get(from)?.delete(to);
    if (bothWays) this.adjacency.get(to)?.delete(from);
  }

  getEdge(from: NodeId, to: NodeId): NavEdge | undefined {
    return this.adjacency.get(from)?.get(to);
  }

  areConnected(from: NodeId, to: NodeId): boolean {
    return this.getEdge(from, to)?.enabled === true;
  }

  /** Voisins franchissables : nœud actif, arête active. */
  neighbors(id: NodeId): readonly NavEdge[] {
    const edges = this.adjacency.get(id);
    if (!edges) return [];
    const result: NavEdge[] = [];
    for (const edge of edges.values()) {
      if (!edge.enabled) continue;
      if (this.nodes.get(edge.to)?.enabled !== true) continue;
      result.push(edge);
    }
    return result;
  }

  /**
   * Toutes les arêtes stockées, y compris fermées ou illusoires inactives.
   * Les outils de debug et d'audit doivent voir ce qui est coupé, pas seulement
   * ce que Turpal peut emprunter maintenant.
   */
  allEdges(): readonly NavEdge[] {
    const result: NavEdge[] = [];
    for (const edges of this.adjacency.values()) {
      for (const edge of edges.values()) result.push(edge);
    }
    return result;
  }

  /**
   * Déclare l'état courant d'un mécanisme et réévalue les arêtes qui en
   * dépendent (ADR-003). Appelé à la fin d'une animation de mécanisme,
   * jamais par image.
   */
  setMechanismState(mechanism: string, value: MechanismValue): void {
    this.mechanismStates.set(mechanism, value);
    for (const edges of this.adjacency.values()) {
      for (const edge of edges.values()) {
        if (edge.condition?.mechanism !== mechanism) continue;
        edge.enabled = this.evaluateEdgeEnabled(edge);
      }
    }
  }

  getMechanismState(mechanism: string): MechanismValue | undefined {
    return this.mechanismStates.get(mechanism);
  }

  /** Active ou coupe toutes les arêtes nées d'illusions (rotation de caméra). */
  setIllusoryEdgesEnabled(enabled: boolean): void {
    for (const edges of this.adjacency.values()) {
      for (const edge of edges.values()) {
        if (!edge.illusory) continue;
        edge.illusionActive = enabled;
        edge.enabled = this.evaluateEdgeEnabled(edge);
      }
    }
  }

  /** Active ou coupe une liaison illusoire précise, sans toucher aux autres. */
  setIllusoryConnectionEnabled(from: NodeId, to: NodeId, enabled: boolean, bothWays = true): void {
    this.setOneIllusoryEdgeEnabled(from, to, enabled);
    if (bothWays) this.setOneIllusoryEdgeEnabled(to, from, enabled);
  }

  findNodesByTag(tag: string): readonly NavNode[] {
    return this.allNodes().filter((node) => node.tags.has(tag));
  }

  /** Nœud le plus proche d'une position (sélection au doigt/à la souris). */
  nearest(position: NavPosition, maxDistance = Number.POSITIVE_INFINITY): NavNode | undefined {
    let best: NavNode | undefined;
    let bestDistance = maxDistance * maxDistance;

    for (const node of this.nodes.values()) {
      if (!node.enabled) continue;
      const distance = squaredDistance(node.position, position);
      if (distance <= bestDistance) {
        bestDistance = distance;
        best = node;
      }
    }
    return best;
  }

  clear(): void {
    this.nodes.clear();
    this.adjacency.clear();
    this.mechanismStates.clear();
  }

  private putEdge(
    from: NodeId,
    to: NodeId,
    cost: number,
    illusory: boolean,
    condition: EdgeCondition | null,
  ): void {
    let edges = this.adjacency.get(from);
    if (!edges) {
      edges = new Map();
      this.adjacency.set(from, edges);
    }
    // Une arête conditionnelle naît dans l'état que dicte le mécanisme :
    // fermée tant qu'il n'est pas dans la bonne position. Une arête illusoire
    // naît active hors LevelDefinition pour préserver l'API de test ; les
    // niveaux la ferment ensuite jusqu'au premier alignement écran.
    const illusionActive = true;
    const edge: NavEdge = { from, to, cost, illusory, condition, illusionActive, enabled: false };
    edge.enabled = this.evaluateEdgeEnabled(edge);
    edges.set(to, edge);
  }

  private setOneIllusoryEdgeEnabled(from: NodeId, to: NodeId, enabled: boolean): void {
    const edge = this.getEdge(from, to);
    if (!edge?.illusory) return;
    edge.illusionActive = enabled;
    edge.enabled = this.evaluateEdgeEnabled(edge);
  }

  private evaluateEdgeEnabled(edge: NavEdge): boolean {
    const conditionMet =
      edge.condition === null ||
      this.mechanismStates.get(edge.condition.mechanism) === edge.condition.equals;
    const illusionMet = !edge.illusory || edge.illusionActive;
    return conditionMet && illusionMet;
  }
}

export function squaredDistance(a: NavPosition, b: NavPosition): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return dx * dx + dy * dy + dz * dz;
}

export function distance(a: NavPosition, b: NavPosition): number {
  return Math.sqrt(squaredDistance(a, b));
}
