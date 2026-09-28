/**
 * 01-hospitalite.ts — chapitre 1, « L'Hospitalité ».
 *
 * Une passerelle radiale dessert quatre directions. Turpal doit l'offrir au
 * voyageur trempé avant que sa propre route puisse exister. La troisième
 * position ne sert à rien : elle ouvre seulement la ligne de regard vers un
 * aigle posé près d'une meurtrière.
 *
 * Durée de première découverte visée : 7 minutes. Aucune façon d'échouer.
 */
import type { LevelDefinition } from '@world/Level';

export const level: LevelDefinition = {
  id: '01-hospitalite',
  chapter: 1,
  virtue: 'hospitalite',
  titleKey: 'levels.hospitalite.title',
  proverbKey: 'proverbs.hospitalite',
  sky: 'mist',
  palette: 'hospitalite',
  music: {
    mode: 'dorian',
    root: 'G3',
    strings: ['G3', 'D4', 'G4'],
  },
  ambience: ['wind', 'bells', 'fire'],
  durationMinutes: { target: 7, min: 5, max: 12 },
  spawn: 'start',
  goal: 'goal',
  camera: { target: [-1.5, 10, -0.5], zoom: 17 },
  geometry: [
    // Place ouest : herbe ocre, dalle commune et montée vers la roue.
    { kind: 'platform', at: [-6.5, -0.24, 0], size: [5.8, 0.48, 5.2], surface: 'grass' },
    { kind: 'platform', at: [-5.6, -0.08, 0], size: [3.2, 0.24, 3.4], surface: 'stone' },
    { kind: 'stair', at: [-4.1, 0.25, 0], size: [0.9, 0.5, 1.25] },
    { kind: 'stair', at: [-3.35, 0.75, 0], size: [0.9, 0.5, 1.25] },
    { kind: 'stair', at: [-2.6, 1.25, 0], size: [0.9, 0.5, 1.25] },
    { kind: 'stair', at: [-1.85, 1.75, 0], size: [0.9, 0.5, 1.25] },
    { kind: 'platform', at: [0, 1.82, 0], size: [2.2, 0.36, 2.2], surface: 'stone' },

    // La seule pièce mobile. À l'état initial elle pointe vers la cour ouest.
    {
      kind: 'bridge',
      at: [-2.65, 2.12, 0],
      size: [5.3, 0.24, 1.15],
      parent: 'hospitality-wheel',
      surface: 'wood',
    },

    // Terrasse nord du voyageur, assez haute pour lire sa silhouette dans la brume.
    { kind: 'block', at: [0, 0.85, 6.8], size: [6.2, 1.7, 4.1] },
    { kind: 'platform', at: [0, 1.82, 6.8], size: [6.4, 0.24, 4.3], surface: 'stone' },
    { kind: 'arch', at: [0, 3.15, 8.1], size: [2.8, 2.4, 0.8], surface: 'stone' },

    // Route sud de Turpal, réellement inaccessible tant que l'invité n'est pas parti.
    { kind: 'block', at: [0, 0.85, -6.2], size: [3.1, 1.7, 3.3] },
    { kind: 'platform', at: [0, 1.82, -6.2], size: [3.3, 0.24, 3.5] },
    { kind: 'stair', at: [0.8, 2.22, -7.1], size: [0.9, 0.5, 1.1] },
    { kind: 'stair', at: [1.55, 2.72, -7.85], size: [0.9, 0.5, 1.1] },
    { kind: 'platform', at: [3.2, 2.82, -9], size: [4.1, 0.36, 3.2], surface: 'grass' },
    { kind: 'platform', at: [3.2, 3.02, -9], size: [1.8, 0.18, 1.8], surface: 'stone' },

    // Itum-Kale : tour intacte et maisons-terrasses. Le foyer fumera après l'accueil.
    { kind: 'tower', at: [-6.1, 10.5, 6.2], size: [5, 20, 5] },
    { kind: 'block', at: [-6, 1.6, -3.3], size: [4.5, 3.2, 3.6] },
    { kind: 'platform', at: [-6, 3.25, -3.3], size: [4.8, 0.22, 3.9] },
    { kind: 'block', at: [5.1, 1.4, 4.8], size: [4.2, 2.8, 4.5] },
    { kind: 'platform', at: [5.1, 2.85, 4.8], size: [4.5, 0.2, 4.8] },
  ],
  nodes: [
    { id: 'start', at: [-8.2, 0, -1.25], tags: ['spawn'], surface: 'grass' },
    { id: 'plaza-path', at: [-7.1, 0, -0.75], surface: 'grass' },
    { id: 'plaza', at: [-5.6, 0.05, 0], tags: ['rest'], surface: 'stone' },
    { id: 'wheel-stair-1', at: [-4.1, 0.5, 0], surface: 'stone' },
    { id: 'wheel-stair-2', at: [-3.35, 1, 0], surface: 'stone' },
    { id: 'wheel-stair-3', at: [-2.6, 1.5, 0], surface: 'stone' },
    { id: 'wheel-stair-4', at: [-1.85, 2, 0], surface: 'stone' },
    {
      id: 'wheel-hub',
      at: [-0.35, 2, 0],
      tags: ['mechanism:hospitality-wheel'],
      surface: 'stone',
    },
    {
      id: 'wheel-control',
      at: [0.35, 2, 0],
      tags: ['mechanism:hospitality-wheel'],
      surface: 'stone',
    },
    { id: 'south-landing', at: [0, 2, -5.8], surface: 'wood' },
    { id: 'exit-stair-1', at: [0.8, 2.5, -7.1], surface: 'stone' },
    { id: 'exit-stair-2', at: [1.55, 3, -7.85], surface: 'stone' },
    { id: 'goal', at: [3.2, 3.12, -9], tags: ['goal'], surface: 'stone' },

    // Borz accompagne sans résoudre le chapitre.
    { id: 'borz-start', at: [-7.35, 0, -0.1], tags: ['borz'], surface: 'grass' },

    // Trajet autonome du voyageur : ces nœuds ne sont reliés à aucune arête de Turpal.
    { id: 'traveler-wait', at: [0, 2, 7.2], tags: ['traveler:waiting'], surface: 'stone' },
    { id: 'traveler-bridge', at: [0, 2, 4.5], tags: ['traveler:path'], surface: 'wood' },
    { id: 'traveler-hub', at: [0, 2, 0.35], tags: ['traveler:path'], surface: 'wood' },
    { id: 'traveler-exit', at: [-1.85, 2, 0.35], tags: ['traveler:exit'], surface: 'stone' },

    // Picking du secret uniquement ; jamais une destination marchable.
    {
      id: 'eagle-secret',
      at: [-5.45, 22.95, 6.55],
      tags: ['secret:eagle'],
      surface: 'stone',
    },
  ],
  edges: [
    { from: 'start', to: 'plaza-path' },
    { from: 'plaza-path', to: 'plaza' },
    { from: 'plaza', to: 'wheel-stair-1' },
    { from: 'wheel-stair-1', to: 'wheel-stair-2' },
    { from: 'wheel-stair-2', to: 'wheel-stair-3' },
    { from: 'wheel-stair-3', to: 'wheel-stair-4' },
    { from: 'wheel-stair-4', to: 'wheel-hub' },
    { from: 'wheel-hub', to: 'wheel-control' },
    { from: 'south-landing', to: 'exit-stair-1' },
    { from: 'exit-stair-1', to: 'exit-stair-2' },
    { from: 'exit-stair-2', to: 'goal' },
  ],
  mechanisms: [
    {
      id: 'hospitality-wheel',
      kind: 'rotator',
      at: [0, 2.12, 0],
      params: { axis: 'y', stepDeg: 90, steps: 4, initialStep: 0 },
      affects: [
        {
          from: 'wheel-control',
          to: 'south-landing',
          conditions: [
            { mechanism: 'hospitality-wheel', equals: 270 },
            { mechanism: 'traveler-served', equals: true },
          ],
        },
      ],
    },
  ],
  actors: [
    {
      id: 'wet-traveler',
      kind: 'traveler',
      spawn: 'traveler-wait',
      path: ['traveler-wait', 'traveler-bridge', 'traveler-hub', 'traveler-exit'],
      startsOn: { mechanism: 'hospitality-wheel', equals: 90 },
      completesState: { mechanism: 'traveler-served', initial: false, value: true },
      locksMechanism: 'hospitality-wheel',
      hearthAt: [-6, 3.45, -3.3],
    },
  ],
  secrets: [
    {
      id: '01-hospitalite:eagle',
      kind: 'eagle',
      node: 'eagle-secret',
      at: [-5.45, 22.95, 6.55],
      revealOnMechanism: { mechanism: 'hospitality-wheel', equals: 180 },
    },
  ],
  triggers: [
    { id: 'hospitalite-drone', on: { levelStart: true }, play: { musicLayers: 1 } },
    {
      id: 'hospitalite-welcome-music',
      on: { mechanism: 'traveler-served', equals: true },
      play: { musicLayers: 3 },
    },
    {
      id: 'hospitalite-eagle-found',
      on: { node: 'eagle-secret' },
      play: { eagleFound: true },
    },
  ],
};
