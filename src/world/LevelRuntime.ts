/**
 * LevelRuntime.ts — le niveau rendu jouable.
 *
 * Colle entre trois couches qui ne se connaissent pas : les intentions de
 * l'`InputManager` (tap, drag, direction), le niveau déclaratif (`Level` :
 * graphe, mécanismes) et Turpal. Toute la traduction « le joueur a tapé ici →
 * Turpal marche vers ce nœud », « le joueur glisse → le rotateur suit le
 * doigt », « Tab → le mécanisme le plus proche à l'écran est sélectionné »
 * vit ici, et nulle part ailleurs.
 *
 * Le picking se fait sur les **positions écran des nœuds** (NodeProjection)
 * plutôt que sur la géométrie : les blocs de pierre ne sont construits qu'en
 * phase 9, et le graphe est la source de vérité de toute façon — Turpal ne
 * marche jamais « sur de la géométrie » (ADR-003).
 *
 * Publie sur l'EventBus global : `player:moved`, `mechanism:dragMove`,
 * `path:connected`, `music:progress`, `level:solved` — l'audio et les FX
 * n'écoutent que ça.
 */
import { Vector3, type Camera, type Object3D } from 'three';
import { bus } from '@core/EventBus';
import { isReducedMotion } from '@core/motion';
import { KEYBOARD, PACING, POINTER } from '@/config';
import { haptic } from '@input/Haptics';
import type { InputManager, PointerIntent } from '@input/InputManager';
import { PointerInput, type PickableScreenTarget } from '@input/PointerInput';
import { pickNeighborByScreenDirection, type DirectionalCandidate } from '@input/screenMove';
import { FocusRing } from '@ui/FocusRing';
import { Borz } from '@entities/companion/Borz';
import { Turpal } from '@entities/player/Turpal';
import { TurpalModel } from '@entities/player/TurpalModel';
import { Hints, type HintStage } from '@fx/Hints';
import type { Level } from './Level';
import type { Mechanism, MechanismContext } from './mechanisms/Mechanism';
import { PressurePlate } from './mechanisms/PressurePlate';
import { computeMusicLayers, conditionalEdgeSnapshot, newlyEnabledEdgeKeys } from './progress';
import { findPath } from './Pathfinder';
import type { MechanismValue, NodeId } from './NavGraph';

export interface LevelRuntimeDeps {
  readonly level: Level;
  /** Racine où ajouter le niveau (la scène du moteur). */
  readonly sceneRoot: Object3D;
  readonly camera: Camera;
  readonly input: InputManager;
  /** Dimensions CSS du canvas, rafraîchies à chaque appel. */
  readonly viewport: () => { readonly width: number; readonly height: number };
  /** Anneau de sélection ; omis = créé sur `document.body` si possible. */
  readonly focusRing?: FocusRing;
}

interface ScreenPointMutable {
  x: number;
  y: number;
}

const FOCUS_RING_MIN_PX = 28;

export class LevelRuntime {
  private readonly level: Level;
  private readonly camera: Camera;
  private readonly input: InputManager;
  private readonly viewport: () => { readonly width: number; readonly height: number };
  private readonly focusRing: FocusRing | null;
  private readonly ownFocusRing: boolean;

  private readonly turpal: Turpal;
  private readonly borz: Borz | null;
  private readonly hints: Hints;
  private readonly unsubscribe: (() => void)[] = [];

  private moves = 0;
  private solved = false;
  private paused = false;
  private lastNodeId: NodeId | null = null;
  private musicLayersMax = 1;
  private edgeSnapshot: Map<string, boolean>;
  private readonly actuated = new Set<string>();

  private focused: Mechanism | null = null;
  private dragMechanism: Mechanism | null = null;
  private lastDragTime = 0;
  private lastDragX = 0;
  private lastDragY = 0;

  private hintCandidate: Mechanism | null = null;
  private hintGlowCurrent = 0;
  private hintGlowTarget = 0;

