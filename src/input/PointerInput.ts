/**
 * PointerInput.ts — souris, stylet et doigt, unifiés par les Pointer Events.
 *
 * Le tactile est le support de référence (c'est là que le jeu sera le plus
 * joué) : seuil de glissement généreux, aucune dépendance au survol, et une
 * zone de tap tolérante — on ne rate jamais une tour parce qu'on a le pouce
 * large.
 */
import { Raycaster, Vector2, type Camera, type Object3D } from 'three';
import { POINTER } from '@/config';
import type { EventBus } from '@core/EventBus';
import type { InputEvents } from './InputManager';
import type { NavGraph, NavNode, NavPosition } from '@world/NavGraph';

export interface PickableScreenTarget<T> {
  readonly value: T;
  readonly x: number;
  readonly y: number;
  /** Rayon réellement attrapable. Défaut : 10 px = petit levier de 20 px. */
  readonly radiusPx?: number;
  readonly enabled?: boolean;
}

export interface TolerantPick<T> {
  readonly value: T;
  readonly target: PickableScreenTarget<T>;
  readonly distancePx: number;
  /** 0 = rayon central, 1..4 = secours haut/droite/bas/gauche. */
  readonly sampleIndex: number;
  readonly sampleX: number;
  readonly sampleY: number;
  readonly usedFallback: boolean;
}

export interface PickWithToleranceOptions {
  readonly targetRadiusPx?: number;
  readonly fallbackOffsetPx?: number;
}

export interface PickWalkableNodeOptions {
  readonly x: number;
  readonly y: number;
  readonly viewportWidth: number;
  readonly viewportHeight: number;
  readonly camera: Camera;
  readonly walkableSurfaces: Object3D[];
  readonly graph: NavGraph;
  readonly isMobile?: boolean;
  readonly tolerancePx?: number;
  readonly snapMaxDistance?: number;
}

export interface WalkableNodePick {
  readonly node: NavNode;
  readonly hit: NavPosition;
  readonly surface: Object3D;
  readonly distanceToNode: number;
  readonly sampleIndex: number;
  readonly usedFallback: boolean;
}

const raycaster = new Raycaster();
const ndc = new Vector2();

export class PointerInput {
  private activePointerId: number | null = null;
  private startX = 0;
  private startY = 0;
  private lastX = 0;
  private lastY = 0;
  private dragging = false;

  constructor(
    private readonly element: HTMLElement,
    private readonly bus: EventBus<InputEvents>,
  ) {
    this.element.addEventListener('pointerdown', this.onPointerDown);
    this.element.addEventListener('pointermove', this.onPointerMove);
    this.element.addEventListener('pointerup', this.onPointerUp);
    this.element.addEventListener('pointercancel', this.onPointerUp);
    this.element.addEventListener('contextmenu', this.onContextMenu);
  }

  /**
   * Picking tactile tolérant.
   *
   * On teste d'abord le rayon central. S'il rate, on relance exactement quatre
   * rayons de secours à 12 px (haut, droite, bas, gauche) et on garde la cible
   * la plus proche du tap original. Ainsi, un petit levier de 20 px reste
   * attrapable au pouce sans créer une zone active invisible démesurée.
   */
  static pickWithTolerance<T>(
    x: number,
    y: number,
    targets: readonly PickableScreenTarget<T>[],
    options: PickWithToleranceOptions = {},
  ): TolerantPick<T> | null {
    const targetRadius = options.targetRadiusPx ?? POINTER.pickTargetRadiusPx;
    const fallbackOffset = options.fallbackOffsetPx ?? POINTER.fallbackRayOffsetPx;
    const central = pickAtSample(x, y, x, y, 0, targets, targetRadius);
    if (central) return central;

    let best: TolerantPick<T> | null = null;
    for (let sampleIndex = 1; sampleIndex <= 4; sampleIndex += 1) {
      const sampleX = x + sampleOffsetX(sampleIndex, fallbackOffset);
      const sampleY = y + sampleOffsetY(sampleIndex, fallbackOffset);
      const hit = pickAtSample(sampleX, sampleY, x, y, sampleIndex, targets, targetRadius);
      if (!hit) continue;
      if (!best || hit.distancePx < best.distancePx) best = hit;
    }
    return best;
  }

  /** Raycast sur les surfaces marchables puis snapping au nœud le plus proche. */
  static pickWalkableNode(options: PickWalkableNodeOptions): WalkableNodePick | null {
    const tolerance =
      options.tolerancePx ?? (options.isMobile === true ? POINTER.mobileRaycastTolerancePx : 0);
    const snapMaxDistance = options.snapMaxDistance ?? POINTER.walkableSnapMaxDistance;
    const central = raycastWalkableSample(options, options.x, options.y, 0, snapMaxDistance);
    if (central) return central;
    if (tolerance <= 0) return null;

    let best: WalkableNodePick | null = null;
    for (let sampleIndex = 1; sampleIndex <= 4; sampleIndex += 1) {
      const sampleX = options.x + sampleOffsetX(sampleIndex, tolerance);
      const sampleY = options.y + sampleOffsetY(sampleIndex, tolerance);
      const hit = raycastWalkableSample(options, sampleX, sampleY, sampleIndex, snapMaxDistance);
      if (!hit) continue;
      if (!best || hit.distanceToNode < best.distanceToNode) best = hit;
    }
    return best;
  }

