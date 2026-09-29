/**
 * i18n.test.ts — repli et changement de langue sans rechargement.
 *
 * Le tchétchène est incomplet par honnêteté : chaque trou retombe sur le
 * français, jamais sur une clé brute. Ces tests figent ce contrat ainsi que
 * la garde DOM (le jeu doit rester testable en node, AGENTS.md § 9).
 */
import { describe, expect, it } from 'vitest';
import { i18n, LOCALES, isLocale } from '@/i18n/i18n';
import ce from '@/i18n/ce.json';
import fr from '@/i18n/fr.json';

describe('i18n', () => {
  it('quatre langues, isLocale reconnaît les siennes', () => {
    expect(LOCALES).toEqual(['fr', 'en', 'ru', 'ce']);
    expect(isLocale('ce')).toBe(true);
    expect(isLocale('de')).toBe(false);
  });

  it('le tchétchène retombe sur le français sans trou', async () => {
    await i18n.init('ce');
    expect(i18n.current).toBe('ce');
    // Clé réellement traduite en tchétchène…
    const ceKey = Object.keys(ce).find((key) => key !== '__status');
    expect(ceKey).toBeDefined();
    if (ceKey === undefined) return;
    expect(i18n.t(ceKey)).toBe((ce as Record<string, string>)[ceKey]);
    // …et une clé absente retombe sur le français, pas sur la clé brute.
    const missing = Object.keys(fr).find((key) => !(key in ce));
    expect(missing).toBeDefined();
    if (missing === undefined) return;
    expect(i18n.t(missing)).toBe((fr as Record<string, string>)[missing]);
  });

  it('ne montre jamais une entrée [À VÉRIFIER] : repli sur le français', async () => {
    await i18n.init('ce');
    const unverified = Object.entries(ce as Record<string, string>).filter(
      ([key, value]) => key !== '__status' && value.includes('[À VÉRIFIER]'),
    );
    expect(unverified.length).toBeGreaterThan(0);
    for (const [key] of unverified) {
      const shown = i18n.t(key);
      expect(shown).not.toContain('[À VÉRIFIER]');
      expect(shown).toBe((fr as Record<string, string>)[key]);
      expect(i18n.has(key)).toBe(false);
    }
    await i18n.setLocale('fr');
  });

  it('interpole les paramètres', async () => {
    await i18n.init('fr');
    expect(i18n.t('ui.chapter', { number: 3 })).toBe('Chapitre 3');
  });

  it('change de langue sans DOM et prévient ses abonnés', async () => {
    await i18n.init('fr');
    let notified = 0;
    const unsubscribe = i18n.onChange(() => {
      notified += 1;
    });
    await i18n.setLocale('en');
    expect(i18n.current).toBe('en');
    expect(notified).toBe(1);
    unsubscribe();
    await i18n.setLocale('en'); // pas de changement d'état, pas d'avis
    expect(notified).toBe(1);
    // Retour au français pour ne pas polluer les autres suites.
    await i18n.setLocale('fr');
  });
});
