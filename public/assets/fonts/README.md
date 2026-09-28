# Fontes auto-hébergées (à déposer ici)

Le jeu n'embarque **aucune fonte** tant que ce dossier est vide : les piles
de repli de `src/ui/styles/tokens.css` tiennent l'écran dignement et le jeu
ne fait **aucune requête vers Google Fonts** (hors ligne + vie privée,
docs/ART_DIRECTION.md § 7).

Pour activer les vraies typographies, déposer ici les woff2 :

| Usage               | Famille            | Graisses | Sous-ensembles      |
| ------------------- | ------------------ | -------- | ------------------- |
| Titres, proverbes   | Cormorant Garamond | 300, 400 | `latin`, `cyrillic` |
| Interface, réglages | Inter              | 400, 500 | `latin`, `cyrillic` |

Contraintes :

- `font-display: swap`, préchargement des deux graisses réellement utilisées ;
- budget total **≤ 60 ko** ;
- aucun `@font-face` dans le code : le nom de famille posé dans
  `tokens.css` (`--font-display`, `--font-body`) suffit à les activer dès que
  les fichiers sont présents — ajouter les `@font-face` correspondants dans
  `src/ui/styles/tokens.css`.

Le tchétchène (`ce`) et le russe (`ru`) ont besoin du sous-ensemble
`cyrillic` ; sans lui, les repli restent lisibles.
