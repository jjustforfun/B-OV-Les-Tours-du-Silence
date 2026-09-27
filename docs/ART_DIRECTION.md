# ART DIRECTION — BӀOV : Les Tours du Silence

> « Chaque image doit pouvoir servir de fond d'écran. » (pilier n° 1)

Document de direction artistique **exploitable** : chaque intention est
accompagnée de sa valeur, de son fichier et de sa contrainte de performance.
Contraintes transverses : ADR-008 (rendu stylisé), ADR-022 (aucune shadow map
dynamique sur mobile), `docs/PERFORMANCE.md` (budgets).

---

## 1. Style de rendu

| Élément                               | Choix                                                                                                                                                    | Où c'est implémenté                                                              | Contrainte                          |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | ----------------------------------- |
| **Low-poly adouci**                   | Silhouettes franches, arêtes légèrement biseautées (chanfrein de 0,02 unité) plutôt que vives : la lumière accroche l'arête et dessine le volume.        | Géométries construites dans `src/world/Level.ts`                                 | ≤ 150 k triangles à l'écran         |
| **Flat shading + toon ramp 3 bandes** | Ombre / demi-teinte / lumière. Seuils à **0,32** et **0,66**. Plancher d'ombre à **0,32** : une ombre n'est jamais noire, elle prend la couleur du ciel. | `src/render/materials/ToonStoneMaterial.ts`, rampe en `DataTexture` 1×4 partagée | 1 seul upload GPU pour tout le jeu  |
| **Vertex AO**                         | Occlusion cuite dans les sommets à la construction du niveau (angles rentrants, dessous de dalle, bas de mur). C'est la **seule occlusion sur mobile**.  | Attribut `aAo` (float par sommet), multiplié dans le fragment                    | Coût d'exécution : nul              |
| **Vertex colors**                     | Variation de teinte pierre par pierre (±6 % de valeur, ±4° de teinte) : aucune texture n'est chargée pour l'architecture.                                | Attribut `color`                                                                 | 0 octet de texture                  |
| **Brouillard de hauteur**             | Sépare les plans, donne l'échelle des tours. L'élément d'ambiance **prioritaire** : s'il faut couper quelque chose, ce n'est pas lui.                    | `FogExp2` dans `src/render/Sky.ts`                                               | ~0 ms                               |
| **Ciel en dégradé**                   | Dégradé vertical en `DataTexture` 1×64, pas de skybox, pas d'HDRI.                                                                                       | `createGradientTexture()`                                                        | quelques centaines d'octets         |
| **Rim light**                         | Liseré froid (desktop) ou chaud (sur Turpal) sur 12 % du bord de silhouette : détache les personnages du fond.                                           | `ToonStoneMaterial` / `Lighting.ts`                                              | 3 instructions de shader            |
| **Ombres**                            | Desktop : shadow map 1024/2048 px, directionnelle unique. Mobile : **jamais** — ombres blob (quad texturé, 1 draw call instancié).                       | `Quality.settings.shadows` (ADR-022)                                             | Règle verrouillée par test unitaire |
| **Pas de PBR**                        | Ni metalness/roughness, ni IBL, ni normal map.                                                                                                           | —                                                                                | —                                   |

Éclairage type (`src/render/Lighting.ts`) : une **directionnelle** chaude
(clé, intensité 1,1), une **hémisphérique** ciel/sol (remplissage, 0,45), une
**ponctuelle ambre** attachée aux yeux de Borz (0,6, portée 3). Jamais plus de
trois sources dynamiques.

---

## 2. Architecture — les tours vainakhs

Référence : tours d'Itum-Kale, Nikaroy, Khoy. Ce sont des **monuments réels
encore debout** : on ne les montre jamais en ruine (ADR-021).

### 2.1 Canon de construction (respecter ces proportions)

