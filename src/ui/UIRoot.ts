/**
 * UIRoot.ts — racine de l'interface, en DOM plutôt qu'en 3D.
 *
 * Choix assumé (ADR-012) : l'UI est du HTML/CSS au-dessus du canvas. C'est
 * plus net sur tous les écrans, gratuit en draw calls, accessible au lecteur
 * d'écran et au clavier, et trivial à adapter aux safe-areas d'un téléphone.
 *
 * Phase 8 : la racine devient une **pile d'écrans** (ADR-027). Un panneau de
 * base optionnel (l'écran titre) + une pile de panneaux modaux (carton de
 * chapitre, pause, réglages, carnet…). Un seul panneau actif à la fois :
 * `Échap` remonte d'un cran, le focus clavier reste piégé dans le panneau
 * ouvert, et les intentions de jeu sont suspendues tant que l'interface
 * parle (le callback `onSuspendChange` prévient la composition).
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
  /**
   * Touche pressée pendant que ce panneau est au sommet de la pile.
   * Le panneau peut consommer l'événement (`preventDefault`) : `Échap`
   * ne referme alors pas l'écran (capture de touche des réglages).
   */
  onKeydown?(event: KeyboardEvent): void;
}

export interface UIRootOptions {
  /** `Échap` alors qu'un panneau modal est ouvert (la composition décide). */
  readonly onEscape?: () => void;
  /** L'interface parle : suspendre les intentions de jeu (ADR-027). */
  readonly onSuspendChange?: (suspended: boolean) => void;
}

/** Un panneau est-il focusable au clavier ? */
function isFocusable(element: Element): element is HTMLElement {
  if (!(element instanceof HTMLElement)) return false;
  if (element.hasAttribute('disabled')) return false;
  if (element.getAttribute('aria-hidden') === 'true') return false;
  const tag = element.tagName;
  return (
    tag === 'BUTTON' ||
    tag === 'A' ||
    tag === 'INPUT' ||
    tag === 'SELECT' ||
    tag === 'TEXTAREA' ||
    element.tabIndex >= 0
  );
}

function focusablesOf(root: HTMLElement): HTMLElement[] {
  return [...root.querySelectorAll('*')].filter(isFocusable);
}

export class UIRoot {
  readonly element: HTMLDivElement;

  private readonly options: UIRootOptions;
  private readonly modalStack: UIPanel[] = [];
  private base: UIPanel | null = null;
  private baseWasFocused: HTMLElement | null = null;
  private stackWasFocused: (HTMLElement | null)[] = [];
  private disposed = false;

  constructor(parent: HTMLElement = document.body, options: UIRootOptions = {}) {
    this.options = options;
    this.element = document.createElement('div');
    this.element.id = 'ui-root';
    this.element.className = 'ui-root';
    parent.appendChild(this.element);
    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', this.onKeydown, true);
    }
  }

  /** Panneau de fond (écran titre) — seul à l'écran, hors pile modale. */
  setBase(panel: UIPanel | null): void {
    if (this.base === panel) return;
    if (this.base !== null) {
      this.base.hide();
      this.base = null;
      this.restoreFocus(this.baseWasFocused);
      this.baseWasFocused = null;
    }
    if (panel !== null) {
      this.baseWasFocused = this.captureFocus();
      this.base = panel;
      panel.show();
      this.focusFirst(panel);
    }
    this.notifySuspension();
  }

  /** Empile un panneau modal au-dessus du reste. */
  push(panel: UIPanel): void {
    const top = this.modalStack[this.modalStack.length - 1];
    if (top === panel) return;
    if (top !== undefined) top.hide();
    this.stackWasFocused.push(this.captureFocus());
    this.modalStack.push(panel);
    panel.show();
    this.focusFirst(panel);
    this.notifySuspension();
  }

  /** Dépile le sommet. Retourne le panneau déposé, ou `null`. */
  pop(): UIPanel | null {
    const panel = this.modalStack.pop();
    if (panel === undefined) return null;
    panel.hide();
    const top = this.modalStack[this.modalStack.length - 1];
    if (top !== undefined) {
      top.show();
      this.focusFirst(top);
    } else {
      this.restoreFocus(this.stackWasFocused.pop() ?? null);
    }
    this.notifySuspension();
    return panel;
  }

  get top(): UIPanel | null {
    return this.modalStack[this.modalStack.length - 1] ?? null;
  }

  get depth(): number {
    return this.modalStack.length;
  }

  /** L'interface a-t-elle la parole (panneau ouvert) ? */
  get isSpeaking(): boolean {
    return this.base !== null || this.modalStack.length > 0;
  }

  /** Dépile tout (transition de chapitre, retour au titre). */
  popAll(): void {
    while (this.modalStack.length > 0) this.pop();
  }

  /** Ajoute un élément hors pile (toast, voile) — jamais masqué par elle. */
  addOverlay(element: HTMLElement): void {
    this.element.appendChild(element);
  }

  /** Masque toute l'interface (moments purement contemplatifs). */
  setVisible(visible: boolean): void {
    this.element.classList.toggle('ui-root--hidden', !visible);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    if (typeof window !== 'undefined') {
      window.removeEventListener('keydown', this.onKeydown, true);
    }
    this.popAll();
    if (this.base !== null) {
      this.base.hide();
      this.base = null;
    }
    for (const child of [...this.element.children]) child.remove();
    this.element.remove();
  }

  // ————————————————————————————————— Clavier de la pile

  private readonly onKeydown = (event: KeyboardEvent): void => {
    const panel = this.top;
    if (panel === null) {
      // Pas de modale : si le panneau de base existe, il gère ses touches
      // lui-même (boutons natifs) — le jeu ne doit rien recevoir de plus.
      if (this.base !== null && event.key === 'Tab') this.trapBaseFocus(event);
      return;
    }

    // Le panneau voit passer la touche d'abord (capture de remappage).
    panel.onKeydown?.(event);
    if (event.defaultPrevented) return;

    if (event.key === 'Escape') {
      event.preventDefault();
      this.options.onEscape?.();
      return;
    }
    if (event.key === 'Tab') this.trapFocus(event, panel);
  };

  /** Le focus ne sort jamais du panneau ouvert (WCAG 2.4.3). */
  private trapFocus(event: KeyboardEvent, panel: UIPanel): void {
    const focusables = focusablesOf(panel.element);
    if (focusables.length === 0) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (first === undefined || last === undefined) return;
    const active = document.activeElement;
    if (event.shiftKey && (active === first || !panel.element.contains(active))) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && (active === last || !panel.element.contains(active))) {
      event.preventDefault();
      first.focus();
    }
  }

  private trapBaseFocus(event: KeyboardEvent): void {
    const panel = this.base;
    if (panel === null) return;
    this.trapFocus(event, panel);
  }

  // ————————————————————————————————— Focus

  private captureFocus(): HTMLElement | null {
    const active = document.activeElement;
    return active instanceof HTMLElement ? active : null;
  }

  private restoreFocus(target: HTMLElement | null): void {
    if (target?.isConnected) target.focus();
  }

  private focusFirst(panel: UIPanel): void {
    const focusables = focusablesOf(panel.element);
    const first = focusables[0];
    if (first !== undefined) {
      first.focus();
      return;
    }
    if (panel.element instanceof HTMLElement) panel.element.focus();
  }

  private notifySuspension(): void {
    this.options.onSuspendChange?.(this.isSpeaking);
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
