/**
 * DeadEndValidator.ts — vérification automatique « aucune impasse ».
 *
 * Le validateur travaille au niveau des données de navigation : il explore le
 * graphe produit par un `LevelDefinition`, puis l'espace d'états des
 * mécanismes manipulables. Un état n'est accepté que si Turpal peut encore
 * atteindre le but, éventuellement après d'autres déplacements et actions.
 */
import { Level, type LevelDefinition, type LevelEdgeDef, type LevelMechanismDef } from './Level';
import { type MechanismValue, type NodeId } from './NavGraph';

export type DeadEndViolationReason =
  'missing-spawn' | 'missing-goal' | 'state-limit-exceeded' | 'goal-unreachable';

export interface DeadEndViolation {
  readonly reason: DeadEndViolationReason;
  readonly node: NodeId | null;
  readonly mechanismState: Readonly<Record<string, MechanismValue>>;
}

export interface DeadEndValidationOptions {
  /** Garde-fou contre un level data corrompu qui exploserait l'espace d'états. */
  readonly maxExpandedStates?: number;
  /**
   * Les illusions sont une condition de caméra, pas un mécanisme manipulable :
   * par défaut le validateur les considère disponibles pour auditer seulement
   * les impasses de mécanismes.
   */
  readonly assumeIllusionsActive?: boolean;
}

export interface DeadEndValidationReport {
  readonly levelId: string;
  readonly ok: boolean;
  readonly mechanisms: readonly string[];
  /** États étendus = position du joueur + état des mécanismes. */
  readonly checkedStates: number;
  /** Combinaisons distinctes d'états de mécanismes rencontrées. */
  readonly checkedMechanismStates: number;
  readonly violations: readonly DeadEndViolation[];
}

interface MechanismDomain {
  readonly id: string;
  readonly initial: MechanismValue;
  readonly values: readonly MechanismValue[];
  readonly actuatorNodes: readonly NodeId[];
}

interface ExpandedState {
  readonly node: NodeId;
  readonly values: readonly MechanismValue[];
}

const DEFAULT_MAX_EXPANDED_STATES = 20_000;
const POSITION_EPSILON = 0.0001;

export function validateNoDeadEnds(
  definition: LevelDefinition,
  options: DeadEndValidationOptions = {},
): DeadEndValidationReport {
  const level = new Level(definition);
  try {
    const domains = buildMechanismDomains(definition);
    const baseReport = {
      levelId: definition.id,
      mechanisms: domains.map((domain) => domain.id),
    } as const;

    if (!level.graph.hasNode(definition.spawn)) {
      return {
        ...baseReport,
        ok: false,
        checkedStates: 0,
        checkedMechanismStates: 0,
        violations: [
          {
            reason: 'missing-spawn',
            node: definition.spawn,
            mechanismState: {},
          },
        ],
      };
    }
    if (!level.graph.hasNode(definition.goal)) {
      return {
        ...baseReport,
        ok: false,
        checkedStates: 0,
        checkedMechanismStates: 0,
        violations: [
          {
            reason: 'missing-goal',
            node: definition.goal,
            mechanismState: {},
          },
        ],
      };
    }

    const maxExpandedStates = options.maxExpandedStates ?? DEFAULT_MAX_EXPANDED_STATES;
    const assumeIllusionsActive = options.assumeIllusionsActive ?? true;
    const initialValues = domains.map((domain) => domain.initial);
    const initial: ExpandedState = { node: definition.spawn, values: initialValues };

    const seen = new Map<string, ExpandedState>();
    const reverse = new Map<string, Set<string>>();
    const queue: ExpandedState[] = [initial];
    seen.set(expandedKey(initial), initial);
    let limitExceeded = false;

    while (queue.length > 0) {
      const current = queue.shift();
      if (current === undefined) break;
      const fromKey = expandedKey(current);
      const nextStates = expandState(level, domains, current, assumeIllusionsActive);

      for (const next of nextStates) {
        const toKey = expandedKey(next);
        addAdjacency(reverse, toKey, fromKey);
        if (seen.has(toKey)) continue;
        if (seen.size >= maxExpandedStates) {
          limitExceeded = true;
          continue;
        }
        seen.set(toKey, next);
        queue.push(next);
      }
    }

    const mechanismStates = new Set<string>();
    for (const state of seen.values()) mechanismStates.add(valuesKey(state.values));

    const canReachGoal = goalReachableStates(seen, reverse, definition.goal);
    const violations: DeadEndViolation[] = [];
    if (limitExceeded) {
      violations.push({
        reason: 'state-limit-exceeded',
        node: null,
        mechanismState: {},
      });
    }
    for (const [key, state] of seen) {
      if (canReachGoal.has(key)) continue;
      violations.push({
        reason: 'goal-unreachable',
        node: state.node,
        mechanismState: stateRecord(domains, state.values),
      });
    }

    return {
      ...baseReport,
      ok: violations.length === 0,
      checkedStates: seen.size,
      checkedMechanismStates: mechanismStates.size,
      violations,
    };
  } finally {
    level.dispose();
  }
}

