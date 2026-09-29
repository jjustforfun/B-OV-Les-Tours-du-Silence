# DECISIONS.md — Architecture Decision Records

Journal des décisions structurantes de **BӀOV : Les Tours du Silence**.
Une décision qui engage la suite et qui n'est pas ici n'existe pas.

**Modèle de chaque entrée** — Date / Statut · Contexte · Décision ·
Alternatives considérées · Conséquences.
Statut : `Proposé` | `Accepté` | `Remplacé par ADR-YYY`.

> **Note de renumérotation (2026-09-27).** Les ADR portaient d'abord des
> numéros à quatre chiffres (`ADR-0001`…). Ils ont été refondus dans la
> numérotation à trois chiffres ci-dessous, qui fait désormais seule
> autorité : **ADR-001 à ADR-014** couvrent les décisions de conception du
> jeu, **ADR-015 à ADR-029** les décisions d'outillage et de production.
> Toutes les références du dépôt ont été mises à jour.

**Index**

| #                                                                                          | Décision                                                | Statut  |
| ------------------------------------------------------------------------------------------ | ------------------------------------------------------- | ------- |
| [001](#adr-001--threejs-plutôt-que-babylonjs-playcanvas-ou-unity-webgl)                    | three.js plutôt que Babylon, PlayCanvas ou Unity WebGL  | Accepté |
| [002](#adr-002--caméra-orthographique-isométrique-fixe-par-scène)                          | Caméra orthographique isométrique fixe par scène        | Accepté |
| [003](#adr-003--navigation-par-graphe-de-nœuds-plutôt-que-navmesh)                         | Navigation par graphe de nœuds plutôt que navmesh       | Accepté |
| [004](#adr-004--un-vecteur--up--par-nœud)                                                  | Un vecteur « up » par nœud                              | Accepté |
| [005](#adr-005--a-recalculé-à-chaque-changement-détat-arrêt-au-dernier-nœud-sûr)           | A\* recalculé à chaque changement d'état                | Accepté |
| [006](#adr-006--personnage-v1-procédural-derrière-icharactermodel)                         | Personnage v1 procédural derrière `ICharacterModel`     | Accepté |
| [007](#adr-007--audio-procédural-tonejs-et-karplus-strong)                                 | Audio procédural : Tone.js et Karplus-Strong            | Accepté |
| [008](#adr-008--rendu-stylisé-toon-ramp-vertex-colors-ao-de-sommets)                       | Rendu stylisé : toon ramp, vertex colors, AO de sommets | Accepté |
| [009](#adr-009--post-processing-pmndrspostprocessing-dégressif)                            | Post-processing pmndrs dégressif                        | Accepté |
| [010](#adr-010--niveaux-décrits-en-typescript-chargés-en-lazy-import)                      | Niveaux en TypeScript, chargés en lazy import           | Accepté |
| [011](#adr-011--sauvegarde-locale-via-platformstorage)                                     | Sauvegarde locale via `Platform.storage`                | Accepté |
| [012](#adr-012--ui-en-htmlcss-superposée-au-canvas)                                        | UI en HTML/CSS superposée au canvas                     | Accepté |
| [013](#adr-013--qualité-adaptative-mesure-sur-3-secondes)                                  | Qualité adaptative mesurée sur 3 secondes               | Accepté |
| [014](#adr-014--portage-android-futur-via-capacitor-pwa-dabord)                            | Portage Android via Capacitor, PWA d'abord              | Accepté |
| [015](#adr-015--le-jeu-vit-à-la-racine-du-dépôt)                                           | Le jeu vit à la racine du dépôt                         | Accepté |
| [016](#adr-016--typescript-épinglé-en-59)                                                  | TypeScript épinglé en 5.9                               | Accepté |
| [017](#adr-017--eslint-plugin-import-retiré)                                               | `eslint-plugin-import` retiré                           | Accepté |
| [018](#adr-018--deux-tsconfig-le-jeu-et-loutillage)                                        | Deux `tsconfig` : le jeu et l'outillage                 | Accepté |
| [019](#adr-019--allowedhosts-true-en-développement)                                        | `allowedHosts: true` en développement                   | Accepté |
| [020](#adr-020--briefyaml-est-la-spécification-faisant-autorité)                           | `brief.yaml` fait autorité                              | Accepté |
| [021](#adr-021--des-tours--fracturées--jamais-en-ruine)                                    | Des tours « fracturées », jamais en ruine               | Accepté |
| [022](#adr-022--aucune-shadow-map-dynamique-sur-mobile)                                    | Aucune shadow map dynamique sur mobile                  | Accepté |
| [023](#adr-023--raccourcis-clavier-liés-aux-touches-physiques)                             | Raccourcis clavier liés aux touches physiques           | Accepté |
| [024](#adr-024--le-picking-se-fait-sur-la-projection-écran-des-nœuds-pas-sur-la-géométrie) | Picking par projection écran des nœuds                  | Accepté |
| [025](#adr-025--tonejs-chargé-après-le-premier-geste-gains-nominaux-en-décibels)           | Tone.js après le premier geste, gains en dB             | Accepté |
| [026](#adr-026--timelines-manuelles-pour-le--juice--pas-de-gsap)                           | Timelines manuelles pour le « juice », pas de gsap      | Accepté |
| [027](#adr-027--linterface-est-une-pile-décrans-dom-orchestrée-par-gameflow)               | Interface en pile DOM orchestrée par `GameFlow`         | Accepté |
| [028](#adr-028--géométrie-de-niveau-instanciée-acteurs-secrets-séparés-du-parcours)        | Géométrie instanciée, secrets hors du parcours          | Accepté |
| [029](#adr-029--les-états-narratifs-sont-des-conditions-monotones-du-navgraph)             | États narratifs monotones dans le NavGraph              | Accepté |

---

## ADR-001 : three.js plutôt que Babylon.js, PlayCanvas ou Unity WebGL

- **Date** : 2026-09-27 · **Statut** : Accepté

### Contexte

Le jeu doit tenir sous **1,5 Mo gzip au premier chargement**, tourner à
60 fps sur un Android milieu de gamme de 2021, se porter plus tard sur
Android via Capacitor, et reposer sur des techniques non standard :
projection isométrique stricte, illusions d'optique dépendant de la
projection écran, matériaux toon avec rampe, ombres remplacées par de l'AO
de sommets. Le moteur doit donc être **transparent** : on doit pouvoir
descendre au shader et au graphe de rendu sans se battre contre une
abstraction.

### Décision

**three.js** (r186), en imports nommés depuis le paquet npm, sans
surcouche de framework (pas de react-three-fiber).

### Alternatives considérées

| Option                          | Pourquoi écartée                                                                                                                                                                                                                                                                                                        |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Babylon.js**                  | Excellent moteur, mais conçu comme une plateforme complète (physique, GUI, inspecteur, système de matériaux riche). Le cœur minimal pèse nettement plus lourd que ce dont on a besoin, et nous n'utiliserions ni la physique, ni le GUI, ni le PBR. On paierait un moteur de jeu pour faire de la sculpture géométrique |
| **PlayCanvas**                  | Runtime léger et très bonnes performances, mais le confort réel vient de l'éditeur hébergé, qui déplace la source de vérité hors du dépôt Git. Incompatible avec notre doctrine « les niveaux sont des données versionnées » (ADR-010) et avec le travail d'agents sur un dépôt                                         |
| **Unity WebGL**                 | Disqualifié sur le poids : un build WebGL vide dépasse déjà largement le budget total, avec un temps de démarrage et une empreinte mémoire incompatibles du mobile milieu de gamme. Le portage Capacitor perdrait tout son sens (on passerait par un export Android natif)                                              |
| **WebGPU pur / moteur maison**  | Contrôle total mais coût de construction prohibitif, et WebGPU n'est pas encore garanti sur la cible iPhone 11 / Android 2021                                                                                                                                                                                           |
| **react-three-fiber sur three** | Ergonomie déclarative séduisante, mais impose React (poids, cycle de rendu) au-dessus d'un jeu qui n'a presque pas d'interface. L'UI est en DOM natif (ADR-012), le monde est impératif : la colle n'apporterait rien                                                                                                   |

### Conséquences

- On assume d'écrire nous-mêmes ce que d'autres moteurs offrent : boucle,
  machine à états, pooling, discipline de `dispose()` (AGENTS.md § 4).
- Le tree-shaking est notre allié : `vendor-3d` (three + postprocessing) pèse
  **133 ko gzip**, soit 9 % du budget initial.
- L'écosystème three (glTF, Draco, KTX2, pmndrs) reste disponible sans
  couplage : chaque pièce s'ajoute à la demande.
- Risque accepté : les montées de version de three cassent parfois des API.
  Mitigation : version épinglée, `pnpm check` en CI, aucune dépendance à des
  détails internes du renderer.

---

## ADR-002 : Caméra orthographique isométrique fixe par scène

- **Date** : 2026-09-27 · **Statut** : Accepté

### Contexte

Toute la mécanique du jeu repose sur des **coïncidences visuelles** : deux
points éloignés dans l'espace doivent pouvoir se toucher à l'écran pour que
Turpal passe de l'un à l'autre. Cette coïncidence n'est stable que si la
projection est orthographique et l'angle de vue constant : en perspective, le
recouvrement dépend de la distance et se défait au moindre mouvement.

### Décision

Caméra **orthographique**, azimut **45°**, élévation **35,264°**
(`atan(1/√2)`, isométrie véritable), **fixe pour une scène donnée**
(`src/render/CameraRig.ts`, constantes dans `config.ts`).

Les changements d'angle existent, mais ils sont **discrets, scénarisés et
par pas de 90°** : ils sont un événement de gameplay (le monde se réoriente),
jamais un contrôle libre confié au joueur.

En portrait, on n'incline pas la caméra : on élargit le champ vertical du
frustum (`CameraRig.setAspect`). Le cadrage change, jamais la géométrie
projetée — sinon les illusions se décaleraient d'un écran à l'autre.

### Alternatives considérées

| Option                                            | Pourquoi écartée                                                                                                                                                               |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Perspective à champ étroit**                    | Donne une impression d'isométrie mais les coïncidences dépendent de la profondeur : une illusion calée en gros plan se défait en plan large. Rend le level design invérifiable |
| **Caméra orbitale libre**                         | Détruit la mécanique : une illusion visible sous tous les angles n'est pas une illusion. C'est précisément l'erreur que Monument Valley évite                                  |
| **Isométrie 2:1 « pixel art »** (élévation ≈ 30°) | Plus flatteuse sur une grille de pixels, mais les cubes ne s'y projettent pas en hexagones réguliers : les raccords d'architecture impossible deviennent approximatifs         |
| **Angle variable par chapitre**                   | Possible, mais chaque angle demanderait de revalider toutes les illusions du chapitre. Le bénéfice esthétique ne vaut pas ce coût de production                                |

### Conséquences

- Les illusions sont **vérifiables automatiquement** : deux nœuds coïncident
  ou non, à moins de 6 px près (ADR-003).
- Le cadrage de chaque niveau se conçoit comme une composition d'image fixe —
  cohérent avec le pilier « chaque image doit pouvoir servir de fond d'écran ».
- Pas de culling par frustum sophistiqué à écrire : la scène tient dans le
  cadre.
- Contrainte de production : toute rotation scénarisée du monde impose de
  recalculer les arêtes illusoires à l'arrivée, jamais pendant l'animation.

---

## ADR-003 : Navigation par graphe de nœuds plutôt que navmesh

- **Date** : 2026-09-27 · **Statut** : Accepté

### Contexte

Turpal doit pouvoir marcher d'un escalier à un autre **parce qu'ils se
touchent à l'écran**, alors qu'ils sont à dix unités l'un de l'autre dans
l'espace. Il doit aussi pouvoir emprunter un passage qui n'existe que si un
rotateur est à 90°. Aucune de ces deux situations n'est représentable par une
surface de navigation calculée à partir de la géométrie : la géométrie ment,
c'est le sujet du jeu.

### Décision

Un **graphe de nœuds explicite** (`src/world/NavGraph.ts`) :

- les nœuds sont posés à la main dans les données du niveau, en coordonnées
  de grille entières ;
- les arêtes sont **bidirectionnelles par défaut**, avec un coût ;
- une arête peut être **conditionnelle** : elle n'est franchissable que si un
  mécanisme est dans un état donné. Cela s'écrit **dans les données**, pas
  dans le code :

  ```ts
  { from: 'quai', to: 'tour-nord', condition: { mechanism: 'R', equals: 90 } }
  ```

  `NavGraph.setMechanismState('R', 90)` réévalue toutes les arêtes qui
  dépendent de `R`. Une arête conditionnelle naît fermée si son mécanisme
  n'est pas dans le bon état ;

- une arête peut être **illusoire** : née d'une coïncidence à l'écran, elle
  est coupée dès que la caméra bouge.

Un **outil de debug vérifie l'alignement** : `auditIllusions()`
(`src/world/Illusion.ts`) projette les nœuds candidats et retourne, pour
chacun, la **distance projetée en pixels** et la raison du rejet
(`aligned` | `too-far` | `missing-projection`). Le seuil est
`ILLUSION_TOLERANCE_PX = 6`.

### Alternatives considérées

| Option                                    | Pourquoi écartée                                                                                                                                                                                                     |
| ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Navmesh (recast/detour ou équivalent)** | Calculé depuis la géométrie réelle, il ignore par construction les liaisons illusoires — qui sont l'essence du jeu. Il faudrait ensuite le « patcher » manuellement, c'est-à-dire revenir à un graphe, en plus lourd |
| **Grille 3D de voxels**                   | Simple, mais impose une topologie régulière et gaspille : nos niveaux sont des architectures creuses, où 95 % des cellules seraient vides. Et une liaison illusoire reste hors modèle                                |
| **Collisions physiques + raycast**        | Coûteux, non déterministe au pixel près, et fondamentalement inadapté : on ne veut pas savoir si Turpal _peut_ physiquement passer, mais si le joueur _voit_ qu'il peut passer                                       |
| **Illusions codées en dur par niveau**    | Fonctionne, mais chaque illusion devient du code à relire. Les données typées permettent la validation automatique et l'écriture par un level designer (ADR-010)                                                     |

### Conséquences

- Le `NavGraph` est **pur** (aucune dépendance à three) : 18 tests unitaires
  le couvrent, dont 5 pour les arêtes conditionnelles.
- Poser les nœuds à la main est un vrai coût de production ; il est compensé
  par `NavGraphViz` (visualisation) et `auditIllusions` (mesure).
- Une illusion mal calée n'est plus une découverte de playtest : c'est un
  chiffre dans un rapport.
- Dette assumée : un validateur « aucune impasse possible » reste à écrire
  (phase 2), qui explorera tous les états de mécanismes atteignables.

---

## ADR-004 : Un vecteur « up » par nœud

- **Date** : 2026-09-27 · **Statut** : Accepté

### Contexte

Les chapitres tardifs (« pardon », « humilité ») demandent que Turpal marche
sur un mur puis au plafond : ce qui était vertical devient le sol. La gravité
ne peut donc pas être une constante globale du monde.

### Décision

Chaque `NavNode` porte un **vecteur `up`** (`DEFAULT_UP = (0, 1, 0)`), qui
décrit la direction du « haut » quand on se tient dessus. Il s'écrit dans les
données du niveau (`up: [0, 0, 1]` pour une paroi) et Turpal l'adopte en
arrivant sur le nœud (`Turpal.applyUp`). **La gravité est une propriété du
sol, pas du monde.**

Corollaire de mise en scène : lors d'une bascule, **on fait pivoter la caméra
et le personnage, jamais le monde**. Faire tourner la scène entière donne la
nausée en 3D ; Monument Valley triche exactement ainsi.

### Alternatives considérées

| Option                                | Pourquoi écartée                                                                                                                                                                          |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Gravité globale commutée par zone** | Oblige à découper le niveau en volumes de gravité et crée des discontinuités aux frontières. Un nœud est déjà la bonne granularité                                                        |
| **Quaternion complet par nœud**       | Plus expressif (roulis compris), mais sur-spécifié : l'orientation autour de l'axe `up` se déduit de la direction de marche. Un vecteur suffit et reste lisible dans un fichier de niveau |
| **Rotation physique du monde**        | Coûteuse (tout le contenu bouge), mauvaise pour le confort visuel, et casse la stabilité des illusions (ADR-002)                                                                          |

### Conséquences

- `NavGraph.addNode()` accepte un `up` optionnel ; `LevelNodeDef.up` l'expose
  aux données. Deux tests unitaires verrouillent le comportement.
- Les animations devront tenir compte de l'orientation locale : un pas
  d'escalade sur un mur n'est pas un pas d'escalade au sol (phase 2).
- Les ombres blob devront être projetées selon le `up` du nœud, pas vers le
  bas absolu (phase 3).

---

## ADR-005 : A\* recalculé à chaque changement d'état, arrêt au dernier nœud sûr

- **Date** : 2026-09-27 · **Statut** : Accepté

### Contexte

Le joueur peut actionner un mécanisme **pendant que Turpal marche**. Le
chemin calculé une seconde plus tôt peut alors ne plus exister : une
passerelle a pivoté, une arête conditionnelle s'est refermée. Que fait le
personnage ?

### Décision

1. Le chemin est un **A\* déterministe** (`findPath`), recalculé à chaque
   changement d'état d'un mécanisme — les graphes font quelques centaines de
   nœuds, le calcul coûte moins de 0,1 ms, il n'y a aucune raison de
   l'amortir.
2. Si une arête disparaît devant lui, **Turpal s'arrête au dernier nœud
   sûr** : `trimPathToSafe()` tronque le chemin au dernier nœud encore
   atteignable, et `Turpal.revalidatePath()` repasse l'état à `idle`.

**Il ne tombe pas, il n'est pas téléporté, rien n'est perdu** — le joueur
relance le déplacement s'il le souhaite. C'est l'application directe de la
règle « aucune mort, aucune punition ».

### Alternatives considérées

| Option                                                       | Pourquoi écartée                                                                                                                              |
| ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------- |
| **Interdire d'actionner un mécanisme pendant la marche**     | La solution facile, et la pire : elle transforme une liberté en erreur de manipulation, et contredit le pilier « le joueur se sent brillant » |
| **Laisser Turpal finir son chemin**                          | Il traverserait le vide. Rompt le contrat visuel du jeu : ce qu'on voit est ce qui est                                                        |
| **Le faire tomber et le replacer**                           | Punition déguisée. Interdit par le brief (`no_death`)                                                                                         |
| **Recalcul incrémental (D\* Lite)**                          | Techniquement élégant, mais optimise un coût qui n'existe pas à cette échelle. Complexité gratuite                                            |
| **Replanifier automatiquement vers la destination initiale** | Tentant, mais le joueur a changé le monde : décider à sa place où il veut aller, c'est lui retirer la conclusion de son propre raisonnement   |

### Conséquences

- 6 tests unitaires couvrent `trimPathToSafe`, dont le cas « la coupure est
  derrière Turpal, elle ne le concerne plus ».
- Le rythme du jeu est protégé : aucune animation ne peut être interrompue
  par une téléportation.
- À câbler en phase 2 : chaque `Mechanism.applyToGraph()` devra appeler
  `revalidatePath` via l'EventBus.

---

## ADR-006 : Personnage v1 procédural, derrière `ICharacterModel`

- **Date** : 2026-09-27 · **Statut** : Accepté

### Contexte

Il faut un Turpal à l'écran **maintenant**, pour caler l'échelle, la vitesse
de marche, la lisibilité de la silhouette en isométrie et le cadrage. Mais un
modèle sculpté, riggé et animé est un travail long, qu'il serait absurde
d'engager avant que le gameplay soit figé — et qui devrait sans doute être
refait.

### Décision

**v1 procédurale** : `TurpalModel` assemble en code des primitives low-poly
(cylindres, capsules, boîtes, sphères) — tcherkesska anthracite, **12 gazyri
argent en deux rangées**, papakha gris clair, ceinture, bottes souples. Rig
implicite (le torse est un nœud animé), **animation procédurale** :
respiration au repos, balancement à la marche. Environ 600 triangles, **zéro
octet d'asset**.

Tout passe par l'interface **`ICharacterModel`** (`root`, `height`, `kind`,
`triangleCount`, `play`, `update`, `dispose`). La v2 chargera un GLB
(Blender, animations Mixamo retargetées) derrière la même interface, sans
modifier une ligne de `Turpal.ts`.

### Alternatives considérées

| Option                                 | Pourquoi écartée                                                                                                                                                                                    |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **GLB dès la v1**                      | Bloque le gameplay derrière un travail d'art de plusieurs jours, sur des proportions et une échelle non encore validées. Et impose tôt le pipeline Draco/KTX2                                       |
| **Capsule de substitution**            | C'était l'état précédent. Suffisant pour bouger, insuffisant pour juger : sans les gazyri ni la papakha, on ne peut pas évaluer la lisibilité de la silhouette, qui est le vrai risque en isométrie |
| **Sprite 2D façon Octopath**           | Beau, mais incompatible avec la rotation du monde (ADR-004) et avec les ombres projetées                                                                                                            |
| **Mixamo directement, sans interface** | Couple le gameplay à un format et à un squelette précis. L'interface coûte trente lignes et supprime ce couplage                                                                                    |

### Conséquences

- 6 tests unitaires : échelle 0,85 unité, budget de triangles, **présence des
  12 gazyri**, conformité à l'interface, stabilité de l'animation, libération
  mémoire.
- Le personnage est **modifiable par un développeur sans outil DCC** :
  itération en secondes pendant toute la phase de gameplay.
- La v2 GLB devra respecter la même hauteur (0,85) et le même point d'origine
  (aux pieds), sous peine de décaler tout le level design.
- Dette assumée : l'animation procédurale ne portera jamais la subtilité d'un
  pas réel. Elle est un jalon, pas une cible.

---

## ADR-007 : Audio procédural, Tone.js et Karplus-Strong

- **Date** : 2026-09-27 · **Statut** : Accepté · _(remplace l'ancien ADR-0006)_

### Contexte

Un jeu contemplatif d'une heure et demie a besoin de nappes longues et
d'ambiances qui ne bouclent jamais de façon audible. En fichiers audio, cela
représente plusieurs mégaoctets — contre un budget initial de 1,5 Mo. Par
ailleurs, la couleur sonore visée est celle du **dechig-pondar**, luth
tchétchène à trois cordes [À VÉRIFIER : orthographe, facture, technique de
jeu — à confirmer auprès d'une source tchétchène].

### Décision

Tout est **synthétisé à l'exécution** avec Tone.js :

- **Karplus-Strong** (`Tone.PluckSynth`) pour évoquer la corde pincée du
  pondar : excitation bruitée, ligne à retard, amortissement — c'est
  exactement le modèle physique d'une corde pincée, pour quelques lignes de
  code. C'est la « voix » de Turpal, qui ne parle pas ;
- **gammes modales** (ré/dorien), intervalles de quarte et de quinte, tempo
  implicite très lent (~48 BPM) ;
- **musique adaptative en couches** : `breath` (toujours), `stone` (un
  mécanisme bouge), `light` (résolution), fondus de 4 à 8 secondes ;
- ambiances (vent, rivière, oiseaux, pierre) en bruits filtrés à périodes
  premières entre elles, pour qu'aucun motif ne se répète ;
- **aucun asset audio lourd en v1**.

Garde-fou culturel : on emprunte une **couleur instrumentale**, jamais un
répertoire. Aucune mélodie traditionnelle existante n'est reproduite.

### Alternatives considérées

| Option                                     | Pourquoi écartée                                                                                                                                                                                                  |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Musique composée en fichiers (OGG/AAC)** | Qualité artistique supérieure, mais 3 à 8 Mo minimum, boucles perceptibles sur des sessions longues, et adaptativité coûteuse (fondus croisés entre pistes pré-mixées)                                            |
| **Échantillons réels de pondar**           | Le plus juste musicalement, mais pose une vraie question d'appropriation (quel enregistrement, quel interprète, quel droit ?) et alourdit le bundle. À reconsidérer en v2 **avec** un musicien tchétchène crédité |
| **Web Audio API brute**                    | Tone.js n'est qu'une couche d'ergonomie (transport, enveloppes, ordonnancement) pour ~45 ko gzip. L'écrire soi-même serait de la dette pure                                                                       |
| **Pas de musique, ambiance seule**         | Défendable pour un jeu du « silence », mais prive des trois couches adaptatives qui portent la dramaturgie                                                                                                        |

### Conséquences

- Le sound design devient un **travail de programmation** : il faut des
  itérations d'écoute, pas seulement des itérations de code.
- Le son démarre au premier geste du joueur (contrainte d'autoplay), avec un
  fondu d'entrée de 1,2 s.
- `public/assets/audio/` reste en place pour les exceptions (un souffle de
  vent enregistré) : chargées paresseusement, hors budget initial, en **OGG +
  AAC** (AGENTS.md § 6).
- Risque : le rendu synthétique peut sonner « froid ». Mitigation : longue
  réverbération de vallée, micro-variations de hauteur, et beaucoup de silence.

---

## ADR-008 : Rendu stylisé — toon ramp, vertex colors, AO de sommets

- **Date** : 2026-09-27 · **Statut** : Accepté

### Contexte

La direction artistique vise la gouache : volumes francs, ombres colorées
jamais noires, lisibilité absolue de la silhouette. Par ailleurs, le budget
mobile interdit les shadow maps dynamiques (ADR-022) et les textures lourdes.

### Décision

- **Toon ramp** à 3–5 paliers (`ToonStoneMaterial`), avec un **plancher
  d'ombre à 0,32** : les ombres gardent la couleur du ciel, elles ne tombent
  jamais dans le noir. La rampe est une `DataTexture` partagée par tous les
  matériaux de pierre — un seul upload GPU.
- **Vertex colors** pour la variation de teinte (pierre plus chaude au soleil,
  plus froide à l'ombre) : aucune texture chargée.
- **AO cuite dans les sommets** à la construction du niveau : coût nul à
  l'exécution, et **seule source d'occlusion sur mobile**.
- **Brouillard de hauteur** : il sépare les plans, donne l'échelle des tours
  et fait respirer l'image. C'est l'élément d'ambiance prioritaire.
- **Rim light** froide pour détacher les silhouettes du fond.
- **Pas de PBR** : ni metalness/roughness maps, ni IBL, ni normal maps.

### Alternatives considérées

| Option                                               | Pourquoi écartée                                                                                                                                                   |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **PBR complet avec HDRI**                            | Superbe sur desktop, ruineux sur mobile (fillrate, mémoire de textures, coût de l'IBL), et esthétiquement hors sujet : on veut de la gouache, pas du photoréalisme |
| **Matériaux non éclairés (unlit) + couleurs plates** | Le moins cher, mais les volumes deviennent illisibles en isométrie : sans dégradé, deux faces perpendiculaires se confondent                                       |
| **AO en écran (SSAO) partout**                       | Très belle, mais c'est une passe plein écran : intenable sur mobile. Conservée uniquement en qualité « high » desktop (ADR-009)                                    |
| **Textures peintes à la main**                       | Poids, temps de production, et incompatible avec l'instancing massif prévu pour les blocs de pierre                                                                |

### Conséquences

- Le pipeline d'assets doit produire de l'AO de sommets (outil à écrire,
  phase 3) — c'est le vrai coût de cette décision.
- Les matériaux sont mutualisés : quelques matériaux pour tout un niveau, donc
  peu de draw calls.
- Le rendu diffère légèrement entre mobile (AO de sommets seule) et desktop
  (AO + ombres portées) : assumé, la lecture des volumes est préservée.

---

## ADR-009 : Post-processing pmndrs/postprocessing, dégressif

- **Date** : 2026-09-27 · **Statut** : Accepté

### Contexte

Le rendu toon a besoin d'un peu de « colle » photographique — antialiasing
propre sur des arêtes très contrastées, halo léger autour des sources
chaudes, vignette, et une teinte d'ensemble par chapitre. Mais chaque passe
plein écran coûte du fillrate, la ressource la plus rare sur mobile.

### Décision

Chaîne **pmndrs/postprocessing** (et non `EffectComposer` de three/examples),
assemblée en un minimum de passes fusionnées :

```
Render → [SSAO high] → Bloom léger → Vignette → LUT de chapitre → [SMAA high]
```

Activation pilotée par `Quality.ts` (ADR-013) : **rien** en qualité basse,
bloom + vignette + LUT en moyenne, tout en haute. Budget : la chaîne entière
ne doit jamais dépasser 2 ms sur mobile, et **le jeu doit rester identique en
gameplay avec la chaîne coupée**.

### Alternatives considérées

| Option                                              | Pourquoi écartée                                                                                                                                                                                                |
| --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`EffectComposer` de three/examples**              | Une passe = un rendu plein écran ; cinq effets = cinq passes. pmndrs fusionne les effets compatibles en un seul fragment shader : c'est précisément la différence qui rend le post-processing viable sur mobile |
| **Aucun post-processing**                           | Tenable (et c'est ce qui se passe en qualité basse), mais on perd la LUT par chapitre, qui est un outil de dramaturgie de couleur majeur dans la lignée de _Gris_                                               |
| **Effets « à la main » dans le shader de matériau** | Impossible pour le bloom et la vignette, qui sont par nature écran                                                                                                                                              |
| **FXAA plutôt que SMAA**                            | Moins cher mais brouille les arêtes fines — désastreux sur une architecture de lignes nettes. SMAA en haute, MSAA natif désactivé ailleurs                                                                      |

### Conséquences

- `PostFX` expose `applyQuality()` et peut détruire/reconstruire sa chaîne à
  chaud sans toucher au reste du moteur.
- La LUT par chapitre devient un livrable de direction artistique (phase 3).
- Le rendu sans post-processing doit rester **beau, pas dégradé** : c'est ce
  que verront les téléphones d'entrée de gamme.

---

## ADR-010 : Niveaux décrits en TypeScript, chargés en lazy import

- **Date** : 2026-09-27 · **Statut** : Accepté · _(remplace l'ancien ADR-0007)_

### Contexte

Huit chapitres, chacun avec ses nœuds, ses arêtes conditionnelles et ses
mécanismes. Il faut un format que le level designer écrive sans compiler
mentalement du code, que le compilateur valide, que Git versionne lisiblement,
et qui ne pèse pas sur le premier chargement.

### Décision

Chaque niveau est un **module TypeScript exportant une donnée typée**
(`LevelDefinition`) : `src/levels/04-patience.ts`. Aucun comportement, que
des données. Le registre `src/levels/index.ts` n'expose que des **imports
dynamiques**, et `vite.config.ts` force un chunk `level-XX` par chapitre.

### Alternatives considérées

| Option                    | Pourquoi écartée                                                                                                                                                                                                                            |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **JSON**                  | Pas de validation à la compilation, pas d'autocomplétion, pas de commentaires — or un fichier de niveau a besoin d'expliquer ses intentions de design. Il faudrait un schéma JSON et un validateur : plus d'outillage pour moins de confort |
| **YAML**                  | Mêmes défauts que JSON, plus l'ambiguïté du parsing                                                                                                                                                                                         |
| **Éditeur visuel maison** | Le bon outil… dans un an. Le construire avant d'avoir stabilisé les mécanismes reviendrait à outiller une cible mouvante                                                                                                                    |
| **Tout charger d'emblée** | Simple, mais ferait entrer huit chapitres de géométrie dans le bundle initial                                                                                                                                                               |

### Conséquences

- Les huit chunks `level-*` sont émis séparément (vérifié au build) ; le
  `LevelLoader` précharge le chapitre suivant pendant qu'on joue, l'attente
  n'est jamais perceptible.
- `scripts/check-bundle.mjs` exclut ces chunks du budget initial **et
  échouerait si l'un d'eux y retombait** — ce qui signalerait une régression
  du découpage.
- Constat de build : Rollup fusionne `three` et `postprocessing` en un seul
  chunk (le second dépend du premier, tous deux chargés par la même entrée).
  Plutôt que de lutter, le chunk est nommé honnêtement `vendor-3d`.

---

## ADR-011 : Sauvegarde locale via `Platform.storage`

- **Date** : 2026-09-27 · **Statut** : Accepté

### Contexte

La progression doit survivre à une fermeture d'onglet, fonctionner hors
ligne, et continuer de fonctionner à l'identique une fois le jeu empaqueté
par Capacitor — où `localStorage` existe mais où l'API recommandée est
`@capacitor/preferences`, **asynchrone**.

### Décision

Tout le stockage passe par **`src/platform/Platform.ts`**
(`getItem` / `setItem` / `removeItem`), dont l'interface est **asynchrone dès
maintenant**, y compris dans l'implémentation web qui s'appuie sur
`localStorage` synchrone.

`SaveManager` écrit un enregistrement **versionné** (`bov.save.v1`), de façon
automatique et silencieuse — jamais un bouton « Sauvegarder ». Une sauvegarde
illisible ou corrompue est **ignorée sans message d'erreur** : on repart d'une
partie neuve plutôt que de bloquer le démarrage.

### Alternatives considérées

| Option                                                  | Pourquoi écartée                                                                                                                                                                      |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`localStorage` appelé directement**                   | Un jour de gagné, une semaine de perdue au portage : il faudrait retrouver et convertir chaque appel, en passant de synchrone à asynchrone — le refactor le plus contaminant qui soit |
| **IndexedDB**                                           | Adapté aux gros volumes ; notre sauvegarde fait quelques centaines d'octets. Complexité sans contrepartie                                                                             |
| **Sauvegarde serveur / compte joueur**                  | Hors périmètre v1 (`out_of_scope_v1`), et contraire à l'absence totale de collecte de données                                                                                         |
| **Interface synchrone côté web, asynchrone côté natif** | Deux contrats différents = deux comportements à tester. L'asynchrone couvre les deux                                                                                                  |

### Conséquences

- Un léger surcoût d'`async` dans `SaveManager` et `i18n`, largement payé par
  l'absence de refactor au portage.
- Règle de lint à ajouter : interdire `localStorage` hors de `platform/`
  (tâche ouverte).
- Le format étant versionné, une v2 pourra migrer proprement plutôt que
  d'effacer la progression des joueurs.

---

## ADR-012 : UI en HTML/CSS superposée au canvas

- **Date** : 2026-09-27 · **Statut** : Accepté

### Contexte

Le jeu a très peu d'interface — un titre, une carte de chapitre, une pause,
des réglages, un recueil de proverbes — mais elle doit être **nette sur tous
les écrans**, traduite en quatre langues dont le russe et le tchétchène,
accessible au clavier et au lecteur d'écran, et respectueuse des encoches.

### Décision

Interface en **HTML/CSS au-dessus du canvas** (`src/ui/`, `UIRoot`), pilotée
par des jetons de design (`ui/styles/tokens.css`) qui sont la source unique
de vérité visuelle. **Aucune UI rendue dans WebGL.**

### Alternatives considérées

| Option                                          | Pourquoi écartée                                                                                                                                                                                                                                   |
| ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **UI dans le canvas (texte en texture ou SDF)** | Cohérence visuelle parfaite, mais : texte à re-rasteriser à chaque DPR, gestion manuelle du focus et du clavier, accessibilité à réinventer intégralement, et un atlas de glyphes à produire pour le cyrillique — pour une interface de six écrans |
| **Bibliothèque d'UI WebGL (three-mesh-ui…)**    | Ajoute une dépendance et hérite de tous les problèmes ci-dessus                                                                                                                                                                                    |
| **Framework (React, Svelte, Vue)**              | Résoudrait une complexité d'état que nous n'avons pas, au prix de son poids et de son cycle de rendu                                                                                                                                               |

### Conséquences

- Accessibilité gratuite : `prefers-reduced-motion`, `prefers-contrast`,
  navigation au clavier, `aria-live`, cibles ≥ 44 px, safe-areas via
  `env(safe-area-inset-*)`.
- L'i18n se réduit à remplacer du texte, sans reconstruire d'atlas.
- Zéro draw call supplémentaire.
- Contrepartie : il faut une discipline de jetons pour que le DOM et le monde
  3D ne « jurent » pas. C'est le rôle de `tokens.css`.

---

## ADR-013 : Qualité adaptative, mesure sur 3 secondes

- **Date** : 2026-09-27 · **Statut** : Accepté

### Contexte

« 60 fps sur mobile milieu de gamme » suppose de savoir sur quoi l'on tourne.
Les bases de données de GPU sont peu fiables, et
`WEBGL_debug_renderer_info` est de plus en plus restreint par les
navigateurs. Par ailleurs, un même appareil ne tient pas les mêmes
performances à froid et après vingt minutes de chauffe.

### Décision

1. **Estimation initiale prudente** (`guessInitialTier`) à partir du type de
   pointeur, de la taille d'écran et de `hardwareConcurrency`.
2. **Mesure du framerate réel** sur une fenêtre glissante de **3 secondes**,
   puis passage en `low` / `medium` / `high`, avec **hystérésis** : on
   descend sous 48 fps, on ne remonte qu'au-dessus de 58.
3. Le joueur peut **figer** le réglage : un choix manuel désactive
   l'adaptation.

### Alternatives considérées

| Option                        | Pourquoi écartée                                                                                           |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------- |
| **Détection matérielle**      | Peu fiable, de plus en plus bloquée, et fausse dès que le téléphone chauffe ou passe en économie d'énergie |
| **Réglage manuel uniquement** | Demande au joueur de comprendre un vocabulaire technique pour jouer à un jeu contemplatif. Inacceptable    |
| **Adaptation par image**      | Ferait clignoter ombres et effets en permanence : le remède serait pire que le mal                         |
| **Fenêtre courte (0,5 s)**    | Réagit au moindre à-coup (chargement de chunk, ramasse-miettes) et provoque des oscillations               |

### Conséquences

- La qualité peut changer en cours de partie : chaque transition doit être
  **visuellement douce**, jamais une disparition brutale au milieu d'une
  énigme.
- 10 tests unitaires couvrent l'estimation, la descente, la remontée, la
  non-oscillation et le gel sur choix du joueur.
- La mesure de fps est aussi affichée en développement
  (`debug/Stats.ts` : fps, ms, draw calls, triangles).

---

## ADR-014 : Portage Android futur via Capacitor, PWA d'abord

- **Date** : 2026-09-27 · **Statut** : Accepté

### Contexte

La cible immédiate est le web (desktop et mobile) ; Android via Capacitor est
prévu « plus tard ». L'erreur classique est de tout préparer trop tôt, ou de
ne rien préparer et payer un refactor.

### Décision

**PWA d'abord** : installable, jouable hors ligne, plein écran, orientation
libre. Trois préparations minimales, et aucune autre :

1. **`base: './'`** dans Vite — chemins relatifs, indispensables dès lors que
   la WebView sert depuis `file://` ou `https://localhost` ;
2. **la couche `Platform`** (ADR-011) pour stockage, vibration, plein écran,
   cycle de vie et wake lock ;
3. **aucune dépendance à `window.*` / `navigator.*` sans garde**.

Le jour venu : `pnpm exec cap init`, une classe `CapacitorPlatform` à côté de
`WebPlatform`, un point de sélection unique — et **aucun autre fichier du jeu
ne change**. C'est le critère de réussite du portage.

### Alternatives considérées

| Option                                | Pourquoi écartée                                                                                                                     |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| **Capacitor tout de suite**           | Ajoute un dossier `android/`, un SDK, une chaîne de signature et une CI plus lourde, pour zéro bénéfice tant que le jeu n'existe pas |
| **PWA seule, sans jamais empaqueter** | Prive de la distribution Play Store, qui est le canal réel sur Android                                                               |
| **React Native / Flutter**            | Réécriture complète du rendu. Absurde pour un jeu WebGL                                                                              |
| **Export natif (Unity/Godot)**        | Autre moteur, autre projet (voir ADR-001)                                                                                            |

### Conséquences

- `docs/ANDROID_PORT.md` tient la liste précise des plugins et des
  spécificités Android (bouton retour, mode immersif, cycle de vie, WebView
  minimale).
- Aucune permission Android ne doit devenir nécessaire.
- Le stockage asynchrone et les chemins relatifs sont des contraintes
  **présentes**, à respecter dès aujourd'hui.

---

# Décisions d'outillage et de production

## ADR-015 : Le jeu vit à la racine du dépôt

- **Date** : 2026-09-27 · **Statut** : Accepté · _(ex-ADR-0001)_

### Contexte

L'arborescence initiale était décrite sous une racine nommée `bov/`, alors que
le dépôt `B-OV-Les-Tours-du-Silence` est dédié à ce seul projet.

### Décision

`bov/` désigne la racine du dépôt : pas de sous-dossier supplémentaire.

### Alternatives considérées

Créer réellement `bov/` — écarté : un dossier unique dans un dépôt déjà nommé
d'après le jeu casse les conventions par défaut de tous les outils (Vercel,
Netlify, GitHub Pages, Capacitor, Playwright, actions CI cherchent un
`package.json` à la racine) et rallonge chaque chemin sans contrepartie.

### Conséquences

Tous les chemins de l'arborescence demandée sont valides sans le préfixe. Le
jour où le dépôt accueillera plusieurs paquets (un éditeur de niveaux, par
exemple), on migrera vers un vrai monorepo pnpm workspaces — avec son ADR.

---

## ADR-016 : TypeScript épinglé en 5.9

- **Date** : 2026-09-27 · **Statut** : Accepté · _(ex-ADR-0002)_

### Contexte

`typescript@latest` résout vers 7.0.2, que `typescript-eslint@8.70` refuse
(pair déclaré : `>=4.8.4 <6.1.0`). Avec TS 7, le lint typé devient non
supporté.

### Décision

`typescript: ~5.9.0`.

### Alternatives considérées

TS 7 avec lint typé désactivé (perte d'une analyse qui attrape les promesses
flottantes et les accès non sûrs de three) ; `typescript-eslint` en canary
(dépendance instable sur un projet de plusieurs mois).

### Conséquences

Tâche de veille : repasser à TS 7 dès que `typescript-eslint` l'annonce
supporté. Aucune fonctionnalité de TS 7 n'est utilisée.

---

## ADR-017 : `eslint-plugin-import` retiré

- **Date** : 2026-09-27 · **Statut** : Accepté · _(ex-ADR-0003)_

### Contexte

`eslint-plugin-import@2.32` ne supporte pas ESLint 10 (pair maximum : 9). Il
était pressenti pour l'ordre des imports.

### Décision

Le retirer : `@typescript-eslint` couvre les imports de types, les imports
inutilisés et les cycles dangereux ; Prettier gère la mise en forme.

### Alternatives considérées

Rétrograder ESLint en 9 (renoncer aux correctifs récents pour une règle
cosmétique) ; `perfectionist` ou `eslint-plugin-import-x` — réévaluables si
l'ordre des imports devient un vrai sujet.

### Conséquences

L'ordre des imports n'est pas vérifié automatiquement. Aucun impact
fonctionnel.

---

## ADR-018 : Deux `tsconfig`, le jeu et l'outillage

- **Date** : 2026-09-27 · **Statut** : Accepté · _(ex-ADR-0009)_

### Contexte

Les fichiers de configuration ont besoin des types Node (`process`,
`node:url`) ; le code du jeu ne doit **jamais** y avoir accès — un
`process.env` qui se glisse dans `src/` casse silencieusement le build
Capacitor.

### Décision

Un fichier « solution » référençant `tsconfig.app.json` (jeu + tests
unitaires) et `tsconfig.node.json` (outillage, e2e), avec `tsc -b`.

### Alternatives considérées

Un `tsconfig` unique avec `"types": ["node", "vite/client"]` : simple, mais la
frontière ne serait plus vérifiée que par la discipline.

### Conséquences

`pnpm typecheck` devient `tsc -b --force` ; compilation incrémentale ; ESLint
retrouve chaque fichier dans le bon projet. Ajouter un fichier de config à la
racine impose de l'ajouter à l'`include` de `tsconfig.node.json`.

---

## ADR-019 : `allowedHosts: true` en développement

- **Date** : 2026-09-27 · **Statut** : Accepté · _(ex-ADR-0010)_

### Contexte

Le jeu doit être testé **sur un vrai téléphone**, très tôt et très souvent :
l'accès passe par une IP de réseau local, un tunnel ou un conteneur, jamais
par « localhost ». Vite 8 refuse ces hôtes par défaut.

### Décision

`server.allowedHosts: true` et `preview.allowedHosts: true`.

### Alternatives considérées

Lister les hôtes au cas par cas (frottement quotidien, et l'URL d'un tunnel
change à chaque session) ; passer par un proxy local (un outil de plus).

### Conséquences

Ces serveurs ne servent qu'en développement ; la production est un
hébergement statique sans Vite. Le risque résiduel (rebinding DNS sur une
machine de dev) est très inférieur au coût d'un test mobile rendu pénible — et
un test mobile pénible est un test qu'on ne fait pas.

---

## ADR-020 : `brief.yaml` est la spécification faisant autorité

- **Date** : 2026-09-27 · **Statut** : Accepté · _(ex-ADR-0011)_

### Contexte

`brief.yaml` est fourni mot pour mot par la direction de projet et porte des
engagements chiffrés (60 fps, 1,5 Mo, 120 draw calls, Lighthouse ≥ 90/85)
ainsi qu'une definition of done.

### Décision

`brief.yaml` prime sur `docs/`. Il est maintenu **à l'octet près** (ajouté à
`.prettierignore`) et n'est jamais modifié par un agent.

### Alternatives considérées

Le laisser évoluer au fil des découvertes : c'est précisément ce qui fait
qu'une spécification cesse d'en être une.

### Conséquences

Les écarts détectés ont été corrigés **dans `docs/`** (fiche de Turpal,
durées, récompenses, accessibilité, appareils de référence). La definition of
done est reprise telle quelle en tête de `qa-report.md`.

---

## ADR-021 : Des tours « fracturées », jamais en ruine

- **Date** : 2026-09-27 · **Statut** : Accepté · _(ex-ADR-0012)_

### Contexte

Le pitch dit que « les tours vainakhs se sont fracturées », tandis que
`docs/CULTURE.md` interdit qu'une tour s'effondre : ce sont des monuments
réels, encore debout.

### Décision

« Fracturé » se lit **géométriquement, pas structurellement** : les tours sont
intactes, mais leurs chemins ne se rejoignent plus — volées d'escalier
désarrimées, passerelles pointant dans le vide, fragments décalés d'un cran.
Aucun éboulis, aucune pierre cassée, aucune trace de destruction.

### Alternatives considérées

Montrer des tours réellement abîmées (impossible : contrainte culturelle, et
proche de l'imagerie de guerre proscrite) ; reformuler le pitch (exclu : le
brief ne se modifie pas, ADR-020).

### Conséquences

Vocabulaire proscrit dans tout le projet : ruines, débris, effondrement,
destruction. Vocabulaire retenu : désarrimé, décalé, disjoint, chemin rompu.

---

## ADR-022 : Aucune shadow map dynamique sur mobile

- **Date** : 2026-09-27 · **Statut** : Accepté · _(ex-ADR-0013)_

### Contexte

Le preset « medium » activait les ombres et un téléphone à 8 cœurs démarre en
« medium » : un mobile pouvait donc rendre une passe d'ombre complète par
image, soit 3 à 6 ms — un tiers du budget.

### Décision

`Quality.settings` force `shadows: false` dès que le profil est mobile, quel
que soit le tier, **y compris si le joueur choisit « haute » manuellement**.

### Alternatives considérées

Laisser l'adaptation automatique corriger après coup (le joueur subit
plusieurs secondes de saccades, et la mesure ne dit pas _quoi_ couper) ;
baisser le tier initial des mobiles à « low » (sacrifie résolution et effets,
qui se voient davantage que les ombres).

### Conséquences

L'occlusion sur mobile repose sur l'**AO de sommets** et des **ombres blob**
(ADR-008), deux techniques à zéro passe. La règle est verrouillée par un test
unitaire : elle ne peut plus régresser en silence.

---

## ADR-023 : Raccourcis clavier liés aux touches physiques

- **Date** : 2026-09-27 · **Statut** : Accepté

### Contexte

Le jeu doit être jouable au clavier en WASD (QWERTY) **et** en ZQSD (AZERTY),
avec en plus Q/E — ou A/E en AZERTY — pour faire tourner un mécanisme. La
solution habituelle consiste à détecter la disposition et à charger une table
de touches différente, ou à lier plusieurs lettres à la même action.

### Décision

Tous les bindings sont écrits sur **`event.code`**, c'est-à-dire la position
physique de la touche, jamais sur `event.key` (le caractère imprimé).

Le cluster ZQSD d'un clavier AZERTY occupe **exactement** les mêmes positions
physiques que WASD sur un QWERTY ; de même, A/E en AZERTY occupe les positions
de Q/E. Une table unique de codes (`KeyW`, `KeyA`, `KeyS`, `KeyD`, `KeyQ`,
`KeyE`) sert donc les deux dispositions **sans détection ni configuration**.

La disposition n'est lue que pour **afficher** le bon libellé dans les
réglages, via `keyLabel(code)` qui s'appuie sur
`navigator.keyboard.getLayoutMap()` et retombe sur le code quand l'API
n'existe pas (Firefox, Safari).

La table est une **donnée** (`Record<code, InputAction>`) et non un `switch` :
le remappage complet exigé par l'accessibilité se réduit à remplacer cette
table et à la persister.

### Alternatives considérées

| Option                                                                       | Pourquoi écartée                                                                                                                                                                                                                      |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Détecter la disposition et charger deux tables**                           | Deux tables à maintenir, une détection qui échoue sur les claviers exotiques (QWERTZ, Dvorak, Colemak) et sur les navigateurs sans `getLayoutMap`. On paierait de la complexité pour retrouver ce que `event.code` donne gratuitement |
| **Lier plusieurs lettres à la même action** (`KeyW` et `KeyZ` pour « haut ») | C'était l'état précédent. Fonctionne pour se déplacer, mais entre en collision dès qu'on ajoute la rotation : sur AZERTY, `KeyQ` serait à la fois « gauche » et « tourner »                                                           |
| **Utiliser `event.key`**                                                     | Le caractère dépend de la disposition **et** de la langue système ; un même geste physique produirait une action différente d'un joueur à l'autre                                                                                     |
| **Imposer le remappage à l'utilisateur AZERTY**                              | Demande une configuration avant de jouer : exactement la friction que le pilier « fluidité » interdit                                                                                                                                 |

### Conséquences

- Le jeu fonctionne immédiatement en QWERTY, AZERTY et QWERTZ ; Dvorak et
  Colemak conservent la disposition physique QWERTY, donc fonctionnent aussi.
- Les libellés affichés peuvent être faux sur Firefox et Safari (repli sur le
  code, « Q » là où le clavier montre « A ») : acceptable, et corrigé par le
  remappage manuel.
- `Shift+Tab` est traité comme une inversion de `Tab` plutôt que comme un
  binding distinct — même touche physique, sens opposé.

## ADR-024 : Le picking se fait sur la projection écran des nœuds, pas sur la géométrie

- **Date** : 2026-09-27 · **Statut** : Accepté

### Contexte

Toutes les interactions tactiles (aller ici, tourner ce mécanisme, appeler
Borz) doivent désigner un objet du monde. L'approche standard du 3D est le
raycast contre la géométrie. Or la géométrie visible (blocs de pierre, tours)
n'existe pas encore au moment où les interactions doivent marcher (phase 5),
et surtout le graphe de navigation **est** la vérité du monde : Turpal ne
marche jamais « sur de la géométrie », il marche sur des nœuds (ADR-003).

### Décision

Le picking projettes les **positions monde des nœuds en pixels écran** via
`NodeProjection` (buffers préalloués, une projection par image), puis compare
la distance écran entre le tap et chaque nœud, avec une tolérance adaptée à
l'écart du voisin le plus proche (rayon 16–46 px). Le picking des mécanismes
suit le même principe : le `LevelRuntime` projette la racine du mécanisme et
teste l'appartenance au disque de saisie. Aucun raycast géométrique dans le
jeu de simulation.

### Alternatives considérées

| Option                           | Pourquoi écartée                                                                   |
| -------------------------------- | ---------------------------------------------------------------------------------- |
| **Raycast contre les meshes**    | La géométrie arrive en phase 9 ; et deux meshes superposées créent des ambiguïtés  |
| **Colliders invisibles dédiés**  | Deux mondes à maintenir en synchronisation, pour retrouver l'information du graphe |
| **Picking en coordonnées monde** | L'écran iso déforme les distances ; le doigt juge en pixels, pas en unités monde   |

### Conséquences

- Le picking est insensible à la complexité de la géométrie : 300 nœuds
  projetés en < 0,2 ms (test unitaire), quels que soient les blocs affichés.
- La tolérance est exprimée en pixels, donc le confort tactile reste constant
  sur tous les DPI et toutes les distances de caméra.
- Les mécanismes doivent exposer une position monde simple (`root.position`) :
  c'est déjà le contrat de `Mechanism`.

## ADR-025 : Tone.js chargé après le premier geste, gains nominaux en décibels

- **Date** : 2026-09-27 · **Statut** : Accepté

### Contexte

Le navigateur interdit tout son avant un geste utilisateur. Charger Tone.js
(≈ 62 ko gzip) dans le bundle initial, c'est payer deux fois un silence. Par
ailleurs, docs/AUDIO.md § 1 donne deux tables qui ne sont pas linéaires
l'une envers l'autre : les curseurs par défaut (master 0,9 · music 0,7 ·
ambience 0,6 · sfx 0,85) et les gains nominaux du mix (0 · −9 · −14 · −6 dB).

### Décision

1. **Chargement paresseux** : `AudioDirector` importe `AudioManager` (et donc
   Tone) dynamiquement à `unlock()`, appelé par `input.onFirstGesture()`. Le
   moteur audio vit dans son propre chunk (`vendor-audio`), hors chemin
   critique. Avant le déverrouillage, le directeur mémorise l'état (chapitre,
   progression, ambiance) et le rejoue au chargement — le premier geste du
   joueur installe le monde sonore avec un fondu de 1,2 s.
2. **Mapping curseur → dB** (`mixing.ts`) : le gain nominal du bus est celui
   du curseur par défaut ; le curseur atténue ou amplifie **autour**, en
   décibels (`nominal + 20·log10(slider/référence)`). Seul le master reste
   linéaire (0,9 → −0,9 dB), comme un vrai master. Un bus, une réverbération
   « vallée » partagée (decay 9 s, wet 0,42 ; sfx en send 0,25).

### Alternatives considérées

| Option                                         | Pourquoi écartée                                                        |
| ---------------------------------------------- | ----------------------------------------------------------------------- |
| **Tone dans le bundle initial, muet au début** | 62 ko gzip payés pour rien pendant le silence d'ouverture               |
| **Icône « activer le son »**                   | Interdite par le brief : le premier geste du jeu est un geste de jeu    |
| **Curseurs linéaires × gains fixes**           | Une moitié de curseur ne fait pas −6 dB ; les réglages paraissent morts |
| **Une réverbération par bus**                  | Trois convolutions pour un seul lieu : coût GPU sans bénéfice audible   |

### Conséquences

- Le bundle initial ne contient aucune dépendance audio ; `vendor-audio`
  arrive au premier geste, en parallèle du fondu d'entrée.
- Les tests unitaires du mix tournent sans Tone (module pur `mixing.ts`).
- Tout nouveau nœud audio doit être créé dans `AudioManager.start()` (et non
  au constructeur) : le graphe n'existe qu'après le geste.

## ADR-026 : Timelines manuelles pour le « juice », pas de gsap

- **Date** : 2026-09-27 · **Statut** : Accepté

### Contexte

Les célébrations de fin de chapitre demandent des séquences : tours allumées
en cascade (250 ms d'écart, de la plus lointaine à la plus proche), pétales,
accords retardés, lueurs qui s'éteignent. gsap est déjà une dépendance du
projet — la tentation est grande. Mais le « juice » vit dans la boucle de
rendu, à côté de modules déjà écrits en timelines manuelles
(`LevelRuntime`, `Turpal`), avec une discipline stricte : zéro allocation par
image, pas de magie, tout relit `prefers-reduced-motion`.

### Décision

Les modules FX (`Celebrate`, `StoneFragments`, `GoldenTrail`, `LightShafts`)
pilotent **leurs propres timelines** : un temps local avancé par
`update(delta)`, des seuils constants tirés de `config.ts`
(`FX.illumination.staggerMs`…), des courbes d'easing pures
(`utils/easing.ts`). Aucun moteur d'animation dans le chemin du jeu. gsap
reste réservé aux futurs écrans d'UI (phase 8), hors boucle de simulation.

### Alternatives considérées

| Option                            | Pourquoi écartée                                                                                                                          |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| **gsap partout**                  | 24 ko de plus, des timelines qui échappent au `timeScale` du moteur, et des tweens qui survivent à un changement de niveau                |
| **CSS/WAAPI pour le monde 3D**    | N'atteint pas les matériaux et uniformes three                                                                                            |
| **Événements `setTimeout` seuls** | Conservés uniquement pour les pétales retardés de la cascade ; le cœur du geste est dans `update(delta)` pour rester synchronisé au rendu |

### Conséquences

- Une célébration interrompue par un changement de niveau s'arrête net :
  `reset()`/`dispose()` suffisent, aucun tween orphelin.
- Le mouvement réduit s'applique une fois pour toutes (`motionDurationScale`)
  au lieu d'être re-décidé par chaque tween.
- Les durées restent des données de `config.ts` : accorder le jeu se fait
  sans toucher au code des timelines.

---

## ADR-027 : L'interface est une pile d'écrans DOM orchestrée par `GameFlow`

- **Date** : 2026-09-27 · **Statut** : Accepté

### Contexte

La phase 8 doit assembler écran titre, cartons de chapitre, pause, réglages,
carnet et sélecteur — avec `Échap` qui remonte d'un cran, un focus clavier
piégé dans la fenêtre ouverte, une suspension des intentions de jeu pendant
que l'interface parle, et des transitions de chapitre sans couture. ADR-012
a posé l'UI en HTML/CSS au-dessus du canvas ; il manque la **structure** :
qui décide qu'un écran est ouvert, qui gèle la simulation, qui enchaîne
titre → chapitre → célébration → chapitre suivant.

### Décision

1. **`UIRoot` est une pile** : un panneau de base optionnel (le titre) plus
   une pile modale. Un seul panneau actif ; `Échap` dépile (ou reprend si le
   sommet est la pause) ; le focus est piégé dans le panneau ouvert
   (WCAG 2.4.3) et rendu à sa position d'origine à la fermeture. Chaque
   panneau voit passer les touches au sommet (`onKeydown`) et peut les
   consommer — c'est ainsi que la capture de remappage avale même `Échap`.
2. **`GameFlow` est le seul orchestrateur** (un état :
   boot/titre/transition/intro/jeu/pause/victoire). Toutes les transitions
   passent par le même moule : voile noir 1200 ms → couture invisible
   (déchargement, chargement, cadrage, palette ciel/LUT) → carton de chapitre
   dont le noir intérieur prend le relais → jeu. Le voile ne capture jamais
   le pointeur.
3. **La suspension est un drapeau** (`InputManager.setSuspended`) : quand
   l'interface parle, le clavier et le pointeur du jeu se taisent, seules les
   touches de confort (muet, plein écran) traversent. La pause gèle la
   simulation (`LevelRuntime.update` early-return) mais jamais le rendu ni
   les FX.
4. **Aucun gsap** : les fondus de panneaux sont des transitions CSS pilotées
   par les jetons de durée (180/420/900/1800 ms) ; `UiVeil` résout sa
   promesse sur `transitionend` avec un filet `setTimeout`. Le mouvement
   réduit (réglage ou système) réduit tout à 1 ms via `html.ui-motion-reduced`.
5. **Les réglages s'appliquent et se persistent immédiatement** — jamais de
   bouton « Appliquer ». La section `ui` du magasin (ADR-011) stocke qualité
   figée, mouvement, taille de texte, contraste, sous-titres ; un choix revenu
   à sa valeur neutre **efface** la clé.

### Alternatives considérées

| Option                              | Pourquoi écartée                                                                                            |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| **Une machine à états générique**   | Huit écrans ne justifient pas un DSL ; un champ `state` + des méthodes nommées se lisent en une page        |
| **gsap pour les fondus d'UI**       | ADR-026 le réservait à cet usage ; les transitions CSS suffisent et suivent `prefers-reduced-motion` seules |
| **Un overlay WebGL pour l'UI**      | Contredit ADR-012 : lisibilité, lecteur d'écran et safe-areas se gèrent en DOM pour rien                    |
| **Suspendre par `stopPropagation`** | Fragile (ordre des écouteurs) ; un drapeau explicite se teste et se documente                               |

### Conséquences

- Ajouter un écran = une classe `UIPanel` + un `push` ; l'accessibilité et la
  suspension viennent avec la pile.
- La scène du titre vit sous les chapitres (détachée, pas disposée) : le
  retour au titre est instantané et le coût mémoire est celui d'une petite
  scène procédurale, libérée seulement au démontage du flux.
- Le ducking des cartons passe par un événement typé `ui:speaking` : l'audio
  reste découplé de l'UI (même bus que le reste, ADR-025).

---

## ADR-028 : Géométrie de niveau instanciée, acteurs secrets séparés du parcours

- **Date** : 2026-09-27 · **Statut** : Accepté

### Contexte

Le chapitre 0 est le premier niveau livré depuis `LevelDefinition`. ADR-010
interdit d'introduire du comportement dans son module de données, tandis que la
tour vainakh exige une silhouette canonique plus riche qu'une pile de cubes.
L'aigle caché doit être touchable mais ne doit jamais devenir une destination de
Turpal ni modifier la solvabilité. Enfin, l'illusion du seuil dépend de la
direction isométrique : recentrer le décor ne doit pas changer cette direction.

### Décision

1. **`LevelGeometry` interprète les `LevelBlockDef`**. Les volumes réguliers
   sont regroupés par surface dans des `InstancedMesh`; `kind: 'tower'`
   délègue à `VainakhTower`, générateur procédural spécialisé et sans asset.
2. **Le `Level` possède le décor et ses acteurs secrets**. Il construit,
   borne, anime et libère la géométrie et l'aigle dans le même cycle de vie que
   le graphe. Les métriques de décor (`estimatedDrawCalls`, `triangleCount`)
   sont exposées pour les tests de budget.
3. **Un secret a un nœud de projection, pas une arête**. Le nœud permet le
   picking écran après révélation, mais reste déconnecté du NavGraph de Turpal.
   Le déclencheur de découverte persiste l'identifiant du secret et n'accorde
   aucune récompense de gameplay.
4. **Le cadrage translate la caméra sans la réorienter**. `lookAtPoint` conserve
   le vecteur isométrique initial; la paire `[−2,3,2]` / `[4,9,8]`, séparée de
   `[6,6,6]`, reste donc superposée en portrait comme en paysage.

### Alternatives considérées

| Option                                                   | Pourquoi écartée                                                                                                      |
| -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| **Décrire chaque pierre comme un `Mesh` dans le niveau** | Trop de draw calls, données illisibles, détails architecturaux dupliqués dans les huit chapitres                      |
| **Exporter une tour GLB**                                | Asset lourd et moins paramétrable alors que la silhouette est obtenue avec 862 triangles de décor pour le prologue    |
| **Relier l'aigle au NavGraph**                           | Turpal pourrait marcher sur le toit; le secret deviendrait un état de solution et fausserait le validateur d'impasses |
| **Orienter la caméra vers le centre à chaque cadrage**   | Casse l'invariant de projection dont dépend la liaison illusoire                                                      |
| **Révéler le secret par un compteur ou un indice**       | Contredit le GDD : contemplation optionnelle, sans checklist ni avantage                                              |

### Conséquences

- Une tour reste une donnée concise dans chaque niveau et respecte le même canon
  architectural; ses matériaux suivent la palette du chapitre.
- La géométrie du prologue tient en 10 draw calls estimés et 862 triangles,
  hors personnages et FX.
- Les secrets futurs peuvent réutiliser le contrat, mais tout nouveau `kind`
  d'acteur devra fournir explicitement révélation, picking et `dispose()`.
- La direction de caméra est désormais couverte par un test de non-régression,
  en plus des audits de l'illusion à 1920×1080 et 390×844.

---

## ADR-029 : Les états narratifs sont des conditions monotones du NavGraph

- **Date** : 2026-09-27 · **Statut** : Accepté

### Contexte

Dans « L'Hospitalité », la passerelle ne doit ouvrir la route sud que lorsque
deux faits sont vrais : la roue pointe vers Turpal **et** le voyageur a déjà
traversé. Une condition simple de mécanisme ne suffit pas. Coder cette exception
dans `LevelRuntime` rendrait le chapitre impossible à relire dans ses données et
invisible au validateur d'impasses.

### Décision

1. Une arête accepte désormais `conditions`, une conjonction de
   `EdgeCondition`. Le raccourci historique `condition` reste valide.
2. Un `LevelActorDef` déclare le départ automatique d'un acteur, son trajet, le
   mécanisme temporairement verrouillé et l'état logique produit à son arrivée.
3. Cet état narratif vit dans le même magasin du `NavGraph` que les mécanismes.
   Pour l'hospitalité, `traveler-served` passe une seule fois de `false` à
   `true` : il est monotone et ne peut jamais retirer une progression acquise.
4. Le validateur applique automatiquement la complétion garantie de l'acteur
   lorsqu'il explore son état de départ. Il couvre donc les combinaisons
   réellement atteignables plutôt qu'une approximation écrite dans un test de
   chapitre.
5. Les volumes `LevelBlockDef.parent` sont attachés au mécanisme correspondant
   et conservent leur transformation monde. La passerelle visible et la
   connectivité logique tournent ainsi sous la même source de vérité.

### Alternatives considérées

| Option                                            | Pourquoi écartée                                                                |
| ------------------------------------------------- | ------------------------------------------------------------------------------- |
| **Autoriser immédiatement le cran sud**           | Contredit le récit : l'accueil ne serait plus la seule séquence valide          |
| **Déclencheur impératif propre au chapitre**      | État caché au level data, au visualiseur et au validateur d'impasses            |
| **Deuxième mécanisme visible ou dalle**           | Introduit une mécanique que le chapitre ne doit pas enseigner                   |
| **Retirer le chemin sud jusqu'à une cinématique** | Téléportation du graphe sans cause architecturale lisible                       |
| **Faire du voyageur un second joueur NavGraph**   | Complexité de pathfinding et risques de blocage inutiles pour un trajet garanti |

### Conséquences

- La route du chapitre 1 exige explicitement `hospitality-wheel=270` et
  `traveler-served=true`; pointer directement vers le sud ne fonctionne pas.
- La roue est désactivée pendant les pas du voyageur : la passerelle ne peut pas
  se dérober sous lui, puis redevient manipulable à son arrivée.
- L'exploration exhaustive couvre 67 états étendus et 7 combinaisons de
  mécanisme/état narratif, sans impasse.
- Les futurs acteurs autonomes peuvent réutiliser ce contrat, à condition que
  leur complétion soit garantie et que leur état ne régresse pas.

## ADR-030 : Harnais e2e et Lighthouse sans CDN Playwright (`BOV_CHROMIUM`)

### Contexte

Le bac à sable de QA n'atteint que registry.npmjs.org : ni le CDN Playwright
(navigateurs), ni un GPU. Sans e2e exécutables, la phase 10 n'aurait été
validée qu'en CI — or c'est précisément l'absence d'exécution locale qui a
laissé passer le bug bloquant du canvas 1 × 1 (ADR-031).

### Décision

1. `playwright.config.ts` accepte deux variables d'environnement optionnelles :
   `BOV_CHROMIUM` (chemin d'un binaire Chromium externe, ici
   `@sparticuz/chromium`, livré par npm avec ses bibliothèques AL2023) et
   `BOV_CHROMIUM_ARGS` (drapeaux, ici SwiftShader : rendu WebGL logiciel).
   Sans ces variables, la configuration reste strictement celle de Playwright.
2. La vidéo est coupée quand `BOV_CHROMIUM` est posé (le ffmpeg de Playwright
   vient du même CDN inaccessible).
3. Le même binaire sert à Lighthouse 11.7.1 via chrome-launcher (la
   catégorie PWA disparaît de Lighthouse ≥ 12 : version épinglée).
4. Les timeouts des tests tiennent compte du rendu logiciel : la chronologie
   d'animation avance par frame committée, un fondu CSS de 900 ms peut durer
   ~20 s sous SwiftShader (boot.spec, timeout 30 s documenté).

### Alternatives considérées

| Option                                  | Pourquoi écartée                                              |
| --------------------------------------- | ------------------------------------------------------------- |
| E2e uniquement en CI                    | A déjà masqué un bug bloquant ; boucle de correction trop lente |
| Vendre un Chromium dans le dépôt        | ~150 Mo binaires dans git, licence et mises à jour à gérer     |
| Puppeteer/chrome-headless-shell         | Deuxième harnais à maintenir, mêmes contraintes réseau         |

### Conséquences

- `pnpm test:e2e` tourne partout : CI (navigateurs Playwright officiels) et
  bacs à sable restreints (`BOV_CHROMIUM`).
- Le projet `mobile-390x844` (WebKit réel) reste réservé aux environnements
  où WebKit s'installe ; les émulations Pixel 5 / iPhone 12 tournent sur
  Chromium partout.

## ADR-031 : Le post-traitement ne pilote jamais la géométrie du canvas

### Contexte

Bug bloquant découvert en QA finale : le jeu ne rendait qu'**un pixel** dans
tout navigateur réel. Chaîne complète : `PostFX` naissait avec une taille
interne de 1 × 1 avant la première `resize()` ; `EffectComposer.setSize(w, h)`
appelé sans troisième argument relaie `renderer.setSize(w, h, updateStyle:
true)`, qui écrit `width: 1px; height: 1px` **dans le style inline du
canvas** ; `Renderer.resize()` relisait alors `canvas.clientWidth = 1` —
valeur truthy, donc le repli `|| innerWidth` ne jouait jamais — et redonnait
1 × 1 au composer. Point fixe indestructible. Les tests unitaires (jsdom) ne
le voyaient pas, et l'ancien test e2e (`canvas.width > 0`) passait avec 1.

### Décision

1. La taille CSS du canvas appartient **exclusivement** à la feuille de style
   (`#game-canvas { width: 100% … }`). Tout appel à `composer.setSize()` ou
   `renderer.setSize()` passe explicitement `updateStyle: false`.
2. `PostFX` s'initialise à la taille réelle du renderer
   (`renderer.getSize(new Vector2())`), jamais à une taille par défaut.
3. Le test e2e de démarrage exige que le tampon de dessin **couvre le
   viewport** (client ≈ viewport ± 2 px, buffer ≥ client − 2 px) — « le canvas
   existe » ne suffit plus.

### Alternatives considérées

| Option                                            | Pourquoi écartée                                                  |
| ------------------------------------------------- | ------------------------------------------------------------------ |
| Corriger seulement `Renderer.resize()` (`clientWidth` ≥ seuil) | Soigne le symptôme ; le style inline parasite resterait |
| `!important` sur la règle CSS du canvas           | Guerre de spécificité fragile, cause réelle intacte                 |
| Supprimer le post-traitement au boot puis l'attacher | Complexité de cycle de vie pour éviter une ligne d'API           |

### Conséquences

- Le style inline du canvas reste vide : une seule source de vérité (CSS),
  `Renderer.resize()` lit des dimensions fiables.
- Toute future passe de post-traitement doit respecter la règle n° 1 ; le
  test de régression de `boot.spec.ts` l'attrapera sinon.
- Leçon de process : un e2e jamais exécuté ne protège de rien — d'où l'ADR-030.
