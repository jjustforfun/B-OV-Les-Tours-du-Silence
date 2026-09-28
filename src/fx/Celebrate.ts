/**
 * Celebrate.ts — micro-célébrations, la pièce centrale du « juice ».
 *
 * Le joueur doit se sentir intelligent. Chaque réussite — même partielle —
 * déclenche une réponse du monde, et jamais de texte « Bravo ! » : le monde
 * félicite, pas l'interface.
 *
 *  - `align`    (mécanisme aligné)   → onde de poussière + vibration snap,
 *    exactement 1,6 s de réaction totale (PACING.celebrationMs) ;
 *  - `discover` (passage découvert)  → gerbe dorée douce + vibration tick ;
 *  - `solve`    (chapitre résolu)    → illumination des tours en cascade de
 *    la plus lointaine à la plus proche, 250 ms d'écart, pétales ou
 *    étincelles, et la lumière trouve un passage (rais). L'accord final est
 *    joué par l'AudioDirector (`PondarSynth.playChapterSignature`).
 *
 * Timelines manuelles plutôt que GSAP (ADR-026) : mêmes courbes, zéro
 * dépendance, zéro allocation par image, et `prefers-reduced-motion` divisé
 * par deux d'un simple facteur.
 */
import { Mesh, MeshBasicMaterial, Object3D, SphereGeometry, Vector3 } from 'three';
import { FX, PACING } from '@/config';
import { haptic } from '@input/Haptics';
import { motionDurationScale } from '@core/motion';
import type { ParticlePool } from './Particles';
import { EMBER } from '@render/Palettes';

export type CelebrationKind = 'align' | 'discover' | 'solve';

export interface CelebrationContext {
  /** Endroit du monde où la célébration se produit. */
  readonly at: Object3D | { readonly x: number; readonly y: number; readonly z: number };
}

interface GlowOrb {
  readonly mesh: Mesh<SphereGeometry, MeshBasicMaterial>;
  readonly material: MeshBasicMaterial;
  elapsed: number;
  delay: number;
}

const GLOW_RADIUS = 0.3;

export class Celebrate {
  private readonly geometry: SphereGeometry;
  private readonly baseMaterial: MeshBasicMaterial;
  private readonly orbs: GlowOrb[] = [];
  private readonly tmp = new Vector3();
  private readonly sortTmpA = new Vector3();
  private readonly sortTmpB = new Vector3();
  private readonly pendingPetals = new Set<ReturnType<typeof setTimeout>>();

