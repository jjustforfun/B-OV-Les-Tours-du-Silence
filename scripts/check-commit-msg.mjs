#!/usr/bin/env node
/**
 * check-commit-msg.mjs — garde-fou des messages de commit (AGENTS.md § 5).
 *
 * Conventional Commits, avec les types autorisés sur ce projet — dont `art`
 * et `audio`, parce qu'un changement de palette ou de nappe sonore mérite
 * d'être retrouvable dans l'historique au même titre qu'un correctif.
 */
import { readFileSync } from 'node:fs';

const TYPES = ['feat', 'fix', 'perf', 'refactor', 'docs', 'chore', 'test', 'art', 'audio'];
const PATTERN = new RegExp(`^(${TYPES.join('|')})(\\([a-z0-9 \\-_/.]+\\))?!?: .{1,90}$`);

const path = process.argv[2];
if (!path) {
  console.error('✗ check-commit-msg : chemin du message manquant.');
  process.exit(1);
}

const subject = readFileSync(path, 'utf8')
  .split('\n')
  .find((line) => line.trim() !== '' && !line.startsWith('#'));

if (subject === undefined) {
  console.error('✗ Message de commit vide.');
  process.exit(1);
}

// Les commits automatiques de git (merge, revert, fixup) passent sans contrôle.
if (/^(Merge|Revert|fixup!|squash!)/.test(subject)) process.exit(0);

if (!PATTERN.test(subject)) {
  console.error(`
✗ Message de commit non conforme (AGENTS.md § 5).

  Reçu   : ${subject}
  Attendu: <type>(<portée facultative>): <sujet de 1 à 90 caractères>
  Types  : ${TYPES.join(', ')}

  Exemples :
    feat(world): rotation de tour recâblant le NavGraph
    art(sky): palette crépusculaire du chapitre 4
    audio(pondar): signature de fin de chapitre
`);
  process.exit(1);
}
