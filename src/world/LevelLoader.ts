/**
 * LevelLoader.ts — chargement paresseux des niveaux.
 *
 * Chaque chapitre est un chunk séparé (voir manualChunks dans vite.config.ts) :
 * le bundle initial ne contient que le prologue, et un chapitre lointain n'est
 * téléchargé qu'au moment où le joueur y arrive. Le loader garde en cache la
 * définition, jamais l'instance : une instance possède des ressources GPU.
 */
import { Level, type LevelDefinition } from './Level';
import { LEVEL_IDS, loadLevelDefinition, type LevelId } from '@levels/index';

export class LevelLoader {
  private readonly cache = new Map<LevelId, LevelDefinition>();
  private current: Level | null = null;

  get activeLevel(): Level | null {
    return this.current;
  }

  get ids(): readonly LevelId[] {
    return LEVEL_IDS;
  }

  /** Charge (et met en cache) la définition d'un niveau. */
  async definition(id: LevelId): Promise<LevelDefinition> {
    const cached = this.cache.get(id);
    if (cached) return cached;
    const definition = await loadLevelDefinition(id);
    this.cache.set(id, definition);
    return definition;
  }

  /** Décharge le niveau courant et instancie le suivant. */
  async load(id: LevelId): Promise<Level> {
    const definition = await this.definition(id);
    this.unload();
    this.current = new Level(definition);
    return this.current;
  }

  /** Précharge en tâche de fond le niveau suivant (jamais bloquant). */
  preload(id: LevelId): void {
    void this.definition(id).catch(() => {
      /* Un préchargement raté n'est jamais une erreur de jeu. */
    });
  }

  unload(): void {
    const level = this.current;
    this.current = null;
    level?.dispose();
  }

  clearCache(): void {
    this.cache.clear();
  }
}
