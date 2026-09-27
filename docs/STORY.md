# STORY — BӀOV : Les Tours du Silence

Le récit ne passe **jamais** par un dialogue parlé. Il tient dans trois
matériaux : de **courts textes** entre les chapitres (deux phrases au
maximum), des **gestes** (la main sur la pierre, la main sur le cœur), et la
**lumière** (une vallée qui se rallume).

Règles d'écriture, opposables :

1. Deux phrases maximum par texte d'introduction, jamais d'explication de
   l'énigme.
2. Aucun personnage ne parle. Les anciens font des gestes ; Borz regarde.
3. **« Fracturées » se lit géométriquement, jamais structurellement**
   (ADR-021) : les tours sont intactes, ce sont les **chemins** qui sont
   rompus. Vocabulaire proscrit : ruines, débris, effondrement, destruction.
4. Aucune référence à la guerre, à la politique ou à l'exil
   (`docs/CULTURE.md`).
5. **Aucun proverbe n'est présenté comme authentique** : tous sont des
   formulations originales écrites pour le jeu, « inspirées de » l'esprit du
   Nokhchalla (§ 3).

Les textes vivent dans `src/i18n/*.json` sous les clés `story.<id>.intro` et
`proverbs.<id>` ; `src/story/Narrative.ts` en tient l'ordre.

---

## 1. Arc général

De la **solitude** vers l'**appartenance**. Aucune tension dramatique fondée
sur la menace ou la perte : ce qui monte, c'est la densité de présence. Au
prologue, Turpal est seul dans un lieu muet ; à l'épilogue, il est assis parmi
les siens et la musique est complète.

| Chapitre                | Ce que Turpal donne            | Ce qui revient dans la vallée |
| ----------------------- | ------------------------------ | ----------------------------- |
| Prologue                | Sa présence                    | Borz s'éveille                |
| 1 · Hospitalité         | Son chemin, avant le sien      | Une fumée sur un toit         |
| 2 · Parole donnée       | Son temps, malgré le raccourci | Un rire d'enfant, au loin     |
| 3 · Respect des anciens | Son rythme                     | Des voix dans la nécropole    |
| 4 · Patience            | Son attente                    | Le lac rend le ciel           |
| 5 · Pardon              | Sa main tendue                 | Une famille de plus           |
| 6 · Humilité            | Sa place                       | Les autres montent            |
| Épilogue                | Rien : il s'assoit             | Tout le chant                 |

---

## 2. Chapitre par chapitre

### Prologue — « Le Retour »

**Lieu** : l'aoul natal, à l'aube. **Ciel** : `dawn`.

Turpal arrive à pied par la vallée. Le village est vide et silencieux : pas
une ruine, pas un débris — des maisons intactes et fermées, du linge encore
tendu, et personne. La tour ancestrale de sa famille s'est **fendue** : sa
volée d'escalier extérieure ne rejoint plus le seuil, elle s'arrête dans
l'air. Turpal pose la main à plat sur la pierre, longuement. Sous sa paume,
une gravure s'allume. À dix pas, le loup de pierre couché depuis toujours
**ouvre les yeux** : deux ambres.

> **Texte d'introduction** (`story.prologue.intro`)
> L'aube trouve l'aoul vide. La tour de ses pères s'est fendue, et la vallée
> retient son souffle.

> **Geste clé** : la paume posée sur la pierre — le même geste reviendra à
> l'épilogue, mais sur l'épaule d'un vivant.

### Chapitre 1 — « L'Hospitalité »

**Lieu** : le village d'Itum-Kale, terrasses et toits. **Ciel** : `mist`.

Un voyageur — un homme au manteau trempé, venu d'un autre versant — est
bloqué sur une terrasse dont le chemin s'est désarrimé. Sa route et celle de
Turpal partagent la même passerelle pivotante : l'orienter pour l'un, c'est
la retirer à l'autre. Turpal ouvre d'abord la route du voyageur. Ce n'est
qu'après l'avoir vu partir qu'il découvre que la passerelle, en pivotant une
fois de plus, dessine **son** chemin — celui qu'il croyait avoir sacrifié.

