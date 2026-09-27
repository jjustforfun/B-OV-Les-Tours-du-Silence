/**
 * TurpalShowcaseScene.ts — présentation de Turpal sous quatre angles.
 *
 * Scène de revue artistique : quatre instances du même `TurpalModel`
 * procédural, orientées face / profil / dos / trois-quarts, avec des clips
 * différents pour vérifier la silhouette et les animations à petite taille.
 */
import { Box3, CylinderGeometry, Group, Mesh, type Material } from 'three';
import { type QualitySettings } from '@/config';
import { TurpalModel } from '@entities/player/TurpalModel';
import { CHAPTER_PALETTES } from '@render/Palettes';
import {
  bakeToonStoneGeometry,
  createToonStoneMaterial,
} from '@render/materials/ToonStoneMaterial';

interface ShowcaseEntry {
  readonly model: TurpalModel;
  readonly phase: number;
}

export class TurpalShowcaseScene {
  readonly root = new Group();
  readonly bounds = new Box3();

  private readonly entries: ShowcaseEntry[] = [];
  private readonly plinthMaterial: Material;

  constructor(_quality: QualitySettings) {
    this.root.name = 'TurpalShowcaseScene';
    this.plinthMaterial = createToonStoneMaterial({
      color: CHAPTER_PALETTES.prologue.stoneShadow,
      steps: 3,
      rimStrength: 0.12,
      noiseStrength: 0.07,
    });

    this.addTurpal(-1.65, 0, 'idle', 0);
    this.addTurpal(-0.55, Math.PI * 0.5, 'walk', 0.35);
    this.addTurpal(0.55, Math.PI, 'salute', 0.7);
    this.addTurpal(1.65, -Math.PI * 0.25, 'lookSky', 1.05);

    this.bounds.setFromObject(this.root).expandByScalar(0.35);
  }

  update(elapsed: number, delta: number): void {
    for (const entry of this.entries) {
      entry.model.update(delta);
      entry.model.root.position.y = Math.sin(elapsed * 0.8 + entry.phase) * 0.006;
    }
  }

  applyQuality(_quality: QualitySettings): void {
    // La revue de personnage ne possède ni particules ni postures dépendantes
    // de la qualité ; elle garde ce point d'accroche pour `main.ts`.
  }

  private addTurpal(
    x: number,
    rotationY: number,
    clip: 'idle' | 'walk' | 'salute' | 'lookSky',
    phase: number,
  ): void {
    const plinthGeometry = bakeToonStoneGeometry(new CylinderGeometry(0.32, 0.38, 0.08, 16, 1), {
      color: 0xffffff,
      valueJitter: 0.05,
    });
    const plinth = new Mesh(plinthGeometry, this.plinthMaterial);
    plinth.name = 'TurpalShowcasePlinth';
    plinth.position.set(x, 0.04, 0);
    plinth.receiveShadow = true;
    this.root.add(plinth);

    const model = new TurpalModel();
    model.root.name = `TurpalShowcase:${clip}`;
    model.root.position.set(x, 0.08, 0);
    model.root.rotation.y = rotationY;
    model.play(clip, 0.001);
    this.root.add(model.root);
    this.entries.push({ model, phase });
  }
}
