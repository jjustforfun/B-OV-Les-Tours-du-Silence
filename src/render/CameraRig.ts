/**
 * CameraRig.ts — caméra orthographique isométrique.
 *
 * L'isométrie n'est pas un style, c'est la mécanique : en projection
 * orthographique à 45°/35,264°, deux points éloignés dans l'espace peuvent
 * coïncider à l'écran. C'est exactement ce que Monument Valley exploite, et
 * ce dont dépendent nos géométries impossibles (voir world/Illusion.ts).
 *
 * Le rig est un pivot : on fait tourner le pivot, jamais la caméra directement.
 */
import { MathUtils, Object3D, OrthographicCamera, Vector3 } from 'three';
import { CAMERA } from '@/config';

export class CameraRig {
  readonly camera: OrthographicCamera;
  /** Pivot autour du point regardé : ce qu'on anime lors des rotations de monde. */
  readonly pivot = new Object3D();

  private viewSize: number = CAMERA.viewSize;
  private readonly target = new Vector3(0, 0, 0);
  private readonly frameCenter = new Vector3();
  private readonly frameCorner = new Vector3();

  constructor(aspect = 1) {
    this.camera = new OrthographicCamera(-1, 1, 1, -1, CAMERA.near, CAMERA.far);
    this.pivot.add(this.camera);
    this.setAngles(CAMERA.azimuthDeg, CAMERA.elevationDeg);
    this.setAspect(aspect);
  }

  /** Place la caméra sur la sphère isométrique autour de la cible. */
  setAngles(azimuthDeg: number, elevationDeg: number): void {
    const azimuth = MathUtils.degToRad(azimuthDeg);
    const elevation = MathUtils.degToRad(elevationDeg);
    const horizontal = Math.cos(elevation) * CAMERA.distance;

    this.camera.position.set(
      Math.sin(azimuth) * horizontal,
      Math.sin(elevation) * CAMERA.distance,
      Math.cos(azimuth) * horizontal,
    );
    this.camera.lookAt(this.target);
    this.camera.updateMatrixWorld();
  }

  /**
   * Recalcule le frustum. En portrait on élargit le champ vertical pour que
   * les tours restent entières à l'écran : c'est la seule différence de
   * cadrage entre portrait et paysage.
   */
  setAspect(aspect: number): void {
    const safeAspect = Math.max(aspect, 0.0001);
    const portrait = safeAspect < 1;
    const size = portrait ? this.viewSize / Math.max(safeAspect, 0.4) : this.viewSize;

    this.camera.left = -size * safeAspect;
    this.camera.right = size * safeAspect;
    this.camera.top = size;
    this.camera.bottom = -size;
    this.camera.updateProjectionMatrix();
  }

  /** Zoom contemplatif (dézoom sur les grandes tours, zoom sur les détails). */
  setViewSize(viewSize: number, aspect: number): void {
    this.viewSize = viewSize;
    this.setAspect(aspect);
  }

  /**
   * Auto-fit : calcule le `viewSize` pour que la boîte englobante du niveau
   * tienne dans le cadre avec une marge (docs/ART_DIRECTION.md § 8).
   *
   * On projette les 8 coins de la boîte dans le repère de la caméra plutôt
   * que d'approximer par un rayon : en isométrie, l'encombrement écran d'un
   * volume dépend de son orientation, et une sphère englobante gaspillerait
   * facilement 30 % du cadre.
   */
  frameLevel(min: Vector3, max: Vector3, aspect: number, margin = 0.08): number {
    this.frameCenter.addVectors(min, max).multiplyScalar(0.5);
    this.lookAtPoint(this.frameCenter);
    this.camera.updateMatrixWorld(true);
    this.camera.matrixWorldInverse.copy(this.camera.matrixWorld).invert();

    let halfWidth = 0;
    let halfHeight = 0;

    for (let i = 0; i < 8; i += 1) {
      this.frameCorner.set(i & 1 ? max.x : min.x, i & 2 ? max.y : min.y, i & 4 ? max.z : min.z);
      this.frameCorner.applyMatrix4(this.camera.matrixWorldInverse);
      halfWidth = Math.max(halfWidth, Math.abs(this.frameCorner.x));
      halfHeight = Math.max(halfHeight, Math.abs(this.frameCorner.y));
    }

    const safeAspect = Math.max(aspect, 0.0001);
    const scale = 1 + margin;
    const portrait = safeAspect < 1;
    const needed = portrait
      ? Math.max(halfWidth, halfHeight * Math.max(safeAspect, 0.4))
      : Math.max(halfHeight, halfWidth / safeAspect);

    this.setViewSize(needed * scale, safeAspect);
    return this.viewSize;
  }

  get currentViewSize(): number {
    return this.viewSize;
  }

  lookAtPoint(point: Vector3): void {
    this.target.copy(point);
    this.camera.lookAt(this.target);
    this.camera.updateMatrixWorld();
  }
}
