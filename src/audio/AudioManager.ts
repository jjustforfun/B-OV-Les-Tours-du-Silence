/**
 * AudioManager.ts — chef d'orchestre sonore.
 *
 * Contraintes navigateur : aucun son ne peut démarrer avant un geste du
 * joueur. Le graphe Tone n'est donc construit qu'à `start()` — la classe
 * s'importe et s'instancie sans AudioContext (tests Node, worker).
 *
 * Mixage (docs/AUDIO.md § 1, ADR-025) : chaque bus a un gain nominal
 * (musique −9 dB, ambiance −14 dB, sfx −6 dB) atteint quand son curseur est
 * à sa valeur par défaut ; le curseur atténue en décibels autour. Une seule
 * réverbération « vallée » (decay 9 s, wet 0,42) pour musique et ambiance ;
 * les sfx restent secs avec un faible envoi — un pas doit rester immédiat.
 *
 * Cycle de vie : fondu d'entrée de 1,2 s au premier geste, onglet caché →
 * silence en 250 ms et Transport en pause, fenêtre floue → −12 dB, touche M
 * → coupure en 120 ms persistée par AudioDirector.
 */
import * as Tone from 'tone';
import { platform } from '@platform/Platform';
import { AUDIO } from '@/config';
import { Ambience } from './Ambience';
import { MusicSystem } from './MusicSystem';
import { PondarSynth } from './PondarSynth';
import { SfxBank } from './SfxBank';
import {
  busGainDb,
  DEFAULT_VOLUMES,
  duckOffsetDb,
  masterGainDb,
  type AudioChannel,
} from './mixing';

export type { AudioChannel };
export { DEFAULT_VOLUMES };

export type AudioVolumes = Record<AudioChannel, number>;

interface BusGraph {
  readonly music: Tone.Volume;
  readonly ambience: Tone.Volume;
  readonly sfx: Tone.Volume;
  readonly sfxSend: Tone.Gain;
  readonly reverb: Tone.Reverb;
  readonly master: Tone.Gain;
}

export class AudioManager {
  private readonly pondarSynth = new PondarSynth();

  readonly music = new MusicSystem(this.pondarSynth);
  readonly pondar = this.pondarSynth;
  readonly sfx = new SfxBank();
  readonly ambience = new Ambience();

  private started = false;
  private graph: BusGraph | null = null;
  private volumes: AudioVolumes = { ...DEFAULT_VOLUMES };
  private ducked = false;
  private muted = false;
  private hidden = false;
  private blurred = false;
  private readonly unsubscribeLifecycle: (() => void)[] = [];

  get isStarted(): boolean {
    return this.started;
  }

  get isMuted(): boolean {
    return this.muted;
  }

  /** À appeler depuis un geste utilisateur (contrainte d'autoplay). */
  async start(): Promise<void> {
    if (this.started) return;
    await Tone.start();
    this.started = true;
    this.buildGraph();

    // Le silence d'ouverture ne se rompt que lentement (1,2 s).
    this.graph?.master.gain.rampTo(masterGainDb(this.volumes.master), AUDIO.unlockFadeInSeconds);
    Tone.getTransport().start();

    this.applyVolumes();
    this.watchLifecycle();
  }

  setVolume(channel: AudioChannel, value: number): void {
    this.volumes[channel] = Math.min(Math.max(value, 0), 1);
    this.applyVolumes();
  }

  getVolume(channel: AudioChannel): number {
    return this.volumes[channel];
  }

  get volumesSnapshot(): Readonly<AudioVolumes> {
    return { ...this.volumes };
  }

  /**
   * Ducking sous les textes (intro, proverbe) : musique −4 dB, ambiance
   * −3 dB, attaque 400 ms, relâche 1,2 s. Les sfx ne sont pas duckés.
   */
  duck(active: boolean): void {
    this.ducked = active;
    if (this.graph === null) return;
    const attack = active ? AUDIO.duck.attackMs / 1000 : AUDIO.duck.releaseMs / 1000;
    this.graph.music.volume.rampTo(this.musicTargetDb(), attack);
    this.graph.ambience.volume.rampTo(this.ambienceTargetDb(), attack);
  }

  /** Touche M : coupure franche en 120 ms, retour doux. */
  toggleMute(): boolean {
    this.muted = !this.muted;
    this.applyMasterVolume(this.muted ? AUDIO.muteFadeMs / 1000 : 0.25);
    return this.muted;
  }

  setMuted(muted: boolean): void {
    if (this.muted === muted) return;
    this.muted = muted;
    this.applyMasterVolume(this.muted ? AUDIO.muteFadeMs / 1000 : 0.25);
  }

