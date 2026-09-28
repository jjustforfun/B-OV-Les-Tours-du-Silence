/**
 * Level.ts — description déclarative d'un niveau et instance runtime.
 *
 * Un niveau est d'abord une *donnée* (LevelDefinition) : un level designer
 * doit pouvoir en écrire un sans toucher au moteur. L'instance Level se
 * contente de construire le graphe de navigation, la racine Object3D et les
 * mécanismes, puis de tout libérer proprement à la sortie.
 */
import { Box3, Group, Vector3 } from 'three';
import { IllusionResolver, type IllusionCandidate } from './Illusion';
import { LevelGeometry } from './LevelGeometry';
import { Eagle } from '@entities/wildlife/Eagle';
import {
  NavGraph,
  type EdgeCondition,
  type MechanismValue,
  type NavPosition,
  type NavSurface,
  type NodeId,
} from './NavGraph';
import { NodeProjection, type MatrixElements } from './NodeProjection';
import { GravityPath } from './mechanisms/GravityPath';
import type { Mechanism } from './mechanisms/Mechanism';
import { MoonCycle } from './mechanisms/MoonCycle';
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

/** Couches d'ambiance sonore, déclarées par lieu (docs/AUDIO.md § 2). */
export type AmbienceLayerName = 'wind' | 'river' | 'bells' | 'eagle' | 'fire' | 'stone';

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
  /** Conjonction de conditions ; utile quand un geste et une position sont requis. */
  readonly conditions?: readonly EdgeCondition[];
}

/** Voyageur autonome, sans chemin empruntable par Turpal. */
export interface LevelTravelerActorDef {
  readonly id: string;
  readonly kind: 'traveler';
  readonly spawn: NodeId;
  readonly path: readonly NodeId[];
  readonly startsOn: EdgeCondition;
  /** État logique verrouillé à la fin du trajet de l'acteur. */
  readonly completesState: {
    readonly mechanism: string;
    readonly value: MechanismValue;
    readonly initial: MechanismValue;
  };
  /** Le mécanisme reste immobile pendant que l'acteur traverse. */
  readonly locksMechanism?: string;
  /** Foyer qui se rallume après le geste d'hospitalité. */
  readonly hearthAt?: readonly [number, number, number];
}

/** Enfant témoin : il reste assis jusqu'à ce qu'une promesse soit tenue. */
export interface LevelChildActorDef {
  readonly id: string;
  readonly kind: 'child';
  readonly at: readonly [number, number, number];
  readonly reactsOn: EdgeCondition;
}

export interface LevelElderStageDef {
  readonly startsOn: EdgeCondition;
  readonly path: readonly NodeId[];
}

/** Ancien autonome : chaque dalle libère une nouvelle marche de son trajet. */
export interface LevelElderActorDef {
  readonly id: string;
  readonly kind: 'elder';
  readonly spawn: NodeId;
  readonly stages: readonly LevelElderStageDef[];
  readonly completesState: {
    readonly mechanism: string;
    readonly value: MechanismValue;
    readonly initial: MechanismValue;
  };
}

/**
 * Rival silencieux du chapitre du pardon.
 *
 * Sa réponse n'est ni un levier arbitraire ni une cinématique : elle suit
 * l'arrivée de Turpal sur `respondsOnNode`. `responseState` impose de quitter
 * la corniche avant une nouvelle tentative et rend ainsi l'ordre
 * Turpal → rival explicite jusque dans l'exploration exhaustive.
 */
export interface LevelRivalActorDef {
  readonly id: string;
  readonly kind: 'rival';
  readonly spawn: NodeId;
  readonly respondsOnNode: NodeId;
  readonly playerMechanism: string;
  readonly rivalMechanism: string;
  readonly playerFace: number;
  readonly rivalFace: number;
  readonly advancedState: {
    readonly mechanism: string;
    readonly value: MechanismValue;
    readonly initial: MechanismValue;
  };
  /** `initial` = prêt ; `value` = réponse consommée jusqu'au prochain retrait. */
  readonly responseState: {
    readonly mechanism: string;
    readonly value: MechanismValue;
    readonly initial: MechanismValue;
  };
  readonly completesState: {
    readonly mechanism: string;
    readonly value: MechanismValue;
    readonly initial: MechanismValue;
  };
}

