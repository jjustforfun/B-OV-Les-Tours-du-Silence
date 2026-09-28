/**
 * elders-level.test.ts — solution automatique du chapitre 3.
 *
 * Le test prouve la coopération avec Borz, les trois abaissements successifs,
 * l'alignement exact des tours jumelles et l'arrivée autonome de l'ancien. Il
 * explore ensuite tous les états atteignables afin d'exclure toute impasse.
 */
import { Group, Vector3, type Object3D } from 'three';
import { afterEach, describe, expect, it } from 'vitest';
import { bus, EventBus } from '@core/EventBus';
import { Borz } from '@entities/companion/Borz';
import type { InputEvents, InputManager } from '@input/InputManager';
import { level as definition } from '@levels/03-anciens';
import { CameraRig } from '@render/CameraRig';
import { validateNoDeadEnds } from '@world/DeadEndValidator';
import { auditIllusions, ILLUSION_TOLERANCE_PX } from '@world/Illusion';
import { Level } from '@world/Level';
import { LevelRuntime } from '@world/LevelRuntime';
import type { NodeId } from '@world/NavGraph';
import { findPath } from '@world/Pathfinder';
import { PressurePlate } from '@world/mechanisms/PressurePlate';

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

function project(level: Level, width: number, height: number): void {
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
}

function stagedBridges(plate: PressurePlate): Object3D[] {
  const entries: Object3D[] = [];
  plate.root.traverse((object) => {
    if (object.name === 'LevelBlock:bridge:elder-plate-c') entries.push(object);
  });
  return entries.sort((a, b) => a.position.x - b.position.x);
}

afterEach(() => {
  bus.clear();
  for (const level of liveLevels.splice(0)) level.dispose();
});

