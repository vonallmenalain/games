#!/usr/bin/env node
/*
 * seiten-bauen.mjs – Baut die Seiten, das Manifest und den Service Worker.
 * ---------------------------------------------------------------------------
 * Zwölf Spielseiten sehen einander bis auf vier Stellen gleich: der Name des
 * Spiels, die Bühne, das Skript, das sie füllt, und welches Spiel in der
 * Bestenliste gemeint ist. Von Hand gepflegt liefen sie auseinander – eine
 * Seite bekäme ein neues Skript, die andere nicht, und niemand merkte es, bis
 * ein Spiel weiss bliebe.
 *
 * Deshalb steht unten eine Tabelle und hier ein Skript. Ein neues Spiel heisst:
 *
 *   1. <spiel>.js aus der App herüberkopieren (und, falls es dazugehört,
 *      seinen Abschnitt aus styles.css).
 *   2. Eine Zeile in SPIELE hier, eine in mini-games.js.
 *   3. npm run bauen
 *
 * Der Service Worker entsteht aus denselben Daten: Was eine Seite lädt, steht
 * in seiner Liste – sonst fehlte offline genau das Spiel, das man spielen
 * wollte.
 *
 *   node scripts/seiten-bauen.mjs            schreibt die Dateien
 *   node scripts/seiten-bauen.mjs --pruefen  sagt nur, ob sie stimmen
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// Die Fassung steht in jeder Adresse (?v=) und im Namen des Zwischenspeichers.
// Ändert sie sich, holt der Browser alles neu – ohne sie bekäme jemand das
// neue Spiel mit dem alten Stylesheet.
export const FASSUNG = "2026-09-23-01";

// Der Himmel der Landschaft: die Farbe der Leiste des Browsers und des
// Startbilds der installierten App.
const HIMMEL = "#a8ddf0";
const SAND = "#fdf3e3";

/*
 * Die Spiele.
 *
 *   seite    Datei und Adresse: games.alae.app/turmbau
 *   spiel    der Name in der Bestenliste (miniScores.game), derselbe wie in
 *            der App – wer dort gespielt hat, steht hier in derselben Liste
 *   page     was am body steht; daran erkennt das Skript seine Seite
 *   js       das Skript des Spiels
 *   kunst    zusätzliche Zeichnungen, die es braucht
 *   buehne   id und Klassen des einen Elements, in das alles hineingebaut wird
 */
