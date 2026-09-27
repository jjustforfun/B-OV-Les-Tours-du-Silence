<div align="center">

# BӀOV : Les Tours du Silence

![Bandeau du jeu : trois tours vainakhs stylisées dans une brume d'aube, reliées par des escaliers impossibles](docs/assets/banner.jpg)

> _Placeholder_ — illustration d'intention générée pour tenir la place du
> visuel définitif. Elle n'est pas canonique : les proportions des tours
> devront suivre le canon de [docs/ART_DIRECTION.md](docs/ART_DIRECTION.md) § 2.

**Un puzzle contemplatif en 3D isométrique, dans les montagnes du Caucase tchétchène.**

_« Ce que l'on bâtit pour les autres finit par nous porter. »_

</div>

---

## Le jeu

Turpal revient dans la vallée de ses ancêtres. Les tours vainakhs se sont
**fracturées** — non pas effondrées : leurs chemins ne se rejoignent plus — et
la vallée s'est tue. En manipulant une architecture impossible et en
retrouvant les vertus du **Nokhchalla**, il rebâtit les chemins entre les
tours, et entre les gens.

Borz, un loup de pierre aux yeux d'ambre, l'accompagne. Il n'y a **ni ennemi,
ni chronomètre, ni score, ni mort** : seulement des chemins à révéler, une
vallée à regarder, et six vertus — hospitalité, parole donnée, respect des
anciens, patience, pardon, humilité.

### Piliers

|     | Pilier                                                           |
| --- | ---------------------------------------------------------------- |
| 🏔   | **Élégance** — chaque image doit pouvoir servir de fond d'écran. |
| 💡  | **Eurêka** — le joueur se sent brillant, jamais bête.            |
| 🔇  | **Silence habité** — le son raconte autant que l'image.          |
| 🤝  | **Dignité** — une culture montrée avec respect et tendresse.     |
| 🌊  | **Fluidité** — 60 fps, zéro friction, sur tous les écrans.       |

8 chapitres · 5 à 12 min chacun · 60 à 90 min au total · jouable hors ligne.

---

## Démarrage rapide

```bash
pnpm install
pnpm dev          # http://localhost:5173
```

> **Node 22 LTS** (voir `.nvmrc`). pnpm est le gestionnaire de référence
> (`corepack enable` suffit à l'installer) ; npm fonctionne en repli.
> Pour tester sur un téléphone du réseau local : `pnpm dev --host`.

### Scripts

| Commande            | Rôle                                                                     |
| ------------------- | ------------------------------------------------------------------------ |
| `pnpm dev`          | Serveur de développement, HMR                                            |
| `pnpm build`        | `tsc -b` puis build de production dans `dist/`                           |
| `pnpm preview`      | Sert le build de production (le seul à profiler)                         |
| `pnpm lint`         | ESLint avec lint typé — **zéro avertissement toléré**                    |
| `pnpm lint:fix`     | ESLint en correction automatique                                         |
| `pnpm format`       | Prettier en écriture                                                     |
| `pnpm format:check` | Prettier en vérification (utilisé en CI)                                 |
| `pnpm typecheck`    | `tsc -b --force` sur les deux projets (app + outillage)                  |
| `pnpm test`         | Tests unitaires (Vitest)                                                 |
| `pnpm test:watch`   | Vitest en mode veille                                                    |
| `pnpm test:e2e`     | Tests end-to-end desktop + mobile (Playwright)                           |
| `pnpm check-bundle` | Échoue si le bundle initial dépasse 1,5 Mo gzip                          |
| **`pnpm check`**    | **lint → typecheck → tests → build → budget. Le juge avant tout commit** |

> **CI** : le workflow GitHub Actions est versionné dans
> [`ci/github-actions-ci.yml`](ci/README.md) et **pas encore actif** — il doit
> être déplacé dans `.github/workflows/` par un compte humain (une commande,
> voir `ci/README.md`).

Les hooks `husky` appliquent la même exigence : `pre-commit` lance
`lint-staged`, `commit-msg` valide les Conventional Commits, `pre-push` relance
`pnpm check`.

---

## Contrôles

Résumé — détail complet et remappage dans [docs/CONTROLS.md](docs/CONTROLS.md).

|                              | Action                                                                          |
| ---------------------------- | ------------------------------------------------------------------------------- |
| **Clic / tap**               | Turpal marche jusqu'au point désigné                                            |
| **Glisser sur un mécanisme** | Il tourne ou coulisse ; aimantation au relâchement                              |
| **↑ ↓ ← → / WASD / ZQSD**    | Déplacement vers le nœud voisin, dans la direction de l'écran                   |
| **`Tab` / `Shift+Tab`**      | Cycler entre les mécanismes interactifs                                         |
| **Q / E** (A / E en AZERTY)  | Tourner le mécanisme sélectionné                                                |
| **`Espace` / `Entrée`**      | Activer, valider                                                                |
| **`H`**                      | Demander un indice                                                              |
| **`Échap` / `P`**            | Pause · **`M`** couper le son · **`F`** plein écran                             |
| **Manette**                  | Stick gauche : déplacement · gâchettes : rotation · A : activer · Start : pause |

Pas de zoom, pas de caméra libre : le cadrage est composé par le designer — et
c'est ce qui rend les illusions possibles ([ADR-002](DECISIONS.md)).

**AZERTY fonctionne sans rien régler** : les raccourcis sont liés aux touches
_physiques_, et ZQSD occupe les mêmes positions que WASD ([ADR-023](DECISIONS.md)).

---

## Stack

TypeScript strict · Vite · **three.js** · pmndrs/postprocessing · **Tone.js** ·
GSAP · lil-gui (dev) · vite-plugin-pwa · Vitest · Playwright · ESLint (flat
config) · Prettier · husky + lint-staged · pnpm.

Aucun framework d'interface : l'UI est du HTML/CSS au-dessus du canvas
([ADR-012](DECISIONS.md)). Aucun fichier audio : tout est synthétisé
([ADR-007](DECISIONS.md)).

## Structure du projet

```
├── src/
│   ├── core/       moteur : boucle 60 Hz, temps, EventBus, états, qualité adaptative
│   ├── render/     renderer, caméra isométrique, lumière, ciel, palettes, post-traitement
│   ├── world/      niveaux, graphe de navigation, A*, illusions, mécanismes
│   ├── entities/   Turpal, Borz, anciens et PNJ
│   ├── input/      pointeur, clavier, manette, haptique
│   ├── audio/      musique adaptative et sons synthétisés (Tone.js)
│   ├── fx/         brume, neige, lucioles, rais de lumière, célébrations
│   ├── ui/         interface DOM et jetons de design
│   ├── story/      chapitres et proverbes
│   ├── levels/     un fichier par chapitre, chargé à la demande
│   ├── i18n/       fr (référence), en, ru, ce
│   ├── save/       sauvegarde silencieuse et versionnée
│   ├── platform/   abstraction web / Capacitor
│   ├── utils/      maths, easings, pools, discipline mémoire
│   └── debug/      compteur de perf, panneau lil-gui, visualisation du graphe
├── tests/          unit (Vitest) · e2e (Playwright)
├── docs/           game design, récit, DA, audio, contrôles, architecture, culture…
├── scripts/        garde-fou de bundle, validation des messages de commit
└── public/         manifeste PWA, icônes, assets statiques
```

## Documentation

| Document                                       | Contenu                                                 |
| ---------------------------------------------- | ------------------------------------------------------- |
| [AGENTS.md](AGENTS.md)                         | Règles de travail — **à lire avant de toucher au code** |
| [DECISIONS.md](DECISIONS.md)                   | 23 ADR : chaque choix structurant et ses alternatives   |
| [tasks.md](tasks.md)                           | Feuille de route en 12 phases, tâches atomiques         |
| [qa-report.md](qa-report.md)                   | Rapport qualité, un bloc par phase                      |
| [brief.yaml](brief.yaml)                       | Spécification faisant autorité (figée)                  |
| [docs/GDD.md](docs/GDD.md)                     | Boucle de jeu, mécaniques, indices, chapitres           |
| [docs/STORY.md](docs/STORY.md)                 | Récit sans dialogue, textes, proverbes                  |
| [docs/ART_DIRECTION.md](docs/ART_DIRECTION.md) | Rendu, canon des tours, palettes, animation             |
| [docs/AUDIO.md](docs/AUDIO.md)                 | Pondar, musique adaptative, SFX, mixage                 |
| [docs/CONTROLS.md](docs/CONTROLS.md)           | Contrôles et accessibilité                              |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)   | Diagrammes, format de niveau, cycle de vie              |
| [docs/LEVEL_DESIGN.md](docs/LEVEL_DESIGN.md)   | Règles, croquis de chaque chapitre                      |
| [docs/PERFORMANCE.md](docs/PERFORMANCE.md)     | Budgets et méthode de profilage                         |
| [docs/CULTURE.md](docs/CULTURE.md)             | Représentation culturelle — **contraignant**            |
| [docs/ANDROID_PORT.md](docs/ANDROID_PORT.md)   | Portage Capacitor (plus tard)                           |

---

## Créer un niveau

Un niveau est une **donnée typée**, pas du code ([ADR-010](DECISIONS.md)) :
lisible, différable par Git, validée par le compilateur.

### 1. Écrire l'intention

Une phrase dans [docs/LEVEL_DESIGN.md](docs/LEVEL_DESIGN.md) : quelle vertu,
quel geste du joueur, quel **moment « wow »**, quel **secret**.

### 2. Créer le fichier

```bash
cp src/levels/00-prologue.ts src/levels/08-mon-chapitre.ts
```

### 3. Poser le graphe avant la pierre

```ts
import type { LevelDefinition } from '@world/Level';

export const level: LevelDefinition = {
  id: '08-mon-chapitre',
  chapter: 8,
  virtue: 'patience',
  titleKey: 'levels.patience.title',
  proverbKey: 'proverbs.patience',
  sky: 'dusk',
  palette: 'patience',
  music: { mode: 'aeolian', root: 'E', strings: ['E2', 'B2', 'E3'] },

  spawn: 'quai',
  goal: 'sommet',
  camera: { target: [0, 2, 0], zoom: 10 },

  nodes: [
    { id: 'quai', at: [0, 0, 0], tags: ['spawn'], surface: 'stone' },
    { id: 'palier', at: [2, 1, 0] },
    // `up` non vertical = on marche sur la paroi (ADR-004)
    { id: 'paroi', at: [4, 2, 0], up: [0, 0, 1] },
    { id: 'sommet', at: [4, 5, 0], tags: ['goal'], surface: 'snow' },
  ],

  edges: [
    { from: 'quai', to: 'palier' },
    // ce passage n'existe que si le rotateur `R` est à 90° (ADR-003)
    { from: 'palier', to: 'paroi', condition: { mechanism: 'R', equals: 90 } },
    // liaison qui n'existe qu'à l'écran, par coïncidence de projection
    { from: 'paroi', to: 'sommet', illusory: true },
  ],

  mechanisms: [{ id: 'R', kind: 'rotator', at: [2, 1, 0], params: { step: 90 } }],

  triggers: [
    { id: 'intro', on: { levelStart: true }, play: { textKey: 'story.patience.intro' } },
    { id: 'aigle', on: { node: 'paroi' }, play: { eagleFound: true }, once: true },
  ],
};
```

### 4. Enregistrer le chapitre

Ajouter l'import **dynamique** dans `src/levels/index.ts` — c'est lui qui
garantit un chunk `level-08` séparé, hors du bundle initial :

```ts
'08-mon-chapitre': () => import('./08-mon-chapitre'),
```

### 5. Vérifier le graphe, puis les illusions

```bash
pnpm dev            # puis ouvrir ?level=08-mon-chapitre&debug=nav
```

`NavGraphViz` affiche nœuds, arêtes et conditions. **Si le niveau n'est pas
intéressant en fil de fer, il ne le sera pas en pierre.**

Pour chaque illusion prévue, `auditIllusions()` doit répondre `aligned` avec un
écart **≤ 6 px** :

```ts
auditIllusions(projections, [{ a: 'paroi', b: 'sommet' }]);
// → [{ aligned: true, screenDistance: 3.6, reason: 'aligned' }]
```

### 6. Poser la géométrie, puis finir

`geometry: LevelBlockDef[]` (blocs, tours, escaliers, passerelles), puis
palette, son, déclencheurs narratifs.

### 7. Valider

La grille de [docs/LEVEL_DESIGN.md](docs/LEVEL_DESIGN.md) § 10 fait foi :
un moment « wow », un secret, 5–12 min, une seule mécanique nouvelle, aucune
impasse possible, lisible en **390×844 et 1920×1080**, ≤ 120 draw calls,
≤ 150 k triangles, chunk ≤ 400 ko gzip, `dispose()` sans résidu.

---

## Portage Android (à venir)

La v1 est une **PWA installable et jouable hors ligne**. Le portage Android via
**Capacitor** est prévu ensuite, et **rien n'est implémenté aujourd'hui**
([ADR-014](DECISIONS.md)) — mais trois préparations le rendent quasi gratuit :

1. `base: './'` dans Vite (chemins relatifs, indispensables en WebView) ;
2. la couche `src/platform/Platform.ts`, **asynchrone dès le web** (stockage,
   vibration, plein écran, cycle de vie) ;
3. aucun accès direct à `window` / `navigator` hors de `platform/` et `ui/`.

Le jour venu, **`CapacitorPlatform` est la seule classe à écrire** — c'est le
critère de réussite du portage. Plan détaillé, permissions (il n'y en a
aucune), icônes adaptatives, bouton retour, build AAB :
[docs/ANDROID_PORT.md](docs/ANDROID_PORT.md).

---

## Contribuer

1. Lire [AGENTS.md](AGENTS.md) — c'est le règlement, il est opposable.
2. Prendre une tâche dans [tasks.md](tasks.md) et la marquer `[~]`.
3. Petites étapes vérifiables : rien ne passe à l'étape suivante sans compiler,
   passer le lint et fonctionner.
4. `pnpm check` **vert** avant chaque commit ; messages en Conventional Commits
   (`feat`, `fix`, `perf`, `art`, `audio`, `docs`, `chore`, `refactor`, `test`).
5. Toute décision structurante devient un ADR dans [DECISIONS.md](DECISIONS.md).
6. Remplir [qa-report.md](qa-report.md) en fin de phase.

---

## Crédits

| Rôle                                   | Attribution                                                      |
| -------------------------------------- | ---------------------------------------------------------------- |
| Conception, code, direction artistique | _à compléter_                                                    |
| Relecture culturelle tchétchène        | _à compléter — deux locuteurs natifs, crédités avec leur accord_ |
| Musique                                | Synthétisée à l'exécution (Tone.js), composition procédurale     |
| Bandeau ci-dessus                      | Image d'intention temporaire, à remplacer                        |

**Dépendances** : [three.js](https://threejs.org),
[pmndrs/postprocessing](https://github.com/pmndrs/postprocessing),
[Tone.js](https://tonejs.github.io), [GSAP](https://gsap.com),
[Vite](https://vite.dev), [Vitest](https://vitest.dev),
[Playwright](https://playwright.dev) — merci à leurs mainteneurs.

## Licence

**À définir** (placeholder). Pistes envisagées : code sous **MIT** ou
**Apache-2.0**, contenus (textes, illustrations, musique) sous
**CC BY-NC-SA 4.0** — la séparation des deux licences est probablement la bonne
réponse, elle sera tranchée par un ADR avant la première publication.

En l'état : tous droits réservés, aucune redistribution.
Aucune ressource culturelle tierce n'est embarquée dans le dépôt.

## Remerciements

À la culture **vainakhe** — tchétchène et ingouche — dont ce jeu s'inspire avec
respect : à ses **tours** (бӀов) [À VÉRIFIER], bâties en pierre sèche et
toujours debout ; à son hospitalité, à sa parole donnée, à son respect des
anciens ; au **Nokhchalla** (нохчалла) [À VÉRIFIER], ce code d'honneur qui
tient en un mot ce que ce jeu met huit chapitres à raconter.

Ce jeu est une **œuvre de fiction** inspirée par l'architecture et les valeurs
vainakhs. Il ne prétend ni documenter ni représenter la Tchétchénie
contemporaine. Il ne contient aucun propos politique, aucune référence à la
guerre, aucune arme. Les proverbes sont des textes originaux écrits dans
l'esprit du Nokhchalla, jamais présentés comme des citations authentiques.

Les mots tchétchènes non encore validés par un locuteur natif portent la marque
`[À VÉRIFIER]` et le resteront jusqu'à relecture. Voir
[docs/CULTURE.md](docs/CULTURE.md).

<div align="center">

_Баркалла._ [À VÉRIFIER]

</div>
