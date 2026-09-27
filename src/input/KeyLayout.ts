/**
 * KeyLayout.ts — détection paresseuse de la disposition clavier.
 *
 * Le jeu se joue sur `event.code` (position physique, ADR-023) : AZERTY et
 * QWERTY fonctionnent sans rien détecter. La disposition ne sert qu'à
 * **afficher** le bon libellé dans les réglages (« A » là où un QWERTY
 * affiche « Q »).
 *
 * `navigator.keyboard.getLayoutMap()` n'existe ni sur Firefox ni sur Safari :
 * en repli, on observe les touches réellement pressées — quand la touche
 * physique `KeyQ` produit le caractère « a », le clavier est un AZERTY. La
 * détection s'affine à chaque frappe et ne devine jamais : sans observation,
 * on reste sur le libellé QWERTY du code.
 */

/** Dispositions que l'on sait distinguer par observation. */
export type KeyboardLayoutName = 'qwerty' | 'azerty' | 'unknown';

/** Couple (code physique → caractère produit) observé sur une frappe. */
export interface KeyObservation {
  readonly code: string;
  readonly key: string;
}

/**
 * Signatures minimales : sur un AZERTY, ces touches physiques produisent ces
 * caractères. Deux indices concordants suffisent — un seul ne suffit pas, car
 * un raccourci système ou un clavier exotique peut produire un faux positif.
 */
const AZERTY_SIGNATURES: readonly (readonly [code: string, key: string])[] = [
  ['KeyQ', 'a'],
  ['KeyW', 'z'],
  ['KeyA', 'q'],
  ['KeyZ', 'w'],
  ['Semicolon', 'm'],
  ['KeyM', ','],
];

/** Libellés de repli pour les codes les plus affichés, par disposition. */
const LABELS: Readonly<Record<Exclude<KeyboardLayoutName, 'unknown'>, Record<string, string>>> = {
  qwerty: {},
  azerty: {
    KeyQ: 'A',
    KeyW: 'Z',
    KeyA: 'Q',
    KeyZ: 'W',
    Semicolon: 'M',
    KeyM: ',',
  },
};

/** Libellé par défaut d'un code physique quand on ne sait rien de mieux. */
export function fallbackKeyLabel(code: string): string {
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  const named: Record<string, string> = {
    ArrowUp: '↑',
    ArrowDown: '↓',
    ArrowLeft: '←',
    ArrowRight: '→',
    Space: 'Espace',
    Enter: 'Entrée',
    Backspace: 'Retour',
    Escape: 'Échap',
    Tab: 'Tab',
  };
  return named[code] ?? code;
}

export class KeyLayout {
  private readonly observed = new Map<string, string>();
  private azertyVotes = 0;

  get layout(): KeyboardLayoutName {
    return this.azertyVotes >= 2 ? 'azerty' : 'unknown';
  }

  /** Nourrit la détection avec une frappe réelle. Ignore les touches mortes. */
  observe(observation: KeyObservation): void {
    const produced = observation.key;
    if (produced.length !== 1) return; // 'Shift', 'Dead', 'AltGraph'… : rien à apprendre.
    const known = this.observed.get(observation.code);
    if (known === produced) return;
    this.observed.set(observation.code, produced);
    this.rescan();
  }

  /**
   * Libellé à afficher pour un code physique : le caractère réellement observé
   * en priorité, puis la table de la disposition détectée, puis le repli
   * QWERTY du code — qui reste correct sur un clavier non identifié.
   */
  labelFor(code: string): string {
    const observed = this.observed.get(code);
    if (observed !== undefined) return observed.toUpperCase();
    const layout = this.layout;
    if (layout !== 'unknown') {
      const mapped = LABELS[layout][code];
      if (mapped !== undefined) return mapped;
    }
    return fallbackKeyLabel(code);
  }

  reset(): void {
    this.observed.clear();
    this.azertyVotes = 0;
  }

  private rescan(): void {
    let votes = 0;
    for (const [code, key] of AZERTY_SIGNATURES) {
      if (this.observed.get(code) === key) votes += 1;
    }
    this.azertyVotes = votes;
  }
}

/** Instance partagée, alimentée par KeyboardInput à chaque frappe. */
export const keyLayout = new KeyLayout();
