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
import { SPIELE, FASSUNG, alleDateien, seitenSkripte, hubSkripte, turnierSkripte, adminSkripte } from "./seiten-bauen.mjs";

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
const alleSkripte = new Set([...hubSkripte(), ...adminSkripte()]);
for (const s of SPIELE) for (const d of seitenSkripte(s)) alleSkripte.add(d);
for (const datei of alleSkripte) {
  if (datei.startsWith("http")) continue;
  pruefe(`${datei} liegt da`, existsSync(path.join(WURZEL, datei)));
}

// Die Turnierseite ist die Startseite mit anderem Kopf: Sie baut dieselbe
// Bühne (mini-games.js, arcadeBuehne) und lädt dieselben Skripte.
pruefe("mini-games.js baut die Bühne der arcade (arcadeBuehne), turnier.js stellt sie hin",
  /function arcadeBuehne\(/.test(miniJs) && lies("turnier.js").includes("m.arcadeBuehne("));
pruefe("Die Turnierseite lädt dieselben Skripte wie die Startseite",
  JSON.stringify(turnierSkripte()) === JSON.stringify(hubSkripte()));

// --- arcade: die Startseite und ihre Bilder ------------------------------------
// Jedes Spiel hat drei aufgenommene Bilder – quer, hoch und klein für die Zeile
// (scripts/filme-aufnehmen.mjs --standbild) – und eine Vorführung, die es
// spielt. Die Filme von früher (filme/) sind ausgeschaltet (mini-games.js,
// FILME) und kein Muss mehr.
{
  for (const s of SPIELE) {
    pruefe(`scripts/vorfuehrung/${s.seite}.mjs liegt da`, existsSync(path.join(WURZEL, "scripts", "vorfuehrung", `${s.seite}.mjs`)));
    for (const datei of [`${s.seite}-quer.webp`, `${s.seite}-hoch.webp`, `${s.seite}-klein.webp`]) {
      pruefe(`bilder/${datei} liegt da`, existsSync(path.join(WURZEL, "bilder", datei)));
    }
  }
  pruefe("netlify/build.mjs nimmt bilder/ mit", /const ORDNER = \[[^\]]*"bilder"/.test(lies("netlify/build.mjs")));
  pruefe("mini-games.js zeigt oben Bilder (FILME = false)", /const FILME = false;/.test(miniJs));
  // Die Filme nimmt der Service Worker nicht in die Hand: Safari spielt ein
  // Video nur mit Range-Anfragen, und die beantwortet nur der Server.
  pruefe("service-worker.js lässt Videos durch (kein respondWith für video)",
    !/destination === "video"/.test(lies("service-worker.js")));
}

// --- 5. Der Service Worker kennt jede Datei ---------------------------------
const sw = lies("service-worker.js");
pruefe(`service-worker.js trägt die Fassung ${FASSUNG}`, sw.includes(`const APP_VERSION = "${FASSUNG}"`));
// Der Adminbereich gehört NICHT in den Zwischenspeicher: Er zeigt Zahlen, die
// stimmen sollen, und er gehört nicht in die installierte App.
const NUR_ADMIN = new Set(["admin.js", "https://www.gstatic.com/firebasejs/12.7.0/firebase-auth-compat.js"]);
for (const datei of alleSkripte) {
  if (NUR_ADMIN.has(datei)) continue;
  if (datei.startsWith("http")) { pruefe(`SW kennt ${datei}`, sw.includes(datei)); continue; }
  pruefe(`SW kennt ${datei}`, sw.includes(`"./${datei}?v=${FASSUNG}"`));
}
for (const datei of NUR_ADMIN) {
  pruefe(`SW lässt ${datei} aussen vor`, !sw.includes(datei));
}
pruefe("SW lässt admin.html aussen vor", !sw.includes("admin.html"));
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
for (const name of ["icon-32.png", "icon-180.png", "vorschau.jpg"]) {
  pruefe(`icons/${name} liegt da`, existsSync(path.join(WURZEL, "icons", name)));
}
pruefe("Die App heisst «arcade»", manifest.name === "arcade" && manifest.short_name === "arcade");
// Ein geteilter Link (WhatsApp & Co.) zeigt Titel, einen kurzen Satz und das
// Logo – das Bild nur über eine volle Adresse.
for (const datei of ["index.html", "turnier.html", "live.html", ...SPIELE.map((sp) => `${sp.seite}.html`)]) {
  const html = lies(datei);
  pruefe(`${datei}: Vorschau mit Bild`, html.includes('<meta property="og:image" content="https://games.alae.app/icons/vorschau.jpg" />'));
  pruefe(`${datei}: Vorschau mit Titel und Satz`, /<meta property="og:title" content="(?:[^"]+ · )?arcade" \/>/.test(html) && /<meta property="og:description" content="[^"]{10,80}" \/>/.test(html));
  pruefe(`${datei}: kein «alae arcade» mehr`, !/alae arcade/i.test(html));
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
  ["help-voice|mountHelpButton|setHelp|pushHelp|speechSynthesis", "der Vorlese-Knopf der App – hier liest nichts vor"],
];
for (const name of readdirSync(WURZEL).filter((n) => n.endsWith(".js"))) {
  const quelle = lies(name);
  for (const [muster, warum] of VERBOTEN) {
    pruefe(`${name} fragt nicht nach ${muster} (${warum})`, !new RegExp(muster).test(quelle));
  }
}
pruefe("styles.css gestaltet keinen Vorlese-Knopf mehr (.help-voice)", !/\.help-voice/.test(lies("styles.css")));

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

