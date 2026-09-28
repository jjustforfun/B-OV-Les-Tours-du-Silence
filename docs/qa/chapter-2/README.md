# Captures QA — chapitre 2 « La Parole donnée »

Les deux SVG tracent la **projection réelle** du niveau et de son NavGraph dans
l'état final : le raccourci est abandonné, les trois dalles sont transférées et
le pont promis devient franchissable.

- `promise-desktop-1920x1080.svg` — viewport desktop de référence ;
- `promise-mobile-390x844.svg` — viewport mobile portrait de référence.

Le tracé turquoise suit la solution. Les volumes pointillés gardent la mémoire
de l'ancien raccourci ; les trois volumes pleins sont les mêmes objets, arrivés
sur le pont. Le chemin gris pointillé descend vers la rive basse et l'étoile
dorée indique l'aigle caché sous le pont. Ces repères sont des annotations
d'audit, absentes du jeu.

Ces fichiers sont des captures techniques, pas des captures WebGL artistiques.
Chromium Playwright reste indisponible dans le bac à sable après cinq
interruptions réseau `ECONNRESET`. Les captures WebGL devront être ajoutées
depuis un environnement pourvu d'un navigateur ; le niveau est disponible à
`?level=02-parole`.
