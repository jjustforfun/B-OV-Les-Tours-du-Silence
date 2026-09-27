/**
 * WaterMaterial.ts — la surface du lac Kezenoy-Am.
 *
 * Statut : squelette. Intention : pas de réflexion planaire (trop chère sur
 * mobile) mais une eau stylisée — dégradé de profondeur, lignes de houle
 * animées en UV, liseré d'écume au contact de la pierre. Les reflets seront
 * suggérés par une cube map statique de très faible résolution.
 */
import { Color, MeshStandardMaterial } from 'three';

export interface WaterOptions {
  readonly shallow?: number;
  readonly deep?: number;
  readonly opacity?: number;
}

export function createWaterMaterial(options: WaterOptions = {}): MeshStandardMaterial {
  const material = new MeshStandardMaterial({
    color: new Color(options.deep ?? 0x24485c),
    roughness: 0.18,
    metalness: 0.0,
    transparent: true,
    opacity: options.opacity ?? 0.86,
  });
  material.name = 'Water';
  // TODO(phase Eau) : onBeforeCompile → houle sinusoïdale + écume de rive,
  // uniforme `uTime` piloté par Engine, shaders dans src/render/shaders/.
  return material;
}
