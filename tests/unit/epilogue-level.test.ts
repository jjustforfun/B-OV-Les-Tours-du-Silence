/**
 * epilogue-level.test.ts — solution automatique du « Chant revenu ».
 *
 * Le dernier chapitre n'a ni mécanisme ni illusion : un seul tap traverse les
 * huit tours, éveille quatre couches de musique, touche le seuil puis ramène
 * Turpal parmi les siens. Les sept aigles ne conditionnent que la présence du
 * dernier sur son épaule, jamais le chemin ni la fin.
 */
import { DataTexture, FogExp2, Group, Scene, Vector3 } from 'three';
import { afterEach, describe, expect, it } from 'vitest';
import { bus, EventBus } from '@core/EventBus';
import type { InputEvents, InputManager } from '@input/InputManager';
import { level as definition } from '@levels/07-epilogue';
import { CameraRig } from '@render/CameraRig';
import { SKY_PALETTES, Sky, createGradientTexture } from '@render/Sky';
import { validateNoDeadEnds } from '@world/DeadEndValidator';
import { Level } from '@world/Level';
import { LevelRuntime } from '@world/LevelRuntime';
import type { NodeId } from '@world/NavGraph';
import { findPath } from '@world/Pathfinder';

const ALL_EAGLES = [
  '00-prologue:eagle',
  '01-hospitalite:eagle',
  '02-parole:eagle',
  '03-anciens:eagle',
  '04-patience:eagle',
  '05-pardon:eagle',
  '06-humilite:eagle',
] as const;

const SOLUTION = [
  'start',
  'tower-0',
  'tower-1',
  'tower-2',
  'tower-3',
  'tower-4',
  'tower-5',
  'tower-6',
  'tower-7',
  'family-threshold',
  'descent-a',
  'descent-b',
  'gathering-seat',
] as const;

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

function createRuntime(
  level: Level,
  foundEagleIds: readonly string[] = [],
): {
  readonly runtime: LevelRuntime;
  readonly input: EventBus<InputEvents>;
} {
  const input = new EventBus<InputEvents>();
  const rig = project(level, 1920, 1080);
  const runtime = new LevelRuntime({
    level,
    sceneRoot: new Group(),
    camera: rig.camera,
    input: input as unknown as InputManager,
    viewport: () => ({ width: 1920, height: 1080 }),
    foundEagleIds,
  });
  return { runtime, input };
}

function tapGoal(
  runtime: LevelRuntime,
  input: EventBus<InputEvents>,
  level: Level,
  elapsed = 0,
): void {
  runtime.update(elapsed, 0);
  const x = level.nodeProjection.screenXOf(definition.goal);
  const y = level.nodeProjection.screenYOf(definition.goal);
  input.emit('tap', {
    x,
    y,
    ndcX: (x / 1920) * 2 - 1,
    ndcY: 1 - (y / 1080) * 2,
  });
  for (let frame = 1; frame <= 36; frame += 1) runtime.update(elapsed + frame, 1);
}

afterEach(() => {
  bus.clear();
  for (const level of liveLevels.splice(0)) level.dispose();
});

