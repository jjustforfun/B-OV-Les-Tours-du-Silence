/**
 * config.ts — constantes globales et drapeaux de qualité.
 *
 * Source unique de vérité pour tout ce qui est « réglable » : échelle de la grille
 * isométrique, budgets de performance, niveaux de qualité, clés de stockage.
 * Aucune logique ici, uniquement des valeurs — pour qu'un game designer puisse
 * les relire sans lire de code.
 */

/** Identité du jeu (titre, stockage, PWA). */
export const GAME = {
  id: 'bov',
  title: 'BӀOV',
  subtitle: 'Les Tours du Silence',
  version: '0.1.0',
} as const;

/**
 * Échelle du monde. Tout le level design est exprimé en unités de grille
 * entières : 1 unité = 1 bloc de pierre. La caméra isométrique est calée dessus.
 */
export const GRID = {
  /** Taille d'un bloc en unités three.js. */
  cell: 1,
  /** Hauteur d'une marche franchissable sans animation d'escalade. */
  step: 0.5,
  /** Tolérance de collage d'un point du monde sur un nœud du graphe. */
  snapEpsilon: 0.001,
} as const;

/**
 * Caméra : véritable isométrie (angles fixes, projection orthographique).
 * Monument Valley utilise une isométrie stricte ; c'est elle qui rend
 * possibles les illusions d'optique — deux points éloignés en 3D peuvent
 * coïncider à l'écran.
 */
export const CAMERA = {
  /** Azimut en degrés : 45° = arêtes du cube à 30° à l'écran. */
  azimuthDeg: 45,
  /** Élévation en degrés : atan(1/√2) ≈ 35.264° = isométrie véritable. */
  elevationDeg: 35.264389682754654,
  /** Demi-hauteur du frustum orthographique, en unités de grille. */
  viewSize: 9,
  distance: 40,
  near: 0.1,
  far: 200,
} as const;

/** Niveaux de qualité. Le moteur descend d'un cran s'il n'atteint pas la cible. */
export const QUALITY_TIERS = ['low', 'medium', 'high'] as const;
export type QualityTier = (typeof QUALITY_TIERS)[number];

export interface QualitySettings {
  /** Plafond du device pixel ratio (le coût du fillrate est quadratique). */
  readonly maxPixelRatio: number;
  readonly shadows: boolean;
  readonly shadowMapSize: number;
  readonly postFx: boolean;
  readonly bloom: boolean;
  readonly bloomIntensity: number;
  readonly vignette: boolean;
  readonly lut: boolean;
  readonly smaa: boolean;
  readonly ssao: boolean;
  readonly antialias: boolean;
  /** Nombre de nappes de brume décoratives conservées dans la scène. */
  readonly mistLayers: number;
  /** Multiplicateur du nombre de particules (brume, neige, lucioles). */
  readonly particleScale: number;
}

export const QUALITY_PRESETS: Readonly<Record<QualityTier, QualitySettings>> = {
  low: {
    maxPixelRatio: 1,
    shadows: false,
    shadowMapSize: 512,
    postFx: false,
    bloom: false,
    bloomIntensity: 0,
    vignette: false,
    lut: false,
    smaa: false,
    ssao: false,
    antialias: false,
    mistLayers: 1,
    particleScale: 0.35,
  },
  medium: {
    maxPixelRatio: 1.5,
    shadows: true,
    shadowMapSize: 1024,
    postFx: true,
    bloom: true,
    bloomIntensity: 0.16,
    vignette: true,
    lut: true,
    smaa: true,
    ssao: false,
    antialias: false,
    mistLayers: 2,
    particleScale: 0.7,
  },
  high: {
    maxPixelRatio: 2,
    shadows: true,
    shadowMapSize: 2048,
    postFx: true,
    bloom: true,
    bloomIntensity: 0.22,
    vignette: true,
    lut: true,
    smaa: true,
    ssao: true,
    antialias: false,
    mistLayers: 3,
    particleScale: 1,
  },
} as const;

/** Budgets de performance — vérifiés en CI et par le panneau de debug. */
export const RENDER = {
  toon: {
    /** Seuils de la rampe toon : ombre, demi-teinte, lumière. */
    rampShadow: 0.32,
    rampMid: 0.66,
    rimStrength: 0.14,
    rimPower: 2.4,
    noiseStrength: 0.055,
    vertexAoFloor: 0.52,
    vertexAoStrength: 0.72,
  },
  sky: {
    gradientSteps: 64,
    animationSpeed: 0.045,
    animationAmplitude: 0.045,
    fogHeightBase: 0,
    fogHeightFalloff: 0.18,
    fogDistanceDensity: 0.014,
    heightFogStrength: 0.34,
    heightFogMaxOpacity: 0.42,
  },
  postFx: {
    lutSize: 16,
    lutOpacity: 0.32,
    bloomThreshold: 0.82,
    bloomSmoothing: 0.18,
    bloomRadius: 0.62,
    vignetteOffset: 0.36,
    vignetteDarkness: 0.32,
    ssaoResolutionScale: 0.55,
    ssaoIntensity: 0.38,
    ssaoRadius: 0.13,
  },
  blobShadow: {
    textureSize: 32,
    opacity: 0.22,
    groundOffset: 0.012,
  },
} as const;

