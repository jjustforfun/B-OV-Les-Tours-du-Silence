/**
 * SettingsStore.ts — persistance des réglages sous `bov.settings.v1`.
 *
 * Un seul objet JSON pour tous les réglages (ADR-011) : remappage clavier,
 * volumes audio, haptique. Chaque système écrit sa section sans écraser les
 * autres — deux écrivains, une clé, donc un seul magasin.
 *
 * Tolérant par construction : une valeur illisible est ignorée en silence, on
 * ne bloque jamais une partie pour un réglage corrompu. Le stockage passe par
 * `Platform` (asynchrone déjà aujourd'hui, Capacitor demain) et est injectable
 * pour les tests.
 */
import { STORAGE_KEYS } from '@/config';
import { platform } from '@platform/Platform';

export interface StoredAudioSettings {
  readonly muted?: boolean;
  readonly volumes?: Readonly<Record<string, number>>;
}

export interface StoredSettings {
  readonly version: 1;
  readonly bindings?: Readonly<Record<string, string>>;
  readonly audio?: StoredAudioSettings;
  readonly haptics?: { readonly enabled?: boolean };
}

export interface SettingsStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}

const EMPTY_SETTINGS: StoredSettings = { version: 1 };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Ne conserve que la structure attendue — tout le reste est jeté sans bruit. */
function sanitize(raw: unknown): StoredSettings {
  if (!isRecord(raw)) return EMPTY_SETTINGS;
  const result: {
    version: 1;
    bindings?: Record<string, string>;
    audio?: StoredAudioSettings;
    haptics?: { enabled?: boolean };
  } = {
    version: 1,
  };

  const bindings = raw.bindings;
  if (isRecord(bindings)) {
    const kept: Record<string, string> = {};
    for (const [code, action] of Object.entries(bindings)) {
      if (typeof action === 'string' && action.length > 0) kept[code] = action;
    }
    if (Object.keys(kept).length > 0) result.bindings = kept;
  }

  const audio = raw.audio;
  if (isRecord(audio)) {
    const kept: { muted?: boolean; volumes?: Record<string, number> } = {};
    if (typeof audio.muted === 'boolean') kept.muted = audio.muted;
    const volumes = audio.volumes;
    if (isRecord(volumes)) {
      const keptVolumes: Record<string, number> = {};
      for (const [channel, value] of Object.entries(volumes)) {
        if (typeof value === 'number' && Number.isFinite(value)) keptVolumes[channel] = value;
      }
      if (Object.keys(keptVolumes).length > 0) kept.volumes = keptVolumes;
    }
    if (kept.muted !== undefined || kept.volumes !== undefined) result.audio = kept;
  }

  const haptics = raw.haptics;
  if (isRecord(haptics) && typeof haptics.enabled === 'boolean') {
    result.haptics = { enabled: haptics.enabled };
  }

  return result;
}

export class SettingsStore {
  private data: StoredSettings = EMPTY_SETTINGS;
  private loaded = false;

  constructor(private readonly storage: SettingsStorage = platform) {}

  /** Charge (une seule fois) puis retourne les réglages persistés. */
  async load(): Promise<StoredSettings> {
    if (this.loaded) return this.data;
    this.loaded = true;
    try {
      const raw = await this.storage.getItem(STORAGE_KEYS.settings);
      if (raw !== null) this.data = sanitize(JSON.parse(raw));
    } catch {
      /* JSON corrompu ou stockage indisponible : réglages neufs. */
    }
    return this.data;
  }

  get snapshot(): StoredSettings {
    return this.data;
  }

  /** Remplace la section bindings et persiste. */
  async saveBindings(bindings: Readonly<Record<string, string>>): Promise<void> {
    this.data = { ...this.data, bindings };
    await this.persist();
  }

  async saveAudio(audio: StoredAudioSettings): Promise<void> {
    this.data = { ...this.data, audio };
    await this.persist();
  }

  async saveHapticsEnabled(enabled: boolean): Promise<void> {
    this.data = { ...this.data, haptics: { enabled } };
    await this.persist();
  }

  private async persist(): Promise<void> {
    try {
      await this.storage.setItem(STORAGE_KEYS.settings, JSON.stringify(this.data));
    } catch {
      /* Mode privé / quota plein : la partie en cours prime sur le réglage. */
    }
  }
}
