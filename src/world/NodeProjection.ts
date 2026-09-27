/**
 * NodeProjection.ts — projection écran zéro allocation des nœuds de navigation.
 *
 * Les illusions, le picking tolérant et le debug nav ont besoin de connaître
 * chaque frame la position écran des nœuds. Cette classe transforme les
 * positions monde en pixels CSS dans des `Float32Array` préalloués : après
 * `rebuild()`, `syncPositions()` et `project()` ne créent aucun objet.
 */
import type { NavGraph, NodeId } from '@world/NavGraph';

export type MatrixElements = ArrayLike<number>;

export interface MutableScreenPoint {
  x: number;
  y: number;
}

export class NodeProjection {
  private readonly ids: NodeId[] = [];
  private readonly indexById = new Map<NodeId, number>();
  private worldX = new Float32Array(0);
  private worldY = new Float32Array(0);
  private worldZ = new Float32Array(0);
  private screenX = new Float32Array(0);
  private screenY = new Float32Array(0);
  private ndcDepth = new Float32Array(0);
  private visible = new Uint8Array(0);
  private readonly projectionView = new Float64Array(16);

  get count(): number {
    return this.ids.length;
  }

  get capacity(): number {
    return this.screenX.length;
  }

  get screenXBuffer(): Float32Array {
    return this.screenX;
  }

  get screenYBuffer(): Float32Array {
    return this.screenY;
  }

  get depthBuffer(): Float32Array {
    return this.ndcDepth;
  }

  get visibleBuffer(): Uint8Array {
    return this.visible;
  }

  /** Reconstruit l'ordre des nœuds. Appelé au chargement ou si le graphe change de taille. */
  rebuild(graph: NavGraph): void {
    const nodes = graph.allNodes();
    this.ensureCapacity(nodes.length);
    this.ids.length = 0;
    this.indexById.clear();

    for (let i = 0; i < nodes.length; i += 1) {
      const node = nodes[i];
      if (!node) continue;
      this.ids.push(node.id);
      this.indexById.set(node.id, i);
      this.worldX[i] = node.position.x;
      this.worldY[i] = node.position.y;
      this.worldZ[i] = node.position.z;
      this.screenX[i] = 0;
      this.screenY[i] = 0;
      this.ndcDepth[i] = 0;
      this.visible[i] = 0;
    }
  }

  /** Met à jour les positions monde sans réallouer ni changer l'ordre. */
  syncPositions(graph: NavGraph): void {
    for (let i = 0; i < this.ids.length; i += 1) {
      const id = this.ids[i];
      if (id === undefined) continue;
      const node = graph.getNode(id);
      if (!node) {
        this.visible[i] = 0;
        continue;
      }
      this.worldX[i] = node.position.x;
      this.worldY[i] = node.position.y;
      this.worldZ[i] = node.position.z;
    }
  }

  /**
   * Projette tous les nœuds en pixels CSS.
   *
   * `projectionElements` et `viewElements` sont les `elements` de matrices
   * three.js (`camera.projectionMatrix.elements` et
   * `camera.matrixWorldInverse.elements`). Les coordonnées écran sont dans le
   * repère DOM : x vers la droite, y vers le bas.
   */
  project(
    projectionElements: MatrixElements,
    viewElements: MatrixElements,
    viewportWidth: number,
    viewportHeight: number,
  ): void {
    multiplyMatrices(projectionElements, viewElements, this.projectionView);
    const e = this.projectionView;
    const m0 = e[0] ?? 0;
    const m1 = e[1] ?? 0;
    const m2 = e[2] ?? 0;
    const m3 = e[3] ?? 0;
    const m4 = e[4] ?? 0;
    const m5 = e[5] ?? 0;
    const m6 = e[6] ?? 0;
    const m7 = e[7] ?? 0;
    const m8 = e[8] ?? 0;
    const m9 = e[9] ?? 0;
    const m10 = e[10] ?? 0;
    const m11 = e[11] ?? 0;
    const m12 = e[12] ?? 0;
    const m13 = e[13] ?? 0;
    const m14 = e[14] ?? 0;
    const m15 = e[15] ?? 0;
    const halfWidth = viewportWidth * 0.5;
    const halfHeight = viewportHeight * 0.5;

    for (let i = 0; i < this.ids.length; i += 1) {
      const x = this.worldX[i] ?? 0;
      const y = this.worldY[i] ?? 0;
      const z = this.worldZ[i] ?? 0;
      const clipX = m0 * x + m4 * y + m8 * z + m12;
      const clipY = m1 * x + m5 * y + m9 * z + m13;
      const clipZ = m2 * x + m6 * y + m10 * z + m14;
      const clipW = m3 * x + m7 * y + m11 * z + m15;
      const invW = clipW === 0 ? 0 : 1 / clipW;
      const ndcX = clipX * invW;
      const ndcY = clipY * invW;
      const ndcZ = clipZ * invW;

      this.screenX[i] = ndcX * halfWidth + halfWidth;
      this.screenY[i] = halfHeight - ndcY * halfHeight;
      this.ndcDepth[i] = ndcZ;
      this.visible[i] =
        clipW > 0 && ndcX >= -1 && ndcX <= 1 && ndcY >= -1 && ndcY <= 1 && ndcZ >= -1 && ndcZ <= 1
          ? 1
          : 0;
    }
  }

