/**
 * Level.ts — description déclarative d'un niveau et instance runtime.
 *
 * Un niveau est d'abord une *donnée* (LevelDefinition) : un level designer
 * doit pouvoir en écrire un sans toucher au moteur. L'instance Level se
 * contente de construire le graphe de navigation, la racine Object3D et les
 * mécanismes, puis de tout libérer proprement à la sortie.
 */
import { Group } from 'three';
import { NavGraph, type EdgeCondition, type NavPosition, type NodeId } from './NavGraph';
import type { Mechanism } from './mechanisms/Mechanism';
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
export type SurfaceKind = 'stone' | 'grass' | 'snow' | 'wood';

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
  readonly mechanisms = new Map<string, Mechanism>();

  constructor(readonly definition: LevelDefinition) {
    this.root.name = `Level:${definition.id}`;
    this.buildGraph();
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

  dispose(): void {
    for (const mechanism of this.mechanisms.values()) mechanism.dispose();
    this.mechanisms.clear();
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
      );
    }
    for (const edge of this.definition.edges) {
      this.graph.connect(edge.from, edge.to, {
        ...(edge.oneWay === undefined ? {} : { oneWay: edge.oneWay }),
        ...(edge.cost === undefined ? {} : { cost: edge.cost }),
        ...(edge.illusory === undefined ? {} : { illusory: edge.illusory }),
        ...(edge.condition === undefined ? {} : { condition: edge.condition }),
      });
    }
    // TODO(phase Niveaux) : instancier la géométrie de pierre et les mécanismes.
  }
}
