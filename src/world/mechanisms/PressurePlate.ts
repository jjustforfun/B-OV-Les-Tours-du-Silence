/**
 * PressurePlate.ts — dalle qui s'enfonce sous Turpal ou sous Borz.
 *
 * Variantes maintenue et verrouillante. La dalle publie son état dans le
 * NavGraph et dessine un lien lumineux vers ce qu'elle commande.
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
  /** Point de destination du lien lumineux de cause à effet. */
  readonly linkTo?: readonly [number, number, number];
  readonly pressDepth?: number;
  readonly pressSeconds?: number;
}

export class PressurePlate extends BaseMechanism {
  readonly root: Object3D = new Group();

  private pressed = false;
  private visualPressed = 0;
  private fromPressed = 0;
  private targetPressed = 0;
  private elapsed = 0;
  private readonly pressDepth: number;
  private readonly pressSeconds: number;

  constructor(
    id: string,
    private readonly options: PressurePlateOptions,
  ) {
    super(id);
    this.root.name = `PressurePlate:${id}`;
    this.pressDepth = options.pressDepth ?? 0.08;
    this.pressSeconds = options.pressSeconds ?? 0.18;
    this.attachAffordance(0.18, 0.025);
    this.createCauseLink();
  }

  get isPressed(): boolean {
    return this.pressed;
  }

  get triggerNode(): NodeId {
    return this.options.triggerNode;
  }

  /** Appelé quand une entité entre ou sort du nœud déclencheur. */
  setOccupied(occupied: boolean): void {
    if (this.pressed && this.options.latching === true) return;
    if (this.pressed === occupied) return;
    this.pressed = occupied;
    this.fromPressed = this.visualPressed;
    this.targetPressed = occupied ? 1 : 0;
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
    this.elapsed = Math.min(this.pressSeconds, this.elapsed + delta);
    const t = elasticOut(this.elapsed / this.pressSeconds);
    this.visualPressed = this.fromPressed + (this.targetPressed - this.fromPressed) * t;
    this.root.position.y = -this.pressDepth * this.visualPressed;

    if (this.elapsed < this.pressSeconds) return;
    this.animating = false;
    this.visualPressed = this.targetPressed;
    this.root.position.y = -this.pressDepth * this.visualPressed;
    this.applyToGraph(context.graph);
    bus.emit('mechanism:snap', {
      id: this.id,
      kind: 'pressurePlate',
      value: this.pressed,
      notch: this.pressed ? 1 : 0,
      sound: 'stone-plate',
    });
  }

  applyToGraph(graph: NavGraph): void {
    graph.setMechanismState(this.id, this.pressed);
    bus.emit('mechanism:stateChanged', {
      id: this.id,
      kind: 'pressurePlate',
      value: this.pressed,
    });
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
