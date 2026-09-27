/**
 * Proverbs.ts — les proverbes offerts au joueur.
 *
 * IMPORTANT (docs/CULTURE.md) : les textes ci-dessous sont des formulations
 * originales écrites pour le jeu, inspirées de l'esprit du Nokhchalla. Ce ne
 * sont PAS des citations de proverbes tchétchènes authentiques ; les
 * attribuer comme tels serait une appropriation. Toute traduction en
 * tchétchène doit être validée par un locuteur natif avant publication et
 * reste marquée [À VÉRIFIER] jusque-là.
 *
 * Le texte affiché vient toujours de l'i18n : ce fichier ne contient que les
 * clés et leur rattachement à une vertu.
 */
import type { Virtue } from '@world/Level';

export interface ProverbDefinition {
  readonly key: string;
  readonly virtue: Virtue;
  /** Débloqué à la fin de ce chapitre. */
  readonly levelId: string;
}

export const PROVERBS: readonly ProverbDefinition[] = [
  { key: 'proverbs.threshold', virtue: 'prologue', levelId: '00-prologue' },
  { key: 'proverbs.hospitalite', virtue: 'hospitalite', levelId: '01-hospitalite' },
  { key: 'proverbs.parole', virtue: 'parole', levelId: '02-parole' },
  { key: 'proverbs.anciens', virtue: 'anciens', levelId: '03-anciens' },
  { key: 'proverbs.patience', virtue: 'patience', levelId: '04-patience' },
  { key: 'proverbs.pardon', virtue: 'pardon', levelId: '05-pardon' },
  { key: 'proverbs.humilite', virtue: 'humilite', levelId: '06-humilite' },
  { key: 'proverbs.epilogue', virtue: 'epilogue', levelId: '07-epilogue' },
];

export function proverbForLevel(levelId: string): ProverbDefinition | undefined {
  return PROVERBS.find((proverb) => proverb.levelId === levelId);
}
