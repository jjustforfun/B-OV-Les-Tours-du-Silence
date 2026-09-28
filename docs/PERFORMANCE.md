# PERFORMANCE — BӀOV : Les Tours du Silence

Cible : **60 fps** sur Android milieu de gamme 2021 et iPhone 11
(`brief.yaml`). Ces budgets ne sont pas des objectifs : ce sont des
**conditions de recevabilité** d'une tâche (`AGENTS.md` § 11).

---

## 1. Budgets

| Budget                  | Plafond                                          | Où c'est vérifié                                                          |
| ----------------------- | ------------------------------------------------ | ------------------------------------------------------------------------- |
| **Draw calls**          | **< 120**                                        | `debug/Stats.ts` en continu ; `PERF.maxDrawCalls`                         |
| **Triangles à l'écran** | **< 150 000**                                    | `debug/Stats.ts` ; `PERF.maxTriangles`                                    |
| **Mémoire GPU**         | **< 256 Mo**                                     | `renderer.info.memory` + onglet Mémoire ; `PERF.maxGpuMemory`             |
| **Bundle initial**      | **< 1,5 Mo gzip**                                | `scripts/check-bundle.mjs`, bloquant en CI. Actuel : **143,8 ko (9,8 %)** |
| **Chunk par niveau**    | **< 400 ko gzip**                                | `scripts/check-bundle.mjs` ; `PERF.maxLevelChunkGzip`                     |
| **Time-to-interactive** | **< 3 s en 4G** (Slow 4G : 1,6 Mbps, RTT 150 ms) | Lighthouse mobile ; `PERF.maxTimeToInteractiveMs`                         |
| CPU par image           | ≤ 6 ms                                           | Profileur Chrome                                                          |
| GPU par image           | ≤ 8 ms                                           | `EXT_disjoint_timer_query` en debug                                       |
| Allocations par image   | **0**                                            | Onglet Mémoire : la dent de scie du GC doit être plate                    |
| Lighthouse              | PWA ≥ 90, Performance ≥ 85                       | Definition of Done                                                        |

Un budget dépassé **bloque** la tâche : on optimise, ou on retire du contenu.

---

## 2. Qualité adaptative (ADR-013)

