# Changelog

Toutes les évolutions notables de **BӀOV : Les Tours du Silence**.
Format inspiré de [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/) ;
versionnage [SemVer](https://semver.org/lang/fr/).

## [Non publié]

### Ajouté

- **Phase 10 — Cycle de vie, libération et allocations** : une suite Node
  rejoue 16 transitions `LevelLoader` sur les huit chapitres, 10 cycles de
  `LevelRuntime` et le détachement des FX. Elle vérifie la stabilité des
  abonnements globaux/input, l'idempotence des propriétaires, l'annulation des
  pétales différés et une seule notification `dispose` pour chaque géométrie,
  matériau et texture observables. `disposeObject` déduplique désormais les
  ressources partagées et inspecte aussi les textures de uniforms ; le marqueur
  de destination de Turpal est enfin attaché au niveau puis détaché avec lui.
  Les snapshots de l'EventBus sont réutilisés par profondeur, le damping des
  particules ne crée plus de closure, la traînée dorée écrit sa tête dans des
  scalaires et la requête de mouvement réduit est mise en cache. Les mesures
  `renderer.info.memory`, courbe cinq minutes et dix coutures dans un vrai
  contexte WebGL restent explicitement ouvertes.
- **Phase 10 — Validation complémentaire des entrées** : la feuille de route
  reflète désormais l'état réellement livré des phases 5 à 10. Vingt-huit
  nouveaux scénarios couvrent le seuil tap/drag, la capture et toutes les
  annulations du pointeur, le cône directionnel écran, le cycle de mécanismes,
  les codes clavier physiques, la manette, les motifs haptiques, le remappage
  persistant et les libellés AZERTY. Le drag conserve maintenant la cible du
  `pointerdown`, une annulation système ne produit plus de tap, et une pause
  aimante le mécanisme avant de geler le monde. Les délais Gamepad
  `dual-rumble` utilisent correctement les millisecondes. La validation des
  gestes navigateur sur Android et iOS réels reste explicitement ouverte.
- **Phase 10 — Navigation au lecteur d'écran** : chaque panneau est désormais
  réellement monté dans `UIRoot` et possède un nom explicite relié à son titre.
  Un annonceur `role=status` poli et atomique signale les ouvertures sans voler
  le focus ; l'introduction de chapitre conserve sa propre région dynamique.
  Les écrans sous une modale deviennent `inert` et `aria-hidden`, `Tab` reste
  piégé au sommet, et chaque fermeture restaure en LIFO le contrôle exact qui
  l'avait ouverte, avec repli sûr si celui-ci a disparu. Les libellés des
  réglages sont reliés à leurs contrôles. Sept tests jsdom couvrent montage,
  noms, annonces, imbrication, piège et restauration du focus.
- **Phase 10 — Indices indépendants de la couleur** : la conception daltonienne
  est universelle et ne dépend pas d'un mode séparé. L'anneau de destination et
  chaque mécanisme possèdent désormais un contour neutre permanent ; les huit
  braises de l'épilogue sont doublées d'une coque filaire claire, visible même
  lorsque leur pulsation est figée. Dans l'interface, conflits, focus et
  chapitre courant associent couleur, bordure, symbole et texte. Deux tests
  d'audit verrouillent les canaux secondaires 3D et UI.
- **Phase 10 — Mouvement réduit** : la préférence système et le réglage manuel
  réduit/plein s'appliquent désormais immédiatement, y compris aux effets déjà
  instanciés. Les durées d'interface, du voile et des FX sont divisées par deux
  sans accélérer la marche ni modifier les puzzles. Les dérives de brume,
  neige, lucioles, ciel et rais, ainsi que les pulsations décoratives des
  mécanismes, sont figées ; le mode plein peut explicitement reprendre la main
  sur la préférence système. Quatre tests dédiés couvrent le changement à chaud
  de la brume, des particules et du ciel.
- **Phase 9 — Chapitre 7, « Le Chant revenu »** : épilogue linéaire sans
  mécanisme ni illusion, devant huit tours intactes reprenant les palettes des
  chapitres 0 à 7. Chaque passage allume une tour et restaure progressivement
  bourdon, pondar, percussion puis mélodie en Ré dorien `D3–A3–D4`. Au seuil
  familial, la main de Turpal sur la pierre fait répondre les huit tours en
  cascade et fond le ciel neige vers l'or ; il redescend ensuite s'asseoir parmi
  le voyageur, l'enfant, l'ancien et le rival, tandis que Borz se couche. Les
  sept secrets sauvegardés ne changent pas le chemin : ils font seulement se
  poser l'aigle final sur l'épaule de Turpal. La solution complète tient en un
  tap, 13 états de navigation sont explorés sans impasse, et 12 tests dédiés
  couvrent les deux variantes de l'aigle, le ciel, la musique et la conclusion.
- **Phase 9 — Chapitre 6, « L’Humilité »** : névé mobile qui descend Turpal
  sous le sommet, tour à quatre faces et deux bascules de gravité successives
  vers la paroi (`up=[0,0,1]`) puis le plafond (`up=[0,-1,0]`). La caméra roule
  sans singularité avec l’orientation du nœud courant. Borz prend en charge une
  procession autonome — voyageur, enfant, ancien, rival — en quatre allers et
  trois retours, sans jamais porter Turpal. Après le dernier dépôt, le plafond
  de l’arche et le sentier du sommet, séparés de `(6,6,6)` dans le monde, se
  confondent à 0 px en desktop comme en portrait. L’aigle secret vole sous
  Turpal après la seconde bascule. Le validateur explore 79 états étendus et 38
  états de mécanismes/récit sans impasse ; solution, roulis, transport du
  slider, procession et budgets sont couverts par 11 tests dédiés.
- **Phase 9 — Chapitre 5, « Le Pardon »** : tour séparée en deux moitiés
  intactes à quatre faces, pour 16 combinaisons réversibles. Turpal règle
  l'ouest puis avance le premier ; un rival procédural répond d'un cran à l'est
  et seule la séquence ouest 1 / est 2→3 referme définitivement la fracture.
  Les deux balcons, présents depuis l'ouverture, se rencontrent sans pierre
  ajoutée et superposent leurs nœuds à 0 px sur desktop comme sur mobile. Une
  courte paroi introduit `GravityPath` avec `up=[0,0,1]` ; l'aigle reste visible
  dans la fente ouverte. Le runtime et le validateur modélisent le tour de
  réponse, le retrait obligatoire de la corniche et l'ordre des gestes : 876
  états étendus et 136 états de mécanismes/récit sont explorés sans impasse.
- **Phase 9 — Chapitre 4, « La Patience »** : lac Kezenoy-Am transparent et
  graphe miroir jouable sous sa surface. Une `TowerRotation` entraîne deux
  tours intactes, leurs escaliers et les nœuds associés ; Borz rejoint seul une
  dalle verrouillante et matérialise le pont d'argent. Le nouveau `MoonCycle`
  conserve le temps déjà attendu, atteint le zénith à 34 s, révèle l'aigle
  pendant 6 s puis ouvre définitivement la porte à 40 s. Lune, brumes, oiseaux
  et lumière restent procéduraux pendant l'attente. La jonction réel/reflet est
  mesurée à 0 px en 1920×1080 et 390×844 ; 126 états étendus et 24 états de
  mécanismes sont explorés sans impasse.
- **Phase 9 — Chapitre 1, « L'Hospitalité »** : village d'Itum-Kale dans la
  brume, terrasses, tour intacte et passerelle radiale à quatre crans. Le
  voyageur au manteau trempé traverse automatiquement quand la roue pointe au
  nord ; celle-ci reste verrouillée pendant ses pas, puis une fumée revient sur
  un toit. La route sud exige à la fois le cran 270° et l'état persistant
  `traveler-served`, ce qui rend le service de l'invité obligatoire sans texte
  ni punition. Le troisième cran, inutile à la solution, révèle seulement un
  aigle près d'une meurtrière. Conditions de NavGraph composables, acteur
  narratif procédural, géométrie parentée aux mécanismes et exploration
  exhaustive de 67 états ajoutés.
- **Phase 9 — Chapitre 0, « Le Retour »** : aoul à l'aube, cour, escalier
  extérieur et tour vainakh procédurale intacte ; générateur de géométrie
  instanciée depuis `LevelBlockDef` et tour canonique (fruit 8 %, entrée au
  premier étage, toit à cinq gradins). Le NavGraph relie la dernière marche au
  seuil par une illusion mesurée à 0 px en 1920×1080 et 390×844 ; la traversée
  déclenche un accroc de lumière, la paume de Turpal sur la pierre et l'éveil
  des yeux d'ambre de Borz. Palette aube rose/ardoise, accordage dorien en Ré,
  vent + aigle + respiration de pierre, progression musicale à quatre couches.
  Un aigle optionnel révèle une illustration dans le carnet, sans compteur ni
  avantage. Solution et absence d'impasse couvertes par test automatique.
- **Phase 8 — UI et narration** : `UIRoot` pile d'écrans DOM (panneau de base
  + pile modale, `Échap` remonte d'un cran, focus piégé WCAG 2.4.3,
  suspension des intentions de jeu, ADR-027) orchestrée par `GameFlow`
  (titre → carton → jeu → célébration → suite, voile noir 1200 ms sans
  couture) ; écran titre sur la vallée (« Toucher pour commencer » plein
  écran, entrées clavier seules) ; cartons de chapitre deux temps (noir
  interne 1800 ms, intro 2 phrases sur verre, ducking `ui:speaking`,
  écourtable) ; pause 5 entrées qui gèle la simulation, jamais le rendu ;
  réglages tout-application-immédiate (4 curseurs de volumes fusionnant la
  table persistée avant même le déverrouillage audio — bug corrigé, qualité
  figeable, langue fr/en/ru/ce sans rechargement, mouvement, taille de texte,
  contraste, sous-titres, remappage `event.code` avec conflits signalés et
  libellés de disposition) ; carnet de proverbes à croquis de tour SVG inline
  (braise si offerte, silhouette scellée, « inspiré de l'esprit du
  Nokhchalla ») ; sélecteur de chapitres sans spoiler (verrouillé = fermé) ;
  toasts `aria-live` et sous-titres d'événements sonores ; sauvegarde
  automatique silencieuse à chaque chapitre et à la pause
  (`hasProgress`/`isCompleted`/`reachedLevelIds`). Nouvelles clés i18n
  ×3 langues (122 entrées chacune), `ce` toujours en repli `fr`.
