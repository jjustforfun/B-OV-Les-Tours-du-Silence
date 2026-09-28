/**
 * lifecycle.test.ts — ownership, abonnements et libération sans contexte WebGL.
 *
 * Ces tests couvrent ce que Node peut prouver : cycles répétés de loader et
 * runtime, idempotence de dispose(), snapshots de l'EventBus et unicité des
 * événements `dispose` Three.js. `renderer.info.memory` reste un contrôle
 * navigateur distinct.
 */
import {
  BoxGeometry,
  Group,
  Material,
  Mesh,
  MeshBasicMaterial,
  OrthographicCamera,
  ShaderMaterial,
  Texture,
  type BufferGeometry,
  type Object3D,
} from 'three';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { QUALITY_PRESETS } from '@/config';
import { bus, EventBus, type EventMap } from '@core/EventBus';
import { FxRuntime } from '@fx/FxRuntime';
import type { InputEvents, InputManager } from '@input/InputManager';
import { LEVEL_IDS } from '@levels/index';
import { level as prologueDefinition } from '@levels/00-prologue';
import { level as humilityDefinition } from '@levels/06-humilite';
import { disposeChapterLuts, getChapterLut } from '@render/ChapterLut';
import { createToonStoneMaterial, disposeToonGradients } from '@render/materials/ToonStoneMaterial';
import { disposeObject } from '@utils/dispose';
import { Level } from '@world/Level';
import { LevelLoader } from '@world/LevelLoader';
import { LevelRuntime } from '@world/LevelRuntime';

type GpuResource = BufferGeometry | Material | Texture;

interface DisposalProbe {
  readonly resources: ReadonlySet<GpuResource>;
  readonly counts: ReadonlyMap<GpuResource, number>;
}

function sceneResources(root: Object3D): Set<GpuResource> {
  const resources = new Set<GpuResource>();
  root.traverse((object) => {
    const renderable = object as Object3D & {
      readonly geometry?: unknown;
      readonly material?: unknown;
    };
    if (renderable.geometry instanceof BoxGeometry || isBufferGeometry(renderable.geometry)) {
      resources.add(renderable.geometry);
    }
    const materials = Array.isArray(renderable.material)
      ? renderable.material
      : [renderable.material];
    for (const material of materials) {
      if (material instanceof Material) resources.add(material);
    }
  });
  return resources;
}

function isBufferGeometry(value: unknown): value is BufferGeometry {
  return value !== null && typeof value === 'object' && 'isBufferGeometry' in value;
}

function probeDisposals(resources: ReadonlySet<GpuResource>): DisposalProbe {
  const counts = new Map<GpuResource, number>();
  for (const resource of resources) {
    counts.set(resource, 0);
    resource.addEventListener('dispose', () => {
      counts.set(resource, (counts.get(resource) ?? 0) + 1);
    });
  }
  return { resources, counts };
}

function expectDisposedExactlyOnce(probe: DisposalProbe): void {
  expect(probe.resources.size).toBeGreaterThan(0);
  for (const resource of probe.resources) expect(probe.counts.get(resource)).toBe(1);
}

function expectNotDisposed(probe: DisposalProbe): void {
  for (const resource of probe.resources) expect(probe.counts.get(resource)).toBe(0);
}

afterEach(() => {
  bus.clear();
  disposeChapterLuts();
  disposeToonGradients();
  vi.useRealTimers();
});

describe('EventBus sans allocation de snapshot récurrente', () => {
  it('préserve les snapshots lors des ajouts, retraits et émissions imbriquées', () => {
    interface Events extends EventMap {
      tick: number;
    }
    const events = new EventBus<Events>();
    const received: string[] = [];
    const late = (value: number): void => {
      received.push(`late:${value}`);
    };
    let offSecond = (): void => undefined;

    events.on('tick', (value) => {
      received.push(`first:${value}`);
      events.on('tick', late);
      offSecond();
      if (value === 0) events.emit('tick', 1);
    });
    offSecond = events.on('tick', (value) => received.push(`second:${value}`));

    events.emit('tick', 0);

    expect(received).toEqual(['first:0', 'first:1', 'late:1', 'second:0']);
    expect(events.listenerCount('tick')).toBe(2);
    events.clear();
    expect(events.listenerCount()).toBe(0);
  });
});

