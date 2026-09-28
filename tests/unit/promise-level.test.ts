/**
 * promise-level.test.ts — solution automatique du chapitre 2.
 *
 * Le test suit les trois transferts du même jeu de dalles, prouve que le
 * raccourci doit disparaître avant que le pont promis existe, puis explore
 * exhaustivement les quatre crans afin d'exclure toute impasse.
 */
import { Group, Vector3, type Object3D } from 'three';
import { afterEach, describe, expect, it } from 'vitest';
import { bus, EventBus } from '@core/EventBus';
import type { InputEvents, InputManager } from '@input/InputManager';
import { level as definition } from '@levels/02-parole';
import { CameraRig } from '@render/CameraRig';
import { validateNoDeadEnds } from '@world/DeadEndValidator';
import { Level } from '@world/Level';
import { LevelRuntime } from '@world/LevelRuntime';
import type { NodeId } from '@world/NavGraph';
import { findPath } from '@world/Pathfinder';
import { Slider } from '@world/mechanisms/Slider';

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

function stagedStones(slider: Slider): readonly Object3D[] {
  const stones: Object3D[] = [];
  slider.root.traverse((object) => {
    if (object.name === 'LevelBlock:bridge:promise-slider') stones.push(object);
  });
  return stones.sort((a, b) => a.position.x - b.position.x);
}

afterEach(() => {
  bus.clear();
  for (const level of liveLevels.splice(0)) level.dispose();
});

