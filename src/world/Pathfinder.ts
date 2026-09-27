/**
 * Pathfinder.ts — A* sur le NavGraph.
 *
 * Contraintes de conception :
 *  - déterministe (deux appels identiques donnent exactement le même chemin) ;
 *  - jamais bloquant : les graphes font quelques centaines de nœuds, un A*
 *    synchrone coûte moins de 0,1 ms ;
 *  - sans allocation superflue à l'exécution (le jeu tourne à 60 fps) ;
 *  - pur : aucune dépendance à three.js, donc testable dans Vitest.
 */
import { distance, type NavGraph, type NodeId } from './NavGraph';

export interface PathResult {
  /** Chemin complet, départ inclus, arrivée incluse. Vide si aucun chemin. */
  readonly path: readonly NodeId[];
  readonly cost: number;
  readonly found: boolean;
  /** Nœuds visités — utile au panneau de debug pour juger la qualité du graphe. */
  readonly explored: number;
}

const EMPTY_RESULT: PathResult = {
  path: [],
  cost: Number.POSITIVE_INFINITY,
  found: false,
  explored: 0,
};

/**
 * Heuristique : distance euclidienne. Admissible tant qu'une arête coûte au
 * moins sa longueur — vrai pour les arêtes normales. Les arêtes « illusoires »
 * relient des points éloignés à coût 1 : l'heuristique les surestimerait, on
 * la neutralise donc dès qu'un tel raccourci existe (`hasIllusoryEdges`).
 */
export interface PathfinderOptions {
  readonly heuristicScale?: number;
  readonly maxExplored?: number;
}

export function findPath(
  graph: NavGraph,
  start: NodeId,
  goal: NodeId,
  options: PathfinderOptions = {},
): PathResult {
  const startNode = graph.getNode(start);
  const goalNode = graph.getNode(goal);
  if (!startNode?.enabled || !goalNode?.enabled) return EMPTY_RESULT;
  if (start === goal) return { path: [start], cost: 0, found: true, explored: 1 };

  const heuristicScale = options.heuristicScale ?? 1;
  const maxExplored = options.maxExplored ?? 10_000;

  const gScore = new Map<NodeId, number>([[start, 0]]);
  const cameFrom = new Map<NodeId, NodeId>();
  const open: { id: NodeId; f: number; order: number }[] = [
    { id: start, f: heuristic(graph, start, goal, heuristicScale), order: 0 },
  ];
  const closed = new Set<NodeId>();
  let order = 0;
  let explored = 0;

  while (open.length > 0) {
    // File de priorité naïve : tri stable sur (f, ordre d'insertion).
    open.sort((a, b) => (a.f === b.f ? a.order - b.order : a.f - b.f));
    const current = open.shift();
    if (!current) break;
    if (closed.has(current.id)) continue;
    closed.add(current.id);
    explored += 1;

    if (current.id === goal) {
      return {
        path: reconstruct(cameFrom, goal),
        cost: gScore.get(goal) ?? Number.POSITIVE_INFINITY,
        found: true,
        explored,
      };
    }
    if (explored >= maxExplored) break;

    const currentG = gScore.get(current.id) ?? Number.POSITIVE_INFINITY;
    for (const edge of graph.neighbors(current.id)) {
      if (closed.has(edge.to)) continue;
      const tentative = currentG + edge.cost;
      const known = gScore.get(edge.to) ?? Number.POSITIVE_INFINITY;
      if (tentative >= known) continue;

      gScore.set(edge.to, tentative);
      cameFrom.set(edge.to, current.id);
      order += 1;
      open.push({
        id: edge.to,
        f: tentative + heuristic(graph, edge.to, goal, heuristicScale),
        order,
      });
    }
  }

  return { ...EMPTY_RESULT, explored };
}

/** Le nœud atteignable le plus proche du but — utilisé quand le joueur vise un nœud isolé. */
export function findClosestReachable(graph: NavGraph, start: NodeId, goal: NodeId): NodeId | null {
  const goalNode = graph.getNode(goal);
  if (!goalNode) return null;

  let best: NodeId | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const id of reachableFrom(graph, start)) {
    const node = graph.getNode(id);
    if (!node) continue;
    const d = distance(node.position, goalNode.position);
    if (d < bestDistance) {
      bestDistance = d;
      best = id;
    }
  }
  return best;
}

/**
 * Tronque un chemin au dernier nœud encore atteignable (ADR-005).
 *
 * Quand un mécanisme bouge pendant que Turpal marche, une arête peut
 * disparaître sous ses pieds. On ne le téléporte pas et on ne le fait pas
 * tomber : on coupe le chemin au dernier nœud sûr, il s'y arrête, et le
 * joueur relance le déplacement s'il le souhaite. Aucune punition, jamais.
 *
 * @param path        chemin en cours, du départ à l'arrivée
 * @param currentIndex index du nœud que Turpal vient d'atteindre
 * @returns le préfixe du chemin encore parcourable (jamais vide si l'index
 *          est valide : au pire Turpal reste là où il est)
 */
export function trimPathToSafe(
  graph: NavGraph,
  path: readonly NodeId[],
  currentIndex: number,
): readonly NodeId[] {
  if (path.length === 0) return path;
  const clampedIndex = Math.min(Math.max(currentIndex, 0), path.length - 1);
  const safe: NodeId[] = path.slice(0, clampedIndex + 1);

  for (let i = clampedIndex; i < path.length - 1; i += 1) {
    const from = path[i];
    const to = path[i + 1];
    if (from === undefined || to === undefined) break;
    if (!graph.areConnected(from, to)) break;
    if (graph.getNode(to)?.enabled !== true) break;
    safe.push(to);
  }
  return safe;
}

/** Parcours en largeur : tous les nœuds accessibles depuis `start`. */
export function reachableFrom(graph: NavGraph, start: NodeId): ReadonlySet<NodeId> {
  const seen = new Set<NodeId>();
  const startNode = graph.getNode(start);
  if (!startNode?.enabled) return seen;

  const queue: NodeId[] = [start];
  seen.add(start);

  while (queue.length > 0) {
    const current = queue.shift();
    if (current === undefined) break;
    for (const edge of graph.neighbors(current)) {
      if (seen.has(edge.to)) continue;
      seen.add(edge.to);
      queue.push(edge.to);
    }
  }
  return seen;
}

function heuristic(graph: NavGraph, from: NodeId, to: NodeId, scale: number): number {
  const a = graph.getNode(from);
  const b = graph.getNode(to);
  if (!a || !b) return 0;
  return distance(a.position, b.position) * scale;
}

function reconstruct(cameFrom: ReadonlyMap<NodeId, NodeId>, goal: NodeId): readonly NodeId[] {
  const path: NodeId[] = [goal];
  let current: NodeId | undefined = goal;
  while (current !== undefined) {
    current = cameFrom.get(current);
    if (current !== undefined) path.push(current);
  }
  return path.reverse();
}
