/**
 * MusicSystem.ts — musique adaptative, générée plutôt que jouée.
 *
 * Quatre couches qui s'ajoutent à mesure que le joueur progresse
 * (docs/AUDIO.md § 4) et ne se retirent jamais en cours de chapitre :
 *   0 `drone`  : bourdon de quinte, présent du premier au dernier instant ;
 *   1 `pondar` : la corde pincée, dès la première manipulation ;
 *   2 `doul`   : percussion douce à la main, à mi-résolution (~48 BPM) ;
 *   3 `melody` : la mélodie, quand le chemin final se referme.
 * À l'épilogue, les quatre sont là dès l'entrée : c'est le « chant revenu ».
 *
 * Les couches continues s'installent par un fondu de 6 s (4 à 8 s admis) ;
 * la couche pondar, faite de notes discrètes, s'installe en laissant la
 * musique respirer : sa première phrase n'arrive qu'après le fondu. On
 * n'entend jamais une couche apparaître — on s'aperçoit qu'elle est là.
 *
 * Aucune couche ne joue pendant une bascule de gravité : `muffle()` filtre
 * tout pendant 500 ms, le vertige a besoin de place.
 */
import * as Tone from 'tone';
import { AUDIO } from '@/config';
import { midiToFrequency, midiToNoteName, scaleMidis, type ChapterTuning } from './ChapterScale';
import {
  generateDoulPattern,
  generateMelodyPhrase,
  generatePondarMotif,
  nextMelodyPhraseDelay,
  nextPondarPhraseDelay,
} from './motif';
import type { PondarSynth } from './PondarSynth';

export type MusicLayer = 'drone' | 'pondar' | 'doul' | 'melody';

/** Ordre d'empilement : une couche n'apparaît jamais avant la précédente. */
export const MUSIC_LAYERS: readonly MusicLayer[] = ['drone', 'pondar', 'doul', 'melody'];

/** Gain de chaque couche une fois installée (dB, relatif au bus musique). */
export const MUSIC_LAYER_GAIN_DB: Readonly<Record<MusicLayer, number>> = {
  drone: -12,
  pondar: -9,
  doul: -15,
  melody: -10,
};

const DRY_FILTER_HZ = 18000;
const MUFFLED_FILTER_HZ = 320;

interface DroneNodes {
  readonly root: Tone.Oscillator;
  readonly fifth: Tone.Oscillator;
  readonly filter: Tone.Filter;
  readonly lfo: Tone.LFO;
  readonly volume: Tone.Volume;
}

export class MusicSystem {
  private destination: Tone.ToneAudioNode | null = null;
  private muffleFilter: Tone.Filter | null = null;
  private drone: DroneNodes | null = null;
  private doul: {
    readonly synth: Tone.MembraneSynth;
    readonly volume: Tone.Volume;
    readonly loop: Tone.Loop;
    readonly pattern: number[];
  } | null = null;
  private melody: {
    readonly synth: Tone.Synth<Tone.SynthOptions>;
    readonly volume: Tone.Volume;
  } | null = null;

  private readonly active = new Set<MusicLayer>();
  private activation = new Map<MusicLayer, number>();
  private tuning: ChapterTuning | null = null;
  private pondarEventId: number | null = null;
  private melodyEventId: number | null = null;
  private doulBeat = 0;

  constructor(private readonly pondar: PondarSynth) {}

  /** Construit le graphe (après le déverrouillage audio uniquement). */
  prepare(destination: Tone.ToneAudioNode): void {
    if (this.muffleFilter !== null) return;
    this.destination = destination;
    this.muffleFilter = new Tone.Filter(DRY_FILTER_HZ, 'lowpass');
    this.muffleFilter.connect(destination);
    // L'instrument est toujours audible sur le bus musique : la corde répond
    // au joueur même avant que la couche `pondar` ne s'installe.
    this.pondar.connect(destination);
    if (this.tuning !== null) this.applyTuning(this.tuning);
  }

  setTuning(tuning: ChapterTuning): void {
    this.tuning = tuning;
    if (this.muffleFilter !== null) this.applyTuning(tuning);
  }

  get activeLayers(): readonly MusicLayer[] {
    return MUSIC_LAYERS.filter((layer) => this.active.has(layer));
  }

  setLayer(layer: MusicLayer, enabled: boolean, fadeSeconds = AUDIO.layerFadeSeconds): void {
    if (enabled) this.activate(layer, fadeSeconds);
    // Une couche ne se retire jamais en cours de chapitre (docs/AUDIO.md § 4) :
    // la descente passe par `reset()`, au changement de niveau.
  }

  /**
   * Règle l'empilement d'un coup : `setProgress(2)` allume `drone` et
   * `pondar`. C'est l'API de la progression du niveau — elle ne connaît que
   * le nombre de couches méritées.
   */
  setProgress(layerCount: number, fadeSeconds = AUDIO.layerFadeSeconds): void {
    MUSIC_LAYERS.forEach((layer, index) => {
      if (index < layerCount) this.activate(layer, fadeSeconds);
    });
  }

