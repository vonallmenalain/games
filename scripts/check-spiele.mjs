/*
 * Die Mini-Games im Browser: läuft, was hier herausgeschnitten wurde?
 * ---------------------------------------------------------------------------
 * pruefen.mjs liest Dateien. Das hier spielt: Es öffnet jedes Spiel so, wie jemand es öffnet, dem der Link geschickt wurde, und schaut
 * nach, ob eine Bühne dasteht, die Landschaft dahinter, die Knöpfe oben links
 * – und ob der Browser dabei schweigt.
 *
 * Das ist der Punkt dieses Skripts. styles.css und train-art.js sind aus der
 * App herausgeschnitten worden; was dabei zu viel weggefallen ist, sieht man
 * keiner Datei an. Man sieht es einer Seite an, die weiss bleibt, oder einer
 * Zeile in der Konsole.
 *
 * Firestore wird NICHT angefasst: cloud.js wird im Browser durch eine
 * Attrappe ersetzt, die dieselben Auskünfte gibt und die Einträge im Speicher
 * hält. Ein Prüfskript, das in die Produktionsdatenbank schreibt, wäre ein
 * Prüfskript, das man nicht laufen lässt.
 *
 * Aufruf:  node scripts/check-spiele.mjs
 * Nötig:   Playwright. Der lokale Server wird selbst gestartet und beendet.
 */
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { readFileSync } from "node:fs";
import { SPIELE } from "./seiten-bauen.mjs";

const HIER = path.dirname(fileURLToPath(import.meta.url));
const WURZEL = path.resolve(HIER, "..");
const PORT = Number(process.env.PORT || 4291);
const BASIS = `http://127.0.0.1:${PORT}`;

const befunde = [];
let geprueft = 0;
const pruefe = (bedingung, was) => { geprueft += 1; if (!bedingung) befunde.push(was); };

let playwright;
try {
  playwright = createRequire(import.meta.url)("playwright");
} catch {
  console.error("Playwright fehlt – ohne Browser lässt sich nicht spielen.");
  console.error("Einmalig einrichten:  npm i && npx playwright install chromium");
  process.exit(2);
}

// Das Stylesheet als Text: Zu jeder Klasse, die eine Seite wirklich benutzt,
// muss es darin eine Regel geben. Genau das geht beim Herausschneiden aus dem
// Stylesheet der App verloren – und eine Klasse ohne Regel sieht man einer
// Datei nicht an.
const STYLESHEET = readFileSync(path.join(WURZEL, "styles.css"), "utf8");
// Die Familien, die es hier gibt. Was nicht dazugehört, kommt aus dem Browser
// (z. B. Klassen, die ein Spiel selbst erfindet) und hat auch in der App keine
// Regel.
const UNSER = /^(cm|mini|tn|kk|wf|ft|sg|bs|tb|zg|hz|ww|bw|sl|scene|help-voice|sound|confetti)(-|$)/;
const hatRegel = (klasse) => new RegExp(`\\.${klasse.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\w-])`).test(STYLESHEET);
// Klassen ohne eigene Regel – und das ist richtig so. Sie stehen auch in der
// App in keiner:
//   cm-icon-<name>   die Bühne hängt den Namen an jeden Knopf; gestaltet wird
//                    .cm-icon, der Name ist zum Finden da.
//   sound-core …     Teile einer Zeichnung, die Farbe und Strich vom
//                    Elternteil erben.
//   sg-licht         das Licht des Signals; gefärbt wird es über
//                    .sg-licht-gruen bzw. .sg-licht-rot.
//   hz-zeiger        der Zeiger des Manometers; wo er steht, schreibt
//                    heizer.js als transform-Attribut ins SVG. Eine Regel
//                    dazu gäbe es nur, damit hier eine steht.
const OHNE_REGEL = new Set(["sound-core", "sound-wave-wide", "rs-prompt-text", "rs-klappe", "sg-licht", "hz-zeiger"]);
const brauchtRegel = (k) => UNSER.test(k) && !OHNE_REGEL.has(k) && !k.startsWith("cm-icon-");

const server = spawn(process.execPath, [path.join(HIER, "local-pwa-server.cjs"), String(PORT)], { cwd: WURZEL, stdio: "ignore" });
const halt = () => { if (!server.killed) server.kill(); };
process.on("exit", halt);
process.on("SIGINT", () => { halt(); process.exit(130); });

async function warteAufServer() {
  for (let versuch = 0; versuch < 50; versuch += 1) {
    try { if ((await fetch(`${BASIS}/index.html`)).ok) return true; } catch { /* noch nicht da */ }
    await new Promise((weiter) => setTimeout(weiter, 100));
  }
  return false;
}
if (!(await warteAufServer())) { console.error(`Der lokale Server auf ${BASIS} kam nicht hoch.`); process.exit(2); }

// ---------------------------------------------------------------------------
// Die Attrappe: cloud.js, ohne Firestore
// ---------------------------------------------------------------------------
// In einem Spiel steht schon jemand – sonst liesse sich "Platz 2" nicht prüfen.
const ATTRAPPE = `
(() => {
  const LAGER = "__mini_attrappe";
  const anfang = [
    ["towerStack_mini_vorherdagewesen", { id: "towerStack_mini_vorherdagewesen", game: "towerStack", spieler: "mini_vorherdagewesen", name: "Grosi", punkte: 99, versuche: 4, updatedAtMs: 1000 }],
    ["fishPond_mini_vorherdagewesen", { id: "fishPond_mini_vorherdagewesen", game: "fishPond", spieler: "mini_vorherdagewesen", name: "Grosi", punkte: 12, versuche: 2, updatedAtMs: 1000 }],
  ];
  let gemerkt = null;
  try { gemerkt = JSON.parse(localStorage.getItem(LAGER) || "null"); } catch { gemerkt = null; }
  const eintraege = new Map(Array.isArray(gemerkt) ? gemerkt : anfang);
  const sichern = () => { try { localStorage.setItem(LAGER, JSON.stringify([...eintraege])); } catch {} };
  window.__miniEintraege = eintraege;

  const TLAGER = "__mini_turnier_attrappe";
  let tGemerkt = null;
  try { tGemerkt = JSON.parse(localStorage.getItem(TLAGER) || "null"); } catch { tGemerkt = null; }
  const tAnfang = window.__miniTurniereAnfang || {};
  const turniere = new Map(tGemerkt ? tGemerkt.turniere : (tAnfang.turniere || []).map((t) => [t.id, t]));
  const tEintraege = new Map(tGemerkt ? tGemerkt.eintraege : (tAnfang.eintraege || [])
    .map((e) => [e.turnier + "/" + e.game + "_" + e.spieler, { ...e, id: e.game + "_" + e.spieler }]));
  const tSichern = () => {
    try { localStorage.setItem(TLAGER, JSON.stringify({ turniere: [...turniere], eintraege: [...tEintraege] })); } catch {}
  };
  window.__miniTurniere = turniere;
  window.__miniTurnierEintraege = tEintraege;
  window.MiniCloud = {
    offeneSpiele: async () => {
      // Wie cloud.js: Nicht lesen koennen wirft, "nichts eingetragen" gibt
      // null zurueck. Nur so laesst sich beides auseinanderhalten.
      if (window.__miniOhneNetz) throw new Error("kein Netz");
      return window.__miniOffen ?? null;
    },
    setzeOffeneSpiele: async (liste) => { window.__miniOffen = liste; return liste; },
    ergebnisse: async (spiele) => {
      const gefragt = Array.isArray(spiele) ? spiele : [];
      window.__miniGefragt = gefragt;
      return [...eintraege.values()].filter((e) => gefragt.includes(e.game)).map((e) => ({ ...e }));
    },
    // Wie cloud.js: umbenannt wird in ALLEN Spielen dieses Geraets, und ein
    // Spiel wird dabei nicht genannt. Womit die Attrappe aufgerufen wurde,
    // bleibt stehen - so laesst sich pruefen, dass niemand mehr ein einzelnes
    // Spiel umbenennt.
    benenneUm: async (was) => {
      window.__miniUmbenannt = was;
      const { spieler, name } = was;
      const meine = [...eintraege.values()].filter((e) => e.spieler === spieler);
      if (!meine.length) return null;
      let geaendert = 0;
      for (const alt of meine) {
        if (alt.name === name) continue;
        eintraege.set(alt.id, { ...alt, name, updatedAtMs: Date.now() });
        geaendert += 1;
      }
      sichern();
      return { spiele: meine.length, geaendert };
    },
    speichere: async ({ game, spieler, name, punkte }) => {
      const id = game + "_" + spieler;
      const alt = eintraege.get(id);
      if (!alt) {
        eintraege.set(id, { id, game, spieler, name, punkte, versuche: 1, updatedAtMs: Date.now() });
        sichern();
        return { rekord: true, punkte, versuche: 1 };
      }
      const rekord = punkte > alt.punkte;
      eintraege.set(id, { ...alt, name, punkte: rekord ? punkte : alt.punkte, versuche: alt.versuche + 1, updatedAtMs: Date.now() });
      sichern();
      return { rekord, punkte: rekord ? punkte : alt.punkte, versuche: alt.versuche + 1 };
    },

    // Fuer den Adminbereich: dieselbe Anwendung, dieselbe Datenbank.
    app: () => ({}),
    projektId: "attrappe",
    lies: (doc) => {
      const d = doc && doc.data ? doc.data() : null;
      return d && d.game && d.name ? { ...d, id: doc.id } : null;
    },
    db: () => ({
      collection: (sammlung) => ({
        limit: () => ({
          get: async () => ({
            forEach: (fn) => {
              if (sammlung !== "miniScores") return;
              [...eintraege.values()].forEach((e) => fn({ id: e.id, data: () => ({ ...e }) }));
            },
          }),
        }),
        doc: (id) => ({
          delete: async () => { eintraege.delete(id); sichern(); },
          set: async (daten) => { eintraege.set(id, { ...eintraege.get(id), ...daten }); sichern(); },
        }),
      }),
    }),

    // Die Turniere. Dieselben Auskuenfte wie cloud.js, und dieselben Grenzen,
    // die dort die Regeln der Datenbank ziehen: Ein Versuch nur, solange das
    // Turnier laeuft und Versuche uebrig sind, ein Ergebnis nur zu einem
    // offenen Versuch. Was cloud.js wirklich schreibt, prueft
    // scripts/test-rules.mjs gegen die echten Regeln.
    turnier: async (id) => {
      if (window.__miniOhneNetz) throw new Error("kein Netz");
      const t = turniere.get(id);
      return t ? { ...t } : null;
    },
    oeffentlicheTurniere: async () => [...turniere.values()].filter((t) => t.sichtbar === "alle").map((t) => ({ ...t })),
    alleTurniere: async () => [...turniere.values()].map((t) => ({ ...t })),
    setzeTurnier: async (id, daten) => {
      const t = { ...daten, id, spiele: [...new Set(daten.spiele)] };
      turniere.set(id, t);
      tSichern();
      return { ...t };
    },
    loescheTurnier: async (id) => {
      turniere.delete(id);
      for (const k of [...tEintraege.keys()]) if (k.startsWith(id + "/")) tEintraege.delete(k);
      tSichern();
    },
    turnierErgebnisse: async (id, { game = "" } = {}) => [...tEintraege.entries()]
      .filter(([k, e]) => k.startsWith(id + "/") && (!game || e.game === game))
      .map(([, e]) => ({ ...e })),
    meinTurnierEintrag: async (id, { game, spieler }) => {
      const e = tEintraege.get(id + "/" + game + "_" + spieler);
      return e ? { ...e } : null;
    },
    turnierVersuch: async (id, { game, spieler, name, grenze = 0 }) => {
      const t = turniere.get(id);
      const k = id + "/" + game + "_" + spieler;
      const alt = tEintraege.get(k);
      const versuche = ((alt && alt.versuche) || 0) + 1;
      if (grenze > 0 && versuche > grenze) throw fehler("Alle Versuche sind gespielt.", "turnier/keine-versuche");
      if (!laeuft(t, game, 0) || (t.versuche && versuche > t.versuche)) throw fehler("abgewiesen", "permission-denied");
      tEintraege.set(k, { id: game + "_" + spieler, game, spieler, name, punkte: (alt && alt.punkte) || 0, versuche, offen: true, updatedAtMs: Date.now() });
      tSichern();
      return { versuche, punkte: (alt && alt.punkte) || 0 };
    },
    turnierErgebnis: async (id, { game, spieler, name, punkte, zaehlt = "bester" }) => {
      const t = turniere.get(id);
      const k = id + "/" + game + "_" + spieler;
      const alt = tEintraege.get(k);
      if (!alt || !alt.offen) throw fehler("kein angemeldeter Versuch", "turnier/kein-versuch");
      if (!laeuft(t, game, 600000)) throw fehler("zu spaet", "permission-denied");
      const summe = zaehlt === "summe";
      const neu = summe ? alt.punkte + punkte : Math.max(alt.punkte, punkte);
      tEintraege.set(k, { ...alt, name, punkte: neu, offen: false, updatedAtMs: Date.now() });
      tSichern();
      return { punkte: neu, runde: punkte, versuche: alt.versuche, rekord: !summe && alt.versuche > 1 && punkte > alt.punkte };
    },
    turnierUmbenennen: async (id, { spieler, name }) => {
      let geaendert = 0;
      for (const [k, e] of tEintraege) {
        if (!k.startsWith(id + "/") || e.spieler !== spieler || e.name === name) continue;
        tEintraege.set(k, { ...e, name });
        geaendert += 1;
      }
      tSichern();
      return { geaendert };
    },
  };

  // Die Turniere kommen aus der Pruefung (window.__miniTurniereAnfang) und
  // bleiben, wie die Eintraege, ueber ein Neuladen hinweg im Speicher.
  function fehler(text, code) { const f = new Error(text); f.code = code; return f; }
  function laeuft(t, game, nachspiel) {
    const jetzt = Date.now();
    return Boolean(t) && t.aktiv && t.spiele.includes(game) && jetzt >= t.startMs && jetzt <= t.endeMs + nachspiel;
  }
})();
`;

