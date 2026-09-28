/// <reference types="node" />
/**
 * color-cues.test.ts — la couleur braise n'est jamais le seul canal d'une
 * information utile (docs/ART_DIRECTION.md § 3).
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { DestinationMarker } from '@entities/player/DestinationMarker';
import { Rotator } from '@world/mechanisms/Rotator';

const REPOSITORY_ROOT = fileURLToPath(new URL('../../', import.meta.url));

function source(path: string): string {
  return readFileSync(`${REPOSITORY_ROOT}${path}`, 'utf8');
}

describe('indices indépendants de la perception des couleurs', () => {
  it('double les indices 3D actionnables par un contour neutre permanent', () => {
    const marker = new DestinationMarker();
    const rotator = new Rotator('color-cue');

    expect(marker.root.getObjectByName('DestinationMarkerRing')).toBeDefined();
    expect(marker.root.getObjectByName('DestinationMarkerOutline')).toBeDefined();
    expect(rotator.root.getObjectByName('MechanismHandle:color-cue')).toBeDefined();
    expect(rotator.root.getObjectByName('MechanismAffordanceOutline:color-cue')).toBeDefined();

    marker.dispose();
    rotator.dispose();
  });

  it('conserve bordures, symboles et texte pour tous les états UI en braise', () => {
    const css = source('src/ui/styles/main.css');
    const chapterSelector = source('src/ui/ChapterSelector.ts');

    expect(css).toMatch(/\.ui-settings__conflict\s*\{[^}]*border-left:/s);
    expect(css).toMatch(
      /\.ui-chapters__entry\.is-current \.ui-chapters__choice\s*\{[^}]*border-left-color:/s,
    );
    expect(css).toMatch(/\.ui-focus-ring\s*\{[^}]*border: 2px solid var\(--color-ember\)/s);
    expect(chapterSelector).toContain("'ui-chapters__status-marker'");
    expect(chapterSelector).toContain("entry.status === 'current' ? '◆' : '✓'");
    expect(chapterSelector).toContain('i18n.t(STATUS_KEY[entry.status])');
  });
});