| Caractéristique            | Valeur en unités de grille                                             | Note                                                                                   |
| -------------------------- | ---------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Base                       | carrée, 5 × 5 à 6 × 6                                                  | l'assise est toujours plus large que le sommet                                         |
| Hauteur                    | 20 à 25                                                                | soit 4 à 5 niveaux                                                                     |
| **Fruit** (rétrécissement) | ~8 % par niveau, faces légèrement concaves                             | c'est ce qui donne l'élancement ; une tour à faces parallèles est immédiatement fausse |
| Toit                       | **pyramidal à gradins**, 5 à 7 gradins, pierre de faîte conique        | signature visuelle des tours de combat                                                 |
| Entrée                     | au **premier étage**, jamais au sol                                    | escalier extérieur amovible ou échelle                                                 |
| Ouvertures                 | **meurtrières** étroites (0,2 × 0,6), 2 à 3 par face, jamais alignées  | + 1 à 2 fenêtres géminées aux étages hauts                                             |
| Appareil                   | **pierre sèche**, assises irrégulières, joints marqués en creux (0,03) | jointoiement visible = échelle lisible                                                 |
| Encorbellements            | consoles saillantes sous le dernier niveau (0,3 de débord)             | portent balcons et mâchicoulis                                                         |

### 2.2 Ornements

| Motif                                                                        | Emplacement                 | Comportement                                                                             |
| ---------------------------------------------------------------------------- | --------------------------- | ---------------------------------------------------------------------------------------- |
| **Spirales**                                                                 | linteaux, claveaux d'entrée | gravées en creux (0,02), s'allument en braise quand le mécanisme associé est manipulable |
| **Signes solaires** (rosaces, croix gammée solaire _stylisée avec prudence_) | dalles, dessus de mur       | pulsation à 0,5 Hz quand actif                                                           |
| **Pétroglyphes** (empreintes de main, animaux schématiques)                  | pierres d'angle             | s'allument **au passage** de Turpal, 1,2 s, puis s'éteignent                             |
| **Pierre de fondation gravée**                                               | base de chaque tour         | s'allume définitivement quand la tour est reliée                                         |

Implémentation : les gravures sont de la **géométrie en creux** (pas de
texture) + un canal d'émission contrôlé par `uEmissive` ; on les allume par
uniform, pas par changement de matériau — pour ne pas casser l'instanciation.

> **Prudence culturelle** : les motifs sont inspirés de pétroglyphes réels
> mais **jamais copiés d'une tour identifiable**, et jamais associés à un
> symbolisme religieux ou politique (`docs/CULTURE.md`).

---

## 3. Palettes par chapitre

Cinq couleurs par chapitre : **ciel haut / ciel bas / pierre ombre / pierre
lumière / accent**. Valeurs exploitables telles quelles dans
`src/render/Palettes.ts` (`CHAPTER_PALETTES`), en cohérence avec
`SKY_PALETTES` (`src/render/Sky.ts`).

| #   | Chapitre               | Ambiance                             | Ciel haut | Ciel bas  | Pierre ombre | Pierre lumière | Accent    |
| --- | ---------------------- | ------------------------------------ | --------- | --------- | ------------ | -------------- | --------- |
| 0   | Le Retour              | Aube rose et ardoise                 | `#1b2230` | `#e3b7a6` | `#39425a`    | `#8e93a6`      | `#d9a441` |
| 1   | L'Hospitalité          | Ocre chaud et vert pâturage          | `#3a3226` | `#c9a35c` | `#5c5340`    | `#a89372`      | `#6b7c4a` |
| 2   | La Parole donnée       | Turquoise du torrent et gris schiste | `#1d2a30` | `#7fc2c9` | `#3a4750`    | `#8d96a0`      | `#3f8fa3` |
| 3   | Le Respect des anciens | Sépia et or                          | `#2a2219` | `#e6d3a8` | `#55432c`    | `#a08a63`      | `#c9a24a` |
| 4   | La Patience            | Bleu nuit et argent lunaire          | `#0f1526` | `#8fa4c4` | `#1b2740`    | `#6f7f9c`      | `#dfe7f2` |
| 5   | Le Pardon              | Brun rouille et braise               | `#241a16` | `#c2643f` | `#4a2c22`    | `#8a6a55`      | `#d9a441` |
| 6   | L'Humilité             | Blanc neige et bleu glacier          | `#46536b` | `#f2f7fb` | `#6d84a3`    | `#cfe0ec`      | `#9fb8cf` |
| 7   | Le Chant revenu        | Or et toutes les teintes réunies     | `#1a2030` | `#d9a441` | `#2c3444`    | `#e8e0d2`      | `#c2643f` |

