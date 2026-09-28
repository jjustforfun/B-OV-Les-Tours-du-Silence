// @vitest-environment jsdom

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { i18n } from '@i18n/i18n';
import { ChapterCard } from '@ui/ChapterCard';
import { ChapterSelector } from '@ui/ChapterSelector';
import { PauseMenu } from '@ui/PauseMenu';
import { ProverbBook } from '@ui/ProverbBook';
import { Settings, type UiSettingsState } from '@ui/Settings';
import { TitleScreen } from '@ui/TitleScreen';
import type { UIPanel } from '@ui/UIRoot';

const SETTINGS_STATE: UiSettingsState = {
  volumes: { master: 1, music: 1, ambience: 1, sfx: 1 },
  quality: 'auto',
  locale: 'fr',
  reducedMotion: 'auto',
  fontScale: 'normal',
  highContrast: false,
  subtitles: true,
  haptics: true,
};

function accessibleName(element: HTMLElement): string {
  const labelledBy = element.getAttribute('aria-labelledby');
  if (labelledBy !== null) {
    return labelledBy
      .split(/\s+/)
      .map((id) => document.getElementById(id)?.textContent?.trim() ?? '')
      .filter(Boolean)
      .join(' ');
  }
  return element.getAttribute('aria-label')?.trim() ?? '';
}

beforeAll(async () => {
  await i18n.init('fr');
});

afterAll(() => {
  vi.useRealTimers();
  document.body.replaceChildren();
});

describe('noms accessibles des panneaux', () => {
  it('nomme explicitement tous les écrans et tous les dialogues', () => {
    vi.useFakeTimers();
    const settings = new Settings({
      getState: () => SETTINGS_STATE,
      getBindings: () => ({}),
      onChange: vi.fn(),
      onBindingsChange: vi.fn(),
      onResetBindings: vi.fn(),
      onClose: vi.fn(),
    });
    const panels: UIPanel[] = [
      new TitleScreen({ onStart: vi.fn(), hasProgress: () => false }),
      new PauseMenu({
        onResume: vi.fn(),
        onRestart: vi.fn(),
        onSettings: vi.fn(),
        onProverbs: vi.fn(),
        onBackToTitle: vi.fn(),
      }),
      settings,
      new ChapterSelector({ getEntries: () => [], onSelect: vi.fn(), onClose: vi.fn() }),
      new ProverbBook({ getEntries: () => [], onClose: vi.fn() }),
    ];
    const chapter = new ChapterCard({ onDone: vi.fn() });
    panels.push(chapter);

    for (const panel of panels) {
      document.body.appendChild(panel.element);
      panel.show();
    }
    chapter.present({
      chapter: 1,
      virtueKey: 'virtues.patience',
      titleKey: 'levels.patience.title',
      subtitleKey: 'levels.patience.subtitle',
      introKey: 'story.patience.intro',
    });

    for (const panel of panels) {
      expect(panel.element.hasAttribute('aria-labelledby')).toBe(true);
      expect(accessibleName(panel.element)).not.toBe('');
      if (panel.element.getAttribute('role') === 'dialog') {
        expect(panel.element.getAttribute('aria-modal')).toBe('true');
      }
    }
    for (const control of settings.element.querySelectorAll('input, select')) {
      const label = [...settings.element.querySelectorAll('label')].find(
        (candidate) => candidate.htmlFor === control.id,
      );
      expect(control.id).not.toBe('');
      expect(label).toBeDefined();
      expect(label?.textContent?.trim()).not.toBe('');
    }

    for (const panel of panels) panel.dispose();
  });

  it('annonce l’introduction dynamique du chapitre dans une région polie', () => {
    vi.useFakeTimers();
    const chapter = new ChapterCard({ onDone: vi.fn() });
    document.body.appendChild(chapter.element);
    chapter.present({
      chapter: 1,
      virtueKey: 'virtues.patience',
      titleKey: 'levels.patience.title',
      subtitleKey: 'levels.patience.subtitle',
      introKey: 'story.patience.intro',
    });

    const liveIntro = chapter.element.querySelector<HTMLElement>('[role="status"]');
    expect(liveIntro?.getAttribute('aria-live')).toBe('polite');
    expect(liveIntro?.getAttribute('aria-atomic')).toBe('true');
    expect(liveIntro?.textContent).toBe('');

    chapter.advance();
    expect(liveIntro?.textContent?.trim()).not.toBe('');
    chapter.dispose();
  });
});
