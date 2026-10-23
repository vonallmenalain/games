/*
 * Tun die Firestore-Regeln, was sie sagen? Und die der Realtime Database?
 * ---------------------------------------------------------------------------
 * firestore.rules ist die einzige Schranke vor den Daten: Was hier durchgeht,
 * geht in der Datenbank durch. Und Regeln lügen leicht – ein rekursiver
 * Platzhalter, der auf ein Pfadstück mehr passt als gedacht, öffnet still,
 * was drei Zeilen darüber ausdrücklich zu ist.
 *
 * Deshalb wird nicht gelesen, sondern probiert. Der Firestore-Emulator lädt
 * die Regeln, und für jede Rolle wird versucht, was sie darf und was nicht:
 *
 *   Gast    lesen, sich eintragen, weitere Runden zählen, sich umbenennen –
 *           aber nichts kleinrechnen, nichts erfinden, nichts löschen. Im
 *           Turnier: einen Versuch beginnen, sein Ergebnis einmal eintragen,
 *           solange das Turnier läuft und Versuche übrig sind
 *   Admin   dasselbe, und als Einziger löschen und Turniere anlegen
 *
 * Der Emulator nimmt übrigens auch Regeln mit Syntaxfehlern an, ohne zu
 * klagen – er verweigert dann einfach alles. Das fängt dieser Test mit: Die
 * "darf"-Fälle schlagen fehl, und die Ursache steht in firestore-debug.log.
 *
 * Dasselbe für database.rules.json, die Regeln der Realtime Database (für den
 * Live-Modus): wer einen Multiplayer anlegen und steuern darf, und was Spieler
 * ohne Konto dort schreiben dürfen. Sie läuft in ihrem eigenen Emulator;
 * dessen Regeln lädt initializeTestEnvironment aus der Datei, wie die von
 * Firestore.
 *
 * Läuft ohne Netz und ohne Zugangsdaten. Braucht Java (für die Emulatoren) und
 * einmalig `npm install`. Startet die Emulatoren selbst und beendet sie.
 *
 *   npm run test:rules        oder        node scripts/test-rules.mjs
 */
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";

const HIER = path.dirname(fileURLToPath(import.meta.url));
const WURZEL = path.resolve(HIER, "..");
const PROJEKT = "demo-mini-games-rules";

// ---------------------------------------------------------------------------
// Aussen: den Emulator starten und sich selbst darin noch einmal aufrufen
// ---------------------------------------------------------------------------
if (!process.env.FIRESTORE_EMULATOR_HOST) {
  const java = spawnSync("java", ["-version"], { stdio: "ignore" });
  if (java.error || java.status !== 0) {
    console.error("Java fehlt – ohne Java starten die Emulatoren nicht.");
    console.error("Einmalig einrichten: https://adoptium.net (Temurin 17 oder neuer).");
    process.exit(2);
  }
  const firebase = path.join(WURZEL, "node_modules", ".bin", "firebase");
  if (!existsSync(firebase)) {
    console.error("firebase-tools fehlt – einmalig `npm install` im Wurzelverzeichnis.");
    process.exit(2);
  }
  const innen = `${JSON.stringify(process.execPath)} ${JSON.stringify(fileURLToPath(import.meta.url))}`;
  const lauf = spawnSync(firebase, ["emulators:exec", "--only", "firestore,database", "--project", PROJEKT, innen], {
    cwd: WURZEL,
    stdio: "inherit",
  });
  process.exit(lauf.status ?? 1);
}

// ---------------------------------------------------------------------------
// Innen: die Prüfungen
// ---------------------------------------------------------------------------
const { initializeTestEnvironment } = await import("@firebase/rules-unit-testing");
// Das SDK meldet jede Ablehnung als Fehler auf der Konsole. Hier ist jede
// Ablehnung Absicht – und das Rauschen verdeckte die Befunde.
try { (await import("firebase/firestore")).setLogLevel("silent"); } catch { /* dann eben laut */ }
try { (await import("firebase/app")).setLogLevel("silent"); } catch { /* dann eben laut */ }

if (!process.env.FIREBASE_DATABASE_EMULATOR_HOST) {
  console.error("Der Emulator der Realtime Database läuft nicht (FIREBASE_DATABASE_EMULATOR_HOST fehlt).");
  process.exit(2);
}
const rules = readFileSync(path.join(WURZEL, "firestore.rules"), "utf8");
const [host, port] = process.env.FIRESTORE_EMULATOR_HOST.split(":");
const [dbHost, dbPort] = process.env.FIREBASE_DATABASE_EMULATOR_HOST.split(":");
const env = await initializeTestEnvironment({
  projectId: PROJEKT,
  firestore: { rules, host, port: Number(port) },
  database: { rules: readFileSync(path.join(WURZEL, "database.rules.json"), "utf8"), host: dbHost, port: Number(dbPort) },
});

const befunde = [];
let geprueft = 0;

async function darf(was, tun) {
  geprueft += 1;
  try { await tun(); }
  catch (fehler) { befunde.push(`DARF NICHT, sollte aber: ${was}\n      ${kurz(fehler)}`); }
}
async function darfNicht(was, tun) {
  geprueft += 1;
  try { await tun(); befunde.push(`DARF, sollte aber nicht: ${was}`); }
  catch (fehler) {
    // Nur eine Ablehnung durch die Regeln zählt – ein Netzfehler oder ein
    // Tippfehler im Test wäre auch eine Ausnahme, aber kein Beweis.
    // Die Realtime Database sagt es beim Lesen in Worten: «Permission denied».
    if (!/PERMISSION_DENIED|permission-denied|permission denied|insufficient permissions/i.test(String(fehler))) {
      befunde.push(`Fehler statt Ablehnung: ${was}\n      ${kurz(fehler)}`);
    }
  }
}
const kurz = (f) => String((f && f.message) || f).split("\n")[0].slice(0, 160);

const ADMIN_MAIL = "alain.sc2@gmail.com";
const als = (uid, token) => env.authenticatedContext(uid, token).firestore();
const gast = () => env.unauthenticatedContext().firestore();
const admin = () => als("admin", { email: ADMIN_MAIL, email_verified: true });
const adminOhneVerifikation = () => als("admin2", { email: ADMIN_MAIL, email_verified: false });
// Irgendwer, der sich angemeldet hat. Eine Anmeldung allein macht niemanden
// zum Admin – sonst genügte ein Google-Konto, um die Liste leerzuräumen.
const fremder = () => als("fremd", { email: "fremd@example.com", email_verified: true });

const EINTRAG = "miniScores/towerStack_mini_abcdefghijkl";
const eintrag = (aenderung = {}) => ({
  game: "towerStack",
  spieler: "mini_abcdefghijkl",
  name: "Alain",
  punkte: 17,
  versuche: 1,
  erstesMs: 1,
  updatedAtMs: 1,
  ...aenderung,
});

// --- Anlegen ----------------------------------------------------------------
await darf("Gast liest die Bestenliste", () => gast().collection("miniScores").get());
await darfNicht("Gast legt einen Eintrag unter fremdem Dokumentnamen an", () => gast().doc("miniScores/towerStack_mini_xxxxxxxxxxxx").set(eintrag()));
await darfNicht("Gast legt einen Eintrag ohne Namen an", () => gast().doc(EINTRAG).set(eintrag({ name: "" })));
await darfNicht("Gast legt einen Eintrag mit endlos langem Namen an", () => gast().doc(EINTRAG).set(eintrag({ name: "X".repeat(25) })));
await darfNicht("Gast legt einen Eintrag mit erfundener Kennung an", () => gast().doc("miniScores/towerStack_wer-auch-immer").set(eintrag({ spieler: "wer-auch-immer" })));
await darfNicht("Gast legt einen Eintrag für ein erfundenes Spiel an", () => gast().doc("miniScores/schachweltmeister_mini_abcdefghijkl").set(eintrag({ game: "schachweltmeister" })));
// Entfernte Spiele nehmen nichts mehr an – was dort steht, bleibt lesbar, bis
// der Admin es wegräumt, aber es kommt nichts dazu.
for (const weg of ["missingItem", "goSignal", "shuntYard", "brakePoint", "trackRun"]) {
  await darfNicht(`Gast trägt sich ins entfernte Spiel ${weg} ein`, () => gast().doc(`miniScores/${weg}_mini_abcdefghijkl`).set(eintrag({ game: weg })));
}
await darfNicht("Gast legt einen Eintrag mit unmöglicher Punktzahl an", () => gast().doc(EINTRAG).set(eintrag({ punkte: 99999999 })));
await darfNicht("Gast legt einen Eintrag mit Kommazahl an", () => gast().doc(EINTRAG).set(eintrag({ punkte: 17.5 })));
await darfNicht("Gast schmuggelt ein eigenes Feld in den Eintrag", () => gast().doc(EINTRAG).set(eintrag({ admin: true })));
await darfNicht("Gast legt einen Eintrag mit zweitem Versuch an", () => gast().doc(EINTRAG).set(eintrag({ versuche: 2 })));
await darf("Gast trägt sich in die Bestenliste ein", () => gast().doc(EINTRAG).set(eintrag()));

