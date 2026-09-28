/**
 * MoonCycle.ts — montée lente de la lune au-dessus de Kezenoy-Am.
 *
 * Ce mécanisme autonome démarre quand une dalle donnée est active. Sa
 * progression ne revient jamais en arrière : une interruption ne fait que la
 * mettre en pause. Les six dernières secondes forment le zénith, puis la
 * porte lunaire reste ouverte définitivement.
 */
import { ConeGeometry, Group, Mesh, MeshBasicMaterial, PlaneGeometry, SphereGeometry } from 'three';
import { bus } from '@core/EventBus';
import { BaseMechanism, clamp01, type MechanismContext } from './Mechanism';
import type { MechanismValue, NavGraph } from '../NavGraph';

export type MoonPhase = 'waiting' | 'zenith' | 'open';

export interface MoonCycleOptions {
  readonly startsOn: {
    readonly mechanism: string;
    readonly equals: MechanismValue;
  };
  readonly durationSeconds?: number;
  readonly zenithSeconds?: number;
  readonly riseHeight?: number;
  readonly driftX?: number;
}

export class MoonCycle extends BaseMechanism {
  readonly root = new Group();

  private readonly moon = new Group();
  private readonly mist = new Group();
  private readonly birds = new Group();
  private moonMaterial: MeshBasicMaterial | null = null;
  private mistMaterial: MeshBasicMaterial | null = null;
  private readonly duration: number;
  private readonly zenithAt: number;
  private readonly riseHeight: number;
  private readonly driftX: number;
  private timer = 0;
  private ambientElapsed = 0;
  private currentPhase: MoonPhase = 'waiting';

  constructor(
    id: string,
    private readonly options: MoonCycleOptions,
  ) {
    super(id);
    this.root.name = `MoonCycle:${id}`;
    this.duration = Math.max(0.1, options.durationSeconds ?? 40);
    this.zenithAt = Math.min(
      this.duration,
      Math.max(0, options.zenithSeconds ?? this.duration - 6),
    );
    this.riseHeight = options.riseHeight ?? 5.5;
    this.driftX = options.driftX ?? -2.2;
    this.buildVisuals();
    this.updateVisuals();
  }

  override get interactive(): boolean {
    return false;
  }

  get phase(): MoonPhase {
    return this.currentPhase;
  }

  get elapsedSeconds(): number {
    return this.timer;
  }

  get progress(): number {
    return clamp01(this.timer / this.duration);
  }

  get zenithDurationSeconds(): number {
    return this.duration - this.zenithAt;
  }

  actuate(): void {
    // La lune ne répond ni au tap ni au glissement : attendre est la solution.
  }

  override update(context: MechanismContext, delta: number): void {
    super.update(context, delta);
    const safeDelta = Math.max(0, delta);
    this.ambientElapsed += safeDelta;

    if (
      this.currentPhase !== 'open' &&
      context.graph.getMechanismState(this.options.startsOn.mechanism) ===
        this.options.startsOn.equals
    ) {
      this.timer = Math.min(this.duration, this.timer + safeDelta);
      if (this.currentPhase === 'waiting' && this.timer >= this.zenithAt) {
        this.setPhase(context.graph, 'zenith');
      }
      if (this.timer >= this.duration) this.setPhase(context.graph, 'open');
    }

    this.updateVisuals();
  }

  applyToGraph(graph: NavGraph): void {
    graph.setMechanismState(this.id, this.currentPhase);
    bus.emit('mechanism:stateChanged', {
      id: this.id,
      kind: 'moonCycle',
      value: this.currentPhase,
      at: this.eventPosition(),
    });
  }

  private setPhase(graph: NavGraph, phase: MoonPhase): void {
    if (phase === this.currentPhase) return;
    this.currentPhase = phase;
    this.applyToGraph(graph);
    bus.emit('moon:phase', {
      id: this.id,
      phase,
      elapsedSeconds: this.timer,
      progress: this.progress,
    });
    if (phase === 'open') {
      bus.emit('mechanism:snap', {
        id: this.id,
        kind: 'moonCycle',
        value: phase,
        notch: 1,
        sound: 'moon-gate',
        at: this.eventPosition(),
        steps: 2,
      });
    }
  }

  private buildVisuals(): void {
    this.moon.name = `Moon:${this.id}`;
    this.moonMaterial = this.trackMaterial(
      new MeshBasicMaterial({ color: 0xdfe7f2, transparent: true, opacity: 0.58 }),
    );
    const disc = new Mesh(this.trackGeometry(new SphereGeometry(0.58, 18, 12)), this.moonMaterial);
    disc.name = 'MoonDisc';
    this.moon.add(disc);
    this.root.add(this.moon);

    this.mist.name = `LakeMist:${this.id}`;
    const mistMaterial = this.trackMaterial(
      new MeshBasicMaterial({
        color: 0x8fa4c4,
        transparent: true,
        opacity: 0.08,
        depthWrite: false,
      }),
    );
    this.mistMaterial = mistMaterial;
    for (let index = 0; index < 3; index += 1) {
      const ribbon = new Mesh(
        this.trackGeometry(new PlaneGeometry(4.8 - index * 0.7, 0.24)),
        mistMaterial,
      );
      ribbon.name = `MistRibbon:${index + 1}`;
      ribbon.rotation.x = -Math.PI / 2;
      ribbon.position.set(-index * 0.55, -0.92 - index * 0.035, index * 1.2);
      this.mist.add(ribbon);
    }
    this.root.add(this.mist);

    this.birds.name = `MoonBirds:${this.id}`;
    const birdMaterial = this.trackMaterial(
      new MeshBasicMaterial({ color: 0x1b2740, transparent: true, opacity: 0.72 }),
    );
    for (let index = 0; index < 3; index += 1) {
      const bird = new Mesh(this.trackGeometry(new ConeGeometry(0.1, 0.34, 3)), birdMaterial);
      bird.name = `MoonBird:${index + 1}`;
      bird.rotation.z = Math.PI / 2;
      bird.position.set(index * 0.35, index * 0.14, -index * 0.2);
      this.birds.add(bird);
    }
    this.birds.position.set(-3.5, 2.8, 0.8);
    this.root.add(this.birds);
  }

  private updateVisuals(): void {
    const progress = this.progress;
    const eased = progress * progress * (3 - 2 * progress);
    this.moon.position.set(this.driftX * eased, this.riseHeight * eased, 0);
    if (this.moonMaterial !== null) this.moonMaterial.opacity = 0.58 + eased * 0.4;
    if (this.mistMaterial !== null) this.mistMaterial.opacity = 0.08 + eased * 0.04;

    const mistDrift = Math.sin(this.ambientElapsed * 0.19) * 0.55;
    this.mist.position.x = mistDrift;
    this.mist.position.z = Math.cos(this.ambientElapsed * 0.13) * 0.24;

    const birdCycle = (this.ambientElapsed * 0.22) % 1;
    this.birds.position.x = -3.5 + birdCycle * 7;
    this.birds.position.y = 2.8 + Math.sin(this.ambientElapsed * 0.9) * 0.22;
    this.birds.visible = this.currentPhase !== 'open';
  }
}