  /** Vecteurs et points réutilisés : zéro allocation dans la boucle. */
  private readonly tmpWorld = new Vector3();
  private readonly tmpWorld2 = new Vector3();
  private readonly tmpNdc = new Vector3();
  private readonly mechanismContext: MechanismContext;
  private readonly screenPoint: ScreenPointMutable = { x: 0, y: 0 };
  private readonly screenPoint2: ScreenPointMutable = { x: 0, y: 0 };
  private readonly turpalScreen: ScreenPointMutable = { x: 0, y: 0 };
  private readonly dragCenter: ScreenPointMutable = { x: 0, y: 0 };

  constructor(deps: LevelRuntimeDeps) {
    this.level = deps.level;
    this.camera = deps.camera;
    this.input = deps.input;
    this.viewport = deps.viewport;
    this.edgeSnapshot = conditionalEdgeSnapshot(deps.level.graph);

    if (deps.focusRing !== undefined) {
      this.focusRing = deps.focusRing;
      this.ownFocusRing = false;
    } else if (typeof document !== 'undefined') {
      this.focusRing = new FocusRing(document.body);
      this.ownFocusRing = true;
    } else {
      this.focusRing = null;
      this.ownFocusRing = false;
    }

    // Turpal se tient sur le nœud d'apparition, Borz sur son premier nœud.
    this.turpal = new Turpal(new TurpalModel());
    this.turpal.placeAt(this.level.graph, this.level.definition.spawn);
    this.level.root.add(this.turpal.root);
    const borzNode = this.level.graph.findNodesByTag('borz')[0];
    this.borz = borzNode === undefined ? null : new Borz();
    if (this.borz !== null && borzNode !== undefined) {
      this.borz.placeAt(this.level.graph, borzNode.id);
      this.level.root.add(this.borz.root);
    }

    this.hints = new Hints({ onStage: (stage) => this.applyHintStage(stage) });
    this.mechanismContext = { graph: deps.level.graph, elapsed: 0 };

    deps.sceneRoot.add(this.level.root);
    this.bindInput();
    this.bindBus();
    this.unsubscribe.push(this.turpal.bindMechanismRevalidation(this.level.graph));

    this.focusRing?.setPulsing(!isReducedMotion());

    // Le niveau est prêt : l'audio et les FX s'y abonnent par l'EventBus.
    bus.emit('level:loaded', {
      id: this.level.id,
      chapter: this.level.definition.chapter,
      ...(this.level.definition.ambience !== undefined
        ? { ambience: [...this.level.definition.ambience] }
        : {}),
    });
  }

  get isSolved(): boolean {
    return this.solved;
  }

  /** Une image de simulation. `elapsed` et `delta` en secondes. */
  update(elapsed: number, delta: number): void {
    const { width, height } = this.viewport();
    const camera = this.camera;
    this.level.projectNodes(
      camera.projectionMatrix.elements,
      camera.matrixWorldInverse.elements,
      width,
      height,
    );

    this.mechanismContext.elapsed = elapsed;
    for (const mechanism of this.level.mechanisms.values()) {
      mechanism.update(this.mechanismContext, delta);
    }
    this.updatePressurePlates();

    this.turpal.update(this.level.graph, delta);
    this.borz?.update(delta);
    this.trackArrival();

    this.hints.update(delta * 1000);
    this.updateHintGlow(delta);
    this.updateFocusRing();
  }

  dispose(): void {
    for (const off of this.unsubscribe) off();
    this.unsubscribe.length = 0;
    this.turpal.dispose();
    this.borz?.dispose();
    this.hints.dispose();
    if (this.ownFocusRing) this.focusRing?.dispose();
    else this.focusRing?.hide();
    this.level.root.removeFromParent();
  }

  // ————————————————————————————————— Réactions aux intentions du joueur

