/**
 * 02-parole.ts — « La promesse de pierre ».
 *
 * Vertu : parole donnée.
 * Statut : squelette de niveau (graphe minimal valide, à concevoir en
 * phase « Level design » — voir docs/LEVEL_DESIGN.md).
 *
 * Intention de design : un mécanisme que l'on actionne tient sa position, même quand cela devient gênant : ce que l'on a promis reste.
 */
import type { LevelDefinition } from '@world/Level';

export const level: LevelDefinition = {
  id: '02-parole',
  chapter: 2,
  virtue: 'parole',
  titleKey: 'levels.parole.title',
  proverbKey: 'proverbs.parole',
  sky: 'dawn',
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
