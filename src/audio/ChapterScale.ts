/**
 * ChapterScale.ts — gammes, accordages et curseur musical, en pur.
 *
 * La décision de sound design la plus importante du jeu (docs/AUDIO.md § 5) :
 * **manipuler le monde, c'est jouer**. Chaque cran de mécanisme joue la note
 * suivante de la gamme du chapitre, en montant ; tourner à l'envers la
 * redescend. Ce fichier porte cette arithmétique — sans Tone.js, donc sans
 * AudioContext : testable dans Vitest, consommable avant le premier geste.
 *
 * Accordages par chapitre (docs/AUDIO.md § 3) : trois cordes, un mode
 * (dorien ou éolien), une fondamentale. Ch. 5 déroge sur la troisième corde
 * (F4 au lieu de D4) : le Pardon sonne faux à dessein.
 */

export type ChapterMode = 'dorian' | 'aeolian';

export interface ChapterTuning {
  /** Numéro de chapitre (0 = prologue, 7 = épilogue). */
  readonly chapter: number;
  readonly mode: ChapterMode;
  /** Fondamentale, notation scientifique (« D3 »). */
  readonly root: string;
  /** Les trois cordes du pondar, de la plus grave à la plus aiguë. */
  readonly strings: readonly [string, string, string];
  /** Midis précalculés des trois cordes. */
  readonly stringMidis: readonly [number, number, number];
  /** Midi de la fondamentale. */
  readonly rootMidi: number;
}

const NOTE_OFFSETS: Readonly<Record<string, number>> = {
  C: 0,
  D: 2,
  E: 4,
  F: 5,
  G: 7,
  A: 9,
  B: 11,
};

/** « D3 » → 50. Retourne NaN sur une note inconnue (défaut du niveau). */
export function parseNote(note: string): number {
  const match = /^([A-G])(#|b)?(-?\d)$/.exec(note.trim());
  if (match === null) return Number.NaN;
  const letter = NOTE_OFFSETS[match[1] ?? ''];
  if (letter === undefined) return Number.NaN;
  const accidental = match[2] === '#' ? 1 : match[2] === 'b' ? -1 : 0;
  const octave = Number.parseInt(match[3] ?? '0', 10);
  return 12 * (octave + 1) + letter + accidental;
}

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;

/** 50 → « D3 ». */
export function midiToNoteName(midi: number): string {
  const rounded = Math.round(midi);
  const name = NOTE_NAMES[((rounded % 12) + 12) % 12];
  const octave = Math.floor(rounded / 12) - 1;
  return `${name}${octave}`;
}

/** Fréquence en Hz d'un midi (la 440 = midi 69). */
export function midiToFrequency(midi: number): number {
  return 440 * 2 ** ((midi - 69) / 12);
}

/** Applique un écart en cents à une fréquence. */
export function frequencyWithCents(frequency: number, cents: number): number {
  return frequency * 2 ** (cents / 1200);
}

export const MODE_SEMITONES: Readonly<Record<ChapterMode, readonly number[]>> = {
  dorian: [0, 2, 3, 5, 7, 9, 10],
  aeolian: [0, 2, 3, 5, 7, 8, 10],
};

/** Les degrés du mode sur `octaveSpan` octaves, midis croissants. */
export function scaleMidis(rootMidi: number, mode: ChapterMode, octaveSpan = 2): number[] {
  const degrees = MODE_SEMITONES[mode];
  const notes: number[] = [];
  for (let octave = 0; octave < octaveSpan; octave += 1) {
    for (const degree of degrees) {
      notes.push(rootMidi + octave * 12 + degree);
    }
  }
  notes.push(rootMidi + octaveSpan * 12);
  return notes;
}

function tuning(
  chapter: number,
  mode: ChapterMode,
  root: string,
  strings: readonly [string, string, string],
): ChapterTuning {
  const rootMidi = parseNote(root);
  return {
    chapter,
    mode,
    root,
    strings,
    stringMidis: [parseNote(strings[0]), parseNote(strings[1]), parseNote(strings[2])],
    rootMidi,
  };
}

/**
 * Accordage par chapitre — table making authority : docs/AUDIO.md § 3.
 * Le chapitre 7 revient à l'accord du prologue : c'est le « chant revenu ».
 */
export const CHAPTER_TUNINGS: readonly ChapterTuning[] = [
  tuning(0, 'dorian', 'D3', ['D3', 'A3', 'D4']),
  tuning(1, 'dorian', 'G3', ['G3', 'D4', 'G4']),
  tuning(2, 'aeolian', 'A2', ['A2', 'E3', 'A3']),
  tuning(3, 'dorian', 'C3', ['C3', 'G3', 'C4']),
  tuning(4, 'aeolian', 'E2', ['E2', 'B2', 'E3']),
  tuning(5, 'aeolian', 'D3', ['D3', 'A3', 'F4']),
  tuning(6, 'dorian', 'A3', ['A3', 'E4', 'A4']),
  tuning(7, 'dorian', 'D3', ['D3', 'A3', 'D4']),
];

export function tuningForChapter(chapter: number): ChapterTuning {
  const clamped = Math.min(Math.max(chapter, 0), CHAPTER_TUNINGS.length - 1);
  const fallback = CHAPTER_TUNINGS[0];
  if (fallback === undefined) throw new Error('CHAPTER_TUNINGS est vide');
  return CHAPTER_TUNINGS[clamped] ?? fallback;
}

/**
 * Curseur le long de la gamme : chaque cran de mécanisme avance (`step(1)`)
 * ou recule (`step(-1)`) d'un degré. Borné aux extrémités — monter au-delà de
 * la dernière note reste sur elle : la pierre a atteint son sommet.
 */
export class ScaleCursor {
  private index: number;

  constructor(
    private readonly notes: readonly number[],
    initialIndex = 0,
  ) {
    this.index = this.clamp(initialIndex);
  }

  get midi(): number {
    return this.notes[this.index] ?? this.notes[0] ?? 60;
  }

  get position(): number {
    return this.index;
  }

  /** Avance ou recule ; retourne la note jouée (inchangée en butée). */
  step(delta: number): number {
    if (delta !== 0) this.index = this.clamp(this.index + Math.sign(delta) * Math.abs(delta));
    return this.midi;
  }

  reset(index = 0): void {
    this.index = this.clamp(index);
  }

  private clamp(index: number): number {
    const max = Math.max(0, this.notes.length - 1);
    return Math.min(Math.max(Math.round(index), 0), max);
  }
}

/** Inharmonicité légère : ±4 cents, jamais deux fois pareil. */
export function randomDetuneCents(rng: () => number = Math.random, maxCents = 4): number {
  return (rng() * 2 - 1) * maxCents;
}

/**
 * Sens de rotation entre deux crans, en tenant compte du bouclage du cycle
 * (un rotateur à 4 crans qui passe de 3 à 0 a tourné d'**un** cran vers le
 * haut, pas de trois vers le bas).
 */
export function notchDelta(previous: number, next: number, steps?: number): number {
  if (steps !== undefined && steps > 1) {
    const forward = (((next - previous) % steps) + steps) % steps;
    return forward > steps / 2 ? forward - steps : forward;
  }
  return next - previous;
}
