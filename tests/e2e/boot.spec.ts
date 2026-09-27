/**
 * boot.spec.ts — le jeu démarre vraiment.
 *
 * C'est le test le plus important du dépôt : il attrape les régressions qui
 * ne se voient ni au typecheck ni au lint — contexte WebGL refusé, erreur
 * d'exécution au démarrage, écran de chargement qui ne s'efface jamais.
 */
import { expect, test } from '@playwright/test';

test.describe('Démarrage', () => {
  test('affiche le canvas et efface l’écran de chargement', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });
    page.on('pageerror', (error) => errors.push(error.message));

    await page.goto('/');

    const canvas = page.locator('#game-canvas');
    await expect(canvas).toBeVisible();

    // main.ts pose data-ready après la première image rendue.
    await expect(page.locator('body')).toHaveAttribute('data-ready', 'true', { timeout: 20_000 });
    await expect(page.locator('#boot')).toBeHidden();
    expect(errors).toEqual([]);
  });

  test('rend réellement quelque chose (le canvas n’est pas vide)', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('body')).toHaveAttribute('data-ready', 'true', { timeout: 20_000 });

    const isPainted = await page.evaluate(() => {
      const canvas = document.querySelector<HTMLCanvasElement>('#game-canvas');
      return canvas !== null && canvas.width > 0 && canvas.height > 0;
    });
    expect(isPainted).toBe(true);
  });

  test('déclare une PWA installable', async ({ page }) => {
    await page.goto('/');
    const manifestHref = await page.getAttribute('link[rel="manifest"]', 'href');
    expect(manifestHref).toBeTruthy();

    const themeColor = await page.getAttribute('meta[name="theme-color"]', 'content');
    expect(themeColor).toBe('#0d1117');
  });
});
