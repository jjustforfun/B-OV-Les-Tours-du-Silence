/**
 * 04-patience.ts — chapitre 4, « La Patience ».
 *
 * Le niveau réel se reflète sous la surface immobile de Kezenoy-Am. Borz
 * verrouille une dalle qui met quarante secondes à lever la lune ; la tour
 * pivotante aligne alors les deux escaliers au ras de l'eau. Le reflet devient
 * un second graphe jouable, sans transition de caméra.
 *
 * Durée de première découverte visée : 11 minutes. Le cycle lunaire ne recule
 * jamais et la porte reste ouverte : aucune manipulation tardive ne peut
 * enfermer Turpal dans le monde reflété.
 */
import type { LevelDefinition } from '@world/Level';

const towerNodes = [
  'tower-plate-entry',
  'tower-plate-exit',
  'tower-water-entry',
  'tower-water-mid',
  'tower-water-exit',
  'mirror-water-entry',
  'mirror-water-mid',
  'mirror-tower-exit',
].join(',');

const waterConditions = [
  { mechanism: 'lake-tower', equals: 2 },
  { mechanism: 'moon-cycle', equals: 'open' },
] as const;

export const level: LevelDefinition = {
  id: '04-patience',
  chapter: 4,
  virtue: 'patience',
  titleKey: 'levels.patience.title',
  proverbKey: 'proverbs.patience',
  sky: 'dusk',
  palette: 'patience',
  music: {
    mode: 'aeolian',
    root: 'E2',
    strings: ['E2', 'B2', 'E3'],
  },
  ambience: ['wind', 'river'],
  durationMinutes: { target: 11, min: 5, max: 12 },
  spawn: 'start',
  goal: 'goal',
  camera: { target: [-0.5, 0, 1], zoom: 17 },
  geometry: [
    // Rives jumelles, séparées par une eau réellement transparente.
    { kind: 'block', at: [-6, 1.05, 1], size: [6.5, 2.1, 6.2] },
    { kind: 'platform', at: [-6, 2.38, 1], size: [6.8, 0.28, 6.5] },
    { kind: 'block', at: [-6, -1.05, 1], size: [6.5, 2.1, 6.2] },
    { kind: 'platform', at: [-6, -2.38, 1], size: [6.8, 0.28, 6.5] },
    {
      kind: 'platform',
      at: [0, -0.08, 1],
      size: [20, 0.12, 14],
      color: 0x172744,
      opacity: 0.32,
    },

    // La même tour au-dessus et au-dessous de l'eau, portée par une seule rotation.
    { kind: 'tower', at: [0, 4.2, 1], size: [4.2, 8.4, 4.2], parent: 'lake-tower' },
    {
      kind: 'tower',
      at: [0, -4.2, 1],
      size: [4.2, 8.4, 4.2],
      rotationY: 180,
      parent: 'lake-tower',
    },

    // Face 1 : passerelle d'apprentissage vers la dalle de Borz.
    {
      kind: 'bridge',
      at: [0, 2.36, 1],
      size: [1.3, 0.28, 4.6],
      parent: 'lake-tower',
    },

    // Face 2 : deux escaliers symétriques qui se rencontrent sur l'eau.
    { kind: 'stair', at: [1.45, 2.22, 1], size: [1.2, 0.38, 1.25], parent: 'lake-tower' },
    { kind: 'stair', at: [0, 1.28, 1], size: [1.55, 0.38, 1.25], parent: 'lake-tower' },
    { kind: 'stair', at: [-1.45, 0.28, 1], size: [1.2, 0.38, 1.25], parent: 'lake-tower' },
    { kind: 'stair', at: [-1.45, -0.28, 1], size: [1.2, 0.38, 1.25], parent: 'lake-tower' },
    { kind: 'stair', at: [0, -1.28, 1], size: [1.55, 0.38, 1.25], parent: 'lake-tower' },
    { kind: 'stair', at: [1.45, -2.22, 1], size: [1.2, 0.38, 1.25], parent: 'lake-tower' },

    // Pont d'argent et porte lunaire dans le reflet.
    {
      kind: 'bridge',
      at: [-4.4, -2.42, 0.6],
      size: [3, 0.22, 0.82],
      rotationY: 16,
      color: 0xdfe7f2,
    },
    {
      kind: 'bridge',
      at: [-7, -2.42, -0.1],
      size: [2.6, 0.22, 0.82],
      rotationY: 14,
      color: 0xdfe7f2,
    },
    { kind: 'arch', at: [-5.8, -1.35, 0.2], size: [0.55, 2.2, 2.2] },

    // Dalle lunaire, stèles sobres et roseaux du secret.
    { kind: 'platform', at: [3.6, 2.44, 1], size: [1.2, 0.22, 1.2], color: 0xdfe7f2 },
    { kind: 'block', at: [4.8, 1.1, 3.8], size: [0.3, 2.2, 0.3] },
    { kind: 'block', at: [5.35, 0.85, 3.5], size: [0.24, 1.7, 0.24] },
    { kind: 'block', at: [4.45, 0.7, 4.2], size: [0.2, 1.4, 0.2] },
    { kind: 'block', at: [1.1, -4.2, 3.2], size: [0.18, 1.8, 0.18] },
    { kind: 'block', at: [1.55, -4.45, 3.4], size: [0.16, 1.45, 0.16] },
  ],
  nodes: [
    { id: 'start', at: [-8.2, 2.58, -0.4], tags: ['spawn'], surface: 'stone' },
    { id: 'shore-path', at: [-5.8, 2.58, 0.2], surface: 'stone' },
    {
      id: 'shore-wheel',
      at: [-3, 2.58, 1],
      tags: ['mechanism:lake-tower'],
      surface: 'stone',
    },

    // Couloir de la face 1, écrit dans son orientation initiale nord-sud.
    { id: 'tower-plate-entry', at: [0, 2.58, 3], surface: 'stone' },
    { id: 'tower-plate-exit', at: [0, 2.58, -1], surface: 'stone' },
    {
      id: 'plate-overlook',
      at: [3, 2.58, 1],
      tags: ['cooperator:moon-plate'],
      surface: 'stone',
    },

    // Graphe propre de Borz : sa destination est la dalle, pas le chemin de Turpal.
    { id: 'borz-start', at: [-7.4, 2.58, -1.2], tags: ['borz'], surface: 'stone' },
    { id: 'borz-mid', at: [-3.2, 2.58, -0.7], tags: ['borz'], surface: 'stone' },
    {
      id: 'borz-plate',
      at: [3.6, 2.58, 1],
      tags: ['borz', 'mechanism:moon-plate', 'borz:bridge'],
      surface: 'stone',
    },

    // Face 2 : descente du monde réel jusqu'à la ligne d'eau.
    { id: 'tower-water-entry', at: [2, 2.58, 1], surface: 'stone' },
    { id: 'tower-water-mid', at: [0, 1.32, 1], surface: 'stone' },
    { id: 'tower-water-exit', at: [-2, 0.08, 1], surface: 'stone' },
    { id: 'water-real', at: [2.7, 0, 1], tags: ['waterline'], surface: 'stone' },

    // Copie miroir en Y. Les deux nœuds d'eau occupent le même point projeté.
    {
      id: 'water-reflection',
      at: [2.7, 0, 1],
      tags: ['waterline', 'reflection'],
      surface: 'stone',
    },
    {
      id: 'mirror-water-entry',
      at: [-2, -0.08, 1],
      tags: ['reflection'],
      surface: 'stone',
    },
    { id: 'mirror-water-mid', at: [0, -1.32, 1], tags: ['reflection'], surface: 'stone' },
    {
      id: 'mirror-tower-exit',
      at: [2, -2.58, 1],
      tags: ['reflection'],
      surface: 'stone',
    },
    { id: 'silver-start', at: [-3, -2.58, 1], tags: ['reflection'], surface: 'stone' },
    { id: 'moon-gate', at: [-5.8, -2.58, 0.2], tags: ['reflection'], surface: 'stone' },
    { id: 'goal', at: [-8.2, -2.58, -0.4], tags: ['goal', 'reflection'], surface: 'stone' },

    {
      id: 'eagle-secret',
      at: [1.3, -3.55, 3.3],
      tags: ['secret:eagle', 'reflection'],
      surface: 'stone',
    },
  ],
  edges: [
    { from: 'start', to: 'shore-path' },
    { from: 'shore-path', to: 'shore-wheel' },

    // Face 1 : la seule sortie enseigne la rotation entière de la tour.
    {
      from: 'shore-wheel',
      to: 'tower-plate-entry',
      condition: { mechanism: 'lake-tower', equals: 1 },
    },
    { from: 'tower-plate-entry', to: 'tower-plate-exit' },
    {
      from: 'tower-plate-exit',
      to: 'plate-overlook',
      condition: { mechanism: 'lake-tower', equals: 1 },
    },

    // Borz suit son propre couloir quand la face 1 est alignée.
    { from: 'borz-start', to: 'borz-mid' },
    {
      from: 'borz-mid',
      to: 'borz-plate',
      condition: { mechanism: 'lake-tower', equals: 1 },
    },

    // Face 2 : la lune ouverte rend la ligne d'eau franchissable.
    {
      from: 'shore-wheel',
      to: 'tower-water-entry',
      condition: { mechanism: 'lake-tower', equals: 2 },
    },
    { from: 'tower-water-entry', to: 'tower-water-mid' },
    { from: 'tower-water-mid', to: 'tower-water-exit' },
    {
      from: 'tower-water-exit',
      to: 'water-real',
      condition: { mechanism: 'lake-tower', equals: 2 },
    },
    {
      from: 'water-real',
      to: 'water-reflection',
      illusory: true,
      conditions: waterConditions,
    },
    {
      from: 'water-reflection',
      to: 'mirror-water-entry',
      condition: { mechanism: 'lake-tower', equals: 2 },
    },
    { from: 'mirror-water-entry', to: 'mirror-water-mid' },
    { from: 'mirror-water-mid', to: 'mirror-tower-exit' },
    {
      from: 'mirror-tower-exit',
      to: 'silver-start',
      condition: { mechanism: 'lake-tower', equals: 2 },
    },
    {
      from: 'silver-start',
      to: 'moon-gate',
      conditions: [
        { mechanism: 'moon-plate', equals: true },
        { mechanism: 'moon-cycle', equals: 'open' },
      ],
    },
    {
      from: 'moon-gate',
      to: 'goal',
      condition: { mechanism: 'moon-cycle', equals: 'open' },
    },
  ],
  mechanisms: [
    {
      id: 'lake-tower',
      kind: 'towerRotation',
      at: [0, 0, 1],
      params: {
        faces: 4,
        initialFace: 0,
        bidirectional: true,
        snapSeconds: 0.9,
        centerX: 0,
        centerY: 0,
        centerZ: 1,
        affectedNodes: towerNodes,
      },
    },
    {
      id: 'moon-plate',
      kind: 'pressurePlate',
      at: [3.6, 2.52, 1],
      params: {
        triggerNode: 'borz-plate',
        latching: true,
        pressSeconds: 0.18,
        linkX: -3.6,
        linkY: -2.5,
        linkZ: 0,
        bridgeFrom: 'silver-start',
        bridgeTo: 'moon-gate',
      },
    },
    {
      id: 'moon-cycle',
      kind: 'moonCycle',
      at: [6.2, 0.7, -3.2],
      params: {
        startsOn: 'moon-plate',
        startsAt: true,
        durationSeconds: 40,
        zenithSeconds: 34,
        riseHeight: 5.5,
        driftX: -2.2,
      },
    },
  ],
  secrets: [
    {
      id: '04-patience:eagle',
      kind: 'eagle',
      node: 'eagle-secret',
      at: [1.3, -3.55, 3.3],
      revealOnMechanism: { mechanism: 'moon-cycle', equals: 'zenith' },
    },
  ],
  triggers: [
    { id: 'patience-drone', on: { levelStart: true }, play: { musicLayers: 1 } },
    {
      id: 'patience-zenith',
      on: { mechanism: 'moon-cycle', equals: 'zenith' },
      play: { musicLayers: 3 },
    },
    {
      id: 'patience-open',
      on: { mechanism: 'moon-cycle', equals: 'open' },
      play: { musicLayers: 4 },
    },
    {
      id: 'patience-eagle-found',
      on: { node: 'eagle-secret' },
      play: { eagleFound: true },
    },
  ],
};
