/**
 * ChapterCard.ts — carte d'ouverture de chapitre.
 *
 * Statut : squelette. Un carton sobre : le numéro du chapitre, la vertu
 * qu'il incarne, et rien d'autre. Il reste 3 secondes puis s'efface — le
 * joueur peut l'écourter d'un tap mais n'y est jamais forcé.
 */
import { el, type UIPanel } from './UIRoot';

export interface ChapterCardData {
  readonly chapter: number;
  readonly virtue: string;
  readonly title: string;
}

export class ChapterCard implements UIPanel {
  readonly element: HTMLElement;

  private readonly numberNode: HTMLElement;
  private readonly virtueNode: HTMLElement;
  private readonly titleNode: HTMLElement;

  constructor() {
    this.element = el('section', 'ui-panel ui-chapter is-hidden');
    this.numberNode = el('p', 'ui-chapter__number');
    this.virtueNode = el('h2', 'ui-chapter__virtue');
    this.titleNode = el('p', 'ui-chapter__title');
    this.element.append(this.numberNode, this.virtueNode, this.titleNode);
  }

  present(data: ChapterCardData): void {
    this.numberNode.textContent = data.chapter === 0 ? '' : `Chapitre ${String(data.chapter)}`;
    this.virtueNode.textContent = data.virtue;
    this.titleNode.textContent = data.title;
    this.show();
  }

  show(): void {
    this.element.classList.remove('is-hidden');
  }

  hide(): void {
    this.element.classList.add('is-hidden');
  }

  dispose(): void {
    this.element.remove();
  }
}
