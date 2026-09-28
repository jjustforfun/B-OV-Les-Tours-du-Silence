# Captures QA — chapitre 6 « L’Humilité »

Les deux SVG tracent la **projection mesurée du NavGraph** dans l’état résolu :
le névé est descendu, la tour est sur la face 1, la paroi pointe vers le nord,
le plafond vers le bas (`up=[0,-1,0]`) et la procession a déposé ses quatre
passagers au sommet.

- `humility-desktop-1920x1080.svg` — viewport desktop de référence ;
- `humility-mobile-390x844.svg` — viewport mobile portrait de référence.

Le trait blanc suit la solution de Turpal ; les pointillés bleus marquent les
segments parcourus avec des `up` non conventionnels. `ceiling-end` et
`summit-start` sont distants de `(6,6,6)` dans le monde, exactement selon l’axe
isométrique, mais sont superposés à **0 px** dans les deux viewports. La
procession latérale montre l’ordre strict : voyageur, enfant, ancien, rival.
Turpal ne monte jamais sur Borz.

Les silhouettes architecturales et les personnages sont des repères
schématiques. Les positions des nœuds viennent réellement de `CameraRig` et
`NodeProjection`, après mise à jour effective des quatre mécanismes. Ce sont
des captures techniques, pas des captures WebGL artistiques : aucun navigateur
système n’est disponible dans le bac à sable et les téléchargements Chromium
précédents ont échoué par `ECONNRESET`. Les captures WebGL devront être ajoutées
depuis un environnement pourvu d’un navigateur ; le niveau est disponible à
`?level=06-humilite`.
