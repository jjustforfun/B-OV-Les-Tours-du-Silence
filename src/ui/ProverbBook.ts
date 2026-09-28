/**
 * ProverbBook.ts — le carnet de proverbes.
 *
 * Huit pages, une par chapitre. Une page offerte s'illumine d'une braise ;
 * une page encore fermée reste une silhouette pâle, sans son texte — le
 * carnet ne raconte rien d'avance. Chaque tour est un petit croquis SVG
 * inline : zéro asset à charger (ADR-026), le style suit la couleur d'accent.
 */
import { i18n } from '@i18n/i18n';
import { el, type UIPanel } from './UIRoot';

export interface ProverbEntryData {
  /** Clé i18n du texte du proverbe (ex. `proverbs.patience`). */
  readonly proverbKey: string;
  /** Clé i18n de la vertu du chapitre (ex. `virtues.patience`). */
  readonly virtueKey: string;
  readonly unlocked: boolean;
  readonly illustrationUnlocked: boolean;
}

export interface ProverbBookOptions {
  readonly getEntries: () => readonly ProverbEntryData[];
  readonly onClose: () => void;
}

/**
 * Croquis de tour : empilement géométrique, porte en arc, braise au sommet.
 * Les lignes de fracture restent des arêtes nettes — jamais un décomb (ADR-021).
 */
const TOWER_SVG = `
<svg class="ui-proverb__tower" viewBox="0 0 48 64" aria-hidden="true" focusable="false">
  <g fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
    <path d="M14 60h20M16 60V44h16v16M18 44V32h12v12M20 32V22h8v10M22 22v-8h4v8" />
    <path d="M21 60v-7a3 3 0 0 1 6 0v7" />
    <path d="M16 52h16M18 38h12" />
  </g>
  <circle class="ui-proverb__ember" cx="24" cy="11" r="2.5" />
</svg>`;

const EAGLE_ILLUSTRATION_SVG = `
<svg class="ui-proverb__tower" viewBox="0 0 48 64" aria-hidden="true" focusable="false">
  <g fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
    <path d="M5 57l11-17 7 9 7-14 13 22H5z" />
    <path d="M17 57V37h14v20M19 37V26h10v11M21 26l3-8 3 8" />
    <path d="M8 17c5-5 9-4 16 0 7-4 11-5 16 0-7-2-10 1-16 5-6-4-9-7-16-5z" />
  </g>
  <circle class="ui-proverb__ember" cx="24" cy="22" r="2" />
</svg>`;

export class ProverbBook implements UIPanel {
  readonly element: HTMLElement;

  private readonly options: ProverbBookOptions;
  private readonly list: HTMLElement;
  private readonly note: HTMLElement;
  private readonly titleNode: HTMLElement;
  private readonly closeButton: HTMLButtonElement;

  constructor(options: ProverbBookOptions) {
    this.options = options;
    this.element = el('section', 'ui-panel ui-proverb is-hidden');
    this.element.setAttribute('role', 'dialog');
    this.element.setAttribute('aria-modal', 'true');

    const card = el('div', 'ui-card ui-proverb__card');
    const header = el('header', 'ui-proverb__header');
    this.titleNode = el('h2', 'ui-proverb__title', i18n.t('proverbs.title'));
    this.note = el('p', 'ui-proverb__note', i18n.t('proverbs.note'));
    this.closeButton = el('button', 'ui-settings__close', i18n.t('ui.close'));
    this.closeButton.type = 'button';
    this.closeButton.addEventListener('click', () => this.options.onClose());

    this.list = el('ul', 'ui-proverb__list');
    const scroller = el('div', 'ui-proverb__scroller');
    scroller.appendChild(this.list);

    header.append(this.titleNode, this.note);
    card.append(header, scroller, this.closeButton);
    this.element.appendChild(card);
  }

  /** Reconstruit la liste : au show et à chaque changement de langue. */
  refresh(): void {
    this.titleNode.textContent = i18n.t('proverbs.title');
    this.note.textContent = i18n.t('proverbs.note');
    this.closeButton.textContent = i18n.t('ui.close');

    this.list.replaceChildren();
    for (const entry of this.options.getEntries()) {
      const item = el('li', 'ui-proverb__entry');
      item.classList.add(entry.unlocked ? 'is-offered' : 'is-sealed');
      const figure = el('div', 'ui-proverb__figure');
      figure.innerHTML = entry.illustrationUnlocked ? EAGLE_ILLUSTRATION_SVG : TOWER_SVG;
      if (entry.illustrationUnlocked) figure.classList.add('is-illustrated');
      const body = el('div', 'ui-proverb__body');
      const virtue = el('h3', 'ui-proverb__virtue', i18n.t(entry.virtueKey));
      const text = el(
        'p',
        'ui-proverb__text',
        entry.unlocked ? i18n.t(entry.proverbKey) : i18n.t('proverbs.locked'),
      );
      body.append(virtue, text);
      if (entry.illustrationUnlocked) {
        body.append(el('p', 'ui-proverb__illustration', i18n.t('proverbs.illustrationRevealed')));
      }
      item.append(figure, body);
      this.list.appendChild(item);
    }
  }

  onKeydown(_event: KeyboardEvent): void {
    /* Rien : la navigation par Tab suffit (piège de focus de la pile). */
  }

  show(): void {
    this.refresh();
    this.element.classList.remove('is-hidden');
    this.closeButton.focus();
  }

  hide(): void {
    this.element.classList.add('is-hidden');
  }

  dispose(): void {
    this.element.remove();
  }
}
