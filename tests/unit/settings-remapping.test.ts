// @vitest-environment jsdom

import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { i18n } from '@i18n/i18n';
import type { InputAction } from '@input/InputManager';
import { Settings, type UiSettingsState } from '@ui/Settings';

const STATE: UiSettingsState = {
  volumes: { master: 1, music: 1, ambience: 1, sfx: 1 },
  quality: 'auto',
  locale: 'fr',
  reducedMotion: 'auto',
  fontScale: 'normal',
  highContrast: false,
  subtitles: true,
  haptics: true,
};

beforeAll(async () => {
  await i18n.init('fr');
});

afterEach(() => {
  document.body.replaceChildren();
});

function keyboard(code: string, key = code): KeyboardEvent {
  return new KeyboardEvent('keydown', { code, key, bubbles: true, cancelable: true });
}

describe('remappage dans les réglages', () => {
  it('capture un code physique, retire l’ancienne touche et appelle la persistance', () => {
    let bindings: Readonly<Record<string, InputAction>> = {
      KeyW: 'moveUp',
      ArrowUp: 'moveUp',
      KeyA: 'moveLeft',
    };
    const onBindingsChange = vi.fn((next: Readonly<Record<string, InputAction>>) => {
      bindings = next;
    });
    const settings = new Settings({
      getState: () => STATE,
      getBindings: () => bindings,
      onChange: vi.fn(),
      onBindingsChange,
      onResetBindings: vi.fn(),
      onClose: vi.fn(),
    });
    document.body.appendChild(settings.element);
    settings.show();

    const moveUp =
      settings.element.querySelectorAll<HTMLButtonElement>('.ui-settings__keybutton')[0];
    moveUp?.click();
    const captured = keyboard('KeyZ', 'w');
    settings.onKeydown(captured);

    expect(captured.defaultPrevented).toBe(true);
    expect(onBindingsChange).toHaveBeenCalledOnce();
    expect(bindings).toEqual({ KeyA: 'moveLeft', KeyZ: 'moveUp' });
    settings.dispose();
  });

  it('signale un conflit, refuse les modificateurs purs et rétablit les défauts sur demande', () => {
    const onBindingsChange = vi.fn();
    const onResetBindings = vi.fn();
    const settings = new Settings({
      getState: () => STATE,
      getBindings: () => ({ KeyW: 'moveUp', KeyA: 'moveLeft' }),
      onChange: vi.fn(),
      onBindingsChange,
      onResetBindings,
      onClose: vi.fn(),
    });
    document.body.appendChild(settings.element);
    settings.show();

    const moveUp =
      settings.element.querySelectorAll<HTMLButtonElement>('.ui-settings__keybutton')[0];
    moveUp?.click();
    settings.onKeydown(keyboard('ShiftLeft', 'Shift'));
    expect(onBindingsChange).not.toHaveBeenCalled();

    settings.onKeydown(keyboard('KeyA', 'a'));
    const conflict = settings.element.querySelector<HTMLElement>('[role="alert"]');
    expect(conflict?.classList.contains('is-hidden')).toBe(false);
    expect(conflict?.textContent).toContain(i18n.t('actions.moveLeft'));
    expect(onBindingsChange).not.toHaveBeenCalled();

    settings.element.querySelector<HTMLButtonElement>('.ui-settings__reset')?.click();
    expect(onResetBindings).toHaveBeenCalledOnce();
    settings.dispose();
  });
});
