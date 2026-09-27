/*
 * Tun die Firestore-Regeln, was sie sagen?
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
 * Läuft ohne Netz und ohne Zugangsdaten. Braucht Java (für den Emulator) und
 * einmalig `npm install`. Startet den Emulator selbst und beendet ihn.
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
    console.error("Java fehlt – ohne Java startet der Firestore-Emulator nicht.");
    console.error("Einmalig einrichten: https://adoptium.net (Temurin 17 oder neuer).");
    process.exit(2);
  }
  const firebase = path.join(WURZEL, "node_modules", ".bin", "firebase");
  if (!existsSync(firebase)) {
    console.error("firebase-tools fehlt – einmalig `npm install` im Wurzelverzeichnis.");
    process.exit(2);
  }
  const innen = `${JSON.stringify(process.execPath)} ${JSON.stringify(fileURLToPath(import.meta.url))}`;
  const lauf = spawnSync(firebase, ["emulators:exec", "--only", "firestore", "--project", PROJEKT, innen], {
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

const rules = readFileSync(path.join(WURZEL, "firestore.rules"), "utf8");
const [host, port] = process.env.FIRESTORE_EMULATOR_HOST.split(":");
const env = await initializeTestEnvironment({
  projectId: PROJEKT,
  firestore: { rules, host, port: Number(port) },
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
    if (!/PERMISSION_DENIED|permission-denied|insufficient permissions/i.test(String(fehler))) {
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
const GEIST = "miniGeister/trackRun_mini_abcdefghijkl";
const geist = (aenderung = {}) => ({
  game: "trackRun",
  spieler: "mini_abcdefghijkl",
  name: "Alain",
  punkte: 500,
  level: "v1",
  bahn: "AAECAwQFBgc=",
  updatedAtMs: 1,
  ...aenderung,
});

await darf("Gast liest die Geister", () => gast().collection("miniGeister").get());
await darfNicht("Gast legt einen Geist unter fremdem Dokumentnamen an", () => gast().doc("miniGeister/trackRun_mini_xxxxxxxxxxxx").set(geist()));
await darfNicht("Gast legt einen Geist für ein erfundenes Spiel an", () => gast().doc("miniGeister/schachweltmeister_mini_abcdefghijkl").set(geist({ game: "schachweltmeister" })));
await darfNicht("Gast legt einen Geist mit erfundener Kennung an", () => gast().doc("miniGeister/trackRun_wer-auch-immer").set(geist({ spieler: "wer-auch-immer" })));
await darfNicht("Gast legt einen Geist ohne Aufzeichnung an", () => gast().doc(GEIST).set(geist({ bahn: "" })));
await darfNicht("Gast legt einen Geist mit endloser Aufzeichnung an", () => gast().doc(GEIST).set(geist({ bahn: "A".repeat(12001) })));
await darfNicht("Gast legt einen Geist ohne Level an", () => gast().doc(GEIST).set(geist({ level: "" })));
await darfNicht("Gast schmuggelt ein eigenes Feld in den Geist", () => gast().doc(GEIST).set(geist({ heimlich: true })));
await darfNicht("Gast legt einen Geist ohne Punkte an", () => { const g = geist(); delete g.punkte; return gast().doc(GEIST).set(g); });
await darf("Gast legt seinen Geist an", () => gast().doc(GEIST).set(geist()));
await darf("Gast ersetzt seinen Geist durch einen besseren Lauf", () => gast().doc(GEIST).set(geist({ punkte: 640, bahn: "CQoLDA0ODxA=", updatedAtMs: 2 })));
await darfNicht("Gast ersetzt seinen Geist durch einen schwächeren Lauf", () => gast().doc(GEIST).set(geist({ punkte: 100, updatedAtMs: 3 })));
await darfNicht("Gast schiebt seinen Geist in ein anderes Spiel", () => gast().doc(GEIST).set(geist({ game: "towerStack", punkte: 999, updatedAtMs: 4 })));
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
await darfNicht("Gast ändert ein Turnier", () => gast().doc(OEFFENTLICH).set(turnierDaten({ versuche: 100 })));

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
await darfNicht("Gast spielt ein Spiel, das nicht zum Turnier gehört", () => gast().doc(`${OEFFENTLICH}/eintraege/goSignal_mini_abcdefghijkl`).set(versuch({ game: "goSignal" })));
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

const EBEN = "miniTurniere/eben-a1b2c3d4/eintraege/towerStack_mini_abcdefghijkl";
await darf("Gast trägt nach dem Schluss das Ergebnis eines vorher begonnenen Versuchs ein", () => gast().doc(EBEN).set({ name: "Alain", punkte: 30, offen: false, updatedAtMs: 2 }, { merge: true }));
await darfNicht("Gast beginnt nach dem Schluss noch einen Versuch", () => gast().doc(EBEN).set({ name: "Alain", versuche: 2, offen: true, updatedAtMs: 3 }, { merge: true }));

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
await darf("cloud.js: Admin löscht das Turnier samt Einträgen", async () => {
  await adminCloud.loescheTurnier(CT);
  erwarte(await gastCloud.turnier(CT) === null, "das Turnier ist noch da");
  erwarte((await gastCloud.turnierErgebnisse(CT)).length === 0, "Einträge sind liegen geblieben");
});

// --- Sonst gibt es nichts ----------------------------------------------------
// Eine Sammlung, die jemand morgen anlegt, steht nicht offen da, weil niemand
// an eine Regel dafür gedacht hat.
await darfNicht("Gast liest eine erfundene Sammlung", () => gast().collection("was-auch-immer").get());
await darfNicht("Gast schreibt in eine erfundene Sammlung", () => gast().doc("was-auch-immer/x").set({ a: 1 }));
await darfNicht("Admin schreibt in eine erfundene Sammlung", () => admin().doc("was-auch-immer/x").set({ a: 1 }));
await darfNicht("Admin legt sich selbst eine Konto-Sammlung an", () => admin().doc("users/admin").set({ rolle: "admin" }));

await env.cleanup();

console.log(`${geprueft} Zugriffe gegen die Regeln geprüft.`);
if (befunde.length) {
  console.error(`\n${befunde.length} Befund${befunde.length === 1 ? "" : "e"}:`);
  befunde.forEach((b) => console.error(`  - ${b}`));
  process.exit(1);
}
console.log("Die Regeln tun, was sie sagen.");
