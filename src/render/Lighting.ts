/**
 * Lighting.ts — éclairage à trois sources, façon gouache.
 *
 * Doctrine (voir docs/ART_DIRECTION.md) : une lumière-soleil rasante qui
 * sculpte la pierre, un ciel hémisphérique froid qui remplit les ombres, et
 * un rebond chaud au sol qui évoque la vallée. Aucune lumière ponctuelle
 * dynamique par défaut : le coût sur mobile ne se justifie jamais.
 */
import { AmbientLight, DirectionalLight, HemisphereLight, Object3D } from 'three';
import type { Scene } from 'three';
import type { QualitySettings } from '@/config';

export interface LightingPalette {
  readonly sun: number;
  readonly sunIntensity: number;
  readonly skyTop: number;
  readonly skyGround: number;
  readonly hemiIntensity: number;
  readonly ambient: number;
  readonly ambientIntensity: number;
}

export const DEFAULT_LIGHTING: LightingPalette = {
  sun: 0xffd9a0,
  sunIntensity: 2.1,
  skyTop: 0x9fb6d6,
  skyGround: 0x6b5a48,
  hemiIntensity: 1.05,
  ambient: 0x404a5c,
  ambientIntensity: 0.35,
};

export class Lighting {
  readonly root = new Object3D();
  readonly sun: DirectionalLight;
  readonly hemi: HemisphereLight;
  readonly ambient: AmbientLight;

  constructor(
    private readonly scene: Scene,
    quality: QualitySettings,
    palette: LightingPalette = DEFAULT_LIGHTING,
  ) {
    this.root.name = 'Lighting';

    this.sun = new DirectionalLight(palette.sun, palette.sunIntensity);
    this.sun.position.set(6, 10, 4);
    this.sun.castShadow = quality.shadows;
    this.configureShadow(quality);

    this.hemi = new HemisphereLight(palette.skyTop, palette.skyGround, palette.hemiIntensity);
    this.ambient = new AmbientLight(palette.ambient, palette.ambientIntensity);

    this.root.add(this.sun, this.sun.target, this.hemi, this.ambient);
    this.scene.add(this.root);
  }

  applyQuality(quality: QualitySettings): void {
    this.sun.castShadow = quality.shadows;
    this.configureShadow(quality);
  }

  setPalette(palette: LightingPalette): void {
    this.sun.color.setHex(palette.sun);
    this.sun.intensity = palette.sunIntensity;
    this.hemi.color.setHex(palette.skyTop);
    this.hemi.groundColor.setHex(palette.skyGround);
    this.hemi.intensity = palette.hemiIntensity;
    this.ambient.color.setHex(palette.ambient);
    this.ambient.intensity = palette.ambientIntensity;
  }

  dispose(): void {
    this.sun.shadow.dispose();
    this.scene.remove(this.root);
    this.root.clear();
  }

  private configureShadow(quality: QualitySettings): void {
    const { shadow } = this.sun;
    shadow.mapSize.setScalar(quality.shadowMapSize);
    shadow.bias = -0.0008;
    shadow.normalBias = 0.02;
    // Frustum d'ombre calé sur la taille d'un niveau (≈ 24 cellules).
    shadow.camera.left = -16;
    shadow.camera.right = 16;
    shadow.camera.top = 16;
    shadow.camera.bottom = -16;
    shadow.camera.near = 0.5;
    shadow.camera.far = 60;
    shadow.camera.updateProjectionMatrix();
  }
}
