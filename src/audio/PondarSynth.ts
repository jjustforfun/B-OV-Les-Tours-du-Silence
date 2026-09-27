/**
 * PondarSynth.ts — évocation du dechig-pondar. [À VÉRIFIER : dechig-pondar,
 * luth tchétchène à trois cordes, orthographe et description à confirmer
 * auprès d'une source tchétchène — voir docs/CULTURE.md]
 *
 * Trois cordes de Karplus-Strong (`Tone.PluckSynth` : excitation bruitée +
 * ligne à retard amortie — le modèle physique exact d'une corde pincée).
 * Chacune a son amortissement propre : la plus grave sonne 2,4 s, la médiane
 * 1,7 s, la plus aiguë 1,1 s. À chaque pincement, ±4 cents d'inharmonicité :
 * sans ce léger désaccord, la corde sonnerait numérique (docs/AUDIO.md § 3).
 *
 * Précaution de respect : on ne reproduit aucune mélodie traditionnelle
 * existante. On emprunte une couleur, pas un répertoire.
 *
 * Le graphe Tone n'existe pas avant `connect()` : ce fichier doit pouvoir
 * s'importer (et s'instancier) sans AudioContext — tests Node, worker.
 */
import * as Tone from 'tone';
import { AUDIO } from '@/config';
import {
  frequencyWithCents,
  midiToFrequency,
  randomDetuneCents,
  type ChapterTuning,
} from './ChapterScale';

/** Amortissement et brillance par corde, de la plus grave à la plus aiguë. */
const STRINGS: readonly { readonly release: number; readonly brightness: number }[] = [
  { release: 2.4, brightness: 0.8 },
  { release: 1.7, brightness: 1.0 },
  { release: 1.1, brightness: 1.35 },
];

export class PondarSynth {
  private synths: Tone.PluckSynth[] | null = null;
  private output: Tone.Gain | null = null;
  private destination: Tone.ToneAudioNode | null = null;
  private tuning: ChapterTuning | null = null;

  /** Branche l'instrument sur le bus musique. Idempotent. */
  connect(destination: Tone.ToneAudioNode): void {
    if (this.output !== null) return;
    this.destination = destination;
    this.build();
  }

  /** Réaccorde les trois cordes (changement de chapitre). */
  setTuning(tuning: ChapterTuning): void {
    this.tuning = tuning;
  }

  get currentTuning(): ChapterTuning | null {
    return this.tuning;
  }

  /**
   * Pince une corde. `stringIndex` choisit la corde (0 grave, 1 médiane,
   * 2 aiguë) ; par défaut celle qui porte le plus juste la note.
   */
  pluck(midi: number, options: { stringIndex?: number; cents?: number; time?: number } = {}): void {
    if (this.synths === null || this.tuning === null) return;
    const index = options.stringIndex ?? this.stringFor(midi);
    const synth = this.synths[Math.min(Math.max(index, 0), this.synths.length - 1)];
    if (synth === undefined) return;

    const cents = options.cents ?? randomDetuneCents(Math.random, AUDIO.pondarDetuneCents);
    const frequency = frequencyWithCents(midiToFrequency(midi), cents);
    synth.triggerAttack(frequency, options.time);
  }

  /**
   * Accord de connexion (docs/AUDIO.md § 5) : fondamentale, quarte, quinte,
   * ascendantes, 140 ms d'écart — le son de la récompense.
   */
  playConnectionChord(time?: number): void {
    if (this.tuning === null) return;
    const root = this.tuning.rootMidi;
    const base = time ?? this.now();
    const notes = [root, root + 5, root + 7];
    notes.forEach((midi, index) => {
      this.pluck(midi, {
        stringIndex: Math.min(index, 2),
        time: base + index * 0.14,
        cents: randomDetuneCents(Math.random, AUDIO.pondarDetuneCents),
      });
    });
  }

  /**
   * Signature de fin de chapitre : cinq notes sur les trois cordes — la
   * « voix » du lieu. Le proverbe qui suit (2 s de silence, puis une note
   * très longue) est joué par SfxBank.proverb().
   */
  playChapterSignature(time?: number): void {
    if (this.tuning === null) return;
    const root = this.tuning.rootMidi;
    const base = time ?? this.now();
    // Fondamentale, quinte, octave, tierce mineure sur l'octave, douzième :
    // une montée de quartes et de quintes, jamais un arpège mécanique.
    const phrase: readonly { midi: number; at: number; string: number }[] = [
      { midi: root, at: 0, string: 0 },
      { midi: root + 7, at: 0.45, string: 1 },
      { midi: root + 12, at: 0.95, string: 2 },
      { midi: root + 15, at: 1.55, string: 1 },
      { midi: root + 19, at: 2.05, string: 2 },
    ];
    for (const note of phrase) {
      this.pluck(note.midi, {
        stringIndex: note.string,
        time: base + note.at,
        cents: randomDetuneCents(Math.random, AUDIO.pondarDetuneCents),
      });
    }
  }

  dispose(): void {
    for (const synth of this.synths ?? []) synth.dispose();
    this.synths = null;
    this.output?.dispose();
    this.output = null;
    this.destination = null;
    this.tuning = null;
  }

  /** La corde dont la note est la plus proche — plus juste, moins de transposition. */
  private stringFor(midi: number): number {
    const strings = this.tuning?.stringMidis;
    if (strings === undefined) return 1;
    let best = 0;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (let i = 0; i < strings.length; i += 1) {
      const distance = Math.abs((strings[i] ?? 60) - midi);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = i;
      }
    }
    return best;
  }

  private build(): void {
    const destination = this.destination;
    if (destination === null) return;
    const output = new Tone.Gain(1);
    this.output = output;
    this.synths = STRINGS.map(({ release, brightness }) => {
      const synth = new Tone.PluckSynth({
        attackNoise: 1.4,
        dampening: 1800 * brightness,
        resonance: 0.92,
        release,
      });
      synth.connect(output);
      return synth;
    });
    output.connect(destination);
  }

  private now(): number {
    return Tone.now();
  }
}
