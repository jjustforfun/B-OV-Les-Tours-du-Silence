# AGENTS.md — règlement de travail

Ce document s'impose à **tout agent IA intervenant sur ce dépôt, moi compris**,
et à tout contributeur humain. Il prime sur les habitudes personnelles et sur
les conventions d'autres projets. Le lire avant d'écrire une ligne.

---

## 1. Mission

**BӀOV : Les Tours du Silence** est un jeu de puzzle contemplatif en 3D
isométrique : Turpal gravit des tours vainakhs à la géométrie impossible dans
le Caucase tchétchène, accompagné de Borz, un loup de pierre, et reconstruit
les chemins entre les tours en retrouvant les six vertus du Nokhchalla.

Cinq piliers, repris de `brief.yaml`, qui arbitrent chaque décision :
**Élégance** (chaque image doit pouvoir servir de fond d'écran) · **Eurêka**
(le joueur se sent brillant, jamais bête) · **Silence habité** (le son raconte
autant que l'image) · **Dignité** (une culture montrée avec respect et
tendresse) · **Fluidité** (60 fps, zéro friction, sur tous les écrans).

---

## 2. Sources de vérité

Par ordre de priorité décroissante :

| Rang | Source             | Portée                                                                                                                            |
| ---- | ------------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| 1    | **`brief.yaml`**   | Spécification faisant autorité. Figée à l'octet près (ADR-020), jamais modifiée par un agent                                      |
| 2    | **`docs/*.md`**    | Conception détaillée : GDD, STORY, ART_DIRECTION, AUDIO, CONTROLS, ARCHITECTURE, LEVEL_DESIGN, PERFORMANCE, CULTURE, ANDROID_PORT |
| 3    | **`DECISIONS.md`** | Décisions d'architecture actées (ADR)                                                                                             |
| 4    | **`tasks.md`**     | Plan de chantier, état d'avancement                                                                                               |

**En cas de conflit entre deux sources : tu t'arrêtes et tu demandes.**
Tu ne tranches pas seul, tu ne « concilies » pas discrètement, tu n'écris pas
de code en attendant. Tu poses la question en citant les deux passages
contradictoires et la décision que tu recommandes.

La seule exception : une **ambiguïté de détail** sans conséquence
d'architecture. Tu choisis alors l'option la plus élégante et la plus
maintenable, tu l'appliques, et tu la justifies — en commentaire si c'est
local, dans un ADR si cela engage la suite.

---

## 3. Boucle de travail obligatoire

```
lire tasks.md
   → choisir UNE tâche (une seule)
      → coder
         → pnpm check
            → tester visuellement
               → mettre à jour tasks.md + CHANGELOG.md (+ DECISIONS.md si besoin)
                  → commit
```

Règles de la boucle :

1. **Une tâche à la fois.** Pas de « pendant que j'y suis ». Ce qu'on découvre
   en chemin s'ajoute à `tasks.md`, pas au commit en cours.
2. **`pnpm check` est le juge** : lint → typecheck → tests → build → budget de
   bundle. Rouge = on corrige avant tout le reste, sans exception.
3. **Tester visuellement n'est pas facultatif.** Un code qui compile n'est pas
   un jeu qui tourne. `pnpm dev`, on regarde, on interagit, aux deux viewports
   de référence (§ 11).
4. **La documentation fait partie de la tâche**, pas d'un ménage ultérieur.
5. **Commit à la fin de chaque tâche**, jamais au milieu, jamais après trois.
6. Le compte rendu suit le format du § 12.

---

## 4. Conventions de code

- **TypeScript strict.** `any` est **interdit** — utiliser `unknown` et
  affiner. La seule dérogation est une frontière de type non maîtrisée (API
  externe mal typée), obligatoirement accompagnée d'un commentaire
  `// any justifié : <raison>` sur la ligne précédente.
- **Une classe par fichier**, portant le nom du fichier. Les fonctions et
  types utilitaires qui n'existent que pour cette classe peuvent
  l'accompagner ; une seconde classe exportée ouvre un second fichier.
- **Nommage** : `PascalCase` pour les classes, types et interfaces ;
  `camelCase` pour tout le reste ; `SCREAMING_SNAKE_CASE` pour les constantes
  de `config.ts`. Fichiers de classe en `PascalCase.ts`, modules de fonctions
  en `camelCase.ts`.
- **Imports via les alias** (`@core/…`, `@world/…`, `@render/…`, …). Un
  `../../..` dans un import est un bug de rangement.
- **Pas de logique de jeu dans le rendu.** Trois couches strictement
  séparées : **simulation** (`core/`, `world/`, `entities/` — pure, testable,
  sans WebGL), **rendu** (`render/`, `fx/` — ne décide rien), **entrée**
  (`input/` — traduit des gestes en intentions, ne connaît pas le gameplay).
  Si `render/` importe une règle de jeu, l'architecture est fausse.
- **Communication entre systèmes via l'EventBus**, typé par une union
  d'événements (`GameEvents` dans `core/EventBus.ts` ; `InputEvents` pour
  l'entrée). Un nouvel événement s'ajoute à l'union — jamais de chaîne libre,
  jamais de `emit('quelquechose')` non déclaré.
- **Discipline mémoire GPU.** Toute `geometry`, `material` ou `texture` créée
  doit être libérée au déchargement du niveau. Toute suppression d'objet passe
  par `utils/dispose.ts` (`disposeObject` parcourt le sous-arbre et libère
  aussi les textures des matériaux). three ne libère rien tout seul.
- **Zéro allocation dans la boucle de jeu.** Pas de `new Vector3()`, pas de
  littéral d'objet, pas de `.map()` par image : `Vector3`/`Quaternion`
  temporaires réutilisés en champs privés, `utils/pool.ts` pour le reste. Un
  hoquet de ramasse-miettes de 12 ms se voit à l'écran.
- **Aucun nombre magique.** Toute constante de gameplay, de rythme ou de
  budget vit dans `config.ts` (`GRID`, `CAMERA`, `PACING`, `PERF`,
  `QUALITY_PRESETS`) — pour qu'un game designer puisse l'ajuster sans lire
  de code.
- **En-tête de fichier obligatoire** : un commentaire de bloc qui dit le
  _rôle_ du fichier et, s'il s'agit d'un squelette, son _intention_.
- **Langue** : commentaires et documentation en français ; identifiants en
  anglais, sauf le vocabulaire propre au jeu (`Turpal`, `Borz`, `virtue`,
  `nokhchalla`, `pondar`).

---

## 5. Commits

**Conventional Commits**, vérifiés automatiquement par le hook `commit-msg`
(`scripts/check-commit-msg.mjs`) :

```
<type>(<portée facultative>): <sujet, 90 caractères max>
```

| Type       | Usage                                                              |
| ---------- | ------------------------------------------------------------------ |
| `feat`     | Nouvelle fonctionnalité de jeu                                     |
| `fix`      | Correction de bug                                                  |
| `perf`     | Optimisation mesurée (donner le chiffre avant/après dans le corps) |
| `refactor` | Restructuration sans changement de comportement                    |
| `docs`     | Documentation, ADR, brief, rapports                                |
| `chore`    | Outillage, dépendances, configuration                              |
| `test`     | Tests ajoutés ou corrigés                                          |
| `art`      | Direction artistique : modèles, matériaux, palettes, animations    |
| `audio`    | Son : musique, ambiances, effets, mixage                           |

Exemples : `feat(world): rotation de tour recâblant le NavGraph` ·
`art(sky): palette crépusculaire du chapitre 4` ·
`perf(fx): brume en 2 quads au lieu de 800 particules (14 ms → 3 ms)`.

Le corps du commit explique **pourquoi**, pas _quoi_ — le diff dit déjà quoi.

---

## 6. Performance — règles dures

Les budgets de `docs/PERFORMANCE.md` sont contraignants, pas indicatifs :
bundle initial ≤ 1,5 Mo gzip (vérifié en CI), ≤ 120 draw calls, ≤ 150 k
triangles, ≤ 6 ms CPU et ≤ 8 ms GPU par image, 60 fps sur Android milieu de
gamme 2021 et iPhone 11.

S'y ajoutent six règles non négociables :

1. **DPR plafonné à 2** (1,0 en qualité basse). Le fillrate coûte au carré.
2. **Instancing obligatoire** pour tout élément répété : blocs de pierre,
   oiseaux, particules, marches. Un `InstancedMesh`, pas cinquante `Mesh`.
3. **Aucune shadow map dynamique sur mobile.** L'occlusion y passe par de
   l'**AO de sommets** et des **ombres blob**. La règle est appliquée par le
   code (`Quality.settings` force `shadows: false` si le profil est mobile,
   ADR-022) et vérifiée par un test unitaire — ne pas la contourner.
4. **Textures en KTX2** (Basis, compression GPU native) ou **WebP** à défaut.
   Jamais de PNG ni de JPEG livrés au moteur.
5. **Audio en OGG Vorbis, avec AAC (`.m4a`) en repli** pour Safari/iOS. Tout
   son effectivement livré en fichier double donc son format ; les sons
   synthétisés par Tone.js (la règle par défaut, ADR-007) échappent au sujet.
6. **Toute optimisation se mesure.** Un commit `perf` sans chiffre avant/après
   n'est pas une optimisation, c'est une conviction.

---

## 7. Qualité visuelle

Toute nouvelle scène, tout nouveau niveau, tout nouvel effet respecte
`docs/ART_DIRECTION.md`. Quatre points sont vérifiés à chaque revue :

| Exigence                | Ce qui est attendu                                                                                                                                                                                             |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Palette du chapitre** | Les couleurs viennent de la palette du chapitre concerné. La braise (`#d9a441`) ne décore jamais : elle signale le vivant ou l'actionnable                                                                     |
| **Brouillard**          | Toute scène a son `FogExp2` calé sur la palette de ciel. Sans brume, pas d'échelle et pas de séparation des plans                                                                                              |
| **Rim light**           | Un liseré de lumière froide détache les silhouettes du fond. C'est ce qui rend Turpal lisible alors qu'il fait 1/20 de l'écran                                                                                 |
| **AO de sommets**       | L'occlusion ambiante est cuite dans les sommets de la géométrie de pierre. Gratuite à l'exécution, indispensable pour asseoir les volumes — et obligatoire sur mobile où l'ombre dynamique est interdite (§ 6) |

Test de validation d'un modèle : **sa silhouette doit être lisible en noir sur
blanc à 64 pixels de haut**.

---

## 8. Culture

`docs/CULTURE.md` fait foi et est contraignant. En résumé opérationnel :

- **Aucune imagerie de guerre.** Ni ruine de bombardement, ni arme, ni
  uniforme, ni destruction. Les tours sont « fracturées » au sens
  **géométrique** — chemins disjoints, jamais éboulis (ADR-021). Vocabulaire
  proscrit : ruines, débris, effondrement, destruction.
- **Aucun symbole politique.** Ni drapeau, ni emblème, ni frontière, ni
  référence à un État, à un conflit ou à une période politique.
- **Aucune caricature.** Turpal est digne, adulte, silencieux. Les anciens
  sont respectés. Aucun personnage n'est comique par son « exotisme ».
- **Aucune invention de fait culturel.** On ne « comble » pas un trou de
  connaissance par une supposition plausible. Si on ne sait pas, on écrit
  qu'on ne sait pas, et on marque `[À VÉRIFIER]`.
- **Tout mot tchétchène non vérifié est marqué `[À VÉRIFIER]`** — dans
  `src/i18n/ce.json`, dans le code et dans les docs. Aucune marque n'est levée
  sans validation explicite d'un locuteur natif, crédité au générique.
- Les proverbes du jeu sont des **textes originaux** écrits dans l'esprit du
  Nokhchalla. Ils ne sont jamais présentés comme des proverbes authentiques.

Si une personne issue de cette culture signale une gêne : **on change ou on
retire**. On ne défend pas une idée de jeu contre les gens qu'elle représente.

---

## 9. Portabilité Android

Le portage Capacitor n'est pas fait, mais rien ne doit le rendre coûteux
(`docs/ANDROID_PORT.md`, ADR-014) :

- **Tout** accès au stockage, à la vibration, au plein écran, au cycle de vie
  de l'application ou au wake lock passe par **`src/platform/Platform.ts`**.
  Un `localStorage` ou un `navigator.vibrate` ailleurs dans `src/` est un bug.
  Le stockage est **asynchrone** même sur web, parce que Capacitor l'est.
- **Chemins d'assets relatifs** (`./assets/…`). Vite est configuré avec
  `base: './'` : un chemin absolu casserait le chargement en `file://`.
- **Aucune dépendance à `window.*`, `document.*` ou `navigator.*` sans
  garde.** Vérifier l'existence avant usage (`typeof matchMedia === 'function'`,
  `'wakeLock' in navigator`, …) : le code doit pouvoir s'exécuter dans un
  worker, dans un test Node, et dans une WebView ancienne sans exploser.
