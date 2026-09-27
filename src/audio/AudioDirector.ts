/**
 * AudioDirector.ts — colle les événements du jeu au graphe audio.
 *
 * L'audio ne connaît le gameplay que par l'EventBus : c'est ce découplage
 * qui permet de charger Tone.js **après le premier geste** (ADR-026). En
 * effet le navigateur interdit tout son avant une interaction — charger
 * 100 ko de moteur audio dans le bundle initial, c'est payer deux fois un
 * silence. Avant le déverrouillage, le directeur mémorise l'état (chapitre,
 * progression musicale) et le rejoue à l'ouverture.
 *
 * Décision de sound design portée ici (docs/AUDIO.md § 5) : chaque cran de
 * mécanisme joue la note suivante de la gamme du chapitre — manipuler le
 * monde, c'est jouer.
 */
import { bus } from '@core/EventBus';
import { AUDIO } from '@/config';
import type { SettingsStore } from '@save/SettingsStore';
import { resolveAmbienceLayers } from './ambiencePlan';
import {
  CHAPTER_TUNINGS,
  ScaleCursor,
  notchDelta,
  scaleMidis,
  tuningForChapter,
} from './ChapterScale';
import type { AudioManager } from './AudioManager';

const NOTEFUL_KINDS = new Set(['rotator', 'slider', 'towerRotation']);

/** Signature de chapitre (5 notes) + silence de 2 s + note du proverbe. */
const PROVERB_DELAY_SECONDS = 4.2;
const PROVERB_DUCK_SECONDS = 9;

export class AudioDirector {
  private manager: AudioManager | null = null;
  private loading: Promise<void> | null = null;
  private chapter = 0;
  private ambienceOverride: readonly string[] | undefined;
  private layersSeen = 1;
  private readonly lastNotch = new Map<string, number>();
  private readonly draggedKind = new Map<string, string>();
  private cursor: ScaleCursor | null = null;
  private duckTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor(private readonly store: SettingsStore) {
    this.bindBus();
  }

  /** Premier geste du joueur : on construit le monde sonore. */
  unlock(): Promise<void> {
    if (this.manager !== null) return Promise.resolve();
    this.loading ??= this.loadManager();
    return this.loading;
  }

  get isUnlocked(): boolean {
    return this.manager !== null;
  }

  /** Coupure rapide (touche M) — l'état est persisté. */
  async toggleMute(): Promise<boolean> {
    const muted = this.manager?.toggleMute() ?? true;
    await this.store.saveAudio({ muted });
    return muted;
  }

  async setVolume(channel: 'master' | 'music' | 'ambience' | 'sfx', value: number): Promise<void> {
    this.manager?.setVolume(channel, value);
    const volumes = { ...this.manager?.volumesSnapshot };
    await this.store.saveAudio({ volumes });
  }

  /** Petit son d'interface (boutons, validations). */
  uiTap(): void {
    this.manager?.sfx.uiTap();
  }

  dispose(): void {
    this.clearDuckTimeout();
    this.manager?.dispose();
    this.manager = null;
    this.loading = null;
  }

  // ————————————————————————————————— Chargement paresseux

  private async loadManager(): Promise<void> {
    const [{ AudioManager }, settings] = await Promise.all([
      import('./AudioManager'),
      this.store.load(),
    ]);
    const manager = new AudioManager();
    this.manager = manager;

    const audio = settings.audio;
    if (audio?.volumes !== undefined) {
      for (const [channel, value] of Object.entries(audio.volumes)) {
        if (typeof value === 'number') manager.setVolume(channel as 'master', value);
      }
    }
    if (audio?.muted === true) manager.setMuted(true);

    await manager.start();
    this.applyChapterState();
  }

  private applyChapterState(): void {
    const manager = this.manager;
    if (manager === null) return;

    const tuning = tuningForChapter(this.chapter);
    manager.music.setTuning(tuning);
    manager.pondar.setTuning(tuning);
    manager.sfx.setChapterRoot(tuning.rootMidi);
    manager.ambience.setChapter(this.chapter);
    manager.ambience.applyPlan(resolveAmbienceLayers(this.chapter, this.ambienceOverride));

    // À l'épilogue, les quatre couches sont là dès l'entrée : le chant revenu.
    manager.music.reset(0.8);
    manager.music.setProgress(this.chapter === CHAPTER_TUNINGS.length - 1 ? 4 : this.layersSeen);
  }

