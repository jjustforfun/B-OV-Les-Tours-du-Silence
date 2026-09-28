# Captures QA — chapitre 1 « L'Hospitalité »

Les deux SVG tracent la **projection réelle** du niveau et de son NavGraph dans
l'état final : le voyageur est parti et la passerelle pointe vers la route sud.

- `hospitality-desktop-1920x1080.svg` — viewport desktop de référence ;
- `hospitality-mobile-390x844.svg` — viewport mobile portrait de référence.

La ligne pointillée suit le trajet autonome du voyageur. La liaison en braise
est soumise simultanément à la position sud de la roue et à l'état
`traveler-served=true`. Le repère cardinal et l'étoile de l'aigle sont des
annotations d'audit, absentes du jeu.

Ces fichiers sont des captures techniques, pas des captures WebGL artistiques.
Chromium Playwright reste indisponible dans le bac à sable après cinq
interruptions réseau `ECONNRESET`. Les captures WebGL devront être ajoutées
depuis un environnement pourvu d'un navigateur ; le niveau est disponible à
`?level=01-hospitalite`.
