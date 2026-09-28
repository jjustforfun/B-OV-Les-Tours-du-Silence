/**
 * Elder.ts — l'ancien de Nikaroy.
 *
 * Il n'est jamais commandé par le joueur et ne se presse jamais. Entre deux
 * travées préparées, son corps continue un très petit pas circulaire autour de
 * la stèle voisine : l'animation ne transforme donc jamais l'attente en échec.
 */
import {
  CapsuleGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshToonMaterial,
  SphereGeometry,
  Vector3,
} from 'three';
import type { NavGraph, NodeId } from '@world/NavGraph';
import { disposeObject } from '@utils/dispose';

const ELDER_SPEED = 0.48;
const ARRIVAL_EPSILON = 0.02;

export class Elder {
  readonly root = new Group();

  private readonly body = new Group();
  private readonly head = new Group();
  private readonly leftLeg = new Group();
  private readonly rightLeg = new Group();
  private readonly staff = new Group();
  private readonly route: Vector3[] = [];
  private readonly target = new Vector3();
  private routeIndex = 0;
  private elapsed = 0;
  private moving = false;
  private completionPending = false;
  private indicating = 0;

  constructor(readonly id: string) {
    this.root.name = `Actor:Elder:${id}`;
    this.buildModel();
  }

  get isMoving(): boolean {
    return this.moving;
  }

  placeAt(graph: NavGraph, nodeId: NodeId): void {
    const node = graph.getNode(nodeId);
    if (node === undefined) return;
    this.root.position.set(node.position.x, node.position.y, node.position.z);
  }

  start(graph: NavGraph, path: readonly NodeId[]): boolean {
    if (this.moving) return false;
    this.route.length = 0;
    for (const id of path) {
      const node = graph.getNode(id);
      if (node === undefined) continue;
      this.route.push(new Vector3(node.position.x, node.position.y, node.position.z));
    }
    if (this.route.length < 2) {
      this.route.length = 0;
      return false;
    }
    this.root.position.copy(this.route[0] ?? this.root.position);
    this.routeIndex = 1;
    this.moving = true;
    this.completionPending = false;
    return true;
  }

  /** Le geste final du menton désigne la route révélée, sans texte ni flèche. */
  indicate(): void {
    this.indicating = 2.2;
  }

  /** Retourne vrai une seule fois à la fin d'une travée. */
  update(delta: number): boolean {
    this.elapsed += delta;
    const stride = Math.sin(this.elapsed * (this.moving ? 5.2 : 3.2));
    this.leftLeg.rotation.x = stride * 0.22;
    this.rightLeg.rotation.x = -stride * 0.22;
    this.staff.rotation.z = 0.1 + Math.max(0, stride) * 0.055;

    if (this.moving) {
      this.body.position.set(0, Math.abs(stride) * 0.016, 0);
      this.advance(delta);
    } else {
      this.body.position.set(
        Math.sin(this.elapsed * 1.1) * 0.035,
        0,
        Math.cos(this.elapsed * 1.1) * 0.035,
      );
    }

    if (this.indicating > 0) {
      this.indicating = Math.max(0, this.indicating - delta);
      const gesture = Math.sin((1 - this.indicating / 2.2) * Math.PI);
      this.head.rotation.x = -gesture * 0.2;
      this.head.rotation.y = gesture * 0.35;
    } else {
      this.head.rotation.x *= 0.9;
      this.head.rotation.y *= 0.9;
    }

    if (!this.completionPending) return false;
    this.completionPending = false;
    return true;
  }

  dispose(): void {
    disposeObject(this.root);
  }

  private advance(delta: number): void {
    const firstDestination = this.route[this.routeIndex];
    const illusionSpeed =
      firstDestination !== undefined && isProjectionDepthMove(this.root.position, firstDestination)
        ? ELDER_SPEED * 8
        : ELDER_SPEED;
    let remaining = illusionSpeed * delta;
    while (remaining > 0 && this.moving) {
      const destination = this.route[this.routeIndex];
      if (destination === undefined) {
        this.finishRoute();
        break;
      }
      this.target.copy(destination).sub(this.root.position);
      const distance = this.target.length();
      if (distance <= Math.max(ARRIVAL_EPSILON, remaining)) {
        this.root.position.copy(destination);
        remaining = Math.max(0, remaining - distance);
        this.routeIndex += 1;
        continue;
      }
      this.target.multiplyScalar(remaining / distance);
      this.root.position.add(this.target);
      remaining = 0;
    }

    const next = this.route[this.routeIndex];
    if (next !== undefined) this.root.lookAt(next.x, this.root.position.y, next.z);
    if (this.routeIndex >= this.route.length) this.finishRoute();
  }

  private finishRoute(): void {
    if (!this.moving) return;
    this.moving = false;
    this.completionPending = true;
    this.body.position.set(0, 0, 0);
  }

  private buildModel(): void {
    const robe = new MeshToonMaterial({ color: 0x66543c });
    const robeDark = new MeshToonMaterial({ color: 0x3e352b });
    const skin = new MeshToonMaterial({ color: 0xa47f64 });
    const hair = new MeshToonMaterial({ color: 0xc2bbb0 });
    const wood = new MeshToonMaterial({ color: 0x55402d });

    const torso = new Mesh(new CapsuleGeometry(0.21, 0.62, 3, 7), robe);
    torso.position.y = 0.92;
    torso.rotation.z = 0.08;
    this.body.add(torso);

    const face = new Mesh(new SphereGeometry(0.16, 9, 6), skin);
    face.position.y = 1.45;
    this.head.add(face);
    const papakha = new Mesh(new CylinderGeometry(0.19, 0.17, 0.24, 9), hair);
    papakha.position.y = 1.63;
    this.head.add(papakha);
    this.body.add(this.head);

    this.leftLeg.position.set(-0.105, 0.34, 0);
    this.rightLeg.position.set(0.105, 0.34, 0);
    const leftBoot = new Mesh(new CapsuleGeometry(0.06, 0.34, 3, 6), robeDark);
    const rightBoot = new Mesh(new CapsuleGeometry(0.06, 0.34, 3, 6), robeDark);
    leftBoot.position.y = -0.14;
    rightBoot.position.y = -0.14;
    this.leftLeg.add(leftBoot);
    this.rightLeg.add(rightBoot);
    this.body.add(this.leftLeg, this.rightLeg);

    const staffMesh = new Mesh(new CylinderGeometry(0.025, 0.035, 1.52, 7), wood);
    staffMesh.position.y = 0.76;
    this.staff.position.set(0.31, 0, 0.03);
    this.staff.rotation.z = 0.1;
    this.staff.add(staffMesh);
    this.body.add(this.staff);

    this.root.add(this.body);
    this.root.scale.setScalar(0.9);
    this.root.traverse((object) => {
      if (!(object instanceof Mesh)) return;
      object.castShadow = true;
      object.receiveShadow = true;
    });
  }
}

function isProjectionDepthMove(from: Vector3, to: Vector3): boolean {
  const dx = Math.abs(to.x - from.x);
  const dy = Math.abs(to.y - from.y);
  const dz = Math.abs(to.z - from.z);
  return dx > 1 && Math.abs(dx - dy) < 0.001 && Math.abs(dx - dz) < 0.001;
}
