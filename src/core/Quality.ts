/**
 * Quality.ts — détection et adaptation du niveau de qualité.
 *
 * Doctrine : on vise 60 fps partout. Plutôt que de deviner le matériel, on
 * part d'une estimation prudente puis on observe le vrai framerate et on
 * ajuste — sans jamais faire clignoter l'image (fenêtre d'observation longue,
 * hystérésis entre descente et remontée).
 */
import {
  PERF,
  QUALITY_PRESETS,
  QUALITY_TIERS,
  type QualitySettings,
  type QualityTier,
} from '@/config';

export interface DeviceProfile {
  readonly isMobile: boolean;
  readonly isCoarsePointer: boolean;
  readonly devicePixelRatio: number;
  readonly hardwareConcurrency: number;
  readonly prefersReducedMotion: boolean;
}

export function readDeviceProfile(): DeviceProfile {
  const matches = (query: string): boolean =>
    typeof matchMedia === 'function' ? matchMedia(query).matches : false;

  return {
    isMobile: matches('(pointer: coarse)') && matches('(max-width: 1024px)'),
    isCoarsePointer: matches('(pointer: coarse)'),
    devicePixelRatio: typeof devicePixelRatio === 'number' ? devicePixelRatio : 1,
    hardwareConcurrency:
      typeof navigator === 'undefined' ? 4 : (navigator.hardwareConcurrency ?? 4),
    prefersReducedMotion: matches('(prefers-reduced-motion: reduce)'),
  };
}

/** Estimation initiale, délibérément conservatrice sur mobile. */
export function guessInitialTier(profile: DeviceProfile): QualityTier {
  if (profile.isMobile) {
    return profile.hardwareConcurrency >= 8 ? 'medium' : 'low';
  }
  return profile.hardwareConcurrency >= 8 ? 'high' : 'medium';
}

export type QualityChangeReason = 'initial' | 'auto-downgrade' | 'auto-upgrade' | 'user';

export class Quality {
  readonly profile: DeviceProfile;

  private tier: QualityTier;
  private locked = false;
  private windowMs = 0;
  private fpsSum = 0;
  private fpsSamples = 0;
  private listeners = new Set<(tier: QualityTier, reason: QualityChangeReason) => void>();

  constructor(profile: DeviceProfile = readDeviceProfile()) {
    this.profile = profile;
    this.tier = guessInitialTier(profile);
  }

  get current(): QualityTier {
    return this.tier;
  }

  /**
   * Réglages effectifs du tier courant.
   *
   * Règle dure (AGENTS.md § 6, ADR-022) : **aucune shadow map dynamique sur
   * mobile**, quel que soit le tier. Le coût (une passe de rendu complète par
   * image) ne se justifie jamais sur un GPU mobile ; l'occlusion y est rendue
   * par AO de sommets et ombres blob, qui coûtent zéro passe.
   */
  get settings(): QualitySettings {
    const preset = QUALITY_PRESETS[this.tier];
    if (!this.profile.isMobile) return preset;
    return { ...preset, shadows: false };
  }

  /** Empêche l'adaptation automatique (réglage manuel du joueur). */
  setTier(tier: QualityTier, reason: QualityChangeReason = 'user'): void {
    if (reason === 'user') this.locked = true;
    if (tier === this.tier) return;
    this.tier = tier;
    for (const listener of this.listeners) listener(tier, reason);
  }

  /**
   * Rend la main à l'adaptation automatique (réglage « Qualité : Auto »,
   * ADR-013). Le tier courant est conservé comme point de départ.
   */
  setAuto(): void {
    if (!this.locked) return;
    this.locked = false;
    this.windowMs = 0;
    this.fpsSum = 0;
    this.fpsSamples = 0;
  }

  get isLocked(): boolean {
    return this.locked;
  }

  onChange(listener: (tier: QualityTier, reason: QualityChangeReason) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Alimente l'observateur de framerate. À appeler chaque image. */
  sample(fps: number, deltaMs: number): void {
    if (this.locked || fps <= 0) return;

    this.fpsSum += fps;
    this.fpsSamples += 1;
    this.windowMs += deltaMs;
    if (this.windowMs < PERF.adaptWindowMs) return;

    const average = this.fpsSum / Math.max(this.fpsSamples, 1);
    this.windowMs = 0;
    this.fpsSum = 0;
    this.fpsSamples = 0;

    const index = QUALITY_TIERS.indexOf(this.tier);
    if (average < PERF.downgradeFps && index > 0) {
      const next = QUALITY_TIERS[index - 1];
      if (next) this.applyAuto(next, 'auto-downgrade');
    } else if (average > PERF.upgradeFps && index < QUALITY_TIERS.length - 1) {
      const next = QUALITY_TIERS[index + 1];
      if (next) this.applyAuto(next, 'auto-upgrade');
    }
  }

  private applyAuto(tier: QualityTier, reason: QualityChangeReason): void {
    this.tier = tier;
    for (const listener of this.listeners) listener(tier, reason);
  }
}
