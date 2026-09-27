/**
 * camerarig.test.ts — la caméra isométrique et son auto-fit.
 *
 * Ce qui est verrouillé ici : l'angle isométrique (dont dépendent toutes les
 * illusions, ADR-002) et la promesse de cadrage — « le niveau tient dans le
 * cadre, en portrait comme en paysage » (docs/ART_DIRECTION.md § 8).
 */
import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { CameraRig } from '@render/CameraRig';
import { CAMERA } from '@/config';

/** Le niveau tient-il dans le cadre ? Test par projection des 8 coins. */
function fits(rig: CameraRig, min: Vector3, max: Vector3): boolean {
  const { camera } = rig;
  const corner = new Vector3();
  for (let i = 0; i < 8; i += 1) {
    corner.set(i & 1 ? max.x : min.x, i & 2 ? max.y : min.y, i & 4 ? max.z : min.z);
    corner.project(camera);
    if (Math.abs(corner.x) > 1 || Math.abs(corner.y) > 1) return false;
  }
  return true;
}

describe('CameraRig', () => {
  it("conserve l'angle isométrique véritable", () => {
    const rig = new CameraRig(16 / 9);
    const { position } = rig.camera;
    const horizontal = Math.hypot(position.x, position.z);

    // élévation = atan(1/√2) ≈ 35,264°
    expect(Math.atan2(position.y, horizontal)).toBeCloseTo(
      (CAMERA.elevationDeg * Math.PI) / 180,
      6,
    );
    // azimut 45° : x et z égaux
    expect(position.x).toBeCloseTo(position.z, 6);
  });

  it('cadre un niveau entier en paysage 1920×1080', () => {
    const rig = new CameraRig(1920 / 1080);
    const min = new Vector3(-6, 0, -6);
    const max = new Vector3(6, 14, 6);

    rig.frameLevel(min, max, 1920 / 1080);
    rig.camera.updateMatrixWorld();
    rig.camera.updateProjectionMatrix();

    expect(fits(rig, min, max)).toBe(true);
  });

  it('cadre le même niveau en portrait 390×844', () => {
    const rig = new CameraRig(390 / 844);
    const min = new Vector3(-6, 0, -6);
    const max = new Vector3(6, 14, 6);

    rig.frameLevel(min, max, 390 / 844);
    rig.camera.updateMatrixWorld();
    rig.camera.updateProjectionMatrix();

    expect(fits(rig, min, max)).toBe(true);
  });

  it('dézoome pour un niveau plus grand, jamais l’inverse', () => {
    const rig = new CameraRig(1);
    const petit = rig.frameLevel(new Vector3(-2, 0, -2), new Vector3(2, 4, 2), 1);
    const grand = rig.frameLevel(new Vector3(-10, 0, -10), new Vector3(10, 20, 10), 1);

    expect(grand).toBeGreaterThan(petit);
  });

  it('laisse la marge demandée autour du niveau', () => {
    const rig = new CameraRig(1);
    const serre = rig.frameLevel(new Vector3(-4, 0, -4), new Vector3(4, 8, 4), 1, 0);
    const large = rig.frameLevel(new Vector3(-4, 0, -4), new Vector3(4, 8, 4), 1, 0.2);

    expect(large / serre).toBeCloseTo(1.2, 5);
  });
});