export const SPIELE = [
  {
    seite: "kacheln", spiel: "tileMemory", page: "tiles", js: "kacheln.js",
    titel: "Kacheln-Knobeln", buehne: { id: "kk-stage", klasse: "cm-stage kk-stage" },
    text: "Kacheln-Knobeln: Merk dir, welche Kacheln geleuchtet haben, und tippe sie nach.",
    baut: "das Raster",
  },
  {
    seite: "wasfehlt", spiel: "missingItem", page: "missing", js: "wasfehlt.js",
    kunst: ["strand-art.js"],
    titel: "Was fehlt?", buehne: { id: "wf-stage", klasse: "cm-stage wf-stage" },
    text: "Was fehlt? Merk dir die Fracht auf dem Wagen, und sag, welches Stück nach der Plane fehlt.",
    baut: "der Wagen mit der Fracht",
  },
  {
    seite: "fischteich", spiel: "fishPond", page: "pond", js: "fischteich.js",
    titel: "Fischteich", buehne: { id: "ft-stage", klasse: "cm-stage ft-stage" },
    text: "Fischteich: Tippe jeden Fisch genau einmal an und merk dir, welche du schon hattest.",
    baut: "der Teich mit den Fischen",
  },
  {
    seite: "signal", spiel: "goSignal", page: "signal", js: "signal.js",
    titel: "Halt am Signal", buehne: { id: "sg-stage", klasse: "cm-stage sg-stage" },
    text: "Halt am Signal: Bei Grün lässt du den Zug durch, bei Rot wartest du – tippe nur, wenn es grün ist.",
    baut: "das Gleis mit dem Signal",
  },
  {
    seite: "blaetter", spiel: "leafFlow", page: "leaves", js: "blaetter.js",
    titel: "Blätter im Strom", buehne: { id: "bs-stage", klasse: "cm-stage bs-stage" },
    text: "Blätter im Strom: 45 Sekunden lang wischen – orange Blätter wohin sie schwimmen, grüne wohin sie zeigen.",
    baut: "das Wasser mit den Blättern",
  },
  {
    seite: "turmbau", spiel: "towerStack", page: "tower", js: "turmbau.js",
    titel: "Turmbau", buehne: { id: "tb-stage", klasse: "cm-stage tb-stage" },
    text: "Turmbau: ein Block schwingt über dem Turm – tippe im richtigen Moment und stapel so hoch wie du kannst.",
    baut: "die Baustelle",
  },
  {
    seite: "zahlengleis", spiel: "numberLine", page: "numberline", js: "zahlengleis.js",
    titel: "Wo hält der Zug?", buehne: { id: "zg-stage", klasse: "cm-stage zg-stage" },
    text: "Wo hält der Zug? Schieb den Zug auf dem Gleis dorthin, wo die Zahl liegt.",
    baut: "das Gleis mit dem Zug",
  },
  {
    seite: "heizer", spiel: "boilerRoom", page: "boiler", js: "heizer.js",
    titel: "Der Heizer", buehne: { id: "hz-stage", klasse: "cm-stage hz-stage" },
    text: "Der Heizer: Jeder Kessel fällt – leg Kohle nach, aber nie im roten Feld.",
    baut: "die Reihe der Kessel",
  },
  {
    seite: "weichen", spiel: "shuntYard", page: "yard", js: "weichen.js",
    titel: "Weichenwärter", buehne: { id: "ww-stage", klasse: "cm-stage ww-stage" },
    text: "Weichenwärter: Schick jeden Wagen auf die Rampe, zu der seine Fracht gehört.",
    baut: "die Anlage mit den Rampen",
  },
  {
    seite: "bremsweg", spiel: "brakePoint", page: "brake", js: "bremsweg.js",
    titel: "Bremsweg", buehne: { id: "bw-stage", klasse: "cm-stage bw-stage" },
    text: "Bremsweg: Halte die Lok in acht Anläufen so genau wie möglich an der Haltetafel an.",
    baut: "die Strecke mit der Haltetafel",
  },
  {
    seite: "strecke", spiel: "trackRun", page: "track", js: "strecke.js",
    titel: "Streckenlauf", buehne: { id: "sl-stage", klasse: "cm-stage sl-stage" },
    text: "Streckenlauf: Spring über die Lücken durch ein festes Level – neben dir laufen die drei Besten.",
    baut: "die Strecke mit den Läufern",
  },
];

// Das Firebase-SDK. Kein firebase-auth auf den Spielseiten: Dort meldet sich
// niemand an, und ein SDK, das niemand braucht, lädt trotzdem jeder.
const SDK = [
  "https://www.gstatic.com/firebasejs/12.7.0/firebase-app-compat.js",
  "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore-compat.js",
];
// Nur der Adminbereich meldet jemanden an.
const SDK_AUTH = "https://www.gstatic.com/firebasejs/12.7.0/firebase-auth-compat.js";

// Was jede Seite lädt, in dieser Reihenfolge. train-art und strand-art holen
// sich ihre Werkzeuge beim Laden, nicht beim Aufruf – sie müssen vor dem
// stehen, was sie benutzt.
const GEMEINSAM = ["highscore.js", "cloud.js", "mini-games.js"];
const SPIELSEITE = ["zufall.js", "kids.js", "train-art.js", "train-scenes.js"];
const NACH_DER_KUNST = ["game-cloud.js", "game-shell.js"];

const v = (datei) => `${datei}?v=${FASSUNG}`;

function skripte(liste) {
  return liste.map((s) => (s.startsWith("http")
    ? `    <script defer src="${s}"></script>`
    : `    <script defer src="${v(s)}"></script>`)).join("\n");
}

