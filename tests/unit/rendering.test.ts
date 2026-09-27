/**
 * rendering.test.ts — verrous de rendu phase 1.
 *
 * Ces tests ne lancent pas WebGL : ils verrouillent les données CPU qui
 * alimentent le rendu stylisé (rampe toon, AO de sommets, LUT et ombres blob).
 */
import { BoxGeometry, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { RENDER } from '@/config';
import { BlobShadows } from '@render/BlobShadows';
import { getChapterLut } from '@render/ChapterLut';
import { bakeToonStoneGeometry, getToonGradient } from '@render/materials/ToonStoneMaterial';

describe('ToonStoneMaterial', () => {
  it('partage une rampe toon trois bandes avec un plancher à 0,32', () => {
    const ramp = getToonGradient(3);
    const sameRamp = getToonGradient(3);
    const data = ramp.image.data;

    expect(sameRamp).toBe(ramp);
    expect(data).toBeInstanceOf(Uint8Array);
    if (data instanceof Uint8Array) {
      expect(Array.from(data)).toEqual([
        Math.round(RENDER.toon.rampShadow * 255),
        Math.round(RENDER.toon.rampMid * 255),
        255,
      ]);
    }
  });

  it("cuit les couleurs et l'AO dans les attributs de sommets", () => {
    const geometry = bakeToonStoneGeometry(new BoxGeometry(1, 1, 1), { color: 0x808896 });
    const position = geometry.getAttribute('position');
    const color = geometry.getAttribute('color');
    const ao = geometry.getAttribute('aAo');

    expect(color.count).toBe(position.count);
    expect(ao.count).toBe(position.count);

    let minAo = 1;
    let maxAo = 0;
    for (let i = 0; i < ao.count; i += 1) {
      minAo = Math.min(minAo, ao.getX(i));
      maxAo = Math.max(maxAo, ao.getX(i));
    }

    expect(minAo).toBeGreaterThanOrEqual(RENDER.toon.vertexAoFloor - 0.000001);
    expect(maxAo).toBeLessThanOrEqual(1);
    expect(minAo).toBeLessThan(maxAo);
  });
});

describe('ChapterLut', () => {
  it('génère paresseusement une LUT 16×16×16 par chapitre', () => {
    const lut = getChapterLut('prologue');
    const sameLut = getChapterLut('prologue');

    expect(sameLut).toBe(lut);
    expect(lut.image.width).toBe(RENDER.postFx.lutSize);
    expect(lut.image.height).toBe(RENDER.postFx.lutSize);
    expect(lut.image.depth).toBe(RENDER.postFx.lutSize);
  });
});

describe('BlobShadows', () => {
  it('oriente les ombres selon le up du nœud en une seule instance mesh', () => {
    const shadows = new BlobShadows(2);
    shadows.set(0, new Vector3(1, 2, 3), new Vector3(0, 1, 0), 0.4);

    expect(shadows.visibleCount).toBe(1);
    expect(shadows.mesh.count).toBe(1);

    shadows.clear();
    expect(shadows.visibleCount).toBe(0);
    expect(shadows.mesh.count).toBe(0);
    shadows.dispose();
  });
});
