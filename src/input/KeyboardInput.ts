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
 * (via `navigator.keyboard.getLayoutMap()` ou l'observation des frappes) que
 * pour **afficher** le bon libellé dans les réglages.
 *
 * Le remappage passe par `bindings`, une donnée (`Record<code, InputAction>`)
 * persistée sous `bov.settings.v1` — jamais un `switch` figé.
 */
import type { EventBus } from '@core/EventBus';
import { fallbackKeyLabel, keyLayout } from './KeyLayout';
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
  'cancel',
  'fullscreenToggle',
]);

/** Cible d'écoute minimale, injectable pour les tests. */
export interface KeyboardTarget {
  addEventListener(type: string, listener: (event: KeyboardEvent) => void): void;
  removeEventListener(type: string, listener: (event: KeyboardEvent) => void): void;
}

function defaultTarget(): KeyboardTarget {
  // Le code doit pouvoir s'exécuter hors navigateur (tests Node, worker).
  if (typeof window === 'undefined') return noopTarget;
  return window;
}

const noopTarget: KeyboardTarget = {
  addEventListener: () => undefined,
  removeEventListener: () => undefined,
};

/** Une frappe dans un champ de saisie appartient à l'UI, jamais au jeu. */
function isEditableTarget(target: EventTarget | null): boolean {
  if (typeof HTMLInputElement === 'undefined') return false;
  if (target instanceof HTMLInputElement) return true;
  if (typeof HTMLTextAreaElement === 'undefined') return false;
  if (target instanceof HTMLTextAreaElement) return true;
  if (typeof HTMLElement === 'undefined' || !(target instanceof HTMLElement)) return false;
  return target.isContentEditable;
}

export class KeyboardInput {
  private bindings: Readonly<Record<string, InputAction>> = DEFAULT_BINDINGS;

  constructor(
    private readonly bus: EventBus<InputEvents>,
    private readonly target: KeyboardTarget = defaultTarget(),
  ) {
    this.target.addEventListener('keydown', this.onKeyDown);
  }

  /** Remappage : une table complète remplace la précédente (réglages). */
  setBindings(bindings: Readonly<Record<string, InputAction>>): void {
    this.bindings = bindings;
  }

  /** Bouton « rétablir les touches par défaut » des réglages. */
  resetBindings(): void {
    this.bindings = DEFAULT_BINDINGS;
  }

  get currentBindings(): Readonly<Record<string, InputAction>> {
    return this.bindings;
  }

  dispose(): void {
    this.target.removeEventListener('keydown', this.onKeyDown);
  }

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (event.repeat) return;
    if (isEditableTarget(event.target)) return;

    // La disposition n'est observée que pour l'affichage des libellés (§ 2.2).
    keyLayout.observe({ code: event.code, key: event.key });

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

const CODE_PATTERN = /^[A-Za-z][A-Za-z0-9]*$/;

/**
 * Valide une table de bindings chargée du stockage : ne conserve que les
 * codes plausibles et les intentions connues, ignore le reste sans erreur.
 * Retourne `null` si rien n'est exploitable — on garde alors les défauts.
 */
export function sanitizeBindings(
  raw: unknown,
  knownActions: readonly InputAction[],
): Readonly<Record<string, InputAction>> | null {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null;
  const actions = new Set<string>(knownActions);
  const kept: Record<string, InputAction> = {};

  for (const [code, action] of Object.entries(raw)) {
    if (!CODE_PATTERN.test(code)) continue;
    if (typeof action !== 'string' || !actions.has(action)) continue;
    kept[code] = action as InputAction;
  }

  return Object.keys(kept).length > 0 ? kept : null;
}

/**
 * Libellé à afficher pour une touche physique : « A » sur un clavier AZERTY
 * là où un QWERTY affiche « Q ». Purement cosmétique — le binding, lui, ne
 * change jamais. Ordre de repli : `navigator.keyboard.getLayoutMap()`
 * (Chrome), frappes observées (Firefox, Safari), puis le code QWERTY.
 */
export async function keyLabel(code: string): Promise<string> {
  const keyboard: unknown =
    typeof navigator === 'undefined' ? undefined : (navigator as { keyboard?: unknown }).keyboard;
  const getLayoutMap = (keyboard as { getLayoutMap?: () => Promise<Map<string, string>> })
    ?.getLayoutMap;

  if (typeof getLayoutMap === 'function') {
    try {
      const layout = await getLayoutMap.call(keyboard);
      const label = layout.get(code);
      if (label) return label.toUpperCase();
    } catch {
      // Permissions refusées ou API indisponible : on passe au repli.
    }
  }

  const observed = keyLayout.labelFor(code);
  return observed.length > 0 ? observed : fallbackKeyLabel(code);
}
