/**
 * deadendvalidator.test.ts — aucun niveau ne doit enfermer Turpal.
 *
 * Le validateur explore les états étendus (position + mécanismes) : un passage
 * fermé au départ est acceptable si un mécanisme atteignable peut l'ouvrir,
 * mais un mécanisme absent ou impossible à atteindre devient une erreur.
 */
import { describe, expect, it } from 'vitest';
import { LEVEL_IDS, loadLevelDefinition } from '@levels/index';
import { level as penroseDemo } from '@levels/penrose-demo';
import {
  formatDeadEndReport,
  validateNoDeadEnds,
  type DeadEndValidationReport,
} from '@world/DeadEndValidator';
import type { LevelDefinition } from '@world/Level';

function expectValid(report: DeadEndValidationReport): void {
  expect(report.ok, formatDeadEndReport(report)).toBe(true);
}

function mechanismGateLevel(withMechanism: boolean): LevelDefinition {
  return {
    id: withMechanism ? 'gate-valid' : 'gate-missing-actuator',
    chapter: 0,
    virtue: 'prologue',
    titleKey: 'test.title',
    proverbKey: 'test.proverb',
    sky: 'dawn',
    spawn: 'start',
    goal: 'goal',
    nodes: [
      { id: 'start', at: [0, 0, 0], tags: ['spawn'] },
      { id: 'lever', at: [1, 0, 0], tags: ['mechanism:door'] },
      { id: 'goal', at: [2, 0, 0], tags: ['goal'] },
    ],
    edges: [{ from: 'start', to: 'lever' }],
    ...(withMechanism
      ? {
          mechanisms: [
            {
              id: 'door',
              kind: 'pressurePlate',
              at: [1, 0, 0],
              affects: [
                { from: 'lever', to: 'goal', condition: { mechanism: 'door', equals: true } },
              ],
            },
          ],
        }
      : {
          edges: [
            { from: 'start', to: 'lever' },
            { from: 'lever', to: 'goal', condition: { mechanism: 'door', equals: true } },
          ],
        }),
  };
}

describe('DeadEndValidator', () => {
  it('accepte un passage fermé si un mécanisme atteignable peut le rouvrir', () => {
    const report = validateNoDeadEnds(mechanismGateLevel(true));

    expectValid(report);
    expect(report.mechanisms).toEqual(['door']);
    expect(report.checkedMechanismStates).toBe(2);
  });

  it("échoue quand l'état requis n'a aucun mécanisme atteignable", () => {
    const report = validateNoDeadEnds(mechanismGateLevel(false));

    expect(report.ok).toBe(false);
    expect(report.violations.some((violation) => violation.reason === 'goal-unreachable')).toBe(
      true,
    );
  });

  it('valide la démo Penrose avec rotateur et chemin impossible', () => {
    const report = validateNoDeadEnds(penroseDemo);

    expectValid(report);
    expect(report.mechanisms).toEqual(['penrose-rotator']);
    expect(report.checkedMechanismStates).toBeGreaterThan(1);
  });

  for (const id of LEVEL_IDS) {
    it(`valide le niveau ${id}`, async () => {
      const definition = await loadLevelDefinition(id);
      expectValid(validateNoDeadEnds(definition));
    });
  }
});
