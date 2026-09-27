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
 *  - tcherkesska **anthracite**, évasée sous la taille ;
 *  - **gazyri argent** : deux rangées symétriques de porte-cartouches sur la
 *    poitrine — LE détail de silhouette, il doit rester lisible à 64 px ;
 *  - **papakha gris clair** : masse claire en haut, avec micro-displacement
 *    géométrique pour accrocher le rim light ;
 *  - ceinture ornée fine, bottes souples, aucun accessoire agressif.
 *
 * Aucune arme. Le kinjal traditionnel n'est pas représenté : écart assumé
 * au nom du caractère non violent du jeu (voir `docs/CULTURE.md`).
 */
import {
  BoxGeometry,
  CapsuleGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  SphereGeometry,
  TorusGeometry,
  type BufferGeometry,
  type Material,
  type Object3D,
} from 'three';
import { TURPAL } from '@/config';
import {
  bakeToonStoneGeometry,
  createToonStoneMaterial,
} from '@render/materials/ToonStoneMaterial';
import { EMBER } from '@render/Palettes';
import type { CharacterClip, ICharacterModel } from '@entities/ICharacterModel';

/** Palette du personnage — les valeurs viennent de `docs/ART_DIRECTION.md`. */
const PALETTE = {
  tcherkesska: 0x2b2f3a,
  tcherkesskaEdge: 0x38404d,
  papakha: 0xb9bec9,
  papakhaShadow: 0x8f96a3,
  gazyri: 0xc8ccd4,
  belt: 0x8a6f3d,
  beltOrnament: 0xd9a441,
  boots: 0x3a3228,
  skin: 0x9b7c62,
  beard: 0x2a2520,
} as const;

interface Pose {
  bodyY: number;
  bodyX: number;
  bodyZ: number;
  hipsZ: number;
  headYaw: number;
  headPitch: number;
  leftArmX: number;
  rightArmX: number;
  leftArmZ: number;
  rightArmZ: number;
  leftForearmX: number;
  rightForearmX: number;
  leftForearmZ: number;
  rightForearmZ: number;
  leftLegX: number;
  rightLegX: number;
  leftLegZ: number;
  rightLegZ: number;
  leftFootX: number;
  rightFootX: number;
  coatFrontX: number;
  coatBackX: number;
  coatLeftZ: number;
  coatRightZ: number;
  papakhaZ: number;
  papakhaY: number;
}

const HEIGHT = TURPAL.height;
const GAZYRI_PER_ROW = 6;
const HIPS_Y = 0.36;
const SPINE_Y = 0.12;
const HEAD_Y = 0.31;
const PAPAKHA_INTERVALS_MS = [8_600, 11_900, 14_200, 9_700] as const;

export class TurpalModel implements ICharacterModel {
  readonly root: Object3D = new Group();
  readonly height = HEIGHT;
  readonly kind = 'procedural' as const;

  private readonly geometries: BufferGeometry[] = [];
  private readonly materials: Material[] = [];

  private readonly hips = new Group();
  private readonly spine = new Group();
  private readonly head = new Group();
  private readonly papakha = new Group();
  private readonly leftArm = new Group();
  private readonly rightArm = new Group();
  private readonly leftForearm = new Group();
  private readonly rightForearm = new Group();
  private readonly leftLeg = new Group();
  private readonly rightLeg = new Group();
  private readonly leftFoot = new Group();
  private readonly rightFoot = new Group();
  private readonly coatFront = new Group();
  private readonly coatBack = new Group();
  private readonly coatLeft = new Group();
  private readonly coatRight = new Group();

  private readonly fromPose = createPose();
  private readonly currentPose = createPose();
  private readonly blendedPose = createPose();

  private currentClip: CharacterClip = 'idle';
  private previousClip: CharacterClip = 'idle';
  private elapsed = 0;
  private clipElapsed = 0;
  private transitionElapsed = 1;
  private transitionDuration = 0.001;
  private papakhaAdjustElapsed = -1;
  private nextPapakhaAdjust = TURPAL.papakhaAdjustMinMs / 1000;
  private papakhaIntervalIndex = 0;