/** Procession de Tebulosmta : Borz porte les quatre autres, jamais Turpal. */
export interface LevelProcessionActorDef {
  readonly id: string;
  readonly kind: 'procession';
  readonly waitingNodes: readonly NodeId[];
  readonly summitNodes: readonly NodeId[];
  readonly outboundPath: readonly NodeId[];
  readonly returnPath: readonly NodeId[];
  readonly startsOn: EdgeCondition;
  readonly completesState: {
    readonly mechanism: string;
    readonly value: MechanismValue;
    readonly initial: MechanismValue;
  };
}

export type LevelActorDef =
  | LevelTravelerActorDef
  | LevelChildActorDef
  | LevelElderActorDef
  | LevelRivalActorDef
  | LevelProcessionActorDef;

/** Tableau vivant de l'épilogue : aucune énigme, seulement le retour parmi les siens. */
export interface LevelFinaleDef {
  /** Une tour s'éveille à chacun de ces nœuds, dans l'ordre des huit chapitres. */
  readonly towerNodes: readonly NodeId[];
  readonly thresholdNode: NodeId;
  readonly seatNode: NodeId;
  readonly residentNodes: {
    readonly traveler: NodeId;
    readonly child: NodeId;
    readonly elder: NodeId;
    readonly rival: NodeId;
  };
  /** Les sept secrets précédents donnent uniquement la visite finale de l'aigle. */
  readonly requiredEagles: readonly string[];
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
  /** Une tour de l'épilogue peut rappeler la palette d'un chapitre antérieur. */
  readonly towerPalette?: ChapterPaletteName;
  /** Rattache le bloc à un mécanisme : il bougera avec lui. */
  readonly parent?: string;
  /** Destination monde d'un transfert par étapes (slider narratif). */
  readonly moveTo?: readonly [number, number, number];
  /** Cran 1..N auquel ce bloc effectue son transfert. */
  readonly moveStage?: number;
  readonly surface?: SurfaceKind;
  /** Teinte exceptionnelle (eau, braise) ; les pierres utilisent la palette. */
  readonly color?: number;
  /** Transparence exceptionnelle, notamment pour la surface du lac. */
  readonly opacity?: number;
}

/** Secret optionnel : aucune incidence sur la solution ni sur la progression. */
export interface LevelSecretDef {
  readonly id: string;
  readonly kind: 'eagle';
  /** Nœud de picking non marchable associé au `LevelTriggerDef`. */
  readonly node: NodeId;
  readonly at: readonly [number, number, number];
  /** L'aigle reste invisible avant ce nœud, sans jamais être pointé par un indice. */
  readonly revealOnNode?: NodeId;
  /** Visibilité liée à une position, sans rendre cette position utile au puzzle. */
  readonly revealOnMechanism?: EdgeCondition;
}

/** Déclencheur narratif : un événement de récit posé sur le monde. */
export interface LevelTriggerDef {
  readonly id: string;
  /** Ce qui l'arme : arrivée sur un nœud, état d'un mécanisme, ou entrée dans le niveau. */
  readonly on:
    | { readonly node: NodeId }
    | { readonly mechanism: string; readonly equals: MechanismValue }
    | { readonly levelStart: true };
  /** Ce qu'il joue : texte, geste, caméra, musique. Aucun effet mécanique. */
  readonly play:
    | { readonly textKey: string }
    | {
        readonly gesture: 'salute' | 'handOnStone' | 'blessing' | 'sit';
        readonly by: 'turpal' | 'elder';
      }
    | { readonly musicLayers: number }
    | { readonly revealSecret: string }
    | { readonly borzAwaken: true }
    | { readonly eagleFound: true }
    | { readonly sky: SkyPaletteName; readonly durationSeconds?: number };
  /** Un déclencheur ne se joue qu'une fois par défaut. */
  readonly once?: boolean;
}

