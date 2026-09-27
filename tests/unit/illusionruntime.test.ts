/**
 * illusionruntime.test.ts — activation automatique des arêtes illusoires.
 *
 * Une illusion est un passage qui naît uniquement quand deux nœuds se
 * superposent à l'écran. Ces tests vérifient le comportement runtime : fermé
 * tant que non projeté, ouvert au bon angle, refermé dès que la caméra bouge.
 */
import { OrthographicCamera } from 'three';
import { describe, expect, it } from 'vitest';
import { ILLUSION_TOLERANCE_PX, resolveIllusions } from '@world/Illusion';
import { Level, type LevelDefinition } from '@world/Level';
import { NavGraph } from '@world/NavGraph';

function cameraAt(x: number, y: number, z: number): OrthographicCamera {
  const camera = new OrthographicCamera(-3, 3, 3, -3, 0.1, 100);
  camera.position.set(x, y, z);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld(true);
  camera.matrixWorldInverse.copy(camera.matrixWorld).invert();
  camera.updateProjectionMatrix();
  return camera;
}

function levelWithIllusion(condition = false): Level {
  const definition: LevelDefinition = {
    id: 'illusion-runtime-test',
    chapter: 0,
    virtue: 'prologue',
    titleKey: 'test.title',
    proverbKey: 'test.proverb',
    sky: 'dawn',
    spawn: 'near',
    goal: 'far',
    nodes: [
      { id: 'near', at: [0, 0, 0] },
      { id: 'far', at: [0, 0, -1] },
    ],
    edges: [
      {
        from: 'near',
        to: 'far',
        illusory: true,
        ...(condition ? { condition: { mechanism: 'rotator', equals: 90 } } : {}),
      },
    ],
  };
  return new Level(definition);
}

describe('Illusion runtime', () => {
  it("ouvre l'arête au bon angle puis la referme quand la caméra bouge", () => {
    const level = levelWithIllusion();
    const alignedCamera = cameraAt(0, 0, 10);
    const shiftedCamera = cameraAt(3, 0, 10);

    expect(level.graph.areConnected('near', 'far')).toBe(false);

    level.projectNodes(
      alignedCamera.projectionMatrix.elements,
      alignedCamera.matrixWorldInverse.elements,
      800,
      600,
    );
    expect(level.graph.areConnected('near', 'far')).toBe(true);
    expect(level.illusions.activeTotal).toBe(1);

    level.projectNodes(
      shiftedCamera.projectionMatrix.elements,
      shiftedCamera.matrixWorldInverse.elements,
      800,
      600,
    );
    expect(level.graph.areConnected('near', 'far')).toBe(false);
    expect(level.illusions.activeTotal).toBe(0);
    level.dispose();
  });

  it('respecte aussi les conditions de mécanisme', () => {
    const level = levelWithIllusion(true);
    const camera = cameraAt(0, 0, 10);

    level.projectNodes(
      camera.projectionMatrix.elements,
      camera.matrixWorldInverse.elements,
      800,
      600,
    );
    expect(level.illusions.activeTotal).toBe(1);
    expect(level.graph.areConnected('near', 'far')).toBe(false);

    level.graph.setMechanismState('rotator', 90);
    expect(level.graph.areConnected('near', 'far')).toBe(true);

    level.graph.setMechanismState('rotator', 180);
    expect(level.graph.areConnected('near', 'far')).toBe(false);
    level.dispose();
  });

  it('garde la version pure resolveIllusions compatible avec les outils', () => {
    const graph = new NavGraph();
    graph.addNode('a', { x: 0, y: 0, z: 0 });
    graph.addNode('b', { x: 10, y: 0, z: 0 });
    const projections = new Map([
      ['a', { x: 100, y: 100 }],
      ['b', { x: 100 + ILLUSION_TOLERANCE_PX, y: 100 }],
    ]);

    const active = resolveIllusions(graph, projections, [{ a: 'a', b: 'b' }]);
    expect(active).toHaveLength(1);
    expect(graph.areConnected('a', 'b')).toBe(true);

    projections.set('b', { x: 200, y: 100 });
    resolveIllusions(graph, projections, [{ a: 'a', b: 'b' }]);
    expect(graph.areConnected('a', 'b')).toBe(false);
  });
});
