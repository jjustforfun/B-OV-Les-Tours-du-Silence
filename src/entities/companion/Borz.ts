/**
 * Borz.ts — le loup de pierre. « Борз » = loup en tchétchène (vérifié 2026-09 :
 * dictionnaire Glosbe fr-ce ; Contes tchétchènes, Frison & Outtier, Fayard 2002 —
 * voir docs/CULTURE.md § 3).
 *
 * Borz possède son propre graphe, composé uniquement de nœuds tagués `borz`.
 * Appelé par un tap, il rejoint Turpal par ce graphe. Il peut aussi porter
 * Turpal temporairement, servir de marche/pont et signaler un indice par ses
 * yeux d'ambre pulsants.
 */
import {
  CapsuleGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  SphereGeometry,
  Vector3,
  type BufferGeometry,
  type Material,
  type Object3D,
} from 'three';
import { bus } from '@core/EventBus';
import { EMBER } from '@render/Palettes';
import { PACING } from '@/config';
import { NavGraph, type NavEdge, type NodeId } from '@world/NavGraph';
import { findPath } from '@world/Pathfinder';

export type BorzState = 'dormant' | 'waiting' | 'following' | 'carrying' | 'watching' | 'hinting';

const BORZ_SPEED = PACING.walkSpeed * 0.92;
const WATCH_DISTANCE = 4;

export class Borz {
  readonly root = new Group();
  readonly ownGraph = new NavGraph();

  state: BorzState = 'waiting';
  currentNode: NodeId | null = null;

  private readonly head = new Group();
  private readonly eyes: Mesh[] = [];
  private readonly geometries: BufferGeometry[] = [];
  private readonly materials: Material[] = [];
  private readonly segmentStart = new Vector3();
  private readonly segmentEnd = new Vector3();
  private readonly tmp = new Vector3();
  private path: readonly NodeId[] = [];
  private pathIndex = 0;
  private segmentProgress = 0;
  private segmentLength = 1;
  private passenger: Object3D | null = null;
  private hinting = false;
  private dormant = false;
  private routeCompletionPending = false;
  private resting = false;
  private awakenElapsed = 0;
  private elapsed = 0;
  private eyePulseValue = 0;

  constructor() {
    this.root.name = 'Borz';
    this.buildVisuals();
  }

  get knowsHint(): boolean {
    return this.hinting;
  }

  get eyePulse(): number {
    return this.eyePulseValue;
  }

  get isMoving(): boolean {
    return this.path.length > 0;
  }

  get hasPassenger(): boolean {
    return this.passenger !== null;
  }

  get isResting(): boolean {
    return this.resting;
  }

  /** Épilogue : Borz se couche près de Turpal et referme les yeux. */
  lieDown(): void {
    if (this.resting) return;
    this.resting = true;
    this.root.scale.set(1, 0.72, 1);
    this.head.position.y = 0.2;
    this.eyePulseValue = 0.06;
  }

  /** Prologue : Borz est encore une sculpture, yeux éteints et immobile. */
  sleepStone(): void {
    this.dormant = true;
    this.state = 'dormant';
    this.eyePulseValue = 0;
    for (const eye of this.eyes) {
      if (eye.material instanceof MeshBasicMaterial) eye.material.opacity = 0;
    }
  }

  /** La paume sur la pierre rend ses yeux d'ambre au gardien. */
  awaken(): void {
    if (!this.dormant) return;
    this.dormant = false;
    this.state = 'waiting';
    this.awakenElapsed = 1.6;
    bus.emit('borz:awakened', { nodeId: this.currentNode });
  }

  placeAt(graph: NavGraph, nodeId: NodeId): void {
    const node = graph.getNode(nodeId);
    if (!node) return;
    this.currentNode = nodeId;
    this.root.position.set(node.position.x, node.position.y, node.position.z);
  }

  /** Copie seulement les nœuds/arêtes autorisés à Borz. */
  rebuildOwnGraph(source: NavGraph): void {
    this.ownGraph.clear();
    for (const node of source.allNodes()) {
      if (!node.tags.has('borz')) continue;
      this.ownGraph.addNode(node.id, node.position, [...node.tags], node.up, node.surface);
    }
    for (const edge of source.allEdges()) this.copyBorzEdge(edge);
    this.syncOwnGraphStates(source);
  }