  /** Changement de niveau : tout s'éteint en douceur, tout se réarme. */
  reset(fadeSeconds = 1.5): void {
    const drone = this.drone;
    const doul = this.doul;
    const melody = this.melody;
    this.drone = null;
    this.doul = null;
    this.melody = null;
    this.clearScheduledPhrases();
    this.active.clear();
    this.activation.clear();
    this.doulBeat = 0;

    const disposeAfterFade = (teardown: () => void): void => {
      safeSetTimeout(teardown, fadeSeconds * 1000 + 150);
    };

    if (drone !== null) {
      drone.volume.volume.rampTo(-Infinity, fadeSeconds);
      disposeAfterFade(() => {
        drone.root.stop();
        drone.fifth.stop();
        drone.lfo.stop();
        drone.root.dispose();
        drone.fifth.dispose();
        drone.filter.dispose();
        drone.lfo.dispose();
        drone.volume.dispose();
      });
    }
    if (doul !== null) {
      doul.volume.volume.rampTo(-Infinity, fadeSeconds);
      disposeAfterFade(() => {
        doul.loop.dispose();
        doul.synth.dispose();
        doul.volume.dispose();
      });
    }
    if (melody !== null) {
      melody.volume.volume.rampTo(-Infinity, fadeSeconds);
      disposeAfterFade(() => {
        melody.synth.dispose();
        melody.volume.dispose();
      });
    }
  }

  /** Bascule de gravité : 500 ms de filtrage, puis retour. */
  muffle(milliseconds = AUDIO.gravityMuffleMs): void {
    const filter = this.muffleFilter;
    if (filter === null) return;
    const now = Tone.now();
    const sweep = Math.max(0.06, milliseconds / 1000 / 3);
    filter.frequency.cancelScheduledValues(now);
    filter.frequency.setValueAtTime(filter.frequency.value, now);
    filter.frequency.rampTo(MUFFLED_FILTER_HZ, sweep);
    filter.frequency.rampTo(DRY_FILTER_HZ, sweep, now + milliseconds / 1000);
  }

  dispose(): void {
    this.clearScheduledPhrases();
    this.drone?.root.dispose();
    this.drone?.fifth.dispose();
    this.drone?.filter.dispose();
    this.drone?.lfo.dispose();
    this.drone?.volume.dispose();
    this.drone = null;
    this.doul?.synth.dispose();
    this.doul?.volume.dispose();
    this.doul?.loop.dispose();
    this.doul = null;
    this.melody?.synth.dispose();
    this.melody?.volume.dispose();
    this.melody = null;
    this.muffleFilter?.dispose();
    this.muffleFilter = null;
    this.destination = null;
    this.active.clear();
    this.activation.clear();
  }

  // ————————————————————————————————— Activation des couches

  private activate(layer: MusicLayer, fadeSeconds: number): void {
    if (this.active.has(layer) || this.muffleFilter === null || this.tuning === null) return;
    this.active.add(layer);
    this.activation.set(layer, Tone.now());

    switch (layer) {
      case 'drone':
        this.activateDrone(fadeSeconds);
        break;
      case 'pondar':
        // La couche pondar s'installe en laissant respirer : première phrase
        // après le fondu, les suivantes toutes les 8 à 14 s.
        this.schedulePondarPhrase(fadeSeconds + nextPondarPhraseDelay(Math.random));
        break;
      case 'doul':
        this.activateDoul(fadeSeconds);
        break;
      case 'melody':
        this.activateMelody(fadeSeconds);
        break;
    }
  }

  private activateDrone(fadeSeconds: number): void {
    if (this.drone !== null || this.muffleFilter === null || this.tuning === null) return;
    const rootFrequency = midiToFrequency(this.tuning.rootMidi);

    const filter = new Tone.Filter(420, 'lowpass');
    const volume = new Tone.Volume(-Infinity);
    const root = new Tone.Oscillator(rootFrequency, 'sine');
    const fifth = new Tone.Oscillator(rootFrequency * 1.5, 'triangle');
    fifth.detune.value = 3; // Bourdon légèrement battu, jamais statique.
    // Balayage très lent du filtre (docs/AUDIO.md § 4) : le bourdon respire.
    const lfo = new Tone.LFO(0.03, 180, 650);
    lfo.connect(filter.frequency);

    root.connect(filter);
    fifth.connect(filter);
    filter.connect(volume);
    volume.connect(this.muffleFilter);
    root.start();
    fifth.start();
    lfo.start();
    volume.volume.rampTo(MUSIC_LAYER_GAIN_DB.drone, fadeSeconds);
    this.drone = { root, fifth, filter, lfo, volume };
  }