  indexOf(id: NodeId): number {
    return this.indexById.get(id) ?? -1;
  }

  /** Identifiant du nœud à l'index — sans allouer le tableau complet. */
  idAt(index: number): NodeId | undefined {
    return this.ids[index];
  }

  isVisible(id: NodeId): boolean {
    const index = this.indexOf(id);
    return index >= 0 && this.visible[index] === 1;
  }

  screenXOf(id: NodeId): number {
    const index = this.indexOf(id);
    return index < 0 ? Number.NaN : (this.screenX[index] ?? Number.NaN);
  }

  screenYOf(id: NodeId): number {
    const index = this.indexOf(id);
    return index < 0 ? Number.NaN : (this.screenY[index] ?? Number.NaN);
  }

  writeScreenPoint(id: NodeId, target: MutableScreenPoint): boolean {
    const index = this.indexOf(id);
    if (index < 0 || this.visible[index] !== 1) return false;
    target.x = this.screenX[index] ?? 0;
    target.y = this.screenY[index] ?? 0;
    return true;
  }

  clear(): void {
    this.ids.length = 0;
    this.indexById.clear();
  }

  private ensureCapacity(count: number): void {
    if (this.capacity >= count) return;
    const capacity = nextPowerOfTwo(Math.max(count, 8));
    this.worldX = new Float32Array(capacity);
    this.worldY = new Float32Array(capacity);
    this.worldZ = new Float32Array(capacity);
    this.screenX = new Float32Array(capacity);
    this.screenY = new Float32Array(capacity);
    this.ndcDepth = new Float32Array(capacity);
    this.visible = new Uint8Array(capacity);
  }
}

function multiplyMatrices(a: MatrixElements, b: MatrixElements, target: Float64Array): void {
  const a11 = a[0] ?? 0;
  const a12 = a[4] ?? 0;
  const a13 = a[8] ?? 0;
  const a14 = a[12] ?? 0;
  const a21 = a[1] ?? 0;
  const a22 = a[5] ?? 0;
  const a23 = a[9] ?? 0;
  const a24 = a[13] ?? 0;
  const a31 = a[2] ?? 0;
  const a32 = a[6] ?? 0;
  const a33 = a[10] ?? 0;
  const a34 = a[14] ?? 0;
  const a41 = a[3] ?? 0;
  const a42 = a[7] ?? 0;
  const a43 = a[11] ?? 0;
  const a44 = a[15] ?? 0;

  const b11 = b[0] ?? 0;
  const b12 = b[4] ?? 0;
  const b13 = b[8] ?? 0;
  const b14 = b[12] ?? 0;
  const b21 = b[1] ?? 0;
  const b22 = b[5] ?? 0;
  const b23 = b[9] ?? 0;
  const b24 = b[13] ?? 0;
  const b31 = b[2] ?? 0;
  const b32 = b[6] ?? 0;
  const b33 = b[10] ?? 0;
  const b34 = b[14] ?? 0;
  const b41 = b[3] ?? 0;
  const b42 = b[7] ?? 0;
  const b43 = b[11] ?? 0;
  const b44 = b[15] ?? 0;

  target[0] = a11 * b11 + a12 * b21 + a13 * b31 + a14 * b41;
  target[4] = a11 * b12 + a12 * b22 + a13 * b32 + a14 * b42;
  target[8] = a11 * b13 + a12 * b23 + a13 * b33 + a14 * b43;
  target[12] = a11 * b14 + a12 * b24 + a13 * b34 + a14 * b44;

  target[1] = a21 * b11 + a22 * b21 + a23 * b31 + a24 * b41;
  target[5] = a21 * b12 + a22 * b22 + a23 * b32 + a24 * b42;
  target[9] = a21 * b13 + a22 * b23 + a23 * b33 + a24 * b43;
  target[13] = a21 * b14 + a22 * b24 + a23 * b34 + a24 * b44;

  target[2] = a31 * b11 + a32 * b21 + a33 * b31 + a34 * b41;
  target[6] = a31 * b12 + a32 * b22 + a33 * b32 + a34 * b42;
  target[10] = a31 * b13 + a32 * b23 + a33 * b33 + a34 * b43;
  target[14] = a31 * b14 + a32 * b24 + a33 * b34 + a34 * b44;

  target[3] = a41 * b11 + a42 * b21 + a43 * b31 + a44 * b41;
  target[7] = a41 * b12 + a42 * b22 + a43 * b32 + a44 * b42;
  target[11] = a41 * b13 + a42 * b23 + a43 * b33 + a44 * b43;
  target[15] = a41 * b14 + a42 * b24 + a43 * b34 + a44 * b44;
}

function nextPowerOfTwo(value: number): number {
  let power = 1;
  while (power < value) power *= 2;
  return power;
}
