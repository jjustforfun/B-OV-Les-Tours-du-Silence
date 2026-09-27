/**
 * nodeprojection.test.ts — projection écran des nœuds de navigation.
 *
 * Le picking, les illusions et le debug nav consommeront ces coordonnées à
 * chaque image. Le test verrouille donc la précision, la réutilisation des
 * buffers et le budget : 300 nœuds projetés en moins de 0,2 ms en moyenne.
 */
import { OrthographicCamera } from 'three';
import { describe, expect, it } from 'vitest';
import { Level, type LevelDefinition } from '@world/Level';
import { NavGraph } from '@world/NavGraph';
import { NodeProjection, type MutableScreenPoint } from '@world/NodeProjection';

function makeCamera(): OrthographicCamera {
  const camera = new OrthographicCamera(-5, 5, 5, -5, 0.1, 100);
  camera.position.set(0, 0, 10);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld(true);
  camera.matrixWorldInverse.copy(camera.matrixWorld).invert();
  camera.updateProjectionMatrix();
  return camera;
}

function makeGraph(count: number): NavGraph {
  const graph = new NavGraph();
  for (let i = 0; i < count; i += 1) {
    const x = (i % 20) * 0.2 - 1.9;
    const y = Math.floor(i / 20) * 0.2 - 1.4;
    const z = (i % 7) * 0.03;
    graph.addNode(`n${i}`, { x, y, z });
  }
  return graph;
}

describe('NodeProjection', () => {
  it('projette le centre du monde au centre du viewport', () => {
    const graph = new NavGraph();
    graph.addNode('n0', { x: 0, y: 0, z: 0 });
    const camera = makeCamera();
    const projection = new NodeProjection();
    const point: MutableScreenPoint = { x: 0, y: 0 };

    projection.rebuild(graph);
    projection.project(
      camera.projectionMatrix.elements,
      camera.matrixWorldInverse.elements,
      800,
      600,
    );

    expect(projection.writeScreenPoint('n0', point)).toBe(true);
    expect(point.x).toBeCloseTo(400, 4);
    expect(point.y).toBeCloseTo(300, 4);
    expect(projection.isVisible('n0')).toBe(true);
  });

  it('réutilise ses buffers après rebuild et project', () => {
    const graph = makeGraph(12);
    const camera = makeCamera();
    const projection = new NodeProjection();

    projection.rebuild(graph);
    const xBuffer = projection.screenXBuffer;
    const yBuffer = projection.screenYBuffer;
    const visibleBuffer = projection.visibleBuffer;

    for (let i = 0; i < 20; i += 1) {
      projection.syncPositions(graph);
      projection.project(
        camera.projectionMatrix.elements,
        camera.matrixWorldInverse.elements,
        390,
        844,
      );
    }

    expect(projection.screenXBuffer).toBe(xBuffer);
    expect(projection.screenYBuffer).toBe(yBuffer);
    expect(projection.visibleBuffer).toBe(visibleBuffer);
  });

  it('projette 300 nœuds en moins de 0,2 ms en moyenne', () => {
    const graph = makeGraph(300);
    const camera = makeCamera();
    const projection = new NodeProjection();
    projection.rebuild(graph);

    for (let i = 0; i < 100; i += 1) {
      projection.syncPositions(graph);
      projection.project(
        camera.projectionMatrix.elements,
        camera.matrixWorldInverse.elements,
        1920,
        1080,
      );
    }

    const iterations = 2_000;
    const start = performance.now();
    for (let i = 0; i < iterations; i += 1) {
      projection.syncPositions(graph);
      projection.project(
        camera.projectionMatrix.elements,
        camera.matrixWorldInverse.elements,
        1920,
        1080,
      );
    }
    const averageMs = (performance.now() - start) / iterations;

    expect(averageMs).toBeLessThan(0.2);
  });

  it('est branchée sur Level.projectNodes pour le runtime par frame', () => {
    const definition: LevelDefinition = {
      id: 'projection-test',
      chapter: 0,
      virtue: 'prologue',
      titleKey: 'test.title',
      proverbKey: 'test.proverb',
      sky: 'dawn',
      spawn: 'a',
      goal: 'b',
      nodes: [
        { id: 'a', at: [0, 0, 0] },
        { id: 'b', at: [1, 0, 0] },
      ],
      edges: [{ from: 'a', to: 'b' }],
    };
    const camera = makeCamera();
    const level = new Level(definition);

    const projection = level.projectNodes(
      camera.projectionMatrix.elements,
      camera.matrixWorldInverse.elements,
      800,
      600,
    );

    expect(projection.count).toBe(2);
    expect(projection.isVisible('a')).toBe(true);
    level.dispose();
  });
});
