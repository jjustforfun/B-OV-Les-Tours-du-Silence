/**
 * 07-epilogue.ts — « Ce que l'on bâtit ».
 *
 * Statut : squelette. Pas de puzzle : une montée.
 *
 * Toutes les structures manipulées par le joueur au cours des six chapitres
 * réapparaissent ici, assemblées en un seul escalier. Borz marche devant.
 * Le jeu se conclut sur la phrase qui le résume :
 * « Ce que l'on bâtit pour les autres finit par nous porter. »
 */
import type { LevelDefinition } from '@world/Level';

export const level: LevelDefinition = {
  id: '07-epilogue',
  chapter: 7,
  virtue: 'epilogue',
  titleKey: 'levels.epilogue.title',
  proverbKey: 'proverbs.epilogue',
  sky: 'snow',
  spawn: 'start',
  goal: 'sky',
  nodes: [
    { id: 'start', at: [0, 0, 0], tags: ['spawn'] },
    { id: 'rise-1', at: [0, 1, -1] },
    { id: 'rise-2', at: [0, 2, -2] },
    { id: 'sky', at: [0, 3, -3], tags: ['goal'] },
  ],
  edges: [
    { from: 'start', to: 'rise-1' },
    { from: 'rise-1', to: 'rise-2' },
    { from: 'rise-2', to: 'sky' },
  ],
};
