# ANDROID PORT — plan de portage Capacitor

> **Statut : documentation seulement. Rien n'est implémenté, rien ne doit
> l'être maintenant** (ADR-014). La v1 est une PWA ; ce document existe pour
> que le portage, le jour venu, ne demande qu'une classe et une journée.

Critère de réussite : **`CapacitorPlatform` est la seule classe à écrire**, et
aucun fichier de `src/world`, `src/entities`, `src/render`, `src/audio` ou
`src/ui` n'est modifié.

---

## 1. Ce qui est déjà prêt

| Préparation                                                               | Où                                   | Pourquoi c'est indispensable                                                           |
| ------------------------------------------------------------------------- | ------------------------------------ | -------------------------------------------------------------------------------------- |
| **`base: './'`**                                                          | `vite.config.ts`                     | La WebView sert depuis `https://localhost` ou `file://` : tout chemin absolu casserait |
| **Couche `Platform` asynchrone**                                          | `src/platform/Platform.ts` (ADR-011) | `@capacitor/preferences` est asynchrone ; l'interface l'est déjà sur web               |
| **Aucun accès direct à `window` / `navigator`** hors `platform/` et `ui/` | Convention (`AGENTS.md` § 9)         | Évite les plantages en WebView                                                         |
| **Stockage versionné** (`bov.save.v1`)                                    | `SaveManager`                        | Permet de migrer une sauvegarde web vers l'app                                         |
| **Aucune dépendance serveur**                                             | —                                    | Le jeu est 100 % statique et hors ligne                                                |
| **Qualité adaptative**                                                    | `Quality.ts` (ADR-013)               | Le parc Android est hétérogène ; rien n'est à régler à la main                         |

---

## 2. Plan d'exécution (le jour venu)

```bash
pnpm add @capacitor/core @capacitor/cli
pnpm add @capacitor/preferences @capacitor/haptics @capacitor/app \
         @capacitor/status-bar @capacitor/splash-screen
pnpm exec cap init "BOV" "games.bov.silence" --web-dir=dist
pnpm build && pnpm exec cap add android && pnpm exec cap sync
```

| Étape                     | Détail                                                                                                                                                                                                            |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Config                 | `capacitor.config.ts` : `appId: 'games.bov.silence'`, `appName: 'BӀOV'`, `webDir: 'dist'`, `android.allowMixedContent: false`, `server.androidScheme: 'https'`                                                    |
| 2. `CapacitorPlatform`    | Implémente `PlatformAdapter` avec Preferences, Haptics, App, StatusBar. Sélection à l'exécution : `Capacitor.isNativePlatform() ? new CapacitorPlatform() : new WebPlatform()` — **un seul point de branchement** |
| 3. Orientation            | **Libre** (portrait et paysage), comme sur web : `android:screenOrientation="fullSensor"`. Le jeu recadre tout seul                                                                                               |
| 4. Mode immersif          | `WindowCompat.setDecorFitsSystemWindows(window, false)` + barres masquées, réapparition au balayage. Les safe-areas CSS sont déjà gérées                                                                          |
| 5. Bouton retour matériel | `App.addListener('backButton', …)` → **pause**, jamais quitter. Deuxième appui sur l'écran de pause → écran-titre. Sur l'écran-titre → `App.exitApp()` après confirmation                                         |
| 6. Haptique native        | `Haptics.impact({ style: ImpactStyle.Light })` pour `tick`, `Medium` pour `snap`, motif composé pour `celebrate` — mêmes noms que `input/Haptics.ts`                                                              |
| 7. Mise en veille         | `KeepAwake` pendant `Playing` uniquement ; relâché en pause et sur l'écran-titre (respect de la batterie)                                                                                                         |
| 8. Cycle de vie           | `appStateChange` → pause auto, audio coupé en 250 ms, `Tone.Transport.pause()`. Reprise en 400 ms                                                                                                                 |
| 9. Icônes adaptatives     | Couche de fond `#0d1117` uni + couche avant SVG de la tour, marge de sécurité de 33 % (la zone masquable est ronde, carrée ou en goutte selon le lanceur). Générer toutes les densités mdpi→xxxhdpi               |
| 10. Splash                | Fond `#0d1117`, logo centré, **sans texte** (pas de traduction à gérer). `SplashScreen.hide()` appelé par le jeu quand la première image est rendue, pas avant — sinon on voit un écran noir                      |
| 11. Build de publication  | **AAB** (`./gradlew bundleRelease`), `minSdk 24`, `targetSdk` = le plus récent exigé par Play, signature par keystore hors dépôt (variables d'environnement CI)                                                   |
| 12. Tests                 | Sur **trois appareils réels** : un milieu de gamme 2021 (cible), un entrée de gamme récent, une tablette. Vérifier : 60 fps, bouton retour, rotation, reprise après appel entrant, hors ligne complet             |

---

## 3. Permissions

**Aucune.** Le jeu ne demande ni réseau, ni stockage externe, ni vibration
déclarée (l'API haptique de Capacitor n'exige pas `VIBRATE` sur les versions
récentes ; si elle l'exigeait, ce serait la **seule** permission acceptable).

Pas d'analytique, pas de télémétrie, pas de publicité, pas d'achat intégré
(`out_of_scope_v1`). La fiche Play déclarera « aucune donnée collectée ».

---

## 4. Spécificités Android à connaître

| Sujet                                      | Risque                                              | Réponse                                                                                                  |
| ------------------------------------------ | --------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| **WebView minimale**                       | Une WebView ancienne casse WebGL2 ou les modules ES | Exiger **Android System WebView ≥ 100** ; sinon, message d'invitation à la mise à jour (jamais un crash) |
| **Encoches et barres de gestes**           | Boutons sous la barre de navigation                 | Déjà géré par `env(safe-area-inset-*)`                                                                   |
| **`AudioContext` suspendu au retour**      | Silence après un appel entrant                      | `AudioManager.resume()` sur `appStateChange`                                                             |
| **Chauffe**                                | Chute de fps après 10 min                           | La qualité adaptative descend d'un cran ; à valider sur appareil réel                                    |
| **Pull-to-refresh**                        | Rechargement accidentel                             | Déjà verrouillé côté CSS/JS (`docs/CONTROLS.md` § 4)                                                     |
| **Retour arrière depuis une notification** | État incohérent                                     | Le jeu se sauvegarde à chaque changement d'état : la reprise repart du dernier chapitre                  |
| **Taille de l'AAB**                        | Play limite l'APK de base                           | Sans assets lourds, l'AAB devrait rester sous 15 Mo                                                      |

---

## 5. Ce qui ne changera pas

- Le rendu, les niveaux, l'audio, l'UI : **strictement identiques** au web.
- Aucune fonctionnalité exclusive Android : la parité est un objectif.
- Aucune dépendance native ajoutée pour le confort : chaque plugin coûte de la
  maintenance et un risque de rupture à chaque montée de version.

## 6. iOS

Hors périmètre v1. Le même plan s'applique presque tel quel (`cap add ios`) ;
seuls changent la signature, la revue App Store et la gestion du
`safe-area-inset` en mode paysage. Rien dans le code ne devra bouger.
