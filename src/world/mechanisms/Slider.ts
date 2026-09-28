/**
 * Slider.ts — bloc qui coulisse le long d'un rail, tiré au doigt.
 *
 * Le slider transforme le geste circulaire autour de sa poignée en progression
 * sur un rail borné. Au relâchement, il s'aimante au cran le plus proche avec
 * le même easing élastique discret que les rotateurs.
 */
import { Group, Vector3, type Object3D } from 'three';
import { bus } from '@core/EventBus';
import {
  BaseMechanism,
  clamp01,
  elasticOut,
  screenAngle,
  shortestAngleDelta,
  type MechanismContext,
  type MechanismDragPoint,
} from './Mechanism';
import type { NavGraph, NodeId } from '../NavGraph';

export interface SliderOptions {
  readonly axis?: 'x' | 'y' | 'z';
  /** Course totale en cellules. */
  readonly travel?: number;
  /** Nombre de positions d'arrêt. */
  readonly stops?: number;
  readonly initial?: number;
  readonly snapSeconds?: number;
  /** Nœuds transportés avec le sol lorsque le cran est validé. */
  readonly affectedNodes?: readonly NodeId[];
}

interface StagedObject {
  readonly object: Object3D;
  readonly from: Vector3;
  readonly to: Vector3;
  readonly stage: number;
}

export class Slider extends BaseMechanism {
  readonly root = new Group();
  readonly geometryRoot = new Group();
  readonly interactionRoot = this.geometryRoot;

  private readonly stagedObjects: StagedObject[] = [];
  private position: number;
  private dragStartPointerAngle = 0;
  private dragStartPosition = 0;
  private snapFrom = 0;
  private snapTo = 0;
  private snapElapsed = 0;
  private readonly axisVector = new Vector3();
  private readonly interactionPosition = new Vector3();
  private committedPosition: number;
  private snapDuration: number;

  constructor(
    id: string,
    private readonly options: SliderOptions = {},
  ) {
    super(id);
    this.root.name = `Slider:${id}`;
    this.geometryRoot.name = `SliderGeometry:${id}`;
    this.root.add(this.geometryRoot);
    this.position = clamp01(options.initial ?? 0);
    this.committedPosition = this.position;
    this.snapDuration = options.snapSeconds ?? 0.9;
    this.applyPosition();
    this.attachAffordance(0.2, 0.04);
    const affordance = this.root.getObjectByName(`MechanismAffordance:${id}`);
    if (affordance !== undefined) this.geometryRoot.add(affordance);
  }

  get normalizedPosition(): number {
    return this.position;
  }

  get currentStop(): number {
    return Math.round(this.position * (this.stops() - 1));
  }

  bindStagedObject(
    object: Object3D,
    target: readonly [number, number, number],
    stage: number,
  ): void {
    this.stagedObjects.push({
      object,
      from: object.position.clone(),
      to: new Vector3(target[0], target[1], target[2]),
      stage: Math.min(this.stops() - 1, Math.max(1, Math.round(stage))),
    });
    this.applyStagedObjects();
  }

  override attachPassenger(object: Object3D): void {
    if (this.passenger === object) return;
    this.passenger = object;
    this.geometryRoot.attach(object);
  }

  override detachPassenger(parent?: Object3D): void {
    if (this.passenger === null) return;
    if (parent !== undefined) parent.attach(this.passenger);
    else this.passenger.removeFromParent();
    this.passenger = null;
  }

  actuate(amount = 1): void {
    if (!this.interactive) return;
    this.startSnap(this.position + amount / (this.stops() - 1));
  }

  beginDrag(point: MechanismDragPoint): void {
    if (!this.interactive) return;
    this.dragStartPointerAngle = screenAngle(point);
    this.dragStartPosition = this.position;
    bus.emit('mechanism:drag', {
      id: this.id,
      kind: 'slider',
      active: true,
      at: this.eventPosition(),
    });
  }