export const PERF = {
  targetFps: 60,
  /** En dessous, on descend d'un cran de qualité. */
  downgradeFps: 48,
  /** Au-dessus et stable, on peut remonter d'un cran. */
  upgradeFps: 58,
  /** Fenêtre d'observation avant tout changement de qualité (ms). */
  adaptWindowMs: 3000,
  /** Poids maximal du bundle initial, gzip (octets) — voir scripts/check-bundle.mjs. */
  maxInitialBundleGzip: 1_500_000,
  /** Plafond d'appels de dessin par image. */
  maxDrawCalls: 120,
  /** Plafond de triangles à l'écran. */
  maxTriangles: 150_000,
  /** Plafond de mémoire GPU (octets) — textures + géométries + cibles de rendu. */
  maxGpuMemory: 256 * 1024 * 1024,
  /** Poids maximal d'un chunk de niveau, gzip (octets). */
  maxLevelChunkGzip: 400_000,
  /** Time-to-interactive visé sur une 4G moyenne (ms). */
  maxTimeToInteractiveMs: 3000,
} as const;

/** Rythme du jeu : tout est lent, rien ne punit. */
export const PACING = {
  /** Vitesse de marche de Turpal, en cellules par seconde. */
  walkSpeed: 2.1,
  /** Durée d'une rotation d'architecture (ms). */
  mechanismDurationMs: 900,
  /** Durée d'une micro-célébration (ms). */
  celebrationMs: 1600,
  /** Fondu entre deux chapitres (ms). */
  chapterFadeMs: 1200,
  /** Inactivité avant le premier indice : lueur sur l'élément utile (ms). */
  hintGlowDelayMs: 90_000,
  /** Inactivité avant le second indice : Borz regarde dans la bonne direction (ms). */
  hintGazeDelayMs: 180_000,
  /** Fondu d'extinction d'un indice dès que le joueur interagit (ms). */
  hintFadeMs: 900,
} as const;

/**
 * Interface (docs/ART_DIRECTION.md § 6 : 180 / 420 / 900 / 1800 ms — les
 * durées CSS vivent dans `ui/styles/tokens.css`, les durées du flux ici).
 */
export const UI = {
  /** Le titre attend ce délai avant d'apparaître sur la vallée (ms). */
  titleDelayMs: 600,
  /** Le carton de chapitre reste affiché seul (ms), écourté au tap. */
  cardHoldMs: 2800,
  /** Le texte d'introduction reste affiché (ms), écourté au tap. */
  introHoldMs: 9000,
  /** Délai anti-tap accidentel avant que l'intro devienne écourtable (ms). */
  introMinHoldMs: 1600,
  /** La célébration de fin de chapitre vit ce temps avant la sauvegarde (ms). */
  solvedHoldMs: 2800,
  /** Une notification discrète reste à l'écran (ms) — jamais bloquante. */
  toastMs: 2600,
  /** La coupure rapide du son se confirme brièvement (ms). */
  muteToastMs: 1600,
  /** Taille du texte réglable (docs/ART_DIRECTION.md § 7). */
  fontScales: { small: 0.875, normal: 1, large: 1.25 } as const,
  /** Échelles de texte proposées, dans l'ordre d'affichage. */
  fontScaleOrder: ['small', 'normal', 'large'] as const,
} as const;

/**
 * Clavier (docs/CONTROLS.md § 2). Les bindings vivent dans
 * `input/KeyboardInput.ts` : ce ne sont pas des constantes de rythme.
 */
export const KEYBOARD = {
  /**
   * Écart angulaire maximal (degrés) entre la touche pressée et un voisin
   * projeté à l'écran. Au-delà, rien ne se passe — aucun bip, aucune punition.
   */
  moveMaxAngleDeg: 60,
} as const;

/**
 * Manette (docs/CONTROLS.md § 3). L'API Gamepad se sonde, elle n'émet pas :
 * `GamepadInput.poll()` est appelé une fois par image.
 */
