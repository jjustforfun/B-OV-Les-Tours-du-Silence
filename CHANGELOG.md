# Changelog

Toutes les évolutions notables de **BӀOV : Les Tours du Silence**.
Format inspiré de [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/) ;
versionnage [SemVer](https://semver.org/lang/fr/).

## [Non publié]

### Modifié

- **Documentation de conception réécrite** : `GDD.md`, `STORY.md`,
  `ART_DIRECTION.md`, `AUDIO.md`, `CONTROLS.md`, `ARCHITECTURE.md`,
  `LEVEL_DESIGN.md`, `PERFORMANCE.md`, `CULTURE.md` et `ANDROID_PORT.md` —
  toutes les intentions sont désormais chiffrées et rattachées à un fichier.
- **Titres de chapitre** : les huit chapitres portent les noms du récit
  (« Le Retour », « L'Hospitalité »… « Le Chant revenu ») ; les anciens titres
  poétiques deviennent des sous-titres (`levels.*.subtitle`).
- **Musique adaptative à quatre couches** (`drone`, `pondar`, `doul`,
  `melody`) au lieu de trois, avec `MusicSystem.setProgress(n)`.
- **Budget de triangles ramené de 350 k à 150 k** à l'écran
  (`PERF.maxTriangles`), et ajout des plafonds mémoire GPU (256 Mo), chunk de
  niveau (400 ko gzip) et time-to-interactive (3 s en 4G).
- **Clavier** : table de raccourcis complète (Tab, Q/E, H, P, M, F) liée aux
  touches **physiques**, donc valable en AZERTY comme en QWERTY (ADR-023).

- **Renumérotation des ADR** : la numérotation à quatre chiffres
  (`ADR-0001`…`ADR-0013`) est remplacée par `ADR-001`…`ADR-022`, dans un
  format unifié (Contexte / Décision / Alternatives considérées /
  Conséquences). Toutes les références croisées du dépôt ont été mises à jour.
- `TurpalModel` n'est plus une capsule de substitution mais un modèle
  procédural complet.

### Ajouté

- Échafaudage complet du projet : Vite + TypeScript strict, three.js,
  postprocessing, Tone.js, GSAP, lil-gui, vite-plugin-pwa.
- Chaîne qualité : ESLint (flat config, lint typé), Prettier, husky,
  lint-staged, Vitest, Playwright (desktop + mobile portrait/paysage).
- `pnpm check` : lint → typecheck → tests → build → budget de bundle.
- Garde-fou de poids `scripts/check-bundle.mjs` (1,5 Mo gzip initial).
- Moteur minimal : boucle de jeu, horloge bornée, bus d'événements typé,
  machine à états, qualité adaptative, renderer, caméra orthographique
  isométrique, éclairage trois sources, ciel en dégradé, post-traitement.
- Logique de jeu testée : graphe de navigation, A*, machine à états, qualité
  adaptative, modèle de personnage (57 tests unitaires).
- Scène minimale : un bloc de pierre en isométrie sur fond d'aube, avec
  compteur de FPS en développement.
- PWA installable et jouable hors ligne (manifest, icônes, service worker).
- Internationalisation fr / en / ru / ce (tchétchène partiel, marqué
  `[À VÉRIFIER]`).
- `AGENTS.md` : règlement en 12 sections opposable à tout agent (sources de
  vérité, boucle de travail, conventions, budgets, culture, interdits,
  Definition of Done, format de compte rendu).
- Règle dure appliquée par le code : aucune shadow map dynamique sur mobile
  (ADR-022), couverte par `tests/unit/quality.test.ts` (10 tests).
- Hook `commit-msg` validant les Conventional Commits (9 types, dont `art`
  et `audio`).
- Profils Playwright `mobile-390x844` et `desktop-1920`, alignés sur la
  Definition of Done.
- Intégration continue GitHub Actions : `pnpm check` sur chaque poussée,
  end-to-end Playwright dans un job séparé.
- Arêtes **conditionnelles** dans le graphe de navigation : un passage peut
  dépendre de l'état d'un mécanisme, déclaré dans les données du niveau
  (ADR-003).
- `auditIllusions()` : outil de level design qui mesure, en pixels, l'écart de
  projection entre deux nœuds candidats à une illusion (tolérance 6 px,
  ADR-003).
- Vecteur `up` par nœud de navigation : la gravité est une propriété du sol,
  pas du monde (ADR-004).
- `trimPathToSafe()` et `Turpal.revalidatePath()` : si un mécanisme coupe le
  chemin en cours de marche, Turpal s'arrête au dernier nœud sûr — jamais de
  chute, jamais de téléportation (ADR-005).
- `ICharacterModel` : contrat commun aux modèles de personnage, pour que le
  passage de la v1 procédurale au GLB ne touche pas le gameplay (ADR-006).
- `TurpalModel` procédural : Turpal en primitives low-poly (tcherkesska,
  12 gazyri, papakha, ceinture, bottes), ~600 triangles, zéro octet d'asset,
  respiration et marche animées en code (ADR-006).
- `CameraRig.frameLevel()` : auto-fit orthographique par projection des huit
  coins du niveau, marge de 8 %, validé en portrait 390×844 et en paysage
  1920×1080 (5 tests unitaires).
- `src/render/Palettes.ts` : les huit palettes de chapitre (ciel haut/bas,
  pierre ombre/lumière, accent) sous forme de données.
- `LevelDefinition` complétée : géométrie déclarative (`LevelBlockDef`),
  déclencheurs narratifs (`LevelTriggerDef`), surface par nœud, palette,
  accordage du pondar, et cadrage `camera: { target, zoom }`.
- Textes d'introduction des huit chapitres (`story.*.intro`) en fr, en et ru.
- Documentation fondatrice : AGENTS, 23 ADR, brief, tasks, rapport QA et
  10 documents de conception.