> **Texte d'introduction** (`story.hospitalite.intro`)
> Un voyageur attend au bord du vide, sans chemin devant lui. Celui de l'hôte
> se trace avant le sien.

> **Leçon** : on accueille d'abord. Elle n'est jamais énoncée : elle est la
> seule séquence d'actions qui fonctionne.

### Chapitre 2 — « La Parole donnée »

**Lieu** : la gorge de l'Argun, au-dessus du torrent. **Ciel** : `dawn`.

Sur l'autre rive, un enfant attend, assis, les pieds dans le vide, à l'endroit
exact où un pont avait été promis. Un raccourci s'offre à Turpal : trois
blocs déjà alignés le mèneraient directement à la suite de son voyage. Les
utiliser désassemble le pont. Turpal reconstruit le pont. Le raccourci se
referme derrière lui, lentement, pendant qu'il travaille — le joueur **voit**
ce à quoi il renonce.

> **Texte d'introduction** (`story.parole.intro`)
> Un enfant attend le pont promis l'hiver dernier. Un raccourci s'offre ;
> Turpal ne le prend pas.

### Chapitre 3 — « Le Respect des anciens »

**Lieu** : la nécropole et les tours de Nikaroy. **Ciel** : `mist`.

Un vieil homme traverse la nécropole, très lentement, appuyé sur un bâton. Il
ne s'arrête pas et ne se presse jamais. Les marches sont trop hautes pour lui,
les passerelles trop longues. Le joueur ne déplace pas l'ancien : il
**rabaisse les marches**, raccourcit les travées, aligne les paliers — il
adapte l'architecture au pas de l'homme, cran par cran, pendant que celui-ci
avance. À la fin, l'ancien s'arrête devant Turpal, le regarde, et lui indique
d'un geste du menton une direction que Turpal n'avait pas vue.

> **Texte d'introduction** (`story.anciens.intro`)
> Le vieil homme marche lentement entre les tombes. Ce n'est pas à lui de
> presser le pas.

### Chapitre 4 — « La Patience »

**Lieu** : le lac Kezenoy-Am, à la tombée du jour. **Ciel** : `dusk`.

Le lac est parfaitement immobile et le niveau **se reflète** dedans : le
reflet n'est pas un effet, c'est un second niveau, jouable à l'envers.
Certaines portes n'ont ni levier ni roue : elles s'ouvrent quand la lune
atteint une certaine hauteur. Il n'y a rien à faire d'autre qu'attendre — et
regarder l'eau pendant ce temps est exactement ce que le jeu demande.

> **Texte d'introduction** (`story.patience.intro`)
> Le lac garde le ciel à l'envers. Certaines portes n'attendent pas une main,
> mais la lune.

> **Note de design** : l'attente maximale imposée est de 40 s, et le monde
> bouge pendant (brume, oiseaux, lumière). Attendre n'est jamais subir.

### Chapitre 5 — « Le Pardon »

**Lieu** : la tour brisée, sur un éperon. **Ciel** : `dusk`.

Sur l'éperon se dresse une tour fendue en deux moitiés, séparées d'un pas.
Devant l'une d'elles se tient un homme du même âge que Turpal : un ancien
rival des deux familles. Aucun des deux ne bouge d'abord. Les deux moitiés de
la tour pivotent — mais elles ne se rejoignent que si Turpal **avance le
premier** et laisse la dernière rotation à l'autre. La main tendue est un
geste du joueur : il faut littéralement conduire Turpal jusqu'au bord, et
attendre.

> **Texte d'introduction** (`story.pardon.intro`)
> La tour s'est fendue le jour d'une querelle que nul ne sait plus raconter.
> Les deux moitiés ne se rejoindront pas seules.

### Chapitre 6 — « L'Humilité »

**Lieu** : les neiges de Tebulosmta. **Ciel** : `snow`.

Au-dessus des nuages, il n'y a plus de village, plus de témoins, plus de
gravures. Le chemin du sommet passe **sous** la montagne : il faut descendre
le long d'une paroi, marcher à l'envers, s'effacer. Borz porte les autres —
le voyageur, l'enfant, l'ancien, le rival — l'un après l'autre. Il ne porte
pas Turpal, qui monte à pied, en dernier.

