/**
 * Platform.ts — abstraction de la plateforme hôte.
 *
 * Tout ce que le web fait d'une façon et Capacitor d'une autre passe par
 * ici : stockage, vibration, plein écran, cycle de vie de l'application.
 * Le jour du portage Android, on ajoutera une CapacitorPlatform à côté de
 * WebPlatform — et **aucun autre fichier du jeu ne changera**. C'est tout
 * l'intérêt de cette indirection (voir docs/ANDROID_PORT.md).
 */

export type AppLifecycleEvent = 'pause' | 'resume';

export interface PlatformAdapter {
  readonly name: 'web' | 'capacitor';
  readonly isNative: boolean;

  /** Stockage clé/valeur asynchrone (Preferences sur Capacitor). */
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;

  vibrate(pattern: readonly number[]): void;
  requestFullscreen(element?: HTMLElement): Promise<void>;
  exitFullscreen(): Promise<void>;

  /** S'abonne au cycle de vie de l'app. Retourne le désabonnement. */
  onLifecycle(listener: (event: AppLifecycleEvent) => void): () => void;

  /** Empêche la mise en veille pendant une session de jeu (best effort). */
  keepAwake(enabled: boolean): Promise<void>;
}

class WebPlatform implements PlatformAdapter {
  readonly name = 'web' as const;
  readonly isNative = false;

  private wakeLock: WakeLockSentinel | null = null;

  getItem(key: string): Promise<string | null> {
    try {
      return Promise.resolve(localStorage.getItem(key));
    } catch {
      return Promise.resolve(null);
    }
  }

  setItem(key: string, value: string): Promise<void> {
    try {
      localStorage.setItem(key, value);
    } catch {
      /* Mode privé / quota plein : on ne casse jamais la partie en cours. */
    }
    return Promise.resolve();
  }

  removeItem(key: string): Promise<void> {
    try {
      localStorage.removeItem(key);
    } catch {
      /* idem */
    }
    return Promise.resolve();
  }

  vibrate(pattern: readonly number[]): void {
    if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return;
    navigator.vibrate([...pattern]);
  }

  async requestFullscreen(element: HTMLElement = document.documentElement): Promise<void> {
    if (document.fullscreenElement) return;
    try {
      await element.requestFullscreen({ navigationUI: 'hide' });
    } catch {
      /* Refus du navigateur (iOS) : le jeu reste parfaitement jouable. */
    }
  }

  async exitFullscreen(): Promise<void> {
    if (!document.fullscreenElement) return;
    try {
      await document.exitFullscreen();
    } catch {
      /* idem */
    }
  }

  onLifecycle(listener: (event: AppLifecycleEvent) => void): () => void {
    const handler = (): void => listener(document.hidden ? 'pause' : 'resume');
    document.addEventListener('visibilitychange', handler);
    return () => document.removeEventListener('visibilitychange', handler);
  }

  async keepAwake(enabled: boolean): Promise<void> {
    if (!('wakeLock' in navigator)) return;
    try {
      if (enabled) {
        this.wakeLock = await navigator.wakeLock.request('screen');
      } else {
        await this.wakeLock?.release();
        this.wakeLock = null;
      }
    } catch {
      /* Le wake lock est un confort, jamais une exigence. */
    }
  }
}

/** Instance unique utilisée par tout le jeu. */
export const platform: PlatformAdapter = new WebPlatform();
