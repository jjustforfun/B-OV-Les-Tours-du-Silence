/**
 * Ambience.ts — le paysage sonore du Caucase.
 *
 * Statut : squelette. Couches prévues, toutes procédurales ou très
 * compressées : vent de crête (bruit rose filtré, filtre modulé lentement),
 * rivière de l'Argun (bruit blanc filtré passe-bande), cri d'aigle (rare,
 * jamais deux fois de suite), craquements de pierre.
 *
 * Règle : l'ambiance ne boucle jamais de façon audible. Le vent doit pouvoir
 * tourner pendant vingt minutes sans qu'on repère un motif.
 */
import type { Noise } from 'tone';

export type AmbienceLayer = 'wind' | 'river' | 'birds' | 'stone';

export class Ambience {
  private readonly layers = new Map<AmbienceLayer, Noise>();

  prepare(): void {
    // TODO(phase Audio) : créer les générateurs de bruit + filtres modulés.
  }

  setLayer(layer: AmbienceLayer, enabled: boolean, _fadeSeconds = 4): void {
    void layer;
    void enabled;
    // TODO(phase Audio) : rampe de gain par couche.
  }

  dispose(): void {
    for (const noise of this.layers.values()) noise.dispose();
    this.layers.clear();
  }
}
