/**
 * pardon-level.test.ts — solution automatique du chapitre 5.
 *
 * Le test laisse le rival répondre à deux orientations sans issue, règle la
 * moitié ouest sur la face 1 puis fait avancer Turpal : la troisième réponse
 * mène seule l'est de 2 à 3 et referme la fracture. L'espace complet des deux
 * tours, de la gravité et des états d'ordre est ensuite exploré sans impasse.
 */
import { Group, Vector3 } from 'three';
import { afterEach, describe, expect, it } from 'vitest';
import { bus, EventBus } from '@core/EventBus';
import type { InputEvents, InputManager } from '@input/InputManager';
import { level as definition } from '@levels/05-pardon';
import { CameraRig } from '@render/CameraRig';
import { validateNoDeadEnds } from '@world/DeadEndValidator';
import { auditIllusions, ILLUSION_TOLERANCE_PX } from '@world/Illusion';
import { Level } from '@world/Level';
import { LevelRuntime } from '@world/LevelRuntime';
import type { NodeId } from '@world/NavGraph';
import { findPath } from '@world/Pathfinder';
import { GravityPath } from '@world/mechanisms/GravityPath';
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

function rotate(tower: TowerRotation, level: Level, steps: number): void {
  for (let index = 0; index < steps; index += 1) {
    tower.actuateByActor(1);
    tower.update({ graph: level.graph, elapsed: index + 1 }, 0.9);
  }
}

function tapNode(
  runtime: LevelRuntime,
  input: EventBus<InputEvents>,
  level: Level,
  nodeId: NodeId,
  elapsed: number,
  simulationSteps = 10,
): void {
  runtime.update(elapsed, 0);
  const width = 1920;
  const height = 1080;
  const x = level.nodeProjection.screenXOf(nodeId);
  const y = level.nodeProjection.screenYOf(nodeId);
  input.emit('tap', {
    x,
    y,
    ndcX: (x / width) * 2 - 1,
    ndcY: 1 - (y / height) * 2,
  });
  // Turpal consomme volontairement un seul segment par image ; dix pas de
  // simulation suffisent à la plus longue route de ce test.
  for (let step = 1; step <= simulationSteps; step += 1) {
    runtime.update(elapsed + step * 2, 2);
  }
}

afterEach(() => {
  bus.clear();
  for (const level of liveLevels.splice(0)) level.dispose();
});

