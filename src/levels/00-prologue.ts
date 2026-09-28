/**
 * 00-prologue.ts — chapitre 0, « Le Retour ».
 *
 * Turpal traverse l'aoul intact à l'aube, gravit un escalier extérieur qui
 * s'arrête dans l'air, puis découvre que sa dernière marche et le seuil de la
 * tour se touchent dans l'image. Aucun mécanisme n'est introduit : le seul
 * apprentissage est « toucher pour marcher » puis « ce que tu vois fait loi ».
 *
 * Durée de première découverte visée : 5 minutes. Aucune façon d'échouer.
 */
import type { LevelDefinition } from '@world/Level';

export const level: LevelDefinition = {
  id: '00-prologue',
  chapter: 0,
  virtue: 'prologue',
  titleKey: 'levels.prologue.title',
  proverbKey: 'proverbs.threshold',
  sky: 'dawn',
  palette: 'prologue',
  music: {
    mode: 'dorian',
    root: 'D3',
    strings: ['D3', 'A3', 'D4'],
  },
  ambience: ['wind', 'eagle', 'stone'],
  durationMinutes: { target: 5, min: 5, max: 12 },
  spawn: 'start',
  goal: 'threshold',
  camera: { target: [-0.5, 11, 0.5], zoom: 15 },
  geometry: [
    // Sentier et cour : pierre froide, herbe désaturée, aucun accent décoratif.
    { kind: 'platform', at: [-8.25, -0.22, -4.4], size: [4.5, 0.44, 3.8], surface: 'grass' },
    { kind: 'bridge', at: [-7.1, -0.12, -3.35], size: [1.1, 0.24, 1.1], surface: 'stone' },
    { kind: 'bridge', at: [-6.35, -0.1, -2.65], size: [1.1, 0.2, 1.1], surface: 'stone' },
    { kind: 'platform', at: [-5.05, -0.24, -1.05], size: [6.8, 0.48, 5.8], surface: 'grass' },
    { kind: 'platform', at: [-5, -0.12, -1], size: [2.2, 0.24, 2.2], surface: 'stone' },

    // Escalier extérieur : six marches franches, puis le vide réel.
    { kind: 'stair', at: [-4.5, 0.3, -0.5], size: [0.92, 0.4, 0.92] },
    { kind: 'stair', at: [-4, 0.8, 0], size: [0.92, 0.4, 0.92] },
    { kind: 'stair', at: [-3.5, 1.3, 0.5], size: [0.92, 0.4, 0.92] },
    { kind: 'stair', at: [-3, 1.8, 1], size: [0.92, 0.4, 0.92] },
    { kind: 'stair', at: [-2.5, 2.3, 1.5], size: [0.92, 0.4, 0.92] },
    { kind: 'stair', at: [-2, 2.8, 2], size: [0.92, 0.4, 0.92] },

    // Piton et tour intacts. L'entrée est au premier étage, conformément au canon.
    { kind: 'block', at: [4, 2.5, 5.5], size: [8, 5, 8] },
    { kind: 'tower', at: [4, 15, 5.5], size: [5, 20, 5] },
    { kind: 'platform', at: [4, 8.84, 8.2], size: [1.45, 0.32, 1.1] },
  ],
  nodes: [
    { id: 'start', at: [-9.2, 0, -5.1], tags: ['spawn'], surface: 'grass' },
    { id: 'path-1', at: [-8.1, 0, -4.3], surface: 'grass' },
    { id: 'path-2', at: [-7.1, 0, -3.35], surface: 'stone' },
    { id: 'court-gate', at: [-6.35, 0, -2.65], surface: 'stone' },
    { id: 'court', at: [-5, 0, -1], tags: ['rest'], surface: 'stone' },

    // Placé avant `last-step` : au pixel commun, le seuil reste la cible du tap.
    { id: 'threshold', at: [4, 9, 8], tags: ['goal', 'stone-memory'], surface: 'stone' },
    { id: 'stair-1', at: [-4.5, 0.5, -0.5], surface: 'stone' },
    { id: 'stair-2', at: [-4, 1, 0], surface: 'stone' },
    { id: 'stair-3', at: [-3.5, 1.5, 0.5], tags: ['eagle-sightline'], surface: 'stone' },
    { id: 'stair-4', at: [-3, 2, 1], surface: 'stone' },
    { id: 'stair-5', at: [-2.5, 2.5, 1.5], surface: 'stone' },
    { id: 'last-step', at: [-2, 3, 2], tags: ['illusion-edge'], surface: 'stone' },

    // Nœuds acteurs : jamais empruntés par Turpal.
    {
      id: 'borz-sleeping',
      at: [-4.3, 0, -0.15],
      tags: ['borz', 'borz:dormant'],
      surface: 'stone',
    },
    {
      id: 'eagle-secret',
      at: [4.55, 27.35, 5.55],
      tags: ['secret:eagle'],
      surface: 'stone',
    },
  ],
  edges: [
    { from: 'start', to: 'path-1' },
    { from: 'path-1', to: 'path-2' },
    { from: 'path-2', to: 'court-gate' },
    { from: 'court-gate', to: 'court' },
    { from: 'court', to: 'stair-1' },
    { from: 'stair-1', to: 'stair-2' },
    { from: 'stair-2', to: 'stair-3' },
    { from: 'stair-3', to: 'stair-4' },
    { from: 'stair-4', to: 'stair-5' },
    { from: 'stair-5', to: 'last-step' },
    // Écart monde = [6, 6, 6] : nul dans la projection isométrique.
    { from: 'last-step', to: 'threshold', illusory: true },
  ],
  secrets: [
    {
      id: '00-prologue:eagle',
      kind: 'eagle',
      node: 'eagle-secret',
      at: [4.55, 27.35, 5.55],
      revealOnNode: 'stair-3',
    },
  ],
  triggers: [
    { id: 'prologue-drone', on: { levelStart: true }, play: { musicLayers: 1 } },
    { id: 'prologue-court-music', on: { node: 'court' }, play: { musicLayers: 2 } },
    {
      id: 'prologue-reveal-eagle',
      on: { node: 'stair-3' },
      play: { revealSecret: '00-prologue:eagle' },
    },
    { id: 'prologue-stair-music', on: { node: 'stair-3' }, play: { musicLayers: 3 } },
    {
      id: 'prologue-hand-on-stone',
      on: { node: 'threshold' },
      play: { gesture: 'handOnStone', by: 'turpal' },
    },
    { id: 'prologue-awaken-borz', on: { node: 'threshold' }, play: { borzAwaken: true } },
    { id: 'prologue-full-music', on: { node: 'threshold' }, play: { musicLayers: 4 } },
    {
      id: 'prologue-eagle-found',
      on: { node: 'eagle-secret' },
      play: { eagleFound: true },
    },
  ],
};
