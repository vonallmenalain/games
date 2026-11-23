/*
 * Viererreihe im Browser: gegen den Computer und zu zweit live.
 * ---------------------------------------------------------------------------
 * Gegen den Emulator der Realtime Database, mit den echten Regeln
 * (database.rules.json), spielen drei Browserfenster: Papa eröffnet ein
 * Duell, Lena tritt mit den vier Ziffern bei (und sagt dabei erst ihren
 * Namen), Zoe öffnet den Link und schaut zu. Gespielt wird eine Partie bis
 * zum Sieg, dann eine zweite – die beginnt der andere. Dazu eine Partie gegen
 * den Computer, bis sie zu Ende ist, und das Bild auf drei Grössen. Dann im
 * Turnier: Lena eröffnet, und Mia – die Kleine, die noch nicht liest –
 * findet auf der Turnierseite «Lena wartet!» und mit einem Tipp auf «Mit Lena
 * spielen» ans Brett, ohne Code und ohne Link.
 *
 * Firestore wird nicht angefasst: cloud.js ist eine Attrappe, die nur die
 * Verbindung zum Emulator herstellt.
 *
 * Aufruf:  node scripts/check-viererreihe.mjs        (npm run pruefen:viererreihe)
 * Nötig:   Java (für den Emulator), Playwright, einmalig `npm install`.
 *          Emulator und lokaler Server werden selbst gestartet und beendet.
 *          Läuft der Emulator schon, reicht FIREBASE_DATABASE_EMULATOR_HOST.
 *          BILDER=<ordner> legt Bildschirmfotos dort ab.
 */
