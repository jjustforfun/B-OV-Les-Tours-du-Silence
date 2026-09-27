/**
 * vite.config.ts — configuration de build de « BӀOV : Les Tours du Silence ».
 *
 * Points structurants :
 *  - `base: './'` : chemins relatifs, indispensable pour le futur portage Capacitor (file://).
 *  - alias `@core`, `@render`, … : miroir exact des `paths` de tsconfig.json.
 *  - code splitting : un chunk par niveau (import dynamique) + un chunk vendor pour three.
 *  - PWA : precache de la coquille du jeu, installable et jouable hors ligne.
 */
import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

const resolveSrc = (path: string): string => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  base: './',
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
  server: {
    host: true,
    port: 5173,
    // Le jeu se teste souvent depuis un téléphone, via un tunnel ou un
    // conteneur (l'hôte n'est donc pas « localhost »). On accepte tout hôte
    // en développement uniquement : le serveur de production n'est pas Vite.
    allowedHosts: true,
  },
  preview: {
    host: true,
    port: 4173,
    allowedHosts: true,
  },
  build: {
    target: 'es2022',
    sourcemap: true,
    cssCodeSplit: true,
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        // Un chunk par niveau : `src/levels/0X-*.ts` est chargé à la demande.
        manualChunks(id: string) {
          if (id.includes('/src/levels/')) {
            const match = /\/src\/levels\/([^/]+)\.ts$/.exec(id);
            if (match?.[1] && match[1] !== 'index') return `level-${match[1]}`;
            return undefined;
          }
          // three et postprocessing forment un seul chunk : postprocessing
          // dépend de three et les deux sont chargés par la même entrée —
          // Rollup les fusionne de toute façon, autant le nommer honnêtement.
          if (id.includes('/node_modules/three/')) return 'vendor-3d';
          if (id.includes('/node_modules/postprocessing/')) return 'vendor-3d';
          if (id.includes('/node_modules/tone/')) return 'vendor-audio';
          if (id.includes('/node_modules/gsap/')) return 'vendor-tween';
          return undefined;
        },
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
  },
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: ['icons/*.png', 'assets/fonts/**/*', 'favicon.svg'],
      manifest: false, // fourni tel quel par public/manifest.webmanifest
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2,glb,ktx2,webp,mp3,ogg,json}'],
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        cleanupOutdatedCaches: true,
        navigateFallback: 'index.html',
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
});
