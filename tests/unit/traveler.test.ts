/** Traveler — trajet autonome et retour discret du foyer. */
import { describe, expect, it } from 'vitest';
import { HearthSmoke, Traveler } from '@entities/npc/Traveler';
import { NavGraph } from '@world/NavGraph';

describe('Traveler', () => {
  it("ne part qu'une fois et signale la fin de sa traversée", () => {
    const graph = new NavGraph();
    graph.addNode('wait', { x: 0, y: 0, z: 2 });
    graph.addNode('bridge', { x: 0, y: 0, z: 1 });
    graph.addNode('exit', { x: 0, y: 0, z: 0 });
    const traveler = new Traveler();
    traveler.placeAt(graph, 'wait');

    expect(traveler.start(graph, ['wait', 'bridge', 'exit'])).toBe(true);
    expect(traveler.start(graph, ['wait', 'exit'])).toBe(false);
    expect(traveler.update(3)).toBe(true);
    expect(traveler.root.position.z).toBeCloseTo(0, 5);
    expect(traveler.update(1)).toBe(false);
    traveler.dispose();
  });

  it('fait revenir une fumée légère sans autre récompense', () => {
    const smoke = new HearthSmoke();
    expect(smoke.root.visible).toBe(false);
    smoke.reveal();
    smoke.update(1);
    expect(smoke.root.visible).toBe(true);
    expect(smoke.root.children).toHaveLength(6);
    smoke.dispose();
  });
});
