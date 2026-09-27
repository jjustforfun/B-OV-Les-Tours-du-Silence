/**
 * audio-mixing.test.ts — curseur → décibels (ADR-025).
 *
 * Le mix nominal doit tomber pile sur les valeurs de docs/AUDIO.md § 1 :
 * master 0,9 → −0,9 dB, music −9, ambience −14, sfx −6.
 */
import { describe, expect, it } from 'vitest';
import { AUDIO } from '@/config';
import { busGainDb, duckOffsetDb, masterGainDb } from '@audio/mixing';

describe('busGainDb', () => {
  it('retombe sur le gain nominal au curseur par défaut', () => {
    expect(busGainDb('music', AUDIO.volumes.music)).toBeCloseTo(-9, 9);
    expect(busGainDb('ambience', AUDIO.volumes.ambience)).toBeCloseTo(-14, 9);
    expect(busGainDb('sfx', AUDIO.volumes.sfx)).toBeCloseTo(-6, 9);
  });

  it('atténue autour du nominal, en décibels', () => {
    // Curseur à la moitié de la référence : −6 dB (à l'arrondi du logarithme).
    expect(busGainDb('music', AUDIO.volumes.music / 2)).toBeCloseTo(-15.0206, 3);
    // Curseur au maximum : +3 dB environ au-dessus du nominal.
    expect(busGainDb('sfx', 1)).toBeCloseTo(-6 + 20 * Math.log10(1 / 0.85), 6);
  });

  it('coupe net à zéro', () => {
    expect(busGainDb('music', 0)).toBe(Number.NEGATIVE_INFINITY);
  });
});

describe('masterGainDb', () => {
  it('est linéaire : 0,9 → −0,9 dB (un vrai master)', () => {
    expect(masterGainDb(0.9)).toBeCloseTo(20 * Math.log10(0.9), 9);
    expect(masterGainDb(1)).toBeCloseTo(0, 9);
  });

  it('coupe net à zéro', () => {
    expect(masterGainDb(0)).toBe(Number.NEGATIVE_INFINITY);
  });
});

describe('duckOffsetDb', () => {
  it('laisse les buses tranquilles hors ducking', () => {
    expect(duckOffsetDb('music', false)).toBe(0);
    expect(duckOffsetDb('ambience', false)).toBe(0);
  });

  it('atténue la musique plus fort que l’ambiance (docs/AUDIO.md § 6)', () => {
    expect(duckOffsetDb('music', true)).toBe(AUDIO.duck.musicDb);
    expect(duckOffsetDb('ambience', true)).toBe(AUDIO.duck.ambienceDb);
    expect(AUDIO.duck.musicDb).toBeLessThan(AUDIO.duck.ambienceDb);
  });
});