  private bindInput(): void {
    const input = this.input;
    this.unsubscribe.push(
      input.on('tap', (intent) => this.onTap(intent)),
      input.on('longPress', () => this.hints.request()),
      input.on('action', (action) => {
        // Touche d'indice (H) : même indice que l'appui long (docs/CONTROLS.md).
        if (action === 'hint') this.hints.request();
      }),
      input.on('dragStart', (intent) => this.onDragStart(intent)),
      input.on('drag', (intent) => this.onDrag(intent)),
      input.on('dragEnd', () => this.onDragEnd()),
      input.on('move', (direction) => this.onMoveDirection(direction.dx, direction.dy)),
      input.on('confirm', () => this.actuateFocused(1)),
      input.on('cancel', () => this.clearFocus()),
      input.on('action', (action) => this.onAction(action)),
      input.on('pause', () => this.togglePause()),
    );
  }

  private bindBus(): void {
    this.unsubscribe.push(
      bus.on('mechanism:stateChanged', (event) => this.onMechanismStateChanged(event.id)),
    );
  }

  private onTap(intent: PointerIntent): void {
    this.hints.notifyActivity();

    if (this.tryCallBorz(intent)) return;

    const mechanism = this.pickMechanism(intent.x, intent.y);
    if (mechanism !== null) {
      // Tap sur un mécanisme : actionne d'un cran, « équivalent d'un
      // glissement minimal » (docs/CONTROLS.md § 1).
      mechanism.actuate(1);
      return;
    }

    const nodeId = this.pickNode(intent.x, intent.y);
    if (nodeId === null) return;
    if (this.turpal.goTo(this.level.graph, nodeId)) {
      this.moves += 1;
      haptic('tick');
    }
  }

  private onDragStart(intent: PointerIntent): void {
    this.hints.notifyActivity();
    const mechanism = this.pickMechanism(intent.x, intent.y);
    if (mechanism === null) return;
    this.dragMechanism = mechanism;
    this.projectMechanism(mechanism, this.dragCenter);
    mechanism.beginDrag?.({
      pointerX: intent.x,
      pointerY: intent.y,
      centerX: this.dragCenter.x,
      centerY: this.dragCenter.y,
    });
    this.lastDragTime = nowMs();
    this.lastDragX = intent.x;
    this.lastDragY = intent.y;
  }

  private onDrag(intent: PointerIntent): void {
    this.hints.notifyActivity();
    const mechanism = this.dragMechanism;
    if (mechanism === null) return;

    this.projectMechanism(mechanism, this.dragCenter);
    mechanism.drag?.({
      pointerX: intent.x,
      pointerY: intent.y,
      centerX: this.dragCenter.x,
      centerY: this.dragCenter.y,
    });

    // Vitesse de manipulation, normalisée : pilote le craquement de pierre.
    const time = nowMs();
    const dt = Math.max(1, time - this.lastDragTime) / 1000;
    const speedPx = Math.hypot(intent.x - this.lastDragX, intent.y - this.lastDragY) / dt;
    this.lastDragTime = time;
    this.lastDragX = intent.x;
    this.lastDragY = intent.y;
    bus.emit('mechanism:dragMove', { id: mechanism.id, speed: Math.min(1, speedPx / 900) });
  }

  private onDragEnd(): void {
    this.dragMechanism?.endDrag?.();
    this.dragMechanism = null;
  }

  private onMoveDirection(dx: number, dy: number): void {
    this.hints.notifyActivity();
    const current = this.turpal.currentNode;
    if (current === null) return;

    const projection = this.level.nodeProjection;
    if (!projection.writeScreenPoint(current, this.turpalScreen)) return;

    const candidates: DirectionalCandidate[] = [];
    for (const edge of this.level.graph.neighbors(current)) {
      const index = projection.indexOf(edge.to);
      if (index < 0 || projection.visibleBuffer[index] !== 1) continue;
      candidates.push({
        id: edge.to,
        x: projection.screenXBuffer[index] ?? 0,
        y: projection.screenYBuffer[index] ?? 0,
        cost: edge.cost,
      });
    }

    const pick = pickNeighborByScreenDirection(
      this.turpalScreen,
      { dx, dy },
      candidates,
      KEYBOARD.moveMaxAngleDeg,
    );
    if (pick === null) return; // Aucun voisin dans le cône : rien, sans punition.
    if (this.turpal.goTo(this.level.graph, pick.id)) this.moves += 1;
  }