export const GAMEPAD = {
  /** Zone morte du stick : le jeu se joue au pas, pas au pixel. */
  deadZone: 0.35,
  /** Répétition du déplacement directionnel, stick ou croix maintenus. */
  moveRepeatMs: 220,
  /** Seuil de déclenchement des gâchettes analogiques L2 / R2. */
  triggerThreshold: 0.5,
} as const;

/**
 * Audio (docs/AUDIO.md). Tout est synthétisé à l'exécution (ADR-007) : ces
 * constantes pilotent le mixage et le cycle de vie, pas la synthèse elle-même.
 */
export const AUDIO = {
  volumes: { master: 0.9, music: 0.7, ambience: 0.6, sfx: 0.85 },
  /** Gain nominal de chaque bus dans le mix (dB) — le curseur atténue autour. */
  busNominalDb: { master: 0, music: -9, ambience: -14, sfx: -6 },
  unlockFadeInSeconds: 1.2,
  hiddenFadeOutMs: 250,
  hiddenFadeInMs: 400,
  muteFadeMs: 120,
  blurAttenuationDb: -12,
  reverb: { decaySeconds: 9, preDelaySeconds: 0.08, wet: 0.42, sfxSend: 0.25 },
  duck: { musicDb: -4, ambienceDb: -3, attackMs: 400, releaseMs: 1200 },
  /** Fondu d'installation d'une couche musicale (docs/AUDIO.md § 4). */
  layerFadeSeconds: 6,
  /** Silence de filtrage pendant une bascule de gravité (ms). */
  gravityMuffleMs: 500,
  /** Pondar : inharmonicité aléatoire à chaque pincement (cents). */
  pondarDetuneCents: 4,
  /** Variation des effets sonores, pour éviter la fatigue d'écoute. */
  sfxVariation: { semitones: 2, gainDb: 1.5 },
} as const;

/**
 * FX et « juice » (docs/ART_DIRECTION.md). Un seul pool de particules pour
 * tout ce qui scintille, un seul InstancedMesh pour les éclats de pierre.
 */
export const FX = {
  /** Capacité du pool de particules avant `particleScale` (un draw call). */
  particleBudget: 420,
  rotationDust: { count: 12, lifetimeMs: 700 },
  fragments: { count: 40, assembleMs: 700, holdMs: 420, fadeMs: 260 },
  trail: { speed: 8, fadeMs: 900, particlesPerUnit: 3 },
  illumination: { staggerMs: 250, glowFadeMs: 900 },
  mist: { maxOpacity: 0.12, drift: 0.05, size: 30 },
  snow: { minFlakes: 140, maxFlakes: 400, fallSpeed: 0.6, swaySpeed: 0.35, swayAmplitude: 0.18 },
  fireflies: { count: 26, wanderSpeed: 0.22, pulseSpeed: 1.4, chapters: [4, 7] },
  shafts: { maxCount: 4, dustPerSecond: 6, dustLifetimeMs: 2600 },
} as const;

/** Réglages du héros procédural et de ses animations. */
export const POINTER = {
  /** Déplacement minimal avant qu'un tap devienne un drag. */
  dragThresholdPx: 8,
  /** Taille minimale attrapable d'un petit levier : 20 px de diamètre. */
  pickTargetRadiusPx: 10,
  /** Rayons de secours haut/bas/gauche/droite autour du tap. */
  fallbackRayOffsetPx: 12,
  /** Tolérance supplémentaire du raycast de sol sur mobile. */
  mobileRaycastTolerancePx: 18,
  /** Distance maximale pour aimanter un raycast de surface vers un nœud. */
  walkableSnapMaxDistance: 0.75,
  /** Durée d'un appui long avant qu'il devienne une demande d'indice (ms). */
  longPressMs: 1200,
} as const;

export const TURPAL = {
  height: 0.85,
  targetTriangles: 3_000,
  modelTriangleTolerance: 700,
  animationBlendMs: 180,
  upBlendMs: 450,
  saluteDistance: 2,
  saluteMs: 1_400,
  skyLookMs: 1_800,
  papakhaAdjustMinMs: 8_000,
  papakhaAdjustMaxMs: 15_000,
  papakhaAdjustMs: 1_100,
  destinationMarkerRadius: 0.4,
  destinationMarkerMs: 420,
  stairHeight: GRID.step,
  pathLookAhead: 0.035,
} as const;

/** Clés de persistance (localStorage aujourd'hui, Capacitor Preferences demain). */
export const STORAGE_KEYS = {
  save: 'bov.save.v1',
  settings: 'bov.settings.v1',
  locale: 'bov.locale.v1',
} as const;

/** Drapeaux de développement — tous à false en production. */
export const DEV_FLAGS = {
  showStats: import.meta.env.DEV,
  showDebugPanel: import.meta.env.DEV,
  showNavGraph: false,
  freeCamera: false,
} as const;
