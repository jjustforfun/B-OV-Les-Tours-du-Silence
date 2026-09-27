/**
 * ChapterLut.ts — LUTs de couleur des chapitres.
 *
 * Les huit LUTs 16×16×16 sont générées paresseusement depuis les palettes de
 * chapitre : aucun asset binaire à charger, donc 0 ko livré par chapitre. Le
 * rendu obtient tout de même une vraie `Data3DTexture` compatible avec
 * pmndrs/postprocessing, et la teinte reste synchronisée avec l'art direction.
 */
import {
  ClampToEdgeWrapping,
  Data3DTexture,
  LinearFilter,
  RGBAFormat,
  SRGBColorSpace,
  UnsignedByteType,
} from 'three';
import { RENDER } from '@/config';
import { CHAPTER_PALETTES, type ChapterPaletteName } from '@render/Palettes';

const lutCache = new Map<ChapterPaletteName, Data3DTexture>();

export function getChapterLut(name: ChapterPaletteName): Data3DTexture {
  const cached = lutCache.get(name);
  if (cached) return cached;

  const palette = CHAPTER_PALETTES[name];
  const size = RENDER.postFx.lutSize;
  const data = new Uint8Array(size * size * size * 4);
  const cool = hexToLinearRgb(palette.skyTop);
  const warm = hexToLinearRgb(palette.skyBottom);
  const stone = hexToLinearRgb(palette.stoneLight);
  let offset = 0;

  for (let b = 0; b < size; b += 1) {
    for (let g = 0; g < size; g += 1) {
      for (let r = 0; r < size; r += 1) {
        const red = r / (size - 1);
        const green = g / (size - 1);
        const blue = b / (size - 1);
        const luma = red * 0.2126 + green * 0.7152 + blue * 0.0722;
        const shadows = 1 - smoothstep(0.18, 0.62, luma);
        const highlights = smoothstep(0.48, 1, luma);
        const mids = 1 - Math.abs(luma - 0.5) * 2;

        let outR = applyContrast(red, 1.035);
        let outG = applyContrast(green, 1.035);
        let outB = applyContrast(blue, 1.035);

        outR = mix(outR, cool[0], shadows * 0.12);
        outG = mix(outG, cool[1], shadows * 0.12);
        outB = mix(outB, cool[2], shadows * 0.12);

        outR = mix(outR, warm[0], highlights * 0.08);
        outG = mix(outG, warm[1], highlights * 0.08);
        outB = mix(outB, warm[2], highlights * 0.08);

        outR = mix(outR, stone[0], mids * 0.025);
        outG = mix(outG, stone[1], mids * 0.025);
        outB = mix(outB, stone[2], mids * 0.025);

        data[offset] = toByte(outR);
        data[offset + 1] = toByte(outG);
        data[offset + 2] = toByte(outB);
        data[offset + 3] = 255;
        offset += 4;
      }
    }
  }

  const texture = new Data3DTexture(data, size, size, size);
  texture.name = `ChapterLut:${name}`;
  texture.format = RGBAFormat;
  texture.type = UnsignedByteType;
  texture.minFilter = LinearFilter;
  texture.magFilter = LinearFilter;
  texture.wrapS = ClampToEdgeWrapping;
  texture.wrapT = ClampToEdgeWrapping;
  texture.wrapR = ClampToEdgeWrapping;
  texture.unpackAlignment = 1;
  texture.colorSpace = SRGBColorSpace;
  texture.needsUpdate = true;
  lutCache.set(name, texture);
  return texture;
}

export function disposeChapterLuts(): void {
  for (const texture of lutCache.values()) texture.dispose();
  lutCache.clear();
}

function hexToLinearRgb(hex: number): readonly [number, number, number] {
  const r = ((hex >> 16) & 255) / 255;
  const g = ((hex >> 8) & 255) / 255;
  const b = (hex & 255) / 255;
  return [r, g, b];
}

function applyContrast(value: number, contrast: number): number {
  return clamp((value - 0.5) * contrast + 0.5, 0, 1);
}

function mix(a: number, b: number, t: number): number {
  return a + (b - a) * clamp(t, 0, 1);
}

function smoothstep(edge0: number, edge1: number, value: number): number {
  const t = clamp((value - edge0) / Math.max(edge1 - edge0, 0.0001), 0, 1);
  return t * t * (3 - 2 * t);
}

function toByte(value: number): number {
  return Math.round(clamp(value, 0, 1) * 255);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
