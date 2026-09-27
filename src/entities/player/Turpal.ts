/**
 * Turpal.ts — le héros.
 *
 * Turpal est un homme tchétchène calme et digne. Il ne court jamais, ne
 * saute jamais, ne combat jamais. Il marche : le joueur désigne un point,
 * Turpal y va en suivant le graphe de navigation. Toute sa personnalité
 * passe par la vitesse, la pause avant un pas dans le vide, et la manière
 * dont il regarde ce qui l'entoure quand le joueur ne fait rien.
 *
 * Cette classe orchestre : état logique + modèle interchangeable
 * (`ICharacterModel`) + animation (`TurpalAnimator`). Elle ne contient aucune
 * géométrie de personnage.
 */
import { Group, Vector3 } from 'three';
import { GRID, PACING, TURPAL } from '@/config';
import { bus } from '@core/EventBus';
import { StateMachine, type StateChart } from '@core/StateMachine';
import type { ICharacterModel } from '@entities/ICharacterModel';
import { DestinationMarker } from '@entities/player/DestinationMarker';
import { TurpalAnimator } from '@entities/player/TurpalAnimator';
import type { NavGraph, NavUp, NodeId } from '@world/NavGraph';
import { findPath, trimPathToSafe } from '@world/Pathfinder';

export type TurpalState = 'idle' | 'walking' | 'climbing' | 'contemplating' | 'arrived';

const CHART: StateChart<TurpalState> = {
  idle: { to: ['walking', 'climbing', 'contemplating'] },
  walking: { to: ['idle', 'climbing', 'arrived', 'contemplating'] },
  climbing: { to: ['walking', 'idle', 'arrived'] },
  contemplating: { to: ['idle', 'walking', 'climbing'] },
  arrived: { to: ['idle', 'walking', 'climbing', 'contemplating'] },
};

const WORLD_UP = new Vector3(0, 1, 0);

export class Turpal {
  readonly root = new Group();
  readonly machine = new StateMachine<TurpalState>({
    chart: CHART,
    initial: 'idle',
    context: undefined,
  });
  readonly destinationMarker = new DestinationMarker();

  /** Nœud sur lequel Turpal se tient actuellement. */
  currentNode: NodeId | null = null;

  private readonly animator: TurpalAnimator | null;
  private path: readonly NodeId[] = [];
  private pathIndex = 0;
  private segmentProgress = 0;
  private segmentLength = 1;

  /** Vecteurs réutilisés : zéro allocation dans la boucle (AGENTS.md § 4). */
  private readonly segmentStart = new Vector3();
  private readonly segmentEnd = new Vector3();
  private readonly lookTarget = new Vector3();
  private readonly finalTarget = new Vector3();
  private readonly currentUp = new Vector3(0, 1, 0);
  private readonly fromUp = new Vector3(0, 1, 0);
  private readonly targetUp = new Vector3(0, 1, 0);
  private readonly nextUp = new Vector3(0, 1, 0);
  private upBlendElapsed = TURPAL.upBlendMs / 1000;
  private upBlendDuration = TURPAL.upBlendMs / 1000;

  constructor(model?: ICharacterModel) {
    this.root.name = 'Turpal';
    this.animator = model ? new TurpalAnimator(model) : null;
    if (model) this.root.add(model.root);
  }

  get isMoving(): boolean {
    return this.machine.is('walking') || this.machine.is('climbing');
  }

  get movementProgress(): number {
    return this.segmentProgress;
  }

  placeAt(graph: NavGraph, nodeId: NodeId): void {
    const node = graph.getNode(nodeId);
    if (!node) return;
    this.currentNode = nodeId;
    this.path = [];
    this.pathIndex = 0;
    this.segmentProgress = 0;
    this.root.position.set(node.position.x, node.position.y, node.position.z);
    this.setUpImmediate(node.up);
    this.animator?.play('idle');
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

    const safe = trimPathToSafe(graph, this.path, Math.max(0, this.pathIndex - 1));
    if (safe.length === this.path.length) return false;

    this.path = safe;
    if (this.pathIndex >= safe.length) {
      this.pathIndex = safe.length;
      this.destinationMarker.hide();
      if (this.machine.is('walking') || this.machine.is('climbing')) {
        this.machine.transition('idle');
        this.animator?.play('idle');
      }
      return true;
    }

    this.prepareSegment(graph);
    return true;
  }

  /** Branche le recalcul de chemin sur tous les changements de mécanisme. */
  bindMechanismRevalidation(graph: NavGraph): () => void {
    return bus.on('mechanism:stateChanged', () => {
      this.revalidatePath(graph);
    });
  }

  /** Demande un déplacement. Retourne false si aucun chemin n'existe. */
  goTo(graph: NavGraph, nodeId: NodeId): boolean {
    if (this.currentNode === null) return false;
    const result = findPath(graph, this.currentNode, nodeId);
    if (!result.found || result.path.length < 2) {
      this.destinationMarker.hide();
      return false;
    }

    this.path = result.path;
    this.pathIndex = 1;
    this.segmentProgress = 0;
    this.prepareSegment(graph);

    const target = graph.getNode(nodeId);
    if (target) {
      this.finalTarget.set(target.position.x, target.position.y, target.position.z);
      this.nextUpFrom(target.up, this.nextUp);
      this.destinationMarker.show(this.finalTarget, this.nextUp);
    }
    return true;
  }

