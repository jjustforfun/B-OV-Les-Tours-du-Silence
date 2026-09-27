/**
 * screen-move.test.ts — déplacement directionnel par direction à l'écran.
 *
 * docs/CONTROLS.md § 2.3 : la touche désigne une direction dans l'écran, on
 * retient le voisin projeté le plus proche (< 60°), à coût minimal en cas
 * d'égalité. Cône vide : rien ne se passe, aucune pénalité.
 */
import { describe, expect, it } from 'vitest';
import { pickNeighborByScreenDirection } from '@input/screenMove';

const origin = { x: 100, y: 100 };

describe('pickNeighborByScreenDirection', () => {
  it('suit la direction demandée (y écran vers le bas)', () => {
    const up = pickNeighborByScreenDirection(origin, { dx: 0, dy: 1 }, [
      { id: 'haut', x: 100, y: 40, cost: 1 },
      { id: 'bas', x: 100, y: 160, cost: 1 },
    ]);
    expect(up?.id).toBe('haut');
    expect(up?.angleDeg).toBeCloseTo(0, 6);

    const right = pickNeighborByScreenDirection(origin, { dx: 1, dy: 0 }, [
      { id: 'gauche', x: 40, y: 100, cost: 1 },
      { id: 'droite', x: 160, y: 100, cost: 1 },
    ]);
    expect(right?.id).toBe('droite');
  });

  it('choisit le voisin le mieux aligné dans le cône de 60°', () => {
    const result = pickNeighborByScreenDirection(origin, { dx: 0, dy: 1 }, [
      { id: 'oblique', x: 145, y: 55, cost: 1 }, // ~45° à droite du haut
      { id: 'pile', x: 100, y: 30, cost: 5 }, // pile dans l'axe, mais coûteux
    ]);
    expect(result?.id).toBe('pile'); // l'alignement prime sur le coût
  });

  it('départage les ex æquo par le coût de l’arête', () => {
    const result = pickNeighborByScreenDirection(origin, { dx: 0, dy: 1 }, [
      { id: 'cher', x: 100, y: 40, cost: 3 },
      { id: 'direct', x: 100, y: 40, cost: 1 },
    ]);
    expect(result?.id).toBe('direct');
  });

  it('ignore ce qui sort du cône (≥ 90° ou > 60°)', () => {
    expect(
      pickNeighborByScreenDirection(origin, { dx: 0, dy: 1 }, [
        { id: 'derrière', x: 100, y: 160, cost: 1 }, // angle > 90°
        // 65° à droite du haut : sin(65°) ≈ 0,906, cos(65°) ≈ 0,423 (écran y bas).
        { id: 'trop-de-côté', x: 100 + 72.5, y: 100 - 33.8, cost: 1 },
      ]),
    ).toBeNull();
  });

  it('répond null sans candidat ni intention', () => {
    expect(pickNeighborByScreenDirection(origin, { dx: 0, dy: 1 }, [])).toBeNull();
    expect(
      pickNeighborByScreenDirection(origin, { dx: 0, dy: 0 }, [{ id: 'a', x: 0, y: 0, cost: 1 }]),
    ).toBeNull();
    // Un candidat confondu avec l'origine ne compte pas non plus.
    expect(
      pickNeighborByScreenDirection(origin, { dx: 0, dy: 1 }, [
        { id: 'la', x: 100, y: 100, cost: 1 },
      ]),
    ).toBeNull();
  });
});