// --- Weitere Runden ---------------------------------------------------------
await darf("Gast schreibt eine bessere Runde", () => gast().doc(EINTRAG).set({ name: "Alain", punkte: 42, versuche: 2, updatedAtMs: 2 }, { merge: true }));
await darf("Gast zählt eine schlechtere Runde mit", () => gast().doc(EINTRAG).set({ name: "Alain", punkte: 42, versuche: 3, updatedAtMs: 3 }, { merge: true }));
await darf("Gast ändert seinen Namen mit einer Runde", () => gast().doc(EINTRAG).set({ name: "Alain S.", punkte: 42, versuche: 4, updatedAtMs: 4 }, { merge: true }));
await darf("Gast ändert nur seinen Namen, ohne neue Runde", () => gast().doc(EINTRAG).set({ name: "Alain V.", updatedAtMs: 6 }, { merge: true }));
await darfNicht("Gast schmuggelt Punkte in eine Umbenennung", () => gast().doc(EINTRAG).set({ name: "Alain", punkte: 99, updatedAtMs: 7 }, { merge: true }));
await darfNicht("Gast schmuggelt einen Versuch aus einer Umbenennung heraus", () => gast().doc(EINTRAG).set({ name: "Alain", versuche: 3, updatedAtMs: 7 }, { merge: true }));
await darfNicht("Gast rechnet seine Punktzahl klein", () => gast().doc(EINTRAG).set({ name: "Alain", punkte: 3, versuche: 5, updatedAtMs: 5 }, { merge: true }));
await darfNicht("Gast lässt Versuche verschwinden", () => gast().doc(EINTRAG).set({ name: "Alain", punkte: 42, versuche: 1, updatedAtMs: 5 }, { merge: true }));
await darfNicht("Gast schreibt eine Runde ohne neuen Versuch", () => gast().doc(EINTRAG).set({ name: "Alain", punkte: 43, versuche: 4, updatedAtMs: 5 }, { merge: true }));
await darfNicht("Gast schiebt seinen Eintrag in ein anderes Spiel", () => gast().doc(EINTRAG).set({ game: "fishPond", name: "Alain", punkte: 42, versuche: 5, updatedAtMs: 5 }, { merge: true }));
await darfNicht("Gast übernimmt den Eintrag mit einer anderen Kennung", () => gast().doc(EINTRAG).set({ spieler: "mini_zzzzzzzzzzzz", name: "Alain", punkte: 42, versuche: 5, updatedAtMs: 5 }, { merge: true }));

// --- Aufräumen darf nur der Admin -------------------------------------------
// Dafür, und für nichts anderes, gibt es hier überhaupt eine Anmeldung.
await darfNicht("Gast löscht einen Eintrag", () => gast().doc(EINTRAG).delete());
await darfNicht("Ein angemeldeter Fremder löscht einen Eintrag", () => fremder().doc(EINTRAG).delete());
await darfNicht("Der Admin mit unbestätigter Adresse löscht einen Eintrag", () => adminOhneVerifikation().doc(EINTRAG).delete());
await darf("Admin liest die Bestenliste", () => admin().collection("miniScores").get());
await darf("Admin löscht einen Eintrag", () => admin().doc(EINTRAG).delete());

// --- Welche Spiele offen sind ------------------------------------------------
// Die Liste lesen darf jeder: Ohne sie wüsste die Startseite nicht, was sie
// zeigen soll. Setzen darf sie nur der Admin, und nur mit Spielen, die es gibt.
const LISTE = "config/miniGames";
const spieleListe = (aenderung = {}) => ({ spiele: ["towerStack", "fishPond"], updatedAtMs: 1, ...aenderung });

await darf("Gast liest die Liste der offenen Spiele", () => gast().doc(LISTE).get());
await darfNicht("Gast setzt die Liste", () => gast().doc(LISTE).set(spieleListe()));
await darfNicht("Ein angemeldeter Fremder setzt die Liste", () => fremder().doc(LISTE).set(spieleListe()));
await darfNicht("Der Admin mit unbestätigter Adresse setzt die Liste", () => adminOhneVerifikation().doc(LISTE).set(spieleListe()));
await darfNicht("Admin setzt ein erfundenes Spiel auf die Liste", () => admin().doc(LISTE).set(spieleListe({ spiele: ["schachweltmeister"] })));
await darfNicht("Admin schmuggelt ein Feld in die Liste", () => admin().doc(LISTE).set(spieleListe({ heimlich: true })));
await darfNicht("Admin setzt etwas, das keine Liste ist", () => admin().doc(LISTE).set(spieleListe({ spiele: "alle" })));
await darf("Admin setzt die Liste", () => admin().doc(LISTE).set(spieleListe()));
await darf("Admin macht die Liste leer", () => admin().doc(LISTE).set(spieleListe({ spiele: [] })));
await darfNicht("Gast legt eine zweite Konfiguration an", () => gast().doc("config/irgendwas").set({ a: 1 }));
await darfNicht("Admin legt eine zweite Konfiguration an", () => admin().doc("config/irgendwas").set({ a: 1 }));

// --- Die Geister -------------------------------------------------------------
// Eine Aufzeichnung eines Laufs, die neben dem nächsten noch einmal abgespielt
// wird. Dieselben Fragen wie bei der Bestenliste, dazu zwei eigene: Die
// Aufzeichnung darf nicht beliebig gross werden, und ein schwacher Lauf darf
// den guten nicht ersetzen.
const GEIST = "miniGeister/towerStack_mini_abcdefghijkl";
const geist = (aenderung = {}) => ({
  game: "towerStack",
  spieler: "mini_abcdefghijkl",
  name: "Alain",
  punkte: 500,
  level: "v1",
  bahn: "AAECAwQFBgc=",
  updatedAtMs: 1,
  ...aenderung,
});

await darf("Gast liest die Geister", () => gast().collection("miniGeister").get());
await darfNicht("Gast legt einen Geist unter fremdem Dokumentnamen an", () => gast().doc("miniGeister/towerStack_mini_xxxxxxxxxxxx").set(geist()));
await darfNicht("Gast legt einen Geist für ein erfundenes Spiel an", () => gast().doc("miniGeister/schachweltmeister_mini_abcdefghijkl").set(geist({ game: "schachweltmeister" })));
await darfNicht("Gast legt einen Geist mit erfundener Kennung an", () => gast().doc("miniGeister/towerStack_wer-auch-immer").set(geist({ spieler: "wer-auch-immer" })));
await darfNicht("Gast legt einen Geist ohne Aufzeichnung an", () => gast().doc(GEIST).set(geist({ bahn: "" })));
await darfNicht("Gast legt einen Geist mit endloser Aufzeichnung an", () => gast().doc(GEIST).set(geist({ bahn: "A".repeat(12001) })));
await darfNicht("Gast legt einen Geist ohne Level an", () => gast().doc(GEIST).set(geist({ level: "" })));
await darfNicht("Gast schmuggelt ein eigenes Feld in den Geist", () => gast().doc(GEIST).set(geist({ heimlich: true })));
await darfNicht("Gast legt einen Geist ohne Punkte an", () => { const g = geist(); delete g.punkte; return gast().doc(GEIST).set(g); });
await darf("Gast legt seinen Geist an", () => gast().doc(GEIST).set(geist()));
await darf("Gast ersetzt seinen Geist durch einen besseren Lauf", () => gast().doc(GEIST).set(geist({ punkte: 640, bahn: "CQoLDA0ODxA=", updatedAtMs: 2 })));
await darfNicht("Gast ersetzt seinen Geist durch einen schwächeren Lauf", () => gast().doc(GEIST).set(geist({ punkte: 100, updatedAtMs: 3 })));
await darfNicht("Gast schiebt seinen Geist in ein anderes Spiel", () => gast().doc(GEIST).set(geist({ game: "fishPond", punkte: 999, updatedAtMs: 4 })));
await darfNicht("Gast löscht einen Geist", () => gast().doc(GEIST).delete());
await darfNicht("Ein angemeldeter Fremder löscht einen Geist", () => fremder().doc(GEIST).delete());
await darf("Admin löscht einen Geist", () => admin().doc(GEIST).delete());

