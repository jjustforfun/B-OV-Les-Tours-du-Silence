/**
 * ToonStoneMaterial.ts — la pierre des tours vainakhs.
 *
 * Rendu « gouache » : rampe toon trois bandes (0,32 / 0,66 / 1), couleurs de
 * sommets pour les variations de pierre, AO cuit dans un attribut `aAo`, rim
 * light froid et léger bruit procédural de surface. Tout tient dans un seul
 * matériau three.js standard augmenté à la compilation : pas de texture de
 * pierre, pas de PBR, et une rampe partagée pour toute la scène.
 */
import {
  BufferAttribute,
  Color,
  DataTexture,
  LinearFilter,
  MeshToonMaterial,
  NearestFilter,
  RedFormat,
  SRGBColorSpace,
  UnsignedByteType,
  type BufferGeometry,
  type ColorRepresentation,
  type Texture,
  type WebGLProgramParametersWithUniforms,
} from 'three';
import { RENDER } from '@/config';

export interface ToonStoneOptions {
  readonly color?: ColorRepresentation;
  /** Nombre de paliers de lumière. Le jeu utilise 3 par défaut. */
  readonly steps?: 3 | 4 | 5;
  readonly emissive?: ColorRepresentation;
  readonly emissiveIntensity?: number;
  readonly rimColor?: ColorRepresentation;
  readonly rimStrength?: number;
  readonly rimPower?: number;
  readonly noiseStrength?: number;
}

export interface StoneBakeOptions {
  /** Teinte de base écrite dans l'attribut `color`. */
  readonly color?: ColorRepresentation;
  /** Variation déterministe de valeur, en pourcentage. */
  readonly valueJitter?: number;
  /** Variation déterministe de teinte, en degrés. */
  readonly hueJitterDeg?: number;
  /** Force de l'AO cuite dans `aAo`. */
  readonly aoStrength?: number;
}

interface ToonStoneMaterialInternals {
  defaultAttributeValues?: Record<string, readonly number[]>;
  flatShading?: boolean;
}

const gradientCache = new Map<number, DataTexture>();
const colorScratch = new Color();
const fogColor = new Color(0xa8b2bf);

/** Rampe de dégradé partagée, en niveaux de gris. */
export function getToonGradient(steps: 3 | 4 | 5 = 3): DataTexture {
  const cached = gradientCache.get(steps);
  if (cached) return cached;

  const data = new Uint8Array(steps);
  for (let i = 0; i < steps; i += 1) {
    const t = steps === 3 ? threeBandRamp(i) : i / (steps - 1);
    data[i] = Math.round(t * 255);
  }

  const texture = new DataTexture(data, steps, 1, RedFormat, UnsignedByteType);
  texture.name = `ToonStoneRamp${steps}`;
  texture.minFilter = NearestFilter;
  texture.magFilter = NearestFilter;
  texture.generateMipmaps = false;
  texture.colorSpace = SRGBColorSpace;
  texture.needsUpdate = true;
  texture.userData.bovSharedTexture = 'toon-gradient';
  gradientCache.set(steps, texture);
  return texture;
}

/**
 * Ajoute les attributs gratuits du matériau : `color` et `aAo`.
 *
 * La cuisson est volontairement géométrique et déterministe : elle assombrit
 * les dessous, les bases et les arêtes rentrantes probables, sans coût à
 * l'exécution. Les niveaux plus avancés pourront remplacer cette heuristique
 * par une vraie passe de bake sans changer le shader.
 */