  /** Onglet caché : plus rien ne joue en arrière-plan (batterie, respect). */
  suspend(): void {
    this.hidden = true;
    if (this.graph === null) return;
    Tone.getTransport().pause();
    this.graph.master.gain.cancelScheduledValues(Tone.now());
    this.graph.master.gain.rampTo(-Infinity, AUDIO.hiddenFadeOutMs / 1000);
  }

  resume(): void {
    this.hidden = false;
    if (this.graph === null) return;
    Tone.getTransport().start();
    this.applyMasterVolume(AUDIO.hiddenFadeInMs / 1000);
  }

  dispose(): void {
    for (const off of this.unsubscribeLifecycle) off();
    this.unsubscribeLifecycle.length = 0;
    this.music.dispose();
    this.sfx.dispose();
    this.ambience.dispose();
    this.graph?.reverb.dispose();
    this.graph?.master.disconnect();
    this.graph = null;
    this.started = false;
  }

  // ————————————————————————————————— Graphe et gains

  private buildGraph(): void {
    if (this.graph !== null) return;
    const master = new Tone.Gain(0);
    master.toDestination();

    // Réverbération « vallée » partagée (une seule instance, tous les bus).
    const reverb = new Tone.Reverb({
      decay: AUDIO.reverb.decaySeconds,
      preDelay: AUDIO.reverb.preDelaySeconds,
      wet: AUDIO.reverb.wet,
    });

    const music = new Tone.Volume(-Infinity);
    const ambience = new Tone.Volume(-Infinity);
    const sfx = new Tone.Volume(-Infinity);

    // Musique et ambiance vivent dans la vallée ; les sfx restent précis,
    // avec un faible envoi — un pas doit rester sous le pied.
    music.connect(reverb);
    ambience.connect(reverb);
    const sfxSend = new Tone.Gain(AUDIO.reverb.sfxSend);
    sfx.connect(master);
    sfx.connect(sfxSend);
    sfxSend.connect(reverb);
    reverb.connect(master);

    this.graph = { music, ambience, sfx, sfxSend, reverb, master };

    this.music.prepare(music);
    this.sfx.prepare(sfx);
    this.ambience.prepare(ambience);
  }

  private applyVolumes(): void {
    if (this.graph === null) return;
    this.graph.music.volume.rampTo(this.musicTargetDb(), 0.2);
    this.graph.ambience.volume.rampTo(this.ambienceTargetDb(), 0.2);
    this.graph.sfx.volume.rampTo(busGainDb('sfx', this.volumes.sfx), 0.2);
    this.applyMasterVolume(0.2);
  }

  private musicTargetDb(): number {
    return busGainDb('music', this.volumes.music) + duckOffsetDb('music', this.ducked);
  }

  private ambienceTargetDb(): number {
    return busGainDb('ambience', this.volumes.ambience) + duckOffsetDb('ambience', this.ducked);
  }

  private applyMasterVolume(seconds: number): void {
    const graph = this.graph;
    if (graph === null) return;
    const master = graph.master;
    if (master === null) return;
    const target = this.masterTargetDb();
    if (target === Number.NEGATIVE_INFINITY) {
      master.gain.cancelScheduledValues(Tone.now());
      master.gain.rampTo(-Infinity, Math.max(0.02, seconds));
      return;
    }
    // Perte de focus : le jeu reste présent, à −12 dB seulement.
    const effective = this.blurred ? target + AUDIO.blurAttenuationDb : target;
    master.gain.rampTo(effective, Math.max(0.02, seconds));
  }

  private masterTargetDb(): number {
    if (this.muted || this.hidden) return Number.NEGATIVE_INFINITY;
    return masterGainDb(this.volumes.master);
  }

  private watchLifecycle(): void {
    if (this.unsubscribeLifecycle.length > 0) return;
    this.unsubscribeLifecycle.push(
      platform.onLifecycle((event) => {
        if (event === 'pause') this.suspend();
        else this.resume();
      }),
    );

    if (typeof window === 'undefined') return;
    window.addEventListener('blur', this.onWindowBlur);
    window.addEventListener('focus', this.onWindowFocus);
    this.unsubscribeLifecycle.push(() => {
      window.removeEventListener('blur', this.onWindowBlur);
      window.removeEventListener('focus', this.onWindowFocus);
    });
  }

  private readonly onWindowBlur = (): void => {
    this.blurred = true;
    this.applyMasterVolume(0.4);
  };

  private readonly onWindowFocus = (): void => {
    this.blurred = false;
    this.applyMasterVolume(0.4);
  };
}