  /** Tap sur Borz : il rejoint le nœud Borz le plus proche de Turpal. */
  callTo(source: NavGraph, turpalNode: NodeId): boolean {
    if (this.dormant || this.currentNode === null) return false;
    if (this.ownGraph.nodeCount === 0) this.rebuildOwnGraph(source);
    else this.syncOwnGraphStates(source);
    const target = this.closestOwnNodeTo(source, turpalNode);
    if (!target) return false;
    if (target === this.currentNode) {
      this.state = this.hinting ? 'hinting' : 'waiting';
      bus.emit('borz:called', { from: this.currentNode, to: target });
      return true;
    }
    const result = findPath(this.ownGraph, this.currentNode, target);
    if (!result.found || result.path.length < 2) return false;
    this.path = result.path;
    this.pathIndex = 1;
    this.routeCompletionPending = false;
    this.prepareSegment();
    this.state = 'following';
    bus.emit('borz:called', { from: this.currentNode, to: target });
    return true;
  }

  /**
   * Trajet narratif explicite, utilisé quand Borz porte quelqu'un d'autre que
   * Turpal. Le premier nœud doit être sa position courante et chaque segment
   * doit appartenir à son graphe propre.
   */
  startPath(source: NavGraph, path: readonly NodeId[]): boolean {
    if (this.dormant || this.isMoving || this.currentNode === null || path.length < 2) return false;
    if (path[0] !== this.currentNode) return false;
    this.rebuildOwnGraph(source);
    for (let index = 0; index < path.length - 1; index += 1) {
      const from = path[index];
      const to = path[index + 1];
      if (from === undefined || to === undefined) return false;
      if (!this.ownGraph.neighbors(from).some((edge) => edge.to === to)) return false;
    }
    this.path = [...path];
    this.pathIndex = 1;
    this.routeCompletionPending = false;
    this.prepareSegment();
    this.state = 'following';
    return true;
  }

  /** Retourne vrai une seule fois après l'arrivée d'un trajet explicite. */
  consumeRouteCompletion(): boolean {
    if (!this.routeCompletionPending) return false;
    this.routeCompletionPending = false;
    return true;
  }

  /** Borz couché en travers : il ouvre une arête conditionnelle de pont. */
  serveAsBridge(graph: NavGraph, from: NodeId, to: NodeId, enabled = true): void {
    if (!graph.getEdge(from, to)) {
      graph.connect(from, to, { condition: { mechanism: 'borz.bridge', equals: true } });
    }
    graph.setMechanismState('borz.bridge', enabled);
    this.state = enabled ? 'carrying' : 'waiting';
  }

  /** Borz comme marche : rend un nœud auxiliaire praticable ou non. */
  serveAsStep(graph: NavGraph, node: NodeId, enabled = true): void {
    graph.setNodeEnabled(node, enabled);
    graph.setMechanismState('borz.step', enabled);
    this.state = enabled ? 'carrying' : 'waiting';
  }

  attachPassenger(object: Object3D): void {
    this.passenger = object;
    this.root.attach(object);
    this.state = 'carrying';
  }

  detachPassenger(parent?: Object3D): void {
    if (!this.passenger) return;
    if (parent) parent.attach(this.passenger);
    else this.passenger.removeFromParent();
    this.passenger = null;
    this.state = 'waiting';
  }

  setHintActive(active: boolean): void {
    this.hinting = active;
    this.state = active ? 'hinting' : 'waiting';
    bus.emit('borz:hint', { active });
  }

  /**
   * Second indice (docs/tasks Phase 7) : après une longue inactivité, Borz
   * regarde dans la direction de l'élément utile. Il ne dit rien — il montre.
   */
  gazeAt(position: Vector3): void {
    this.setHintActive(true);
    this.head.lookAt(position);
  }

  clearGaze(): void {
    if (!this.hinting) return;
    this.setHintActive(false);
  }

  lookAtTurpal(position: Vector3): void {
    const distance = this.root.position.distanceTo(position);
    if (distance <= WATCH_DISTANCE) return;
    this.state = this.hinting ? 'hinting' : 'watching';
    this.head.lookAt(position);
  }

  update(delta: number): void {
    this.elapsed += delta;
    this.awakenElapsed = Math.max(0, this.awakenElapsed - delta);
    this.updateEyes();
    if (!this.isMoving) return;

    const nextId = this.path[this.pathIndex];
    if (nextId === undefined) {
      this.finishPath();
      return;
    }

    this.segmentProgress = Math.min(
      1,
      this.segmentProgress + (BORZ_SPEED * delta) / this.segmentLength,
    );
    this.root.position.lerpVectors(this.segmentStart, this.segmentEnd, this.segmentProgress);
    this.tmp.copy(this.segmentEnd).sub(this.root.position);
    if (this.tmp.lengthSq() > 0.0001) this.root.lookAt(this.segmentEnd);

    if (this.segmentProgress < 1) return;
    this.currentNode = nextId;
    this.pathIndex += 1;
    if (this.pathIndex >= this.path.length) {
      this.finishPath();
      return;
    }
    this.prepareSegment();
  }

