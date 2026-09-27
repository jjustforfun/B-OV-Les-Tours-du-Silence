/**
 * 00-prologue.ts — « Le Retour » (sous-titre : « Le seuil »).
 *
 * Rôle : apprendre à marcher, sans un mot. Un chemin unique, une tour, une
 * lumière au sommet. Aucun mécanisme : le joueur découvre seulement que
 * désigner un point y conduit Turpal, et que le monde est beau.
 *
 * Durée visée : 90 secondes. Aucune façon d'échouer.
 */
import type { LevelDefinition } from '@world/Level';

export const level: LevelDefinition = {
  id: '00-prologue',
  chapter: 0,
  virtue: 'prologue',
  titleKey: 'levels.prologue.title',
  proverbKey: 'proverbs.threshold',
  sky: 'dawn',
  spawn: 'start',
  goal: 'summit',
  camera: { target: [0, 1.5, 0], zoom: 9 },
  nodes: [
    { id: 'start', at: [-3, 0, 3], tags: ['spawn'], surface: 'grass' },
    { id: 'path-1', at: [-2, 0, 2] },
    { id: 'path-2', at: [-1, 0, 1] },
    { id: 'court', at: [0, 0, 0], tags: ['rest'] },
    { id: 'stair-1', at: [1, 0.5, 0] },
    { id: 'stair-2', at: [2, 1, 0] },
    { id: 'summit', at: [3, 1.5, 0], tags: ['goal'] },
  ],
  edges: [
    { from: 'start', to: 'path-1' },
    { from: 'path-1', to: 'path-2' },
    { from: 'path-2', to: 'court' },
    { from: 'court', to: 'stair-1' },
    { from: 'stair-1', to: 'stair-2' },
    { from: 'stair-2', to: 'summit' },
  ],
};
