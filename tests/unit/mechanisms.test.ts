/**
 * mechanisms.test.ts — cycle de vie commun des mécanismes de phase 4.
 */
import { Group } from 'three';
import { afterEach, describe, expect, it } from 'vitest';
import { bus } from '@core/EventBus';
import { Level, type LevelDefinition } from '@world/Level';
import { NavGraph } from '@world/NavGraph';
import { GravityPath } from '@world/mechanisms/GravityPath';
import { PressurePlate } from '@world/mechanisms/PressurePlate';
import { Rotator } from '@world/mechanisms/Rotator';
import { Slider } from '@world/mechanisms/Slider';
import { TowerRotation } from '@world/mechanisms/TowerRotation';

const context = (graph: NavGraph) => ({ graph, elapsed: 0 });

function finishRotator(rotator: Rotator, graph: NavGraph): void {
  rotator.update(context(graph), 0.45);
  rotator.update(context(graph), 0.45);
}

afterEach(() => bus.clear());

describe('Rotator', () => {
  it("suit l'angle du pointeur, snappe au cran et recâble le graphe", () => {
    const graph = new NavGraph();
    graph.addNode('a', { x: 0, y: 0, z: 0 });
    graph.addNode('b', { x: 1, y: 0, z: 0 });
    graph.connect('a', 'b', { condition: { mechanism: 'R', equals: 90 } });
    const rotator = new Rotator('R');
    const snaps: number[] = [];
    bus.on('mechanism:snap', (event) => snaps.push(Number(event.value)));

    rotator.beginDrag({ centerX: 0, centerY: 0, pointerX: 1, pointerY: 0 });
    rotator.drag({ centerX: 0, centerY: 0, pointerX: 0, pointerY: 1 });
    rotator.endDrag();

    expect(rotator.isAnimating).toBe(true);
    expect(graph.areConnected('a', 'b')).toBe(false);
    finishRotator(rotator, graph);

    expect(rotator.currentStep).toBe(1);
    expect(graph.areConnected('a', 'b')).toBe(true);
    expect(snaps).toEqual([90]);
    rotator.dispose();
  });
});

describe('Slider', () => {
  it('borne la course, snappe à un stop et transporte un passager parenté', () => {
    const graph = new NavGraph();
    const slider = new Slider('S', { stops: 3, travel: 2 });
    const world = new Group();
    const passenger = new Group();
    world.add(slider.root, passenger);

    slider.attachPassenger(passenger);
    expect(passenger.parent).toBe(slider.geometryRoot);

    slider.beginDrag({ centerX: 0, centerY: 0, pointerX: 1, pointerY: 0 });
    slider.drag({ centerX: 0, centerY: 0, pointerX: -1, pointerY: 0 });
    slider.endDrag();
    slider.update(context(graph), 0.9);

    expect(slider.currentStop).toBe(1);
    expect(graph.getMechanismState('S')).toBe(1);

    slider.detachPassenger(world);
    expect(passenger.parent).toBe(world);
    slider.dispose();
  });

  it('garde son ancre monde et transfère trois volumes un par un', () => {
    const graph = new NavGraph();
    const slider = new Slider('promise', { stops: 4, travel: 3, snapSeconds: 0.9 });
    slider.root.position.set(7, 2, -4);
    const stones = [new Group(), new Group(), new Group()];
    stones.forEach((stone, index) => {
      stone.position.set(index * 2, 0, 3);
      slider.root.add(stone);
      slider.bindStagedObject(stone, [index * 2, 0, 0], index + 1);
    });

    for (let stop = 1; stop <= 3; stop += 1) {
      slider.actuate();
      slider.update(context(graph), 0.9);
      expect(slider.root.position.toArray()).toEqual([7, 2, -4]);
      expect(graph.getMechanismState('promise')).toBe(stop);
      stones.forEach((stone, index) => {
        expect(stone.position.z).toBeCloseTo(index < stop ? 0 : 3, 5);
      });
    }

    slider.dispose();
  });
});

