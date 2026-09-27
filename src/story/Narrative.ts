/**
 * Narrative.ts — la conduite du récit.
 *
 * Statut : squelette. Le jeu ne raconte presque rien avec des mots : un
 * proverbe par chapitre, et c'est tout. Le reste est porté par
 * l'architecture, la lumière et Borz.
 *
 * Structure : sept chapitres, six vertus du Nokhchalla, une phrase finale.
 * Aucune tension dramatique fondée sur la menace ou la perte : la progression
 * émotionnelle va de la solitude vers l'appartenance.
 */
import type { Virtue } from '@world/Level';

export interface ChapterNarrative {
  readonly virtue: Virtue;
  /** Clé i18n du titre. */
  readonly titleKey: string;
  /** Clé i18n du proverbe offert à la fin du chapitre. */
  readonly proverbKey: string;
  /** Idée en une phrase — note d'intention pour l'équipe, jamais affichée. */
  readonly intent: string;
}

export const CHAPTERS: readonly ChapterNarrative[] = [
  {
    virtue: 'prologue',
    titleKey: 'levels.prologue.title',
    proverbKey: 'proverbs.threshold',
    intent: "Turpal revient vers des tours que plus personne n'habite.",
  },
  {
    virtue: 'hospitalite',
    titleKey: 'levels.hospitalite.title',
    proverbKey: 'proverbs.hospitalite',
    intent: 'Ouvrir sa porte avant de songer à son propre chemin.',
  },
  {
    virtue: 'parole',
    titleKey: 'levels.parole.title',
    proverbKey: 'proverbs.parole',
    intent: "Tenir ce que l'on a promis, même quand cela coûte un détour.",
  },
  {
    virtue: 'anciens',
    titleKey: 'levels.anciens.title',
    proverbKey: 'proverbs.anciens',
    intent: "Suivre une direction que l'on ne comprend pas encore.",
  },
  {
    virtue: 'patience',
    titleKey: 'levels.patience.title',
    proverbKey: 'proverbs.patience',
    intent: 'Laisser le temps faire une partie du travail.',
  },
  {
    virtue: 'pardon',
    titleKey: 'levels.pardon.title',
    proverbKey: 'proverbs.pardon',
    intent: "Réparer ce que l'on a soi-même brisé.",
  },
  {
    virtue: 'humilite',
    titleKey: 'levels.humilite.title',
    proverbKey: 'proverbs.humilite',
    intent: 'Descendre pour pouvoir monter.',
  },
  {
    virtue: 'epilogue',
    titleKey: 'levels.epilogue.title',
    proverbKey: 'proverbs.epilogue',
    intent: "Ce que l'on a bâti pour les autres nous porte enfin.",
  },
];

export function chapterFor(virtue: Virtue): ChapterNarrative | undefined {
  return CHAPTERS.find((chapter) => chapter.virtue === virtue);
}
