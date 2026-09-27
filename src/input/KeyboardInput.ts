/**
 * KeyboardInput.ts — accessibilité clavier (desktop).
 *
 * Le jeu doit être entièrement jouable sans souris : c'est une exigence
 * d'accessibilité, pas un bonus.
 *
 * Tout est lié à `event.code`, c'est-à-dire à la **position physique** de la
 * touche, jamais au caractère imprimé (ADR-023). Conséquence heureuse : WASD
 * en QWERTY et ZQSD en AZERTY sont exactement les mêmes touches physiques,
 * de même que Q/E et A/E pour la rotation. Le jeu marche donc sur les deux
 * dispositions sans rien détecter ni configurer ; la disposition n'est lue
 * (via `navigator.keyboard.getLayoutMap()`) que pour **afficher** le bon
 * libellé dans les réglages.
 *
 * Le remappage complet passera par `bindings`, qui est une donnée — pas un
 * `switch` figé (docs/CONTROLS.md).
 */
import type { EventBus } from '@core/EventBus';
import type { InputAction, InputEvents } from './InputManager';

/** Table par défaut : code physique → intention de jeu. */
export const DEFAULT_BINDINGS: Readonly<Record<string, InputAction>> = {
  // Déplacement : flèches + cluster WASD/ZQSD (mêmes touches physiques).
  ArrowUp: 'moveUp',
  ArrowDown: 'moveDown',
  ArrowLeft: 'moveLeft',
  ArrowRight: 'moveRight',
  KeyW: 'moveUp',
  KeyS: 'moveDown',
  KeyA: 'moveLeft',
  KeyD: 'moveRight',
  // Mécanismes : Tab cycle, Q/E (A/E en AZERTY) tournent.
  Tab: 'cycleNext',
  KeyQ: 'rotateLeft',
  KeyE: 'rotateRight',
  Space: 'confirm',
  Enter: 'confirm',
  Backspace: 'cancel',
  // Confort.
  KeyH: 'hint',
  KeyP: 'pause',
  Escape: 'pause',
  KeyM: 'muteToggle',
  KeyF: 'fullscreenToggle',
};

const MOVE_VECTORS: Readonly<Record<string, readonly [number, number]>> = {
  moveUp: [0, 1],
  moveDown: [0, -1],
  moveLeft: [-1, 0],
  moveRight: [1, 0],
};

/** Actions pour lesquelles on empêche le comportement par défaut du navigateur. */
const PREVENT_DEFAULT = new Set<InputAction>([
  'moveUp',
  'moveDown',
  'moveLeft',
  'moveRight',
  'cycleNext',
  'cyclePrev',
  'confirm',
  'fullscreenToggle',
]);

export class KeyboardInput {
  private bindings: Readonly<Record<string, InputAction>> = DEFAULT_BINDINGS;

  constructor(private readonly bus: EventBus<InputEvents>) {
    window.addEventListener('keydown', this.onKeyDown);
  }

  /** Remappage : une table complète remplace la précédente (réglages). */
  setBindings(bindings: Readonly<Record<string, InputAction>>): void {
    this.bindings = bindings;
  }

  get currentBindings(): Readonly<Record<string, InputAction>> {
    return this.bindings;
  }

  dispose(): void {
    window.removeEventListener('keydown', this.onKeyDown);
  }

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (event.repeat) return;

    const action = this.bindings[event.code];
    if (action === undefined) return;

    // Shift+Tab remonte la sélection : même touche physique, sens inverse.
    const resolved: InputAction = action === 'cycleNext' && event.shiftKey ? 'cyclePrev' : action;

    if (PREVENT_DEFAULT.has(resolved)) event.preventDefault();

    const move = MOVE_VECTORS[resolved];
    if (move) {
      this.bus.emit('move', { dx: move[0], dy: move[1] });
      return;
    }

    switch (resolved) {
      case 'confirm':
        this.bus.emit('confirm', undefined);
        break;
      case 'cancel':
        this.bus.emit('cancel', undefined);
        break;
      case 'pause':
        this.bus.emit('pause', undefined);
        break;
      default:
        this.bus.emit('action', resolved);
        break;
    }
  };
}

/**
 * Libellé à afficher pour une touche physique : « A » sur un clavier AZERTY
 * là où un QWERTY affiche « Q ». Purement cosmétique — le binding, lui, ne
 * change jamais. Retombe sur le code si l'API n'existe pas (Firefox, Safari).
 */
export async function keyLabel(code: string): Promise<string> {
  const keyboard: unknown = (navigator as { keyboard?: unknown }).keyboard;
  const getLayoutMap = (keyboard as { getLayoutMap?: () => Promise<Map<string, string>> })
    ?.getLayoutMap;

  if (typeof getLayoutMap === 'function') {
    try {
      const layout = await getLayoutMap.call(keyboard);
      const label = layout.get(code);
      if (label) return label.toUpperCase();
    } catch {
      // Permissions refusées ou API indisponible : on garde le repli.
    }
  }

  return code.startsWith('Key') ? code.slice(3) : code;
}
