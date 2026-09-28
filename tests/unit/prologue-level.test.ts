/**
 * prologue-level.test.ts — solution automatique du chapitre 0.
 *
 * Le test cadre le niveau comme le runtime, mesure l'illusion aux deux
 * viewports de référence, active sa liaison puis simule les trois taps de la
 * solution. Il verrouille aussi l'absence d'impasse, le secret optionnel et
 * les budgets de géométrie du chapitre.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { CameraRig } from '@render/CameraRig';
import { level as definition } from '@levels/00-prologue';
import { validateNoDeadEnds } from '@world/DeadEndValidator';
import { auditIllusions, ILLUSION_TOLERANCE_PX } from '@world/Illusion';
import { Level } from '@world/Level';
import { findPath } from '@world/Pathfinder';
import type { NodeId } from '@world/NavGraph';

const liveLevels: Level[] = [];

function buildProjectedLevel(width: number, height: number): Level {
  const level = new Level(definition);
  liveLevels.push(level);
  const rig = new CameraRig(width / height);
  rig.frameLevel(level.bounds.min, level.bounds.max, width / height, 0.1);
  rig.camera.updateMatrixWorld(true);
  rig.camera.matrixWorldInverse.copy(rig.camera.matrixWorld).invert();
  level.projectNodes(
    rig.camera.projectionMatrix.elements,
    rig.camera.matrixWorldInverse.elements,
    width,
    height,
  );
  return level;
}

function illusionAudit(level: Level) {
  const projections = new Map<NodeId, { readonly x: number; readonly y: number }>();
  for (const id of ['last-step', 'threshold'] as const) {
    projections.set(id, {
      x: level.nodeProjection.screenXOf(id),
      y: level.nodeProjection.screenYOf(id),
    });
  }
  return auditIllusions(projections, [{ a: 'last-step', b: 'threshold' }])[0];
}

function simulateTapSequence(level: Level, taps: readonly NodeId[]): readonly NodeId[] {
  const visited: NodeId[] = [definition.spawn];
  let current = definition.spawn;
  for (const target of taps) {
    const route = findPath(level.graph, current, target);
    expect(route.found, `${current} → ${target}`).toBe(true);
    for (const node of route.path.slice(1)) visited.push(node);
    current = target;
  }
  return visited;
}

afterEach(() => {
  for (const level of liveLevels.splice(0)) level.dispose();
});

describe('Chapitre 0 — Le Retour', () => {
  it('déclare la palette, le son, la durée et aucun mécanisme superflu', () => {
    expect(definition.palette).toBe('prologue');
    expect(definition.music).toEqual({
      mode: 'dorian',
      root: 'D3',
      strings: ['D3', 'A3', 'D4'],
    });
    expect(definition.ambience).toEqual(['wind', 'eagle', 'stone']);
    expect(definition.durationMinutes).toEqual({ target: 5, min: 5, max: 12 });
    expect(definition.mechanisms ?? []).toHaveLength(0);
  });

  it.each([
    ['desktop', 1920, 1080],
    ['mobile portrait', 390, 844],
  ])('aligne l’illusion à ≤ 6 px en %s', (_label, width, height) => {
    const level = buildProjectedLevel(width, height);
    const audit = illusionAudit(level);

    expect(audit?.reason).toBe('aligned');
    expect(audit?.screenDistance).toBeLessThanOrEqual(ILLUSION_TOLERANCE_PX);
    expect(audit?.screenDistance).toBeCloseTo(0, 5);
    expect(level.illusions.activeTotal).toBe(1);
    expect(level.graph.areConnected('last-step', 'threshold')).toBe(true);
  });

  it('simule la séquence de solution sans saut ni état bloquant', () => {
    const level = buildProjectedLevel(1920, 1080);
    const visited = simulateTapSequence(level, ['court', 'stair-3', 'threshold']);

    expect(visited).toEqual([
      'start',
      'path-1',
      'path-2',
      'court-gate',
      'court',
      'stair-1',
      'stair-2',
      'stair-3',
      'stair-4',
      'stair-5',
      'last-step',
      'threshold',
    ]);
    expect(visited.at(-1)).toBe(definition.goal);

    const report = validateNoDeadEnds(definition);
    expect(report.ok, JSON.stringify(report.violations)).toBe(true);
    expect(report.checkedStates).toBe(12);
    expect(report.checkedMechanismStates).toBe(1);
    expect(report.violations).toHaveLength(0);
  });

  it('garde l’aigle optionnel hors de la solution et le relie au carnet', () => {
    const secret = definition.secrets?.[0];
    expect(secret).toMatchObject({
      id: '00-prologue:eagle',
      kind: 'eagle',
      node: 'eagle-secret',
      revealOnNode: 'stair-3',
    });
    expect(definition.edges.some((edge) => edge.from === 'eagle-secret')).toBe(false);
    expect(
      definition.triggers?.some(
        (trigger) =>
          'node' in trigger.on &&
          trigger.on.node === 'eagle-secret' &&
          'eagleFound' in trigger.play,
      ),
    ).toBe(true);
  });

  it('reste très sous les budgets de rendu du niveau', () => {
    const level = new Level(definition);
    liveLevels.push(level);

    expect(level.towerRoots).toHaveLength(1);
    expect(level.estimatedDrawCalls).toBeLessThanOrEqual(20);
    expect(level.triangleCount).toBeLessThan(10_000);
    expect(level.bounds.max.y).toBeGreaterThan(25);
  });
});
