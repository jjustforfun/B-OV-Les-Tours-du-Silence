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
import type { NavGraph } from '../NavGraph';

export interface SliderOptions {
  readonly axis?: 'x' | 'y' | 'z';
  /** Course totale en cellules. */
  readonly travel?: number;
  /** Nombre de positions d'arrêt. */
  readonly stops?: number;
  readonly initial?: number;
  readonly snapSeconds?: number;
}

export class Slider extends BaseMechanism {
  readonly root: Object3D = new Group();

  private position: number;
  private dragStartPointerAngle = 0;
  private dragStartPosition = 0;
  private snapFrom = 0;
  private snapTo = 0;
  private snapElapsed = 0;
  private readonly axisVector = new Vector3();
  private snapDuration: number;

  constructor(
    id: string,
    private readonly options: SliderOptions = {},
  ) {
    super(id);
    this.root.name = `Slider:${id}`;
    this.position = clamp01(options.initial ?? 0);
    this.snapDuration = options.snapSeconds ?? 0.9;
    this.applyPosition();
    this.attachAffordance(0.2, 0.04);
  }

  get normalizedPosition(): number {
    return this.position;
  }

  get currentStop(): number {
    return Math.round(this.position * (this.stops() - 1));
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

  private applyPosition(): void {
    this.axisVector.set(0, 0, 0);
    const axis = this.options.axis ?? 'x';
    if (axis === 'x') this.axisVector.x = 1;
    else if (axis === 'y') this.axisVector.y = 1;
    else this.axisVector.z = 1;

    const travel = this.options.travel ?? 1;
    const offset = (this.position - 0.5) * travel;
    this.root.position.copy(this.axisVector).multiplyScalar(offset);
  }

  private stops(): number {
    return Math.max(2, this.options.stops ?? 2);
  }
}
