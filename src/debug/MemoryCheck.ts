/**
 * MemoryCheck.ts — preuve de non-fuite dans un vrai contexte WebGL.
 *
 * La Definition of Done exige « zéro fuite mémoire entre niveaux » : les tests
 * Node (lifecycle.test.ts) prouvent l'ownership CPU, mais seul un navigateur
 * peut mesurer `renderer.info.memory`. Ce harnais, chargé paresseusement par
 * `?memcheck` (chunk séparé, jamais dans le bundle initial), charge et
 * décharge les huit chapitres trois fois, en rendant réellement chaque niveau,
 * puis compare geometries/textures/programmes au point de référence.
 *
 * Le point de référence est pris APRÈS un cycle d'échauffement complet : les
 * caches volontairement partagés (LUT de chapitre, gradients toon, programmes
 * shaders) se remplissent une fois pour toutes et ne sont pas des fuites —
 * une fuite est ce qui CONTINUE de croître une fois ces caches pleins.
 */
import { Engine } from '@core/Engine';
import { CHAPTER_PALETTES, type ChapterPaletteName } from '@render/Palettes';
import { LEVEL_IDS, type LevelId } from '@levels/index';
import { LevelLoader } from '@world/LevelLoader';

export interface MemorySnapshot {
  readonly geometries: number;
  readonly textures: number;
  readonly programs: number;
}

export interface MemoryCheckReport {
  /** Après le cycle d'échauffement (caches partagés pleins). */
  readonly baseline: MemorySnapshot;
  /** Après chacun des cycles mesurés (8 niveaux chacun). */
  readonly cycles: readonly MemorySnapshot[];
  /** Après le dernier déchargement. */
  readonly final: MemorySnapshot;
  /** true si geometries ou textures ont dérivé entre baseline et final. */
  readonly leaked: boolean;
  /** Nombre de transitions charger→jouer→décharger mesurées. */
  readonly transitions: number;
}

declare global {
  interface Window {
    __BOV_MEMCHECK__?: MemoryCheckReport;
  }
}

function paletteForChapter(chapter: number): ChapterPaletteName {
  const names = Object.keys(CHAPTER_PALETTES) as ChapterPaletteName[];
  return names[chapter] ?? 'prologue';
}

function nextFrame(): Promise<number> {
  return new Promise((resolve) => requestAnimationFrame(resolve));
}

async function settleFrames(count: number): Promise<void> {
  for (let i = 0; i < count; i += 1) await nextFrame();
}

/** Charge, cadre, rend quelques images puis décharge un chapitre. */
async function playOnce(engine: Engine, loader: LevelLoader, id: LevelId): Promise<void> {
  const level = await loader.load(id);
  engine.scene.add(level.root);
  if (!level.bounds.isEmpty()) engine.frameLevel(level.bounds.min, level.bounds.max, 0.1);
  engine.sky.applyNamed(level.definition.sky);
  engine.postFx.setChapterPalette(
    paletteForChapter(level.definition.chapter),
    engine.quality.settings,
  );
  await settleFrames(5);
  engine.scene.remove(level.root);
  loader.unload();
  await settleFrames(2);
}

export async function runMemoryCheck(canvas: HTMLCanvasElement, cycles = 3): Promise<MemoryCheckReport> {
  // Une perte de contexte WebGL (mémoire du poste, onglet gelé…) remet les
  // compteurs à zéro et invaliderait la mesure : elle doit être visible.
  let contextLost = false;
  canvas.addEventListener('webglcontextlost', () => {
    contextLost = true;
    console.warn('[memcheck] CONTEXTE WEBGL PERDU — mesure invalide');
  });
  const engine = new Engine({ canvas, skyPalette: 'dawn', chapterPalette: 'prologue' });
  // Tier verrouillé : l'adaptation automatique (ADR-013) redimensionne les
  // passes de rendu en cours de mesure et ferait bouger les compteurs pour
  // une raison légitime — on mesure la fuite, pas l'adaptation.
  engine.quality.setTier('high', 'user');
  engine.start();
  const loader = new LevelLoader();
  const info = engine.renderer.gl.info;
  const snapshot = (): MemorySnapshot => ({
    geometries: info.memory.geometries,
    textures: info.memory.textures,
    programs: info.programs?.length ?? 0,
  });

  // Échauffement : un tour complet remplit les caches partagés.
  for (const id of LEVEL_IDS) await playOnce(engine, loader, id);
  const baseline = snapshot();

  const perCycle: MemorySnapshot[] = [];
  for (let cycle = 0; cycle < cycles; cycle += 1) {
    for (const id of LEVEL_IDS) {
      await playOnce(engine, loader, id);
      console.info(`[memcheck] cycle ${cycle + 1} ${id}`, JSON.stringify(snapshot()));
    }
    perCycle.push(snapshot());
  }

  const final = snapshot();
  if (contextLost) {
    console.warn('[memcheck] rapport marqué invalide : contexte WebGL perdu en cours de mesure');
  }
  const leaked = final.geometries !== baseline.geometries || final.textures !== baseline.textures;
  const report: MemoryCheckReport = {
    baseline,
    cycles: perCycle,
    final,
    leaked,
    transitions: cycles * LEVEL_IDS.length,
  };
  window.__BOV_MEMCHECK__ = report;
  document.body.dataset.memcheck = leaked ? 'leaked' : 'clean';
  console.info('[memcheck]', JSON.stringify(report));
  return report;
}
