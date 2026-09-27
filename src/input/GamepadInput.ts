/**
 * GamepadInput.ts — manette (docs/CONTROLS.md § 3).
 *
 * L'API Gamepad se sonde, elle n'émet pas : `poll()` est appelé une fois par
 * image par l'InputManager. Le stick gauche déplace Turpal par à-coups (zone
 * morte 0,35, répétition 220 ms) : le jeu se joue au pas, jamais au pixel.
 *
 * Détection de fronts sur chaque bouton : un appui = une intention, jamais
 * un rafale à 60 Hz. La manette peut aussi vibrer (`vibrationActuator`,
 * Chrome) avec les mêmes motifs que l'haptique mobile.
 */
import { GAMEPAD } from '@/config';
import type { EventBus } from '@core/EventBus';
import type { InputEvents } from './InputManager';

/** Représentation minimale d'une manette, injectable pour les tests. */
export interface PolledGamepad {
  readonly axes: readonly number[];
  readonly buttons: readonly { readonly pressed: boolean; readonly value: number }[];
}

export type GamepadProvider = () => readonly (PolledGamepad | null)[];

function defaultProvider(): GamepadProvider {
  return () => {
    if (typeof navigator === 'undefined' || typeof navigator.getGamepads !== 'function') return [];
    return navigator.getGamepads();
  };
}

/** Indices standard du mapping standard Gamepad (spec W3C). */
const BUTTON = {
  A: 0,
  B: 1,
  Y: 3,
  L1: 4,
  R1: 5,
  L2: 6,
  R2: 7,
  START: 9,
  DPAD_UP: 12,
  DPAD_DOWN: 13,
  DPAD_LEFT: 14,
  DPAD_RIGHT: 15,
} as const;

/** Indices des boutons suivis : seuls ceux-là deviennent des intentions. */
type TrackedButton = (typeof BUTTON)[keyof typeof BUTTON];

export class GamepadInput {
  private lastMoveAt = 0;
  private lastDirection: { dx: number; dy: number } | null = null;
  private readonly pressed = new Set<TrackedButton>();

  constructor(
    private readonly bus: EventBus<InputEvents>,
    private readonly getGamepads: GamepadProvider = defaultProvider(),
  ) {}

  poll(now: number = performanceNow()): void {
    const pad = this.getGamepads().find((entry): entry is PolledGamepad => entry !== null);
    if (!pad) {
      this.pressed.clear();
      this.lastDirection = null;
      return;
    }

    this.pollStick(pad, now);
    this.pollButtons(pad);
  }

  dispose(): void {
    this.pressed.clear();
    this.lastDirection = null;
  }

  private pollStick(pad: PolledGamepad, now: number): void {
    const axisX = pad.axes[0] ?? 0;
    const axisY = pad.axes[1] ?? 0;
    const magnitude = Math.hypot(axisX, axisY);

    if (magnitude <= GAMEPAD.deadZone) {
      this.lastDirection = null;
      return;
    }

    // Direction dominante, comme au clavier : un cran de stick = un pas.
    const dx = Math.abs(axisX) > Math.abs(axisY) ? Math.sign(axisX) : 0;
    const dy = Math.abs(axisY) >= Math.abs(axisX) ? -Math.sign(axisY) : 0;
    if (dx === 0 && dy === 0) return;

    const changed = this.lastDirection?.dx !== dx || this.lastDirection?.dy !== dy;
    if (!changed && now - this.lastMoveAt < GAMEPAD.moveRepeatMs) return;

    this.lastDirection = { dx, dy };
    this.lastMoveAt = now;
    this.bus.emit('move', { dx, dy });
  }

  private pollButtons(pad: PolledGamepad): void {
    const buttonActive = (index: number): boolean => {
      const button = pad.buttons[index];
      if (!button) return false;
      // Gâchettes analogiques : seuil de course, pas juste `pressed`.
      if (index === BUTTON.L2 || index === BUTTON.R2) {
        return button.value >= GAMEPAD.triggerThreshold;
      }
      return button.pressed;
    };

    const justPressed = (index: TrackedButton): boolean => {
      const active = buttonActive(index);
      const was = this.pressed.has(index);
      if (active && !was) this.pressed.add(index);
      else if (!active && was) this.pressed.delete(index);
      return active && !was;
    };

    // Croix directionnelle : par à-coups, un appui = un pas.
    if (justPressed(BUTTON.DPAD_UP)) this.bus.emit('move', { dx: 0, dy: 1 });
    if (justPressed(BUTTON.DPAD_DOWN)) this.bus.emit('move', { dx: 0, dy: -1 });
    if (justPressed(BUTTON.DPAD_LEFT)) this.bus.emit('move', { dx: -1, dy: 0 });
    if (justPressed(BUTTON.DPAD_RIGHT)) this.bus.emit('move', { dx: 1, dy: 0 });

    if (justPressed(BUTTON.A)) this.bus.emit('confirm', undefined);
    if (justPressed(BUTTON.B)) this.bus.emit('cancel', undefined);
    if (justPressed(BUTTON.Y)) this.bus.emit('action', 'hint');
    if (justPressed(BUTTON.START)) this.bus.emit('pause', undefined);
    if (justPressed(BUTTON.L1)) this.bus.emit('action', 'cyclePrev');
    if (justPressed(BUTTON.R1)) this.bus.emit('action', 'cycleNext');
    if (justPressed(BUTTON.L2)) this.bus.emit('action', 'rotateLeft');
    if (justPressed(BUTTON.R2)) this.bus.emit('action', 'rotateRight');
  }
}

function performanceNow(): number {
  return typeof performance === 'object' && performance !== null ? performance.now() : Date.now();
}
