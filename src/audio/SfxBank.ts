/**
 * SfxBank.ts — effets sonores, tous synthétisés (docs/AUDIO.md § 5).
 *
 * Aucun fichier audio : bruit filtré pour la pierre, sinus courts pour l'UI,
 * membrane pour la dalle. Chaque son varie aléatoirement de ±2 demi-tons et
 * de ±1,5 dB à chaque déclenchement — la fatigue d'écoute n'a pas le temps
 * de s'installer.
 *
 * Timbres des pas par surface (`NavNode.surface`) : pierre, herbe, neige,
 * bois. Le pondar, lui, vit dans `PondarSynth` — la corde est un instrument,
 * pas un effet.
 *
 * Graphe construit uniquement à `prepare()` : importable sans AudioContext.
 */
import * as Tone from 'tone';
import { AUDIO } from '@/config';
import type { NavSurface } from '@world/NavGraph';

/** Détail de timbre d'une surface. */
interface StepTimbre {
  readonly noise: 'brown' | 'pink' | 'white';
  readonly filterType: BiquadFilterType;
  readonly filterHz: number;
  readonly filterQ: number;
  readonly duration: number;
  readonly attack: number;
}

const STEP_TIMBRES: Readonly<Record<NavSurface, StepTimbre>> = {
  stone: {
    noise: 'brown',
    filterType: 'lowpass',
    filterHz: 900,
    filterQ: 0.8,
    duration: 0.09,
    attack: 0.004,
  },
  grass: {
    noise: 'pink',
    filterType: 'highpass',
    filterHz: 1200,
    filterQ: 0.7,
    duration: 0.07,
    attack: 0.006,
  },
  snow: {
    noise: 'white',
    filterType: 'lowpass',
    filterHz: 2400,
    filterQ: 0.5,
    duration: 0.14,
    attack: 0.03,
  },
  wood: {
    noise: 'brown',
    filterType: 'bandpass',
    filterHz: 220,
    filterQ: 6,
    duration: 0.08,
    attack: 0.003,
  },
};

const UI_PITCHES = [1320, 1480, 1660, 1760, 1980];

export class SfxBank {
  private destination: Tone.ToneAudioNode | null = null;
  private readonly stepSynths = new Map<
    NavSurface,
    { synth: Tone.NoiseSynth; filter: Tone.Filter }
  >();
  private rotationChain: { noise: Tone.Noise; filter: Tone.Filter; gain: Tone.Gain } | null = null;
  private slideChain: { noise: Tone.Noise; filter: Tone.Filter; gain: Tone.Gain } | null = null;
  private lockSynth: Tone.Synth<Tone.SynthOptions> | null = null;
  private plateSynth: Tone.MembraneSynth | null = null;
  private plateHeld: { osc: Tone.Oscillator; fifth: Tone.Oscillator; gain: Tone.Gain } | null =
    null;
  private uiSynth: Tone.Synth<Tone.SynthOptions> | null = null;
  private childLaughSynth: Tone.NoiseSynth | null = null;
  private childLaughFilter: Tone.Filter | null = null;
  private proverbSynth: Tone.Synth<Tone.SynthOptions> | null = null;
  private proverbNote = 62;
  private lastUiPitchIndex = -1;

  /** Construit le bus sfx (après le déverrouillage audio uniquement). */
  prepare(destination: Tone.ToneAudioNode): void {
    if (this.destination !== null) return;
    this.destination = destination;
  }

  /** Note longue du proverbe : la fondamentale du chapitre, à l'octave. */
  setChapterRoot(midi: number): void {
    this.proverbNote = midi + 12;
  }

  /** Un pas : timbre par surface, variation ±2 demi-tons et ±1,5 dB. */
  step(surface: NavSurface, time?: number): void {
    const entry = this.stepSynths.get(surface) ?? this.buildStepSynth(surface);
    if (entry === null) return;
    const variation = semitoneVariation();
    entry.filter.frequency.value = STEP_TIMBRES[surface].filterHz * variation;
    const gain = 0.5 * gainVariation();
    entry.synth.triggerAttackRelease(STEP_TIMBRES[surface].duration, time, gain);
  }

  /** Craquement de rotation : continu tant qu'on manipule, ∝ vitesse. */
  rotation(active: boolean): void {
    if (active) {
      this.ensureRotationChain();
      this.rotationChain?.noise.start();
    } else {
      this.rotationChain?.gain.gain.rampTo(0, 0.08);
      this.rotationChain?.noise.stop('+0.1');
    }
  }

