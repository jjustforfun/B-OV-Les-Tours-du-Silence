/**
 * main.ts — point d'entrée.
 *
 * Étape 1 du chantier : prouver que la fondation tient. Une scène minimale
 * mais déjà « juste » sur le plan artistique — un bloc de pierre posé sur une
 * dalle, en caméra orthographique isométrique, dans un ciel en dégradé d'aube,
 * avec une respiration lente. Aucun gameplay encore : la suite se branchera
 * sur l'Engine sans le modifier.
 */
import { BoxGeometry, CylinderGeometry, Mesh, Group } from 'three';
import { Engine } from '@core/Engine';
import { LevelLoader } from '@world/LevelLoader';
import { bus } from '@core/EventBus';
import { createToonStoneMaterial } from '@render/materials/ToonStoneMaterial';
import { DEV_FLAGS, GRID } from '@/config';
import { breathe } from '@utils/easing';
import '@ui/styles/main.css';

function requireCanvas(): HTMLCanvasElement {
  const canvas = document.getElementById('game-canvas');
  if (!(canvas instanceof HTMLCanvasElement)) {
    throw new Error('Canvas #game-canvas introuvable dans index.html');
  }
  return canvas;
}

/** Le premier objet du jeu : une pierre posée sur une dalle. */
function createStoneAltar(): Group {
  const group = new Group();
  group.name = 'StoneAltar';

  const base = new Mesh(
    new CylinderGeometry(1.9, 2.1, 0.35, 6),
    createToonStoneMaterial({ color: 0x6f7789, steps: 4 }),
  );
  base.position.y = -0.175;
  base.receiveShadow = true;

  const cube = new Mesh(
    new BoxGeometry(GRID.cell * 2, GRID.cell * 2, GRID.cell * 2),
    createToonStoneMaterial({ color: 0x9aa0ab, steps: 4 }),
  );
  cube.position.y = GRID.cell;
  cube.castShadow = true;
  cube.receiveShadow = true;

  group.add(base, cube);
  return group;
}

async function boot(): Promise<void> {
  const engine = new Engine({ canvas: requireCanvas(), skyPalette: 'dawn' });

  const altar = createStoneAltar();
  engine.scene.add(altar);
  engine.cameraRig.lookAtPoint(altar.position);

  // Respiration : le monde n'est jamais tout à fait immobile.
  engine.onUpdate((time) => {
    const t = breathe(time.elapsed * 0.06);
    altar.position.y = (t - 0.5) * 0.12;
    altar.rotation.y = time.elapsed * 0.08;
  });

  engine.start();

  // Le prologue est préchargé pendant que le joueur regarde la première image :
  // son chunk arrive avant qu'il n'ait fini de contempler. Prouve aussi que le
  // découpage par chapitre fonctionne (voir ADR-010).
  const levels = new LevelLoader();
  levels.preload('00-prologue');

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

  window.addEventListener('beforeunload', () => engine.dispose());
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
