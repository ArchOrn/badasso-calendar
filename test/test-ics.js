/*
 * Checks ICS generation against the real response of the "My planning"
 * endpoint (test/real-planning.json, reduced to the fields actually used).
 *
 *   node test/test-ics.js
 */
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const api = require("../extension/core.js");
const slots = JSON.parse(
  fs.readFileSync(path.join(__dirname, "real-planning.json"), "utf8")
);

let passed = 0;
function check(name, fn) {
  try {
    fn();
    console.log("  ok   " + name);
    passed++;
  } catch (err) {
    console.error("  FAIL " + name + "\n       " + err.message);
    process.exitCode = 1;
  }
}

const { ics, skipped } = api.buildIcs(slots, { generatedAt: new Date("2026-09-11T10:00:00Z") });
const lines = ics.split("\r\n");

console.log("ICS generation");

check("no slot is skipped", () => {
  assert.deepStrictEqual(skipped, []);
});

check("one VEVENT per slot", () => {
  assert.strictEqual(lines.filter((l) => l === "BEGIN:VEVENT").length, slots.length);
  assert.strictEqual(lines.filter((l) => l === "END:VEVENT").length, slots.length);
});

check("calendar is opened and closed", () => {
  assert.strictEqual(lines[0], "BEGIN:VCALENDAR");
  assert.strictEqual(ics.trimEnd().endsWith("END:VCALENDAR"), true);
});

check("VTIMEZONE Europe/Paris is present", () => {
  assert.ok(lines.includes("BEGIN:VTIMEZONE"));
  assert.ok(lines.includes("TZID:Europe/Paris"));
});

check("local time is preserved, with no stray shift", () => {
  // The 14/09 slot at 12:00 must stay 12:00, carried by TZID.
  assert.ok(lines.includes("DTSTART;TZID=Europe/Paris:20260914T120000"));
  assert.ok(lines.includes("DTEND;TZID=Europe/Paris:20260914T133000"));
});

check("evening slot near the daylight saving switch", () => {
  // 07/10: still CEST, the ICS must not convert the value.
  assert.ok(lines.includes("DTSTART;TZID=Europe/Paris:20261007T193000"));
});

check("UID is stable and unique per slot", () => {
  const uids = lines.filter((l) => l.startsWith("UID:"));
  assert.strictEqual(uids.length, slots.length);
  assert.strictEqual(new Set(uids).size, slots.length);
  assert.ok(uids.includes("UID:badasso-1001@bad-asso.fr"));
});

check("trainings are exported", () => {
  const count = lines.filter((l) => l.includes("Entraînement compétiteurs")).length;
  assert.ok(count >= 4, "expected at least 4 trainings, found " + count);
});

check("venue is filled in", () => {
  assert.ok(lines.some((l) => l.startsWith("LOCATION:Gymnase des Tilleuls")));
});

console.log("\nEscaping and folding");

check("commas and semicolons are escaped", () => {
  assert.strictEqual(api.escapeText("Jeu libre, salle A; court 3"), "Jeu libre\\, salle A\\; court 3");
});

check("newlines become \\n", () => {
  assert.strictEqual(api.escapeText("a\nb"), "a\\nb");
});

check("lines over 75 octets are folded", () => {
  const folded = api.foldLine("DESCRIPTION:" + "x".repeat(200));
  assert.ok(folded.includes("\r\n "));
  for (const line of folded.split("\r\n")) {
    assert.ok(Buffer.byteLength(line, "utf8") <= 75, "line too long: " + line.length);
  }
});

check("folding never cuts an accented character in half", () => {
  const folded = api.foldLine("SUMMARY:" + "é".repeat(80));
  assert.ok(!folded.includes("�"), "replacement character found");
  assert.strictEqual(folded.replace(/\r\n /g, "").length, "SUMMARY:".length + 80);
});

check("no line of the final file exceeds 75 octets", () => {
  for (const line of lines) {
    assert.ok(
      Buffer.byteLength(line, "utf8") <= 75,
      "line too long (" + Buffer.byteLength(line, "utf8") + "): " + line
    );
  }
});

console.log("\nURL building");