  rotationSpeed(speed: number): void {
    const chain = this.rotationChain;
    if (chain === null) return;
    const normalized = Math.min(1, Math.max(0, speed));
    chain.gain.gain.rampTo(0.24 * normalized + 0.015, 0.05);
    chain.filter.frequency.rampTo(280 + 900 * normalized, 0.08);
  }

  /** Glissement de slider : grave, coupe net à l'aimantation. */
  slide(active: boolean): void {
    if (active) {
      this.ensureSlideChain();
      this.slideChain?.noise.start();
    } else {
      // Coupe nette (docs/AUDIO.md § 5) : pas de réverbération de queue.
      const chain = this.slideChain;
      if (chain !== null) {
        chain.gain.gain.cancelScheduledValues(Tone.now());
        chain.gain.gain.value = 0;
        chain.noise.stop('+0.02');
      }
    }
  }

  slideSpeed(speed: number): void {
    const chain = this.slideChain;
    if (chain === null) return;
    const normalized = Math.min(1, Math.max(0, speed));
    chain.gain.gain.rampTo(0.3 * normalized, 0.06);
    chain.filter.frequency.rampTo(120 + 380 * normalized, 0.08);
  }

  /** Emboîtement : signature unique de tout ce qui se verrouille. */
  stoneLock(time?: number): void {
    this.ensureLockSynth();
    this.lockSynth?.triggerAttackRelease(
      320 * semitoneVariation(),
      0.05,
      time,
      0.5 * gainVariation(),
    );
  }

  /** Dalle : « toc » grave à l'enfoncement, remontée plus claire. */
  plate(down: boolean, time?: number): void {
    this.ensurePlateSynth();
    if (down) {
      this.plateSynth?.triggerAttackRelease(72, 0.22, time, 0.55);
      this.startPlateHeld();
    } else {
      this.plateSynth?.triggerAttackRelease(110, 0.14, time, 0.3);
      this.stopPlateHeld();
    }
  }

  /** UI : impulsion sinusoïdale de 12 ms, jamais deux fois la même hauteur. */
  uiTap(time?: number): void {
    this.ensureUiSynth();
    if (this.uiSynth === null) return;
    let index = Math.floor(Math.random() * UI_PITCHES.length);
    if (index === this.lastUiPitchIndex) index = (index + 1) % UI_PITCHES.length;
    this.lastUiPitchIndex = index;
    const pitch = UI_PITCHES[index] ?? 1320;
    this.uiSynth.triggerAttackRelease(pitch, 0.012, time, 0.16 * gainVariation());
  }

  /** Rire bref et stylisé : trois souffles clairs, jamais une voix enregistrée. */
  childLaugh(time = Tone.now()): void {
    this.ensureChildLaughSynth();
    if (this.childLaughSynth === null || this.childLaughFilter === null) return;
    for (const [index, offset] of [0, 0.13, 0.29].entries()) {
      this.childLaughFilter.frequency.setValueAtTime(1050 + index * 180, time + offset);
      this.childLaughSynth.triggerAttackRelease(0.075 + index * 0.012, time + offset, 0.13);
    }
  }

  /**
   * Proverbe : une seule note, très longue, très réverbérée — le texte
   * respire autour d'elle.
   */
  proverb(time?: number): void {
    this.ensureProverbSynth();
    this.proverbSynth?.triggerAttackRelease(
      Tone.Frequency(this.proverbNote, 'midi').toFrequency(),
      3.2,
      time,
      0.22,
    );
  }

  dispose(): void {
    for (const { synth, filter } of this.stepSynths.values()) {
      synth.dispose();
      filter.dispose();
    }
    this.stepSynths.clear();
    this.rotationChain?.noise.dispose();
    this.rotationChain?.filter.dispose();
    this.rotationChain?.gain.dispose();
    this.rotationChain = null;
    this.slideChain?.noise.dispose();
    this.slideChain?.filter.dispose();
    this.slideChain?.gain.dispose();
    this.slideChain = null;
    this.lockSynth?.dispose();
    this.lockSynth = null;
    this.plateSynth?.dispose();
    this.plateSynth = null;
    this.stopPlateHeld();
    this.uiSynth?.dispose();
    this.uiSynth = null;
    this.childLaughSynth?.dispose();
    this.childLaughSynth = null;
    this.childLaughFilter?.dispose();
    this.childLaughFilter = null;
    this.proverbSynth?.dispose();
    this.proverbSynth = null;
    this.destination = null;
  }

  // ————————————————————————————————— Construction paresseuse

