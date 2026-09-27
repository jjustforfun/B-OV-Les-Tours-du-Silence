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

export async function loadLevelDefinition(id: LevelId): Promise<LevelDefinition> {
  const module = await LOADERS[id]();
  return module.level;
}

export function nextLevelId(id: LevelId): LevelId | null {
  const index = LEVEL_IDS.indexOf(id);
  return LEVEL_IDS[index + 1] ?? null;
}

export function isLevelId(value: string): value is LevelId {
  return (LEVEL_IDS as readonly string[]).includes(value);
}
