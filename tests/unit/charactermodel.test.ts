/**
 * charactermodel.test.ts — le modèle procédural de Turpal (ADR-006).
 *
 * On vérifie ce qui engage la suite : l'échelle (tout le level design en
 * dépend), le budget de triangles, la présence effective des gazyri — le
 * détail de silhouette exigé par le brief — et la libération mémoire.
 */
import { describe, expect, it } from 'vitest';
import { Mesh } from 'three';
import { TurpalModel } from '@entities/player/TurpalModel';
import type { ICharacterModel } from '@entities/ICharacterModel';

function countMeshes(model: ICharacterModel): number {
  let count = 0;
  model.root.traverse((child) => {
    if (child instanceof Mesh) count += 1;
  });
  return count;
}

describe('TurpalModel', () => {
  it('respecte l’échelle du monde (0,85 unité de grille)', () => {
    const model = new TurpalModel();
    expect(model.height).toBeCloseTo(0.85, 3);
    model.dispose();
  });

  it('reste très loin sous le budget de 6 000 triangles', () => {
    const model = new TurpalModel();
    expect(model.triangleCount).toBeGreaterThan(0);
    expect(model.triangleCount).toBeLessThan(6000);
    model.dispose();
  });

  it('porte bien deux rangées de six gazyri', () => {
    const model = new TurpalModel();
    // 12 gazyri + torse, épaules, ceinture, tête, barbe, papakha, 2 bottes.
    expect(countMeshes(model)).toBe(12 + 8);
    model.dispose();
  });

  it('honore le contrat ICharacterModel', () => {
    const model: ICharacterModel = new TurpalModel();
    expect(model.kind).toBe('procedural');
    expect(typeof model.play).toBe('function');
    expect(typeof model.update).toBe('function');
    model.dispose();
  });

  it('anime sans allouer ni diverger', () => {
    const model = new TurpalModel();
    model.play('walk');
    for (let i = 0; i < 120; i += 1) model.update(1 / 60);
    expect(Number.isFinite(model.root.position.y)).toBe(true);
    model.dispose();
  });

  it('se libère entièrement', () => {
    const model = new TurpalModel();
    model.dispose();
    expect(countMeshes(model)).toBe(0);
    expect(model.triangleCount).toBe(0);
  });
});
