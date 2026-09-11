#!/bin/sh
# Génère badasso-export.js (script à coller dans la console) en concaténant
# le cœur partagé et le lanceur. extension/core.js reste la source unique.
set -eu
cd "$(dirname "$0")"

{
  cat <<'ENTETE'
/*
 * BadAsso -> iCalendar : script à coller dans la console.
 *
 * FICHIER GÉNÉRÉ — ne pas éditer à la main.
 * Sources : extension/core.js + console/runner.js, assemblées par ./build.sh
 *
 * UTILISATION
 *   1. Connecte-toi sur https://bad-asso.fr (page « Mon planning »).
 *   2. Ouvre la console (F12 -> Console).
 *   3. Colle tout ce fichier, valide.
 */
ENTETE
  cat extension/core.js
  echo
  cat console/runner.js
} > badasso-export.js

echo "badasso-export.js généré ($(wc -l < badasso-export.js) lignes)"
