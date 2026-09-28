/**
 * Snow.ts — la neige des cimes.
 *
 * Un seul `Points` (un draw call), recyclage par le haut plutôt que
 * reallocation : chaque flocon qui passe sous le plancher remonte en haut du
 * volume. 140 flocons en qualité basse, 400 en haute (`FX.snow` ×
 * `particleScale`). La neige ne tombe pas droit : elle hésite, dérive — sauf
 * en mouvement réduit, où la dérive disparaît (confort vestibulaire).
 */
import { BufferGeometry, Color, Float32BufferAttribute, Points, ShaderMaterial } from 'three';
import { FX } from '@/config';
import { ambientDriftEnabled, motionDurationScale } from '@core/motion';

const VERTEX_SHADER = /* glsl */ `
  attribute float aPhase;
  attribute float aSize;
  varying float vAlpha;
  void main() {
    vAlpha = 0.85;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize;
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const FRAGMENT_SHADER = /* glsl */ `
  uniform vec3 uColor;
  varying float vAlpha;
  void main() {
    float d = length(gl_PointCoord - vec2(0.5));
    float falloff = smoothstep(0.5, 0.1, d);
    float alpha = vAlpha * falloff;
    if (alpha < 0.01) discard;
    gl_FragColor = vec4(uColor, alpha);
  }
`;

export interface SnowOptions {
  /** Dimensions du volume de neige [largeur, hauteur, profondeur]. */
  readonly bounds?: readonly [number, number, number];
  readonly pixelSize?: number;
  readonly color?: number;
}

export class Snow {
  readonly points: Points;

  private readonly count: number;
  private readonly positions: Float32Array;
  private readonly phases: Float32Array;
  private readonly sizes: Float32Array;
  private readonly boundsX: number;
  private readonly boundsY: number;
  private readonly boundsZ: number;
  private readonly swayAmplitude: number;
  private readonly swaySpeed: number;
  private readonly material: ShaderMaterial;

  constructor(options: SnowOptions = {}, particleScale = 1) {
    const min = FX.snow.minFlakes;
    const max = FX.snow.maxFlakes;
    const scaled = Math.round(min + (max - min) * Math.min(1, particleScale));
    this.count = Math.max(20, scaled);
    this.boundsX = options.bounds?.[0] ?? 26;
    this.boundsY = options.bounds?.[1] ?? 16;
    this.boundsZ = options.bounds?.[2] ?? 26;
    this.swayAmplitude = FX.snow.swayAmplitude;
    this.swaySpeed = FX.snow.swaySpeed;

    this.positions = new Float32Array(this.count * 3);
    this.phases = new Float32Array(this.count);
    this.sizes = new Float32Array(this.count);
    const pixelSize = options.pixelSize ?? 3.2;
    for (let i = 0; i < this.count; i += 1) {
      this.positions[i * 3] = (Math.random() - 0.5) * this.boundsX;
      this.positions[i * 3 + 1] = Math.random() * this.boundsY;
      this.positions[i * 3 + 2] = (Math.random() - 0.5) * this.boundsZ;
      this.phases[i] = Math.random() * Math.PI * 2;
      this.sizes[i] = pixelSize * (0.6 + Math.random() * 0.8);
    }

    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new Float32BufferAttribute(this.positions, 3));
    geometry.setAttribute('aPhase', new Float32BufferAttribute(this.phases, 1));
    geometry.setAttribute('aSize', new Float32BufferAttribute(this.sizes, 1));

    this.material = new ShaderMaterial({
      vertexShader: VERTEX_SHADER,
      fragmentShader: FRAGMENT_SHADER,
      uniforms: { uColor: { value: new Color(options.color ?? 0xeef4ff) } },
      transparent: true,
      depthWrite: false,
    });

    this.points = new Points(geometry, this.material);
    this.points.frustumCulled = false;
    this.points.name = 'Snow';
  }

  get flakeCount(): number {
    return this.count;
  }

  update(delta: number, elapsed: number): void {
    const halfX = this.boundsX * 0.5;
    const halfZ = this.boundsZ * 0.5;
    const fallSpeed = FX.snow.fallSpeed * motionDurationScale();
    const drift = ambientDriftEnabled();

    for (let i = 0; i < this.count; i += 1) {
      const i3 = i * 3;
      let y = (this.positions[i3 + 1] ?? 0) - fallSpeed * delta;
      let x = this.positions[i3] ?? 0;

      // Dérive : la neige hésite — sauf en mouvement réduit.
      if (drift) {
        const phase = this.phases[i] ?? 0;
        x += Math.sin(elapsed * this.swaySpeed + phase) * this.swayAmplitude * delta * 2;
      }

      if (y < 0) {
        // Recyclage par le haut : jamais de reallocation.
        y = this.boundsY;
        x = (Math.random() - 0.5) * this.boundsX;
        this.positions[i3 + 2] = (Math.random() - 0.5) * this.boundsZ;
      }
      // Maintien dans le volume (le vent latéral ne vide jamais le ciel).
      if (x > halfX) x -= this.boundsX;
      else if (x < -halfX) x += this.boundsX;

      this.positions[i3] = x;
      this.positions[i3 + 1] = y;
      const z = this.positions[i3 + 2] ?? 0;
      if (z > halfZ) this.positions[i3 + 2] = z - this.boundsZ;
      else if (z < -halfZ) this.positions[i3 + 2] = z + this.boundsZ;
    }

    (this.points.geometry.getAttribute('position') as Float32BufferAttribute).needsUpdate = true;
  }

  dispose(): void {
    this.points.geometry.dispose();
    this.material.dispose();
    this.points.removeFromParent();
  }
}
