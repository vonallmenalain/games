/*
 * Die Mini-Games im Browser: läuft, was hier herausgeschnitten wurde?
 * ---------------------------------------------------------------------------
 * pruefen.mjs liest Dateien. Das hier spielt: Es öffnet jedes Spiel so, wie jemand es öffnet, dem der Link geschickt wurde, und schaut
 * nach, ob eine Bühne dasteht, das Spiel im Vollbild, die Knöpfe oben links
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
const UNSER = /^(cm|mini|tn|kk|ft|bs|tb|br|dr|li|tf|dt|ph|ml|sl|hf|zg|hz|gs|scene|help-voice|sound|confetti)(-|$)/;
const hatRegel = (klasse) => new RegExp(`\\.${klasse.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\w-])`).test(STYLESHEET);
// Klassen ohne eigene Regel – und das ist richtig so. Sie stehen auch in der
// App in keiner:
//   cm-icon-<name>   die Bühne hängt den Namen an jeden Knopf; gestaltet wird
//                    .cm-icon, der Name ist zum Finden da.
//   sound-core …     Teile einer Zeichnung, die Farbe und Strich vom
//                    Elternteil erben.
//   hz-zeiger        der Zeiger des Manometers; wo er steht, schreibt
//                    heizer.js als transform-Attribut ins SVG. Eine Regel
//                    dazu gäbe es nur, damit hier eine steht.
const OHNE_REGEL = new Set(["sound-core", "sound-wave-wide", "rs-prompt-text", "rs-klappe", "hz-zeiger"]);
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

  // Die Geister: die ewigen unter "<spiel>_<spieler>", die der Turniere unter
  // "<turnier>/<spiel>_<spieler>". Wie in den Regeln ersetzt ein schwächerer
  // Lauf keinen besseren, und im Turnier hinterlegt nur, wer dort spielt.
  const GLAGER = "__mini_geister_attrappe";
  let gGemerkt = null;
  try { gGemerkt = JSON.parse(localStorage.getItem(GLAGER) || "null"); } catch { gGemerkt = null; }
  const geisterLager = new Map(Array.isArray(gGemerkt) ? gGemerkt : (window.__miniGeisterAnfang || []));
  const gSichern = () => { try { localStorage.setItem(GLAGER, JSON.stringify([...geisterLager])); } catch {} };
  window.__miniGeister = geisterLager;

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
    meinErgebnis: async (game, spieler) => {
      if (window.__miniOhneNetz) throw new Error("kein Netz");
      const e = eintraege.get(game + "_" + spieler);
      return e ? { ...e } : null;
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

    speichereGeist: async ({ game, spieler, name, punkte, level, bahn }) => {
      const id = game + "_" + spieler;
      const alt = geisterLager.get(id);
      if (alt && alt.punkte > punkte) throw fehler("abgewiesen", "permission-denied");
      geisterLager.set(id, { game, spieler, name, punkte, level, bahn });
      gSichern();
      return { punkte };
    },
    geister: async (game, spieler = [], level = "") => (Array.isArray(spieler) ? spieler : [])
      .map((wer) => geisterLager.get(game + "_" + wer))
      .filter((g) => g && (!level || g.level === level))
      .map((g) => ({ ...g })),
    turnierGeist: async (id, game, spieler) => {
      const g = geisterLager.get(id + "/" + game + "_" + spieler);
      return g ? { ...g } : null;
    },
    speichereTurnierGeist: async (id, { game, spieler, name, punkte, level, bahn }) => {
      const k = id + "/" + game + "_" + spieler;
      const alt = geisterLager.get(k);
      if (alt && alt.level === level && alt.punkte >= punkte) return null;
      if (!tEintraege.get(k)) throw fehler("ohne Versuch", "permission-denied");
      geisterLager.set(k, { game, spieler, name, punkte, level, bahn });
      gSichern();
      return { punkte };
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
          delete: async () => {
            if (sammlung === "miniGeister") { geisterLager.delete(id); gSichern(); return; }
            eintraege.delete(id);
            sichern();
          },
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
    loescheTurnierEintraege: async (id, ids) => {
      (ids || []).forEach((e) => tEintraege.delete(id + "/" + e));
      tSichern();
      return (ids || []).length;
    },
    turnierErgebnisse: async (id, { game = "" } = {}) => [...tEintraege.entries()]
      .filter(([k, e]) => k.startsWith(id + "/") && (!game || e.game === game))
      .map(([, e]) => ({ ...e })),
    meinTurnierEintrag: async (id, { game, spieler }) => {
      const e = tEintraege.get(id + "/" + game + "_" + spieler);
      return e ? { ...e } : null;
    },
    turnierVersuch: async (id, { game, spieler, name, grenze = 0 }) => {
      await langsam();
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
      await langsam();
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
  // Eine langsame Verbindung, wenn die Pruefung sie will: Gelesen und
  // geschrieben wird erst nach der Wartezeit, dann in einem Zug – so wie eine
  // Transaktion in Firestore auch erst am Ende gilt.
  function langsam() { return new Promise((weiter) => setTimeout(weiter, window.__miniLangsam || 0)); }
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
const KOENIG = "koenigscup-test234";
const DAUER = "dauercup-test23456";
const GESCHICK = "geschickcup-test23";
const OHNE_GEGNER = "ohnegegner-test234";
const LEVEL_EINS = "levelcup-test23456";
const OHNE_ENDE = Date.UTC(9999, 11, 31);
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
    // Wer vorne liegt, wartet: König führt in beiden Spielen allein, Leo
    // liegt im Turmbau hinter ihm.
    turnierVorlage(KOENIG, { name: "Königscup", sichtbar: "link", startMs: JETZT - 30 * MINUTE, spiele: ["towerStack", "fishPond"], versuche: 0, spitzeWartet: true }),
    // Ohne Zeitlimite: das Ende, das nie kommt (turnier.js, OHNE_ENDE).
    turnierVorlage(DAUER, { name: "Dauercup", sichtbar: "link", startMs: JETZT - 20 * MINUTE, endeMs: OHNE_ENDE }),
    // Die drei Geschicklichkeitsspiele, die ihre Welt aus dem Zufall bauen.
    turnierVorlage(GESCHICK, { name: "Geschickcup", sichtbar: "link", startMs: JETZT - 10 * MINUTE, spiele: ["bridgeBuilder", "dartWheel", "vineSwing", "tunnelFlight", "driftRace", "planetHop", "moonLander", "gravityRun", "hillGlide"], versuche: 0 }),
    // Ohne Gegner beim Spielen (geist.js).
    turnierVorlage(OHNE_GEGNER, { name: "Stillcup", sichtbar: "link", startMs: JETZT - 5 * MINUTE, spiele: ["towerStack"], versuche: 0, ohneGeist: true }),
    // Gleiches Level wie Platz 1: jeder Versuch ist der erste (turnier.js).
    turnierVorlage(LEVEL_EINS, { name: "Levelcup", sichtbar: "link", startMs: JETZT - 5 * MINUTE, spiele: ["numberLine"], versuche: 0, aufgaben: "wieErster" }),
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
    { turnier: KOENIG, game: "towerStack", spieler: "mini_koenigkoenig", name: "König", punkte: 30, versuche: 3, offen: false, updatedAtMs: 1000 },
    { turnier: KOENIG, game: "towerStack", spieler: "mini_leoleoleoleo", name: "Leo", punkte: 20, versuche: 1, offen: false, updatedAtMs: 1100 },
    { turnier: KOENIG, game: "fishPond", spieler: "mini_koenigkoenig", name: "König", punkte: 9, versuche: 1, offen: false, updatedAtMs: 1200 },
    { turnier: LEVEL_EINS, game: "numberLine", spieler: "mini_levellevellevel", name: "Lea", punkte: 4, versuche: 4, offen: false, updatedAtMs: 1000 },
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

// Ins Spiel im Turnier. Wer schon einen Namen hat, kommt ohne Tafel hinein;
// sonst fragt sie danach, und nur danach.
async function turnierLos(seite, name) {
  await seite.waitForFunction(() => window.LernappTurnier?.stand?.().freigegeben || document.querySelector(".tn-tor .tn-los"),
    null, { timeout: 8000 });
  if (await seite.locator(".tn-tor .tn-los").count()) {
    await seite.locator(".tn-tor .mini-namensfeld input").fill(name);
    await seite.click(".tn-tor .tn-los");
  }
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
      // Die Fläche des Spiels, wo es eine hat: Leinwand, Teich, Wasser.
      const flaeche = kasten(document.querySelector(".tb-feld, .br-feld, .dr-feld, .li-feld, .tf-feld, .ft-pond, .bs-wasser"));
      const sprecher = kasten(document.querySelector(".help-voice-button"));
      return {
        hoch: window.innerHeight,
        breit: window.innerWidth,
        blattHoch: document.documentElement.scrollHeight,
        blattBreit: document.documentElement.scrollWidth,
        buehne: buehne && { b: Math.round(buehne.width), h: Math.round(buehne.height) },
        play: play && { b: Math.round(play.width), h: Math.round(play.height) },
        barHoch: bar ? Math.round(bar.height) : null,
        scene: Boolean(document.querySelector(".scene")),
        flaeche: flaeche && { l: Math.round(flaeche.left), r: Math.round(flaeche.right), o: Math.round(flaeche.top), u: Math.round(flaeche.bottom), radius: getComputedStyle(document.querySelector(".tb-feld, .br-feld, .dr-feld, .li-feld, .tf-feld, .ft-pond, .bs-wasser")).borderTopLeftRadius },
        grund: getComputedStyle(document.getElementById(id)).backgroundColor,
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
    // Vollbild: keine Landschaft aus der App mehr, die Bühne hat ihren eigenen
    // Grund – und wo ein Spiel eine Fläche hat, reicht sie ohne runde Ecken
    // bis an den unteren Rand und so breit, wie es geht: bis an beide Ränder,
    // oder – wo die Welt eines Spiels endet (32 zu 15) – mittig, so breit
    // wie diese Welt.
    pruefe(!stand.scene, `${spiel.seite}: Hinter dem Spiel steht noch die Landschaft aus der App.`);
    pruefe(stand.grund && stand.grund !== "rgba(0, 0, 0, 0)", `${spiel.seite}: Die Bühne hat keinen eigenen Grund (${stand.grund}).`);
    if (stand.flaeche) {
      const f = stand.flaeche;
      const soll = Math.min(stand.breit, Math.floor((f.u - f.o) * 32 / 15));
      pruefe(f.u >= stand.hoch - 1 && f.radius === "0px" && f.r - f.l >= soll && Math.abs(f.l - (stand.breit - f.r)) <= 1,
        `${spiel.seite}: Die Spielfläche steht nicht im Vollbild: ${JSON.stringify(f)} bei ${stand.breit} × ${stand.hoch}.`);
    }
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

    // Oben rechts: Vollbild, auch ohne die App zu installieren – und zurück.
    pruefe(await seite.locator(".cm-vollbild").count() === 1, "Oben rechts fehlt der Knopf fürs Vollbild.");
    if (await seite.locator(".cm-vollbild").count()) {
      await seite.click(".cm-vollbild");
      await seite.waitForFunction(() => Boolean(document.fullscreenElement) && document.querySelector(".cm-vollbild").getAttribute("aria-pressed") === "true",
        null, { timeout: 3000 }).catch(() => {});
      const an = await seite.evaluate(() => ({ voll: Boolean(document.fullscreenElement), gedrueckt: document.querySelector(".cm-vollbild").getAttribute("aria-pressed") }));
      pruefe(an.voll && an.gedrueckt === "true", `Der Knopf fürs Vollbild bringt kein Vollbild: ${JSON.stringify(an)}`);
      await seite.click(".cm-vollbild");
      await seite.waitForFunction(() => !document.fullscreenElement, null, { timeout: 3000 }).catch(() => {});
      pruefe(await seite.evaluate(() => !document.fullscreenElement), "Aus dem Vollbild kommt man mit dem Knopf nicht mehr heraus.");
    }

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

    // Namen ändern gilt nur für die Runden, die kommen: Was in der Liste
    // steht, bleibt beim alten Namen, und es wird keine Runde daraus. Das
    // Gerät spielt danach als neuer Mitspieler – mit eigener Kennung und
    // ohne die alten Bestwerte.
    const vorher = await seite.evaluate(() => ({ id: localStorage.getItem("mini.id"), best: localStorage.getItem("mini.best") }));
    await seite.click(".mini-name-steht button");
    await seite.waitForSelector(".mini-wer .mini-namensfeld input", { timeout: 4000 });
    await seite.fill(".mini-wer .mini-namensfeld input", "Testkind Zwei");
    await seite.click(".mini-wer .mini-namensfeld button[type=submit]");
    await seite.waitForSelector(".mini-wer-hinweis", { timeout: 4000 });
    const nach = await seite.evaluate((alt) => {
      const meine = [...window.__miniEintraege.values()].filter((e) => e.spieler === alt);
      return {
        meine,
        hinweis: document.querySelector(".mini-wer-hinweis")?.textContent || "",
        id: localStorage.getItem("mini.id"),
        name: localStorage.getItem("mini.name"),
        best: localStorage.getItem("mini.best"),
        umbenannt: window.__miniUmbenannt || null,
      };
    }, vorher.id);
    const turm = nach.meine.find((e) => e.game === "towerStack");
    const teich = nach.meine.find((e) => e.game === "fishPond");
    pruefe(turm?.name === "Testkind" && teich?.name === "Testkind",
      `Namen ändern hat alte Einträge umbenannt: ${turm?.name} / ${teich?.name}`);
    pruefe(turm?.versuche === 2 && teich?.versuche === 1, `Namen ändern hat eine Runde erfunden: ${turm?.versuche} / ${teich?.versuche}`);
    pruefe(!nach.umbenannt, `Namen ändern hat trotzdem umbenannt: ${JSON.stringify(nach.umbenannt)}`);
    pruefe(nach.name === "Testkind Zwei" && /nächsten Runde/.test(nach.hinweis), `Nach dem Ändern steht: ${nach.name} · ${nach.hinweis}`);
    pruefe(/^mini_[A-Za-z0-9_-]{8,48}$/.test(nach.id || "") && nach.id !== vorher.id, "Mit dem neuen Namen spielt das Gerät nicht als neuer Mitspieler.");
    pruefe(nach.best === "{}", `Der neue Mitspieler hat die Bestwerte des alten: ${nach.best}`);

    // Die nächste Runde steht unter dem neuen Namen, der alte Eintrag bleibt.
    await seite.reload({ waitUntil: "load" });
    await seite.waitForSelector(".cm-bar", { timeout: 8000 });
    pruefe(await spieleTurmbauZuEnde(seite), "Die Runde mit dem neuen Namen kam zu keinem Ergebnis.");
    await seite.waitForSelector(".mini-ergebnis .mini-zeile", { timeout: 6000 });
    const zwei = await seite.evaluate(() => [...window.__miniEintraege.values()].filter((e) => e.game === "towerStack").map((e) => e.name));
    pruefe(zwei.includes("Testkind") && zwei.includes("Testkind Zwei"), `Nach der Runde mit neuem Namen stehen im Turmbau: ${zwei.join(", ")}`);

    // Zurück zum alten Namen – anders geschrieben – ist wieder der alte
    // Mitspieler, mit seiner Kennung und seinen Bestwerten.
    await seite.click(".mini-name-steht button");
    await seite.waitForSelector(".mini-wer .mini-namensfeld input", { timeout: 4000 });
    await seite.fill(".mini-wer .mini-namensfeld input", "testkind");
    await seite.click(".mini-wer .mini-namensfeld button[type=submit]");
    await seite.waitForSelector(".mini-wer-hinweis", { timeout: 4000 });
    const zurueck = await seite.evaluate(() => ({
      id: localStorage.getItem("mini.id"),
      best: localStorage.getItem("mini.best"),
      hinweis: document.querySelector(".mini-wer-hinweis")?.textContent || "",
    }));
    pruefe(zurueck.id === vorher.id && zurueck.best === vorher.best, `Zurück beim alten Namen ist das Gerät nicht wieder der alte Mitspieler: ${JSON.stringify(zurueck)}`);
    pruefe(/Willkommen zurück/.test(zurueck.hinweis), `Zurück beim alten Namen steht: ${zurueck.hinweis}`);
    await kontext.close();
  }

  // --- 2b. Was der Admin löscht, bleibt gelöscht ---------------------------------
  // Das Gerät merkt sich den eigenen Bestwert und den besten Lauf. Steht der
  // Eintrag nicht mehr auf dem Server, gilt auch auf dem Gerät nichts mehr
  // davon: keine Bestmarke mit der alten Zahl, kein "Bestwert" im Spiel. Ein
  // anderes Spiel bleibt, wie es war. Und wer im Adminbereich löscht, nimmt
  // den Geist gleich mit.
  {
    const { kontext, seite } = await neueSeite();
    await seite.addInitScript(() => {
      if (sessionStorage.getItem("__geloescht")) return;
      sessionStorage.setItem("__geloescht", "1");
      localStorage.setItem("mini.id", "mini_geloeschtgeloescht");
      localStorage.setItem("mini.name", "Alain");
      localStorage.setItem("mini.best", JSON.stringify({ gravityRun: 10234, towerStack: 5 }));
      localStorage.setItem("mini.lauf", JSON.stringify({ gravityRun: { punkte: 10234, bahn: "", level: "t1", ms: 1 } }));
    });
    await seite.goto(`${BASIS}/schwerkraft`, { waitUntil: "load" });
    await seite.waitForFunction(() => window.LernappMini?.bestwertAbgeglichen?.("gravityRun"), null, { timeout: 6000 }).catch(() => {});
    await seite.waitForTimeout(300);
    const stand = await seite.evaluate(() => ({
      best: JSON.parse(localStorage.getItem("mini.best") || "{}"),
      lauf: JSON.parse(localStorage.getItem("mini.lauf") || "{}"),
      chip: document.querySelector(".gs-eigen")?.textContent || "",
    }));
    pruefe(!stand.best.gravityRun, `Ein gelöschter Eintrag steht auf dem Gerät noch als Bestwert: ${JSON.stringify(stand.best)}`);
    pruefe(stand.best.towerStack === 5, `Der Abgleich hat den Bestwert eines anderen Spiels angefasst: ${JSON.stringify(stand.best)}`);
    pruefe(!stand.lauf.gravityRun, `Der beste Lauf eines gelöschten Eintrags steht noch auf dem Gerät: ${JSON.stringify(stand.lauf)}`);
    pruefe(!stand.chip.includes("10234") && !stand.chip.includes("10 234") && !stand.chip.includes("10’234"), `Die Bestmarke zeigt noch die gelöschte Zahl: ${stand.chip}`);
    // Eine Runde danach: Der Bestwert ist der neue, nicht der alte.
    const runde = await seite.evaluate(async () => {
      const S = window.LernappSchwerkraft;
      S.tippen();
      for (let n = 0; n < 240 * 20 && S.state.schritt === "lauf"; n += 1) S.takt(1 / 240);
      await new Promise((r) => setTimeout(r, 1800));
      return {
        best: JSON.parse(localStorage.getItem("mini.best") || "{}").gravityRun || 0,
        meter: S.state.punkte,
        detail: document.querySelector(".cm-result-detail")?.textContent || "",
      };
    });
    pruefe(runde.best === runde.meter && !/10.?234/.test(runde.detail), `Nach der Runde steht als Bestwert ${runde.best} (${runde.detail}) statt ${runde.meter}.`);
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
    pruefe(await seite.locator(".mini-wer-oben .mini-name-steht button").count() === 1, "Auf der Startseite fehlt «Namen ändern».");
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
    // Die häufigste Breite auf Android – mit dem Vollbild-Knopf der engste
    // Fall, in dem er noch dasteht.
    ["Handy hoch Android", { width: 360, height: 740 }],
    ["Handy hoch schmal", { width: 320, height: 568 }],
  ]) {
    const { kontext, seite } = await neueSeite(viewport);
    await seite.goto(`${BASIS}/turmbau`, { waitUntil: "load" });
    await seite.waitForSelector(".cm-bar-left .mini-knopf", { timeout: 8000 });
    await seite.waitForTimeout(300);
    const befund = await seite.evaluate(() => {
      // Der Zähler so breit, wie er mitten in einer guten Runde wird.
      document.querySelector(".cm-count-value").textContent = "123";
      const stuecke = [
        ...[...document.querySelectorAll(".cm-bar-left > *")].map((e) => ({ was: (e.textContent || "Neustart").trim() || "Neustart", r: e.getBoundingClientRect() })),
        { was: "Zähler", r: document.querySelector(".cm-count").getBoundingClientRect() },
        { was: "Lautsprecher", r: document.querySelector(".help-voice-button")?.getBoundingClientRect() },
        { was: "Vollbild", r: document.querySelector(".cm-vollbild")?.getBoundingClientRect() },
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
    // Ein Turnier nur mit Link, das dieses Gerät geöffnet hat, steht danach
    // auf seiner Startseite – zuvorderst. Eines, das es nicht mehr gibt, wird
    // vergessen. Und die Turnierseite legt sich als eigene App auf den
    // Startbildschirm: mit dem Namen des Turniers, direkt auf seiner Seite.
    const { kontext, seite } = await mitTurnieren("/turnier?t=familie-geheim2345", {
      vorher: () => { if (!localStorage.getItem("mini.turniere")) localStorage.setItem("mini.turniere", JSON.stringify(["gibtsnicht-123456"])); },
    });
    await seite.waitForSelector(".tn-karte", { timeout: 8000 });
    await seite.waitForFunction(() => document.querySelector('link[rel="manifest"]')?.href.startsWith("blob:"), null, { timeout: 4000 }).catch(() => {});
    const app = await seite.evaluate(async () => {
      const link = document.querySelector('link[rel="manifest"]').href;
      const manifest = link.startsWith("blob:") ? await (await fetch(link)).json() : null;
      return {
        link,
        name: manifest?.name,
        start: manifest?.start_url,
        id: manifest?.id,
        icon: manifest?.icons?.[0]?.src,
        apple: document.querySelector('meta[name="apple-mobile-web-app-title"]')?.content,
      };
    });
    pruefe(app.name === "Familienabend" && app.apple === "Familienabend", `Auf den Startbildschirm käme das Turnier nicht mit seinem Namen: ${JSON.stringify(app)}`);
    pruefe(/^https?:\/\/[^/]+\/turnier\?t=familie-geheim2345$/.test(app.start || "") && app.id === app.start,
      `Das Turnier als App startet nicht auf seiner Seite: ${JSON.stringify(app)}`);
    pruefe(/^https?:\/\//.test(app.icon || ""), `Im Manifest des Turniers steht das Bild ohne volle Adresse: ${app.icon}`);
    await seite.goto(`${BASIS}/`, { waitUntil: "load" });
    await seite.waitForSelector(".tn-hinweis", { timeout: 8000 });
    await seite.waitForTimeout(300);
    const hinweise = await seite.locator(".tn-hinweis").evaluateAll((alle) => alle.map((a) => a.innerText.replace(/\n/g, " ")));
    pruefe(/Familienabend/.test(hinweise[0] || ""), `Das geöffnete Turnier nur mit Link steht nicht zuvorderst auf der Startseite: ${hinweise.join(" | ")}`);
    pruefe(hinweise.length === 4, `Mit einem eigenen Turnier stehen ${hinweise.length} statt vier Turniere auf der Startseite: ${hinweise.join(" | ")}`);
    const gemerkt = await seite.evaluate(() => JSON.parse(localStorage.getItem("mini.turniere") || "[]"));
    pruefe(gemerkt.length === 1 && gemerkt[0] === "familie-geheim2345", `Das Gerät merkt sich die falschen Turniere: ${JSON.stringify(gemerkt)}`);
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
      regeln: document.querySelectorAll(".tn-regel-liste, .tn-regeln").length,
      teilen: document.querySelectorAll(".tn-teilen, .tn-link-feld").length,
      kartenZusatz: [...document.querySelectorAll(".tn-karte .tn-mein, .tn-karte .mini-karte-zahl")].map((e) => e.textContent),
      hinaus: [...document.querySelectorAll("[data-turnier] a")].map((a) => a.getAttribute("href")).filter((h) => !/^\/(turnier|admin)\b/.test(h) && !/[?&]turnier=/.test(h)),
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
    // Keine Regeln in Sätzen und kein Block zum Weitersagen: Dauer und
    // Versuche stehen oben, den Link hat der Adminbereich. Und kein Weg
    // hinaus – das Turnier ist ein Raum für sich.
    pruefe(stand.regeln === 0, `${lage}: Auf der Turnierseite steht wieder ein Block mit Regeln.`);
    pruefe(stand.teilen === 0, `${lage}: Auf der Turnierseite steht wieder der Block zum Weitersagen.`);
    // Je Spiel: Name, Rangliste, Knopf. Kein Satz über den eigenen Stand.
    pruefe(stand.kartenZusatz.length === 0, `${lage}: Auf den Karten der Turnierseite steht mehr als Name, Liste und Knopf: ${stand.kartenZusatz.join(" / ")}`);
    pruefe(stand.hinaus.length === 0, `${lage}: Von der Turnierseite führt ein Weg hinaus: ${stand.hinaus.join(", ")}`);
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
  // Name, zwei Versuche, dann ist Schluss. Jeder Versuch geht ins Turnier und
  // in die ewige Liste, und nach dem letzten gibt es keinen mehr.
  {
    const { kontext, seite } = await mitTurnieren(`/turmbau?turnier=${HERBST}`);
    const vorher = fehlerAufSeite.length;
    await seite.waitForSelector(".tn-tor .tn-los", { timeout: 8000 });
    // Ohne Namen steht nur die Frage danach da – keine Regeln, kein Versuch,
    // keine Uhr.
    const tafel = (await seite.locator(".tn-tor").innerText()).replace(/\n/g, " ");
    pruefe(/Namen/.test(tafel) && !/Versuch|zählt|Herbstcup/.test(tafel), `Ohne Namen steht mehr da als die Frage danach: ${tafel}`);
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
        nochmal: Boolean(document.querySelector(".cm-actions .cm-icon-again:not([hidden])")),
        liste: Boolean(document.querySelector(".tn-ergebnis .mini-liste")),
      };
    }, HERBST);
    // Das Ergebnis ist da, wenn die Liste steht – und der Knopf "Noch einmal"
    // entschieden ist.
    const ergebnisDa = () => seite.waitForFunction(() => document.querySelector(".tn-ergebnis .mini-liste"), null, { timeout: 6000 })
      .then(() => seite.waitForTimeout(150)).catch(() => {});

    pruefe(await spieleZuEnde(seite), "Der erste Turnierversuch kam zu keinem Ergebnis.");
    await ergebnisDa();
    const eins = await eintrag();
    pruefe(eins.turnier?.versuche === 1 && eins.turnier?.offen === false, `Nach dem ersten Versuch steht im Turnier: ${JSON.stringify(eins.turnier)}`);
    pruefe(eins.turnier?.punkte === eins.punkte, `Im Turnier stehen ${eins.turnier?.punkte} statt ${eins.punkte}.`);
    pruefe(eins.turnier?.name === "Turnierkind", `Im Turnier steht der Name "${eins.turnier?.name}".`);
    pruefe(eins.ewig?.punkte === eins.punkte, "Die Runde im Turnier fehlt in der ewigen Liste.");
    pruefe(eins.nochmal, "Nach dem ersten von zwei Versuchen fehlt «Noch einmal».");
    pruefe(eins.liste && /Grosi/.test(eins.text), `Unter dem Ergebnis fehlt die Rangliste des Turniers: ${eins.text}`);
    // Und sonst nichts: kein Name des Turniers, kein «Eingetragen», kein Platz
    // in Worten, keine übrigen Versuche.
    pruefe(!/Herbstcup|Eingetragen|im Turnier|Versuch/.test(eins.text), `Unter dem Ergebnis im Turnier steht mehr als die Liste: ${eins.text}`);
    pruefe(eins.pokal === `/turnier?t=${HERBST}`, `Der Pokal unter dem Ergebnis führt nach ${eins.pokal} statt zum Turnier.`);
    const ohneImErgebnis = await klassenOhneRegel(seite);
    pruefe(ohneImErgebnis.length === 0, `Ergebnis im Turnier – Klassen ohne Regel: ${ohneImErgebnis.join(", ")}`);

    // Der zweite Versuch beginnt ohne Tafel – und würfelt als zweiter.
    await seite.click(".cm-actions .cm-icon-again");
    pruefe(await seite.locator(".tn-tor").count() === 0, "Vor dem zweiten Versuch steht wieder die Tafel.");
    const runde = await seite.evaluate(() => window.LernappZufall?.turnier?.()?.runde);
    pruefe(runde === "2", `Der zweite Versuch würfelt als Runde ${runde} statt 2.`);
    pruefe(await spieleZuEnde(seite), "Der zweite Turnierversuch kam zu keinem Ergebnis.");
    await ergebnisDa();
    const zwei = await eintrag();
    pruefe(zwei.turnier?.versuche === 2 && zwei.turnier?.offen === false, `Nach dem zweiten Versuch steht im Turnier: ${JSON.stringify(zwei.turnier)}`);
    pruefe(zwei.turnier?.punkte === Math.max(eins.punkte, zwei.punkte), `Es zählt nicht der bessere Versuch: ${zwei.turnier?.punkte} bei ${eins.punkte} und ${zwei.punkte}.`);
    // Einen dritten gibt es nicht: kein «Noch einmal», nur der Weg zurück
    // zum Turnier.
    pruefe(!zwei.nochmal, "Nach dem letzten Versuch steht noch «Noch einmal» da.");
    pruefe(zwei.pokal === `/turnier?t=${HERBST}`, `Nach dem letzten Versuch führt der Pokal nach ${zwei.pokal}.`);
    pruefe(fehlerAufSeite.length === vorher, `Das Turnier hat sich beschwert – ${fehlerAufSeite.slice(vorher).join(" / ")}`);
    await kontext.close();
  }
  {
    // Wer schon einen Namen hat, sieht vor dem Spiel gar nichts: Das Turnier
    // lädt leise, und das Spiel steht da – bereit, nicht schon gestartet.
    const { kontext, seite } = await mitTurnieren(`/turmbau?turnier=${HERBST}`, { vorher: () => {
      localStorage.setItem("mini.name", "Schnell");
      window.__tafelTexte = [];
      new MutationObserver(() => {
        const tafel = document.querySelector(".tn-tor:not(.ist-leise) .tn-tafel");
        if (tafel?.textContent) window.__tafelTexte.push(tafel.textContent);
      }).observe(document, { childList: true, subtree: true, attributes: true });
    } });
    await seite.waitForFunction(() => window.LernappTurnier?.stand?.().freigegeben, null, { timeout: 8000 }).catch(() => {});
    const befund = await seite.evaluate(() => ({
      frei: window.LernappTurnier.stand().freigegeben,
      tor: Boolean(document.querySelector(".tn-tor")),
      texte: window.__tafelTexte,
      phase: window.LernappTurmbau?.state?.phase,
      runde: window.LernappZufall?.turnier?.()?.runde,
    }));
    pruefe(befund.frei && !befund.tor, `Mit Namen geht es im Turnier nicht direkt ins Spiel: ${JSON.stringify(befund)}`);
    pruefe(befund.texte.length === 0, `Mit Namen stand vor dem Spiel trotzdem eine Tafel: ${befund.texte[0]}`);
    pruefe(befund.phase === "bereit", `Ohne Tafel ist die Runde schon losgelaufen (${befund.phase}).`);
    pruefe(befund.runde === "1", `Ohne Tafel würfelt der erste Versuch als Runde ${befund.runde}.`);
    pruefe(await seite.evaluate(() => window.LernappTurnier.stand().gespielt) === 0, "Ohne Tafel zählt schon ein Versuch, bevor gespielt wurde.");
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

  // --- 4f2. Gleich noch einmal, bei langsamer Verbindung ---------------------------
  // Das Ergebnis eines Versuchs muss draussen sein, bevor der nächste
  // angemeldet wird. Sonst überholt die neue Anmeldung das alte Ergebnis, das
  // schliesst dann den neuen Versuch, und dessen Ergebnis käme nie an.
  {
    const { kontext, seite } = await mitTurnieren(`/turmbau?turnier=${HERBST}`, { vorher: () => { window.__miniLangsam = 400; } });
    await turnierLos(seite, "Eilig");
    const befund = await seite.evaluate(async (id) => {
      const turnier = window.LernappTurnier;
      turnier.rundeBeginnt();
      turnier.ergebnis({ punkte: 5 });
      turnier.neuStart({ los: () => {} });
      turnier.rundeBeginnt();
      const zweiter = turnier.ergebnis({ punkte: 7 });
      await new Promise((weiter) => setTimeout(weiter, 3000));
      const ich = localStorage.getItem("mini.id");
      return { eintrag: window.__miniTurnierEintraege.get(`${id}/towerStack_${ich}`) || null, text: zweiter.textContent };
    }, HERBST);
    pruefe(befund.eintrag?.versuche === 2 && befund.eintrag?.offen === false && befund.eintrag?.punkte === 7,
      `Zwei Versuche kurz nacheinander kamen durcheinander an: ${JSON.stringify(befund.eintrag)}`);
    pruefe(!/Eingetragen|Versuch/.test(befund.text), `Der zweite von zwei schnellen Versuchen meldet mehr als die Liste: ${befund.text}`);
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
    // Gleiches Level wie Platz 1: Auch wer schon viermal gespielt hat, spielt
    // wieder den ersten Lauf – den, auf dem alle spielen.
    const { kontext, seite } = await mitTurnieren(`/zahlengleis?turnier=${LEVEL_EINS}`, { vorher: () => {
      localStorage.setItem("mini.id", "mini_levellevellevel");
      localStorage.setItem("mini.name", "Lea");
    } });
    await turnierLos(seite, "Lea");
    await seite.waitForFunction(() => Boolean(window.LernappZahlengleis?.state?.zahl), null, { timeout: 4000 }).catch(() => {});
    const befund = await seite.evaluate(() => {
      const z = window.LernappZufall.fuer("numberLine");
      z.neu();
      const { bis } = window.LernappZahlengleis.gleisFuer(0);
      const moeglich = [];
      for (let n = 1; n < bis; n += 1) moeglich.push(n);
      const stand = window.LernappTurnier.stand();
      return {
        gespielt: stand.gespielt,
        wie: `freigegeben ${stand.freigegeben}, läuft ${stand.laeuft}, Versuche in der Datenbank ${[...window.__miniTurnierEintraege.values()].find((e) => e.spieler === "mini_levellevellevel")?.versuche}, Zeit ${Math.round(performance.now())} ms`,
        fest: window.LernappZufall.istFest(),
        runde: window.LernappZufall.turnier()?.runde,
        zahl: window.LernappZahlengleis.state.zahl,
        erwartet: moeglich[z.ganz(moeglich.length)],
      };
    });
    // Das Zahlengleis beginnt seine Runde sofort: Gespielt wird der fünfte.
    pruefe(befund.gespielt === 5, `Im Levelcup läuft der ${befund.gespielt}. statt der fünfte Versuch (${befund.wie}).`);
    pruefe(befund.fest && befund.runde === "1", `Mit gleichem Level wie Platz 1 würfelt der fünfte Versuch als Runde ${befund.runde} (fest: ${befund.fest}).`);
    pruefe(befund.zahl === befund.erwartet, `Mit gleichem Level wie Platz 1 kommt eine andere Zahl (${befund.zahl} statt ${befund.erwartet}).`);
    await kontext.close();
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

  // --- 4g2. Die Geschicklichkeitsspiele: derselbe Lauf -----------------------------
  // Diese bauen ihre Welt aus dem Zufall – Pfeiler, Scheiben, Äste. Im
  // Turnier bekommen zwei Spieler im selben Versuch dieselbe Welt.
  for (const [adresse, titel, lies] of [
    ["/bruecke", "Brückenbauer", () => {
      const b = window.LernappBruecke;
      const reihe = [b.state.pfeiler[1]];
      for (let n = 1; n < 4; n += 1) reihe.push(b.neuerPfeiler(n, reihe[reihe.length - 1]));
      return reihe.map((q) => `${q.x.toFixed(3)}/${q.w.toFixed(3)}`).join(" ");
    }],
    ["/drehscheibe", "Drehscheibe", () => {
      const d = window.LernappDrehscheibe;
      const reihe = [d.state.scheibe, d.neueScheibe(1), d.neueScheibe(2), d.neueScheibe(3)];
      return reihe.map((q) => `${q.art}/${q.tempo.toFixed(4)}/${q.stecken.map((p) => p.w.toFixed(4))}/${q.aepfel.map((a) => a.w.toFixed(4))}`).join(" ");
    }],
    ["/liane", "Lianenschwung", () => {
      const l = window.LernappLiane;
      const aeste = l.state.anker.slice(0, 4).map((a) => `${a.x.toFixed(3)}/${a.y.toFixed(3)}`);
      const bananen = l.state.anker.map((a, i) => (a.bananen ? i : -1)).filter((i) => i >= 0).join(",");
      return `${aeste.join(" ")} | ${bananen}`;
    }],
    ["/tunnelflug", "Tunnelflug", () => {
      const T = window.LernappTunnelflug;
      T.tunnelBis(4000);
      return T.state.tunnel.punkte.slice(0, 180).map((p) => `${p.oben.toFixed(3)}/${p.unten.toFixed(3)}`).join(" ");
    }],
    ["/drift", "Drift-Rennen", () => {
      const D = window.LernappDrift;
      D.bahnBis(6000);
      return D.state.bahn.kurven.slice(0, 10).map((k) => `${k.px.toFixed(2)}/${k.py.toFixed(2)}/${k.R.toFixed(2)}/${k.sig}`).join(" ");
    }],
    ["/planeten", "Planetenhüpfer", () => {
      const P = window.LernappPlaneten;
      P.planetenBis(14);
      return P.state.planeten.slice(0, 14).map((p) => `${p.x.toFixed(2)}/${p.y.toFixed(2)}/${p.r.toFixed(2)}/${p.luft.toFixed(2)}/${p.bahn ? p.bahn.amp.toFixed(2) : "-"}/${p.mond ? p.mond.bahnR.toFixed(2) : "-"}`).join(" ");
    }],
    ["/mondlandung", "Mondlandung", () => {
      const M = window.LernappMondlandung;
      M.bodenBei(3000);
      return M.state.platten.slice(0, 6).map((p) => `${p.x0.toFixed(2)}/${p.x1.toFixed(2)}/${p.y.toFixed(2)}`).join(" ")
        + ` | ${[500, 900, 1500, 2200].map((x) => M.bodenBei(x).toFixed(2)).join(" ")}`;
    }],
    ["/schwerkraft", "Schwerkraft-Läufer", () => {
      const S = window.LernappSchwerkraft;
      S.korridorBis(6000);
      const bahn = (n) => S.state.bahnen[n].slice(0, 16).map((t) => `${t.x0.toFixed(1)}-${t.x1.toFixed(1)}:${t.art}`).join(",");
      return `${bahn(0)} | ${bahn(1)} | ${S.state.bloecke.slice(0, 6).map((b) => `${b.x0.toFixed(1)}/${b.bahn}`).join(",")} | ${S.state.stege.slice(0, 4).map((t) => `${t.x0.toFixed(1)}-${t.x1.toFixed(1)}:${t.oben}/${t.unten}`).join(",")}`;
    }],
    ["/huegel", "Hügelflieger", () => {
      const H = window.LernappHuegel;
      H.bodenBei(6000);
      return H.state.huegel.slice(0, 24).map((p) => `${p.x.toFixed(2)}/${p.y.toFixed(2)}`).join(" ");
    }],
  ]) {
    const befunde3 = [];
    for (const name of ["Anna", "Ben"]) {
      const { kontext, seite } = await mitTurnieren(`${adresse}?turnier=${GESCHICK}`);
      await turnierLos(seite, name);
      await seite.waitForTimeout(250);
      befunde3.push({
        fest: await seite.evaluate(() => window.LernappZufall.istFest()),
        welt: await seite.evaluate(lies).catch((f) => `Fehler: ${f.message}`),
      });
      await kontext.close();
    }
    const [a, b] = befunde3;
    pruefe(a.fest && b.fest, `${titel}: Im Turnier würfelt der Zufall frei.`);
    pruefe(!/^Fehler/.test(a.welt) && a.welt === b.welt, `${titel}: Zwei Spieler bekommen im ersten Versuch verschiedene Welten – ${a.welt} gegen ${b.welt}.`);
  }

  // --- 4g3. Lianenschwung: die Bananen-Liane ---------------------------------------
  // Keine Bananen mehr in der Luft. Ab und zu hängen sie an einer Liane: Wer
  // von ihr loslässt, wird kräftig nach vorn gestossen – einmal, dann sind
  // sie gegessen. Geschwungen wird an ihr wie an jeder anderen.
  {
    const { kontext, seite } = await neueSeite({ width: 1000, height: 700 });
    await seite.goto(`${BASIS}/liane`, { waitUntil: "load" });
    await seite.waitForFunction(() => window.LernappLiane?.state?.anker?.length, null, { timeout: 8000 });
    const befund = await seite.evaluate(() => {
      const L = window.LernappLiane;
      const st = L.state;
      while (st.anker.length < 40) st.anker.push(L.neuerAnker(st.anker.length, st.anker[st.anker.length - 1]));
      const i = st.anker.findIndex((a) => a.bananen);
      const anzahl = st.anker.filter((a) => a.bananen).length;
      const a = st.anker[i];
      // An die Bananen-Liane hängen, mitten im Schwung nach vorn.
      st.phase = "spiel";
      st.schritt = "schwingen";
      st.haken = i;
      st.seil = 90;
      st.p = { x: a.x - 20, y: a.y - 88, vx: 260, vy: 30 };
      L.druecken();
      L.loslassen();
      const nachher = { vx: st.p.vx, geerntet: a.geerntet, bananen: st.bananen, schritt: st.schritt };
      // Eine gewöhnliche Liane gibt keinen Stoss.
      const j = st.anker.findIndex((b, k) => k > 1 && !b.bananen);
      const b = st.anker[j];
      st.schritt = "schwingen";
      st.haken = j;
      st.p = { x: b.x - 20, y: b.y - 88, vx: 260, vy: 30 };
      L.druecken();
      L.loslassen();
      return { i, anzahl, nachher, gewoehnlich: st.p.vx, fliegt: st.schritt };
    });
    pruefe(befund.i > 1 && befund.anzahl >= 3 && befund.anzahl <= 12, `Unter den ersten 40 Lianen tragen ${befund.anzahl} Bananen (erste bei ${befund.i}).`);
    pruefe(befund.nachher.schritt === "fliegen" && befund.nachher.vx >= 260 + 150 && befund.nachher.geerntet && befund.nachher.bananen === 1,
      `Loslassen von der Bananen-Liane gibt keinen Stoss nach vorn: ${JSON.stringify(befund.nachher)}`);
    pruefe(befund.fliegt === "fliegen" && befund.gewoehnlich === 260, `Eine gewöhnliche Liane gibt beim Loslassen Schwung dazu: ${befund.gewoehnlich}`);
    pruefe(await seite.evaluate(() => !("fruechte" in window.LernappLiane.state)), "Im Lianenschwung hängen noch Bananen frei in der Luft.");
    await kontext.close();
  }

  // --- 4g4. Tunnelflug: immer fliegbar, und eine Wand beendet die Runde --------------
  // Ein Autopilot fliegt mehrere gewürfelte Tunnel bis 2000 m: Wo er nicht
  // durchkommt, verlangt der Tunnel mehr, als das Flugzeug kann. Und wer gar
  // nichts drückt, sinkt auf den Boden – das ist das Ende, mit Ergebnis.
  {
    const { kontext, seite } = await neueSeite({ width: 1000, height: 640 });
    await seite.goto(`${BASIS}/tunnelflug`, { waitUntil: "load" });
    await seite.waitForFunction(() => window.LernappTunnelflug?.state, null, { timeout: 8000 });
    const fluege = await seite.evaluate(() => {
      const T = window.LernappTunnelflug;
      const raus = [];
      for (let lauf = 0; lauf < 4; lauf += 1) {
        document.querySelector(".cm-bar-left .cm-icon-again").click();
        const st = T.state;
        T.druecken();
        T.loslassen();
        let enge = Infinity;
        for (let n = 0; st.schritt === "flug" && st.meter < 2000 && n < 400000; n += 1) {
          const f = st.f;
          const v = T.tempoBei(f.x);
          let ziel = 0;
          for (const d of [10, 25, 45, 70]) {
            const w = T.wandBei(f.x + d * v / 200);
            ziel += (w.oben + w.unten) / 8;   // Mittel der vier Mitten
            enge = Math.min(enge, w.oben - w.unten);
          }
          if (ziel - f.y - f.vy * 0.16 > 0) T.druecken(); else T.loslassen();
          T.takt(1 / 120);
        }
        T.loslassen();
        raus.push({ meter: st.meter, schritt: st.schritt, enge: Math.round(enge) });
      }
      return raus;
    });
    pruefe(fluege.every((f) => f.meter >= 2000 && f.schritt === "flug" && f.enge >= 50),
      `Tunnelflug: Der Autopilot kommt nicht durch jeden Tunnel – ${JSON.stringify(fluege)}`);
    await seite.evaluate(() => document.querySelector(".cm-bar-left .cm-icon-again").click());
    await seite.evaluate(() => { window.LernappTunnelflug.druecken(); window.LernappTunnelflug.loslassen(); });
    await seite.waitForSelector(".cm-result-score", { timeout: 8000 }).catch(() => {});
    const ende = await seite.evaluate(() => ({ zahl: document.querySelector(".cm-result-score")?.textContent, schritt: window.LernappTunnelflug.state.schritt }));
    pruefe(ende.schritt === "crash" && ende.zahl !== undefined, `Tunnelflug: Ohne Schub endet die Runde nicht an der Wand: ${JSON.stringify(ende)}`);
    await kontext.close();
  }

  // --- 4g5. Drift-Rennen: immer fahrbar, und die Leitplanke beendet die Runde ------
  // Ein Autopilot drückt, wenn die Kurve beginnt, und lässt los, wenn der
  // Wagen in die neue Gerade zeigt – auf mehreren gewürfelten Strassen bis
  // 2500 m. Wer nichts drückt, fährt in der ersten Kurve geradeaus in die
  // Leitplanke.
  {
    const { kontext, seite } = await neueSeite({ width: 420, height: 800 });
    await seite.goto(`${BASIS}/drift`, { waitUntil: "load" });
    await seite.waitForFunction(() => window.LernappDrift?.state, null, { timeout: 8000 });
    const fahrten = await seite.evaluate(() => {
      const D = window.LernappDrift;
      const st = D.state;
      const raus = [];
      for (let lauf = 0; lauf < 3; lauf += 1) {
        document.querySelector(".cm-bar-left .cm-icon-again").click();
        D.druecken();
        D.loslassen();
        let fertig = null;
        for (let n = 0; st.schritt === "fahrt" && st.meter < 2500 && n < 300000; n += 1) {
          if (st.dreh) {
            if (D.winkelDiff(st.dreh.kurve.a1, st.auto.a) * st.dreh.sig < 0.004) D.loslassen();
          } else {
            const k = D.aktiveKurve();
            if (k && st.auto.s >= k.s0 && fertig !== k) { fertig = k; D.druecken(); }
          }
          D.takt(1 / 240);
        }
        D.loslassen();
        raus.push({ meter: st.meter, schritt: st.schritt, perfekt: st.perfekt });
      }
      return raus;
    });
    pruefe(fahrten.every((f) => f.meter >= 2500 && f.schritt === "fahrt"),
      `Drift-Rennen: Der Autopilot kommt nicht über jede Strasse – ${JSON.stringify(fahrten)}`);
    pruefe(fahrten.every((f) => f.perfekt > 10), `Drift-Rennen: Genau losgelassen ist nicht «perfekt» – ${JSON.stringify(fahrten)}`);
    await seite.evaluate(() => document.querySelector(".cm-bar-left .cm-icon-again").click());
    await seite.evaluate(() => { window.LernappDrift.druecken(); window.LernappDrift.loslassen(); });
    await seite.waitForSelector(".cm-result-score", { timeout: 12000 }).catch(() => {});
    const ende = await seite.evaluate(() => ({ zahl: document.querySelector(".cm-result-score")?.textContent, schritt: window.LernappDrift.state.schritt }));
    pruefe(ende.schritt === "crash" && ende.zahl !== undefined, `Drift-Rennen: Ohne Lenken endet die Runde nicht an der Leitplanke: ${JSON.stringify(ende)}`);
    await kontext.close();
  }

  // --- 4g6. Planetenhüpfer: jeder Weg ist schaffbar ---------------------------------
  // Er springt senkrecht vom Planeten weg, dorthin, wohin sein Kopf zeigt.
  // Ein vorsichtiger Autopilot rechnet den Sprung voraus und springt nur,
  // wenn er auf dem nächsten Planeten landet, ohne einen Mond zu treffen. Er
  // kommt auf mehreren gewürfelten Wegen über den 30. Planeten, ohne dass der
  // Sauerstoff ausgeht. Wer gar nicht springt, dem geht er aus.
  {
    const { kontext, seite } = await neueSeite({ width: 420, height: 800 });
    await seite.goto(`${BASIS}/planeten`, { waitUntil: "load" });
    await seite.waitForFunction(() => window.LernappPlaneten?.state, null, { timeout: 8000 });
    const wege = await seite.evaluate(() => {
      const P = window.LernappPlaneten;
      const st = P.state;
      const trifft = () => {
        const a = st.astro;
        const tg = P.absprung();
        const v = P.sprungBei(st.erreicht);
        let x = a.x;
        let y = a.y;
        for (let t = 0; t < 2.2; t += 1 / 240) {
          x += (tg.x * v) / 240;
          y += (tg.y * v) / 240;
          const uhr = st.uhr + t;
          for (let i = Math.max(0, st.auf - 1); i <= st.auf + 3; i += 1) {
            const p = st.planeten[i];
            const mond = P.mondBei(p, uhr);
            if (mond && Math.hypot(x - mond.x, y - mond.y) < mond.r + 5) return false;
            if (i === st.auf && t < 0.45) continue;
            const m = P.mitte(p, uhr);
            if (Math.hypot(x - m.x, y - m.y) < p.r + p.luft * 0.6) return i === st.auf + 1;
          }
        }
        return false;
      };
      const raus = [];
      for (let lauf = 0; lauf < 3; lauf += 1) {
        document.querySelector(".cm-bar-left .cm-icon-again").click();
        P.tippen();
        for (let n = 0; st.schritt !== "verloren" && st.erreicht < 30 && n < 200000; n += 1) {
          if (st.schritt === "lauf" && st.zeit - st.schrittZeit > 0.2 && trifft()) P.tippen();
          P.takt(1 / 240);
        }
        raus.push({ erreicht: st.erreicht, punkte: st.punkte, schritt: st.schritt, grund: st.grund });
      }
      return raus;
    });
    pruefe(wege.every((w) => w.erreicht >= 30 && w.schritt !== "verloren"),
      `Planetenhüpfer: Der Autopilot kommt nicht auf jedem Weg weiter – ${JSON.stringify(wege)}`);
    pruefe(wege.every((w) => w.punkte >= w.erreicht * 10 && w.punkte <= w.erreicht * 100),
      `Planetenhüpfer: Ein Sprung bringt nicht zwischen 10 und 100 Punkten – ${JSON.stringify(wege)}`);
    // Wer trödelt, bekommt weniger: derselbe Autopilot, der erst springt,
    // wenn der Sauerstoff unter die Hälfte gesunken ist.
    const troedel = await seite.evaluate(() => {
      const P = window.LernappPlaneten;
      const st = P.state;
      const trifft = () => {
        const a = st.astro;
        const tg = P.absprung();
        const v = P.sprungBei(st.erreicht);
        let x = a.x;
        let y = a.y;
        for (let t = 0; t < 2.2; t += 1 / 240) {
          x += (tg.x * v) / 240;
          y += (tg.y * v) / 240;
          const uhr = st.uhr + t;
          for (let i = Math.max(0, st.auf - 1); i <= st.auf + 3; i += 1) {
            const p = st.planeten[i];
            const mond = P.mondBei(p, uhr);
            if (mond && Math.hypot(x - mond.x, y - mond.y) < mond.r + 5) return false;
            if (i === st.auf && t < 0.45) continue;
            const m = P.mitte(p, uhr);
            if (Math.hypot(x - m.x, y - m.y) < p.r + p.luft * 0.6) return i === st.auf + 1;
          }
        }
        return false;
      };
      document.querySelector(".cm-bar-left .cm-icon-again").click();
      P.tippen();
      for (let n = 0; st.schritt !== "verloren" && st.erreicht < 12 && n < 200000; n += 1) {
        if (st.schritt === "lauf" && st.luft / st.luftMax < 0.5 && trifft()) P.tippen();
        P.takt(1 / 240);
      }
      return { erreicht: st.erreicht, punkte: st.punkte };
    });
    const schnell = wege.reduce((summe, w) => summe + w.punkte / w.erreicht, 0) / wege.length;
    pruefe(troedel.erreicht > 0 && troedel.punkte / troedel.erreicht < schnell - 15,
      `Planetenhüpfer: Wer trödelt, bekommt nicht weniger Punkte je Sprung (${(troedel.punkte / troedel.erreicht).toFixed(1)} gegen ${schnell.toFixed(1)}).`);
    const sprung = await seite.evaluate(() => {
      const P = window.LernappPlaneten;
      const st = P.state;
      const a = P.absprung();
      const weiter = { x: Math.cos(st.theta), y: Math.sin(st.theta) };
      return { gleich: Math.abs(a.x - weiter.x) < 1e-9 && Math.abs(a.y - weiter.y) < 1e-9, weit: P.weiteBei(10) };
    });
    pruefe(sprung.gleich, "Planetenhüpfer: Der Sprung geht nicht senkrecht vom Planeten weg.");
    pruefe(sprung.weit > 0.8, `Planetenhüpfer: Nach zehn Planeten sind die Abstände noch nicht fast so weit, wie sie werden (${sprung.weit}).`);
    await seite.evaluate(() => { document.querySelector(".cm-bar-left .cm-icon-again").click(); window.LernappPlaneten.tippen(); });
    const ohne = await seite.evaluate(() => {
      const P = window.LernappPlaneten;
      for (let n = 0; n < 240 * 12 && P.state.schritt !== "verloren"; n += 1) P.takt(1 / 240);
      return { schritt: P.state.schritt, grund: P.state.grund };
    });
    pruefe(ohne.schritt === "verloren" && ohne.grund === "luft", `Planetenhüpfer: Wer nie springt, dem geht der Sauerstoff nicht aus: ${JSON.stringify(ohne)}`);
    await seite.waitForSelector(".cm-result-score", { timeout: 6000 }).catch(() => {});
    pruefe(await seite.locator(".cm-result-score").count() === 1, "Planetenhüpfer: Ohne Sauerstoff kommt kein Ergebnis.");
    await kontext.close();
  }

  // --- 4g7. Mondlandung: landen, tanken, weiter ---------------------------------------
  // Ein sparsamer Pilot gibt Schub, bis die Bahn ohne weiteren Schub übers
  // Gelände auf die nächste Plattform führt, gleitet und bremst im
  // Leitstrahl so spät wie möglich. Er kommt mit dem Treibstoff, den die
  // Landungen geben, über acht Plattformen. Jede bringt 200 Punkte, jeder
  // Schub kostet welche – sofort, schon vor der ersten Landung. Wer einfach
  // fällt, zerschellt.
  {
    const { kontext, seite } = await neueSeite({ width: 900, height: 640 });
    await seite.goto(`${BASIS}/mondlandung`, { waitUntil: "load" });
    await seite.waitForFunction(() => window.LernappMondlandung?.state, null, { timeout: 8000 });
    const fluege = await seite.evaluate(() => {
      const M = window.LernappMondlandung;
      const st = M.state;
      const pilot = () => {
        const f = st.f;
        if (st.schritt === "gelandet" || st.schritt === "start") { M.schub(true); M.neige(0); return; }
        if (st.schritt !== "flug") { M.schub(false); M.neige(null); return; }
        const p = st.platten[st.auf + 1];
        const mitte = (p.x0 + p.x1) / 2;
        const bremsweg = (v) => (v > 0 ? (v * v) / (2 * (M.SCHUB - M.G)) : 0);
        if (st.strahl) {
          M.neige(0);
          M.schub(-f.vy > 25 && f.y - 13 - p.y < bremsweg(-f.vy) * 1.15 + 4);
          return;
        }
        // Wohin führt die Bahn ohne Schub? Übers Gelände in den Leitstrahl,
        // hoch genug, um dort noch zu bremsen?
        let x = f.x;
        let y = f.y;
        let vx = f.vx;
        let vy = f.vy;
        let gut = false;
        for (let i = 0; i < 600; i += 1) {
          vy -= M.G / 60;
          x += vx / 60;
          y += vy / 60;
          const drueber = x > p.x0 - 18 && x < p.x1 + 18;
          if (!drueber && y - 13 <= M.bodenBei(x) + 10) break;
          if (drueber && vy < 0 && y - 13 - p.y < 160) { gut = y - 13 - p.y > bremsweg(-vy) * 1.3 + 12; break; }
          if (vy < 0 && y - 13 < p.y - 10) break;
        }
        if (gut) { M.neige(0); M.schub(false); return; }
        const r = Math.sign(mitte - f.x) || 1;
        const zuSchnell = Math.sign(f.vx) === r && Math.abs(f.vx) > Math.max(40, Math.abs(mitte - f.x) * 0.9);
        M.neige(zuSchnell ? 0 : r * 0.5);
        M.schub(true);
      };
      const raus = [];
      let schonVorher = null;
      for (let lauf = 0; lauf < 2; lauf += 1) {
        document.querySelector(".cm-bar-left .cm-icon-again").click();
        for (let n = 0; st.schritt !== "crash" && st.landungen < 30 && n < 120 * 400; n += 1) {
          pilot();
          M.takt(1 / 120);
          // Schon vor der ersten Landung kostet der Schub Punkte.
          if (schonVorher === null && st.schritt === "flug" && st.landungen === 0 && st.zeit - st.schrittZeit > 0.5) schonVorher = st.punkte;
        }
        M.schub(false);
        M.neige(null);
        raus.push({ landungen: st.landungen, punkte: Math.round(st.punkte), schritt: st.schritt, tank: Math.round(st.tank) });
      }
      return { raus, schonVorher };
    });
    pruefe(fluege.raus.every((f) => f.landungen >= 8), `Mondlandung: Der sparsame Pilot kommt nicht über acht Plattformen – ${JSON.stringify(fluege.raus)}`);
    pruefe(fluege.raus.every((f) => f.punkte > f.landungen * 50 && f.punkte < f.landungen * 200),
      `Mondlandung: Die Punkte passen nicht zu 200 je Plattform weniger dem Treibstoff – ${JSON.stringify(fluege.raus)}`);
    pruefe(fluege.schonVorher !== null && fluege.schonVorher < 0, `Mondlandung: Der Schub kostet vor der ersten Landung keine Punkte (${fluege.schonVorher}).`);
    // Auch wer grob fliegt, landet: zum Ziel hin kippen, Schub, wenn es
    // sinkt oder das Gelände hoch ist – und im Leitstrahl nur bremsen, wenn
    // es zu schnell fällt. Er kommt ein paar Plattformen weit, dann geht ihm
    // der Treibstoff aus – und er hat weniger Punkte als der sparsame.
    const grob = await seite.evaluate(() => {
      const M = window.LernappMondlandung;
      const st = M.state;
      const pilot = () => {
        const f = st.f;
        if (st.schritt === "gelandet" || st.schritt === "start") { M.schub(true); M.neige(0); return; }
        if (st.schritt !== "flug") { M.schub(false); M.neige(null); return; }
        const p = st.platten[st.auf + 1];
        const dx = (p.x0 + p.x1) / 2 - f.x;
        const r = Math.sign(dx) || 1;
        let vorne = -Infinity;
        for (let x = f.x; Math.abs(x - f.x) < 140; x += 6 * r) vorne = Math.max(vorne, M.bodenBei(x));
        if (st.strahl) { M.neige(0); M.schub(f.vy < -40); return; }
        const fern = Math.abs(dx) > 60;
        M.neige(fern ? r * 0.5 : 0);
        M.schub(f.y - 13 - vorne < 50 || f.vy < (fern ? 0 : -40) || (fern && Math.abs(f.vx) < 30));
      };
      const raus = [];
      let voll = false;
      for (let lauf = 0; lauf < 3; lauf += 1) {
        document.querySelector(".cm-bar-left .cm-icon-again").click();
        for (let n = 0; st.schritt !== "crash" && n < 120 * 300; n += 1) {
          pilot();
          M.takt(1 / 120);
          if (st.landungen > 0 && st.schritt === "gelandet" && st.tank > M.TANK * 0.9 + 0.01) voll = true;
        }
        M.schub(false);
        M.neige(null);
        raus.push({ landungen: st.landungen, punkte: st.punkte, tank: Math.round(st.tank) });
      }
      return { raus, voll };
    });
    pruefe(grob.raus.every((r) => r.landungen >= 2), `Mondlandung: Wer grob fliegt, kommt keine zwei Plattformen weit – ${JSON.stringify(grob.raus)}`);
    pruefe(!grob.voll, "Mondlandung: Auf einer Plattform wird der Tank ganz voll.");
    const sparsamSchnitt = fluege.raus.reduce((summe, f) => summe + f.punkte, 0) / fluege.raus.length;
    const grobSchnitt = grob.raus.reduce((summe, r) => summe + r.punkte, 0) / grob.raus.length;
    pruefe(sparsamSchnitt > grobSchnitt, `Mondlandung: Wer sparsam fliegt, hat nicht mehr Punkte (${sparsamSchnitt} gegen ${grobSchnitt}).`);
    const fall = await seite.evaluate(() => {
      const M = window.LernappMondlandung;
      document.querySelector(".cm-bar-left .cm-icon-again").click();
      // Steigen, dann loslassen und fallen lassen.
      M.schub(true);
      for (let n = 0; n < 120 * 2.2; n += 1) M.takt(1 / 120);
      M.schub(false);
      for (let n = 0; n < 120 * 8 && M.state.schritt === "flug"; n += 1) M.takt(1 / 120);
      return { schritt: M.state.schritt };
    });
    pruefe(fall.schritt === "crash", `Mondlandung: Wer ungebremst fällt, zerschellt nicht: ${JSON.stringify(fall)}`);
    await seite.waitForSelector(".cm-result-score", { timeout: 6000 }).catch(() => {});
    pruefe(await seite.locator(".cm-result-score").count() === 1, "Mondlandung: Nach dem Absturz kommt kein Ergebnis.");
    await kontext.close();
  }

  // --- 4g8. Schwerkraft-Läufer: immer ein Weg frei ------------------------------------
  // Ein Autopilot rechnet voraus: Er sucht die Augenblicke, in denen er
  // tippen muss, um die nächsten anderthalb Sekunden zu überstehen – mit
  // derselben Physik wie das Spiel. So kommt er auf mehreren gewürfelten
  // Korridoren bis 2500 m, über Zickzack und Stege. Wer nie tippt, fällt ins
  // erste Loch oder rennt in den ersten Block.
  {
    const { kontext, seite } = await neueSeite({ width: 1000, height: 640 });
    await seite.goto(`${BASIS}/schwerkraft`, { waitUntil: "load" });
    await seite.waitForFunction(() => window.LernappSchwerkraft?.state, null, { timeout: 8000 });
    const laeufe = await seite.evaluate(() => {
      const S = window.LernappSchwerkraft;
      const st = S.state;
      const DT = 1 / 240;
      const kopie = (l) => ({ ...l });
      // So spät tippen wie möglich: erst ohne Tipp vorausrechnen, dann von
      // hinten die Augenblicke durchprobieren, in denen ein Tipp ginge.
      const plane = (start, bisX) => {
        const besucht = new Set();
        const suche = (l, t) => {
          const c = kopie(l);
          const kandidaten = [];
          for (;;) {
            if (c.x >= bisX) return [];
            if (S.kannKehren(c)) kandidaten.push({ c: kopie(c), t });
            if (S.bewege(c, DT)) break;
            t += 1;
          }
          for (let i = kandidaten.length - 1; i >= 0; i -= 1) {
            const k = kandidaten[i];
            const key = `${k.c.richtung}|${k.c.auf ? k.c.auf.x0 : k.c.steht ? "s" : "k"}|${Math.round(k.c.x / 3)}`;
            if (besucht.has(key)) continue;
            besucht.add(key);
            const d = kopie(k.c);
            S.kehre(d);
            const rest = suche(d, k.t);
            if (rest) return [k.t, ...rest];
          }
          return null;
        };
        return suche(start, 0);
      };
      const raus = [];
      for (let lauf = 0; lauf < 3; lauf += 1) {
        document.querySelector(".cm-bar-left .cm-icon-again").click();
        S.tippen();
        let geplant = [];
        let naechster = 0;
        let ohneWeg = null;
        let aufSteg = 0;
        for (let tick = 0; st.schritt === "lauf" && st.meter < 2500 && tick < 240 * 200; tick += 1) {
          if (tick >= naechster) {
            const plan = plane(st.l, st.l.x + S.tempoBei(st.l.x) * 1.6);
            if (!plan) { ohneWeg = st.meter; break; }
            geplant = plan.map((p) => p + tick);
            naechster = tick + 90;
          }
          if (geplant.length && geplant[0] === tick) { S.tippen(); geplant.shift(); }
          if (st.l.auf) aufSteg += 1;
          S.takt(DT);
        }
        raus.push({ meter: st.meter, schritt: st.schritt, grund: st.grund, wechsel: st.wechsel, ohneWeg, stege: st.stege.filter((t) => t.x0 < st.l.x).length, aufSteg });
      }
      return raus;
    });
    pruefe(laeufe.every((l) => l.meter >= 2500 && l.schritt === "lauf"), `Schwerkraft-Läufer: Der Autopilot kommt nicht durch jeden Korridor – ${JSON.stringify(laeufe)}`);
    pruefe(laeufe.every((l) => l.stege >= 2 && l.aufSteg > 0), `Schwerkraft-Läufer: Auf 2500 m kommen keine Stege vor, oder er muss nie darauf – ${JSON.stringify(laeufe)}`);
    const ohne = await seite.evaluate(() => {
      const S = window.LernappSchwerkraft;
      document.querySelector(".cm-bar-left .cm-icon-again").click();
      S.tippen();
      for (let n = 0; n < 240 * 20 && S.state.schritt === "lauf"; n += 1) S.takt(1 / 240);
      return { schritt: S.state.schritt, grund: S.state.grund };
    });
    pruefe(ohne.schritt === "aus", `Schwerkraft-Läufer: Wer nie tippt, rennt ewig weiter: ${JSON.stringify(ohne)}`);
    await seite.waitForSelector(".cm-result-score", { timeout: 6000 }).catch(() => {});
    pruefe(await seite.locator(".cm-result-score").count() === 1, "Schwerkraft-Läufer: Nach dem Sturz kommt kein Ergebnis.");
    await kontext.close();
  }

  // --- 4g9. Hügelflieger: wer geschickt hält, kommt weiter ------------------------
  // Eine Minute auf denselben Hügeln: Bergab schwer und bergauf leicht kommt
  // deutlich weiter als immer schwer oder nie – und landet dabei perfekt.
  // Wenn die Sonne untergeht, kommt das Ergebnis.
  {
    const { kontext, seite } = await neueSeite({ width: 1000, height: 640 });
    await seite.goto(`${BASIS}/huegel`, { waitUntil: "load" });
    await seite.waitForFunction(() => window.LernappHuegel?.state, null, { timeout: 8000 });
    const runden = await seite.evaluate(() => {
      const H = window.LernappHuegel;
      const st = H.state;
      const strategien = { nie: () => false, immer: () => true, geschickt: () => H.steigungBei(st.v.x) < -0.02 };
      const raus = {};
      for (const [name, will] of Object.entries(strategien)) {
        // Dieselben Hügel für alle drei: im Turnier wäre das so, hier ohne.
        document.querySelector(".cm-bar-left .cm-icon-again").click();
        H.druecken();
        H.loslassen();
        for (let n = 0; n < 120 * 60; n += 1) {
          if (will()) H.druecken(); else H.loslassen();
          H.takt(1 / 120);
        }
        H.loslassen();
        raus[name] = { meter: st.meter, perfekt: st.perfekt };
      }
      return raus;
    });
    pruefe(runden.geschickt.meter > runden.immer.meter * 1.25 && runden.immer.meter > runden.nie.meter,
      `Hügelflieger: Geschicktes Halten zahlt sich nicht aus – ${JSON.stringify(runden)}`);
    pruefe(runden.geschickt.perfekt >= 1, `Hügelflieger: Wer geschickt hält, landet nie perfekt – ${JSON.stringify(runden)}`);
    // Losgelassen gleitet er: Wer an der Kuppe loslässt und erst kurz vor
    // einem Abhang wieder schwer wird, fliegt über ganze Hügel hinweg.
    const gleiten = await seite.evaluate(() => {
      const H = window.LernappHuegel;
      const st = H.state;
      const kuppen = () => st.huegel.filter((p, i, a) => i > 0 && i < a.length - 1 && p.y > a[i - 1].y && p.y > a[i + 1].y).map((p) => p.x);
      document.querySelector(".cm-bar-left .cm-icon-again").click();
      H.druecken();
      H.loslassen();
      let flug = false;
      let ueber = 0;
      let spruenge = 0;
      for (let n = 0; n < 120 * 60; n += 1) {
        const v = st.v;
        const s = H.steigungBei(v.x);
        const will = st.amBoden ? s < -0.02 : v.vy < 0 && s < -0.05 && v.y - H.bodenBei(v.x) < 90 && v.vy / Math.max(1, v.vx) > s;
        if (will) H.druecken(); else H.loslassen();
        const x0 = v.x;
        H.takt(1 / 120);
        if (!st.amBoden && !flug) { flug = true; ueber = 0; }
        if (flug) ueber += kuppen().filter((k) => k > x0 && k <= st.v.x).length;
        if (st.amBoden && flug) { flug = false; if (ueber >= 2) spruenge += 1; }
      }
      H.loslassen();
      return { spruenge, meter: st.meter };
    });
    pruefe(gleiten.spruenge >= 2, `Hügelflieger: Im Gleiten fliegt er nie über einen Hügel hinweg – ${JSON.stringify(gleiten)}`);
    await seite.evaluate(() => window.LernappHuegel.zeitUm());
    await seite.waitForSelector(".cm-result-score", { timeout: 6000 }).catch(() => {});
    pruefe(await seite.locator(".cm-result-score").count() === 1, "Hügelflieger: Wenn die Sonne untergeht, kommt kein Ergebnis.");
    await kontext.close();
  }

  // --- 4h. Wenn es im Turnier nichts zu spielen gibt ------------------------------
  // Dann keine Tafel, kein Satz: zurück auf die Turnierseite, die sagt, wie es
  // steht. Und kein Weg nebenan ins Spiel ohne Turnier.
  for (const [id, erwartet, was] of [
    ["zufall-test2345678", /Würfelcup/, "ein Spiel, das nicht dazugehört"],
    ["bald-test23456789", /beginnt/, "ein Turnier, das noch nicht angefangen hat"],
    ["vorbei-test2345678", /beendet|Endstand/, "ein beendetes Turnier"],
    ["pause-test2345678", /angehalten/, "ein angehaltenes Turnier"],
    ["gibtsnicht-123456", /gibt es nicht/, "ein Turnier, das es nicht gibt"],
  ]) {
    const { kontext, seite } = await mitTurnieren(`/turmbau?turnier=${id}`);
    await seite.waitForURL((url) => url.pathname === "/turnier", { timeout: 8000 }).catch(() => {});
    pruefe(seite.url().endsWith(`/turnier?t=${id}`), `Für ${was} geht es nicht zurück zum Turnier, sondern nach ${seite.url()}.`);
    await seite.waitForFunction((muster) => new RegExp(muster).test(document.querySelector("[data-turnier]")?.textContent || ""), erwartet.source, { timeout: 8000 }).catch(() => {});
    const text = (await seite.locator("[data-turnier]").innerText().catch(() => "")).replace(/\n/g, " ");
    pruefe(erwartet.test(text), `Für ${was} sagt die Turnierseite: ${text || "nichts"}`);
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

  // --- 4i. Die Tafel auf einem flachen Handy --------------------------------------
  // Frage, Namensfeld, Knopf – auf 320 Pixeln Höhe muss "Los geht's"
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
    // Bestätigen ja; ein Prompt bekommt die Antwort, die die Prüfung
    // vorher hinlegt (antwort), sonst seinen Vorschlag.
    let antwort = null;
    seite.on("dialog", (frage) => {
      frage.accept(frage.type() === "prompt" && antwort !== null ? antwort : undefined);
      antwort = null;
    });
    // Ein Turnier in der Liste auswählen. Ist es schon aufgeklappt, bleibt es so.
    const waehle = async (name) => {
      const karte = seite.locator(".adm-turnier", { has: seite.locator(".adm-turnier-name", { hasText: name }) });
      if (!(await karte.evaluate((k) => k.classList.contains("ist-offen")))) await karte.locator(".adm-turnier-wahl").click();
      return seite.locator(".adm-turnier", { has: seite.locator(".adm-turnier-name", { hasText: name }) });
    };
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
    const namen = await seite.locator(".adm-turnier-name").allInnerTexts();
    pruefe(namen.length === TURNIERE.turniere.length, `Im Adminbereich stehen ${namen.length} Turniere statt ${TURNIERE.turniere.length} – auch die nur mit Link gehören hierher.`);
    pruefe(namen[0] === "Herbstcup" && namen[namen.length - 1] === "Frühlingscup",
      `Die Turniere stehen nicht in der Reihenfolge laufend – geplant – angehalten – vorbei: ${namen.join(", ")}`);
    const herbst = seite.locator(".adm-turnier", { has: seite.locator(".adm-turnier-name", { hasText: "Herbstcup" }) });
    pruefe(/vorne: 1\. Leo/.test(await herbst.innerText()), `Beim Herbstcup steht nicht, wer vorne liegt: ${(await herbst.innerText()).replace(/\n/g, " ")}`);

    // Die Liste: nach Stand gruppiert, die laufenden zuerst – und ohne den
    // erklärenden Absatz von früher.
    const gruppen = await seite.locator(".adm-turnier-gruppe-titel").allTextContents();
    pruefe(/^Laufende Turniere/.test(gruppen[0] || "") && gruppen.some((g) => /^Beendet/.test(g)),
      `Die Turniere stehen nicht nach laufend – … – beendet gruppiert: ${gruppen.join(", ")}`);
    const turnierText = await seite.locator(".adm-turniere").innerText();
    pruefe(!/eigene Bestenliste mit Anfang und Ende/.test(turnierText) && !/Noch kein Turnier/.test(turnierText),
      "Über den Turnieren steht noch der alte Absatz.");
    pruefe(await seite.locator(".adm-turnier-detail").count() === 0, "In der Liste ist schon ein Turnier aufgeklappt, bevor eines gewählt wurde.");
    pruefe(/ohne Zeitlimite/.test(await seite.locator(".adm-turnier", { has: seite.locator(".adm-turnier-name", { hasText: "Dauercup" }) }).innerText()),
      "Beim Turnier ohne Zeitlimite steht ein Datum statt «ohne Zeitlimite».");

    // Auswählen klappt auf: Aktionen und der ganze Stand. Ein zweiter Tipp
    // klappt wieder zu.
    await waehle("Herbstcup");
    const aufgeklappt = await herbst.innerText();
    for (const wort of ["Öffnen", "Link kopieren", "Umbenennen", "Bearbeiten", "Anhalten", "Jetzt beenden", "Löschen", "Entfernen"]) {
      pruefe(aufgeklappt.includes(wort), `Im ausgewählten Turnier fehlt «${wort}»: ${aufgeklappt.replace(/\n/g, " | ")}`);
    }
    pruefe(await herbst.locator(".adm-turnier-tabelle tbody tr").count() === 3, "Im ausgewählten Turnier steht nicht der ganze Stand (drei Spieler).");
    await herbst.locator(".adm-turnier-wahl").click();
    pruefe(await seite.locator(".adm-turnier-detail").count() === 0, "Ein zweiter Tipp klappt das Turnier nicht wieder zu.");

    // Einen Spieler aus dem Turnier entfernen – alle seine Einträge, sonst nichts.
    await waehle("Herbstcup");
    await herbst.locator(".adm-turnier-tabelle tr", { hasText: "Mia" }).locator("button", { hasText: "Entfernen" }).click();
    await seite.waitForFunction((id) => ![...window.__miniTurnierEintraege.keys()].some((k) => k.startsWith(id + "/") && k.endsWith("_mini_miamiamiamia")), HERBST, { timeout: 4000 }).catch(() => {});
    const nachEntfernen = await seite.evaluate((id) => [...window.__miniTurnierEintraege.entries()].filter(([k]) => k.startsWith(id + "/")).map(([, e]) => e.name), HERBST);
    pruefe(!nachEntfernen.includes("Mia") && nachEntfernen.filter((n) => n === "Leo").length === 2 && nachEntfernen.includes("Grosi"),
      `Nach «Entfernen» stehen im Herbstcup: ${nachEntfernen.join(", ")}`);
    pruefe(await seite.locator(".adm-turnier.ist-offen .adm-turnier-name").innerText().catch(() => "") === "Herbstcup",
      "Nach dem Entfernen ist der Herbstcup nicht mehr ausgewählt.");

    // Umbenennen: ein neuer Name, derselbe Link.
    await waehle("Wintercup");
    antwort = "Neujahrscup";
    await seite.locator(".adm-turnier.ist-offen button", { hasText: "Umbenennen" }).click();
    await seite.waitForFunction(() => window.__miniTurniere.get("bald-test23456789")?.name === "Neujahrscup", null, { timeout: 4000 }).catch(() => {});
    pruefe(await seite.evaluate(() => window.__miniTurniere.get("bald-test23456789")?.name) === "Neujahrscup", "«Umbenennen» hat den Namen nicht geändert.");
    await seite.waitForSelector('.adm-turnier-name:text-is("Neujahrscup")', { timeout: 4000 }).catch(() => {});
    pruefe(await seite.locator(".adm-turnier-name", { hasText: "Neujahrscup" }).count() === 1, "Der neue Name steht nicht in der Liste.");

    // Was im Adminbereich gerade zu sehen ist – gemessen, nicht nachgesehen,
    // ob es im DOM steht: Die Ansicht für das Formular blendet aus, statt
    // wegzuräumen.
    const sichtbar = () => seite.evaluate(() => {
      const da = (e) => Boolean(e) && e.getClientRects().length > 0;
      return {
        kopf: da(document.querySelector(".adm-kopf")),
        form: da(document.querySelector(".adm-turnier-form")),
        liste: [...document.querySelectorAll(".adm-turnier-liste .adm-turnier")].some(da),
        streifen: da(document.querySelector(".adm-streifen")),
        andere: [...document.querySelectorAll(".adm-seite > .adm-block:not(.adm-turniere)")].some(da),
      };
    });

    // Ein neues Turnier – und solange es entsteht, steht nur das Formular da.
    await seite.click(".adm-turniere .adm-block-kopf button");
    await seite.waitForSelector(".adm-turnier-form", { timeout: 4000 });
    const allein = await sichtbar();
    pruefe(allein.form && allein.kopf, `Das neue Turnier steht nicht da: ${JSON.stringify(allein)}`);
    pruefe(!allein.liste && !allein.streifen && !allein.andere, `Unter dem neuen Turnier hängt noch der Rest des Adminbereichs: ${JSON.stringify(allein)}`);
    const form = seite.locator(".adm-turnier-form");
    pruefe(await form.locator(".adm-wahl .adm-spielen-knopf").count() === SPIELE.length,
      `Im Turnierformular hat nicht jedes Spiel einen Knopf zum Spielen (${await form.locator(".adm-spielen-knopf").count()} von ${SPIELE.length}).`);
    await form.locator('input[type="text"]').first().fill("Test-Cup Ä");
    await form.locator("button", { hasText: "Keine" }).click();
    await form.locator('input[value="towerStack"]').check();
    await form.locator('input[value="fishPond"]').check();
    await form.locator('input[type="radio"][value="frei"]').check();
    const summeGesperrt = await form.locator('input[type="radio"][value="summe"]').isDisabled();
    pruefe(summeGesperrt, "Bei unbegrenzten Versuchen lässt sich «alle zusammen» wählen.");
    // Eine Zahl, die in keiner Liste stand: Die Versuche werden getippt. Wer
    // tippt, meint die feste Zahl, auch ohne den Punkt davor anzuklicken.
    await form.locator("input.adm-feld-zahl").fill("0");
    pruefe(await form.locator('input[type="radio"][value="zahl"]').isChecked(), "Wer eine Zahl der Versuche tippt, bleibt bei «unbegrenzt».");
    await form.locator('button[type="submit"]').click();
    const zuWenig = await form.locator(".adm-meldung").innerText();
    pruefe(/1 bis 100/.test(zuWenig), `Null Versuche nimmt das Formular ohne Einwand an: ${zuWenig}`);
    pruefe(await seite.evaluate(() => [...window.__miniTurniere.values()].every((t) => t.name !== "Test-Cup Ä")), "Ein Turnier mit null Versuchen wurde angelegt.");
    await form.locator("input.adm-feld-zahl").fill("4");
    await form.locator('input[type="radio"][value="summe"]').check();
    await form.locator('input[type="radio"][value="prozent"]').check();
    await form.locator('input[type="radio"][value="link"]').check();
    await form.locator('input[type="radio"][value="wieErster"]').check();
    await form.locator(".adm-option", { hasText: "verdecken" }).locator("input").check();
    const gegnerHaken = form.locator(".adm-option", { hasText: "Gegner beim Spielen" }).locator("input");
    pruefe(await gegnerHaken.isChecked(), "Ein neues Turnier zeigt die Gegner beim Spielen nicht von selbst.");
    await gegnerHaken.uncheck();
    await form.locator('button[type="submit"]').click();
    await seite.waitForFunction(() => [...window.__miniTurniere.values()].some((t) => t.name === "Test-Cup Ä"), null, { timeout: 4000 })
      .catch(() => {});
    const neu = await seite.evaluate(() => [...window.__miniTurniere.values()].find((t) => t.name === "Test-Cup Ä") || null);
    pruefe(Boolean(neu), "Das neue Turnier kam nicht an.");
    if (neu) {
      pruefe(/^test-cup-ae-[a-km-np-z2-9]{8}$/.test(neu.id), `Der Name des neuen Turniers taugt nicht als Link: ${neu.id}`);
      pruefe(JSON.stringify(neu.spiele) === JSON.stringify(["fishPond", "towerStack"]), `Im neuen Turnier stehen die Spiele ${neu.spiele.join(", ")}.`);
      pruefe(neu.versuche === 4 && neu.zaehlt === "summe" && neu.wertung === "prozent" && neu.aufgaben === "wieErster"
        && neu.sichtbar === "link" && neu.verdeckt === true && neu.aktiv === true && neu.ohneGeist === true,
        `Die Regeln des neuen Turniers kamen falsch an: ${JSON.stringify(neu)}`);
      pruefe(neu.endeMs - neu.startMs === TAG, `Das neue Turnier dauert ${(neu.endeMs - neu.startMs) / STUNDE} Stunden statt eines Tages.`);
      const meldung = await seite.locator(".adm-turniere > .adm-meldung").innerText();
      pruefe(meldung.includes(`/turnier?t=${neu.id}`), `Nach dem Anlegen steht der Link nicht da: ${meldung}`);
      pruefe(await seite.locator(".adm-turnier-name", { hasText: "Test-Cup Ä" }).count() === 1, "Das neue Turnier steht nicht in der Liste.");
      pruefe(await seite.locator(".adm-turnier.ist-offen .adm-turnier-name").innerText().catch(() => "") === "Test-Cup Ä",
        "Das eben angelegte Turnier ist nicht gleich ausgewählt.");
      const eckdaten = await seite.locator(".adm-turnier.ist-offen .adm-turnier-detail .adm-klein").first().innerText().catch(() => "");
      pruefe(/Level wie Platz 1/.test(eckdaten), `Beim neuen Turnier steht nicht, dass alle das Level von Platz 1 spielen: ${eckdaten}`);
      const danach = await sichtbar();
      pruefe(!danach.form && danach.liste && danach.streifen && danach.andere, `Nach dem Anlegen kommt der Adminbereich nicht zurück: ${JSON.stringify(danach)}`);
    }

    // Der Zurück-Knopf des Browsers schliesst das Formular – und bleibt im
    // Adminbereich. Ebenso der Knopf oben im Formular.
    await waehle("Herbstcup");
    await herbst.locator("button", { hasText: "Bearbeiten" }).click();
    await seite.waitForSelector(".adm-turnier-form", { timeout: 4000 });
    pruefe(await seite.locator('.adm-turnier-form input[type="radio"][value="zahl"]').isChecked()
      && await seite.inputValue(".adm-turnier-form input.adm-feld-zahl") === "2",
      "Beim Ändern stehen die zwei Versuche des Herbstcups nicht im Formular.");
    await seite.evaluate(() => history.back());
    await seite.waitForFunction(() => !document.querySelector(".adm-turnier-form"), null, { timeout: 4000 }).catch(() => {});
    pruefe(await seite.locator(".adm-turnier-form").count() === 0, "Der Zurück-Knopf des Browsers schliesst das Formular nicht.");
    pruefe(new URL(seite.url()).pathname === "/admin", `Der Zurück-Knopf führt aus dem Adminbereich hinaus nach ${seite.url()}.`);
    pruefe((await sichtbar()).liste, "Nach dem Zurück-Knopf fehlt die Liste der Turniere.");
    await seite.click(".adm-turniere .adm-block-kopf button");
    await seite.waitForSelector(".adm-turnier-form", { timeout: 4000 });
    await seite.locator(".adm-turnier-form-kopf button", { hasText: "Zurück" }).click();
    pruefe(await seite.locator(".adm-turnier-form").count() === 0, "«Zurück zur Übersicht» schliesst das Formular nicht.");
    pruefe(!(await seite.evaluate(() => document.querySelector(".adm-seite").classList.contains("ist-formular"))), "Nach «Zurück zur Übersicht» bleibt der Adminbereich ausgeblendet.");

    // Ein Spiel spielen: im Vollbild über dem Adminbereich, ohne dass der
    // Haken daneben sich bewegt – auf der Startseite wäre das sofort
    // gespeichert.
    const auswahl = seite.locator(".adm-seite > .adm-block:not(.adm-turniere)").first();
    pruefe(await auswahl.locator(".adm-wahl .adm-spielen-knopf").count() === SPIELE.length,
      `In der Spielauswahl hat nicht jedes Spiel einen Knopf zum Spielen (${await auswahl.locator(".adm-spielen-knopf").count()} von ${SPIELE.length}).`);
    const turmZeile = auswahl.locator(".adm-wahl", { hasText: "Turmbau" });
    const vorSpiel = await turmZeile.locator('input[type="checkbox"]').isChecked();
    await turmZeile.locator(".adm-spielen-knopf").click();
    await seite.waitForSelector(".adm-spiel iframe", { timeout: 4000 });
    pruefe(await seite.getAttribute(".adm-spiel iframe", "src") === "/turmbau?von=admin",
      `Der Knopf ▶ öffnet ${await seite.getAttribute(".adm-spiel iframe", "src")} statt /turmbau?von=admin.`);
    pruefe(await turmZeile.locator('input[type="checkbox"]').isChecked() === vorSpiel && await seite.evaluate(() => window.__miniOffen === undefined),
      "Der Knopf zum Spielen hat den Haken umgelegt.");
    await seite.waitForFunction(() => document.fullscreenElement?.classList.contains("adm-spiel"), null, { timeout: 3000 }).catch(() => {});
    pruefe(await seite.evaluate(() => document.fullscreenElement?.classList.contains("adm-spiel") === true), "Das Spiel aus dem Adminbereich startet nicht im Vollbild.");
    const imSpiel = seite.frameLocator(".adm-spiel iframe");
    await imSpiel.locator(".cm-bar").waitFor({ timeout: 8000 });
    pruefe(await imSpiel.locator(".cm-bar-left a").first().getAttribute("href") === "/admin", "Im Spiel aus dem Adminbereich führt der Weg oben links nicht zurück.");
    pruefe(await imSpiel.locator(".cm-vollbild").count() === 0, "Im Fenster des Adminbereichs steht ein zweiter Knopf fürs Vollbild.");
    await imSpiel.locator(".cm-bar-left a").first().click();
    await seite.waitForFunction(() => !document.querySelector(".adm-spiel") && !document.fullscreenElement, null, { timeout: 4000 }).catch(() => {});
    pruefe(await seite.locator(".adm-spiel").count() === 0, "Der Weg zurück im Spiel schliesst das Fenster nicht.");
    pruefe(await seite.evaluate(() => !document.fullscreenElement), "Nach dem Spiel bleibt der Adminbereich im Vollbild.");
    pruefe(await seite.locator(".adm-kopf").count() === 1 && new URL(seite.url()).pathname === "/admin", "Nach dem Spiel ist der Adminbereich weg.");

    // Ein Turnier, in dem wartet, wer vorne liegt: unbegrenzt für alle
    // anderen – zusammenzählen geht deshalb nicht.
    await seite.click(".adm-turniere .adm-block-kopf button");
    await seite.waitForSelector(".adm-turnier-form", { timeout: 4000 });
    const spitzeForm = seite.locator(".adm-turnier-form");
    await spitzeForm.locator('input[type="text"]').first().fill("Spitzencup");
    await spitzeForm.locator('input[type="radio"][value="spitze"]').check();
    pruefe(await spitzeForm.locator('input[type="radio"][value="summe"]').isDisabled(), "Wenn wartet, wer vorne liegt, lassen sich alle Versuche zusammenzählen.");
    await spitzeForm.locator('button[type="submit"]').click();
    await seite.waitForFunction(() => [...window.__miniTurniere.values()].some((t) => t.name === "Spitzencup"), null, { timeout: 4000 }).catch(() => {});
    const spitze = await seite.evaluate(() => [...window.__miniTurniere.values()].find((t) => t.name === "Spitzencup") || null);
    pruefe(spitze?.spitzeWartet === true && spitze.versuche === 0 && spitze.zaehlt === "bester",
      `Das Turnier, in dem wartet, wer vorne liegt, kam falsch an: ${JSON.stringify(spitze)}`);
    await seite.waitForSelector('.adm-turnier:has-text("Spitzencup")', { timeout: 4000 }).catch(() => {});
    pruefe(/Platz 1 wartet/.test(await (await waehle("Spitzencup")).innerText().catch(() => "")),
      "In der Liste steht beim Spitzencup nicht, dass Platz 1 wartet.");
    await (await waehle("Königscup")).locator("button", { hasText: "Bearbeiten" }).click();
    await seite.waitForSelector(".adm-turnier-form", { timeout: 4000 });
    pruefe(await seite.locator('.adm-turnier-form input[type="radio"][value="spitze"]').isChecked(), "Beim Ändern des Königscups ist «Nur wer nicht vorne liegt» nicht gewählt.");
    await seite.locator(".adm-turnier-form-kopf button", { hasText: "Zurück" }).click();

    // Anhalten und löschen.
    // Ein Turnier ohne Zeitlimite.
    await seite.click(".adm-turniere .adm-block-kopf button");
    await seite.waitForSelector(".adm-turnier-form", { timeout: 4000 });
    const dauerForm = seite.locator(".adm-turnier-form");
    await dauerForm.locator('input[type="text"]').first().fill("Endloscup");
    await dauerForm.locator("select").first().selectOption("ohne");
    pruefe(/bis du es anhältst/.test(await dauerForm.innerText()), "Bei «ohne Zeitlimite» sagt das Formular nicht, wie lange das Turnier läuft.");
    await dauerForm.locator('button[type="submit"]').click();
    await seite.waitForFunction(() => [...window.__miniTurniere.values()].some((t) => t.name === "Endloscup"), null, { timeout: 4000 }).catch(() => {});
    const endlos = await seite.evaluate(() => [...window.__miniTurniere.values()].find((t) => t.name === "Endloscup") || null);
    pruefe(endlos?.endeMs === OHNE_ENDE && endlos.startMs < endlos.endeMs, `Das Turnier ohne Zeitlimite kam falsch an: ${JSON.stringify(endlos)}`);
    await (await waehle("Endloscup")).locator("button", { hasText: "Bearbeiten" }).click();
    await seite.waitForSelector(".adm-turnier-form", { timeout: 4000 });
    pruefe(await seite.locator(".adm-turnier-form select").first().inputValue() === "ohne", "Beim Bearbeiten ist «ohne Zeitlimite» nicht mehr gewählt.");
    await seite.locator(".adm-turnier-form-kopf button", { hasText: "Zurück" }).click();

    await waehle("Herbstcup");
    await herbst.locator("button", { hasText: "Anhalten" }).click();
    await seite.waitForFunction((id) => window.__miniTurniere.get(id)?.aktiv === false, HERBST, { timeout: 4000 }).catch(() => {});
    pruefe(await seite.evaluate((id) => window.__miniTurniere.get(id)?.aktiv, HERBST) === false, "«Anhalten» hat das Turnier nicht angehalten.");
    await (await waehle("Frühlingscup")).locator("button", { hasText: "Löschen" }).click();
    await seite.waitForFunction(() => ![...window.__miniTurniere.values()].some((t) => t.name === "Frühlingscup"), null, { timeout: 4000 }).catch(() => {});
    pruefe(await seite.evaluate(() => [...window.__miniTurniere.values()].some((t) => t.name === "Frühlingscup")) === false, "«Löschen» hat das Turnier nicht gelöscht.");

    // Eine ganze Bestenliste leeren – wenn ein Spiel umgebaut wurde und die
    // alten Zahlen nichts mehr bedeuten. Die Geister gehen mit, die anderen
    // Spiele bleiben.
    await seite.evaluate(() => {
      window.__miniGeister.set("fishPond_mini_vorherdagewesen", { game: "fishPond", spieler: "mini_vorherdagewesen", name: "Grosi", punkte: 12, level: "t1", bahn: "" });
    });
    const teich = seite.locator(".adm-block", { has: seite.locator("h2", { hasText: "Fischteich" }) });
    pruefe(await teich.locator("button", { hasText: "Bestenliste leeren" }).count() === 1, "Beim Fischteich fehlt «Bestenliste leeren».");
    await teich.locator("button", { hasText: "Bestenliste leeren" }).click();
    await seite.waitForFunction(() => ![...window.__miniEintraege.values()].some((e) => e.game === "fishPond"), null, { timeout: 4000 }).catch(() => {});
    const geleert = await seite.evaluate(() => ({
      teich: [...window.__miniEintraege.values()].filter((e) => e.game === "fishPond").length,
      geist: window.__miniGeister.has("fishPond_mini_vorherdagewesen"),
      turm: [...window.__miniEintraege.values()].filter((e) => e.game === "towerStack").length,
    }));
    pruefe(geleert.teich === 0, `«Bestenliste leeren» hat ${geleert.teich} Einträge im Fischteich stehen lassen.`);
    pruefe(!geleert.geist, "«Bestenliste leeren» hat den Geist stehen lassen.");
    pruefe(geleert.turm > 0, "«Bestenliste leeren» hat auch den Turmbau geleert.");

    const ohne = await seite.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    pruefe(ohne <= 1, `Der Adminbereich steht mit den Turnieren ${ohne} px über den Rand.`);

    // Abmelden: Der Knopf auf der Startseite verschwindet mit.
    await seite.locator(".adm-kopf button", { hasText: "Abmelden" }).click();
    await seite.waitForSelector(".adm-anmeldung", { timeout: 4000 }).catch(() => {});
    pruefe(await seite.evaluate(() => localStorage.getItem("mini.admin")) === null, "Nach dem Abmelden bleibt das Merkzeichen für den Admin-Knopf stehen.");
    pruefe(fehlerHier.length === 0, `Der Adminbereich mit Turnieren hat sich beschwert – ${fehlerHier.join(" / ")}`);
    await kontext.close();
  }

  // --- 4k. Aus dem Adminbereich zählt die Runde -----------------------------------
  // Der Admin startet ein Spiel mit ▶ (admin.js). Die Runde läuft wie jede
  // andere und geht unter dem Namen des Geräts in die ewige Liste; nur der Weg
  // oben links führt zurück in den Adminbereich.
  {
    const { kontext, seite } = await mitTurnieren("/turmbau?von=admin", { vorher: () => localStorage.setItem("mini.name", "Alain") });
    await seite.waitForSelector(".cm-bar", { timeout: 8000 });
    const zurueck = await seite.getAttribute(".cm-bar-left a", "href");
    pruefe(zurueck === "/admin", `Aus dem Adminbereich führt der Weg oben links nach ${zurueck} statt zurück.`);
    pruefe(await spieleTurmbauZuEnde(seite), "Die Runde aus dem Adminbereich kam zu keinem Ergebnis.");
    await seite.waitForSelector(".mini-ergebnis", { timeout: 4000 });
    await seite.waitForFunction(() => [...window.__miniEintraege.values()].some((e) => e.name === "Alain"), null, { timeout: 4000 }).catch(() => {});
    const spur = await seite.evaluate(() => ({
      ewig: [...window.__miniEintraege.values()].filter((e) => e.name === "Alain").map((e) => ({ game: e.game, punkte: e.punkte })),
      best: localStorage.getItem("mini.best"),
    }));
    pruefe(spur.ewig.length === 1 && spur.ewig[0].game === "towerStack" && spur.ewig[0].punkte > 0,
      `Die Runde aus dem Adminbereich steht nicht unter dem Namen in der ewigen Liste: ${JSON.stringify(spur.ewig)}`);
    pruefe(Boolean(spur.best), "Die Runde aus dem Adminbereich hat keinen Bestwert auf dem Gerät hinterlassen.");
    await kontext.close();
  }

  // --- 4l. Wer vorne liegt, wartet ----------------------------------------------
  // Im Königscup darf spielen, wer nicht allein auf Platz 1 steht. König
  // führt in beiden Spielen und hat deshalb keinen Versuch mehr; Leo liegt
  // im Turmbau hinten, spielt sich nach vorne – und wartet dann selbst.
  {
    const { kontext, seite } = await mitTurnieren("/");
    await seite.waitForSelector(".cm-bar, .mini-kopf", { timeout: 8000 }).catch(() => {});
    const faelle = await seite.evaluate(() => {
      const vorne = window.LernappTurnier.alleinVorne;
      return [
        vorne([{ platz: 1, eigen: true, punkte: 5 }, { platz: 2, eigen: false, punkte: 3 }]),
        vorne([{ platz: 1, eigen: true, punkte: 5 }, { platz: 1, eigen: false, punkte: 5 }]),
        vorne([{ platz: 1, eigen: false, punkte: 5 }, { platz: 2, eigen: true, punkte: 3 }]),
        vorne([{ platz: 1, eigen: true, punkte: 0 }]),
        vorne([]),
      ];
    });
    pruefe(JSON.stringify(faelle) === "[true,false,false,false,false]",
      `Wer allein vorne liegt, wird falsch erkannt (allein, Gleichstand, dahinter, mit null, leer): ${JSON.stringify(faelle)}`);
    await kontext.close();
  }
  const alsKoenig = () => { localStorage.setItem("mini.id", "mini_koenigkoenig"); localStorage.setItem("mini.name", "König"); };
  const alsLeo = () => { localStorage.setItem("mini.id", "mini_leoleoleoleo"); localStorage.setItem("mini.name", "Leo"); };
  {
    const { kontext, seite } = await mitTurnieren(`/turnier?t=${KOENIG}`, { vorher: alsKoenig });
    await seite.waitForSelector(".tn-karte", { timeout: 8000 });
    const text = (await seite.locator("[data-turnier]").innerText()).replace(/\n/g, " ");
    pruefe(await seite.locator(".tn-karte a", { hasText: "Spielen" }).count() === 0, `Wer überall vorne liegt, findet auf der Turnierseite trotzdem «Spielen»: ${text}`);
    // Kein Satz darüber – an der Stelle jedes Knopfs steht «Du liegst vorne».
    pruefe(await seite.locator(".tn-wartet").count() === 0, "Über den Spielen steht wieder ein Satz für den, der überall vorne liegt.");
    pruefe(await seite.locator(".tn-karte .tn-fertig", { hasText: "Du liegst vorne" }).count() === 2, `Wer überall vorne liegt, liest nicht auf jeder Karte «Du liegst vorne»: ${text}`);
    const ohne = await klassenOhneRegel(seite);
    pruefe(ohne.length === 0, `Königscup – Klassen ohne Regel: ${ohne.join(", ")}`);

    // Namen ändern auf der Turnierseite: Wer einen neuen Namen nimmt, ist im
    // Turnier ein neuer Mitspieler. Königs Einträge bleiben, wo sie sind –
    // und der Neue darf spielen.
    pruefe(await seite.locator(".tn-wer .mini-name-steht", { hasText: "König" }).count() === 1, "Auf der Turnierseite steht nicht, unter welchem Namen man spielt.");
    await seite.click(".tn-wer .mini-name-steht button");
    await seite.fill(".tn-wer .mini-namensfeld input", "Prinz");
    await seite.click(".tn-wer .mini-namensfeld button[type=submit]");
    await seite.waitForFunction(() => document.querySelectorAll(".tn-karte a").length === 2, null, { timeout: 4000 }).catch(() => {});
    const neu = await seite.evaluate((id) => ({
      spielen: [...document.querySelectorAll(".tn-karte a")].filter((a) => /Spielen/.test(a.textContent)).length,
      koenig: [...window.__miniTurnierEintraege.values()].filter((e) => e.spieler === "mini_koenigkoenig").map((e) => e.name),
      id: localStorage.getItem("mini.id"),
    }), KOENIG);
    pruefe(neu.spielen === 2, `Nach dem neuen Namen kann im Königscup ${neu.spielen} statt beide Spiele gespielt werden.`);
    pruefe(neu.koenig.length === 2 && neu.koenig.every((n) => n === "König"), `Der neue Name hat Königs Einträge geändert: ${neu.koenig.join(", ")}`);
    pruefe(neu.id !== "mini_koenigkoenig", "Mit dem neuen Namen spielt das Gerät im Turnier noch als König.");
    await kontext.close();
  }
  {
    const { kontext, seite } = await mitTurnieren(`/turnier?t=${KOENIG}`, { vorher: alsLeo });
    await seite.waitForSelector(".tn-karte", { timeout: 8000 });
    const spielen = await seite.locator(".tn-karte a", { hasText: "Spielen" }).count();
    pruefe(spielen === 2, `Wer nirgends vorne liegt, kann im Königscup ${spielen} statt beide Spiele spielen.`);
    pruefe(await seite.locator(".tn-karte .tn-fertig", { hasText: "Du liegst vorne" }).count() === 0, "Wer nirgends vorne liegt, liest, er liege vorne.");
    await kontext.close();
  }
  {
    // Wer allein vorne liegt und das Spiel trotzdem öffnet, landet ohne ein
    // Wort wieder auf der Turnierseite – dort steht «Du liegst vorne».
    const { kontext, seite } = await mitTurnieren(`/turmbau?turnier=${KOENIG}`, { vorher: alsKoenig });
    await seite.waitForURL((url) => url.pathname === "/turnier", { timeout: 8000 }).catch(() => {});
    pruefe(seite.url().endsWith(`/turnier?t=${KOENIG}`), `Wer allein vorne liegt, bleibt im Spiel: ${seite.url()}`);
    await seite.waitForSelector(".tn-karte", { timeout: 8000 }).catch(() => {});
    pruefe(await seite.locator(".tn-karte .tn-fertig", { hasText: "Du liegst vorne" }).count() === 2,
      "Zurück auf der Turnierseite steht nicht bei jedem Spiel «Du liegst vorne».");
    await kontext.close();
  }
  {
    // Leo spielt sich nach vorne. Ein sofortiges «Noch einmal» wartet, bis
    // feststeht, dass er jetzt vorne liegt – und führt dann zurück zum
    // Turnier statt in eine Runde, die nicht zählen dürfte. Den Weg dorthin
    // fängt die Prüfung ab (weg), sonst verliesse sie die Seite.
    const { kontext, seite } = await mitTurnieren(`/turmbau?turnier=${KOENIG}`, { vorher: () => { localStorage.setItem("mini.id", "mini_leoleoleoleo"); localStorage.setItem("mini.name", "Leo"); window.__miniLangsam = 400; } });
    await turnierLos(seite, "Leo");
    const befund = await seite.evaluate(async (id) => {
      const tn = window.LernappTurnier;
      tn.weg = (adresse) => { window.__weg = adresse; };
      tn.rundeBeginnt();
      const block = tn.ergebnis({ punkte: 50 });
      let neu = false;
      tn.neuStart({ los: () => { neu = true; } });
      const sofort = { neu, tor: Boolean(document.querySelector(".tn-tor")) };
      await new Promise((weiter) => setTimeout(weiter, 2500));
      return {
        sofort,
        neu,
        eintrag: window.__miniTurnierEintraege.get(`${id}/towerStack_mini_leoleoleoleo`) || null,
        rekord: block.querySelector(".tn-rekord")?.textContent || "",
        vorne: tn.stand().vorne,
        weg: window.__weg || "",
      };
    }, KOENIG);
    pruefe(befund.eintrag?.punkte === 50 && befund.eintrag?.versuche === 2 && befund.eintrag?.offen === false,
      `Leos Runde kam nicht an: ${JSON.stringify(befund.eintrag)}`);
    pruefe(!befund.sofort.neu, "«Noch einmal» wartet nicht, bis feststeht, ob die Runde nach vorne geführt hat.");
    pruefe(befund.vorne, "Nach der Runde, die nach vorne führte, weiss die Seite nicht, dass Leo vorne liegt.");
    pruefe(befund.rekord === "Neuer Rekord!", `Wer sich auf Platz 1 spielt, liest nicht «Neuer Rekord!»: ${befund.rekord || "nichts"}`);
    pruefe(befund.neu && befund.weg === `/turnier?t=${KOENIG}`, `Wer nach vorne gespielt hat, kommt beim Neustart nicht zurück zum Turnier: ${befund.weg || "nirgends hin"}`);
    await kontext.close();
  }

  // --- 4m. Ein Turnier ohne Zeitlimite -------------------------------------------
  // Es läuft, bis es angehalten wird. Nirgends steht ein Datum im Jahr 9999 –
  // und nirgends "läuft noch 2 Millionen Tage".
  {
    const { kontext, seite } = await mitTurnieren(`/turnier?t=${DAUER}`);
    await seite.waitForSelector(".tn-karte", { timeout: 8000 });
    const text = (await seite.locator("[data-turnier]").innerText()).replace(/\n/g, " ");
    pruefe(/läuft ohne Zeitlimite · seit/.test(text), `Oben auf der Turnierseite ohne Zeitlimite steht: ${await seite.locator(".tn-status").innerText()}`);
    pruefe(!/9999|Tage/.test(text), `Auf der Turnierseite ohne Zeitlimite steht ein Ende: ${text}`);
    pruefe(await seite.locator(".tn-karte a", { hasText: "Spielen" }).count() === 3, "Im Turnier ohne Zeitlimite lässt sich nicht spielen.");
    await kontext.close();
  }
  {
    const { kontext, seite } = await mitTurnieren(`/turmbau?turnier=${DAUER}`, { vorher: alsLeo });
    await seite.waitForFunction(() => window.LernappTurnier?.stand?.().freigegeben, null, { timeout: 8000 }).catch(() => {});
    pruefe(await seite.evaluate(() => window.LernappTurnier.stand().freigegeben && !document.querySelector(".tn-tor")),
      "Im Turnier ohne Zeitlimite geht es mit Namen nicht direkt ins Spiel.");
    await kontext.close();
  }

  // --- 4k. Gegner beim Spielen (geist.js) -----------------------------------------
  // Platz 1 und die eigene Bestmarke: zwei Schalter über der Spielfläche, die
  // sagen, gegen wen es geht, und sich abschalten lassen. Mit Aufzeichnung
  // läuft der Gegner mit; die eigene Runde wird zur nächsten Bestmarke.
  const gegnerSchalter = (seite) => seite.evaluate(() => [...document.querySelectorAll(".gs-chip")].map((c) => ({
    text: c.textContent.replace(/\s+/g, " ").trim(),
    an: c.classList.contains("is-an"),
    leer: c.classList.contains("ist-leer"),
    sichtbar: !c.closest(".gs-leiste").hidden,
  })));
  {
    const MIA = JSON.stringify({ v: 1, dt: 250, p: Array.from({ length: 121 }, (_, i) => Math.floor(i / 4)),
      a: Array.from({ length: 121 }, (_, i) => i * 10), b: Array.from({ length: 121 }, () => 200) });
    const { kontext, seite } = await neueSeite({ width: 900, height: 520 });
    await seite.addInitScript((bahn) => {
      if (sessionStorage.getItem("__gegner")) return;
      sessionStorage.setItem("__gegner", "1");
      localStorage.setItem("__mini_attrappe", JSON.stringify([["vineSwing_mini_miamiamiamia", {
        id: "vineSwing_mini_miamiamiamia", game: "vineSwing", spieler: "mini_miamiamiamia", name: "Mia", punkte: 30, versuche: 2, updatedAtMs: 1000,
      }]]));
      localStorage.setItem("__mini_geister_attrappe", JSON.stringify([["vineSwing_mini_miamiamiamia", {
        game: "vineSwing", spieler: "mini_miamiamiamia", name: "Mia", punkte: 30, level: "s1", bahn,
      }]]));
    }, MIA);
    await seite.goto(`${BASIS}/liane`, { waitUntil: "load" });
    await seite.waitForSelector(".gs-chip", { timeout: 8000 });
    await seite.waitForFunction(() => window.LernappGeist?.stand?.()[0]?.stand, null, { timeout: 4000 }).catch(() => {});
    let schalter = await gegnerSchalter(seite);
    pruefe(schalter.length === 2 && schalter.every((c) => c.sichtbar), `Im Lianenschwung stehen keine zwei Gegner-Schalter: ${JSON.stringify(schalter)}`);
    pruefe(/Platz 1/.test(schalter[0]?.text) && /Mia/.test(schalter[0]?.text) && /30/.test(schalter[0]?.text) && schalter[0]?.an,
      `Platz 1 steht nicht als Gegner da: ${schalter[0]?.text}`);
    pruefe(schalter[1]?.leer && /noch keine/.test(schalter[1]?.text), `Ohne eigene Runde steht trotzdem eine Bestmarke da: ${schalter[1]?.text}`);
    const stand = await seite.evaluate(() => window.LernappGeist.stand()[0].stand);
    pruefe(stand?.erster?.lauf === true, `Der Lauf von Platz 1 läuft nicht mit: ${JSON.stringify(stand)}`);

    // Abschalten bleibt abgeschaltet, auch nach dem Neuladen – und startet
    // keine Runde.
    await seite.click(".gs-erster");
    pruefe(await seite.evaluate(() => JSON.parse(localStorage.getItem("mini.gegner") || "{}").erster) === false, "Platz 1 lässt sich nicht abschalten.");
    pruefe(await seite.evaluate(() => window.LernappLiane.state.phase) === "bereit", "Ein Tipp auf einen Gegner-Schalter hat die Runde gestartet.");
    await seite.reload({ waitUntil: "load" });
    await seite.waitForSelector(".gs-chip", { timeout: 8000 });
    await seite.waitForTimeout(400);
    schalter = await gegnerSchalter(seite);
    pruefe(schalter[0] && !schalter[0].an, "Nach dem Neuladen ist Platz 1 wieder angeschaltet.");
    await seite.click(".gs-erster");

    // Eine kurze Runde: Sie wird aufgezeichnet und ist beim nächsten Mal die
    // Bestmarke, die mitläuft.
    await seite.evaluate(() => new Promise((fertig) => {
      const L = window.LernappLiane;
      const st = L.state;
      let n = 0;
      const lauf = () => {
        n += 1;
        if (st.phase === "ende" || st.schritt === "platsch") { fertig(); return; }
        if (st.phase === "bereit") L.druecken();
        else if (st.schritt === "schwingen" && n > 50) L.loslassen();
        requestAnimationFrame(lauf);
      };
      requestAnimationFrame(lauf);
    }));
    await seite.waitForSelector(".cm-result-score", { timeout: 8000 });
    const runde = await seite.evaluate(() => ({
      punkte: window.LernappLiane.state.punkte,
      lauf: window.LernappGeist.eigenerLauf("vineSwing", "s1"),
    }));
    const gelesen = runde.lauf ? await seite.evaluate((bahn) => window.LernappGeist.entpacke(bahn), runde.lauf.bahn) : null;
    pruefe(runde.punkte > 0 && runde.lauf?.punkte === runde.punkte && gelesen?.p?.length > 2 && Array.isArray(gelesen?.a),
      `Die Runde wurde nicht als eigener Lauf aufgezeichnet: ${JSON.stringify({ punkte: runde.punkte, lauf: runde.lauf?.punkte, proben: gelesen?.p?.length })}`);
    await seite.click(".cm-actions .cm-icon-again");
    await seite.waitForFunction(() => window.LernappGeist.stand()[0]?.stand?.eigen, null, { timeout: 4000 }).catch(() => {});
    const danach = await seite.evaluate(() => window.LernappGeist.stand()[0].stand);
    pruefe(danach?.eigen?.punkte === runde.punkte && danach.eigen.lauf === true,
      `Die eigene Runde steht danach nicht als Bestmarke da: ${JSON.stringify(danach)}`);
    await kontext.close();
  }
  {
    // Im Turnier ist Platz 1, wer im Turnier vorne liegt – nicht der aus der
    // Hall of Fame (dort hat Grosi 99).
    const { kontext, seite } = await mitTurnieren(`/turmbau?turnier=${HERBST}`);
    await turnierLos(seite, "Gegnertest");
    await seite.waitForTimeout(600);
    const schalter = await gegnerSchalter(seite);
    pruefe(/Grosi/.test(schalter[0]?.text) && /30/.test(schalter[0]?.text) && !/99/.test(schalter[0]?.text),
      `Im Turnier steht nicht dessen Platz 1 als Gegner: ${schalter[0]?.text}`);
    await kontext.close();
  }
  {
    const { kontext, seite } = await mitTurnieren("/turmbau?turnier=verdeckt-test23456");
    await turnierLos(seite, "Gegnertest");
    await seite.waitForTimeout(600);
    const schalter = await gegnerSchalter(seite);
    pruefe(/verdeckt/.test(schalter[0]?.text) && !/Leo/.test(schalter[0]?.text),
      `Bei verdeckter Rangliste verrät der Gegner-Schalter Platz 1: ${schalter[0]?.text}`);
    await kontext.close();
  }
  {
    const { kontext, seite } = await mitTurnieren(`/turmbau?turnier=${OHNE_GEGNER}`);
    await turnierLos(seite, "Gegnertest");
    await seite.waitForTimeout(600);
    const schalter = await gegnerSchalter(seite);
    pruefe(schalter.length && schalter.every((c) => !c.sichtbar), `Im Turnier ohne Gegner stehen trotzdem Gegner-Schalter: ${JSON.stringify(schalter)}`);
    pruefe(await seite.evaluate(() => !document.querySelector("#tb-stage").dataset.gegner), "Im Turnier ohne Gegner rückt die Spielfläche trotzdem nach unten.");
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
