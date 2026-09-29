/**
 * playwright.config.ts — tests end-to-end desktop et mobile.
 * Sert aussi de garde-fou « le jeu démarre vraiment » : boot WebGL, canvas visible, pas d'erreur console.
 * Lance automatiquement un serveur de preview sur le build de production.
 */
import { defineConfig, devices } from '@playwright/test';

/**
 * Chromium de secours pour les environnements où le CDN Playwright est
 * inaccessible (bac à sable CI restreint) : `BOV_CHROMIUM=/chemin/chromium`
 * pointe un binaire compatible (ex. @sparticuz/chromium). `BOV_CHROMIUM_ARGS`
 * transmet ses drapeaux (séparés par des espaces). Sans ces variables, la
 * configuration reste strictement celle de Playwright.
 */
const externalChromium = process.env.BOV_CHROMIUM;
const externalArgs = process.env.BOV_CHROMIUM_ARGS?.split(' ').filter(Boolean) ?? [];
const launchOptions = externalChromium
  ? { executablePath: externalChromium, args: externalArgs }
  : {};

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  ...(process.env.CI ? { workers: 1 } : {}),
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list']],
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'on-first-retry',
    // La vidéo requiert le ffmpeg de Playwright — indisponible quand on
    // fournit un Chromium externe (CDN inaccessible) : on la coupe alors.
    video: externalChromium ? 'off' : 'retain-on-failure',
    launchOptions,
  },
  projects: [
    {
      // Viewport de référence de la Definition of Done (AGENTS.md § 11).
      name: 'desktop-1920',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1920, height: 1080 } },
    },
    {
      // Second viewport de référence : 390 × 844 (iPhone 12/13/14, cible iOS).
      name: 'mobile-390x844',
      use: {
        ...devices['iPhone 13'],
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
      },
    },
    {
      name: 'mobile-landscape',
      use: { ...devices['Pixel 7 landscape'] },
    },
    {
      // Émulation Android de référence de la QA phase 10 (brief).
      name: 'pixel-5',
      use: { ...devices['Pixel 5'] },
    },
    {
      // Émulation iOS de référence de la QA phase 10 (brief). WebKit réel
      // n'étant pas toujours installable, l'émulation (viewport 390×844,
      // UA iOS, tactile, DPR 3) tourne sur Chromium : elle couvre la mise en
      // page et l'input, pas le moteur WebKit lui-même.
      name: 'iphone-12',
      use: { ...devices['iPhone 12'], browserName: 'chromium' },
    },
  ],
  webServer: {
    command: 'pnpm build && pnpm preview --port 4173 --host 127.0.0.1',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
