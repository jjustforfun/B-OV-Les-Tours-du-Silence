/**
 * GoldenTrail.ts — traînée dorée le long d'un chemin nouvellement connecté.
 *
 * Quand une liaison se referme, une lumière court du départ vers l'arrivée
 * à 8 unités/s (docs/tasks Phase 7), ensemence le chemin d'étincelles, puis
 * le tout s'estompe en 900 ms. La lumière dit « c'est par ici maintenant »
 * sans un mot d'interface.
 *
 * S'appuie sur le pool de particules partagé : aucun objet GPU de plus, la
 * traînée n'est qu'une façon d'émettre. En mouvement réduit, la course est
 * deux fois plus rapide — l'information prime sur le spectacle.
 */
import { FX } from '@/config';
import { motionDurationScale } from '@core/motion';
import type { ParticlePool } from './Particles';
import { EMBER } from '@render/Palettes';

export interface TrailPoints {
  readonly points: readonly { readonly x: number; readonly y: number; readonly z: number }[];
}

interface Segment {
  readonly ax: number;
  readonly ay: number;
  readonly az: number;
  readonly bx: number;
  readonly by: number;
  readonly bz: number;
  readonly length: number;
}

export class GoldenTrail {
  private segments: Segment[] = [];
  private totalLength = 0;
  private travelled = 0;
  private running = false;
  private fadeRemaining = 0;
  private readonly speed: number;
  private readonly fadeSeconds: number;

  /** Options d'émission réutilisées : zéro allocation par image. */
  private readonly emitOptions = {
    x: 0,
    y: 0,
    z: 0,
    count: 2,
    color: EMBER,
    colorEnd: 0x8a5a1c,
    speed: 0.14,
    speedVariance: 0.08,
    size: 0.09,
    sizeEnd: 0.02,
    lifetime: 0.85,
    lifetimeVariance: 0.25,
    gravity: 0.02,
    drag: 0.4,
    upBias: 0.25,
  };

  constructor(private readonly pool: ParticlePool) {
    this.speed = FX.trail.speed * (motionDurationScale() < 1 ? 2 : 1);
    this.fadeSeconds = (FX.trail.fadeMs / 1000) * motionDurationScale();
  }

  get isRunning(): boolean {
    return this.running || this.fadeRemaining > 0;
  }

  /** Lance la course de lumière sur une polyline monde. */
  run(trail: TrailPoints): void {
    const points = trail.points;
    if (points.length === 0) return;

    this.segments = [];
    this.totalLength = 0;
    for (let i = 1; i < points.length; i += 1) {
      const a = points[i - 1];
      const b = points[i];
      if (a === undefined || b === undefined) continue;
      const length = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
      if (length <= 0.0001) continue;
      this.segments.push({ ax: a.x, ay: a.y, az: a.z, bx: b.x, by: b.y, bz: b.z, length });
      this.totalLength += length;
    }

    this.travelled = 0;
    this.running = this.segments.length > 0;
    this.fadeRemaining = 0;
  }

  /** À appeler chaque image. */
  update(delta: number): void {
    if (this.running) {
      this.travelled += this.speed * delta;
      this.seedAlongTrail(delta);

      if (this.travelled >= this.totalLength) {
        // Arrivée : gerbe discrète, puis la traînée s'estompe d'elle-même
        // (la durée de vie des particules fait le fondu de 900 ms).
        this.running = false;
        this.fadeRemaining = this.fadeSeconds;
        const head = this.pointAt(this.totalLength);
        if (head !== null) {
          this.emitOptions.x = head[0];
          this.emitOptions.y = head[1];
          this.emitOptions.z = head[2];
          this.emitOptions.count = 10;
          this.emitOptions.size = 0.11;
          this.pool.emit(this.emitOptions);
        }
      }
      return;
    }

    if (this.fadeRemaining > 0) {
      this.fadeRemaining = Math.max(0, this.fadeRemaining - delta);
    }
  }

  dispose(): void {
    this.segments = [];
    this.running = false;
    this.fadeRemaining = 0;
  }

  /** Sème les étincelles sous la tête de course. */
  private seedAlongTrail(delta: number): void {
    if (this.segments.length === 0) return;
    const head = this.pointAt(this.travelled);
    if (head === null) return;

    // Densité en particules par unité de distance, pas par image : la
    // traînée est continue même à framerate variable.
    const distance = this.speed * delta;
    const count = Math.max(1, Math.round(distance * FX.trail.particlesPerUnit));

    this.emitOptions.x = head[0];
    this.emitOptions.y = head[1] + 0.06;
    this.emitOptions.z = head[2];
    this.emitOptions.count = count;
    this.emitOptions.size = 0.09;
    this.pool.emit(this.emitOptions);
  }

  /** Position à `distance` du départ, ou null si hors polyline. */
  private pointAt(distance: number): [number, number, number] | null {
    let remaining = distance;
    for (const segment of this.segments) {
      if (remaining > segment.length) {
        remaining -= segment.length;
        continue;
      }
      const t = segment.length <= 0 ? 0 : remaining / segment.length;
      return [
        segment.ax + (segment.bx - segment.ax) * t,
        segment.ay + (segment.by - segment.ay) * t,
        segment.az + (segment.bz - segment.az) * t,
      ];
    }
    const last = this.segments[this.segments.length - 1];
    return last === undefined ? null : [last.bx, last.by, last.bz];
  }
}
