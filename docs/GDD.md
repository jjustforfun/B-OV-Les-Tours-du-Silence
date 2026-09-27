# GDD — BӀOV : Les Tours du Silence

Document de game design. Ce qui est écrit ici est **exécutable** : chaque
mécanique renvoie à son fichier, à son événement et à ses constantes.
Références normatives : `brief.yaml` (autorité, ADR-020), `AGENTS.md`,
`DECISIONS.md`.

---

## 1. Boucle de jeu

```
        ┌──────────────────────────────────────────────────────┐
        │                                                      │
   OBSERVER ──► MANIPULER ──► DÉCOUVRIR L'ILLUSION ──► AVANCER ─┴─► ÊTRE RÉCOMPENSÉ
   (la caméra   (glisser,     (deux chemins se        (Turpal      (accord, lumière,
    est fixe :   tourner,      superposent à           marche)      proverbe)
    tout est     appuyer)      l'écran)
    visible)
```

| Temps | Phase                    | Ce que fait le joueur                                      | Ce que fait le jeu                                                                                                                                   | Durée typique                  |
| ----- | ------------------------ | ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| 1     | **Observer**             | Il lit l'image. Rien ne bouge, rien ne presse.             | La caméra est fixe (ADR-002), la composition dit où regarder : la braise `#d9a441` est la **seule couleur chaude**, donc la seule chose actionnable. | 5–30 s                         |
| 2     | **Manipuler**            | Il glisse une roue, pousse un bloc, fait pivoter une tour. | Le mécanisme bouge lentement (`PACING.mechanismDurationMs = 900 ms`) : on voit l'architecture penser.                                                | 1–3 s                          |
| 3     | **Découvrir l'illusion** | Il reconnaît que deux bords se rejoignent **à l'écran**.   | `auditIllusions()` a validé l'alignement (≤ 6 px) ; `NavGraph` ouvre l'arête illusoire.                                                              | l'instant « eurêka »           |
| 4     | **Avancer**              | Il tape sur la destination.                                | A\* (`findPath`) ; si le monde change en route, arrêt au dernier nœud sûr, jamais de chute (ADR-005).                                                | 3–8 s                          |
| 5     | **Être récompensé**      | Il souffle.                                                | Accord ascendant, pulsation dorée le long du chemin, vibration `snap`, couche de musique en plus.                                                    | 1,6 s (`PACING.celebrationMs`) |

**Règles invariables de la boucle** (issues de `brief.yaml`) : aucune mort,
aucun chrono, aucun score, aucun game over, aucune ressource. La seule
pression est la curiosité.

---

## 2. Mécaniques

Toutes implémentent l'interface `Mechanism` (`src/world/mechanisms/Mechanism.ts`) :
`actuate(amount?)`, `update(ctx, delta)`, `applyToGraph(graph)`, `dispose()`.
Chacune, sans exception : **affordance visible**, **mouvement lent**,
**impossible d'enfermer le joueur**, **signature sonore unique**.

### 2.1 Déplacement — tap-to-move sur le NavGraph

|                     |                                                                                                                                                                                                                                                                                                                                                    |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Fichiers**        | `src/input/PointerInput.ts` → `src/world/Pathfinder.ts` → `src/entities/player/Turpal.ts`                                                                                                                                                                                                                                                          |
| **Fonctionnement**  | Tap/clic → raycast sur les surfaces marchables → nœud le plus proche (`NavGraph.nearest`, tolérance élargie sur mobile) → `findPath()` → Turpal suit la polyligne à `PACING.walkSpeed = 2,1` cellules/s. Chaque nœud atteint applique son vecteur `up` (ADR-004). Si une arête disparaît pendant la marche : `trimPathToSafe()` puis arrêt propre. |
| **Feedback visuel** | Marqueur doux à l'arrivée : un anneau de 0,4 unité qui s'ouvre puis s'efface (420 ms, `expo.out`). Le chemin retenu s'éclaire d'un liseré `#e8e0d2` à 20 % pendant 300 ms. Si le nœud visé est inatteignable : **aucun message**, le marqueur se dissout simplement (180 ms) — on ne dit jamais « non » au joueur.                                 |
| **Feedback sonore** | `sfx.step` par pas, timbre selon la surface (pierre / herbe / neige / bois), hauteur variée de ±2 demi-tons pour ne jamais sonner mécanique. Tap validé : `uiTap`, très sec, −18 dB.                                                                                                                                                               |
| **Exemple**         | Prologue : le joueur tape la porte de la tour. Turpal traverse la cour en 6 s, s'arrête au pied de la fente. Rien d'autre à faire ; c'est l'apprentissage du tap.                                                                                                                                                                                  |

