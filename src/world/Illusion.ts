/**
 * Illusion.ts — le cœur magique du jeu.
 *
 * En projection orthographique isométrique, deux points éloignés dans
 * l'espace peuvent se superposer à l'écran. Quand c'est le cas, on crée une
 * arête « illusoire » entre leurs nœuds : Turpal peut marcher de l'un à
 * l'autre, exactement comme dans Monument Valley. Si la caméra tourne, la
 * superposition disparaît et l'arête est coupée.
 *
 * La détection est volontairement écrite comme une fonction pure sur des
 * coordonnées écran : elle est testable sans WebGL.
 */
import type { NavGraph, NodeId } from './NavGraph';

export interface ScreenPoint {
  readonly x: number;
  readonly y: number;
}

export interface IllusionCandidate {
  readonly a: NodeId;
  readonly b: NodeId;
}

/** Tolérance en pixels : la superposition doit être visuellement parfaite. */
export const ILLUSION_TOLERANCE_PX = 6;

export function screenSpaceMatch(
  a: ScreenPoint,
  b: ScreenPoint,
  tolerance = ILLUSION_TOLERANCE_PX,
): boolean {
  return Math.abs(a.x - b.x) <= tolerance && Math.abs(a.y - b.y) <= tolerance;
}

/**
 * Recalcule les arêtes illusoires à partir des projections écran des nœuds.
 * Appelée à la fin d'une rotation de caméra ou d'un mécanisme, jamais par image.
 */
export function resolveIllusions(
  graph: NavGraph,
  projections: ReadonlyMap<NodeId, ScreenPoint>,
  candidates: readonly IllusionCandidate[],
  tolerance = ILLUSION_TOLERANCE_PX,
): readonly IllusionCandidate[] {
  const active: IllusionCandidate[] = [];

  for (const candidate of candidates) {
    const a = projections.get(candidate.a);
    const b = projections.get(candidate.b);
    const matched = a !== undefined && b !== undefined && screenSpaceMatch(a, b, tolerance);

    if (matched) {
      graph.connect(candidate.a, candidate.b, { illusory: true });
      active.push(candidate);
    } else {
      graph.disconnect(candidate.a, candidate.b);
    }
  }
  return active;
}

/** Rapport d'audit d'une illusion, pour l'outil de debug (ADR-003). */
export interface IllusionAudit {
  readonly candidate: IllusionCandidate;
  /** Distance en pixels entre les deux projections. */
  readonly screenDistance: number;
  readonly aligned: boolean;
  /** Cause du rejet, le cas échéant — le level designer doit savoir pourquoi. */
  readonly reason: 'aligned' | 'too-far' | 'missing-projection';
}

/**
 * Audite toutes les illusions d'un niveau (ADR-003).
 *
 * Outil de level design : il répond à la seule question qui compte, « les
 * deux points se superposent-ils vraiment à l'écran ? », en donnant la
 * distance projetée exacte. Un écart de 7 px est invisible sur une capture
 * et parfaitement visible en jeu : c'est le genre de défaut qu'on ne trouve
 * pas à l'œil, seulement à la mesure.
 */
export function auditIllusions(
  projections: ReadonlyMap<NodeId, ScreenPoint>,
  candidates: readonly IllusionCandidate[],
  tolerance = ILLUSION_TOLERANCE_PX,
): readonly IllusionAudit[] {
  return candidates.map((candidate) => {
    const a = projections.get(candidate.a);
    const b = projections.get(candidate.b);

    if (a === undefined || b === undefined) {
      return {
        candidate,
        screenDistance: Number.POSITIVE_INFINITY,
        aligned: false,
        reason: 'missing-projection' as const,
      };
    }

    const screenDistance = Math.hypot(a.x - b.x, a.y - b.y);
    const aligned = screenSpaceMatch(a, b, tolerance);
    return {
      candidate,
      screenDistance,
      aligned,
      reason: aligned ? ('aligned' as const) : ('too-far' as const),
    };
  });
}
