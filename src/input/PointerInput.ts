/**
 * PointerInput.ts — souris, stylet et doigt, unifiés par les Pointer Events.
 *
 * Le tactile est le support de référence (c'est là que le jeu sera le plus
 * joué) : seuil de glissement généreux, aucune dépendance au survol, et une
 * zone de tap tolérante — on ne rate jamais une tour parce qu'on a le pouce
 * large.
 */
import type { EventBus } from '@core/EventBus';
import type { InputEvents } from './InputManager';

/** Au-delà de ce déplacement (px), un tap devient un glissement. */
const DRAG_THRESHOLD_PX = 8;

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
    if (!this.dragging && travelled < DRAG_THRESHOLD_PX) return;

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