const browser = await playwright.chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
const fehlerAufSeite = [];

// Ohne Service Worker: Sobald einer die Seite bedient, beantwortet er die
// Abrufe selbst – und die Attrappe käme nicht mehr zum Zug. Dass er da ist und
// den richtigen Bereich bedient, prüft weiter unten ein eigenes Fenster.
async function neueSeite(viewport = { width: 420, height: 820 }) {
  const kontext = await browser.newContext({ viewport, serviceWorkers: "block" });
  const seite = await kontext.newPage();
  await seite.route("**/cloud.js*", (route) => route.fulfill({ contentType: "text/javascript; charset=utf-8", body: ATTRAPPE }));
  // Das SDK von gstatic braucht hier niemand: cloud.js ist ersetzt. So läuft
  // die Prüfung auch ohne Netz – und ohne dass ein Ladefehler von aussen als
  // Befund erscheint.
  await seite.route("https://www.gstatic.com/firebasejs/**", (route) => route.fulfill({ contentType: "text/javascript; charset=utf-8", body: "/* in der Prüfung nicht gebraucht */" }));
  seite.on("pageerror", (fehler) => fehlerAufSeite.push(String(fehler.message || fehler)));
  seite.on("console", (nachricht) => { if (nachricht.type() === "error") fehlerAufSeite.push(nachricht.text()); });
  return { kontext, seite };
}

// ---------------------------------------------------------------------------
// Turniere für die Prüfung
// ---------------------------------------------------------------------------
// Eines läuft, eines kommt bald, eines ist eben vorbei, eines lange; eines
// ist angehalten, drei gibt es nur mit Link. Die Startseite darf davon genau
// drei zeigen.
const MINUTE = 60 * 1000;
const STUNDE = 60 * MINUTE;
const TAG = 24 * STUNDE;
const JETZT = Date.now();
const turnierVorlage = (id, aenderung = {}) => ({
  id,
  name: id,
  beschreibung: "",
  spiele: ["towerStack", "fishPond", "numberLine"],
  startMs: JETZT - STUNDE,
  endeMs: JETZT + 2 * TAG,
  versuche: 2,
  zaehlt: "bester",
  wertung: "platz",
  aufgaben: "gleich",
  sichtbar: "alle",
  verdeckt: false,
  aktiv: true,
  erstelltMs: 1,
  updatedAtMs: 1,
  ...aenderung,
});
const HERBST = "herbstcup-test2345";
const TURNIERE = {
  turniere: [
    turnierVorlage(HERBST, { name: "Herbstcup", beschreibung: "Wer gewinnt, wählt das Znacht." }),
    turnierVorlage("familie-geheim2345", { name: "Familienabend", sichtbar: "link", spiele: ["numberLine", "tileMemory"], versuche: 0 }),
    turnierVorlage("bald-test23456789", { name: "Wintercup", startMs: JETZT + 3 * STUNDE }),
    turnierVorlage("vorbei-test2345678", { name: "Sommercup", startMs: JETZT - 3 * TAG, endeMs: JETZT - TAG }),
    turnierVorlage("alt-test234567890", { name: "Frühlingscup", startMs: JETZT - 20 * TAG, endeMs: JETZT - 10 * TAG }),
    turnierVorlage("pause-test2345678", { name: "Pausencup", aktiv: false }),
    turnierVorlage("verdeckt-test23456", { name: "Blindcup", sichtbar: "link", verdeckt: true }),
    turnierVorlage("zufall-test2345678", { name: "Würfelcup", sichtbar: "link", aufgaben: "zufall", spiele: ["numberLine"] }),
  ],
  // Im Herbstcup: Turmbau Grosi 30, Leo 25, Mia 20; Fischteich Leo 12, Mia 3;
  // im dritten Spiel noch niemand. Nach Platzziffer ist das Leo 2+1+1 = 4,
  // Grosi 1+3+1 = 5, Mia 3+2+1 = 6.
  eintraege: [
    { turnier: HERBST, game: "towerStack", spieler: "mini_vorherdagewesen", name: "Grosi", punkte: 30, versuche: 2, offen: false, updatedAtMs: 1000 },
    { turnier: HERBST, game: "towerStack", spieler: "mini_leoleoleoleo", name: "Leo", punkte: 25, versuche: 1, offen: false, updatedAtMs: 1100 },
    { turnier: HERBST, game: "towerStack", spieler: "mini_miamiamiamia", name: "Mia", punkte: 20, versuche: 1, offen: false, updatedAtMs: 1200 },
    { turnier: HERBST, game: "fishPond", spieler: "mini_leoleoleoleo", name: "Leo", punkte: 12, versuche: 1, offen: false, updatedAtMs: 1300 },
    { turnier: HERBST, game: "fishPond", spieler: "mini_miamiamiamia", name: "Mia", punkte: 3, versuche: 2, offen: false, updatedAtMs: 1400 },
    { turnier: "verdeckt-test23456", game: "towerStack", spieler: "mini_leoleoleoleo", name: "Leo", punkte: 25, versuche: 1, offen: false, updatedAtMs: 1100 },
  ],
};

// Eine Seite, auf der es die Turniere von oben gibt.
async function mitTurnieren(adresse, { viewport, vorher } = {}) {
  const { kontext, seite } = await neueSeite(viewport);
  await seite.addInitScript((daten) => { window.__miniTurniereAnfang = daten; }, TURNIERE);
  if (vorher) await seite.addInitScript(vorher);
  await seite.goto(`${BASIS}${adresse}`, { waitUntil: "load" });
  return { kontext, seite };
}

// Die Tafel vor dem Spiel verlassen – mit Namen, wenn sie danach fragt.
async function turnierLos(seite, name) {
  await seite.waitForSelector(".tn-tor .tn-los", { timeout: 8000 });
  const feld = seite.locator(".tn-tor .mini-namensfeld input");
  if (await feld.count()) await feld.fill(name);
  await seite.click(".tn-tor .tn-los");
  await seite.waitForFunction(() => !document.querySelector(".tn-tor"), null, { timeout: 4000 });
}

// Klassen, die auf der Seite stehen und im Stylesheet keine Regel haben.
async function klassenOhneRegel(seite) {
  const klassen = await seite.evaluate(() => {
    const raus = new Set();
    for (const knoten of document.querySelectorAll("*")) {
      const roh = knoten.getAttribute("class");
      if (!roh) continue;
      for (const k of String(roh).split(/\s+/)) if (k) raus.add(k);
    }
    return [...raus];
  });
  return klassen.filter((k) => brauchtRegel(k) && !hatRegel(k));
}

// Turmbau zu Ende spielen, bis die Zahl der Runde dasteht. Anders als unten
// wird nicht auf irgendeine Tafel gewartet: Im Turnier steht vor dem Spiel
// schon eine.
async function spieleZuEnde(seite) {
  const { breit, hoch } = await seite.evaluate(() => ({ breit: window.innerWidth, hoch: window.innerHeight }));
  for (let tipp = 0; tipp < 150; tipp += 1) {
    if (await seite.locator(".cm-result-score").count()) return true;
    await seite.mouse.click(Math.round(breit / 2), Math.round(hoch * 0.75));
    await seite.waitForTimeout(120);
  }
  return Boolean(await seite.locator(".cm-result-score").count());
}

// Turmbau zu Ende spielen: tippen, bis die Tafel steht. Irgendwann trifft ein
// Block daneben – das ist das Ende der Runde.
async function spieleTurmbauZuEnde(seite) {
  // Getippt wird in die Mitte der Bühne, nicht auf einen festen Punkt: Auf
  // einem flachen Fenster läge der ausserhalb, und die Runde käme nie zu
  // einem Ende.
  const { breit, hoch } = await seite.evaluate(() => ({ breit: window.innerWidth, hoch: window.innerHeight }));
  const x = Math.round(breit / 2);
  const y = Math.round(hoch * 0.75);
  for (let tipp = 0; tipp < 120; tipp += 1) {
    if (await seite.locator(".cm-panel").count()) return true;
    await seite.mouse.click(x, y);
    await seite.waitForTimeout(120);
  }
  return Boolean(await seite.locator(".cm-panel").count());
}

