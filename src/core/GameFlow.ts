/**
 * GameFlow.ts — la respiration du jeu.
 *
 * Un seul orchestrateur relie le titre, les chapitres, la pause et la fin
 * (ADR-027). Toutes les transitions passent par le même moule : fondu au
 * noir → couture invisible (chargement, cadrage, palette) → carton de
 * chapitre dont le noir intérieur prend le relais → jeu. Le joueur ne voit
 * jamais une couture.
 *
 * Invariants portés ici :
 *  - la pause gèle la simulation, jamais le rendu (le monde reste visible) ;
 *  - la sauvegarde est automatique et silencieuse (fin de chapitre, pause) ;
 *  - les réglages s'appliquent et se persistent immédiatement, sans bouton ;
 *  - l'interface parle → les intentions de jeu sont suspendues, la musique
 *    s'efface derrière les cartons.
 *
 * La scène du titre (vallée en plan large) vit sous les chapitres : on la
 * détache plutôt que de la disposer, elle est petite et procédurale.
 */
import { Vector3, type Object3D } from 'three';
import { Engine } from '@core/Engine';
import { bus } from '@core/EventBus';
import { isReducedMotion, setReducedMotionOverride } from '@core/motion';
import { UI } from '@/config';
import { i18n } from '@i18n/i18n';
import { haptic, setHapticsEnabled } from '@input/Haptics';
import { InputManager, type InputAction } from '@input/InputManager';
import { AudioDirector } from '@audio/AudioDirector';
import { DEFAULT_VOLUMES } from '@audio/mixing';
import { CHAPTER_PALETTES, type ChapterPaletteName } from '@render/Palettes';
import { DemoScene } from '@render/DemoScene';
import { disposeObject } from '@utils/dispose';
import { FxRuntime } from '@fx/FxRuntime';
import { SaveManager } from '@save/SaveManager';
import type { SettingsStore, StoredUiSettings } from '@save/SettingsStore';
import {
  LEVEL_IDS,
  isLevelId,
  levelChapterNumber,
  levelIntroKey,
  levelProverbKey,
  levelSubtitleKey,
  levelTitleKey,
  levelVirtue,
  nextLevelId,
  type LevelId,
} from '@levels/index';
import { LevelLoader } from '@world/LevelLoader';
import { LevelRuntime } from '@world/LevelRuntime';
import type { Level } from '@world/Level';
import { UIRoot } from '@ui/UIRoot';
import { UiVeil } from '@ui/UiVeil';
import { Toast } from '@ui/Toast';
import { TitleScreen } from '@ui/TitleScreen';
import { ChapterCard, type ChapterCardData } from '@ui/ChapterCard';
import { PauseMenu } from '@ui/PauseMenu';
import { Settings, type UiSettingsState, type VolumeChannel } from '@ui/Settings';
import { ProverbBook } from '@ui/ProverbBook';
import { ChapterSelector, type ChapterEntryData } from '@ui/ChapterSelector';

type FlowState = 'boot' | 'title' | 'transition' | 'intro' | 'playing' | 'paused' | 'solved';

const VOLUME_CHANNELS: readonly VolumeChannel[] = ['master', 'music', 'ambience', 'sfx'];

/** Marge de cadrage de la vallée du titre (auto-fit, ADR-002). */
const TITLE_FRAME_MARGIN = 0.08;

/** Palette de chapitre pour la LUT (l'ordre de LEVEL_IDS = l'ordre des clés). */
function paletteForChapter(chapter: number): ChapterPaletteName {
  const names = Object.keys(CHAPTER_PALETTES) as ChapterPaletteName[];
  return names[chapter] ?? 'prologue';
}

