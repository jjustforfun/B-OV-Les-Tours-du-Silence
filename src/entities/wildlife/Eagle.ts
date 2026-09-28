/**
 * Eagle.ts — secret contemplatif posé dans chaque chapitre.
 *
 * L'aigle n'accorde aucun avantage et ne participe jamais au graphe. Il reste
 * une petite silhouette froide jusqu'à sa découverte, puis déploie les ailes
 * une fois : la beauté est l'unique récompense. Toute sa géométrie est
 * procédurale afin de ne charger aucun asset pour un secret optionnel.
 */
import {
  CapsuleGeometry,
  ConeGeometry,
  Group,
  Mesh,
  SphereGeometry,
  type BufferGeometry,
  type Material,
} from 'three';
import { EMBER } from '@render/Palettes';
import {
  bakeToonStoneGeometry,
  createToonStoneMaterial,
} from '@render/materials/ToonStoneMaterial';
import { disposeObject } from '@utils/dispose';

const REVEAL_DURATION_SECONDS = 1.6;

export class Eagle {
  readonly root = new Group();

  private readonly leftWing = new Group();
  private readonly rightWing = new Group();
  private elapsed = REVEAL_DURATION_SECONDS;
  private revealed = false;
  private found = false;

  constructor(initiallyVisible = false) {
    this.root.name = 'Secret:Eagle';
    this.buildVisuals();
    this.root.visible = initiallyVisible;
    this.revealed = initiallyVisible;
  }

  get isVisible(): boolean {
    return this.root.visible;
  }

  get isFound(): boolean {
    return this.found;
  }

  reveal(): void {
    if (this.revealed) return;
    this.revealed = true;
    this.root.visible = true;
    this.elapsed = 0;
  }

  conceal(): void {
    if (this.found) return;
    this.revealed = false;
    this.root.visible = false;
    this.elapsed = REVEAL_DURATION_SECONDS;
  }

  discover(): void {
    this.found = true;
    this.revealed = true;
    this.root.visible = true;
    this.elapsed = 0;
  }

  update(delta: number): void {
    if (!this.root.visible || this.elapsed >= REVEAL_DURATION_SECONDS) return;
    this.elapsed = Math.min(REVEAL_DURATION_SECONDS, this.elapsed + delta);
    const progress = this.elapsed / REVEAL_DURATION_SECONDS;
    const lift = Math.sin(progress * Math.PI);
    const opening = smootherstep(Math.min(1, progress * 1.35));
    this.leftWing.rotation.z = 0.28 + opening * 0.72 - lift * 0.08;
    this.rightWing.rotation.z = -0.28 - opening * 0.72 + lift * 0.08;
    this.root.position.y += lift * delta * 0.025;
  }

  dispose(): void {
    disposeObject(this.root);
  }

  private buildVisuals(): void {
    const feather = this.material(0x303746, 0.2);
    const featherLight = this.material(0x667087, 0.24);
    const beak = this.material(EMBER, 0.14, EMBER, 0.2);

    const body = this.mesh(new CapsuleGeometry(0.07, 0.22, 3, 7), feather);
    body.name = 'EagleBody';
    body.rotation.z = Math.PI / 2;
    body.position.y = 0.12;
    this.root.add(body);

    const head = this.mesh(new SphereGeometry(0.07, 8, 6), featherLight);
    head.name = 'EagleHead';
    head.position.set(0.14, 0.18, 0);
    this.root.add(head);

    const beakMesh = this.mesh(new ConeGeometry(0.025, 0.085, 5), beak);
    beakMesh.name = 'EagleBeak';
    beakMesh.position.set(0.21, 0.17, 0);
    beakMesh.rotation.z = -Math.PI / 2;
    this.root.add(beakMesh);

    this.leftWing.name = 'EagleWingLeft';
    this.rightWing.name = 'EagleWingRight';
    this.leftWing.position.set(0, 0.14, 0.025);
    this.rightWing.position.set(0, 0.14, -0.025);
    const left = this.mesh(new ConeGeometry(0.09, 0.42, 4), feather);
    const right = this.mesh(new ConeGeometry(0.09, 0.42, 4), feather);
    left.position.y = 0.18;
    right.position.y = 0.18;
    this.leftWing.add(left);
    this.rightWing.add(right);
    this.leftWing.rotation.x = Math.PI / 2;
    this.rightWing.rotation.x = -Math.PI / 2;
    this.leftWing.rotation.z = 0.28;
    this.rightWing.rotation.z = -0.28;
    this.root.add(this.leftWing, this.rightWing);
  }

  private mesh(geometry: BufferGeometry, material: Material): Mesh {
    bakeToonStoneGeometry(geometry, {
      color: 0xffffff,
      valueJitter: 0.025,
      aoStrength: 0.28,
    });
    const mesh = new Mesh(geometry, material);
    mesh.castShadow = true;
    return mesh;
  }

  private material(
    color: number,
    rimStrength: number,
    emissive?: number,
    emissiveIntensity = 0,
  ): Material {
    return createToonStoneMaterial(
      emissive === undefined
        ? {
            color,
            steps: 3,
            rimColor: 0xdce8ff,
            rimStrength,
            noiseStrength: 0.035,
          }
        : {
            color,
            steps: 3,
            rimColor: 0xdce8ff,
            rimStrength,
            noiseStrength: 0.035,
            emissive,
            emissiveIntensity,
          },
    );
  }
}

function smootherstep(value: number): number {
  const t = Math.min(1, Math.max(0, value));
  return t * t * t * (t * (t * 6 - 15) + 10);
}
