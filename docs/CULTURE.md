# CULTURE — représenter la Tchétchénie avec respect

> « Dignité : une culture montrée avec respect et tendresse. » (pilier n° 4)

Ce document est **opposable** : il prime sur toute considération esthétique ou
de game design. En cas de doute, on retire plutôt que d'approximer.

Principe directeur : nous faisons un jeu **sur l'hospitalité, la parole donnée
et la montagne**, pas un documentaire et surtout pas un commentaire.

---

## 1. Ce que nous représentons

| Élément                                | Traitement                                                                                                                                                                    | Où                            |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| **Tours vainakhs** (бӀов) [À VÉRIFIER] | Architecture réelle, respectée dans son canon : base carrée, fruit, toit pyramidal à gradins, entrée au premier étage, pierre sèche. **Toujours debout.**                     | `docs/ART_DIRECTION.md` § 2   |
| **Costume traditionnel**               | Tcherkesska, gazyri, papakha, ceinture, bottes souples. Porté simplement, comme un vêtement de travail — jamais comme un costume de scène.                                    | `TurpalModel.ts`              |
| **Hospitalité**                        | Le chapitre 1 entier : on ouvre le chemin de l'hôte avant le sien. Mécanique, pas discours.                                                                                   | GDD § 6                       |
| **Respect des anciens**                | Le chapitre 3 : l'architecture s'adapte au pas du vieil homme. Turpal salue main sur le cœur.                                                                                 | GDD § 6                       |
| **Dechig-pondar** [À VÉRIFIER]         | Couleur sonore du jeu entier, par synthèse Karplus-Strong. On emprunte un timbre, jamais un répertoire.                                                                       | `docs/AUDIO.md` § 3           |
| **Motifs et pétroglyphes**             | Spirales, signes solaires, empreintes de main : inspirés de gravures réelles, **jamais décalqués** d'un monument identifiable.                                                | `docs/ART_DIRECTION.md` § 2.2 |
| **Paysages réels**                     | Gorge de l'**Argun**, lac **Kezenoy-Am**, **Itum-Kale**, **Nikaroy**, **Tebulosmta**. Nommés dans le carnet, dessinés avec soin, sans prétendre à l'exactitude topographique. | `docs/STORY.md`               |
| **Nokhchalla** (нохчалла) [À VÉRIFIER] | Code d'honneur : fil conducteur des six vertus. Montré par les actes du joueur, jamais expliqué en texte.                                                                     | `brief.yaml`                  |

---

## 2. Ce que nous évitons — absolument

| Interdit                                                                                                                                                                 | Pourquoi                                                                                                                                           |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Toute référence à la guerre** (combats, destructions, occupation, exil, déportation)                                                                                   | Le jeu est un lieu de repos, pas un mémorial. Nous n'avons ni la légitimité ni la place pour traiter cela bien                                     |
| **Toute référence politique** (drapeaux, États, frontières, dirigeants, dates)                                                                                           | Idem                                                                                                                                               |
| **Les armes mises en avant**                                                                                                                                             | Turpal n'en porte aucune — règle absolue de `brief.yaml`. Le kinjal, même décoratif, est exclu de la v1                                            |
| **Une tour qui s'effondre ou en ruine**                                                                                                                                  | Ce sont des monuments réels, encore debout. Les tours sont « fracturées » au sens **géométrique** (chemins disjoints), jamais structurel (ADR-021) |
| **La religion mise en scène**                                                                                                                                            | Aucune prière, aucun lieu de culte, aucun symbole religieux jouable. Le respect passe ici par l'absence                                            |
| **Un proverbe présenté comme authentique**                                                                                                                               | Tous nos proverbes sont des écritures originales « inspirées de ». Les attribuer serait une appropriation (`docs/STORY.md` § 3)                    |
| **Les clichés** : le montagnard farouche, la danse folklorique en fond, le tapis « ethnique », la police à faux caractères cyrilliques, la flûte « orientale » générique | Ils transforment une culture en décor                                                                                                              |
| **Le pittoresque de la pauvreté**                                                                                                                                        | Le village est vide et silencieux, jamais misérable                                                                                                |
| **L'accent, le charabia ou la langue approximative**                                                                                                                     | Mieux vaut le silence qu'un tchétchène inventé — d'où un jeu **sans dialogue parlé**                                                               |

