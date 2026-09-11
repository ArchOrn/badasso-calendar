/*
 * Render the Chrome Web Store screenshots (1280x800) with headless Chrome.
 *
 *   node tools/screenshots.js
 *
 * Writes dist/store/screenshot-{1,2}.png.
 *
 * The extension UI is rendered for real, from the actual source files, with
 * chrome.* stubbed and the network answered from test/real-planning.json — so
 * the screenshots cannot drift away from what the extension really looks like.
 *
 * Set CHROME_BIN to point at another Chrome or Chromium build.
 */
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const ROOT = path.join(__dirname, "..");
const OUT = path.join(ROOT, "dist", "store");

const CHROME_CANDIDATES = [
  process.env.CHROME_BIN,
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
].filter(Boolean);

function findChrome() {
  const found = CHROME_CANDIDATES.find((candidate) => fs.existsSync(candidate));
  if (!found) {
    console.error(
      "Chrome introuvable. Renseigne CHROME_BIN, par exemple :\n" +
        "  CHROME_BIN='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' node tools/screenshots.js"
    );
    process.exit(1);
  }
  return found;
}

// Venue colors, as the API sends them.
const TINTS = {
  "Gymnase des Tilleuls": "#1a60d1",
  "Halle Nord": "#f0a032",
};

function loadSlots() {
  const slots = JSON.parse(
    fs.readFileSync(path.join(ROOT, "test", "real-planning.json"), "utf8")
  );
  slots.forEach((slot) => {
    slot.loc_color = TINTS[slot.loc_name] || "#932079";
  });
  return slots;
}

/* --------------------------------------------------------------- templates */

function stubScript(slots) {
  return `
const FIXTURE = ${JSON.stringify(slots)};
window.chrome = {
  storage: { local: { get: async () => ({}), set: () => {} } },
  tabs: { query: async () => [{ id: 1, url: "https://bad-asso.fr/adherent/planning" }] },
  scripting: {
    executeScript: async (o) =>
      o.func ? [{ result: { ok: true, memberId: "12345", slots: FIXTURE } }] : [{}],
  },
  downloads: { download: (o, cb) => cb(1) },
  runtime: {},
};
`;
}

