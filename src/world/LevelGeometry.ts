/**
 * LevelGeometry.ts — construction du décor depuis les `LevelBlockDef`.
 *
 * Les volumes déclaratifs deviennent une géométrie toon avec couleurs de
 * sommets et AO cuit. Les blocs statiques partagent un `InstancedMesh` par
 * surface ; un volume parenté reste un mesh autonome attaché au mécanisme qui
 * le déplace. Seules les tours utilisent leur générateur canonique.
 */
import {
  BoxGeometry,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  Vector3,
  type BufferGeometry,
  type Material,
} from 'three';
import type { LevelBlockDef, SurfaceKind } from './Level';
import type { Mechanism } from './mechanisms/Mechanism';
import { VainakhTower } from './VainakhTower';
import { CHAPTER_PALETTES, type ChapterPaletteName } from '@render/Palettes';
import {
  bakeToonStoneGeometry,
  createToonStoneMaterial,
} from '@render/materials/ToonStoneMaterial';
import { disposeObject } from '@utils/dispose';

const matrix = new Matrix4();
const worldMatrix = new Matrix4();
const parentInverse = new Matrix4();
const localMatrix = new Matrix4();
const targetPoint = new Vector3();
const scale = new Vector3();
const SURFACES: readonly SurfaceKind[] = ['stone', 'grass', 'snow', 'wood'];

export class LevelGeometry {
  readonly root = new Group();
  readonly towerRoots: Group[] = [];

  private readonly parentedMeshes: Mesh[] = [];
  private readonly parentedTowerRoots: Group[] = [];
  private readonly parentedGeometries: BufferGeometry[] = [];
  private readonly parentedMaterials: Material[] = [];

  constructor(
    blocks: readonly LevelBlockDef[],
    paletteName: ChapterPaletteName,
    mechanisms: ReadonlyMap<string, Mechanism> = new Map(),
  ) {
    this.root.name = 'LevelGeometry';
    this.buildInstancedBlocks(blocks, paletteName);
    this.buildParentedBlocks(blocks, paletteName, mechanisms);

    for (const block of blocks) {
      if (block.kind !== 'tower') continue;
      const tower = new VainakhTower({
        width: block.size[0],
        height: block.size[1],
        depth: block.size[2],
        palette: CHAPTER_PALETTES[block.towerPalette ?? paletteName],
      });
      tower.root.position.set(block.at[0], block.at[1], block.at[2]);
      if (block.rotationY !== undefined) tower.root.rotation.y = degrees(block.rotationY);
      this.towerRoots.push(tower.root);

      const parent = block.parent === undefined ? undefined : mechanisms.get(block.parent);
      if (parent === undefined) {
        this.root.add(tower.root);
        continue;
      }

      const attachmentRoot = parent.geometryRoot ?? parent.root;
      attachmentRoot.updateWorldMatrix(true, false);
      tower.root.updateMatrix();
      worldMatrix.copy(tower.root.matrix);
      parentInverse.copy(attachmentRoot.matrixWorld).invert();
      localMatrix.multiplyMatrices(parentInverse, worldMatrix);
      localMatrix.decompose(tower.root.position, tower.root.quaternion, tower.root.scale);
      attachmentRoot.add(tower.root);
      this.parentedTowerRoots.push(tower.root);
    }
  }

  get estimatedDrawCalls(): number {
    let count = this.parentedMeshes.length;
    const countObject = (object: Group): void => {
      object.traverse((child) => {
        if (child instanceof Mesh || child instanceof InstancedMesh) count += 1;
      });
    };
    countObject(this.root);
    for (const tower of this.parentedTowerRoots) countObject(tower);
    return count;
  }

  get triangleCount(): number {
    let count = 0;
    const countObject = (object: Group): void => {
      object.traverse((child) => {
        if (!(child instanceof Mesh || child instanceof InstancedMesh)) return;
        count += meshTriangles(child);
      });
    };
    countObject(this.root);
    for (const tower of this.parentedTowerRoots) countObject(tower);
    for (const mesh of this.parentedMeshes) count += meshTriangles(mesh);
    return Math.round(count);
  }

  /** Les meshes parentés sortent de `root`; leurs ressources restent possédées ici. */
  disposeParented(): void {
    for (const mesh of this.parentedMeshes) mesh.removeFromParent();
    for (const tower of this.parentedTowerRoots) disposeObject(tower);
    for (const geometry of this.parentedGeometries) geometry.dispose();
    for (const material of this.parentedMaterials) material.dispose();
    this.parentedMeshes.length = 0;
    this.parentedTowerRoots.length = 0;
    this.parentedGeometries.length = 0;
    this.parentedMaterials.length = 0;
  }

