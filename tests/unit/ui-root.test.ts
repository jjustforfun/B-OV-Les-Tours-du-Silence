// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { UIRoot, el, type UIPanel } from '@ui/UIRoot';

interface TestPanel extends UIPanel {
  readonly controls: readonly HTMLButtonElement[];
}

function makePanel(name: string, controlCount = 2, focusOnShow = 0): TestPanel {
  const element = el('section', 'ui-panel is-hidden');
  element.setAttribute('aria-label', name);
  const controls = Array.from({ length: controlCount }, (_, index) => {
    const button = el('button', undefined, `${name} ${index + 1}`);
    button.type = 'button';
    element.appendChild(button);
    return button;
  });

  return {
    element,
    controls,
    show(): void {
      element.classList.remove('is-hidden');
      controls[focusOnShow]?.focus();
    },
    hide(): void {
      element.classList.add('is-hidden');
    },
    dispose(): void {
      element.remove();
    },
  };
}

afterEach(() => {
  vi.useRealTimers();
  document.body.replaceChildren();
});

describe('UIRoot accessible', () => {
  it('monte chaque panneau et masque les écrans inactifs à l’arbre accessible', () => {
    const root = new UIRoot();
    const base = makePanel('Titre');
    const modal = makePanel('Pause');

    root.setBase(base);
    expect(base.element.parentElement).toBe(root.element);
    expect(base.element.hasAttribute('inert')).toBe(false);
    expect(base.element.hasAttribute('aria-hidden')).toBe(false);

    root.push(modal);
    expect(modal.element.parentElement).toBe(root.element);
    expect(base.element.hasAttribute('inert')).toBe(true);
    expect(base.element.getAttribute('aria-hidden')).toBe('true');
    expect(modal.element.hasAttribute('inert')).toBe(false);
    expect(modal.element.hasAttribute('aria-hidden')).toBe(false);

    root.pop();
    expect(modal.element.hasAttribute('inert')).toBe(true);
    expect(modal.element.getAttribute('aria-hidden')).toBe('true');
    expect(base.element.hasAttribute('inert')).toBe(false);
    expect(base.element.hasAttribute('aria-hidden')).toBe(false);

    base.controls[1]?.focus();
    root.setVisible(false);
    expect(root.element.hasAttribute('inert')).toBe(true);
    expect(root.element.getAttribute('aria-hidden')).toBe('true');
    root.setVisible(true);
    expect(root.element.hasAttribute('inert')).toBe(false);
    expect(root.element.hasAttribute('aria-hidden')).toBe(false);
    expect(document.activeElement).toBe(base.controls[1]);

    root.dispose();
  });

  it('respecte le focus initial du panneau et restaure chaque niveau modal en LIFO', () => {
    const trigger = el('button', undefined, 'Ouvrir le jeu');
    document.body.appendChild(trigger);
    trigger.focus();

    const root = new UIRoot();
    const base = makePanel('Titre', 2, 1);
    const pause = makePanel('Pause');
    const settings = makePanel('Réglages');

    root.setBase(base);
    expect(document.activeElement).toBe(base.controls[1]);

    base.controls[0]?.focus();
    root.push(pause);
    pause.controls[1]?.focus();
    root.push(settings);

    root.pop();
    expect(document.activeElement).toBe(pause.controls[1]);

    root.pop();
    expect(document.activeElement).toBe(base.controls[0]);

    root.setBase(null);
    expect(document.activeElement).toBe(trigger);

    root.dispose();
  });

  it('se replie sur un focus sûr si la cible mémorisée a disparu', () => {
    const root = new UIRoot();
    const base = makePanel('Titre');
    const modal = makePanel('Pause');

    root.setBase(base);
    base.controls[1]?.focus();
    root.push(modal);
    base.controls[1]?.remove();
    root.pop();

    expect(document.activeElement).toBe(base.controls[0]);
    root.dispose();
  });

  it('piège Tab dans l’écran actif, y compris sans contrôle', () => {
    const root = new UIRoot();
    const modal = makePanel('Pause');
    root.push(modal);

    modal.controls[1]?.focus();
    const forward = new KeyboardEvent('keydown', {
      key: 'Tab',
      bubbles: true,
      cancelable: true,
    });
    window.dispatchEvent(forward);
    expect(forward.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(modal.controls[0]);

    const backward = new KeyboardEvent('keydown', {
      key: 'Tab',
      shiftKey: true,
      bubbles: true,
      cancelable: true,
    });
    window.dispatchEvent(backward);
    expect(backward.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(modal.controls[1]);

    root.pop();
    const message = makePanel('Carton de chapitre', 0);
    root.push(message);
    expect(message.element.tabIndex).toBe(-1);
    expect(document.activeElement).toBe(message.element);

    const withoutControl = new KeyboardEvent('keydown', {
      key: 'Tab',
      bubbles: true,
      cancelable: true,
    });
    window.dispatchEvent(withoutControl);
    expect(withoutControl.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(message.element);

    root.dispose();
  });

  it('annonce le nom accessible de chaque écran sans voler le focus', () => {
    vi.useFakeTimers();
    const root = new UIRoot();
    const base = makePanel('Nom provisoire');
    const heading = el('h1', undefined, 'Les Tours du Silence');
    heading.id = 'screen-title';
    base.element.prepend(heading);
    base.element.removeAttribute('aria-label');
    base.element.setAttribute('aria-labelledby', heading.id);
    const modal = makePanel('Réglages');
    const announcer = root.element.querySelector<HTMLElement>('[role="status"]');

    root.setBase(base);
    vi.runOnlyPendingTimers();
    expect(announcer?.textContent).toBe('Écran : Les Tours du Silence');
    expect(document.activeElement).toBe(base.controls[0]);

    root.push(modal);
    vi.runOnlyPendingTimers();
    expect(announcer?.textContent).toBe('Écran : Réglages');
    expect(document.activeElement).toBe(modal.controls[0]);

    root.pop();
    vi.runOnlyPendingTimers();
    expect(announcer?.textContent).toBe('Écran : Les Tours du Silence');
    expect(document.activeElement).toBe(base.controls[0]);

    root.dispose();
  });
});
