/**
 * memory.spec.ts — « zéro fuite mémoire entre niveaux » (Definition of Done).
 *
 * Ouvre le harnais `?memcheck` (src/debug/MemoryCheck.ts) : huit chapitres
 * chargés, rendus puis déchargés trois fois dans un vrai contexte WebGL,
 * `renderer.info.memory` comparé à un point de référence pris après un cycle
 * d'échauffement (caches partagés pleins). Une seule exécution desktop suffit :
 * la mesure est indépendante du viewport.
 */
import { expect, test } from '@playwright/test';

interface MemorySnapshot {
  readonly geometries: number;
  readonly textures: number;
  readonly programs: number;
}

interface MemoryCheckReport {
  readonly baseline: MemorySnapshot;
  readonly cycles: readonly MemorySnapshot[];
  readonly final: MemorySnapshot;
  readonly leaked: boolean;
  readonly transitions: number;
}

test.describe('Fuite mémoire entre niveaux', () => {
  test.skip(({ isMobile }) => !!isMobile, 'Mesure desktop uniquement (indépendante du viewport)');

  test('renderer.info revient au point de référence après 8 niveaux × 3 cycles', async ({
    page,
  }) => {
    test.setTimeout(360_000);
    await page.goto('/?memcheck');

    // Le harnais pose data-memcheck en fin de mesure (clean | leaked).
    await expect(page.locator('body')).toHaveAttribute('data-memcheck', /^(clean|leaked)$/, {
      timeout: 300_000,
    });

    const report = await page.evaluate<MemoryCheckReport | undefined>(
      () => (window as { __BOV_MEMCHECK__?: MemoryCheckReport }).__BOV_MEMCHECK__,
    );
    expect(report).toBeDefined();
    if (!report) return;

    expect(report.transitions).toBe(24);
    expect(report.cycles).toHaveLength(3);

    // Le critère : geometries et textures reviennent exactement au niveau
    // du point de référence — rien ne s'accumule cycle après cycle.
    expect(report.final.geometries).toBe(report.baseline.geometries);
    expect(report.final.textures).toBe(report.baseline.textures);
    expect(report.leaked).toBe(false);

    // Les programmes shaders sont un cache volontaire : ils peuvent avoir été
    // complétés pendant l'échauffement mais ne doivent plus croître ensuite.
    for (const cycle of report.cycles) {
      expect(cycle.programs).toBeLessThanOrEqual(report.baseline.programs);
    }
  });
});
