/**
 * GravityPath.ts — chemin dont la gravité change d'orientation.
 *
 * La bascule ne fait pas tourner le monde : elle met à jour le `up` des nœuds
 * pivots, recâble le graphe via l'état de mécanisme et réaligne les indices
 * visuels (racine + affordance) sur la nouvelle direction.
 */
import { Group, Vector3, type Object3D } from 'three';
import { bus } from '@core/EventBus';
import { BaseMechanism, elasticOut, type MechanismContext } from './Mechanism';
import type { NavGraph, NavUp, NodeId } from '../NavGraph';

export type GravityDirection = 'down' | 'up' | 'north' | 'south' | 'east' | 'west';

export interface GravityPathOptions {
  readonly from: GravityDirection;
  readonly to: GravityDirection;
  /** Nœuds où la bascule se déclenche. */
  readonly pivotNodes: readonly NodeId[];
  readonly snapSeconds?: number;
}

export class GravityPath extends BaseMechanism {
  readonly root: Object3D = new Group();

  private direction: GravityDirection;
  private fromVector = new Vector3();
  private targetVector = new Vector3();
  private visualVector = new Vector3();
  private elapsed = 0;
  private readonly duration: number;

  constructor(
    id: string,
    private readonly options: GravityPathOptions,
  ) {
    super(id);
    this.root.name = `GravityPath:${id}`;
    this.direction = options.from;
    this.duration = options.snapSeconds ?? 0.45;
    this.visualVector.copy(directionVector(this.direction));
    this.targetVector.copy(this.visualVector);
    this.fromVector.copy(this.visualVector);
    this.root.up.copy(this.visualVector);
    this.attachAffordance(0.2, 0.04);
  }

  get currentDirection(): GravityDirection {
    return this.direction;
  }

  get pivotNodes(): readonly NodeId[] {
    return this.options.pivotNodes;
  }

  actuate(): void {
    if (!this.interactive) return;
    this.direction = this.direction === this.options.from ? this.options.to : this.options.from;
    this.fromVector.copy(this.visualVector);
    this.targetVector.copy(directionVector(this.direction));
    this.elapsed = 0;
    this.animating = true;
  }

  override update(context: MechanismContext, delta: number): void {
    super.update(context, delta);
    if (!this.animating) return;
    this.elapsed = Math.min(this.duration, this.elapsed + delta);
    const t = elasticOut(this.elapsed / this.duration);
    this.visualVector.lerpVectors(this.fromVector, this.targetVector, t).normalize();
    this.root.up.copy(this.visualVector);

    if (this.elapsed < this.duration) return;
    this.animating = false;
    this.visualVector.copy(this.targetVector);
    this.root.up.copy(this.visualVector);
    this.applyToGraph(context.graph);
    bus.emit('mechanism:snap', {
      id: this.id,
      kind: 'gravityPath',
      value: this.direction,
      notch: this.direction === this.options.from ? 0 : 1,
      sound: 'gravity-snap',
    });
  }

  applyToGraph(graph: NavGraph): void {
    const up = vectorToUp(directionVector(this.direction));
    for (const id of this.options.pivotNodes) {
      const node = graph.getNode(id);
      if (!node) continue;
      const mutable = node.up as { x: number; y: number; z: number };
      mutable.x = up.x;
      mutable.y = up.y;
      mutable.z = up.z;
    }
    graph.setMechanismState(this.id, this.direction);
    bus.emit('mechanism:stateChanged', {
      id: this.id,
      kind: 'gravityPath',
      value: this.direction,
    });
  }
}

function directionVector(direction: GravityDirection): Vector3 {
  switch (direction) {
    case 'up':
      return new Vector3(0, -1, 0);
    case 'north':
      return new Vector3(0, 0, 1);
    case 'south':
      return new Vector3(0, 0, -1);
    case 'east':
      return new Vector3(-1, 0, 0);
    case 'west':
      return new Vector3(1, 0, 0);
    case 'down':
      return new Vector3(0, 1, 0);
  }
}

function vectorToUp(vector: Vector3): NavUp {
  return { x: vector.x, y: vector.y, z: vector.z };
}
