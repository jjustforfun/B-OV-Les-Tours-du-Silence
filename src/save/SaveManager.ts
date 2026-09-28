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
import { LEVEL_IDS, type LevelId } from '@levels/index';
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
  /** Secrets contemplatifs trouvés, sans compteur affiché au joueur. */
  eagles: string[];
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
    eagles: [],
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

  /** Le joueur a-t-il déjà avancé (écran titre : « Continuer » vs « Commencer ») ? */
  hasProgress(): boolean {
    return this.data.completed.length > 0 || this.data.currentLevel !== LEVEL_IDS[0];
  }

  /** Ce chapitre est-il terminé ? */
  isCompleted(levelId: string): boolean {
    return this.data.completed.includes(levelId);
  }

  /**
   * Chapitres ouverts dans le sélecteur : les terminés, plus le courant.
   * Les suivants restent fermés — la carte ne spoil rien (docs/GDD.md).
   */
  reachedLevelIds(): readonly LevelId[] {
    const reached = new Set<LevelId>(this.data.completed as LevelId[]);
    if ((LEVEL_IDS as readonly string[]).includes(this.data.currentLevel)) {
      reached.add(this.data.currentLevel as LevelId);
    }
    return LEVEL_IDS.filter((id) => reached.has(id));
  }

  async load(): Promise<SaveData> {
    const raw = await platform.getItem(STORAGE_KEYS.save);
    if (raw === null) return this.data;

    try {
      const parsed: unknown = JSON.parse(raw);
      if (isSaveData(parsed) && parsed.version === SAVE_VERSION) {
        this.data = {
          ...parsed,
          eagles: Array.isArray(parsed.eagles)
            ? parsed.eagles.filter((entry): entry is string => typeof entry === 'string')
            : [],
        };
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

  markEagleFound(secretId: string): void {
    if (this.data.eagles.includes(secretId)) return;
    this.data.eagles.push(secretId);
    this.dirty = true;
  }

  hasEagle(secretId: string): boolean {
    return this.data.eagles.includes(secretId);
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
