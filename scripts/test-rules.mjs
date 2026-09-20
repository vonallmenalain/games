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
 *           aber nichts kleinrechnen, nichts erfinden, nichts löschen
 *   Admin   dasselbe, und als Einziger löschen
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
