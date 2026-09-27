/**
 * navgraph.test.ts — le graphe de navigation est la vérité du gameplay.
 * S'il ment, Turpal marche dans le vide. Ces tests sont donc non négociables.
 */
import { describe, expect, it } from 'vitest';
import { DEFAULT_UP, NavGraph, distance } from '@world/NavGraph';
import { auditIllusions } from '@world/Illusion';

function buildLine(): NavGraph {
  const graph = new NavGraph();
  graph.addNode('a', { x: 0, y: 0, z: 0 }, ['spawn']);
  graph.addNode('b', { x: 1, y: 0, z: 0 });
  graph.addNode('c', { x: 2, y: 0, z: 0 }, ['goal']);
  graph.connect('a', 'b');
  graph.connect('b', 'c');
  return graph;
}

describe('NavGraph', () => {
  it('ajoute des nœuds sans doublon', () => {
    const graph = new NavGraph();
    graph.addNode('a', { x: 0, y: 0, z: 0 });
    graph.addNode('a', { x: 5, y: 5, z: 5 });

    expect(graph.nodeCount).toBe(1);
    expect(graph.getNode('a')?.position.x).toBe(0);
  });

  it('connecte dans les deux sens par défaut', () => {
    const graph = buildLine();
    expect(graph.areConnected('a', 'b')).toBe(true);
    expect(graph.areConnected('b', 'a')).toBe(true);
    expect(graph.edgeCount).toBe(4);
  });

  it('respecte les arêtes à sens unique', () => {
    const graph = new NavGraph();
    graph.addNode('haut', { x: 0, y: 2, z: 0 });
    graph.addNode('bas', { x: 0, y: 0, z: 0 });
    graph.connect('haut', 'bas', { oneWay: true });

    expect(graph.areConnected('haut', 'bas')).toBe(true);
    expect(graph.areConnected('bas', 'haut')).toBe(false);
  });

  it('ignore les connexions vers des nœuds inexistants', () => {
    const graph = buildLine();
    graph.connect('a', 'fantome');
    expect(graph.areConnected('a', 'fantome')).toBe(false);
  });

  it('exclut les voisins désactivés', () => {
    const graph = buildLine();
    graph.setNodeEnabled('b', false);
    expect(graph.neighbors('a')).toHaveLength(0);
  });

  it('coupe et rétablit les arêtes illusoires', () => {
    const graph = buildLine();
    graph.addNode('illusion', { x: 40, y: 0, z: 40 });
    graph.connect('c', 'illusion', { illusory: true });

    expect(graph.areConnected('c', 'illusion')).toBe(true);
    graph.setIllusoryEdgesEnabled(false);
    expect(graph.areConnected('c', 'illusion')).toBe(false);
    // Les arêtes normales survivent à la rotation de caméra.
    expect(graph.areConnected('a', 'b')).toBe(true);

    graph.setIllusoryEdgesEnabled(true);
    expect(graph.areConnected('c', 'illusion')).toBe(true);
  });

  it('retrouve les nœuds par étiquette', () => {
    const graph = buildLine();
    expect(graph.findNodesByTag('goal').map((node) => node.id)).toEqual(['c']);
  });

  it('trouve le nœud le plus proche d’un point', () => {
    const graph = buildLine();
    expect(graph.nearest({ x: 1.9, y: 0, z: 0 })?.id).toBe('c');
    expect(graph.nearest({ x: 50, y: 0, z: 0 }, 1)).toBeUndefined();
  });

  it('donne à chaque nœud une gravité normale par défaut (ADR-004)', () => {
    const graph = buildLine();
    expect(graph.getNode('a')?.up).toEqual(DEFAULT_UP);
  });

  it('accepte un « up » arbitraire : mur et plafond (ADR-004)', () => {
    const graph = new NavGraph();
    graph.addNode('mur', { x: 0, y: 2, z: 0 }, [], { x: 0, y: 0, z: 1 });
    graph.addNode('plafond', { x: 0, y: 4, z: 0 }, [], { x: 0, y: -1, z: 0 });

    expect(graph.getNode('mur')?.up).toEqual({ x: 0, y: 0, z: 1 });
    expect(graph.getNode('plafond')?.up.y).toBe(-1);
  });

  it('mesure les distances euclidiennes', () => {
    expect(distance({ x: 0, y: 0, z: 0 }, { x: 3, y: 4, z: 0 })).toBe(5);
  });
});


describe('NavGraph — arêtes conditionnelles (ADR-003)', () => {
  function withRotator(): NavGraph {
    const graph = new NavGraph();
    graph.addNode('quai', { x: 0, y: 0, z: 0 });
    graph.addNode('tour', { x: 3, y: 0, z: 0 });
    graph.connect('quai', 'tour', { condition: { mechanism: 'R', equals: 90 } });
    return graph;
  }

  it('naît fermée tant que le mécanisme n’est pas dans le bon état', () => {
    expect(withRotator().areConnected('quai', 'tour')).toBe(false);
  });

  it('s’ouvre quand le mécanisme atteint l’état requis', () => {
    const graph = withRotator();
    graph.setMechanismState('R', 90);

    expect(graph.areConnected('quai', 'tour')).toBe(true);
    expect(graph.areConnected('tour', 'quai')).toBe(true);
  });

  it('se referme dès que le mécanisme repart', () => {
    const graph = withRotator();
    graph.setMechanismState('R', 90);
    graph.setMechanismState('R', 180);

    expect(graph.areConnected('quai', 'tour')).toBe(false);
  });

  it('naît ouverte si le mécanisme est déjà dans le bon état', () => {
    const graph = new NavGraph();
    graph.addNode('a', { x: 0, y: 0, z: 0 });
    graph.addNode('b', { x: 1, y: 0, z: 0 });
    graph.setMechanismState('porte', true);
    graph.connect('a', 'b', { condition: { mechanism: 'porte', equals: true } });

    expect(graph.areConnected('a', 'b')).toBe(true);
    expect(graph.getMechanismState('porte')).toBe(true);
  });

  it('ne touche pas aux arêtes des autres mécanismes', () => {
    const graph = withRotator();
    graph.addNode('pont', { x: 0, y: 0, z: 3 });
    graph.connect('quai', 'pont');
    graph.setMechanismState('S', 45);

    expect(graph.areConnected('quai', 'pont')).toBe(true);
    expect(graph.areConnected('quai', 'tour')).toBe(false);
  });
});

describe('auditIllusions (ADR-003)', () => {
  it('valide un alignement parfait et chiffre l’écart des autres', () => {
    const projections = new Map([
      ['haut', { x: 100, y: 200 }],
      ['bas', { x: 103, y: 202 }],
      ['ailleurs', { x: 400, y: 200 }],
    ]);

    const [proche, loin] = auditIllusions(projections, [
      { a: 'haut', b: 'bas' },
      { a: 'haut', b: 'ailleurs' },
    ]);

    expect(proche?.aligned).toBe(true);
    expect(proche?.reason).toBe('aligned');
    expect(proche?.screenDistance).toBeCloseTo(Math.hypot(3, 2), 5);

    expect(loin?.aligned).toBe(false);
    expect(loin?.reason).toBe('too-far');
    expect(loin?.screenDistance).toBe(300);
  });

  it('signale un nœud non projeté plutôt que de l’ignorer', () => {
    const audit = auditIllusions(new Map([['a', { x: 0, y: 0 }]]), [{ a: 'a', b: 'absent' }]);
    expect(audit[0]?.reason).toBe('missing-projection');
    expect(audit[0]?.aligned).toBe(false);
  });
});
