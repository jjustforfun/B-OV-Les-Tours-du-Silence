/**
 * Time.ts — horloge du jeu.
 *
 * Fournit un delta borné (un onglet en arrière-plan ne doit pas téléporter
 * Turpal), une échelle de temps (ralenti des célébrations, pause) et une
 * moyenne glissante de FPS utilisée par Quality.ts et le compteur de debug.
 */

const MAX_DELTA_S = 1 / 15; // 66 ms : au-delà on considère que le temps a « sauté ».

export class Time {
  /** Secondes écoulées depuis la dernière image, bornées et mises à l'échelle. */
  delta = 0;
  /** Delta réel non mis à l'échelle (UI, mesures de perf). */
  unscaledDelta = 0;
  /** Secondes écoulées depuis le démarrage (temps de jeu, mis à l'échelle). */
  elapsed = 0;
  /** Numéro d'image depuis le démarrage. */
  frame = 0;
  /** 0 = gelé, 1 = normal, <1 = ralenti contemplatif. */
  timeScale = 1;

  private last = 0;
  private fpsAccumulator = 0;
  private fpsFrames = 0;
  private fpsValue = 0;

  reset(nowMs: number = performance.now()): void {
    this.last = nowMs;
    this.delta = 0;
    this.unscaledDelta = 0;
    this.elapsed = 0;
    this.frame = 0;
    this.fpsAccumulator = 0;
    this.fpsFrames = 0;
    this.fpsValue = 0;
  }

  /** Avance l'horloge. Appelé une fois par image par GameLoop. */
  tick(nowMs: number): void {
    if (this.last === 0) this.last = nowMs;
    const rawDelta = (nowMs - this.last) / 1000;
    this.last = nowMs;

    this.unscaledDelta = Math.min(Math.max(rawDelta, 0), MAX_DELTA_S);
    this.delta = this.unscaledDelta * this.timeScale;
    this.elapsed += this.delta;
    this.frame += 1;

    this.fpsAccumulator += this.unscaledDelta;
    this.fpsFrames += 1;
    if (this.fpsAccumulator >= 0.5) {
      this.fpsValue = this.fpsFrames / this.fpsAccumulator;
      this.fpsAccumulator = 0;
      this.fpsFrames = 0;
    }
  }

  /** FPS moyen sur une fenêtre de ~0,5 s. */
  get fps(): number {
    return this.fpsValue;
  }
}
