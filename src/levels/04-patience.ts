/**
 * 04-patience.ts — « Le lac immobile ».
 *
 * Vertu : patience.
 * Statut : squelette de niveau (graphe minimal valide, à concevoir en
 * phase « Level design » — voir docs/LEVEL_DESIGN.md).
 *
 * Intention de design : sur le lac Kezenoy-Am, un pont se forme lentement et ne peut pas être hâté ; attendre est la solution.
 */
import type { LevelDefinition } from '@world/Level';

export const level: LevelDefinition = {
  id: '04-patience',
  chapter: 4,
  virtue: 'patience',
  titleKey: 'levels.patience.title',
  proverbKey: 'proverbs.patience',
  sky: 'dusk',
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
