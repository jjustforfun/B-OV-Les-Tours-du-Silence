/**
 * quality.test.ts — la qualité adaptative est une promesse de confort :
 * elle doit descendre quand ça rame, remonter quand ça respire, ne jamais
 * osciller, et **jamais activer d'ombre dynamique sur mobile** (AGENTS.md § 6).
 */
import { describe, expect, it, vi } from 'vitest';
import { PERF } from '@/config';
import { Quality, guessInitialTier, type DeviceProfile } from '@core/Quality';

function profile(overrides: Partial<DeviceProfile> = {}): DeviceProfile {
  return {
    isMobile: false,
    isCoarsePointer: false,
    devicePixelRatio: 2,
    hardwareConcurrency: 8,
    prefersReducedMotion: false,
    ...overrides,
  };
}

/** Alimente l'observateur jusqu'à franchir la fenêtre d'adaptation. */
function feed(quality: Quality, fps: number): void {
  const frames = Math.ceil(PERF.adaptWindowMs / 16) + 1;
  for (let i = 0; i < frames; i += 1) quality.sample(fps, 16);
}

describe('guessInitialTier', () => {
  it('est prudent sur mobile', () => {
    expect(guessInitialTier(profile({ isMobile: true, hardwareConcurrency: 4 }))).toBe('low');
    expect(guessInitialTier(profile({ isMobile: true, hardwareConcurrency: 8 }))).toBe('medium');
  });

  it('est confiant sur desktop', () => {
    expect(guessInitialTier(profile({ hardwareConcurrency: 8 }))).toBe('high');
    expect(guessInitialTier(profile({ hardwareConcurrency: 4 }))).toBe('medium');
  });
});

describe('Quality — règle dure des ombres mobiles', () => {
  it('désactive les shadow maps sur mobile, quel que soit le tier', () => {
    const quality = new Quality(profile({ isMobile: true }));
    for (const tier of ['low', 'medium', 'high'] as const) {
      quality.setTier(tier);
      expect(quality.settings.shadows).toBe(false);
    }
  });

  it('les conserve sur desktop', () => {
    const quality = new Quality(profile());
    quality.setTier('high');
    expect(quality.settings.shadows).toBe(true);
  });

  it('plafonne le pixel ratio à 2 partout', () => {
    const quality = new Quality(profile());
    quality.setTier('high');
    expect(quality.settings.maxPixelRatio).toBeLessThanOrEqual(2);
  });
});

describe('Quality — adaptation', () => {
  it('descend d’un cran quand le framerate s’effondre', () => {
    const quality = new Quality(profile());
    const onChange = vi.fn();
    quality.onChange(onChange);

    expect(quality.current).toBe('high');
    feed(quality, 30);

    expect(quality.current).toBe('medium');
    expect(onChange).toHaveBeenCalledWith('medium', 'auto-downgrade');
  });

  it('remonte d’un cran quand le framerate respire', () => {
    const quality = new Quality(profile({ hardwareConcurrency: 4 }));
    expect(quality.current).toBe('medium');

    feed(quality, 60);
    expect(quality.current).toBe('high');
  });

  it('n’oscille pas dans la zone d’hystérésis', () => {
    const quality = new Quality(profile());
    const between = (PERF.downgradeFps + PERF.upgradeFps) / 2;

    feed(quality, between);
    feed(quality, between);
    expect(quality.current).toBe('high');
  });

  it('ne change rien avant la fin de la fenêtre d’observation', () => {
    const quality = new Quality(profile());
    quality.sample(20, 500);
    expect(quality.current).toBe('high');
  });

  it('gèle l’adaptation dès que le joueur choisit lui-même', () => {
    const quality = new Quality(profile());
    quality.setTier('low', 'user');

    feed(quality, 60);
    expect(quality.current).toBe('low');
  });
});