### 2.2 Rotator — manivelle ou roue de pierre

|                     |                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Fichier**         | `src/world/mechanisms/Rotator.ts`                                                                                                                                                                                                                                                                                                                                                                                                                             |
| **Fonctionnement**  | Glisser tangentiellement sur la roue la fait tourner en suivant le doigt (1:1). Au relâchement, **aimantation au multiple de 90°** le plus proche (`gsap`, `expo.out`, 900 ms). Une **résistance** est simulée : l'angle suit le doigt à 0,85× dans les 15 premiers degrés d'un cran, puis 1,0× — la pierre « décolle » avant de céder. À chaque cran franchi : `NavGraph.setMechanismState(id, angle)` → les arêtes conditionnelles s'ouvrent ou se ferment. |
| **Feedback visuel** | Poussière fine au démarrage de la rotation (12 particules, `fx/Particles.ts`). La roue porte une spirale gravée qui **s'illumine en braise** pendant la manipulation et retombe à froid 600 ms après. Les segments de chemin qui vont se connecter reçoivent un liseré chaud **avant** le verrouillage : le joueur anticipe, c'est là que naît l'eurêka.                                                                                                      |
| **Feedback sonore** | Craquement de pierre continu (bruit brun filtré, gain proportionnel à la vitesse angulaire) **plus un clic « pondar »** à chaque cran : `PondarSynth.pluck()` joue la **note suivante de la gamme du chapitre**. Manipuler devient donc jouer de la musique (voir `docs/AUDIO.md` § 4).                                                                                                                                                                       |
| **Exemple**         | Ch.1 : une roue à quatre positions oriente une passerelle vers les quatre points cardinaux. Trois positions ouvrent le chemin du voyageur, une seule ouvre celui de Turpal — et elle n'est atteignable qu'après avoir servi le voyageur.                                                                                                                                                                                                                      |

### 2.3 Slider — bloc sur rail

|                     |                                                                                                                                                                                                                                                                                                                                                   |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Fichier**         | `src/world/mechanisms/Slider.ts`                                                                                                                                                                                                                                                                                                                  |
| **Fonctionnement**  | Course rectiligne bornée (`params.axis`, `params.min`, `params.max`), en unités de grille. Le bloc **suit le doigt en direct** (projection du geste sur l'axe du rail) et s'aimante à l'unité entière au relâchement (280 ms). Turpal peut être **porté** par le bloc : s'il se tient sur un nœud enfant du slider, son nœud se déplace avec lui. |
| **Feedback visuel** | Le rail est visible en creux dans la pierre, avec deux butées marquées. Pendant le glissement, une **ombre blob** s'étire sous le bloc. À l'arrivée en butée, un micro-rebond de 2 % (60 ms).                                                                                                                                                     |
| **Feedback sonore** | `stoneSlide` : grondement bas, volume et filtre pilotés par la vitesse ; `stoneLock` à l'aimantation, un choc de bois sec — la même signature que tout emboîtement du jeu.                                                                                                                                                                        |
| **Exemple**         | Ch.2 : un tronçon de pont se déplace sur 3 cellules. Il ne peut relier qu'une rive à la fois : servir l'enfant d'abord coûte un aller-retour, et c'est exactement le sujet du chapitre.                                                                                                                                                           |

### 2.4 PressurePlate — dalle qui s'enfonce

|                     |                                                                                                                                                                                                                                                                                                                                                                                                     |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Fichier**         | `src/world/mechanisms/PressurePlate.ts`                                                                                                                                                                                                                                                                                                                                                             |
| **Fonctionnement**  | La dalle s'enfonce de 0,08 unité sous un poids : Turpal, Borz, ou un bloc de slider. Elle bascule un état booléen (`setMechanismState(id, 1 \| 0)`). Deux variantes : **maintenue** (état actif tant que le poids est présent) et **verrouillante** (reste enfoncée, définitivement). Une plaque verrouillante ne ferme **jamais** le dernier chemin disponible (garantie du validateur d'impasse). |
| **Feedback visuel** | Descente en 180 ms, `expo.out`. Un **signe solaire gravé** au centre s'allume en braise et pulse à 0,5 Hz tant que la dalle est active. Une fine ligne de lumière court sur le sol jusqu'au mécanisme commandé : **le lien de cause à effet est toujours montré**, jamais deviné.                                                                                                                   |
| **Feedback sonore** | Un « toc » grave amorti (−9 dB) à l'enfoncement ; une quinte tenue très douce (−22 dB) tant que la dalle est active ; un soupir descendant au relâchement.                                                                                                                                                                                                                                          |
| **Exemple**         | Ch.3 : la dalle ne s'enfonce que sous le poids conjugué de Turpal **et** de Borz, ce qui oblige à placer le loup avant d'avancer soi-même — première coopération.                                                                                                                                                                                                                                   |

