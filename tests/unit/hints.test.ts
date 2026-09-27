/**
 * hints.test.ts — indices d'inactivité, sans jamais punir.
 *
 * 90 s sans interaction → lueur ; 180 s → regard de Borz ; toute interaction
 * efface l'indice. Un indice demandé (touche H, appui long) monte d'un palier
 * immédiatement.
 */
import { describe, expect, it } from 'vitest';
import { Hints, type HintStage } from '@fx/Hints';

function harness(): { hints: Hints; stages: HintStage[] } {
  const stages: HintStage[] = [];
  const hints = new Hints(
    { onStage: (stage) => stages.push(stage) },
    90_000, // délais raccourcis pour le test : mêmes seuils relatifs
    180_000,
  );
  return { hints, stages };
}

describe('Hints', () => {
  it('monte à la lueur après 90 s d’inactivité', () => {
    const { hints, stages } = harness();
    hints.update(89_999);
    expect(hints.currentStage).toBe('none');
    hints.update(1);
    expect(hints.currentStage).toBe('glow');
    expect(stages).toEqual(['glow']);
  });

  it('monte au regard après 180 s', () => {
    const { hints } = harness();
    hints.update(90_000);
    hints.update(90_000);
    expect(hints.currentStage).toBe('gaze');
  });

  it('toute interaction repart de zéro et efface l’indice', () => {
    const { hints, stages } = harness();
    hints.update(95_000);
    expect(hints.currentStage).toBe('glow');
    hints.notifyActivity();
    expect(hints.currentStage).toBe('none');
    expect(stages).toEqual(['glow', 'none']);
    // Le compteur a bien rebouclé : il faut reattendre 90 s.
    hints.update(89_000);
    expect(hints.currentStage).toBe('none');
  });

  it('un indice demandé monte d’un palier, puis d’un seul', () => {
    const { hints, stages } = harness();
    expect(hints.request()).toBe('glow');
    expect(hints.request()).toBe('gaze');
    expect(hints.request()).toBe('gaze'); // pas de palier au-delà du regard
    expect(stages).toEqual(['glow', 'gaze', 'gaze']);
  });

  it('reste au palier regard sans redescendre ni remonter', () => {
    const { hints, stages } = harness();
    hints.update(90_000);
    hints.update(90_000);
    expect(hints.currentStage).toBe('gaze');
    hints.update(600_000);
    expect(stages).toEqual(['glow', 'gaze']); // pas de re-déclenchement
  });
});
