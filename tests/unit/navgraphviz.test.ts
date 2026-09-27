/**
 * navgraphviz.test.ts — overlay de debug du graphe de navigation.
 *
 * Le visualiseur doit montrer aussi les passages coupés : c'est justement ce
 * dont un level designer a besoin pour diagnostiquer une condition ou une
 * illusion qui ne s'ouvre pas.
 */
import { describe, expect, it } from 'vitest';
import { NavGraphViz, isNavGraphDebugEnabled } from '@debug/NavGraphViz';
import { NavGraph } from '@world/NavGraph';

function graphWithStates(): NavGraph {
  const graph = new NavGraph();
  graph.addNode('a', { x: 0, y: 0, z: 0 }, ['spawn']);
  graph.addNode('b', { x: 1, y: 0, z: 0 });
  graph.addNode('c', { x: 2, y: 0, z: 0 });
  graph.addNode('d', { x: 3, y: 0, z: 0 }, ['goal']);
  graph.connect('a', 'b', { oneWay: true });
  graph.connect('b', 'c', { oneWay: true, condition: { mechanism: 'door', equals: true } });
  graph.connect('c', 'd', { oneWay: true, illusory: true });
  return graph;
}

describe('NavGraphViz', () => {
  it('affiche les nœuds et toutes les arêtes, même celles qui sont fermées', () => {
    const graph = graphWithStates();
    const viz = new NavGraphViz();

    viz.rebuild(graph);

    expect(viz.nodeVisualCount).toBe(4);
    expect(viz.edgeVisualCount).toBe(3);
    expect(viz.nodes.map((node) => node.id)).toEqual(['a', 'b', 'c', 'd']);
    expect(viz.edges.map((edge) => `${edge.from}->${edge.to}:${edge.state}`)).toEqual([
      'a->b:edge',
      'b->c:conditional-closed',
      'c->d:illusion-open',
    ]);
    viz.dispose();
  });

  it('colore les arêtes conditionnelles selon leur état courant', () => {
    const graph = graphWithStates();
    const viz = new NavGraphViz();

    viz.rebuild(graph);
    expect(viz.edges.find((edge) => edge.from === 'b' && edge.to === 'c')?.state).toBe(
      'conditional-closed',
    );

    graph.setMechanismState('door', true);
    viz.rebuild(graph);
    expect(viz.edges.find((edge) => edge.from === 'b' && edge.to === 'c')?.state).toBe(
      'conditional-open',
    );
    viz.dispose();
  });

  it('distingue les illusions ouvertes et coupées', () => {
    const graph = graphWithStates();
    const viz = new NavGraphViz();

    graph.setIllusoryConnectionEnabled('c', 'd', false, false);
    viz.rebuild(graph);
    expect(viz.edges.find((edge) => edge.from === 'c' && edge.to === 'd')?.state).toBe(
      'illusion-closed',
    );

    graph.setIllusoryConnectionEnabled('c', 'd', true, false);
    viz.rebuild(graph);
    expect(viz.edges.find((edge) => edge.from === 'c' && edge.to === 'd')?.state).toBe(
      'illusion-open',
    );
    viz.dispose();
  });

  it('se déclenche avec le flag URL ?debug=nav', () => {
    expect(isNavGraphDebugEnabled('?debug=nav')).toBe(true);
    expect(isNavGraphDebugEnabled('?debug=stats,nav')).toBe(true);
    expect(isNavGraphDebugEnabled('?showcase=demo&debug=stats')).toBe(false);
  });
});
