/**
 * audio-scale.test.ts — gammes et accordages par chapitre (docs/AUDIO.md § 3).
 *
 * « Manipuler le monde devient musique » : chaque cran de mécanisme avance
 * d'un degré sur la gamme du chapitre. Le curseur doit être borné, le sens de
 * rotation doit tenir compte du bouclage du cycle, et le chapitre 7 doit
 * revenir à l'accordage du prologue — le chant revenu.
 */
import { describe, expect, it } from 'vitest';
import {
  CHAPTER_TUNINGS,
  MODE_SEMITONES,
  ScaleCursor,
  frequencyWithCents,
  midiToFrequency,
  midiToNoteName,
  notchDelta,
  parseNote,
  randomDetuneCents,
  scaleMidis,
  tuningForChapter,
} from '@audio/ChapterScale';

describe('parseNote / midiToNoteName / midiToFrequency', () => {
  it('va-et-vient entre nom et midi', () => {
    expect(parseNote('D3')).toBe(50);
    expect(parseNote('A4')).toBe(69);
    expect(midiToNoteName(50)).toBe('D3');
    expect(midiToFrequency(69)).toBeCloseTo(440, 6);
  });

  it('applique les cents en tempérament égal', () => {
    expect(frequencyWithCents(440, 0)).toBeCloseTo(440, 9);
    expect(frequencyWithCents(440, 4)).toBeCloseTo(440 * 2 ** (4 / 1200), 9);
  });
});

describe('scaleMidis', () => {
  it('construit la gamme dorienne sur deux octaves', () => {
    const dorian = scaleMidis(50, 'dorian');
    const first = dorian[0] ?? -1;
    const second = dorian[1] ?? -1;
    const third = dorian[2] ?? -1;
    const octave = dorian[7] ?? -1;
    expect(first).toBe(50);
    expect(dorian.length).toBe(MODE_SEMITONES.dorian.length * 2 + 1);
    // Le mode dorien : ton, demi, ton, ton, ton, demi, ton.
    expect(second - first).toBe(2);
    expect(third - second).toBe(1);
    expect(octave).toBe(62); // octave juste
  });
});

describe('tuningForChapter', () => {
  it('borne les chapitres hors table', () => {
    expect(tuningForChapter(-3).chapter).toBe(0);
    expect(tuningForChapter(99).chapter).toBe(CHAPTER_TUNINGS.length - 1);
  });

  it('revient à l’accord du prologue au chapitre 7', () => {
    const prologue = tuningForChapter(0);
    const epilogue = tuningForChapter(7);
    expect(epilogue.root).toBe(prologue.root);
    expect(epilogue.mode).toBe(prologue.mode);
    expect(epilogue.stringMidis).toEqual(prologue.stringMidis);
  });

  it('propose huit accordages distincts en racine ou en mode', () => {
    const signatures = new Set(
      CHAPTER_TUNINGS.map((tuning) => `${tuning.rootMidi}:${tuning.mode}`),
    );
    expect(signatures.size).toBeGreaterThan(4); // variété réelle, pas un doublon
  });
});

describe('ScaleCursor', () => {
  const notes = [50, 52, 53, 55, 57];

  it('avance d’un degré par cran et s’arrête en butée', () => {
    const cursor = new ScaleCursor(notes);
    expect(cursor.step(1)).toBe(52);
    expect(cursor.step(1)).toBe(53);
    expect(cursor.step(-1)).toBe(52);
    for (let i = 0; i < 10; i += 1) cursor.step(1);
    expect(cursor.midi).toBe(57); // la pierre a atteint son sommet
    expect(cursor.step(1)).toBe(57);
  });

  it('repart du début après reset', () => {
    const cursor = new ScaleCursor(notes, 2);
    expect(cursor.midi).toBe(53);
    cursor.reset();
    expect(cursor.midi).toBe(50);
  });
});

describe('notchDelta', () => {
  it('compte le bouclage du cycle (3 → 0 sur 4 crans = +1)', () => {
    expect(notchDelta(3, 0, 4)).toBe(1);
    expect(notchDelta(0, 3, 4)).toBe(-1);
    expect(notchDelta(1, 2)).toBe(1); // sans cycle : différence simple
  });
});

describe('randomDetuneCents', () => {
  it('reste dans ±4 cents, jamais deux fois pareil', () => {
    expect(randomDetuneCents(() => 0)).toBe(-4);
    expect(randomDetuneCents(() => 1)).toBe(4);
    expect(randomDetuneCents(() => 0.5)).toBe(0);
    expect(Math.abs(randomDetuneCents(() => 0.25))).toBe(2);
  });
});