/** Emprise du graphe (min/max des nœuds) pour le cadrage de la caméra. */
function frameLevelBounds(engine: Engine, level: Level): void {
  const nodes = level.graph.allNodes();
  if (nodes.length === 0) return;
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let minZ = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  let maxZ = Number.NEGATIVE_INFINITY;
  for (const node of nodes) {
    minX = Math.min(minX, node.position.x);
    minY = Math.min(minY, node.position.y);
    minZ = Math.min(minZ, node.position.z);
    maxX = Math.max(maxX, node.position.x);
    maxY = Math.max(maxY, node.position.y);
    maxZ = Math.max(maxZ, node.position.z);
  }
  engine.frameLevel(new Vector3(minX, minY, minZ), new Vector3(maxX, maxY + 2, maxZ), 0.1);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Un réglage d'interface absent du stockage quand il vaut sa valeur neutre
 * (« auto », « normal ») : retourne le choix à persister — `undefined` le
 * retire, ce qui rend la clé à son défaut.
 */
function resolveChoice<S extends string>(
  choice: string | undefined,
  stored: S | undefined,
  neutral: string,
): S | undefined {
  if (choice === undefined) return stored;
  return choice === neutral ? undefined : (choice as S);
}

export class GameFlow {
  /** Moteur exposé aux overlays de développement (stats, panneau). */
  readonly engine: Engine;
  private readonly input: InputManager;
  private readonly director: AudioDirector;
  private readonly settingsStore: SettingsStore;
  private readonly save = new SaveManager();
  private readonly loader = new LevelLoader();
  private readonly uiRoot: UIRoot;
  private readonly veil: UiVeil;
  private readonly toast: Toast;
  private readonly demo: DemoScene;
  private readonly fx: FxRuntime;

  private title: TitleScreen | null = null;
  private card: ChapterCard | null = null;
  private pauseMenu: PauseMenu | null = null;
  private settingsPanel: Settings | null = null;
  private proverbs: ProverbBook | null = null;
  private selector: ChapterSelector | null = null;

  private runtime: LevelRuntime | null = null;
  private currentId: LevelId = LEVEL_IDS[0];
  private state: FlowState = 'boot';
  private levelStartedAtMs = 0;
  private demoAttached = true;
  private readonly unsubscribes: (() => void)[] = [];

  constructor(canvas: HTMLCanvasElement) {
    this.engine = new Engine({ canvas, skyPalette: 'dawn', chapterPalette: 'prologue' });
    this.input = new InputManager(canvas);
    this.settingsStore = this.input.settingsStore;
    this.director = new AudioDirector(this.settingsStore);

    this.uiRoot = new UIRoot(document.body, {
      onEscape: () => this.onEscape(),
      onSuspendChange: (suspended) => this.input.setSuspended(suspended),
    });
    this.veil = new UiVeil(document.body);
    this.toast = new Toast({ container: this.uiRoot.element });
    this.demo = new DemoScene(this.engine.quality.settings);
    this.engine.scene.add(this.demo.root);

    this.fx = new FxRuntime({
      scene: this.engine.scene,
      camera: this.engine.cameraRig.camera,
      viewportHeight: () => this.engine.renderer.size.y,
      quality: this.engine.quality.settings,
      getTowers: () => this.towerRoots(),
    });

    this.wireEngine();
    this.wireBus();
    this.wireInput();
  }

  /**
   * Amorçage asynchrone : langue, réglages persistés, sauvegarde, puis
   * titre — ou chapitre direct en dev (`?level=`). Les panneaux ne peuvent
   * être construits qu'après l'i18n : leurs libellés naissent traduits.
   */
  async start(startLevel?: LevelId): Promise<void> {
    await i18n.init();
    const stored = await this.settingsStore.load();
    this.applyQuality(stored.ui?.quality ?? 'auto');
    this.applyMotion(stored.ui?.reducedMotion ?? 'auto');
    this.applyFontScale(stored.ui?.fontScale ?? 'normal');
    this.applyHighContrast(stored.ui?.highContrast ?? false);
    setHapticsEnabled(stored.haptics?.enabled ?? true);
    await this.input.loadPersistedBindings();
    await this.save.load();
    this.loader.preload(LEVEL_IDS[0]);

    this.buildPanels();
    this.engine.start();

    if (startLevel !== undefined) {
      this.veil.setInstant(true);
      await this.beginChapter(startLevel);
      return;
    }
    await this.showTitle();
  }

  // ————————————————————————————————— Écrans

  private async showTitle(): Promise<void> {
    this.state = 'title';
    this.engine.frameLevel(
      this.demo.bounds.min,
      this.demo.bounds.max,
      TITLE_FRAME_MARGIN,
    );
    if (this.title !== null) this.uiRoot.setBase(this.title);
    if (this.veil.isBlack) await this.veil.reveal();
  }

  /**
   * Entre dans un chapitre : fondu au noir, couture invisible, carton.
   * Appelée du titre, du sélecteur, d'une victoire ou d'un recommencement.
   */
  private async beginChapter(id: LevelId): Promise<void> {
    if (this.state === 'transition') return;
    this.state = 'transition';
    this.currentId = id;

    if (!this.veil.isBlack) await this.veil.fadeToBlack();

    // La couture : l'interface se ferme, la simulation s'arrête, la vallée
    // du titre laisse la place — tout ceci vit dans le noir.
    this.uiRoot.popAll();
    this.uiRoot.setBase(null);
    this.accumulatePlaytime();
    this.teardownChapter();
    this.attachDemo(false);

    const level = await this.loader.load(id);
    this.runtime = new LevelRuntime({
      level,
      sceneRoot: this.engine.scene,
      camera: this.engine.cameraRig.camera,
      input: this.input,
      viewport: () => this.engine.renderer.size,
    });
    this.fx.attachLevel(level);
    frameLevelBounds(this.engine, level);
    this.engine.sky.applyNamed(level.definition.sky);
    this.engine.postFx.setChapterPalette(
      paletteForChapter(level.definition.chapter),
      this.engine.quality.settings,
    );

    // Le carton porte son propre noir : il prend le relais du voile,
    // qui peut s'effacer instantanément derrière lui.
    this.state = 'intro';
    if (this.card !== null) {
      this.card.present(this.cardData(id));
      this.uiRoot.push(this.card);
    }
    this.veil.setInstant(false);
    this.speakDucking(true);
  }

  private cardData(id: LevelId): ChapterCardData {
    return {
      chapter: levelChapterNumber(id),
      virtueKey: `virtues.${levelVirtue(id)}`,
      titleKey: levelTitleKey(id),
      subtitleKey: levelSubtitleKey(id),
      introKey: levelIntroKey(id),
    };
  }

  /** Le carton a fini de parler : le chapitre commence. */
  private onCardDone(): void {
    this.speakDucking(false);
    if (this.uiRoot.top === this.card) this.uiRoot.pop();
    if (this.state !== 'intro') return;
    this.state = 'playing';
    this.levelStartedAtMs = performance.now();
  }

  /** Victoire : la célébration vit, puis le proverbe s'offre, puis la suite. */
  private async handleSolved(id: string): Promise<void> {
    if (this.state !== 'playing' || id !== this.currentId) return;
    this.state = 'solved';
    this.accumulatePlaytime();
    haptic('celebrate');
    this.caption('captions.celebration');

    // La célébration (cascade des tours, traînée dorée) vit ce temps-là.
    await delay(UI.solvedHoldMs);

    const proverbKey = levelProverbKey(this.currentId);
    this.toast.show(`${i18n.t('ui.proverbOffered')} — ${i18n.t(proverbKey)}`);

    const next = nextLevelId(this.currentId);
    this.save.markCompleted(this.currentId, next ?? this.currentId, proverbKey);
    await this.save.flush();

    if (next !== null) {
      await this.beginChapter(next);
      return;
    }
    await this.backToTitle();
  }

  /** Retour au titre après l'épilogue (ou avant : rien ne se perd). */
  private async backToTitle(): Promise<void> {
    this.state = 'transition';
    if (!this.veil.isBlack) await this.veil.fadeToBlack();
    this.teardownChapter();
    this.attachDemo(true);
    this.uiRoot.popAll();
    await this.showTitle();
  }

  private teardownChapter(): void {
    this.runtime?.dispose();
    this.runtime = null;
    this.fx.detachLevel();
    this.loader.unload();
  }

  private attachDemo(attached: boolean): void {
    if (this.demoAttached === attached) return;
    this.demoAttached = attached;
    if (attached) this.engine.scene.add(this.demo.root);
    else this.demo.root.removeFromParent();
  }

  // ————————————————————————————————— Pause

  /** `game:pause { paused: true }` : le monde reste visible, immobile. */
  private onGamePaused(): void {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    this.accumulatePlaytime();
    if (this.pauseMenu !== null) this.uiRoot.push(this.pauseMenu);
    void this.save.flush();
  }

  private onGameResumed(): void {
    if (this.state !== 'paused') return;
    this.state = 'playing';
    this.levelStartedAtMs = performance.now();
    if (this.uiRoot.top === this.pauseMenu) this.uiRoot.pop();
  }

  /** Échap sur le menu pause : reprendre. Sur le reste : remonter d'un cran. */
  private onEscape(): void {
    const top = this.uiRoot.top;
    if (top === null || top === this.card) return;
    if (top === this.pauseMenu) {
      this.runtime?.resume();
      return;
    }
    this.uiRoot.pop();
  }

  // ————————————————————————————————— Réglages

  private getUiState(): UiSettingsState {
    const stored = this.settingsStore.snapshot;
    const audio = stored.audio?.volumes;
    const volumes: Record<VolumeChannel, number> = {
      master: audio?.master ?? DEFAULT_VOLUMES.master,
      music: audio?.music ?? DEFAULT_VOLUMES.music,
      ambience: audio?.ambience ?? DEFAULT_VOLUMES.ambience,
      sfx: audio?.sfx ?? DEFAULT_VOLUMES.sfx,
    };
    return {
      volumes,
      quality: stored.ui?.quality ?? 'auto',
      locale: i18n.current,
      reducedMotion: stored.ui?.reducedMotion ?? 'auto',
      fontScale: stored.ui?.fontScale ?? 'normal',
      highContrast: stored.ui?.highContrast ?? false,
      subtitles: stored.ui?.subtitles ?? false,
      haptics: stored.haptics?.enabled ?? true,
    };
  }

  /** Tout s'applique et se sauvegarde immédiatement — jamais « Appliquer ». */
  private async applyUiChange(partial: Partial<UiSettingsState>): Promise<void> {
    const stored = this.settingsStore.snapshot;

    if (partial.volumes !== undefined) await this.applyVolumes(partial.volumes);
    if (partial.quality !== undefined) this.applyQuality(partial.quality);
    if (partial.reducedMotion !== undefined) this.applyMotion(partial.reducedMotion);
    if (partial.fontScale !== undefined) this.applyFontScale(partial.fontScale);
    if (partial.highContrast !== undefined) this.applyHighContrast(partial.highContrast);
    // (Sous-titres : rien à appliquer — ils se lisent au moment d'émettre.)
    if (partial.locale !== undefined && partial.locale !== i18n.current) {
      await i18n.setLocale(partial.locale);
    }
    if (partial.haptics !== undefined) {
      setHapticsEnabled(partial.haptics);
      await this.settingsStore.saveHapticsEnabled(partial.haptics);
    }

    // La section ui est remplacée entière : on la reconstruit complète pour
    // ne rien perdre (et pour effacer un choix revenu à sa valeur neutre).
    const touchedUi =
      partial.quality !== undefined ||
      partial.reducedMotion !== undefined ||
      partial.fontScale !== undefined ||
      partial.highContrast !== undefined ||
      partial.subtitles !== undefined;
    if (touchedUi) {
      const nextUi: StoredUiSettings = {
        quality: resolveChoice(partial.quality, stored.ui?.quality, 'auto'),
        reducedMotion: resolveChoice(partial.reducedMotion, stored.ui?.reducedMotion, 'auto'),
        fontScale: resolveChoice(partial.fontScale, stored.ui?.fontScale, 'normal'),
        highContrast: partial.highContrast ?? stored.ui?.highContrast,
        subtitles: partial.subtitles ?? stored.ui?.subtitles,
      };
      await this.settingsStore.saveUi(nextUi);
    }
  }

  private async applyVolumes(volumes: Readonly<Record<VolumeChannel, number>>): Promise<void> {
    const before = this.getUiState().volumes;
    for (const channel of VOLUME_CHANNELS) {
      const value = volumes[channel];
      if (value !== undefined && value !== before[channel]) {
        await this.director.setVolume(channel, value);
      }
    }
  }

  /** « auto » rend l'adaptation à l'appareil ; un tier la fige (ADR-013). */
  private applyQuality(choice: UiSettingsState['quality']): void {
    if (choice === 'auto') this.engine.quality.setAuto();
    else this.engine.quality.setTier(choice, 'user');
  }

  private applyMotion(choice: UiSettingsState['reducedMotion']): void {
    setReducedMotionOverride(
      choice === 'reduced' ? true : choice === 'full' ? false : undefined,
    );
    const reduced = choice === 'reduced' || (choice === 'auto' && isReducedMotion());
    document.documentElement.classList.toggle('ui-motion-reduced', reduced);
  }

  private applyFontScale(choice: UiSettingsState['fontScale']): void {
    document.documentElement.style.setProperty('--font-scale', String(UI.fontScales[choice]));
  }

  private applyHighContrast(enabled: boolean): void {
    document.documentElement.classList.toggle('ui-hc', enabled);
  }

  // ————————————————————————————————— Carnet, sélecteur

  private proverbEntries() {
    return LEVEL_IDS.map((id) => {
      const proverbKey = levelProverbKey(id);
      return {
        proverbKey,
        virtueKey: `virtues.${levelVirtue(id)}`,
        unlocked: this.save.snapshot.proverbs.includes(proverbKey),
      };
    });
  }

  private chapterEntries(): readonly ChapterEntryData[] {
    const current = this.save.snapshot.currentLevel;
    return LEVEL_IDS.map((id): ChapterEntryData => ({
      id,
      status: this.save.isCompleted(id) ? 'completed' : id === current ? 'current' : 'locked',
    }));
  }

  // ————————————————————————————————— Câblage

  private buildPanels(): void {
    this.title = new TitleScreen({
      onStart: () => {
        const target = this.save.hasProgress() ? this.save.snapshot.currentLevel : LEVEL_IDS[0];
        void this.beginChapter(isLevelId(target) ? target : LEVEL_IDS[0]);
      },
      onChapters: () => {
        if (this.selector !== null) this.uiRoot.push(this.selector);
      },
      onSettings: () => {
        if (this.settingsPanel !== null) this.uiRoot.push(this.settingsPanel);
      },
      onProverbs: () => {
        if (this.proverbs !== null) this.uiRoot.push(this.proverbs);
      },
      hasProgress: () => this.save.hasProgress(),
    });

    this.card = new ChapterCard({ onDone: () => this.onCardDone() });

    this.pauseMenu = new PauseMenu({
      onResume: () => this.runtime?.resume(),
      onRestart: () => void this.beginChapter(this.currentId),
      onSettings: () => {
        if (this.settingsPanel !== null) this.uiRoot.push(this.settingsPanel);
      },
      onProverbs: () => {
        if (this.proverbs !== null) this.uiRoot.push(this.proverbs);
      },
      onBackToTitle: () => {
        this.uiRoot.pop();
        void this.backToTitle();
      },
    });

    this.settingsPanel = new Settings({
      getState: () => this.getUiState(),
      getBindings: () => this.input.currentBindings,
      onChange: (partial) => void this.applyUiChange(partial),
      onBindingsChange: (bindings) => {
        this.input.setBindings(bindings);
        void this.input.persistBindings();
      },
      onResetBindings: () => void this.input.resetBindings(),
      onClose: () => this.uiRoot.pop(),
    });

    this.proverbs = new ProverbBook({
      getEntries: () => this.proverbEntries(),
      onClose: () => this.uiRoot.pop(),
    });

    this.selector = new ChapterSelector({
      getEntries: () => this.chapterEntries(),
      onSelect: (id) => {
        this.uiRoot.pop();
        void this.beginChapter(id);
      },
      onClose: () => this.uiRoot.pop(),
    });

    // Changement de langue : tout se réétiquette, sans recharger la page.
    this.unsubscribes.push(
      i18n.onChange(() => {
        this.title?.refresh();
        this.pauseMenu?.refresh();
        this.settingsPanel?.refresh();
        this.proverbs?.refresh();
        this.selector?.refresh();
      }),
    );
  }

  private wireEngine(): void {
    this.unsubscribes.push(
      this.engine.onUpdate((time) => {
        this.input.update(); // la manette se sonde, elle n'émet pas d'elle-même
        if (this.runtime !== null) this.runtime.update(time.elapsed, time.delta);
        this.fx.update(time.elapsed, time.delta);
        if (this.demoAttached) this.demo.update(time.elapsed, time.delta);
      }),
      this.engine.quality.onChange(() => {
        this.fx.applyQuality(this.engine.quality.settings);
        this.demo.applyQuality(this.engine.quality.settings);
      }),
      bus.on('engine:resize', () => this.fx.updatePixelScale()),
    );
  }

  private wireBus(): void {
    this.unsubscribes.push(
      bus.on('game:pause', ({ paused }) => (paused ? this.onGamePaused() : this.onGameResumed())),
      bus.on('level:solved', ({ id }) => {
        void this.handleSolved(id);
      }),
      bus.on('ui:toast', ({ message, duration }) => this.toast.show(message, duration)),
      // Sous-titres des événements sonores : discrets, désactivables, et
      // aucun puzzle ne dépend du son (docs/GDD.md accessibilité).
      bus.on('level:loaded', () => this.caption('captions.chapter')),
      bus.on('mechanism:snap', () => this.caption('captions.snap')),
      bus.on('path:connected', () => this.caption('captions.chord')),
    );
  }

  private wireInput(): void {
    // Le premier geste du joueur déverrouille l'audio (docs/AUDIO.md § 6).
    this.unsubscribes.push(
      this.input.onFirstGesture(() => {
        void this.director.unlock();
      }),
      this.input.on('action', (action: InputAction) => {
        if (action !== 'muteToggle') return;
        void this.director.toggleMute().then((muted) => {
          this.toast.show(i18n.t(muted ? 'ui.muteOn' : 'ui.muteOff'), UI.muteToastMs);
        });
      }),
    );
  }

  // ————————————————————————————————— Utilitaires

  /** Les tours du chapitre courant, pour la célébration des FX. */
  private towerRoots(): readonly Object3D[] {
    const level = this.loader.activeLevel;
    if (level === null) return [];
    return [...level.mechanisms.values()].map((mechanism) => mechanism.root);
  }

  /** Referme le compteur de temps de jeu du chapitre courant. */
  private accumulatePlaytime(): void {
    if (this.levelStartedAtMs === 0) return;
    const elapsed = (performance.now() - this.levelStartedAtMs) / 1000;
    this.levelStartedAtMs = 0;
    if (elapsed > 0) this.save.addPlaytime(elapsed);
  }

  /** La musique s'efface derrière les cartons de chapitre. */
  private speakDucking(speaking: boolean): void {
    bus.emit('ui:speaking', { speaking });
  }

  /** Sous-titre d'un événement sonore — seulement si le joueur les veut. */
  private caption(key: string): void {
    if (this.settingsStore.snapshot.ui?.subtitles !== true) return;
    this.toast.show(i18n.t(key));
  }

  dispose(): void {
    for (const unsubscribe of this.unsubscribes) unsubscribe();
    this.unsubscribes.length = 0;
    this.accumulatePlaytime();
    void this.save.flush();
    this.teardownChapter();
    this.toast.dispose();
    this.veil.dispose();
    this.uiRoot.dispose();
    this.title?.dispose();
    this.card?.dispose();
    this.pauseMenu?.dispose();
    this.settingsPanel?.dispose();
    this.proverbs?.dispose();
    this.selector?.dispose();
    // Scène procédurale petite : libérée ici seulement, jamais entre chapitres.
    disposeObject(this.demo.root);
    this.director.dispose();
    this.input.dispose();
    this.fx.dispose();
    this.engine.dispose();
  }
}
