/**
 * motif.ts — génération des motifs du pondar et de la mélodie, en pur.
 *
 * « Jamais deux fois identique » (docs/AUDIO.md § 4) : le motif `pondar`
 * compte 5 à 7 notes, non métriques, jouées toutes les 8 à 14 s ; la mélodie
 * chante des lignes longues de quartes et de quintes au-dessus du bourdon.
 * Le hasard est borné pour rester dans la gamme — l'aléatoire est injectable
 * pour les tests.
 */

export interface MotifNote {
  /** Midi à jouer. */
  readonly midi: number;
  /** Décalage depuis le début de phrase, en secondes. */
  readonly atSeconds: number;
  /** Vélocité 0..1. */
  readonly gain: number;
}

export type Rng = () => number;

/**
 * Motif du pondar : 5 à 7 notes, marche aléatoire sur la gamme, espacement
 * non métrique (0,35 à 1,4 s), vélocité douce et variée.
 */
export function generatePondarMotif(scale: readonly number[], rng: Rng): MotifNote[] {
  const count = 5 + Math.floor(rng() * 3); // 5..7
  const notes: MotifNote[] = [];
  let index = Math.floor(scale.length * 0.25 + rng() * scale.length * 0.4);
  let at = 0;

  for (let i = 0; i < count; i += 1) {
    const midi = scale[Math.min(Math.max(index, 0), scale.length - 1)] ?? 60;
    notes.push({ midi, atSeconds: at, gain: 0.45 + rng() * 0.4 });
    at += 0.35 + rng() * 1.05;
    // La marche penche vers le centre de la gamme : pas d'escalade mécanique.
    const drift = rng() < 0.5 ? -1 : 1;
    const pull = index < scale.length / 2 ? 1 : -1;
    index += rng() < 0.72 ? drift : pull;
    index = Math.min(Math.max(index, 0), scale.length - 1);
  }

  return notes;
}

/** Délai avant la prochaine phrase de pondar : 8 à 14 s. */
export function nextPondarPhraseDelay(rng: Rng): number {
  return 8 + rng() * 6;
}

/**
 * Phrase de mélodie : 3 à 5 notes longues en arcs de quarte/quinte — les
 * intervalles du chant vainakh qu'on évoque sans jamais le pasticher
 * (docs/CULTURE.md).
 */
export function generateMelodyPhrase(scale: readonly number[], rng: Rng): MotifNote[] {
  const count = 3 + Math.floor(rng() * 3); // 3..5
  const start = Math.floor(scale.length * 0.45 + rng() * scale.length * 0.25);
  const arc: number[] = [];
  let index = start;
  for (let i = 0; i < count; i += 1) {
    arc.push(index);
    // Montée par quarte (3 degrés), redescente par quinte (4 degrés).
    index += i % 2 === 0 ? 3 : -4;
    index = Math.min(Math.max(index, 0), scale.length - 1);
  }

  let at = 0;
  return arc.map((position, i) => {
    const midi = scale[position] ?? 60;
    const duration = 1.6 + rng() * 1.6;
    const note: MotifNote = { midi, atSeconds: at, gain: i === 0 ? 0.55 : 0.4 + rng() * 0.3 };
    at += duration * (0.55 + rng() * 0.2);
    return note;
  });
}

/** Délai avant la prochaine phrase de mélodie : 9 à 15 s. */
export function nextMelodyPhraseDelay(rng: Rng): number {
  return 9 + rng() * 6;
}

/**
 * Percussion `doul` : motif ternaire lâche à ~48 BPM (1,25 s par temps).
 * Retourne, pour chaque temps, la vélocité (0 = silence). Les frappes
 * s'installent progressivement pendant le fondu d'entrée de la couche.
 */
export function generateDoulPattern(beats: number, rng: Rng, intensity: number): readonly number[] {
  const pattern: number[] = [];
  for (let i = 0; i < beats; i += 1) {
    const ternary = i % 3 === 0 ? 1 : 0.55;
    const chance = 0.32 + 0.5 * intensity;
    const play = rng() < chance * ternary;
    pattern.push(play ? (i % 3 === 0 ? 0.7 : 0.42) * (0.75 + 0.25 * intensity) : 0);
  }
  return pattern;
}