  private onAction(action: string): void {
    this.hints.notifyActivity();
    switch (action) {
      case 'cycleNext':
        this.cycleFocus(1);
        break;
      case 'cyclePrev':
        this.cycleFocus(-1);
        break;
      case 'rotateLeft':
        this.actuateFocused(-1);
        break;
      case 'rotateRight':
        this.actuateFocused(1);
        break;
      case 'confirm':
        this.actuateFocused(1);
        break;
      case 'hint':
        this.hints.request();
        break;
      default:
        // muteToggle, fullscreenToggle… : traités par la composition (main).
        break;
    }
  }

  private togglePause(): void {
    this.paused = !this.paused;
    bus.emit('game:pause', { paused: this.paused });
  }

  // ————————————————————————————————— Sélection clavier des mécanismes

  /** Mécanismes manipulables triés par proximité écran avec Turpal. */
  private sortedMechanisms(): Mechanism[] {
    const projection = this.level.nodeProjection;
    const current = this.turpal.currentNode;
    const originX = current !== null ? projection.screenXOf(current) : Number.NaN;
    const originY = current !== null ? projection.screenYOf(current) : Number.NaN;
    const list = [...this.level.mechanisms.values()].filter((m) => m.interactive);
    if (!Number.isFinite(originX)) return list;

    list.sort((a, b) => {
      const pa = this.projectMechanism(a, this.screenPoint) ? this.screenPoint : null;
      const pb = this.projectMechanism(b, this.screenPoint2) ? this.screenPoint2 : null;
      const da =
        pa === null ? Number.POSITIVE_INFINITY : (pa.x - originX) ** 2 + (pa.y - originY) ** 2;
      const db =
        pb === null ? Number.POSITIVE_INFINITY : (pb.x - originX) ** 2 + (pb.y - originY) ** 2;
      return da - db;
    });
    return list;
  }

  private cycleFocus(direction: number): void {
    const list = this.sortedMechanisms();
    if (list.length === 0) {
      this.clearFocus();
      return;
    }

    const index = this.focused === null ? -1 : list.indexOf(this.focused);
    const next = list[(((index + direction) % list.length) + list.length) % list.length];
    if (next === undefined) return;
    this.focused = next;
    haptic('tick');

    if (this.projectMechanism(next, this.screenPoint)) {
      this.focusRing?.show(this.screenPoint.x, this.screenPoint.y, this.mechanismRadiusPx(next));
    }
  }

  private clearFocus(): void {
    this.focused = null;
    this.focusRing?.hide();
  }

  private actuateFocused(amount: number): void {
    this.hints.notifyActivity();
    this.focused?.actuate(amount);
  }

  private updateFocusRing(): void {
    if (this.focused === null || this.focusRing === null) return;
    if (!this.projectMechanism(this.focused, this.screenPoint)) {
      this.focusRing.hide();
      return;
    }
    this.focusRing.move(
      this.screenPoint.x,
      this.screenPoint.y,
      this.mechanismRadiusPx(this.focused),
    );
  }

  // ————————————————————————————————— Picking écran

  private pickMechanism(x: number, y: number): Mechanism | null {
    const targets: PickableScreenTarget<Mechanism>[] = [];
    for (const mechanism of this.level.mechanisms.values()) {
      if (!mechanism.interactive) continue;
      if (!this.projectMechanism(mechanism, this.screenPoint)) continue;
      targets.push({
        value: mechanism,
        x: this.screenPoint.x,
        y: this.screenPoint.y,
        radiusPx: POINTER.pickTargetRadiusPx,
      });
    }
    const hit = PointerInput.pickWithTolerance<Mechanism>(x, y, targets);
    return hit === null ? null : hit.value;
  }

