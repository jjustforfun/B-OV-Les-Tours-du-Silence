/**
 * 02-parole.ts — chapitre 2, « La Parole donnée ».
 *
 * Trois dalles offrent d'abord un raccourci séduisant. Chaque cran du slider
 * en retire une pour la faire glisser vers l'amont ; au quatrième état, le
 * raccourci a entièrement disparu et ces trois mêmes dalles forment le pont
 * promis à l'enfant de l'autre rive.
 *
 * Durée de première découverte visée : 8 minutes. Le choix est réversible et
 * aucun état intermédiaire ne peut enfermer Turpal.
 */
import type { LevelDefinition } from '@world/Level';

export const level: LevelDefinition = {
  id: '02-parole',
  chapter: 2,
  virtue: 'parole',
  titleKey: 'levels.parole.title',
  proverbKey: 'proverbs.parole',
  sky: 'dawn',
  palette: 'parole',
  music: {
    mode: 'aeolian',
    root: 'A2',
    strings: ['A2', 'E3', 'A3'],
  },
  ambience: ['wind', 'river'],
  durationMinutes: { target: 8, min: 5, max: 12 },
  spawn: 'start',
  goal: 'goal',
  camera: { target: [0, 4.2, 0], zoom: 20 },
  geometry: [
    // Torrent de l'Argun, encaissé entre deux terrasses de schiste.
    {
      kind: 'platform',
      at: [0, -1.85, 0],
      size: [7, 0.2, 16],
      surface: 'stone',
      color: 0x258b9e,
    },
    {
      kind: 'platform',
      at: [-0.8, -1.72, -3.4],
      size: [1.3, 0.05, 3.4],
      surface: 'snow',
      color: 0x90d5d8,
    },
    { kind: 'block', at: [-7.1, 0.5, 0], size: [7.2, 5, 12] },
    { kind: 'platform', at: [-7.1, 3.05, 0], size: [7.4, 0.22, 12.2] },
    { kind: 'block', at: [7.1, 0.5, 0], size: [7.2, 5, 12] },
    { kind: 'platform', at: [7.1, 3.05, 0], size: [7.4, 0.22, 12.2] },

    // Le raccourci initial : un seul jeu de trois dalles, jamais dupliqué.
    {
      kind: 'bridge',
      at: [-3, 3.22, 3.8],
      size: [3, 0.32, 1.4],
      parent: 'promise-slider',
      moveTo: [-3, 3.22, 0.4],
      moveStage: 1,
    },
    {
      kind: 'bridge',
      at: [0, 3.22, 3.8],
      size: [3, 0.32, 1.4],
      parent: 'promise-slider',
      moveTo: [0, 3.22, 0.4],
      moveStage: 2,
    },
    {
      kind: 'bridge',
      at: [3, 3.22, 3.8],
      size: [3, 0.32, 1.4],
      parent: 'promise-slider',
      moveTo: [3, 3.22, 0.4],
      moveStage: 3,
    },

    // Trois mortaises vides rendent lisible la promesse avant sa résolution.
    {
      kind: 'platform',
      at: [-3, 3.02, 0.4],
      size: [3, 0.08, 1.5],
      color: 0x35434c,
    },
    {
      kind: 'platform',
      at: [0, 3.02, 0.4],
      size: [3, 0.08, 1.5],
      color: 0x35434c,
    },
    {
      kind: 'platform',
      at: [3, 3.02, 0.4],
      size: [3, 0.08, 1.5],
      color: 0x35434c,
    },

    // Rive basse : détour sans utilité mécanique, seul point de vue sur l'aigle.
    { kind: 'stair', at: [-5.7, 2.55, -1.6], size: [1.1, 0.55, 1.2] },
    { kind: 'stair', at: [-5.05, 1.85, -2.35], size: [1.1, 0.55, 1.2] },
    { kind: 'stair', at: [-4.4, 1.15, -3.1], size: [1.1, 0.55, 1.2] },
    { kind: 'platform', at: [-3.8, 0.32, -3.7], size: [2.7, 0.45, 2.8] },
    { kind: 'block', at: [-1.9, -0.35, -0.8], size: [1.2, 2.2, 1.3] },

    // Deux tours cadrent la gorge sans devenir des puzzles concurrents.
    { kind: 'tower', at: [-9, 13.1, 4.1], size: [4.6, 20, 4.6] },
    { kind: 'tower', at: [8.8, 12.1, -4.2], size: [4.4, 18, 4.4] },
    { kind: 'block', at: [-8.5, 2.25, -3.7], size: [3.8, 1.5, 3.1] },
    { kind: 'platform', at: [-8.5, 3.05, -3.7], size: [4, 0.18, 3.3] },
    { kind: 'arch', at: [7.9, 4.2, -2.7], size: [2.8, 2.2, 0.8] },
  ],
  nodes: [
    { id: 'start', at: [-8.5, 3.18, -3.7], tags: ['spawn', 'borz'], surface: 'stone' },
    { id: 'west-path', at: [-7, 3.18, -2], tags: ['borz'], surface: 'stone' },
    {
      id: 'promise-stone',
      at: [-5.2, 3.18, 0.4],
      tags: ['mechanism:promise-slider', 'borz'],
      surface: 'stone',
    },
    { id: 'shortcut-mouth', at: [-4.8, 3.18, 3.8], surface: 'stone' },
    { id: 'shortcut-far', at: [4.8, 3.18, 3.8], surface: 'stone' },
    { id: 'child-side', at: [4.8, 3.18, 0.4], surface: 'stone' },
    { id: 'east-path', at: [6.4, 3.18, -1], surface: 'stone' },
    { id: 'goal', at: [8, 3.18, -2.7], tags: ['goal'], surface: 'stone' },

    // Détour bas réversible.
    { id: 'lower-step-1', at: [-5.7, 2.82, -1.6], surface: 'stone' },
    { id: 'lower-step-2', at: [-5.05, 2.12, -2.35], surface: 'stone' },
    { id: 'lower-step-3', at: [-4.4, 1.42, -3.1], surface: 'stone' },
    { id: 'lower-bank', at: [-3.8, 0.6, -3.7], surface: 'stone' },

    // Picking du secret uniquement ; jamais une destination marchable.
    {
      id: 'eagle-secret',
      at: [-1.9, 0.82, -0.8],
      tags: ['secret:eagle'],
      surface: 'stone',
    },
  ],
  edges: [
    { from: 'start', to: 'west-path' },
    { from: 'west-path', to: 'promise-stone' },
    { from: 'promise-stone', to: 'shortcut-mouth' },
    {
      from: 'shortcut-mouth',
      to: 'shortcut-far',
      condition: { mechanism: 'promise-slider', equals: 0 },
    },
    {
      from: 'promise-stone',
      to: 'child-side',
      condition: { mechanism: 'promise-slider', equals: 3 },
    },
    { from: 'child-side', to: 'east-path' },
    { from: 'east-path', to: 'goal' },
    { from: 'west-path', to: 'lower-step-1' },
    { from: 'lower-step-1', to: 'lower-step-2' },
    { from: 'lower-step-2', to: 'lower-step-3' },
    { from: 'lower-step-3', to: 'lower-bank' },
  ],
  mechanisms: [
    {
      id: 'promise-slider',
      kind: 'slider',
      at: [-5.2, 3.32, 0.4],
      params: { axis: 'z', travel: 3, stops: 4, initial: 0, snapSeconds: 0.9 },
    },
  ],
  actors: [
    {
      id: 'waiting-child',
      kind: 'child',
      at: [5.3, 3.2, 1.4],
      reactsOn: { mechanism: 'promise-slider', equals: 3 },
    },
  ],
  secrets: [
    {
      id: '02-parole:eagle',
      kind: 'eagle',
      node: 'eagle-secret',
      at: [-1.9, 0.82, -0.8],
      revealOnNode: 'lower-bank',
    },
  ],
  triggers: [
    { id: 'parole-drone', on: { levelStart: true }, play: { musicLayers: 1 } },
    {
      id: 'parole-renunciation',
      on: { mechanism: 'promise-slider', equals: 2 },
      play: { musicLayers: 3 },
    },
    {
      id: 'parole-eagle-found',
      on: { node: 'eagle-secret' },
      play: { eagleFound: true },
    },
  ],
};
