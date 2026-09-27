/**
 * progress.test.ts — progression musicale et arêtes qui s'ouvrent.
 *
 * Une couche musicale se « mérite » : drone dès l'entrée, pondar à la
 * première manipulation, doul à mi-résolution, mélodie quand le chemin
 * final se referme. Les couches ne redescendent jamais.
 */
import { describe, expect, it } from 'vitest';
import { NavGraph } from '@world/NavGraph';
import type { LevelDefinition } from '@world/Level';
import {
  computeMusicLayers,
  conditionalEdgeSnapshot,
  edgeKey,
  newlyEnabledEdgeKeys,
} from '@world/progress';

function definition(): LevelDefinition {
  return {
    id: 'test-progress',
    chapter: 0,
    virtue: 'prologue',
    titleKey: 't',
    proverbKey: 'p',
    sky: 'dawn',
    spawn: 'a',
    goal: 'c',
    nodes: [
      { id: 'a', at: [0, 0, 0] },
      { id: 'b', at: [1, 0, 0] },
      { id: 'c', at: [2, 0, 0] },
      { id: 'd', at: [3, 0, 0] },
    ],
    edges: [
      { from: 'a', to: 'b' },
      { from: 'b', to: 'c', condition: { mechanism: 'R', equals: 90 } },
      { from: 'c', to: 'd', condition: { mechanism: 'S', equals: true } },
    ],
    mechanisms: [
      {
        id: 'R',
        kind: 'rotator',
        at: [1, 0, 0],
        affects: [{ from: 'b', to: 'c', condition: { mechanism: 'R', equals: 90 } }],
      },
      {
        id: 'S',
        kind: 'slider',
        at: [2, 0, 0],
        affects: [{ from: 'c', to: 'd', condition: { mechanism: 'S', equals: true } }],
      },
    ],
  };
}

function inputs(overrides: {
  states?: ReadonlyMap<string, number | string | boolean>;
  actuated?: ReadonlySet<string>;
  goalReachable?: boolean;
}) {
  return {
    definition: definition(),
    mechanismStates: overrides.states ?? new Map(),
    actuatedMechanisms: overrides.actuated ?? new Set<string>(),
    goalReachable: overrides.goalReachable ?? false,
  };
}

describe('computeMusicLayers', () => {
  it('couche 1 (drone) dès l’entrée, sans rien manipuler', () => {
    expect(computeMusicLayers(inputs({}))).toBe(1);
  });

  it('couche 2 (pondar) à la première manipulation', () => {
    expect(computeMusicLayers(inputs({ actuated: new Set(['R']) }))).toBe(2);
  });

  it('couche 3 (doul) à mi-résolution : un mécanisme sur deux résolu', () => {
    expect(
      computeMusicLayers(
        inputs({
          states: new Map([
            ['R', 90],
            ['S', 0],
          ]),
          actuated: new Set(['R']),
        }),
      ),
    ).toBe(3);
  });

  it('couche 4 (mélodie) quand le chemin final se referme', () => {
    expect(computeMusicLayers(inputs({ goalReachable: true }))).toBe(4);
  });

  it('les couches ne se retirent pas : goalReachable domine tout', () => {
    expect(
      computeMusicLayers(
        inputs({
          states: new Map([['R', 90]]),
          actuated: new Set(['R']),
          goalReachable: true,
        }),
      ),
    ).toBe(4);
  });
});

describe('conditionalEdgeSnapshot / newlyEnabledEdgeKeys', () => {
  it('photographie les arêtes conditionnelles, actives ou non', () => {
    const graph = new NavGraph();
    graph.addNode('a', { x: 0, y: 0, z: 0 });
    graph.addNode('b', { x: 1, y: 0, z: 0 });
    graph.connect('a', 'b', { condition: { mechanism: 'R', equals: 90 } });
    const snapshot = conditionalEdgeSnapshot(graph);
    expect(snapshot.get(edgeKey('a', 'b'))).toBe(false); // condition non satisfaite
    expect(snapshot.size).toBe(1);
  });

  it('détecte uniquement les arêtes devenues franchissables', () => {
    const before = new Map([
      ['a|b', false],
      ['b|c', true],
    ]);
    const after = new Map([
      ['a|b', true], // vient de s'ouvrir
      ['b|c', true], // était déjà ouverte
      ['c|d', false], // toujours fermée
    ]);
    expect(newlyEnabledEdgeKeys(before, after)).toEqual(['a|b']);
  });

  it('edgeKey est canonique, indépendante du sens de parcours', () => {
    expect(edgeKey('a', 'b')).toBe(edgeKey('b', 'a'));
    expect(edgeKey('b', 'a')).toBe('a|b');
  });
});
