/**
 * InputManager.ts — point d'entrée unique des commandes du joueur.
 *
 * Doctrine : le gameplay ne connaît ni la souris, ni le doigt, ni le clavier.
 * Il connaît des *intentions* : « aller à ce point », « actionner ce
 * mécanisme », « faire une pause ». Chaque périphérique traduit ses
 * événements en intentions. Ajouter une manette (ou Capacitor demain) ne
 * touche donc jamais au jeu lui-même.
 */
import { EventBus, type EventMap } from '@core/EventBus';
import { KeyboardInput } from './KeyboardInput';
import { PointerInput } from './PointerInput';
import { GamepadInput } from './GamepadInput';

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

export interface InputEvents extends EventMap {
  tap: PointerIntent;
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

  constructor(private readonly element: HTMLElement) {
    super();
    this.pointer = new PointerInput(this.element, this);
    this.keyboard = new KeyboardInput(this);
    this.gamepad = new GamepadInput(this);
  }

  /** Doit être appelé chaque image : la manette se sonde, elle n'émet pas. */
  update(): void {
    this.gamepad.poll();
  }

  dispose(): void {
    this.pointer.dispose();
    this.keyboard.dispose();
    this.gamepad.dispose();
    this.clear();
  }
}