// --- 10. Der Adminbereich ---------------------------------------------------
// Er ist der einzige Ort mit Anmeldung. Die Spielseiten dürfen firebase-auth
// nicht laden – ein SDK, das niemand braucht, lädt sonst jeder Besucher mit.
const adminSeite = lies("admin.html");
pruefe("admin.html lädt firebase-auth", adminSeite.includes("firebase-auth-compat.js"));
pruefe("admin.html lädt admin.js", adminSeite.includes("admin.js?v="));
pruefe("admin.html lädt kein pwa.js", !/<script[^>]+pwa\.js/.test(adminSeite));
pruefe("admin.html hängt nicht am Manifest", !adminSeite.includes('rel="manifest"'));
pruefe("admin.html bittet um kein Google-Ergebnis", adminSeite.includes('name="robots"'));
pruefe("admin.html trägt data-page=\"admin\"", adminSeite.includes('data-page="admin"'));
const adminJs = lies("admin.js");
pruefe("admin.js baut nur auf der Adminseite", adminJs.includes('dataset?.page !== "admin"'));
pruefe("admin.js legt keinen zweiten Firebase-Client an", !adminJs.includes("initializeApp"));
pruefe("styles.css kennt den Adminbereich", /\.adm-seite(?![\w-])/.test(css));

// --- 11. Die Regeln und das Projekt -----------------------------------------
// Vier Stellen nennen dasselbe Firebase-Projekt. Laufen sie auseinander,
// schreibt der Browser in die eine Datenbank und der Workflow die Regeln in
// die andere – und niemand merkt es, bis ein Schreibvorgang abgewiesen wird.
const PROJEKT = "games-a0cd4";
pruefe(`cloud.js zeigt auf ${PROJEKT}`, lies("cloud.js").includes(`projectId: "${PROJEKT}"`));
pruefe(`.firebaserc zeigt auf ${PROJEKT}`, JSON.parse(lies(".firebaserc")).projects.default === PROJEKT);
const workflow = lies(".github/workflows/firestore-rules.yml");
pruefe(`Der Workflow zeigt auf ${PROJEKT}`, workflow.includes(`FIREBASE_PROJEKT: ${PROJEKT}`));
pruefe("Der Workflow veröffentlicht nur aus der Umgebung produktion",
  /veroeffentlichen:[\s\S]*environment: produktion/.test(workflow));
pruefe("Der Workflow veröffentlicht nur von main",
  /veroeffentlichen:[\s\S]*if: github\.ref == 'refs\/heads\/main'/.test(workflow));
pruefe("Der Prüf-Job sieht den Deploy-Schlüssel nicht",
  !/pruefen:[\s\S]*?secrets\.FIREBASE_SERVICE_ACCOUNT\b(?![_A-Z])[\s\S]*?veroeffentlichen:/.test(workflow));
pruefe("firebase.json zeigt auf firestore.rules", JSON.parse(lies("firebase.json")).firestore.rules === "firestore.rules");

// Die Realtime Database (Live-Modus) hängt am selben Workflow. Ihre Regeln
// stehen in database.rules.json; der Workflow prüft und veröffentlicht sie,
// sobald sich die Datei ändert.
pruefe("firebase.json zeigt auf database.rules.json", JSON.parse(lies("firebase.json")).database?.rules === "database.rules.json");
pruefe("Der Workflow beobachtet database.rules.json", /paths: &pfade[\s\S]*?- "database\.rules\.json"/.test(workflow));
pruefe("Der Workflow veröffentlicht die Regeln der Realtime Database",
  /veroeffentlichen:[\s\S]*firebase deploy --only database\b/.test(workflow));
pruefe("Der Workflow liest die Regeln der Realtime Database im Pull Request gegen",
  /pruefen:[\s\S]*--only firestore:rules,database[\s\S]*--dry-run[\s\S]*veroeffentlichen:/.test(workflow));
let liveRegeln = null;
try { liveRegeln = JSON.parse(lies("database.rules.json")).rules; } catch { /* unten gemeldet */ }
pruefe("database.rules.json ist gültiges JSON mit «rules»", Boolean(liveRegeln));
// Oben an der Wurzel ist zu. Was offen sein soll, öffnet ein Zweig weiter
// unten – eine Wurzel mit true öffnete alles darunter, egal was dort steht.
pruefe("Die Realtime Database ist an der Wurzel zu",
  liveRegeln?.[".read"] === false && liveRegeln?.[".write"] === false);

// Netlify bricht den Deploy ab, wenn es im Ergebnis etwas findet, das nach
// einem Geheimnis aussieht – der Web-API-Schlüssel tut das. Freigegeben wird
// er in netlify.toml, und zwar genau der, der auch in cloud.js steht. Nach
// einem Projektwechsel ist das die Stelle, die man vergisst.
const schluessel = lies("cloud.js").match(/apiKey: "([^"]+)"/)?.[1] || "";
const netlify = lies("netlify.toml");
pruefe("cloud.js hat einen Web-API-Schlüssel", schluessel.length > 20);
pruefe("netlify.toml gibt genau diesen Schlüssel für den Scanner frei",
  netlify.includes(`SECRETS_SCAN_SMART_DETECTION_OMIT_VALUES = "${schluessel}"`));

