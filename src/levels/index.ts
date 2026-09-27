/**
 * levels/index.ts — registre des chapitres.
 *
 * Chaque chapitre est importé dynamiquement : Vite en fait un chunk séparé
 * (voir manualChunks), donc le bundle initial ne porte que le prologue.
 * Ajouter un chapitre = une ligne ici et un fichier à côté, rien d'autre.
 */
import type { LevelDefinition } from '@world/Level';

export const LEVEL_IDS = [
  '00-prologue',
  '01-hospitalite',
  '02-parole',
  '03-anciens',
  '04-patience',
  '05-pardon',
  '06-humilite',
  '07-epilogue',
] as const;

export type LevelId = (typeof LEVEL_IDS)[number];

/** Longueur du préfixe `NN-` dans les identifiants de chapitre. */
const CHAPTER_PREFIX_LENGTH = 3;

interface LevelModule {
  readonly level: LevelDefinition;
}

const LOADERS: Readonly<Record<LevelId, () => Promise<LevelModule>>> = {
  '00-prologue': () => import('./00-prologue'),
  '01-hospitalite': () => import('./01-hospitalite'),
  '02-parole': () => import('./02-parole'),
  '03-anciens': () => import('./03-anciens'),
  '04-patience': () => import('./04-patience'),
  '05-pardon': () => import('./05-pardon'),
  '06-humilite': () => import('./06-humilite'),
  '07-epilogue': () => import('./07-epilogue'),
};

/** Le chapitre qui suit, ou `null` après l'épilogue. Pur. */
export function nextLevelId(id: LevelId): LevelId | null {
  const index = LEVEL_IDS.indexOf(id);
  if (index < 0) return null;
  return LEVEL_IDS[index + 1] ?? null;
}

export async function loadLevelDefinition(id: LevelId): Promise<LevelDefinition> {
  const module = await LOADERS[id]();
  return module.level;
}

export function isLevelId(value: string): value is LevelId {
  return (LEVEL_IDS as readonly string[]).includes(value);
}

/**
 * Métadonnées d'affichage dérivées de l'identifiant — l'UI (titre, sélecteur,
 * cartons) n'a jamais besoin de charger la géométrie d'un niveau pour
 * s'étiqueter. La convention `NN-<vertu>` fait tout le travail.
 */
export function levelVirtue(id: LevelId): string {
  return id.slice(CHAPTER_PREFIX_LENGTH);
}

export function levelChapterNumber(id: LevelId): number {
  return LEVEL_IDS.indexOf(id);
}

export function levelTitleKey(id: LevelId): string {
  return `levels.${levelVirtue(id)}.title`;
}

export function levelSubtitleKey(id: LevelId): string {
  return `levels.${levelVirtue(id)}.subtitle`;
}

export function levelIntroKey(id: LevelId): string {
  return `levels.${levelVirtue(id)}.intro`;
}

/** Le prologue ouvre le seuil ; les autres suivent leur vertu. */
export function levelProverbKey(id: LevelId): string {
  return id === '00-prologue' ? 'proverbs.threshold' : `proverbs.${levelVirtue(id)}`;
}