export function seitenSkripte(spiel) {
  return [...SDK, ...GEMEINSAM, ...SPIELSEITE, ...(spiel.kunst || []),
    ...NACH_DER_KUNST, spiel.js, "pwa.js"];
}

export const hubSkripte = () => [...SDK, ...GEMEINSAM, "pwa.js"];
// Der Adminbereich: dasselbe Fundament, dazu die Anmeldung. Kein pwa.js – er
// gehört nicht in die installierte App, und ein Service Worker, der ihn
// zwischenspeichert, zeigte beim nächsten Mal alte Zahlen.
export const adminSkripte = () => [...SDK, SDK_AUTH, ...GEMEINSAM, "admin.js"];

const kopf = ({ titel, text, viewport, manifest = true }) => `    <meta charset="UTF-8" />
    <meta name="viewport" content="${viewport}" />
    <meta name="application-name" content="Mini-Games" />
    <meta name="description" content="${text}" />
    <meta name="mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
    <meta name="apple-mobile-web-app-title" content="Mini-Games" />
    <meta name="theme-color" content="${HIMMEL}" />
    <title>${titel}</title>
    <link rel="stylesheet" href="${v("styles.css")}" />
${manifest ? `    <link rel="manifest" href="${v("app.webmanifest")}" />\n` : ""}    <link rel="icon" type="image/png" sizes="32x32" href="icons/icon-32.png" />
    <link rel="apple-touch-icon" sizes="180x180" href="icons/icon-180.png" />`;

const SPIELVIEWPORT = "width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0, user-scalable=no, viewport-fit=cover";

export function spielSeite(spiel) {
  return `<!doctype html>
<!--
  Erzeugt von scripts/seiten-bauen.mjs – nicht von Hand ändern.
  Geändert wird die Tabelle dort, dann "npm run bauen".
-->
<html lang="de">
  <head>
${kopf({ titel: `${spiel.titel} · Mini-Games`, text: spiel.text, viewport: SPIELVIEWPORT })}
  </head>
  <body data-page="${spiel.page}" data-spiel="${spiel.spiel}">
    <!-- Die Bühne baut ${spiel.js}: die Landschaft, darauf ${spiel.baut}.
         Bewusst leer im HTML – hier steht kein Wort ausser dem Namen des
         Spiels, und den setzt die Bühne. -->
    <div id="${spiel.buehne.id}" class="${spiel.buehne.klasse}" aria-label="${spiel.titel}"></div>

${skripte(seitenSkripte(spiel))}
  </body>
</html>
`;
}

export function hubSeite() {
  return `<!doctype html>
<!--
  Erzeugt von scripts/seiten-bauen.mjs – nicht von Hand ändern.

  Die Startseite und zugleich der Startpunkt der installierten App: Wer die
  Mini-Games auf den Startbildschirm legt, landet hier. Was darauf steht, baut
  mini-games.js – die Spiele als Karten, die Bestenlisten und die Tabelle
  aller Namen.
-->
<html lang="de">
  <head>
${kopf({
    titel: "Mini-Games",
    text: "Mini-Games: eine Runde spielen, Namen eintragen, oben stehen. Ohne Konto, ohne Anmeldung – die Bestenliste sehen alle.",
    viewport: "width=device-width, initial-scale=1.0, viewport-fit=cover",
  })}
  </head>
  <body data-page="hub">
    <main class="mini-seite" data-uebersicht>
      <p class="mini-hinweis">Die Mini-Games werden geladen...</p>
    </main>

${skripte(hubSkripte())}
  </body>
</html>
`;
}

