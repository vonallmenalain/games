/*
 * Zuschauen im Multiplayer: sieht, wer ausgeschieden ist, wirklich, was die
 * anderen tun?
 * ---------------------------------------------------------------------------
 * Drei Geräte spielen jedes Spiel, in dem man ausscheidet oder früher fertig
 * ist, eine Runde lang – mit kleinen Robotern statt Fingern. Alain scheidet
 * zuerst aus, Mia später, Jonas zuletzt. Wer draussen ist, schaut zu: erst
 * dem, der vorne liegt, dann – Alain tippt oben auf den anderen Namen – dem
 * nächsten, und wenn der fertig ist, dem, der noch spielt.
 *
 * Geprüft wird, was im Bild steht: Was der Zuschauer zuletzt von einem
 * anderen gesehen hat, muss ein Stand sein, den der andere selbst hatte – und
 * wer bis zum Schluss zugeschaut hat, sieht genau sein Ende: dieselben
 * Blöcke, dieselben Brücken, dieselben Pfeile, Kacheln, Fische, Kessel und
 * Antworten.
 *
 * Wie check-live.mjs: Emulator der Realtime Database mit den echten Regeln,
 * cloud.js als Attrappe.
 *
 * Aufruf:  node scripts/check-zuschauen.mjs
 *          PROGRAMM=towerStack,dartWheel – nur diese Spiele
 *          LIVE_BILDER=<ordner> – unterwegs ein Bild je Spiel beim Zuschauen
 * Nötig:   Java (für den Emulator), Playwright, einmalig `npm install`.
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
async function geraet(name, { admin = false, viewport = { width: 420, height: 820 }, touch = false } = {}) {
  const kontext = await browser.newContext({ viewport, serviceWorkers: "block", ...(touch ? { hasTouch: true, isMobile: true } : {}) });
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

// ---------------------------------------------------------------------------
// Zuschauen: Einer scheidet früh aus und schaut zu. Was er sieht, muss am
// Ende dasselbe sein wie das, was der andere gebaut hat.
// ---------------------------------------------------------------------------
// Die Spieler im Rahmen: ein kleiner Roboter je Spiel. raus: nach so vielen
// Zügen absichtlich daneben (im Zahlengleis: so viele Zehntelsekunden je
// Zahl – dort scheidet niemand aus, wer schneller ist, ist früher fertig).
const BOTS = {
  towerStack: ({ raus, seed }) => {
    let r = seed;
    const zufall = () => { r = (r * 16807) % 2147483647; return r / 2147483647; };
    let ziel = (zufall() - 0.5) * 16;
    const host = document.querySelector(".cm-stage") || document.body;
    const tick = () => {
      const T = window.LernappTurmbau;
      const st = T.state;
      if (window.LernappLiveSpiel.istFertig() || st.phase === "ende" || st.phase === "zuschauen") return;
      requestAnimationFrame(tick);
      const s = st.schweber;
      if (!s || s.fallend || s.einzug > 0.5 || st.phase !== "spiel") return;
      const unten = st.bloecke[st.bloecke.length - 1];
      const d = s.x - unten.x;
      const tippen = st.punkte >= raus ? Math.abs(d) >= s.weite * 0.97 : Math.abs(d - ziel * T.welt.mass) < 1.6;
      if (!tippen) return;
      ziel = (zufall() - 0.5) * 16;
      host.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
    };
    requestAnimationFrame(tick);
  },
  bridgeBuilder: ({ raus, seed }) => {
    let r = seed;
    const zufall = () => { r = (r * 16807) % 2147483647; return r / 2147483647; };
    const host = document.querySelector(".cm-stage") || document.body;
    let unten = false;
    let ziel = 0;
    const tick = () => {
      const st = window.LernappBruecke.state;
      if (window.LernappLiveSpiel.istFertig() || st.phase === "ende" || st.phase === "zuschauen") return;
      requestAnimationFrame(tick);
      if (st.phase !== "spiel") return;
      if (!unten && st.schritt === "warten") {
        const p = st.pfeiler[st.hier + 1];
        ziel = st.bruecken >= raus ? p.x - p.w / 2 - 25 : p.x + (zufall() - 0.5) * p.w * 0.8;
        unten = true;
        host.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
      } else if (unten && st.schritt === "wachsen" && st.balken && st.balken.x + st.balken.len >= ziel) {
        unten = false;
        window.dispatchEvent(new PointerEvent("pointerup", { bubbles: true }));
      }
    };
    requestAnimationFrame(tick);
  },
  dartWheel: ({ raus }) => {
    const host = document.querySelector(".cm-stage") || document.body;
    let geworfen = 0;
    const tick = () => {
      const D = window.LernappDrehscheibe;
      const st = D.state;
      if (window.LernappLiveSpiel.istFertig() || st.phase === "ende" || st.phase === "zuschauen") return;
      requestAnimationFrame(tick);
      if (st.phase !== "spiel" || st.schritt !== "zielen" || st.flug || st.auf < 0.9 || st.nachladen > 0) return;
      // Wo der Pfeil in gut 50 ms einschlägt.
      const unten = D.norm(Math.PI - st.winkel);
      const naechster = Math.min(...st.scheibe.stecken.map((p) => D.abstand(p.w, unten)), 9);
      const gut = geworfen < raus ? naechster > 0.45 : naechster < 0.04;
      if (!gut) return;
      geworfen += 1;
      host.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
    };
    requestAnimationFrame(tick);
  },
  tileMemory: ({ raus }) => {
    let getippt = 0;
    let warte = 0;
    const tick = () => {
      const st = window.LernappKacheln.state;
      if (window.LernappLiveSpiel.istFertig() || st.phase === "over" || st.phase === "zuschauen") return;
      requestAnimationFrame(tick);
      if (st.phase !== "tippen" || performance.now() < warte) return;
      const kacheln = [...document.querySelectorAll(".kk-kachel")];
      warte = performance.now() + 260;
      if (getippt >= raus) {
        const falsch = kacheln.findIndex((k, i) => !st.muster.has(i));
        kacheln[falsch]?.click();
        return;
      }
      const offen = [...st.offen][0];
      if (offen === undefined) return;
      getippt += 1;
      kacheln[offen].click();
    };
    requestAnimationFrame(tick);
  },
  fishPond: ({ raus }) => {
    let getippt = 0;
    let warte = 0;
    const tick = () => {
      const st = window.LernappFischteich.state;
      if (window.LernappLiveSpiel.istFertig() || st.phase === "over" || st.phase === "zuschauen") return;
      requestAnimationFrame(tick);
      if (st.phase !== "play" || performance.now() < warte || performance.now() < st.sperreBis) return;
      warte = performance.now() + 120;
      if (getippt >= raus) {
        const schon = st.fische.find((f) => f.gefangen);
        if (schon) { schon.node.click(); return; }
      }
      const frei = st.fische.find((f) => !f.gefangen);
      if (!frei) return;
      getippt += 1;
      frei.node.click();
    };
    requestAnimationFrame(tick);
  },
  boilerRoom: ({ raus }) => {
    let getippt = 0;
    let warte = 0;
    const tick = () => {
      const H = window.LernappHeizer;
      const st = H.state;
      if (window.LernappLiveSpiel.istFertig() || st.phase === "over" || st.phase === "zuschauen") return;
      requestAnimationFrame(tick);
      if (st.phase !== "play" || performance.now() < warte) return;
      const tippe = (k) => {
        k.node.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, cancelable: true }));
        getippt += 1;
        warte = performance.now() + 140;
      };
      if (getippt >= raus) {
        // Gerade: absichtlich ins Rote (geplatzt). Ungerade: nichts mehr tun,
        // bis ein Kessel aus ist.
        if (raus % 2) return;
        const rot = st.kessel.find((k) => k.wert > H.GEFAHR);
        if (rot) tippe(rot);
        else if (st.kessel[0].wert < H.GEFAHR - 5) tippe(st.kessel[0]);
        return;
      }
      const leer = [...st.kessel].sort((a, b) => a.wert - b.wert)[0];
      if (leer && leer.wert < 32) tippe(leer);
    };
    requestAnimationFrame(tick);
  },
  numberLine: ({ raus, seed }) => {
    let r = seed;
    const zufall = () => { r = (r * 16807) % 2147483647; return r / 2147483647; };
    // raus: hier, wie lange er für jede Zahl braucht (Zehntelsekunden).
    const pause = raus * 100;
    let beschaeftigt = false;
    const tick = async () => {
      const st = window.LernappZahlengleis.state;
      if (window.LernappLiveSpiel.istFertig() || st.phase === "over" || st.phase === "zuschauen") return;
      requestAnimationFrame(tick);
      if (st.phase !== "aufgabe" || beschaeftigt) return;
      beschaeftigt = true;
      const gleis = document.querySelector(".zg-gleis");
      const marken = document.querySelectorAll(".zg-marke");
      const a = marken[0].getBoundingClientRect();
      const b = marken[marken.length - 1].getBoundingClientRect();
      const x = (p) => a.left + (b.left - a.left) * p;
      const ziel = st.zahl / st.gleis.bis + (zufall() - 0.5) * 0.08;
      const y = gleis.getBoundingClientRect().top + gleis.getBoundingClientRect().height / 2;
      const warte = (ms) => new Promise((ok) => setTimeout(ok, ms));
      gleis.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, cancelable: true, clientX: x(0.05), clientY: y, pointerId: 1 }));
      const schritte = 12;
      for (let i = 1; i <= schritte; i += 1) {
        await warte(pause / schritte);
        gleis.dispatchEvent(new PointerEvent("pointermove", { bubbles: true, clientX: x(0.05 + (ziel - 0.05) * (i / schritte)), clientY: y, pointerId: 1 }));
      }
      gleis.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, clientX: x(ziel), clientY: y, pointerId: 1 }));
      await warte(50);
      beschaeftigt = false;
    };
    requestAnimationFrame(tick);
  },
  craneHarbor: ({ raus, seed }) => {
    let r = seed;
    const zufall = () => { r = (r * 16807) % 2147483647; return r / 2147483647; };
    // Ein Ziel neben der Mitte – oder genau die Mitte (dort rastet "perfekt" ein).
    const neu = () => { const z = (zufall() - 0.5) * 20; return Math.abs(z) < 3 ? 0 : z; };
    let ziel = neu();
    const host = document.querySelector(".cm-stage") || document.body;
    const tick = () => {
      const K = window.LernappKranhafen;
      const st = K.state;
      if (window.LernappLiveSpiel.istFertig() || st.phase === "ende" || st.phase === "zuschauen") return;
      requestAnimationFrame(tick);
      if (st.phase !== "spiel") return;
      // Wo der Container landen würde, liesse man ihn jetzt los.
      const v = K.vorhersage();
      if (!v) return;
      const tippen = st.punkte >= raus ? v.daneben : !v.daneben && Math.abs(v.ende - ziel) < 1.2;
      if (!tippen) return;
      ziel = neu();
      host.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
    };
    requestAnimationFrame(tick);
  },  twinLanes: ({ raus, seed }) => {
    let r = seed;
    const zufall = () => { r = (r * 16807) % 2147483647; return r / 2147483647; };
    const host = document.querySelector(".cm-stage") || document.body;
    // Getippt wird wie mit dem Finger: auf die linke oder rechte Hälfte.
    const tippe = (bahn) => {
      const box = host.getBoundingClientRect();
      host.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, clientX: box.left + box.width * (bahn ? 0.75 : 0.25), clientY: box.top + box.height * 0.6, pointerId: 1 + bahn }));
    };
    const vorhalt = [0.4, 0.4];
    const tick = () => {
      const Z = window.LernappSpuren;
      const st = Z.state;
      if (window.LernappLiveSpiel.istFertig() || st.phase === "ende" || st.phase === "zuschauen") return;
      requestAnimationFrame(tick);
      // Nach raus Punkten tippt er nicht mehr – bald ist ein Stern verpasst
      // oder ein Hindernis getroffen.
      if (st.phase !== "spiel" || st.punkte >= raus) return;
      const v = Z.tempoBei(st.weg);
      for (const b of [0, 1]) {
        const n = Z.naechste(b);
        if (!n || st.schlitten[b].ziel === n.soll) continue;
        if (n.ab < v * vorhalt[b] + 30) { tippe(b); vorhalt[b] = 0.25 + zufall() * 0.45; }
      }
    };
    requestAnimationFrame(tick);
  },
};

// Was im Bild steht – beim Spielen wie beim Zuschauen dieselbe Beschreibung.
const BILD = {
  towerStack: () => {
    const T = window.LernappTurmbau;
    return { punkte: T.state.punkte, bloecke: T.state.bloecke.slice(1).map((b) => [Math.round(b.x / T.welt.mass * 10) / 10, Math.round(b.w / T.welt.mass * 10) / 10]) };
  },
  bridgeBuilder: () => {
    const st = window.LernappBruecke.state;
    return { punkte: st.punkte, bruecken: st.bruecken, schritt: st.schritt, pfeiler: st.pfeiler.map((p) => Math.round(p.x)) };
  },
  dartWheel: () => {
    const st = window.LernappDrehscheibe.state;
    return { punkte: st.punkte, scheibe: st.scheibe?.n, schritt: st.schritt === "aus" ? "aus" : "", stecken: (st.scheibe?.stecken || []).filter((p) => !p.alt).map((p) => Math.round(p.w * 1000)).sort((a, b) => a - b) };
  },
  tileMemory: () => {
    return { punkte: Number(document.querySelector(".cm-count-value")?.textContent), kacheln: [...document.querySelectorAll(".kk-kachel")].map((k) => ["is-muster", "is-treffer", "is-daneben"].filter((c) => k.classList.contains(c)).join("+")).join(",") };
  },
  fishPond: () => {
    const st = window.LernappFischteich.state;
    return { punkte: st.punkte, teich: st.teich, fische: st.fische.map((f) => `${f.art.id}${f.gefangen ? "!" : ""}${f.node.classList.contains("is-doppelt") ? "×" : ""}`).join(",") };
  },
  boilerRoom: () => {
    const st = window.LernappHeizer.state;
    const vorbei = st.phase !== "play" && st.phase !== "zuschauen";
    // In Zehnteln – so genau, wie der Zug sie trägt.
    return { kessel: st.kessel.map((k) => `${vorbei ? Math.round(k.wert * 10) : ""}${k.node.classList.contains("ist-aus") ? "aus" : ""}${k.node.classList.contains("ist-geplatzt") ? "geplatzt" : ""}`).join(",") };
  },
  numberLine: () => {
    const st = window.LernappZahlengleis.state;
    const antwort = !document.querySelector(".zg-ziel")?.hidden;
    return { zahl: Math.min(9, st.index), punkte: st.punkte, antwort, ...(antwort ? { p: Math.round(st.p * 1000) } : {}) };
  },
  craneHarbor: () => {
    // Die Container auf dem Schiff unter dem Kran, in Hundertstel – so genau,
    // wie der Zug sie trägt.
    const st = window.LernappKranhafen.state;
    return { punkte: st.punkte, schiff: st.schiffNr, stapel: st.stapel.map((k) => Math.round(k.off * 100)) };
  },  twinLanes: () => {
    const st = window.LernappSpuren.state;
    return { punkte: st.punkte, ziele: `${st.schlitten[0].ziel}${st.schlitten[1].ziel}`, fehler: st.fehler ? `${st.fehler.art}#${st.fehler.ding.id}` : "" };
  },
};

try {
  const leitung = await geraet("Alain", { admin: true });
  await leitung.seite.goto(`${BASIS}/live?neu`, { waitUntil: "load" });
  await bis(() => leitung.seite.locator(".lv-formular").isVisible());
  const PROGRAMM = (process.env.PROGRAMM || "towerStack,bridgeBuilder,dartWheel,tileMemory,fishPond,boilerRoom,numberLine,craneHarbor,twinLanes").split(",");
  while (await leitung.seite.locator(".lv-zeile").count() < PROGRAMM.length) await leitung.seite.getByRole("button", { name: "Spiel hinzufügen" }).click();
  while (await leitung.seite.locator(".lv-zeile").count() > PROGRAMM.length) await leitung.seite.locator(".lv-zeile").last().getByRole("button", { name: "Entfernen" }).click();
  for (let i = 0; i < PROGRAMM.length; i += 1) {
    const zeile = leitung.seite.locator(".lv-zeile").nth(i);
    await zeile.locator(".lv-spiel-wahl").selectOption(PROGRAMM[i]);
    await zeile.locator(".lv-uebung-wahl").selectOption("0");
    await zeile.locator(".lv-runden-wahl").selectOption("1");
  }
  await leitung.seite.selectOption("#lv-zeitlimit", process.env.LIMIT || "120");
  await leitung.seite.selectOption("#lv-countdown", "3");
  await leitung.seite.getByRole("button", { name: "Lobby öffnen" }).click();
  await bis(async () => (await stand(leitung))?.beigetreten);
  const code = (await stand(leitung))?.code;
  const mia = await geraet("Mia", { touch: true });
  const jonas = await geraet("Jonas", { touch: true, viewport: { width: 900, height: 600 } });
  for (const g of [mia, jonas]) {
    await g.seite.goto(`${BASIS}/live?code=${code}`, { waitUntil: "load" });
    await bis(async () => (await stand(g))?.beigetreten);
  }
  await bis(async () => (await leitung.seite.locator(".lv-spieler li.ist-online").count()) === 3);
  const alle = [leitung, mia, jonas];
  const plan = await leitung.seite.evaluate(() => window.LernappLive.plan().map((r) => r.spiel));
  const foto = new Map();
  console.log("Plan", plan.join(" → "));
  for (let nr = 0; nr < plan.length; nr += 1) {
    const spiel = plan[nr];
    if (nr === 0) await leitung.seite.locator(".lv-start-knopf").click();
    else await leitung.seite.getByRole("button", { name: "Weiter" }).click();
    await bis(async () => (await Promise.all(alle.map(stand))).every((x) => x?.phase === "runde" && x.nr === nr && x.rahmen));
    const frames = [];
    for (const g of alle) {
      let f = null;
      await bis(async () => { f = spielFrame(g); return f && new URL(f.url()).searchParams.get("nr") === String(nr) && await f.evaluate(() => Boolean(window.LernappLiveSpiel?.aktiv?.())); });
      frames.push(f);
    }
    await Promise.all(frames.map((f) => f.evaluate(() => new Promise((ok) => { const t = setInterval(() => { if (window.LernappLiveSpiel.gestartet()) { clearInterval(t); ok(); } }, 20); }))));
    const kennungen = await Promise.all(frames.map((f) => f.evaluate(() => window.LernappLiveSpiel.runde().ich.kennung)));
    // Alain scheidet zuerst aus, Mia später, Jonas zuletzt.
    const RAUS = { towerStack: [2, 8, 16], bridgeBuilder: [2, 6, 12], dartWheel: [2, 8, 18], tileMemory: [2, 9, 18], fishPond: [2, 9, 16], boilerRoom: [4, 31, 60], numberLine: [3, 9, 16], craneHarbor: [2, 6, 11], twinLanes: [6, 16, 30] };
    const raus = RAUS[spiel] || [2, 6, 10];
    // Jeder merkt sich, was er zuletzt im Bild hatte – je nachdem, wem er
    // gerade zuschaut (oder sich selbst).
    await Promise.all(frames.map((f, i) => f.evaluate(({ bot, bild, raus, seed, wechseln }) => {
      const BILD = (0, eval)(`(${bild})`);
      window.__bilder = {};
      window.__wechsel = [];
      window.__verlauf = [];
      const merke = () => {
        requestAnimationFrame(merke);
        const wem = window.LernappLiveSpiel.zuschauen() || (window.LernappLiveSpiel.istFertig() ? null : "ich");
        if (!wem) return;
        if (window.__wechsel[window.__wechsel.length - 1] !== wem) window.__wechsel.push(wem);
        window.__bilder[wem] = BILD();
        if (wem === "ich") {
          const text = JSON.stringify(window.__bilder[wem]);
          if (window.__verlauf[window.__verlauf.length - 1] !== text) window.__verlauf.push(text);
        }
      };
      requestAnimationFrame(merke);
      // Alain tippt oben einmal auf den anderen, der noch spielt – dann baut
      // sein Bild alles aus dem Verlauf nach.
      if (wechseln) {
        let seit = 0;
        const t = setInterval(() => {
          if (!window.LernappLiveSpiel.zuschauen()) return;
          if (!seit) { seit = performance.now(); return; }
          if (performance.now() - seit < 2500) return;
          const anderer = document.querySelector(".lv-chip.ist-waehlbar:not(.ist-ziel)");
          if (!anderer) return;
          clearInterval(t);
          anderer.click();
        }, 100);
      }
      (0, eval)(`(${bot})`)({ raus, seed });
    }, { bot: BOTS[spiel].toString(), bild: BILD[spiel].toString(), raus: raus[i], seed: 1234 + i * 77, wechseln: i === 0 })));
    const t0 = Date.now();
    const bilder = frames.map(() => ({ bilder: {}, wechsel: [] }));
    const vorbei = await bis(async () => {
      await Promise.all(frames.map(async (f, i) => {
        try { bilder[i] = await f.evaluate(() => ({ bilder: window.__bilder, wechsel: window.__wechsel, verlauf: window.__verlauf })); } catch { /* weg */ }
      }));
      // Ein Bild, wenn Alain seit knapp zwei Sekunden zuschaut.
      if (!foto.get(spiel)) {
        try {
          const wem = await frames[0].evaluate(() => window.LernappLiveSpiel.zuschauen());
          if (wem && !foto.get(`seit-${spiel}`)) foto.set(`seit-${spiel}`, Date.now());
          if (wem && Date.now() - foto.get(`seit-${spiel}`) > 1800) {
            foto.set(spiel, true);
            await bild(leitung, `zuschauen-${spiel}`);
          }
        } catch { /* egal */ }
      }
      return (await stand(leitung))?.phase === "pause";
    }, { ms: Number(process.env.WARTEN || 150000), schritt: 250 });
    console.log(nr, spiel, "Runde vorbei:", vorbei, `${Math.round((Date.now() - t0) / 1000)} s`);
    const namen = ["Alain", "Mia", "Jonas"];
    const echt = Object.fromEntries(kennungen.map((k, i) => [k, bilder[i].bilder.ich]));
    bilder.forEach((b, i) => {
      console.log(`${namen[i]} sah: ${b.wechsel.map((w) => (w === "ich" ? "sich" : namen[kennungen.indexOf(w)])).join(" → ")}`);
      Object.entries(b.bilder).forEach(([wem, was]) => {
        if (wem === "ich") return;
        const soll = echt[wem];
        const k = kennungen.indexOf(wem);
        const gleich = JSON.stringify(soll) === JSON.stringify(was);
        // Weggeschaltet, bevor er fertig war: Dann muss es ein Stand sein,
        // den er selbst einmal hatte.
        const zwischen = !gleich && (bilder[k].verlauf || []).includes(JSON.stringify(was));
        pruefe(gleich || zwischen, `${spiel}: ${namen[i]} sah bei ${namen[k]} ${JSON.stringify(was)} – das hatte er nie (Ende: ${JSON.stringify(soll)})`);
        console.log(`  ${namen[i]} → ${namen[k]}: ${gleich ? "gleich wie sein Ende" : zwischen ? "ein Stand, den er hatte" : "ANDERS"} (${JSON.stringify(was).slice(0, 90)})`);
      });
    });
    // Wem einer zuletzt zugeschaut hat, dem hat er bis zum Schluss
    // zugeschaut: Dann sieht er genau dessen Ende.
    bilder.forEach((b, i) => {
      const zuletzt = b.wechsel[b.wechsel.length - 1];
      if (!zuletzt || zuletzt === "ich") return;
      pruefe(JSON.stringify(b.bilder[zuletzt]) === JSON.stringify(echt[zuletzt]), `${spiel}: ${namen[i]} sah am Schluss nicht das Ende von ${namen[kennungen.indexOf(zuletzt)]}`);
    });
    pruefe(bilder[0].wechsel.length >= 2, `${spiel}: Alain hat niemandem zugeschaut (${bilder[0].wechsel.join(",")})`);
    pruefe(vorbei, `${spiel}: Die Runde ging nicht zu Ende`);
    if (!vorbei) break;
  }
} catch (fehler) {
  befunde.push(`Abbruch: ${fehler.stack || fehler}`);
} finally {
  await browser.close();
  halt();
}

fehlerAufSeite.forEach((f) => befunde.push(`Konsole: ${f}`));
console.log(`${geprueft} Prüfungen beim Zuschauen.`);
if (befunde.length) {
  console.error(`\n${befunde.length} Befund${befunde.length === 1 ? "" : "e"}:`);
  befunde.forEach((b) => console.error(`  - ${b}`));
  process.exit(1);
}
console.log("Wer zuschaut, sieht, was die anderen tun.");
