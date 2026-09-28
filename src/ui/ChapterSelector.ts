/**
 * ChapterSelector.ts — les chapitres parcourus.
 *
 * Une liste plate, dans l'ordre du voyage. Les chapitres terminés portent
 * leur nom ; le chapitre courant est désigné ; les suivants restent des
 * silhouettes barrées — la carte ne spoil rien (docs/GDD.md). Rejouer un
 * chapitre terminé ne touche pas à la progression.
 */
import type { LevelId } from '@levels/index';
import { levelChapterNumber, levelTitleKey } from '@levels/index';
import { i18n } from '@i18n/i18n';
import { el, type UIPanel } from './UIRoot';

export type ChapterStatus = 'completed' | 'current' | 'locked';

export interface ChapterEntryData {
  readonly id: LevelId;
  readonly status: ChapterStatus;
}

export interface ChapterSelectorOptions {
  readonly getEntries: () => readonly ChapterEntryData[];
  readonly onSelect: (id: LevelId) => void;
  readonly onClose: () => void;
}

const STATUS_KEY: Readonly<Record<ChapterStatus, string>> = {
  completed: 'chapters.completed',
  current: 'chapters.current',
  locked: 'chapters.locked',
};

export class ChapterSelector implements UIPanel {
  readonly element: HTMLElement;

  private readonly options: ChapterSelectorOptions;
  private readonly list: HTMLElement;
  private readonly titleNode: HTMLElement;
  private readonly closeButton: HTMLButtonElement;
  private focusAfterShow: HTMLButtonElement | null = null;

  constructor(options: ChapterSelectorOptions) {
    this.options = options;
    this.element = el('section', 'ui-panel ui-chapters is-hidden');
    this.element.setAttribute('role', 'dialog');
    this.element.setAttribute('aria-modal', 'true');
    this.element.setAttribute('aria-labelledby', 'ui-chapters-title');

    const card = el('div', 'ui-card ui-chapters__card');
    const header = el('header', 'ui-chapters__header');
    this.titleNode = el('h2', 'ui-chapters__title', i18n.t('chapters.title'));
    this.titleNode.id = 'ui-chapters-title';
    this.closeButton = el('button', 'ui-settings__close', i18n.t('ui.close'));
    this.closeButton.type = 'button';
    this.closeButton.addEventListener('click', () => this.options.onClose());

    this.list = el('ul', 'ui-chapters__list');
    const scroller = el('div', 'ui-chapters__scroller');
    scroller.appendChild(this.list);

    header.append(this.titleNode, this.closeButton);
    card.append(header, scroller);
    this.element.appendChild(card);
  }

  /** Reconstruit la liste : au show et à chaque changement de langue. */
  refresh(): void {
    this.titleNode.textContent = i18n.t('chapters.title');
    this.closeButton.textContent = i18n.t('ui.close');

    this.list.replaceChildren();
    for (const entry of this.options.getEntries()) {
      const item = el('li', 'ui-chapters__entry');
      item.classList.add(`is-${entry.status}`);
      const button = el('button', 'ui-chapters__choice');
      button.type = 'button';
      const locked = entry.status === 'locked';
      button.disabled = locked;
      const number = el(
        'span',
        'ui-chapters__number',
        i18n.t('ui.chapter', { number: levelChapterNumber(entry.id) + 1 }),
      );
      const title = el(
        'span',
        'ui-chapters__name',
        locked ? i18n.t('chapters.locked') : i18n.t(levelTitleKey(entry.id)),
      );
      const status = el('span', 'ui-chapters__status');
      if (entry.status !== 'locked') {
        const marker = el(
          'span',
          'ui-chapters__status-marker',
          entry.status === 'current' ? '◆' : '✓',
        );
        marker.setAttribute('aria-hidden', 'true');
        status.append(marker, document.createTextNode(i18n.t(STATUS_KEY[entry.status])));
      }
      button.append(number, title, status);
      if (!locked) {
        button.addEventListener('click', () => this.options.onSelect(entry.id));
      } else {
        // Le focus ne doit jamais s'arrêter sur une porte fermée.
        button.tabIndex = -1;
      }
      item.appendChild(button);
      this.list.appendChild(item);
      if (entry.status === 'current' && this.focusAfterShow === null) {
        this.focusAfterShow = button;
      }
    }
  }

  onKeydown(_event: KeyboardEvent): void {
    /* Rien : la navigation par Tab suffit (piège de focus de la pile). */
  }

  show(): void {
    this.refresh();
    this.element.classList.remove('is-hidden');
    (this.focusAfterShow ?? this.closeButton).focus();
  }

  hide(): void {
    this.element.classList.add('is-hidden');
    this.focusAfterShow = null;
  }

  dispose(): void {
    this.element.remove();
  }
}