check("URL targets the My planning action", () => {
  const url = api.planningUrl(12345, new Date("2026-08-31T12:00:00Z"), new Date("2026-10-12T12:00:00Z"));
  assert.ok(url.includes("ic_a=729090"));
  assert.ok(url.includes("adh_id=12345"));
  assert.ok(url.includes("ic_ajax=1"));
});

check("bounds are expressed in Paris time", () => {
  const url = api.planningUrl(1, new Date("2026-08-31T12:00:00Z"), new Date("2026-12-01T12:00:00Z"));
  const params = new URLSearchParams(url.split("?")[1]);
  assert.strictEqual(params.get("start"), "2026-08-31T00:00:00+02:00"); // CEST
  assert.strictEqual(params.get("end"), "2026-12-01T00:00:00+01:00"); // CET
});

console.log("\nReminders and file name");

check("no VALARM when reminders are off", () => {
  assert.ok(!lines.includes("BEGIN:VALARM"));
});

check("one VALARM per event when a reminder is requested", () => {
  const withReminder = api.buildIcs(slots, { reminderMinutes: 60 }).ics.split("\r\n");
  assert.strictEqual(withReminder.filter((l) => l === "BEGIN:VALARM").length, slots.length);
  assert.ok(withReminder.includes("TRIGGER:-PT60M"));
});

check("VALARM sits inside the VEVENT", () => {
  const withReminder = api.buildIcs(slots, { reminderMinutes: 30 }).ics.split("\r\n");
  const alarmStart = withReminder.indexOf("BEGIN:VALARM");
  const alarmEnd = withReminder.indexOf("END:VALARM");
  const eventEnd = withReminder.indexOf("END:VEVENT");
  assert.ok(alarmStart > 0 && alarmEnd > alarmStart && eventEnd > alarmEnd);
});

check("file name carries the date", () => {
  assert.strictEqual(
    api.fileName(new Date("2026-09-11T22:00:00Z")),
    "badasso-planning-2026-09-12.ics" // past midnight in Paris
  );
});

console.log("\nVenue colors");

check("venue hex maps to a CSS3 name", () => {
  // RFC 7986: COLOR takes no hex value, only a CSS3 name.
  assert.strictEqual(api.nearestCssColorName("#1a60d1"), "royalblue"); // Gymnase des Tilleuls
  assert.strictEqual(api.nearestCssColorName("#f0a032"), "goldenrod"); // Halle Nord
  assert.strictEqual(api.nearestCssColorName("#f46f4e"), "tomato"); // Gymnase du Parc
});

check("a missing or invalid color yields nothing", () => {
  assert.strictEqual(api.nearestCssColorName(null), null);
  assert.strictEqual(api.nearestCssColorName("bleu"), null);
  assert.strictEqual(api.nearestCssColorName("#abc"), null);
});

check("COLOR is emitted for colored slots", () => {
  const colored = api.buildIcs([
    { id: 1, start: "2026-09-14T12:00", end: "2026-09-14T13:30", name: "Jeu libre", loc_color: "#1a60d1" },
  ]).ics;
  assert.ok(colored.includes("COLOR:royalblue"));
});

check("COLOR is omitted when the slot has no color", () => {
  const plain = api.buildIcs([
    { id: 2, start: "2026-09-14T12:00", end: "2026-09-14T13:30", name: "Jeu libre" },
  ]).ics;
  assert.ok(!plain.includes("COLOR:"));
});

console.log("\nConsole bundle consistency");

check("badasso-export.js is up to date with its sources", () => {
  const bundle = fs.readFileSync(path.join(__dirname, "..", "badasso-export.js"), "utf8");
  const core = fs.readFileSync(path.join(__dirname, "..", "extension", "core.js"), "utf8");
  const runner = fs.readFileSync(path.join(__dirname, "..", "console", "runner.js"), "utf8");
  assert.ok(bundle.includes(core.trim()), "core.js changed: re-run ./build.sh");
  assert.ok(bundle.includes(runner.trim()), "runner.js changed: re-run ./build.sh");
});

console.log("\n" + passed + " assertions passed" + (process.exitCode ? " (with failures)" : ""));

if (process.env.DUMP) {
  console.log("\n--- ICS ---\n" + ics);
}