  dispose(): void {
    this.detachPassenger();
    for (const geometry of this.geometries) geometry.dispose();
    for (const material of this.materials) material.dispose();
    this.ownGraph.clear();
    this.root.removeFromParent();
    this.root.clear();
  }

  private syncOwnGraphStates(source: NavGraph): void {
    for (const edge of source.allEdges()) {
      for (const condition of edge.conditions) {
        const value = source.getMechanismState(condition.mechanism);
        if (value !== undefined) this.ownGraph.setMechanismState(condition.mechanism, value);
      }
    }
  }

  private copyBorzEdge(edge: NavEdge): void {
    if (!this.ownGraph.hasNode(edge.from) || !this.ownGraph.hasNode(edge.to)) return;
    this.ownGraph.connect(edge.from, edge.to, {
      oneWay: true,
      cost: edge.cost,
      illusory: edge.illusory,
      ...(edge.conditions.length === 0 ? {} : { conditions: edge.conditions }),
    });
    if (edge.illusory && !edge.illusionActive) {
      this.ownGraph.setIllusoryConnectionEnabled(edge.from, edge.to, false, false);
    }
  }

  private closestOwnNodeTo(source: NavGraph, targetNode: NodeId): NodeId | null {
    const target = source.getNode(targetNode);
    if (!target) return null;
    const closest = this.ownGraph.nearest(target.position);
    return closest?.id ?? null;
  }

  private prepareSegment(): void {
    const startId = this.path[this.pathIndex - 1] ?? this.currentNode;
    const endId = this.path[this.pathIndex];
    if (!startId || !endId) return;
    const start = this.ownGraph.getNode(startId);
    const end = this.ownGraph.getNode(endId);
    if (!start || !end) return;
    this.segmentStart.set(start.position.x, start.position.y, start.position.z);
    this.segmentEnd.set(end.position.x, end.position.y, end.position.z);
    this.segmentLength = Math.max(0.0001, this.segmentStart.distanceTo(this.segmentEnd));
    this.segmentProgress = 0;
  }

  private finishPath(): void {
    this.path = [];
    this.pathIndex = 0;
    this.segmentProgress = 0;
    this.routeCompletionPending = true;
    this.state = this.hinting ? 'hinting' : 'waiting';
  }

  private updateEyes(): void {
    if (this.dormant) this.eyePulseValue = 0;
    else if (this.resting) this.eyePulseValue = 0.06;
    else if (this.awakenElapsed > 0) {
      this.eyePulseValue = 0.7 + Math.sin(this.elapsed * 7.4) * 0.28;
    } else {
      this.eyePulseValue = this.hinting ? 0.55 + Math.sin(this.elapsed * 5.2) * 0.35 : 0.22;
    }
    for (const eye of this.eyes) {
      const material = eye.material;
      if (material instanceof MeshBasicMaterial) material.opacity = this.eyePulseValue;
      eye.scale.setScalar(1 + this.eyePulseValue * 0.18);
    }
  }

  private buildVisuals(): void {
    const stone = this.material(0x5d6574, 0.95);
    const dark = this.material(0x303744, 1);
    const amber = this.material(EMBER, 0.55);

    const body = new Mesh(this.geometry(new CapsuleGeometry(0.16, 0.42, 4, 10)), stone);
    body.name = 'BorzBody';
    body.rotation.z = Math.PI / 2;
    body.position.y = 0.22;
    this.root.add(body);

    this.head.name = 'BorzHead';
    this.head.position.set(0.28, 0.28, 0);
    const headMesh = new Mesh(this.geometry(new SphereGeometry(0.13, 10, 8)), stone);
    headMesh.scale.set(1.18, 0.82, 0.72);
    this.head.add(headMesh);
    this.root.add(this.head);

    for (const z of [-0.045, 0.045]) {
      const eye = new Mesh(this.geometry(new SphereGeometry(0.018, 8, 6)), amber);
      eye.name = 'BorzAmberEye';
      eye.position.set(0.08, 0.02, z);
      this.head.add(eye);
      this.eyes.push(eye);
    }

    for (const x of [-0.18, 0.12]) {
      for (const z of [-0.075, 0.075]) {
        const leg = new Mesh(this.geometry(new CapsuleGeometry(0.035, 0.18, 3, 7)), dark);
        leg.name = 'BorzLeg';
        leg.position.set(x, 0.1, z);
        this.root.add(leg);
      }
    }
  }

  private geometry<T extends BufferGeometry>(geometry: T): T {
    this.geometries.push(geometry);
    return geometry;
  }

  private material(color: number, opacity: number): MeshBasicMaterial {
    const material = new MeshBasicMaterial({ color, transparent: opacity < 1, opacity });
    this.materials.push(material);
    return material;
  }
}
