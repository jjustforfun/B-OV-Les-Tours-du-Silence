import { describe, expect, it } from 'vitest';
import { GAMEPAD } from '@/config';
import { EventBus } from '@core/EventBus';
import { GamepadInput, type PolledGamepad } from '@input/GamepadInput';
import type { InputAction, InputEvents } from '@input/InputManager';

interface MutableButton {
  pressed: boolean;
  value: number;
}

function padHarness(): {
  readonly pad: { axes: number[]; buttons: MutableButton[] };
  readonly gamepad: GamepadInput;
  readonly moves: { dx: number; dy: number }[];
  readonly actions: InputAction[];
  readonly confirms: number[];
  readonly cancels: number[];
  readonly pauses: number[];
} {
  const bus = new EventBus<InputEvents>();
  const pad = {
    axes: [0, 0],
    buttons: Array.from({ length: 16 }, () => ({ pressed: false, value: 0 })),
  };
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
  const gamepad = new GamepadInput(bus, () => [pad satisfies PolledGamepad]);
  return { pad, gamepad, moves, actions, confirms, cancels, pauses };
}

describe('GamepadInput', () => {
  it('applique la zone morte et répète le stick toutes les 220 ms', () => {
    const { pad, gamepad, moves } = padHarness();
    pad.axes[0] = GAMEPAD.deadZone;
    gamepad.poll(0);
    expect(moves).toHaveLength(0);

    pad.axes[0] = GAMEPAD.deadZone + 0.01;
    gamepad.poll(0);
    gamepad.poll(GAMEPAD.moveRepeatMs - 1);
    gamepad.poll(GAMEPAD.moveRepeatMs);
    expect(moves).toEqual([
      { dx: 1, dy: 0 },
      { dx: 1, dy: 0 },
    ]);

    pad.axes = [0, -1];
    gamepad.poll(GAMEPAD.moveRepeatMs + 1);
    expect(moves.at(-1)).toEqual({ dx: 0, dy: 1 });
    gamepad.dispose();
  });

  it('traduit croix, A/B/Y/Start, épaules et gâchettes sur leurs fronts', () => {
    const { pad, gamepad, moves, actions, confirms, cancels, pauses } = padHarness();
    const press = (index: number, value = 1): void => {
      const button = pad.buttons[index];
      if (button === undefined) return;
      button.pressed = true;
      button.value = value;
    };

    press(0); // A
    press(1); // B
    press(3); // Y
    press(4); // L1
    press(5); // R1
    press(6, GAMEPAD.triggerThreshold); // L2
    press(7, GAMEPAD.triggerThreshold); // R2
    press(9); // Start
    press(12); // d-pad haut
    gamepad.poll(0);
    gamepad.poll(1); // maintenu : aucun doublon

    expect(moves).toEqual([{ dx: 0, dy: 1 }]);
    expect(confirms).toHaveLength(1);
    expect(cancels).toHaveLength(1);
    expect(pauses).toHaveLength(1);
    expect(actions).toEqual(['hint', 'cyclePrev', 'cycleNext', 'rotateLeft', 'rotateRight']);
    gamepad.dispose();
  });

  it('réarme un bouton après relâchement et oublie l’état à la déconnexion', () => {
    const bus = new EventBus<InputEvents>();
    const button = { pressed: true, value: 1 };
    const pad: PolledGamepad = {
      axes: [0, 0],
      buttons: [button],
    };
    let connected = true;
    let confirms = 0;
    bus.on('confirm', () => {
      confirms += 1;
    });
    const gamepad = new GamepadInput(bus, () => (connected ? [pad] : [null]));

    gamepad.poll(0);
    gamepad.poll(1);
    expect(confirms).toBe(1);
    button.pressed = false;
    button.value = 0;
    gamepad.poll(2);
    button.pressed = true;
    button.value = 1;
    gamepad.poll(3);
    expect(confirms).toBe(2);

    connected = false;
    gamepad.poll(4);
    connected = true;
    gamepad.poll(5);
    expect(confirms).toBe(3);
    gamepad.dispose();
  });
});
