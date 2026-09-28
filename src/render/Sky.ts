/**
 * Sky.ts — ciel en dégradé vertical, animation d'aube et brouillard.
 *
 * Pas de skybox, pas de HDRI : un dégradé en `DataTexture` 1×64 suffit à
 * poser l'heure du jour. Le ciel respire très lentement en faisant varier la
 * chaleur du bas du gradient ; la profondeur atmosphérique reste portée par
 * `FogExp2`, tandis que le brouillard de hauteur est injecté dans
 * `ToonStoneMaterial` pour baigner les bases de tour dans la brume.
 */
import { Color, DataTexture, FogExp2, LinearFilter, RGBAFormat, SRGBColorSpace } from 'three';
import type { Scene } from 'three';
import { RENDER } from '@/config';
import { ambientDriftEnabled } from '@core/motion';

export interface SkyPalette {
  readonly top: number;
  readonly bottom: number;
  readonly fog: number;
  readonly fogDensity: number;
}

/** Palettes de référence — la direction artistique complète est dans docs/ART_DIRECTION.md. */
export const SKY_PALETTES = {
  /** Aube froide sur la gorge de l'Argun. */
  dawn: { top: 0x1b2230, bottom: 0xe3b7a6, fog: 0x8d93a5, fogDensity: 0.018 },
  /** Brume de milieu de journée, la plus « silencieuse ». */
  mist: { top: 0x2b3446, bottom: 0xb9c2cc, fog: 0xa8b2bf, fogDensity: 0.03 },
  /** Crépuscule sur le lac Kezenoy-Am. */
  dusk: { top: 0x141a2a, bottom: 0xc2643f, fog: 0x6b6273, fogDensity: 0.022 },
  /** Cimes enneigées, lumière presque blanche. */
  snow: { top: 0x46536b, bottom: 0xe8eef5, fog: 0xd7dee7, fogDensity: 0.035 },
  /** Épilogue : la neige cède doucement à l'or de la vallée réunie. */
  gold: { top: 0x1a2030, bottom: 0xd9a441, fog: 0xb59a6b, fogDensity: 0.018 },
} as const satisfies Record<string, SkyPalette>;

export type SkyPaletteName = keyof typeof SKY_PALETTES;

const GRADIENT_STEPS = RENDER.sky.gradientSteps;
const gradientScratch = new Color();

export class Sky {
  private texture: DataTexture | null = null;
  private readonly data = new Uint8Array(GRADIENT_STEPS * 4);
  private readonly top = new Color();
  private readonly bottom = new Color();
  private readonly animatedTop = new Color();
  private readonly animatedBottom = new Color();
  private readonly transitionFromTop = new Color();
  private readonly transitionFromBottom = new Color();
  private readonly transitionToTop = new Color();
  private readonly transitionToBottom = new Color();
  private readonly transitionFromFog = new Color();
  private readonly transitionToFog = new Color();
  private transitionStartSeconds: number | null = null;
  private transitionDurationSeconds = 0;
  private transitionFromDensity = 0;
  private transitionToDensity = 0;
  private transitionPending = false;

  constructor(private readonly scene: Scene) {}

  apply(palette: SkyPalette): void {
    this.top.setHex(palette.top);
    this.bottom.setHex(palette.bottom);
    this.transitionPending = false;
    this.transitionStartSeconds = null;

    this.texture?.dispose();
    this.texture = createGradientTexture(palette.top, palette.bottom, this.data);
    this.scene.background = this.texture;
    this.scene.fog = new FogExp2(palette.fog, palette.fogDensity);
  }

  applyNamed(name: SkyPaletteName): void {
    this.apply(SKY_PALETTES[name]);
  }

