/**
 * Mist.ts — la brume des gorges.
 *
 * L'effet le plus important du jeu pour l'ambiance : c'est elle qui donne
 * l'échelle, sépare les plans et fait « respirer » l'image. Une à trois
 * nappes selon la qualité, bruit défilant très lentement (shaders/mist.glsl),
 * **jamais de particules** — 3 draw calls au lieu de 800 (perf: règle § 6).
 *
 * Opacité plafonnée à 0,12, dérive de 0,05 unité/s. En mouvement réduit, la
 * dérive disparaît : la brume tient son rôle de fond sans bouger.
 */
import { Color, Group, Mesh, PlaneGeometry, ShaderMaterial } from 'three';
import { FX } from '@/config';
import { ambientDriftEnabled } from '@core/motion';

const VERTEX_SHADER = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const FRAGMENT_SHADER = /* glsl */ `
  varying vec2 vUv;
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
  }
`;

export interface MistLayerSpec {
  readonly y: number;
  readonly z: number;
  readonly opacity: number;
  readonly width: number;
  readonly height: number;
}

export interface MistOptions {
  /** Nombre de nappes demandées (plafonné par la qualité). */
  readonly layers?: number;
  readonly color?: number;
  readonly specs?: readonly MistLayerSpec[];
}

interface MistLayer {
  readonly mesh: Mesh<PlaneGeometry, ShaderMaterial>;
  readonly baseX: number;
  readonly basePhase: number;
}

/** Nappes par défaut : la plus dense en bas, la plus haute presque dissoute. */
const DEFAULT_SPECS: readonly MistLayerSpec[] = [
  { y: 0.95, z: -0.8, opacity: 0.12, width: FX.mist.size * 0.45, height: 4.2 },
  { y: 2.4, z: -1.9, opacity: 0.1, width: FX.mist.size * 0.38, height: 3.4 },
  { y: 4.1, z: -3.2, opacity: 0.08, width: FX.mist.size * 0.32, height: 2.8 },
];

export class Mist {
  readonly root = new Group();
  readonly layers: readonly MistLayer[];

  private readonly materials: ShaderMaterial[] = [];
  private readonly geometries: PlaneGeometry[] = [];

  constructor(options: MistOptions = {}) {
    this.root.name = 'Mist';
    const color = new Color(options.color ?? 0x8f9bb0);
    const specs = (options.specs ?? DEFAULT_SPECS).map((spec) => ({
      ...spec,
      opacity: Math.min(spec.opacity, FX.mist.maxOpacity),
    }));

    const built: MistLayer[] = [];
    for (let i = 0; i < specs.length; i += 1) {
      const spec = specs[i];
      if (spec === undefined) continue;

      const material = new ShaderMaterial({
        vertexShader: VERTEX_SHADER,
        fragmentShader: FRAGMENT_SHADER,
        uniforms: {
          uColor: { value: color },
          uOpacity: { value: spec.opacity },
          uTime: { value: 0 },
        },
        transparent: true,
        depthWrite: false,
      });
      const geometry = new PlaneGeometry(spec.width, spec.height, 1, 1);
      const mesh = new Mesh(geometry, material);
      mesh.name = `MistLayer${i}`;
      mesh.position.set(0, spec.y, spec.z);
      mesh.rotation.x = -0.18;
      this.root.add(mesh);
      this.materials.push(material);
      this.geometries.push(geometry);
      built.push({ mesh, baseX: 0, basePhase: i * 1.7 });
    }

    this.layers = built;
    this.setVisible(Math.min(options.layers ?? specs.length, specs.length));
  }

  get layerCount(): number {
    return this.layers.length;
  }

  /** Combien de nappes la qualité courante autorise. */
  setVisible(count: number): void {
    for (let i = 0; i < this.layers.length; i += 1) {
      const layer = this.layers[i];
      if (layer === undefined) continue;
      layer.mesh.visible = i < count;
    }
  }

  /** Avance le temps du bruit et la dérive lente des nappes. */
  update(elapsed: number): void {
    for (const layer of this.layers) {
      if (!layer.mesh.visible) continue;
      const timeUniform = layer.mesh.material.uniforms.uTime;
      if (timeUniform) timeUniform.value = elapsed;
      // Dérive de 0,05 u/s, alternative gauche-droite : la brume respire.
      // Mouvement réduit : pas de dérive du tout (docs/CONTROLS.md § 5).
      layer.mesh.position.x = ambientDriftEnabled()
        ? Math.sin(elapsed * 0.05 + layer.basePhase) * (FX.mist.drift * 10)
        : 0;
    }
  }

  dispose(): void {
    for (const geometry of this.geometries) geometry.dispose();
    for (const material of this.materials) material.dispose();
    this.geometries.length = 0;
    this.materials.length = 0;
    this.root.removeFromParent();
    this.root.clear();
  }
}
