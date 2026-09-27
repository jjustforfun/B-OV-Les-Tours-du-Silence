/**
 * DemoScene.ts — scène vitrine de la phase 1.
 *
 * Une tour vainakh stylisée se dresse sur un piton rocheux au lever du jour :
 * elle sert de banc d'essai au cadrage orthographique, au ToonStoneMaterial,
 * au brouillard de hauteur, aux ombres blob et à la chaîne PostFX. La scène
 * reste procédurale pour ne pas introduire de pipeline d'assets avant les
 * niveaux jouables.
 */
import {
  Box3,
  BoxGeometry,
  ConeGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  PlaneGeometry,
  ShaderMaterial,
  Vector3,
  type BufferGeometry,
  type Material,
} from 'three';
import { RENDER, type QualitySettings } from '@/config';
import { TurpalModel } from '@entities/player/TurpalModel';
import { BlobShadows } from '@render/BlobShadows';
import { CHAPTER_PALETTES, EMBER } from '@render/Palettes';
import {
  bakeToonStoneGeometry,
  createToonStoneMaterial,
} from '@render/materials/ToonStoneMaterial';

interface MistLayer {
  readonly mesh: Mesh<PlaneGeometry, ShaderMaterial>;
  readonly baseX: number;
  readonly speed: number;
}

const UP = new Vector3(0, 1, 0);
const TOWER_BASE_Y = 2.05;

export class DemoScene {
  readonly root = new Group();
  readonly bounds = new Box3();

  private readonly frameRoot = new Group();
  private readonly mistLayers: MistLayer[] = [];
  private readonly blobShadows = new BlobShadows(4);
  private readonly turpal = new TurpalModel();
  private readonly turpalPosition = new Vector3(-1.15, TOWER_BASE_Y + 0.12, 2.65);

  constructor(quality: QualitySettings) {
    this.root.name = 'Phase1DemoScene';
    this.frameRoot.name = 'DemoFrameRoot';
    this.root.add(this.frameRoot);

    this.createRockSpire();
    this.createTower();
    this.createPath();
    this.createTurpal();
    this.createMist();
    this.applyQuality(quality);

    this.bounds.setFromObject(this.frameRoot).expandByScalar(0.9);
  }

  update(elapsed: number, delta: number): void {
    this.turpal.update(delta);
    for (let i = 0; i < this.mistLayers.length; i += 1) {
      const layer = this.mistLayers[i];
      if (!layer) continue;
      layer.mesh.position.x = layer.baseX + Math.sin(elapsed * layer.speed + i * 1.7) * 0.22;
      const timeUniform = layer.mesh.material.uniforms.uTime;
      if (timeUniform) timeUniform.value = elapsed;
    }
  }

  applyQuality(quality: QualitySettings): void {
    for (let i = 0; i < this.mistLayers.length; i += 1) {
      const layer = this.mistLayers[i];
      if (!layer) continue;
      layer.mesh.visible = i < quality.mistLayers;
    }
    this.blobShadows.applyOpacity(RENDER.blobShadow.opacity * Math.max(0.7, quality.particleScale));
  }

  private createRockSpire(): void {
    const dark = this.stoneMaterial(CHAPTER_PALETTES.prologue.stoneShadow, 0.11);
    const mid = this.stoneMaterial(0x667084, 0.12);
    const light = this.stoneMaterial(CHAPTER_PALETTES.prologue.stoneLight, 0.12);

    const layers = [
      { radiusTop: 2.9, radiusBottom: 4.4, height: 1.35, y: 0.35, color: dark, sides: 9 },
      { radiusTop: 2.35, radiusBottom: 3.2, height: 1.15, y: 1.1, color: mid, sides: 8 },
      { radiusTop: 1.9, radiusBottom: 2.55, height: 0.86, y: 1.72, color: light, sides: 7 },
    ] as const;

    for (const layer of layers) {
      const geometry = this.baked(
        new CylinderGeometry(layer.radiusTop, layer.radiusBottom, layer.height, layer.sides, 1),
        CHAPTER_PALETTES.prologue.stoneLight,
        0.11,
      );
      const mesh = new Mesh(geometry, layer.color);
      mesh.name = 'RockSpire';
      mesh.position.y = layer.y;
      mesh.rotation.y = layer.sides * 0.09;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.frameRoot.add(mesh);
    }
  }

