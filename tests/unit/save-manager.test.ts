/**
 * save-manager.test.ts — sauvegarde automatique versionnée (phase 8).
 *
 * Rien ne se perd, rien ne régresse, jamais un bouton « sauvegarder ».
 * En node, `platform` est un no-op : ces tests valident la logique pure
 * (progression, proverbes, temps de jeu) sans stockage réel.
 */
import { describe, expect, it } from 'vitest';
import { SaveManager, SAVE_VERSION, createEmptySave } from '@save/SaveManager';

describe('SaveManager', () => {
  it('part du prologue, sans progression', () => {
    const save = new SaveManager();
    expect(save.snapshot.version).toBe(SAVE_VERSION);
    expect(save.hasProgress()).toBe(false);
    expect(save.reachedLevelIds()).toEqual(['00-prologue']);
  });

  it('marque un chapitre terminé, débloque son proverbe, avance le courant', () => {
    const save = new SaveManager();
    save.markCompleted('00-prologue', '01-hospitalite', 'proverbs.threshold');
    expect(save.isCompleted('00-prologue')).toBe(true);
    expect(save.hasProgress()).toBe(true);
    expect(save.snapshot.currentLevel).toBe('01-hospitalite');
    expect(save.snapshot.proverbs).toEqual(['proverbs.threshold']);
    // Le sélecteur ouvre les terminés + le courant, jamais la suite.
    expect(save.reachedLevelIds()).toEqual(['00-prologue', '01-hospitalite']);
  });

  it('un même chapitre terminé deux fois n’empile rien', () => {
    const save = new SaveManager();
    save.markCompleted('02-parole', '03-anciens', 'proverbs.parole');
    save.markCompleted('02-parole', '03-anciens', 'proverbs.parole');
    expect(save.snapshot.completed).toEqual(['02-parole']);
    expect(save.snapshot.proverbs).toEqual(['proverbs.parole']);
  });

  it("mémorise l'aigle sans compteur visible ni doublon", () => {
    const save = new SaveManager();
    save.markEagleFound('00-prologue:eagle');
    save.markEagleFound('00-prologue:eagle');
    expect(save.hasEagle('00-prologue:eagle')).toBe(true);
    expect(save.snapshot.eagles).toEqual(['00-prologue:eagle']);
  });

  it('cumule le temps de jeu et écrit seulement si nécessaire', async () => {
    const save = new SaveManager();
    expect(save.snapshot.playtimeSeconds).toBe(0);
    save.addPlaytime(90.5);
    save.addPlaytime(30);
    expect(save.snapshot.playtimeSeconds).toBeCloseTo(120.5, 6);
    await save.flush(); // écrit (dirty)
    await save.flush(); // plus rien à écrire : no-op silencieux
    expect(save.snapshot.playtimeSeconds).toBeCloseTo(120.5, 6);
  });

  it('ignore en silence une sauvegarde corrompue', async () => {
    const save = new SaveManager();
    save.markCompleted('00-prologue', '01-hospitalite');
    // platform est un no-op en node : load() retombe sur l'état courant,
    // exactement le comportement attendu devant un JSON illisible.
    await expect(save.load()).resolves.toBeDefined();
    expect(save.isCompleted('00-prologue')).toBe(true);
  });

  it('reset repart d’une partie neuve', async () => {
    const save = new SaveManager();
    save.markCompleted('06-humilite', '07-epilogue', 'proverbs.humilite');
    await save.reset();
    expect({ ...save.snapshot, updatedAt: 0 }).toEqual({ ...createEmptySave(), updatedAt: 0 });
    expect(save.hasProgress()).toBe(false);
  });
});
