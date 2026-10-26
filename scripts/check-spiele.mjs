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
const UNSER = /^(cm|mini|tn|gk|ar|kk|ft|bs|tb|br|dr|li|tf|dt|ph|ml|sl|hf|bl|sk|fr|wr|kh|st|zg|hz|gs|jg|sj|fs|hl|fm|nj|scene|sound|confetti)(-|$)/;
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
    setzeOffeneSpiele: async (liste) => {
      // Wie die Datenbank, wenn ihre Regeln ablehnen.
      if (window.__miniSpeichernScheitert) throw Object.assign(new Error("Missing or insufficient permissions."), { code: "permission-denied" });
      window.__miniOffen = liste;
      return liste;
    },
    tiers: async () => window.__miniTiers ?? null,
    setzeTiers: async (einteilung) => { window.__miniTiers = { ...einteilung }; return window.__miniTiers; },
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
    // Wie cloud.js: genau dieser Name, aus allen Spielen.
    unterNamen: async (name) => {
      if (window.__miniOhneNetz) throw new Error("kein Netz");
      return [...eintraege.values()].filter((e) => e.name === name).map((e) => ({ ...e }));
    },
    speichere: async ({ game, spieler, name, punkte, ms = 0 }) => {
      const id = game + "_" + spieler;
      const alt = eintraege.get(id);
      if (!alt) {
        eintraege.set(id, { id, game, spieler, name, punkte, versuche: 1, spielMs: ms, updatedAtMs: Date.now() });
        sichern();
        return { rekord: true, punkte, versuche: 1 };
      }
      const rekord = punkte > alt.punkte;
      eintraege.set(id, { ...alt, name, punkte: rekord ? punkte : alt.punkte, versuche: alt.versuche + 1, spielMs: (alt.spielMs || 0) + ms, updatedAtMs: Date.now() });
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
          get: async () => {
            const d = sammlung === "miniGeister" ? geisterLager.get(id) : eintraege.get(id);
            return { id, exists: Boolean(d), data: () => (d ? { ...d } : undefined) };
          },
          delete: async () => {
            if (sammlung === "miniGeister") { geisterLager.delete(id); gSichern(); return; }
            eintraege.delete(id);
            sichern();
          },
          set: async (daten, wie = {}) => {
            if (sammlung === "miniGeister") {
              geisterLager.set(id, { ...(wie.merge ? geisterLager.get(id) : {}), ...daten });
              gSichern();
              return;
            }
            eintraege.set(id, { ...eintraege.get(id), ...daten, id });
            sichern();
          },
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
    // Der Multiplayer zu einem Turnier (live.js, turnierLive/<turnier>): Die
    // Prüfung legt ihn in window.__miniLiveZeiger hin.
    liveZeiger: async (id) => (window.__miniLiveZeiger || {})[id] || null,
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
async function neueSeite(viewport = { width: 420, height: 820 }, { handy = false, bewegung = "" } = {}) {
  const kontext = await browser.newContext({ viewport, serviceWorkers: "block", ...(handy ? { hasTouch: true, isMobile: true } : {}), ...(bewegung ? { reducedMotion: bewegung } : {}) });
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
    turnierVorlage(GESCHICK, { name: "Geschickcup", sichtbar: "link", startMs: JETZT - 10 * MINUTE, spiele: ["bridgeBuilder", "dartWheel", "vineSwing", "tunnelFlight", "driftRace", "planetHop", "moonLander", "gravityRun", "hillGlide", "balloonRide", "skiSlalom", "frogHop", "ropeWalk", "craneHarbor", "wireLoop", "twinLanes", "keepyUppy", "juggler", "skiJump", "skyDive", "lumberCut", "batEcho", "timeNinja"], versuche: 0 }),
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
        vorlesen: Boolean(document.querySelector(".help-voice, .help-voice-button")),
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
    pruefe(!stand.vorlesen, `${spiel.seite}: Oben links steht noch der violette Vorlese-Knopf aus der App.`);
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

  // --- 2c. Ein Name auf zwei Geräten ----------------------------------------------
  // So stand es im Oktober 2026 in der Datenbank: "Alain" am Tablet (viele
  // Runden, 36 Blöcke) und am Handy (wenige Runden, 32 Blöcke). Die Liste
  // zeigte einmal Alain mit 36 – die Bestmarke am Handy aber 32. Derselbe
  // Name ist derselbe Spieler: Die Bestmarke ist die 36, das Handy spielt ab
  // jetzt unter der Kennung des Tablets, und der Adminbereich führt die
  // alten Einträge zusammen.
  {
    const TABLET = "mini_tablettablet";
    const HANDY = "mini_handyhandy01";
    const BAHN = JSON.stringify({ v: 2, dt: 100, p: [0, 5025], a: [0, 40], b: [0, 0], c: [0, 0], s: 7 });
    const kontext = await browser.newContext({ viewport: { width: 420, height: 820 }, serviceWorkers: "block" });
    const seite = await kontext.newPage();
    const fehlerHier = [];
    seite.on("pageerror", (fehler) => fehlerHier.push(String(fehler.message || fehler)));
    seite.on("dialog", (frage) => frage.accept());
    await seite.addInitScript(({ TABLET, HANDY, BAHN }) => {
      if (sessionStorage.getItem("__zweiGeraete")) return;
      sessionStorage.setItem("__zweiGeraete", "1");
      const e = (game, spieler, punkte, versuche) => [`${game}_${spieler}`, { id: `${game}_${spieler}`, game, spieler, name: "Alain", punkte, versuche, erstesMs: 1000 + versuche, updatedAtMs: 1000 }];
      localStorage.setItem("__mini_attrappe", JSON.stringify([
        e("towerStack", TABLET, 36, 45), e("boilerRoom", TABLET, 329, 17), e("tunnelFlight", TABLET, 1571, 2),
        e("towerStack", HANDY, 32, 3), e("boilerRoom", HANDY, 384, 33), e("tunnelFlight", HANDY, 578, 1), e("hillGlide", HANDY, 5025, 4),
        ["towerStack_mini_joshuajoshua", { id: "towerStack_mini_joshuajoshua", game: "towerStack", spieler: "mini_joshuajoshua", name: "Joshua", punkte: 42, versuche: 16, updatedAtMs: 900 }],
      ]));
      localStorage.setItem("__mini_geister_attrappe", JSON.stringify([
        [`hillGlide_${HANDY}`, { game: "hillGlide", spieler: HANDY, name: "Alain", punkte: 5025, level: "t1", bahn: BAHN }],
      ]));
      localStorage.setItem("mini.id", HANDY);
      localStorage.setItem("mini.name", "Alain");
      localStorage.setItem("mini.best", JSON.stringify({ towerStack: 32 }));
    }, { TABLET, HANDY, BAHN });
    await seite.route("**/cloud.js*", (route) => route.fulfill({ contentType: "text/javascript; charset=utf-8", body: ATTRAPPE }));
    await seite.route("https://www.gstatic.com/firebasejs/**", (route) => {
      if (route.request().url().includes("auth-compat")) {
        return route.fulfill({ contentType: "text/javascript; charset=utf-8", body: `
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
        ` });
      }
      return route.fulfill({ contentType: "text/javascript; charset=utf-8", body: "/* in der Prüfung nicht gebraucht */" });
    });

    // Turmbau am Handy: Die Bestmarke ist die beste Zahl unter dem Namen.
    await seite.goto(`${BASIS}/turmbau`, { waitUntil: "load" });
    await seite.waitForFunction(() => window.LernappMini?.bestwertAbgeglichen?.("towerStack"), null, { timeout: 6000 }).catch(() => {});
    await seite.waitForFunction(() => window.LernappGeist?.stand?.()[0]?.stand?.eigen, null, { timeout: 4000 }).catch(() => {});
    const turm = await seite.evaluate(() => ({
      id: localStorage.getItem("mini.id"),
      best: JSON.parse(localStorage.getItem("mini.best") || "{}").towerStack,
      eigen: window.LernappGeist.stand()[0]?.stand?.eigen || null,
    }));
    pruefe(turm.best === 36 && turm.eigen?.punkte === 36, `Am zweiten Gerät ist die Bestmarke nicht die beste Zahl unter dem Namen: ${JSON.stringify(turm)}`);
    pruefe(turm.id === TABLET, `Das zweite Gerät spielt nicht unter der Kennung, unter der der Name am meisten gespielt hat: ${turm.id}`);

    // Eine Runde: Sie kommt zu den Einträgen des Tablets, nicht zu neuen.
    pruefe(await spieleTurmbauZuEnde(seite), "Die Runde am zweiten Gerät kam zu keinem Ergebnis.");
    await seite.waitForSelector(".mini-ergebnis .mini-zeile", { timeout: 6000 });
    const nachRunde = await seite.evaluate(({ TABLET, HANDY }) => ({
      tablet: window.__miniEintraege.get(`towerStack_${TABLET}`)?.versuche,
      handy: window.__miniEintraege.get(`towerStack_${HANDY}`)?.versuche,
      zeilen: [...document.querySelectorAll(".mini-ergebnis .mini-zeile")].map((z) => z.textContent.replace(/\s+/g, " ").trim()),
      meldung: document.querySelector(".mini-ergebnis .mini-meldung")?.textContent || "",
      best: JSON.parse(localStorage.getItem("mini.best") || "{}").towerStack,
    }), { TABLET, HANDY });
    pruefe(nachRunde.tablet === 46 && nachRunde.handy === 3, `Die Runde am zweiten Gerät ging nicht zu den Einträgen des Namens: ${JSON.stringify(nachRunde)}`);
    pruefe(nachRunde.zeilen.filter((z) => z.includes("Alain")).length === 1, `Alain steht mehrmals in der Liste: ${nachRunde.zeilen.join(" | ")}`);
    pruefe(nachRunde.best >= 36 && !/Neue Bestzahl/.test(nachRunde.meldung), `Nach einer schwächeren Runde: Bestwert ${nachRunde.best}, «${nachRunde.meldung}»`);

    // Hügelflieger: Die Bestmarke stammt vom anderen Gerät – mit ihrem Lauf.
    await seite.goto(`${BASIS}/huegel`, { waitUntil: "load" });
    await seite.waitForFunction(() => window.LernappGeist?.stand?.()[0]?.stand?.eigen, null, { timeout: 6000 }).catch(() => {});
    const huegel = await seite.evaluate(() => window.LernappGeist.stand()[0]?.stand?.eigen || null);
    pruefe(huegel?.punkte === 5025 && huegel.lauf, `Die Bestmarke vom anderen Gerät kommt ohne ihren Lauf: ${JSON.stringify(huegel)}`);

    // Der Adminbereich führt zusammen: je Spiel ein Eintrag, die beste Zahl,
    // alle Runden – und der Lauf zieht mit.
    await seite.goto(`${BASIS}/admin`, { waitUntil: "load" });
    // Zugeklappt, bis die Kachel "Spieler" die Spieler aufklappt.
    await seite.locator(".adm-streifen .adm-kachel", { hasText: "Spieler" }).click();
    pruefe(await seite.locator(".adm-kopf .ar-marke svg path").count() === 5, "Im Adminbereich fehlt oben das Logo.");
    const zeile = seite.locator(".adm-tabelle tr", { has: seite.locator("td.adm-name", { hasText: "auf 2 Geräten" }) });
    await zeile.waitFor({ timeout: 8000 }).catch(() => {});
    pruefe(await zeile.count() === 1, "Im Adminbereich steht nicht, dass Alain auf zwei Geräten spielt.");
    if (await zeile.count()) {
      await zeile.locator("button", { hasText: "Zusammenführen" }).click();
      await seite.waitForFunction((h) => ![...window.__miniEintraege.values()].some((e) => e.spieler === h), HANDY, { timeout: 6000 }).catch(() => {});
    }
    const zusammen = await seite.evaluate(({ TABLET, HANDY }) => ({
      alain: Object.fromEntries([...window.__miniEintraege.values()].filter((e) => e.name === "Alain").map((e) => [e.game, `${e.spieler === TABLET ? "T" : e.spieler === HANDY ? "H" : e.spieler}:${e.punkte}/${e.versuche}`])),
      geister: [...window.__miniGeister.keys()],
    }), { TABLET, HANDY });
    pruefe(JSON.stringify(zusammen.alain) === JSON.stringify({ towerStack: "T:36/49", boilerRoom: "T:384/50", tunnelFlight: "T:1571/3", hillGlide: "T:5025/4" }),
      `Nach dem Zusammenführen steht Alain so da: ${JSON.stringify(zusammen.alain)}`);
    pruefe(zusammen.geister.includes(`hillGlide_${TABLET}`) && !zusammen.geister.some((k) => k.endsWith(HANDY)),
      `Der Lauf ist nicht mit umgezogen: ${zusammen.geister.join(", ")}`);
    pruefe(await seite.locator("td.adm-name", { hasText: "auf 2 Geräten" }).count() === 0, "Nach dem Zusammenführen steht Alain noch auf zwei Geräten.");
    pruefe(fehlerHier.length === 0, `Fehler beim Zusammenführen: ${fehlerHier.join(" | ")}`);
    await kontext.close();
  }

  // --- 3. Die Startseite (arcade) ------------------------------------------------
  // Ein Bildschirm, ohne Scrollen: oben der Film, die Leiste mit Name,
  // Rangliste und Play, unten alle Spiele. Die Ranglisten stehen nicht da –
  // ein Tipp auf den Knopf öffnet sie, den Pokal oben die Gesamtwertung.
  for (const [breit, hoch] of [[420, 820], [1280, 720]]) {
    const wo = `${breit} × ${hoch}`;
    const { kontext, seite } = await neueSeite({ width: breit, height: hoch });
    await seite.goto(`${BASIS}/`, { waitUntil: "load" });
    await seite.waitForSelector(".ar-kachel", { timeout: 8000 });
    await seite.waitForFunction(() => /Grosi/.test(document.querySelector(".ar-rang")?.textContent || ""), null, { timeout: 8000 }).catch(() => {});
    const text = await seite.locator(".mini-seite").innerText();
    pruefe(/\barcade\b/i.test(text) && !/alae/i.test(text), `${wo}: Auf der Startseite steht nicht, wo man ist.`);
    pruefe(await seite.locator(".ar-kopf .ar-marke svg path").count() === 5 && (await seite.locator(".ar-kopf .ar-marke-wort").innerText()) === "arcade",
      `${wo}: Das Logo fehlt (die zwei Winkel als Pixel und «arcade»).`);
    pruefe(await seite.locator(".ar-kachel").count() === SPIELE.length,
      `${wo}: Auf der Startseite stehen ${await seite.locator(".ar-kachel").count()} Spiele statt ${SPIELE.length}.`);
    pruefe(await seite.locator(".ar-kopf .ar-name-knopf").count() === 1, `${wo}: Auf der Startseite fehlt der Name zum Ändern.`);
    // Kein Text über das Spiel ausser seinem Namen, und keine Rangliste, bevor
    // jemand sie öffnet.
    pruefe(!/Tempo & Geschick|Tippe, wenn/.test(text), `${wo}: Auf der Startseite steht noch Text zum Spiel: ${text.slice(0, 200)}`);
    pruefe(await seite.locator(".gk-zeile, .mini-tabelle").count() === 0, `${wo}: Eine Rangliste steht offen da, bevor jemand sie öffnet.`);
    pruefe(/Grosi/.test(await seite.locator(".ar-rang").innerText()), `${wo}: Im Knopf zur Rangliste steht nicht, wer vorne liegt.`);
    const mass = await seite.evaluate(() => ({
      blatt: document.documentElement.scrollHeight,
      breite: document.documentElement.scrollWidth,
      unten: document.querySelector(".ar-auswahl").getBoundingClientRect().bottom,
      kachel: document.querySelector(".ar-kachel").getBoundingClientRect().bottom,
      fenster: window.innerHeight,
    }));
    pruefe(mass.blatt <= mass.fenster + 1 && mass.unten <= mass.fenster + 1 && mass.kachel <= mass.fenster,
      `${wo}: Die Startseite passt nicht auf einen Bildschirm: ${JSON.stringify(mass)}`);
    pruefe(mass.breite <= breit + 1, `${wo}: Die Startseite steht ${mass.breite - breit} px über den rechten Rand.`);
    const spielen = await seite.getAttribute(".ar-play", "href");
    pruefe(SPIELE.some((s) => spielen === `/${s.seite}`), `${wo}: Der Play-Knopf zeigt auf ${spielen}.`);
    pruefe(!(await seite.locator(".ar-play").innerText()).trim(), `${wo}: Auf dem Play-Knopf steht Text.`);
    const gefragt = await seite.evaluate(() => window.__miniGefragt || []);
    pruefe(gefragt.length === SPIELE.length, `${wo}: Die Startseite fragt nach ${gefragt.length} Spielen statt nach ${SPIELE.length}.`);
    pruefe(await seite.locator('a[href*="kids.alae.app"]').count() === 0, `${wo}: Auf der Startseite steht ein Link auf kids.alae.app.`);

    // Die Rangliste im Fenster – ohne die Runden je Spieler: Wie oft jemand
    // gespielt hat, geht niemanden etwas an.
    await seite.click(".ar-rang");
    await seite.waitForSelector(".ar-fenster .gk-zeile", { timeout: 4000 }).catch(() => {});
    const zeilen = await seite.locator(".ar-fenster .gk-zeile").allInnerTexts();
    pruefe(zeilen.length >= 1 && /Grosi/.test(zeilen[0]), `${wo}: Die Rangliste im Fenster stimmt nicht: ${zeilen.join(" | ")}`);
    const mitRunden = zeilen.filter((z) => /runde/i.test(z));
    pruefe(mitRunden.length === 0, `${wo}: In der Rangliste eines Spiels stehen die Runden: ${mitRunden.join(" | ")}`);
    await seite.keyboard.press("Escape");
    await seite.waitForTimeout(200);
    pruefe(await seite.locator(".ar-fenster").count() === 0, `${wo}: Escape schliesst die Rangliste nicht.`);

    // Die Gesamtwertung: hinter dem Pokal.
    await seite.click(".ar-pokal");
    await seite.waitForSelector(".ar-fenster .mini-tabelle", { timeout: 4000 }).catch(() => {});
    pruefe(await seite.locator(".ar-fenster .mini-tabelle tbody tr").count() >= 1, `${wo}: Hinter dem Pokal steht keine Gesamtwertung.`);
    const kopfzeilen = await seite.locator(".ar-fenster .mini-tabelle th").allTextContents();
    pruefe(kopfzeilen.some((z) => /rang/i.test(z)), `${wo}: In der Gesamtwertung fehlt der Durchschnittsrang (Spalten: ${kopfzeilen.join(", ")}).`);
    pruefe(!kopfzeilen.some((z) => /runde/i.test(z)), `${wo}: In der Auswertung stehen die Runden je Spieler (Spalten: ${kopfzeilen.join(", ")}).`);
    // Ein Tipp neben das Fenster schliesst es.
    await seite.mouse.click(5, hoch - 5);
    await seite.waitForTimeout(200);
    pruefe(await seite.locator(".ar-fenster").count() === 0, `${wo}: Ein Tipp neben die Gesamtwertung schliesst sie nicht.`);
    await kontext.close();
  }

  // --- 3b. Die Bühne: das Bild, der Wechsel, das Wischen ------------------------
  // Oben steht zuerst der erste Favorit (Turmbau), als Bild aus bilder/ – auf
  // dem Handy hochkant aufgenommen, quer daneben die Leiste. Ein Tipp auf
  // eine Kachel holt ein anderes Spiel nach oben, ein Wisch über das Bild das
  // nächste oder das vorige – ohne das Spiel zu starten; ein Tipp aufs Bild
  // startet es. Mit weniger Bewegung gleitet nichts, sonst ist alles gleich.
  for (const bewegung of ["no-preference", "reduce"]) {
    const { kontext, seite } = await neueSeite({ width: 420, height: 820 }, { bewegung });
    await seite.goto(`${BASIS}/`, { waitUntil: "load" });
    await seite.waitForSelector(".ar-kachel", { timeout: 8000 });
    await seite.waitForFunction(() => /Grosi/.test(document.querySelector(".ar-rang")?.textContent || ""), null, { timeout: 8000 }).catch(() => {});
    await seite.waitForTimeout(900);
    const buehne = () => seite.evaluate(() => {
      const film = document.querySelector(".ar-film.ist-an");
      return {
        titel: document.querySelector(".ar-titel")?.textContent,
        play: document.querySelector(".ar-play")?.getAttribute("href"),
        name: document.querySelector(".ar-play")?.getAttribute("aria-label"),
        film: film ? new URL(film.currentSrc || film.src, location.href).pathname : "",
        link: document.querySelector(".ar-filme")?.getAttribute("href"),
        rekord: document.querySelector(".ar-rang-text strong")?.textContent,
        aktiv: document.querySelector(".ar-kachel.ist-aktiv")?.dataset.spiel,
      };
    });
    const vorher = await buehne();
    pruefe(vorher.titel === "Turmbau" && vorher.play === "/turmbau" && vorher.name === "Turmbau spielen" && vorher.aktiv === "towerStack",
      `${bewegung}: Oben steht nicht der Turmbau mit seinem Play-Knopf: ${JSON.stringify(vorher)}`);
    pruefe(vorher.film === "/bilder/turmbau-hoch.webp" && vorher.link === "/turmbau", `${bewegung}: Oben steht nicht das hochkant aufgenommene Bild, das ins Spiel führt: ${JSON.stringify(vorher)}`);
    // Hochkant steht der Film als Fenster in seiner Form (9:16), ohne Rand
    // darin, und die Leiste darunter.
    const fenster = await seite.evaluate(() => {
      const f = document.querySelector(".ar-filme").getBoundingClientRect();
      const l = document.querySelector(".ar-leiste").getBoundingClientRect();
      return { form: f.width / f.height, leisteDarunter: l.top >= f.bottom - 1, passt: getComputedStyle(document.querySelector(".ar-film")).objectFit };
    });
    pruefe(Math.abs(fenster.form - 9 / 16) < 0.02 && fenster.leisteDarunter && fenster.passt === "cover",
      `${bewegung}: Hochkant steht der Film nicht in seiner Form (9:16) über der Leiste: ${JSON.stringify(fenster)}`);
    pruefe(vorher.rekord === "Grosi", `${bewegung}: Im Knopf zur Rangliste steht nicht der Rekord: ${JSON.stringify(vorher)}`);
    pruefe(await seite.locator("video").count() === 0, `${bewegung}: Auf der Startseite läuft noch ein Film.`);
    await seite.locator('.ar-kachel[data-spiel="fishPond"]').click();
    await seite.waitForTimeout(900);
    const nachher = await buehne();
    pruefe(nachher.titel === "Fischteich" && nachher.play === "/fischteich" && nachher.film === "/bilder/fischteich-hoch.webp" && nachher.link === "/fischteich" && nachher.aktiv === "fishPond" && nachher.rekord === "Grosi",
      `${bewegung}: Eine Kachel holt ihr Spiel nicht nach oben: ${JSON.stringify(nachher)}`);
    // Wischen: nach links das nächste Spiel der Zeile, nach rechts zurück.
    const reihe = await seite.evaluate(() => [...document.querySelectorAll(".ar-kachel")].map((k) => k.dataset.spiel));
    const kasten = await seite.locator(".ar-filme").boundingBox();
    const wische = async (von, bis) => {
      await seite.mouse.move(kasten.x + kasten.width * von, kasten.y + kasten.height / 2);
      await seite.mouse.down();
      await seite.mouse.move(kasten.x + kasten.width * bis, kasten.y + kasten.height / 2 + 4, { steps: 5 });
      await seite.mouse.up();
      await seite.waitForTimeout(700);
      return buehne();
    };
    const links = await wische(0.75, 0.3);
    pruefe(links.aktiv === reihe[reihe.indexOf("fishPond") + 1], `${bewegung}: Ein Wisch nach links bringt nicht das nächste Spiel: ${JSON.stringify(links)}`);
    const rechts = await wische(0.3, 0.75);
    pruefe(rechts.aktiv === "fishPond" && rechts.titel === "Fischteich", `${bewegung}: Ein Wisch nach rechts bringt nicht das vorige Spiel: ${JSON.stringify(rechts)}`);
    pruefe(new URL(seite.url()).pathname === "/", `${bewegung}: Ein Wisch über das Bild hat das Spiel gestartet: ${seite.url()}`);
    const ohne = await klassenOhneRegel(seite);
    pruefe(ohne.length === 0, `${bewegung}: Startseite – Klassen ohne Regel: ${ohne.join(", ")}`);
    // Ein Tipp aufs Bild startet das Spiel.
    await Promise.all([
      seite.waitForURL((u) => u.pathname === "/fischteich", { timeout: 6000 }).catch(() => {}),
      seite.click(".ar-filme"),
    ]);
    pruefe(new URL(seite.url()).pathname === "/fischteich", `${bewegung}: Ein Tipp aufs Bild startet das Spiel nicht: ${seite.url()}`);
    await kontext.close();
  }
  // Quer auf dem Handy: das Bild quer aufgenommen, die Leiste daneben, die
  // Zeile darunter – alles auf einem Bildschirm.
  {
    const { kontext, seite } = await neueSeite({ width: 844, height: 390 }, { handy: true });
    await seite.goto(`${BASIS}/`, { waitUntil: "load" });
    await seite.waitForSelector(".ar-kachel", { timeout: 8000 });
    await seite.waitForTimeout(600);
    const quer = await seite.evaluate(() => {
      const r = (s) => document.querySelector(s).getBoundingClientRect();
      const film = document.querySelector(".ar-film.ist-an");
      return {
        film: film ? new URL(film.currentSrc || film.src, location.href).pathname : "",
        filmRechts: r(".ar-filme").right,
        filmForm: r(".ar-filme").width / r(".ar-filme").height,
        leisteLinks: r(".ar-leiste").left,
        playUnten: r(".ar-play").bottom,
        kachelUnten: r(".ar-kachel").bottom,
        fenster: window.innerHeight,
        blatt: document.documentElement.scrollHeight,
      };
    });
    pruefe(quer.film === "/bilder/turmbau-quer.webp", `Quer: Oben steht nicht das quer aufgenommene Bild: ${quer.film}`);
    pruefe(Math.abs(quer.filmForm - 16 / 9) < 0.03, `Quer: Der Film steht nicht in seiner Form (16:9), sondern ${quer.filmForm.toFixed(2)} – mit Rand oder abgeschnitten.`);
    pruefe(quer.leisteLinks >= quer.filmRechts && quer.playUnten <= quer.fenster && quer.kachelUnten <= quer.fenster && quer.blatt <= quer.fenster + 1,
      `Quer: Film, Leiste und Zeile stehen nicht nebeneinander in einem Bild: ${JSON.stringify(quer)}`);
    await kontext.close();
  }
  // Im Turnier steht dieselbe Bühne: das Bild, Play ins Turnier, und unten
  // nur die Spiele des Turniers.
  for (const viewport of [{ width: 420, height: 820 }, { width: 900, height: 520 }]) {
    const { kontext, seite } = await neueSeite(viewport);
    await seite.addInitScript((daten) => { window.__miniTurniereAnfang = daten; }, TURNIERE);
    await seite.goto(`${BASIS}/turnier?t=${HERBST}`, { waitUntil: "load" });
    await seite.waitForSelector(".ar-kachel", { timeout: 8000 });
    await seite.waitForTimeout(700);
    const tn = await seite.evaluate(() => {
      const film = document.querySelector(".ar-film.ist-an");
      const r = (wahl) => document.querySelector(wahl)?.getBoundingClientRect();
      return {
        film: film ? new URL(film.currentSrc || film.src, location.href).pathname : "",
        play: document.querySelector(".ar-play")?.getAttribute("href"),
        link: document.querySelector(".ar-filme")?.getAttribute("href"),
        spiele: [...document.querySelectorAll(".ar-kachel")].map((k) => k.dataset.spiel),
        wertungUnten: r(".tn-wertung")?.bottom,
        filmOben: r(".ar-filme")?.top,
        kachelUnten: r(".ar-kachel")?.bottom,
        fenster: window.innerHeight,
        blatt: document.documentElement.scrollHeight,
      };
    });
    const wo = `Turnier ${viewport.width}×${viewport.height}`;
    pruefe(/^\/bilder\/turmbau-(hoch|quer)\.webp$/.test(tn.film) && tn.play === `/turmbau?turnier=${HERBST}` && tn.link === tn.play,
      `${wo}: Oben steht nicht das Bild des Turmbaus, das ins Turnier führt: ${JSON.stringify(tn)}`);
    pruefe(JSON.stringify(tn.spiele) === JSON.stringify(["towerStack", "fishPond", "numberLine"]), `${wo}: In der Zeile stehen nicht die Spiele des Turniers: ${tn.spiele.join(", ")}`);
    pruefe(tn.wertungUnten <= tn.filmOben + 1 && tn.kachelUnten <= tn.fenster && tn.blatt <= tn.fenster + 1,
      `${wo}: Gesamtwertung, Bild und Zeile stehen nicht übereinander in einem Bild: ${JSON.stringify(tn)}`);
    await kontext.close();
  }

  // --- 3a. Das Vollbild bleibt über Seitenwechsel ------------------------------
  // Im Browser endet ein Vollbild mit jedem Seitenwechsel. Hier nicht: Die
  // Seite, auf der es begann, bleibt stehen, und die nächsten öffnen sich in
  // ihrem Rahmen (vollbild.js) – wie in der installierten App.
  {
    const { kontext, seite } = await neueSeite();
    await seite.goto(`${BASIS}/`, { waitUntil: "load" });
    await seite.waitForSelector(".ar-kachel", { timeout: 8000 });
    pruefe(await seite.locator(".ar-kopf .mini-vollbild").count() === 1, "Auf der Startseite fehlt der Knopf fürs Vollbild.");
    const lage = () => seite.evaluate(() => {
      const r = window.LernappVollbild?.rahmen?.();
      let innen = null;
      try { innen = r ? r.contentWindow.location.pathname : null; } catch { innen = "fremd"; }
      return { voll: Boolean(document.fullscreenElement), pfad: window.location.pathname, innen, titel: document.title };
    });
    if (await seite.locator(".ar-kopf .mini-vollbild").count()) {
      await seite.click(".ar-kopf .mini-vollbild");
      await seite.waitForFunction(() => Boolean(document.fullscreenElement), null, { timeout: 3000 }).catch(() => {});
      const spiel = SPIELE.find((s) => s.seite === "turmbau");
      await seite.click(`.ar-play[href="/${spiel.seite}"]`);
      await seite.waitForFunction(() => window.LernappVollbild?.rahmen?.()?.contentDocument?.querySelector(".cm-bar"), null, { timeout: 8000 }).catch(() => {});
      let jetzt = await lage();
      pruefe(jetzt.voll && jetzt.innen === `/${spiel.seite}` && jetzt.pfad === `/${spiel.seite}` && jetzt.titel.includes(spiel.titel),
        `Nach dem Weg ins Spiel ist das Vollbild weg oder die Seite nicht im Rahmen: ${JSON.stringify(jetzt)}`);
      const innen = seite.frameLocator("iframe[data-vollbild-rahmen]");
      pruefe(await innen.locator(".cm-vollbild").getAttribute("aria-pressed").catch(() => null) === "true",
        "Im Rahmen zeigt der Knopf im Spiel nicht, dass Vollbild ist.");
      await innen.locator(".cm-bar-left a").first().click();
      await seite.waitForFunction(() => window.LernappVollbild?.rahmen?.()?.contentDocument?.querySelector(".ar-kopf") && window.location.pathname === "/", null, { timeout: 8000 }).catch(() => {});
      jetzt = await lage();
      pruefe(jetzt.voll && jetzt.innen === "/" && jetzt.pfad === "/", `Nach dem Weg zurück ist das Vollbild weg: ${JSON.stringify(jetzt)}`);
      await seite.goBack();
      await seite.waitForFunction((pfad) => window.location.pathname === pfad && window.LernappVollbild?.rahmen?.()?.contentDocument?.querySelector(".cm-bar"), `/${spiel.seite}`, { timeout: 8000 }).catch(() => {});
      jetzt = await lage();
      pruefe(jetzt.voll && jetzt.innen === `/${spiel.seite}`, `Der Zurück-Weg des Browsers führt nicht ins Spiel zurück: ${JSON.stringify(jetzt)}`);
      await seite.goBack();
      await seite.waitForFunction(() => window.LernappVollbild?.rahmen?.()?.contentDocument?.querySelector(".ar-kopf") && window.location.pathname === "/", null, { timeout: 8000 }).catch(() => {});
      jetzt = await lage();
      pruefe(jetzt.voll && jetzt.innen === "/" && jetzt.pfad === "/", `Zweimal zurück steht nicht die erste Seite da: ${JSON.stringify(jetzt)}`);
      await innen.locator(".ar-kopf .mini-vollbild").click();
      await seite.waitForFunction(() => !document.fullscreenElement, null, { timeout: 3000 }).catch(() => {});
      pruefe(!(await lage()).voll, "Mit dem Knopf im Rahmen endet das Vollbild nicht.");
    }
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
    await seite.waitForSelector(".ar-kachel", { timeout: 8000 });
    const karten = await seite.locator(".ar-kachel-titel").allInnerTexts();
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
    pruefe(await seite.locator(".ar-kachel").count() === 0,
      "Es ist kein Spiel freigegeben, trotzdem steht eine Kachel da.");
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
    await seite.waitForSelector(".ar-kachel", { timeout: 8000 });
    pruefe(await seite.locator(".ar-kachel").count() === offen.length,
      "Schon mit Netz stimmt die Zahl der Kacheln nicht – der Rest der Prüfung sagt dann nichts.");

    // Kein Netz mehr, und auch die Antwort von vorhin ist weg: Was die Seite
    // jetzt zeigt, kann nur aus dem Gerät kommen.
    await seite.addInitScript(() => { window.__miniOhneNetz = true; delete window.__miniOffen; });
    await seite.reload({ waitUntil: "load" });
    await seite.waitForSelector(".mini-seite", { timeout: 8000 });
    await seite.waitForTimeout(500);
    const karten = await seite.locator(".ar-kachel-titel").allInnerTexts();
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
    await seite.waitForSelector(".ar-kachel", { timeout: 8000 });
    pruefe(await seite.locator(".ar-kachel").count() === SPIELE.length,
      `Ohne Netz und ohne gemerkte Wahl stehen ${await seite.locator(".ar-kachel").count()} Spiele da statt ${SPIELE.length}.`);
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
    // andere. Bis zu den Knöpfen rechts bleiben dort gut 230 Pixel – der
    // engste Fall, den es gibt.
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
      // Links steht nichts mehr vor der Leiste: Sie beginnt am Rand.
      const erste = Math.min(...stuecke.map((s) => s.r.left));
      // Eine Zeile oder zwei? Bricht die Leiste um, liegt nichts übereinander
      // – die zweite Zeile legt sich aber über die Spielfläche und über den
      // Satz, der dort steht. Gemessen wird deshalb die Leiste selbst gegen
      // ihr höchstes Stück: Sind beide gleich hoch, steht alles nebeneinander.
      const leiste = document.querySelector(".cm-bar").getBoundingClientRect();
      const hoechstes = stuecke.reduce((max, s) => Math.max(max, s.r.height), 0);
      return {
        stoesse,
        ueberRand: Math.round(letzte - window.innerWidth),
        links: Math.round(erste),
        leisteHoch: Math.round(leiste.height),
        hoechstes: Math.round(hoechstes),
      };
    });
    pruefe(befund.stoesse.length === 0, `${name}: In der Leiste liegt etwas übereinander – ${befund.stoesse.join(", ")}`);
    pruefe(befund.ueberRand <= 0, `${name}: Die Leiste steht ${befund.ueberRand} px über den rechten Rand.`);
    pruefe(befund.links >= 8 && befund.links <= 24, `${name}: Die Leiste beginnt bei ${befund.links} px statt am linken Rand.`);
    pruefe(befund.leisteHoch <= befund.hoechstes + 4,
      `${name}: Die Leiste bricht um – ${befund.leisteHoch} px hoch bei einem höchsten Stück von ${befund.hoechstes} px.`);
    await kontext.close();
  }

  // --- 4a. Die Gegner-Schalter: jeder bleibt in seinem Feld ---------------------
  // Drei Schalter (Platz 1, Bestmarke, Alle) auf einem Handy hochkant: Dort
  // liefen «noch frei» und «noch keine» früher ineinander und über den Rand.
  // Gemessen in jeder Lage und in drei Zuständen – leer, mit Gegnern vor der
  // Runde, während der Runde –, mit einem Spiel mit drei und einem mit zwei
  // Schaltern. Die Gegner werden dafür in die Schalter geschrieben: Es geht
  // um den Platz, nicht um die Bestenliste.
  for (const pfad of ["liane", "turmbau"]) {
    for (const [name, viewport] of [
      ["Handy hoch schmal", { width: 320, height: 568 }],
      ["Handy hoch Android", { width: 360, height: 740 }],
      ["Handy hoch", { width: 390, height: 844 }],
      ["Handy quer", { width: 568, height: 320 }],
      ["Tablet quer", { width: 844, height: 390 }],
      ["Tablet", { width: 1024, height: 768 }],
    ]) {
      const { kontext, seite } = await neueSeite(viewport);
      await seite.goto(`${BASIS}/${pfad}`, { waitUntil: "load" });
      await seite.waitForSelector(".gs-chip", { timeout: 8000 });
      await seite.waitForTimeout(300);
      for (const zustand of ["leer", "voll", "spiel"]) {
        const befund = await seite.evaluate((zustand) => {
          const chips = [...document.querySelectorAll(".gs-chip")];
          if (zustand !== "leer") {
            chips.forEach((c, i) => {
              c.classList.remove("ist-leer");
              c.classList.add("is-an");
              c.querySelector(".gs-name").textContent = i === 0 ? "Alexandra" : "";
              c.querySelector(".gs-wert").textContent = i === 2 ? "12/20" : "12345";
            });
          }
          if (zustand === "spiel") document.querySelector(".cm-stage").dataset.phase = "play";
          const leiste = document.querySelector(".gs-leiste").getBoundingClientRect();
          const kaesten = chips.map((c) => c.getBoundingClientRect());
          const fehler = [];
          chips.forEach((c, i) => {
            const k = kaesten[i];
            if (k.left < leiste.left - 1 || k.right > leiste.right + 1) fehler.push(`${c.title || i} steht neben der Leiste`);
            if (i && kaesten[i - 1].right > k.left + 1) fehler.push(`${i}. und ${i + 1}. Schalter liegen übereinander`);
            for (const teil of c.children) {
              const t = teil.getBoundingClientRect();
              if (t.width && t.right > k.right - 2) fehler.push(`«${(teil.textContent || teil.getAttribute("class")).trim()}» ragt aus dem ${i + 1}. Schalter`);
            }
          });
          // Die Zahl steht immer ganz da: Sie ist, worum es geht.
          const zahlen = zustand === "leer" ? [] : chips.map((c) => c.querySelector(".gs-wert")).filter((w) => w.scrollWidth > w.clientWidth + 1);
          if (zahlen.length) fehler.push(`die Zahl ist abgeschnitten (${zahlen.length}×)`);
          return fehler;
        }, zustand);
        pruefe(befund.length === 0, `${pfad}, ${name}, ${zustand}: Gegner-Schalter – ${befund.join(", ")}`);
      }
      await kontext.close();
    }
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
    // Eine Adresse für Link und Passwort, und kein Feld höher als eine Zeile
    // (in der Spalte wurde die Grundbreite von 200 px einmal zur Höhe).
    const felder = await seite.locator(".adm-anmeldung input").evaluateAll((liste) => liste.map((f) => ({ art: f.type, hoch: Math.round(f.getBoundingClientRect().height) })));
    pruefe(felder.filter((f) => f.art === "email").length === 1 && felder.every((f) => f.hoch > 0 && f.hoch <= 60),
      `Die Felder der Anmeldung stimmen nicht (ein Adressfeld, höchstens 60 px hoch): ${JSON.stringify(felder)}`);
    // Das Fenster für die Anmeldung einer Netlify-Vorschau gibt nichts heraus,
    // wenn es nicht aus einer Vorschau dieses Projekts geöffnet wurde.
    await seite.goto(`${BASIS}/admin?vorschau=${encodeURIComponent("https://boese.example")}`, { waitUntil: "load" });
    await seite.waitForSelector(".adm-anmeldung", { timeout: 6000 }).catch(() => {});
    const vorschauText = await seite.locator(".adm-anmeldung").innerText().catch(() => "");
    pruefe(/aus einer Vorschau/.test(vorschauText) && !/Mit Google/.test(vorschauText),
      `Das Fenster für die Vorschau-Anmeldung bietet eine fremde Adresse an: ${vorschauText.replace(/\n/g, " | ")}`);
    // Aus einem einzelnen Deploy (<kennung>--gamesrepo.netlify.app) geöffnet:
    // Angeboten wird die Anmeldung nur, wenn Netlify ihn als Stand von main
    // kennt – nicht der Vorschau eines Pull Requests aus einem Fork, nicht
    // dem Deploy einer anderen Netlify-Seite. Die Antworten von Netlify und
    // GitHub stehen hier fest.
    const NETLIFY_SEITE = "f509e792-125f-4e61-aade-64425bb5dde2";
    const DEPLOYS = {
      ["a".repeat(24)]: { site_id: NETLIFY_SEITE, context: "production", branch: "main", commit_ref: "4c6c00572bfae432b5789552de6d39360e5804e0", review_id: null },
      ["b".repeat(24)]: { site_id: NETLIFY_SEITE, context: "deploy-preview", branch: "patch-1", commit_ref: "1234567", review_id: 77 },
      ["c".repeat(24)]: { site_id: "eine-andere-seite", context: "production", branch: "main", commit_ref: "1234567", review_id: null },
    };
    const alsJson = (route, daten, status = 200) => route.fulfill({ status, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify(daten) });
    await kontext.route("**/cloud.js*", (route) => route.fulfill({ contentType: "text/javascript; charset=utf-8", body: ATTRAPPE }));
    await kontext.route("https://www.gstatic.com/firebasejs/**", (route) => route.fulfill({ contentType: "text/javascript; charset=utf-8", body: "/* */" }));
    await kontext.route("https://api.netlify.com/api/v1/deploys/*", (route) => {
      const kennung = route.request().url().split("/").pop();
      return DEPLOYS[kennung] ? alsJson(route, { id: kennung, ...DEPLOYS[kennung] }) : alsJson(route, {}, 404);
    });
    await kontext.route("https://api.github.com/repos/vonallmenalain/games/pulls/77", (route) => alsJson(route, { head: { repo: { full_name: "jemand/games" } }, base: { repo: { full_name: "vonallmenalain/games" } } }));
    for (const [kennung, offen] of [["a".repeat(24), true], ["b".repeat(24), false], ["c".repeat(24), false]]) {
      const ziel = `${BASIS}/admin?vorschau=${encodeURIComponent(`https://${kennung}--gamesrepo.netlify.app`)}`;
      const [fenster] = await Promise.all([kontext.waitForEvent("page"), seite.evaluate((adresse) => { window.open(adresse, "_blank"); }, ziel)]);
      await fenster.waitForFunction(() => !/wird geprüft/.test(document.querySelector(".adm-anmeldung")?.innerText || "wird geprüft"), null, { timeout: 8000 }).catch(() => {});
      const text = (await fenster.locator(".adm-anmeldung").innerText().catch(() => "")).replace(/\n/g, " | ");
      if (offen) pruefe(/Stand von main, 4c6c005/.test(text) && /Mit Google/.test(text), `Ein Deploy von main bekommt keine Anmeldung angeboten: ${text}`);
      else pruefe(/stammt weder aus main/.test(text) && !/Mit Google/.test(text), `Ein fremder Deploy (${kennung.slice(0, 1)}…) bekommt die Anmeldung angeboten: ${text}`);
      await fenster.close();
    }
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
    await seite.waitForSelector(".ar-kachel", { timeout: 8000 });
    pruefe(await seite.locator('a[href="/admin"]').count() === 0, "Ohne Anmeldung steht auf der Startseite ein Weg in den Adminbereich.");
    pruefe(!/anmelden|login/i.test(await seite.locator(".mini-seite").innerText()), "Auf der Startseite steht etwas vom Anmelden.");
    await kontext.close();
  }
  for (const [lage, viewport] of [["breit", { width: 1000, height: 800 }], ["Handy hoch schmal", { width: 320, height: 568 }]]) {
    const { kontext, seite } = await neueSeite(viewport);
    await seite.addInitScript(() => localStorage.setItem("mini.admin", "ja"));
    await seite.goto(`${BASIS}/`, { waitUntil: "load" });
    await seite.waitForSelector(".ar-kachel", { timeout: 8000 });
    const knopf = seite.locator(".ar-kopf a.mini-knopf-admin");
    pruefe(await knopf.count() === 1, `${lage}: Als Admin fehlt im Balken der Startseite der Knopf zum Adminbereich.`);
    if (await knopf.count()) {
      pruefe(await knopf.getAttribute("href") === "/admin", `${lage}: Der Admin-Knopf zeigt auf ${await knopf.getAttribute("href")}.`);
      const befund = await seite.evaluate(() => {
        const balken = document.querySelector(".ar-kopf").getBoundingClientRect();
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
  // Öffentliche, die laufen, bald beginnen oder eben vorbei sind – vorne in
  // der Zeile mit den Spielen. Nie eines nur mit Link, nie ein angehaltenes,
  // nie eines von vor Wochen. (Gelesen wird textContent: Das Wort auf dem
  // Knopf – Mitspielen, Ansehen, Rangliste – steht in der schmalen Kachel
  // nicht sichtbar da, gewählt wird es trotzdem.)
  {
    const { kontext, seite } = await mitTurnieren("/");
    await seite.waitForSelector(".tn-hinweis", { timeout: 8000 });
    await seite.waitForSelector(".ar-kachel", { timeout: 8000 });
    const hinweise = await seite.locator(".tn-hinweis").evaluateAll((alle) => alle.map((a) => ({ href: a.getAttribute("href"), text: a.textContent })));
    const alleTexte = hinweise.map((h) => h.text).join(" | ");
    pruefe(hinweise.length === 3, `Auf der Startseite stehen ${hinweise.length} Turniere statt drei: ${alleTexte}`);
    pruefe(/Herbstcup/.test(hinweise[0]?.text || "") && /läuft noch/.test(hinweise[0]?.text || ""), `Zuoberst steht nicht das laufende Turnier: ${alleTexte}`);
    pruefe(hinweise.some((h) => h.href === `/turnier?t=${HERBST}`), `Der Hinweis führt nicht auf die Turnierseite: ${hinweise.map((h) => h.href).join(", ")}`);
    pruefe(hinweise.some((h) => /Wintercup/.test(h.text) && /beginnt in/.test(h.text)), `Das geplante Turnier fehlt: ${alleTexte}`);
    pruefe(hinweise.some((h) => /Sommercup/.test(h.text) && /Rangliste/.test(h.text)), `Das eben beendete Turnier fehlt: ${alleTexte}`);
    for (const nicht of ["Familienabend", "Frühlingscup", "Pausencup", "Blindcup", "Würfelcup"]) {
      pruefe(!alleTexte.includes(nicht), `Auf der Startseite steht "${nicht}".`);
    }
    const vorne = await seite.evaluate(() => document.querySelector(".tn-hinweis").getBoundingClientRect().right
      <= document.querySelector(".ar-kachel").getBoundingClientRect().left);
    pruefe(vorne, "Die Turniere stehen nicht vorne in der Zeile mit den Spielen.");
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
    await seite.waitForSelector(".tn-wertung", { timeout: 8000 });
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
    const hinweise = await seite.locator(".tn-hinweis").evaluateAll((alle) => alle.map((a) => a.textContent));
    pruefe(/Familienabend/.test(hinweise[0] || ""), `Das geöffnete Turnier nur mit Link steht nicht zuvorderst auf der Startseite: ${hinweise.join(" | ")}`);
    pruefe(hinweise.length === 4, `Mit einem eigenen Turnier stehen ${hinweise.length} statt vier Turniere auf der Startseite: ${hinweise.join(" | ")}`);
    const gemerkt = await seite.evaluate(() => JSON.parse(localStorage.getItem("mini.turniere") || "[]"));
    pruefe(gemerkt.length === 1 && gemerkt[0] === "familie-geheim2345", `Das Gerät merkt sich die falschen Turniere: ${JSON.stringify(gemerkt)}`);
    await kontext.close();
  }
  {
    // Ohne Turnier bleibt in der Zeile nichts stehen, auch kein leerer Kasten.
    const { kontext, seite } = await neueSeite();
    await seite.goto(`${BASIS}/`, { waitUntil: "load" });
    await seite.waitForSelector(".ar-kachel", { timeout: 8000 });
    const hoehe = await seite.evaluate(() => document.querySelector(".tn-hinweise")?.getBoundingClientRect().height ?? 0);
    pruefe(hoehe === 0, `Ohne Turnier steht in der Zeile ein ${hoehe} px hoher Kasten.`);
    await kontext.close();
  }

  // --- 4e. Die Turnierseite ------------------------------------------------------
  // Die Bühne der Startseite, oben Name und Stand des Turniers und die
  // Gesamtwertung: die ersten drei, ein Tipp öffnet die ganze Tabelle.
  for (const [lage, viewport] of [["breit", { width: 1000, height: 900 }], ["Handy", { width: 360, height: 740 }]]) {
    const { kontext, seite } = await mitTurnieren(`/turnier?t=${HERBST}`, { viewport, vorher: () => localStorage.setItem("mini.admin", "ja") });
    await seite.waitForSelector(".tn-wertung", { timeout: 8000 });
    await seite.waitForSelector(".ar-kachel", { timeout: 8000 });
    const stand = await seite.evaluate(() => ({
      titel: document.querySelector(".tn-titel h1")?.textContent,
      status: document.querySelector(".tn-status")?.textContent || "",
      spiele: [...document.querySelectorAll(".ar-kachel")].map((k) => k.dataset.spiel),
      play: document.querySelector(".ar-play")?.getAttribute("href"),
      podest: [...document.querySelectorAll(".tn-podest .tn-podest-name")].map((n) => n.textContent),
      regeln: document.querySelectorAll(".tn-regel-liste, .tn-regeln").length,
      teilen: document.querySelectorAll(".tn-teilen, .tn-link-feld").length,
      hinaus: [...document.querySelectorAll("[data-turnier] a")].map((a) => a.getAttribute("href")).filter((h) => !/^\/(turnier|admin)\b/.test(h) && !/[?&]turnier=/.test(h)),
      admin: document.querySelector(".ar-kopf .mini-knopf-admin")?.getAttribute("href"),
      ueberstand: document.documentElement.scrollWidth - window.innerWidth,
      blatt: document.documentElement.scrollHeight - window.innerHeight,
    }));
    pruefe(stand.titel === "Herbstcup", `${lage}: Die Turnierseite heisst "${stand.titel}".`);
    pruefe(/läuft noch/.test(stand.status) && /2 Versuche je Spiel/.test(stand.status), `${lage}: Unter dem Namen steht nicht, wie lange es noch läuft und was gilt: ${stand.status}`);
    pruefe(stand.spiele.length === 3, `${lage}: Auf der Turnierseite stehen ${stand.spiele.length} Spiele statt drei.`);
    pruefe(stand.play === `/turmbau?turnier=${HERBST}`, `${lage}: Play führt nicht ins Spiel im Turnier: ${stand.play}`);
    pruefe(JSON.stringify(stand.podest) === JSON.stringify(["Leo", "Grosi", "Mia"]), `${lage}: Oben stehen nicht Leo, Grosi und Mia: ${stand.podest.join(", ")}`);
    // Keine Regeln in Sätzen und kein Block zum Weitersagen: Dauer und
    // Versuche stehen oben, den Link hat der Adminbereich. Und kein Weg
    // hinaus – das Turnier ist ein Raum für sich.
    pruefe(stand.regeln === 0, `${lage}: Auf der Turnierseite steht wieder ein Block mit Regeln.`);
    pruefe(stand.teilen === 0, `${lage}: Auf der Turnierseite steht wieder der Block zum Weitersagen.`);
    pruefe(stand.hinaus.length === 0, `${lage}: Von der Turnierseite führt ein Weg hinaus: ${stand.hinaus.join(", ")}`);
    pruefe(stand.admin === "/admin", `${lage}: Als Admin fehlt auf der Turnierseite der Weg in den Adminbereich.`);
    pruefe(stand.ueberstand <= 1 && stand.blatt <= 1, `${lage}: Die Turnierseite passt nicht in einen Bildschirm: ${stand.ueberstand} px zu breit, ${stand.blatt} px zu hoch.`);
    const ohne = await klassenOhneRegel(seite);
    pruefe(ohne.length === 0, `${lage}: Turnierseite – Klassen ohne Regel: ${ohne.join(", ")}`);
    // Die ganze Gesamtwertung im Fenster, mit der Beschreibung.
    await seite.click(".tn-wertung");
    await seite.waitForSelector("dialog.ist-gesamt .tn-tabelle", { timeout: 4000 }).catch(() => {});
    const gesamt = await seite.evaluate(() => ({
      erster: document.querySelector("dialog.ist-gesamt .tn-tabelle tbody tr .tn-wer > span")?.textContent,
      ersterWert: document.querySelector("dialog.ist-gesamt .tn-tabelle tbody tr .tn-wert")?.textContent,
      zeilen: document.querySelectorAll("dialog.ist-gesamt .tn-tabelle tbody tr").length,
      beschreibung: document.querySelector("dialog.ist-gesamt .tn-beschreibung")?.textContent,
    }));
    pruefe(gesamt.erster === "Leo" && gesamt.ersterWert === "4",
      `${lage}: Die Gesamtwertung rechnet falsch – vorne steht ${gesamt.erster} mit ${gesamt.ersterWert} statt Leo mit 4.`);
    pruefe(gesamt.zeilen === 3, `${lage}: In der Gesamtwertung stehen ${gesamt.zeilen} Spieler statt drei.`);
    pruefe(gesamt.beschreibung === "Wer gewinnt, wählt das Znacht.", `${lage}: Die Beschreibung fehlt.`);
    const ohneFenster = await klassenOhneRegel(seite);
    pruefe(ohneFenster.length === 0, `${lage}: Gesamtwertung im Turnier – Klassen ohne Regel: ${ohneFenster.join(", ")}`);
    await kontext.close();
  }
  {
    // Verdeckt: Wer spielt, sieht seine eigene Zahl, aber nicht, wer vorne liegt.
    const { kontext, seite } = await mitTurnieren("/turnier?t=verdeckt-test23456");
    await seite.waitForSelector(".tn-wertung", { timeout: 8000 });
    await seite.waitForSelector(".ar-kachel", { timeout: 8000 });
    pruefe(await seite.locator(".tn-podest").count() === 0, "Im verdeckten Turnier steht oben, wer vorne liegt.");
    pruefe(await seite.locator(".tn-wertung .tn-verdeckt").count() === 1, "Im verdeckten Turnier steht oben nicht, dass die Wertung verdeckt ist.");
    pruefe(/verdeckt/.test(await seite.locator(".ar-rang").innerText()), "Im verdeckten Turnier nennt der Knopf zur Rangliste einen Namen.");
    await seite.click(".ar-rang");
    await seite.waitForSelector("dialog.ist-rangliste", { timeout: 4000 }).catch(() => {});
    pruefe(await seite.locator("dialog.ist-rangliste .gk-zeile").count() === 0 && await seite.locator("dialog.ist-rangliste .tn-verdeckt").count() === 1,
      "Im verdeckten Turnier steht die Rangliste eines Spiels da.");
    await seite.keyboard.press("Escape");
    await seite.click(".tn-wertung");
    await seite.waitForSelector("dialog.ist-gesamt", { timeout: 4000 }).catch(() => {});
    pruefe(await seite.locator(".tn-tabelle").count() === 0, "Im verdeckten Turnier steht die Gesamtwertung da.");
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
    ["/ballon", "Windschichten", () => {
      const B = window.LernappBallon;
      B.weltBis(8000);
      const w = B.state.welt;
      return w.schichten.slice(0, 8).map((s) => `${s.x0.toFixed(2)}/${s.a.toFixed(2)}/${s.b.toFixed(2)}`
        + `/${s.grenzen.map((g) => `${g.y.toFixed(2)}:${g.A.toFixed(2)}`).join(",")}`
        + `/${s.baender.map((b) => b.w.toFixed(2)).join(",")}`).join(" ")
        + ` | ${w.punkte.slice(0, 240).map((p) => p.boden.toFixed(2)).join(" ")}`
        + ` | ${w.wolken.slice(0, 6).map((wo) => `${wo.x.toFixed(1)}/${wo.unten.toFixed(1)}/${wo.kreise.length}`).join(" ")}`
        + ` | ${w.decke.slice(0, 20).map((d) => d.y.toFixed(1)).join(" ")}`;
    }],
    ["/slalom", "Slalom", () => {
      const S = window.LernappSlalom;
      S.toreBisNr(14);
      const piste = [400, 1500, 4000].map((y) => S.pisteBei(y).toFixed(3)).join(" ");
      return `${piste} | ${S.state.kurs.tore.slice(0, 14).map((t) => `${t.x.toFixed(2)}/${t.y.toFixed(2)}/${t.breite.toFixed(2)}`).join(" ")}`;
    }],
    ["/seiltaenzer", "Seiltänzer", () => {
      const T = window.LernappSeiltaenzer;
      T.weltBis(3000);
      const w = T.state.welt;
      return w.masten.slice(0, 8).map((m) => Math.round(m.x)).join(",")
        + " | " + w.boeen.slice(0, 5).map((b) => `${Math.round(b.x0)}-${Math.round(b.x1)}:${b.dir}:${Math.round(b.G * 100)}`).join(" ");
    }],
    ["/kranhafen", "Kranhafen", () => {
      const p = window.LernappKranhafen.plan();
      return JSON.stringify({
        schiffe: p.schiffe.slice(0, 4).map((s) => [s.platz, Math.round(s.weite * 100), Math.round(s.periode * 1000), Math.round(s.wind * 1000)]),
        kisten: p.kisten.slice(0, 8).map((k) => [k.farbe, Math.round(k.weite * 100), Math.round(k.periode * 1000), k.seite, Math.round(k.kMitte * 100)]),
      });
    }],
    ["/frosch", "Froschsprung", () => {
      const F = window.LernappFrosch;
      F.blaetterBis(14);
      return F.state.blaetter.slice(0, 14).map((b) => `${b.x0.toFixed(2)}/${b.r.toFixed(2)}/${b.amp.toFixed(2)}/${b.phase.toFixed(3)}`).join(" ");
    }],
    ["/draht", "Heisser Draht", () => {
      const D = window.LernappDraht;
      D.drahtBis(6000);
      const d = D.state.draht;
      return d.punkte.slice(0, 40).map((p) => `${p.s.toFixed(2)}/${p.q.toFixed(2)}/${p.f.toFixed(2)}`).join(" ")
        + " | " + d.beweg.slice(0, 6).map((b) => `${b.art}:${b.s0.toFixed(1)}-${b.s1.toFixed(1)}/${b.B.toFixed(2)}/${b.ph.toFixed(3)}`).join(" ");
    }],
    ["/spuren", "Zwei Spuren", () => {
      const Z = window.LernappSpuren;
      Z.planBis(6000);
      return Z.welt().slice(0, 60).map((d) => `${d.bahn}${d.spur}${d.art}@${d.y.toFixed(2)}`).join(" ");
    }],
    ["/ball", "Ball hochhalten", () => {
      const B = window.LernappBall;
      B.planBis(80);
      const p = B.state.plan;
      return p.ringe.slice(0, 8).map((r) => `${r.ab}:${r.x.toFixed(2)}/${r.y.toFixed(2)}/${r.innen.toFixed(2)}`).join(" ")
        + ` | ${p.boeen.slice(0, 6).map((b) => `${b.ab}:${b.dir}:${b.staerke.toFixed(2)}/${b.dauer.toFixed(2)}`).join(" ")}`
        + ` | ${p.voegel.slice(0, 5).map((v) => `${v.ab}:${v.dir}:${v.y.toFixed(2)}`).join(" ")}`
        + ` | ${p.balken.slice(0, 4).map((s) => `${s.ab}:${s.seite}:${s.y.toFixed(2)}/${s.lang.toFixed(2)}`).join(" ")}`;
    }],
    // Die sechs mit neuen Mechaniken: Jedes beschreibt seine gewürfelte Welt
    // selbst (weltText) – dieselbe Saat, derselbe Text.
    ["/jongleur", "Jongleur", () => window.LernappJongleur.weltText()],
    ["/skispringen", "Skispringen", () => window.LernappSkispringen.weltText()],
    ["/fallschirm", "Fallschirm", () => window.LernappFallschirm.weltText()],
    ["/holzfaeller", "Holzfäller", () => window.LernappHolzfaeller.weltText()],
    ["/fledermaus", "Fledermaus", () => window.LernappFledermaus.weltText()],
    ["/ninja", "Zeitlupen-Ninja", () => window.LernappNinja.weltText()],
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
  // Plattformen geben (zweimal +100, dann +50, danach höchstens +50 und oft
  // weniger), im Schnitt über fünf Plattformen – nicht viel weiter: Es soll
  // schwer sein. Jede bringt 200 Punkte, jeder Schub kostet welche – sofort,
  // schon vor der ersten Landung. Wer einfach fällt, zerschellt; wer mit
  // leerem Tank landet, strandet.
  {
    const { kontext, seite } = await neueSeite({ width: 900, height: 640 });
    // Der Mond wird gewürfelt, und welche Plattform wie viel gibt, auch. Damit
    // die Prüfung jedes Mal dieselben Monde fliegt, würfelt sie mit festem
    // Anfang – vor jedem Flug neu gesetzt (__wuerfle), denn bis dahin hat die
    // laufende Seite schon ungezählt oft gewürfelt.
    await seite.addInitScript(() => {
      let z = 2;
      window.__wuerfle = (n) => { z = n; };
      Math.random = () => {
        z = (z + 0x6d2b79f5) | 0;
        let t = Math.imul(z ^ (z >>> 15), 1 | z);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    });
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
      const getankt = [];
      let schonVorher = null;
      for (let lauf = 0; lauf < 4; lauf += 1) {
        window.__wuerfle(lauf + 1);
        document.querySelector(".cm-bar-left .cm-icon-again").click();
        let auf = st.auf;
        for (let n = 0; st.schritt !== "crash" && !st.gestrandet && st.landungen < 30 && n < 120 * 400; n += 1) {
          const vorher = st.tank;
          pilot();
          M.takt(1 / 120);
          // Schon vor der ersten Landung kostet der Schub Punkte.
          if (schonVorher === null && st.schritt === "flug" && st.landungen === 0 && st.zeit - st.schrittZeit > 0.5) schonVorher = st.punkte;
          if (st.auf !== auf) {
            auf = st.auf;
            getankt.push({ art: st.platten[auf].tank, vorher: Math.round(vorher * 10) / 10, nachher: Math.round(st.tank * 10) / 10 });
          }
        }
        M.schub(false);
        M.neige(null);
        raus.push({ landungen: st.landungen, punkte: Math.round(st.punkte), schritt: st.schritt, tank: Math.round(st.tank) });
      }
      // Die Plattformen eines langen Monds: welche Arten, in welcher Folge.
      M.bodenBei(st.platten[st.platten.length - 1].x1 + 30000);
      const arten = st.platten.slice(1, 60).map((p) => p.tank);
      return { raus, schonVorher, getankt, arten };
    });
    const schnitt = fluege.raus.reduce((summe, f) => summe + f.landungen, 0) / fluege.raus.length;
    console.log(`  Mondlandung: der sparsame Pilot landet ${fluege.raus.map((f) => f.landungen).join(", ")} Mal`);
    pruefe(schnitt >= 5 && fluege.raus.every((f) => f.landungen >= 4),
      `Mondlandung: Der sparsame Pilot kommt im Schnitt nicht über fünf Plattformen (${schnitt}) – ${JSON.stringify(fluege.raus)}`);
    pruefe(fluege.getankt.length > 0 && fluege.getankt.every((t) => [100, 50, 40, 30, 20, 0].includes(t.art) && Math.abs(t.nachher - Math.min(100, t.vorher + t.art)) < 0.6),
      `Mondlandung: Getankt wird nicht, was die Plattform sagt – ${JSON.stringify(fluege.getankt.slice(0, 12))}`);
    const spaeter = fluege.arten.slice(3);
    pruefe(fluege.arten.slice(0, 3).join() === "100,100,50"
      && spaeter.every((a) => [50, 40, 30, 20, 0].includes(a))
      && fluege.arten.every((a, i) => !(a === 0 && fluege.arten[i - 1] === 0))
      && [0, 20].every((a) => spaeter.includes(a)),
      `Mondlandung: Die Plattformen geben nicht zweimal +100, dann +50 und danach höchstens +50 (mit +20 und leeren, nie zwei leere hintereinander): ${fluege.arten.join(",")}`);
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
      for (let lauf = 0; lauf < 3; lauf += 1) {
        window.__wuerfle(lauf + 21);
        document.querySelector(".cm-bar-left .cm-icon-again").click();
        for (let n = 0; st.schritt !== "crash" && !st.gestrandet && n < 120 * 300; n += 1) {
          pilot();
          M.takt(1 / 120);
        }
        M.schub(false);
        M.neige(null);
        raus.push({ landungen: st.landungen, punkte: st.punkte, tank: Math.round(st.tank) });
      }
      return { raus };
    });
    pruefe(grob.raus.every((r) => r.landungen >= 2), `Mondlandung: Wer grob fliegt, kommt keine zwei Plattformen weit – ${JSON.stringify(grob.raus)}`);
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
    // Mit leerem Tank auf einer roten Plattform: gestrandet, die Runde ist aus.
    const leer = await seite.evaluate(() => {
      const M = window.LernappMondlandung;
      const st = M.state;
      document.querySelector(".cm-bar-left .cm-icon-again").click();
      st.platten[1].tank = 0;
      // Die Fähre steht auf der ersten Plattform, der Tank ist leer.
      const p = st.platten[1];
      M.schub(true);
      M.takt(1 / 120);
      M.schub(false);
      st.f.x = (p.x0 + p.x1) / 2;
      st.f.y = p.y + 14;
      st.f.vx = 0;
      st.f.vy = -5;
      st.f.neig = 0;
      st.schritt = "flug";
      st.tank = 0;
      for (let n = 0; n < 120 * 2 && !st.gestrandet; n += 1) M.takt(1 / 120);
      return { gestrandet: st.gestrandet, schritt: st.schritt, auf: st.auf, tank: st.tank };
    });
    pruefe(leer.gestrandet && leer.auf === 1 && leer.tank === 0, `Mondlandung: Wer mit leerem Tank auf einer roten Plattform landet, strandet nicht: ${JSON.stringify(leer)}`);
    await seite.waitForSelector(".cm-result-score", { timeout: 6000 }).catch(() => {});
    pruefe(await seite.locator(".cm-result-score").count() === 1, "Mondlandung: Gestrandet – und kein Ergebnis.");
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

  // --- 4g10. Froschsprung: jedes Blatt erreichbar, und wer sitzen bleibt, geht unter -
  // Ein Autopilot hält, bis die Ladung genau aufs nächste Blatt passt – mit dem
  // Treiben, das während des Flugs geschieht –, und lässt dort los: auf
  // mehreren gewürfelten Teichen bis 100 Blätter, bis hin zu kleinen,
  // treibenden und sinkenden. Wo er ins Wasser fällt, verlangt der Teich mehr,
  // als der Frosch kann. Und wer nach dem Start nichts mehr drückt, sitzt, bis
  // das Blatt sinkt – das ist das Ende, mit Ergebnis.
  {
    const { kontext, seite } = await neueSeite({ width: 900, height: 520 });
    await seite.goto(`${BASIS}/frosch`, { waitUntil: "load" });
    await seite.waitForFunction(() => window.LernappFrosch?.state, null, { timeout: 8000 });
    const runden = await seite.evaluate(() => {
      const F = window.LernappFrosch;
      const st = F.state;
      const raus = [];
      for (let lauf = 0; lauf < 4; lauf += 1) {
        document.querySelector(".cm-bar-left .cm-icon-again").click();
        let ziel = null;
        let vorher = null;
        for (let n = 0; st.schritt !== "platsch" && st.erreicht < 100 && n < 400000; n += 1) {
          if (st.schritt === "start" || st.schritt === "sitzt") {
            if (!st.laedt) {
              F.druecken();
              ziel = st.blaetter[st.auf + 1];
              vorher = null;
            } else {
              // Wo er mit dieser Ladung landet – und wo das Blatt dann ist.
              const w = F.reichweite(st.ladung);
              const fehlt = F.blattX(ziel, st.uhr + F.flugzeit(w)) - (st.frosch.x + w);
              if (vorher !== null && Math.sign(fehlt) !== Math.sign(vorher) && Math.abs(fehlt) < 4) F.loslassen();
              vorher = fehlt;
            }
          }
          F.takt(1 / 120);
        }
        F.loslassen();
        let klein = Infinity;
        let treibt = 0;
        st.blaetter.slice(1, 101).forEach((b) => { klein = Math.min(klein, b.r); if (b.amp) treibt += 1; });
        raus.push({ erreicht: st.erreicht, schritt: st.schritt, perfekt: st.perfekte, klein: Math.round(klein), treibt });
      }
      return raus;
    });
    pruefe(runden.every((r) => r.erreicht >= 100 && r.schritt === "sitzt" && r.perfekt >= 90 && r.klein <= 16 && r.treibt >= 30),
      `Froschsprung: Der Autopilot kommt nicht über jeden Teich – ${JSON.stringify(runden)}`);
    await seite.evaluate(() => document.querySelector(".cm-bar-left .cm-icon-again").click());
    await seite.evaluate(() => { window.LernappFrosch.druecken(); window.LernappFrosch.loslassen(); });
    await seite.waitForSelector(".cm-result-score", { timeout: 12000 }).catch(() => {});
    const ende = await seite.evaluate(() => ({ zahl: document.querySelector(".cm-result-score")?.textContent, schritt: window.LernappFrosch.state.schritt, grund: window.LernappFrosch.state.grund }));
    pruefe(ende.schritt === "platsch" && ende.grund === "gesunken" && ende.zahl !== undefined,
      `Froschsprung: Wer sitzen bleibt, geht nicht unter: ${JSON.stringify(ende)}`);
    await kontext.close();
  }

  // --- 4g11. Slalom: immer fahrbar, und ein verpasstes Tor beendet die Runde ---------
  // Ein Autopilot fährt mehrere gewürfelte Kurse bis 2000 m: Er hält auf das
  // nächste Tor zu und dreht schon zum übernächsten, sobald er das nächste
  // auch so noch sicher trifft – immer links oder rechts, nie geradeaus. Wo
  // er nicht durchkommt, verlangt der Kurs mehr, als der Fahrer carven kann.
  // Wer nach dem Start nichts mehr drückt, fährt geradeaus weiter – am
  // nächsten Tor vorbei, mit Ergebnis. Und die zwei Knöpfe: links hält nach
  // links, rechts nach rechts, zwei Finger – der zweite gilt.
  {
    const { kontext, seite } = await neueSeite({ width: 420, height: 800 });
    await seite.goto(`${BASIS}/slalom`, { waitUntil: "load" });
    await seite.waitForFunction(() => window.LernappSlalom?.state, null, { timeout: 8000 });
    const fahrten = await seite.evaluate(() => {
      const S = window.LernappSlalom;
      const raus = [];
      for (let lauf = 0; lauf < 4; lauf += 1) {
        document.querySelector(".cm-bar-left .cm-icon-again").click();
        const st = S.state;
        const sk = st.sk;
        S.lenke(1);
        let n = 0;
        for (; st.schritt === "fahrt" && sk.y < 20000 && n < 400000; n += 1) {
          const tore = st.kurs.tore;
          const i = tore.findIndex((q) => q.zustand === "offen" && q.y > sk.y);
          const t1 = tore[i];
          const t2 = tore[i + 1];
          const ziel = (t) => t.x + t.innen * t.breite * 0.12;
          let soll = Math.atan2(ziel(t1) - sk.x, Math.max(1, t1.y - sk.y));
          // Schon umsteigen? Den Bogen zum übernächsten Tor vorausrechnen.
          const phi2 = Math.atan2(ziel(t2) - ziel(t1), t2.y - t1.y);
          const W = S.drehBei(sk.y);
          let x = sk.x, y = sk.y, phi = sk.phi, w = sk.w;
          const r = Math.sign(phi2 - phi) || 1;
          for (let k = 0; k < 600 && y < t1.y; k += 1) {
            if ((r > 0 && phi < phi2) || (r < 0 && phi > phi2)) {
              w += (r * W - w) * (1 - Math.exp(-1 / 120 / 0.07));
              phi += w / 120;
            } else { phi = phi2; w = 0; }
            x += sk.v * Math.sin(phi) / 120;
            y += sk.v * Math.cos(phi) / 120;
          }
          const rand = S.R_STANGE + S.R_FAHRER + 3;
          if (x > S.stangeL(t1) + rand && x < S.stangeR(t1) - rand) soll = phi2;
          S.lenke(soll > sk.phi + sk.w * 0.05 ? 1 : -1);
          S.takt(1 / 120);
        }
        S.lenke(0);
        raus.push({ meter: Math.round(sk.y / S.METER), schritt: st.schritt, tore: st.tore, grund: st.sturz?.grund || null });
      }
      return raus;
    });
    pruefe(fahrten.every((f) => f.meter >= 2000 && f.schritt === "fahrt" && f.tore >= 70),
      `Slalom: Der Autopilot kommt nicht durch jeden Kurs – ${JSON.stringify(fahrten)}`);
    await seite.evaluate(() => document.querySelector(".cm-bar-left .cm-icon-again").click());
    await seite.evaluate(() => { window.LernappSlalom.lenke(1); window.LernappSlalom.lenke(0); });
    await seite.waitForSelector(".cm-result-score", { timeout: 12000 }).catch(() => {});
    const ende = await seite.evaluate(() => ({ zahl: document.querySelector(".cm-result-score")?.textContent, schritt: window.LernappSlalom.state.schritt, grund: window.LernappSlalom.state.sturz?.grund }));
    pruefe(ende.schritt === "sturz" && ende.zahl !== undefined,
      `Slalom: Ohne Eingabe endet die Runde nicht: ${JSON.stringify(ende)}`);

    // Die Knöpfe mit echten Fingern: links, rechts, beide (der zweite gilt),
    // loslassen (geradeaus). Und mit den Pfeiltasten.
    await seite.evaluate(() => document.querySelector(".cm-bar-left .cm-icon-again").click());
    const box = await seite.locator(".sk-feld").boundingBox();
    const tippe = (id, x, typ) => seite.evaluate(({ id, x, y, typ }) => {
      const ziel = typ === "pointerdown" ? document.elementFromPoint(x, y) : window;
      ziel.dispatchEvent(new PointerEvent(typ, { pointerId: id, clientX: x, clientY: y, bubbles: true }));
    }, { id, x, y: box.y + box.height * 0.6, typ });
    const lage = () => seite.evaluate(() => ({
      phase: window.LernappSlalom.state.phase,
      l: document.querySelector(".sk-knopf-l")?.classList.contains("ist-an"),
      r: document.querySelector(".sk-knopf-r")?.classList.contains("ist-an"),
    }));
    const schritte = [];
    await tippe(1, box.x + box.width * 0.2, "pointerdown");
    schritte.push(await lage());
    await tippe(2, box.x + box.width * 0.8, "pointerdown");
    schritte.push(await lage());
    await tippe(2, box.x + box.width * 0.8, "pointerup");
    schritte.push(await lage());
    await tippe(1, box.x + box.width * 0.2, "pointerup");
    schritte.push(await lage());
    await seite.keyboard.down("ArrowRight");
    schritte.push(await lage());
    await seite.keyboard.up("ArrowRight");
    const soll = [
      { phase: "spiel", l: true, r: false },
      { phase: "spiel", l: false, r: true },
      { phase: "spiel", l: true, r: false },
      { phase: "spiel", l: false, r: false },
      { phase: "spiel", l: false, r: true },
    ];
    pruefe(JSON.stringify(schritte) === JSON.stringify(soll), `Slalom: Die zwei Knöpfe lenken nicht richtig: ${JSON.stringify(schritte)}`);
    await kontext.close();
  }

  // --- 4g12. Seiltänzer: immer zu halten, und ohne Eingabe kippt er -----------------
  // Ein Autopilot, der nur Neigung und Drehung sieht (halten, wenn er nach
  // links kippt, sonst loslassen), geht auf mehreren gewürfelten Seilen bis
  // 1500 m: Fällt er, hat eine Böe mehr verlangt, als die Stange kann. Dazu
  // ist keine Böe stärker als ihr Deckel (die Stange behält bei 0.42 Neigung
  // noch 0.55 übrig). Und wer nach dem ersten Druck nichts mehr tut, kippt
  // nach links ins Netz – das ist das Ende, mit Ergebnis.
  {
    const { kontext, seite } = await neueSeite({ width: 420, height: 800 });
    await seite.goto(`${BASIS}/seiltaenzer`, { waitUntil: "load" });
    await seite.waitForFunction(() => window.LernappSeiltaenzer?.state, null, { timeout: 8000 });
    const laeufe = await seite.evaluate(() => {
      const T = window.LernappSeiltaenzer;
      const raus = [];
      for (let lauf = 0; lauf < 4; lauf += 1) {
        document.querySelector(".cm-bar-left .cm-icon-again").click();
        const st = T.state;
        T.druecken();
        T.loslassen();
        let schiefst = 0;
        for (let n = 0; st.schritt === "lauf" && st.meter < 1500 && n < 400000; n += 1) {
          if (st.l.th + 0.4 * st.l.w < 0) T.druecken(); else T.loslassen();
          T.takt(1 / 120);
          schiefst = Math.max(schiefst, Math.abs(st.l.th));
        }
        T.loslassen();
        T.weltBis(20000);
        const zuStark = st.welt.boeen.filter((b) => {
          const k = T.schwereBei(b.x0);
          return b.G > T.stange(k) - T.kipp(k) * Math.sin(0.42) - 0.55 + 1e-9;
        }).length;
        raus.push({ meter: st.meter, schritt: st.schritt, schiefst: Math.round(schiefst * 100), zuStark });
      }
      return raus;
    });
    pruefe(laeufe.every((l) => l.meter >= 1500 && l.schritt === "lauf" && l.zuStark === 0),
      `Seiltänzer: Der Autopilot hält nicht auf jedem Seil das Gleichgewicht – ${JSON.stringify(laeufe)}`);
    await seite.evaluate(() => document.querySelector(".cm-bar-left .cm-icon-again").click());
    await seite.evaluate(() => { window.LernappSeiltaenzer.druecken(); window.LernappSeiltaenzer.loslassen(); });
    await seite.waitForSelector(".cm-result-score", { timeout: 8000 }).catch(() => {});
    const ende = await seite.evaluate(() => ({
      zahl: document.querySelector(".cm-result-score")?.textContent,
      schritt: window.LernappSeiltaenzer.state.schritt,
      gekippt: window.LernappSeiltaenzer.state.gekippt,
    }));
    pruefe(ende.schritt === "sturz" && ende.gekippt === -1 && ende.zahl !== undefined,
      `Seiltänzer: Ohne Eingabe endet die Runde nicht mit einem Sturz nach links: ${JSON.stringify(ende)}`);
    await kontext.close();
  }

  // --- 4g13. Windschichten: immer ein Weg nach Osten, und ohne Brenner endet die Fahrt -
  // Ein Autopilot fährt mehrere gewürfelte Welten bis 2000 m: Er folgt dem
  // sicheren Weg (zielBei, die Höhe des Messpunkts in der guten Schicht) ein
  // Stück voraus und heizt, wenn die Hülle kühler ist, als es dafür nötig
  // wäre (Wärme → Auftrieb → Steigen, alles mit Verzug). Dabei fällt er nie
  // aus dem guten Wind (langsam), bleibt allem fern (knapp) und der
  // Gewitterfront weit voraus. Wo nicht, verlangt die Welt mehr, als der
  // Ballon kann. Und wer gar nichts drückt, sinkt auf die Wiese – das ist das
  // Ende, mit Ergebnis.
  {
    const { kontext, seite } = await neueSeite({ width: 1000, height: 640 });
    await seite.goto(`${BASIS}/ballon`, { waitUntil: "load" });
    await seite.waitForFunction(() => window.LernappBallon?.state, null, { timeout: 8000 });
    const fahrten = await seite.evaluate(() => {
      const B = window.LernappBallon;
      const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
      const raus = [];
      for (let lauf = 0; lauf < 4; lauf += 1) {
        document.querySelector(".cm-bar-left .cm-icon-again").click();
        const st = B.state;
        B.druecken();
        B.loslassen();
        let knapp = Infinity;
        let front = Infinity;
        let langsam = 0;
        for (let n = 0; st.schritt === "fahrt" && st.meter < 2000 && n < 400000; n += 1) {
          const f = st.f;
          const v = Math.max(40, f.vx);
          let ziel = 0;
          for (const t of [0.3, 0.6, 0.9, 1.2]) ziel += (B.zielBei(f.x + v * t) - B.MESS) / 4;
          const vyZiel = clamp((ziel - f.y) * 1.8, -0.8 * B.VT, 0.8 * B.VT);
          const kraft = B.DAEMPF * vyZiel + (vyZiel - f.vy) * 4;
          if (st.hitze < 0.5 + kraft / (2 * B.AUF)) B.druecken(); else B.loslassen();
          B.takt(1 / 120);
          front = Math.min(front, f.x - st.front.x);
          if (n % 60 === 0) {
            knapp = Math.min(knapp, B.pruefen().knapp);
            if (B.windBei(f.x, f.y + B.MESS) < B.schichtBei(f.x).vGut * 0.9) langsam += 1;
          }
        }
        B.loslassen();
        raus.push({ meter: st.meter, schritt: st.schritt, grund: st.grund, knapp: Math.round(knapp), front: Math.round(front), langsam });
      }
      return raus;
    });
    pruefe(fahrten.every((f) => f.meter >= 2000 && f.schritt === "fahrt" && f.knapp >= 3 && f.front > 300 && f.langsam === 0),
      `Windschichten: Der Autopilot kommt nicht durch jede Welt – ${JSON.stringify(fahrten)}`);
    await seite.evaluate(() => document.querySelector(".cm-bar-left .cm-icon-again").click());
    await seite.evaluate(() => { window.LernappBallon.druecken(); window.LernappBallon.loslassen(); });
    await seite.waitForSelector(".cm-result-score", { timeout: 15000 }).catch(() => {});
    const ende = await seite.evaluate(() => ({
      zahl: document.querySelector(".cm-result-score")?.textContent,
      schritt: window.LernappBallon.state.schritt,
      grund: window.LernappBallon.state.grund,
    }));
    pruefe(ende.schritt === "crash" && ["boden", "berg"].includes(ende.grund) && ende.zahl !== undefined,
      `Windschichten: Ohne Brenner endet die Fahrt nicht am Boden: ${JSON.stringify(ende)}`);
    await kontext.close();
  }

  // --- 4g14. Heisser Draht: immer fahrbar, und wer nichts tut, berührt -----------
  // Ein Autopilot führt den Ring auf mehreren gewürfelten Drähten bis 2000 m an
  // der Mitte entlang – nie schneller, als der Ring darf (setzeRing fährt mit
  // V_RING hin). Wo er nicht folgen kann, verlangt der Draht mehr, als der Ring
  // kann. Dazu wird nachgerechnet, was der Draht quer verlangt (Tempo mal
  // Steigung, und wie plötzlich er umlenkt) – nirgends mehr als vOkBei/aOkBei.
  // Und wer nach dem Start gar nichts tut, berührt den Draht im ersten Bogen:
  // Das ist das Ende, mit Ergebnis.
  {
    const { kontext, seite } = await neueSeite({ width: 1000, height: 640 });
    await seite.goto(`${BASIS}/draht`, { waitUntil: "load" });
    await seite.waitForFunction(() => window.LernappDraht?.state?.draht, null, { timeout: 8000 });
    const laeufe = await seite.evaluate(() => {
      const D = window.LernappDraht;
      const raus = [];
      for (let lauf = 0; lauf < 4; lauf += 1) {
        document.querySelector(".cm-bar-left .cm-icon-again").click();
        const st = D.state;
        D.druecken();
        D.loslassen();
        let enge = Infinity;
        for (let n = 0; st.schritt === "fahrt" && st.meter < 2000 && n < 400000; n += 1) {
          const v = D.tempoBei(st.S / D.METER);
          D.setzeRing(D.drahtBei((st.S + v / 120) / D.METER));
          D.takt(1 / 120);
          enge = Math.min(enge, D.toleranzBei(st.S / D.METER) - D.zitterBei(st.S / D.METER));
        }
        // Was der Draht quer verlangt, Stelle für Stelle bis 2000 m (ohne das
        // Zittern – dem folgt man nicht, ihm weicht man in der Mitte aus).
        const S0 = st.S;
        const w = (x) => { st.S = x; return D.drahtBei(x / D.METER); };
        let zuViel = 0;
        for (let S = 1; S < 20000; S += 2) {
          const v = D.tempoBei(S / D.METER);
          const w0 = w(S - 0.5);
          const w1 = w(S);
          const w2 = w(S + 0.5);
          zuViel = Math.max(zuViel, (Math.abs(w2 - w0) * v) / D.vOkBei(S / D.METER), (Math.abs(w2 - 2 * w1 + w0) * 4 * v * v) / D.aOkBei(S / D.METER));
        }
        st.S = S0;
        raus.push({ meter: st.meter, schritt: st.schritt, enge: Math.round(enge * 10) / 10, zuViel: Math.round(zuViel * 1000) / 1000 });
      }
      return raus;
    });
    pruefe(laeufe.every((l) => l.meter >= 2000 && l.schritt === "fahrt" && l.enge >= 8 && l.zuViel <= 1.02),
      `Heisser Draht: Der Autopilot kommt nicht an jedem Draht entlang, oder der Draht verlangt mehr, als der Ring kann – ${JSON.stringify(laeufe)}`);
    await seite.evaluate(() => document.querySelector(".cm-bar-left .cm-icon-again").click());
    await seite.evaluate(() => { window.LernappDraht.druecken(); window.LernappDraht.loslassen(); });
    await seite.waitForSelector(".cm-result-score", { timeout: 10000 }).catch(() => {});
    const ende = await seite.evaluate(() => ({
      zahl: document.querySelector(".cm-result-score")?.textContent,
      schritt: window.LernappDraht.state.schritt,
      meter: window.LernappDraht.state.meter,
    }));
    pruefe(ende.schritt === "crash" && ende.zahl !== undefined && ende.meter >= 15,
      `Heisser Draht: Ohne Ziehen endet die Runde nicht am Draht: ${JSON.stringify(ende)}`);
    await kontext.close();
  }

  // --- 4g15. Kranhafen: immer stapelbar, und ein Fehlwurf beendet die Runde --------
  // Ein Autopilot stapelt auf mehreren gewürfelten Häfen 40 Container, jeden
  // genau in die Mitte (vorhersage: wo er landen würde, liesse man jetzt los).
  // Findet er für einen Container acht Sekunden lang keinen Augenblick dafür,
  // verlangt der Hafen mehr, als ein Kind kann. Und wer danebenwirft, sieht den
  // Container ins Wasser gehen – das ist das Ende, mit Ergebnis.
  {
    const { kontext, seite } = await neueSeite({ width: 1000, height: 640 });
    await seite.goto(`${BASIS}/kranhafen`, { waitUntil: "load" });
    await seite.waitForFunction(() => window.LernappKranhafen?.state, null, { timeout: 8000 });
    const laeufe = await seite.evaluate(() => {
      const K = window.LernappKranhafen;
      const raus = [];
      for (let lauf = 0; lauf < 4; lauf += 1) {
        document.querySelector(".cm-bar-left .cm-icon-again").click();
        const st = K.state;
        let warten = 0;
        let laengste = 0;
        for (let n = 0; n < 400000 && st.phase !== "ende" && st.punkte < 40; n += 1) {
          const v = K.vorhersage();
          if (v) {
            warten += 1 / 120;
            if (v.perfekt) { laengste = Math.max(laengste, warten); warten = 0; K.druecken(); }
          }
          if (warten > 8) break;
          K.takt(1 / 120);
        }
        raus.push({ punkte: st.punkte, phase: st.phase, schiffe: st.schiffNr, warten: Math.round(Math.max(laengste, warten) * 10) / 10 });
      }
      return raus;
    });
    pruefe(laeufe.every((l) => l.punkte >= 40 && l.phase === "spiel" && l.warten <= 8),
      `Kranhafen: Der Autopilot stapelt nicht auf jedem Hafen 40 Container – ${JSON.stringify(laeufe)}`);
    await seite.evaluate(() => document.querySelector(".cm-bar-left .cm-icon-again").click());
    const ende = await seite.evaluate(() => {
      const K = window.LernappKranhafen;
      const st = K.state;
      for (let n = 0; n < 20000 && st.phase !== "ende"; n += 1) {
        const v = K.vorhersage();
        if (v && v.daneben) K.druecken();
        K.takt(1 / 120);
      }
      return st.phase;
    });
    await seite.waitForSelector(".cm-result-score", { timeout: 8000 }).catch(() => {});
    const zahl = await seite.evaluate(() => document.querySelector(".cm-result-score")?.textContent);
    pruefe(ende === "ende" && zahl === "0", `Kranhafen: Ein Fehlwurf beendet die Runde nicht mit Ergebnis: ${ende} / ${zahl}`);
    await kontext.close();
  }

  // --- 4g16. Zwei Spuren: immer fahrbar, und ohne Eingabe ist bald Schluss ---------
  // Ein Autopilot fährt mehrere gewürfelte Welten zweieinhalb Minuten lang: In
  // jedem Kanal fährt er in die Spur, die das nächste Ding verlangt – einmal
  // so früh wie möglich, einmal so spät wie möglich (erst, wenn bis zum Ding
  // nur noch der halbe Wechsel bleibt). Wo er nicht durchkommt, verlangt die
  // Welt einen Wechsel, der nicht zu schaffen ist. Und wer nach dem Start
  // nichts mehr tippt, trifft bald ein Hindernis oder verpasst einen Stern –
  // das ist das Ende, mit Ergebnis.
  {
    const { kontext, seite } = await neueSeite({ width: 420, height: 800 });
    await seite.goto(`${BASIS}/spuren`, { waitUntil: "load" });
    await seite.waitForFunction(() => window.LernappSpuren?.state, null, { timeout: 8000 });
    const fahrten = await seite.evaluate(() => {
      const Z = window.LernappSpuren;
      const raus = [];
      for (const art of ["frueh", "spaet"]) {
        for (let lauf = 0; lauf < 4; lauf += 1) {
          document.querySelector(".cm-bar-left .cm-icon-again").click();
          const st = Z.state;
          Z.tippe("links");   // der erste Tipp startet nur
          for (let n = 0; st.phase === "spiel" && st.tick < 240 * 150 && n < 400000; n += 1) {
            const v = Z.tempoBei(st.weg);
            for (const bahn of [0, 1]) {
              const ding = Z.naechste(bahn);
              if (!ding || st.schlitten[bahn].ziel === ding.soll) continue;
              if (art === "spaet" && ding.ab - Z.TREFF_L > v * (Z.K * Z.TAKT * 0.55 + 3 * Z.TAKT) + 1) continue;
              Z.tippe(bahn);
            }
            Z.takt(1 / 120);
          }
          raus.push({ art, sekunden: Math.round(st.tick / 240), punkte: st.punkte, phase: st.phase, fehler: st.fehler?.text || null });
        }
      }
      return raus;
    });
    pruefe(fahrten.every((f) => f.sekunden >= 150 && f.phase === "spiel" && f.punkte >= 250),
      `Zwei Spuren: Der Autopilot kommt nicht durch jede Welt – ${JSON.stringify(fahrten)}`);
    await seite.evaluate(() => document.querySelector(".cm-bar-left .cm-icon-again").click());
    await seite.evaluate(() => window.LernappSpuren.tippe("links"));
    await seite.waitForSelector(".cm-result-score", { timeout: 15000 }).catch(() => {});
    const ende = await seite.evaluate(() => ({ zahl: document.querySelector(".cm-result-score")?.textContent, phase: window.LernappSpuren.state.phase, fehler: window.LernappSpuren.state.fehler?.text || null }));
    pruefe(ende.phase === "ende" && ende.zahl !== undefined && Boolean(ende.fehler),
      `Zwei Spuren: Ohne Eingabe endet die Runde nicht mit Ergebnis: ${JSON.stringify(ende)}`);
    await kontext.close();
  }

  // --- 4g17. Ball hochhalten: immer haltbar, und der Rasen beendet die Runde ---------
  // Ein Autopilot tippt den Ball auf mehreren gewürfelten Welten bis 120
  // Kontakte hoch – durch Böen, an Tauben und Schranken vorbei. Wo er den Ball
  // verliert, verlangt der Plan mehr, als ein Kick kann. Der Ball bleibt dabei
  // immer unter dem Netz. Und wer nach dem Anstoss nichts tippt, sieht ihn
  // auf den Rasen fallen – das ist das Ende, mit Ergebnis.
  {
    const { kontext, seite } = await neueSeite({ width: 390, height: 844 });
    await seite.goto(`${BASIS}/ball`, { waitUntil: "load" });
    await seite.waitForFunction(() => window.LernappBall?.state && window.LernappBall.view.cssW > 0, null, { timeout: 8000 });
    const runden = await seite.evaluate(() => {
      const B = window.LernappBall;
      const raus = [];
      for (let lauf = 0; lauf < 4; lauf += 1) {
        document.querySelector(".cm-bar-left .cm-icon-again").click();
        const st = B.state;
        B.tippe(B.ball.x, B.ball.y);
        let hoechst = 0;
        for (let n = 0; st.schritt === "flug" && st.kontakte < 120 && n < 400000; n += 1) {
          const b = B.ball;
          hoechst = Math.max(hoechst, b.y + b.r);
          const k = st.kontakte;
          if (b.vy < 0 && b.y < 115 && st.zeit - st.letzterKick > 0.25) {
            // Weg von einer Schranke, sonst zur Mitte; gegen die Böe vorhalten.
            const gg = B.gBei(k);
            const balken = st.plan.balken.find((s) => s.raus > 0.05 || (k >= s.ab - 1 && k < s.bis));
            const ziel = balken ? -balken.seite * 70 : 0;
            const hub = Math.max(B.APEX - b.y, B.HUB_MIN);
            const T = Math.sqrt(2 * gg * hub) / gg + Math.sqrt(2 * (b.y + hub - 100) / gg);
            const vx = (ziel - b.x) / T - st.wind.ax * 0.6;
            const off = Math.max(-0.95, Math.min(0.95, -vx / B.vxBei(k)));
            B.tippe(b.x + off * b.r, b.y);
          }
          B.takt(1 / 120);
        }
        raus.push({ kontakte: st.kontakte, schritt: st.schritt, hoechst: Math.round(hoechst), dach: B.DACH });
      }
      return raus;
    });
    pruefe(runden.every((r) => r.kontakte >= 120 && r.schritt === "flug" && r.hoechst <= r.dach + 1),
      `Ball hochhalten: Der Autopilot hält den Ball nicht auf jeder Welt – ${JSON.stringify(runden)}`);
    // Ohne Tipp: Anstoss mit der Leertaste, dann fällt der Ball auf den Rasen.
    await seite.evaluate(() => document.querySelector(".cm-bar-left .cm-icon-again").click());
    await seite.keyboard.press("Space");
    await seite.waitForSelector(".cm-result-score", { timeout: 8000 }).catch(() => {});
    const ende = await seite.evaluate(() => ({
      zahl: document.querySelector(".cm-result-score")?.textContent,
      schritt: window.LernappBall.state.schritt,
      grund: window.LernappBall.state.grund,
      phase: window.LernappBall.state.phase,
    }));
    pruefe(ende.schritt === "aus" && ende.phase === "ende" && ende.zahl !== undefined && ende.grund === "zu spät!",
      `Ball hochhalten: Ohne Tipp endet die Runde nicht auf dem Rasen: ${JSON.stringify(ende)}`);
    // Ein Tipp neben den Ball zählt nicht – und heisst am Ende «daneben getippt!».
    await seite.evaluate(() => document.querySelector(".cm-bar-left .cm-icon-again").click());
    const luft = await seite.evaluate(() => {
      const B = window.LernappBall;
      B.tippe(B.ball.x, B.ball.y);
      for (let n = 0; n < 60; n += 1) B.takt(1 / 120);
      const vorher = B.state.kontakte;
      const traf = B.tippe(B.ball.x + B.ball.r * 3, B.ball.y);
      for (let n = 0; B.state.schritt === "flug" && n < 2000; n += 1) B.takt(1 / 120);
      return { vorher, nachher: B.state.kontakte, traf, grund: B.state.grund };
    });
    pruefe(luft.traf === false && luft.nachher === luft.vorher && luft.grund === "daneben getippt!",
      `Ball hochhalten: Ein Luftloch zählt oder wird nicht als solches gemeldet: ${JSON.stringify(luft)}`);
    // Links getroffen fliegt er nach rechts, rechts getroffen nach links.
    const richtung = await seite.evaluate(() => {
      const B = window.LernappBall;
      document.querySelector(".cm-bar-left .cm-icon-again").click();
      B.tippe(B.ball.x - B.ball.r * 0.7, B.ball.y);
      const nachRechts = B.ball.vx;
      for (let n = 0; n < 200 && !(B.ball.vy < 0 && B.ball.y < 150); n += 1) B.takt(1 / 120);
      B.tippe(B.ball.x + B.ball.r * 0.7, B.ball.y);
      return { nachRechts, nachLinks: B.ball.vx };
    });
    pruefe(richtung.nachRechts > 0 && richtung.nachLinks < 0,
      `Ball hochhalten: Die Richtung folgt nicht dem Treffpunkt: ${JSON.stringify(richtung)}`);
    await kontext.close();
  }

  // --- 4g18. Jongleur: schaffbar, und wer nichts tut, ist bald draussen ----------
  // (gefüllt von jongleur.js)
  {
  }

  // --- 4g19. Skispringen: schaffbar, und wer nichts tut, ist bald draussen ----------
  // (gefüllt von skispringen.js)
  {
  }

  // --- 4g20. Fallschirm: schaffbar, und wer nichts tut, ist bald draussen ----------
  // (gefüllt von fallschirm.js)
  {
  }

  // --- 4g21. Holzfäller: schaffbar, und wer nichts tut, ist bald draussen ----------
  // (gefüllt von holzfaeller.js)
  {
  }

  // --- 4g22. Fledermaus: schaffbar, und wer nichts tut, ist bald draussen ----------
  // (gefüllt von fledermaus.js)
  {
  }

  // --- 4g23. Zeitlupen-Ninja: schaffbar, und wer nichts tut, ist bald draussen ----------
  // Ein Autopilot, der die Zukunft kennt, läuft durch mehrere gewürfelte
  // Welten 24 Räume weit – tief in die schwere Phase. Bliebe er stecken, hätte
  // der Zufall einen Raum gebaut, durch den kein Weg führt. Dazu: Die Zeit
  // läuft nur mit dem Ninja (steht er, kriecht sie mit R_MIN), wer nichts tut,
  // wird bald getroffen, und wer stur zum Tor läuft, auch – beides mit
  // Ergebnis. Tasten und Ziehen bewegen ihn. Und ein Lauf, den man anschaut,
  // endet im selben Raum, mit denselben Punkten, an derselben Stelle.
  {
    // Der Autopilot (läuft in der Seite): Alle 0,1 s Weltzeit wählt er eine
    // von neun Aktionen – acht Richtungen oder warten (auf der Stelle treten).
    // Welche, entscheidet eine Suche in Strahlen fünf Entscheide voraus: Jeder
    // Zweig wird wirklich gerechnet (sichern, schritt, zurueck) – Pfeile,
    // Klingen, Fallen, was zielt und was verfolgt –, wer getroffen wird,
    // fällt weg, die besten nach dem Weg zum Tor bleiben. Gerät er in eine
    // Klemme (kein Zweig überlebt bis zum Ende), geht er ein paar Entscheide
    // zurück und sucht dort tiefer. aufzeichnen gibt die Eingabe jedes
    // Schritts mit, damit sich der Lauf im Bildtakt wiederholen lässt (plane).
    const ninjaPilot = ({ raeume = 24, tiefe = 5, breite = 24, entscheid = 24, maxEntscheide = 8000, aufzeichnen = false } = {}) => {
      const N = window.LernappNinja;
      const st = N.state;
      const R = Math.SQRT1_2;
      const AKTIONEN = [[0, 1], [R, R], [1, 0], [R, -R], [0, -1], [-R, -R], [-1, 0], [-R, R], null];
      const eingaben = [];
      const fuehre = (a, n, merken) => {
        for (let i = 0; i < n; i += 1) {
          const e = a ? { x: a[0], y: a[1] } : { x: i % 2 ? -1 : 1, y: 0 };
          N.steuere(e.x, e.y);
          if (merken) eingaben.push(e);
          N.schritt();
          if (st.schritt !== "lauf") return;
        }
      };
      // Wie gut ein Stand ist: der Weg zum Tor – und nicht zu nah an den
      // Seitenmauern, wo die Schützen aus nächster Nähe treffen.
      const wert = () => {
        if (st.schritt === "wechsel") return -1000;
        const rand = N.HALB - Math.abs(st.ninja.x);
        return Math.min(5000, N.wegZumTor(st.ninja.x, st.ninja.y)) + Math.max(0, 18 - rand) * 1.5;
      };
      // Eine Suche in Strahlen, t Entscheide tief, b breit. voll: ein Zweig hat
      // bis ans Ende überlebt (oder das Tor erreicht).
      const suche = (t, b) => {
        const wurzel = N.sichern();
        let strahl = [{ k: wurzel, erste: -1, wert: wert() }];
        let bester = null;
        let voll = false;
        for (let d = 0; d < t; d += 1) {
          const zellen = new Map();
          for (const knoten of strahl) {
            for (let ai = 0; ai < AKTIONEN.length; ai += 1) {
              N.zurueck(knoten.k);
              fuehre(AKTIONEN[ai], entscheid, false);
              if (st.schritt === "aus") continue;
              const kind = { k: N.sichern(), erste: d === 0 ? ai : knoten.erste, wert: wert() };
              if (kind.wert < -500) { bester = kind; voll = true; break; }
              const zelle = `${Math.round(st.ninja.x / 3)},${Math.round(st.ninja.y / 3)}`;
              if (!zellen.has(zelle) || zellen.get(zelle).wert > kind.wert) zellen.set(zelle, kind);
            }
            if (voll) break;
          }
          if (voll) break;
          const neu = [...zellen.values()].sort((x, y) => x.wert - y.wert);
          if (!neu.length) break;
          strahl = neu.slice(0, b);
          bester = strahl[0];
          if (d === t - 1) voll = true;
        }
        N.zurueck(wurzel);
        return { erste: bester ? bester.erste : -1, voll };
      };
      N.sim(true);
      let entscheide = 0;
      let verlauf = [];
      let stark = 0;
      let rueck = 0;
      let raum = st.raum;
      let ruecksprung = 0;
      while (st.phase === "spiel" && st.geschafft < raeume && entscheide < maxEntscheide) {
        if (st.schritt === "wechsel") { N.steuere(0, 0); N.schritt(); continue; }
        if (st.schritt !== "lauf") break;
        if (st.raum !== raum) { raum = st.raum; verlauf = []; rueck = 0; stark = 0; }
        entscheide += 1;
        verlauf.push({ k: N.sichern(), e: eingaben.length });
        const s = stark > 0 ? suche(9, 64) : suche(tiefe, breite);
        if (stark > 0) stark -= 1;
        if (!s.voll && rueck < 5 && verlauf.length > 1) {
          // In der Klemme: ein Stück zurück und dort genauer suchen.
          rueck += 1;
          ruecksprung += 1;
          const um = Math.min(verlauf.length, 4 * rueck);
          const ziel = verlauf[verlauf.length - um];
          verlauf.length -= um;
          N.zurueck(ziel.k);
          eingaben.length = ziel.e;
          stark = um + 3;
          continue;
        }
        fuehre(s.erste >= 0 ? AKTIONEN[s.erste] : null, entscheid, aufzeichnen);
      }
      N.steuere(null);
      N.sim(false);
      return { raeume: st.geschafft, punkte: st.punkte, schritt: st.schritt, grund: st.grund, raum: st.raum, W: st.W, entscheide, ruecksprung, eingaben };
    };

    const oeffne = async (name = "") => {
      const { kontext, seite } = await neueSeite({ width: 390, height: 844 });
      if (name) {
        await seite.addInitScript((n) => {
          if (sessionStorage.getItem("__ninja")) return;
          sessionStorage.setItem("__ninja", "1");
          localStorage.setItem("mini.name", n);
        }, name);
      }
      await seite.goto(`${BASIS}/ninja`, { waitUntil: "load" });
      await seite.waitForFunction(() => window.LernappNinja?.state && window.LernappNinja.view.cssW > 0, null, { timeout: 8000 });
      await seite.evaluate(`window.__ninjaPilot = ${ninjaPilot.toString()}`);
      const neu = () => seite.evaluate(() => {
        document.querySelector(".cm-bar-left .cm-icon-again").click();
        return window.LernappNinja.state.phase;
      });
      return { kontext, seite, neu };
    };
    let { kontext, seite, neu } = await oeffne();

    // Schaffbar: vier Welten, je 24 Räume.
    const laeufe = [];
    for (let welt = 0; welt < 4; welt += 1) {
      await neu();
      laeufe.push(await seite.evaluate(() => {
        window.LernappNinja.losGehts();
        const r = window.__ninjaPilot({ raeume: 24 });
        return { raeume: r.raeume, punkte: r.punkte, schritt: r.schritt, grund: r.grund, saat: window.LernappNinja.saat() };
      }));
    }
    pruefe(laeufe.every((l) => l.raeume >= 24 && l.schritt !== "aus"),
      `Zeitlupen-Ninja: Der Autopilot kommt nicht durch jede Welt – ${JSON.stringify(laeufe)}`);

    // Die Zeit läuft nur mit dem Ninja: eine Sekunde stehen, eine laufen.
    await neu();
    const zeit = await seite.evaluate(() => {
      const N = window.LernappNinja;
      const st = N.state;
      N.losGehts();
      const w0 = st.W;
      for (let i = 0; i < 240; i += 1) N.schritt();
      const steht = st.W - w0;
      N.steuere(1, 0);
      const w1 = st.W;
      for (let i = 0; i < 120; i += 1) N.schritt();
      N.steuere(-1, 0);
      for (let i = 0; i < 120; i += 1) N.schritt();
      N.steuere(null);
      return { steht, laeuft: st.W - w1, R_MIN: N.R_MIN };
    });
    pruefe(Math.abs(zeit.steht - zeit.R_MIN) < 0.01 && Math.abs(zeit.laeuft - 1) < 0.01,
      `Zeitlupen-Ninja: Die Weltzeit läuft nicht mit dem Ninja (eine Sekunde stehen, eine laufen): ${JSON.stringify(zeit)}`);

    // Wer nichts tut, wird getroffen – mit Ergebnis.
    await neu();
    const still = await seite.evaluate(() => {
      const N = window.LernappNinja;
      const st = N.state;
      N.losGehts();
      let n = 0;
      for (; st.phase === "spiel" && n < 60 * 600; n += 1) N.takt(1 / 60);
      return { sekunden: Math.round(n / 60), phase: st.phase, grund: st.grund, zahl: document.querySelector(".cm-result-score")?.textContent };
    });
    pruefe(still.phase === "ende" && still.grund === "pfeil" && still.zahl !== undefined,
      `Zeitlupen-Ninja: Ohne Eingabe endet die Runde nicht mit Ergebnis: ${JSON.stringify(still)}`);

    // Wer stur den kürzesten Weg zum Tor läuft, ohne auszuweichen, kommt
    // nicht weit.
    const stur = [];
    for (let welt = 0; welt < 3; welt += 1) {
      await neu();
      stur.push(await seite.evaluate(() => {
        const N = window.LernappNinja;
        const st = N.state;
        N.losGehts();
        let n = 0;
        for (; st.phase === "spiel" && n < 60 * 600; n += 1) {
          if (st.schritt === "lauf") {
            const x = st.ninja.x;
            const y = st.ninja.y;
            const w = (dx, dy) => N.wegZumTor(x + dx, y + dy);
            const gx = w(1, 0) - w(-1, 0);
            const gy = w(0, 1) - w(0, -1);
            const l = Math.hypot(gx, gy) || 1;
            N.steuere(-gx / l, -gy / l);
          }
          N.takt(1 / 60);
        }
        N.steuere(null);
        return { raeume: st.geschafft, phase: st.phase, grund: st.grund };
      }));
    }
    pruefe(stur.every((l) => l.phase === "ende" && l.grund && l.raeume < 12),
      `Zeitlupen-Ninja: Wer nicht ausweicht, kommt zu weit oder ohne Ende: ${JSON.stringify(stur)}`);

    // Tasten und Ziehen: Die Pfeiltaste nach oben und ein Zug mit der Maus
    // nach rechts bewegen ihn – der Zug genau so weit wie die Maus (geteilt
    // durch den Massstab), ohne dass er unter dem Finger klebt.
    await neu();
    const vorTaste = await seite.evaluate(() => ({ ...window.LernappNinja.ninja }));
    await seite.keyboard.down("ArrowUp");
    await seite.waitForTimeout(400);
    await seite.keyboard.up("ArrowUp");
    const nachTaste = await seite.evaluate(() => ({ ...window.LernappNinja.ninja, phase: window.LernappNinja.state.phase }));
    pruefe(nachTaste.phase === "spiel" && nachTaste.y > vorTaste.y + 15 && Math.abs(nachTaste.x - vorTaste.x) < 2,
      `Zeitlupen-Ninja: Die Pfeiltaste bewegt den Ninja nicht nach oben: ${JSON.stringify({ vorTaste, nachTaste })}`);
    await neu();
    const vorZug = await seite.evaluate(() => ({ ...window.LernappNinja.ninja, s: window.LernappNinja.view.s }));
    await seite.mouse.move(100, 700);
    await seite.mouse.down();
    for (let i = 1; i <= 12; i += 1) {
      await seite.mouse.move(100 + i * 4, 700);
      await seite.waitForTimeout(30);
    }
    await seite.mouse.up();
    await seite.waitForTimeout(300);
    const nachZug = await seite.evaluate(() => ({ ...window.LernappNinja.ninja, phase: window.LernappNinja.state.phase }));
    const soll = 48 / vorZug.s;
    pruefe(nachZug.phase === "spiel" && Math.abs(nachZug.x - vorZug.x - soll) < soll * 0.25 && Math.abs(nachZug.y - vorZug.y) < 1.5,
      `Zeitlupen-Ninja: Ziehen bewegt den Ninja nicht um den Weg des Fingers (${soll.toFixed(1)}): ${JSON.stringify({ vorZug, nachZug })}`);

    // Anschauen: Ein Lauf durch zwei Räume, im Bildtakt gespielt (der Plan
    // gibt jedem Schritt seine Eingabe), dann so, dass er bald getroffen
    // wird. Wer ihn anschaut, sieht dieselben Räume und den Ninja bis an
    // dieselbe Stelle – mit denselben Punkten. Auf einer frischen Seite:
    // Sonst läge dort schon ein Lauf mit ebenso vielen Punkten.
    await kontext.close();
    ({ kontext, seite, neu } = await oeffne("Zora"));
    const geplant = await seite.evaluate(() => {
      const N = window.LernappNinja;
      const st = N.state;
      const saat = N.saat();
      N.losGehts();
      const r = window.__ninjaPilot({ raeume: 2, aufzeichnen: true });
      const plan = r.eingaben;
      N.sim(true);
      while (st.schritt === "wechsel") N.schritt();
      // Erst eine Weile in eine Richtung, dann in eine zweite: die
      // Verbindung, die am schnellsten trifft.
      const k = N.sichern();
      const richtung = (a) => ({ x: Math.cos((a * Math.PI) / 4), y: Math.sin((a * Math.PI) / 4) });
      let bester = null;
      for (const lang of [0, 60, 150, 300]) {
        for (let a = 0; a < 8; a += 1) {
          for (let b = 0; b < 8; b += 1) {
            N.zurueck(k);
            let n = 0;
            for (; st.schritt === "lauf" && n < 240 * 5; n += 1) {
              const e = richtung(n < lang ? a : b);
              N.steuere(e.x, e.y);
              N.schritt();
            }
            if (st.schritt === "aus" && (!bester || n < bester.n)) bester = { n, a, b, lang };
          }
        }
      }
      N.zurueck(k);
      N.steuere(null);
      N.sim(false);
      for (let n = 0; bester && n < bester.n + 240; n += 1) plan.push(richtung(n < bester.lang ? bester.a : bester.b));
      // Von vorn, mit derselben Saat – und im Bildtakt.
      N.halte(saat);
      document.querySelector(".cm-bar-left .cm-icon-again").click();
      N.halte(null);
      N.plane(plan);
      N.losGehts();
      return { saat, schritte: plan.length, gerichtet: Boolean(bester) };
    });
    await seite.waitForSelector(".cm-result-score", { timeout: 45000 }).catch(() => {});
    await seite.waitForFunction(() => [...(window.__miniGeister?.keys?.() || [])].some((k) => k.startsWith("timeNinja_")), null, { timeout: 6000 }).catch(() => {});
    const gespielt = await seite.evaluate(() => {
      const N = window.LernappNinja;
      const st = N.state;
      const kennung = localStorage.getItem("mini.id");
      const geist = window.__miniGeister?.get(`timeNinja_${kennung}`) || null;
      let d = null;
      try { d = JSON.parse(geist?.bahn || "null"); } catch { d = null; }
      return {
        kennung, saat: d?.s ?? null, mitOrt: Array.isArray(d?.a) && Array.isArray(d?.c), punkte: st.punkte, geistPunkte: geist?.punkte || 0,
        raum: st.raum, grund: st.grund, x: st.aus?.x ?? null, y: st.aus?.y ?? null, W: st.W, welt: N.weltText(),
      };
    });
    pruefe(geplant.gerichtet && gespielt.kennung && gespielt.saat === geplant.saat && gespielt.mitOrt && gespielt.raum === 2 && gespielt.grund
      && gespielt.punkte >= 20 && gespielt.geistPunkte === gespielt.punkte,
      `Zeitlupen-Ninja: Der Lauf im Bildtakt geht nicht wie geplant oder wird nicht mit Saat und Weg hinterlegt: ${JSON.stringify({ geplant, gespielt: { ...gespielt, welt: undefined } })}`);
    await seite.goto(`${BASIS}/ninja?zuschauen=${gespielt.kennung}`, { waitUntil: "load" });
    await seite.waitForFunction(() => window.LernappNinja?.state?.phase === "zuschauen", null, { timeout: 8000 }).catch(() => {});
    const anfang = await seite.evaluate(() => ({ phase: window.LernappNinja.state.phase, welt: window.LernappNinja.weltText() }));
    pruefe(anfang.phase === "zuschauen" && anfang.welt === gespielt.welt, `Zeitlupen-Ninja: Beim Zuschauen entstehen andere Räume:\n  gespielt ${gespielt.welt}\n  angeschaut ${anfang.welt}`);
    await seite.waitForSelector(".gz-tafel:not([hidden]) .gz-nochmal", { timeout: 60000 }).catch(() => {});
    const angeschaut = await seite.evaluate(() => {
      const st = window.LernappNinja.state;
      return { raum: st.raum, punkte: st.punkte, x: st.aus?.x ?? null, y: st.aus?.y ?? null, W: st.W, tafel: Boolean(document.querySelector(".gz-tafel:not([hidden]) .gz-nochmal")) };
    });
    pruefe(angeschaut.tafel && angeschaut.raum === gespielt.raum && angeschaut.punkte === gespielt.punkte
      && Math.hypot(angeschaut.x - gespielt.x, angeschaut.y - gespielt.y) < 4 && Math.abs(angeschaut.W - gespielt.W) < 0.15,
      `Zeitlupen-Ninja: Der angeschaute Lauf endet anders als gespielt: ${JSON.stringify({ gespielt: { ...gespielt, welt: undefined }, angeschaut })}`);
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
    // Zuerst ist alles zugeklappt: nur die Köpfe der Bereiche mit ihren
    // Zahlen. Die Kacheln oben sind Knöpfe – "Turniere" klappt die Turniere auf.
    await seite.waitForSelector(".adm-seite > .adm-klapp", { timeout: 8000 });
    const zu = await seite.evaluate(() => [...document.querySelectorAll(".adm-seite > .adm-klapp")].map((b) => ({
      titel: b.querySelector(".adm-klapp-name")?.textContent || "",
      offen: b.classList.contains("ist-offen") || !b.querySelector(".adm-klapp-inhalt").hidden,
    })));
    pruefe(zu.length === 4 && zu.every((b) => !b.offen), `Der Adminbereich steht nicht zugeklappt da: ${JSON.stringify(zu)}`);
    pruefe(await seite.locator(".adm-streifen button.adm-kachel").count() === 5, "Oben stehen nicht fünf Kacheln zum Antippen.");
    await seite.locator(".adm-kachel", { hasText: "Turnier" }).click();
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

    // Die Tiers: Vorgabe 14 / 4 / 5, neben jedem Spiel T1/T2/T3. Wer eines
    // umteilt, speichert es – und das nächste Turnier sieht es so.
    await seite.locator(".adm-kachel", { hasText: "Spielen offen" }).click();
    const auswahlText = await seite.locator("#adm-auswahl").innerText();
    pruefe(/\d+ von \d+ angehakt/.test(auswahlText) && !/Angehakt heisst/.test(auswahlText) && !/Mit ▶ spielst du/.test(auswahlText),
      `Über der Spielauswahl steht noch der erklärende Absatz, oder die Zahl fehlt: ${auswahlText.slice(0, 200)}`);
    const tierZahlen = () => seite.locator(".adm-tiers .adm-tier-titel").allInnerTexts();
    pruefe(JSON.stringify((await tierZahlen()).map((t) => t.replace(/\s+/g, " "))) === JSON.stringify(["Tier 1 14 Spiele", "Tier 2 4 Spiele", "Tier 3 5 Spiele"])
      && await seite.locator(".adm-tiers .adm-tier-wahl").count() === SPIELE.length,
      `Die Spiele stehen nicht nach Tier eingeteilt: ${JSON.stringify(await tierZahlen())}`);
    await seite.locator('.adm-tiers .adm-tier-wahl[aria-label="Tier von Fischteich"]').selectOption("1");
    await seite.waitForFunction(() => window.__miniTiers?.fishPond === 1, null, { timeout: 4000 }).catch(() => {});
    const umgeteilt = await seite.evaluate(() => ({ tiers: window.__miniTiers, titel: [...document.querySelectorAll(".adm-tiers .adm-tier-titel")].map((t) => t.textContent) }));
    pruefe(umgeteilt.tiers?.fishPond === 1 && umgeteilt.tiers?.towerStack === 1 && umgeteilt.tiers?.leafFlow === 2 && /15/.test(umgeteilt.titel[0] || ""),
      `Das Umteilen in ein Tier wird nicht gespeichert oder nicht gezeigt: ${JSON.stringify(umgeteilt)}`);

    // Ein neues Turnier – und solange es entsteht, steht nur das Formular da.
    await seite.click('.adm-turniere button:text-is("Neues Turnier")');
    await seite.waitForSelector(".adm-turnier-form", { timeout: 4000 });
    const allein = await sichtbar();
    pruefe(allein.form && allein.kopf, `Das neue Turnier steht nicht da: ${JSON.stringify(allein)}`);
    pruefe(!allein.liste && !allein.streifen && !allein.andere, `Unter dem neuen Turnier hängt noch der Rest des Adminbereichs: ${JSON.stringify(allein)}`);
    const form = seite.locator(".adm-turnier-form");
    pruefe(await form.locator(".adm-wahl .adm-spielen-knopf").count() === SPIELE.length,
      `Im Turnierformular hat nicht jedes Spiel einen Knopf zum Spielen (${await form.locator(".adm-spielen-knopf").count()} von ${SPIELE.length}).`);
    // Im Formular nach Tier gruppiert, mit einem Knopf je Tier: dazu, und ist
    // es schon ganz gewählt, wieder weg.
    await form.locator("button", { hasText: "Keine" }).click();
    await form.locator("button", { hasText: /^Tier 1$/ }).click();
    const tierEins = await form.locator(".adm-wahl input:checked").evaluateAll((liste) => liste.map((b) => b.value).sort());
    pruefe(JSON.stringify(tierEins) === JSON.stringify(["balloonRide", "bridgeBuilder", "craneHarbor", "driftRace", "fishPond", "frogHop", "hillGlide", "keepyUppy", "ropeWalk", "skiSlalom", "towerStack", "tunnelFlight", "twinLanes", "vineSwing", "wireLoop"])
      && await form.locator(".adm-tier-titel").count() === 3,
      `«Tier 1» im Turnierformular wählt nicht die Spiele von Tier 1 (mit dem eben umgeteilten Fischteich): ${tierEins.join(", ")}`);
    await form.locator("button", { hasText: /^Tier 2$/ }).click();
    await form.locator("button", { hasText: /^Tier 1$/ }).click();
    const tierZwei = await form.locator(".adm-wahl input:checked").evaluateAll((liste) => liste.map((b) => b.value).sort());
    pruefe(JSON.stringify(tierZwei) === JSON.stringify(["boilerRoom", "dartWheel", "leafFlow", "planetHop"]),
      `«Tier 2» dazu und «Tier 1» wieder weg ergibt nicht Tier 2: ${tierZwei.join(", ")}`);
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
    const replayHaken = form.locator(".adm-option", { hasText: "Replays anschauen" }).locator("input");
    pruefe(await replayHaken.isChecked(), "Ein neues Turnier lässt die Replays nicht von selbst anschauen.");
    await replayHaken.uncheck();
    await form.locator('button[type="submit"]').click();
    await seite.waitForFunction(() => [...window.__miniTurniere.values()].some((t) => t.name === "Test-Cup Ä"), null, { timeout: 4000 })
      .catch(() => {});
    const neu = await seite.evaluate(() => [...window.__miniTurniere.values()].find((t) => t.name === "Test-Cup Ä") || null);
    pruefe(Boolean(neu), "Das neue Turnier kam nicht an.");
    if (neu) {
      pruefe(/^test-cup-ae-[a-km-np-z2-9]{8}$/.test(neu.id), `Der Name des neuen Turniers taugt nicht als Link: ${neu.id}`);
      pruefe(JSON.stringify(neu.spiele) === JSON.stringify(["fishPond", "towerStack"]), `Im neuen Turnier stehen die Spiele ${neu.spiele.join(", ")}.`);
      pruefe(neu.versuche === 4 && neu.zaehlt === "summe" && neu.wertung === "prozent" && neu.aufgaben === "wieErster"
        && neu.sichtbar === "link" && neu.verdeckt === true && neu.aktiv === true && neu.ohneGeist === true && neu.ohneReplay === true,
        `Die Regeln des neuen Turniers kamen falsch an: ${JSON.stringify(neu)}`);
      pruefe(neu.endeMs - neu.startMs === TAG, `Das neue Turnier dauert ${(neu.endeMs - neu.startMs) / STUNDE} Stunden statt eines Tages.`);
      const meldung = await seite.locator(".adm-turniere .adm-klapp-inhalt > .adm-meldung").innerText();
      pruefe(meldung.includes(`/turnier?t=${neu.id}`), `Nach dem Anlegen steht der Link nicht da: ${meldung}`);
      pruefe(await seite.locator(".adm-turnier-name", { hasText: "Test-Cup Ä" }).count() === 1, "Das neue Turnier steht nicht in der Liste.");
      pruefe(await seite.locator(".adm-turnier.ist-offen .adm-turnier-name").innerText().catch(() => "") === "Test-Cup Ä",
        "Das eben angelegte Turnier ist nicht gleich ausgewählt.");
      const eckdaten = await seite.locator(".adm-turnier.ist-offen .adm-turnier-detail .adm-klein").first().innerText().catch(() => "");
      pruefe(/Level wie Platz 1/.test(eckdaten) && /ohne Replays/.test(eckdaten), `Beim neuen Turnier steht nicht, dass alle das Level von Platz 1 spielen und es keine Replays gibt: ${eckdaten}`);
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
    await seite.click('.adm-turniere button:text-is("Neues Turnier")');
    await seite.waitForSelector(".adm-turnier-form", { timeout: 4000 });
    await seite.locator(".adm-turnier-form-kopf button", { hasText: "Zurück" }).click();
    pruefe(await seite.locator(".adm-turnier-form").count() === 0, "«Zurück zur Übersicht» schliesst das Formular nicht.");
    pruefe(!(await seite.evaluate(() => document.querySelector(".adm-seite").classList.contains("ist-formular"))), "Nach «Zurück zur Übersicht» bleibt der Adminbereich ausgeblendet.");

    // Ein Spiel spielen: über dem ganzen Adminbereich, ohne dass der
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
    // Nicht von selbst ins Vollbild – aber über das ganze Browserfenster.
    const fuellt = await seite.evaluate(() => {
      const r = document.querySelector(".adm-spiel iframe").getBoundingClientRect();
      return { voll: Boolean(document.fullscreenElement), l: r.left, o: r.top, b: r.width - window.innerWidth, h: r.height - window.innerHeight };
    });
    pruefe(!fuellt.voll && fuellt.l === 0 && fuellt.o === 0 && Math.abs(fuellt.b) <= 1 && Math.abs(fuellt.h) <= 1,
      `Das Spiel aus dem Adminbereich füllt das Fenster nicht oder geht von selbst ins Vollbild: ${JSON.stringify(fuellt)}`);
    const imSpiel = seite.frameLocator(".adm-spiel iframe");
    await imSpiel.locator(".cm-bar").waitFor({ timeout: 8000 });
    pruefe(await imSpiel.locator(".cm-bar-left a").first().getAttribute("href") === "/admin", "Im Spiel aus dem Adminbereich führt der Weg oben links nicht zurück.");
    // Oben rechts der Knopf: Er bringt den Adminbereich samt Spiel ins
    // Vollbild, und das bleibt nach dem Spiel.
    pruefe(await imSpiel.locator(".cm-vollbild").count() === 1, "Im Spiel aus dem Adminbereich fehlt oben rechts der Knopf fürs Vollbild.");
    if (await imSpiel.locator(".cm-vollbild").count()) {
      await imSpiel.locator(".cm-vollbild").click();
      await seite.waitForFunction(() => document.fullscreenElement === document.documentElement, null, { timeout: 3000 }).catch(() => {});
      pruefe(await seite.evaluate(() => document.fullscreenElement === document.documentElement), "Der Knopf im Spiel bringt den Adminbereich nicht ins Vollbild.");
      // fullscreenElement steht schon, bevor fullscreenchange kommt – erst
      // dieses Ereignis zeichnet den Knopf neu (vollbild.js, verteile).
      await imSpiel.locator('.cm-vollbild[aria-pressed="true"]').waitFor({ timeout: 3000 }).catch(() => {});
      pruefe(await imSpiel.locator(".cm-vollbild").getAttribute("aria-pressed") === "true", "Der Knopf im Spiel zeigt nicht, dass Vollbild ist.");
    }
    await imSpiel.locator(".cm-bar-left a").first().click();
    await seite.waitForFunction(() => !document.querySelector(".adm-spiel"), null, { timeout: 4000 }).catch(() => {});
    pruefe(await seite.locator(".adm-spiel").count() === 0, "Der Weg zurück im Spiel schliesst das Fenster nicht.");
    pruefe(await seite.evaluate(() => Boolean(document.fullscreenElement)), "Nach dem Spiel endet das Vollbild – es soll bleiben, bis man es beendet.");
    pruefe(await seite.locator(".adm-kopf .adm-vollbild[aria-pressed=\"true\"]").count() === 1, "Im Kopf des Adminbereichs fehlt der Knopf, der das Vollbild beendet.");
    if (await seite.locator(".adm-kopf .adm-vollbild").count()) await seite.click(".adm-kopf .adm-vollbild");
    await seite.waitForFunction(() => !document.fullscreenElement, null, { timeout: 3000 }).catch(() => {});
    pruefe(await seite.evaluate(() => !document.fullscreenElement), "Mit dem Knopf im Adminbereich endet das Vollbild nicht.");
    pruefe(await seite.locator(".adm-kopf").count() === 1 && new URL(seite.url()).pathname === "/admin", "Nach dem Spiel ist der Adminbereich weg.");

    // Ein Haken, den die Datenbank ablehnt, springt zurück – und die Meldung,
    // warum, bleibt stehen (früher baute sich die Seite neu, und sie war weg).
    // Der nächste Haken, der durchgeht, ist gespeichert.
    const turmHaken = turmZeile.locator('input[type="checkbox"]');
    const turmVorher = await turmHaken.isChecked();
    await seite.evaluate(() => { window.__miniSpeichernScheitert = true; });
    await turmHaken.click();
    await seite.waitForFunction(() => /Nicht gespeichert/.test(document.querySelector(".adm-seite .adm-meldung.ist-fehler")?.textContent || ""), null, { timeout: 4000 }).catch(() => {});
    const abgelehnt = await seite.evaluate(() => ({
      meldung: document.querySelector(".adm-seite .adm-meldung.ist-fehler")?.textContent || "",
      offen: window.__miniOffen,
    }));
    pruefe(await turmHaken.isChecked() === turmVorher && /Nicht gespeichert/.test(abgelehnt.meldung) && abgelehnt.offen === undefined,
      `Ein abgelehnter Haken springt nicht zurück oder sagt nicht, warum: ${JSON.stringify({ ...abgelehnt, haken: await turmHaken.isChecked() })}`);
    await seite.evaluate(() => { window.__miniSpeichernScheitert = false; });
    await turmHaken.click();
    await seite.waitForFunction(() => Array.isArray(window.__miniOffen), null, { timeout: 4000 }).catch(() => {});
    const gespeichert = await seite.evaluate(() => window.__miniOffen);
    pruefe(Array.isArray(gespeichert) && gespeichert.includes("towerStack") === !turmVorher && await turmHaken.isChecked() === !turmVorher,
      `Nach einem abgelehnten Haken lässt sich nicht mehr speichern: ${JSON.stringify(gespeichert)}`);

    // Ein Turnier, in dem wartet, wer vorne liegt: unbegrenzt für alle
    // anderen – zusammenzählen geht deshalb nicht.
    await seite.click('.adm-turniere button:text-is("Neues Turnier")');
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
    await seite.click('.adm-turniere button:text-is("Neues Turnier")');
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
    // Die Spiele: eine Zeile je Spiel, nach Tier zu filtern, nach dem, was
    // auf der Startseite steht, oder nach einem Turnier – und nach jeder
    // Spalte zu sortieren. Der Filter gilt überall.
    await seite.locator(".adm-kachel", { hasText: "Einträge" }).click();
    const spielZeilen = "#adm-spiele .adm-spieltabelle > tbody > tr:not(.adm-detail)";
    pruefe(await seite.locator(spielZeilen).count() === SPIELE.length, `In den Spielen stehen ${await seite.locator(spielZeilen).count()} Zeilen statt ${SPIELE.length}.`);
    await seite.locator('#adm-spiele .adm-chip[data-tier="2"]').click();
    const nurZwei = await seite.$$eval(`${spielZeilen} td:nth-child(2)`, (z) => z.map((t) => t.textContent));
    pruefe(nurZwei.length > 0 && nurZwei.every((t) => t === "T2"), `Der Filter «Tier 2» zeigt: ${nurZwei.join(", ")}`);
    pruefe(await seite.locator('#adm-spieler .adm-chip[data-tier="2"][aria-pressed="true"]').count() === 1, "Der Filter gilt bei den Spielern nicht mit.");
    await seite.locator("#adm-spiele .adm-chip", { hasText: "Alle Tiers" }).click();
    await seite.locator("#adm-spiele .adm-filter-wahl").selectOption(`t:${HERBST}`);
    const imHerbst = await seite.$$eval("#adm-spiele .adm-spiel-schalter", (z) => z.map((s) => s.textContent.trim()));
    pruefe(imHerbst.length === 3 && ["Turmbau", "Fischteich", "Wo hält der Zug?"].every((t) => imHerbst.includes(t)),
      `Der Filter «Im Turnier: Herbstcup» zeigt: ${imHerbst.join(", ")}`);
    await seite.locator("#adm-spiele .adm-filter-weg").click();
    pruefe(await seite.locator(spielZeilen).count() === SPIELE.length, "«Filter aufheben» zeigt nicht wieder alle Spiele.");
    await seite.locator("#adm-spiele th button", { hasText: "Spieler" }).click();
    const nachSpielern = await seite.$$eval(`${spielZeilen} td:nth-child(4)`, (z) => z.map((t) => Number(t.textContent)));
    pruefe(nachSpielern[0] >= 1 && nachSpielern.every((n, i) => i === 0 || nachSpielern[i - 1] >= n), `Nach Spielern sortiert steht: ${nachSpielern.join(", ")}`);
    await seite.locator(".adm-kachel", { hasText: "Runden" }).click();
    pruefe(/Runden/i.test(await seite.locator('#adm-spiele th[aria-sort="descending"]').innerText().catch(() => "")),
      "Die Kachel «Runden» sortiert die Spiele nicht nach Runden.");

    await seite.locator(".adm-spiel-schalter", { hasText: "Fischteich" }).click();
    const teich = seite.locator(".adm-spiel-detail");
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

    // Die Auswertung eines Spielers: ein Tipp auf den Namen. Je Spiel der
    // Platz, dazu die Turniere – und alles, was sich mit ihm machen lässt.
    await seite.locator(".adm-kachel", { hasText: "Spieler" }).click();
    await seite.locator("#adm-spieler .adm-person", { hasText: "Grosi" }).click();
    await seite.waitForSelector(".adm-dash", { timeout: 4000 });
    await seite.waitForFunction(() => /Herbstcup/.test(document.querySelector(".adm-dash-turniere")?.textContent || ""), null, { timeout: 4000 }).catch(() => {});
    const auswertung = await seite.evaluate(() => ({
      titel: document.querySelector(".adm-dash-titel")?.textContent || "",
      spiele: [...document.querySelectorAll(".adm-dash tbody tr")].map((z) => z.innerText.replace(/\s+/g, " ").trim()),
      turniere: document.querySelector(".adm-dash-turniere")?.textContent.replace(/\s+/g, " ") || "",
    }));
    pruefe(auswertung.titel === "Grosi" && auswertung.spiele.length === 1 && /^Turmbau T\d 1\. von \d+ 99 /.test(auswertung.spiele[0]),
      `Die Auswertung von Grosi zeigt nicht ihre Spiele: ${JSON.stringify(auswertung)}`);
    pruefe(/\d\.\s*von \d\s*Herbstcup/.test(auswertung.turniere), `In der Auswertung fehlt der Platz im Herbstcup: ${auswertung.turniere}`);
    await seite.keyboard.press("Escape");
    pruefe(await seite.locator(".adm-dash").count() === 0, "Escape schliesst die Auswertung nicht.");
    await seite.locator("#adm-spieler .adm-person", { hasText: "Grosi" }).click();
    antwort = "Grossmami";
    await seite.locator(".adm-dash button", { hasText: "Namen ändern" }).click();
    await seite.waitForFunction(() => document.querySelector(".adm-dash-titel")?.textContent === "Grossmami", null, { timeout: 4000 }).catch(() => {});
    pruefe(await seite.evaluate(() => window.__miniEintraege.get("towerStack_mini_vorherdagewesen")?.name) === "Grossmami"
      && await seite.locator(".adm-dash-titel").innerText().catch(() => "") === "Grossmami",
      "Nach «Namen ändern» heisst der Eintrag nicht anders, oder die Auswertung ist zu.");
    await seite.locator(".adm-dash tbody tr", { hasText: "Turmbau" }).locator("button", { hasText: "Löschen" }).click();
    await seite.waitForFunction(() => !window.__miniEintraege.has("towerStack_mini_vorherdagewesen"), null, { timeout: 4000 }).catch(() => {});
    pruefe(!(await seite.evaluate(() => window.__miniEintraege.has("towerStack_mini_vorherdagewesen"))), "«Löschen» in der Auswertung hat das Ergebnis stehen lassen.");
    await seite.waitForFunction(() => !document.querySelector(".adm-dash"), null, { timeout: 4000 }).catch(() => {});
    pruefe(await seite.locator(".adm-dash").count() === 0, "Ohne Einträge bleibt die Auswertung offen.");

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
      ewig: [...window.__miniEintraege.values()].filter((e) => e.name === "Alain").map((e) => ({ game: e.game, punkte: e.punkte, spielMs: e.spielMs })),
      best: localStorage.getItem("mini.best"),
    }));
    pruefe(spur.ewig.length === 1 && spur.ewig[0].game === "towerStack" && spur.ewig[0].punkte > 0,
      `Die Runde aus dem Adminbereich steht nicht unter dem Namen in der ewigen Liste: ${JSON.stringify(spur.ewig)}`);
    // Mit ihrer Dauer: Sie zählt zur Spielzeit des Eintrags (mini-games.js,
    // rundeBeginnt/rundeEndet) – und mehr als eine halbe Stunde ist keine Runde.
    pruefe(spur.ewig[0]?.spielMs > 0 && spur.ewig[0].spielMs < 30 * 60 * 1000,
      `Die Runde kam ohne ihre Dauer in die ewige Liste: ${JSON.stringify(spur.ewig)}`);
    pruefe(Boolean(spur.best), "Die Runde aus dem Adminbereich hat keinen Bestwert auf dem Gerät hinterlassen.");
    await kontext.close();
  }

  // --- 4l. Wer vorne liegt, wartet ----------------------------------------------
  // Im Königscup darf spielen, wer nicht allein auf Platz 1 steht. König
  // führt in beiden Spielen und hat deshalb keinen Versuch mehr; Leo liegt
  // im Turmbau hinten, spielt sich nach vorne – und wartet dann selbst.
  {
    const { kontext, seite } = await mitTurnieren("/");
    await seite.waitForSelector(".cm-bar, .ar-kopf", { timeout: 8000 }).catch(() => {});
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
  // Der Weg ins Spiel auf der Turnierseite, je Spiel: Play – oder an seiner
  // Stelle das Schloss, und auf dem Bild, warum nicht. Gelesen wird Spiel
  // für Spiel, nach einem Tipp auf seine Kachel.
  const wegeImTurnier = async (seite) => {
    await seite.waitForSelector(".ar-kachel", { timeout: 8000 }).catch(() => {});
    const raus = [];
    for (const k of await seite.locator(".ar-kachel").all()) {
      await k.click();
      await seite.waitForTimeout(150);
      raus.push(await seite.evaluate(() => ({
        spiel: document.querySelector(".ar-kachel.ist-aktiv")?.dataset.spiel,
        link: document.querySelector(".ar-leiste .ar-play")?.getAttribute("href") || "",
        grund: document.querySelector(".ar-grund:not([hidden])")?.textContent || "",
      })));
    }
    return raus;
  };
  const alsKoenig = () => { localStorage.setItem("mini.id", "mini_koenigkoenig"); localStorage.setItem("mini.name", "König"); };
  const alsLeo = () => { localStorage.setItem("mini.id", "mini_leoleoleoleo"); localStorage.setItem("mini.name", "Leo"); };
  {
    const { kontext, seite } = await mitTurnieren(`/turnier?t=${KOENIG}`, { vorher: alsKoenig });
    const wege = await wegeImTurnier(seite);
    pruefe(wege.length === 2 && wege.every((w) => !w.link), `Wer überall vorne liegt, findet auf der Turnierseite trotzdem Play: ${JSON.stringify(wege)}`);
    // Kein Satz darüber – an der Stelle von Play steht «Du liegst vorne».
    pruefe(await seite.locator(".tn-wartet").count() === 0, "Über den Spielen steht wieder ein Satz für den, der überall vorne liegt.");
    pruefe(wege.every((w) => w.grund === "Du liegst vorne"), `Wer überall vorne liegt, liest nicht bei jedem Spiel «Du liegst vorne»: ${JSON.stringify(wege)}`);
    const ohne = await klassenOhneRegel(seite);
    pruefe(ohne.length === 0, `Königscup – Klassen ohne Regel: ${ohne.join(", ")}`);

    // Namen ändern auf der Turnierseite (oben rechts): Wer einen neuen Namen
    // nimmt, ist im Turnier ein neuer Mitspieler. Königs Einträge bleiben, wo
    // sie sind – und der Neue darf spielen.
    await seite.click(".ar-kopf .ar-name-knopf");
    pruefe(await seite.locator(".ar-name-feld .mini-name-steht", { hasText: "König" }).count() === 1, "Auf der Turnierseite steht nicht, unter welchem Namen man spielt.");
    await seite.click(".ar-name-feld .mini-name-steht button");
    await seite.fill(".ar-name-feld .mini-namensfeld input", "Prinz");
    await seite.click(".ar-name-feld .mini-namensfeld button[type=submit]");
    await seite.waitForFunction(() => document.querySelector(".ar-leiste .ar-play"), null, { timeout: 4000 }).catch(() => {});
    await seite.keyboard.press("Escape");
    const nachher = await wegeImTurnier(seite);
    const neu = await seite.evaluate((id) => ({
      koenig: [...window.__miniTurnierEintraege.values()].filter((e) => e.spieler === "mini_koenigkoenig").map((e) => e.name),
      id: localStorage.getItem("mini.id"),
    }), KOENIG);
    neu.spielen = nachher.filter((w) => w.link).length;
    pruefe(neu.spielen === 2, `Nach dem neuen Namen kann im Königscup ${neu.spielen} statt beide Spiele gespielt werden.`);
    pruefe(neu.koenig.length === 2 && neu.koenig.every((n) => n === "König"), `Der neue Name hat Königs Einträge geändert: ${neu.koenig.join(", ")}`);
    pruefe(neu.id !== "mini_koenigkoenig", "Mit dem neuen Namen spielt das Gerät im Turnier noch als König.");
    await kontext.close();
  }
  {
    const { kontext, seite } = await mitTurnieren(`/turnier?t=${KOENIG}`, { vorher: alsLeo });
    const wege = await wegeImTurnier(seite);
    const spielen = wege.filter((w) => w.link).length;
    pruefe(spielen === 2, `Wer nirgends vorne liegt, kann im Königscup ${spielen} statt beide Spiele spielen.`);
    pruefe(wege.every((w) => !w.grund), `Wer nirgends vorne liegt, liest, er liege vorne: ${JSON.stringify(wege)}`);
    await kontext.close();
  }
  {
    // Wer allein vorne liegt und das Spiel trotzdem öffnet, landet ohne ein
    // Wort wieder auf der Turnierseite – dort steht «Du liegst vorne».
    const { kontext, seite } = await mitTurnieren(`/turmbau?turnier=${KOENIG}`, { vorher: alsKoenig });
    await seite.waitForURL((url) => url.pathname === "/turnier", { timeout: 8000 }).catch(() => {});
    pruefe(seite.url().endsWith(`/turnier?t=${KOENIG}`), `Wer allein vorne liegt, bleibt im Spiel: ${seite.url()}`);
    const wege = await wegeImTurnier(seite);
    pruefe(wege.length === 2 && wege.every((w) => w.grund === "Du liegst vorne"),
      `Zurück auf der Turnierseite steht nicht bei jedem Spiel «Du liegst vorne»: ${JSON.stringify(wege)}`);
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
    await seite.waitForSelector(".tn-wertung", { timeout: 8000 });
    const text = (await seite.locator("[data-turnier]").innerText()).replace(/\n/g, " ");
    pruefe(/läuft ohne Zeitlimite · seit/.test(text), `Oben auf der Turnierseite ohne Zeitlimite steht: ${await seite.locator(".tn-status").innerText()}`);
    pruefe(!/9999|Tage/.test(text), `Auf der Turnierseite ohne Zeitlimite steht ein Ende: ${text}`);
    const wege = await wegeImTurnier(seite);
    pruefe(wege.length === 3 && wege.every((w) => w.link), `Im Turnier ohne Zeitlimite lässt sich nicht spielen: ${JSON.stringify(wege)}`);
    await kontext.close();
  }
  {
    const { kontext, seite } = await mitTurnieren(`/turmbau?turnier=${DAUER}`, { vorher: alsLeo });
    await seite.waitForFunction(() => window.LernappTurnier?.stand?.().freigegeben, null, { timeout: 8000 }).catch(() => {});
    pruefe(await seite.evaluate(() => window.LernappTurnier.stand().freigegeben && !document.querySelector(".tn-tor")),
      "Im Turnier ohne Zeitlimite geht es mit Namen nicht direkt ins Spiel.");
    await kontext.close();
  }

  // --- 4n. Ein Multiplayer im Turnier ---------------------------------------------
  // Hängt am Turnier ein Multiplayer, sieht ihn, wer im Turnier ist: auf der
  // Turnierseite oben und einmal in einem Fenster, in den Spielen als Band –
  // ausser während einer Runde.
  {
    // Als Text: Eine Funktion käme ohne ihre Variablen im Browser an.
    const zeiger = `window.__miniLiveZeiger = { "${HERBST}": { code: "K7QM", name: "Finale am Abend" } };`;
    const { kontext, seite } = await mitTurnieren(`/turnier?t=${HERBST}`, { vorher: zeiger });
    await seite.waitForSelector(".tn-live-dialog", { timeout: 8000 }).catch(() => {});
    const fenster = await seite.evaluate(() => ({
      offen: Boolean(document.querySelector(".tn-live-dialog[open]")),
      text: document.querySelector(".tn-live-dialog")?.textContent || "",
      weg: document.querySelector(".tn-live-dialog .tn-live-fenster-los")?.getAttribute("href") || "",
      oben: document.querySelector(".tn-oben .tn-live")?.getAttribute("href") || "",
    }));
    pruefe(fenster.offen && /Finale am Abend/.test(fenster.text) && fenster.weg === "/live?code=K7QM" && fenster.oben === "/live?code=K7QM",
      `Der Multiplayer im Turnier steht nicht im Fenster und oben: ${JSON.stringify(fenster)}`);
    await seite.locator(".tn-live-dialog button", { hasText: "Später" }).click();
    await seite.reload({ waitUntil: "load" });
    await seite.waitForSelector(".tn-oben .tn-live", { timeout: 8000 }).catch(() => {});
    await seite.waitForTimeout(500);
    pruefe(await seite.locator(".tn-oben .tn-live").count() === 1 && await seite.locator(".tn-live-dialog").count() === 0,
      "Nach «Später» geht das Fenster beim nächsten Laden wieder auf – oder der Hinweis oben fehlt.");
    await kontext.close();
  }
  {
    const { kontext, seite } = await mitTurnieren(`/turmbau?turnier=${DAUER}`, {
      vorher: `localStorage.setItem("mini.name", "Leo"); window.__miniLiveZeiger = { "${DAUER}": { code: "K7QM", name: "Finale" } };`,
    });
    await seite.waitForSelector(".tn-live-band", { timeout: 8000 }).catch(() => {});
    const band = await seite.evaluate(() => {
      const b = document.querySelector(".tn-live-band");
      const r = b?.getBoundingClientRect();
      return { da: Boolean(b && r.width > 0), weg: b?.getAttribute("href") || "", unten: r ? Math.round(window.innerHeight - r.bottom) : null };
    });
    pruefe(band.da && band.weg === "/live?code=K7QM" && band.unten >= 0 && band.unten < 60,
      `Im Spiel des Turniers steht der Multiplayer nicht unten: ${JSON.stringify(band)}`);
    await seite.evaluate(() => { document.querySelector(".cm-stage").dataset.phase = "play"; });
    pruefe(await seite.evaluate(() => document.querySelector(".tn-live-band").getClientRects().length === 0),
      "Während einer Runde steht das Band des Multiplayers über dem Spiel.");
    await kontext.close();
  }

  // --- 4o. Das Bild eines Spiels steht ganz da ------------------------------------
  // Oben links im Bild steht die Zahl des Spiels, knapp am Rand. Die Fläche
  // hat deshalb genau die Form des Bildes (16:9, hochkant 9:16) – auch am
  // Tablet quer, wo neben ihr die Leiste Platz braucht. Bis Oktober 2026 fiel
  // dort links und rechts je ein Zehntel weg.
  for (const [adresse, wo] of [["/", "Startseite"], [`/turnier?t=${HERBST}`, "Turnierseite"]]) {
    for (const [breit, hoch] of [[1180, 820], [1024, 768], [844, 390], [820, 1180]]) {
      const { kontext, seite } = await mitTurnieren(adresse, { viewport: { width: breit, height: hoch } });
      await seite.waitForSelector(".ar-film.ist-an", { timeout: 8000 }).catch(() => {});
      await seite.waitForFunction(() => document.querySelector(".ar-film.ist-an")?.naturalWidth > 0, null, { timeout: 8000 }).catch(() => {});
      const weg = await seite.evaluate(() => {
        const bild = document.querySelector(".ar-film.ist-an");
        const box = document.querySelector(".ar-filme").getBoundingClientRect();
        const s = Math.max(box.width / bild.naturalWidth, box.height / bild.naturalHeight);
        return Math.max(bild.naturalWidth * s - box.width, bild.naturalHeight * s - box.height) / 2 / s
          / Math.min(bild.naturalWidth, bild.naturalHeight);
      });
      pruefe(weg < 0.01, `${wo} ${breit} × ${hoch}: Vom Bild des Spiels fällt am Rand ${(weg * 100).toFixed(1)} % weg.`);
      await kontext.close();
    }
  }

  // --- 4k. Gegner beim Spielen (geist.js) -----------------------------------------
  // Platz 1 und die eigene Bestmarke: zwei Schalter über der Spielfläche, die
  // sagen, gegen wen es geht; in den Spielen mit Geist im Bild ein dritter,
  // «Alle». Zu Beginn ist alles aus – ein Tipp blendet den Gegner ein. Mit
  // Aufzeichnung läuft er mit; die eigene Runde wird zur nächsten Bestmarke.
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
    pruefe(schalter.length === 3 && schalter.every((c) => c.sichtbar), `Im Lianenschwung stehen nicht die drei Gegner-Schalter: ${JSON.stringify(schalter)}`);
    pruefe(/Alle/.test(schalter[2]?.text) && /1/.test(schalter[2]?.text), `«Alle» steht nicht mit einem Lauf da: ${schalter[2]?.text}`);
    // Zu Beginn ist alles aus: kein Schalter an, kein Geist im Bild.
    const zuBeginn = await seite.evaluate(() => window.LernappGeist.stand()[0].zeigt);
    pruefe(schalter.every((c) => !c.an) && zuBeginn.length === 0, `Zu Beginn sind Gegner eingeblendet: ${JSON.stringify({ schalter, zuBeginn })}`);
    // Ein Tipp auf Platz 1 und auf «Alle» blendet sie ein. Mia ist Platz 1
    // und steht unter «Alle» – im Bild aber nur einmal; ist Platz 1
    // abgeschaltet, läuft sie unter «Alle» mit.
    await seite.click(".gs-erster");
    await seite.click(".gs-alle");
    const imBild = await seite.evaluate(() => window.LernappGeist.stand()[0]);
    pruefe(imBild?.stand?.alle?.length === 1 && imBild.stand.alle[0].name === "Mia" && imBild.zeigt.join() === "erster:Mia",
      `Unter «Alle» steht nicht Mia, oder sie läuft doppelt mit: ${JSON.stringify({ alle: imBild?.stand?.alle, zeigt: imBild?.zeigt })}`);
    await seite.click(".gs-erster");
    const ohneErsten = await seite.evaluate(() => window.LernappGeist.stand()[0].zeigt);
    pruefe(ohneErsten.join() === "alle:Mia", `Ohne Platz 1 läuft Mia nicht unter «Alle» mit: ${JSON.stringify(ohneErsten)}`);
    await seite.click(".gs-erster");
    schalter = await gegnerSchalter(seite);
    pruefe(/Platz 1/.test(schalter[0]?.text) && /Mia/.test(schalter[0]?.text) && /30/.test(schalter[0]?.text) && schalter[0]?.an,
      `Platz 1 steht nicht als Gegner da: ${schalter[0]?.text}`);
    pruefe(schalter[1]?.leer && /noch keine/.test(schalter[1]?.text), `Ohne eigene Runde steht trotzdem eine Bestmarke da: ${schalter[1]?.text}`);
    const stand = await seite.evaluate(() => window.LernappGeist.stand()[0].stand);
    pruefe(stand?.erster?.lauf === true, `Der Lauf von Platz 1 läuft nicht mit: ${JSON.stringify(stand)}`);

    // Eingeschaltet bleibt eingeschaltet, auch nach dem Neuladen – und ein
    // Tipp auf einen Schalter startet keine Runde.
    pruefe(await seite.evaluate(() => JSON.parse(localStorage.getItem("mini.geister") || "{}").erster) === true, "Platz 1 bleibt nicht eingeschaltet.");
    pruefe(await seite.evaluate(() => window.LernappLiane.state.phase) === "bereit", "Ein Tipp auf einen Gegner-Schalter hat die Runde gestartet.");
    await seite.reload({ waitUntil: "load" });
    await seite.waitForSelector(".gs-chip", { timeout: 8000 });
    await seite.waitForTimeout(400);
    schalter = await gegnerSchalter(seite);
    pruefe(schalter[0]?.an, "Nach dem Neuladen ist Platz 1 wieder ausgeschaltet.");

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
    // Auf dem Handy quer stehen die Schalter oben in der Leiste, zwischen den
    // Knöpfen. Ein Finger darauf schaltet den Gegner ab – und startet nicht
    // das Spiel (die Leiste lag einmal unsichtbar darüber). Und das Spiel ist
    // das ganze Bild: die Leinwand bis an alle Ränder, die Meter unter den
    // Knöpfen.
    for (const [breit, hoch] of [[844, 390], [390, 844]]) {
      const { kontext, seite } = await neueSeite({ width: breit, height: hoch }, { handy: true });
      await seite.addInitScript(() => {
        localStorage.setItem("__mini_attrappe", JSON.stringify([["vineSwing_mini_miamiamiamia", {
          id: "vineSwing_mini_miamiamiamia", game: "vineSwing", spieler: "mini_miamiamiamia", name: "Mia", punkte: 30, versuche: 2, updatedAtMs: 1000,
        }]]));
      });
      await seite.goto(`${BASIS}/liane`, { waitUntil: "load" });
      await seite.waitForSelector(".gs-erster:not([hidden])", { timeout: 8000 });
      await seite.waitForTimeout(300);
      const chip = await seite.locator(".gs-erster").boundingBox();
      const vorher = await seite.evaluate(() => document.querySelector(".gs-erster").classList.contains("is-an"));
      await seite.touchscreen.tap(chip.x + chip.width / 2, chip.y + chip.height / 2);
      await seite.waitForTimeout(200);
      const nachher = await seite.evaluate(() => ({
        an: document.querySelector(".gs-erster").classList.contains("is-an"),
        phase: window.LernappLiane.state.phase,
        leinwand: (() => { const r = document.querySelector(".li-canvas, .cm-play canvas").getBoundingClientRect(); return [r.left, r.top, r.width, r.height].map(Math.round); })(),
        frei: window.LernappGameShell.frei(),
        leiste: Math.round(document.querySelector(".gs-leiste").getBoundingClientRect().bottom),
      }));
      pruefe(nachher.an !== vorher && nachher.phase === "bereit", `${breit}×${hoch}: Ein Finger auf dem Gegner-Schalter schaltet nicht, sondern startet das Spiel (${JSON.stringify(nachher)})`);
      pruefe(nachher.leinwand.join() === [0, 0, breit, hoch].join(), `${breit}×${hoch}: Die Leinwand füllt nicht das ganze Bild: ${nachher.leinwand}`);
      pruefe(nachher.frei >= nachher.leiste, `${breit}×${hoch}: Was oben unter den Knöpfen liegt, ist falsch gemessen (${nachher.frei} statt ${nachher.leiste})`);
      await kontext.close();
    }
  }
  {
    // Die Spiele ohne Uhr mit Geist im Bild (hier der Schwerkraft-Läufer):
    // Alle aus der Hall of Fame laufen mit, ob ihre Welt dieselbe war oder
    // nicht – und die eigene Runde wird mit dem Weg aufgezeichnet.
    const LEO = JSON.stringify({ v: 1, dt: 250, p: Array.from({ length: 41 }, (_, i) => i * 3),
      a: Array.from({ length: 41 }, (_, i) => i * 70), b: Array.from({ length: 41 }, () => 0), c: Array.from({ length: 41 }, () => 0) });
    const { kontext, seite } = await neueSeite({ width: 900, height: 520 });
    await seite.addInitScript((bahn) => {
      if (sessionStorage.getItem("__geister")) return;
      sessionStorage.setItem("__geister", "1");
      const eintrag = (id, name, punkte) => [`gravityRun_${id}`, { id: `gravityRun_${id}`, game: "gravityRun", spieler: id, name, punkte, versuche: 1, updatedAtMs: 1000 }];
      localStorage.setItem("__mini_attrappe", JSON.stringify([eintrag("mini_leoleoleoleo", "Leo", 120), eintrag("mini_noranoranora", "Nora", 80), eintrag("mini_timtimtimtim", "Tim", 60)]));
      const geist = (id, name, punkte) => [`gravityRun_${id}`, { game: "gravityRun", spieler: id, name, punkte, level: "t1", bahn }];
      localStorage.setItem("__mini_geister_attrappe", JSON.stringify([geist("mini_leoleoleoleo", "Leo", 120), geist("mini_noranoranora", "Nora", 80)]));
      // Alle Gegner eingeschaltet (zu Beginn ist alles aus).
      localStorage.setItem("mini.geister", JSON.stringify({ erster: true, eigen: true, alle: true }));
    }, LEO);
    await seite.goto(`${BASIS}/schwerkraft`, { waitUntil: "load" });
    await seite.waitForSelector(".gs-chip", { timeout: 8000 });
    await seite.waitForFunction(() => window.LernappGeist?.stand?.()[0]?.stand, null, { timeout: 4000 }).catch(() => {});
    const schalter = await gegnerSchalter(seite);
    const stand = await seite.evaluate(() => window.LernappGeist.stand()[0]);
    pruefe(schalter.length === 3 && stand?.art === "tempo" && stand.stand?.erster?.lauf === true
      && stand.stand.alle.map((g) => g.name).join() === "Leo,Nora" && stand.zeigt.join() === "alle:Nora,erster:Leo",
      `Im Schwerkraft-Läufer laufen nicht Platz 1 und alle mit Lauf mit: ${JSON.stringify({ schalter, stand })}`);
    // Eine Runde – sie läuft von selbst in den ersten Abgrund – wird mit dem
    // Weg aufgezeichnet.
    await seite.evaluate(() => window.LernappSchwerkraft.tippen());
    await seite.waitForSelector(".cm-result-score", { timeout: 20000 }).catch(() => {});
    const lauf = await seite.evaluate(() => {
      const eigen = window.LernappGeist.eigenerLauf("gravityRun", "t1");
      const d = eigen ? window.LernappGeist.entpacke(eigen.bahn) : null;
      return { punkte: eigen?.punkte || 0, proben: d?.p?.length || 0, mitOrt: Array.isArray(d?.a) && d.a.some((x) => x > 0) };
    });
    pruefe(lauf.punkte > 0 && lauf.proben > 2 && lauf.mitOrt, `Der Schwerkraft-Läufer zeichnet seinen Weg nicht auf: ${JSON.stringify(lauf)}`);
    await kontext.close();
  }
  {
    // Die besten Läufe anschauen: Eine Runde im Schwerkraft-Läufer wird mit
    // der Saat ihres Korridors aufgezeichnet. In der Hall of Fame steht bei
    // ihr ein ▶, und wer ihn antippt, sieht denselben Korridor und den
    // Läufer darin – bis zur Tafel am Schluss, mit «Nochmal» und «Zurück».
    const { kontext, seite } = await neueSeite({ width: 900, height: 520 });
    await seite.addInitScript(() => {
      if (sessionStorage.getItem("__zuschauen")) return;
      sessionStorage.setItem("__zuschauen", "1");
      localStorage.setItem("mini.name", "Zora");
    });
    await seite.goto(`${BASIS}/schwerkraft`, { waitUntil: "load" });
    await seite.waitForFunction(() => window.LernappSchwerkraft?.state, null, { timeout: 8000 });
    const korridor = () => window.LernappSchwerkraft.state.bahnen.map((bahn) => bahn.slice(0, 8).map((q) => `${q.art}:${Math.round(q.x0)}-${Math.round(q.x1)}`).join(" ")).join(" | ");
    await seite.evaluate(() => window.LernappSchwerkraft.tippen());
    await seite.waitForSelector(".cm-result-score", { timeout: 20000 }).catch(() => {});
    await seite.waitForFunction(() => [...(window.__miniGeister?.keys?.() || [])].some((k) => k.startsWith("gravityRun_")), null, { timeout: 4000 }).catch(() => {});
    const gespielt = await seite.evaluate((quelle) => {
      const kennung = localStorage.getItem("mini.id");
      const geist = window.__miniGeister?.get(`gravityRun_${kennung}`) || null;
      let d = null;
      try { d = JSON.parse(geist?.bahn || "null"); } catch { d = null; }
      return { kennung, saat: d?.s ?? null, mitOrt: Array.isArray(d?.a), punkte: geist?.punkte || 0, korridor: new Function(`return (${quelle})()`)() };
    }, korridor.toString());
    pruefe(gespielt.kennung && Number.isInteger(gespielt.saat) && gespielt.mitOrt && gespielt.punkte > 0,
      `Der Schwerkraft-Läufer hinterlegt seinen Lauf nicht mit Saat und Weg: ${JSON.stringify({ ...gespielt, korridor: undefined })}`);

    await seite.goto(`${BASIS}/`, { waitUntil: "load" });
    await seite.waitForSelector(".ar-kachel", { timeout: 8000 });
    // Die Rangliste öffnet der Knopf neben Play: erst das Spiel nach oben
    // holen.
    await seite.locator('.ar-kachel[data-spiel="gravityRun"]').click();
    await seite.click(".ar-rang");
    await seite.waitForSelector(".ar-fenster .gk-ansehen", { timeout: 6000 }).catch(() => {});
    const play = await seite.evaluate(() => [...document.querySelectorAll(".ar-fenster .gk-ansehen")].map((a) => a.getAttribute("href")));
    pruefe(play.some((h) => h === `/schwerkraft?zuschauen=${gespielt.kennung}`), `In der Hall of Fame steht beim Schwerkraft-Läufer kein ▶ für den Lauf: ${JSON.stringify(play)}`);

    await seite.goto(`${BASIS}/schwerkraft?zuschauen=${gespielt.kennung}`, { waitUntil: "load" });
    await seite.waitForFunction(() => window.LernappSchwerkraft?.state?.phase === "zuschauen", null, { timeout: 8000 }).catch(() => {});
    const zu = await seite.evaluate((quelle) => ({
      phase: window.LernappSchwerkraft.state.phase,
      leiste: document.querySelector(".gz-leiste")?.textContent || "",
      gegner: document.querySelectorAll(".gs-chip").length,
      korridor: new Function(`return (${quelle})()`)(),
    }), korridor.toString());
    pruefe(zu.phase === "zuschauen" && /Zora/.test(zu.leiste) && zu.gegner === 0,
      `Das Zuschauen beginnt nicht, oder es stehen Gegner-Schalter da: ${JSON.stringify({ ...zu, korridor: undefined })}`);
    pruefe(zu.korridor === gespielt.korridor, `Beim Zuschauen entsteht ein anderer Korridor:\n  gespielt ${gespielt.korridor}\n  angeschaut ${zu.korridor}`);
    const x0 = await seite.evaluate(() => window.LernappSchwerkraft.state.l.x);
    await seite.waitForTimeout(700);
    const x1 = await seite.evaluate(() => window.LernappSchwerkraft.state.l.x);
    pruefe(x1 > x0, `Beim Zuschauen läuft der Läufer nicht (${x0} → ${x1}).`);
    await seite.evaluate(() => window.LernappSchwerkraft.tippen());
    pruefe(await seite.evaluate(() => window.LernappSchwerkraft.state.phase) === "zuschauen", "Ein Tipp beim Zuschauen greift ins Spiel ein.");
    await seite.waitForSelector(".gz-tafel:not([hidden]) .gz-nochmal", { timeout: 25000 }).catch(() => {});
    pruefe(await seite.locator(".gz-tafel:not([hidden]) .gz-nochmal").count() === 1 && await seite.locator(".gz-tafel:not([hidden]) .gz-zurueck").count() === 1,
      "Am Ende des Laufs steht keine Tafel mit «Nochmal» und «Zurück».");
    await seite.click(".gz-zu");
    await seite.waitForURL((url) => new URL(url).pathname === "/", { timeout: 6000 }).catch(() => {});
    pruefe(new URL(seite.url()).pathname === "/", `«Beenden» führt nicht zurück in die Hall of Fame: ${seite.url()}`);
    await kontext.close();
  }
  // Die Spiele mit Uhr und Figur (Lianenschwung, Hügelflieger): Beim
  // Zuschauen läuft die Uhr mit, so weit wie die Runde des anderen – der
  // Balken oben wird kürzer.
  for (const [adresse, objekt, spiel] of [["liane", "LernappLiane", "vineSwing"], ["huegel", "LernappHuegel", "hillGlide"]]) {
    const { kontext, seite } = await neueSeite({ width: 900, height: 520 });
    await seite.addInitScript(() => {
      if (sessionStorage.getItem("__uhr")) return;
      sessionStorage.setItem("__uhr", "1");
      localStorage.setItem("mini.name", "Zora");
    });
    await seite.goto(`${BASIS}/${adresse}`, { waitUntil: "load" });
    await seite.waitForFunction((o) => window[o]?.state, objekt, { timeout: 8000 });
    // Eine kurze Runde: drücken, loslassen – der Affe fällt bald ins Wasser,
    // im Hügelflieger ist danach die Zeit um.
    await seite.evaluate((o) => window[o].druecken(), objekt);
    await seite.waitForTimeout(1500);
    await seite.evaluate((o) => window[o].loslassen(), objekt);
    await seite.waitForTimeout(1500);
    if (objekt === "LernappHuegel") await seite.evaluate(() => window.LernappHuegel.zeitUm());
    await seite.waitForSelector(".cm-result-score", { timeout: 15000 }).catch(() => {});
    await seite.waitForFunction((s) => [...(window.__miniGeister?.keys?.() || [])].some((k) => k.startsWith(`${s}_`)), spiel, { timeout: 4000 }).catch(() => {});
    const kennung = await seite.evaluate(() => localStorage.getItem("mini.id"));
    await seite.goto(`${BASIS}/${adresse}?zuschauen=${kennung}`, { waitUntil: "load" });
    await seite.waitForFunction((o) => window[o]?.state?.phase === "zuschauen", objekt, { timeout: 8000 }).catch(() => {});
    const balken = () => seite.evaluate(() => new DOMMatrix(getComputedStyle(document.querySelector(".cm-time-fill")).transform).a);
    const vorher = await balken();
    await seite.waitForTimeout(1200);
    const nachher = await balken();
    pruefe(await seite.evaluate((o) => window[o].state.phase, objekt) === "zuschauen" && nachher < vorher - 0.01 && nachher > 0,
      `${adresse}: Beim Zuschauen zählt die Zeit nicht herunter (Balken ${vorher} → ${nachher}).`);
    await kontext.close();
  }
  {
    // Die Spiele ohne Figur im Bild lassen sich Zug um Zug anschauen (hier
    // der Turmbau): Die Runde wird mit ihren Zügen und der Saat hinterlegt.
    // In der Hall of Fame steht der ▶ bei jedem, dessen Lauf es gibt – auch
    // hinter Platz 3 –, und wer ihn antippt, sieht denselben Turm entstehen:
    // dieselben Blöcke, gleich breit, bis zur Tafel am Schluss.
    const { kontext, seite } = await neueSeite({ width: 900, height: 520 });
    await seite.addInitScript(() => {
      if (sessionStorage.getItem("__zuege")) return;
      sessionStorage.setItem("__zuege", "1");
      localStorage.setItem("mini.name", "Zora");
      const eintrag = (id, name, punkte) => [`towerStack_${id}`, { id: `towerStack_${id}`, game: "towerStack", spieler: id, name, punkte, versuche: 1, updatedAtMs: 1000 }];
      localStorage.setItem("__mini_attrappe", JSON.stringify([
        eintrag("mini_leoleoleoleo", "Leo", 90), eintrag("mini_noranoranora", "Nora", 80),
        eintrag("mini_timtimtimtim", "Tim", 70), eintrag("mini_idaidaidaida", "Ida", 60),
      ]));
      // Ida, auf Platz 4, hat einen Lauf hinterlegt.
      const bahn = JSON.stringify({ v: 3, s: 7, e: 900, z: { t: [0, 400], c: [0, 1], p: [0, 0] } });
      localStorage.setItem("__mini_geister_attrappe", JSON.stringify([[`towerStack_mini_idaidaidaida`,
        { game: "towerStack", spieler: "mini_idaidaidaida", name: "Ida", punkte: 60, level: "z1", bahn }]]));
    });
    await seite.goto(`${BASIS}/turmbau`, { waitUntil: "load" });
    await seite.waitForFunction(() => window.LernappTurmbau?.state, null, { timeout: 8000 });
    const turm = () => ({
      punkte: window.LernappTurmbau.state.punkte,
      bloecke: window.LernappTurmbau.state.bloecke.filter((b) => !b.sockel).map((b) => [b.x, b.w]),
    });
    // Derselbe Turm: gleich viele Blöcke, jeder an derselben Stelle und gleich
    // breit – bis auf das, was das Hundertstel der Züge rundet.
    const gleicherTurm = (a, b) => a.punkte === b.punkte && a.bloecke.length === b.bloecke.length
      && a.bloecke.every(([x, w], i) => Math.abs(x - b.bloecke[i][0]) <= 1 && Math.abs(w - b.bloecke[i][1]) <= 1);
    pruefe(await spieleTurmbauZuEnde(seite), "Der Turmbau kam zu keinem Ende.");
    await seite.waitForFunction(() => [...(window.__miniGeister?.keys?.() || [])].some((k) => k.startsWith("towerStack_mini_") && !k.endsWith("idaidaidaida")), null, { timeout: 4000 }).catch(() => {});
    const gespielt = await seite.evaluate((quelle) => {
      const kennung = localStorage.getItem("mini.id");
      const geist = window.__miniGeister?.get(`towerStack_${kennung}`) || null;
      let d = null;
      try { d = JSON.parse(geist?.bahn || "null"); } catch { d = null; }
      return { kennung, level: geist?.level, saat: d?.s ?? null, zuege: d?.z?.t?.length || 0, ende: d?.e || 0, punkte: geist?.punkte || 0, turm: new Function(`return (${quelle})()`)() };
    }, turm.toString());
    pruefe(gespielt.kennung && gespielt.level === "z1" && Number.isInteger(gespielt.saat) && gespielt.zuege >= 3 && gespielt.ende > 0 && gespielt.punkte === gespielt.turm.punkte,
      `Der Turmbau hinterlegt seine Runde nicht mit Zügen und Saat: ${JSON.stringify({ ...gespielt, turm: undefined })}`);

    await seite.goto(`${BASIS}/`, { waitUntil: "load" });
    await seite.waitForSelector(".ar-kachel", { timeout: 8000 });
    // Oben steht der Turmbau (der erste Favorit). Seine Rangliste im Fenster:
    // der ▶ bei Ida auf Platz 4 und beim eigenen Lauf auf Platz 5.
    await seite.waitForFunction(() => !/…/.test(document.querySelector(".ar-rang")?.textContent || "…"), null, { timeout: 6000 }).catch(() => {});
    await seite.click(".ar-rang");
    const tafel = seite.locator(".ar-fenster");
    await tafel.locator('.gk-ansehen[href="/turmbau?zuschauen=mini_idaidaidaida"]').waitFor({ timeout: 6000 }).catch(() => {});
    const zu = await tafel.locator(".gk-ansehen").evaluateAll((liste) => liste.map((a) => a.getAttribute("href")));
    pruefe(zu.includes(`/turmbau?zuschauen=${gespielt.kennung}`) && zu.includes("/turmbau?zuschauen=mini_idaidaidaida") && zu.length === 2,
      `Beim Turmbau steht der ▶ nicht bei Ida (Platz 4) und beim eigenen Lauf (Platz 5), oder bei jemandem ohne Lauf: ${JSON.stringify(zu)}`);

    await seite.goto(`${BASIS}/turmbau?zuschauen=${gespielt.kennung}`, { waitUntil: "load" });
    await seite.waitForFunction(() => window.LernappTurmbau?.state?.phase === "zuschauen", null, { timeout: 8000 }).catch(() => {});
    const anfang = await seite.evaluate(() => ({
      phase: window.LernappTurmbau.state.phase,
      leiste: document.querySelector(".gz-leiste")?.textContent || "",
      gegner: document.querySelectorAll(".gs-chip").length,
    }));
    pruefe(anfang.phase === "zuschauen" && /Zora/.test(anfang.leiste) && /Blöcke/.test(anfang.leiste) && anfang.gegner === 0,
      `Das Anschauen des Turms beginnt nicht, oder es stehen Gegner-Schalter da: ${JSON.stringify(anfang)}`);
    // Ein Tipp gehört beim Anschauen nicht dem Spiel.
    await seite.mouse.click(450, 390);
    pruefe(await seite.evaluate(() => window.LernappTurmbau.state.phase) === "zuschauen", "Ein Tipp beim Anschauen des Turms greift ins Spiel ein.");
    await seite.waitForSelector(".gz-tafel:not([hidden]) .gz-nochmal", { timeout: 60000 }).catch(() => {});
    const angeschautTurm = await seite.evaluate((quelle) => new Function(`return (${quelle})()`)(), turm.toString());
    pruefe(await seite.locator(".gz-tafel:not([hidden]) .gz-nochmal").count() === 1, "Am Ende des Turms steht keine Tafel mit «Nochmal».");
    pruefe(gleicherTurm(angeschautTurm, gespielt.turm),
      `Beim Anschauen entsteht ein anderer Turm:\n  gespielt ${JSON.stringify(gespielt.turm)}\n  angeschaut ${JSON.stringify(angeschautTurm)}`);
    await seite.click(".gz-nochmal");
    await seite.waitForTimeout(300);
    const nochmal = await seite.evaluate(() => ({ phase: window.LernappTurmbau.state.phase, punkte: window.LernappTurmbau.state.punkte, tafel: !document.querySelector(".gz-tafel").hidden }));
    pruefe(nochmal.phase === "zuschauen" && nochmal.punkte < gespielt.turm.punkte && !nochmal.tafel,
      `«Nochmal» spielt den Turm nicht von vorn ab: ${JSON.stringify(nochmal)}`);
    await kontext.close();
  }
  {
    // Der Heizer: Aufgezeichnet ist nur, wann auf welchen Kessel nachgelegt
    // wurde – die Zeiger rechnet die Wiedergabe selbst. Am Schluss stehen sie
    // wie in der Runde, und aus ist derselbe Kessel.
    const { kontext, seite } = await neueSeite({ width: 900, height: 520 });
    await seite.addInitScript(() => {
      if (sessionStorage.getItem("__heizer")) return;
      sessionStorage.setItem("__heizer", "1");
      localStorage.setItem("mini.name", "Hugo");
    });
    await seite.goto(`${BASIS}/heizer`, { waitUntil: "load" });
    await seite.waitForSelector(".cm-start", { timeout: 8000 });
    await seite.click(".cm-start");
    await seite.waitForTimeout(600);
    await seite.keyboard.press("2");
    await seite.waitForTimeout(1500);
    await seite.keyboard.press("1");
    await seite.waitForSelector(".cm-result-score", { timeout: 20000 }).catch(() => {});
    await seite.waitForFunction(() => [...(window.__miniGeister?.keys?.() || [])].some((k) => k.startsWith("boilerRoom_")), null, { timeout: 4000 }).catch(() => {});
    const kessel = () => ({
      werte: window.LernappHeizer.state.kessel.map((k) => Math.round(k.wert)),
      aus: [...document.querySelectorAll(".hz-reihe > *")].map((k, i) => (k.matches(".ist-aus, .ist-geplatzt, :has(.ist-aus), :has(.ist-geplatzt)") ? i : -1)).filter((i) => i >= 0),
    });
    const schicht = await seite.evaluate((quelle) => {
      const kennung = localStorage.getItem("mini.id");
      const geist = window.__miniGeister?.get(`boilerRoom_${kennung}`) || null;
      return { kennung, geist: Boolean(geist?.bahn), punkte: geist?.punkte || 0, kessel: new Function(`return (${quelle})()`)() };
    }, kessel.toString());
    pruefe(schicht.geist && schicht.punkte > 0, `Der Heizer hinterlegt seine Schicht nicht: ${JSON.stringify(schicht)}`);
    await seite.goto(`${BASIS}/heizer?zuschauen=${schicht.kennung}`, { waitUntil: "load" });
    await seite.waitForSelector(".gz-tafel:not([hidden]) .gz-nochmal", { timeout: 30000 }).catch(() => {});
    const nachgebaut = await seite.evaluate((quelle) => ({ phase: window.LernappHeizer.state.phase, ...new Function(`return (${quelle})()`)() }), kessel.toString());
    const nah = nachgebaut.werte.length === schicht.kessel.werte.length && nachgebaut.werte.every((w, i) => Math.abs(w - schicht.kessel.werte[i]) <= 3);
    pruefe(nachgebaut.phase === "zuschauen-aus" && nah && nachgebaut.aus.join() === schicht.kessel.aus.join(),
      `Beim Anschauen stehen die Kessel anders als in der Schicht:\n  gespielt ${JSON.stringify(schicht.kessel)}\n  angeschaut ${JSON.stringify(nachgebaut)}`);
    await kontext.close();
  }
  {
    // Blätter im Strom: Die Wellen kommen beim Anschauen aus derselben Saat in
    // derselben Reihe, und gewischt wird zur selben Zeit in dieselbe Richtung.
    // Der Lauf mit Uhr für die Gegner bleibt, wie er war (p).
    const { kontext, seite } = await neueSeite({ width: 900, height: 520 });
    await seite.addInitScript(() => {
      // Welche Wellen kamen, in welcher Reihe – auf jeder Seite.
      window.__wellen = [];
      document.addEventListener("DOMContentLoaded", () => new MutationObserver(() => {
        const w = window.LernappBlaetter?.state?.welle;
        if (w && window.__wellen[w.nr] === undefined) window.__wellen[w.nr] = `${w.sorte}:${w.antwort}`;
      }).observe(document.body, { subtree: true, childList: true, attributes: true }));
      if (sessionStorage.getItem("__blaetter")) return;
      sessionStorage.setItem("__blaetter", "1");
      localStorage.setItem("mini.name", "Bea");
    });
    await seite.goto(`${BASIS}/blaetter`, { waitUntil: "load" });
    await seite.waitForSelector(".cm-start", { timeout: 8000 });
    await seite.click(".cm-start");
    for (const taste of ["ArrowUp", "ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp", "ArrowRight"]) {
      await seite.waitForTimeout(250);
      await seite.keyboard.press(taste);
    }
    await seite.waitForTimeout(300);
    const runde = await seite.evaluate(() => {
      const s = window.LernappBlaetter.state;
      const stand = { richtig: s.richtig, falsch: s.falsch, wellen: window.__wellen.join(" ") };
      window.LernappBlaetter.zeitUm();
      return stand;
    });
    await seite.waitForFunction(() => [...(window.__miniGeister?.keys?.() || [])].some((k) => k.startsWith("leafFlow_")), null, { timeout: 4000 }).catch(() => {});
    const blatt = await seite.evaluate(() => {
      const kennung = localStorage.getItem("mini.id");
      const geist = window.__miniGeister?.get(`leafFlow_${kennung}`) || null;
      let d = null;
      try { d = JSON.parse(geist?.bahn || "null"); } catch { d = null; }
      return { kennung, v: d?.v, p: Array.isArray(d?.p), zuege: d?.z?.t?.length || 0, saat: d?.s ?? null };
    });
    pruefe(runde.richtig + runde.falsch === 6 && (runde.richtig === 0 || (blatt.v === 2 && blatt.p && blatt.zuege === 6 && Number.isInteger(blatt.saat))),
      `Blätter im Strom hinterlegt die Wische nicht mit dem Lauf für die Gegner: ${JSON.stringify({ runde, blatt })}`);
    if (runde.richtig > 0) {
      await seite.goto(`${BASIS}/blaetter?zuschauen=${blatt.kennung}`, { waitUntil: "load" });
      await seite.waitForSelector(".gz-tafel:not([hidden]) .gz-nochmal", { timeout: 15000 }).catch(() => {});
      const angeschaut = await seite.evaluate(() => {
        const s = window.LernappBlaetter.state;
        return { richtig: s.richtig, falsch: s.falsch, wellen: window.__wellen.join(" ") };
      });
      pruefe(angeschaut.richtig === runde.richtig && angeschaut.falsch === runde.falsch && angeschaut.wellen === runde.wellen,
        `Beim Anschauen kommen andere Wellen oder andere Wische:\n  gespielt ${JSON.stringify(runde)}\n  angeschaut ${JSON.stringify(angeschaut)}`);
    }
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
  {
    // Die Replays im Turnier: Der ▶ steht bei jedem, der dort einen Lauf hat.
    // Ein Turnier ohne Replays zeigt keinen – und lässt auch über die Adresse
    // keinen Lauf anschauen.
    const OHNE_REPLAY = "ohnereplay-test234";
    const daten = {
      turniere: [...TURNIERE.turniere, turnierVorlage(OHNE_REPLAY, { name: "Geheimcup", sichtbar: "link", startMs: JETZT - 5 * MINUTE, spiele: ["towerStack"], versuche: 0, ohneReplay: true })],
      eintraege: [...TURNIERE.eintraege, { turnier: OHNE_REPLAY, game: "towerStack", spieler: "mini_leoleoleoleo", name: "Leo", punkte: 25, versuche: 1, offen: false, updatedAtMs: 1100 }],
    };
    const bahn = JSON.stringify({ v: 3, s: 7, e: 900, z: { t: [0, 400], c: [0, 1], p: [0, 0] } });
    const { kontext, seite } = await neueSeite({ width: 900, height: 760 });
    await seite.addInitScript(([d, b, herbst, ohne]) => {
      window.__miniTurniereAnfang = d;
      if (sessionStorage.getItem("__tnReplay")) return;
      sessionStorage.setItem("__tnReplay", "1");
      const geist = (t, id, name, punkte) => [`${t}/towerStack_${id}`, { game: "towerStack", spieler: id, name, punkte, level: "z1", bahn: b }];
      localStorage.setItem("__mini_geister_attrappe", JSON.stringify([
        geist(herbst, "mini_leoleoleoleo", "Leo", 25), geist(herbst, "mini_miamiamiamia", "Mia", 20), geist(ohne, "mini_leoleoleoleo", "Leo", 25),
      ]));
    }, [daten, bahn, HERBST, OHNE_REPLAY]);
    // Der ▶ steht in der Rangliste des Turmbaus – im Fenster hinter dem
    // Knopf mit der Krone.
    const playIn = async (id) => {
      await seite.goto(`${BASIS}/turnier?t=${id}`, { waitUntil: "load" });
      await seite.waitForSelector('.ar-kachel[data-spiel="towerStack"]', { timeout: 8000 }).catch(() => {});
      await seite.click('.ar-kachel[data-spiel="towerStack"]').catch(() => {});
      await seite.click(".ar-rang").catch(() => {});
      const fenster = seite.locator("dialog.ist-rangliste");
      await fenster.locator(".gk-liste").waitFor({ timeout: 8000 }).catch(() => {});
      await fenster.locator(".gk-ansehen").first().waitFor({ timeout: 2500 }).catch(() => {});
      await seite.waitForTimeout(300);
      return fenster.locator(".gk-ansehen").evaluateAll((liste) => liste.map((a) => a.getAttribute("href")));
    };
    const herbst = await playIn(HERBST);
    pruefe(herbst.length === 2 && herbst.includes(`/turmbau?zuschauen=mini_leoleoleoleo&aus=${HERBST}`) && herbst.includes(`/turmbau?zuschauen=mini_miamiamiamia&aus=${HERBST}`),
      `Im Turnier steht der ▶ nicht bei Platz 2 und 3, die einen Lauf haben: ${JSON.stringify(herbst)}`);
    const ohne = await playIn(OHNE_REPLAY);
    pruefe(ohne.length === 0, `Im Turnier ohne Replays steht trotzdem ein ▶: ${JSON.stringify(ohne)}`);
    await seite.goto(`${BASIS}/turmbau?zuschauen=mini_leoleoleoleo&aus=${OHNE_REPLAY}`, { waitUntil: "load" });
    await seite.waitForSelector(".gz-tafel:not([hidden])", { timeout: 6000 }).catch(() => {});
    const gesperrt = await seite.evaluate(() => ({
      tafel: document.querySelector(".gz-tafel:not([hidden])")?.textContent || "",
      phase: window.LernappTurmbau?.state?.phase,
    }));
    pruefe(/nicht anschauen/.test(gesperrt.tafel) && gesperrt.phase !== "zuschauen",
      `Ein Lauf aus dem Turnier ohne Replays lässt sich über die Adresse trotzdem anschauen: ${JSON.stringify(gesperrt)}`);
    await seite.goto(`${BASIS}/turmbau?zuschauen=mini_miamiamiamia&aus=${HERBST}`, { waitUntil: "load" });
    await seite.waitForFunction(() => window.LernappTurmbau?.state?.phase === "zuschauen", null, { timeout: 6000 }).catch(() => {});
    pruefe(await seite.evaluate(() => window.LernappTurmbau?.state?.phase) === "zuschauen", "Ein Lauf aus dem Herbstcup lässt sich nicht anschauen.");
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
      pruefe(manifest.short_name === "arcade", `Auf dem Startbildschirm stünde "${manifest.short_name}".`);
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

  // --- 7. Läufe nachreichen ----------------------------------------------------
  // Zu jeder Bestmarke ihr Lauf, auch wenn die Seite weg war, bevor er oben
  // war (mini-games.js, nachreichen). Ninja: Die Runde im Turnier kam an, der
  // Lauf nicht, und der Adminbereich hat den Eintrag inzwischen unter eine
  // andere Kennung zusammengeführt – der Lauf wartet auf dem Gerät
  // (mini.ausstehend). Lielle: Oben liegt nur ein älterer, schwächerer Lauf;
  // der zur Bestmarke liegt bei den besten Läufen des Geräts (mini.lauf).
  // Mia: Ihr Lauf auf dem Gerät ist überholt – er geht nicht hinauf.
  {
    const BAHN = JSON.stringify({ v: 2, dt: 100, p: [0, 300, 900], a: [0, 40, 80], b: [0, 2, 4], s: 4242 });
    const eintraege = [
      ["hillGlide_mini_ninjastamm001", { id: "hillGlide_mini_ninjastamm001", game: "hillGlide", spieler: "mini_ninjastamm001", name: "Ninja", punkte: 1555, versuche: 1, updatedAtMs: 1000 }],
      ["hillGlide_mini_lielle0000001", { id: "hillGlide_mini_lielle0000001", game: "hillGlide", spieler: "mini_lielle0000001", name: "Lielle", punkte: 2393, versuche: 8, updatedAtMs: 1000 }],
      ["hillGlide_mini_mia000000001", { id: "hillGlide_mini_mia000000001", game: "hillGlide", spieler: "mini_mia000000001", name: "Mia", punkte: 3000, versuche: 3, updatedAtMs: 1000 }],
    ];
    const geister = [
      ["hillGlide_mini_lielle0000001", { game: "hillGlide", spieler: "mini_lielle0000001", name: "Lielle", punkte: 2305, level: "t1", bahn: BAHN }],
    ];
    const geraet = (name, id, extra) => `
      if (!localStorage.getItem("__mini_attrappe")) {
        localStorage.setItem("__mini_attrappe", ${JSON.stringify(JSON.stringify(eintraege))});
        localStorage.setItem("__mini_geister_attrappe", ${JSON.stringify(JSON.stringify(geister))});
        localStorage.setItem("mini.name", ${JSON.stringify(name)});
        localStorage.setItem("mini.id", ${JSON.stringify(id)});
        ${extra}
      }`;
    const faelle = [
      ["Ninja", "mini_ninjageraet01", `localStorage.setItem("mini.ausstehend", ${JSON.stringify(JSON.stringify([{ spiel: "hillGlide", spieler: "mini_ninjageraet01", name: "Ninja", punkte: 1555, level: "t1", bahn: BAHN }]))});`],
      ["Lielle", "mini_lielle0000001", `localStorage.setItem("mini.lauf", ${JSON.stringify(JSON.stringify({ hillGlide: { punkte: 2393, bahn: BAHN, level: "t1", ms: 5 } }))});`],
      ["Mia", "mini_mia000000001", `localStorage.setItem("mini.lauf", ${JSON.stringify(JSON.stringify({ hillGlide: { punkte: 2100, bahn: BAHN, level: "t1", ms: 5 } }))});`],
    ];
    for (const [name, id, extra] of faelle) {
      const { kontext, seite } = await neueSeite({ width: 1280, height: 720 });
      await seite.addInitScript(geraet(name, id, extra));
      await seite.goto(`${BASIS}/`, { waitUntil: "load" });
      await seite.waitForFunction((n) => {
        const g = [...window.__miniGeister.values()].find((x) => x.name === n);
        return n === "Mia" ? true : g && g.punkte !== 2305;
      }, name, { timeout: 8000 }).catch(() => {});
      if (name === "Mia") await seite.waitForTimeout(4000);
      const stand = await seite.evaluate((n) => ({
        geister: [...window.__miniGeister.entries()].filter(([, g]) => g.name === n).map(([k, g]) => `${k}:${g.punkte}`),
        ausstehend: localStorage.getItem("mini.ausstehend"),
        nachgesehen: JSON.parse(localStorage.getItem("mini.lauf.nachgesehen") || "{}"),
      }), name);
      if (name === "Ninja") {
        pruefe(stand.geister.join() === "hillGlide_mini_ninjastamm001:1555",
          `Ninjas Lauf kam nicht zu seinem (zusammengeführten) Eintrag: ${stand.geister.join() || "keiner"}`);
        pruefe(!stand.ausstehend, `Nach dem Nachreichen wartet noch: ${stand.ausstehend}`);
      } else if (name === "Lielle") {
        pruefe(stand.geister.join() === "hillGlide_mini_lielle0000001:2393", `Lielles Lauf zur Bestmarke kam nicht hinauf: ${stand.geister.join()}`);
        pruefe(stand.nachgesehen["hillGlide|lielle"] === 2393, `Der nachgereichte Lauf ist nicht vermerkt: ${JSON.stringify(stand.nachgesehen)}`);
      } else {
        pruefe(stand.geister.length === 0, `Ein überholter Lauf ging trotzdem hinauf: ${stand.geister.join()}`);
        pruefe(stand.nachgesehen["hillGlide|mia"] === 2100, `Der überholte Lauf ist nicht als erledigt vermerkt: ${JSON.stringify(stand.nachgesehen)}`);
      }
      await kontext.close();
    }

    // Und gleich nach der Runde: Der Lauf steht auf dem Gerät, bevor etwas
    // ans Netz geht, und ist wieder weg, sobald er oben ist.
    const { kontext, seite } = await neueSeite({ width: 1280, height: 720 });
    await seite.addInitScript(`if (!localStorage.getItem("mini.name")) localStorage.setItem("mini.name", "Jonas");`);
    await seite.goto(`${BASIS}/huegel`, { waitUntil: "load" });
    await seite.waitForFunction(() => window.LernappMini?.melde, null, { timeout: 6000 }).catch(() => {});
    const runde = await seite.evaluate(async (bahn) => {
      window.__miniLangsam = true;
      const zuvor = [];
      const echt = window.MiniCloud.speichereGeist;
      window.MiniCloud.speichereGeist = async (lauf) => { zuvor.push(localStorage.getItem("mini.ausstehend")); return echt(lauf); };
      const stand = await window.LernappMini.melde("hillGlide", 900, { level: "t1", bahn });
      window.MiniCloud.speichereGeist = echt;
      return { rekord: stand?.rekord, vorher: zuvor[0] || "", nachher: localStorage.getItem("mini.ausstehend"), geist: window.__miniGeister.get(`hillGlide_${localStorage.getItem("mini.id")}`)?.punkte };
    }, BAHN);
    pruefe(/"punkte":900/.test(runde.vorher), `Der Lauf stand nicht auf dem Gerät, bevor er hinaufging: ${runde.vorher || "nichts"}`);
    pruefe(runde.geist === 900 && !runde.nachher, `Nach der Runde: Lauf oben ${runde.geist}, auf dem Gerät noch ${runde.nachher}`);
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