### Vocabulaire proscrit dans tout le projet (code, assets, textes, commits)

`ruine`, `ruines`, `débris`, `éboulis`, `effondrement`, `effondrée`,
`destruction`, `détruit`, `démolition`.

### Vocabulaire retenu

`fracturé` (au sens géométrique), `désarrimé`, `décalé`, `disjoint`,
`chemin rompu`, `volée suspendue`.

---

## 3. Lexique

**Statut : à faire valider par un locuteur natif.** Toute entrée non validée
porte `[À VÉRIFIER]` dans le code, dans les documents et, si elle devait être
affichée, dans le jeu lui-même.

| Tchétchène     | Translittération | Sens                           | Usage dans le jeu                       | Statut                                                                                                                    |
| -------------- | ---------------- | ------------------------------ | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Баркалла       | barkalla         | merci                          | Geste de l'ancien, sous-titre optionnel | [À VÉRIFIER]                                                                                                              |
| Марша вогӀийла | marsha vogІiyla  | bienvenue (dit **à un homme**) | Accueil du voyageur, ch.1               | [À VÉRIFIER] — la forme varie selon le genre et le nombre de la personne accueillie ; ne pas l'employer sans confirmation |
| Нохчалла       | nokhchalla       | le code d'honneur tchétchène   | Thème central, jamais traduit à l'écran | [À VÉRIFIER]                                                                                                              |
| БӀов           | bІov             | tour                           | Titre du jeu                            | [À VÉRIFIER]                                                                                                              |
| Лам            | lam              | montagne                       | Titre alternatif du projet              | [À VÉRIFIER]                                                                                                              |
| Борз           | borz             | loup                           | Nom du compagnon                        | [À VÉRIFIER]                                                                                                              |
| Дечиг-пондар   | dechig-pondar    | luth à trois cordes            | Timbre de la musique                    | [À VÉRIFIER]                                                                                                              |

Notes de typographie : le tchétchène s'écrit en cyrillique augmenté du
caractère **Ӏ (palotchka)**, qui n'est **pas** un `I` latin ni un `1`. Les
fontes du jeu doivent inclure le sous-ensemble cyrillique étendu, et toute
chaîne doit être vérifiée octet à octet après un copier-coller.

---

## 4. Processus de validation

1. **Relecture par au moins deux locuteurs natifs**, sur : le lexique, les
   traductions `ce.json`, les noms propres, les motifs, le costume, la
   description des tours.
2. **Crédits explicites** des relecteurs au générique, avec leur accord, dans
   la formulation qu'ils choisissent.
3. `src/i18n/ce.json` reste **volontairement incomplet** tant que la relecture
   n'a pas eu lieu : les entrées manquantes retombent sur le français. Une
   traduction approximative serait un manque de respect plus grand qu'une
   absence.
4. **Aucune publication** (Play Store, itch.io, réseaux) tant que des
   `[À VÉRIFIER]` subsistent dans du contenu affiché — point bloquant de
   `qa-report.md`.
5. En cas de désaccord entre deux relecteurs : on retire l'élément.

---

## 5. Règle de conduite pour les agents et contributeurs

- Dans le doute, **ne pas inventer**. Marquer `[À VÉRIFIER]` et poser la
  question dans `tasks.md`.
- Ne jamais faire dire à un personnage tchétchène une phrase écrite par nous
  en tchétchène sans relecture.
- Ne jamais chercher à « équilibrer » un propos politique : il n'y en a aucun,
  et il n'y en aura aucun.
- Le générique comportera la mention : _« Ce jeu est une œuvre de fiction
  inspirée par l'architecture et les valeurs vainakhs. Il ne prétend ni
  documenter ni représenter la Tchétchénie contemporaine. »_
