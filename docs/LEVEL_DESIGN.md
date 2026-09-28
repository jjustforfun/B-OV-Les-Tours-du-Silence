# LEVEL DESIGN — BӀOV : Les Tours du Silence

---

## 1. Règles opposables

| #   | Règle                                                                                                                                                             | Vérification                                                                     |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| 1   | **Un moment « wow » par niveau**, et un seul. C'est l'image que le joueur racontera.                                                                              | Revue de design : il doit tenir en une phrase                                    |
| 2   | **Un secret par niveau** : un aigle caché, atteignable par un détour gratuit ou un alignement improbable. Sa récompense est une illustration, jamais un avantage. | `LevelTriggerDef` avec `play: { eagleFound: true }`                              |
| 3   | **Durée 5 à 12 min** (`brief.yaml`). En dessous, le chapitre n'existe pas ; au-dessus, la contemplation devient de l'ennui.                                       | Chronométrage playtest, 3 joueurs minimum                                        |
| 4   | **Lisibilité d'abord.** Si le joueur ne comprend pas ce qu'il voit, aucune élégance de puzzle ne le sauvera.                                                      | Test du seuillage noir et blanc : la structure doit rester lisible               |
| 5   | **Une seule mécanique nouvelle par chapitre** (`AGENTS.md`).                                                                                                      | Tableau de progression du GDD § 3                                                |
| 6   | **Aucune impasse possible.** Aucune combinaison d'états de mécanismes ne peut rendre le but inatteignable.                                                        | Validateur automatique (phase 2) : exploration exhaustive des états atteignables |
| 7   | **Blocage ≤ 3 min** avant aide diégétique (90 s lueur, 180 s regard de Borz).                                                                                     | `PACING.hintGlowDelayMs` / `hintGazeDelayMs`                                     |
| 8   | **Le niveau tient dans le cadre**, en portrait (390 × 844) comme en paysage (1920 × 1080).                                                                        | Auto-fit `CameraRig.frameLevel`, marge 8 %                                       |
| 9   | **Rien ne punit.** Aucun retour en arrière forcé, aucune manipulation à refaire à l'identique.                                                                    | Revue                                                                            |
| 10  | **L'illusion se défait si la caméra bouge** — donc la caméra ne bouge pas pendant une énigme.                                                                     | ADR-002                                                                          |

### Méthode de fabrication (dans cet ordre, jamais un autre)

1. **Une phrase** : quelle vertu, quel geste du joueur.
2. **Croquis papier** de l'image « wow ».
3. **Graphe de navigation seul**, sans géométrie : nœuds, arêtes, arêtes
   conditionnelles. On joue le niveau en `NavGraphViz` — si ce n'est pas
   intéressant en fil de fer, ce ne le sera pas en pierre.
4. **Validation des illusions** : `auditIllusions()` doit rendre `aligned`
   pour chaque paire prévue, avec un écart ≤ 6 px.
5. **Géométrie** (`LevelBlockDef`), puis palette, puis son.
6. **Playtest** : on regarde où le joueur regarde, pas ce qu'il dit.

Légende des croquis (vue de dessus, grille = 1 cellule) :
`█` pierre pleine · `▓` plateforme marchable · `≡` escalier · `═` passerelle ·
`○` nœud remarquable · `◎` mécanisme · `▲` Turpal (départ) · `★` but ·
`𝔅` Borz · `✧` secret (aigle) · `⟿` illusion (liaison purement visuelle).

---

## 2. Chapitre 0 — « Le Retour » · l'aoul natal

**Wow** : un escalier monte vers le vide et rejoint pourtant le seuil de la
tour. **Secret** : un aigle posé sur le toit, visible seulement depuis le
palier intermédiaire. **Durée** : 5 min.

```
        N
   ┌─────────────────────────────┐
   │   █████ tour ancestrale     │
   │   █ ★ █  (seuil au 1er)     │
   │   ██○██                     │
   │     ⟂ fente  ⟿⟿⟿⟿ (illusion) │
   │        ≡≡≡ escalier          │
   │       ≡    qui s'arrête      │
   │      ≡     dans l'air ○      │
   │   ▓▓▓▓▓▓▓ cour               │
   │   ▓  𝔅  ▓   (loup couché)    │
   │   ▓▓○▓▓▓▓                    │
   │      ▲ sentier               │
   └─────────────────────────────┘
```

**Illusion principale** : la dernière marche de l'escalier et le seuil de la
tour sont séparés de 6 unités en profondeur, mais **se superposent à l'écran**
sous l'angle isométrique. Aucune indication : c'est au joueur de tenter le tap.
La leçon tacite est « ce que tu vois fait loi ».

---

## 3. Chapitre 1 — « L'Hospitalité » · Itum-Kale

**Wow** : la passerelle orientée pour le voyageur révèle, en pivotant une fois
de plus, le chemin de Turpal qu'on croyait sacrifié. **Secret** : un aigle sur
une meurtrière, visible uniquement quand la roue est en position 3 (inutile au
puzzle). **Durée** : 7 min.

