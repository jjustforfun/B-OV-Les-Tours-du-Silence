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
import { Quaternion, Vector3, type Camera, type Object3D } from 'three';
import { bus } from '@core/EventBus';
import { isReducedMotion } from '@core/motion';
import { KEYBOARD, PACING, POINTER, TURPAL } from '@/config';
import { haptic } from '@input/Haptics';
import type { InputEvents, InputManager, PointerIntent } from '@input/InputManager';
import { PointerInput, type PickableScreenTarget } from '@input/PointerInput';
import { pickNeighborByScreenDirection, type DirectionalCandidate } from '@input/screenMove';
import { FocusRing } from '@ui/FocusRing';
import { Child } from '@entities/Child';
import { Borz } from '@entities/companion/Borz';
import { Elder } from '@entities/npc/Elder';
import { MountainProcession } from '@entities/npc/MountainProcession';
import { Rival } from '@entities/npc/Rival';
import { ValleyGathering } from '@entities/npc/ValleyGathering';
import { HearthSmoke, Traveler } from '@entities/npc/Traveler';
import { Turpal } from '@entities/player/Turpal';
import { TurpalModel } from '@entities/player/TurpalModel';
import { Hints, type HintStage } from '@fx/Hints';
import type {
  Level,
  LevelChildActorDef,
  LevelElderActorDef,
  LevelProcessionActorDef,
  LevelRivalActorDef,
  LevelTravelerActorDef,
  LevelTriggerDef,
} from './Level';
import type { Mechanism, MechanismContext } from './mechanisms/Mechanism';
import { PressurePlate } from './mechanisms/PressurePlate';
import { Slider } from './mechanisms/Slider';
import { TowerRotation } from './mechanisms/TowerRotation';
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
  /** Secrets déjà contemplés, injectés par la sauvegarde pour l'aigle final. */
  readonly foundEagleIds?: readonly string[];
}

interface ScreenPointMutable {
  x: number;
  y: number;
}

interface TravelerRuntimeEntry {
  readonly definition: LevelTravelerActorDef;
  readonly traveler: Traveler;
  readonly smoke: HearthSmoke | null;
  started: boolean;
  completed: boolean;
}

interface ChildRuntimeEntry {
  readonly definition: LevelChildActorDef;
  readonly child: Child;
}

interface ElderRuntimeEntry {
  readonly definition: LevelElderActorDef;
  readonly elder: Elder;
  stageIndex: number;
  moving: boolean;
  completed: boolean;
}

interface RivalRuntimeEntry {
  readonly definition: LevelRivalActorDef;
  readonly rival: Rival;
  pendingClosure: boolean;
  completed: boolean;
}

interface ProcessionRuntimeEntry {
  readonly definition: LevelProcessionActorDef;
  readonly procession: MountainProcession;
  phase: 'idle' | 'outbound' | 'returning';
  completed: boolean;
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
  private readonly travelers: TravelerRuntimeEntry[] = [];
  private readonly children: ChildRuntimeEntry[] = [];
  private readonly elders: ElderRuntimeEntry[] = [];
  private readonly rivals: RivalRuntimeEntry[] = [];
  private readonly processions: ProcessionRuntimeEntry[] = [];
  private readonly finale: ValleyGathering | null;
  private finaleSeatReached = false;
  private readonly hints: Hints;
  private readonly unsubscribe: (() => void)[] = [];
  private disposed = false;