`guessInitialTier()` (type de pointeur, taille d'écran, `hardwareConcurrency`)
puis mesure du fps réel sur une fenêtre glissante de **3 s**, hystérésis
**48 / 58 fps**.

| Réglage         | low  | medium                 | high              |
| --------------- | ---- | ---------------------- | ----------------- |
| Pixel ratio max | 1,0  | 1,5                    | 2,0               |
| Ombres          | non  | 1024 px (desktop)      | 2048 px (desktop) |
| Post-processing | non  | bloom + vignette + LUT | + SSAO + SMAA     |
| Particules      | 35 % | 70 %                   | 100 %             |

**Règle dure** : aucune shadow map dynamique sur mobile, quel que soit le
tier, **même en choix manuel** (ADR-022, verrouillée par test unitaire).
L'occlusion mobile repose sur l'AO de sommets et les ombres blob — deux
techniques à coût d'exécution nul.

---

## 3. Techniques d'optimisation

### Géométrie et rendu

| Technique                | Détail                                                                                                                              | Gain visé                             |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| **Instanciation**        | Une `InstancedMesh` par famille de blocs (mur, marche, dalle, gradin de toit). Un niveau entier = 6 à 10 draw calls d'architecture. | −90 % de draw calls                   |
| **Fusion des statiques** | Ce qui ne bouge jamais est fusionné en une géométrie par matériau à la construction.                                                | −30 draw calls                        |
| **Matériaux mutualisés** | Une seule `DataTexture` de rampe toon pour tout le jeu, quelques matériaux par niveau.                                              | Moins de changements d'état GPU       |
| **AO de sommets**        | Cuite au build du niveau, aucune passe d'écran.                                                                                     | −2 à −4 ms/image vs SSAO              |
| **Ombres blob**          | Quad texturé instancié sous les personnages.                                                                                        | vs shadow map : −3 à −6 ms sur mobile |
| **Pas de PBR**           | Ni IBL, ni normal maps, ni metalness/roughness.                                                                                     | Fragment shader court                 |
| **Frustum tenu**         | Le niveau tient dans le cadre (ADR-002) : pas de culling sophistiqué, mais rien de superflu hors champ.                             | —                                     |
| **Pixel ratio plafonné** | Le fillrate croît au carré : 2,0 est un plafond, pas une cible.                                                                     | −40 % de fillrate à 1,5               |
| **PostFX fusionné**      | `pmndrs/postprocessing` compile les effets en **un** fragment shader (ADR-009).                                                     | vs EffectComposer : −3 passes         |

### Mémoire et allocations

| Technique                      | Détail                                                                                                                                                                              |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Pools et buffers**           | Projections en tableaux typés, pool de particules, matrices, vecteurs, options d'émission et snapshots d'événements réutilisés ; aucune création d'objet dans les boucles auditées. |
| **Zéro allocation récurrente** | `ParticlePool.update()` calcule le damping en scalaires, `GoldenTrail` écrit sa tête dans trois champs, et la `MediaQueryList` système est mise en cache.                           |
| **`dispose()` systématique**   | Les propriétaires sont idempotents ; `utils/dispose.ts` déduplique géométries, matériaux et textures, y compris les textures de uniforms, tout en préservant le cache toon partagé. |
| **Textures**                   | Aucune pour l'architecture (vertex colors). Les rares textures (UI, LUT) sont en **KTX2** (repli WebP), ≤ 48 Mo au total.                                                           |
| **Audio**                      | 100 % synthétisé (ADR-007) : 0 octet d'échantillon dans le bundle initial.                                                                                                          |

### Chargement

| Technique                     | Détail                                                                                                                                 |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| **Code splitting par niveau** | 8 chunks `level-XX`, import dynamique (ADR-010).                                                                                       |
| **Préchargement du suivant**  | Pendant qu'on joue le chapitre N, le N+1 est téléchargé en `requestIdleCallback`.                                                      |
| **Vendors séparés**           | `vendor-3d` (three + postprocessing), `vendor-audio` (tone), `vendor-tween` (gsap). Tone et GSAP ne sont chargés qu'au premier besoin. |
| **Loader CSS pur**            | Aucun JS de rendu avant le premier octet utile ; `index.html` autoportant.                                                             |
| **Service worker**            | Précache du shell (25 entrées), niveaux en `stale-while-revalidate` : le jeu est jouable hors ligne.                                   |
| **Fontes**                    | woff2 sous-ensemblées latin + cyrillique, `font-display: swap`, ≤ 60 ko.                                                               |

### Formats d'assets imposés (`AGENTS.md` § 6)

| Type              | Format principal     | Repli            | Raison                                                         |
| ----------------- | -------------------- | ---------------- | -------------------------------------------------------------- |
| Textures          | **KTX2** (Basis)     | WebP             | Compressé côté GPU, décodage instantané, mémoire divisée par 4 |
| Modèles           | **glTF 2.0 + Draco** | —                | Standard, compact, chargeur officiel                           |
| Audio (exception) | **OGG Vorbis**       | **AAC (`.m4a`)** | Safari et iOS ne lisent pas l'OGG                              |
| Interface         | **SVG**              | —                | Net à tout DPR, quelques centaines d'octets                    |

---

## 4. Procédure de profilage

À exécuter **avant de déclarer une tâche terminée** (`AGENTS.md` § 11).

### 4.1 Desktop, budget CPU

1. `pnpm build && pnpm preview` — **toujours profiler un build de
   production** : en dev, Vite sert des modules non optimisés et les chiffres
   ne veulent rien dire.
2. Chrome DevTools → **Performance** → throttling **CPU ×4** (simule le
   mobile milieu de gamme) → enregistrer 20 s de jeu réel.
3. Lire : _Scripting_ ≤ 6 ms/image, _Rendering_ + _Painting_ stables, aucune
   longue tâche > 50 ms, et **surtout** : la courbe mémoire doit être plate
   (une dent de scie = allocations par image).
4. Vérifier le compteur `debug/Stats.ts` : fps, ms, draw calls, triangles.

### 4.2 GPU

1. `?debug=gpu` active les requêtes `EXT_disjoint_timer_query`.
2. Comparer : scène seule / + ombres / + postFX. Chaque poste doit tenir dans
   sa part des 8 ms.
3. Si le GPU sature : baisser le pixel ratio **avant** de couper un effet —
   c'est le levier le plus rentable et le moins visible.

### 4.3 Mobile réel (obligatoire, non remplaçable par l'émulation)

1. `pnpm dev --host` (`allowedHosts: true`, ADR-019) puis ouvrir l'URL réseau
   sur le téléphone.
2. Chrome Android → `chrome://inspect` depuis le desktop → Performance.
3. Jouer **10 minutes d'affilée** : on cherche la chute de fps due à la
   **chauffe**, invisible sur un test de 30 s.
4. Vérifier que la qualité adaptative descend d'un cran sans à-coup visible.

### 4.4 Chargement

1. Lighthouse mobile, mode navigation privée, throttling Slow 4G.
2. Seuils : **PWA ≥ 90**, **Performance ≥ 85**, TTI < 3 s.
3. `pnpm check` → `scripts/check-bundle.mjs` affiche le détail du bundle
   initial et **échoue** si un chunk de niveau y retombe.

### 4.5 Fuites mémoire

Préflight automatisable, sans WebGL :

1. `pnpm vitest run tests/unit/lifecycle.test.ts` doit valider 16 transitions
   `LevelLoader`, 10 cycles `LevelRuntime`, l'unicité des événements `dispose`,
   la stabilité des abonnements et l'annulation des timers FX.
2. Ce test ne prouve pas l'état des caches internes du pilote et ne remplace
   donc jamais la suite navigateur.

Validation WebGL obligatoire :

1. Charger le chapitre 1, forcer un rendu, puis noter
   `renderer.info.memory.geometries` et `renderer.info.memory.textures`.
2. Effectuer 5 allers-retours et au moins 10 changements de chapitre, en
   forçant un rendu après chaque couture, puis revenir au chapitre 1.
3. Lancer ensuite cinq minutes de jeu et enregistrer la courbe du tas dans
   Chrome DevTools.
4. Les compteurs doivent **revenir à leur valeur initiale** et la courbe ne
   doit présenter aucune croissance de fond. Sinon, un `dispose()` manque —
   c'est bloquant (Definition of Done).

---

## 5. Journal des mesures

| Date       | Contexte                          | Bundle initial gzip | Draw calls | Triangles | fps          |
| ---------- | --------------------------------- | ------------------- | ---------- | --------- | ------------ |
| 2026-09-27 | Scaffold, scène minimale (1 cube) | 143,8 ko (9,8 %)    | 2          | ~1 k      | 60 (desktop) |

À compléter à chaque fin de phase.
