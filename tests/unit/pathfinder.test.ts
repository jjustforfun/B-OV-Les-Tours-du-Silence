/**
 * pathfinder.test.ts — A* : chemins optimaux, déterministes, et absence de
 * plantage sur les graphes déconnectés (un puzzle en cours de conception
 * l'est souvent).
 */
import { describe, expect, it } from 'vitest';
import { NavGraph } from '@world/NavGraph';
import { findClosestReachable, findPath, reachableFrom, trimPathToSafe } from '@world/Pathfinder';

function grid(size: number): NavGraph {
  const graph = new NavGraph();
  for (let x = 0; x < size; x += 1) {
    for (let z = 0; z < size; z += 1) {
      graph.addNode(`${x},${z}`, { x, y: 0, z });
    }
  }
  for (let x = 0; x < size; x += 1) {
    for (let z = 0; z < size; z += 1) {
      if (x + 1 < size) graph.connect(`${x},${z}`, `${x + 1},${z}`);
      if (z + 1 < size) graph.connect(`${x},${z}`, `${x},${z + 1}`);
    }
  }
  return graph;
}

describe('findPath', () => {
  it('trouve le chemin le plus court sur une grille', () => {
    const result = findPath(grid(4), '0,0', '3,3');
    expect(result.found).toBe(true);
    expect(result.cost).toBe(6);
    expect(result.path[0]).toBe('0,0');
    expect(result.path.at(-1)).toBe('3,3');
    expect(result.path).toHaveLength(7);
  });

  it('retourne un chemin d’un seul nœud quand départ = arrivée', () => {
    const result = findPath(grid(3), '1,1', '1,1');
    expect(result.path).toEqual(['1,1']);
    expect(result.cost).toBe(0);
  });

  it('échoue proprement sur un graphe déconnecté', () => {
    const graph = grid(3);
    graph.addNode('ile', { x: 99, y: 0, z: 99 });
    const result = findPath(graph, '0,0', 'ile');

    expect(result.found).toBe(false);
    expect(result.path).toEqual([]);
  });

  it('refuse un départ ou une arrivée désactivés', () => {
    const graph = grid(3);
    graph.setNodeEnabled('2,2', false);
    expect(findPath(graph, '0,0', '2,2').found).toBe(false);
  });

  it('emprunte un raccourci illusoire quand il existe', () => {
    const graph = grid(5);
    graph.connect('0,0', '4,4', { illusory: true });

    const withIllusion = findPath(graph, '0,0', '4,4');
    expect(withIllusion.cost).toBe(1);

    graph.setIllusoryEdgesEnabled(false);
    const withoutIllusion = findPath(graph, '0,0', '4,4');
    expect(withoutIllusion.cost).toBe(8);
  });

  it("emprunte une arête dès qu'un mécanisme l'active", () => {
    const graph = new NavGraph();
    graph.addNode('start', { x: 0, y: 0, z: 0 });
    graph.addNode('door', { x: 1, y: 0, z: 0 });
    graph.addNode('goal', { x: 2, y: 0, z: 0 });
    graph.connect('start', 'door');
    graph.connect('door', 'goal', { condition: { mechanism: 'rotator', equals: 90 } });

    expect(findPath(graph, 'start', 'goal').found).toBe(false);
    graph.setMechanismState('rotator', 90);
    expect(findPath(graph, 'start', 'goal').path).toEqual(['start', 'door', 'goal']);
  });

  it('trouve un chemin sur un mur avec gravité locale', () => {
    const graph = new NavGraph();
    const wallUp = { x: 0, y: 0, z: 1 };
    graph.addNode('sol', { x: 0, y: 0, z: 0 });
    graph.addNode('mur-1', { x: 0, y: 1, z: 0 }, [], wallUp);
    graph.addNode('mur-2', { x: 0, y: 2, z: 0 }, [], wallUp, 'stone');
    graph.connect('sol', 'mur-1');
    graph.connect('mur-1', 'mur-2');

    expect(findPath(graph, 'sol', 'mur-2').path).toEqual(['sol', 'mur-1', 'mur-2']);
    expect(graph.getNode('mur-2')?.up).toEqual(wallUp);
  });

  it('est déterministe', () => {
    const graph = grid(4);
    const first = findPath(graph, '0,0', '3,3');
    const second = findPath(graph, '0,0', '3,3');
    expect(second.path).toEqual(first.path);
  });

  it('respecte les coûts d’arête', () => {
    const graph = new NavGraph();
    graph.addNode('a', { x: 0, y: 0, z: 0 });
    graph.addNode('detour', { x: 1, y: 0, z: 1 });
    graph.addNode('b', { x: 2, y: 0, z: 0 });
    graph.connect('a', 'b', { cost: 10 });
    graph.connect('a', 'detour', { cost: 1 });
    graph.connect('detour', 'b', { cost: 1 });

    expect(findPath(graph, 'a', 'b').path).toEqual(['a', 'detour', 'b']);
  });
});

describe('reachableFrom', () => {
  it('énumère la composante connexe', () => {
    const graph = grid(3);
    graph.addNode('ile', { x: 99, y: 0, z: 99 });
    const reachable = reachableFrom(graph, '0,0');

    expect(reachable.size).toBe(9);
    expect(reachable.has('ile')).toBe(false);
  });
});

describe('findClosestReachable', () => {
  it('propose le nœud atteignable le plus proche d’une cible isolée', () => {
    const graph = grid(3);
    graph.addNode('ile', { x: 3, y: 0, z: 2 });
    expect(findClosestReachable(graph, '0,0', 'ile')).toBe('2,2');
  });
});

describe('trimPathToSafe (ADR-005)', () => {
  it('laisse le chemin intact si rien n’a bougé', () => {
    const graph = grid(4);
    const path = findPath(graph, '0,0', '0,3').path;

    expect(trimPathToSafe(graph, path, 0)).toEqual(path);
  });

  it('coupe au dernier nœud sûr quand une arête disparaît devant', () => {
    const graph = grid(4);
    const path = findPath(graph, '0,0', '0,3').path; // 0,0 → 0,1 → 0,2 → 0,3
    graph.disconnect('0,1', '0,2');

    expect(trimPathToSafe(graph, path, 0)).toEqual(['0,0', '0,1']);
  });

  it('coupe aussi quand un nœud du chemin est désactivé', () => {
    const graph = grid(4);
    const path = findPath(graph, '0,0', '0,3').path;
    graph.setNodeEnabled('0,2', false);

    expect(trimPathToSafe(graph, path, 0)).toEqual(['0,0', '0,1']);
  });

  it('ne fait jamais reculer Turpal : le chemin déjà parcouru est conservé', () => {
    const graph = grid(4);
    const path = findPath(graph, '0,0', '0,3').path;
    graph.disconnect('0,0', '0,1');

    // Turpal est déjà sur 0,2 : la coupure derrière lui ne le concerne plus.
    expect(trimPathToSafe(graph, path, 2)).toEqual(['0,0', '0,1', '0,2', '0,3']);
  });

  it('immobilise sans planter si tout s’effondre devant', () => {
    const graph = grid(4);
    const path = findPath(graph, '0,0', '0,3').path;
    graph.disconnect('0,0', '0,1');

    expect(trimPathToSafe(graph, path, 0)).toEqual(['0,0']);
  });

  it('supporte un chemin vide ou un index hors bornes', () => {
    const graph = grid(3);
    expect(trimPathToSafe(graph, [], 0)).toEqual([]);
    expect(trimPathToSafe(graph, ['0,0', '0,1'], 99)).toEqual(['0,0', '0,1']);
  });
});