### 2.5 TowerRotation — la tour entière pivote

|                     |                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Fichier**         | `src/world/mechanisms/TowerRotation.ts`                                                                                                                                                                                                                                                                                                                                                                                |
| **Fonctionnement**  | La rotation signature du jeu. Un sous-arbre entier (`Group` contenant géométrie **et** nœuds) pivote de 90° autour de son axe vertical, en 900 ms. Pendant l'animation, **toutes les entrées sont bloquées** (`isAnimating`) et la caméra ne bouge pas : c'est la tour qui tourne, jamais le monde (ADR-004). Après l'arrivée, les nœuds sont retransformés, puis les illusions **revalidées** par `auditIllusions()`. |
| **Feedback visuel** | La tour se soulève de 0,05 unité au démarrage, tourne, se repose — comme une pierre de meule. Le brouillard de hauteur souligne le mouvement. À l'arrivée, une **onde de poussière** part de la base (rayon 2,5 unités, 700 ms). Les escaliers nouvellement alignés reçoivent la traînée dorée.                                                                                                                        |
| **Feedback sonore** | Grondement profond (20–120 Hz) avec crescendo puis coupure nette, suivi d'un silence de 400 ms — **le silence fait partie du son**. Puis l'accord du chapitre, à la tierce supérieure.                                                                                                                                                                                                                                 |
| **Exemple**         | Ch.5 : les deux moitiés de la tour brisée sont deux rotations indépendantes. Elles ne se rejoignent que dans **une seule** des seize combinaisons, et cette combinaison n'est pas symétrique : l'une des moitiés doit « aller vers » l'autre.                                                                                                                                                                          |

### 2.6 GravityPath — marcher sur les murs

|                     |                                                                                                                                                                                                                                                                                                                                                                                |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Fichier**         | `src/world/mechanisms/GravityPath.ts`                                                                                                                                                                                                                                                                                                                                          |
| **Fonctionnement**  | Certains nœuds portent un `up` non vertical (`up: [0, 0, 1]` pour une paroi, `[0, -1, 0]` pour un plafond) : la gravité est une propriété du sol, pas du monde (ADR-004). Franchir une arête qui change de `up` déclenche une **bascule** : Turpal pivote sur l'arête (450 ms) pendant que la **caméra roule de 90°** autour de son axe de visée. Le monde, lui, ne bouge pas. |
| **Feedback visuel** | Pendant la bascule : très léger ralenti (facteur 0,7 sur 300 ms), rim light qui glisse autour de la silhouette, brume qui se réoriente. Une fois basculé, les indices d'orientation (ombre blob, poussière qui tombe) s'alignent sur le nouveau `up` — sans quoi le joueur perd le nord.                                                                                       |
| **Feedback sonore** | Glissement filtré ascendant (500 ms) **plus inversion du champ stéréo** : le monde bascule aussi dans les oreilles. Le bourdon change de fondamentale (quarte descendante).                                                                                                                                                                                                    |
| **Exemple**         | Ch.6 : pour atteindre le sommet, il faut descendre le long d'une paroi extérieure, puis marcher sous une arche à l'envers. « Descendre pour monter » : la mécanique **est** la leçon d'humilité.                                                                                                                                                                               |

### 2.7 Borz, le loup de pierre

