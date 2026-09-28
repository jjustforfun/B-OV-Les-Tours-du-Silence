/**
 * FxRuntime.ts — orchestration des effets, à l'écoute du seul EventBus.
 *
 * Possède le pool de particules, la brume, la neige, les lucioles, les rais,
 * les éclats de pierre, la traînée dorée et les célébrations — et traduit
 * les événements du jeu (`mechanism:*`, `path:connected`, `level:solved`) en
 * gestes visuels. Le rendu ne décide rien : il écoute, il montre.
 *
 * Perfs : un draw call pour toutes les particules, un pour les éclats, un
 * par nappe de brume, un par rais — tout le « juice » du jeu tient dans
 * moins de dix appels de dessin. Les densités suivent `particleScale` de la
 * qualité ; les durations suivent `prefers-reduced-motion`.
 */
import { Group, Vector3, type Material, type Object3D, type OrthographicCamera } from 'three';
import { bus } from '@core/EventBus';
import { ambientDriftEnabled } from '@core/motion';
import { FX, type QualitySettings } from '@/config';
import { CHAPTER_PALETTES } from '@render/Palettes';
import { createToonStoneMaterial } from '@render/materials/ToonStoneMaterial';
import type { Level } from '@world/Level';
import { Celebrate } from './Celebrate';
import { Fireflies } from './Fireflies';
import { GoldenTrail } from './GoldenTrail';
import { LightShafts } from './LightShafts';
import { Mist } from './Mist';
import { ParticlePool, type EmitOptions } from './Particles';
import { Snow } from './Snow';
import { StoneFragments } from './StoneFragments';

export interface FxRuntimeDeps {
  readonly scene: Object3D;
  readonly camera: OrthographicCamera;
  /** Hauteur CSS du canvas, pour l'échelle monde→pixels. */
  readonly viewportHeight: () => number;
  readonly quality: QualitySettings;
  /** Tours du niveau, pour l'illumination en cascade de fin de chapitre. */
  readonly getTowers?: () => readonly Object3D[];
}

const GRACE_TMP = new Vector3();
const GRACE_FROM = new Vector3();
const GRACE_TO = new Vector3();

/** `EmitOptions` avec champs inscriptibles : réutilisable image après image. */
type WritableEmitOptions = { -readonly [K in keyof EmitOptions]: EmitOptions[K] };

export class FxRuntime {
  readonly root = new Group();

  readonly pool: ParticlePool;
  readonly mist: Mist;
  readonly shafts: LightShafts;

  private readonly camera: OrthographicCamera;
  private readonly viewportHeight: () => number;
  private readonly getTowers: () => readonly Object3D[];
  private readonly fragments: StoneFragments;
  private readonly trail: GoldenTrail;
  private readonly celebrate: Celebrate;
  private readonly fragmentMaterial: Material;
  private readonly unsubscribe: (() => void)[] = [];

  private snow: Snow | null = null;
  private fireflies: Fireflies | null = null;
  private moteAccumulator = 0;
  private currentChapter = -1;
  private quality: QualitySettings;

  /** Options d'émission réutilisées pour la poussière des rais. */
  private readonly moteOptions: WritableEmitOptions = {
    x: 0,
    y: 0,
    z: 0,
    count: 1,
    color: 0xf5e7c8,
    speed: 0.03,
    speedVariance: 0.02,
    size: 0.035,
    sizeEnd: 0.01,
    lifetime: FX.shafts.dustLifetimeMs / 1000,
    lifetimeVariance: 0.6,
    gravity: -0.008,
    drag: 0.2,
    upBias: 0.4,
  };

  constructor(deps: FxRuntimeDeps) {
    this.root.name = 'FxRuntime';
    this.camera = deps.camera;
    this.viewportHeight = deps.viewportHeight;
    this.getTowers = deps.getTowers ?? (() => []);
    this.quality = deps.quality;

    this.pool = new ParticlePool({
      budget: FX.particleBudget,
      particleScale: deps.quality.particleScale,
    });
    this.root.add(this.pool.points);

    this.mist = new Mist({ layers: deps.quality.mistLayers });
    this.root.add(this.mist.root);

    this.shafts = new LightShafts();
    this.root.add(this.shafts.root);

    this.fragmentMaterial = createToonStoneMaterial({
      color: CHAPTER_PALETTES.prologue.stoneLight,
      steps: 3,
      rimStrength: 0.1,
      noiseStrength: 0.06,
    });
    this.fragments = new StoneFragments(this.fragmentMaterial, deps.quality.particleScale);
    this.root.add(this.fragments.mesh);

    this.trail = new GoldenTrail(this.pool);
    this.celebrate = new Celebrate(this.pool, this.root);

    deps.scene.add(this.root);
    this.updatePixelScale();
    this.bindBus();
  }