  private activateDoul(fadeSeconds: number): void {
    if (this.doul !== null || this.muffleFilter === null) return;
    const synth = new Tone.MembraneSynth({
      pitchDecay: 0.045,
      octaves: 2,
      oscillator: { type: 'sine' },
      envelope: { attack: 0.008, decay: 0.42, sustain: 0, release: 0.9 },
    });
    const volume = new Tone.Volume(-Infinity);
    synth.chain(volume, this.muffleFilter);

    // ~48 BPM implicite : 1,25 s par temps, motif ternaire lâche.
    const pattern = [...generateDoulPattern(8, Math.random, 0)];
    const loop = new Tone.Loop((time) => {
      const startedAt = this.activation.get('doul') ?? 0;
      const intensity = Math.min(1, (Tone.now() - startedAt) / Math.max(fadeSeconds, 0.1));
      const velocity = pattern[this.doulBeat % pattern.length] ?? 0;
      this.doulBeat += 1;
      if (velocity <= 0 || intensity <= 0.15) return;
      synth.triggerAttackRelease('A1', 0.22, time, velocity * intensity);
    }, 1.25);
    loop.start(0);

    volume.volume.rampTo(MUSIC_LAYER_GAIN_DB.doul, fadeSeconds);
    this.doul = { synth, volume, loop, pattern };
  }

  private activateMelody(fadeSeconds: number): void {
    if (this.melody !== null || this.muffleFilter === null) return;
    const synth = new Tone.Synth({
      oscillator: { type: 'sine' },
      envelope: { attack: 1.1, decay: 0.4, sustain: 0.55, release: 3.2 },
      volume: -8,
    });
    const volume = new Tone.Volume(-Infinity);
    synth.chain(volume, this.muffleFilter);
    volume.volume.rampTo(MUSIC_LAYER_GAIN_DB.melody, fadeSeconds);
    this.melody = { synth, volume };

    this.scheduleMelodyPhrase(fadeSeconds + nextMelodyPhraseDelay(Math.random));
  }

  private schedulePondarPhrase(delaySeconds: number): void {
    if (this.destination === null) return;
    this.clearPondarPhrase();
    this.pondarEventId = Tone.getTransport().scheduleOnce(
      (time) => {
        this.playPondarPhrase(time);
        if (this.active.has('pondar')) {
          this.schedulePondarPhrase(nextPondarPhraseDelay(Math.random));
        }
      },
      `+${Math.max(0.1, delaySeconds)}`,
    );
  }

  private playPondarPhrase(time: number): void {
    if (this.tuning === null) return;
    const scale = scaleMidis(this.tuning.rootMidi, this.tuning.mode, 2);
    const motif = generatePondarMotif(scale, Math.random);
    for (const note of motif) {
      this.pondar.pluck(note.midi, { time: time + note.atSeconds });
    }
  }

  private scheduleMelodyPhrase(delaySeconds: number): void {
    if (this.destination === null) return;
    this.clearMelodyPhrase();
    this.melodyEventId = Tone.getTransport().scheduleOnce(
      (time) => {
        this.playMelodyPhrase(time);
        if (this.active.has('melody')) {
          this.scheduleMelodyPhrase(nextMelodyPhraseDelay(Math.random));
        }
      },
      `+${Math.max(0.1, delaySeconds)}`,
    );
  }

  private playMelodyPhrase(time: number): void {
    if (this.tuning === null || this.melody === null) return;
    const scale = scaleMidis(this.tuning.rootMidi, this.tuning.mode, 3);
    const phrase = generateMelodyPhrase(scale, Math.random);
    for (const note of phrase) {
      this.melody.synth.triggerAttackRelease(
        midiToNoteName(note.midi),
        1.4,
        time + note.atSeconds,
        note.gain,
      );
    }
  }

  private applyTuning(tuning: ChapterTuning): void {
    const drone = this.drone;
    if (drone === null) return;
    const rootFrequency = midiToFrequency(tuning.rootMidi);
    drone.root.frequency.rampTo(rootFrequency, 1.5);
    drone.fifth.frequency.rampTo(rootFrequency * 1.5, 1.5);
  }

  private clearScheduledPhrases(): void {
    this.clearPondarPhrase();
    this.clearMelodyPhrase();
  }

  private clearPondarPhrase(): void {
    if (this.pondarEventId === null) return;
    Tone.getTransport().clear(this.pondarEventId);
    this.pondarEventId = null;
  }

  private clearMelodyPhrase(): void {
    if (this.melodyEventId === null) return;
    Tone.getTransport().clear(this.melodyEventId);
    this.melodyEventId = null;
  }
}

/** `setTimeout` gardé — le code doit vivre hors navigateur (tests, worker). */
function safeSetTimeout(callback: () => void, milliseconds: number): void {
  if (typeof setTimeout !== 'function') {
    callback();
    return;
  }
  setTimeout(callback, milliseconds);
}
