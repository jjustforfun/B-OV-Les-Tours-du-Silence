/**
 * Particles.ts — pool générique de particules, un seul draw call.
 *
 * Un unique `Points` + `ShaderMaterial` pour tout ce qui scintille dans le
 * jeu : poussière de rotation, traînée dorée, étincelles de célébration,
 * poussière dans les rais. La capacité est fixée à la construction (plafond
 * `FX.particleBudget` × `particleScale` de la qualité) et l'émission recycle
 * les mortes : zéro allocation par image, zéro reallocation GPU.
 *
 * Le calcul se fait sur CPU dans des tableaux typés ; le shader ne fait que
 * tailles, couleurs et fondu par particule — pas de simulation sur GPU, pas
 * de dépendance, et un coût borné par la capacité.
 *
 * `prefers-reduced-motion` : les durées de vie sont divisées par deux — le
 * feedback reste, l'agitation non.
 */
import {
  AdditiveBlending,
  BufferGeometry,
  Color,
  Float32BufferAttribute,
  Points,
  ShaderMaterial,
} from 'three';
import { motionDurationScale } from '@core/motion';

export interface ParticlePoolOptions {
  /** Capacité maximale avant `particleScale`. */
  readonly budget: number;
  /** Multiplicateur de qualité (`QualitySettings.particleScale`). */
  readonly particleScale?: number;
}

export interface EmitOptions {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly count: number;
  /** Couleur de départ (hex). */
  readonly color: number;
  /** Couleur d'arrivée — omise : la particule garde sa couleur. */
  readonly colorEnd?: number;
  /** Vitesse initiale moyenne (unités/s). */
  readonly speed: number;
  readonly speedVariance?: number;
  /** Taille de départ (unités monde). */
  readonly size: number;
  /** Taille de fin — omise : taille constante. */
  readonly sizeEnd?: number;
  /** Durée de vie moyenne (s) — avant réduction de mouvement. */
  readonly lifetime: number;
  readonly lifetimeVariance?: number;
  /** Accélération verticale (unités/s²) — négative = retombe. */
  readonly gravity?: number;
  /** Amortissement par seconde (0 = aucune traînée inertelle). */
  readonly drag?: number;
  /** Biais vertical de la vélocité initiale (0..1). */
  readonly upBias?: number;
}

const VERTEX_SHADER = /* glsl */ `
  attribute float aSize;
  attribute float aAlpha;
  attribute vec3 aColor;
  uniform float uPixelScale;
  varying float vAlpha;
  varying vec3 vColor;

  void main() {
    vAlpha = aAlpha;
    vColor = aColor;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = max(1.0, aSize * uPixelScale);
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const FRAGMENT_SHADER = /* glsl */ `
  varying float vAlpha;
  varying vec3 vColor;

  void main() {
    float d = length(gl_PointCoord - vec2(0.5));
    float falloff = smoothstep(0.5, 0.08, d);
    float alpha = vAlpha * falloff;
    if (alpha < 0.004) discard;
    gl_FragColor = vec4(vColor, alpha);
  }