|                     |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Fichier**         | `src/entities/companion/Borz.ts`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| **Fonctionnement**  | Borz possède **son propre graphe de navigation** (nœuds tagués `borz`), qui recouvre partiellement celui de Turpal : il passe là où l'homme ne passe pas, et inversement. Trois usages : (1) on le déplace en tapant sur une destination de son graphe ; (2) **Turpal peut monter sur lui** — Borz devient alors un nœud mobile, et le chemin de Turpal se recalcule à chaque arrêt du loup ; (3) posé en travers d'une brèche, il **fait pont** : une arête conditionnelle `{ mechanism: 'borz', equals: <nodeId> }` s'ouvre. États : `waiting`, `following`, `carrying`, `watching`. |
| **Feedback visuel** | Yeux d'**ambre lumineux**, seule source de lumière chaude mobile du jeu (`Lighting.ts`, point light 0,6 d'intensité, rayon 3). Il tourne la tête vers Turpal quand celui-ci s'éloigne de plus de 4 unités. Quand il fait pont, les veines de sa pierre s'éclairent le long de son dos.                                                                                                                                                                                                                                                                                                 |
| **Feedback sonore** | Aucun aboiement, jamais. Un **grain de pierre** quand il marche, un souffle très bas (un seul cycle de respiration audible toutes les 8 s) quand il attend. Monter sur lui : un accord de quarte, chaud.                                                                                                                                                                                                                                                                                                                                                                               |
| **Exemple**         | Ch.4 : Borz traverse un pont trop étroit pour Turpal, va appuyer sur une dalle de l'autre côté du lac, puis revient s'allonger en travers de la brèche. **Il n'est jamais détruit, jamais blessé, jamais sacrifié.**                                                                                                                                                                                                                                                                                                                                                                   |

### 2.8 Illusions de perspective

|                     |                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Fichiers**        | `src/world/Illusion.ts` (détection + audit), `src/debug/NavGraphViz.ts` (visualisation)                                                                                                                                                                                                                                                                                                                                                                  |
| **Fonctionnement**  | En projection orthographique fixe (ADR-002), deux points éloignés en 3D peuvent se superposer à l'écran. Quand l'écart projeté est ≤ `ILLUSION_TOLERANCE_PX = 6`, une **arête illusoire** est créée : Turpal marche de l'un à l'autre, exactement comme dans un escalier de Penrose. Si la caméra bouge, l'arête est coupée. Le level designer vérifie ses alignements avec `auditIllusions()`, qui retourne la distance en pixels et la cause du rejet. |
| **Feedback visuel** | **Aucun marquage.** C'est la seule mécanique du jeu qui ne s'annonce pas : la révéler la détruirait. En revanche, au moment où Turpal **emprunte** la liaison, un très léger accroc de lumière parcourt les deux bords (120 ms) : confirmation _a posteriori_ que la magie était bien là.                                                                                                                                                                |
| **Feedback sonore** | Silence pendant la traversée — les pas continuent, imperturbables. C'est le calme de Turpal qui rend l'impossible ordinaire. Puis, à l'arrivée, une note isolée de pondar, une seule.                                                                                                                                                                                                                                                                    |
| **Exemple**         | Ch.0 : un escalier monte vers le vide. Depuis ce point de vue précis, sa dernière marche touche le seuil d'une porte située dix unités plus loin. Le joueur tape la porte ; Turpal y va. **Rien ne lui a dit que c'était possible.**                                                                                                                                                                                                                     |

---

## 3. Courbe d'apprentissage

Règle des trois temps, appliquée à chaque mécanique : **seule → combinée → détournée.**

| Mécanique     | Seule (introduction)            | Combinée                           | Détournée                                          |
| ------------- | ------------------------------- | ---------------------------------- | -------------------------------------------------- |
| Tap-to-move   | Ch.0 : une cour, une porte      | Ch.1 : deux personnages à conduire | Ch.3 : conduire quelqu'un **d'autre** à son rythme |
| Rotator       | Ch.1 : une roue, une passerelle | Ch.2 : rotator + slider            | Ch.5 : deux rotators dont l'un déplace l'autre     |
| Slider        | Ch.2 : un tronçon de pont       | Ch.3 : slider + dalle              | Ch.6 : le slider est le sol sous ses pieds         |
| PressurePlate | Ch.3 : Turpal + Borz            | Ch.4 : dalle à retardement         | Ch.7 : la dalle finale se déclenche toute seule    |
| TowerRotation | Ch.4 : la tour du lac           | Ch.5 : deux demi-tours             | Ch.6 : tour + bascule de gravité                   |
| GravityPath   | Ch.5 : une paroi courte         | Ch.6 : parcours complet à l'envers | Ch.7 : la gravité comme cadeau, sans énigme        |
| Borz          | Ch.3 : il appuie                | Ch.4 : il fait pont                | Ch.6 : il porte les autres, pas Turpal             |
| Illusion      | Ch.0 : une, évidente            | Ch.2–4 : une par salle             | Ch.5+ : l'illusion **est** la solution             |

