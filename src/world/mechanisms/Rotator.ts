/**
 * Rotator.ts — plateforme ou passerelle qui pivote autour d'un axe.
 *
 * Le rotateur suit le doigt par l'angle écran autour de sa poignée projetée,
 * puis s'aimante sur un cran de grille avec un easing élastique discret. À
 * chaque cran validé, il publie un événement son et recâble le NavGraph.
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
import type { NavGraph } from '../NavGraph';

export type RotatorAxis = 'x' | 'y' | 'z';

export interface RotatorOptions {
  readonly axis?: RotatorAxis;
  readonly stepDeg?: number;
  readonly steps?: number;
  readonly initialStep?: number;
  readonly snapSeconds?: number;
}

const RESISTANCE_DEG = 15;
const RESISTANCE_FACTOR = 0.85;

export class Rotator extends BaseMechanism {
  readonly root: Object3D = new Group();

  private step: number;
  private angleRad = 0;
  private dragStartPointerAngle = 0;
  private dragStartAngle = 0;
  private snapFrom = 0;
  private snapTo = 0;
  private snapElapsed = 0;
  private snapDuration: number;

  constructor(
    id: string,
    private readonly options: RotatorOptions = {},
  ) {
    super(id);
    this.root.name = `Rotator:${id}`;
    this.step = options.initialStep ?? 0;
    this.snapDuration = options.snapSeconds ?? 0.9;
    this.angleRad = this.stepToAngle(this.step);
    this.applyRotation();
    this.attachAffordance(0.28, 0.045);
  }

  get currentStep(): number {
    return this.step;
  }

  get currentAngleRad(): number {
    return this.angleRad;
  }

  actuate(amount = 1): void {
    if (!this.interactive) return;
    this.startSnap(this.step + Math.round(amount));
  }

  beginDrag(point: MechanismDragPoint): void {
    if (!this.interactive) return;
    this.dragStartPointerAngle = screenAngle(point);
    this.dragStartAngle = this.angleRad;
    bus.emit('mechanism:drag', {
      id: this.id,
      kind: 'rotator',
      active: true,
      at: this.eventPosition(),
    });
  }

  drag(point: MechanismDragPoint): void {
    if (!this.interactive) return;
    const delta = shortestAngleDelta(this.dragStartPointerAngle, screenAngle(point));
    this.angleRad = this.dragStartAngle + resistedDelta(delta, this.stepAngleRad());
    this.applyRotation();
  }

  endDrag(): void {
    if (!this.interactive) return;
    bus.emit('mechanism:drag', {
      id: this.id,
      kind: 'rotator',
      active: false,
      at: this.eventPosition(),
    });
    this.startSnap(Math.round(this.angleRad / this.stepAngleRad()));
  }

  override update(context: MechanismContext, delta: number): void {
    super.update(context, delta);
    if (!this.animating) return;

    this.snapElapsed = Math.min(this.snapDuration, this.snapElapsed + delta);
    const t = elasticOut(this.snapElapsed / this.snapDuration);
    this.angleRad = this.snapFrom + (this.snapTo - this.snapFrom) * t;
    this.applyRotation();

    if (this.snapElapsed < this.snapDuration) return;
    this.animating = false;
    this.angleRad = this.snapTo;
    this.step = normalizeStep(Math.round(this.angleRad / this.stepAngleRad()), this.stepCount());
    this.applyRotation();
    this.applyToGraph(context.graph);
    this.emitSnap();
  }

  applyToGraph(graph: NavGraph): void {
    graph.setMechanismState(this.id, this.stateValue());
    bus.emit('mechanism:stateChanged', {
      id: this.id,
      kind: 'rotator',
      value: this.stateValue(),
      at: this.eventPosition(),
    });
  }

  private startSnap(rawStep: number): void {
    this.step = normalizeStep(rawStep, this.stepCount());
    this.snapFrom = this.angleRad;
    this.snapTo = this.stepToAngle(this.step);
    this.snapElapsed = 0;
    this.animating = true;
  }

  private emitSnap(): void {
    bus.emit('mechanism:snap', {
      id: this.id,
      kind: 'rotator',
      value: this.stateValue(),
      notch: this.step,
      sound: 'stone-notch',
      at: this.eventPosition(),
      steps: this.stepCount(),
    });
  }

  private stateValue(): number {
    return this.step * this.stepDeg();
  }

  private applyRotation(): void {
    const axis = this.options.axis ?? 'y';
    this.root.rotation.set(0, 0, 0);
    if (axis === 'x') this.root.rotation.x = this.angleRad;
    else if (axis === 'z') this.root.rotation.z = this.angleRad;
    else this.root.rotation.y = this.angleRad;
  }

  private stepToAngle(step: number): number {
    return normalizeStep(step, this.stepCount()) * this.stepAngleRad();
  }

  private stepAngleRad(): number {
    return (this.stepDeg() * Math.PI) / 180;
  }

  private stepDeg(): number {
    return this.options.stepDeg ?? 90;
  }

  private stepCount(): number {
    return this.options.steps ?? Math.max(1, Math.round(360 / this.stepDeg()));
  }
}

function normalizeStep(step: number, steps: number): number {
  return ((step % steps) + steps) % steps;
}

function resistedDelta(delta: number, stepAngle: number): number {
  const firstBand = (RESISTANCE_DEG * Math.PI) / 180;
  const sign = Math.sign(delta) || 1;
  const absolute = Math.abs(delta);
  if (absolute <= firstBand) return delta * RESISTANCE_FACTOR;
  const inStep = absolute % stepAngle;
  if (inStep <= firstBand) {
    return sign * (absolute - inStep + inStep * RESISTANCE_FACTOR);
  }
  return delta;
}
