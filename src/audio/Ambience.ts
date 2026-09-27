/**
 * Ambience.ts — le paysage sonore du Caucase.
 *
 * Couches synthétisées (docs/AUDIO.md § 2) : vent de crête, torrent, cloches
 * de bétail lointaines, cri d'aigle, crépitement de feu, respiration de
 * pierre. Les modulations tournent à des **périodes premières entre elles**
 * (7, 11, 13, 17, 23 s) : aucune super-période, le vent peut souffler vingt
 * minutes sans qu'on repère un motif.
 *
 * Le graphe Tone n'existe pas avant `prepare()` : ce fichier doit pouvoir
 * s'importer sans AudioContext (tests Node, worker, avant le premier geste).
 */
import * as Tone from 'tone';
import {
  ambienceLayerGainDb,
  nextEventDelay,
  PRIME_PERIODS,
  type AmbienceLayerName,
} from './ambiencePlan';

/**
 * Tout nœud Tone utilisé par une couche : Loop n'est pas un ToneAudioNode,
 * seul `dispose()` nous intéresse pour la libération.
 */
export interface DisposableToneNode {
  dispose(): void;
}

interface LayerGraph {
  readonly gain: Tone.Volume;
  /** Nœuds à libérer à la disposition (bruits, oscillateurs, boucles). */
  readonly owned: readonly DisposableToneNode[];
  /** Identifiants de planification Transport à annuler. */
  readonly eventIds: number[];
}

const FADE_SECONDS = 4;

export class Ambience {
  private destination: Tone.ToneAudioNode | null = null;
  private readonly layers = new Map<AmbienceLayerName, LayerGraph>();
  private chapter = 0;

  /** Construit le bus d'ambiance (après le déverrouillage audio uniquement). */
  prepare(destination: Tone.ToneAudioNode): void {
    this.destination ??= destination;
  }

  /** Le chapitre courant influe sur les gains (vent d'altitude au ch. 6). */
  setChapter(chapter: number): void {
    this.chapter = chapter;
  }

  /**
   * Applique le plan du lieu : allume les couches demandées, éteint les
   * autres, tout en fondus de 4 s (docs/AUDIO.md § 2).
   */
  applyPlan(layers: readonly AmbienceLayerName[]): void {
    if (this.destination === null) return;
    const wanted = new Set<AmbienceLayerName>(layers);

    for (const [name, graph] of this.layers) {
      if (wanted.has(name)) continue;
      graph.gain.volume.rampTo(-Infinity, FADE_SECONDS);
      this.cancelEvents(graph);
    }

    for (const name of wanted) {
      let graph = this.layers.get(name);
      if (graph === undefined) {
        graph = this.buildLayer(name);
        this.layers.set(name, graph);
      }
      graph.gain.volume.rampTo(ambienceLayerGainDb(name, this.chapter), FADE_SECONDS);
      if ((name === 'bells' || name === 'eagle') && graph.eventIds.length === 0) {
        this.scheduleEvent(name, graph);
      }
    }
  }

  dispose(): void {
    for (const graph of this.layers.values()) {
      this.cancelEvents(graph);
      graph.gain.dispose();
      for (const node of graph.owned) node.dispose();
    }
    this.layers.clear();
    this.destination = null;
  }

  // ————————————————————————————————— Construction des couches