describe('PressurePlate', () => {
  it("s'enfonce en 180 ms, émet un cran et ouvre une arête conditionnelle", () => {
    const graph = new NavGraph();
    graph.addNode('a', { x: 0, y: 0, z: 0 });
    graph.addNode('b', { x: 1, y: 0, z: 0 });
    graph.connect('a', 'b', { condition: { mechanism: 'P', equals: true } });
    const plate = new PressurePlate('P', { triggerNode: 'a', linkTo: [1, 0, 0] });
    let sound = '';
    bus.on('mechanism:snap', (event) => {
      sound = event.sound;
    });

    plate.setOccupied(true);
    plate.update(context(graph), 0.18);

    expect(plate.isPressed).toBe(true);
    expect(plate.root.position.y).toBe(0);
    expect(plate.geometryRoot.position.y).toBeCloseTo(-0.08, 3);
    expect(graph.areConnected('a', 'b')).toBe(true);
    expect(sound).toBe('stone-plate');
    expect(plate.root.children.some((child) => child.name.startsWith('PressurePlateLink'))).toBe(
      true,
    );
    plate.dispose();
  });
});

describe('TowerRotation', () => {
  it('tourne un sous-arbre, soulève la tour et transforme les nœuds mobiles', () => {
    const graph = new NavGraph();
    graph.addNode('mobile', { x: 1, y: 0, z: 0 });
    const tower = new TowerRotation('T', {
      faces: 4,
      affectedNodes: ['mobile'],
      center: [0, 0, 0],
    });

    tower.actuate();
    tower.update(context(graph), 0.6);
    expect(tower.root.position.y).toBeGreaterThan(0);
    tower.update(context(graph), 0.6);

    expect(tower.currentFace).toBe(1);
    expect(graph.getNode('mobile')?.position.x).toBeCloseTo(0, 5);
    expect(graph.getNode('mobile')?.position.z).toBeCloseTo(1, 5);
    expect(tower.isInSilence).toBe(true);

    // Le retour antihoraire doit faire −90°, jamais une rotation visuelle de +270°.
    tower.actuate(-1);
    tower.update(context(graph), 1.2);
    expect(tower.currentFace).toBe(0);
    expect(tower.root.rotation.y).toBeCloseTo(0, 5);
    expect(graph.getNode('mobile')?.position.x).toBeCloseTo(1, 5);
    expect(graph.getNode('mobile')?.position.z).toBeCloseTo(0, 5);
    tower.dispose();
  });
});

describe('GravityPath', () => {
  it('bascule le up des nœuds pivots sans faire tourner le monde entier', () => {
    const graph = new NavGraph();
    graph.addNode('wall', { x: 0, y: 0, z: 0 });
    const gravity = new GravityPath('G', { from: 'down', to: 'north', pivotNodes: ['wall'] });

    gravity.actuate();
    gravity.update(context(graph), 0.45);

    expect(gravity.currentDirection).toBe('north');
    expect(graph.getNode('wall')?.up).toEqual({ x: 0, y: 0, z: 1 });
    expect(graph.getMechanismState('G')).toBe('north');
    gravity.dispose();
  });
});

describe('Level mechanisms', () => {
  it('instancie les mécanismes déclaratifs et applique leur état initial au graphe', () => {
    const definition: LevelDefinition = {
      id: 'mechanism-level',
      chapter: 0,
      virtue: 'prologue',
      titleKey: 'test.title',
      proverbKey: 'test.proverb',
      sky: 'dawn',
      spawn: 'a',
      goal: 'b',
      nodes: [
        { id: 'a', at: [0, 0, 0] },
        { id: 'b', at: [1, 0, 0] },
      ],
      edges: [],
      mechanisms: [
        {
          id: 'R',
          kind: 'rotator',
          at: [0, 0, 0],
          params: { initial: 1, stepDeg: 90 },
          affects: [{ from: 'a', to: 'b', condition: { mechanism: 'R', equals: 90 } }],
        },
      ],
    };

    const level = new Level(definition);
    expect(level.mechanisms.has('R')).toBe(true);
    expect(level.graph.areConnected('a', 'b')).toBe(true);
    level.dispose();
  });
});