// --- Turniere ----------------------------------------------------------------
// Anlegen darf nur der Admin, und nur ein vollständiges Turnier. Lesen darf
// jeder, der den Namen kennt; auflisten nur die öffentlichen – ein Turnier
// "nur mit Link" darf in keiner Liste auftauchen.
const JETZT = Date.now();
const STUNDE = 60 * 60 * 1000;
const turnierDaten = (aenderung = {}) => ({
  name: "Herbstcup",
  beschreibung: "Wer gewinnt, wählt das Znacht.",
  spiele: ["towerStack", "fishPond"],
  startMs: JETZT - STUNDE,
  endeMs: JETZT + STUNDE,
  versuche: 2,
  zaehlt: "bester",
  wertung: "platz",
  aufgaben: "gleich",
  sichtbar: "alle",
  verdeckt: false,
  aktiv: true,
  erstelltMs: 1,
  updatedAtMs: 1,
  ...aenderung,
});
const OEFFENTLICH = "miniTurniere/herbstcup-k3m9x2p7";
const GEHEIM = "miniTurniere/geheim-q8w2e4r6";

await darfNicht("Gast legt ein Turnier an", () => gast().doc(OEFFENTLICH).set(turnierDaten()));
await darfNicht("Ein angemeldeter Fremder legt ein Turnier an", () => fremder().doc(OEFFENTLICH).set(turnierDaten()));
await darfNicht("Der Admin mit unbestätigter Adresse legt ein Turnier an", () => adminOhneVerifikation().doc(OEFFENTLICH).set(turnierDaten()));
await darfNicht("Admin legt ein Turnier mit erfundenem Spiel an", () => admin().doc(OEFFENTLICH).set(turnierDaten({ spiele: ["schachweltmeister"] })));
await darfNicht("Admin legt ein Turnier ohne Spiele an", () => admin().doc(OEFFENTLICH).set(turnierDaten({ spiele: [] })));
await darfNicht("Admin legt ein Turnier an, das endet, bevor es beginnt", () => admin().doc(OEFFENTLICH).set(turnierDaten({ endeMs: JETZT - 2 * STUNDE })));
await darfNicht("Admin legt ein Turnier ohne Namen an", () => admin().doc(OEFFENTLICH).set(turnierDaten({ name: "" })));
await darfNicht("Admin legt ein Turnier mit 101 Versuchen an", () => admin().doc(OEFFENTLICH).set(turnierDaten({ versuche: 101 })));
await darfNicht("Admin zählt unbegrenzt viele Versuche zusammen", () => admin().doc(OEFFENTLICH).set(turnierDaten({ zaehlt: "summe", versuche: 0 })));
await darfNicht("Admin erfindet eine Sichtbarkeit", () => admin().doc(OEFFENTLICH).set(turnierDaten({ sichtbar: "geheim" })));
await darfNicht("Admin erfindet eine Wertung", () => admin().doc(OEFFENTLICH).set(turnierDaten({ wertung: "gefuehl" })));
await darfNicht("Admin erfindet eine Art von Aufgaben", () => admin().doc(OEFFENTLICH).set(turnierDaten({ aufgaben: "wieLetzter" })));
await darfNicht("Admin schmuggelt ein Feld ins Turnier", () => admin().doc(OEFFENTLICH).set(turnierDaten({ preis: 100 })));
await darfNicht("Admin gibt dem Turnier einen Namen mit Leerzeichen", () => admin().doc("miniTurniere/Herbst Cup").set(turnierDaten()));
await darfNicht("Admin gibt dem Turnier einen zu kurzen Namen", () => admin().doc("miniTurniere/abc").set(turnierDaten()));
await darf("Admin legt ein öffentliches Turnier an", () => admin().doc(OEFFENTLICH).set(turnierDaten()));
await darf("Admin legt ein Turnier nur mit Link an, ohne Beschreibung", () => {
  const ohne = turnierDaten({ name: "Familienabend", sichtbar: "link" });
  delete ohne.beschreibung;
  return admin().doc(GEHEIM).set(ohne);
});
await darf("Admin ändert ein Turnier", () => admin().doc(OEFFENTLICH).set(turnierDaten({ endeMs: JETZT + 2 * STUNDE, updatedAtMs: 2 })));
await darf("Admin legt ein Turnier mit unbegrenzten Versuchen an", () => admin().doc("miniTurniere/offen-z7x5c3v1").set(turnierDaten({ versuche: 0, verdeckt: true })));
// "Nur wer nicht vorne liegt": eine dritte Art neben "unbegrenzt" und einer
// festen Zahl – also nur mit versuche 0, und nur als Ja oder Nein.
await darf("Admin legt ein Turnier an, in dem wartet, wer vorne liegt", () => admin().doc("miniTurniere/spitze-h4j6k8m2").set(turnierDaten({ versuche: 0, spitzeWartet: true })));
await darf("Admin schaltet das Warten an der Spitze ausdrücklich aus", () => admin().doc("miniTurniere/spitze-h4j6k8m2").set(turnierDaten({ versuche: 3, spitzeWartet: false })));
await darfNicht("Admin lässt die Spitze warten und gibt trotzdem eine feste Zahl von Versuchen", () => admin().doc("miniTurniere/spitze-h4j6k8m2").set(turnierDaten({ versuche: 3, spitzeWartet: true })));
await darfNicht("Admin schreibt das Warten an der Spitze als Text", () => admin().doc("miniTurniere/spitze-h4j6k8m2").set(turnierDaten({ versuche: 0, spitzeWartet: "ja" })));
await darfNicht("Admin lässt die Spitze warten und zählt alle Versuche zusammen", () => admin().doc("miniTurniere/spitze-h4j6k8m2").set(turnierDaten({ versuche: 0, spitzeWartet: true, zaehlt: "summe" })));
// Gleiches Level wie Platz 1: jeder Versuch derselbe Lauf (turnier.js).
await darf("Admin legt ein Turnier an, in dem alle das Level von Platz 1 spielen", () => admin().doc("miniTurniere/level-p3o5i7u9").set(turnierDaten({ aufgaben: "wieErster", versuche: 0, spitzeWartet: true })));
await darf("Admin würfelt die Aufgaben jedes Mal neu", () => admin().doc("miniTurniere/level-p3o5i7u9").set(turnierDaten({ aufgaben: "zufall" })));
// Ohne Gegner beim Spielen (geist.js): ein Ja oder Nein, sonst nichts.
await darf("Admin legt ein Turnier ohne Gegner beim Spielen an", () => admin().doc("miniTurniere/still-q2w4e6r8").set(turnierDaten({ ohneGeist: true })));
await darf("Admin schaltet die Gegner ausdrücklich ein", () => admin().doc("miniTurniere/still-q2w4e6r8").set(turnierDaten({ ohneGeist: false })));
await darfNicht("Admin schreibt «ohne Gegner» als Text", () => admin().doc("miniTurniere/still-q2w4e6r8").set(turnierDaten({ ohneGeist: "ja" })));
// Ohne Replays (der ▶ in den Listen): ebenso ein Ja oder Nein.
await darf("Admin legt ein Turnier ohne Replays an", () => admin().doc("miniTurniere/still-q2w4e6r8").set(turnierDaten({ ohneReplay: true })));
await darf("Admin lässt die Replays ausdrücklich zu", () => admin().doc("miniTurniere/still-q2w4e6r8").set(turnierDaten({ ohneReplay: false })));
await darfNicht("Admin schreibt «ohne Replays» als Text", () => admin().doc("miniTurniere/still-q2w4e6r8").set(turnierDaten({ ohneReplay: "ja" })));
await darfNicht("Gast ändert ein Turnier", () => gast().doc(OEFFENTLICH).set(turnierDaten({ versuche: 100 })));
// Nur live: ein Ja oder Nein. Dann gibt es keine Versuche dazwischen.
await darf("Admin legt ein Turnier an, das nur live gespielt wird", () => admin().doc("miniTurniere/livecup-r5t7z9u1").set(turnierDaten({ nurLive: true, versuche: 0 })));
await darfNicht("Admin schreibt «nur live» als Text", () => admin().doc("miniTurniere/livecup-r5t7z9u1").set(turnierDaten({ nurLive: "ja" })));
await darfNicht("Gast beginnt einen Versuch in einem Turnier, das nur live gespielt wird", () => gast().doc("miniTurniere/livecup-r5t7z9u1/eintraege/towerStack_mini_abcdefghijkl").set({
  game: "towerStack", spieler: "mini_abcdefghijkl", name: "Alain", punkte: 0, versuche: 1, offen: true, erstesMs: 1, updatedAtMs: 1,
}));