  private moves = 0;
  private solved = false;
  private paused = false;
  private lastNodeId: NodeId | null = null;
  private musicLayersMax = 1;
  private edgeSnapshot: Map<string, boolean>;
  private readonly actuated = new Set<string>();
  private readonly playedTriggers = new Set<string>();

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
  private readonly cameraUpFrom = new Vector3(0, 1, 0);
  private readonly cameraUpTarget = new Vector3(0, 1, 0);
  private readonly cameraUpRotation = new Quaternion();
  private readonly cameraUpStep = new Quaternion();
  private readonly cameraLookTarget = new Vector3();
  private cameraRollElapsed = TURPAL.upBlendMs / 1000;
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
    this.camera.up.normalize();
    this.cameraUpFrom.copy(this.camera.up);
    this.cameraUpTarget.copy(this.camera.up);
    this.camera.getWorldDirection(this.tmpWorld);
    this.cameraLookTarget.copy(this.camera.position).addScaledVector(this.tmpWorld, 100);

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
    this.level.root.add(this.turpal.root, this.turpal.destinationMarker.root);
    const borzNode = this.level.graph.findNodesByTag('borz')[0];
    this.borz = borzNode === undefined ? null : new Borz();
    if (this.borz !== null && borzNode !== undefined) {
      this.borz.placeAt(this.level.graph, borzNode.id);
      if (borzNode.tags.has('borz:dormant')) this.borz.sleepStone();
      this.level.root.add(this.borz.root);
    }
    this.buildStoryActors();
    const finaleDefinition = this.level.definition.finale;
    if (finaleDefinition === undefined) {
      this.finale = null;
    } else {
      const found = new Set(deps.foundEagleIds ?? []);
      const finalEagleUnlocked = finaleDefinition.requiredEagles.every((id) => found.has(id));
      this.finale = new ValleyGathering(
        finaleDefinition,
        this.level.graph,
        this.level.towerRoots,
        finalEagleUnlocked,
      );
      this.level.root.add(this.finale.root);
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
    this.runStartTriggers();
  }

  get isSolved(): boolean {
    return this.solved;
  }

