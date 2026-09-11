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
/*
 * Cœur commun : accès à l'API BadAsso et génération iCalendar.
 *
 * Source unique de vérité, partagée par :
 *   - l'extension Chrome (popup.js, et injecté dans la page pour la collecte) ;
 *   - le script console badasso-export.js, généré par ./build.sh ;
 *   - les tests Node (test/test-ics.js).
 *
 * Ne contient aucun effet de bord : se charge partout sans rien déclencher.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.BadAsso = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  // Action "Mon planning" : seul endpoint qui filtre déjà sur l'adhérent.
  var ACTION_MON_PLANNING = 729090;
  var TZID = "Europe/Paris";
  var PRODID = "-//badasso-calendar//FR";

  /* ---------------------------------------------------------------- dates */

  // Décalage de Paris ("+02:00") à une date donnée, heure d'été comprise.
  function decalageParis(date) {
    var fmt = new Intl.DateTimeFormat("en-US", {
      timeZone: TZID,
      timeZoneName: "longOffset",
    });
    var nom = fmt.formatToParts(date).find(function (p) {
      return p.type === "timeZoneName";
    });
    var offset = nom ? nom.value.replace("GMT", "") : "";
    return offset || "+00:00";
  }

  function versParamIso(date) {
    var jour = new Intl.DateTimeFormat("en-CA", {
      timeZone: TZID,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(date);
    return jour + "T00:00:00" + decalageParis(date);
  }

  // "2026-09-14T12:00" -> "20260914T120000" (heure locale, portée par TZID)
  function versDateIcs(local) {
    var m = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?$/.exec(
      String(local).trim()
    );
    if (!m) return null;
    return m[1] + m[2] + m[3] + "T" + m[4] + m[5] + (m[6] || "00");
  }

  function horodatageUtc(date) {
    return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  }

  /* ------------------------------------------------------------------ ics */

  function echapper(valeur) {
    return String(valeur == null ? "" : valeur)
      .replace(/\\/g, "\\\\")
      .replace(/;/g, "\\;")
      .replace(/,/g, "\\,")
      .replace(/\r?\n/g, "\\n");
  }

  // RFC 5545 : lignes de 75 octets maximum, repliées par un espace. Le
  // découpage porte sur les octets UTF-8, pas les caractères, sinon un accent
  // en fin de ligne se retrouve coupé en deux.
  function plier(ligne) {
    var octets = new TextEncoder().encode(ligne);
    if (octets.length <= 75) return ligne;

    var decodeur = new TextDecoder();
    var morceaux = [];
    var debut = 0;
    var limite = 75;
    while (debut < octets.length) {
      var fin = Math.min(debut + limite, octets.length);
      while (fin > debut && fin < octets.length && (octets[fin] & 0xc0) === 0x80) {
        fin--;
      }
      morceaux.push(decodeur.decode(octets.subarray(debut, fin)));
      debut = fin;
      limite = 74; // les lignes suivantes perdent un octet pour l'espace
    }
    return morceaux.join("\r\n ");
  }

  function construireIcs(creneaux, options) {
    var opts = options || {};
    var maintenant = opts.genereLe || new Date();
    var rappelMinutes = opts.rappelMinutes || 0;

    var lignes = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:" + PRODID,
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      "X-WR-CALNAME:Badminton",
      "X-WR-TIMEZONE:" + TZID,
      // Sans VTIMEZONE, certains clients interprètent TZID à leur façon.
      "BEGIN:VTIMEZONE",
      "TZID:" + TZID,
      "BEGIN:DAYLIGHT",
      "TZOFFSETFROM:+0100",
      "TZOFFSETTO:+0200",
      "TZNAME:CEST",
      "DTSTART:19700329T020000",
      "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU",
      "END:DAYLIGHT",
      "BEGIN:STANDARD",
      "TZOFFSETFROM:+0200",
      "TZOFFSETTO:+0100",
      "TZNAME:CET",
      "DTSTART:19701025T030000",
      "RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU",
      "END:STANDARD",
      "END:VTIMEZONE",
    ];

    var ignores = [];

    creneaux.forEach(function (c) {
      var debut = versDateIcs(c.start);
      var fin = versDateIcs(c.end);
      if (!debut || !fin) {
        ignores.push(c);
        return;
      }

      var details = [];
      if (c.group_name) details.push("Groupe : " + c.group_name);
      if (c.cmt) details.push(c.cmt);
      details.push("Créneau BadAsso n°" + c.id);

      lignes.push(
        "BEGIN:VEVENT",
        // UID stable : réimporter le fichier met à jour l'évènement existant
        // au lieu d'en créer un doublon.
        "UID:badasso-" + c.id + "@bad-asso.fr",
        "DTSTAMP:" + horodatageUtc(maintenant),
        "DTSTART;TZID=" + TZID + ":" + debut,
        "DTEND;TZID=" + TZID + ":" + fin,
        plier("SUMMARY:" + echapper(c.name || "Badminton")),
        plier("LOCATION:" + echapper(c.loc_name || "")),
        plier("DESCRIPTION:" + echapper(details.join("\n"))),
        "STATUS:CONFIRMED",
        "TRANSP:OPAQUE"
      );

      if (rappelMinutes > 0) {
        lignes.push(
          "BEGIN:VALARM",
          "ACTION:DISPLAY",
          plier("DESCRIPTION:" + echapper(c.name || "Badminton")),
          "TRIGGER:-PT" + rappelMinutes + "M",
          "END:VALARM"
        );
      }

      lignes.push("END:VEVENT");
    });

    lignes.push("END:VCALENDAR");
    return { ics: lignes.join("\r\n") + "\r\n", ignores: ignores };
  }

  function nomFichier(date) {
    var jour = new Intl.DateTimeFormat("en-CA", {
      timeZone: TZID,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(date || new Date());
    return "badasso-planning-" + jour + ".ics";
  }

  /* ---------------------------------------------------------- récupération */

  function urlPlanning(adhId, debut, fin) {
    return (
      "/index.php?ic_ajax=1&ic_a=" +
      ACTION_MON_PLANNING +
      "&adh_id=" +
      encodeURIComponent(adhId) +
      "&start=" +
      encodeURIComponent(versParamIso(debut)) +
      "&end=" +
      encodeURIComponent(versParamIso(fin))
    );
  }

  // L'identifiant adhérent apparaît dans la page sous plusieurs formes selon
  // l'écran : champ caché de formulaire, attribut data-*, ou paramètre d'URL
  // dans le JS d'initialisation du calendrier.
  function trouverAdhId() {
    var champ = document.querySelector(
      'input[name="adh_id"], input#adh_id, [data-adh_id]'
    );
    if (champ) {
      var v = champ.value || champ.getAttribute("data-adh_id");
      if (v && /^\d+$/.test(String(v).trim())) return String(v).trim();
    }
    var m = /adh_id["'=:\s]+(\d{2,})/.exec(document.documentElement.innerHTML);
    return m ? m[1] : null;
  }

  async function recupererCreneaux(adhId, debut, fin) {
    var reponse = await fetch(urlPlanning(adhId, debut, fin), {
      credentials: "include",
      headers: { "X-Requested-With": "XMLHttpRequest" },
    });
    var texte = (await reponse.text()).trim();

    if (!reponse.ok) {
      throw new Error("Le serveur a répondu HTTP " + reponse.status + ".");
    }

    // On ne se fie pas au content-type : BadAsso sert son JSON en text/html.
    // Seul le corps de la réponse fait foi.
    var donnees;
    try {
      donnees = JSON.parse(texte);
    } catch (err) {
      if (/login|n'avez pas accès/i.test(texte)) {
        throw new Error(
          "Le serveur a renvoyé la page de login : ta session a expiré. " +
            "Reconnecte-toi sur bad-asso.fr, puis réessaie."
        );
      }
      throw new Error(
        "Réponse illisible (ni JSON, ni page de login) : " + texte.slice(0, 200)
      );
    }

    if (!Array.isArray(donnees)) throw new Error("JSON inattendu : un tableau était attendu.");
    return donnees;
  }

  /*
   * Point d'entrée de la collecte, exécuté dans le contexte de la page.
   *
   * Le résultat doit être sérialisable : l'extension le récupère au travers de
   * chrome.scripting, qui ne transmet ni les exceptions ni les objets riches.
   * D'où le retour d'un objet { ok } plutôt qu'une exception.
   */
  async function collecter(joursAvant, joursApres) {
    try {
      var adhId = trouverAdhId();
      if (!adhId) {
        return {
          ok: false,
          erreur:
            "Identifiant adhérent introuvable. Ouvre la page « Mon planning » sur bad-asso.fr, puis réessaie.",
        };
      }
      var jour = 86400000;
      var creneaux = await recupererCreneaux(
        adhId,
        new Date(Date.now() - joursAvant * jour),
        new Date(Date.now() + joursApres * jour)
      );
      return { ok: true, adhId: adhId, creneaux: creneaux };
    } catch (err) {
      return { ok: false, erreur: err && err.message ? err.message : String(err) };
    }
  }

  return {
    ACTION_MON_PLANNING: ACTION_MON_PLANNING,
    TZID: TZID,
    collecter: collecter,
    construireIcs: construireIcs,
    echapper: echapper,
    nomFichier: nomFichier,
    plier: plier,
    recupererCreneaux: recupererCreneaux,
    trouverAdhId: trouverAdhId,
    urlPlanning: urlPlanning,
    versDateIcs: versDateIcs,
  };
});

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
