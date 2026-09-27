/**
 * Level.ts — description déclarative d'un niveau et instance runtime.
 *
 * Un niveau est d'abord une *donnée* (LevelDefinition) : un level designer
 * doit pouvoir en écrire un sans toucher au moteur. L'instance Level se
 * contente de construire le graphe de navigation, la racine Object3D et les
 * mécanismes, puis de tout libérer proprement à la sortie.
 */
import { Group } from 'three';
import { IllusionResolver, type IllusionCandidate } from './Illusion';
import {
  NavGraph,
  type EdgeCondition,
  type NavPosition,
  type NavSurface,
  type NodeId,
} from './NavGraph';
import { NodeProjection, type MatrixElements } from './NodeProjection';
import { GravityPath } from './mechanisms/GravityPath';
import type { Mechanism } from './mechanisms/Mechanism';
import { PressurePlate } from './mechanisms/PressurePlate';
import { Rotator } from './mechanisms/Rotator';
import { Slider } from './mechanisms/Slider';
import { TowerRotation } from './mechanisms/TowerRotation';
import type { SkyPaletteName } from '@render/Sky';
import type { ChapterPaletteName } from '@render/Palettes';
import { disposeObject } from '@utils/dispose';

/** Les six vertus du Nokhchalla, plus le prologue et l'épilogue. */
export type Virtue =
  | 'prologue'
  | 'hospitalite'
  | 'parole'
  | 'anciens'
  | 'patience'
  | 'pardon'
  | 'humilite'
  | 'epilogue';

/** Matière sous les pieds — pilote le timbre des pas (docs/AUDIO.md § 5). */
export type SurfaceKind = NavSurface;

export interface LevelNodeDef {
  readonly id: NodeId;
  readonly at: readonly [number, number, number];
  readonly tags?: readonly string[];
  /** Matière du sol à cet endroit. Défaut : `stone`. */
  readonly surface?: SurfaceKind;
  /**
   * Direction du « haut » sur ce nœud (ADR-004). Omise = gravité normale.
   * `[0, 0, 1]` pose le joueur sur une paroi, `[0, -1, 0]` au plafond.
   */
  readonly up?: readonly [number, number, number];
}

export interface LevelEdgeDef {
  readonly from: NodeId;
  readonly to: NodeId;
  readonly oneWay?: boolean;
  readonly cost?: number;
  readonly illusory?: boolean;
  /**
   * Arête conditionnelle (ADR-003) : « ce passage n'existe que si le
   * rotateur `tour-nord` est à 90° » s'écrit
   * `condition: { mechanism: 'tour-nord', equals: 90 }`.
   */
  readonly condition?: EdgeCondition;
}

/**
 * Bloc d'architecture. La géométrie est déclarative elle aussi : un niveau
 * est une liste de volumes, pas un fichier 3D — c'est ce qui permet de la
 * relire, de la différ et de la générer (docs/LEVEL_DESIGN.md).
 */
export interface LevelBlockDef {
  readonly kind: 'block' | 'tower' | 'stair' | 'bridge' | 'platform' | 'arch';
  readonly at: readonly [number, number, number];
  /** Dimensions en cellules. Pour une tour : [base, hauteur, base]. */
  readonly size: readonly [number, number, number];
  /** Rotation autour de Y, en degrés (multiples de 90 pour rester sur la grille). */
  readonly rotationY?: number;
  /** Rattache le bloc à un mécanisme : il bougera avec lui. */
  readonly parent?: string;
  readonly surface?: SurfaceKind;
}

/** Déclencheur narratif : un événement de récit posé sur le monde. */
export interface LevelTriggerDef {
  readonly id: string;
  /** Ce qui l'arme : arrivée sur un nœud, état d'un mécanisme, ou entrée dans le niveau. */
  readonly on:
    | { readonly node: NodeId }
    | { readonly mechanism: string; readonly equals: number | boolean }
    | { readonly levelStart: true };
  /** Ce qu'il joue : texte, geste, caméra, musique. Aucun effet mécanique. */
  readonly play:
    | { readonly textKey: string }
    | { readonly gesture: 'salute' | 'handOnStone' | 'blessing'; readonly by: 'turpal' | 'elder' }
    | { readonly musicLayers: number }
    | { readonly eagleFound: true };
  /** Un déclencheur ne se joue qu'une fois par défaut. */
  readonly once?: boolean;
}

export interface LevelMechanismDef {
  readonly id: string;
  readonly kind: 'rotator' | 'slider' | 'pressurePlate' | 'towerRotation' | 'gravityPath';
  readonly at: readonly [number, number, number];
  /** Paramètres propres au type de mécanisme (angle, axe, course…). */
  readonly params?: Readonly<Record<string, number | string | boolean>>;
  /** Nœuds dont la connectivité change quand le mécanisme bouge. */
  readonly affects?: readonly LevelEdgeDef[];
}

