/**
 * mixing.ts — correspondance curseur → décibels, en pur.
 *
 * docs/AUDIO.md § 1 donne deux tables qui ne sont pas linéaires l'une envers
 * l'autre : les curseurs par défaut (master 0,9 · music 0,7 · ambience 0,6 ·
 * sfx 0,85) et les gains nominaux du mix (0 · −9 · −14 · −6 dB). Lecture
 * retenue (ADR-025) : le gain nominal est celui du curseur par défaut, et le
 * curseur atténue ou amplifie **autour**, en décibels. Master seul reste
 * linéaire (0,9 → −0,9 dB), comme un vrai master.
 */
import { AUDIO } from '@/config';

export type AudioChannel = 'master' | 'music' | 'ambience' | 'sfx';

export const DEFAULT_VOLUMES: Readonly<Record<AudioChannel, number>> = AUDIO.volumes;

/** dB effectifs d'un bus pour une valeur de curseur (0 = silence). */
export function busGainDb(channel: Exclude<AudioChannel, 'master'>, slider: number): number {
  if (slider <= 0) return Number.NEGATIVE_INFINITY;
  const nominal = AUDIO.busNominalDb[channel];
  const reference = DEFAULT_VOLUMES[channel];
  return nominal + 20 * Math.log10(Math.min(Math.max(slider, 0.0001), 1) / reference);
}

/** Le master est un vrai master : linéaire vers dB. */
export function masterGainDb(slider: number): number {
  if (slider <= 0) return Number.NEGATIVE_INFINITY;
  return 20 * Math.log10(Math.min(slider, 1));
}

/** Atténuation de ducking d'un bus (docs/AUDIO.md § 6). */
export function duckOffsetDb(channel: 'music' | 'ambience', ducked: boolean): number {
  if (!ducked) return 0;
  return channel === 'music' ? AUDIO.duck.musicDb : AUDIO.duck.ambienceDb;
}
