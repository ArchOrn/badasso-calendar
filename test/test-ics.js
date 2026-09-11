/*
 * Vérifie la génération ICS sur la réponse réelle de l'endpoint "Mon planning"
 * (test/planning-reel.json, réduit aux champs réellement consommés).
 *
 *   node test/test-ics.js
 */
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const api = require("../extension/core.js");
const creneaux = JSON.parse(
  fs.readFileSync(path.join(__dirname, "planning-reel.json"), "utf8")
);

let ok = 0;
function verifie(nom, fn) {
  try {
    fn();
    console.log("  ok   " + nom);
    ok++;
  } catch (err) {
    console.error("  FAIL " + nom + "\n       " + err.message);
    process.exitCode = 1;
  }
}

const { ics, ignores } = api.construireIcs(creneaux, { genereLe: new Date("2026-09-11T10:00:00Z") });
const lignes = ics.split("\r\n");

console.log("Génération ICS");

verifie("aucun créneau ignoré", () => {
  assert.deepStrictEqual(ignores, []);
});

verifie("un VEVENT par créneau", () => {
  const n = lignes.filter((l) => l === "BEGIN:VEVENT").length;
  assert.strictEqual(n, creneaux.length);
  assert.strictEqual(lignes.filter((l) => l === "END:VEVENT").length, creneaux.length);
});

verifie("calendrier ouvert et fermé", () => {
  assert.strictEqual(lignes[0], "BEGIN:VCALENDAR");
  assert.strictEqual(ics.trimEnd().endsWith("END:VCALENDAR"), true);
});

verifie("VTIMEZONE Europe/Paris présent", () => {
  assert.ok(lignes.includes("BEGIN:VTIMEZONE"));
  assert.ok(lignes.includes("TZID:Europe/Paris"));
});

verifie("heure locale conservée, sans décalage parasite", () => {
  // Le créneau du 14/09 à 12:00 doit rester 12:00, porté par TZID.
  assert.ok(lignes.includes("DTSTART;TZID=Europe/Paris:20260914T120000"));
  assert.ok(lignes.includes("DTEND;TZID=Europe/Paris:20260914T133000"));
});

verifie("créneau de fin de soirée à cheval sur l'heure d'hiver", () => {
  // 07/10 : encore en CEST, l'ICS ne doit pas convertir la valeur.
  assert.ok(lignes.includes("DTSTART;TZID=Europe/Paris:20261007T193000"));
});

verifie("UID stable et unique par créneau", () => {
  const uids = lignes.filter((l) => l.startsWith("UID:"));
  assert.strictEqual(uids.length, creneaux.length);
  assert.strictEqual(new Set(uids).size, creneaux.length);
  assert.ok(uids.includes("UID:badasso-1001@bad-asso.fr"));
});

verifie("les entraînements sont exportés", () => {
  const n = lignes.filter((l) => l.includes("Entraînement compétiteurs")).length;
  assert.ok(n >= 4, "attendu au moins 4 entraînements, trouvé " + n);
});

verifie("le lieu est renseigné", () => {
  assert.ok(lignes.some((l) => l.startsWith("LOCATION:Gymnase des Tilleuls")));
});

console.log("\nÉchappement et pliage");

verifie("les virgules et points-virgules sont échappés", () => {
  assert.strictEqual(api.echapper("Jeu libre, salle A; court 3"), "Jeu libre\\, salle A\\; court 3");
});

verifie("les retours à la ligne deviennent \\n", () => {
  assert.strictEqual(api.echapper("a\nb"), "a\\nb");
});

verifie("les lignes dépassant 75 octets sont pliées", () => {
  const pliee = api.plier("DESCRIPTION:" + "x".repeat(200));
  assert.ok(pliee.includes("\r\n "));
  for (const l of pliee.split("\r\n")) {
    assert.ok(Buffer.byteLength(l, "utf8") <= 75, "ligne trop longue : " + l.length);
  }
});

verifie("le pliage ne coupe pas un caractère accentué en deux", () => {
  const pliee = api.plier("SUMMARY:" + "é".repeat(80));
  assert.ok(!pliee.includes("�"), "caractère de remplacement détecté");
  assert.strictEqual(pliee.replace(/\r\n /g, "").length, "SUMMARY:".length + 80);
});

verifie("aucune ligne du fichier final ne dépasse 75 octets", () => {
  for (const l of lignes) {
    assert.ok(
      Buffer.byteLength(l, "utf8") <= 75,
      "ligne trop longue (" + Buffer.byteLength(l, "utf8") + ") : " + l
    );
  }
});

console.log("\nConstruction de l'URL");

