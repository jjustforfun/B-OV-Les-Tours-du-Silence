/**
 * Libère récursivement les ressources GPU attachées à un Object3D.
 * À appeler lors d'un changement de niveau — une géométrie oubliée ici
 * reste en VRAM jusqu'à la fermeture de l'onglet.
 *
 * Les ressources partagées dans un même sous-arbre ne sont libérées qu'une
 * fois. Les rampes toon sont un cache global et restent la responsabilité de
 * `disposeToonGradients()` lors de l'arrêt du moteur.
 */
import type { BufferGeometry, Material, Object3D, ShaderMaterial, Texture } from 'three';
import { isSharedToonTexture } from '@render/materials/ToonStoneMaterial';

interface UniformValue {
  readonly value?: unknown;
}

export function disposeObject(root: Object3D): void {
  const geometries = new Set<BufferGeometry>();
  const materials = new Set<Material>();
  const textures = new Set<Texture>();

  root.traverse((object) => {
    const renderable = object as Object3D & {
      readonly geometry?: unknown;
      readonly material?: unknown;
    };
    if (isBufferGeometry(renderable.geometry)) geometries.add(renderable.geometry);

    const objectMaterials: readonly unknown[] = Array.isArray(renderable.material)
      ? renderable.material
      : [renderable.material];
    for (const material of objectMaterials) {
      if (isMaterial(material)) collectMaterial(material, materials, textures);
    }
  });

  for (const geometry of geometries) geometry.dispose();
  for (const texture of textures) {
    if (!isSharedToonTexture(texture)) texture.dispose();
  }
  for (const material of materials) material.dispose();

  root.removeFromParent();
  root.clear();
}

function collectMaterial(
  material: Material,
  materials: Set<Material>,
  textures: Set<Texture>,
): void {
  if (materials.has(material)) return;
  materials.add(material);

  for (const value of Object.values(material as unknown as Record<string, unknown>)) {
    collectTextures(value, textures);
  }

  const uniforms = (material as ShaderMaterial).uniforms;
  if (uniforms === undefined) return;
  for (const uniform of Object.values(uniforms) as UniformValue[]) {
    collectTextures(uniform.value, textures);
  }
}

function collectTextures(value: unknown, textures: Set<Texture>): void {
  if (isTexture(value)) {
    textures.add(value);
    return;
  }
  if (!Array.isArray(value)) return;
  for (const entry of value as unknown[]) {
    if (isTexture(entry)) textures.add(entry);
  }
}

function isBufferGeometry(value: unknown): value is BufferGeometry {
  return hasThreeFlag(value, 'isBufferGeometry');
}

function isMaterial(value: unknown): value is Material {
  return hasThreeFlag(value, 'isMaterial');
}

function isTexture(value: unknown): value is Texture {
  return hasThreeFlag(value, 'isTexture');
}

function hasThreeFlag(value: unknown, flag: string): boolean {
  return (
    value !== null && typeof value === 'object' && (value as Record<string, unknown>)[flag] === true
  );
}
