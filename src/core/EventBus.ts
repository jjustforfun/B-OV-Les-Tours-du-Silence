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
  'level:loaded': { readonly id: string };
  'level:solved': { readonly id: string; readonly moves: number };
  'player:moved': { readonly nodeId: string };
  'ui:toast': { readonly message: string; readonly duration?: number };
}

/** Bus partagé par l'application. */
export const bus = new EventBus<GameEvents>();
