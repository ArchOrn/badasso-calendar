# badasso-calendar

Exporte les créneaux de badminton réservés sur [BadAsso](https://bad-asso.fr)
(jeu libre **et** entraînements) vers un fichier `.ics`, importable dans Google
Calendar, Apple Calendar, Outlook, etc.

Deux usages au choix, même moteur : une **extension Chrome** pour un usage
courant, un **script console** pour dépanner sans rien installer.

---

## Extension Chrome

### Installation

1. Cloner le dépôt :
   ```sh
   git clone https://github.com/ArchOrn/badasso-calendar.git
   ```
2. Ouvrir `chrome://extensions`.
3. Activer le **Mode développeur** (en haut à droite).
4. Cliquer **Charger l'extension non empaquetée** et choisir le dossier
   `extension/`.

L'extension n'est pas publiée sur le Chrome Web Store : chaque membre du club
l'installe ainsi. Chrome affichera un bandeau rappelant qu'une extension en mode
développeur est active — c'est normal.

### Utilisation

Une fois connecté sur https://bad-asso.fr, deux chemins mènent au même fichier.

**Le bouton flottant**, en bas à droite de chaque page BadAsso. Un clic, le
`.ics` se télécharge. Période par défaut : 30 jours en arrière, 365 en avant,
sans rappel. Le `×` le replie en pastille ; un clic sur la pastille le
redéploie. Il ne disparaît jamais complètement — un élément qui s'efface sans
laisser de trace laisse l'utilisateur sans moyen de le retrouver.

**La popup**, via l'icône de l'extension, pour régler la période et les rappels,
et revoir la liste des créneaux avant import. Les réglages y sont mémorisés.

Aucun mot de passe n'est demandé ni stocké : l'extension réutilise la session
déjà ouverte dans l'onglet.

---

## Script console

Pour tester sans installer, ou dépanner si l'extension pose problème.

1. Se connecter sur https://bad-asso.fr, page **Mon planning**.
2. Ouvrir la console (`F12` → **Console**).
3. Coller l'intégralité de `badasso-export.js`, valider.

---

## Import dans Google Calendar

Paramètres → *Importer et exporter* → *Importer* → choisir le fichier.

Les évènements portent un identifiant stable (`badasso-<id>@bad-asso.fr`) :
réimporter **met à jour** les évènements existants au lieu de créer des
doublons. Les créneaux annulés entre deux exports, en revanche, ne sont pas
supprimés automatiquement — il faut les retirer à la main.

---

## L'API BadAsso

Observée depuis l'onglet Réseau, non documentée officiellement.

| Action | Méthode | Renvoie |
| --- | --- | --- |
| `ic_a=729090` + `adh_id` + `start`/`end` | GET | **Mes créneaux réservés** (JSON) |
| `ic_a=745473` + `start`/`end` | GET | Catalogue de tous les créneaux réservables (JSON) |
| `ic_a=745475` + `plan_id` | POST | Détail d'un créneau (HTML : participants, adresse) |
| `ic_a=745476` + `plan_id` + `adh_id` | POST | Désinscription |

Seul `729090` est utilisé : c'est le seul qui filtre déjà sur l'adhérent. Les
autres sont documentés parce qu'ils ont servi à identifier la bonne source, et
pourraient servir à enrichir l'export — l'adresse postale complète du gymnase
n'existe que dans le détail `745475`, au prix d'une requête par créneau.

Le format est celui de [FullCalendar](https://fullcalendar.io/). Les dates
arrivent en **heure locale sans fuseau** (`2026-09-14T12:00`) et sont
interprétées en `Europe/Paris`.

### Authentification

Session PHP portée par cookie. D'où l'exécution depuis un onglet déjà connecté :
aucun identifiant à saisir ni à conserver.

Deux pièges rencontrés, tous deux traités dans le code :

- Quand la session expire, le serveur répond **HTTP 200 avec la page de login en
  HTML**, pas un 401.
- BadAsso sert son JSON avec le content-type **`text/html`**. Se fier à cet
  en-tête pour détecter une erreur produit un faux positif sur une réponse
  parfaitement valide : seul le corps de la réponse fait foi.

### Pourquoi le monde MAIN

Toute la collecte tourne en `world: "MAIN"`, c'est-à-dire dans le contexte
JavaScript de la page elle-même — la popup l'injecte via `chrome.scripting`, le
bouton flottant y est déclaré directement dans le manifest. Depuis le monde
isolé d'un content script, ou depuis la popup, la requête partirait de l'origine
de l'extension et le cookie `PHPSESSID` (`SameSite=Lax`) ne serait pas joint.

Contrepartie : un script en monde MAIN n'a accès à **aucune API d'extension**.
D'où, côté bouton flottant, `sessionStorage` plutôt que `chrome.storage`, et un
`<a download>` plutôt que `chrome.downloads`.

Requiert Chrome 111+ ou Firefox 128+.

### Isolation de l'interface injectée

Le bouton flottant vit dans un **shadow DOM** avec `:host { all: initial }` : le
CSS de BadAsso ne peut pas le déformer, et le nôtre ne déborde pas sur le site.
Il est par ailleurs en `position: fixed` plutôt que greffé dans la mise en page
du site — une refonte de BadAsso ne le cassera pas.

Il ne s'affiche que si un identifiant adhérent est détectable dans la page, ce
qui le restreint de fait aux pages où l'utilisateur est connecté.

---

## Conventions

Le code — identifiants et commentaires — est en **anglais**. Les textes
**affichés** restent en **français** : interface de la popup, messages du
bouton flottant, messages console du script à coller. Ils s'adressent aux
membres du club. Cette documentation aussi.

## Organisation du code

```
extension/core.js      source unique : API BadAsso + génération ICS
extension/popup.*      popup de l'extension
extension/inpage.js    bouton flottant injecté dans les pages BadAsso
extension/icons/       icônes GÉNÉRÉES par tools/make-icons.py
console/runner.js      lanceur du script console
build.sh               core.js + runner.js -> badasso-export.js
badasso-export.js      GÉNÉRÉ — ne pas éditer à la main
tools/make-icons.py    régénère les icônes (sans dépendance)
```

Après toute modification de `extension/core.js` ou `console/runner.js` :

```sh
./build.sh
```

Un test vérifie que le bundle est à jour, pour éviter qu'il ne diverge
silencieusement des sources.

## Tests

```sh
node test/test-ics.js
```

25 assertions : structure du calendrier, conservation de l'heure locale, unicité
des UID, échappement RFC 5545, pliage des lignes à 75 **octets** sans couper un
caractère accentué en deux, rappels `VALARM`, couleurs, et cohérence du bundle.

Le jeu de données `test/sample-planning.json` est **synthétique**, calqué sur
la forme réelle des réponses de l'endpoint. Il est volontairement inventé : le
planning réel d'un adhérent n'a rien à faire dans un dépôt public. Les cas
délicats y sont couverts — les deux côtés du changement d'heure, les
entraînements, et un créneau porteur d'un commentaire.

La sortie a également été validée avec la bibliothèque Python `icalendar`.

Pour inspecter le fichier généré :

```sh
DUMP=1 node test/test-ics.js
```

## Couleur des gymnases

L'API attribue une couleur à chaque gymnase (`loc_color`). Elle sert de repère
visuel dans la popup, et alimente la propriété `COLOR` des évènements.

Attention : la RFC 7986 définit `COLOR` avec un **nom de couleur CSS3**, pas un
hexadécimal. Le code rapproche donc chaque teinte du nom le plus proche
(`#1a60d1` → `royalblue`). Apple Calendar et Thunderbird en tiennent compte,
Google Calendar ignore largement la couleur par évènement.

## Couleurs

L'interface reprend le violet de la charte BadAsso, `#932079` — contraste de
7,7:1 avec du texte blanc, donc confortablement au-dessus du seuil AA. Il est
défini à trois endroits, à tenir synchronisés : les jetons `--accent` de
`popup.html`, les constantes `BRAND` de `inpage.js`, et `ACCENT` dans
`tools/make-icons.py`.

Les couleurs par créneau, elles, viennent de l'API et désignent le gymnase.

## Icônes

```sh
python3 tools/make-icons.py
```

Le script assemble les PNG à la main (zlib + CRC), sans dépendance, avec un
suréchantillonnage 4x pour lisser les bords. Les fichiers produits sont
versionnés : ne relancer qu'en cas de changement du dessin.

## Publication

```sh
./tools/package.sh          # -> dist/badasso-calendar-<version>.zip
node tools/screenshots.js   # -> dist/store/screenshot-{1,2}.png (1280x800)
python3 tools/preflight.py  # contrôles avant soumission
```

`preflight.py` vérifie le manifest, les icônes, la structure de l'archive,
l'absence de code distant — motif de rejet fréquent — et les limites de
longueur de la fiche.

`STORE.md` contient les textes de la fiche, prêts à coller, ainsi que les
justifications de permissions et les déclarations sur les données. `PRIVACY.md`
est la politique de confidentialité, dont le tableau de bord demande l'URL.

Les captures sont rendues depuis les vraies sources de l'extension, avec les
API `chrome.*` bouchonnées : elles ne peuvent pas s'écarter de ce que
l'extension affiche réellement.

`dist/` n'est pas versionné : tout s'y régénère.

## Liens

- Dépôt : https://github.com/ArchOrn/badasso-calendar
- Politique de confidentialité : [PRIVACY.md](PRIVACY.md)

## Licence

MIT — voir [LICENSE](LICENSE). Projet indépendant, sans lien avec l'éditeur de
BadAsso.

## Limites connues

- L'export est manuel : pas de synchronisation automatique. Un abonnement ICS
  auto-rafraîchi supposerait d'héberger les identifiants BadAsso de chaque
  membre, ce qui n'est pas souhaitable.
- Les annulations ne se propagent pas aux évènements déjà importés.
- `LOCATION` ne contient que le nom du gymnase, pas son adresse postale.
- `world: "MAIN"` requiert Chrome 111+ ou Firefox 128+.
- Le bouton flottant utilise la période par défaut ; pour la régler, passer par
  la popup (les deux contextes ne partagent pas leur stockage : le monde MAIN
  n'a pas accès à `chrome.storage`).
- Pas encore porté sur Firefox : il reste à ajouter `browser_specific_settings`,
  un shim `browser`/`chrome`, et à gérer les permissions optionnelles.
