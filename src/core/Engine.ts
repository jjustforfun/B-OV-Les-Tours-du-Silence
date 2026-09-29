/**
 * Engine.ts — assemblage minimal du moteur.
 *
 * Responsabilité : posséder la scène, le renderer, la caméra, l'éclairage, le
 * ciel et la boucle ; réagir au redimensionnement et aux changements de
 * qualité ; exposer des points d'accroche (`onUpdate`) pour le gameplay.
 * Tout le reste (niveaux, entités, UI, audio) se branche dessus et peut être
 * retiré sans que le moteur s'en aperçoive.
 */
import { Scene, Vector3 } from 'three';
import { GameLoop } from './GameLoop';
import { Quality } from './Quality';
import { bus } from './EventBus';
import type { Time } from './Time';
import { CameraRig } from '@render/CameraRig';
import { Lighting } from '@render/Lighting';
import { PostFX } from '@render/PostFX';
import { Renderer } from '@render/Renderer';
import { disposeChapterLuts } from '@render/ChapterLut';
import { disposeToonGradients } from '@render/materials/ToonStoneMaterial';
import { Sky, SKY_PALETTES, type SkyPaletteName } from '@render/Sky';
import { disposeObject } from '@utils/dispose';
import type { ChapterPaletteName } from '@render/Palettes';

export interface EngineOptions {
  readonly canvas: HTMLCanvasElement;
  readonly quality?: Quality;
  readonly skyPalette?: SkyPaletteName;
  readonly chapterPalette?: ChapterPaletteName;
}

export class Engine {
  readonly scene = new Scene();
  readonly quality: Quality;
  readonly renderer: Renderer;
  readonly cameraRig: CameraRig;
  readonly lighting: Lighting;
  readonly sky: Sky;
  readonly postFx: PostFX;
  readonly loop: GameLoop;

  private readonly updaters = new Set<(time: Time) => void>();
  private readonly resizeObserver: ResizeObserver | null = null;
  private readonly framedMin = new Vector3();
  private readonly framedMax = new Vector3();
  private frameMargin = 0.08;
  private hasFrameBounds = false;
  private disposed = false;

  constructor(options: EngineOptions) {
    this.quality = options.quality ?? new Quality();
    const settings = this.quality.settings;

    this.scene.name = 'BovScene';
    this.renderer = new Renderer({ canvas: options.canvas, quality: settings });
    this.renderer.resize();

    const { width, height } = this.renderer.size;
    this.cameraRig = new CameraRig(width / Math.max(height, 1));
    this.scene.add(this.cameraRig.pivot);

    this.lighting = new Lighting(this.scene, settings);
    this.sky = new Sky(this.scene);
    this.sky.apply(SKY_PALETTES[options.skyPalette ?? 'dawn']);

    this.postFx = new PostFX(
      this.renderer.gl,
      this.scene,
      this.cameraRig.camera,
      settings,
      options.chapterPalette ?? 'prologue',
    );

    this.loop = new GameLoop({
      update: (time) => this.update(time),
      render: (time) => this.render(time),
    });

    this.quality.onChange((tier, reason) => {
      const next = this.quality.settings;
      this.renderer.applyQuality(next);
      this.lighting.applyQuality(next);
      this.postFx.applyQuality(next);
      document.documentElement.dataset.qualityTier = tier;
      bus.emit('engine:quality', { tier, reason });
    });
    // Le tier initial est observable dès le boot (QA, e2e, CSS éventuel).
    document.documentElement.dataset.qualityTier = this.quality.current;

    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => this.handleResize());
      this.resizeObserver.observe(options.canvas);
    }
    window.addEventListener('orientationchange', this.handleResize);
  }

  /** Enregistre une fonction appelée à chaque image. Retourne le désabonnement. */
  onUpdate(fn: (time: Time) => void): () => void {
    this.updaters.add(fn);
    return () => this.updaters.delete(fn);
  }

  /** Cadre un niveau et garde ce cadrage stable lors des rotations d'écran. */
  frameLevel(min: Vector3, max: Vector3, margin = 0.08): void {
    this.framedMin.copy(min);
    this.framedMax.copy(max);
    this.frameMargin = margin;
    this.hasFrameBounds = true;
    const { width, height } = this.renderer.size;
    this.cameraRig.frameLevel(this.framedMin, this.framedMax, width / Math.max(height, 1), margin);
  }

  start(): void {
    this.handleResize();
    this.loop.start();
    bus.emit('engine:ready', { renderer: 'webgl' });
  }

  stop(): void {
    this.loop.stop();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    window.removeEventListener('orientationchange', this.handleResize);
    this.resizeObserver?.disconnect();
    this.loop.dispose();
    this.postFx.dispose();
    this.lighting.dispose();
    this.sky.dispose();
    disposeObject(this.scene);
    disposeChapterLuts();
    disposeToonGradients();
    this.renderer.dispose();
    this.updaters.clear();
  }

  private update(time: Time): void {
    this.quality.sample(time.fps, time.unscaledDelta * 1000);
    this.sky.update(time.elapsed);
    for (const updater of this.updaters) updater(time);
  }

  private render(time: Time): void {
    if (!this.postFx.render(time.unscaledDelta)) {
      this.renderer.gl.render(this.scene, this.cameraRig.camera);
    }
  }

  private readonly handleResize = (): void => {
    this.renderer.resize();
    const { width, height } = this.renderer.size;
    const aspect = width / Math.max(height, 1);
    if (this.hasFrameBounds) {
      this.cameraRig.frameLevel(this.framedMin, this.framedMax, aspect, this.frameMargin);
    } else {
      this.cameraRig.setAspect(aspect);
    }
    this.postFx.setSize(width, height);
    bus.emit('engine:resize', { width, height });
  };
}
