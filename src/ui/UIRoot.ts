/**
 * UIRoot.ts — racine de l'interface, en DOM plutôt qu'en 3D.
 *
 * Choix assumé (ADR-012) : l'UI est du HTML/CSS au-dessus du canvas. C'est
 * plus net sur tous les écrans, gratuit en draw calls, accessible au lecteur
 * d'écran et au clavier, et trivial à adapter aux safe-areas d'un téléphone.
 *
 * L'UI de ce jeu doit se faire oublier : pas de HUD permanent, pas de
 * compteur, pas de bouton visible pendant la contemplation.
 */
import './styles/main.css';

export interface UIPanel {
  readonly element: HTMLElement;
  show(): void;
  hide(): void;
  dispose(): void;
}

export class UIRoot {
  readonly element: HTMLDivElement;

  private readonly panels = new Set<UIPanel>();

  constructor(parent: HTMLElement = document.body) {
    this.element = document.createElement('div');
    this.element.id = 'ui-root';
    this.element.className = 'ui-root';
    parent.appendChild(this.element);
  }

  add<T extends UIPanel>(panel: T): T {
    this.panels.add(panel);
    this.element.appendChild(panel.element);
    return panel;
  }

  remove(panel: UIPanel): void {
    this.panels.delete(panel);
    panel.dispose();
  }

  /** Masque toute l'interface (moments purement contemplatifs). */
  setVisible(visible: boolean): void {
    this.element.classList.toggle('ui-root--hidden', !visible);
  }

  dispose(): void {
    for (const panel of this.panels) panel.dispose();
    this.panels.clear();
    this.element.remove();
  }
}

/** Petit utilitaire de création d'éléments, pour éviter innerHTML partout. */
export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className !== undefined) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
