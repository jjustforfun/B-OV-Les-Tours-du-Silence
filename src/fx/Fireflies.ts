/**
 * Fireflies.ts — lucioles du crépuscule.
 *
 * Statut : squelette. Récompense de curiosité : elles se rassemblent près
 * des endroits que le joueur n'a pas encore explorés — un indice qui ne dit
 * jamais son nom, et qu'on peut ignorer sans rien perdre.
 */
import { ParticleSystem, type ParticleSystemOptions } from './Particles';

export class Fireflies extends ParticleSystem {
  constructor(options: Partial<ParticleSystemOptions> = {}) {
    super({
      count: options.count ?? 40,
      size: options.size ?? 0.07,
      color: options.color ?? 0xffd98a,
      opacity: options.opacity ?? 0.9,
      bounds: options.bounds ?? [8, 4, 8],
    });
    this.points.name = 'Fireflies';
  }

  override update(_delta: number, elapsed: number): void {
    // TODO(phase FX) : dérive en bruit de Perlin + scintillement d'opacité.
    void elapsed;
  }
}
