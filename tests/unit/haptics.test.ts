import { afterEach, describe, expect, it, vi } from 'vitest';
import { haptic, setHapticsEnabled } from '@input/Haptics';
import { platform } from '@platform/Platform';

afterEach(() => {
  setHapticsEnabled(true);
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('haptique', () => {
  it('fait passer tick, snap et celebrate par Platform.vibrate', () => {
    const vibrate = vi.spyOn(platform, 'vibrate').mockImplementation(() => undefined);

    haptic('tick');
    haptic('snap');
    haptic('celebrate');

    expect(vibrate.mock.calls).toEqual([[[8]], [[14, 30, 10]], [[10, 40, 12, 40, 18]]]);
  });

  it('coupe tous les canaux lorsque le réglage est désactivé', () => {
    const vibrate = vi.spyOn(platform, 'vibrate').mockImplementation(() => undefined);
    const playEffect = vi.fn((_type: string, _options: GamepadEffectParameters) =>
      Promise.resolve('complete'),
    );
    vi.stubGlobal('navigator', {
      getGamepads: () => [{ vibrationActuator: { playEffect } }],
    });

    setHapticsEnabled(false);
    haptic('celebrate');

    expect(vibrate).not.toHaveBeenCalled();
    expect(playEffect).not.toHaveBeenCalled();
  });

  it('programme le dual-rumble en millisecondes sur la première manette', () => {
    vi.spyOn(platform, 'vibrate').mockImplementation(() => undefined);
    const playEffect = vi.fn((_type: string, _options: GamepadEffectParameters) =>
      Promise.resolve('complete'),
    );
    vi.stubGlobal('navigator', {
      getGamepads: () => [{ vibrationActuator: { playEffect } }],
    });

    haptic('celebrate');

    expect(playEffect).toHaveBeenCalledTimes(3);
    expect(playEffect.mock.calls.map(([, options]) => options)).toEqual([
      {
        startDelay: 0,
        duration: 10,
        strongMagnitude: 0.6,
        weakMagnitude: 0,
      },
      {
        startDelay: 50,
        duration: 12,
        strongMagnitude: 0,
        weakMagnitude: 0.6,
      },
      {
        startDelay: 102,
        duration: 18,
        strongMagnitude: 0.6,
        weakMagnitude: 0,
      },
    ]);
  });
});
