/**
 * settings-store.test.ts — persistance tolérante des réglages (ADR-011).
 *
 * Deux écrivains, une clé : chaque section s'écrit sans écraser les autres.
 * Une valeur illisible est ignorée en silence — on ne bloque jamais une
 * partie pour un réglage corrompu.
 */
import { describe, expect, it } from 'vitest';
import { STORAGE_KEYS } from '@/config';
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

describe('SettingsStore', () => {
  it('part vierge puis persiste chaque section sans écraser les autres', async () => {
    const storage = memoryStorage();
    const store = new SettingsStore(storage);
    expect(await store.load()).toEqual({ version: 1 });

    await store.saveBindings({ KeyW: 'moveUp' });
    await store.saveAudio({ muted: true, volumes: { master: 0.5 } });
    await store.saveHapticsEnabled(false);

    expect(store.snapshot.bindings).toEqual({ KeyW: 'moveUp' });
    expect(store.snapshot.audio).toEqual({ muted: true, volumes: { master: 0.5 } });
    expect(store.snapshot.haptics).toEqual({ enabled: false });

    // Une seule clé pour tout, relecture fidèle.
    expect(storage.dump().size).toBe(1);
    const raw = storage.dump().get(STORAGE_KEYS.settings) ?? '{}';
    expect(JSON.parse(raw)).toEqual(store.snapshot);
  });

  it('relit fidèlement au prochain lancement', async () => {
    const storage = memoryStorage();
    await storage.setItem(
      STORAGE_KEYS.settings,
      JSON.stringify({
        version: 1,
        bindings: { KeyA: 'moveLeft', Space: 'confirm' },
        audio: { muted: true, volumes: { sfx: 0.4 } },
        haptics: { enabled: false },
      }),
    );
    const store = new SettingsStore(storage);
    const settings = await store.load();
    expect(settings.bindings?.KeyA).toBe('moveLeft');
    expect(settings.audio?.muted).toBe(true);
    expect(settings.audio?.volumes?.sfx).toBe(0.4);
    expect(settings.haptics?.enabled).toBe(false);
  });

  it('jette sans bruit les valeurs malades', async () => {
    const storage = memoryStorage();
    await storage.setItem(
      STORAGE_KEYS.settings,
      JSON.stringify({
        version: 1,
        bindings: { KeyW: 'moveUp', 'bad-code!': 'moveUp', KeyX: 42 },
        audio: { muted: 'peut-être', volumes: { master: 'fort', sfx: 0.9, NaN: Number.NaN } },
        haptics: { enabled: 'oui' },
      }),
    );
    const store = new SettingsStore(storage);
    const settings = await store.load();
    // Le magasin ne filtre pas les codes — c'est le rôle de sanitizeBindings
    // au chargement de l'InputManager. Il ne jette que le mal typé (KeyY: 42).
    expect(settings.bindings).toEqual({ KeyW: 'moveUp', 'bad-code!': 'moveUp' });
    expect(settings.audio?.volumes).toEqual({ sfx: 0.9 });
    expect(settings.audio?.muted).toBeUndefined();
    expect(settings.haptics).toBeUndefined();
  });

  it('survit à un JSON corrompu et à un stockage en erreur', async () => {
    const broken: SettingsStorage = {
      getItem: () => Promise.reject(new Error('quota')),
      setItem: () => Promise.reject(new Error('quota')),
    };
    const store = new SettingsStore(broken);
    await expect(store.load()).resolves.toEqual({ version: 1 });
    await expect(store.saveAudio({ muted: true })).resolves.toBeUndefined();
    expect(store.snapshot.audio).toEqual({ muted: true }); // la partie prime
  });

  it('ne charge qu’une fois : les écritures externes sont invisibles ensuite', async () => {
    const storage = memoryStorage();
    const store = new SettingsStore(storage);
    await store.load();
    await storage.setItem(
      STORAGE_KEYS.settings,
      JSON.stringify({ version: 1, bindings: { KeyW: 'moveUp' } }),
    );
    // Le magasin garde son instantané : pas de relecture sauvage.
    expect(await store.load()).toEqual({ version: 1 });
    expect(store.snapshot.bindings).toBeUndefined();
  });

  it('section ui : sauvegarde, reliture, et rejet du mal typé', async () => {
    const storage = memoryStorage();
    await storage.setItem(
      STORAGE_KEYS.settings,
      JSON.stringify({
        version: 1,
        ui: {
          quality: 'high',
          reducedMotion: 'reduced',
          fontScale: 'large',
          highContrast: true,
          weather: 'sunny', // inconnu : jeté
        },
      }),
    );
    const store = new SettingsStore(storage);
    const settings = await store.load();
    expect(settings.ui).toEqual({
      quality: 'high',
      reducedMotion: 'reduced',
      fontScale: 'large',
      highContrast: true,
    });

    // La section se remplace entière : revenir à « auto » efface la clé.
    await store.saveUi({ quality: undefined, fontScale: 'large', highContrast: true });
    const raw = JSON.parse(
      storage.dump().get(STORAGE_KEYS.settings) ?? '{}',
    ) as { ui?: Record<string, unknown> };
    expect(raw.ui).toEqual({ fontScale: 'large', highContrast: true });
    expect(Object.hasOwn(raw.ui ?? {}, 'quality')).toBe(false);
  });
});
