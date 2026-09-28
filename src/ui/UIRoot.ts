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
  if (element.closest('[inert], [aria-hidden="true"], .is-hidden') !== null) return false;
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

/** Nom annoncé lors de l'ouverture d'un écran. */
function accessibleNameOf(root: HTMLElement): string {
  const labelledBy = root.getAttribute('aria-labelledby');
  if (labelledBy !== null) {
    const label = labelledBy
      .split(/\s+/)
      .map((id) => document.getElementById(id)?.textContent?.trim() ?? '')
      .filter(Boolean)
      .join(' ');
    if (label.length > 0) return label;
  }
  return root.getAttribute('aria-label')?.trim() ?? '';
}

export class UIRoot {
  readonly element: HTMLDivElement;

  private readonly options: UIRootOptions;
  private readonly modalStack: UIPanel[] = [];
  private readonly announcer: HTMLDivElement;
  private base: UIPanel | null = null;
  private baseWasFocused: HTMLElement | null = null;
  private stackWasFocused: (HTMLElement | null)[] = [];
  private visibleWasFocused: HTMLElement | null = null;
  private announceTimer: ReturnType<typeof setTimeout> | null = null;
  private disposed = false;

  constructor(parent: HTMLElement = document.body, options: UIRootOptions = {}) {
    this.options = options;
    this.element = document.createElement('div');
    this.element.id = 'ui-root';
    this.element.className = 'ui-root';
    this.announcer = document.createElement('div');
    this.announcer.className = 'ui-sr-only';
    this.announcer.setAttribute('role', 'status');
    this.announcer.setAttribute('aria-live', 'polite');
    this.announcer.setAttribute('aria-atomic', 'true');
    this.element.appendChild(this.announcer);
    parent.appendChild(this.element);
    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', this.onKeydown, true);
    }
  }

  /** Panneau de fond (écran titre) — seul à l'écran, hors pile modale. */
  setBase(panel: UIPanel | null): void {
    if (this.base === panel) return;
    if (this.base !== null) {
      const previous = this.base;
      if (
        this.modalStack.length === 0 &&
        !this.restoreFocus(this.baseWasFocused) &&
        document.activeElement instanceof HTMLElement &&
        previous.element.contains(document.activeElement)
      ) {
        document.activeElement.blur();
      }
      previous.hide();
      this.setPanelActive(previous, false);
      this.base = null;
      this.baseWasFocused = null;
    }
    if (panel !== null) {
      this.baseWasFocused = this.captureFocus();
      this.base = panel;
      this.mount(panel);
      const active = this.modalStack.length === 0;
      this.setPanelActive(panel, active);
      const currentFocus = this.captureFocus();
      panel.show();
      if (active) {
        this.focusPanel(panel);
        this.announce(panel);
      } else {
        this.restoreFocus(currentFocus);
      }
    }
    this.notifySuspension();
  }

  /** Empile un panneau modal au-dessus du reste. */
  push(panel: UIPanel): void {
    const top = this.modalStack[this.modalStack.length - 1];
    if (top === panel) return;
    this.stackWasFocused.push(this.captureFocus());
    this.modalStack.push(panel);
    this.mount(panel);
    this.setPanelActive(panel, true);
    panel.show();
    this.focusPanel(panel);

    // Le focus quitte l'ancien écran avant que celui-ci sorte de l'arbre
    // d'accessibilité : aucun aria-hidden n'englobe ainsi le focus courant.
    if (top !== undefined) {
      top.hide();
      this.setPanelActive(top, false);
    } else if (this.base !== null) {
      // Le titre reste visible derrière une modale, mais sort de l'arbre
      // d'accessibilité et de l'ordre de tabulation.
      this.setPanelActive(this.base, false);
    }
    this.announce(panel);
    this.notifySuspension();
  }

  /** Dépile le sommet. Retourne le panneau déposé, ou `null`. */
  pop(): UIPanel | null {
    const panel = this.modalStack.pop();
    if (panel === undefined) return null;
    const restoreTarget = this.stackWasFocused.pop() ?? null;
    const top = this.modalStack[this.modalStack.length - 1];
    if (top !== undefined) {
      this.setPanelActive(top, true);
      top.show();
      if (!this.restoreFocus(restoreTarget, top.element)) this.focusPanel(top);
      this.announce(top);
    } else if (this.base !== null) {
      this.setPanelActive(this.base, true);
      if (!this.restoreFocus(restoreTarget, this.base.element)) this.focusPanel(this.base);
      this.announce(this.base);
    } else if (!this.restoreFocus(restoreTarget)) {
      const active = document.activeElement;
      if (active instanceof HTMLElement && panel.element.contains(active)) active.blur();
    }

    // Même ordre qu'à l'ouverture : déplacer d'abord le focus, puis masquer.
    panel.hide();
    this.setPanelActive(panel, false);
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
    if (this.element.classList.contains('ui-root--hidden') === !visible) return;
    this.element.classList.toggle('ui-root--hidden', !visible);
    if (visible) {
      this.element.inert = false;
      this.element.removeAttribute('inert');
      this.element.removeAttribute('aria-hidden');
      const panel = this.top ?? this.base;
      if (panel !== null && !this.restoreFocus(this.visibleWasFocused, panel.element)) {
        this.focusPanel(panel);
      }
      this.visibleWasFocused = null;
    } else {
      const active = document.activeElement;
      this.visibleWasFocused =
        active instanceof HTMLElement && this.element.contains(active) ? active : null;
      this.visibleWasFocused?.blur();
      this.element.inert = true;
      this.element.setAttribute('inert', '');
      this.element.setAttribute('aria-hidden', 'true');
    }
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    if (typeof window !== 'undefined') {
      window.removeEventListener('keydown', this.onKeydown, true);
    }
    if (this.announceTimer !== null) {
      clearTimeout(this.announceTimer);
      this.announceTimer = null;
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
    if (focusables.length === 0) {
      event.preventDefault();
      panel.element.focus();
      return;
    }
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

  // ————————————————————————————————— DOM, focus et annonces

  private mount(panel: UIPanel): void {
    if (panel.element.parentElement !== this.element) {
      this.element.appendChild(panel.element);
    }
  }

  private setPanelActive(panel: UIPanel, active: boolean): void {
    panel.element.inert = !active;
    if (active) {
      panel.element.removeAttribute('inert');
      panel.element.removeAttribute('aria-hidden');
    } else {
      panel.element.setAttribute('inert', '');
      panel.element.setAttribute('aria-hidden', 'true');
    }
  }

  private focusPanel(panel: UIPanel): void {
    const active = document.activeElement;
    if (
      active instanceof HTMLElement &&
      active !== document.body &&
      panel.element.contains(active) &&
      (active === panel.element || isFocusable(active))
    ) {
      return;
    }

    const first = focusablesOf(panel.element)[0];
    if (first !== undefined) {
      first.focus();
      return;
    }

    if (!panel.element.hasAttribute('tabindex')) panel.element.tabIndex = -1;
    panel.element.focus();
  }

  private announce(panel: UIPanel): void {
    if (this.disposed) return;
    const name = accessibleNameOf(panel.element);
    if (name === '') return;
    if (this.announceTimer !== null) clearTimeout(this.announceTimer);
    this.announcer.textContent = '';
    this.announceTimer = setTimeout(() => {
      this.announcer.textContent = `Écran : ${name}`;
      this.announceTimer = null;
    }, 0);
  }

  private captureFocus(): HTMLElement | null {
    const active = document.activeElement;
    return active instanceof HTMLElement ? active : null;
  }

  private restoreFocus(target: HTMLElement | null, scope?: HTMLElement): boolean {
    if (
      target === null ||
      !target.isConnected ||
      (scope !== undefined && !scope.contains(target))
    ) {
      return false;
    }
    target.focus();
    return document.activeElement === target;
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
