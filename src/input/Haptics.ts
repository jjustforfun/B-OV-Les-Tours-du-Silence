/**
 * Haptics.ts — retour haptique, discret par nature.
 *
 * Le toucher fait partie de la récompense : une pierre qui s'emboîte se
 * *sent*. Trois motifs seulement, tous très courts — une vibration trop
 * longue est agressive, et le jeu ne l'est jamais.
 *
 * Deux canaux, une seule API : `Platform.vibrate` sur mobile (Capacitor
 * demain), `gamepad.vibrationActuator` sur manette (Chrome) quand il existe.
 * Tout passe par Platform côté mobile pour que le portage Android ne touche
 * qu'à ce fichier (docs/ANDROID_PORT.md).
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

/** Traduction dual-rumble d'un motif : [durée forte, pause, durée faible]… */
const RUMBLE: Readonly<Record<HapticPattern, readonly number[]>> = {
  tick: [8],
  snap: [14, 30, 10],
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
  rumbleGamepad(pattern);
}

/** Fait vibrer la première manette connectée, si elle sait le faire. */
function rumbleGamepad(pattern: HapticPattern): void {
  if (typeof navigator === 'undefined' || typeof navigator.getGamepads !== 'function') return;

  const pads = navigator.getGamepads();
  for (const pad of pads) {
    if (pad === null) continue;
    const actuator = (
      pad as {
        vibrationActuator?: {
          playEffect: (type: string, options: GamepadEffectParameters) => Promise<string>;
        };
      }
    ).vibrationActuator;
    if (actuator === undefined) continue;

    const durations = RUMBLE[pattern];
    let offset = 0;
    for (let i = 0; i < durations.length; i += 2) {
      const strong = durations[i] ?? 0;
      const pause = durations[i + 1] ?? 0;
      const startAt = offset;
      // Les motifs alternent par paires (forte, faible) espacées de pauses.
      void actuator
        .playEffect('dual-rumble', {
          // GamepadEffectParameters exprime délai et durée en millisecondes.
          startDelay: startAt,
          duration: strong,
          strongMagnitude: i % 4 === 0 ? 0.6 : 0,
          weakMagnitude: i % 4 === 0 ? 0 : 0.6,
        })
        .catch(() => {
          /* Une manette qui refuse de vibrer n'est jamais une erreur de jeu. */
        });
      offset = startAt + strong + pause;
    }
    return; // Une seule manette : celle du premier joueur.
  }
}
