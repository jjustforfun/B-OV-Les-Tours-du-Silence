/**
 * PressurePlate.ts — dalle qui s'enfonce sous Turpal ou sous Borz.
 *
 * Variantes maintenue et verrouillante. La dalle publie son état dans le
 * NavGraph, dessine un lien lumineux vers ce qu'elle commande et peut
 * abaisser des volumes d'architecture sans déplacer son ancre monde.
 */
import { BufferGeometry, Group, Line, LineBasicMaterial, Vector3, type Object3D } from 'three';
import { bus } from '@core/EventBus';
import { EMBER } from '@render/Palettes';
import { BaseMechanism, elasticOut, type MechanismContext } from './Mechanism';
import type { NavGraph, NodeId } from '../NavGraph';

export interface PressurePlateOptions {
  /** Nœud sur lequel il faut se tenir. */
  readonly triggerNode: NodeId;
  /** Reste enfoncée une fois activée. */
  readonly latching?: boolean;
  /** Point de destination local du lien lumineux de cause à effet. */
  readonly linkTo?: readonly [number, number, number];
  /** Passage que Borz matérialise lorsqu'il est le poids de cette dalle. */
  readonly borzBridge?: readonly [NodeId, NodeId];
  readonly pressDepth?: number;
  readonly pressSeconds?: number;
  /** Durée du mouvement architectural lié à la dalle. */
  readonly loweringSeconds?: number;
}

interface LoweredObject {
  readonly object: Object3D;
  readonly from: Vector3;
  readonly to: Vector3;
  readonly stage: number;
}

export class PressurePlate extends BaseMechanism {
  readonly root = new Group();
  readonly geometryRoot = new Group();
  readonly interactionRoot = this.geometryRoot;

  private readonly loweredObjects: LoweredObject[] = [];
  private readonly interactionPosition = new Vector3();
  private pressed = false;
  private visualPressed = 0;
  private fromPressed = 0;
  private targetPressed = 0;
  private loweringProgress = 0;
  private fromLowering = 0;
  private targetLowering = 0;
  private elapsed = 0;
  private readonly pressDepth: number;
  private readonly pressSeconds: number;
  private readonly loweringSeconds: number;

  constructor(
    id: string,
    private readonly options: PressurePlateOptions,
  ) {
    super(id);
    this.root.name = `PressurePlate:${id}`;
    this.geometryRoot.name = `PressurePlateGeometry:${id}`;
    this.root.add(this.geometryRoot);
    this.pressDepth = options.pressDepth ?? 0.08;
    this.pressSeconds = options.pressSeconds ?? 0.18;
    this.loweringSeconds = options.loweringSeconds ?? 0.9;
    this.attachAffordance(0.18, 0.025);
    const affordance = this.root.getObjectByName(`${id}:affordance`);
    if (affordance !== undefined) this.geometryRoot.add(affordance);
    this.createCauseLink();
  }

  get isPressed(): boolean {
    return this.pressed;
  }

  get triggerNode(): NodeId {
    return this.options.triggerNode;
  }

  get borzBridge(): readonly [NodeId, NodeId] | undefined {
    return this.options.borzBridge;
  }

  bindStagedObject(
    object: Object3D,
    target: readonly [number, number, number],
    stage: number,
  ): void {
    this.loweredObjects.push({
      object,
      from: object.position.clone(),
      to: new Vector3(target[0], target[1], target[2]),
      stage: Math.max(1, Math.round(stage)),
    });
    this.applyLoweredObjects();
  }

  /** Appelé quand une entité entre ou sort du nœud déclencheur. */
  setOccupied(occupied: boolean): void {
    if (this.pressed && this.options.latching === true) return;
    if (this.pressed === occupied) return;
    this.pressed = occupied;
    this.fromPressed = this.visualPressed;
    this.targetPressed = occupied ? 1 : 0;
    this.fromLowering = this.loweringProgress;
    this.targetLowering = occupied ? 1 : 0;
    this.elapsed = 0;
    this.animating = true;
  }

  actuate(): void {
    if (!this.interactive && this.options.latching !== true) return;
    this.setOccupied(!this.pressed);
  }

  override update(context: MechanismContext, delta: number): void {
    super.update(context, delta);
    if (!this.animating) return;

    const totalSeconds =
      this.loweredObjects.length === 0 ? this.pressSeconds : this.loweringSeconds;
    this.elapsed = Math.min(totalSeconds, this.elapsed + delta);

    const pressT = elasticOut(Math.min(1, this.elapsed / this.pressSeconds));
    this.visualPressed = this.fromPressed + (this.targetPressed - this.fromPressed) * pressT;
    this.geometryRoot.position.y = -this.pressDepth * this.visualPressed;

    const lowerT = smoothStep(Math.min(1, this.elapsed / totalSeconds));
    this.loweringProgress = this.fromLowering + (this.targetLowering - this.fromLowering) * lowerT;
    this.applyLoweredObjects();

    if (this.elapsed < totalSeconds) return;
    this.animating = false;
    this.visualPressed = this.targetPressed;
    this.loweringProgress = this.targetLowering;
    this.geometryRoot.position.y = -this.pressDepth * this.visualPressed;
    this.applyLoweredObjects();
    this.applyToGraph(context.graph);
    bus.emit('mechanism:snap', {
      id: this.id,
      kind: 'pressurePlate',
      value: this.pressed,
      notch: this.pressed ? 1 : 0,
      sound: 'stone-plate',
      at: this.eventPosition(),
      steps: 2,
    });
  }

  applyToGraph(graph: NavGraph): void {
    graph.setMechanismState(this.id, this.pressed);
    bus.emit('mechanism:stateChanged', {
      id: this.id,
      kind: 'pressurePlate',
      value: this.pressed,
      at: this.eventPosition(),
    });
  }

  protected override eventPosition(): { x: number; y: number; z: number } {
    this.interactionRoot.getWorldPosition(this.interactionPosition);
    return {
      x: this.interactionPosition.x,
      y: this.interactionPosition.y,
      z: this.interactionPosition.z,
    };
  }

  private applyLoweredObjects(): void {
    let stageCount = 1;
    for (const entry of this.loweredObjects) stageCount = Math.max(stageCount, entry.stage);
    for (const entry of this.loweredObjects) {
      const progress = Math.min(
        1,
        Math.max(0, this.loweringProgress * stageCount - (entry.stage - 1)),
      );
      entry.object.position.lerpVectors(entry.from, entry.to, smoothStep(progress));
    }
  }

  private createCauseLink(): void {
    const target = this.options.linkTo;
    if (!target) return;
    const geometry = this.trackGeometry(
      new BufferGeometry().setFromPoints([
        new Vector3(0, 0.018, 0),
        new Vector3(target[0], target[1] + 0.018, target[2]),
      ]),
    );
    const material = this.trackMaterial(
      new LineBasicMaterial({ color: EMBER, transparent: true, opacity: 0.58, depthWrite: false }),
    );
    const line = new Line(geometry, material);
    line.name = `PressurePlateLink:${this.id}`;
    this.root.add(line);
  }
}

function smoothStep(value: number): number {
  return value * value * (3 - 2 * value);
}
