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

À renseigner dans l'onglet « Confidentialité » du tableau de bord. Chaque champ
attend une phrase expliquant l'usage ; une justification vague est le premier
motif de rejet.

**`scripting`**

```
L'extension exécute son code de récupération dans le contexte de la page bad-asso.fr afin que la requête bénéficie de la session de l'utilisateur. Sans cela, le cookie de session (SameSite=Lax) ne serait pas joint et la récupération du planning échouerait.
```

**`downloads`**

```
L'extension enregistre sur l'appareil de l'utilisateur le fichier .ics qu'elle vient de générer à partir de son planning.
```

**`storage`**

```
L'extension mémorise les préférences de l'utilisateur : la période à exporter et le délai de rappel. Ces réglages restent locaux.
```

**Accès à l'hôte `https://bad-asso.fr/*`**

```
L'extension lit le planning de l'utilisateur sur bad-asso.fr et y affiche un bouton d'export. C'est le seul site auquel elle accède, et le seul où réside la donnée exportée.
```

**Usage du code distant**

```
Non. Tout le code est contenu dans le paquet de l'extension.
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
| `icon-128.png` | 128×128 | Icône de la fiche (dans `extension/icons/`) |

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
