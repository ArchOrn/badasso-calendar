/*
 * Popup de l'extension : déclenche la collecte dans l'onglet BadAsso,
 * construit le fichier .ics et le télécharge.
 */
(function () {
  "use strict";

  var boutonExporter = document.getElementById("exporter");
  var libelleBouton = document.getElementById("libelle-bouton");
  var iconeBouton = boutonExporter.querySelector("svg");
  var sousTitre = document.getElementById("sous-titre");
  var zoneMessage = document.getElementById("message");
  var zoneListe = document.getElementById("liste");

  var PREFERENCES = ["avant", "apres", "rappel"];

  var formatJour = new Intl.DateTimeFormat("fr-FR", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });

  function afficher(texte, classe) {
    zoneMessage.textContent = texte;
    zoneMessage.className = classe || "";
  }

  function enCours(actif) {
    boutonExporter.disabled = actif;
    iconeBouton.classList.toggle("rotation", actif);
    libelleBouton.textContent = actif ? "Récupération…" : "Exporter mon planning";
  }

  function estSurBadAsso(url) {
    try {
      return /(^|\.)bad-asso\.fr$/.test(new URL(url).hostname);
    } catch (err) {
      return false;
    }
  }

  function decouper(local) {
    var m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(String(local || ""));
    return m ? { jour: m[1] + "-" + m[2] + "-" + m[3], heure: m[4] + "h" + m[5] } : null;
  }

  // Les dates arrivent en heure locale sans fuseau. On les relit en UTC pour
  // les formater : le jour affiché reste ainsi celui du planning, quel que
  // soit le fuseau de la machine.
  function libelleJour(cle) {
    var p = cle.split("-");
    var d = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2]));
    return formatJour.format(d).replace(/\.$/, "");
  }

  function listerCreneaux(creneaux) {
    zoneListe.replaceChildren();

    var parJour = new Map();
    creneaux
      .slice()
      .sort(function (a, b) {
        return String(a.start).localeCompare(String(b.start));
      })
      .forEach(function (c) {
        var debut = decouper(c.start);
        if (!debut) return;
        if (!parJour.has(debut.jour)) parJour.set(debut.jour, []);
        parJour.get(debut.jour).push(c);
      });

    parJour.forEach(function (duJour, cle) {
      var entete = document.createElement("div");
      entete.className = "jour";
      entete.textContent = libelleJour(cle);
      zoneListe.append(entete);

      duJour.forEach(function (c) {
        var debut = decouper(c.start);
        var fin = decouper(c.end);

        var ligne = document.createElement("div");
        ligne.className = "creneau";

        var barre = document.createElement("span");
        barre.className = "barre";
        var teinte = c.loc_color || c.backgroundColor || c.color;
        if (/^#[0-9a-f]{6}$/i.test(String(teinte || ""))) barre.style.background = teinte;
        ligne.append(barre);

        var corps = document.createElement("div");
        corps.className = "corps";

        var titre = document.createElement("div");
        var heure = document.createElement("span");
        heure.className = "heure";
        heure.textContent = debut.heure + (fin ? "–" + fin.heure : "");
        var nom = document.createElement("span");
        nom.className = "nom";
        nom.textContent = c.name || "";
        titre.append(heure, nom);

        var lieu = document.createElement("div");
        lieu.className = "lieu";
        lieu.textContent = c.loc_name || "";

        corps.append(titre, lieu);
        ligne.append(corps);
        zoneListe.append(ligne);
      });
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
    enCours(true);
    zoneListe.replaceChildren();
    afficher("Récupération de ton planning…", "attente");

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

      var avant = Math.max(0, parseInt(document.getElementById("avant").value, 10) || 0);
      var apres = Math.max(1, parseInt(document.getElementById("apres").value, 10) || 365);
      var rappel = parseInt(document.getElementById("rappel").value, 10) || 0;

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
      var texte = nb > 1 ? nb + " créneaux exportés" : nb + " créneau exporté";
      if (sortie.ignores.length) {
        texte += ", " + sortie.ignores.length + " ignoré(s) (dates illisibles)";
      }
      afficher(texte + ".", "succes");
      sousTitre.textContent = nb > 1 ? nb + " créneaux réservés" : nb + " créneau réservé";
      listerCreneaux(resultat.creneaux);
    } catch (err) {
      afficher(err && err.message ? err.message : String(err), "erreur");
    } finally {
      enCours(false);
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
