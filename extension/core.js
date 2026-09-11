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

  /* --------------------------------------------------------------- couleur */

  // Sous-ensemble des couleurs nommées CSS3, réparti sur le spectre.
  var COULEURS_CSS = {
    black: [0, 0, 0], dimgray: [105, 105, 105], gray: [128, 128, 128],
    darkgray: [169, 169, 169], silver: [192, 192, 192], lightgray: [211, 211, 211],
    gainsboro: [220, 220, 220], whitesmoke: [245, 245, 245], white: [255, 255, 255],
    maroon: [128, 0, 0], darkred: [139, 0, 0], brown: [165, 42, 42],
    firebrick: [178, 34, 34], red: [255, 0, 0], tomato: [255, 99, 71],
    coral: [255, 127, 80], salmon: [250, 128, 114], lightsalmon: [255, 160, 122],
    orangered: [255, 69, 0], darkorange: [255, 140, 0], orange: [255, 165, 0],
    goldenrod: [218, 165, 32], gold: [255, 215, 0], khaki: [240, 230, 140],
    yellow: [255, 255, 0], olive: [128, 128, 0], yellowgreen: [154, 205, 50],
    darkolivegreen: [85, 107, 47], greenyellow: [173, 255, 47], lawngreen: [124, 252, 0],
    darkgreen: [0, 100, 0], green: [0, 128, 0], forestgreen: [34, 139, 34],
    limegreen: [50, 205, 50], lime: [0, 255, 0], darkseagreen: [143, 188, 143],
    lightgreen: [144, 238, 144], mediumseagreen: [60, 179, 113], seagreen: [46, 139, 87],
    teal: [0, 128, 128], darkcyan: [0, 139, 139], cyan: [0, 255, 255],
    turquoise: [64, 224, 208], cadetblue: [95, 158, 160], lightblue: [173, 216, 230],
    skyblue: [135, 206, 235], steelblue: [70, 130, 180], dodgerblue: [30, 144, 255],
    royalblue: [65, 105, 225], blue: [0, 0, 255], mediumblue: [0, 0, 205],
    navy: [0, 0, 128], midnightblue: [25, 25, 112], slateblue: [106, 90, 205],
    mediumpurple: [147, 112, 219], blueviolet: [138, 43, 226], darkviolet: [148, 0, 211],
    purple: [128, 0, 128], orchid: [218, 112, 214], violet: [238, 130, 238],
    plum: [221, 160, 221], thistle: [216, 191, 216], magenta: [255, 0, 255],
    mediumvioletred: [199, 21, 133], deeppink: [255, 20, 147], hotpink: [255, 105, 180],
    palevioletred: [219, 112, 147], pink: [255, 192, 203], lightpink: [255, 182, 193],
    tan: [210, 180, 140], peru: [205, 133, 63], sienna: [160, 82, 45],
    wheat: [245, 222, 179], beige: [245, 245, 220], lavender: [230, 230, 250],
  };

  // RFC 7986 : COLOR attend un nom CSS3, pas un hexadécimal. On rapproche donc
  // la couleur du gymnase du nom le plus proche, distance euclidienne en RGB.
  function nomCouleurCss(hex) {
    var m = /^#?([0-9a-f]{6})$/i.exec(String(hex || "").trim());
    if (!m) return null;
    var entier = parseInt(m[1], 16);
    var r = (entier >> 16) & 255;
    var v = (entier >> 8) & 255;
    var b = entier & 255;

    var meilleur = null;
    var meilleureDistance = Infinity;
    Object.keys(COULEURS_CSS).forEach(function (nom) {
      var c = COULEURS_CSS[nom];
      var d = (c[0] - r) * (c[0] - r) + (c[1] - v) * (c[1] - v) + (c[2] - b) * (c[2] - b);
      if (d < meilleureDistance) {
        meilleureDistance = d;
        meilleur = nom;
      }
    });
    return meilleur;
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

      var couleur = nomCouleurCss(c.loc_color || c.backgroundColor || c.color);
      if (couleur) lignes.push("COLOR:" + couleur);

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
    nomCouleurCss: nomCouleurCss,
    nomFichier: nomFichier,
    plier: plier,
    recupererCreneaux: recupererCreneaux,
    trouverAdhId: trouverAdhId,
    urlPlanning: urlPlanning,
    versDateIcs: versDateIcs,
  };
});