  /** Une image de simulation. `elapsed` et `delta` en secondes. */
  update(elapsed: number, delta: number): void {
    // Pause : la simulation gèle, jamais le rendu — le monde reste visible,
    // simplement immobile derrière le voile du menu (docs/GDD.md).
    if (this.disposed || this.paused) return;
    this.updateCameraRoll(delta);
    const { width, height } = this.viewport();
    const camera = this.camera;
    this.level.projectNodes(
      camera.projectionMatrix.elements,
      camera.matrixWorldInverse.elements,
      width,
      height,
    );

    this.mechanismContext.elapsed = elapsed;
    this.attachSliderPassengers();
    for (const mechanism of this.level.mechanisms.values()) {
      mechanism.update(this.mechanismContext, delta);
    }
    this.detachSliderPassengers();
    this.updatePressurePlates();

    this.turpal.update(this.level.graph, delta);
    this.borz?.update(delta);
    this.updateProcessions(delta);
    this.updateStoryActors(delta);
    this.updateElders(delta);
    for (const entry of this.children) entry.child.update(delta);
    for (const entry of this.rivals) entry.rival.update(delta);
    this.finale?.update(delta);
    this.updateFinaleCompanion();
    this.level.updateSecrets(delta);
    this.trackArrival();

    this.hints.update(delta * 1000);
    this.updateHintGlow(delta);
    this.updateFocusRing();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const off of this.unsubscribe) off();
    this.unsubscribe.length = 0;
    this.finale?.dispose();
    this.turpal.dispose();
    for (const entry of this.processions) entry.procession.dispose();
    this.processions.length = 0;
    this.borz?.dispose();
    for (const entry of this.travelers) {
      entry.traveler.dispose();
      entry.smoke?.dispose();
    }
    this.travelers.length = 0;
    for (const entry of this.children) entry.child.dispose();
    this.children.length = 0;
    for (const entry of this.elders) entry.elder.dispose();
    this.elders.length = 0;
    for (const entry of this.rivals) entry.rival.dispose();
    this.rivals.length = 0;
    this.hints.dispose();
    if (this.ownFocusRing) this.focusRing?.dispose();
    else this.focusRing?.hide();
    this.level.root.removeFromParent();
  }

  // ————————————————————————————————— Réactions aux intentions du joueur

  private bindInput(): void {
    const input = this.input;
    // Pendant la pause, plus aucune intention de jeu — seule la touche
    // Pause elle-même traverse (elle rouvre le monde).
    const live = <K extends keyof InputEvents>(
      event: K,
      handler: (payload: InputEvents[K]) => void,
    ) =>
      input.on(event, (payload) => {
        if (this.paused) return;
        handler(payload);
      });
    this.unsubscribe.push(
      live('tap', (intent) => this.onTap(intent)),
      live('longPress', () => this.hints.request()),
      live('action', (action) => {
        // Touche d'indice (H) : même indice que l'appui long (docs/CONTROLS.md).
        if (action === 'hint') this.hints.request();
      }),
      live('dragStart', (intent) => this.onDragStart(intent)),
      live('drag', (intent) => this.onDrag(intent)),
      live('dragEnd', () => this.onDragEnd()),
      live('move', (direction) => this.onMoveDirection(direction.dx, direction.dy)),
      live('confirm', () => this.actuateFocused(1)),
      live('cancel', () => this.clearFocus()),
      live('action', (action) => this.onAction(action)),
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
      this.attachSliderPassenger(mechanism);
      mechanism.actuate(1);
      return;
    }

    const nodeId = this.pickNode(intent.x, intent.y);
    if (nodeId === null) return;
    const secret = this.level.secretForNode(nodeId);
    if (secret !== undefined) {
      this.runNodeTriggers(nodeId);
      haptic('celebrate');
      return;
    }
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
    this.attachSliderPassenger(mechanism);
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
    if (this.paused) this.resume();
    else this.pause();
  }

  /** Gèle la simulation (menu pause). Idempotent. */
  pause(): void {
    if (this.paused) return;
    // Une pause pendant un glissement doit laisser le mécanisme sur un cran
    // valide ; le `dragEnd` ultérieur peut être filtré par l'état suspendu.
    this.onDragEnd();
    this.paused = true;
    bus.emit('game:pause', { paused: true });
  }

  /** Relance la simulation. Idempotent. */
  resume(): void {
    if (!this.paused) return;
    this.paused = false;
    bus.emit('game:pause', { paused: false });
  }

  get isPaused(): boolean {
    return this.paused;
  }

  // ————————————————————————————————— Sélection clavier des mécanismes

  /** Mécanismes manipulables triés par proximité écran avec Turpal. */
  private sortedMechanisms(): Mechanism[] {
    const projection = this.level.nodeProjection;
    const current = this.turpal.currentNode;
    const originX = current !== null ? projection.screenXOf(current) : Number.NaN;
    const originY = current !== null ? projection.screenYOf(current) : Number.NaN;
    const list = [...this.level.mechanisms.values()].filter(
      (mechanism) =>
        mechanism.interactive &&
        current !== null &&
        this.level.isMechanismActuatorNode(mechanism.id, current),
    );
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
    const mechanism = this.focused;
    const current = this.turpal.currentNode;
    if (
      mechanism === null ||
      current === null ||
      !this.level.isMechanismActuatorNode(mechanism.id, current)
    )
      return;
    this.attachSliderPassenger(mechanism);
    mechanism.actuate(amount);
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
    const current = this.turpal.currentNode;
    for (const mechanism of this.level.mechanisms.values()) {
      if (
        !mechanism.interactive ||
        current === null ||
        !this.level.isMechanismActuatorNode(mechanism.id, current)
      )
        continue;
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
      const id = projection.idAt(i);
      if (id === undefined || !this.level.isSecretPickable(id)) continue;
      xs.push(projection.screenXBuffer[i] ?? 0);
      ys.push(projection.screenYBuffer[i] ?? 0);
    }
    if (xs.length === 0) return null;

    const targets: PickableScreenTarget<NodeId>[] = [];
    for (let i = 0; i < count; i += 1) {
      if (projection.visibleBuffer[i] !== 1) continue;
      const id = projection.idAt(i);
      if (id === undefined || !this.level.isSecretPickable(id)) continue;
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
    if (this.borz === null || this.processions.length > 0) return false;
    this.tmpWorld.copy(this.borz.root.position);
    if (!this.projectToScreen(this.tmpWorld, this.screenPoint)) return false;
    const distance = Math.hypot(intent.x - this.screenPoint.x, intent.y - this.screenPoint.y);
    if (distance > 30) return false;
    const current = this.turpal.currentNode ?? this.level.definition.spawn;
    return this.borz.callTo(this.level.graph, current);
  }

  // ————————————————————————————————— Projection monde → écran

  private startCameraRoll(x: number, y: number, z: number): void {
    this.cameraUpTarget.set(x, y, z).normalize();
    if (this.camera.up.distanceToSquared(this.cameraUpTarget) < 0.000001) return;
    this.cameraUpFrom.copy(this.camera.up).normalize();
    this.cameraUpRotation.setFromUnitVectors(this.cameraUpFrom, this.cameraUpTarget);
    this.cameraRollElapsed = 0;
  }

  private updateCameraRoll(delta: number): void {
    const duration = TURPAL.upBlendMs / 1000;
    if (this.cameraRollElapsed >= duration) return;
    this.cameraRollElapsed = Math.min(duration, this.cameraRollElapsed + delta);
    const ratio = this.cameraRollElapsed / duration;
    const eased = ratio * ratio * (3 - 2 * ratio);
    this.cameraUpStep.identity().slerp(this.cameraUpRotation, eased);
    this.camera.up.copy(this.cameraUpFrom).applyQuaternion(this.cameraUpStep).normalize();
    this.camera.lookAt(this.cameraLookTarget);
    this.camera.updateMatrixWorld(true);
  }

  private projectToScreen(world: Vector3, out: ScreenPointMutable): boolean {
    const { width, height } = this.viewport();
    this.tmpNdc.copy(world).project(this.camera);
    if (this.tmpNdc.z < -1 || this.tmpNdc.z > 1) return false;
    out.x = (this.tmpNdc.x + 1) * 0.5 * width;
    out.y = (1 - this.tmpNdc.y) * 0.5 * height;
    return true;
  }

  private projectMechanism(mechanism: Mechanism, out: ScreenPointMutable): boolean {
    (mechanism.interactionRoot ?? mechanism.root).getWorldPosition(this.tmpWorld);
    return this.projectToScreen(this.tmpWorld, out);
  }

  /** Rayon écran approximatif de la poignée, pour l'anneau de sélection. */
  private mechanismRadiusPx(mechanism: Mechanism): number {
    (mechanism.interactionRoot ?? mechanism.root).getWorldPosition(this.tmpWorld);
    this.tmpWorld2.copy(this.tmpWorld);
    this.tmpWorld2.x += 0.42; // ~ rayon d'affordance en unités monde.
    const a = this.projectToScreen(this.tmpWorld, this.screenPoint);
    const b = this.projectToScreen(this.tmpWorld2, this.screenPoint2);
    if (!a || !b) return FOCUS_RING_MIN_PX / 2;
    return Math.max(FOCUS_RING_MIN_PX / 2, Math.abs(this.screenPoint2.x - this.screenPoint.x));
  }

  // ————————————————————————————————— Acteurs narratifs

  private buildStoryActors(): void {
    for (const definition of this.level.definition.actors ?? []) {
      if (definition.kind === 'child') {
        const child = new Child(definition.id);
        child.root.position.set(definition.at[0], definition.at[1], definition.at[2]);
        this.level.root.add(child.root);
        this.children.push({ definition, child });
        continue;
      }
      if (definition.kind === 'elder') {
        const elder = new Elder(definition.id);
        elder.placeAt(this.level.graph, definition.spawn);
        this.level.root.add(elder.root);
        this.elders.push({
          definition,
          elder,
          stageIndex: 0,
          moving: false,
          completed: false,
        });
        continue;
      }
      if (definition.kind === 'rival') {
        const rival = new Rival();
        rival.placeAt(this.level.graph, definition.spawn);
        this.level.root.add(rival.root);
        this.level.mechanisms.get(definition.rivalMechanism)?.setEnabled(false);
        this.rivals.push({ definition, rival, pendingClosure: false, completed: false });
        continue;
      }
      if (definition.kind === 'procession') {
        const procession = new MountainProcession(definition.id);
        procession.placeWaiting(this.level.graph, definition.waitingNodes);
        this.level.root.add(procession.root);
        this.processions.push({ definition, procession, phase: 'idle', completed: false });
        continue;
      }
      const traveler = new Traveler();
      traveler.placeAt(this.level.graph, definition.spawn);
      this.level.root.add(traveler.root);

      let smoke: HearthSmoke | null = null;
      if (definition.hearthAt !== undefined) {
        smoke = new HearthSmoke();
        smoke.root.position.set(
          definition.hearthAt[0],
          definition.hearthAt[1],
          definition.hearthAt[2],
        );
        this.level.root.add(smoke.root);
      }
      this.travelers.push({ definition, traveler, smoke, started: false, completed: false });
    }
  }

  private updateRivalsForArrival(nodeId: NodeId): void {
    for (const entry of this.rivals) {
      if (entry.completed) continue;
      const definition = entry.definition;
      const responseState = definition.responseState;

      if (nodeId !== definition.respondsOnNode) {
        if (this.level.graph.getMechanismState(responseState.mechanism) === responseState.value) {
          this.level.graph.setMechanismState(responseState.mechanism, responseState.initial);
          this.onGraphStateChanged(responseState.mechanism);
        }
        continue;
      }
      if (this.level.graph.getMechanismState(responseState.mechanism) !== responseState.initial)
        continue;

      const playerTower = this.level.mechanisms.get(definition.playerMechanism);
      const rivalTower = this.level.mechanisms.get(definition.rivalMechanism);
      if (!(playerTower instanceof TowerRotation) || !(rivalTower instanceof TowerRotation))
        continue;
      if (rivalTower.isAnimating) continue;

      this.level.graph.setMechanismState(responseState.mechanism, responseState.value);
      this.level.graph.setMechanismState(
        definition.advancedState.mechanism,
        definition.advancedState.value,
      );
      this.onGraphStateChanged(definition.advancedState.mechanism);
      this.turpal.offerHand();
      entry.rival.respond();

      const previousRivalFace =
        (definition.rivalFace - 1 + rivalTower.faceCount) % rivalTower.faceCount;
      entry.pendingClosure =
        playerTower.currentFace === definition.playerFace &&
        rivalTower.currentFace === previousRivalFace;
      rivalTower.actuateByActor(1);
    }
  }

  private finishRivalRotations(mechanismId: string): void {
    for (const entry of this.rivals) {
      const definition = entry.definition;
      if (entry.completed || !entry.pendingClosure || mechanismId !== definition.rivalMechanism)
        continue;
      entry.pendingClosure = false;

      const playerTower = this.level.mechanisms.get(definition.playerMechanism);
      const rivalTower = this.level.mechanisms.get(definition.rivalMechanism);
      if (!(playerTower instanceof TowerRotation) || !(rivalTower instanceof TowerRotation))
        continue;
      if (
        playerTower.currentFace !== definition.playerFace ||
        rivalTower.currentFace !== definition.rivalFace
      )
        continue;

      entry.completed = true;
      entry.rival.reconcile();
      playerTower.setEnabled(false);
      rivalTower.setEnabled(false);
      const stateId = this.level.completeActor(definition.id);
      if (stateId === null) continue;
      this.level.syncSecretsForMechanism(stateId);
      this.onGraphStateChanged(stateId);
    }
  }

  private startProcessions(mechanismId: string): void {
    const borz = this.borz;
    if (borz === null) return;
    const value = this.level.graph.getMechanismState(mechanismId);
    for (const entry of this.processions) {
      const condition = entry.definition.startsOn;
      if (
        entry.completed ||
        entry.phase !== 'idle' ||
        condition.mechanism !== mechanismId ||
        condition.equals !== value
      )
        continue;
      if (!borz.startPath(this.level.graph, entry.definition.outboundPath)) continue;
      if (!entry.procession.beginNextRide(borz)) continue;
      entry.phase = 'outbound';
    }
  }

  private updateProcessions(delta: number): void {
    const borz = this.borz;
    for (const entry of this.processions) entry.procession.update(delta);
    if (!borz?.consumeRouteCompletion()) return;

    const entry = this.processions.find(
      (candidate) => candidate.phase === 'outbound' || candidate.phase === 'returning',
    );
    if (entry === undefined) return;
    if (entry.phase === 'outbound') {
      entry.procession.settleCurrentRide(borz, this.level.graph, entry.definition.summitNodes);
      if (entry.procession.isComplete) {
        entry.completed = true;
        entry.phase = 'idle';
        const stateId = this.level.completeActor(entry.definition.id);
        if (stateId !== null) this.onGraphStateChanged(stateId);
        return;
      }
      if (borz.startPath(this.level.graph, entry.definition.returnPath)) {
        entry.phase = 'returning';
      }
      return;
    }

    if (!borz.startPath(this.level.graph, entry.definition.outboundPath)) return;
    if (!entry.procession.beginNextRide(borz)) return;
    entry.phase = 'outbound';
  }

  private startStoryActors(mechanismId: string): void {
    const value = this.level.graph.getMechanismState(mechanismId);
    for (const entry of this.travelers) {
      const condition = entry.definition.startsOn;
      if (entry.started || condition.mechanism !== mechanismId || condition.equals !== value)
        continue;
      if (!entry.traveler.start(this.level.graph, entry.definition.path)) continue;
      entry.started = true;
      const lockId = entry.definition.locksMechanism;
      if (lockId !== undefined) this.level.mechanisms.get(lockId)?.setEnabled(false);
    }
  }

  private updateStoryActors(delta: number): void {
    for (const entry of this.travelers) {
      entry.smoke?.update(delta);
      if (!entry.started || entry.completed || !entry.traveler.update(delta)) continue;
      entry.completed = true;
      entry.smoke?.reveal();
      const lockId = entry.definition.locksMechanism;
      if (lockId !== undefined) this.level.mechanisms.get(lockId)?.setEnabled(true);
      const stateId = this.level.completeActor(entry.definition.id);
      if (stateId !== null) this.onGraphStateChanged(stateId);
      bus.emit('traveler:welcomed', {
        actorId: entry.definition.id,
        at: {
          x: entry.traveler.root.position.x,
          y: entry.traveler.root.position.y,
          z: entry.traveler.root.position.z,
        },
      });
    }
  }

  private startElders(mechanismId: string): void {
    for (const entry of this.elders) {
      const stage = entry.definition.stages[entry.stageIndex];
      if (stage?.startsOn.mechanism !== mechanismId) continue;
      this.tryStartElderStage(entry);
    }
  }

  private tryStartElderStage(entry: ElderRuntimeEntry): void {
    if (entry.moving || entry.completed) return;
    const stage = entry.definition.stages[entry.stageIndex];
    if (stage === undefined) return;
    const value = this.level.graph.getMechanismState(stage.startsOn.mechanism);
    if (value !== stage.startsOn.equals) return;
    entry.moving = entry.elder.start(this.level.graph, stage.path);
  }

  private updateElders(delta: number): void {
    for (const entry of this.elders) {
      const stageFinished = entry.elder.update(delta);
      if (!stageFinished || !entry.moving) continue;
      entry.moving = false;
      entry.stageIndex += 1;
      if (entry.stageIndex < entry.definition.stages.length) {
        this.tryStartElderStage(entry);
        continue;
      }

      entry.completed = true;
      entry.elder.indicate();
      const stateId = this.level.completeActor(entry.definition.id);
      if (stateId !== null) this.onGraphStateChanged(stateId);
      bus.emit('elder:arrived', {
        actorId: entry.definition.id,
        at: {
          x: entry.elder.root.position.x,
          y: entry.elder.root.position.y,
          z: entry.elder.root.position.z,
        },
      });
    }
  }

  // ————————————————————————————————— Suivi du niveau

  private updateFinaleForArrival(nodeId: NodeId): void {
    const finale = this.finale;
    if (finale === null) return;
    const arrival = finale.reach(nodeId);
    const node = this.level.graph.getNode(nodeId);
    if (arrival?.kind === 'tower' && node !== undefined) {
      bus.emit('finale:towerLit', {
        index: arrival.index,
        at: { x: node.position.x, y: node.position.y, z: node.position.z },
      });
    }
    if (arrival?.kind === 'threshold' && node !== undefined) {
      bus.emit('finale:threshold', {
        at: { x: node.position.x, y: node.position.y, z: node.position.z },
      });
    }
    if (arrival?.kind === 'seat') {
      this.finaleSeatReached = true;
      finale.perchFinalEagle(this.turpal.root);
      return;
    }
    if (this.borz !== null && !this.borz.isMoving) {
      this.borz.callTo(this.level.graph, nodeId);
    }
  }

  private updateFinaleCompanion(): void {
    const finale = this.finale;
    const borz = this.borz;
    if (finale === null || borz === null || !this.finaleSeatReached || borz.isResting) return;
    const seat = finale.definition.seatNode;
    if (borz.currentNode === seat && !borz.isMoving) {
      borz.lieDown();
      return;
    }
    if (!borz.isMoving) borz.callTo(this.level.graph, seat);
  }

  private attachSliderPassenger(mechanism: Mechanism): void {
    if (!(mechanism instanceof Slider) || mechanism.carriedPassenger !== null) return;
    const current = this.turpal.currentNode;
    if (current === null || !this.level.isMechanismActuatorNode(mechanism.id, current)) return;
    mechanism.attachPassenger(this.turpal.root);
  }

  private attachSliderPassengers(): void {
    for (const mechanism of this.level.mechanisms.values()) {
      if (!(mechanism instanceof Slider) || !mechanism.isAnimating) continue;
      this.attachSliderPassenger(mechanism);
    }
  }

  private detachSliderPassengers(): void {
    for (const mechanism of this.level.mechanisms.values()) {
      if (!(mechanism instanceof Slider)) continue;
      if (
        mechanism.carriedPassenger !== this.turpal.root ||
        mechanism.isAnimating ||
        this.dragMechanism === mechanism
      )
        continue;
      mechanism.detachPassenger(this.level.root);
    }
  }

  private updatePressurePlates(): void {
    for (const mechanism of this.level.mechanisms.values()) {
      if (!(mechanism instanceof PressurePlate)) continue;
      const occupiedByBorz = this.borz?.currentNode === mechanism.triggerNode;
      const occupied = this.turpal.currentNode === mechanism.triggerNode || occupiedByBorz;
      mechanism.setOccupied(occupied === true);

      const bridge = mechanism.borzBridge;
      if (this.borz !== null && bridge !== undefined) {
        this.borz.serveAsBridge(
          this.level.graph,
          bridge[0],
          bridge[1],
          occupiedByBorz || mechanism.isPressed,
        );
      }
    }
  }

  private trackArrival(): void {
    const node = this.turpal.currentNode;
    if (node === null || node === this.lastNodeId) return;
    const previous = this.lastNodeId;
    this.lastNodeId = node;

    const navNode = this.level.graph.getNode(node);
    if (navNode !== undefined) this.startCameraRoll(navNode.up.x, navNode.up.y, navNode.up.z);
    bus.emit('player:moved', {
      nodeId: node,
      ...(navNode !== undefined ? { surface: navNode.surface } : {}),
    });

    if (previous !== null) this.emitIllusionCrossing(previous, node);
    this.level.revealSecretsForNode(node);
    this.updateRivalsForArrival(node);
    this.updateFinaleForArrival(node);
    const finalGesture = this.runNodeTriggers(node);

    if (!this.solved && this.level.isGoal(node)) {
      this.solved = true;
      if (!finalGesture) this.turpal.lookAtSky();
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
    this.level.syncSecretsForMechanism(id);
    this.startStoryActors(id);
    this.startElders(id);
    this.startProcessions(id);
    this.finishRivalRotations(id);
    const value = this.level.graph.getMechanismState(id);
    for (const entry of this.children) {
      const condition = entry.definition.reactsOn;
      if (condition.mechanism === id && condition.equals === value) entry.child.celebrate();
    }
    this.onGraphStateChanged(id);
  }

  private onGraphStateChanged(id: string): void {
    this.runMechanismTriggers(id);

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

  // ————————————————————————————————— Illusion et récit

  private emitIllusionCrossing(fromId: NodeId, toId: NodeId): void {
    const edge = this.level.graph.getEdge(fromId, toId);
    if (edge?.illusory !== true) return;
    const from = this.level.graph.getNode(fromId);
    const to = this.level.graph.getNode(toId);
    if (from === undefined || to === undefined) return;
    bus.emit('illusion:crossed', {
      from: { x: from.position.x, y: from.position.y, z: from.position.z },
      to: { x: to.position.x, y: to.position.y, z: to.position.z },
    });
  }

  private runStartTriggers(): void {
    for (const trigger of this.level.definition.triggers ?? []) {
      if ('levelStart' in trigger.on) this.playTrigger(trigger);
    }
  }

  private runMechanismTriggers(id: string): void {
    const value = this.level.graph.getMechanismState(id);
    for (const trigger of this.level.definition.triggers ?? []) {
      if (!('mechanism' in trigger.on)) continue;
      if (trigger.on.mechanism !== id || trigger.on.equals !== value) continue;
      this.playTrigger(trigger);
    }
  }

  /** Retourne vrai si un geste final doit remplacer le regard vers le ciel. */
  private runNodeTriggers(nodeId: NodeId): boolean {
    let gesturePlayed = false;
    for (const trigger of this.level.definition.triggers ?? []) {
      if (!('node' in trigger.on) || trigger.on.node !== nodeId) continue;
      gesturePlayed = this.playTrigger(trigger, nodeId) || gesturePlayed;
    }
    return gesturePlayed;
  }

  private playTrigger(trigger: LevelTriggerDef, nodeId?: NodeId): boolean {
    if (trigger.once !== false && this.playedTriggers.has(trigger.id)) return false;
    this.playedTriggers.add(trigger.id);
    const play = trigger.play;

    if ('textKey' in play) bus.emit('narrative:text', { key: play.textKey });
    if ('musicLayers' in play) {
      const layers = Math.min(4, Math.max(1, Math.round(play.musicLayers)));
      if (layers > this.musicLayersMax) {
        this.musicLayersMax = layers;
        bus.emit('music:progress', { layers });
      }
    }
    if ('revealSecret' in play) this.level.revealSecret(play.revealSecret);
    if ('borzAwaken' in play) this.borz?.awaken();
    if ('sky' in play) {
      bus.emit('sky:transition', {
        palette: play.sky,
        durationSeconds: play.durationSeconds ?? 3.5,
      });
    }
    if ('eagleFound' in play) {
      const secret = nodeId === undefined ? undefined : this.level.secretForNode(nodeId);
      if (secret !== undefined) {
        this.level.discoverSecret(secret.id);
        bus.emit('secret:eagleFound', { levelId: this.level.id, secretId: secret.id });
      }
    }
    if ('gesture' in play && play.by === 'turpal') {
      if (play.gesture === 'handOnStone') this.turpal.handOnStone();
      if (play.gesture === 'salute') this.turpal.saluteElder(this.level.graph);
      if (play.gesture === 'sit') this.turpal.sitAmongFamily();
      return true;
    }
    return false;
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
