#!/usr/bin/env node
/*
 * check-lesen.mjs – Wie viel liest die arcade aus Firestore?
 * ---------------------------------------------------------------------------
 * Firestore rechnet jedes Dokument ab, das es liefert – eine leere Abfrage
 * als eines, ein Strom (onSnapshot) beim Start alle Treffer und danach jedes
 * geänderte Dokument. Im November 2026 lag die arcade bei 65 000 bis 85 000
 * Lesevorgängen am Tag, frei sind 50 000: Die Startseite las bei jedem
 * Aufruf jedes Dokument der Hall of Fame, jede Runde zweimal die ganze
 * Liste ihres Spiels, die Turnierseite bei jeder Rückkehr alle Einträge.
 *
 * Diese Prüfung fährt die gewöhnlichen Wege mit echten Seiten, echtem
 * cloud.js und dem Firestore-Emulator ab und zählt, was gelesen wird – im
 * SDK selbst, nicht in cloud.js: So zählt sie auch Code, der den Zähler in
 * cloud.js nicht kennt (eine ältere Fassung, --wurzel). Die Regeln sind die
 * aus firestore.rules; was die Regeln selbst lesen (get, exists), zählt sie
 * nicht mit, und auch nicht den einen Lesevorgang der Edge Function.
 *
 * Ausser den Zahlen prüft sie, was die Zahlen klein hält und richtig lässt:
 *
 *   Startseite   der zweite Aufruf liest nur, was sich geändert hat – und
 *                zeigt die fremde Runde von eben trotzdem; nach einem
 *                Löschen im Adminbereich (Stempel in config/miniGames) liest
 *                sie einmal alles, und der Gelöschte ist weg
 *   Spielseite   die Liste kommt aus demselben Speicher, die eigene Runde
 *                steht sofort darin, ohne die Liste zweimal zu lesen
 *   Turnier      die Turnierseite hört bei der Rückkehr nur auf Geändertes
 *   Admin        eine Aktion liest nicht alles neu
 *
 *   node scripts/check-lesen.mjs                 messen und prüfen
 *   node scripts/check-lesen.mjs --nur-messen    nur messen (ältere Fassung)
 *   node scripts/check-lesen.mjs --wurzel <ordner> --json <datei>
 *                                                eine andere Fassung (z. B. die
 *                                                von main, mit git archive
 *                                                ausgepackt) messen, die Zahlen
 *                                                in eine Datei
 *   NUR=admin, DEBUG_LESEN=1                     nur den Adminbereich; Fehler
 *                                                und Warnungen der Seiten zeigen
 *
 * Läuft ohne Netz. Braucht Java (für den Emulator), Playwright und einmalig
 * `npm install`. Ports: PORT (Seiten, 4296), FS_PORT (Firestore, 8096) und,
 * für den Emulator selbst, HUB_PORT (4496), LOG_PORT (4596), WS_PORT (9196).
 */
