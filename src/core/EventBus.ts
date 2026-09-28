/**
 * EventBus.ts — bus d'événements typé, sans dépendance.
 *
 * Tout le jeu communique par messages : l'UI ne connaît pas le moteur,
 * l'audio ne connaît pas le gameplay. Le bus conserve un snapshot stable
 * pendant chaque émission sans allouer un nouveau tableau à chaque image.
 */

export type EventMap = Record<string, unknown>;
export type Listener<T> = (payload: T) => void;
type UnknownListener = Listener<unknown>;
interface WorldPoint {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}
type MechanismValue = number | string | boolean;

/** Événements globaux du jeu. */
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
    readonly at?: WorldPoint;
  };
  'player:moved': {
    readonly nodeId: string;
    readonly surface?: 'stone' | 'grass' | 'snow' | 'wood';
  };
  'mechanism:snap': {
    readonly id: string;
    readonly kind: string;
    readonly value: MechanismValue;
    readonly notch: number;
    readonly sound: string;
    readonly at: WorldPoint;
    readonly steps?: number;
  };
  'mechanism:stateChanged': {
    readonly id: string;
    readonly kind: string;
    readonly value: MechanismValue;
    readonly at: WorldPoint;
  };
  'mechanism:drag': {
    readonly id: string;
    readonly kind: string;
    readonly active: boolean;
    readonly at: WorldPoint;
  };
  /** Vitesse de manipulation pendant un drag, normalisée 0..1. */
  'mechanism:dragMove': { readonly id: string; readonly speed: number };
  /** Un chemin vient de se refermer : polyline monde, départ → arrivée. */
  'path:connected': { readonly points: readonly WorldPoint[] };
  /** Une liaison impossible vient d'être franchie. */
  'illusion:crossed': { readonly from: WorldPoint; readonly to: WorldPoint };
  /** Nombre de couches musicales méritées par la progression (1..4). */
  'music:progress': { readonly layers: number };
  'borz:awakened': { readonly nodeId: string | null };
  'borz:called': { readonly from: string | null; readonly to: string };
  'borz:hint': { readonly active: boolean };
  'moon:phase': {
    readonly id: string;
    readonly phase: string;
    readonly elapsedSeconds: number;
    readonly progress: number;
  };
  'ui:toast': { readonly message: string; readonly duration?: number };
  /** L'interface parle (carton de chapitre) : la musique s'efface derrière. */
  'ui:speaking': { readonly speaking: boolean };
  'secret:eagleFound': { readonly secretId: string; readonly levelId: string };
  'narrative:text': { readonly key: string };
  'sky:transition': {
    readonly palette: 'dawn' | 'mist' | 'dusk' | 'snow' | 'gold';
    readonly durationSeconds: number;
  };
  'child:bridgeReady': { readonly id: string };
  'elder:arrived': { readonly actorId: string; readonly at: WorldPoint };
  'traveler:welcomed': { readonly actorId: string; readonly at: WorldPoint };
  'finale:towerLit': { readonly index: number; readonly at: WorldPoint };
  'finale:threshold': { readonly at: WorldPoint };
}

export class EventBus<Events extends EventMap> {
  private readonly listeners = new Map<keyof Events, Set<UnknownListener>>();
  /** Un buffer par profondeur garde les émissions imbriquées indépendantes. */
  private readonly dispatchBuffers: UnknownListener[][] = [];
  private dispatchDepth = 0;

  /** Abonne un écouteur. Retourne la fonction de désabonnement. */
  on<K extends keyof Events>(type: K, listener: Listener<Events[K]>): () => void {
    let set = this.listeners.get(type);
    if (!set) {
      set = new Set();
      this.listeners.set(type, set);
    }
    set.add(listener as UnknownListener);
    return () => this.off(type, listener);
  }

  /** Abonne un écouteur qui se retire après le premier message. */
  once<K extends keyof Events>(type: K, listener: Listener<Events[K]>): () => void {
    const off = this.on(type, (payload) => {
      off();
      listener(payload);
    });
    return off;
  }

  off<K extends keyof Events>(type: K, listener: Listener<Events[K]>): void {
    const set = this.listeners.get(type);
    if (!set) return;
    set.delete(listener as UnknownListener);
    if (set.size === 0) this.listeners.delete(type);
  }

  emit<K extends keyof Events>(type: K, payload: Events[K]): void {
    const set = this.listeners.get(type);
    if (!set) return;

    const depth = this.dispatchDepth;
    let snapshot = this.dispatchBuffers[depth];
    if (snapshot === undefined) {
      snapshot = [];
      this.dispatchBuffers.push(snapshot);
    }
    for (const listener of set) snapshot.push(listener);

    this.dispatchDepth += 1;
    try {
      for (const listener of snapshot) listener(payload);
    } finally {
      snapshot.length = 0;
      this.dispatchDepth -= 1;
    }
  }

  /** Nombre d'abonnements actifs, global ou pour un événement. */
  listenerCount(type?: keyof Events): number {
    if (type !== undefined) return this.listeners.get(type)?.size ?? 0;
    let count = 0;
    for (const set of this.listeners.values()) count += set.size;
    return count;
  }

  clear(): void {
    this.listeners.clear();
  }
}

/** Bus partagé par l'application. */
export const bus = new EventBus<GameEvents>();
