/**
 * BlobShadows.ts — ombres blob instanciées.
 *
 * Sur mobile, les shadow maps dynamiques sont interdites : les personnages
 * sont ancrés au sol par des disques doux rendus en un seul `InstancedMesh`.
 * Chaque instance peut être orientée selon le vecteur `up` du nœud de nav,
 * ce qui servira aux chemins de gravité sans ajouter de draw call.
 */
import {
  DataTexture,
  InstancedMesh,
  Matrix4,
  MeshBasicMaterial,
  PlaneGeometry,
  Quaternion,
  RedFormat,
  Vector3,
  UnsignedByteType,
} from 'three';
import { RENDER } from '@/config';

const DEFAULT_UP = new Vector3(0, 1, 0);
const PLANE_NORMAL = new Vector3(0, 0, 1);

export class BlobShadows {
  readonly mesh: InstancedMesh<PlaneGeometry, MeshBasicMaterial>;

  private readonly matrix = new Matrix4();
  private readonly quaternion = new Quaternion();
  private readonly scale = new Vector3();
  private readonly position = new Vector3();
  private readonly normalizedUp = new Vector3();
  private activeCount = 0;

  constructor(capacity: number) {
    const geometry = new PlaneGeometry(1, 1, 1, 1);
    const material = new MeshBasicMaterial({
      color: 0x1b2230,
      alphaMap: createBlobTexture(),
      transparent: true,
      opacity: RENDER.blobShadow.opacity,
      depthWrite: false,
      depthTest: true,
    });
    material.name = 'BlobShadow';

    this.mesh = new InstancedMesh(geometry, material, capacity);
    this.mesh.name = 'BlobShadows';
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
  }

  get visibleCount(): number {
    return this.activeCount;
  }

  set(index: number, position: Vector3, up: Vector3 = DEFAULT_UP, radius = 0.38): void {
    if (index < 0 || index >= this.mesh.instanceMatrix.count) return;

    this.normalizedUp.copy(up).normalize();
    this.position.copy(position).addScaledVector(this.normalizedUp, RENDER.blobShadow.groundOffset);
    this.quaternion.setFromUnitVectors(PLANE_NORMAL, this.normalizedUp);
    this.scale.setScalar(radius * 2);
    this.matrix.compose(this.position, this.quaternion, this.scale);
    this.mesh.setMatrixAt(index, this.matrix);
    this.activeCount = Math.max(this.activeCount, index + 1);
    this.mesh.count = this.activeCount;
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  clear(): void {
    this.activeCount = 0;
    this.mesh.count = 0;
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  applyOpacity(opacity: number): void {
    this.mesh.material.opacity = opacity;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.mesh.material.alphaMap?.dispose();
    this.mesh.material.dispose();
    this.mesh.removeFromParent();
  }
}

function createBlobTexture(): DataTexture {
  const size = RENDER.blobShadow.textureSize;
  const data = new Uint8Array(size * size);
  const center = (size - 1) * 0.5;

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const dx = (x - center) / center;
      const dy = (y - center) / center;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const alpha = Math.max(0, 1 - smoothstep(0.12, 1, distance));
      data[y * size + x] = Math.round(alpha * 255);
    }
  }

  const texture = new DataTexture(data, size, size, RedFormat, UnsignedByteType);
  texture.name = 'BlobShadowAlpha';
  texture.needsUpdate = true;
  return texture;
}

function smoothstep(edge0: number, edge1: number, value: number): number {
  const t = Math.min(1, Math.max(0, (value - edge0) / Math.max(edge1 - edge0, 0.0001)));
  return t * t * (3 - 2 * t);
}
