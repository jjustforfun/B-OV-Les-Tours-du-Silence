/**
 * GameLoop.ts — boucle de rendu requestAnimationFrame.
 *
 * Responsabilités volontairement minimales : cadencer, mettre en pause quand
 * l'onglet est caché (batterie mobile), et appeler update() puis render().
 * Aucune connaissance de three.js ici : la boucle est testable et réutilisable.
 */
import { Time } from './Time';

export type UpdateFn = (time: Time) => void;
export type RenderFn = (time: Time) => void;

export interface GameLoopOptions {
  readonly update: UpdateFn;
  readonly render: RenderFn;
  /** Met la boucle en pause quand le document passe en arrière-plan (défaut : true). */
  readonly pauseWhenHidden?: boolean;
}

export class GameLoop {
  readonly time = new Time();

  private rafId: number | null = null;
  private running = false;
  private readonly update: UpdateFn;
  private readonly render: RenderFn;
  private readonly pauseWhenHidden: boolean;
  private readonly onVisibilityChange = (): void => {
    if (!this.pauseWhenHidden) return;
    if (document.hidden) this.stop();
    else this.start();
  };

  constructor(options: GameLoopOptions) {
    this.update = options.update;
    this.render = options.render;
    this.pauseWhenHidden = options.pauseWhenHidden ?? true;
  }

  get isRunning(): boolean {
    return this.running;
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.time.reset();
    if (this.pauseWhenHidden) {
      document.addEventListener('visibilitychange', this.onVisibilityChange);
    }
    this.rafId = requestAnimationFrame(this.frame);
  }

  stop(): void {
    if (!this.running) return;
    this.running = false;
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    this.rafId = null;
  }

  dispose(): void {
    this.stop();
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
  }

  private readonly frame = (nowMs: number): void => {
    if (!this.running) return;
    this.rafId = requestAnimationFrame(this.frame);
    this.time.tick(nowMs);
    this.update(this.time);
    this.render(this.time);
  };
}