  constructor() {
    this.root.name = 'TurpalModel';
    this.buildSkeleton();
    this.buildGeometry();
    this.applyPose(this.blendedPose);

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

  play(clip: CharacterClip, fadeSeconds = TURPAL.animationBlendMs / 1000): void {
    if (clip === this.currentClip) return;
    this.previousClip = this.currentClip;
    this.currentClip = clip;
    this.clipElapsed = 0;
    this.transitionElapsed = 0;
    this.transitionDuration = Math.max(0.001, fadeSeconds);
  }

  /**
   * Animation procédurale complète : marche, idle, escaliers, salut et ciel.
   * Zéro allocation par image — on ne modifie que des scalaires et des groupes
   * déjà créés au constructeur.
   */
  update(delta: number): void {
    this.elapsed += delta;
    this.clipElapsed += delta;
    this.transitionElapsed = Math.min(this.transitionDuration, this.transitionElapsed + delta);
    this.updatePapakhaScheduler(delta);

    const blend = smootherstep(this.transitionElapsed / this.transitionDuration);
    this.evaluatePose(this.previousClip, this.elapsed, this.fromPose);
    this.evaluatePose(this.currentClip, this.clipElapsed, this.currentPose);
    blendPose(this.fromPose, this.currentPose, blend, this.blendedPose);
    this.applyPose(this.blendedPose);
  }

  dispose(): void {
    for (const geometry of this.geometries) geometry.dispose();
    for (const material of this.materials) material.dispose();
    this.geometries.length = 0;
    this.materials.length = 0;
    this.root.removeFromParent();
    this.root.clear();
  }

  private buildSkeleton(): void {
    this.root.add(this.hips);
    this.hips.name = 'TurpalSkeleton:Hips';
    this.hips.position.y = HIPS_Y;

    this.hips.add(this.spine, this.leftLeg, this.rightLeg);
    this.spine.name = 'TurpalSkeleton:Spine';
    this.spine.position.y = SPINE_Y;

    this.spine.add(this.head, this.leftArm, this.rightArm);
    this.head.name = 'TurpalSkeleton:Head';
    this.head.position.y = HEAD_Y;

    this.leftArm.name = 'TurpalSkeleton:LeftArm';
    this.rightArm.name = 'TurpalSkeleton:RightArm';
    this.leftArm.position.set(-0.135, 0.19, 0.005);
    this.rightArm.position.set(0.135, 0.19, 0.005);
    this.leftArm.add(this.leftForearm);
    this.rightArm.add(this.rightForearm);
    this.leftForearm.name = 'TurpalSkeleton:LeftForearm';
    this.rightForearm.name = 'TurpalSkeleton:RightForearm';
    this.leftForearm.position.y = -0.17;
    this.rightForearm.position.y = -0.17;

    this.leftLeg.name = 'TurpalSkeleton:LeftLeg';
    this.rightLeg.name = 'TurpalSkeleton:RightLeg';
    this.leftLeg.position.set(-0.055, -0.02, 0);
    this.rightLeg.position.set(0.055, -0.02, 0);
    this.leftLeg.add(this.leftFoot);
    this.rightLeg.add(this.rightFoot);
    this.leftFoot.name = 'TurpalSkeleton:LeftFoot';
    this.rightFoot.name = 'TurpalSkeleton:RightFoot';
    this.leftFoot.position.y = -0.27;
    this.rightFoot.position.y = -0.27;

    this.hips.add(this.coatFront, this.coatBack, this.coatLeft, this.coatRight);
    this.coatFront.name = 'TurpalCoat:FrontPanel';
    this.coatBack.name = 'TurpalCoat:BackPanel';
    this.coatLeft.name = 'TurpalCoat:LeftPanel';
    this.coatRight.name = 'TurpalCoat:RightPanel';
  }

  private buildGeometry(): void {
    const coat = this.material(PALETTE.tcherkesska, 0.022, 0.2);
    const coatEdge = this.material(PALETTE.tcherkesskaEdge, 0.02, 0.18);
    const belt = this.material(PALETTE.belt, 0.016, 0.16);
    const ornament = this.material(PALETTE.beltOrnament, 0.012, 0.2, PALETTE.beltOrnament, 0.18);
    const gazyri = this.material(PALETTE.gazyri, 0.01, 0.22);
    const skin = this.material(PALETTE.skin, 0.018, 0.16);
    const beard = this.material(PALETTE.beard, 0.018, 0.12);
    const papakha = this.material(PALETTE.papakha, 0.035, 0.25);
    const papakhaShadow = this.material(PALETTE.papakhaShadow, 0.035, 0.16);
    const boots = this.material(PALETTE.boots, 0.018, 0.14);

    this.mesh(
      'LowerCoatCore',
      new CylinderGeometry(0.125, 0.205, 0.38, 14, 2),
      coat,
      this.hips,
      [0, -0.045, 0],
    );
    this.mesh(
      'Torso',
      new CylinderGeometry(0.118, 0.145, 0.28, 14, 2),
      coat,
      this.spine,
      [0, 0.08, 0],
    );
    this.mesh(
      'Shoulders',
      new CapsuleGeometry(0.055, 0.2, 4, 12),
      coatEdge,
      this.spine,
      [0, 0.21, 0],
      [0, 0, Math.PI / 2],
    );

    this.coatPanel(this.coatFront, coatEdge, [0, -0.14, 0.14], [0.17, 0.34, 0.026]);
    this.coatPanel(this.coatBack, coat, [0, -0.14, -0.135], [0.18, 0.34, 0.024]);
    this.coatPanel(this.coatLeft, coat, [-0.14, -0.14, 0], [0.024, 0.34, 0.17]);
    this.coatPanel(this.coatRight, coat, [0.14, -0.14, 0], [0.024, 0.34, 0.17]);

    this.mesh(
      'Belt',
      new CylinderGeometry(0.151, 0.151, 0.026, 14, 1),
      belt,
      this.hips,
      [0, 0.06, 0],
    );
    this.mesh(
      'BeltOrnament',
      new TorusGeometry(0.028, 0.004, 4, 10),
      ornament,
      this.hips,
      [0, 0.061, 0.151],
    );

    for (let row = 0; row < 2; row += 1) {
      const side = row === 0 ? -1 : 1;
      for (let i = 0; i < GAZYRI_PER_ROW; i += 1) {
        const y = 0.11 + i * 0.026;
        const gazyr = this.mesh(
          'Gazyr',
          new CapsuleGeometry(0.008, 0.04, 2, 6),
          gazyri,
          this.spine,
          [side * 0.047, y, 0.124],
          [Math.PI / 2, 0, 0.08 * -side],
        );
        gazyr.scale.x = 0.82;
      }
    }

    this.mesh('Head', new SphereGeometry(0.062, 14, 10), skin, this.head, [0, 0, 0.004]);
    this.mesh(
      'Beard',
      new SphereGeometry(0.049, 10, 7),
      beard,
      this.head,
      [0, -0.02, 0.034],
      [-0.12, 0, 0],
    ).scale.set(0.92, 0.72, 0.6);

    this.head.add(this.papakha);
    this.papakha.name = 'TurpalPapakha';
    this.papakha.position.y = 0.07;
    this.mesh(
      'PapakhaCrown',
      roughenPapakha(new CylinderGeometry(0.082, 0.074, 0.088, 18, 4)),
      papakha,
      this.papakha,
      [0, 0, 0],
    );
    this.mesh(
      'PapakhaBand',
      new TorusGeometry(0.081, 0.008, 5, 18),
      papakhaShadow,
      this.papakha,
      [0, -0.046, 0],
    );

    this.limb(this.leftArm, coatEdge, 'LeftUpperArm', -0.085, 0.023, 0.17);
    this.limb(this.rightArm, coatEdge, 'RightUpperArm', -0.085, 0.023, 0.17);
    this.limb(this.leftForearm, coat, 'LeftForearm', -0.075, 0.021, 0.15);
    this.limb(this.rightForearm, coat, 'RightForearm', -0.075, 0.021, 0.15);
    this.mesh('LeftHand', new SphereGeometry(0.021, 8, 6), skin, this.leftForearm, [0, -0.155, 0]);
    this.mesh(
      'RightHand',
      new SphereGeometry(0.021, 8, 6),
      skin,
      this.rightForearm,
      [0, -0.155, 0],
    );

    this.leg(this.leftLeg, boots, 'LeftLeg');
    this.leg(this.rightLeg, boots, 'RightLeg');
    this.mesh(
      'LeftBoot',
      new CapsuleGeometry(0.026, 0.082, 3, 8),
      boots,
      this.leftFoot,
      [0, -0.018, 0.032],
      [Math.PI / 2, 0, 0],
    ).scale.set(1.35, 0.72, 1);
    this.mesh(
      'RightBoot',
      new CapsuleGeometry(0.026, 0.082, 3, 8),
      boots,
      this.rightFoot,
      [0, -0.018, 0.032],
      [Math.PI / 2, 0, 0],
    ).scale.set(1.35, 0.72, 1);
  }

  private evaluatePose(clip: CharacterClip, time: number, pose: Pose): void {
    resetPose(pose);
    const walkPhase = time * 8.7;
    const walkSwing = Math.sin(walkPhase);
    const walkLift = Math.abs(Math.cos(walkPhase));
    const breath = Math.sin(time * 1.38);

    pose.bodyY = breath * 0.004;
    pose.bodyZ = Math.sin(time * 0.9) * 0.006;
    pose.headYaw = Math.sin(time * 0.43) * 0.22 + Math.sin(time * 0.17) * 0.09;
    pose.headPitch = Math.sin(time * 0.31) * 0.045;
    pose.leftArmZ = 0.13;
    pose.rightArmZ = -0.13;
    pose.leftForearmX = -0.05;
    pose.rightForearmX = -0.05;
    pose.coatFrontX = -0.03;
    pose.coatBackX = 0.02;
    pose.coatLeftZ = -0.02;
    pose.coatRightZ = 0.02;

    if (clip === 'idle' || clip === 'idleLong') {
      const longLook = clip === 'idleLong' ? 1 : 0;
      pose.headYaw += Math.sin(time * 0.27) * 0.18 * longLook;
      pose.headPitch -= 0.04 * longLook;
      this.applyPapakhaAdjustment(pose);
      return;
    }

    if (clip === 'walk') {
      pose.bodyY = walkLift * 0.012;
      pose.bodyZ = walkSwing * 0.025;
      pose.hipsZ = -walkSwing * 0.018;
      pose.leftLegX = walkSwing * 0.42;
      pose.rightLegX = -walkSwing * 0.42;
      pose.leftFootX = Math.max(0, walkSwing) * -0.16;
      pose.rightFootX = Math.max(0, -walkSwing) * -0.16;
      pose.leftArmX = -walkSwing * 0.22;
      pose.rightArmX = walkSwing * 0.22;
      pose.coatFrontX = Math.sin(walkPhase + 0.7) * 0.065;
      pose.coatBackX = -Math.sin(walkPhase + 0.4) * 0.05;
      pose.coatLeftZ = -0.035 + Math.sin(walkPhase + 1.1) * 0.055;
      pose.coatRightZ = 0.035 + Math.sin(walkPhase + 1.1) * 0.055;
      return;
    }

    if (clip === 'stepUp' || clip === 'stepDown') {
      const direction = clip === 'stepUp' ? 1 : -1;
      const phase = smootherstep(Math.min(time / 0.72, 1));
      const footLift = Math.sin(phase * Math.PI);
      pose.bodyY = direction * phase * 0.025 + footLift * 0.01;
      pose.bodyX = -direction * 0.06;
      pose.leftLegX = 0.34 * footLift;
      pose.rightLegX = -0.18 * footLift;
      pose.leftFootX = -0.35 * footLift;
      pose.coatFrontX = 0.08 * footLift;
      pose.coatBackX = -0.035 * footLift;
      pose.leftArmX = -0.12 * footLift;
      pose.rightArmX = 0.1 * footLift;
      return;
    }

    if (clip === 'salute' || clip === 'contemplate') {
      const phase = smootherstep(Math.min(time / (TURPAL.saluteMs / 1000), 1));
      pose.bodyX = 0.09 * phase;
      pose.headPitch = 0.08 * phase;
      pose.rightArmX = -0.52 * phase;
      pose.rightArmZ = -0.88 * phase;
      pose.rightForearmX = -1.18 * phase;
      pose.rightForearmZ = -0.38 * phase;
      pose.leftArmZ = 0.1;
      return;
    }

    if (clip === 'lookSky') {
      const phase = smootherstep(Math.min(time / (TURPAL.skyLookMs / 1000), 1));
      pose.bodyX = -0.08 * phase;
      pose.headPitch = -0.62 * phase;
      pose.headYaw = Math.sin(time * 0.34) * 0.08;
      pose.leftArmZ = 0.16;
      pose.rightArmZ = -0.16;
      pose.coatBackX = -0.04 * phase;
      return;
    }

    if (clip === 'arrive') {
      const settle = Math.exp(-time * 4.2) * Math.sin(time * 11);
      pose.bodyY = settle * 0.009;
      pose.coatFrontX = settle * 0.045;
    }
  }

  private applyPose(pose: Pose): void {
    this.hips.position.y = HIPS_Y + pose.bodyY;
    this.hips.rotation.z = pose.hipsZ;
    this.spine.position.y = SPINE_Y;
    this.spine.rotation.x = pose.bodyX;
    this.spine.rotation.z = pose.bodyZ;
    this.head.rotation.y = pose.headYaw;
    this.head.rotation.x = pose.headPitch;

    this.leftArm.rotation.x = pose.leftArmX;
    this.rightArm.rotation.x = pose.rightArmX;
    this.leftArm.rotation.z = pose.leftArmZ;
    this.rightArm.rotation.z = pose.rightArmZ;
    this.leftForearm.rotation.x = pose.leftForearmX;
    this.rightForearm.rotation.x = pose.rightForearmX;
    this.leftForearm.rotation.z = pose.leftForearmZ;
    this.rightForearm.rotation.z = pose.rightForearmZ;

    this.leftLeg.rotation.x = pose.leftLegX;
    this.rightLeg.rotation.x = pose.rightLegX;
    this.leftLeg.rotation.z = pose.leftLegZ;
    this.rightLeg.rotation.z = pose.rightLegZ;
    this.leftFoot.rotation.x = pose.leftFootX;
    this.rightFoot.rotation.x = pose.rightFootX;

    this.coatFront.rotation.x = pose.coatFrontX;
    this.coatBack.rotation.x = pose.coatBackX;
    this.coatLeft.rotation.z = pose.coatLeftZ;
    this.coatRight.rotation.z = pose.coatRightZ;
    this.papakha.rotation.z = pose.papakhaZ;
    this.papakha.position.y = 0.07 + pose.papakhaY;
  }

  private updatePapakhaScheduler(delta: number): void {
    if (this.papakhaAdjustElapsed >= 0) {
      this.papakhaAdjustElapsed += delta;
      if (this.papakhaAdjustElapsed >= TURPAL.papakhaAdjustMs / 1000) {
        this.papakhaAdjustElapsed = -1;
      }
      return;
    }

    if (this.currentClip !== 'idle' && this.currentClip !== 'idleLong') return;
    if (this.elapsed < this.nextPapakhaAdjust) return;

    this.papakhaAdjustElapsed = 0;
    const intervalMs =
      PAPAKHA_INTERVALS_MS[this.papakhaIntervalIndex % PAPAKHA_INTERVALS_MS.length];
    this.papakhaIntervalIndex += 1;
    this.nextPapakhaAdjust =
      this.elapsed +
      Math.min(
        TURPAL.papakhaAdjustMaxMs,
        Math.max(TURPAL.papakhaAdjustMinMs, intervalMs ?? TURPAL.papakhaAdjustMinMs),
      ) /
        1000;
  }

  private applyPapakhaAdjustment(pose: Pose): void {
    if (this.papakhaAdjustElapsed < 0) return;
    const duration = TURPAL.papakhaAdjustMs / 1000;
    const phase = this.papakhaAdjustElapsed / duration;
    const reach = Math.sin(Math.min(1, phase) * Math.PI);
    pose.rightArmX += -0.7 * reach;
    pose.rightArmZ += -0.92 * reach;
    pose.rightForearmX += -1.05 * reach;
    pose.papakhaZ += Math.sin(phase * Math.PI * 2) * 0.035 * reach;
    pose.papakhaY += reach * 0.006;
  }

  private material(
    color: number,
    noiseStrength: number,
    rimStrength: number,
    emissive?: number,
    emissiveIntensity = 0,
  ): Material {
    const material = createToonStoneMaterial(
      emissive === undefined
        ? { color, steps: 3, rimColor: EMBER, rimStrength, noiseStrength }
        : {
            color,
            steps: 3,
            rimColor: EMBER,
            rimStrength,
            noiseStrength,
            emissive,
            emissiveIntensity,
          },
    );
    this.materials.push(material);
    return material;
  }

  private coatPanel(
    parent: Object3D,
    material: Material,
    position: readonly [number, number, number],
    size: readonly [number, number, number],
  ): void {
    this.mesh(
      'TcherkesskaPanel',
      new BoxGeometry(size[0], size[1], size[2]),
      material,
      parent,
      position,
    );
  }

  private limb(
    parent: Object3D,
    material: Material,
    name: string,
    y: number,
    radius: number,
    length: number,
  ): void {
    this.mesh(name, new CapsuleGeometry(radius, length, 4, 10), material, parent, [0, y, 0]);
  }

  private leg(parent: Object3D, material: Material, name: string): void {
    this.mesh(name, new CapsuleGeometry(0.029, 0.22, 4, 10), material, parent, [0, -0.12, 0]);
  }

  private mesh(
    name: string,
    geometry: BufferGeometry,
    material: Material,
    parent: Object3D,
    position: readonly [number, number, number],
    rotation?: readonly [number, number, number],
  ): Mesh {
    bakeToonStoneGeometry(geometry, { color: 0xffffff, aoStrength: 0.34, valueJitter: 0.025 });
    const mesh = new Mesh(geometry, material);
    mesh.name = name;
    mesh.position.set(position[0], position[1], position[2]);
    if (rotation) mesh.rotation.set(rotation[0], rotation[1], rotation[2]);
    parent.add(mesh);
    this.geometries.push(geometry);
    return mesh;
  }
}

function createPose(): Pose {
  return {
    bodyY: 0,
    bodyX: 0,
    bodyZ: 0,
    hipsZ: 0,
    headYaw: 0,
    headPitch: 0,
    leftArmX: 0,
    rightArmX: 0,
    leftArmZ: 0,
    rightArmZ: 0,
    leftForearmX: 0,
    rightForearmX: 0,
    leftForearmZ: 0,
    rightForearmZ: 0,
    leftLegX: 0,
    rightLegX: 0,
    leftLegZ: 0,
    rightLegZ: 0,
    leftFootX: 0,
    rightFootX: 0,
    coatFrontX: 0,
    coatBackX: 0,
    coatLeftZ: 0,
    coatRightZ: 0,
    papakhaZ: 0,
    papakhaY: 0,
  };
}

function resetPose(pose: Pose): void {
  pose.bodyY = 0;
  pose.bodyX = 0;
  pose.bodyZ = 0;
  pose.hipsZ = 0;
  pose.headYaw = 0;
  pose.headPitch = 0;
  pose.leftArmX = 0;
  pose.rightArmX = 0;
  pose.leftArmZ = 0;
  pose.rightArmZ = 0;
  pose.leftForearmX = 0;
  pose.rightForearmX = 0;
  pose.leftForearmZ = 0;
  pose.rightForearmZ = 0;
  pose.leftLegX = 0;
  pose.rightLegX = 0;
  pose.leftLegZ = 0;
  pose.rightLegZ = 0;
  pose.leftFootX = 0;
  pose.rightFootX = 0;
  pose.coatFrontX = 0;
  pose.coatBackX = 0;
  pose.coatLeftZ = 0;
  pose.coatRightZ = 0;
  pose.papakhaZ = 0;
  pose.papakhaY = 0;
}

function blendPose(from: Pose, to: Pose, alpha: number, target: Pose): void {
  target.bodyY = mix(from.bodyY, to.bodyY, alpha);
  target.bodyX = mix(from.bodyX, to.bodyX, alpha);
  target.bodyZ = mix(from.bodyZ, to.bodyZ, alpha);
  target.hipsZ = mix(from.hipsZ, to.hipsZ, alpha);
  target.headYaw = mix(from.headYaw, to.headYaw, alpha);
  target.headPitch = mix(from.headPitch, to.headPitch, alpha);
  target.leftArmX = mix(from.leftArmX, to.leftArmX, alpha);
  target.rightArmX = mix(from.rightArmX, to.rightArmX, alpha);
  target.leftArmZ = mix(from.leftArmZ, to.leftArmZ, alpha);
  target.rightArmZ = mix(from.rightArmZ, to.rightArmZ, alpha);
  target.leftForearmX = mix(from.leftForearmX, to.leftForearmX, alpha);
  target.rightForearmX = mix(from.rightForearmX, to.rightForearmX, alpha);
  target.leftForearmZ = mix(from.leftForearmZ, to.leftForearmZ, alpha);
  target.rightForearmZ = mix(from.rightForearmZ, to.rightForearmZ, alpha);
  target.leftLegX = mix(from.leftLegX, to.leftLegX, alpha);
  target.rightLegX = mix(from.rightLegX, to.rightLegX, alpha);
  target.leftLegZ = mix(from.leftLegZ, to.leftLegZ, alpha);
  target.rightLegZ = mix(from.rightLegZ, to.rightLegZ, alpha);
  target.leftFootX = mix(from.leftFootX, to.leftFootX, alpha);
  target.rightFootX = mix(from.rightFootX, to.rightFootX, alpha);
  target.coatFrontX = mix(from.coatFrontX, to.coatFrontX, alpha);
  target.coatBackX = mix(from.coatBackX, to.coatBackX, alpha);
  target.coatLeftZ = mix(from.coatLeftZ, to.coatLeftZ, alpha);
  target.coatRightZ = mix(from.coatRightZ, to.coatRightZ, alpha);
  target.papakhaZ = mix(from.papakhaZ, to.papakhaZ, alpha);
  target.papakhaY = mix(from.papakhaY, to.papakhaY, alpha);
}

function roughenPapakha(geometry: BufferGeometry): BufferGeometry {
  const position = geometry.getAttribute('position');
  for (let i = 0; i < position.count; i += 1) {
    const x = position.getX(i);
    const y = position.getY(i);
    const z = position.getZ(i);
    const radial = Math.hypot(x, z);
    if (radial <= 0.0001) continue;
    const displacement = (Math.sin(y * 120 + x * 47) + Math.sin(z * 83 + y * 31)) * 0.0017;
    const scale = (radial + displacement) / radial;
    position.setXYZ(i, x * scale, y + Math.sin(x * 67 + z * 59) * 0.0009, z * scale);
  }
  position.needsUpdate = true;
  geometry.computeVertexNormals();
  return geometry;
}

function smootherstep(value: number): number {
  const t = Math.min(1, Math.max(0, value));
  return t * t * t * (t * (t * 6 - 15) + 10);
}

function mix(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
