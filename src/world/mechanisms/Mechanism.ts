/**
 * Mechanism.ts — contrat commun à tout élément d'architecture manipulable.
 *
 * Règles de game design, valables pour tous les mécanismes :
 *  1. le mécanisme montre toujours qu'il est manipulable (affordance visuelle) ;
 *  2. il se déplace lentement (PACING.mechanismDurationMs) — le joueur voit
 *     l'architecture penser ;
 *  3. il ne peut jamais enfermer le joueur dans un état sans issue ;
 *  4. il émet un son unique, reconnaissable, qui devient sa signature.
 */
import {
  Group,
  Mesh,
  MeshBasicMaterial,
  TorusGeometry,
  type BufferGeometry,
  type Material,
  type Object3D,
} from 'three';
import { EMBER } from '@render/Palettes';
import { ambientDriftEnabled } from '@core/motion';
import type { NavGraph } from '../NavGraph';

export interface MechanismContext {
  readonly graph: NavGraph;
  /** Temps écoulé, en secondes — rafraîchi chaque image par le runtime. */
  elapsed: number;
}

export interface MechanismDragPoint {
  readonly pointerX: number;
  readonly pointerY: number;
  readonly centerX: number;
  readonly centerY: number;
}

export interface Mechanism {
  readonly id: string;
  readonly root: Object3D;
  /** Sous-racine mobile optionnelle pour la géométrie parentée. */
  readonly geometryRoot?: Object3D;
  /** Point visuel de picking quand il diffère de l'ancre monde. */
  readonly interactionRoot?: Object3D;
  /** Enregistre un volume qui se déplace à un cran précis d'une séquence. */
  bindStagedObject?(
    object: Object3D,
    target: readonly [number, number, number],
    stage: number,
  ): void;
  /** Le joueur peut-il l'actionner en ce moment ? */
  readonly interactive: boolean;
  /** Une animation est-elle en cours ? (le jeu bloque les entrées pendant.) */
  readonly isAnimating: boolean;

  /** Actionne le mécanisme. `amount` = glissement normalisé pour les gestes. */
  actuate(amount?: number): void;
  /** Verrou narratif temporaire, par exemple pendant la traversée d'un invité. */
  setEnabled(enabled: boolean): void;
  beginDrag?(point: MechanismDragPoint): void;
  drag?(point: MechanismDragPoint): void;
  endDrag?(): void;
  update(context: MechanismContext, delta: number): void;
  /** Reconnecte le graphe selon la position courante. */
  applyToGraph(graph: NavGraph): void;
  /** Lueur d'indice 0..1 (docs/tasks Phase 7, Hints). */
  setHintGlow(value: number): void;
  dispose(): void;
}

/** Base commune : gère l'identité, la racine, l'affordance et le portage. */
export abstract class BaseMechanism implements Mechanism {
  abstract readonly root: Object3D;

  protected readonly affordance = new Group();
  protected animating = false;
  protected enabled = true;

  private readonly ownedGeometries: BufferGeometry[] = [];
  private readonly ownedMaterials: Material[] = [];
  protected passenger: Object3D | null = null;
  private affordanceTime = 0;
  private affordanceMaterial: MeshBasicMaterial | null = null;
  private hintGlowValue = 0;

  constructor(readonly id: string) {}

  get interactive(): boolean {
    return this.enabled && !this.animating;
  }

  get isAnimating(): boolean {
    return this.animating;
  }

  get carriedPassenger(): Object3D | null {
    return this.passenger;
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    this.affordance.visible = enabled;
  }

  /**
   * Lueur d'indice (docs/tasks Phase 7) : après 90 s d'inactivité, le monde
   * désigne discrètement l'élément utile. `value` va de 0 (rien) à 1 (lueur
   * pleine) ; l'appelant assure le fondu de 900 ms.
   */
  setHintGlow(value: number): void {
    this.hintGlowValue = Math.min(1, Math.max(0, value));
  }

  get hintGlow(): number {
    return this.hintGlowValue;
  }

