// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { EventBus } from '@core/EventBus';
import { KeyboardInput, type KeyboardTarget } from '@input/KeyboardInput';
import { keyLayout } from '@input/KeyLayout';
import type { InputAction, InputEvents } from '@input/InputManager';

class TestKeyboardTarget implements KeyboardTarget {
  private listener: ((event: KeyboardEvent) => void) | null = null;

  addEventListener(_type: string, listener: (event: KeyboardEvent) => void): void {
    this.listener = listener;
  }

  removeEventListener(_type: string, listener: (event: KeyboardEvent) => void): void {
    if (this.listener === listener) this.listener = null;
  }

  dispatch(event: KeyboardEvent): void {
    this.listener?.(event);
  }
}

function key(
  code: string,
  options: {
    readonly key?: string;
    readonly shiftKey?: boolean;
    readonly repeat?: boolean;
    readonly target?: EventTarget | null;
  } = {},
): KeyboardEvent & { readonly preventDefault: ReturnType<typeof vi.fn> } {
  const preventDefault = vi.fn();
  return {
    code,
    key: options.key ?? code,
    shiftKey: options.shiftKey ?? false,
    repeat: options.repeat ?? false,
    target: options.target ?? null,
    preventDefault,
  } as unknown as KeyboardEvent & { readonly preventDefault: ReturnType<typeof vi.fn> };
}

function keyboardHarness(): {
  readonly keyboard: KeyboardInput;
  readonly target: TestKeyboardTarget;
  readonly moves: { dx: number; dy: number }[];
  readonly actions: InputAction[];
  readonly confirms: number[];
  readonly cancels: number[];
  readonly pauses: number[];
} {
  const bus = new EventBus<InputEvents>();
  const target = new TestKeyboardTarget();
  const moves: { dx: number; dy: number }[] = [];
  const actions: InputAction[] = [];
  const confirms: number[] = [];
  const cancels: number[] = [];
  const pauses: number[] = [];
  bus.on('move', (move) => moves.push(move));
  bus.on('action', (action) => actions.push(action));
  bus.on('confirm', () => confirms.push(1));
  bus.on('cancel', () => cancels.push(1));
  bus.on('pause', () => pauses.push(1));
  return {
    keyboard: new KeyboardInput(bus, target),
    target,
    moves,
    actions,
    confirms,
    cancels,
    pauses,
  };
}

afterEach(() => keyLayout.reset());

describe('KeyboardInput', () => {
  it('traduit les codes physiques QWERTY/AZERTY en intentions typées', () => {
    const { keyboard, target, moves, actions, confirms, cancels, pauses } = keyboardHarness();
    const move = key('KeyW', { key: 'z' });
    target.dispatch(move);
    target.dispatch(key('KeyQ', { key: 'a' }));
    target.dispatch(key('Enter'));
    target.dispatch(key('Backspace'));
    target.dispatch(key('Escape'));

    expect(moves).toEqual([{ dx: 0, dy: 1 }]);
    expect(actions).toEqual(['rotateLeft']);
    expect(confirms).toHaveLength(1);
    expect(cancels).toHaveLength(1);
    expect(pauses).toHaveLength(1);
    expect(move.preventDefault.mock.calls).toHaveLength(1);
    keyboard.dispose();
  });

  it('inverse Tab avec Shift et empêche le navigateur de déplacer le focus', () => {
    const { keyboard, target, actions } = keyboardHarness();
    const next = key('Tab');
    const previous = key('Tab', { shiftKey: true });
    target.dispatch(next);
    target.dispatch(previous);

    expect(actions).toEqual(['cycleNext', 'cyclePrev']);
    expect(next.preventDefault.mock.calls).toHaveLength(1);
    expect(previous.preventDefault.mock.calls).toHaveLength(1);
    keyboard.dispose();
  });

  it('ignore répétitions et champs éditables', () => {
    const { keyboard, target, moves } = keyboardHarness();
    target.dispatch(key('KeyW', { repeat: true }));
    target.dispatch(key('KeyW', { target: document.createElement('input') }));
    target.dispatch(key('KeyW', { target: document.createElement('textarea') }));
    expect(moves).toHaveLength(0);
    keyboard.dispose();
  });

  it('suspend le gameplay mais laisse muet et plein écran disponibles', () => {
    const { keyboard, target, moves, actions } = keyboardHarness();
    keyboard.setSuspended(true);
    target.dispatch(key('KeyW'));
    target.dispatch(key('KeyM'));
    target.dispatch(key('KeyF'));

    expect(moves).toHaveLength(0);
    expect(actions).toEqual(['muteToggle', 'fullscreenToggle']);
    keyboard.dispose();
  });

  it('remplace la table, revient aux défauts et se désabonne à dispose()', () => {
    const { keyboard, target, actions, moves } = keyboardHarness();
    keyboard.setBindings({ KeyX: 'hint' });
    target.dispatch(key('KeyW'));
    target.dispatch(key('KeyX'));
    expect(actions).toEqual(['hint']);

    keyboard.resetBindings();
    target.dispatch(key('KeyW'));
    expect(moves).toEqual([{ dx: 0, dy: 1 }]);

    keyboard.dispose();
    target.dispatch(key('KeyW'));
    expect(moves).toHaveLength(1);
  });
});
