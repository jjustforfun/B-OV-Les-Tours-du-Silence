/**
 * vitest.config.ts — tests unitaires (logique pure : graphes, pathfinding, machines à états…).
 * Les tests 3D/visuels relèvent de Playwright (tests/e2e), pas de Vitest.
 */
import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vitest/config';

const resolveSrc = (path: string): string => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@': resolveSrc('./src'),
      '@core': resolveSrc('./src/core'),
      '@render': resolveSrc('./src/render'),
      '@world': resolveSrc('./src/world'),
      '@entities': resolveSrc('./src/entities'),
      '@input': resolveSrc('./src/input'),
      '@audio': resolveSrc('./src/audio'),
      '@fx': resolveSrc('./src/fx'),
      '@ui': resolveSrc('./src/ui'),
      '@story': resolveSrc('./src/story'),
      '@levels': resolveSrc('./src/levels'),
      '@i18n': resolveSrc('./src/i18n'),
      '@save': resolveSrc('./src/save'),
      '@platform': resolveSrc('./src/platform'),
      '@utils': resolveSrc('./src/utils'),
      '@debug': resolveSrc('./src/debug'),
    },
  },
  test: {
    environment: 'node',
    include: ['tests/unit/**/*.test.ts'],
    exclude: ['tests/e2e/**', 'node_modules/**'],
    reporters: ['default'],
    coverage: {
      provider: 'v8',
      reportsDirectory: 'coverage',
      include: ['src/**/*.ts'],
    },
  },
});