verifie("l'URL cible bien l'action Mon planning", () => {
  const url = api.urlPlanning(12345, new Date("2026-08-31T12:00:00Z"), new Date("2026-10-12T12:00:00Z"));
  assert.ok(url.includes("ic_a=729090"));
  assert.ok(url.includes("adh_id=12345"));
  assert.ok(url.includes("ic_ajax=1"));
});

verifie("les bornes sont exprimées en heure de Paris", () => {
  const url = api.urlPlanning(1, new Date("2026-08-31T12:00:00Z"), new Date("2026-12-01T12:00:00Z"));
  const params = new URLSearchParams(url.split("?")[1]);
  assert.strictEqual(params.get("start"), "2026-08-31T00:00:00+02:00"); // CEST
  assert.strictEqual(params.get("end"), "2026-12-01T00:00:00+01:00"); // CET
});

console.log("\nRappels et nom de fichier");

verifie("aucun VALARM quand le rappel est désactivé", () => {
  assert.ok(!lignes.includes("BEGIN:VALARM"));
});

verifie("un VALARM par évènement quand un rappel est demandé", () => {
  const avecRappel = api.construireIcs(creneaux, { rappelMinutes: 60 }).ics.split("\r\n");
  assert.strictEqual(
    avecRappel.filter((l) => l === "BEGIN:VALARM").length,
    creneaux.length
  );
  assert.ok(avecRappel.includes("TRIGGER:-PT60M"));
});

verifie("le VALARM est bien à l'intérieur du VEVENT", () => {
  const avecRappel = api.construireIcs(creneaux, { rappelMinutes: 30 }).ics.split("\r\n");
  const debutAlarme = avecRappel.indexOf("BEGIN:VALARM");
  const finAlarme = avecRappel.indexOf("END:VALARM");
  const finEvenement = avecRappel.indexOf("END:VEVENT");
  assert.ok(debutAlarme > 0 && finAlarme > debutAlarme && finEvenement > finAlarme);
});

verifie("le nom de fichier est daté", () => {
  assert.strictEqual(
    api.nomFichier(new Date("2026-09-11T22:00:00Z")),
    "badasso-planning-2026-09-12.ics" // minuit passé à Paris
  );
});

console.log("\nCouleur des gymnases");

verifie("le hex du gymnase devient un nom CSS3", () => {
  // RFC 7986 : COLOR n'accepte pas d'hexadécimal, seulement un nom CSS3.
  assert.strictEqual(api.nomCouleurCss("#1a60d1"), "royalblue"); // Gymnase des Tilleuls
  assert.strictEqual(api.nomCouleurCss("#f0a032"), "goldenrod"); // Halle Nord
  assert.strictEqual(api.nomCouleurCss("#f46f4e"), "tomato"); // Gymnase du Parc
});

verifie("une couleur absente ou invalide ne produit rien", () => {
  assert.strictEqual(api.nomCouleurCss(null), null);
  assert.strictEqual(api.nomCouleurCss("bleu"), null);
  assert.strictEqual(api.nomCouleurCss("#abc"), null);
});

verifie("COLOR est émis pour les créneaux colorés", () => {
  const colores = api.construireIcs([
    { id: 1, start: "2026-09-14T12:00", end: "2026-09-14T13:30", name: "Jeu libre", loc_color: "#1a60d1" },
  ]).ics;
  assert.ok(colores.includes("COLOR:royalblue"));
});

verifie("COLOR est omis quand le créneau n'a pas de couleur", () => {
  const sansCouleur = api.construireIcs([
    { id: 2, start: "2026-09-14T12:00", end: "2026-09-14T13:30", name: "Jeu libre" },
  ]).ics;
  assert.ok(!sansCouleur.includes("COLOR:"));
});

console.log("\nCohérence du bundle console");

verifie("badasso-export.js est à jour vis-à-vis des sources", () => {
  const bundle = fs.readFileSync(path.join(__dirname, "..", "badasso-export.js"), "utf8");
  const core = fs.readFileSync(path.join(__dirname, "..", "extension", "core.js"), "utf8");
  const runner = fs.readFileSync(path.join(__dirname, "..", "console", "runner.js"), "utf8");
  assert.ok(bundle.includes(core.trim()), "core.js a changé : relance ./build.sh");
  assert.ok(bundle.includes(runner.trim()), "runner.js a changé : relance ./build.sh");
});

console.log("\n" + ok + " assertions passées" + (process.exitCode ? " (avec échecs)" : ""));

if (process.env.DUMP) {
  console.log("\n--- ICS ---\n" + ics);
}
