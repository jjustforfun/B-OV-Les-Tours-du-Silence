// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { STORAGE_KEYS } from '@/config';
import { InputManager } from '@input/InputManager';
import type { SettingsStorage } from '@save/SettingsStore';

function memoryStorage(
  initial?: unknown,
): SettingsStorage & { readonly items: Map<string, string> } {
  const items = new Map<string, string>();
  if (initial !== undefined) items.set(STORAGE_KEYS.settings, JSON.stringify(initial));
  return {
    items,
    getItem: (key) => Promise.resolve(items.get(key) ?? null),
    setItem: (key, value) => {
      items.set(key, value);
      return Promise.resolve();
    },
  };
}

afterEach(() => {
  document.body.replaceChildren();
});

describe('InputManager', () => {
  it('charge, applique, remplace et persiste le remappage complet', async () => {
    const storage = memoryStorage({ version: 1, bindings: { KeyX: 'moveUp' } });
    const canvas = document.createElement('div');
    document.body.appendChild(canvas);
    const input = new InputManager(canvas, storage);
    const moves: { dx: number; dy: number }[] = [];
    input.on('move', (move) => moves.push(move));

    await expect(input.loadPersistedBindings()).resolves.toBe(true);
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyX', key: 'x' }));
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW', key: 'w' }));
    expect(moves).toEqual([{ dx: 0, dy: 1 }]);

    input.setBindings({ KeyY: 'moveDown' });
    await input.persistBindings();
    const persisted = JSON.parse(storage.items.get(STORAGE_KEYS.settings) ?? '{}') as {
      bindings?: Record<string, string>;
    };
    expect(persisted.bindings).toEqual({ KeyY: 'moveDown' });

    await input.resetBindings();
    expect(input.currentBindings.KeyW).toBe('moveUp');
    const reset = JSON.parse(storage.items.get(STORAGE_KEYS.settings) ?? '{}') as {
      bindings?: Record<string, string>;
    };
    expect(reset.bindings?.KeyW).toBe('moveUp');
    input.dispose();
  });

  it('déclenche le déverrouillage audio une seule fois sur un geste volontaire', () => {
    const canvas = document.createElement('div');
    document.body.appendChild(canvas);
    const input = new InputManager(canvas, memoryStorage());
    const unlock = vi.fn();
    input.onFirstGesture(unlock);

    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW', repeat: true }));
    expect(unlock).not.toHaveBeenCalled();
    canvas.dispatchEvent(new Event('pointerdown'));
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW' }));
    expect(unlock).toHaveBeenCalledOnce();
    input.dispose();
  });
});
