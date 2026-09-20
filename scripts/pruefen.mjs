#!/usr/bin/env node
/*
 * pruefen.mjs – Hält das Repository zusammen.
 * ---------------------------------------------------------------------------
 * Die Spiele stehen an drei Stellen: in der Tabelle, aus der die Seiten
 * entstehen (scripts/seiten-bauen.mjs), in der Liste, die der Browser zur
 * Laufzeit benutzt (mini-games.js), und als Dateien auf der Platte. Laufen die
 * auseinander, merkt das sonst erst jemand, dem eine weisse Seite entgegenkommt.
 *
 * Geprüft wird ohne Browser und ohne Netz – das gehört nach
 * scripts/check-spiele.mjs.
 *
 *   node scripts/pruefen.mjs
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { SPIELE, FASSUNG, alleDateien, seitenSkripte, hubSkripte } from "./seiten-bauen.mjs";

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const lies = (p) => readFileSync(path.join(WURZEL, p), "utf8");

let geprueft = 0;
const fehler = [];
function pruefe(was, bedingung) {
  geprueft += 1;
  if (!bedingung) fehler.push(was);
}

// --- 1. Die erzeugten Dateien sind die, die das Skript baut -----------------
for (const [name, inhalt] of alleDateien()) {
  pruefe(`${name} stimmt mit scripts/seiten-bauen.mjs überein ("npm run bauen")`,
    existsSync(path.join(WURZEL, name)) && lies(name) === inhalt);
}

// --- 2. Die Tabelle und die Liste zur Laufzeit sagen dasselbe ---------------
const miniJs = lies("mini-games.js");
const tabelle = miniJs.match(/const SPIELE = \[([\s\S]*?)\];/);
pruefe("mini-games.js hat eine Tabelle SPIELE", Boolean(tabelle));
if (tabelle) {
  const zeilen = [...tabelle[1].matchAll(/\{\s*id:\s*"([^"]+)",\s*seite:\s*"([^"]+)",\s*page:\s*"([^"]+)"\s*\}/g)]
    .map((m) => ({ spiel: m[1], seite: m[2], page: m[3] }));
  pruefe(`mini-games.js kennt ${SPIELE.length} Spiele (gefunden: ${zeilen.length})`, zeilen.length === SPIELE.length);
  SPIELE.forEach((s, i) => {
    const z = zeilen[i];
    pruefe(`mini-games.js, Platz ${i + 1}: ${s.spiel}/${s.seite}/${s.page}`,
      z && z.spiel === s.spiel && z.seite === s.seite && z.page === s.page);
  });
}

// --- 3. Jedes Spiel hat sein Skript, und das Skript kennt seine Seite -------
for (const s of SPIELE) {
  pruefe(`${s.js} liegt da`, existsSync(path.join(WURZEL, s.js)));
  if (!existsSync(path.join(WURZEL, s.js))) continue;
  const quelle = lies(s.js);
  pruefe(`${s.js} prüft dataset.page === "${s.page}"`,
    new RegExp(`dataset\\.page\\s*!==?\\s*"${s.page}"`).test(quelle));
}

// --- 4. Was eine Seite lädt, liegt auch da ----------------------------------
const alleSkripte = new Set(hubSkripte());
for (const s of SPIELE) for (const d of seitenSkripte(s)) alleSkripte.add(d);
for (const datei of alleSkripte) {
  if (datei.startsWith("http")) continue;
  pruefe(`${datei} liegt da`, existsSync(path.join(WURZEL, datei)));
}

// --- 5. Der Service Worker kennt jede Datei ---------------------------------
const sw = lies("service-worker.js");
pruefe(`service-worker.js trägt die Fassung ${FASSUNG}`, sw.includes(`const APP_VERSION = "${FASSUNG}"`));
for (const datei of alleSkripte) {
  if (datei.startsWith("http")) { pruefe(`SW kennt ${datei}`, sw.includes(datei)); continue; }
  pruefe(`SW kennt ${datei}`, sw.includes(`"./${datei}?v=${FASSUNG}"`));
}
for (const s of SPIELE) pruefe(`SW kennt ${s.seite}.html`, sw.includes(`"./${s.seite}.html"`));
pruefe("SW kennt die Startseite", sw.includes('"./"') && sw.includes('"./index.html"'));
pruefe("SW kennt styles.css", sw.includes(`"./styles.css?v=${FASSUNG}"`));

// --- 6. Manifest und Zeichen ------------------------------------------------
const manifest = JSON.parse(lies("app.webmanifest"));
pruefe("Das Manifest wohnt an der Wurzel (scope /)", manifest.scope === "/" && manifest.start_url === "/" && manifest.id === "/");
for (const icon of manifest.icons) {
  pruefe(`${icon.src} liegt da`, existsSync(path.join(WURZEL, icon.src.replace(/^\//, ""))));
}
pruefe("Es gibt ein maskierbares Zeichen", manifest.icons.some((i) => i.purpose === "maskable"));
for (const name of ["icon-32.png", "icon-180.png"]) {
  pruefe(`icons/${name} liegt da`, existsSync(path.join(WURZEL, "icons", name)));
}

// --- 7. Die Bühne jedes Spiels hat eine Regel im Stylesheet -----------------
const css = lies("styles.css");
for (const s of SPIELE) {
  const seite = lies(`${s.seite}.html`);
  pruefe(`${s.seite}.html hat die Bühne #${s.buehne.id}`, seite.includes(`id="${s.buehne.id}"`));
  for (const klasse of s.buehne.klasse.split(" ")) {
    pruefe(`styles.css kennt .${klasse}`, new RegExp(`\\.${klasse}(?![\\w-])`).test(css));
  }
}

// --- 8. Nichts mehr von der App, was es hier nicht gibt ---------------------
// Die Extraktion ist nur sauber, wenn niemand mehr nach etwas fragt, das
// hier nie antwortet: die Schranke, die Reise, der grosse Firebase-Client.
const VERBOTEN = [
  ["LernappEntitlement", "die Schranke – hier ist alles frei"],
  ["LernappReise", "die Reise – hier gibt es keine Karte"],
  ["LernappFirebase", "der Firebase-Client der App – hier ist es cloud.js"],
  ["LernappTrain\\b", "der Zug der App"],
  ["journey-plan", "die Reise"],
  ["entitlement\\.js", "die Schranke"],
];
for (const name of readdirSync(WURZEL).filter((n) => n.endsWith(".js"))) {
  const quelle = lies(name);
  for (const [muster, warum] of VERBOTEN) {
    pruefe(`${name} fragt nicht nach ${muster} (${warum})`, !new RegExp(muster).test(quelle));
  }
}

// --- 9. Jeder globale Name, den jemand benutzt, wird hier auch gesetzt ------
const dateien = readdirSync(WURZEL).filter((n) => n.endsWith(".js"));
const gesetzt = new Set();
for (const name of dateien) {
  for (const m of lies(name).matchAll(/window\.(\w+)\s*=/g)) gesetzt.add(m[1]);
}
const gebraucht = new Set();
for (const name of dateien) {
  for (const m of lies(name).matchAll(/window\.(Lernapp\w+|MiniCloud)\b/g)) gebraucht.add(m[1]);
}
for (const name of gebraucht) {
  pruefe(`window.${name} wird in diesem Repository gesetzt`, gesetzt.has(name));
}

// --- 10. Offline: die Adresse, die man weitergibt ---------------------------
// /turmbau ist die Adresse; im Zwischenspeicher liegt turmbau.html. Ohne die
// Umrechnung im Service Worker endet offline jeder Weg in ein Spiel auf der
// Startseite. scripts/check-spiele.mjs fährt das im Browser wirklich ab.
pruefe("Der Service Worker rechnet /turmbau auf turmbau.html um",
  /function mitEndung/.test(sw) && /ausDemSpeicher\(cache, event\.request\)/.test(sw));

// --- 11. Die Bestenliste ----------------------------------------------------
// Geschrieben wird nach miniScores im Firebase-Projekt der App. Welche Spiele
// dort erlaubt sind, steht in firestore.rules – im Repository der App. Ein
// neues Spiel hier braucht dort eine Zeile, sonst weist die Datenbank jeden
// Eintrag ab. Hier lässt sich das nicht prüfen; erinnert sei trotzdem daran.
pruefe("cloud.js schreibt nach miniScores", lies("cloud.js").includes('collection("miniScores")'));
pruefe("cloud.js meldet niemanden an", !/firebase\.auth\s*\(/.test(lies("cloud.js")));
// Eine Runde wird gelesen und geschrieben – das muss in einem Zug gehen.
// Sonst hielte sich, wenn zwei Tabs kurz nacheinander enden, die schlechtere
// Runde für einen Rekord, und die Regeln wiesen sie ab.
pruefe("cloud.js trägt eine Runde in einer Transaktion ein",
  /runTransaction/.test(lies("cloud.js")));
// Und der Name gehört dem Gerät, nicht einem Spiel: Bliebe er in einem Spiel
// alt, stünde derselbe Mensch zweimal in der Hall of Fame.
pruefe("cloud.js benennt alle Spiele dieses Geräts um",
  /where\("spieler", "==", spielerId\)/.test(lies("cloud.js")));
pruefe("mini-games.js benennt nicht für ein einzelnes Spiel um",
  /benenneUm\?\.\(\{ spieler: kennung\(\), name: wie \}\)/.test(miniJs));
for (const s of SPIELE) {
  const seite = lies(`${s.seite}.html`);
  pruefe(`${s.seite}.html lädt kein firebase-auth`, !seite.includes("firebase-auth"));
}

// ---------------------------------------------------------------------------
if (fehler.length) {
  console.error(`✗ ${fehler.length} von ${geprueft} Prüfungen fehlgeschlagen:\n`);
  for (const f of fehler) console.error(`   · ${f}`);
  console.error("\nErinnerung: Ein neues Spiel braucht auch eine Zeile in firestore.rules (miniSpiele) im Repository der App.");
  process.exit(1);
}
console.log(`✓ ${geprueft} Prüfungen – ${SPIELE.length} Spiele, Fassung ${FASSUNG}.`);
