// @vitest-environment jsdom
/// <reference types="node" />

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { GestureLock } from '@input/GestureLock';

function source(path: string): string {
  return readFileSync(`${process.cwd()}/${path}`, 'utf8');
}

describe('GestureLock', () => {
  it('bloque les gestes du canvas sans avaler le défilement d’un descendant UI', () => {
    const canvas = document.createElement('div');
    const ui = document.createElement('div');
    canvas.appendChild(ui);
    document.body.appendChild(canvas);
    const lock = new GestureLock(canvas);

    const canvasTouch = new Event('touchmove', { bubbles: true, cancelable: true });
    canvas.dispatchEvent(canvasTouch);
    expect(canvasTouch.defaultPrevented).toBe(true);

    const uiTouch = new Event('touchmove', { bubbles: true, cancelable: true });
    ui.dispatchEvent(uiTouch);
    expect(uiTouch.defaultPrevented).toBe(false);

    for (const type of ['gesturestart', 'gesturechange', 'gestureend', 'wheel', 'dblclick']) {
      const gesture = new Event(type, { bubbles: true, cancelable: true });
      canvas.dispatchEvent(gesture);
      expect(gesture.defaultPrevented, type).toBe(true);
    }

    lock.dispose();
    const afterDispose = new Event('wheel', { bubbles: true, cancelable: true });
    canvas.dispatchEvent(afterDispose);
    expect(afterDispose.defaultPrevented).toBe(false);
  });

  it('verrouille zoom et overscroll par CSS tout en autorisant les listes verticales', () => {
    const html = source('index.html');
    const css = source('src/ui/styles/main.css');

    // Phase 10 (a11y) : plus de `user-scalable=no` ni `maximum-scale` — la
    // WCAG 1.4.4 exige le zoom utilisateur, iOS l'ignore de toute façon, et
    // le zoom accidentel en jeu reste bloqué par touch-action + GestureLock.
    expect(html).not.toContain('user-scalable=no');
    expect(html).not.toContain('maximum-scale');
    expect(html).toContain('viewport-fit=cover');
    expect(html).toMatch(/html,\s*body\s*\{[^}]*overscroll-behavior: none;/s);
    expect(html).toMatch(/#game-canvas\s*\{[^}]*touch-action: none;/s);
    expect(html).toContain('-webkit-text-size-adjust: 100%');
    expect(css).toMatch(
      /\.ui-settings__scroller,[\s\S]*\.ui-chapters__scroller\s*\{[^}]*touch-action: pan-y;[^}]*overscroll-behavior: contain;/,
    );
  });
});
