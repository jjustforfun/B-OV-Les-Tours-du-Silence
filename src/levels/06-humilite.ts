/**
 * 06-humilite.ts — chapitre 6, « L'Humilité ».
 *
 * Le névé descend sous les pieds de Turpal, puis une tour orientée ouvre une
 * paroi entière. Deux bascules successives conduisent sur le plafond d'une
 * arche (`up=[0,-1,0]`). Son extrémité et le sentier du sommet, séparés dans
 * l'espace, se confondent en projection. Pendant ce temps Borz porte le
 * voyageur, l'enfant, l'ancien et le rival — jamais Turpal — vers le haut.
 */
import type { LevelDefinition } from '@world/Level';

const TOWER_CENTER = [-5, 2, -2] as const;
const WALL_UP = [0, 0, 1] as const;
const CEILING_UP = [0, -1, 0] as const;

export const level: LevelDefinition = {
  id: '06-humilite',
  chapter: 6,
  virtue: 'humilite',
  titleKey: 'levels.humilite.title',
  proverbKey: 'proverbs.humilite',
  sky: 'snow',
  palette: 'humilite',
  spawn: 'start',
  goal: 'goal',
  durationMinutes: { target: 12, min: 5, max: 12 },
  ambience: ['wind', 'eagle'],
  music: {
    mode: 'dorian',
    root: 'A3',
    strings: ['A3', 'E4', 'A4'],
  },
  camera: {
    target: [0, 2, 3],
    zoom: 0.86,
  },
  nodes: [
    {
      id: 'start',
      at: [-8, 4, -4],
      tags: ['spawn', 'mechanism:snow-slab'],
      surface: 'snow',
    },
    { id: 'tower-wheel', at: [-6.4, 2, -2], tags: ['mechanism:mountain-tower'] },
    { id: 'tower-exit', at: [-5, 2, -4] },
    { id: 'wall-top', at: [-2.2, 2, -2], tags: ['mechanism:wall-gravity'] },
    { id: 'wall-upper', at: [-2, 1, -1.2], up: WALL_UP },
    { id: 'wall-mid', at: [-2, 0, -0.35], up: WALL_UP },
    { id: 'wall-bottom', at: [-2, -1, 0.5], up: WALL_UP },
    { id: 'arch-hinge', at: [-2, -1, 1.25], tags: ['mechanism:arch-gravity'], up: WALL_UP },
    { id: 'ceiling-a', at: [-1, -1, 2], up: CEILING_UP },
    { id: 'ceiling-b', at: [0, -1, 3], up: CEILING_UP },
    { id: 'ceiling-end', at: [1, -1, 4], up: CEILING_UP },
    { id: 'summit-start', at: [7, 5, 10], up: CEILING_UP, surface: 'snow' },
    { id: 'summit-mid', at: [8, 6, 10], up: CEILING_UP, surface: 'snow' },
    { id: 'goal', at: [9.2, 7, 9], tags: ['goal'], up: CEILING_UP, surface: 'snow' },

    { id: 'borz-lower', at: [-7.1, 2, -0.8], tags: ['borz'], surface: 'snow' },
    { id: 'borz-ramp', at: [-5, 3, 1.1], tags: ['borz'], surface: 'snow' },
    { id: 'borz-upper', at: [-3, 4, 3], tags: ['borz'], surface: 'snow' },

    { id: 'passenger-wait-0', at: [-8.1, 2, -0.2], surface: 'snow' },
    { id: 'passenger-wait-1', at: [-8.35, 2, 0.55], surface: 'snow' },
    { id: 'passenger-wait-2', at: [-7.65, 2, 0.95], surface: 'snow' },
    { id: 'passenger-wait-3', at: [-6.9, 2, 0.25], surface: 'snow' },
    { id: 'passenger-summit-0', at: [-3.8, 4, 3.5], surface: 'snow' },
    { id: 'passenger-summit-1', at: [-3.15, 4, 3.9], surface: 'snow' },
    { id: 'passenger-summit-2', at: [-2.45, 4, 3.65], surface: 'snow' },
    { id: 'passenger-summit-3', at: [-2.8, 4, 2.85], surface: 'snow' },
    { id: 'eagle-secret', at: [0, -2.6, 3], tags: ['secret:eagle'] },
  ],
  edges: [
    {
      from: 'start',
      to: 'tower-wheel',
      condition: { mechanism: 'snow-slab', equals: 1 },
    },
    {
      from: 'tower-wheel',
      to: 'tower-exit',
      condition: { mechanism: 'mountain-tower', equals: 1 },
    },
    {
      from: 'tower-exit',
      to: 'wall-top',
      condition: { mechanism: 'mountain-tower', equals: 1 },
    },
    {
      from: 'wall-top',
      to: 'wall-upper',
      condition: { mechanism: 'wall-gravity', equals: 'north' },
    },
    {
      from: 'wall-upper',
      to: 'wall-mid',
      condition: { mechanism: 'wall-gravity', equals: 'north' },
    },
    {
      from: 'wall-mid',
      to: 'wall-bottom',
      condition: { mechanism: 'wall-gravity', equals: 'north' },
    },
    {
      from: 'wall-bottom',
      to: 'arch-hinge',
      condition: { mechanism: 'wall-gravity', equals: 'north' },
    },
    {
      from: 'arch-hinge',
      to: 'ceiling-a',
      condition: { mechanism: 'arch-gravity', equals: 'up' },
    },
    {
      from: 'ceiling-a',
      to: 'ceiling-b',
      condition: { mechanism: 'arch-gravity', equals: 'up' },
    },
    {
      from: 'ceiling-b',
      to: 'ceiling-end',
      condition: { mechanism: 'arch-gravity', equals: 'up' },
    },
    {
      from: 'ceiling-end',
      to: 'summit-start',
      illusory: true,
      conditions: [
        { mechanism: 'arch-gravity', equals: 'up' },
        { mechanism: 'mountain-tower', equals: 1 },
        { mechanism: 'others-raised', equals: true },
      ],
    },
    { from: 'summit-start', to: 'summit-mid' },
    { from: 'summit-mid', to: 'goal' },

    { from: 'borz-lower', to: 'borz-ramp' },
    { from: 'borz-ramp', to: 'borz-upper' },
  ],
  mechanisms: [
    {
      id: 'snow-slab',
      kind: 'slider',
      at: [-8, 3, -4],
      params: {
        axis: 'y',
        travel: -2,
        stops: 2,
        initial: 0,
        snapSeconds: 0.9,
        affectedNodes: 'start',
      },
    },
    {
      id: 'mountain-tower',
      kind: 'towerRotation',
      at: TOWER_CENTER,
      params: {
        faces: 4,
        bidirectional: true,
        initialFace: 0,
        snapSeconds: 0.9,
        centerX: TOWER_CENTER[0],
        centerY: TOWER_CENTER[1],
        centerZ: TOWER_CENTER[2],
        affectedNodes: 'tower-exit',
      },
    },
    {
      id: 'wall-gravity',
      kind: 'gravityPath',
      at: [-2.2, 2, -2],
      params: {
        from: 'down',
        to: 'north',
        pivotNodes: 'wall-upper,wall-mid,wall-bottom',
      },
    },
    {
      id: 'arch-gravity',
      kind: 'gravityPath',
      at: [-2, -1, 1.25],
      params: {
        from: 'north',
        to: 'up',
        pivotNodes: 'arch-hinge,ceiling-a,ceiling-b,ceiling-end',
      },
    },
  ],
  actors: [
    {
      id: 'summit-procession',
      kind: 'procession',
      waitingNodes: [
        'passenger-wait-0',
        'passenger-wait-1',
        'passenger-wait-2',
        'passenger-wait-3',
      ],
      summitNodes: [
        'passenger-summit-0',
        'passenger-summit-1',
        'passenger-summit-2',
        'passenger-summit-3',
      ],
      outboundPath: ['borz-lower', 'borz-ramp', 'borz-upper'],
      returnPath: ['borz-upper', 'borz-ramp', 'borz-lower'],
      startsOn: { mechanism: 'mountain-tower', equals: 1 },
      completesState: { mechanism: 'others-raised', initial: false, value: true },
    },
  ],
  geometry: [
    {
      kind: 'platform',
      at: [-8, 3.8, -4],
      size: [3.2, 0.4, 3],
      parent: 'snow-slab',
      surface: 'snow',
    },
    { kind: 'block', at: [-8.8, 2.5, -4.8], size: [2, 3.2, 2], surface: 'snow' },
    { kind: 'bridge', at: [-7.1, 1.8, -3], size: [3, 0.35, 1.4], surface: 'stone' },

    {
      kind: 'tower',
      at: [-5, 4.25, -2],
      size: [3.2, 4.5, 3.2],
      parent: 'mountain-tower',
      surface: 'stone',
    },
    { kind: 'stair', at: [-5, 2.25, -2.7], size: [1, 0.35, 1], parent: 'mountain-tower' },
    { kind: 'stair', at: [-5, 2.7, -3.2], size: [1, 0.35, 1], parent: 'mountain-tower' },
    { kind: 'bridge', at: [-5, 3.1, -3.65], size: [1, 0.35, 1.4], parent: 'mountain-tower' },

    { kind: 'block', at: [-2.8, 1, -0.2], size: [1.5, 6, 5], surface: 'stone' },
    { kind: 'block', at: [-3.8, 2.8, 1.7], size: [2, 4, 3], surface: 'snow' },
    { kind: 'block', at: [1.8, 2.5, 4.2], size: [4, 5, 4], surface: 'snow' },
    { kind: 'arch', at: [0, 0.5, 3], size: [6, 3, 4], surface: 'stone' },
    { kind: 'block', at: [-2.5, -0.5, 3], size: [1, 2, 3], surface: 'stone' },
    { kind: 'block', at: [2.5, -0.5, 3], size: [1, 2, 3], surface: 'stone' },

    { kind: 'platform', at: [-7.1, 1.8, -0.1], size: [3.5, 0.4, 3.5], surface: 'snow' },
    { kind: 'bridge', at: [-5, 2.75, 1.1], size: [3.4, 0.35, 1.2], rotationY: 45, surface: 'snow' },
    { kind: 'platform', at: [-3, 3.8, 3.3], size: [3.5, 0.4, 3], surface: 'snow' },

    { kind: 'platform', at: [7, 4.8, 10], size: [3.2, 0.4, 3.2], surface: 'snow' },
    { kind: 'stair', at: [8, 5.5, 10], size: [1.2, 0.5, 1.2], surface: 'snow' },
    { kind: 'stair', at: [8.65, 6.1, 9.5], size: [1.2, 0.5, 1.2], surface: 'snow' },
    { kind: 'platform', at: [9.2, 6.8, 9], size: [2.6, 0.4, 2.6], surface: 'snow' },
  ],
  secrets: [
    {
      id: '06-humilite:eagle',
      kind: 'eagle',
      node: 'eagle-secret',
      at: [0, -2.6, 3],
      revealOnMechanism: { mechanism: 'arch-gravity', equals: 'up' },
    },
  ],
  triggers: [
    { id: 'humilite:start', on: { levelStart: true }, play: { musicLayers: 1 } },
    {
      id: 'humilite:others',
      on: { mechanism: 'others-raised', equals: true },
      play: { musicLayers: 2 },
    },
    {
      id: 'humilite:wall',
      on: { mechanism: 'wall-gravity', equals: 'north' },
      play: { musicLayers: 3 },
    },
    {
      id: 'humilite:ceiling',
      on: { mechanism: 'arch-gravity', equals: 'up' },
      play: { musicLayers: 4 },
    },
    { id: 'humilite:eagle-found', on: { node: 'eagle-secret' }, play: { eagleFound: true } },
  ],
};
