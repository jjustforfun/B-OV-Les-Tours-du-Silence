/**
 * motion.test.ts — préférence de mouvement réduit, y compris lorsqu'elle est
 * modifiée après la construction des effets.
 */
import { DataTexture, Scene } from 'three';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ambientDriftEnabled,
  isReducedMotion,
  motionDurationScale,
  setReducedMotionOverride,
} from '@core/motion';
import { Mist } from '@fx/Mist';
import { ParticlePool } from '@fx/Particles';
import { SKY_PALETTES, Sky } from '@render/Sky';

afterEach(() => {
  setReducedMotionOverride(undefined);
  vi.unstubAllGlobals();
});

describe('préférence de mouvement réduit', () => {
  it('permet de suivre le système ou de le forcer dans les deux sens', () => {
    setReducedMotionOverride(true);
    expect(isReducedMotion()).toBe(true);
    expect(motionDurationScale()).toBe(0.5);
    expect(ambientDriftEnabled()).toBe(false);

    setReducedMotionOverride(false);
    expect(isReducedMotion()).toBe(false);
    expect(motionDurationScale()).toBe(1);
    expect(ambientDriftEnabled()).toBe(true);
  });

  it('arrête et reprend immédiatement la dérive d’une brume déjà construite', () => {
    setReducedMotionOverride(false);
    const mist = new Mist({
      layers: 1,
      specs: [{ y: 1, z: 0, opacity: 0.1, width: 4, height: 2 }],
    });

    mist.update(10);
    expect(mist.layers[0]?.mesh.position.x).not.toBe(0);

    setReducedMotionOverride(true);
    mist.update(10);
    expect(mist.layers[0]?.mesh.position.x).toBe(0);

    setReducedMotionOverride(false);
    mist.update(10);
    expect(mist.layers[0]?.mesh.position.x).not.toBe(0);
    mist.dispose();
  });

  it('applique la demi-durée aux nouvelles particules sans reconstruire le pool', () => {
    setReducedMotionOverride(false);
    const pool = new ParticlePool({ budget: 8 });
    const emission = {
      x: 0,
      y: 0,
      z: 0,
      count: 1,
      color: 0xffffff,
      speed: 0,
      speedVariance: 0,
      size: 0.1,
      lifetime: 1,
      lifetimeVariance: 0,
    } as const;

    setReducedMotionOverride(true);
    pool.emit(emission);
    pool.update(0.51);
    expect(pool.aliveCount).toBe(0);

    setReducedMotionOverride(false);
    pool.emit(emission);
    pool.update(0.51);
    expect(pool.aliveCount).toBe(1);
    pool.dispose();
  });

  it('fige la respiration du ciel tout en conservant son dégradé', () => {
    const scene = new Scene();
    const sky = new Sky(scene);
    sky.apply(SKY_PALETTES.dawn);
    setReducedMotionOverride(true);

    sky.update(1);
    const texture = scene.background;
    expect(texture).toBeInstanceOf(DataTexture);
    if (!(texture instanceof DataTexture) || texture.image.data === null) return;
    const first = Uint8Array.from(texture.image.data);

    sky.update(30);
    expect(Array.from(texture.image.data ?? [])).toEqual(Array.from(first));

    setReducedMotionOverride(false);
    sky.update(30);
    expect(Array.from(texture.image.data ?? [])).not.toEqual(Array.from(first));
    sky.dispose();
  });

  it('réutilise la MediaQueryList au lieu de rappeler matchMedia à chaque image', () => {
    const query = { matches: true } as MediaQueryList;
    const matchMedia = vi.fn(() => query);
    vi.stubGlobal('matchMedia', matchMedia);
    setReducedMotionOverride(undefined);

    expect(isReducedMotion()).toBe(true);
    expect(motionDurationScale()).toBe(0.5);
    expect(ambientDriftEnabled()).toBe(false);
    expect(matchMedia).toHaveBeenCalledTimes(1);
  });
});