// Der Endstand eines Multiplayers im Turnier: lesen jeder, schreiben der Admin.
const LIVE_ERGEBNIS = "miniTurniere/livecup-r5t7z9u1/live/K7QM-1760368000000";
const liveErgebnis = (aenderung = {}) => ({
  name: "Familienabend",
  gewicht: 2,
  endstand: [{ spieler: "mini_abcdefghijkl", name: "Alain", punkte: 30, platz: 1 }, { spieler: "mini_mnopqrstuvwx", name: "Mia", punkte: 26, platz: 2 }],
  runden: 3,
  spiele: ["towerStack", "vineSwing"],
  erstelltMs: 1760368000000,
  updatedAtMs: 1,
  ...aenderung,
});
await darfNicht("Gast trägt einen Multiplayer ins Turnier ein", () => gast().doc(LIVE_ERGEBNIS).set(liveErgebnis()));
await darfNicht("Ein angemeldeter Fremder trägt einen Multiplayer ein", () => fremder().doc(LIVE_ERGEBNIS).set(liveErgebnis()));
await darfNicht("Admin trägt einen Multiplayer mit Gewicht 5 ein", () => admin().doc(LIVE_ERGEBNIS).set(liveErgebnis({ gewicht: 5 })));
await darfNicht("Admin trägt einen Multiplayer ohne Endstand ein", () => admin().doc(LIVE_ERGEBNIS).set(liveErgebnis({ endstand: "Alain" })));
await darfNicht("Admin trägt einen Multiplayer unter erfundenem Namen ein", () => admin().doc("miniTurniere/livecup-r5t7z9u1/live/familienabend").set(liveErgebnis()));
await darfNicht("Admin schmuggelt ein Feld in den Multiplayer", () => admin().doc(LIVE_ERGEBNIS).set(liveErgebnis({ preis: 100 })));
await darf("Admin trägt einen Multiplayer ins Turnier ein", () => admin().doc(LIVE_ERGEBNIS).set(liveErgebnis()));
await darf("Gast liest die Multiplayer eines Turniers", () => gast().collection("miniTurniere/livecup-r5t7z9u1/live").get());
await darfNicht("Gast löscht einen Multiplayer", () => gast().doc(LIVE_ERGEBNIS).delete());
await darf("Admin löscht einen Multiplayer", () => admin().doc(LIVE_ERGEBNIS).delete());

await darf("Gast öffnet ein öffentliches Turnier", () => gast().doc(OEFFENTLICH).get());
await darf("Gast öffnet ein Turnier über den Link", () => gast().doc(GEHEIM).get());
await darf("Gast listet die öffentlichen Turniere", () => gast().collection("miniTurniere").where("sichtbar", "==", "alle").get());
await darfNicht("Gast listet alle Turniere", () => gast().collection("miniTurniere").get());
await darfNicht("Gast listet die Turniere nur mit Link", () => gast().collection("miniTurniere").where("sichtbar", "==", "link").get());
await darf("Admin listet alle Turniere", () => admin().collection("miniTurniere").get());

// --- Versuche im Turnier ------------------------------------------------------
// Ein Versuch zählt ab seinem Beginn, und sein Ergebnis kommt genau einmal.
// Dazu, was die Uhr des Turniers sagt: vor dem Beginn nichts, nach dem Ende
// nur noch das Ergebnis eines Versuchs, der vorher begonnen hat.
await env.withSecurityRulesDisabled(async (kontext) => {
  const db = kontext.firestore();
  await db.doc("miniTurniere/bald-a1b2c3d4").set(turnierDaten({ startMs: JETZT + STUNDE, endeMs: JETZT + 2 * STUNDE }));
  await db.doc("miniTurniere/vorbei-a1b2c3d4").set(turnierDaten({ startMs: JETZT - 3 * STUNDE, endeMs: JETZT - 2 * STUNDE }));
  await db.doc("miniTurniere/pause-a1b2c3d4").set(turnierDaten({ aktiv: false }));
  // Eben zu Ende gegangen, und einer spielt noch: sein Versuch begann vor
  // dem Schluss.
  await db.doc("miniTurniere/eben-a1b2c3d4").set(turnierDaten({ startMs: JETZT - STUNDE, endeMs: JETZT - 60 * 1000 }));
  await db.doc("miniTurniere/eben-a1b2c3d4/eintraege/towerStack_mini_abcdefghijkl").set({
    game: "towerStack", spieler: "mini_abcdefghijkl", name: "Alain", punkte: 0, versuche: 1, offen: true, erstesMs: 1, updatedAtMs: 1,
  });
  // Längst vorbei, und einer hat damals gespielt: Sein Lauf kommt zu spät.
  await db.doc("miniTurniere/vorbei-a1b2c3d4/eintraege/towerStack_mini_abcdefghijkl").set({
    game: "towerStack", spieler: "mini_abcdefghijkl", name: "Alain", punkte: 12, versuche: 1, offen: false, erstesMs: 1, updatedAtMs: 1,
  });
  // Angehalten, während einer spielt: sein Versuch begann vorher.
  await db.doc("miniTurniere/pause-a1b2c3d4/eintraege/towerStack_mini_pausenspieler").set({
    game: "towerStack", spieler: "mini_pausenspieler", name: "Mia", punkte: 0, versuche: 1, offen: true, erstesMs: 1, updatedAtMs: 1,
  });
});

const VERSUCH = `${OEFFENTLICH}/eintraege/towerStack_mini_abcdefghijkl`;
const versuch = (aenderung = {}) => ({
  game: "towerStack",
  spieler: "mini_abcdefghijkl",
  name: "Alain",
  punkte: 0,
  versuche: 1,
  offen: true,
  erstesMs: 1,
  updatedAtMs: 1,
  ...aenderung,
});

await darf("Gast liest die Liste eines Turniers", () => gast().collection(`${OEFFENTLICH}/eintraege`).get());
await darfNicht("Gast beginnt mit Punkten, die er noch nicht gespielt hat", () => gast().doc(VERSUCH).set(versuch({ punkte: 42 })));
await darfNicht("Gast beginnt gleich mit dem zweiten Versuch", () => gast().doc(VERSUCH).set(versuch({ versuche: 2 })));
await darfNicht("Gast beginnt einen Versuch, der schon zu ist", () => gast().doc(VERSUCH).set(versuch({ offen: false })));
await darfNicht("Gast beginnt unter fremdem Dokumentnamen", () => gast().doc(`${OEFFENTLICH}/eintraege/towerStack_mini_xxxxxxxxxxxx`).set(versuch()));
await darfNicht("Gast spielt ein Spiel, das nicht zum Turnier gehört", () => gast().doc(`${OEFFENTLICH}/eintraege/leafFlow_mini_abcdefghijkl`).set(versuch({ game: "leafFlow" })));
await darfNicht("Gast beginnt vor dem Start des Turniers", () => gast().doc("miniTurniere/bald-a1b2c3d4/eintraege/towerStack_mini_abcdefghijkl").set(versuch()));
await darfNicht("Gast beginnt nach dem Ende des Turniers", () => gast().doc("miniTurniere/vorbei-a1b2c3d4/eintraege/towerStack_mini_abcdefghijkl").set(versuch()));
await darfNicht("Gast beginnt in einem angehaltenen Turnier", () => gast().doc("miniTurniere/pause-a1b2c3d4/eintraege/towerStack_mini_abcdefghijkl").set(versuch()));
await darfNicht("Gast spielt in einem Turnier, das es nicht gibt", () => gast().doc("miniTurniere/gibtsnicht-123456/eintraege/towerStack_mini_abcdefghijkl").set(versuch()));
await darfNicht("Gast schmuggelt ein Feld in den Versuch", () => gast().doc(VERSUCH).set(versuch({ admin: true })));
await darf("Gast beginnt seinen ersten Versuch", () => gast().doc(VERSUCH).set(versuch()));

await darf("Gast trägt das Ergebnis seines Versuchs ein", () => gast().doc(VERSUCH).set({ name: "Alain", punkte: 42, offen: false, updatedAtMs: 2 }, { merge: true }));
await darfNicht("Gast reicht ein zweites Ergebnis für denselben Versuch nach", () => gast().doc(VERSUCH).set({ name: "Alain", punkte: 50, offen: false, updatedAtMs: 3 }, { merge: true }));
await darfNicht("Gast beginnt einen Versuch und schreibt gleich Punkte dazu", () => gast().doc(VERSUCH).set({ name: "Alain", punkte: 60, versuche: 2, offen: true, updatedAtMs: 3 }, { merge: true }));
await darfNicht("Gast überspringt einen Versuch", () => gast().doc(VERSUCH).set({ name: "Alain", versuche: 3, offen: true, updatedAtMs: 3 }, { merge: true }));
await darf("Gast beginnt seinen zweiten Versuch", () => gast().doc(VERSUCH).set({ name: "Alain", versuche: 2, offen: true, updatedAtMs: 3 }, { merge: true }));
await darfNicht("Gast rechnet sein Turnierergebnis klein", () => gast().doc(VERSUCH).set({ name: "Alain", punkte: 10, offen: false, updatedAtMs: 4 }, { merge: true }));
await darfNicht("Gast lässt einen Versuch verschwinden", () => gast().doc(VERSUCH).set({ name: "Alain", punkte: 42, versuche: 1, offen: false, updatedAtMs: 4 }, { merge: true }));
await darf("Gast beendet einen schwächeren Versuch – die Bestzahl bleibt", () => gast().doc(VERSUCH).set({ name: "Alain", punkte: 42, offen: false, updatedAtMs: 4 }, { merge: true }));
await darfNicht("Gast beginnt einen dritten von zwei Versuchen", () => gast().doc(VERSUCH).set({ name: "Alain", versuche: 3, offen: true, updatedAtMs: 5 }, { merge: true }));
await darf("Gast ändert im Turnier nur seinen Namen", () => gast().doc(VERSUCH).set({ name: "Alain V.", updatedAtMs: 6 }, { merge: true }));
await darfNicht("Gast schmuggelt Punkte in eine Umbenennung", () => gast().doc(VERSUCH).set({ name: "Alain", punkte: 99, updatedAtMs: 7 }, { merge: true }));
await darfNicht("Gast schiebt seinen Turniereintrag in ein anderes Spiel", () => gast().doc(VERSUCH).set({ game: "fishPond", name: "Alain", versuche: 3, offen: true, updatedAtMs: 7 }, { merge: true }));

