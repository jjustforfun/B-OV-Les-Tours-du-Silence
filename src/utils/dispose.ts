/**
 * dispose.ts — hygiène mémoire three.js.
 *
 * three ne libère rien tout seul : géométries, matériaux et textures restent
 * sur le GPU jusqu'à un dispose() explicite. Sur un jeu à chapitres, un seul
 * oubli suffit à faire ramer un téléphone au bout de vingt minutes.
 * Toute suppression d'objet passe par ici.
 */
import type { Material, Object3D, Texture } from 'three';

function isDisposableMaterial(value: unknown): value is Material {
  return typeof value === 'object' && value !== null && 'dispose' in value;
}

/** Libère les textures référencées par un matériau. */
export function disposeMaterial(material: Material): void {
  const record = material as unknown as Record<string, unknown>;
  for (const value of Object.values(record)) {
    if (value && typeof value === 'object' && 'isTexture' in value) {
      (value as Texture).dispose();
    }
  }
  material.dispose();
}

/** Libère récursivement un objet et tout son sous-arbre, puis le détache. */
export function disposeObject(root: Object3D): void {
  root.traverse((child) => {
    const mesh = child as Object3D & {
      geometry?: { dispose: () => void };
      material?: Material | Material[];
    };
    mesh.geometry?.dispose();
    const material = mesh.material;
    if (Array.isArray(material)) {
      for (const entry of material) disposeMaterial(entry);
    } else if (isDisposableMaterial(material)) {
      disposeMaterial(material);
    }
  });
  root.removeFromParent();
  root.clear();
}
