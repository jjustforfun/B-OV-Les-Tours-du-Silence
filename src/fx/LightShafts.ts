/**
 * LightShafts.ts — rais de lumière traversant la brume.
 *
 * Le geste artistique signature des moments de grâce : quand un chapitre se
 * résout, la lumière trouve un passage entre les tours. Des cônes additifs à
 * dégradé vertical — pas de volumétrique, intenable à 60 fps sur mobile
 * milieu de gamme. Un rais n'existe que là où la lumière traverse vraiment
 * une meurtrière : l'API `addShaft()` est appelée par le constructeur du
 * niveau, jamais par hasard.
 *
 * Désactivé en qualité basse ; immobile en mouvement réduit.
 */
import { Color, ConeGeometry, Group, Mesh, Quaternion, ShaderMaterial, Vector3 } from 'three';
import { FX } from '@/config';
import { ambientDriftEnabled, motionDurationScale } from '@core/motion';

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
  uniform float uShimmer;

  void main() {
    // Dégradé vertical : plein en haut, dissous en bas.
    float vertical = smoothstep(0.05, 0.45, vUv.y) * (1.0 - smoothstep(0.55, 1.0, vUv.y));
    // Bords latéraux fondus : le rais n'a pas de couture.
    float lateral = smoothstep(0.0, 0.28, vUv.x) * (1.0 - smoothstep(0.72, 1.0, vUv.x));
    float shimmer = 1.0 + uShimmer * 0.12 * sin(uTime * 0.7 + vUv.y * 6.0);
    float alpha = vertical * lateral * uOpacity * shimmer;
    gl_FragColor = vec4(uColor, alpha);
  }
`;

export interface LightShaftOptions {
  readonly color?: number;
  readonly intensity?: number;
  readonly maxCount?: number;
}

interface ShaftEntry {
  readonly mesh: Mesh<ConeGeometry, ShaderMaterial>;
  readonly geometry: ConeGeometry;
}

/** Volume d'un rais (déb. → fin + évasement), pour la poussière qui flotte. */
export interface ShaftVolume {
  readonly fromX: number;
  readonly fromY: number;
  readonly fromZ: number;
  readonly toX: number;
  readonly toY: number;
  readonly toZ: number;
  readonly radius: number;
}

const UP_TARGET = new Vector3(0, 1, 0);
const DIRECTION = new Vector3();
const DIRECTION_NORMALIZED = new Vector3();
const MIDPOINT = new Vector3();
const ORIENTATION = new Quaternion();

export class LightShafts {
  readonly root = new Group();

  private readonly entries: ShaftEntry[] = [];
  private readonly volumes: ShaftVolume[] = [];
  private readonly maxCount: number;
  private readonly intensity: number;
  private readonly color: Color;
  private revealElapsed = 0;
  private revealDuration = 0;
  private qualityVisible = true;

  constructor(options: LightShaftOptions = {}) {
    this.root.name = 'LightShafts';
    this.maxCount = options.maxCount ?? FX.shafts.maxCount;
    this.intensity = options.intensity ?? 0.6;
    this.color = new Color(options.color ?? 0xffe9c4);
  }

  get shaftCount(): number {
    return this.entries.length;
  }

  /** Volumes des rais visibles — la poussière flotte dedans. */
  volumesOf(): readonly ShaftVolume[] {
    return this.volumes;
  }

  /**
   * Fait naître un rais entre deux points — uniquement là où un rayon
   * traverse une meurtrière. `radius` = évasement au sol.
   */
  addShaft(from: Vector3, to: Vector3, radius = 0.8): void {
    if (this.entries.length >= this.maxCount) return;

    DIRECTION.copy(to).sub(from);
    const length = DIRECTION.length();
    if (length < 0.01) return;

    // Cône ouvert : pointe en haut (source), évasé vers le bas (au sol).
    const geometry = new ConeGeometry(radius, length, 12, 1, true);
    const material = new ShaderMaterial({
      vertexShader: VERTEX_SHADER,
      fragmentShader: FRAGMENT_SHADER,
      uniforms: {
        uColor: { value: this.color },
        uOpacity: { value: 0 },
        uTime: { value: 0 },
        uShimmer: { value: ambientDriftEnabled() ? 1 : 0 },
      },
      transparent: true,
      depthWrite: false,
    });

    const mesh = new Mesh(geometry, material);
    mesh.name = `LightShaft${this.entries.length}`;
    MIDPOINT.copy(from).add(to).multiplyScalar(0.5);
    mesh.position.copy(MIDPOINT);
    ORIENTATION.setFromUnitVectors(UP_TARGET, DIRECTION_NORMALIZED.copy(DIRECTION).normalize());
    mesh.quaternion.copy(ORIENTATION);
    mesh.visible = this.qualityVisible && this.revealDuration > 0;
    this.root.add(mesh);
    this.entries.push({ mesh, geometry });
    this.volumes.push({
      fromX: from.x,
      fromY: from.y,
      fromZ: from.z,
      toX: to.x,
      toY: to.y,
      toZ: to.z,
      radius,
    });
  }

  /** Fait naître les rais progressivement (résolution d'un niveau). */
  reveal(durationSeconds = 2.5): void {
    this.revealDuration = Math.max(0.05, durationSeconds * motionDurationScale());
    this.revealElapsed = 0;
    this.updateVisibility();
  }

  /** Qualité basse : les rais disparaissent, ils coûtent du fillrate. */
  setVisible(visible: boolean): void {
    this.qualityVisible = visible;
    this.updateVisibility();
  }

  update(delta: number, elapsed: number): void {
    if (this.entries.length === 0) return;
    if (this.revealDuration > 0 && this.revealElapsed < this.revealDuration) {
      this.revealElapsed = Math.min(this.revealDuration, this.revealElapsed + delta);
    }

    const t = this.revealDuration <= 0 ? 1 : Math.min(1, this.revealElapsed / this.revealDuration);
    const eased = t * t * (3 - 2 * t);
    const opacity = eased * this.intensity;
    const shimmer = ambientDriftEnabled() ? 1 : 0;

    for (const entry of this.entries) {
      const timeUniform = entry.mesh.material.uniforms.uTime;
      if (timeUniform) timeUniform.value = elapsed;
      const opacityUniform = entry.mesh.material.uniforms.uOpacity;
      if (opacityUniform) opacityUniform.value = opacity;
      const shimmerUniform = entry.mesh.material.uniforms.uShimmer;
      if (shimmerUniform) shimmerUniform.value = shimmer;
    }
  }

  dispose(): void {
    for (const entry of this.entries) {
      entry.geometry.dispose();
      entry.mesh.material.dispose();
    }
    this.entries.length = 0;
    this.volumes.length = 0;
    this.root.removeFromParent();
    this.root.clear();
  }

  private updateVisibility(): void {
    const revealed = this.revealDuration > 0;
    for (const entry of this.entries) {
      entry.mesh.visible = this.qualityVisible && revealed;
    }
  }
}
