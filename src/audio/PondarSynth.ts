/**
 * PondarSynth.ts — évocation du dechig-pondar. [À VÉRIFIER : dechig-pondar,
 * luth tchétchène à trois cordes, orthographe et description à confirmer
 * auprès d'une source tchétchène — voir docs/CULTURE.md]
 *
 * Statut : squelette. Intention : une corde pincée, sèche, boisée, avec une
 * légère inharmonicité. C'est la voix de Turpal — il ne parle pas, le pondar
 * répond pour lui aux moments clés.
 *
 * Précaution de respect : on ne reproduit aucune mélodie traditionnelle
 * existante. On emprunte une couleur, pas un répertoire.
 */
import * as Tone from 'tone';

export interface PondarOptions {
  readonly brightness?: number;
  readonly decaySeconds?: number;
}

export class PondarSynth {
  private synth: Tone.PluckSynth | null = null;

  constructor(private readonly options: PondarOptions = {}) {}

  prepare(): void {
    this.synth ??= new Tone.PluckSynth({
      attackNoise: 1.4,
      dampening: 1800 * (this.options.brightness ?? 1),
      resonance: 0.92,
      release: this.options.decaySeconds ?? 1.6,
    }).toDestination();
  }

  /** Une note pincée. `note` en notation scientifique ('D3', 'A3'…). */
  pluck(note: string, time?: number): void {
    this.synth?.triggerAttack(note, time);
  }

  /** Motif court de trois notes : la « signature » de fin de chapitre. */
  playChapterSignature(root: string): void {
    void root;
    // TODO(phase Audio) : trois notes montantes, espacées de 0,45 s, très réverbérées.
  }

  dispose(): void {
    this.synth?.dispose();
    this.synth = null;
  }
}