  drag(point: MechanismDragPoint): void {
    if (!this.interactive) return;
    const delta = shortestAngleDelta(this.dragStartPointerAngle, screenAngle(point));
    this.position = clamp01(this.dragStartPosition + delta / (Math.PI * 2));
    this.applyPosition();
  }

  endDrag(): void {
    if (!this.interactive) return;
    bus.emit('mechanism:drag', {
      id: this.id,
      kind: 'slider',
      active: false,
      at: this.eventPosition(),
    });
    const stop = Math.round(this.position * (this.stops() - 1));
    this.startSnap(stop / (this.stops() - 1));
  }

  override update(context: MechanismContext, delta: number): void {
    super.update(context, delta);
    if (!this.animating) return;

    this.snapElapsed = Math.min(this.snapDuration, this.snapElapsed + delta);
    const t = elasticOut(this.snapElapsed / this.snapDuration);
    this.position = this.snapFrom + (this.snapTo - this.snapFrom) * t;
    this.applyPosition();

    if (this.snapElapsed < this.snapDuration) return;
    this.animating = false;
    this.position = this.snapTo;
    this.applyPosition();
    this.transformAffectedNodes(context.graph);
    this.committedPosition = this.position;
    this.applyToGraph(context.graph);
    this.emitSnap();
  }

  applyToGraph(graph: NavGraph): void {
    graph.setMechanismState(this.id, this.currentStop);
    bus.emit('mechanism:stateChanged', {
      id: this.id,
      kind: 'slider',
      value: this.currentStop,
      at: this.eventPosition(),
    });
  }

  private startSnap(position: number): void {
    this.snapFrom = this.position;
    this.snapTo = clamp01(position);
    this.snapElapsed = 0;
    this.animating = true;
  }

  private emitSnap(): void {
    bus.emit('mechanism:snap', {
      id: this.id,
      kind: 'slider',
      value: this.currentStop,
      notch: this.currentStop,
      sound: 'stone-slide-notch',
      at: this.eventPosition(),
      steps: this.stops(),
    });
  }

  protected override eventPosition(): { x: number; y: number; z: number } {
    this.interactionRoot.getWorldPosition(this.interactionPosition);
    return {
      x: this.interactionPosition.x,
      y: this.interactionPosition.y,
      z: this.interactionPosition.z,
    };
  }

  private transformAffectedNodes(graph: NavGraph): void {
    const nodes = this.options.affectedNodes;
    if (nodes === undefined || nodes.length === 0) return;
    const distance = (this.position - this.committedPosition) * (this.options.travel ?? 1);
    if (distance === 0) return;
    const axis = this.options.axis ?? 'x';
    for (const id of nodes) {
      const node = graph.getNode(id);
      if (node === undefined) continue;
      const mutable = node.position as { x: number; y: number; z: number };
      if (axis === 'x') mutable.x += distance;
      else if (axis === 'y') mutable.y += distance;
      else mutable.z += distance;
    }
  }

  private applyPosition(): void {
    this.axisVector.set(0, 0, 0);
    const axis = this.options.axis ?? 'x';
    if (axis === 'x') this.axisVector.x = 1;
    else if (axis === 'y') this.axisVector.y = 1;
    else this.axisVector.z = 1;

    const travel = this.options.travel ?? 1;
    const offset = (this.position - 0.5) * travel;
    this.geometryRoot.position.copy(this.axisVector).multiplyScalar(offset);
    this.applyStagedObjects();
  }

  private applyStagedObjects(): void {
    const stageCount = this.stops() - 1;
    for (const entry of this.stagedObjects) {
      const start = (entry.stage - 1) / stageCount;
      const progress = clamp01((this.position - start) * stageCount);
      entry.object.position.lerpVectors(entry.from, entry.to, progress);
    }
  }

  private stops(): number {
    return Math.max(2, this.options.stops ?? 2);
  }
}
