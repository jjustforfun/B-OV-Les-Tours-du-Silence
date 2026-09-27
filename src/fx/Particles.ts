/**
 * Particles.ts — socle commun des systèmes de particules.
 *
 * Statut : squelette. Un seul système générique (Points + BufferGeometry +
 * ShaderMaterial), réutilisé par la brume, la neige, les lucioles et la
 * poussière. Une seule implémentation à optimiser, un seul draw call par
 * effet, et un facteur de densité piloté par QualitySettings.particleScale.
 */
import { BufferGeometry, Float32BufferAttribute, Points, PointsMaterial } from 'three';

export interface ParticleSystemOptions {
  readonly count: number;
  readonly size?: number;
  readonly color?: number;
  readonly opacity?: number;
  /** Volume d'apparition, en unités de grille. */
  readonly bounds?: readonly [number, number, number];
}

export class ParticleSystem {
  readonly points: Points;

  protected readonly count: number;
  protected readonly positions: Float32Array;

  constructor(options: ParticleSystemOptions) {
    this.count = Math.max(1, Math.floor(options.count));
    this.positions = new Float32Array(this.count * 3);

    const [bx, by, bz] = options.bounds ?? [20, 12, 20];
    for (let i = 0; i < this.count; i += 1) {
      this.positions[i * 3] = (Math.random() - 0.5) * bx;
      this.positions[i * 3 + 1] = Math.random() * by;
      this.positions[i * 3 + 2] = (Math.random() - 0.5) * bz;
    }

    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new Float32BufferAttribute(this.positions, 3));

    const material = new PointsMaterial({
      size: options.size ?? 0.05,
      color: options.color ?? 0xffffff,
      transparent: true,
      opacity: options.opacity ?? 0.5,
      depthWrite: false,
      sizeAttenuation: true,
    });

    this.points = new Points(geometry, material);
    this.points.frustumCulled = false;
  }

  update(_delta: number, _elapsed: number): void {
    /* Les sous-classes animent `positions` puis marquent l'attribut à mettre à jour. */
  }

  protected commitPositions(): void {
    const attribute = this.points.geometry.getAttribute('position');
    attribute.needsUpdate = true;
  }

  dispose(): void {
    this.points.geometry.dispose();
    const material = this.points.material;
    if (Array.isArray(material)) material.forEach((entry) => entry.dispose());
    else material.dispose();
    this.points.removeFromParent();
  }
}
