/**
 * SnowMaterial.ts — la neige des cimes.
 *
 * Statut : squelette. Intention : blanc jamais pur (un blanc pur détruit la
 * lecture des volumes), léger scintillement de cristaux visible seulement en
 * qualité « high », et teinte de rebond bleutée dans les creux.
 */
import { Color, MeshToonMaterial } from 'three';
import { getToonGradient } from './ToonStoneMaterial';

export interface SnowOptions {
  readonly tint?: number;
  readonly sparkle?: boolean;
}

export function createSnowMaterial(options: SnowOptions = {}): MeshToonMaterial {
  const material = new MeshToonMaterial({
    color: new Color(options.tint ?? 0xeef2f7),
    gradientMap: getToonGradient(5),
  });
  material.name = 'Snow';
  // TODO(phase Neige) : si options.sparkle, injecter un bruit de scintillement
  // dépendant de la normale et de la direction de vue (qualité « high » seulement).
  return material;
}
