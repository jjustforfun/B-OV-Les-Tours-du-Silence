/**
 * main.ts — point d'entrée.
 *
 * Deux mondes cohabitent :
 *  - `?play` (ou `?level=<id>`) : le mode jouable. Un chapitre se charge,
 *    Turpal marche, les mécanismes chantent (AudioDirector), le monde respire
 *    (FxRuntime). C'est la porte des phases 6–7.
 *  - sinon : la revue de direction artistique (`?showcase=turpal` pour la
 *    revue du personnage, `?showcase=demo` pour la tour).
 *
 * Le moteur garde le même cadrage auto-fit dans les deux cas. En dev,
 * `?debug=nav` ou la touche G affichent l'overlay de graphe.
 */
import { Vector3, type Object3D } from 'three';
import { Engine } from '@core/Engine';
import { bus } from '@core/EventBus';
import { Level, type Level as RuntimeLevel } from '@world/Level';
import { LevelLoader } from '@world/LevelLoader';
import { LevelRuntime } from '@world/LevelRuntime';
import { DemoScene } from '@render/DemoScene';
import { TurpalShowcaseScene } from '@render/TurpalShowcaseScene';
import { FxRuntime } from '@fx/FxRuntime';
import { InputManager, type InputAction } from '@input/InputManager';
import { AudioDirector } from '@audio/AudioDirector';
import { SettingsStore } from '@save/SettingsStore';
import { CHAPTER_PALETTES, type ChapterPaletteName } from '@render/Palettes';
import { LEVEL_IDS, type LevelId } from '@levels/index';
import { DEV_FLAGS } from '@/config';
import type { NavGraphViz as NavGraphVizOverlay } from '@debug/NavGraphViz';
import '@ui/styles/main.css';

const PLAYABLE_EXTRA_LEVEL = 'penrose-demo' as const;
type PlayableLevelId = LevelId | typeof PLAYABLE_EXTRA_LEVEL;

function requireCanvas(): HTMLCanvasElement {
  const canvas = document.getElementById('game-canvas');
  if (!(canvas instanceof HTMLCanvasElement)) {
    throw new Error('Canvas #game-canvas introuvable dans index.html');
  }
  return canvas;
}

/**
 * Niveau demandé : `?play` seul ouvre le prologue, `?level=<id>` ouvre ce
 * chapitre (les deux mènent au mode jouable). `penrose-demo` reste le banc
 * d'essai des mécanismes.
 */
function wantedLevelId(): PlayableLevelId | null {
  const params = new URLSearchParams(window.location.search);
  const level = params.get('level');
  if (level === PLAYABLE_EXTRA_LEVEL) return level;
  const isChapterLevel = (LEVEL_IDS as readonly string[]).includes(level ?? '');
  if (params.has('play')) return isChapterLevel ? (level as LevelId) : '00-prologue';
  return isChapterLevel ? (level as LevelId) : null;
}

function wantsTurpalShowcase(): boolean {
  const showcase = new URLSearchParams(window.location.search).get('showcase');
  if (import.meta.env.DEV) return showcase !== 'demo';
  return showcase === 'turpal';
}

function wantsNavGraphDebug(): boolean {
  const params = new URLSearchParams(window.location.search);
  for (const value of params.getAll('debug')) {
    if (value.split(',').some((flag) => flag.trim().toLowerCase() === 'nav')) return true;
  }
  return false;
}

/** Palette de chapitre pour la LUT (l'ordre de LEVEL_IDS = l'ordre des clés). */
function paletteForChapter(chapter: number): ChapterPaletteName {
  const names = Object.keys(CHAPTER_PALETTES) as ChapterPaletteName[];
  return names[chapter] ?? 'prologue';
}

