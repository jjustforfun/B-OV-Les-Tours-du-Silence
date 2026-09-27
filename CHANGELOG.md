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

- Phase 1 rendue jouable visuellement : scène de démonstration avec tour
  vainakh stylisée sur piton rocheux, Turpal pour l'échelle, brume d'aube et
  cadrage orthographique auto-fit en portrait comme en paysage.
- `ToonStoneMaterial` enrichi : rampe toon 3 bandes avec plancher à 0,32,
  vertex colors, AO de sommets cuit, rim light, bruit procédural de pierre et
  brouillard de hauteur dans le shader.
- Chaîne `PostFX` pilotée par `Quality` : bloom subtil, vignette, LUT 3D de
  chapitre, SMAA et SSAO en haute qualité, avec LUTs 16×16×16 générées
  paresseusement depuis les palettes.
- Ombres blob instanciées (`BlobShadows`) orientées selon le vecteur `up`, pour
  ancrer les personnages sans shadow map mobile.
- Ciel en dégradé animé et raccordé à la brume, mis à jour sans recréer de
  texture à chaque frame.
- Phase 3 Turpal complète : modèle procédural flat shading d'environ
  3 000 triangles, squelette hanches/jambes/bras/tête, clips procéduraux
  (marche, idle, escaliers, salut, regard vers le ciel), orientation selon le
  `up`, suivi de chemin et marqueur de destination.
- Scène de revue `?showcase=turpal` : quatre Turpal simultanés (face, profil,
  dos, trois-quarts) pour vérifier la lisibilité à petite taille.
- Projection écran des nœuds de navigation (`NodeProjection`) branchée sur
  `Level.projectNodes()` : buffers préalloués, 300 nœuds en moins de 0,2 ms en
  test unitaire, prête pour illusions, picking et debug nav.
- Activation automatique des arêtes illusoires : `Level.projectNodes()` ouvre
  ou coupe les liaisons selon l'alignement écran courant, y compris avec les
  conditions de mécanisme ; `debugIllusionMismatches()` signale les illusions
  non alignées pour l'overlay debug.
- Picking tactile tolérant dans `PointerInput` : rayon central puis quatre
  rayons de secours à 12 px pour les leviers, raycast des surfaces marchables
  avec tolérance élargie sur mobile, puis snap au nœud le plus proche.
- Visualiseur `NavGraphViz` activable par `?debug=nav` ou par la touche G en
  dev : nœuds, arêtes actives en vert, inactives en rouge, conditions et
  illusions.
- Validateur automatique « aucune impasse » (`validateNoDeadEnds`) : exploration
  des positions et états de mécanismes atteignables, rapport exploitable en
  tests, et couverture de tous les niveaux déclarés.
- Démo de graphe `penrose-demo` : escalier de Penrose minimal où un rotateur
  ouvre une liaison illusoire entre deux chemins impossibles.
- Phase 4 mécanismes complète : affordance lumineuse commune, drag par angle
  écran, snap élastique, événements `mechanism:*` pour les sons de cran,
  recâblage du `NavGraph`, transport temporaire de Turpal, rotator, slider,
  pressure plate, tower rotation et gravity path.
- Borz jouable côté logique : graphe propre limité aux nœuds `borz`, appel par
  tap, suivi, pont/marche, portage temporaire et yeux d'ambre pulsants pour les
  indices.

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
