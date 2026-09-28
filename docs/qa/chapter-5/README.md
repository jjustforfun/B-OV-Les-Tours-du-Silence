# Captures QA — chapitre 5 « Le Pardon »

Les deux SVG tracent la **projection mesurée du NavGraph** dans l'état final :
la gravité de la courte paroi pointe au nord, l'ouest est sur la face 1, l'est
sur la face 3 et `fracture-closed=true`.

- `pardon-desktop-1920x1080.svg` — viewport desktop de référence ;
- `pardon-mobile-390x844.svg` — viewport mobile portrait de référence.

Le trait clair suit la solution. Les deux nœuds `west-offer` et `east-offer`
sont superposés à **0 px** dans les deux viewports, comme les deux balcons déjà
présents dans les demi-tours. La matrice 4 × 4 rappelle que la seule réponse
résolvante est **ouest 1**, puis la rotation du rival **est 2 → 3**. L'aigle
annoté dans la fente appartient à l'état ouvert précédant cette capture ; il
est caché au moment final représenté.

Les silhouettes architecturales et les personnages sont des repères
schématiques. Les positions des nœuds viennent réellement de `CameraRig` et
`NodeProjection`, après une rotation réelle de la moitié ouest et trois de la
moitié est. Ce sont des captures techniques, pas des captures WebGL
artistiques : aucun navigateur système n'est disponible dans le bac à sable et
les téléchargements Chromium précédents ont échoué par `ECONNRESET`. Les
captures WebGL devront être ajoutées depuis un environnement pourvu d'un
navigateur ; le niveau est disponible à `?level=05-pardon`.
