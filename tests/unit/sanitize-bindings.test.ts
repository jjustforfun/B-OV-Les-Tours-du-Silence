/**
 * sanitize-bindings.test.ts — validation des bindings chargés du stockage.
 *
 * Le remappage est physique (`KeyboardEvent.code`) : on ne conserve que les
 * codes plausibles et les intentions connues, le reste est jeté sans erreur.
 * `null` si rien n'est exploitable — on garde alors les défauts.
 */
import { describe, expect, it } from 'vitest';
import { INPUT_ACTIONS } from '@input/InputManager';
import { sanitizeBindings } from '@input/KeyboardInput';

describe('sanitizeBindings', () => {
  it('conserve les codes plausibles et les intentions connues', () => {
    const kept = sanitizeBindings({ KeyW: 'moveUp', Space: 'confirm' }, INPUT_ACTIONS);
    expect(kept).toEqual({ KeyW: 'moveUp', Space: 'confirm' });
  });

  it('jette les codes mal formés et les intentions inconnues', () => {
    const kept = sanitizeBindings(
      {
        'bad-code!': 'moveUp',
        '123': 'confirm',
        KeyX: 'teleport', // intention inconnue
        KeyY: 42, // pas une chaîne
      },
      INPUT_ACTIONS,
    );
    expect(kept).toBeNull();
  });

  it('garde le bon et jette le mauvais dans une même table', () => {
    const kept = sanitizeBindings({ KeyW: 'moveUp', '??': 'confirm', KeyE: 'nope' }, INPUT_ACTIONS);
    expect(kept).toEqual({ KeyW: 'moveUp' });
  });

  it('retourne null sur tout ce qui n’est pas un objet de bindings', () => {
    expect(sanitizeBindings(null, INPUT_ACTIONS)).toBeNull();
    expect(sanitizeBindings('KeyW', INPUT_ACTIONS)).toBeNull();
    expect(sanitizeBindings(['KeyW'], INPUT_ACTIONS)).toBeNull();
    expect(sanitizeBindings({}, INPUT_ACTIONS)).toBeNull();
  });

  it('n’accepte que des intentions de la liste fournie', () => {
    expect(sanitizeBindings({ KeyW: 'moveUp' }, ['confirm'])).toBeNull();
    expect(sanitizeBindings({ KeyW: 'confirm' }, ['confirm'])).toEqual({ KeyW: 'confirm' });
  });
});
