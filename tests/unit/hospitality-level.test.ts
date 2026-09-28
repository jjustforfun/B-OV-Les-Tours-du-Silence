/**
 * hospitality-level.test.ts — solution automatique du chapitre 1.
 *
 * Le test prouve que la route directe reste fermée, que servir le voyageur est
 * obligatoire, puis simule la marche de Turpal jusqu'au but. Il verrouille
 * aussi les quatre positions, le secret inutile et l'absence exhaustive
 * d'impasse.
 */
import { Group, Vector3 } from 'three';
import { afterEach, describe, expect, it } from 'vitest';
import { EventBus } from '@core/EventBus';
import type { InputEvents, InputManager } from '@input/InputManager';
import { level as definition } from '@levels/01-hospitalite';
import { CameraRig } from '@render/CameraRig';
import { validateNoDeadEnds } from '@world/DeadEndValidator';
import { Level } from '@world/Level';
import { LevelRuntime } from '@world/LevelRuntime';
import { findPath } from '@world/Pathfinder';
import { Rotator } from '@world/mechanisms/Rotator';
import type { NodeId } from '@world/NavGraph';

const liveLevels: Level[] = [];

function buildLevel(): Level {
  const level = new Level(definition);
  liveLevels.push(level);
  return level;
}

function route(level: Level, from: NodeId, to: NodeId): readonly NodeId[] {
  const result = findPath(level.graph, from, to);
  return result.found ? result.path : [];
}

afterEach(() => {
  for (const level of liveLevels.splice(0)) level.dispose();
});