/** Emprise du graphe (min/max des nœuds) pour le cadrage de la caméra. */
function frameLevelBounds(engine: Engine, level: RuntimeLevel): void {
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

async function bootPlayMode(canvas: HTMLCanvasElement, levelId: PlayableLevelId): Promise<void> {
  // Le prologue fait partie du bundle initial ; les autres chapitres sont des
  // chunks séparés qui n'arrivent qu'à la demande (ADR-010).
  const loader = new LevelLoader();
  const level =
    levelId === PLAYABLE_EXTRA_LEVEL
      ? new Level((await import('@levels/penrose-demo')).level)
      : await loader.load(levelId);

  const engine = new Engine({
    canvas,
    skyPalette: level.definition.sky,
    chapterPalette: paletteForChapter(level.definition.chapter),
  });

  const input = new InputManager(canvas);
  const director = new AudioDirector(new SettingsStore());

  // Le premier geste du joueur déverrouille l'audio (docs/AUDIO.md § 6) : le
  // silence d'ouverture n'est rompu que par une action volontaire.
  const unsubscribeFirstGesture = input.onFirstGesture(() => {
    void director.unlock();
  });

  // Touche M (et l'action manette « muet ») : coupure rapide, persistée.
  const onAction = (action: InputAction): void => {
    if (action !== 'muteToggle') return;
    void director.toggleMute().then((muted) => {
      bus.emit('ui:toast', {
        message: muted ? 'Son coupé' : 'Son rétabli',
        duration: 1600,
      });
    });
  };
  const unsubscribeMute = input.on('action', onAction);

  const runtime = new LevelRuntime({
    level,
    sceneRoot: engine.scene,
    camera: engine.cameraRig.camera,
    input,
    viewport: () => engine.renderer.size,
  });

  // Les tours du chapitre : les mécanismes portés par les tours (rotation de
  // tour…). Les niveaux n'ayant pas encore de mécanisme tombent sur la
  // célébration « solve » — la cascade complète viendra avec les niveaux.
  const towerRoots: readonly Object3D[] = [...level.mechanisms.values()].map(
    (mechanism) => mechanism.root,
  );
  const fx = new FxRuntime({
    scene: engine.scene,
    camera: engine.cameraRig.camera,
    viewportHeight: () => engine.renderer.size.y,
    quality: engine.quality.settings,
    getTowers: () => towerRoots,
  });
  fx.attachLevel(level);

  const unsubscribeQuality = engine.quality.onChange(() =>
    fx.applyQuality(engine.quality.settings),
  );
  const unsubscribeResize = bus.on('engine:resize', () => fx.updatePixelScale());

  engine.onUpdate((time) => {
    input.update(); // la manette se sonde, elle n'émet pas d'elle-même
    runtime.update(time.elapsed, time.delta);
    fx.update(time.elapsed, time.delta);
  });

  frameLevelBounds(engine, level);
  engine.start();

  if (DEV_FLAGS.showStats) {
    const { Stats } = await import('@debug/Stats');
    const stats = new Stats(engine.renderer.gl);
    engine.onUpdate((time) => stats.update(time.fps, time.unscaledDelta));
  }

  if (DEV_FLAGS.showDebugPanel) {
    const { DebugPanel } = await import('@debug/DebugPanel');
    const panel = new DebugPanel(engine);
    window.addEventListener('beforeunload', () => panel.dispose());
  }

  markBooted();

  window.addEventListener('beforeunload', () => {
    unsubscribeFirstGesture();
    unsubscribeMute();
    unsubscribeQuality();
    unsubscribeResize();
    runtime.dispose();
    fx.dispose();
    director.dispose();
    input.dispose();
    if (levelId === PLAYABLE_EXTRA_LEVEL) level.dispose();
    else loader.unload();
    engine.dispose();
  });
}

/** L'écran de chargement CSS s'efface une fois la première image affichée. */
function markBooted(): void {
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      document.documentElement.classList.add('is-ready');
      document.body.dataset.ready = 'true';
    });
  });
}

