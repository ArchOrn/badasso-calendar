/*
 * Bouton d'export injecté directement dans les pages BadAsso.
 *
 * Tourne en content script « monde MAIN », c'est-à-dire dans le contexte
 * JavaScript de la page : la requête part donc avec le cookie de session, et
 * tout se fait sur place — récupération, génération du .ics, téléchargement.
 * Ni service worker, ni passage de messages.
 *
 * Contrepartie de ce monde : aucune API d'extension n'est accessible ici
 * (pas de chrome.storage, pas de chrome.downloads). D'où localStorage pour
 * l'état, et un <a download> pour le fichier.
 *
 * L'interface vit dans un shadow DOM : le CSS de BadAsso ne peut pas la
 * déformer, et le nôtre ne peut pas déborder sur le site.
 */
(function () {
  "use strict";

  var JOURS_AVANT = 30;
  var JOURS_APRES = 365;
  var CLE_MASQUE = "badasso-calendar:masque";

  // core.js est injecté juste avant ; en son absence, on ne fait rien.
  if (!window.BadAsso) return;

  // Chrome peut réinjecter un content script (bfcache, navigations internes).
  if (window.__badassoBoutonPose) return;
  window.__badassoBoutonPose = true;

  function masque() {
    try {
      return sessionStorage.getItem(CLE_MASQUE) === "1";
    } catch (err) {
      return false; // sessionStorage indisponible : on affiche, sans insister
    }
  }

  function memoriserMasque() {
    try {
      sessionStorage.setItem(CLE_MASQUE, "1");
    } catch (err) {
      /* sans effet, le bouton réapparaîtra au prochain chargement */
    }
  }

  if (masque()) return;

  // Sans identifiant adhérent, l'export ne peut pas aboutir : plutôt que
  // d'afficher un bouton qui échouera, on s'abstient. Cela restreint de fait
  // le bouton aux pages connectées.
  if (!window.BadAsso.trouverAdhId()) return;

  var STYLE = [
    ":host { all: initial; }",
    ".bulle {",
    "  position: fixed; right: 18px; bottom: 18px; z-index: 2147483000;",
    "  display: flex; align-items: stretch; gap: 1px;",
    "  font: 500 13px/1.3 system-ui, -apple-system, 'Segoe UI', sans-serif;",
    "  border-radius: 10px; overflow: hidden;",
    "  box-shadow: 0 2px 6px rgba(16, 24, 40, 0.18), 0 8px 24px rgba(16, 24, 40, 0.16);",
    "}",
    "button {",
    "  margin: 0; border: 0; background: #1a60d1; color: #fff;",
    "  font: inherit; cursor: pointer; transition: background 0.12s ease;",
    "}",
    ".principal { display: flex; align-items: center; gap: 8px; padding: 11px 14px; }",
    ".principal:hover:not(:disabled) { background: #164fac; }",
    ".principal:disabled { cursor: default; opacity: 0.75; }",
    ".fermer {",
    "  width: 26px; padding: 0; font-size: 15px; line-height: 1;",
    "  color: rgba(255, 255, 255, 0.75);",
    "}",
    ".fermer:hover { background: #164fac; color: #fff; }",
    "button:focus-visible { outline: 2px solid #fff; outline-offset: -3px; }",
    "svg { width: 15px; height: 15px; flex: none; }",
    ".rotation { animation: tourne 0.9s linear infinite; }",
    "@keyframes tourne { to { transform: rotate(360deg); } }",
    ".etat {",
    "  position: fixed; right: 18px; bottom: 66px; z-index: 2147483000;",
    "  max-width: 300px; padding: 9px 12px; border-radius: 8px;",
    "  background: #14161a; color: #fff;",
    "  font: 400 12.5px/1.4 system-ui, -apple-system, 'Segoe UI', sans-serif;",
    "  box-shadow: 0 6px 20px rgba(16, 24, 40, 0.22);",
    "}",
    ".etat:empty { display: none; }",
    ".etat.erreur { background: #8f1d16; }",
    "@media (prefers-reduced-motion: reduce) {",
    "  .rotation { animation: none; }",
    "  button { transition: none; }",
    "}",
  ].join("\n");

  var FLECHE =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" ' +
    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M12 3v12"/><path d="m7 11 5 5 5-5"/><path d="M4 20h16"/></svg>';

  var hote = document.createElement("div");
  hote.setAttribute("data-badasso-calendar", "");
  var racine = hote.attachShadow({ mode: "open" });

  var style = document.createElement("style");
  style.textContent = STYLE;

  var bulle = document.createElement("div");
  bulle.className = "bulle";

  var principal = document.createElement("button");
  principal.className = "principal";
  principal.type = "button";
  // Balisage statique, écrit ici : aucune donnée du site n'y transite.
  principal.innerHTML = FLECHE;
  var libelle = document.createElement("span");
  libelle.textContent = "Exporter mon planning";
  principal.append(libelle);

  var fermer = document.createElement("button");
  fermer.className = "fermer";
  fermer.type = "button";
  fermer.textContent = "×";
  fermer.title = "Masquer jusqu'au prochain chargement";
  fermer.setAttribute("aria-label", "Masquer le bouton d'export");

  var etat = document.createElement("div");
  etat.className = "etat";
  etat.setAttribute("role", "status");

  bulle.append(principal, fermer);
  racine.append(style, etat, bulle);
  document.body.append(hote);

  var effacement = null;

  function dire(texte, erreur, duree) {
    etat.textContent = texte;
    etat.classList.toggle("erreur", !!erreur);
    clearTimeout(effacement);
    if (duree) {
      effacement = setTimeout(function () {
        etat.textContent = "";
      }, duree);
    }
  }

  function occupe(actif) {
    principal.disabled = actif;
    principal.querySelector("svg").classList.toggle("rotation", actif);
    libelle.textContent = actif ? "Récupération…" : "Exporter mon planning";
  }

  async function exporter() {
    occupe(true);
    dire("Récupération de ton planning…");

    try {
      var resultat = await window.BadAsso.collecter(JOURS_AVANT, JOURS_APRES);

      if (!resultat.ok) {
        dire(resultat.erreur, true, 9000);
        return;
      }
      if (!resultat.creneaux.length) {
        dire("Aucun créneau réservé sur la période.", true, 6000);
        return;
      }

      var sortie = window.BadAsso.construireIcs(resultat.creneaux);
      var nb = resultat.creneaux.length - sortie.ignores.length;
      var nom = window.BadAsso.nomFichier();

      var url = URL.createObjectURL(
        new Blob([sortie.ics], { type: "text/calendar;charset=utf-8" })
      );
      var lien = document.createElement("a");
      lien.href = url;
      lien.download = nom;
      document.body.append(lien);
      lien.click();
      lien.remove();
      setTimeout(function () {
        URL.revokeObjectURL(url);
      }, 1000);

      dire((nb > 1 ? nb + " créneaux exportés" : nb + " créneau exporté") + " — " + nom, false, 6000);
    } catch (err) {
      dire(err && err.message ? err.message : String(err), true, 9000);
    } finally {
      occupe(false);
    }
  }

  principal.addEventListener("click", exporter);
  fermer.addEventListener("click", function () {
    memoriserMasque();
    hote.remove();
  });
})();
