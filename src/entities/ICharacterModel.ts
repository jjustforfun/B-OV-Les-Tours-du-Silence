/**
 * ICharacterModel.ts — contrat commun à toutes les incarnations visuelles
 * d'un personnage (ADR-006).
 *
 * Le gameplay ne connaît jamais la façon dont un personnage est fabriqué :
 * il connaît une racine Object3D, une hauteur, et quelques verbes
 * d'animation. La v1 est procédurale (primitives low-poly assemblées en
 * code, zéro octet d'asset) ; une v2 chargera un GLB sculpté sous Blender
 * et animé sous Mixamo. Le remplacement se fera par substitution
 * d'implémentation, sans toucher à `Turpal.ts` ni à quoi que ce soit d'autre.
 */
import type { Object3D } from 'three';

/** Vocabulaire d'animation partagé par toutes les implémentations. */
export type CharacterClip =
  | 'idle'
  | 'idleLong'
  | 'walk'
  | 'stepUp'
  | 'stepDown'
  | 'salute'
  | 'lookSky'
  | 'contemplate'
  | 'arrive';

export interface ICharacterModel {
  /** Nœud à attacher à la scène. */
  readonly root: Object3D;
  /** Hauteur totale en unités de grille — référence d'échelle du monde. */
  readonly height: number;
  /** Origine de la géométrie : utile au debug et au rapport de perf. */
  readonly kind: 'procedural' | 'gltf';
  /** Nombre de triangles, pour tenir le budget de `docs/PERFORMANCE.md`. */
  readonly triangleCount: number;

  /** Joue un clip, avec un fondu depuis le clip courant. */
  play(clip: CharacterClip, fadeSeconds?: number): void;
  /** Avance l'animation. Appelé une fois par image. */
  update(delta: number): void;
  /** Libère géométries et matériaux (AGENTS.md § 4). */
  dispose(): void;
}