- Aucune permission Android ne doit devenir nécessaire.

---

## 10. Interdits

| Interdit                                                 | Pourquoi                                                                                                                                       |
| -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| **Ajouter une dépendance sans ADR**                      | Chaque dépendance est un poids, une surface d'attaque et une dette de mise à jour. Elle se justifie par écrit, avec les alternatives examinées |
| **Supprimer ou désactiver un test pour le faire passer** | Un test rouge est une information. `.skip` sans ticket associé est interdit                                                                    |
| **Laisser un `console.log`**                             | Le lint autorise `console.warn`, `console.error` et `console.info` (diagnostics volontaires). `console.log` est un oubli, pas une intention    |
| **Committer du code qui casse `pnpm check`**             | Le hook `pre-push` le refuse ; le contourner avec `--no-verify` est une faute                                                                  |
| **Inventer un fait culturel**                            | Voir § 8. Une supposition plausible reste une invention                                                                                        |
| **Modifier `brief.yaml`**                                | C'est la spécification, pas un document de travail (ADR-020)                                                                                   |
| **Élargir le périmètre en silence**                      | Hors périmètre v1 : multijoueur, achats intégrés, publicités, éditeur de niveaux public                                                        |

---

## 11. Definition of Done d'une tâche

Une tâche n'est terminée que si **les six lignes sont vraies** :

