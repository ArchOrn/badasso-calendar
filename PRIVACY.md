# Politique de confidentialité — BadAsso → Calendrier

*Dernière mise à jour : 11 septembre 2026*

## En résumé

L'extension ne collecte rien, n'envoie rien, ne partage rien. Elle ne
communique qu'avec `bad-asso.fr`, et uniquement pendant que vous l'utilisez.

## Données manipulées

Quand vous cliquez sur « Exporter mon planning », l'extension demande à
`bad-asso.fr` la liste de vos créneaux réservés, en réutilisant la session déjà
ouverte dans votre navigateur. Cette liste contient :

- les dates et horaires de vos créneaux ;
- le nom du créneau et celui du gymnase ;
- votre identifiant adhérent, lu dans la page pour formuler la requête.

Ces informations servent uniquement à produire le fichier `.ics` téléchargé sur
votre appareil. Elles ne sont **ni stockées, ni transmises à un tiers**.

## Ce qui est conservé localement

- Vos réglages de période et de rappel, dans le stockage local de l'extension.
- L'état replié ou déployé du bouton flottant, dans le stockage local du site.

Ces deux éléments restent sur votre appareil et ne quittent jamais votre
navigateur. Désinstaller l'extension les supprime.

## Ce que l'extension ne fait pas

- Aucun serveur tiers n'est contacté : il n'existe aucun serveur associé à ce
  projet.
- Aucun identifiant ni mot de passe n'est demandé, lu ou stocké. L'extension
  s'appuie sur la session que vous avez ouverte vous-même sur `bad-asso.fr`.
- Aucune télémétrie, aucune analyse d'audience, aucune publicité.
- Aucune donnée n'est vendue ni cédée.

## Permissions demandées, et pourquoi

| Permission | Usage |
| --- | --- |
| `https://bad-asso.fr/*` | Lire votre planning depuis le site, et y afficher le bouton d'export. |
| `scripting` | Exécuter le code de récupération dans la page BadAsso, afin qu'il bénéficie de votre session. |
| `downloads` | Enregistrer le fichier `.ics` produit. |
| `storage` | Retenir vos réglages de période et de rappel. |

L'extension n'a accès à aucun autre site que `bad-asso.fr`.

## Code source

Le code est intégralement consultable et vérifiable dans ce dépôt.

## Contact

Pour toute question, ouvrez une issue sur le dépôt du projet.
