/**
 * progress.ts — progression musicale et connexion de chemins, en pur.
 *
 * Deux questions reviennent à chaque changement d'état d'un mécanisme :
 *  - combien de couches musicales le niveau mérite-t-il désormais
 *    (docs/AUDIO.md § 4) ;
 *  - quelles arêtes conditionnelles viennent de s'ouvrir, pour prévenir les
 *    FX et l'audio du chemin qui se referme.
 *
 * Pures et sans three.js : testables dans Vitest, appelées par LevelRuntime.
 */
import type { LevelDefinition, LevelMechanismDef } from './Level';
import type { MechanismValue, NavGraph } from './NavGraph';

export interface MusicProgressInputs {
  readonly definition: LevelDefinition;
  /** État courant de chaque mécanisme (lu dans le NavGraph). */
  readonly mechanismStates: ReadonlyMap<string, MechanismValue>;
  /** Mécanismes manipulés au moins une fois par le joueur. */
  readonly actuatedMechanisms: ReadonlySet<string>;
  /** Le chemin final est-il refermé (but atteignable) ? */
  readonly goalReachable: boolean;
}

/**
 * Une couche est « méritée » quand :
 *  1. `drone`  — toujours, dès l'entrée dans le niveau ;
 *  2. `pondar` — à la première manipulation d'un mécanisme ;
 *  3. `doul`   — à mi-résolution (moitié des mécanismes dans un état utile) ;
 *  4. `melody` — quand le chemin final se referme.
 * Les couches ne se retirent jamais en cours de chapitre : l'appelant ne
 * garde que le maximum vu depuis le début.
 */
export function computeMusicLayers(inputs: MusicProgressInputs): number {
  const { definition, mechanismStates, actuatedMechanisms, goalReachable } = inputs;
  let layers = 1;
  if (actuatedMechanisms.size > 0) layers = 2;

  const mechanisms = definition.mechanisms ?? [];
  if (mechanisms.length > 0) {
    let resolved = 0;
    for (const mechanism of mechanisms) {
      if (isMechanismResolved(mechanism, mechanismStates, actuatedMechanisms)) resolved += 1;
    }
    if (resolved >= Math.ceil(mechanisms.length / 2)) layers = Math.max(layers, 3);
  }

  if (goalReachable) layers = 4;
  return layers;
}

/** Un mécanisme est « résolu » quand son état satisfait une condition d'arête
 *  qu'il commande — ou, faute de conditions, quand il a été manipulé. */
function isMechanismResolved(
  mechanism: LevelMechanismDef,
  states: ReadonlyMap<string, MechanismValue>,
  actuated: ReadonlySet<string>,
): boolean {
  const state = states.get(mechanism.id);
  const conditions = (mechanism.affects ?? []).flatMap((edge) =>
    edge.condition === undefined ? [] : [edge.condition],
  );

  if (conditions.length === 0) return actuated.has(mechanism.id);
  if (state === undefined) return false;
  return conditions.some((condition) => condition.equals === state);
}

/** Clé canonique d'une arête, indépendante du sens de parcours. */
export function edgeKey(from: string, to: string): string {
  return from < to ? `${from}|${to}` : `${to}|${from}`;
}

/** Instantané des arêtes conditionnelles : clé → active ou non. */
export function conditionalEdgeSnapshot(graph: NavGraph): Map<string, boolean> {
  const snapshot = new Map<string, boolean>();
  for (const edge of graph.allEdges()) {
    if (edge.condition === null) continue;
    snapshot.set(edgeKey(edge.from, edge.to), edge.enabled);
  }
  return snapshot;
}

/** Arêtes conditionnelles devenues franchissables entre deux instantanés. */
export function newlyEnabledEdgeKeys(
  before: ReadonlyMap<string, boolean>,
  after: ReadonlyMap<string, boolean>,
): string[] {
  const opened: string[] = [];
  for (const [key, enabled] of after) {
    if (enabled !== true) continue;
    if (before.get(key) === true) continue;
    opened.push(key);
  }
  return opened;
}
