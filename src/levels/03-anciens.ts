/**
 * 03-anciens.ts — « Celui qui montre ».
 *
 * Vertu : respect des anciens.
 * Statut : squelette de niveau (graphe minimal valide, à concevoir en
 * phase « Level design » — voir docs/LEVEL_DESIGN.md).
 *
 * Intention de design : l'ancien désigne un chemin invisible ; il faut accepter de suivre une direction que l'on ne comprend pas encore.
 */
import type { LevelDefinition } from '@world/Level';

export const level: LevelDefinition = {
  id: '03-anciens',
  chapter: 3,
  virtue: 'anciens',
  titleKey: 'levels.anciens.title',
  proverbKey: 'proverbs.anciens',
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