```
   ┌──────────────────────────────────┐
   │  ▓▓▓ terrasse haute ○────═══──○  │
   │  ▓ voyageur ✦        ║           │
   │  ▓▓▓                 ║ passerelle│
   │        ◎ roue (4 positions)      │
   │        ║  N:voyageur E:vide      │
   │        ║  S:Turpal   O:cour      │
   │  ▓▓▓▓▓▓○▓▓▓▓  place du village   │
   │  ▓  ▲  ▓  ✧ (aigle, toit ouest)  │
   │  ▓▓▓▓▓▓▓  ≡≡ vers ★              │
   └──────────────────────────────────┘
```

**Illusion principale** : aucune — le chapitre introduit le rotator, il doit
rester limpide. L'« illusion » est morale : on croit que servir le voyageur
coûte son propre chemin.

---

## 4. Chapitre 2 — « La Parole donnée » · gorge de l'Argun

**Wow** : le raccourci se referme lentement pendant qu'on construit le pont —
le renoncement est **visible**. **Secret** : un aigle dans la brume du fond de
gorge, visible en descendant sur la rive inutile. **Durée** : 8 min.

```
   ┌────────────────────────────────────┐
   │ rive ouest            rive est     │
   │  ▓▓▓○         ~~~~~     ○▓▓▓       │
   │  ▓ ▲ ▓  ◄──[  slider  ]──►  ▓ ✦ ▓ │  ✦ = enfant
   │  ▓▓▓▓▓   ◎ 3 cellules       ▓▓▓▓  │
   │    ║                          ║    │
   │    ≡ raccourci (3 blocs)      ≡    │
   │    ░░░ se referme cran par cran    │
   │        ✧ (aigle, sous le pont)     │
   │              ★ (rive est, aval)    │
   └────────────────────────────────────┘
```

**Illusion principale** : le raccourci et le pont promis **partagent les mêmes
trois blocs**. Vus de face ils semblent deux structures distinctes ; c'est
l'angle isométrique qui cache qu'un seul jeu de pierres sert les deux.

---

## 5. Chapitre 3 — « Le Respect des anciens » · Nikaroy

**Wow** : l'architecture entière **se rabaisse**, marche après marche, pour
épouser le pas du vieil homme. **Secret** : un aigle sur une stèle, visible
seulement à hauteur d'œil de l'ancien (donc après abaissement). **Durée** :
9 min.

```
   ┌────────────────────────────────────┐
   │  nécropole (stèles basses)         │
   │  ▓ ✧ ▓ ▓ ▓ ▓ ▓ ▓                  │
   │        ↓ l'ancien avance seul      │
   │  ○────○────○────○────○  parcours   │
   │  ≡≡≡  ≡≡   ≡    ▓    ▓             │
   │  h=3  h=2  h=1  h=0  h=0 ← marches │
   │   ◎    ◎    ◎   abaissées par      │
   │  dalle dalle dalle  Turpal + 𝔅     │
   │  ▲ (Turpal, terrasse haute)        │
   │              ★ tours jumelles      │
   └────────────────────────────────────┘
```

**Illusion principale** : deux tours jumelles séparées de 8 unités se
superposent **exactement** à l'écran, formant une seule tour double hauteur :
c'est par cette « fausse » tour que passe l'ancien.

---

## 6. Chapitre 4 — « La Patience » · lac Kezenoy-Am

**Wow** : le reflet n'est pas un reflet — c'est un second niveau jouable, que
la lune ouvre. **Secret** : un aigle qui ne se montre que pendant les 6
secondes où la lune est au zénith. **Durée** : 11 min.

```
   ┌────────────────────────────────────┐
   │  ▓▓▓ rive    ◎ tour pivotante      │
   │  ▓ ▲ ○────≡≡≡███                  │
   │  ▓▓▓▓        ███ porte lunaire ◎   │
   │ ~~~~~~~~~~~~~~~~~~~~~~~~ surface   │
   │  ▒▒▒▒        ▒▒▒ (monde reflété)   │
   │  ▒ ○ ○────≡≡≡▒▒▒  ★ dans le reflet │
   │  ▒▒▒▒   ✧                          │
   │  la lune monte : 0 → 40 s          │
   └────────────────────────────────────┘
```

**Illusion principale** : le reflet est une **copie du graphe**, miroir en Y.
Un escalier réel et son reflet se touchent à la surface de l'eau : Turpal
passe d'un monde à l'autre en marchant **à travers** la ligne d'eau, sans
transition.

---

## 7. Chapitre 5 — « Le Pardon » · la tour brisée

**Wow** : les deux moitiés pivotent l'une vers l'autre et la fracture se
referme — **sans qu'aucune pierre ne soit remplacée**. **Secret** : un aigle
dans la fente, visible uniquement quand elle est encore ouverte. **Durée** :
10 min.

