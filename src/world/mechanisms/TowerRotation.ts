/**
 * TowerRotation.ts — rotation d'une tour vainakh entière.
 *
 * Le mécanisme signature : un sous-arbre de géométrie et les nœuds qui lui
 * appartiennent tournent ensemble. Le graphe est recâblé au cran final, puis
 * les illusions peuvent être reprojetées par le runtime.
 */
import { Group, type Object3D } from 'three';
import { bus } from '@core/EventBus';
import {
  BaseMechanism,
  elasticOut,
  screenAngle,
  shortestAngleDelta,
  type MechanismContext,
  type MechanismDragPoint,
} from './Mechanism';
import type { NavGraph, NodeId } from '../NavGraph';

export interface TowerRotationOptions {
  /** Nombre de faces utiles de la tour (4 par défaut). */
  readonly faces?: number;
  /** Rotation possible dans les deux sens. */
  readonly bidirectional?: boolean;
  readonly initialFace?: number;
  readonly snapSeconds?: number;
  readonly center?: readonly [number, number, number];
  readonly affectedNodes?: readonly NodeId[];
}

export class TowerRotation extends BaseMechanism {
  readonly root: Object3D = new Group();

  private face: number;
  private angleRad = 0;
  private dragStartPointerAngle = 0;
  private dragStartAngle = 0;
  private snapFrom = 0;
  private snapTo = 0;
  private snapElapsed = 0;
  private silenceElapsed = 0;
  private readonly snapDuration: number;

  constructor(
    id: string,
    private readonly options: TowerRotationOptions = {},
  ) {
    super(id);
    this.root.name = `TowerRotation:${id}`;
    this.face = options.initialFace ?? 0;
    this.snapDuration = options.snapSeconds ?? 1.2;
    this.angleRad = this.faceToAngle(this.face);
    this.applyRotation();
    this.attachAffordance(0.34, 0.055);
  }

  get currentFace(): number {
    return this.face;
  }

  get isInSilence(): boolean {
    return this.silenceElapsed > 0;
  }

  attachSubtree(object: Object3D): void {
    this.root.attach(object);
  }

  actuate(amount = 1): void {
    if (!this.interactive) return;
    const direction = this.options.bidirectional === false ? 1 : Math.sign(amount) || 1;
    this.startSnap(this.face + direction);
  }

  beginDrag(point: MechanismDragPoint): void {
    if (!this.interactive) return;
    this.dragStartPointerAngle = screenAngle(point);
    this.dragStartAngle = this.angleRad;
    bus.emit('mechanism:drag', {
      id: this.id,
      kind: 'towerRotation',
      active: true,
      at: this.eventPosition(),
    });
  }

  drag(point: MechanismDragPoint): void {
    if (!this.interactive) return;
    this.angleRad =
      this.dragStartAngle + shortestAngleDelta(this.dragStartPointerAngle, screenAngle(point));
    this.applyRotation();
  }

  endDrag(): void {
    if (!this.interactive) return;
    bus.emit('mechanism:drag', {
      id: this.id,
      kind: 'towerRotation',
      active: false,
      at: this.eventPosition(),
    });
    this.startSnap(Math.round(this.angleRad / this.faceAngleRad()));
  }

  override update(context: MechanismContext, delta: number): void {
    super.update(context, delta);
    if (this.silenceElapsed > 0) this.silenceElapsed = Math.max(0, this.silenceElapsed - delta);
    if (!this.animating) return;

    this.snapElapsed = Math.min(this.snapDuration, this.snapElapsed + delta);
    const t = elasticOut(this.snapElapsed / this.snapDuration);
    this.angleRad = this.snapFrom + (this.snapTo - this.snapFrom) * t;
    this.root.position.y =
      Math.sin(Math.min(1, this.snapElapsed / this.snapDuration) * Math.PI) * 0.05;
    this.applyRotation();

    if (this.snapElapsed < this.snapDuration) return;
    this.animating = false;
    this.root.position.y = 0;
    this.angleRad = this.snapTo;
    this.face = normalizeFace(Math.round(this.angleRad / this.faceAngleRad()), this.faces());
    this.applyRotation();
    this.transformAffectedNodes(context.graph);
    this.applyToGraph(context.graph);
    this.silenceElapsed = 0.4;
    bus.emit('mechanism:snap', {
      id: this.id,
      kind: 'towerRotation',
      value: this.face,
      notch: this.face,
      sound: 'tower-stone-notch',
      at: this.eventPosition(),
      steps: this.faces(),
    });
  }

  applyToGraph(graph: NavGraph): void {
    graph.setMechanismState(this.id, this.face);
    bus.emit('mechanism:stateChanged', {
      id: this.id,
      kind: 'towerRotation',
      value: this.face,
      at: this.eventPosition(),
    });
  }

  private startSnap(rawFace: number): void {
    this.face = normalizeFace(rawFace, this.faces());
    this.snapFrom = this.angleRad;
    this.snapTo = this.faceToAngle(this.face);
    this.snapElapsed = 0;
    this.animating = true;
  }

  private transformAffectedNodes(graph: NavGraph): void {
    const nodes = this.options.affectedNodes;
    if (!nodes || nodes.length === 0) return;
    const center = this.options.center ?? [0, 0, 0];
    const cos = Math.cos(this.faceAngleRad());
    const sin = Math.sin(this.faceAngleRad());

    for (const id of nodes) {
      const node = graph.getNode(id);
      if (!node) continue;
      const mutable = node.position as { x: number; y: number; z: number };
      const dx = mutable.x - center[0];
      const dz = mutable.z - center[2];
      mutable.x = center[0] + dx * cos - dz * sin;
      mutable.z = center[2] + dx * sin + dz * cos;
    }
  }

  private applyRotation(): void {
    this.root.rotation.y = this.angleRad;
  }

  private faceToAngle(face: number): number {
    return normalizeFace(face, this.faces()) * this.faceAngleRad();
  }

  private faceAngleRad(): number {
    return (Math.PI * 2) / this.faces();
  }

  private faces(): number {
    return Math.max(1, this.options.faces ?? 4);
  }
}

function normalizeFace(face: number, faces: number): number {
  return ((face % faces) + faces) % faces;
}
