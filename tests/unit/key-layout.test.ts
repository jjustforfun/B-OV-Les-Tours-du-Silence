/**
 * key-layout.test.ts — détection AZERTY par les touches physiques.
 *
 * docs/CONTROLS.md § 4 : les bindings sont **physiques** (`KeyboardEvent.code`)
 * et ne changent jamais ; seule l'étiquette affichée suit le clavier. Deux
 * signatures concordantes suffisent à reconnaître un AZERTY — une seule ne
 * suffit pas (raccourci système, clavier exotique).
 */
import { describe, expect, it } from 'vitest';
import { KeyLayout, fallbackKeyLabel } from '@input/KeyLayout';

describe('KeyLayout', () => {
  it('reste « unknown » avec une seule signature', () => {
    const layout = new KeyLayout();
    layout.observe({ code: 'KeyQ', key: 'a' });
    expect(layout.layout).toBe('unknown');
    expect(layout.labelFor('KeyA')).toBe('A'); // repli QWERTY du code
  });

  it('reconnaît l’AZERTY avec deux signatures concordantes', () => {
    const layout = new KeyLayout();
    layout.observe({ code: 'KeyQ', key: 'a' });
    layout.observe({ code: 'KeyW', key: 'z' });
    expect(layout.layout).toBe('azerty');
    // La table de la disposition prend le relais pour les touches non frappées.
    expect(layout.labelFor('KeyA')).toBe('Q');
    expect(layout.labelFor('Semicolon')).toBe('M');
    expect(layout.labelFor('KeyM')).toBe(',');
  });

  it('l’observation réelle prime sur toute table', () => {
    const layout = new KeyLayout();
    layout.observe({ code: 'KeyQ', key: 'a' });
    layout.observe({ code: 'KeyW', key: 'z' });
    layout.observe({ code: 'KeyZ', key: 'w' });
    expect(layout.labelFor('KeyZ')).toBe('W'); // caractère observé, en majuscule
  });

  it('ignore les touches mortes et les modificateurs', () => {
    const layout = new KeyLayout();
    layout.observe({ code: 'KeyQ', key: 'Dead' });
    layout.observe({ code: 'KeyW', key: 'Shift' });
    layout.observe({ code: 'KeyA', key: 'AltGraph' });
    expect(layout.layout).toBe('unknown');
  });

  it('reset repart de zéro', () => {
    const layout = new KeyLayout();
    layout.observe({ code: 'KeyQ', key: 'a' });
    layout.observe({ code: 'KeyW', key: 'z' });
    layout.reset();
    expect(layout.layout).toBe('unknown');
    expect(layout.labelFor('KeyA')).toBe('A');
  });
});

describe('fallbackKeyLabel', () => {
  it('décode les codes usuels', () => {
    expect(fallbackKeyLabel('KeyP')).toBe('P');
    expect(fallbackKeyLabel('Digit3')).toBe('3');
    expect(fallbackKeyLabel('ArrowUp')).toBe('↑');
    expect(fallbackKeyLabel('Space')).toBe('Espace');
    expect(fallbackKeyLabel('Escape')).toBe('Échap');
    expect(fallbackKeyLabel('MediaPlay')).toBe('MediaPlay'); // inconnu : le code brut
  });
});
