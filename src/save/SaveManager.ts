/**
 * SaveManager.ts — sauvegarde de la progression.
 *
 * Principes, cohérents avec le ton du jeu :
 *  - la sauvegarde est automatique et silencieuse, jamais un bouton ;
 *  - rien ne se perd : on ne peut ni échouer ni régresser ;
 *  - le format est versionné, et une sauvegarde illisible est ignorée
 *    proprement plutôt que de bloquer le démarrage.
 */
import { STORAGE_KEYS } from '@/config';
import { platform } from '@platform/Platform';

export const SAVE_VERSION = 1;

export interface SaveData {
  readonly version: number;
  /** Identifiant du dernier chapitre atteint. */
  currentLevel: string;
  /** Chapitres terminés, dans l'ordre. */
  completed: string[];
  /** Proverbes débloqués (clés i18n). */
  proverbs: string[];
  /** Secondes de jeu cumulées — affiché nulle part, utile à l'équilibrage. */
  playtimeSeconds: number;
  updatedAt: number;
}

export function createEmptySave(): SaveData {
  return {
    version: SAVE_VERSION,
    currentLevel: '00-prologue',
    completed: [],
    proverbs: [],
    playtimeSeconds: 0,
    updatedAt: Date.now(),
  };
}

function isSaveData(value: unknown): value is SaveData {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Partial<SaveData>;
  return (
    typeof candidate.version === 'number' &&
    typeof candidate.currentLevel === 'string' &&
    Array.isArray(candidate.completed) &&
    Array.isArray(candidate.proverbs)
  );
}

export class SaveManager {
  private data: SaveData = createEmptySave();
  private dirty = false;

  get snapshot(): Readonly<SaveData> {
    return this.data;
  }

  async load(): Promise<SaveData> {
    const raw = await platform.getItem(STORAGE_KEYS.save);
    if (raw === null) return this.data;

    try {
      const parsed: unknown = JSON.parse(raw);
      if (isSaveData(parsed) && parsed.version === SAVE_VERSION) {
        this.data = parsed;
      }
    } catch {
      /* Sauvegarde corrompue : on repart d'une partie neuve, sans message d'erreur. */
    }
    return this.data;
  }

  markCompleted(levelId: string, nextLevelId: string, proverbKey?: string): void {
    if (!this.data.completed.includes(levelId)) this.data.completed.push(levelId);
    if (proverbKey !== undefined && !this.data.proverbs.includes(proverbKey)) {
      this.data.proverbs.push(proverbKey);
    }
    this.data.currentLevel = nextLevelId;
    this.dirty = true;
  }

  addPlaytime(seconds: number): void {
    this.data.playtimeSeconds += seconds;
    this.dirty = true;
  }

  /** Écrit si nécessaire. Appelé à la fin d'un chapitre et à la mise en pause. */
  async flush(): Promise<void> {
    if (!this.dirty) return;
    this.data.updatedAt = Date.now();
    await platform.setItem(STORAGE_KEYS.save, JSON.stringify(this.data));
    this.dirty = false;
  }

  async reset(): Promise<void> {
    this.data = createEmptySave();
    this.dirty = false;
    await platform.removeItem(STORAGE_KEYS.save);
  }
}