`;

const START_COLOR = new Color();
const END_COLOR = new Color();

export class ParticlePool {
  readonly points: Points;

  private readonly capacity: number;
  private alive = 0;

  private readonly positions: Float32Array;
  private readonly velocities: Float32Array;
  private readonly life: Float32Array;
  private readonly maxLife: Float32Array;
  private readonly sizeStart: Float32Array;
  private readonly sizeEnd: Float32Array;
  private readonly colorStart: Float32Array;
  private readonly colorEnd: Float32Array;
  private readonly gravity: Float32Array;
  private readonly drag: Float32Array;

  private readonly sizeAttribute: Float32BufferAttribute;
  private readonly alphaAttribute: Float32BufferAttribute;
  private readonly colorAttribute: Float32BufferAttribute;
  private readonly material: ShaderMaterial;
  private readonly durationScale: number;

  constructor(options: ParticlePoolOptions) {
    this.capacity = Math.max(8, Math.floor(options.budget * (options.particleScale ?? 1)));
    this.durationScale = motionDurationScale();

    this.positions = new Float32Array(this.capacity * 3);
    this.velocities = new Float32Array(this.capacity * 3);
    this.life = new Float32Array(this.capacity);
    this.maxLife = new Float32Array(this.capacity);
    this.sizeStart = new Float32Array(this.capacity);
    this.sizeEnd = new Float32Array(this.capacity);
    this.colorStart = new Float32Array(this.capacity * 3);
    this.colorEnd = new Float32Array(this.capacity * 3);
    this.gravity = new Float32Array(this.capacity);
    this.drag = new Float32Array(this.capacity);

    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new Float32BufferAttribute(this.positions, 3));
    this.sizeAttribute = new Float32BufferAttribute(new Float32Array(this.capacity), 1);
    this.alphaAttribute = new Float32BufferAttribute(new Float32Array(this.capacity), 1);
    this.colorAttribute = new Float32BufferAttribute(new Float32Array(this.capacity * 3), 3);
    geometry.setAttribute('aSize', this.sizeAttribute);
    geometry.setAttribute('aAlpha', this.alphaAttribute);
    geometry.setAttribute('aColor', this.colorAttribute);

    this.material = new ShaderMaterial({
      vertexShader: VERTEX_SHADER,
      fragmentShader: FRAGMENT_SHADER,
      uniforms: { uPixelScale: { value: 60 } },
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
    });

    this.points = new Points(geometry, this.material);
    this.points.frustumCulled = false;
    this.points.name = 'ParticlePool';
  }

  get aliveCount(): number {
    return this.alive;
  }

  get maxCapacity(): number {
    return this.capacity;
  }

  /** Échelle monde→pixels pour la taille des points (caméra orthographique). */
  setPixelScale(pixelsPerWorldUnit: number): void {
    const uniform = this.material.uniforms.uPixelScale;
    if (uniform) uniform.value = pixelsPerWorldUnit;
  }

  /**
   * Émet une salve. L'objet d'options peut être réutilisé par l'appelant
   * (la traînée dorée émet à chaque image sans allouer).
   */
  emit(options: EmitOptions): void {
    const count = Math.max(1, Math.floor(options.count));
    const speedVariance = options.speedVariance ?? options.speed * 0.5;
    const lifetimeVariance = options.lifetimeVariance ?? options.lifetime * 0.25;
    const upBias = options.upBias ?? 0;
    const gravity = options.gravity ?? 0;
    const drag = options.drag ?? 0;

    START_COLOR.setHex(options.color);
    END_COLOR.setHex(options.colorEnd ?? options.color);

    for (let n = 0; n < count; n += 1) {
      if (this.alive >= this.capacity) return;
      const i = this.alive;
      this.alive += 1;

      const i3 = i * 3;
      this.positions[i3] = options.x;
      this.positions[i3 + 1] = options.y;
      this.positions[i3 + 2] = options.z;

      // Direction aléatoire sur la sphère, biaisée vers le haut si demandé.
      const theta = Math.random() * Math.PI * 2;
      const z = Math.random() * 2 - 1;
      const r = Math.sqrt(Math.max(0, 1 - z * z));
      const speed = Math.max(0, options.speed + (Math.random() * 2 - 1) * speedVariance);
      this.velocities[i3] = r * Math.cos(theta) * speed;
      this.velocities[i3 + 1] = (z * 0.5 + 0.5 + upBias) * speed;
      this.velocities[i3 + 2] = r * Math.sin(theta) * speed;

      const lifetime = Math.max(
        0.05,
        (options.lifetime + (Math.random() * 2 - 1) * lifetimeVariance) * this.durationScale,
      );
      this.life[i] = 0;
      this.maxLife[i] = lifetime;
      this.sizeStart[i] = options.size;
      this.sizeEnd[i] = options.sizeEnd ?? options.size;
      this.colorStart[i3] = START_COLOR.r;
      this.colorStart[i3 + 1] = START_COLOR.g;
      this.colorStart[i3 + 2] = START_COLOR.b;
      this.colorEnd[i3] = END_COLOR.r;
      this.colorEnd[i3 + 1] = END_COLOR.g;
      this.colorEnd[i3 + 2] = END_COLOR.b;
      this.gravity[i] = gravity;
      this.drag[i] = drag;
    }
  }

  /** Avance la simulation. Aucune allocation. */
  update(delta: number): void {
    const damping = (index: number): number => {
      const d = this.drag[index] ?? 0;
      return d <= 0 ? 1 : Math.max(0, 1 - d * delta);
    };

    for (let i = 0; i < this.alive; i += 1) {
      const i3 = i * 3;
      const life = (this.life[i] ?? 0) + delta;
      const maxLife = this.maxLife[i] ?? 1;

      if (life >= maxLife) {
        this.kill(i);
        i -= 1;
        continue;
      }
      this.life[i] = life;

      const damp = damping(i);
      this.velocities[i3] = (this.velocities[i3] ?? 0) * damp;
      this.velocities[i3 + 1] =
        (this.velocities[i3 + 1] ?? 0) * damp + (this.gravity[i] ?? 0) * delta;
      this.velocities[i3 + 2] = (this.velocities[i3 + 2] ?? 0) * damp;

      this.positions[i3] = (this.positions[i3] ?? 0) + (this.velocities[i3] ?? 0) * delta;
      this.positions[i3 + 1] =
        (this.positions[i3 + 1] ?? 0) + (this.velocities[i3 + 1] ?? 0) * delta;
      this.positions[i3 + 2] =
        (this.positions[i3 + 2] ?? 0) + (this.velocities[i3 + 2] ?? 0) * delta;

      const t = life / maxLife;
      const eased = t * t * (3 - 2 * t);
      this.sizeAttribute.array[i] =
        (this.sizeStart[i] ?? 0) + ((this.sizeEnd[i] ?? 0) - (this.sizeStart[i] ?? 0)) * eased;
      // Fondu : pleine intensité bref, puis extinction douce.
      this.alphaAttribute.array[i] = Math.min(1, (1 - t) * 1.6) ** 1.5;
      this.colorAttribute.array[i3] =
        (this.colorStart[i3] ?? 0) +
        ((this.colorEnd[i3] ?? 0) - (this.colorStart[i3] ?? 0)) * eased;
      this.colorAttribute.array[i3 + 1] =
        (this.colorStart[i3 + 1] ?? 0) +
        ((this.colorEnd[i3 + 1] ?? 0) - (this.colorStart[i3 + 1] ?? 0)) * eased;
      this.colorAttribute.array[i3 + 2] =
        (this.colorStart[i3 + 2] ?? 0) +
        ((this.colorEnd[i3 + 2] ?? 0) - (this.colorStart[i3 + 2] ?? 0)) * eased;
    }

    this.commit();
  }

  dispose(): void {
    this.alive = 0;
    this.points.geometry.dispose();
    this.material.dispose();
    this.points.removeFromParent();
  }

  /** Échange la particule morte avec la dernière vivante (compactage). */
  private kill(index: number): void {
    const last = this.alive - 1;
    this.alive = last;
    if (index === last) return;
    const a = index;
    const b = last;

    for (let k = 0; k < 3; k += 1) {
      this.positions[a * 3 + k] = this.positions[b * 3 + k] ?? 0;
      this.velocities[a * 3 + k] = this.velocities[b * 3 + k] ?? 0;
      this.colorStart[a * 3 + k] = this.colorStart[b * 3 + k] ?? 0;
      this.colorEnd[a * 3 + k] = this.colorEnd[b * 3 + k] ?? 0;
      this.colorAttribute.array[a * 3 + k] = this.colorAttribute.array[b * 3 + k] ?? 0;
    }
    this.life[a] = this.life[b] ?? 0;
    this.maxLife[a] = this.maxLife[b] ?? 0;
    this.sizeStart[a] = this.sizeStart[b] ?? 0;
    this.sizeEnd[a] = this.sizeEnd[b] ?? 0;
    this.gravity[a] = this.gravity[b] ?? 0;
    this.drag[a] = this.drag[b] ?? 0;
    this.sizeAttribute.array[a] = this.sizeAttribute.array[b] ?? 0;
    this.alphaAttribute.array[a] = this.alphaAttribute.array[b] ?? 0;
  }

  private commit(): void {
    const geometry = this.points.geometry;
    (geometry.getAttribute('position') as Float32BufferAttribute).needsUpdate = true;
    this.sizeAttribute.needsUpdate = true;
    this.alphaAttribute.needsUpdate = true;
    this.colorAttribute.needsUpdate = true;
    // Les particules mortes (au-delà de `alive`) gardent alpha 0 : le
    // compactage garantit que les vivantes occupent [0, alive).
    for (let i = this.alive; i < this.capacity; i += 1) {
      this.alphaAttribute.array[i] = 0;
    }
    geometry.setDrawRange(0, this.alive);
  }
}