const OHNE_GRENZE = "miniTurniere/offen-z7x5c3v1/eintraege/fishPond_mini_abcdefghijkl";
await darf("Gast beginnt ohne Grenze einen ersten Versuch", () => gast().doc(OHNE_GRENZE).set(versuch({ game: "fishPond" })));
await darf("Gast beginnt ohne Grenze einen zweiten, ohne dass der erste ein Ergebnis hat", () => gast().doc(OHNE_GRENZE).set({ name: "Alain", versuche: 2, offen: true, updatedAtMs: 2 }, { merge: true }));
await darf("Gast beginnt ohne Grenze einen dritten Versuch", () => gast().doc(OHNE_GRENZE).set({ name: "Alain", versuche: 3, offen: true, updatedAtMs: 3 }, { merge: true }));

const ANGEHALTEN = "miniTurniere/pause-a1b2c3d4/eintraege/towerStack_mini_pausenspieler";
await darf("Gast beendet im angehaltenen Turnier den Versuch, der vorher begonnen hat", () => gast().doc(ANGEHALTEN).set({ name: "Mia", punkte: 12, offen: false, updatedAtMs: 2 }, { merge: true }));
await darfNicht("Gast beginnt im angehaltenen Turnier einen weiteren Versuch", () => gast().doc(ANGEHALTEN).set({ name: "Mia", versuche: 2, offen: true, updatedAtMs: 3 }, { merge: true }));

const EBEN = "miniTurniere/eben-a1b2c3d4/eintraege/towerStack_mini_abcdefghijkl";
await darf("Gast trägt nach dem Schluss das Ergebnis eines vorher begonnenen Versuchs ein", () => gast().doc(EBEN).set({ name: "Alain", punkte: 30, offen: false, updatedAtMs: 2 }, { merge: true }));
await darfNicht("Gast beginnt nach dem Schluss noch einen Versuch", () => gast().doc(EBEN).set({ name: "Alain", versuche: 2, offen: true, updatedAtMs: 3 }, { merge: true }));

// --- Läufe im Turnier (geist.js) ----------------------------------------------
// Der beste Lauf eines Spielers, für die, die im Turnier gegen ihn spielen.
// Wie miniGeister, dazu die Uhr des Turniers – und nur, wer dort wirklich
// einen Versuch begonnen hat.
const TGEIST = `${OEFFENTLICH}/geister/towerStack_mini_abcdefghijkl`;
await darf("Gast liest die Läufe eines Turniers", () => gast().collection(`${OEFFENTLICH}/geister`).get());
await darfNicht("Gast hinterlegt einen Lauf, ohne im Turnier gespielt zu haben",
  () => gast().doc(`${OEFFENTLICH}/geister/towerStack_mini_niegespielt1`).set(geist({ spieler: "mini_niegespielt1" })));
await darfNicht("Gast hinterlegt einen Lauf für ein Spiel, das nicht zum Turnier gehört",
  () => gast().doc(`${OEFFENTLICH}/geister/leafFlow_mini_abcdefghijkl`).set(geist({ game: "leafFlow" })));
await darfNicht("Gast hinterlegt einen Lauf in einem Turnier, das längst vorbei ist",
  () => gast().doc("miniTurniere/vorbei-a1b2c3d4/geister/towerStack_mini_abcdefghijkl").set(geist()));
await darfNicht("Gast schmuggelt ein Feld in seinen Lauf", () => gast().doc(TGEIST).set(geist({ heimlich: true })));
await darfNicht("Gast hinterlegt einen Lauf mit endloser Aufzeichnung", () => gast().doc(TGEIST).set(geist({ bahn: "A".repeat(12001) })));
await darf("Gast hinterlegt seinen Lauf im Turnier", () => gast().doc(TGEIST).set(geist()));
await darf("Gast ersetzt ihn durch einen besseren", () => gast().doc(TGEIST).set(geist({ punkte: 640, updatedAtMs: 2 })));
await darfNicht("Gast ersetzt ihn durch einen schwächeren", () => gast().doc(TGEIST).set(geist({ punkte: 100, updatedAtMs: 3 })));
await darfNicht("Gast schiebt seinen Lauf in ein anderes Spiel", () => gast().doc(TGEIST).set(geist({ game: "fishPond", punkte: 999, updatedAtMs: 4 })));
await darf("Gast hinterlegt kurz nach dem Schluss noch den Lauf seines letzten Versuchs",
  () => gast().doc("miniTurniere/eben-a1b2c3d4/geister/towerStack_mini_abcdefghijkl").set(geist()));
await darfNicht("Gast löscht einen Lauf im Turnier", () => gast().doc(TGEIST).delete());
await darfNicht("Ein angemeldeter Fremder löscht einen Lauf im Turnier", () => fremder().doc(TGEIST).delete());
await darf("Admin löscht einen Lauf im Turnier", () => admin().doc(TGEIST).delete());

await darfNicht("Gast löscht einen Turniereintrag", () => gast().doc(VERSUCH).delete());
await darfNicht("Ein angemeldeter Fremder löscht einen Turniereintrag", () => fremder().doc(VERSUCH).delete());
await darf("Admin löscht einen Turniereintrag", () => admin().doc(VERSUCH).delete());
await darfNicht("Gast löscht ein Turnier", () => gast().doc(GEHEIM).delete());
await darf("Admin löscht ein Turnier", () => admin().doc(GEHEIM).delete());

// --- cloud.js gegen die Regeln ------------------------------------------------
// Die Prüfung im Browser ersetzt cloud.js durch eine Attrappe – sie sieht also
// nie, ob das, was cloud.js wirklich schreibt, an diesen Regeln vorbeikommt.
// Das wird hier nachgeholt: cloud.js läuft so, wie es im Browser läuft, nur
// dass sein Firestore der des Emulators ist – einmal als Gast, einmal als
// Admin. Ein Feld, das cloud.js mitschickt und die Regeln nicht kennen, fiele
// hier auf und nicht erst beim ersten Turnier.
//
// Ausgeführt wird im selben Realm (new Function, kein vm): Firestore nimmt
// nur schlichte Objekte an, und ein Objekt aus einem fremden Realm ist für
// Firestore keines.
function cloudAls(firestore) {
  const fenster = {
    firebase: { apps: [{}], app: () => ({}), initializeApp: () => ({}), firestore: () => firestore },
  };
  new Function("window", readFileSync(path.join(WURZEL, "cloud.js"), "utf8"))(fenster);
  return fenster.MiniCloud;
}

async function wirft(was, code, tun) {
  geprueft += 1;
  try { await tun(); befunde.push(`Kein Fehler, sollte aber: ${was}`); }
  catch (fehler) {
    if (fehler?.code !== code) befunde.push(`Falscher Fehler: ${was}\n      ${fehler?.code || ""} ${kurz(fehler)}`);
  }
}

function erwarte(bedingung, text) {
  if (!bedingung) throw new Error(text);
}

const gastCloud = cloudAls(gast());
const adminCloud = cloudAls(admin());
const CT = "cloudjs-a1b2c3d4";
const ICH = { game: "towerStack", spieler: "mini_cloudjsspieler", name: "Cloud" };