  private buildStepSynth(
    surface: NavSurface,
  ): { synth: Tone.NoiseSynth; filter: Tone.Filter } | null {
    if (this.destination === null) return null;
    const timbre = STEP_TIMBRES[surface];
    const synth = new Tone.NoiseSynth({
      noise: { type: timbre.noise },
      envelope: { attack: timbre.attack, decay: timbre.duration, sustain: 0 },
    });
    const filter = new Tone.Filter(timbre.filterHz, timbre.filterType);
    filter.Q.value = timbre.filterQ;
    synth.chain(filter, this.destination);
    this.stepSynths.set(surface, { synth, filter });
    return { synth, filter };
  }

  private ensureRotationChain(): void {
    if (this.rotationChain !== null || this.destination === null) return;
    const noise = new Tone.Noise('brown');
    const filter = new Tone.Filter(320, 'bandpass');
    filter.Q.value = 1.4;
    const gain = new Tone.Gain(0);
    noise.chain(filter, gain, this.destination);
    this.rotationChain = { noise, filter, gain };
  }

  private ensureSlideChain(): void {
    if (this.slideChain !== null || this.destination === null) return;
    const noise = new Tone.Noise('brown');
    const filter = new Tone.Filter(140, 'lowpass');
    const gain = new Tone.Gain(0);
    noise.chain(filter, gain, this.destination);
    this.slideChain = { noise, filter, gain };
  }

  private ensureLockSynth(): void {
    if (this.lockSynth !== null || this.destination === null) return;
    const synth = new Tone.Synth({
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.001, decay: 0.07, sustain: 0, release: 0.04 },
    });
    const resonance = new Tone.Filter(320, 'bandpass');
    resonance.Q.value = 11;
    synth.chain(resonance, this.destination);
    this.lockSynth = synth;
  }

  private ensurePlateSynth(): void {
    if (this.plateSynth !== null || this.destination === null) return;
    this.plateSynth = new Tone.MembraneSynth({
      pitchDecay: 0.09,
      octaves: 2,
      envelope: { attack: 0.001, decay: 0.5, sustain: 0 },
    });
    this.plateSynth.connect(this.destination);
  }

  /** Quinte tenue tant que la dalle verrouillante est enfoncée (−22 dB). */
  private startPlateHeld(): void {
    if (this.plateHeld !== null || this.destination === null) return;
    const osc = new Tone.Oscillator(146.8, 'sine'); // D3
    const fifth = new Tone.Oscillator(220, 'sine'); // A3
    const gain = new Tone.Gain(0);
    gain.gain.rampTo(0.078, 0.25); // −22 dB
    osc.connect(gain);
    fifth.connect(gain);
    gain.connect(this.destination);
    osc.start();
    fifth.start();
    this.plateHeld = { osc, fifth, gain };
  }

  private stopPlateHeld(): void {
    const held = this.plateHeld;
    if (held === null) return;
    this.plateHeld = null;
    held.gain.gain.rampTo(0, 0.3);
    const stopAt = Tone.now() + 0.32;
    held.osc.stop(stopAt);
    held.fifth.stop(stopAt);
    held.osc.dispose();
    held.fifth.dispose();
    held.gain.dispose();
  }

  private ensureUiSynth(): void {
    if (this.uiSynth !== null || this.destination === null) return;
    this.uiSynth = new Tone.Synth({
      oscillator: { type: 'sine' },
      envelope: { attack: 0.001, decay: 0.012, sustain: 0, release: 0.004 },
    });
    this.uiSynth.connect(this.destination);
  }

  private ensureChildLaughSynth(): void {
    if (this.childLaughSynth !== null || this.destination === null) return;
    const synth = new Tone.NoiseSynth({
      noise: { type: 'pink' },
      envelope: { attack: 0.008, decay: 0.055, sustain: 0, release: 0.02 },
    });
    const filter = new Tone.Filter(1050, 'bandpass');
    filter.Q.value = 5.5;
    synth.chain(filter, this.destination);
    this.childLaughSynth = synth;
    this.childLaughFilter = filter;
  }

  private ensureProverbSynth(): void {
    if (this.proverbSynth !== null || this.destination === null) return;
    this.proverbSynth = new Tone.Synth({
      oscillator: { type: 'sine' },
      envelope: { attack: 0.9, decay: 0.6, sustain: 0.5, release: 3.6 },
    });
    this.proverbSynth.connect(this.destination);
  }
}

/** Variation de hauteur : ±2 demi-tons (facteur multiplicatif). */
function semitoneVariation(): number {
  const semitones = (Math.random() * 2 - 1) * AUDIO.sfxVariation.semitones;
  return 2 ** (semitones / 12);
}

/** Variation de gain : ±1,5 dB (facteur multiplicatif). */
function gainVariation(): number {
  const decibels = (Math.random() * 2 - 1) * AUDIO.sfxVariation.gainDb;
  return 10 ** (decibels / 20);
}
