#!/bin/sh
# Generate badasso-export.js (the script to paste into the console) by
# concatenating the shared core and the runner. extension/core.js stays the
# single source of truth.
set -eu
cd "$(dirname "$0")"

{
  cat <<'HEADER'
/*
 * BadAsso -> iCalendar: script to paste into the browser console.
 *
 * GENERATED FILE — do not edit by hand.
 * Sources: extension/core.js + console/runner.js, assembled by ./build.sh
 *
 * USAGE
 *   1. Log in to https://bad-asso.fr ("Mon planning" page).
 *   2. Open the console (F12 -> Console).
 *   3. Paste this whole file and hit enter.
 */
HEADER
  cat extension/core.js
  echo
  cat console/runner.js
} > badasso-export.js

echo "badasso-export.js generated ($(wc -l < badasso-export.js) lines)"
