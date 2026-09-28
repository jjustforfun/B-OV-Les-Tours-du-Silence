/**
 * humility-level.test.ts — solution automatique du chapitre 6.
 *
 * Le test descend le névé, aligne la tour, parcourt la paroi puis le plafond
 * à l'envers et vérifie que sa dernière ligne rejoint le sommet à 0 px. Il
 * laisse aussi Borz porter les quatre autres personnages avant Turpal et
 * explore exhaustivement tous les états réversibles sans impasse.
 */
import { Group, Vector3 } from 'three';
import { afterEach, describe, expect, it } from 'vitest';
import { bus, EventBus } from '@core/EventBus';
import type { InputEvents, InputManager } from '@input/InputManager';
import { level as definition } from '@levels/06-humilite';
import { CameraRig } from '@render/CameraRig';
import { validateNoDeadEnds } from '@world/DeadEndValidator';
import { auditIllusions, ILLUSION_TOLERANCE_PX } from '@world/Illusion';
import { Level } from '@world/Level';
import { LevelRuntime } from '@world/LevelRuntime';
import type { NodeId } from '@world/NavGraph';
import { findPath } from '@world/Pathfinder';
import { GravityPath } from '@world/mechanisms/GravityPath';
import { Slider } from '@world/mechanisms/Slider';
import { TowerRotation } from '@world/mechanisms/TowerRotation';

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

function project(level: Level, width: number, height: number): CameraRig {
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
  return rig;
}

function createRuntime(level: Level): {
  readonly runtime: LevelRuntime;
  readonly input: EventBus<InputEvents>;
  readonly rig: CameraRig;
} {
  const input = new EventBus<InputEvents>();
  const rig = project(level, 1920, 1080);
  const runtime = new LevelRuntime({
    level,
    sceneRoot: new Group(),
    camera: rig.camera,
    input: input as unknown as InputManager,
    viewport: () => ({ width: 1920, height: 1080 }),
  });
  return { runtime, input, rig };
}

function tapNode(
  runtime: LevelRuntime,
  input: EventBus<InputEvents>,
  level: Level,
  nodeId: NodeId,
  elapsed: number,
  steps = 10,
): void {
  runtime.update(elapsed, 0);
  const x = level.nodeProjection.screenXOf(nodeId);
  const y = level.nodeProjection.screenYOf(nodeId);
  input.emit('tap', {
    x,
    y,
    ndcX: (x / 1920) * 2 - 1,
    ndcY: 1 - (y / 1080) * 2,
  });
  for (let step = 1; step <= steps; step += 1) runtime.update(elapsed + step, 1);
}

function solveMechanisms(level: Level): void {
  const slab = level.mechanisms.get('snow-slab');
  const tower = level.mechanisms.get('mountain-tower');
  const wall = level.mechanisms.get('wall-gravity');
  const arch = level.mechanisms.get('arch-gravity');
  if (
    !(slab instanceof Slider) ||
    !(tower instanceof TowerRotation) ||
    !(wall instanceof GravityPath) ||
    !(arch instanceof GravityPath)
  )
    return;
  slab.actuate(1);
  slab.update({ graph: level.graph, elapsed: 0.9 }, 0.9);
  tower.actuate(1);
  tower.update({ graph: level.graph, elapsed: 1.8 }, 0.9);
  wall.actuate();
  wall.update({ graph: level.graph, elapsed: 2.25 }, 0.45);
  arch.actuate();
  arch.update({ graph: level.graph, elapsed: 2.7 }, 0.45);
  level.graph.setMechanismState('others-raised', true);
}

afterEach(() => {
  bus.clear();
  for (const level of liveLevels.splice(0)) level.dispose();
});

