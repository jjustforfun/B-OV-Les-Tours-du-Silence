/**
 * PostFX.ts — chaîne de post-traitement pmndrs/postprocessing.
 *
 * La chaîne est entièrement pilotée par `Quality.settings` : rien en qualité
 * basse ; en medium/high, RenderPass → (SSAO high) → bloom doux → vignette →
 * LUT de chapitre → SMAA. Couper la chaîne ne change que l'image, jamais la
 * simulation ni le picking.
 */
import {
  BlendFunction,
  BloomEffect,
  EffectPass,
  EffectComposer,
  LUT3DEffect,
  NormalPass,
  RenderPass,
  SMAAEffect,
  SMAAPreset,
  SSAOEffect,
  VignetteEffect,
  VignetteTechnique,
  type Effect,
} from 'postprocessing';
import {
  Color,
  SRGBColorSpace,
  Vector2,
  type Camera,
  type Scene,
  type Texture,
  type WebGLRenderer,
} from 'three';
import { RENDER, type QualitySettings } from '@/config';
import { getChapterLut } from '@render/ChapterLut';
import type { ChapterPaletteName } from '@render/Palettes';

export class PostFX {
  private composer: EffectComposer | null = null;
  /**
   * Texture de bruit interne du SSAO. `SSAOEffect` la crée mais ne la range
   * que dans un uniform de son matériau : le `dispose()` superficiel de
   * postprocessing ne la voit jamais (+1 texture GPU par reconstruction,
   * mesuré par ?memcheck). On la suit donc explicitement pour la libérer.
   */
  private ssaoNoiseTexture: Texture | null = null;
  private signature = 'off';
  private width = 1;
  private height = 1;
  private chapterPalette: ChapterPaletteName;

  constructor(
    private readonly renderer: WebGLRenderer,
    private readonly scene: Scene,
    private readonly camera: Camera,
    quality: QualitySettings,
    chapterPalette: ChapterPaletteName = 'prologue',
  ) {
    this.chapterPalette = chapterPalette;
    // Dimensions réelles du renderer dès la construction : un composer bâti
    // en 1×1 écraserait le style CSS du canvas (voir setSize ci-dessous) et
    // le jeu resterait un pixel noir — attrapé par le premier vrai navigateur.
    const size = renderer.getSize(new Vector2());
    this.width = Math.max(1, Math.floor(size.x));
    this.height = Math.max(1, Math.floor(size.y));
    this.applyQuality(quality);
  }

  get isEnabled(): boolean {
    return this.composer !== null;
  }

  setChapterPalette(name: ChapterPaletteName, quality: QualitySettings): void {
    if (name === this.chapterPalette) return;
    this.chapterPalette = name;
    this.rebuild(quality);
  }

  applyQuality(quality: QualitySettings): void {
    const signature = this.createSignature(quality);
    if (!quality.postFx) {
      this.signature = signature;
      this.disposeComposer();
      return;
    }
    if (this.composer && signature === this.signature) return;

    this.signature = signature;
    this.rebuild(quality);
  }

  setSize(width: number, height: number): void {
    this.width = Math.max(1, Math.floor(width));
    this.height = Math.max(1, Math.floor(height));
    this.composer?.setSize(this.width, this.height, false);
  }

  /** Retourne true si le rendu a été effectué par la chaîne de post-traitement. */
  render(deltaSeconds: number): boolean {
    if (!this.composer) return false;
    this.composer.render(deltaSeconds);
    return true;
  }

  dispose(): void {
    this.disposeComposer();
  }

  private rebuild(quality: QualitySettings): void {
    this.disposeComposer();
    if (!quality.postFx) return;

    const composer = new EffectComposer(this.renderer);
    const effects: Effect[] = [];

    if (quality.ssao) {
      const normalPass = new NormalPass(this.scene, this.camera, {
        resolutionScale: RENDER.postFx.ssaoResolutionScale,
      });
      composer.addPass(normalPass);
      const ssao = new SSAOEffect(this.camera, normalPass.texture, {
        blendFunction: BlendFunction.MULTIPLY,
        samples: 7,
        rings: 5,
        radius: RENDER.postFx.ssaoRadius,
        intensity: RENDER.postFx.ssaoIntensity,
        luminanceInfluence: 0.78,
        resolutionScale: RENDER.postFx.ssaoResolutionScale,
        color: new Color(0x526070),
      });
      // `noiseTexture` est un accesseur en écriture seule : on lit l'uniform.
      const noiseUniform = ssao.ssaoMaterial.uniforms.noiseTexture as { value: Texture | null };
      this.ssaoNoiseTexture = noiseUniform?.value ?? null;
      effects.push(ssao);
    }

    composer.addPass(new RenderPass(this.scene, this.camera));

    if (quality.bloom) {
      const bloom = new BloomEffect({
        blendFunction: BlendFunction.SCREEN,
        luminanceThreshold: RENDER.postFx.bloomThreshold,
        luminanceSmoothing: RENDER.postFx.bloomSmoothing,
        intensity: quality.bloomIntensity,
        radius: RENDER.postFx.bloomRadius,
        levels: 5,
        mipmapBlur: true,
      });
      effects.push(bloom);
    }

    if (quality.vignette) {
      effects.push(
        new VignetteEffect({
          blendFunction: BlendFunction.NORMAL,
          technique: VignetteTechnique.DEFAULT,
          offset: RENDER.postFx.vignetteOffset,
          darkness: RENDER.postFx.vignetteDarkness,
        }),
      );
    }

    if (quality.lut) {
      const lut = new LUT3DEffect(getChapterLut(this.chapterPalette), {
        blendFunction: BlendFunction.NORMAL,
        inputColorSpace: SRGBColorSpace,
      });
      lut.blendMode.setOpacity(RENDER.postFx.lutOpacity);
      effects.push(lut);
    }

    if (quality.smaa) {
      effects.push(new SMAAEffect({ preset: quality.ssao ? SMAAPreset.HIGH : SMAAPreset.MEDIUM }));
    }

    if (effects.length > 0) composer.addPass(new EffectPass(this.camera, ...effects));
    // `false` : ne JAMAIS laisser le composer écrire le style CSS du canvas.
    composer.setSize(this.width, this.height, false);
    this.composer = composer;
  }

  private disposeComposer(): void {
    this.composer?.dispose();
    this.composer = null;
    // Voir le commentaire de `ssaoNoiseTexture` : postprocessing l'oublie.
    this.ssaoNoiseTexture?.dispose();
    this.ssaoNoiseTexture = null;
  }

  private createSignature(quality: QualitySettings): string {
    if (!quality.postFx) return 'off';
    return [
      this.chapterPalette,
      quality.bloom ? `bloom:${quality.bloomIntensity.toFixed(3)}` : 'bloom:0',
      quality.vignette ? 'vignette:1' : 'vignette:0',
      quality.lut ? 'lut:1' : 'lut:0',
      quality.smaa ? 'smaa:1' : 'smaa:0',
      quality.ssao ? 'ssao:1' : 'ssao:0',
    ].join('|');
  }
}
