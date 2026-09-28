# Captures QA — chapitre 7 « Le Chant revenu »

Les deux SVG tracent la **projection mesurée du NavGraph** dans l’unique état
du chapitre : aucun mécanisme, aucune arête illusoire et aucun embranchement de
solution.

- `epilogue-desktop-1920x1080.svg` — viewport desktop de référence ;
- `epilogue-mobile-390x844.svg` — viewport mobile portrait de référence.

Le trait clair suit le chemin complet : départ, huit tours, seuil familial,
descente et terrasse où Turpal s’assoit. Les huit points colorés reprennent les
palettes des chapitres 0 à 7. Les quatre couches musicales sont annotées aux
nœuds qui les réintroduisent. L’aigle posé sur l’épaule représente uniquement
la variante où les sept secrets précédents sont présents ; la route reste
strictement identique sans lui.

Les positions des nœuds viennent réellement de `CameraRig` et
`NodeProjection`. Les silhouettes architecturales et les personnages sont des
repères schématiques. Ce sont des captures techniques, pas des captures WebGL
artistiques : aucun navigateur système n’est disponible dans le bac à sable et
les téléchargements Chromium précédents ont échoué par `ECONNRESET`. Les
captures WebGL devront être ajoutées depuis un environnement pourvu d’un
navigateur ; le chapitre est disponible à `?level=07-epilogue`.