  /** Déclenche le salut main sur le cœur si un ancien est à portée. */
  saluteElder(graph: NavGraph, maxDistance = TURPAL.saluteDistance): boolean {
    const elders = graph.findNodesByTag('elder');
    const maxDistanceSq = maxDistance * maxDistance;
    for (const elder of elders) {
      const dx = elder.position.x - this.root.position.x;
      const dy = elder.position.y - this.root.position.y;
      const dz = elder.position.z - this.root.position.z;
      if (dx * dx + dy * dy + dz * dz > maxDistanceSq) continue;
      this.machine.transition('contemplating');
      this.animator?.play('salute', TURPAL.animationBlendMs / 1000);
      return true;
    }
    return false;
  }

  /** Pose de fin de chapitre : Turpal lève les yeux vers le ciel. */
  lookAtSky(): void {
    this.machine.transition('contemplating');
    this.animator?.play('lookSky', TURPAL.animationBlendMs / 1000);
  }

  /** Avance le long du chemin courant. */
  update(graph: NavGraph, delta: number): void {
    this.machine.update(delta);
    this.animator?.update(delta);
    this.destinationMarker.update(delta);
    this.updateUpBlend(delta);
    if (!this.isMoving) return;

    const nextId = this.path[this.pathIndex];
    if (nextId === undefined) {
      this.finishPath();
      return;
    }

    const step = PACING.walkSpeed * delta;
    this.segmentProgress = Math.min(1, this.segmentProgress + step / this.segmentLength);
    this.root.position.lerpVectors(this.segmentStart, this.segmentEnd, this.segmentProgress);
    this.updateFacing();

    if (this.segmentProgress < 1) return;

    const node = graph.getNode(nextId);
    if (!node) return;

    this.root.position.copy(this.segmentEnd);
    this.currentNode = nextId;
    this.pathIndex += 1;
    this.startUpTransition(node.up);

    if (this.pathIndex >= this.path.length) {
      this.finishPath();
      return;
    }

    this.prepareSegment(graph);
  }

  dispose(): void {
    this.animator?.dispose();
    this.destinationMarker.dispose();
    this.root.removeFromParent();
    this.root.clear();
  }

  private prepareSegment(graph: NavGraph): void {
    const startId = this.path[this.pathIndex - 1] ?? this.currentNode;
    const endId = this.path[this.pathIndex];
    if (!startId || !endId) return;

    const start = graph.getNode(startId);
    const end = graph.getNode(endId);
    if (!start || !end) return;

    this.segmentStart.set(start.position.x, start.position.y, start.position.z);
    this.segmentEnd.set(end.position.x, end.position.y, end.position.z);
    this.segmentLength = Math.max(0.0001, this.segmentStart.distanceTo(this.segmentEnd));
    this.segmentProgress = 0;

    const verticalDelta = end.position.y - start.position.y;
    if (Math.abs(verticalDelta) >= TURPAL.stairHeight * 0.5) {
      this.machine.transition('climbing');
      this.animator?.play(verticalDelta > 0 ? 'stepUp' : 'stepDown');
    } else {
      this.machine.transition('walking');
      this.animator?.play('walk');
    }
  }

  private finishPath(): void {
    this.path = [];
    this.pathIndex = 0;
    this.segmentProgress = 0;
    this.machine.transition('arrived');
    this.animator?.play('arrive');
  }

  private updateFacing(): void {
    this.lookTarget.lerpVectors(
      this.segmentStart,
      this.segmentEnd,
      Math.min(1, this.segmentProgress + TURPAL.pathLookAhead),
    );
    if (
      this.lookTarget.distanceToSquared(this.root.position) <=
      GRID.snapEpsilon * GRID.snapEpsilon
    )
      return;
    this.root.up.copy(this.currentUp);
    this.root.lookAt(this.lookTarget);
  }

  private setUpImmediate(up: NavUp): void {
    this.nextUpFrom(up, this.currentUp);
    this.fromUp.copy(this.currentUp);
    this.targetUp.copy(this.currentUp);
    this.upBlendElapsed = this.upBlendDuration;
    this.root.up.copy(this.currentUp);
  }

  private startUpTransition(up: NavUp): void {
    this.nextUpFrom(up, this.nextUp);
    if (this.nextUp.distanceToSquared(this.targetUp) <= GRID.snapEpsilon * GRID.snapEpsilon) return;
    this.fromUp.copy(this.currentUp);
    this.targetUp.copy(this.nextUp);
    this.upBlendElapsed = 0;
    this.upBlendDuration = TURPAL.upBlendMs / 1000;
  }

  private updateUpBlend(delta: number): void {
    if (this.upBlendElapsed >= this.upBlendDuration) return;
    this.upBlendElapsed = Math.min(this.upBlendDuration, this.upBlendElapsed + delta);
    const t = smootherstep(this.upBlendElapsed / this.upBlendDuration);
    this.currentUp.lerpVectors(this.fromUp, this.targetUp, t).normalize();
    this.root.up.copy(this.currentUp);
  }

  private nextUpFrom(up: NavUp, target: Vector3): void {
    target.set(up.x, up.y, up.z);
    if (target.lengthSq() === 0) target.copy(WORLD_UP);
    target.normalize();
  }
}

function smootherstep(value: number): number {
  const t = Math.min(1, Math.max(0, value));
  return t * t * t * (t * (t * 6 - 15) + 10);
}
