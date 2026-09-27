/**
 * screenMove.ts — choix du voisin pour un déplacement directionnel.
 *
 * Docs/CONTROLS.md § 2.3 : la touche pressée désigne une direction **dans
 * l'écran** ; on choisit le voisin dont la direction projetée est la plus
 * proche (< 60°), à coût minimal en cas d'égalité. S'il n'y a pas de voisin
 * dans ce cône, rien ne se passe : aucun bip, aucune pénalité.
 *
 * Pur et sans three.js : les positions écran viennent de `NodeProjection`
 * (pixels CSS, y vers le bas), les intentions du clavier ou du stick.
 */

export interface ScreenPoint {
  readonly x: number;
  readonly y: number;
}

/** Intention directionnelle : dy positif = vers le haut de l'écran. */
export interface MoveIntent {
  readonly dx: number;
  readonly dy: number;
}

export interface DirectionalCandidate {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  /** Coût de l'arête : sert à départager deux directions équivalentes. */
  readonly cost: number;
}

export interface DirectionalMoveResult {
  readonly id: string;
  /** Écart angulaire en degrés entre l'intention et le voisin choisi. */
  readonly angleDeg: number;
}

const DEGREES_PER_RADIAN = 180 / Math.PI;

/**
 * Retient le voisin dont la direction écran est la plus proche de
 * l'intention, à `maxAngleDeg` près ; `null` si le cône est vide.
 */
export function pickNeighborByScreenDirection(
  origin: ScreenPoint,
  intent: MoveIntent,
  candidates: readonly DirectionalCandidate[],
  maxAngleDeg = 60,
): DirectionalMoveResult | null {
  const intentLength = Math.hypot(intent.dx, intent.dy);
  if (intentLength < 1e-6 || candidates.length === 0) return null;

  // L'écran a son y vers le bas, l'intention son y vers le haut.
  const intentX = intent.dx / intentLength;
  const intentY = -intent.dy / intentLength;

  let best: DirectionalMoveResult | null = null;
  let bestCost = Number.POSITIVE_INFINITY;

  for (const candidate of candidates) {
    const dx = candidate.x - origin.x;
    const dy = candidate.y - origin.y;
    const length = Math.hypot(dx, dy);
    if (length < 1e-6) continue;

    const unitX = dx / length;
    const unitY = dy / length;
    const dot = unitX * intentX + unitY * intentY;
    // Un dot < 0 (angle > 90°) ne peut pas entrer dans un cône de 60°.
    if (dot <= 0) continue;

    const angleDeg = Math.acos(Math.min(1, dot)) * DEGREES_PER_RADIAN;
    if (angleDeg > maxAngleDeg) continue;

    const better =
      best === null ||
      angleDeg < best.angleDeg - 1e-9 ||
      (Math.abs(angleDeg - best.angleDeg) <= 1e-9 && candidate.cost < bestCost);

    if (better) {
      best = { id: candidate.id, angleDeg };
      bestCost = candidate.cost;
    }
  }

  return best;
}
