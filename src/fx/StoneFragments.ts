/**
 * StoneFragments.ts — la pierre qui se réassemble.
 *
 * Quand un chemin se referme, les éclats **s'assemblent** vers leur position
 * (docs/tasks Phase 7) : un `expo.out` de 700 ms, jamais une explosion. La
 * reconstruction est le geste du jeu entier — on répare, on n'abat rien
 * (docs/CULTURE.md : vocabulaire d'effondrement proscrit, ADR-021).
 *
 * Un seul `InstancedMesh` (règle perf § 6) : les éclats sont recyclés d'une
 * connexion à l'autre. Zéro allocation par image — les matrices sont
 * recalculées dans des objets réutilisés.
 */
import {
  BoxGeometry,
  DynamicDrawUsage,
  InstancedMesh,
  Object3D,
  Quaternion,
  Vector3,
  type BufferGeometry,
  type Material,
} from 'three';
import { FX } from '@/config';
import { motionDurationScale } from '@core/motion';
import { expoOut } from '@utils/easing';

export interface FragmentOptions {
  /** Points de la connexion : les éclats s'alignent le long de la polyline. */
  readonly points: readonly { readonly x: number; readonly y: number; readonly z: number }[];
}

interface ActiveFragment {
  readonly targetX: number;
  readonly targetY: number;
  readonly targetZ: number;
  readonly scatterX: number;
  readonly scatterY: number;
  readonly scatterZ: number;
  readonly rotationY: number;
  readonly spin: number;
}

const DUMMY = new Object3D();
const TMP_QUAT = new Quaternion();
const UP_AXIS = new Vector3(0, 1, 0);

export class StoneFragments {
  readonly mesh: InstancedMesh;

  private readonly capacity: number;
  private readonly geometry: BufferGeometry;
  private readonly fragments: ActiveFragment[] = [];
  private readonly assembleSeconds: number;
  private readonly holdSeconds: number;
  private readonly fadeSeconds: number;
  private elapsed = -1; // -1 : inactif.
  private playing = false;

  constructor(material: Material, particleScale = 1) {
    this.capacity = Math.max(8, Math.floor(FX.fragments.count * Math.min(1, particleScale)));
    this.assembleSeconds = (FX.fragments.assembleMs / 1000) * motionDurationScale();
    this.holdSeconds = (FX.fragments.holdMs / 1000) * motionDurationScale();
    this.fadeSeconds = (FX.fragments.fadeMs / 1000) * motionDurationScale();

    // Éclat : un petit prisme irrégulier, lisible en silhouette (AGENTS § 7).
    this.geometry = new BoxGeometry(0.16, 0.12, 0.2);
    this.mesh = new InstancedMesh(this.geometry, material, this.capacity);
    this.mesh.instanceMatrix.setUsage(DynamicDrawUsage);
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
    this.mesh.name = 'StoneFragments';
  }

  get isActive(): boolean {
    return this.playing;
  }

  /**
   * Lance une reconstruction le long d'une connexion : les éclats partent
   * dispersés autour de leur place et convergent — le monde se recoud.
   */
  assemble(options: FragmentOptions): void {
    const points = options.points;
    if (points.length === 0) return;
    this.fragments.length = 0;

    for (let i = 0; i < this.capacity; i += 1) {
      // Répartition le long de la polyline.
      const t = (i + 0.5) / this.capacity;
      const [x, y, z] = pointAlong(points, t);
      const angle = Math.random() * Math.PI * 2;
      const scatter = 0.9 + Math.random() * 0.9;
      this.fragments.push({
        targetX: x,
        targetY: y,
        targetZ: z,
        scatterX: x + Math.cos(angle) * scatter,
        scatterY: y + 0.4 + Math.random() * 1.1,
        scatterZ: z + Math.sin(angle) * scatter,
        rotationY: Math.random() * Math.PI * 2,
        spin: (Math.random() - 0.5) * 3,
      });
    }

    this.elapsed = 0;
    this.playing = true;
    this.mesh.count = this.fragments.length;
    this.writeInstances(0);
  }

  update(delta: number): void {
    if (!this.playing) return;
    this.elapsed += delta;

    const total = this.assembleSeconds + this.holdSeconds + this.fadeSeconds;
    if (this.elapsed >= total) {
      this.playing = false;
      this.mesh.count = 0;
      return;
    }
    this.writeInstances(this.elapsed);
  }

  dispose(): void {
    this.geometry.dispose();
    this.mesh.removeFromParent();
    this.fragments.length = 0;
    this.playing = false;
  }

  private writeInstances(elapsed: number): void {
    const assembleT = Math.min(1, elapsed / Math.max(0.001, this.assembleSeconds));
    const eased = expoOut(assembleT);

    // La disparition finale est un rétrécissement : les éclats retournent à
    // la pierre, ils ne s'évaporent pas.
    const fadeT = Math.max(
      0,
      Math.min(
        1,
        (elapsed - this.assembleSeconds - this.holdSeconds) / Math.max(0.001, this.fadeSeconds),
      ),
    );
    const scale = Math.max(0.001, (1 - fadeT) * 0.9);

    for (let i = 0; i < this.fragments.length; i += 1) {
      const fragment = this.fragments[i];
      if (fragment === undefined) continue;

      DUMMY.position.set(
        fragment.scatterX + (fragment.targetX - fragment.scatterX) * eased,
        fragment.scatterY + (fragment.targetY - fragment.scatterY) * eased,
        fragment.scatterZ + (fragment.targetZ - fragment.scatterZ) * eased,
      );
      DUMMY.quaternion.copy(
        TMP_QUAT.setFromAxisAngle(UP_AXIS, fragment.rotationY + fragment.spin * (1 - eased)),
      );
      DUMMY.scale.setScalar(scale);
      DUMMY.updateMatrix();
      this.mesh.setMatrixAt(i, DUMMY.matrix);
    }
    this.mesh.count = this.fragments.length;
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

/** Position le long d'une polyline, paramétrée par t ∈ [0, 1]. */
function pointAlong(
  points: readonly { readonly x: number; readonly y: number; readonly z: number }[],
  t: number,
): [number, number, number] {
  if (points.length === 1) {
    const only = points[0];
    return [only?.x ?? 0, only?.y ?? 0, only?.z ?? 0];
  }

  let totalLength = 0;
  for (let i = 1; i < points.length; i += 1) {
    const a = points[i - 1];
    const b = points[i];
    if (a === undefined || b === undefined) continue;
    totalLength += Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
  }
  if (totalLength <= 0) {
    const first = points[0];
    return [first?.x ?? 0, first?.y ?? 0, first?.z ?? 0];
  }

  let remaining = t * totalLength;
  for (let i = 1; i < points.length; i += 1) {
    const a = points[i - 1];
    const b = points[i];
    if (a === undefined || b === undefined) continue;
    const segment = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
    if (remaining > segment) {
      remaining -= segment;
      continue;
    }
    const local = segment <= 0 ? 0 : remaining / segment;
    return [a.x + (b.x - a.x) * local, a.y + (b.y - a.y) * local, a.z + (b.z - a.z) * local];
  }

  const last = points[points.length - 1];
  return [last?.x ?? 0, last?.y ?? 0, last?.z ?? 0];
}
