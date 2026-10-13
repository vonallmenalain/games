/*
 * Der Multiplayer im Browser: spielen drei Geräte wirklich zusammen?
 * ---------------------------------------------------------------------------
 * check-spiele.mjs ersetzt Firebase durch eine Attrappe. Für den Live-Modus
 * reicht das nicht: Hier geht es gerade darum, was zwischen den Geräten hin
 * und her geht – wer wann startet, wer welche Punkte sieht, wann eine Runde
 * endet. Dafür läuft der Emulator der Realtime Database, mit den echten
 * Regeln (database.rules.json), und drei Browserfenster spielen einen ganzen
 * Abend: die Leitung (als Admin, sie spielt mit) und zwei Spieler. Ein
 * vierter kommt zu spät.
 *
 * Firestore wird nicht angefasst: cloud.js ist durch eine Attrappe ersetzt,
 * die nur die Verbindung zum Emulator herstellt und sich merkt, was in die
 * Hall of Fame gehen würde.
 *
 * Aufruf:  node scripts/check-live.mjs
 * Nötig:   Java (für den Emulator), Playwright, einmalig `npm install`.
 *          Emulator und lokaler Server werden selbst gestartet und beendet.
 */
import { spawn, spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { mkdtempSync, readFileSync, writeFileSync, existsSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const HIER = path.dirname(fileURLToPath(import.meta.url));
const WURZEL = path.resolve(HIER, "..");
const PROJEKT = "demo-mini-live";
// Der Namensraum der echten Datenbank: Die Seite verbindet sich mit der
// Adresse aus cloud.js und lenkt sie auf den Emulator um (useEmulator) –
// der Namensraum bleibt.
const NAMENSRAUM = "games-a0cd4-default-rtdb";

// ---------------------------------------------------------------------------
// Aussen: den Emulator starten und sich selbst darin noch einmal aufrufen
// ---------------------------------------------------------------------------
// Mit einer eigenen, leeren Konfiguration: Die Regeln lädt dieses Skript
// selbst in den richtigen Namensraum. (firebase.json nennt sie auch – für
// den Namensraum des Projekts, und den benutzt die Seite nicht.)
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
  const ordner = mkdtempSync(path.join(os.tmpdir(), "mini-live-"));
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

// ---------------------------------------------------------------------------
// Innen
// ---------------------------------------------------------------------------
const EMULATOR = process.env.FIREBASE_DATABASE_EMULATOR_HOST;
const PORT = Number(process.env.PORT || 4293);
const BASIS = `http://127.0.0.1:${PORT}`;

const befunde = [];
let geprueft = 0;
const pruefe = (bedingung, was) => { geprueft += 1; if (!bedingung) befunde.push(was); };

let playwright;
try { playwright = createRequire(import.meta.url)("playwright"); }
catch {
  console.error("Playwright fehlt – einmalig `npm i`.");
  process.exit(2);
}

// Die Regeln in den Namensraum, den die Seite benutzt.
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
}

const server = spawn(process.execPath, [path.join(HIER, "local-pwa-server.cjs"), String(PORT)], { cwd: WURZEL, stdio: "ignore" });
const halt = () => { if (!server.killed) server.kill(); };
process.on("exit", halt);
for (let versuch = 0; versuch < 50; versuch += 1) {
  try { if ((await fetch(`${BASIS}/index.html`)).ok) break; } catch { /* noch nicht da */ }
  await new Promise((weiter) => setTimeout(weiter, 100));
}

// Das SDK aus node_modules statt von gstatic: dieselben compat-Bausteine.
const SDK = new Map(["app", "firestore", "auth", "database"].map((teil) => [
  teil, readFileSync(path.join(WURZEL, "node_modules", "firebase", `firebase-${teil}-compat.js`), "utf8"),
]));

// cloud.js, nur so viel, wie der Live-Modus braucht: die Verbindung und die
// Hall of Fame als Liste im Fenster.
const TURNIER_ID = "herbstcup-k3m9x2p7";
const ATTRAPPE = `
(() => {
  let app = null;
  const TURNIER = {
    id: "${TURNIER_ID}", name: "Herbstcup", beschreibung: "", spiele: ["gravityRun", "vineSwing", "towerStack"],
    startMs: Date.now() - 3600000, endeMs: Date.now() + 86400000, versuche: 0, zaehlt: "bester", wertung: "platz",
    aufgaben: "gleich", sichtbar: "link", verdeckt: false, ohneGeist: false, nurLive: false, aktiv: true, spitzeWartet: false,
  };
  const liesAbende = () => { try { return JSON.parse(localStorage.getItem("__turnierLive") || "[]"); } catch { return []; } };
  // Gesammelt wird oben, auf der Live-Seite: Die Runde, die meldet, steckt
  // in einem Rahmen und ist nach der Runde wieder weg.
  if (window === window.top) window.__hof = [];
  const basis = {
    app() {
      if (app) return app;
      app = firebase.apps.length ? firebase.app() : firebase.initializeApp({
        apiKey: "demo", projectId: "games-a0cd4",
        databaseURL: "https://games-a0cd4-default-rtdb.europe-west1.firebasedatabase.app",
      });
      return app;
    },
    projektId: "games-a0cd4",
    NAME_MAX: 24, BAHN_MAX: 12000, MAX_JE_SPIEL: 300, MAX_JE_SPIELER: 50, TURNIER_NAME_MAX: 60, BESCHREIBUNG_MAX: 600,
    async speichere(e) { window.top.__hof.push({ game: e.game, punkte: e.punkte, name: e.name }); return { punkte: e.punkte, rekord: true, versuche: 1 }; },
    async speichereGeist() { return null; },
    async alleTurniere() { return [TURNIER]; },
    async turnier(id) { return id === TURNIER.id ? TURNIER : null; },
    async turnierErgebnisse() { return []; },
    async turnierLive() { return liesAbende(); },
    async speichereTurnierLive(id, abendId, daten) {
      // Auf dem Gerät gemerkt: Die Seite geht danach weiter.
      const ergebnis = { id: abendId, turnier: id, ...daten };
      let alle = [];
      try { alle = JSON.parse(localStorage.getItem("__turnierLiveGespeichert") || "[]"); } catch { alle = []; }
      localStorage.setItem("__turnierLiveGespeichert", JSON.stringify([...alle, ergebnis]));
      return ergebnis;
    },
    async liveZeiger(id) {
      const antwort = await fetch("http://${EMULATOR}/turnierLive/" + id + ".json?ns=${NAMENSRAUM}");
      const d = await antwort.json();
      return d && d.code ? { code: d.code, name: d.name } : null;
    },
    async offeneMultiplayer() {
      const antwort = await fetch("http://${EMULATOR}/liveOffen.json?ns=${NAMENSRAUM}");
      const d = (await antwort.json()) || {};
      return Object.entries(d).map(([code, o]) => ({ code, name: o.name, seit: o.seit || 0 }));
    },
    async ergebnisse() { return []; },
    async geister() { return []; },
    async offeneSpiele() { return null; },
    async meinErgebnis() { return null; },
  };
  window.MiniCloud = new Proxy(basis, { get: (t, k) => (k in t ? t[k] : async () => null) });
})();
`;

const browser = await playwright.chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
const fehlerAufSeite = [];

const geraete = [];
const protokoll = [];
async function geraet(name, { admin = false, viewport = { width: 420, height: 820 } } = {}) {
  const kontext = await browser.newContext({ viewport, serviceWorkers: "block" });
  await kontext.route("https://www.gstatic.com/firebasejs/**", (route) => {
    const teil = (route.request().url().match(/firebase-(\w+)-compat\.js/) || [])[1];
    route.fulfill({ contentType: "text/javascript; charset=utf-8", body: SDK.get(teil) || "/* unbekannt */" });
  });
  await kontext.route("**/cloud.js*", (route) => route.fulfill({ contentType: "text/javascript; charset=utf-8", body: ATTRAPPE }));
  await kontext.addInitScript(({ name, admin, emulator }) => {
    window.__miniLiveTest = { emulator, ...(admin ? { admin: { uid: "leitung", email: "alain.sc2@gmail.com" } } : {}) };
    try { if (!localStorage.getItem("mini.name")) localStorage.setItem("mini.name", name); } catch { /* egal */ }
  }, { name, admin, emulator: EMULATOR });
  const seite = await kontext.newPage();
  seite.on("pageerror", (fehler) => fehlerAufSeite.push(`${name}: ${fehler.message || fehler}`));
  if (process.env.LIVE_DEBUG) seite.on("console", (n) => protokoll.push(`${name} [${n.type()}] ${n.text()}`));
  seite.on("console", (n) => {
    if (n.type() !== "error") return;
    const text = n.text();
    // Der Emulator meldet sich mit einer Warnung, kein Befund.
    if (/emulator/i.test(text)) return;
    fehlerAufSeite.push(`${name}: ${text}`);
  });
  const g = { name, kontext, seite };
  geraete.push(g);
  return g;
}

const warte = (ms) => new Promise((weiter) => setTimeout(weiter, ms));
async function bis(frage, { ms = 15000, schritt = 100 } = {}) {
  const ende = Date.now() + ms;
  while (Date.now() < ende) {
    try { if (await frage()) return true; } catch { /* noch nicht */ }
    await warte(schritt);
  }
  return false;
}
const stand = (g) => g.seite.evaluate(() => window.LernappLive?.stand?.() || null);
// Mit LIVE_BILDER=<ordner> legt die Prüfung unterwegs Bildschirmfotos ab –
// zum Anschauen, nicht zum Prüfen.
async function bild(g, name) {
  if (!process.env.LIVE_BILDER) return;
  try { await g.seite.screenshot({ path: path.join(process.env.LIVE_BILDER, `${name}.png`) }); } catch { /* egal */ }
}
const spielFrame = (g) => g.seite.frames().find((f) => /[?&]live=/.test(f.url())) || null;

try {
  // --- Die Leitung legt einen Multiplayer an ---------------------------------
  const leitung = await geraet("Alain", { admin: true });
  // Ohne Link: keine Code-Eingabe mehr, nur was für alle offen ist – und
  // nichts zum Anlegen (das geschieht im Adminbereich).
  await leitung.seite.goto(`${BASIS}/live`, { waitUntil: "load" });
  pruefe(await bis(() => leitung.seite.locator(".lv-offen .mini-hinweis", { hasText: "kein Multiplayer" }).count().then((n) => n === 1)), "/live sagt nicht, dass gerade keiner offen ist");
  pruefe(await leitung.seite.locator("input#lv-code").count() === 0, "/live fragt noch nach einem Code");
  pruefe(await leitung.seite.getByRole("button", { name: /anlegen/i }).count() === 0, "/live bietet das Anlegen an – das gehört in den Adminbereich");
  // Aus dem Turnier heraus (Adminbereich, «Multiplayer» beim Turnier).
  await leitung.seite.goto(`${BASIS}/live?neu&turnier=${TURNIER_ID}`, { waitUntil: "load" });
  pruefe(await bis(() => leitung.seite.locator(".lv-formular").isVisible()), "Das Formular zum Anlegen erscheint für den Admin nicht");
  await bild(leitung, "0-formular");
  // Das Turnier ist gewählt, seine Spiele stehen im Programm, sein Name im
  // Namen des Abends.
  pruefe(await bis(() => leitung.seite.locator("#lv-turnier option:checked").textContent().then((t) => t === "Herbstcup")), "Das Turnier aus der Adresse ist nicht gewählt");
  pruefe(await bis(() => leitung.seite.locator(".lv-zeile").count().then((n) => n === 3)), "Die Spiele des Turniers stehen nicht im Programm");
  const programmSpiele = await leitung.seite.locator(".lv-spiel-wahl").evaluateAll((s) => s.map((x) => x.value));
  pruefe(JSON.stringify(programmSpiele) === JSON.stringify(["gravityRun", "vineSwing", "towerStack"]), `Das Programm ist nicht das des Turniers (${programmSpiele})`);
  pruefe((await leitung.seite.inputValue("#lv-abend-name")).startsWith("Herbstcup"), "Der Name des Abends kommt nicht vom Turnier");
  pruefe(await leitung.seite.locator("#lv-gewicht").isVisible(), "Wie der Abend im Turnier zählt, lässt sich nicht wählen");
  await leitung.seite.fill("#lv-abend-name", "Prüfabend");
  await leitung.seite.selectOption("#lv-gewicht", "2");
  // Schwerkraft-Läufer mit einer Übung, Lianenschwung (zum Zuschauen) und
  // Turmbau ohne – das Finale zählt doppelt.
  await leitung.seite.locator(".lv-zeile").nth(1).locator(".lv-uebung-wahl").selectOption("0");
  await leitung.seite.locator(".lv-zeile").nth(2).locator(".lv-uebung-wahl").selectOption("0");
  await leitung.seite.selectOption("#lv-zeitlimit", "30");
  await leitung.seite.selectOption("#lv-countdown", "3");
  await leitung.seite.check("#lv-finale");
  // Für alle sichtbar: Die Startseite zeigt «Multiplayer», die Turnierseite
  // den Weg hinein.
  await leitung.seite.selectOption("#lv-sichtbar", "alle");
  await leitung.seite.getByRole("button", { name: "Lobby öffnen" }).click();
  pruefe(await bis(async () => (await stand(leitung))?.beigetreten), "Die Leitung ist nach dem Anlegen nicht in ihrer eigenen Lobby");
  const code = (await stand(leitung))?.code || "";
  pruefe(/^[A-Z2-9]{10}$/.test(code), `Der Code sieht falsch aus: «${code}»`);
  pruefe((await leitung.seite.locator(".lv-link-text").textContent())?.endsWith(`/live?code=${code}`), "Die Lobby zeigt der Leitung den Link nicht");
  pruefe(await leitung.seite.locator(".lv-kopf", { hasText: code }).count() === 0, "Oben steht noch der Code");
  pruefe(new URL(leitung.seite.url()).searchParams.get("code") === code, "Die Adresse trägt den Code nicht");
  pruefe((await stand(leitung))?.leitung === true, "Die Leitung wird nicht als Leitung erkannt");
  const gemerkt = await leitung.seite.evaluate(() => JSON.parse(localStorage.getItem("mini.live.meine") || "[]"));
  pruefe(gemerkt[0]?.code === code, "Das Gerät der Leitung merkt sich den Multiplayer nicht (für den Adminbereich)");
  // Die Turnierseite erfährt, dass gerade gespielt wird – und die Liste der
  // offenen, dass es ihn gibt.
  const zeigerLesen = async () => (await fetch(`http://${EMULATOR}/turnierLive/${TURNIER_ID}.json?ns=${NAMENSRAUM}`)).json();
  const offenLesen = async () => (await fetch(`http://${EMULATOR}/liveOffen/${code}.json?ns=${NAMENSRAUM}`)).json();
  pruefe((await zeigerLesen())?.code === code, "Das Turnier zeigt nicht auf den Multiplayer");
  pruefe((await offenLesen())?.name === "Prüfabend", "Der Multiplayer steht nicht in der Liste der offenen");
  pruefe((await leitung.seite.locator(".lv-einstellungen").textContent())?.includes("×2"), "Die Lobby sagt nicht, wie der Abend im Turnier zählt");
  await bild(leitung, "1-lobby-leitung");

  // --- Das Grossbild: schaut zu, tritt nicht bei -----------------------------
  const tv = await geraet("Fernseher", { viewport: { width: 1280, height: 720 } });
  await tv.seite.goto(`${BASIS}/live?code=${code}&gross`, { waitUntil: "load" });
  pruefe(await bis(() => tv.seite.locator(".lv-grossbild .lv-link-gross").count().then((n) => n === 1)), "Das Grossbild zeigt den Link nicht");

  // --- Zwei Spieler treten bei ------------------------------------------------
  const mia = await geraet("Mia");
  const jonas = await geraet("Jonas");
  // Mia über die Startseite: «Multiplayer» führt direkt hinein. Jonas über
  // /live und die Liste der offenen.
  await mia.seite.goto(`${BASIS}/`, { waitUntil: "load" });
  pruefe(await bis(() => mia.seite.locator(".mini-knopf-live").count().then((n) => n === 1)), "Die Startseite zeigt «Multiplayer» nicht, obwohl einer offen ist");
  pruefe((await mia.seite.locator(".mini-knopf-live").textContent()) === "Multiplayer", "Der Knopf auf der Startseite heisst nicht «Multiplayer»");
  await mia.seite.locator(".mini-knopf-live").click();
  await mia.seite.waitForURL(/\/live\?code=/);
  pruefe(await bis(async () => (await stand(mia))?.beigetreten), "Mia kommt über die Startseite nicht in die Lobby");
  await jonas.seite.goto(`${BASIS}/live`, { waitUntil: "load" });
  pruefe(await bis(() => jonas.seite.locator(".lv-offen-zeile", { hasText: "Prüfabend" }).count().then((n) => n === 1)), "/live zeigt den offenen Multiplayer nicht");
  await jonas.seite.locator(".lv-offen-zeile", { hasText: "Prüfabend" }).getByRole("button", { name: "Mitspielen" }).click();
  pruefe(await bis(async () => (await stand(jonas))?.beigetreten), "Jonas kommt über /live nicht in die Lobby");
  pruefe(await bis(async () => (await leitung.seite.locator(".lv-spieler li.ist-online").count()) === 3), "Die Leitung sieht nicht alle drei online");
  // Auf der Turnierseite: «Multiplayer läuft» mit dem Weg hinein.
  {
    const blick = await geraet("Gast");
    await blick.seite.goto(`${BASIS}/turnier?t=${TURNIER_ID}`, { waitUntil: "load" });
    pruefe(await bis(() => blick.seite.locator(".tn-live").count().then((n) => n === 1)), "Die Turnierseite zeigt nicht, dass gerade live gespielt wird");
    const weg = await blick.seite.locator(".tn-live a").getAttribute("href");
    pruefe(weg === `/live?code=${code}`, `Der Weg in den Multiplayer stimmt nicht (${weg})`);
    await bild(blick, "11-turnier-live");
    await blick.kontext.close();
    geraete.splice(geraete.indexOf(blick), 1);
  }
  // Nur mit Link: Startseite und Turnierseite zeigen nichts mehr – und
  // wieder zurück.
  await leitung.seite.getByRole("button", { name: "Nur mit Link" }).click();
  pruefe(await bis(async () => (await offenLesen()) === null && (await zeigerLesen()) === null), "«Nur mit Link» nimmt den Multiplayer nicht aus der Liste der offenen und vom Turnier");
  pruefe(await bis(() => leitung.seite.locator(".lv-einstellungen", { hasText: "nur mit Link" }).count().then((n) => n === 1)), "Die Lobby sagt nicht, dass er nur mit Link offen ist");
  {
    const blick = await geraet("Gast3");
    await blick.seite.goto(`${BASIS}/`, { waitUntil: "load" });
    await warte(1500);
    pruefe(await blick.seite.locator(".mini-knopf-live").count() === 0, "Die Startseite zeigt «Multiplayer», obwohl er nur mit Link offen ist");
    await blick.kontext.close();
    geraete.splice(geraete.indexOf(blick), 1);
  }
  await leitung.seite.getByRole("button", { name: "Für alle öffnen" }).click();
  pruefe(await bis(async () => (await offenLesen())?.name === "Prüfabend" && (await zeigerLesen())?.code === code), "«Für alle öffnen» zeigt den Multiplayer nicht wieder");
  // Auf die Startseite setzt ihn nur der Admin.
  const darfZeigen = await jonas.seite.evaluate(async (c) => {
    try { await firebase.database().ref(`liveOffen/${c}`).set({ name: "Meins", seit: 1 }); return true; }
    catch { return false; }
  }, code);
  pruefe(!darfZeigen, "Ein Spieler kann einen Multiplayer auf die Startseite setzen");
  pruefe((await mia.seite.locator(".lv-start-knopf").count()) === 0, "Ein Spieler sieht den Start-Knopf");
  pruefe((await mia.seite.locator(".lv-warten").textContent())?.includes("Warte"), "Ein Spieler sieht nicht, dass er wartet");
  await bild(mia, "2-lobby-spieler");

  // --- Runde 1: die Übung ----------------------------------------------------
  const startZeiten = new Map();
  async function runde(nr, { erwarteSpiel, eingreifen = null, alle = [leitung, mia, jonas] }) {
    pruefe(await bis(async () => {
      const s = await Promise.all(alle.map(stand));
      return s.every((x) => x?.phase === "runde" && x.nr === nr && x.rahmen);
    }), `Runde ${nr}: Nicht alle bekommen das Spiel`);
    const frames = [];
    for (const g of alle) {
      let f = null;
      await bis(async () => {
        f = spielFrame(g);
        return f && new URL(f.url()).searchParams.get("nr") === String(nr) && await f.evaluate(() => Boolean(window.LernappLiveSpiel?.aktiv?.()));
      });
      pruefe(f && f.url().includes(`/${erwarteSpiel}?live=${code}&nr=${nr}`), `Runde ${nr}: ${g.name} hat das falsche Spiel (${f?.url()})`);
      frames.push(f);
    }
    // Vor dem Start: Countdown da, Tippen startet nichts.
    const vorher = await frames[1].evaluate(() => document.querySelector(".lv-start")?.hidden === false);
    await bild(mia, `3-countdown-${nr}`);
    pruefe(vorher, `Runde ${nr}: Keine Countdown-Tafel vor dem Start`);
    // Die Tafel einer Übung sagt nur «Übungsrunde» – keinen Satz dazu.
    if (nr === 0) {
      const karte = await frames[1].evaluate(() => document.querySelector(".lv-start-karte")?.innerText || "");
      pruefe(/Übungsrunde/i.test(karte) && !/Zählt nicht|Kennenlernen/i.test(karte), `Die Tafel der Übung sagt mehr als «Übungsrunde» (${karte.replace(/\s+/g, " ")})`);
    }
    if (erwarteSpiel === "schwerkraft") {
      await frames[1].locator(".cm-stage").dispatchEvent("pointerdown");
      const phase = await frames[1].evaluate(() => window.LernappSchwerkraft.state.phase);
      pruefe(phase === "bereit", `Runde ${nr}: Ein Tipp im Countdown hat das Spiel gestartet (${phase})`);
    }
    // Dieselbe Saat überall.
    const saaten = await Promise.all(frames.map((f) => f.evaluate(() => window.LernappLiveSpiel.runde().saat)));
    pruefe(new Set(saaten).size === 1, `Runde ${nr}: Nicht alle haben dieselbe Saat (${saaten.join(", ")})`);
    // Der gemeinsame Start: wann jedes Gerät losgelaufen ist.
    const losZeiten = await Promise.all(frames.map((f) => f.evaluate(() => new Promise((fertig) => {
      const t = setInterval(() => {
        if (window.LernappLiveSpiel.gestartet()) { clearInterval(t); fertig(window.LernappLiveSpiel.startVerzug()); }
      }, 20);
    }))));
    startZeiten.set(nr, losZeiten);
    pruefe(losZeiten.every((ms) => ms >= 0 && ms < 250), `Runde ${nr}: Der Start lag nicht bei startUm (${losZeiten.join(", ")} ms)`);
    if (erwarteSpiel === "schwerkraft") {
      const welten = await Promise.all(frames.map((f) => f.evaluate(() => JSON.stringify(window.LernappSchwerkraft.state.bahnen.map((b) => b.slice(0, 6))))));
      pruefe(new Set(welten).size === 1, `Runde ${nr}: Nicht alle laufen im selben Korridor`);
      const laeuft = await frames[0].evaluate(() => window.LernappSchwerkraft.state.phase);
      pruefe(laeuft === "spiel", `Runde ${nr}: Der Läufer ist ohne Tipp nicht losgerannt (${laeuft})`);
    }
    if (eingreifen) await eingreifen(frames);
    return frames;
  }

  await leitung.seite.locator(".lv-start-knopf").click();
  const uebung = await runde(0, { erwarteSpiel: "schwerkraft" });
  // Ohne Tipp fällt der Läufer bald – die Runde endet von selbst.
  pruefe(await bis(async () => (await Promise.all([leitung, mia, jonas].map(stand))).every((s) => s?.phase === "pause"), { ms: 30000 }),
    "Die Übung endet nicht, obwohl alle ausgeschieden sind");
  pruefe(await bis(() => mia.seite.locator(".lv-block h2", { hasText: "Übungsrunde" }).count().then((n) => n === 1)), "Die Auswertung sagt nicht, dass es eine Übungsrunde war");
  await bild(leitung, "5-pause-leitung");
  pruefe(await mia.seite.evaluate(() => window.__hof.length) === 0, "Eine Übungsrunde ging in die Hall of Fame");
  pruefe((await stand(mia))?.rahmen === false, "Nach der Runde liegt das Spiel noch über der Seite");
  void uebung;

  // --- Ein Nachzügler --------------------------------------------------------
  const lea = await geraet("Lea");
  await lea.seite.goto(`${BASIS}/live?code=${code}`, { waitUntil: "load" });
  pruefe(await bis(async () => (await stand(lea))?.beigetreten), "Ein Nachzügler kommt in der Auswertung nicht hinein");

  // --- Runde 2: zählt --------------------------------------------------------
  await leitung.seite.getByRole("button", { name: "Weiter" }).click();
  // Lea war in der Auswertung schon da – sie spielt diese Runde mit.
  await runde(1, { erwarteSpiel: "schwerkraft", alle: [leitung, mia, jonas, lea] });
  pruefe(await bis(async () => (await stand(leitung))?.phase === "pause", { ms: 30000 }), "Runde 2 endet nicht");
  pruefe(await bis(() => mia.seite.evaluate(() => window.__hof.some((e) => e.game === "gravityRun"))), "Eine zählende Runde kam nicht in die Hall of Fame");
  if (process.env.LIVE_DEBUG) console.log("Runde 2:", JSON.stringify(await leitung.seite.evaluate(() => window.LernappLive.rundenWertung(1, "platz", false))));
  const ergebnisZeilen = await leitung.seite.locator(".lv-block").first().locator("tbody tr").count();
  pruefe(ergebnisZeilen === 4, `Das Ergebnis der Runde hat ${ergebnisZeilen} statt 4 Zeilen`);

  // --- Runde 3: Lianenschwung – zuschauen ---------------------------------
  // Alain und Mia springen ab und fallen ins Wasser; Jonas und Lea schwingen
  // an der ersten Liane, bis die 30 Sekunden um sind. Wer ausgeschieden ist,
  // schaut eine Sekunde später dem zu, der vorne liegt.
  await leitung.seite.getByRole("button", { name: "Weiter" }).click();
  const kennungen = {};
  for (const g of [leitung, mia, jonas, lea]) kennungen[g.name] = await g.seite.evaluate(() => window.LernappMini.kennung());
  const lianen = await runde(2, {
    erwarteSpiel: "liane",
    alle: [leitung, mia, jonas, lea],
    eingreifen: async (frames) => {
      await Promise.all(frames.slice(0, 2).map((f) => f.evaluate(() => new Promise((fertig) => {
        const L = window.LernappLiane;
        const t = setInterval(() => {
          if (L.state.p.x < L.state.anker[0].x + 4) return;
          clearInterval(t);
          L.druecken();
          L.loslassen();
          fertig();
        }, 30);
      }))));
    },
  });
  // Die anderen laufen als Geister mit.
  pruefe(await bis(() => lianen[2].evaluate(() => window.LernappLiveSpiel.gegner().length >= 2)), "Im Spiel laufen die anderen nicht als Geister mit");
  pruefe(await bis(() => lianen[2].evaluate(() => window.LernappGeist.stand()[0].zeigt.some((z) => z.endsWith(":Lea")))), "geist.js zeigt die anderen nicht im Bild");
  // Die anderen gleiten: Lea, wie Jonas sie sieht, Bild für Bild. Gemessen
  // wird, wie stark sich ihr Tempo von einem Bild zum nächsten ändert – ein
  // Sprung, wenn ihre nächste Lage kommt, wäre ein Ausreisser. Dazu, wie weit
  // sie zurücksteht (gemessen, nicht geschätzt).
  const gleiten = await lianen[2].evaluate((lea) => new Promise((fertig) => {
    const L = window.LernappLiveSpiel;
    const geg = L.gegner().find((g) => g.kennung === lea);
    if (!geg) { fertig(null); return; }
    const proben = [];
    const schritt = () => {
      const o = geg.lauf.ort(L.geistZeit());
      proben.push({ t: performance.now(), a: o.a, b: o.b, z: geg.lauf.zeitBei(L.geistZeit()) });
      if (proben.length < 120) { requestAnimationFrame(schritt); return; }
      const tempo = [];
      for (let i = 1; i < proben.length; i += 1) {
        const dt = Math.max(1, proben[i].t - proben[i - 1].t);
        tempo.push({ va: (proben[i].a - proben[i - 1].a) / dt, vb: (proben[i].b - proben[i - 1].b) / dt });
      }
      let sprung = 0;
      let schnitt = 0;
      for (let i = 1; i < tempo.length; i += 1) {
        sprung = Math.max(sprung, Math.hypot(tempo[i].va - tempo[i - 1].va, tempo[i].vb - tempo[i - 1].vb));
        schnitt += Math.hypot(tempo[i].va, tempo[i].vb) / tempo.length;
      }
      const letzte = proben[proben.length - 1];
      fertig({ sprung, schnitt, verzug: L.zeit() - letzte.z });
    };
    requestAnimationFrame(schritt);
  }), kennungen.Lea);
  console.log(`Lea bei Jonas: Tempo ${gleiten?.schnitt?.toFixed(3)} px/ms, grösster Tempowechsel je Bild ${gleiten?.sprung?.toFixed(3)} px/ms, ${Math.round(gleiten?.verzug ?? -1)} ms zurück`);
  pruefe(gleiten && gleiten.verzug >= 40 && gleiten.verzug <= 800, `Lea steht nicht um einen vernünftigen Verzug zurück (${JSON.stringify(gleiten)})`);
  // Geraten statt gerechnet, sprang sie bei jeder Lage um einige Pixel – ein
  // Tempowechsel von 0,5 px/ms und mehr in einem Bild. Gleitend bleibt er
  // weit darunter.
  pruefe(gleiten && gleiten.sprung < 0.3, `Lea ruckelt bei Jonas (${JSON.stringify(gleiten)})`);
  // Mia fällt und schaut dann Jonas zu – vorne, bei gleich vielen Metern
  // nach dem Namen.
  pruefe(await bis(() => lianen[1].evaluate(() => window.LernappLiveSpiel.istFertig()), { ms: 15000 }), "Mia fällt nicht ins Wasser");
  const wartenAb = Date.now();
  pruefe(await bis(() => lianen[1].evaluate(() => Boolean(window.LernappLiveSpiel.zuschauen())), { ms: 8000 }), "Wer ausgeschieden ist, schaut niemandem zu");
  const { ziel, staende } = await lianen[1].evaluate(() => ({ ziel: window.LernappLiveSpiel.zuschauen(), staende: window.LernappLiveSpiel.stand() }));
  pruefe(Date.now() - wartenAb > 300, "Das Zuschauen beginnt ohne Pause nach dem Ausscheiden");
  // Vorne liegt, wer von den beiden, die noch schwingen, mehr Meter hat.
  const noch = staende.filter((x) => !x.fertig);
  const zielStand = staende.find((x) => x.kennung === ziel);
  pruefe([kennungen.Jonas, kennungen.Lea].includes(ziel) && noch.every((x) => x.p <= (zielStand?.p ?? -1)),
    `Mia schaut nicht dem zu, der vorne liegt und noch spielt (${ziel}, ${JSON.stringify(staende.map((x) => [x.name, x.p, x.fertig]))})`);
  const zielName = ziel === kennungen.Jonas ? "Jonas" : "Lea";
  const andererName = zielName === "Jonas" ? "Lea" : "Jonas";
  pruefe(await lianen[1].evaluate(() => window.LernappLiane.state.phase) === "zuschauen", "Das Spiel zeigt beim Zuschauen nicht die fremde Figur");
  // Der Affe steht dort, wo Jonas' Affe ist – eine Drittelsekunde dahinter.
  await warte(800);
  const zielFrame = zielName === "Jonas" ? lianen[2] : lianen[3];
  const [hier, dort] = await Promise.all([lianen[1], zielFrame].map((f) => f.evaluate(() => window.LernappLiane.state.p.x)));
  pruefe(Math.abs(hier - dort) < 160, `Beim Zuschauen ist die Figur nicht dort, wo ${zielName} ist (${Math.round(hier)} / ${Math.round(dort)})`);
  pruefe(await bis(() => lianen[1].locator(".lv-chip.ist-ziel", { hasText: zielName }).count().then((n) => n === 1)), "Oben ist nicht hervorgehoben, wem zugeschaut wird");
  await bild(mia, "9-zuschauen");
  // Den anderen Namen antippen: jetzt dem zuschauen.
  const zumAndern = lianen[1].locator("button.lv-chip", { hasText: andererName });
  pruefe(await zumAndern.count() === 1, `Oben lässt sich ${andererName} nicht antippen`);
  await zumAndern.click();
  pruefe(await bis(async () => (await lianen[1].evaluate(() => window.LernappLiveSpiel.zuschauen())) === kennungen[andererName]), "Antippen wechselt nicht, wem zugeschaut wird");
  pruefe(await lianen[1].evaluate(() => window.LernappLiane.state.phase) === "zuschauen", "Nach dem Wechsel ist das Zuschauen weg");

  // Ein Nachzügler mitten in der Runde: spielt nicht, kann aber zuschauen.
  const tim = await geraet("Tim");
  await tim.seite.goto(`${BASIS}/live?code=${code}`, { waitUntil: "load" });
  pruefe(await bis(async () => (await stand(tim))?.beigetreten), "Ein Nachzügler mitten in der Runde kommt nicht hinein");
  await warte(600);
  await bild(tim, "6-nachzuegler");
  pruefe((await stand(tim))?.rahmen === false, "Wer mitten in der Runde kam, bekommt trotzdem das Spiel");
  pruefe(await tim.seite.locator(".mini-hinweis", { hasText: "nächsten" }).count() === 1, "Der Nachzügler erfährt nicht, dass er später mitspielt");
  await tim.seite.getByRole("button", { name: "Zuschauen" }).click();
  pruefe(await bis(async () => (await stand(tim))?.rahmen), "«Zuschauen» öffnet das Spiel nicht");
  pruefe(await bis(() => spielFrame(tim)?.evaluate(() => Boolean(window.LernappLiveSpiel?.zuschauen?.()))), "Wer nur zuschaut, sieht niemandem zu");
  pruefe(await spielFrame(tim)?.evaluate(() => window.LernappLiveSpiel.istFertig() && window.LernappLiveSpiel.runde().nurZuschauen), "Wer nur zuschaut, hat eine eigene Runde");
  await spielFrame(tim).locator("button.lv-chip-zu").click();
  pruefe(await bis(async () => (await stand(tim))?.rahmen === false), "«Schliessen» bringt den Zuschauer nicht zurück");
  // Das Grossbild schaut von selbst zu.
  pruefe(await bis(async () => (await stand(tv))?.rahmen), "Das Grossbild schaut einer Runde mit Figur nicht zu");
  pruefe(await bis(() => spielFrame(tv)?.evaluate(() => Boolean(window.LernappLiveSpiel?.zuschauen?.()))), "Das Grossbild folgt niemandem");
  await bild(tv, "10-grossbild");

  pruefe(await bis(async () => (await stand(leitung))?.phase === "pause", { ms: 45000 }), "Die Lianen-Runde endet nicht mit dem Zeitlimit");
  const nachLiane = await leitung.seite.evaluate(() => window.LernappLive.rundenWertung(2, "platz", false).map((e) => [e.name, e.fertig]));
  pruefe(nachLiane.length === 4 && nachLiane.every(([, f]) => f), `Nach der Lianen-Runde ist nicht jeder fertig gemeldet (${JSON.stringify(nachLiane)})`);
  pruefe(!nachLiane.some(([n]) => n === "Tim"), "Wer nur zugeschaut hat, steht im Ergebnis");

  // --- Runde 4: Turmbau, Finale, Zeitlimit ---------------------------------
  // Niemand tippt: Der Block schwingt, bis die 30 Sekunden um sind. Vorher
  // bekommt jeder eine andere Zahl, damit die Wertung etwas zu tun hat. Tim
  // war in der Auswertung da – jetzt spielt er mit.
  await leitung.seite.getByRole("button", { name: "Weiter" }).click();
  await runde(3, {
    erwarteSpiel: "turmbau",
    alle: [leitung, mia, jonas, lea, tim],
    eingreifen: async (frames) => {
      const zahlen = [5, 3, 3, 1, 0];
      await Promise.all(frames.map((f, i) => f.evaluate((n) => { window.LernappTurmbau.state.punkte = n; }, zahlen[i])));
    },
  });
  await warte(3500);
  await bild(mia, "7-runde-laeuft");
  pruefe(await bis(async () => (await stand(leitung))?.phase === "pause", { ms: 45000 }), "Das Zeitlimit beendet die Runde nicht");
  const punkte = await leitung.seite.evaluate(() => {
    const r = window.LernappLive.rundenWertung(3, "platz", true);
    return r.map((e) => [e.name, e.p, e.platz, e.punkte]);
  });
  const wie = Object.fromEntries(punkte.map(([n, p, platz, pkt]) => [n, { p, platz, pkt }]));
  pruefe(wie.Alain?.p === 5 && wie.Alain?.platz === 1 && wie.Alain?.pkt === 20, `Platz 1 im Finale bekommt nicht 2 × 10 (${JSON.stringify(wie.Alain)})`);
  pruefe(wie.Mia?.platz === 2 && wie.Jonas?.platz === 2 && wie.Mia?.pkt === 16, `Gleich viele Punkte, nicht derselbe Platz (${JSON.stringify([wie.Mia, wie.Jonas])})`);
  pruefe(wie.Lea?.platz === 4 && wie.Lea?.pkt === 10, `Platz 4 bekommt nicht 2 × 5 (${JSON.stringify(wie.Lea)})`);
  pruefe(wie.Tim?.platz === 5 && wie.Tim?.pkt === 8, `Platz 5 bekommt nicht 2 × 4 (${JSON.stringify(wie.Tim)})`);

  // --- Das Podest ------------------------------------------------------------
  await leitung.seite.getByRole("button", { name: "Zum Podest" }).click();
  pruefe(await bis(async () => (await Promise.all([leitung, mia, jonas, lea, tim, tv].map(stand))).every((s) => s?.phase === "ende")), "Nicht alle sehen das Podest");
  // Der Endstand ist die Summe der Rundenpunkte der drei zählenden Runden –
  // auf jedem Gerät dieselbe.
  const gesamtJe = await Promise.all([mia, jonas, leitung, tv].map((x) => x.seite.evaluate(() => JSON.stringify(window.LernappLive.gesamt().map((p) => [p.name, p.punkte, p.platz])))));
  pruefe(new Set(gesamtJe).size === 1, "Nicht jedes Gerät rechnet denselben Endstand");
  const gesamt = JSON.parse(gesamtJe[0]);
  const erwartet = await mia.seite.evaluate(() => {
    const summe = {};
    [[1, false], [2, false], [3, true]].forEach(([nr, doppelt]) => window.LernappLive.rundenWertung(nr, "platz", doppelt).forEach((e) => { summe[e.name] = (summe[e.name] || 0) + e.punkte; }));
    return summe;
  });
  pruefe(gesamt.every(([n, p]) => erwartet[n] === p), `Der Endstand ist nicht die Summe der Rundenpunkte (${JSON.stringify(gesamt)} / ${JSON.stringify(erwartet)})`);
  pruefe(gesamt.length === 5 && !gesamt.some(([n]) => n === "Fernseher"), `Im Endstand fehlt jemand – oder das Grossbild spielt mit (${JSON.stringify(gesamt)})`);
  pruefe(gesamt.every(([, p], i) => i === 0 || p <= gesamt[i - 1][1]), "Der Endstand ist nicht absteigend sortiert");
  pruefe(await mia.seite.locator(".lv-podest .lv-stufe-1 .lv-podest-name").textContent() === gesamt[0][0], "Auf dem Podest steht nicht Platz 1 in der Mitte");
  pruefe(await tv.seite.locator(".lv-grossbild .lv-podest").count() === 1, "Das Grossbild zeigt das Podest nicht");
  await bild(mia, "8-podest");

  // --- Abschliessen ----------------------------------------------------------
  await leitung.seite.getByRole("button", { name: "Ins Turnier eintragen und abschliessen" }).click();
  pruefe(await bis(() => mia.seite.locator(".lv-status", { hasText: "vorbei" }).count().then((n) => n > 0)), "Die Spieler erfahren nicht, dass der Multiplayer vorbei ist");
  pruefe(await mia.seite.locator(".lv-podest").count() === 1, "Nach dem Abschliessen ist das Podest weg");
  pruefe(await mia.seite.locator("a", { hasText: "Zum Turnier" }).count() >= 1, "Nach dem Abend führt kein Weg zum Turnier");

  // --- Im Turnier --------------------------------------------------------------
  await bis(async () => new URL(leitung.seite.url()).search === "");
  const eingetragen = await leitung.seite.evaluate(() => JSON.parse(localStorage.getItem("__turnierLiveGespeichert") || "[]")).catch(() => []);
  pruefe(eingetragen.length === 1, `Der Endstand kam nicht ins Turnier (${eingetragen.length})`);
  const ergebnis = eingetragen[0] || {};
  pruefe(ergebnis.turnier === TURNIER_ID && /^[A-Z2-9]{4}-[0-9]{6,16}$/.test(ergebnis.id || ""), `Der Endstand liegt nicht beim richtigen Turnier (${ergebnis.turnier}, ${ergebnis.id})`);
  pruefe(ergebnis.gewicht === 2 && ergebnis.endstand?.length === 5 && ergebnis.runden === 3, `Der Endstand ist nicht vollständig (${JSON.stringify({ g: ergebnis.gewicht, n: ergebnis.endstand?.length, r: ergebnis.runden })})`);
  pruefe(JSON.stringify(ergebnis.endstand?.map((e) => [e.name, e.punkte, e.platz])) === JSON.stringify(gesamt), "Im Turnier steht ein anderer Endstand als auf dem Podest");
  pruefe((await zeigerLesen()) === null, "Nach dem Abschliessen zeigt das Turnier noch auf den Multiplayer");
  pruefe((await offenLesen()) === null, "Nach dem Abschliessen steht der Multiplayer noch in der Liste der offenen");
  pruefe(new URL(leitung.seite.url()).pathname === "/admin", `Nach dem Abschliessen landet die Leitung nicht im Adminbereich (${leitung.seite.url()})`);
  // Die Gesamtwertung des Turniers mit dem Abend: Er zählt wie ein Spiel,
  // mal zwei; wer fehlt, steht hinter dem Letzten.
  {
    const blick = await geraet("Gast2");
    await blick.seite.addInitScript((daten) => { try { localStorage.setItem("__turnierLive", JSON.stringify(daten)); } catch { /* egal */ } }, eingetragen);
    await blick.seite.goto(`${BASIS}/turnier?t=${TURNIER_ID}`, { waitUntil: "load" });
    pruefe(await bis(() => blick.seite.locator(".tn-live-karte").count().then((n) => n === 1)), "Die Turnierseite zeigt den Multiplayer nicht");
    pruefe(await blick.seite.locator(".tn-live-karte .mini-karte-zahl").textContent() === "zählt ×2", "Die Turnierseite sagt nicht, wie der Abend zählt");
    pruefe(await bis(() => blick.seite.locator(".tn-tabelle tbody tr").count().then((n) => n === 5)), "In der Gesamtwertung fehlen die Spieler des Abends");
    pruefe((await blick.seite.locator(".tn-tabelle .tn-teile").first().textContent())?.includes("«Prüfabend» 1. ×2"), "Die Gesamtwertung zeigt die Spalte des Multiplayers nicht");
    await bild(blick, "12-turnier-gesamt");
    const rechnung = await blick.seite.evaluate((abend) => {
      const t = { spiele: ["towerStack"], wertung: "platz" };
      const eintraege = [{ game: "towerStack", spieler: "mini_xxxxxxxxxx", name: "Zoe", punkte: 9, versuche: 1 }];
      const w = window.LernappTurnier.gesamtwertung(t, eintraege, [abend]);
      return w.personen.map((p) => [p.name, p.wert]);
    }, ergebnis);
    const zoe = rechnung.find(([n]) => n === "Zoe");
    pruefe(zoe && zoe[1] === 1 + (5 + 1) * 2, `Wer den Abend verpasst, steht nicht hinter dem Letzten, mal zwei (${JSON.stringify(rechnung)})`);
    const erster = rechnung.find(([n]) => n === gesamt[0][0]);
    pruefe(erster && erster[1] === 2 + gesamt[0][2] * 2, `Platz im Abend zählt nicht mal zwei (${JSON.stringify(rechnung)})`);
    const nurLive = await blick.seite.evaluate((abend) => window.LernappTurnier.gesamtwertung({ spiele: ["towerStack"], wertung: "platz", nurLive: true }, [], [abend]).personen.map((p) => [p.name, p.wert, p.gespielt]), ergebnis);
    pruefe(nurLive.length === 5 && nurLive.every(([, , g]) => g === 1), `Ein Turnier nur live zählt nicht nur die Abende (${JSON.stringify(nurLive)})`);
  }

  // --- Die Regeln aus Sicht der Seite --------------------------------------
  // Ein Spieler darf nicht steuern.
  const darfSteuern = await jonas.seite.evaluate(async (c) => {
    try { await firebase.database().ref(`live/${c}/zustand`).set({ phase: "runde", nr: 9 }); return true; }
    catch { return false; }
  }, code);
  pruefe(!darfSteuern, "Ein Spieler kann den Multiplayer steuern");

  // --- Wer nicht wirklich spielt, hält die Runde nicht auf -------------------
  // Brückenbauer hat keine Uhr: Die Runde endet, wenn alle fertig sind. Ein
  // Gerät im Hintergrund (Bildschirm aus, Tab verdeckt) bleibt «online», sein
  // Spiel läuft aber nicht – ohne Lebenszeichen hinge die Runde ewig, und
  // alle anderen sässen vor «spielt noch». Zwei Runden: In der ersten beendet
  // die Leitung sie von ihrer Tafel aus, in der zweiten liegt Jonas im
  // Hintergrund, und die Runde endet ohne ihn.
  {
    await leitung.seite.goto(`${BASIS}/live?neu`, { waitUntil: "load" });
    pruefe(await bis(() => leitung.seite.locator(".lv-formular").isVisible()), "Das Formular erscheint für den zweiten Multiplayer nicht");
    while (await leitung.seite.locator(".lv-zeile").count() > 1) await leitung.seite.locator(".lv-zeile").last().getByRole("button", { name: "Entfernen" }).click();
    const zeile = leitung.seite.locator(".lv-zeile").first();
    await zeile.locator(".lv-spiel-wahl").selectOption("bridgeBuilder");
    await zeile.locator(".lv-runden-wahl").selectOption("2");
    await zeile.locator(".lv-uebung-wahl").selectOption("0");
    await leitung.seite.selectOption("#lv-turnier", "");
    await leitung.seite.selectOption("#lv-sichtbar", "link");
    await leitung.seite.selectOption("#lv-zeitlimit", "0");
    await leitung.seite.selectOption("#lv-countdown", "3");
    await leitung.seite.getByRole("button", { name: "Lobby öffnen" }).click();
    pruefe(await bis(async () => (await stand(leitung))?.beigetreten), "Die Leitung kommt nicht in den zweiten Multiplayer");
    const code2 = (await stand(leitung))?.code || "";
    for (const g of [mia, jonas]) {
      await g.seite.goto(`${BASIS}/live?code=${code2}`, { waitUntil: "load" });
      pruefe(await bis(async () => (await stand(g))?.beigetreten), `${g.name} kommt nicht in den zweiten Multiplayer`);
    }
    await bis(async () => (await leitung.seite.locator(".lv-spieler li.ist-online").count()) === 3);
    const drei = [leitung, mia, jonas];
    async function brueckenRunde(nr) {
      if (nr === 0) await leitung.seite.locator(".lv-start-knopf").click();
      else await leitung.seite.getByRole("button", { name: "Weiter" }).click();
      pruefe(await bis(async () => (await Promise.all(drei.map(stand))).every((x) => x?.phase === "runde" && x.nr === nr && x.rahmen)), `Brückenbauer ${nr}: Nicht alle bekommen das Spiel`);
      const frames = [];
      for (const g of drei) {
        let f = null;
        await bis(async () => { f = spielFrame(g); return f && new URL(f.url()).searchParams.get("nr") === String(nr) && await f.evaluate(() => Boolean(window.LernappLiveSpiel?.gestartet?.())); });
        frames.push(f);
      }
      return frames;
    }
    // Den Finger halten, bis der Balken weit über den Pfeiler reicht: Der
    // Arbeiter läuft ins Leere.
    async function absturz(g, f) {
      const box = await f.locator(".cm-stage").boundingBox();
      await g.seite.mouse.move(box.x + box.width / 2, box.y + box.height * 0.7);
      await g.seite.mouse.down();
      await bis(() => f.evaluate(() => {
        const st = window.LernappBruecke.state;
        const p = st.pfeiler[st.hier + 1];
        return st.schritt === "wachsen" && st.balken && st.balken.x + st.balken.len > p.x + p.w;
      }), { ms: 8000, schritt: 10 });
      await g.seite.mouse.up();
      return bis(() => f.evaluate(() => window.LernappLiveSpiel.istFertig()), { ms: 8000 });
    }

    // Runde 1: Alain fällt, Mia und Jonas tun nichts. Alain wartet nicht – er
    // beendet die Runde von seiner Tafel aus.
    const erste = await brueckenRunde(0);
    pruefe(await absturz(leitung, erste[0]), "Brückenbauer: Der Arbeiter der Leitung fällt nicht");
    const ende = erste[0].locator(".lv-tafel button", { hasText: "Runde jetzt beenden" });
    pruefe(await bis(() => ende.isVisible()), "Die Tafel der Leitung bietet «Runde jetzt beenden» nicht an, während andere noch spielen");
    pruefe(await bis(() => erste[1].locator(".lv-tafel button", { hasText: "Runde jetzt beenden" }).count().then((n) => n === 0), { ms: 1500 }), "Ein Spieler bekommt den Knopf der Leitung");
    await ende.click();
    pruefe(await bis(async () => (await Promise.all(drei.map(stand))).every((x) => x?.phase === "pause")), "«Runde jetzt beenden» auf der Tafel beendet die Runde nicht");

    // Runde 2: Jonas' Spiel liegt im Hintergrund – kein Bild mehr, die
    // Zeitgeber laufen gedrosselt weiter, die Verbindung steht.
    const zweite = await brueckenRunde(1);
    await zweite[2].evaluate(() => { window.requestAnimationFrame = () => 0; });
    const t0 = Date.now();
    pruefe(await absturz(leitung, zweite[0]), "Brückenbauer: Alains Arbeiter fällt nicht");
    pruefe(await absturz(mia, zweite[1]), "Brückenbauer: Mias Arbeiter fällt nicht");
    pruefe(await bis(() => zweite[1].locator(".lv-tafel .lv-weg").count().then((n) => n === 1), { ms: 15000, schritt: 50 })
      || (await stand(mia))?.phase === "pause", "Auf der Tafel steht nicht, dass Jonas weg ist");
    pruefe(await bis(async () => (await stand(leitung))?.phase === "pause", { ms: 20000 }), "Die Runde wartet ewig auf einen, dessen Spiel im Hintergrund liegt");
    const dauer = Date.now() - t0;
    pruefe(dauer < 18000, `Die Runde endet erst nach ${Math.round(dauer / 1000)} s ohne Jonas`);
    const nr1 = await leitung.seite.evaluate(() => window.LernappLive.rundenWertung(1, "platz", false).map((e) => [e.name, e.p, e.fertig]));
    pruefe(nr1.length === 3 && nr1.some(([n, , f]) => n === "Jonas" && !f), `Jonas fehlt in der Wertung oder gilt als fertig (${JSON.stringify(nr1)})`);
    await bild(mia, "13-ohne-jonas");
  }

  const spreizung = [...startZeiten.values()].map((z) => Math.max(...z) - Math.min(...z));
  console.log(`Start je Runde auseinander: ${spreizung.map((ms) => `${ms} ms`).join(", ")}`);
  for (const g2 of geraete) await g2.kontext.close();
} catch (fehler) {
  befunde.push(`Abbruch: ${fehler.stack || fehler}`);
  // Was die Geräte gerade zeigen – das erklärt einen Abbruch meist sofort.
  for (const g of geraete) {
    try { befunde.push(`${g.name} zeigt: ${(await g.seite.locator("main").innerText()).replace(/\s+/g, " ").slice(0, 400)}`); } catch { /* weg */ }
  }
} finally {
  await browser.close();
  halt();
}

fehlerAufSeite.forEach((f) => befunde.push(`Konsole: ${f}`));
if (process.env.LIVE_DEBUG) protokoll.slice(-60).forEach((z) => console.log(z));
console.log(`${geprueft} Prüfungen im Multiplayer.`);
if (befunde.length) {
  console.error(`\n${befunde.length} Befund${befunde.length === 1 ? "" : "e"}:`);
  befunde.forEach((b) => console.error(`  - ${b}`));
  process.exit(1);
}
console.log("Der Multiplayer spielt zusammen.");
