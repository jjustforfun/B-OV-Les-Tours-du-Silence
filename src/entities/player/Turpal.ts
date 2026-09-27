/**
 * Turpal.ts — le héros.
 *
 * Turpal est un homme tchétchène calme et digne. Il ne court jamais, ne
 * saute jamais, ne combat jamais. Il marche : le joueur désigne un point,
 * Turpal y va en suivant le graphe de navigation. Toute sa personnalité
 * passe par la vitesse, la pause avant un pas dans le vide, et la manière
 * dont il regarde ce qui l'entoure quand le joueur ne fait rien.
 *
 * Cette classe orchestre : état logique + modèle (TurpalModel) + animation
 * (TurpalAnimator). Elle ne contient aucune géométrie.
 */
import { Group, Vector3 } from 'three';
import { PACING } from '@/config';
import { StateMachine, type StateChart } from '@core/StateMachine';
import type { NavGraph, NodeId } from '@world/NavGraph';
import { findPath, trimPathToSafe } from '@world/Pathfinder';

export type TurpalState = 'idle' | 'walking' | 'climbing' | 'contemplating' | 'arrived';

const CHART: StateChart<TurpalState> = {
  idle: { to: ['walking', 'contemplating'] },
  walking: { to: ['idle', 'climbing', 'arrived'] },
  climbing: { to: ['walking', 'idle'] },
  contemplating: { to: ['idle', 'walking'] },
  arrived: { to: ['idle', 'walking'] },
};

export class Turpal {
  readonly root = new Group();
  readonly machine = new StateMachine<TurpalState>({
    chart: CHART,
    initial: 'idle',
    context: undefined,
  });

  /** Nœud sur lequel Turpal se tient actuellement. */
  currentNode: NodeId | null = null;

  private path: readonly NodeId[] = [];
  private pathIndex = 0;
  /** Vecteurs réutilisés : zéro allocation dans la boucle (AGENTS.md § 4). */
  private readonly targetPosition = new Vector3();
  private readonly upVector = new Vector3(0, 1, 0);

  constructor() {
    this.root.name = 'Turpal';
  }

  get isMoving(): boolean {
    return this.machine.is('walking') || this.machine.is('climbing');
  }

  placeAt(graph: NavGraph, nodeId: NodeId): void {
    const node = graph.getNode(nodeId);
    if (!node) return;
    this.currentNode = nodeId;
    this.root.position.set(node.position.x, node.position.y, node.position.z);
    this.applyUp(node.up);
  }

  /**
   * Réévalue le chemin en cours (ADR-005).
   *
   * Appelé chaque fois qu'un mécanisme change d'état : si une arête a
   * disparu sous les pieds de Turpal, il s'arrête au dernier nœud sûr.
   * Il ne tombe pas, il n'est pas téléporté, rien n'est perdu.
   *
   * @returns true si le chemin a été raccourci.
   */
  revalidatePath(graph: NavGraph): boolean {
    if (this.path.length === 0) return false;

    const safe = trimPathToSafe(graph, this.path, this.pathIndex - 1);
    if (safe.length === this.path.length) return false;

    this.path = safe;
    if (this.pathIndex >= safe.length) {
      this.pathIndex = safe.length;
      if (this.machine.is('walking') || this.machine.is('climbing')) {
        this.machine.transition('idle');
      }
    }
    return true;
  }

  /** Demande un déplacement. Retourne false si aucun chemin n'existe. */
  goTo(graph: NavGraph, nodeId: NodeId): boolean {
    if (this.currentNode === null) return false;
    const result = findPath(graph, this.currentNode, nodeId);
    if (!result.found || result.path.length < 2) return false;

    this.path = result.path;
    this.pathIndex = 1;
    this.machine.transition('walking');
    return true;
  }

  /** Avance le long du chemin courant. */
  update(graph: NavGraph, delta: number): void {
    this.machine.update(delta);
    if (!this.isMoving) return;

    const nextId = this.path[this.pathIndex];
    if (nextId === undefined) {
      this.path = [];
      this.machine.transition('arrived');
      return;
    }

    const node = graph.getNode(nextId);
    if (!node) return;

    this.targetPosition.set(node.position.x, node.position.y, node.position.z);
    const step = PACING.walkSpeed * delta;
    const distance = this.root.position.distanceTo(this.targetPosition);

    if (distance <= step) {
      this.root.position.copy(this.targetPosition);
      this.currentNode = nextId;
      this.pathIndex += 1;
      // La gravité appartient au sol, pas au monde (ADR-004) : en arrivant
      // sur un nœud, Turpal adopte le « haut » de ce nœud.
      this.applyUp(node.up);
      return;
    }

    this.root.position.lerp(this.targetPosition, step / distance);
    this.root.lookAt(this.targetPosition);
  }

  /** Oriente le personnage selon le « up » du nœud courant (ADR-004). */
  private applyUp(up: { x: number; y: number; z: number }): void {
    this.upVector.set(up.x, up.y, up.z);
    if (this.upVector.lengthSq() === 0) this.upVector.set(0, 1, 0);
    this.root.up.copy(this.upVector);
  }

  dispose(): void {
    this.root.removeFromParent();
    this.root.clear();
  }
}