  /**
   * Adapte les effets ambiants au niveau courant : neige si un nœud est
   * enneigé, lucioles aux chapitres 4 et 7 (docs/tasks Phase 7).
   */
  attachLevel(level: Level): void {
    this.detachLevel();
    this.currentChapter = level.definition.chapter;

    let hasSnow = false;
    let minX = 0;
    let maxX = 0;
    let minY = 0;
    let maxY = 0;
    let minZ = 0;
    let maxZ = 0;
    for (const node of level.graph.allNodes()) {
      if (node.surface === 'snow') hasSnow = true;
      minX = Math.min(minX, node.position.x);
      maxX = Math.max(maxX, node.position.x);
      minY = Math.min(minY, node.position.y);
      maxY = Math.max(maxY, node.position.y);
      minZ = Math.min(minZ, node.position.z);
      maxZ = Math.max(maxZ, node.position.z);
    }
    if (hasSnow) {
      this.snow = new Snow(
        { bounds: [maxX - minX + 14, maxY - minY + 10, maxZ - minZ + 14] },
        this.quality.particleScale,
      );
      this.snow.points.position.set((minX + maxX) / 2, minY, (minZ + maxZ) / 2);
      this.root.add(this.snow.points);
    }

    if ((FX.fireflies.chapters as readonly number[]).includes(level.definition.chapter)) {
      this.fireflies = new Fireflies(
        {
          bounds: [
            Math.max(6, maxX - minX + 6),
            Math.max(3, maxY - minY + 3),
            Math.max(6, maxZ - minZ + 6),
          ],
        },
        this.quality.particleScale,
      );
      const center = level.center;
      this.fireflies.points.position.set(center.x, minY, center.z);
      this.root.add(this.fireflies.points);
    }
  }

  detachLevel(): void {
    this.currentChapter = -1;
    this.snow?.dispose();
    this.snow = null;
    this.fireflies?.dispose();
    this.fireflies = null;
    this.celebrate.reset();
    this.trail.dispose();
  }

  update(elapsed: number, delta: number): void {
    this.pool.update(delta);
    this.mist.update(elapsed);
    this.shafts.update(delta, elapsed);
    this.fragments.update(delta);
    this.trail.update(delta);
    this.celebrate.update(delta);
    this.snow?.update(delta, elapsed);
    this.fireflies?.update(delta, elapsed);
    this.emitShaftDust(delta);
  }

  applyQuality(quality: QualitySettings): void {
    this.quality = quality;
    this.mist.setVisible(quality.mistLayers);
    // Les rais coûtent du fillrate : rien en qualité basse (docs/tasks P7).
    this.shafts.setVisible(quality.postFx);
  }

  /** Échelle monde→pixels des points (caméra orthographique iso). */
  updatePixelScale(): void {
    const frustumHeight = this.camera.top - this.camera.bottom;
    if (frustumHeight <= 0) return;
    this.pool.setPixelScale(this.viewportHeight() / frustumHeight);
  }

  dispose(): void {
    for (const off of this.unsubscribe) off();
    this.unsubscribe.length = 0;
    this.detachLevel();
    this.celebrate.dispose();
    this.fragments.dispose();
    this.fragmentMaterial.dispose();
    this.shafts.dispose();
    this.mist.dispose();
    this.pool.dispose();
    this.root.removeFromParent();
    this.root.clear();
  }