export interface LevelMechanismDef {
  readonly id: string;
  readonly kind:
    'rotator' | 'slider' | 'pressurePlate' | 'towerRotation' | 'moonCycle' | 'gravityPath';
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
  /**
   * Couches d'ambiance sonore du lieu (docs/AUDIO.md § 2). Omis = plan par
   * défaut du chapitre (vent partout, torrent aux ch. 2 et 4, cloches aux
   * ch. 1 et 3, aigle aux ch. 0, 5 et 6, feu aux ch. 1 et 7, pierre aux
   * ch. 0 et 5).
   */
  readonly ambience?: readonly AmbienceLayerName[];
  /** Durée de première découverte visée, en minutes. */
  readonly durationMinutes?: {
    readonly target: number;
    readonly min: number;
    readonly max: number;
  };
  readonly spawn: NodeId;
  readonly goal: NodeId;
  readonly geometry?: readonly LevelBlockDef[];
  readonly secrets?: readonly LevelSecretDef[];
  readonly actors?: readonly LevelActorDef[];
  readonly finale?: LevelFinaleDef;
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
  readonly bounds = new Box3();
  readonly towerRoots: readonly Group[];

  private readonly illusionCandidates: IllusionCandidate[] = [];
  private readonly secretActors = new Map<string, Eagle>();
  private readonly geometryRuntime: LevelGeometry;

  constructor(readonly definition: LevelDefinition) {
    this.root.name = `Level:${definition.id}`;
    this.buildGraph();
    this.geometryRuntime = new LevelGeometry(
      definition.geometry ?? [],
      definition.palette ?? definition.virtue,
      this.mechanisms,
    );
    this.towerRoots = this.geometryRuntime.towerRoots;
    this.root.add(this.geometryRuntime.root);
    this.buildSecrets();
    this.nodeProjection.rebuild(this.graph);
    this.illusions.rebuild(this.illusionCandidates);
    this.bounds.setFromObject(this.root);
    for (const node of this.graph.allNodes()) {
      this.bounds.expandByPoint(new Vector3(node.position.x, node.position.y, node.position.z));
    }
  }

  get id(): string {
    return this.definition.id;
  }

  /**
   * Les transitions du validateur sont locales : le runtime applique la même
   * règle et n'autorise un mécanisme que depuis son nœud d'action.
   */
  isMechanismActuatorNode(mechanismId: string, nodeId: NodeId): boolean {
    const definition = this.definition.mechanisms?.find(({ id }) => id === mechanismId);
    if (definition === undefined) return false;
    const actuatorTags = [
      `mechanism:${mechanismId}`,
      `actuator:${mechanismId}`,
      `lever:${mechanismId}`,
    ];
    const explicit = this.definition.nodes.filter((node) =>
      node.tags?.some((tag) => actuatorTags.includes(tag)),
    );
    if (explicit.length > 0) return explicit.some((node) => node.id === nodeId);
    return nearestNodeId(this.definition, definition.at) === nodeId;
  }

  get estimatedDrawCalls(): number {
    return this.geometryRuntime.estimatedDrawCalls;
  }

  get triangleCount(): number {
    return this.geometryRuntime.triangleCount;
  }

  secretForNode(nodeId: NodeId): LevelSecretDef | undefined {
    return this.definition.secrets?.find((secret) => secret.node === nodeId);
  }

