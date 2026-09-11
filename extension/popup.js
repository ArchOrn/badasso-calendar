/*
 * Popup de l'extension : déclenche la collecte dans l'onglet BadAsso,
 * construit le fichier .ics et le télécharge.
 */
(function () {
  "use strict";

  var boutonExporter = document.getElementById("exporter");
  var champAvant = document.getElementById("avant");
  var champApres = document.getElementById("apres");
  var champRappel = document.getElementById("rappel");
  var zoneMessage = document.getElementById("message");
  var zoneListe = document.getElementById("liste");

  var PREFERENCES = ["avant", "apres", "rappel"];

  function afficher(texte, classe) {
    zoneMessage.textContent = texte;
    zoneMessage.className = classe || "";
  }

  function estSurBadAsso(url) {
    try {
      return /(^|\.)bad-asso\.fr$/.test(new URL(url).hostname);
    } catch (err) {
      return false;
    }
  }

  function formaterQuand(creneau) {
    var m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(creneau.start || "");
    if (!m) return creneau.start || "";
    var fin = /T(\d{2}):(\d{2})/.exec(creneau.end || "");
    return (
      m[3] + "/" + m[2] + " " + m[4] + "h" + m[5] + (fin ? "–" + fin[1] + "h" + fin[2] : "")
    );
  }

  function listerCreneaux(creneaux) {
    zoneListe.replaceChildren();
    creneaux
      .slice()
      .sort(function (a, b) {
        return String(a.start).localeCompare(String(b.start));
      })
      .forEach(function (c) {
        var ligne = document.createElement("div");
        var quand = document.createElement("span");
        quand.className = "quand";
        quand.textContent = formaterQuand(c) + " — ";
        ligne.append(quand, document.createTextNode(c.name + " · " + (c.loc_name || "")));
        zoneListe.append(ligne);
      });
  }

  function telecharger(ics, nom) {
    var blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
    var url = URL.createObjectURL(blob);
    return new Promise(function (resolve, reject) {
      chrome.downloads.download({ url: url, filename: nom, saveAs: false }, function (id) {
        // Le blob doit rester vivant jusqu'à ce que le téléchargement démarre.
        setTimeout(function () {
          URL.revokeObjectURL(url);
        }, 20000);
        if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
        else resolve(id);
      });
    });
  }

  async function exporter() {
    boutonExporter.disabled = true;
    zoneListe.replaceChildren();
    afficher("Récupération en cours…");

    try {
      var onglets = await chrome.tabs.query({ active: true, currentWindow: true });
      var onglet = onglets[0];

      if (!onglet || !estSurBadAsso(onglet.url)) {
        afficher(
          "Ouvre d'abord bad-asso.fr dans cet onglet, connecte-toi, puis relance l'export.",
          "erreur"
        );
        return;
      }

      var avant = Math.max(0, parseInt(champAvant.value, 10) || 0);
      var apres = Math.max(1, parseInt(champApres.value, 10) || 365);
      var rappel = parseInt(champRappel.value, 10) || 0;

      // La collecte tourne dans le monde MAIN : la requête part alors de la
      // page elle-même, donc avec son cookie de session. Depuis le monde
      // isolé d'un content script, le cookie PHPSESSID ne serait pas joint.
      await chrome.scripting.executeScript({
        target: { tabId: onglet.id },
        world: "MAIN",
        files: ["core.js"],
      });

      var resultats = await chrome.scripting.executeScript({
        target: { tabId: onglet.id },
        world: "MAIN",
        func: function (a, b) {
          return window.BadAsso.collecter(a, b);
        },
        args: [avant, apres],
      });

      var resultat = resultats && resultats[0] && resultats[0].result;
      if (!resultat) {
        afficher("Aucune réponse de la page. Recharge bad-asso.fr et réessaie.", "erreur");
        return;
      }
      if (!resultat.ok) {
        afficher(resultat.erreur, "erreur");
        return;
      }
      if (!resultat.creneaux.length) {
        afficher("Aucun créneau réservé sur cette période.", "erreur");
        return;
      }

      var sortie = BadAsso.construireIcs(resultat.creneaux, { rappelMinutes: rappel });
      await telecharger(sortie.ics, BadAsso.nomFichier());

      var nb = resultat.creneaux.length - sortie.ignores.length;
      afficher(nb + (nb > 1 ? " créneaux exportés." : " créneau exporté."), "succes");
      if (sortie.ignores.length) {
        afficher(
          nb + " créneaux exportés, " + sortie.ignores.length + " ignorés (dates illisibles).",
          "succes"
        );
      }
      listerCreneaux(resultat.creneaux);
    } catch (err) {
      afficher(err && err.message ? err.message : String(err), "erreur");
    } finally {
      boutonExporter.disabled = false;
    }
  }

  async function restaurerPreferences() {
    var stockees = await chrome.storage.local.get(PREFERENCES);
    PREFERENCES.forEach(function (cle) {
      if (stockees[cle] != null) document.getElementById(cle).value = stockees[cle];
    });
  }

  PREFERENCES.forEach(function (cle) {
    document.getElementById(cle).addEventListener("change", function (e) {
      chrome.storage.local.set({ [cle]: e.target.value });
    });
  });

  boutonExporter.addEventListener("click", exporter);
  restaurerPreferences();
})();
