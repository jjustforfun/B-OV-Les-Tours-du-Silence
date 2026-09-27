/**
 * main.ts — point d'entrée.
 *
 * Deux mondes cohabitent :
 *  - `?play` ou `?level=<id>` : le mode jouable complet — écran titre,
 *    chapitres, pause, réglages, carnet (GameFlow, phase 8). Sans paramètre,
 *    le jeu s'ouvre aussi sur le titre : c'est le mode par défaut.
 *  - `?showcase=...` : la revue de direction artistique (`turpal` pour le
 *    personnage, `demo` pour la tour) — sans interface de jeu.
 *
 * Le moteur garde le même cadrage auto-fit dans les deux cas. En dev,
 * `?debug=nav` ou la touche G affichent l'overlay de graphe.
 */
import { Engine } from '@core/Engine';
import { GameFlow } from '@core/GameFlow';
import { bus } from '@core/EventBus';
import { Level, type Level as RuntimeLevel } from '@world/Level';
import { LevelLoader } from '@world/LevelLoader';
import { DemoScene } from '@render/DemoScene';
import { TurpalShowcaseScene } from '@render/TurpalShowcaseScene';
import { LEVEL_IDS, type LevelId } from '@levels/index';
import { DEV_FLAGS } from '@/config';
import type { NavGraphViz as NavGraphVizOverlay } from '@debug/NavGraphViz';
import '@ui/styles/main.css';

function requireCanvas(): HTMLCanvasElement {
  const canvas = document.getElementById('game-canvas');
  if (!(canvas instanceof HTMLCanvasElement)) {
    throw new Error('Canvas #game-canvas introuvable dans index.html');
  }
  return canvas;
}

/**
 * Chapitre demandé en dev : `?play` seul ouvre le prologue, `?level=<id>`
 * ouvre ce chapitre directement (sans passer par le titre). `null` = titre.
 */
function wantedLevelId(): LevelId | null {
  const params = new URLSearchParams(window.location.search);
  const level = params.get('level');
  const isChapterLevel = (LEVEL_IDS as readonly string[]).includes(level ?? '');
  if (params.has('play')) return isChapterLevel ? (level as LevelId) : '00-prologue';
  return isChapterLevel ? (level as LevelId) : null;
}

function wantsTurpalShowcase(): boolean {
  const showcase = new URLSearchParams(window.location.search).get('showcase');
  if (import.meta.env.DEV) return showcase === 'turpal';
  return showcase === 'turpal';
}

function wantsNavGraphDebug(): boolean {
  const params = new URLSearchParams(window.location.search);
  for (const value of params.getAll('debug')) {
    if (value.split(',').some((flag) => flag.trim().toLowerCase() === 'nav')) return true;
  }
  return false;
}

async function bootPlayMode(): Promise<void> {
  const flow = new GameFlow(requireCanvas());
  await flow.start(wantedLevelId() ?? undefined);

  if (DEV_FLAGS.showStats) {
    const { Stats } = await import('@debug/Stats');
    const stats = new Stats(flow.engine.renderer.gl);
    flow.engine.onUpdate((time) => stats.update(time.fps, time.unscaledDelta));
  }

  if (DEV_FLAGS.showDebugPanel) {
    const { DebugPanel } = await import('@debug/DebugPanel');
    const panel = new DebugPanel(flow.engine);
    window.addEventListener('beforeunload', () => panel.dispose());
  }

  markBooted();

  window.addEventListener('beforeunload', () => flow.dispose());
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
  const showcase = new URLSearchParams(window.location.search).get('showcase');
  if (showcase !== null) {
    await bootShowcaseMode();
    return;
  }
  // Par défaut : le jeu. (?play / ?level=<id> court-circuite le titre.)
  await bootPlayMode();
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
