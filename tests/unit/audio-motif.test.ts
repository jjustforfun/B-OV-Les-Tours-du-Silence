/**
 * audio-motif.test.ts — motifs du pondar et de la mélodie, en pur.
 *
 * « Jamais deux fois identique » (docs/AUDIO.md § 4) : 5 à 7 notes non
 * métriques pour le pondar, arcs de quartes/quintes pour la mélodie, motif
 * ternaire lâche pour le doul. Le hasard est injecté — borné par contrat.
 */
import { describe, expect, it } from 'vitest';
import {
  generateDoulPattern,
  generateMelodyPhrase,
  generatePondarMotif,
  nextMelodyPhraseDelay,
  nextPondarPhraseDelay,
  type Rng,
} from '@audio/motif';

const SCALE = [50, 52, 53, 55, 57, 59, 60, 62, 64, 65, 67, 69, 71, 72, 74];

/** RNG pseudo-aléatoire borné, pour semer la variété sans Math.random. */
const seeded = (seed: number): Rng => {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
};

describe('generatePondarMotif', () => {
  it('produit 5 à 7 notes, toutes dans la gamme', () => {
    for (let seed = 1; seed <= 20; seed += 1) {
      const notes = generatePondarMotif(SCALE, seeded(seed));
      expect(notes.length).toBeGreaterThanOrEqual(5);
      expect(notes.length).toBeLessThanOrEqual(7);
      for (const note of notes) {
        expect(SCALE).toContain(note.midi);
        expect(note.gain).toBeGreaterThanOrEqual(0.45);
        expect(note.gain).toBeLessThanOrEqual(0.85);
      }
    }
  });

  it('espace les notes de façon non métrique (jamais deux fois le même écart)', () => {
    const notes = generatePondarMotif(SCALE, seeded(7));
    const gaps: number[] = [];
    for (let i = 1; i < notes.length; i += 1) {
      const gap = (notes[i]?.atSeconds ?? 0) - (notes[i - 1]?.atSeconds ?? 0);
      gaps.push(gap);
      expect(gap).toBeGreaterThanOrEqual(0.35);
      expect(gap).toBeLessThanOrEqual(0.35 + 1.05 + 1e-9);
    }
    expect(new Set(gaps).size).toBeGreaterThan(1); // pas une métrique figée
  });

  it('commence à t = 0 et respecte l’ordre chronologique', () => {
    const notes = generatePondarMotif(SCALE, seeded(3));
    expect(notes[0]?.atSeconds).toBe(0);
    for (let i = 1; i < notes.length; i += 1) {
      expect((notes[i]?.atSeconds ?? 0) - (notes[i - 1]?.atSeconds ?? 0)).toBeGreaterThan(0);
    }
  });
});

describe('nextPondarPhraseDelay / nextMelodyPhraseDelay', () => {
  it('respecte les fenêtres 8–14 s et 9–15 s', () => {
    expect(nextPondarPhraseDelay(() => 0)).toBe(8);
    expect(nextPondarPhraseDelay(() => 1)).toBeCloseTo(14, 9);
    expect(nextMelodyPhraseDelay(() => 0)).toBe(9);
    expect(nextMelodyPhraseDelay(() => 1)).toBeCloseTo(15, 9);
  });
});

describe('generateMelodyPhrase', () => {
  it('chante 3 à 5 notes longues dans la gamme, en arc', () => {
    for (let seed = 1; seed <= 20; seed += 1) {
      const notes = generateMelodyPhrase(SCALE, seeded(seed));
      expect(notes.length).toBeGreaterThanOrEqual(3);
      expect(notes.length).toBeLessThanOrEqual(5);
      let last = -1;
      for (const note of notes) {
        expect(SCALE).toContain(note.midi);
        expect(note.atSeconds).toBeGreaterThan(last);
        last = note.atSeconds;
        expect(note.gain).toBeLessThanOrEqual(0.86);
      }
    }
  });
});

describe('generateDoulPattern', () => {
  it('met l’accent sur les temps forts du ternaire', () => {
    const pattern = generateDoulPattern(12, seeded(11), 1);
    expect(pattern.length).toBe(12);
    const strong = pattern.filter((_v, i) => i % 3 === 0);
    const weak = pattern.filter((_v, i) => i % 3 !== 0);
    const avg = (xs: number[]): number => xs.reduce((a, b) => a + b, 0) / xs.length;
    // Sur un grand nombre de frappes, les temps forts dominent statistiquement.
    expect(avg(strong)).toBeGreaterThan(avg(weak));
  });

  it('jamais de frappe exagérée : vélocités dans [0, 0.7]', () => {
    for (let seed = 1; seed <= 10; seed += 1) {
      for (const value of generateDoulPattern(30, seeded(seed), 1)) {
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(0.7 + 1e-9);
      }
    }
  });

  it('peut se taire complètement (rng saturé)', () => {
    expect(generateDoulPattern(9, () => 1, 1)).toEqual(Array.from({ length: 9 }, () => 0));
  });
});
