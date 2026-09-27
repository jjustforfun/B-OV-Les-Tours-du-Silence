/**
 * Renderer.ts — enveloppe du WebGLRenderer.
 *
 * Gère la couleur (sRGB + tone mapping), le redimensionnement respectueux des
 * safe-areas, le plafonnement du pixel ratio selon la qualité, et la
 * destruction propre du contexte (indispensable pour le cycle de vie Android).
 */
import {
  ACESFilmicToneMapping,
  PCFSoftShadowMap,
  SRGBColorSpace,
  Vector2,
  WebGLRenderer,
} from 'three';
import type { QualitySettings } from '@/config';

export interface RendererOptions {
  readonly canvas: HTMLCanvasElement;
  readonly quality: QualitySettings;
}

export class Renderer {
  readonly gl: WebGLRenderer;

  private readonly canvas: HTMLCanvasElement;
  private maxPixelRatio: number;
  private readonly sizeCache = new Vector2();

  constructor({ canvas, quality }: RendererOptions) {
    this.canvas = canvas;
    this.maxPixelRatio = quality.maxPixelRatio;

    this.gl = new WebGLRenderer({
      canvas,
      antialias: quality.antialias,
      alpha: false,
      powerPreference: 'high-performance',
      stencil: false,
      depth: true,
    });

    this.gl.outputColorSpace = SRGBColorSpace;
    this.gl.toneMapping = ACESFilmicToneMapping;
    this.gl.toneMappingExposure = 1.05;
    this.gl.shadowMap.enabled = quality.shadows;
    this.gl.shadowMap.type = PCFSoftShadowMap;
    this.gl.setClearColor(0x0d1117, 1);
  }

  /** Applique un nouveau preset de qualité à chaud. */
  applyQuality(quality: QualitySettings): void {
    this.maxPixelRatio = quality.maxPixelRatio;
    this.gl.shadowMap.enabled = quality.shadows;
    this.gl.shadowMap.needsUpdate = true;
    this.resize();
  }

  /** Redimensionne le canvas à la taille CSS courante. Retourne true si ça a changé. */
  resize(): boolean {
    const width = this.canvas.clientWidth || window.innerWidth;
    const height = this.canvas.clientHeight || window.innerHeight;
    const ratio = Math.min(window.devicePixelRatio || 1, this.maxPixelRatio);

    const targetWidth = Math.floor(width * ratio);
    const targetHeight = Math.floor(height * ratio);
    if (this.canvas.width === targetWidth && this.canvas.height === targetHeight) return false;

    this.gl.setPixelRatio(ratio);
    this.gl.setSize(width, height, false);
    return true;
  }

  /** Taille du canvas en pixels CSS. */
  get size(): Vector2 {
    return this.gl.getSize(this.sizeCache);
  }

  dispose(): void {
    this.gl.dispose();
    this.gl.forceContextLoss();
  }
}