export function adminSeite() {
  return `<!doctype html>
<!--
  Erzeugt von scripts/seiten-bauen.mjs – nicht von Hand ändern.

  Der Adminbereich. Er steht bewusst neben der App und nicht in ihr: kein
  pwa.js, nicht im Zwischenspeicher des Service Workers, nicht im Manifest.
  Wer hierherkommt, will die aktuellen Zahlen sehen, nicht die von gestern.
-->
<html lang="de">
  <head>
${kopf({
    titel: "Adminbereich · Mini-Games",
    text: "Die Bestenliste der Mini-Games ansehen und aufräumen.",
    viewport: "width=device-width, initial-scale=1.0, viewport-fit=cover",
    manifest: false,
  })}
    <meta name="robots" content="noindex, nofollow" />
  </head>
  <body data-page="admin">
    <main class="adm-seite" data-admin>
      <p class="adm-hinweis">Wird geladen...</p>
    </main>

${skripte(adminSkripte())}
  </body>
</html>
`;
}

export function manifest() {
  return JSON.stringify({
    id: "/",
    name: "Mini-Games",
    short_name: "Mini-Games",
    description: "Eine Runde spielen, Namen eintragen, oben stehen. Ohne Konto, ohne Anmeldung – die Bestenliste sehen alle.",
    lang: "de",
    dir: "ltr",
    start_url: "/",
    scope: "/",
    display: "fullscreen",
    display_override: ["fullscreen", "standalone", "minimal-ui"],
    orientation: "any",
    background_color: SAND,
    theme_color: HIMMEL,
    categories: ["games"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  }, null, 2) + "\n";
}

// Alles, was eine Seite lädt – jede Datei einmal, in der Reihenfolge, in der
// sie zum ersten Mal vorkommt.
export function dateien() {
  const alle = ["./", "./index.html", ...SPIELE.map((s) => `./${s.seite}.html`)];
  const skripteAlle = [...hubSkripte()];
  for (const s of SPIELE) for (const datei of seitenSkripte(s)) skripteAlle.push(datei);
  for (const datei of skripteAlle) {
    if (datei.startsWith("http")) continue;
    const mit = `./${v(datei)}`;
    if (!alle.includes(mit)) alle.push(mit);
  }
  alle.push(`./${v("styles.css")}`, `./${v("app.webmanifest")}`);
  for (const name of ["icon-32", "icon-180", "icon-192", "icon-512", "icon-maskable-192", "icon-maskable-512"]) {
    alle.push(`./icons/${name}.png`);
  }
  return alle;
}

export function serviceWorker() {
  const vorlage = readFileSync(path.join(WURZEL, "scripts", "service-worker-vorlage.js"), "utf8");
  return vorlage
    .replace("__FASSUNG__", FASSUNG)
    .replace("__SDK__", JSON.stringify(SDK, null, 2))
    .replace("__DATEIEN__", JSON.stringify(dateien(), null, 2));
}

// ---------------------------------------------------------------------------

export function alleDateien() {
  const raus = new Map();
  raus.set("index.html", hubSeite());
  for (const spiel of SPIELE) raus.set(`${spiel.seite}.html`, spielSeite(spiel));
  raus.set("admin.html", adminSeite());
  raus.set("app.webmanifest", manifest());
  raus.set("service-worker.js", serviceWorker());
  return raus;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const nurPruefen = process.argv.includes("--pruefen");
  const raus = alleDateien();
  let anders = 0;
  for (const [name, inhalt] of raus) {
    const ziel = path.join(WURZEL, name);
    let alt = null;
    try { alt = readFileSync(ziel, "utf8"); } catch { /* gibt es noch nicht */ }
    if (alt === inhalt) continue;
    anders += 1;
    if (nurPruefen) console.error(`✗ ${name} ist nicht das, was das Skript baut.`);
    else { writeFileSync(ziel, inhalt); console.log(`· ${name}`); }
  }
  if (nurPruefen) {
    if (anders) {
      console.error(`\n${anders} Datei(en) weichen ab. "npm run bauen" bringt sie in Ordnung.`);
      process.exit(1);
    }
    console.log(`Alle ${raus.size} erzeugten Dateien stimmen (Fassung ${FASSUNG}).`);
  } else {
    console.log(anders ? `\n${anders} von ${raus.size} Dateien neu geschrieben.` : "Nichts zu tun – alles war schon aktuell.");
  }
}