Principes :

1. **Une seule mécanique nouvelle par chapitre** (règle dure, `docs/LEVEL_DESIGN.md`).
2. **Aucun tutoriel textuel.** L'introduction d'une mécanique se fait dans une
   pièce où **elle est la seule chose possible** : l'erreur est impossible,
   donc la compréhension est garantie.
3. La difficulté monte par **nombre d'états à tenir en tête**, jamais par
   dextérité ni par vitesse.
4. Chaque chapitre **réutilise** au moins une mécanique ancienne : sans cela,
   le joueur ne se sent jamais devenir compétent.

---

## 4. Système d'indices

Jamais de texte explicatif. Jamais de bouton « solution ». Les indices sont
**diégétiques** et se déclenchent sur l'inactivité — pas sur l'échec, qui
n'existe pas.

| Délai       | Déclencheur                                                     | Indice                                                                                                                                                        | Implémentation                              |
| ----------- | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| 0–90 s      | —                                                               | Rien. Le silence est le premier cadeau.                                                                                                                       | —                                           |
| **90 s**    | Aucune interaction avec un mécanisme (`PACING.hintGlowDelayMs`) | **Lueur subtile** sur l'élément utile : pulsation de la braise à 0,4 Hz, amplitude 12 %, sur les seuls gravures du mécanisme. Invisible si on ne cherche pas. | `fx/Celebrate.ts` → `glowHint(mechanismId)` |
| **180 s**   | Toujours rien (`PACING.hintGazeDelayMs`)                        | **Borz tourne la tête** vers la bonne direction et s'y avance d'un pas. Il ne montre pas la solution : il montre **où regarder**.                             | `Borz.state = 'watching'` + `lookAt(node)`  |
| Sur demande | Touche `H`, ou appui long de 1,2 s sur Borz                     | Passe immédiatement au niveau d'indice suivant.                                                                                                               | `InputAction = 'hint'`                      |

Règles : le compteur se réinitialise à **toute** interaction réussie ; les
indices ne s'empilent jamais (le second remplace le premier) ; ils
disparaissent en 900 ms dès que le joueur agit ; un indice ne pointe **jamais**
un secret optionnel.

---

## 5. Valorisation du joueur

> « Le joueur se sent brillant, jamais bête. » (pilier n° 2, `brief.yaml`)

**Aucun échec possible** : pas de mort, pas de chute, pas de chrono, pas de
score, pas d'état irrécupérable. Le seul retour négatif autorisé du jeu est
l'absence de récompense — et encore, elle dure moins d'une seconde.

### 5.1 Quand un chemin se connecte (micro-célébration, 1,6 s)

| Canal       | Effet                                                                                                                                                                                                       |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Son**     | Accord ascendant de trois notes au pondar (quarte + quinte), dans la gamme du chapitre, réverbération de vallée.                                                                                            |
| **Image**   | **Pulsation de lumière dorée** qui court le long du chemin nouvellement relié, du point de départ vers le point d'arrivée, à 8 unités/s (`fx/Celebrate.ts`). Les gravures traversées s'allument au passage. |
| **Toucher** | Vibration `snap` (`[14, 30, 10]` ms) sur mobile — assez brève pour être une caresse.                                                                                                                        |
| **Musique** | Une couche s'ajoute (`MusicSystem.setProgress`), en fondu de 6 s.                                                                                                                                           |

### 5.2 Fin de chapitre

