/**
 * AudioManager.ts — chef d'orchestre sonore.
 *
 * Contraintes navigateur : aucun son ne peut démarrer avant un geste du
 * joueur. On construit donc tout le graphe audio à froid et on ne démarre le
 * contexte Tone.js qu'au premier tap — avec un fondu d'entrée lent, jamais un
 * démarrage sec.
 *
 * Mixage (docs/AUDIO.md) : musique -9 dB, ambiance -14 dB, sfx -6 dB. Le
 * silence est un instrument : les nappes laissent régulièrement la place au
 * vent seul.
 */
import * as Tone from 'tone';
import { Ambience } from './Ambience';
import { MusicSystem } from './MusicSystem';
import { SfxBank } from './SfxBank';

export interface AudioVolumes {
  master: number;
  music: number;
  ambience: number;
  sfx: number;
}

export const DEFAULT_VOLUMES: AudioVolumes = { master: 0.9, music: 0.7, ambience: 0.6, sfx: 0.85 };

export class AudioManager {
  readonly music = new MusicSystem();
  readonly sfx = new SfxBank();
  readonly ambience = new Ambience();

  private started = false;
  private volumes: AudioVolumes = { ...DEFAULT_VOLUMES };

  get isStarted(): boolean {
    return this.started;
  }

  /** À appeler depuis un geste utilisateur (contrainte d'autoplay). */
  async start(): Promise<void> {
    if (this.started) return;
    await Tone.start();
    Tone.getDestination().volume.rampTo(toDecibels(this.volumes.master), 1.2);
    this.started = true;
  }

  setVolume(channel: keyof AudioVolumes, value: number): void {
    this.volumes[channel] = Math.min(Math.max(value, 0), 1);
    if (channel === 'master') {
      Tone.getDestination().volume.rampTo(toDecibels(this.volumes.master), 0.2);
    }
    // TODO(phase Audio) : router chaque système sur son propre Gain.
  }

  getVolume(channel: keyof AudioVolumes): number {
    return this.volumes[channel];
  }

  /** Coupe tout en douceur (mise en arrière-plan de l'app). */
  suspend(): void {
    Tone.getDestination().volume.rampTo(-Infinity, 0.4);
  }

  resume(): void {
    Tone.getDestination().volume.rampTo(toDecibels(this.volumes.master), 0.8);
  }

  dispose(): void {
    this.music.dispose();
    this.sfx.dispose();
    this.ambience.dispose();
  }
}

function toDecibels(linear: number): number {
  return linear <= 0 ? -Infinity : 20 * Math.log10(linear);
}
