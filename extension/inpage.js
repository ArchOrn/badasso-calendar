/*
 * Export button injected straight into BadAsso pages.
 *
 * Runs as a content script in the MAIN world, i.e. in the page's own
 * JavaScript context: the request therefore carries the session cookie, and
 * everything happens in place — fetching, building the .ics, downloading.
 * No service worker, no message passing.
 *
 * The trade-off of that world: no extension API is reachable here (no
 * chrome.storage, no chrome.downloads). Hence localStorage for state, and an
 * <a download> for the file.
 *
 * The UI lives in a shadow DOM: BadAsso's CSS cannot distort it, and ours
 * cannot leak onto the site.
 *
 * User-facing strings stay in French: they are read by club members.
 */
(function () {
  "use strict";

  var DAYS_BEFORE = 30;
  var DAYS_AFTER = 365;
  var COLLAPSED_KEY = "badasso-calendar:collapsed";
  var DETECT_TIMEOUT = 8000; // member detection: total budget
  var DETECT_INTERVAL = 400;

  // BadAsso brand purple. Contrast against white: 7.7:1.
  var BRAND = "#932079";
  var BRAND_DARK = "#7a1a65";

  // Diagnostics: without these traces, a missing button is undebuggable.
  function trace(reason) {
    console.info("[BadAsso] Bouton d'export non affiché — " + reason);
  }

  // core.js is injected right before; if it is missing, do nothing.
  if (!window.BadAsso) {
    trace("core.js n'est pas chargé (window.BadAsso absent).");
    return;
  }

  // Chrome may re-inject a content script (bfcache, in-page navigations).
  if (window.__badassoButtonMounted) return;
  window.__badassoButtonMounted = true;

  /*
   * The button never disappears entirely: the "×" collapses it into a pill
   * that one click expands again. An element that vanishes without a trace
   * leaves the user with no way to bring it back.
   *
   * State lives in localStorage, so it survives across visits.
   */
  function readCollapsed() {
    try {
      return localStorage.getItem(COLLAPSED_KEY) === "1";
    } catch (err) {
      return false; // storage unavailable: show it expanded
    }
  }

  function writeCollapsed(collapsed) {
    try {
      localStorage.setItem(COLLAPSED_KEY, collapsed ? "1" : "0");
    } catch (err) {
      /* no effect: the state is not remembered, the button still works */
    }
  }

  /*
   * On pages where the planning loads over AJAX, the member id is not in the
   * DOM yet when the content script runs. So retry for a few seconds before
   * giving up.
   */
  function waitForMemberId() {
    return new Promise(function (resolve) {
      var found = window.BadAsso.findMemberId();
      if (found) return resolve(found);

      var deadline = Date.now() + DETECT_TIMEOUT;
      var timer = setInterval(function () {
        var id = window.BadAsso.findMemberId();
        if (id || Date.now() > deadline) {
          clearInterval(timer);
          resolve(id || null);
        }
      }, DETECT_INTERVAL);
    });
  }

  var STYLE = [
    ":host { all: initial; }",
    ".bubble {",
    "  position: fixed; right: 18px; bottom: 18px; z-index: 2147483000;",
    "  display: flex; align-items: stretch; gap: 1px;",
    "  font: 500 13px/1.3 system-ui, -apple-system, 'Segoe UI', sans-serif;",
    "  border-radius: 10px; overflow: hidden;",
    "  box-shadow: 0 2px 6px rgba(16, 24, 40, 0.18), 0 8px 24px rgba(16, 24, 40, 0.16);",
    "}",
    "button {",
    "  margin: 0; border: 0; background: " + BRAND + "; color: #fff;",
    "  font: inherit; cursor: pointer; transition: background 0.12s ease;",
    "}",
    ".main { display: flex; align-items: center; gap: 8px; padding: 11px 14px; }",
    ".main:hover:not(:disabled) { background: " + BRAND_DARK + "; }",
    ".main:disabled { cursor: default; opacity: 0.75; }",
    ".collapse {",
    "  width: 26px; padding: 0; font-size: 15px; line-height: 1;",
    "  color: rgba(255, 255, 255, 0.75);",
    "}",
    ".collapse:hover { background: " + BRAND_DARK + "; color: #fff; }",
    "button:focus-visible { outline: 2px solid #fff; outline-offset: -3px; }",
    "svg { width: 15px; height: 15px; flex: none; }",
    // Collapsed: only the pill remains, label and close button fade out.
    ".bubble.collapsed { border-radius: 999px; }",
    ".bubble.collapsed .main { padding: 10px; }",
    ".bubble.collapsed .label, .bubble.collapsed .collapse { display: none; }",
    ".spin { animation: spin 0.9s linear infinite; }",
    "@keyframes spin { to { transform: rotate(360deg); } }",
    ".status {",
    "  position: fixed; right: 18px; bottom: 66px; z-index: 2147483000;",
    "  max-width: 300px; padding: 9px 12px; border-radius: 8px;",
    "  background: #14161a; color: #fff;",
    "  font: 400 12.5px/1.4 system-ui, -apple-system, 'Segoe UI', sans-serif;",
    "  box-shadow: 0 6px 20px rgba(16, 24, 40, 0.22);",
    "}",
    ".status:empty { display: none; }",
    ".status.error { background: #8f1d16; }",
    "@media (prefers-reduced-motion: reduce) {",
    "  .spin { animation: none; }",
    "  button { transition: none; }",
    "}",
  ].join("\n");

  var ARROW =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" ' +
    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M12 3v12"/><path d="m7 11 5 5 5-5"/><path d="M4 20h16"/></svg>';

  function mount() {
    var host = document.createElement("div");
    host.setAttribute("data-badasso-calendar", "");
    var shadow = host.attachShadow({ mode: "open" });

    var style = document.createElement("style");
    style.textContent = STYLE;

    var bubble = document.createElement("div");
    bubble.className = "bubble";

    var mainButton = document.createElement("button");
    mainButton.className = "main";
    mainButton.type = "button";
    // Static markup, written here: no site data flows through it.
    mainButton.innerHTML = ARROW;
    var label = document.createElement("span");
    label.className = "label";
    label.textContent = "Exporter mon planning";
    mainButton.append(label);

    var collapseButton = document.createElement("button");
    collapseButton.className = "collapse";
    collapseButton.type = "button";
    collapseButton.textContent = "×";
    collapseButton.title = "Replier";
    collapseButton.setAttribute("aria-label", "Replier le bouton d'export");

    var status = document.createElement("div");
    status.className = "status";
    status.setAttribute("role", "status");

    bubble.append(mainButton, collapseButton);
    shadow.append(style, status, bubble);
    document.body.append(host);

    var collapsed = readCollapsed();
    var clearTimer = null;

    function applyCollapsed() {
      bubble.classList.toggle("collapsed", collapsed);
      mainButton.title = collapsed ? "Exporter mon planning BadAsso" : "";
      mainButton.setAttribute(
        "aria-label",
        collapsed ? "Déplier le bouton d'export du planning" : "Exporter mon planning"
      );
    }

    function say(text, isError, duration) {
      status.textContent = text;
      status.classList.toggle("error", !!isError);
      clearTimeout(clearTimer);
      if (duration) {
        clearTimer = setTimeout(function () {
          status.textContent = "";
        }, duration);
      }
    }

    function setBusy(busy) {
      mainButton.disabled = busy;
      mainButton.querySelector("svg").classList.toggle("spin", busy);
      label.textContent = busy ? "Récupération…" : "Exporter mon planning";
    }

    async function exportPlanning() {
      setBusy(true);
      say("Récupération de ton planning…");

      try {
        var result = await window.BadAsso.collect(DAYS_BEFORE, DAYS_AFTER);

        if (!result.ok) {
          say(result.error, true, 9000);
          return;
        }
        if (!result.slots.length) {
          say("Aucun créneau réservé sur la période.", true, 6000);
          return;
        }

        var output = window.BadAsso.buildIcs(result.slots);
        var count = result.slots.length - output.skipped.length;
        var name = window.BadAsso.fileName();

        var url = URL.createObjectURL(
          new Blob([output.ics], { type: "text/calendar;charset=utf-8" })
        );
        var link = document.createElement("a");
        link.href = url;
        link.download = name;
        document.body.append(link);
        link.click();
        link.remove();
        setTimeout(function () {
          URL.revokeObjectURL(url);
        }, 1000);

        say(
          (count > 1 ? count + " créneaux exportés" : count + " créneau exporté") + " — " + name,
          false,
          6000
        );
      } catch (err) {
        say(err && err.message ? err.message : String(err), true, 9000);
      } finally {
        setBusy(false);
      }
    }

    // Collapsed, the main button expands; expanded, it exports.
    mainButton.addEventListener("click", function () {
      if (collapsed) {
        collapsed = false;
        writeCollapsed(false);
        applyCollapsed();
        return;
      }
      exportPlanning();
    });

    collapseButton.addEventListener("click", function () {
      collapsed = true;
      writeCollapsed(true);
      applyCollapsed();
      say("Bouton replié. Clique sur la pastille pour le rouvrir.", false, 4000);
    });

    applyCollapsed();
  }

  // Without a member id the export cannot succeed: rather than showing a
  // button that will fail, show none. That effectively limits the button to
  // pages where the user is logged in.
  waitForMemberId().then(function (memberId) {
    if (!memberId) {
      trace(
        "identifiant adhérent introuvable dans cette page après " +
          DETECT_TIMEOUT / 1000 +
          " s. Si tu es bien connecté, c'est la détection qu'il faut corriger."
      );
      return;
    }
    console.debug("[BadAsso] Bouton d'export prêt (adhérent " + memberId + ").");
    mount();
  });
})();
