/**
 * easing.ts — courbes d'animation maison.
 *
 * Le « toucher » du jeu vit ici. Règle de direction artistique : aucune
 * animation ne démarre brusquement, aucune ne s'arrête net. Les mécanismes
 * ont un très léger dépassement (l'architecture a du poids), les fondus
 * d'interface sont purement exponentiels (rien ne doit rebondir dans l'UI).
 */
export type EasingFn = (t: number) => number;

const clamp01 = (t: number): number => Math.min(Math.max(t, 0), 1);

export const linear: EasingFn = (t) => clamp01(t);

export const easeInQuad: EasingFn = (t) => clamp01(t) ** 2;
export const easeOutQuad: EasingFn = (t) => 1 - (1 - clamp01(t)) ** 2;
export const easeInOutQuad: EasingFn = (t) => {
  const x = clamp01(t);
  return x < 0.5 ? 2 * x * x : 1 - (-2 * x + 2) ** 2 / 2;
};

export const easeInOutCubic: EasingFn = (t) => {
  const x = clamp01(t);
  return x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2;
};

/** Courbe signature des mécanismes : lente, sûre, avec un souffle final. */
export const easeStone: EasingFn = (t) => {
  const x = clamp01(t);
  return 1 - Math.pow(1 - x, 3.4) * Math.cos(x * 0.6);
};

/** Respiration : va-et-vient doux pour les idles et la brume. */
export const breathe = (t: number): number => (Math.sin(t * Math.PI * 2) + 1) / 2;

/** Micro-célébration : léger dépassement puis retour, jamais caricatural. */
export const easeCelebrate: EasingFn = (t) => {
  const x = clamp01(t);
  const c = 1.70158 * 1.2;
  return 1 + (c + 1) * (x - 1) ** 3 + c * (x - 1) ** 2;
};

/** Sortie exponentielle : vif au départ, posé à l'arrivée — la pierre qui
 *  trouve sa place (docs/tasks Phase 7 : reconstruction en `expo.out`). */
export const expoOut: EasingFn = (t) => {
  const x = clamp01(t);
  return x >= 1 ? 1 : 1 - 2 ** (-10 * x);
};

export const EASINGS = {
  linear,
  easeInQuad,
  easeOutQuad,
  easeInOutQuad,
  easeInOutCubic,
  easeStone,
  easeCelebrate,
  expoOut,
} as const satisfies Record<string, EasingFn>;

export type EasingName = keyof typeof EASINGS;
