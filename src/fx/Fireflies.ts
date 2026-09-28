/**
 * Fireflies.ts — lucioles du crépuscule.
 *
 * Récompense de curiosité des chapitres 4 (« La Patience ») et 7 (« Le Chant
 * revenu ») uniquement : elles se rassemblent près des endroits que le joueur
 * n'a pas encore explorés — un indice qui ne dit jamais son nom.
 *
 * Chaque luciole a sa phase propre : les pulsations sont désynchronisées,
 * aucune ne clignote en chœur. En mouvement réduit, elles restent en place
 * et leur pulsation ralentit de moitié — la lumière vit encore, sans errance.
 */
import { BufferGeometry, Color, Float32BufferAttribute, Points, ShaderMaterial } from 'three';
import { FX } from '@/config';
import { ambientDriftEnabled, motionDurationScale } from '@core/motion';

const VERTEX_SHADER = /* glsl */ `
  attribute float aPhase;
  attribute float aSize;
  varying float vGlow;
  uniform float uTime;
  void main() {
    // Pulsation désynchronisée : chaque luciole respire à son rythme.
    vGlow = 0.25 + 0.75 * pow(max(0.0, sin(uTime * 1.4 + aPhase)), 3.0);
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * (0.8 + vGlow * 0.5);
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const FRAGMENT_SHADER = /* glsl */ `
  uniform vec3 uColor;
  varying float vGlow;
  void main() {
    float d = length(gl_PointCoord - vec2(0.5));
    float core = smoothstep(0.5, 0.0, d);
    float alpha = vGlow * core;
    if (alpha < 0.01) discard;
    gl_FragColor = vec4(uColor * (0.7 + vGlow * 0.5), alpha);
  }
`;

export interface FirefliesOptions {
  /** Volume d'errance [largeur, hauteur, profondeur]. */
  readonly bounds?: readonly [number, number, number];
  readonly color?: number;
  readonly pixelSize?: number;
}

export class Fireflies {
  readonly points: Points;

  private readonly count: number;
  private readonly anchors: Float32Array;
  private readonly positions: Float32Array;
  private readonly phases: Float32Array;
  private readonly sizes: Float32Array;
  private readonly material: ShaderMaterial;

  constructor(options: FirefliesOptions = {}, particleScale = 1) {
    this.count = Math.max(6, Math.round(FX.fireflies.count * Math.min(1, particleScale)));
    const boundsX = options.bounds?.[0] ?? 10;
    const boundsY = options.bounds?.[1] ?? 4;
    const boundsZ = options.bounds?.[2] ?? 10;
    this.anchors = new Float32Array(this.count * 3);
    this.positions = new Float32Array(this.count * 3);
    this.phases = new Float32Array(this.count);
    this.sizes = new Float32Array(this.count);
    const pixelSize = options.pixelSize ?? 5;

    for (let i = 0; i < this.count; i += 1) {
      this.anchors[i * 3] = (Math.random() - 0.5) * boundsX;
      this.anchors[i * 3 + 1] = Math.random() * boundsY;
      this.anchors[i * 3 + 2] = (Math.random() - 0.5) * boundsZ;
      this.positions[i * 3] = this.anchors[i * 3] ?? 0;
      this.positions[i * 3 + 1] = this.anchors[i * 3 + 1] ?? 0;
      this.positions[i * 3 + 2] = this.anchors[i * 3 + 2] ?? 0;
      // Phases équiréparties : désynchronisation garantie dès la première image.
      this.phases[i] = (i / this.count) * Math.PI * 2 + Math.random() * 0.8;
      this.sizes[i] = pixelSize * (0.7 + Math.random() * 0.7);
    }

    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new Float32BufferAttribute(this.positions, 3));
    geometry.setAttribute('aPhase', new Float32BufferAttribute(this.phases, 1));
    geometry.setAttribute('aSize', new Float32BufferAttribute(this.sizes, 1));

    this.material = new ShaderMaterial({
      vertexShader: VERTEX_SHADER,
      fragmentShader: FRAGMENT_SHADER,
      uniforms: {
        uTime: { value: 0 },
        uColor: { value: new Color(options.color ?? 0xffd98a) },
      },
      transparent: true,
      depthWrite: false,
    });

    this.points = new Points(geometry, this.material);
    this.points.frustumCulled = false;
    this.points.name = 'Fireflies';
  }

  get fireflyCount(): number {
    return this.count;
  }

  /** Déplace le nuage de lucioles (le joueur a changé de zone). */
  recenter(x: number, y: number, z: number): void {
    for (let i = 0; i < this.count; i += 1) {
      const i3 = i * 3;
      this.anchors[i3] = (this.anchors[i3] ?? 0) + (x - (this.anchors[i3] ?? 0)) * 0.5;
      this.anchors[i3 + 1] = (this.anchors[i3 + 1] ?? 0) + (y - (this.anchors[i3 + 1] ?? 0)) * 0.5;
      this.anchors[i3 + 2] = (this.anchors[i3 + 2] ?? 0) + (z - (this.anchors[i3 + 2] ?? 0)) * 0.5;
    }
  }

  update(_delta: number, elapsed: number): void {
    const motionScale = motionDurationScale();
    const timeUniform = this.material.uniforms.uTime;
    if (timeUniform) timeUniform.value = elapsed * motionScale;

    const drift = ambientDriftEnabled();
    const wanderSpeed = FX.fireflies.wanderSpeed * motionScale;
    // Errance lente autour de l'ancre : trois sinus à fréquences
    // incommensurables, jamais de boucle repérable. Quand le réglage change
    // en cours de partie, les lucioles reviennent immédiatement à leur ancre.
    for (let i = 0; i < this.count; i += 1) {
      const i3 = i * 3;
      const phase = this.phases[i] ?? 0;
      this.positions[i3] =
        (this.anchors[i3] ?? 0) + (drift ? Math.sin(elapsed * wanderSpeed + phase) * 0.8 : 0);
      this.positions[i3 + 1] =
        (this.anchors[i3 + 1] ?? 0) +
        (drift ? Math.sin(elapsed * wanderSpeed * 1.7 + phase * 2.3) * 0.35 : 0);
      this.positions[i3 + 2] =
        (this.anchors[i3 + 2] ?? 0) +
        (drift ? Math.cos(elapsed * wanderSpeed * 0.9 + phase) * 0.8 : 0);
    }
    (this.points.geometry.getAttribute('position') as Float32BufferAttribute).needsUpdate = true;
  }

  dispose(): void {
    this.points.geometry.dispose();
    this.material.dispose();
    this.points.removeFromParent();
  }
}
