/**
 * Sky.ts — ciel en dégradé vertical et brouillard atmosphérique.
 *
 * Pas de skybox, pas de HDRI : un dégradé en DataTexture (quelques octets)
 * suffit à poser l'heure du jour et coûte zéro fillrate significatif.
 * Chaque chapitre possède sa palette (aube, brume, crépuscule, neige).
 */
import { Color, DataTexture, FogExp2, LinearFilter, RGBAFormat, SRGBColorSpace } from 'three';
import type { Scene } from 'three';

export interface SkyPalette {
  readonly top: number;
  readonly bottom: number;
  readonly fog: number;
  readonly fogDensity: number;
}

/** Palettes de référence — la direction artistique complète est dans docs/ART_DIRECTION.md. */
export const SKY_PALETTES = {
  /** Aube froide sur la gorge de l'Argun. */
  dawn: { top: 0x1c2436, bottom: 0xd9a441, fog: 0x8d93a5, fogDensity: 0.018 },
  /** Brume de milieu de journée, la plus « silencieuse ». */
  mist: { top: 0x2b3446, bottom: 0xb9c2cc, fog: 0xa8b2bf, fogDensity: 0.03 },
  /** Crépuscule sur le lac Kezenoy-Am. */
  dusk: { top: 0x141a2a, bottom: 0xc2643f, fog: 0x6b6273, fogDensity: 0.022 },
  /** Cimes enneigées, lumière presque blanche. */
  snow: { top: 0x46536b, bottom: 0xe8eef5, fog: 0xd7dee7, fogDensity: 0.035 },
} as const satisfies Record<string, SkyPalette>;

export type SkyPaletteName = keyof typeof SKY_PALETTES;

const GRADIENT_STEPS = 64;

export class Sky {
  private texture: DataTexture | null = null;

  constructor(private readonly scene: Scene) {}

  apply(palette: SkyPalette): void {
    this.texture?.dispose();
    this.texture = createGradientTexture(palette.top, palette.bottom);
    this.scene.background = this.texture;
    this.scene.fog = new FogExp2(palette.fog, palette.fogDensity);
  }

  applyNamed(name: SkyPaletteName): void {
    this.apply(SKY_PALETTES[name]);
  }

  dispose(): void {
    this.texture?.dispose();
    this.texture = null;
    this.scene.background = null;
    this.scene.fog = null;
  }
}

/** Dégradé vertical 1×N, interpolé linéairement par le GPU. */
export function createGradientTexture(topHex: number, bottomHex: number): DataTexture {
  const top = new Color(topHex);
  const bottom = new Color(bottomHex);
  const data = new Uint8Array(GRADIENT_STEPS * 4);
  const mixed = new Color();

  for (let i = 0; i < GRADIENT_STEPS; i += 1) {
    // i = 0 en bas de l'écran, i = N-1 en haut.
    const t = i / (GRADIENT_STEPS - 1);
    mixed.copy(bottom).lerp(top, smoothstep(t));
    const offset = i * 4;
    data[offset] = Math.round(mixed.r * 255);
    data[offset + 1] = Math.round(mixed.g * 255);
    data[offset + 2] = Math.round(mixed.b * 255);
    data[offset + 3] = 255;
  }

  const texture = new DataTexture(data, 1, GRADIENT_STEPS, RGBAFormat);
  texture.colorSpace = SRGBColorSpace;
  texture.magFilter = LinearFilter;
  texture.minFilter = LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

function smoothstep(t: number): number {
  return t * t * (3 - 2 * t);
}
