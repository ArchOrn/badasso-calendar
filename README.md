# badasso-calendar

Exporte les créneaux de badminton réservés sur [BadAsso](https://bad-asso.fr)
(jeu libre **et** entraînements) vers un fichier `.ics`, importable dans Google
Calendar, Apple Calendar, Outlook, etc.

Deux usages au choix, même moteur : une **extension Chrome** pour un usage
courant, un **script console** pour dépanner sans rien installer.

---

## Extension Chrome

### Installation

1. Télécharger ou cloner ce dépôt.
2. Ouvrir `chrome://extensions`.
3. Activer le **Mode développeur** (en haut à droite).
4. Cliquer **Charger l'extension non empaquetée** et choisir le dossier
   `extension/`.

L'extension n'est pas publiée sur le Chrome Web Store : chaque membre du club
l'installe ainsi. Chrome affichera un bandeau rappelant qu'une extension en mode
développeur est active — c'est normal.

### Utilisation

1. Aller sur https://bad-asso.fr et se connecter.
2. Cliquer sur l'icône de l'extension.
3. Ajuster si besoin la période et le rappel, puis **Exporter mon planning**.

Le `.ics` se télécharge, et la liste des créneaux exportés s'affiche dans la
popup pour vérification. Les réglages sont mémorisés d'une fois sur l'autre.

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

L'extension injecte la collecte avec `world: "MAIN"`, c'est-à-dire dans le
contexte JavaScript de la page elle-même. Depuis le monde isolé d'un content
script, ou depuis la popup, la requête partirait de l'origine de l'extension et
le cookie `PHPSESSID` (`SameSite=Lax`) ne serait pas joint.

---

## Organisation du code

```
extension/core.js      source unique : API BadAsso + génération ICS
extension/popup.*      interface de l'extension
console/runner.js      lanceur du script console
build.sh               core.js + runner.js -> badasso-export.js
badasso-export.js      GÉNÉRÉ — ne pas éditer à la main
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

21 assertions : structure du calendrier, conservation de l'heure locale, unicité
des UID, échappement RFC 5545, pliage des lignes à 75 **octets** sans couper un
caractère accentué en deux, rappels `VALARM`, et cohérence du bundle.

Le jeu de données `test/planning-reel.json` provient d'une réponse réelle de
l'endpoint, réduite aux champs effectivement consommés. La sortie a également
été validée avec la bibliothèque Python `icalendar`.

Pour inspecter le fichier généré :

```sh
DUMP=1 node test/test-ics.js
```

## Limites connues

- L'export est manuel : pas de synchronisation automatique. Un abonnement ICS
  auto-rafraîchi supposerait d'héberger les identifiants BadAsso de chaque
  membre, ce qui n'est pas souhaitable.
- Les annulations ne se propagent pas aux évènements déjà importés.
- `LOCATION` ne contient que le nom du gymnase, pas son adresse postale.
- L'extension n'a pas d'icône : Chrome affiche le placeholder par défaut.
- `world: "MAIN"` requiert Chrome 111 ou plus récent.
