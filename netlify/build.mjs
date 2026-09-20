/*
 * Packt die Mini-Games für Netlify: nur die Dateien, die der Browser braucht.
 * ---------------------------------------------------------------------------
 * Die Site sind die Dateien im Wurzelverzeichnis – daneben liegen aber auch
 * die Werkzeuge (scripts/, node_modules/), die Doku und dieses Skript.
 * Veröffentlicht wird deshalb nicht das Wurzelverzeichnis, sondern dist/:
 * dieselben Dateien, nur ohne das, was niemand herunterladen soll.
 *
 * Gebaut wird dabei nichts – die Seiten sind schon fertig
 * (scripts/seiten-bauen.mjs). Geprüft wird trotzdem: Wer eine Seite von Hand
 * ändert und das Skript nicht laufen lässt, merkt es hier und nicht erst,
 * wenn ein Spiel offline weiss bleibt.
 *
 *   node netlify/build.mjs          (so steht es in netlify.toml)
 */
import { cpSync, mkdirSync, rmSync, readdirSync, existsSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { alleDateien } from "../scripts/seiten-bauen.mjs";
import { readFileSync } from "node:fs";

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ZIEL = path.join(WURZEL, "dist");

// Stimmen die erzeugten Dateien noch mit der Tabelle überein?
for (const [name, inhalt] of alleDateien()) {
  const da = path.join(WURZEL, name);
  if (!existsSync(da) || readFileSync(da, "utf8") !== inhalt) {
    throw new Error(`${name} weicht von scripts/seiten-bauen.mjs ab – "npm run bauen" fehlt.`);
  }
}

const ENDUNGEN = new Set([".html", ".js", ".css", ".webmanifest"]);
const ORDNER = ["icons"];
// Was nie mit soll, auch wenn es die Endung hätte. firestore.rules und die
// Firebase-Konfiguration gehören ins Repository und nach Firebase – nicht auf
// die Site, wo sie jeder herunterladen könnte.
const NIE = new Set([
  "netlify.toml", "package.json", "package-lock.json",
  "README.md", "FIREBASE.md",
  "firestore.rules", "firebase.json", ".firebaserc",
]);

rmSync(ZIEL, { recursive: true, force: true });
mkdirSync(ZIEL, { recursive: true });

let dateien = 0;
for (const name of readdirSync(WURZEL)) {
  const quelle = path.join(WURZEL, name);
  if (NIE.has(name) || name.startsWith(".")) continue;
  if (statSync(quelle).isFile() && ENDUNGEN.has(path.extname(name))) {
    cpSync(quelle, path.join(ZIEL, name));
    dateien += 1;
  }
}
for (const ordner of ORDNER) {
  const quelle = path.join(WURZEL, ordner);
  if (!existsSync(quelle)) throw new Error(`Der Ordner ${ordner}/ fehlt.`);
  cpSync(quelle, path.join(ZIEL, ordner), { recursive: true });
  dateien += readdirSync(quelle).length;
}

// Ohne diese ist es keine App.
for (const pflicht of ["index.html", "service-worker.js", "app.webmanifest", "styles.css", "mini-games.js", "cloud.js", "admin.html", "admin.js", "turmbau.html"]) {
  if (!existsSync(path.join(ZIEL, pflicht))) throw new Error(`${pflicht} fehlt in dist/ – die Site wäre kaputt.`);
}
// Und nichts, was nicht hingehört.
for (const verboten of ["node_modules", "scripts", "netlify", "package.json", "README.md", "firestore.rules", "firebase.json", ".firebaserc"]) {
  if (existsSync(path.join(ZIEL, verboten))) throw new Error(`${verboten} ist in dist/ gelandet – das gehört nicht auf die Site.`);
}

console.log(`dist/: ${dateien} Dateien – die Mini-Games, sonst nichts.`);