try {
  // --- 1. Jedes Spiel baut seine Bühne auf ------------------------------------
  // Der eigentliche Grund für dieses Skript: Wenn beim Herausschneiden von
  // styles.css oder train-art.js etwas zu viel weggefallen ist, merkt man es
  // hier – und nur hier.
  for (const spiel of SPIELE) {
    const { kontext, seite } = await neueSeite({ width: 900, height: 520 });
    const vorher = fehlerAufSeite.length;
    await seite.goto(`${BASIS}/${spiel.seite}`, { waitUntil: "load" });
    await seite.waitForSelector(".cm-bar", { timeout: 8000 });
    await seite.waitForTimeout(400);

    // Gemessen statt angesehen. Eine Seite ohne Stylesheet ist nicht leer –
    // sie ist zu gross: Die Bühne wird zwanzigtausend Pixel hoch, und alles
    // steht untereinander. Geprüft wird deshalb, dass alles ins Bild passt,
    // nicht bloss, dass es da ist.
    const stand = await seite.evaluate((id) => {
      const kasten = (e) => (e ? e.getBoundingClientRect() : null);
      const buehne = kasten(document.getElementById(id));
      const play = kasten(document.querySelector(".cm-play"));
      const bar = kasten(document.querySelector(".cm-bar"));
      const scene = kasten(document.querySelector(".scene"));
      const sprecher = kasten(document.querySelector(".help-voice-button"));
      return {
        hoch: window.innerHeight,
        breit: window.innerWidth,
        blattHoch: document.documentElement.scrollHeight,
        blattBreit: document.documentElement.scrollWidth,
        buehne: buehne && { b: Math.round(buehne.width), h: Math.round(buehne.height) },
        play: play && { b: Math.round(play.width), h: Math.round(play.height) },
        barHoch: bar ? Math.round(bar.height) : null,
        scene: scene && { b: Math.round(scene.width), h: Math.round(scene.height) },
        inhalt: document.querySelector(".cm-play")?.querySelectorAll("*").length ?? 0,
        sprecher: sprecher ? Math.round(sprecher.width) : 0,
        titel: document.querySelector(".cm-title")?.textContent || "",
        knoepfe: [...document.querySelectorAll(".cm-bar-left > *")].map((e) => (e.textContent || "").trim() || e.className),
        pfeil: Boolean(document.querySelector(".cm-bar-left .mini-pfeil")),
        kidsLink: Boolean(document.querySelector('a[href*="kids.alae.app"]')),
      };
    }, spiel.buehne.id);

    const passt = (was, wert) => wert !== null && wert <= stand.hoch + 2;
    pruefe(Boolean(stand.buehne) && stand.buehne.h > 200, `${spiel.seite}: Die Bühne #${spiel.buehne.id} ist ${stand.buehne?.h} px hoch – da steht nichts.`);
    pruefe(passt("Bühne", stand.buehne?.h), `${spiel.seite}: Die Bühne ist ${stand.buehne?.h} px hoch, das Fenster nur ${stand.hoch} – das Stylesheet greift nicht.`);
    pruefe(passt("Spielfläche", stand.play?.h) && stand.play?.h > 100, `${spiel.seite}: Die Spielfläche ist ${stand.play?.h} px hoch (Fenster: ${stand.hoch}).`);
    pruefe(stand.barHoch !== null && stand.barHoch <= 120, `${spiel.seite}: Die Leiste oben ist ${stand.barHoch} px hoch – sie steht untereinander statt nebeneinander.`);
    pruefe(stand.blattHoch <= stand.hoch + 2, `${spiel.seite}: Die Seite lässt sich scrollen (${stand.blattHoch} px statt ${stand.hoch}) – ein Spiel füllt das Bild und hört dort auf.`);
    pruefe(stand.blattBreit <= stand.breit + 1, `${spiel.seite}: Die Seite steht ${stand.blattBreit - stand.breit} px über den rechten Rand.`);
    pruefe(stand.inhalt > 0, `${spiel.seite}: In der Spielfläche steht nichts (${stand.inhalt} Elemente).`);
    // Die Landschaft deckt die Bühne: Ohne .scene bliebe der Himmel 0 px hoch,
    // und hinter dem Spiel stünde nichts als Weiss.
    pruefe(Boolean(stand.scene) && Math.abs(stand.scene.h - (stand.buehne?.h || 0)) <= 4,
      `${spiel.seite}: Die Landschaft ist ${stand.scene?.h} px hoch, die Bühne ${stand.buehne?.h}.`);
    pruefe(stand.sprecher > 20 && stand.sprecher < 120, `${spiel.seite}: Der Hilfe-Lautsprecher ist ${stand.sprecher} px breit.`);
    pruefe(stand.titel.trim() === spiel.titel, `${spiel.seite}: Oben steht "${stand.titel}" statt "${spiel.titel}".`);
    // Oben links steht nur noch, was gebraucht wird: der Weg zurück und der
    // Neustart. Kein "Zur App" (diese Site verweist nicht auf die Kids-App)
    // und kein Fenster zum Spielewechseln.
    pruefe(stand.knoepfe.length === 2, `${spiel.seite}: Oben links stehen ${stand.knoepfe.length} Knöpfe statt zwei (${stand.knoepfe.join(", ")}).`);
    pruefe(stand.knoepfe.some((k) => k.includes("Hall of Fame")), `${spiel.seite}: Oben links fehlt der Weg zur Hall of Fame.`);
    for (const weg of ["Zur App", "Mini Games"]) {
      pruefe(!stand.knoepfe.some((k) => k.includes(weg)), `${spiel.seite}: Oben links steht noch "${weg}".`);
    }
    pruefe(stand.pfeil, `${spiel.seite}: Im Knopf zur Hall of Fame fehlt der Pfeil, der das Zurückgehen anzeigt.`);
    pruefe(!stand.kidsLink, `${spiel.seite}: Auf der Seite steht ein Link auf kids.alae.app.`);
    pruefe(fehlerAufSeite.length === vorher, `${spiel.seite}: Der Browser hat sich beschwert – ${fehlerAufSeite.slice(vorher).join(" / ")}`);

    // Jede Klasse, die auf dieser Seite wirklich steht, braucht eine Regel.
    // Erst eine Runde spielen: Die Hälfte der Klassen entsteht überhaupt
    // erst, wenn das Spiel läuft.
    const start = seite.locator(".cm-start");
    if (await start.count()) { await start.click(); await seite.waitForTimeout(600); }
    else { await seite.mouse.click(450, 300); await seite.waitForTimeout(600); }
    const klassen = await seite.evaluate(() => {
      const raus = new Set();
      for (const knoten of document.querySelectorAll("*")) {
        const roh = knoten.getAttribute("class");
        if (!roh) continue;
        for (const k of String(roh).split(/\s+/)) if (k) raus.add(k);
      }
      return [...raus];
    });
    const ohneRegel = klassen.filter((k) => brauchtRegel(k) && !hatRegel(k));
    pruefe(ohneRegel.length === 0, `${spiel.seite}: Klassen ohne Regel im Stylesheet – ${ohneRegel.join(", ")}`);
    await kontext.close();
  }

  // --- 2. Eine Runde, ein Name, eine Liste ------------------------------------
  {
    const { kontext, seite } = await neueSeite();
    await seite.goto(`${BASIS}/turmbau`, { waitUntil: "load" });
    await seite.waitForSelector(".cm-bar", { timeout: 8000 });

    const halle = await seite.getAttribute('.cm-bar-left a:has-text("Hall of Fame")', "href");
    pruefe(halle === "/", `"Hall of Fame" zeigt auf ${halle} statt auf die Startseite.`);
    pruefe(await seite.locator(".cm-icon-home").count() === 0, "Ein Haus führte auf ein Startbild, das es hier nicht gibt.");
    pruefe(await seite.locator(".cm-icon-again").count() === 1, "Der Knopf zum Neustarten fehlt.");
    pruefe(await seite.getAttribute("body", "data-spiel") === "towerStack", "Am body fehlt data-spiel.");
    pruefe(await seite.locator(".mini-fenster").count() === 0, "Das Fenster «Mini Games» ist noch da.");

    // Eine Runde, und danach der Name.
    pruefe(await spieleTurmbauZuEnde(seite), "Die Runde kam nicht zu einem Ergebnis.");
    await seite.waitForSelector(".mini-ergebnis", { timeout: 4000 });
    pruefe(await seite.locator(".cm-scores").count() === 0, "Unter dem Ergebnis steht eine eigene Fünferliste – gemeint ist die Liste aller.");
    pruefe(await seite.locator(".cm-runs").count() === 0, "Unter dem Ergebnis steht der Satz über den Wagen – hier gibt es keinen Wagen.");
    pruefe(await seite.locator(".mini-namensfeld input").count() === 1, "Ohne Namen fehlt das Namensfeld.");
    pruefe(await seite.locator(".cm-icon-cup").count() === 1, "Unter dem Ergebnis fehlt der Weg zur Hall of Fame.");
    pruefe(await seite.getAttribute(".cm-icon-cup", "href") === "/",
      `Unter dem Ergebnis führt der Pokal auf ${await seite.getAttribute(".cm-icon-cup", "href")} statt in die Hall of Fame.`);

    await seite.fill(".mini-namensfeld input", "Testkind");
    await seite.click(".mini-namensfeld button");
    await seite.waitForSelector(".mini-ergebnis .mini-zeile", { timeout: 5000 });
    const liste = await seite.locator(".mini-ergebnis").innerText();
    pruefe(liste.includes("Testkind"), `Der eingetragene Name steht nicht in der Liste: ${liste.replace(/\n/g, " | ")}`);
    pruefe(liste.includes("Grosi"), "In der Liste fehlen die anderen Spieler.");
    pruefe(await seite.locator(".mini-zeile.ist-ich").count() === 1, "Die eigene Zeile ist nicht hervorgehoben.");

    const speicher = await seite.evaluate(() => ({
      name: localStorage.getItem("mini.name"),
      id: localStorage.getItem("mini.id"),
      best: localStorage.getItem("mini.best"),
      alles: Object.keys(localStorage),
    }));
    pruefe(speicher.name === "Testkind", `Der Name wurde nicht auf dem Gerät gemerkt (steht: ${speicher.name}).`);
    pruefe(/^mini_[A-Za-z0-9_-]{8,48}$/.test(speicher.id || ""), `Die Kennung des Geräts sieht falsch aus: ${speicher.id}`);
    pruefe(/"towerStack":\s*\d+/.test(speicher.best || ""), `Der eigene Bestwert wurde nicht gemerkt (steht: ${speicher.best}).`);
    // Kein Spielstand: Eine Runde hier gehört in die Bestenliste, sonst
    // nirgends hin.
    const fremd = speicher.alles.filter((k) => k.startsWith("lernapp."));
    pruefe(fremd.length === 0, `Auf dem Gerät liegen Schlüssel der App: ${fremd.join(", ")}`);

    // Beim zweiten Mal steht der Name schon da.
    await seite.reload({ waitUntil: "load" });
    await seite.waitForSelector(".cm-bar", { timeout: 8000 });
    pruefe(await spieleTurmbauZuEnde(seite), "Die zweite Runde kam nicht zu einem Ergebnis.");
    await seite.waitForSelector(".mini-ergebnis .mini-zeile", { timeout: 6000 });
    pruefe(await seite.locator(".mini-namensfeld").count() === 0, "Beim zweiten Mal steht das Namensfeld wieder da.");
    const versuche = await seite.evaluate(() => [...window.__miniEintraege.values()].filter((e) => e.game === "towerStack" && e.name === "Testkind")[0]?.versuche);
    pruefe(versuche === 2, `Nach zwei Runden stehen ${versuche} Versuche in der Liste.`);

    // Dieses Gerät steht auch in einem zweiten Spiel – so wie jeder, der mehr
    // als eines gespielt hat.
    await seite.evaluate(() => {
      const ich = localStorage.getItem("mini.id");
      const id = `fishPond_${ich}`;
      window.__miniEintraege.set(id, { id, game: "fishPond", spieler: ich, name: "Testkind", punkte: 7, versuche: 1, updatedAtMs: Date.now() });
    });

    // Umbenennen ist keine Runde – und es gilt in allen Spielen. Bliebe in
    // einem der alte Name stehen, stünde derselbe Mensch zweimal in der Hall
    // of Fame: Die Liste fasst nach Namen zusammen.
    await seite.click(".mini-name-steht button");
    await seite.waitForSelector(".mini-namensfeld input", { timeout: 4000 });
    await seite.fill(".mini-namensfeld input", "Testkind Zwei");
    await seite.click(".mini-namensfeld button");
    await seite.waitForFunction(() => [...window.__miniEintraege.values()]
      .some((e) => e.game === "towerStack" && e.name === "Testkind Zwei"), null, { timeout: 6000 });
    const nach = await seite.evaluate(() => {
      const ich = localStorage.getItem("mini.id");
      const meine = [...window.__miniEintraege.values()].filter((e) => e.spieler === ich);
      return { meine, womit: window.__miniUmbenannt };
    });
    const turm = nach.meine.find((e) => e.game === "towerStack");
    const teich = nach.meine.find((e) => e.game === "fishPond");
    pruefe(turm?.versuche === 2, `Das Umbenennen hat eine Runde erfunden: ${turm?.versuche} statt 2.`);
    pruefe(turm?.name === "Testkind Zwei", `Der neue Name kam nicht an: ${turm?.name}`);
    pruefe(teich?.name === "Testkind Zwei",
      `Im zweiten Spiel steht noch der alte Name (${teich?.name}) – in der Hall of Fame wäre das ein zweiter Spieler.`);
    pruefe(teich?.versuche === 1, `Das Umbenennen hat im zweiten Spiel eine Runde erfunden: ${teich?.versuche} statt 1.`);
    pruefe(nach.womit && !("game" in nach.womit),
      `Umbenannt wurde für ein einzelnes Spiel (${JSON.stringify(nach.womit)}) statt für das ganze Gerät.`);
    await kontext.close();
  }

  // --- 3. Die Startseite -------------------------------------------------------
  {
    const { kontext, seite } = await neueSeite();
    await seite.goto(`${BASIS}/`, { waitUntil: "load" });
    await seite.waitForSelector(".mini-karte", { timeout: 8000 });
    const text = await seite.locator(".mini-seite").innerText();
    pruefe(/mini-games/i.test(text), "Auf der Startseite steht nicht, wo man ist.");
    pruefe(await seite.locator(".mini-karte").count() === SPIELE.length,
      `Auf der Startseite stehen ${await seite.locator(".mini-karte").count()} Spiele statt ${SPIELE.length}.`);
    pruefe(text.includes("Grosi"), "Auf der Startseite fehlen die Spieler.");
    pruefe(await seite.locator(".mini-tabelle tbody tr").count() >= 1, "Die Auswertung der Spieler fehlt.");
    const kopfzeilen = await seite.locator(".mini-tabelle th").allInnerTexts();
    pruefe(kopfzeilen.some((z) => /rang/i.test(z)), `In der Auswertung fehlt der Durchschnittsrang (Spalten: ${kopfzeilen.join(", ")}).`);
    // Wie oft jemand gespielt hat, geht niemanden etwas an: Es steht weder in
    // der Auswertung noch in einer Ranglistenzeile. Die Zahl oben zählt alle
    // Runden zusammen – die verrät nicht, wer.
    pruefe(!kopfzeilen.some((z) => /runde/i.test(z)), `In der Auswertung stehen die Runden je Spieler (Spalten: ${kopfzeilen.join(", ")}).`);
    const zeilen = await seite.locator(".mini-karte .mini-zeile").allInnerTexts();
    const mitRunden = zeilen.filter((z) => /runde/i.test(z));
    pruefe(mitRunden.length === 0, `In der Rangliste eines Spiels stehen die Runden: ${mitRunden.join(" | ")}`);
    const gefragt = await seite.evaluate(() => window.__miniGefragt || []);
    pruefe(gefragt.length === SPIELE.length, `Die Startseite fragt nach ${gefragt.length} Spielen statt nach ${SPIELE.length}.`);
    pruefe(await seite.locator('a[href*="kids.alae.app"]').count() === 0, "Auf der Startseite steht ein Link auf kids.alae.app.");
    const spielen = await seite.getAttribute(".mini-karte-aktionen a", "href");
    pruefe(SPIELE.some((s) => spielen === `/${s.seite}`), `Ein Spiel-Link zeigt auf ${spielen}.`);
    const ueberstand = await seite.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    pruefe(ueberstand <= 1, `Die Startseite steht ${ueberstand} px über den rechten Rand.`);
    await kontext.close();
  }

  // --- 3b. Abgewählte Spiele stehen nicht da -----------------------------------
  // Der Adminbereich schreibt eine Liste, die Startseite liest sie. Dass die
  // Liste ankommt, sieht man nur hier: Eine Karte zu viel wäre ein Spiel, das
  // abgewählt wurde und trotzdem gespielt wird.
  {
    const offen = ["towerStack", "fishPond"];
    const { kontext, seite } = await neueSeite();
    await seite.addInitScript((liste) => { window.__miniOffen = liste; }, offen);
    await seite.goto(`${BASIS}/`, { waitUntil: "load" });
    await seite.waitForSelector(".mini-karte", { timeout: 8000 });
    const karten = await seite.locator(".mini-karte h3").allInnerTexts();
    pruefe(karten.length === offen.length,
      `Freigegeben sind ${offen.length} Spiele, auf der Startseite stehen ${karten.length}.`);
    for (const id of offen) {
      const titel = SPIELE.find((s) => s.spiel === id)?.titel;
      pruefe(karten.includes(titel), `Das freigegebene Spiel "${titel}" fehlt auf der Startseite.`);
    }
    // Und es wird auch nicht nach den anderen gefragt: Wer abgewählt ist, ist
    // nicht bloss unsichtbar, er kostet auch keine Abfrage.
    const gefragt = await seite.evaluate(() => window.__miniGefragt || []);
    pruefe(gefragt.length === offen.length && offen.every((id) => gefragt.includes(id)),
      `Gefragt wurde nach ${gefragt.join(", ") || "nichts"} statt nach ${offen.join(", ")}.`);
    const zahl = (await seite.locator(".mini-streifen").innerText()).replace(/\n/g, " ");
    pruefe(/\b2\b\s*Spiele/.test(zahl), `Oben steht nicht "2 Spiele", sondern: ${zahl}`);
    await kontext.close();
  }

  // --- 3c. Ist keines freigegeben, steht das da --------------------------------
  // Eine leere Startseite sähe nach einem Fehler aus. Sie ist aber ein
  // Zustand, den der Adminbereich herstellen kann – also muss sie etwas sagen.
  {
    const { kontext, seite } = await neueSeite();
    await seite.addInitScript(() => { window.__miniOffen = []; });
    await seite.goto(`${BASIS}/`, { waitUntil: "load" });
    await seite.waitForSelector(".mini-seite", { timeout: 8000 });
    await seite.waitForTimeout(400);
    const text = await seite.locator(".mini-seite").innerText();
    pruefe(await seite.locator(".mini-karte").count() === 0,
      "Es ist kein Spiel freigegeben, trotzdem steht eine Karte da.");
    pruefe(/kein Spiel freigegeben/i.test(text),
      `Ohne freigegebenes Spiel steht kein Hinweis da, sondern: ${text.replace(/\n/g, " | ")}`);
    await kontext.close();
  }

  // --- 3d. Ohne Netz gilt die Wahl von gestern ---------------------------------
  // Die installierte App startet auch ohne Netz, und Firestore hält hier
  // nichts vor. Würde ein Lesefehler wie "nichts eingetragen" behandelt,
  // stünden beim ersten Start ohne Netz wieder alle Spiele da – auch
  // die abgewählten. Geprüft wird deshalb in EINEM Fenster: erst einmal mit
  // Netz laden, dann das Netz wegnehmen und neu laden.
  {
    const offen = ["towerStack", "fishPond"];
    const { kontext, seite } = await neueSeite();
    await seite.addInitScript((liste) => { window.__miniOffen = liste; }, offen);
    await seite.goto(`${BASIS}/`, { waitUntil: "load" });
    await seite.waitForSelector(".mini-karte", { timeout: 8000 });
    pruefe(await seite.locator(".mini-karte").count() === offen.length,
      "Schon mit Netz stimmt die Zahl der Karten nicht – der Rest der Prüfung sagt dann nichts.");

    // Kein Netz mehr, und auch die Antwort von vorhin ist weg: Was die Seite
    // jetzt zeigt, kann nur aus dem Gerät kommen.
    await seite.addInitScript(() => { window.__miniOhneNetz = true; delete window.__miniOffen; });
    await seite.reload({ waitUntil: "load" });
    await seite.waitForSelector(".mini-seite", { timeout: 8000 });
    await seite.waitForTimeout(500);
    const karten = await seite.locator(".mini-karte h3").allInnerTexts();
    pruefe(karten.length === offen.length,
      `Ohne Netz stehen ${karten.length} Spiele da statt der ${offen.length} freigegebenen: ${karten.join(", ")}`);
    await kontext.close();
  }

  // --- 3e. Wer noch nie gelesen hat, sieht alle --------------------------------
  // Die andere Seite davon: Ein Gerät ohne Gedächtnis darf nicht auf einer
  // leeren Seite landen. Ohne gemerkte Wahl gelten alle – wie bei einer
  // frischen Datenbank.
  {
    const { kontext, seite } = await neueSeite();
    await seite.addInitScript(() => { window.__miniOhneNetz = true; });
    await seite.goto(`${BASIS}/`, { waitUntil: "load" });
    await seite.waitForSelector(".mini-karte", { timeout: 8000 });
    pruefe(await seite.locator(".mini-karte").count() === SPIELE.length,
      `Ohne Netz und ohne gemerkte Wahl stehen ${await seite.locator(".mini-karte").count()} Spiele da statt ${SPIELE.length}.`);
    await kontext.close();
  }

  // --- 3f. Jedes Spiel steht auch hochkant ------------------------------------
  // Querformat ist keine Pflicht mehr: Es gibt keinen Dreh-Hinweis, der ein
  // hochkant gehaltenes Handy zudeckt, also muss jedes Spiel dort wirklich
  // dastehen. Geprüft wird, was man einer Seite nicht ansieht: dass nichts
  // scrollt, dass die Bühne das Bild füllt, und dass der Browser schweigt.
  for (const spiel of SPIELE) {
    const { kontext, seite } = await neueSeite({ width: 390, height: 844 });
    const vorher = fehlerAufSeite.length;
    await seite.goto(`${BASIS}/${spiel.seite}`, { waitUntil: "load" });
    await seite.waitForSelector(".cm-bar", { timeout: 8000 });
    await seite.waitForTimeout(400);
    const stand = await seite.evaluate((id) => {
      const kasten = (e) => (e ? e.getBoundingClientRect() : null);
      const buehne = kasten(document.getElementById(id));
      const play = kasten(document.querySelector(".cm-play"));
      return {
        hoch: window.innerHeight,
        breit: window.innerWidth,
        blattHoch: document.documentElement.scrollHeight,
        blattBreit: document.documentElement.scrollWidth,
        buehne: buehne && { b: Math.round(buehne.width), h: Math.round(buehne.height) },
        play: play && { b: Math.round(play.width), h: Math.round(play.height) },
        inhalt: document.querySelector(".cm-play")?.querySelectorAll("*").length ?? 0,
      };
    }, spiel.buehne.id);
    pruefe(stand.blattBreit <= stand.breit + 1, `${spiel.titel} hochkant: die Seite ist ${stand.blattBreit - stand.breit} px zu breit.`);
    pruefe(stand.blattHoch <= stand.hoch + 1, `${spiel.titel} hochkant: die Seite ist ${stand.blattHoch - stand.hoch} px zu hoch.`);
    pruefe(stand.buehne && stand.buehne.h >= stand.hoch - 2, `${spiel.titel} hochkant: die Bühne ist ${stand.buehne?.h} statt ${stand.hoch} px hoch.`);
    // Die Spielfläche muss den Platz auch bekommen, den es gibt: Bliebe sie
    // so flach wie im Querformat, stünde das Spiel oben in einem Streifen.
    pruefe(stand.play && stand.play.h > stand.hoch * 0.8, `${spiel.titel} hochkant: die Spielfläche ist nur ${stand.play?.h} von ${stand.hoch} px hoch.`);
    pruefe(stand.inhalt > 0, `${spiel.titel} hochkant: auf der Spielfläche steht nichts.`);
    pruefe(fehlerAufSeite.length === vorher, `${spiel.titel} hochkant hat sich beschwert – ${fehlerAufSeite.slice(vorher).join(" / ")}`);
    await kontext.close();
  }

  // --- 3g. Turmbau ist in jeder Lage gleich schwer ----------------------------
  // Der Block ist immer gleich breit – nicht in Pixeln, sondern im Verhältnis
  // zur Spielfläche. Genau daran hängt die Schwierigkeit: Ein Block, der
  // hochkant die halbe Breite füllt und quer ein Drittel, wäre zwei Spiele.
  // turmbau.js rechnet das über welt.mass und view.s so, dass sich beide
  // wegkürzen; dass sie das wirklich tun, sieht man nur hier.
  {
    const lagen = [
      ["quer", { width: 844, height: 390 }],
      ["hoch", { width: 390, height: 844 }],
      ["quer schmal", { width: 568, height: 320 }],
      ["breit", { width: 1280, height: 800 }],
    ];
    const gemessen = [];
    for (const [name, viewport] of lagen) {
      const { kontext, seite } = await neueSeite(viewport);
      await seite.goto(`${BASIS}/turmbau`, { waitUntil: "load" });
      await seite.waitForSelector(".cm-bar", { timeout: 8000 });
      await seite.waitForTimeout(500);
      const anteile = await seite.evaluate(() => {
        const a = window.LernappTurmbau;
        if (!a) return null;
        const { welt, view, state } = a;
        return {
          block: (welt.startW * view.s) / view.cssW,
          sockel: (welt.sockelW * view.s) / view.cssW,
          schwung: state.schweber ? (state.schweber.weite * view.s) / view.cssW : null,
        };
      });
      pruefe(anteile !== null, `Turmbau ${name}: keine Messwerte – window.LernappTurmbau fehlt.`);
      if (anteile) gemessen.push([name, anteile]);
      await kontext.close();
    }
    if (gemessen.length === lagen.length) {
      const [, erste] = gemessen[0];
      for (const schluessel of ["block", "sockel", "schwung"]) {
        if (erste[schluessel] === null) continue;
        for (const [name, anteile] of gemessen.slice(1)) {
          const ab = Math.abs(anteile[schluessel] - erste[schluessel]);
          pruefe(ab < 0.005,
            `Turmbau ${name}: ${schluessel} füllt ${(anteile[schluessel] * 100).toFixed(1)} % der Breite statt ${(erste[schluessel] * 100).toFixed(1)} % wie quer.`);
        }
      }
    }
  }

  // --- 3h. Die Punkte von "Wo hält der Zug?" ----------------------------------
  // Die Bänder wachsen um je eins: 10 für den Treffer, 9 für eins und zwei
  // daneben, 8 für drei bis fünf, 7 für sechs bis neun. Das ist die Regel des
  // Spiels und keine Rundungssache – hier steht sie als Tabelle, damit eine
  // Änderung an der Formel auffällt.
  {
    const { kontext, seite } = await neueSeite({ width: 900, height: 520 });
    await seite.goto(`${BASIS}/zahlengleis`, { waitUntil: "load" });
    await seite.waitForSelector(".zg-gleis", { timeout: 8000 });
    const api = await seite.evaluate(() => {
      const a = window.LernappZahlengleis;
      if (!a) return null;
      // Auf dem Gleis bis 100 ist der Weg daneben die Zahl selbst.
      const bei100 = {};
      for (const d of [0, 0.4, 0.6, 1, 2, 3, 5, 6, 9, 10, 14, 20, 27, 35, 44, 54, 55, 99]) {
        bei100[d] = a.punkteFuer(d, 100);
      }
      // Dieselben Anteile auf dem langen Gleis: 10 von 1000 ist derselbe Weg
      // wie 1 von 100 – ein Finger ist überall gleich breit.
      const gleich = [10, 100, 500, 1000].map((bis) => a.punkteFuer(bis * 0.02, bis));
      const alle = new Set();
      for (let i = 0; i <= 1000; i += 1) alle.add(a.punkteFuer(i / 10, 100));
      return { bei100, gleich, alle: [...alle].sort((x, y) => x - y), max: a.PUNKTE_JE_ZAHL };
    });
    pruefe(api !== null, "Wo hält der Zug? gibt keine Messwerte her – window.LernappZahlengleis fehlt.");
    if (api) {
      const soll = { 0: 10, 0.4: 10, 0.6: 9, 1: 9, 2: 9, 3: 8, 5: 8, 6: 7, 9: 7, 10: 6, 14: 6, 20: 5, 27: 4, 35: 3, 44: 2, 54: 1, 55: 0, 99: 0 };
      for (const [weg, punkte] of Object.entries(soll)) {
        pruefe(api.bei100[weg] === punkte, `Wo hält der Zug?: ${weg} daneben gibt ${api.bei100[weg]} statt ${punkte} Punkte.`);
      }
      pruefe(api.max === 10, `Wo hält der Zug? gibt höchstens ${api.max} Punkte statt 10.`);
      // Alle elf Zahlen müssen vorkommen: Ein Band, das nie getroffen wird,
      // ist eine Stufe, die es nicht gibt.
      pruefe(api.alle.length === 11 && api.alle[0] === 0 && api.alle[10] === 10,
        `Wo hält der Zug?: erreichbar sind ${api.alle.join(", ")} – erwartet 0 bis 10.`);
      pruefe(new Set(api.gleich).size === 1,
        `Wo hält der Zug?: zwei Prozent daneben geben je nach Gleis ${api.gleich.join(", ")} Punkte – es muss überall dieselbe Zahl sein.`);
    }
    await kontext.close();
  }

  // --- 3i. "Was fehlt?" auf dem schwersten Wagen ------------------------------
  // Zehn Stücke Fracht und vier Knöpfe: der Fall, den die Anfangsseite nicht
  // zeigt. Beide Grössen hingen einmal nur an der Höhe – hochkant wurden die
  // Stücke vom Flexkasten zu Streifen gequetscht und die äusseren Knöpfe lagen
  // ausserhalb des Bildes. Gemessen wird deshalb der schwerste Wagen, nicht
  // der erste.
  for (const [name, viewport] of [
    ["hochkant", { width: 390, height: 844 }],
    ["hochkant schmal", { width: 360, height: 640 }],
    ["quer", { width: 844, height: 390 }],
    ["quer schmal", { width: 568, height: 320 }],
  ]) {
    const { kontext, seite } = await neueSeite(viewport);
    await seite.goto(`${BASIS}/wasfehlt`, { waitUntil: "load" });
    await seite.waitForSelector(".wf-ladung", { timeout: 8000 });
    const befund = await seite.evaluate(() => {
      // Den schwersten Wagen herstellen, statt ihn zu erspielen: Gemessen wird
      // das Stylesheet, nicht der Ablauf.
      const ladung = document.querySelector(".wf-ladung");
      ladung.style.setProperty("--wf-stuecke", "10");
      while (ladung.children.length < 10) ladung.append(ladung.firstElementChild.cloneNode(true));
      let wahl = document.querySelector(".wf-wahl");
      if (!wahl) {
        wahl = document.createElement("div");
        wahl.className = "wf-wahl";
        document.querySelector(".cm-play").append(wahl);
      }
      while (wahl.children.length < 4) {
        const knopf = document.createElement("button");
        knopf.className = "wf-knopf";
        wahl.append(knopf);
      }
      const kasten = (e) => e.getBoundingClientRect();
      const stuecke = [...document.querySelectorAll(".wf-stueck")].map(kasten);
      const knoepfe = [...document.querySelectorAll(".wf-knopf")].map(kasten);
      const wagen = kasten(document.querySelector(".wf-wagen"));
      const drin = (r) => r.left >= -1 && r.right <= window.innerWidth + 1;
      return {
        form: stuecke.length ? stuecke[0].width / Math.max(1, stuecke[0].height) : 0,
        kleinstes: Math.round(Math.min(...stuecke.map((r) => r.width))),
        wagenDrin: drin(wagen),
        knoepfeDrin: knoepfe.every(drin),
        knopfBreit: knoepfe.length ? Math.round(knoepfe[0].width) : 0,
        ueberstand: document.documentElement.scrollWidth - window.innerWidth,
      };
    });
    pruefe(Math.abs(befund.form - 1) < 0.06, `Was fehlt? ${name}: die Fracht ist ${befund.form.toFixed(2)} mal so breit wie hoch – Streifen statt Kistchen.`);
    pruefe(befund.kleinstes >= 24, `Was fehlt? ${name}: ein Stück Fracht ist nur ${befund.kleinstes} px breit.`);
    pruefe(befund.wagenDrin, `Was fehlt? ${name}: der Wagen steht über den Rand.`);
    pruefe(befund.knoepfeDrin, `Was fehlt? ${name}: nicht alle vier Knöpfe stehen im Bild (je ${befund.knopfBreit} px).`);
    pruefe(befund.ueberstand <= 1, `Was fehlt? ${name}: die Seite ist ${befund.ueberstand} px zu breit.`);
    await kontext.close();
  }

  // --- 3j. Die Ergebnistafel auf einem flachen Bildschirm ---------------------
  // Dort liegt sie quer: links Punkte und Knöpfe, rechts die Bestenliste.
  // Untereinander bräuchte sie mehr Höhe, als da ist. Die Regeln dafür standen
  // einmal hinter einem Spiel, das ausgezogen ist – und wären dabei um ein
  // Haar mitgegangen.
  {
    const { kontext, seite } = await neueSeite({ width: 568, height: 320 });
    await seite.goto(`${BASIS}/turmbau`, { waitUntil: "load" });
    await seite.waitForSelector(".cm-bar", { timeout: 8000 });
    pruefe(await spieleTurmbauZuEnde(seite), "Die Runde für die Ergebnistafel kam zu keinem Ergebnis.");
    await seite.waitForTimeout(500);
    const tafel = await seite.evaluate(() => {
      const panel = document.querySelector(".cm-panel");
      if (!panel) return null;
      const aktionen = document.querySelector(".cm-actions");
      const r = aktionen ? aktionen.getBoundingClientRect() : null;
      return {
        anzeige: getComputedStyle(panel).display,
        knoepfeDrin: r ? r.bottom <= window.innerHeight + 1 && r.top >= 0 : false,
      };
    });
    pruefe(tafel !== null, "Auf dem flachen Bildschirm steht keine Ergebnistafel.");
    if (tafel) {
      pruefe(tafel.anzeige === "grid", `Die Ergebnistafel liegt flach nicht quer, sondern als ${tafel.anzeige}.`);
      pruefe(tafel.knoepfeDrin, "Auf der flachen Ergebnistafel stehen die Knöpfe ausserhalb des Bildes.");
    }
    await kontext.close();
  }

  // --- 4. Die Leiste: nichts liegt übereinander, in keiner Lage ----------------
  // Was sich hier überdeckt, ist nicht unschön, sondern unerreichbar: ein
  // Knopf unter einem anderen lässt sich nicht drücken. Gemessen wird deshalb,
  // nicht angesehen.
  for (const [name, viewport] of [
    ["Handy quer", { width: 568, height: 320 }],
    ["Tablet quer", { width: 844, height: 390 }],
    // Hochkant ist seit dem Wegfall des Dreh-Hinweises eine Lage wie jede
    // andere. Zwischen dem Lautsprecher links und dem Ton-Schalter rechts
    // bleiben dort gut 200 Pixel – der engste Fall, den es gibt.
    ["Handy hoch", { width: 390, height: 844 }],
    ["Handy hoch schmal", { width: 320, height: 568 }],
  ]) {
    const { kontext, seite } = await neueSeite(viewport);
    await seite.goto(`${BASIS}/turmbau`, { waitUntil: "load" });
    await seite.waitForSelector(".cm-bar-left .mini-knopf", { timeout: 8000 });
    await seite.waitForTimeout(300);
    const befund = await seite.evaluate(() => {
      const stuecke = [
        ...[...document.querySelectorAll(".cm-bar-left > *")].map((e) => ({ was: (e.textContent || "Neustart").trim() || "Neustart", r: e.getBoundingClientRect() })),
        { was: "Zähler", r: document.querySelector(".cm-count").getBoundingClientRect() },
        { was: "Lautsprecher", r: document.querySelector(".help-voice-button")?.getBoundingClientRect() },
        { was: "Ton", r: document.querySelector(".sound-toggle")?.getBoundingClientRect() },
      ].filter((s) => s.r && s.r.width > 0);
      const stoesse = [];
      for (let i = 0; i < stuecke.length; i += 1) {
        for (let j = i + 1; j < stuecke.length; j += 1) {
          const a = stuecke[i].r;
          const b = stuecke[j].r;
          const quer = a.left < b.right - 1 && b.left < a.right - 1;
          const hoch = a.top < b.bottom - 1 && b.top < a.bottom - 1;
          if (quer && hoch) stoesse.push(`${stuecke[i].was} × ${stuecke[j].was}`);
        }
      }
      const letzte = stuecke.reduce((max, s) => Math.max(max, s.r.right), 0);
      // Eine Zeile oder zwei? Bricht die Leiste um, liegt nichts übereinander
      // – die zweite Zeile legt sich aber über die Spielfläche und über den
      // Satz, der dort steht. Gemessen wird deshalb die Leiste selbst gegen
      // ihr höchstes Stück: Sind beide gleich hoch, steht alles nebeneinander.
      const leiste = document.querySelector(".cm-bar").getBoundingClientRect();
      const hoechstes = stuecke.reduce((max, s) => Math.max(max, s.r.height), 0);
      return {
        stoesse,
        ueberRand: Math.round(letzte - window.innerWidth),
        leisteHoch: Math.round(leiste.height),
        hoechstes: Math.round(hoechstes),
      };
    });
    pruefe(befund.stoesse.length === 0, `${name}: In der Leiste liegt etwas übereinander – ${befund.stoesse.join(", ")}`);
    pruefe(befund.ueberRand <= 0, `${name}: Die Leiste steht ${befund.ueberRand} px über den rechten Rand.`);
    pruefe(befund.leisteHoch <= befund.hoechstes + 4,
      `${name}: Die Leiste bricht um – ${befund.leisteHoch} px hoch bei einem höchsten Stück von ${befund.hoechstes} px.`);
    await kontext.close();
  }

  // --- 4b. Der Adminbereich ----------------------------------------------------
  // Er ist der einzige Ort mit Anmeldung, und er ist der einzige, der etwas
  // löschen kann. Geprüft wird hier nur, was ohne Konto zu sehen ist: dass die
  // Anmeldung dasteht, alle drei Wege hinein angeboten werden, und dass der
  // Bereich selbst ohne Anmeldung nirgends aufblitzt.
  {
    const kontext = await browser.newContext({ viewport: { width: 900, height: 900 }, serviceWorkers: "block" });
    const seite = await kontext.newPage();
    const fehlerHier = [];
    seite.on("pageerror", (fehler) => fehlerHier.push(String(fehler.message || fehler)));
    seite.on("console", (n) => { if (n.type() === "error") fehlerHier.push(n.text()); });
    // Das SDK wird nachgebaut: Ein echtes Firebase liefe beim Prüfen gegen das
    // Netz und meldete jeden Aussetzer als Befund.
    await seite.route("https://www.gstatic.com/firebasejs/**", (route) => {
      const url = route.request().url();
      if (url.includes("auth-compat")) {
        return route.fulfill({ contentType: "text/javascript; charset=utf-8", body: `
          window.firebase = window.firebase || {};
          window.firebase.auth = function () {
            return {
              getRedirectResult: async () => null,
              isSignInWithEmailLink: () => false,
              onAuthStateChanged: (fn) => { window.__adminZustand = fn; fn(null); },
              signOut: async () => {},
            };
          };
          window.firebase.auth.GoogleAuthProvider = function () {};
        ` });
      }
      return route.fulfill({ contentType: "text/javascript; charset=utf-8", body: `
        window.firebase = window.firebase || {};
        window.firebase.initializeApp = () => ({});
        window.firebase.apps = [];
        window.firebase.firestore = () => ({ collection: () => ({ limit: () => ({ get: async () => ({ forEach: () => {} }) }) }) });
      ` });
    });
    await seite.route("**/cloud.js*", (route) => route.continue());
    // Ein Merkzeichen von einer alten Anmeldung: Meldet Firebase niemanden,
    // muss es weg – sonst stünde auf der Startseite ein Knopf für jemanden,
    // der gar nicht mehr angemeldet ist.
    await seite.addInitScript(() => { if (!sessionStorage.getItem("__schon")) { sessionStorage.setItem("__schon", "1"); localStorage.setItem("mini.admin", "ja"); } });
    await seite.goto(`${BASIS}/admin`, { waitUntil: "load" });
    await seite.waitForSelector(".adm-anmeldung", { timeout: 8000 });
    pruefe(await seite.evaluate(() => localStorage.getItem("mini.admin")) === null,
      "Ohne Anmeldung bleibt das Merkzeichen für den Admin-Knopf stehen.");

    const text = await seite.locator(".adm-anmeldung").innerText();
    for (const weg of ["Google", "Link per E-Mail", "Anmelden"]) {
      pruefe(text.includes(weg), `Im Adminbereich fehlt der Weg "${weg}" (steht: ${text.replace(/\n/g, " | ")}).`);
    }
    pruefe(await seite.locator(".adm-anmeldung input[type=\"password\"]").count() === 1, "Im Adminbereich fehlt das Passwortfeld.");
    pruefe(await seite.locator(".adm-tabelle").count() === 0, "Ohne Anmeldung stehen im Adminbereich schon Daten.");
    pruefe(await seite.locator(".adm-streifen").count() === 0, "Ohne Anmeldung stehen im Adminbereich schon Zahlen.");
    const ueberstand = await seite.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    pruefe(ueberstand <= 1, `Der Adminbereich steht ${ueberstand} px über den rechten Rand.`);
    pruefe(fehlerHier.length === 0, `Der Adminbereich hat sich beschwert – ${fehlerHier.join(" / ")}`);
    await kontext.close();
  }

  // --- 4c. Der Weg in den Adminbereich ------------------------------------------
  // Einen Anmeldeknopf gibt es in der App nicht. Wer aber im Adminbereich
  // angemeldet ist, findet im Balken der Startseite zurück.
  {
    const { kontext, seite } = await neueSeite();
    await seite.goto(`${BASIS}/`, { waitUntil: "load" });
    await seite.waitForSelector(".mini-karte", { timeout: 8000 });
    pruefe(await seite.locator('a[href="/admin"]').count() === 0, "Ohne Anmeldung steht auf der Startseite ein Weg in den Adminbereich.");
    pruefe(!/anmelden|login/i.test(await seite.locator(".mini-seite").innerText()), "Auf der Startseite steht etwas vom Anmelden.");
    await kontext.close();
  }
  for (const [lage, viewport] of [["breit", { width: 1000, height: 800 }], ["Handy hoch schmal", { width: 320, height: 568 }]]) {
    const { kontext, seite } = await neueSeite(viewport);
    await seite.addInitScript(() => localStorage.setItem("mini.admin", "ja"));
    await seite.goto(`${BASIS}/`, { waitUntil: "load" });
    await seite.waitForSelector(".mini-karte", { timeout: 8000 });
    const knopf = seite.locator(".mini-kopf a.mini-knopf-admin");
    pruefe(await knopf.count() === 1, `${lage}: Als Admin fehlt im Balken der Startseite der Knopf zum Adminbereich.`);
    if (await knopf.count()) {
      pruefe(await knopf.getAttribute("href") === "/admin", `${lage}: Der Admin-Knopf zeigt auf ${await knopf.getAttribute("href")}.`);
      const befund = await seite.evaluate(() => {
        const balken = document.querySelector(".mini-kopf").getBoundingClientRect();
        const k = document.querySelector(".mini-knopf-admin").getBoundingClientRect();
        return {
          drin: k.top >= balken.top - 1 && k.bottom <= balken.bottom + 1 && k.left >= balken.left - 1 && k.right <= balken.right + 1,
          ueberstand: document.documentElement.scrollWidth - window.innerWidth,
        };
      });
      pruefe(befund.drin, `${lage}: Der Admin-Knopf steht nicht im Balken.`);
      pruefe(befund.ueberstand <= 1, `${lage}: Mit dem Admin-Knopf steht die Startseite ${befund.ueberstand} px über den Rand.`);
    }
    await kontext.close();
  }

  // --- 4d. Turniere auf der Startseite ------------------------------------------
  // Öffentliche, die laufen, bald beginnen oder eben vorbei sind – ganz oben.
  // Nie eines nur mit Link, nie ein angehaltenes, nie eines von vor Wochen.
  {
    const { kontext, seite } = await mitTurnieren("/");
    await seite.waitForSelector(".tn-hinweis", { timeout: 8000 });
    await seite.waitForSelector(".mini-karte", { timeout: 8000 });
    const hinweise = await seite.locator(".tn-hinweis").evaluateAll((alle) => alle.map((a) => ({ href: a.getAttribute("href"), text: a.innerText.replace(/\n/g, " ") })));
    const alleTexte = hinweise.map((h) => h.text).join(" | ");
    pruefe(hinweise.length === 3, `Auf der Startseite stehen ${hinweise.length} Turniere statt drei: ${alleTexte}`);
    pruefe(/Herbstcup/.test(hinweise[0]?.text || "") && /läuft noch/.test(hinweise[0]?.text || ""), `Zuoberst steht nicht das laufende Turnier: ${alleTexte}`);
    pruefe(hinweise.some((h) => h.href === `/turnier?t=${HERBST}`), `Der Hinweis führt nicht auf die Turnierseite: ${hinweise.map((h) => h.href).join(", ")}`);
    pruefe(hinweise.some((h) => /Wintercup/.test(h.text) && /beginnt in/.test(h.text)), `Das geplante Turnier fehlt: ${alleTexte}`);
    pruefe(hinweise.some((h) => /Sommercup/.test(h.text) && /Rangliste/.test(h.text)), `Das eben beendete Turnier fehlt: ${alleTexte}`);
    for (const nicht of ["Familienabend", "Frühlingscup", "Pausencup", "Blindcup", "Würfelcup"]) {
      pruefe(!alleTexte.includes(nicht), `Auf der Startseite steht "${nicht}".`);
    }
    const oben = await seite.evaluate(() => document.querySelector(".tn-hinweis").getBoundingClientRect().top
      < document.querySelector(".mini-karte").getBoundingClientRect().top);
    pruefe(oben, "Die Turniere stehen unter den Spielen statt darüber.");
    const ohne = await klassenOhneRegel(seite);
    pruefe(ohne.length === 0, `Startseite mit Turnieren: Klassen ohne Regel – ${ohne.join(", ")}`);
    await kontext.close();
  }
  {
    // Ohne Turnier bleibt oben nichts stehen, auch kein leerer Kasten.
    const { kontext, seite } = await neueSeite();
    await seite.goto(`${BASIS}/`, { waitUntil: "load" });
    await seite.waitForSelector(".mini-karte", { timeout: 8000 });
    const hoehe = await seite.evaluate(() => document.querySelector(".tn-hinweise")?.getBoundingClientRect().height ?? 0);
    pruefe(hoehe === 0, `Ohne Turnier steht oben ein ${hoehe} px hoher Kasten.`);
    await kontext.close();
  }

  // --- 4e. Die Turnierseite ------------------------------------------------------
  for (const [lage, viewport] of [["breit", { width: 1000, height: 900 }], ["Handy", { width: 360, height: 740 }]]) {
    const { kontext, seite } = await mitTurnieren(`/turnier?t=${HERBST}`, { viewport, vorher: () => localStorage.setItem("mini.admin", "ja") });
    await seite.waitForSelector(".tn-karte", { timeout: 8000 });
    const stand = await seite.evaluate(() => ({
      titel: document.querySelector(".tn-kopf h1")?.textContent,
      status: document.querySelector(".tn-status")?.textContent || "",
      karten: [...document.querySelectorAll(".tn-karte h3")].map((h) => h.textContent),
      spielen: [...document.querySelectorAll(".tn-karte .mini-karte-aktionen a")].map((a) => a.getAttribute("href")),
      regeln: [...document.querySelectorAll(".tn-regel-liste li")].map((li) => li.textContent),
      link: document.querySelector(".tn-link-feld")?.value || "",
      erster: document.querySelector(".tn-tabelle tbody tr .tn-wer > span")?.textContent,
      ersterWert: document.querySelector(".tn-tabelle tbody tr .tn-wert")?.textContent,
      zeilen: document.querySelectorAll(".tn-tabelle tbody tr").length,
      beschreibung: document.querySelector(".tn-beschreibung")?.textContent,
      admin: document.querySelector(".tn-kopf .mini-knopf-admin")?.getAttribute("href"),
      ueberstand: document.documentElement.scrollWidth - window.innerWidth,
    }));
    pruefe(stand.titel === "Herbstcup", `${lage}: Die Turnierseite heisst "${stand.titel}".`);
    pruefe(/läuft noch/.test(stand.status), `${lage}: Unter dem Namen steht nicht, wie lange es noch läuft: ${stand.status}`);
    pruefe(stand.karten.length === 3, `${lage}: Auf der Turnierseite stehen ${stand.karten.length} Spiele statt drei.`);
    pruefe(stand.spielen.includes(`/turmbau?turnier=${HERBST}`), `${lage}: "Spielen" führt nicht ins Spiel im Turnier: ${stand.spielen.join(", ")}`);
    pruefe(stand.regeln.length >= 5 && stand.regeln.some((r) => /2 Versuche/.test(r)) && stand.regeln.some((r) => /kleinste Summe/.test(r)),
      `${lage}: Die Regeln stehen nicht in Sätzen da: ${stand.regeln.join(" / ")}`);
    pruefe(stand.link.endsWith(`/turnier?t=${HERBST}`), `${lage}: Der Link zum Weitergeben ist "${stand.link}".`);
    pruefe(stand.erster === "Leo" && stand.ersterWert === "4",
      `${lage}: Die Gesamtwertung rechnet falsch – vorne steht ${stand.erster} mit ${stand.ersterWert} statt Leo mit 4.`);
    pruefe(stand.zeilen === 3, `${lage}: In der Gesamtwertung stehen ${stand.zeilen} Spieler statt drei.`);
    pruefe(stand.beschreibung === "Wer gewinnt, wählt das Znacht.", `${lage}: Die Beschreibung fehlt.`);
    pruefe(stand.admin === "/admin", `${lage}: Als Admin fehlt auf der Turnierseite der Weg in den Adminbereich.`);
    pruefe(stand.ueberstand <= 1, `${lage}: Die Turnierseite steht ${stand.ueberstand} px über den rechten Rand.`);
    const ohne = await klassenOhneRegel(seite);
    pruefe(ohne.length === 0, `${lage}: Turnierseite – Klassen ohne Regel: ${ohne.join(", ")}`);
    await kontext.close();
  }
  {
    // Verdeckt: Wer spielt, sieht seine eigene Zahl, aber nicht, wer vorne liegt.
    const { kontext, seite } = await mitTurnieren("/turnier?t=verdeckt-test23456");
    await seite.waitForSelector(".tn-karte", { timeout: 8000 });
    pruefe(await seite.locator(".tn-karte .mini-zeile").count() === 0, "Im verdeckten Turnier stehen die Ranglisten da.");
    pruefe(await seite.locator(".tn-tabelle").count() === 0, "Im verdeckten Turnier steht die Gesamtwertung da.");
    pruefe(await seite.locator(".tn-verdeckt").count() >= 1, "Im verdeckten Turnier steht nicht, dass die Liste verdeckt ist.");
    await kontext.close();
  }
  {
    const { kontext, seite } = await mitTurnieren("/turnier?t=gibtsnicht-123456");
    await seite.waitForFunction(() => /gibt es nicht/.test(document.querySelector("[data-turnier]")?.textContent || ""), null, { timeout: 8000 })
      .catch(() => {});
    const text = await seite.locator("[data-turnier]").innerText();
    pruefe(/gibt es nicht/.test(text), `Für ein unbekanntes Turnier steht da: ${text.replace(/\n/g, " | ")}`);
    await kontext.close();
  }

  // --- 4f. Ein Turnier, von vorne bis hinten --------------------------------------
  // Tafel, Name, zwei Versuche, dann ist Schluss. Jeder Versuch geht ins
  // Turnier und in die ewige Liste, und nach dem letzten gibt es keinen mehr.
  {
    const { kontext, seite } = await mitTurnieren(`/turmbau?turnier=${HERBST}`);
    const vorher = fehlerAufSeite.length;
    await seite.waitForSelector(".tn-tor .tn-los", { timeout: 8000 });
    const tafel = (await seite.locator(".tn-tor").innerText()).replace(/\n/g, " ");
    pruefe(/Herbstcup/.test(tafel) && /Versuch 1 von 2/.test(tafel), `Die Tafel vor dem Spiel sagt nicht, worum es geht: ${tafel}`);
    pruefe(await seite.locator(".tn-tor .mini-namensfeld input").count() === 1, "Ohne Namen fragt die Tafel nicht nach einem.");
    const zurueck = await seite.getAttribute(".cm-bar-left a", "href");
    pruefe(zurueck === `/turnier?t=${HERBST}`, `Oben links führt der Weg im Turnier nach ${zurueck} statt zurück zum Turnier.`);
    pruefe(await seite.locator(".cm-bar-left > *").count() === 2, "Im Turnier stehen oben links mehr als zwei Knöpfe.");
    const ohne = await klassenOhneRegel(seite);
    pruefe(ohne.length === 0, `Tafel vor dem Spiel – Klassen ohne Regel: ${ohne.join(", ")}`);

    // Ohne Namen geht es nicht los.
    await seite.click(".tn-tor .tn-los");
    pruefe(await seite.locator(".tn-tor").count() === 1, "Die Tafel ging ohne Namen weg.");
    await turnierLos(seite, "Turnierkind");

    const eintrag = () => seite.evaluate((id) => {
      const ich = localStorage.getItem("mini.id");
      return {
        turnier: window.__miniTurnierEintraege.get(`${id}/towerStack_${ich}`) || null,
        ewig: window.__miniEintraege.get(`towerStack_${ich}`) || null,
        text: document.querySelector(".tn-ergebnis")?.innerText.replace(/\n/g, " ") || "",
        // Aus dem Spiel, nicht von der Tafel: Turmbau zählt die Zahl dort
        // sichtbar hoch, und wer zu früh liest, liest eine Null.
        punkte: window.LernappTurmbau?.state?.punkte,
        pokal: document.querySelector(".cm-icon-cup")?.getAttribute("href"),
      };
    }, HERBST);

    pruefe(await spieleZuEnde(seite), "Der erste Turnierversuch kam zu keinem Ergebnis.");
    await seite.waitForFunction(() => /Eingetragen/.test(document.querySelector(".tn-ergebnis .mini-meldung")?.textContent || ""), null, { timeout: 6000 })
      .catch(() => {});
    const eins = await eintrag();
    pruefe(eins.turnier?.versuche === 1 && eins.turnier?.offen === false, `Nach dem ersten Versuch steht im Turnier: ${JSON.stringify(eins.turnier)}`);
    pruefe(eins.turnier?.punkte === eins.punkte, `Im Turnier stehen ${eins.turnier?.punkte} statt ${eins.punkte}.`);
    pruefe(eins.turnier?.name === "Turnierkind", `Im Turnier steht der Name "${eins.turnier?.name}".`);
    pruefe(eins.ewig?.punkte === eins.punkte, "Die Runde im Turnier fehlt in der ewigen Liste.");
    pruefe(/Noch ein Versuch/.test(eins.text), `Nach dem ersten von zwei Versuchen steht nicht, dass noch einer bleibt: ${eins.text}`);
    pruefe(/Grosi/.test(eins.text), `Unter dem Ergebnis fehlt die Rangliste des Turniers: ${eins.text}`);
    pruefe(eins.pokal === `/turnier?t=${HERBST}`, `Der Pokal unter dem Ergebnis führt nach ${eins.pokal} statt zum Turnier.`);
    const ohneImErgebnis = await klassenOhneRegel(seite);
    pruefe(ohneImErgebnis.length === 0, `Ergebnis im Turnier – Klassen ohne Regel: ${ohneImErgebnis.join(", ")}`);

    // Der zweite Versuch beginnt ohne Tafel – und würfelt als zweiter.
    await seite.click(".cm-actions .cm-icon-again");
    pruefe(await seite.locator(".tn-tor").count() === 0, "Vor dem zweiten Versuch steht wieder die Tafel.");
    const runde = await seite.evaluate(() => window.LernappZufall?.turnier?.()?.runde);
    pruefe(runde === "2", `Der zweite Versuch würfelt als Runde ${runde} statt 2.`);
    pruefe(await spieleZuEnde(seite), "Der zweite Turnierversuch kam zu keinem Ergebnis.");
    await seite.waitForFunction(() => /letzter Versuch/.test(document.querySelector(".tn-ergebnis")?.textContent || ""), null, { timeout: 6000 })
      .catch(() => {});
    const zwei = await eintrag();
    pruefe(zwei.turnier?.versuche === 2 && zwei.turnier?.offen === false, `Nach dem zweiten Versuch steht im Turnier: ${JSON.stringify(zwei.turnier)}`);
    pruefe(zwei.turnier?.punkte === Math.max(eins.punkte, zwei.punkte), `Es zählt nicht der bessere Versuch: ${zwei.turnier?.punkte} bei ${eins.punkte} und ${zwei.punkte}.`);
    pruefe(/letzter Versuch/.test(zwei.text), `Nach dem letzten Versuch steht das nicht da: ${zwei.text}`);

    // Einen dritten gibt es nicht.
    await seite.click(".cm-actions .cm-icon-again");
    await seite.waitForSelector(".tn-tor", { timeout: 4000 }).catch(() => {});
    const schluss = (await seite.locator(".tn-tor").innerText().catch(() => "")).replace(/\n/g, " ");
    pruefe(/alle 2 Versuche/.test(schluss), `Nach dem letzten Versuch sagt die Tafel: ${schluss || "nichts"}`);
    pruefe(await seite.locator(".tn-tor .tn-los").count() === 0, "Nach dem letzten Versuch lässt die Tafel noch einmal spielen.");
    const weiter = await seite.locator(".tn-tor a", { hasText: "Ohne Turnier" }).getAttribute("href").catch(() => null);
    pruefe(weiter === "/turmbau", `Nach dem letzten Versuch führt "Ohne Turnier weiterspielen" nach ${weiter}.`);
    pruefe(fehlerAufSeite.length === vorher, `Das Turnier hat sich beschwert – ${fehlerAufSeite.slice(vorher).join(" / ")}`);
    await kontext.close();
  }
  {
    // Wer mitten in einer Runde neu anfängt, hat den Versuch gebraucht – das
    // sagt die Frage vorher, und so zählt es auch.
    const { kontext, seite } = await mitTurnieren(`/zahlengleis?turnier=${HERBST}`);
    let gefragt = "";
    seite.on("dialog", (frage) => { gefragt = frage.message(); frage.accept(); });
    await turnierLos(seite, "Abbrecherin");
    await seite.waitForFunction(() => window.LernappTurnier?.stand?.().gespielt === 1, null, { timeout: 4000 }).catch(() => {});
    await seite.click(".cm-bar-left .cm-icon-again");
    await seite.waitForFunction(() => window.LernappTurnier?.stand?.().gespielt === 2, null, { timeout: 4000 }).catch(() => {});
    const stand = await seite.evaluate((id) => {
      const ich = localStorage.getItem("mini.id");
      return { eintrag: window.__miniTurnierEintraege.get(`${id}/numberLine_${ich}`), tor: Boolean(document.querySelector(".tn-tor")) };
    }, HERBST);
    pruefe(/zählt/.test(gefragt), `Vor dem Neustart mitten im Versuch kam keine Frage (${gefragt || "nichts"}).`);
    pruefe(stand.eintrag?.versuche === 2, `Der abgebrochene Versuch zählt nicht: ${JSON.stringify(stand.eintrag)}`);
    pruefe(!stand.tor, "Nach dem Neustart mit einem übrigen Versuch steht die Tafel da.");
    await kontext.close();
  }

  // --- 4g. Im Turnier bekommen alle dieselbe Aufgabe ------------------------------
  // Zwei Geräte, zwei Namen, derselbe Versuch: dieselbe Zahl. Und sie kommt
  // wirklich aus dem Zufall des Turniers – nachgerechnet mit zufall.js.
  {
    const befunde2 = [];
    for (const name of ["Anna", "Ben"]) {
      const { kontext, seite } = await mitTurnieren(`/zahlengleis?turnier=${HERBST}`);
      await turnierLos(seite, name);
      await seite.waitForFunction(() => Boolean(window.LernappZahlengleis?.state?.zahl), null, { timeout: 4000 }).catch(() => {});
      befunde2.push(await seite.evaluate(() => {
        const z = window.LernappZufall.fuer("numberLine");
        z.neu();
        const { bis } = window.LernappZahlengleis.gleisFuer(0);
        const moeglich = [];
        for (let n = 1; n < bis; n += 1) moeglich.push(n);
        return {
          zahl: window.LernappZahlengleis.state.zahl,
          erwartet: moeglich[z.ganz(moeglich.length)],
          fest: window.LernappZufall.istFest(),
          runde: window.LernappZufall.turnier()?.runde,
        };
      }));
      await kontext.close();
    }
    const [a, b] = befunde2;
    pruefe(a.fest && b.fest, "Im Turnier mit gleichen Aufgaben würfelt der Zufall frei.");
    pruefe(a.runde === "1" && b.runde === "1", `Der erste Versuch würfelt als Runde ${a.runde}/${b.runde} statt 1.`);
    pruefe(a.zahl === b.zahl, `Zwei Spieler bekommen im ersten Versuch verschiedene Zahlen: ${a.zahl} und ${b.zahl}.`);
    pruefe(a.zahl === a.erwartet, `Wo hält der Zug? nimmt seine Zahl nicht aus dem Zufall des Turniers (${a.zahl} statt ${a.erwartet}).`);
  }
  {
    const { kontext, seite } = await mitTurnieren("/zahlengleis?turnier=zufall-test2345678");
    await turnierLos(seite, "Würfler");
    const fest = await seite.evaluate(() => window.LernappZufall.istFest());
    pruefe(fest === false, "Im Turnier mit gewürfelten Aufgaben bekommen doch alle dieselben.");
    await kontext.close();
  }
  {
    const { kontext, seite } = await neueSeite();
    await seite.goto(`${BASIS}/zahlengleis`, { waitUntil: "load" });
    await seite.waitForSelector(".cm-bar", { timeout: 8000 });
    const ohne = await seite.evaluate(() => ({ fest: window.LernappZufall.istFest(), turnier: window.LernappZufall.turnier(), tor: Boolean(document.querySelector(".tn-tor")) }));
    pruefe(!ohne.fest && ohne.turnier === null && !ohne.tor, `Ohne Turnier in der Adresse ist trotzdem eines da: ${JSON.stringify(ohne)}`);
    await kontext.close();
  }

  // --- 4h. Wenn es im Turnier nichts zu spielen gibt ------------------------------
  // Dann sagt die Tafel warum, lässt nicht spielen – und zeigt den Weg ins
  // Spiel ohne Turnier.
  for (const [adresse, erwartet, was] of [
    [`/signal?turnier=${HERBST}`, /gehört nicht zu diesem Turnier/, "ein Spiel, das nicht dazugehört"],
    ["/turmbau?turnier=bald-test23456789", /beginnt/, "ein Turnier, das noch nicht angefangen hat"],
    ["/turmbau?turnier=vorbei-test2345678", /vorbei/, "ein beendetes Turnier"],
    ["/turmbau?turnier=pause-test2345678", /angehalten/, "ein angehaltenes Turnier"],
    ["/turmbau?turnier=gibtsnicht-123456", /gibt es nicht/, "ein Turnier, das es nicht gibt"],
  ]) {
    const { kontext, seite } = await mitTurnieren(adresse);
    await seite.waitForFunction(() => {
      const tor = document.querySelector(".tn-tor");
      return tor && !/geladen/.test(tor.textContent);
    }, null, { timeout: 8000 }).catch(() => {});
    const text = (await seite.locator(".tn-tor").innerText().catch(() => "")).replace(/\n/g, " ");
    pruefe(erwartet.test(text), `Für ${was} sagt die Tafel: ${text || "nichts"}`);
    pruefe(await seite.locator(".tn-tor .tn-los").count() === 0, `Für ${was} lässt die Tafel spielen.`);
    const ohne = await seite.locator(".tn-tor a", { hasText: /Ohne Turnier|üben/ }).first().getAttribute("href").catch(() => null);
    pruefe(Boolean(ohne) && !ohne.includes("turnier="), `Für ${was} fehlt der Weg ins Spiel ohne Turnier (${ohne}).`);
    await kontext.close();
  }

  // --- 4h2. Tasten und Tipps gehören der Tafel -----------------------------------
  // Die Spiele hören auf der ganzen Seite auf Leertaste und Enter. Auf einer
  // Tafel mit einem Namensfeld darf davon nichts ankommen: Ein Leerzeichen
  // gehört in den Namen, Enter trägt ihn ein – und hinter der Tafel des
  // Turniers läuft keine Runde an.
  {
    const { kontext, seite } = await neueSeite();
    await seite.goto(`${BASIS}/turmbau`, { waitUntil: "load" });
    await seite.waitForSelector(".cm-bar", { timeout: 8000 });
    pruefe(await spieleTurmbauZuEnde(seite), "Die Runde für das Namensfeld kam zu keinem Ergebnis.");
    await seite.waitForSelector(".mini-namensfeld input", { timeout: 4000 }).catch(() => {});
    await seite.click(".mini-namensfeld input");
    await seite.keyboard.type("Test Kind");
    const getippt = await seite.inputValue(".mini-namensfeld input");
    await seite.keyboard.press("Enter");
    await seite.waitForFunction(() => localStorage.getItem("mini.name") === "Test Kind", null, { timeout: 3000 }).catch(() => {});
    pruefe(getippt === "Test Kind", `Unter dem Ergebnis kommt im Namensfeld kein Leerzeichen an: "${getippt}".`);
    pruefe(await seite.evaluate(() => localStorage.getItem("mini.name")) === "Test Kind", "Unter dem Ergebnis trägt Enter den Namen nicht ein.");
    await kontext.close();
  }
  {
    const { kontext, seite } = await mitTurnieren(`/turmbau?turnier=${HERBST}`);
    await seite.waitForSelector(".tn-tor .mini-namensfeld input", { timeout: 8000 });
    // Ein Tipp auf die Tafel, nicht auf einen Knopf: Der erste Block bleibt oben.
    const tafel = await seite.locator(".tn-tor .tn-tafel").boundingBox();
    await seite.mouse.click(tafel.x + 12, tafel.y + 12);
    await seite.keyboard.press("Space");
    await seite.waitForTimeout(300);
    pruefe(await seite.evaluate(() => window.LernappTurmbau.state.phase) === "bereit",
      "Hinter der Tafel des Turniers hat ein Tipp oder eine Taste die Runde gestartet.");
    await seite.click(".tn-tor .mini-namensfeld input");
    await seite.keyboard.type("Turnier Kind");
    await seite.keyboard.press("Enter");
    await seite.waitForFunction(() => !document.querySelector(".tn-tor"), null, { timeout: 3000 }).catch(() => {});
    pruefe(await seite.locator(".tn-tor").count() === 0, "Enter im Namensfeld der Tafel lässt das Turnier nicht beginnen.");
    pruefe(await seite.evaluate(() => localStorage.getItem("mini.name")) === "Turnier Kind",
      `Auf der Tafel kam der Name als "${await seite.evaluate(() => localStorage.getItem("mini.name"))}" an.`);
    await kontext.close();
  }
  {
    // Hier gehört das Spiel nicht zum Turnier – die Tafel bleibt. Eine Taste,
    // die niemandem gilt, darf trotzdem keine Runde dahinter starten.
    const { kontext, seite } = await mitTurnieren(`/signal?turnier=${HERBST}`);
    await seite.waitForFunction(() => /gehört nicht/.test(document.querySelector(".tn-tor")?.textContent || ""), null, { timeout: 8000 }).catch(() => {});
    await seite.keyboard.press("Space");
    await seite.keyboard.press("Enter");
    await seite.waitForTimeout(300);
    pruefe(await seite.evaluate(() => window.LernappSignal.state.phase) === "intro",
      "Hinter der Tafel eines Turniers, in dem das Spiel nicht vorkommt, lief eine Runde an.");
    await kontext.close();
  }

  // --- 4i. Die Tafel auf einem flachen Handy --------------------------------------
  // Name, Regeln, zwei Knöpfe – auf 320 Pixeln Höhe muss "Los geht's"
  // erreichbar bleiben, notfalls über die rollende Tafel.
  {
    const { kontext, seite } = await mitTurnieren(`/turmbau?turnier=${HERBST}`, { viewport: { width: 568, height: 320 } });
    await seite.waitForSelector(".tn-tor .tn-los", { timeout: 8000 });
    const befund = await seite.evaluate(() => {
      const los = document.querySelector(".tn-tor .tn-los");
      los.scrollIntoView({ block: "nearest" });
      const r = los.getBoundingClientRect();
      const leiste = document.querySelector(".cm-bar").getBoundingClientRect();
      return { sichtbar: r.top >= leiste.bottom - 2 && r.bottom <= window.innerHeight + 1, anzeige: getComputedStyle(document.querySelector(".tn-tafel")).display };
    });
    pruefe(befund.sichtbar, "Auf dem flachen Handy ist «Los geht's» nicht zu erreichen.");
    pruefe(befund.anzeige === "flex", `Die Tafel des Turniers liegt flach als ${befund.anzeige} statt als Spalte.`);
    await kontext.close();
  }

  // --- 4j. Der Adminbereich, angemeldet --------------------------------------------
  // Anmelden merkt sich den Admin (für den Knopf auf der Startseite), Abmelden
  // vergisst ihn. Dazwischen: Turniere sehen, anlegen, anhalten, löschen.
  {
    const kontext = await browser.newContext({ viewport: { width: 1100, height: 1000 }, serviceWorkers: "block" });
    const seite = await kontext.newPage();
    const fehlerHier = [];
    seite.on("pageerror", (fehler) => fehlerHier.push(String(fehler.message || fehler)));
    seite.on("console", (n) => { if (n.type() === "error") fehlerHier.push(n.text()); });
    seite.on("dialog", (frage) => frage.accept());
    await seite.addInitScript((daten) => { window.__miniTurniereAnfang = daten; }, TURNIERE);
    await seite.route("**/cloud.js*", (route) => route.fulfill({ contentType: "text/javascript; charset=utf-8", body: ATTRAPPE }));
    await seite.route("https://www.gstatic.com/firebasejs/**", (route) => {
      if (route.request().url().includes("auth-compat")) {
        return route.fulfill({ contentType: "text/javascript; charset=utf-8", body: `
          window.firebase = window.firebase || {};
          window.firebase.auth = function () {
            return {
              getRedirectResult: async () => null,
              isSignInWithEmailLink: () => false,
              onAuthStateChanged: (fn) => { window.__adminZustand = fn; fn({ email: "alain.sc2@gmail.com", emailVerified: true }); },
              signOut: async () => { window.__adminZustand(null); },
            };
          };
          window.firebase.auth.GoogleAuthProvider = function () {};
        ` });
      }
      return route.fulfill({ contentType: "text/javascript; charset=utf-8", body: "/* in der Prüfung nicht gebraucht */" });
    });
    await seite.goto(`${BASIS}/admin`, { waitUntil: "load" });
    await seite.waitForSelector(".adm-turniere .adm-turnier", { timeout: 8000 });

    pruefe(await seite.evaluate(() => localStorage.getItem("mini.admin")) === "ja",
      "Nach der Anmeldung merkt sich der Adminbereich nicht, dass hier ein Admin ist.");
    const namen = await seite.locator(".adm-turnier h3").allInnerTexts();
    pruefe(namen.length === TURNIERE.turniere.length, `Im Adminbereich stehen ${namen.length} Turniere statt ${TURNIERE.turniere.length} – auch die nur mit Link gehören hierher.`);
    pruefe(namen[0] === "Herbstcup" && namen[namen.length - 1] === "Frühlingscup",
      `Die Turniere stehen nicht in der Reihenfolge laufend – geplant – angehalten – vorbei: ${namen.join(", ")}`);
    const herbst = seite.locator(".adm-turnier", { hasText: "Herbstcup" });
    pruefe(/vorne: 1\. Leo/.test(await herbst.innerText()), `Beim Herbstcup steht nicht, wer vorne liegt: ${(await herbst.innerText()).replace(/\n/g, " ")}`);

    // Ein neues Turnier.
    await seite.click(".adm-turniere .adm-block-kopf button");
    await seite.waitForSelector(".adm-turnier-form", { timeout: 4000 });
    const form = seite.locator(".adm-turnier-form");
    await form.locator('input[type="text"]').first().fill("Test-Cup Ä");
    await form.locator("button", { hasText: "Keine" }).click();
    await form.locator('input[value="towerStack"]').check();
    await form.locator('input[value="fishPond"]').check();
    await form.locator("select.adm-feld-schmal").selectOption("0");
    const summeGesperrt = await form.locator('input[type="radio"][value="summe"]').isDisabled();
    pruefe(summeGesperrt, "Bei unbegrenzten Versuchen lässt sich «alle zusammen» wählen.");
    await form.locator("select.adm-feld-schmal").selectOption("5");
    await form.locator('input[type="radio"][value="summe"]').check();
    await form.locator('input[type="radio"][value="prozent"]').check();
    await form.locator('input[type="radio"][value="link"]').check();
    await form.locator(".adm-option", { hasText: "verdecken" }).locator("input").check();
    await form.locator('button[type="submit"]').click();
    await seite.waitForFunction(() => [...window.__miniTurniere.values()].some((t) => t.name === "Test-Cup Ä"), null, { timeout: 4000 })
      .catch(() => {});
    const neu = await seite.evaluate(() => [...window.__miniTurniere.values()].find((t) => t.name === "Test-Cup Ä") || null);
    pruefe(Boolean(neu), "Das neue Turnier kam nicht an.");
    if (neu) {
      pruefe(/^test-cup-ae-[a-km-np-z2-9]{8}$/.test(neu.id), `Der Name des neuen Turniers taugt nicht als Link: ${neu.id}`);
      pruefe(JSON.stringify(neu.spiele) === JSON.stringify(["fishPond", "towerStack"]), `Im neuen Turnier stehen die Spiele ${neu.spiele.join(", ")}.`);
      pruefe(neu.versuche === 5 && neu.zaehlt === "summe" && neu.wertung === "prozent" && neu.aufgaben === "gleich"
        && neu.sichtbar === "link" && neu.verdeckt === true && neu.aktiv === true,
        `Die Regeln des neuen Turniers kamen falsch an: ${JSON.stringify(neu)}`);
      pruefe(neu.endeMs - neu.startMs === TAG, `Das neue Turnier dauert ${(neu.endeMs - neu.startMs) / STUNDE} Stunden statt eines Tages.`);
      const meldung = await seite.locator(".adm-turniere > .adm-meldung").innerText();
      pruefe(meldung.includes(`/turnier?t=${neu.id}`), `Nach dem Anlegen steht der Link nicht da: ${meldung}`);
      pruefe(await seite.locator(".adm-turnier h3", { hasText: "Test-Cup Ä" }).count() === 1, "Das neue Turnier steht nicht in der Liste.");
    }

    // Anhalten und löschen.
    await herbst.locator("button", { hasText: "Anhalten" }).click();
    await seite.waitForFunction((id) => window.__miniTurniere.get(id)?.aktiv === false, HERBST, { timeout: 4000 }).catch(() => {});
    pruefe(await seite.evaluate((id) => window.__miniTurniere.get(id)?.aktiv, HERBST) === false, "«Anhalten» hat das Turnier nicht angehalten.");
    await seite.locator(".adm-turnier", { hasText: "Frühlingscup" }).locator("button", { hasText: "Löschen" }).click();
    await seite.waitForFunction(() => ![...window.__miniTurniere.values()].some((t) => t.name === "Frühlingscup"), null, { timeout: 4000 }).catch(() => {});
    pruefe(await seite.evaluate(() => [...window.__miniTurniere.values()].some((t) => t.name === "Frühlingscup")) === false, "«Löschen» hat das Turnier nicht gelöscht.");

    const ohne = await seite.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    pruefe(ohne <= 1, `Der Adminbereich steht mit den Turnieren ${ohne} px über den Rand.`);

    // Abmelden: Der Knopf auf der Startseite verschwindet mit.
    await seite.locator(".adm-kopf button", { hasText: "Abmelden" }).click();
    await seite.waitForSelector(".adm-anmeldung", { timeout: 4000 }).catch(() => {});
    pruefe(await seite.evaluate(() => localStorage.getItem("mini.admin")) === null, "Nach dem Abmelden bleibt das Merkzeichen für den Admin-Knopf stehen.");
    pruefe(fehlerHier.length === 0, `Der Adminbereich mit Turnieren hat sich beschwert – ${fehlerHier.join(" / ")}`);
    await kontext.close();
  }

  // --- 5. Die eigene App -------------------------------------------------------
  // Installierbar ist das nur, wenn drei Dinge zusammenkommen: ein Manifest
  // mit Namen und Bereich, ein Service Worker, der diesen Bereich bedient, und
  // Icons, die es wirklich gibt. Ein Manifest mit einem Tippfehler im scope
  // meldet niemand – der Browser bietet die Installation dann einfach nicht an.
  {
    const kontext = await browser.newContext({ viewport: { width: 420, height: 820 } });
    const seite = await kontext.newPage();
    await seite.route("https://www.gstatic.com/firebasejs/**", (route) => route.fulfill({ contentType: "text/javascript; charset=utf-8", body: "" }));
    await seite.goto(`${BASIS}/`, { waitUntil: "load" });

    const manifest = await seite.evaluate(async () => {
      const link = document.querySelector('link[rel="manifest"]');
      if (!link) return null;
      const antwort = await fetch(link.href);
      return antwort.ok ? antwort.json() : null;
    });
    pruefe(Boolean(manifest), "Das Manifest ist unter seiner Adresse nicht zu holen.");
    if (manifest) {
      pruefe(manifest.scope === "/", `Der Bereich des Manifests ist ${manifest.scope} statt /.`);
      pruefe(manifest.start_url === "/", `Das Manifest startet bei ${manifest.start_url} statt bei /.`);
      pruefe(manifest.short_name === "Mini-Games", `Auf dem Startbildschirm stünde "${manifest.short_name}".`);
      const fehlende = await seite.evaluate(async (icons) => {
        const raus = [];
        for (const icon of icons) {
          const antwort = await fetch(icon.src, { method: "HEAD" });
          if (!antwort.ok) raus.push(`${icon.src} (${antwort.status})`);
        }
        return raus;
      }, manifest.icons || []);
      pruefe(fehlende.length === 0, `Icons aus dem Manifest fehlen: ${fehlende.join(", ")}`);
    }

    const bereich = await seite.evaluate(async () => {
      if (!("serviceWorker" in navigator)) return "ohne Unterstützung";
      const anmeldung = await Promise.race([
        navigator.serviceWorker.ready,
        new Promise((weiter) => setTimeout(() => weiter(null), 10000)),
      ]);
      return anmeldung ? anmeldung.scope : "keiner";
    });
    pruefe(typeof bereich === "string" && /:\d+\/$/.test(bereich),
      `Der Service Worker bedient ${bereich} statt der ganzen Site.`);

    // --- 6. Offline in ein Spiel ---------------------------------------------
    // Die Adresse, die man weitergibt, ist /turmbau; im Zwischenspeicher liegt
    // turmbau.html. Der Zwischenspeicher vergleicht stur Adressen – ohne die
    // Umrechnung im Service Worker fände er nichts, und jeder Weg in ein Spiel
    // endete offline auf der Startseite. Gerade dann ist die installierte App
    // am nötigsten: im Zug, im Flugzeug, im Keller.
    await kontext.setOffline(true);
    await seite.goto(`${BASIS}/turmbau`, { waitUntil: "domcontentloaded" }).catch(() => {});
    const offline = await seite.evaluate(() => ({
      spiel: document.body?.dataset?.spiel || "",
      seite: document.body?.dataset?.page || "",
    })).catch(() => ({ spiel: "", seite: "nichts" }));
    pruefe(offline.spiel === "towerStack",
      `Offline führt /turmbau auf "${offline.seite || "nichts"}" statt ins Spiel – der Service Worker findet die Datei nicht.`);
    await kontext.setOffline(false);
    await kontext.close();
  }
} finally {
  await browser.close();
  halt();
}

if (fehlerAufSeite.length) {
  [...new Set(fehlerAufSeite)].forEach((text) => befunde.push(`Fehler im Browser: ${text}`));
}

console.log(`${geprueft} Prüfungen im Browser.`);
if (befunde.length) {
  console.error(`\n${befunde.length} Befund${befunde.length === 1 ? "" : "e"}:`);
  befunde.forEach((b) => console.error(`  - ${b}`));
  process.exit(1);
}
console.log("Die Mini-Games tun, was sie sollen.");
