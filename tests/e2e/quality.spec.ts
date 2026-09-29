/**
 * quality.spec.ts — la qualité adaptative est réelle et observable.
 *
 * Le moteur expose son tier courant sur <html data-quality-tier> (ADR-013) :
 * chaque profil d'émulation (desktop, Pixel 5, iPhone 12…) doit démarrer sur
 * un tier valide et cohérent avec son matériel déclaré — conservateur sur
 * mobile, jamais figé sur un état invalide.
 */
import { expect, test } from '@playwright/test';

const VALID_TIERS = ['low', 'medium', 'high'];

test.describe('Qualité adaptative', () => {
  test('démarre sur un tier valide et l’expose au DOM', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });
    page.on('pageerror', (error) => errors.push(error.message));

    await page.goto('/');
    await expect(page.locator('body')).toHaveAttribute('data-ready', 'true', {
      timeout: 30_000,
    });

    const tier = await page.evaluate(() => document.documentElement.dataset.qualityTier);
    expect(VALID_TIERS).toContain(tier);
    expect(errors).toEqual([]);
  });

  test('reste conservateur sur mobile (jamais high au boot)', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'Garantie mobile uniquement');

    await page.goto('/');
    await expect(page.locator('body')).toHaveAttribute('data-ready', 'true', {
      timeout: 30_000,
    });

    // guessInitialTier : mobile → low ou medium, jamais high (Quality.ts).
    const tier = await page.evaluate(() => document.documentElement.dataset.qualityTier);
    expect(['low', 'medium']).toContain(tier);
  });
});
