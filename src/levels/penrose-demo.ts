/**
 * penrose-demo.ts — démonstrateur Phase 2.
 *
 * Un escalier de Penrose minimal : un rotateur placé au palier central peut
 * relier soit le retour logique, soit une arête illusoire vers un chemin qui
 * n'existe que par alignement écran. Le niveau sert aux tests de Navigation et
 * au NavGraphViz (`?debug=nav&demo=penrose`, ou touche G en dev).
 */
import type { LevelDefinition } from '@world/Level';

export const level: LevelDefinition = {
  id: 'penrose-demo',
  chapter: 0,
  virtue: 'prologue',
  titleKey: 'levels.penroseDemo.title',
  proverbKey: 'proverbs.threshold',
  sky: 'dawn',
  spawn: 'base',
  goal: 'summit',
  camera: { target: [0.4, 1.1, 0.1], zoom: 6 },
  geometry: [
    { kind: 'stair', at: [-1.5, 0.25, 1], size: [1, 0.5, 1] },
    { kind: 'stair', at: [-0.5, 0.75, 0.5], size: [1, 0.5, 1] },
    { kind: 'platform', at: [0.25, 1, 0], size: [1, 0.25, 1], parent: 'penrose-rotator' },
    { kind: 'bridge', at: [1.1, 1.25, -0.3], size: [1, 0.25, 1] },
  ],
  nodes: [
    { id: 'base', at: [-2, 0, 1.5], tags: ['spawn'], surface: 'stone' },
    { id: 'step-1', at: [-1.25, 0.5, 1], surface: 'stone' },
    { id: 'step-2', at: [-0.55, 0.9, 0.45], surface: 'stone' },
    { id: 'rotator', at: [0, 1.1, 0], tags: ['mechanism:penrose-rotator'], surface: 'stone' },
    { id: 'return-loop', at: [-0.35, 1.35, -0.8], surface: 'stone' },
    { id: 'impossible-bridge', at: [1.05, 1.35, -0.55], surface: 'stone' },
    { id: 'summit', at: [1.85, 1.8, -1], tags: ['goal'], surface: 'stone' },
  ],
  edges: [
    { from: 'base', to: 'step-1' },
    { from: 'step-1', to: 'step-2' },
    { from: 'step-2', to: 'rotator' },
    { from: 'return-loop', to: 'step-1' },
    { from: 'impossible-bridge', to: 'summit' },
  ],
  mechanisms: [
    {
      id: 'penrose-rotator',
      kind: 'rotator',
      at: [0, 1.1, 0],
      params: { initial: 0, stepDeg: 90, steps: 4 },
      affects: [
        {
          from: 'rotator',
          to: 'return-loop',
          condition: { mechanism: 'penrose-rotator', equals: 0 },
        },
        {
          from: 'rotator',
          to: 'impossible-bridge',
          illusory: true,
          condition: { mechanism: 'penrose-rotator', equals: 90 },
        },
      ],
    },
  ],
};