1. Les tours du niveau **s'illuminent** une à une, de la plus lointaine à la
   plus proche (250 ms d'écart) ;
2. un **ancien bénit Turpal** : il pose la main sur son épaule, Turpal porte
   la main au cœur (`entities/npc/Elder.ts`) — la bénédiction n'a **aucun
   effet mécanique**, c'est le principe ;
3. un **proverbe s'ajoute au carnet** (`ui/ProverbBook.ts`), sur voile
   translucide, 4 s à l'écran, sortie possible à tout moment ;
4. fondu de `PACING.chapterFadeMs = 1200 ms` vers la carte de chapitre.

### 5.3 Secrets optionnels — les aigles

- **Un aigle caché par chapitre** (8 au total), visible uniquement sous un
  alignement particulier ou après un détour gratuit.
- Le trouver révèle une **illustration** dans le carnet (un lieu réel de
  Tchétchénie, dessiné) et fait crier un aigle au loin.
- **Aucune conséquence mécanique, aucun pourcentage affiché, aucun succès.**
  La seule récompense de la curiosité est la beauté — c'est le contrat du jeu.
- Un aigle manqué reste accessible : le chapitre est rejouable depuis le carnet.

---

## 6. Les huit chapitres

| #   | Vertu               | Titre                      | Lieu                          | Mécanique introduite                     | Moment « wow »                                                                                                    | Palette                              |
| --- | ------------------- | -------------------------- | ----------------------------- | ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| 0   | _(prologue)_        | **Le Retour**              | L'aoul natal, à l'aube        | Tap-to-move + première illusion          | L'escalier qui monte vers le vide rejoint pourtant la porte ; Borz ouvre les yeux quand la main touche la pierre  | Aube rose et ardoise                 |
| 1   | Hospitalité         | **L'Hospitalité**          | Village d'Itum-Kale           | Rotator                                  | La passerelle orientée pour le voyageur révèle, en pivotant, le chemin de Turpal qu'on croyait perdu              | Ocre chaud et vert pâturage          |
| 2   | Parole donnée       | **La Parole donnée**       | Gorge de l'Argun              | Slider                                   | Le raccourci se referme lentement pendant que le pont promis s'assemble : on voit ce qu'on renonce à prendre      | Turquoise du torrent et gris schiste |
| 3   | Respect des anciens | **Le Respect des anciens** | Nécropole et tours de Nikaroy | PressurePlate + Borz coopératif          | L'architecture entière se **rabaisse** marche après marche pour épouser le pas de l'ancien                        | Sépia et or                          |
| 4   | Patience            | **La Patience**            | Lac Kezenoy-Am                | TowerRotation + mécanisme lent           | Le reflet dans l'eau n'est pas un reflet : c'est un second niveau, jouable, et la lune l'ouvre                    | Bleu nuit et argent lunaire          |
| 5   | Pardon              | **Le Pardon**              | La tour brisée                | GravityPath                              | Les deux moitiés pivotent l'une vers l'autre ; la fracture se referme **sans** qu'aucune pierre ne soit remplacée | Brun rouille et braise               |
| 6   | Humilité            | **L'Humilité**             | Neiges de Tebulosmta          | Gravité complète (descendre pour monter) | Le sommet s'atteint en marchant **sous** la montagne, la tête vers la vallée                                      | Blanc neige et bleu glacier          |
| 7   | _(épilogue)_        | **Le Chant revenu**        | Toute la vallée               | Aucune — on marche                       | Les huit tours s'allument ensemble, les quatre couches de musique se referment, la vallée est habitée             | Or et toutes les teintes réunies     |

Durée visée : **5 à 12 min par chapitre**, 60 à 90 min au total
(`brief.yaml`). Codes hex de chaque palette : `docs/ART_DIRECTION.md` § 3 et
`src/render/Palettes.ts`.

---

## 7. Ce que le jeu ne fera jamais

| Interdit                             | Raison                                                                   |
| ------------------------------------ | ------------------------------------------------------------------------ |
| Tuer, faire chuter, faire échouer    | `no_death`, `no_timer`, `no_score`                                       |
| Afficher un tutoriel écrit           | La compréhension se conçoit, elle ne se lit pas                          |
| Faire clignoter un objectif en rouge | Le rouge n'existe pas dans la palette ; la braise suffit                 |
| Compter les secrets trouvés          | Transformerait la curiosité en tâche                                     |
| Blesser ou sacrifier Borz            | Le lien ne se paie pas par une perte                                     |
| Faire s'effondrer une tour           | Les tours vainakhs sont des monuments réels (ADR-021, `docs/CULTURE.md`) |
