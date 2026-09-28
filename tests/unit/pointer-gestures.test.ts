// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { POINTER } from '@/config';
import { EventBus } from '@core/EventBus';
import { PointerInput } from '@input/PointerInput';
import type { DragIntent, InputEvents, PointerIntent } from '@input/InputManager';

interface CaptureElement extends HTMLDivElement {
  setPointerCapture(pointerId: number): void;
  hasPointerCapture(pointerId: number): boolean;
  releasePointerCapture(pointerId: number): void;
}

function harness(): {
  readonly element: CaptureElement;
  readonly input: PointerInput;
  readonly bus: EventBus<InputEvents>;
  readonly captured: Set<number>;
} {
  const element: CaptureElement = document.createElement('div');
  const captured = new Set<number>();
  element.setPointerCapture = vi.fn((pointerId: number) => captured.add(pointerId));
  element.hasPointerCapture = vi.fn((pointerId: number) => captured.has(pointerId));
  element.releasePointerCapture = vi.fn((pointerId: number) => captured.delete(pointerId));
  document.body.appendChild(element);
  const bus = new EventBus<InputEvents>();
  return { element, input: new PointerInput(element, bus), bus, captured };
}

function pointer(type: string, pointerId: number, x: number, y: number): PointerEvent {
  const event = new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    clientX: x,
    clientY: y,
  });
  Object.defineProperty(event, 'pointerId', { value: pointerId });
  return event as unknown as PointerEvent;
}

afterEach(() => {
  vi.useRealTimers();
  document.body.replaceChildren();
});

describe('gestes PointerInput', () => {
  it('garde un déplacement inférieur à 8 px comme un tap', () => {
    const { element, input, bus, captured } = harness();
    const taps: PointerIntent[] = [];
    const drags: DragIntent[] = [];
    bus.on('tap', (intent) => taps.push(intent));
    bus.on('drag', (intent) => drags.push(intent));

    element.dispatchEvent(pointer('pointerdown', 7, 10, 20));
    element.dispatchEvent(pointer('pointermove', 7, 17, 20));
    element.dispatchEvent(pointer('pointerup', 7, 17, 20));

    expect(POINTER.dragThresholdPx).toBe(8);
    expect(taps).toHaveLength(1);
    expect(taps[0]).toMatchObject({ x: 17, y: 20 });
    expect(drags).toHaveLength(0);
    expect(captured.size).toBe(0);
    input.dispose();
  });

  it('capture le pointeur et démarre le drag sur la cible pressée, jamais sur celle traversée', () => {
    const { element, input, bus, captured } = harness();
    const starts: PointerIntent[] = [];
    const moves: DragIntent[] = [];
    const ends: DragIntent[] = [];
    const taps: PointerIntent[] = [];
    bus.on('dragStart', (intent) => starts.push(intent));
    bus.on('drag', (intent) => moves.push(intent));
    bus.on('dragEnd', (intent) => ends.push(intent));
    bus.on('tap', (intent) => taps.push(intent));

    element.dispatchEvent(pointer('pointerdown', 4, 10, 20));
    expect(captured.has(4)).toBe(true);
    element.dispatchEvent(pointer('pointermove', 4, 19, 20));
    element.dispatchEvent(pointer('pointermove', 4, 22, 24));
    element.dispatchEvent(pointer('pointerup', 4, 25, 25));

    expect(starts).toHaveLength(1);
    expect(starts[0]).toMatchObject({ x: 10, y: 20 });
    expect(moves).toHaveLength(2);
    expect(ends).toHaveLength(1);
    expect(taps).toHaveLength(0);
    expect(captured.size).toBe(0);
    input.dispose();
  });

  it('annule proprement sur pointercancel, perte de capture, suspension et blur', () => {
    const { element, input, bus } = harness();
    const ends: DragIntent[] = [];
    const taps: PointerIntent[] = [];
    bus.on('dragEnd', (intent) => ends.push(intent));
    bus.on('tap', (intent) => taps.push(intent));

    element.dispatchEvent(pointer('pointerdown', 1, 0, 0));
    element.dispatchEvent(pointer('pointercancel', 1, 0, 0));
    expect(taps).toHaveLength(0);

    element.dispatchEvent(pointer('pointerdown', 2, 0, 0));
    element.dispatchEvent(pointer('pointermove', 2, 10, 0));
    element.dispatchEvent(pointer('lostpointercapture', 2, 10, 0));

    element.dispatchEvent(pointer('pointerdown', 3, 0, 0));
    element.dispatchEvent(pointer('pointermove', 3, 10, 0));
    input.setSuspended(true);

    input.setSuspended(false);
    element.dispatchEvent(pointer('pointerdown', 4, 0, 0));
    element.dispatchEvent(pointer('pointermove', 4, 10, 0));
    window.dispatchEvent(new Event('blur'));

    expect(ends).toHaveLength(3);
    input.dispose();
  });

  it('transforme l’appui long en indice et avale le tap qui suit', () => {
    vi.useFakeTimers();
    const { element, input, bus } = harness();
    const longPresses: PointerIntent[] = [];
    const taps: PointerIntent[] = [];
    bus.on('longPress', (intent) => longPresses.push(intent));
    bus.on('tap', (intent) => taps.push(intent));

    element.dispatchEvent(pointer('pointerdown', 5, 30, 40));
    vi.advanceTimersByTime(POINTER.longPressMs);
    element.dispatchEvent(pointer('pointerup', 5, 30, 40));

    expect(longPresses).toHaveLength(1);
    expect(longPresses[0]).toMatchObject({ x: 30, y: 40 });
    expect(taps).toHaveLength(0);
    input.dispose();
  });

  it('bloque le menu contextuel et retire tous ses écouteurs à dispose()', () => {
    const { element, input } = harness();
    const blocked = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
    element.dispatchEvent(blocked);
    expect(blocked.defaultPrevented).toBe(true);

    input.dispose();
    const afterDispose = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
    element.dispatchEvent(afterDispose);
    expect(afterDispose.defaultPrevented).toBe(false);
  });
});