async function bootShowcaseMode(): Promise<void> {
  const engine = new Engine({
    canvas: requireCanvas(),
    skyPalette: 'dawn',
    chapterPalette: 'prologue',
  });

  const scene = wantsTurpalShowcase()
    ? new TurpalShowcaseScene(engine.quality.settings)
    : new DemoScene(engine.quality.settings);
  engine.scene.add(scene.root);
  engine.frameLevel(scene.bounds.min, scene.bounds.max, 0.08);

  const unsubscribeQuality = engine.quality.onChange(() =>
    scene.applyQuality(engine.quality.settings),
  );
  engine.onUpdate((time) => scene.update(time.elapsed, time.delta));

  engine.start();

  // Le prologue est préchargé pendant que le joueur regarde la première image :
  // son chunk arrive avant qu'il n'ait fini de contempler. Prouve aussi que le
  // découpage par chapitre fonctionne (voir ADR-010). En dev, `?debug=nav` ou
  // la touche G instancient ce même graphe pour afficher l'overlay de design.
  const levels = new LevelLoader();
  let navGraphViz: NavGraphVizOverlay | null = null;
  let navDebugLevel: RuntimeLevel | null = null;
  const loadNavDebugLevel = async (): Promise<RuntimeLevel> => {
    if (navDebugLevel) return navDebugLevel;
    const { level } = await import('@levels/penrose-demo');
    navDebugLevel = new Level(level);
    return navDebugLevel;
  };
  const ensureNavGraphViz = async (): Promise<NavGraphVizOverlay> => {
    if (navGraphViz) return navGraphViz;
    const [{ NavGraphViz }, debugLevel] = await Promise.all([
      import('@debug/NavGraphViz'),
      loadNavDebugLevel(),
    ]);
    navGraphViz = new NavGraphViz();
    navGraphViz.rebuild(debugLevel.graph);
    engine.scene.add(navGraphViz.root);
    return navGraphViz;
  };
  if (DEV_FLAGS.showNavGraph || wantsNavGraphDebug()) {
    const viz = await ensureNavGraphViz();
    viz.setVisible(true);
  } else {
    levels.preload('00-prologue');
  }
  const toggleNavGraphViz = (event: KeyboardEvent): void => {
    if (!import.meta.env.DEV || event.code !== 'KeyG' || event.repeat) return;
    event.preventDefault();
    void ensureNavGraphViz().then((viz) => viz.setVisible(!viz.root.visible));
  };
  window.addEventListener('keydown', toggleNavGraphViz);

  if (DEV_FLAGS.showStats) {
    const { Stats } = await import('@debug/Stats');
    const stats = new Stats(engine.renderer.gl);
    engine.onUpdate((time) => stats.update(time.fps, time.unscaledDelta));
  }

  if (DEV_FLAGS.showDebugPanel) {
    const { DebugPanel } = await import('@debug/DebugPanel');
    const panel = new DebugPanel(engine);
    window.addEventListener('beforeunload', () => panel.dispose());
  }

  markBooted();

  bus.on('engine:quality', ({ tier, reason }) => {
    if (import.meta.env.DEV) console.info(`[qualité] ${tier} (${reason})`);
  });

  window.addEventListener('beforeunload', () => {
    unsubscribeQuality();
    window.removeEventListener('keydown', toggleNavGraphViz);
    navGraphViz?.dispose();
    navDebugLevel?.dispose();
    levels.unload();
    engine.dispose();
  });
}

async function boot(): Promise<void> {
  const levelId = wantedLevelId();
  if (levelId !== null) {
    await bootPlayMode(requireCanvas(), levelId);
    return;
  }
  await bootShowcaseMode();
}

void boot().catch((error: unknown) => {
  console.error('[BӀOV] démarrage impossible', error);
  const boot = document.getElementById('boot');
  if (boot) {
    const hint = boot.querySelector('.boot__hint');
    if (hint) {
      hint.textContent = "Ce navigateur n'a pas pu ouvrir WebGL. Essayez un autre navigateur.";
    }
  }
});
