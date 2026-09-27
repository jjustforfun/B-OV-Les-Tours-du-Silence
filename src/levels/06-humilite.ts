/**
 * 06-humilite.ts — « La tour qui se baisse ».
 *
 * Vertu : humilité.
 * Statut : squelette de niveau (graphe minimal valide, à concevoir en
 * phase « Level design » — voir docs/LEVEL_DESIGN.md).
 *
 * Intention de design : la plus haute tour ne s'ouvre qu'en descendant ; le joueur doit renoncer au sommet pour y accéder.
 */
import type { LevelDefinition } from '@world/Level';

export const level: LevelDefinition = {
  id: '06-humilite',
  chapter: 6,
  virtue: 'humilite',
  titleKey: 'levels.humilite.title',
  proverbKey: 'proverbs.humilite',
  sky: 'snow',
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
