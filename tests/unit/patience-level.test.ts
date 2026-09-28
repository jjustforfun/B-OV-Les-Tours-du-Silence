/**
 * patience-level.test.ts — solution automatique du chapitre 4.
 *
 * Le test tourne la tour du lac, place Borz sur la dalle, laisse monter la
 * lune pendant quarante secondes puis traverse la ligne d'eau vers le graphe
 * miroir. Il explore aussi tous les états atteignables afin d'exclure les
 * impasses avant comme après l'ouverture définitive.
 */
import { Group, Vector3 } from 'three';
import { afterEach, describe, expect, it } from 'vitest';
import { bus, EventBus } from '@core/EventBus';
import { Borz } from '@entities/companion/Borz';
import type { InputEvents, InputManager } from '@input/InputManager';
import { level as definition } from '@levels/04-patience';
import { CameraRig } from '@render/CameraRig';
import { validateNoDeadEnds } from '@world/DeadEndValidator';
import { auditIllusions, ILLUSION_TOLERANCE_PX } from '@world/Illusion';
import { Level } from '@world/Level';
import { LevelRuntime } from '@world/LevelRuntime';
import type { NodeId } from '@world/NavGraph';
import { findPath } from '@world/Pathfinder';
import { MoonCycle } from '@world/mechanisms/MoonCycle';
import { PressurePlate } from '@world/mechanisms/PressurePlate';
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

afterEach(() => {
  bus.clear();
  for (const level of liveLevels.splice(0)) level.dispose();
});

