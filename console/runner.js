/*
 * Console script runner. Concatenated after extension/core.js by ./build.sh
 * to produce badasso-export.js, the file to paste into the console.
 *
 * User-facing strings stay in French: they are read by club members.
 */
(async function () {
  "use strict";

  var DAYS_BEFORE = 30;
  var DAYS_AFTER = 365; // wide: trainings are scheduled for the whole season

  if (!/(^|\.)bad-asso\.fr$/.test(location.hostname)) {
    console.error(
      "[BadAsso] À exécuter depuis un onglet ouvert sur https://bad-asso.fr (connecté)."
    );
    return;
  }

  var result = await BadAsso.collect(DAYS_BEFORE, DAYS_AFTER);
  if (!result.ok) {
    console.error("[BadAsso] " + result.error);
    return;
  }

  console.log("[BadAsso] Identifiant adhérent :", result.memberId);

  if (!result.slots.length) {
    console.warn("[BadAsso] Aucun créneau réservé sur la période. Rien à exporter.");
    return;
  }

  var output = BadAsso.buildIcs(result.slots);
  if (output.skipped.length) {
    console.warn(
      "[BadAsso] " + output.skipped.length + " créneau(x) ignoré(s), dates illisibles :",
      output.skipped
    );
  }

  console.log(
    "[BadAsso] " + (result.slots.length - output.skipped.length) + " créneau(x) exporté(s) :"
  );
  console.table(
    result.slots.map(function (slot) {
      return { début: slot.start, fin: slot.end, créneau: slot.name, lieu: slot.loc_name };
    })
  );

  var name = BadAsso.fileName();
  var blob = new Blob([output.ics], { type: "text/calendar;charset=utf-8" });
  var url = URL.createObjectURL(blob);
  var link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(function () {
    URL.revokeObjectURL(url);
  }, 1000);

  console.log("[BadAsso] Fichier " + name + " généré.");
})();
