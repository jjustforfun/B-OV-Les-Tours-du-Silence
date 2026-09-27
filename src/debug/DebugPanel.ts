/**
 * DebugPanel.ts — panneau lil-gui, développement uniquement.
 *
 * Statut : squelette. Importé dynamiquement par main.ts afin que lil-gui
 * n'entre jamais dans le bundle de production (contrainte de poids).
 *
 * Contrôles prévus : niveau de qualité forcé, palette de ciel, visualisation
 * du graphe de navigation, caméra libre, saut direct vers un chapitre.
 */
import GUI from 'lil-gui';
import type { Engine } from '@core/Engine';
import { SKY_PALETTES, type SkyPaletteName } from '@render/Sky';
import { QUALITY_TIERS, type QualityTier } from '@/config';

export class DebugPanel {
  private readonly gui: GUI;

  constructor(private readonly engine: Engine) {
    this.gui = new GUI({ title: 'BӀOV — debug', width: 260 });
    this.gui.close();

    const state = {
      quality: engine.quality.current,
      sky: 'dawn' as SkyPaletteName,
    };

    this.gui
      .add(state, 'quality', [...QUALITY_TIERS])
      .name('Qualité')
      .onChange((tier: QualityTier) => this.engine.quality.setTier(tier, 'user'));

    this.gui
      .add(state, 'sky', Object.keys(SKY_PALETTES))
      .name('Ciel')
      .onChange((name: SkyPaletteName) => this.engine.sky.applyNamed(name));

    // TODO(phase Debug) : NavGraphViz, caméra libre, sélecteur de chapitre.
  }

  dispose(): void {
    this.gui.destroy();
  }
}
