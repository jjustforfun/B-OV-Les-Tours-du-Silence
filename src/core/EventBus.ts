/**
 * EventBus.ts — bus d'événements typé, sans dépendance.
 *
 * Tout le jeu communique par messages : l'UI ne connaît pas le moteur,
 * l'audio ne connaît pas le gameplay. C'est ce découplage qui rendra le
 * portage Capacitor (et les tests) indolores.
 */

export type EventMap = Record<string, unknown>;

export type Listener<T> = (payload: T) => void;

export class EventBus<E extends EventMap> {
  private readonly listeners = new Map<keyof E, Set<Listener<unknown>>>();

  /** Abonne un écouteur. Retourne la fonction de désabonnement. */
  on<K extends keyof E>(event: K, listener: Listener<E[K]>): () => void {
    let set = this.listeners.get(event);
    if (!set) {
      set = new Set();
      this.listeners.set(event, set);
    }
    set.add(listener as Listener<unknown>);
    return () => this.off(event, listener);
  }

  /** Abonne un écouteur qui se retire après le premier message. */
  once<K extends keyof E>(event: K, listener: Listener<E[K]>): () => void {
    const off = this.on(event, (payload) => {
      off();
      listener(payload);
    });
    return off;
  }

  off<K extends keyof E>(event: K, listener: Listener<E[K]>): void {
    const set = this.listeners.get(event);
    if (!set) return;
    set.delete(listener as Listener<unknown>);
    if (set.size === 0) this.listeners.delete(event);
  }

  emit<K extends keyof E>(event: K, payload: E[K]): void {
    const set = this.listeners.get(event);
    if (!set) return;
    // Copie défensive : un écouteur peut se désabonner pendant l'émission.
    for (const listener of [...set]) {
      (listener as Listener<E[K]>)(payload);
    }
  }

  listenerCount<K extends keyof E>(event: K): number {
    return this.listeners.get(event)?.size ?? 0;
  }

  clear(): void {
    this.listeners.clear();
  }
}

/** Événements globaux du jeu. Cette carte grandira chapitre après chapitre. */
export interface GameEvents extends EventMap {
  'engine:ready': { readonly renderer: string };
  'engine:resize': { readonly width: number; readonly height: number };
  'engine:quality': { readonly tier: string; readonly reason: string };
  'game:pause': { readonly paused: boolean };
  'level:loaded': {
    readonly id: string;
    readonly chapter?: number;
    readonly ambience?: readonly string[];
  };
  'level:solved': {
    readonly id: string;
    readonly moves: number;
    readonly at?: { readonly x: number; readonly y: number; readonly z: number };
  };
  'player:moved': {
    readonly nodeId: string;
    readonly surface?: 'stone' | 'grass' | 'snow' | 'wood';
  };
  'mechanism:snap': {
    readonly id: string;
    readonly kind: string;
    readonly value: number | string | boolean;
    readonly notch: number;
    readonly sound: string;
    /** Position monde du mécanisme, pour FX et audio. */
    readonly at: { readonly x: number; readonly y: number; readonly z: number };
    /** Nombre de crans du cycle, pour calculer le sens de rotation. */
    readonly steps?: number;
  };
  'mechanism:stateChanged': {
    readonly id: string;
    readonly kind: string;
    readonly value: number | string | boolean;
    readonly at: { readonly x: number; readonly y: number; readonly z: number };
  };
  'mechanism:drag': {
    readonly id: string;
    readonly kind: string;
    readonly active: boolean;
    readonly at: { readonly x: number; readonly y: number; readonly z: number };
  };
  /** Vitesse de manipulation pendant un drag, normalisée 0..1. */
  'mechanism:dragMove': { readonly id: string; readonly speed: number };
  /** Un chemin vient de se refermer : polyline monde, départ → arrivée. */
  'path:connected': {
    readonly points: readonly { readonly x: number; readonly y: number; readonly z: number }[];
  };
  /** Nombre de couches musicales méritées par la progression (1..4). */
  'music:progress': { readonly layers: number };
  'borz:called': { readonly from: string | null; readonly to: string };
  'borz:hint': { readonly active: boolean };
  'ui:toast': { readonly message: string; readonly duration?: number };
}

/** Bus partagé par l'application. */
export const bus = new EventBus<GameEvents>();