**Règles de couleur, non négociables :**

1. La **braise `#d9a441` est la seule couleur chaude saturée** de l'interface
   et du monde : elle signifie « ceci est actionnable ». Elle n'apparaît nulle
   part ailleurs — sauf les yeux de Borz (ambre) et la traînée de célébration.
2. Les ombres **ne sont jamais noires** : elles prennent la teinte du ciel
   haut, valeur plancher 0,32.
3. Chaque palette doit rester lisible en **mode daltonien** : l'accent est
   toujours doublé d'un **liseré** ou d'une **pulsation**, jamais seul.
4. L'encre du texte est `#e8e0d2` sur voile sombre, contraste ≥ 7:1.

---

## 4. Turpal

Fiche personnage figée par `brief.yaml` ; implémentation v1 procédurale dans
`src/entities/player/TurpalModel.ts` (ADR-006).

| Élément                            | Couleur               | Note                                                         |
| ---------------------------------- | --------------------- | ------------------------------------------------------------ |
| Tcherkesska                        | `0x2b2f3a` anthracite | vêtement principal, sombre                                   |
| Gazyri (cartouchières décoratives) | `0xc8ccd4` argent     | **2 rangées de 6** — repère de lecture sur la poitrine       |
| Papakha                            | `0xb9bec9` gris clair | **le repère visuel** : la tache la plus claire du personnage |
| Ceinture                           | `0x8a6f3d`            | fine, ornée                                                  |
| Bottes                             | `0x3a3228`            | souples, sans talon                                          |
| Peau                               | `0x9b7c62`            | barbe courte                                                 |
| Armes                              | **aucune**            | règle absolue (`brief.yaml`, `docs/CULTURE.md`)              |

**Lisibilité — l'exigence dimensionnante** : Turpal mesure **0,85 unité**,
soit environ **40 px de haut** à l'écran en cadrage standard. À cette taille :

- la silhouette doit être reconnaissable **en noir sur blanc** (test
  obligatoire : capture, seuillage, on doit encore lire « un homme debout,
  coiffé ») ;
- la **papakha claire** au sommet donne la position de la tête en une
  fixation, sur fonds clairs comme sombres ;
- **rim light chaude** (`#d9a441` à 25 %) sur le bord opposé à la lumière
  clé : c'est elle qui empêche le personnage de se fondre dans la pierre ;
- les proportions sont légèrement stylisées (tête à 1/6,5 de la hauteur au
  lieu de 1/7,5) pour rester lisibles ;
- budget : **≤ 6 000 triangles** pour la v2 sculptée ; la v1 procédurale en
  utilise ~600.

---

## 5. Effets

| Effet                             | Fichier             | Densité (qualité high / medium / low) | Note                                                                                                                                       |
| --------------------------------- | ------------------- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| **Brume qui dérive**              | `fx/Mist.ts`        | 3 / 2 / 1 nappes                      | quads alignés caméra, dérive 0,05 u/s, opacité 0,12 — jamais plus                                                                          |
| **Neige**                         | `fx/Snow.ts`        | 400 / 280 / 140 flocons               | `Points` unique, recyclage en boucle, vent latéral sinusoïdal                                                                              |
| **Lucioles**                      | `fx/Fireflies.ts`   | 60 / 42 / 21                          | chapitres 4 et 7, pulsation individuelle désynchronisée                                                                                    |
| **Poussière dans les rayons**     | `fx/LightShafts.ts` | 120 / 84 / 0                          | uniquement là où un rayon traverse une meurtrière                                                                                          |
| **Pierres qui se reconstruisent** | `fx/Particles.ts`   | 40 / 28 / 14 éclats                   | les particules **s'assemblent** vers leur position finale (`expo.out`, 700 ms) : l'inverse d'une explosion. C'est l'effet signature du jeu |
| **Traînée dorée**                 | `fx/Celebrate.ts`   | toujours actif                        | court le long du chemin connecté à 8 u/s, largeur 0,06, s'estompe en 900 ms derrière elle                                                  |

