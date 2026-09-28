/**
 * Enfant témoin — silhouette muette assise au bord de la gorge.
 *
 * Il ne donne ni quête ni instruction. Quand la promesse du pont est tenue,
 * il se lève et rit : la conséquence humaine du geste reste lisible sans UI.
 */
import {
  CapsuleGeometry,
  Group,
  Mesh,
  MeshToonMaterial,
  SphereGeometry,
  type BufferGeometry,
  type Material,
} from 'three';
import { bus } from '@core/EventBus';

export class Child {
  readonly root = new Group();

  private readonly body = new Group();
  private readonly head: Mesh;
  private readonly leftLeg: Mesh;
  private readonly rightLeg: Mesh;
  private readonly geometries: BufferGeometry[] = [];
  private readonly materials: Material[] = [];
  private pose = 0;
  private targetPose = 0;
  private elapsed = 0;
  private reacted = false;

  constructor(readonly id: string) {
    this.root.name = `Child:${id}`;

    const skin = this.material(0xd69a72);
    const felt = this.material(0x315969);
    const cloth = this.material(0x49aeb0);
    const dark = this.material(0x242d36);

    const torso = this.mesh(new CapsuleGeometry(0.22, 0.48, 3, 7), cloth);
    torso.scale.set(0.9, 1, 0.7);
    this.body.add(torso);

    this.head = this.mesh(new SphereGeometry(0.25, 10, 7), skin);
    this.body.add(this.head);

    const cap = this.mesh(new SphereGeometry(0.265, 10, 5, 0, Math.PI * 2, 0, 1.35), felt);
    cap.scale.y = 0.72;
    this.body.add(cap);

    this.leftLeg = this.mesh(new CapsuleGeometry(0.085, 0.38, 3, 6), dark);
    this.rightLeg = this.mesh(new CapsuleGeometry(0.085, 0.38, 3, 6), dark);
    this.leftLeg.position.x = -0.12;
    this.rightLeg.position.x = 0.12;
    this.body.add(this.leftLeg, this.rightLeg);

    const leftArm = this.mesh(new CapsuleGeometry(0.065, 0.36, 3, 6), cloth);
    const rightArm = this.mesh(new CapsuleGeometry(0.065, 0.36, 3, 6), cloth);
    leftArm.position.x = -0.27;
    rightArm.position.x = 0.27;
    leftArm.rotation.z = -0.18;
    rightArm.rotation.z = 0.18;
    this.body.add(leftArm, rightArm);

    this.root.add(this.body);
    this.applyPose();
  }

  get hasReacted(): boolean {
    return this.reacted;
  }

  celebrate(): void {
    if (this.reacted) return;
    this.reacted = true;
    this.targetPose = 1;
    bus.emit('child:bridgeReady', { id: this.id });
  }

  update(delta: number): void {
    this.elapsed += delta;
    const direction = Math.sign(this.targetPose - this.pose);
    this.pose = Math.min(1, Math.max(0, this.pose + direction * delta * 1.8));
    this.applyPose();
    if (this.reacted) this.body.rotation.y = Math.sin(this.elapsed * 5) * 0.1;
  }

  dispose(): void {
    for (const geometry of this.geometries) geometry.dispose();
    for (const material of this.materials) material.dispose();
    this.root.removeFromParent();
    this.root.clear();
  }

  private applyPose(): void {
    const smooth = this.pose * this.pose * (3 - 2 * this.pose);
    this.body.position.y = 0.55 + smooth * 0.35;
    this.head.position.y = 0.58 + smooth * 0.22;
    this.leftLeg.position.y = -0.38 + smooth * 0.02;
    this.rightLeg.position.y = -0.38 + smooth * 0.02;
    this.leftLeg.rotation.x = (1 - smooth) * 1.25;
    this.rightLeg.rotation.x = (1 - smooth) * 1.25;
    this.leftLeg.rotation.z = -0.05 - smooth * 0.04;
    this.rightLeg.rotation.z = 0.05 + smooth * 0.04;
  }

  private mesh(geometry: BufferGeometry, material: Material): Mesh {
    this.geometries.push(geometry);
    const mesh = new Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  }

  private material(color: number): MeshToonMaterial {
    const material = new MeshToonMaterial({ color });
    this.materials.push(material);
    return material;
  }
}
