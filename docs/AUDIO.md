# AUDIO — BӀOV : Les Tours du Silence

> « Silence habité : le son raconte autant que l'image. » (pilier n° 3)

Tout est **synthétisé à l'exécution** avec Tone.js : aucun fichier audio dans
le bundle initial (ADR-007). Un jeu de 90 minutes en nappes enregistrées
coûterait plusieurs mégaoctets et finirait par boucler de façon audible ; ici
rien ne se répète jamais à l'identique.

**Garde-fou culturel** : on emprunte une **couleur instrumentale**, jamais un
répertoire. Aucune mélodie traditionnelle existante n'est reproduite
(`docs/CULTURE.md`).

---

## 1. Architecture audio

```
PondarSynth ─┐
Nappes       ├─► bus MUSIC   (−9 dB) ─┐
Doul         ─┘                        │
Vent/eau/oiseaux ─► bus AMBIENCE (−14 dB) ├─► REVERB « vallée » ─► MASTER (0.9) ─► sortie
Pas, pierre, UI ──► bus SFX      (−6 dB) ─┘        (decay 9 s, wet 0.42)
```

| Bus        | Gain par défaut | Fichier                     |
| ---------- | --------------- | --------------------------- |
| `master`   | 0,90            | `src/audio/AudioManager.ts` |
| `music`    | 0,70 (−9 dB)    | `src/audio/MusicSystem.ts`  |
| `ambience` | 0,60 (−14 dB)   | `src/audio/Ambience.ts`     |
| `sfx`      | 0,85 (−6 dB)    | `src/audio/SfxBank.ts`      |

