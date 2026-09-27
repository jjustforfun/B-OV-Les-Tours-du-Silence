/**
 * Stats.ts — compteur de performance, développement uniquement.
 *
 * Volontairement maison plutôt que stats.js : une seule ligne de texte, mise
 * à jour deux fois par seconde (mesurer ne doit pas coûter), et lisible sur
 * un téléphone tenu à bout de bras pendant un test terrain.
 *
 * Affiche : images par seconde, temps par image, appels de dessin, triangles.
 */
import type { WebGLRenderer } from 'three';
import { PERF } from '@/config';

export class Stats {
  private readonly element: HTMLDivElement;
  private accumulator = 0;

  constructor(
    private readonly renderer: WebGLRenderer,
    parent: HTMLElement = document.body,
  ) {
    this.element = document.createElement('div');
    this.element.className = 'debug-stats';
    this.element.style.cssText = [
      'position:fixed',
      'top:calc(env(safe-area-inset-top, 0px) + 8px)',
      'left:calc(env(safe-area-inset-left, 0px) + 8px)',
      'z-index:90',
      'padding:4px 8px',
      'border-radius:2px',
      'background:rgba(16,22,31,.72)',
      'color:#e8e0d2',
      'font:600 11px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace',
      'letter-spacing:.06em',
      'pointer-events:none',
      'white-space:pre',
    ].join(';');
    parent.appendChild(this.element);
  }

  update(fps: number, deltaSeconds: number): void {
    this.accumulator += deltaSeconds;
    if (this.accumulator < 0.5) return;
    this.accumulator = 0;

    const { render } = this.renderer.info;
    const frameMs = fps > 0 ? 1000 / fps : 0;
    const healthy = fps >= PERF.downgradeFps;

    this.element.style.color = healthy ? '#e8e0d2' : '#f0a05a';
    this.element.textContent = `${fps.toFixed(0)} fps  ${frameMs.toFixed(1)} ms  ${String(render.calls)} calls  ${formatTriangles(render.triangles)} tris`;
  }

  dispose(): void {
    this.element.remove();
  }
}

function formatTriangles(count: number): string {
  return count >= 1000 ? `${(count / 1000).toFixed(1)}k` : String(count);
}