describe('Chapitre 3 — Le Respect des anciens', () => {
  it('déclare le sépia, Do dorien, les cloches et neuf minutes', () => {
    expect(definition.palette).toBe('anciens');
    expect(definition.music).toEqual({
      mode: 'dorian',
      root: 'C3',
      strings: ['C3', 'G3', 'C4'],
    });
    expect(definition.ambience).toEqual(['wind', 'bells']);
    expect(definition.durationMinutes).toEqual({ target: 9, min: 5, max: 12 });
    expect(definition.mechanisms).toHaveLength(3);
    expect(new Set(definition.mechanisms?.map((mechanism) => mechanism.kind))).toEqual(
      new Set(['pressurePlate']),
    );
  });

  it('réserve la deuxième dalle à Borz et garde sa coopération solvable', () => {
    const level = buildLevel();
    expect(route(level, definition.spawn, 'plate-b')).toEqual([]);
    expect(level.graph.getNode('plate-b')?.tags.has('borz')).toBe(true);
    expect(level.graph.getNode('plate-a')?.tags.has('cooperator:elder-plate-b')).toBe(true);

    const borz = new Borz();
    borz.placeAt(level.graph, 'borz-start');
    borz.rebuildOwnGraph(level.graph);
    expect(findPath(borz.ownGraph, 'borz-start', 'plate-b').found).toBe(false);

    level.graph.setMechanismState('elder-plate-a', true);
    borz.rebuildOwnGraph(level.graph);
    expect(findPath(borz.ownGraph, 'borz-start', 'plate-b').path).toEqual([
      'borz-start',
      'borz-mid',
      'plate-b',
    ]);
    borz.dispose();
  });

  it('abaisse les travées sans déplacer les ancres et cascade le dernier palier', () => {
    const level = buildLevel();
    const plateA = level.mechanisms.get('elder-plate-a');
    const plateC = level.mechanisms.get('elder-plate-c');
    expect(plateA).toBeInstanceOf(PressurePlate);
    expect(plateC).toBeInstanceOf(PressurePlate);
    if (!(plateA instanceof PressurePlate) || !(plateC instanceof PressurePlate)) return;

    const anchorA = plateA.root.position.clone();
    const sectionA = plateA.root.getObjectByName('LevelBlock:platform:elder-plate-a');
    expect(sectionA?.getWorldPosition(new Vector3()).y).toBeCloseTo(5.4, 4);
    plateA.setOccupied(true);
    plateA.update({ graph: level.graph, elapsed: 0.9 }, 0.9);
    expect(plateA.root.position).toEqual(anchorA);
    expect(sectionA?.getWorldPosition(new Vector3()).y).toBeCloseTo(3.15, 4);

    const bridges = stagedBridges(plateC);
    expect(bridges).toHaveLength(3);
    plateC.setOccupied(true);
    plateC.update({ graph: level.graph, elapsed: 0.675 }, 0.675);
    const halfway = bridges.map((bridge) => bridge.getWorldPosition(new Vector3()).y);
    expect(halfway[0]).toBeCloseTo(3.15, 4);
    expect(halfway[1]).toBeGreaterThan(3.15);
    expect(halfway[1]).toBeLessThan(4.2);
    expect(halfway[2]).toBeCloseTo(4.2, 4);

    plateC.update({ graph: level.graph, elapsed: 1.35 }, 0.675);
    for (const bridge of bridges) {
      expect(bridge.getWorldPosition(new Vector3()).y).toBeCloseTo(3.15, 4);
    }
    expect(level.graph.getMechanismState('elder-plate-c')).toBe(true);
  });

  it.each([
    ['desktop', 1920, 1080],
    ['mobile portrait', 390, 844],
  ])('superpose les portes des tours à ≤ 6 px en %s', (_label, width, height) => {
    const level = buildLevel();
    project(level, width, height);
    const projections = new Map([
      [
        'twin-a-door',
        {
          x: level.nodeProjection.screenXOf('twin-a-door'),
          y: level.nodeProjection.screenYOf('twin-a-door'),
        },
      ],
      [
        'twin-b-door',
        {
          x: level.nodeProjection.screenXOf('twin-b-door'),
          y: level.nodeProjection.screenYOf('twin-b-door'),
        },
      ],
    ]);
    const audit = auditIllusions(projections, [{ a: 'twin-a-door', b: 'twin-b-door' }])[0];

    expect(audit?.reason).toBe('aligned');
    expect(audit?.screenDistance).toBeLessThanOrEqual(ILLUSION_TOLERANCE_PX);
    expect(audit?.screenDistance).toBeCloseTo(0, 4);
    expect(level.illusions.activeTotal).toBe(1);
    expect(level.graph.nodeCount).toBe(18);
    for (const node of level.graph.allNodes()) {
      expect(level.nodeProjection.isVisible(node.id), node.id).toBe(true);
    }
  });

  it("fait avancer l'ancien par étapes puis indique la route finale", () => {
    const level = buildLevel();
    const plateA = level.mechanisms.get('elder-plate-a');
    const plateB = level.mechanisms.get('elder-plate-b');
    const plateC = level.mechanisms.get('elder-plate-c');
    if (
      !(plateA instanceof PressurePlate) ||
      !(plateB instanceof PressurePlate) ||
      !(plateC instanceof PressurePlate)
    )
      return;

    const input = new EventBus<InputEvents>() as unknown as InputManager;
    const rig = new CameraRig(16 / 9);
    rig.frameLevel(level.bounds.min, level.bounds.max, 16 / 9, 0.1);
    const runtime = new LevelRuntime({
      level,
      sceneRoot: new Group(),
      camera: rig.camera,
      input,
      viewport: () => ({ width: 1920, height: 1080 }),
    });
    let arrivals = 0;
    bus.on('elder:arrived', () => {
      arrivals += 1;
    });

    plateA.setOccupied(true);
    runtime.update(1, 0.9);
    plateB.setOccupied(true);
    runtime.update(2, 0.9);
    plateC.setOccupied(true);
    runtime.update(3, 1.35);
    expect(level.graph.getMechanismState('elder-crossed')).toBe(false);

    for (let frame = 0; frame < 420; frame += 1) runtime.update(4 + frame * 0.1, 0.1);
    runtime.update(47, 0.1);

    expect(level.graph.getMechanismState('elder-crossed')).toBe(true);
    expect(arrivals).toBe(1);
    expect(level.root.getObjectByName('Actor:Elder:nikaroy-elder')).toBeDefined();
    expect(route(level, definition.spawn, definition.goal).at(-1)).toBe(definition.goal);

    runtime.dispose();
    input.clear();
  });

  it('simule la solution et explore exhaustivement les états sans impasse', () => {
    const level = buildLevel();
    project(level, 1920, 1080);
    expect(route(level, definition.spawn, definition.goal)).toEqual([]);

    level.graph.setMechanismState('elder-plate-a', true);
    level.graph.setMechanismState('elder-plate-b', true);
    level.graph.setMechanismState('elder-plate-c', true);
    expect(level.completeActor('nikaroy-elder')).toBe('elder-crossed');
    project(level, 1920, 1080);

    expect(route(level, definition.spawn, definition.goal)).toEqual([
      'start',
      'high-path',
      'plate-a',
      'descent-1',
      'descent-2',
      'descent-3',
      'plate-c',
      'twin-a-door',
      'twin-b-door',
      'elder-end',
      'goal',
    ]);

    const report = validateNoDeadEnds(definition);
    expect(report.ok, JSON.stringify(report.violations)).toBe(true);
    expect(report.checkedMechanismStates).toBe(15);
    expect(report.checkedStates).toBe(77);
    expect(report.violations).toHaveLength(0);
  });

  it("ne révèle l'aigle à hauteur de l'ancien qu'après le dernier abaissement", () => {
    const level = buildLevel();
    expect(definition.secrets?.[0]).toMatchObject({
      id: '03-anciens:eagle',
      node: 'eagle-secret',
      revealOnMechanism: { mechanism: 'elder-plate-c', equals: true },
    });
    expect(level.isSecretPickable('eagle-secret')).toBe(false);

    level.graph.setMechanismState('elder-plate-c', true);
    level.syncSecretsForMechanism('elder-plate-c');
    expect(level.isSecretPickable('eagle-secret')).toBe(true);
    expect(definition.edges.some((edge) => edge.from === 'eagle-secret')).toBe(false);
  });

  it('reste sous les budgets malgré deux tours et six volumes mobiles', () => {
    const level = buildLevel();
    expect(level.towerRoots).toHaveLength(2);
    expect(level.estimatedDrawCalls).toBeLessThanOrEqual(30);
    expect(level.triangleCount).toBeLessThan(15_000);
  });
});