  /** Parentage temporaire : un joueur posé dessus se déplace avec le mécanisme. */
  attachPassenger(object: Object3D): void {
    if (this.passenger === object) return;
    this.passenger = object;
    this.root.attach(object);
  }

  detachPassenger(parent?: Object3D): void {
    if (!this.passenger) return;
    if (parent) parent.attach(this.passenger);
    else this.passenger.removeFromParent();
    this.passenger = null;
  }

  abstract actuate(amount?: number): void;
  abstract applyToGraph(graph: NavGraph): void;

  update(_context: MechanismContext, delta: number): void {
    this.updateAffordance(delta);
  }

  dispose(): void {
    this.detachPassenger();
    for (const geometry of this.ownedGeometries) geometry.dispose();
    for (const material of this.ownedMaterials) material.dispose();
    this.ownedGeometries.length = 0;
    this.ownedMaterials.length = 0;
    this.root.removeFromParent();
    this.root.clear();
  }

  protected attachAffordance(radius = 0.22, y = 0.04): void {
    this.affordance.name = `MechanismAffordance:${this.id}`;
    const outlineGeometry = this.trackGeometry(new TorusGeometry(radius, 0.032, 5, 32));
    const outlineMaterial = this.trackMaterial(
      new MeshBasicMaterial({
        color: 0x10161f,
        transparent: true,
        opacity: 0.76,
        depthWrite: false,
      }),
    );
    const outline = new Mesh(outlineGeometry, outlineMaterial);
    outline.name = `MechanismAffordanceOutline:${this.id}`;
    outline.rotation.x = Math.PI / 2;

    const geometry = this.trackGeometry(new TorusGeometry(radius, 0.012, 5, 32));
    const material = this.trackMaterial(
      new MeshBasicMaterial({
        color: EMBER,
        transparent: true,
        opacity: 0.82,
        depthWrite: false,
      }),
    );
    this.affordanceMaterial = material;
    const ring = new Mesh(geometry, material);
    ring.name = `MechanismHandle:${this.id}`;
    ring.rotation.x = Math.PI / 2;
    this.affordance.position.y = y;
    this.affordance.add(outline, ring);
    this.root.add(this.affordance);
  }

  protected trackGeometry<T extends BufferGeometry>(geometry: T): T {
    this.ownedGeometries.push(geometry);
    return geometry;
  }

  /** Position monde du mécanisme pour les événements (FX, audio). */
  protected eventPosition(): { x: number; y: number; z: number } {
    return {
      x: this.root.position.x,
      y: this.root.position.y,
      z: this.root.position.z,
    };
  }

  protected trackMaterial<T extends Material>(material: T): T {
    this.ownedMaterials.push(material);
    return material;
  }

  protected updateAffordance(delta: number): void {
    this.affordanceTime += delta;
    // Pulsation à 0,5 Hz, plus ample quand le mécanisme porte un indice.
    const glow = this.hintGlowValue;
    const pulse = ambientDriftEnabled()
      ? 1 + Math.sin(this.affordanceTime * Math.PI) * (0.045 + glow * 0.16)
      : 1 + glow * 0.08;
    this.affordance.scale.setScalar(pulse);
    if (this.affordanceMaterial !== null) {
      this.affordanceMaterial.opacity = 0.82 + glow * 0.18;
    }
  }
}

export function screenAngle(point: MechanismDragPoint): number {
  return Math.atan2(point.pointerY - point.centerY, point.pointerX - point.centerX);
}

export function shortestAngleDelta(from: number, to: number): number {
  let delta = to - from;
  while (delta > Math.PI) delta -= Math.PI * 2;
  while (delta < -Math.PI) delta += Math.PI * 2;
  return delta;
}

export function elasticOut(value: number): number {
  const t = Math.min(1, Math.max(0, value));
  if (t === 0 || t === 1) return t;
  return 2 ** (-8 * t) * Math.sin(((t * 8 - 0.75) * (2 * Math.PI)) / 3) + 1;
}

export function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}
