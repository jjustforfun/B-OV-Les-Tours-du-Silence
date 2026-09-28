/**
 * Traveler.ts — l'invité silencieux du chapitre de l'Hospitalité.
 *
 * Son trajet est autonome : il n'appartient jamais au NavGraph de Turpal.
 * Quand la passerelle lui est offerte, il traverse à pas mesurés puis sort du
 * cadre. Un filet de fumée apparaît alors sur un toit du village.
 */
import {
  ConeGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshToonMaterial,
  SphereGeometry,
  Vector3,
  type Material,
} from 'three';
import type { NavGraph, NodeId } from '@world/NavGraph';
import { disposeObject } from '@utils/dispose';

const TRAVEL_SPEED = 1.15;
const ARRIVAL_EPSILON = 0.025;

export class Traveler {
  readonly root = new Group();

  private readonly body = new Group();
  private readonly leftLeg = new Group();
  private readonly rightLeg = new Group();
  private readonly route: Vector3[] = [];
  private readonly target = new Vector3();
  private routeIndex = 0;
  private elapsed = 0;
  private moving = false;
  private completionPending = false;

  constructor() {
    this.root.name = 'Actor:Traveler';
    this.buildModel();
  }

  placeAt(graph: NavGraph, nodeId: NodeId): void {
    const node = graph.getNode(nodeId);
    if (node === undefined) return;
    this.root.position.set(node.position.x, node.position.y, node.position.z);
  }

  start(graph: NavGraph, path: readonly NodeId[]): boolean {
    if (this.moving || this.route.length > 0) return false;
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

  /** Retourne vrai une seule image, au moment où le voyageur quitte la route. */
  update(delta: number): boolean {
    this.elapsed += delta;
    const stride = this.moving ? Math.sin(this.elapsed * 8.5) : 0;
    this.body.position.y = Math.abs(stride) * 0.025;
    this.leftLeg.rotation.x = stride * 0.42;
    this.rightLeg.rotation.x = -stride * 0.42;

    if (this.moving) this.advance(delta);
    if (!this.completionPending) return false;
    this.completionPending = false;
    return true;
  }

  dispose(): void {
    disposeObject(this.root);
  }

  private advance(delta: number): void {
    let remaining = TRAVEL_SPEED * delta;
    while (remaining > 0 && this.moving) {
      const destination = this.route[this.routeIndex];
      if (destination === undefined) {
        this.moving = false;
        this.completionPending = true;
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
    if (this.routeIndex >= this.route.length) {
      this.moving = false;
      this.completionPending = true;
    }
  }

  private buildModel(): void {
    const cloak = new MeshToonMaterial({ color: 0x4d5148 });
    const cloakEdge = new MeshToonMaterial({ color: 0x343a37 });
    const skin = new MeshToonMaterial({ color: 0xb68b70 });
    const boot = new MeshToonMaterial({ color: 0x2b2927 });

    const coat = new Mesh(new ConeGeometry(0.3, 1.05, 7), cloak);
    coat.name = 'TravelerWetCloak';
    coat.position.y = 0.72;
    this.body.add(coat);

    const shoulders = new Mesh(new CylinderGeometry(0.24, 0.28, 0.35, 7), cloakEdge);
    shoulders.position.y = 1.18;
    this.body.add(shoulders);

    const head = new Mesh(new SphereGeometry(0.16, 8, 6), skin);
    head.position.y = 1.49;
    this.body.add(head);

    const hood = new Mesh(new ConeGeometry(0.22, 0.35, 7), cloakEdge);
    hood.position.set(0, 1.62, -0.025);
    this.body.add(hood);

    this.leftLeg.position.set(-0.11, 0.3, 0);
    this.rightLeg.position.set(0.11, 0.3, 0);
    this.leftLeg.add(this.leg(boot));
    this.rightLeg.add(this.leg(boot));
    this.body.add(this.leftLeg, this.rightLeg);
    this.root.add(this.body);
    this.root.scale.setScalar(0.92);
  }

  private leg(material: Material): Mesh {
    const leg = new Mesh(new CylinderGeometry(0.065, 0.075, 0.55, 6), material);
    leg.position.y = -0.22;
    return leg;
  }
}

export class HearthSmoke {
  readonly root = new Group();

  private readonly puffs: Mesh[] = [];
  private readonly phases: number[] = [];
  private elapsed = 0;
  private active = false;

  constructor() {
    this.root.name = 'Story:HearthSmoke';
    this.root.visible = false;
    for (let index = 0; index < 6; index += 1) {
      const material = new MeshBasicMaterial({
        color: 0xd8d1bf,
        transparent: true,
        opacity: 0,
        depthWrite: false,
      });
      const puff = new Mesh(new SphereGeometry(0.13 + index * 0.012, 6, 4), material);
      this.phases.push(index / 6);
      this.puffs.push(puff);
      this.root.add(puff);
    }
  }

  reveal(): void {
    if (this.active) return;
    this.active = true;
    this.root.visible = true;
    this.elapsed = 0;
  }

  update(delta: number): void {
    if (!this.active) return;
    this.elapsed += delta;
    for (let index = 0; index < this.puffs.length; index += 1) {
      const puff = this.puffs[index];
      if (puff === undefined) continue;
      const phase = ((this.phases[index] ?? 0) + this.elapsed * 0.075) % 1;
      puff.position.set(
        Math.sin((phase + index) * Math.PI * 2) * 0.07,
        phase * 2.1,
        Math.cos((phase * 0.7 + index) * Math.PI * 2) * 0.05,
      );
      puff.scale.setScalar(0.65 + phase * 1.25);
      if (puff.material instanceof MeshBasicMaterial) {
        puff.material.opacity = Math.sin(phase * Math.PI) * 0.22;
      }
    }
  }

  dispose(): void {
    disposeObject(this.root);
  }
}