await darf("cloud.js: Admin legt ein Turnier nur mit Link an", () => adminCloud.setzeTurnier(CT, {
  name: "Über cloud.js", beschreibung: "", spiele: ["towerStack", "towerStack", "fishPond"],
  startMs: JETZT - STUNDE, endeMs: JETZT + STUNDE, versuche: 2, zaehlt: "summe", wertung: "prozent",
  aufgaben: "gleich", sichtbar: "link", verdeckt: false, aktiv: true,
}));
await darf("cloud.js: Gast öffnet es über den Link", async () => {
  const t = await gastCloud.turnier(CT);
  erwarte(t?.name === "Über cloud.js" && t.zaehlt === "summe" && t.spiele.length === 2, JSON.stringify(t));
});
await darf("cloud.js: In der Liste der öffentlichen steht es nicht", async () => {
  const liste = await gastCloud.oeffentlicheTurniere();
  erwarte(liste.some((t) => t.name === "Herbstcup"), "das öffentliche Turnier fehlt");
  erwarte(!liste.some((t) => t.id === CT), "das Turnier nur mit Link steht in der Liste");
});
await darf("cloud.js: Gast beginnt einen Versuch", async () => {
  const stand = await gastCloud.turnierVersuch(CT, { ...ICH, grenze: 2 });
  erwarte(stand.versuche === 1, JSON.stringify(stand));
});
await darf("cloud.js: Gast trägt sein Ergebnis ein", async () => {
  const stand = await gastCloud.turnierErgebnis(CT, { ...ICH, punkte: 12, zaehlt: "summe" });
  erwarte(stand.punkte === 12 && stand.versuche === 1, JSON.stringify(stand));
});
await wirft("cloud.js: Ein zweites Ergebnis ohne neuen Versuch", "turnier/kein-versuch",
  () => gastCloud.turnierErgebnis(CT, { ...ICH, punkte: 99, zaehlt: "summe" }));
await darf("cloud.js: Gast beginnt den zweiten Versuch", async () => {
  const stand = await gastCloud.turnierVersuch(CT, { ...ICH, grenze: 2 });
  erwarte(stand.versuche === 2 && stand.punkte === 12, JSON.stringify(stand));
});
await darf("cloud.js: Beide Versuche werden zusammengezählt", async () => {
  const stand = await gastCloud.turnierErgebnis(CT, { ...ICH, punkte: 30, zaehlt: "summe" });
  erwarte(stand.punkte === 42, JSON.stringify(stand));
});
await wirft("cloud.js: Ein dritter von zwei Versuchen", "turnier/keine-versuche",
  () => gastCloud.turnierVersuch(CT, { ...ICH, grenze: 2 }));
await darf("cloud.js: Gast benennt sich im Turnier um", async () => {
  const stand = await gastCloud.turnierUmbenennen(CT, { spieler: ICH.spieler, name: "Cloud Zwei" });
  erwarte(stand?.geaendert === 1, JSON.stringify(stand));
});
await darf("cloud.js: Die Liste des Turniers stimmt", async () => {
  const liste = await gastCloud.turnierErgebnisse(CT);
  const e = liste[0];
  erwarte(liste.length === 1 && e.punkte === 42 && e.versuche === 2 && e.offen === false && e.name === "Cloud Zwei", JSON.stringify(liste));
  const mein = await gastCloud.meinTurnierEintrag(CT, ICH);
  erwarte(mein?.versuche === 2, JSON.stringify(mein));
});
await darf("cloud.js: Gast trägt sich in die ewige Liste ein", async () => {
  const stand = await gastCloud.speichere({ ...ICH, punkte: 5 });
  erwarte(stand.rekord === true, JSON.stringify(stand));
});
await darf("cloud.js: Admin sieht alle Turniere", async () => {
  const liste = await adminCloud.alleTurniere();
  erwarte(liste.some((t) => t.id === CT), "das Turnier nur mit Link fehlt beim Admin");
});
// Wer vorne liegt, wartet: cloud.js schreibt das Feld nur, wo es gilt –
// mit fester Zahl von Versuchen liesse es weg, statt abgewiesen zu werden.
const SPITZE = "spitze-cloudjs2345";
await darf("cloud.js: Admin legt ein Turnier an, in dem wartet, wer vorne liegt", async () => {
  await adminCloud.setzeTurnier(SPITZE, {
    name: "Königscup", spiele: ["towerStack"], startMs: JETZT - STUNDE, endeMs: JETZT + STUNDE,
    versuche: 0, zaehlt: "bester", wertung: "platz", aufgaben: "gleich", sichtbar: "link", verdeckt: false, aktiv: true, spitzeWartet: true,
  });
  const t = await gastCloud.turnier(SPITZE);
  erwarte(t?.spitzeWartet === true && t.versuche === 0, JSON.stringify(t));
});
await darf("cloud.js: Mit fester Zahl von Versuchen fällt das Warten an der Spitze weg", async () => {
  await adminCloud.setzeTurnier(SPITZE, {
    name: "Königscup", spiele: ["towerStack"], startMs: JETZT - STUNDE, endeMs: JETZT + STUNDE,
    versuche: 3, zaehlt: "bester", wertung: "platz", aufgaben: "gleich", sichtbar: "link", verdeckt: false, aktiv: true, spitzeWartet: true,
  });
  const t = await gastCloud.turnier(SPITZE);
  erwarte(t?.spitzeWartet === false && t.versuche === 3, JSON.stringify(t));
});
await darf("cloud.js: Ein Turnier von vorher kennt das Warten an der Spitze nicht", async () => {
  const t = await gastCloud.turnier("herbstcup-k3m9x2p7");
  erwarte(t?.spitzeWartet === false, JSON.stringify(t));
});
// Ohne Gegner beim Spielen: cloud.js schreibt das Feld nur, wenn es gilt.
await darf("cloud.js: Admin schaltet in einem Turnier die Gegner ab", async () => {
  await adminCloud.setzeTurnier(SPITZE, {
    name: "Königscup", spiele: ["towerStack"], startMs: JETZT - STUNDE, endeMs: JETZT + STUNDE,
    versuche: 3, zaehlt: "bester", wertung: "platz", aufgaben: "gleich", sichtbar: "link", verdeckt: false, aktiv: true, ohneGeist: true,
  });
  const t = await gastCloud.turnier(SPITZE);
  erwarte(t?.ohneGeist === true, JSON.stringify(t));
});
await darf("cloud.js: Ein Turnier von vorher zeigt die Gegner", async () => {
  const t = await gastCloud.turnier("herbstcup-k3m9x2p7");
  erwarte(t?.ohneGeist === false, JSON.stringify(t));
});
// Ohne Replays: dasselbe – das Feld steht nur da, wenn es gilt.
await darf("cloud.js: Admin schaltet in einem Turnier die Replays ab", async () => {
  await adminCloud.setzeTurnier(SPITZE, {
    name: "Königscup", spiele: ["towerStack"], startMs: JETZT - STUNDE, endeMs: JETZT + STUNDE,
    versuche: 3, zaehlt: "bester", wertung: "platz", aufgaben: "gleich", sichtbar: "link", verdeckt: false, aktiv: true, ohneReplay: true,
  });
  const t = await gastCloud.turnier(SPITZE);
  erwarte(t?.ohneReplay === true && t?.ohneGeist === false, JSON.stringify(t));
});
await darf("cloud.js: Ein Turnier von vorher lässt die Replays anschauen", async () => {
  const t = await gastCloud.turnier("herbstcup-k3m9x2p7");
  erwarte(t?.ohneReplay === false, JSON.stringify(t));
});
// Ohne Zeitlimite: ein Ende, das nie kommt (turnier.js, OHNE_ENDE). Die Regeln
// rechnen damit wie mit jedem anderen Ende – wenn es als ganze Zahl ankommt.
const DAUER = "dauer-cloudjs23456";
const OHNE_ENDE = Date.UTC(9999, 11, 31);
await darf("cloud.js: Admin legt ein Turnier ohne Zeitlimite an", async () => {
  await adminCloud.setzeTurnier(DAUER, {
    name: "Endloscup", spiele: ["towerStack"], startMs: JETZT - STUNDE, endeMs: OHNE_ENDE,
    versuche: 0, zaehlt: "bester", wertung: "platz", aufgaben: "gleich", sichtbar: "link", verdeckt: false, aktiv: true,
  });
  const t = await gastCloud.turnier(DAUER);
  erwarte(t?.endeMs === OHNE_ENDE, JSON.stringify(t));
});
await darf("cloud.js: Gast spielt im Turnier ohne Zeitlimite", async () => {
  await gastCloud.turnierVersuch(DAUER, { ...ICH, grenze: 0 });
  const stand = await gastCloud.turnierErgebnis(DAUER, { ...ICH, punkte: 7 });
  erwarte(stand.punkte === 7, JSON.stringify(stand));
});
await darf("cloud.js: Gast hinterlegt seinen Lauf, ein schwächerer ersetzt ihn nicht", async () => {
  const erster = await gastCloud.speichereTurnierGeist(DAUER, { ...ICH, punkte: 7, level: "t1", bahn: '{"v":1,"dt":250,"p":[0,7]}' });
  erwarte(erster?.punkte === 7, JSON.stringify(erster));
  const schwaecher = await gastCloud.speichereTurnierGeist(DAUER, { ...ICH, punkte: 3, level: "t1", bahn: '{"v":1,"dt":250,"p":[0,3]}' });
  erwarte(schwaecher === null, JSON.stringify(schwaecher));
  const gelesen = await gastCloud.turnierGeist(DAUER, ICH.game, ICH.spieler);
  erwarte(gelesen?.punkte === 7 && gelesen.level === "t1" && gelesen.name === ICH.name, JSON.stringify(gelesen));
});
// Einen Namen aus einem Turnier nehmen, ohne das Turnier zu löschen.
await darfNicht("cloud.js: Gast entfernt einen Eintrag aus einem Turnier",
  () => gastCloud.loescheTurnierEintraege(DAUER, [`towerStack_${ICH.spieler}`]));
