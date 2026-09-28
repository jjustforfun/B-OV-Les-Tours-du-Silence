/**
 * MountainProcession.ts — les quatre voyageurs que Borz élève à Tebulosmta.
 *
 * Le voyageur, l'enfant, l'ancien et le rival attendent ensemble sur le névé.
 * Borz les porte un par un vers la terrasse haute ; Turpal n'appartient jamais
 * à cette liste. Cette classe ne décide ni quand le trajet commence ni quelles
 * arêtes s'ouvrent : elle ne possède que les silhouettes et leur mise en place.
 */
import { Group, type Object3D } from 'three';
import { Child } from '@entities/Child';
import type { Borz } from '@entities/companion/Borz';
import { Elder } from '@entities/npc/Elder';
import { Rival } from '@entities/npc/Rival';
import { Traveler } from '@entities/npc/Traveler';
import type { NavGraph, NodeId } from '@world/NavGraph';

export type MountainPassengerKind = 'traveler' | 'child' | 'elder' | 'rival';

interface AnimatedProp {
  readonly root: Object3D;
  update(delta: number): unknown;
  dispose(): void;
}

interface PassengerModel extends AnimatedProp {
  readonly kind: MountainPassengerKind;
}

export class MountainProcession {
  readonly root = new Group();

  private readonly passengers: PassengerModel[];
  private delivered = 0;
  private ridingIndex: number | null = null;

  constructor(readonly id: string) {
    this.root.name = `Actor:MountainProcession:${id}`;
    this.passengers = [
      passenger('traveler', new Traveler()),
      passenger('child', new Child(`${id}:child`)),
      passenger('elder', new Elder(`${id}:elder`)),
      passenger('rival', new Rival()),
    ];
    for (const entry of this.passengers) {
      entry.root.name = `ProcessionPassenger:${entry.kind}`;
      this.root.add(entry.root);
    }
  }

  get passengerKinds(): readonly MountainPassengerKind[] {
    return this.passengers.map((entry) => entry.kind);
  }

  get deliveredCount(): number {
    return this.delivered;
  }

  get isComplete(): boolean {
    return this.delivered >= this.passengers.length;
  }

  placeWaiting(graph: NavGraph, nodes: readonly NodeId[]): void {
    for (let index = 0; index < this.passengers.length; index += 1) {
      const entry = this.passengers[index];
      const node = graph.getNode(nodes[index] ?? '');
      if (entry === undefined || node === undefined) continue;
      entry.root.position.set(node.position.x, node.position.y, node.position.z);
    }
  }

  beginNextRide(borz: Borz): boolean {
    if (this.ridingIndex !== null || this.isComplete) return false;
    const entry = this.passengers[this.delivered];
    if (entry === undefined) return false;
    this.ridingIndex = this.delivered;
    borz.attachPassenger(entry.root);
    entry.root.position.set(0, 0.42, 0);
    entry.root.rotation.set(0, 0, 0);
    return true;
  }

  settleCurrentRide(borz: Borz, graph: NavGraph, nodes: readonly NodeId[]): boolean {
    const index = this.ridingIndex;
    if (index === null) return false;
    const entry = this.passengers[index];
    const node = graph.getNode(nodes[index] ?? '');
    borz.detachPassenger(this.root);
    if (entry !== undefined && node !== undefined) {
      entry.root.position.set(node.position.x, node.position.y, node.position.z);
      entry.root.rotation.set(0, 0, 0);
    }
    this.ridingIndex = null;
    this.delivered = index + 1;
    return true;
  }

  update(delta: number): void {
    for (const entry of this.passengers) entry.update(delta);
  }

  dispose(): void {
    for (const entry of this.passengers) entry.dispose();
    this.root.removeFromParent();
    this.root.clear();
  }
}

function passenger(kind: MountainPassengerKind, model: AnimatedProp): PassengerModel {
  return {
    kind,
    root: model.root,
    update: (delta) => model.update(delta),
    dispose: () => model.dispose(),
  };
}
