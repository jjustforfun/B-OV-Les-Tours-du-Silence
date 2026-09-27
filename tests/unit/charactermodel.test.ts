/**
 * charactermodel.test.ts — le modèle procédural de Turpal (ADR-006).
 *
 * On vérifie ce qui engage la suite : l'échelle (tout le level design en
 * dépend), le budget de triangles, la présence effective des gazyri — le
 * détail de silhouette exigé par le brief — les clips procéduraux et la
 * libération mémoire.
 */
import { describe, expect, it } from 'vitest';
import { Mesh, type Object3D } from 'three';
import { TURPAL } from '@/config';
import { TurpalModel } from '@entities/player/TurpalModel';
import type { CharacterClip, ICharacterModel } from '@entities/ICharacterModel';

function countMeshes(model: ICharacterModel): number {
  let count = 0;
  model.root.traverse((child) => {
    if (child instanceof Mesh) count += 1;
  });
  return count;
}

function countNamed(root: Object3D, name: string): number {
  let count = 0;
  root.traverse((child) => {
    if (child.name === name) count += 1;
  });
  return count;
}

function findNamed(root: Object3D, name: string): Object3D | null {
  let found: Object3D | null = null;
  root.traverse((child) => {
    if (!found && child.name === name) found = child;
  });
  return found;
}

describe('TurpalModel', () => {
  it('respecte l’échelle du monde (0,85 unité de grille)', () => {
    const model = new TurpalModel();
    expect(model.height).toBeCloseTo(TURPAL.height, 3);
    model.dispose();
  });

  it('vise environ 3 000 triangles tout en restant sous le budget de 6 000', () => {
    const model = new TurpalModel();
    expect(model.triangleCount).toBeGreaterThan(
      TURPAL.targetTriangles - TURPAL.modelTriangleTolerance,
    );
    expect(model.triangleCount).toBeLessThan(
      TURPAL.targetTriangles + TURPAL.modelTriangleTolerance,
    );
    expect(model.triangleCount).toBeLessThan(6000);
    model.dispose();
  });

  it('porte bien deux rangées de six gazyri', () => {
    const model = new TurpalModel();
    expect(countNamed(model.root, 'Gazyr')).toBe(12);
    expect(countMeshes(model)).toBeGreaterThan(30);
    model.dispose();
  });

  it('expose un squelette simple et remplaçable par un GLB', () => {
    const model: ICharacterModel = new TurpalModel();
    expect(model.kind).toBe('procedural');
    expect(findNamed(model.root, 'TurpalSkeleton:Hips')).not.toBeNull();
    expect(findNamed(model.root, 'TurpalSkeleton:LeftArm')).not.toBeNull();
    expect(findNamed(model.root, 'TurpalSkeleton:RightLeg')).not.toBeNull();
    expect(findNamed(model.root, 'TurpalSkeleton:Head')).not.toBeNull();
    model.dispose();
  });

  it('joue tous les clips procéduraux sans diverger', () => {
    const model = new TurpalModel();
    const clips: CharacterClip[] = [
      'idle',
      'idleLong',
      'walk',
      'stepUp',
      'stepDown',
      'salute',
      'lookSky',
      'contemplate',
      'arrive',
    ];

    for (const clip of clips) {
      model.play(clip, 0.18);
      for (let i = 0; i < 30; i += 1) model.update(1 / 60);
      expect(Number.isFinite(model.root.position.y)).toBe(true);
      expect(model.clip).toBe(clip);
    }
    model.dispose();
  });

  it('adoucit la transition marche → idle', () => {
    const model = new TurpalModel();
    const spine = findNamed(model.root, 'TurpalSkeleton:Spine');
    expect(spine).not.toBeNull();
    model.play('walk', 0.001);
    model.update(1 / 60);
    const before = spine?.rotation.z ?? 0;
    model.play('idle', 0.18);
    model.update(1 / 60);
    const after = spine?.rotation.z ?? 0;

    expect(Math.abs(after - before)).toBeLessThan(0.08);
    model.dispose();
  });

  it('se libère entièrement', () => {
    const model = new TurpalModel();
    model.dispose();
    expect(countMeshes(model)).toBe(0);
    expect(model.triangleCount).toBe(0);
  });
});