export interface LevelDefinition {
  readonly id: string;
  /** Numéro de chapitre, 0 = prologue. */
  readonly chapter: number;
  readonly virtue: Virtue;
  /** Clé i18n du titre affiché sur la carte de chapitre. */
  readonly titleKey: string;
  /** Clé i18n du proverbe de fin de chapitre. */
  readonly proverbKey: string;
  readonly sky: SkyPaletteName;
  /** Palette du chapitre (docs/ART_DIRECTION.md § 3). Défaut : déduite de `virtue`. */
  readonly palette?: ChapterPaletteName;
  /** Accordage du pondar et mode du chapitre (docs/AUDIO.md § 3). */
  readonly music?: {
    readonly mode: 'dorian' | 'aeolian';
    readonly root: string;
    readonly strings: readonly [string, string, string];
  };
  readonly spawn: NodeId;
  readonly goal: NodeId;
  readonly geometry?: readonly LevelBlockDef[];
  readonly nodes: readonly LevelNodeDef[];
  readonly edges: readonly LevelEdgeDef[];
  readonly mechanisms?: readonly LevelMechanismDef[];
  readonly triggers?: readonly LevelTriggerDef[];
  /** Cadrage. `zoom` remplace `CAMERA.viewSize` ; omis = auto-fit sur les nœuds. */
  readonly camera?: {
    readonly target?: readonly [number, number, number];
    readonly zoom?: number;
  };
}

export class Level {
  readonly root = new Group();
  readonly graph = new NavGraph();
  readonly nodeProjection = new NodeProjection();
  readonly illusions = new IllusionResolver();
  readonly mechanisms = new Map<string, Mechanism>();

  private readonly illusionCandidates: IllusionCandidate[] = [];

  constructor(readonly definition: LevelDefinition) {
    this.root.name = `Level:${definition.id}`;
    this.buildGraph();
    this.nodeProjection.rebuild(this.graph);
    this.illusions.rebuild(this.illusionCandidates);
  }

  get id(): string {
    return this.definition.id;
  }

  /** Barycentre des nœuds : cible de caméra par défaut. */
  get center(): NavPosition {
    const explicit = this.definition.camera?.target;
    if (explicit) return { x: explicit[0], y: explicit[1], z: explicit[2] };

    const nodes = this.graph.allNodes();
    if (nodes.length === 0) return { x: 0, y: 0, z: 0 };

    let x = 0;
    let y = 0;
    let z = 0;
    for (const node of nodes) {
      x += node.position.x;
      y += node.position.y;
      z += node.position.z;
    }
    return { x: x / nodes.length, y: y / nodes.length, z: z / nodes.length };
  }

  /** Le niveau est résolu quand Turpal atteint le nœud but. */
  isGoal(nodeId: NodeId): boolean {
    return nodeId === this.definition.goal;
  }

  /** Projection écran des nœuds : appelée chaque image par le runtime de niveau. */
  projectNodes(
    projectionMatrix: MatrixElements,
    viewMatrix: MatrixElements,
    viewportWidth: number,
    viewportHeight: number,
  ): NodeProjection {
    this.nodeProjection.syncPositions(this.graph);
    this.nodeProjection.project(projectionMatrix, viewMatrix, viewportWidth, viewportHeight);
    this.illusions.update(this.graph, this.nodeProjection);
    return this.nodeProjection;
  }

  dispose(): void {
    for (const mechanism of this.mechanisms.values()) mechanism.dispose();
    this.mechanisms.clear();
    this.nodeProjection.clear();
    this.graph.clear();
    disposeObject(this.root);
  }

  private buildGraph(): void {
    for (const node of this.definition.nodes) {
      const up = node.up;
      const tags =
        node.surface === undefined
          ? (node.tags ?? [])
          : [...(node.tags ?? []), `surface:${node.surface}`];
      this.graph.addNode(
        node.id,
        { x: node.at[0], y: node.at[1], z: node.at[2] },
        tags,
        up === undefined ? undefined : { x: up[0], y: up[1], z: up[2] },
        node.surface ?? 'stone',
      );
    }
    this.illusionCandidates.length = 0;
    for (const edge of this.edgeDefinitions()) {
      this.graph.connect(edge.from, edge.to, {
        ...(edge.oneWay === undefined ? {} : { oneWay: edge.oneWay }),
        ...(edge.cost === undefined ? {} : { cost: edge.cost }),
        ...(edge.illusory === undefined ? {} : { illusory: edge.illusory }),
        ...(edge.condition === undefined ? {} : { condition: edge.condition }),
      });
      if (edge.illusory === true) {
        this.illusionCandidates.push({
          a: edge.from,
          b: edge.to,
          ...(edge.oneWay === undefined ? {} : { oneWay: edge.oneWay }),
          ...(edge.cost === undefined ? {} : { cost: edge.cost }),
          ...(edge.condition === undefined ? {} : { condition: edge.condition }),
        });
        this.graph.setIllusoryConnectionEnabled(edge.from, edge.to, false, edge.oneWay !== true);
      }
    }
    this.buildMechanisms();
  }