describe('disposeObject', () => {
  it('libère une seule fois les ressources partagées et les textures de uniforms', () => {
    const root = new Group();
    const geometry = new BoxGeometry(1, 1, 1);
    const map = new Texture();
    const uniformMap = new Texture();
    const material = new MeshBasicMaterial({ map, alphaMap: map });
    const shader = new ShaderMaterial({ uniforms: { uMap: { value: uniformMap } } });
    root.add(
      new Mesh(geometry, material),
      new Mesh(geometry, material),
      new Mesh(geometry, shader),
    );
    const resources = new Set<GpuResource>([geometry, material, shader, map, uniformMap]);
    const probe = probeDisposals(resources);

    disposeObject(root);
    disposeObject(root);

    expectDisposedExactlyOnce(probe);
    expect(root.children).toHaveLength(0);
  });

  it('réserve les caches toon et LUT à l’arrêt global du moteur', () => {
    const root = new Group();
    const geometry = new BoxGeometry(1, 1, 1);
    const material = createToonStoneMaterial();
    const gradient = material.gradientMap;
    expect(gradient).toBeDefined();
    if (gradient === null) return;
    root.add(new Mesh(geometry, material));
    const localProbe = probeDisposals(new Set<GpuResource>([geometry, material]));
    const gradientProbe = probeDisposals(new Set<GpuResource>([gradient]));
    const lut = getChapterLut('prologue');
    const lutProbe = probeDisposals(new Set<GpuResource>([lut]));

    expect(getChapterLut('prologue')).toBe(lut);
    disposeObject(root);
    expectDisposedExactlyOnce(localProbe);
    expectNotDisposed(gradientProbe);
    expectNotDisposed(lutProbe);

    disposeToonGradients();
    disposeToonGradients();
    disposeChapterLuts();
    disposeChapterLuts();
    expectDisposedExactlyOnce(gradientProbe);
    expectDisposedExactlyOnce(lutProbe);
  });
});

describe('LevelLoader', () => {
  it('construit des instances neuves et libère exactement une fois 16 niveaux successifs', async () => {
    const loader = new LevelLoader();
    let previous: Level | null = null;
    let previousProbe: DisposalProbe | null = null;

    for (let index = 0; index < LEVEL_IDS.length * 2; index += 1) {
      const id = LEVEL_IDS[index % LEVEL_IDS.length];
      if (id === undefined) continue;
      const level = await loader.load(id);

      if (previous !== null && previousProbe !== null) {
        expect(level).not.toBe(previous);
        expectDisposedExactlyOnce(previousProbe);
        expect(previous.graph.nodeCount).toBe(0);
        expect(previous.root.children).toHaveLength(0);
      }

      expect(loader.activeLevel).toBe(level);
      previous = level;
      previousProbe = probeDisposals(sceneResources(level.root));
    }

    loader.unload();
    loader.unload();
    expect(loader.activeLevel).toBeNull();
    if (previousProbe !== null) expectDisposedExactlyOnce(previousProbe);
  });
});

describe('LevelRuntime', () => {
  it('stabilise les abonnements et les ressources sur 10 cycles de chapitre', () => {
    const scene = new Group();
    const camera = new OrthographicCamera(-10, 10, 10, -10, 0.1, 200);
    camera.position.set(20, 20, 20);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld(true);
    const inputEvents = new EventBus<InputEvents>();
    const input = inputEvents as unknown as InputManager;
    const globalBaseline = bus.listenerCount();

    for (let cycle = 0; cycle < 10; cycle += 1) {
      const level = new Level(prologueDefinition);
      const runtime = new LevelRuntime({
        level,
        sceneRoot: scene,
        camera,
        input,
        viewport: () => ({ width: 1920, height: 1080 }),
      });
      const probe = probeDisposals(sceneResources(level.root));

      expect(scene.children).toContain(level.root);
      expect(level.root.getObjectByName('DestinationMarker')).toBeDefined();
      expect(bus.listenerCount()).toBe(globalBaseline + 2);
      expect(inputEvents.listenerCount()).toBe(11);

      runtime.dispose();
      runtime.dispose();
      level.dispose();
      level.dispose();

      expect(bus.listenerCount()).toBe(globalBaseline);
      expect(inputEvents.listenerCount()).toBe(0);
      expect(scene.children).not.toContain(level.root);
      expect(level.mechanisms.size).toBe(0);
      expect(level.towerRoots).toHaveLength(0);
      expectDisposedExactlyOnce(probe);
    }
  });
});

describe('FxRuntime', () => {
  it('détache les FX, annule leurs timers et ne libère le runtime global qu’une fois', () => {
    vi.useFakeTimers();
    const scene = new Group();
    const camera = new OrthographicCamera(-10, 10, 10, -10, 0.1, 200);
    const level = new Level(humilityDefinition);
    const fx = new FxRuntime({
      scene,
      camera,
      viewportHeight: () => 1080,
      quality: QUALITY_PRESETS.low,
      getTowers: () => level.towerRoots,
    });
    const coreResources = sceneResources(fx.root);
    const coreProbe = probeDisposals(coreResources);

    fx.attachLevel(level);
    const ambientResources = sceneResources(fx.root);
    for (const resource of coreResources) ambientResources.delete(resource);
    const ambientProbe = probeDisposals(ambientResources);
    bus.emit('level:solved', {
      id: level.id,
      moves: 1,
      at: { x: 0, y: 0, z: 0 },
    });
    expect(vi.getTimerCount()).toBeGreaterThan(0);

    fx.detachLevel();
    fx.detachLevel();
    expect(vi.getTimerCount()).toBe(0);
    vi.runAllTimers();
    expect(fx.pool.aliveCount).toBe(0);
    expectDisposedExactlyOnce(ambientProbe);
    expectNotDisposed(coreProbe);

    fx.dispose();
    fx.dispose();
    level.dispose();

    expectDisposedExactlyOnce(coreProbe);
    expect(bus.listenerCount()).toBe(0);
    expect(scene.children).toHaveLength(0);
  });
});