await darf("cloud.js: Admin entfernt einen Spieler aus dem Turnier", async () => {
  const vorher = await adminCloud.turnierErgebnisse(DAUER);
  erwarte(vorher.length === 1, JSON.stringify(vorher));
  await adminCloud.loescheTurnierEintraege(DAUER, vorher.map((e) => e.id));
  erwarte((await gastCloud.turnierErgebnisse(DAUER)).length === 0, "der Eintrag ist noch da");
  erwarte(await gastCloud.turnierGeist(DAUER, ICH.game, ICH.spieler) === null, "sein Lauf ist noch da");
  erwarte((await gastCloud.turnier(DAUER))?.name === "Endloscup", "das Turnier ist mit verschwunden");
});
await darf("cloud.js: Admin löscht das Turnier samt Einträgen und Läufen", async () => {
  await gastCloud.speichereTurnierGeist(CT, { ...ICH, name: "Cloud Zwei", punkte: 30, level: "t1", bahn: '{"v":1,"dt":250,"p":[0,30]}' });
  erwarte((await gast().collection(`miniTurniere/${CT}/geister`).get()).size === 1, "der Lauf kam gar nicht erst an");
  await adminCloud.loescheTurnier(CT);
  erwarte(await gastCloud.turnier(CT) === null, "das Turnier ist noch da");
  erwarte((await gastCloud.turnierErgebnisse(CT)).length === 0, "Einträge sind liegen geblieben");
  erwarte((await gast().collection(`miniTurniere/${CT}/geister`).get()).size === 0, "Läufe sind liegen geblieben");
});

// Ein grosses Turnier: mehr Einträge, als auf eine Seite gehen – und mehr als
// die 3000, bei denen die Liste einmal stillschweigend aufhörte. Fehlte dort
// jemand, bekäme er in der Gesamtwertung für jedes Spiel den Platz hinter dem
// Letzten.
const GROSS = "gross-a1b2c3d4";
await env.withSecurityRulesDisabled(async (kontext) => {
  const db = kontext.firestore();
  await db.doc(`miniTurniere/${GROSS}`).set(turnierDaten({ name: "Grossturnier", sichtbar: "link" }));
  for (let stapel = 0; stapel < 7; stapel += 1) {
    const schreiben = db.batch();
    for (let i = 0; i < 450; i += 1) {
      const n = stapel * 450 + i;
      const spieler = `mini_gross${String(n).padStart(6, "0")}`;
      const game = n % 10 === 0 ? "fishPond" : "towerStack";
      schreiben.set(db.doc(`miniTurniere/${GROSS}/eintraege/${game}_${spieler}`), {
        game, spieler, name: `S${n}`, punkte: n, versuche: 1, offen: false, updatedAtMs: 1,
      });
    }
    await schreiben.commit();
  }
});
await darf("cloud.js: Ein grosses Turnier kommt vollständig, Seite für Seite", async () => {
  const alle = await gastCloud.turnierErgebnisse(GROSS);
  erwarte(alle.length === 3150, `${alle.length} statt 3150 Einträge`);
  erwarte(new Set(alle.map((e) => e.id)).size === alle.length, "Einträge kamen doppelt");
  const teich = await gastCloud.turnierErgebnisse(GROSS, { game: "fishPond" });
  erwarte(teich.length === 315 && teich.every((e) => e.game === "fishPond"), `${teich.length} statt 315 Einträge im Fischteich`);
});
await darf("cloud.js: Admin löscht auch ein grosses Turnier ganz", async () => {
  await adminCloud.loescheTurnier(GROSS);
  // Nachgesehen wird mit einem frischen Client – wie bei einem neuen Besuch
  // der Turnierseite. Der Gast von eben hält die 3150 Einträge noch in seiner
  // Abfrage; ihn dieselbe Frage noch einmal stellen zu lassen, prüfte den
  // Abgleich im Firestore-SDK (der gegen den Emulator nach so vielen
  // Löschungen minutenlang rechnet), nicht, was in der Datenbank steht.
  const frisch = cloudAls(gast());
  erwarte((await frisch.turnierErgebnisse(GROSS)).length === 0, "Einträge sind liegen geblieben");
  erwarte(await frisch.turnier(GROSS) === null, "das Turnier ist noch da");
});

// --- Sonst gibt es nichts ----------------------------------------------------
// Eine Sammlung, die jemand morgen anlegt, steht nicht offen da, weil niemand
// an eine Regel dafür gedacht hat.
await darfNicht("Gast liest eine erfundene Sammlung", () => gast().collection("was-auch-immer").get());
await darfNicht("Gast schreibt in eine erfundene Sammlung", () => gast().doc("was-auch-immer/x").set({ a: 1 }));
await darfNicht("Admin schreibt in eine erfundene Sammlung", () => admin().doc("was-auch-immer/x").set({ a: 1 }));
await darfNicht("Admin legt sich selbst eine Konto-Sammlung an", () => admin().doc("users/admin").set({ rolle: "admin" }));

// --- Die Realtime Database: der Live-Modus ------------------------------
// Ein Multiplayer liegt unter live/<code>. Lesen darf, wer den Code kennt;
// auflisten lässt sich nichts. Anlegen, steuern (zustand) und aufräumen darf
// nur der Admin. Spieler schreiben ohne Konto nur unter ihrer Kennung: dass
// sie da sind, ihre Punkte je Runde und wo ihre Figur gerade ist – in genau
// dieser Form. Wie bei der Bestenliste prüfen die Regeln, WAS geschrieben
// wird, nicht WER.
const live = {
  gast: () => env.unauthenticatedContext().database(),
  admin: () => env.authenticatedContext("admin", { email: ADMIN_MAIL, email_verified: true }).database(),
  adminOhneVerifikation: () => env.authenticatedContext("admin2", { email: ADMIN_MAIL, email_verified: false }).database(),
  fremder: () => env.authenticatedContext("fremd", { email: "fremd@example.com", email_verified: true }).database(),
};
const ABEND = "live/K7QM";
const LIVE_ICH = "mini_abcdefghijkl";
const abend = (aenderung = {}) => ({
  info: { name: "Familienabend", host: "admin", hostKennung: LIVE_ICH, erstellt: 1, programm: [{ spiel: "towerStack", runden: 2, uebung: 1 }], einstellungen: { zeitlimit: 120, wertung: "platz" }, ...aenderung },
  zustand: { phase: "lobby", nr: -1 },
});
// Gegenprobe: Der Emulator antwortet, und ohne Regeln ginge es. Sonst wäre
// jedes «darf nicht» unten auch ein Netzfehler, der zufällig gleich aussieht.
await darf("Ohne Regeln lässt sich die Realtime Database lesen und beschreiben", () =>
  env.withSecurityRulesDisabled(async (kontext) => {
    const ref = kontext.database().ref("probe");
    await ref.set({ ok: true });
    erwarte((await ref.get()).val()?.ok === true, "nichts zurückgelesen");
    await ref.remove();
  }));
await darfNicht("Gast liest die ganze Realtime Database", () => live.gast().ref("/").get());
await darfNicht("Gast listet alle Multiplayer auf", () => live.gast().ref("live").get());
await darfNicht("Gast legt einen Multiplayer an", () => live.gast().ref(ABEND).set(abend()));
await darfNicht("Fremder mit Konto legt einen Multiplayer an", () => live.fremder().ref(ABEND).set(abend({ host: "fremd" })));
await darfNicht("Admin ohne bestätigte Adresse legt einen Multiplayer an", () => live.adminOhneVerifikation().ref(ABEND).set(abend({ host: "admin2" })));
await darfNicht("Admin legt einen Multiplayer unter fremdem Namen an", () => live.admin().ref(ABEND).set(abend({ host: "jemand" })));
await darfNicht("Admin legt einen Multiplayer mit unmöglichem Code an", () => live.admin().ref("live/k7qm").set(abend()));
await darfNicht("Admin legt einen Multiplayer ohne Programm an", () => live.admin().ref(ABEND).set({ info: { name: "X", host: "admin", erstellt: 1, einstellungen: { a: 1 } }, zustand: { phase: "lobby" } }));
await darfNicht("Admin schmuggelt etwas in den Multiplayer", () => live.admin().ref(ABEND).set({ ...abend(), geheim: { a: 1 } }));
await darf("Admin legt einen Multiplayer an", () => live.admin().ref(ABEND).set(abend()));
await darf("Gast liest den Multiplayer, dessen Code er kennt", () => live.gast().ref(ABEND).get());
await darfNicht("Gast steuert den Multiplayer", () => live.gast().ref(`${ABEND}/zustand`).set({ phase: "runde", nr: 0 }));
await darfNicht("Gast benennt den Multiplayer um", () => live.gast().ref(`${ABEND}/info/name`).set("Meins"));
await darfNicht("Admin setzt eine erfundene Phase", () => live.admin().ref(`${ABEND}/zustand`).set({ phase: "chaos" }));
await darf("Admin startet eine Runde", () => live.admin().ref(`${ABEND}/zustand`).set({ phase: "runde", nr: 0, saat: 12345, startUm: 2, endeUm: 3, dabei: { [LIVE_ICH]: true } }));

