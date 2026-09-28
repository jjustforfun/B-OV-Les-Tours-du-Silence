# Captures QA — chapitre 3 « Le Respect des anciens »

Les deux SVG tracent la **projection réelle** du niveau et de son NavGraph dans
l'état final : les trois travées sont abaissées, l'ancien a traversé et la
liaison impossible entre les tours jumelles est active.

- `elders-desktop-1920x1080.svg` — viewport desktop de référence ;
- `elders-mobile-390x844.svg` — viewport mobile portrait de référence.

Le tracé doré suit la solution de Turpal. La ligne ivoire pointillée représente
le trajet autonome de l'ancien et la ligne grise celui de Borz. Les volumes en
pointillés gardent la mémoire des hauteurs initiales. Le double contour des
tours montre leur superposition mesurée à **0 px** ; l'étoile indique l'aigle
sur la stèle abaissée. Ces repères sont des annotations d'audit, absentes du
jeu.

Ces fichiers sont des captures techniques, pas des captures WebGL artistiques.
Chromium Playwright reste indisponible dans le bac à sable après cinq
interruptions réseau `ECONNRESET`. Les captures WebGL devront être ajoutées
depuis un environnement pourvu d'un navigateur ; le niveau est disponible à
`?level=03-anciens`.
