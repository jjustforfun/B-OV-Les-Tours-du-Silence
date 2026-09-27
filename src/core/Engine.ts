/**
 * Engine.ts — assemblage minimal du moteur.
 *
 * Responsabilité : posséder la scène, le renderer, la caméra, l'éclairage, le
 * ciel et la boucle ; réagir au redimensionnement et aux changements de
 * qualité ; exposer des points d'accroche (`onUpdate`) pour le gameplay.
 * Tout le reste (niveaux, entités, UI, audio) se branche dessus et peut être
 * retiré sans que le moteur s'en aperçoive.
 */
import { Scene } from 'three';
import { GameLoop } from './GameLoop';
import { Quality } from './Quality';
import { bus } from './EventBus';
import type { Time } from './Time';
import { CameraRig } from '@render/CameraRig';
import { Lighting } from '@render/Lighting';
import { PostFX } from '@render/PostFX';
import { Renderer } from '@render/Renderer';
import { Sky, SKY_PALETTES, type SkyPaletteName } from '@render/Sky';
import { disposeObject } from '@utils/dispose';

export interface EngineOptions {
  readonly canvas: HTMLCanvasElement;
  readonly quality?: Quality;
  readonly skyPalette?: SkyPaletteName;
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

    this.postFx = new PostFX(this.renderer.gl, this.scene, this.cameraRig.camera, settings);

    this.loop = new GameLoop({
      update: (time) => this.update(time),
      render: (time) => this.render(time),
    });

    this.quality.onChange((tier, reason) => {
      const next = this.quality.settings;
      this.renderer.applyQuality(next);
      this.lighting.applyQuality(next);
      this.postFx.applyQuality(next);
      bus.emit('engine:quality', { tier, reason });
    });

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
    this.renderer.dispose();
    this.updaters.clear();
  }

  private update(time: Time): void {
    this.quality.sample(time.fps, time.unscaledDelta * 1000);
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
    this.cameraRig.setAspect(width / Math.max(height, 1));
    this.postFx.setSize(width, height);
    bus.emit('engine:resize', { width, height });
  };
}
