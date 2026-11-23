/*
 * Die Spiele zu zweit im Browser – alle ausser Viererreihe, die ihre eigene,
 * gründlichere Prüfung hat (check-viererreihe.mjs).
 * ---------------------------------------------------------------------------
 * Für jedes Spiel aus ZWEI (scripts/seiten-bauen.mjs), gegen den Emulator der
 * Realtime Database mit den echten Regeln (database.rules.json):
 *
 *   1. das Menü, eine Partie gegen den Computer auf «leicht» und eine auf
 *      der schwersten Stufe, bis sie zu Ende sind, die Bilanz;
 *   2. ein Duell: Papa eröffnet, Lena tritt mit dem Code bei, Papa gewinnt,
 *      die zweite Partie beginnt Lena (und endet unentschieden, wenn das
 *      Spiel das kann), Neuladen;
 *   3. das Bild hoch, quer und auf dem Tablet;
 *   4. die Kachel auf der Startseite (angehakt) und im Turnier: Wer wartet,
 *      wartet bei genau diesem Spiel – nicht bei einem anderen.
 *   5. ein Code dieses Spiels, auf der Seite eines anderen eingegeben, führt
 *      ans richtige Brett.
 *
 * Was ein Spiel dafür wissen muss, steht in SPIELWEISE: wie man einen Zug
 * tippt, wie viel schon auf dem Brett liegt, eine Zugfolge, in der a gewinnt.
 * Ein neues Spiel zu zweit bekommt dort eine Zeile.
 *
 * Firestore wird nicht angefasst: cloud.js ist eine Attrappe.
 *
 * Aufruf:  node scripts/check-zwei.mjs [seite …]     (npm run pruefen:zwei)
 * Nötig:   Java (für den Emulator), Playwright, einmalig `npm install`.
 *          Läuft der Emulator schon, reicht FIREBASE_DATABASE_EMULATOR_HOST.
 *          BILDER=<ordner> legt Bildschirmfotos dort ab.
 */
