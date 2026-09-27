/**
 * pointerinput.test.ts — picking tactile tolérant.
 *
 * Un levier de 20 px ne doit pas devenir impossible à toucher au pouce : si
 * le rayon central rate, `PointerInput.pickWithTolerance()` relance quatre
 * rayons à 12 px et retient la cible la plus proche du tap original.
 */
import { Mesh, MeshBasicMaterial, OrthographicCamera, PlaneGeometry } from 'three';
import { describe, expect, it } from 'vitest';
import { POINTER } from '@/config';
import { PointerInput, type PickableScreenTarget } from '@input/PointerInput';
import { NavGraph } from '@world/NavGraph';

interface Target {
  readonly id: string;
}

function target(
  id: string,
  x: number,
  y: number,
  radiusPx: number = POINTER.pickTargetRadiusPx,
): PickableScreenTarget<Target> {
  return { value: { id }, x, y, radiusPx };
}

function topCamera(): OrthographicCamera {
  const camera = new OrthographicCamera(-1, 1, 1, -1, 0.1, 20);
  camera.position.set(0, 0, 5);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld(true);
  camera.updateProjectionMatrix();
  return camera;
}

function walkablePlane(size: number): Mesh<PlaneGeometry, MeshBasicMaterial> {
  const mesh = new Mesh(new PlaneGeometry(size, size), new MeshBasicMaterial());
  mesh.updateMatrixWorld(true);
  return mesh;
}

describe('PointerInput.pickWithTolerance', () => {
  it('retient directement la cible sous le rayon central', () => {
    const hit = PointerInput.pickWithTolerance(100, 100, [target('lever', 104, 103)]);

    expect(hit?.value.id).toBe('lever');
    expect(hit?.sampleIndex).toBe(0);
    expect(hit?.usedFallback).toBe(false);
  });

  it('rattrape un petit levier de 20 px avec les 4 rayons de secours à 12 px', () => {
    const hit = PointerInput.pickWithTolerance(122, 100, [target('lever-20px', 100, 100, 10)]);

    expect(hit?.value.id).toBe('lever-20px');
    expect(hit?.usedFallback).toBe(true);
    expect(hit?.sampleIndex).toBe(4); // rayon gauche : 122 - 12 = 110, bord du levier.
    expect(hit?.sampleX).toBe(122 - POINTER.fallbackRayOffsetPx);
  });

  it('retient la cible la plus proche du tap original parmi les secours', () => {
    const hit = PointerInput.pickWithTolerance(124, 112, [
      target('loin', 100, 112, 12),
      target('proche', 124, 100, 10),
    ]);

    expect(hit?.value.id).toBe('proche');
    expect(hit?.distancePx).toBe(12);
  });

  it('ignore les cibles désactivées', () => {
    const hit = PointerInput.pickWithTolerance(100, 100, [
      { value: { id: 'disabled' }, x: 100, y: 100, enabled: false },
      target('enabled', 112, 100, 4),
    ]);

    expect(hit?.value.id).toBe('enabled');
    expect(hit?.usedFallback).toBe(true);
  });

  it('retourne null quand les cinq rayons ratent', () => {
    const hit = PointerInput.pickWithTolerance(0, 0, [target('too-far', 100, 100)]);

    expect(hit).toBeNull();
  });
});

describe('PointerInput.pickWalkableNode', () => {
  it('raycaste une surface marchable puis aimante au nœud le plus proche', () => {
    const graph = new NavGraph();
    graph.addNode('centre', { x: 0, y: 0, z: 0 }, [], undefined, 'grass');
    graph.addNode('coin', { x: 0.9, y: 0.9, z: 0 });

    const hit = PointerInput.pickWalkableNode({
      x: 100,
      y: 100,
      viewportWidth: 200,
      viewportHeight: 200,
      camera: topCamera(),
      walkableSurfaces: [walkablePlane(2)],
      graph,
    });

    expect(hit?.node.id).toBe('centre');
    expect(hit?.node.surface).toBe('grass');
    expect(hit?.usedFallback).toBe(false);
  });

  it('élargit la tolérance du raycast sur mobile avant le snap au nœud', () => {
    const graph = new NavGraph();
    graph.addNode('bord', { x: 0.5, y: 0, z: 0 });

    const desktopMiss = PointerInput.pickWalkableNode({
      x: 156,
      y: 100,
      viewportWidth: 200,
      viewportHeight: 200,
      camera: topCamera(),
      walkableSurfaces: [walkablePlane(1)],
      graph,
      isMobile: false,
    });
    const mobileHit = PointerInput.pickWalkableNode({
      x: 156,
      y: 100,
      viewportWidth: 200,
      viewportHeight: 200,
      camera: topCamera(),
      walkableSurfaces: [walkablePlane(1)],
      graph,
      isMobile: true,
    });

    expect(desktopMiss).toBeNull();
    expect(mobileHit?.node.id).toBe('bord');
    expect(mobileHit?.usedFallback).toBe(true);
  });
});
