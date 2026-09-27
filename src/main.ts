/**
 * main.ts — point d'entrée.
 *
 * Phase 3 : afficher en développement la revue de Turpal sous quatre angles
 * (`?showcase=demo` revient à la tour), et garder en production la scène de
 * direction artistique. Le moteur conserve le même cadrage auto-fit.
 */
import { Engine } from '@core/Engine';
import { bus } from '@core/EventBus';
import { Level, type Level as RuntimeLevel } from '@world/Level';
import { LevelLoader } from '@world/LevelLoader';
import { DemoScene } from '@render/DemoScene';
import { TurpalShowcaseScene } from '@render/TurpalShowcaseScene';
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

function wantsPenroseDemo(): boolean {
  const params = new URLSearchParams(window.location.search);
  return params.get('demo') === 'penrose' || params.get('level') === 'penrose-demo';
}

async function boot(): Promise<void> {
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
  let navDebugLevelFromLoader = false;
  const loadNavDebugLevel = async (): Promise<RuntimeLevel> => {
    if (navDebugLevel) return navDebugLevel;
    if (wantsPenroseDemo()) {
      const { level } = await import('@levels/penrose-demo');
      navDebugLevel = new Level(level);
      navDebugLevelFromLoader = false;
      return navDebugLevel;
    }
    navDebugLevel = await levels.load('00-prologue');
    navDebugLevelFromLoader = true;
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

  // L'écran de chargement CSS s'efface une fois la première image affichée.
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      document.documentElement.classList.add('is-ready');
      document.body.dataset.ready = 'true';
    });
  });

  bus.on('engine:quality', ({ tier, reason }) => {
    if (import.meta.env.DEV) console.info(`[qualité] ${tier} (${reason})`);
  });

  window.addEventListener('beforeunload', () => {
    unsubscribeQuality();
    window.removeEventListener('keydown', toggleNavGraphViz);
    navGraphViz?.dispose();
    if (navDebugLevelFromLoader) levels.unload();
    else navDebugLevel?.dispose();
    engine.dispose();
  });
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