  // ————————————————————————————————— Événements → audio

  private bindBus(): void {
    bus.on('level:loaded', (event) => {
      this.chapter = event.chapter ?? 0;
      this.ambienceOverride = event.ambience;
      this.layersSeen = 1;
      this.lastNotch.clear();
      this.cursor = null;
      if (this.manager !== null) this.applyChapterState();
    });

    bus.on('music:progress', (event) => {
      this.layersSeen = Math.max(this.layersSeen, event.layers);
      this.manager?.music.setProgress(this.layersSeen);
    });

    bus.on('mechanism:snap', (event) => {
      const manager = this.manager;
      if (manager === null) return;

      if (event.kind === 'gravityPath') {
        // Bascule de gravité : 500 ms de silence habité, le vertige a la place.
        manager.music.muffle(AUDIO.gravityMuffleMs);
        return;
      }
      if (event.kind === 'pressurePlate') {
        manager.sfx.plate(typeof event.value === 'boolean' ? event.value : true);
        return;
      }

      manager.sfx.stoneLock();
      if (NOTEFUL_KINDS.has(event.kind)) this.playNotchNote(event.id, event.notch, event.steps);
    });

    bus.on('mechanism:drag', (event) => {
      if (event.kind === 'slider') {
        this.draggedKind.set(event.id, 'slider');
        this.manager?.sfx.slide(event.active);
      } else {
        this.draggedKind.set(event.id, 'rotation');
        this.manager?.sfx.rotation(event.active);
      }
      if (!event.active) this.draggedKind.delete(event.id);
    });

    bus.on('mechanism:dragMove', (event) => {
      const kind = this.draggedKind.get(event.id);
      if (kind === 'slider') this.manager?.sfx.slideSpeed(event.speed);
      else this.manager?.sfx.rotationSpeed(event.speed);
    });

    bus.on('player:moved', (event) => {
      this.manager?.sfx.step(event.surface ?? 'stone');
    });

    bus.on('path:connected', () => {
      this.manager?.pondar.playConnectionChord();
    });

    bus.on('level:solved', () => {
      const manager = this.manager;
      if (manager === null) return;
      manager.pondar.playChapterSignature();
      manager.duck(true);
      this.clearDuckTimeout();
      // La note du proverbe arrive après la signature et deux secondes de
      // silence (docs/AUDIO.md § 5) — le texte respire autour d'elle.
      this.duckTimeout = setTimeout(() => {
        this.duckTimeout = null;
        manager.sfx.proverb();
      }, PROVERB_DELAY_SECONDS * 1000);
      setTimeout(() => manager.duck(false), PROVERB_DUCK_SECONDS * 1000);
    });

    bus.on('ui:toast', (event) => {
      const manager = this.manager;
      if (manager === null) return;
      manager.duck(true);
      this.clearDuckTimeout();
      const hold = (event.duration ?? 2400) + AUDIO.duck.releaseMs;
      this.duckTimeout = setTimeout(() => {
        this.duckTimeout = null;
        manager.duck(false);
      }, hold);
    });

    bus.on('game:pause', (event) => {
      if (event.paused) this.manager?.suspend();
      else this.manager?.resume();
    });
  }

  /**
   * Le cœur du « manipuler, c'est jouer » : chaque cran monte la gamme,
   * chaque cran en sens inverse la descend. Le curseur mémorise où la
   * manipulation s'est arrêtée — le monde garde la mélodie en mémoire.
   */
  private playNotchNote(id: string, notch: number, steps?: number): void {
    const manager = this.manager;
    if (manager === null) return;
    const tuning = tuningForChapter(this.chapter);
    this.cursor ??= new ScaleCursor(scaleMidis(tuning.rootMidi, tuning.mode, 2));

    const previous = this.lastNotch.get(id);
    this.lastNotch.set(id, notch);
    if (previous !== undefined) {
      this.cursor.step(notchDelta(previous, notch, steps));
    }
    manager.pondar.pluck(this.cursor.midi);
  }

  private clearDuckTimeout(): void {
    if (this.duckTimeout === null) return;
    clearTimeout(this.duckTimeout);
    this.duckTimeout = null;
  }
}
