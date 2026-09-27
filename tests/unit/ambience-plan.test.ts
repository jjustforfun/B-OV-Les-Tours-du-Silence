/**
 * ambience-plan.test.ts — plan d'ambiance d'un lieu (docs/AUDIO.md § 2).
 *
 * Le vent est le socle de tous les lieux ; les périodes de modulation sont
 * premières entre elles (aucune super-période audible) ; la déclaration du
 * niveau prime sur la table par chapitre.
 */
import { describe, expect, it } from 'vitest';
import {
  AMBIENCE_LAYER_NAMES,
  PRIME_PERIODS,
  ambienceLayerGainDb,
  nextEventDelay,
  resolveAmbienceLayers,
} from '@audio/ambiencePlan';

describe('resolveAmbienceLayers', () => {
  it('applique le plan par défaut du chapitre', () => {
    expect(resolveAmbienceLayers(0)).toEqual(['wind', 'eagle', 'stone']);
    expect(resolveAmbienceLayers(2)).toEqual(['wind', 'river']);
    expect(resolveAmbienceLayers(4)).toEqual(['wind', 'river']);
    expect(resolveAmbienceLayers(1)).toEqual(['wind', 'bells', 'fire']);
  });

  it('la déclaration du niveau prime', () => {
    expect(resolveAmbienceLayers(0, ['river', 'fire'])).toEqual(['wind', 'river', 'fire']);
  });

  it('force le vent : un lieu sans vent n’existe pas', () => {
    expect(resolveAmbienceLayers(3, ['bells'])).toEqual(['wind', 'bells']);
  });

  it('ignore les couches inconnues sans erreur', () => {
    expect(resolveAmbienceLayers(0, ['river', 'volcano', 'eagle'])).toEqual([
      'wind',
      'river',
      'eagle',
    ]);
  });

  it('retombe sur le plan du chapitre si la déclaration est vide', () => {
    expect(resolveAmbienceLayers(5, [])).toEqual(['wind', 'eagle', 'stone']);
  });
});

describe('PRIME_PERIODS', () => {
  it('sont premières entre elles', () => {
    const periods = AMBIENCE_LAYER_NAMES.map((name) => PRIME_PERIODS[name]);
    const primes = new Set([7, 11, 13, 17, 19, 23, 29, 31]);
    for (const period of periods) expect(primes.has(period)).toBe(true);
    // Deux couches peuvent partager une période (stone/aigle 17 s) mais la
    // plupart diffèrent : pas de super-période globale.
    expect(new Set(periods).size).toBeGreaterThanOrEqual(5);
  });
});

describe('ambienceLayerGainDb', () => {
  it('monte le vent de 6 dB en altitude (chapitre 6)', () => {
    expect(ambienceLayerGainDb('wind', 6)).toBe(-14);
    expect(ambienceLayerGainDb('wind', 0)).toBe(-20);
  });

  it('place les cloches au loin et la pierre tout au fond', () => {
    expect(ambienceLayerGainDb('bells', 1)).toBe(-26);
    expect(ambienceLayerGainDb('stone', 0)).toBe(-28);
  });
});

describe('nextEventDelay', () => {
  it('respecte les fenêtres : cloches 12–30 s, aigle 45–120 s', () => {
    expect(nextEventDelay('bells', () => 0)).toBe(12);
    expect(nextEventDelay('bells', () => 1)).toBeCloseTo(30, 9);
    expect(nextEventDelay('eagle', () => 0)).toBe(45);
    expect(nextEventDelay('eagle', () => 1)).toBeCloseTo(120, 9);
  });
});
