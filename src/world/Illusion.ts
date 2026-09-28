/**
 * Illusion.ts — le cœur magique du jeu.
 *
 * En projection orthographique isométrique, deux points éloignés dans
 * l'espace peuvent se superposer à l'écran. Quand c'est le cas, on active une
 * arête « illusoire » entre leurs nœuds : Turpal peut marcher de l'un à
 * l'autre, exactement comme dans Monument Valley. Si la caméra tourne, la
 * superposition disparaît et l'arête est coupée.
 *
 * La détection reste écrite comme une fonction pure sur des coordonnées écran
 * pour l'audit, et comme un résolveur zéro allocation basé sur `NodeProjection`
 * pour le runtime par frame.
 */
import type { EdgeCondition, NavGraph, NodeId } from './NavGraph';
import type { NodeProjection } from './NodeProjection';

export interface ScreenPoint {
  readonly x: number;
  readonly y: number;
}

export interface IllusionCandidate {
  readonly a: NodeId;
  readonly b: NodeId;
  readonly oneWay?: boolean;
  readonly cost?: number;
  readonly condition?: EdgeCondition;
  readonly conditions?: readonly EdgeCondition[];
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
 * Résolveur runtime des illusions.
 *
 * `update()` est appelé après la projection écran des nœuds. Il ne crée aucune
 * collection temporaire : l'état actif est conservé dans un `Uint8Array`, et
 * le graphe ne fait que basculer les arêtes illusoires existantes.
 */
export class IllusionResolver {
  private candidates: readonly IllusionCandidate[] = [];
  private active = new Uint8Array(0);
  private tolerance = ILLUSION_TOLERANCE_PX;
  private activeCount = 0;

  get count(): number {
    return this.candidates.length;
  }

  get activeTotal(): number {
    return this.activeCount;
  }

  rebuild(candidates: readonly IllusionCandidate[], tolerance = ILLUSION_TOLERANCE_PX): void {
    this.candidates = candidates;
    this.tolerance = tolerance;
    if (this.active.length < candidates.length) this.active = new Uint8Array(candidates.length);
    this.active.fill(0, 0, candidates.length);
    this.activeCount = 0;
  }

  update(graph: NavGraph, projection: NodeProjection): number {
    let nextActiveCount = 0;
    const visible = projection.visibleBuffer;
    const screenX = projection.screenXBuffer;
    const screenY = projection.screenYBuffer;

    for (let i = 0; i < this.candidates.length; i += 1) {
      const candidate = this.candidates[i];
      if (!candidate) continue;
      const aIndex = projection.indexOf(candidate.a);
      const bIndex = projection.indexOf(candidate.b);
      const aligned =
        aIndex >= 0 &&
        bIndex >= 0 &&
        visible[aIndex] === 1 &&
        visible[bIndex] === 1 &&
        Math.abs((screenX[aIndex] ?? 0) - (screenX[bIndex] ?? 0)) <= this.tolerance &&
        Math.abs((screenY[aIndex] ?? 0) - (screenY[bIndex] ?? 0)) <= this.tolerance;

      const next = aligned ? 1 : 0;
      if (this.active[i] !== next) {
        this.active[i] = next;
        graph.setIllusoryConnectionEnabled(
          candidate.a,
          candidate.b,
          aligned,
          candidate.oneWay !== true,
        );
      }
      if (aligned) nextActiveCount += 1;
    }

    this.activeCount = nextActiveCount;
    return nextActiveCount;
  }

  isActive(index: number): boolean {
    return this.active[index] === 1;
  }

  clear(): void {
    this.candidates = [];
    this.active = new Uint8Array(0);
    this.activeCount = 0;
  }
}

/**
 * Recalcule les arêtes illusoires à partir des projections écran des nœuds.
 * Version de compatibilité pour les outils purs ; le runtime utilise
 * `IllusionResolver` afin d'éviter les allocations par frame.
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

    if (!graph.getEdge(candidate.a, candidate.b)) {
      graph.connect(candidate.a, candidate.b, {
        illusory: true,
        ...(candidate.oneWay === undefined ? {} : { oneWay: candidate.oneWay }),
        ...(candidate.cost === undefined ? {} : { cost: candidate.cost }),
        ...(candidate.condition === undefined ? {} : { condition: candidate.condition }),
        ...(candidate.conditions === undefined ? {} : { conditions: candidate.conditions }),
      });
    }
    graph.setIllusoryConnectionEnabled(
      candidate.a,
      candidate.b,
      matched,
      candidate.oneWay !== true,
    );
    if (matched) active.push(candidate);
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

export interface IllusionDebugIssue extends IllusionAudit {
  readonly message: string;
}

/** Retourne seulement les illusions mal alignées, avec un message pour l'overlay debug. */
export function debugIllusionMismatches(
  projections: ReadonlyMap<NodeId, ScreenPoint>,
  candidates: readonly IllusionCandidate[],
  tolerance = ILLUSION_TOLERANCE_PX,
): readonly IllusionDebugIssue[] {
  return auditIllusions(projections, candidates, tolerance)
    .filter((audit) => !audit.aligned)
    .map((audit) => ({
      ...audit,
      message:
        audit.reason === 'missing-projection'
          ? `Illusion ${audit.candidate.a}↔${audit.candidate.b} impossible à auditer : projection manquante.`
          : `Illusion ${audit.candidate.a}↔${audit.candidate.b} trop éloignée : ${audit.screenDistance.toFixed(1)} px > ${tolerance} px.`,
    }));
}
