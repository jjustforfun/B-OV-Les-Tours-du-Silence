# Captures QA — chapitre 4 « La Patience »

Les deux SVG tracent la **projection mesurée du NavGraph** dans l'état final :
la tour est sur sa face 2, la dalle de Borz est verrouillée, la lune a terminé
ses 40 secondes et la porte du monde reflété est ouverte.

- `patience-desktop-1920x1080.svg` — viewport desktop de référence ;
- `patience-mobile-390x844.svg` — viewport mobile portrait de référence.

Le trait argenté suit la solution de Turpal et le trait ocre pointillé le
trajet de Borz vers la dalle. Les silhouettes de tour sont des repères
schématiques ; les positions des nœuds, en revanche, viennent directement de
`CameraRig` et `NodeProjection` après deux rotations réelles de
`TowerRotation`. Les nœuds `water-real` et `water-reflection` se superposent à
**0 px** dans les deux viewports. L'étoile en transparence consigne la position
de l'aigle pendant sa fenêtre de zénith de 6 secondes ; il est de nouveau caché
dans l'état final représenté.

Ces fichiers sont des captures techniques, pas des captures WebGL artistiques.
Aucun navigateur système n'est disponible dans le bac à sable et les cinq
tentatives précédentes d'installation de Chromium ont été interrompues par
`ECONNRESET`. Les captures WebGL devront être ajoutées depuis un environnement
pourvu d'un navigateur ; le niveau est disponible à `?level=04-patience`.