export function formatDeadEndReport(report: DeadEndValidationReport): string {
  if (report.ok) {
    return `${report.levelId}: aucune impasse (${report.checkedStates} états étendus, ${report.checkedMechanismStates} états de mécanismes).`;
  }
  const lines = [
    `${report.levelId}: ${report.violations.length} impasse(s) détectée(s)`,
    `mécanismes: ${report.mechanisms.length === 0 ? 'aucun' : report.mechanisms.join(', ')}`,
  ];
  for (const violation of report.violations.slice(0, 8)) {
    lines.push(
      `- ${violation.reason} @ ${violation.node ?? '—'} ${JSON.stringify(violation.mechanismState)}`,
    );
  }
  if (report.violations.length > 8) {
    lines.push(`… ${report.violations.length - 8} violation(s) supplémentaire(s)`);
  }
  return lines.join('\n');
}

function expandState(
  level: Level,
  domains: readonly MechanismDomain[],
  state: ExpandedState,
  assumeIllusionsActive: boolean,
): readonly ExpandedState[] {
  applyMechanismState(level, domains, state.values, assumeIllusionsActive);
  const next: ExpandedState[] = [];

  for (const edge of level.graph.neighbors(state.node)) {
    next.push({ node: edge.to, values: state.values });
  }

  for (let index = 0; index < domains.length; index += 1) {
    const domain = domains[index];
    if (!domain?.actuatorNodes.includes(state.node)) continue;
    const current = state.values[index];
    for (const value of domain.values) {
      if (sameValue(value, current)) continue;
      const values = state.values.slice();
      values[index] = value;
      next.push({ node: state.node, values });
    }
  }

  return next;
}

function applyMechanismState(
  level: Level,
  domains: readonly MechanismDomain[],
  values: readonly MechanismValue[],
  assumeIllusionsActive: boolean,
): void {
  level.graph.setIllusoryEdgesEnabled(assumeIllusionsActive);
  for (let index = 0; index < domains.length; index += 1) {
    const domain = domains[index];
    const value = values[index];
    if (!domain || value === undefined) continue;
    level.graph.setMechanismState(domain.id, value);
  }
}

function goalReachableStates(
  seen: ReadonlyMap<string, ExpandedState>,
  reverse: ReadonlyMap<string, ReadonlySet<string>>,
  goal: NodeId,
): ReadonlySet<string> {
  const reachable = new Set<string>();
  const queue: string[] = [];
  for (const [key, state] of seen) {
    if (state.node !== goal) continue;
    reachable.add(key);
    queue.push(key);
  }

  while (queue.length > 0) {
    const current = queue.shift();
    if (current === undefined) break;
    const previous = reverse.get(current);
    if (!previous) continue;
    for (const key of previous) {
      if (reachable.has(key)) continue;
      reachable.add(key);
      queue.push(key);
    }
  }

  return reachable;
}

function buildMechanismDomains(definition: LevelDefinition): readonly MechanismDomain[] {
  const orderedIds: string[] = [];
  const mechanisms = new Map<string, LevelMechanismDef>();
  const values = new Map<string, MechanismValue[]>();

  const ensure = (id: string): MechanismValue[] => {
    let list = values.get(id);
    if (!list) {
      list = [];
      values.set(id, list);
      orderedIds.push(id);
    }
    return list;
  };

  for (const mechanism of definition.mechanisms ?? []) {
    mechanisms.set(mechanism.id, mechanism);
    addValues(ensure(mechanism.id), defaultValuesForMechanism(mechanism));
  }

  for (const edge of allEdgeDefinitions(definition)) {
    const condition = edge.condition;
    if (!condition) continue;
    addValue(ensure(condition.mechanism), condition.equals);
  }

  return orderedIds.map((id) => {
    const mechanism = mechanisms.get(id);
    const list = values.get(id) ?? [];
    const initial = initialValueForMechanism(mechanism, list);
    addValue(list, initial);
    return {
      id,
      initial,
      values: list,
      actuatorNodes:
        mechanism === undefined ? [] : actuatorNodesForMechanism(definition, mechanism),
    };
  });
}

function allEdgeDefinitions(definition: LevelDefinition): readonly LevelEdgeDef[] {
  const edges: LevelEdgeDef[] = [...definition.edges];
  for (const mechanism of definition.mechanisms ?? []) {
    for (const edge of mechanism.affects ?? []) edges.push(edge);
  }
  return edges;
}