  private buildInstancedBlocks(
    blocks: readonly LevelBlockDef[],
    paletteName: ChapterPaletteName,
  ): void {
    for (const surface of SURFACES) {
      const variants = new Map<
        string,
        { readonly color: number | undefined; readonly opacity: number | undefined }
      >();
      for (const block of blocks) {
        if (
          block.kind === 'tower' ||
          block.parent !== undefined ||
          (block.surface ?? 'stone') !== surface
        )
          continue;
        const key = `${block.color ?? 'palette'}:${block.opacity ?? 1}`;
        variants.set(key, { color: block.color, opacity: block.opacity });
      }
      for (const variant of variants.values()) {
        const { color, opacity } = variant;
        const matching = blocks.filter(
          (block) =>
            block.kind !== 'tower' &&
            block.parent === undefined &&
            (block.surface ?? 'stone') === surface &&
            block.color === color &&
            block.opacity === opacity,
        );
        if (matching.length === 0) continue;

        const mesh = new InstancedMesh(
          this.boxGeometry(),
          this.material(surface, paletteName, color, opacity),
          matching.length,
        );
        mesh.name = `LevelBlocks:${surface}${color === undefined ? '' : `:${color.toString(16)}`}`;
        mesh.castShadow = true;
        mesh.receiveShadow = true;

        for (let index = 0; index < matching.length; index += 1) {
          const block = matching[index];
          if (block === undefined) continue;
          composeBlockMatrix(block, matrix);
          mesh.setMatrixAt(index, matrix);
        }
        mesh.instanceMatrix.needsUpdate = true;
        this.root.add(mesh);
      }
    }
  }

  private buildParentedBlocks(
    blocks: readonly LevelBlockDef[],
    paletteName: ChapterPaletteName,
    mechanisms: ReadonlyMap<string, Mechanism>,
  ): void {
    for (const block of blocks) {
      if (block.kind === 'tower' || block.parent === undefined) continue;
      const parent = mechanisms.get(block.parent);
      if (parent === undefined) continue;

      const geometry = this.boxGeometry();
      const material = this.material(
        block.surface ?? 'stone',
        paletteName,
        block.color,
        block.opacity,
      );
      const mesh = new Mesh(geometry, material);
      mesh.name = `LevelBlock:${block.kind}:${block.parent}`;
      mesh.castShadow = true;
      mesh.receiveShadow = true;

      const isStaged =
        block.moveTo !== undefined &&
        block.moveStage !== undefined &&
        parent.bindStagedObject !== undefined;
      const attachmentRoot = isStaged ? parent.root : (parent.geometryRoot ?? parent.root);

      attachmentRoot.updateWorldMatrix(true, false);
      composeBlockMatrix(block, worldMatrix);
      parentInverse.copy(attachmentRoot.matrixWorld).invert();
      localMatrix.multiplyMatrices(parentInverse, worldMatrix);
      localMatrix.decompose(mesh.position, mesh.quaternion, mesh.scale);
      attachmentRoot.add(mesh);

      if (isStaged && block.moveTo !== undefined && block.moveStage !== undefined) {
        targetPoint.set(block.moveTo[0], block.moveTo[1], block.moveTo[2]);
        attachmentRoot.worldToLocal(targetPoint);
        parent.bindStagedObject?.(
          mesh,
          [targetPoint.x, targetPoint.y, targetPoint.z],
          block.moveStage,
        );
      }

      this.parentedMeshes.push(mesh);
      this.parentedGeometries.push(geometry);
      this.parentedMaterials.push(material);
    }
  }

  private boxGeometry(): BufferGeometry {
    return bakeToonStoneGeometry(new BoxGeometry(1, 1, 1), {
      color: 0xffffff,
      valueJitter: 0.07,
      hueJitterDeg: 3,
      aoStrength: 0.68,
    });
  }

  private material(
    surface: SurfaceKind,
    paletteName: ChapterPaletteName,
    colorOverride?: number,
    opacity = 1,
  ): Material {
    const palette = CHAPTER_PALETTES[paletteName];
    const color = colorOverride ?? surfaceColor(surface, palette.stoneLight);
    const material = createToonStoneMaterial({
      color,
      steps: 3,
      noiseStrength: surface === 'stone' ? 0.075 : 0.045,
      rimColor: 0xdce8ff,
      rimStrength: 0.12,
    });
    material.opacity = Math.min(1, Math.max(0, opacity));
    material.transparent = material.opacity < 1;
    material.depthWrite = material.opacity >= 1;
    return material;
  }
}

function composeBlockMatrix(block: LevelBlockDef, out: Matrix4): void {
  out.makeRotationY(degrees(block.rotationY ?? 0));
  scale.set(block.size[0], block.size[1], block.size[2]);
  out.scale(scale);
  out.setPosition(block.at[0], block.at[1], block.at[2]);
}

function meshTriangles(mesh: Mesh | InstancedMesh): number {
  const geometry = mesh.geometry;
  const index = geometry.getIndex();
  const triangles = index ? index.count / 3 : geometry.getAttribute('position').count / 3;
  return triangles * (mesh instanceof InstancedMesh ? mesh.count : 1);
}

function surfaceColor(surface: SurfaceKind, stoneLight: number): number {
  switch (surface) {
    case 'stone':
      return stoneLight;
    case 'grass':
      return 0x526052;
    case 'snow':
      return 0xdce7ed;
    case 'wood':
      return 0x675747;
  }
}

function degrees(value: number): number {
  return (value * Math.PI) / 180;
}
