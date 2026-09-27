/**
 * InputManager.ts — point d'entrée unique des commandes du joueur.
 *
 * Doctrine : le gameplay ne connaît ni la souris, ni le doigt, ni le clavier.
 * Il connaît des *intentions* : « aller à ce point », « actionner ce
 * mécanisme », « faire une pause ». Chaque périphérique traduit ses
 * événements en intentions. Ajouter une manette (ou Capacitor demain) ne
 * touche donc jamais au jeu lui-même.
 *
 * Responsabilités supplémentaires, hors traduction des gestes :
 *  - verrouiller les gestes navigateur sur le canvas (`GestureLock`) ;
 *  - offrir un crochet « premier geste » (déverrouillage audio, ADR-007) ;
 *  - porter le remappage clavier et sa persistance (docs/CONTROLS.md § 2.4).
 */
import { EventBus, type EventMap } from '@core/EventBus';
import { platform } from '@platform/Platform';
import { SettingsStore, type SettingsStorage } from '@save/SettingsStore';
import { GamepadInput } from './GamepadInput';
import { GestureLock, type GestureLockTarget } from './GestureLock';
import { KeyboardInput, sanitizeBindings } from './KeyboardInput';
import { PointerInput } from './PointerInput';

export interface PointerIntent {
  readonly x: number;
  readonly y: number;
  /** Normalisé dans [-1, 1] pour le raycasting. */
  readonly ndcX: number;
  readonly ndcY: number;
}

export interface DragIntent extends PointerIntent {
  readonly deltaX: number;
  readonly deltaY: number;
}

/**
 * Intentions atomiques du joueur, indépendantes du périphérique. Le clavier
 * les produit par remappage (docs/CONTROLS.md), la manette par ses boutons,
 * l'UI par ses boutons tactiles.
 */
export type InputAction =
  | 'moveUp'
  | 'moveDown'
  | 'moveLeft'
  | 'moveRight'
  | 'cycleNext'
  | 'cyclePrev'
  | 'rotateLeft'
  | 'rotateRight'
  | 'confirm'
  | 'cancel'
  | 'hint'
  | 'pause'
  | 'muteToggle'
  | 'fullscreenToggle';

/** Toutes les intentions connues — borne la validation du remappage. */
export const INPUT_ACTIONS: readonly InputAction[] = [
  'moveUp',
  'moveDown',
  'moveLeft',
  'moveRight',
  'cycleNext',
  'cyclePrev',
  'rotateLeft',
  'rotateRight',
  'confirm',
  'cancel',
  'hint',
  'pause',
  'muteToggle',
  'fullscreenToggle',
];

export interface InputEvents extends EventMap {
  tap: PointerIntent;
  /** Appui long (1,2 s) sans glissement : demande d'indice. */
  longPress: PointerIntent;
  dragStart: PointerIntent;
  drag: DragIntent;
  dragEnd: DragIntent;
  pause: undefined;
  /** Direction cardinale au clavier / à la manette. */
  move: { readonly dx: number; readonly dy: number };
  confirm: undefined;
  cancel: undefined;
  /** Toute intention qui n'a pas d'événement dédié (indice, muet, plein écran…). */
  action: InputAction;
}

export class InputManager extends EventBus<InputEvents> {
  private readonly pointer: PointerInput;
  private readonly keyboard: KeyboardInput;
  private readonly gamepad: GamepadInput;
  private readonly gestureLock: GestureLock;
  private readonly store: SettingsStore;

  constructor(
    private readonly element: HTMLElement & GestureLockTarget,
    storage: SettingsStorage = platform,
  ) {
    super();
    this.store = new SettingsStore(storage);
    this.pointer = new PointerInput(this.element, this);
    this.keyboard = new KeyboardInput(this);
    this.gamepad = new GamepadInput(this);
    this.gestureLock = new GestureLock(this.element);
  }

  /** Doit être appelé chaque image : la manette se sonde, elle n'émet pas. */
  update(): void {
    this.gamepad.poll();
  }

  /**
   * Enregistre un appel au tout premier geste du joueur — pointer down ou
   * touche. C'est le crochet du déverrouillage audio (docs/AUDIO.md § 6) :
   * le silence d'ouverture n'est rompu que par une action volontaire.
   * Retourne la fonction de désabonnement.
   */
  onFirstGesture(listener: () => void): () => void {
    const fireOnce = (): void => {
      detach();
      listener();
    };
    const onKeyDown = (event: Event): void => {
      if ((event as KeyboardEvent).repeat === true) return;
      fireOnce();
    };
    const onPointerDown = (): void => fireOnce();

    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', onKeyDown);
      this.element.addEventListener('pointerdown', onPointerDown);
    }

    const detach = (): void => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('keydown', onKeyDown);
        this.element.removeEventListener('pointerdown', onPointerDown);
      }
    };

    return detach;
  }

  /** Remappage complet : remplace la table du clavier (réglages). */
  setBindings(bindings: Readonly<Record<string, InputAction>>): void {
    this.keyboard.setBindings(bindings);
  }

  get currentBindings(): Readonly<Record<string, InputAction>> {
    return this.keyboard.currentBindings;
  }

  /** Bouton « rétablir les touches par défaut » : applique et persiste. */
  async resetBindings(): Promise<void> {
    this.keyboard.resetBindings();
    await this.store.saveBindings(this.keyboard.currentBindings);
  }

  /** Charge et applique la table persistée, si elle est exploitable. */
  async loadPersistedBindings(): Promise<boolean> {
    const stored = await this.store.load();
    const sanitized = sanitizeBindings(stored.bindings, INPUT_ACTIONS);
    if (sanitized === null) return false;
    this.keyboard.setBindings(sanitized);
    return true;
  }

  /** Persistance de la table courante (appelée par les réglages). */
  async persistBindings(): Promise<void> {
    await this.store.saveBindings(this.keyboard.currentBindings);
  }

  get settingsStore(): SettingsStore {
    return this.store;
  }

  dispose(): void {
    this.gestureLock.dispose();
    this.pointer.dispose();
    this.keyboard.dispose();
    this.gamepad.dispose();
    this.clear();
  }
}