Chaque bus est réglable indépendamment dans les paramètres (exigence
d'accessibilité `volume par canal`), persisté via `Platform` (ADR-011).

---

## 2. Ambiances par lieu

`Ambience.ts` — bruits filtrés, à **périodes premières entre elles** (7 s,
11 s, 13 s, 17 s, 23 s) pour qu'aucun motif ne se répète de façon perceptible.

| Couche                           | Synthèse                                                                                             | Réglages                                    | Chapitres                                                   |
| -------------------------------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------- | ----------------------------------------------------------- |
| **Vent**                         | bruit rose → filtre passe-bande balayé (LFO 0,03 Hz, 200–900 Hz)                                     | gain −20 dB, +6 dB en altitude (ch.6)       | tous                                                        |
| **Torrent**                      | bruit blanc → passe-haut 700 Hz + résonance légère, panoramique lié à la distance à la rivière       | −18 dB                                      | 2, 4                                                        |
| **Cloches de bétail lointaines** | 3 `MetalSynth` accordés en Sol/Si/Ré, déclenchement aléatoire 1 toutes les 12–30 s, très réverbérées | −26 dB                                      | 1, 3                                                        |
| **Cri d'aigle**                  | `FMSynth` avec glissando descendant + bruit filtré, 1 toutes les 45–120 s                            | −22 dB, panoramique large                   | 0, 5, 6 ; **systématique** quand un aigle secret est trouvé |
| **Crépitement de feu**           | impulsions de bruit brun très courtes, densité 8/s, aléatoire                                        | −24 dB, atténuation en 1/d² autour du foyer | 1, 7                                                        |
| **Pierre** (respiration du lieu) | bourdon sub 40 Hz modulé très lentement                                                              | −28 dB, presque subliminal                  | 0, 5                                                        |

Chaque niveau déclare ses couches dans sa `LevelDefinition` ; le fondu
d'entrée/sortie dure **4 s**.

---

## 3. PondarSynth

`src/audio/PondarSynth.ts` — évocation du **dechig-pondar**, luth tchétchène à
trois cordes [À VÉRIFIER : orthographe, facture et technique de jeu, à
confirmer auprès d'une source tchétchène].

- **Karplus-Strong** (`Tone.PluckSynth`) : excitation bruitée + ligne à retard
  - amortissement — le modèle physique exact d'une corde pincée, pour quelques
    lignes de code.
- **Trois « cordes »** (trois instances), accordées par chapitre. Chacune a
  son amortissement propre (la plus grave sonne 2,4 s, la plus aiguë 1,1 s).
- Paramètres de départ : `attackNoise: 1.4`, `dampening: 1800 × brightness`,
  `resonance: 0.92`, `release: 1.6`.
- **Inharmonicité légère** : ±4 cents aléatoires à chaque pincement, sans quoi
  la corde sonne numérique.

### Modes et accords par chapitre

| Chapitre                   | Mode   | Fondamentale | Accord des 3 cordes               |
| -------------------------- | ------ | ------------ | --------------------------------- |
| 0 · Le Retour              | dorien | Ré           | D3 – A3 – D4                      |
| 1 · L'Hospitalité          | dorien | Sol          | G3 – D4 – G4                      |
| 2 · La Parole donnée       | éolien | La           | A2 – E3 – A3                      |
| 3 · Le Respect des anciens | dorien | Do           | C3 – G3 – C4                      |
| 4 · La Patience            | éolien | Mi           | E2 – B2 – E3                      |
| 5 · Le Pardon              | éolien | Ré           | D3 – A3 – F4                      |
| 6 · L'Humilité             | dorien | La           | A3 – E4 – A4                      |
| 7 · Le Chant revenu        | dorien | Ré           | D3 – A3 – D4 (retour au prologue) |

Le pondar est **la voix de Turpal** : il ne parle pas, la corde répond pour
lui aux moments clés (arrivée, connexion, bénédiction).

---

## 4. Musique adaptative — quatre couches

`MusicSystem.ts`. Les couches **s'ajoutent à mesure que le joueur progresse
dans le niveau** ; elles ne se retirent jamais en cours de chapitre.
`setProgress(n)` allume les `n` premières.

| #   | Couche   | Contenu                                                                                                     | Gain   | Apparaît quand                                                                |
| --- | -------- | ----------------------------------------------------------------------------------------------------------- | ------ | ----------------------------------------------------------------------------- |
| 0   | `drone`  | Bourdon de quinte (fondamentale + quinte), filtre passe-bas balayé très lentement                           | −12 dB | dès l'entrée dans le niveau                                                   |
| 1   | `pondar` | Motif de 5 à 7 notes, non métrique, joué toutes les 8 à 14 s, jamais deux fois pareil                       | −9 dB  | à la **première manipulation** d'un mécanisme                                 |
| 2   | `doul`   | Percussion douce à la main (membrane synthétisée, frappes sourdes), ~48 BPM implicite, motif ternaire lâche | −15 dB | à **mi-résolution** (la moitié des mécanismes du niveau dans leur état final) |
| 3   | `melody` | La mélodie : lignes de quarte/quinte, longues, au-dessus du bourdon                                         | −10 dB | quand le **chemin final se referme**                                          |

- **Fondu de 4 à 8 s** par couche (défaut 6 s) : on n'entend jamais une couche
  apparaître, on s'aperçoit qu'elle est là.
- Tempo implicite **~48 BPM**, aucune pulsation marquée avant la couche 2.
- À l'épilogue, les quatre couches sont présentes dès le début : c'est le
  « chant revenu ».
- **Aucune couche ne joue pendant une bascule de gravité** (500 ms de
  filtrage) : le vertige a besoin de place.

---

## 5. Effets sonores

`SfxBank.ts` — tous synthétisés, tous avec variation aléatoire de hauteur
(±2 demi-tons) et de gain (±1,5 dB) pour éviter la fatigue d'écoute.

| Son                           | Synthèse                                                                                                                             | Détail                                                                                                                                                                                                                                        |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Pas**                       | bruit filtré + enveloppe très courte, **timbre par surface**                                                                         | `stone` : bruit brun, passe-bas 900 Hz, 90 ms — `grass` : bruit rose, passe-haut 1,2 kHz, 70 ms — `snow` : bruit blanc doux, 140 ms, attaque molle — `wood` : bruit brun + résonance 220 Hz, 80 ms. La surface vient du nœud (`NavNode.tags`) |
| **Rotation**                  | craquement continu (bruit brun → passe-bande piloté par la vitesse angulaire) **+ une note**                                         | **chaque cran joue la note suivante de la gamme du chapitre**, en montant ; tourner à l'envers redescend la gamme. Manipuler devient jouer : c'est la décision de design la plus importante du sound design                                   |
| **Glissement**                | bruit brun grave, filtre et gain proportionnels à la vitesse                                                                         | coupe net à l'aimantation                                                                                                                                                                                                                     |
| **Emboîtement** (`stoneLock`) | clic de bois (impulsion + résonance 320 Hz, Q élevé)                                                                                 | signature unique de **tout** ce qui se verrouille                                                                                                                                                                                             |
| **Connexion de chemin**       | **accord ascendant** de 3 notes au pondar (fondamentale, quarte, quinte), 140 ms d'écart                                             | le son de la récompense                                                                                                                                                                                                                       |
| **Fin de chapitre**           | **motif complet** : les 3 cordes jouent la signature du chapitre (5 notes), suivies d'un silence de 2 s, puis la mélodie du proverbe | `PondarSynth.playChapterSignature()`                                                                                                                                                                                                          |
| **Dalle**                     | « toc » grave amorti + quinte tenue tant qu'elle est active                                                                          | −9 dB / −22 dB                                                                                                                                                                                                                                |
| **UI**                        | impulsion sinusoïdale très courte (12 ms)                                                                                            | −18 dB, jamais deux fois d'affilée à la même hauteur                                                                                                                                                                                          |
| **Proverbe**                  | une seule note, très longue, très réverbérée                                                                                         | laisse le texte respirer                                                                                                                                                                                                                      |

---

## 6. Mixage et cycle de vie

| Sujet                                    | Règle                                                                                                                                                                                                                                                 | Implémentation                    |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- |
| **Ducking**                              | Pendant l'affichage d'un texte (intro de chapitre, proverbe) : musique −4 dB, ambiance −3 dB, attaque 400 ms, relâche 1,2 s. Les sfx ne sont pas duckés.                                                                                              | `AudioManager.duck(true/false)`   |
| **Déverrouillage de l'AudioContext**     | Le son ne démarre qu'au **premier geste** du joueur (politique d'autoplay). `Tone.start()` sur le premier `pointerdown`/`keydown`, puis fondu d'entrée de **1,2 s**. Aucune icône « activer le son » : le jeu commence en silence, et c'est cohérent. | `AudioManager.unlock()`           |
| **Onglet caché**                         | `visibilitychange` → `Tone.Transport.pause()` + rampe du master à 0 en 250 ms. Reprise en 400 ms. Aucun son ne continue en arrière-plan (batterie, respect).                                                                                          | `AudioManager.onVisibilityChange` |
| **Perte de focus** (fenêtre, pas onglet) | master −12 dB seulement : le jeu reste présent.                                                                                                                                                                                                       | idem                              |
| **Coupure rapide**                       | Touche `M` : master à 0 en 120 ms, état persisté.                                                                                                                                                                                                     | `InputAction = 'muteToggle'`      |
| **Reduced motion**                       | N'affecte pas l'audio, sauf les LFO visuels synchronisés.                                                                                                                                                                                             | —                                 |
| **Nettoyage**                            | Chaque système expose `dispose()` ; changer de chapitre libère tous les nœuds Tone (vérifié : zéro fuite entre niveaux, Definition of Done).                                                                                                          | `utils/dispose.ts`                |

### Exception : fichiers audio

Si un son ne peut pas être synthétisé de façon convaincante (un vrai souffle
de vent de haute montagne, par exemple), il est autorisé **hors du bundle
initial**, chargé paresseusement, en **OGG Vorbis + AAC (`.m4a`)** — Safari et
iOS ne lisent pas l'OGG (`AGENTS.md` § 6). La synthèse reste la règle par
défaut ; chaque exception se justifie dans la revue.