const SPIELER = `${ABEND}/spieler/${LIVE_ICH}`;
await darf("Gast tritt bei", () => live.gast().ref(SPIELER).set({ name: "Alain", online: true, seit: 1 }));
await darf("Gast geht offline", () => live.gast().ref(`${SPIELER}/online`).set(false));
await darfNicht("Gast tritt ohne Namen bei", () => live.gast().ref(SPIELER).set({ name: "", online: true }));
await darfNicht("Gast tritt mit endlos langem Namen bei", () => live.gast().ref(SPIELER).set({ name: "X".repeat(25), online: true }));
await darfNicht("Gast tritt mit erfundener Kennung bei", () => live.gast().ref(`${ABEND}/spieler/wer-auch-immer`).set({ name: "A", online: true }));
await darfNicht("Gast schmuggelt ein Feld in seinen Eintrag", () => live.gast().ref(SPIELER).set({ name: "A", online: true, admin: true }));
await darfNicht("Gast tritt einem Multiplayer bei, den es nicht gibt", () => live.gast().ref(`live/ZZZZ/spieler/${LIVE_ICH}`).set({ name: "A", online: true }));

await darf("Gast meldet seine Punkte", () => live.gast().ref(`${ABEND}/punkte/0/${LIVE_ICH}`).set({ p: 42, fertig: false, t: 1500 }));
await darf("Gast meldet sein Ergebnis", () => live.gast().ref(`${ABEND}/punkte/0/${LIVE_ICH}`).set({ p: 57, fertig: true, t: 9000 }));
await darfNicht("Gast meldet negative Punkte", () => live.gast().ref(`${ABEND}/punkte/0/${LIVE_ICH}`).set({ p: -1, fertig: false }));
await darfNicht("Gast meldet unmögliche Punkte", () => live.gast().ref(`${ABEND}/punkte/0/${LIVE_ICH}`).set({ p: 99999999, fertig: true }));
await darfNicht("Gast meldet Punkte für eine erfundene Runde", () => live.gast().ref(`${ABEND}/punkte/abc/${LIVE_ICH}`).set({ p: 1, fertig: true }));
await darfNicht("Gast schmuggelt ein Feld in seine Punkte", () => live.gast().ref(`${ABEND}/punkte/0/${LIVE_ICH}`).set({ p: 1, fertig: true, bonus: 5 }));

await darf("Gast meldet, wo seine Figur ist", () => live.gast().ref(`${ABEND}/lage/${LIVE_ICH}`).set({ n: 0, t: 1250, a: 400, b: 120, c: 3, p: 12 }));
await darfNicht("Gast meldet eine Figur ohne Ort", () => live.gast().ref(`${ABEND}/lage/${LIVE_ICH}`).set({ n: 0, t: 1250 }));
await darfNicht("Gast meldet einen Ort als Text", () => live.gast().ref(`${ABEND}/lage/${LIVE_ICH}`).set({ n: 0, t: 1, a: "links", b: 2 }));
await darfNicht("Gast schreibt neben die Spieler", () => live.gast().ref(`${ABEND}/notizen/x`).set("hallo"));

await darfNicht("Gast räumt den Multiplayer weg", () => live.gast().ref(ABEND).remove());

// Der Hinweis auf der Turnierseite: welcher Multiplayer gerade zu einem
// Turnier gehört. Lesen darf jeder, schreiben nur der Admin.
const ZEIGER = "turnierLive/herbst-k3m9x2p7";
await darf("Gast liest, ob zu einem Turnier ein Multiplayer läuft", () => live.gast().ref(ZEIGER).get());
await darfNicht("Gast hängt einen Multiplayer an ein Turnier", () => live.gast().ref(ZEIGER).set({ code: "K7QM", name: "Finale" }));
await darfNicht("Admin hängt einen Multiplayer mit falschem Code an", () => live.admin().ref(ZEIGER).set({ code: "k7", name: "Finale" }));
await darf("Admin hängt einen Multiplayer an ein Turnier", () => live.admin().ref(ZEIGER).set({ code: "K7QM", name: "Finale", seit: 1 }));
await darfNicht("Gast listet alle Turnier-Hinweise auf", () => live.gast().ref("turnierLive").get());
await darf("Admin nimmt den Hinweis wieder weg", () => live.admin().ref(ZEIGER).remove());

// Ein Multiplayer mit langem Code (zehn Zeichen, nicht zu erraten) – und
// liveOffen: welche gerade für alle offen sind. Die Liste lesen darf jeder
// (die Startseite fragt ohne Anmeldung), schreiben nur der Admin, und nur für
// einen Multiplayer, den es gibt.
const LANG = "live/K7QMX2PA9Z";
await darfNicht("Admin legt einen Multiplayer mit zu langem Code an", () => live.admin().ref("live/K7QMX2PA9ZK7QM").set(abend()));
await darf("Admin legt einen Multiplayer mit langem Code an", () => live.admin().ref(LANG).set(abend({ einstellungen: { zeitlimit: 120, sichtbar: "alle" } })));
await darf("Gast liest den Multiplayer, dessen Link er hat", () => live.gast().ref(LANG).get());
await darf("Gast tritt dem Multiplayer mit langem Code bei", () => live.gast().ref(`${LANG}/spieler/${LIVE_ICH}`).set({ name: "Alain", online: true, seit: 1 }));
const OFFEN = "liveOffen/K7QMX2PA9Z";
await darf("Gast liest, welche Multiplayer für alle offen sind", () => live.gast().ref("liveOffen").get());
await darfNicht("Gast macht einen Multiplayer für alle sichtbar", () => live.gast().ref(OFFEN).set({ name: "Finale", seit: 1 }));
await darfNicht("Fremder mit Konto macht einen Multiplayer sichtbar", () => live.fremder().ref(OFFEN).set({ name: "Finale", seit: 1 }));
await darfNicht("Admin zeigt einen Multiplayer, den es nicht gibt", () => live.admin().ref("liveOffen/ZZZZZZZZZZ").set({ name: "Finale", seit: 1 }));
await darfNicht("Admin zeigt einen Multiplayer ohne Namen", () => live.admin().ref(OFFEN).set({ seit: 1 }));
await darfNicht("Admin schmuggelt ein Feld in die offene Liste", () => live.admin().ref(OFFEN).set({ name: "Finale", seit: 1, code: "K7QM" }));
await darf("Admin zeigt den Multiplayer allen", () => live.admin().ref(OFFEN).set({ name: "Finale", seit: 1 }));
await darf("Admin hängt einen Multiplayer mit langem Code an ein Turnier", () => live.admin().ref(ZEIGER).set({ code: "K7QMX2PA9Z", name: "Finale", seit: 1 }));
await darf("Admin stellt ihn auf «nur mit Link»", () => live.admin().ref(`${LANG}/info/einstellungen/sichtbar`).set("link"));
await darfNicht("Gast nimmt ihn aus der offenen Liste", () => live.gast().ref(OFFEN).remove());
await darf("Admin nimmt ihn aus der offenen Liste", () => live.admin().ref(OFFEN).remove());
await darf("Admin nimmt ihn vom Turnier", () => live.admin().ref(ZEIGER).remove());
await darf("Admin räumt den Multiplayer weg", () => live.admin().ref(LANG).remove());
await darf("Admin räumt den Multiplayer weg", () => live.admin().ref(ABEND).remove());

await env.cleanup();

console.log(`${geprueft} Zugriffe gegen die Regeln geprüft.`);
if (befunde.length) {
  console.error(`\n${befunde.length} Befund${befunde.length === 1 ? "" : "e"}:`);
  befunde.forEach((b) => console.error(`  - ${b}`));
  process.exit(1);
}
console.log("Die Regeln tun, was sie sagen.");