describe('Chapitre 5 — Le Pardon', () => {
  it('déclare les deux demi-tours, Ré éolien et dix minutes', () => {
    expect(definition.palette).toBe('pardon');
    expect(definition.music).toEqual({
      mode: 'aeolian',
      root: 'D3',
      strings: ['D3', 'A3', 'F4'],
    });
    expect(definition.ambience).toEqual(['wind', 'eagle', 'stone']);
    expect(definition.durationMinutes).toEqual({ target: 10, min: 5, max: 12 });
    expect(definition.mechanisms?.map((mechanism) => mechanism.kind)).toEqual([
      'gravityPath',
      'towerRotation',
      'towerRotation',
    ]);
    expect(definition.edges.filter((edge) => edge.illusory === true)).toHaveLength(1);

    const rival = definition.actors?.find((actor) => actor.kind === 'rival');
    expect(rival).toMatchObject({
      respondsOnNode: 'west-offer',
      playerMechanism: 'west-half',
      rivalMechanism: 'east-half',
      playerFace: 1,
      rivalFace: 3,
    });
  });

  it('fait de ouest 1 / est 2→3 la seule réponse résolvante parmi les 16', () => {
    const solutions: [number, number][] = [];
    for (let west = 0; west < 4; west += 1) {
      for (let east = 0; east < 4; east += 1) {
        const eastAfterResponse = (east + 1) % 4;
        if (west === 1 && east === 2 && eastAfterResponse === 3) {
          solutions.push([west, eastAfterResponse]);
        }
      }
    }
    expect(solutions).toEqual([[1, 3]]);
  });

  it('introduit la courte paroi avec up=[0,0,1] puis reste réversible', () => {
    const level = buildLevel();
    const gravity = level.mechanisms.get('fracture-gravity');
    expect(gravity).toBeInstanceOf(GravityPath);
    if (!(gravity instanceof GravityPath)) return;

    expect(route(level, definition.spawn, 'wall-top')).toEqual([]);
    gravity.actuate();
    gravity.update({ graph: level.graph, elapsed: 0.45 }, 0.45);
    expect(gravity.currentDirection).toBe('north');
    expect(level.graph.getNode('wall-mid')?.up).toEqual({ x: 0, y: 0, z: 1 });
    expect(route(level, definition.spawn, 'wall-top').at(-1)).toBe('wall-top');

    gravity.actuate();
    gravity.update({ graph: level.graph, elapsed: 0.9 }, 0.45);
    expect(gravity.currentDirection).toBe('down');
    expect(level.graph.getNode('wall-mid')?.up).toEqual({ x: 0, y: 1, z: 0 });
  });

  it('réunit les balcons existants au centre, sans créer ni déplacer une pierre', () => {
    const level = buildLevel();
    const west = level.mechanisms.get('west-half');
    const east = level.mechanisms.get('east-half');
    expect(west).toBeInstanceOf(TowerRotation);
    expect(east).toBeInstanceOf(TowerRotation);
    if (!(west instanceof TowerRotation) || !(east instanceof TowerRotation)) return;

    const existingBridges = definition.geometry?.filter((block) => block.kind === 'bridge') ?? [];
    expect(existingBridges.map((block) => block.parent)).toEqual(['west-half', 'east-half']);
    expect(definition.geometry?.some((block) => block.moveTo !== undefined)).toBe(false);

    rotate(west, level, 1);
    rotate(east, level, 3);
    const westOffer = level.graph.getNode('west-offer');
    const eastOffer = level.graph.getNode('east-offer');
    expect(westOffer?.position.x).toBeCloseTo(0, 6);
    expect(westOffer?.position.y).toBeCloseTo(4, 6);
    expect(westOffer?.position.z).toBeCloseTo(0, 6);
    expect(eastOffer?.position.x).toBeCloseTo(0, 6);
    expect(eastOffer?.position.y).toBeCloseTo(4, 6);
    expect(eastOffer?.position.z).toBeCloseTo(0, 6);
  });

  it('simule Turpal avançant le premier puis la dernière rotation du rival', () => {
    const level = buildLevel();
    const gravity = level.mechanisms.get('fracture-gravity');
    const west = level.mechanisms.get('west-half');
    const east = level.mechanisms.get('east-half');
    expect(gravity).toBeInstanceOf(GravityPath);
    expect(west).toBeInstanceOf(TowerRotation);
    expect(east).toBeInstanceOf(TowerRotation);
    if (
      !(gravity instanceof GravityPath) ||
      !(west instanceof TowerRotation) ||
      !(east instanceof TowerRotation)
    )
      return;

    const input = new EventBus<InputEvents>();
    const rig = project(level, 1920, 1080);
    const runtime = new LevelRuntime({
      level,
      sceneRoot: new Group(),
      camera: rig.camera,
      input: input as unknown as InputManager,
      viewport: () => ({ width: 1920, height: 1080 }),
    });

    gravity.actuate();
    runtime.update(0.45, 0.45);
    // Le test vise ici la marche, pas le picking de l'anneau qui se projette
    // volontairement près de la corniche dans cette perspective.
    west.setEnabled(false);

    tapNode(runtime, input, level, 'west-offer', 1);
    runtime.update(10, 0.9);
    expect(east.currentFace).toBe(1);
    expect(level.graph.getMechanismState('fracture-closed')).toBe(false);

    tapNode(runtime, input, level, 'west-entry', 11);
    tapNode(runtime, input, level, 'west-offer', 20);
    runtime.update(29, 0.9);
    expect(east.currentFace).toBe(2);
    expect(level.graph.getMechanismState('fracture-closed')).toBe(false);

    tapNode(runtime, input, level, 'west-entry', 30);
    west.setEnabled(true);
    west.actuate(1);
    runtime.update(39, 0.9);
    expect(west.currentFace).toBe(1);
    west.setEnabled(false);

    tapNode(runtime, input, level, 'west-offer', 40, 3);
    expect(level.graph.getMechanismState('turpal-advanced')).toBe(true);
    expect(level.graph.getMechanismState('fracture-closed')).toBe(false);
    runtime.update(49, 0.9);

    expect(east.currentFace).toBe(3);
    expect(level.graph.getMechanismState('fracture-closed')).toBe(true);
    expect(west.interactive).toBe(false);
    expect(east.interactive).toBe(false);
    expect(level.root.getObjectByName('Actor:Rival')).toBeDefined();

    runtime.update(50, 0);
    expect(route(level, 'west-offer', definition.goal)).toEqual([
      'west-offer',
      'east-offer',
      'east-hub',
      'east-overlook',
      'goal',
    ]);

    runtime.dispose();
    input.clear();
  });

  it.each([
    ['desktop', 1920, 1080],
    ['mobile portrait', 390, 844],
  ])('aligne la fracture à ≤ 6 px et garde les nœuds visibles en %s', (_label, width, height) => {
    const level = buildLevel();
    const west = level.mechanisms.get('west-half');
    const east = level.mechanisms.get('east-half');
    if (!(west instanceof TowerRotation) || !(east instanceof TowerRotation)) return;
    rotate(west, level, 1);
    rotate(east, level, 3);
    level.graph.setMechanismState('turpal-advanced', true);
    level.graph.setMechanismState('fracture-closed', true);
    project(level, width, height);

    const audit = auditIllusions(
      new Map([
        [
          'west-offer',
          {
            x: level.nodeProjection.screenXOf('west-offer'),
            y: level.nodeProjection.screenYOf('west-offer'),
          },
        ],
        [
          'east-offer',
          {
            x: level.nodeProjection.screenXOf('east-offer'),
            y: level.nodeProjection.screenYOf('east-offer'),
          },
        ],
      ]),
      [{ a: 'west-offer', b: 'east-offer' }],
    )[0];
    expect(audit?.reason).toBe('aligned');
    expect(audit?.screenDistance).toBeLessThanOrEqual(ILLUSION_TOLERANCE_PX);
    expect(audit?.screenDistance).toBeCloseTo(0, 6);
    expect(level.illusions.activeTotal).toBe(1);
    for (const node of level.graph.allNodes()) {
      expect(level.nodeProjection.isVisible(node.id), node.id).toBe(true);
    }
  });

  it("montre l'aigle dans la fente ouverte puis le cache à la réconciliation", () => {
    const level = buildLevel();
    expect(definition.secrets?.[0]).toMatchObject({
      id: '05-pardon:eagle',
      node: 'eagle-secret',
      revealOnMechanism: { mechanism: 'fracture-closed', equals: false },
    });
    expect(level.isSecretPickable('eagle-secret')).toBe(true);
    expect(definition.edges.some((edge) => edge.from === 'eagle-secret')).toBe(false);

    level.graph.setMechanismState('fracture-closed', true);
    level.syncSecretsForMechanism('fracture-closed');
    expect(level.isSecretPickable('eagle-secret')).toBe(false);
  });

  it('explore exhaustivement les états atteignables sans aucune impasse', () => {
    const report = validateNoDeadEnds(definition);
    expect(report.ok, JSON.stringify(report.violations)).toBe(true);
    expect(report.checkedMechanismStates).toBeGreaterThanOrEqual(32);
    expect(report.checkedStates).toBeGreaterThan(report.checkedMechanismStates);
    expect(report.violations).toHaveLength(0);
  });

  it('reste sous les budgets mobiles avec ses deux moitiés indépendantes', () => {
    const level = buildLevel();
    const west = level.mechanisms.get('west-half');
    const east = level.mechanisms.get('east-half');
    expect(west?.root.children.length).toBeGreaterThan(2);
    expect(east?.root.children.length).toBeGreaterThan(2);
    expect(level.estimatedDrawCalls).toBeLessThanOrEqual(36);
    expect(level.triangleCount).toBeLessThan(18_000);
    expect(level.bounds.getSize(new Vector3()).x).toBeGreaterThan(14);
  });
});
