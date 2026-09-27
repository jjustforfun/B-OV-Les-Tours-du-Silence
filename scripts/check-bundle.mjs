#!/usr/bin/env node
/**
 * check-bundle.mjs — garde-fou de poids.
 *
 * Échoue si le bundle *initial* (ce que le navigateur doit télécharger avant
 * la première image : index.html + entrée JS + ses imports statiques + CSS)
 * dépasse 1,5 Mo gzip. Les chunks de niveaux, chargés à la demande, ne
 * comptent pas — c'est tout l'intérêt du code splitting.
 *
 * Ce budget n'est pas décoratif : sur une 4G moyenne, 1,5 Mo ≈ 3 secondes
 * d'attente. Au-delà, on perd le joueur avant la première pierre.
 */
import { readFile, readdir, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import path from 'node:path';

const DIST = path.resolve('dist');
const LIMIT_BYTES = 1_500_000;

/** Un chunk de niveau est chargé dynamiquement : hors budget initial. */
const LAZY_PATTERNS = [/^level-/, /^DebugPanel-/, /^Stats-/, /^lil-gui/, /workbox-/, /^sw\.js$/];

function isLazy(fileName) {
  return LAZY_PATTERNS.some((pattern) => pattern.test(fileName));
}

async function collectFiles(dir, base = dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...(await collectFiles(full, base)));
    else files.push(path.relative(base, full));
  }
  return files;
}

function formatKb(bytes) {
  return `${(bytes / 1024).toFixed(1)} ko`;
}

async function main() {
  if (!existsSync(DIST)) {
    console.error('✗ dist/ introuvable — lancez `pnpm build` avant `pnpm check-bundle`.');
    process.exit(1);
  }

  const files = await collectFiles(DIST);
  const counted = [];
  let total = 0;

  for (const file of files) {
    const ext = path.extname(file);
    if (!['.js', '.css', '.html'].includes(ext)) continue;
    const name = path.basename(file);
    if (isLazy(name)) continue;
    if (file.endsWith('.map')) continue;

    const buffer = await readFile(path.join(DIST, file));
    const gzipped = gzipSync(buffer, { level: 9 }).length;
    total += gzipped;
    counted.push({ file, gzipped, raw: (await stat(path.join(DIST, file))).size });
  }

  counted.sort((a, b) => b.gzipped - a.gzipped);

  console.log('\nBundle initial (gzip) :');
  for (const entry of counted) {
    console.log(`  ${entry.file.padEnd(48)} ${formatKb(entry.gzipped).padStart(12)}`);
  }

  const percent = ((total / LIMIT_BYTES) * 100).toFixed(1);
  console.log(`  ${'—'.repeat(48)} ${'—'.repeat(12)}`);
  console.log(`  ${'TOTAL'.padEnd(48)} ${formatKb(total).padStart(12)}`);
  console.log(`  budget : ${formatKb(LIMIT_BYTES)} — utilisé à ${percent} %\n`);

  if (total > LIMIT_BYTES) {
    console.error(
      `✗ Bundle initial trop lourd : ${formatKb(total)} > ${formatKb(LIMIT_BYTES)}.\n` +
        '  Pistes : rendre un import dynamique, alléger three (imports nommés), différer un système.',
    );
    process.exit(1);
  }

  console.log(`✓ Bundle initial dans le budget (${formatKb(total)} / ${formatKb(LIMIT_BYTES)}).`);
}

main().catch((error) => {
  console.error('✗ check-bundle a échoué :', error);
  process.exit(1);
});
