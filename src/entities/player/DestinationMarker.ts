/**
 * DestinationMarker.ts — anneau discret de destination de Turpal.
 *
 * Le marqueur est volontairement silencieux : il apparaît uniquement quand un
 * chemin existe, puis se dissout en 420 ms. Si la destination est
 * inatteignable, rien n'est affiché — pas de message d'erreur, pas de punition.
 */
import {
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  RingGeometry,
  Vector3,
  type ColorRepresentation,
} from 'three';
import { TURPAL } from '@/config';
import { EMBER } from '@render/Palettes';

const UP = new Vector3(0, 1, 0);
const RING_NORMAL = new Vector3(0, 0, 1);

export class DestinationMarker {
  readonly root = new Group();

  private readonly geometry = new RingGeometry(
    TURPAL.destinationMarkerRadius * 0.72,
    TURPAL.destinationMarkerRadius,
    32,
    1,
  );
  private readonly outlineGeometry = new RingGeometry(
    TURPAL.destinationMarkerRadius * 0.62,
    TURPAL.destinationMarkerRadius * 1.1,
    32,
    1,
  );
  private readonly material = new MeshBasicMaterial({
    color: EMBER as ColorRepresentation,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    side: DoubleSide,
  });
  private readonly outlineMaterial = new MeshBasicMaterial({
    color: 0x10161f,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    side: DoubleSide,
  });
  private readonly mesh = new Mesh(this.geometry, this.material);
  private readonly outline = new Mesh(this.outlineGeometry, this.outlineMaterial);
  private readonly normalizedUp = new Vector3(0, 1, 0);
  private elapsed = 0;
  private visible = false;

  constructor() {
    this.root.name = 'DestinationMarker';
    this.root.visible = false;
    this.outline.name = 'DestinationMarkerOutline';
    this.mesh.name = 'DestinationMarkerRing';
    // Le contour neutre reste lisible quand la teinte braise est indiscernable.
    this.root.add(this.outline, this.mesh);
  }

  get isVisible(): boolean {
    return this.visible;
  }

  show(position: Vector3, up: Vector3 = UP): void {
    this.root.position.copy(position).addScaledVector(up, 0.018);
    this.normalizedUp.copy(up).normalize();
    this.root.quaternion.setFromUnitVectors(RING_NORMAL, this.normalizedUp);
    this.root.scale.setScalar(0.2);
    this.material.opacity = 0.82;
    this.outlineMaterial.opacity = 0.68;
    this.elapsed = 0;
    this.visible = true;
    this.root.visible = true;
  }

  hide(): void {
    this.visible = false;
    this.root.visible = false;
    this.material.opacity = 0;
    this.outlineMaterial.opacity = 0;
  }

  update(delta: number): void {
    if (!this.visible) return;
    this.elapsed += delta;
    const duration = TURPAL.destinationMarkerMs / 1000;
    const t = Math.min(1, this.elapsed / duration);
    const eased = 1 - Math.pow(1 - t, 3);
    this.root.scale.setScalar(0.2 + eased * 0.8);
    this.material.opacity = (1 - t) * 0.82;
    this.outlineMaterial.opacity = (1 - t) * 0.68;
    if (t >= 1) this.hide();
  }

  dispose(): void {
    this.geometry.dispose();
    this.outlineGeometry.dispose();
    this.material.dispose();
    this.outlineMaterial.dispose();
    this.root.removeFromParent();
    this.root.clear();
  }
}