import { spawn, spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { mkdtempSync, readFileSync, writeFileSync, existsSync, rmSync, mkdirSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const HIER = path.dirname(fileURLToPath(import.meta.url));
const WURZEL = path.resolve(HIER, "..");
const PROJEKT = "demo-mini-vierer";
const NAMENSRAUM = "games-a0cd4-default-rtdb";

// --- Aussen: den Emulator starten und sich selbst darin noch einmal aufrufen ---
if (!process.env.FIREBASE_DATABASE_EMULATOR_HOST) {
  const firebase = path.join(WURZEL, "node_modules", ".bin", "firebase");
  if (!existsSync(firebase)) {
    console.error("firebase-tools fehlt – einmalig `npm install` im Wurzelverzeichnis.");
    process.exit(2);
  }
  const java = spawnSync("java", ["-version"], { stdio: "ignore" });
  if (java.error || java.status !== 0) {
    console.error("Java fehlt – ohne Java startet der Emulator nicht.");
    process.exit(2);
  }
  const ordner = mkdtempSync(path.join(os.tmpdir(), "mini-vierer-"));
  const konfig = path.join(ordner, "firebase.json");
  writeFileSync(konfig, JSON.stringify({ emulators: { database: { host: "127.0.0.1", port: 9000 }, ui: { enabled: false } } }));
  const innen = `${JSON.stringify(process.execPath)} ${JSON.stringify(fileURLToPath(import.meta.url))}`;
  const lauf = spawnSync(firebase, ["emulators:exec", "--config", konfig, "--only", "database", "--project", PROJEKT, innen], {
    cwd: WURZEL,
    stdio: "inherit",
  });
  rmSync(ordner, { recursive: true, force: true });
  process.exit(lauf.status ?? 1);
}

// --- Innen ------------------------------------------------------------------------
const EMULATOR = process.env.FIREBASE_DATABASE_EMULATOR_HOST;
const PORT = Number(process.env.PORT || 4294);
const BASIS = `http://127.0.0.1:${PORT}`;
const BILDER = process.env.BILDER || "";
if (BILDER) mkdirSync(BILDER, { recursive: true });

const befunde = [];
let geprueft = 0;
const pruefe = (bedingung, was) => { geprueft += 1; if (!bedingung) befunde.push(was); };

let playwright;
try { playwright = createRequire(import.meta.url)("playwright"); }
catch {
  console.error("Playwright fehlt – einmalig `npm i`.");
  process.exit(2);
}

const db = (pfad, optionen = {}) => fetch(`http://${EMULATOR}/${pfad}.json?ns=${NAMENSRAUM}`, { headers: { Authorization: "Bearer owner" }, ...optionen });

// Die Regeln in den Namensraum, den die Seite benutzt – und leer anfangen.
{
  const antwort = await fetch(`http://${EMULATOR}/.settings/rules.json?ns=${NAMENSRAUM}`, {
    method: "PUT",
    headers: { Authorization: "Bearer owner" },
    body: readFileSync(path.join(WURZEL, "database.rules.json"), "utf8"),
  });
  if (!antwort.ok) {
    console.error(`Die Regeln liessen sich nicht laden: ${antwort.status} ${await antwort.text()}`);
    process.exit(2);
  }
  await db("partie", { method: "DELETE" });
  await db("partieCode", { method: "DELETE" });
  await db("partieOffen", { method: "DELETE" });
}

const server = spawn(process.execPath, [path.join(HIER, "local-pwa-server.cjs"), String(PORT)], { cwd: WURZEL, stdio: "ignore" });
const halt = () => { if (!server.killed) server.kill(); };
process.on("exit", halt);
for (let versuch = 0; versuch < 50; versuch += 1) {
  try { if ((await fetch(`${BASIS}/index.html`)).ok) break; } catch { /* noch nicht da */ }
  await new Promise((weiter) => setTimeout(weiter, 100));
}

const SDK = new Map(["app", "firestore", "auth", "database"].map((teil) => [
  teil, readFileSync(path.join(WURZEL, "node_modules", "firebase", `firebase-${teil}-compat.js`), "utf8"),
]));

const TURNIER_ID = "familie-k3m9x2p7";
const NUR_VIERER = "nurvierer-k3m9x2p7";
const ATTRAPPE = `
(() => {
  let app = null;
  const turnier = (id, mehr) => ({
    id, name: "Familienturnier", beschreibung: "", spiele: ["towerStack"],
    startMs: Date.now() - 3600000, endeMs: Date.now() + 86400000, versuche: 0, zaehlt: "bester", wertung: "platz",
    aufgaben: "gleich", sichtbar: "link", verdeckt: false, ohneGeist: false, ohneReplay: false, ohneLive: false,
    nurLive: false, viererreihe: true, aktiv: true, spitzeWartet: false, ...mehr,
  });
  const TURNIERE = {
    "${TURNIER_ID}": turnier("${TURNIER_ID}"),
    "${NUR_VIERER}": turnier("${NUR_VIERER}", { name: "Nur Viererreihe", spiele: [] }),
  };
  const basis = {
    async turnier(id) { return TURNIERE[id] || null; },
    turnierHoeren(id, { beiTurnier = () => {}, beiEintraegen = () => {} } = {}) {
      setTimeout(() => { beiTurnier(TURNIERE[id] || null); beiEintraegen([]); }, 30);
      return () => {};
    },
    async turnierErgebnisse() { return []; },
    // Die Spiele zu zweit auf der Startseite (config/miniGames, zweiSpieler):
    // was die Prüfung in window.__zweiSpieler hinlegt.
    async offeneZweiSpieler() { return window.__zweiSpieler || []; },
    async turnierLive() { return []; },
    async liveZeiger() { return null; },
    async offeneDuelle(id) {
      const antwort = await fetch("http://${EMULATOR}/partieOffen/" + id + ".json?ns=${NAMENSRAUM}");
      const d = (await antwort.json()) || {};
      return Object.entries(d).map(([raum, o]) => ({ raum, name: o.name, kennung: o.kennung, spiel: o.spiel, seit: o.seit }));
    },
    app() {
      if (app) return app;
      app = firebase.apps.length ? firebase.app() : firebase.initializeApp({
        apiKey: "demo", projectId: "games-a0cd4",
        databaseURL: "https://games-a0cd4-default-rtdb.europe-west1.firebasedatabase.app",
      });
      return app;
    },
    projektId: "games-a0cd4",
    NAME_MAX: 24,
    async alleTurniere() { return []; },
    async offeneMultiplayer() { return []; },
    async ergebnisse() { return []; },
    async geister() { return []; },
    async offeneSpiele() { return null; },
    async tiers() { return null; },
  };
  window.MiniCloud = new Proxy(basis, { get: (t, k) => (k in t ? t[k] : async () => null) });
})();
`;

const browser = await playwright.chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
const fehlerAufSeite = [];

async function geraet(name, { viewport = { width: 400, height: 820 }, mitName = true } = {}) {
  const kontext = await browser.newContext({ viewport, serviceWorkers: "block", deviceScaleFactor: 1 });
  await kontext.route("https://www.gstatic.com/firebasejs/**", (route) => {
    const teil = (route.request().url().match(/firebase-(\w+)-compat\.js/) || [])[1];
    route.fulfill({ contentType: "text/javascript; charset=utf-8", body: SDK.get(teil) || "/* unbekannt */" });
  });
  await kontext.route("**/cloud.js*", (route) => route.fulfill({ contentType: "text/javascript; charset=utf-8", body: ATTRAPPE }));
  await kontext.addInitScript(({ name, mitName, emulator }) => {
    window.__viererTest = { emulator };
    try { if (mitName && !localStorage.getItem("mini.name")) localStorage.setItem("mini.name", name); } catch { /* egal */ }
  }, { name, mitName, emulator: EMULATOR });
  const seite = await kontext.newPage();
  seite.on("pageerror", (fehler) => fehlerAufSeite.push(`${name}: ${fehler.message || fehler}`));
  seite.on("console", (n) => {
    if (n.type() !== "error") return;
    const text = n.text();
    if (/emulator/i.test(text)) return;
    fehlerAufSeite.push(`${name}: ${text}`);
  });
  return { name, kontext, seite };
}

const warte = (ms) => new Promise((weiter) => setTimeout(weiter, ms));
async function bis(frage, { ms = 15000, schritt = 100 } = {}) {
  const ende = Date.now() + ms;
  while (Date.now() < ende) {
    try { if (await frage()) return true; } catch { /* gleich noch einmal */ }
    await warte(schritt);
  }
  return false;
}
const satz = (seite) => seite.locator(".vr-satz-text").textContent().catch(() => "");
const steine = (seite) => seite.evaluate(() => [...document.querySelectorAll(".vr-steine .vr-stein")].filter((s) => !s.getAnimations().some((a) => a.effect?.getKeyframes?.().some((k) => k.opacity === 0))).length);
const bild = async (seite, name) => { if (BILDER) await seite.screenshot({ path: path.join(BILDER, `${name}.png`) }); };

try {
  // --- 1. Das Menü und eine Partie gegen den Computer ----------------------------
  const papa = await geraet("Papa");
  await papa.seite.goto(`${BASIS}/viererreihe`);
  pruefe(await bis(() => papa.seite.locator(".vr-stufe").count().then((n) => n === 4)), "Das Menü zeigt vier Stufen");
  pruefe(await papa.seite.locator(".vr-eroeffnen").isVisible(), "Das Menü bietet ein Duell an");
  await bild(papa.seite, "1-menue");

  await papa.seite.locator('.vr-stufe[data-stufe="einfach"]').click();
  pruefe(await bis(() => papa.seite.locator(".vr-spalte").count().then((n) => n === 7)), "Gegen den Computer: sieben Spalten");
  pruefe(/Du beginnst/.test(await satz(papa.seite)), "Gegen den Computer beginnst du die erste Partie");
  pruefe(new URL(papa.seite.url()).searchParams.get("gegen") === "einfach", "Die Adresse sagt die Stufe");
  // Spielen, bis es vorbei ist: immer die erste freie Spalte von der Mitte aus.
  let zuege = 0;
  for (let runde = 0; runde < 30; runde += 1) {
    if (await papa.seite.locator(".vr-nochmal").count()) break;
    const dran = await bis(async () => (await papa.seite.locator(".vr-spalte:not([disabled])").count()) > 0 || (await papa.seite.locator(".vr-nochmal").count()) > 0, { ms: 8000 });
    if (!dran || await papa.seite.locator(".vr-nochmal").count()) break;
    for (const c of [3, 2, 4, 1, 5, 0, 6]) {
      const k = papa.seite.locator(`.vr-spalte[data-spalte="${c}"]`);
      if (await k.isEnabled()) { await k.click(); zuege += 1; break; }
    }
    if (zuege === 1) {
      pruefe(await bis(() => steine(papa.seite).then((n) => n >= 1)), "Der erste Stein liegt");
      pruefe(await bis(() => satz(papa.seite).then((t) => /Computer überlegt/.test(t)), { ms: 1500 }), "Der Computer überlegt sichtbar");
      pruefe(await bis(() => steine(papa.seite).then((n) => n >= 2), { ms: 5000 }), "Der Computer setzt");
      await bild(papa.seite, "2-computer");
    }
    await warte(150);
  }
  pruefe(await bis(() => papa.seite.locator(".vr-nochmal").count().then((n) => n === 1), { ms: 10000 }), "Die Partie gegen den Computer kommt zu einem Ende");
  const ende = await satz(papa.seite);
  pruefe(/gewonnen|Unentschieden/.test(ende), `Am Ende steht, wer gewonnen hat (${ende})`);
  const bilanz = await papa.seite.evaluate(() => JSON.parse(localStorage.getItem("viererreihe.bilanz") || "{}"));
  const gezaehlt = (bilanz.einfach?.s || 0) + (bilanz.einfach?.n || 0) + (bilanz.einfach?.u || 0);
  pruefe(gezaehlt === 1, `Die Bilanz zählt die Partie (${JSON.stringify(bilanz)})`);
  if (/Du hast gewonnen/.test(ende)) pruefe(await papa.seite.locator(".vr-stein.ist-sieg").count() >= 4, "Die Siegerreihe leuchtet");
  await warte(900);
  await bild(papa.seite, "3-computer-ende");
  await papa.seite.locator(".vr-nochmal").click();
  pruefe(await bis(() => satz(papa.seite).then((t) => /Computer beginnt|Computer überlegt/.test(t))), "Die zweite Partie beginnt der Computer");
  pruefe(await bis(() => steine(papa.seite).then((n) => n === 1), { ms: 6000 }), "Der Computer setzt den ersten Stein der zweiten Partie");
  await papa.seite.locator(".vr-menue-knopf").click();
  pruefe(await bis(() => papa.seite.locator(".vr-stufe").count().then((n) => n === 4)), "Zurück im Menü");
  pruefe(/gewonnen|verloren/.test(await papa.seite.locator('.vr-stufe[data-stufe="einfach"] .vr-stufe-bilanz').textContent()), "Das Menü zeigt die Bilanz der Stufe");

  // --- 2. Ein Duell eröffnen ---------------------------------------------------------
  await papa.seite.locator(".vr-eroeffnen").click();
  pruefe(await bis(() => papa.seite.locator(".vr-grosscode .vr-ziffer").count().then((n) => n === 4)), "Wer eröffnet, sieht vier Ziffern");
  const code = (await papa.seite.locator(".vr-grosscode").textContent()).trim();
  const raum = new URL(papa.seite.url()).searchParams.get("raum") || "";
  pruefe(/^[0-9]{4}$/.test(code), `Der Code hat vier Ziffern (${code})`);
  pruefe(/^[A-Z2-9]{10}$/.test(raum), `Der Raum steht in der Adresse (${raum})`);
  pruefe((await papa.seite.locator(".vr-link").textContent()).endsWith(`/viererreihe?raum=${raum}`), "Der Link zeigt auf den Raum");
  const zettel = await (await db(`partieCode/${code}`)).json();
  pruefe(zettel?.raum === raum, "Der Code führt zum Raum");
  await bild(papa.seite, "4-lobby");

  // --- 3. Lena tritt mit dem Code bei – noch ohne Namen ----------------------------------
  const lena = await geraet("Lena", { mitName: false, viewport: { width: 820, height: 1000 } });
  await lena.seite.goto(`${BASIS}/viererreihe`);
  await lena.seite.locator(".vr-code-feld").fill("12a");
  pruefe((await lena.seite.locator(".vr-code-feld").inputValue()) === "12", "Ins Codefeld kommen nur Ziffern");
  await lena.seite.locator(".vr-code-feld").fill("0000");
  await lena.seite.locator(".vr-code-ok").click();
  pruefe(await bis(() => lena.seite.locator(".vr-namensfeld input").count().then((n) => n === 1)), "Ohne Namen fragt die Seite zuerst danach");
  await lena.seite.locator(".vr-namensfeld input").fill("Lena");
  await lena.seite.locator(".vr-namensfeld button[type=submit]").click();
  pruefe(await bis(() => lena.seite.locator(".vr-meldung").textContent().then((t) => /gibt es nicht/.test(t))), "Ein falscher Code sagt, dass es ihn nicht gibt");
  await lena.seite.locator(".vr-code-feld").fill(code);
  await lena.seite.locator(".vr-code-ok").click();
  pruefe(await bis(() => lena.seite.locator(".vr-spalte").count().then((n) => n === 7)), "Mit dem Code sitzt Lena am Brett");
  pruefe(await bis(() => papa.seite.locator(".vr-spalte").count().then((n) => n === 7)), "Papa sieht das Brett, sobald Lena da ist");
  pruefe(await bis(async () => (await (await db(`partieCode/${code}`)).json()) === null), "Der Code ist weg, sobald der Raum voll ist");
  pruefe(/Du beginnst/.test(await satz(papa.seite)), "Wer eröffnet, beginnt");
  pruefe(/Papa ist dran/.test(await satz(lena.seite)), "Lena sieht, dass Papa dran ist");
  pruefe(await lena.seite.locator(".vr-spalte:not([disabled])").count() === 0, "Lena kann nicht setzen, solange Papa dran ist");
  pruefe((await lena.seite.locator(".vr-wer.ist-b .vr-wer-name").textContent()).includes("Lena"), "Lena steht unter ihrem Namen auf b");

  // --- 4. Eine Partie: Papa senkrecht in Spalte 0 ---------------------------------------
  const setze = async (g, c, nr) => {
    pruefe(await bis(() => g.seite.locator(`.vr-spalte[data-spalte="${c}"]:not([disabled])`).count().then((n) => n === 1)), `${g.name} darf Zug ${nr} setzen`);
    await g.seite.locator(`.vr-spalte[data-spalte="${c}"]`).click();
  };
  const folge = [[papa, 0], [lena, 1], [papa, 0], [lena, 1], [papa, 0], [lena, 1]];
  for (let i = 0; i < folge.length; i += 1) await setze(folge[i][0], folge[i][1], i + 1);
  pruefe(await bis(() => steine(lena.seite).then((n) => n === 6)), "Lena sieht alle sechs Steine");
  pruefe(await bis(() => steine(papa.seite).then((n) => n === 6)), "Papa sieht alle sechs Steine");
  await bild(lena.seite, "5-duell-lena");

  // Zoe öffnet den Link: Der Raum ist voll, sie schaut zu.
  const zoe = await geraet("Zoe");
  await zoe.seite.goto(`${BASIS}/viererreihe?raum=${raum}`);
  pruefe(await bis(() => zoe.seite.locator(".vr-zuschauen").count().then((n) => n === 1)), "Wer später mit dem Link kommt, schaut zu");
  pruefe(await bis(() => steine(zoe.seite).then((n) => n === 6)), "Wer zuschaut, sieht das Brett");
  pruefe(await zoe.seite.locator(".vr-spalte:not([disabled])").count() === 0, "Wer zuschaut, kann nicht setzen");

  await setze(papa, 0, 7);
  pruefe(await bis(() => satz(papa.seite).then((t) => /Du hast gewonnen/.test(t))), "Papa hat gewonnen – bei Papa");
  pruefe(await bis(() => satz(lena.seite).then((t) => /Papa hat gewonnen/.test(t))), "Papa hat gewonnen – bei Lena");
  pruefe(await bis(() => satz(zoe.seite).then((t) => /Papa hat gewonnen/.test(t))), "Papa hat gewonnen – bei Zoe");
  pruefe(await bis(() => lena.seite.locator(".vr-stein.ist-sieg").count().then((n) => n === 4)), "Bei Lena leuchten die vier");
  const ring = await lena.seite.evaluate(() => parseFloat(getComputedStyle(document.querySelector(".vr-stein.ist-sieg"), "::after").borderTopWidth) || 0);
  pruefe(ring >= 2, `Um die vier liegt ein Ring (${ring}px)`);
  // Gegen den Emulator ist die Partie in einer Sekunde gespielt – gemessen
  // wird, wenn alle Steine gefallen sind.
  await bis(() => lena.seite.evaluate(() => [...document.querySelectorAll(".vr-steine .vr-stein")].every((s) => !s.getAnimations().length)), { ms: 4000 });
  const masz = await lena.seite.evaluate(() => {
    const brett = document.querySelector(".vr-brett").getBoundingClientRect();
    const stein = document.querySelector(".vr-steine .vr-stein").getBoundingClientRect();
    return { zelle: brett.width / 7, breit: stein.width, hoch: stein.height, unten: brett.bottom - stein.bottom };
  });
  pruefe(Math.abs(masz.breit - masz.zelle) < 1 && Math.abs(masz.hoch - masz.zelle) < 1 && Math.abs(masz.unten) < 1,
    `Ein Stein ist eine Zelle gross und liegt unten im Brett (${JSON.stringify(masz)})`);
  pruefe((await lena.seite.locator(".vr-wer.ist-a .vr-wer-zahl").textContent()) === "1", "Die Bilanz: Papa 1");
  pruefe(await lena.seite.locator(".vr-spalte:not([disabled])").count() === 0, "Nach dem Sieg setzt niemand mehr");
  await warte(700);
  await bild(lena.seite, "6-duell-sieg");

  // --- 5. Nochmal: jetzt beginnt Lena ---------------------------------------------------
  await lena.seite.locator(".vr-nochmal").click();
  pruefe(await bis(() => satz(lena.seite).then((t) => /Du beginnst/.test(t))), "Die zweite Partie beginnt Lena");
  pruefe(await bis(() => satz(papa.seite).then((t) => /Lena ist dran/.test(t))), "Papa sieht, dass Lena beginnt");
  pruefe(await bis(() => steine(papa.seite).then((n) => n === 0), { ms: 3000 }), "Das Brett ist leer");
  await setze(lena, 3, 1);
  pruefe(await bis(() => steine(papa.seite).then((n) => n === 1)), "Papa sieht Lenas Stein");
  pruefe((await papa.seite.locator(".vr-wer.ist-a .vr-wer-zahl").textContent()) === "1", "Die Bilanz bleibt über die Partie hinaus");
  const stand = await (await db(`partie/${raum}/stand`)).json();
  pruefe(stand?.serie === "a" && stand?.beginnt === "b" && stand?.zuege === "3" && stand?.nr === 1, `Der Stand in der Datenbank (${JSON.stringify(stand)})`);

  // --- 6. Papa lädt neu und sitzt wieder auf a --------------------------------------------
  await papa.seite.reload();
  pruefe(await bis(() => satz(papa.seite).then((t) => /Du bist dran/.test(t))), "Nach dem Neuladen ist Papa wieder Papa – und dran");
  pruefe(await bis(() => steine(papa.seite).then((n) => n === 1)), "Nach dem Neuladen liegt der Stein noch");
  // Papa geht ins Menü: Lena sieht ihn als «nicht verbunden», das Menü bietet das Duell zum Weiterspielen an.
  await papa.seite.locator(".vr-menue-knopf").click();
  pruefe(await bis(() => lena.seite.locator(".vr-wer.ist-a.ist-weg").count().then((n) => n === 1)), "Lena sieht, dass Papa weg ist");
  pruefe(await bis(() => papa.seite.locator(".vr-weiter-knopf").count().then((n) => n >= 1)), "Im Menü steht das Duell zum Weiterspielen");
  pruefe(/Lena/.test(await papa.seite.locator(".vr-weiter-knopf").first().textContent()), "… mit dem Namen des Gegenübers");
  await papa.seite.locator(".vr-weiter-knopf").first().click();
  pruefe(await bis(() => satz(papa.seite).then((t) => /Du bist dran/.test(t))), "Weiterspielen führt zurück ans Brett");
  pruefe(await bis(() => lena.seite.locator(".vr-wer.ist-a.ist-weg").count().then((n) => n === 0)), "Lena sieht, dass Papa zurück ist");

  // --- 7. Das Bild auf drei Grössen ------------------------------------------------------
  const quer = await geraet("Quer", { viewport: { width: 844, height: 390 } });
  await quer.seite.goto(`${BASIS}/viererreihe?raum=${raum}`);
  pruefe(await bis(() => steine(quer.seite).then((n) => n === 1)), "Quer: das Brett steht");
  const masse = await quer.seite.evaluate(() => {
    const f = document.querySelector(".vr-feld").getBoundingClientRect();
    return { unten: f.bottom, hoehe: window.innerHeight, breite: document.documentElement.scrollWidth, fenster: window.innerWidth };
  });
  pruefe(masse.unten <= masse.hoehe + 1, `Quer: das Brett passt in die Höhe (${Math.round(masse.unten)} von ${masse.hoehe})`);
  pruefe(masse.breite <= masse.fenster, "Quer: nichts ragt seitlich hinaus");
  await bild(quer.seite, "7-quer");
  for (const [g, name] of [[papa, "Papa (Handy hoch)"], [lena, "Lena (Tablet)"]]) {
    const m = await g.seite.evaluate(() => ({ breite: document.documentElement.scrollWidth, fenster: window.innerWidth, unten: document.querySelector(".vr-knoepfe")?.getBoundingClientRect().bottom || 0, hoehe: window.innerHeight }));
    pruefe(m.breite <= m.fenster, `${name}: nichts ragt seitlich hinaus`);
    pruefe(m.unten <= m.hoehe + 1, `${name}: die Knöpfe stehen im Bild (${Math.round(m.unten)} von ${m.hoehe})`);
  }

  // --- 8. Mit dem Link und ohne Namen ---------------------------------------------------
  const mia = await geraet("Mia");
  await mia.seite.goto(`${BASIS}/viererreihe`);
  await mia.seite.locator(".vr-eroeffnen").click();
  pruefe(await bis(() => mia.seite.locator(".vr-warten").count().then((n) => n === 1)), "Mia wartet auf ihr Gegenüber");
  const raum2 = new URL(mia.seite.url()).searchParams.get("raum") || "";
  const max = await geraet("Max", { mitName: false });
  await max.seite.goto(`${BASIS}/viererreihe?raum=${raum2}`);
  pruefe(await bis(() => max.seite.locator(".vr-namensfeld input").count().then((n) => n === 1)), "Ohne Namen fragt der Link zuerst danach");
  pruefe(/Mia fordert dich heraus/.test(await max.seite.locator(".vr-karte-titel").textContent()), "… und sagt, wer herausfordert");
  await max.seite.locator(".vr-namensfeld input").fill("Max");
  await max.seite.locator(".vr-namensfeld button[type=submit]").click();
  pruefe(await bis(() => satz(max.seite).then((t) => /Mia ist dran/.test(t))), "Mit Namen sitzt Max am Brett");
  pruefe(await bis(() => satz(mia.seite).then((t) => /Du beginnst/.test(t))), "Mia sieht das Brett, sobald Max da ist");
  pruefe((await (await db(`partie/${raum2}/b`)).json())?.name === "Max", "In der Datenbank sitzt Max auf b");

  // --- 9. Nicht auf der Startseite ---------------------------------------------------
  await zoe.seite.goto(`${BASIS}/`);
  await zoe.seite.waitForSelector(".ar-kachel", { timeout: 10000 }).catch(() => {});
  await warte(800);
  pruefe(await zoe.seite.locator(".ar-vr-kachel").count() === 0, "Die Startseite zeigt Viererreihe nicht, solange sie nicht angehakt ist");
  // Angehakt für die Hall of Fame: vorne in der Zeile, ohne Turnier.
  await zoe.seite.addInitScript(() => { window.__zweiSpieler = ["viererreihe"]; });
  await zoe.seite.goto(`${BASIS}/`);
  pruefe(await bis(() => zoe.seite.locator('a.ar-vr-kachel[href="/viererreihe"]').count().then((n) => n === 1)), "Angehakt steht Viererreihe vorne in der Zeile der Startseite");
  pruefe(await zoe.seite.locator(".ar-kachel").count() === 47, `Die Zeile zählt weiter 47 Spiele mit Bestenliste (${await zoe.seite.locator(".ar-kachel").count()})`);
  await warte(1500);
  await bild(zoe.seite, "8-startseite-angehakt");
  await zoe.seite.locator("a.ar-vr-kachel").click();
  pruefe(await bis(() => zoe.seite.locator(".vr-stufe").count().then((n) => n === 4)), "Die Kachel führt ins Menü");
  pruefe((await zoe.seite.locator(".vr-kopf .mini-knopf-zurueck").getAttribute("href")) === "/", "Ohne Turnier führt der Weg zurück in die Hall of Fame");

  // --- 10. Im Turnier: Lena eröffnet, Mia findet sie mit einem Tipp -----------------------
  const lenaT = await geraet("Lena", { viewport: { width: 820, height: 1100 } });
  const miaT = await geraet("Mia", { viewport: { width: 820, height: 1100 } });
  await lenaT.seite.goto(`${BASIS}/turnier?t=${TURNIER_ID}`);
  pruefe(await bis(() => lenaT.seite.locator(`a.ar-vr-kachel[href="/viererreihe?turnier=${TURNIER_ID}"]`).count().then((n) => n === 1)), "Im Turnier steht Viererreihe vorne in der Zeile");
  await lenaT.seite.locator("a.ar-vr-kachel").click();
  pruefe(await bis(() => lenaT.seite.locator(".vr-stufe").count().then((n) => n === 4)), "Im Turnier: das Menü mit vier Stufen");
  const zurueck = await lenaT.seite.locator(".vr-kopf .mini-knopf-zurueck").getAttribute("href");
  pruefe(zurueck === `/turnier?t=${TURNIER_ID}`, `Der Weg zurück führt ins Turnier (${zurueck})`);
  const reihenfolge = await lenaT.seite.evaluate(() => [...document.querySelectorAll(".vr-menue > section.vr-karte")].map((k) => k.className));
  pruefe(/vr-karte-live/.test(reihenfolge[0] || ""), "Im Turnier steht «zu zweit» zuoberst");
  await lenaT.seite.locator(".vr-eroeffnen").click();
  pruefe(await bis(() => lenaT.seite.locator(".vr-vorschau-knopf").count().then((n) => n === 1)), "Lena wartet – und sieht, was die anderen sehen");
  pruefe(/Mit Lena spielen/.test(await lenaT.seite.locator(".vr-vorschau-knopf").textContent()), "… «Mit Lena spielen»");
  const raumT = new URL(lenaT.seite.url()).searchParams.get("raum") || "";
  pruefe(new URL(lenaT.seite.url()).searchParams.get("turnier") === TURNIER_ID, "Das Turnier bleibt in der Adresse");
  pruefe(await bis(async () => (await (await db(`partieOffen/${TURNIER_ID}/${raumT}`)).json())?.name === "Lena"), "Lena steht im Turnier als wartend");
  await bild(lenaT.seite, "9-turnier-lena-wartet");

  await miaT.seite.goto(`${BASIS}/turnier?t=${TURNIER_ID}`);
  pruefe(await bis(() => miaT.seite.locator(".ar-vr-kachel.ist-wartet").count().then((n) => n === 1), { ms: 12000 }), "Bei Mia leuchtet die Kachel");
  pruefe(/Lena wartet/.test(await miaT.seite.locator(".ar-vr-kachel .ar-vr-neu").textContent()), "… mit «Lena wartet!»");
  pruefe(await bis(() => miaT.seite.locator("a.tn-vr-ruf").count().then((n) => n === 1)), "Oben auf der Turnierseite steht gross «Mit Lena spielen»");
  pruefe((await miaT.seite.locator("a.tn-vr-ruf").getAttribute("href")) === `/viererreihe?turnier=${TURNIER_ID}&raum=${raumT}`, "… und führt direkt in Lenas Raum");
  await bild(miaT.seite, "10-turnier-mia-kachel");
  await miaT.seite.locator("a.ar-vr-kachel").click();
  pruefe(await bis(() => miaT.seite.locator(".vr-wartet-knopf").count().then((n) => n === 1)), "Mias Menü zeigt «Mit Lena spielen» als grossen Knopf");
  await bild(miaT.seite, "11-turnier-mia-menue");
  await miaT.seite.locator(".vr-wartet-knopf").click();
  pruefe(await bis(() => satz(miaT.seite).then((t) => /Lena ist dran/.test(t))), "Ein Tipp, und Mia sitzt am Brett");
  pruefe(await bis(() => satz(lenaT.seite).then((t) => /Du beginnst/.test(t))), "Lena sieht das Brett, sobald Mia da ist");
  pruefe(await bis(async () => (await (await db(`partieOffen/${TURNIER_ID}`)).json()) === null), "Im Turnier wartet niemand mehr");
  pruefe(new URL(miaT.seite.url()).searchParams.get("turnier") === TURNIER_ID, "Auch bei Mia bleibt das Turnier in der Adresse");
  await setze(lenaT, 3, 1);
  pruefe(await bis(() => steine(miaT.seite).then((n) => n === 1)), "Mia sieht Lenas Stein");

  // Wer wartet und dann geht (Tablet zu), lädt niemanden mehr ein.
  await miaT.seite.goto(`${BASIS}/viererreihe?turnier=${TURNIER_ID}`);
  await miaT.seite.locator(".vr-eroeffnen").click();
  pruefe(await bis(() => miaT.seite.locator(".vr-vorschau-knopf").count().then((n) => n === 1)), "Mia wartet");
  await lenaT.seite.goto(`${BASIS}/viererreihe?turnier=${TURNIER_ID}`);
  pruefe(await bis(() => lenaT.seite.locator(".vr-wartet-knopf").count().then((n) => n === 1)), "Lena sieht «Mit Mia spielen»");
  await miaT.kontext.close();
  pruefe(await bis(() => lenaT.seite.locator(".vr-wartet-knopf").count().then((n) => n === 0), { ms: 20000 }), "Mia ist weg – der Knopf verschwindet von selbst");

  // Mia eröffnet noch einmal; Lena tippt auf der Turnierseite oben auf den
  // grossen Knopf – und sitzt sofort am Brett.
  const mia2 = await geraet("Mia", { viewport: { width: 820, height: 1100 } });
  await mia2.seite.goto(`${BASIS}/viererreihe?turnier=${TURNIER_ID}`);
  await mia2.seite.locator(".vr-eroeffnen").click();
  pruefe(await bis(() => mia2.seite.locator(".vr-vorschau-knopf").count().then((n) => n === 1)), "Mia wartet wieder");
  await lenaT.seite.goto(`${BASIS}/turnier?t=${TURNIER_ID}`);
  pruefe(await bis(() => lenaT.seite.locator("a.tn-vr-ruf").count().then((n) => n === 1), { ms: 12000 }), "Bei Lena steht oben «Mit Mia spielen»");
  await bild(lenaT.seite, "10b-turnier-ruf");
  await lenaT.seite.locator("a.tn-vr-ruf").click();
  pruefe(await bis(() => satz(lenaT.seite).then((t) => /Mia ist dran/.test(t))), "Ein Tipp oben, und Lena sitzt am Brett");
  pruefe(await bis(() => satz(mia2.seite).then((t) => /Du beginnst/.test(t))), "Mia sieht Lena kommen");

  // Ein Turnier nur mit Viererreihe: eine grosse Karte statt der Bühne.
  await lenaT.seite.goto(`${BASIS}/turnier?t=${NUR_VIERER}`);
  pruefe(await bis(() => lenaT.seite.locator(".ar-vr-kachel.ist-gross").count().then((n) => n === 1)), "Ein Turnier nur mit Viererreihe zeigt die grosse Karte");
  pruefe(await lenaT.seite.locator(".ar-buehne").count() === 0, "… und keine Bühne");
  await bild(lenaT.seite, "12-nur-viererreihe");
} catch (fehler) {
  befunde.push(`Abgebrochen: ${fehler?.stack || fehler}`);
} finally {
  await browser.close();
  halt();
}

for (const f of fehlerAufSeite) befunde.push(`Fehler auf der Seite – ${f}`);
console.log(`${geprueft} Prüfungen.`);
if (befunde.length) {
  console.error(`\n${befunde.length} Befund${befunde.length === 1 ? "" : "e"}:`);
  befunde.forEach((b) => console.error(`  - ${b}`));
  process.exit(1);
}
console.log("Viererreihe spielt sich, allein und zu zweit.");
