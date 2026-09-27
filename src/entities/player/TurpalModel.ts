/**
 * TurpalModel.ts — le modèle procédural de Turpal (v1, ADR-006).
 *
 * Construit intégralement en code à partir de primitives low-poly : aucun
 * asset à télécharger, une silhouette immédiatement testable, et zéro
 * dépendance à un pipeline DCC tant que le gameplay n'est pas figé.
 * Remplaçable par un GLB via `ICharacterModel` sans toucher au reste.
 *
 * Fiche de personnage, à respecter à la lettre (`brief.yaml`,
 * `docs/ART_DIRECTION.md`) :
 *  - homme d'environ 35 ans, barbe courte, regard calme ;
 *  - tcherkesska **anthracite**, longue, taille marquée ;
 *  - **gazyri argent** : deux rangées symétriques de porte-cartouches sur la
 *    poitrine — LE détail de silhouette, il doit rester lisible à 64 px ;
 *  - **papakha gris clair** : masse claire en haut, elle ancre le regard
 *    quand Turpal ne fait qu'un vingtième de la hauteur d'écran ;
 *  - ceinture ornée fine et contrastée ;
 *  - bottes souples en cuir, semelle plate.
 *
 * Aucune arme. Le kinjal traditionnel n'est pas représenté : écart assumé
 * au nom du caractère non violent du jeu (voir `docs/CULTURE.md`).
 *
 * Budget : ≤ 6 000 triangles. La v1 procédurale en consomme ~600.
 */
import {
  BoxGeometry,
  CapsuleGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  SphereGeometry,
  type BufferGeometry,
  type Material,
  type Object3D,
} from 'three';
import { createToonStoneMaterial } from '@render/materials/ToonStoneMaterial';
import type { CharacterClip, ICharacterModel } from '@entities/ICharacterModel';
import { breathe } from '@utils/easing';

/** Palette du personnage — les valeurs viennent de `docs/ART_DIRECTION.md`. */
const PALETTE = {
  tcherkesska: 0x2b2f3a,
  papakha: 0xb9bec9,
  gazyri: 0xc8ccd4,
  belt: 0x8a6f3d,
  boots: 0x3a3228,
  skin: 0x9b7c62,
  beard: 0x2a2520,
} as const;

const HEIGHT = 0.85;
const GAZYRI_PER_ROW = 6;

export class TurpalModel implements ICharacterModel {
  readonly root: Object3D = new Group();
  readonly height = HEIGHT;
  readonly kind = 'procedural' as const;

  private readonly geometries: BufferGeometry[] = [];
  private readonly materials: Material[] = [];
  private readonly torso: Object3D;
  private currentClip: CharacterClip = 'idle';
  private elapsed = 0;

  constructor() {
    this.root.name = 'TurpalModel';

    const coat = this.material(PALETTE.tcherkesska, 3);

    // Tcherkesska : un tronc légèrement conique, taille marquée par la ceinture.
    this.torso = this.mesh(
      new CylinderGeometry(0.135, 0.185, HEIGHT * 0.56, 8, 1),
      coat,
      [0, HEIGHT * 0.52, 0],
    );

    // Épaules — une capsule aplatie suffit à donner de la carrure en isométrie.
    this.mesh(
      new CapsuleGeometry(0.115, 0.1, 3, 8),
      coat,
      [0, HEIGHT * 0.76, 0],
      this.torso,
      [0, 0, Math.PI / 2],
    );

    // Ceinture ornée.
    this.mesh(
      new CylinderGeometry(0.143, 0.143, 0.035, 8, 1),
      this.material(PALETTE.belt, 3),
      [0, HEIGHT * 0.5, 0],
    );

    // Gazyri : deux rangées symétriques. Le détail qui signe la silhouette.
    const gazyriMaterial = this.material(PALETTE.gazyri, 3);
    for (let row = 0; row < 2; row += 1) {
      const side = row === 0 ? -1 : 1;
      for (let i = 0; i < GAZYRI_PER_ROW; i += 1) {
        this.mesh(
          new BoxGeometry(0.018, 0.052, 0.014),
          gazyriMaterial,
          [side * 0.052, HEIGHT * (0.64 + i * 0.026), 0.126],
        );
      }
    }

    // Tête, barbe courte, papakha gris clair.
    this.mesh(new SphereGeometry(0.072, 10, 8), this.material(PALETTE.skin, 4), [
      0,
      HEIGHT * 0.88,
      0,
    ]);
    this.mesh(new SphereGeometry(0.058, 8, 6), this.material(PALETTE.beard, 3), [
      0,
      HEIGHT * 0.855,
      0.028,
    ]);
    this.mesh(
      new CylinderGeometry(0.086, 0.078, 0.086, 10, 1),
      this.material(PALETTE.papakha, 4),
      [0, HEIGHT * 0.965, 0],
    );

    // Bottes souples : deux blocs bas, semelle plate, aucun talon.
    const boots = this.material(PALETTE.boots, 3);
    this.mesh(new BoxGeometry(0.072, 0.09, 0.115), boots, [-0.055, 0.045, 0.012]);
    this.mesh(new BoxGeometry(0.072, 0.09, 0.115), boots, [0.055, 0.045, 0.012]);

    this.root.traverse((child) => {
      if (child instanceof Mesh) {
        child.castShadow = true;
        child.receiveShadow = false;
      }
    });
  }

  get triangleCount(): number {
    let total = 0;
    for (const geometry of this.geometries) {
      const index = geometry.getIndex();
      const position = geometry.getAttribute('position');
      total += index ? index.count / 3 : position.count / 3;
    }
    return Math.round(total);
  }

  get clip(): CharacterClip {
    return this.currentClip;
  }

  play(clip: CharacterClip, _fadeSeconds = 0.3): void {
    // v1 : les clips sont procéduraux (voir update). Le fondu deviendra réel
    // avec les AnimationActions du GLB en v2.
    this.currentClip = clip;
  }

  /**
   * Animation procédurale : respiration au repos, balancement à la marche.
   * Zéro allocation par image (AGENTS.md § 4) — on n'écrit que des scalaires.
   */
  update(delta: number): void {
    this.elapsed += delta;

    if (this.currentClip === 'walk') {
      this.torso.rotation.z = Math.sin(this.elapsed * 9) * 0.045;
      this.torso.position.y = HEIGHT * 0.52 + Math.abs(Math.sin(this.elapsed * 9)) * 0.012;
      return;
    }

    // Au repos : une respiration lente, presque imperceptible. C'est elle qui
    // fait la différence entre un personnage vivant et une statue.
    const breath = breathe(this.elapsed * 0.22);
    this.torso.rotation.z = 0;
    this.torso.position.y = HEIGHT * 0.52 + (breath - 0.5) * 0.008;
  }

  dispose(): void {
    for (const geometry of this.geometries) geometry.dispose();
    for (const material of this.materials) material.dispose();
    this.geometries.length = 0;
    this.materials.length = 0;
    this.root.removeFromParent();
    this.root.clear();
  }

  private material(color: number, steps: 3 | 4 | 5): Material {
    const material = createToonStoneMaterial({ color, steps });
    this.materials.push(material);
    return material;
  }

  private mesh(
    geometry: BufferGeometry,
    material: Material,
    position: readonly [number, number, number],
    parent: Object3D = this.root,
    rotation?: readonly [number, number, number],
  ): Mesh {
    const mesh = new Mesh(geometry, material);
    mesh.position.set(position[0], position[1], position[2]);
    if (rotation) mesh.rotation.set(rotation[0], rotation[1], rotation[2]);
    parent.add(mesh);
    this.geometries.push(geometry);
    return mesh;
  }
}
