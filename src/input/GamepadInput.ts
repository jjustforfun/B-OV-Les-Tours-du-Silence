/**
 * GamepadInput.ts — manette (desktop, Android TV plus tard).
 *
 * Statut : squelette fonctionnel. L'API Gamepad se sonde, elle n'émet pas :
 * `poll()` est appelé une fois par image par l'InputManager. Zone morte
 * volontairement large : le jeu se joue au pas, pas au pixel.
 */
import type { EventBus } from '@core/EventBus';
import type { InputEvents } from './InputManager';

const DEAD_ZONE = 0.45;
const REPEAT_DELAY_MS = 220;

export class GamepadInput {
  private lastMoveAt = 0;
  private confirmWasPressed = false;

  constructor(private readonly bus: EventBus<InputEvents>) {}

  poll(): void {
    if (typeof navigator === 'undefined' || typeof navigator.getGamepads !== 'function') return;

    const pad = navigator.getGamepads().find((entry) => entry !== null);
    if (!pad) return;

    const now = performance.now();
    const axisX = pad.axes[0] ?? 0;
    const axisY = pad.axes[1] ?? 0;

    if (Math.hypot(axisX, axisY) > DEAD_ZONE && now - this.lastMoveAt > REPEAT_DELAY_MS) {
      this.lastMoveAt = now;
      const dx = Math.abs(axisX) > Math.abs(axisY) ? Math.sign(axisX) : 0;
      const dy = Math.abs(axisY) >= Math.abs(axisX) ? -Math.sign(axisY) : 0;
      this.bus.emit('move', { dx, dy });
    }

    const confirmPressed = pad.buttons[0]?.pressed === true;
    if (confirmPressed && !this.confirmWasPressed) this.bus.emit('confirm', undefined);
    this.confirmWasPressed = confirmPressed;

    if (pad.buttons[9]?.pressed === true) this.bus.emit('pause', undefined);
  }

  dispose(): void {
    this.confirmWasPressed = false;
  }
}
