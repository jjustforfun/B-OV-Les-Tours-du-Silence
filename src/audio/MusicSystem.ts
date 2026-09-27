/**
 * MusicSystem.ts — musique adaptative, générée plutôt que jouée.
 *
 * Statut : squelette. Intention : pas de boucle mp3 (poids, répétition
 * perceptible), mais un système de nappes procédurales en mode ré/dorien,
 * lent, avec des intervalles de quarte qui rappellent le chant vainakh —
 * sans jamais pasticher un chant réel (docs/CULTURE.md).
 *
 * Adaptativité : quatre couches empilées, ajoutées à mesure que le joueur
 * progresse dans le niveau (docs/AUDIO.md) —
 *   0 `drone`  : bourdon de quinte, présent du premier au dernier instant ;
 *   1 `pondar` : la corde pincée, dès la première manipulation ;
 *   2 `doul`   : percussion douce à la main, à mi-résolution ;
 *   3 `melody` : la mélodie, quand le chemin final se referme.
 * Les transitions durent 4 à 8 secondes : on n'entend jamais une couche
 * apparaître, on s'aperçoit qu'elle est là.
 */
import * as Tone from 'tone';

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

export class MusicSystem {
  private readonly active = new Set<MusicLayer>();
  private reverb: Tone.Reverb | null = null;

  /** Prépare le graphe (réverbération longue, façon vallée). */
  prepare(): void {
    this.reverb ??= new Tone.Reverb({ decay: 9, preDelay: 0.08, wet: 0.42 }).toDestination();
    // TODO(phase Audio) : PolySynth + LFO de filtre par couche.
  }

  setLayer(layer: MusicLayer, enabled: boolean, _fadeSeconds = 6): void {
    if (enabled) this.active.add(layer);
    else this.active.delete(layer);
    // TODO(phase Audio) : rampe de gain sur la couche.
  }

  get activeLayers(): readonly MusicLayer[] {
    return MUSIC_LAYERS.filter((layer) => this.active.has(layer));
  }

  /**
   * Règle l'empilement d'un coup : `setProgress(2)` allume `drone`, `pondar`
   * et `doul`, et éteint le reste. C'est l'API qu'appelle la progression du
   * niveau — elle ne connaît que le nombre de couches méritées.
   */
  setProgress(layerCount: number, fadeSeconds = 6): void {
    MUSIC_LAYERS.forEach((layer, index) => {
      this.setLayer(layer, index < layerCount, fadeSeconds);
    });
  }

  dispose(): void {
    this.reverb?.dispose();
    this.reverb = null;
    this.active.clear();
  }
}