function mockSitePage(slots) {
  const rows = slots
    .slice(0, 6)
    .map(
      (slot) =>
        `<tr><td>${slot.start.replace("T", " à ")}</td><td>${slot.name}</td><td>${slot.loc_name}</td></tr>`
    )
    .join("");

  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><style>
    body { margin: 0; font: 15px/1.6 system-ui, sans-serif; background: #fff; color: #24252a; }
    .topbar { background: #932079; color: #fff; padding: 16px 34px; font-size: 17px; font-weight: 600; }
    .nav { border-bottom: 1px solid #e6e1e4; padding: 0 34px; display: flex; gap: 26px; }
    .nav span { padding: 13px 0; color: #6b6570; font-size: 14px; }
    .nav .on { color: #932079; font-weight: 600; box-shadow: inset 0 -2px 0 #932079; }
    .page { padding: 26px 34px; }
    h2 { margin: 0 0 4px; font-size: 20px; }
    p.lede { margin: 0 0 20px; color: #6b6570; font-size: 14px; }
    table { border-collapse: collapse; width: 100%; max-width: 900px; }
    th { background: #faf6f9; font-size: 12px; text-transform: uppercase; letter-spacing: .05em; color: #6b6570; }
    th, td { border: 1px solid #e6e1e4; padding: 10px 13px; text-align: left; font-size: 14px; }
  </style></head><body>
    <div class="topbar">BadAsso</div>
    <div class="nav"><span>Accueil</span><span class="on">Mon planning</span><span>Réservations</span><span>Mon compte</span></div>
    <div class="page">
      <input type="hidden" name="adh_id" value="12345">
      <h2>Mon planning</h2>
      <p class="lede">Vos créneaux réservés à venir.</p>
      <table><tr><th>Date</th><th>Créneau</th><th>Lieu</th></tr>${rows}</table>
    </div>
    <script>
      window.fetch = async () => new Response(${JSON.stringify(JSON.stringify(slots))},
        { status: 200, headers: { "content-type": "text/html" } });
    </script>
    <script src="core.js"></script><script src="inpage.js"></script>
  </body></html>`;
}

// The 1280x800 canvas the store expects, with a caption and the UI inside.
function frame(caption, innerSrc, innerWidth, innerHeight, extraCss) {
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><style>
    html, body { margin: 0; width: 1280px; height: 800px; overflow: hidden; }
    body {
      display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 30px;
      background: linear-gradient(150deg, #fdf6fb 0%, #f3e6ef 55%, #ead7e5 100%);
      font: 15px system-ui, -apple-system, "Segoe UI", sans-serif; color: #3a2233;
    }
    h1 { margin: 0; font-size: 27px; font-weight: 600; letter-spacing: -0.02em; text-align: center; }
    .shell {
      width: ${innerWidth}px; height: ${innerHeight}px; border-radius: 12px; overflow: hidden;
      background: #fff; box-shadow: 0 18px 50px rgba(58, 34, 51, .2), 0 3px 10px rgba(58, 34, 51, .1);
      ${extraCss || ""}
    }
    iframe { width: 100%; height: 100%; border: 0; display: block; }
  </style></head><body>
    <h1>${caption}</h1>
    <div class="shell"><iframe src="${innerSrc}" scrolling="no"></iframe></div>
  </body></html>`;
}

/* -------------------------------------------------------------------- main */

function main() {
  const chrome = findChrome();
  const slots = loadSlots();
  const work = fs.mkdtempSync(path.join(os.tmpdir(), "badasso-shots-"));

  for (const file of ["core.js", "inpage.js", "popup.js"]) {
    fs.copyFileSync(path.join(ROOT, "extension", file), path.join(work, file));
  }
  fs.writeFileSync(path.join(work, "stub.js"), stubScript(slots));
  fs.writeFileSync(path.join(work, "site.html"), mockSitePage(slots));

  // The popup, with its export already run so the slot list is visible.
  const popup = fs
    .readFileSync(path.join(ROOT, "extension", "popup.html"), "utf8")
    .replace('<script src="core.js"></script>', '<script src="stub.js"></script>\n<script src="core.js"></script>')
    .replace(
      "</body>",
      '<script>addEventListener("load", () => setTimeout(() => document.getElementById("export").click(), 80));</script></body>'
    )
    // Screenshots are taken in light mode: the store shows them on a light page.
    .replace("@media (prefers-color-scheme: dark)", "@media (prefers-color-scheme: xxnone)");
  fs.writeFileSync(path.join(work, "popup.html"), popup);

  fs.writeFileSync(
    path.join(work, "frame-1.html"),
    frame("Un bouton d’export sur chaque page BadAsso", "site.html", 1020, 520)
  );
  fs.writeFileSync(
    path.join(work, "frame-2.html"),
    frame("Période, rappels, et vérification avant import", "popup.html", 344, 560)
  );

  fs.mkdirSync(OUT, { recursive: true });

  [1, 2].forEach((index) => {
    const target = path.join(OUT, `screenshot-${index}.png`);
    execFileSync(
      chrome,
      [
        "--headless",
        "--disable-gpu",
        "--hide-scrollbars",
        "--force-color-profile=srgb",
        "--virtual-time-budget=4000",
        "--window-size=1280,800",
        `--screenshot=${target}`,
        `file://${path.join(work, `frame-${index}.html`)}`,
      ],
      { stdio: "ignore" }
    );
    const size = fs.statSync(target).size;
    console.log(`  ${path.relative(ROOT, target)}  (${size} bytes)`);
  });

  fs.rmSync(work, { recursive: true, force: true });
}

main();
