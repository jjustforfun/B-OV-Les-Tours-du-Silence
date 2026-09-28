/**
 * 03-anciens.ts — chapitre 3, « Le Respect des anciens ».
 *
 * Turpal et Borz abaissent trois travées pour accorder l'architecture au pas
 * d'un ancien. Deux tours distantes de huit unités sur chaque axe se confondent
 * ensuite à l'écran : l'ancien, puis Turpal, traversent cette fausse tour.
 *
 * Durée de première découverte visée : 9 minutes. Les dalles sont
 * verrouillantes et l'ancien marche en boucle tant que la travée suivante
 * n'est pas prête : aucune pression temporelle, aucun échec.
 */
import type { LevelDefinition } from '@world/Level';

const finalConditions = [
  { mechanism: 'elder-plate-a', equals: true },
  { mechanism: 'elder-plate-b', equals: true },
  { mechanism: 'elder-plate-c', equals: true },
  { mechanism: 'elder-crossed', equals: true },
] as const;

export const level: LevelDefinition = {
  id: '03-anciens',
  chapter: 3,
  virtue: 'anciens',
  titleKey: 'levels.anciens.title',
  proverbKey: 'proverbs.anciens',
  sky: 'mist',
  palette: 'anciens',
  music: {
    mode: 'dorian',
    root: 'C3',
    strings: ['C3', 'G3', 'C4'],
  },
  ambience: ['wind', 'bells'],
  durationMinutes: { target: 9, min: 5, max: 12 },
  spawn: 'start',
  goal: 'goal',
  camera: { target: [1.5, 10, 2], zoom: 22 },
  geometry: [
    // Terrasse haute de Turpal et voie séparée de Borz.
    { kind: 'block', at: [-7, 2.8, -3], size: [7, 5.6, 5.5] },
    { kind: 'platform', at: [-7, 5.68, -3], size: [7.2, 0.24, 5.7] },
    { kind: 'platform', at: [-8, 5.68, -1.5], size: [2.4, 0.22, 1.3] },
    { kind: 'bridge', at: [-6.1, 5.45, -2], size: [1.7, 0.22, 0.75] },
    { kind: 'platform', at: [-4.2, 5.18, -2.6], size: [1.4, 0.22, 1.4] },

    // Descente de Turpal, libérée seulement quand Borz atteint sa dalle.
    { kind: 'stair', at: [-4.05, 5.1, -2.25], size: [1.1, 0.55, 1.15] },
    { kind: 'stair', at: [-3.25, 4.3, -1.85], size: [1.1, 0.55, 1.15] },
    { kind: 'stair', at: [-2.45, 3.5, -1.45], size: [1.1, 0.55, 1.15] },
    { kind: 'platform', at: [-1, 2.95, -1], size: [2.5, 0.3, 2.4] },

    // L'ancien attend sur une boucle sûre devant la première travée.
    { kind: 'platform', at: [-8, 2.95, 4], size: [2.8, 0.3, 2.6] },
    { kind: 'block', at: [-8, 1.4, 4], size: [3, 2.8, 2.8] },

    // Trois travées réellement abaissées, de h=3, h=2 puis h=1 vers h=0.
    {
      kind: 'platform',
      at: [-5.5, 5.4, 3],
      size: [3.2, 0.34, 2],
      parent: 'elder-plate-a',
      moveTo: [-5.5, 3.15, 3],
      moveStage: 1,
    },
    {
      kind: 'platform',
      at: [-2.5, 4.75, 2],
      size: [3, 0.34, 1.9],
      parent: 'elder-plate-b',
      moveTo: [-2.5, 3.15, 2],
      moveStage: 1,
    },
    {
      kind: 'bridge',
      at: [-0.8, 4.2, 1.6],
      size: [1.55, 0.32, 1.5],
      parent: 'elder-plate-c',
      moveTo: [-0.8, 3.15, 1.6],
      moveStage: 1,
    },
    {
      kind: 'bridge',
      at: [0, 4.2, 1.3],
      size: [1.55, 0.32, 1.5],
      parent: 'elder-plate-c',
      moveTo: [0, 3.15, 1.3],
      moveStage: 2,
    },
    {
      kind: 'bridge',
      at: [0.8, 4.2, 1],
      size: [1.55, 0.32, 1.5],
      parent: 'elder-plate-c',
      moveTo: [0.8, 3.15, 1],
      moveStage: 3,
    },

    // Stèle du secret : elle descend avec le dernier mouvement architectural.
    {
      kind: 'block',
      at: [-1.2, 5, 4.6],
      size: [0.8, 2.2, 0.8],
      parent: 'elder-plate-c',
      moveTo: [-1.2, 2.9, 4.6],
      moveStage: 3,
    },

    // Nécropole : stèles basses, intactes et sans inscription inventée.
    { kind: 'block', at: [-6.9, 1.05, 5.4], size: [0.65, 2.1, 0.65] },
    { kind: 'block', at: [-4.7, 0.85, 5.1], size: [0.58, 1.7, 0.58] },
    { kind: 'block', at: [-3.3, 1.2, 4.7], size: [0.7, 2.4, 0.7] },
    { kind: 'block', at: [0.2, 0.95, 4.3], size: [0.62, 1.9, 0.62] },
    { kind: 'platform', at: [-3.7, -0.2, 3.8], size: [11, 0.4, 6.5] },

    // Tours jumelles : leurs centres diffèrent de [8,8,8], donc leur projection coïncide.
    { kind: 'tower', at: [1, 10, 1], size: [4.8, 14, 4.8] },
    { kind: 'tower', at: [9, 18, 9], size: [4.8, 14, 4.8] },
    { kind: 'platform', at: [10.5, 10.85, 7.8], size: [6.4, 0.3, 5.5] },
    { kind: 'arch', at: [11, 12.3, 7.2], size: [2.8, 2.4, 0.8] },
  ],
  nodes: [
    { id: 'start', at: [-8.8, 5.82, -4], tags: ['spawn'], surface: 'stone' },
    { id: 'high-path', at: [-7.2, 5.82, -3.6], surface: 'stone' },
    {
      id: 'plate-a',
      at: [-5, 5.82, -3],
      tags: ['mechanism:elder-plate-a', 'cooperator:elder-plate-b'],
      surface: 'stone',
    },
    { id: 'descent-1', at: [-4.05, 5.38, -2.25], surface: 'stone' },
    { id: 'descent-2', at: [-3.25, 4.58, -1.85], surface: 'stone' },
    { id: 'descent-3', at: [-2.45, 3.78, -1.45], surface: 'stone' },
    {
      id: 'plate-c',
      at: [-1, 3.15, -1],
      tags: ['mechanism:elder-plate-c'],
      surface: 'stone',
    },

    // Graphe propre de Borz, physiquement proche mais déconnecté de Turpal.
    { id: 'borz-start', at: [-8, 5.82, -1.5], tags: ['borz'], surface: 'stone' },
    { id: 'borz-mid', at: [-6.1, 5.58, -2], tags: ['borz'], surface: 'stone' },
    {
      id: 'plate-b',
      at: [-4.2, 5.32, -2.6],
      tags: ['borz', 'mechanism:elder-plate-b'],
      surface: 'stone',
    },

    // Parcours autonome de l'ancien, sans arêtes marchables avant la fin.
    { id: 'elder-wait', at: [-8, 3.15, 4], tags: ['elder:loop'], surface: 'stone' },
    { id: 'elder-a', at: [-5.5, 3.34, 3], tags: ['elder:path'], surface: 'stone' },
    { id: 'elder-b', at: [-2.5, 3.34, 2], tags: ['elder:path'], surface: 'stone' },
    { id: 'twin-a-door', at: [1, 3.2, 1], tags: ['elder:path'], surface: 'stone' },
    { id: 'twin-b-door', at: [9, 11.2, 9], tags: ['elder:path'], surface: 'stone' },
    {
      id: 'elder-end',
      at: [10.5, 11.15, 7.8],
      tags: ['elder', 'elder:end'],
      surface: 'stone',
    },
    { id: 'goal', at: [11, 11.15, 7.2], tags: ['goal'], surface: 'stone' },

    {
      id: 'eagle-secret',
      at: [-1.2, 4.16, 4.6],
      tags: ['secret:eagle'],
      surface: 'stone',
    },
  ],
  edges: [
    { from: 'start', to: 'high-path' },
    { from: 'high-path', to: 'plate-a' },
    {
      from: 'plate-a',
      to: 'descent-1',
      condition: { mechanism: 'elder-plate-b', equals: true },
    },
    { from: 'descent-1', to: 'descent-2' },
    { from: 'descent-2', to: 'descent-3' },
    { from: 'descent-3', to: 'plate-c' },
    { from: 'plate-c', to: 'twin-a-door', conditions: finalConditions },
    {
      from: 'twin-a-door',
      to: 'twin-b-door',
      illusory: true,
      conditions: finalConditions,
    },
    { from: 'twin-b-door', to: 'elder-end' },
    { from: 'elder-end', to: 'goal' },

    // Borz seul possède ces nœuds dans son graphe local.
    {
      from: 'borz-start',
      to: 'borz-mid',
      condition: { mechanism: 'elder-plate-a', equals: true },
    },
    {
      from: 'borz-mid',
      to: 'plate-b',
      condition: { mechanism: 'elder-plate-a', equals: true },
    },
  ],
  mechanisms: [
    {
      id: 'elder-plate-a',
      kind: 'pressurePlate',
      at: [-5, 5.76, -3],
      params: {
        triggerNode: 'plate-a',
        latching: true,
        loweringSeconds: 0.9,
        linkX: -0.5,
        linkY: -2.6,
        linkZ: 6,
      },
    },
    {
      id: 'elder-plate-b',
      kind: 'pressurePlate',
      at: [-4.2, 5.26, -2.6],
      params: {
        triggerNode: 'plate-b',
        latching: true,
        loweringSeconds: 0.9,
        linkX: 1.7,
        linkY: -2.1,
        linkZ: 4.6,
      },
    },
    {
      id: 'elder-plate-c',
      kind: 'pressurePlate',
      at: [-1, 3.1, -1],
      params: {
        triggerNode: 'plate-c',
        latching: true,
        loweringSeconds: 1.35,
        linkX: 1.8,
        linkY: 0.1,
        linkZ: 2,
      },
    },
  ],
  actors: [
    {
      id: 'nikaroy-elder',
      kind: 'elder',
      spawn: 'elder-wait',
      stages: [
        {
          startsOn: { mechanism: 'elder-plate-a', equals: true },
          path: ['elder-wait', 'elder-a'],
        },
        {
          startsOn: { mechanism: 'elder-plate-b', equals: true },
          path: ['elder-a', 'elder-b'],
        },
        {
          startsOn: { mechanism: 'elder-plate-c', equals: true },
          path: ['elder-b', 'twin-a-door', 'twin-b-door', 'elder-end'],
        },
      ],
      completesState: { mechanism: 'elder-crossed', initial: false, value: true },
    },
  ],
  secrets: [
    {
      id: '03-anciens:eagle',
      kind: 'eagle',
      node: 'eagle-secret',
      at: [-1.2, 4.16, 4.6],
      revealOnMechanism: { mechanism: 'elder-plate-c', equals: true },
    },
  ],
  triggers: [
    { id: 'anciens-drone', on: { levelStart: true }, play: { musicLayers: 1 } },
    {
      id: 'anciens-midpoint',
      on: { mechanism: 'elder-plate-b', equals: true },
      play: { musicLayers: 3 },
    },
    {
      id: 'anciens-eagle-found',
      on: { node: 'eagle-secret' },
      play: { eagleFound: true },
    },
    {
      id: 'anciens-salute',
      on: { node: 'goal' },
      play: { gesture: 'salute', by: 'turpal' },
    },
  ],
};