- [ ] **Compile** — `pnpm typecheck` passe (strict, `noUncheckedIndexedAccess`,
      `exactOptionalPropertyTypes`).
- [ ] **Lint OK** — `pnpm lint`, zéro erreur **et zéro avertissement**.
- [ ] **Tests OK** — `pnpm test` passe ; toute logique pure ajoutée est
      couverte par un test.
- [ ] **60 fps en Chrome avec throttling CPU ×4**, mesurés au compteur de
      debug, pas estimés à l'œil.
- [ ] **Testé aux deux viewports de référence** : **390 × 844** (mobile
      portrait, cible iPhone) et **1920 × 1080** (desktop). Ce sont les deux
      profils Playwright `mobile-390x844` et `desktop-1920`.
- [ ] **Documenté** — `tasks.md` coché, `CHANGELOG.md` mis à jour, ADR écrit
      si la décision engage la suite, en-tête de fichier à jour.

La Definition of Done du **projet** est dans `brief.yaml` et reprise en tête
de `qa-report.md` ; elle ne se substitue pas à celle-ci.

---

## 12. Format de fin de tâche

Tout compte rendu de fin de tâche suit ce format, sans exception :

```
✅ Fait
   — ce qui a changé, en une ligne par point, du point de vue du joueur
     quand c'est possible

🧪 Testé
   — commandes lancées et leur résultat (chiffres, pas adjectifs)
   — vérifications visuelles effectuées, et aux quels viewports

⚠️ Risques
   — ce qui pourrait casser, ce qui n'a pas pu être vérifié, la dette
     assumée. « Aucun » est une réponse valable, mais rare et argumentée

➡️ Prochaine tâche
   — la suivante dans tasks.md, et pourquoi c'est celle-là
```
