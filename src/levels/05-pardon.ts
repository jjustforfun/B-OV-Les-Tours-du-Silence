/**
 * 05-pardon.ts — « La pierre rendue ».
 *
 * Vertu : pardon.
 * Statut : squelette de niveau (graphe minimal valide, à concevoir en
 * phase « Level design » — voir docs/LEVEL_DESIGN.md).
 *
 * Intention de design : un chemin brisé par le joueur lui-même doit être réparé ; la gravité bascule et ce qui séparait devient ce qui relie.
 */
import type { LevelDefinition } from '@world/Level';

export const level: LevelDefinition = {
  id: '05-pardon',
  chapter: 5,
  virtue: 'pardon',
  titleKey: 'levels.pardon.title',
  proverbKey: 'proverbs.pardon',
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