  isSecretPickable(nodeId: NodeId): boolean {
    const node = this.graph.getNode(nodeId);
    if (node !== undefined) {
      for (const tag of node.tags) {
        if (tag.startsWith('traveler:')) return false;
      }
    }
    const secret = this.secretForNode(nodeId);
    if (secret === undefined) return true;
    const actor = this.secretActors.get(secret.id);
    return actor?.isVisible === true && !actor.isFound;
  }

  revealSecret(id: string): void {
    this.secretActors.get(id)?.reveal();
  }

  discoverSecret(id: string): void {
    this.secretActors.get(id)?.discover();
  }

  revealSecretsForNode(nodeId: NodeId): void {
    for (const secret of this.definition.secrets ?? []) {
      if (secret.revealOnNode === nodeId) this.revealSecret(secret.id);
    }
  }

  syncSecretsForMechanism(mechanismId: string): void {
    for (const secret of this.definition.secrets ?? []) {
      const condition = secret.revealOnMechanism;
      if (condition?.mechanism !== mechanismId) continue;
      const actor = this.secretActors.get(secret.id);
      if (this.graph.getMechanismState(mechanismId) === condition.equals) actor?.reveal();
      else actor?.conceal();
    }
  }

  completeActor(actorId: string): string | null {
    const actor = this.definition.actors?.find((candidate) => candidate.id === actorId);
    if (actor === undefined || actor.kind === 'child') return null;
    this.graph.setMechanismState(actor.completesState.mechanism, actor.completesState.value);
    return actor.completesState.mechanism;
  }

  updateSecrets(delta: number): void {
    for (const actor of this.secretActors.values()) actor.update(delta);
  }

  secretWorldPosition(id: string, out: Vector3): boolean {
    const actor = this.secretActors.get(id);
    if (actor === undefined) return false;
    actor.root.getWorldPosition(out);
    return true;
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
    this.geometryRuntime.disposeParented();
    for (const mechanism of this.mechanisms.values()) mechanism.dispose();
    this.mechanisms.clear();
    for (const actor of this.secretActors.values()) actor.dispose();
    this.secretActors.clear();
    this.nodeProjection.clear();
    this.graph.clear();
    disposeObject(this.root);
  }

