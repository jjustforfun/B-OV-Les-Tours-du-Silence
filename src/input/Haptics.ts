/**
 * Haptics.ts — retour haptique, discret par nature.
 *
 * Le toucher fait partie de la récompense : une pierre qui s'emboîte se
 * *sent*. Trois motifs seulement, tous très courts — une vibration trop
 * longue est agressive, et le jeu ne l'est jamais. Passe par Platform pour
 * que Capacitor puisse prendre le relais sur Android.
 */
import { platform } from '@platform/Platform';

export type HapticPattern = 'tick' | 'snap' | 'celebrate';

const PATTERNS: Readonly<Record<HapticPattern, readonly number[]>> = {
  /** Sélection d'un nœud. */
  tick: [8],
  /** Un mécanisme arrive en position. */
  snap: [14, 30, 10],
  /** Niveau résolu. */
  celebrate: [10, 40, 12, 40, 18],
};

let enabled = true;

export function setHapticsEnabled(value: boolean): void {
  enabled = value;
}

export function isHapticsEnabled(): boolean {
  return enabled;
}

export function haptic(pattern: HapticPattern): void {
  if (!enabled) return;
  platform.vibrate(PATTERNS[pattern]);
}