  private buildMechanisms(): void {
    for (const definition of this.definition.mechanisms ?? []) {
      const mechanism = this.createMechanism(definition);
      mechanism.root.position.set(definition.at[0], definition.at[1], definition.at[2]);
      mechanism.applyToGraph(this.graph);
      this.mechanisms.set(definition.id, mechanism);
      this.root.add(mechanism.root);
    }
  }

  private createMechanism(definition: LevelMechanismDef): Mechanism {
    const params = definition.params ?? {};
    switch (definition.kind) {
      case 'rotator': {
        const axis = axisParam(params.axis);
        const stepDeg = numberParam(params.stepDeg);
        const steps = numberParam(params.steps);
        const initialStep = numberParam(params.initialStep ?? params.initial);
        return new Rotator(definition.id, {
          ...(axis === undefined ? {} : { axis }),
          ...(stepDeg === undefined ? {} : { stepDeg }),
          ...(steps === undefined ? {} : { steps }),
          ...(initialStep === undefined ? {} : { initialStep }),
        });
      }
      case 'slider': {
        const axis = axisParam(params.axis);
        const travel = numberParam(params.travel);
        const stops = numberParam(params.stops);
        const initial = numberParam(params.initial);
        return new Slider(definition.id, {
          ...(axis === undefined ? {} : { axis }),
          ...(travel === undefined ? {} : { travel }),
          ...(stops === undefined ? {} : { stops }),
          ...(initial === undefined ? {} : { initial }),
        });
      }
      case 'pressurePlate': {
        const latching = booleanParam(params.latching);
        return new PressurePlate(definition.id, {
          triggerNode:
            stringParam(params.triggerNode) ?? nearestNodeId(this.definition, definition.at),
          ...(latching === undefined ? {} : { latching }),
        });
      }
      case 'towerRotation': {
        const faces = numberParam(params.faces);
        const bidirectional = booleanParam(params.bidirectional);
        const initialFace = numberParam(params.initialFace ?? params.initial);
        return new TowerRotation(definition.id, {
          ...(faces === undefined ? {} : { faces }),
          ...(bidirectional === undefined ? {} : { bidirectional }),
          ...(initialFace === undefined ? {} : { initialFace }),
        });
      }
      case 'gravityPath':
        return new GravityPath(definition.id, {
          from: gravityParam(params.from) ?? 'down',
          to: gravityParam(params.to) ?? 'up',
          pivotNodes: nodesParam(params.pivotNodes) ?? [],
        });
    }
  }

  private edgeDefinitions(): readonly LevelEdgeDef[] {
    const affectedEdges = this.definition.mechanisms?.flatMap(
      (mechanism) => mechanism.affects ?? [],
    );
    return affectedEdges === undefined || affectedEdges.length === 0
      ? this.definition.edges
      : [...this.definition.edges, ...affectedEdges];
  }
}

type LevelParam = number | string | boolean | undefined;

function numberParam(value: LevelParam): number | undefined {
  return typeof value === 'number' ? value : undefined;
}

function stringParam(value: LevelParam): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function booleanParam(value: LevelParam): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}

function axisParam(value: LevelParam): 'x' | 'y' | 'z' | undefined {
  return value === 'x' || value === 'y' || value === 'z' ? value : undefined;
}

function gravityParam(
  value: LevelParam,
): 'down' | 'up' | 'north' | 'south' | 'east' | 'west' | undefined {
  return value === 'down' ||
    value === 'up' ||
    value === 'north' ||
    value === 'south' ||
    value === 'east' ||
    value === 'west'
    ? value
    : undefined;
}

function nodesParam(value: LevelParam): readonly NodeId[] | undefined {
  if (typeof value !== 'string') return undefined;
  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

function nearestNodeId(
  definition: LevelDefinition,
  position: readonly [number, number, number],
): NodeId {
  let best = definition.spawn;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const node of definition.nodes) {
    const dx = node.at[0] - position[0];
    const dy = node.at[1] - position[1];
    const dz = node.at[2] - position[2];
    const distance = dx * dx + dy * dy + dz * dz;
    if (distance >= bestDistance) continue;
    bestDistance = distance;
    best = node.id;
  }
  return best;
}