  private buildSecrets(): void {
    for (const secret of this.definition.secrets ?? []) {
      if (secret.kind !== 'eagle') continue;
      const mechanismCondition = secret.revealOnMechanism;
      const initiallyVisible =
        secret.revealOnNode === undefined &&
        (mechanismCondition === undefined ||
          this.graph.getMechanismState(mechanismCondition.mechanism) === mechanismCondition.equals);
      const eagle = new Eagle(initiallyVisible);
      eagle.root.name = `Secret:Eagle:${secret.id}`;
      eagle.root.position.set(secret.at[0], secret.at[1], secret.at[2]);
      this.secretActors.set(secret.id, eagle);
      this.root.add(eagle.root);
    }
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
    for (const actor of this.definition.actors ?? []) {
      if (actor.kind === 'child') continue;
      this.graph.setMechanismState(actor.completesState.mechanism, actor.completesState.initial);
      if (actor.kind !== 'rival') continue;
      this.graph.setMechanismState(actor.advancedState.mechanism, actor.advancedState.initial);
      this.graph.setMechanismState(actor.responseState.mechanism, actor.responseState.initial);
    }
    this.illusionCandidates.length = 0;
    for (const edge of this.edgeDefinitions()) {
      this.graph.connect(edge.from, edge.to, {
        ...(edge.oneWay === undefined ? {} : { oneWay: edge.oneWay }),
        ...(edge.cost === undefined ? {} : { cost: edge.cost }),
        ...(edge.illusory === undefined ? {} : { illusory: edge.illusory }),
        ...(edge.condition === undefined ? {} : { condition: edge.condition }),
        ...(edge.conditions === undefined ? {} : { conditions: edge.conditions }),
      });
      if (edge.illusory === true) {
        this.illusionCandidates.push({
          a: edge.from,
          b: edge.to,
          ...(edge.oneWay === undefined ? {} : { oneWay: edge.oneWay }),
          ...(edge.cost === undefined ? {} : { cost: edge.cost }),
          ...(edge.condition === undefined ? {} : { condition: edge.condition }),
          ...(edge.conditions === undefined ? {} : { conditions: edge.conditions }),
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
        const snapSeconds = numberParam(params.snapSeconds);
        const affectedNodes = nodesParam(params.affectedNodes);
        return new Slider(definition.id, {
          ...(axis === undefined ? {} : { axis }),
          ...(travel === undefined ? {} : { travel }),
          ...(stops === undefined ? {} : { stops }),
          ...(initial === undefined ? {} : { initial }),
          ...(snapSeconds === undefined ? {} : { snapSeconds }),
          ...(affectedNodes === undefined ? {} : { affectedNodes }),
        });
      }
      case 'pressurePlate': {
        const latching = booleanParam(params.latching);
        const pressDepth = numberParam(params.pressDepth);
        const pressSeconds = numberParam(params.pressSeconds);
        const loweringSeconds = numberParam(params.loweringSeconds);
        const linkX = numberParam(params.linkX);
        const linkY = numberParam(params.linkY);
        const linkZ = numberParam(params.linkZ);
        const bridgeFrom = stringParam(params.bridgeFrom);
        const bridgeTo = stringParam(params.bridgeTo);
        return new PressurePlate(definition.id, {
          triggerNode:
            stringParam(params.triggerNode) ?? nearestNodeId(this.definition, definition.at),
          ...(latching === undefined ? {} : { latching }),
          ...(pressDepth === undefined ? {} : { pressDepth }),
          ...(pressSeconds === undefined ? {} : { pressSeconds }),
          ...(loweringSeconds === undefined ? {} : { loweringSeconds }),
          ...(linkX === undefined || linkY === undefined || linkZ === undefined
            ? {}
            : { linkTo: [linkX, linkY, linkZ] as const }),
          ...(bridgeFrom === undefined || bridgeTo === undefined
            ? {}
            : { borzBridge: [bridgeFrom, bridgeTo] as const }),
        });
      }
      case 'towerRotation': {
        const faces = numberParam(params.faces);
        const bidirectional = booleanParam(params.bidirectional);
        const initialFace = numberParam(params.initialFace ?? params.initial);
        const snapSeconds = numberParam(params.snapSeconds);
        const centerX = numberParam(params.centerX);
        const centerY = numberParam(params.centerY);
        const centerZ = numberParam(params.centerZ);
        const affectedNodes = nodesParam(params.affectedNodes);
        return new TowerRotation(definition.id, {
          ...(faces === undefined ? {} : { faces }),
          ...(bidirectional === undefined ? {} : { bidirectional }),
          ...(initialFace === undefined ? {} : { initialFace }),
          ...(snapSeconds === undefined ? {} : { snapSeconds }),
          ...(centerX === undefined || centerY === undefined || centerZ === undefined
            ? {}
            : { center: [centerX, centerY, centerZ] as const }),
          ...(affectedNodes === undefined ? {} : { affectedNodes }),
        });
      }
      case 'moonCycle': {
        const startsOn = stringParam(params.startsOn);
        const startsAt = params.startsAt;
        const durationSeconds = numberParam(params.durationSeconds);
        const zenithSeconds = numberParam(params.zenithSeconds);
        const riseHeight = numberParam(params.riseHeight);
        const driftX = numberParam(params.driftX);
        return new MoonCycle(definition.id, {
          startsOn: {
            mechanism: startsOn ?? '',
            equals: startsAt ?? true,
          },
          ...(durationSeconds === undefined ? {} : { durationSeconds }),
          ...(zenithSeconds === undefined ? {} : { zenithSeconds }),
          ...(riseHeight === undefined ? {} : { riseHeight }),
          ...(driftX === undefined ? {} : { driftX }),
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