export function bakeToonStoneGeometry(
  geometry: BufferGeometry,
  options: StoneBakeOptions = {},
): BufferGeometry {
  geometry.computeBoundingBox();
  geometry.computeVertexNormals();

  const position = geometry.getAttribute('position');
  const normal = geometry.getAttribute('normal');
  const bounds = geometry.boundingBox;
  if (!bounds) return geometry;

  const colors = new Float32Array(position.count * 3);
  const ao = new Float32Array(position.count);
  const base = colorScratch.set(options.color ?? 0xffffff);
  const valueJitter = options.valueJitter ?? 0.06;
  const hueJitter = (options.hueJitterDeg ?? 4) / 360;
  const aoStrength = options.aoStrength ?? RENDER.toon.vertexAoStrength;

  const width = Math.max(bounds.max.x - bounds.min.x, 0.0001);
  const height = Math.max(bounds.max.y - bounds.min.y, 0.0001);
  const depth = Math.max(bounds.max.z - bounds.min.z, 0.0001);
  const largestHorizontal = Math.max(width, depth);

  for (let i = 0; i < position.count; i += 1) {
    const x = position.getX(i);
    const y = position.getY(i);
    const z = position.getZ(i);
    const hash = hash3(x, y, z, i);
    const value = 1 + (hash - 0.5) * 2 * valueJitter;
    const hue = (hash3(z, x, y, i + 17) - 0.5) * 2 * hueJitter;

    colorScratch.copy(base).offsetHSL(hue, 0, value - 1);
    colors[i * 3] = colorScratch.r;
    colors[i * 3 + 1] = colorScratch.g;
    colors[i * 3 + 2] = colorScratch.b;

    const normalizedY = (y - bounds.min.y) / height;
    const edgeDistance = Math.min(
      x - bounds.min.x,
      bounds.max.x - x,
      z - bounds.min.z,
      bounds.max.z - z,
    );
    const edge = 1 - smoothstep(0, largestHorizontal * 0.16, Math.max(edgeDistance, 0));
    const underside = Math.max(0, -normal.getY(i));
    const baseDarkening = 1 - smoothstep(0.06, 0.42, normalizedY);
    const cavity = Math.min(1, edge * 0.44 + underside * 0.34 + baseDarkening * 0.28);
    ao[i] = clamp(1 - cavity * aoStrength, RENDER.toon.vertexAoFloor, 1);
  }

  geometry.setAttribute('color', new BufferAttribute(colors, 3));
  geometry.setAttribute('aAo', new BufferAttribute(ao, 1));
  return geometry;
}

export function createToonStoneMaterial(options: ToonStoneOptions = {}): MeshToonMaterial {
  const material = new MeshToonMaterial({
    color: new Color(options.color ?? 0x9aa0ab),
    gradientMap: getToonGradient(options.steps ?? 3),
    vertexColors: true,
  });

  material.name = 'ToonStone';
  if (options.emissive !== undefined) {
    material.emissive = new Color(options.emissive);
    material.emissiveIntensity = options.emissiveIntensity ?? 1;
  }

  const internals = material as MeshToonMaterial & ToonStoneMaterialInternals;
  internals.flatShading = true;
  internals.defaultAttributeValues = {
    color: [1, 1, 1],
    aAo: [1],
  };

  installStoneShader(material, options);
  return material;
}

/** À appeler au déchargement complet du jeu (cycle de vie Android). */
export function disposeToonGradients(): void {
  for (const texture of gradientCache.values()) texture.dispose();
  gradientCache.clear();
}

export function isSharedToonTexture(texture: Texture): boolean {
  return texture.userData.bovSharedTexture === 'toon-gradient';
}

/** Réexport utilitaire : certains matériaux veulent une rampe lissée. */
export const SMOOTH_FILTER = LinearFilter;

