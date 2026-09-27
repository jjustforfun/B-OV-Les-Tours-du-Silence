/**
 * math.ts — helpers numériques sans dépendance à three.
 * Gardés purs et testables : ils servent aussi bien au gameplay qu'à l'UI.
 */

export const TAU = Math.PI * 2;

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function clamp01(value: number): number {
  return clamp(value, 0, 1);
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function inverseLerp(a: number, b: number, value: number): number {
  return a === b ? 0 : (value - a) / (b - a);
}

export function remap(
  value: number,
  inMin: number,
  inMax: number,
  outMin: number,
  outMax: number,
): number {
  return lerp(outMin, outMax, clamp01(inverseLerp(inMin, inMax, value)));
}

/**
 * Interpolation indépendante du framerate.
 * `smoothing` = fraction restante après 1 seconde (0.01 = très réactif).
 */
export function damp(current: number, target: number, smoothing: number, delta: number): number {
  return lerp(target, current, Math.pow(clamp01(smoothing), delta));
}

export function smoothstep(t: number): number {
  const x = clamp01(t);
  return x * x * (3 - 2 * x);
}

/** Distance de Manhattan sur la grille isométrique. */
export function manhattan(
  ax: number,
  ay: number,
  az: number,
  bx: number,
  by: number,
  bz: number,
): number {
  return Math.abs(ax - bx) + Math.abs(ay - by) + Math.abs(az - bz);
}

export function approximately(a: number, b: number, epsilon = 1e-6): boolean {
  return Math.abs(a - b) <= epsilon;
}

/** Modulo toujours positif (utile pour les rotations cycliques). */
export function mod(value: number, modulus: number): number {
  return ((value % modulus) + modulus) % modulus;
}
