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
  pruefe("Die Turnierseite stellt die Spiele zu zweit hin (vorne in der Zeile oder als Karten)",
    /href = turnierId \? `\/\$\{spiel\.seite\}\?turnier=\$\{encodeURIComponent\(turnierId\)\}`/.test(miniJs)
    && /vorne,\n/.test(turnierJsVr) && /zweiBauen\(t, \{ gross: true \}\)/.test(turnierJsVr));
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
  const kunst = miniJs.match(/const ZWEI_KUNST = \{([\s\S]*?)\n  \};/)?.[1] || "";
  for (const z of ZWEI) {
    const id = ZWEI_IN_MINI.find((m) => m.seite === z.seite)?.id;
    const kasten = { window: {}, document: { body: { dataset: { page: z.seite } } } };
    kasten.window.LernappZwei = { starte: (spiel) => { angemeldet[z.seite] = spiel; }, el: () => ({}), anderer: (s) => (s === "a" ? "b" : "a") };
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
