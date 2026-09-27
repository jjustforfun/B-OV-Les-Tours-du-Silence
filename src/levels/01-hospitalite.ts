/**
 * 01-hospitalite.ts — « La porte ouverte ».
 *
 * Vertu : hospitalité.
 * Statut : squelette de niveau (graphe minimal valide, à concevoir en
 * phase « Level design » — voir docs/LEVEL_DESIGN.md).
 *
 * Intention de design : le joueur doit ouvrir un chemin pour quelqu'un d'autre avant de passer lui-même ; la première tour se traverse par son foyer.
 */
import type { LevelDefinition } from '@world/Level';

export const level: LevelDefinition = {
  id: '01-hospitalite',
  chapter: 1,
  virtue: 'hospitalite',
  titleKey: 'levels.hospitalite.title',
  proverbKey: 'proverbs.hospitalite',
  sky: 'mist',
  spawn: 'start',
  goal: 'goal',
  nodes: [
    { id: 'start', at: [-2, 0, 0], tags: ['spawn'] },
    { id: 'mid', at: [0, 0, 0] },
    { id: 'goal', at: [2, 0, 0], tags: ['goal'] },
  ],
  edges: [
    { from: 'start', to: 'mid' },
    { from: 'mid', to: 'goal' },
  ],
};
