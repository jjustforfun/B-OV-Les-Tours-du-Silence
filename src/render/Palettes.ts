/**
 * Palettes.ts — les couleurs de chaque chapitre, en un seul endroit.
 *
 * La direction artistique (docs/ART_DIRECTION.md § 3) impose cinq couleurs
 * par chapitre : le dégradé du ciel, les deux valeurs de la pierre, et un
 * accent. Elles sont ici sous forme de données pour qu'un artiste puisse les
 * changer sans lire une ligne de logique — et pour qu'un test puisse vérifier
 * qu'aucune palette ne viole les règles de contraste.
 *
 * Règle absolue : la braise `#d9a441` est la seule couleur chaude saturée du
 * jeu, et elle signifie « ceci est actionnable ».
 */

export interface ChapterPalette {
  /** Haut du dégradé de ciel. */
  readonly skyTop: number;
  /** Bas du dégradé de ciel. */
  readonly skyBottom: number;
  /** Pierre à l'ombre — jamais noire : elle emprunte la teinte du ciel. */
  readonly stoneShadow: number;
  /** Pierre en lumière. */
  readonly stoneLight: number;
  /** Accent : gravures actives, liserés, célébration. */
  readonly accent: number;
}

export const CHAPTER_PALETTES = {
  /** Prologue — aube rose et ardoise. */
  prologue: {
    skyTop: 0x1b2230,
    skyBottom: 0xe3b7a6,
    stoneShadow: 0x39425a,
    stoneLight: 0x8e93a6,
    accent: 0xd9a441,
  },
  /** Ch.1 — ocre chaud et vert pâturage. */
  hospitalite: {
    skyTop: 0x3a3226,
    skyBottom: 0xc9a35c,
    stoneShadow: 0x5c5340,
    stoneLight: 0xa89372,
    accent: 0x6b7c4a,
  },
  /** Ch.2 — turquoise du torrent et gris schiste. */
  parole: {
    skyTop: 0x1d2a30,
    skyBottom: 0x7fc2c9,
    stoneShadow: 0x3a4750,
    stoneLight: 0x8d96a0,
    accent: 0x3f8fa3,
  },
  /** Ch.3 — sépia et or. */
  anciens: {
    skyTop: 0x2a2219,
    skyBottom: 0xe6d3a8,
    stoneShadow: 0x55432c,
    stoneLight: 0xa08a63,
    accent: 0xc9a24a,
  },
  /** Ch.4 — bleu nuit et argent lunaire. */
  patience: {
    skyTop: 0x0f1526,
    skyBottom: 0x8fa4c4,
    stoneShadow: 0x1b2740,
    stoneLight: 0x6f7f9c,
    accent: 0xdfe7f2,
  },
  /** Ch.5 — brun rouille et braise. */
  pardon: {
    skyTop: 0x241a16,
    skyBottom: 0xc2643f,
    stoneShadow: 0x4a2c22,
    stoneLight: 0x8a6a55,
    accent: 0xd9a441,
  },
  /** Ch.6 — blanc neige et bleu glacier. */
  humilite: {
    skyTop: 0x46536b,
    skyBottom: 0xf2f7fb,
    stoneShadow: 0x6d84a3,
    stoneLight: 0xcfe0ec,
    accent: 0x9fb8cf,
  },
  /** Épilogue — or, et toutes les teintes réunies. */
  epilogue: {
    skyTop: 0x1a2030,
    skyBottom: 0xd9a441,
    stoneShadow: 0x2c3444,
    stoneLight: 0xe8e0d2,
    accent: 0xc2643f,
  },
} as const satisfies Record<string, ChapterPalette>;

export type ChapterPaletteName = keyof typeof CHAPTER_PALETTES;

/** La braise : seule couleur chaude saturée, réservée à ce qui est actionnable. */
export const EMBER = 0xd9a441;
/** Encre des textes. */
export const INK = 0xe8e0d2;
