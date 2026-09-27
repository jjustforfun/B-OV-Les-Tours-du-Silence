/**
 * turpal.test.ts — déplacement et gestes de Turpal.
 *
 * Phase 3 verrouille trois promesses de gameplay : vitesse constante le long
 * d'une polyligne, adoption fluide du `up` des nœuds (marche sur les murs) et
 * gestes non bloquants comme le salut à l'ancien.
 */
import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { PACING, TURPAL } from '@/config';
import { bus } from '@core/EventBus';
import { Turpal } from '@entities/player/Turpal';
import { TurpalModel } from '@entities/player/TurpalModel';
import { NavGraph } from '@world/NavGraph';

function graphWithLine(): NavGraph {
  const graph = new NavGraph();
  graph.addNode('a', { x: 0, y: 0, z: 0 });
  graph.addNode('b', { x: 1, y: 0, z: 0 });
  graph.addNode('c', { x: 2, y: 0, z: 0 });
  graph.connect('a', 'b');
  graph.connect('b', 'c');
  return graph;
}

describe('Turpal — path following', () => {
  it('avance à vitesse constante le long de la polyligne', () => {
    const graph = graphWithLine();
    const turpal = new Turpal(new TurpalModel());
    turpal.placeAt(graph, 'a');
    expect(turpal.goTo(graph, 'c')).toBe(true);

    turpal.update(graph, 0.1);
    expect(turpal.root.position.x).toBeCloseTo(PACING.walkSpeed * 0.1, 5);
    turpal.update(graph, 0.1);
    expect(turpal.root.position.x).toBeCloseTo(PACING.walkSpeed * 0.2, 5);
    turpal.dispose();
  });

  it('déclenche le clip de montée puis garde Turpal sur le chemin', () => {
    const graph = new NavGraph();
    graph.addNode('a', { x: 0, y: 0, z: 0 });
    graph.addNode('b', { x: 0, y: TURPAL.stairHeight, z: 0.7 });
    graph.connect('a', 'b');
    const model = new TurpalModel();
    const turpal = new Turpal(model);

    turpal.placeAt(graph, 'a');
    expect(turpal.goTo(graph, 'b')).toBe(true);
    expect(model.clip).toBe('stepUp');
    turpal.update(graph, 0.2);
    expect(turpal.root.position.y).toBeGreaterThan(0);
    turpal.dispose();
  });

  it('adopte progressivement le up du nœud suivant', () => {
    const graph = new NavGraph();
    graph.addNode('floor', { x: 0, y: 0, z: 0 });
    graph.addNode('wall', { x: 0, y: 0, z: 1 }, [], { x: 0, y: 0, z: 1 });
    graph.connect('floor', 'wall');
    const turpal = new Turpal(new TurpalModel());

    turpal.placeAt(graph, 'floor');
    expect(turpal.goTo(graph, 'wall')).toBe(true);
    for (let i = 0; i < 80; i += 1) turpal.update(graph, 1 / 60);

    const expected = new Vector3(0, 0, 1);
    expect(turpal.root.up.dot(expected)).toBeGreaterThan(0.95);
    turpal.dispose();
  });

  it('salue un ancien à portée sans bloquer le déplacement suivant', () => {
    const graph = graphWithLine();
    graph.addNode('elder', { x: 0.8, y: 0, z: 0.3 }, ['elder']);
    const model = new TurpalModel();
    const turpal = new Turpal(model);

    turpal.placeAt(graph, 'a');
    expect(turpal.saluteElder(graph)).toBe(true);
    expect(model.clip).toBe('salute');
    expect(turpal.goTo(graph, 'c')).toBe(true);
    expect(turpal.isMoving).toBe(true);
    turpal.dispose();
  });

  it('affiche puis dissout le marqueur de destination seulement si le chemin existe', () => {
    const graph = graphWithLine();
    const turpal = new Turpal(new TurpalModel());
    turpal.placeAt(graph, 'a');

    expect(turpal.goTo(graph, 'missing')).toBe(false);
    expect(turpal.destinationMarker.isVisible).toBe(false);

    expect(turpal.goTo(graph, 'c')).toBe(true);
    expect(turpal.destinationMarker.isVisible).toBe(true);
    for (let i = 0; i < 30; i += 1) turpal.update(graph, 1 / 60);
    expect(turpal.destinationMarker.isVisible).toBe(false);
    turpal.dispose();
  });

  it('revalide son chemin quand un mécanisme change le graphe', () => {
    const graph = graphWithLine();
    const turpal = new Turpal(new TurpalModel());
    turpal.placeAt(graph, 'a');
    expect(turpal.goTo(graph, 'c')).toBe(true);
    const unsubscribe = turpal.bindMechanismRevalidation(graph);

    graph.disconnect('b', 'c');
    bus.emit('mechanism:stateChanged', {
      id: 'door',
      kind: 'rotator',
      value: false,
      at: { x: 0, y: 0, z: 0 },
    });

    expect(turpal.movementProgress).toBe(0);
    turpal.update(graph, 0.6);
    expect(turpal.currentNode).not.toBe('c');
    unsubscribe();
    turpal.dispose();
  });
});