  private buildLayer(name: AmbienceLayerName): LayerGraph {
    const destination = this.destination;
    if (destination === null) throw new Error('Ambience : destination absente');
    const gain = new Tone.Volume(-Infinity);
    gain.connect(destination);
    const owned: DisposableToneNode[] = [];

    switch (name) {
      case 'wind': {
        // Bruit rose → passe-bande balayé lentement (LFO ~0,03 Hz, 200-900 Hz).
        const noise = new Tone.Noise('pink');
        const filter = new Tone.Filter(520, 'bandpass');
        filter.Q.value = 1.1;
        const lfo = new Tone.LFO(0.03, 200, 900);
        lfo.connect(filter.frequency);
        noise.chain(filter, gain);
        noise.start();
        lfo.start();
        owned.push(noise, filter, lfo);
        break;
      }
      case 'river': {
        // Bruit blanc → passe-haut 700 Hz + résonance légère, scintillement
        // lent à période première 11 s.
        const noise = new Tone.Noise('white');
        const highpass = new Tone.Filter(700, 'highpass');
        const resonance = new Tone.Filter(1400, 'peaking');
        resonance.Q.value = 3;
        const shimmer = new Tone.LFO(1 / PRIME_PERIODS.river, -4, 4);
        shimmer.connect(resonance.gain);
        noise.chain(highpass, resonance, gain);
        noise.start();
        shimmer.start();
        owned.push(noise, highpass, resonance, shimmer);
        break;
      }
      case 'bells': {
        // Cloche lointaine, très réverbérée de fait (tout le bus ambiance
        // passe par la réverbération « vallée ») — Sol/Si/Ré au déclenchement.
        const bell = new Tone.MetalSynth({
          envelope: { attack: 0.001, decay: 2.6, release: 2.2 },
          harmonicity: 3.1,
          modulationIndex: 14,
          resonance: 2600,
          octaves: 0.4,
        });
        bell.connect(gain);
        owned.push(bell);
        break;
      }
      case 'eagle': {
        // Cri d'aigle : FM descendante, un glissando qui s'éloigne.
        const eagle = new Tone.FMSynth({
          harmonicity: 2.02,
          modulationIndex: 6,
          oscillator: { type: 'sine' },
          envelope: { attack: 0.12, decay: 0.5, sustain: 0.25, release: 1.4 },
          modulation: { type: 'sine' },
          modulationEnvelope: { attack: 0.2, decay: 0.3, sustain: 0.4, release: 1.1 },
        });
        eagle.connect(gain);
        owned.push(eagle);
        break;
      }
      case 'fire': {
        // Crépitement : impulsions de bruit brun très courtes, densité ~8/s.
        const crackle = new Tone.NoiseSynth({
          noise: { type: 'brown' },
          envelope: { attack: 0.002, decay: 0.045, sustain: 0 },
          volume: -6,
        });
        const tone = new Tone.Filter(1600, 'bandpass');
        tone.Q.value = 0.9;
        crackle.chain(tone, gain);
        const loop = new Tone.Loop((time) => {
          if (Math.random() < 0.62) crackle.triggerAttackRelease(0.03, time);
        }, 0.125);
        loop.start(0);
        owned.push(crackle, tone, loop);
        break;
      }
      case 'stone': {
        // Respiration du lieu : bourdon sub 40 Hz modulé très lentement.
        const drone = new Tone.Oscillator(40, 'sine');
        const swell = new Tone.LFO(1 / PRIME_PERIODS.stone, -30, -12);
        swell.connect(gain.volume);
        drone.connect(gain);
        drone.start();
        swell.start();
        owned.push(drone, swell);
        break;
      }
    }

    return { gain, owned, eventIds: [] };
  }

  /** Événements rares et aléatoires : cloches 12–30 s, aigle 45–120 s. */
  private scheduleEvent(name: 'bells' | 'eagle', graph: LayerGraph): void {
    if (this.destination === null) return;
    const delay = nextEventDelay(name, Math.random);
    const eventId = Tone.getTransport().scheduleOnce(
      (time) => {
        this.playEvent(name, graph, time);
        const current = this.layers.get(name);
        if (current !== undefined && current === graph) this.scheduleEvent(name, graph);
      },
      `+${Math.max(0.5, delay)}`,
    );
    graph.eventIds.push(eventId);
  }

  private playEvent(name: 'bells' | 'eagle', graph: LayerGraph, time: number): void {
    if (name === 'bells') {
      const bell = graph.owned.find(
        (node): node is Tone.MetalSynth => node instanceof Tone.MetalSynth,
      );
      bell?.triggerAttackRelease(
        Math.random() < 0.5 ? 'G4' : Math.random() < 0.5 ? 'B4' : 'D5',
        0.02,
        time,
        0.18 + Math.random() * 0.14,
      );
      return;
    }
    const eagle = graph.owned[0] as Tone.FMSynth | undefined;
    if (eagle === undefined) return;
    // Glissando descendant : le cri part de l'aigle et tombe vers la vallée.
    const from = 1244 + Math.random() * 220; // ~D#6, jamais deux fois pareil
    const to = from * 0.55;
    eagle.triggerAttack(from, time);
    eagle.frequency.exponentialRampToValueAtTime(to, time + 1.15);
    eagle.triggerRelease(time + 1.2);
  }

  private cancelEvents(graph: LayerGraph): void {
    for (const id of graph.eventIds) Tone.getTransport().clear(id);
    graph.eventIds.length = 0;
  }
}