import { spawn, spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { mkdtempSync, readFileSync, writeFileSync, existsSync, rmSync, mkdirSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { ZWEI } from "./seiten-bauen.mjs";

const HIER = path.dirname(fileURLToPath(import.meta.url));
const WURZEL = path.resolve(HIER, "..");
const PROJEKT = "demo-mini-zwei";
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
  const ordner = mkdtempSync(path.join(os.tmpdir(), "mini-zwei-"));
  const konfig = path.join(ordner, "firebase.json");
  writeFileSync(konfig, JSON.stringify({ emulators: { database: { host: "127.0.0.1", port: 9000 }, ui: { enabled: false } } }));
  const innen = [process.execPath, fileURLToPath(import.meta.url), ...process.argv.slice(2)].map((t) => JSON.stringify(t)).join(" ");
  const lauf = spawnSync(firebase, ["emulators:exec", "--config", konfig, "--only", "database", "--project", PROJEKT, innen], {
    cwd: WURZEL,
    stdio: "inherit",
  });
  rmSync(ordner, { recursive: true, force: true });
  process.exit(lauf.status ?? 1);
}

// --- Was jedes Spiel wissen muss --------------------------------------------------
/*
 *   brett        woran man sieht, dass das Brett steht
 *   tippe(s, z)  den Zug z tippen (s ist die Seite)
 *   kannTippen(s, z)  ob das gerade geht (der Knopf frei ist)
 *   liegt(s)     wie viel auf dem Brett liegt (Zeichen, Steine …)
 *   waehle(lage) ein erlaubter Zug für den, der dran ist (gegen den Computer)
 *   sieg         Züge der Reihe nach, a beginnt und gewinnt
 *   siegZeichen  was danach leuchtet, und wie viele
 *   remis        Züge der Reihe nach bis zum Unentschieden (oder null)
 *   trenner      zwischen den Zügen in der Datenbank (wie im Spiel; "")
 */
const SPIELWEISE = {
  tictactoe: {
    brett: ".zw-ttt-gitter",
    tippe: (s, z) => s.locator(`.zw-ttt-feld[data-feld="${z}"]`).click(),
    kannTippen: (s, z) => s.locator(`.zw-ttt-feld[data-feld="${z}"]:not([disabled])`).count().then((n) => n === 1),
    liegt: (s) => s.locator(".zw-ttt-feld .zw-ttt-zeichen").count(),
    waehle: (lage) => {
      // Erst eine eigene fertige Reihe, sonst die Mitte, sonst das erste freie.
      const frei = lage.brett.map((x, i) => (x ? -1 : i)).filter((i) => i >= 0);
      return String(frei.includes(4) ? 4 : frei[0]);
    },
    sieg: ["0", "3", "1", "4", "2"],
    siegZeichen: [".zw-ttt-feld.ist-sieg", 3],
    remis: ["0", "1", "2", "4", "3", "6", "7", "5", "8"],
    nachSieg: async (s, pruefe) => {
      // Gesperrte Felder sind Knöpfe, aber nicht halb durchsichtig
      // (button:disabled im Stylesheet).
      const deckt = await s.evaluate(() => [...document.querySelectorAll(".zw-ttt-feld")].map((f) => getComputedStyle(f).opacity));
      pruefe(deckt.every((o) => o === "1"), `Tic Tac Toe: Auch gesperrte Felder decken ganz (${deckt.join(", ")})`);
      const sieger = await s.evaluate(() => getComputedStyle(document.querySelector(".zw-ttt-feld.ist-sieg .zw-ttt-zeichen")).opacity);
      pruefe(sieger === "1", `Tic Tac Toe: Die drei Sieger stehen kräftig da (${sieger})`);
      const linie = await s.evaluate(() => {
        const p = document.querySelector(".zw-ttt-linie.ist-an path");
        return p ? { d: p.getAttribute("d"), breit: p.getBoundingClientRect().width } : null;
      });
      pruefe(Boolean(linie?.d) && linie.breit > 100, `Tic Tac Toe: Durch die drei geht eine Linie (${JSON.stringify(linie)})`);
    },
  },
};

const GEWAEHLT = process.argv.slice(2);
const ZU_PRUEFEN = ZWEI.filter((z) => z.seite !== "viererreihe" && (!GEWAEHLT.length || GEWAEHLT.includes(z.seite)));

// --- Innen ------------------------------------------------------------------------
const EMULATOR = process.env.FIREBASE_DATABASE_EMULATOR_HOST;
const PORT = Number(process.env.PORT || 4295);
const BASIS = `http://127.0.0.1:${PORT}`;
const BILDER = process.env.BILDER || "";
if (BILDER) mkdirSync(BILDER, { recursive: true });

const befunde = [];
let geprueft = 0;
const pruefe = (bedingung, was) => { geprueft += 1; if (!bedingung) befunde.push(was); };

for (const z of ZU_PRUEFEN) {
  if (!SPIELWEISE[z.seite]) befunde.push(`${z.seite}: In SPIELWEISE (scripts/check-zwei.mjs) fehlt, wie man es spielt`);
}

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

// Ein Turnier mit allen Spielen zu zweit (und einem Spiel mit Bestenliste).
const TURNIER_ID = "zuzweit-k3m9x2p7";
const ALLE_ZWEI = ZWEI.map((z) => z.seite);
const ATTRAPPE = `
(() => {
  let app = null;
  const TURNIER = {
    id: "${TURNIER_ID}", name: "Familienturnier", beschreibung: "", spiele: ["towerStack"],
    startMs: Date.now() - 3600000, endeMs: Date.now() + 86400000, versuche: 0, zaehlt: "bester", wertung: "platz",
    aufgaben: "gleich", sichtbar: "link", verdeckt: false, ohneGeist: false, ohneReplay: false, ohneLive: false,
    nurLive: false, viererreihe: true, zweiSpieler: ${JSON.stringify(ALLE_ZWEI)}, aktiv: true, spitzeWartet: false,
  };
  const basis = {
    async turnier(id) { return id === TURNIER.id ? TURNIER : null; },
    turnierHoeren(id, { beiTurnier = () => {}, beiEintraegen = () => {} } = {}) {
      setTimeout(() => { beiTurnier(id === TURNIER.id ? TURNIER : null); beiEintraegen([]); }, 30);
      return () => {};
    },
    async turnierErgebnisse() { return []; },
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
    window.__zweiTest = { emulator };
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
const lageVon = (seite) => seite.evaluate(() => window.LernappZwei?.test?.lage?.() || null);
const bild = async (seite, name) => { if (BILDER) await seite.screenshot({ path: path.join(BILDER, `${name}.png`) }); };

// Gegen den Computer spielen, bis es vorbei ist.
async function gegenComputer(g, z, w, stufe) {
  const seite = g.seite;
  for (let runde = 0; runde < 80; runde += 1) {
    if (await seite.locator(".vr-nochmal").count()) break;
    const dran = await bis(async () => (await seite.locator(".vr-nochmal").count()) > 0
      || (await lageVon(seite))?.dran === "a", { ms: 8000 });
    if (!dran || await seite.locator(".vr-nochmal").count()) break;
    const zug = w.waehle(await lageVon(seite), "a");
    if (!await bis(() => w.kannTippen(seite, zug), { ms: 3000 })) break;
    await w.tippe(seite, zug);
    await warte(120);
  }
  pruefe(await bis(() => seite.locator(".vr-nochmal").count().then((n) => n === 1), { ms: 10000 }), `${z.titel} (${stufe}): Die Partie gegen den Computer kommt zu einem Ende`);
  return satz(seite);
}

try {
  for (const z of ZU_PRUEFEN) {
    const w = SPIELWEISE[z.seite];
    if (!w) continue;
    const id = z.seite;
    const T = z.titel;
    const fotos = (name) => `${id}-${name}`;

    // --- 1. Das Menü und zwei Partien gegen den Computer --------------------------
    const papa = await geraet("Papa");
    await papa.seite.goto(`${BASIS}/${z.seite}`);
    pruefe(await bis(() => papa.seite.locator(".vr-stufe").count().then((n) => n >= 1)), `${T}: Das Menü zeigt die Stufen`);
    const stufen = await papa.seite.locator(".vr-stufe").evaluateAll((k) => k.map((x) => x.dataset.stufe));
    pruefe(await papa.seite.locator(".vr-eroeffnen").isVisible(), `${T}: Das Menü bietet ein Duell an`);
    pruefe((await papa.seite.locator(".vr-titel").textContent()) === T, `${T}: Der Titel steht oben`);
    pruefe(await papa.seite.locator(".vr-held .zw-held-bild").count() === 1, `${T}: Das Menü hat ein Bild`);
    await bild(papa.seite, fotos("1-menue"));

    const leicht = stufen[0];
    const schwer = stufen[stufen.length - 1];
    await papa.seite.locator(`.vr-stufe[data-stufe="${leicht}"]`).click();
    pruefe(await bis(() => papa.seite.locator(w.brett).count().then((n) => n === 1)), `${T}: Gegen den Computer steht das Brett`);
    pruefe(/Du beginnst/.test(await satz(papa.seite)), `${T}: Gegen den Computer beginnst du die erste Partie`);
    pruefe(new URL(papa.seite.url()).searchParams.get("gegen") === leicht, `${T}: Die Adresse sagt die Stufe`);
    const ende1 = await gegenComputer(papa, z, w, leicht);
    pruefe(/gewonnen|Unentschieden/.test(ende1), `${T}: Am Ende steht, wie es ausging (${ende1})`);
    await warte(700);
    await bild(papa.seite, fotos("2-computer-ende"));
    const bilanz = await papa.seite.evaluate((schluessel) => JSON.parse(localStorage.getItem(schluessel) || "{}"), `${id}.bilanz`);
    const gezaehlt = (bilanz[leicht]?.s || 0) + (bilanz[leicht]?.n || 0) + (bilanz[leicht]?.u || 0);
    pruefe(gezaehlt === 1, `${T}: Die Bilanz zählt die Partie (${JSON.stringify(bilanz)})`);
    await papa.seite.locator(".vr-nochmal").click();
    pruefe(await bis(() => satz(papa.seite).then((t) => /Computer beginnt|Computer überlegt/.test(t))), `${T}: Die zweite Partie beginnt der Computer`);
    pruefe(await bis(() => w.liegt(papa.seite).then((n) => n === 1), { ms: 6000 }), `${T}: Der Computer setzt als Erster`);
    await papa.seite.locator(".vr-menue-knopf").click();
    pruefe(await bis(() => papa.seite.locator(".vr-stufe").count().then((n) => n === stufen.length)), `${T}: Zurück im Menü`);

    // Auf der schwersten Stufe: Gewinnen sollte schwer sein – zumindest mit
    // der einfachen Spielweise der Prüfung.
    await papa.seite.locator(`.vr-stufe[data-stufe="${schwer}"]`).click();
    pruefe(await bis(() => papa.seite.locator(w.brett).count().then((n) => n === 1)), `${T} (${schwer}): Das Brett steht`);
    const ende2 = await gegenComputer(papa, z, w, schwer);
    pruefe(!/Du hast gewonnen/.test(ende2), `${T}: Gegen «${schwer}» gewinnt die einfache Spielweise nicht (${ende2})`);
    await papa.seite.locator(".vr-menue-knopf").click();
    pruefe(await bis(() => papa.seite.locator(".vr-stufe").count().then((n) => n === stufen.length)), `${T}: Wieder im Menü`);

    // --- 2. Ein Duell: Papa eröffnet, Lena kommt mit dem Code ---------------------------
    await papa.seite.locator(".vr-eroeffnen").click();
    pruefe(await bis(() => papa.seite.locator(".vr-grosscode .vr-ziffer").count().then((n) => n === 4)), `${T}: Wer eröffnet, sieht vier Ziffern`);
    const code = (await papa.seite.locator(".vr-grosscode").textContent()).trim();
    const raum = new URL(papa.seite.url()).searchParams.get("raum") || "";
    pruefe(/^[0-9]{4}$/.test(code) && /^[A-Z2-9]{10}$/.test(raum), `${T}: Code und Raum (${code}, ${raum})`);
    pruefe((await (await db(`partie/${raum}/info`)).json())?.spiel === id, `${T}: Der Raum weiss, welches Spiel er ist`);
    pruefe((await (await db(`partieCode/${code}`)).json())?.spiel === id, `${T}: Der Code weiss, welches Spiel er ist`);

    const lena = await geraet("Lena", { viewport: { width: 820, height: 1000 } });
    await lena.seite.goto(`${BASIS}/${z.seite}`);
    await lena.seite.locator(".vr-code-feld").fill(code);
    await lena.seite.locator(".vr-code-ok").click();
    pruefe(await bis(() => lena.seite.locator(w.brett).count().then((n) => n === 1)), `${T}: Mit dem Code sitzt Lena am Brett`);
    pruefe(await bis(() => papa.seite.locator(w.brett).count().then((n) => n === 1)), `${T}: Papa sieht das Brett, sobald Lena da ist`);
    pruefe(await bis(() => satz(papa.seite).then((t) => /Du beginnst/.test(t))), `${T}: Wer eröffnet, beginnt`);
    pruefe(await bis(() => satz(lena.seite).then((t) => /Papa ist dran/.test(t))), `${T}: Lena sieht, dass Papa dran ist`);

    const spiele = async (folge, beginnt, nr) => {
      const [erst, dann] = beginnt === "a" ? [papa, lena] : [lena, papa];
      for (let i = 0; i < folge.length; i += 1) {
        const g = i % 2 === 0 ? erst : dann;
        pruefe(await bis(() => w.kannTippen(g.seite, folge[i])), `${T}: ${g.name} darf in Partie ${nr} Zug ${i + 1} setzen (${folge[i]})`);
        await w.tippe(g.seite, folge[i]);
        // Wer gerade nicht dran ist, kann nicht tippen.
        if (i === 0) pruefe(await bis(async () => !(await w.kannTippen(g.seite, folge[1] ?? folge[0])), { ms: 4000 }), `${T}: Nach dem Zug wartet ${g.name}`);
      }
    };
    await spiele(w.sieg, "a", 1);
    pruefe(await bis(() => satz(papa.seite).then((t) => /Du hast gewonnen/.test(t))), `${T}: Papa hat gewonnen – bei Papa`);
    pruefe(await bis(() => satz(lena.seite).then((t) => /Papa hat gewonnen/.test(t))), `${T}: Papa hat gewonnen – bei Lena`);
    const [siegWahl, siegZahl] = w.siegZeichen;
    pruefe(await bis(() => lena.seite.locator(siegWahl).count().then((n) => n === siegZahl)), `${T}: Bei Lena leuchtet, womit Papa gewonnen hat`);
    await w.nachSieg?.(lena.seite, pruefe);
    pruefe((await lena.seite.locator(".vr-wer.ist-a .vr-wer-zahl").textContent()) === "1", `${T}: Die Bilanz: Papa 1`);
    await warte(800);
    await bild(lena.seite, fotos("3-duell-sieg"));

    await lena.seite.locator(".vr-nochmal").click();
    pruefe(await bis(() => satz(lena.seite).then((t) => /Du beginnst/.test(t))), `${T}: Die zweite Partie beginnt Lena`);
    pruefe(await bis(() => satz(papa.seite).then((t) => /Lena ist dran/.test(t))), `${T}: Papa sieht, dass Lena beginnt`);
    pruefe(await bis(() => w.liegt(papa.seite).then((n) => n === 0), { ms: 3000 }), `${T}: Das Brett ist leer`);
    if (w.remis) {
      await spiele(w.remis, "b", 2);
      pruefe(await bis(() => satz(papa.seite).then((t) => /Unentschieden/.test(t))), `${T}: Unentschieden – bei Papa`);
      pruefe(await bis(() => satz(lena.seite).then((t) => /Unentschieden/.test(t))), `${T}: Unentschieden – bei Lena`);
      const st = await (await db(`partie/${raum}/stand`)).json();
      pruefe(st?.serie === "a" && st?.beginnt === "b" && st?.zuege === w.remis.join(w.trenner ?? "") && st?.nr === 1,
        `${T}: Der Stand in der Datenbank (${JSON.stringify(st)})`);
      await bild(papa.seite, fotos("4-duell-remis"));
    }

    // Neuladen: Papa sitzt wieder auf a, das Brett liegt noch.
    const vorher = await w.liegt(papa.seite);
    await papa.seite.reload();
    pruefe(await bis(() => papa.seite.locator(w.brett).count().then((n) => n === 1)), `${T}: Nach dem Neuladen steht das Brett`);
    pruefe(await bis(() => w.liegt(papa.seite).then((n) => n === vorher)), `${T}: Nach dem Neuladen liegt alles noch (${vorher})`);
    pruefe((await papa.seite.locator(".vr-wer.ist-a .vr-wer-name").textContent()).includes("Papa"), `${T}: Nach dem Neuladen ist Papa wieder auf a`);

    // --- 3. Das Bild auf drei Grössen --------------------------------------------------
    const quer = await geraet("Quer", { viewport: { width: 844, height: 390 } });
    await quer.seite.goto(`${BASIS}/${z.seite}?raum=${raum}`);
    pruefe(await bis(() => quer.seite.locator(w.brett).count().then((n) => n === 1)), `${T} quer: das Brett steht`);
    await warte(400);
    for (const [g, name] of [[papa, "Handy hoch"], [lena, "Tablet"], [quer, "Handy quer"]]) {
      const m = await g.seite.evaluate((wahl) => {
        const f = document.querySelector(wahl)?.getBoundingClientRect();
        const k = document.querySelector(".vr-knoepfe")?.getBoundingClientRect();
        return { breite: document.documentElement.scrollWidth, fenster: window.innerWidth, hoehe: window.innerHeight,
          brettUnten: f?.bottom || 0, brettBreit: f?.width || 0, brettHoch: f?.height || 0, knoepfe: k?.bottom || 0 };
      }, w.brett);
      pruefe(m.breite <= m.fenster, `${T} ${name}: nichts ragt seitlich hinaus (${m.breite} > ${m.fenster})`);
      pruefe(m.brettUnten <= m.hoehe + 1, `${T} ${name}: das Brett passt in die Höhe (${Math.round(m.brettUnten)} von ${m.hoehe})`);
      pruefe(m.brettBreit >= 200, `${T} ${name}: das Brett ist gross genug (${Math.round(m.brettBreit)} px)`);
      pruefe(m.knoepfe <= m.hoehe + 1, `${T} ${name}: die Knöpfe stehen im Bild (${Math.round(m.knoepfe)} von ${m.hoehe})`);
      await bild(g.seite, fotos(`5-${name.replace(/\s+/g, "-").toLowerCase()}`));
    }
    await quer.kontext.close();

    // --- 4. Die Kachel: auf der Startseite (angehakt) und im Turnier -------------------
    const zoe = await geraet("Zoe");
    await zoe.seite.addInitScript((spiel) => { window.__zweiSpieler = [spiel]; }, id);
    await zoe.seite.goto(`${BASIS}/`);
    pruefe(await bis(() => zoe.seite.locator(`a.ar-vr-kachel[href="/${z.seite}"]`).count().then((n) => n === 1)), `${T}: Angehakt steht die Kachel vorne in der Zeile`);
    pruefe(await zoe.seite.locator(".ar-vr-kachel").count() === 1, `${T}: … und nur sie`);
    pruefe(await zoe.seite.locator(`a.ar-vr-kachel[href="/${z.seite}"] .ar-vr-bild > *`).count() > 0, `${T}: Die Kachel hat ein Bild`);
    await warte(1200);
    await bild(zoe.seite, fotos("6-startseite"));

    const lenaT = await geraet("Lena", { viewport: { width: 820, height: 1100 } });
    const miaT = await geraet("Mia", { viewport: { width: 820, height: 1100 } });
    await lenaT.seite.goto(`${BASIS}/turnier?t=${TURNIER_ID}`);
    pruefe(await bis(() => lenaT.seite.locator(".ar-vr-kachel").count().then((n) => n === ALLE_ZWEI.length)), `${T}: Im Turnier stehen alle ${ALLE_ZWEI.length} Spiele zu zweit vorne`);
    await lenaT.seite.locator(`a.ar-vr-kachel[href="/${z.seite}?turnier=${TURNIER_ID}"]`).click();
    pruefe(await bis(() => lenaT.seite.locator(".vr-eroeffnen").count().then((n) => n === 1)), `${T}: Im Turnier: das Menü`);
    pruefe((await lenaT.seite.locator(".vr-kopf .mini-knopf-zurueck").getAttribute("href")) === `/turnier?t=${TURNIER_ID}`, `${T}: Der Weg zurück führt ins Turnier`);
    await lenaT.seite.locator(".vr-eroeffnen").click();
    pruefe(await bis(() => lenaT.seite.locator(".vr-vorschau-knopf").count().then((n) => n === 1)), `${T}: Lena wartet im Turnier`);
    const raumT = new URL(lenaT.seite.url()).searchParams.get("raum") || "";
    pruefe(await bis(async () => (await (await db(`partieOffen/${TURNIER_ID}/${raumT}`)).json())?.spiel === id), `${T}: Lena wartet bei genau diesem Spiel`);

    await miaT.seite.goto(`${BASIS}/turnier?t=${TURNIER_ID}`);
    pruefe(await bis(() => miaT.seite.locator(`a.ar-vr-kachel.ist-wartet[data-zwei="${id}"]`).count().then((n) => n === 1), { ms: 12000 }), `${T}: Bei Mia leuchtet die Kachel dieses Spiels`);
    pruefe(await miaT.seite.locator("a.ar-vr-kachel.ist-wartet").count() === 1, `${T}: … und keine andere`);
    pruefe(await bis(() => miaT.seite.locator("a.tn-vr-ruf").count().then((n) => n === 1)), `${T}: Oben steht «Mit Lena spielen»`);
    pruefe(new RegExp(`wartet bei ${T}`).test(await miaT.seite.locator("a.tn-vr-ruf").textContent()), `${T}: … und bei welchem Spiel`);
    pruefe((await miaT.seite.locator("a.tn-vr-ruf").getAttribute("href")) === `/${z.seite}?turnier=${TURNIER_ID}&raum=${raumT}`, `${T}: … und führt in Lenas Raum`);
    await bild(miaT.seite, fotos("7-turnier-ruf"));
    // Auf der Seite eines anderen Spiels wartet Lena nicht.
    const anderes = ZWEI.find((x) => x.seite !== z.seite);
    if (anderes) {
      await miaT.seite.goto(`${BASIS}/${anderes.seite}?turnier=${TURNIER_ID}`);
      pruefe(await bis(() => miaT.seite.locator(".vr-eroeffnen").count().then((n) => n === 1)), `${T}: Mia im Menü von ${anderes.titel}`);
      await warte(1500);
      pruefe(await miaT.seite.locator(".vr-wartet-knopf").count() === 0, `${T}: Im Menü von ${anderes.titel} wartet Lena nicht`);
    }
    await miaT.seite.goto(`${BASIS}/turnier?t=${TURNIER_ID}`);
    pruefe(await bis(() => miaT.seite.locator("a.tn-vr-ruf").count().then((n) => n === 1), { ms: 12000 }), `${T}: Der Ruf steht wieder da`);
    await miaT.seite.locator("a.tn-vr-ruf").click();
    pruefe(await bis(() => satz(miaT.seite).then((t) => /Lena ist dran/.test(t))), `${T}: Ein Tipp, und Mia sitzt am Brett`);
    pruefe(await bis(() => satz(lenaT.seite).then((t) => /Du beginnst/.test(t))), `${T}: Lena sieht Mia kommen`);
    pruefe(await bis(async () => (await (await db(`partieOffen/${TURNIER_ID}`)).json()) === null), `${T}: Im Turnier wartet niemand mehr`);

    // --- 5. Der Code dieses Spiels auf der Seite eines anderen ----------------------------
    if (anderes) {
      const max = await geraet("Max");
      await max.seite.goto(`${BASIS}/${z.seite}`);
      await max.seite.locator(".vr-eroeffnen").click();
      pruefe(await bis(() => max.seite.locator(".vr-grosscode .vr-ziffer").count().then((n) => n === 4)), `${T}: Max eröffnet`);
      const code2 = (await max.seite.locator(".vr-grosscode").textContent()).trim();
      const ben = await geraet("Ben");
      await ben.seite.goto(`${BASIS}/${anderes.seite}`);
      await ben.seite.locator(".vr-code-feld").fill(code2);
      await ben.seite.locator(".vr-code-ok").click();
      pruefe(await bis(() => ben.seite.locator(w.brett).count().then((n) => n === 1)), `${T}: Der Code, eingegeben bei ${anderes.titel}, führt ans Brett von ${T}`);
      pruefe(new URL(ben.seite.url()).pathname === `/${z.seite}`, `${T}: … auf die Seite ${z.seite} (${ben.seite.url()})`);
      pruefe(await bis(() => satz(max.seite).then((t) => /Du beginnst/.test(t))), `${T}: Max sieht Ben kommen`);
      await max.kontext.close();
      await ben.kontext.close();
    }
    for (const g of [papa, lena, zoe, lenaT, miaT]) await g.kontext.close();
  }
} catch (fehler) {
  befunde.push(`Abgebrochen: ${fehler?.stack || fehler}`);
} finally {
  await browser.close();
  halt();
}

for (const f of fehlerAufSeite) befunde.push(`Fehler auf der Seite – ${f}`);
console.log(`${geprueft} Prüfungen – ${ZU_PRUEFEN.map((z) => z.titel).join(", ") || "kein Spiel"}.`);
if (befunde.length) {
  console.error(`\n${befunde.length} Befund${befunde.length === 1 ? "" : "e"}:`);
  befunde.forEach((b) => console.error(`  - ${b}`));
  process.exit(1);
}
console.log("Die Spiele zu zweit spielen sich, allein und zu zweit.");
