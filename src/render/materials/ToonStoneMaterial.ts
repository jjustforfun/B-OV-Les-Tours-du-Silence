/**
 * ToonStoneMaterial.ts — la pierre des tours vainakhs.
 *
 * Rendu « gouache » : un MeshToonMaterial avec une rampe de dégradé à 3 ou 4
 * paliers. Pas de PBR, pas de normal map : la lisibilité des volumes prime,
 * et le coût sur mobile est quasi nul. La rampe est partagée entre tous les
 * matériaux de pierre (un seul upload GPU).
 */
import {
  Color,
  DataTexture,
  LinearFilter,
  MeshToonMaterial,
  NearestFilter,
  RedFormat,
  SRGBColorSpace,
  UnsignedByteType,
} from 'three';

export interface ToonStoneOptions {
  readonly color?: number;
  /** Nombre de paliers de lumière (3 = franc, 5 = doux). */
  readonly steps?: 3 | 4 | 5;
  readonly emissive?: number;
  readonly emissiveIntensity?: number;
}

const gradientCache = new Map<number, DataTexture>();

/** Rampe de dégradé partagée, en niveaux de gris. */
export function getToonGradient(steps: 3 | 4 | 5 = 4): DataTexture {
  const cached = gradientCache.get(steps);
  if (cached) return cached;

  const data = new Uint8Array(steps);
  for (let i = 0; i < steps; i += 1) {
    // Plancher à 0.32 : les ombres restent colorées, jamais noires.
    const t = i / (steps - 1);
    data[i] = Math.round((0.32 + 0.68 * t) * 255);
  }

  const texture = new DataTexture(data, steps, 1, RedFormat, UnsignedByteType);
  texture.minFilter = NearestFilter;
  texture.magFilter = NearestFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  gradientCache.set(steps, texture);
  return texture;
}

export function createToonStoneMaterial(options: ToonStoneOptions = {}): MeshToonMaterial {
  const material = new MeshToonMaterial({
    color: new Color(options.color ?? 0x9aa0ab),
    gradientMap: getToonGradient(options.steps ?? 4),
  });
  material.name = 'ToonStone';
  if (options.emissive !== undefined) {
    material.emissive = new Color(options.emissive);
    material.emissiveIntensity = options.emissiveIntensity ?? 1;
  }
  const map = material.gradientMap;
  if (map) map.colorSpace = SRGBColorSpace;
  return material;
}

/** À appeler au déchargement complet du jeu (cycle de vie Android). */
export function disposeToonGradients(): void {
  for (const texture of gradientCache.values()) texture.dispose();
  gradientCache.clear();
}

/** Réexport utilitaire : certains matériaux veulent une rampe lissée. */
export const SMOOTH_FILTER = LinearFilter;
