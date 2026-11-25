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
import { SPIELE, FASSUNG, alleDateien, seitenSkripte, hubSkripte, turnierSkripte, adminSkripte, ZWEI, zweiSkripte } from "./seiten-bauen.mjs";
import vm from "node:vm";

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
// Seit wann es jedes Spiel gibt (SEIT): Davon hängt «Neu» im Regal der
// Startseite ab. Ein Spiel ohne Tag wäre nie neu – auch nicht am ersten Tag.
const seitTabelle = miniJs.match(/const SEIT = \{([\s\S]*?)\};/);
pruefe("mini-games.js hat eine Tabelle SEIT", Boolean(seitTabelle));
if (seitTabelle) {
  const seit = new Map([...seitTabelle[1].matchAll(/(\w+):\s*"([^"]*)"/g)].map((m) => [m[1], m[2]]));
  for (const s of SPIELE) {
    const tag = seit.get(s.spiel) || "";
    pruefe(`SEIT nennt den Tag, an dem ${s.spiel} dazukam (gefunden: "${tag}")`,
      /^\d{4}-\d{2}-\d{2}$/.test(tag) && !Number.isNaN(Date.parse(`${tag}T00:00:00Z`)));
  }
  for (const id of seit.keys()) pruefe(`SEIT kennt kein erfundenes Spiel (${id})`, SPIELE.some((s) => s.spiel === id));
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
const alleSkripte = new Set([...hubSkripte(), ...adminSkripte(), ...ZWEI.flatMap(zweiSkripte)]);
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
// Die Realtime Database braucht nur, wer zu zweit spielt (Multiplayer,
// Viererreihe) – und das geht ohne Netz ohnehin nicht. Ihr SDK muss nicht in
// den Zwischenspeicher.
const NUR_MIT_NETZ = new Set(["https://www.gstatic.com/firebasejs/12.7.0/firebase-database-compat.js"]);
for (const datei of alleSkripte) {
  if (NUR_ADMIN.has(datei) || NUR_MIT_NETZ.has(datei)) continue;
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
for (const datei of ["index.html", "turnier.html", "live.html", ...ZWEI.map((z) => `${z.seite}.html`), ...SPIELE.map((sp) => `${sp.seite}.html`)]) {
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
  ["help-voice|mountHelpButton|setHelp|pushHelp", "der Vorlese-Knopf der App – hier liest vorlesen.js vor"],
];
for (const name of readdirSync(WURZEL).filter((n) => n.endsWith(".js"))) {
  const quelle = lies(name);
  for (const [muster, warum] of VERBOTEN) {
    pruefe(`${name} fragt nicht nach ${muster} (${warum})`, !new RegExp(muster).test(quelle));
  }
}
pruefe("styles.css gestaltet keinen Vorlese-Knopf mehr (.help-voice)", !/\.help-voice/.test(lies("styles.css")));
// Vorlesen gibt es wieder – aber nur an einem Ort (vorlesen.js), nur auf
// Wunsch (ein Lautsprecher neben dem Text) und nur bei den Spielen zu zweit.
for (const name of readdirSync(WURZEL).filter((n) => n.endsWith(".js") && n !== "vorlesen.js")) {
  pruefe(`${name} spricht nicht selbst (speechSynthesis nur in vorlesen.js)`, !/speechSynthesis|SpeechSynthesisUtterance/.test(lies(name)));
}
{
  const v = lies("vorlesen.js");
  pruefe("vorlesen.js liest nur auf einen Tipp vor (knopf, sprich, stopp) und hält beim Verlassen der Seite an",
    /window\.LernappVorlesen = \{ kann, knopf, sprich, stopp, sauber, zustand \}/.test(v) && /addEventListener\("pagehide", stopp\)/.test(v));
  pruefe("vorlesen.js spricht auf Deutsch und hat Auswege: erst die deutsche Stimme, dann nur die Sprache, dann die des Geräts",
    /a\.lang = stimme\.lang; a\.voice = stimme;/.test(v) && /a\.lang = "de-DE";/.test(v) && /weg \+ 1 < liste\.length/.test(v));
  pruefe("vorlesen.js bricht nur ab, was läuft, und wartet danach kurz (Android verschluckt sonst das Nächste)",
    /if \(!laeuft\) return;/.test(v) && /250 - \(Date\.now\(\) - abgebrochenUm\)/.test(v));
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
pruefe(`netlify/edge-functions/turnier-vorschau.js liest aus ${PROJEKT}`,
  lies("netlify/edge-functions/turnier-vorschau.js").includes(`const PROJEKT = "${PROJEKT}";`));
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
// Namen ändern nimmt alles mit: Umbenannt wird auf dem Server, unter der
// Kennung und unter dem alten Namen, dazu in den Turnieren des Geräts. Der
// neue Name gilt auf dem Gerät sofort; das Umbenennen wartet als Auftrag,
// bis das Netz es zulässt – und bis dahin holt der Abgleich den alten Namen
// nicht zurück.
pruefe("Namen ändern gilt sofort und benennt danach alles um, auch in den Turnieren",
  /async function namenAendern[\s\S]*?merkeUmbenennen\(auftrag\)[\s\S]*?setzeName\(neu\)/.test(miniJs)
  && /function sendeUmbenennen[\s\S]*?cloud\(\)\.benenneUm\(\{[\s\S]*?alt:[\s\S]*?turnierIds/.test(miniJs)
  && /function uebernimmName[\s\S]*?umbenennenWartet\(\)\.some/.test(miniJs)
  && /function umzubenennen[\s\S]*?where\("name", "==", vorher\)/.test(lies("cloud.js")));
// Jemand anderes auf demselben Gerät ist ein neuer Mitspieler.
pruefe("Jemand anderes auf dem Gerät ist ein neuer Mitspieler (eigene Kennung)",
  /function namenWechseln[\s\S]*?schreibe\(ID_KEY, neueKennung\(\)\)/.test(miniJs));
// Eine Runde schreibt den Namen eines Eintrags nicht zurück – sonst holte ein
// zweites Gerät mit dem alten Namen ihn Spiel für Spiel wieder.
pruefe("Eine Runde ändert den Namen eines Eintrags nicht (speichere)",
  /const hiess = alt \? alt\.name : wie;/.test(lies("cloud.js")));
pruefe("Was der Server über den eigenen Namen sagt, gilt (gleicheAb, melde, Startseite)",
  /function gleicheAb[\s\S]*?uebernimmName\(/.test(miniJs) && /async function melde[\s\S]*?uebernimmName\(/.test(miniJs)
  && /uebernimmName\(alle\);/.test(miniJs));
pruefe("Ein Gerät folgt dem Umzug seiner Kennung – nur nicht mitten im Turnier oder Multiplayer",
  /function folgeUmzug[\s\S]*?inTurnierOderLive\(\)/.test(miniJs) && /function stammKennung[\s\S]*?folgeUmzug\(\)/.test(miniJs));
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
// Ohne Netz: Eine Runde wartet auf dem Gerät und geht hinaus, sobald das Netz
// zurück ist – mit ihrer Uhrzeit, und die Regeln lassen das zu.
pruefe("Eine Runde ohne Netz wartet auf dem Gerät (melde, ohneNetzMerken)",
  /async function melde[\s\S]*?ohneNetzMerken\(/.test(miniJs) && /function istNetzfehler/.test(miniJs));
pruefe("Wartende Runden gehen hinaus, sobald das Netz zurück ist",
  /window\.addEventListener\("online", hinaus\)/.test(miniJs) && /function sendeWartende[\s\S]*?offline: !runde\.sofort/.test(miniJs));
// Im Turnier wartet das Spiel auf keine Datenbank: Der Versuch steht zuerst
// im Postausgang auf dem Gerät (turnier.js), und Turnier- und Spielseite
// zeichnen sofort aus dem, was das Gerät gemerkt hat.
pruefe("Ein Versuch im Turnier steht zuerst im Postausgang (turnier.js, rundeBeginnt)",
  /function rundeBeginnt[\s\S]*?postBeginne\(/.test(lies("turnier.js")) && /async function postRunde[\s\S]*?turnierVersuch[\s\S]*?turnierErgebnis/.test(lies("turnier.js")));
pruefe("Turnier- und Spielseite zeichnen aus dem Gedächtnis (gemerkterStand)",
  /function turnierSeite[\s\S]*?gemerkterStand\(id\)/.test(lies("turnier.js")) && /function ladeSpielseite[\s\S]*?gemerkterStand\(hier\.id\)/.test(lies("turnier.js")));
pruefe("Die Turnierseite hört dem Turnier zu, statt es bei jeder Runde neu zu lesen (cloud.js, turnierHoeren)",
  /function turnierHoeren[\s\S]*?onSnapshot/.test(lies("cloud.js")) && /wolke\.turnierHoeren\(id/.test(lies("turnier.js")));
pruefe("Live-Proben gehen nur hinaus, wenn jemand zuschaut (geist.js, mitschauenWecken)",
  /function mitschauenWecken/.test(lies("geist.js")) && /if \(!mitschauen\.wach\)/.test(lies("geist.js")));
pruefe("Der Service Worker holt höchstens ein paar Dateien auf einmal",
  /const GLEICHZEITIG = \d+;/.test(lies("service-worker.js")) && !/Promise\.allSettled\(\[\s*\.\.\.CORE_ASSETS/.test(lies("service-worker.js")));
pruefe("Die Listen ohne Netz zeigen, was das Gerät zuletzt gesehen hat",
  /async function alleErgebnisse[\s\S]*?gemerkteListen\([\s\S]*?mitWartenden\(/.test(miniJs)
  && /metadata\?\.fromCache/.test(lies("cloud.js")));
pruefe("Die Regeln lassen eine Runde ohne Netz bis 30 Tage zurück zu",
  /function ohneNetzGespielt[\s\S]*?2592000000/.test(lies("firestore.rules")) && /"quelle", "offline"\]/.test(lies("firestore.rules")));
// Die Gesamtwertung: Duelle statt Siege, damit mehr Spiele keinen Vorteil
// bringen – und die Zahl der Runden steht nirgends.
pruefe("Die Gesamtwertung zählt gewonnene Duelle, mit Ausgleich",
  /function gesamtwertung[\s\S]*?gewonnen: hinten \+ gleich \/ 2[\s\S]*?AUSGLEICH \/ 2/.test(miniJs));
pruefe("Die Gesamtwertung zählt die Spiele der Startseite, ohne Tiers",
  /function gesamtTafel\(alle, offen\) \{[\s\S]*?gesamtwertung\(alle, offen\)/.test(miniJs)
  && !/function gesamtTafel[\s\S]*?function spielerKarte/.exec(miniJs)?.[0].includes("tierVon"));
pruefe("Die Karte eines Spielers zeigt «am meisten gespielt» ohne Zahl",
  /function spielerKarte[\s\S]*?mini-profil-oft[\s\S]*?--wie-oft/.test(miniJs));
pruefe("Der Adminbereich führt einen Namen von mehreren Geräten zusammen",
  /async function fuehreZusammen[\s\S]*?mini\(\)\?\.stammVon\?\.\(/.test(lies("admin.js")));
// Bevor ein Eintrag verschwindet, steht fest, wohin es für sein Gerät geht.
pruefe("Zusammenführen vermerkt den Umzug, bevor es löscht",
  /async function fuehreZusammen[\s\S]*?setzeUmzuege[\s\S]*?await loesche\(andere/.test(lies("admin.js")));
pruefe("Der Adminbereich führt zwei Namen zusammen: Umzug, ein Name überall, je Spiel ein Eintrag",
  /async function fuehreNamenZusammen[\s\S]*?setzeUmzuege[\s\S]*?benenneUmUeberall[\s\S]*?fuehreZusammen\(/.test(lies("admin.js")));
pruefe("Die Regeln kennen die Umzüge (miniUmzuege, schreiben nur der Admin)",
  /match \/miniUmzuege\/\{kennung\}[\s\S]*?allow create, update: if istAdmin\(\) && istUmzug/.test(lies("firestore.rules")));
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
for (const weg of ["wasfehlt", "signal", "weichen", "bremsweg", "strecke", "schleuder", "takt"]) {
  pruefe(`${weg} ist ganz weg (Seite und Skript)`, !existsSync(path.join(WURZEL, `${weg}.html`)) && !existsSync(path.join(WURZEL, `${weg}.js`)));
}
// Eisstock gibt es seit November 2026 wieder – als neues Spiel (iceStock: ein
// Schub je Bahn, auf den Zentimeter gemessen). Das alte vom Oktober 2026
// (iceStone, Seite «curling»: wischen, sechs Steine) bleibt entfernt: Seine
// Kennung, seine Seite und sein Speicherplatz kommen nicht zurück – so mischt
// sich nichts Altes unter die neuen Bestwerte.
for (const datei of ["mini-games.js", "highscore.js", "firestore.rules", "scripts/seiten-bauen.mjs", "eisstock.js"]) {
  pruefe(`${datei}: das alte Eisstock (iceStone) kommt nicht zurück`, !/iceStone|"curling"|lernapp\.eisstock"/.test(lies(datei)));
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
pruefe("Ob vorne liegt, wer spielen will, rechnet die Spielseite mit den eigenen wartenden Runden (turnier.js, rechne)",
  /function rechne\(\)[\s\S]*?mitPost\(hier\.id, hier\.liste\)[\s\S]*?alleinVorne\(rangliste\(alle, spiel\)\)/.test(lies("turnier.js")));
pruefe("Ohne Live (ohneLive) ist ein Ja oder Nein im Turnier",
  regeln.includes('d.get("ohneLive", false) is bool') && /"ohneLive"/.test(regeln.match(/hasOnly\(\["name", "beschreibung"[\s\S]*?\]\)/)?.[0] || ""));
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
  && /d\.tiers\.values\(\)\.hasOnly\(\[1, 2, 3, 4, 5\]\)/.test(regeln)
  && /const TIERS = \[1, 2, 3, 4, 5\];/.test(miniJs) && /const TIER_ZAHLEN = \[1, 2, 3, 4, 5\];/.test(lies("cloud.js"))
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
// Die Startseite (auch im Turnier) ist genau so hoch wie das Bild. Im
// Vollbild auf einem Tablet kann die Navigationsleiste darüber stehen, ohne
// dass der Browser es weiss: Die Kachelreihe unten hält dort Abstand.
pruefe("styles.css: Im Vollbild auf Touch-Geräten bleibt unter der Kachelreihe Platz für eine Navigationsleiste (--ar-unten)",
  /@media \(display-mode: fullscreen\) and \(pointer: coarse\) \{\s*\.mini-seite\.ar-seite \{ --ar-unten: max\(var\(--safe-bottom\), 64px\); \}/.test(stilCss)
  && /\.ar-auswahl \{[^}]*padding: 10px 0 calc\(10px \+ var\(--ar-unten\)\);/.test(stilCss)
  && !/\.ar-auswahl \{[^}]*var\(--safe-bottom\)/.test(stilCss));
// Dasselbe bei den Spielen zu zweit: --vr-unten statt --safe-bottom in jeder
// Rechnung, wie gross ein Brett sein darf.
pruefe("styles.css: Die Spiele zu zweit lassen im Vollbild auf Touch-Geräten unten Platz (--vr-unten) – in jeder Brett-Rechnung",
  /\.vr-seite \{[^}]*--vr-unten: var\(--safe-bottom\);/.test(stilCss)
  && /@media \(display-mode: fullscreen\) and \(pointer: coarse\) \{\s*\.vr-seite \{ --vr-unten: max\(var\(--safe-bottom\), 64px\); \}/.test(stilCss)
  && !/--vr-breite:[^;]*var\(--safe-bottom\)/.test(stilCss));
pruefe("styles.css: Schiffe versenken quer auf Tablet und Computer: die Meere nebeneinander, Namen und Knöpfe rechts",
  /@media \(min-aspect-ratio: 5\/4\) and \(min-height: 561px\) \{\s*body\[data-page="schiffe"\] \.vr-seite \{ max-width: none; \}[\s\S]*?grid-template-areas: "feld leiste" "feld satz" "feld knoepfe";/.test(stilCss));

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
pruefe(`klang.js nennt 210 Plätze (gefunden: ${plaetze.length})`, plaetze.length === 210);
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

// --- 20. Der eigene Link und die Vorschau eines Turnierlinks -----------------
// 404.html leitet einen eigenen Link (/hotdog) im Browser weiter; die Edge
// Function schreibt den Namen des Turniers in die Vorschau (WhatsApp & Co.)
// und leitet den eigenen Link schon auf dem Server weiter. Netlify gibt es
// hier nicht – also läuft die Function gegen ein nachgemachtes Firestore und
// ein nachgemachtes context.next().
{
  const weiter = lies("404.html");
  pruefe("404.html leitet einen eigenen Link auf die Turnierseite weiter",
    weiter.includes('ziel = "/turnier?t=" + weg') && weiter.includes('<base href="/" />'));
  pruefe("404.html ist nicht im Zwischenspeicher des Service Workers", !sw.includes("404.html"));
  pruefe("Die Vorschau eines Turniers wirbt nicht mehr mit «Dieselben Spiele»",
    !/Dieselben Spiele/.test(turnierHtml) && !/Dieselben Spiele/.test(weiter));

  const vorschau = await import(new URL("../netlify/edge-functions/turnier-vorschau.js", import.meta.url));
  const TURNIERE_HIER = {
    "hotdog-party-3cuwrdn6": { name: "HotDog <Party> & \"Co\"" },
    hotdog: { name: "HotDog Party", beschreibung: "Wer am meisten Würste isst, gewinnt – und zwar nicht nur einen Preis, sondern den ewigen Ruhm im ganzen Quartier und darüber hinaus, bis nächstes Jahr." },
  };
  const echtesFetch = globalThis.fetch;
  globalThis.fetch = async (adresse) => {
    const id = decodeURIComponent(String(adresse).split("/miniTurniere/")[1]?.split("?")[0] || "");
    if (id === "kaputt-123456") return new Response("{}", { status: 500 });
    const t = TURNIERE_HIER[id];
    if (!t) return new Response("{}", { status: 404 });
    const fields = { name: { stringValue: t.name } };
    if (t.beschreibung) fields.beschreibung = { stringValue: t.beschreibung };
    return new Response(JSON.stringify({ fields }), { status: 200, headers: { "content-type": "application/json" } });
  };
  const ausgeliefert = (pfad) => {
    if (pfad === "/turnier") return new Response(turnierHtml, { status: 200, headers: { "content-type": "text/html; charset=UTF-8", etag: "x" } });
    if (pfad === "/turmbau") return new Response("Turmbau", { status: 200, headers: { "content-type": "text/html" } });
    return new Response(weiter, { status: 404, headers: { "content-type": "text/html" } });
  };
  const frage = async (adresse) => {
    const url = new URL(adresse, "https://games.alae.app");
    let weiterGefragt = 0;
    const antwort = await vorschau.default(new Request(url), { next: async () => { weiterGefragt += 1; return ausgeliefert(url.pathname); } });
    return { antwort, weiterGefragt, text: antwort ? await antwort.clone().text() : "" };
  };
  const meta = (html, art) => (html.match(new RegExp(`<meta (?:property|name)="${art}" content="([^"]*)" />`)) || [])[1];
  try {
    let r = await frage("/turnier?t=hotdog-party-3cuwrdn6");
    pruefe("Vorschau: Der Titel ist der Name des Turniers (sicher maskiert)",
      meta(r.text, "og:title") === "HotDog &lt;Party&gt; &amp; &quot;Co&quot;"
      && /<title>HotDog &lt;Party&gt; &amp; &quot;Co&quot; · Turnier · arcade<\/title>/.test(r.text)
      && r.antwort.status === 200 && !r.antwort.headers.has("etag"));
    // Ohne Beschreibung steht unter dem Namen nichts – auch kein
    // «Turnier · arcade»: Wer den Link bekommt, kennt die arcade meist nicht.
    pruefe("Vorschau: Ohne Beschreibung steht unter dem Namen nichts",
      meta(r.text, "og:description") === undefined && meta(r.text, "description") === undefined && !/Turnier · arcade"/.test(r.text)
      && r.text.split("\n").length === turnierHtml.split("\n").length - 2);
    r = await frage("/turnier?t=hotdog");
    const satz = meta(r.text, "og:description") || "";
    pruefe("Vorschau: Mit Beschreibung steht nur sie darunter, gekürzt",
      meta(r.text, "og:title") === "HotDog Party" && satz.startsWith("Wer am meisten Würste isst") && satz.endsWith(" …") && satz.length <= 141
      && meta(r.text, "description") === satz);
    r = await frage("/turnier?t=gibtsnicht-123456");
    pruefe("Vorschau: Ein Turnier, das es nicht gibt, lässt die Seite, wie sie ist", r.text === turnierHtml);
    r = await frage("/turnier?t=kaputt-123456");
    pruefe("Vorschau: Antwortet Firestore nicht, kommt die Seite unverändert", r.text === turnierHtml && r.antwort.status === 200);
    r = await frage("/turnier?t=Nicht%20so");
    pruefe("Vorschau: Eine Kennung, die keine ist, fragt Firestore gar nicht", r.text === turnierHtml);
    r = await frage("/HotDog/");
    pruefe("Eigener Link: /HotDog/ geht auf dem Server weiter zum Turnier",
      r.antwort?.status === 302 && r.antwort.headers.get("location") === "https://games.alae.app/turnier?t=hotdog");
    r = await frage("/turmbau");
    pruefe("Eigener Link: Eine Seite, die es gibt, bleibt die Seite", r.antwort?.status === 200 && r.text === "Turmbau");
    r = await frage("/gibtsnicht-123456");
    pruefe("Eigener Link: Ohne Turnier bleibt es bei 404.html", r.antwort?.status === 404 && r.text === weiter);
    r = await frage("/a/b");
    pruefe("Eigener Link: Was keine Kennung sein kann, geht unberührt weiter", r.antwort === undefined && r.weiterGefragt === 0);
  } finally {
    globalThis.fetch = echtesFetch;
  }
  pruefe("Die Edge Function läuft nicht für Skripte, Stylesheets und Bilder",
    ["/*.js", "/*.css", "/icons/*", "/bilder/*"].every((p) => vorschau.config.excludedPath.includes(p)) && vorschau.config.path === "/*");
}

// --- 21. Die Spiele zu zweit (zwei.js) -----------------------------------------
// Eigene Seiten wie der Multiplayer, keine Spiele der Tabelle: keine
// Bestenliste, keine Bühne. Alle im selben Rahmen (zwei.js); gegen den
// Computer geht es ohne Netz, das Duell läuft über die Realtime Database
// (partie, partieCode, partieOffen).
{
  const zweiJs = lies("zwei.js");
  const ZWEI_IN_MINI = [...(miniJs.match(/const ZWEI_SPIELER = \[([\s\S]*?)\];/)?.[1] || "").matchAll(/\{ id: "([a-z]+)", seite: "([a-z]+)"/g)].map((m) => ({ id: m[1], seite: m[2] }));
  const ZWEI_IN_REGELN = [...(regeln.match(/function zweiSpielerSpiele\(\) \{\s*return \[([^\]]*)\];/)?.[1] || "").matchAll(/"([a-z]+)"/g)].map((m) => m[1]);
  pruefe(`Die Spiele zu zweit sind überall dieselben: seiten-bauen.mjs (${ZWEI.length}), mini-games.js (${ZWEI_IN_MINI.length}), firestore.rules (${ZWEI_IN_REGELN.length})`,
    ZWEI.length > 0 && ZWEI.length === ZWEI_IN_MINI.length && ZWEI.length === ZWEI_IN_REGELN.length
    && ZWEI.every((z, i) => ZWEI_IN_MINI[i]?.seite === z.seite && ZWEI_IN_REGELN.includes(ZWEI_IN_MINI[i]?.id)));
  for (const z of ZWEI) {
    const html = lies(`${z.seite}.html`);
    pruefe(`${z.seite}.html trägt data-page="${z.seite}" und den Platz [data-zwei]`, html.includes(`data-page="${z.seite}"`) && html.includes("data-zwei"));
    pruefe(`${z.seite}.html lädt den Rahmen vor dem Spiel, und die Realtime Database`,
      html.includes(`zwei.js?v=${FASSUNG}`) && z.js.every((d) => html.includes(`${d}?v=${FASSUNG}`))
      && html.indexOf("zwei.js?") < html.indexOf(`${z.js[0]}?`) && html.includes("firebase-database-compat.js"));
    pruefe(`${z.seite}.html lädt kein firebase-auth – wer spielt, meldet sich nicht an`, !html.includes("firebase-auth"));
    pruefe(`SW kennt ${z.seite}.html`, sw.includes(`"./${z.seite}.html"`));
    pruefe(`${z.seite} ist kein Spiel mit Bestenliste (nicht in SPIELE, nicht in miniSpiele)`,
      !SPIELE.some((x) => x.seite === z.seite) && !inRegeln.includes(ZWEI_IN_MINI.find((m) => m.seite === z.seite)?.id));
    const quelle = lies(z.js[z.js.length - 1]);
    pruefe(`${z.js[z.js.length - 1]} meldet sich beim Rahmen an (LernappZwei.starte) und baut nur auf seiner Seite`,
      /\.starte\(\{/.test(quelle) && new RegExp(`dataset\\?\\.page !== "${z.seite}"`).test(quelle));
  }
  pruefe("zwei.js zieht mit einer Transaktion (duellZug, duellNochmal)",
    /async function duellZug[\s\S]*?\/stand`\)\.transaction\(/.test(zweiJs) && /async function duellNochmal[\s\S]*?\/stand`\)\.transaction\(/.test(zweiJs));
  pruefe("zwei.js: ein Raum hat zehn Zeichen, der Code vier Ziffern",
    /const RAUM_LAENGE = 10;/.test(zweiJs) && /const CODE_MUSTER = \/\^\[0-9\]\{4\}\$\/;/.test(zweiJs));
  pruefe("zwei.js behält Turnier und «von=admin» in jeder Adresse",
    /if \(TURNIER\) p\.set\("turnier", TURNIER\);/.test(zweiJs) && /if \(VON_ADMIN\) p\.set\("von", "admin"\);/.test(zweiJs));
  pruefe("Im Turnier meldet sich, wer wartet – und die Datenbank nimmt es weg, wenn die Verbindung abreisst",
    /function offenMelden[\s\S]*?onDisconnect\(\)\.remove\(\)/.test(zweiJs) && /function offenWeg/.test(zweiJs));
  // Auf der Startseite nur, was der Admin für die Hall of Fame angehakt hat
  // (config/miniGames, zweiSpieler) – im Turnier, was er dazunimmt.
  const baueStart = miniJs.match(/async function baueUebersicht[\s\S]*?\n  \}\n/)?.[0] || "";
  pruefe("Die Startseite zeigt die Spiele zu zweit nur, wenn sie für die Hall of Fame angehakt sind (zweiSpieler)",
    /const zweiVersprechen = zweiSpielerOffen\(\);/.test(baueStart) && /\(await zweiVersprechen\)\.forEach\(\(id\) => \{ const k = zweiKachel\(id\);/.test(baueStart)
    && /async function offeneZweiSpieler/.test(lies("cloud.js")) && /async function setzeZweiSpieler/.test(lies("cloud.js")));
  pruefe("Die Regeln kennen die Spiele zu zweit auf der Startseite (zweiSpieler, nicht in miniSpiele)",
    /"zweiSpieler"/.test(regeln.match(/function istSpieleListe[\s\S]*?hasOnly\(\[[^\]]*\]\)/)?.[0] || "")
    && /d\.zweiSpieler\.hasOnly\(zweiSpielerSpiele\(\)\)/.test(regeln));
  const adminVr = lies("admin.js");
  pruefe("Der Adminbereich hat unter den Tiers «2 Spieler» – bei den Spielen (Startseite) und im Turnierformular, für jedes Spiel zu zweit",
    /function zweiZeile\(/.test(adminVr) && /bereich\.inhalt\.append\(filter\.leiste, summe, meldung, gitter, knoepfe, zwei\);/.test(adminVr)
    && /spieleGruppe\.append\(zweiTitel\(/.test(adminVr) && /zweiSpieler\(\)\.forEach\(\(id\) => \{\s*const \{ zeile, box \} = zweiZeile\(/.test(adminVr)
    && /setzeZweiSpieler\(\[\.\.\.stand\.zweiOffen\]/.test(adminVr) && /zweiSpieler: zweiGewaehlt\(\),/.test(adminVr));
  pruefe("cloud.js nimmt die Spiele zu zweit aus mini-games.js (zweiSpielerIds)",
    /function zweiSpielerIds\(\)[\s\S]*?LernappMini\?\.ZWEI_SPIELER/.test(lies("cloud.js")) && !/ZWEI_SPIELER_IDS/.test(lies("cloud.js")));
  const turnierJsVr = lies("turnier.js");
  pruefe("Die Turnierseite stellt die Spiele zu zweit hin: ein Register «Allein» / «Zu zweit», darunter grosse Karten statt der Bühne",
    /href = turnierId \? `\/\$\{spiel\.seite\}\?turnier=\$\{encodeURIComponent\(turnierId\)\}`/.test(miniJs)
    && /reiterZeichnen\(spiele\.length, zwei\.length\);/.test(turnierJsVr)
    && /const karten = zwei\.length > 0 && \(!spiele\.length \|\| reiterWahl === "zwei"\);/.test(turnierJsVr)
    && /m\.zweiKachel\?\.\(id, t\.id, \{ gross: true \}\)/.test(turnierJsVr) && !/\n\s+vorne,\n/.test(turnierJsVr));
  pruefe("Die Karten zu zweit im Turnier: ein Raster, Zeilen so hoch wie die Karten, oben beginnt es mit dem ersten Spiel",
    /\.tn-zwei-karten \{[^}]*grid-auto-rows: max-content;[^}]*align-content: safe center;/.test(css));
  pruefe("Die Turnierseite fragt, wer wartet – bei welchem Spiel (cloud.js, offeneDuelle, partieOffen)",
    /async function offeneDuelle\(turnierId\)[\s\S]*?partieOffen\//.test(lies("cloud.js")) && /offeneDuelle\?\.\(t\.id\)/.test(turnierJsVr)
    && /wartet bei \$\{spiel\.titel\}/.test(turnierJsVr));
  pruefe("Die Turnier-App lässt ein Spiel zu zweit aus dem Turnier zu, und der Weg zurück führt ins Turnier",
    /\(zweiHier\(\) && p\.has\("turnier"\)\)/.test(turnierJsVr) && /if \(!spielHier\(\) && !zweiHier\(\)\) return null;/.test(turnierJsVr));
  pruefe("Turniere mit Spielen zu zweit: Regel, Formular und cloud.js kennen zweiSpieler (und viererreihe von vorher)",
    /d\.get\("viererreihe", false\) is bool/.test(regeln) && /d\.get\("zweiSpieler", \[\]\)\.hasOnly\(zweiSpielerSpiele\(\)\)/.test(regeln)
    && /"zweiSpieler"/.test(regeln.match(/hasOnly\(\["name", "beschreibung"[\s\S]*?\]\)/)?.[0] || "")
    && /\(d\.spiele\.size\(\) > 0 \|\| d\.get\("viererreihe", false\) == true \|\| d\.get\("zweiSpieler", \[\]\)\.size\(\) > 0\)/.test(regeln)
    && /if \(zwei\.length\) doc\.zweiSpieler = zwei;/.test(lies("cloud.js")));
  const partie = liveRegeln?.partie?.$raum;
  pruefe("Die Regeln kennen die Partie: lesen mit dem Raum, kein Auflisten, nichts Fremdes",
    Boolean(partie) && /\{10\}/.test(partie[".read"] || "") && liveRegeln?.partie?.[".read"] === undefined && partie.$anderes?.[".validate"] === false);
  pruefe("Die Regeln lassen am Stand nur mehr Züge oder eine neue Partie zu",
    /beginsWith\(data\.child\('zuege'\)\.val\(\)\)/.test(partie?.stand?.[".validate"] || "") && /newData\.exists\(\)/.test(partie?.stand?.[".write"] || ""));
  pruefe("Die Regeln: Ist b besetzt, kommt niemand mehr dazu",
    /data\.child\('kennung'\)\.val\(\) == newData\.child\('kennung'\)\.val\(\)/.test(partie?.b?.[".write"] || ""));
  pruefe("Die Regeln: Ein Code gilt höchstens drei Stunden und führt zu einem Raum, den es gibt, mit seinem Spiel",
    /now \+ 10800000/.test(liveRegeln?.partieCode?.$code?.bis?.[".validate"] || "") && /child\('a'\)\.exists\(\)/.test(liveRegeln?.partieCode?.$code?.raum?.[".validate"] || "")
    && /child\('info'\)\.child\('spiel'\)/.test(liveRegeln?.partieCode?.$code?.spiel?.[".validate"] || ""));
  const offenRegel = liveRegeln?.partieOffen?.$turnier;
  pruefe("Die Regeln der Wartenden: lesen je Turnier, eintragen nur für den eigenen Raum, solange er nicht voll ist",
    /\{6,48\}/.test(offenRegel?.[".read"] || "") && liveRegeln?.partieOffen?.[".read"] === undefined
    && /child\('b'\)\.exists\(\)/.test(offenRegel?.$raum?.[".write"] || "") && /child\('kennung'\)\.val\(\)/.test(offenRegel?.$raum?.[".validate"] || ""));
  pruefe("Die alten Pfade des Duells (duell, duellCode, duellOffen) sind weg", !liveRegeln?.duell && !liveRegeln?.duellCode && !liveRegeln?.duellOffen);

  // Jedes Spiel zu zweit, ohne Browser: Sein Skript meldet sich beim Rahmen
  // an (LernappZwei.starte) – mit allem, was zwei.js von ihm braucht. Und die
  // Kachel auf der Startseite hat ein Bild.
  const angemeldet = {};
  const FESTER_ZUFALL = ["bohnen", "wolf", "ratetier", "brueckenschlag", "kippen"];
  const kunst = miniJs.match(/const ZWEI_KUNST = \{([\s\S]*?)\n  \};/)?.[1] || "";
  for (const z of ZWEI) {
    const id = ZWEI_IN_MINI.find((m) => m.seite === z.seite)?.id;
    const kasten = { window: {}, document: { body: { dataset: { page: z.seite } } } };
    // Malen merkt sich die Wörter der letzten Partien: dafür ein Speicher.
    if (z.seite === "malen") { const m = new Map(); kasten.localStorage = { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)) }; }
    kasten.window.LernappZwei = { starte: (spiel) => { angemeldet[z.seite] = spiel; }, el: () => ({}), anderer: (s) => (s === "a" ? "b" : "a") };
    // Die neueren Spiele lassen unten den Computer gegen den Computer spielen
    // und zählen Siege: mit festem Zufall, damit jeder Lauf gleich ausgeht.
    if (FESTER_ZUFALL.includes(z.seite)) vm.runInNewContext("Math.random = (() => { let t = 20261125; return () => { t = (Math.imul(t, 1103515245) + 12345) >>> 0; return t / 4294967296; }; })();", kasten);
    try { for (const d of z.js) vm.runInNewContext(lies(d), kasten); } catch { /* fehlt dann unten */ }
    const sp = angemeldet[z.seite];
    pruefe(`${z.seite}: meldet sich mit Id, Seite, Regeln (lage, darf), Brett und Bild an – und mit einem Computer, wenn es Stufen gibt`,
      Boolean(sp) && sp.id === id && sp.seite === z.seite && sp.titel === z.titel
      && ["lage", "darf", "brett", "held"].every((k) => typeof sp[k] === "function")
      && (!sp.stufen || (typeof sp.computer === "function" && Object.keys(sp.stufen).length > 0)));
    pruefe(`${z.seite}: die Kachel auf der Startseite hat ein Bild (mini-games.js, ZWEI_KUNST)`, new RegExp(`\\n    ${id}\\(bild\\) \\{`).test(`\n${kunst}`));
  }

  // Tic Tac Toe: die Regeln, und der Computer auf «schwer» verliert nie.
  const T = angemeldet.tictactoe;
  if (T) {
    const lage = (roh, beginnt = "a") => T.lage([...roh], { roh, beginnt, saat: 1 });
    pruefe("Tic Tac Toe: drei waagrecht, senkrecht und in beiden Schrägen gewinnen",
      lage("03142").ende === "a" && lage("012437").ende === "b" && lage("01428").ende === "a" && lage("20416", "b").ende === "b");
    pruefe("Tic Tac Toe: Die Siegerreihe steht in der Lage", JSON.stringify(lage("01428").reihe) === "[0,4,8]");
    pruefe("Tic Tac Toe: Ein volles Brett ohne Reihe ist unentschieden, vorher ist jemand dran",
      lage("012436758").ende === "u" && lage("0314").ende === null && lage("0314").dran === "a" && lage("031", "b").dran === "a");
    pruefe("Tic Tac Toe: nur ein freies Feld, nur wer dran ist, nicht nach dem Ende",
      T.darf(lage("0"), "1", "b") && !T.darf(lage("0"), "0", "b") && !T.darf(lage("0"), "1", "a")
      && !T.darf(lage("03142"), "5", "b") && !T.darf(lage(""), "9", "a") && !T.darf(lage(""), "", "a"));
    pruefe("Tic Tac Toe: Ein Zug auf ein besetztes Feld macht die Partie nicht weiter", lage("00").dran === null);
    pruefe("Tic Tac Toe: Mittel und Schwer nehmen den Sieg vor dem Aufhalten",
      T.computer(lage("03148"), "b", "mittel") === "5" && T.computer(lage("03148"), "b", "schwer") === "5");
    pruefe("Tic Tac Toe: Mittel und Schwer halten eine Drohung auf",
      T.computer(lage("041"), "b", "mittel") === "2" && T.computer(lage("041"), "b", "schwer") === "2");
    let partien = 0;
    let verloren = 0;
    let falsch = 0;
    const spiele = (roh, beginnt) => {
      const l = lage(roh, beginnt);
      if (l.ende) { partien += 1; if (l.ende === "a") verloren += 1; return; }
      if (l.dran === "b") {
        const zuege = roh === "" ? ["0", "2", "4", "6", "8"] : [T.computer(l, "b", "schwer")];
        for (const z of zuege) { if (!T.darf(l, z, "b")) { falsch += 1; return; } spiele(roh + z, beginnt); }
        return;
      }
      for (let f = 0; f < 9; f += 1) if (!l.brett[f]) spiele(roh + f, beginnt);
    };
    spiele("", "a");
    spiele("", "b");
    pruefe(`Tic Tac Toe: Schwer verliert keine einzige von ${partien} möglichen Partien, ob er beginnt oder nicht (${verloren} verloren, ${falsch} falsche Züge)`,
      partien > 500 && verloren === 0 && falsch === 0);
    let legal = true;
    for (const stufe of Object.keys(T.stufen)) {
      for (let p = 0; p < 40 && legal; p += 1) {
        let roh = "";
        const beginnt = p % 2 ? "a" : "b";
        for (let l = lage(roh, beginnt); !l.ende; l = lage(roh, beginnt)) {
          const z = l.dran === "b" ? T.computer(l, "b", stufe) : String(l.brett.findIndex((x) => !x));
          if (!T.darf(l, z, l.dran)) { legal = false; break; }
          roh += z;
        }
      }
    }
    pruefe("Tic Tac Toe: Jede Stufe setzt in 40 Partien nur auf freie Felder", legal);
  }

  // Schiffe versenken: die Regeln an einer kleinen Partie, und ganze Partien
  // Computer gegen Computer – mit Antworten aus einer Flotte, die nur das
  // Gerät kennt (auto). Ohne Speicher (hier gibt es kein localStorage) legt
  // sich das Gerät bei jeder Antwort eine Flotte hin, die zu allen bisherigen
  // passt: Auch so muss jede Antwort erlaubt sein.
  const SV = angemeldet.schiffe;
  if (SV) {
    const lage = (zuege, beginnt = "a") => SV.lage(zuege, { roh: zuege.join("."), beginnt, saat: 1 });
    const l0 = lage([]);
    pruefe("Schiffe versenken: Zuerst verstecken beide ihre Schiffe – jede meldet sich selbst bereit",
      l0.phase === "aufstellen" && l0.dran === "beide" && SV.darf(l0, "Ba", "a") && !SV.darf(l0, "Bb", "a")
      && !SV.darf(lage(["Ba"]), "Ba", "a") && SV.darf(lage(["Ba"]), "Bb", "b") && lage(["Bb", "Ba"], "b").dran === "b");
    const l1 = lage(["Ba", "Bb"]);
    pruefe("Schiffe versenken: Sind beide bereit, schiesst, wer beginnt – nur aufs Meer, nur einmal je Feld",
      l1.phase === "schiessen" && l1.dran === "a" && SV.darf(l1, "S0", "a") && SV.darf(l1, "S63", "a")
      && !SV.darf(l1, "S64", "a") && !SV.darf(l1, "S0", "b") && !SV.darf(l1, "S07", "a")
      && !SV.darf(lage(["Ba", "Bb", "S5", "T"]), "S5", "a"));
    const l2 = lage(["Ba", "Bb", "S0", "W"]);
    const l3 = lage(["Ba", "Bb", "S0", "W", "S9", "T"]);
    pruefe("Schiffe versenken: Wasser – der andere ist dran; Treffer – nochmal",
      l2.dran === "b" && l2.schuesse.a[0] === "W" && l3.dran === "b" && l3.schuesse.b[9] === "T" && l3.letzter?.ergebnis === "T");
    const l4 = lage(["Ba", "Bb", "S0", "W", "S9", "T", "S10"]);
    pruefe("Schiffe versenken: Auf einen Schuss antwortet, wer beschossen wird – versenkt nur ein ganzes, gerades Schiff aus Treffern",
      l4.phase === "antwort" && l4.dran === "a" && SV.darf(l4, "W", "a") && !SV.darf(l4, "W", "b")
      && SV.darf(l4, "V9,10", "a") && !SV.darf(l4, "V10,11", "a") && !SV.darf(l4, "V2,10", "a") && !SV.darf(l4, "V10", "a"));
    const l5 = lage(["Ba", "Bb", "S0", "W", "S9", "T", "S10", "V9,10", "S20", "T", "S21"]);
    pruefe("Schiffe versenken: Ein versenktes Schiff zählt, und eines, das es nicht mehr gibt, lässt sich nicht noch einmal versenken",
      l5.versenkt.b.length === 1 && JSON.stringify(l5.versenkt.b[0]) === "[9,10]" && l5.schuesse.b[9] === "V"
      && !SV.darf(l5, "V20,21", "a") && SV.darf(l5, "T", "a"));
    pruefe("Schiffe versenken: Ein Zug, der nicht passt, macht die Partie nicht weiter",
      lage(["Ba", "Ba"]).dran === null && lage(["Ba", "Bb", "S0", "X"]).dran === null && lage(["S0"]).dran === null);
    // Ganze Partien: Computer gegen Computer, a antwortet von selbst.
    let gut = 0;
    let siegeSchwer = 0;
    let fehler = "";
    const STUFEN_SV = Object.keys(SV.stufen || {});
    for (let p = 0; p < 24 && !fehler; p += 1) {
      const sa = p < 4 ? STUFEN_SV[p] : "leicht";
      const sb = p < 4 ? STUFEN_SV[3 - p] : "schwer";
      const beginnt = p % 2 ? "b" : "a";
      const zuege = [];
      let l = lage(zuege, beginnt);
      for (let i = 0; i < 1500 && !l.ende && !fehler; i += 1) {
        const wer = l.dran === "beide" ? (l.bereit.a ? "b" : "a") : l.dran;
        let zug;
        if (l.phase === "aufstellen") zug = `B${wer}`;
        else if (wer === "a") zug = SV.auto(l, "a", { raum: `p${p}`, nr: 0 }) || SV.computer(l, "a", sa, { saat: 7 + p });
        else zug = SV.computer(l, "b", sb, { saat: 1000 + p });
        if (zug && typeof zug === "object") zug = zug.zug;
        if (!SV.darf(l, zug, wer)) fehler = `${zug} von ${wer} (${l.phase}) nach ${zuege.slice(-4).join(".")}`;
        zuege.push(zug);
        l = lage(zuege, beginnt);
      }
      if (l.ende && l.flotte[l.ende] && zuege.join(".").length < 2000) gut += 1;
      if (p >= 4 && l.ende === "b") siegeSchwer += 1;
    }
    pruefe(`Schiffe versenken: 24 Partien Computer gegen Computer, jede Stufe – jeder Zug erlaubt, jede Partie zu Ende, der Sieger zeigt seine Flotte (${gut}/24${fehler ? `, ${fehler}` : ""})`,
      gut === 24 && !fehler);
    pruefe(`Schiffe versenken: «Schwer» schlägt «Ganz leicht» fast immer (${siegeSchwer} von 20)`, siegeSchwer >= 15);
  }

  // Käsekästchen: wer die vierte Seite zieht, bekommt das Kästchen und zieht
  // nochmal; am Ende zählen die Kästchen. Und der Computer zieht auf jeder
  // Stufe nur, was erlaubt ist.
  const KK = angemeldet.kaesekaestchen;
  if (KK) {
    const lage = (zuege, beginnt = "a") => KK.lage(zuege, { roh: zuege.join("."), beginnt, saat: 1 });
    // Kästchen 0: oben 0, unten 4, links 20, rechts 21.
    const k1 = lage(["0", "20", "4"]);
    const k2 = lage(["0", "20", "4", "21"]);
    pruefe("Käsekästchen: Wer die vierte Seite zieht, bekommt das Kästchen und zieht nochmal",
      k1.dran === "b" && k1.besitz[0] === "" && k2.besitz[0] === "b" && k2.punkte.b === 1 && k2.dran === "b" && k2.nochmal === true);
    pruefe("Käsekästchen: Ein Strich zwischen zwei Kästchen kann beide schliessen",
      (() => { const l = lage(["0", "20", "4", "1", "22", "5", "21"]); return l.besitz[0] === "a" && l.besitz[1] === "a" && l.punkte.a === 2 && l.dran === "a"; })());
    pruefe("Käsekästchen: nur ein freier Strich, nur wer dran ist",
      KK.darf(lage([]), "0", "a") && KK.darf(lage([]), "39", "a") && !KK.darf(lage([]), "40", "a") && !KK.darf(lage([]), "05", "a")
      && !KK.darf(lage([]), "0", "b") && !KK.darf(lage(["0"]), "0", "b") && lage(["0", "0"]).dran === null);
    // Ganze Partien: zufällig (mit Saat), bis ein Unentschieden dabei ist –
    // und Computer gegen Computer auf jeder Stufe.
    let zufall = 4242;
    const wuerfel = () => { zufall = (Math.imul(zufall, 1103515245) + 12345) >>> 0; return zufall / 4294967296; };
    let remis = null;
    let ausgang = true;
    for (let p = 0; p < 400 && !remis; p += 1) {
      const zuege = [...Array(40).keys()].map(String).sort(() => wuerfel() - 0.5);
      const l = lage(zuege);
      if (!l.ende || l.punkte.a + l.punkte.b !== 16 || l.ende !== (l.punkte.a > l.punkte.b ? "a" : l.punkte.b > l.punkte.a ? "b" : "u")) ausgang = false;
      if (l.ende === "u") remis = l;
    }
    pruefe("Käsekästchen: Sind alle 40 Striche gezogen, ist die Partie aus – 16 Kästchen verteilt, wer mehr hat, gewinnt", ausgang);
    pruefe("Käsekästchen: Acht zu acht ist unentschieden", remis?.punkte.a === 8 && remis?.punkte.b === 8);
    let legal = true;
    let schwerSiegt = 0;
    const STUFEN_KK = Object.keys(KK.stufen || {});
    for (let p = 0; p < 24 && legal; p += 1) {
      const sa = p < 8 ? STUFEN_KK[p % 4] : "mittel";
      const sb = p < 8 ? STUFEN_KK[3 - (p % 4)] : "schwer";
      const zuege = [];
      const beginnt = p % 2 ? "b" : "a";
      for (let l = lage(zuege, beginnt); !l.ende; l = lage(zuege, beginnt)) {
        const z = KK.computer(l, l.dran, l.dran === "a" ? sa : sb);
        if (!KK.darf(l, z, l.dran)) { legal = false; break; }
        zuege.push(z);
      }
      if (p >= 8 && lage(zuege, beginnt).ende === "b") schwerSiegt += 1;
    }
    pruefe("Käsekästchen: Jede Stufe zieht nur freie Striche, bis die Partie aus ist", legal);
    pruefe(`Käsekästchen: «Schwer» schlägt «Mittel» meistens (${schwerSiegt} von 16)`, schwerSiegt >= 10);
  }

  // Mühle: setzen, Mühle schliessen und nehmen (nicht aus einer Mühle),
  // ziehen, springen, verlieren – an kurzen Folgen und ganzen Partien.
  const MH = angemeldet.muehle;
  if (MH) {
    const lage = (zuege, beginnt = "a") => MH.lage(zuege, { roh: zuege.join("."), beginnt, saat: 1 });
    const m1 = lage(["0", "8", "1", "9"]);
    pruefe("Mühle: Wer eine Mühle schliesst, muss einen Stein nehmen",
      m1.dran === "a" && !MH.darf(m1, "2", "a") && MH.darf(m1, "2x8", "a") && MH.darf(m1, "2x9", "a") && MH.darf(m1, "3", "a") && !MH.darf(m1, "3x8", "a"));
    const m2 = lage(["0", "8", "1", "9", "2x8"]);
    pruefe("Mühle: Der genommene Stein ist weg, die Hand zählt mit",
      m2.brett[8] === "" && m2.brett[2] === "a" && m2.hand.a === 6 && m2.hand.b === 7 && m2.dran === "b");
    const m3 = lage(["0", "8", "1", "9", "16", "10x16", "3", "20"]);
    pruefe("Mühle: Aus einer Mühle darf man nicht nehmen – ausser alle stehen in Mühlen",
      MH.darf(m3, "2x20", "a") && !MH.darf(m3, "2x8", "a") && !MH.darf(m3, "2x9", "a")
      && MH.darf(lage(["0", "8", "1", "9", "16", "10x16"]), "2x8", "a"));
    pruefe("Mühle: Gesetzt wird nur auf freie Punkte, nur wer dran ist",
      !MH.darf(lage(["0"]), "0", "b") && MH.darf(lage(["0"]), "8", "b") && !MH.darf(lage(["0"]), "8", "a") && !MH.darf(lage([]), "24", "a")
      && !MH.darf(lage([]), "3-4", "a") && lage(["0", "0"]).dran === null);
    // Ganze Partien: jede Stufe gegen jede leichtere – alles erlaubt, jede
    // Partie zu Ende (verloren mit zwei Steinen, ohne Zug, oder 60 Züge
    // ohne Nehmen), und unterwegs wird gezogen und gesprungen.
    let legal = true;
    let zuEnde = 0;
    let gezogen = 0;
    let gesprungen = 0;
    let siegeEinfach = 0;
    for (let p = 0; p < 12 && legal; p += 1) {
      const sa = p < 8 ? "einfach" : "leicht";
      const sb = p < 8 ? "leicht" : "leicht";
      const beginnt = p % 2 ? "b" : "a";
      const zuege = [];
      let l = lage(zuege, beginnt);
      while (!l.ende && zuege.length < 500) {
        const z = MH.computer(l, l.dran, l.dran === "a" ? sa : sb);
        if (!MH.darf(l, z, l.dran)) { legal = false; break; }
        if (z.includes("-")) {
          gezogen += 1;
          const [von, nach] = z.split("x")[0].split("-").map(Number);
          const nah = [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 0]].some(([x, y]) => [x, y].every((q) => [von % 8, nach % 8].includes(q)) && Math.floor(von / 8) === Math.floor(nach / 8))
            || (von % 8 === nach % 8 && von % 2 === 1 && Math.abs(Math.floor(von / 8) - Math.floor(nach / 8)) === 1);
          if (!nah) gesprungen += 1;
        }
        zuege.push(z);
        l = lage(zuege, beginnt);
      }
      if (l.ende) zuEnde += 1;
      if (p < 8 && l.ende === "a") siegeEinfach += 1;
    }
    pruefe(`Mühle: 12 Partien Computer gegen Computer – jeder Zug erlaubt, jede zu Ende, gezogen und gesprungen (${zuEnde}/12, ${gezogen} gezogen, ${gesprungen} gesprungen)`,
      legal && zuEnde === 12 && gezogen > 0 && gesprungen > 0);
    pruefe(`Mühle: «Einfach» schlägt «Ganz leicht» meistens (${siegeEinfach} von 8)`, siegeEinfach >= 6);
  }

  // Schach: der Zuggenerator gegen die bekannten Zahlen (Perft), und die
  // Regeln an kurzen Partien – Matt, Patt, Rochade, en passant,
  // Umwandlung, Wiederholung, zu wenig Material.
  const SC = angemeldet.schach;
  if (SC?.fuerPruefung) {
    const I = SC.fuerPruefung;
    const perft = (st, d) => {
      if (d === 0) return 1;
      let n = 0;
      for (const z of I.legaleZuege(st)) { const v = I.ziehe(st, z); n += perft(st, d - 1); I.zurueck(st, z, v); }
      return n;
    };
    pruefe("Schach: Perft – vom Start 20, 400, 8902 Stellungen",
      perft(I.neueStellung(), 1) === 20 && perft(I.neueStellung(), 2) === 400 && perft(I.neueStellung(), 3) === 8902);
    pruefe("Schach: Perft – «Kiwipete» (Rochaden, en passant, Umwandlungen) 48 und 2039",
      perft(I.ausFen("r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1"), 1) === 48
      && perft(I.ausFen("r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1"), 2) === 2039);
    pruefe("Schach: Perft – Stellung 3 (en passant mit Fesselung) 14, 191, 2812",
      perft(I.ausFen("8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1"), 3) === 2812);
    const lage = (zuege, beginnt = "a") => SC.lage(zuege, { roh: zuege.join("."), beginnt, saat: 1 });
    const schaefer = ["e2e4", "e7e5", "d1h5", "b8c6", "f1c4", "g8f6", "h5f7"];
    const matt = lage(schaefer);
    pruefe("Schach: Schäfermatt – Weiss (wer beginnt) gewinnt, der König steht im Schach",
      matt.ende === "a" && matt.grund === "matt" && matt.schach === true && lage(schaefer, "b").ende === "b");
    const loyd = ["e2e3", "a7a5", "d1h5", "a8a6", "h5a5", "h7h5", "h2h4", "a6h6", "a5c7", "f7f6", "c7d7", "e8f7", "d7b7", "d8d3", "b7b8", "d3h7", "b8c8", "f7g6", "c8e6"];
    const patt = lage(loyd);
    pruefe("Schach: Patt nach zehn Zügen (Sam Loyd) – unentschieden", patt.ende === "u" && patt.grund === "patt");
    const roch = lage(["e2e4", "e7e5", "g1f3", "b8c6", "f1c4", "g8f6"]);
    const nachRoch = lage(["e2e4", "e7e5", "g1f3", "b8c6", "f1c4", "g8f6", "e1g1"]);
    pruefe("Schach: Rochade – König zwei Felder, der Turm springt über",
      roch.legal.includes("e1g1") && nachRoch.brett[62] === 6 && nachRoch.brett[61] === 4 && nachRoch.brett[63] === 0 && nachRoch.brett[60] === 0);
    pruefe("Schach: Keine Rochade durch ein angegriffenes Feld",
      !lage(["e2e4", "e7e5", "g1f3", "b8c6", "f1c4", "f8c5", "d2d3", "c5g1"]).legal.includes("e1g1"));
    const ep = lage(["e2e4", "a7a6", "e4e5", "d7d5"]);
    const nachEp = lage(["e2e4", "a7a6", "e4e5", "d7d5", "e5d6"]);
    pruefe("Schach: en passant – nur gleich danach, und der Bauer ist weg",
      ep.legal.includes("e5d6") && nachEp.brett[27] === 0 && nachEp.brett[19] === 1
      && !lage(["e2e4", "a7a6", "e4e5", "d7d5", "a2a3", "h7h6"]).legal.includes("e5d6"));
    const um = lage(["a2a4", "b7b5", "a4b5", "a7a6", "b5a6", "c8b7", "a6b7", "b8c6"]);
    pruefe("Schach: Umwandlung – in Dame, Turm, Läufer oder Springer",
      ["b7a8q", "b7a8r", "b7a8b", "b7a8n", "b7b8q"].every((z) => um.legal.includes(z)) && !um.legal.includes("b7a8")
      && lage(["a2a4", "b7b5", "a4b5", "a7a6", "b5a6", "c8b7", "a6b7", "b8c6", "b7a8n"]).brett[0] === 2);
    const wieder = lage(["g1f3", "g8f6", "f3g1", "f6g8", "g1f3", "g8f6", "f3g1", "f6g8"]);
    pruefe("Schach: Dreimal dieselbe Stellung – unentschieden", wieder.ende === "u" && wieder.grund === "wiederholung"
      && !lage(["g1f3", "g8f6", "f3g1", "f6g8"]).ende);
    pruefe("Schach: Zu wenig Material für ein Matt",
      I.zuWenig(I.ausFen("8/8/8/4k3/8/8/8/4K3 w - - 0 1").b) && I.zuWenig(I.ausFen("8/8/8/4k3/8/8/8/4KN2 w - - 0 1").b)
      && !I.zuWenig(I.ausFen("8/8/8/4k3/8/8/8/4KR2 w - - 0 1").b) && !I.zuWenig(I.ausFen("8/8/8/4k3/8/8/4P3/4K3 w - - 0 1").b));
    pruefe("Schach: Nur wer am Zug ist, nur erlaubte Züge",
      SC.darf(lage([]), "e2e4", "a") && !SC.darf(lage([]), "e2e4", "b") && !SC.darf(lage([]), "e2e5", "a")
      && !SC.darf(lage(["e2e4"]), "e7e5", "a") && SC.darf(lage(["e2e4"]), "e7e5", "b") && lage(["e2e5"]).dran === null);
    const vorMatt = lage(schaefer.slice(0, 6));
    pruefe("Schach: «Mittel» und «Schwer» sehen ein Matt in einem Zug",
      SC.computer(vorMatt, "a", "mittel") === "h5f7" && SC.computer(vorMatt, "a", "schwer") === "h5f7");
    let legal = true;
    for (const stufe of ["leicht", "einfach"]) {
      const zuege = [];
      for (let l = lage(zuege); !l.ende && zuege.length < 40; l = lage(zuege)) {
        const z = SC.computer(l, l.dran, stufe);
        if (!SC.darf(l, z, l.dran)) { legal = false; break; }
        zuege.push(z);
      }
    }
    pruefe("Schach: «Ganz leicht» und «Einfach» ziehen nur Erlaubtes", legal);
  }

  // Paare finden: dieselbe Saat, dieselbe Auslage; ein Paar bleibt und
  // heisst nochmal; ein Fehlversuch gibt den Zug ab; sechs zu sechs ist
  // unentschieden.
  const PA = angemeldet.paare;
  if (PA) {
    const lage = (zuege, beginnt = "a", saat = 4711) => PA.lage(zuege, { roh: zuege.join("."), beginnt, saat });
    const k1 = lage([]).karten;
    const zaehl = new Map();
    k1.forEach((t) => zaehl.set(t, (zaehl.get(t) || 0) + 1));
    pruefe("Paare finden: 24 Karten, zwölf Paare – und dieselbe Saat mischt gleich, eine andere anders",
      k1.length === 24 && zaehl.size === 12 && [...zaehl.values()].every((n) => n === 2)
      && JSON.stringify(lage([], "a", 4711).karten) === JSON.stringify(k1) && JSON.stringify(lage([], "a", 4712).karten) !== JSON.stringify(k1));
    const paarVon = (karten, k) => karten.findIndex((t, i) => i !== k && t === karten[k]);
    const nicht = (karten, k) => karten.findIndex((t, i) => i !== k && t !== karten[k]);
    const p0 = paarVon(k1, 0);
    const l1 = lage(["0", String(p0)]);
    const l2 = lage(["0", String(nicht(k1, 0))]);
    pruefe("Paare finden: Ein Paar gehört dem, der es findet, und er darf nochmal; ein Fehlversuch gibt den Zug ab",
      l1.besitz[0] === "a" && l1.besitz[p0] === "a" && l1.punkte.a === 1 && l1.dran === "a" && l2.dran === "b" && l2.punkte.a === 0);
    pruefe("Paare finden: Eine gefundene oder schon offene Karte lässt sich nicht noch einmal aufdecken",
      !PA.darf(l1, "0", "a") && !PA.darf(lage(["3"]), "3", "a") && PA.darf(lage(["3"]), "4", "a") && !PA.darf(lage([]), "24", "a") && !PA.darf(lage([]), "0", "b"));
    // Sechs Paare für a, ein Fehlversuch, sechs für b: unentschieden.
    const zuege = [];
    const frei = new Set(k1.keys());
    const paarNehmen = () => { const k = Math.min(...frei); const p = paarVon(k1, k); frei.delete(k); frei.delete(p); zuege.push(String(k), String(p)); };
    for (let i = 0; i < 6; i += 1) paarNehmen();
    const k = Math.min(...frei);
    zuege.push(String(k), String([...frei].find((x) => k1[x] !== k1[k])));
    for (let i = 0; i < 6; i += 1) paarNehmen();
    const remis = lage(zuege);
    pruefe("Paare finden: Sechs zu sechs ist unentschieden", remis.ende === "u" && remis.punkte.a === 6 && remis.punkte.b === 6);
    let legal = true;
    let siegeSchwer = 0;
    for (let p = 0; p < 20 && legal; p += 1) {
      const z = [];
      const beginnt = p % 2 ? "a" : "b";
      for (let l = lage(z, beginnt, 900 + p); !l.ende; l = lage(z, beginnt, 900 + p)) {
        const r = PA.computer(l, l.dran, l.dran === "a" ? "leicht" : "schwer");
        const zug = typeof r === "object" ? r.zug : r;
        if (!PA.darf(l, zug, l.dran) || z.length > 400) { legal = false; break; }
        z.push(zug);
      }
      if (lage(z, beginnt, 900 + p).ende === "b") siegeSchwer += 1;
    }
    pruefe("Paare finden: Der Computer deckt nur auf, was erlaubt ist, bis alles gefunden ist", legal);
    pruefe(`Paare finden: «Schwer» (vergisst nichts) schlägt «Ganz leicht» fast immer (${siegeSchwer} von 20)`, siegeSchwer >= 16);
  }

  // Farbcode knacken: Code verstecken, raten, antworten; wer zuerst knackt –
  // aber erst nach der ganzen Runde; die Codes am Ende.
  const FC = angemeldet.farbcode;
  if (FC) {
    const lage = (zuege, beginnt = "a") => FC.lage(zuege, { roh: zuege.join("."), beginnt, saat: 1 });
    const f0 = lage([]);
    pruefe("Farbcode knacken: Zuerst verstecken beide ihren Code",
      f0.phase === "verstecken" && FC.darf(f0, "Ca", "a") && !FC.darf(f0, "Cb", "a") && lage(["Cb", "Ca"]).dran === "a" && lage(["Ca", "Cb"], "b").dran === "b");
    const f1 = lage(["Ca", "Cb"]);
    pruefe("Farbcode knacken: Geraten werden vier Farben von sechs – auch doppelt, auch viermal dieselbe",
      FC.darf(f1, "R1234", "a") && FC.darf(f1, "R1123", "a") && FC.darf(f1, "R6666", "a") && !FC.darf(f1, "R1237", "a") && !FC.darf(f1, "R1230", "a") && !FC.darf(f1, "R123", "a") && !FC.darf(f1, "R1234", "b"));
    if (FC.fuerPruefung) {
      const { antwort, ALLE, gueltig } = FC.fuerPruefung;
      pruefe(`Farbcode knacken: Es gibt 6 × 6 × 6 × 6 = 1296 Codes (${ALLE.length}), alle gültig`, ALLE.length === 1296 && new Set(ALLE).size === 1296 && ALLE.every(gueltig));
      // [Code, Versuch, am Platz, anderswo]
      const faelle = [
        ["1234", "1234", 4, 0], ["1234", "4321", 0, 4], ["1234", "1111", 1, 0], ["1111", "1222", 1, 0],
        ["1122", "2211", 0, 4], ["1122", "1111", 2, 0], ["1123", "3111", 1, 2], ["5264", "2244", 2, 0],
        ["1122", "1213", 1, 2], ["6666", "1234", 0, 0], ["3311", "1133", 0, 4], ["2215", "5222", 1, 2],
      ];
      const falsch = faelle.filter(([c, v, p, d]) => { const [ap, ad] = antwort(c, v); return ap !== p || ad !== d; });
      pruefe(`Farbcode knacken: Die Antwort zählt doppelte Farben richtig – jede höchstens so oft, wie sie im Code steht (${falsch.map((f) => f.join("/")).join(", ") || "alle richtig"})`, !falsch.length);
      // Kein Code und kein Versuch ergibt «drei am Platz, einer anderswo»,
      // und die Antworten passen immer zusammen (gleich in beide Richtungen).
      let stimmig = true;
      for (let i = 0; i < ALLE.length && stimmig; i += 7) for (let j = 0; j < ALLE.length; j += 11) {
        const [p, d] = antwort(ALLE[i], ALLE[j]);
        const [p2, d2] = antwort(ALLE[j], ALLE[i]);
        if (p + d > 4 || (p === 3 && d === 1) || p !== p2 || d !== d2) { stimmig = false; break; }
      }
      pruefe("Farbcode knacken: Jede Antwort ist möglich und gleich, egal wer rät", stimmig);
      // «Schwer» knackt jeden Code in höchstens acht Versuchen (drüben rät
      // jemand immer 1111 auf einen Code ohne Rot).
      let laengste = 0;
      let alleGeknackt = true;
      for (let k = 0; k < 24; k += 1) {
        const code = ALLE[(k * 211 + 17) % ALLE.length];
        const z = ["Ca", "Cb"];
        let l = lage(z);
        while (!l.ende && l.phase !== "zeigen" && z.length < 60) {
          const r = FC.computer(l, "a", "schwer", { saat: 5 });
          const versuch = (r?.zug || r).slice(1);
          const [p, d] = antwort(code, versuch);
          z.push(`R${versuch}`, `A${p}${d}`, "R1111", "A00");
          l = lage(z);
        }
        if (!l.geknackt.a) alleGeknackt = false;
        laengste = Math.max(laengste, l.geknackt.a || 99);
      }
      pruefe(`Farbcode knacken: «Schwer» knackt jeden Code in höchstens acht Versuchen (24 Codes, längstens ${laengste})`, alleGeknackt && laengste <= 8);
    }
    const f2 = lage(["Ca", "Cb", "R1234"]);
    pruefe("Farbcode knacken: Antworten darf, wessen Code es ist – und nur, was sein kann",
      f2.phase === "antworten" && f2.dran === "b" && FC.darf(f2, "A12", "b") && !FC.darf(f2, "A12", "a") && !FC.darf(f2, "A31", "b") && !FC.darf(f2, "A23", "b"));
    const f3 = lage(["Ca", "Cb", "R1234", "A40"]);
    pruefe("Farbcode knacken: Wer als Erster knackt, wartet – die andere darf in derselben Runde noch",
      !f3.ende && f3.dran === "b" && f3.geknackt.a === 1 && f3.phase === "raten");
    const f4 = lage(["Ca", "Cb", "R1234", "A40", "R5612", "A21"]);
    pruefe("Farbcode knacken: Knackt sie nicht, hat die Erste gewonnen – und zeigt ihren Code",
      f4.phase === "zeigen" && f4.dran === "a" && FC.darf(f4, "Z3456", "a") && lage(["Ca", "Cb", "R1234", "A40", "R5612", "A21", "Z3456"]).ende === "a");
    const f5 = lage(["Ca", "Cb", "R1234", "A40", "R5612", "A40"]);
    pruefe("Farbcode knacken: Knacken beide in derselben Runde, ist es unentschieden (und nichts mehr zu zeigen)",
      f5.ende === "u" && f5.phase === "ende");
    const lang = ["Ca", "Cb"];
    for (let i = 0; i < 8; i += 1) lang.push("R1234", "A12", "R5612", "A03");
    const f6 = lage(lang);
    pruefe("Farbcode knacken: Nach acht Versuchen ohne Treffer – beide zeigen, dann unentschieden",
      f6.phase === "zeigen" && f6.zeigen.length === 2 && lage([...lang, "Z1243", "Z2156"]).ende === "u");
    // Ganze Partien: Computer gegen Computer, a antwortet von selbst (ohne
    // Speicher: aus einem Code, der zu allen Antworten passt).
    let legal = true;
    let zuEnde = 0;
    for (let p = 0; p < 16 && legal; p += 1) {
      const stufen = Object.keys(FC.stufen);
      const sa = stufen[p % 4];
      const sb = stufen[(p + 1) % 4];
      const beginnt = p % 2 ? "b" : "a";
      const z = [];
      let l = lage(z, beginnt);
      for (let i = 0; i < 200 && !l.ende; i += 1) {
        const wer = l.dran === "beide" ? (l.bereit.a ? "b" : "a") : l.dran;
        let zug;
        if (l.phase === "verstecken") zug = `C${wer}`;
        else if (wer === "a") zug = FC.auto(l, "a", { raum: `p${p}`, nr: 0 }) || FC.computer(l, "a", sa, { saat: 31 + p });
        else zug = FC.computer(l, "b", sb, { saat: 3100 + p });
        if (zug && typeof zug === "object") zug = zug.zug;
        if (!FC.darf(l, zug, wer)) { legal = false; break; }
        z.push(zug);
        l = lage(z, beginnt);
      }
      if (l.ende) zuEnde += 1;
    }
    pruefe(`Farbcode knacken: 16 Partien Computer gegen Computer – jeder Zug erlaubt, jede zu Ende (${zuEnde}/16)`, legal && zuEnde === 16);
  }

  // Blitzpaar: Runden aus der Saat, der erste passende Tipp holt den Punkt,
  // daneben heisst aussetzen, beide daneben heisst nächste Runde.
  const BP = angemeldet.blitzpaar;
  if (BP) {
    const lage = (zuege, saat = 99) => BP.lage(zuege, { roh: zuege.join("."), beginnt: "a", saat });
    const l0 = lage([]);
    const zaehl = new Map();
    l0.runde.bilder.forEach((b) => zaehl.set(b, (zaehl.get(b) || 0) + 1));
    pruefe("Blitzpaar: Zwölf Bilder, genau eines doppelt – dieselbe Saat, dieselbe Runde",
      l0.runde.bilder.length === 12 && zaehl.size === 11 && l0.runde.paar.length === 2
      && l0.runde.bilder[l0.runde.paar[0]] === l0.runde.bilder[l0.runde.paar[1]]
      && JSON.stringify(lage([], 99).runde) === JSON.stringify(l0.runde) && JSON.stringify(lage([], 98).runde) !== JSON.stringify(l0.runde)
      && l0.dran === "beide");
    const [p0] = l0.runde.paar;
    const falsch = [...Array(12).keys()].find((i) => !l0.runde.paar.includes(i));
    const l1 = lage([`b0:${p0}`]);
    pruefe("Blitzpaar: Wer zuerst richtig tippt, holt den Punkt – dann kommt die nächste Runde",
      l1.punkte.b === 1 && l1.nr === 1 && !BP.darf(l1, `a0:${p0}`, "a") && BP.darf(l1, `a1:${p0}`, "a"));
    const l2 = lage([`a0:${falsch}`]);
    pruefe("Blitzpaar: Wer danebentippt, setzt den Rest der Runde aus",
      l2.gesperrt.a === falsch && l2.nr === 0 && !BP.darf(l2, `a0:${p0}`, "a") && BP.darf(l2, `b0:${p0}`, "b"));
    const l3 = lage([`a0:${falsch}`, `b0:${falsch}`]);
    pruefe("Blitzpaar: Tippen beide daneben, zählt die Runde nicht", l3.nr === 1 && l3.punkte.a === 0 && l3.punkte.b === 0);
    pruefe("Blitzpaar: Nur für sich selbst, nur in der laufenden Runde",
      !BP.darf(l0, `b0:${p0}`, "a") && !BP.darf(l0, `a1:${p0}`, "a") && !BP.darf(l0, "a0:12", "a") && lage(["a1:0"]).dran === null);
    const sieg = [];
    for (let i = 0; i < 5; i += 1) sieg.push(`a${i}:${lage(sieg).runde.paar[1]}`);
    pruefe("Blitzpaar: Fünf Punkte gewinnen", lage(sieg).ende === "a" && lage(sieg).dran === null);
    let legal = true;
    for (const stufe of Object.keys(BP.stufen)) {
      const z = [];
      for (let l = lage(z); !l.ende && z.length < 200; l = lage(z)) {
        // Wer danebengetippt hat, setzt aus – dann tippt der andere.
        const r = BP.computer(l, z.length % 3 ? "b" : "a", stufe) || BP.computer(l, z.length % 3 ? "a" : "b", stufe);
        if (!r || !BP.darf(l, r.zug, r.zug[0]) || !(r.warte > 0)) { legal = false; break; }
        z.push(r.zug);
      }
    }
    pruefe("Blitzpaar: Der Computer tippt auf jeder Stufe nur Erlaubtes und lässt sich Zeit", legal);
  }

  // Miteinander (gemeinsam): Der Rahmen kennt «g» und «v» – Texte, Bilanz,
  // Feiern, die Zahl in der Leiste.
  pruefe("zwei.js kennt Spiele miteinander: geschafft (g) und verpasst (v)",
    /ende === "g"\) standard = \{ text: texte\.geschafft/.test(zweiJs) && /st\.ende === "v"\) standard = \{ text: texte\.verpasst/.test(zweiJs)
    && /\["a", "g"\]\.includes\(lage\.ende\) \? "s"/.test(zweiJs) && /S\.spiel\?\.gemeinsam\) return `\$\{x\.s\} geschafft/.test(zweiJs)
    && /S\.spiel\.lage\(teile\(roh\), \{ roh: String\(roh \|\| ""\), beginnt, saat: Number\(saat\) \|\| 0, stufe: stufeJetzt\(\) \}\)/.test(zweiJs));

  // Schatzkarte & Kompass: Hinweis und Schritt im Wechsel, Felsen halten
  // auf, eine Grube führt zurück zum Start, Graben findet den Schatz oder
  // kostet einen Schritt – und ein Partner, der jedem Hinweis folgt, kommt
  // immer an.
  const SK = angemeldet.schatzkarte;
  if (SK) {
    const lage = (zuege, beginnt = "a", saat = 77, stufe = null) => SK.lage(zuege, { roh: zuege.join("."), beginnt, saat, stufe });
    const s0 = lage([]);
    const i = s0.insel;
    pruefe("Schatzkarte: Wer beginnt, hat die Karte – erst Hinweis, dann Schritt",
      s0.leser === "a" && s0.sucher === "b" && s0.dran === "a" && SK.darf(s0, "HN", "a") && !SK.darf(s0, "SN", "a") && !SK.darf(s0, "HN", "b")
      && lage(["HO"]).dran === "b" && SK.darf(lage(["HO"]), "SO", "b") && SK.darf(lage(["HO"]), "SG", "b") && lage([], "b").leser === "b");
    pruefe("Schatzkarte: Dieselbe Saat, dieselbe Insel – und es gibt immer einen sicheren Weg",
      JSON.stringify([...lage([], "a", 77).insel.fels]) === JSON.stringify([...i.fels]) && i.schritte > i.kurz
      && !i.fels.has(i.start) && !i.grube.has(i.start) && !i.fels.has(i.schatz) && !i.grube.has(i.schatz));
    // Vom Start ein Schritt in jede Richtung: was passiert?
    const n = i.n;
    const nach = (f, d) => { const r = Math.floor(f / n) + { N: -1, S: 1, O: 0, W: 0 }[d]; const c = (f % n) + { N: 0, S: 0, O: 1, W: -1 }[d]; return r >= 0 && c >= 0 && r < n && c < n ? r * n + c : -1; };
    let ok = true;
    for (const d of ["N", "O", "S", "W"]) {
      const l = lage(["H" + d, "S" + d]);
      const ziel = nach(i.start, d);
      const soll = ziel < 0 ? ["wasser", i.start] : i.fels.has(ziel) ? ["fels", i.start] : i.grube.has(ziel) ? ["grube", i.start] : ["schritt", ziel];
      if (l.ereignis !== soll[0] || l.pos !== soll[1] || l.uebrig !== i.schritte - 1) ok = false;
    }
    pruefe("Schatzkarte: Wasser und Felsen halten auf, eine Grube führt zurück zum Start, jeder Schritt zählt", ok);
    const leer = lage(["HG", "SG"]);
    pruefe("Schatzkarte: Graben, wo nichts ist, kostet einen Schritt", !leer.ende && leer.ereignis === "leer" && leer.uebrig === i.schritte - 1);
    const zuWenig = [];
    for (let k = 0; k < i.schritte; k += 1) zuWenig.push("HG", "SG");
    pruefe("Schatzkarte: Sind die Schritte aus, ist es nicht geschafft (v)", lage(zuWenig).ende === "v" && lage(zuWenig).dran === null);
    let immer = true;
    let gruben = 0;
    for (const stufe of [null, ...Object.keys(SK.stufen)]) {
      for (let p = 0; p < 10; p += 1) {
        const z = [];
        const beginnt = p % 2 ? "b" : "a";
        let l = lage(z, beginnt, 300 + p, stufe);
        gruben += l.insel.grube.size;
        while (!l.ende && z.length < 400) {
          const r = SK.computer(l, l.dran);
          if (!SK.darf(l, r.zug, l.dran)) { immer = false; break; }
          z.push(r.zug);
          l = lage(z, beginnt, 300 + p, stufe);
        }
        if (l.ende !== "g") immer = false;
      }
    }
    pruefe(`Schatzkarte: Zwei, die sich verstehen (der Computer in beiden Rollen), finden den Schatz auf jeder Insel (50 Partien, ${gruben} Gruben)`, immer);
    pruefe("Schatzkarte: Die Stufen machen die Insel grösser, mit mehr Gruben und weniger Luft",
      lage([], "a", 5, "leicht").insel.n < lage([], "a", 5, "schwer").insel.n
      && lage([], "a", 5, "leicht").insel.grube.size < lage([], "a", 5, "schwer").insel.grube.size);
  }

  // Malen und Raten: sechs Runden, die Rollen wechseln; richtig heisst
  // nächste Runde, drei Fehler auch; vier erraten ist geschafft. Die Striche
  // gehen über partie/<raum>/live – erst wenn beide da sind, nur Ziffern.
  const liveRegel = liveRegeln?.partie?.$raum?.live?.$stueck;
  pruefe("Die Regeln kennen den Live-Ort einer Partie: erst zu zweit, nur Ziffern und Trenner, höchstens 40 000 Zeichen",
    /child\('b'\)\.exists\(\)/.test(liveRegel?.[".write"] || "") && /\$stueck\.matches/.test(liveRegel?.[".write"] || "")
    && /length <= 40000/.test(liveRegel?.[".validate"] || "") && /\^\[0-9,;\|\]\*\$/.test(liveRegel?.[".validate"] || ""));
  pruefe("zwei.js bietet den Spielen den Live-Ort an (LernappZwei.live), nur im Duell",
    /function live\(raum\)[\s\S]*?partie\/\$\{raum\}\/live\//.test(zweiJs) && /\n    live,\n/.test(zweiJs));
  const MR = angemeldet.malen;
  if (MR) {
    const lage = (zuege, beginnt = "a", saat = 5, stufe = null) => MR.lage(zuege, { roh: zuege.join("."), beginnt, saat, stufe });
    const m0 = lage([]);
    const woerter = new Set(m0.runden.map((r) => r.wort));
    pruefe("Malen und Raten: sechs verschiedene Wörter, je sechs Antworten mit der richtigen – dieselbe Saat, dieselben Runden",
      m0.runden.length === 6 && woerter.size === 6 && m0.runden.every((r) => r.wahl.length === 6 && r.wahl[r.richtig] === r.wort && new Set(r.wahl).size === 6)
      && JSON.stringify(lage([], "a", 5).runden) === JSON.stringify(m0.runden));
    const c0 = lage([], "a", 5, "leicht");
    pruefe("Malen und Raten: Wer beginnt, malt zuerst – dann wechselt es jede Runde, auch gegen den Computer",
      m0.maler === "a" && m0.dran === "b" && lage([`R0:${m0.runden[0].richtig}`]).maler === "b" && lage([], "b").maler === "b"
      && c0.maler === "a" && c0.dran === "b" && lage([`R0:${c0.runden[0].richtig}`], "a", 5, "leicht").maler === "b"
      && lage([], "b", 5, "leicht").maler === "b");
    pruefe("Malen und Raten: Malt der Computer, macht er keinen Zug (man rät selbst)",
      MR.computer(lage([], "b", 5, "leicht"), "b", "leicht", { nr: 0 }) === null && MR.computer(c0, "a", "leicht", { nr: 0 }) === null);
    if (MR.fuerPruefung) {
      // Der Computer errät, was man malt: Er vergleicht die Zeichnung mit
      // seinen Bildern. Seine eigenen Bilder – verschoben, kleiner, schief
      // und ohne den letzten Strich – erkennt er unter allen zwanzig.
      const { WOERTER, erkenne } = MR.fuerPruefung;
      const alleWoerter = WOERTER.map((_, i) => i);
      const verschoben = (st, k) => st.map((strich) => strich.map(([x, y]) => [300 + (x - 500) * 0.55 + k * 9, 420 + (y - 500) * 0.6 + (x - 500) * 0.05]));
      const nichtErkannt = alleWoerter.filter((w) => erkenne(verschoben(WOERTER[w].malen(), w), alleWoerter)[0] !== w);
      pruefe(`Malen und Raten: Der Computer erkennt alle ${WOERTER.length} Bilder beim ersten Versuch, auch verschoben und schief (${nichtErkannt.map((w) => WOERTER[w].wort).join(", ") || "alle"})`, !nichtErkannt.length);
      // Unfertig (ohne den letzten Strich) ist manches mehrdeutig – ein
      // Ballon ohne Schnur ist auch ein Apfel. In drei Versuchen klappt es
      // trotzdem fast immer.
      const unfertig = alleWoerter.filter((w) => { const st = WOERTER[w].malen(); return erkenne(verschoben(st.length > 2 ? st.slice(0, -1) : st, w), alleWoerter).slice(0, 3).includes(w); });
      pruefe(`Malen und Raten: Unfertige Bilder errät er in drei Versuchen unter allen fast immer (${unfertig.length} von ${WOERTER.length})`, unfertig.length >= WOERTER.length * 0.9);
      // Viele Wörter, jedes einmal, jedes mit eigenem Bild, jede Zeichnung auf
      // dem Blatt.
      const namen = WOERTER.map((w) => w.wort);
      const bilder = WOERTER.map((w) => w.bild);
      const ausserhalb = WOERTER.filter((w) => w.malen().some((st) => st.length < 2 || st.some(([x, y]) => !(x >= 0 && x <= 1000 && y >= 0 && y <= 1000))));
      pruefe(`Malen und Raten: ${WOERTER.length} Wörter (mindestens 80), keines doppelt, jedes mit eigenem Bild, jede Zeichnung ganz auf dem Blatt (${ausserhalb.map((w) => w.wort).join(", ") || "alle"})`,
        WOERTER.length >= 80 && new Set(namen).size === namen.length && new Set(bilder).size === bilder.length && !ausserhalb.length);
      // Weniger Wiederholungen: Eine neue Partie meidet die Wörter der
      // letzten Partien (auf diesem Gerät).
      if (MR.fuerPruefung.neuePartie && MR.fuerPruefung.zuletztMerken) {
        const { neuePartie, zuletztMerken, runden: rundenVon } = MR.fuerPruefung;
        const verlauf = [];
        let wieder = 0;
        for (let p = 0; p < 15; p += 1) {
          const woerter = rundenVon(neuePartie("mittel").saat, "mittel").map((r) => WOERTER[r.wort].wort);
          const letzte = new Set(verlauf.slice(-5).flat());
          wieder += woerter.filter((w) => letzte.has(w)).length;
          verlauf.push(woerter);
          zuletztMerken(woerter);
        }
        pruefe(`Malen und Raten: In 15 Partien kommt kein Wort aus den fünf Partien davor wieder (${wieder})`, wieder === 0);
      }
      pruefe("Malen und Raten: Ohne Zeichnung rät der Computer nicht drauflos", erkenne([], [3, 1, 2]).join() === "3,1,2");
    }
    const falsch0 = [0, 1, 2, 3, 4, 5].filter((i) => i !== m0.runden[0].richtig);
    const m1 = lage([`R0:${falsch0[0]}`]);
    const m2 = lage(falsch0.slice(0, 3).map((i) => `R0:${i}`));
    pruefe("Malen und Raten: Ein Fehler kostet einen Versuch, drei beenden die Runde",
      m1.runde === 0 && m1.falsch.length === 1 && !MR.darf(m1, `R0:${falsch0[0]}`, "b") && MR.darf(m1, `R0:${m0.runden[0].richtig}`, "b")
      && m2.runde === 1 && m2.erraten === 0);
    pruefe("Malen und Raten: Raten darf nur, wer nicht malt, und nur in der laufenden Runde",
      !MR.darf(m0, "R0:0", "a") && MR.darf(m0, "R0:0", "b") && !MR.darf(m0, "R1:0", "b") && !MR.darf(m0, "R0:6", "b") && lage(["R1:0"]).dran === null);
    const alle = [];
    for (let r = 0; r < 6; r += 1) alle.push(`R${r}:${lage(alle).runden[r].richtig}`);
    const vier = [];
    for (let r = 0; r < 6; r += 1) {
      const l = lage(vier);
      if (r < 4) vier.push(`R${r}:${l.runden[r].richtig}`);
      else [0, 1, 2, 3, 4, 5].filter((i) => i !== l.runden[r].richtig).slice(0, 3).forEach((i) => vier.push(`R${r}:${i}`));
    }
    const drei = [];
    for (let r = 0; r < 6; r += 1) {
      const l = lage(drei);
      if (r < 3) drei.push(`R${r}:${l.runden[r].richtig}`);
      else [0, 1, 2, 3, 4, 5].filter((i) => i !== l.runden[r].richtig).slice(0, 3).forEach((i) => drei.push(`R${r}:${i}`));
    }
    pruefe("Malen und Raten: Vier von sechs erraten ist geschafft, drei nicht", lage(alle).ende === "g" && lage(vier).ende === "g" && lage(drei).ende === "v");
    pruefe("Malen und Raten: Die Stufen: drei, vier, sechs, acht Antworten",
      ["leicht", "einfach", "mittel", "schwer"].map((st) => lage([], "a", 9, st).runden[0].wahl.length).join() === "3,4,6,8");
  }

  // Wackelturm: Ob der Turm hält, ist reine Rechnung (Schwerpunkt über der
  // Auflage, jeder Klotz berührt den darunter) – gleich auf jedem Gerät.
  const WT = angemeldet.wackelturm;
  if (WT?.fuerPruefung) {
    const { haelt } = WT.fuerPruefung;
    const lage = (zuege, beginnt = "a", saat = 3, stufe = null) => WT.lage(zuege, { roh: zuege.join("."), beginnt, saat, stufe });
    pruefe("Wackelturm: Klötze genau übereinander halten; ein Klotz ohne Berührung, oder einer über der Kante, nicht",
      haelt([{ x: 500, b: 300 }, { x: 500, b: 200 }, { x: 500, b: 300 }]).haelt
      && !haelt([{ x: 500, b: 300 }, { x: 760, b: 200 }]).haelt
      && haelt([{ x: 500, b: 300 }, { x: 620, b: 200 }]).haelt
      && !haelt([{ x: 500, b: 300 }, { x: 620, b: 200 }, { x: 740, b: 200 }]).haelt);
    pruefe("Wackelturm: Auch der ganze Turm muss über der Platte stehen",
      !haelt([{ x: 720, b: 200 }]).haelt && haelt([{ x: 690, b: 200 }]).haelt && haelt([{ x: 500, b: 300 }]).knapp === 0);
    const l0 = lage([]);
    pruefe("Wackelturm: Wer beginnt, lässt den ersten Klotz fallen – dann abwechselnd",
      l0.dran === "a" && WT.darf(l0, "D500", "a") && !WT.darf(l0, "D500", "b") && !WT.darf(l0, "D1001", "a")
      && lage(["D500"]).dran === "b" && lage(["D500", "D500"]).dran === "a");
    const hoch = [];
    for (let i = 0; i < l0.art.ziel; i += 1) hoch.push("D500");
    pruefe("Wackelturm: Bis zur Zielhöhe genau übereinander – geschafft", lage(hoch).ende === "g" && lage(hoch.slice(0, -1)).ende === null);
    pruefe("Wackelturm: Ein Klotz daneben – umgekippt", lage(["D500", "D900"]).ende === "v" && lage(["D500", "D900"]).dran === null);
    pruefe("Wackelturm: Dieselbe Saat, dieselben Klötze; die Stufen machen den Turm höher und die Klötze schmaler",
      JSON.stringify(lage(hoch, "a", 3).kloetze.map((k) => k.b)) === JSON.stringify(lage(hoch, "a", 3).kloetze.map((k) => k.b))
      && lage([], "a", 3, "leicht").art.ziel < lage([], "a", 3, "schwer").art.ziel
      && Math.max(...lage([], "a", 3, "schwer").art.breiten) < Math.max(...lage([], "a", 3, "leicht").art.breiten) + 1);
    let geschafft = 0;
    for (let p = 0; p < 20; p += 1) {
      const z = [];
      let l = lage(z, "a", 500 + p, "schwer");
      while (!l.ende) { z.push(WT.computer(l, l.dran).zug); l = lage(z, "a", 500 + p, "schwer"); }
      if (l.ende === "g") geschafft += 1;
    }
    pruefe(`Wackelturm: Zwei Computer schaffen auch den schwersten Turm (${geschafft} von 20)`, geschafft >= 18);
  }

  // Zwillings-Labyrinth: Türen öffnen nur, solange jemand auf der Platte
  // steht (oder in der Tür); in die andere hinein geht es nicht; jedes
  // Labyrinth ist lösbar – und braucht beide.
  const ZL = angemeldet.zwillinge;
  if (ZL?.fuerPruefung) {
    const { plan, LABYRINTHE, labyrinth, lageAuf, welches, allein } = ZL.fuerPruefung;
    // Die Regeln an den gezeichneten Labyrinthen (lageAuf), die Partien an
    // erzeugten (lage mit Saat und Stufe).
    const lage = (zuege, name = "leicht") => lageAuf(labyrinth(name), zuege);
    const l0 = lage([]);
    pruefe("Zwillings-Labyrinth: Beide sind zugleich dran, jede nur mit ihrer Figur",
      l0.dran === "beide" && ZL.darf(l0, "aO", "a") && !ZL.darf(l0, "aO", "b") && ZL.darf(l0, "bO", "b") && !ZL.darf(l0, "aN", "a"));
    // leicht: a kommt nur durch die Tür «!», wenn b auf Platte 1 steht.
    pruefe("Zwillings-Labyrinth: Eine Tür ist zu – bis jemand auf ihrer Platte steht",
      !ZL.darf(lage(["aO", "aO"]), "aO", "a") && ZL.darf(lage(["aO", "aO", "bO", "bO"]), "aO", "a"));
    pruefe("Zwillings-Labyrinth: Wer in der Tür steht, hält sie offen",
      ZL.darf(lage(["aO", "aO", "bO", "bO", "aO", "bW"]), "aO", "a") && !ZL.darf(lage(["aO", "aO", "bO", "bO", "aO", "aO", "bW"]), "aW", "a"));
    const viele = Array(labyrinth("leicht").schritte).fill(0).map((_, i) => (i % 2 ? "aW" : "aO"));
    pruefe("Zwillings-Labyrinth: Sind die Schritte aus, ist es nicht geschafft", lage(viele).ende === "v" && lage(viele.slice(0, -1)).ende === null);

    // Erzeugte Labyrinthe: aus jedem Grad zwölf. Jedes ist lösbar in den
    // Schritten, die es gibt, keine kommt allein zur Fahne, und zwei Computer
    // als Zwillinge kommen ans Ziel.
    let alleLoesbar = true;
    let brauchtBeide = true;
    let partner = true;
    const nichtGut = [];
    for (let grad = 0; grad < 8; grad += 1) {
      for (let k = 0; k < 12; k += 1) {
        const name = `g${grad}-${(k * 2654435761 + grad * 97) % 0x10000000}`;
        const lab = labyrinth(name);
        if (lab.grad !== grad || !/^g/.test(lab.name)) { nichtGut.push(name); continue; }
        const weg = plan({ lab: name, pos: { a: lab.a, b: lab.b } });
        const z = [];
        let l = lage(z, name);
        for (const zug of weg) { if (!ZL.darf(l, zug, zug[0])) { alleLoesbar = false; break; } z.push(zug); l = lage(z, name); }
        if (l.ende !== "g" || !weg.length || weg.length > lab.schritte) { alleLoesbar = false; nichtGut.push(name); }
        if (allein(lab, "a") || allein(lab, "b") || new Set(weg.map((x) => x[0])).size < 2) { brauchtBeide = false; nichtGut.push(name); }
        if (k < 4) {
          const zz = [];
          let ll = lage(zz, name);
          for (let i = 0; i < 600 && !ll.ende; i += 1) {
            const r = ZL.computer(ll, i % 2 ? "b" : "a") || ZL.computer(ll, i % 2 ? "a" : "b");
            if (!r) break;
            zz.push(r.zug);
            ll = lage(zz, name);
          }
          if (ll.ende !== "g") { partner = false; nichtGut.push(name); }
        }
      }
    }
    // Die vier gezeichneten (Ersatz): lösbar, und der Weg braucht beide (in
    // «einfach» braucht nur a Hilfe – das war schon immer so).
    for (const name of Object.keys(LABYRINTHE)) {
      const lab = labyrinth(name);
      const weg = plan({ lab: name, pos: { a: lab.a, b: lab.b } });
      if (!weg.length || weg.length > lab.schritte || new Set(weg.map((x) => x[0])).size < 2) { alleLoesbar = false; nichtGut.push(name); }
    }
    pruefe(`Zwillings-Labyrinth: Jedes erzeugte Labyrinth (8 Grade × 12) und jedes gezeichnete ist lösbar, in den Schritten, die es gibt${nichtGut.length ? ` (${[...new Set(nichtGut)].join(", ")})` : ""}`, alleLoesbar);
    pruefe("Zwillings-Labyrinth: In keinem erzeugten kommt eine allein zu ihrer Fahne – beide brauchen Hilfe", brauchtBeide);
    pruefe("Zwillings-Labyrinth: Zwei Computer als Zwillinge kommen in den erzeugten Labyrinthen ans Ziel", partner);
    // Dieselbe Saat, dasselbe Labyrinth (im Duell sehen es beide gleich);
    // jede neue Partie ein anderes; alle zwei Partien in Folge ein Grad mehr.
    pruefe("Zwillings-Labyrinth: Dieselbe Saat gibt dasselbe Labyrinth",
      labyrinth("g3-424242").karte.join() === ZL.fuerPruefung.erzeuge(424242, 3).join() && welches(0x20000123, "leicht") === "g2-291");
    const karten = new Set();
    for (let i = 0; i < 30; i += 1) karten.add(labyrinth(welches(ZL.neuePartie("leicht", { nr: 0 }).saat, "leicht")).karte.join("/"));
    pruefe(`Zwillings-Labyrinth: Jede neue Partie bringt ein anderes Labyrinth (${karten.size} verschiedene in 30)`, karten.size >= 29);
    const grade = [0, 1, 2, 3, 4, 8, 20].map((nr) => labyrinth(welches(ZL.neuePartie("leicht", { nr }).saat, "leicht")).grad);
    const gradeDuell = [0, 2, 20].map((nr) => labyrinth(welches(ZL.neuePartie(null, { nr }).saat, null)).grad);
    pruefe(`Zwillings-Labyrinth: Alle zwei Partien in Folge wird es schwerer, höchstens vier Grade (${grade.join(",")}; Duell ${gradeDuell.join(",")})`,
      grade.join(",") === "0,0,1,1,2,4,4" && gradeDuell.join(",") === "1,2,5"
      && labyrinth(welches(ZL.neuePartie("schwer", { nr: 30 }).saat, "schwer")).grad === 7);
    const gross = [0, 3, 7].map((grad) => { const l = labyrinth(`g${grad}-777`); return l.w * l.h; });
    pruefe(`Zwillings-Labyrinth: Höhere Grade sind grösser (${gross.join(" < ")} Felder)`, gross[0] < gross[1] && gross[1] < gross[2]);
  }

  // Bohnen säen: säen, den Topf des Gegenübers überspringen, nochmal,
  // rauben, das Ende – an kurzen Folgen und gebauten Mulden; dann ganze
  // Partien Computer gegen Computer.
  const BS = angemeldet.bohnen;
  if (BS?.fuerPruefung) {
    const { schritt, anfang, TOPF, REIHE } = BS.fuerPruefung;
    const lage = (zuege, beginnt = "a") => BS.lage(zuege, { roh: zuege.join("."), beginnt, saat: 1 });
    const l0 = lage([]);
    pruefe("Bohnen säen: Zu Beginn liegen in jeder Mulde vier Bohnen, die Töpfe sind leer, wer beginnt, ist dran",
      [...REIHE.a, ...REIHE.b].every((i) => l0.mulden[i] === 4) && l0.mulden[TOPF.a] === 0 && l0.mulden[TOPF.b] === 0 && l0.dran === "a" && lage([], "b").dran === "b");
    const l1 = lage(["2"]);
    pruefe("Bohnen säen: Vier Bohnen aus Mulde 3 – die letzte liegt im Topf, und a darf nochmal",
      l1.mulden.join(",") === "4,4,0,5,5,5,1,4,4,4,4,4,4,0" && l1.dran === "a" && l1.nochmal === true);
    const l2 = lage(["0"]);
    pruefe("Bohnen säen: Sonst ist das Gegenüber dran", l2.mulden.join(",") === "0,5,5,5,5,4,0,4,4,4,4,4,4,0" && l2.dran === "b" && !l2.nochmal);
    const viele = anfang(); viele[5] = 9;
    const s1 = schritt(viele, 5, "a");
    pruefe("Bohnen säen: Den Topf des Gegenübers überspringt man",
      s1.m[TOPF.b] === 0 && s1.weg.join(",") === "6,7,8,9,10,11,12,0,1" && s1.m[0] === 5 && s1.m[1] === 5);
    const raub = anfang(); raub[0] = 1; raub[1] = 0; raub[11] = 5;
    const s2 = schritt(raub, 0, "a");
    pruefe("Bohnen säen: Landet die letzte in einer eigenen leeren Mulde, raubt man, was gegenüber liegt",
      s2.raub?.zahl === 6 && s2.m[TOPF.a] === 6 && s2.m[1] === 0 && s2.m[11] === 0 && !s2.nochmal);
    const leer = anfang(); leer[0] = 1; leer[1] = 0; leer[11] = 0;
    pruefe("Bohnen säen: Liegt gegenüber nichts, wird nicht geraubt", (() => { const s = schritt(leer, 0, "a"); return !s.raub && s.m[1] === 1; })());
    const schluss = Array(14).fill(0); schluss[5] = 1; schluss[TOPF.a] = 20; schluss[7] = 3; schluss[TOPF.b] = 24;
    const s3 = schritt(schluss, 5, "a");
    pruefe("Bohnen säen: Ist eine Reihe leer, ist es aus – was noch liegt, kommt in den Topf dessen, dem die Mulde gehört",
      s3.ende === "b" && s3.m[TOPF.a] === 21 && s3.m[TOPF.b] === 27 && s3.rest?.b === 3 && [...REIHE.a, ...REIHE.b].every((i) => s3.m[i] === 0));
    pruefe("Bohnen säen: nur eine eigene Mulde mit Bohnen, nur wer dran ist",
      BS.darf(l0, "0", "a") && BS.darf(l0, "5", "a") && !BS.darf(l0, "6", "a") && !BS.darf(l0, "7", "a") && !BS.darf(l0, "0", "b")
      && !BS.darf(lage(["0"]), "0", "b") && BS.darf(lage(["0"]), "7", "b") && !BS.darf(lage(["0", "7"]), "0", "a") && !BS.darf(l0, "05", "a")
      && lage(["0", "0"]).dran === null);
    // Ganze Partien: zufällig (mit Saat) – die Bohnen bleiben 48, und es
    // gibt auch ein Unentschieden; dann Computer gegen Computer.
    let zufall = 4242;
    const wuerfel = () => { zufall = (Math.imul(zufall, 1103515245) + 12345) >>> 0; return zufall / 4294967296; };
    let immer48 = true;
    let ausgang = true;
    let remis = null;
    for (let p = 0; p < 300; p += 1) {
      const zuege = [];
      for (let l = lage(zuege); !l.ende; l = lage(zuege)) {
        const offen = REIHE[l.dran].filter((i) => l.mulden[i] > 0);
        zuege.push(String(offen[Math.floor(wuerfel() * offen.length)]));
        if (lage(zuege).mulden.reduce((a, b) => a + b, 0) !== 48) immer48 = false;
      }
      const l = lage(zuege);
      if (l.punkte.a + l.punkte.b !== 48 || l.ende !== (l.punkte.a > l.punkte.b ? "a" : l.punkte.b > l.punkte.a ? "b" : "u")) ausgang = false;
      if (l.ende === "u") remis = l;
    }
    pruefe("Bohnen säen: Es bleiben immer 48 Bohnen", immer48);
    pruefe("Bohnen säen: Am Ende liegen alle 48 in den Töpfen, wer mehr hat, gewinnt", ausgang);
    pruefe("Bohnen säen: 24 zu 24 ist unentschieden", remis?.punkte.a === 24 && remis?.punkte.b === 24);
    let legal = true;
    let schwerSiegt = 0;
    let einfachSiegt = 0;
    let langsam = 0;
    const STUFEN_BS = Object.keys(BS.stufen || {});
    for (let p = 0; p < 32 && legal; p += 1) {
      const [sa, sb] = p < 8 ? [STUFEN_BS[p % 4], STUFEN_BS[3 - (p % 4)]] : p < 24 ? ["mittel", "schwer"] : ["leicht", "einfach"];
      const zuege = [];
      const beginnt = p % 2 ? "b" : "a";
      for (let l = lage(zuege, beginnt); !l.ende; l = lage(zuege, beginnt)) {
        const t = performance.now();
        const antwort = BS.computer(l, l.dran, l.dran === "a" ? sa : sb);
        langsam = Math.max(langsam, performance.now() - t);
        if (!BS.darf(l, antwort?.zug, l.dran) || !(antwort.warte > 0)) { legal = false; break; }
        zuege.push(antwort.zug);
      }
      const ende = lage(zuege, beginnt).ende;
      if (p >= 8 && p < 24 && ende === "b") schwerSiegt += 1;
      if (p >= 24 && ende === "b") einfachSiegt += 1;
    }
    pruefe("Bohnen säen: Jede Stufe nimmt nur eigene Mulden mit Bohnen, bis die Partie aus ist – und wartet, bis das Säen zu sehen war", legal);
    pruefe(`Bohnen säen: «Schwer» schlägt «Mittel» fast immer (${schwerSiegt} von 16)`, schwerSiegt >= 13);
    pruefe(`Bohnen säen: «Einfach» schlägt «Ganz leicht» meistens (${einfachSiegt} von 8)`, einfachSiegt >= 5);
    pruefe(`Bohnen säen: «Schwer» rechnet schnell (längstens ${langsam.toFixed(0)} ms)`, langsam < 600);
  }

  // Wolf und Schafe: wer welche Rolle hat, wie die Figuren ziehen, wann es
  // aus ist – und ganze Partien Computer gegen Computer.
  const WS = angemeldet.wolf;
  if (WS?.fuerPruefung) {
    const { zuegeVon, SCHAFE_START, WOLF_START } = WS.fuerPruefung;
    const lage = (zuege, beginnt = "a") => WS.lage(zuege, { roh: zuege.join("."), beginnt, saat: 1 });
    const l0 = lage([]);
    const l0b = lage([], "b");
    pruefe("Wolf und Schafe: Wer beginnt, hat die Schafe und zieht zuerst; das Gegenüber ist der Wolf",
      l0.rollen.schafe === "a" && l0.rollen.wolf === "b" && l0.dran === "a" && l0.art === "schafe"
      && l0b.rollen.schafe === "b" && l0b.dran === "b" && l0.schafe.join(",") === SCHAFE_START.join(",") && l0.wolf === WOLF_START);
    pruefe("Wolf und Schafe: Ein Schaf geht einen Schritt schräg nach vorn – nicht gerade, nicht zurück, nicht weiter",
      WS.darf(l0, "56-49", "a") && WS.darf(l0, "58-51", "a") && WS.darf(l0, "58-49", "a") && !WS.darf(l0, "56-48", "a")
      && !WS.darf(l0, "56-42", "a") && !WS.darf(lage(["58-49", "3-10"]), "49-58", "a"));
    const l1 = lage(["58-49"]);
    pruefe("Wolf und Schafe: Der Wolf geht schräg in jede Richtung, nur der Wolf, nur wer dran ist",
      l1.dran === "b" && WS.darf(l1, "3-10", "b") && WS.darf(l1, "3-12", "b") && !WS.darf(l1, "3-11", "b") && !WS.darf(l1, "56-47", "b")
      && !WS.darf(l1, "3-10", "a") && WS.darf(lage(["58-49", "3-10"]), "60-51", "a") && WS.darf(lage(["58-49", "3-10", "60-51"]), "10-3", "b"));
    pruefe("Wolf und Schafe: Kein Feld doppelt, kein heller Platz, keine schiefe Schreibweise",
      !WS.darf(lage(["58-49", "3-10"]), "56-49", "a") && WS.darf(lage(["58-49", "3-10"]), "60-51", "a") && !WS.darf(l0, "056-49", "a") && !WS.darf(l0, "56-49x", "a")
      && zuegeVon(l0, "schafe").every(([, b]) => (Math.floor(b / 8) + (b % 8)) % 2 === 1) && lage(["56-48"]).dran === null);
    // Ganze Partien: die Schafe «Schwer» sperren den Wolf ein; zufällige
    // Schafe lassen ihn durch.
    let legal = true;
    let langsam = 0;
    let eingesperrt = 0;
    let durchgebrochen = 0;
    const PAARE = [["schwer", "mittel"], ["schwer", "einfach"], ["leicht", "mittel"], ["leicht", "einfach"], ["einfach", "leicht"], ["mittel", "leicht"], ["einfach", "einfach"], ["leicht", "leicht"]];
    for (let p = 0; p < PAARE.length && legal; p += 1) {
      const [schafe, wolf] = PAARE[p];
      const beginnt = p % 2 ? "b" : "a";
      const zuege = [];
      for (let l = lage(zuege, beginnt); !l.ende; l = lage(zuege, beginnt)) {
        if (zuege.length > 200) { legal = false; break; }
        const art = l.rollen.schafe === l.dran ? "schafe" : "wolf";
        const t = performance.now();
        const z = WS.computer(l, l.dran, art === "schafe" ? schafe : wolf);
        langsam = Math.max(langsam, performance.now() - t);
        if (!WS.darf(l, z, l.dran)) { legal = false; break; }
        zuege.push(z);
      }
      const l = lage(zuege, beginnt);
      if (p < 2 && l.sieger === "schafe" && l.ende === l.rollen.schafe) eingesperrt += 1;
      if (p >= 2 && p < 4 && l.sieger === "wolf" && l.durch && l.ende === l.rollen.wolf) durchgebrochen += 1;
    }
    pruefe("Wolf und Schafe: Jede Stufe zieht als Schafe und als Wolf nur, was erlaubt ist, bis die Partie aus ist", legal);
    pruefe(`Wolf und Schafe: Die Schafe auf «Schwer» sperren den Wolf ein (${eingesperrt} von 2)`, eingesperrt === 2);
    pruefe(`Wolf und Schafe: Zufällige Schafe lassen den Wolf durch – er gewinnt (${durchgebrochen} von 2)`, durchgebrochen === 2);
    pruefe(`Wolf und Schafe: «Schwer» rechnet schnell genug (längstens ${langsam.toFixed(0)} ms)`, langsam < 1500);
  }

  // Rate-Tier: Tiere und Fragen, die geheimen Tiere aus der Saat, fragen,
  // ausschliessen, raten – und ganze Partien Computer gegen Computer.
  const RT = angemeldet.ratetier;
  if (RT?.fuerPruefung) {
    const { FRAGEN, TIERE, geheimeTiere } = RT.fuerPruefung;
    pruefe("Rate-Tier: 16 Tiere, acht Fragen, jedes Tier mit eigener Antwort auf jede Frage, und jedes ist anders",
      TIERE.length === 16 && FRAGEN.length === 8 && TIERE.every((t) => /^[01]{8}$/.test(t.ant) && t.bild && t.wort && ["der", "die", "das"].includes(t.art))
      && new Set(TIERE.map((t) => t.ant)).size === 16 && new Set(TIERE.map((t) => t.wort)).size === 16);
    pruefe("Rate-Tier: Jede Frage teilt die Tiere (es gibt Ja und Nein)",
      FRAGEN.every((_, q) => TIERE.some((t) => t.ant[q] === "1") && TIERE.some((t) => t.ant[q] === "0")));
    const gezogen = { a: new Set(), b: new Set() };
    let verschieden = true;
    for (let s = 1; s <= 3000; s += 1) { const g = geheimeTiere(s); gezogen.a.add(g.a); gezogen.b.add(g.b); if (g.a === g.b) verschieden = false; }
    pruefe("Rate-Tier: Die geheimen Tiere kommen aus der Saat, sind verschieden, und jedes kommt vor",
      verschieden && gezogen.a.size === 16 && gezogen.b.size === 16 && JSON.stringify(geheimeTiere(42)) === JSON.stringify(geheimeTiere(42)));
    const saat = 4242;
    const g = geheimeTiere(saat);
    const lage = (zuege, beginnt = "a") => RT.lage(zuege, { roh: zuege.join("."), beginnt, saat });
    const l0 = lage([]);
    pruefe("Rate-Tier: Zu Beginn ist jedes Tier möglich, wer beginnt, ist dran", l0.moeglich.a.length === 16 && l0.dran === "a" && lage([], "b").dran === "b");
    const l1 = lage(["F2"]);
    pruefe("Rate-Tier: Eine Frage – die Antwort kommt vom Tier der anderen, was nicht passt, fällt weg, die andere ist dran",
      l1.fragen.a[0]?.ja === (TIERE[g.b].ant[2] === "1") && l1.moeglich.a.includes(g.b) && l1.moeglich.a.every((t) => TIERE[t].ant[2] === TIERE[g.b].ant[2])
      && l1.moeglich.a.length < 16 && l1.dran === "b" && l1.moeglich.b.length === 16);
    const falsch = TIERE.map((_, t) => t).find((t) => t !== g.b);
    const l2 = lage([`T${falsch}`]);
    pruefe("Rate-Tier: Falsch geraten – das Tier fällt weg, die andere ist dran", l2.dran === "b" && !l2.ende && !l2.moeglich.a.includes(falsch) && l2.moeglich.a.length === 15);
    const l3 = lage(["F0", "F1", `T${g.b}`]);
    pruefe("Rate-Tier: Richtig geraten – gewonnen", l3.ende === "a" && l3.dran === null);
    pruefe("Rate-Tier: Jede Frage nur einmal, raten nur, was noch möglich ist, nur wer dran ist",
      RT.darf(l0, "F0", "a") && RT.darf(l0, "F7", "a") && !RT.darf(l0, "F8", "a") && !RT.darf(l0, "F0", "b") && !RT.darf(lage(["F0", "F1"]), "F0", "a")
      && RT.darf(lage(["F0", "F1"]), "F1", "a") && !RT.darf(lage(["F0", "F1"]), `T${TIERE.findIndex((t) => t.ant[0] !== TIERE[g.b].ant[0])}`, "a")
      && !RT.darf(l0, "F01", "a") && !RT.darf(l0, "X1", "a") && lage(["F0", "F1", "F0"]).dran === null);
    // Ganze Partien: Computer gegen Computer auf allen Stufen, mit vielen Saaten.
    let legal = true;
    let laenge = 0;
    let schwerSiegt = 0;
    const STUFEN_RT = Object.keys(RT.stufen || {});
    for (let p = 0; p < 200 && legal; p += 1) {
      const [sa, sb] = p < 100 ? [STUFEN_RT[p % 4], STUFEN_RT[(p >> 2) % 4]] : ["schwer", "leicht"];
      const beginnt = p % 2 ? "b" : "a";
      const zuege = [];
      const la = (z) => RT.lage(z, { roh: z.join("."), beginnt, saat: 1000 + p });
      for (let l = la(zuege); !l.ende; l = la(zuege)) {
        if (zuege.length > 48) { legal = false; break; }
        const antwort = RT.computer(l, l.dran, l.dran === "a" ? sa : sb);
        if (!RT.darf(l, antwort?.zug, l.dran)) { legal = false; break; }
        zuege.push(antwort.zug);
      }
      laenge = Math.max(laenge, zuege.length);
      if (p >= 100 && la(zuege).ende === "a") schwerSiegt += 1;
    }
    pruefe(`Rate-Tier: Jede Stufe fragt und rät nur, was erlaubt ist, und jede Partie endet (längstens ${laenge} Züge)`, legal && laenge <= 48);
    pruefe(`Rate-Tier: «Schwer» schlägt «Ganz leicht» meistens (${schwerSiegt} von 100)`, schwerSiegt >= 70);
  }

  // Brückenschlag: die Nachbarn der Sechsecke, Ketten von Rand zu Rand,
  // kein Unentschieden – und ganze Partien Computer gegen Computer.
  const BK = angemeldet.brueckenschlag;
  if (BK?.fuerPruefung) {
    const { N, FELDER, NACHBARN, kette } = BK.fuerPruefung;
    const lage = (zuege, beginnt = "a") => BK.lage(zuege, { roh: zuege.join("."), beginnt, saat: 1 });
    pruefe("Brückenschlag: 7 × 7 Sechsecke, innen sechs Nachbarn, in den Ecken zwei oder drei, und jeder Nachbar kennt den anderen",
      N === 7 && FELDER === 49 && NACHBARN[24].length === 6 && NACHBARN[0].length === 2 && NACHBARN[6].length === 3 && NACHBARN[42].length === 3 && NACHBARN[48].length === 2
      && NACHBARN.every((ns, f) => ns.every((n) => NACHBARN[n].includes(f))));
    const quer = [];
    for (let c = 0; c < 7; c += 1) { quer.push(String(21 + c)); if (c < 6) quer.push(String(c)); }
    const lq = lage(quer);
    pruefe("Brückenschlag: Koralle verbindet links und rechts – die Kette steht fest", lq.ende === "a" && lq.weg?.length === 7 && lage(quer.slice(0, -1)).ende === null);
    // Gold: die rechte Spalte hinunter – (r, 6) und (r + 1, 6) sind Nachbarn.
    // Koralle legt die linke Spalte, das verbindet nichts.
    const runter = [];
    for (let r = 0; r < 7; r += 1) { runter.push(String(r * 7)); runter.push(String(r * 7 + 6)); }
    pruefe("Brückenschlag: Gold verbindet oben und unten", lage(runter, "a").ende === "b" && lage(runter.slice(0, -1), "a").ende === null);
    pruefe("Brückenschlag: Steine, die sich nur über Eck berühren, sind keine Kette", !kette((() => { const b = Array(49).fill(""); [0, 8, 16, 24, 32, 40, 48].forEach((f) => { b[f] = "b"; }); return b; })(), "b"));
    let zufall = 777;
    const wuerfel = () => { zufall = (Math.imul(zufall, 1103515245) + 12345) >>> 0; return zufall / 4294967296; };
    let immer = true;
    for (let p = 0; p < 200; p += 1) {
      const z = [...Array(49).keys()].map(String).sort(() => wuerfel() - 0.5);
      const voll = Array(49).fill("");
      z.forEach((f, i) => { voll[Number(f)] = i % 2 ? "b" : "a"; });
      if (Boolean(kette(voll, "a")) === Boolean(kette(voll, "b"))) immer = false;
    }
    pruefe("Brückenschlag: Ist das Feld voll, hat genau einer eine Kette – nie unentschieden", immer);
    pruefe("Brückenschlag: nur ein freies Feld, nur wer dran ist",
      BK.darf(lage([]), "0", "a") && BK.darf(lage([]), "48", "a") && !BK.darf(lage([]), "49", "a") && !BK.darf(lage([]), "0", "b")
      && !BK.darf(lage(["24"]), "24", "b") && !BK.darf(lage([]), "024", "a") && lage(["24", "24"]).dran === null);
    let legal = true;
    let langsam = 0;
    let schwerSiegt = 0;
    const STUFEN_BK = Object.keys(BK.stufen || {});
    for (let p = 0; p < 14 && legal; p += 1) {
      const [sa, sb] = p < 8 ? [STUFEN_BK[p % 4], STUFEN_BK[3 - (p % 4)]] : ["mittel", "schwer"];
      const beginnt = p % 2 ? "b" : "a";
      const zuege = [];
      for (let l = lage(zuege, beginnt); !l.ende; l = lage(zuege, beginnt)) {
        if (zuege.length > 49) { legal = false; break; }
        const t = performance.now();
        const z = BK.computer(l, l.dran, l.dran === "a" ? sa : sb);
        langsam = Math.max(langsam, performance.now() - t);
        if (!BK.darf(l, z, l.dran)) { legal = false; break; }
        zuege.push(z);
      }
      if (p >= 8 && lage(zuege, beginnt).ende === "b") schwerSiegt += 1;
    }
    pruefe("Brückenschlag: Jede Stufe setzt nur auf freie Felder, bis jemand verbunden hat", legal);
    pruefe(`Brückenschlag: «Schwer» schlägt «Mittel» meistens (${schwerSiegt} von 6)`, schwerSiegt >= 4);
    pruefe(`Brückenschlag: «Schwer» rechnet schnell (längstens ${langsam.toFixed(0)} ms)`, langsam < 800);
  }

  // Steine kippen: einklemmen in alle acht Richtungen, aussetzen, das Ende –
  // und ganze Partien Computer gegen Computer.
  const KP = angemeldet.kippen;
  if (KP?.fuerPruefung) {
    const { kippt, anfang } = KP.fuerPruefung;
    const lage = (zuege, beginnt = "a") => KP.lage(zuege, { roh: zuege.join("."), beginnt, saat: 1 });
    const l0 = lage([]);
    pruefe("Steine kippen: Vier Steine über Kreuz, wer beginnt, hat vier Möglichkeiten",
      l0.punkte.a === 2 && l0.punkte.b === 2 && l0.moeglich.join(",") === "19,26,37,44" && lage([], "b").moeglich.join(",") === "20,29,34,43");
    const l1 = lage(["19"]);
    pruefe("Steine kippen: Ein Stein klemmt ein – der eingeklemmte kippt, die andere ist dran",
      l1.brett[19] === "a" && l1.brett[27] === "a" && l1.punkte.a === 4 && l1.punkte.b === 1 && l1.dran === "b" && l1.letzter.gekippt.join() === "27");
    // In mehrere Richtungen zugleich: b auf 0 klemmt waagrecht, senkrecht und schräg ein.
    const stern = Array(64).fill("");
    [1, 8, 9].forEach((f) => { stern[f] = "a"; });
    [2, 16, 18].forEach((f) => { stern[f] = "b"; });
    pruefe("Steine kippen: In mehrere Richtungen zugleich, nur was eingeklemmt ist", kippt(stern, 0, "b").sort((x, y) => x - y).join() === "1,8,9" && kippt(stern, 0, "a").length === 0 && kippt(anfang(), 0, "a").length === 0);
    pruefe("Steine kippen: nur wo etwas kippt, nur wer dran ist",
      KP.darf(l0, "19", "a") && !KP.darf(l0, "18", "a") && !KP.darf(l0, "27", "a") && !KP.darf(l0, "19", "b") && !KP.darf(l0, "019", "a")
      && lage(["18"]).dran === null);
    // Ganze Partien: zufällig (mit Saat) – die Zahl stimmt, Aussetzen kommt
    // vor, es gibt Unentschieden; dann Computer gegen Computer.
    let zufall = 4242;
    const wuerfel = () => { zufall = (Math.imul(zufall, 1103515245) + 12345) >>> 0; return zufall / 4294967296; };
    let stimmt = true;
    let ausgesetzt = false;
    let remis = null;
    for (let p = 0; p < 400; p += 1) {
      const zuege = [];
      for (let l = lage(zuege); !l.ende; l = lage(zuege)) {
        zuege.push(String(l.moeglich[Math.floor(wuerfel() * l.moeglich.length)]));
        const n = lage(zuege);
        if (n.aussetzen) ausgesetzt = true;
        if (n.punkte.a + n.punkte.b !== zuege.length + 4) stimmt = false;
      }
      const l = lage(zuege);
      if (l.ende !== (l.punkte.a > l.punkte.b ? "a" : l.punkte.b > l.punkte.a ? "b" : "u") || KP.fuerPruefung.moeglich(l.brett, "a").length || KP.fuerPruefung.moeglich(l.brett, "b").length) stimmt = false;
      if (l.ende === "u") remis = l;
    }
    pruefe("Steine kippen: Jeder Zug legt einen Stein dazu; aus ist es erst, wenn niemand mehr setzen kann – wer mehr hat, gewinnt", stimmt);
    pruefe("Steine kippen: Wer nicht setzen kann, setzt aus", ausgesetzt);
    pruefe("Steine kippen: Gleich viele ist unentschieden", remis?.punkte.a === remis?.punkte.b && Boolean(remis));
    let legal = true;
    let langsam = 0;
    let schwerSiegt = 0;
    const STUFEN_KP = Object.keys(KP.stufen || {});
    for (let p = 0; p < 12 && legal; p += 1) {
      const [sa, sb] = p < 8 ? [STUFEN_KP[p % 4], STUFEN_KP[3 - (p % 4)]] : ["mittel", "schwer"];
      const beginnt = p % 2 ? "b" : "a";
      const zuege = [];
      for (let l = lage(zuege, beginnt); !l.ende; l = lage(zuege, beginnt)) {
        const t = performance.now();
        const antwort = KP.computer(l, l.dran, l.dran === "a" ? sa : sb);
        langsam = Math.max(langsam, performance.now() - t);
        if (!KP.darf(l, antwort?.zug, l.dran)) { legal = false; break; }
        zuege.push(antwort.zug);
      }
      if (p >= 8 && lage(zuege, beginnt).ende === "b") schwerSiegt += 1;
    }
    pruefe("Steine kippen: Jede Stufe setzt nur, wo etwas kippt, bis die Partie aus ist", legal);
    pruefe(`Steine kippen: «Schwer» schlägt «Mittel» (${schwerSiegt} von 4)`, schwerSiegt >= 3);
    pruefe(`Steine kippen: «Schwer» rechnet schnell (längstens ${langsam.toFixed(0)} ms)`, langsam < 1500);
  }

  // Der Computer, ohne Browser: Er erkennt vier in jeder Richtung, setzt nur
  // in freie Spalten, nimmt auf «schwer» jeden Sieg und hält jede Drohung auf.
  const kasten = { window: {} };
  vm.runInNewContext(lies("viererreihe-ki.js"), kasten);
  const V = kasten.window.LernappVierer;
  pruefe("viererreihe-ki.js setzt window.LernappVierer", Boolean(V?.computerZug && V?.ausZuegen));
  if (V) {
    const sieger = (zuege) => V.ausZuegen(zuege, 1).sieger;
    pruefe("Viererreihe: waagrecht, senkrecht und beide Schrägen gewinnen",
      sieger("0011223") === 1 && sieger("0101010") === 1 && sieger("01122323363") === 1 && sieger("65544343303") === 1);
    pruefe("Viererreihe: drei in einer Reihe sind noch nichts, ein volles Brett ohne Reihe ist unentschieden",
      sieger("001122") === null && sieger("350551066612006344650023554224613143421312") === 0);
    pruefe("Viererreihe: ein Zug nach dem Ende oder in eine volle Spalte ist ungültig",
      V.ausZuegen("00112233", 1).gueltig === false && V.ausZuegen("0000000", 1).gueltig === false);
    let zufall = 12345;
    const wuerfel = () => { zufall = (Math.imul(zufall, 1103515245) + 12345) >>> 0; return zufall / 4294967296; };
    let legal = true;
    for (let partie = 0; partie < 30 && legal; partie += 1) {
      const b = V.neuesBrett();
      let p = 1;
      for (let zug = 0; zug < 42; zug += 1) {
        const c = V.computerZug(b, p, V.STUFEN[partie % 3], { zufall: wuerfel, zeit: 30 });
        if (!V.frei(b, c)) { legal = false; break; }
        const r = V.setze(b, c, p);
        if (V.viererBei(b, c, r)) break;
        p = 3 - p;
      }
    }
    pruefe("Viererreihe: Ganz leicht, Einfach und Mittel setzen in 30 Partien nur in freie Spalten", legal);
    pruefe("Viererreihe: vier Stufen, von ganz leicht bis schwer", JSON.stringify([...V.STUFEN]) === JSON.stringify(["leicht", "einfach", "mittel", "schwer"]));
    const schwer = (zuege) => { const l = V.ausZuegen(zuege, 1); return V.computerZug(l.brett, l.amZug, "schwer", { zufall: wuerfel, zeit: 150 }); };
    // 061626: Rot hat unten 0, 1, 2 – und Gold dreimal in Spalte 6. Rot ist
    // dran und gewinnt mit 3. Einen Stein vorher (06162) ist Gold dran und
    // muss 3 zumachen.
    pruefe("Viererreihe: Schwer nimmt den Sieg", schwer("061626") === 3);
    pruefe("Viererreihe: Schwer hält die Drohung auf", schwer("06162") === 3);
  }
}

if (fehler.length) {
  console.error(`✗ ${fehler.length} von ${geprueft} Prüfungen fehlgeschlagen:\n`);
  for (const f of fehler) console.error(`   · ${f}`);
  console.error("\nErinnerung: Ein neues Spiel braucht auch eine Zeile in firestore.rules (miniSpiele).");
  process.exit(1);
}
console.log(`✓ ${geprueft} Prüfungen – ${SPIELE.length} Spiele, Fassung ${FASSUNG}.`);
