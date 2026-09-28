# Captures QA — chapitre 0 « Le Retour »

Les deux SVG tracent la **projection réelle** du niveau et de son NavGraph avec
la caméra de production :

- `prologue-desktop-1920x1080.svg` — viewport desktop de référence ;
- `prologue-mobile-390x844.svg` — viewport mobile portrait de référence.

Le cercle braise matérialise uniquement l'audit : `last-step` et `threshold`
coïncident à **0 px** dans les deux cadrages. Il n'est pas affiché dans le jeu.

Ces fichiers sont des captures techniques, pas des captures WebGL artistiques.
L'installation de Chromium Playwright a échoué cinq fois avec `ECONNRESET` dans
le bac à sable. Les captures WebGL devront être ajoutées depuis un environnement
pourvu d'un navigateur ; le niveau est disponible à `?level=00-prologue` pour
cette revue.
