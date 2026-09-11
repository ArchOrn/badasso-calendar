/*
 * Lanceur du script console. Concaténé après extension/core.js par ./build.sh
 * pour produire badasso-export.js, le fichier à coller dans la console.
 */
(async function () {
  "use strict";

  var JOURS_AVANT = 30;
  var JOURS_APRES = 365; // large : les entraînements sont planifiés sur la saison

  if (!/(^|\.)bad-asso\.fr$/.test(location.hostname)) {
    console.error(
      "[BadAsso] À exécuter depuis un onglet ouvert sur https://bad-asso.fr (connecté)."
    );
    return;
  }

  var resultat = await BadAsso.collecter(JOURS_AVANT, JOURS_APRES);
  if (!resultat.ok) {
    console.error("[BadAsso] " + resultat.erreur);
    return;
  }

  console.log("[BadAsso] Identifiant adhérent :", resultat.adhId);

  if (!resultat.creneaux.length) {
    console.warn("[BadAsso] Aucun créneau réservé sur la période. Rien à exporter.");
    return;
  }

  var sortie = BadAsso.construireIcs(resultat.creneaux);
  if (sortie.ignores.length) {
    console.warn(
      "[BadAsso] " + sortie.ignores.length + " créneau(x) ignoré(s), dates illisibles :",
      sortie.ignores
    );
  }

  console.log(
    "[BadAsso] " + (resultat.creneaux.length - sortie.ignores.length) + " créneau(x) exporté(s) :"
  );
  console.table(
    resultat.creneaux.map(function (c) {
      return { début: c.start, fin: c.end, créneau: c.name, lieu: c.loc_name };
    })
  );

  var nom = BadAsso.nomFichier();
  var blob = new Blob([sortie.ics], { type: "text/calendar;charset=utf-8" });
  var url = URL.createObjectURL(blob);
  var lien = document.createElement("a");
  lien.href = url;
  lien.download = nom;
  document.body.appendChild(lien);
  lien.click();
  document.body.removeChild(lien);
  setTimeout(function () {
    URL.revokeObjectURL(url);
  }, 1000);

  console.log("[BadAsso] Fichier " + nom + " généré.");
})();
