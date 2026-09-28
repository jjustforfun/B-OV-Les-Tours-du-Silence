# CONTROLS — BӀOV : Les Tours du Silence

Doctrine : le gameplay ne connaît ni la souris, ni le doigt, ni le clavier. Il
connaît des **intentions** (`InputAction` dans `src/input/InputManager.ts`).
Chaque périphérique traduit ses événements en intentions ; ajouter une manette
ou Capacitor ne touche jamais au jeu.

```
PointerInput ─┐
KeyboardInput ├─► InputManager (EventBus<InputEvents>) ─► systèmes de jeu
GamepadInput ─┘
```

---

## 1. Souris et tactile

| Geste                                    | Effet                                             | Détail d'implémentation                                                                                                                   |
| ---------------------------------------- | ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| **Clic / tap sur une surface marchable** | Turpal y marche                                   | Raycast → nœud le plus proche → A\*. **Marqueur doux à l'arrivée** : anneau de 0,4 unité qui s'ouvre puis s'efface en 420 ms (`expo.out`) |
| **Clic / tap sur un mécanisme**          | Actionne d'un cran (rotator) ou bascule (dalle)   | Équivalent d'un glissement minimal                                                                                                        |
| **Glisser sur un mécanisme**             | Il tourne ou glisse **en suivant le doigt** (1:1) | Rotator : projection tangentielle ; slider : projection sur l'axe du rail. **Aimantation au relâchement** (90° / unité entière)           |
| **Glisser ailleurs**                     | Rien                                              | Aucun défilement, aucune inertie                                                                                                          |
| **Appui long sur Borz** (1,2 s)          | Demande d'indice                                  | Équivalent tactile de la touche `H`                                                                                                       |
| **Pincer, double-tap, molette**          | **Rien du tout**                                  | Pas de zoom, pas de caméra libre : le cadrage est composé par le designer (ADR-002). La molette et le pincement sont explicitement avalés |

Le curseur souris change de forme au survol d'un élément manipulable
(`cursor: grab` → `grabbing`), seule concession au desktop. La cible d'un
glissement est figée au `pointerdown` : franchir le seuil de 8 px au-dessus
d'un autre mécanisme ne change jamais la pierre manipulée. `pointercancel`,
perte de capture, sortie de fenêtre, suspension et pause soldent le geste une
seule fois ; une pause appelle l'aimantation avant de geler la simulation.

Ces invariants sont couverts automatiquement. Le blocage effectif du zoom et
du rebond doit encore être confirmé sur Safari iOS et Chrome Android réels.

---

## 2. Clavier

Le jeu est **entièrement jouable sans souris** — exigence d'accessibilité, pas
un bonus.

### 2.1 Table par défaut

| Touche (QWERTY)     | Touche (AZERTY) | Action                                                               | `InputAction`                |
| ------------------- | --------------- | -------------------------------------------------------------------- | ---------------------------- |
| ↑ ↓ ← →             | ↑ ↓ ← →         | Déplacer Turpal vers le nœud voisin **dans la direction de l'écran** | `moveUp/Down/Left/Right`     |
| W A S D             | Z Q S D         | idem                                                                 | idem                         |
| `Tab` / `Shift+Tab` | idem            | Cycler entre les mécanismes interactifs                              | `cycleNext` / `cyclePrev`    |
| Q / E               | A / E           | Tourner le mécanisme sélectionné (−90° / +90°)                       | `rotateLeft` / `rotateRight` |
| `Espace` / `Entrée` | idem            | Activer, interagir, valider                                          | `confirm`                    |
| `Retour arrière`    | idem            | Annuler / fermer                                                     | `cancel`                     |
| `H`                 | `H`             | Demander un indice (passe au palier suivant)                         | `hint`                       |
| `Échap` / `P`       | idem            | Pause                                                                | `pause`                      |
| `M`                 | `M`             | Couper le son                                                        | `muteToggle`                 |
| `F`                 | `F`             | Plein écran                                                          | `fullscreenToggle`           |

### 2.2 Pourquoi AZERTY fonctionne sans rien détecter

Les bindings sont écrits sur `event.code`, c'est-à-dire la **position
physique** de la touche, jamais le caractère imprimé (ADR-023). Or le cluster
ZQSD d'un AZERTY occupe exactement les mêmes positions que WASD sur un
QWERTY — de même que A/E occupe les positions de Q/E. Le jeu marche donc sur
les deux dispositions **sans détection ni configuration**.

La disposition n'est lue que pour **afficher le bon libellé** dans les
réglages, via `keyLabel(code)` qui s'appuie sur
`navigator.keyboard.getLayoutMap()` (repli sur le code lorsque l'API n'existe
pas — Firefox, Safari).

### 2.3 Sélection et déplacement au clavier

- `Tab` cycle dans les mécanismes **par proximité écran**, pas par ordre de
  déclaration : c'est ce que le joueur attend en regardant l'image.
- Le mécanisme sélectionné reçoit un **contour braise de 2 px** et une
  pulsation à 0,5 Hz — la même affordance que le survol souris, donc rien à
  réapprendre.
