/**
 * ValleyGathering.ts — tableau vivant de l'épilogue.
 *
 * Les quatre personnes aidées ne demandent plus rien : elles habitent les
 * terrasses. Huit braises froides mémorisent le passage de Turpal, puis
 * répondent ensemble au seuil. L'aigle final n'existe que si les sept secrets
 * précédents ont été contemplés ; il ne débloque aucune arête ni récompense.
 */
import {
  Box3,
  Group,
  Mesh,
  MeshBasicMaterial,
  SphereGeometry,
  Vector3,
  type Object3D,
} from 'three';
import { Child } from '@entities/Child';
import { Elder } from '@entities/npc/Elder';
import { Rival } from '@entities/npc/Rival';
import { Traveler } from '@entities/npc/Traveler';
import { Eagle } from '@entities/wildlife/Eagle';
import { EMBER } from '@render/Palettes';
import type { LevelFinaleDef } from '@world/Level';
import type { NavGraph, NodeId } from '@world/NavGraph';

const beaconWorld = new Vector3();
const beaconBox = new Box3();

export type FinaleArrival =
  | { readonly kind: 'tower'; readonly index: number }
  | { readonly kind: 'threshold' }
  | { readonly kind: 'seat' }
  | null;

export class ValleyGathering {
  readonly root = new Group();

  private readonly traveler = new Traveler();
  private readonly child: Child;
  private readonly elder: Elder;
  private readonly rival = new Rival();
  private readonly beaconGeometry = new SphereGeometry(0.13, 10, 7);
  private readonly beaconMaterials: MeshBasicMaterial[] = [];
  private readonly beacons: Mesh[] = [];
  private readonly lit = new Set<number>();
  private readonly finalEagle: Eagle | null;
  private elapsed = 0;
  private thresholdAwake = false;
  private eaglePerched = false;

  constructor(
    readonly definition: LevelFinaleDef,
    graph: NavGraph,
    towers: readonly Object3D[],
    finalEagleUnlocked: boolean,
  ) {
    this.root.name = 'Actor:ValleyGathering';
    this.child = new Child('finale-child');
    this.elder = new Elder('finale-elder');
    this.placeResidents(graph);
    this.buildBeacons(towers);
    this.finalEagle = finalEagleUnlocked ? new Eagle(false) : null;
    if (this.finalEagle !== null) {
      this.finalEagle.root.name = 'FinalEagle:Shoulder';
      this.root.add(this.finalEagle.root);
    }
  }

  get litTowerCount(): number {
    return this.lit.size;
  }

  get isThresholdAwake(): boolean {
    return this.thresholdAwake;
  }

  get hasFinalEagle(): boolean {
    return this.finalEagle !== null;
  }

  get isEaglePerched(): boolean {
    return this.eaglePerched;
  }

  reach(nodeId: NodeId): FinaleArrival {
    const towerIndex = this.definition.towerNodes.indexOf(nodeId);
    if (towerIndex >= 0) {
      return this.lightTower(towerIndex) ? { kind: 'tower', index: towerIndex } : null;
    }
    if (nodeId === this.definition.thresholdNode) {
      if (this.thresholdAwake) return null;
      this.thresholdAwake = true;
      for (let index = 0; index < this.beacons.length; index += 1) this.lightTower(index);
      return { kind: 'threshold' };
    }
    return nodeId === this.definition.seatNode ? { kind: 'seat' } : null;
  }

  perchFinalEagle(turpal: Object3D): boolean {
    if (this.finalEagle === null || this.eaglePerched) return false;
    this.eaglePerched = true;
    turpal.add(this.finalEagle.root);
    this.finalEagle.root.position.set(-0.08, 0.68, -0.12);
    this.finalEagle.root.rotation.set(0, -0.35, 0.08);
    this.finalEagle.reveal();
    return true;
  }

  update(delta: number): void {
    this.elapsed += delta;
    this.traveler.update(delta);
    this.child.update(delta);
    this.elder.update(delta);
    this.rival.update(delta);
    this.finalEagle?.update(delta);

    const pulse = 0.5 + Math.sin(this.elapsed * (this.thresholdAwake ? 2.4 : 1.25)) * 0.5;
    for (let index = 0; index < this.beacons.length; index += 1) {
      const beacon = this.beacons[index];
      const material = this.beaconMaterials[index];
      if (beacon === undefined || material === undefined) continue;
      const active = this.lit.has(index);
      material.opacity = active ? 0.72 + pulse * 0.24 : 0.05;
      beacon.scale.setScalar(active ? 0.9 + pulse * 0.22 : 0.68);
    }
  }

  dispose(): void {
    this.traveler.dispose();
    this.child.dispose();
    this.elder.dispose();
    this.rival.dispose();
    this.finalEagle?.dispose();
    for (const beacon of this.beacons) beacon.removeFromParent();
    for (const material of this.beaconMaterials) material.dispose();
    this.beaconGeometry.dispose();
    this.beacons.length = 0;
    this.beaconMaterials.length = 0;
    this.root.removeFromParent();
    this.root.clear();
  }

  private placeResidents(graph: NavGraph): void {
    const nodes = this.definition.residentNodes;
    this.traveler.placeAt(graph, nodes.traveler);
    this.traveler.root.name = 'FinaleResident:traveler';
    this.root.add(this.traveler.root);

    const childNode = graph.getNode(nodes.child);
    if (childNode !== undefined) {
      this.child.root.position.set(
        childNode.position.x,
        childNode.position.y,
        childNode.position.z,
      );
    }
    this.child.root.name = 'FinaleResident:child';
    this.root.add(this.child.root);

    this.elder.placeAt(graph, nodes.elder);
    this.elder.root.name = 'FinaleResident:elder';
    this.root.add(this.elder.root);

    this.rival.placeAt(graph, nodes.rival);
    this.rival.root.name = 'FinaleResident:rival';
    this.root.add(this.rival.root);
  }

  private buildBeacons(towers: readonly Object3D[]): void {
    for (let index = 0; index < towers.length; index += 1) {
      const tower = towers[index];
      if (tower === undefined) continue;
      tower.updateWorldMatrix(true, true);
      beaconBox.setFromObject(tower);
      beaconBox.getCenter(beaconWorld);
      beaconWorld.y = beaconBox.max.y + 0.16;
      tower.worldToLocal(beaconWorld);

      const material = new MeshBasicMaterial({
        color: EMBER,
        transparent: true,
        opacity: 0.05,
        depthWrite: false,
      });
      const beacon = new Mesh(this.beaconGeometry, material);
      beacon.name = `FinaleTowerLight:${index}`;
      beacon.position.copy(beaconWorld);
      tower.add(beacon);
      this.beaconMaterials.push(material);
      this.beacons.push(beacon);
    }
  }

  private lightTower(index: number): boolean {
    if (index < 0 || index >= this.beacons.length || this.lit.has(index)) return false;
    this.lit.add(index);
    return true;
  }
}
