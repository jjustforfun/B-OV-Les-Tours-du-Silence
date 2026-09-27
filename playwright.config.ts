/**
 * playwright.config.ts — tests end-to-end desktop et mobile.
 * Sert aussi de garde-fou « le jeu démarre vraiment » : boot WebGL, canvas visible, pas d'erreur console.
 * Lance automatiquement un serveur de preview sur le build de production.
 */
import { defineConfig, devices } from '@playwright/test';

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
    video: 'retain-on-failure',
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
  ],
  webServer: {
    command: 'pnpm build && pnpm preview --port 4173 --host 127.0.0.1',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