- Le déplacement directionnel choisit le voisin dont la direction **projetée à
  l'écran** est la plus proche de la touche pressée (angle < 60°) ; en cas
  d'égalité, le moins coûteux. Rien ne se passe s'il n'y a pas de voisin :
  aucun bip, aucune pénalité.

### 2.4 Remappage

Intégral, dans les réglages : `KeyboardInput.setBindings(table)` remplace la
table entière. La table est une donnée (`Record<code, InputAction>`),
persistée via `Platform` (ADR-011) sous `bov.settings.v1`. Un bouton « rétablir
les touches par défaut » restaure `DEFAULT_BINDINGS`.

---

## 3. Manette

Support de base (`brief.yaml`), via l'API Gamepad, sondée chaque image
(`GamepadInput.poll()`).

| Contrôle                 | Action                                                                                             |
| ------------------------ | -------------------------------------------------------------------------------------------------- |
| **Stick gauche**         | Déplacement (direction écran, zone morte 0,35, répétition toutes les 220 ms tant qu'il est poussé) |
| **Croix directionnelle** | Idem, par à-coups                                                                                  |
| **Gâchettes L2 / R2**    | Tourner le mécanisme sélectionné (−90° / +90°)                                                     |
| **L1 / R1**              | Cycler entre les mécanismes                                                                        |
| **A / croix**            | Activer, valider                                                                                   |
| **B / rond**             | Annuler                                                                                            |
| **Y / triangle**         | Indice                                                                                             |
| **Start / Options**      | Pause                                                                                              |

Vibration : mêmes motifs que l'haptique mobile (`tick`, `snap`, `celebrate`),
via `gamepad.vibrationActuator` quand il existe.

---

## 4. Mobile

| Exigence                       | Valeur                                                                                                                                             | Implémentation                                                                 |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| **Cibles tactiles**            | ≥ **44 × 44 px** (CSS), 48 px recommandés                                                                                                          | Boutons UI dimensionnés par le jeton `--tap-min: 44px`                         |
| **Tolérance de tap**           | Raycast élargi : si le rayon central ne touche rien, on relance **4 rayons** à 12 px (haut/bas/gauche/droite) et on retient le nœud le plus proche | `PointerInput.pickWithTolerance()` — un petit levier reste attrapable au pouce |
| **Seuil de glissement**        | 8 px avant de considérer un geste comme un drag (sinon c'est un tap)                                                                               | évite de faire tourner un mécanisme par accident                               |
| **Vibration**                  | `tick` `[8]` à la sélection, `snap` `[14, 30, 10]` au cran, `celebrate` `[10, 40, 12, 40, 18]` à la résolution                                     | `input/Haptics.ts` → `Platform.vibrate()`, désactivable dans les réglages      |
| **Safe-areas**                 | `env(safe-area-inset-*)` sur tous les panneaux ; `viewport-fit=cover` dans `index.html`                                                            | aucun élément interactif sous l'encoche ou la barre de gestes                  |
| **Pas de scroll, pas de zoom** | `touch-action: none` sur le canvas, `user-scalable=no`, `overscroll-behavior: none`, `-webkit-text-size-adjust: 100%`                              | le canvas ne bouge jamais                                                      |
| **Pull-to-refresh**            | Verrouillé : `overscroll-behavior-y: contain` sur `html, body` + `preventDefault()` sur `touchmove` hors UI scrollable                             | un tirage vers le bas ne doit jamais recharger la partie                       |
| **Double-tap zoom**            | Supprimé par `touch-action: manipulation` sur l'UI                                                                                                 | —                                                                              |
| **Rotation d'écran**           | Libre : portrait et paysage recadrent le niveau (`CameraRig.setAspect`) sans changer la géométrie projetée                                         | validé en 390 × 844 **et** 1920 × 1080 (Definition of Done)                    |

---

## 5. Accessibilité

| Besoin                   | Réponse                                                                         |
| ------------------------ | ------------------------------------------------------------------------------- |
| Sans souris              | Table clavier complète (§ 2), focus visible partout                             |
| Lecteur d'écran          | Panneaux DOM nommés, annonces polies, écrans inactifs `inert` + `aria-hidden`   |
| Motricité fine           | Aucune action chronométrée, aucun geste précis requis, tolérance de tap élargie |
| `prefers-reduced-motion` | Durées divisées par 2, dérive de brume et parallaxe supprimées                  |
| Daltonisme               | La braise est toujours doublée d'un liseré ou d'une pulsation                   |
| Audition                 | Sous-titres des événements sonores signifiants ; aucun puzzle ne dépend du son  |
| Confort de lecture       | Taille du texte réglable (0,875 / 1 / 1,25)                                     |

`UIRoot` monte chaque panneau dans une racine unique. Son annonceur
`role="status"` poli et atomique signale le nom de l'écran sans recevoir le
focus. Une modale rend tous les écrans inférieurs inertes et absents de l'arbre
d'accessibilité ; `Tab` reste dans l'écran actif. À la fermeture, le focus
revient à la cible exacte mémorisée pour ce niveau, ou au premier contrôle
encore disponible si cette cible a été reconstruite ou supprimée.