const regeln = lies("firestore.rules");
pruefe("Die Regeln verlangen eine bestätigte Adresse", regeln.includes("email_verified == true"));
pruefe("Löschen darf nur der Admin", /allow delete: if istAdmin\(\)/.test(regeln));
pruefe("Lesen darf jeder", /allow read: if true/.test(regeln));
pruefe("Alles andere ist zu", /match \/\{document=\*\*\}[\s\S]*allow read, write: if false/.test(regeln));
// Die Liste der Spiele steht in den Regeln ein zweites Mal – sonst stünde in
// game, was der Schreiber hineinschreibt. Hier laufen die beiden nicht
// auseinander.
const inRegeln = [...(regeln.match(/function miniSpiele\(\) \{\s*return \[([\s\S]*?)\];/)?.[1] || "")
  .matchAll(/"([^"]+)"/g)].map((m) => m[1]);
pruefe(`firestore.rules kennt ${SPIELE.length} Spiele (gefunden: ${inRegeln.length})`, inRegeln.length === SPIELE.length);
for (const spiel of SPIELE) {
  pruefe(`firestore.rules lässt ${spiel.spiel} zu`, inRegeln.includes(spiel.spiel));
}
for (const id of inRegeln) {
  pruefe(`firestore.rules kennt kein erfundenes Spiel (${id})`, SPIELE.some((s) => s.spiel === id));
}

// --- 13. Offline: die Adresse, die man weitergibt ---------------------------
// /turmbau ist die Adresse; im Zwischenspeicher liegt turmbau.html. Ohne die
// Umrechnung im Service Worker endet offline jeder Weg in ein Spiel auf der
// Startseite. scripts/check-spiele.mjs fährt das im Browser wirklich ab.
pruefe("Der Service Worker rechnet /turmbau auf turmbau.html um",
  /function mitEndung/.test(sw) && /ausDemSpeicher\(cache, event\.request\)/.test(sw));

// --- 12. Die Bestenliste ----------------------------------------------------
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
// Ein neuer Name gilt nur für die Runden, die kommen: Die Seiten benennen
// nichts um, was schon in einer Liste steht (umbenennen darf nur der Admin).
pruefe("Ein neuer Name benennt keine alten Einträge um",
  !/benenneUm|turnierUmbenennen/.test(miniJs + lies("turnier.js")));
pruefe("Ein neuer Name ist ein neuer Mitspieler (eigene Kennung)",
  /function namenWechseln[\s\S]*?schreibe\(ID_KEY, neueKennung\(\)\)/.test(miniJs));
// Derselbe Name auf zwei Geräten ist derselbe Spieler: in der Liste, in der
// Bestmarke und in den Einträgen, in die seine Runden gehen.
pruefe("Die Bestmarke zählt alles unter dem eigenen Namen (gleicheAb, melde)",
  /function gleicheAb[\s\S]*?bestesUnterNamen\(/.test(miniJs) && /async function melde[\s\S]*?bestesUnterNamen\(/.test(miniJs));
pruefe("Die Zeile eines Namens trägt die Kennung seines besten Ergebnisses (verdichte)",
  /function verdichte[\s\S]*?bisher\.spieler = eintrag\.spieler;/.test(miniJs));
pruefe("Ein Gerät spielt unter der Kennung seines Namens – nur nicht mitten im Turnier oder Multiplayer",
  /async function melde[\s\S]*?await stammKennung\(spiel\);/.test(miniJs)
  && /function stammKennung[\s\S]*?inTurnierOderLive\(\)/.test(miniJs)
  && /p\.has\("turnier"\) \|\| p\.has\("live"\)/.test(miniJs));
pruefe("Der Adminbereich führt einen Namen von mehreren Geräten zusammen",
  /async function fuehreZusammen[\s\S]*?mini\(\)\?\.stammVon\?\.\(/.test(lies("admin.js")));
for (const s of SPIELE) {
  const seite = lies(`${s.seite}.html`);
  pruefe(`${s.seite}.html lädt kein firebase-auth`, !seite.includes("firebase-auth"));
}

// --- 14. Der Turniermodus ---------------------------------------------------
// Eine eigene Seite, eine eigene Datei, die auf allen Seiten steht – und zwar
// vor der Bühne und vor dem Spiel, denn beide fragen schon beim Aufbauen
// danach, ob gerade ein Turnier gespielt wird.
const turnierHtml = lies("turnier.html");
pruefe("turnier.html trägt data-page=\"turnier\"", turnierHtml.includes('data-page="turnier"'));
pruefe("turnier.html hat den Platz für die Seite ([data-turnier])", turnierHtml.includes("data-turnier"));
pruefe("turnier.html lädt turnier.js", turnierHtml.includes(`turnier.js?v=${FASSUNG}`));
pruefe("turnier.html lädt kein firebase-auth", !turnierHtml.includes("firebase-auth"));
pruefe("turnier.html bittet um kein Google-Ergebnis – ein Turnier nur mit Link soll dort nicht stehen", turnierHtml.includes('name="robots"'));
pruefe("SW kennt turnier.html", sw.includes('"./turnier.html"'));
for (const s of SPIELE) {
  const liste = seitenSkripte(s);
  const wo = liste.indexOf("turnier.js");
  pruefe(`${s.seite}.html lädt turnier.js vor game-shell.js und ${s.js}`,
    wo >= 0 && wo < liste.indexOf("game-shell.js") && wo < liste.indexOf(s.js));
}

// Wer würfelt, würfelt im Turnier mit dem Turnier: Sonst bekäme jeder eine
// andere Aufgabe, und es gewänne der mit dem freundlicheren Würfel. Ein Spiel
// mit festem Level würfelt gar nicht – es hat für alle und immer dieselbe
// Strecke, aus einer festen Saat.
const FESTES_LEVEL = new Set(["vineSwing"]);
for (const s of SPIELE) {
  const quelle = lies(s.js);
  if (FESTES_LEVEL.has(s.spiel)) {
    pruefe(`${s.js} hat ein festes Level: eine feste Saat, kein Zufall des Turniers`,
      /const SAAT = \d+;/.test(quelle) && !quelle.includes("LernappZufall"));
    continue;
  }
  pruefe(`${s.js} nimmt seinen Zufall aus LernappZufall.fuer("${s.spiel}")`, quelle.includes(`LernappZufall?.fuer?.("${s.spiel}")`));
  pruefe(`${s.js} stellt den Zufall zu Beginn jeder Runde zurück (zufall.neu())`, /zufall\.neu\(\)/.test(quelle));
}

// Entfernte Spiele bleiben entfernt: keine Seite, kein Skript, kein Eintrag in
// den Listen. Was in der Bestenliste von ihnen steht, räumt der Admin weg.
for (const weg of ["wasfehlt", "signal", "weichen", "bremsweg", "strecke", "schleuder", "eisstock", "takt"]) {
  pruefe(`${weg} ist ganz weg (Seite und Skript)`, !existsSync(path.join(WURZEL, `${weg}.html`)) && !existsSync(path.join(WURZEL, `${weg}.js`)));
}
pruefe("strand-art.js ist mit «Was fehlt?» weg", !existsSync(path.join(WURZEL, "strand-art.js")));

// Die Regeln der Turniere: anlegen nur der Admin, auflisten nur öffentliche,
// ein Versuch zählt ab seinem Beginn.
pruefe("Turniere legt nur der Admin an",
  /match \/miniTurniere\/\{turnierId\}[\s\S]*?allow create, update: if istAdmin\(\) && istTurnier\(turnierId\)/.test(regeln));
pruefe("Auflisten lassen sich nur die öffentlichen Turniere",
  /allow list: if istAdmin\(\) \|\| resource\.data\.sichtbar == "alle"/.test(regeln));
pruefe("Ein Turnier nimmt nur Spiele auf, die es gibt", /function istTurnier[\s\S]*?d\.spiele\.hasOnly\(miniSpiele\(\)\)/.test(regeln));
pruefe("Ein Versuch im Turnier zählt ab seinem Beginn, sein Ergebnis kommt einmal",
  regeln.includes("request.resource.data.versuche == resource.data.versuche + 1")
  && regeln.includes("resource.data.offen == true")
  && regeln.includes("request.resource.data.offen == false"));
pruefe("cloud.js meldet einen Versuch in einer Transaktion an",
  /async function turnierVersuch[\s\S]*?runTransaction/.test(lies("cloud.js")));
pruefe("Wer vorne liegt, wartet – das gibt es nur ohne feste Zahl von Versuchen (firestore.rules, istTurnier)",
  regeln.includes('d.get("spitzeWartet", false) is bool')
  && regeln.includes('!(d.get("spitzeWartet", false) == true && d.versuche != 0)'));
pruefe("Vor jeder Runde fragt die Spielseite noch einmal, ob vorne liegt, wer beginnt (turnier.js, rundeBeginnt)",
  /const anmelden = async \(\) => \{\s*if \(t\.spitzeWartet && await liegtVorne\(\)\)/.test(lies("turnier.js")));
// Ohne Zeitlimite: ein Ende, das nie kommt. turnier.js legt es fest, admin.js
// fällt im Notfall auf dasselbe zurück – und es muss als ganze Zahl in der
// Datenbank ankommen, sonst wiesen die Regeln es ab (d.endeMs is int).
const ohneEnde = /const OHNE_ENDE = Date\.UTC\(9999, 11, 31\);/;
pruefe("Ohne Zeitlimite heisst in turnier.js und admin.js dasselbe Ende",
  ohneEnde.test(lies("turnier.js")) && adminJs.includes("Date.UTC(9999, 11, 31)")
  && Number.isSafeInteger(Date.UTC(9999, 11, 31)));
pruefe("cloud.js fragt nur nach öffentlichen Turnieren",
  /where\("sichtbar", "==", "alle"\)/.test(lies("cloud.js")));

// --- 15. Der Weg in den Adminbereich -----------------------------------------
// Kein Anmeldeknopf in der App; nur wer im Adminbereich angemeldet ist, sieht
// auf der Startseite einen Weg zurück. Beide Dateien müssen vom selben
// Merkzeichen sprechen – sonst setzt die eine, was die andere nie liest.
const merkzeichen = /const ADMIN_KEY = "([^"]+)"/;
pruefe("admin.js und mini-games.js sprechen vom selben Merkzeichen",
  Boolean(adminJs.match(merkzeichen)) && adminJs.match(merkzeichen)?.[1] === miniJs.match(merkzeichen)?.[1]);
pruefe("admin.js setzt das Merkzeichen beim Anmelden und nimmt es beim Abmelden weg",
  /localStorage\.setItem\(ADMIN_KEY/.test(adminJs) && /localStorage\.removeItem\(ADMIN_KEY/.test(adminJs));
pruefe("Die Startseite zeigt den Admin-Knopf nur mit Merkzeichen",
  /function adminKnopf\(\) \{\s*if \(!adminAngemeldet\(\)\) return null;/.test(miniJs));
pruefe("Die Spielseiten bleiben ohne Anmeldung (kein firebase-auth auf der Startseite)",
  !lies("index.html").includes("firebase-auth"));

// --- 16. Spielen aus dem Adminbereich ------------------------------------------
// Der Admin startet ein Spiel mit ▶ über das ganze Browserfenster, ins
// Vollbild geht es erst mit dem Knopf im Spiel (vollbild.js). Die Runde zählt
// wie jede andere – unter dem Namen des Geräts. Einen Probelauf, der nirgends
// zählt, gibt es nicht mehr.
pruefe("admin.js startet die Spiele mit ?von=admin", adminJs.includes("?von=admin"));
pruefe("admin.js holt das Vollbild nicht von selbst", !/requestFullscreen/.test(adminJs));
pruefe("Das Fenster des Adminbereichs lässt das Vollbild aus dem Spiel zu", /allowfullscreen/.test(adminJs));
const vollbildJs = lies("vollbild.js");
pruefe("vollbild.js hält das Vollbild über Seitenwechsel (Rahmen)",
  vollbildJs.includes("data-vollbild-rahmen") && /navigation\?\.addEventListener/.test(vollbildJs));
pruefe("Alle Seiten laden vollbild.js",
  ["index.html", "turnier.html", "admin.html", ...SPIELE.map((s) => `${s.seite}.html`)].every((datei) => lies(datei).includes("vollbild.js")));
pruefe("Kein Probelauf mehr (?probe=1, probelauf)",
  ![adminJs, miniJs, lies("turnier.js"), lies("geist.js")].some((text) => /probe=1|probelauf/.test(text)));

// --- 17. Läufe anschauen ------------------------------------------------------
// Die Liste in mini-games.js (ANSEHBAR) sagt, welche Fassung der Aufzeichnung
// zu einem Spiel gehört; das Spiel selbst sagt es zweimal – beim Aufzeichnen
// (LernappGeist.fuer) und beim Zuschauen. Laufen sie auseinander, steht in
// der Hall of Fame ein ▶, hinter dem sich nichts abspielen lässt.
const ansehbar = miniJs.match(/const ANSEHBAR = \{([\s\S]*?)\n  \};/);
const ANSEHBAR_LISTE = Object.fromEntries([...(ansehbar?.[1] || "").matchAll(/(\w+): \{ fassung/g)].map((m) => [m[1], true]));
pruefe("mini-games.js hat eine Liste ANSEHBAR", Boolean(ansehbar));
if (ansehbar) {
  for (const [, id, fassung] of ansehbar[1].matchAll(/(\w+): \{ fassung: "([^"]+)"/g)) {
    const s = SPIELE.find((x) => x.spiel === id);
    pruefe(`ANSEHBAR: ${id} ist ein Spiel`, Boolean(s));
    if (!s) continue;
    const quelle = lies(s.js);
    const zu = quelle.match(/LernappGeist\?\.zuschauer\?\.\(\{([\s\S]*?)\}\)/);
    const auf = quelle.match(/LernappGeist\?\.fuer\?\.\(\{([\s\S]*?)\}\)/);
    const fassungIn = (treffer) => (treffer ? (treffer[1].match(/fassung: "([^"]+)"/)?.[1] || "t1") : null);
    pruefe(`${s.js} schaut mit Fassung ${fassung} zu`, fassungIn(zu) === fassung);
    pruefe(`${s.js} zeichnet mit Fassung ${fassung} auf`, fassungIn(auf) === fassung);
  }
}
// Die Spiele ohne Figur im Bild (ANSEHBAR_ZUEGE): Sie zeichnen ihre Züge auf
// (LernappGeist.zuege), geben die Aufzeichnung an die Tafel weiter (geist –
// sonst käme sie nie in die Hall of Fame) und bauen sie beim Anschauen nach.
const zugAnsehbar = miniJs.match(/const ANSEHBAR_ZUEGE = \{([\s\S]*?)\n  \};/);
pruefe("mini-games.js hat eine Liste ANSEHBAR_ZUEGE", Boolean(zugAnsehbar));
const ZUG_ANSEHBAR = [...(zugAnsehbar?.[1] || "").matchAll(/(\w+): \{ fassung: "([^"]+)"/g)].map((m) => [m[1], m[2]]);
pruefe("Jedes Spiel lässt sich anschauen (ANSEHBAR und ANSEHBAR_ZUEGE)",
  SPIELE.every((s) => ANSEHBAR_LISTE[s.spiel] || ZUG_ANSEHBAR.some(([id]) => id === s.spiel)));
for (const [id, fassung] of ZUG_ANSEHBAR) {
  const s = SPIELE.find((x) => x.spiel === id);
  pruefe(`ANSEHBAR_ZUEGE: ${id} ist ein Spiel`, Boolean(s));
  if (!s) continue;
  const quelle = lies(s.js);
  const zu = quelle.match(/LernappGeist\?\.zuschauer\?\.\(\{([\s\S]*?)\}\)/)?.[1] || "";
  const auf = quelle.match(/LernappGeist\?\.zuege\?\.\(\{([\s\S]*?)\}\)/)?.[1] || "";
  pruefe(`${s.js} schaut Zug um Zug zu (zuege: true), mit Fassung ${fassung}`,
    zu.includes("zuege: true") && zu.match(/fassung: "([^"]+)"/)?.[1] === fassung);
  pruefe(`${s.js} zeichnet seine Züge mit Fassung ${fassung} auf`, auf.match(/fassung: "([^"]+)"/)?.[1] === fassung);
  pruefe(`${s.js} gibt die Aufzeichnung an die Tafel (showResult, geist)`, /aufnahme\?\.ende\(/.test(quelle) && /\n\s+geist,\n\s+\}\);/.test(quelle));
  pruefe(`${s.js} beginnt das Anschauen, wenn der Lauf geladen ist`, /zuschauer\?\.laden\.then\(\(da\) => \{ if \(da\) zuschauenStarten\(\); \}\);/.test(quelle));
  pruefe(`${s.js} zeigt am Schluss des Laufs die Tafel (weiter)`, /zuschauer\??\.weiter\?\.\(\)/.test(quelle));
}
{
  const geistJs = lies("geist.js");
  pruefe("geist.js zeichnet Züge auf und spielt sie ab (zuege, zugAbspieler)",
    /function zuege\(/.test(geistJs) && /function zugAbspieler\(/.test(geistJs) && /\n    zuschauer, zuschauAdresse, ansehbar, zuege,/.test(geistJs));
  pruefe("geist.js sperrt beim Zuschauen die Eingaben ins Spiel", /sperreEingaben\(\);/.test(geistJs));
}
// Ein Turnier kann die Replays abschalten (ohneReplay): Die Regeln lassen das
// Feld zu, das Formular setzt es, die Turnierseite zeigt dann keinen ▶, und
// das Spiel verweigert den Lauf auch über die Adresse.
pruefe("Turniere ohne Replays: Regel, Formular, Turnierseite und Spiel kennen ohneReplay",
  /"ohneReplay"/.test(regeln) && /d\.get\("ohneReplay", false\) is bool/.test(regeln)
  && /ohneReplay: !replay\.checked/.test(lies("admin.js")) && /ohneReplay: d\.ohneReplay === true/.test(lies("cloud.js"))
  && /ansehbar: !t\.ohneReplay/.test(lies("turnier.js")) && /if \(ansehbar && !ansehen\.has\(spiel\)\)/.test(miniJs)
  && /t\.ohneReplay \|\|/.test(lies("geist.js")));
// Die Tiers: eine Vorgabe in mini-games.js, gespeichert in config/miniGames
// (die Regeln lassen je Spiel 1, 2 oder 3 zu), eingeteilt und gruppiert im
// Adminbereich.
pruefe("Tiers: Vorgabe, Speicher, Regel und Adminbereich passen zusammen",
  /const TIERS_VORGABE = \{/.test(miniJs) && /async function setzeTiers\(/.test(lies("cloud.js"))
  && /d\.tiers\.values\(\)\.hasOnly\(\[1, 2, 3\]\)/.test(regeln)
  && /function nachTier\(/.test(lies("admin.js")) && /tierKnopf/.test(lies("admin.js")));
// In einer Netlify-Vorschau meldet Google über die Live-Adresse an – und das
// Token geht nur an eigene Vorschauen: die eines Pull Requests aus diesem
// Repository (kein Fork) und einen Deploy, den Netlify als Stand von main
// kennt.
{
  const adminJs = lies("admin.js");
  pruefe("Adminbereich: Google-Anmeldung in Vorschauen über die Live-Adresse, nur für main und eigene Pull Requests",
    adminJs.includes('const LIVE = "https://games.alae.app";')
    && adminJs.includes("const VORSCHAU = /^https:\\/\\/(?:deploy-preview-(\\d+)|([0-9a-f]{24}))--gamesrepo\\.netlify\\.app$/;")
    && /head\?\.repo\?\.full_name === REPO/.test(adminJs)
    && /d\?\.site_id !== NETLIFY_SEITE/.test(adminJs)
    && /d\.context === "production" && d\.branch === "main"/.test(adminJs)
    && /opener\.postMessage\(\{[^}]*\}, ziel\)/.test(adminJs)
    && /ereignis\.origin !== LIVE/.test(adminJs));
}
// Der ▶ steht bei jedem, dessen Lauf es gibt – nicht nur bei den ersten drei.
pruefe("Die Listen zeigen den ▶ bei allen, nicht nur bei den ersten drei",
  !/platz <= 3/.test(miniJs) && /function ansehenFuer\(/.test(miniJs)
  && /ansehenFuer\(spiel, \(\) => listen\.get\(spiel\) \|\| \[\]/.test(miniJs));

// ---------------------------------------------------------------------------
// --- 18. Der Multiplayer -------------------------------------------------------
// Eine eigene Seite mit der Realtime Database (live.js), und auf jeder
// Spielseite live-spiel.js vor der Bühne – sie fragt beim Aufbauen, ob die
// Seite eine Runde eines Multiplayers ist. Jedes Spiel gibt der Bühne mit, wie
// es ohne Tipp beginnt und wie es endet, wenn die Zeit des Abends um ist.
const liveHtml = lies("live.html");
pruefe("live.html trägt data-page=\"live\" und den Platz [data-live]", liveHtml.includes('data-page="live"') && liveHtml.includes("data-live"));
pruefe("live.html lädt live.js", liveHtml.includes(`live.js?v=${FASSUNG}`));
pruefe("live.html lädt die Realtime Database", liveHtml.includes("firebase-database-compat.js"));
pruefe("live.html bittet um kein Google-Ergebnis", liveHtml.includes('name="robots"'));
pruefe("SW kennt live.html", sw.includes('"./live.html"'));
pruefe("cloud.js kennt die Adresse der Realtime Database",
  lies("cloud.js").includes('databaseURL: "https://games-a0cd4-default-rtdb.europe-west1.firebasedatabase.app"'));
pruefe("Keine Spielseite lädt die Realtime Database – das tut nur die Live-Seite",
  SPIELE.every((x) => !lies(`${x.seite}.html`).includes("firebase-database")));
for (const x of SPIELE) {
  const liste = seitenSkripte(x);
  const wo = liste.indexOf("live-spiel.js");
  pruefe(`${x.seite}.html lädt live-spiel.js vor game-shell.js`, wo >= 0 && wo < liste.indexOf("game-shell.js"));
  pruefe(`${x.js} sagt der Bühne, wie eine Live-Runde beginnt und endet (live: { los, stopp })`,
    /live: \{ los: [^,]+, stopp: /.test(lies(x.js)));
}
// Zuschauen: Die Spiele mit Figur im Bild (dieselben, deren beste Läufe sich
// anschauen lassen) zeigen im Live-Modus nach dem Ausscheiden eine fremde
// Figur – und zeichnen den, dem zugeschaut wird, nicht noch als Geist dazu.
for (const id of Object.keys(ANSEHBAR_LISTE)) {
  const x = SPIELE.find((s) => s.spiel === id);
  if (!x) continue;
  const quelle = lies(x.js);
  pruefe(`${x.js} lässt im Live-Modus zuschauen (live.zuschauen)`, /zuschauen: \(quelle\) => \{ zuschauer = quelle; zuschauenStarten\(\); \}/.test(quelle));
  pruefe(`${x.js} zeichnet den, dem zugeschaut wird, nicht als Geist (ziel)`, /\.ziel\)? return;|\|\| geist\.ziel\) return;/.test(quelle));
}
pruefe("planeten.js stellt die Uhr der Planeten im Live-Modus nach der Uhr des Abends",
  /live \? live\.zeit\(\) \/ 1000 : state\.uhr \+ dt/.test(lies("planeten.js")));
// Mit einem Turnier: Ein Turnier «nur live» lässt keinen Versuch beginnen,
// und der Endstand eines Abends zählt in der Gesamtwertung mit.
pruefe("Ein Turnier «nur live» lässt keinen Versuch beginnen (firestore.rules, darfBeginnen)",
  /function darfBeginnen[\s\S]*?get\("nurLive", false\) == false/.test(regeln));
pruefe("Den Endstand eines Multiplayers im Turnier schreibt nur der Admin",
  /match \/live\/\{abendId\}[\s\S]*?allow create, update: if istAdmin\(\) && istLiveErgebnis/.test(regeln));
pruefe("turnier.js zählt die Multiplayer in der Gesamtwertung", lies("turnier.js").includes("function gesamtwertung(t, eintraege, abende = [])"));
const liveJs = lies("live.js");
pruefe("live.js leitet nur mit dem Admin, der den Abend angelegt hat", /info\.host === S\.uid/.test(liveJs));
pruefe("Die Live-Regeln lassen nur den Admin anlegen und steuern",
  /"\.write": "\$code\.matches[^"]*auth\.token\.email_verified == true/.test(lies("database.rules.json")));
// Sichtbar für alle oder nur mit Link: Die Liste der offenen lesen alle (die
// Startseite fragt ohne Anmeldung), schreiben nur der Admin. Einer nur mit
// Link hat einen Code, den niemand errät – und keinen Knopf auf der
// Startseite; der steht nur da, solange einer für alle offen ist.
pruefe("Die offenen Multiplayer (liveOffen) lesen alle, schreiben nur der Admin",
  liveRegeln?.liveOffen?.[".read"] === true && /auth\.token\.email_verified == true/.test(liveRegeln?.liveOffen?.$code?.[".write"] || ""));
pruefe("Ein Multiplayer bekommt einen Code mit zehn Zeichen", /const CODE_LAENGE = 10;/.test(liveJs));
pruefe("live.js fragt nach keinem Code mehr", !liveJs.includes("lv-code-feld"));
const miniStart = lies("mini-games.js");
pruefe("Die Startseite zeigt «Multiplayer» nur, wenn einer für alle offen ist",
  miniStart.includes("offeneMultiplayer") && !/verweis\("Live"/.test(miniStart));
// Die anderen im Bild: um einen gemessenen Verzug zurück, auf einer weichen
// Kurve zwischen den Proben – nicht zur Zeit «jetzt» geraten (das ruckelte).
const liveSpielJs = lies("live-spiel.js");
// Wer nicht wirklich spielt (Bildschirm aus, Tab verdeckt), hält die Runde
// nicht auf: Das Lebenszeichen hängt am Bild, und wer zwölf Sekunden
// schweigt, ist für die Leitung weg – auf beiden Seiten dieselbe Zahl.
pruefe("live-spiel.js meldet sich am Bild (requestAnimationFrame), nicht an einer Uhr",
  /function puls\(\) \{\s*z\.puls = window\.requestAnimationFrame\(puls\);/.test(liveSpielJs));
pruefe("live.js wartet nicht auf einen, der schweigt (istWeg im Rundenende)",
  /dabei\.every\(\(k\) => [^\n]*istWeg\(z, k\)\)/.test(liveJs));
pruefe("live.js und live-spiel.js warten gleich lange (WEG_MS)",
  liveJs.match(/const WEG_MS = (\d+);/)?.[1] === liveSpielJs.match(/const WEG_MS = (\d+);/)?.[1]);
pruefe("live-spiel.js zeigt die anderen mit gemessenem Verzug auf einer Kurve",
  /function verzugVon\(/.test(liveSpielJs) && /LernappGeist\?\.kurve/.test(liveSpielJs) && /lauf\.zeitBei\(t\)/.test(liveSpielJs));
// Die Wiedergabe der besten Läufe: dreissig Proben je Sekunde, als Schritte
// in Text gepackt (v 4), abgespielt auf derselben Kurve wie im Multiplayer.
const geistJs = lies("geist.js");
pruefe("geist.js zeichnet dreissigmal je Sekunde auf (TAKT_MS 33)", /const TAKT_MS = 33;/.test(geistJs));
pruefe("geist.js packt die Aufzeichnung als Text (v 4) und liest auch v 1 und v 2",
  /v: 4, dt, p: alsText\(p\)/.test(geistJs) && /!\[1, 2, 4\]\.includes\(d\.v\)/.test(geistJs));
pruefe("geist.js spielt auf der Kurve ab (abspieler → kurve)", /ort: \(ms\) => \(proben \? kurve\(proben, ms, \{ winkel \}\) : null\)/.test(geistJs));

// Zuschauen in den Spielen ohne Figur: Sie melden ihre Züge (zug) und bauen
// beim Zuschauen nach, was der andere tut. ZUSCHAUBAR in mini-games.js sagt,
// welche das sind; jedes davon braucht die Andockstelle live.zuschauen.
const zuschaubar = miniJs.match(/const ZUSCHAUBAR = \{([\s\S]*?)\n  \};/);
pruefe("mini-games.js hat eine Liste ZUSCHAUBAR", Boolean(zuschaubar));
const ZUG_SPIELE = [...(zuschaubar?.[1] || "").matchAll(/(\w+): \{ zug: true \}/g)].map((m) => m[1]);
pruefe("ZUSCHAUBAR nennt die Spiele, die Züge melden", ZUG_SPIELE.length >= 7);
for (const id of ZUG_SPIELE) {
  const x = SPIELE.find((s) => s.spiel === id);
  pruefe(`ZUSCHAUBAR: ${id} ist ein Spiel`, Boolean(x));
  if (!x) continue;
  const quelle = lies(x.js);
  pruefe(`${x.js} lässt im Live-Modus zuschauen (live.zuschauen)`, /zuschauen: \(quelle\) => \{ zuschauer = quelle; zuschauenStarten\(\); \}/.test(quelle));
  pruefe(`${x.js} meldet seine Züge (live.zug)`, /live\.zug\(/.test(quelle));
  pruefe(`${x.js} schreibt beim Zuschauen kein Ergebnis`, /if \((state\.phase === "zuschauen"|zuschauer)\) return;/.test(quelle));
}
pruefe("live-spiel.js schickt Züge sofort hinaus (zug)", /function zug\(wert, ort\)/.test(liveSpielJs) && /\n    zug,\n/.test(liveSpielJs));
pruefe("live-spiel.js behält alle Proben der Runde (PROBEN_MAX)", /const PROBEN_MAX = \d+;/.test(liveSpielJs) && !liveSpielJs.includes("PUFFER_MS"));
pruefe("live.js lässt allen Spielen aus ZUSCHAUBAR zuschauen", /ZUSCHAUBAR\?\.\[spiel\]/.test(liveJs));

// Nichts lässt sich markieren – ausser in Eingabefeldern.
const stilCss = lies("styles.css");
pruefe("styles.css: kein Text lässt sich markieren (html, user-select: none)", /html \{[^}]*\buser-select: none;/.test(stilCss));
pruefe("styles.css: Eingabefelder bleiben markierbar", /input,\s*textarea,\s*\[contenteditable="true"\] \{[^}]*user-select: text;/.test(stilCss));
pruefe("mini-games.js fängt Markieren, Menü und Ziehen ab", /\["selectstart", "contextmenu", "dragstart"\]/.test(miniJs));

// Handy: Das Spiel ist das ganze Bild, die Leiste fängt nur mit ihren
// Knöpfen, und was im Spiel oben steht, rückt unter die Knöpfe.
pruefe("styles.css: Die Leiste oben lässt Tipps durch, nur ihre Knöpfe nicht",
  /\.cm-bar \{[^}]*pointer-events: none;/.test(stilCss) && /\.cm-bar a,\s*\.cm-bar button \{ pointer-events: auto; \}/.test(stilCss));
pruefe("styles.css: Auf dem Handy beginnt die Spielfläche ganz oben (--cm-oben bleibt innen frei)",
  /@media \(max-width: 760px\), \(max-height: 500px\) \{\s*\.cm-play \{ top: 0; padding-top: var\(--cm-oben\); \}/.test(stilCss));
pruefe("game-shell.js misst, was oben unter den Knöpfen liegt (frei)", /function frei\(knoten = play\)/.test(lies("game-shell.js")));
for (const datei of ["liane.js", "huegel.js", "tunnelflug.js", "drift.js", "planeten.js", "mondlandung.js", "schwerkraft.js", "drehscheibe.js",
  "ballon.js", "slalom.js", "frosch.js", "kranhafen.js", "seiltaenzer.js", "draht.js", "spuren.js", "ball.js"]) {
  pruefe(`${datei} zeigt seine Anzeige oben unter den Knöpfen (frei)`, /shell\?\.frei\?\.\(canvas\)/.test(lies(datei)));
}

// Die Turnier-App bleibt im Turnier.
const turnierJs = lies("turnier.js");
pruefe("turnier.js merkt sich das Turnier eines App-Fensters (mini.heimTurnier)", /const HEIM_KEY = "mini\.heimTurnier";/.test(turnierJs) && /window\.location\.replace\(seitenLink\(heim\)\)/.test(turnierJs));
pruefe("turnier.js führt aus einem Lauf des Turniers zurück ins Turnier (aus=)", /ausDerAdresse\("turnier"\) \|\| ausDerAdresse\("aus"\) \|\| heim/.test(turnierJs));
pruefe("live.js führt in der Turnier-App zum Turnier statt zur Startseite", /LernappTurnier\?\.heim\?\.\(\)/.test(liveJs));

// --- 19. Die Klänge ----------------------------------------------------------
// klang.js kennt jeden Platz der Klangauswahl. Eine Aufnahme, die es nennt,
// liegt unter klang/, und keine liegt dort umsonst. Jedes Spiel benutzt alle
// seine Plätze und keinen der alten Kinder-App-Klänge mehr.
const klangJs = lies("klang.js");
const plaetze = [...klangJs.matchAll(/^    "?([a-z]+(?:\.[a-z]+)?)"?: \{ ([sd]): "([a-z0-9-]+)"/gm)].map((m) => ({ id: m[1], art: m[2], name: m[3] }));
pruefe(`klang.js nennt 113 Plätze (gefunden: ${plaetze.length})`, plaetze.length === 113);
const klangDateien = existsSync(path.join(WURZEL, "klang")) ? readdirSync(path.join(WURZEL, "klang")) : [];
const genannt = new Set(plaetze.filter((p) => p.art === "d").map((p) => `${p.name}.mp3`));
for (const d of genannt) pruefe(`klang/${d} liegt da`, klangDateien.includes(d));
for (const d of klangDateien) pruefe(`klang/${d} wird von klang.js gebraucht`, genannt.has(d));
pruefe("netlify/build.mjs nimmt klang/ mit", /const ORDNER = \[[^\]]*"klang"/.test(lies("netlify/build.mjs")));
for (const s of SPIELE) {
  if (!existsSync(path.join(WURZEL, s.js))) continue;
  const quelle = lies(s.js);
  pruefe(`${s.js} spielt keine Kinder-App-Klänge mehr (playJingle & Co.)`,
    !/\b(playJingle|playChime|playStarSound|playWhistle|playHorn|playRattle|chuff)\b/.test(quelle));
  for (const p of plaetze.filter((x) => x.id.startsWith(`${s.seite}.`))) {
    pruefe(`${s.js} benutzt den Klang «${p.id}»`, quelle.includes(`"${p.id}"`));
  }
}
const shellJs = lies("game-shell.js");
pruefe("game-shell.js: Tafel/Rekord und Stille kommen aus klang.js, kein Ton zum Start",
  !/ton\?\.\("start"\)/.test(shellJs) && /"rekord" : "tafel"/.test(shellJs) && /stille\?\.\(\)/.test(shellJs));

if (fehler.length) {
  console.error(`✗ ${fehler.length} von ${geprueft} Prüfungen fehlgeschlagen:\n`);
  for (const f of fehler) console.error(`   · ${f}`);
  console.error("\nErinnerung: Ein neues Spiel braucht auch eine Zeile in firestore.rules (miniSpiele).");
  process.exit(1);
}
console.log(`✓ ${geprueft} Prüfungen – ${SPIELE.length} Spiele, Fassung ${FASSUNG}.`);