  /**
   * Tap → nœud : picking tolérant sur les nœuds projetés. Le rayon de chaque
   * nœud vaut 40 % de la distance à son plus proche voisin à l'écran — ni trop
   * avare (le pouce est large), ni si généreux qu'on vise un nœud voisin.
   */
  private pickNode(x: number, y: number): NodeId | null {
    const projection = this.level.nodeProjection;
    const count = projection.count;
    if (count === 0) return null;

    const xs: number[] = [];
    const ys: number[] = [];
    for (let i = 0; i < count; i += 1) {
      if (projection.visibleBuffer[i] !== 1) continue;
      xs.push(projection.screenXBuffer[i] ?? 0);
      ys.push(projection.screenYBuffer[i] ?? 0);
    }
    if (xs.length === 0) return null;

    const targets: PickableScreenTarget<NodeId>[] = [];
    for (let i = 0; i < count; i += 1) {
      if (projection.visibleBuffer[i] !== 1) continue;
      const id = projection.idAt(i);
      if (id === undefined) continue;
      const nx = projection.screenXBuffer[i] ?? 0;
      const ny = projection.screenYBuffer[i] ?? 0;

      let nearest = Number.POSITIVE_INFINITY;
      for (let j = 0; j < xs.length; j += 1) {
        if (xs[j] === nx && ys[j] === ny) continue;
        const d = Math.hypot((xs[j] ?? 0) - nx, (ys[j] ?? 0) - ny);
        if (d < nearest) nearest = d;
      }
      const radius = Number.isFinite(nearest)
        ? Math.min(46, Math.max(16, nearest * 0.4))
        : POINTER.pickTargetRadiusPx;

      targets.push({ value: id, x: nx, y: ny, radiusPx: radius });
    }

    const hit = PointerInput.pickWithTolerance<NodeId>(x, y, targets);
    return hit === null ? null : hit.value;
  }

  private tryCallBorz(intent: PointerIntent): boolean {
    if (this.borz === null) return false;
    this.tmpWorld.copy(this.borz.root.position);
    if (!this.projectToScreen(this.tmpWorld, this.screenPoint)) return false;
    const distance = Math.hypot(intent.x - this.screenPoint.x, intent.y - this.screenPoint.y);
    if (distance > 30) return false;
    const current = this.turpal.currentNode ?? this.level.definition.spawn;
    return this.borz.callTo(this.level.graph, current);
  }

  // ————————————————————————————————— Projection monde → écran

  private projectToScreen(world: Vector3, out: ScreenPointMutable): boolean {
    const { width, height } = this.viewport();
    this.tmpNdc.copy(world).project(this.camera);
    if (this.tmpNdc.z < -1 || this.tmpNdc.z > 1) return false;
    out.x = (this.tmpNdc.x + 1) * 0.5 * width;
    out.y = (1 - this.tmpNdc.y) * 0.5 * height;
    return true;
  }

  private projectMechanism(mechanism: Mechanism, out: ScreenPointMutable): boolean {
    mechanism.root.getWorldPosition(this.tmpWorld);
    return this.projectToScreen(this.tmpWorld, out);
  }

  /** Rayon écran approximatif de la poignée, pour l'anneau de sélection. */
  private mechanismRadiusPx(mechanism: Mechanism): number {
    mechanism.root.getWorldPosition(this.tmpWorld);
    this.tmpWorld2.copy(this.tmpWorld);
    this.tmpWorld2.x += 0.42; // ~ rayon d'affordance en unités monde.
    const a = this.projectToScreen(this.tmpWorld, this.screenPoint);
    const b = this.projectToScreen(this.tmpWorld2, this.screenPoint2);
    if (!a || !b) return FOCUS_RING_MIN_PX / 2;
    return Math.max(FOCUS_RING_MIN_PX / 2, Math.abs(this.screenPoint2.x - this.screenPoint.x));
  }

  // ————————————————————————————————— Suivi du niveau

  private updatePressurePlates(): void {
    for (const mechanism of this.level.mechanisms.values()) {
      if (!(mechanism instanceof PressurePlate)) continue;
      const occupied =
        this.turpal.currentNode === mechanism.triggerNode ||
        this.borz?.currentNode === mechanism.triggerNode;
      mechanism.setOccupied(occupied === true);
    }
  }