  dispose(): void {
    this.element.removeEventListener('pointerdown', this.onPointerDown);
    this.element.removeEventListener('pointermove', this.onPointerMove);
    this.element.removeEventListener('pointerup', this.onPointerUp);
    this.element.removeEventListener('pointercancel', this.onPointerUp);
    this.element.removeEventListener('contextmenu', this.onContextMenu);
  }

  private readonly onContextMenu = (event: Event): void => event.preventDefault();

  private toIntent(event: PointerEvent): {
    x: number;
    y: number;
    ndcX: number;
    ndcY: number;
  } {
    const rect = this.element.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    return {
      x,
      y,
      ndcX: (x / Math.max(rect.width, 1)) * 2 - 1,
      ndcY: -((y / Math.max(rect.height, 1)) * 2 - 1),
    };
  }

  private readonly onPointerDown = (event: PointerEvent): void => {
    if (this.activePointerId !== null) return;
    this.activePointerId = event.pointerId;
    this.element.setPointerCapture(event.pointerId);

    const intent = this.toIntent(event);
    this.startX = intent.x;
    this.startY = intent.y;
    this.lastX = intent.x;
    this.lastY = intent.y;
    this.dragging = false;
    this.bus.emit('dragStart', intent);
  };

  private readonly onPointerMove = (event: PointerEvent): void => {
    if (event.pointerId !== this.activePointerId) return;
    const intent = this.toIntent(event);
    const travelled = Math.hypot(intent.x - this.startX, intent.y - this.startY);
    if (!this.dragging && travelled < POINTER.dragThresholdPx) return;

    this.dragging = true;
    this.bus.emit('drag', {
      ...intent,
      deltaX: intent.x - this.lastX,
      deltaY: intent.y - this.lastY,
    });
    this.lastX = intent.x;
    this.lastY = intent.y;
  };

  private readonly onPointerUp = (event: PointerEvent): void => {
    if (event.pointerId !== this.activePointerId) return;
    const intent = this.toIntent(event);

    if (this.dragging) {
      this.bus.emit('dragEnd', {
        ...intent,
        deltaX: intent.x - this.lastX,
        deltaY: intent.y - this.lastY,
      });
    } else {
      this.bus.emit('tap', intent);
    }

    if (this.element.hasPointerCapture(event.pointerId)) {
      this.element.releasePointerCapture(event.pointerId);
    }
    this.activePointerId = null;
    this.dragging = false;
  };
}

function pickAtSample<T>(
  sampleX: number,
  sampleY: number,
  originX: number,
  originY: number,
  sampleIndex: number,
  targets: readonly PickableScreenTarget<T>[],
  defaultRadius: number,
): TolerantPick<T> | null {
  let bestTarget: PickableScreenTarget<T> | null = null;
  let bestDistanceSq = Number.POSITIVE_INFINITY;

  for (const target of targets) {
    if (target.enabled === false) continue;
    const radius = target.radiusPx ?? defaultRadius;
    const sampleDx = target.x - sampleX;
    const sampleDy = target.y - sampleY;
    if (sampleDx * sampleDx + sampleDy * sampleDy > radius * radius) continue;

    const originDx = target.x - originX;
    const originDy = target.y - originY;
    const distanceSq = originDx * originDx + originDy * originDy;
    if (distanceSq >= bestDistanceSq) continue;
    bestDistanceSq = distanceSq;
    bestTarget = target;
  }

  if (!bestTarget) return null;
  return {
    value: bestTarget.value,
    target: bestTarget,
    distancePx: Math.sqrt(bestDistanceSq),
    sampleIndex,
    sampleX,
    sampleY,
    usedFallback: sampleIndex !== 0,
  };
}

function raycastWalkableSample(
  options: PickWalkableNodeOptions,
  sampleX: number,
  sampleY: number,
  sampleIndex: number,
  snapMaxDistance: number,
): WalkableNodePick | null {
  ndc.set(
    (sampleX / Math.max(options.viewportWidth, 1)) * 2 - 1,
    -((sampleY / Math.max(options.viewportHeight, 1)) * 2 - 1),
  );
  raycaster.setFromCamera(ndc, options.camera);
  const hits = raycaster.intersectObjects(options.walkableSurfaces, true);
  for (const hit of hits) {
    const node = options.graph.nearest(hit.point, snapMaxDistance);
    if (!node) continue;
    return {
      node,
      hit: { x: hit.point.x, y: hit.point.y, z: hit.point.z },
      surface: hit.object,
      distanceToNode: Math.hypot(
        hit.point.x - node.position.x,
        hit.point.y - node.position.y,
        hit.point.z - node.position.z,
      ),
      sampleIndex,
      usedFallback: sampleIndex !== 0,
    };
  }
  return null;
}

function sampleOffsetX(sampleIndex: number, offset: number): number {
  if (sampleIndex === 2) return offset;
  if (sampleIndex === 4) return -offset;
  return 0;
}

function sampleOffsetY(sampleIndex: number, offset: number): number {
  if (sampleIndex === 1) return -offset;
  if (sampleIndex === 3) return offset;
  return 0;
}
