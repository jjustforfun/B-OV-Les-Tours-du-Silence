/**
 * ambiencePlan.ts — plan d'ambiance d'un lieu, en pur.
 *
 * Chaque niveau déclare ses couches dans sa `LevelDefinition`
 * (docs/AUDIO.md § 2) ; à défaut, le chapitre donne le plan par défaut de la
 * table du document. Les périodes des modulations sont **premières entre
 * elles** (7, 11, 13, 17, 23 s) : aucune super-périiode audible, le vent
 * peut tourner vingt minutes sans qu'on repère un motif.
 */

export type AmbienceLayerName = 'wind' | 'river' | 'bells' | 'eagle' | 'fire' | 'stone';

export const AMBIENCE_LAYER_NAMES: readonly AmbienceLayerName[] = [
  'wind',
  'river',
  'bells',
  'eagle',
  'fire',
  'stone',
];

/** Plan par défaut du chapitre (docs/AUDIO.md § 2). */
const CHAPTER_DEFAULTS: Readonly<Record<AmbienceLayerName, readonly number[]>> = {
  wind: [0, 1, 2, 3, 4, 5, 6, 7],
  river: [2, 4],
  bells: [1, 3],
  eagle: [0, 5, 6],
  fire: [1, 7],
  stone: [0, 5],
};

/** Résout les couches d'un niveau : la déclaration du niveau prime. */
export function resolveAmbienceLayers(
  chapter: number,
  declared?: readonly string[],
): readonly AmbienceLayerName[] {
  if (declared !== undefined && declared.length > 0) {
    const known = new Set<string>(AMBIENCE_LAYER_NAMES);
    const kept = declared.filter((name): name is AmbienceLayerName => known.has(name));
    // Le vent est le socle : un lieu sans vent n'existe pas dans ces montagnes.
    return kept.includes('wind') ? kept : ['wind', ...kept];
  }
  const layers: AmbienceLayerName[] = [];
  for (const name of AMBIENCE_LAYER_NAMES) {
    if (CHAPTER_DEFAULTS[name].includes(chapter)) layers.push(name);
  }
  return layers;
}

/** Périodes premières des modulations continues, par couche (secondes). */
export const PRIME_PERIODS: Readonly<Record<AmbienceLayerName, number>> = {
  wind: 23,
  river: 11,
  bells: 13,
  eagle: 17,
  fire: 7,
  stone: 17,
};

/** Gain nominal d'une couche (dB) — docs/AUDIO.md § 2. */
export function ambienceLayerGainDb(layer: AmbienceLayerName, chapter: number): number {
  switch (layer) {
    case 'wind':
      // +6 dB en altitude (chapitre 6, « L'Humilité »).
      return chapter === 6 ? -14 : -20;
    case 'river':
      return -18;
    case 'bells':
      return -26;
    case 'eagle':
      return -22;
    case 'fire':
      return -24;
    case 'stone':
      return -28;
  }
}

/** Fenêtre aléatoire du prochain événement discret (cloches, aigle), en s. */
export function nextEventDelay(layer: 'bells' | 'eagle', rng: () => number = Math.random): number {
  return layer === 'bells' ? 12 + rng() * 18 : 45 + rng() * 75;
}
