/*
 * Extension popup: triggers collection in the BadAsso tab, builds the .ics
 * file and downloads it.
 *
 * Works on Chrome and Firefox. `api` resolves to `browser` where it exists
 * (Firefox) and to `chrome` otherwise; every call below is promise-based,
 * which both support — Firefox through `browser.*`, Chrome through its MV3
 * promise-returning APIs.
 *
 * User-facing strings stay in French: they are read by club members.
 */
(function () {
  "use strict";

  var api = globalThis.browser || globalThis.chrome;

  var ORIGINS = ["https://bad-asso.fr/*", "https://*.bad-asso.fr/*"];

  var exportButton = document.getElementById("export");
  var buttonLabel = document.getElementById("button-label");
  var buttonIcon = exportButton.querySelector("svg");
  var subtitle = document.getElementById("subtitle");
  var statusBox = document.getElementById("status");
  var list = document.getElementById("list");

  var SETTINGS = ["before", "after", "reminder"];

  var dayFormatter = new Intl.DateTimeFormat("fr-FR", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });

  function say(text, kind) {
    statusBox.textContent = text;
    statusBox.className = kind || "";
  }

  function setBusy(busy) {
    exportButton.disabled = busy;
    buttonIcon.classList.toggle("spin", busy);
    buttonLabel.textContent = busy ? "Récupération…" : "Exporter mon planning";
  }

  function isBadAsso(url) {
    try {
      return /(^|\.)bad-asso\.fr$/.test(new URL(url).hostname);
    } catch (err) {
      return false;
    }
  }

  function splitLocal(value) {
    var match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(String(value || ""));
    return match
      ? { day: match[1] + "-" + match[2] + "-" + match[3], time: match[4] + "h" + match[5] }
      : null;
  }

  // Dates arrive as local time without a zone. They are read back as UTC for
  // formatting, so the day shown stays the planning's day whatever the
  // machine's own time zone.
  function dayLabel(key) {
    var parts = key.split("-");
    var date = new Date(Date.UTC(+parts[0], +parts[1] - 1, +parts[2]));
    return dayFormatter.format(date).replace(/\.$/, "");
  }

  function renderSlots(slots) {
    list.replaceChildren();

    var byDay = new Map();
    slots
      .slice()
      .sort(function (a, b) {
        return String(a.start).localeCompare(String(b.start));
      })
      .forEach(function (slot) {
        var start = splitLocal(slot.start);
        if (!start) return;
        if (!byDay.has(start.day)) byDay.set(start.day, []);
        byDay.get(start.day).push(slot);
      });

    byDay.forEach(function (daySlots, key) {
      var header = document.createElement("div");
      header.className = "day";
      header.textContent = dayLabel(key);
      list.append(header);

      daySlots.forEach(function (slot) {
        var start = splitLocal(slot.start);
        var end = splitLocal(slot.end);

        var row = document.createElement("div");
        row.className = "slot";

        var bar = document.createElement("span");
        bar.className = "bar";
        var tint = slot.loc_color || slot.backgroundColor || slot.color;
        if (/^#[0-9a-f]{6}$/i.test(String(tint || ""))) bar.style.background = tint;
        row.append(bar);

        var body = document.createElement("div");
        body.className = "body";

        var title = document.createElement("div");
        var time = document.createElement("span");
        time.className = "time";
        time.textContent = start.time + (end ? "–" + end.time : "");
        var name = document.createElement("span");
        name.className = "name";
        name.textContent = slot.name || "";
        title.append(time, name);

        var place = document.createElement("div");
        place.className = "place";
        place.textContent = slot.loc_name || "";

        body.append(title, place);
        row.append(body);
        list.append(row);
      });
    });
  }

  async function download(ics, name) {
    var url = URL.createObjectURL(new Blob([ics], { type: "text/calendar;charset=utf-8" }));
    try {
      await api.downloads.download({ url: url, filename: name, saveAs: false });
    } finally {
      // The blob must stay alive until the download actually starts.
      setTimeout(function () {
        URL.revokeObjectURL(url);
      }, 20000);
    }
  }

  /*
   * Firefox treats host permissions as revocable: the user can withdraw
   * access to bad-asso.fr at any time from about:addons, and the extension
   * then silently stops working. So check, and ask again from within the
   * click — a permission request needs a user gesture.
   *
   * On Chrome the permission is granted at install and contains() is true,
   * so this costs nothing.
   */
  async function ensureHostAccess() {
    if (!api.permissions) return true;
    try {
      if (await api.permissions.contains({ origins: ORIGINS })) return true;
      return await api.permissions.request({ origins: ORIGINS });
    } catch (err) {
      return true; // unsupported: let the export attempt speak for itself
    }
  }

  async function exportPlanning() {
    setBusy(true);
    list.replaceChildren();
    say("Récupération de ton planning…", "pending");

    try {
      if (!(await ensureHostAccess())) {
        say(
          "L'accès à bad-asso.fr a été refusé. Autorise-le dans la gestion des extensions, puis réessaie.",
          "error"
        );
        return;
      }

      var tabs = await api.tabs.query({ active: true, currentWindow: true });
      var tab = tabs[0];

      if (!tab || !isBadAsso(tab.url)) {
        say(
          "Ouvre d'abord bad-asso.fr dans cet onglet, connecte-toi, puis relance l'export.",
          "error"
        );
        return;
      }

      var before = Math.max(0, parseInt(document.getElementById("before").value, 10) || 0);
      var after = Math.max(1, parseInt(document.getElementById("after").value, 10) || 365);
      var reminder = parseInt(document.getElementById("reminder").value, 10) || 0;

      // Collection runs in the MAIN world: the request then leaves from the
      // page itself, carrying its session cookie. From a content script's
      // isolated world, the PHPSESSID cookie would not be attached.
      await api.scripting.executeScript({
        target: { tabId: tab.id },
        world: "MAIN",
        files: ["core.js"],
      });

      var results = await api.scripting.executeScript({
        target: { tabId: tab.id },
        world: "MAIN",
        func: function (a, b) {
          return window.BadAsso.collect(a, b);
        },
        args: [before, after],
      });

      var result = results && results[0] && results[0].result;
      if (!result) {
        say("Aucune réponse de la page. Recharge bad-asso.fr et réessaie.", "error");
        return;
      }
      if (!result.ok) {
        say(result.error, "error");
        return;
      }
      if (!result.slots.length) {
        say("Aucun créneau réservé sur cette période.", "error");
        return;
      }

      var output = BadAsso.buildIcs(result.slots, { reminderMinutes: reminder });
      await download(output.ics, BadAsso.fileName());

      var count = result.slots.length - output.skipped.length;
      var text = count > 1 ? count + " créneaux exportés" : count + " créneau exporté";
      if (output.skipped.length) {
        text += ", " + output.skipped.length + " ignoré(s) (dates illisibles)";
      }
      say(text + ".", "success");
      subtitle.textContent =
        count > 1 ? count + " créneaux réservés" : count + " créneau réservé";
      renderSlots(result.slots);
    } catch (err) {
      say(err && err.message ? err.message : String(err), "error");
    } finally {
      setBusy(false);
    }
  }

  async function restoreSettings() {
    try {
      var stored = await api.storage.local.get(SETTINGS);
      SETTINGS.forEach(function (key) {
        if (stored && stored[key] != null) document.getElementById(key).value = stored[key];
      });
    } catch (err) {
      /* defaults stay in place */
    }
  }

  SETTINGS.forEach(function (key) {
    document.getElementById(key).addEventListener("change", function (event) {
      api.storage.local.set({ [key]: event.target.value });
    });
  });

  exportButton.addEventListener("click", exportPlanning);
  restoreSettings();
})();
