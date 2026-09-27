/**
 * PostFX.ts — chaîne de post-traitement (pmndrs/postprocessing).
 *
 * Statut : squelette. Activée seulement si QualitySettings.postFx est vrai.
 * Chaîne visée (phase « Direction artistique ») :
 *   Render → SSAO (high) → Bloom doux → Vignette → LUT chaude → SMAA (high)
 * Règle : aucun effet ne doit coûter plus de 2 ms sur mobile milieu de gamme,
 * et la chaîne entière doit pouvoir être coupée sans changer le gameplay.
 */
import { EffectComposer, RenderPass } from 'postprocessing';
import type { Camera, Scene, WebGLRenderer } from 'three';
import type { QualitySettings } from '@/config';

export class PostFX {
  private composer: EffectComposer | null = null;
  private enabled = false;

  constructor(
    private readonly renderer: WebGLRenderer,
    private readonly scene: Scene,
    private readonly camera: Camera,
    quality: QualitySettings,
  ) {
    this.applyQuality(quality);
  }

  get isEnabled(): boolean {
    return this.enabled && this.composer !== null;
  }

  applyQuality(quality: QualitySettings): void {
    this.enabled = quality.postFx;
    if (!this.enabled) {
      this.disposeComposer();
      return;
    }
    if (this.composer) return;

    const composer = new EffectComposer(this.renderer);
    composer.addPass(new RenderPass(this.scene, this.camera));
    // TODO(phase DA) : BloomEffect, VignetteEffect, LUT, SMAA selon `quality`.
    this.composer = composer;
  }

  setSize(width: number, height: number): void {
    this.composer?.setSize(width, height);
  }

  /** Retourne true si le rendu a été effectué par la chaîne de post-traitement. */
  render(deltaSeconds: number): boolean {
    if (!this.composer || !this.enabled) return false;
    this.composer.render(deltaSeconds);
    return true;
  }

  dispose(): void {
    this.disposeComposer();
  }

  private disposeComposer(): void {
    this.composer?.dispose();
    this.composer = null;
  }
}