function installStoneShader(material: MeshToonMaterial, options: ToonStoneOptions): void {
  const rimColor = new Color(options.rimColor ?? 0xdde8ff);
  const rimStrength = options.rimStrength ?? RENDER.toon.rimStrength;
  const rimPower = options.rimPower ?? RENDER.toon.rimPower;
  const noiseStrength = options.noiseStrength ?? RENDER.toon.noiseStrength;

  material.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms) => {
    shader.uniforms.uStoneRimColor = { value: rimColor };
    shader.uniforms.uStoneRimStrength = { value: rimStrength };
    shader.uniforms.uStoneRimPower = { value: rimPower };
    shader.uniforms.uStoneNoiseStrength = { value: noiseStrength };
    shader.uniforms.uStoneFogColor = { value: fogColor };
    shader.uniforms.uStoneFogBase = { value: RENDER.sky.fogHeightBase };
    shader.uniforms.uStoneFogFalloff = { value: RENDER.sky.fogHeightFalloff };
    shader.uniforms.uStoneFogDistance = { value: RENDER.sky.fogDistanceDensity };
    shader.uniforms.uStoneFogStrength = { value: RENDER.sky.heightFogStrength };
    shader.uniforms.uStoneFogMaxOpacity = { value: RENDER.sky.heightFogMaxOpacity };

    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
attribute float aAo;
varying float vStoneAo;
varying vec3 vStoneWorldPosition;`,
      )
      .replace(
        '#include <displacementmap_vertex>',
        `#include <displacementmap_vertex>
vStoneAo = aAo;
vec4 stoneWorldPosition = vec4( transformed, 1.0 );
#ifdef USE_BATCHING
  stoneWorldPosition = batchingMatrix * stoneWorldPosition;
#endif
#ifdef USE_INSTANCING
  stoneWorldPosition = instanceMatrix * stoneWorldPosition;
#endif
stoneWorldPosition = modelMatrix * stoneWorldPosition;
vStoneWorldPosition = stoneWorldPosition.xyz;`,
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
varying float vStoneAo;
varying vec3 vStoneWorldPosition;
uniform vec3 uStoneRimColor;
uniform float uStoneRimStrength;
uniform float uStoneRimPower;
uniform float uStoneNoiseStrength;
uniform vec3 uStoneFogColor;
uniform float uStoneFogBase;
uniform float uStoneFogFalloff;
uniform float uStoneFogDistance;
uniform float uStoneFogStrength;
uniform float uStoneFogMaxOpacity;

float stoneHash(vec3 value) {
  return fract(sin(dot(value, vec3(12.9898, 78.233, 37.719))) * 43758.5453);
}

float stoneNoise(vec3 value) {
  vec3 cell = floor(value);
  vec3 local = smoothstep(vec3(0.0), vec3(1.0), fract(value));
  float n000 = stoneHash(cell + vec3(0.0, 0.0, 0.0));
  float n100 = stoneHash(cell + vec3(1.0, 0.0, 0.0));
  float n010 = stoneHash(cell + vec3(0.0, 1.0, 0.0));
  float n110 = stoneHash(cell + vec3(1.0, 1.0, 0.0));
  float n001 = stoneHash(cell + vec3(0.0, 0.0, 1.0));
  float n101 = stoneHash(cell + vec3(1.0, 0.0, 1.0));
  float n011 = stoneHash(cell + vec3(0.0, 1.0, 1.0));
  float n111 = stoneHash(cell + vec3(1.0, 1.0, 1.0));
  float nx00 = mix(n000, n100, local.x);
  float nx10 = mix(n010, n110, local.x);
  float nx01 = mix(n001, n101, local.x);
  float nx11 = mix(n011, n111, local.x);
  float nxy0 = mix(nx00, nx10, local.y);
  float nxy1 = mix(nx01, nx11, local.y);
  return mix(nxy0, nxy1, local.z);
}`,
      )
      .replace(
        'vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;',
        `vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;
float bakedAo = clamp(vStoneAo, ${RENDER.toon.vertexAoFloor.toFixed(3)}, 1.0);
float grain = stoneNoise(vStoneWorldPosition * 4.7) * 0.65 + stoneNoise(vStoneWorldPosition * 13.0) * 0.35;
outgoingLight *= bakedAo * (1.0 + (grain - 0.5) * uStoneNoiseStrength);
float rim = pow(1.0 - saturate(dot(normalize(normal), normalize(vViewPosition))), uStoneRimPower) * uStoneRimStrength;
outgoingLight += uStoneRimColor * rim;
float heightMist = exp(-max(vStoneWorldPosition.y - uStoneFogBase, 0.0) * uStoneFogFalloff);
float distanceMist = 1.0 - exp(-length(vViewPosition) * uStoneFogDistance);
float heightFog = clamp(heightMist * distanceMist * uStoneFogStrength, 0.0, uStoneFogMaxOpacity);
outgoingLight = mix(outgoingLight, uStoneFogColor, heightFog);`,
      );
  };

  material.customProgramCacheKey = () => 'bov-toon-stone-v1';
}

function threeBandRamp(index: number): number {
  if (index === 0) return RENDER.toon.rampShadow;
  if (index === 1) return RENDER.toon.rampMid;
  return 1;
}

function hash3(x: number, y: number, z: number, salt: number): number {
  return fract(Math.sin(x * 12.9898 + y * 78.233 + z * 37.719 + salt * 11.13) * 43758.5453);
}

function fract(value: number): number {
  return value - Math.floor(value);
}

function smoothstep(edge0: number, edge1: number, value: number): number {
  const t = clamp((value - edge0) / Math.max(edge1 - edge0, 0.0001), 0, 1);
  return t * t * (3 - 2 * t);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
