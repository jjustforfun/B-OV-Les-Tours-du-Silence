/**
 * audio-director.test.ts — l'état audio avant le premier geste.
 *
 * Le graphe audio n'existe pas avant le déverrouillage navigateur
 * (ADR-025) : régler un curseur depuis l'écran titre doit quand même
 * persister — et persister une table **complète**, faute de quoi le
 * chargement ultérieur lirait une table vide et perdrait les autres canaux.
 */
import { describe, expect, it } from 'vitest';
import { AudioDirector } from '@audio/AudioDirector';
import { SettingsStore, type SettingsStorage } from '@save/SettingsStore';

function memoryStorage(): SettingsStorage & { dump(): Map<string, string> } {
  const items = new Map<string, string>();
  return {
    getItem: (key) => Promise.resolve(items.get(key) ?? null),
    setItem: (key, value) => {
      items.set(key, value);
      return Promise.resolve();
    },
    dump: () => items,
  };
}

describe('AudioDirector (avant déverrouillage)', () => {
  it('persiste une table de volumes complète, défauts compris', async () => {
    const storage = memoryStorage();
    const store = new SettingsStore(storage);
    const director = new AudioDirector(store);

    expect(director.isUnlocked).toBe(false);
    await director.setVolume('music', 0.5);
    director.uiTap(); // sans graphe : silencieux, jamais une erreur

    const volumes = store.snapshot.audio?.volumes;
    expect(volumes).toBeDefined();
    // La modification…
    expect(volumes?.music).toBe(0.5);
    // …et les trois autres canaux, remplis depuis les défauts.
    expect(volumes?.master).toBe(0.9);
    expect(volumes?.ambience).toBe(0.6);
    expect(volumes?.sfx).toBe(0.85);

    director.dispose();
  });

  it('un second réglage conserve le premier', async () => {
    const storage = memoryStorage();
    const store = new SettingsStore(storage);
    const director = new AudioDirector(store);

    await director.setVolume('music', 0.5);
    await director.setVolume('sfx', 0.2);

    expect(store.snapshot.audio?.volumes).toEqual({
      master: 0.9,
      music: 0.5,
      ambience: 0.6,
      sfx: 0.2,
    });

    director.dispose();
  });
});
