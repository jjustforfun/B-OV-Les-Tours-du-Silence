/**
 * ChapterCard.ts — le carton d'ouverture de chapitre.
 *
 * Deux temps, écourtables mais jamais forcés :
 *  1. le noir s'ouvre sur le numéro, la vertu, le titre et son sous-titre
 *     (les deux lignes poétiques) — `UI.cardHoldMs` ;
 *  2. le texte d'introduction du chapitre apparaît sur voile translucide,
 *     deux phrases au plus, et s'efface de lui-même (`UI.introHoldMs`).
 *
 * Un tap, Entrée ou Espace avance d'un temps ; l'intro ne s'écourte pas
 * avant `UI.introMinHoldMs` pour éviter le tap accidentel du carton. En
 * mouvement réduit, aucun fondu : les textes se posent et se retirent.
 */
import { UI } from '@/config';
import { i18n } from '@i18n/i18n';
import { el, type UIPanel } from './UIRoot';

export interface ChapterCardData {
  readonly chapter: number;
  /** Clé i18n de la vertu (ex. `virtues.patience`). */
  readonly virtueKey: string;
  readonly titleKey: string;
  readonly subtitleKey: string;
  /** Clé i18n du texte d'introduction (ex. `story.patience.intro`). */
  readonly introKey: string;
}

export interface ChapterCardOptions {
  /** Le carton et l'intro sont passés : le jeu peut commencer. */
  readonly onDone: () => void;
}

type CardStep = 'card' | 'intro';

export class ChapterCard implements UIPanel {
  readonly element: HTMLElement;

  private readonly options: ChapterCardOptions;
  private readonly black: HTMLElement;
  private readonly texts: HTMLElement;
  private readonly numberNode: HTMLElement;
  private readonly virtueNode: HTMLElement;
  private readonly titleNode: HTMLElement;
  private readonly subtitleNode: HTMLElement;
  private readonly introNode: HTMLElement;

  private step: CardStep = 'card';
  private stepStartedAt = 0;
  private timer: number | null = null;
  private data: ChapterCardData | null = null;

  constructor(options: ChapterCardOptions) {
    this.options = options;
    this.element = el('section', 'ui-panel ui-chapter is-hidden');
    this.element.setAttribute('role', 'region');
    this.element.setAttribute(
      'aria-labelledby',
      'ui-chapter-number ui-chapter-virtue ui-chapter-title ui-chapter-subtitle',
    );

    // Le noir d'entrée : il s'ouvre sur le chapitre (fondu au noir élégant).
    this.black = el('div', 'ui-chapter__black');
    this.black.setAttribute('aria-hidden', 'true');

    this.texts = el('div', 'ui-chapter__texts');
    this.numberNode = el('p', 'ui-chapter__number');
    this.numberNode.id = 'ui-chapter-number';
    this.virtueNode = el('h2', 'ui-chapter__virtue');
    this.virtueNode.id = 'ui-chapter-virtue';
    this.titleNode = el('p', 'ui-chapter__title');
    this.titleNode.id = 'ui-chapter-title';
    this.subtitleNode = el('p', 'ui-chapter__subtitle');
    this.subtitleNode.id = 'ui-chapter-subtitle';
    this.texts.append(this.numberNode, this.virtueNode, this.titleNode, this.subtitleNode);

    this.introNode = el('p', 'ui-chapter__intro');
    this.introNode.setAttribute('role', 'status');
    this.introNode.setAttribute('aria-live', 'polite');
    this.introNode.setAttribute('aria-atomic', 'true');

    this.element.append(this.black, this.texts, this.introNode);
    this.element.addEventListener('pointerdown', () => this.advance());
  }

  /** Présente un chapitre : carton puis intro, puis `onDone`. */
  present(data: ChapterCardData): void {
    this.data = data;
    this.step = 'card';
    this.numberNode.textContent =
      data.chapter === 0
        ? i18n.t('virtues.prologue')
        : i18n.t('ui.chapter', { number: data.chapter });
    this.virtueNode.textContent = i18n.t(data.virtueKey);
    this.titleNode.textContent = i18n.t(data.titleKey);
    this.subtitleNode.textContent = i18n.t(data.subtitleKey);
    // Le texte entre dans la région live seulement au second temps : il est
    // alors annoncé sans déplacer le focus placé sur le panneau.
    this.introNode.textContent = '';

    this.show();
    // Le noir s'ouvre au rythme contemplatif ; les textes se posent ensuite.
    this.element.classList.remove('is-open');
    this.element.classList.add('is-entering');
    this.introNode.classList.remove('is-visible');
    void this.element.offsetHeight; // repartir de l'état noir pour le fondu
    this.element.classList.add('is-open');

    this.stepStartedAt = nowMs();
    this.schedule(UI.cardHoldMs, () => this.toIntro());
  }

  /** Passe au temps suivant (tap, Entrée, Espace). */
  advance(): void {
    if (this.step === 'card') {
      this.toIntro();
      return;
    }
    // L'intro ne s'écourte pas immédiatement : le tap du carton ne doit pas
    // sauter la phrase d'ouverture par accident.
    if (nowMs() - this.stepStartedAt >= UI.introMinHoldMs) this.finish();
  }

  /** Termer le carton immédiatement (transition de chapitre). */
  finish(): void {
    this.clearTimer();
    this.hide();
    this.options.onDone();
  }

  onKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Enter' && event.key !== ' ' && event.key !== 'Escape') return;
    event.preventDefault();
    this.advance();
  }

  show(): void {
    this.element.classList.remove('is-hidden');
  }

  hide(): void {
    this.clearTimer();
    this.element.classList.add('is-hidden');
    this.element.classList.remove('is-open', 'is-entering');
    this.introNode.classList.remove('is-visible');
  }

  dispose(): void {
    this.clearTimer();
    this.element.remove();
  }

  private toIntro(): void {
    if (this.step !== 'card' || this.data === null) return;
    this.step = 'intro';
    this.stepStartedAt = nowMs();
    this.texts.classList.add('is-faded');
    this.introNode.textContent = i18n.t(this.data.introKey);
    this.introNode.classList.add('is-visible');
    this.schedule(UI.introHoldMs, () => this.finish());
  }

  private schedule(delayMs: number, handler: () => void): void {
    this.clearTimer();
    this.timer = window.setTimeout(handler, delayMs);
  }

  private clearTimer(): void {
    if (this.timer === null) return;
    clearTimeout(this.timer);
    this.timer = null;
  }
}

function nowMs(): number {
  return typeof performance === 'object' && performance !== null ? performance.now() : Date.now();
}