describe("Chapitre 1 — L'Hospitalité", () => {
  it('déclare une seule mécanique, la palette, le son et sept minutes', () => {
    expect(definition.palette).toBe('hospitalite');
    expect(definition.music).toEqual({
      mode: 'dorian',
      root: 'G3',
      strings: ['G3', 'D4', 'G4'],
    });
    expect(definition.ambience).toEqual(['wind', 'bells', 'fire']);
    expect(definition.durationMinutes).toEqual({ target: 7, min: 5, max: 12 });
    expect(definition.mechanisms).toHaveLength(1);
    expect(definition.mechanisms?.[0]).toMatchObject({
      id: 'hospitality-wheel',
      kind: 'rotator',
      params: { stepDeg: 90, steps: 4, initialStep: 0 },
    });
    expect(definition.edges.some((edge) => edge.illusory === true)).toBe(false);
  });

  it("interdit le raccourci et n'ouvre la route qu'après le voyageur", () => {
    const level = buildLevel();
    const wheel = level.mechanisms.get('hospitality-wheel');
    expect(wheel).toBeInstanceOf(Rotator);
    expect(route(level, definition.spawn, definition.goal)).toEqual([]);

    // Pointer directement vers Turpal ne suffit pas : le geste d'accueil manque.
    level.graph.setMechanismState('hospitality-wheel', 270);
    expect(route(level, definition.spawn, definition.goal)).toEqual([]);

    // La position nord lance le voyageur ; sa sortie verrouille le don accompli.
    level.graph.setMechanismState('hospitality-wheel', 90);
    expect(level.completeActor('wet-traveler')).toBe('traveler-served');
    expect(level.graph.getMechanismState('traveler-served')).toBe(true);

    level.graph.setMechanismState('hospitality-wheel', 270);
    expect(route(level, definition.spawn, definition.goal)).toEqual([
      'start',
      'plaza-path',
      'plaza',
      'wheel-stair-1',
      'wheel-stair-2',
      'wheel-stair-3',
      'wheel-stair-4',
      'wheel-hub',
      'wheel-control',
      'south-landing',
      'exit-stair-1',
      'exit-stair-2',
      'goal',
    ]);
  });

  it('verrouille la roue pendant la traversée puis valide réellement l’accueil', () => {
    const level = buildLevel();
    const wheel = level.mechanisms.get('hospitality-wheel');
    expect(wheel).toBeInstanceOf(Rotator);
    if (!(wheel instanceof Rotator)) return;

    const input = new EventBus<InputEvents>() as unknown as InputManager;
    const camera = new CameraRig(16 / 9).camera;
    const runtime = new LevelRuntime({
      level,
      sceneRoot: new Group(),
      camera,
      input,
      viewport: () => ({ width: 1920, height: 1080 }),
    });

    wheel.actuate(1);
    for (let frame = 0; frame < 10; frame += 1) runtime.update(frame * 0.1, 0.1);
    expect(wheel.interactive).toBe(false);
    expect(level.graph.getMechanismState('traveler-served')).toBe(false);

    for (let frame = 10; frame < 100; frame += 1) runtime.update(frame * 0.1, 0.1);
    expect(level.graph.getMechanismState('traveler-served')).toBe(true);
    expect(wheel.interactive).toBe(true);
    expect(level.root.getObjectByName('Story:HearthSmoke')?.visible).toBe(true);

    runtime.dispose();
    input.clear();
  });

  it('simule les taps de la solution et explore tous les états sans impasse', () => {
    const level = buildLevel();
    const visited: NodeId[] = [definition.spawn];
    let current: NodeId = definition.spawn;

    const tap = (target: NodeId): void => {
      const segment = findPath(level.graph, current, target);
      expect(segment.found, `${current} → ${target}`).toBe(true);
      visited.push(...segment.path.slice(1));
      current = target;
    };

    tap('wheel-control');
    level.graph.setMechanismState('hospitality-wheel', 90);
    level.completeActor('wet-traveler');
    level.graph.setMechanismState('hospitality-wheel', 270);
    tap('goal');

    expect(visited.at(-1)).toBe(definition.goal);
    expect(visited).toContain('south-landing');

    const report = validateNoDeadEnds(definition);
    expect(report.ok, JSON.stringify(report.violations)).toBe(true);
    // 3 états avant l'accueil + 4 positions après : l'état nord/non-servi
    // se clôt automatiquement par le trajet garanti du voyageur.
    expect(report.checkedMechanismStates).toBe(7);
    expect(report.checkedStates).toBe(67);
    expect(report.violations).toHaveLength(0);
  });

  it("ne montre l'aigle que dans la troisième position, hors solution", () => {
    const level = buildLevel();
    const secret = definition.secrets?.[0];
    expect(secret).toMatchObject({
      id: '01-hospitalite:eagle',
      node: 'eagle-secret',
      revealOnMechanism: { mechanism: 'hospitality-wheel', equals: 180 },
    });
    expect(level.isSecretPickable('eagle-secret')).toBe(false);
    expect(level.isSecretPickable('traveler-wait')).toBe(false);

    level.graph.setMechanismState('hospitality-wheel', 180);
    level.syncSecretsForMechanism('hospitality-wheel');
    expect(level.isSecretPickable('eagle-secret')).toBe(true);

    level.graph.setMechanismState('hospitality-wheel', 270);
    level.syncSecretsForMechanism('hospitality-wheel');
    expect(level.isSecretPickable('eagle-secret')).toBe(false);
    expect(definition.edges.some((edge) => edge.from === 'eagle-secret')).toBe(false);
  });

  it('attache réellement la passerelle au rotator et reste sous les budgets', () => {
    const level = buildLevel();
    const wheel = level.mechanisms.get('hospitality-wheel');
    expect(wheel).toBeInstanceOf(Rotator);
    if (!(wheel instanceof Rotator)) return;

    const bridge = wheel.root.getObjectByName('LevelBlock:bridge:hospitality-wheel');
    expect(bridge).toBeDefined();
    const before = new Vector3();
    const after = new Vector3();
    bridge?.getWorldPosition(before);

    wheel.actuate(1);
    wheel.update({ graph: level.graph, elapsed: 1 }, 1);
    bridge?.getWorldPosition(after);

    expect(after.distanceTo(before)).toBeGreaterThan(3);
    expect(level.towerRoots).toHaveLength(1);
    expect(level.estimatedDrawCalls).toBeLessThanOrEqual(24);
    expect(level.triangleCount).toBeLessThan(12_000);
  });
});
