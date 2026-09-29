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
    // Le fondu de 900 ms peut s'étirer à ~20 s en rendu logiciel (SwiftShader
    // en CI sans GPU) : la chronologie d'animation avance par frame committée.
    await expect(page.locator('#boot')).toBeHidden({ timeout: 30_000 });
    expect(errors).toEqual([]);
  });

  test('rend réellement quelque chose (le canvas n’est pas vide)', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('body')).toHaveAttribute('data-ready', 'true', { timeout: 20_000 });

    // Régression v1.0.0 : le composer écrasait le style CSS du canvas et le
    // jeu rendait UN pixel (canvas.width === 1 passait « > 0 »). Le tampon
    // de dessin doit couvrir le viewport, pas seulement exister.
    const size = await page.evaluate(() => {
      const canvas = document.querySelector<HTMLCanvasElement>('#game-canvas');
      if (canvas === null) return null;
      return {
        buffer: [canvas.width, canvas.height],
        client: [canvas.clientWidth, canvas.clientHeight],
        viewport: [window.innerWidth, window.innerHeight],
      };
    });
    expect(size).not.toBeNull();
    if (!size) return;
    // Le canvas occupe tout le viewport (à 2 px près)…
    expect(Math.abs(size.client[0]! - size.viewport[0]!)).toBeLessThanOrEqual(2);
    expect(Math.abs(size.client[1]! - size.viewport[1]!)).toBeLessThanOrEqual(2);
    // …et son tampon de dessin est au moins aussi grand (dpr ≥ 1).
    expect(size.buffer[0]!).toBeGreaterThanOrEqual(size.client[0]! - 2);
    expect(size.buffer[1]!).toBeGreaterThanOrEqual(size.client[1]! - 2);
  });

  test('déclare une PWA installable', async ({ page }) => {
    await page.goto('/');
    const manifestHref = await page.getAttribute('link[rel="manifest"]', 'href');
    expect(manifestHref).toBeTruthy();

    const themeColor = await page.getAttribute('meta[name="theme-color"]', 'content');
    expect(themeColor).toBe('#0d1117');
  });
});