  private bindBus(): void {
    this.unsubscribe.push(
      bus.on('mechanism:drag', (event) => {
        if (!event.active) return;
        // Poussière de rotation : 12 particules au démarrage, 700 ms de vie.
        this.pool.emit({
          x: event.at.x,
          y: event.at.y + 0.06,
          z: event.at.z,
          count: FX.rotationDust.count,
          color: 0x9aa4b5,
          colorEnd: 0x5c6474,
          speed: 0.45,
          speedVariance: 0.2,
          size: 0.08,
          sizeEnd: 0.015,
          lifetime: FX.rotationDust.lifetimeMs / 1000,
          lifetimeVariance: 0.15,
          gravity: -0.2,
          drag: 1.0,
          upBias: 0.7,
        });
      }),
      bus.on('mechanism:snap', (event) => {
        this.celebrate.celebrate('align', { at: event.at });
      }),
      bus.on('path:connected', (event) => {
        const points = event.points;
        if (points.length === 0) return;
        this.trail.run({ points });
        this.fragments.assemble({ points });
        const first = points[0];
        if (first !== undefined) this.celebrate.celebrate('discover', { at: first });
      }),
      bus.on('illusion:crossed', (event) => {
        // Confirmation a posteriori seulement : six grains de lumière, 120 ms.
        this.pool.emit({
          x: event.to.x,
          y: event.to.y + 0.08,
          z: event.to.z,
          count: 6,
          color: 0xd9a441,
          speed: 0.08,
          speedVariance: 0.02,
          size: 0.045,
          sizeEnd: 0,
          lifetime: 0.12,
          lifetimeVariance: 0,
          gravity: 0,
          drag: 1.8,
          upBias: 0.5,
        });
      }),
      bus.on('finale:towerLit', (event) => {
        if (this.currentChapter === 7) this.celebrate.celebrate('discover', { at: event.at });
      }),
      bus.on('finale:threshold', (event) => {
        if (this.currentChapter !== 7) return;
        const towers = this.getTowers();
        this.celebrate.chapterEnd(towers, event.at);
        this.spawnGraceShafts(towers, event.at);
        this.shafts.reveal(2.5);
      }),
      bus.on('level:solved', (event) => {
        const origin = event.at ?? { x: 0, y: 0, z: 0 };
        if (this.currentChapter === 7) {
          this.celebrate.celebrate('solve', { at: origin });
          return;
        }
        const towers = this.getTowers();
        if (towers.length > 0) {
          this.celebrate.chapterEnd(towers, origin);
          this.spawnGraceShafts(towers, origin);
        } else {
          this.celebrate.celebrate('solve', { at: origin });
        }
        this.shafts.reveal(2.5);
      }),
    );
  }

  /**
   * Résolution : la lumière trouve un passage entre les tours — deux rais
   * descendent de la plus haute vers le lieu de la résolution.
   */
  private spawnGraceShafts(
    towers: readonly Object3D[],
    origin: { readonly x: number; readonly y: number; readonly z: number },
  ): void {
    let topY = Number.NEGATIVE_INFINITY;
    let topX = origin.x;
    let topZ = origin.z;
    for (const tower of towers) {
      tower.getWorldPosition(GRACE_TMP);
      if (GRACE_TMP.y > topY) {
        topY = GRACE_TMP.y;
        topX = GRACE_TMP.x;
        topZ = GRACE_TMP.z;
      }
    }
    if (topY === Number.NEGATIVE_INFINITY) topY = origin.y + 3;

    GRACE_FROM.set(topX, topY + 1.4, topZ);
    GRACE_TO.set(origin.x + 0.8, origin.y, origin.z);
    this.shafts.addShaft(GRACE_FROM, GRACE_TO, 1.1);
    GRACE_FROM.set(topX + 0.5, topY + 1.2, topZ - 0.4);
    GRACE_TO.set(origin.x - 1.1, origin.y - 0.2, origin.z + 0.4);
    this.shafts.addShaft(GRACE_FROM, GRACE_TO, 0.8);
  }

  /** Poussière qui flotte dans les rais — sauf en mouvement réduit. */
  private emitShaftDust(delta: number): void {
    if (!ambientDriftEnabled() || this.shafts.shaftCount === 0) return;
    const volumes = this.shafts.volumesOf();
    if (volumes.length === 0) return;

    this.moteAccumulator += delta * FX.shafts.dustPerSecond;
    while (this.moteAccumulator >= 1) {
      this.moteAccumulator -= 1;
      const volume = volumes[Math.floor(Math.random() * volumes.length)];
      if (volume === undefined) continue;
      const t = Math.random();
      const lateral = (Math.random() - 0.5) * volume.radius * t;
      this.moteOptions.x = volume.fromX + (volume.toX - volume.fromX) * t + lateral;
      this.moteOptions.y = volume.fromY + (volume.toY - volume.fromY) * t;
      this.moteOptions.z = volume.fromZ + (volume.toZ - volume.fromZ) * t + lateral * 0.6;
      this.pool.emit(this.moteOptions);
    }
  }
}