import { spawn, spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HIER = path.dirname(fileURLToPath(import.meta.url));
const WURZEL = path.resolve(HIER, "..");
const PROJEKT = "demo-mini-lesen";
const FS_PORT = Number(process.env.FS_PORT || 8096);

const argument = (name) => {
  const i = process.argv.indexOf(name);
  return i > 0 ? process.argv[i + 1] : "";
};
const NUR_MESSEN = process.argv.includes("--nur-messen");
const SEITEN = path.resolve(argument("--wurzel") || WURZEL);
const JSON_DATEI = argument("--json");

// ---------------------------------------------------------------------------
// Aussen: den Emulator starten und sich selbst darin noch einmal aufrufen
// ---------------------------------------------------------------------------
if (!process.env.FIRESTORE_EMULATOR_HOST) {
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
  // Eine eigene Konfiguration mit eigenen Ports: So kommt sich die Prüfung
  // mit einem Emulator, der nebenan läuft (test:rules, check-live), nicht in
  // die Quere. Die Regeln lädt das Skript selbst.
  const ordner = mkdtempSync(path.join(os.tmpdir(), "mini-lesen-"));
  const konfig = path.join(ordner, "firebase.json");
  writeFileSync(konfig, JSON.stringify({
    emulators: {
      firestore: { host: "127.0.0.1", port: FS_PORT, websocketPort: Number(process.env.WS_PORT || 9196) },
      hub: { host: "127.0.0.1", port: Number(process.env.HUB_PORT || 4496) },
      logging: { host: "127.0.0.1", port: Number(process.env.LOG_PORT || 4596) },
      ui: { enabled: false },
    },
  }));
  const innen = [process.execPath, fileURLToPath(import.meta.url), ...process.argv.slice(2)].map((t) => JSON.stringify(t)).join(" ");
  const lauf = spawnSync(firebase, ["emulators:exec", "--config", konfig, "--only", "firestore", "--project", PROJEKT, innen], {
    cwd: WURZEL,
    stdio: "inherit",
  });
  rmSync(ordner, { recursive: true, force: true });
  process.exit(lauf.status ?? 1);
}

// ---------------------------------------------------------------------------
// Innen
// ---------------------------------------------------------------------------
const PORT = Number(process.env.PORT || 4296);
const BASIS = `http://127.0.0.1:${PORT}`;
const [FS_HOST, FS_EMU_PORT] = process.env.FIRESTORE_EMULATOR_HOST.split(":");

let playwright;
try { playwright = createRequire(import.meta.url)("playwright"); }
catch {
  console.error("Playwright fehlt – einmalig `npm i`.");
  process.exit(2);
}
const { initializeTestEnvironment } = await import("@firebase/rules-unit-testing");
const { default: compat } = await import("firebase/compat/app");
await import("firebase/compat/firestore");
try { (await import("firebase/firestore")).setLogLevel("silent"); } catch { /* dann eben laut */ }

const befunde = [];
let geprueft = 0;
const pruefe = (bedingung, was) => {
  if (NUR_MESSEN) return;
  geprueft += 1;
  if (!bedingung) befunde.push(was);
};

const env = await initializeTestEnvironment({
  projectId: PROJEKT,
  firestore: { rules: readFileSync(path.join(SEITEN, "firestore.rules"), "utf8"), host: FS_HOST, port: Number(FS_EMU_PORT) },
});
const ohneRegeln = (tun) => env.withSecurityRulesDisabled((ctx) => tun(ctx.firestore()));
const Zeit = compat.firestore.Timestamp;
const SERVERZEIT = () => compat.firestore.FieldValue.serverTimestamp();

// ---------------------------------------------------------------------------
// Die Daten: so ungefähr wie im November 2026
// ---------------------------------------------------------------------------
// 55 Spiele, zehn Leute auf zwölf Geräten (Alain und Lena auf zweien), je
// Spiel vier bis vierzehn Einträge – zusammen gut 500. Dazu die besten Läufe,
// ein laufendes Turnier mit zehn Spielen und acht Leuten, zwei Multiplayer
// darin, und das Rundenprotokoll.
const miniJs = readFileSync(path.join(SEITEN, "mini-games.js"), "utf8");
const SPIELE = [...(miniJs.match(/const SPIELE = \[([\s\S]*?)\];/)?.[1] || "").matchAll(/\{\s*id:\s*"([^"]+)",\s*seite:\s*"([^"]+)"/g)]
  .map((m) => ({ id: m[1], seite: m[2] }));
const ANSEHBAR = new Map([...(miniJs.match(/const ANSEHBAR = \{([\s\S]*?)\n  \};/)?.[1] || "").matchAll(/(\w+): \{ fassung: "([^"]+)"/g)].map((m) => [m[1], m[2]]));
const LEUTE = [
  ["mini_lenalenalena01", "Lena"], ["mini_lenatablet0002", "Lena"], ["mini_jonasjonasjo03", "Jonas"],
  ["mini_miamiamiamia04", "Mia"], ["mini_alainhandy0005", "Alain"], ["mini_alaintablet006", "Alain"],
  ["mini_grosigrosigr07", "Grosi"], ["mini_efuefuefuefu08", "Efu"], ["mini_noahnoahnoah09", "Noah"],
  ["mini_lealealealea10", "Lea"], ["mini_timtimtimtim11", "Tim"], ["mini_idaidaidaida12", "Ida"],
];
const ICH = LEUTE[0];          // das Gerät, das hier spielt
const FREMD = LEUTE[2];        // wer nebenan eine Runde spielt
const TAG = 24 * 3600 * 1000;
const JETZT = Date.now();
const zufall = (() => { let s = 20261127; return () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648; }; })();
const BAHN = JSON.stringify({ v: 4, dt: 250, p: [0, 3, 7, 12, 18, 25], a: "0,1,2,3,4,5", b: "0,0,1,1,2,2", c: "0,0,0,0,0,0", s: 7 });
const TURNIER_ID = "lesecup-a1b2c3d4";
const TURNIER_SPIELE = SPIELE.slice(0, 10).map((s) => s.id);
const SPIEL = "vineSwing";     // die Spielseite der Messung: mit Gegnern, mit «alle»
const SPIEL_SEITE = SPIELE.find((s) => s.id === SPIEL)?.seite || "liane";

const eintraege = [];
SPIELE.forEach((s, i) => {
  const wie = 4 + Math.floor(zufall() * 11);
  const wer = [...LEUTE].sort(() => zufall() - 0.5).slice(0, wie);
  if (s.id === SPIEL && !wer.includes(ICH)) wer.push(ICH);
  wer.forEach(([spieler, name]) => {
    const vorTagen = Math.floor(zufall() * 60 * TAG) + (i % 7) * 3600 * 1000;
    eintraege.push({
      id: `${s.id}_${spieler}`, game: s.id, spieler, name,
      punkte: 10 + Math.floor(zufall() * 900), versuche: 1 + Math.floor(zufall() * 40),
      erstesMs: JETZT - vorTagen - TAG, spielMs: 60000, updatedAtMs: JETZT - vorTagen,
    });
  });
});

async function saeen() {
  await env.clearFirestore();
  await ohneRegeln(async (db) => {
    const schreibe = async (paare) => {
      for (let i = 0; i < paare.length; i += 400) {
        const b = db.batch();
        paare.slice(i, i + 400).forEach(([pfad, daten]) => b.set(db.doc(pfad), daten));
        await b.commit();
      }
    };
    const paare = [];
    eintraege.forEach((e) => {
      const { id, ...felder } = e;
      paare.push([`miniScores/${id}`, { ...felder, updatedAt: Zeit.fromMillis(e.updatedAtMs) }]);
      const fassung = ANSEHBAR.get(e.game);
      if (fassung) paare.push([`miniGeister/${id}`, { game: e.game, spieler: e.spieler, name: e.name, punkte: e.punkte, level: fassung, bahn: BAHN, updatedAtMs: e.updatedAtMs }]);
      // Das Protokoll: je Runde ein Dokument – für die Spieler dieses Geräts
      // alle, für die anderen ein paar, damit Löschen etwas zu tun hat.
      const runden = e.spieler === ICH[0] || e.spieler === LEUTE[1][0] ? e.versuche : Math.min(3, e.versuche);
      for (let nr = 1; nr <= runden; nr += 1) {
        paare.push([`miniRunden/${id}_${nr}`, { game: e.game, spieler: e.spieler, name: e.name, nr, punkte: e.punkte, ms: 30000, zeitMs: e.updatedAtMs - (runden - nr) * 60000 }]);
      }
    });
    paare.push(["config/miniGames", { spiele: SPIELE.map((s) => s.id), updatedAtMs: JETZT - 3 * TAG }]);
    paare.push([`miniTurniere/${TURNIER_ID}`, {
      name: "Lesecup", spiele: TURNIER_SPIELE, startMs: JETZT - 2 * 3600 * 1000, endeMs: JETZT + 5 * TAG, versuche: 0,
      zaehlt: "bester", wertung: "platz", aufgaben: "gleich", sichtbar: "alle", verdeckt: false, aktiv: true,
      erstelltMs: JETZT - TAG, updatedAtMs: JETZT - TAG,
    }]);
    LEUTE.slice(0, 9).forEach(([spieler, name], j) => TURNIER_SPIELE.forEach((spiel, k) => {
      if (spieler === ICH[0] && spiel === SPIEL) return;
      const ms = JETZT - 3600 * 1000 + (j * 10 + k) * 20000;
      paare.push([`miniTurniere/${TURNIER_ID}/eintraege/${spiel}_${spieler}`, {
        game: spiel, spieler, name, punkte: 50 + ((j * 37 + k * 11) % 500), versuche: 1 + (j % 3), offen: false,
        erstesMs: ms, updatedAtMs: ms, updatedAt: Zeit.fromMillis(ms),
      }]);
      const fassung = ANSEHBAR.get(spiel);
      if (fassung) paare.push([`miniTurniere/${TURNIER_ID}/geister/${spiel}_${spieler}`, { game: spiel, spieler, name, punkte: 50 + ((j * 37 + k * 11) % 500), level: fassung, bahn: BAHN, updatedAtMs: ms }]);
    }));
    ["K7QM-1764000000000", "P3RT-1764100000000"].forEach((abend, i) => paare.push([`miniTurniere/${TURNIER_ID}/live/${abend}`, {
      name: `Abend ${i + 1}`, gewicht: 1, endstand: LEUTE.slice(0, 5).map(([spieler, name], p) => ({ spieler, name, punkte: 100 - p, platz: p + 1 })),
      runden: 3, spiele: TURNIER_SPIELE.slice(0, 3), erstelltMs: JETZT - TAG + i, updatedAtMs: JETZT - TAG + i,
    }]));
    ["Herbstcup", "Familienabend", "Schnell"].forEach((name, i) => paare.push([`miniPresets/${name.toLowerCase()}-0000000${i}`, {
      name, turnier: { name, spiele: TURNIER_SPIELE.slice(0, 3), versuche: 3 }, gespeichertMs: JETZT - i,
    }]));
    await schreibe(paare);
  });
}

// Eine Runde nebenan: wie cloud.js speichere, mit der Uhr des Servers.
async function fremdeRunde(spiel = SPIEL, mehr = 7) {
  const e = eintraege.find((x) => x.game === spiel && x.spieler === FREMD[0]) || eintraege.find((x) => x.game === spiel && x.spieler !== ICH[0]);
  e.punkte += mehr;
  e.versuche += 1;
  e.updatedAtMs = Date.now();
  await ohneRegeln((db) => db.doc(`miniScores/${e.id}`).set({ punkte: e.punkte, versuche: e.versuche, updatedAtMs: e.updatedAtMs, updatedAt: SERVERZEIT() }, { merge: true }));
  return e;
}

// ---------------------------------------------------------------------------
// Der Browser: das SDK aus node_modules, verbunden mit dem Emulator, und ein
// Zähler darin
// ---------------------------------------------------------------------------
const SDK = new Map(["app", "firestore", "auth"].map((teil) => [
  teil, readFileSync(path.join(WURZEL, "node_modules", "firebase", `firebase-${teil}-compat.js`), "utf8"),
]));
// Hinter das SDK: jede Antwort des Servers zählen, so wie Firestore abrechnet.
const ZAEHLER = `
;(() => {
  const fs = window.firebase && window.firebase.firestore;
  if (!fs) return;
  const melde = (art, n) => { try { window.__lesen(art, n); } catch (e) { /* ohne Zähler */ } };
  // "miniTurniere/x/eintraege/y" → "miniTurniere/eintraege"
  const sammlung = (pfad) => String(pfad || "").split("/").filter((_, i) => i % 2 === 0).join("/");
  const vonDocs = (s) => (s.docs && s.docs[0] ? sammlung(s.docs[0].ref.path) : "leer");
  const Q = fs.Query.prototype, D = fs.DocumentReference.prototype, T = fs.Transaction.prototype;
  const qGet = Q.get;
  Q.get = function (...a) { return qGet.apply(this, a).then((s) => { if (!s.metadata.fromCache) melde("abfrage " + vonDocs(s), Math.max(1, s.size)); return s; }); };
  const dGet = D.get;
  D.get = function (...a) { const pfad = this.path; return dGet.apply(this, a).then((s) => { if (!s.metadata.fromCache) melde("dokument " + sammlung(pfad), 1); return s; }); };
  const tGet = T.get;
  T.get = function (ref, ...a) { return tGet.call(this, ref, ...a).then((s) => { melde("transaktion " + sammlung(ref.path), 1); return s; }); };
  const strom = (orig, istAbfrage) => function (...a) {
    const i = a.findIndex((x) => typeof x === "function" || (x && typeof x.next === "function"));
    if (i < 0) return orig.apply(this, a);
    const wer = a[i];
    const next = typeof wer === "function" ? wer : wer.next.bind(wer);
    const pfad = istAbfrage ? "" : this.path;
    let erster = true;
    const neu = (s) => {
      if (!s.metadata.fromCache && !s.metadata.hasPendingWrites) {
        if (!istAbfrage) { melde("strom " + sammlung(pfad), 1); }
        else if (erster) { melde("strom " + vonDocs(s), Math.max(1, s.size)); }
        else { const n = s.docChanges().filter((c) => c.type !== "removed").length; if (n) melde("strom " + vonDocs(s), n); }
        erster = false;
      }
      return next(s);
    };
    a[i] = typeof wer === "function" ? neu : { ...wer, next: neu };
    return orig.apply(this, a);
  };
  Q.onSnapshot = strom(Q.onSnapshot, true);
  D.onSnapshot = strom(D.onSnapshot, false);
  // Mit dem Emulator verbinden, sobald cloud.js Firestore öffnet – als Admin,
  // wenn das Gerät einer ist.
  const offen = new WeakSet();
  window.firebase.firestore = new Proxy(fs, {
    apply(ziel, dies, args) {
      const db = Reflect.apply(ziel, dies, args);
      if (!offen.has(db)) {
        offen.add(db);
        const admin = window.__lesenAdmin;
        db.useEmulator("${FS_HOST}", ${Number(FS_EMU_PORT)}, admin ? { mockUserToken: { sub: "admin", user_id: "admin", email: admin, email_verified: true } } : {});
      }
      return db;
    },
  });
})();
`;
const APP_DAZU = `
;(() => {
  const init = window.firebase.initializeApp;
  window.firebase.initializeApp = function (konfig, ...rest) { return init.call(this, { ...konfig, projectId: "${PROJEKT}" }, ...rest); };
})();
`;
// Der Adminbereich meldet sich an: hier ohne Google, ohne Mail.
const AUTH = `
  window.firebase = window.firebase || {};
  window.firebase.auth = function () {
    return {
      getRedirectResult: async () => null,
      isSignInWithEmailLink: () => false,
      onAuthStateChanged: (fn) => fn({ email: "alain.sc2@gmail.com", emailVerified: true }),
      signOut: async () => {},
    };
  };
  window.firebase.auth.GoogleAuthProvider = function () {};
`;

const server = spawn(process.execPath, [path.join(HIER, "local-pwa-server.cjs"), String(PORT)], { cwd: SEITEN, stdio: "ignore" });
const halt = () => { if (!server.killed) server.kill(); };
process.on("exit", halt);
for (let versuch = 0; versuch < 50; versuch += 1) {
  try { if ((await fetch(`${BASIS}/index.html`)).ok) break; } catch { /* noch nicht da */ }
  await new Promise((weiter) => setTimeout(weiter, 100));
}

const browser = await playwright.chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
const fehlerAufSeite = [];

async function geraet(name, { kennung = "", wer = "", admin = false } = {}) {
  const kontext = await browser.newContext({ viewport: { width: 1100, height: 800 }, serviceWorkers: "block" });
  const zaehler = { summe: 0, je: {} };
  await kontext.exposeBinding("__lesen", (_, art, n) => {
    zaehler.summe += n;
    zaehler.je[art] = (zaehler.je[art] || 0) + n;
  });
  await kontext.route("https://www.gstatic.com/firebasejs/**", (route) => {
    const teil = (route.request().url().match(/firebase-(\w+)-compat\.js/) || [])[1];
    const body = teil === "auth" ? AUTH : teil === "firestore" ? SDK.get("firestore") + ZAEHLER : teil === "app" ? SDK.get("app") + APP_DAZU : "/* hier nicht gebraucht */";
    route.fulfill({ contentType: "text/javascript; charset=utf-8", body });
  });
  // Die Realtime Database (wer spielt, Zuschauen) und alles andere draussen
  // gehört nicht zu dieser Messung.
  await kontext.route(/^https:\/\/(?!www\.gstatic\.com)/, (route) => route.abort());
  await kontext.addInitScript(({ kennung, wer, admin }) => {
    if (admin) window.__lesenAdmin = "alain.sc2@gmail.com";
    try {
      if (kennung && !localStorage.getItem("mini.id")) localStorage.setItem("mini.id", kennung);
      if (wer && localStorage.getItem("mini.name") === null) localStorage.setItem("mini.name", wer);
      // Die installierte App fragt sonst nach dem Startbildschirm.
      localStorage.setItem("mini.install", "weg");
    } catch { /* egal */ }
  }, { kennung, wer, admin });
  const seite = await kontext.newPage();
  seite.on("pageerror", (fehler) => fehlerAufSeite.push(`${name}: ${fehler.message}`));
  if (process.env.DEBUG_LESEN) seite.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") console.log(`    [${name}] ${m.text().slice(0, 300)}`); });
  seite.on("dialog", (dialog) => dialog.accept(dialog.type() === "prompt" ? "Lena B." : undefined).catch(() => {}));
  return { name, kontext, seite, zaehler };
}

// Warten, bis nichts mehr gelesen wird: 2,5 Sekunden ohne neuen Lesevorgang,
// frühestens nach mindestens (das Nachreichen der Läufe kommt nach 2,5 s).
async function ruhe(g, { mindestens = 3200, hoechstens = 20000 } = {}) {
  const start = Date.now();
  let zuletzt = g.zaehler.summe;
  let seit = Date.now();
  for (;;) {
    await new Promise((weiter) => setTimeout(weiter, 250));
    if (g.zaehler.summe !== zuletzt) { zuletzt = g.zaehler.summe; seit = Date.now(); }
    const lange = Date.now() - start;
    if ((lange >= mindestens && Date.now() - seit >= 2500) || lange >= hoechstens) return;
  }
}

const messungen = [];
async function messe(g, was, tun, optionen) {
  const vorher = { summe: g.zaehler.summe, je: { ...g.zaehler.je } };
  await tun();
  await ruhe(g, optionen);
  const je = {};
  Object.entries(g.zaehler.je).forEach(([art, n]) => { const d = n - (vorher.je[art] || 0); if (d) je[art] = d; });
  const summe = g.zaehler.summe - vorher.summe;
  let cloud = null;
  try { cloud = await g.seite.evaluate(() => window.MiniCloud?.lesevorgaenge?.() || null); } catch { cloud = null; }
  messungen.push({ was, summe, je, cloud });
  console.log(`  ${String(summe).padStart(5)}  ${was}`);
  return summe;
}

const geladen = (g) => g.seite.waitForSelector(".ar-kachel", { timeout: 15000 }).catch(() => {});
const listeDa = (g) => g.seite.waitForFunction(() => document.querySelector(".ar-rang-text strong")?.textContent !== "…", null, { timeout: 15000 }).catch(() => {});

await saeen();
console.log(`${eintraege.length} Einträge in ${SPIELE.length} Spielen, ${LEUTE.length} Geräte. Gelesene Dokumente je Ablauf:`);

// NUR=admin: nur den Adminbereich (zum Nachsehen).
const NUR = process.env.NUR || "";
let weiter = null;   // Lenas Gerät, für die Zeit nach dem Adminbereich

// --- Die Startseite ----------------------------------------------------------
if (!NUR) {
const lena = await geraet("Lena", { kennung: ICH[0], wer: ICH[1] });
await messe(lena, "Startseite, erster Aufruf", async () => { await lena.seite.goto(`${BASIS}/`, { waitUntil: "load" }); await geladen(lena); await listeDa(lena); });
await messe(lena, "Startseite, zweiter Aufruf", async () => { await lena.seite.reload({ waitUntil: "load" }); await geladen(lena); await listeDa(lena); });
const nebenan = await fremdeRunde();
const nachFremd = await messe(lena, "Startseite nach einer fremden Runde", async () => { await lena.seite.reload({ waitUntil: "load" }); await geladen(lena); await listeDa(lena); });
{
  // Die fremde Runde steht da: in der Gesamtwertung zählt ihre Zahl.
  const steht = await lena.seite.evaluate(async ({ spiel, punkte, name }) => {
    const liste = await window.LernappMini.listeFuer(spiel);
    return liste.some((e) => e.name === name && e.punkte === punkte);
  }, { spiel: nebenan.game, punkte: nebenan.punkte, name: nebenan.name });
  pruefe(steht, `Die Startseite zeigt die fremde Runde von eben nicht (${nebenan.name}, ${nebenan.punkte}).`);
  pruefe(nachFremd <= 20, `Die Startseite liest nach einer fremden Runde ${nachFremd} Dokumente statt nur der geänderten.`);
}

// --- Die Spielseite ------------------------------------------------------------
const spielGeladen = (g) => g.seite.waitForSelector(".cm-bar", { timeout: 15000 }).catch(() => {});
await messe(lena, `Spielseite laden (${SPIEL_SEITE})`, async () => { await lena.seite.goto(`${BASIS}/${SPIEL_SEITE}`, { waitUntil: "load" }); await spielGeladen(lena); });
const PUNKTE = 1000 + Math.floor(zufall() * 500);
await messe(lena, "Eine Runde: Ende (Eintragen, Liste)", async () => {
  await lena.seite.evaluate((punkte) => {
    const block = window.LernappMini.ergebnis({ punkte });
    document.body.append(block);
  }, PUNKTE);
  await lena.seite.waitForFunction(() => /Eingetragen|Bestzahl/.test(document.querySelector(".mini-meldung")?.textContent || ""), null, { timeout: 15000 }).catch(() => {});
});
{
  const eigen = await lena.seite.evaluate(({ spiel }) => window.LernappMini.listeFuer(spiel).then((l) => l.find((e) => e.eigen) || null), { spiel: SPIEL });
  pruefe(eigen?.punkte === PUNKTE, `Die eigene Runde steht nicht gleich in der Liste: ${JSON.stringify(eigen)}`);
}
await messe(lena, "Eine Runde: Neustart (Gegner laden)", async () => {
  await lena.seite.click('.cm-bar button[aria-label="Neu starten"], .cm-bar button[title="Neu starten"]').catch(() => {});
});
await messe(lena, "Noch eine Runde (Ende und Neustart)", async () => {
  await lena.seite.evaluate((punkte) => { document.body.append(window.LernappMini.ergebnis({ punkte })); }, PUNKTE - 300);
  await lena.seite.waitForFunction(() => document.querySelectorAll(".mini-meldung").length >= 2 && /Eingetragen|Bestzahl/.test([...document.querySelectorAll(".mini-meldung")].pop()?.textContent || ""), null, { timeout: 15000 }).catch(() => {});
  await lena.seite.click('.cm-bar button[aria-label="Neu starten"], .cm-bar button[title="Neu starten"]').catch(() => {});
});
await messe(lena, "Zurück zur Startseite", async () => { await lena.seite.goto(`${BASIS}/`, { waitUntil: "load" }); await geladen(lena); await listeDa(lena); });
{
  const eigen = await lena.seite.evaluate(({ spiel }) => window.LernappMini.listeFuer(spiel).then((l) => l.find((e) => e.eigen) || null), { spiel: SPIEL });
  pruefe(eigen?.punkte === PUNKTE, `Zurück auf der Startseite fehlt die eigene Runde: ${JSON.stringify(eigen)}`);
}
await messe(lena, "Ein anderes Spiel laden (Turmbau)", async () => { await lena.seite.goto(`${BASIS}/turmbau`, { waitUntil: "load" }); await spielGeladen(lena); });

// --- Das Turnier -----------------------------------------------------------------
const turnierDa = (g) => g.seite.waitForSelector(".ar-kachel", { timeout: 15000 }).catch(() => {});
await messe(lena, "Turnierseite, erster Aufruf", async () => { await lena.seite.goto(`${BASIS}/turnier?t=${TURNIER_ID}`, { waitUntil: "load" }); await turnierDa(lena); });
await messe(lena, "Turnier: Spielseite laden", async () => { await lena.seite.goto(`${BASIS}/${SPIEL_SEITE}?turnier=${TURNIER_ID}`, { waitUntil: "load" }); await spielGeladen(lena); });
await messe(lena, "Turnier: eine Runde", async () => {
  await lena.seite.waitForFunction(() => window.LernappTurnier?.stand?.().geladen, null, { timeout: 10000 }).catch(() => {});
  await lena.seite.evaluate(() => window.LernappTurnier.rundeBeginnt());
  await lena.seite.waitForTimeout(600);
  await lena.seite.evaluate(() => { document.body.append(window.LernappMini.ergebnis({ punkte: 777 })); });
});
const zurueckTurnier = await messe(lena, "Zurück zur Turnierseite", async () => { await lena.seite.goto(`${BASIS}/turnier?t=${TURNIER_ID}`, { waitUntil: "load" }); await turnierDa(lena); });
pruefe(zurueckTurnier <= 20, `Zurück auf der Turnierseite liest sie ${zurueckTurnier} Dokumente statt nur der geänderten.`);
{
  // Unter der Kennung, unter der das Gerät jetzt spielt: Lena spielt auf zwei
  // Geräten, und das Gerät nimmt die, unter der der Name am meisten spielt.
  const meiner = await lena.seite.evaluate(({ spiel, id }) => JSON.parse(localStorage.getItem("mini.turnier.stand") || "{}")?.[id]?.eintraege?.find((e) => e.game === spiel && e.spieler === localStorage.getItem("mini.id")) || null, { spiel: SPIEL, id: TURNIER_ID });
  pruefe(meiner?.punkte === 777, `Zurück auf der Turnierseite fehlt die eigene Runde: ${JSON.stringify(meiner)}`);
}
// Nebenan spielt jemand im Turnier, während die Seite offen ist.
await messe(lena, "Turnierseite offen, nebenan eine Turnierrunde", async () => {
  await ohneRegeln((db) => db.doc(`miniTurniere/${TURNIER_ID}/eintraege/${TURNIER_SPIELE[1]}_${FREMD[0]}`).set({ punkte: 999, versuche: 9, offen: false, updatedAtMs: Date.now(), updatedAt: SERVERZEIT() }, { merge: true }));
}, { mindestens: 2500 });
{
  // Die fremde Runde von eben steht in der Liste der Turnierseite.
  const fremd = await lena.seite.evaluate(({ id, schluessel }) => JSON.parse(localStorage.getItem("mini.turnier.stand") || "{}")?.[id]?.eintraege?.find((e) => e.id === schluessel) || null,
    { id: TURNIER_ID, schluessel: `${TURNIER_SPIELE[1]}_${FREMD[0]}` });
  pruefe(fremd?.punkte === 999, `Die Turnierrunde nebenan kam auf der offenen Turnierseite nicht an: ${JSON.stringify(fremd)}`);
}
// Der Admin leert die Liste eines Spiels (cloud.js, loescheTurnierEintraege):
// Die Einträge sind weg, das Turnier hat eine neue Uhr – die Turnierseite
// liest bei der nächsten Rückkehr einmal ganz, und die Gelöschten sind weg.
await ohneRegeln(async (db) => {
  const weg = await db.collection(`miniTurniere/${TURNIER_ID}/eintraege`).where("game", "==", TURNIER_SPIELE[2]).get();
  const b = db.batch();
  weg.docs.forEach((d) => b.delete(d.ref));
  b.update(db.doc(`miniTurniere/${TURNIER_ID}`), { updatedAtMs: Date.now(), updatedAt: SERVERZEIT() });
  await b.commit();
});
const nachLeeren = await messe(lena, "Turnierseite, nachdem der Admin ein Spiel geleert hat", async () => { await lena.seite.goto(`${BASIS}/turnier?t=${TURNIER_ID}`, { waitUntil: "load" }); await turnierDa(lena); });
{
  const noch = await lena.seite.evaluate(({ id, spiel }) => (JSON.parse(localStorage.getItem("mini.turnier.stand") || "{}")?.[id]?.eintraege || []).filter((e) => e.game === spiel).length,
    { id: TURNIER_ID, spiel: TURNIER_SPIELE[2] });
  pruefe(noch === 0, `Nach dem Leeren stehen in der Turnierseite noch ${noch} Einträge des Spiels.`);
  pruefe(nachLeeren > 40, `Nach dem Leeren liest die Turnierseite nicht einmal ganz (${nachLeeren}).`);
}
const nachLeerenDanach = await messe(lena, "Turnierseite, Aufruf danach", async () => { await lena.seite.goto(`${BASIS}/turnier?t=${TURNIER_ID}`, { waitUntil: "load" }); await turnierDa(lena); });
pruefe(nachLeerenDanach <= 20, `Nach dem ganzen Lesen liest die Turnierseite wieder alles (${nachLeerenDanach}).`);
await lena.seite.goto(`${BASIS}/`, { waitUntil: "load" });
await geladen(lena);
await ruhe(lena);
weiter = lena;
}

// --- Der Adminbereich ------------------------------------------------------------
const admin = await geraet("Admin", { kennung: LEUTE[4][0], wer: LEUTE[4][1], admin: true });
const adminDa = (g) => g.seite.waitForFunction(() => /Turnier/.test(document.querySelector(".adm-streifen")?.textContent || "") && !/…/.test(document.querySelector(".adm-streifen")?.textContent || ""), null, { timeout: 20000 }).catch(() => {});
await messe(admin, "Admin: aufbauen", async () => { await admin.seite.goto(`${BASIS}/admin`, { waitUntil: "load" }); await adminDa(admin); });
if (process.env.DEBUG_LESEN) console.log((await admin.seite.evaluate(() => document.body.innerText)).slice(0, 600));
// Eine Aktion: einen Eintrag umbenennen (im Fenster eines Spiels).
const umbenannt = await messe(admin, "Admin: einen Eintrag umbenennen", async () => {
  await admin.seite.evaluate(() => { const k = document.querySelector("#adm-spiele .adm-klapp-knopf"); if (k?.getAttribute("aria-expanded") !== "true") k?.click(); });
  await admin.seite.waitForTimeout(400);
  await admin.seite.locator(`#adm-spiele .adm-wahl[data-spiel="${SPIEL}"] .adm-wahl-feld`).first().click({ timeout: 5000 }).catch((f) => befunde.push(`Admin: Das Spiel liess sich nicht öffnen: ${f.message.split("\n")[0]}`));
  await admin.seite.waitForSelector(".adm-bestenliste button", { timeout: 8000 }).catch(() => {});
  await admin.seite.locator(".adm-bestenliste button", { hasText: "Namen ändern" }).first().click({ timeout: 5000 }).catch(() => {});
  await admin.seite.waitForTimeout(1500);
  await adminDa(admin);
});
// Und einen löschen: Danach setzt der Adminbereich den Stempel (cloud.js,
// setzeListenStand), und die Startseiten lesen einmal alles.
const idsVon = async (spiel) => {
  let ids = [];
  await ohneRegeln(async (db) => { ids = (await db.collection("miniScores").where("game", "==", spiel).get()).docs.map((d) => d.id); });
  return ids;
};
const vorDemLoeschen = new Set(await idsVon(SPIEL));
const geloeschtGelesen = await messe(admin, "Admin: einen Eintrag löschen", async () => {
  await admin.seite.waitForSelector(".adm-bestenliste button", { timeout: 8000 }).catch(() => {});
  await admin.seite.locator(".adm-bestenliste button", { hasText: "Löschen" }).last().click({ timeout: 5000 }).catch(() => {});
  await admin.seite.waitForTimeout(1500);
  await adminDa(admin);
});
const nachDemLoeschen = new Set(await idsVon(SPIEL));
pruefe(umbenannt <= 60, `Eine Aktion im Adminbereich liest ${umbenannt} Dokumente – fast alles neu.`);
const geloescht = [...vorDemLoeschen].filter((id) => !nachDemLoeschen.has(id));
pruefe(geloescht.length === 1, `Im Adminbereich wurde nicht genau ein Eintrag gelöscht: ${geloescht.join(", ") || "keiner"}`);
pruefe(geloeschtGelesen <= 120, `Ein Eintrag löschen liest im Adminbereich ${geloeschtGelesen} Dokumente.`);
{
  // Und die Runden dazu sind weg (cloud.js, loescheRunden): nur die dieses Eintrags.
  let runden = -1;
  await ohneRegeln(async (db) => { runden = (await db.collection("miniRunden").where("game", "==", SPIEL).get()).docs.filter((d) => geloescht.includes(`${d.data().game}_${d.data().spieler}`)).length; });
  pruefe(runden === 0, `Nach dem Löschen stehen noch ${runden} Runden des Eintrags im Protokoll.`);
}
await admin.kontext.close();

if (weiter) {
  const lena = weiter;
  const nachLoeschen = await messe(lena, "Startseite nach einem Löschen im Admin", async () => { await lena.seite.reload({ waitUntil: "load" }); await geladen(lena); await listeDa(lena); });
  const noch = await lena.seite.evaluate(({ spiel, weg }) => window.LernappMini.listeFuer(spiel).then((l) => l.filter((e) => weg.includes(e.id)).map((e) => e.id)), { spiel: SPIEL, weg: geloescht });
  pruefe(!noch.length, `Nach dem Löschen im Adminbereich steht der Eintrag auf der Startseite noch da: ${noch.join(", ")}`);
  pruefe(nachLoeschen > eintraege.length / 2, `Nach dem Löschen im Adminbereich liest die Startseite nicht einmal alles (${nachLoeschen}).`);
  const danach = await messe(lena, "Startseite, Aufruf danach", async () => { await lena.seite.reload({ waitUntil: "load" }); await geladen(lena); await listeDa(lena); });
  pruefe(danach <= 20, `Nach dem vollen Lesen liest die Startseite wieder alles (${danach}).`);
  await lena.kontext.close();
}

await browser.close();
await env.cleanup();
halt();

const summe = messungen.reduce((s, m) => s + m.summe, 0);
console.log(`  ${String(summe).padStart(5)}  zusammen`);
if (JSON_DATEI) writeFileSync(JSON_DATEI, JSON.stringify({ seiten: SEITEN, eintraege: eintraege.length, messungen }, null, 2));
if (fehlerAufSeite.length) console.log(`\nFehler auf den Seiten:\n  ${fehlerAufSeite.slice(0, 10).join("\n  ")}`);
if (NUR_MESSEN) process.exit(0);
if (fehlerAufSeite.length) befunde.push(`${fehlerAufSeite.length} Fehler auf den Seiten.`);
console.log(`\n${geprueft} Prüfungen.`);
if (befunde.length) {
  console.log(`${befunde.length} Befund${befunde.length === 1 ? "" : "e"}:\n  - ${befunde.join("\n  - ")}`);
  process.exit(1);
}
console.log("✓ Alles gut.");
