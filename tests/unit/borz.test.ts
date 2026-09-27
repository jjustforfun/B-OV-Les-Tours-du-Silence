/**
 * borz.test.ts — compagnon de phase 4.
 */
import { Group, Vector3 } from 'three';
import { afterEach, describe, expect, it } from 'vitest';
import { bus } from '@core/EventBus';
import { Borz } from '@entities/companion/Borz';
import { NavGraph } from '@world/NavGraph';

function sourceGraph(): NavGraph {
  const graph = new NavGraph();
  graph.addNode('turpal', { x: 0, y: 0, z: 0 });
  graph.addNode('b0', { x: 0, y: 0, z: 1 }, ['borz']);
  graph.addNode('b1', { x: 1, y: 0, z: 1 }, ['borz']);
  graph.addNode('b2', { x: 2, y: 0, z: 0 }, ['borz']);
  graph.addNode('not-borz', { x: 1, y: 0, z: 0 });
  graph.connect('b0', 'b1');
  graph.connect('b1', 'b2');
  graph.connect('b1', 'not-borz');
  return graph;
}

afterEach(() => bus.clear());

describe('Borz', () => {
  it('construit son propre graphe avec seulement les nœuds tagués borz', () => {
    const borz = new Borz();
    borz.rebuildOwnGraph(sourceGraph());

    expect(borz.ownGraph.hasNode('b0')).toBe(true);
    expect(borz.ownGraph.hasNode('not-borz')).toBe(false);
    expect(
      borz.ownGraph
        .neighbors('b1')
        .map((edge) => edge.to)
        .sort(),
    ).toEqual(['b0', 'b2']);
    borz.dispose();
  });

  it('rejoint Turpal quand il est appelé', () => {
    const graph = sourceGraph();
    const borz = new Borz();
    borz.rebuildOwnGraph(graph);
    borz.placeAt(graph, 'b0');
    const calls: string[] = [];
    bus.on('borz:called', (event) => calls.push(event.to));

    expect(borz.callTo(graph, 'turpal')).toBe(true);
    borz.update(0.6);
    borz.update(0.6);

    expect(calls).toEqual(['b0']);
    expect(borz.currentNode).toBe('b0');
    borz.dispose();
  });

  it('sert de pont et de marche, et peut porter Turpal par parentage temporaire', () => {
    const graph = new NavGraph();
    graph.addNode('a', { x: 0, y: 0, z: 0 });
    graph.addNode('b', { x: 1, y: 0, z: 0 });
    graph.addNode('step', { x: 0.5, y: 0.4, z: 0 });
    graph.setNodeEnabled('step', false);
    const borz = new Borz();
    const world = new Group();
    const turpal = new Group();
    world.add(borz.root, turpal);

    borz.serveAsBridge(graph, 'a', 'b', true);
    borz.serveAsStep(graph, 'step', true);
    borz.attachPassenger(turpal);

    expect(graph.areConnected('a', 'b')).toBe(true);
    expect(graph.getNode('step')?.enabled).toBe(true);
    expect(turpal.parent).toBe(borz.root);

    borz.detachPassenger(world);
    expect(turpal.parent).toBe(world);
    borz.dispose();
  });

  it("pulse ses yeux d'ambre quand il sait quelque chose", () => {
    const borz = new Borz();
    const events: boolean[] = [];
    bus.on('borz:hint', (event) => events.push(event.active));

    borz.setHintActive(true);
    borz.update(0.2);
    const firstPulse = borz.eyePulse;
    borz.update(0.2);

    expect(events).toEqual([true]);
    expect(borz.knowsHint).toBe(true);
    expect(borz.eyePulse).not.toBe(firstPulse);

    borz.lookAtTurpal(new Vector3(10, 0, 0));
    expect(borz.state).toBe('hinting');
    borz.dispose();
  });
});