  private trackArrival(): void {
    const node = this.turpal.currentNode;
    if (node === null || node === this.lastNodeId) return;
    this.lastNodeId = node;

    const navNode = this.level.graph.getNode(node);
    bus.emit('player:moved', {
      nodeId: node,
      ...(navNode !== undefined ? { surface: navNode.surface } : {}),
    });

    if (!this.solved && this.level.isGoal(node)) {
      this.solved = true;
      this.turpal.lookAtSky();
      const goal = this.level.graph.getNode(node);
      bus.emit('level:solved', {
        id: this.level.id,
        moves: this.moves,
        ...(goal !== undefined
          ? {
              at: {
                x: goal.position.x,
                y: goal.position.y,
                z: goal.position.z,
              },
            }
          : {}),
      });
    }
  }

  private onMechanismStateChanged(id: string): void {
    this.actuated.add(id);

    // Quelles arêtes conditionnelles viennent de s'ouvrir ?
    const after = conditionalEdgeSnapshot(this.level.graph);
    for (const key of newlyEnabledEdgeKeys(this.edgeSnapshot, after)) {
      const [from, to] = key.split('|') as [NodeId, NodeId];
      const fromNode = this.level.graph.getNode(from);
      const toNode = this.level.graph.getNode(to);
      if (fromNode === undefined || toNode === undefined) continue;
      bus.emit('path:connected', {
        points: [
          { x: fromNode.position.x, y: fromNode.position.y, z: fromNode.position.z },
          { x: toNode.position.x, y: toNode.position.y, z: toNode.position.z },
        ],
      });
    }
    this.edgeSnapshot = after;

    this.emitMusicProgress();
  }

  private emitMusicProgress(): void {
    const states = new Map<string, MechanismValue>();
    for (const id of this.level.mechanisms.keys()) {
      const state = this.level.graph.getMechanismState(id);
      if (state !== undefined) states.set(id, state);
    }
    const from = this.turpal.currentNode ?? this.level.definition.spawn;
    const goalReachable = findPath(this.level.graph, from, this.level.definition.goal).found;

    const layers = computeMusicLayers({
      definition: this.level.definition,
      mechanismStates: states,
      actuatedMechanisms: this.actuated,
      goalReachable,
    });
    if (layers > this.musicLayersMax) {
      this.musicLayersMax = layers;
      bus.emit('music:progress', { layers });
    }
  }

  // ————————————————————————————————— Indices

  private applyHintStage(stage: HintStage): void {
    const candidate = this.hintCandidateMechanism();
    if (stage === 'none') {
      this.hintGlowTarget = 0;
      this.borz?.clearGaze();
      return;
    }

    if (candidate !== null) {
      this.hintCandidate = candidate;
      this.hintGlowTarget = 1;
    }
    if (stage === 'gaze' && candidate !== null) {
      this.tmpWorld.set(
        candidate.root.position.x,
        candidate.root.position.y,
        candidate.root.position.z,
      );
      this.borz?.gazeAt(this.tmpWorld);
    }
  }

  /** L'élément « utile » : le premier mécanisme encore manipulable. */
  private hintCandidateMechanism(): Mechanism | null {
    for (const mechanism of this.level.mechanisms.values()) {
      if (mechanism.interactive) return mechanism;
    }
    return null;
  }

  private updateHintGlow(delta: number): void {
    if (this.hintGlowCurrent === this.hintGlowTarget) return;
    const step = delta / (PACING.hintFadeMs / 1000);
    if (this.hintGlowCurrent < this.hintGlowTarget) {
      this.hintGlowCurrent = Math.min(this.hintGlowTarget, this.hintGlowCurrent + step);
    } else {
      this.hintGlowCurrent = Math.max(this.hintGlowTarget, this.hintGlowCurrent - step);
    }
    const candidate = this.hintCandidate;
    if (candidate !== null) candidate.setHintGlow(this.hintGlowCurrent);
    if (this.hintGlowCurrent === 0 && candidate !== null) this.hintCandidate = null;
  }
}

function nowMs(): number {
  return typeof performance === 'object' && performance !== null ? performance.now() : Date.now();
}