Règles : **zéro allocation par image** (tous les systèmes utilisent
`utils/pool.ts`) ; tous les effets passent par `Quality.settings.particleScale`
(`0.35 / 0.7 / 1.0`) ; `prefers-reduced-motion` divise les vitesses par 2 et
supprime la dérive de brume.

---

## 6. Animation

| Sujet                  | Réglage                                                                                                                             | Note                                                                    |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| **Mécanismes**         | `expo.out`, **900 ms** (`PACING.mechanismDurationMs`)                                                                               | courbe unique pour tous les mécanismes : le jeu a un seul « poids »     |
| **Marche de Turpal**   | **1,1 m/s** ≈ 2,1 cellules/s (`PACING.walkSpeed`), cycle de 0,72 s                                                                  | balancement latéral du torse de ±1,5°, avance-retard des bras de 0,08 s |
| **Idle**               | respiration à 0,22 Hz (amplitude 0,008 unité sur le torse) ; toutes les 9 à 14 s, **ajustement de la papakha** (main droite, 1,1 s) | l'ajustement est ce qui rend le personnage vivant à l'arrêt             |
| **Salut aux anciens**  | main droite à plat sur le cœur, buste incliné de 12°, 1,4 s, maintien 0,6 s                                                         | déclenché à ≤ 2 unités d'un ancien (`entities/npc/Elder.ts`)            |
| **Bascule de gravité** | 450 ms, `power2.inOut`, caméra et personnage synchronisés                                                                           | jamais le monde (ADR-004)                                               |
| **UI**                 | 180 ms (micro-retour), 420 ms (apparition), 900 ms (transition), 1800 ms (chapitre)                                                 | jetons `--dur-*` dans `ui/styles/tokens.css`                            |

Bibliothèque : **GSAP** pour tout ce qui est tween scénarisé ;
`utils/easing.ts` pour les courbes utilisées dans la boucle de rendu (aucune
allocation).

---

## 7. Typographie

| Usage                               | Police                 | Graisse / taille    | Note                                                                      |
| ----------------------------------- | ---------------------- | ------------------- | ------------------------------------------------------------------------- |
| Titres, proverbes, noms de chapitre | **Cormorant Garamond** | 300 / 400, 28–56 px | élégante, à fort contraste : elle porte le côté « manuscrit de montagne » |
| Interface, réglages, sous-titres    | **Inter**              | 400 / 500, 14–20 px | lisibilité maximale à petite taille                                       |

- **Auto-hébergées** : `public/fonts/`, format **woff2**, sous-ensembles
  `latin` + `cyrillic` (le russe et le tchétchène en ont besoin),
  `font-display: swap`, préchargement des deux graisses réellement utilisées.
  Aucune requête vers Google Fonts (hors ligne + vie privée).
- Budget : ≤ 60 ko pour l'ensemble des fontes.
- **Tout texte est posé sur un voile translucide** :
  `background: rgba(13, 17, 23, 0.72)`, `backdrop-filter: blur(8px)` (avec
  repli opaque si non supporté), rayon 12 px, padding 20/24 px. Jamais de
  texte directement sur la scène — la lisibilité ne dépend pas du décor.
- Taille du texte réglable (petite / normale / grande) via le jeton
  `--font-scale` (0,875 / 1 / 1,25).

---

## 8. Composition

- **Une image = un niveau.** Le niveau entier tient dans le cadre, sans
  scroll ni caméra libre (ADR-002).
- **Auto-fit orthographique** : `CameraRig.frameLevel(bounds)` calcule
  `viewSize` pour que la boîte englobante du niveau tienne avec une marge de
  **8 %** ; en portrait c'est le champ **vertical** qui s'élargit, jamais
  l'angle qui change.
- Cibles de cadrage : **1920 × 1080** (paysage) et **390 × 844** (portrait) —
  les deux viewports de la Definition of Done. Tout niveau doit être validé
  dans les deux.
- Les éléments interactifs restent à ≥ 12 % des bords de l'écran en portrait,
  pour ne jamais tomber sous le pouce ni dans une safe-area.
- Règle des tiers appliquée à la **tour principale** ; le vide (ciel, brume)
  occupe au moins 40 % de l'image : c'est le silence, visuellement.