```
   ┌────────────────────────────────────┐
   │   moitié ouest  │  moitié est      │
   │   ███◎          │        ◎███      │
   │   ███ rotation  │ rotation ███     │
   │   ███ ○         │       ○  ███     │
   │   ≡≡≡  ✧ fente  │          ≡≡≡     │
   │   ▓▓▓▲          │          ▓▓▓✦    │  ✦ = le rival
   │      paroi ║ (up = [0,0,1])        │
   │            ║ GravityPath           │
   │                 ★ au faîte         │
   └────────────────────────────────────┘
```

**Illusion principale** : les deux moitiés ne se rejoignent que dans **une**
des seize combinaisons d'angles, et cette combinaison n'est pas symétrique :
la moitié de Turpal doit se tourner **la première**. Le pardon est encodé dans
l'ordre des opérations.

---

## 8. Chapitre 6 — « L'Humilité » · Tebulosmta

**Wow** : le sommet s'atteint en marchant **sous** la montagne, la tête vers la
vallée. **Secret** : un aigle qui vole **au-dessous** de Turpal une fois
celui-ci retourné. **Durée** : 12 min.

```
   ┌────────────────────────────────────┐
   │              ★ sommet              │
   │           ▓▓▓▓▓ (accessible par    │
   │          ╱      le dessous)        │
   │  ██████████████  arche             │
   │  ‾‾‾○‾‾‾○‾‾‾○‾‾  plafond marchable │
   │      up = [0,-1,0]        ✧        │
   │  ║ paroi (up=[0,0,1])              │
   │  ║ ○  𝔅 porte le voyageur, l'enfant│
   │  ║ ○    puis l'ancien et le rival  │
   │  ▓▓▓▲ névé (départ, surface: snow) │
   └────────────────────────────────────┘
```

**Illusion principale** : vu d'en haut, le plafond de l'arche et le sentier du
sommet forment **une seule ligne continue**. C'est en acceptant de descendre
(et de se retourner) que la ligne devient vraie.

**Séquence réalisée** : Turpal descend avec le névé, oriente la tour, bascule
sur la paroi (`up=[0,0,1]`), puis sous l'arche (`up=[0,-1,0]`). La caméra roule
avec le vecteur `up` courant. Pendant ce temps, Borz effectue quatre allers
chargés et trois retours à vide dans l'ordre voyageur → enfant → ancien →
rival. La jonction illusoire reste verrouillée jusqu'au dernier dépôt ; ses deux
extrémités sont distantes de `(6,6,6)` dans le monde, selon l'axe de vue, et se
superposent donc à 0 px. Turpal traverse à pied et atteint le sommet en dernier.

---

## 9. Chapitre 7 — « Le Chant revenu » · toute la vallée

**Wow** : les huit tours s'allument ensemble et les quatre couches de musique
se referment. **Secret** : l'aigle final se pose **sur l'épaule de Turpal** si
les sept autres ont été trouvés. **Durée** : 5 min, sans énigme.

```
   ┌────────────────────────────────────┐
   │             T4 ○═○ T5 ═○ T6 ═◎ T7 │
   │            ╱               seuil ✦ │
   │  T0 ○═○ T1 ═○ T2 ═○ T3           ╲ │
   │  ▲ départ    voyageurs             ○│
   │   𝔅 suit                    descente│
   │                     communauté ── ★│
   │                    Turpal s'assoit  │
   │          𝔅 se couche · aigle si 7/7│
   └────────────────────────────────────┘
```

**Illusion principale** : aucune, volontairement. Après sept chapitres à se
méfier de ses yeux, le joueur marche enfin sur un chemin qui est exactement ce
qu'il paraît — et c'est **cela**, le cadeau final.

**Séquence réalisée** : le chemin unique passe devant huit tours intactes,
chacune dans la palette d'un chapitre. Elles s'éveillent séparément au passage,
tandis que bourdon, pondar, percussion puis mélodie reviennent. Au seuil
familial, la main sur la pierre déclenche une réponse commune des huit tours et
le ciel fond de la neige vers l'or. Turpal redescend ensuite vers la terrasse,
s'assoit parmi les quatre personnes aidées et Borz se couche près de lui. Si les
sept aigles précédents figurent dans la sauvegarde, le dernier se pose sur son
épaule ; le chemin et la fin restent strictement identiques sans lui.

---

## 10. Grille de validation d'un niveau

À remplir avant de considérer un chapitre comme fait (`qa-report.md`) :

- [ ] Moment « wow » identifié, tenant en une phrase
- [ ] Un secret, sans impact mécanique
- [ ] Durée mesurée entre 5 et 12 min (3 playtests)
- [ ] Une seule mécanique nouvelle
- [ ] `auditIllusions()` : toutes les paires prévues à `aligned`, écart ≤ 6 px
- [ ] Validateur d'impasse : aucun état atteignable ne bloque le but
- [ ] Lisible en portrait 390 × 844 **et** paysage 1920 × 1080
- [ ] ≤ 120 draw calls, ≤ 150 k triangles, chunk ≤ 400 ko gzip
- [ ] 60 fps avec throttling CPU ×4
- [ ] `dispose()` : aucun objet WebGL résiduel après sortie
- [ ] Aucun vocabulaire de ruine dans les textes et les noms d'assets (ADR-021)
