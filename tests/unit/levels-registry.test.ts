/**
 * levels-registry.test.ts — dérivation des métadonnées de chapitre.
 *
 * L'UI ne charge jamais la géométrie d'un niveau pour s'étiqueter : tout est
 * dérivé de l'identifiant `NN-<vertu>`. Ces fonctions sont la convention —
 * un test les fige pour que le carnet, le sélecteur et les cartons ne
 * puissent pas se désynchroniser des dictionnaires i18n.
 */
import { describe, expect, it } from 'vitest';
import {
  LEVEL_IDS,
  isLevelId,
  levelChapterNumber,
  levelIntroKey,
  levelProverbKey,
  levelSubtitleKey,
  levelTitleKey,
  levelVirtue,
  nextLevelId,
} from '@levels/index';
import frJson from '@/i18n/fr.json';
import enJson from '@/i18n/en.json';
import ruJson from '@/i18n/ru.json';

const DICTIONARIES: readonly Record<string, string>[] = [frJson, enJson, ruJson];

describe('Registre des chapitres', () => {
  it('huit chapitres dans l’ordre du voyage', () => {
    expect(LEVEL_IDS).toHaveLength(8);
    expect(LEVEL_IDS[0]).toBe('00-prologue');
    expect(LEVEL_IDS[7]).toBe('07-epilogue');
  });

  it('le chapitre suivant, null après l’épilogue', () => {
    expect(nextLevelId('00-prologue')).toBe('01-hospitalite');
    expect(nextLevelId('06-humilite')).toBe('07-epilogue');
    expect(nextLevelId('07-epilogue')).toBeNull();
  });

  it('isLevelId accepte les chapitres, rien d’autre', () => {
    expect(isLevelId('04-patience')).toBe(true);
    expect(isLevelId('penrose-demo')).toBe(false);
    expect(isLevelId('')).toBe(false);
  });

  it('vertu, numéro et clés dérivés de l’identifiant', () => {
    expect(levelVirtue('00-prologue')).toBe('prologue');
    expect(levelVirtue('05-pardon')).toBe('pardon');
    expect(levelChapterNumber('00-prologue')).toBe(0);
    expect(levelChapterNumber('07-epilogue')).toBe(7);
    expect(levelTitleKey('01-hospitalite')).toBe('levels.hospitalite.title');
    expect(levelSubtitleKey('01-hospitalite')).toBe('levels.hospitalite.subtitle');
    expect(levelIntroKey('01-hospitalite')).toBe('levels.hospitalite.intro');
  });

  it('le prologue ouvre le seuil ; les autres suivent leur vertu', () => {
    expect(levelProverbKey('00-prologue')).toBe('proverbs.threshold');
    expect(levelProverbKey('03-anciens')).toBe('proverbs.anciens');
    expect(levelProverbKey('07-epilogue')).toBe('proverbs.epilogue');
  });

  it('chaque clé dérivée existe vraiment dans les trois dictionnaires', () => {
    for (const id of LEVEL_IDS) {
      const keys = [
        levelTitleKey(id),
        levelSubtitleKey(id),
        levelIntroKey(id),
        levelProverbKey(id),
        `virtues.${levelVirtue(id)}`,
      ];
      for (const dictionary of DICTIONARIES) {
        for (const key of keys) {
          expect(dictionary[key], key).toBeTruthy();
        }
      }
    }
  });
});