  private createTower(): void {
    const wall = this.stoneMaterial(CHAPTER_PALETTES.prologue.stoneLight, 0.085);
    const shadow = this.stoneMaterial(CHAPTER_PALETTES.prologue.stoneShadow, 0.07);
    const ember = this.stoneMaterial(EMBER, 0.02, EMBER, 0.26);
    const levelHeight = 1.58;
    const levels = 5;

    for (let level = 0; level < levels; level += 1) {
      const width = 2.52 * (1 - level * 0.075);
      const depth = 2.36 * (1 - level * 0.075);
      const y = TOWER_BASE_Y + levelHeight * level + levelHeight * 0.5;
      const geometry = this.baked(new BoxGeometry(width, levelHeight, depth), 0xffffff, 0.055);
      const mesh = new Mesh(geometry, wall);
      mesh.name = `VainakhTowerLevel${level}`;
      mesh.position.y = y;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.frameRoot.add(mesh);

      this.addSlitWindow(width * -0.26, y + 0.2, depth * 0.505, 0, level, shadow);
      this.addSlitWindow(width * 0.51, y - 0.08, depth * -0.12, Math.PI / 2, level, shadow);
      if (level === 1) this.addEntrance(width, depth, y - 0.42, shadow, ember);
    }

    this.createCorbels(2.16, 2.02, TOWER_BASE_Y + levelHeight * levels + 0.05, wall);
    this.createRoof(TOWER_BASE_Y + levelHeight * levels + 0.42, wall, ember);
  }

  private createPath(): void {
    const material = this.stoneMaterial(0x7c8396, 0.08);
    for (let i = 0; i < 7; i += 1) {
      const geometry = this.baked(new BoxGeometry(0.64, 0.16, 0.74), 0xffffff, 0.075);
      const step = new Mesh(geometry, material);
      step.name = 'DemoStoneStep';
      step.position.set(-2.6 + i * 0.37, TOWER_BASE_Y - 0.08 + i * 0.02, 3.05 - i * 0.17);
      step.rotation.y = -0.28;
      step.castShadow = true;
      step.receiveShadow = true;
      this.frameRoot.add(step);
    }
  }

  private createTurpal(): void {
    this.turpal.root.name = 'DemoTurpal';
    this.turpal.root.position.copy(this.turpalPosition);
    this.turpal.root.rotation.y = Math.PI * 0.18;
    this.frameRoot.add(this.turpal.root);
    this.frameRoot.add(this.blobShadows.mesh);
    this.blobShadows.set(0, this.turpalPosition, UP, 0.34);
  }

  private createMist(): void {
    const fogColor = CHAPTER_PALETTES.prologue.skyBottom;
    const layers = [
      { y: 0.95, z: -0.8, opacity: 0.13, width: 13, height: 4.2, speed: 0.07 },
      { y: 2.4, z: -1.9, opacity: 0.1, width: 11, height: 3.4, speed: 0.05 },
      { y: 4.1, z: -3.2, opacity: 0.075, width: 9.5, height: 2.8, speed: 0.035 },
    ] as const;

    for (const layer of layers) {
      const material = new ShaderMaterial({
        transparent: true,
        depthWrite: false,
        depthTest: true,
        uniforms: {
          uColor: { value: colorToVector(fogColor) },
          uOpacity: { value: layer.opacity },
          uTime: { value: 0 },
        },
        vertexShader: `varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`,
        fragmentShader: `varying vec2 vUv;
uniform vec3 uColor;
uniform float uOpacity;
uniform float uTime;
float hash(vec2 value) {
  return fract(sin(dot(value, vec2(127.1, 311.7))) * 43758.5453);
}
float noise(vec2 value) {
  vec2 cell = floor(value);
  vec2 local = smoothstep(vec2(0.0), vec2(1.0), fract(value));
  float a = hash(cell);
  float b = hash(cell + vec2(1.0, 0.0));
  float c = hash(cell + vec2(0.0, 1.0));
  float d = hash(cell + vec2(1.0, 1.0));
  return mix(mix(a, b, local.x), mix(c, d, local.x), local.y);
}
void main() {
  float edge = smoothstep(0.0, 0.18, vUv.y) * (1.0 - smoothstep(0.82, 1.0, vUv.y));
  float veil = noise(vec2(vUv.x * 3.2 + uTime * 0.025, vUv.y * 1.4));
  float alpha = edge * mix(0.65, 1.0, veil) * uOpacity;
  gl_FragColor = vec4(uColor, alpha);
}`,
      });
      material.name = 'DemoMistLayer';
      const mesh = new Mesh(new PlaneGeometry(layer.width, layer.height, 1, 1), material);
      mesh.name = 'DemoMistLayer';
      mesh.position.set(0, layer.y, layer.z);
      mesh.rotation.x = -0.18;
      this.root.add(mesh);
      this.mistLayers.push({ mesh, baseX: mesh.position.x, speed: layer.speed });
    }
  }

