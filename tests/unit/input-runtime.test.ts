import { Group, OrthographicCamera, Vector3 } from 'three';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { bus, EventBus } from '@core/EventBus';
import type { InputEvents, InputManager } from '@input/InputManager';
import type { FocusRing } from '@ui/FocusRing';
import { Level, type LevelDefinition } from '@world/Level';
import { LevelRuntime } from '@world/LevelRuntime';
import { Rotator } from '@world/mechanisms/Rotator';

function camera(): OrthographicCamera {
  const result = new OrthographicCamera(-5, 5, 5, -5, 0.1, 100);
  result.position.set(0, 6, 10);
  result.lookAt(0, 0, 0);
  result.updateProjectionMatrix();
  result.updateMatrixWorld(true);
  return result;
}

function definition(withMechanisms = false): LevelDefinition {
  return {
    id: 'input-audit',
    chapter: 0,
    virtue: 'prologue',
    titleKey: 'levels.return.title',
    proverbKey: 'proverbs.return',
    sky: 'dawn',
    spawn: 'start',
    goal: 'goal',
    nodes: [
      {
        id: 'start',
        at: [0, 0, 0],
        tags: withMechanisms ? ['actuator:far', 'actuator:near'] : [],
      },
      { id: 'goal', at: [1, 0, 0] },
    ],
    edges: [{ from: 'start', to: 'goal' }],
    mechanisms: withMechanisms
      ? [
          { id: 'far', kind: 'rotator', at: [3, 0, 0] },
          { id: 'near', kind: 'rotator', at: [1, 0, 0] },
        ]
      : [],
  };
}

function inputBus(): InputManager {
  return new EventBus<InputEvents>() as unknown as InputManager;
}

afterEach(() => bus.clear());

describe('intégration des intentions dans LevelRuntime', () => {
  it('transforme un tap projeté en déplacement vers le nœud visé', () => {
    const level = new Level(definition());
    const input = inputBus();
    const runtime = new LevelRuntime({
      level,
      sceneRoot: new Group(),
      camera: camera(),
      input,
      viewport: () => ({ width: 800, height: 600 }),
    });
    const arrivals: string[] = [];
    bus.on('player:moved', ({ nodeId }) => arrivals.push(nodeId));
    runtime.update(0, 0.016);
    arrivals.length = 0;

    const x = level.nodeProjection.screenXOf('goal');
    const y = level.nodeProjection.screenYOf('goal');
    input.emit('tap', { x, y, ndcX: 0, ndcY: 0 });
    runtime.update(1, 1);

    expect(arrivals).toContain('goal');
    runtime.dispose();
    input.clear();
  });

  it('branche le déplacement cardinal sur le voisin projeté dans le cône écran', () => {
    const level = new Level(definition());
    const input = inputBus();
    const runtime = new LevelRuntime({
      level,
      sceneRoot: new Group(),
      camera: camera(),
      input,
      viewport: () => ({ width: 800, height: 600 }),
    });
    const arrivals: string[] = [];
    bus.on('player:moved', ({ nodeId }) => arrivals.push(nodeId));
    runtime.update(0, 0.016);
    arrivals.length = 0;

    const screenDx =
      level.nodeProjection.screenXOf('goal') - level.nodeProjection.screenXOf('start');
    const screenDy =
      level.nodeProjection.screenYOf('goal') - level.nodeProjection.screenYOf('start');
    const direction =
      Math.abs(screenDx) >= Math.abs(screenDy)
        ? { dx: Math.sign(screenDx), dy: 0 }
        : { dx: 0, dy: -Math.sign(screenDy) };
    input.emit('move', direction);
    runtime.update(1, 1);

    expect(arrivals).toContain('goal');
    runtime.dispose();
    input.clear();
  });

  it('cycle les mécanismes par proximité écran et affiche le contour de sélection', () => {
    const level = new Level(definition(true));
    const input = inputBus();
    const showFocus = vi.fn();
    const focusRing = {
      show: showFocus,
      hide: vi.fn(),
      move: vi.fn(),
      setPulsing: vi.fn(),
      dispose: vi.fn(),
    } as unknown as FocusRing;
    const runtime = new LevelRuntime({
      level,
      sceneRoot: new Group(),
      camera: camera(),
      input,
      focusRing,
      viewport: () => ({ width: 800, height: 600 }),
    });
    runtime.update(0, 0.016);

    input.emit('action', 'cycleNext');
    input.emit('action', 'rotateRight');

    const near = level.mechanisms.get('near');
    const far = level.mechanisms.get('far');
    expect(near).toBeInstanceOf(Rotator);
    expect(far).toBeInstanceOf(Rotator);
    expect(near?.isAnimating).toBe(true);
    expect(far?.isAnimating).toBe(false);
    expect(showFocus).toHaveBeenCalledOnce();

    runtime.dispose();
    input.clear();
  });

  it('aimante le mécanisme si la pause survient pendant un glissement', () => {
    const level = new Level(definition(true));
    const input = inputBus();
    const viewCamera = camera();
    const runtime = new LevelRuntime({
      level,
      sceneRoot: new Group(),
      camera: viewCamera,
      input,
      viewport: () => ({ width: 800, height: 600 }),
    });
    runtime.update(0, 0.016);
    const near = level.mechanisms.get('near');
    expect(near).toBeInstanceOf(Rotator);
    if (!(near instanceof Rotator)) return;

    const projected = near.root.getWorldPosition(new Vector3()).project(viewCamera);
    const x = (projected.x + 1) * 400;
    const y = (1 - projected.y) * 300;
    input.emit('dragStart', { x, y, ndcX: projected.x, ndcY: projected.y });
    input.emit('drag', {
      x,
      y: y + 40,
      ndcX: projected.x,
      ndcY: projected.y,
      deltaX: 0,
      deltaY: 40,
    });
    expect(near.isAnimating).toBe(false);

    runtime.pause();
    expect(near.isAnimating).toBe(true);

    runtime.dispose();
    input.clear();
  });
});
