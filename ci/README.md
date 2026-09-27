# ci/ — intégration continue, en attente d'activation

Ce dossier contient le workflow GitHub Actions du projet,
**`github-actions-ci.yml`**, volontairement rangé ici plutôt que dans
`.github/workflows/`.

## Pourquoi

L'agent qui a créé ce dépôt pousse via une **GitHub App** qui ne dispose pas de
la permission `workflows`. GitHub refuse alors toute poussée créant ou
modifiant un fichier sous `.github/workflows/` :

```
refusing to allow a GitHub App to create or update workflow
`.github/workflows/ci.yml` without `workflows` permission
```

Plutôt que de perdre la définition de la CI, elle est versionnée ici.

## Activer la CI (une commande, à faire par un humain)

```bash
mkdir -p .github/workflows
git mv ci/github-actions-ci.yml .github/workflows/ci.yml
git commit -m "ci: activer le workflow GitHub Actions"
git push
```

Alternative : accorder la permission `workflows` à l'application dans les
réglages du dépôt, puis faire la même chose depuis l'agent.

## Ce que fait le workflow

| Job     | Contenu                                                                                 |
| ------- | --------------------------------------------------------------------------------------- |
| `check` | `pnpm check` : lint → typecheck → tests unitaires → build → budget de bundle            |
| `e2e`   | Playwright sur les trois profils de viewport (desktop, mobile portrait, mobile paysage) |
