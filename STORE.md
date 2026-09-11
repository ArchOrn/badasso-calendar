# Fiche Chrome Web Store

Textes prêts à coller dans le [tableau de bord développeur](https://chrome.google.com/webstore/devconsole).
Générer l'archive à téléverser avec `./tools/package.sh`.

---

## Nom

```
BadAsso → Calendrier
```

## Description courte (132 caractères max)

```
Exporte tes créneaux de badminton réservés sur BadAsso vers un fichier .ics, pour Google Calendar, Apple Calendar ou Outlook.
```

## Description complète

```
Tu réserves tes créneaux de badminton sur BadAsso, et tu les recopies à la main dans ton agenda ? Cette extension le fait pour toi.

Un clic, et tous tes créneaux réservés — jeu libre comme entraînements — partent dans un fichier .ics que tu importes dans Google Calendar, Apple Calendar, Outlook, ou n'importe quel agenda.

COMMENT ÇA MARCHE

1. Connecte-toi sur bad-asso.fr comme d'habitude.
2. Clique sur le bouton « Exporter mon planning », en bas à droite de la page — ou sur l'icône de l'extension.
3. Importe le fichier téléchargé dans ton agenda.

CE QU'ELLE FAIT

• Exporte tes créneaux réservés, entraînements compris
• Horaires corrects toute l'année, changements d'heure compris
• Rappels optionnels : 30 minutes, 1 heure, 2 heures ou 1 jour avant
• Période d'export réglable
• Réimport sans doublons : les évènements se mettent à jour au lieu de se dupliquer
• Chaque gymnase garde sa couleur

VIE PRIVÉE

Aucun mot de passe demandé : l'extension réutilise la session que tu as déjà ouverte sur BadAsso. Aucune donnée n'est collectée, envoyée ou partagée — il n'existe aucun serveur derrière ce projet. L'extension ne communique qu'avec bad-asso.fr.

Code source entièrement consultable.

Projet indépendant, sans lien avec l'éditeur de BadAsso.
```

## Catégorie

`Productivité` (sous-catégorie : Outils)

## Langue

`Français`

---

## Justification des permissions

À renseigner dans l'onglet « Pratiques en matière de confidentialité ». Chaque
champ attend une explication concrète de l'usage ; une justification vague est
le premier motif de rejet.

**Code distant** — répondre d'abord « Non, je n'utilise pas de code distant ».

```
Tout le code exécuté par l'extension est contenu dans son paquet. Aucun script, aucune feuille de style et aucun module n'est chargé depuis un serveur distant. L'extension n'émet qu'une seule requête réseau, vers bad-asso.fr ; la réponse est une donnée JSON, traitée comme telle et jamais exécutée.
```

**Autorisation d'hôte `https://bad-asso.fr/*`**

```
L'extension exporte vers un fichier iCalendar les créneaux de badminton que l'utilisateur a réservés sur bad-asso.fr. Elle accède à ce site pour deux choses : lire le planning de l'utilisateur via l'API du site, en réutilisant la session qu'il a lui-même ouverte, et afficher un bouton d'export sur les pages du site. bad-asso.fr est le seul domaine demandé, car c'est le seul où réside la donnée à exporter.
```

**`downloads`**

```
L'extension génère un fichier .ics à partir du planning de l'utilisateur, et doit l'enregistrer sur son appareil pour qu'il puisse l'importer dans son agenda. Cette autorisation sert uniquement à cet enregistrement, déclenché par un clic explicite de l'utilisateur.
```

**`scripting`**

```
L'extension exécute son code de récupération dans le contexte de la page bad-asso.fr, afin que la requête vers l'API du site parte avec le cookie de session de l'utilisateur. Ce cookie étant en SameSite=Lax, il ne serait pas joint à une requête émise depuis l'origine de l'extension, et la récupération du planning échouerait. Le code injecté est fourni dans le paquet de l'extension et ne s'exécute que sur bad-asso.fr.
```

**`storage`**

```
L'extension mémorise les préférences de l'utilisateur : la période à exporter, exprimée en nombre de jours avant et après la date du jour, et le délai de rappel à placer dans les évènements. Ces réglages restent locaux et ne sont jamais transmis.
```

**Objectif unique**

```
Exporter vers un fichier iCalendar les créneaux de badminton que l'utilisateur a réservés sur bad-asso.fr, afin qu'il puisse les importer dans son agenda.
```

---

## Déclarations sur les données

- Informations personnelles identifiables : **non collectées**
- Informations de santé, financières, d'authentification : **non collectées**
- Communications personnelles, localisation : **non collectées**
- Activité sur le web, contenu du site : **non collectées**

Cocher les trois certifications :

- Les données ne sont ni vendues ni cédées à des tiers
- Les données ne servent pas à un usage étranger à la fonction principale
- Les données ne servent pas à évaluer la solvabilité ou octroyer des prêts

> L'extension lit le planning de l'utilisateur, mais ne le **collecte** pas au
> sens du formulaire : rien n'est transmis ni conservé hors de l'appareil. Le
> fichier `.ics` est écrit localement, et c'est tout.

## URL de la politique de confidentialité

```
https://github.com/ArchOrn/badasso-calendar/blob/main/PRIVACY.md
```

## URL du site officiel (facultatif mais utile en revue)

```
https://github.com/ArchOrn/badasso-calendar
```

---

## Ressources visuelles

Générées par `node tools/screenshots.js` dans `dist/store/` :

| Fichier | Format | Usage |
| --- | --- | --- |
| `screenshot-1.png` | 1280×800 | Le bouton sur une page BadAsso |
| `screenshot-2.png` | 1280×800 | La popup et la liste des créneaux |
| `icon-store-128.png` | 128×128 | **Icône de la fiche** — générée par `python3 tools/make-icons.py` |

⚠️ L'icône de la fiche n'est **pas** `extension/icons/icon-128.png`. Le store
attend 96×96 d'œuvre centrée dans un canevas de 128×128, les 16 px restants de
chaque côté laissés transparents. L'icône de la barre d'outils, elle, remplit
son canevas bord à bord. D'où deux fichiers distincts, issus du même dessin.

La petite image promotionnelle 440×280 est facultative tant que l'extension
n'est pas mise en avant.

---

## Versions

La version vit dans `extension/manifest.json`, et `./tools/package.sh` en tire
le nom de l'archive.

Le store exige que chaque version téléversée soit **strictement supérieure** à
la dernière publiée. On ne peut donc jamais redescendre après une première
publication acceptée : incrémenter avant chaque soumission.

---

## Visibilité

**Non répertoriée** est recommandé pour un usage de club : l'extension
n'apparaît pas dans la recherche, et seuls les porteurs du lien l'installent.
Les mises à jour se diffusent automatiquement, ce qui est tout l'intérêt par
rapport au chargement en mode développeur.

Ce réglage se change à tout moment sans republier.