describe('Chapitre 2 — La Parole donnée', () => {
  it('déclare une mécanique, la palette, le mode éolien et huit minutes', () => {
    expect(definition.palette).toBe('parole');
    expect(definition.music).toEqual({
      mode: 'aeolian',
      root: 'A2',
      strings: ['A2', 'E3', 'A3'],
    });
    expect(definition.ambience).toEqual(['wind', 'river']);
    expect(definition.durationMinutes).toEqual({ target: 8, min: 5, max: 12 });
    expect(definition.mechanisms).toHaveLength(1);
    expect(definition.mechanisms?.[0]).toMatchObject({
      id: 'promise-slider',
      kind: 'slider',
    });
    expect(definition.mechanisms?.[0]?.params).toMatchObject({ stops: 4, initial: 0 });
    expect(definition.edges.some((edge) => edge.illusory === true)).toBe(false);
  });

  it('emploie exactement les trois mêmes dalles pour le raccourci et le pont', () => {
    const blocks = definition.geometry?.filter((block) => block.parent === 'promise-slider') ?? [];
    expect(blocks).toHaveLength(3);
    expect(blocks.map((block) => block.moveStage)).toEqual([1, 2, 3]);
    expect(blocks.map((block) => block.at)).toEqual([
      [-3, 3.22, 3.8],
      [0, 3.22, 3.8],
      [3, 3.22, 3.8],
    ]);
    expect(blocks.map((block) => block.moveTo)).toEqual([
      [-3, 3.22, 0.4],
      [0, 3.22, 0.4],
      [3, 3.22, 0.4],
    ]);
  });

  it('ferme le raccourci et transfère une seule dalle à chacun des trois crans', () => {
    const level = buildLevel();
    const slider = level.mechanisms.get('promise-slider');
    expect(slider).toBeInstanceOf(Slider);
    if (!(slider instanceof Slider)) return;

    const anchor = slider.root.position.clone();
    const stones = stagedStones(slider);
    expect(stones).toHaveLength(3);
    expect(route(level, 'shortcut-mouth', 'shortcut-far')).toEqual([
      'shortcut-mouth',
      'shortcut-far',
    ]);
    expect(level.isMechanismActuatorNode('promise-slider', 'promise-stone')).toBe(true);
    expect(level.isMechanismActuatorNode('promise-slider', 'shortcut-far')).toBe(false);
    expect(route(level, definition.spawn, definition.goal)).toEqual([]);

    for (let stop = 1; stop <= 3; stop += 1) {
      slider.actuate();
      slider.update({ graph: level.graph, elapsed: stop }, 0.9);
      expect(slider.root.position).toEqual(anchor);
      expect(level.graph.getMechanismState('promise-slider')).toBe(stop);

      stones.forEach((stone, index) => {
        const world = stone.getWorldPosition(new Vector3());
        expect(world.z).toBeCloseTo(index < stop ? 0.4 : 3.8, 4);
      });
    }

    expect(route(level, 'shortcut-mouth', 'shortcut-far')).toEqual([]);
    expect(route(level, definition.spawn, definition.goal)).toEqual([
      'start',
      'west-path',
      'promise-stone',
      'child-side',
      'east-path',
      'goal',
    ]);
  });

  it("fait se lever l'enfant une seule fois quand le pont devient franchissable", () => {
    const level = buildLevel();
    const slider = level.mechanisms.get('promise-slider');
    expect(slider).toBeInstanceOf(Slider);
    if (!(slider instanceof Slider)) return;

    const input = new EventBus<InputEvents>() as unknown as InputManager;
    const runtime = new LevelRuntime({
      level,
      sceneRoot: new Group(),
      camera: new CameraRig(16 / 9).camera,
      input,
      viewport: () => ({ width: 1920, height: 1080 }),
    });
    let laughs = 0;
    let connections = 0;
    bus.on('child:bridgeReady', () => {
      laughs += 1;
    });
    bus.on('path:connected', () => {
      connections += 1;
    });

    for (let stop = 1; stop <= 3; stop += 1) {
      slider.actuate();
      runtime.update(stop, 0.9);
    }
    runtime.update(4, 0.7);

    expect(level.root.getObjectByName('Child:waiting-child')).toBeDefined();
    expect(laughs).toBe(1);
    expect(connections).toBe(1);

    slider.actuate(-1);
    runtime.update(5, 0.9);
    slider.actuate(1);
    runtime.update(6, 0.9);
    expect(laughs).toBe(1);

    runtime.dispose();
    input.clear();
  });

  it('simule la solution et explore exhaustivement les quatre crans sans impasse', () => {
    const level = buildLevel();
    const visited: NodeId[] = [definition.spawn];
    let current: NodeId = definition.spawn;
    const tap = (target: NodeId): void => {
      const segment = findPath(level.graph, current, target);
      expect(segment.found, `${current} → ${target}`).toBe(true);
      visited.push(...segment.path.slice(1));
      current = target;
    };

    tap('promise-stone');
    for (const stop of [1, 2, 3]) level.graph.setMechanismState('promise-slider', stop);
    tap('goal');

    expect(visited.at(-1)).toBe(definition.goal);
    expect(visited).toContain('child-side');

    const report = validateNoDeadEnds(definition);
    expect(report.ok, JSON.stringify(report.violations)).toBe(true);
    expect(report.checkedMechanismStates).toBe(4);
    expect(report.checkedStates).toBe(36);
    expect(report.violations).toHaveLength(0);
  });

  it("cache l'aigle sous le pont sur la rive basse, hors de la solution", () => {
    const level = buildLevel();
    expect(definition.secrets?.[0]).toMatchObject({
      id: '02-parole:eagle',
      node: 'eagle-secret',
      revealOnNode: 'lower-bank',
    });
    expect(level.isSecretPickable('eagle-secret')).toBe(false);
    expect(route(level, definition.spawn, 'lower-bank')).toEqual([
      'start',
      'west-path',
      'lower-step-1',
      'lower-step-2',
      'lower-step-3',
      'lower-bank',
    ]);

    level.revealSecretsForNode('lower-bank');
    expect(level.isSecretPickable('eagle-secret')).toBe(true);
    expect(definition.edges.some((edge) => edge.from === 'eagle-secret')).toBe(false);
  });

  it.each([
    ['desktop', 1920, 1080],
    ['mobile portrait', 390, 844],
  ])('garde les treize nœuds visibles en %s', (_label, width, height) => {
    const level = buildLevel();
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

    expect(level.graph.nodeCount).toBe(13);
    for (const node of level.graph.allNodes()) {
      expect(level.nodeProjection.isVisible(node.id), node.id).toBe(true);
    }
  });

  it('reste sous les budgets de rendu malgré deux tours et le torrent', () => {
    const level = buildLevel();
    expect(level.towerRoots).toHaveLength(2);
    expect(level.estimatedDrawCalls).toBeLessThanOrEqual(24);
    expect(level.triangleCount).toBeLessThan(12_000);
  });
});
