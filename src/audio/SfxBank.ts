/**
 * SfxBank.ts — effets sonores, tous synthétisés.
 *
 * Statut : squelette. Aucun fichier audio pour les sfx : ils sont générés
 * (bruit filtré pour la pierre, sinusoïdes courtes pour les validations).
 * Avantage direct : quelques kilo-octets au lieu de plusieurs mégaoctets, et
 * des variations infinies qui empêchent la fatigue d'écoute.
 *
 * Palette : pas (grain sourd), pierre qui coulisse (bruit brun + filtre),
 * emboîtement (clic de bois), célébration (arpège de quintes ascendant).
 */
import * as Tone from 'tone';

export type SfxName = 'step' | 'stoneSlide' | 'stoneLock' | 'celebrate' | 'uiTap' | 'proverb';

export class SfxBank {
  private noise: Tone.NoiseSynth | null = null;

  prepare(): void {
    this.noise ??= new Tone.NoiseSynth({
      noise: { type: 'brown' },
      envelope: { attack: 0.006, decay: 0.16, sustain: 0 },
    }).toDestination();
  }

  play(name: SfxName, _velocity = 1): void {
    // TODO(phase Audio) : un générateur dédié par son, avec variation aléatoire
    // de hauteur (±2 demi-tons) pour éviter toute répétition mécanique.
    void name;
  }

  dispose(): void {
    this.noise?.dispose();
    this.noise = null;
  }
}
