/**
 * i18n.ts — internationalisation minimaliste.
 *
 * Le jeu contient très peu de texte : un système complet serait du poids
 * pour rien. Ici : un dictionnaire plat par langue, chargé dynamiquement,
 * avec repli sur le français (langue de référence de l'écriture).
 *
 * Langues : fr (référence), en, ru, ce (tchétchène).
 * Le tchétchène est incomplet par honnêteté : une traduction approximative
 * serait un manque de respect. Les entrées manquantes retombent sur le
 * français, et les entrées non validées portent la marque [À VÉRIFIER]
 * jusqu'à relecture par un locuteur natif (voir docs/CULTURE.md).
 */
import { STORAGE_KEYS } from '@/config';
import { platform } from '@platform/Platform';

export const LOCALES = ['fr', 'en', 'ru', 'ce'] as const;
export type Locale = (typeof LOCALES)[number];

export const LOCALE_NAMES: Readonly<Record<Locale, string>> = {
  fr: 'Français',
  en: 'English',
  ru: 'Русский',
  ce: 'Нохчийн мотт',
};

export type Dictionary = Readonly<Record<string, string>>;

const LOADERS: Readonly<Record<Locale, () => Promise<{ default: Dictionary }>>> = {
  fr: () => import('./fr.json'),
  en: () => import('./en.json'),
  ru: () => import('./ru.json'),
  ce: () => import('./ce.json'),
};

export class I18n {
  private locale: Locale = 'fr';
  private dictionary: Dictionary = {};
  private fallback: Dictionary = {};
  private initialized = false;
  private readonly listeners = new Set<() => void>();

  get current(): Locale {
    return this.locale;
  }

  /** Prévenu à chaque changement de langue (les panneaux se réétiquettent). */
  onChange(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  async init(preferred?: Locale): Promise<void> {
    this.fallback = (await LOADERS.fr()).default;
    const stored = await platform.getItem(STORAGE_KEYS.locale);
    const detected = preferred ?? (isLocale(stored) ? stored : detectLocale());
    await this.setLocale(detected);
  }

  async setLocale(locale: Locale): Promise<void> {
    // Re-sélectionner la langue affichée ne fait rien : pas de rechargement
    // de dictionnaire, pas d'avis redondant aux panneaux.
    if (this.initialized && this.locale === locale) return;
    this.locale = locale;
    this.dictionary = locale === 'fr' ? this.fallback : (await LOADERS[locale]()).default;
    this.initialized = true;
    await platform.setItem(STORAGE_KEYS.locale, locale);
    // Garde Node/worker (tests unitaires, SSR de prérendu) : le DOM n'existe
    // pas toujours (AGENTS.md § 9).
    if (typeof document !== 'undefined') document.documentElement.lang = locale;
    for (const listener of this.listeners) listener();
  }

  /**
   * Traduit une clé. Les valeurs manquantes retombent sur le français, puis
   * sur la clé. Une entrée encore marquée [À VÉRIFIER] n'est JAMAIS affichée
   * (Definition of Done : « plus aucun [À VÉRIFIER] dans du contenu
   * affiché ») : elle retombe sur le français jusqu'à validation par un
   * locuteur natif — la donnée reste dans le dictionnaire, en attente.
   */
  t(key: string, params?: Readonly<Record<string, string | number>>): string {
    const template = this.resolve(key) ?? key;
    if (!params) return template;

    return template.replace(/\{(\w+)\}/g, (match, name: string) => {
      const value = params[name];
      return value === undefined ? match : String(value);
    });
  }

  /** Vrai si la clé est réellement traduite (et validée) dans la langue courante. */
  has(key: string): boolean {
    const value = this.dictionary[key];
    return value !== undefined && !value.includes(UNVERIFIED_MARK);
  }

  /** Valeur affichable : dictionnaire courant, puis français — jamais [À VÉRIFIER]. */
  private resolve(key: string): string | undefined {
    const current = this.dictionary[key];
    if (current !== undefined && !current.includes(UNVERIFIED_MARK)) return current;
    const fallback = this.fallback[key];
    if (fallback !== undefined && !fallback.includes(UNVERIFIED_MARK)) return fallback;
    return undefined;
  }
}

/** Marque des entrées en attente de relecture native (voir docs/CULTURE.md). */
const UNVERIFIED_MARK = '[À VÉRIFIER]';

export function isLocale(value: string | null): value is Locale {
  return value !== null && (LOCALES as readonly string[]).includes(value);
}

export function detectLocale(): Locale {
  if (typeof navigator === 'undefined') return 'fr';
  for (const candidate of navigator.languages ?? [navigator.language]) {
    const base = candidate.slice(0, 2).toLowerCase();
    if (isLocale(base)) return base;
  }
  return 'fr';
}

/** Instance partagée. */
export const i18n = new I18n();
