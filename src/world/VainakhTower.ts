/**
 * VainakhTower.ts — générateur procédural d'une tour vainakh intacte.
 *
 * Le canon visuel vient de `docs/ART_DIRECTION.md` : base carrée, cinq
 * niveaux, fruit d'environ 8 % par niveau, entrée au premier étage,
 * ouvertures étroites, encorbellements et toit pyramidal à cinq gradins.
 * Tous les éléments répétés sont instanciés pour tenir le budget mobile.
 */
import {
  BoxGeometry,
  ConeGeometry,
  CylinderGeometry,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  Vector3,
  type BufferGeometry,
  type Material,
} from 'three';
import { EMBER, type ChapterPalette } from '@render/Palettes';
import {
  bakeToonStoneGeometry,
  createToonStoneMaterial,
} from '@render/materials/ToonStoneMaterial';

const LEVEL_COUNT = 5;
const FRUIT_PER_LEVEL = 0.08;
const ROOF_STEP_COUNT = 5;
const CORBELS_PER_FACE = 5;
const matrix = new Matrix4();
const scale = new Vector3();

export interface VainakhTowerOptions {
  readonly width: number;
  readonly height: number;
  readonly depth: number;
  readonly palette: ChapterPalette;
}

export class VainakhTower {
  readonly root = new Group();

  constructor(options: VainakhTowerOptions) {
    this.root.name = 'VainakhTower';
    this.root.userData.levelTower = true;
    this.build(options);
  }

  private build(options: VainakhTowerOptions): void {
    const wall = this.material(options.palette.stoneLight, 0.1);
    const shadow = this.material(options.palette.stoneShadow, 0.08);
    const accent = this.material(EMBER, 0.12, EMBER, 0.28);
    const levelHeight = options.height / LEVEL_COUNT;
    const bottom = -options.height / 2;

    this.buildLevels(options, levelHeight, bottom, wall);
    this.buildCourses(options, levelHeight, bottom, shadow);
    this.buildOpenings(options, levelHeight, bottom, shadow);
    this.buildEntrance(options, levelHeight, bottom, shadow, accent);
    this.buildCorbels(options, levelHeight, bottom, wall);
    this.buildRoof(options, wall, accent);
  }

  private buildLevels(
    options: VainakhTowerOptions,
    levelHeight: number,
    bottom: number,
    material: Material,
  ): void {
    const geometry = this.boxGeometry(0.055);
    const levels = new InstancedMesh(geometry, material, LEVEL_COUNT);
    levels.name = 'TowerLevels';
    levels.castShadow = true;
    levels.receiveShadow = true;

    for (let level = 0; level < LEVEL_COUNT; level += 1) {
      const taper = 1 - level * FRUIT_PER_LEVEL;
      matrix.makeScale(options.width * taper, levelHeight, options.depth * taper);
      matrix.setPosition(0, bottom + levelHeight * (level + 0.5), 0);
      levels.setMatrixAt(level, matrix);
    }
    levels.instanceMatrix.needsUpdate = true;
    this.root.add(levels);
  }

  /** Assises en léger retrait : l'échelle de pierre reste lisible sans texture. */
  private buildCourses(
    options: VainakhTowerOptions,
    levelHeight: number,
    bottom: number,
    material: Material,
  ): void {
    const count = (LEVEL_COUNT - 1) * 4;
    const courses = new InstancedMesh(this.boxGeometry(0.025), material, count);
    courses.name = 'TowerDryStoneCourses';
    let index = 0;
    for (let level = 1; level < LEVEL_COUNT; level += 1) {
      const taper = 1 - level * FRUIT_PER_LEVEL;
      const width = options.width * taper;
      const depth = options.depth * taper;
      const y = bottom + levelHeight * level;
      index = this.setFaceBars(courses, index, width, depth, y, 0.045, 0.035);
    }
    courses.instanceMatrix.needsUpdate = true;
    this.root.add(courses);
  }

  private buildOpenings(
    options: VainakhTowerOptions,
    levelHeight: number,
    bottom: number,
    material: Material,
  ): void {
    const openings = new InstancedMesh(this.boxGeometry(0), material, 8);
    openings.name = 'TowerSlitWindows';
    let index = 0;
    for (let level = 1; level < LEVEL_COUNT; level += 1) {
      const taper = 1 - level * FRUIT_PER_LEVEL;
      const width = options.width * taper;
      const depth = options.depth * taper;
      const y = bottom + levelHeight * (level + 0.62);
      const offset = level % 2 === 0 ? -0.22 : 0.18;

      matrix.makeScale(0.2, 0.68, 0.055);
      matrix.setPosition(width * offset, y, depth * 0.502);
      openings.setMatrixAt(index, matrix);
      index += 1;

      matrix.makeScale(0.055, 0.68, 0.2);
      matrix.setPosition(width * 0.502, y - levelHeight * 0.16, -depth * offset);
      openings.setMatrixAt(index, matrix);
      index += 1;
    }
    openings.instanceMatrix.needsUpdate = true;
    this.root.add(openings);
  }