> **Texte d'introduction** (`story.humilite.intro`)
> Au-dessus des nuages, la neige efface les noms. Pour que d'autres montent,
> il faut savoir descendre.

### Épilogue — « Le Chant revenu »

**Lieu** : toute la vallée, vue depuis la tour de sa famille. **Ciel** :
`snow` virant à l'or.

Plus aucune énigme. Les huit tours sont reliées et s'allument l'une après
l'autre, d'un versant à l'autre. Sur les terrasses, ceux que Turpal a aidés
sont là, occupés à des choses ordinaires. La musique est complète pour la
première fois : bourdon, pondar, percussion, mélodie. Turpal monte jusqu'au
seuil, pose la main sur la pierre — la gravure s'allume une dernière fois —
puis il redescend et **s'assoit parmi les siens**. Borz se couche à côté de
lui et referme les yeux.

> **Texte d'introduction** (`story.epilogue.intro`)
> Les tours se répondent de nouveau d'un versant à l'autre. Turpal s'assied,
> et ce n'est plus le silence qui l'entoure.

> **Message final** (`brief.yaml`) : « Ce que l'on bâtit pour les autres finit
> par nous porter. »

---

## 3. Proverbes du carnet

**Avertissement, opposable** (`docs/CULTURE.md`, `src/story/Proverbs.ts`) :
les textes ci-dessous sont des **formulations originales écrites pour le jeu**,
_inspirées de_ la sagesse caucasienne et de l'esprit du Nokhchalla. Aucun
n'est présenté dans le jeu comme un proverbe tchétchène authentique, et aucun
ne doit l'être — l'attribution serait une appropriation. Le carnet les
présente sous l'intitulé « inspiré de la sagesse des montagnes ». Toute
traduction en tchétchène reste marquée `[À VÉRIFIER]` jusqu'à relecture par
deux locuteurs natifs crédités.

| Chapitre                | Clé i18n               | Texte (inspiré de)                                                    |
| ----------------------- | ---------------------- | --------------------------------------------------------------------- |
| Prologue                | `proverbs.threshold`   | La pierre se souvient de ceux qui l'ont posée.                        |
| 1 · Hospitalité         | `proverbs.hospitalite` | Une maison sans porte n'est qu'un mur de plus.                        |
| 2 · Parole donnée       | `proverbs.parole`      | Ce que ta bouche a posé, tes mains doivent le porter.                 |
| 3 · Respect des anciens | `proverbs.anciens`     | Celui qui a marché avant toi connaît la pierre qui glisse.            |
| 4 · Patience            | `proverbs.patience`    | La montagne ne se hâte pas, et pourtant elle arrive au ciel.          |
| 5 · Pardon              | `proverbs.pardon`      | Un pont réparé porte plus loin qu'un pont jamais brisé.               |
| 6 · Humilité            | `proverbs.humilite`    | Baisse la tête en entrant : la porte basse garde les grandes maisons. |
| Épilogue                | `proverbs.epilogue`    | Ce que l'on bâtit pour les autres finit par nous porter.              |

---

## 4. Personnages

| Personnage                                | Rôle narratif                                      | Ce qu'il ne fait jamais                                             |
| ----------------------------------------- | -------------------------------------------------- | ------------------------------------------------------------------- |
| **Turpal**, ~35 ans                       | Celui qui répare les chemins. Silencieux, patient. | Il ne parle pas, ne porte pas d'arme, ne se met jamais en avant.    |
| **Borz**, loup de pierre                  | Mémoire du lieu, compagnon, pont.                  | Il n'est jamais blessé, détruit ni sacrifié ; il n'aboie jamais.    |
| **Le voyageur** (ch.1)                    | L'étranger qu'on accueille.                        | On ne saura jamais d'où il vient : ce n'est pas la question.        |
| **L'enfant** (ch.2)                       | La promesse.                                       | Il ne reproche rien, il attend.                                     |
| **L'ancien** (ch.3, puis présent partout) | Le rythme et la bénédiction.                       | Il ne donne aucune instruction.                                     |
| **Le rival** (ch.5)                       | Le pardon.                                         | Le motif de la querelle n'est jamais dit — il n'a pas d'importance. |