function defaultValuesForMechanism(mechanism: LevelMechanismDef): readonly MechanismValue[] {
  switch (mechanism.kind) {
    case 'pressurePlate':
      return [false, true];
    case 'slider':
      return [0, 1];
    case 'gravityPath': {
      const from = stringParam(mechanism, 'from');
      const to = stringParam(mechanism, 'to');
      return [from ?? 'down', to ?? 'up'];
    }
    case 'rotator':
    case 'towerRotation':
      return [0];
  }
}

function initialValueForMechanism(
  mechanism: LevelMechanismDef | undefined,
  values: readonly MechanismValue[],
): MechanismValue {
  const explicit =
    mechanism === undefined
      ? undefined
      : (param(mechanism, 'initial') ??
        param(mechanism, 'initialState') ??
        param(mechanism, 'value'));
  if (explicit !== undefined) return explicit;
  if (mechanism?.kind === 'pressurePlate') return false;
  if (mechanism?.kind === 'gravityPath') return stringParam(mechanism, 'from') ?? 'down';
  if (values.some((value) => typeof value === 'boolean')) return false;
  if (values.some((value) => typeof value === 'number')) return 0;
  if (values.some((value) => typeof value === 'string')) return '';
  return false;
}

function actuatorNodesForMechanism(
  definition: LevelDefinition,
  mechanism: LevelMechanismDef,
): readonly NodeId[] {
  const explicit = new Set<NodeId>();
  for (const node of definition.nodes) {
    const tags = node.tags ?? [];
    if (
      tags.includes(`mechanism:${mechanism.id}`) ||
      tags.includes(`actuator:${mechanism.id}`) ||
      tags.includes(`lever:${mechanism.id}`)
    ) {
      explicit.add(node.id);
    }
  }
  if (explicit.size > 0) return [...explicit];

  for (const node of definition.nodes) {
    if (squaredDistanceTuple(node.at, mechanism.at) <= POSITION_EPSILON * POSITION_EPSILON) {
      return [node.id];
    }
  }

  let nearest: NodeId | null = null;
  let nearestDistance = Number.POSITIVE_INFINITY;
  for (const node of definition.nodes) {
    const distance = squaredDistanceTuple(node.at, mechanism.at);
    if (distance >= nearestDistance) continue;
    nearestDistance = distance;
    nearest = node.id;
  }
  return nearest === null ? [] : [nearest];
}

function addAdjacency(map: Map<string, Set<string>>, from: string, to: string): void {
  let entries = map.get(from);
  if (!entries) {
    entries = new Set();
    map.set(from, entries);
  }
  entries.add(to);
}

function stateRecord(
  domains: readonly MechanismDomain[],
  values: readonly MechanismValue[],
): Readonly<Record<string, MechanismValue>> {
  const record: Record<string, MechanismValue> = {};
  for (let index = 0; index < domains.length; index += 1) {
    const domain = domains[index];
    const value = values[index];
    if (!domain || value === undefined) continue;
    record[domain.id] = value;
  }
  return record;
}

function addValues(target: MechanismValue[], values: readonly MechanismValue[]): void {
  for (const value of values) addValue(target, value);
}

function addValue(target: MechanismValue[], value: MechanismValue): void {
  if (target.some((entry) => sameValue(entry, value))) return;
  target.push(value);
}

function sameValue(a: MechanismValue | undefined, b: MechanismValue | undefined): boolean {
  return a === b;
}

function expandedKey(state: ExpandedState): string {
  return `${encodeURIComponent(state.node)}@${valuesKey(state.values)}`;
}

function valuesKey(values: readonly MechanismValue[]): string {
  return values.map(valueKey).join('|');
}

function valueKey(value: MechanismValue): string {
  switch (typeof value) {
    case 'boolean':
      return `b:${value ? '1' : '0'}`;
    case 'number':
      return `n:${value}`;
    case 'string':
      return `s:${encodeURIComponent(value)}`;
  }
}

function param(mechanism: LevelMechanismDef, key: string): MechanismValue | undefined {
  return mechanism.params?.[key];
}

function stringParam(mechanism: LevelMechanismDef, key: string): string | undefined {
  const value = param(mechanism, key);
  return typeof value === 'string' ? value : undefined;
}

function squaredDistanceTuple(
  a: readonly [number, number, number],
  b: readonly [number, number, number],
): number {
  const dx = a[0] - b[0];
  const dy = a[1] - b[1];
  const dz = a[2] - b[2];
  return dx * dx + dy * dy + dz * dz;
}