  /** Fond progressivement vers une autre heure du jour, sans remplacer le ciel. */
  transitionTo(palette: SkyPalette, durationSeconds = 3.5): void {
    this.transitionFromTop.copy(this.top);
    this.transitionFromBottom.copy(this.bottom);
    this.transitionToTop.setHex(palette.top);
    this.transitionToBottom.setHex(palette.bottom);
    const fog = this.scene.fog;
    this.transitionFromFog.copy(fog instanceof FogExp2 ? fog.color : this.bottom);
    this.transitionToFog.setHex(palette.fog);
    this.transitionFromDensity = fog instanceof FogExp2 ? fog.density : palette.fogDensity;
    this.transitionToDensity = palette.fogDensity;
    this.transitionDurationSeconds = Math.max(0.001, durationSeconds);
    this.transitionStartSeconds = null;
    this.transitionPending = true;
  }

  transitionToNamed(name: SkyPaletteName, durationSeconds = 3.5): void {
    this.transitionTo(SKY_PALETTES[name], durationSeconds);
  }

  update(elapsedSeconds: number): void {
    if (!this.texture) return;
    this.updateTransition(elapsedSeconds);

    const wave = ambientDriftEnabled()
      ? Math.sin(elapsedSeconds * RENDER.sky.animationSpeed) * RENDER.sky.animationAmplitude
      : 0;
    this.animatedTop.copy(this.top).offsetHSL(0, wave * 0.08, wave * 0.18);
    this.animatedBottom.copy(this.bottom).offsetHSL(0, wave * 0.06, wave * 0.11);
    fillGradientData(this.data, this.animatedTop, this.animatedBottom);
    this.texture.needsUpdate = true;
  }

  dispose(): void {
    this.texture?.dispose();
    this.texture = null;
    this.scene.background = null;
    this.scene.fog = null;
    this.transitionPending = false;
    this.transitionStartSeconds = null;
  }

  private updateTransition(elapsedSeconds: number): void {
    if (!this.transitionPending) return;
    this.transitionStartSeconds ??= elapsedSeconds;
    const elapsed = elapsedSeconds - this.transitionStartSeconds;
    const progress = smoothstep(Math.min(1, elapsed / this.transitionDurationSeconds));
    this.top.copy(this.transitionFromTop).lerp(this.transitionToTop, progress);
    this.bottom.copy(this.transitionFromBottom).lerp(this.transitionToBottom, progress);
    const fog = this.scene.fog;
    if (fog instanceof FogExp2) {
      fog.color.copy(this.transitionFromFog).lerp(this.transitionToFog, progress);
      fog.density =
        this.transitionFromDensity +
        (this.transitionToDensity - this.transitionFromDensity) * progress;
    }
    if (progress < 1) return;
    this.transitionPending = false;
    this.transitionStartSeconds = null;
  }
}

/** Dégradé vertical 1×N, interpolé linéairement par le GPU. */
export function createGradientTexture(
  topHex: number,
  bottomHex: number,
  targetData?: Uint8Array,
): DataTexture {
  const top = new Color(topHex);
  const bottom = new Color(bottomHex);
  const data = targetData ?? new Uint8Array(GRADIENT_STEPS * 4);

  fillGradientData(data, top, bottom);

  const texture = new DataTexture(data, 1, GRADIENT_STEPS, RGBAFormat);
  texture.name = 'AnimatedGradientSky';
  texture.colorSpace = SRGBColorSpace;
  texture.magFilter = LinearFilter;
  texture.minFilter = LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

function fillGradientData(data: Uint8Array, top: Color, bottom: Color): void {
  for (let i = 0; i < GRADIENT_STEPS; i += 1) {
    // i = 0 en bas de l'écran, i = N-1 en haut.
    const t = i / (GRADIENT_STEPS - 1);
    gradientScratch.copy(bottom).lerp(top, smoothstep(t));
    const offset = i * 4;
    data[offset] = Math.round(gradientScratch.r * 255);
    data[offset + 1] = Math.round(gradientScratch.g * 255);
    data[offset + 2] = Math.round(gradientScratch.b * 255);
    data[offset + 3] = 255;
  }
}

function smoothstep(t: number): number {
  return t * t * (3 - 2 * t);
}