  private createCorbels(width: number, depth: number, y: number, material: Material): void {
    const positions: (readonly [number, number, number])[] = [];
    for (let i = 0; i < 6; i += 1) {
      const t = (i / 5 - 0.5) * width;
      positions.push([t, y, depth * 0.56], [width * 0.56, y, t]);
    }

    for (const position of positions) {
      const corbel = new Mesh(
        this.baked(new BoxGeometry(0.22, 0.24, 0.34), 0xffffff, 0.04),
        material,
      );
      corbel.name = 'TowerCorbel';
      corbel.position.set(position[0], position[1], position[2]);
      corbel.castShadow = true;
      this.frameRoot.add(corbel);
    }
  }

  private createRoof(y: number, material: Material, ember: Material): void {
    for (let step = 0; step < 5; step += 1) {
      const radius = 1.55 - step * 0.21;
      const roof = new Mesh(
        this.baked(new CylinderGeometry(radius * 0.82, radius, 0.28, 4, 1), 0xffffff, 0.045),
        material,
      );
      roof.name = 'SteppedPyramidRoof';
      roof.position.y = y + step * 0.24;
      roof.rotation.y = Math.PI * 0.25;
      roof.castShadow = true;
      roof.receiveShadow = true;
      this.frameRoot.add(roof);
    }

    const cap = new Mesh(this.baked(new ConeGeometry(0.22, 0.52, 8), 0xffffff, 0.035), ember);
    cap.name = 'TowerCapstone';
    cap.position.y = y + 1.34;
    cap.castShadow = true;
    this.frameRoot.add(cap);
  }

  private addSlitWindow(
    x: number,
    y: number,
    z: number,
    rotationY: number,
    level: number,
    material: Material,
  ): void {
    const window = new Mesh(new BoxGeometry(0.13, 0.58, 0.035), material);
    window.name = 'TowerSlitWindow';
    window.position.set(x, y, z);
    window.rotation.y = rotationY;
    window.scale.y = level % 2 === 0 ? 1 : 0.82;
    this.frameRoot.add(window);
  }

  private addEntrance(
    width: number,
    depth: number,
    y: number,
    shadow: Material,
    ember: Material,
  ): void {
    const door = new Mesh(new BoxGeometry(0.52, 0.92, 0.05), shadow);
    door.name = 'RaisedEntrance';
    door.position.set(-width * 0.18, y, depth * 0.515);
    this.frameRoot.add(door);

    const lintel = new Mesh(this.baked(new BoxGeometry(0.78, 0.12, 0.08), 0xffffff, 0.02), ember);
    lintel.name = 'EmberLintel';
    lintel.position.set(-width * 0.18, y + 0.52, depth * 0.54);
    this.frameRoot.add(lintel);
  }

  private stoneMaterial(
    color: number,
    noiseStrength: number,
    emissive?: number,
    emissiveIntensity = 0,
  ): Material {
    const material = createToonStoneMaterial(
      emissive === undefined
        ? {
            color,
            steps: 3,
            noiseStrength,
            rimColor: 0xdce8ff,
            rimStrength: 0.16,
          }
        : {
            color,
            steps: 3,
            noiseStrength,
            rimColor: 0xdce8ff,
            rimStrength: 0.16,
            emissive,
            emissiveIntensity,
          },
    );
    return material;
  }

  private baked(geometry: BufferGeometry, color: number, valueJitter: number): BufferGeometry {
    return bakeToonStoneGeometry(geometry, { color, valueJitter });
  }
}

function colorToVector(hex: number): Vector3 {
  return new Vector3(((hex >> 16) & 255) / 255, ((hex >> 8) & 255) / 255, (hex & 255) / 255);
}
