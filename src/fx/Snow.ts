/**
 * Snow.ts — la neige des cimes.
 *
 * Statut : squelette, bâti sur ParticleSystem. La neige ne tombe pas droit :
 * elle dérive, hésite, remonte parfois. Densité pilotée par la qualité, et
 * recyclage des flocons par le haut plutôt que réallocation.
 */
import { ParticleSystem, type ParticleSystemOptions } from './Particles';

export class Snow extends ParticleSystem {
  constructor(options: Partial<ParticleSystemOptions> = {}) {
    super({
      count: options.count ?? 400,
      size: options.size ?? 0.045,
      color: options.color ?? 0xeef4ff,
      opacity: options.opacity ?? 0.75,
      ...(options.bounds ? { bounds: options.bounds } : { bounds: [26, 16, 26] as const }),
    });
    this.points.name = 'Snow';
  }

  override update(delta: number, elapsed: number): void {
    for (let i = 0; i < this.count; i += 1) {
      const yIndex = i * 3 + 1;
      const xIndex = i * 3;
      const y = this.positions[yIndex] ?? 0;
      const x = this.positions[xIndex] ?? 0;

      this.positions[yIndex] = y - delta * 0.6;
      this.positions[xIndex] = x + Math.sin(elapsed * 0.35 + i) * delta * 0.18;
      if ((this.positions[yIndex] ?? 0) < 0) this.positions[yIndex] = 16;
    }
    this.commitPositions();
  }
}
