# QA Phase 10 — accessibilité, entrées et cycle de vie

- `reduced-motion-states.svg` est une matrice technique des deux états du
  rendu. Elle documente les valeurs effectivement testées : durées divisées
  par deux, dérives continues figées et logique de jeu inchangée.
- `color-cue-matrix.svg` montre les canaux secondaires permanents associés aux
  indices braise : contours, coques, symboles et texte.
- `screen-reader-focus-stack.svg` décrit les trois états DOM testés pour la
  navigation au lecteur d'écran : écran de base, dialogue et dialogue
  imbriqué. Il matérialise le montage, `inert`/`aria-hidden`, l'annonce polie,
  le piège de focus et sa restauration LIFO.
- `input-validation-matrix.svg` synthétise les invariants automatiques du
  pointeur, du clavier, de la manette, de l'haptique et du remappage. La ligne
  orange conserve explicitement la validation Android/iOS réelle à faire.
- `lifecycle-audit.svg` sépare les cycles automatisés verts — 16 chargements,
  10 runtimes, ressources et écouteurs — des mesures orange qui exigent
  `renderer.info.memory` et Chrome DevTools dans un vrai navigateur WebGL.

Il s'agit de preuves techniques, pas de captures WebGL ni d'enregistrements
d'un lecteur d'écran sur appareil réel. Aucun navigateur système n'est
disponible dans le bac à sable ; les validations subjectives sur écran réel,
avec technologies d'assistance et auprès d'une personne sensible au mouvement
restent recommandées.