describe('Chapitre 7 — Le Chant revenu', () => {
  it('revient au Ré dorien pour cinq minutes sans énigme ni illusion', () => {
    expect(definition.palette).toBe('epilogue');
    expect(definition.sky).toBe('snow');
    expect(definition.music).toEqual({ mode: 'dorian', root: 'D3', strings: ['D3', 'A3', 'D4'] });
    expect(definition.ambience).toEqual(['wind', 'fire', 'eagle']);
    expect(definition.durationMinutes).toEqual({ target: 5, min: 5, max: 7 });
    expect(definition.mechanisms ?? []).toHaveLength(0);
    expect(definition.edges.some((edge) => edge.illusory === true)).toBe(false);
  });

  it('réunit huit tours intactes dans les huit palettes du voyage', () => {
    const towers = definition.geometry?.filter((block) => block.kind === 'tower') ?? [];
    expect(towers).toHaveLength(8);
    expect(towers.map((tower) => tower.towerPalette)).toEqual([
      'prologue',
      'hospitalite',
      'parole',
      'anciens',
      'patience',
      'pardon',
      'humilite',
      'epilogue',
    ]);
    const level = buildLevel();
    expect(level.towerRoots).toHaveLength(8);
    for (const tower of level.towerRoots) expect(tower.userData.levelTower).toBe(true);
  });

  it('impose un unique chemin lisible qui monte au seuil puis redescend vers les siens', () => {
    const level = buildLevel();
    expect(route(level, definition.spawn, definition.goal)).toEqual(SOLUTION);
    expect(definition.finale?.towerNodes).toEqual(SOLUTION.slice(1, 9));
    expect(SOLUTION.indexOf('family-threshold')).toBeLessThan(SOLUTION.indexOf('gathering-seat'));
    expect(level.graph.getNode('gathering-seat')?.tags.has('goal')).toBe(true);
  });

  it('fait revenir les quatre couches, la main sur la pierre, le ciel d’or et la pose assise', () => {
    const triggers = definition.triggers ?? [];
    expect(
      triggers
        .filter((trigger) => 'musicLayers' in trigger.play)
        .map((trigger) => ('musicLayers' in trigger.play ? trigger.play.musicLayers : 0)),
    ).toEqual([1, 2, 3, 4]);
    expect(triggers).toContainEqual({
      id: 'epilogue:stone',
      on: { node: 'family-threshold' },
      play: { gesture: 'handOnStone', by: 'turpal' },
    });
    expect(triggers).toContainEqual({
      id: 'epilogue:golden-sky',
      on: { node: 'family-threshold' },
      play: { sky: 'gold', durationSeconds: 4 },
    });
    expect(triggers).toContainEqual({
      id: 'epilogue:sit',
      on: { node: 'gathering-seat' },
      play: { gesture: 'sit', by: 'turpal' },
    });
  });

  it('simule le chapitre complet : huit lumières, seuil unique, descente, Turpal et Borz au repos', () => {
    const level = buildLevel();
    const towerEvents: number[] = [];
    const moved: string[] = [];
    const music: number[] = [];
    const skies: string[] = [];
    let thresholds = 0;
    let solved = false;
    const off = [
      bus.on('finale:towerLit', ({ index }) => towerEvents.push(index)),
      bus.on('finale:threshold', () => (thresholds += 1)),
      bus.on('player:moved', ({ nodeId }) => moved.push(nodeId)),
      bus.on('music:progress', ({ layers }) => music.push(layers)),
      bus.on('sky:transition', ({ palette }) => skies.push(palette)),
      bus.on('level:solved', ({ id }) => (solved ||= id === definition.id)),
    ];
    const { runtime, input } = createRuntime(level, ALL_EAGLES);

    tapGoal(runtime, input, level);

    expect(solved).toBe(true);
    expect(moved).toEqual(SOLUTION);
    expect(towerEvents).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    expect(thresholds).toBe(1);
    expect(music).toEqual([2, 3, 4]);
    expect(skies).toEqual(['gold']);
    expect(level.root.getObjectByName('TurpalSkeleton:LeftLeg')?.rotation.x).toBeLessThan(-1);
    expect(level.root.getObjectByName('Borz')?.scale.y).toBeCloseTo(0.72, 6);
    for (let index = 0; index < 8; index += 1) {
      const beacon = level.root.getObjectByName(`FinaleTowerLight:${index}`);
      const outline = level.root.getObjectByName(`FinaleTowerLightOutline:${index}`);
      expect(beacon).toBeDefined();
      expect(beacon?.visible).toBe(true);
      expect(outline).toBeDefined();
      expect(outline?.visible).toBe(true);
    }

    for (const unsubscribe of off) unsubscribe();
    runtime.dispose();
    input.clear();
  });

  it('garde les personnes aidées sur les terrasses, sans nouvelle demande', () => {
    const level = buildLevel();
    const { runtime, input } = createRuntime(level);
    expect(level.root.getObjectByName('FinaleResident:traveler')).toBeDefined();
    expect(level.root.getObjectByName('FinaleResident:child')).toBeDefined();
    expect(level.root.getObjectByName('FinaleResident:elder')).toBeDefined();
    expect(level.root.getObjectByName('FinaleResident:rival')).toBeDefined();
    expect(definition.actors ?? []).toHaveLength(0);
    runtime.dispose();
    input.clear();
  });

  it("pose l'aigle sur l'épaule uniquement lorsque les sept secrets précédents sont présents", () => {
    const incomplete = buildLevel();
    const first = createRuntime(incomplete, ALL_EAGLES.slice(0, 6));
    expect(incomplete.root.getObjectByName('FinalEagle:Shoulder')).toBeUndefined();
    first.runtime.dispose();
    first.input.clear();

    const complete = buildLevel();
    const second = createRuntime(complete, ALL_EAGLES);
    const eagle = complete.root.getObjectByName('FinalEagle:Shoulder');
    expect(eagle).toBeDefined();
    expect(eagle?.visible).toBe(false);
    tapGoal(second.runtime, second.input, complete);
    const turpal = complete.root.getObjectByName('Turpal');
    expect(eagle?.visible).toBe(true);
    expect(eagle?.parent).toBe(turpal);
    expect(eagle?.position.y).toBeGreaterThan(0.65);

    second.runtime.dispose();
    second.input.clear();
  });

  it("fait réellement fondre le ciel neige vers l'or", () => {
    const scene = new Scene();
    const sky = new Sky(scene);
    sky.applyNamed('snow');
    sky.transitionToNamed('gold', 4);
    sky.update(10);
    sky.update(14);

    const fog = scene.fog;
    expect(fog).toBeInstanceOf(FogExp2);
    if (fog instanceof FogExp2) {
      expect(fog.color.getHex()).toBe(SKY_PALETTES.gold.fog);
      expect(fog.density).toBeCloseTo(SKY_PALETTES.gold.fogDensity, 8);
    }
    const rendered = scene.background;
    const expected = createGradientTexture(SKY_PALETTES.gold.top, SKY_PALETTES.gold.bottom);
    expect(rendered).toBeInstanceOf(DataTexture);
    if (rendered instanceof DataTexture) {
      const renderedData = rendered.image.data;
      const expectedData = expected.image.data;
      expect(renderedData).not.toBeNull();
      expect(expectedData).not.toBeNull();
      if (renderedData !== null && expectedData !== null) {
        for (let channel = 0; channel < 3; channel += 1) {
          expect(
            Math.abs((renderedData[channel] ?? 0) - (expectedData[channel] ?? 0)),
          ).toBeLessThanOrEqual(2);
        }
      }
    }
    expected.dispose();
    sky.dispose();
  });

  it.each([
    ['desktop', 1920, 1080],
    ['mobile portrait', 390, 844],
  ])('garde tout le chemin visible en %s, sans fausse connexion', (_label, width, height) => {
    const level = buildLevel();
    project(level, width, height);
    for (const nodeId of SOLUTION) {
      expect(level.nodeProjection.isVisible(nodeId), nodeId).toBe(true);
    }
    expect(level.illusions.count).toBe(0);
    expect(level.illusions.activeTotal).toBe(0);
  });

  it('explore exhaustivement le parcours sans trouver la moindre impasse', () => {
    const report = validateNoDeadEnds(definition);
    expect(report.ok, JSON.stringify(report.violations)).toBe(true);
    expect(report.mechanisms).toHaveLength(0);
    expect(report.checkedMechanismStates).toBe(1);
    expect(report.checkedStates).toBeGreaterThanOrEqual(SOLUTION.length);
    expect(report.violations).toHaveLength(0);
  });

  it('reste sous les budgets mobiles malgré huit tours canoniques', () => {
    const level = buildLevel();
    expect(level.estimatedDrawCalls).toBeLessThanOrEqual(120);
    expect(level.triangleCount).toBeLessThan(150_000);
    const size = level.bounds.getSize(new Vector3());
    expect(size.x).toBeGreaterThan(20);
    expect(size.y).toBeGreaterThan(7);
    expect(size.z).toBeGreaterThan(12);
  });
});
