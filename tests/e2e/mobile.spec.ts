/**
 * mobile.spec.ts — le mobile est la cible de référence, pas un portage.
 *
 * Vérifie : pas de débordement horizontal, respect du viewport-fit=cover,
 * canvas plein écran en portrait comme en paysage, et absence de zoom
 * accidentel au double-tap (touch-action).
 */
import { expect, test } from '@playwright/test';

test.describe('Mobile', () => {
  test.skip(({ isMobile }) => !isMobile, 'Projets mobiles uniquement');

  test('remplit l’écran sans débordement', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('body')).toHaveAttribute('data-ready', 'true', { timeout: 30_000 });

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);

    const box = await page.locator('#game-canvas').boundingBox();
    const viewport = page.viewportSize();
    expect(box).not.toBeNull();
    expect(viewport).not.toBeNull();
    if (box && viewport) {
      expect(Math.abs(box.width - viewport.width)).toBeLessThanOrEqual(2);
      expect(Math.abs(box.height - viewport.height)).toBeLessThanOrEqual(2);
    }
  });

  test('désactive le zoom tactile sur le canvas', async ({ page }) => {
    await page.goto('/');
    const touchAction = await page.evaluate(() => {
      const canvas = document.querySelector('#game-canvas');
      return canvas === null ? '' : getComputedStyle(canvas).touchAction;
    });
    expect(touchAction).toBe('none');
  });

  test('déclare viewport-fit=cover pour les encoches', async ({ page }) => {
    await page.goto('/');
    const viewport = await page.getAttribute('meta[name="viewport"]', 'content');
    expect(viewport).toContain('viewport-fit=cover');
  });
});