describe("Chapitre 6 — L'Humilité", () => {
  it('déclare la neige, La dorien, deux bascules et douze minutes', () => {
    expect(definition.palette).toBe('humilite');
    expect(definition.music).toEqual({
      mode: 'dorian',
      root: 'A3',
      strings: ['A3', 'E4', 'A4'],
    });
    expect(definition.ambience).toEqual(['wind', 'eagle']);
    expect(definition.durationMinutes).toEqual({ target: 12, min: 5, max: 12 });
    expect(definition.mechanisms?.map((mechanism) => mechanism.kind)).toEqual([
      'slider',
      'towerRotation',
      'gravityPath',
      'gravityPath',
    ]);
    expect(definition.edges.filter((edge) => edge.illusory === true)).toHaveLength(1);
  });

  it('fait du névé le slider sous les pieds de Turpal et transporte son nœud', () => {
    const level = buildLevel();
    const slider = level.mechanisms.get('snow-slab');
    expect(slider).toBeInstanceOf(Slider);
    if (!(slider instanceof Slider)) return;

    const initialY = level.graph.getNode('start')?.position.y;
    expect(initialY).toBe(4);
    expect(route(level, 'start', 'tower-wheel')).toEqual([]);

    slider.actuate(1);
    slider.update({ graph: level.graph, elapsed: 0.9 }, 0.9);
    expect(slider.currentStop).toBe(1);
    expect(level.graph.getNode('start')?.position.y).toBeCloseTo(2, 6);
    expect(route(level, 'start', 'tower-wheel')).toEqual(['start', 'tower-wheel']);

    slider.actuate(-1);
    slider.update({ graph: level.graph, elapsed: 1.8 }, 0.9);
    expect(level.graph.getNode('start')?.position.y).toBeCloseTo(4, 6);
  });

  it('transporte réellement Turpal avec le sol, sans le confier à Borz', () => {
    const level = buildLevel();
    const slider = level.mechanisms.get('snow-slab');
    if (!(slider instanceof Slider)) return;
    const { runtime, input } = createRuntime(level);
    const turpal = level.root.getObjectByName('Turpal');
    expect(turpal).toBeDefined();
    expect(turpal?.position.y).toBeCloseTo(4, 6);

    slider.actuate(1);
    runtime.update(0.9, 0.9);
    expect(turpal?.getWorldPosition(new Vector3()).y).toBeCloseTo(2, 6);
    expect(turpal?.parent).toBe(level.root);
    expect(level.root.getObjectByName('Borz')?.children).not.toContain(turpal);

    runtime.dispose();
    input.clear();
  });

  it('aligne la tour puis applique deux orientations successives lisibles', () => {
    const level = buildLevel();
    const tower = level.mechanisms.get('mountain-tower');
    const wall = level.mechanisms.get('wall-gravity');
    const arch = level.mechanisms.get('arch-gravity');
    if (
      !(tower instanceof TowerRotation) ||
      !(wall instanceof GravityPath) ||
      !(arch instanceof GravityPath)
    )
      return;

    expect(level.graph.getNode('wall-mid')?.up).toEqual({ x: 0, y: 1, z: 0 });
    expect(level.graph.getNode('ceiling-b')?.up).toEqual({ x: 0, y: 0, z: 1 });

    tower.actuate(1);
    tower.update({ graph: level.graph, elapsed: 0.9 }, 0.9);
    expect(level.graph.getNode('tower-exit')?.position.x).toBeCloseTo(-3, 6);
    expect(level.graph.getNode('tower-exit')?.position.z).toBeCloseTo(-2, 6);

    wall.actuate();
    wall.update({ graph: level.graph, elapsed: 1.35 }, 0.45);
    expect(level.graph.getNode('wall-mid')?.up).toEqual({ x: 0, y: 0, z: 1 });

    arch.actuate();
    arch.update({ graph: level.graph, elapsed: 1.8 }, 0.45);
    expect(level.graph.getNode('ceiling-b')?.up).toEqual({ x: 0, y: -1, z: 0 });
    expect(level.graph.getNode('goal')?.up).toEqual({ x: 0, y: -1, z: 0 });
  });

  it('fait porter les quatre autres par Borz et termine avec Turpal à pied', () => {
    const level = buildLevel();
    const tower = level.mechanisms.get('mountain-tower');
    if (!(tower instanceof TowerRotation)) return;
    const { runtime, input } = createRuntime(level);

    expect(level.graph.getMechanismState('others-raised')).toBe(false);
    expect(level.root.getObjectByName('ProcessionPassenger:traveler')).toBeDefined();
    expect(level.root.getObjectByName('ProcessionPassenger:child')).toBeDefined();
    expect(level.root.getObjectByName('ProcessionPassenger:elder')).toBeDefined();
    expect(level.root.getObjectByName('ProcessionPassenger:rival')).toBeDefined();

    tower.actuate(1);
    for (let frame = 1; frame <= 24; frame += 1) runtime.update(frame * 2, 2);

    expect(level.graph.getMechanismState('others-raised')).toBe(true);
    const passengers = ['traveler', 'child', 'elder', 'rival'] as const;
    for (let index = 0; index < passengers.length; index += 1) {
      const object = level.root.getObjectByName(`ProcessionPassenger:${passengers[index]}`);
      const target = level.graph.getNode(`passenger-summit-${index}`);
      const world = object?.getWorldPosition(new Vector3());
      expect(world?.x).toBeCloseTo(target?.position.x ?? 0, 5);
      expect(world?.y).toBeCloseTo(target?.position.y ?? 0, 5);
      expect(world?.z).toBeCloseTo(target?.position.z ?? 0, 5);
    }
    expect(level.root.getObjectByName('Turpal')?.parent).toBe(level.root);

    runtime.dispose();
    input.clear();
  });

  it('fait rouler la caméra avec Turpal après les deux bascules', () => {
    const level = buildLevel();
    const slider = level.mechanisms.get('snow-slab');
    const tower = level.mechanisms.get('mountain-tower');
    const wall = level.mechanisms.get('wall-gravity');
    const arch = level.mechanisms.get('arch-gravity');
    if (
      !(slider instanceof Slider) ||
      !(tower instanceof TowerRotation) ||
      !(wall instanceof GravityPath) ||
      !(arch instanceof GravityPath)
    )
      return;
    const { runtime, input, rig } = createRuntime(level);

    slider.actuate(1);
    runtime.update(1, 0.9);
    tapNode(runtime, input, level, 'tower-wheel', 2, 2);
    tower.actuate(1);
    runtime.update(5, 0.9);
    tower.setEnabled(false);
    tapNode(runtime, input, level, 'wall-top', 6, 3);
    wall.actuate();
    runtime.update(10, 0.45);
    tapNode(runtime, input, level, 'arch-hinge', 11, 5);
    expect(rig.camera.up.z).toBeCloseTo(1, 4);

    arch.actuate();
    runtime.update(17, 0.45);
    tapNode(runtime, input, level, 'ceiling-end', 18, 4);
    expect(rig.camera.up.y).toBeCloseTo(-1, 4);
    expect(rig.camera.up.x).toBeCloseTo(0, 4);
    expect(rig.camera.up.z).toBeCloseTo(0, 4);

    for (let frame = 0; frame < 30; frame += 1) runtime.update(24 + frame, 1);
    expect(level.graph.getMechanismState('others-raised')).toBe(true);
    let solved = false;
    const moved: string[] = [];
    const offMoved = bus.on('player:moved', ({ nodeId }) => moved.push(nodeId));
    const off = bus.on('level:solved', ({ id }) => {
      solved ||= id === definition.id;
    });
    tapNode(runtime, input, level, 'goal', 55, 10);
    off();
    offMoved();
    expect(moved).toEqual(['summit-start', 'summit-mid', 'goal']);
    expect(solved).toBe(true);
    expect(rig.camera.up.y).toBeCloseTo(-1, 4);

    runtime.dispose();
    input.clear();
  });

  it.each([
    ['desktop', 1920, 1080],
    ['mobile portrait', 390, 844],
  ])(
    'superpose plafond et sommet à ≤ 6 px, tous les nœuds visibles en %s',
    (_label, width, height) => {
      const level = buildLevel();
      solveMechanisms(level);
      const rig = project(level, width, height);

      const audit = auditIllusions(
        new Map([
          [
            'ceiling-end',
            {
              x: level.nodeProjection.screenXOf('ceiling-end'),
              y: level.nodeProjection.screenYOf('ceiling-end'),
            },
          ],
          [
            'summit-start',
            {
              x: level.nodeProjection.screenXOf('summit-start'),
              y: level.nodeProjection.screenYOf('summit-start'),
            },
          ],
        ]),
        [{ a: 'ceiling-end', b: 'summit-start' }],
      )[0];
      expect(audit?.reason).toBe('aligned');
      expect(audit?.screenDistance).toBeLessThanOrEqual(ILLUSION_TOLERANCE_PX);
      expect(audit?.screenDistance).toBeCloseTo(0, 6);
      expect(level.illusions.activeTotal).toBe(1);
      for (const node of level.graph.allNodes()) {
        expect(level.nodeProjection.isVisible(node.id), node.id).toBe(true);
      }

      rig.camera.up.set(0, -1, 0);
      rig.camera.lookAt(level.bounds.getCenter(new Vector3()));
      rig.camera.updateMatrixWorld(true);
      level.projectNodes(
        rig.camera.projectionMatrix.elements,
        rig.camera.matrixWorldInverse.elements,
        width,
        height,
      );
      expect(level.nodeProjection.screenXOf('ceiling-end')).toBeCloseTo(
        level.nodeProjection.screenXOf('summit-start'),
        5,
      );
    },
  );

  it("révèle l'aigle seulement sous Turpal une fois le plafond inversé", () => {
    const level = buildLevel();
    expect(definition.secrets?.[0]).toMatchObject({
      id: '06-humilite:eagle',
      node: 'eagle-secret',
      revealOnMechanism: { mechanism: 'arch-gravity', equals: 'up' },
    });
    expect(level.isSecretPickable('eagle-secret')).toBe(false);
    level.graph.setMechanismState('arch-gravity', 'up');
    level.syncSecretsForMechanism('arch-gravity');
    expect(level.isSecretPickable('eagle-secret')).toBe(true);
    expect(definition.edges.some((edge) => edge.from === 'eagle-secret')).toBe(false);
  });

  it('simule la solution puis explore exhaustivement tous les états sans impasse', () => {
    const level = buildLevel();
    expect(route(level, definition.spawn, definition.goal)).toEqual([]);
    solveMechanisms(level);
    project(level, 1920, 1080);

    expect(route(level, definition.spawn, definition.goal)).toEqual([
      'start',
      'tower-wheel',
      'tower-exit',
      'wall-top',
      'wall-upper',
      'wall-mid',
      'wall-bottom',
      'arch-hinge',
      'ceiling-a',
      'ceiling-b',
      'ceiling-end',
      'summit-start',
      'summit-mid',
      'goal',
    ]);

    const report = validateNoDeadEnds(definition);
    expect(report.ok, JSON.stringify(report.violations)).toBe(true);
    expect(report.checkedMechanismStates).toBeGreaterThanOrEqual(32);
    expect(report.checkedStates).toBeGreaterThan(report.checkedMechanismStates);
    expect(report.violations).toHaveLength(0);
  });

  it('garde la montagne, la tour et la procession sous les budgets mobiles', () => {
    const level = buildLevel();
    expect(level.towerRoots).toHaveLength(1);
    expect(level.estimatedDrawCalls).toBeLessThanOrEqual(40);
    expect(level.triangleCount).toBeLessThan(18_000);
    const size = level.bounds.getSize(new Vector3());
    expect(size.x).toBeGreaterThan(18);
    expect(size.y).toBeGreaterThan(10);
    expect(size.z).toBeGreaterThan(14);
  });
});