describe('Chapitre 4 — La Patience', () => {
  it('déclare le bleu lunaire, Mi éolien, le lac et onze minutes', () => {
    expect(definition.palette).toBe('patience');
    expect(definition.music).toEqual({
      mode: 'aeolian',
      root: 'E2',
      strings: ['E2', 'B2', 'E3'],
    });
    expect(definition.ambience).toEqual(['wind', 'river']);
    expect(definition.durationMinutes).toEqual({ target: 11, min: 5, max: 12 });
    expect(definition.mechanisms?.map((mechanism) => mechanism.kind)).toEqual([
      'towerRotation',
      'pressurePlate',
      'moonCycle',
    ]);
    expect(definition.edges.filter((edge) => edge.illusory === true)).toHaveLength(1);
  });

  it('construit deux tours et un graphe réellement miroir sous la surface', () => {
    const level = buildLevel();
    const tower = level.mechanisms.get('lake-tower');
    expect(tower).toBeInstanceOf(TowerRotation);
    expect(level.towerRoots).toHaveLength(2);
    expect(tower?.root.getObjectsByProperty('name', 'VainakhTower')).toHaveLength(2);

    const pairs = [
      ['start', 'goal'],
      ['shore-path', 'moon-gate'],
      ['shore-wheel', 'silver-start'],
      ['tower-water-exit', 'mirror-water-entry'],
      ['tower-water-mid', 'mirror-water-mid'],
      ['tower-water-entry', 'mirror-tower-exit'],
    ] as const;
    for (const [realId, mirrorId] of pairs) {
      const real = level.graph.getNode(realId);
      const mirror = level.graph.getNode(mirrorId);
      expect(real).toBeDefined();
      expect(mirror).toBeDefined();
      expect(mirror?.position.x).toBeCloseTo(real?.position.x ?? 0, 6);
      expect(mirror?.position.y).toBeCloseTo(-(real?.position.y ?? 0), 6);
      expect(mirror?.position.z).toBeCloseTo(real?.position.z ?? 0, 6);
    }
  });

  it('fait tourner ensemble la tour, ses escaliers et les nœuds affectés', () => {
    const level = buildLevel();
    const tower = level.mechanisms.get('lake-tower');
    expect(tower).toBeInstanceOf(TowerRotation);
    if (!(tower instanceof TowerRotation)) return;

    const plateEntry = level.graph.getNode('tower-plate-entry');
    const waterEntry = level.graph.getNode('tower-water-entry');
    expect(plateEntry?.position).toMatchObject({ x: 0, y: 2.58, z: 3 });

    tower.actuate(1);
    tower.update({ graph: level.graph, elapsed: 0.9 }, 0.9);
    expect(tower.currentFace).toBe(1);
    expect(plateEntry?.position.x).toBeCloseTo(-2, 6);
    expect(plateEntry?.position.z).toBeCloseTo(1, 6);
    expect(route(level, 'shore-wheel', 'plate-overlook')).toEqual([
      'shore-wheel',
      'tower-plate-entry',
      'tower-plate-exit',
      'plate-overlook',
    ]);

    tower.actuate(1);
    tower.update({ graph: level.graph, elapsed: 1.8 }, 0.9);
    expect(tower.currentFace).toBe(2);
    expect(waterEntry?.position.x).toBeCloseTo(-2, 6);
    expect(waterEntry?.position.z).toBeCloseTo(1, 6);
    expect(route(level, 'shore-wheel', 'water-real')).toEqual([
      'shore-wheel',
      'tower-water-entry',
      'tower-water-mid',
      'tower-water-exit',
      'water-real',
    ]);
  });

  it('réserve la dalle à Borz et lui fait matérialiser le pont d’argent', () => {
    const level = buildLevel();
    expect(route(level, definition.spawn, 'borz-plate')).toEqual([]);
    expect(level.graph.getNode('plate-overlook')?.tags.has('cooperator:moon-plate')).toBe(true);

    const borz = new Borz();
    borz.placeAt(level.graph, 'borz-start');
    borz.rebuildOwnGraph(level.graph);
    expect(findPath(borz.ownGraph, 'borz-start', 'borz-plate').found).toBe(false);

    level.graph.setMechanismState('lake-tower', 1);
    borz.rebuildOwnGraph(level.graph);
    expect(findPath(borz.ownGraph, 'borz-start', 'borz-plate').path).toEqual([
      'borz-start',
      'borz-mid',
      'borz-plate',
    ]);
    borz.serveAsBridge(level.graph, 'silver-start', 'moon-gate');
    expect(level.graph.getMechanismState('borz.bridge')).toBe(true);
    expect(borz.state).toBe('carrying');
    borz.dispose();
  });

  it('ouvre au bout de 40 s, expose le secret pendant exactement les 6 s du zénith', () => {
    const level = buildLevel();
    const plate = level.mechanisms.get('moon-plate');
    const moon = level.mechanisms.get('moon-cycle');
    expect(plate).toBeInstanceOf(PressurePlate);
    expect(moon).toBeInstanceOf(MoonCycle);
    if (!(plate instanceof PressurePlate) || !(moon instanceof MoonCycle)) return;

    const input = new EventBus<InputEvents>() as unknown as InputManager;
    const runtime = new LevelRuntime({
      level,
      sceneRoot: new Group(),
      camera: new CameraRig(16 / 9).camera,
      input,
      viewport: () => ({ width: 1920, height: 1080 }),
    });
    const phases: string[] = [];
    bus.on('moon:phase', ({ phase }) => phases.push(phase));

    plate.setOccupied(true);
    runtime.update(0.18, 0.18);
    expect(level.graph.getMechanismState('moon-plate')).toBe(true);
    expect(level.graph.getMechanismState('borz.bridge')).toBe(true);

    runtime.update(34, 33.82);
    expect(moon.elapsedSeconds).toBeCloseTo(34, 5);
    expect(moon.phase).toBe('zenith');
    expect(moon.zenithDurationSeconds).toBe(6);
    expect(level.isSecretPickable('eagle-secret')).toBe(true);

    runtime.update(40, 6);
    expect(moon.phase).toBe('open');
    expect(level.graph.getMechanismState('moon-cycle')).toBe('open');
    expect(level.isSecretPickable('eagle-secret')).toBe(false);
    expect(phases).toEqual(['zenith', 'open']);

    runtime.dispose();
    input.clear();
  });

  it('conserve le temps déjà attendu quand la condition de départ est interrompue', () => {
    const level = buildLevel();
    const moon = level.mechanisms.get('moon-cycle');
    expect(moon).toBeInstanceOf(MoonCycle);
    if (!(moon instanceof MoonCycle)) return;

    level.graph.setMechanismState('moon-plate', true);
    moon.update({ graph: level.graph, elapsed: 12 }, 12);
    expect(moon.elapsedSeconds).toBe(12);

    level.graph.setMechanismState('moon-plate', false);
    moon.update({ graph: level.graph, elapsed: 22 }, 10);
    expect(moon.elapsedSeconds).toBe(12);

    level.graph.setMechanismState('moon-plate', true);
    moon.update({ graph: level.graph, elapsed: 50 }, 28);
    expect(moon.phase).toBe('open');
  });

  it.each([
    ['desktop', 1920, 1080],
    ['mobile portrait', 390, 844],
  ])(
    'aligne la jonction du reflet à ≤ 6 px et garde tous les nœuds visibles en %s',
    (_label, width, height) => {
      const level = buildLevel();
      level.graph.setMechanismState('lake-tower', 2);
      level.graph.setMechanismState('moon-plate', true);
      level.graph.setMechanismState('moon-cycle', 'open');
      project(level, width, height);

      const audit = auditIllusions(
        new Map([
          [
            'water-real',
            {
              x: level.nodeProjection.screenXOf('water-real'),
              y: level.nodeProjection.screenYOf('water-real'),
            },
          ],
          [
            'water-reflection',
            {
              x: level.nodeProjection.screenXOf('water-reflection'),
              y: level.nodeProjection.screenYOf('water-reflection'),
            },
          ],
        ]),
        [{ a: 'water-real', b: 'water-reflection' }],
      )[0];

      expect(audit?.reason).toBe('aligned');
      expect(audit?.screenDistance).toBeLessThanOrEqual(ILLUSION_TOLERANCE_PX);
      expect(audit?.screenDistance).toBeCloseTo(0, 6);
      expect(level.illusions.activeTotal).toBe(1);
      for (const node of level.graph.allNodes()) {
        expect(level.nodeProjection.isVisible(node.id), node.id).toBe(true);
      }
    },
  );

  it('simule la solution puis explore exhaustivement tous les états sans impasse', () => {
    const level = buildLevel();
    expect(route(level, definition.spawn, definition.goal)).toEqual([]);

    level.graph.setMechanismState('lake-tower', 1);
    expect(route(level, definition.spawn, 'plate-overlook').at(-1)).toBe('plate-overlook');
    level.graph.setMechanismState('moon-plate', true);
    level.graph.setMechanismState('moon-cycle', 'open');
    level.graph.setMechanismState('lake-tower', 2);
    project(level, 1920, 1080);

    expect(route(level, definition.spawn, definition.goal)).toEqual([
      'start',
      'shore-path',
      'shore-wheel',
      'tower-water-entry',
      'tower-water-mid',
      'tower-water-exit',
      'water-real',
      'water-reflection',
      'mirror-water-entry',
      'mirror-water-mid',
      'mirror-tower-exit',
      'silver-start',
      'moon-gate',
      'goal',
    ]);

    const report = validateNoDeadEnds(definition);
    expect(report.ok, JSON.stringify(report.violations)).toBe(true);
    expect(report.checkedMechanismStates).toBe(24);
    expect(report.checkedStates).toBe(126);
    expect(report.violations).toHaveLength(0);
  });

  it('garde le secret hors de la solution et respecte les budgets mobiles', () => {
    const level = buildLevel();
    expect(definition.secrets?.[0]).toMatchObject({
      id: '04-patience:eagle',
      node: 'eagle-secret',
      revealOnMechanism: { mechanism: 'moon-cycle', equals: 'zenith' },
    });
    expect(definition.edges.some((edge) => edge.from === 'eagle-secret')).toBe(false);
    expect(level.root.getObjectByName('Moon:moon-cycle')).toBeDefined();
    expect(level.root.getObjectByName('LakeMist:moon-cycle')).toBeDefined();
    expect(level.root.getObjectByName('MoonBirds:moon-cycle')).toBeDefined();
    expect(level.estimatedDrawCalls).toBeLessThanOrEqual(36);
    expect(level.triangleCount).toBeLessThan(18_000);

    const water = definition.geometry?.find((block) => block.opacity !== undefined);
    expect(water).toMatchObject({ color: 0x172744, opacity: 0.32 });
    expect(level.bounds.getSize(new Vector3()).y).toBeGreaterThan(16);
  });
});