  private buildEntrance(
    options: VainakhTowerOptions,
    levelHeight: number,
    bottom: number,
    shadow: Material,
    accent: Material,
  ): void {
    const entranceY = bottom + levelHeight;
    const door = new Mesh(this.baked(new BoxGeometry(0.86, 1.55, 0.08), 0.015), shadow);
    door.name = 'TowerRaisedEntrance';
    door.position.set(0, entranceY + 0.68, options.depth * 0.501);
    this.root.add(door);

    const lintel = new Mesh(this.baked(new BoxGeometry(1.08, 0.12, 0.12), 0.015), accent);
    lintel.name = 'TowerEntranceLintel';
    lintel.position.set(0, entranceY + 1.5, options.depth * 0.515);
    this.root.add(lintel);
  }

  private buildCorbels(
    options: VainakhTowerOptions,
    levelHeight: number,
    bottom: number,
    material: Material,
  ): void {
    const count = CORBELS_PER_FACE * 4;
    const corbels = new InstancedMesh(this.boxGeometry(0.035), material, count);
    corbels.name = 'TowerCorbels';
    const taper = 1 - (LEVEL_COUNT - 1) * FRUIT_PER_LEVEL;
    const width = options.width * taper;
    const depth = options.depth * taper;
    const y = bottom + levelHeight * LEVEL_COUNT + 0.08;
    let index = 0;

    for (let slot = 0; slot < CORBELS_PER_FACE; slot += 1) {
      const t = slot / (CORBELS_PER_FACE - 1) - 0.5;
      matrix.makeScale(0.24, 0.28, 0.42);
      matrix.setPosition(t * width * 0.86, y, depth * 0.55);
      corbels.setMatrixAt(index, matrix);
      index += 1;
      matrix.setPosition(t * width * 0.86, y, -depth * 0.55);
      corbels.setMatrixAt(index, matrix);
      index += 1;

      matrix.makeScale(0.42, 0.28, 0.24);
      matrix.setPosition(width * 0.55, y, t * depth * 0.86);
      corbels.setMatrixAt(index, matrix);
      index += 1;
      matrix.setPosition(-width * 0.55, y, t * depth * 0.86);
      corbels.setMatrixAt(index, matrix);
      index += 1;
    }
    corbels.instanceMatrix.needsUpdate = true;
    this.root.add(corbels);
  }

  private buildRoof(options: VainakhTowerOptions, material: Material, accent: Material): void {
    const baseRadius = Math.min(options.width, options.depth) * 0.48;
    const stepHeight = Math.max(0.26, options.height * 0.018);
    const roof = new InstancedMesh(
      this.baked(new CylinderGeometry(0.82, 1, 1, 4, 1), 0.04),
      material,
      ROOF_STEP_COUNT,
    );
    roof.name = 'TowerSteppedRoof';
    roof.castShadow = true;
    for (let step = 0; step < ROOF_STEP_COUNT; step += 1) {
      const radius = baseRadius * (1 - step * 0.14);
      matrix.makeRotationY(Math.PI * 0.25);
      scale.set(radius, stepHeight, radius);
      matrix.scale(scale);
      matrix.setPosition(0, options.height / 2 + stepHeight * (step + 0.55), 0);
      roof.setMatrixAt(step, matrix);
    }
    roof.instanceMatrix.needsUpdate = true;
    this.root.add(roof);

    const cap = new Mesh(this.baked(new ConeGeometry(0.22, 0.62, 7), 0.025), accent);
    cap.name = 'TowerCapstone';
    cap.position.y = options.height / 2 + stepHeight * (ROOF_STEP_COUNT + 1.1);
    cap.castShadow = true;
    this.root.add(cap);
  }

  private setFaceBars(
    mesh: InstancedMesh,
    start: number,
    width: number,
    depth: number,
    y: number,
    thickness: number,
    projection: number,
  ): number {
    let index = start;
    matrix.makeScale(width + projection, thickness, 0.06);
    matrix.setPosition(0, y, depth * 0.502);
    mesh.setMatrixAt(index, matrix);
    index += 1;
    matrix.setPosition(0, y, -depth * 0.502);
    mesh.setMatrixAt(index, matrix);
    index += 1;
    matrix.makeScale(0.06, thickness, depth + projection);
    matrix.setPosition(width * 0.502, y, 0);
    mesh.setMatrixAt(index, matrix);
    index += 1;
    matrix.setPosition(-width * 0.502, y, 0);
    mesh.setMatrixAt(index, matrix);
    return index + 1;
  }

  private boxGeometry(valueJitter: number): BufferGeometry {
    return this.baked(new BoxGeometry(1, 1, 1), valueJitter);
  }

  private baked(geometry: BufferGeometry, valueJitter: number): BufferGeometry {
    return bakeToonStoneGeometry(geometry, {
      color: 0xffffff,
      valueJitter,
      aoStrength: 0.64,
    });
  }

  private material(
    color: number,
    rimStrength: number,
    emissive?: number,
    emissiveIntensity = 0,
  ): Material {
    return createToonStoneMaterial(
      emissive === undefined
        ? {
            color,
            steps: 3,
            noiseStrength: 0.07,
            rimColor: 0xdce8ff,
            rimStrength,
          }
        : {
            color,
            steps: 3,
            noiseStrength: 0.04,
            rimColor: 0xdce8ff,
            rimStrength,
            emissive,
            emissiveIntensity,
          },
    );
  }
}
