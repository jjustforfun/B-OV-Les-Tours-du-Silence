/**
 * motion.ts — préférence de mouvement réduit, source unique pour tout le jeu.
 *
 * `prefers-reduced-motion` (docs/CONTROLS.md § 5) concerne le confort, pas la
 * jouabilité : les durées d'animation sont divisées par deux, les dérives
 * continues (brume, parallaxe, scintillement) sont supprimées — mais le jeu
 * reste entièrement jouable et chaque feedback reste lisible.
 *
 * Un réglage manuel (phase UI) pourra forcer la préférence dans les deux sens
 * ; il s'ajoute à la média query, il ne la remplace pas silencieusement.
 */

/** État forcé par les réglages : `undefined` = suivre le système. */
let override: boolean | undefined;

function matchesSystemReduce(): boolean {
  if (typeof matchMedia !== 'function') return false;
  try {
    return matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

/** Le joueur a-t-il demandé un mouvement réduit (système ou réglage) ? */
export function isReducedMotion(): boolean {
  return override ?? matchesSystemReduce();
}

/** Réglage manuel : `true`/`false` force, `undefined` rend la main au système. */
export function setReducedMotionOverride(value: boolean | undefined): void {
  override = value;
}

/**
 * Multiplicateur de durée pour toute animation non essentielle : 0,5 quand le
 * mouvement est réduit, 1 sinon. Les feedbacks indispensables (marqueur de
 * destination, alignement de mécanisme) restent joués, simplement plus courts.
 */
export function motionDurationScale(): number {
  return isReducedMotion() ? 0.5 : 1;
}

/**
 * Les dérives infinies — brume qui respire, lucioles qui errent, poussière
 * qui flotte — sont la première cause de gêne vestibulaire : elles disparaissent.
 */
export function ambientDriftEnabled(): boolean {
  return !isReducedMotion();
}