  constructor(
    private readonly pool: ParticlePool,
    private readonly parent?: Object3D,
  ) {
    this.geometry = new SphereGeometry(GLOW_RADIUS, 10, 8);
    this.baseMaterial = new MeshBasicMaterial({
      color: EMBER,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
  }

  /**
   * Micro-célébration générique : poussière + vibration, 1,6 s au total.
   * Le son (note de pondar, clic d'emboîtement) vient de l'AudioDirector.
   */
  celebrate(kind: CelebrationKind, context: CelebrationContext): void {
    const position = this.positionOf(context.at, this.tmp);
    switch (kind) {
      case 'align':
        haptic('snap');
        this.dustWave(position, FX.rotationDust.count * 2);
        break;
      case 'discover':
        haptic('tick');
        this.goldBurst(position, 14);
        break;
      case 'solve':
        haptic('celebrate');
        this.goldBurst(position, 24);
        break;
    }
  }

  /**
   * Fin de chapitre : les tours s'illuminent de la plus lointaine à la plus
   * proche, 250 ms d'écart ; pétales ou étincelles accompagnent chaque tour.
   */
  chapterEnd(
    towers: readonly Object3D[],
    origin: { readonly x: number; readonly y: number; readonly z: number },
  ): void {
    haptic('celebrate');

    // Cascade de la plus lointaine à la plus proche : le regard balaie la
    // vallée vers le joueur, comme un souvenir qui revient.
    const originVector = this.sortTmpA.set(origin.x, origin.y, origin.z);
    const distances = new Map<Object3D, number>();
    for (const tower of towers) {
      tower.getWorldPosition(this.sortTmpB);
      distances.set(tower, this.sortTmpB.distanceToSquared(originVector));
    }
    const ordered = [...towers].sort((a, b) => (distances.get(b) ?? 0) - (distances.get(a) ?? 0));

    const stagger = (FX.illumination.staggerMs / 1000) * motionDurationScale();
    ordered.forEach((tower, index) => {
      tower.getWorldPosition(this.sortTmpB);
      const position = this.sortTmpB.clone();
      this.spawnGlow(position, index * stagger);
      this.spawnPetals(position, index * stagger + 0.3);
    });
  }

  /** Libère les orbes résiduels (changement de niveau). */
  reset(): void {
    for (const timeout of this.pendingPetals) clearTimeout(timeout);
    this.pendingPetals.clear();
    for (const orb of this.orbs) {
      orb.mesh.removeFromParent();
      orb.material.dispose();
    }
    this.orbs.length = 0;
  }

  update(delta: number): void {
    if (this.orbs.length === 0) return;
    const fade = (FX.illumination.glowFadeMs / 1000) * motionDurationScale();

    for (let i = this.orbs.length - 1; i >= 0; i -= 1) {
      const orb = this.orbs[i];
      if (orb === undefined) continue;
      orb.elapsed += delta;
      if (orb.elapsed < orb.delay) continue;

      const t = (orb.elapsed - orb.delay) / Math.max(0.001, fade);
      if (t >= 1) {
        orb.mesh.removeFromParent();
        orb.material.dispose();
        this.orbs.splice(i, 1);
        continue;
      }
      // Naissance rapide, extinction lente : la tour « garde » sa lumière.
      const intensity = t < 0.25 ? t / 0.25 : 1 - (t - 0.25) / 0.75;
      orb.material.opacity = intensity * 0.85;
      orb.mesh.scale.setScalar(0.8 + intensity * 0.7);
    }
  }

  dispose(): void {
    this.reset();
    this.geometry.dispose();
    this.baseMaterial.dispose();
  }

  private positionOf(at: CelebrationContext['at'], out: Vector3): Vector3 {
    if (at instanceof Object3D) return at.getWorldPosition(out);
    return out.set(at.x, at.y, at.z);
  }

  private dustWave(position: Vector3, count: number): void {
    this.pool.emit({
      x: position.x,
      y: position.y + 0.08,
      z: position.z,
      count,
      color: 0x9aa4b5,
      colorEnd: 0x5c6474,
      speed: 0.5,
      speedVariance: 0.25,
      size: 0.085,
      sizeEnd: 0.02,
      lifetime: FX.rotationDust.lifetimeMs / 1000,
      lifetimeVariance: 0.15,
      gravity: -0.25,
      drag: 1.1,
      upBias: 0.8,
    });
  }

  private goldBurst(position: Vector3, count: number): void {
    this.pool.emit({
      x: position.x,
      y: position.y + 0.1,
      z: position.z,
      count,
      color: EMBER,
      colorEnd: 0x8a5a1c,
      speed: 0.75,
      speedVariance: 0.35,
      size: 0.1,
      sizeEnd: 0.02,
      lifetime: PACING.celebrationMs / 1000,
      lifetimeVariance: 0.3,
      gravity: -0.35,
      drag: 0.8,
      upBias: 0.9,
    });
  }

  /** Pétales : retombée lente, rose doré — jamais des confettis de fête. */
  private spawnPetals(position: Vector3, delay: number): void {
    if (typeof setTimeout !== 'function') return;
    const timeout = setTimeout(() => {
      this.pendingPetals.delete(timeout);
      this.pool.emit({
        x: position.x,
        y: position.y + 0.5,
        z: position.z,
        count: 10,
        color: 0xf0c87a,
        colorEnd: 0xb4763a,
        speed: 0.4,
        speedVariance: 0.2,
        size: 0.07,
        sizeEnd: 0.03,
        lifetime: 1.6,
        lifetimeVariance: 0.4,
        gravity: -0.12,
        drag: 0.5,
        upBias: 0.6,
      });
    }, delay * 1000);
    this.pendingPetals.add(timeout);
  }

  /** Orbe de lumière posé sur une tour, né après `delay` secondes. */
  private spawnGlow(position: Vector3, delay: number): void {
    if (this.parent === undefined) return;
    const material = this.baseMaterial.clone();
    material.opacity = 0;
    const mesh = new Mesh(this.geometry, material);
    mesh.name = 'TowerGlow';
    mesh.position.copy(position);
    mesh.position.y += 1.2;
    mesh.scale.setScalar(0.8);
    this.parent.add(mesh);
    this.orbs.push({ mesh, material, elapsed: 0, delay });
  }
}
