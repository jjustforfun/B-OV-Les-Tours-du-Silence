/**
 * 05-pardon.ts — chapitre 5, « Le Pardon ».
 *
 * Deux moitiés géométriquement intactes possèdent chacune quatre orientations.
 * Turpal règle l'ouest puis avance le premier sur la corniche. Le rival répond
 * toujours d'un cran à l'est ; seule la séquence ouest 1 / est 2→3 referme la
 * fracture. Aucune pierre n'apparaît : les deux balcons déjà présents se
 * rencontrent exactement au centre et deviennent l'unique liaison illusoire.
 */
import type { LevelDefinition } from '@world/Level';

const WEST_CENTER = [-3, 0.25, 0] as const;
const EAST_CENTER = [3, 0.25, 0] as const;
const WALL_UP = [0, 0, 1] as const;

export const level: LevelDefinition = {
  id: '05-pardon',
  chapter: 5,
  virtue: 'pardon',
  titleKey: 'levels.pardon.title',
  proverbKey: 'proverbs.pardon',
  sky: 'dusk',
  palette: 'pardon',
  spawn: 'start',
  goal: 'goal',
  durationMinutes: { target: 10, min: 5, max: 12 },
  ambience: ['wind', 'eagle', 'stone'],
  music: {
    mode: 'aeolian',
    root: 'D3',
    strings: ['D3', 'A3', 'F4'],
  },
  camera: {
    target: [0, 2.35, 0],
    zoom: 0.9,
  },
  nodes: [
    { id: 'start', at: [-8.4, 0.25, -3.2], tags: ['spawn'] },
    { id: 'gravity-base', at: [-7.1, 0.25, -2], tags: ['mechanism:fracture-gravity'] },
    { id: 'wall-low', at: [-7.1, 0.8, -1.25], up: WALL_UP },
    { id: 'wall-mid', at: [-7.1, 1.4, -0.5], up: WALL_UP },
    { id: 'wall-top', at: [-6.4, 2.05, 0], up: WALL_UP },
    { id: 'west-entry', at: [-5.1, 1.7, 0] },
    {
      id: 'west-wheel',
      at: WEST_CENTER,
      tags: ['mechanism:west-half', 'story:player-half'],
    },
    { id: 'west-step', at: [-3, 2.1, -1.25] },
    { id: 'west-offer', at: [-3, 4, -3], tags: ['story:offer-hand'] },
    { id: 'east-offer', at: [3, 4, -3] },
    { id: 'east-hub', at: [3, 4, 0] },
    { id: 'east-overlook', at: [5.1, 4.55, 0] },
    { id: 'goal', at: [7.2, 5.2, -1], tags: ['goal'] },
    { id: 'rival-stand', at: [3, 4, 0.85], tags: ['actor:rival'] },
    { id: 'eagle-secret', at: [0, 3.25, 0], tags: ['secret:eagle'] },
  ],
  edges: [
    { from: 'start', to: 'gravity-base' },
    {
      from: 'gravity-base',
      to: 'wall-low',
      condition: { mechanism: 'fracture-gravity', equals: 'north' },
    },
    {
      from: 'wall-low',
      to: 'wall-mid',
      condition: { mechanism: 'fracture-gravity', equals: 'north' },
    },
    {
      from: 'wall-mid',
      to: 'wall-top',
      condition: { mechanism: 'fracture-gravity', equals: 'north' },
    },
    { from: 'wall-top', to: 'west-entry' },
    { from: 'west-entry', to: 'west-wheel' },
    { from: 'west-wheel', to: 'west-step' },
    { from: 'west-step', to: 'west-offer' },
    {
      from: 'west-offer',
      to: 'east-offer',
      illusory: true,
      conditions: [
        { mechanism: 'fracture-closed', equals: true },
        { mechanism: 'turpal-advanced', equals: true },
      ],
    },
    { from: 'east-offer', to: 'east-hub' },
    { from: 'east-hub', to: 'east-overlook' },
    { from: 'east-overlook', to: 'goal' },
  ],
  mechanisms: [
    {
      id: 'fracture-gravity',
      kind: 'gravityPath',
      at: [-7.1, 0.25, -2],
      params: {
        from: 'down',
        to: 'north',
        pivotNodes: 'wall-low,wall-mid,wall-top',
      },
    },
    {
      id: 'west-half',
      kind: 'towerRotation',
      at: WEST_CENTER,
      params: {
        faces: 4,
        bidirectional: true,
        initialFace: 0,
        snapSeconds: 0.9,
        centerX: WEST_CENTER[0],
        centerY: WEST_CENTER[1],
        centerZ: WEST_CENTER[2],
        affectedNodes: 'west-step,west-offer',
      },
    },
    {
      id: 'east-half',
      kind: 'towerRotation',
      at: EAST_CENTER,
      params: {
        faces: 4,
        bidirectional: false,
        initialFace: 0,
        snapSeconds: 0.9,
        centerX: EAST_CENTER[0],
        centerY: EAST_CENTER[1],
        centerZ: EAST_CENTER[2],
        affectedNodes: 'east-offer',
      },
    },
  ],
  actors: [
    {
      id: 'silent-rival',
      kind: 'rival',
      spawn: 'rival-stand',
      respondsOnNode: 'west-offer',
      playerMechanism: 'west-half',
      rivalMechanism: 'east-half',
      playerFace: 1,
      rivalFace: 3,
      advancedState: { mechanism: 'turpal-advanced', initial: false, value: true },
      responseState: { mechanism: 'rival-response-spent', initial: false, value: true },
      completesState: { mechanism: 'fracture-closed', initial: false, value: true },
    },
  ],
  geometry: [
    { kind: 'platform', at: [-8.2, 0, -2.6], size: [3.8, 0.4, 4.2], surface: 'stone' },
    { kind: 'block', at: [-7.1, 1.05, -0.65], size: [0.85, 2.25, 3.4], surface: 'stone' },
    { kind: 'platform', at: [-5.4, 1.75, 0], size: [3.1, 0.35, 2.2], surface: 'stone' },
    { kind: 'stair', at: [-4.35, 1.15, 0], size: [0.8, 0.35, 1.2], surface: 'stone' },
    { kind: 'stair', at: [-3.75, 0.7, 0], size: [0.8, 0.35, 1.2], surface: 'stone' },

    { kind: 'platform', at: [-3, 0.2, 0], size: [3.5, 0.35, 3.5], parent: 'west-half' },
    { kind: 'block', at: [-3, 3, 1.5], size: [3.5, 5.6, 0.5], parent: 'west-half' },
    { kind: 'block', at: [-4.5, 3, 0], size: [0.5, 5.6, 2.5], parent: 'west-half' },
    { kind: 'block', at: [-1.5, 3, 0.65], size: [0.5, 5.6, 1.4], parent: 'west-half' },
    { kind: 'block', at: [-3, 5.9, 0.95], size: [3, 0.35, 1.6], parent: 'west-half' },
    { kind: 'block', at: [-3, 6.28, 0.82], size: [2.2, 0.35, 1.25], parent: 'west-half' },
    { kind: 'stair', at: [-3, 0.62, -0.48], size: [1, 0.35, 0.72], parent: 'west-half' },
    { kind: 'stair', at: [-3, 1.12, -0.78], size: [1, 0.35, 0.72], parent: 'west-half' },
    { kind: 'stair', at: [-3, 1.62, -1.08], size: [1, 0.35, 0.72], parent: 'west-half' },
    { kind: 'bridge', at: [-3, 4, -1.5], size: [1, 0.35, 3], parent: 'west-half' },

    { kind: 'platform', at: [3, 0.2, 0], size: [3.5, 0.35, 3.5], parent: 'east-half' },
    { kind: 'block', at: [3, 3, 1.5], size: [3.5, 5.6, 0.5], parent: 'east-half' },
    { kind: 'block', at: [4.5, 3, 0], size: [0.5, 5.6, 2.5], parent: 'east-half' },
    { kind: 'block', at: [1.5, 3, 0.65], size: [0.5, 5.6, 1.4], parent: 'east-half' },
    { kind: 'block', at: [3, 5.9, 0.95], size: [3, 0.35, 1.6], parent: 'east-half' },
    { kind: 'block', at: [3, 6.28, 0.82], size: [2.2, 0.35, 1.25], parent: 'east-half' },
    { kind: 'stair', at: [3, 3.15, 0.45], size: [1, 0.35, 0.72], parent: 'east-half' },
    { kind: 'stair', at: [3, 3.55, 0.15], size: [1, 0.35, 0.72], parent: 'east-half' },
    { kind: 'bridge', at: [3, 4, -1.5], size: [1, 0.35, 3], parent: 'east-half' },

    { kind: 'platform', at: [5.15, 4.1, 0], size: [2.5, 0.35, 2.2], surface: 'stone' },
    { kind: 'stair', at: [6.1, 4.5, -0.35], size: [1.1, 0.35, 1.1], surface: 'stone' },
    { kind: 'stair', at: [6.75, 4.85, -0.7], size: [1.1, 0.35, 1.1], surface: 'stone' },
    { kind: 'platform', at: [7.3, 5.05, -1], size: [2.2, 0.35, 2], surface: 'stone' },
  ],
  secrets: [
    {
      id: '05-pardon:eagle',
      kind: 'eagle',
      node: 'eagle-secret',
      at: [0, 3.25, 0],
      revealOnMechanism: { mechanism: 'fracture-closed', equals: false },
    },
  ],
  triggers: [
    { id: 'pardon:start', on: { levelStart: true }, play: { musicLayers: 1 } },
    { id: 'pardon:wall', on: { node: 'wall-top' }, play: { musicLayers: 2 } },
    {
      id: 'pardon:west-aligned',
      on: { mechanism: 'west-half', equals: 1 },
      play: { musicLayers: 3 },
      once: false,
    },
    {
      id: 'pardon:fracture-closed',
      on: { mechanism: 'fracture-closed', equals: true },
      play: { musicLayers: 4 },
    },
    { id: 'pardon:eagle-found', on: { node: 'eagle-secret' }, play: { eagleFound: true } },
  ],
};