- **Phase 6 — Audio complet** : `AudioManager` (bus master/music/ambience/sfx,
  gains nominaux 0/−9/−14/−6 dB, ADR-025), réverbération « vallée » partagée
  (decay 9 s, wet 0,42), `PondarSynth` Karplus-Strong à trois cordes accordées
  par chapitre (±4 cents), musique adaptative à quatre couches avec fondus de
  6 s, ambiances par lieu à périodes premières (7/11/13/17/23 s), pas selon la
  surface (±2 demi-tons), rotation musicale (chaque cran joue la note suivante
  de la gamme, `ScaleCursor`), accord de connexion, signature de chapitre et
  ducking. Tone.js est chargé **après le premier geste** (`AudioDirector`,
  ADR-025) : le bundle initial ne contient aucune dépendance audio. Onglet
  caché : master à 0 en 250 ms + Transport suspendu ; perte de focus : −12 dB.
- **Phase 7 — FX et « juice »** : pool de particules générique à draw call
  unique (`fx/Particles.ts`, 420 particules × qualité), poussière de rotation,
  reconstruction de pierre (`expo.out` 700 ms, les éclats s'assemblent),
  traînée dorée (8 u/s, fondu 900 ms), micro-célébrations 1,6 s (timeline
  manuelle, ADR-026), illumination de fin de chapitre en cascade (250 ms de la
  plus lointaine à la plus proche) + rais de grâce, brume 1–3 nappes
  (opacité ≤ 0,12), neige 140–400 flocons recyclés, lucioles aux chapitres 4
  et 7 (pulsations désynchronisées par sommet), rais de lumière avec poussière
  flottante, indices visuels d'inactivité (lueur 90 s, regard de Borz 180 s).
  Tout est instancié ou mis en pool ; `prefers-reduced-motion` divise les
  durées par deux et coupe les dérives.
- **Mode jouable `?play` / `?level=<id>`** : un chapitre se charge (chunk à la
  demande), `LevelRuntime` + `FxRuntime` + `AudioDirector` s'y abonnent par
  l'EventBus, cadrage auto-fit sur le graphe, touche M pour la coupure rapide
  du son, premier geste = déverrouillage audio.

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
