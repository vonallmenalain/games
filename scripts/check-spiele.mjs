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
const UNSER = /^(cm|mini|tn|gk|ar|kk|ft|bs|tb|br|dr|li|tf|dt|ph|ml|sl|hf|bl|sk|fr|wr|kh|st|zg|hz|gs|jg|ts|fs|hl|fm|nj|fd|sw|wl|sh|ek|ff|hw|ef|gl|zr|am|fe|fk|zf|kw|fh|kn|es|scene|sound|confetti)(-|$)/;
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

  // Die Presets des Adminbereichs (cloud.js, miniPresets): in der Datenbank,
  // also hier im Speicher der Attrappe – auf jedem «Gerät» dieselben. Was ein
  // anderes Gerät gespeichert hat, legt die Pruefung in window.__miniPresets.
  const PLAGER = "__mini_presets_attrappe";
  let pGemerkt = null;
  try { pGemerkt = JSON.parse(localStorage.getItem(PLAGER) || "null"); } catch { pGemerkt = null; }
  const presetLager = new Map(Array.isArray(pGemerkt) ? pGemerkt : (window.__miniPresetsAnfang || []).map((p) => [p.name, p]));
  const pSichern = () => { try { localStorage.setItem(PLAGER, JSON.stringify([...presetLager])); } catch {} };
  window.__miniPresets = presetLager;

  const ULAGER = "__mini_umzuege_attrappe";
  let uGemerkt = null;
  try { uGemerkt = JSON.parse(localStorage.getItem(ULAGER) || "null"); } catch { uGemerkt = null; }
  const umzuege = new Map(Array.isArray(uGemerkt) ? uGemerkt : (window.__miniUmzuegeAnfang || []));
  const uSichern = () => { try { localStorage.setItem(ULAGER, JSON.stringify([...umzuege])); } catch {} };
  window.__miniUmzuege = umzuege;

  // Die Geister: die ewigen unter "<spiel>_<spieler>", die der Turniere unter
  // "<turnier>/<spiel>_<spieler>". Wie in den Regeln ersetzt ein schwächerer
  // Lauf keinen besseren, und im Turnier hinterlegt nur, wer dort spielt.
  const GLAGER = "__mini_geister_attrappe";
  let gGemerkt = null;
  try { gGemerkt = JSON.parse(localStorage.getItem(GLAGER) || "null"); } catch { gGemerkt = null; }
  const geisterLager = new Map(Array.isArray(gGemerkt) ? gGemerkt : (window.__miniGeisterAnfang || []));
  const gSichern = () => { try { localStorage.setItem(GLAGER, JSON.stringify([...geisterLager])); } catch {} };
  window.__miniGeister = geisterLager;

  // Das Rundenprotokoll (miniRunden): wie in cloud.js je gezaehlter Runde ein
  // Eintrag unter "<spiel>_<spieler>_<nr>", mit Uhrzeit und Dauer. Eigene
  // Runden legt die Pruefung in window.__miniRundenAnfang hin.
  const RLAGER = "__mini_runden_attrappe";
  let rGemerkt = null;
  try { rGemerkt = JSON.parse(localStorage.getItem(RLAGER) || "null"); } catch { rGemerkt = null; }
  const rundenLager = new Map(Array.isArray(rGemerkt) ? rGemerkt
    : (window.__miniRundenAnfang || []).map((r) => [r.game + "_" + r.spieler + "_" + r.nr, { ...r, id: r.game + "_" + r.spieler + "_" + r.nr }]));
  const rSichern = () => { try { localStorage.setItem(RLAGER, JSON.stringify([...rundenLager])); } catch {} };
  window.__miniRunden = rundenLager;
  const woher = () => {
    const p = new URLSearchParams(location.search);
    return p.has("live") ? "live" : p.has("turnier") ? "turnier" : "";
  };
  const protokolliere = (game, spieler, name, nr, punkte, ms) => {
    const id = game + "_" + spieler + "_" + nr;
    if (rundenLager.has(id)) return;
    const quelle = woher();
    rundenLager.set(id, { id, game, spieler, name, nr, punkte, ms, zeitMs: Date.now(), ...(quelle ? { quelle } : {}) });
    rSichern();
  };

  window.MiniCloud = {
    offeneSpiele: async () => {
      // Wie cloud.js: Nicht lesen koennen wirft, "nichts eingetragen" gibt
      // null zurueck. Nur so laesst sich beides auseinanderhalten.
      if (window.__miniOhneNetz) throw fehler("kein Netz", "unavailable");
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
      // Wie cloud.js ohne Netz: Es wirft, statt eine leere Liste zu geben.
      if (!navigator.onLine) throw fehler("offline", "unavailable");
      const gefragt = Array.isArray(spiele) ? spiele : [];
      window.__miniGefragt = gefragt;
      return [...eintraege.values()].filter((e) => gefragt.includes(e.game)).map((e) => ({ ...e }));
    },
    // Wie cloud.js: umbenannt wird in ALLEN Spielen, unter der Kennung und
    // unter dem alten Namen, dazu in den genannten Turnieren - nur der Name,
    // die Uhr bleibt stehen. Womit die Attrappe aufgerufen wurde, bleibt
    // stehen, damit die Pruefung es ansehen kann. Ohne Netz wirft sie.
    benenneUm: async (was) => {
      if (window.__miniOhneNetz) throw fehler("kein Netz", "unavailable");
      window.__miniUmbenannt = was;
      const { spieler, name, alt = "", turniere = [] } = was;
      const gemeint = (e) => e.name !== name && (e.spieler === spieler || (alt && e.name === alt));
      const meine = [...eintraege.values()].filter(gemeint);
      meine.forEach((e) => eintraege.set(e.id, { ...e, name }));
      sichern();
      let inTurnieren = 0;
      for (const [k, e] of tEintraege) {
        if (!turniere.some((t) => k.startsWith(t + "/")) || !gemeint(e)) continue;
        tEintraege.set(k, { ...e, name });
        inTurnieren += 1;
      }
      tSichern();
      return { spiele: meine.length, geaendert: meine.length, turniere: inTurnieren };
    },
    vonKennung: async (spieler) => {
      if (window.__miniOhneNetz) throw fehler("kein Netz", "unavailable");
      return [...eintraege.values()].filter((e) => e.spieler === spieler).map((e) => ({ ...e }));
    },
    // Die Umzuege (miniUmzuege): wohin eine zusammengefuehrte Kennung zog.
    umzug: async (kennung) => {
      if (window.__miniOhneNetz) throw fehler("kein Netz", "unavailable");
      const u = umzuege.get(kennung);
      return u && u.nach !== kennung ? { ...u } : null;
    },
    setzeUmzuege: async (von, { nach, name }) => {
      if (window.__miniOhneUmzuege) throw fehler("Missing or insufficient permissions.", "permission-denied");
      const ks = [...new Set(von)].filter((k) => k && k !== nach);
      ks.forEach((k) => umzuege.set(k, { nach, name }));
      umzuege.delete(nach);
      uSichern();
      return ks.length;
    },
    meinErgebnis: async (game, spieler) => {
      if (window.__miniOhneNetz || !navigator.onLine) throw fehler("kein Netz", "unavailable");
      const e = eintraege.get(game + "_" + spieler);
      return e ? { ...e } : null;
    },
    // Wie cloud.js: genau dieser Name, aus allen Spielen.
    unterNamen: async (name) => {
      if (window.__miniOhneNetz) throw fehler("kein Netz", "unavailable");
      return [...eintraege.values()].filter((e) => e.name === name).map((e) => ({ ...e }));
    },
    speichere: async ({ game, spieler, name, punkte, ms = 0, zeitMs = 0, offline = false, quelle = null }) => {
      // Ohne Netz kommt keine Runde hinaus – so wie Firestore, das dann mit
      // «unavailable» abbricht. Was später kommt, bleibt stehen.
      if (!navigator.onLine) throw fehler("Failed to get document because the client is offline.", "unavailable");
      if (offline) (window.__miniSpaeter = window.__miniSpaeter || []).push({ game, spieler, name, punkte, ms, zeitMs, quelle });
      const id = game + "_" + spieler;
      const alt = eintraege.get(id);
      if (!alt) {
        eintraege.set(id, { id, game, spieler, name, punkte, versuche: 1, spielMs: ms, updatedAtMs: Date.now() });
        sichern();
        protokolliere(game, spieler, name, 1, punkte, ms);
        return { rekord: true, punkte, versuche: 1, name };
      }
      // Wie cloud.js: Der Eintrag behaelt seinen Namen.
      const rekord = punkte > alt.punkte;
      eintraege.set(id, { ...alt, punkte: rekord ? punkte : alt.punkte, versuche: alt.versuche + 1, spielMs: (alt.spielMs || 0) + ms, updatedAtMs: Date.now() });
      sichern();
      protokolliere(game, spieler, alt.name, alt.versuche + 1, punkte, ms);
      return { rekord, punkte: rekord ? punkte : alt.punkte, versuche: alt.versuche + 1, name: alt.name };
    },

    // Fuer den Adminbereich: das Rundenprotokoll lesen, loeschen, umziehen.
    MAX_RUNDEN: 20000,
    runden: async ({ vonMs = 0, bisMs = Date.now() } = {}) => {
      window.__miniRundenGefragt = { vonMs, bisMs };
      return [...rundenLager.values()]
        .filter((r) => r.zeitMs >= vonMs && r.zeitMs <= bisMs)
        .sort((a, b) => a.zeitMs - b.zeitMs)
        .map((r) => ({ quelle: "", ...r }));
    },
    ersteRunde: async () => {
      const zeiten = [...rundenLager.values()].map((r) => r.zeitMs).filter((ms) => ms > 0);
      return zeiten.length ? Math.min(...zeiten) : 0;
    },
    // Der Spielverlauf eines Spielers: alle Runden seiner Geräte. Wonach
    // gefragt wurde, bleibt in window.__miniRundenGeraete stehen.
    rundenVonGeraeten: async (kennungen) => {
      const wer = new Set(kennungen || []);
      window.__miniRundenGeraete = [...(window.__miniRundenGeraete || []), ...wer];
      return [...rundenLager.values()]
        .filter((r) => wer.has(r.spieler))
        .sort((a, b) => a.zeitMs - b.zeitMs)
        .map((r) => ({ quelle: "", offline: false, ...r }));
    },
    // Die Multiplayer eines Turniers (Endstand): Die Pruefung legt sie in
    // window.__miniTurnierLive hin, je Turnier eine Liste. Ohne bleibt es
    // wie vorher, als die Attrappe sie gar nicht kannte.
    turnierLive: async (id) => {
      const liste = (window.__miniTurnierLive || {})[id];
      return Array.isArray(liste) ? liste.map((a) => ({ ...a })) : undefined;
    },
    loescheRunden: async (liste) => {
      const weg = new Set((liste || []).map((e) => e.game + "_" + e.spieler));
      let n = 0;
      for (const [k, r] of [...rundenLager]) if (weg.has(r.game + "_" + r.spieler)) { rundenLager.delete(k); n += 1; }
      rSichern();
      return n;
    },
    zieheRundenUm: async ({ game, nach, name, basis = 0, von = [] }) => {
      let versatz = basis;
      let n = 0;
      for (const g of von) {
        for (const [k, r] of [...rundenLager]) {
          if (r.game !== game || r.spieler !== g.spieler) continue;
          const nr = versatz + r.nr;
          const id = game + "_" + nach + "_" + nr;
          rundenLager.delete(k);
          rundenLager.set(id, { ...r, id, spieler: nach, name, nr });
          n += 1;
        }
        versatz += Math.max(1, g.versuche || 1);
      }
      rSichern();
      return n;
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
      if (window.__miniOhneNetz) throw fehler("kein Netz", "unavailable");
      const t = turniere.get(id);
      return t ? { ...t } : null;
    },
    oeffentlicheTurniere: async () => [...turniere.values()].filter((t) => t.sichtbar === "alle").map((t) => ({ ...t })),
    alleTurniere: async () => [...turniere.values()].map((t) => ({ ...t })),
    // Der Multiplayer zu einem Turnier (live.js, turnierLive/<turnier>): Die
    // Prüfung legt ihn in window.__miniLiveZeiger hin.
    liveZeiger: async (id) => (window.__miniLiveZeiger || {})[id] || null,
    PRESETS_MAX: 50,
    PRESET_NAME_MAX: 60,
    presets: async () => {
      if (window.__miniPresetsGesperrt) throw fehler("Missing or insufficient permissions.", "permission-denied");
      return [...presetLager.values()].map((p) => JSON.parse(JSON.stringify(p))).sort((a, b) => b.gespeichertMs - a.gespeichertMs);
    },
    speicherePreset: async ({ name, turnier, gespeichertMs }) => {
      if (window.__miniPresetsGesperrt) throw fehler("Missing or insufficient permissions.", "permission-denied");
      const p = { name: String(name).replace(/\\s+/g, " ").trim(), turnier: JSON.parse(JSON.stringify(turnier || {})), gespeichertMs: Number(gespeichertMs) || Date.now() };
      presetLager.set(p.name, p);
      pSichern();
      return JSON.parse(JSON.stringify(p));
    },
    loeschePreset: async (name) => {
      presetLager.delete(String(name).replace(/\\s+/g, " ").trim());
      pSichern();
    },
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
    turnierErgebnisse: async (id, { game = "" } = {}) => {
      if (window.__miniOhneNetz) throw fehler("kein Netz", "unavailable");
      return turnierListe(id, game);
    },
  };
  function turnierListe(id, game) {
    return [...tEintraege.entries()]
      .filter(([k, e]) => k.startsWith(id + "/") && (!game || e.game === game))
      .map(([, e]) => ({ ...e }));
  }
  Object.assign(window.MiniCloud, {
    // Wie cloud.js, turnierHoeren (onSnapshot): das Turnier und seine Liste
    // als Strom – hier alle 300 ms nachgesehen, und nur, wenn sich etwas
    // geändert hat. Ohne Netz (window.__miniOhneNetz) schweigt er, wie
    // Firestore, bis die Verbindung wieder steht.
    turnierHoeren: (id, { beiTurnier = () => {}, beiEintraege = () => {}, beiEintraegen = beiEintraege } = {}) => {
      let vorherT;
      let vorherE;
      const schau = () => {
        if (window.__miniOhneNetz) return;
        const t = turniere.get(id) || null;
        const tText = JSON.stringify(t);
        if (tText !== vorherT) { vorherT = tText; beiTurnier(t ? { ...t } : null); }
        const liste = turnierListe(id, "");
        const eText = JSON.stringify(liste);
        if (eText !== vorherE) { vorherE = eText; beiEintraegen(liste); }
      };
      schau();
      const uhr = setInterval(schau, 300);
      return () => clearInterval(uhr);
    },
    meinTurnierEintrag: async (id, { game, spieler }) => {
      const e = tEintraege.get(id + "/" + game + "_" + spieler);
      return e ? { ...e } : null;
    },
    // Live mitschauen (geist.js schreibt und hört): der Knoten je
    // Turnier und Kennung in localStorage, damit eine zweite Seite im selben
    // Browser ihn sieht – wie die Realtime Database, ganz (PUT) oder Pfad für
    // Pfad (PATCH). Gehört wird alle 150 ms.
    mitschauenSchreiben: async (turnier, kennung, daten, wie) => {
      const k = "__mitschauen/" + turnier + "/" + kennung;
      let neu = null;
      if (wie && wie.ganz) neu = JSON.parse(JSON.stringify(daten));
      else {
        try { neu = JSON.parse(localStorage.getItem(k) || "null") || {}; } catch { neu = {}; }
        Object.keys(daten).forEach((pfad) => {
          const teile = pfad.split("/");
          let o = neu;
          for (let i = 0; i < teile.length - 1; i += 1) {
            if (!o[teile[i]] || typeof o[teile[i]] !== "object") o[teile[i]] = {};
            o = o[teile[i]];
          }
          o[teile[teile.length - 1]] = daten[pfad];
        });
      }
      localStorage.setItem(k, JSON.stringify(neu));
      window.__mitschauenGeschrieben = (window.__mitschauenGeschrieben || 0) + 1;
      return true;
    },
    mitschauenHoeren: (turnier, kennung, beiStand) => {
      const k = "__mitschauen/" + turnier + "/" + kennung;
      let vorher;
      const schau = () => {
        const roh = localStorage.getItem(k);
        if (roh === vorher) return;
        vorher = roh;
        let d = null;
        try { d = JSON.parse(roh || "null"); } catch { d = null; }
        beiStand(d);
      };
      schau();
      const uhr = setInterval(schau, 150);
      return () => clearInterval(uhr);
    },
    // Die Zettel (amSpielen): je Liste ein Eintrag – «__amSpielen» die der
    // App, «__amSpielen/<turnier>» die eines Turniers.
    amSpielenSchreiben: async (turnier, kennung, daten, wie) => {
      const k = "__amSpielen" + (turnier ? "/" + turnier : "");
      let alle = {};
      try { alle = JSON.parse(localStorage.getItem(k) || "{}") || {}; } catch { alle = {}; }
      if (daten === null) delete alle[kennung];
      else alle[kennung] = wie && wie.ganz ? { ...daten } : { ...(alle[kennung] || {}), ...daten };
      localStorage.setItem(k, JSON.stringify(alle));
      return true;
    },
    amSpielenHoeren: (beiStand, turnier = "") => {
      const k = "__amSpielen" + (turnier ? "/" + turnier : "");
      let vorher;
      const schau = () => {
        const roh = localStorage.getItem(k);
        if (roh === vorher) return;
        vorher = roh;
        let d = null;
        try { d = JSON.parse(roh || "null"); } catch { d = null; }
        beiStand(d);
      };
      schau();
      const uhr = setInterval(schau, 150);
      return () => clearInterval(uhr);
    },
    // Wer zuschaut (zuschauer/<spieler>/<ich>): «__zuschauer/<spieler>».
    zuschauerMelden: async (spieler, ich, daten) => {
      const k = "__zuschauer/" + spieler;
      let alle = {};
      try { alle = JSON.parse(localStorage.getItem(k) || "{}") || {}; } catch { alle = {}; }
      if (daten) alle[ich] = { ...daten };
      else delete alle[ich];
      localStorage.setItem(k, JSON.stringify(alle));
      return true;
    },
    zuschauerHoeren: (spieler, beiStand) => {
      const k = "__zuschauer/" + spieler;
      let vorher;
      const schau = () => {
        const roh = localStorage.getItem(k);
        if (roh === vorher) return;
        vorher = roh;
        let d = null;
        try { d = JSON.parse(roh || "null"); } catch { d = null; }
        beiStand(d);
      };
      schau();
      const uhr = setInterval(schau, 150);
      return () => clearInterval(uhr);
    },
    turnierVersuch: async (id, { game, spieler, name, grenze = 0 }) => {
      await langsam();
      if (window.__miniOhneNetz || !navigator.onLine) throw fehler("kein Netz", "unavailable");
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
      if (window.__miniOhneNetz || !navigator.onLine) throw fehler("kein Netz", "unavailable");
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
    turnierEintraegeBenennen: async (id, ids, name) => {
      let n = 0;
      (ids || []).forEach((e) => {
        const k = id + "/" + e;
        if (!tEintraege.has(k)) return;
        tEintraege.set(k, { ...tEintraege.get(k), name });
        n += 1;
      });
      tSichern();
      return n;
    },
  });

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
    // Eben vorbei: Zwölf Stunden lang steht es noch auf der Startseite.
    turnierVorlage("vorbei-test2345678", { name: "Sommercup", startMs: JETZT - 2 * TAG, endeMs: JETZT - 2 * STUNDE }),
    // Seit einem Tag vorbei: Es steht nicht mehr auf der Startseite.
    turnierVorlage("gestern-test234567", { name: "Gesterncup", startMs: JETZT - 3 * TAG, endeMs: JETZT - TAG }),
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
    turnierVorlage(GESCHICK, { name: "Geschickcup", sichtbar: "link", startMs: JETZT - 10 * MINUTE, spiele: ["bridgeBuilder", "dartWheel", "vineSwing", "tunnelFlight", "driftRace", "planetHop", "moonLander", "gravityRun", "hillGlide", "balloonRide", "skiSlalom", "frogHop", "ropeWalk", "craneHarbor", "wireLoop", "twinLanes", "keepyUppy", "juggler", "highDive", "skyDive", "lumberCut", "batEcho", "timeNinja", "freeDive", "flockFlight", "waveRide", "stoneSkip", "iceRun", "cliffFlight", "hammerThrow", "duckCrossing", "mineCart", "twinRotor", "eyeMeasure", "fireRope", "flagCommand", "timeSense", "speedClimb", "freeHand", "mindsEye", "iceStock"], versuche: 0 }),
    // Ohne Gegner beim Spielen (geist.js).
    turnierVorlage(OHNE_GEGNER, { name: "Stillcup", sichtbar: "link", startMs: JETZT - 5 * MINUTE, spiele: ["towerStack"], versuche: 0, ohneGeist: true }),
    // Gleiches Level wie Platz 1: jeder Versuch ist der erste (turnier.js).
    turnierVorlage(LEVEL_EINS, { name: "Levelcup", sichtbar: "link", startMs: JETZT - 5 * MINUTE, spiele: ["numberLine"], versuche: 0, aufgaben: "wieErster" }),
  ],
  // Im Herbstcup: Turmbau Grosi 30, Leo 25, Mia 20; Fischteich Leo 12, Mia 3;
  // im dritten Spiel noch niemand. Im Schnitt der gespielten Plätze ist das
  // Grosi 1 (nur Turmbau), Leo (2+1)/2 = 1,5, Mia (3+2)/2 = 2,5 – wer ein
  // Spiel auslässt, hat keinen Nachteil.
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

    // Unter demselben Namen hat schon ein zweites Gerät gespielt.
    await seite.evaluate(() => {
      const id = "towerStack_mini_zweitesgeraet1";
      window.__miniEintraege.set(id, { id, game: "towerStack", spieler: "mini_zweitesgeraet1", name: "Testkind", punkte: 3, versuche: 1, updatedAtMs: 500 });
    });

    // Namen ändern nimmt alles mit: Was unter dem alten Namen steht – auf
    // diesem Gerät und dem anderen –, heisst danach wie der neue, ohne dass
    // eine Runde daraus wird. Kennung, Bestwerte und Uhr bleiben.
    const vorher = await seite.evaluate(() => ({ id: localStorage.getItem("mini.id"), best: localStorage.getItem("mini.best") }));
    const hinweisMit = (muster) => seite.waitForFunction((m) => new RegExp(m).test(document.querySelector(".mini-wer-hinweis")?.textContent || ""), muster, { timeout: 4000 }).catch(() => {});
    await seite.click(".mini-name-steht button");
    await seite.waitForSelector(".mini-wer .mini-namensfeld input", { timeout: 4000 });
    pruefe(/mitnimmst|nimmst du mit/.test(await seite.locator(".mini-wer-hinweis").innerText()), "Beim Namen ändern steht nicht, dass die Punkte mitkommen.");
    await seite.fill(".mini-wer .mini-namensfeld input", "Testkind Zwei");
    await seite.click(".mini-wer .mini-namensfeld button[type=submit]");
    await hinweisMit("mitgekommen");
    const nach = await seite.evaluate((alt) => ({
      meine: [...window.__miniEintraege.values()].filter((e) => e.spieler === alt),
      zweites: window.__miniEintraege.get("towerStack_mini_zweitesgeraet1"),
      hinweis: document.querySelector(".mini-wer-hinweis")?.textContent || "",
      steht: document.querySelector(".mini-name-steht strong")?.textContent || "",
      id: localStorage.getItem("mini.id"),
      name: localStorage.getItem("mini.name"),
      best: localStorage.getItem("mini.best"),
      umbenannt: window.__miniUmbenannt || null,
    }), vorher.id);
    const turm = nach.meine.find((e) => e.game === "towerStack");
    const teich = nach.meine.find((e) => e.game === "fishPond");
    pruefe(turm?.name === "Testkind Zwei" && teich?.name === "Testkind Zwei" && nach.zweites?.name === "Testkind Zwei",
      `Namen ändern hat nicht alles mitgenommen: ${turm?.name} / ${teich?.name} / zweites Gerät ${nach.zweites?.name}`);
    pruefe(turm?.versuche === 2 && teich?.versuche === 1, `Namen ändern hat eine Runde erfunden: ${turm?.versuche} / ${teich?.versuche}`);
    pruefe(nach.zweites?.updatedAtMs === 500, `Namen ändern hat die Uhr verstellt: ${nach.zweites?.updatedAtMs}`);
    pruefe(nach.umbenannt?.alt === "Testkind" && nach.umbenannt?.spieler === vorher.id && Array.isArray(nach.umbenannt?.turniere),
      `Umbenannt wurde nicht nach Kennung und altem Namen: ${JSON.stringify(nach.umbenannt)}`);
    pruefe(nach.name === "Testkind Zwei" && nach.steht === "Testkind Zwei", `Nach dem Ändern steht: ${nach.name} · ${nach.steht} · ${nach.hinweis}`);
    pruefe(nach.id === vorher.id && nach.best === vorher.best, `Mit dem neuen Namen hat das Gerät seine Kennung oder Bestwerte verloren: ${JSON.stringify(nach)}`);

    // Die nächste Runde zählt im selben Eintrag weiter.
    await seite.reload({ waitUntil: "load" });
    await seite.waitForSelector(".cm-bar", { timeout: 8000 });
    pruefe(await spieleTurmbauZuEnde(seite), "Die Runde mit dem neuen Namen kam zu keinem Ergebnis.");
    await seite.waitForSelector(".mini-ergebnis .mini-zeile", { timeout: 6000 });
    const zwei = await seite.evaluate((alt) => ({
      namen: [...window.__miniEintraege.values()].filter((e) => e.game === "towerStack").map((e) => e.name),
      turm: window.__miniEintraege.get(`towerStack_${alt}`),
    }), vorher.id);
    pruefe(!zwei.namen.includes("Testkind") && zwei.turm?.name === "Testkind Zwei" && zwei.turm?.versuche === 3,
      `Nach der Runde mit neuem Namen steht im Turmbau: ${zwei.namen.join(", ")} (${zwei.turm?.versuche} Runden)`);

    // Ein Name, der schon in der Liste steht: Erst wird gefragt.
    await seite.click(".mini-name-steht button");
    await seite.fill(".mini-wer .mini-namensfeld input", "Grosi");
    await seite.click(".mini-wer .mini-namensfeld button[type=submit]");
    await hinweisMit("steht schon");
    pruefe(await seite.locator(".mini-wer button", { hasText: "Ja, das bin ich" }).count() === 1, "Bei einem Namen, den es schon gibt, wird nicht nachgefragt.");
    await seite.locator(".mini-wer button", { hasText: "Anderer Name" }).click();
    pruefe(await seite.evaluate(() => localStorage.getItem("mini.name")) === "Testkind Zwei"
      && await seite.evaluate(() => window.__miniEintraege.get("towerStack_mini_vorherdagewesen")?.name) === "Grosi",
      "«Anderer Name» hat trotzdem umbenannt.");

    // Ohne Netz gilt der neue Name trotzdem sofort – die Listen ziehen nach,
    // sobald das Netz zurück ist (mini-games.js, Umbenennen, das wartet).
    // Bis Oktober 2026 hiess es hier «Das ging gerade nicht».
    await seite.evaluate(() => { window.__miniOhneNetz = true; });
    await seite.fill(".mini-wer .mini-namensfeld input", "Ohne Netz");
    await seite.click(".mini-wer .mini-namensfeld button[type=submit]");
    await seite.waitForFunction(() => /sobald die Verbindung steht/.test(document.querySelector(".mini-wer")?.textContent || ""), null, { timeout: 8000 }).catch(() => {});
    const imKeller = await seite.evaluate((alt) => ({
      name: localStorage.getItem("mini.name"),
      text: document.querySelector(".mini-wer")?.textContent || "",
      wartet: JSON.parse(localStorage.getItem("mini.umbenennen") || "[]").length,
      liste: window.__miniEintraege.get(`towerStack_${alt}`)?.name,
    }), vorher.id);
    pruefe(imKeller.name === "Ohne Netz" && /sobald die Verbindung steht/.test(imKeller.text) && imKeller.wartet === 1 && imKeller.liste === "Testkind Zwei",
      `Ohne Netz liess sich der Name nicht ändern, oder er wartet nicht auf das Netz: ${JSON.stringify(imKeller)}`);
    // Das Netz ist zurück: Die Listen bekommen den neuen Namen.
    await seite.evaluate(() => { window.__miniOhneNetz = false; window.dispatchEvent(new Event("online")); });
    await seite.waitForFunction((alt) => window.__miniEintraege.get(`towerStack_${alt}`)?.name === "Ohne Netz", vorher.id, { timeout: 6000 }).catch(() => {});
    const zurueckImNetz = await seite.evaluate((alt) => ({
      liste: window.__miniEintraege.get(`towerStack_${alt}`)?.name,
      wartet: localStorage.getItem("mini.umbenennen"),
    }), vorher.id);
    pruefe(zurueckImNetz.liste === "Ohne Netz" && !zurueckImNetz.wartet,
      `Zurück im Netz kam der neue Name nicht in die Listen: ${JSON.stringify(zurueckImNetz)}`);
    // Und wieder zurück, für den Rest der Prüfung.
    await seite.click(".mini-name-steht button");
    await seite.fill(".mini-wer .mini-namensfeld input", "Testkind Zwei");
    await seite.click(".mini-wer .mini-namensfeld button[type=submit]");
    await hinweisMit("mitgekommen");

    // Jemand anderes spielt auf diesem Gerät: ein neuer Mitspieler, mit
    // eigener Kennung und ohne die Bestwerte.
    const mitZwei = await seite.evaluate(() => ({ id: localStorage.getItem("mini.id"), best: localStorage.getItem("mini.best") }));
    await seite.click(".mini-name-steht button");
    await seite.locator(".mini-wer button", { hasText: "Jemand anderes spielt" }).click();
    await seite.fill(".mini-wer .mini-namensfeld input", "Geschwister");
    await seite.click(".mini-wer .mini-namensfeld button[type=submit]");
    await hinweisMit("nächsten Runde");
    const anderer = await seite.evaluate(() => ({ id: localStorage.getItem("mini.id"), name: localStorage.getItem("mini.name"), best: localStorage.getItem("mini.best") }));
    pruefe(anderer.name === "Geschwister" && /^mini_[A-Za-z0-9_-]{8,48}$/.test(anderer.id || "") && anderer.id !== mitZwei.id && anderer.best === "{}",
      `«Jemand anderes spielt» ist kein neuer Mitspieler: ${JSON.stringify(anderer)}`);
    pruefe(await seite.evaluate(() => [...window.__miniEintraege.values()].some((e) => e.name === "Testkind Zwei")), "«Jemand anderes spielt» hat alte Einträge umbenannt.");

    // Zurück zum alten Mitspieler: ein Tipp auf seinen Namen.
    await seite.click(".mini-name-steht button");
    await seite.locator(".mini-wer button", { hasText: "Jemand anderes spielt" }).click();
    await seite.locator(".mini-wer-andere button", { hasText: "Testkind Zwei" }).click();
    await hinweisMit("Willkommen zurück");
    const zurueck = await seite.evaluate(() => ({ id: localStorage.getItem("mini.id"), best: localStorage.getItem("mini.best"), name: localStorage.getItem("mini.name") }));
    pruefe(zurueck.id === mitZwei.id && zurueck.best === mitZwei.best && zurueck.name === "Testkind Zwei",
      `Zurück beim alten Namen ist das Gerät nicht wieder der alte Mitspieler: ${JSON.stringify(zurueck)}`);

    // Auf einem anderen Gerät umbenannt (oder vom Admin): Was der Server über
    // den Namen der eigenen Kennung sagt, gilt.
    await seite.evaluate((ich) => {
      for (const e of window.__miniEintraege.values()) if (e.spieler === ich) window.__miniEintraege.set(e.id, { ...e, name: "Testkind Drei" });
      localStorage.setItem("__mini_attrappe", JSON.stringify([...window.__miniEintraege]));
    }, mitZwei.id);
    await seite.reload({ waitUntil: "load" });
    await seite.waitForFunction(() => localStorage.getItem("mini.name") === "Testkind Drei", null, { timeout: 6000 }).catch(() => {});
    pruefe(await seite.evaluate(() => localStorage.getItem("mini.name")) === "Testkind Drei",
      `Den Namen von einem anderen Gerät übernimmt das Gerät nicht: ${await seite.evaluate(() => localStorage.getItem("mini.name"))}`);

    // Der Admin hat die Kennung zusammengeführt: Das Gerät zieht mit um.
    await seite.evaluate((ich) => {
      const nach = "mini_umgezogenumgezogen";
      window.__miniEintraege.set(`towerStack_${nach}`, { id: `towerStack_${nach}`, game: "towerStack", spieler: nach, name: "Umgezogen", punkte: 40, versuche: 9, updatedAtMs: 900 });
      localStorage.setItem("__mini_attrappe", JSON.stringify([...window.__miniEintraege]));
      localStorage.setItem("__mini_umzuege_attrappe", JSON.stringify([[ich, { nach, name: "Umgezogen" }]]));
    }, mitZwei.id);
    await seite.reload({ waitUntil: "load" });
    await seite.waitForFunction(() => localStorage.getItem("mini.id") === "mini_umgezogenumgezogen", null, { timeout: 6000 }).catch(() => {});
    const umgezogen = await seite.evaluate(() => ({ id: localStorage.getItem("mini.id"), name: localStorage.getItem("mini.name") }));
    pruefe(umgezogen.id === "mini_umgezogenumgezogen" && umgezogen.name === "Umgezogen", `Das Gerät folgt dem Umzug nicht: ${JSON.stringify(umgezogen)}`);
    await kontext.close();
  }

  // --- 2a. Ohne Netz ---------------------------------------------------------
  // Eine Runde ohne Netz wartet auf dem Gerät, der Bestwert gilt gleich, und
  // die Liste zeigt, was das Gerät zuletzt gesehen hat – mit der eigenen
  // Runde darin. Kommt das Netz zurück, geht sie hinaus, mit ihrer Uhrzeit.
  {
    const { kontext, seite } = await neueSeite();
    await seite.addInitScript(() => {
      if (sessionStorage.getItem("__ohneNetz")) return;
      sessionStorage.setItem("__ohneNetz", "1");
      localStorage.setItem("mini.id", "mini_ohnenetzohnenetz");
      localStorage.setItem("mini.name", "Funkloch");
    });
    await seite.goto(`${BASIS}/turmbau`, { waitUntil: "load" });
    await seite.waitForSelector(".cm-bar", { timeout: 8000 });
    pruefe(await spieleTurmbauZuEnde(seite), "Ohne Netz: Die erste Runde (noch online) kam zu keinem Ergebnis.");
    await seite.waitForSelector(".mini-ergebnis .mini-zeile", { timeout: 6000 });
    const online = await seite.evaluate(() => window.__miniEintraege.get("towerStack_mini_ohnenetzohnenetz")?.versuche || 0);

    await kontext.setOffline(true);
    await seite.click(".cm-actions .cm-icon-again");
    pruefe(await spieleTurmbauZuEnde(seite), "Ohne Netz kam die Runde zu keinem Ergebnis.");
    await seite.waitForFunction(() => /Ohne Netz gemerkt/.test(document.querySelector(".mini-ergebnis .mini-meldung")?.textContent || ""), null, { timeout: 6000 }).catch(() => {});
    await seite.waitForSelector(".mini-ergebnis .mini-zeile", { timeout: 6000 }).catch(() => {});
    const weg = await seite.evaluate(() => ({
      meldung: document.querySelector(".mini-ergebnis .mini-meldung")?.textContent || "",
      zeilen: [...document.querySelectorAll(".mini-ergebnis .mini-zeile")].map((z) => z.textContent.replace(/\s+/g, " ").trim()),
      wartet: JSON.parse(localStorage.getItem("mini.wartet") || "[]"),
      versuche: window.__miniEintraege.get("towerStack_mini_ohnenetzohnenetz")?.versuche || 0,
    }));
    pruefe(/Ohne Netz gemerkt/.test(weg.meldung), `Ohne Netz steht unter dem Ergebnis: ${weg.meldung}`);
    pruefe(weg.wartet.length === 1 && weg.wartet[0].spiel === "towerStack" && weg.wartet[0].name === "Funkloch" && weg.wartet[0].zeitMs > 0,
      `Die Runde ohne Netz wartet nicht auf dem Gerät: ${JSON.stringify(weg.wartet)}`);
    pruefe(weg.versuche === online, `Ohne Netz kam die Runde trotzdem hinaus: ${weg.versuche} statt ${online}`);
    pruefe(weg.zeilen.some((z) => /Funkloch/.test(z)) && weg.zeilen.some((z) => /Grosi/.test(z)),
      `Ohne Netz zeigt die Liste nicht, was das Gerät zuletzt gesehen hat: ${weg.zeilen.join(" | ")}`);

    // Zurück im Netz: Die Runde geht hinaus, von selbst.
    await kontext.setOffline(false);
    await seite.waitForFunction(() => !(JSON.parse(localStorage.getItem("mini.wartet") || "[]")).length, null, { timeout: 6000 }).catch(() => {});
    const zurueck = await seite.evaluate(() => ({
      wartet: JSON.parse(localStorage.getItem("mini.wartet") || "[]").length,
      versuche: window.__miniEintraege.get("towerStack_mini_ohnenetzohnenetz")?.versuche || 0,
      spaeter: window.__miniSpaeter || [],
    }));
    pruefe(zurueck.wartet === 0 && zurueck.versuche === online + 1, `Zurück im Netz ist die Runde nicht hinausgegangen: ${JSON.stringify(zurueck)}`);
    pruefe(zurueck.spaeter.length === 1 && zurueck.spaeter[0].zeitMs === weg.wartet[0].zeitMs && zurueck.spaeter[0].quelle === "",
      `Die Runde ging nicht mit ihrer Uhrzeit hinaus: ${JSON.stringify(zurueck.spaeter)}`);

    // Die Startseite ohne Netz: das Zeichen oben rechts, und die Listen von
    // vorhin.
    await seite.goto(`${BASIS}/`, { waitUntil: "load" });
    await seite.waitForSelector(".ar-kachel", { timeout: 8000 });
    await seite.waitForFunction(() => /Grosi|Funkloch/.test(document.querySelector(".ar-rang")?.textContent || ""), null, { timeout: 8000 }).catch(() => {});
    pruefe(await seite.locator(".ar-offline").isHidden(), "Mit Netz steht oben «Offline».");
    await kontext.setOffline(true);
    await seite.waitForFunction(() => !document.querySelector(".ar-offline")?.hidden, null, { timeout: 3000 }).catch(() => {});
    pruefe(/Offline/.test(await seite.locator(".ar-offline").innerText().catch(() => "")), "Ohne Netz steht oben nicht «Offline».");
    const ohne = await klassenOhneRegel(seite);
    pruefe(ohne.length === 0, `Ohne Netz – Klassen ohne Regel: ${ohne.join(", ")}`);
    await kontext.setOffline(false);
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
    // Das Handy findet danach seinen Weg: Es zieht zur Kennung des Tablets.
    const umzug = await seite.evaluate((h) => window.__miniUmzuege.get(h) || null, HANDY);
    pruefe(umzug?.nach === TABLET && umzug.name === "Alain", `Zusammenführen hat nicht vermerkt, wohin das Handy zieht: ${JSON.stringify(umzug)}`);

    // Zwei Namen, ein Spieler: «Efu» ist Joshua. Beide ankreuzen, wählen,
    // welcher bleibt – danach steht nur noch Joshua da, mit allem von beiden.
    const EFU = "mini_efuefuefuefu";
    await seite.evaluate((efu) => {
      const e = (game, punkte, versuche, ms) => [`${game}_${efu}`, { id: `${game}_${efu}`, game, spieler: efu, name: "Efu", punkte, versuche, spielMs: ms, erstesMs: 800, updatedAtMs: 950 }];
      [e("towerStack", 50, 2, 60000), e("fishPond", 7, 1, 30000)].forEach(([k, v]) => window.__miniEintraege.set(k, v));
      localStorage.setItem("__mini_attrappe", JSON.stringify([...window.__miniEintraege]));
    }, EFU);
    await seite.locator(".adm-kopf button", { hasText: "Neu laden" }).click();
    const personZeile = (name) => seite.locator("#adm-spieler .adm-tabelle tr", { has: seite.locator(".adm-person", { hasText: new RegExp(`^${name}$`) }) });
    await personZeile("Efu").waitFor({ timeout: 6000 }).catch(() => {});
    await personZeile("Efu").locator(".adm-merk-haken").check();
    const leiste = seite.locator("#adm-spieler .adm-merk-leiste");
    pruefe(/Efu/.test(await leiste.innerText().catch(() => "")) && await leiste.locator("button", { hasText: "Zusammenführen" }).isDisabled(),
      "Mit einem gewählten Namen steht die Leiste nicht da, oder es liesse sich schon zusammenführen.");
    await personZeile("Joshua").locator(".adm-merk-haken").check();
    await leiste.locator("button", { hasText: "Zusammenführen" }).click();
    await seite.waitForSelector(".adm-zusammen", { timeout: 4000 }).catch(() => {});
    const fenster = await seite.evaluate(() => ({
      namen: [...document.querySelectorAll(".adm-zusammen-wahl strong")].map((n) => n.textContent),
      gewaehlt: document.querySelector(".adm-zusammen-wahl input:checked")?.closest("label")?.querySelector("strong")?.textContent || "",
      satz: document.querySelector(".adm-zusammen .adm-hinweis")?.textContent || "",
    }));
    pruefe(fenster.namen.length === 2 && fenster.gewaehlt === "Joshua" && /«Efu» verschwindet/.test(fenster.satz),
      `Das Fenster zum Zusammenführen zeigt: ${JSON.stringify(fenster)}`);
    await seite.locator(".adm-zusammen-wahl", { hasText: "Efu" }).click();
    pruefe(/«Joshua» verschwindet/.test(await seite.locator(".adm-zusammen .adm-hinweis").first().innerText()), "Die Wahl, welcher Name bleibt, ändert den Satz darunter nicht.");
    await seite.locator(".adm-zusammen-wahl", { hasText: "Joshua" }).click();
    await seite.locator(".adm-zusammen button", { hasText: /^Zusammenführen$/ }).click();
    await seite.waitForFunction((efu) => ![...window.__miniEintraege.values()].some((e) => e.spieler === efu), EFU, { timeout: 6000 }).catch(() => {});
    await seite.waitForFunction(() => !document.querySelector(".adm-zusammen"), null, { timeout: 4000 }).catch(() => {});
    const namenZusammen = await seite.evaluate((efu) => ({
      joshua: Object.fromEntries([...window.__miniEintraege.values()].filter((e) => e.name === "Joshua").map((e) => [e.game, `${e.spieler === efu ? "E" : e.spieler}:${e.punkte}/${e.versuche}/${e.spielMs || 0}`])),
      efu: [...window.__miniEintraege.values()].filter((e) => e.name === "Efu" || e.spieler === efu).length,
      umzug: window.__miniUmzuege.get(efu) || null,
      liste: [...document.querySelectorAll("#adm-spieler .adm-person")].map((b) => b.textContent),
      gewaehlt: document.querySelectorAll("#adm-spieler .adm-merk-haken:checked").length,
    }), EFU);
    pruefe(JSON.stringify(namenZusammen.joshua) === JSON.stringify({ towerStack: "mini_joshuajoshua:50/18/60000", fishPond: "mini_joshuajoshua:7/1/30000" }) && namenZusammen.efu === 0,
      `Nach dem Zusammenführen von Efu und Joshua steht: ${JSON.stringify(namenZusammen)}`);
    pruefe(namenZusammen.umzug?.nach === "mini_joshuajoshua" && namenZusammen.umzug.name === "Joshua", `Efus Gerät weiss nicht, wohin es zieht: ${JSON.stringify(namenZusammen.umzug)}`);
    pruefe(!namenZusammen.liste.includes("Efu") && namenZusammen.liste.includes("Joshua") && namenZusammen.gewaehlt === 0,
      `In der Liste der Spieler steht nach dem Zusammenführen: ${namenZusammen.liste.join(", ")} (gewählt: ${namenZusammen.gewaehlt})`);
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
    pruefe(kopfzeilen.some((z) => /wertung/i.test(z)) && kopfzeilen.some((z) => /platz/i.test(z)),
      `${wo}: In der Gesamtwertung fehlen Wertung oder Platz im Schnitt (Spalten: ${kopfzeilen.join(", ")}).`);
    pruefe(!kopfzeilen.some((z) => /runde/i.test(z)), `${wo}: In der Auswertung stehen die Runden je Spieler (Spalten: ${kopfzeilen.join(", ")}).`);
    pruefe(await seite.locator(".ar-fenster .mini-gesamt-podest .tn-stufe").count() >= 1, `${wo}: Über der Gesamtwertung fehlt das Podest.`);
    // Keine Wahl der Spiele: Es zählen die auf der Startseite – die Tiers
    // kennt nur der Admin.
    pruefe(!/Tier \d/.test(await seite.locator(".ar-fenster .mini-gesamt").innerText()), `${wo}: In der Gesamtwertung steht ein Tier zur Wahl.`);
    // Sortieren nach einer Spalte, und ein Tipp auf einen Namen zeigt seine
    // Karte – mit dem, was er am meisten spielt, aber ohne Zahl dazu.
    await seite.locator(".ar-fenster .mini-gesamt-sortier", { hasText: "Spiele" }).click();
    pruefe(await seite.locator('.ar-fenster .mini-gesamt-tabelle th[aria-sort="descending"]', { hasText: "Spiele" }).count() === 1,
      `${wo}: Ein Tipp auf «Spiele» sortiert die Gesamtwertung nicht danach.`);
    await seite.locator(".ar-fenster .mini-gesamt-sortier", { hasText: "Wertung" }).click();
    await seite.locator(".ar-fenster .mini-gesamt-person", { hasText: "Grosi" }).first().click();
    await seite.waitForSelector(".ar-fenster .mini-profil", { timeout: 3000 }).catch(() => {});
    const profil = await seite.evaluate(() => ({
      name: document.querySelector(".ar-fenster .mini-profil-name")?.textContent || "",
      teile: [...document.querySelectorAll(".ar-fenster .mini-profil-titel")].map((t) => t.textContent),
      oft: [...document.querySelectorAll(".ar-fenster .mini-profil-teil")].find((t) => /meisten/.test(t.textContent))?.innerText || "",
    }));
    pruefe(profil.name === "Grosi" && profil.teile.some((t) => /beste/i.test(t)) && profil.teile.some((t) => /meisten gespielt/i.test(t)),
      `${wo}: Die Karte eines Spielers zeigt nicht, was sie soll: ${JSON.stringify(profil)}`);
    pruefe(profil.oft && !/\d/.test(profil.oft), `${wo}: Bei «Am meisten gespielt» steht eine Zahl: ${profil.oft}`);
    await seite.locator(".ar-fenster .mini-profil-zurueck").click();
    pruefe(await seite.locator(".ar-fenster .mini-gesamt-tabelle").count() === 1, `${wo}: «Zur Gesamtwertung» führt nicht zurück.`);
    const ohneRegelGesamt = await klassenOhneRegel(seite);
    pruefe(ohneRegelGesamt.length === 0, `${wo}: Gesamtwertung – Klassen ohne Regel: ${ohneRegelGesamt.join(", ")}`);
    // Ein Tipp neben das Fenster schliesst es.
    await seite.mouse.click(5, hoch - 5);
    await seite.waitForFunction(() => !document.querySelector(".ar-fenster"), null, { timeout: 2000 }).catch(() => {});
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
    for (const nicht of ["Familienabend", "Frühlingscup", "Pausencup", "Blindcup", "Würfelcup", "Gesterncup"]) {
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
    // Nur mit Link: ein Raum für sich – kein Logo, kein Weg zur Startseite,
    // und unter dem Namen oben rechts keine anderen Turniere.
    await seite.click(".ar-name-knopf");
    const zu = await seite.evaluate(() => ({
      logo: document.querySelectorAll("[data-turnier] .ar-marke").length,
      start: [...document.querySelectorAll("[data-turnier] a")].filter((a) => a.getAttribute("href") === "/").length,
      meine: document.querySelectorAll(".tn-meine").length,
    }));
    pruefe(zu.logo === 0 && zu.start === 0 && zu.meine === 0, `Das Turnier nur mit Link führt hinaus: ${JSON.stringify(zu)}`);
    await seite.keyboard.press("Escape");
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
    // Deine Turniere: Unter dem Namen oben rechts auf der Startseite stehen
    // die Turniere, in denen auf diesem Gerät gespielt wurde – auch eines,
    // das schon lange nicht mehr in der Zeile steht –, mit dem eigenen Platz.
    // Eines, das es nicht mehr gibt, wird vergessen.
    const { kontext, seite } = await mitTurnieren("/", { vorher: () => {
      localStorage.setItem("mini.id", "mini_leoleoleoleo");
      localStorage.setItem("mini.name", "Leo");
      if (!localStorage.getItem("mini.turniere.dabei")) localStorage.setItem("mini.turniere.dabei", JSON.stringify(["alt-test234567890", "gibtsnicht-123456", "herbstcup-test2345"]));
    } });
    await seite.waitForSelector(".ar-kachel", { timeout: 8000 });
    await seite.click(".ar-name-knopf");
    await seite.waitForFunction(() => document.querySelectorAll(".tn-meine .tn-meine-zeile").length === 2
      && document.querySelector(".tn-meine .tn-meine-platz.ist-da"), null, { timeout: 6000 }).catch(() => {});
    const meine = await seite.evaluate(() => ({
      zeilen: [...document.querySelectorAll(".tn-meine .tn-meine-zeile")].map((z) => [z.getAttribute("href"), z.querySelector("strong").textContent, z.querySelector(".tn-meine-platz").textContent]),
      gemerkt: JSON.parse(localStorage.getItem("mini.turniere.dabei") || "[]"),
    }));
    pruefe(JSON.stringify(meine.zeilen) === JSON.stringify([["/turnier?t=herbstcup-test2345", "Herbstcup", "2."], ["/turnier?t=alt-test234567890", "Frühlingscup", ""]]),
      `Unter dem Namen stehen nicht die eigenen Turniere – das laufende zuerst, mit dem Platz: ${JSON.stringify(meine.zeilen)}`);
    pruefe(!meine.gemerkt.includes("gibtsnicht-123456"), `Ein Turnier, das es nicht mehr gibt, bleibt gemerkt: ${JSON.stringify(meine.gemerkt)}`);
    const ohneMeine = await klassenOhneRegel(seite);
    pruefe(ohneMeine.length === 0, `Deine Turniere – Klassen ohne Regel: ${ohneMeine.join(", ")}`);
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
      hinaus: [...document.querySelectorAll("[data-turnier] a:not(.ar-marke)")].map((a) => a.getAttribute("href")).filter((h) => !/^\/(turnier|admin)\b/.test(h) && !/[?&]turnier=/.test(h)),
      logo: document.querySelector("[data-turnier] .tn-titel .ar-marke")?.getAttribute("href") ?? null,
      admin: document.querySelector(".ar-kopf .mini-knopf-admin")?.getAttribute("href"),
      ueberstand: document.documentElement.scrollWidth - window.innerWidth,
      blatt: document.documentElement.scrollHeight - window.innerHeight,
    }));
    pruefe(stand.titel === "Herbstcup", `${lage}: Die Turnierseite heisst "${stand.titel}".`);
    pruefe(/läuft noch/.test(stand.status) && /2 Versuche je Spiel/.test(stand.status), `${lage}: Unter dem Namen steht nicht, wie lange es noch läuft und was gilt: ${stand.status}`);
    pruefe(stand.spiele.length === 3, `${lage}: Auf der Turnierseite stehen ${stand.spiele.length} Spiele statt drei.`);
    pruefe(stand.play === `/turmbau?turnier=${HERBST}`, `${lage}: Play führt nicht ins Spiel im Turnier: ${stand.play}`);
    pruefe(JSON.stringify(stand.podest) === JSON.stringify(["Grosi", "Leo", "Mia"]), `${lage}: Oben stehen nicht Grosi, Leo und Mia: ${stand.podest.join(", ")}`);
    // Keine Regeln in Sätzen und kein Block zum Weitersagen: Dauer und
    // Versuche stehen oben, den Link hat der Adminbereich. Und kein Weg
    // hinaus – das Turnier ist ein Raum für sich.
    pruefe(stand.regeln === 0, `${lage}: Auf der Turnierseite steht wieder ein Block mit Regeln.`);
    pruefe(stand.teilen === 0, `${lage}: Auf der Turnierseite steht wieder der Block zum Weitersagen.`);
    pruefe(stand.hinaus.length === 0, `${lage}: Von der Turnierseite führt ein Weg hinaus: ${stand.hinaus.join(", ")}`);
    // Ein öffentliches Turnier trägt oben links das Logo – den Weg zur
    // Startseite. (Eines nur mit Link nicht, siehe Familienabend.)
    pruefe(stand.logo === "/", `${lage}: Beim öffentlichen Turnier fehlt oben links das Logo zur Startseite (${stand.logo}).`);
    pruefe(stand.admin === "/admin", `${lage}: Als Admin fehlt auf der Turnierseite der Weg in den Adminbereich.`);
    pruefe(stand.ueberstand <= 1 && stand.blatt <= 1, `${lage}: Die Turnierseite passt nicht in einen Bildschirm: ${stand.ueberstand} px zu breit, ${stand.blatt} px zu hoch.`);
    const ohne = await klassenOhneRegel(seite);
    pruefe(ohne.length === 0, `${lage}: Turnierseite – Klassen ohne Regel: ${ohne.join(", ")}`);
    // Die ganze Gesamtwertung im Fenster, mit der Beschreibung: oben das
    // Podest, in der Mitte der Erste – nur Namen und Schnitt. Darunter, für
    // sich, jedes Spiel mit seiner Rangliste.
    await seite.click(".tn-wertung");
    await seite.waitForSelector("dialog.ist-gesamt .tn-sieger", { timeout: 4000 }).catch(() => {});
    const gesamt = await seite.evaluate(() => ({
      erster: document.querySelector("dialog.ist-gesamt .tn-sieger .ist-stelle-1 .tn-person-name")?.textContent,
      ersterWert: document.querySelector("dialog.ist-gesamt .tn-sieger .ist-stelle-1 .tn-person-wert strong")?.textContent,
      zweiterWert: document.querySelector("dialog.ist-gesamt .tn-sieger .ist-stelle-2 .tn-person-wert strong")?.textContent,
      zeilen: document.querySelectorAll("dialog.ist-gesamt .tn-person").length,
      zu: document.querySelectorAll("dialog.ist-gesamt .tn-detail, dialog.ist-gesamt .tn-raenge .tn-wie").length,
      spieleSchonDa: document.querySelectorAll("dialog.ist-gesamt .tn-spiel").length,
      reiter: [...document.querySelectorAll("dialog.ist-gesamt .tn-reiter-knopf")].map((k) => `${k.textContent}${k.classList.contains("ist-an") ? "*" : ""}`),
      beschreibung: document.querySelector("dialog.ist-gesamt .tn-beschreibung")?.textContent,
    }));
    pruefe(gesamt.erster === "Grosi" && gesamt.ersterWert === "1" && gesamt.zweiterWert === "1,5",
      `${lage}: Die Gesamtwertung rechnet falsch – vorne steht ${gesamt.erster} mit ${gesamt.ersterWert} (dahinter ${gesamt.zweiterWert}) statt Grosi mit 1 und Leo mit 1,5.`);
    pruefe(gesamt.zeilen === 3, `${lage}: In der Gesamtwertung stehen ${gesamt.zeilen} Spieler statt drei.`);
    pruefe(gesamt.zu === 0, `${lage}: In der Gesamtwertung steht schon vor dem ersten Tipp, woraus sich ein Rang zusammensetzt.`);
    pruefe(JSON.stringify(gesamt.reiter) === JSON.stringify(["Gesamtwertung*", "Spiele"]) && gesamt.spieleSchonDa === 0,
      `${lage}: Oben im Fenster stehen nicht die Reiter «Gesamtwertung» (gewählt) und «Spiele»: ${JSON.stringify(gesamt)}`);
    // Ein Tipp auf den Zweiten klappt auf, woraus sich sein Schnitt
    // zusammensetzt – ein zweiter klappt es wieder zu.
    await seite.click("dialog.ist-gesamt .tn-sieger .ist-stelle-2");
    const einzeln = await seite.evaluate(() => ({
      zeilen: [...document.querySelectorAll("dialog.ist-gesamt .tn-detail .tn-detail-zeile")].map((z) => `${z.querySelector(".tn-detail-spiel").textContent} ${z.querySelector(".tn-detail-platz").textContent}`),
      rechnung: document.querySelector("dialog.ist-gesamt .tn-detail .tn-detail-rechnung")?.textContent || "",
      wie: Boolean(document.querySelector("dialog.ist-gesamt .tn-detail .tn-wie")),
    }));
    pruefe(JSON.stringify(einzeln.zeilen) === JSON.stringify(["Turmbau 2.", "Fischteich 1.", "Wo hält der Zug? nicht gespielt"])
      && einzeln.rechnung === "Ø Platz 1,5: (2 + 1) ÷ 2" && einzeln.wie,
      `${lage}: Ein Tipp auf den Zweiten zeigt nicht, woraus sich sein Schnitt zusammensetzt: ${JSON.stringify(einzeln)}`);
    await seite.click("dialog.ist-gesamt .tn-sieger .ist-stelle-2");
    pruefe(await seite.locator("dialog.ist-gesamt .tn-detail").count() === 0, `${lage}: Ein zweiter Tipp klappt die Einzelheiten nicht wieder zu.`);
    // Der Reiter «Spiele»: jedes Spiel mit seiner Rangliste – und nichts vom
    // Podest.
    await seite.click('dialog.ist-gesamt .tn-reiter-knopf[data-reiter="spiele"]');
    const spieleReiter = await seite.evaluate(() => ({
      spiele: [...document.querySelectorAll("dialog.ist-gesamt .tn-spiel")].map((k) => [
        k.querySelector(".tn-spiel-titel")?.textContent,
        [...k.querySelectorAll(".gk-name-text")].map((n) => n.textContent).join(" "),
      ]),
      podest: document.querySelectorAll("dialog.ist-gesamt .tn-sieger").length,
    }));
    pruefe(JSON.stringify(spieleReiter.spiele) === JSON.stringify([["Turmbau", "Grosi Leo Mia"], ["Fischteich", "Leo Mia"], ["Wo hält der Zug?", ""]]) && spieleReiter.podest === 0,
      `${lage}: Unter «Spiele» stehen die Spiele nicht mit ihren Ranglisten: ${JSON.stringify(spieleReiter)}`);
    const ohneReiter = await klassenOhneRegel(seite);
    pruefe(ohneReiter.length === 0, `${lage}: Reiter «Spiele» – Klassen ohne Regel: ${ohneReiter.join(", ")}`);
    await seite.click('dialog.ist-gesamt .tn-reiter-knopf[data-reiter="gesamt"]');
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
    pruefe(await seite.locator(".tn-sieger, .tn-person").count() === 0, "Im verdeckten Turnier steht die Gesamtwertung da.");
    await kontext.close();
  }
  {
    // Wer gerade spielt: die Zettel des Turniers (Realtime Database, hier in
    // localStorage) – Zoe im Fischteich, mit Punkten. Nicht dabei sind ein
    // Zettel, der seit Minuten schweigt (liegen gelassen), wer in der App
    // spielt (die Turnierseite zeigt nur das Turnier) – und man selbst: der
    // Zettel dieses Geräts, eben fertig gespielt, und einer unter demselben
    // Namen von einem anderen Gerät. «Live» zeigt die anderen.
    const { kontext, seite } = await mitTurnieren(`/turnier?t=${HERBST}`, { viewport: { width: 1500, height: 900 }, vorher: () => {
      localStorage.setItem("mini.id", "mini_ichichichichich");
      localStorage.setItem("mini.name", "Ich");
      const d = window.__miniTurniereAnfang;
      const t = d.turniere.find((x) => x.name === "Herbstcup").id;
      d.eintraege = [...d.eintraege, { turnier: t, game: "fishPond", spieler: "mini_zoezoezoezoe", name: "Zoe", punkte: 0, versuche: 1, offen: true, updatedAtMs: Date.now() }];
      localStorage.setItem(`__amSpielen/${t}`, JSON.stringify({
        mini_zoezoezoezoe: { name: "Zoe", spiel: "fishPond", p: 120, lebt: Date.now() },
        mini_altaltaltalt: { name: "Alt", spiel: "numberLine", p: 3, lebt: Date.now() - 10 * 60000 },
        mini_ichichichichich: { name: "Ich", spiel: "towerStack", p: 34, lebt: Date.now(), fertig: true },
        mini_ichamhandyhandy: { name: "ich", spiel: "fishPond", p: 5, lebt: Date.now() },
      }));
      localStorage.setItem("__amSpielen", JSON.stringify({ mini_maxmaxmaxmax: { name: "Max", spiel: "towerStack", p: 7, lebt: Date.now() } }));
    } });
    const vorher = fehlerAufSeite.length;
    // Oben ein Knopf «● 1 live» – und sonst nichts, was kommt und geht: keine
    // Leiste über dem Bild, kein Name auf den Kacheln, kein Satz unter dem
    // Namen des Spiels, kein Punkt am Podest.
    await seite.waitForSelector(".ar-kopf .ar-live-knopf:not([hidden])", { timeout: 8000 }).catch(() => {});
    const zuZoe = `/fischteich?mitschauen=mini_zoezoezoezoe&aus=${HERBST}&wer=Zoe`;
    const live = await seite.evaluate(() => ({
      knopf: document.querySelector(".ar-kopf .ar-live-knopf:not([hidden])")?.textContent.replace(/\s+/g, " ").trim() || "",
      kacheln: document.querySelectorAll(".ar-kachel .ar-kachel-live").length,
      leiste: document.querySelectorAll(".ar-live, .ar-spielen").length,
      podest: document.querySelectorAll(".tn-podest .ist-am-spielen").length,
      oben: document.querySelector(".tn-oben .tn-spielen")?.textContent || "",
      reihe: getComputedStyle(document.querySelector(".ar-seite")).gridTemplateRows.split(" ").length,
    }));
    pruefe(live.knopf === "1live" || live.knopf === "1 live",
      `Oben steht kein Knopf «1 live» für Zoe: ${JSON.stringify(live)}`);
    pruefe(!live.kacheln && !live.leiste && !live.podest && !live.oben && live.reihe === 3,
      `Auf der Turnierseite kommt und geht noch etwas, wenn jemand spielt: ${JSON.stringify(live)}`);
    // Ein Tipp auf den Knopf: die Liste, mit Spiel, Punkten und Zuschauen.
    await seite.click(".ar-live-knopf");
    await seite.waitForSelector("dialog.ist-live .ar-live-karte", { timeout: 4000 }).catch(() => {});
    const karten = await seite.evaluate(() => [...document.querySelectorAll("dialog.ist-live .ar-live-karte")].map((k) => ({
      text: k.querySelector(".ar-live-text").innerText.replace(/\s+/g, " ").trim(),
      link: k.querySelector("a.ar-live-zuschauen:not([hidden])")?.getAttribute("href") || "",
      pause: k.classList.contains("ist-pause"),
    })));
    pruefe(karten.length === 1 && /^Zoe spielt Fischteich 120 /.test(karten[0].text) && karten[0].link === zuZoe && !karten[0].pause,
      `In der Liste hinter «live» steht nicht genau Zoe mit Fischteich, Punkten und Zuschauen: ${JSON.stringify(karten)}`);
    const ohneLive = await klassenOhneRegel(seite);
    pruefe(ohneLive.length === 0, `Die Liste hinter «live» – Klassen ohne Regel: ${ohneLive.join(", ")}`);
    await seite.keyboard.press("Escape");
    await seite.click(".tn-wertung");
    await seite.waitForSelector("dialog.ist-gesamt .tn-avatar.ist-am-spielen", { timeout: 4000 }).catch(() => {});
    // Im Fenster: ein grüner Punkt an Zoes Kreis, und beim Fischteich steht,
    // dass sie ihn gerade spielt.
    const reiter = (art) => seite.click(`dialog.ist-gesamt .tn-reiter-knopf[data-reiter="${art}"]`);
    const amSpiel = async () => {
      await reiter("gesamt");
      const kreise = await seite.evaluate(() => [...document.querySelectorAll("dialog.ist-gesamt .tn-person")]
        .filter((p) => p.querySelector(".tn-avatar.ist-am-spielen")).map((p) => p.querySelector(".tn-person-name").textContent));
      await reiter("spiele");
      const spiele = await seite.evaluate(() => [...document.querySelectorAll("dialog.ist-gesamt .tn-spiel")].filter((k) => k.querySelector(".tn-spiel-live"))
        .map((k) => `${k.querySelector(".tn-spiel-titel").textContent}: ${k.querySelector(".tn-spiel-live").textContent} / ${[...k.querySelectorAll(".gk-zeile.ist-am-spielen .gk-name-text")].map((n) => n.textContent).join(",")}`));
      await reiter("gesamt");
      return { kreise, spiele };
    };
    const imFenster = await amSpiel();
    pruefe(JSON.stringify(imFenster) === JSON.stringify({ kreise: ["Zoe"], spiele: ["Fischteich: Zoe spielt gerade / Zoe"] }),
      `Im Fenster der Gesamtwertung steht nicht, dass Zoe Fischteich spielt: ${JSON.stringify(imFenster)}`);
    const ohne = await klassenOhneRegel(seite);
    pruefe(ohne.length === 0, `Wer gerade spielt – Klassen ohne Regel: ${ohne.join(", ")}`);
    // Neue Punkte zeichnen das offene Fenster nicht neu (es bliebe sonst bei
    // sechs Spielern nie still): Ein Merkmal am Fenster überlebt sie. Erst,
    // wenn das Fenster zur Ruhe gekommen ist (die ▶ werden nachgefragt).
    await seite.waitForTimeout(1500);
    await seite.evaluate((t) => {
      document.querySelector("dialog.ist-gesamt .tn-person")?.setAttribute("data-merk", "1");
      const zettel = JSON.parse(localStorage.getItem(`__amSpielen/${t}`));
      zettel.mini_zoezoezoezoe = { ...zettel.mini_zoezoezoezoe, p: 130, lebt: Date.now() };
      localStorage.setItem(`__amSpielen/${t}`, JSON.stringify(zettel));
    }, HERBST);
    await seite.waitForTimeout(800);
    pruefe(await seite.locator("dialog.ist-gesamt .tn-person[data-merk]").count() === 1, "Neue Punkte zeichnen das offene Fenster der Gesamtwertung neu.");
    // Zoe ist fertig: Ihr Zettel sagt es, ihr Ergebnis kommt. Die Seite liest
    // danach auch die Liste neu – Zoe steht mit ihrem Fischteich vorne. Oben
    // bleibt sie noch eine Weile «zwischen zwei Runden»: Der Knopf kommt und
    // geht nicht mit jeder Runde.
    await seite.evaluate((t) => {
      const k = [...window.__miniTurnierEintraege.keys()].find((x) => x.endsWith("/fishPond_mini_zoezoezoezoe"));
      window.__miniTurnierEintraege.set(k, { ...window.__miniTurnierEintraege.get(k), punkte: 99, offen: false, updatedAtMs: Date.now() });
      const zettel = JSON.parse(localStorage.getItem(`__amSpielen/${t}`));
      zettel.mini_zoezoezoezoe = { ...zettel.mini_zoezoezoezoe, p: 99, lebt: Date.now(), fertig: true };
      localStorage.setItem(`__amSpielen/${t}`, JSON.stringify(zettel));
    }, HERBST);
    await seite.waitForFunction(() => /Zoe/.test(document.querySelector(".ar-rang")?.textContent || ""), null, { timeout: 20000 }).catch(() => {});
    const fertig = await seite.evaluate(() => ({
      knopf: !document.querySelector(".ar-live-knopf")?.hidden,
      reihe: getComputedStyle(document.querySelector(".ar-seite")).gridTemplateRows.split(" ").length,
      zoe: [...document.querySelectorAll("dialog.ist-gesamt .tn-person")].find((p) => p.querySelector(".tn-person-name")?.textContent === "Zoe")?.querySelector(".tn-person-wert strong")?.textContent,
      rang: document.querySelector(".ar-rang")?.textContent || "",
    }));
    pruefe(fertig.knopf && fertig.reihe === 3 && fertig.zoe === "1" && /Zoe/.test(fertig.rang),
      `Nach Zoes Ergebnis liest die Turnierseite nicht neu, oder der Knopf «live» ist gleich weg: ${JSON.stringify(fertig)}`);
    await seite.keyboard.press("Escape");
    await seite.click(".ar-live-knopf");
    await seite.waitForSelector("dialog.ist-live .ar-live-karte", { timeout: 4000 }).catch(() => {});
    pruefe(await seite.locator("dialog.ist-live .ar-live-karte.ist-pause").count() === 1, "Nach ihrer Runde steht Zoe in der Liste nicht als «zwischen zwei Runden».");
    await seite.keyboard.press("Escape");
    // Wer die Seite mitten in der Runde verlässt, nimmt seinen Zettel mit –
    // und ist sofort weg.
    await seite.evaluate((t) => {
      const zettel = JSON.parse(localStorage.getItem(`__amSpielen/${t}`));
      delete zettel.mini_zoezoezoezoe;
      localStorage.setItem(`__amSpielen/${t}`, JSON.stringify(zettel));
    }, HERBST);
    await seite.waitForFunction(() => document.querySelector(".ar-live-knopf")?.hidden, null, { timeout: 4000 }).catch(() => {});
    pruefe(await seite.locator(".ar-live-knopf:not([hidden])").count() === 0, "Ohne Zettel steht oben noch «live».");
    pruefe(fehlerAufSeite.length === vorher, `Wer gerade spielt – die Seite hat sich beschwert: ${fehlerAufSeite.slice(vorher).join(" / ")}`);
    await kontext.close();
  }
  {
    // Live mitschauen: Ein Gerät spielt im Turnier, ein zweites schaut zu –
    // hier zwei Seiten im selben Browser (die Attrappe hält den Knoten der
    // Realtime Database in localStorage). Der Beobachtungsmodus folgt dem
    // Spieler: durch seine Runde, auf die Tafel, wenn er nicht spielt, und in
    // das nächste Spiel, das er beginnt – bis «Beenden».
    const { kontext, seite } = await mitTurnieren(`/turmbau?turnier=${DAUER}`, { vorher: () => localStorage.setItem("mini.name", "Herz") });
    const vorher = fehlerAufSeite.length;
    await turnierLos(seite, "Herz");
    const { breit, hoch } = await seite.evaluate(() => ({ breit: window.innerWidth, hoch: window.innerHeight }));
    const tipp = () => seite.mouse.click(Math.round(breit / 2), Math.round(hoch * 0.75));
    await tipp();
    await seite.waitForFunction(() => window.LernappTurnier.stand().laeuft, null, { timeout: 4000 }).catch(() => {});
    const kennung = await seite.evaluate(() => localStorage.getItem("mini.id"));
    const zweite = await kontext.newPage();
    await zweite.route("**/cloud.js*", (route) => route.fulfill({ contentType: "text/javascript; charset=utf-8", body: ATTRAPPE }));
    await zweite.route("https://www.gstatic.com/firebasejs/**", (route) => route.fulfill({ contentType: "text/javascript; charset=utf-8", body: "/* in der Prüfung nicht gebraucht */" }));
    await zweite.addInitScript((daten) => { window.__miniTurniereAnfang = daten; }, TURNIERE);
    zweite.on("pageerror", (fehler) => fehlerAufSeite.push(String(fehler.message || fehler)));
    await zweite.goto(`${BASIS}/turmbau?mitschauen=${kennung}&aus=${DAUER}&wer=Herz`, { waitUntil: "load" });
    for (let i = 0; i < 3; i += 1) {
      await tipp();
      await seite.waitForTimeout(700);
    }
    await zweite.waitForTimeout(2600);
    const blick = () => Promise.all([
      seite.evaluate(() => window.LernappTurmbau?.state?.bloecke?.length ?? -1),
      zweite.evaluate(() => ({
        bloecke: window.LernappTurmbau?.state?.bloecke?.length ?? -1,
        phase: window.LernappTurmbau?.state?.phase,
        live: Boolean(document.querySelector(".gz-leiste.ist-live")),
        titel: document.querySelector(".gz-titel")?.textContent || "",
        tafel: document.querySelector(".gz-tafel:not([hidden])")?.innerText.replace(/\s+/g, " ").trim() || "",
        pfad: window.location.pathname,
      })),
    ]);
    const [selbst, zu] = await blick();
    pruefe(zu.live && zu.phase === "zuschauen" && /^Herz/.test(zu.titel) && !zu.tafel && selbst > 1 && zu.bloecke === selbst,
      `Wer zuschaut, sieht den Turm nicht mitwachsen: Spieler ${selbst} Blöcke, Zuschauer ${JSON.stringify(zu)}`);
    // Zu Ende gespielt: die Tafel, kurz.
    pruefe(await spieleZuEnde(seite), "Die Runde, der zugeschaut wurde, kam zu keinem Ergebnis.");
    await zweite.waitForFunction(() => /spielt gerade nicht/.test(document.querySelector(".gz-tafel:not([hidden])")?.textContent || ""), null, { timeout: 6000 }).catch(() => {});
    const [, danach] = await blick();
    pruefe(/^Herz spielt gerade nicht zuletzt \d+ Blöcke/.test(danach.tafel), `Nach der Runde steht nicht, dass Herz gerade nicht spielt: ${danach.tafel}`);
    // Eine neue Runde in einem anderen Spiel: Der Zuschauer geht mit.
    await seite.goto(`${BASIS}/fischteich?turnier=${DAUER}`, { waitUntil: "load" });
    await seite.waitForFunction(() => window.LernappTurnier?.stand?.().freigegeben, null, { timeout: 8000 }).catch(() => {});
    await seite.mouse.click(Math.round(breit / 2), Math.round(hoch * 0.6));
    await zweite.waitForURL(/\/fischteich\?mitschauen=/, { timeout: 8000 }).catch(() => {});
    pruefe(new URL(zweite.url()).pathname === "/fischteich" && new URL(zweite.url()).searchParams.get("mitschauen") === kennung,
      `Der Zuschauer geht nicht mit ins nächste Spiel: ${zweite.url()}`);
    // «Beenden» verlässt den Beobachtungsmodus – zurück zum Turnier.
    await zweite.waitForSelector(".gz-leiste .gz-zu", { timeout: 6000 }).catch(() => {});
    await zweite.click(".gz-leiste .gz-zu").catch(() => {});
    await zweite.waitForURL(/\/turnier\?t=/, { timeout: 6000 }).catch(() => {});
    pruefe(new URL(zweite.url()).pathname === "/turnier", `«Beenden» führt nicht zurück zum Turnier: ${zweite.url()}`);
    pruefe(fehlerAufSeite.length === vorher, `Live mitschauen – die Seiten haben sich beschwert: ${fehlerAufSeite.slice(vorher).join(" / ")}`);
    await kontext.close();
  }
  {
    // Live mitschauen in der App: Wer mit Namen spielt, steht auf der
    // Startseite – auf der Kachel, unter dem Namen des Spiels und in seiner
    // Rangliste –, und ein Tipp darauf schaut zu. Der Beobachtungsmodus
    // bleibt über die Runde hinaus, bis «Beenden»; das führt zur Startseite.
    const { kontext, seite } = await mitTurnieren("/turmbau", { vorher: () => localStorage.setItem("mini.name", "Herz") });
    const vorher = fehlerAufSeite.length;
    const { breit, hoch } = await seite.evaluate(() => ({ breit: window.innerWidth, hoch: window.innerHeight }));
    const tipp = () => seite.mouse.click(Math.round(breit / 2), Math.round(hoch * 0.75));
    // Eine zweite Seite im selben Browser. Sie teilt sich localStorage mit
    // der ersten – und wäre damit derselbe Spieler, der sich unter «live»
    // nicht selbst sieht. «als» macht sie zu einem anderen Gerät: Name und
    // Kennung gelten dann nur in ihr.
    const nochEine = async (adresse, als = null) => {
      const neu = await kontext.newPage();
      await neu.route("**/cloud.js*", (route) => route.fulfill({ contentType: "text/javascript; charset=utf-8", body: ATTRAPPE }));
      await neu.route("https://www.gstatic.com/firebasejs/**", (route) => route.fulfill({ contentType: "text/javascript; charset=utf-8", body: "/* in der Prüfung nicht gebraucht */" }));
      await neu.addInitScript((daten) => { window.__miniTurniereAnfang = daten; }, TURNIERE);
      if (als) await neu.addInitScript(({ id, name }) => {
        const eigen = new Map([["mini.id", id], ["mini.name", name]]);
        const lesen = Storage.prototype.getItem;
        const schreiben = Storage.prototype.setItem;
        Storage.prototype.getItem = function getItem(k) { return this === window.localStorage && eigen.has(k) ? eigen.get(k) : lesen.call(this, k); };
        Storage.prototype.setItem = function setItem(k, w) { if (this === window.localStorage && eigen.has(k)) eigen.set(k, String(w)); else schreiben.call(this, k, w); };
      }, als);
      neu.on("pageerror", (fehler) => fehlerAufSeite.push(String(fehler.message || fehler)));
      await neu.goto(`${BASIS}${adresse}`, { waitUntil: "load" });
      return neu;
    };
    await tipp();
    await seite.waitForFunction(() => window.LernappTurmbau?.state?.phase === "spiel", null, { timeout: 4000 }).catch(() => {});
    await seite.waitForTimeout(300);
    const kennung = await seite.evaluate(() => localStorage.getItem("mini.id"));
    const zettel = await seite.evaluate(() => JSON.parse(localStorage.getItem("__amSpielen") || "{}"));
    pruefe(zettel[kennung]?.name === "Herz" && zettel[kennung]?.spiel === "towerStack" && !zettel[kennung]?.fertig,
      `Wer in der App spielt, legt keinen Zettel hin: ${JSON.stringify(zettel)}`);
    const zuHerz = `/turmbau?mitschauen=${kennung}&wer=Herz`;
    // Herz selbst sieht sich auf der Startseite nicht unter «live» – auch
    // nicht in einem zweiten Fenster: «Live» zeigt die anderen.
    const selber = await nochEine("/");
    await selber.waitForSelector(".ar-kachel", { timeout: 8000 }).catch(() => {});
    await selber.waitForTimeout(1200);
    pruefe(await selber.locator(".ar-live-knopf:not([hidden])").count() === 0 && await selber.locator(".ar-live-knopf").count() === 1,
      "Wer spielt, sieht sich auf der Startseite selbst unter «live».");
    await selber.close();
    const MOND = { id: "mini_mondmondmondmond", name: "Mond" };
    const start = await nochEine("/", MOND);
    // Auf der Startseite eines anderen Geräts: oben «live», dahinter Herz mit
    // Turmbau und dem Weg zum Zuschauen.
    await start.waitForSelector(".ar-live-knopf:not([hidden])", { timeout: 6000 }).catch(() => {});
    await start.click(".ar-live-knopf").catch(() => {});
    await start.waitForSelector("dialog.ist-live .ar-live-karte", { timeout: 3000 }).catch(() => {});
    const aufStart = await start.evaluate(() => ({
      text: document.querySelector("dialog.ist-live .ar-live-karte .ar-live-text")?.innerText.replace(/\s+/g, " ").trim() || "",
      knopf: document.querySelector("dialog.ist-live a.ar-live-zuschauen:not([hidden])")?.getAttribute("href"),
    }));
    pruefe(/^Herz spielt Turmbau/.test(aufStart.text) && aufStart.knopf === zuHerz,
      `Die Startseite zeigt nicht, dass Herz Turmbau spielt, mit dem Weg zum Zuschauen: ${JSON.stringify(aufStart)}`);
    await start.click("dialog.ist-live a.ar-live-zuschauen");
    await start.waitForURL(/\/turmbau\?mitschauen=/, { timeout: 6000 }).catch(() => {});
    for (let i = 0; i < 3; i += 1) {
      await tipp();
      await seite.waitForTimeout(700);
    }
    await start.waitForTimeout(2600);
    const blick = () => Promise.all([
      seite.evaluate(() => window.LernappTurmbau?.state?.bloecke?.length ?? -1),
      start.evaluate(() => ({
        bloecke: window.LernappTurmbau?.state?.bloecke?.length ?? -1,
        phase: window.LernappTurmbau?.state?.phase,
        live: Boolean(document.querySelector(".gz-leiste.ist-live")),
        titel: document.querySelector(".gz-titel")?.textContent || "",
        tafel: document.querySelector(".gz-tafel:not([hidden])")?.innerText.replace(/\s+/g, " ").trim() || "",
        neu: !window.__alteSeite,
      })),
    ]);
    const [selbst, zu] = await blick();
    pruefe(zu.live && zu.phase === "zuschauen" && /^Herz/.test(zu.titel) && !zu.tafel && selbst > 1 && zu.bloecke === selbst,
      `Wer in der App zuschaut, sieht den Turm nicht mitwachsen: Spieler ${selbst} Blöcke, Zuschauer ${JSON.stringify(zu)}`);
    // Wer zuschaut, steht beim Spieler unten links – klein, mit grünem
    // Punkt, und nicht anklickbar.
    await seite.waitForFunction(() => /schaut gerade zu/.test(document.querySelector(".gz-zuschauer:not([hidden])")?.textContent || ""), null, { timeout: 4000 }).catch(() => {});
    const hinweis = await seite.evaluate(() => {
      const p = document.querySelector(".gz-zuschauer:not([hidden])");
      if (!p) return null;
      const r = p.getBoundingClientRect();
      return { text: p.textContent.trim(), punkt: Boolean(p.querySelector(".ar-live-punkt")), zeiger: getComputedStyle(p).pointerEvents, links: Math.round(r.left), unten: Math.round(window.innerHeight - r.bottom), breit: Math.round(r.width) };
    });
    pruefe(hinweis?.text === "Mond schaut gerade zu" && hinweis.punkt && hinweis.zeiger === "none" && hinweis.links >= 0 && hinweis.links < 40 && hinweis.unten >= 0 && hinweis.unten < 60 && hinweis.breit < breit / 2,
      `Beim Spieler steht nicht unten links, dass jemand zuschaut: ${JSON.stringify(hinweis)}`);
    pruefe(await spieleZuEnde(seite), "Die Runde in der App, der zugeschaut wurde, kam zu keinem Ergebnis.");
    await start.waitForFunction(() => /spielt gerade nicht/.test(document.querySelector(".gz-tafel:not([hidden])")?.textContent || ""), null, { timeout: 6000 }).catch(() => {});
    const [, danach] = await blick();
    pruefe(/^Herz spielt gerade nicht zuletzt \d+ Blöcke/.test(danach.tafel), `Nach der Runde in der App steht nicht, dass Herz gerade nicht spielt: ${danach.tafel}`);
    const fertig = await seite.evaluate(() => JSON.parse(localStorage.getItem("__amSpielen") || "{}"));
    pruefe(fertig[kennung]?.fertig === true, `Nach der Runde sagt der Zettel nicht, dass Herz fertig ist: ${JSON.stringify(fertig[kennung])}`);
    // Herz spielt noch eine Runde: Der Zuschauer ist von selbst wieder dabei
    // (die Seite lädt dafür neu, mit der Welt der neuen Runde).
    await start.evaluate(() => { window.__alteSeite = true; });
    await seite.click(".cm-bar-left .cm-icon-again").catch(() => {});
    for (let i = 0; i < 3; i += 1) {
      await tipp();
      await seite.waitForTimeout(600);
    }
    let weiter = null;
    for (let i = 0; i < 40; i += 1) {
      await start.waitForTimeout(250);
      weiter = await blick().then(([, z]) => z).catch(() => null);
      if (weiter?.neu && weiter.phase === "zuschauen" && !weiter.tafel) break;
    }
    pruefe(weiter?.neu && weiter.live && weiter.phase === "zuschauen" && !weiter.tafel, `Bei der nächsten Runde schaut der Zuschauer nicht von selbst wieder zu: ${JSON.stringify(weiter)}`);
    // Herz steht jetzt in der Rangliste: Dort trägt der Name den grünen
    // Punkt, und «spielt gerade» ist ein Weg zum Zuschauen.
    const liste = await nochEine("/", MOND);
    await liste.click('.ar-kachel[data-spiel="towerStack"]').catch(() => {});
    await liste.waitForSelector(".ar-live-knopf:not([hidden])", { timeout: 4000 }).catch(() => {});
    await liste.click(".ar-rang");
    await liste.waitForSelector("dialog .gk-zeile.ist-am-spielen", { timeout: 4000 }).catch(() => {});
    const inListe = await liste.evaluate(() => {
      const zeile = document.querySelector("dialog .gk-zeile.ist-am-spielen");
      return { name: zeile?.querySelector(".gk-name-text")?.textContent || "", link: zeile?.querySelector("a.gk-spielt")?.getAttribute("href") || "" };
    });
    pruefe(inListe.name === "Herz" && inListe.link === zuHerz, `In der Rangliste steht nicht, dass Herz gerade spielt, mit dem Weg zum Zuschauen: ${JSON.stringify(inListe)}`);
    // «Beenden»: zurück zur Startseite.
    await start.click(".gz-leiste .gz-zu").catch(() => {});
    await start.waitForURL((url) => url.pathname === "/" || url.pathname === "/index.html", { timeout: 6000 }).catch(() => {});
    pruefe(["/", "/index.html"].includes(new URL(start.url()).pathname), `«Beenden» führt in der App nicht zur Startseite: ${start.url()}`);
    await seite.waitForFunction(() => !document.querySelector(".gz-zuschauer:not([hidden])"), null, { timeout: 4000 }).catch(() => {});
    const nochDa = await seite.evaluate(() => document.querySelector(".gz-zuschauer:not([hidden])")?.textContent || "");
    pruefe(!nochDa, `Nach «Beenden» steht beim Spieler noch, dass jemand zuschaut: ${nochDa}`);
    // Ohne Namen geht nichts hinaus.
    await seite.evaluate(() => { localStorage.removeItem("mini.name"); });
    await Promise.all([seite.close(), liste.close()]);
    await start.evaluate(() => { localStorage.removeItem("__amSpielen"); });
    const ohne = await nochEine("/turmbau");
    await ohne.mouse.click(Math.round(breit / 2), Math.round(hoch * 0.75));
    await ohne.waitForTimeout(1200);
    const leer = await ohne.evaluate(() => localStorage.getItem("__amSpielen"));
    pruefe(!leer || leer === "{}", `Wer ohne Namen spielt, legt trotzdem einen Zettel hin: ${leer}`);
    pruefe(fehlerAufSeite.length === vorher, `Live mitschauen in der App – die Seiten haben sich beschwert: ${fehlerAufSeite.slice(vorher).join(" / ")}`);
    await kontext.close();
  }
  {
    // Der Zettel einer Turnierrunde: Wer im Turnier spielt, steht mit Spiel
    // und Punkten in dessen Liste (nie in der der App), und am Ende «fertig».
    // Ist die Rangliste verdeckt, stehen keine Punkte darauf.
    const { kontext, seite } = await mitTurnieren(`/turmbau?turnier=${DAUER}`, { vorher: () => localStorage.setItem("mini.name", "Herz") });
    const vorher = fehlerAufSeite.length;
    await turnierLos(seite, "Herz");
    const { breit, hoch } = await seite.evaluate(() => ({ breit: window.innerWidth, hoch: window.innerHeight }));
    const tipp = () => seite.mouse.click(Math.round(breit / 2), Math.round(hoch * 0.75));
    await tipp();
    await seite.waitForFunction(() => window.LernappTurnier.stand().laeuft, null, { timeout: 4000 }).catch(() => {});
    for (let i = 0; i < 2; i += 1) {
      await tipp();
      await seite.waitForTimeout(700);
    }
    const zettel = (id = "") => seite.evaluate((k) => {
      const alle = JSON.parse(localStorage.getItem(k) || "{}");
      return alle[localStorage.getItem("mini.id")] || null;
    }, `__amSpielen${id ? `/${id}` : ""}`);
    // Neue Punkte gehen höchstens alle fünf Sekunden hinaus (geist.js,
    // AM_SPIELEN_PUNKTE_MS).
    await seite.waitForFunction((k) => (JSON.parse(localStorage.getItem(k) || "{}")[localStorage.getItem("mini.id")]?.p || 0) >= 1,
      `__amSpielen/${DAUER}`, { timeout: 9000 }).catch(() => {});
    const imSpiel = await zettel(DAUER);
    const blöcke = await seite.evaluate(() => window.LernappTurmbau.state.bloecke.length);
    pruefe(imSpiel?.name === "Herz" && imSpiel.spiel === "towerStack" && imSpiel.p >= 1 && imSpiel.p <= blöcke && !imSpiel.fertig && !(await zettel()),
      `Die Turnierrunde legt ihren Zettel nicht richtig hin: ${JSON.stringify({ imSpiel, blöcke, app: await zettel() })}`);
    pruefe(await spieleZuEnde(seite), "Die Turnierrunde mit Zettel kam zu keinem Ergebnis.");
    await seite.waitForTimeout(400);
    const amEnde = await zettel(DAUER);
    pruefe(amEnde?.fertig === true && Number.isInteger(amEnde.p), `Am Ende sagt der Zettel nicht, dass Herz fertig ist: ${JSON.stringify(amEnde)}`);
    // Verdeckt: der Zettel ohne Punkte.
    await seite.goto(`${BASIS}/turmbau?turnier=verdeckt-test23456`, { waitUntil: "load" });
    await turnierLos(seite, "Herz");
    await tipp();
    await seite.waitForFunction(() => window.LernappTurnier.stand().laeuft, null, { timeout: 4000 }).catch(() => {});
    await tipp();
    await seite.waitForTimeout(2600);
    const blind = await zettel("verdeckt-test23456");
    pruefe(blind?.name === "Herz" && blind.spiel === "towerStack" && !("p" in blind), `Im verdeckten Turnier stehen Punkte auf dem Zettel: ${JSON.stringify(blind)}`);
    pruefe(fehlerAufSeite.length === vorher, `Der Zettel der Turnierrunde – die Seite hat sich beschwert: ${fehlerAufSeite.slice(vorher).join(" / ")}`);
    await kontext.close();
  }
  {
    // Live auf der Startseite: wer in der App spielt und wer in einem
    // öffentlichen Turnier (mit dessen Namen) – nicht, wer in einem Turnier
    // nur mit Link spielt, und nie man selbst: weder der Zettel dieses Geräts
    // (eben eine Runde gespielt, «zwischen zwei Runden») noch einer unter
    // demselben Namen von einem anderen Gerät. Oben ein Knopf mit der Zahl,
    // dahinter die Liste mit Punkten und Zuschauen. Spielt niemand, ist der
    // Knopf weg; das Bild bleibt dabei immer gleich gross.
    const { kontext, seite } = await mitTurnieren("/", { viewport: { width: 1280, height: 800 }, vorher: () => {
      if (sessionStorage.getItem("__zettel")) return;
      sessionStorage.setItem("__zettel", "1");
      localStorage.setItem("mini.id", "mini_ichichichichich");
      localStorage.setItem("mini.name", "Ich");
      localStorage.setItem("__amSpielen", JSON.stringify({
        mini_maxmaxmaxmax: { name: "Max", spiel: "towerStack", p: 7, lebt: Date.now() },
        mini_ichichichichich: { name: "Ich", spiel: "towerStack", p: 34, lebt: Date.now(), fertig: true },
        mini_ichamhandyhandy: { name: "ich", spiel: "fishPond", p: 5, lebt: Date.now() },
      }));
      localStorage.setItem("__amSpielen/herbstcup-test2345", JSON.stringify({
        mini_zoezoezoezoe: { name: "Zoe", spiel: "fishPond", p: 120, lebt: Date.now() },
        mini_ichichichichich: { name: "Ich", spiel: "fishPond", p: 9, lebt: Date.now() },
      }));
      localStorage.setItem("__amSpielen/familie-geheim2345", JSON.stringify({ mini_geheimgeheim: { name: "Geheim", spiel: "numberLine", p: 3, lebt: Date.now() } }));
    } });
    const vorher = fehlerAufSeite.length;
    await seite.waitForFunction(() => document.querySelector(".ar-kopf .ar-live-knopf:not([hidden]) .ar-live-zahl")?.textContent === "2", null, { timeout: 8000 }).catch(() => {});
    const bildHoehe = () => seite.evaluate(() => Math.round(document.querySelector(".ar-filme").getBoundingClientRect().height));
    const mitBild = await bildHoehe();
    pruefe(await seite.evaluate(() => document.querySelector(".ar-live-knopf .ar-live-zahl")?.textContent) === "2", "Oben steht nicht «2 live» für Max und Zoe.");
    await seite.click(".ar-live-knopf");
    await seite.waitForSelector("dialog.ist-live .ar-live-karte", { timeout: 4000 }).catch(() => {});
    const mit = await seite.evaluate(() => ({
      karten: [...document.querySelectorAll("dialog.ist-live .ar-live-karte")].map((k) => ({
        text: k.querySelector(".ar-live-text").innerText.replace(/\s+/g, " ").trim(),
        link: k.querySelector("a.ar-live-zuschauen:not([hidden])")?.getAttribute("href") || "",
      })),
      reihe: getComputedStyle(document.querySelector(".ar-seite")).gridTemplateRows.split(" ").length,
    }));
    const [max, zoe] = mit.karten;
    pruefe(!mit.karten.some((k) => /^ich /i.test(k.text)), `Unter «live» steht man auf der Startseite selbst: ${JSON.stringify(mit.karten)}`);
    pruefe(mit.karten.length === 2 && mit.reihe === 3
      && /^Max spielt Turmbau 7 /.test(max?.text || "") && max.link === "/turmbau?mitschauen=mini_maxmaxmaxmax&wer=Max"
      && /^Zoe spielt Fischteich im Turnier Herbstcup 120 /.test(zoe?.text || "") && zoe.link === `/fischteich?mitschauen=mini_zoezoezoezoe&aus=${HERBST}&wer=Zoe`,
      `Die Liste hinter «live» zeigt nicht genau Max (App) und Zoe (Herbstcup): ${JSON.stringify(mit)}`);
    const ohne = await klassenOhneRegel(seite);
    pruefe(ohne.length === 0, `Live auf der Startseite – Klassen ohne Regel: ${ohne.join(", ")}`);
    // Ein Tipp auf das Spiel schliesst die Liste und holt es nach oben.
    await seite.click("dialog.ist-live .ar-live-karte .ar-live-spiel");
    await seite.waitForFunction(() => document.querySelector(".ar-kachel.ist-aktiv")?.dataset.spiel === "towerStack" && !document.querySelector("dialog.ist-live[open]"), null, { timeout: 3000 }).catch(() => {});
    pruefe((await seite.evaluate(() => document.querySelector(".ar-kachel.ist-aktiv")?.dataset.spiel)) === "towerStack"
      && await seite.locator("dialog.ist-live[open]").count() === 0, "Ein Tipp auf das Spiel in der Liste holt es nicht nach oben.");
    // Weggegangen (der Zettel ist weg): Der Knopf geht, das Bild bleibt, wie
    // es war.
    await seite.evaluate(() => {
      localStorage.setItem("__amSpielen", "{}");
      localStorage.setItem("__amSpielen/herbstcup-test2345", "{}");
    });
    await seite.waitForFunction(() => document.querySelector(".ar-live-knopf")?.hidden, null, { timeout: 4000 }).catch(() => {});
    await seite.waitForTimeout(300);
    pruefe(await seite.locator(".ar-live-knopf:not([hidden])").count() === 0 && await bildHoehe() === mitBild,
      `Ohne Spieler bleibt «live» stehen, oder das Bild springt: ${mitBild} → ${await bildHoehe()}`);
    pruefe(fehlerAufSeite.length === vorher, `Live auf der Startseite – die Seite hat sich beschwert: ${fehlerAufSeite.slice(vorher).join(" / ")}`);
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

  // --- 4e2. Der eigene Link: games.alae.app/<kennung> -----------------------------
  // Unter /hotdog liegt keine Datei: Netlify zeigt 404.html (hier der lokale
  // Server), und die leitet zum Turnier weiter. Eine Seite, die es gibt, nur
  // gross geschrieben, führt zu ihr; alles andere bleibt «nicht gefunden».
  {
    // Eine Adresse ohne Datei antwortet mit 404 – das meldet der Browser in
    // der Konsole, und hier ist es Absicht. Alles andere zählt weiter.
    const vorher404 = fehlerAufSeite.length;
    const { kontext, seite } = await mitTurnieren(`/${HERBST.toUpperCase()}/`);
    await seite.waitForFunction(() => /Herbstcup/.test(document.querySelector("[data-turnier]")?.textContent || ""), null, { timeout: 8000 })
      .catch(() => {});
    const wo = new URL(seite.url());
    pruefe(wo.pathname === "/turnier" && wo.searchParams.get("t") === HERBST,
      `Der eigene Link /${HERBST.toUpperCase()}/ führt nach ${seite.url()} statt zum Turnier.`);
    pruefe(/Herbstcup/.test(await seite.locator("[data-turnier]").innerText()), "Über den eigenen Link steht das Turnier nicht da.");
    pruefe(await seite.evaluate((id) => window.LernappTurnier.volleAdresse(id), HERBST) === `${BASIS}/turnier?t=${HERBST}`
      && await seite.evaluate(() => window.LernappTurnier.volleAdresse("hotdog")) === `${BASIS}/hotdog`
      && await seite.evaluate(() => window.LernappTurnier.seitenLink("hotdog")) === "/turnier?t=hotdog",
      "Der Link zum Weitergeben ist für einen automatischen Link nicht der lange oder für einen eigenen nicht der kurze.");

    await seite.goto(`${BASIS}/Turmbau`, { waitUntil: "load" });
    await seite.waitForURL((u) => u.pathname === "/turmbau", { timeout: 5000 }).catch(() => {});
    pruefe(new URL(seite.url()).pathname === "/turmbau", `/Turmbau führt nach ${seite.url()} statt zum Spiel.`);

    const antwort = await seite.goto(`${BASIS}/gibt/es/nicht`, { waitUntil: "load" });
    pruefe(antwort?.status() === 404, `Eine Adresse, die es nicht gibt, antwortet mit ${antwort?.status()} statt 404.`);
    const nichts = await seite.evaluate(() => ({
      titel: document.querySelector(".ar-weiter-titel")?.textContent || "",
      sichtbar: getComputedStyle(document.querySelector(".ar-weiter")).visibility,
      weg: document.querySelector(".ar-weiter a.mini-knopf")?.getAttribute("href"),
    }));
    pruefe(/nichts/.test(nichts.titel) && nichts.sichtbar === "visible" && nichts.weg === "/",
      `Wo es nichts gibt, steht nicht «nicht gefunden» mit dem Weg zu den Spielen: ${JSON.stringify(nichts)}`);
    const ohne = await klassenOhneRegel(seite);
    pruefe(ohne.length === 0, `Die Seite «nicht gefunden» – Klassen ohne Regel: ${ohne.join(", ")}`);
    await kontext.close();
    const hier = fehlerAufSeite.splice(vorher404);
    fehlerAufSeite.push(...hier.filter((text) => !/status of 404/.test(text)));
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
    // Gezählt ist der Versuch hier sofort, angemeldet einen Augenblick
    // später: Gelesen wird erst, wenn die Anmeldung angekommen ist.
    await seite.waitForFunction((id) => window.__miniTurnierEintraege?.get(`${id}/numberLine_${localStorage.getItem("mini.id")}`)?.versuche === 2, HERBST, { timeout: 4000 }).catch(() => {});
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

  // --- 4f3. Ein Abend im Keller: Turnier mit schlechtem Netz -----------------------
  // Sechs Geräte, ein schwaches WLAN: Das Gerät ist «online», aber die
  // Datenbank antwortet nicht (window.__miniOhneNetz). Wer das Turnier einmal
  // geöffnet hat, spielt trotzdem – sofort, ohne «wird geladen». Die Runde
  // wartet im Postausgang, steht schon in der Liste des Geräts und kommt ins
  // Turnier, sobald die Datenbank wieder antwortet.
  {
    const { kontext, seite } = await mitTurnieren(`/turnier?t=${DAUER}`, { vorher: () => localStorage.setItem("mini.name", "Keller") });
    const vorher = fehlerAufSeite.length;
    await seite.waitForSelector(".ar-kachel", { timeout: 8000 });
    const gemerkt = await seite.evaluate((id) => Boolean(JSON.parse(localStorage.getItem("mini.turnier.stand") || "{}")[id]?.t), DAUER);
    pruefe(gemerkt, "Die Turnierseite merkt sich das Turnier nicht auf dem Gerät.");
    await seite.addInitScript(() => { window.__miniOhneNetz = true; });
    const los = Date.now();
    await seite.goto(`${BASIS}/turmbau?turnier=${DAUER}`, { waitUntil: "load" });
    await seite.waitForFunction(() => window.LernappTurnier?.stand?.().freigegeben, null, { timeout: 4000 }).catch(() => {});
    const bereit = await seite.evaluate(() => ({ frei: window.LernappTurnier.stand().freigegeben, tor: Boolean(document.querySelector(".tn-tor")) }));
    pruefe(bereit.frei && !bereit.tor && Date.now() - los < 4000, `Ohne Antwort der Datenbank lässt das Turnier nicht gleich spielen: ${JSON.stringify(bereit)}`);
    pruefe(await spieleZuEnde(seite), "Die Runde ohne Netz kam zu keinem Ergebnis.");
    await seite.waitForFunction(() => /Gespeichert/.test(document.querySelector(".tn-ergebnis .mini-meldung")?.textContent || ""), null, { timeout: 6000 }).catch(() => {});
    const imKeller = await seite.evaluate((id) => {
      const ich = localStorage.getItem("mini.id");
      return {
        punkte: window.LernappTurmbau?.state?.punkte,
        meldung: document.querySelector(".tn-ergebnis .mini-meldung")?.textContent || "",
        liste: document.querySelector(".tn-ergebnis .mini-liste")?.textContent || "",
        post: JSON.parse(localStorage.getItem("mini.turnier.post") || "[]"),
        draussen: window.__miniTurnierEintraege.get(`${id}/towerStack_${ich}`) || null,
      };
    }, DAUER);
    pruefe(/Gespeichert/.test(imKeller.meldung) && /Keller/.test(imKeller.liste) && !imKeller.draussen
      && imKeller.post.length === 1 && imKeller.post[0].punkte === imKeller.punkte,
      `Ohne Netz wartet die Runde nicht auf dem Gerät: ${JSON.stringify(imKeller)}`);
    // Zurück im Turnier, immer noch ohne Antwort: Es steht sofort da, aus dem
    // Gedächtnis, mit der eigenen Runde vorne – und oben «wird hochgeladen».
    await seite.goto(`${BASIS}/turnier?t=${DAUER}`, { waitUntil: "load" });
    await seite.waitForSelector(".tn-wertung", { timeout: 3000 }).catch(() => {});
    const seiteImKeller = await seite.evaluate(() => ({
      wertung: document.querySelector(".tn-wertung")?.textContent || "",
      laedt: /wird geladen/.test(document.querySelector("[data-turnier]")?.textContent || ""),
      zeichen: document.querySelector(".ar-offline:not([hidden])")?.textContent || "",
    }));
    pruefe(/Keller/.test(seiteImKeller.wertung) && !seiteImKeller.laedt && /hochgeladen/.test(seiteImKeller.zeichen),
      `Ohne Antwort der Datenbank zeigt die Turnierseite nicht, was das Gerät weiss: ${JSON.stringify(seiteImKeller)}`);
    // Die Datenbank antwortet wieder: Die Runde kommt ins Turnier, genau einmal.
    await seite.evaluate(() => { window.__miniOhneNetz = false; window.dispatchEvent(new Event("online")); });
    await seite.waitForFunction(() => !JSON.parse(localStorage.getItem("mini.turnier.post") || "[]").length, null, { timeout: 8000 }).catch(() => {});
    const draussen = await seite.evaluate((id) => {
      const ich = localStorage.getItem("mini.id");
      return { eintrag: window.__miniTurnierEintraege.get(`${id}/towerStack_${ich}`) || null, post: localStorage.getItem("mini.turnier.post") };
    }, DAUER);
    pruefe(draussen.eintrag?.versuche === 1 && draussen.eintrag?.offen === false && draussen.eintrag?.punkte === imKeller.punkte && !draussen.post,
      `Zurück im Netz kam die Runde nicht (genau einmal) ins Turnier: ${JSON.stringify(draussen)}`);
    pruefe(fehlerAufSeite.length === vorher, `Turnier mit schlechtem Netz – die Seite hat sich beschwert: ${fehlerAufSeite.slice(vorher).join(" / ")}`);
    await kontext.close();
  }
  {
    // Wer das Turnier noch nie gesehen hat und keine Antwort bekommt, sieht
    // «wird geladen» – und die Seite versucht es von selbst weiter, statt
    // «nicht zu haben» zu sagen und stehen zu bleiben.
    const { kontext, seite } = await mitTurnieren(`/turnier?t=${HERBST}`, { vorher: () => { if (!sessionStorage.getItem("__einmal")) { sessionStorage.setItem("__einmal", "1"); window.__miniOhneNetz = true; } } });
    await seite.waitForTimeout(1000);
    const zuerst = await seite.evaluate(() => document.querySelector("[data-turnier]")?.textContent || "");
    pruefe(/wird geladen/.test(zuerst) && !/nicht zu haben/.test(zuerst), `Ohne Antwort steht beim ersten Besuch: ${zuerst}`);
    await seite.evaluate(() => { window.__miniOhneNetz = false; });
    await seite.waitForSelector(".ar-kachel", { timeout: 10000 }).catch(() => {});
    pruefe(await seite.locator(".ar-kachel").count() > 0, "Kommt die Antwort später, lädt die Turnierseite nicht von selbst weiter.");
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
        + " | " + w.ereignisse.slice(0, 8).map((b) => `${b.art}${Math.round(b.x0)}-${Math.round(b.x1)}:${b.dir}:${Math.round(b.G * 100)}`).join(" ");
    }],
    ["/kranhafen", "Kranhafen", () => {
      const p = window.LernappKranhafen.plan();
      return JSON.stringify({
        schiffe: p.schiffe.slice(0, 8).map((s) => [s.art, s.platz, Math.round(s.weite * 100), Math.round(s.periode * 1000), Math.round(s.wind * 1000),
          s.spalten.map((sp) => `${sp.x}/${sp.soll}/${sp.farbe}`).join(","), (s.farben || []).join(""), s.zeit || 0]),
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
    // Die mit neuen Mechaniken: Jedes beschreibt seine gewürfelte Welt
    // selbst (weltText) – dieselbe Saat, derselbe Text.
    ["/jongleur", "Jongleur", () => window.LernappJongleur.weltText()],
    ["/turmspringen", "Turmspringen", () => window.LernappTurmspringen.weltText()],
    ["/fallschirm", "Fallschirm", () => window.LernappFallschirm.weltText()],
    ["/holzfaeller", "Holzfäller", () => window.LernappHolzfaeller.weltText()],
    ["/fledermaus", "Fledermaus", () => window.LernappFledermaus.weltText()],
    ["/ninja", "Zeitlupen-Ninja", () => window.LernappNinja.weltText()],
    ["/freitaucher", "Freitaucher", () => window.LernappFreitaucher.weltText()],
    ["/schwarm", "Schwarm", () => window.LernappSchwarm.weltText()],
    ["/welle", "Die Welle", () => window.LernappWelle.weltText()],
    ["/steinhuepfer", "Steinhüpfer", () => window.LernappSteinhuepfer.weltText()],
    ["/eiskanal", "Eiskanal", () => window.LernappEiskanal.weltText()],
    ["/felsflug", "Felsflug", () => window.LernappFelsflug.weltText()],
    ["/hammerwurf", "Hammerwurf", () => window.LernappHammerwurf.weltText()],
    ["/entenfamilie", "Entenfamilie", () => window.LernappEntenfamilie.weltText()],
    ["/grubenlore", "Höhlenfahrt", () => window.LernappGrubenlore.weltText()],
    ["/rotoren", "Zwei Rotoren", () => window.LernappRotoren.weltText()],
    ["/augenmass", "Augenmass", () => window.LernappAugenmass.weltText()],
    ["/feuerseil", "Feuerseil", () => window.LernappFeuerseil.weltText()],
    ["/flaggen", "Flaggenkommando", () => window.LernappFlaggen.weltText()],
    ["/zeitgefuehl", "Zeitgefühl", () => window.LernappZeitgefuehl.weltText()],
    ["/kletterwand", "Kletterwand", () => window.LernappKletterwand.weltText()],
    ["/freihand", "Freihand", () => window.LernappFreihand.weltText()],
    ["/kopfkino", "Kopfkino", () => window.LernappKopfkino.weltText()],
    ["/eisstock", "Eisstock", () => window.LernappEisstock.weltText()],
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
  // Sauerstoff ausgeht. Ein genauer, der auf die Mitte wartet, holt mit den
  // Volltreffern deutlich mehr je Planet. Wer gar nicht springt, dem geht
  // der Sauerstoff aus.
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
    const kette = await seite.evaluate(() => window.LernappPlaneten.KETTE_MAX);
    pruefe(wege.every((w) => w.punkte >= w.erreicht && w.punkte <= w.erreicht * (1 + kette)),
      `Planetenhüpfer: Ein Planet bringt nicht zwischen 1 und ${1 + kette} Punkten – ${JSON.stringify(wege)}`);
    // Wer mitten trifft, holt mehr: derselbe Autopilot, der nur springt, wenn
    // der Sprung auf die Mitte des nächsten Planeten zielt (und erst knapp
    // vor dem Ende des Sauerstoffs jeden Sprung nimmt, der trägt).
    const genau = await seite.evaluate(() => {
      const P = window.LernappPlaneten;
      const st = P.state;
      const voraus = () => {
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
            if (mond && Math.hypot(x - mond.x, y - mond.y) < mond.r + 5) return null;
            if (i === st.auf && t < 0.45) continue;
            const m = P.mitte(p, uhr);
            if (Math.hypot(x - m.x, y - m.y) < p.r + p.luft) {
              if (i !== st.auf + 1) return null;
              const vorbei = Math.abs((x - m.x) * tg.y - (y - m.y) * tg.x);
              return { tief: Math.hypot(x - m.x, y - m.y) < p.r + p.luft * 0.6 || vorbei < p.r * 0.5, voll: vorbei < (p.r + p.luft) * P.VOLL * 0.7 };
            }
          }
        }
        return null;
      };
      const raus = [];
      for (let lauf = 0; lauf < 2; lauf += 1) {
        document.querySelector(".cm-bar-left .cm-icon-again").click();
        P.tippen();
        for (let n = 0; st.schritt !== "verloren" && st.erreicht < 20 && n < 200000; n += 1) {
          if (st.schritt === "lauf" && st.zeit - st.schrittZeit > 0.2) {
            const b = voraus();
            if (b && (b.voll || (b.tief && st.luft / st.luftMax < 0.2))) P.tippen();
          }
          P.takt(1 / 240);
        }
        raus.push({ erreicht: st.erreicht, punkte: st.punkte, volltreffer: st.volltreffer, beste: st.besteFolge, schritt: st.schritt });
      }
      return raus;
    });
    const vorsichtig = wege.reduce((summe, w) => summe + w.punkte / w.erreicht, 0) / wege.length;
    const mitte = genau.reduce((summe, w) => summe + w.punkte / Math.max(1, w.erreicht), 0) / genau.length;
    pruefe(genau.every((w) => w.erreicht >= 20 && w.volltreffer >= 10 && w.beste >= 3) && mitte > vorsichtig + 1,
      `Planetenhüpfer: Wer mitten trifft, holt nicht deutlich mehr (${mitte.toFixed(2)} gegen ${vorsichtig.toFixed(2)} je Planet) – ${JSON.stringify(genau)}`);
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

    // Die Punkte: ein Tor eins, das erste perfekte zwei, jedes weitere
    // perfekte in Folge drei – bis eines nicht perfekt ist. Ein zweiter
    // Autopilot zielt dafür knapp an die innere Stange (wie die Vorführung)
    // und verpasst ab und zu absichtlich das goldene Stück.
    const wertung = await seite.evaluate(() => {
      const S = window.LernappSlalom;
      document.querySelector(".cm-bar-left .cm-icon-again").click();
      const st = S.state;
      const sk = st.sk;
      const rand = S.R_STANGE + S.R_FAHRER;
      S.lenke(1);
      for (let n = 0; st.schritt === "fahrt" && st.tore < 40 && n < 200000; n += 1) {
        const tore = st.kurs.tore;
        const i = tore.findIndex((q) => q.zustand === "offen" && q.y > sk.y);
        const t = tore[i];
        const stange = t.innen < 0 ? S.stangeL(t) : S.stangeR(t);
        // Jedes fünfte Tor mitten durch, sonst nah an die innere Stange.
        const ziel = i % 5 === 4 ? t.x : stange - t.innen * (rand + Math.max(7, t.breite * 0.26) * 0.5);
        const soll = Math.atan2(ziel - sk.x, Math.max(1, t.y - sk.y));
        S.lenke(soll > sk.phi + sk.w * 0.05 ? 1 : -1);
        S.takt(1 / 120);
      }
      S.lenke(0);
      let reihe = 0;
      let erwartet = 0;
      for (const t of st.kurs.tore) {
        if (t.zustand === "perfekt") { reihe += 1; erwartet += reihe >= 2 ? 3 : 2; }
        else if (t.zustand === "durch") { reihe = 0; erwartet += 1; }
      }
      return { tore: st.tore, bonus: st.bonus, punkte: st.punkte, erwartet, perfekte: st.perfekte, zaehler: document.querySelector(".cm-count-value")?.textContent };
    });
    pruefe(wertung.tore >= 20 && wertung.perfekte >= 5 && wertung.bonus > 0 && wertung.punkte === wertung.erwartet
      && wertung.punkte === wertung.tore + wertung.bonus && wertung.zaehler === String(wertung.punkte),
      `Slalom: Die Punkte stimmen nicht mit «1 – perfekt 2 – in Folge 3»: ${JSON.stringify(wertung)}`);
    await seite.evaluate(() => document.querySelector(".cm-bar-left .cm-icon-again").click());
    await seite.evaluate(() => { window.LernappSlalom.lenke(1); window.LernappSlalom.lenke(0); });
    await seite.waitForSelector(".cm-result-score", { timeout: 12000 }).catch(() => {});
    const ende = await seite.evaluate(() => ({ zahl: document.querySelector(".cm-result-score")?.textContent, schritt: window.LernappSlalom.state.schritt, grund: window.LernappSlalom.state.sturz?.grund }));
    pruefe(ende.schritt === "sturz" && ende.zahl !== undefined,
      `Slalom: Ohne Eingabe endet die Runde nicht: ${JSON.stringify(ende)}`);
    const tafel = await seite.evaluate(() => document.querySelector(".sk-aufstellung")?.textContent || "");
    pruefe(/^\d+ Tore?\+ \d+ Bonus= \d+$/.test(tafel), `Slalom: Auf der Tafel steht nicht «Tore + Bonus = Punkte»: «${tafel}»`);

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

  // --- 4g12. Seiltänzer: immer zu halten, und jede Störung wirft, wer nichts tut ------
  // Ein Autopilot, der nur Neigung und Drehung sieht (links halten, wenn er
  // nach rechts kippt, rechts, wenn nach links, sonst nichts) – und einen
  // Vogel, der ihn gleich rammt, so dass er sich kurz vorher hineinlehnt –,
  // geht auf mehreren gewürfelten Seilen bis 1500 m: Fällt er, hat eine
  // Störung mehr verlangt, als die Stange kann. Unterwegs kommen alle drei
  // Arten – Böen, Vögel auf der Stange, Vögel, die ihn rammen – und keine
  // andere, keine drückt stärker als ihr Deckel, jede, die drückt, wirft
  // einen um, der nicht gegenhält (eine Böe auch lang genug: nachgerechnet),
  // und hinten kommen Doppelböen und Vogelpaare; wer so genau gegenhält,
  // pariert sie alle. Früh wird es ernst: die erste Böe nach
  // wenigen Sekunden, der erste Vogel vor der achten, und in der ersten
  // halben Minute ein Dutzend Störungen. Wer nach dem Start nichts mehr tut,
  // wirft die erste Böe ins Netz – das ist das Ende, mit Ergebnis. Wer einen
  // Vogel auf der Stange nicht ausgleicht, kippt zu ihm hin. Und wer zu lange
  // auf einer Seite hält, kippt dorthin.
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
        T.lehnen(1);
        T.lehnen(0);
        let schiefst = 0;
        for (let n = 0; st.schritt === "lauf" && st.meter < 1500 && n < 400000; n += 1) {
          const kippt = st.l.th + 0.35 * st.l.w;
          let r = kippt > 0.03 ? -1 : kippt < -0.03 ? 1 : 0;
          const kommt = st.welt.ereignisse.find((e) => e.art === "ramme" && e.x0 > st.l.x && (e.x0 - st.l.x) / st.l.v < 0.2);
          if (kommt) r = -kommt.dir;
          T.lehnen(r);
          T.takt(1 / 120);
          schiefst = Math.max(schiefst, Math.abs(st.l.th));
        }
        T.lehnen(0);
        T.weltBis(20000);
        const alle = st.welt.ereignisse;
        const druecken = alle.filter((e) => e.art !== "ramme");
        const zuStark = druecken.filter((e) => e.G > T.STANGE - T.BOE_RESERVE + 1e-9).length;
        const zuSchwach = druecken.filter((e) => e.G <= T.AUFRICHT * Math.sin(T.KIPP_MAX)).length;
        // Eine Böe, nachgerechnet: Wer nicht gegenhält, fällt.
        const kurz = alle.filter((e) => e.art === "boe").filter((e) => {
          const dauer = (e.x1 - e.x0) / T.tempoBei(e.x0);
          const c = T.daempf(T.schwereBei(e.x0));
          let th = 0;
          let w = 0;
          for (let t = 0; t < dauer + 1; t += 1 / 240) {
            const s = t < dauer ? Math.sin(Math.PI * t / dauer) : 0;
            w += (-T.AUFRICHT * Math.sin(th) - c * w + e.G * s * s) / 240;
            th += w / 240;
            if (th > T.KIPP_MAX) return false;
          }
          return true;
        }).length;
        const rammen = alle.filter((e) => e.art === "ramme");
        const ruckFalsch = rammen.filter((e) => e.G < 1.4 || e.G > 2).length;
        const arten = [...new Set(alle.map((e) => e.art))].sort().join(",");
        const doppelt = alle.filter((e) => e.doppelt).length;
        const paare = alle.filter((e) => e.art === "vogel" && e.voegel.length === 2).length;
        const sekunde = (e) => e.x0 / T.tempoBei(e.x0);
        const frueh = { boe: sekunde(alle[0]), vogel: sekunde(alle.find((e) => e.art === "vogel")), dreissig: alle.filter((e) => sekunde(e) < 30).length, ersteArt: alle[0].art };
        raus.push({ meter: st.meter, schritt: st.schritt, schiefst: Math.round(schiefst * 100), zuStark, zuSchwach, kurz, ruckFalsch, arten, doppelt, paare, pariert: st.ruheN, frueh });
      }
      return raus;
    });
    pruefe(laeufe.every((l) => l.meter >= 1500 && l.schritt === "lauf" && l.zuStark === 0 && l.zuSchwach === 0 && l.kurz === 0 && l.ruckFalsch === 0
      && l.arten === "boe,ramme,vogel" && l.doppelt > 3 && l.paare > 2 && l.pariert > 20),
      `Seiltänzer: Der Autopilot hält nicht auf jedem Seil das Gleichgewicht, oder die Störungen stimmen nicht – ${JSON.stringify(laeufe)}`);
    pruefe(laeufe.every((l) => l.frueh.ersteArt === "boe" && l.frueh.boe < 4 && l.frueh.vogel < 8 && l.frueh.dreissig >= 10),
      `Seiltänzer: Es wird nicht früh genug ernst – ${JSON.stringify(laeufe.map((l) => l.frueh))}`);
    // Schwer wird es trotzdem: Derselbe Pilot, der erst nach gut einer
    // Viertelsekunde reagiert, fällt auf jedem Seil früh – vor 300 m.
    const traege = await seite.evaluate(() => {
      const T = window.LernappSeiltaenzer;
      const st = T.state;
      const raus = [];
      for (let lauf = 0; lauf < 3; lauf += 1) {
        document.querySelector(".cm-bar-left .cm-icon-again").click();
        T.lehnen(1);
        T.lehnen(0);
        const gesehen = [];
        for (let n = 0; st.schritt === "lauf" && st.meter < 1500 && n < 400000; n += 1) {
          gesehen.push(st.l.th + 0.35 * st.l.w);
          const kippt = gesehen.length > 34 ? gesehen[gesehen.length - 35] : 0;
          T.lehnen(kippt > 0.05 ? -1 : kippt < -0.05 ? 1 : 0);
          T.takt(1 / 120);
        }
        T.lehnen(0);
        raus.push({ meter: st.meter, schritt: st.schritt });
      }
      return raus;
    });
    pruefe(traege.every((l) => l.schritt === "sturz" && l.meter < 300),
      `Seiltänzer: Wer träge gegenhält, kommt trotzdem weit – ${JSON.stringify(traege)}`);
    const ohne = await seite.evaluate(() => {
      const T = window.LernappSeiltaenzer;
      const st = T.state;
      document.querySelector(".cm-bar-left .cm-icon-again").click();
      T.lehnen(1);
      T.lehnen(0);
      const erste = st.welt.ereignisse[0];
      for (let n = 0; st.schritt === "lauf" && n < 120 * 60; n += 1) T.takt(1 / 120);
      return { schritt: st.schritt, gekippt: st.gekippt, grund: st.sturzGrund, art: erste.art, dir: erste.dir, vorErsterBoe: st.l.x < erste.x0, meter: st.meter };
    });
    pruefe(ohne.schritt === "sturz" && ohne.art === "boe" && ohne.gekippt === ohne.dir && ohne.grund === "boe" && !ohne.vorErsterBoe && ohne.meter < 20,
      `Seiltänzer: Ohne Eingabe wirft ihn nicht die erste Böe: ${JSON.stringify(ohne)}`);
    await seite.waitForSelector(".cm-result-score", { timeout: 8000 }).catch(() => {});
    pruefe(await seite.locator(".cm-result-score").count() === 1, "Seiltänzer: Nach dem Sturz kommt kein Ergebnis.");
    // Ein Vogel auf der Stange: Wer ihn nicht ausgleicht, kippt zu ihm hin.
    const vogel = await seite.evaluate(() => {
      const T = window.LernappSeiltaenzer;
      const st = T.state;
      document.querySelector(".cm-bar-left .cm-icon-again").click();
      T.lehnen(1);
      T.lehnen(0);
      T.weltBis(4000);
      const e = st.welt.ereignisse.find((q) => q.art === "vogel");
      for (let n = 0; st.schritt === "lauf" && st.l.x < e.x0 - 2 && n < 120 * 60; n += 1) {
        const kippt = st.l.th + 0.35 * st.l.w;
        T.lehnen(kippt > 0.03 ? -1 : kippt < -0.03 ? 1 : 0);
        T.takt(1 / 120);
      }
      T.lehnen(0);
      const vorher = st.schritt;
      for (let n = 0; st.schritt === "lauf" && st.l.x < e.x1 && n < 120 * 30; n += 1) T.takt(1 / 120);
      return { vorher, schritt: st.schritt, gekippt: st.gekippt, seite: e.voegel[0].seite, grund: st.sturzGrund, vorAbflug: st.l.x < e.voegel[0].ab };
    });
    pruefe(vogel.vorher === "lauf" && vogel.schritt === "sturz" && vogel.gekippt === vogel.seite && vogel.grund === "vogel" && vogel.vorAbflug,
      `Seiltänzer: Wer den Vogel auf der Stange nicht ausgleicht, kippt nicht zu ihm hin: ${JSON.stringify(vogel)}`);
    const zuLange = await seite.evaluate(() => {
      const T = window.LernappSeiltaenzer;
      const st = T.state;
      document.querySelector(".cm-bar-left .cm-icon-again").click();
      T.lehnen(1);
      for (let n = 0; st.schritt === "lauf" && n < 120 * 10; n += 1) T.takt(1 / 120);
      T.lehnen(0);
      return { schritt: st.schritt, gekippt: st.gekippt, grund: st.sturzGrund, meter: st.meter };
    });
    pruefe(zuLange.schritt === "sturz" && zuLange.gekippt === 1 && zuLange.grund === "gehalten",
      `Seiltänzer: Wer rechts hält und nicht loslässt, kippt nicht nach rechts: ${JSON.stringify(zuLange)}`);
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

  // --- 4g15. Kranhafen: jeder Auftrag schaffbar, und ein Fehlwurf beendet die Runde --
  // Jedes Schiff bringt einen Auftrag, schon das erste: Jeder der fünf
  // kommt einmal (Hochhaus, Treppe, Sortieren, Eilfracht, Gefahrgut), dann
  // ein Schiff zum Durchatmen, das nur gestapelt werden will, wieder alle.
  // Ist das erste Schiff eine Eilfracht, läuft ihre Uhr erst ab dem ersten
  // Tipp. Ein Autopilot spielt
  // mehrere gewürfelte Häfen über vierzehn Schiffe: Er lässt los, wenn der
  // Container perfekt auf einem Platz landen würde, auf den er gehört
  // (vorhersage). Findet er acht Sekunden lang keinen Augenblick dafür,
  // verlangt der Hafen mehr, als ein Kind kann. Er erfüllt jeden Auftrag
  // makellos – die Eilfracht in ihrer Zeit – und bekommt jedes Mal den
  // Bonus. Ein ungenauer, der nach einer Sekunde nimmt, was nicht knapp ist,
  // erfüllt ebenso jeden Auftrag, nur nicht jeden makellos – auch beim
  // Sortieren, wo die Zellführungen die Stapel gerade halten. Wer beim Sortieren
  // einen Container auf die falsche Farbe stellt, verpatzt den Auftrag
  // (kein Bonus), spielt aber weiter; eine Eilfracht, die man verstreichen
  // lässt, legt halbvoll ab. Perfekt zählt doppelt bis vierfach. Und wer
  // danebenwirft, sieht den Container ins Wasser gehen – das Ende, mit
  // Ergebnis.
  {
    const { kontext, seite } = await neueSeite({ width: 1000, height: 640 });
    await seite.goto(`${BASIS}/kranhafen`, { waitUntil: "load" });
    await seite.waitForFunction(() => window.LernappKranhafen?.state, null, { timeout: 8000 });
    const spielen = (modus, laeufe) => seite.evaluate(({ modus, laeufe }) => {
      const K = window.LernappKranhafen;
      const raus = [];
      for (let lauf = 0; lauf < laeufe; lauf += 1) {
        document.querySelector(".cm-bar-left .cm-icon-again").click();
        const st = K.state;
        const auftraege = [];
        let sch = null;
        let punkteVorher = 0;
        let warten = 0;
        let laengste = 0;
        let falsch = false;
        for (let n = 0; n < 2000000 && st.phase !== "ende" && st.schiffNr < 14; n += 1) {
          if (st.schiff !== sch) {
            if (sch) auftraege.push({ art: sch.plan.art, kisten: sch.kisten, platz: sch.plan.platz, verpatzt: sch.verpatzt, makellos: sch.makellos, bonus: st.punkte - punkteVorher });
            sch = st.schiff;
          }
          const art = st.schiff.plan.art;
          const v = K.vorhersage();
          if (modus === "lassen" && art === "eilfracht") { K.takt(1 / 120); continue; }
          if (v) {
            warten += 1 / 120;
            let gut = v.passt && !v.daneben && (v.perfekt || (modus !== "genau" && warten > 1 && !v.knapp));
            // Beim Sortieren gibt es immer einen falschen Platz.
            const mehr = art === "sortieren";
            if (modus === "falsch" && mehr && !falsch) gut = !v.daneben && !v.passt && !v.knapp;
            if (gut) {
              if (modus === "falsch" && mehr && !falsch) falsch = true;
              laengste = Math.max(laengste, warten);
              warten = 0;
              punkteVorher = st.punkte;
              K.druecken();
            }
          }
          if (warten > 8) break;
          K.takt(1 / 120);
        }
        raus.push({ phase: st.phase, schiffe: st.schiffNr, kisten: st.kisten, punkte: st.punkte, laengste: Math.round(Math.max(laengste, warten) * 10) / 10, auftraege });
      }
      return raus;
    }, { modus, laeufe });
    // Der Bonus kommt mit dem letzten Container eines Schiffs: Was dieser
    // Tipp brachte, ist sein Wert (1 bis 4) und der Bonus (5 oder 10).
    const bonusVon = (a) => (a.bonus >= 5 ? a.bonus : 0);
    const genau = await spielen("genau", 4);
    const folgeOk = genau.every((l) => {
      const arten = l.auftraege.map((a) => a.art);
      const runde = (von) => new Set(arten.slice(von, von + 5)).size === 5 && !arten.slice(von, von + 5).includes("stapeln");
      return runde(0) && arten[5] === "stapeln" && runde(6);
    });
    pruefe(folgeOk, `Kranhafen: Die Aufträge kommen nicht von Anfang an jeder einmal, dann ein Schiff zum Stapeln – ${JSON.stringify(genau.map((l) => l.auftraege.map((a) => a.art)))}`);
    // Die Eilfracht als erstes Schiff: Vor dem ersten Tipp steht ihre Uhr.
    const ersteEil = await seite.evaluate(() => {
      const K = window.LernappKranhafen;
      const st = K.state;
      for (let n = 0; n < 200 && st.schiff.plan.art !== "eilfracht"; n += 1) document.querySelector(".cm-bar-left .cm-icon-again").click();
      if (st.schiff.plan.art !== "eilfracht") return null;
      for (let n = 0; n < 120 * 30; n += 1) K.takt(1 / 120);
      const vorher = { phase: st.phase, rest: st.schiff.frist - st.uhr };
      K.druecken();
      return { vorher, nachher: Math.round((st.schiff.frist - st.uhr) * 100) / 100, zeit: st.schiff.plan.zeit, phase: st.phase };
    });
    pruefe(ersteEil && ersteEil.vorher.phase === "bereit" && ersteEil.phase === "spiel" && Math.abs(ersteEil.nachher - ersteEil.zeit) < 0.05,
      `Kranhafen: Die Uhr einer Eilfracht als erstes Schiff läuft schon vor dem ersten Tipp: ${JSON.stringify(ersteEil)}`);
    pruefe(genau.every((l) => l.phase === "spiel" && l.schiffe >= 14 && l.laengste <= 8),
      `Kranhafen: Der Autopilot kommt nicht auf jedem Hafen durch vierzehn Schiffe – ${JSON.stringify(genau.map((l) => ({ ...l, auftraege: undefined })))}`);
    const auftragGenau = genau.flatMap((l) => l.auftraege.filter((a) => a.art !== "stapeln"));
    pruefe(auftragGenau.length >= 40 && auftragGenau.every((a) => !a.verpatzt && a.makellos && a.kisten === a.platz && a.bonus >= 10),
      `Kranhafen: Ein genauer Autopilot erfüllt nicht jeden Auftrag makellos, mit Bonus: ${JSON.stringify(auftragGenau.filter((a) => a.verpatzt || !a.makellos || a.bonus < 10).slice(0, 4))}`);
    pruefe(genau.every((l) => l.punkte >= l.kisten * 3), `Kranhafen: Perfekt zählt nicht mehrfach: ${JSON.stringify(genau.map((l) => [l.kisten, l.punkte]))}`);
    const ungenau = await spielen("ungenau", 3);
    const auftragUngenau = ungenau.flatMap((l) => l.auftraege.filter((a) => a.art !== "stapeln"));
    pruefe(ungenau.every((l) => l.phase === "spiel" && l.schiffe >= 14) && auftragUngenau.every((a) => !a.verpatzt && a.kisten === a.platz)
      && auftragUngenau.some((a) => !a.makellos),
      `Kranhafen: Ein ungenauer Autopilot erfüllt nicht jeden Auftrag (oder alle makellos): ${JSON.stringify(ungenau.map((l) => ({ ...l, auftraege: l.auftraege.map((a) => `${a.art}${a.verpatzt ? "✗" : a.makellos ? "★" : "✓"}`).join(" ") })))}`);
    const falsch = await spielen("falsch", 2);
    pruefe(falsch.every((l) => l.phase === "spiel" && l.schiffe >= 14 && l.auftraege.filter((a) => a.verpatzt).length === 1
      && l.auftraege.filter((a) => a.verpatzt).every((a) => a.art === "sortieren" && bonusVon(a) === 0 && a.kisten === a.platz)),
      `Kranhafen: Ein falsch gestellter Container verpatzt nicht genau den einen Auftrag, oder die Runde endet: ${JSON.stringify(falsch.map((l) => l.auftraege.map((a) => `${a.art}${a.verpatzt ? "✗" : "✓"}${a.bonus}`).join(" ")))}`);
    const lassen = await spielen("lassen", 2);
    pruefe(lassen.every((l) => l.phase === "spiel" && l.schiffe >= 14 && l.auftraege.filter((a) => a.art === "eilfracht").every((a) => a.verpatzt && a.kisten === 0)),
      `Kranhafen: Eine Eilfracht, die man verstreichen lässt, legt nicht leer ab: ${JSON.stringify(lassen.map((l) => l.auftraege.filter((a) => a.art === "eilfracht")))}`);
    // Nichts darf hängen bleiben. Ein Container, der neben einem Stapel
    // tiefer fällt als dessen Unterkante – auch wenn ihn Wind gegen den
    // Stapel drückt –, ist daneben: Bis November 2026 prallte er dort noch
    // an den Containern darüber ab und fiel unsichtbar ewig weiter, und es
    // kam kein neuer. Fehlt der Container doch einmal, hängt sofort ein
    // neuer da (der Wächter); fällt einer zu lange, ist er daneben.
    const wache = await seite.evaluate(() => {
      const K = window.LernappKranhafen;
      const st = K.state;
      const raus = {};
      const bisZweiStehen = () => {
        document.querySelector(".cm-bar-left .cm-icon-again").click();
        for (let n = 0; n < 200000 && !(st.stapel.length >= 2 && st.kiste && !st.kiste.fallend && st.uhr - st.kiste.spawn > 0.5); n += 1) {
          const v = K.vorhersage();
          if (v && v.passt && v.perfekt) K.druecken();
          K.takt(1 / 120);
        }
      };
      for (const seite of [-1, 1]) {
        bisZweiStehen();
        const ob = st.stapel[st.stapel.length - 1];
        const x = K.schiffX(st.schiff, st.uhr) + ob.off + seite * 47;
        st.kiste.fallend = true;
        st.kiste.f = { x, y: K.spalteY(ob.spalte) - 3 * 20 - 10, vx: 0, vy: -100, aw: -seite * 1e5, uhr: st.uhr, los: st.uhr, neig: 0, wartet: false };
        for (let n = 0; n < 120 && st.phase !== "ende"; n += 1) K.takt(1 / 120);
        raus[`unter${seite}`] = st.phase;
      }
      bisZweiStehen();
      st.kiste = null;
      K.takt(1 / 120);
      raus.fehlt = Boolean(st.kiste) && !st.kiste.fallend && st.phase === "spiel";
      if (!st.kiste) return raus;
      st.kiste.spawn = st.uhr - 1;
      st.kiste.fallend = true;
      st.kiste.f = { x: 0, y: 1e7, vx: 0, vy: 0, aw: 0, uhr: st.uhr, los: st.uhr, neig: 0, wartet: false };
      for (let n = 0; n < 120 * 7 && st.phase !== "ende"; n += 1) K.takt(1 / 120);
      raus.ewig = st.phase;
      return raus;
    });
    pruefe(wache.unter1 === "ende" && wache["unter-1"] === "ende" && wache.fehlt && wache.ewig === "ende",
      `Kranhafen: Ein Container kann ewig fallen oder fehlen: ${JSON.stringify(wache)}`);
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
  // Ein Autopilot jongliert auf mehreren gewürfelten Welten: Er wirft jedes
  // Ding gleich nach dem Fang (im Fenster für «perfekt», einmal sofort, einmal
  // mit Streuung wie eine ruhige Hand) – durch alle Zugaben des Clowns bis zu
  // zehn Dingen, mit Keulen, Fackeln, Kugeln und Äpfeln. Wo er etwas fallen
  // lässt, verlangt das Spiel mehr, als perfektes Timing kann. Wer dagegen
  // immer zu spät wirft, bringt den Takt durcheinander und ist bald draussen.
  // Wer nach dem Start nichts tut, verliert – mit Ergebnis. Ein Tipp mit
  // leerer Hand ist ein Luftgriff, langes Halten wirft höher. Und eine Runde,
  // angeschaut aus der Hall of Fame, endet genau wie gespielt: gleich viele
  // Fänge, derselbe Zusammenstoss im selben Schritt.
  {
    const { kontext, seite } = await neueSeite({ width: 390, height: 844 });
    await seite.goto(`${BASIS}/jongleur`, { waitUntil: "load" });
    await seite.waitForFunction(() => window.LernappJongleur?.state && window.LernappJongleur.view.cssW > 0, null, { timeout: 8000 });
    const runden = await seite.evaluate(() => {
      const J = window.LernappJongleur;
      const raus = [];
      for (const art of ["sofort", "ruhig", "spaet"]) {
        for (let lauf = 0; lauf < (art === "spaet" ? 2 : 4); lauf += 1) {
          document.querySelector(".cm-bar-left .cm-icon-again").click();
          const st = J.state;
          const wann = new Map();
          let meiste = 0;
          const arten = new Set();
          J.tippe(0);
          for (let n = 0; st.phase === "spiel" && st.punkte < 260 && n < 240 * 240; n += 1) {
            for (const h of [0, 1]) {
              const d = J.dingVon(st.haende[h].ding);
              if (!d) continue;
              const k = `${d.id}|${d.fangTick}`;
              if (!wann.has(k)) {
                const streu = art === "sofort" ? 0 : art === "ruhig" ? Math.floor(Math.random() * (J.PERFEKT_NACH - 3)) : J.PERFEKT_NACH + 6 + Math.floor(Math.random() * 12);
                wann.set(k, streu);
              }
              if (d.start || st.tick - d.fangTick >= wann.get(k)) J.tippe(h);
            }
            meiste = Math.max(meiste, J.anzahlDinge());
            st.dinge.forEach((d) => arten.add(d.art));
            J.takt(1 / 240);
          }
          raus.push({ art, punkte: st.punkte, phase: st.phase, fehler: st.fehler?.art || null, meiste, arten: [...arten].sort().join(","), sekunden: Math.round(st.tick / 240) });
        }
      }
      return raus;
    });
    const gut = runden.filter((r) => r.art !== "spaet");
    pruefe(gut.every((r) => r.punkte >= 260 && r.phase === "spiel" && !r.fehler && r.meiste >= 9),
      `Jongleur: Der Autopilot hält mit perfektem Timing nicht jede Welt bis zu neun Dingen – ${JSON.stringify(gut)}`);
    pruefe(gut.some((r) => /keule|fackel|kugel|apfel/.test(r.arten)),
      `Jongleur: In keiner Welt kam ein besonderes Ding dazu – ${JSON.stringify(gut.map((r) => r.arten))}`);
    pruefe(runden.filter((r) => r.art === "spaet").every((r) => r.fehler && r.punkte < 200),
      `Jongleur: Wer immer zu spät wirft, bleibt trotzdem im Takt – ${JSON.stringify(runden.filter((r) => r.art === "spaet"))}`);

    // Ein Tipp mit leerer Hand ist ein Luftgriff: kein Wurf, und die Hand ist
    // kurz gesperrt. Lange gehalten, fliegt ein Wurf länger.
    const griffe = await seite.evaluate(() => {
      const J = window.LernappJongleur;
      document.querySelector(".cm-bar-left .cm-icon-again").click();
      const st = J.state;
      J.tippe(0);                       // links wirft – die linke Hand ist leer
      for (let n = 0; n < 20; n += 1) J.takt(1 / 240);
      J.tippe(0);                       // Luftgriff
      const gesperrt = st.haende[0].sperreBis > st.tick;
      const fliegend = st.dinge.filter((d) => d.ort === "flug").length;
      J.druecke(1);                     // rechts halten …
      for (let n = 0; n < J.H_VOLL + 12; n += 1) J.takt(1 / 240);
      const vorher = st.tick;
      J.loslassen(1);                   // … und hoch werfen
      const hoch = st.dinge.find((d) => d.ort === "flug" && d.von === 1);
      return { gesperrt, fliegend, punkte: st.punkte, hoch: hoch ? { flug: hoch.landTick - vorher, normal: J.flugTicks(st.punkte), istHoch: hoch.hoch } : null };
    });
    pruefe(griffe.gesperrt && griffe.fliegend === 1 && griffe.punkte === 0,
      `Jongleur: Ein Luftgriff wirft etwas oder sperrt die Hand nicht: ${JSON.stringify(griffe)}`);
    pruefe(griffe.hoch?.istHoch && griffe.hoch.flug > griffe.hoch.normal * 1.3,
      `Jongleur: Langes Halten wirft nicht höher: ${JSON.stringify(griffe.hoch)}`);

    // Ohne Eingabe: Mit der Leertaste beginnt die Runde, beide Hände halten
    // ihren Ball – zu lange. Und wer einmal wirft und dann nichts mehr tut,
    // bekommt den Ball in die volle Hand.
    for (const [wie, grund] of [["leertaste", "lange"], ["ein-wurf", "stoss"]]) {
      await seite.evaluate(() => document.querySelector(".cm-bar-left .cm-icon-again").click());
      if (wie === "leertaste") await seite.keyboard.press("Space");
      else await seite.keyboard.press("KeyA");
      await seite.waitForSelector(".cm-result-score", { timeout: 9000 }).catch(() => {});
      const ende = await seite.evaluate(() => ({
        zahl: document.querySelector(".cm-result-score")?.textContent,
        phase: window.LernappJongleur.state.phase,
        fehler: window.LernappJongleur.state.fehler?.art || null,
      }));
      pruefe(ende.phase === "ende" && ende.zahl !== undefined && ende.fehler === grund,
        `Jongleur: Ohne Eingabe (${wie}) endet die Runde nicht mit Ergebnis: ${JSON.stringify(ende)}`);
    }
    await kontext.close();
  }
  {
    // Die Runde Zug um Zug: gespielt im echten Takt (der Autopilot wirft im
    // Bildtakt nach jedem Fang, bis über die erste Zugabe des Clowns), dann
    // nichts mehr – der Zusammenstoss. Hinterlegt wird sie mit Saat und
    // Zügen; aus der Hall of Fame angeschaut, läuft genau dieselbe Runde ab.
    const { kontext, seite } = await neueSeite({ width: 420, height: 820 });
    await seite.addInitScript(() => {
      if (sessionStorage.getItem("__jongleur")) return;
      sessionStorage.setItem("__jongleur", "1");
      localStorage.setItem("mini.name", "Jule");
    });
    await seite.goto(`${BASIS}/jongleur`, { waitUntil: "load" });
    await seite.waitForFunction(() => window.LernappJongleur?.state && window.LernappJongleur.view.cssW > 0, null, { timeout: 8000 });
    await seite.evaluate(() => {
      const J = window.LernappJongleur;
      const st = J.state;
      J.tippe(0);
      const pilot = () => {
        if (st.phase !== "spiel") return;
        requestAnimationFrame(pilot);
        if (st.punkte >= 15) return;
        for (const h of [0, 1]) {
          if (J.dingVon(st.haende[h].ding)) J.tippe(h);
        }
      };
      requestAnimationFrame(pilot);
    });
    await seite.waitForSelector(".cm-result-score", { timeout: 30000 }).catch(() => {});
    await seite.waitForFunction(() => [...(window.__miniGeister?.keys?.() || [])].some((k) => k.startsWith("juggler_")), null, { timeout: 4000 }).catch(() => {});
    const runde = () => {
      const st = window.LernappJongleur.state;
      return { punkte: st.punkte, fehler: st.fehler ? `${st.fehler.art}/${st.fehler.hand}/${st.fehler.tick}` : null, zugaben: st.zugaben, perfekte: st.perfekte };
    };
    const gespielt = await seite.evaluate((quelle) => {
      const kennung = localStorage.getItem("mini.id");
      const geist = window.__miniGeister?.get(`juggler_${kennung}`) || null;
      let d = null;
      try { d = JSON.parse(geist?.bahn || "null"); } catch { d = null; }
      return { kennung, level: geist?.level, saat: d?.s ?? null, zuege: d?.z?.t?.length || 0, punkte: geist?.punkte || 0, runde: new Function(`return (${quelle})()`)() };
    }, runde.toString());
    pruefe(gespielt.kennung && gespielt.level === "z1" && Number.isInteger(gespielt.saat) && gespielt.zuege >= 10
      && gespielt.punkte === gespielt.runde.punkte && gespielt.runde.punkte >= 15 && /^stoss/.test(gespielt.runde.fehler || ""),
      `Jongleur: Die Runde wird nicht mit Zügen und Saat hinterlegt: ${JSON.stringify(gespielt)}`);
    await seite.goto(`${BASIS}/jongleur?zuschauen=${gespielt.kennung}`, { waitUntil: "load" });
    await seite.waitForFunction(() => window.LernappJongleur?.state?.phase === "zuschauen", null, { timeout: 8000 }).catch(() => {});
    const anfang = await seite.evaluate(() => ({
      phase: window.LernappJongleur.state.phase,
      leiste: document.querySelector(".gz-leiste")?.textContent || "",
      gegner: document.querySelectorAll(".gs-chip").length,
    }));
    pruefe(anfang.phase === "zuschauen" && /Jule/.test(anfang.leiste) && /Fänge/.test(anfang.leiste) && anfang.gegner === 0,
      `Jongleur: Das Anschauen beginnt nicht, oder es stehen Gegner-Schalter da: ${JSON.stringify(anfang)}`);
    // Ein Tipp und eine Taste gehören beim Anschauen nicht dem Spiel.
    await seite.mouse.click(100, 500);
    await seite.keyboard.press("KeyL");
    pruefe(await seite.evaluate(() => window.LernappJongleur.state.phase) === "zuschauen", "Jongleur: Ein Tipp beim Anschauen greift ins Spiel ein.");
    await seite.waitForSelector(".gz-tafel:not([hidden]) .gz-nochmal", { timeout: 40000 }).catch(() => {});
    const angeschaut = await seite.evaluate((quelle) => new Function(`return (${quelle})()`)(), runde.toString());
    pruefe(JSON.stringify(angeschaut) === JSON.stringify(gespielt.runde),
      `Jongleur: Beim Anschauen läuft eine andere Runde ab:\n  gespielt ${JSON.stringify(gespielt.runde)}\n  angeschaut ${JSON.stringify(angeschaut)}`);
    await seite.click(".gz-nochmal");
    await seite.waitForTimeout(300);
    const nochmal = await seite.evaluate(() => ({ phase: window.LernappJongleur.state.phase, punkte: window.LernappJongleur.state.punkte }));
    pruefe(nochmal.phase === "zuschauen" && nochmal.punkte < gespielt.runde.punkte,
      `Jongleur: «Nochmal» spielt die Runde nicht von vorn ab: ${JSON.stringify(nochmal)}`);
    await kontext.close();
  }

  // --- 4g19. Turmspringen: schaffbar, und jede Runde endet von selbst ---------------
  // Ein Autopilot springt mehrere gewürfelte Serien: Er hält das Päckchen,
  // bis die Drehung beim Strecken genau sein Ziel ergibt – je höher, desto
  // mehr halbe Drehungen, zuletzt zweieinhalb Saltos –, und streckt sich. Er
  // kommt auf jeder Welt durch alle acht Sprünge, jeden perfekt, und die
  // Runde endet nach dem achten von selbst. Ein gieriger, der jedes Mal zwei
  // halbe Drehungen mehr will, kommt nicht durch. Wer nach dem Start nichts
  // tut, taucht achtmal ohne Drehung ein: keine Punkte, aber ein Ende. Wer
  // im Päckchen bleibt, macht eine Arschbombe; wer quer eintaucht, klatscht.
  // Halten dreht, Loslassen hält die Drehung an. Und ein Lauf, angeschaut,
  // in derselben Welt mit derselben Zahl am Schluss.
  {
    const { kontext, seite } = await neueSeite({ width: 844, height: 390 });
    await seite.goto(`${BASIS}/turmspringen`, { waitUntil: "load" });
    await seite.waitForFunction(() => window.LernappTurmspringen?.state?.sp && window.LernappTurmspringen.view.cssW > 0, null, { timeout: 8000 });
    // Der Pilot als Text: Er läuft in mehreren evaluate. ziel: halbe
    // Drehungen je Sprung (eine Liste) oder halten: im Flug immer (true)
    // oder nie (false) das Päckchen.
    const PILOT = `(S, st, { ziel = [2, 2, 3, 3, 4, 4, 4, 5], dazu = 0, halten = null } = {}) => {
      if (st.schritt !== "flug") { S.halte(false); return; }
      if (halten !== null) { S.halte(halten); return; }
      const soll = (ziel[Math.min(st.nr, ziel.length - 1)] + dazu) * 180;
      S.halte(S.vorausWinkel(true).winkel < soll - 0.5);
    }`;
    const serien = await seite.evaluate((quelle) => {
      const pilot = new Function(`return (${quelle})`)();
      const S = window.LernappTurmspringen;
      const st = S.state;
      const raus = [];
      for (let lauf = 0; lauf < 5; lauf += 1) {
        document.querySelector(".cm-bar-left .cm-icon-again").click();
        S.aktion();
        for (let n = 0; st.phase === "spiel" && n < 900000; n += 1) {
          pilot(S, st);
          S.takt(1 / 120);
        }
        S.halte(false);
        raus.push({ nr: st.nr, phase: st.phase, aus: st.aus, punkte: st.punkte, perfekte: st.perfekte, sprunge: st.sprunge.join(" "), welt: S.weltText() });
      }
      return raus;
    }, PILOT);
    pruefe(serien.every((s) => s.nr === 7 && s.phase === "ende" && s.aus === "fertig" && s.perfekte === 8 && s.punkte >= 90),
      `Turmspringen: Der Autopilot kommt nicht perfekt durch alle acht Sprünge, oder die Runde endet nicht danach – ${JSON.stringify(serien)}`);
    pruefe(new Set(serien.map((s) => s.welt)).size > 1, `Turmspringen: Die Höhen sind in jeder Runde dieselben – ${JSON.stringify(serien.map((s) => s.welt))}`);
    const baender = await seite.evaluate(() => {
      const S = window.LernappTurmspringen;
      return S.state.plan.slice(0, S.SPRUENGE).every((p, i) => p.H >= S.BAENDER[i][0] && p.H <= S.BAENDER[i][1] && Number.isInteger(p.H));
    });
    pruefe(baender, "Turmspringen: Eine Höhe liegt ausserhalb ihres Bandes.");

    const gierig = await seite.evaluate((quelle) => {
      const pilot = new Function(`return (${quelle})`)();
      const S = window.LernappTurmspringen;
      const st = S.state;
      const raus = [];
      for (let lauf = 0; lauf < 3; lauf += 1) {
        document.querySelector(".cm-bar-left .cm-icon-again").click();
        S.aktion();
        for (let n = 0; st.phase === "spiel" && n < 900000; n += 1) {
          pilot(S, st, { dazu: 2 });
          S.takt(1 / 120);
        }
        S.halte(false);
        raus.push({ nr: st.nr, aus: st.aus });
      }
      return raus;
    }, PILOT);
    pruefe(gierig.every((r) => r.aus === "bombe" || r.aus === "klatscher"),
      `Turmspringen: Wer immer zwei halbe Drehungen mehr will, kommt trotzdem durch – ${JSON.stringify(gierig)}`);

    // Nichts tun, nur im Päckchen, quer hinein.
    const arten = await seite.evaluate((quelle) => {
      const pilot = new Function(`return (${quelle})`)();
      const S = window.LernappTurmspringen;
      const st = S.state;
      const raus = {};
      for (const [art, opt] of [["nichts", { halten: false }], ["paeckchen", { halten: true }], ["quer", { ziel: [1.5] }]]) {
        document.querySelector(".cm-bar-left .cm-icon-again").click();
        S.aktion();
        for (let n = 0; st.phase === "spiel" && n < 900000; n += 1) {
          pilot(S, st, opt);
          S.takt(1 / 120);
        }
        S.halte(false);
        raus[art] = { nr: st.nr, aus: st.aus, grund: st.grund, punkte: st.punkte, ergebnis: Boolean(document.querySelector(".cm-result-score")) };
      }
      return raus;
    }, PILOT);
    pruefe(arten.nichts.aus === "fertig" && arten.nichts.nr === 7 && arten.nichts.punkte === 0 && arten.nichts.ergebnis,
      `Turmspringen: Wer nichts tut, springt nicht acht Mal ohne Punkte bis zum Ende: ${JSON.stringify(arten.nichts)}`);
    pruefe(arten.paeckchen.aus === "bombe" && arten.paeckchen.nr === 0 && arten.paeckchen.grund === "Arschbombe" && arten.paeckchen.ergebnis,
      `Turmspringen: Wer im Päckchen bleibt, macht keine Arschbombe: ${JSON.stringify(arten.paeckchen)}`);
    pruefe(arten.quer.aus === "klatscher" && arten.quer.nr === 0 && arten.quer.ergebnis,
      `Turmspringen: Wer quer eintaucht, klatscht nicht: ${JSON.stringify(arten.quer)}`);

    // Halten dreht, Loslassen hält an.
    const dreh = await seite.evaluate(() => {
      const S = window.LernappTurmspringen;
      const st = S.state;
      document.querySelector(".cm-bar-left .cm-icon-again").click();
      S.aktion();
      for (let n = 0; n < 8000 && st.schritt !== "flug"; n += 1) S.takt(1 / 120);
      const w0 = st.sp.winkel;
      for (let n = 0; n < 24; n += 1) S.takt(1 / 120);
      const offen = st.sp.winkel - w0;
      S.halte(true);
      const w1 = st.sp.winkel;
      for (let n = 0; n < 36; n += 1) S.takt(1 / 120);
      const zu = st.sp.winkel - w1;
      S.halte(false);
      for (let n = 0; n < 36; n += 1) S.takt(1 / 120);
      const w2 = st.sp.winkel;
      for (let n = 0; n < 24; n += 1) S.takt(1 / 120);
      const danach = st.sp.winkel - w2;
      return { offen, zu, danach, schritt: st.schritt };
    });
    pruefe(dreh.schritt === "flug" && dreh.offen === 0 && dreh.zu > 30 && Math.abs(dreh.danach) < 0.5,
      `Turmspringen: Halten dreht nicht, oder Loslassen hält die Drehung nicht an: ${JSON.stringify(dreh)}`);

    await kontext.close();
  }
  {
    // Ein Lauf in echter Zeit – ein guter Sprung, dann eine Arschbombe –,
    // aufgezeichnet und angeschaut: dieselbe Welt, am Schluss dieselbe Zahl.
    const { kontext, seite } = await neueSeite({ width: 844, height: 390 });
    await seite.addInitScript(() => {
      if (sessionStorage.getItem("__turm")) return;
      sessionStorage.setItem("__turm", "1");
      localStorage.setItem("mini.name", "Zora");
    });
    await seite.goto(`${BASIS}/turmspringen`, { waitUntil: "load" });
    await seite.waitForFunction(() => window.LernappTurmspringen?.state?.sp && window.LernappTurmspringen.view.cssW > 0, null, { timeout: 8000 });
    const PILOT = `(S, st, halten = null) => {
      if (st.schritt !== "flug") { S.halte(false); return; }
      if (halten !== null) { S.halte(halten); return; }
      S.halte(S.vorausWinkel(true).winkel < 360 - 0.5);
    }`;
    const welt = await seite.evaluate(() => window.LernappTurmspringen.weltText());
    await seite.evaluate((quelle) => new Promise((fertig) => {
      const pilot = new Function(`return (${quelle})`)();
      const S = window.LernappTurmspringen;
      const st = S.state;
      S.aktion();
      const lauf = () => {
        if (st.phase !== "spiel") { fertig(); return; }
        pilot(S, st, st.nr === 0 ? null : true);
        requestAnimationFrame(lauf);
      };
      requestAnimationFrame(lauf);
    }), PILOT);
    await seite.waitForSelector(".cm-result-score", { timeout: 40000 }).catch(() => {});
    await seite.waitForFunction(() => [...(window.__miniGeister?.keys?.() || [])].some((k) => k.startsWith("highDive_")), null, { timeout: 4000 }).catch(() => {});
    const gespielt = await seite.evaluate(() => {
      const kennung = localStorage.getItem("mini.id");
      const geist = window.__miniGeister?.get(`highDive_${kennung}`) || null;
      let d = null;
      try { d = JSON.parse(geist?.bahn || "null"); } catch { d = null; }
      const st = window.LernappTurmspringen.state;
      return { kennung, saat: d?.s ?? null, mitOrt: Boolean(window.LernappGeist.entpacke(geist?.bahn)?.c), punkte: geist?.punkte || 0, gezaehlt: st.punkte, sprunge: st.sprunge.length, aus: st.aus };
    });
    pruefe(gespielt.kennung && Number.isInteger(gespielt.saat) && gespielt.mitOrt && gespielt.punkte > 0 && gespielt.punkte === gespielt.gezaehlt && gespielt.sprunge === 2 && gespielt.aus === "bombe",
      `Turmspringen: Der Lauf wird nicht mit Saat, Ort und Drehung hinterlegt: ${JSON.stringify(gespielt)}`);
    await seite.goto(`${BASIS}/turmspringen?zuschauen=${gespielt.kennung}`, { waitUntil: "load" });
    await seite.waitForFunction(() => window.LernappTurmspringen?.state?.phase === "zuschauen", null, { timeout: 8000 }).catch(() => {});
    const zu = await seite.evaluate(() => ({ phase: window.LernappTurmspringen.state.phase, welt: window.LernappTurmspringen.weltText() }));
    pruefe(zu.phase === "zuschauen" && zu.welt === welt,
      `Turmspringen: Beim Zuschauen entsteht eine andere Welt:\n  gespielt ${welt}\n  angeschaut ${JSON.stringify(zu)}`);
    await seite.waitForTimeout(3500);
    const unterwegs = await seite.evaluate(() => ({ schritt: window.LernappTurmspringen.state.schritt, x: window.LernappTurmspringen.state.sp.x }));
    pruefe(["wippen", "flug", "wasser"].includes(unterwegs.schritt), `Turmspringen: Beim Zuschauen geht der Springer nicht an die Kante: ${JSON.stringify(unterwegs)}`);
    await seite.waitForSelector(".gz-tafel:not([hidden]) .gz-nochmal", { timeout: 40000 }).catch(() => {});
    const schluss = await seite.evaluate(() => ({ punkte: window.LernappTurmspringen.state.punkte, nr: window.LernappTurmspringen.state.nr, tafel: Boolean(document.querySelector(".gz-tafel:not([hidden]) .gz-nochmal")) }));
    pruefe(schluss.tafel && schluss.punkte === gespielt.punkte && schluss.nr === 1,
      `Turmspringen: Am Ende des angeschauten Laufs steht nicht dieselbe Zahl (oder keine Tafel): ${JSON.stringify({ ...schluss, gespielt: gespielt.punkte })}`);
    await kontext.close();
  }

  // --- 4g20. Fallschirm: schaffbar, und wer nichts tut, ist bald draussen ----------
  // Ein Autopilot springt mehrere Runden bis zum zwölften Sprung – tief in
  // die schwere Phase. Im Fall plant er voraus: Für die nächsten drei
  // Hindernisse wählt er je eine Seite, rechnet den Weg mit denselben
  // Schritten wie das Spiel durch und nimmt den, der nirgends anstösst; er
  // lenkt vor jedem Rechenschritt, so wie er gerechnet hat. Er zieht knapp
  // über der Mindesthöhe, hält unter dem Schirm gegen den Wind aufs Ziel und
  // fängt im Band ab. Wo er nicht durchkommt, verlangt der Plan Unmögliches.
  // Die Welten sind fest (eine feste Saat je Runde), damit die Prüfung nie
  // zufällig rot wird – darunter vier, an denen der Autopilot früher
  // scheiterte (Saat 6, 23, 28, 45). Einmal von Hand geprüft: 300 Welten,
  // alle bis Sprung 13. Wer nach dem Absprung nichts tut, zieht nicht – die Reserve
  // geht auf, die Runde ist vorbei. Wer zu tief zieht, ebenso. Dazu: die zwei
  // Hälften lenken, der Wisch zieht, die Tasten tun dasselbe. Und ein Lauf,
  // angeschaut, springt dieselben Sprünge mit derselben Zahl am Schluss.
  {
    const fallschirmPilot = () => {
      const F = window.LernappFallschirm;
      const st = F.state;
      const H = 1 / 240;
      const pilot = { rand: 8, plan: null, planZeit: -1, planSprung: 0 };
      const zielX = (sp, ts) => sp.x0 + sp.beweg * ts;
      const vorausFall = (soll, bisZ) => {
        const sp = st.sp;
        let { x, z, vx, vz } = st.j;
        let ts = st.ts;
        for (let n = 0; n < 240 * 8 && z > bisZ; n += 1) {
          const d = soll(ts, z) - x - vx * 0.22;
          const lenk = Math.abs(d) < 0.25 ? 0 : Math.sign(d);
          vz += 100 * (1 - (vz / sp.v) ** 2) * H;
          z -= vz * H;
          vx += (lenk * F.V_QUER_FREI + F.windHoehe(sp.wind, z) * F.WIND_FREI - vx) * (1 - Math.exp(-H / F.TAU_QUER_FREI));
          x += vx * H;
          ts += H;
          for (const h of sp.hindernisse) {
            const lage = F.hindernisLage(h, ts);
            if (z >= lage.z - h.dz && z <= lage.z + h.dz && Math.abs(x - lage.x) < h.r + F.R_FREI + 0.35) return { treffer: true, x, ts };
          }
        }
        return { treffer: false, x, ts };
      };
      const planeFall = () => {
        const sp = st.sp;
        const j = st.j;
        const bisZ = sp.hMin + pilot.rand;
        const tSchirm = 0.8 + Math.max(10, bisZ - 45) / F.V_SINK;
        const zielEnde = (ts) => zielX(sp, ts + tSchirm) - sp.wind * 1.5;
        const kommende = sp.hindernisse.filter((h) => !h.getroffen && j.z > F.hindernisLage(h, st.ts).z - h.dz)
          .sort((a, b) => a.tK - b.tK).slice(0, 3);
        let seiten = [[]];
        for (let m = 0; m < kommende.length; m += 1) seiten = seiten.flatMap((w) => [[...w, -1], [...w, 1]]);
        let bester = null;
        for (const wahl of seiten) {
          const soll = (ts, z) => {
            for (let m = 0; m < kommende.length; m += 1) {
              const h = kommende[m];
              const lage = F.hindernisLage(h, ts);
              if (z > lage.z - h.dz) {
                const tK = Math.max(ts, F.tFall(st.sprung, Math.min(z, lage.z + h.dz)));
                return F.hindernisLage(h, tK).x + wahl[m] * (h.r + F.R_FREI + 1.6);
              }
            }
            return zielEnde(ts);
          };
          const r = vorausFall(soll, bisZ);
          const fehl = r.treffer ? 1e6 : Math.abs(r.x - zielEnde(r.ts));
          if (!bester || fehl < bester.fehl) bester = { soll, fehl };
        }
        return bester;
      };
      // Gelenkt wird vor jedem Rechenschritt des Spiels – genau so, wie
      // vorausFall rechnet. Sonst wiche der Weg vom Plan ab.
      pilot.schritt = (dt) => {
        const n = dt ? Math.max(1, Math.round(dt / H)) : 0;
        if (!n) { pilot.steuern(); return; }
        for (let i = 0; i < n; i += 1) {
          pilot.steuern();
          F.takt(H);
        }
      };
      pilot.steuern = () => {
        const j = st.j;
        const sp = st.sp;
        let lenk = 0;
        if (st.schritt === "frei") {
          if (!pilot.plan || st.ts - pilot.planZeit > 0.05 || pilot.planSprung !== st.sprung) {
            pilot.plan = planeFall();
            pilot.planZeit = st.ts;
            pilot.planSprung = st.sprung;
          }
          const d = pilot.plan.soll(st.ts, j.z) - j.x - j.vx * 0.22;
          lenk = Math.abs(d) < 0.25 ? 0 : Math.sign(d);
        } else if (st.schritt === "schirm" || st.schritt === "auf") {
          const tRest = Math.max(0.3, j.z / Math.max(1, j.vz));
          const r = ((zielX(sp, st.ts + tRest) - j.x) / Math.max(0.5, tRest * 0.6) - st.wind.x) / F.V_QUER;
          lenk = r > 0.15 ? 1 : r < -0.15 ? -1 : 0;
        }
        F.lenke(lenk);
        const mitte = (F.FLARE_BAND.butter[0] + F.FLARE_BAND.butter[1]) / 2;
        if ((st.schritt === "frei" && st.ts > 0.7 && j.z <= sp.hMin + pilot.rand) || (st.schritt === "schirm" && !st.flare && j.z <= mitte)) F.wisch();
      };
      window.__fsPilot = pilot;
    };
    const { kontext, seite } = await neueSeite({ width: 390, height: 844 });
    await seite.goto(`${BASIS}/fallschirm`, { waitUntil: "load" });
    await seite.waitForFunction(() => window.LernappFallschirm?.state && window.LernappFallschirm.view.cssW > 0, null, { timeout: 8000 });
    await seite.evaluate(fallschirmPilot);
    const runden = await seite.evaluate(() => {
      const F = window.LernappFallschirm;
      const st = F.state;
      const raus = [];
      for (const saat of [6, 23, 28, 45, 101]) {
        // Eine feste Welt: die Saat aus einem festen «Zufall».
        const zufall = Math.random;
        Math.random = () => (saat * 7919 % 100000) / 100000;
        document.querySelector(".cm-bar-left .cm-icon-again").click();
        Math.random = zufall;
        F.losGehts();
        const orte = new Set();
        let hindernisse = 0;
        for (let n = 0; st.phase === "spiel" && st.sprung <= 12 && n < 120 * 400; n += 1) {
          if (st.schritt === "flugzeug" && st.t < 0.01) { orte.add(st.sp.art); hindernisse += st.sp.hindernisse.length; }
          window.__fsPilot.schritt(1 / 120);
        }
        const ringe = st.serie.filter((s) => s.ring > 0).length;
        raus.push({ saat, sprung: st.sprung, phase: st.phase, schritt: st.schritt, grund: st.grund, punkte: st.punkte, landungen: st.serie.length, ringe, hindernisse, orte: [...orte].join(",") });
      }
      return raus;
    });
    pruefe(runden.every((r) => r.sprung >= 13 && r.phase === "spiel" && r.landungen >= 12 && r.ringe >= 12 && r.hindernisse >= 15 && r.punkte >= 1200),
      `Fallschirm: Der Autopilot kommt nicht durch jede Runde – ${JSON.stringify(runden)}`);
    // Jedes Ziel ist erreichbar: Die Ringe liegen ganz im Trockenen, auf
    // dem Floss und dem Boot ganz auf dem Deck, und daneben ist Wasser.
    const ziele = await seite.evaluate(() => {
      const F = window.LernappFallschirm;
      document.querySelector(".cm-bar-left .cm-icon-again").click();
      const fehler = [];
      F.planBis(40).forEach((sp) => {
        if (sp.deck ? sp.r10 > sp.deck : [-1, 1].some((s) => F.untergrund(sp.x0 + s * sp.r10, sp.y) !== "boden")) fehler.push(`${sp.n}:${sp.art}`);
        if (sp.deck && F.untergrund(sp.x0 + sp.deck + 3, sp.y) !== "wasser") fehler.push(`${sp.n}:${sp.art} ohne Wasser`);
      });
      return fehler;
    });
    pruefe(ziele.length === 0, `Fallschirm: Ein Ziel liegt nicht im Trockenen – ${ziele.join(" ")}`);
    // Ohne Eingabe nach dem Absprung: nicht gezogen, die Reserve, die Tafel.
    await seite.evaluate(() => document.querySelector(".cm-bar-left .cm-icon-again").click());
    await seite.keyboard.press("Space");
    await seite.waitForSelector(".cm-result-score", { timeout: 15000 }).catch(() => {});
    const ohne = await seite.evaluate(() => ({ zahl: document.querySelector(".cm-result-score")?.textContent, phase: window.LernappFallschirm.state.phase, grund: window.LernappFallschirm.state.grund }));
    pruefe(ohne.phase === "ende" && ohne.zahl !== undefined && ohne.grund === "Nicht gezogen!",
      `Fallschirm: Ohne Eingabe endet die Runde nicht mit Ergebnis: ${JSON.stringify(ohne)}`);
    // Zu tief gezogen: auch das ist das Ende.
    const tief = await seite.evaluate(() => {
      const F = window.LernappFallschirm;
      const st = F.state;
      document.querySelector(".cm-bar-left .cm-icon-again").click();
      F.losGehts();
      for (let n = 0; st.schritt === "frei" && st.j.z > st.sp.hMin - 4 && n < 120 * 30; n += 1) F.takt(1 / 120);
      F.wisch();
      for (let n = 0; st.phase === "spiel" && n < 120 * 5; n += 1) F.takt(1 / 120);
      return { phase: st.phase, schritt: st.schritt, grund: st.grund, punkte: st.punkte };
    });
    pruefe(tief.phase === "ende" && tief.schritt === "reserve" && tief.grund === "Zu tief gezogen!" && tief.punkte === 0,
      `Fallschirm: Zu tief gezogen beendet die Runde nicht: ${JSON.stringify(tief)}`);
    // Die zwei Hälften mit echten Fingern: links, rechts (der zweite gilt),
    // loslassen. Ein Wisch nach oben zieht – und lenkt nicht. Mit den Tasten
    // dasselbe.
    await seite.evaluate(() => document.querySelector(".cm-bar-left .cm-icon-again").click());
    const box = await seite.locator(".fs-feld").boundingBox();
    const finger = (id, x, y, typ) => seite.evaluate(({ id, x, y, typ }) => {
      const ziel = typ === "pointerdown" ? document.elementFromPoint(x, y) : window;
      ziel.dispatchEvent(new PointerEvent(typ, { pointerId: id, clientX: x, clientY: y, bubbles: true }));
    }, { id, x, y, typ });
    const lage = () => seite.evaluate(() => ({ phase: window.LernappFallschirm.state.phase, lenkung: window.LernappFallschirm.state.lenkung }));
    const y0 = box.y + box.height * 0.7;
    const schritte = [];
    await finger(1, box.x + box.width * 0.2, y0, "pointerdown");
    schritte.push(await lage());
    await finger(2, box.x + box.width * 0.8, y0, "pointerdown");
    schritte.push(await lage());
    await finger(2, box.x + box.width * 0.8, y0, "pointerup");
    schritte.push(await lage());
    await finger(1, box.x + box.width * 0.2, y0, "pointerup");
    schritte.push(await lage());
    await seite.keyboard.down("ArrowRight");
    schritte.push(await lage());
    await seite.keyboard.up("ArrowRight");
    const soll = [
      { phase: "spiel", lenkung: -1 }, { phase: "spiel", lenkung: 1 }, { phase: "spiel", lenkung: -1 },
      { phase: "spiel", lenkung: 0 }, { phase: "spiel", lenkung: 1 },
    ];
    pruefe(JSON.stringify(schritte) === JSON.stringify(soll), `Fallschirm: Die zwei Hälften lenken nicht richtig: ${JSON.stringify(schritte)}`);
    await seite.waitForFunction(() => window.LernappFallschirm.state.ts > 0.8, null, { timeout: 8000 }).catch(() => {});
    await finger(3, box.x + box.width * 0.7, y0, "pointerdown");
    await finger(3, box.x + box.width * 0.7, y0 - 70, "pointermove");
    const wisch = await seite.evaluate(() => ({ lenkung: window.LernappFallschirm.state.lenkung }));
    await seite.waitForTimeout(150);
    await finger(3, box.x + box.width * 0.7, y0 - 70, "pointerup");
    const gezogen = await seite.evaluate(() => ({ schritt: window.LernappFallschirm.state.schritt, zug: window.LernappFallschirm.state.zug }));
    pruefe(wisch.lenkung === 0 && (gezogen.schritt === "auf" || gezogen.schritt === "schirm") && Boolean(gezogen.zug),
      `Fallschirm: Der Wisch nach oben zieht nicht (oder lenkt): ${JSON.stringify({ wisch, gezogen })}`);
    await seite.evaluate(() => document.querySelector(".cm-bar-left .cm-icon-again").click());
    await seite.keyboard.press("ArrowLeft");
    await seite.waitForFunction(() => window.LernappFallschirm.state.ts > 0.8, null, { timeout: 8000 }).catch(() => {});
    await seite.keyboard.press("Space");
    await seite.waitForTimeout(100);
    pruefe(["auf", "schirm"].includes(await seite.evaluate(() => window.LernappFallschirm.state.schritt)),
      "Fallschirm: Die Leertaste zieht den Schirm nicht.");
    await kontext.close();

    // Anschauen: Eine kurze Runde – ein Sprung bis zur Landung, im zweiten
    // zieht er nicht – wird mit Saat und Weg hinterlegt. Angeschaut springt
    // sie an denselben Orten und endet mit derselben Zahl.
    const { kontext: k2, seite: s2 } = await neueSeite({ width: 390, height: 844 });
    await s2.addInitScript(() => {
      if (sessionStorage.getItem("__fs")) return;
      sessionStorage.setItem("__fs", "1");
      localStorage.setItem("mini.name", "Zora");
    });
    await s2.goto(`${BASIS}/fallschirm`, { waitUntil: "load" });
    await s2.waitForFunction(() => window.LernappFallschirm?.state && window.LernappFallschirm.view.cssW > 0, null, { timeout: 8000 });
    await s2.evaluate(fallschirmPilot);
    await s2.evaluate(() => new Promise((fertig) => {
      const F = window.LernappFallschirm;
      const st = F.state;
      F.losGehts();
      const lauf = () => {
        if (st.phase !== "spiel") { fertig(); return; }
        if (st.sprung === 1) window.__fsPilot.schritt(0);
        else F.lenke(0);
        requestAnimationFrame(lauf);
      };
      requestAnimationFrame(lauf);
    }));
    await s2.waitForSelector(".cm-result-score", { timeout: 15000 }).catch(() => {});
    await s2.waitForFunction(() => [...(window.__miniGeister?.keys?.() || [])].some((k) => k.startsWith("skyDive_")), null, { timeout: 4000 }).catch(() => {});
    const gespielt = await s2.evaluate(() => {
      const kennung = localStorage.getItem("mini.id");
      const geist = window.__miniGeister?.get(`skyDive_${kennung}`) || null;
      let d = null;
      try { d = JSON.parse(geist?.bahn || "null"); } catch { d = null; }
      return { kennung, saat: d?.s ?? null, mitOrt: Boolean(window.LernappGeist.entpacke(geist?.bahn)?.a), punkte: geist?.punkte || 0, welt: window.LernappFallschirm.weltText(),
        landungen: window.LernappFallschirm.state.serie.length };
    });
    pruefe(gespielt.kennung && Number.isInteger(gespielt.saat) && gespielt.mitOrt && gespielt.punkte > 0 && gespielt.landungen === 1,
      `Fallschirm: Der Lauf wird nicht mit Saat und Weg hinterlegt: ${JSON.stringify({ ...gespielt, welt: undefined })}`);
    await s2.goto(`${BASIS}/fallschirm?zuschauen=${gespielt.kennung}`, { waitUntil: "load" });
    await s2.waitForFunction(() => window.LernappFallschirm?.state?.phase === "zuschauen", null, { timeout: 8000 }).catch(() => {});
    const zu = await s2.evaluate(() => ({ phase: window.LernappFallschirm.state.phase, welt: window.LernappFallschirm.weltText() }));
    pruefe(zu.phase === "zuschauen" && zu.welt === gespielt.welt, `Fallschirm: Beim Zuschauen entsteht eine andere Welt: ${JSON.stringify({ phase: zu.phase, gleich: zu.welt === gespielt.welt })}`);
    await s2.waitForSelector(".gz-tafel:not([hidden]) .gz-nochmal", { timeout: 45000 }).catch(() => {});
    const ende = await s2.evaluate(() => ({ punkte: window.LernappFallschirm.state.punkte, sprung: window.LernappFallschirm.state.sprung, schritt: window.LernappFallschirm.state.schritt }));
    pruefe(ende.punkte === gespielt.punkte && ende.sprung === 2 && ende.schritt === "reserve",
      `Fallschirm: Der angeschaute Lauf endet anders als gespielt: ${JSON.stringify({ ende, gespielt: gespielt.punkte })}`);
    await k2.close();
  }

  // --- 4g21. Holzfäller: schaffbar, und wer nichts tut, ist bald draussen ----------
  // Ein Autopilot schneidet auf mehreren gewürfelten Welten jeden Strich
  // perfekt – aber mit menschlichem Tempo: frühestens eine Fünftelsekunde,
  // nachdem ein Strich im Bild ist, höchstens alle 0.28 s ein Wisch, und nur
  // einer, der allein seinen Stamm durchquert (keinen Ast, keinen
  // Nagelstamm daneben). So kommt er bis weit in die schwere Phase – Welle
  // 70: vier Stämme auf einmal, Nagelstämme, Äste nah am Strich – ohne einen
  // Fehler. Lässt er einen Stamm fallen, verlangt die Welt mehr, als eine
  // Hand kann. Wer nach dem Hochwerfen nichts tut, verliert bald seine drei
  // Äxte – das Ende, mit Ergebnis. Ein Schnitt weit neben den Strich und
  // einer durch einen Nagelstamm kosten je eine Axt. Und wer seine Runde
  // anschaut, sieht dieselben Schnitte in denselben Schritten und denselben
  // Endstand.
  {
    const { kontext, seite } = await neueSeite({ width: 390, height: 844 });
    await seite.goto(`${BASIS}/holzfaeller`, { waitUntil: "load" });
    await seite.waitForFunction(() => window.LernappHolzfaeller?.state && window.LernappHolzfaeller.view.cssW > 0, null, { timeout: 8000 });
    // Der Autopilot im Spiel, als Text: Er läuft auch in den Seiten unten.
    const pilot = `(bisWelle, nagelSuchen) => {
      const H = window.LernappHolzfaeller;
      const st = H.state;
      const gesehen = new Map();
      let letzter = 0;
      let knapp = Infinity;
      if (st.phase === "bereit") {
        const z = H.ziele()[0];
        H.wischen([[z.ax, z.ay], [z.bx, z.by]]);
      }
      for (let n = 0; st.phase === "spiel" && !st.aus && st.welle <= bisWelle && n < 120 * 300; n += 1) {
        const zeit = st.tick / 240;
        if (nagelSuchen) {
          for (const p of st.stuecke) {
            if (!p.nagel || p.getroffen || p.y < 60 || p.y > 300 || Math.abs(p.x) > 120) continue;
            const l = p.R + 14;
            const wisch = [[p.x - Math.sin(p.w) * l, p.y + Math.cos(p.w) * l], [p.x + Math.sin(p.w) * l, p.y - Math.cos(p.w) * l]];
            const pr = H.probe(wisch[0][0], wisch[0][1], wisch[1][0], wisch[1][1]);
            if (pr.length === 1 && pr[0].nagel) return wisch;
          }
        }
        const ziele = H.ziele();
        for (const z of ziele) if (z.sichtbar && !gesehen.has(z.id + "|" + z.u)) gesehen.set(z.id + "|" + z.u, zeit);
        if (zeit - letzter >= 0.28) {
          const reif = ziele.filter((z) => z.sichtbar && zeit - gesehen.get(z.id + "|" + z.u) >= 0.2).sort((a, b) => a.rest - b.rest);
          for (const z of reif) {
            const p = H.probe(z.ax, z.ay, z.bx, z.by);
            if (p.length !== 1 || p[0].id !== z.id || p[0].art !== "perfekt") continue;
            knapp = Math.min(knapp, z.rest);
            H.wischen([[z.ax, z.ay], [z.bx, z.by]]);
            letzter = zeit;
            break;
          }
        }
        H.takt(1 / 120);
      }
      return { welle: st.welle - 1, sekunden: Math.round(st.tick / 240), punkte: st.punkte, schnitte: st.schnitte, perfekte: st.perfekte, fehler: st.fehler, grund: st.grund, knapp: Math.round(knapp * 100) / 100 };
    }`;
    const runden = await seite.evaluate((quelle) => {
      const spiele = new Function(`return (${quelle})`)();
      const raus = [];
      for (let lauf = 0; lauf < 4; lauf += 1) {
        document.querySelector(".cm-bar-left .cm-icon-again").click();
        raus.push(spiele(70, false));
      }
      return raus;
    }, pilot);
    pruefe(runden.every((r) => r.welle >= 70 && r.fehler === 0 && r.schnitte === r.perfekte && r.schnitte >= 150),
      `Holzfäller: Der Autopilot kommt nicht auf jeder Welt fehlerfrei bis Welle 70 – ${JSON.stringify(runden)}`);

    // Ohne Eingabe: Die Leertaste wirft den ersten Stamm hoch, dann fallen
    // die Stämme – drei Äxte sind bald weg.
    await seite.evaluate(() => document.querySelector(".cm-bar-left .cm-icon-again").click());
    await seite.keyboard.press("Space");
    const ohne = await seite.evaluate(() => {
      const H = window.LernappHolzfaeller;
      for (let n = 0; n < 120 * 60 && !H.state.aus; n += 1) H.takt(1 / 120);
      return { sekunden: Math.round(H.state.tick / 240), fehler: H.state.fehler, grund: H.state.grund };
    });
    await seite.waitForSelector(".cm-result-score", { timeout: 8000 }).catch(() => {});
    const ende = await seite.evaluate(() => ({ zahl: document.querySelector(".cm-result-score")?.textContent, phase: window.LernappHolzfaeller.state.phase }));
    pruefe(ohne.fehler === 3 && ohne.grund === "verpasst" && ohne.sekunden <= 15 && ende.phase === "ende" && ende.zahl === "0",
      `Holzfäller: Ohne Eingabe endet die Runde nicht bald mit Ergebnis: ${JSON.stringify({ ...ohne, ...ende })}`);

    // Falsch geschnitten: weit neben dem Strich, dann durch einen Nagelstamm.
    const falsch = await seite.evaluate((quelle) => {
      const H = window.LernappHolzfaeller;
      const st = H.state;
      document.querySelector(".cm-bar-left .cm-icon-again").click();
      const z = H.ziele()[0];
      const d = (z.u > 0 ? -1 : 1) * 30;
      const daneben = H.wischen([[z.ax + z.ex * d, z.ay + z.ey * d], [z.bx + z.ex * d, z.by + z.ey * d]]);
      const nachDaneben = { fehler: st.fehler, grund: st.grund, art: daneben[0]?.art || "", phase: st.phase };
      const wisch = new Function(`return (${quelle})`)()(30, true);
      let nachNagel = null;
      if (Array.isArray(wisch)) {
        const vorher = st.fehler;
        const e = H.wischen(wisch);
        nachNagel = { art: e[0]?.art || "", mehr: st.fehler - vorher, grund: st.grund };
      }
      return { nachDaneben, nachNagel };
    }, pilot);
    pruefe(falsch.nachDaneben.art === "daneben" && falsch.nachDaneben.fehler === 1 && falsch.nachDaneben.phase === "spiel"
      && falsch.nachNagel?.art === "nagel" && falsch.nachNagel.mehr === 1 && falsch.nachNagel.grund === "nagel",
      `Holzfäller: Ein Schnitt neben den Strich oder durch einen Nagelstamm kostet keine Axt: ${JSON.stringify(falsch)}`);
    await kontext.close();
  }
  {
    // Zuschauen: Eine Runde in Echtzeit – ein Autopilot schneidet gut sieben
    // Sekunden lang, nicht immer genau, dann lässt er die Stämme fallen. Sie
    // kommt mit Saat und Zügen in die Hall of Fame. Wer sie anschaut, sieht
    // dieselben Schnitte in denselben Schritten, dieselben Fehler und am
    // Schluss dieselben Punkte.
    const { kontext, seite } = await neueSeite({ width: 420, height: 800 });
    await seite.addInitScript(() => {
      if (sessionStorage.getItem("__holz")) return;
      sessionStorage.setItem("__holz", "1");
      localStorage.setItem("mini.name", "Holly");
    });
    await seite.goto(`${BASIS}/holzfaeller`, { waitUntil: "load" });
    await seite.waitForFunction(() => window.LernappHolzfaeller?.state && window.LernappHolzfaeller.view.cssW > 0, null, { timeout: 8000 });
    await seite.evaluate(() => {
      const H = window.LernappHolzfaeller;
      const st = H.state;
      const gesehen = new Map();
      let letzter = 0;
      const tick = () => {
        if (st.phase === "ende") return;
        requestAnimationFrame(tick);
        if (st.phase === "bereit") {
          const z = H.ziele()[0];
          if (z) H.wischen([[z.ax, z.ay], [z.bx, z.by]]);
          return;
        }
        const zeit = st.tick / 240;
        if (st.aus || zeit > 7.5 || zeit - letzter < 0.3) return;
        const ziele = H.ziele();
        for (const z of ziele) if (z.sichtbar && !gesehen.has(z.id + "|" + z.u)) gesehen.set(z.id + "|" + z.u, zeit);
        const z = ziele.filter((q) => q.sichtbar && zeit - gesehen.get(q.id + "|" + q.u) > 0.2).sort((a, b) => a.rest - b.rest)[0];
        if (!z) return;
        const d = (Math.random() - 0.5) * 16;
        H.wischen([[z.ax + z.ex * d, z.ay + z.ey * d], [z.bx + z.ex * d, z.by + z.ey * d]]);
        letzter = zeit;
      };
      requestAnimationFrame(tick);
    });
    await seite.waitForSelector(".cm-result-score", { timeout: 45000 }).catch(() => {});
    await seite.waitForFunction(() => [...(window.__miniGeister?.keys?.() || [])].some((k) => k.startsWith("lumberCut_")), null, { timeout: 4000 }).catch(() => {});
    const gespielt = await seite.evaluate(() => {
      const st = window.LernappHolzfaeller.state;
      const kennung = localStorage.getItem("mini.id");
      const geist = window.__miniGeister?.get(`lumberCut_${kennung}`) || null;
      let d = null;
      try { d = JSON.parse(geist?.bahn || "null"); } catch { d = null; }
      return {
        kennung, level: geist?.level, saat: d?.s ?? null, zuege: d?.z?.t?.length || 0,
        punkte: st.punkte, fehler: st.fehler, schnitte: st.schnitte, protokoll: st.protokoll.join(" "),
      };
    });
    pruefe(gespielt.kennung && gespielt.level === "z1" && Number.isInteger(gespielt.saat) && gespielt.zuege >= 5 && gespielt.fehler === 3 && gespielt.schnitte >= 4,
      `Holzfäller: Die Runde kommt nicht mit Saat und Zügen in die Hall of Fame: ${JSON.stringify({ ...gespielt, protokoll: undefined })}`);
    await seite.goto(`${BASIS}/holzfaeller?zuschauen=${gespielt.kennung}`, { waitUntil: "load" });
    await seite.waitForFunction(() => window.LernappHolzfaeller?.state?.phase === "zuschauen", null, { timeout: 8000 }).catch(() => {});
    await seite.waitForSelector(".gz-tafel:not([hidden]) .gz-nochmal", { timeout: 60000 }).catch(() => {});
    const angeschaut = await seite.evaluate(() => {
      const st = window.LernappHolzfaeller.state;
      return { phase: st.phase, punkte: st.punkte, fehler: st.fehler, schnitte: st.schnitte, protokoll: st.protokoll.join(" ") };
    });
    pruefe(angeschaut.phase === "zuschauen" && angeschaut.protokoll === gespielt.protokoll && angeschaut.punkte === gespielt.punkte && angeschaut.fehler === 3,
      `Holzfäller: Beim Anschauen geschieht etwas anderes als in der Runde:\n  gespielt ${gespielt.punkte} – ${gespielt.protokoll}\n  angeschaut ${angeschaut.punkte} – ${angeschaut.protokoll}`);
    await kontext.close();
  }

  // --- 4g22. Fledermaus: schaffbar, und wer nichts tut, ist bald draussen ----------
  // Jede gewürfelte Höhle hat einen Weg mit einem freien Korridor (pfadBei,
  // halbBei): Darin ist an keiner Stelle Fels – keine Wand, kein Tropfstein,
  // keine Zunge, keine Spinne und kein fallender Tropfstein zu der Zeit, da
  // die Fledermaus dort ist. Ein Autopilot, der die Höhle kennt, fliegt vier
  // Höhlen bis 2000 m, weit in die schwere Phase: Er rechnet mit derselben
  // Physik im Voraus, wann der nächste Flügelschlag kommt, und nimmt den
  // Plan, der am weitesten vom Fels bleibt. Wo er nicht durchkommt, verlangt
  // die Höhle mehr, als die Fledermaus kann. Wer nach dem Start nicht
  // flattert, sinkt zu Boden – das Ende, mit Ergebnis. Die Hälften des
  // Bildes: links ruft, rechts flattert, auch mit zwei Fingern zugleich; ←
  // und ↑ ebenso. Und ein eigener Lauf lässt sich anschauen: dieselbe Höhle,
  // dieselben Rufe, derselbe Aufprall.
  {
    const { kontext, seite } = await neueSeite({ width: 1000, height: 640 });
    await seite.goto(`${BASIS}/fledermaus`, { waitUntil: "load" });
    await seite.waitForFunction(() => window.LernappFledermaus?.state && window.LernappFledermaus.view.cssW > 0, null, { timeout: 8000 });
    const fluege = await seite.evaluate(() => {
      const F = window.LernappFledermaus;
      const raus = [];
      const H = 1 / 120;
      const SICHT = Math.ceil(0.9 / H);
      const WARTE = [0, 1, 2, 3, 4, 5, 6, 8, 10, 13, 16, 20, 25, 30, 40, 60, 200];
      for (let lauf = 0; lauf < 4; lauf += 1) {
        document.querySelector(".cm-bar-left .cm-icon-again").click();
        const st = F.state;
        // Der Korridor, abgetastet: Mitte und Ränder.
        F.hoehleBis(21000);
        let imKorridor = 0;
        for (let x = 0; x < 20000; x += 4) {
          const p = F.pfadBei(x);
          const h = F.halbBei(x);
          for (const off of [-1, -0.5, 0, 0.5, 1]) if (F.abstand(x, p + off * h) < F.R_FM) imKorridor += 1;
        }
        F.schlag();
        let enge = Infinity;
        let letzter = -9;
        for (let n = 0; st.schritt === "flug" && st.meter < 2000 && n < 600000; n += 1) {
          const f = st.fm;
          let best = null;
          for (const w of WARTE) {
            const p = { x: f.x, y: f.y, vy: f.vy, schub: f.schub, schubA: f.schubA };
            let frei = Infinity;
            let abw = 0;
            let stoss = -1;
            let seit = 99;
            for (let j = 0; j < SICHT; j += 1) {
              if (j === w) { F.schlagAuf(p); seit = 0; } else if (j > w && seit > 8 && p.vy < 50 && p.y + p.vy * 0.2 < F.pfadBei(p.x + F.tempoBei(p.x) * 0.22) - 3) { F.schlagAuf(p); seit = 0; }
              seit += 1;
              F.fliegeSchritt(p, H / 2);
              F.fliegeSchritt(p, H / 2);
              if (j % 2 === 0 || j < 30) {
                const a = F.abstand(p.x, p.y) - F.R_FM;
                if (a < frei) frei = a;
                if (a < 0.6) { stoss = j; break; }
              }
              abw += Math.abs(p.y - F.pfadBei(p.x)) / F.halbBei(p.x);
            }
            const wert = stoss >= 0 ? -1e7 + stoss * 1e3 : Math.min(frei, 10) * 1000 - abw * 4;
            if (!best || wert > best.wert) best = { wert, w };
          }
          if (best.w === 0 && n - letzter > 2) { F.schlag(); letzter = n; }
          F.takt(H);
          if (st.schritt === "flug") enge = Math.min(enge, F.abstand(st.fm.x, st.fm.y) - F.R_FM);
        }
        const arten = new Set(st.hoehle.abschnitte.filter((a) => a.x0 < 20000).map((a) => a.art));
        raus.push({ meter: st.meter, schritt: st.schritt, grund: st.grund, enge: Math.round(enge * 10) / 10, imKorridor, arten: [...arten].sort().join(",") });
      }
      return raus;
    });
    pruefe(fluege.every((f) => f.imKorridor === 0), `Fledermaus: Im Korridor um den Weg steht Fels – ${JSON.stringify(fluege)}`);
    pruefe(fluege.every((f) => f.meter >= 2000 && f.schritt === "flug" && f.enge >= 0),
      `Fledermaus: Der Autopilot kommt nicht durch jede Höhle – ${JSON.stringify(fluege)}`);
    pruefe(fluege.some((f) => ["gabel", "spinne", "faller", "slalom", "kammer", "enge"].every((art) => f.arten.includes(art))),
      `Fledermaus: In 2000 m kommt nicht jede Art Abschnitt vor – ${JSON.stringify(fluege.map((f) => f.arten))}`);

    // Ohne Flügelschlag: Ein Ruf startet die Runde, dann sinkt die
    // Fledermaus zu Boden.
    await seite.evaluate(() => document.querySelector(".cm-bar-left .cm-icon-again").click());
    await seite.keyboard.press("ArrowLeft");
    await seite.waitForSelector(".cm-result-score", { timeout: 8000 }).catch(() => {});
    const ende = await seite.evaluate(() => ({
      zahl: document.querySelector(".cm-result-score")?.textContent,
      schritt: window.LernappFledermaus.state.schritt,
      phase: window.LernappFledermaus.state.phase,
      rufe: window.LernappFledermaus.state.rufZahl,
      grund: window.LernappFledermaus.state.grund,
    }));
    pruefe(ende.schritt === "crash" && ende.phase === "ende" && ende.zahl !== undefined && ende.rufe === 1 && ende.grund === "An die Wand geflogen",
      `Fledermaus: Ohne Flügelschlag endet die Runde nicht am Boden: ${JSON.stringify(ende)}`);

    // Die Rufe laden nicht von selbst nach: drei, dann ist Schluss – auch
    // nach Sekunden im Flug. Neue bringen nur Glühwürmchen.
    await seite.evaluate(() => document.querySelector(".cm-bar-left .cm-icon-again").click());
    const leer = await seite.evaluate(() => {
      const F = window.LernappFledermaus;
      const st = F.state;
      F.schlag();
      for (let i = 0; i < 4; i += 1) F.ruf();
      const nachRufen = { ladung: st.ladung, rufe: st.rufZahl };
      for (let i = 0; i < 180 && st.schritt === "flug"; i += 1) {
        if (st.fm.vy < -20) F.schlag();
        F.takt(1 / 60);
      }
      return { nachRufen, spaeter: st.ladung, flug: st.schritt, max: F.LADUNG_MAX };
    });
    pruefe(leer.nachRufen.ladung === 0 && leer.nachRufen.rufe === leer.max && leer.spaeter === 0,
      `Fledermaus: Die Rufe laden von selbst nach oder es gibt mehr als drei: ${JSON.stringify(leer)}`);

    // Die zwei Hälften mit echten Fingern, dann die Tasten.
    await seite.evaluate(() => document.querySelector(".cm-bar-left .cm-icon-again").click());
    const box = await seite.locator(".fm-feld").boundingBox();
    const finger = (id, x, typ) => seite.evaluate(({ id, x, y, typ }) => {
      const ziel = typ === "pointerdown" ? document.elementFromPoint(x, y) : window;
      ziel.dispatchEvent(new PointerEvent(typ, { pointerId: id, clientX: x, clientY: y, bubbles: true }));
    }, { id, x, y: box.y + box.height * 0.6, typ });
    const lage = () => seite.evaluate(() => {
      const st = window.LernappFledermaus.state;
      return {
        phase: st.phase, rufe: st.rufZahl, schlaege: st.schlaege,
        l: document.querySelector(".fm-knopf-ruf")?.classList.contains("ist-an"),
        r: document.querySelector(".fm-knopf-schlag")?.classList.contains("ist-an"),
      };
    });
    const schritte = [];
    await finger(1, box.x + box.width * 0.2, "pointerdown");
    schritte.push(await lage());
    await finger(2, box.x + box.width * 0.8, "pointerdown");
    schritte.push(await lage());
    await finger(1, box.x + box.width * 0.2, "pointerup");
    await finger(2, box.x + box.width * 0.8, "pointerup");
    schritte.push(await lage());
    await seite.keyboard.press("ArrowUp");
    await seite.keyboard.press("e");
    schritte.push(await lage());
    const soll = [
      { phase: "spiel", rufe: 1, schlaege: 0, l: true, r: false },
      { phase: "spiel", rufe: 1, schlaege: 1, l: true, r: true },
      { phase: "spiel", rufe: 1, schlaege: 1, l: false, r: false },
      { phase: "spiel", rufe: 2, schlaege: 2, l: false, r: false },
    ];
    pruefe(JSON.stringify(schritte) === JSON.stringify(soll), `Fledermaus: Die Hälften und Tasten tun nicht, was sie sollen: ${JSON.stringify(schritte)}`);
    await kontext.close();
  }
  {
    // Ein eigener Lauf, angeschaut: Er wird mit der Saat seiner Höhle
    // aufgezeichnet, und wer ihn anschaut, sieht dieselbe Höhle, dieselben
    // Rufe und am Schluss denselben Aufprall – dann die Tafel.
    const { kontext, seite } = await neueSeite({ width: 900, height: 520 });
    await seite.addInitScript(() => {
      if (sessionStorage.getItem("__fledermaus")) return;
      sessionStorage.setItem("__fledermaus", "1");
      localStorage.setItem("mini.name", "Zora");
    });
    await seite.goto(`${BASIS}/fledermaus`, { waitUntil: "load" });
    await seite.waitForFunction(() => window.LernappFledermaus?.state && window.LernappFledermaus.view.cssW > 0, null, { timeout: 8000 });
    // In Echtzeit: Die Aufzeichnung folgt der Uhr. Dem Weg nach, zwei Rufe,
    // dann keine Flügelschläge mehr.
    await seite.evaluate(() => {
      const F = window.LernappFledermaus;
      const st = F.state;
      F.schlag();
      const tick = () => {
        if (st.schritt !== "flug") return;
        requestAnimationFrame(tick);
        if (st.meter >= 45) return;
        const f = st.fm;
        if (f.y + f.vy * 0.25 < F.pfadBei(f.x + F.tempoBei(f.x) * 0.3) - 2 && f.vy < 60) F.schlag();
        if ((st.meter >= 12 && st.rufZahl === 0) || (st.meter >= 30 && st.rufZahl === 1)) F.ruf();
      };
      requestAnimationFrame(tick);
    });
    await seite.waitForSelector(".cm-result-score", { timeout: 20000 }).catch(() => {});
    await seite.waitForFunction(() => [...(window.__miniGeister?.keys?.() || [])].some((k) => k.startsWith("batEcho_")), null, { timeout: 4000 }).catch(() => {});
    const gespielt = await seite.evaluate(() => {
      const st = window.LernappFledermaus.state;
      const kennung = localStorage.getItem("mini.id");
      const geist = window.__miniGeister?.get(`batEcho_${kennung}`) || null;
      let d = null;
      try { d = JSON.parse(geist?.bahn || "null"); } catch { d = null; }
      return { kennung, saat: d?.s ?? null, mitOrt: Boolean(window.LernappGeist.entpacke(geist?.bahn)?.c), meter: st.meter, rufe: st.rufZahl, welt: window.LernappFledermaus.weltText() };
    });
    pruefe(gespielt.kennung && Number.isInteger(gespielt.saat) && gespielt.mitOrt && gespielt.meter >= 45 && gespielt.rufe === 2,
      `Fledermaus: Der Lauf wird nicht mit Saat, Weg und Rufen hinterlegt: ${JSON.stringify({ ...gespielt, welt: undefined })}`);
    await seite.goto(`${BASIS}/fledermaus?zuschauen=${gespielt.kennung}`, { waitUntil: "load" });
    await seite.waitForFunction(() => window.LernappFledermaus?.state?.phase === "zuschauen", null, { timeout: 8000 }).catch(() => {});
    const welt = await seite.evaluate(() => window.LernappFledermaus.weltText());
    pruefe(welt === gespielt.welt, "Fledermaus: Beim Zuschauen entsteht eine andere Höhle.");
    await seite.evaluate(() => window.LernappFledermaus.schlag());
    await seite.waitForSelector(".gz-tafel:not([hidden]) .gz-nochmal", { timeout: 25000 }).catch(() => {});
    const angeschaut = await seite.evaluate(() => {
      const st = window.LernappFledermaus.state;
      return { phase: st.phase, schritt: st.schritt, rufe: st.rufZahl, meter: st.punkte, schlaege: st.schlaege };
    });
    pruefe(angeschaut.phase === "zuschauen" && angeschaut.schritt === "crash" && angeschaut.rufe === gespielt.rufe
      && angeschaut.meter === gespielt.meter && angeschaut.schlaege === 0,
      `Fledermaus: Beim Zuschauen geschieht nicht dasselbe wie gespielt: ${JSON.stringify({ gespielt: { ...gespielt, welt: undefined }, angeschaut })}`);
    await kontext.close();
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

    // Tasten und Ziehen: Die Pfeiltaste nach oben bewegt ihn. Mit Finger
    // oder Maus, irgendwo im Bild: Ein Tipp ohne Ziehen bewegt ihn nicht.
    // Nach oben gezogen und gehalten, läuft er weiter nach oben; von dort
    // nach rechts gezogen (nicht zurück zum Anfang), läuft er nach rechts –
    // und erst losgelassen steht er.
    await neu();
    const vorTaste = await seite.evaluate(() => ({ ...window.LernappNinja.ninja }));
    await seite.keyboard.down("ArrowUp");
    await seite.waitForTimeout(400);
    await seite.keyboard.up("ArrowUp");
    const nachTaste = await seite.evaluate(() => ({ ...window.LernappNinja.ninja, phase: window.LernappNinja.state.phase }));
    pruefe(nachTaste.phase === "spiel" && nachTaste.y > vorTaste.y + 15 && Math.abs(nachTaste.x - vorTaste.x) < 2,
      `Zeitlupen-Ninja: Die Pfeiltaste bewegt den Ninja nicht nach oben: ${JSON.stringify({ vorTaste, nachTaste })}`);
    await neu();
    const ort = () => seite.evaluate(() => ({ ...window.LernappNinja.ninja, phase: window.LernappNinja.state.phase }));
    const da = await seite.evaluate(() => {
      const r = document.querySelector(".nj-canvas").getBoundingClientRect();
      return { x: r.left + r.width * 0.3, y: r.top + r.height * 0.7 };
    });
    const vorTipp = await ort();
    await seite.mouse.move(da.x, da.y);
    await seite.mouse.down();
    await seite.waitForTimeout(300);
    await seite.mouse.up();
    const nachTipp = await ort();
    await seite.mouse.down();
    await seite.mouse.move(da.x, da.y - 30, { steps: 3 });
    const hoch0 = await ort();
    await seite.waitForTimeout(400);
    const hoch1 = await ort();
    await seite.mouse.move(da.x + 30, da.y - 30, { steps: 3 });
    const rechts0 = await ort();
    await seite.waitForTimeout(300);
    const rechts1 = await ort();
    await seite.mouse.up();
    await seite.waitForTimeout(60);
    const los0 = await ort();
    await seite.waitForTimeout(300);
    const los1 = await ort();
    const zieh = {
      tipp: Math.hypot(nachTipp.x - vorTipp.x, nachTipp.y - vorTipp.y), tippPhase: nachTipp.phase,
      hoch: { dx: hoch1.x - hoch0.x, dy: hoch1.y - hoch0.y }, rechts: { dx: rechts1.x - rechts0.x, dy: rechts1.y - rechts0.y },
      los: Math.hypot(los1.x - los0.x, los1.y - los0.y), phase: los1.phase,
    };
    pruefe(zieh.tipp < 0.5 && zieh.tippPhase === "bereit" && zieh.hoch.dy > 25 && Math.abs(zieh.hoch.dx) < 2
      && zieh.rechts.dx > 15 && Math.abs(zieh.rechts.dy) < 2 && zieh.los < 0.5 && zieh.phase === "spiel",
      `Zeitlupen-Ninja: Ziehen und halten führt den Ninja nicht: ${JSON.stringify(zieh)}`);

    // Anschauen: Ein Lauf durch zwei Räume, im Bildtakt gespielt (der Plan
    // gibt jedem Schritt seine Eingabe), dann so, dass er bald getroffen
    // wird. Wer ihn anschaut, sieht dieselben Räume und den Ninja bis an
    // dieselbe Stelle – mit denselben Punkten. Auf einer frischen Seite:
    // Sonst läge dort schon ein Lauf mit ebenso vielen Punkten. Am Tor steht
    // beim Spielen wie beim Anschauen nur der Tempo-Bonus, nie «+10».
    const texteSammeln = () => seite.evaluate(() => {
      window.__njTexte = new Set();
      const sammle = () => {
        (window.LernappNinja?.state?.schriften || []).forEach((s) => window.__njTexte.add(s.text));
        requestAnimationFrame(sammle);
      };
      sammle();
    });
    const texte = () => seite.evaluate(() => [...(window.__njTexte || [])]);
    await kontext.close();
    ({ kontext, seite, neu } = await oeffne("Zora"));
    await texteSammeln();
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
        kennung, saat: d?.s ?? null, mitOrt: Boolean(window.LernappGeist.entpacke(geist?.bahn)?.c), punkte: st.punkte, geistPunkte: geist?.punkte || 0,
        raum: st.raum, grund: st.grund, x: st.aus?.x ?? null, y: st.aus?.y ?? null, W: st.W, welt: N.weltText(),
      };
    });
    pruefe(geplant.gerichtet && gespielt.kennung && gespielt.saat === geplant.saat && gespielt.mitOrt && gespielt.raum === 2 && gespielt.grund
      && gespielt.punkte >= 20 && gespielt.geistPunkte === gespielt.punkte,
      `Zeitlupen-Ninja: Der Lauf im Bildtakt geht nicht wie geplant oder wird nicht mit Saat und Weg hinterlegt: ${JSON.stringify({ geplant, gespielt: { ...gespielt, welt: undefined } })}`);
    const imSpiel = await texte();
    const boni = imSpiel.filter((t) => /^Tempo-Bonus \+\d+$/.test(t));
    pruefe(boni.length >= 1 && !imSpiel.some((t) => /^\+\d+$/.test(t)),
      `Zeitlupen-Ninja: Am Tor steht nicht nur der Tempo-Bonus: ${JSON.stringify(imSpiel)}`);
    await seite.goto(`${BASIS}/ninja?zuschauen=${gespielt.kennung}`, { waitUntil: "load" });
    await texteSammeln();
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
    const beimAnschauen = await texte();
    pruefe(boni.every((t) => beimAnschauen.includes(t)) && !beimAnschauen.some((t) => /^\+\d+$/.test(t)),
      `Zeitlupen-Ninja: Beim Anschauen steht am Tor nicht derselbe Tempo-Bonus: gespielt ${JSON.stringify(imSpiel)}, angeschaut ${JSON.stringify(beimAnschauen)}`);
    await kontext.close();

    // Live zuschauen: Solange der Spieler läuft, läuft der Ninja auch beim
    // Zuschauer – an derselben Stelle, nicht getroffen, nur weil der Lauf
    // noch wächst (geist.js, abgeschlossen).
    ({ kontext, seite, neu } = await oeffne("Zora"));
    await seite.keyboard.down("ArrowUp");
    await seite.waitForTimeout(300);
    const liveKennung = await seite.evaluate(() => localStorage.getItem("mini.id"));
    const zu = await kontext.newPage();
    await zu.route("**/cloud.js*", (route) => route.fulfill({ contentType: "text/javascript; charset=utf-8", body: ATTRAPPE }));
    await zu.route("https://www.gstatic.com/firebasejs/**", (route) => route.fulfill({ contentType: "text/javascript; charset=utf-8", body: "/* in der Prüfung nicht gebraucht */" }));
    zu.on("pageerror", (fehler) => fehlerAufSeite.push(String(fehler.message || fehler)));
    await zu.goto(`${BASIS}/ninja?mitschauen=${liveKennung}&wer=Zora`, { waitUntil: "load" });
    await seite.waitForTimeout(900);
    await seite.keyboard.up("ArrowUp");
    await seite.keyboard.down("ArrowRight");
    await seite.waitForTimeout(600);
    await seite.keyboard.up("ArrowRight");
    await zu.waitForTimeout(2400);
    const ninjaBei = (s) => s.evaluate(() => {
      const st = window.LernappNinja.state;
      return { phase: st.phase, schritt: st.schritt, x: Math.round(st.ninja.x), y: Math.round(st.ninja.y) };
    });
    const [dort, hier] = [await ninjaBei(seite), await ninjaBei(zu)];
    pruefe(dort.phase === "spiel" && dort.schritt === "lauf" && dort.y > 40 && hier.phase === "zuschauen" && hier.schritt === "lauf"
      && Math.hypot(hier.x - dort.x, hier.y - dort.y) < 3,
      `Zeitlupen-Ninja: Beim Live-Zuschauen steht der Ninja nicht dort, wo er läuft: ${JSON.stringify({ dort, hier })}`);
    await kontext.close();
  }

  // --- 4g24. Freitaucher: schaffbar, und wer zu lange unten bleibt, ist draussen ----
  // Oben trägt das Wasser, in NEUTRAL Metern schwebt der Taucher, tiefer
  // sinkt er. Ein Autopilot taucht mehrere gewürfelte Runden: Er nimmt die
  // Muschel, die am meisten bringt für den Weg, und kehrt um, wenn das Netz
  // zwei trägt oder die Luft knapp wird. Er kommt durch alle fünf
  // Tauchgänge ohne Blackout und bringt fast jedes Mal Perlen herauf – die
  // Plätze verlangen nichts Unmögliches. Wer nach dem Start nichts tut,
  // treibt an der Oberfläche, und Platz um Platz wird ausgelassen: die Runde
  // endet von selbst, mit null. Wer nur hinunter schwimmt, hat einen
  // Blackout – das Netz ist weg. Die Pfeiltasten schwimmen in ihre Richtung.
  // Und ein Lauf, angeschaut, an denselben Plätzen mit derselben Zahl.
  {
    const { kontext, seite } = await neueSeite({ width: 844, height: 390 });
    await seite.goto(`${BASIS}/freitaucher`, { waitUntil: "load" });
    await seite.waitForFunction(() => window.LernappFreitaucher?.state?.taucher && window.LernappFreitaucher.view.cssW > 0, null, { timeout: 8000 });
    const auf = await seite.evaluate(() => {
      const F = window.LernappFreitaucher;
      return { oben: F.auftrieb(0), schwebe: F.auftrieb(F.NEUTRAL), tief: F.auftrieb(30), werte: [5, 15, 25, 30, 40].map(F.wertBei).join(",") };
    });
    pruefe(auf.oben > 0.5 && Math.abs(auf.schwebe) < 1e-9 && auf.tief < -1 && auf.werte === "1,2,3,5,8",
      `Freitaucher: Auftrieb oder Wert der Perlen stimmen nicht: ${JSON.stringify(auf)}`);
    const PILOT = `(F, st) => {
      const t = st.taucher;
      const p = st.platz;
      if (st.schritt !== "oben" && st.schritt !== "tauchen") { F.lass(); return; }
      const d = -t.y;
      const h = F.haende(t);
      // Das Ziel: die Muschel, die am meisten bringt für den Weg dorthin –
      // und nur, wenn die Luft für hin und zurück reicht.
      const kosten = (m) => 0.05 + Math.hypot(m.x - t.x, m.y - t.y) * 0.018 + m.tiefe * 0.017;
      const offen = p.muscheln.filter((m) => !m.leer && kosten(m) < t.luft - 0.12);
      offen.sort((a, b) => b.wert / kosten(b) - a.wert / kosten(a));
      const ziel = offen[0];
      const hinauf = !ziel || st.netz.length >= 2 || (st.schritt === "tauchen" && t.luft < st.bedarf + 0.15);
      // Liegt ein Fels im Weg, erst über ihn hinweg.
      const umweg = (zx, zy) => {
        for (const f of p.felsen) {
          const ax = zx - t.x;
          const ay = zy - t.y;
          const l2 = ax * ax + ay * ay || 1;
          const u = ((f.x - t.x) * ax + (f.y - t.y) * ay) / l2;
          if (u < 0 || u > 1) continue;
          if (Math.hypot(t.x + ax * u - f.x, t.y + ay * u - f.y) < f.r + 0.9) return { x: f.x + (t.x < f.x ? -1 : 1) * (f.r + 0.8), y: f.y + f.r + 1.4 };
        }
        return { x: zx, y: zy };
      };
      if (hinauf) {
        if (d < 0.4) { F.lass(); return; }
        const w = umweg(t.x, 0.5);
        F.schwimme(w.x - t.x, w.y - t.y);
        return;
      }
      const w = umweg(ziel.x, ziel.y + 0.25);
      const dx = w.x - h.x;
      const dy = w.y - h.y;
      // Unter der Schwebetiefe sinkt er von selbst: gleiten, solange es
      // ohnehin hinuntergeht.
      if (d > F.NEUTRAL + 2 && dy < -3 && Math.abs(dx) < 3 && t.vy < -1.2) { F.lass(); return; }
      F.schwimme(dx, dy);
    }`;
    const runden = await seite.evaluate((quelle) => {
      const pilot = new Function(`return (${quelle})`)();
      const F = window.LernappFreitaucher;
      const st = F.state;
      const raus = [];
      for (let lauf = 0; lauf < 5; lauf += 1) {
        document.querySelector(".cm-bar-left .cm-icon-again").click();
        F.schwimme(0, -1);
        for (let n = 0; st.phase !== "ende" && n < 200000; n += 1) {
          pilot(F, st);
          F.takt(1 / 120);
        }
        F.lass();
        raus.push({ phase: st.phase, aus: st.aus, punkte: st.punkte, ergebnisse: st.ergebnisse });
      }
      return raus;
    }, PILOT);
    pruefe(runden.every((r) => r.phase === "ende" && r.aus === "fertig" && r.ergebnisse.length === 5 && r.punkte >= 6 && r.ergebnisse.filter((x) => x > 0).length >= 4),
      `Freitaucher: Der Autopilot kommt nicht ohne Blackout mit Perlen durch fünf Tauchgänge – ${JSON.stringify(runden)}`);

    // Wer nichts tut: Ein Druck zum Start, dann treibt er oben – jeder Platz
    // wird ausgelassen, und die Runde endet von selbst.
    const nichts = await seite.evaluate(() => {
      const F = window.LernappFreitaucher;
      const st = F.state;
      document.querySelector(".cm-bar-left .cm-icon-again").click();
      F.schwimme(0, -1);
      F.takt(1 / 120);
      F.lass();
      for (let n = 0; st.phase !== "ende" && n < 40000; n += 1) F.takt(1 / 120);
      return { phase: st.phase, punkte: st.punkte, ergebnisse: st.ergebnisse.join(","), zahl: document.querySelector(".cm-result-score")?.textContent };
    });
    pruefe(nichts.phase === "ende" && nichts.punkte === 0 && nichts.ergebnisse === "0,0,0,0,0" && nichts.zahl !== undefined,
      `Freitaucher: Wer nichts tut, kommt nicht von selbst ans Ende: ${JSON.stringify(nichts)}`);

    // Nur hinunter: Blackout, das Netz ist weg.
    const unten = await seite.evaluate(() => {
      const F = window.LernappFreitaucher;
      const st = F.state;
      document.querySelector(".cm-bar-left .cm-icon-again").click();
      F.schwimme(0.6, -1);
      let tiefe = 0;
      for (let n = 0; st.phase !== "ende" && n < 40000; n += 1) { F.takt(1 / 120); tiefe = Math.max(tiefe, -st.taucher.y); }
      F.lass();
      return { phase: st.phase, aus: st.aus, punkte: st.punkte, nr: st.nr, tiefe: Math.round(tiefe) };
    });
    pruefe(unten.phase === "ende" && unten.aus === "blackout" && unten.punkte === 0 && unten.nr === 0 && unten.tiefe > 4,
      `Freitaucher: Wer unten bleibt, hat keinen Blackout: ${JSON.stringify(unten)}`);

    // Die Pfeiltasten: Pfeil hinunter schwimmt hinunter, Pfeil links dazu
    // schräg; Loslassen gleitet.
    await seite.evaluate(() => document.querySelector(".cm-bar-left .cm-icon-again").click());
    const lage = () => seite.evaluate(() => ({ halten: window.LernappFreitaucher.state.halten, r: window.LernappFreitaucher.state.richtung && [Math.round(window.LernappFreitaucher.state.richtung.x * 100), Math.round(window.LernappFreitaucher.state.richtung.y * 100)] }));
    const schritte = [];
    await seite.keyboard.down("ArrowDown");
    schritte.push(await lage());
    await seite.keyboard.down("ArrowLeft");
    schritte.push(await lage());
    await seite.keyboard.up("ArrowDown");
    await seite.keyboard.up("ArrowLeft");
    schritte.push(await lage());
    const soll = [{ halten: true, r: [0, -100] }, { halten: true, r: [-71, -71] }, { halten: false, r: null }];
    pruefe(JSON.stringify(schritte) === JSON.stringify(soll), `Freitaucher: Die Pfeiltasten schwimmen nicht in ihre Richtung: ${JSON.stringify(schritte)}`);
    await kontext.close();
  }
  {
    // Ein Lauf in echter Zeit – zwei Tauchgänge mit Perlen, dann einer bis
    // zum Blackout –, aufgezeichnet und angeschaut: dieselben Plätze, am
    // Schluss dieselbe Zahl.
    const { kontext, seite } = await neueSeite({ width: 844, height: 390 });
    await seite.addInitScript(() => {
      if (sessionStorage.getItem("__taucher")) return;
      sessionStorage.setItem("__taucher", "1");
      localStorage.setItem("mini.name", "Zora");
    });
    await seite.goto(`${BASIS}/freitaucher`, { waitUntil: "load" });
    await seite.waitForFunction(() => window.LernappFreitaucher?.state?.taucher && window.LernappFreitaucher.view.cssW > 0, null, { timeout: 8000 });
    const PILOT = `(F, st) => {
      const t = st.taucher;
      const p = st.platz;
      if (st.schritt !== "oben" && st.schritt !== "tauchen") { F.lass(); return; }
      const d = -t.y;
      const h = F.haende(t);
      // Das Ziel: die Muschel, die am meisten bringt für den Weg dorthin –
      // und nur, wenn die Luft für hin und zurück reicht.
      const kosten = (m) => 0.05 + Math.hypot(m.x - t.x, m.y - t.y) * 0.018 + m.tiefe * 0.017;
      const offen = p.muscheln.filter((m) => !m.leer && kosten(m) < t.luft - 0.12);
      offen.sort((a, b) => b.wert / kosten(b) - a.wert / kosten(a));
      const ziel = offen[0];
      const hinauf = !ziel || st.netz.length >= 2 || (st.schritt === "tauchen" && t.luft < st.bedarf + 0.15);
      // Liegt ein Fels im Weg, erst über ihn hinweg.
      const umweg = (zx, zy) => {
        for (const f of p.felsen) {
          const ax = zx - t.x;
          const ay = zy - t.y;
          const l2 = ax * ax + ay * ay || 1;
          const u = ((f.x - t.x) * ax + (f.y - t.y) * ay) / l2;
          if (u < 0 || u > 1) continue;
          if (Math.hypot(t.x + ax * u - f.x, t.y + ay * u - f.y) < f.r + 0.9) return { x: f.x + (t.x < f.x ? -1 : 1) * (f.r + 0.8), y: f.y + f.r + 1.4 };
        }
        return { x: zx, y: zy };
      };
      if (hinauf) {
        if (d < 0.4) { F.lass(); return; }
        const w = umweg(t.x, 0.5);
        F.schwimme(w.x - t.x, w.y - t.y);
        return;
      }
      const w = umweg(ziel.x, ziel.y + 0.25);
      const dx = w.x - h.x;
      const dy = w.y - h.y;
      // Unter der Schwebetiefe sinkt er von selbst: gleiten, solange es
      // ohnehin hinuntergeht.
      if (d > F.NEUTRAL + 2 && dy < -3 && Math.abs(dx) < 3 && t.vy < -1.2) { F.lass(); return; }
      F.schwimme(dx, dy);
    }`;
    const welt = await seite.evaluate(() => window.LernappFreitaucher.weltText());
    await seite.evaluate((quelle) => new Promise((fertig) => {
      const pilot = new Function(`return (${quelle})`)();
      const F = window.LernappFreitaucher;
      const st = F.state;
      F.schwimme(0, -1);
      const lauf = () => {
        if (st.phase !== "spiel") { fertig(); return; }
        if (st.nr < 2) pilot(F, st); else F.schwimme(0.6, -1);
        requestAnimationFrame(lauf);
      };
      requestAnimationFrame(lauf);
    }), PILOT);
    await seite.waitForSelector(".cm-result-score", { timeout: 120000 }).catch(() => {});
    await seite.waitForFunction(() => [...(window.__miniGeister?.keys?.() || [])].some((k) => k.startsWith("freeDive_")), null, { timeout: 4000 }).catch(() => {});
    const gespielt = await seite.evaluate(() => {
      const kennung = localStorage.getItem("mini.id");
      const geist = window.__miniGeister?.get(`freeDive_${kennung}`) || null;
      let d = null;
      try { d = JSON.parse(geist?.bahn || "null"); } catch { d = null; }
      const st = window.LernappFreitaucher.state;
      return { kennung, saat: d?.s ?? null, mitOrt: Boolean(window.LernappGeist.entpacke(geist?.bahn)?.c), punkte: geist?.punkte || 0, gezaehlt: st.punkte, aus: st.aus, nr: st.nr };
    });
    pruefe(gespielt.kennung && Number.isInteger(gespielt.saat) && gespielt.mitOrt && gespielt.punkte > 0 && gespielt.punkte === gespielt.gezaehlt && gespielt.aus === "blackout" && gespielt.nr === 2,
      `Freitaucher: Der Lauf wird nicht mit Saat, Ort und Richtung hinterlegt: ${JSON.stringify(gespielt)}`);
    await seite.goto(`${BASIS}/freitaucher?zuschauen=${gespielt.kennung}`, { waitUntil: "load" });
    await seite.waitForFunction(() => window.LernappFreitaucher?.state?.phase === "zuschauen", null, { timeout: 8000 }).catch(() => {});
    const zu = await seite.evaluate(() => ({ phase: window.LernappFreitaucher.state.phase, welt: window.LernappFreitaucher.weltText() }));
    pruefe(zu.phase === "zuschauen" && zu.welt === welt,
      `Freitaucher: Beim Zuschauen entstehen andere Plätze:\n  gespielt ${welt}\n  angeschaut ${JSON.stringify(zu)}`);
    await seite.waitForFunction(() => window.LernappFreitaucher.state.schritt === "tauchen", null, { timeout: 15000 }).catch(() => {});
    const unterwegs = await seite.evaluate(() => ({ schritt: window.LernappFreitaucher.state.schritt, tiefe: -window.LernappFreitaucher.state.taucher.y }));
    pruefe(unterwegs.schritt === "tauchen" && unterwegs.tiefe > 1.5, `Freitaucher: Beim Zuschauen taucht er nicht ab: ${JSON.stringify(unterwegs)}`);
    await seite.waitForSelector(".gz-tafel:not([hidden]) .gz-nochmal", { timeout: 120000 }).catch(() => {});
    const schluss = await seite.evaluate(() => ({ punkte: window.LernappFreitaucher.state.punkte, nr: window.LernappFreitaucher.state.nr, tafel: Boolean(document.querySelector(".gz-tafel:not([hidden]) .gz-nochmal")) }));
    pruefe(schluss.tafel && schluss.punkte === gespielt.punkte && schluss.nr === 2,
      `Freitaucher: Am Ende des angeschauten Laufs steht nicht dieselbe Zahl (oder keine Tafel): ${JSON.stringify({ ...schluss, gespielt: gespielt.punkte })}`);
    await kontext.close();
  }

  // --- 4g25. Schwarm: perfekt heisst genau durch die Mitte, ballen heisst durchkommen --
  // Das erste Spiel mit WebGL: Die Welt steht da, ohne dass sich der Browser
  // beschwert. Jede Reihe Hindernisse hat ein Tor: eine Lücke am freien Weg,
  // links und rechts gleich weit, und auf ihrer ganzen Breite trifft nichts –
  // nachgerechnet mit derselben Rechnung, mit der das Spiel trifft. Von Tor zu
  // Tor geht der Weg nie weiter zur Seite, als sich in der Zeit lenken lässt
  // (abzüglich der Pause, in der man geballt ist).
  //
  // Die Piloten (Fassung t2, gemessen in der Planung): Wer die Mitte jedes
  // Tors trifft und kurz davor ballt, kommt immer an, verliert keinen Vogel
  // und ist fast immer perfekt – in jeder Welt ähnlich viele Punkte. Wer
  // immer 2 m daneben fliegt, holt keine Kette und nicht einmal die Hälfte.
  // Wer nie ballt, verliert an jedem Spalt. Wer nichts tut, zerschellt an der
  // ersten Nadel. Die Mitte am Fels beendet die Runde sofort; unter einem
  // Dutzend zerstreut sich der Schwarm. Ein perfektes Tor bringt Vögel, die
  // Kette mehr; ein grosser Trupp kommt nur, wenn die Mitte durch seinen Ring
  // geht. Der Falke: geballt im letzten Moment – pariert; zu früh – die
  // Kette bricht; aufgefächert – er reisst ein Sechstel heraus. Die Tasten
  // und zwei Finger ballen; ein Lauf, angeschaut, ballt an denselben Stellen.
  {
    const { kontext, seite } = await neueSeite({ width: 844, height: 390 });
    const vorher = fehlerAufSeite.length;
    await seite.goto(`${BASIS}/schwarm`, { waitUntil: "load" });
    await seite.waitForFunction(() => window.LernappSchwarm?.state?.welt && window.LernappSchwarm.view.cssW > 0, null, { timeout: 8000 });
    await seite.waitForTimeout(300);
    const bild = await seite.evaluate(() => {
      const S = window.LernappSchwarm;
      const leinwand = document.querySelector(".sw-canvas");
      return { ok: S.bild.ok, programme: Object.keys(S.bild.prog).length, breit: leinwand?.width || 0, voegel: S.vg.n, ohne: Boolean(document.querySelector(".sw-ohne")) };
    });
    pruefe(bild.ok && bild.programme === 6 && bild.breit > 300 && bild.voegel === 150 && !bild.ohne,
      `Schwarm: Die Welt (WebGL 2) steht nicht da: ${JSON.stringify(bild)}`);

    // Die Tore, in fünf gewürfelten Abenden: auf ihrer Breite frei, in jeder
    // Höhe, in der ein geballter Schwarm fliegt – und der Weg dazwischen
    // lenkbar.
    const weg = await seite.evaluate(() => {
      const S = window.LernappSchwarm;
      const st = S.state;
      const befunde = [];
      let tore = 0;
      let wande = 0;
      let falken = 0;
      const arten = new Set();
      for (let lauf = 0; lauf < 5; lauf += 1) {
        document.querySelector(".cm-bar-left .cm-icon-again").click();
        S.weltBis(S.Z_ENDE + 400);
        const W = st.welt;
        falken += W.falken.length;
        for (const d of W.dinge) if (d.art !== "insel") arten.add(d.art);
        for (const t of W.tore) {
          tore += 1;
          if (t.art === "wand") wande += 1;
          const neben = Math.abs(t.x - S.wegBei(t.z));
          if (neben > 0.01) befunde.push(`Tor (${t.art}) bei ${t.z.toFixed(0)} m liegt ${neben.toFixed(1)} m neben dem Weg`);
          // Quer durch die Lücke, in drei Höhen: Was dort fliegt, darf nichts treffen.
          for (const y of [S.FLUG_Y - 2.5, S.FLUG_Y, S.FLUG_Y + 2.5]) {
            for (let u = -0.98; u <= 0.98; u += 0.07) {
              const x = t.x + u * t.halb;
              const hier = W.dinge.find((d) => d.art !== "insel" && Math.abs(d.z - t.z) < 26 && S.trifft(d, x, y, t.z - 30, t.z + 30));
              if (hier) { befunde.push(`Tor (${t.art}) bei ${t.z.toFixed(0)} m: ${hier.art} bei x ${x.toFixed(1)}, Höhe ${y.toFixed(1)}`); break; }
            }
          }
          if (t.halb < S.ballRadiusBei(400) + 0.4) befunde.push(`Tor (${t.art}) bei ${t.z.toFixed(0)} m ist zu eng für einen Ball (${t.halb.toFixed(2)} m)`);
        }
        // Von Tor zu Tor nie weiter zur Seite, als sich lenken lässt.
        for (let i = 1; i < W.weg.length; i += 1) {
          const a = W.weg[i - 1];
          const b = W.weg[i];
          const kann = S.reichBei(b.z, b.z - a.z);
          if (Math.abs(b.x - a.x) > kann * 1.05 + 0.01 && b.z - a.z > 1) befunde.push(`Weg bei ${b.z.toFixed(0)} m: ${Math.abs(b.x - a.x).toFixed(1)} m zur Seite, lenkbar ${kann.toFixed(1)}`);
        }
        if (!W.fertig || W.weg[W.weg.length - 1].z !== S.Z_ENDE) befunde.push("Die Welt endet nicht am Schlafplatz");
        if (!W.erstesBallen || W.erstesBallen > 900) befunde.push(`Die erste Wand kommt zu spät (${W.erstesBallen})`);
      }
      return { befunde: befunde.slice(0, 6), tore, wande, falken, arten: [...arten].sort().join(",") };
    });
    pruefe(weg.befunde.length === 0 && weg.tore > 120 && weg.wande >= 20 && weg.falken >= 3 && weg.arten === "bogen,leitung,nadel,wand,windrad",
      `Schwarm: Die Tore sind nicht frei (oder der Weg nicht lenkbar) – ${JSON.stringify(weg)}`);

    // Der Pilot: kennt die Welt. Er zielt nah am Tor auf dessen Mitte (dazu
    // daneben: so weit daneben), ballt kurz davor, wenn der aufgefächerte
    // Schwarm nicht hindurchpasst, und löst, wenn das Ende durch ist. Den
    // Falken pariert er im letzten Moment. nie: ballt nie.
    const PILOT = `(S, st, { daneben = 0, nie = false } = {}) => {
      const W = st.welt;
      const v = S.tempoBei(st.z);
      const m = S.masse();
      let tor = null;
      for (let i = W.torVon; i < W.tore.length; i += 1) if (W.tore[i].zustand === "offen") { tor = W.tore[i]; break; }
      const ziel = (tor && (tor.z - st.z) / v < 0.9 ? tor.x : S.wegBei(st.z + v * 0.3)) + daneben;
      const d = ziel - st.x - st.vx * 0.2;
      let ball = false;
      const R = S.radiusBei(S.vg.n);
      if (!nie) {
        for (let i = W.torVon; i < W.tore.length; i += 1) {
          const t = W.tore[i];
          if (t.z > st.z + v * 3) break;
          if (R + 0.6 + Math.abs(daneben) < t.halb) continue;
          const bis = (t.z - st.z) / v;
          if (bis < S.BALL_VERZUG + 0.24 + R * 1.4 / v * 0.75 && !(st.hinten > t.z + S.DURCH + 0.3)) ball = true;
        }
        for (let i = W.falkeVon; i < W.falken.length; i += 1) {
          const f = W.falken[i];
          if (f.zustand !== "offen" && f.zustand !== "stoss") continue;
          const bis = (f.z - st.z) / v;
          if (bis < 0.3 + S.BALL_VERZUG && bis > -0.15) ball = true;
        }
      }
      S.ballen(ball);
      S.lenke(ball ? 0 : d > 0.08 ? 1 : d < -0.08 ? -1 : 0);
    }`;
    const fliegen = (art, n, wie = {}) => seite.evaluate(({ quelle, n, wie }) => {
      const pilot = quelle ? new Function(`return (${quelle})`)() : null;
      const S = window.LernappSchwarm;
      const st = S.state;
      const raus = [];
      for (let lauf = 0; lauf < n; lauf += 1) {
        document.querySelector(".cm-bar-left .cm-icon-again").click();
        S.losGehts();
        for (let k = 0; st.phase !== "ende" && k < 200000; k += 1) {
          if (pilot) pilot(S, st, wie);
          S.takt(1 / 120);
        }
        S.lenke(0);
        S.ballen(false);
        raus.push({
          an: st.angekommen, grund: st.grund, meter: st.meter, voegel: S.vg.n, punkte: st.punkte, verloren: st.verloren,
          perfekte: st.perfekte, tore: st.tore, perfektTore: st.welt.tore.filter((t) => t.zustand === "perfekt").length, bonus: st.bonus, zahl: document.querySelector(".cm-result-score") !== null,
          falken: st.welt.falken.filter((f) => f.z < st.z).map((f) => f.zustand[0]).join(""),
        });
      }
      return raus;
    }, { quelle: art === "nichts" ? null : PILOT, n, wie });
    const genau = await fliegen("pilot", 4);
    const mittel = (liste) => liste.reduce((summe, r) => summe + r.punkte, 0) / Math.max(1, liste.length);
    const bester = mittel(genau);
    pruefe(genau.every((r) => r.an && r.verloren <= 3 && r.bonus === r.voegel && r.perfekte >= 0.8 * r.tore && r.zahl && !/[rl]/.test(r.falken))
      && Math.min(...genau.map((r) => r.punkte)) > 0.85 * Math.max(...genau.map((r) => r.punkte)),
    `Schwarm: Der Pilot, der genau durch die Mitte fliegt und rechtzeitig ballt, kommt nicht sauber und perfekt an (oder die Welten sind sehr ungleich) – ${JSON.stringify(genau)}`);
    const daneben = await fliegen("pilot", 3, { daneben: 2 });
    pruefe(daneben.every((r) => r.perfektTore < 0.1 * r.tore) && mittel(daneben) < 0.5 * bester,
      `Schwarm: Wer 2 m neben der Mitte fliegt, ist zu gut dran – ${JSON.stringify({ bester, daneben })}`);
    const nie = await fliegen("pilot", 3, { nie: true });
    pruefe(nie.every((r) => r.verloren > 60) && mittel(nie) < 0.4 * bester,
      `Schwarm: Wer nie ballt, kommt zu gut durch die Spalten – ${JSON.stringify({ bester, nie })}`);
    const nichts = await fliegen("nichts", 3);
    pruefe(nichts.every((r) => !r.an && r.grund === "fels" && r.meter < 1500),
      `Schwarm: Wer nichts tut, zerschellt nicht an den ersten Felsen: ${JSON.stringify(nichts)}`);

    // Die Mitte am Fels: sofort vorbei. Unter einem Dutzend: zerstreut.
    const enden = await seite.evaluate(() => {
      const S = window.LernappSchwarm;
      const st = S.state;
      document.querySelector(".cm-bar-left .cm-icon-again").click();
      S.losGehts();
      S.weltBis(1500);
      // Die Nadel, die das erste Tor einfasst.
      const tor0 = st.welt.tore[0];
      const nadel = tor0.dinge.filter((d) => d.art === "nadel" && Math.abs(d.z - tor0.z) < 0.01).sort((a, b) => Math.abs(a.x - tor0.x) - Math.abs(b.x - tor0.x))[0];
      for (let k = 0; st.z < nadel.z - 20 && k < 60000; k += 1) { st.x = nadel.x; st.vx = 0; S.takt(1 / 120); }
      for (let k = 0; st.schritt === "flug" && st.z < nadel.z + 5 && k < 6000; k += 1) { st.x = nadel.x; st.vx = 0; S.takt(1 / 120); }
      const fels = { schritt: st.schritt, grund: st.grund, z: st.z - nadel.z, r: nadel.r };
      for (let k = 0; st.phase !== "ende" && k < 2000; k += 1) S.takt(1 / 120);
      const felsText = document.querySelector(".cm-result-detail")?.textContent || "";
      document.querySelector(".cm-bar-left .cm-icon-again").click();
      S.losGehts();
      for (let k = 0; k < 120; k += 1) S.takt(1 / 120);
      const vorher = { phase: st.phase, voegel: S.vg.n };
      S.vg.n = S.MINDEST - 1;
      let schritte = 0;
      for (; st.phase !== "ende" && schritte < 2000; schritte += 1) S.takt(1 / 120);
      return { fels, felsText, vorher, phase: st.phase, grund: st.grund, sekunden: schritte / 120, text: document.querySelector(".cm-result-detail")?.textContent || "" };
    });
    pruefe(enden.fels.schritt === "aus" && enden.fels.grund === "fels" && enden.fels.z > -enden.fels.r - 1 && enden.fels.z < 1 && /zerschellt/.test(enden.felsText)
      && enden.vorher.phase === "spiel" && enden.vorher.voegel === 150 && enden.phase === "ende" && enden.grund === "zerstreut" && enden.sekunden < 3 && /Zerstreut/.test(enden.text),
    `Schwarm: Die Mitte am Fels oder elf Vögel beenden die Runde nicht: ${JSON.stringify(enden)}`);

    // Perfekt: genau durch die Mitte – Vögel dazu, in der Kette mehr. Knapp
    // daneben: nichts, und die Kette bricht. Ein grosser Trupp: nur durch
    // seinen Ring.
    const perfekt = await seite.evaluate(() => {
      const S = window.LernappSchwarm;
      const st = S.state;
      document.querySelector(".cm-bar-left .cm-icon-again").click();
      S.losGehts();
      S.weltBis(1500);
      const raus = [];
      // Durch die ersten drei Tore genau, durch das vierte 1,2 m daneben –
      // geballt, damit sicher kein Vogel am Fels hängt.
      for (let i = 0; i < 4; i += 1) {
        const tor = st.welt.tore[i];
        const n0 = S.vg.n;
        for (let k = 0; st.z < tor.z + 16 && st.phase === "spiel" && k < 60000; k += 1) {
          st.x = tor.x + (i === 3 ? 1.2 : 0);
          st.vx = 0;
          S.ballen(st.z > tor.z - 25 && st.z < tor.z + 8);
          S.takt(1 / 120);
        }
        raus.push({ zustand: tor.zustand, dazu: S.vg.n - n0, kette: st.kette });
      }
      S.ballen(false);
      // Ein Trupp: mitten durch den Ring – und einer drei Meter daneben.
      const trupps = [];
      for (const weit of [0, 3.2]) {
        for (let v = 0; v < 20 && (v === 0 || !st.welt.trupps.length); v += 1) {
          document.querySelector(".cm-bar-left .cm-icon-again").click();
          S.losGehts();
          S.weltBis(3000);
        }
        const t = st.welt.trupps[0];
        st.welt.dinge.length = 0;
        st.welt.tore.length = 0;
        for (let k = 0; st.z < t.z + 10 && st.phase === "spiel" && k < 90000; k += 1) { st.x = t.x + weit; st.vx = 0; S.takt(1 / 120); }
        trupps.push({ zustand: t.zustand, geholt: st.geholt, n: t.n });
      }
      return { tore: raus, trupps };
    });
    pruefe(JSON.stringify(perfekt.tore.map((t) => [t.zustand, t.dazu, t.kette])) === JSON.stringify([["perfekt", 2, 1], ["perfekt", 4, 2], ["perfekt", 6, 3], ["sauber", 0, 0]])
      && perfekt.trupps[0].zustand === "geholt" && perfekt.trupps[0].geholt === perfekt.trupps[0].n && perfekt.trupps[1].zustand === "verpasst" && perfekt.trupps[1].geholt === 0,
    `Schwarm: Perfekt, Kette oder Trupp stimmen nicht: ${JSON.stringify(perfekt)}`);

    // Der Falke: geballt im letzten Moment, zu früh, aufgefächert.
    const falke = await seite.evaluate(() => {
      const S = window.LernappSchwarm;
      const st = S.state;
      const raus = {};
      for (const [wie, ballVor] of [["spaet", 0.3], ["frueh", 1.4], ["offen", -1]]) {
        let f = null;
        for (let v = 0; v < 30 && !f; v += 1) {
          document.querySelector(".cm-bar-left .cm-icon-again").click();
          S.losGehts();
          S.weltBis(3600);
          f = st.welt.falken[0];
        }
        st.welt.dinge.length = 0;
        st.welt.tore.length = 0;
        st.welt.falken.splice(1);
        const kette = 3;
        for (let k = 0; st.z < f.z + 20 && st.phase === "spiel" && k < 200000; k += 1) {
          if (k === 0) st.kette = kette;
          const bis = (f.z - st.z) / S.tempoBei(st.z);
          S.ballen(ballVor > 0 && bis < ballVor + S.BALL_VERZUG && bis > -0.2);
          S.takt(1 / 120);
        }
        S.ballen(false);
        raus[wie] = { zustand: f.zustand, kette: st.kette, voegel: S.vg.n, raub: f.raub || 0 };
      }
      return raus;
    });
    pruefe(falke.spaet.zustand === "pariert" && falke.spaet.kette === 4 && falke.frueh.zustand === "leer" && falke.frueh.kette === 0
      && falke.offen.zustand === "raub" && falke.offen.kette === 0 && falke.offen.raub >= 20 && falke.offen.raub <= 30,
    `Schwarm: Der Falke wird nicht pariert, nicht verfehlt oder raubt nicht: ${JSON.stringify(falke)}`);

    // Die Tasten: links, dann rechts dazu – erst lenkt die letzte, nach
    // einem Augenblick ballt er (und lenkt nicht). ↓ ballt allein.
    await seite.evaluate(() => document.querySelector(".cm-bar-left .cm-icon-again").click());
    const lage = () => seite.evaluate(() => ({ phase: window.LernappSchwarm.state.phase, lenk: window.LernappSchwarm.state.lenk, ballen: window.LernappSchwarm.state.ballen }));
    const warte = (sekunden) => seite.evaluate((s) => { for (let k = 0; k < s * 120; k += 1) window.LernappSchwarm.takt(1 / 120); }, sekunden);
    const schritte = [await lage()];
    await seite.keyboard.down("ArrowLeft");
    await warte(0.02);
    schritte.push(await lage());
    await seite.keyboard.down("ArrowRight");
    await warte(0.02);
    schritte.push(await lage());
    await warte(0.15);
    schritte.push(await lage());
    await seite.keyboard.up("ArrowRight");
    await warte(0.02);
    schritte.push(await lage());
    await seite.keyboard.up("ArrowLeft");
    await seite.keyboard.down("ArrowDown");
    await warte(0.15);
    schritte.push(await lage());
    await seite.keyboard.up("ArrowDown");
    await warte(0.02);
    schritte.push(await lage());
    const soll = [
      { phase: "bereit", lenk: 0, ballen: false }, { phase: "spiel", lenk: -1, ballen: false }, { phase: "spiel", lenk: 1, ballen: false },
      { phase: "spiel", lenk: 0, ballen: true }, { phase: "spiel", lenk: -1, ballen: false }, { phase: "spiel", lenk: 0, ballen: true },
      { phase: "spiel", lenk: 0, ballen: false },
    ];
    pruefe(JSON.stringify(schritte) === JSON.stringify(soll), `Schwarm: Die Tasten lenken oder ballen nicht: ${JSON.stringify(schritte)}`);
    // Und die Finger: rechts vom Bild lenkt nach rechts, über die Mitte
    // gezogen nach links; ein zweiter Finger auf der anderen Seite ballt.
    await seite.evaluate(() => document.querySelector(".cm-bar-left .cm-icon-again").click());
    const finger = (art, id, x) => seite.evaluate(({ art, id, x }) => {
      const ziel = art === "pointerdown" ? document.querySelector("#sw-stage .sw-feld") : window;
      ziel.dispatchEvent(new PointerEvent(art, { pointerId: id, clientX: x, clientY: 250, bubbles: true }));
    }, { art, id, x });
    await finger("pointerdown", 1, 700);
    const rechts = await lage();
    await finger("pointermove", 1, 120);
    const links = await lage();
    await finger("pointerdown", 2, 700);
    await warte(0.15);
    const beide = await lage();
    await finger("pointerup", 2, 700);
    await warte(0.02);
    const einer = await lage();
    await finger("pointerup", 1, 120);
    const los = await lage();
    pruefe(rechts.phase === "spiel" && rechts.lenk === 1 && links.lenk === -1 && beide.ballen && beide.lenk === 0 && !einer.ballen && einer.lenk === -1 && los.lenk === 0,
      `Schwarm: Die Finger lenken oder ballen nicht: ${JSON.stringify({ rechts, links, beide, einer, los })}`);
    pruefe(fehlerAufSeite.length === vorher, `Schwarm: Der Browser hat sich beschwert – ${fehlerAufSeite.slice(vorher).join(" / ")}`);
    await kontext.close();
  }
  {
    // Ein Lauf in echter Zeit – ein Stück dem Weg nach, einmal geballt, dann
    // zerstreut –, aufgezeichnet und angeschaut: derselbe Abend, an derselben
    // Stelle geballt, am Schluss dieselbe Zahl.
    const { kontext, seite } = await neueSeite({ width: 844, height: 390 });
    await seite.addInitScript(() => {
      if (sessionStorage.getItem("__schwarm")) return;
      sessionStorage.setItem("__schwarm", "1");
      localStorage.setItem("mini.name", "Zora");
    });
    await seite.goto(`${BASIS}/schwarm`, { waitUntil: "load" });
    await seite.waitForFunction(() => window.LernappSchwarm?.state?.welt && window.LernappSchwarm.view.cssW > 0, null, { timeout: 8000 });
    const welt = await seite.evaluate(() => window.LernappSchwarm.weltText());
    await seite.evaluate(() => new Promise((fertig) => {
      const S = window.LernappSchwarm;
      const st = S.state;
      // Nichts im Weg: Hier geht es um die Aufzeichnung, nicht ums Fliegen.
      S.losGehts();
      st.welt.dinge.length = 0;
      const lauf = () => {
        if (st.phase !== "spiel") { fertig(); return; }
        st.welt.dinge.length = 0;
        if (st.z > 420 && st.schritt === "flug") S.vg.n = Math.min(S.vg.n, S.MINDEST - 2);
        S.ballen(st.z > 200 && st.z < 300);
        const ziel = S.wegBei(st.z + S.tempoBei(st.z) * 0.3);
        const d = ziel - st.x - st.vx * 0.2;
        S.lenke(d > 0.4 ? 1 : d < -0.4 ? -1 : 0);
        requestAnimationFrame(lauf);
      };
      requestAnimationFrame(lauf);
    }));
    await seite.waitForSelector(".cm-result-score", { timeout: 60000 }).catch(() => {});
    await seite.waitForFunction(() => [...(window.__miniGeister?.keys?.() || [])].some((k) => k.startsWith("flockFlight_")), null, { timeout: 4000 }).catch(() => {});
    const gespielt = await seite.evaluate(() => {
      const kennung = localStorage.getItem("mini.id");
      const geist = window.__miniGeister?.get(`flockFlight_${kennung}`) || null;
      let d = null;
      try { d = JSON.parse(geist?.bahn || "null"); } catch { d = null; }
      const st = window.LernappSchwarm.state;
      const c = window.LernappGeist.entpacke(geist?.bahn)?.c || [];
      return { kennung, level: geist?.level, saat: d?.s ?? null, geballt: c.some((x) => x >= window.LernappSchwarm.GEBALLT_C), punkte: geist?.punkte || 0, gezaehlt: st.punkte, meter: st.meter, an: st.angekommen };
    });
    pruefe(gespielt.kennung && gespielt.level === "t2" && Number.isInteger(gespielt.saat) && gespielt.geballt && gespielt.punkte > 10 && gespielt.punkte === gespielt.gezaehlt && gespielt.meter > 420 && !gespielt.an,
      `Schwarm: Der Lauf wird nicht mit Saat, Ort, Schwarmgrösse und Ballen hinterlegt (Fassung t2): ${JSON.stringify(gespielt)}`);
    await seite.goto(`${BASIS}/schwarm?zuschauen=${gespielt.kennung}`, { waitUntil: "load" });
    await seite.waitForFunction(() => window.LernappSchwarm?.state?.phase === "zuschauen", null, { timeout: 8000 }).catch(() => {});
    const zu = await seite.evaluate(() => ({ phase: window.LernappSchwarm.state.phase, welt: window.LernappSchwarm.weltText() }));
    pruefe(zu.phase === "zuschauen" && zu.welt === welt,
      `Schwarm: Beim Zuschauen entsteht ein anderer Abend:\n  gespielt ${welt}\n  angeschaut ${JSON.stringify(zu)}`);
    await seite.waitForFunction(() => window.LernappSchwarm.state.z > 170, null, { timeout: 15000 }).catch(() => {});
    const unterwegs = await seite.evaluate(() => ({ z: Math.round(window.LernappSchwarm.state.z), voegel: window.LernappSchwarm.vg.n, lenk: window.LernappSchwarm.state.lenk }));
    pruefe(unterwegs.z > 150 && unterwegs.voegel >= 100 && unterwegs.lenk === 0, `Schwarm: Beim Zuschauen fliegt der Schwarm nicht mit: ${JSON.stringify(unterwegs)}`);
    const geballt = await seite.waitForFunction(() => window.LernappSchwarm.state.ball > 0.5, null, { timeout: 15000 }).then(() => seite.evaluate(() => Math.round(window.LernappSchwarm.state.z))).catch(() => null);
    pruefe(geballt !== null && geballt > 190 && geballt < 320, `Schwarm: Beim Zuschauen ballt sich der Schwarm nicht dort, wo er es damals tat: ${geballt}`);
    await seite.waitForSelector(".gz-tafel:not([hidden]) .gz-nochmal", { timeout: 60000 }).catch(() => {});
    const schluss = await seite.evaluate(() => ({ punkte: window.LernappSchwarm.state.punkte, schritt: window.LernappSchwarm.state.schritt, tafel: Boolean(document.querySelector(".gz-tafel:not([hidden]) .gz-nochmal")), ergebnis: Boolean(document.querySelector(".cm-result-score")) }));
    pruefe(schluss.tafel && schluss.punkte === gespielt.punkte && schluss.schritt === "aus" && !schluss.ergebnis,
      `Schwarm: Am Ende des angeschauten Laufs steht nicht dieselbe Zahl (oder keine Tafel): ${JSON.stringify({ ...schluss, gespielt: gespielt.punkte })}`);
    await kontext.close();
  }

  // --- 4g26. Die Welle: schaffbar, und wer nichts tut, wird verschluckt ----------------
  // Das zweite Spiel mit WebGL: Die Welt steht da, ohne dass sich der Browser
  // beschwert – mit der Surferin, deren Netz in jedem Bild neu entsteht. Die
  // Abschnitte der Welle kommen aus dem Zufall – schnelle, langsame,
  // Doppelschläge, keiner in den ersten Sekunden –, und über jedem schnellen
  // läuft die Gischt voraus. Nachgerechnet bleibt dem, der gut pumpt, immer
  // Luft zum Schaum (ideallinie); ein Autopilot, der immer pumpt, kommt in
  // mehreren gewürfelten Runden bis an den Strand, und einer, der mit der
  // Höhe an der Wand seine Tiefe in der Röhre einstellt (und pumpt, wenn der
  // Schaum anzieht), holt dort ein Vielfaches der Punkte. Pumpen gibt
  // Schwung: Wer rauf und runter fährt, wird schneller als auf der Linie.
  // Wer nichts tut, sinkt ins Flache und wird verschluckt; wer immer hinauf
  // lenkt, fliegt über die Lippe. Punkte gibt es nur in der Röhre, tiefer
  // mehr, mit der Serie mehr. Tasten und Finger lenken: links (und Pfeil
  // nach oben, Leertaste) hinauf, rechts hinunter. Und ein Lauf, angeschaut,
  // auf derselben Welle mit derselben Zahl.
  {
    const { kontext, seite } = await neueSeite({ width: 844, height: 390 });
    const vorher = fehlerAufSeite.length;
    await seite.goto(`${BASIS}/welle`, { waitUntil: "load" });
    await seite.waitForFunction(() => window.LernappWelle?.state?.welt && window.LernappWelle.view.cssW > 0, null, { timeout: 8000 });
    await seite.waitForTimeout(300);
    const bild = await seite.evaluate(() => {
      const W = window.LernappWelle;
      const leinwand = document.querySelector(".wl-canvas");
      return { ok: W.bild.ok, programme: Object.keys(W.bild.prog).length, breit: leinwand?.width || 0, reihen: W.REIHEN, phase: W.state.phase, ohne: Boolean(document.querySelector(".wl-ohne")) };
    });
    pruefe(bild.ok && bild.programme === 6 && bild.breit > 300 && bild.reihen > 50 && bild.phase === "bereit" && !bild.ohne,
      `Die Welle: Die Welt (WebGL 2) steht nicht da: ${JSON.stringify(bild)}`);

    // Die Surferin: ein Netz aus glatten Flächen, jedes Bild neu – immer
    // gleich viele Ecken, alle Richtungen der Länge eins, nichts ausserhalb
    // von Brett und Körper.
    const figur = await seite.evaluate(() => {
      const W = window.LernappWelle;
      const raus = { ecken: 0, schlecht: 0, aussen: 0, gleich: true };
      for (const [duck, druck, wand] of [[0.2, 0, 0], [1, 0.6, 1], [0.6, -0.5, 0.4]]) {
        const p = W.haltungNeu();
        Object.assign(p, { duck, druck, wand, roll: 0.3, lehn: 0.2 });
        const netz = W.figurJetzt(p);
        if (raus.ecken && raus.ecken !== netz.length / 6) raus.gleich = false;
        raus.ecken = netz.length / 6;
        for (let i = 0; i < netz.length; i += 6) {
          const l = Math.hypot(netz[i + 3], netz[i + 4], netz[i + 5]);
          if (!(Math.abs(l - 1) < 1e-3)) raus.schlecht += 1;
          if (!(Math.abs(netz[i]) < 1.2 && netz[i + 1] > -0.2 && netz[i + 1] < 1.9 && Math.abs(netz[i + 2]) < 1.1)) raus.aussen += 1;
        }
      }
      return raus;
    });
    pruefe(figur.ecken > 1500 && figur.ecken < 5000 && figur.gleich && figur.schlecht === 0 && figur.aussen === 0,
      `Die Welle: Das Netz der Surferin stimmt nicht: ${JSON.stringify(figur)}`);

    // Die Abschnitte, in sechs gewürfelten Runden – und die schnellste Linie
    // nachgerechnet.
    const welt = await seite.evaluate(() => {
      const W = window.LernappWelle;
      const st = W.state;
      const befunde = [];
      let abschnitte = 0;
      let engste = Infinity;
      const arten = new Set();
      for (let lauf = 0; lauf < 6; lauf += 1) {
        document.querySelector(".cm-bar-left .cm-icon-again").click();
        const ab = st.welt.ab;
        abschnitte += ab.length;
        ab.forEach((a, i) => {
          arten.add(a.art);
          if (a.t0 < 6) befunde.push(`Ein Abschnitt beginnt schon nach ${a.t0.toFixed(1)} s`);
          if (i && a.t0 < ab[i - 1].t1) befunde.push(`Zwei Abschnitte überlappen bei ${a.t0.toFixed(1)} s`);
          if ((a.art === "langsam") !== (a.f < 1) || a.f < 0.7 || a.f > 1.75) befunde.push(`${a.art} bei ${a.t0.toFixed(1)} s: Faktor ${a.f.toFixed(2)}`);
          if (!(a.z1 > a.z0)) befunde.push(`Abschnitt bei ${a.t0.toFixed(1)} s hat keinen Ort längs der Welle`);
          // Die Gischt: über einem schnellen Abschnitt, und schon ein Stück davor.
          const mitten = W.gischtBei(st.z0 + (a.z0 + a.z1) / 2);
          const davor = W.gischtBei(st.z0 + a.z0 - 4);
          if (a.f > 1 && !(mitten > 0.4 && davor > 0.1)) befunde.push(`Keine Gischt über dem schnellen Abschnitt bei ${a.t0.toFixed(1)} s (${mitten.toFixed(2)}, davor ${davor.toFixed(2)})`);
          if (a.f < 1 && mitten > 0 && !ab.some((b) => b.f > 1 && b.z0 - 10 < (a.z0 + a.z1) / 2 && b.z1 + 2 > (a.z0 + a.z1) / 2)) befunde.push(`Gischt über dem langsamen Abschnitt bei ${a.t0.toFixed(1)} s`);
        });
        // Der Schaum läuft immer voran, in den ersten Sekunden gemächlich.
        for (let t = 0.5; t < W.DAUER; t += 0.5) {
          if (!(W.schaumBei(t) > W.schaumBei(t - 0.5))) befunde.push(`Der Schaum steht bei ${t} s`);
        }
        if (!(W.faktorBei(1) < 0.9 && W.faktorBei(7) >= 0.99)) befunde.push(`Die ersten Sekunden sind nicht sanft: ${W.faktorBei(1).toFixed(2)}`);
        // Wer immer die schnellste Linie fährt, behält Luft.
        const eng = W.ideallinie(st.welt);
        engste = Math.min(engste, eng.d);
        if (!(eng.d >= W.RESERVE - 0.01)) befunde.push(`Auf der schnellsten Linie bleiben nur ${eng.d.toFixed(1)} m (bei ${eng.t.toFixed(1)} s)`);
      }
      return { befunde: befunde.slice(0, 6), abschnitte, engste, arten: [...arten].sort().join(",") };
    });
    pruefe(welt.befunde.length === 0 && welt.abschnitte > 60 && welt.arten === "doppel,langsam,schnell",
      `Die Welle: Die gewürfelten Abschnitte stimmen nicht – ${JSON.stringify(welt)}`);

    // Zwei Autopiloten. Beide lenken hinauf, hinunter oder geradeaus, so
    // grob wie ein Mensch: der eine pumpt immer rauf und runter (er fährt
    // dem Schaum davon, kaum Punkte), der andere stellt mit der Höhe an der
    // Wand ein, wie tief er in der Röhre steckt – hoch ist langsam –, und
    // pumpt, wenn der Schaum anzieht oder zu nahe kommt.
    const PILOT = `(W, st, soll, merk) => {
      const d = st.zp - st.zs;
      const t = st.spielzeit;
      const pumpe = () => {
        if (merk.auf && st.h > 0.72) merk.auf = false;
        if (!merk.auf && st.h < 0.4) merk.auf = true;
        return merk.auf ? 1 : -1;
      };
      if (!soll) { W.lenke(pumpe()); return; }
      const naht = Math.max(W.faktorBei(t + 0.6), W.faktorBei(t + 1.4), W.faktorBei(t + 2.2));
      if (d < soll - 1.6 || (naht > 1.12 && d < soll + 4)) merk.pumpt = true;
      else if (d > soll) merk.pumpt = false;
      if (merk.pumpt) { W.lenke(pumpe()); return; }
      const ziel = Math.max(0.4, Math.min(0.8, 0.62 + 0.05 * (d - soll)));
      W.lenke(st.h < ziel - 0.05 ? 1 : st.h > ziel + 0.05 ? -1 : 0);
    }`;
    const fahre = (soll, laeufe) => seite.evaluate(([quelle, soll, laeufe]) => {
      const pilot = new Function(`return (${quelle})`)();
      const W = window.LernappWelle;
      const st = W.state;
      const raus = [];
      for (let lauf = 0; lauf < laeufe; lauf += 1) {
        document.querySelector(".cm-bar-left .cm-icon-again").click();
        W.losGehts();
        const merk = { auf: true, pumpt: false };
        let schnellste = 0;
        for (let n = 0; st.phase !== "ende" && n < 30000; n += 1) {
          if (st.schritt === "fahrt") {
            pilot(W, st, soll, merk);
            schnellste = Math.max(schnellste, st.v / W.tempoBei(st.spielzeit));
          }
          W.takt(1 / 120);
        }
        W.lenke(0);
        raus.push({
          phase: st.phase, schluss: st.schluss, t: Math.round(st.spielzeit), punkte: st.punkte, roehre: Math.round(st.roehrenzeit),
          schwung: st.schwungZahl, schnellste: +schnellste.toFixed(2), zahl: document.querySelector(".cm-result-score") !== null,
        });
      }
      return raus;
    }, [PILOT, soll, laeufe]);
    const strand = await fahre(0, 4);
    pruefe(strand.every((r) => r.phase === "ende" && r.schluss === "strand" && r.punkte >= 25 && r.punkte < 120 && r.zahl && r.schwung >= 5 && r.schnellste > 1.3),
      `Die Welle: Wer immer pumpt, kommt nicht schneller als die Welle bis an den Strand – ${JSON.stringify(strand)}`);
    const roehre = await fahre(4.5, 4);
    pruefe(roehre.every((r) => r.phase === "ende" && r.roehre >= 15 && r.punkte >= 35 && r.zahl)
      && Math.min(...roehre.map((r) => r.punkte)) > Math.max(...strand.map((r) => r.punkte)),
    `Die Welle: In der Röhre holt der Autopilot nicht deutlich mehr Punkte als draussen – ${JSON.stringify({ roehre, strand })}`);

    // Pumpen gibt Schwung: Auf derselben Höhe ist, wer rauf und runter
    // fährt, nach ein paar Sekunden schneller als wer geradeaus fährt – und
    // ein Sprung von oben hinunter gibt mehr Tempo, als der Weg hinauf
    // gekostet hat.
    const schwung = await seite.evaluate(() => {
      const W = window.LernappWelle;
      const st = W.state;
      const versuch = (lenk) => {
        document.querySelector(".cm-bar-left .cm-icon-again").click();
        W.losGehts();
        st.spielzeit = 30;
        st.zs = st.z0 + W.schaumBei(30);
        st.h = 0.5;
        st.v = W.tempoBei(30);
        let summe = 0;
        let auf = true;
        for (let n = 0; n < 120 * 8; n += 1) {
          st.zp = st.zs + 6;
          if (lenk === "pumpen") {
            if (auf && st.h > 0.7) auf = false;
            if (!auf && st.h < 0.4) auf = true;
            W.lenke(auf ? 1 : -1);
          } else W.lenke(st.h < 0.46 ? 1 : st.h > 0.54 ? -1 : 0);
          W.takt(1 / 120);
          if (n > 120 * 3) summe += st.v;
        }
        W.lenke(0);
        return +(summe / (120 * 5) / W.tempoBei(st.spielzeit)).toFixed(3);
      };
      return { linie: versuch("linie"), pumpen: versuch("pumpen") };
    });
    pruefe(schwung.pumpen > schwung.linie * 1.12,
      `Die Welle: Pumpen gibt keinen Schwung: ${JSON.stringify(schwung)}`);

    // Wer nichts tut, sinkt langsam ins Flache und wird verschluckt; wer
    // immer hinauf lenkt, fliegt über die Lippe.
    const faul = await seite.evaluate(() => {
      const W = window.LernappWelle;
      const st = W.state;
      const eine = (halten) => {
        document.querySelector(".cm-bar-left .cm-icon-again").click();
        W.losGehts();
        W.halte(halten);
        let tief = 1;
        for (let n = 0; st.phase !== "ende" && n < 30000; n += 1) {
          W.takt(1 / 120);
          if (st.schritt === "fahrt") tief = Math.min(tief, st.h);
        }
        W.halte(false);
        return { phase: st.phase, schluss: st.schluss, t: +st.spielzeit.toFixed(1), punkte: st.punkte, tief, text: document.querySelector(".cm-result-detail")?.textContent || "" };
      };
      return { nichts: eine(false), immer: eine(true) };
    });
    pruefe(faul.nichts.phase === "ende" && faul.nichts.schluss === "schaum" && faul.nichts.tief === 0 && faul.nichts.t > 8 && faul.nichts.t < 25 && faul.nichts.punkte < 25,
      `Die Welle: Wer nichts tut, wird nicht nach einer Weile verschluckt: ${JSON.stringify(faul.nichts)}`);
    pruefe(faul.immer.phase === "ende" && faul.immer.schluss === "lippe" && faul.immer.t > 1.8 && faul.immer.t < 9 && faul.immer.punkte === 0,
      `Die Welle: Wer immer hält, fliegt nicht über die Lippe: ${JSON.stringify(faul.immer)}`);

    // Die Punkte: draussen keine, in der Röhre je tiefer, desto mehr – und
    // die Serie vervielfacht bis ×4. Gefahren: zwei Sekunden vor der Röhre,
    // dann zwei Sekunden tief darin.
    const punkte = await seite.evaluate(() => {
      const W = window.LernappWelle;
      const st = W.state;
      document.querySelector(".cm-bar-left .cm-icon-again").click();
      W.losGehts();
      const halteAb = (d, sekunden) => {
        for (let n = 0; n < sekunden * 120; n += 1) {
          st.zp = st.zs + d;
          st.h = 0.5;
          st.psi = 0;
          W.takt(1 / 120);
        }
        return st.roh;
      };
      const draussen = halteAb(W.ROEHRE + 3, 2);
      const rand = halteAb(W.ROEHRE - 1, 2) - draussen;
      const tief = halteAb(2, 2) - rand - draussen;
      return {
        draussen, rand, tief, serie: st.serie, phase: st.phase,
        tabelle: [W.punkteBei(W.ROEHRE + 1), W.punkteBei(W.ROEHRE - 1), W.punkteBei(4), W.punkteBei(1)],
        mal: [W.malBei(0), W.malBei(W.SERIE_VOLL / 2), W.malBei(W.SERIE_VOLL), W.malBei(W.SERIE_VOLL * 3)],
      };
    });
    pruefe(punkte.phase === "spiel" && punkte.draussen === 0 && punkte.rand > 0 && punkte.tief > 6 * punkte.rand && punkte.serie > 3.9
      && punkte.tabelle[0] === 0 && punkte.tabelle[1] > 0 && punkte.tabelle[2] > 3 * punkte.tabelle[1] && punkte.tabelle[3] > 2 * punkte.tabelle[2]
      && punkte.mal[0] === 1 && punkte.mal[1] > 2 && punkte.mal[2] === 4 && punkte.mal[3] === 4,
    `Die Welle: Punkte gibt es nicht nur in der Röhre, tiefer mehr, mit der Serie bis ×4: ${JSON.stringify(punkte)}`);

    // Die Tasten: Der erste Druck startet die Runde und lenkt; loslassen
    // fährt geradeaus. Leertaste, Pfeil nach oben und nach links: hinauf –
    // Pfeil nach unten und nach rechts: hinunter.
    await seite.evaluate(() => document.querySelector(".cm-bar-left .cm-icon-again").click());
    const lage = () => seite.evaluate(() => `${window.LernappWelle.state.phase} ${window.LernappWelle.state.lenk}`);
    const schritte = [await lage()];
    for (const taste of ["Space", "ArrowUp", "ArrowLeft", "ArrowDown", "ArrowRight"]) {
      await seite.keyboard.down(taste);
      schritte.push(await lage());
      await seite.keyboard.up(taste);
      schritte.push(await lage());
    }
    const soll = ["bereit 0", "spiel 1", "spiel 0", "spiel 1", "spiel 0", "spiel 1", "spiel 0", "spiel -1", "spiel 0", "spiel -1", "spiel 0"];
    pruefe(JSON.stringify(schritte) === JSON.stringify(soll), `Die Welle: Die Tasten lenken nicht: ${JSON.stringify(schritte)}`);
    // Und der Finger: links hinauf, rechts hinunter – gleitet er über die
    // Mitte, nimmt er die Richtung mit.
    await seite.evaluate(() => document.querySelector(".cm-bar-left .cm-icon-again").click());
    const finger = [];
    await seite.mouse.move(200, 250);
    await seite.mouse.down();
    finger.push(await lage());
    await seite.mouse.up();
    finger.push(await lage());
    await seite.mouse.move(650, 250);
    await seite.mouse.down();
    finger.push(await lage());
    await seite.mouse.move(200, 250);
    finger.push(await lage());
    await seite.mouse.up();
    finger.push(await lage());
    pruefe(JSON.stringify(finger) === JSON.stringify(["spiel 1", "spiel 0", "spiel -1", "spiel 1", "spiel 0"]),
      `Die Welle: Der Finger lenkt nicht: ${JSON.stringify(finger)}`);
    pruefe(fehlerAufSeite.length === vorher, `Die Welle: Der Browser hat sich beschwert – ${fehlerAufSeite.slice(vorher).join(" / ")}`);
    await kontext.close();
  }
  {
    // Ein Lauf in echter Zeit – hoch an der Wand in die Röhre zurückfallen
    // lassen, dort ein paar Sekunden fahren, dann zu hoch hinaus –,
    // aufgezeichnet und angeschaut: dieselbe Welle, am Schluss dieselbe Zahl.
    const { kontext, seite } = await neueSeite({ width: 844, height: 390 });
    await seite.addInitScript(() => {
      if (sessionStorage.getItem("__welle")) return;
      sessionStorage.setItem("__welle", "1");
      localStorage.setItem("mini.name", "Zora");
    });
    await seite.goto(`${BASIS}/welle`, { waitUntil: "load" });
    await seite.waitForFunction(() => window.LernappWelle?.state?.welt && window.LernappWelle.view.cssW > 0, null, { timeout: 8000 });
    const welt = await seite.evaluate(() => window.LernappWelle.weltText());
    await seite.evaluate(() => new Promise((fertig) => {
      const W = window.LernappWelle;
      const st = W.state;
      W.losGehts();
      const lauf = () => {
        if (st.phase !== "spiel") { W.halte(false); fertig(); return; }
        const d = st.zp - st.zs;
        // Erst hoch an die Wand (langsam: der Schaum kommt näher), in der
        // Röhre den Abstand halten – und nach ein paar Sekunden darin immer
        // hinauf, bis es ihn über die Lippe trägt.
        const ziel = d > 7 ? 0.8 : Math.max(0.4, Math.min(0.8, 0.62 + 0.05 * (d - 4.5)));
        W.lenke(st.roehrenzeit > 3 || st.h < ziel - 0.04 ? 1 : st.h > ziel + 0.04 ? -1 : 0);
        requestAnimationFrame(lauf);
      };
      requestAnimationFrame(lauf);
    }));
    await seite.waitForSelector(".cm-result-score", { timeout: 90000 }).catch(() => {});
    await seite.waitForFunction(() => [...(window.__miniGeister?.keys?.() || [])].some((k) => k.startsWith("waveRide_")), null, { timeout: 4000 }).catch(() => {});
    const gespielt = await seite.evaluate(() => {
      const kennung = localStorage.getItem("mini.id");
      const geist = window.__miniGeister?.get(`waveRide_${kennung}`) || null;
      let d = null;
      try { d = JSON.parse(geist?.bahn || "null"); } catch { d = null; }
      const st = window.LernappWelle.state;
      return { kennung, saat: d?.s ?? null, mitOrt: Boolean(window.LernappGeist.entpacke(geist?.bahn)?.c), punkte: geist?.punkte || 0, gezaehlt: st.punkte, roehre: +st.roehrenzeit.toFixed(1), schluss: st.schluss };
    });
    pruefe(gespielt.kennung && Number.isInteger(gespielt.saat) && gespielt.mitOrt && gespielt.punkte >= 3 && gespielt.punkte === gespielt.gezaehlt && gespielt.roehre >= 3 && gespielt.schluss !== "strand",
      `Die Welle: Der Lauf wird nicht mit Saat, Höhe und Abstand hinterlegt: ${JSON.stringify(gespielt)}`);
    await seite.goto(`${BASIS}/welle?zuschauen=${gespielt.kennung}`, { waitUntil: "load" });
    await seite.waitForFunction(() => window.LernappWelle?.state?.phase === "zuschauen", null, { timeout: 8000 }).catch(() => {});
    const zu = await seite.evaluate(() => ({ phase: window.LernappWelle.state.phase, welt: window.LernappWelle.weltText() }));
    pruefe(zu.phase === "zuschauen" && zu.welt === welt,
      `Die Welle: Beim Zuschauen entsteht eine andere Welle:\n  gespielt ${welt}\n  angeschaut ${JSON.stringify(zu)}`);
    await seite.waitForFunction(() => window.LernappWelle.state.spielzeit > 1.5, null, { timeout: 20000 }).catch(() => {});
    const unterwegs = await seite.evaluate(() => {
      const st = window.LernappWelle.state;
      return { strecke: Math.round(st.zp - st.z0), d: +(st.zp - st.zs).toFixed(1), h: +st.h.toFixed(2), halten: st.halten, phase: st.phase };
    });
    pruefe(unterwegs.phase === "zuschauen" && unterwegs.strecke > 20 && unterwegs.d > 0 && unterwegs.d < 30 && unterwegs.h > 0 && unterwegs.halten === false,
      `Die Welle: Beim Zuschauen fährt der Surfer nicht mit: ${JSON.stringify(unterwegs)}`);
    await seite.waitForSelector(".gz-tafel:not([hidden]) .gz-nochmal", { timeout: 90000 }).catch(() => {});
    const schluss = await seite.evaluate(() => ({ punkte: window.LernappWelle.state.punkte, schritt: window.LernappWelle.state.schritt, tafel: Boolean(document.querySelector(".gz-tafel:not([hidden]) .gz-nochmal")), ergebnis: Boolean(document.querySelector(".cm-result-score")) }));
    pruefe(schluss.tafel && schluss.punkte === gespielt.punkte && schluss.schritt === "aus" && !schluss.ergebnis,
      `Die Welle: Am Ende des angeschauten Laufs steht nicht dieselbe Zahl (oder keine Tafel): ${JSON.stringify({ ...schluss, gespielt: gespielt.punkte })}`);
    await kontext.close();
  }

  // --- 4g29. Steinhüpfer: schaffbar, und wer nicht tippt, dessen Stein versinkt -------
  // Der See steht da (WebGL 2), ohne dass sich der Browser beschwert. Was auf
  // der Bahn liegt, ist gewürfelt und geordnet: die ersten vierzig Meter
  // frei, nichts übereinander, Böen, Wellen und Hindernisse in ihren Grenzen;
  // die Fenster werden mit den Hüpfern und mit der Strecke enger.
  // Ein Autopilot, der genau im Moment des Aufsetzens tippt, erreicht in
  // mehreren gewürfelten Runden das andere Ufer – auch wenn das Spiel nur
  // dreissig Schritte in der Sekunde rechnet: Gewertet wird nach der
  // Spielzeit des Tipps, nicht nach dem Bild. Wer ungenau tippt, kommt nicht
  // an; wer gar nicht tippt, dem wird einmal verziehen, beim zweiten
  // Aufsetzen versinkt der Stein. Leertaste und Finger holen aus, werfen und
  // tippen. Und ein Wurf, angeschaut: derselbe See, am Schluss dieselbe Zahl.
  {
    const { kontext, seite } = await neueSeite({ width: 844, height: 390 });
    const vorher = fehlerAufSeite.length;
    await seite.goto(`${BASIS}/steinhuepfer`, { waitUntil: "load" });
    await seite.waitForFunction(() => window.LernappSteinhuepfer?.state?.welt && window.LernappSteinhuepfer.view.cssW > 0, null, { timeout: 8000 });
    await seite.waitForTimeout(300);
    const bild = await seite.evaluate(() => {
      const S = window.LernappSteinhuepfer;
      const leinwand = document.querySelector(".sh-canvas");
      return { ok: S.bild.ok, programme: Object.keys(S.bild.prog).length, breit: leinwand?.width || 0, land: S.bild.land?.ecken || 0, ohne: Boolean(document.querySelector(".sh-ohne")), phase: S.state.phase, schritt: S.state.schritt };
    });
    pruefe(bild.ok && bild.programme === 7 && bild.breit > 300 && bild.land > 20000 && !bild.ohne && bild.phase === "bereit" && bild.schritt === "start",
      `Steinhüpfer: Der See (WebGL 2) steht nicht da: ${JSON.stringify(bild)}`);

    // Der gewürfelte See, in sechs Runden nachgerechnet.
    const see = await seite.evaluate(() => {
      const S = window.LernappSteinhuepfer;
      const st = S.state;
      const befunde = [];
      const arten = new Set();
      let dinge = 0;
      for (let lauf = 0; lauf < 6; lauf += 1) {
        document.querySelector(".cm-bar-left .cm-icon-again").click();
        const liste = st.welt.dinge;
        dinge += liste.length;
        if (!liste.length || liste[0].z0 < 40) befunde.push(`Die ersten vierzig Meter sind nicht frei: ${liste[0]?.z0}`);
        liste.forEach((d, i) => {
          arten.add(d.art);
          if (i && d.z0 < liste[i - 1].z1 + 5) befunde.push(`${d.art} bei ${d.z0.toFixed(0)} m liegt auf ${liste[i - 1].art}`);
          if (i && d.art === liste[i - 1].art) befunde.push(`zweimal ${d.art} hintereinander bei ${d.z0.toFixed(0)} m`);
          if (d.z1 > S.Z_UFER - 20) befunde.push(`${d.art} bei ${d.z0.toFixed(0)} m liegt am Ufer`);
          if (d.art === "boe" && !(Math.abs(d.staerke) >= 0.17 && d.staerke <= 0.43 && d.staerke >= -0.35 && d.z1 - d.z0 >= 20 && d.z1 - d.z0 <= 38)) befunde.push(`Böe bei ${d.z0.toFixed(0)} m: ${d.staerke.toFixed(2)}, ${(d.z1 - d.z0).toFixed(0)} m`);
          if (d.art === "wellen" && !(d.hoch >= 0.2 && d.hoch <= 0.4 && S.pegelBei((d.z0 + d.z1) / 2) === d.hoch && S.pegelBei(d.z0 - 1) === 0)) befunde.push(`Wellen bei ${d.z0.toFixed(0)} m: ${d.hoch}`);
          if ((d.art === "seerosen" || d.art === "holz") && !(d.z1 - d.z0 <= 8 && d.behalt > 0.5 && d.behalt < 0.8 && S.hindernisBei((d.z0 + d.z1) / 2) === d)) befunde.push(`${d.art} bei ${d.z0.toFixed(0)} m: ${(d.z1 - d.z0).toFixed(1)} m, ${d.behalt}`);
        });
        if (liste.filter((d) => d.art === "ring").length < 3) befunde.push("weniger als drei Libellenringe");
      }
      // Die Fenster werden mit jedem Hüpfer enger, und die Wertung folgt ihnen.
      const f1 = S.fenster(1);
      const f40 = S.fenster(40);
      const wertung = [S.werte(0, 1).klasse, S.werte(f1.P * 0.9, 1).klasse, S.werte(-f1.P * 1.5, 1).klasse, S.werte(f1.G * 1.2, 1).klasse, S.werte(f1.K * 1.1, 1).klasse, S.werte(f40.P * 1.5, 40).klasse,
        S.werte(f1.P * 0.9, 40).klasse === "perfekt" ? "gleich weit" : "enger"].join(",");
      return { befunde: befunde.slice(0, 6), dinge, arten: [...arten].sort().join(","), eng: f1.P > f40.P * 2 && f40.P >= 0.015 && f1.K > f1.G && f1.G > f1.P && S.fenster(40, S.Z_UFER).P < f40.P && S.fenster(40, S.Z_UFER).P >= 0.01, wertung, behalt: [S.werte(0, 1).behalt, S.werte(f1.G, 1).behalt, S.werte(f1.K, 1).behalt] };
    });
    pruefe(see.befunde.length === 0 && see.dinge > 60 && see.arten === "boe,holz,ring,seerosen,wellen" && see.eng
      && see.wertung === "perfekt,perfekt,gut,knapp,daneben,gut,enger" && see.behalt[0] > see.behalt[1] && see.behalt[1] > see.behalt[2] && see.behalt[2] > 0.5,
    `Steinhüpfer: Der gewürfelte See stimmt nicht – ${JSON.stringify(see)}`);

    // Die Autopiloten. Geworfen wird genau in der Mitte; getippt wird zur
    // Zeit des Aufsetzens, die der Bogen selbst nennt (aufsetzZeit) – genau,
    // oder mit einem Fehler aus einem festen Würfel.
    const PILOT = `(S, st, streuung, schritt) => {
      let saat = 20261109;
      const zufall = () => { saat = (saat * 1664525 + 1013904223) >>> 0; return saat / 4294967296; };
      const gauss = () => Math.sqrt(-2 * Math.log(1 - zufall())) * Math.cos(2 * Math.PI * zufall());
      document.querySelector(".cm-bar-left .cm-icon-again").click();
      S.halte(true);
      S.takt(schritt);
      S.halte(false, S.mitteZeit());
      let letzter = null;
      for (let n = 0; st.phase === "spiel" && n < 200000; n += 1) {
        if (streuung !== null && st.schritt === "flug" && st.bogen !== letzter) {
          letzter = st.bogen;
          S.tippe(S.aufsetzZeit() + gauss() * streuung);
        }
        S.takt(schritt);
      }
      return { phase: st.phase, grund: st.grund, punkte: st.punkte, meter: st.meter, huepfer: st.huepfer, perfekte: st.perfekte, wurf: st.wurf?.perfekt || false,
        sekunden: st.schrittZeit, zahl: document.querySelector(".cm-result-score") !== null, text: document.querySelector(".cm-result-detail")?.textContent || "" };
    }`;
    const piloten = await seite.evaluate((quelle) => {
      const pilot = new Function(`return (${quelle})`)();
      const S = window.LernappSteinhuepfer;
      const genau = [];
      for (let lauf = 0; lauf < 3; lauf += 1) genau.push(pilot(S, S.state, 0, 1 / 120));
      // Dasselbe mit dreissig Schritten in der Sekunde: Der Tipp zählt nach
      // seiner Spielzeit, nicht nach dem Schritt, in dem er ankommt.
      const grob = pilot(S, S.state, 0, 1 / 30);
      const ungenau = [];
      for (let lauf = 0; lauf < 4; lauf += 1) ungenau.push(pilot(S, S.state, 0.055, 1 / 120));
      const nichts = [];
      for (let lauf = 0; lauf < 3; lauf += 1) nichts.push(pilot(S, S.state, null, 1 / 120));
      return { genau, grob, ungenau, nichts };
    }, PILOT);
    pruefe(piloten.genau.every((r) => r.phase === "ende" && r.grund === "ufer" && r.punkte === 700 && r.wurf && r.perfekte === r.huepfer && r.sekunden < 36 && r.zahl),
      `Steinhüpfer: Der Autopilot erreicht mit genauen Tipps das andere Ufer nicht – ${JSON.stringify(piloten.genau)}`);
    pruefe(piloten.grob.grund === "ufer" && piloten.grob.punkte === 700 && piloten.grob.perfekte === piloten.grob.huepfer,
      `Steinhüpfer: Mit dreissig Schritten in der Sekunde ist ein genauer Tipp nicht mehr perfekt – ${JSON.stringify(piloten.grob)}`);
    pruefe(piloten.ungenau.every((r) => r.phase === "ende" && r.grund !== "ufer" && r.punkte < 560 && r.perfekte < r.huepfer)
      && piloten.ungenau.reduce((summe, r) => summe + r.punkte, 0) / piloten.ungenau.length > 50,
    `Steinhüpfer: Wer ungenau tippt (±55 ms), kommt zu weit oder gar nicht vom Fleck – ${JSON.stringify(piloten.ungenau)}`);
    // Wer nichts tut: Das erste Aufsetzen verzeiht das Spiel, beim zweiten
    // versinkt der Stein – nach wenigen Sekunden und ein paar Dutzend Metern.
    pruefe(piloten.nichts.every((r) => r.phase === "ende" && r.grund === "kein Tipp" && r.huepfer === 1 && r.punkte > 12 && r.punkte < 50 && r.sekunden < 5 && /Versunken/.test(r.text)),
      `Steinhüpfer: Wer nicht tippt, dessen Stein versinkt nicht beim zweiten Aufsetzen – ${JSON.stringify(piloten.nichts)}`);

    // Der Wurf: Wer am Rand loslässt, wirft mit weniger Schwung. Und ein Tipp
    // weit vor dem Aufsetzen ist daneben – nach dem einen, der verziehen wird.
    const wurf = await seite.evaluate(() => {
      const S = window.LernappSteinhuepfer;
      const st = S.state;
      const einer = (wann) => {
        document.querySelector(".cm-bar-left .cm-icon-again").click();
        S.halte(true);
        S.takt(1 / 120);
        S.halte(false, wann(S));
        for (let n = 0; n < 600 && st.schritt !== "flug"; n += 1) S.takt(1 / 120);
        return { schwung: st.S, a: st.wurf?.a ?? null, perfekt: st.wurf?.perfekt ?? null };
      };
      const mitte = einer((s) => s.mitteZeit());
      const steil = einer((s) => s.state.ausholSeit + 0.02);
      // Nie losgelassen: Der Stein fliegt von selbst.
      document.querySelector(".cm-bar-left .cm-icon-again").click();
      S.halte(true);
      for (let n = 0; n < 120 * 6 && st.schritt !== "flug"; n += 1) S.takt(1 / 120);
      const selbst = { schritt: st.schritt, zeit: st.zeit };
      // Zweimal viel zu früh getippt: einmal verziehen, dann versunken.
      document.querySelector(".cm-bar-left .cm-icon-again").click();
      S.halte(true);
      S.takt(1 / 120);
      S.halte(false, S.mitteZeit());
      let letzter = null;
      for (let n = 0; st.phase === "spiel" && n < 5000; n += 1) {
        if (st.schritt === "flug" && st.bogen !== letzter) { letzter = st.bogen; S.tippe(S.aufsetzZeit() - 0.3); }
        S.takt(1 / 120);
      }
      return { mitte, steil, selbst, frueh: { grund: st.grund, huepfer: st.huepfer, verziehen: st.verziehen } };
    });
    pruefe(wurf.mitte.perfekt === true && Math.abs(wurf.mitte.a) < 0.02 && wurf.mitte.schwung === 22 && wurf.steil.perfekt === false && wurf.steil.a < -0.9 && wurf.steil.schwung < 17
      && wurf.selbst.schritt === "flug" && wurf.selbst.zeit < 5 && wurf.frueh.grund === "zu früh" && wurf.frueh.huepfer === 1 && wurf.frueh.verziehen,
    `Steinhüpfer: Der Wurf oder das Verzeihen stimmt nicht – ${JSON.stringify(wurf)}`);

    // Die Leertaste: drücken holt aus, loslassen wirft, drücken im Flug tippt.
    await seite.evaluate(() => document.querySelector(".cm-bar-left .cm-icon-again").click());
    const lage = () => seite.evaluate(() => { const st = window.LernappSteinhuepfer.state; return { phase: st.phase, schritt: st.schritt }; });
    const imFlug = () => seite.waitForFunction(() => {
      const st = window.LernappSteinhuepfer.state;
      return st.schritt === "flug" && st.bogen && st.zeit - st.bogen.t0 > st.bogen.T * 0.4;
    }, null, { timeout: 15000 }).catch(() => {});
    const getippt = () => seite.waitForFunction(() => {
      const st = window.LernappSteinhuepfer.state;
      return st.tipp !== null || st.huepfer > 0 || st.schritt === "sinkt";
    }, null, { timeout: 5000 }).then(() => true).catch(() => false);
    const tasten = [await lage()];
    await seite.keyboard.down("Space");
    await seite.waitForFunction(() => window.LernappSteinhuepfer.state.schritt === "ausholen", null, { timeout: 5000 }).catch(() => {});
    tasten.push(await lage());
    await seite.keyboard.up("Space");
    await seite.waitForFunction(() => window.LernappSteinhuepfer.state.schritt === "flug", null, { timeout: 5000 }).catch(() => {});
    tasten.push(await lage());
    await imFlug();
    await seite.keyboard.down("Space");
    await seite.keyboard.up("Space");
    const tasteTippt = await getippt();
    pruefe(JSON.stringify(tasten) === JSON.stringify([{ phase: "bereit", schritt: "start" }, { phase: "spiel", schritt: "ausholen" }, { phase: "spiel", schritt: "flug" }]) && tasteTippt,
      `Steinhüpfer: Die Leertaste holt nicht aus, wirft nicht oder tippt nicht: ${JSON.stringify({ tasten, tasteTippt })}`);
    // Und der Finger, irgendwo im Bild.
    await seite.evaluate(() => document.querySelector(".cm-bar-left .cm-icon-again").click());
    await seite.mouse.move(420, 250);
    await seite.mouse.down();
    await seite.waitForFunction(() => window.LernappSteinhuepfer.state.schritt === "ausholen", null, { timeout: 5000 }).catch(() => {});
    const finger = [await lage()];
    await seite.mouse.up();
    await seite.waitForFunction(() => window.LernappSteinhuepfer.state.schritt === "flug", null, { timeout: 5000 }).catch(() => {});
    finger.push(await lage());
    await imFlug();
    await seite.mouse.down();
    await seite.mouse.up();
    const fingerTippt = await getippt();
    pruefe(JSON.stringify(finger) === JSON.stringify([{ phase: "spiel", schritt: "ausholen" }, { phase: "spiel", schritt: "flug" }]) && fingerTippt,
      `Steinhüpfer: Der Finger holt nicht aus, wirft nicht oder tippt nicht: ${JSON.stringify({ finger, fingerTippt })}`);
    pruefe(fehlerAufSeite.length === vorher, `Steinhüpfer: Der Browser hat sich beschwert – ${fehlerAufSeite.slice(vorher).join(" / ")}`);
    await kontext.close();
  }
  {
    // Ein Wurf in echter Zeit – ein paar genaue Hüpfer, dann keiner mehr –,
    // aufgezeichnet und angeschaut: derselbe See, am Schluss dieselbe Zahl.
    const { kontext, seite } = await neueSeite({ width: 844, height: 390 });
    await seite.addInitScript(() => {
      if (sessionStorage.getItem("__steinhuepfer")) return;
      sessionStorage.setItem("__steinhuepfer", "1");
      localStorage.setItem("mini.name", "Zora");
    });
    await seite.goto(`${BASIS}/steinhuepfer`, { waitUntil: "load" });
    await seite.waitForFunction(() => window.LernappSteinhuepfer?.state?.welt && window.LernappSteinhuepfer.view.cssW > 0, null, { timeout: 8000 });
    const welt = await seite.evaluate(() => window.LernappSteinhuepfer.weltText());
    await seite.evaluate(() => new Promise((fertig) => {
      const S = window.LernappSteinhuepfer;
      const st = S.state;
      S.halte(true);
      let geworfen = false;
      let letzter = null;
      const lauf = () => {
        if (st.phase !== "spiel") { fertig(); return; }
        if (!geworfen && st.schritt === "ausholen") { geworfen = true; S.halte(false, S.mitteZeit()); }
        if (st.schritt === "flug" && st.bogen !== letzter && st.z < 60) { letzter = st.bogen; S.tippe(S.aufsetzZeit()); }
        requestAnimationFrame(lauf);
      };
      requestAnimationFrame(lauf);
    }));
    await seite.waitForSelector(".cm-result-score", { timeout: 60000 }).catch(() => {});
    await seite.waitForFunction(() => [...(window.__miniGeister?.keys?.() || [])].some((k) => k.startsWith("stoneSkip_")), null, { timeout: 4000 }).catch(() => {});
    const gespielt = await seite.evaluate(() => {
      const kennung = localStorage.getItem("mini.id");
      const geist = window.__miniGeister?.get(`stoneSkip_${kennung}`) || null;
      let d = null;
      try { d = JSON.parse(geist?.bahn || "null"); } catch { d = null; }
      const st = window.LernappSteinhuepfer.state;
      return { kennung, saat: d?.s ?? null, mitOrt: Boolean(window.LernappGeist.entpacke(geist?.bahn)?.c), punkte: geist?.punkte || 0, gezaehlt: st.punkte, huepfer: st.huepfer, grund: st.grund };
    });
    pruefe(gespielt.kennung && Number.isInteger(gespielt.saat) && gespielt.mitOrt && gespielt.punkte > 60 && gespielt.punkte < 200 && gespielt.punkte === gespielt.gezaehlt && gespielt.huepfer >= 3 && gespielt.grund === "kein Tipp",
      `Steinhüpfer: Der Wurf wird nicht mit Saat, Ort und Hüpfern hinterlegt: ${JSON.stringify(gespielt)}`);
    await seite.goto(`${BASIS}/steinhuepfer?zuschauen=${gespielt.kennung}`, { waitUntil: "load" });
    await seite.waitForFunction(() => window.LernappSteinhuepfer?.state?.phase === "zuschauen", null, { timeout: 8000 }).catch(() => {});
    const zu = await seite.evaluate(() => ({ phase: window.LernappSteinhuepfer.state.phase, welt: window.LernappSteinhuepfer.weltText() }));
    pruefe(zu.phase === "zuschauen" && zu.welt === welt,
      `Steinhüpfer: Beim Zuschauen entsteht ein anderer See:\n  gespielt ${welt}\n  angeschaut ${JSON.stringify(zu)}`);
    await seite.waitForFunction(() => window.LernappSteinhuepfer.state.z > 30 && window.LernappSteinhuepfer.state.huepfer >= 2, null, { timeout: 20000 }).catch(() => {});
    const unterwegs = await seite.evaluate(() => { const st = window.LernappSteinhuepfer.state; return { z: Math.round(st.z), huepfer: st.huepfer, ringe: st.ringe.length, schritt: st.schritt }; });
    pruefe(unterwegs.z > 30 && unterwegs.huepfer >= 2 && unterwegs.ringe >= 2, `Steinhüpfer: Beim Zuschauen hüpft der Stein nicht mit: ${JSON.stringify(unterwegs)}`);
    await seite.waitForSelector(".gz-tafel:not([hidden]) .gz-nochmal", { timeout: 60000 }).catch(() => {});
    const schluss = await seite.evaluate(() => ({ punkte: window.LernappSteinhuepfer.state.punkte, huepfer: window.LernappSteinhuepfer.state.huepfer, schritt: window.LernappSteinhuepfer.state.schritt, tafel: Boolean(document.querySelector(".gz-tafel:not([hidden]) .gz-nochmal")), ergebnis: Boolean(document.querySelector(".cm-result-score")) }));
    pruefe(schluss.tafel && schluss.punkte === gespielt.punkte && schluss.huepfer === gespielt.huepfer && schluss.schritt === "sinkt" && !schluss.ergebnis,
      `Steinhüpfer: Am Ende des angeschauten Wurfs steht nicht dieselbe Zahl (oder keine Tafel): ${JSON.stringify({ ...schluss, gespielt: gespielt.punkte })}`);
    await kontext.close();
  }

  // --- 4g27. Eiskanal: fahrbar, und wer nichts tut, schiesst über die Lippe -----------
  // Die Welt steht da (WebGL 2), ohne dass sich der Browser beschwert. Jede
  // gewürfelte Bahn ist 1400 m lang und fällt 110 m, kreuzt sich nicht, hat
  // ihren Kreisel und ihr Labyrinth – und ist bei vollem Tempo fahrbar: Die
  // Sollfahrt, hier noch einmal nachgerechnet, bleibt überall um die
  // versprochene Luft unter dem Rand. Ein Autopilot, der zur ruhigen Linie
  // lenkt, kommt in mehreren gewürfelten Runden ins Ziel und bekommt dort den
  // Zeitbonus. Wer nichts tut, schiesst über eine Lippe, aber nicht in den
  // ersten Sekunden. Eine Bande bremst, der dritte harte Schlag kippt den Bob.
  // Die Pfeiltasten lenken, und die letzte gilt. Und eine Fahrt, angeschaut,
  // durch dieselbe Bahn mit derselben Zahl.
  {
    const { kontext, seite } = await neueSeite({ width: 844, height: 390 });
    const vorher = fehlerAufSeite.length;
    await seite.goto(`${BASIS}/eiskanal`, { waitUntil: "load" });
    await seite.waitForFunction(() => window.LernappEiskanal?.state?.bahn?.zier && window.LernappEiskanal.view.cssW > 0, null, { timeout: 8000 });
    await seite.waitForTimeout(300);
    const bild = await seite.evaluate(() => {
      const S = window.LernappEiskanal;
      const leinwand = document.querySelector(".ek-canvas");
      return { ok: S.bild.ok, programme: Object.keys(S.bild.prog).length, breit: leinwand?.width || 0, ohne: Boolean(document.querySelector(".ek-ohne")) };
    });
    pruefe(bild.ok && bild.programme === 6 && bild.breit > 300 && !bild.ohne,
      `Eiskanal: Die Welt (WebGL 2) steht nicht da: ${JSON.stringify(bild)}`);

    // Fünf gewürfelte Bahnen, nachgerechnet.
    const bahnen = await seite.evaluate(() => {
      const S = window.LernappEiskanal;
      const B = S.bahn;
      const befunde = [];
      const arten = new Set();
      let kleinsteLuft = 9;
      const stelle = (s) => Math.round((s + S.S_VOR) / S.DS);
      for (let lauf = 0; lauf < 5; lauf += 1) {
        document.querySelector(".cm-bar-left .cm-icon-again").click();
        B.teile.forEach((t) => arten.add(t.art));
        const i0 = stelle(0);
        const i1 = stelle(S.LAENGE);
        const letzter = B.teile[B.teile.length - 1];
        if (B.teile[0].von !== 0 || letzter.bis !== S.LAENGE || letzter.art !== "gerade") befunde.push("Die Bahn reicht nicht von 0 bis ins Ziel");
        if (Math.abs(B.y[i0] - B.y[i1] - S.GEFAELLE) > 0.5) befunde.push(`Gefälle ${(B.y[i0] - B.y[i1]).toFixed(1)} m`);
        if (!B.frei) befunde.push("Die Bahn kreuzt sich");
        if (!B.teile.some((t) => t.art === "kreisel") || !B.teile.some((t) => t.art === "labyrinth")) befunde.push("Kreisel oder Labyrinth fehlt");
        // Die Sollfahrt noch einmal, Schritt um Schritt wie in bahnRechnen.
        let phi = 0;
        let w = 0;
        let e = 0;
        for (let i = i0; i < i1; i += 1) {
          const s = i * S.DS - S.S_VOR;
          if (Math.abs(phi - B.soll[i]) > 0.02) { befunde.push(`Sollfahrt bei ${s} m: ${phi.toFixed(3)} statt ${B.soll[i].toFixed(3)}`); break; }
          // Links und rechts bleibt die versprochene Luft – oder mehr.
          const luft = Math.min(B.wl[i] + B.soll[i], B.wr[i] - B.soll[i]);
          kleinsteLuft = Math.min(kleinsteLuft, luft);
          if (luft < S.luftBei(s) - 0.01) { befunde.push(`Bei ${s} m bleiben nur ${(luft / S.GRAD).toFixed(1)}° Luft, versprochen sind ${(S.luftBei(s) / S.GRAD).toFixed(1)}°`); break; }
          for (let j = 0; j < 4; j += 1) {
            const u = j / 4;
            const v = B.vf[i] + (B.vf[i + 1] - B.vf[i]) * u;
            const dt = S.DS / 4 / v;
            const pv = Math.min(S.NP - 1.001, i + u + v * S.SOLL_VORAUS / S.DS);
            const iv = Math.floor(pv);
            const voraus = B.kr[iv] + (B.kr[iv + 1] - B.kr[iv]) * (pv - iv);
            const lenk = Math.max(-1, Math.min(1, (S.linieBei(v, voraus) * S.SOLL_LINIE - phi - S.SOLL_GEGEN * w) / S.SOLL_BREIT)) * S.SOLL_KRAFT;
            e += (lenk - e) * (1 - Math.exp(-dt / S.LENK_ZEIT));
            const ac = v * v * (B.kr[i] + (B.kr[i + 1] - B.kr[i]) * u);
            const geff = Math.hypot(S.G, ac);
            const om = Math.sqrt(geff / S.ROHR);
            w += (om * om * (S.GRIFF * e - Math.sin(phi - Math.atan2(-ac, S.G))) - 2 * S.DAEMPFUNG * om * w) * dt;
            phi += w * dt;
          }
        }
        // Unten ist es schnell: bei vollem Tempo zwischen 120 und 145 km/h.
        if (B.vf[i1] * 3.6 < 120 || B.vf[i1] * 3.6 > 145) befunde.push(`Unten ${(B.vf[i1] * 3.6).toFixed(0)} km/h`);
      }
      return { befunde: befunde.slice(0, 6), arten: [...arten].sort().join(","), kleinsteLuft: kleinsteLuft / S.GRAD };
    });
    pruefe(bahnen.befunde.length === 0 && bahnen.arten === "gerade,kreisel,kurve,labyrinth,s" && bahnen.kleinsteLuft > 10,
      `Eiskanal: Die gewürfelte Bahn ist nicht fahrbar gebaut – ${JSON.stringify(bahnen)}`);

    // Der Autopilot: zur ruhigen Linie hin, vor allem gegen den Schwung.
    const PILOT = `(S, st) => {
      const k = S.bahnBei(st.s + st.v * 0.25).k;
      const f = S.linieBei(st.v, k) * 0.95 - st.phi - st.w * 1.2;
      S.lenke(f > 0.25 ? 1 : f < -0.25 ? -1 : 0);
    }`;
    const runden = await seite.evaluate((quelle) => {
      const pilot = new Function(`return (${quelle})`)();
      const S = window.LernappEiskanal;
      const st = S.state;
      const raus = [];
      for (let lauf = 0; lauf < 4; lauf += 1) {
        document.querySelector(".cm-bar-left .cm-icon-again").click();
        S.losGehts();
        for (let n = 0; st.phase !== "ende" && n < 200000; n += 1) {
          if (st.schritt === "fahrt") pilot(S, st);
          S.takt(1 / 120);
        }
        S.lenke(0);
        raus.push({ phase: st.phase, an: st.angekommen, zeit: st.zielzeit, punkte: st.punkte, bonus: st.bonus, soll: S.bonusFuer(st.zielzeit), schlaege: st.schlaege, tore: st.tore.every((t) => t > 5), zahl: document.querySelector(".cm-result-score") !== null });
      }
      return raus;
    }, PILOT);
    pruefe(runden.every((r) => r.phase === "ende" && r.an && r.zeit > 45 && r.zeit < 61 && r.bonus === r.soll && r.bonus > 0 && r.punkte === 140 + r.bonus && r.schlaege < 3 && r.tore && r.zahl),
      `Eiskanal: Der Autopilot kommt nicht mit Zeitbonus ins Ziel – ${JSON.stringify(runden)}`);

    // Wer nichts tut: Der Bob schiesst in einer Steilwand über die Lippe (oder
    // kippt an der Bande) – lange vor dem Ziel, aber nicht in den ersten Sekunden.
    const nichts = await seite.evaluate(() => {
      const S = window.LernappEiskanal;
      const st = S.state;
      const raus = [];
      for (let lauf = 0; lauf < 4; lauf += 1) {
        document.querySelector(".cm-bar-left .cm-icon-again").click();
        S.losGehts();
        for (let n = 0; st.phase !== "ende" && n < 200000; n += 1) S.takt(1 / 120);
        raus.push({ phase: st.phase, an: st.angekommen, meter: st.meter, zeit: st.fahrzeit, ursache: st.ursache, punkte: st.punkte });
      }
      return raus;
    });
    pruefe(nichts.every((r) => r.phase === "ende" && !r.an && r.meter < 1000 && r.zeit > 8 && (r.ursache === "lippe" || r.ursache === "bande") && r.punkte === Math.floor(r.meter / 10)),
      `Eiskanal: Wer nichts tut, stürzt nicht (oder gleich am Anfang): ${JSON.stringify(nichts)}`);

    // Die Bande: Ein sanftes Anlehnen bremst ein wenig, ein harter Schlag viel –
    // und der dritte kippt den Bob. Über eine Lippe hinaus ist sofort Schluss.
    const rand = await seite.evaluate(() => {
      const S = window.LernappEiskanal;
      const st = S.state;
      const los = () => {
        document.querySelector(".cm-bar-left .cm-icon-again").click();
        S.losGehts();
        for (let n = 0; n < 4000 && st.s < 30; n += 1) S.takt(1 / 120);
      };
      // Mit so vielen m/s zur Seite an die rechte Bande.
      const anDieBande = (quer) => {
        st.phi = S.bahnBei(st.s).wr - 0.001;
        st.w = quer / S.ROHR;
        const v = st.v;
        S.takt(1 / 120);
        return { verlust: 1 - st.v / v, schlaege: st.schlaege, schritt: st.schritt };
      };
      los();
      const sanft = anDieBande(1.2);
      const hart = [anDieBande(4), anDieBande(4), anDieBande(4)];
      let schritte = 0;
      for (; st.phase !== "ende" && schritte < 1200; schritte += 1) S.takt(1 / 120);
      const gekippt = { phase: st.phase, ursache: st.ursache, sekunden: schritte / 120, an: st.angekommen };
      // Die erste Steilwand links: einen Hauch über ihre Lippe hinaus.
      los();
      const B = S.bahn;
      let i = Math.round((60 + S.S_VOR) / S.DS);
      while (i < S.NP - 1 && B.wl[i] < S.BANDE + S.STEIL + 0.05) i += 1;
      st.s = i * S.DS - S.S_VOR;
      st.phi = -(B.wl[i] + 0.01);
      st.w = 0;
      S.takt(1 / 120);
      return { sanft, hart, gekippt, lippe: { schritt: st.schritt, ursache: st.ursache, wand: B.wl[i] / S.GRAD } };
    });
    pruefe(rand.sanft.schlaege === 0 && rand.sanft.verlust > 0.05 && rand.sanft.verlust < 0.15
      && rand.hart[0].schlaege === 1 && rand.hart[0].verlust > rand.sanft.verlust && rand.hart[1].schlaege === 2 && rand.hart[1].schritt === "fahrt"
      && rand.hart[2].schlaege === 3 && rand.hart[2].schritt === "sturz" && rand.gekippt.phase === "ende" && rand.gekippt.ursache === "bande" && !rand.gekippt.an && rand.gekippt.sekunden < 3
      && rand.lippe.schritt === "sturz" && rand.lippe.ursache === "lippe",
    `Eiskanal: Bande und Lippe wirken nicht wie versprochen: ${JSON.stringify(rand)}`);

    // Die Pfeiltasten: links, dann rechts dazu (die letzte gilt), rechts los,
    // links los. Der erste Druck startet die Runde.
    await seite.evaluate(() => document.querySelector(".cm-bar-left .cm-icon-again").click());
    const lage = () => seite.evaluate(() => ({ phase: window.LernappEiskanal.state.phase, lenk: window.LernappEiskanal.state.lenk }));
    const schritte = [await lage()];
    await seite.keyboard.down("ArrowLeft");
    schritte.push(await lage());
    await seite.keyboard.down("ArrowRight");
    schritte.push(await lage());
    await seite.keyboard.up("ArrowRight");
    schritte.push(await lage());
    await seite.keyboard.up("ArrowLeft");
    schritte.push(await lage());
    const soll = [{ phase: "bereit", lenk: 0 }, { phase: "spiel", lenk: -1 }, { phase: "spiel", lenk: 1 }, { phase: "spiel", lenk: -1 }, { phase: "spiel", lenk: 0 }];
    pruefe(JSON.stringify(schritte) === JSON.stringify(soll), `Eiskanal: Die Pfeiltasten lenken nicht: ${JSON.stringify(schritte)}`);
    // Und der Finger: rechts vom Bild lenkt nach rechts, über die Mitte gezogen nach links.
    await seite.evaluate(() => document.querySelector(".cm-bar-left .cm-icon-again").click());
    await seite.mouse.move(700, 250);
    await seite.mouse.down();
    const rechts = await lage();
    await seite.mouse.move(120, 250, { steps: 4 });
    const links = await lage();
    await seite.mouse.up();
    const losgelassen = await lage();
    pruefe(rechts.phase === "spiel" && rechts.lenk === 1 && links.lenk === -1 && losgelassen.lenk === 0,
      `Eiskanal: Der Finger lenkt nicht: ${JSON.stringify({ rechts, links, losgelassen })}`);
    // Lenken wirkt: Wer rechts hält, wandert nach rechts.
    const wandert = await seite.evaluate(() => {
      const S = window.LernappEiskanal;
      const st = S.state;
      document.querySelector(".cm-bar-left .cm-icon-again").click();
      S.losGehts();
      for (let n = 0; n < 240; n += 1) S.takt(1 / 120);
      S.lenke(1);
      for (let n = 0; n < 60; n += 1) S.takt(1 / 120);
      const rechtsHin = st.phi;
      S.lenke(0);
      return { rechtsHin, q: st.q };
    });
    pruefe(wandert.rechtsHin > 0.05 && wandert.q > 0, `Eiskanal: Rechts halten schiebt den Bob nicht nach rechts: ${JSON.stringify(wandert)}`);
    pruefe(fehlerAufSeite.length === vorher, `Eiskanal: Der Browser hat sich beschwert – ${fehlerAufSeite.slice(vorher).join(" / ")}`);
    await kontext.close();
  }
  {
    // Eine Fahrt in echter Zeit – ein Stück mit dem Autopiloten, dann an die
    // Bande, bis der Bob kippt –, aufgezeichnet und angeschaut: dieselbe
    // Bahn, am Schluss dieselbe Zahl.
    const { kontext, seite } = await neueSeite({ width: 844, height: 390 });
    await seite.addInitScript(() => {
      if (sessionStorage.getItem("__eiskanal")) return;
      sessionStorage.setItem("__eiskanal", "1");
      localStorage.setItem("mini.name", "Zora");
    });
    await seite.goto(`${BASIS}/eiskanal`, { waitUntil: "load" });
    await seite.waitForFunction(() => window.LernappEiskanal?.state?.bahn?.zier && window.LernappEiskanal.view.cssW > 0, null, { timeout: 8000 });
    const welt = await seite.evaluate(() => window.LernappEiskanal.weltText());
    await seite.evaluate(() => new Promise((fertig) => {
      const S = window.LernappEiskanal;
      const st = S.state;
      S.losGehts();
      const lauf = () => {
        if (st.phase !== "spiel") { fertig(); return; }
        if (st.schritt === "fahrt") {
          if (st.s > 130) {
            // Hart an die rechte Bande, bis der Bob kippt (oder gleich über eine Lippe).
            st.phi = S.bahnBei(st.s).wr - 0.004;
            st.w = 4 / S.ROHR;
            S.lenke(0);
          } else {
            const k = S.bahnBei(st.s + st.v * 0.25).k;
            const f = S.linieBei(st.v, k) * 0.95 - st.phi - st.w * 1.2;
            S.lenke(f > 0.25 ? 1 : f < -0.25 ? -1 : 0);
          }
        }
        requestAnimationFrame(lauf);
      };
      requestAnimationFrame(lauf);
    }));
    await seite.waitForSelector(".cm-result-score", { timeout: 90000 }).catch(() => {});
    await seite.waitForFunction(() => [...(window.__miniGeister?.keys?.() || [])].some((k) => k.startsWith("iceRun_")), null, { timeout: 4000 }).catch(() => {});
    const gespielt = await seite.evaluate(() => {
      const kennung = localStorage.getItem("mini.id");
      const geist = window.__miniGeister?.get(`iceRun_${kennung}`) || null;
      let d = null;
      try { d = JSON.parse(geist?.bahn || "null"); } catch { d = null; }
      const st = window.LernappEiskanal.state;
      return { kennung, saat: d?.s ?? null, mitOrt: Boolean(window.LernappGeist.entpacke(geist?.bahn)?.c), punkte: geist?.punkte || 0, gezaehlt: st.punkte, meter: st.meter, an: st.angekommen, ursache: st.ursache };
    });
    pruefe(gespielt.kennung && Number.isInteger(gespielt.saat) && gespielt.mitOrt && gespielt.punkte >= 13 && gespielt.punkte === gespielt.gezaehlt && gespielt.meter > 130 && !gespielt.an,
      `Eiskanal: Die Fahrt wird nicht mit Saat, Strecke, Lage und Tempo hinterlegt: ${JSON.stringify(gespielt)}`);
    await seite.goto(`${BASIS}/eiskanal?zuschauen=${gespielt.kennung}`, { waitUntil: "load" });
    await seite.waitForFunction(() => window.LernappEiskanal?.state?.phase === "zuschauen", null, { timeout: 8000 }).catch(() => {});
    const zu = await seite.evaluate(() => ({ phase: window.LernappEiskanal.state.phase, welt: window.LernappEiskanal.weltText() }));
    pruefe(zu.phase === "zuschauen" && zu.welt === welt,
      `Eiskanal: Beim Zuschauen entsteht eine andere Bahn:\n  gespielt ${welt}\n  angeschaut ${JSON.stringify(zu)}`);
    await seite.waitForFunction(() => window.LernappEiskanal.state.s > 40, null, { timeout: 20000 }).catch(() => {});
    const unterwegs = await seite.evaluate(() => ({ s: Math.round(window.LernappEiskanal.state.s), kmh: Math.round(window.LernappEiskanal.state.v * 3.6), lenk: window.LernappEiskanal.state.lenk }));
    pruefe(unterwegs.s > 30 && unterwegs.kmh > 30 && unterwegs.lenk === 0, `Eiskanal: Beim Zuschauen fährt der Bob nicht mit: ${JSON.stringify(unterwegs)}`);
    await seite.waitForSelector(".gz-tafel:not([hidden]) .gz-nochmal", { timeout: 60000 }).catch(() => {});
    const schluss = await seite.evaluate(() => ({ punkte: window.LernappEiskanal.state.punkte, schritt: window.LernappEiskanal.state.schritt, tafel: Boolean(document.querySelector(".gz-tafel:not([hidden]) .gz-nochmal")), ergebnis: Boolean(document.querySelector(".cm-result-score")) }));
    pruefe(schluss.tafel && schluss.punkte === gespielt.punkte && schluss.schritt === "sturz" && !schluss.ergebnis,
      `Eiskanal: Am Ende der angeschauten Fahrt steht nicht dieselbe Zahl (oder keine Tafel): ${JSON.stringify({ ...schluss, gespielt: gespielt.punkte })}`);
    await kontext.close();
  }

  // --- 4g28. Felsflug: schaffbar, und der erste Kontakt beendet die Runde -------------
  // Die Schlucht steht da (WebGL), ohne dass sich der Browser beschwert. Am
  // freien Weg steht auf seiner ganzen Breite nichts – keine Wand, kein
  // Massiv, kein Turm, keine Tanne, kein Pfeiler –, und er biegt nie
  // schärfer, als sich lenken lässt. Hinten ist der Gang eng: Wand an Wand
  // kaum zehn Meter, und er schlägt Haken – je Sekunde mehr als doppelt so
  // oft wie vorne, gut einmal in der Sekunde. Ein
  // Autopilot, der die Kurven vorausnimmt, landet in mehreren gewürfelten
  // Schluchten im Tal. Wer nichts tut, prallt bald an – aber nicht in den
  // ersten fünf Sekunden. Nah am Fels zählt ein Mehrfaches, die Serie
  // steigt dort und fällt in der Mitte. Der erste Kontakt beendet die Runde.
  // Die Pfeiltasten lenken, und die letzte gilt. Und ein Lauf, angeschaut,
  // durch dieselbe Schlucht mit derselben Zahl.
  {
    const { kontext, seite } = await neueSeite({ width: 844, height: 390 });
    const vorher = fehlerAufSeite.length;
    await seite.goto(`${BASIS}/felsflug`, { waitUntil: "load" });
    await seite.waitForFunction(() => window.LernappFelsflug?.state?.welt && window.LernappFelsflug.view.cssW > 0, null, { timeout: 8000 });
    await seite.waitForTimeout(300);
    const bild = await seite.evaluate(() => {
      const S = window.LernappFelsflug;
      const leinwand = document.querySelector(".ff-canvas");
      return { ok: S.bild.ok, programme: Object.keys(S.bild.prog).length, breit: leinwand?.width || 0, phase: S.state.phase, schritt: S.state.schritt, ohne: Boolean(document.querySelector(".ff-ohne")) };
    });
    pruefe(bild.ok && bild.programme === 7 && bild.breit > 300 && bild.phase === "bereit" && bild.schritt === "start" && !bild.ohne,
      `Felsflug: Die Schlucht (WebGL 2) steht nicht da: ${JSON.stringify(bild)}`);

    // Der freie Weg, in fünf gewürfelten Schluchten: Meter für Meter liegt
    // links und rechts von ihm die halbe Breite frei, und er verlangt nie
    // mehr als vier Fünftel dessen, was der Flieger zur Seite kann.
    const weg = await seite.evaluate(() => {
      const S = window.LernappFelsflug;
      const st = S.state;
      const befunde = [];
      const arten = new Set();
      let dinge = 0;
      // Wie breit der Gang vorne und hinten ist, und wie oft er die Richtung
      // wechselt – je Sekunde Flug, denn darauf kommt es beim Lenken an.
      const gang = { vorne: [], hinten: [], hakenVorne: 0, hakenHinten: 0, sekVorne: 0, sekHinten: 0 };
      for (let lauf = 0; lauf < 5; lauf += 1) {
        document.querySelector(".cm-bar-left .cm-icon-again").click();
        S.weltBis(S.Z_ENDE + 300);
        const W = st.welt;
        dinge += W.dinge.length + W.buckel.length;
        for (const d of W.dinge) arten.add(d.art);
        for (const b of W.buckel) arten.add(b.art);
        if (W.massive.length) arten.add("massiv");
        if (W.zier.some((d) => d.art === "sturz")) arten.add("bogen");
        let eng = 99;
        let vorzeichen = 0;
        for (let z = 130; z <= S.Z_ENDE; z += 1) {
          const x = S.wegBei(z);
          const f0 = S.freiBei(z);
          if (z > 400 && z < 1100) { gang.vorne.push(f0.r - f0.l); gang.sekVorne += 1 / S.tempoBei(z); }
          if (z > 3000 && z < S.Z_ENDE - 250) { gang.hinten.push(f0.r - f0.l); gang.sekHinten += 1 / S.tempoBei(z); }
          const neigung = S.wegBei(z + 4) - S.wegBei(z - 4);
          if (Math.abs(neigung) > 0.4 && Math.sign(neigung) !== vorzeichen) {
            if (vorzeichen && z > 400 && z < 1100) gang.hakenVorne += 1;
            if (vorzeichen && z > 3000 && z < S.Z_ENDE - 250) gang.hakenHinten += 1;
            vorzeichen = Math.sign(neigung);
          }
          const halb = S.breiteBei(z) / 2;
          const frei = S.freiBei(z);
          const luft = Math.min(x - frei.l, frei.r - x);
          eng = Math.min(eng, luft - halb);
          if (luft < halb - 0.02 && befunde.length < 6) befunde.push(`bei ${z} m sind nur ${luft.toFixed(2)} m frei, versprochen ${halb.toFixed(2)}`);
          const steil = Math.abs(S.wegBei(z + 1) - S.wegBei(z - 1)) / 2;
          if (steil > S.kannBei(z) * 0.8 + 0.005 && befunde.length < 6) befunde.push(`bei ${z} m biegt der Weg mit ${steil.toFixed(2)}, lenkbar ${S.kannBei(z).toFixed(2)}`);
          // Auch quer: Keine Wand steht so schräg in den Weg, dass sie
          // seiner Mitte näher kommt als gut anderthalb Meter.
          const quer = S.abstandBei(x, z);
          if (quer < 1.6 && befunde.length < 6) befunde.push(`bei ${z} m steht der Fels nur ${quer.toFixed(2)} m neben der Mitte des Wegs`);
        }
        if (!W.fertig) befunde.push("Die Schlucht endet nicht im Tal");
        // Ein Spalt neben einem Massiv ist eng, aber zu fliegen.
        for (const m of W.massive) {
          for (let z = m.zA + 4; z < m.zB - 4; z += 2) {
            const k = Math.round((z - S.Z_MIN) / S.DZ);
            if (!(W.inselR[k] > W.inselL[k])) continue;
            const spalt = m.q > 0 ? W.inselL[k] - W.wandL[k] : W.wandR[k] - W.inselR[k];
            if (spalt < 4 && befunde.length < 6) befunde.push(`Spalt bei ${z} m nur ${spalt.toFixed(1)} m breit`);
          }
        }
      }
      const median = (liste) => liste.sort((a, b) => a - b)[Math.floor(liste.length / 2)];
      return {
        befunde, dinge, arten: [...arten].sort().join(","),
        vorne: median(gang.vorne), hinten: median(gang.hinten),
        // Haken je Sekunde Flug, vorne auf 700 m, hinten auf gut 1000 m, in fünf Schluchten.
        hakenVorne: gang.hakenVorne / gang.sekVorne, hakenHinten: gang.hakenHinten / gang.sekHinten,
      };
    });
    pruefe(weg.befunde.length === 0 && weg.dinge > 150 && weg.arten === "bogen,bruecke,klamm,massiv,nase,tanne,turm",
      `Felsflug: Der freie Weg ist nicht frei (oder es fehlt eine Art Hindernis) – ${JSON.stringify(weg)}`);
    pruefe(weg.vorne > 14 && weg.hinten < 10 && weg.hakenVorne < 0.5 && weg.hakenHinten > 0.6 && weg.hakenHinten > weg.hakenVorne * 2,
      `Felsflug: Der Gang wird nach hinten nicht eng und kurvig – ${JSON.stringify(weg)}`);

    // Der Autopilot: dem freien Weg nach, bis ins Tal. Er nimmt die Kurve
    // voraus – wie schnell der Weg gleich zur Seite zieht – und gleicht aus,
    // wo er danebenliegt.
    const PILOT = `(S, st) => {
      const v = S.tempoBei(st.z);
      const zz = st.z + v * 0.12;
      const steig = (S.wegBei(zz + 2) - S.wegBei(zz - 2)) / 4;
      const soll = steig * v + (S.wegBei(zz) - st.x - st.vx * 0.12) * 5;
      const d = soll - st.vx;
      S.lenke(d > 3 ? 1 : d < -3 ? -1 : 0);
    }`;
    const runden = await seite.evaluate((quelle) => {
      const pilot = new Function(`return (${quelle})`)();
      const S = window.LernappFelsflug;
      const st = S.state;
      const raus = [];
      for (let lauf = 0; lauf < 4; lauf += 1) {
        document.querySelector(".cm-bar-left .cm-icon-again").click();
        S.losGehts();
        for (let n = 0; st.phase !== "ende" && n < 200000; n += 1) {
          if (st.schritt === "flug") pilot(S, st);
          S.takt(1 / 120);
        }
        S.lenke(0);
        raus.push({ phase: st.phase, an: st.angekommen, gelandet: st.gelandet, punkte: st.punkte, meter: st.meter, sekunden: Math.round(st.flugzeit), zahl: document.querySelector(".cm-result-score") !== null });
      }
      return raus;
    }, PILOT);
    pruefe(runden.every((r) => r.phase === "ende" && r.an && r.gelandet && r.punkte >= 90 && r.punkte < 400 && r.sekunden > 70 && r.sekunden < 100 && r.zahl),
      `Felsflug: Der Autopilot kommt auf dem freien Weg nicht ins Tal – ${JSON.stringify(runden)}`);

    // Wer nichts tut: Die Schlucht biegt, er nicht. Jede Runde endet an der
    // Wand – nach den ersten fünf Sekunden, aber lange vor dem Tal.
    const nichts = await seite.evaluate(() => {
      const S = window.LernappFelsflug;
      const st = S.state;
      const raus = [];
      for (let lauf = 0; lauf < 4; lauf += 1) {
        document.querySelector(".cm-bar-left .cm-icon-again").click();
        S.losGehts();
        for (let n = 0; st.phase !== "ende" && n < 200000; n += 1) S.takt(1 / 120);
        raus.push({ phase: st.phase, an: st.angekommen, schritt: st.schritt, meter: st.meter, sekunden: Math.round(st.flugzeit * 10) / 10, text: document.querySelector(".cm-result-detail")?.textContent || "" });
      }
      return raus;
    });
    pruefe(nichts.every((r) => r.phase === "ende" && !r.an && r.schritt === "aus" && r.sekunden > 5 && r.meter < 1500),
      `Felsflug: Wer nichts tut, prallt nicht an (oder schon in den ersten Sekunden): ${JSON.stringify(nichts)}`);

    // Die Nähe zählt: Eine Sekunde zwei Meter neben der Wand bringt ein
    // Mehrfaches einer Sekunde in der Mitte, und die Serie steigt – in der
    // Mitte fällt sie wieder. Und wer die Wand berührt, ist draussen.
    const naehe = await seite.evaluate(() => {
      const S = window.LernappFelsflug;
      const st = S.state;
      document.querySelector(".cm-bar-left .cm-icon-again").click();
      S.losGehts();
      const W = st.welt;
      const wand = (z) => { const k = (z - S.Z_MIN) / S.DZ; const i = Math.floor(k); return W.wandL[i] + (W.wandL[i + 1] - W.wandL[i]) * (k - i); };
      const mitte = (z) => { const f = S.freiBei(z); return (f.l + f.r) / 2; };
      const flieg = (sekunden, wo) => {
        const vor = st.roh;
        for (let n = 0; n < sekunden * 120 && st.phase === "spiel"; n += 1) {
          st.x = wo(st.z + S.tempoBei(st.z) / 120);
          st.vx = 0;
          S.takt(1 / 120);
        }
        return st.roh - vor;
      };
      flieg(2.5, mitte);
      const inDerMitte = flieg(1, mitte);
      const serieMitte = st.serie;
      const amFels = flieg(1, (z) => wand(z) + 2.2);
      const serieFels = st.serie;
      const abstand = st.ab;
      flieg(4, mitte);
      const serieDanach = st.serie;
      const phaseVorher = st.phase;
      // Jetzt in die Wand.
      st.x = wand(st.z) + 0.2;
      let schritte = 0;
      for (; st.phase !== "ende" && schritte < 2000; schritte += 1) S.takt(1 / 120);
      return { inDerMitte, amFels, serieMitte, serieFels, serieDanach, abstand, phaseVorher, phase: st.phase, schritt: st.schritt, an: st.angekommen, sekunden: schritte / 120, text: document.querySelector(".cm-result-detail")?.textContent || "" };
    });
    pruefe(naehe.inDerMitte > 0.8 && naehe.inDerMitte < 1.3 && naehe.amFels > naehe.inDerMitte * 4 && naehe.abstand < 3
      && naehe.serieMitte === 1 && naehe.serieFels > 1.05 && naehe.serieDanach < naehe.serieFels,
    `Felsflug: Nah am Fels zählt nicht mehr (oder die Serie steigt und fällt nicht): ${JSON.stringify(naehe)}`);
    pruefe(naehe.phaseVorher === "spiel" && naehe.phase === "ende" && naehe.schritt === "aus" && !naehe.an && naehe.sekunden < 2.5,
      `Felsflug: Der erste Kontakt beendet die Runde nicht: ${JSON.stringify(naehe)}`);

    // Die Pfeiltasten: links, dann rechts dazu (die letzte gilt), rechts los,
    // links los. Der erste Druck startet die Runde.
    await seite.evaluate(() => document.querySelector(".cm-bar-left .cm-icon-again").click());
    const lage = () => seite.evaluate(() => ({ phase: window.LernappFelsflug.state.phase, lenk: window.LernappFelsflug.state.lenk }));
    const schritte = [await lage()];
    await seite.keyboard.down("ArrowLeft");
    schritte.push(await lage());
    await seite.keyboard.down("ArrowRight");
    schritte.push(await lage());
    await seite.keyboard.up("ArrowRight");
    schritte.push(await lage());
    await seite.keyboard.up("ArrowLeft");
    schritte.push(await lage());
    const soll = [{ phase: "bereit", lenk: 0 }, { phase: "spiel", lenk: -1 }, { phase: "spiel", lenk: 1 }, { phase: "spiel", lenk: -1 }, { phase: "spiel", lenk: 0 }];
    pruefe(JSON.stringify(schritte) === JSON.stringify(soll), `Felsflug: Die Pfeiltasten lenken nicht: ${JSON.stringify(schritte)}`);
    // Und der Finger: rechts vom Bild lenkt nach rechts, über die Mitte gezogen nach links.
    await seite.evaluate(() => document.querySelector(".cm-bar-left .cm-icon-again").click());
    await seite.mouse.move(700, 250);
    await seite.mouse.down();
    const rechts = await lage();
    await seite.mouse.move(120, 250, { steps: 4 });
    const links = await lage();
    await seite.mouse.up();
    const los = await lage();
    pruefe(rechts.phase === "spiel" && rechts.lenk === 1 && links.lenk === -1 && los.lenk === 0,
      `Felsflug: Der Finger lenkt nicht: ${JSON.stringify({ rechts, links, los })}`);
    pruefe(fehlerAufSeite.length === vorher, `Felsflug: Der Browser hat sich beschwert – ${fehlerAufSeite.slice(vorher).join(" / ")}`);
    await kontext.close();
  }
  {
    // Ein Lauf in echter Zeit – ein Stück dem freien Weg nach, dann an die
    // Wand –, aufgezeichnet und angeschaut: dieselbe Schlucht, am Schluss
    // dieselbe Zahl, und der Flieger prallt wieder an.
    const { kontext, seite } = await neueSeite({ width: 844, height: 390 });
    await seite.addInitScript(() => {
      if (sessionStorage.getItem("__felsflug")) return;
      sessionStorage.setItem("__felsflug", "1");
      localStorage.setItem("mini.name", "Zora");
    });
    await seite.goto(`${BASIS}/felsflug`, { waitUntil: "load" });
    await seite.waitForFunction(() => window.LernappFelsflug?.state?.welt && window.LernappFelsflug.view.cssW > 0, null, { timeout: 8000 });
    const welt = await seite.evaluate(() => window.LernappFelsflug.weltText());
    await seite.evaluate(() => new Promise((fertig) => {
      const S = window.LernappFelsflug;
      const st = S.state;
      S.losGehts();
      const lauf = () => {
        if (st.phase !== "spiel") { fertig(); return; }
        if (st.schritt === "flug") {
          // Bis 230 m dem Weg nach, dann nach links, bis die Wand kommt.
          const ziel = S.wegBei(st.z + S.tempoBei(st.z) * 0.25);
          const d = ziel - st.x - st.vx * 0.1;
          S.lenke(st.z > 230 ? -1 : d > 0.5 ? 1 : d < -0.5 ? -1 : 0);
        }
        requestAnimationFrame(lauf);
      };
      requestAnimationFrame(lauf);
    }));
    await seite.waitForSelector(".cm-result-score", { timeout: 60000 }).catch(() => {});
    await seite.waitForFunction(() => [...(window.__miniGeister?.keys?.() || [])].some((k) => k.startsWith("cliffFlight_")), null, { timeout: 4000 }).catch(() => {});
    const gespielt = await seite.evaluate(() => {
      const kennung = localStorage.getItem("mini.id");
      const geist = window.__miniGeister?.get(`cliffFlight_${kennung}`) || null;
      let d = null;
      try { d = JSON.parse(geist?.bahn || "null"); } catch { d = null; }
      const st = window.LernappFelsflug.state;
      return { kennung, saat: d?.s ?? null, mitOrt: Boolean(window.LernappGeist.entpacke(geist?.bahn)?.c), punkte: geist?.punkte || 0, gezaehlt: st.punkte, meter: st.meter, an: st.angekommen, schritt: st.schritt };
    });
    pruefe(gespielt.kennung && Number.isInteger(gespielt.saat) && gespielt.mitOrt && gespielt.punkte > 3 && gespielt.punkte === gespielt.gezaehlt && gespielt.meter > 230 && !gespielt.an && gespielt.schritt === "aus",
      `Felsflug: Der Lauf wird nicht mit Saat, Ort und Schräglage hinterlegt: ${JSON.stringify(gespielt)}`);
    await seite.goto(`${BASIS}/felsflug?zuschauen=${gespielt.kennung}`, { waitUntil: "load" });
    await seite.waitForFunction(() => window.LernappFelsflug?.state?.phase === "zuschauen", null, { timeout: 8000 }).catch(() => {});
    const zu = await seite.evaluate(() => ({ phase: window.LernappFelsflug.state.phase, welt: window.LernappFelsflug.weltText() }));
    pruefe(zu.phase === "zuschauen" && zu.welt === welt,
      `Felsflug: Beim Zuschauen entsteht eine andere Schlucht:\n  gespielt ${welt}\n  angeschaut ${JSON.stringify(zu)}`);
    await seite.waitForFunction(() => window.LernappFelsflug.state.z > 120, null, { timeout: 30000 }).catch(() => {});
    const unterwegs = await seite.evaluate(() => ({ z: Math.round(window.LernappFelsflug.state.z), schritt: window.LernappFelsflug.state.schritt, lenk: window.LernappFelsflug.state.lenk }));
    pruefe(unterwegs.z > 100 && unterwegs.lenk === 0, `Felsflug: Beim Zuschauen fliegt der Flieger nicht mit: ${JSON.stringify(unterwegs)}`);
    await seite.waitForSelector(".gz-tafel:not([hidden]) .gz-nochmal", { timeout: 60000 }).catch(() => {});
    const schluss = await seite.evaluate(() => ({ punkte: window.LernappFelsflug.state.punkte, schritt: window.LernappFelsflug.state.schritt, meter: window.LernappFelsflug.state.meter, tafel: Boolean(document.querySelector(".gz-tafel:not([hidden]) .gz-nochmal")), ergebnis: Boolean(document.querySelector(".cm-result-score")) }));
    pruefe(schluss.tafel && schluss.punkte === gespielt.punkte && schluss.schritt === "aus" && Math.abs(schluss.meter - gespielt.meter) < 25 && !schluss.ergebnis,
      `Felsflug: Am Ende des angeschauten Laufs steht nicht dieselbe Zahl (oder keine Tafel): ${JSON.stringify({ ...schluss, gespielt: gespielt.punkte, meterGespielt: gespielt.meter })}`);
    await kontext.close();
  }

  // --- 4g30. Hammerwurf: schaffbar, und jede Runde endet von selbst ----------------
  // Ein Autopilot lässt los, sobald der Hammer in die innere Hälfte des
  // Sektors zeigt und die Weite (mit Wind) die Qualifikation um einen Meter
  // übertrifft. Er kommt auf mehreren gewürfelten Welten auf neun gültige
  // Würfe und mehr (wie viele, hängt am Wind der letzten); danach reicht
  // keine Drehung mehr, und er tritt über – jede Runde endet von selbst. Einer, der nur auf die Mittellinie wirft, holt mit dem
  // Bonus mehr. Wer immer beim ersten Mal loslässt, ist bald zu kurz; wer
  // nie loslässt, tritt über; wer nach hinten loslässt, trifft das Netz,
  // wer knapp neben den Sektor, wirft ungültig – jedes Mal mit Ergebnis.
  {
    const { kontext, seite } = await neueSeite({ width: 420, height: 820 });
    await seite.goto(`${BASIS}/hammerwurf`, { waitUntil: "load" });
    await seite.waitForFunction(() => window.LernappHammerwurf?.state && window.LernappHammerwurf.view.cssW > 0, null, { timeout: 8000 });
    // Der Pilot als Text: faktor – wie weit in den Sektor (1 = ganz),
    // reserve – wie viel über die Qualifikation, art – "erst" (beim ersten
    // Mal im Sektor), "netz", "daneben" oder "nie".
    const PILOT = `(H, st, { faktor = 0.5, reserve = 1, art = "" } = {}) => {
      if (st.schritt !== "drehen") return;
      const abw = Math.abs(H.normGrad(st.th * 180 / Math.PI + 90 - 90));
      const s = H.sektorBei(st.wurf);
      if (art === "nie") return;
      if (art === "netz") { if (abw > s + H.NETZ_RAND + 8 && abw < 150) H.tippen(); return; }
      if (art === "daneben") { if (abw > s + 1.5 && abw < s + H.NETZ_RAND - 1.5) H.tippen(); return; }
      if (art === "erst") { if (abw <= s * 0.5) H.tippen(); return; }
      const weite = H.weiteAus(st.w) * (1 + 0.035 * H.windBei(st.wurf));
      if (abw <= s * faktor && weite >= H.quali(st.wurf) + reserve) H.tippen();
    }`;
    const runde = (quelle, opt, laeufe) => seite.evaluate(({ quelle, opt, laeufe }) => {
      const pilot = new Function(`return (${quelle})`)();
      const H = window.LernappHammerwurf;
      const st = H.state;
      const raus = [];
      for (let lauf = 0; lauf < laeufe; lauf += 1) {
        document.querySelector(".cm-bar-left .cm-icon-again").click();
        H.tippen();
        for (let n = 0; st.phase === "spiel" && n < 120 * 400; n += 1) {
          pilot(H, st, opt);
          H.takt(1 / 120);
          if (st.aus && st.schritt !== "drehen" && st.schritt !== "flug") break;
        }
        const gueltig = st.marken.filter((m) => !m.aus).length;
        raus.push({ gueltig, aus: st.aus, punkte: st.punkte, mitten: st.mitten, welt: H.weltText() });
      }
      return raus;
    }, { quelle, opt, laeufe });
    const normal = await runde(PILOT, {}, 3);
    pruefe(normal.every((r) => r.gueltig >= 9 && r.gueltig <= 14 && r.aus === "uebertreten" && r.punkte >= 400),
      `Hammerwurf: Der Autopilot kommt nicht auf neun Würfe, oder die Runde endet nicht von selbst – ${JSON.stringify(normal)}`);
    pruefe(new Set(normal.map((r) => r.welt)).size > 1, `Hammerwurf: Der Wind ist in jeder Runde derselbe – ${JSON.stringify(normal.map((r) => r.welt))}`);
    const mitte = await runde(PILOT, { faktor: 0.25 }, 3);
    const schnitt = (l) => l.reduce((a, r) => a + r.punkte, 0) / l.length;
    pruefe(mitte.every((r) => r.mitten >= 6) && schnitt(mitte) > schnitt(normal) + 40,
      `Hammerwurf: Wer auf die Mittellinie wirft, holt nicht mehr – ${JSON.stringify({ mitte, normal: schnitt(normal) })}`);
    for (const [art, aus] of [["erst", "kurz"], ["nie", "uebertreten"], ["netz", "netz"], ["daneben", "ungueltig"]]) {
      const [r] = await runde(PILOT, { art }, 1);
      await seite.waitForSelector(".cm-result-score", { timeout: 6000 }).catch(() => {});
      const tafel = await seite.locator(".cm-result-score").count();
      pruefe(r.aus === aus && tafel === 1, `Hammerwurf: «${art}» endet nicht mit «${aus}» und einer Tafel: ${JSON.stringify({ ...r, tafel })}`);
    }
    // Losgelassen fliegt er tangential: Steht der Hammer rechts vom Werfer,
    // fliegt er genau die Mittellinie hinauf.
    const richtung = await seite.evaluate(() => {
      const H = window.LernappHammerwurf;
      return [0, 30, -30].map((d) => Math.round(H.ergebnis(d + 90, H.W0, 0).abw));
    });
    pruefe(JSON.stringify(richtung) === "[0,30,30]", `Hammerwurf: Die Richtung beim Loslassen stimmt nicht: ${JSON.stringify(richtung)}`);
    await kontext.close();
  }
  {
    // Ein Lauf in echter Zeit – zwei gute Würfe, dann ins Netz –, aufgezeichnet
    // und angeschaut: derselbe Wind, am Schluss dieselbe Zahl.
    const { kontext, seite } = await neueSeite({ width: 420, height: 820 });
    await seite.addInitScript(() => {
      if (sessionStorage.getItem("__hammer")) return;
      sessionStorage.setItem("__hammer", "1");
      localStorage.setItem("mini.name", "Hanna");
    });
    await seite.goto(`${BASIS}/hammerwurf`, { waitUntil: "load" });
    await seite.waitForFunction(() => window.LernappHammerwurf?.state && window.LernappHammerwurf.view.cssW > 0, null, { timeout: 8000 });
    const welt = await seite.evaluate(() => window.LernappHammerwurf.weltText());
    await seite.evaluate(() => new Promise((fertig) => {
      const H = window.LernappHammerwurf;
      const st = H.state;
      H.tippen();
      const lauf = () => {
        if (st.phase !== "spiel") { fertig(); return; }
        if (st.schritt === "drehen") {
          const abw = Math.abs(H.normGrad(st.th * 180 / Math.PI));
          const s = H.sektorBei(st.wurf);
          const weite = H.weiteAus(st.w) * (1 + 0.035 * H.windBei(st.wurf));
          if (st.wurf < 2 ? abw <= s * 0.6 && weite >= H.quali(st.wurf) + 2 : abw > s + H.NETZ_RAND + 10 && abw < 150) H.tippen();
        }
        requestAnimationFrame(lauf);
      };
      requestAnimationFrame(lauf);
    }));
    await seite.waitForSelector(".cm-result-score", { timeout: 40000 }).catch(() => {});
    await seite.waitForFunction(() => [...(window.__miniGeister?.keys?.() || [])].some((k) => k.startsWith("hammerThrow_")), null, { timeout: 4000 }).catch(() => {});
    const gespielt = await seite.evaluate(() => {
      const kennung = localStorage.getItem("mini.id");
      const geist = window.__miniGeister?.get(`hammerThrow_${kennung}`) || null;
      const st = window.LernappHammerwurf.state;
      return { kennung, punkte: geist?.punkte || 0, gezaehlt: st.punkte, gueltig: st.marken.filter((m) => !m.aus).length, aus: st.aus };
    });
    pruefe(gespielt.kennung && gespielt.punkte > 0 && gespielt.punkte === gespielt.gezaehlt && gespielt.gueltig === 2 && gespielt.aus === "netz",
      `Hammerwurf: Der Lauf wird nicht hinterlegt: ${JSON.stringify(gespielt)}`);
    await seite.goto(`${BASIS}/hammerwurf?zuschauen=${gespielt.kennung}`, { waitUntil: "load" });
    await seite.waitForFunction(() => window.LernappHammerwurf?.state?.phase === "zuschauen", null, { timeout: 8000 }).catch(() => {});
    const zu = await seite.evaluate(() => ({ phase: window.LernappHammerwurf.state.phase, welt: window.LernappHammerwurf.weltText() }));
    pruefe(zu.phase === "zuschauen" && zu.welt === welt, `Hammerwurf: Beim Zuschauen weht ein anderer Wind:\n  gespielt ${welt}\n  angeschaut ${JSON.stringify(zu)}`);
    await seite.mouse.click(200, 500);
    await seite.waitForSelector(".gz-tafel:not([hidden]) .gz-nochmal", { timeout: 40000 }).catch(() => {});
    const schluss = await seite.evaluate(() => {
      const st = window.LernappHammerwurf.state;
      return { punkte: st.punkte, gueltig: st.marken.filter((m) => !m.aus).length, aus: st.aus, tafel: Boolean(document.querySelector(".gz-tafel:not([hidden]) .gz-nochmal")) };
    });
    pruefe(schluss.tafel && schluss.punkte === gespielt.punkte && schluss.gueltig === 2 && schluss.aus === "netz",
      `Hammerwurf: Am Ende des angeschauten Laufs steht nicht dasselbe: ${JSON.stringify({ ...schluss, gespielt })}`);
    await kontext.close();
  }

  // --- 4g31. Entenfamilie: jeder Fluss hat seine Welle, und ein Boot beendet die Runde --
  // Ein Autopilot wartet am Ufer, bis die Familie ohne Halt hinüberkommt
  // (querungOk – dieselbe Rechnung wie das Spiel), und schwimmt dann los. Er
  // findet auf jeder Welt für jeden Fluss eine Welle in höchstens einem Takt
  // und quert in neunzig Sekunden mindestens sechs Flüsse, jeden in einem
  // Zug. Jede Bahn wiederholt sich im Takt ihres Flusses. Wer einfach
  // losschwimmt und nie loslässt, wird bald erwischt; wer gar nicht
  // schwimmt, sieht die Sonne untergehen – beides mit Ergebnis.
  {
    const { kontext, seite } = await neueSeite({ width: 420, height: 820 });
    await seite.goto(`${BASIS}/entenfamilie`, { waitUntil: "load" });
    await seite.waitForFunction(() => window.LernappEntenfamilie?.state && window.LernappEntenfamilie.view.cssW > 0, null, { timeout: 8000 });
    const laeufe = await seite.evaluate(() => {
      const E = window.LernappEntenfamilie;
      const st = E.state;
      const raus = [];
      for (let lauf = 0; lauf < 3; lauf += 1) {
        document.querySelector(".cm-bar-left .cm-icon-again").click();
        E.druecken();
        E.loslassen();
        let start = null;
        let fluss = -1;
        let langsamste = 0;
        for (let n = 0; st.phase === "spiel" && st.schritt === "unterwegs" && n < 240 * 120; n += 1) {
          if (st.fluss !== fluss) {
            fluss = st.fluss;
            const w = E.wartenBisWelle(st.fluesse[st.fluss].takt + 0.5);
            langsamste = Math.max(langsamste, w ?? 99);
            start = w === null ? null : st.uhr + w;
          }
          if (start !== null && st.uhr >= start - 1e-9) E.druecken(); else E.loslassen();
          E.takt(1 / 240);
        }
        E.loslassen();
        // Jede Bahn wiederholt sich im Takt ihres Flusses (wdh Mal je Takt),
        // und kein Takt ist länger als nötig.
        const takte = st.fluesse.every((f) => f.takt < 11 && f.reihen.every((r) => r.art !== "bahn" || Math.abs(r.P * r.wdh - r.v * f.takt) < 1e-6));
        raus.push({ geschafft: st.geschafft, zuege: st.zuege, schritt: st.schritt, punkte: st.punkte, langsamste: Math.round(langsamste * 10) / 10, takte, welt: E.weltText() });
      }
      return raus;
    });
    pruefe(laeufe.every((l) => l.geschafft >= 6 && l.zuege === l.geschafft && l.schritt === "unterwegs" && l.langsamste < 99 && l.takte),
      `Entenfamilie: Der Autopilot findet nicht für jeden Fluss eine Welle – ${JSON.stringify(laeufe)}`);
    pruefe(new Set(laeufe.map((l) => l.welt)).size > 1, `Entenfamilie: Die Boote sind in jeder Runde dieselben – ${JSON.stringify(laeufe.map((l) => l.welt))}`);
    await seite.waitForSelector(".cm-result-score", { timeout: 4000 }).catch(() => {});
    const blind = await seite.evaluate(() => {
      const E = window.LernappEntenfamilie;
      const st = E.state;
      const raus = [];
      for (let lauf = 0; lauf < 3; lauf += 1) {
        document.querySelector(".cm-bar-left .cm-icon-again").click();
        E.druecken();
        for (let n = 0; st.phase === "spiel" && st.schritt === "unterwegs" && n < 240 * 90; n += 1) E.takt(1 / 240);
        E.loslassen();
        raus.push({ schritt: st.schritt, geschafft: st.geschafft, getroffen: st.getroffen });
      }
      return raus;
    });
    pruefe(blind.every((l) => l.schritt === "erwischt" && l.geschafft < 3 && l.getroffen >= 0),
      `Entenfamilie: Wer blind losschwimmt, kommt trotzdem durch – ${JSON.stringify(blind)}`);
    await seite.waitForSelector(".cm-result-score", { timeout: 6000 }).catch(() => {});
    pruefe(await seite.locator(".cm-result-score").count() === 1, "Entenfamilie: Nach dem Treffer kommt kein Ergebnis.");
    // Halten und loslassen: Die Küken rücken auf, wenn die Mutter wartet, und
    // ziehen sich wieder auseinander, wenn sie schwimmt.
    const kette = await seite.evaluate(() => {
      const E = window.LernappEntenfamilie;
      const st = E.state;
      document.querySelector(".cm-bar-left .cm-icon-again").click();
      E.druecken();
      for (let n = 0; n < 240 * 0.6; n += 1) E.takt(1 / 240);
      const lang = st.enten[0].y - st.enten[st.enten.length - 1].y;
      E.loslassen();
      for (let n = 0; n < 240 * 1; n += 1) E.takt(1 / 240);
      const eng = st.enten[0].y - st.enten[st.enten.length - 1].y;
      return { lang, eng, schritt: st.schritt };
    });
    pruefe(kette.lang > kette.eng + 0.3, `Entenfamilie: Die Küken rücken nicht auf, wenn die Mutter wartet: ${JSON.stringify(kette)}`);
    await kontext.close();
  }
  {
    // Ein Lauf in echter Zeit – ein Fluss mit der Welle, dann blind in die
    // Boote –, aufgezeichnet und angeschaut: dieselben Boote, dieselbe Zahl.
    const { kontext, seite } = await neueSeite({ width: 420, height: 820 });
    await seite.addInitScript(() => {
      if (sessionStorage.getItem("__enten")) return;
      sessionStorage.setItem("__enten", "1");
      localStorage.setItem("mini.name", "Emil");
    });
    await seite.goto(`${BASIS}/entenfamilie`, { waitUntil: "load" });
    await seite.waitForFunction(() => window.LernappEntenfamilie?.state && window.LernappEntenfamilie.view.cssW > 0, null, { timeout: 8000 });
    const welt = await seite.evaluate(() => window.LernappEntenfamilie.weltText());
    await seite.evaluate(() => new Promise((fertig) => {
      const E = window.LernappEntenfamilie;
      const st = E.state;
      E.druecken();
      E.loslassen();
      let start = null;
      const lauf = () => {
        if (st.phase !== "spiel") { fertig(); return; }
        if (st.fluss === 0 && start === null) start = st.uhr + (E.wartenBisWelle(st.fluesse[0].takt + 0.5) ?? 0);
        if (st.fluss > 0 || st.uhr >= start) E.druecken(); else E.loslassen();
        requestAnimationFrame(lauf);
      };
      requestAnimationFrame(lauf);
    }));
    await seite.waitForSelector(".cm-result-score", { timeout: 60000 }).catch(() => {});
    await seite.waitForFunction(() => [...(window.__miniGeister?.keys?.() || [])].some((k) => k.startsWith("duckCrossing_")), null, { timeout: 4000 }).catch(() => {});
    const gespielt = await seite.evaluate(() => {
      const kennung = localStorage.getItem("mini.id");
      const geist = window.__miniGeister?.get(`duckCrossing_${kennung}`) || null;
      const st = window.LernappEntenfamilie.state;
      return { kennung, punkte: geist?.punkte || 0, gezaehlt: st.punkte, geschafft: st.geschafft, schritt: st.schritt };
    });
    pruefe(gespielt.kennung && gespielt.punkte > 0 && gespielt.punkte === gespielt.gezaehlt && gespielt.geschafft >= 1 && gespielt.schritt === "erwischt",
      `Entenfamilie: Der Lauf wird nicht hinterlegt: ${JSON.stringify(gespielt)}`);
    await seite.goto(`${BASIS}/entenfamilie?zuschauen=${gespielt.kennung}`, { waitUntil: "load" });
    await seite.waitForFunction(() => window.LernappEntenfamilie?.state?.phase === "zuschauen", null, { timeout: 8000 }).catch(() => {});
    const zu = await seite.evaluate(() => ({ phase: window.LernappEntenfamilie.state.phase, welt: window.LernappEntenfamilie.weltText() }));
    pruefe(zu.phase === "zuschauen" && zu.welt === welt, `Entenfamilie: Beim Zuschauen fahren andere Boote:\n  gespielt ${welt}\n  angeschaut ${JSON.stringify(zu)}`);
    await seite.waitForSelector(".gz-tafel:not([hidden]) .gz-nochmal", { timeout: 60000 }).catch(() => {});
    const schluss = await seite.evaluate(() => {
      const st = window.LernappEntenfamilie.state;
      return { punkte: st.punkte, geschafft: st.geschafft, tafel: Boolean(document.querySelector(".gz-tafel:not([hidden]) .gz-nochmal")) };
    });
    pruefe(schluss.tafel && schluss.punkte === gespielt.punkte && schluss.geschafft === gespielt.geschafft,
      `Entenfamilie: Am Ende des angeschauten Laufs steht nicht dasselbe: ${JSON.stringify({ ...schluss, gespielt })}`);
    await kontext.close();
  }

  // --- 4g32. Höhlenfahrt: jede Stelle hat ihr Band, und wer nie bremst, hängt im Fels -
  // Ein Pilot (grubenlore.js, pilot – er rechnet mit derselben Fahrt voraus)
  // bremst so spät wie möglich. Er stösst auf keiner Welt je an: Am Ende holt
  // ihn der Einsturz ein, nach mindestens 450 m und einem Dutzend Stellen.
  // Jede Stelle hat ein Band, in dem man heil hindurchkommt, und davor Gleis
  // genug, um es zu treffen. Wer nie bremst, hängt an der ersten Kuppe im
  // Felsdach; wer immer bremst, den holt der Einsturz – beides mit Ergebnis.
  {
    const { kontext, seite } = await neueSeite({ width: 1000, height: 640 });
    await seite.goto(`${BASIS}/grubenlore`, { waitUntil: "load" });
    await seite.waitForFunction(() => window.LernappGrubenlore?.state?.welt && window.LernappGrubenlore.view.cssW > 0, null, { timeout: 8000 });
    const laeufe = await seite.evaluate(() => {
      const L = window.LernappGrubenlore;
      const st = L.state;
      const raus = [];
      for (let lauf = 0; lauf < 3; lauf += 1) {
        document.querySelector(".cm-bar-left .cm-icon-again").click();
        L.druecken();
        L.loslassen();
        for (let n = 0; st.phase === "spiel" && !st.endet && n < 240 * 240; n += 1) {
          if (n % 4 === 0) { if (L.pilot(st.welt, st.z)) L.druecken(); else L.loslassen(); }
          L.takt(1 / 240);
        }
        L.loslassen();
        const durch = st.welt.stellen.filter((h) => h.durch);
        // Jede Stelle: ein Band mit Platz, der rechte Rand zur rechten Art,
        // und Gleis davor.
        const baender = st.welt.stellen.every((h) => h.s0 - h.sFrei >= 6 && h.s1 > h.s0 && (h.art === "stampfer"
          || ((h.art === "kuppe" || h.art === "knick") && h.lo <= 3 && h.hi >= 4.5 && h.hi < L.V_DECKEL && h.gold)
          || ((h.art === "schacht" || h.art === "looping") && h.lo >= 4 && h.lo < L.V_DECKEL && h.hi === Infinity && h.gold)));
        const offen = st.welt.stampfer.every((s) => s.T - s.unten - 0.32 >= L.S_OFFEN_MIN - 1e-9);
        raus.push({
          meter: st.meter, grund: st.grund, stellen: durch.length, arten: [...new Set(durch.map((h) => h.art))].sort().join(","),
          knappe: st.knappe, baender, offen, welt: L.weltText(),
        });
      }
      return raus;
    });
    pruefe(laeufe.every((l) => l.grund === "einsturz" && l.meter >= 450 && l.stellen >= 10 && l.baender && l.offen),
      `Höhlenfahrt: Der Pilot kommt nicht durch jedes Bergwerk – ${JSON.stringify(laeufe.map(({ welt, ...rest }) => rest))}`);
    pruefe(laeufe.some((l) => l.arten.includes("kuppe") && l.arten.includes("schacht")) && laeufe.some((l) => l.knappe > 0),
      `Höhlenfahrt: Unterwegs fehlen Kuppe, Schacht oder ein «haarscharf» – ${JSON.stringify(laeufe.map((l) => [l.arten, l.knappe]))}`);
    pruefe(new Set(laeufe.map((l) => l.welt)).size > 1, `Höhlenfahrt: Das Bergwerk ist in jeder Runde dasselbe – ${JSON.stringify(laeufe.map((l) => l.welt))}`);
    await seite.waitForSelector(".cm-result-score", { timeout: 4000 }).catch(() => {});
    const blind = await seite.evaluate(() => {
      const L = window.LernappGrubenlore;
      const st = L.state;
      const raus = [];
      // Nie gebremst – und immer gebremst, sobald sie rollt.
      for (const immer of [false, false, true]) {
        document.querySelector(".cm-bar-left .cm-icon-again").click();
        L.druecken();
        L.loslassen();
        for (let n = 0; st.phase === "spiel" && !st.endet && n < 240 * 90; n += 1) {
          if (immer) { if (st.z.v > 4) L.druecken(); else L.loslassen(); }
          L.takt(1 / 240);
        }
        L.loslassen();
        raus.push({ immer, grund: st.grund, meter: st.meter, stelle: st.welt.stellen[st.stelleNr]?.art });
      }
      return raus;
    });
    pruefe(blind.every((l) => (l.immer ? l.grund === "einsturz" : l.grund === "decke" && l.stelle === "kuppe") && l.meter < 160),
      `Höhlenfahrt: Wer nie oder immer bremst, kommt trotzdem weit – ${JSON.stringify(blind)}`);
    await seite.waitForSelector(".cm-result-score", { timeout: 6000 }).catch(() => {});
    pruefe(await seite.locator(".cm-result-score").count() === 1, "Höhlenfahrt: Nach dem Einsturz kommt kein Ergebnis.");
    // Die Bremse hält am Hang, und wer loslässt, pumpt wieder auf Schritttempo.
    const bremse = await seite.evaluate(() => {
      const L = window.LernappGrubenlore;
      const st = L.state;
      document.querySelector(".cm-bar-left .cm-icon-again").click();
      L.druecken();
      L.loslassen();
      for (let n = 0; n < 240 * 2.5; n += 1) L.takt(1 / 240);
      const rollt = st.z.v;
      L.druecken();
      for (let n = 0; n < 240 * 3; n += 1) L.takt(1 / 240);
      const steht = st.z.v;
      L.loslassen();
      for (let n = 0; n < 240 * 1; n += 1) L.takt(1 / 240);
      return { rollt, steht, pumpt: st.z.v, schritt: L.V_PUMPE };
    });
    pruefe(bremse.rollt > 4 && bremse.steht === 0 && bremse.pumpt >= bremse.schritt - 0.01,
      `Höhlenfahrt: Die Bremse hält nicht, oder die Lore kommt nicht wieder los: ${JSON.stringify(bremse)}`);
    await kontext.close();
  }
  {
    // Ein Lauf in echter Zeit – mit dem Piloten über die ersten Stellen, dann
    // ohne Bremse in die nächste Kuppe –, aufgezeichnet und angeschaut:
    // dasselbe Bergwerk, dieselbe Zahl.
    const { kontext, seite } = await neueSeite({ width: 900, height: 600 });
    await seite.addInitScript(() => {
      if (sessionStorage.getItem("__lore")) return;
      sessionStorage.setItem("__lore", "1");
      localStorage.setItem("mini.name", "Lore");
    });
    await seite.goto(`${BASIS}/grubenlore`, { waitUntil: "load" });
    await seite.waitForFunction(() => window.LernappGrubenlore?.state?.welt && window.LernappGrubenlore.view.cssW > 0, null, { timeout: 8000 });
    const welt = await seite.evaluate(() => window.LernappGrubenlore.weltText());
    await seite.evaluate(() => new Promise((fertig) => {
      const L = window.LernappGrubenlore;
      const st = L.state;
      L.druecken();
      L.loslassen();
      const lauf = () => {
        if (st.phase !== "spiel" || st.endet) { L.loslassen(); fertig(); return; }
        if (st.stelleNr < 3 && L.pilot(st.welt, st.z)) L.druecken(); else L.loslassen();
        requestAnimationFrame(lauf);
      };
      requestAnimationFrame(lauf);
    }));
    await seite.waitForSelector(".cm-result-score", { timeout: 60000 }).catch(() => {});
    await seite.waitForFunction(() => [...(window.__miniGeister?.keys?.() || [])].some((k) => k.startsWith("mineCart_")), null, { timeout: 4000 }).catch(() => {});
    const gespielt = await seite.evaluate(() => {
      const kennung = localStorage.getItem("mini.id");
      const geist = window.__miniGeister?.get(`mineCart_${kennung}`) || null;
      const st = window.LernappGrubenlore.state;
      return { kennung, punkte: geist?.punkte || 0, gezaehlt: st.punkte, stellen: st.stelleNr, grund: st.grund };
    });
    pruefe(gespielt.kennung && gespielt.punkte > 100 && gespielt.punkte === gespielt.gezaehlt && gespielt.stellen >= 3 && gespielt.grund !== "einsturz",
      `Höhlenfahrt: Der Lauf wird nicht hinterlegt: ${JSON.stringify(gespielt)}`);
    await seite.goto(`${BASIS}/grubenlore?zuschauen=${gespielt.kennung}`, { waitUntil: "load" });
    await seite.waitForFunction(() => window.LernappGrubenlore?.state?.phase === "zuschauen", null, { timeout: 8000 }).catch(() => {});
    const zu = await seite.evaluate(() => ({ phase: window.LernappGrubenlore.state.phase, welt: window.LernappGrubenlore.weltText() }));
    pruefe(zu.phase === "zuschauen" && zu.welt === welt, `Höhlenfahrt: Beim Zuschauen steht ein anderes Bergwerk da:\n  gespielt ${welt}\n  angeschaut ${JSON.stringify(zu)}`);
    await seite.waitForSelector(".gz-tafel:not([hidden]) .gz-nochmal", { timeout: 60000 }).catch(() => {});
    const schluss = await seite.evaluate(() => {
      const st = window.LernappGrubenlore.state;
      return { punkte: st.punkte, stellen: st.stelleNr, endet: st.endet > 0, tafel: Boolean(document.querySelector(".gz-tafel:not([hidden]) .gz-nochmal")) };
    });
    pruefe(schluss.tafel && schluss.endet && Math.abs(schluss.punkte - gespielt.punkte) <= 1 && schluss.stellen === gespielt.stellen,
      `Höhlenfahrt: Am Ende des angeschauten Laufs steht nicht dasselbe: ${JSON.stringify({ ...schluss, gespielt })}`);
    await kontext.close();
  }

  // --- 4g33. Zwei Rotoren: jeder Parcours fliegbar, und ohne Daumen endet der Flug ----
  // Ein Pilot (rotoren.js, pilot – er rechnet mit demselben Flug voraus) fliegt
  // auf jeder Welt durch mindestens elf Tore, die meisten mittig; am Ende ist
  // der Akku leer oder ein Pfosten im Weg. Jedes Tor ist breit genug, liegt
  // in seinem Band und steht still – und je weiter, desto höher hinauf und
  // tiefer hinunter liegt das nächste. Wer nichts drückt, landet auf einem Dach; wer
  // beide hält, steigt, bis der Akku leer ist – beides mit Ergebnis. Der
  // linke Rotor schiebt nach rechts, der rechte nach links.
  {
    const { kontext, seite } = await neueSeite({ width: 1000, height: 640 });
    await seite.goto(`${BASIS}/rotoren`, { waitUntil: "load" });
    await seite.waitForFunction(() => window.LernappRotoren?.state?.welt && window.LernappRotoren.view.cssW > 0, null, { timeout: 8000 });
    const fluege = await seite.evaluate(() => {
      const R = window.LernappRotoren;
      const st = R.state;
      const raus = [];
      for (let lauf = 0; lauf < 3; lauf += 1) {
        document.querySelector(".cm-bar-left .cm-icon-again").click();
        R.druecken("links");
        R.druecken("rechts");
        for (let n = 0; st.phase === "spiel" && !st.endet && n < 240 * 240; n += 1) {
          if (n % 8 === 0) {
            const [links, rechts] = R.pilot(st.welt, st.d);
            if (links) R.druecken("links"); else R.loslassen("links");
            if (rechts) R.druecken("rechts"); else R.loslassen("rechts");
          }
          R.takt(1 / 240);
        }
        R.allesLos();
        R.toreBis(st.welt, 60);
        const tore = st.welt.tore.slice(0, 60);
        const gebaut = tore.every((t, i) => t.halb >= 1.2 && t.y >= R.HOCH_MIN - 1e-6 && t.y <= R.HOCH_MAX + 1e-6 && (!i || t.x - tore[i - 1].x >= 4.4));
        // Still: zu jeder Zeit an derselben Stelle.
        const a = {};
        const b = {};
        const still = tore.every((t) => {
          R.torLage(t, 0, a);
          R.torLage(t, 7.3, b);
          return a.x === b.x && a.y === b.y && a.w === b.w;
        });
        // Wie weit es im Schnitt hinauf oder hinunter geht: am Anfang und später.
        const hub = (von, bis) => tore.slice(von, bis).reduce((summe, t, i, liste) => summe + (i ? Math.abs(t.y - liste[i - 1].y) : 0), 0) / (bis - von - 1);
        raus.push({
          tore: st.d.tor, punkte: st.punkte, mittige: st.d.mittige, grund: st.grund, gebaut, still,
          hubAnfang: Math.round(hub(2, 9) * 10) / 10, hubSpaeter: Math.round(hub(25, 36) * 10) / 10, welt: R.weltText(),
        });
      }
      return raus;
    });
    pruefe(fluege.every((f) => f.tore >= 11 && f.mittige >= 8 && f.punkte > f.tore && f.gebaut && ["akku", "pfosten"].includes(f.grund)),
      `Zwei Rotoren: Der Pilot kommt nicht durch jeden Parcours – ${JSON.stringify(fluege.map(({ welt, ...rest }) => rest))}`);
    pruefe(fluege.every((f) => f.still && f.hubSpaeter >= 9 && f.hubSpaeter >= 1.7 * f.hubAnfang),
      `Zwei Rotoren: Ein Tor bewegt sich, oder später geht es nicht weiter hinauf und hinunter als am Anfang – ${JSON.stringify(fluege.map((f) => [f.still, f.hubAnfang, f.hubSpaeter]))}`);
    pruefe(new Set(fluege.map((f) => f.welt)).size > 1, `Zwei Rotoren: Der Parcours ist in jeder Runde derselbe – ${JSON.stringify(fluege.map((f) => f.welt.slice(0, 60)))}`);
    await seite.waitForSelector(".cm-result-score", { timeout: 4000 }).catch(() => {});
    const blind = await seite.evaluate(() => {
      const R = window.LernappRotoren;
      const st = R.state;
      const raus = [];
      // Nichts gedrückt (nach dem Start) – und beide gehalten.
      for (const beide of [false, true]) {
        document.querySelector(".cm-bar-left .cm-icon-again").click();
        R.druecken("links");
        R.druecken("rechts");
        if (!beide) R.allesLos();
        for (let n = 0; st.phase === "spiel" && !st.endet && n < 240 * 40; n += 1) R.takt(1 / 240);
        R.allesLos();
        raus.push({ beide, grund: st.grund, zeit: Math.round(st.d.t * 10) / 10, hoch: Math.round(st.d.y) });
      }
      return raus;
    });
    pruefe(blind[0].grund === "dach" && blind[0].zeit < 4 && blind[1].grund === "akku" && blind[1].zeit < 24 && blind[1].hoch > 40,
      `Zwei Rotoren: Ohne Daumen oder mit beiden endet der Flug nicht, wie er soll – ${JSON.stringify(blind)}`);
    await seite.waitForSelector(".cm-result-score", { timeout: 6000 }).catch(() => {});
    pruefe(await seite.locator(".cm-result-score").count() === 1, "Zwei Rotoren: Nach dem leeren Akku kommt kein Ergebnis.");
    // Ein Rotor allein: Die Drohne kippt von ihm weg und zieht zur Seite.
    const seiten = await seite.evaluate(() => {
      const R = window.LernappRotoren;
      const st = R.state;
      const raus = {};
      for (const welche of ["links", "rechts"]) {
        document.querySelector(".cm-bar-left .cm-icon-again").click();
        R.druecken(welche);
        for (let n = 0; n < 240 * 0.7; n += 1) R.takt(1 / 240);
        raus[welche] = { vx: st.d.vx, w: st.d.w, laeuft: R.haelt() };
        R.allesLos();
      }
      return { ...raus, kipp: R.KIPP };
    });
    pruefe(seiten.links.vx > 1.5 && seiten.links.w < -seiten.kipp * 0.8 && seiten.rechts.vx < -1.5 && seiten.rechts.w > seiten.kipp * 0.8,
      `Zwei Rotoren: Ein Rotor allein zieht nicht zur anderen Seite: ${JSON.stringify(seiten)}`);
    await kontext.close();
  }
  {
    // Ein Flug in echter Zeit – mit dem Piloten durch die ersten Tore, dann
    // Daumen weg –, aufgezeichnet und angeschaut: derselbe Parcours,
    // dieselbe Zahl.
    const { kontext, seite } = await neueSeite({ width: 900, height: 600 });
    await seite.addInitScript(() => {
      if (sessionStorage.getItem("__rotor")) return;
      sessionStorage.setItem("__rotor", "1");
      localStorage.setItem("mini.name", "Rotor");
    });
    await seite.goto(`${BASIS}/rotoren`, { waitUntil: "load" });
    await seite.waitForFunction(() => window.LernappRotoren?.state?.welt && window.LernappRotoren.view.cssW > 0, null, { timeout: 8000 });
    const welt = await seite.evaluate(() => window.LernappRotoren.weltText());
    await seite.evaluate(() => new Promise((fertig) => {
      const R = window.LernappRotoren;
      const st = R.state;
      R.druecken("links");
      R.druecken("rechts");
      const lauf = () => {
        if (st.phase !== "spiel" || st.endet) { R.allesLos(); fertig(); return; }
        if (st.d.tor < 4) {
          const [links, rechts] = R.pilot(st.welt, st.d);
          if (links) R.druecken("links"); else R.loslassen("links");
          if (rechts) R.druecken("rechts"); else R.loslassen("rechts");
        } else R.allesLos();
        requestAnimationFrame(lauf);
      };
      requestAnimationFrame(lauf);
    }));
    await seite.waitForSelector(".cm-result-score", { timeout: 60000 }).catch(() => {});
    await seite.waitForFunction(() => [...(window.__miniGeister?.keys?.() || [])].some((k) => k.startsWith("twinRotor_")), null, { timeout: 4000 }).catch(() => {});
    const gespielt = await seite.evaluate(() => {
      const kennung = localStorage.getItem("mini.id");
      const geist = window.__miniGeister?.get(`twinRotor_${kennung}`) || null;
      const st = window.LernappRotoren.state;
      return { kennung, punkte: geist?.punkte || 0, gezaehlt: st.punkte, tore: st.d.tor, grund: st.grund };
    });
    pruefe(gespielt.kennung && gespielt.punkte >= 4 && gespielt.punkte === gespielt.gezaehlt && gespielt.tore >= 4,
      `Zwei Rotoren: Der Flug wird nicht hinterlegt: ${JSON.stringify(gespielt)}`);
    await seite.goto(`${BASIS}/rotoren?zuschauen=${gespielt.kennung}`, { waitUntil: "load" });
    await seite.waitForFunction(() => window.LernappRotoren?.state?.phase === "zuschauen", null, { timeout: 8000 }).catch(() => {});
    const zu = await seite.evaluate(() => ({ phase: window.LernappRotoren.state.phase, welt: window.LernappRotoren.weltText() }));
    pruefe(zu.phase === "zuschauen" && zu.welt === welt, `Zwei Rotoren: Beim Zuschauen steht ein anderer Parcours da:\n  gespielt ${welt}\n  angeschaut ${JSON.stringify(zu)}`);
    await seite.waitForSelector(".gz-tafel:not([hidden]) .gz-nochmal", { timeout: 60000 }).catch(() => {});
    const schluss = await seite.evaluate(() => {
      const st = window.LernappRotoren.state;
      return { punkte: st.punkte, tore: st.d.tor, tafel: Boolean(document.querySelector(".gz-tafel:not([hidden]) .gz-nochmal")) };
    });
    pruefe(schluss.tafel && schluss.punkte === gespielt.punkte && schluss.tore === gespielt.tore,
      `Zwei Rotoren: Am Ende des angeschauten Flugs steht nicht dasselbe: ${JSON.stringify({ ...schluss, gespielt })}`);
    await kontext.close();
  }

  // --- 4g34. Augenmass: zehn Blätter, gemessen auf den Zehntelmillimeter -------------
  // Jede Runde hat zwei leichte, vier mittlere und vier schwere Blätter (mit
  // sechs, sieben und acht Sekunden), jede Art höchstens einmal, alles liegt
  // auf dem Blatt, und die Lösung liegt auf der Bahn des Fadenkreuzes. Jede
  // der 18 Arten lässt sich zeichnen, beantworten und nachmessen; wo zwei
  // Stellen richtig sind, gelten beide. Wer überall genau trifft, hat hundert Punkte;
  // wer drei Millimeter danebenliegt, bekommt, was die Tabelle sagt. Vor jedem
  // Blatt steht die Vorschau – ein Satz und ein Beispiel derselben Art –,
  // und die Uhr läuft erst nach dem Tipp. Ist die Zeit um, zählt das
  // Fadenkreuz – oder nichts. Im Tunnel rollt die Kugel von selbst los, und
  // es zählt der Augenblick des Tipps. Wer den Finger ruhig hält und abhebt,
  // bekommt die Stelle, auf der er geruht hat, nicht die, über die er
  // abgerollt ist.
  {
    const { kontext, seite } = await neueSeite({ width: 900, height: 700 });
    await seite.goto(`${BASIS}/augenmass`, { waitUntil: "load" });
    await seite.waitForFunction(() => window.LernappAugenmass?.state?.blaetter && window.LernappAugenmass.view.cssW > 0, null, { timeout: 8000 });
    const bau = await seite.evaluate(() => {
      const A = window.LernappAugenmass;
      const raus = { runden: 0, falsch: [], arten: new Set(), welten: new Set() };
      for (let n = 0; n < 300; n += 1) {
        const bl = A.aufgabenFuer();
        raus.runden += 1;
        raus.welten.add(A.weltText(bl));
        const arten = bl.map((a) => a.art);
        const [n1, n2] = [A.PLAN[0], A.PLAN[0] + A.PLAN[1]];
        const ok = bl.length === A.BLAETTER && new Set(arten).size === bl.length
          && arten.slice(0, n1).every((a) => A.LEICHT.includes(a)) && arten.slice(n1, n2).every((a) => A.MITTEL.includes(a)) && arten.slice(n2).every((a) => A.SCHWER.includes(a))
          && bl.every((a, i) => a.zeit === A.ZEITEN[i < n1 ? 0 : i < n2 ? 1 : 2]);
        if (!ok) raus.falsch.push(`Reihe ${arten.join(",")}`);
        bl.forEach((a) => {
          raus.arten.add(a.art);
          const aus = Math.max(...a.punkte.map((p) => Math.max(A.RAND - p.x, p.x - (A.BLATT - A.RAND), A.RAND - p.y, p.y - (A.BLATT - A.RAND))));
          if (aus > 1e-6) raus.falsch.push(`${a.art} ragt ${aus.toFixed(2)} mm über den Rand`);
          const auf = A.aufBahn(a, a.ziel);
          if (Math.hypot(auf.x - a.ziel.x, auf.y - a.ziel.y) > 1e-6) raus.falsch.push(`${a.art}: Die Lösung liegt nicht auf der Bahn`);
          if (A.daneben(a, a.ziel) !== 0 || !a.frage || !(a.mass > 0 && a.mass <= 1)) raus.falsch.push(`${a.art}: Ziel, Frage oder Mass fehlen`);
          // Die Vorschau: ein Satz, was zu tun ist, und ein Beispiel derselben Art – eine andere Aufgabe, die auch aufs Blatt passt.
          const b = a.beispiel;
          if (!(A.TUN[a.art]?.length > 20) || !b || b.art !== a.art || b === a) raus.falsch.push(`${a.art}: Satz oder Beispiel fehlen`);
          else if (Math.max(...b.punkte.map((q) => Math.max(A.RAND - q.x, q.x - (A.BLATT - A.RAND), A.RAND - q.y, q.y - (A.BLATT - A.RAND)))) > 1e-6) raus.falsch.push(`${a.art}: Das Beispiel ragt über den Rand`);
          if (a.art === "tunnel" && !(a.sm - a.s1 >= 18 && a.sm <= a.lang - 6 && a.s1 / a.v > 0.6)) raus.falsch.push(`Tunnel: ${a.s1.toFixed(1)}/${a.sm.toFixed(1)}/${a.v.toFixed(1)}`);
          // Das Rad: Das Beispiel ist sichtlich ein anderes – anders gross, und seine Stelle
          // liegt nirgends dort, wo die des Blattes liegt (auch nicht im Kasten der Vorschau).
          if (a.art === "rad" && b?.rad) {
            if (Math.max(a.rad.r / b.rad.r, b.rad.r / a.rad.r) < 1.3) raus.falsch.push(`Rad: Das Beispiel ist so gross wie das Rad des Blattes (${a.rad.r.toFixed(1)}/${b.rad.r.toFixed(1)})`);
            const orte = [b.ziel, ...[A.BEISPIEL_KASTEN.hoch, A.BEISPIEL_KASTEN.flach].map((k) => ({ x: A.BLATT * (0.5 - k / 2) + b.ziel.x * k, y: A.BLATT * A.BEISPIEL_KASTEN.oben + b.ziel.y * k }))];
            if (orte.some((o) => Math.hypot(o.x - a.ziel.x, o.y - a.ziel.y) < A.BEISPIEL_FERN - 1e-9)) raus.falsch.push("Rad: Die Stelle des Beispiels liegt dort, wo die des Blattes liegt");
          }
        });
      }
      const tabelle = [0, 0.3, 0.6, 0.61, 1.1, 1.7, 2.4, 3.2, 4.2, 5.5, 7.2, 9.5, 12.5, 12.6, 40].map((mm) => A.punkteFuer(mm));
      // Das Rad, sechshundertmal gewürfelt: mal klein, mal gross, und die
      // Stelle liegt mal vorn, mal hinten auf dem Boden – nie immer gleich.
      const rad = { r: [Infinity, 0], teil: [Infinity, 0], x: [Infinity, 0], zehntel: new Array(10).fill(0), aus: 0 };
      for (let i = 0; i < 600; i += 1) {
        const a = A.BAU.rad();
        const lang = Math.hypot(a.bahn.b.x - a.bahn.a.x, a.bahn.b.y - a.bahn.a.y);
        const teil = Math.hypot(a.ziel.x - a.bahn.a.x, a.ziel.y - a.bahn.a.y) / lang;
        rad.r = [Math.min(rad.r[0], a.rad.r), Math.max(rad.r[1], a.rad.r)];
        rad.teil = [Math.min(rad.teil[0], teil), Math.max(rad.teil[1], teil)];
        rad.x = [Math.min(rad.x[0], a.ziel.x), Math.max(rad.x[1], a.ziel.x)];
        rad.zehntel[Math.min(9, Math.floor(teil * 10))] += 1;
        if (a.punkte.some((q) => q.x < A.RAND - 1e-6 || q.x > A.BLATT - A.RAND + 1e-6 || q.y < A.RAND - 1e-6 || q.y > A.BLATT - A.RAND + 1e-6)) rad.aus += 1;
      }
      rad.dichtestes = Math.max(...rad.zehntel) / 600;
      return { runden: raus.runden, falsch: raus.falsch.slice(0, 6), arten: raus.arten.size, welten: raus.welten.size, tabelle, nachsicht: A.punkteFuer(1, 0.6), rad };
    });
    pruefe(bau.falsch.length === 0 && bau.arten === 18 && bau.welten === bau.runden,
      `Augenmass: Die Blätter sind nicht, wie sie sein sollen – ${JSON.stringify(bau)}`);
    pruefe(bau.rad.r[0] < 3.8 && bau.rad.r[1] > 7.8 && bau.rad.teil[0] < 0.4 && bau.rad.teil[1] > 0.82 && bau.rad.dichtestes < 0.4 && bau.rad.x[0] < 30 && bau.rad.x[1] > 70 && bau.rad.aus === 0,
      `Augenmass: Das Rad ist nicht jedes Mal anders – Grösse, Stelle auf dem Boden oder Lage streuen zu wenig: ${JSON.stringify(bau.rad)}`);
    pruefe(JSON.stringify(bau.tabelle) === JSON.stringify([10, 10, 10, 9, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0, 0]) && bau.nachsicht === 10,
      `Augenmass: Die Punkte fallen nicht nach der Tabelle: ${JSON.stringify(bau.tabelle)} / ${bau.nachsicht}`);

    // Zwei ganze Runden über die Handgriffe: genau – und überall drei
    // Millimeter daneben.
    const runden = await seite.evaluate(() => {
      const A = window.LernappAugenmass;
      const st = A.state;
      const raus = [];
      for (const neben of [0, 3]) {
        document.querySelector(".cm-bar-left .cm-icon-again").click();
        const vorher = st.phase;
        A.losGehts();
        let soll = 0;
        for (let i = 0; i < A.BLAETTER; i += 1) {
          A.blattLos();
          const a = A.blatt();
          // Daneben, aber auf der Bahn: von der Lösung aus in die Richtung, in der Platz ist.
          let ort = a.ziel;
          if (neben) {
            for (let w = 0; w < 6.3; w += 0.05) {
              const q = A.aufBahn(a, { x: a.ziel.x + Math.cos(w) * neben, y: a.ziel.y + Math.sin(w) * neben });
              if (Math.abs(A.daneben(a, q) - neben) < 0.06) { ort = q; break; }
            }
          }
          // Gerechnet wird wie im Spiel: mit der Stelle auf ein Tausendstel
          // Millimeter – drei Millimeter liegen bei manchem Blatt genau auf
          // einer Punktgrenze.
          const rund = (wert) => Math.round(wert * 1000) / 1000;
          soll += A.punkteFuer(A.daneben(a, { x: rund(ort.x), y: rund(ort.y) }), a.mass);
          A.antworte(ort);
          A.weiter();
        }
        raus.push({ neben, vorher, punkte: st.punkte, soll, phase: st.phase, liste: st.liste.map((e) => e.punkte) });
      }
      return raus;
    });
    pruefe(runden[0].vorher === "bereit" && runden[0].punkte === 100 && runden[0].phase === "ende" && runden[0].liste.every((p) => p === 10),
      `Augenmass: Zehn genaue Antworten geben nicht hundert Punkte: ${JSON.stringify(runden[0])}`);
    pruefe(runden[1].punkte === runden[1].soll && runden[1].punkte >= 50 && runden[1].punkte <= 80 && runden[1].liste.every((p) => p >= 5 && p <= 8),
      `Augenmass: Drei Millimeter daneben geben nicht, was die Tabelle sagt: ${JSON.stringify(runden[1])}`);
    await seite.waitForSelector(".cm-result-score", { timeout: 4000 }).catch(() => {});
    pruefe(await seite.locator(".cm-result-score").count() === 1, "Augenmass: Nach dem zehnten Blatt kommt kein Ergebnis.");

    // Jede Art für sich: die Vorschau mit dem Beispiel, dann aufs Blatt legen,
    // das Fadenkreuz setzen, antworten, nachmessen – und nichts davon wirft
    // einen Fehler. Beim gleichseitigen
    // Dreieck gilt auch die Ecke auf der anderen Seite.
    const jede = await seite.evaluate(() => {
      const A = window.LernappAugenmass;
      const st = A.state;
      const raus = { arten: 0, falsch: [], auch: null };
      const lege = (art) => {
        document.querySelector(".cm-bar-left .cm-icon-again").click();
        A.losGehts();
        st.blaetter[0] = { ...A.BAU[art](), nr: 0, zeit: 8, beispiel: A.BAU[art]() };
        // Die Vorschau mit ihrem Beispiel: am Anfang, mitten in der Lösung und an ihrem Ende.
        for (const frueher of [0, 1200, 2600, 3700]) { st.vorSeit = performance.now() - frueher; A.zeichnen(); }
        A.blattLos();
        return A.blatt();
      };
      for (const art of [...A.LEICHT, ...A.MITTEL, ...A.SCHWER]) {
        try {
          const a = lege(art);
          raus.arten += 1;
          A.zeichnen();
          if (art !== "tunnel") { A.setzeZeiger({ x: a.ziel.x + 2, y: a.ziel.y + 1 }); A.zeichnen(); }
          A.antworte(a.ziel);
          for (const frueher of [100, 500, 1500]) { st.tZeig = performance.now() - frueher; A.zeichnen(); }
          if (st.wertung?.punkte !== 10) raus.falsch.push(`${art}: ${st.wertung?.punkte} Punkte für die Lösung`);
        } catch (fehler) {
          raus.falsch.push(`${art}: ${fehler.message}`);
        }
      }
      const a = lege("dreieck");
      const andere = { ...a.auch.ziel };
      A.antworte(andere);
      raus.auch = { punkte: st.wertung.punkte, mm: st.wertung.mm, gewechselt: Math.hypot(a.ziel.x - andere.x, a.ziel.y - andere.y) < 1e-9 };
      return raus;
    });
    pruefe(jede.arten === 18 && jede.falsch.length === 0, `Augenmass: Nicht jede Art lässt sich zeichnen und beantworten – ${JSON.stringify(jede.falsch)}`);
    pruefe(jede.auch?.punkte === 10 && jede.auch.mm < 0.002 && jede.auch.gewechselt, `Augenmass: Die dritte Ecke auf der anderen Seite gilt nicht: ${JSON.stringify(jede.auch)}`);

    // Die Vorschau: Die Uhr steht, ein Tipp gleich nach dem Umblättern zählt
    // noch nicht, der nächste legt das Blatt hin – und wer nie tippt, bekommt
    // es nach VORSCHAU Sekunden.
    // Die Uhr: Wer das Fadenkreuz nie bewegt, bekommt nichts; sonst zählt seine Stelle.
    // Der Finger: irgendwo ziehen, loslassen, nachgreifen – die Antwort ist
    // erst der Knopf. Ein zweiter Finger stört nicht.
    const uhr = await seite.evaluate(async () => {
      const A = window.LernappAugenmass;
      const st = A.state;
      const bild = () => new Promise((fertig) => requestAnimationFrame(() => requestAnimationFrame(fertig)));
      const warte = (ms) => new Promise((fertig) => setTimeout(fertig, ms));
      // Die Leinwand – jede neue Runde baut eine neue.
      const flaeche = () => document.querySelector("#am-stage canvas");
      const zeiger = (art, x, y, id = 1, womit = "touch", ziel = flaeche()) => ziel.dispatchEvent(new PointerEvent(art, { bubbles: true, cancelable: true, pointerId: id, isPrimary: id === 1, pointerType: womit, clientX: x, clientY: y }));
      // Der Finger greift irgendwo – hier unten rechts auf dem Blatt –, zieht
      // erst über den Schlupf und dann so weit, dass das Fadenkreuz auf die
      // gewünschte Stelle kommt.
      let finger = null;
      const greif = (wx = 0.8, wy = 0.9) => {
        const r = flaeche().getBoundingClientRect();
        finger = { x: r.left + A.view.x0 + A.view.seite * wx, y: r.top + A.view.y0 + A.view.seite * wy };
        zeiger("pointerdown", finger.x, finger.y);
        finger.x += A.SCHLUPF + 1;
        zeiger("pointermove", finger.x, finger.y);
      };
      // Auf einer Sehne quer über einen Bogen klebt das Fadenkreuz ein wenig
      // an ihm – darum in ein paar Schritten, bis es dort ist.
      const zieh = (nach) => {
        for (let schritt = 0; schritt < 8; schritt += 1) {
          const z = st.zeiger;
          if (Math.hypot(nach.x - z.x, nach.y - z.y) < 1e-9) break;
          finger = { x: finger.x + (nach.x - z.x) * A.view.s, y: finger.y + (nach.y - z.y) * A.view.s };
          zeiger("pointermove", finger.x, finger.y);
        }
      };
      const lass = () => zeiger("pointerup", finger.x, finger.y);
      // Der Knopf «Bestätigen», mit einem eigenen Finger gedrückt.
      const knopfMitte = () => { const r = A.knopf().getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; };
      const bestaetige = () => { const m = knopfMitte(); zeiger("pointerdown", m.x, m.y, 3, "touch", A.knopf()); zeiger("pointerup", m.x, m.y, 3, "touch", A.knopf()); };
      // Die Maus zeigt selbst auf die Stelle.
      const maus = (art, ort) => { const b = A.imBild(ort); zeiger(art, b.x, b.y, 1, "mouse"); };
      // Eine Stelle so viele Millimeter neben der Lösung – auf der Bahn, wenn das Blatt eine hat.
      const neben = (a, mm) => {
        for (let w = 0; w < 6.3; w += 0.05) {
          const q = A.aufBahn(a, { x: a.ziel.x + Math.cos(w) * mm, y: a.ziel.y + Math.sin(w) * mm });
          if (Math.abs(A.daneben(a, q) - mm) < 0.06) return q;
        }
        return a.ziel;
      };
      const raus = {};
      // Eine Runde, deren erste zwei Blätter kein Tunnel sind (das sind sie nie: der Tunnel ist schwer).
      document.querySelector(".cm-bar-left .cm-icon-again").click();
      A.losGehts();
      await bild();
      const tipp = () => { const b = A.imBild({ x: 50, y: 50 }); zeiger("pointerdown", b.x, b.y); zeiger("pointerup", b.x, b.y); };
      raus.vor = { phase: st.phase };
      // Gleich nach dem Umblättern gilt der Tipp noch dem letzten Blatt.
      tipp();
      raus.vor.gleich = st.phase;
      // Zwanzig Sekunden später steht die Vorschau immer noch da.
      st.vorSeit -= 20000;
      await bild();
      raus.vor.wartet = st.phase;
      // Der Tipp legt das Blatt hin, und seine Uhr beginnt jetzt. Mit dem
      // Finger liegt das Fadenkreuz schon da: am Anfang, wo es nichts verrät.
      tipp();
      raus.vor.los = { phase: st.phase, seit: A.seit() };
      const anfang = A.startOrt(A.blatt());
      raus.start = { da: Boolean(st.zeiger), weg: st.zeiger ? Math.hypot(st.zeiger.x - anfang.x, st.zeiger.y - anfang.y) : -1, gesetzt: st.gesetzt };
      // Gleich danach gilt noch nichts: kein Ziehen, kein Knopf.
      raus.sperre = (() => {
        const vor = { ...st.zeiger };
        greif();
        zieh(A.blatt().ziel);
        lass();
        bestaetige();
        return { weg: Math.hypot(st.zeiger.x - vor.x, st.zeiger.y - vor.y), gesetzt: st.gesetzt, phase: st.phase };
      })();
      // Niemand bewegt das Fadenkreuz: Es liegt zwar da, aber es zählt nicht.
      st.t0 -= (A.ZEIT + A.EINZUG) * 1000 + 50;
      await bild();
      raus.ohne = { phase: st.phase, antwort: st.antwort, punkte: st.wertung?.punkte, gesamt: st.punkte };
      A.weiter();
      // Wer die Vorschau nie beendet, bekommt das Blatt von selbst.
      st.vorSeit -= A.VORSCHAU * 1000 - 400;
      await bild();
      raus.vor.fast = st.phase;
      st.vorSeit -= 500;
      await bild();
      raus.vor.selbst = st.phase;
      const a = A.blatt();
      st.t0 -= 1000;
      greif();
      zieh(A.aufBahn(a, { x: a.ziel.x + 9, y: a.ziel.y + 6 }));
      raus.gesetzt = st.gesetzt && Boolean(st.griff);
      // Ein zweiter Finger nimmt dem ersten das Fadenkreuz nicht weg.
      zeiger("pointerdown", finger.x - 120, finger.y - 150, 2);
      zeiger("pointermove", finger.x - 60, finger.y - 150, 2);
      zieh(a.ziel);
      raus.geschoben = A.daneben(a, st.zeiger);
      st.t0 -= (A.ZEIT + A.EINZUG) * 1000;
      await bild();
      raus.mit = { phase: st.phase, punkte: st.wertung?.punkte, mm: st.wertung?.mm };
      lass();
      raus.danach = st.punkte;
      A.weiter();
      A.blattLos();
      // Loslassen ist keine Antwort: Man greift nach, so oft man will – erst
      // der Knopf setzt das Fadenkreuz.
      const b = A.blatt();
      st.t0 -= 1000;
      greif();
      zieh(neben(b, 5));
      lass();
      const nachEins = { phase: st.phase, mm: A.daneben(b, st.zeiger) };
      greif(0.3, 0.2);
      zieh(b.ziel);
      lass();
      raus.nachgreifen = { eins: nachEins, zwei: { phase: st.phase, mm: A.daneben(b, st.zeiger) } };
      bestaetige();
      raus.finger = { phase: st.phase, punkte: st.wertung?.punkte, mm: st.wertung?.mm };
      A.weiter();
      // Die Vorschau endet auch mit der Leertaste.
      st.vorSeit -= 1000;
      document.dispatchEvent(new KeyboardEvent("keydown", { key: " ", bubbles: true }));
      raus.vor.taste = st.phase;
      // Die Tasten: Pfeile schieben um einen Viertelmillimeter, Enter antwortet.
      const c = A.blatt();
      st.t0 -= 1000;
      A.setzeZeiger(c.ziel);
      const vor = { ...st.zeiger };
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true }));
      raus.pfeile = Math.hypot(st.zeiger.x - vor.x, st.zeiger.y - vor.y);
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
      raus.taste = { phase: st.phase, punkte: st.wertung?.punkte };
      A.weiter();
      A.blattLos();
      // Das Abheben: Der Finger ruht, und beim Loslassen rollt die Kuppe
      // einen halben Millimeter ab – das Fadenkreuz bleibt, wo es geruht hat.
      // Wer dagegen noch schiebt, behält die letzte Stelle.
      const d = A.blatt();
      st.t0 -= 1000;
      greif();
      zieh(d.ziel);
      await warte(120);
      const gerollt = neben(d, 0.5);
      zieh(gerollt);
      const beimRollen = A.daneben(d, st.zeiger);
      lass();
      raus.abheben = { gerollt: beimRollen, ruht: A.daneben(d, st.zeiger), phase: st.phase };
      bestaetige();
      raus.abheben.mm = st.wertung?.mm;
      A.weiter();
      A.blattLos();
      const e = A.blatt();
      st.t0 -= 1000;
      greif();
      zieh(neben(e, 6));
      await warte(120);
      const weit = neben(e, 3);
      zieh(weit);
      lass();
      bestaetige();
      raus.schieben = { mm: st.wertung?.mm, soll: A.daneben(e, weit) };
      A.weiter();
      // Ab hier kämen die schweren Blätter, vielleicht der Tunnel: Für den
      // Finger und die Maus liegen bestimmte da.
      const lege = (art) => { st.blaetter[st.index] = { ...A.BAU[art](), nr: st.index, zeit: A.ZEIT, beispiel: A.BAU[art]() }; A.blattLos(); };
      lege("kreis");
      // Das Tastfeld: Wo der Finger aufsetzt, ist gleich – das Fadenkreuz
      // geht den Weg mit, den er zieht, Bildpunkt für Bildpunkt.
      st.t0 -= 1000;
      await bild();
      const kante = flaeche().getBoundingClientRect();
      const mitte = { ...st.zeiger };
      raus.feld = { mitte, knopf: A.knopfDa(), blass: !A.knopf().classList.contains("ist-bereit") };
      // Solange das Fadenkreuz nicht bewegt wurde, gibt es nichts zu bestätigen.
      bestaetige();
      raus.feld.zuFrueh = { phase: st.phase, wink: st.wink > 0, gedrueckt: A.knopf().classList.contains("ist-gedrueckt") };
      // Ein Tipp verrückt nichts und sagt, was gemeint ist.
      tipp();
      raus.feld.tipp = { weg: Math.hypot(st.zeiger.x - mitte.x, st.zeiger.y - mitte.y), wink: st.wink > 0, gesetzt: st.gesetzt, phase: st.phase };
      // Unter dem Blatt aufgesetzt, weit weg vom Fadenkreuz: weniger als der Schlupf tut nichts …
      const fx = kante.left + A.view.x0 + A.view.seite * 0.15;
      const fy = kante.top + A.view.y0 + A.view.seite + 30;
      zeiger("pointerdown", fx, fy);
      zeiger("pointermove", fx + A.SCHLUPF - 1.5, fy);
      raus.feld.schlupf = Math.hypot(st.zeiger.x - mitte.x, st.zeiger.y - mitte.y);
      // … danach zählt jeder Bildpunkt.
      zeiger("pointermove", fx + A.SCHLUPF + 1, fy);
      zeiger("pointermove", fx + A.SCHLUPF + 1 + 43, fy - 27);
      raus.feld.gezogen = { dx: (st.zeiger.x - mitte.x) * A.view.s, dy: (st.zeiger.y - mitte.y) * A.view.s, wink: st.wink > 0 };
      await bild();
      raus.feld.bereit = A.knopf().classList.contains("ist-bereit");
      zeiger("pointerup", fx + A.SCHLUPF + 1 + 43, fy - 27);
      // Nachgreifen an ganz anderer Stelle: Das Fadenkreuz springt nicht, es geht von dort weiter, wo es liegt.
      const gx = kante.left + A.view.x0 + A.view.seite * 0.9;
      const gy = kante.top + A.view.y0 + A.view.seite * 0.1;
      zeiger("pointerdown", gx, gy);
      raus.feld.sprung = Math.hypot((st.zeiger.x - mitte.x) * A.view.s - 43, (st.zeiger.y - mitte.y) * A.view.s + 27);
      zeiger("pointermove", gx, gy + A.SCHLUPF + 1);
      zeiger("pointermove", gx - 43, gy + A.SCHLUPF + 1 + 27);
      raus.feld.zurueck = Math.hypot(st.zeiger.x - mitte.x, st.zeiger.y - mitte.y);
      // Am Rand des Blattes bleibt es stehen – und kommt sofort zurück.
      zeiger("pointermove", gx - 43 + 3000, gy + A.SCHLUPF + 1 + 27);
      const amRand = { ...st.zeiger };
      zeiger("pointermove", gx - 43 + 3000 - 20, gy + A.SCHLUPF + 1 + 27);
      raus.feld.rand = { x: amRand.x, y: amRand.y - mitte.y, zurueck: (amRand.x - st.zeiger.x) * A.view.s };
      zeiger("pointerup", gx - 43 + 3000 - 20, gy + A.SCHLUPF + 1 + 27);
      raus.feld.phase = st.phase;
      // Der Knopf gilt beim Loslassen – wer den Finger wegzieht, hat nichts bestätigt.
      const km = knopfMitte();
      zeiger("pointerdown", km.x, km.y, 3, "touch", A.knopf());
      const gedrueckt = A.knopf().classList.contains("ist-gedrueckt");
      zeiger("pointerup", km.x, km.y - 200, 3, "touch", A.knopf());
      raus.feld.weggezogen = { gedrueckt, phase: st.phase };
      // Und er gilt auch, während ein Finger das Fadenkreuz noch hält.
      greif();
      zieh(A.blatt().ziel);
      bestaetige();
      raus.feld.gesetzt = { phase: st.phase, punkte: st.wertung?.punkte, griff: st.griff };
      lass();
      A.weiter();
      lege("bande");
      // Frei, und doch haftend: An einer Bande liegt das Fadenkreuz am Anfang
      // auf ihr. Wer schräg an ihr entlangzieht, bleibt darauf; wer quer
      // wegzieht, löst es nach HAFT Millimetern, und von da an ist es frei.
      // Zurück an der Bande, klebt es wieder.
      st.t0 -= 1000;
      await bild();
      const frBlatt = A.blatt();
      const frWeit = 2 * A.HAFT;
      const frAb = (q) => Math.hypot(q.x - A.aufBahn(frBlatt, q).x, q.y - A.aufBahn(frBlatt, q).y);
      const frLang = Math.hypot(frBlatt.bahn.b.x - frBlatt.bahn.a.x, frBlatt.bahn.b.y - frBlatt.bahn.a.y);
      const frE = { x: (frBlatt.bahn.b.x - frBlatt.bahn.a.x) / frLang, y: (frBlatt.bahn.b.y - frBlatt.bahn.a.y) / frLang };
      // Quer zur Bande, zur Seite mit mehr Blatt.
      const frMitte = { x: (frBlatt.bahn.a.x + frBlatt.bahn.b.x) / 2, y: (frBlatt.bahn.a.y + frBlatt.bahn.b.y) / 2 };
      const frSeite = (50 - frMitte.x) * -frE.y + (50 - frMitte.y) * frE.x > 0 ? 1 : -1;
      const frN = { x: -frE.y * frSeite, y: frE.x * frSeite };
      const um = (dx, dy, schritte = 10) => { for (let i = 0; i < schritte; i += 1) { finger = { x: finger.x + (dx * A.view.s) / schritte, y: finger.y + (dy * A.view.s) / schritte }; zeiger("pointermove", finger.x, finger.y); } };
      raus.haft = { start: frAb(st.zeiger), ein: A.eingerastet(frBlatt, st.zeiger) };
      greif();
      const frVor = { ...st.zeiger };
      const frWeg = Math.min(14, frLang * 0.5);
      const frSchraeg = (22 * Math.PI) / 180;
      um((frE.x * Math.cos(frSchraeg) + frN.x * Math.sin(frSchraeg)) * frWeg, (frE.y * Math.cos(frSchraeg) + frN.y * Math.sin(frSchraeg)) * frWeg);
      raus.haft.entlang = { ab: frAb(st.zeiger), weg: Math.hypot(st.zeiger.x - frVor.x, st.zeiger.y - frVor.y), soll: frWeg * Math.cos(frSchraeg) };
      um(frN.x * (A.HAFT - 0.5), frN.y * (A.HAFT - 0.5));
      raus.haft.klebt = frAb(st.zeiger);
      um(frN.x * (0.5 + frWeit), frN.y * (0.5 + frWeit));
      raus.haft.frei = { ab: frAb(st.zeiger), ein: A.eingerastet(frBlatt, st.zeiger) };
      // Frei geht es jeden Bildpunkt mit, auch längs.
      const frFreiVor = { ...st.zeiger };
      um(frE.x * -3 + frN.x * 2, frE.y * -3 + frN.y * 2);
      raus.haft.freiWeg = Math.hypot(st.zeiger.x - frFreiVor.x - (frE.x * -3 + frN.x * 2), st.zeiger.y - frFreiVor.y - (frE.y * -3 + frN.y * 2));
      // Wieder hin: Es kommt an, ohne zu springen, und bleibt dann kleben.
      const frHin = frAb(st.zeiger);
      let frSprung = 0;
      let frDavor = frHin;
      for (let i = 0; i < 40; i += 1) { um(-frN.x * (frHin + 2) / 40, -frN.y * (frHin + 2) / 40, 1); frSprung = Math.max(frSprung, Math.abs(frDavor - frAb(st.zeiger))); frDavor = frAb(st.zeiger); }
      raus.haft.wieder = { ab: frAb(st.zeiger), sprung: frSprung, schritt: (frHin + 2) / 40 };
      // Neben der Bande bestätigt: Es zählt, wie frWeg die Stelle von der Lösung weg ist.
      // (Die freie Stelle liegt jetzt irgendwo in der Haftzone – von dort aus gerechnet.)
      const frTief = (st.frei.x - A.aufBahn(frBlatt, st.frei).x) * frN.x + (st.frei.y - A.aufBahn(frBlatt, st.frei).y) * frN.y;
      um(frN.x * (A.HAFT + frWeit - frTief), frN.y * (A.HAFT + frWeit - frTief));
      const frStelle = { ...st.zeiger };
      lass();
      bestaetige();
      raus.haft.daneben = { phase: st.phase, ab: frAb(frStelle), mm: st.wertung?.mm, soll: Math.hypot(frStelle.x - frBlatt.ziel.x, frStelle.y - frBlatt.ziel.y), punkte: st.wertung?.punkte };
      A.weiter();
      lege("eck");
      // Die Maus zeigt genau dorthin, wo sie steht – und ihr Klick ist die Antwort.
      const m = A.blatt();
      st.t0 -= 1000;
      maus("pointerdown", m.ziel);
      raus.maus = { finger: st.griff?.finger, mm: A.daneben(m, st.zeiger) };
      maus("pointerup", m.ziel);
      raus.maus.phase = st.phase;
      raus.maus.punkte = st.wertung?.punkte;
      A.weiter();
      lege("lot");
      // Wer mit der Maus spielt, hat kein Fadenkreuz, bevor sie sich bewegt,
      // und keinen Knopf: Sie schwebt mit. An einer Linie haftet auch sie –
      // nah daran liegt das Fadenkreuz auf ihr, weiter weg steht es um HAFT
      // näher an ihr als die Maus.
      const l = A.blatt();
      st.t0 -= 1000;
      await bild();
      raus.maus.leer = { zeiger: st.zeiger, knopf: A.knopfDa(), ort: A.view.knopfOrt };
      const ll = Math.hypot(l.bahn.b.x - l.bahn.a.x, l.bahn.b.y - l.bahn.a.y);
      const ln = { x: -(l.bahn.b.y - l.bahn.a.y) / ll, y: (l.bahn.b.x - l.bahn.a.x) / ll };
      const lm = { x: (l.bahn.a.x + l.bahn.b.x) / 2, y: (l.bahn.a.y + l.bahn.b.y) / 2 };
      const lb = (q) => (q ? Math.hypot(q.x - A.aufBahn(l, q).x, q.y - A.aufBahn(l, q).y) : -1);
      maus("pointermove", { x: lm.x + ln.x * (A.HAFT - 1), y: lm.y + ln.y * (A.HAFT - 1) });
      const nah = lb(st.zeiger);
      maus("pointermove", { x: lm.x + ln.x * (A.HAFT + 4), y: lm.y + ln.y * (A.HAFT + 4) });
      raus.maus.haft = { nah, fern: lb(st.zeiger) };
      return raus;
    });
    pruefe(uhr.vor.phase === "vorschau" && uhr.vor.gleich === "vorschau" && uhr.vor.wartet === "vorschau" && uhr.vor.los.phase === "aufgabe" && uhr.vor.los.seit < 0.2,
      `Augenmass: Die Vorschau wartet nicht auf den Tipp, oder die Uhr des Blattes läuft schon vorher: ${JSON.stringify(uhr.vor)}`);
    pruefe(uhr.vor.fast === "vorschau" && uhr.vor.selbst === "aufgabe" && uhr.vor.taste === "aufgabe",
      `Augenmass: Die Vorschau endet nicht von selbst nach ihrer Zeit, oder nicht mit der Leertaste: ${JSON.stringify(uhr.vor)}`);
    pruefe(uhr.start.da && uhr.start.weg < 1e-9 && uhr.start.gesetzt === false,
      `Augenmass: Mit dem Finger liegt das Fadenkreuz nicht von Anfang an da: ${JSON.stringify(uhr.start)}`);
    pruefe(uhr.sperre.weg < 1e-9 && uhr.sperre.gesetzt === false && uhr.sperre.phase === "aufgabe", `Augenmass: Ziehen oder Bestätigen gleich nach dem Umblättern zählt schon: ${JSON.stringify(uhr.sperre)}`);
    pruefe(uhr.ohne.phase === "zeigen" && uhr.ohne.antwort === null && uhr.ohne.punkte === 0 && uhr.ohne.gesamt === 0,
      `Augenmass: Wer das Fadenkreuz nie bewegt, bekommt am Ende der Zeit trotzdem etwas: ${JSON.stringify(uhr.ohne)}`);
    pruefe(uhr.gesetzt && uhr.geschoben < 0.01 && uhr.mit.phase === "zeigen" && uhr.mit.punkte === 10 && uhr.danach === 10,
      `Augenmass: Ist die Zeit um, zählt das Fadenkreuz nicht, wo es steht – oder ein zweiter Finger hat es verrückt: ${JSON.stringify(uhr)}`);
    pruefe(uhr.nachgreifen.eins.phase === "aufgabe" && uhr.nachgreifen.eins.mm > 3 && uhr.nachgreifen.zwei.phase === "aufgabe" && uhr.nachgreifen.zwei.mm < 0.01,
      `Augenmass: Loslassen ist schon die Antwort, oder Nachgreifen geht nicht: ${JSON.stringify(uhr.nachgreifen)}`);
    pruefe(uhr.finger.phase === "zeigen" && uhr.finger.punkte === 10 && uhr.finger.mm < 0.01, `Augenmass: Der Knopf «Bestätigen» ist nicht die Antwort: ${JSON.stringify(uhr.finger)}`);
    pruefe(uhr.pfeile < 1e-9 && uhr.taste.phase === "zeigen" && uhr.taste.punkte === 10, `Augenmass: Pfeile und Enter tun nicht, was sie sollen: ${JSON.stringify(uhr)}`);
    pruefe(uhr.abheben.gerollt > 0.4 && uhr.abheben.ruht < 0.01 && uhr.abheben.phase === "aufgabe" && uhr.abheben.mm < 0.05 && Math.abs(uhr.schieben.mm - uhr.schieben.soll) < 0.05 && uhr.schieben.soll > 2.5,
      `Augenmass: Beim Abheben bleibt das Fadenkreuz nicht, wo der Finger geruht hat: ${JSON.stringify({ abheben: uhr.abheben, schieben: uhr.schieben })}`);
    pruefe(uhr.feld.knopf && Math.abs(uhr.feld.mitte.x - 50) < 1e-9 && Math.abs(uhr.feld.mitte.y - 50) < 1e-9
      && uhr.feld.tipp.weg < 1e-9 && uhr.feld.tipp.wink && uhr.feld.tipp.gesetzt === false && uhr.feld.tipp.phase === "aufgabe" && uhr.feld.schlupf < 1e-9,
      `Augenmass: Ein blosser Tipp verrückt das Fadenkreuz, oder es liegt nicht mitten auf dem Blatt: ${JSON.stringify(uhr.feld)}`);
    pruefe(Math.abs(uhr.feld.gezogen.dx - 43) < 0.01 && Math.abs(uhr.feld.gezogen.dy + 27) < 0.01 && uhr.feld.gezogen.wink === false && uhr.feld.sprung < 0.01 && uhr.feld.zurueck < 0.01 && uhr.feld.phase === "aufgabe",
      `Augenmass: Das Fadenkreuz geht nicht den Weg des Fingers mit, oder es springt beim Nachgreifen: ${JSON.stringify(uhr.feld)}`);
    pruefe(uhr.feld.rand.x === 100 && Math.abs(uhr.feld.rand.y) < 0.01 && Math.abs(uhr.feld.rand.zurueck - 20) < 0.01,
      `Augenmass: Am Rand des Blattes bleibt das Fadenkreuz nicht stehen, oder es kommt nicht sofort zurück: ${JSON.stringify(uhr.feld.rand)}`);
    pruefe(uhr.feld.weggezogen.gedrueckt && uhr.feld.weggezogen.phase === "aufgabe" && uhr.feld.gesetzt.phase === "zeigen" && uhr.feld.gesetzt.punkte === 10 && uhr.feld.gesetzt.griff === null,
      `Augenmass: Der Knopf gilt nicht beim Loslassen auf ihm, oder nicht, während ein Finger das Fadenkreuz hält: ${JSON.stringify(uhr.feld)}`);
    pruefe(uhr.feld.blass && uhr.feld.zuFrueh.phase === "aufgabe" && uhr.feld.zuFrueh.wink && uhr.feld.zuFrueh.gedrueckt === false && uhr.feld.bereit,
      `Augenmass: Der Knopf gilt schon, bevor das Fadenkreuz bewegt wurde – oder er wird danach nicht bereit: ${JSON.stringify(uhr.feld)}`);
    pruefe(uhr.haft.start < 1e-9 && uhr.haft.ein && uhr.haft.entlang.ab < 1e-9 && Math.abs(uhr.haft.entlang.weg - uhr.haft.entlang.soll) < 0.01 && uhr.haft.klebt < 1e-9,
      `Augenmass: An der Bande bleibt das Fadenkreuz nicht kleben, wenn man an ihr entlangzieht: ${JSON.stringify(uhr.haft)}`);
    pruefe(Math.abs(uhr.haft.frei.ab - 6) < 0.01 && uhr.haft.frei.ein === false && uhr.haft.freiWeg < 0.01
      && uhr.haft.wieder.ab < 1e-9 && uhr.haft.wieder.sprung <= uhr.haft.wieder.schritt + 1e-6,
      `Augenmass: Von der Bande weggezogen, ist das Fadenkreuz nicht frei – oder es springt, wenn es wieder ankommt: ${JSON.stringify(uhr.haft)}`);
    pruefe(uhr.haft.daneben.phase === "zeigen" && Math.abs(uhr.haft.daneben.ab - 6) < 0.01 && Math.abs(uhr.haft.daneben.mm - uhr.haft.daneben.soll) < 0.01 && uhr.haft.daneben.mm >= 5.9 && uhr.haft.daneben.punkte <= 6,
      `Augenmass: Eine Antwort neben der Bande wird nicht nach ihrem Abstand gemessen: ${JSON.stringify(uhr.haft.daneben)}`);
    pruefe(uhr.maus.haft.nah < 1e-9 && Math.abs(uhr.maus.haft.fern - 4) < 0.01,
      `Augenmass: Mit der Maus haftet das Fadenkreuz nicht an der Linie, oder es ist daneben nicht frei: ${JSON.stringify(uhr.maus.haft)}`);
    pruefe(uhr.maus.finger === false && uhr.maus.mm < 0.3 && uhr.maus.phase === "zeigen" && uhr.maus.punkte === 10
      && uhr.maus.leer.zeiger === null && uhr.maus.leer.knopf === false && uhr.maus.leer.ort === "",
      `Augenmass: Die Maus zeigt nicht genau dorthin, wo sie steht, ihr Klick ist nicht die Antwort – oder sie hat einen Knopf: ${JSON.stringify(uhr.maus)}`);

    // Der Tunnel: Die Kugel rollt von selbst los, kurz nachdem das Blatt
    // daliegt. Ein Tipp davor oder solange sie zu sehen ist, gilt nicht; im
    // richtigen Augenblick gibt er zehn. Wer gar nicht tippt, bekommt am Ende
    // der Schiene nichts.
    const tunnel = await seite.evaluate(async () => {
      const A = window.LernappAugenmass;
      const st = A.state;
      const bild = () => new Promise((fertig) => requestAnimationFrame(() => requestAnimationFrame(fertig)));
      const zumTunnel = () => {
        for (let versuch = 0; versuch < 60; versuch += 1) {
          document.querySelector(".cm-bar-left .cm-icon-again").click();
          const wo = st.blaetter.findIndex((a) => a.art === "tunnel");
          if (wo < 0) continue;
          A.losGehts();
          for (let i = 0; i < wo; i += 1) { A.blattLos(); A.antworte(A.blatt().ziel); A.weiter(); }
          A.blattLos();
          return true;
        }
        return false;
      };
      const raus = { gefunden: zumTunnel() };
      if (!raus.gefunden) return raus;
      let a = A.blatt();
      // Eben hingelegt: Die Kugel steht am Anfang der Schiene, und ein Tipp tut nichts.
      await bild();
      A.tippTunnel(performance.now());
      raus.steht = { los: st.los, weg: A.kugelWeg(a, A.tunnelZeit()), phase: st.phase };
      // Kurz darauf rollt sie von selbst los.
      st.t0 -= (A.EINZUG + A.TUNNEL_START) * 1000 + 50;
      await bild();
      raus.los = { phase: st.phase, rollt: st.los > 0 };
      // Die Kugel ist noch vor dem Tunnel.
      st.los = performance.now() - (a.start + (a.s1 * 0.5) / a.v) * 1000;
      A.tippTunnel(performance.now());
      raus.frueh = st.phase;
      // Jetzt ist sie beim Pfeil.
      st.los = performance.now() - (a.start + a.sm / a.v) * 1000;
      A.tippTunnel(performance.now());
      raus.genau = { phase: st.phase, punkte: st.wertung?.punkte, mm: st.wertung?.mm };
      raus.gefunden = zumTunnel();
      a = A.blatt();
      // Niemand tippt: Sie rollt los …
      st.t0 -= (A.EINZUG + A.TUNNEL_START) * 1000 + 50;
      await bild();
      raus.selbst = { phase: st.phase, rollt: st.los > 0 };
      // … und am Ende der Schiene ist das Blatt vorbei.
      st.los = performance.now() - (A.tunnelEnde(a) + 0.05) * 1000;
      await bild();
      raus.nie = { phase: st.phase, antwort: st.antwort, punkte: st.wertung?.punkte };
      return raus;
    });
    pruefe(tunnel.gefunden && tunnel.steht.los === 0 && tunnel.steht.weg === 0 && tunnel.steht.phase === "aufgabe" && tunnel.los.phase === "aufgabe" && tunnel.los.rollt,
      `Augenmass: Die Kugel im Tunnel rollt nicht von selbst los, oder ein Tipp davor zählt: ${JSON.stringify(tunnel)}`);
    pruefe(tunnel.gefunden && tunnel.frueh === "aufgabe" && tunnel.genau.phase === "zeigen" && tunnel.genau.punkte === 10 && tunnel.genau.mm < 0.4,
      `Augenmass: Der Tipp im Tunnel zählt nicht im richtigen Augenblick: ${JSON.stringify(tunnel)}`);
    pruefe(tunnel.selbst?.phase === "aufgabe" && tunnel.selbst.rollt && tunnel.nie?.phase === "zeigen" && tunnel.nie.antwort === null && tunnel.nie.punkte === 0,
      `Augenmass: Wer im Tunnel nie tippt, bekommt trotzdem Punkte – oder das Blatt endet nicht: ${JSON.stringify({ selbst: tunnel.selbst, nie: tunnel.nie })}`);
    await kontext.close();
  }
  {
    // Eine Runde in echter Zeit, aufgezeichnet und angeschaut: dieselben
    // Blätter, dieselben Antworten, dieselben Punkte.
    const { kontext, seite } = await neueSeite({ width: 900, height: 700 });
    await seite.addInitScript(() => {
      if (sessionStorage.getItem("__auge")) return;
      sessionStorage.setItem("__auge", "1");
      localStorage.setItem("mini.name", "Auge");
    });
    await seite.goto(`${BASIS}/augenmass`, { waitUntil: "load" });
    await seite.waitForFunction(() => window.LernappAugenmass?.state?.blaetter && window.LernappAugenmass.view.cssW > 0, null, { timeout: 8000 });
    const welt = await seite.evaluate(() => window.LernappAugenmass.weltText());
    const gespieltListe = await seite.evaluate(async () => {
      const A = window.LernappAugenmass;
      const st = A.state;
      const warte = (ms) => new Promise((fertig) => setTimeout(fertig, ms));
      // Wie weit daneben, Blatt für Blatt – damit nicht alles zehn ist.
      const neben = [0, 1.4, 0.3, 4, 0, 2, 0.8, 6, 0.2, 1];
      A.losGehts();
      for (let i = 0; i < A.BLAETTER; i += 1) {
        // Erst die Vorschau, dann der Tipp, der das Blatt hinlegt.
        await warte(140);
        A.blattLos();
        const a = A.blatt();
        await warte(160);
        A.setzeZeiger({ x: a.ziel.x + 6, y: a.ziel.y + 5 });
        await warte(140);
        let ort = a.ziel;
        for (let w = 0; neben[i] && w < 6.3; w += 0.05) {
          const q = A.aufBahn(a, { x: a.ziel.x + Math.cos(w) * neben[i], y: a.ziel.y + Math.sin(w) * neben[i] });
          if (Math.abs(A.daneben(a, q) - neben[i]) < 0.06) { ort = q; break; }
        }
        if (i === 5) { st.zeiger = null; st.t0 -= (A.ZEIT + A.EINZUG + 60) * 1000; await warte(60); } else A.antworte(ort);
        await warte(260);
        A.weiter();
      }
      return st.liste.map((e) => e.punkte);
    });
    await seite.waitForSelector(".cm-result-score", { timeout: 8000 }).catch(() => {});
    await seite.waitForFunction(() => [...(window.__miniGeister?.keys?.() || [])].some((k) => k.startsWith("eyeMeasure_")), null, { timeout: 4000 }).catch(() => {});
    const gespielt = await seite.evaluate(() => {
      const kennung = localStorage.getItem("mini.id");
      const geist = window.__miniGeister?.get(`eyeMeasure_${kennung}`) || null;
      return { kennung, punkte: geist?.punkte || 0, gezaehlt: window.LernappAugenmass.state.punkte, level: geist?.level || "" };
    });
    pruefe(gespielt.kennung && gespielt.punkte > 30 && gespielt.punkte === gespielt.gezaehlt && gespielt.level === "z3" && gespieltListe[5] === 0,
      `Augenmass: Die Runde wird nicht hinterlegt: ${JSON.stringify({ ...gespielt, gespieltListe })}`);
    await seite.goto(`${BASIS}/augenmass?zuschauen=${gespielt.kennung}`, { waitUntil: "load" });
    await seite.waitForFunction(() => window.LernappAugenmass?.state?.phase === "zuschauen", null, { timeout: 8000 }).catch(() => {});
    const zu = await seite.evaluate(() => ({ phase: window.LernappAugenmass.state.phase, welt: window.LernappAugenmass.weltText() }));
    pruefe(zu.phase === "zuschauen" && zu.welt === welt, `Augenmass: Beim Zuschauen liegen andere Blätter da:\n  gespielt ${welt}\n  angeschaut ${JSON.stringify(zu)}`);
    await seite.waitForSelector(".gz-tafel:not([hidden]) .gz-nochmal", { timeout: 30000 }).catch(() => {});
    const schluss = await seite.evaluate(() => {
      const st = window.LernappAugenmass.state;
      return { punkte: st.punkte, liste: st.liste.map((e) => (e ? e.punkte : null)), tafel: Boolean(document.querySelector(".gz-tafel:not([hidden]) .gz-nochmal")) };
    });
    pruefe(schluss.tafel && schluss.punkte === gespielt.punkte && JSON.stringify(schluss.liste) === JSON.stringify(gespieltListe),
      `Augenmass: Am Ende der angeschauten Runde steht nicht dasselbe: ${JSON.stringify({ ...schluss, gespieltListe, gespielt })}`);
    await kontext.close();
  }

  {
    // Der Knopf «Bestätigen» hat überall seinen Platz: unter dem Blatt (Handy
    // hoch), links unter der Frage (Handy quer), rechts neben dem Blatt
    // (Tablet quer). Er liegt ganz im Bild, nie auf dem Blatt, ist nur da,
    // solange ein Blatt daliegt, und ist gross genug für einen Daumen.
    for (const [breit, hoch, wo] of [[390, 844, "unten"], [360, 640, "unten"], [780, 380, "links"], [1024, 768, "rechts"]]) {
      const { kontext, seite } = await neueSeite({ width: breit, height: hoch });
      await seite.goto(`${BASIS}/augenmass`, { waitUntil: "load" });
      await seite.waitForFunction(() => window.LernappAugenmass?.state?.blaetter && window.LernappAugenmass.view.cssW > 0, null, { timeout: 8000 });
      const lage = await seite.evaluate(async () => {
        const A = window.LernappAugenmass;
        const st = A.state;
        const bild = () => new Promise((fertig) => requestAnimationFrame(() => requestAnimationFrame(fertig)));
        const flaeche = document.querySelector("#am-stage canvas");
        const tipp = () => ["pointerdown", "pointerup"].forEach((art) => flaeche.dispatchEvent(new PointerEvent(art, { bubbles: true, cancelable: true, pointerId: 1, isPrimary: true, pointerType: "touch", clientX: 60, clientY: 200 })));
        const raus = { vorher: A.view.knopfOrt };
        // Der erste Tipp eines Fingers: Jetzt ist klar, womit gespielt wird.
        tipp();
        await bild();
        raus.vorschau = { phase: st.phase, da: A.knopfDa() };
        st.blaetter[0] = { ...A.BAU.kreis(), nr: 0, zeit: A.ZEIT, beispiel: A.BAU.kreis() };
        A.blattLos();
        await bild();
        const kante = flaeche.getBoundingClientRect();
        const k = A.knopf().getBoundingClientRect();
        const stil = getComputedStyle(A.knopf());
        raus.ort = A.view.knopfOrt;
        raus.da = A.knopfDa();
        raus.sichtbar = stil.visibility === "visible" && stil.pointerEvents === "auto";
        raus.knopf = { x: k.left - kante.left, y: k.top - kante.top, w: k.width, h: k.height };
        raus.bild = { w: A.view.cssW, h: A.view.cssH };
        raus.blatt = { x: A.view.x0, y: A.view.y0, seite: A.view.seite };
        raus.text = A.knopf().textContent;
        // Das Blatt ist bestätigt: Der Knopf geht, und Tipps fallen wieder durch.
        st.t0 -= 1000;
        A.setzeZeiger(A.blatt().ziel);
        A.bestaetige();
        await bild();
        const danach = getComputedStyle(A.knopf());
        raus.danach = { phase: st.phase, da: A.knopfDa(), zeiger: danach.pointerEvents };
        return raus;
      });
      const k = lage.knopf;
      const b = lage.blatt;
      const imBild = k.x >= 8 && k.y >= 0 && k.x + k.w <= lage.bild.w - 8 && k.y + k.h <= lage.bild.h - 8;
      const nebenBlatt = k.x + k.w <= b.x || k.x >= b.x + b.seite || k.y >= b.y + b.seite || k.y + k.h <= b.y;
      pruefe(lage.vorher === "" && lage.vorschau.phase === "vorschau" && lage.vorschau.da === false && lage.ort === wo && lage.da && lage.sichtbar && lage.text === "Bestätigen",
        `Augenmass (${breit}×${hoch}): Der Knopf «Bestätigen» ist nicht da, wenn ein Blatt daliegt – oder schon vorher: ${JSON.stringify(lage)}`);
      pruefe(imBild && nebenBlatt && k.w >= 150 && k.h >= 48 && b.seite >= 200,
        `Augenmass (${breit}×${hoch}): Der Knopf liegt nicht frei im Bild, ist zu klein, oder das Blatt hat keinen Platz mehr: ${JSON.stringify(lage)}`);
      pruefe(lage.danach.phase === "zeigen" && lage.danach.da === false && lage.danach.zeiger === "none",
        `Augenmass (${breit}×${hoch}): Nach dem Bestätigen bleibt der Knopf stehen: ${JSON.stringify(lage.danach)}`);
      await kontext.close();
    }
  }

  // --- 4g35. Feuerseil: schaffbar bis weit hinauf, und jede Runde endet von selbst ----
  // Ein Autopilot rechnet das Seil voraus (vorschau – es hängt an nichts, was
  // jemand tut) und springt so ab, dass der nächste Durchgang im Scheitel
  // liegt; wo das Seil schneller dreht, als ein Hüpfer dauert, nimmt er zwei
  // Durchgänge mit einem hohen Sprung. Er kommt auf jeder gewürfelten Welt
  // über achtzig Seile und fast immer «perfekt» – und endet doch: Ab Strophe
  // sechzehn wachsen die Flammen über jede Sprunghöhe. Wer nie springt, wer
  // zu früh springt und wer zu flach springt, sieht die Tafel mit dem Grund.
  {
    const { kontext, seite } = await neueSeite({ width: 420, height: 820 });
    await seite.goto(`${BASIS}/feuerseil`, { waitUntil: "load" });
    await seite.waitForFunction(() => window.LernappFeuerseil?.state?.seil && window.LernappFeuerseil.view.cssW > 0, null, { timeout: 8000 });
    // Der Pilot als Text: rand – so viele Schritte Luft lässt er an jedem
    // Ende des Fensters; flachAb – ab dieser Flammenhöhe tippt er nur noch
    // kurz (und springt damit zu flach), sobald er früh genug dran ist.
    const PILOT = `(F, { rand = 3, flachAb = 9 } = {}) => {
      const st = F.state;
      const HALTE = [8, 12, 16, 20, 24, 32, 40, 48, 62];
      let plan = null;
      const ab = () => { F.druecke(); plan.los = st.tick + plan.halt; plan.ab = Infinity; };
      return () => {
        if (st.phase !== "spiel" || st.fehler) return;
        if (plan && st.gedrueckt && st.tick >= plan.los) F.loslassen();
        if (plan && !st.gedrueckt && st.tick >= plan.los && !st.amBoden) plan = null;
        if (!st.amBoden || st.gedrueckt) return;
        if (plan) { if (st.tick >= plan.ab) ab(); return; }
        const p = F.vorschau(3);
        if (!p.length) return;
        let beste = null;
        // Zu flach: der kürzeste Tipp, so früh, dass das Seil kurz nach dem
        // Scheitel kommt – sobald dafür Zeit ist.
        const flach = p[0].tick - F.sprungProfil(F.HALT_MIN).scheitel - 2;
        if (p[0].flamme >= flachAb && st.tick <= flach) beste = { t: flach, halt: F.HALT_MIN };
        for (const halt of beste ? [] : HALTE) {
          const prof = F.sprungProfil(halt, p[0].flamme + 0.005);
          if (prof.ab < 0) continue;
          const neu = F.sprungProfil(62, (p[1] || p[0]).flamme + 0.005).ab;
          for (let t = Math.max(st.tick, p[0].tick - prof.bis + rand); t <= p[0].tick - prof.ab - rand; t += 1) {
            let ok = true;
            let durch = 1;
            for (let i = 1; i < p.length; i += 1) {
              const rel = p[i].tick - t;
              const drin = rel >= prof.ab + rand && rel <= prof.bis - rand && F.sprungProfil(halt, p[i].flamme + 0.005).ab >= 0;
              if (drin && durch === i) { durch += 1; continue; }
              if (rel < prof.luft + 1 + neu + rand) ok = false;
              break;
            }
            if (!ok) continue;
            const guete = -Math.abs(p[0].tick - t - prof.scheitel) - halt * 0.05;
            if (!beste || guete > beste.guete) beste = { guete, t, halt };
          }
        }
        if (!beste) {
          let halt = 8;
          while (halt < 62 && F.sprungProfil(halt).gipfel < p[0].flamme + 0.05) halt += 4;
          beste = { t: Math.max(st.tick, p[0].tick - F.sprungProfil(halt).scheitel), halt };
        }
        plan = { ab: beste.t, halt: beste.halt, los: Infinity };
        if (st.tick >= plan.ab) ab();
      };
    }`;
    const runde = (opt, laeufe) => seite.evaluate(({ quelle, opt, laeufe }) => {
      const bauen = new Function(`return (${quelle})`)();
      const F = window.LernappFeuerseil;
      const st = F.state;
      const raus = [];
      for (let lauf = 0; lauf < laeufe; lauf += 1) {
        document.querySelector(".cm-bar-left .cm-icon-again").click();
        F.druecke();
        F.loslassen();
        const nachStart = { phase: st.phase, spruenge: st.spruenge };
        // «frueh»: ein kurzer Hüpfer, der zehn Schritte vor dem Seil landet.
        const pilot = opt.art === "nie" ? () => {} : opt.art === "frueh"
          ? () => {
            const [p] = F.vorschau(1);
            if (st.amBoden && st.spruenge === 0 && p && st.tick >= p.tick - F.sprungProfil(F.HALT_MIN).luft - 10) { F.druecke(); F.loslassen(); }
          }
          : bauen(F, opt);
        for (let n = 0; st.phase === "spiel" && !st.fehler && n < 240 * 200; n += 1) {
          pilot();
          F.takt(1 / 240);
        }
        raus.push({
          punkte: st.punkte, seile: st.seile, perfekte: st.perfekte, spruenge: st.spruenge, grund: st.fehler?.grund || "",
          strophe: Math.floor(st.seil.n / F.STROPHE), sekunden: Math.round(st.tick / 240), welt: F.weltText(), nachStart,
        });
      }
      return raus;
    }, { quelle: PILOT, opt, laeufe });
    const genau = await runde({}, 3);
    pruefe(genau.every((r) => r.seile >= 80 && r.seile <= 150 && r.grund && r.sekunden <= 100 && r.strophe >= 12 && r.strophe <= 21),
      `Feuerseil: Der Autopilot kommt nicht über achtzig Seile, oder die Runde endet nicht von selbst – ${JSON.stringify(genau.map(({ welt, ...r }) => r))}`);
    pruefe(genau.every((r) => r.perfekte >= r.seile * 0.7 && r.punkte >= r.seile + r.perfekte && r.punkte <= r.seile * 5 && r.spruenge <= r.seile + 1),
      `Feuerseil: «Perfekt» zählt nicht, wie es soll (ein Punkt je Seil, bis vier dazu) – ${JSON.stringify(genau.map(({ welt, ...r }) => r))}`);
    pruefe(new Set(genau.map((r) => r.welt)).size > 1, `Feuerseil: Die Figuren sind in jeder Runde dieselben – ${JSON.stringify(genau.map((r) => r.welt))}`);
    pruefe(genau.every((r) => r.nachStart.phase === "spiel" && r.nachStart.spruenge === 0),
      `Feuerseil: Der erste Tipp startet nicht nur, er springt auch: ${JSON.stringify(genau[0].nachStart)}`);
    for (const [art, grund, opt] of [["nie", "spaet", { art: "nie" }], ["frueh", "frueh", { art: "frueh" }], ["flach", "flach", { flachAb: 0.33 }]]) {
      const [r] = await runde(opt, 1);
      await seite.waitForSelector(".cm-result-score", { timeout: 6000 }).catch(() => {});
      const tafel = await seite.locator(".cm-result-score").count();
      const text = await seite.locator(".cm-result-detail").innerText().catch(() => "");
      pruefe(r.grund === grund && tafel === 1 && (art !== "nie" || r.punkte === 0),
        `Feuerseil: «${art}» endet nicht mit «${grund}» und einer Tafel: ${JSON.stringify({ ...r, welt: "", tafel, text })}`);
    }
    // Der Sprung: kurz getippt flach und kurz, gehalten hoch und lang – und
    // ein Tipp kurz vor der Landung springt gleich wieder ab.
    const sprung = await seite.evaluate(() => {
      const F = window.LernappFeuerseil;
      const st = F.state;
      const profile = [F.HALT_MIN, 16, 32, 62, 200].map((h) => F.sprungProfil(h));
      document.querySelector(".cm-bar-left .cm-icon-again").click();
      F.druecke();
      F.loslassen();
      F.druecke();
      F.loslassen();
      let nochmal = false;
      for (let n = 0; n < 200 && st.spruenge < 2 && !st.fehler; n += 1) {
        F.takt(1 / 240);
        if (!nochmal && !st.amBoden && st.vy < 0 && st.y < 0.08) { F.druecke(); F.loslassen(); nochmal = true; }
      }
      return { profile: profile.map((p) => ({ gipfel: Math.round(p.gipfel * 100) / 100, luft: p.luft })), spruenge: st.spruenge, amBoden: st.amBoden, nochmal };
    });
    const steigt = sprung.profile.every((p, i) => i === 0 || (p.gipfel >= sprung.profile[i - 1].gipfel && p.luft >= sprung.profile[i - 1].luft));
    pruefe(steigt && sprung.profile[0].gipfel >= 0.3 && sprung.profile[0].gipfel <= 0.35 && sprung.profile[3].gipfel >= 0.62 && sprung.profile[3].gipfel === sprung.profile[4].gipfel
      && sprung.profile[0].luft < 75 && sprung.profile[3].luft > 115,
      `Feuerseil: Halten springt nicht höher und länger: ${JSON.stringify(sprung.profile)}`);
    pruefe(sprung.nochmal && sprung.spruenge === 2 && !sprung.amBoden, `Feuerseil: Ein Tipp kurz vor der Landung springt nicht gleich wieder ab: ${JSON.stringify(sprung)}`);
    await kontext.close();
  }
  {
    // Ein Lauf in echter Zeit – zehn Seile, dann bleibt sie stehen –,
    // aufgezeichnet und angeschaut: dieselben Figuren, am Schluss dieselbe Zahl.
    const { kontext, seite } = await neueSeite({ width: 420, height: 820 });
    await seite.addInitScript(() => {
      if (sessionStorage.getItem("__feuer")) return;
      sessionStorage.setItem("__feuer", "1");
      localStorage.setItem("mini.name", "Fiona");
    });
    await seite.goto(`${BASIS}/feuerseil`, { waitUntil: "load" });
    await seite.waitForFunction(() => window.LernappFeuerseil?.state?.seil && window.LernappFeuerseil.view.cssW > 0, null, { timeout: 8000 });
    const welt = await seite.evaluate(() => window.LernappFeuerseil.weltText());
    await seite.evaluate(() => new Promise((fertig) => {
      const F = window.LernappFeuerseil;
      const st = F.state;
      F.druecke();
      F.loslassen();
      let los = Infinity;
      const lauf = () => {
        if (st.phase !== "spiel" || st.fehler) { fertig(); return; }
        if (st.gedrueckt && st.tick >= los) F.loslassen();
        if (st.amBoden && !st.gedrueckt && st.seile < 10) {
          const [p] = F.vorschau(1);
          // Abwechselnd kurz getippt und lang gehalten.
          const halt = st.spruenge % 2 ? 40 : 12;
          if (p && st.tick >= p.tick - F.sprungProfil(halt).scheitel) { F.druecke(); los = st.tick + halt; }
        }
        requestAnimationFrame(lauf);
      };
      requestAnimationFrame(lauf);
    }));
    await seite.waitForSelector(".cm-result-score", { timeout: 40000 }).catch(() => {});
    await seite.waitForFunction(() => [...(window.__miniGeister?.keys?.() || [])].some((k) => k.startsWith("fireRope_")), null, { timeout: 4000 }).catch(() => {});
    const gespielt = await seite.evaluate(() => {
      const kennung = localStorage.getItem("mini.id");
      const geist = window.__miniGeister?.get(`fireRope_${kennung}`) || null;
      const st = window.LernappFeuerseil.state;
      return { kennung, punkte: geist?.punkte || 0, gezaehlt: st.punkte, seile: st.seile, spruenge: st.spruenge, grund: st.fehler?.grund || "", tick: st.fehler?.tick || 0, zuege: window.LernappFeuerseil.zugProtokoll().length };
    });
    pruefe(gespielt.kennung && gespielt.punkte >= 10 && gespielt.punkte === gespielt.gezaehlt && gespielt.seile === 10 && gespielt.grund === "spaet" && gespielt.zuege === 2 + 2 * gespielt.spruenge,
      `Feuerseil: Der Lauf wird nicht hinterlegt: ${JSON.stringify(gespielt)}`);
    await seite.goto(`${BASIS}/feuerseil?zuschauen=${gespielt.kennung}`, { waitUntil: "load" });
    await seite.waitForFunction(() => window.LernappFeuerseil?.state?.phase === "zuschauen", null, { timeout: 8000 }).catch(() => {});
    const zu = await seite.evaluate(() => ({ phase: window.LernappFeuerseil.state.phase, welt: window.LernappFeuerseil.weltText() }));
    pruefe(zu.phase === "zuschauen" && zu.welt === welt, `Feuerseil: Beim Zuschauen dreht ein anderes Seil:\n  gespielt ${welt}\n  angeschaut ${JSON.stringify(zu)}`);
    // Beim Zuschauen springt niemand mit.
    await seite.mouse.click(200, 500);
    await seite.waitForSelector(".gz-tafel:not([hidden]) .gz-nochmal", { timeout: 40000 }).catch(() => {});
    const schluss = await seite.evaluate(() => {
      const st = window.LernappFeuerseil.state;
      return { punkte: st.punkte, seile: st.seile, spruenge: st.spruenge, grund: st.fehler?.grund || "", tick: st.fehler?.tick || 0, tafel: Boolean(document.querySelector(".gz-tafel:not([hidden]) .gz-nochmal")) };
    });
    pruefe(schluss.tafel && schluss.punkte === gespielt.punkte && schluss.seile === 10 && schluss.spruenge === gespielt.spruenge && schluss.grund === "spaet" && schluss.tick === gespielt.tick,
      `Feuerseil: Am Ende des angeschauten Laufs steht nicht dasselbe: ${JSON.stringify({ ...schluss, gespielt })}`);
    await kontext.close();
  }

  // --- 4g36. Flaggenkommando: zeigen, was er zeigt – und jede Runde endet von selbst --
  // Ein Autopilot liest, was der Kapitän zeigt (state.ziel), und stellt es
  // nach einer festen Reaktionszeit ein: erst senken, was zu viel ist, dann
  // heben, was fehlt. Mit einer Viertelsekunde kommt er auf jeder gewürfelten
  // Welt in die fünfzehnte Welle – dann ist die Frist kürzer als er. Auch der
  // schnellste endet: Ab Welle 25 ist die Frist null. Wer auf eine Finte
  // hereinfällt, wer tippt statt hält, wer die falsche Flagge hebt und wer
  // gar nichts tut, sieht die Tafel mit dem Grund.
  {
    const { kontext, seite } = await neueSeite({ width: 420, height: 820 });
    await seite.goto(`${BASIS}/flaggen`, { waitUntil: "load" });
    await seite.waitForFunction(() => window.LernappFlaggen?.state?.bild && window.LernappFlaggen.view.cssW > 0, null, { timeout: 8000 });
    // Der Pilot als Text: reaktion – so viele Schritte nach dem Kommando
    // stellt er die Pose ein; art – "finte" (er folgt jedem Zucken), "tippen"
    // (hebt und senkt sofort wieder), "falsch" (hebt beim ersten Kommando die
    // andere Flagge), "nie".
    const PILOT = `(F, { reaktion = 60, art = "" } = {}) => {
      const st = F.state;
      const stelle = (ziel) => {
        for (const h of [0, 1]) { const f = h ? F.GELB : F.ROT; if ((st.pose & f) && !(ziel & f)) F.loslassen(h); }
        for (const h of [0, 1]) { const f = h ? F.GELB : F.ROT; if (!(st.pose & f) && (ziel & f)) F.druecke(h); }
      };
      let gefolgt = null;
      return () => {
        if (st.phase !== "spiel" || st.fehler || art === "nie") return;
        if (art === "finte" && st.finte && st.finte !== gefolgt && st.tick >= st.finte.tick + 8) {
          gefolgt = st.finte;
          const h = st.finte.flag === F.GELB ? 1 : 0;
          if (st.finte.runter) F.loslassen(h); else F.druecke(h);
          return;
        }
        if (!st.offen || st.tick - st.kommandoTick < reaktion) return;
        if (art === "falsch") { F.druecke(st.ziel & F.ROT ? 1 : 0); return; }
        stelle(st.ziel);
        if (art === "tippen") stelle(0);
      };
    }`;
    const runde = (opt, laeufe) => seite.evaluate(({ quelle, opt, laeufe }) => {
      const bauen = new Function(`return (${quelle})`)();
      const F = window.LernappFlaggen;
      const st = F.state;
      const raus = [];
      for (let lauf = 0; lauf < laeufe; lauf += 1) {
        document.querySelector(".cm-bar-left .cm-icon-again").click();
        F.druecke(0);
        F.loslassen(0);
        const nachStart = { phase: st.phase, pose: st.pose, ziel: st.ziel };
        const pilot = bauen(F, opt);
        let gekehrt = 0;
        let war = false;
        for (let n = 0; st.phase === "spiel" && !st.fehler && n < 240 * 400; n += 1) {
          pilot();
          F.takt(1 / 240);
          if (st.umgedreht !== war) { war = st.umgedreht; gekehrt += 1; }
        }
        raus.push({
          punkte: st.punkte, kommandos: st.kommandos, blitze: st.blitze, kette: st.besteKette, grund: st.fehler?.grund || "",
          welle: F.kommandoBei(st.nr).welle, sekunden: Math.round(st.tick / 240), gekehrt, welt: F.weltText(), nachStart,
        });
      }
      return raus;
    }, { quelle: PILOT, opt, laeufe });
    const ohneWelt = (liste) => liste.map(({ welt, ...r }) => r);
    const viertel = await runde({ reaktion: 60 }, 3);
    pruefe(viertel.every((r) => r.grund === "langsam" && r.welle === 15 && r.kommandos === 90 && r.sekunden <= 150),
      `Flaggenkommando: Mit einer Viertelsekunde Reaktion endet die Runde nicht in der sechzehnten Welle – ${JSON.stringify(ohneWelt(viertel))}`);
    // Die ersten acht Wellen sind bei ihm alle «Blitz» (die Frist ist lang
    // genug), danach keine mehr: 48 in Folge, und die Punkte folgen daraus.
    pruefe(viertel.every((r) => r.blitze === 48 && r.kette === 48 && r.punkte === 90 + 1 + 2 + 3 * 46),
      `Flaggenkommando: «Blitz» zählt nicht, wie es soll (ein Punkt je Kommando, bis drei dazu) – ${JSON.stringify(ohneWelt(viertel))}`);
    pruefe(new Set(viertel.map((r) => r.welt)).size > 1 && viertel.some((r) => r.gekehrt > 0),
      `Flaggenkommando: Die Kommandos sind in jeder Runde dieselben, oder er dreht sich nie um – ${JSON.stringify(viertel.map((r) => [r.gekehrt, r.welt]))}`);
    pruefe(viertel.every((r) => r.nachStart.phase === "spiel" && r.nachStart.pose === 0 && r.nachStart.ziel === 0),
      `Flaggenkommando: Der erste Tipp startet nicht nur, er hebt auch eine Flagge: ${JSON.stringify(viertel[0].nachStart)}`);
    const [schnellster] = await runde({ reaktion: 0 }, 1);
    pruefe(schnellster.grund === "langsam" && schnellster.kommandos === 144 && schnellster.welle === 24,
      `Flaggenkommando: Auch der Schnellste endet nicht mit Welle 25: ${JSON.stringify({ ...schnellster, welt: "" })}`);
    for (const [art, gruende, mindestens] of [["nie", ["langsam"], 0], ["falsch", ["falsch"], 0], ["tippen", ["gesenkt", "langsam"], 0], ["finte", ["falsch", "gesenkt"], 18]]) {
      const [r] = await runde({ art }, 1);
      await seite.waitForSelector(".cm-result-score", { timeout: 6000 }).catch(() => {});
      const tafel = await seite.locator(".cm-result-score").count();
      pruefe(gruende.includes(r.grund) && tafel === 1 && r.kommandos >= mindestens && (art === "finte" || r.kommandos <= 1),
        `Flaggenkommando: «${art}» endet nicht mit ${gruende.join(" oder ")} und einer Tafel: ${JSON.stringify({ ...r, welt: "", tafel })}`);
    }
    // Der Plan: nie zweimal dieselbe Pose, beide Flaggen erst ab der dritten
    // Welle, Finten ab der vierten, Kehren ab der sechsten – und die Frist
    // fällt von Welle zu Welle.
    const plan = await seite.evaluate(() => {
      const F = window.LernappFlaggen;
      F.planBis(F.ENDE_AB * F.WELLE);
      const liste = Array.from({ length: F.ENDE_AB * F.WELLE }, (_, i) => F.kommandoBei(i));
      let doppelt = 0;
      liste.forEach((c, i) => { if (c.pose === (i ? liste[i - 1].pose : 0)) doppelt += 1; });
      const fristen = Array.from({ length: F.ENDE_AB + 1 }, (_, k) => F.fristBei(k));
      return {
        doppelt,
        beideFrueh: liste.filter((c) => c.pose === 3 && c.welle < F.BEIDE_AB).length,
        finteFrueh: liste.filter((c) => c.finte && c.welle < F.FINTE_AB).length,
        kehrtFrueh: liste.filter((c) => c.kehrt && c.welle < F.KEHRT_AB).length,
        finten: liste.filter((c) => c.finte).length,
        // Eine Finte zugleich mit dem Kommando trifft nur einen Arm, der bleibt.
        finteFalsch: liste.filter((c, i) => c.finte && c.finte.versatz === 0 && (((i ? liste[i - 1].pose : 0) ^ c.pose) & c.finte.flag)).length,
        fristen,
        faellt: fristen.every((f, k) => k === 0 || f < fristen[k - 1]),
      };
    });
    pruefe(plan.doppelt === 0 && plan.beideFrueh === 0 && plan.finteFrueh === 0 && plan.kehrtFrueh === 0 && plan.finten >= 10 && plan.finteFalsch === 0
      && plan.faellt && plan.fristen[0] === 240 && plan.fristen[24] === 0,
      `Flaggenkommando: Der Plan ist nicht, wie er sein soll – ${JSON.stringify(plan)}`);
    await kontext.close();
  }
  {
    // Ein Lauf in echter Zeit – acht Kommandos, dann die falsche Flagge –,
    // aufgezeichnet und angeschaut: dieselben Kommandos, am Schluss dieselbe Zahl.
    const { kontext, seite } = await neueSeite({ width: 420, height: 820 });
    await seite.addInitScript(() => {
      if (sessionStorage.getItem("__flaggen")) return;
      sessionStorage.setItem("__flaggen", "1");
      localStorage.setItem("mini.name", "Kapitänin");
    });
    await seite.goto(`${BASIS}/flaggen`, { waitUntil: "load" });
    await seite.waitForFunction(() => window.LernappFlaggen?.state?.bild && window.LernappFlaggen.view.cssW > 0, null, { timeout: 8000 });
    const welt = await seite.evaluate(() => window.LernappFlaggen.weltText());
    await seite.evaluate(() => new Promise((fertig) => {
      const F = window.LernappFlaggen;
      const st = F.state;
      F.druecke(1);
      F.loslassen(1);
      const lauf = () => {
        if (st.phase !== "spiel" || st.fehler) { fertig(); return; }
        if (st.offen && st.tick - st.kommandoTick >= 40) {
          if (st.kommandos >= 8) {
            // Die falsche: eine, die er nicht zeigt (bei «beide» senkt sie zu früh).
            if (st.ziel === 3) { if (st.pose) F.loslassen(st.pose & F.ROT ? 0 : 1); }
            else F.druecke(st.ziel & F.ROT ? 1 : 0);
          } else {
            for (const h of [0, 1]) { const f = h ? F.GELB : F.ROT; if ((st.pose & f) && !(st.ziel & f)) F.loslassen(h); }
            for (const h of [0, 1]) { const f = h ? F.GELB : F.ROT; if (!(st.pose & f) && (st.ziel & f)) F.druecke(h); }
          }
        }
        requestAnimationFrame(lauf);
      };
      requestAnimationFrame(lauf);
    }));
    await seite.waitForSelector(".cm-result-score", { timeout: 40000 }).catch(() => {});
    await seite.waitForFunction(() => [...(window.__miniGeister?.keys?.() || [])].some((k) => k.startsWith("flagCommand_")), null, { timeout: 4000 }).catch(() => {});
    const gespielt = await seite.evaluate(() => {
      const kennung = localStorage.getItem("mini.id");
      const geist = window.__miniGeister?.get(`flagCommand_${kennung}`) || null;
      const st = window.LernappFlaggen.state;
      return { kennung, punkte: geist?.punkte || 0, gezaehlt: st.punkte, kommandos: st.kommandos, grund: st.fehler?.grund || "", tick: st.fehler?.tick || 0, zuege: window.LernappFlaggen.zugProtokoll().length };
    });
    pruefe(gespielt.kennung && gespielt.punkte >= 8 && gespielt.punkte === gespielt.gezaehlt && gespielt.kommandos === 8 && ["falsch", "langsam"].includes(gespielt.grund) && gespielt.zuege >= 10,
      `Flaggenkommando: Der Lauf wird nicht hinterlegt: ${JSON.stringify(gespielt)}`);
    await seite.goto(`${BASIS}/flaggen?zuschauen=${gespielt.kennung}`, { waitUntil: "load" });
    await seite.waitForFunction(() => window.LernappFlaggen?.state?.phase === "zuschauen", null, { timeout: 8000 }).catch(() => {});
    const zu = await seite.evaluate(() => ({ phase: window.LernappFlaggen.state.phase, welt: window.LernappFlaggen.weltText() }));
    pruefe(zu.phase === "zuschauen" && zu.welt === welt, `Flaggenkommando: Beim Zuschauen kommandiert ein anderer:\n  gespielt ${welt}\n  angeschaut ${JSON.stringify(zu)}`);
    // Beim Zuschauen hebt niemand mit.
    await seite.mouse.click(100, 500);
    await seite.waitForSelector(".gz-tafel:not([hidden]) .gz-nochmal", { timeout: 40000 }).catch(() => {});
    const schluss = await seite.evaluate(() => {
      const st = window.LernappFlaggen.state;
      return { punkte: st.punkte, kommandos: st.kommandos, grund: st.fehler?.grund || "", tick: st.fehler?.tick || 0, tafel: Boolean(document.querySelector(".gz-tafel:not([hidden]) .gz-nochmal")) };
    });
    pruefe(schluss.tafel && schluss.punkte === gespielt.punkte && schluss.kommandos === 8 && schluss.grund === gespielt.grund && schluss.tick === gespielt.tick,
      `Flaggenkommando: Am Ende des angeschauten Laufs steht nicht dasselbe: ${JSON.stringify({ ...schluss, gespielt })}`);
    await kontext.close();
  }

  // --- 4g37. Zeitgefühl: zehn Aufgaben, gemessen auf die Hundertstelsekunde -----------
  // Jede Runde hat ihre drei leichten, vier mittleren und drei schweren
  // Aufgaben, jede Art einmal, mit Zeiten aus ihrem Band. Zehn genaue
  // Antworten geben tausend Punkte; jede Hundertstel daneben kostet, was die
  // Stufe sagt. Ein Tipp gilt erst, wenn die Vorgabe weg ist, gemessen wird
  // der Augenblick des Tipps (oder wie lange gehalten wurde), und wer gar
  // nicht antwortet, bekommt nichts. Vor jeder Aufgabe steht die Uhr: Sie
  // läuft erst nach einem Tipp – oder nach WARTE Sekunden von selbst. Die
  // Stempelkarte liegt neben oder unter der Uhr, nie auf ihr.
  {
    const { kontext, seite } = await neueSeite({ width: 420, height: 820 });
    await seite.goto(`${BASIS}/zeitgefuehl`, { waitUntil: "load" });
    await seite.waitForFunction(() => window.LernappZeitgefuehl?.state?.aufgaben && window.LernappZeitgefuehl.view.cssW > 0, null, { timeout: 8000 });
    const bau = await seite.evaluate(() => {
      const Z = window.LernappZeitgefuehl;
      const befunde = [];
      const welten = new Set();
      for (let runde = 0; runde < 30; runde += 1) {
        document.querySelector(".cm-bar-left .cm-icon-again").click();
        const liste = Z.state.aufgaben;
        welten.add(Z.weltText());
        if (liste.length !== 10) befunde.push(`nicht zehn: ${liste.length}`);
        if (liste.map((a) => a.stufe).join("") !== "0001111222") befunde.push(`Stufen: ${liste.map((a) => a.stufe).join("")}`);
        const arten = liste.map((a) => a.art);
        if (new Set(arten).size !== 10) befunde.push(`doppelt: ${arten.join(" ")}`);
        if (![...Z.LEICHT, ...Z.MITTEL, ...Z.SCHWER].every((art) => arten.includes(art))) befunde.push(`es fehlt eine Art: ${arten.join(" ")}`);
        for (const a of liste) {
          if (!(a.ziel >= 1500 && a.ziel <= 7000)) befunde.push(`${a.art}: Ziel ${a.ziel}`);
          if (a.eingabe === "tipp" && !(a.ab >= 1000 && a.ab <= a.ziel - 1000)) befunde.push(`${a.art}: zu wenig Zeit zwischen Verschwinden (${a.ab}) und Ziel (${a.ziel})`);
          if (a.eingabe === "halten" && a.art !== "blind" && !(a.ab > a.an + a.dauer)) befunde.push(`${a.art}: Halten gilt, bevor die Lampe aus ist`);
          if (!a.frage || !a.name) befunde.push(`${a.art}: ohne Satz`);
        }
      }
      const tabelle = [[0, 0], [70, 0], [-70, 0], [70, 1], [70, 2], [1000, 0], [1250, 1], [2000, 2], [null, 0]].map(([ms, stufe]) => Z.punkteFuer(ms, stufe));
      // Die Zeitlupe misst, was ihre Uhr zeigt.
      const lupe = Z.state.aufgaben.find((a) => a.art === "zeitlupe");
      return { befunde: [...new Set(befunde)].slice(0, 6), welten: welten.size, tabelle, lupe: Math.round(Z.daneben(lupe, lupe.ziel + 100) / lupe.faktor) };
    });
    pruefe(bau.befunde.length === 0 && bau.welten >= 25,
      `Zeitgefühl: Die Aufgaben sind nicht, wie sie sein sollen – ${JSON.stringify(bau)}`);
    pruefe(JSON.stringify(bau.tabelle) === JSON.stringify([100, 93, 93, 94, 96, 0, 0, 0, 0]) && bau.lupe === 100,
      `Zeitgefühl: Die Punkte fallen nicht nach der Regel: ${JSON.stringify(bau.tabelle)} / ${bau.lupe}`);
    // Zehn genaue Antworten: tausend Punkte und die Tafel.
    const genau = await seite.evaluate(async () => {
      const Z = window.LernappZeitgefuehl;
      const st = Z.state;
      const warte = (ms) => new Promise((fertig) => setTimeout(fertig, ms));
      document.querySelector(".cm-bar-left .cm-icon-again").click();
      Z.losGehts();
      const wartend = [];
      for (let i = 0; i < Z.AUFGABEN; i += 1) {
        await warte(60);
        // Jede Aufgabe liegt erst da und wartet; ihre Uhr läuft nach dem Tipp.
        wartend.push(st.phase);
        Z.aufgabeLos();
        Z.antworte(Z.aufgabe().ziel);
        await warte(60);
        Z.weiter();
      }
      return { punkte: st.punkte, liste: st.liste.map((e) => e.punkte), phase: st.phase, wartend };
    });
    await seite.waitForSelector(".cm-result-score", { timeout: 6000 }).catch(() => {});
    pruefe(genau.punkte === 1000 && genau.liste.every((p) => p === 100) && genau.phase === "ende" && await seite.locator(".cm-result-score").count() === 1,
      `Zeitgefühl: Zehn genaue Antworten geben nicht tausend Punkte und die Tafel: ${JSON.stringify(genau)}`);
    pruefe(genau.wartend.length === 10 && genau.wartend.every((p) => p === "warten"),
      `Zeitgefühl: Nicht jede Aufgabe wartet zuerst auf den Tipp: ${JSON.stringify(genau.wartend)}`);
    // Die Uhr steht, bis jemand tippt: Die Aufgabe liegt da, ein Tipp gleich
    // nach dem Hinlegen zählt noch nicht, der nächste lässt die Uhr anlaufen –
    // und er ist nicht schon die Antwort. Auch die Leertaste startet sie. Wer
    // nie tippt, bekommt die Aufgabe nach WARTE Sekunden.
    const warten = await seite.evaluate(async () => {
      const Z = window.LernappZeitgefuehl;
      const st = Z.state;
      const bild = () => new Promise((fertig) => requestAnimationFrame(() => requestAnimationFrame(fertig)));
      const flaeche = () => document.querySelector("#zf-stage canvas");
      const tipp = (art) => { const r = flaeche().getBoundingClientRect(); (art === "pointerup" ? window : flaeche()).dispatchEvent(new PointerEvent(art, { bubbles: true, cancelable: true, pointerId: 1, isPrimary: true, pointerType: "touch", clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 })); };
      const raus = {};
      document.querySelector(".cm-bar-left .cm-icon-again").click();
      await bild();
      // Der erste Tipp beginnt die Runde: Die erste Aufgabe liegt da, ihre Uhr steht.
      tipp("pointerdown");
      tipp("pointerup");
      raus.erste = { phase: st.phase, index: st.index };
      // Gleich danach zählt ein Tipp noch nicht.
      tipp("pointerdown");
      tipp("pointerup");
      raus.gleich = st.phase;
      // Zwanzig Sekunden später steht sie immer noch.
      st.wartSeit -= 20000;
      await bild();
      raus.spaeter = { phase: st.phase, wertung: st.wertung };
      // Der Tipp: Die Uhr läuft an – ANLAUF später steht sie auf null.
      tipp("pointerdown");
      raus.los = { phase: st.phase, uhr: Math.round(Z.seit()), wertung: st.wertung, haltAb: st.haltAb };
      tipp("pointerup");
      raus.losgelassen = { phase: st.phase, wertung: st.wertung };
      // Die Antwort, dann die nächste Aufgabe: Auch sie wartet.
      Z.antworte(Z.aufgabe().ziel);
      Z.weiter();
      raus.zweite = { phase: st.phase, index: st.index };
      // Die Leertaste startet sie auch.
      st.wartSeit -= 1000;
      document.dispatchEvent(new KeyboardEvent("keydown", { key: " ", bubbles: true }));
      document.dispatchEvent(new KeyboardEvent("keyup", { key: " ", bubbles: true }));
      raus.taste = { phase: st.phase, wertung: st.wertung };
      Z.antworte(Z.aufgabe().ziel);
      Z.weiter();
      // Wer nie tippt: kurz vor WARTE steht sie noch, danach läuft sie von selbst.
      st.wartSeit -= Z.WARTE * 1000 - 400;
      await bild();
      raus.fast = st.phase;
      st.wartSeit -= 500;
      await bild();
      raus.selbst = st.phase;
      return raus;
    });
    pruefe(warten.erste.phase === "warten" && warten.erste.index === 0 && warten.gleich === "warten" && warten.spaeter.phase === "warten" && !warten.spaeter.wertung,
      `Zeitgefühl: Die Uhr läuft schon, bevor jemand tippt: ${JSON.stringify(warten)}`);
    pruefe(warten.los.phase === "aufgabe" && warten.los.uhr <= 0 && warten.los.uhr >= -250 && !warten.los.wertung && warten.los.haltAb === null
      && warten.losgelassen.phase === "aufgabe" && !warten.losgelassen.wertung,
      `Zeitgefühl: Der Tipp lässt die Uhr nicht anlaufen, oder er zählt schon als Antwort: ${JSON.stringify(warten)}`);
    pruefe(warten.zweite.phase === "warten" && warten.zweite.index === 1 && warten.taste.phase === "aufgabe" && !warten.taste.wertung,
      `Zeitgefühl: Die nächste Aufgabe wartet nicht, oder die Leertaste startet sie nicht: ${JSON.stringify(warten)}`);
    pruefe(warten.fast === "warten" && warten.selbst === "aufgabe",
      `Zeitgefühl: Wer nie tippt, bekommt die Aufgabe nicht nach ihrer Wartezeit: ${JSON.stringify(warten)}`);
    // Tippen und Halten in echter Zeit. Die Uhr der Aufgabe wird dafür
    // vorgestellt (t0), statt Sekunden zu warten.
    const eingabe = await seite.evaluate(async () => {
      const Z = window.LernappZeitgefuehl;
      const st = Z.state;
      const warte = (ms) => new Promise((fertig) => setTimeout(fertig, ms));
      const bild = () => new Promise((fertig) => requestAnimationFrame(() => requestAnimationFrame(fertig)));
      const stelle = (ms) => { st.t0 = performance.now() - Z.EINZUG - ms; };
      // Die Aufgabe der gesuchten Art hinlegen, wo immer sie in der Runde steht.
      const zu = (art) => {
        Z.aufgabeAuf(st.aufgaben.findIndex((x) => x.art === art));
        Z.aufgabeLos();
        return Z.aufgabe();
      };
      const raus = {};
      document.querySelector(".cm-bar-left .cm-icon-again").click();
      Z.losGehts();
      // Zu früh: Solange die Uhr zu sehen ist, gilt der Tipp nicht.
      let a = zu("stoppuhr");
      stelle(a.ab - 300);
      Z.druck();
      raus.frueh = { phase: st.phase, wertung: st.wertung };
      // Der Tipp ist die Antwort, gemessen an seinem Augenblick.
      stelle(a.ziel + 70);
      Z.druck();
      raus.tipp = { phase: st.phase, wert: Math.round(st.wertung?.wert - a.ziel), punkte: st.wertung?.punkte };
      // Gerechnet wird mit ganzen Millisekunden: 45,4 daneben zählt wie 45 –
      // 96 Punkte, nicht 95 –, denn so steht es in der Aufzeichnung.
      a = zu("stoppuhr");
      Z.antworte(a.ziel + 45.4);
      raus.krumm = { wert: st.wertung?.wert - a.ziel, punkte: st.wertung?.punkte };
      // Halten: vom Drücken bis zum Loslassen.
      a = zu("blind");
      stelle(a.ab + 50);
      Z.druck();
      const haelt = st.haltAb !== null;
      await warte(300);
      Z.los();
      raus.halten = { haelt, phase: st.phase, wert: Math.round(st.wertung?.wert), ms: Math.round(st.wertung?.ms + a.ziel) };
      // Niemand antwortet: nichts.
      a = zu("lang");
      stelle(a.ziel + Z.NACHLAUF + 50);
      await bild();
      raus.nie = { phase: st.phase, wert: st.wertung?.wert ?? null, punkte: st.wertung?.punkte };
      // Wer hält und nicht mehr loslässt, wird nach HALT_MEHR abgelöst.
      a = zu("nachhalten");
      stelle(a.ab + 20);
      Z.druck();
      stelle(a.ab + 20 + a.ziel + Z.HALT_MEHR + 30);
      await bild();
      raus.ewig = { phase: st.phase, zuLang: Math.round(st.wertung?.ms || 0) >= Z.HALT_MEHR, punkte: st.wertung?.punkte };
      // Vor dem Ende der Lampe gilt das Halten nicht.
      a = zu("doppelt");
      stelle(a.an + a.dauer - 200);
      Z.druck();
      raus.lampe = { haltAb: st.haltAb, phase: st.phase };
      return raus;
    });
    pruefe(eingabe.frueh.phase === "aufgabe" && !eingabe.frueh.wertung, `Zeitgefühl: Ein Tipp, solange die Uhr zu sehen ist, zählt schon: ${JSON.stringify(eingabe.frueh)}`);
    pruefe(eingabe.tipp.phase === "zeigen" && Math.abs(eingabe.tipp.wert - 70) <= 8 && eingabe.tipp.punkte >= 92 && eingabe.tipp.punkte <= 94,
      `Zeitgefühl: Der Tipp zählt nicht im richtigen Augenblick: ${JSON.stringify(eingabe.tipp)}`);
    pruefe(eingabe.krumm.wert === 45 && eingabe.krumm.punkte === 96,
      `Zeitgefühl: Gerechnet wird nicht mit ganzen Millisekunden – Runde und Wiedergabe kämen auf verschiedene Punkte: ${JSON.stringify(eingabe.krumm)}`);
    pruefe(eingabe.halten.haelt && eingabe.halten.phase === "zeigen" && eingabe.halten.wert >= 290 && eingabe.halten.wert <= 380 && eingabe.halten.ms === eingabe.halten.wert,
      `Zeitgefühl: Gehalten wird nicht vom Drücken bis zum Loslassen gemessen: ${JSON.stringify(eingabe.halten)}`);
    pruefe(eingabe.nie.phase === "zeigen" && eingabe.nie.wert === null && eingabe.nie.punkte === 0,
      `Zeitgefühl: Wer nicht antwortet, bekommt trotzdem etwas – oder es geht nicht weiter: ${JSON.stringify(eingabe.nie)}`);
    pruefe(eingabe.ewig.phase === "zeigen" && eingabe.ewig.zuLang && eingabe.ewig.punkte === 0 && eingabe.lampe.haltAb === null && eingabe.lampe.phase === "aufgabe",
      `Zeitgefühl: Halten ohne Ende oder vor dem Ende der Lampe tut nicht, was es soll: ${JSON.stringify({ ewig: eingabe.ewig, lampe: eingabe.lampe })}`);
    await kontext.close();
  }
  {
    // Eine Runde, aufgezeichnet und angeschaut: dieselben zehn Aufgaben,
    // dieselben Punkte.
    const { kontext, seite } = await neueSeite({ width: 420, height: 820 });
    await seite.addInitScript(() => {
      if (sessionStorage.getItem("__zeit")) return;
      sessionStorage.setItem("__zeit", "1");
      localStorage.setItem("mini.name", "Uhr");
    });
    await seite.goto(`${BASIS}/zeitgefuehl`, { waitUntil: "load" });
    await seite.waitForFunction(() => window.LernappZeitgefuehl?.state?.aufgaben && window.LernappZeitgefuehl.view.cssW > 0, null, { timeout: 8000 });
    const welt = await seite.evaluate(() => window.LernappZeitgefuehl.weltText());
    const gespieltListe = await seite.evaluate(async () => {
      const Z = window.LernappZeitgefuehl;
      const st = Z.state;
      const warte = (ms) => new Promise((fertig) => setTimeout(fertig, ms));
      // Wie weit daneben, Aufgabe für Aufgabe – damit nicht alles hundert ist.
      // Krumme Zahlen: Ein Finger trifft keine ganze Millisekunde, und die
      // Zeitlupe hat krumme Ziele – beides muss beim Anschauen gleich zählen.
      // 45,4 ms (leicht) und 118,7 ms (mittel) liegen genau so, dass ungerundet
      // ein anderer Punkt herauskäme als mit der aufgezeichneten Millisekunde.
      const neben = [45.4, 140.5, -30.5, 118.7, 0, 200, -79.5, 600.51, 20.3, -100.5];
      Z.losGehts();
      for (let i = 0; i < Z.AUFGABEN; i += 1) {
        const a = Z.aufgabe();
        // Erst liegt sie da und wartet, dann der Tipp.
        await warte(120);
        Z.aufgabeLos();
        await warte(150);
        if (i === 5) Z.antworte(null);
        else if (a.eingabe === "halten") {
          // Ein echtes Halten: drücken, sobald es gilt, und loslassen.
          st.t0 = performance.now() - Z.EINZUG - a.ab - 30;
          Z.druck();
          await warte(200);
          Z.antworte(a.ziel + neben[i]);
        } else Z.antworte(a.ziel + neben[i]);
        await warte(260);
        Z.weiter();
      }
      return st.liste.map((e) => e.punkte);
    });
    await seite.waitForSelector(".cm-result-score", { timeout: 8000 }).catch(() => {});
    await seite.waitForFunction(() => [...(window.__miniGeister?.keys?.() || [])].some((k) => k.startsWith("timeSense_")), null, { timeout: 4000 }).catch(() => {});
    const gespielt = await seite.evaluate(() => {
      const kennung = localStorage.getItem("mini.id");
      const geist = window.__miniGeister?.get(`timeSense_${kennung}`) || null;
      return { kennung, punkte: geist?.punkte || 0, gezaehlt: window.LernappZeitgefuehl.state.punkte, level: geist?.level || "" };
    });
    pruefe(gespielt.kennung && gespielt.punkte > 500 && gespielt.punkte < 1000 && gespielt.punkte === gespielt.gezaehlt && gespielt.level === "z1" && gespieltListe[5] === 0,
      `Zeitgefühl: Die Runde wird nicht hinterlegt: ${JSON.stringify({ ...gespielt, gespieltListe })}`);
    await seite.goto(`${BASIS}/zeitgefuehl?zuschauen=${gespielt.kennung}`, { waitUntil: "load" });
    await seite.waitForFunction(() => window.LernappZeitgefuehl?.state?.phase === "zuschauen", null, { timeout: 8000 }).catch(() => {});
    const zu = await seite.evaluate(() => ({ phase: window.LernappZeitgefuehl.state.phase, welt: window.LernappZeitgefuehl.weltText() }));
    pruefe(zu.phase === "zuschauen" && zu.welt === welt, `Zeitgefühl: Beim Zuschauen liegen andere Aufgaben da:\n  gespielt ${welt}\n  angeschaut ${JSON.stringify(zu)}`);
    // Beim Zuschauen tippt niemand mit.
    await seite.mouse.click(200, 500);
    await seite.waitForSelector(".gz-tafel:not([hidden]) .gz-nochmal", { timeout: 40000 }).catch(() => {});
    const schluss = await seite.evaluate(() => {
      const st = window.LernappZeitgefuehl.state;
      return { punkte: st.punkte, liste: st.liste.map((e) => (e ? e.punkte : null)), tafel: Boolean(document.querySelector(".gz-tafel:not([hidden]) .gz-nochmal")) };
    });
    pruefe(schluss.tafel && schluss.punkte === gespielt.punkte && JSON.stringify(schluss.liste) === JSON.stringify(gespieltListe),
      `Zeitgefühl: Am Ende der angeschauten Runde steht nicht dasselbe: ${JSON.stringify({ ...schluss, gespieltListe, gespielt })}`);
    await kontext.close();
  }

  {
    // Die Stempelkarte: neben der Uhr, wo dort Platz ist; sonst darunter –
    // gross, wo es Platz hat, sonst in zwei Spalten. Sie liegt ganz im Bild,
    // nie auf der Uhr, ihrer Auflösung oder dem Satz der Aufgabe, und sie
    // ist gezeichnet (Papier, wo sie liegt).
    for (const [breit, hoch, art, klein] of [[1280, 800, "seite", false], [844, 390, "seite", false], [768, 1024, "unten", false], [390, 844, "unten", true], [360, 640, "unten", true]]) {
      const { kontext, seite } = await neueSeite({ width: breit, height: hoch });
      await seite.goto(`${BASIS}/zeitgefuehl`, { waitUntil: "load" });
      await seite.waitForFunction(() => window.LernappZeitgefuehl?.state?.aufgaben && window.LernappZeitgefuehl.view.cssW > 0, null, { timeout: 8000 });
      const lage = await seite.evaluate(async () => {
        const Z = window.LernappZeitgefuehl;
        const bild = () => new Promise((fertig) => requestAnimationFrame(() => requestAnimationFrame(fertig)));
        Z.losGehts();
        Z.aufgabeLos();
        Z.antworte(Z.aufgabe().ziel + 40);
        await bild();
        const v = Z.view;
        const k = v.karte;
        if (!k) return { k: null };
        // Das Papier: oben in der Mitte der Karte, wo kein Text steht.
        const fl = document.querySelector("#zf-stage canvas");
        const px = fl.getContext("2d").getImageData(Math.round((k.x + k.w / 2) * v.dpr), Math.round((k.y + 5) * v.dpr), 1, 1).data;
        return {
          k: { art: k.art, klein: k.klein, x: k.x, y: k.y, w: k.w, h: k.h },
          bild: { w: v.cssW, h: v.cssH, frei: v.frei },
          uhr: { cx: v.cx, cy: v.cy, r: v.r },
          papier: [px[0], px[1], px[2]],
        };
      });
      const k = lage.k;
      const imBild = k && k.x >= 0 && k.y >= lage.bild.frei && k.x + k.w <= lage.bild.w && k.y + k.h <= lage.bild.h;
      const frei = !k ? false : k.art === "seite"
        ? k.x + k.w <= lage.uhr.cx - lage.uhr.r * 1.15 && k.y + k.h <= lage.bild.h - 40
        : k.y >= lage.uhr.cy + lage.uhr.r * 1.6 && lage.uhr.cy - lage.uhr.r * 1.38 - lage.bild.frei >= 90 && lage.uhr.r >= 80;
      pruefe(k && k.art === art && k.klein === klein && imBild && frei,
        `Zeitgefühl (${breit}×${hoch}): Die Stempelkarte liegt nicht, wo sie soll, oder über der Uhr: ${JSON.stringify(lage)}`);
      pruefe(lage.papier && lage.papier[0] > 200 && lage.papier[1] > 190 && lage.papier[2] > 150,
        `Zeitgefühl (${breit}×${hoch}): Die Stempelkarte ist nicht gezeichnet: ${JSON.stringify(lage.papier)}`);
      await kontext.close();
    }
  }

  // --- 4g38. Kletterwand: immer kletterbar, und jede Runde endet von selbst -----------
  // Die Wand entsteht Griff um Griff aus dem Zufall – und ist doch immer zu
  // klettern: Der nächste Griff der Hauptlinie liegt nie weiter weg, als sie
  // ohne Schwung reicht, auch wenn er oder sein Vorgänger auf der Schiene am
  // Rand steht. Ein Pilot, der alle 0,4 Sekunden genau auf den Bolzen tippt,
  // kommt weit über zweihundert Meter – und fällt doch: Die Kraft läuft mit
  // jedem Meter schneller ab. Wer zögert, wer daneben tippt und wer an einem
  // bröckelnden Griff hängen bleibt, fällt ins Seil.
  {
    const { kontext, seite } = await neueSeite({ width: 420, height: 820 });
    await seite.goto(`${BASIS}/kletterwand`, { waitUntil: "load" });
    await seite.waitForFunction(() => window.LernappKletterwand?.state?.wand && window.LernappKletterwand.view.cssW > 0, null, { timeout: 8000 });
    const bau = await seite.evaluate(() => {
      const K = window.LernappKletterwand;
      const raus = { weitester: 0, gold: 0, goldNah: 0, goldWeiter: 0, zuFrueh: 0, arten: {}, aussen: 0, fallend: 0, rMin: 1, unten: [0, 0], oben: [0, 0], welten: 0 };
      const welten = new Set();
      for (let runde = 0; runde < 4; runde += 1) {
        document.querySelector(".cm-bar-left .cm-icon-again").click();
        welten.add(K.weltText());
        const W = K.neueWand();
        K.wandBis(W, K.START_Y + 300);
        const haupt = W.griffe.filter((g) => g.haupt);
        const enden = (g) => [g.x - g.weit, g.x + g.weit];
        for (let i = 1; i < haupt.length; i += 1) {
          const a = haupt[i - 1];
          const b = haupt[i];
          for (const ax of enden(a)) for (const bx of enden(b)) raus.weitester = Math.max(raus.weitester, Math.hypot(ax - bx, a.y - b.y));
          if (b.y <= a.y) raus.fallend += 1;
        }
        W.griffe.forEach((g, i) => {
          const meter = g.y - K.START_Y;
          raus.arten[g.art] = (raus.arten[g.art] || 0) + 1;
          if ((g.art === "bruch" && meter < K.AB_BRUCH) || (g.art === "pendel" && meter < K.AB_PENDEL)) raus.zuFrueh += 1;
          if (Math.abs(g.x) + g.weit > K.BAHN + 1e-9) raus.aussen += 1;
          raus.rMin = Math.min(raus.rMin, g.r);
          if (g.haupt && meter > 2 && meter < 20) { raus.unten[0] += g.r; raus.unten[1] += 1; }
          if (g.haupt && meter > 200) { raus.oben[0] += g.r; raus.oben[1] += 1; }
          if (!g.gold) return;
          raus.gold += 1;
          const davor = W.griffe.slice(0, i).filter((h) => h.haupt);
          const vorher = davor[davor.length - 2];
          const danach = W.griffe.slice(i + 1).find((h) => h.haupt);
          // Vom Griff davor ist ein goldener nur mit Schwung zu holen – und von
          // ihm aus geht es auf der Hauptlinie weiter.
          if (vorher && Math.hypot(g.x - vorher.x, g.y - vorher.y) <= K.R_STAND) raus.goldNah += 1;
          if (danach) for (const dx of enden(danach)) raus.goldWeiter = Math.max(raus.goldWeiter, Math.hypot(g.x - dx, g.y - danach.y));
        });
      }
      raus.welten = welten.size;
      raus.unten = raus.unten[0] / raus.unten[1];
      raus.oben = raus.oben[0] / raus.oben[1];
      return raus;
    });
    pruefe(bau.weitester <= 0.94 + 1e-9 && bau.fallend === 0 && bau.aussen === 0,
      `Kletterwand: Die Hauptlinie ist nicht überall ohne Schwung zu klettern, oder ein Griff liegt neben der Bahn: ${JSON.stringify(bau)}`);
    pruefe(bau.gold > 20 && bau.goldNah === 0 && bau.goldWeiter <= 0.94 + 1e-9,
      `Kletterwand: Ein goldener Griff ist ohne Schwung zu holen, oder von ihm aus geht es nicht weiter: ${JSON.stringify(bau)}`);
    pruefe(bau.zuFrueh === 0 && bau.arten.bruch > 40 && bau.arten.pendel > 40 && bau.arten.fest > bau.arten.bruch + bau.arten.pendel,
      `Kletterwand: Bröckelgriffe und Schienen kommen nicht, wann sie sollen: ${JSON.stringify(bau)}`);
    pruefe(bau.unten > 0.125 && bau.oben < 0.078 && bau.rMin >= 0.055 && bau.welten > 1,
      `Kletterwand: Die Griffe werden nicht kleiner, oder jede Runde hat dieselbe Wand: ${JSON.stringify(bau)}`);

    // Die Regeln, an einer frischen Wand gerechnet (ohne Bild).
    const regeln = await seite.evaluate(() => {
      const K = window.LernappKletterwand;
      const runden = (z) => Math.round(z * 1000) / 1000;
      const frisch = (kraft = 1) => { const W = K.neueWand(); const k = K.neueKletterin(); k.kraft = kraft; return { W, k }; };
      const naechster = (W, k) => W.griffe.find((g) => g.haupt && K.inReichweite(W, k, g, K.R_STAND));
      const raus = {};
      // Die Güte nach dem Abstand vom Bolzen, in Halbmessern.
      raus.guete = [0.2, 0.6, 1.0, 1.8].map((f) => {
        const { W, k } = frisch(0.3);
        const g = naechster(W, k);
        const e = K.tippe(W, k, g.x, g.y + g.r * f);
        return { art: e.art, guete: e.guete ?? null, aus: k.aus, zuege: k.zuege, kraft: runden(k.kraft), schwung: runden(k.schwung), los: k.los };
      });
      {
        const { W, k } = frisch();
        raus.leer = { art: K.tippe(W, k, 1.2, K.START_Y + 0.5).art, zuege: k.zuege, los: k.los };
      }
      // Der Finger: Auf dem Bildschirm ist keine Grenze enger als ihre
      // Mindestpunkte – ein kleiner Griff, aus der Ferne gesehen (ein Punkt
      // des Bildschirms misst einen Zentimeter).
      {
        const g = { r: 0.06 };
        raus.finger = { ohne: [0.02, 0.05, 0.08, 0.1, 0.16].map((d) => K.gueteVon(g, d)), mit: [0.07, 0.14, 0.21, 0.35, 0.37].map((d) => K.gueteVon(g, d, 0.01)) };
      }
      // Die Hände wechseln sich ab, und der gepackte Griff ist der Anker.
      {
        const { W, k } = frisch();
        raus.haende = [];
        for (let i = 0; i < 4; i += 1) {
          const g = naechster(W, k);
          const e = K.tippe(W, k, g.x, g.y);
          raus.haende.push({ hand: e.hand, anker: k.anker === g.nr, halt: k.halt[e.hand] === g.nr, sprung: e.sprung });
        }
        raus.hoch = { hoch: runden(k.hoch), soll: runden(W.griffe[k.anker].y - K.START_Y) };
      }
      // Weiter als der Arm: nur mit Schwung – und dann ist es ein Sprung.
      for (let versuch = 0; versuch < 40 && !raus.sprung; versuch += 1) {
        const { W, k } = frisch();
        const a = W.griffe[k.anker];
        const fern = W.griffe.find((g) => g.y > a.y && Math.hypot(g.x - a.x, g.y - a.y) > K.R_STAND + 0.03 && Math.hypot(g.x - a.x, g.y - a.y) < K.R_SPRUNG - 0.03);
        if (!fern) continue;
        const ohne = K.tippe(W, k, fern.x, fern.y);
        const davor = { art: ohne.art, zuege: k.zuege, aus: k.aus };
        k.schwung = 1;
        const mit = K.tippe(W, k, fern.x, fern.y);
        raus.sprung = { davor, art: mit.art, sprung: mit.sprung, schwung: runden(k.schwung), spruenge: k.spruenge };
      }
      // Die Kraft: Vor dem ersten Griff läuft nichts, danach ist sie nach
      // gut sechs Sekunden leer.
      {
        const { W, k } = frisch();
        for (let i = 0; i < 600; i += 1) K.schritt(W, k, 1 / 60);
        const vorher = k.kraft;
        const g = naechster(W, k);
        K.tippe(W, k, g.x, g.y);
        let n = 0;
        while (!k.aus && n < 60 * 20) { K.schritt(W, k, 1 / 60); n += 1; }
        raus.kraft = { vorher, aus: k.aus, sekunden: runden(n / 60) };
      }
      // Ein Griff, der bröckelt: Wer daran hängen bleibt, fällt mit ihm – wer
      // weitergeht, nicht. Ein Griff auf der Schiene steht still, sobald er
      // gepackt ist.
      const hin = (W, haupt, i) => {
        const k = K.neueKletterin();
        k.los = true;
        k.halt = [haupt[i - 2].nr, haupt[i - 1].nr];
        k.anker = haupt[i - 1].nr;
        k.hoch = haupt[i - 1].y - K.START_Y;
        return k;
      };
      for (let versuch = 0; versuch < 40 && !(raus.bruch && raus.pendel); versuch += 1) {
        const W = K.neueWand();
        K.wandBis(W, K.START_Y + 90);
        const haupt = W.griffe.filter((g) => g.haupt);
        const b = haupt.findIndex((g, i) => i > 2 && g.art === "bruch" && haupt[i + 1]?.art === "fest" && haupt[i + 2]?.art === "fest");
        const p = haupt.findIndex((g, i) => i > 2 && g.art === "pendel");
        if (b < 0 || p < 0) continue;
        {
          const k = hin(W, haupt, b);
          K.greife(W, k, haupt[b].nr, 2);
          const frist = haupt[b].bricht - k.t;
          let n = 0;
          while (!k.aus && n < 600) { k.kraft = 1; K.schritt(W, k, 1 / 60); n += 1; }
          raus.bruch = { aus: k.aus, frist: runden(frist), sekunden: runden(n / 60), weg: haupt[b].weg };
        }
        {
          // Dieselbe Stelle noch einmal, an einer zweiten Wand mit einem solchen Griff.
          const W2 = K.neueWand();
          K.wandBis(W2, K.START_Y + 90);
          const h2 = W2.griffe.filter((g) => g.haupt);
          const b2 = h2.findIndex((g, i) => i > 2 && g.art === "bruch" && h2[i + 1]?.art === "fest" && h2[i + 2]?.art === "fest");
          if (b2 < 0) { raus.bruch = null; continue; }
          const k = hin(W2, h2, b2);
          K.greife(W2, k, h2[b2].nr, 2);
          K.greife(W2, k, h2[b2 + 1].nr, 2);
          K.greife(W2, k, h2[b2 + 2].nr, 2);
          let gebrochen = 0;
          for (let n = 0; n < 300 && !k.aus; n += 1) { k.kraft = 1; K.schritt(W2, k, 1 / 60); gebrochen += K.bruchTakt(W2, k).length; }
          raus.weiter = { aus: k.aus, gebrochen, weg: h2[b2].weg };
        }
        {
          const g = haupt[p];
          const orte = [];
          for (let t = 0; t < 12; t += 0.1) orte.push(K.griffOrt(g, t).x);
          const k = hin(W, haupt, p);
          k.t = 1.7;
          const da = K.griffOrt(g, k.t).x;
          K.greife(W, k, g.nr, 1);
          raus.pendel = {
            drin: orte.every((x) => x >= g.x - g.weit - 1e-9 && x <= g.x + g.weit + 1e-9), weg: runden(Math.max(...orte) - Math.min(...orte)), weit: runden(g.weit),
            steht: [2, 3.3, 9].every((t) => Math.abs(K.griffOrt(g, t).x - da) < 1e-9),
          };
        }
      }
      // Der Pilot: genau auf den Bolzen, in festem Takt.
      const lauf = (tau) => {
        const { W, k } = frisch();
        let warte = 0;
        let t = 0;
        for (; t < 900 && !k.aus; t += 1 / 60) {
          warte -= 1 / 60;
          if (warte <= 0) {
            const g = K.pilot(W, k);
            if (g) { const o = K.griffOrt(g, k.t); K.tippe(W, k, o.x, o.y); }
            warte = tau;
          }
          K.schritt(W, k, 1 / 60);
          K.bruchTakt(W, k);
        }
        return { hoch: Math.round(k.hoch), aus: k.aus, sekunden: Math.round(t), zuege: k.zuege, perfekt: k.perfekt, spruenge: k.spruenge };
      };
      raus.schnell = [lauf(0.4), lauf(0.4)];
      raus.langsam = [lauf(1.3), lauf(1.3)];
      return raus;
    });
    pruefe(JSON.stringify(regeln.guete.map((e) => [e.art, e.guete])) === JSON.stringify([["griff", 2], ["griff", 1], ["griff", 0], ["daneben", null]])
      && regeln.guete[0].kraft === 0.62 && regeln.guete[1].kraft === 0.49 && regeln.guete[2].kraft === 0.35
      && regeln.guete[0].schwung === 0.3 && regeln.guete[1].schwung === 0.08 && regeln.guete[2].schwung === 0
      && regeln.guete[3].aus === "daneben" && regeln.guete[3].zuege === 0 && regeln.guete.slice(0, 3).every((e) => e.los && e.zuege === 1 && !e.aus),
      `Kletterwand: Die Güte eines Griffs zählt nicht, wie sie soll (perfekt, gut, knapp, daneben): ${JSON.stringify(regeln.guete)}`);
    pruefe(JSON.stringify(regeln.finger) === JSON.stringify({ ohne: [2, 1, 0, -1, -2], mit: [2, 1, 0, -1, -2] }),
      `Kletterwand: Die Mindestmasse für den Finger gelten nicht: ${JSON.stringify(regeln.finger)}`);
    pruefe(regeln.leer.art === "nichts" && regeln.leer.zuege === 0 && !regeln.leer.los, `Kletterwand: Ein Tipp neben alle Griffe tut etwas: ${JSON.stringify(regeln.leer)}`);
    pruefe(JSON.stringify(regeln.haende.map((e) => e.hand)) === "[0,1,0,1]" && regeln.haende.every((e) => e.anker && e.halt && !e.sprung) && regeln.hoch.hoch === regeln.hoch.soll,
      `Kletterwand: Die Hände wechseln sich nicht ab, oder die Meter stimmen nicht: ${JSON.stringify({ haende: regeln.haende, hoch: regeln.hoch })}`);
    pruefe(regeln.sprung && regeln.sprung.davor.art === "weit" && regeln.sprung.davor.zuege === 0 && !regeln.sprung.davor.aus
      && regeln.sprung.art === "griff" && regeln.sprung.sprung === true && regeln.sprung.schwung === 0.5 && regeln.sprung.spruenge === 1,
      `Kletterwand: Ein weiter Griff geht ohne Schwung, oder mit Schwung ist es kein Sprung: ${JSON.stringify(regeln.sprung)}`);
    pruefe(regeln.kraft.vorher === 1 && regeln.kraft.aus === "kraft" && regeln.kraft.sekunden > 5.5 && regeln.kraft.sekunden < 6.6,
      `Kletterwand: Die Kraft läuft nicht ab, wie sie soll: ${JSON.stringify(regeln.kraft)}`);
    pruefe(regeln.bruch && regeln.bruch.aus === "bruch" && regeln.bruch.weg && regeln.bruch.frist >= 1.25 && regeln.bruch.frist <= 3.2 && Math.abs(regeln.bruch.sekunden - regeln.bruch.frist) < 0.03,
      `Kletterwand: Wer an einem bröckelnden Griff hängen bleibt, fällt nicht mit ihm: ${JSON.stringify(regeln.bruch)}`);
    pruefe(regeln.weiter && regeln.weiter.aus === "" && regeln.weiter.gebrochen === 1 && regeln.weiter.weg,
      `Kletterwand: Wer von einem bröckelnden Griff weitergeht, fällt trotzdem – oder er bricht nicht hinter ihr: ${JSON.stringify(regeln.weiter)}`);
    pruefe(regeln.pendel && regeln.pendel.drin && regeln.pendel.weg > regeln.pendel.weit * 1.5 && regeln.pendel.steht,
      `Kletterwand: Der Griff auf der Schiene gleitet nicht, oder er steht nicht still, sobald er gepackt ist: ${JSON.stringify(regeln.pendel)}`);
    pruefe(regeln.schnell.every((r) => r.hoch >= 225 && r.hoch <= 330 && r.aus === "kraft" && r.sekunden <= 150 && r.perfekt === r.zuege && r.spruenge > 20),
      `Kletterwand: Der genaue Pilot kommt nicht weit über zweihundert Meter, oder die Runde endet nicht von selbst: ${JSON.stringify(regeln.schnell)}`);
    pruefe(regeln.langsam.every((r) => r.hoch >= 15 && r.hoch <= 75 && r.aus && r.sekunden <= 100),
      `Kletterwand: Wer zögert, kommt trotzdem weit – oder gar nicht vom Fleck: ${JSON.stringify(regeln.langsam)}`);

    // Das Spiel selbst, Bild für Bild gerechnet: Jeder Tipp auf die Stelle
    // des Bildes, an der ein Griff zu sehen ist, packt ihn – und das Bild
    // kommt nach: Sind die Züge abgearbeitet, liegen die Hände an den Griffen,
    // die gezählt wurden.
    const klettern = await seite.evaluate(() => {
      const K = window.LernappKletterwand;
      const st = K.state;
      document.querySelector(".cm-bar-left .cm-icon-again").click();
      K.halte(true);
      const auf = (g, f = 0) => { const o = K.griffOrt(g, st.k.t); const p = K.imBild([o.x, o.y + g.r * f, 0.042]); K.tipp(p.x, p.y); };
      const raus = { vorher: st.phase, krumm: 0, schief: 0, zuege: 0, gueten: [] };
      // Zuerst ein Tipp ins Leere: Die Runde beginnt erst mit dem ersten Griff.
      K.tipp(5, K.view.cssH - 5);
      raus.leer = st.phase;
      for (let n = 0; n < 400 && st.k.hoch < 45 && !st.endet; n += 1) {
        const davor = st.k.perfekt;
        auf(K.pilot(st.wand, st.k));
        if (st.k.perfekt === davor) raus.gueten.push(n);
        for (let i = 0; i < 30; i += 1) {
          K.takt(1 / 60);
          for (const q of [...K.fig.hand, ...K.fig.fuss]) if (!q.ort.every(Number.isFinite)) raus.krumm += 1;
          if (![...K.fig.brust, ...K.fig.becken].every(Number.isFinite)) raus.krumm += 1;
        }
        if (!K.fig.zug && !K.fig.warte.length) {
          for (let h = 0; h < 2; h += 1) {
            const soll = K.fassPunkt(st.wand.griffe[st.k.halt[h]], st.k.t);
            const ist = K.fig.hand[h].ort;
            if (Math.hypot(soll[0] - ist[0], soll[1] - ist[1], soll[2] - ist[2]) > 0.03 || K.fig.hand[h].nr !== st.k.halt[h]) raus.schief += 1;
          }
        }
      }
      K.zeichnen();
      raus.zuege = st.k.zuege;
      raus.stand = { phase: st.phase, hoch: st.k.hoch, punkte: st.punkte, perfekt: st.k.perfekt, endet: st.endet, becken: K.fig.becken[1], anker: st.wand.griffe[st.k.anker].y };
      // Daneben: Die Hand greift ins Leere, dann fällt sie ins Seil – und kein
      // Tipp zählt mehr.
      const g = K.pilot(st.wand, st.k);
      auf(g, 1.8);
      raus.daneben = { aus: st.k.aus, endet: st.endet > 0 };
      let tief = Infinity;
      for (let i = 0; i < 200; i += 1) { K.takt(1 / 60); tief = Math.min(tief, K.fig.becken[1]); }
      auf(K.pilot(st.wand, st.k) || g);
      raus.fall = { fang: Boolean(K.fig.fall?.fang), tief, start: K.fig.fall?.start?.[1], zuege: st.k.zuege, endlich: [...K.fig.brust, ...K.fig.becken, ...K.fig.hand[0].ort, ...K.fig.fuss[1].ort].every(Number.isFinite) };
      K.halte(false);
      return raus;
    });
    pruefe(klettern.vorher === "bereit" && klettern.leer === "bereit" && klettern.stand.phase === "spiel" && klettern.stand.hoch >= 45 && !klettern.stand.endet
      && klettern.stand.punkte === Math.floor(klettern.stand.hoch) && klettern.gueten.length === 0 && klettern.stand.perfekt === klettern.zuege,
      `Kletterwand: Ein Tipp auf den Bolzen im Bild packt den Griff nicht perfekt, oder die Meter zählen falsch: ${JSON.stringify(klettern)}`);
    pruefe(klettern.krumm === 0 && klettern.schief === 0 && klettern.stand.becken < klettern.stand.anker - 0.5 && klettern.stand.becken > klettern.stand.anker - 1.8,
      `Kletterwand: Das Bild kommt dem Zählen nicht nach – die Hände liegen nicht an ihren Griffen: ${JSON.stringify(klettern)}`);
    pruefe(klettern.daneben.aus === "daneben" && klettern.daneben.endet && klettern.fall.fang && klettern.fall.endlich && klettern.fall.zuege === klettern.zuege
      && klettern.fall.tief < klettern.fall.start - 2.5 && klettern.fall.tief > klettern.fall.start - 3.6,
      `Kletterwand: Wer daneben tippt, fällt nicht ins Seil – oder danach zählt noch ein Tipp: ${JSON.stringify({ daneben: klettern.daneben, fall: klettern.fall })}`);
    await seite.waitForSelector(".cm-result-score", { timeout: 8000 }).catch(() => {});
    const tafel = await seite.evaluate(() => ({
      phase: window.LernappKletterwand.state.phase,
      zahl: document.querySelectorAll(".cm-result-score").length,
      text: document.querySelector(".cm-result-detail")?.textContent || "",
    }));
    pruefe(tafel.phase === "ende" && tafel.zahl === 1 && /Neuer Rekord!/.test(tafel.text) && new RegExp(`${klettern.zuege} von ${klettern.zuege} Griffen perfekt`).test(tafel.text) && /Sprünge/.test(tafel.text),
      `Kletterwand: Nach dem Sturz kommt nicht die Tafel mit dem, was war: ${JSON.stringify(tafel)}`);

    // Ganz unten fällt sie nicht in den Boden, und wer nach dem ersten Griff
    // nichts mehr tut, dem geht die Kraft aus: Die Tafel nennt den Grund.
    const enden = await seite.evaluate(() => {
      const K = window.LernappKletterwand;
      const st = K.state;
      const auf = (g, f = 0) => { const o = K.griffOrt(g, st.k.t); const p = K.imBild([o.x, o.y + g.r * f, 0.042]); K.tipp(p.x, p.y); };
      const raus = {};
      document.querySelector(".cm-bar-left .cm-icon-again").click();
      K.halte(true);
      auf(K.pilot(st.wand, st.k), 1.8);
      let tief = Infinity;
      for (let i = 0; i < 240; i += 1) { K.takt(1 / 60); tief = Math.min(tief, K.fig.becken[1], K.fig.fuss[0].ort[1] + 0.5, K.fig.fuss[1].ort[1] + 0.5); }
      raus.unten = { aus: st.k.aus, fang: Boolean(K.fig.fall?.fang), tief, punkte: st.punkte };
      document.querySelector(".cm-bar-left .cm-icon-again").click();
      auf(K.pilot(st.wand, st.k));
      let n = 0;
      while (!st.endet && n < 60 * 12) { K.takt(1 / 60); n += 1; }
      raus.kraft = { aus: st.k.aus, sekunden: n / 60, fall: Boolean(K.fig.fall), zuege: st.k.zuege };
      K.halte(false);
      return raus;
    });
    pruefe(enden.unten.aus === "daneben" && enden.unten.fang && enden.unten.tief > 0.55 && enden.unten.punkte === 0,
      `Kletterwand: Wer ganz unten fällt, landet im Boden: ${JSON.stringify(enden.unten)}`);
    pruefe(enden.kraft.aus === "kraft" && enden.kraft.fall && enden.kraft.zuege === 1 && enden.kraft.sekunden > 5.5 && enden.kraft.sekunden < 6.6,
      `Kletterwand: Wer nichts mehr tut, dem geht die Kraft nicht aus: ${JSON.stringify(enden.kraft)}`);
    await seite.waitForSelector(".cm-result-score", { timeout: 8000 }).catch(() => {});
    const grund = await seite.locator(".cm-result-detail").innerText().catch(() => "");
    pruefe(/Die Kraft war am Ende/.test(grund) && /Bestwert \d+ m/.test(grund), `Kletterwand: Die Tafel nennt den Grund nicht: ${grund}`);
    await kontext.close();
  }
  {
    // Ein Lauf in echter Zeit – acht Griffe mit dem Finger, mal genau, mal
    // knapp, dann einer daneben –, aufgezeichnet und angeschaut: dieselbe
    // Wand, dieselben Griffe, am Schluss dieselbe Zahl.
    const { kontext, seite } = await neueSeite({ width: 420, height: 820 });
    await seite.addInitScript(() => {
      if (sessionStorage.getItem("__kletter")) return;
      sessionStorage.setItem("__kletter", "1");
      localStorage.setItem("mini.name", "Klara");
    });
    await seite.goto(`${BASIS}/kletterwand`, { waitUntil: "load" });
    await seite.waitForFunction(() => window.LernappKletterwand?.state?.wand && window.LernappKletterwand.view.cssW > 0, null, { timeout: 8000 });
    const welt = await seite.evaluate(() => window.LernappKletterwand.weltText());
    await seite.evaluate(() => new Promise((fertig) => {
      const K = window.LernappKletterwand;
      const st = K.state;
      const flaeche = document.querySelector("#kw-stage canvas");
      let naechster = 0;
      let n = 0;
      const lauf = () => {
        if (st.phase === "ende" || st.endet) { fertig(); return; }
        requestAnimationFrame(lauf);
        if (st.zeit < naechster) return;
        // Ohne Schwung den nächsten Griff der Hauptlinie – der ist immer da.
        const g = st.wand.griffe.find((q) => q.haupt && K.inReichweite(st.wand, st.k, q, K.R_STAND));
        if (!g) return;
        const o = K.griffOrt(g, st.k.t);
        const f = n >= 8 ? -1.8 : [0.1, 0.6, 1.0][n % 3];
        const p = K.imBild([o.x, o.y + g.r * f, 0.042]);
        const r = flaeche.getBoundingClientRect();
        flaeche.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, cancelable: true, pointerId: 1, isPrimary: true, pointerType: "touch", clientX: r.left + p.x, clientY: r.top + p.y }));
        n += 1;
        naechster = st.zeit + 0.4;
      };
      requestAnimationFrame(lauf);
    }));
    await seite.waitForSelector(".cm-result-score", { timeout: 40000 }).catch(() => {});
    await seite.waitForFunction(() => [...(window.__miniGeister?.keys?.() || [])].some((k) => k.startsWith("speedClimb_")), null, { timeout: 4000 }).catch(() => {});
    const gespielt = await seite.evaluate(() => {
      const kennung = localStorage.getItem("mini.id");
      const geist = window.__miniGeister?.get(`speedClimb_${kennung}`) || null;
      const st = window.LernappKletterwand.state;
      return { kennung, punkte: geist?.punkte ?? -1, gezaehlt: st.punkte, zuege: st.k.zuege, perfekt: st.k.perfekt, aus: st.k.aus, anker: st.k.anker };
    });
    pruefe(gespielt.kennung && gespielt.punkte === gespielt.gezaehlt && gespielt.punkte >= 3 && gespielt.zuege === 8 && gespielt.perfekt === 3 && gespielt.aus === "daneben",
      `Kletterwand: Der Lauf wird nicht hinterlegt: ${JSON.stringify(gespielt)}`);
    await seite.goto(`${BASIS}/kletterwand?zuschauen=${gespielt.kennung}`, { waitUntil: "load" });
    await seite.waitForFunction(() => window.LernappKletterwand?.state?.phase === "zuschauen", null, { timeout: 8000 }).catch(() => {});
    const zu = await seite.evaluate(() => ({ phase: window.LernappKletterwand.state.phase, welt: window.LernappKletterwand.weltText() }));
    pruefe(zu.phase === "zuschauen" && zu.welt === welt, `Kletterwand: Beim Zuschauen steht eine andere Wand da:\n  gespielt ${welt}\n  angeschaut ${JSON.stringify(zu)}`);
    // Beim Zuschauen greift niemand mit.
    await seite.mouse.click(210, 420);
    await seite.waitForSelector(".gz-tafel:not([hidden]) .gz-nochmal", { timeout: 40000 }).catch(() => {});
    const schluss = await seite.evaluate(() => {
      const K = window.LernappKletterwand;
      const st = K.state;
      return { punkte: st.punkte, zuege: st.k.zuege, perfekt: st.k.perfekt, anker: st.k.anker, endet: st.endet > 0, fall: Boolean(K.fig.fall), tafel: Boolean(document.querySelector(".gz-tafel:not([hidden]) .gz-nochmal")) };
    });
    pruefe(schluss.tafel && schluss.punkte === gespielt.punkte && schluss.zuege === 8 && schluss.perfekt === 3 && schluss.anker === gespielt.anker && schluss.endet && schluss.fall,
      `Kletterwand: Am Ende des angeschauten Laufs steht nicht dasselbe: ${JSON.stringify({ ...schluss, gespielt })}`);
    await kontext.close();
  }

  // --- 4g39. Freihand: zehn Blätter, der Strich am Ideal gemessen ----------------------
  // Jede Runde hat zwei leichte, vier mittlere und vier schwere Blätter, und
  // jedes passt mit Rand aufs Blatt. Wer die ideale Form selbst zeichnet,
  // bekommt hundert Punkte – wer sie verschiebt, nur die Hälfte zeichnet oder
  // einen zu kleinen Kreis abliefert, verliert, wie es die Tabelle sagt. Der
  // Strich wird als Linienzug aus höchstens 48 Punkten gewertet, der dem
  // Finger auf ein paar Zehntelmillimeter folgt. Ein Tupfer ist keine
  // Antwort, die Zeit läuft erst nach dem Tipp, und ist sie um, zählt der
  // Strich, wie er dasteht.
  {
    const { kontext, seite } = await neueSeite({ width: 420, height: 820 });
    await seite.goto(`${BASIS}/freihand`, { waitUntil: "load" });
    await seite.waitForFunction(() => window.LernappFreihand?.state?.blaetter && window.LernappFreihand.view.cssW > 0, null, { timeout: 8000 });
    const bau = await seite.evaluate(() => {
      const F = window.LernappFreihand;
      const raus = { runden: [], aussen: 0, nichtHundert: [], zweite: 0, welten: 0, arten: 0 };
      const welten = new Set();
      const gesehen = new Set();
      for (let runde = 0; runde < 6; runde += 1) {
        document.querySelector(".cm-bar-left .cm-icon-again").click();
        const b = F.state.blaetter;
        welten.add(F.weltText());
        raus.runden.push({ n: b.length, stufen: [0, 1, 2].map((s) => b.filter((a) => a.stufe === s).length).join("/"), arten: new Set(b.map((a) => a.art)).size, zeiten: b.every((a) => a.zeit === F.ZEITEN[a.stufe]) });
        b.forEach((a) => gesehen.add(a.art));
      }
      // Jede Art, zwanzigmal gewürfelt: alles liegt im Rand, und jede Form,
      // die gilt, gibt hundert Punkte.
      for (const art of [...F.LEICHT, ...F.MITTEL, ...F.SCHWER]) {
        for (let i = 0; i < 20; i += 1) {
          const a = F.lege(art, Math.random);
          if (art !== "kreisfrei") {
            const alle = [...a.teile.flatMap(F.teilPunkte), ...a.ziele[0]];
            if (alle.some((p) => p.x < F.RAND - 0.01 || p.x > F.BLATT - F.RAND + 0.01 || p.y < F.RAND - 0.01 || p.y > F.BLATT - F.RAND + 0.01)) raus.aussen += 1;
          }
          if (a.ziele.length > 1) raus.zweite += 1;
          for (const weg of a.ziele.length ? a.ziele : [F.kreisWeg({ x: 50, y: 52 }, 24, 1)]) {
            const m = F.messe(a, weg);
            if (m.punkte !== 100 || m.mm > 0.02) raus.nichtHundert.push(`${art}: ${m.mm}/${m.punkte}`);
          }
        }
      }
      raus.welten = welten.size;
      raus.arten = gesehen.size;
      return raus;
    });
    pruefe(bau.runden.every((r) => r.n === 10 && r.stufen === "2/4/4" && r.arten === 10 && r.zeiten) && bau.welten === 6 && bau.arten >= 13,
      `Freihand: Die Runden haben nicht ihre zwei, vier und vier Blätter, oder jede Runde ist dieselbe: ${JSON.stringify(bau)}`);
    pruefe(bau.aussen === 0 && bau.nichtHundert.length === 0 && bau.zweite > 20,
      `Freihand: Ein Blatt passt nicht, oder die ideale Form gibt keine hundert Punkte: ${JSON.stringify({ aussen: bau.aussen, zweite: bau.zweite, nichtHundert: bau.nichtHundert.slice(0, 6) })}`);

    const regeln = await seite.evaluate(() => {
      const F = window.LernappFreihand;
      const runden = (z) => Math.round(z * 100) / 100;
      const raus = {};
      // Die Tabelle: an ihren Knoten, und nie mehr Punkte für mehr Abweichung.
      raus.knoten = F.KNOTEN.map(([mm, p]) => F.punkteFuer(mm) === p);
      let faellt = true;
      for (let mm = 0.05; mm < 10; mm += 0.05) if (F.punkteFuer(mm) > F.punkteFuer(mm - 0.05)) faellt = false;
      raus.faellt = faellt;
      raus.mass = [F.punkteFuer(1), F.punkteFuer(1, 1.5), F.punkteFuer(1, 0.85), F.punkteFuer(Infinity), F.punkteFuer(NaN)];
      // Eine Gerade, vier Millimeter daneben: vier Millimeter Abweichung. Die
      // halbe Gerade: richtig gezeichnet und doch nur halb.
      const gerade = { art: "gerade", mass: 1, ziele: [[{ x: 20, y: 50 }, { x: 80, y: 50 }]], frei: null };
      raus.daneben = F.messe(gerade, [{ x: 20, y: 54 }, { x: 80, y: 54 }]);
      raus.halb = F.messe(gerade, [{ x: 20, y: 50 }, { x: 50, y: 50 }]);
      raus.zuviel = F.messe(gerade, [{ x: 20, y: 50 }, { x: 80, y: 50 }, { x: 80, y: 80 }]);
      raus.nichts = F.messe(gerade, null).punkte;
      // Zwei Formen gelten: Es zählt die, der der Strich näher ist.
      const zwei = { art: "quadrat", mass: 1, ziele: [[{ x: 30, y: 30 }, { x: 60, y: 30 }], [{ x: 30, y: 70 }, { x: 60, y: 70 }]], frei: null };
      raus.zwei = [F.messe(zwei, [{ x: 30, y: 70.5 }, { x: 60, y: 70.5 }]).mm, F.messe(zwei, [{ x: 30, y: 29 }, { x: 60, y: 29 }]).mm];
      // Der freie Kreis: gross und rund hundert, ein Ei weniger, zu klein
      // wenig – auch wenn er rund ist –, und ein halber fast nichts.
      const frei = { art: "kreisfrei", mass: F.MASS.kreisfrei, ziele: [], frei: { rMin: 18 } };
      const ei = F.kreisWeg({ x: 50, y: 50 }, 25, 0).map((p) => ({ x: 50 + (p.x - 50) * 1.12, y: p.y }));
      raus.frei = {
        rund: F.messe(frei, F.kreisWeg({ x: 40, y: 61 }, 25, 2)).punkte,
        ei: F.messe(frei, ei).punkte,
        klein: F.messe(frei, F.kreisWeg({ x: 50, y: 50 }, 9, 0)),
        halb: F.messe(frei, F.kreisWeg({ x: 50, y: 50 }, 25, 0, Math.PI)).punkte,
      };
      // Der Linienzug: ein zittriger Kreis aus 700 Stellen des Fingers.
      const roh = [];
      for (let i = 0; i <= 700; i += 1) {
        const w = (i / 700) * Math.PI * 2;
        const r = 27 + Math.sin(w * 3) * 0.8 + Math.sin(w * 11) * 0.3;
        roh.push({ x: 50 + Math.cos(w) * r, y: 50 + Math.sin(w) * r });
      }
      const s = F.schreiberNeu(roh[0]);
      for (let i = 1; i < roh.length; i += 1) F.schreibe(s, roh[i]);
      F.schliesse(s);
      let weit = 0;
      for (const p of roh) weit = Math.max(weit, F.naechster(p, s.punkte).weit);
      const gitter = s.punkte.every((p) => Math.abs(p.x * F.ZUG_MM - Math.round(p.x * F.ZUG_MM)) < 1e-6 && Math.abs(p.y * F.ZUG_MM - Math.round(p.y * F.ZUG_MM)) < 1e-6);
      raus.zug = { n: s.punkte.length, weit: runden(weit), gitter, zu: runden(Math.hypot(s.punkte[0].x - s.punkte[s.punkte.length - 1].x, s.punkte[0].y - s.punkte[s.punkte.length - 1].y)) };
      const g = F.schreiberNeu({ x: 10, y: 10 });
      for (let i = 1; i <= 300; i += 1) F.schreibe(g, { x: 10 + i * 0.25, y: 10 + i * 0.2 });
      F.schliesse(g);
      raus.strecke = g.punkte.length;
      // Gekritzel: nie mehr Punkte, als die Aufzeichnung fasst.
      const k = F.schreiberNeu({ x: 50, y: 50 });
      for (let i = 1; i <= 4000; i += 1) F.schreibe(k, { x: 50 + Math.sin(i * 0.37) * 30 * Math.sin(i * 0.011), y: 50 + Math.cos(i * 0.29) * 30 });
      F.schliesse(k);
      raus.gekritzel = k.punkte.length;
      for (const key of ["daneben", "halb", "zuviel"]) raus[key] = { mm: raus[key].mm, punkte: raus[key].punkte, hin: runden(raus[key].hin), her: runden(raus[key].her) };
      raus.frei.klein = { mm: raus.frei.klein.mm, punkte: raus.frei.klein.punkte };
      return raus;
    });
    pruefe(regeln.knoten.every(Boolean) && regeln.faellt && JSON.stringify(regeln.mass) === JSON.stringify([80, 66, 84, 0, 0]),
      `Freihand: Die Punkte fallen nicht nach der Tabelle: ${JSON.stringify({ knoten: regeln.knoten, faellt: regeln.faellt, mass: regeln.mass })}`);
    pruefe(Math.abs(regeln.daneben.mm - 4) < 0.02 && regeln.daneben.punkte === 24 && regeln.halb.hin < 0.01 && regeln.halb.her > 7 && regeln.halb.punkte < 40
      && regeln.zuviel.her < 0.01 && regeln.zuviel.hin > 4 && regeln.zuviel.punkte < 60 && regeln.nichts === 0,
      `Freihand: Verschoben, halb gezeichnet oder darüber hinaus – gemessen wird nicht in beide Richtungen: ${JSON.stringify({ daneben: regeln.daneben, halb: regeln.halb, zuviel: regeln.zuviel, nichts: regeln.nichts })}`);
    pruefe(Math.abs(regeln.zwei[0] - 0.5) < 0.02 && Math.abs(regeln.zwei[1] - 1) < 0.02, `Freihand: Von zwei Formen zählt nicht die nähere: ${JSON.stringify(regeln.zwei)}`);
    pruefe(regeln.frei.rund === 100 && regeln.frei.ei < 75 && regeln.frei.ei > 20 && regeln.frei.klein.mm >= 4.4 && regeln.frei.klein.punkte < 25 && regeln.frei.halb < 30,
      `Freihand: Der freie Kreis wird nicht an seiner Rundung und Grösse gemessen: ${JSON.stringify(regeln.frei)}`);
    pruefe(regeln.zug.n >= 12 && regeln.zug.n <= 48 && regeln.zug.weit <= 0.3 && regeln.zug.gitter && regeln.zug.zu < 0.1 && regeln.strecke === 2 && regeln.gekritzel <= 48,
      `Freihand: Der Linienzug folgt dem Finger nicht eng genug, oder er hat zu viele Punkte: ${JSON.stringify({ zug: regeln.zug, strecke: regeln.strecke, gekritzel: regeln.gekritzel })}`);

    // Eine Runde, Blatt um Blatt, mit dem Stift der Prüfung (stiftAb, stiftZu,
    // stiftAuf zeichnen wie ein Finger). Die Uhr wird vorgestellt, wo sonst
    // gewartet würde.
    const runde = await seite.evaluate(() => {
      const F = window.LernappFreihand;
      const st = F.state;
      document.querySelector(".cm-bar-left .cm-icon-again").click();
      // Feste Arten, wo die Prüfung etwas Bestimmtes zeichnet.
      ["gerade", "gerade", "kreis", "quadrat", "kreisfrei", "kreisfrei", "kreis"].forEach((art, i) => { st.blaetter[i] = F.lege(art, Math.random); });
      const form = (a) => F.abtasten(a.ziele[0] || F.kreisWeg({ x: 54, y: 54 }, 24, 0.3), 0.5);
      const zeichne = (pkte, absetzen = true) => {
        st.t0 -= 600;
        if (!F.stiftAb(pkte[0], 1, "pen")) return false;
        for (let i = 1; i < pkte.length; i += 1) F.stiftZu(pkte[i]);
        if (absetzen) F.stiftAuf();
        return true;
      };
      const stand = (i) => ({ phase: st.phase, punkte: st.liste[i]?.punkte ?? null, mm: st.liste[i]?.mm ?? null, strich: st.liste[i]?.strich?.length ?? null, summe: st.punkte });
      const raus = { vorher: st.phase };
      F.losGehts();
      raus.vorschau = { phase: st.phase, index: st.index, stift: F.stiftAb({ x: 50, y: 50 }, 1, "pen") };
      F.blattLos();
      raus.sperre = { phase: st.phase, stift: F.stiftAb({ x: 50, y: 50 }, 1, "pen") };
      // Blatt 1: die Gerade, genau.
      zeichne(form(st.blaetter[0]));
      raus.genau = stand(0);
      F.weiter();
      raus.naechstes = { phase: st.phase, index: st.index };
      // Blatt 2: erst ein Tupfer – dann die Gerade, vier Millimeter daneben.
      F.blattLos();
      const [a, b] = st.blaetter[1].ziele[0];
      const lang = Math.hypot(b.x - a.x, b.y - a.y);
      const n = { x: (-(b.y - a.y) / lang) * 4, y: ((b.x - a.x) / lang) * 4 };
      const mitte = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const seite = Math.hypot(mitte.x + n.x - 50, mitte.y + n.y - 50) < Math.hypot(mitte.x - n.x - 50, mitte.y - n.y - 50) ? 1 : -1;
      zeichne([a, { x: a.x + 2, y: a.y + 1 }]);
      raus.tupfer = { ...stand(1), verworfen: st.verworfen > 0, roh: st.roh.length };
      zeichne(F.abtasten([a, b], 0.5).map((p) => ({ x: p.x + n.x * seite, y: p.y + n.y * seite })));
      raus.daneben = { ...stand(1), soll: F.punkteFuer(st.liste[1]?.mm, F.MASS.gerade) };
      F.weiter();
      // Blatt 3: Die Zeit läuft ab, und niemand zeichnet.
      F.blattLos();
      st.t0 -= (st.blaetter[2].zeit + F.EINZUG + 0.2) * 1000;
      F.takt(0.016);
      raus.zeitUm = stand(2);
      F.weiter();
      // Blatt 4: Die Zeit läuft ab, mitten im Strich – er zählt, wie er dasteht.
      F.blattLos();
      const quadrat = form(st.blaetter[3]);
      zeichne(quadrat.slice(0, Math.floor(quadrat.length / 2)), false);
      const mitten = { zieht: st.zieht !== null, vorher: st.phase };
      st.t0 -= 30000;
      F.takt(0.016);
      raus.mitten = { ...stand(3), ...mitten };
      F.weiter();
      // Blatt 5 und 6: der freie Kreis – gross und rund, dann klein und rund.
      F.blattLos();
      zeichne(F.abtasten(F.kreisWeg({ x: 55, y: 56 }, 26, 1), 0.5));
      raus.rund = stand(4);
      F.weiter();
      F.blattLos();
      zeichne(F.abtasten(F.kreisWeg({ x: 55, y: 56 }, 9, 1), 0.5));
      raus.klein = stand(5);
      F.weiter();
      // Blatt 7: der halbe Kreis.
      F.blattLos();
      const kreis = form(st.blaetter[6]);
      zeichne(kreis.slice(0, Math.floor(kreis.length / 2)));
      raus.halb = stand(6);
      F.weiter();
      // Blatt 8: Wer nicht tippt, bekommt das Blatt nach dreissig Sekunden.
      const wartet = st.phase;
      st.vorSeit -= (F.VORSCHAU + 0.5) * 1000;
      F.takt(0.016);
      raus.vonSelbst = { wartet, phase: st.phase, index: st.index };
      zeichne(form(st.blaetter[7]));
      F.weiter();
      // Blatt 9 und 10: genau.
      for (const i of [8, 9]) { F.blattLos(); zeichne(form(st.blaetter[i])); if (i === 8) F.weiter(); }
      raus.letztes = stand(9);
      raus.liste = st.liste.map((e) => e?.punkte ?? null);
      F.weiter();
      raus.ende = { phase: st.phase, summe: st.punkte, genaue: st.genaue };
      return raus;
    });
    pruefe(runde.vorher === "bereit" && runde.vorschau.phase === "vorschau" && runde.vorschau.index === 0 && runde.vorschau.stift === false
      && runde.sperre.phase === "aufgabe" && runde.sperre.stift === false,
      `Freihand: In der Vorschau oder gleich nach dem Hinlegen lässt sich schon zeichnen: ${JSON.stringify({ vorher: runde.vorher, vorschau: runde.vorschau, sperre: runde.sperre })}`);
    pruefe(runde.genau.phase === "zeigen" && runde.genau.punkte === 100 && runde.genau.mm <= 0.03 && runde.genau.strich === 2 && runde.genau.summe === 100
      && runde.naechstes.phase === "vorschau" && runde.naechstes.index === 1,
      `Freihand: Die genaue Gerade gibt keine hundert Punkte, oder es geht nicht weiter: ${JSON.stringify({ genau: runde.genau, naechstes: runde.naechstes })}`);
    pruefe(runde.tupfer.phase === "aufgabe" && runde.tupfer.punkte === null && runde.tupfer.verworfen && runde.tupfer.roh === 0,
      `Freihand: Ein Tupfer zählt als Antwort: ${JSON.stringify(runde.tupfer)}`);
    pruefe(runde.daneben.phase === "zeigen" && Math.abs(runde.daneben.mm - 4) < 0.06 && runde.daneben.punkte === runde.daneben.soll && runde.daneben.punkte <= 12 && runde.daneben.summe === 100 + runde.daneben.punkte,
      `Freihand: Vier Millimeter daneben geben nicht, was die Tabelle sagt: ${JSON.stringify(runde.daneben)}`);
    pruefe(runde.zeitUm.phase === "zeigen" && runde.zeitUm.punkte === 0 && runde.zeitUm.strich === null,
      `Freihand: Ist die Zeit um und nichts gezeichnet, endet das Blatt nicht mit null Punkten: ${JSON.stringify(runde.zeitUm)}`);
    pruefe(runde.mitten.zieht && runde.mitten.vorher === "aufgabe" && runde.mitten.phase === "zeigen" && runde.mitten.strich >= 2 && runde.mitten.punkte < 70 && runde.mitten.mm > 1,
      `Freihand: Ist die Zeit mitten im Strich um, zählt er nicht, wie er dasteht: ${JSON.stringify(runde.mitten)}`);
    pruefe(runde.rund.punkte >= 99 && runde.klein.punkte < 25 && runde.halb.punkte < 30 && runde.halb.punkte >= 0,
      `Freihand: Der grosse runde Kreis, der zu kleine und der halbe werden nicht richtig gewertet: ${JSON.stringify({ rund: runde.rund, klein: runde.klein, halb: runde.halb })}`);
    pruefe(runde.vonSelbst.wartet === "vorschau" && runde.vonSelbst.phase === "aufgabe" && runde.vonSelbst.index === 7,
      `Freihand: Die Vorschau endet nicht von selbst: ${JSON.stringify(runde.vonSelbst)}`);
    const summe = runde.liste.reduce((s, p) => s + (p || 0), 0);
    pruefe(runde.liste.every((p) => p !== null) && runde.letztes.punkte === 100 && runde.ende.phase === "ende" && runde.ende.summe === summe && summe >= 500 && runde.ende.genaue >= 5,
      `Freihand: Nach dem zehnten Blatt ist die Runde nicht zu Ende, oder die Summe stimmt nicht: ${JSON.stringify({ liste: runde.liste, ende: runde.ende })}`);
    await seite.waitForSelector(".cm-result-score", { timeout: 6000 }).catch(() => {});
    const tafel = await seite.evaluate(() => ({ zahl: document.querySelectorAll(".cm-result-score").length, text: document.querySelector(".cm-result-detail")?.textContent || "" }));
    pruefe(tafel.zahl === 1 && /Neuer Rekord!/.test(tafel.text) && /Bestes Blatt: \S+.* 100/.test(tafel.text) && /mm daneben/.test(tafel.text) && /haargenau/.test(tafel.text),
      `Freihand: Die Tafel zeigt nicht, was war: ${JSON.stringify(tafel)}`);
    await kontext.close();
  }
  {
    // Mit der Maus: klicken beginnt, klicken legt das Blatt hin – und der
    // Strich entsteht unter dem Zeiger, bis die Taste losgelassen wird.
    const { kontext, seite } = await neueSeite({ width: 900, height: 700 });
    await seite.goto(`${BASIS}/freihand`, { waitUntil: "load" });
    await seite.waitForFunction(() => window.LernappFreihand?.state?.blaetter && window.LernappFreihand.view.cssW > 0, null, { timeout: 8000 });
    const ort = await seite.evaluate(() => {
      const F = window.LernappFreihand;
      F.state.blaetter[0] = F.lege("gerade", Math.random);
      const r = document.querySelector("#fh-stage canvas").getBoundingClientRect();
      const [a, b] = F.state.blaetter[0].ziele[0];
      const px = (p) => ({ x: r.left + F.view.x0 + p.x * F.view.s, y: r.top + F.view.y0 + p.y * F.view.s });
      return { a: px(a), b: px(b), mitte: px({ x: 50, y: 50 }) };
    });
    await seite.mouse.click(ort.mitte.x, ort.mitte.y);
    await seite.waitForFunction(() => window.LernappFreihand.state.phase === "vorschau", null, { timeout: 4000 }).catch(() => {});
    await seite.waitForTimeout(500);
    await seite.mouse.click(ort.mitte.x, ort.mitte.y);
    await seite.waitForFunction(() => window.LernappFreihand.state.phase === "aufgabe", null, { timeout: 4000 }).catch(() => {});
    await seite.waitForTimeout(900);
    // Ein blosser Klick ist keine Antwort.
    await seite.mouse.click(ort.a.x, ort.a.y);
    const nachKlick = await seite.evaluate(() => ({ phase: window.LernappFreihand.state.phase, offen: window.LernappFreihand.state.liste[0] === null }));
    await seite.mouse.move(ort.a.x, ort.a.y);
    await seite.mouse.down();
    await seite.mouse.move(ort.b.x, ort.b.y, { steps: 30 });
    const unterwegs = await seite.evaluate(() => ({ zieht: window.LernappFreihand.state.zieht !== null, roh: window.LernappFreihand.state.roh.length }));
    await seite.mouse.up();
    const maus = await seite.evaluate(() => { const st = window.LernappFreihand.state; return { phase: st.phase, punkte: st.liste[0]?.punkte ?? null, mm: st.liste[0]?.mm ?? null, eingabe: st.eingabe }; });
    pruefe(nachKlick.phase === "aufgabe" && nachKlick.offen && unterwegs.zieht && unterwegs.roh >= 20 && maus.phase === "zeigen" && maus.punkte >= 95 && maus.eingabe === "mouse",
      `Freihand: Mit der Maus entsteht der Strich nicht unter dem Zeiger, oder ein Klick ist schon die Antwort: ${JSON.stringify({ nachKlick, unterwegs, maus })}`);
    await kontext.close();
  }
  {
    // Eine Runde in echter Zeit – jedes Blatt zügig gezeichnet, mit einem
    // Zittern –, aufgezeichnet und angeschaut: dieselben Blätter, derselbe
    // Strich, dieselben Punkte je Blatt.
    const { kontext, seite } = await neueSeite({ width: 420, height: 820 });
    await seite.addInitScript(() => {
      if (sessionStorage.getItem("__freihand")) return;
      sessionStorage.setItem("__freihand", "1");
      localStorage.setItem("mini.name", "Frida");
    });
    await seite.goto(`${BASIS}/freihand`, { waitUntil: "load" });
    await seite.waitForFunction(() => window.LernappFreihand?.state?.blaetter && window.LernappFreihand.view.cssW > 0, null, { timeout: 8000 });
    const welt = await seite.evaluate(() => window.LernappFreihand.weltText());
    await seite.evaluate(() => new Promise((fertig) => {
      const F = window.LernappFreihand;
      const st = F.state;
      let plan = null;
      const lauf = (jetzt) => {
        if (st.phase === "ende") { fertig(); return; }
        requestAnimationFrame(lauf);
        if (st.phase === "bereit") { F.losGehts(); return; }
        if (st.phase === "vorschau") { if (jetzt - st.vorSeit > 450) { F.blattLos(); plan = null; } return; }
        if (st.phase === "zeigen") { if (jetzt - st.tZeig > 500) F.weiter(); plan = null; return; }
        if (st.phase !== "aufgabe") return;
        const a = st.blaetter[st.index];
        if (!plan) {
          const n = st.index;
          // Blatt 4 bleibt leer: Dort läuft die Zeit ab.
          const pkte = F.abtasten(a.ziele[0] || F.kreisWeg({ x: 52, y: 54 }, 24, 0.4), 0.7).map((p, i) => ({ x: p.x + Math.sin(n * 2.1) * 1.4 + Math.sin(i * 0.13 + n) * 0.6, y: p.y + Math.cos(n * 1.7) * 1.4 + Math.cos(i * 0.1) * 0.6 }));
          plan = { pkte, ab: jetzt + 450, i: 0 };
          if (n === 3) { plan.ab = Infinity; st.t0 -= (a.zeit - 0.4) * 1000; }
          return;
        }
        if (jetzt < plan.ab) return;
        const soll = Math.min(plan.pkte.length, Math.ceil(((jetzt - plan.ab) / 350) * plan.pkte.length));
        if (plan.i === 0 && soll > 0) { if (!F.stiftAb(plan.pkte[0], 1, "pen")) return; plan.i = 1; }
        while (plan.i < soll) { F.stiftZu(plan.pkte[plan.i]); plan.i += 1; }
        if (plan.i >= plan.pkte.length) { F.stiftAuf(); plan = null; }
      };
      requestAnimationFrame(lauf);
    }));
    await seite.waitForSelector(".cm-result-score", { timeout: 60000 }).catch(() => {});
    await seite.waitForFunction(() => [...(window.__miniGeister?.keys?.() || [])].some((k) => k.startsWith("freeHand_")), null, { timeout: 4000 }).catch(() => {});
    const gespielt = await seite.evaluate(() => {
      const kennung = localStorage.getItem("mini.id");
      const geist = window.__miniGeister?.get(`freeHand_${kennung}`) || null;
      const st = window.LernappFreihand.state;
      return { kennung, punkte: geist?.punkte ?? -1, bahn: String(geist?.bahn || geist?.lauf?.bahn || "").length, gezaehlt: st.punkte, liste: st.liste.map((e) => e?.punkte ?? null), ecken: st.liste.map((e) => e?.strich?.length ?? 0) };
    });
    pruefe(gespielt.kennung && gespielt.punkte === gespielt.gezaehlt && gespielt.punkte >= 300 && gespielt.liste[3] === 0 && gespielt.ecken[3] === 0
      && gespielt.liste.filter((p) => p > 0).length >= 8 && gespielt.ecken.every((n) => n <= 48),
      `Freihand: Die Runde wird nicht hinterlegt: ${JSON.stringify(gespielt)}`);
    await seite.goto(`${BASIS}/freihand?zuschauen=${gespielt.kennung}`, { waitUntil: "load" });
    await seite.waitForFunction(() => ["warten", "vorschau", "aufgabe", "zeigen"].includes(window.LernappFreihand?.state?.phase) && document.querySelector("#fh-stage")?.dataset.phase === "play", null, { timeout: 8000 }).catch(() => {});
    const zu = await seite.evaluate(() => ({ phase: window.LernappFreihand.state.phase, welt: window.LernappFreihand.weltText() }));
    pruefe(zu.welt === welt, `Freihand: Beim Zuschauen liegen andere Blätter da:\n  gespielt ${welt}\n  angeschaut ${JSON.stringify(zu)}`);
    // Beim Zuschauen zeichnet niemand mit.
    await seite.mouse.click(210, 420);
    await seite.waitForSelector(".gz-tafel:not([hidden]) .gz-nochmal", { timeout: 60000 }).catch(() => {});
    const schluss = await seite.evaluate(() => {
      const st = window.LernappFreihand.state;
      return { punkte: st.punkte, liste: st.liste.map((e) => e?.punkte ?? null), ecken: st.liste.map((e) => e?.strich?.length ?? 0), tafel: Boolean(document.querySelector(".gz-tafel:not([hidden]) .gz-nochmal")) };
    });
    pruefe(schluss.tafel && schluss.punkte === gespielt.punkte && JSON.stringify(schluss.liste) === JSON.stringify(gespielt.liste) && JSON.stringify(schluss.ecken) === JSON.stringify(gespielt.ecken),
      `Freihand: Am Ende der angeschauten Runde steht nicht dasselbe: ${JSON.stringify({ schluss, gespielt })}`);
    await kontext.close();
  }

  // --- 4g40. Kopfkino: elf Arten, jede Antwort nachgerechnet -----------------------------
  // Jede Runde hat drei leichte, vier mittlere und drei schwere Aufgaben –
  // zehn verschiedene Arten. Was als richtig gilt, wird hier auf einem
  // zweiten Weg nachgerechnet: das Blatt Feld für Feld nachgefaltet, das Netz
  // zum Würfel geschlossen, der Spielwürfel Kante um Kante gerollt, der
  // Stapel aus der Blickrichtung der Kamera vermessen, jeder Würfel in allen
  // 24 Lagen gegen das Netz gehalten, der Laser Zelle um Zelle verfolgt, das
  // Getriebe Rad um Rad gedreht. Gewertet wird richtig mal schnell; wo sich
  // eine Antwort aus Teilen setzt, zählt auch «fast».
  {
    const { kontext, seite } = await neueSeite({ width: 420, height: 820 });
    await seite.goto(`${BASIS}/kopfkino`, { waitUntil: "load" });
    await seite.waitForFunction(() => window.LernappKopfkino?.state?.aufgaben && window.LernappKopfkino.view.cssW > 0, null, { timeout: 8000 });
    const bau = await seite.evaluate(() => {
      const K = window.LernappKopfkino;
      const raus = { runden: [], welten: 0, fehler: {} };
      const merke = (was) => { raus.fehler[was] = (raus.fehler[was] || 0) + 1; };
      const welten = new Set();
      const arten = new Set();
      for (let runde = 0; runde < 6; runde += 1) {
        document.querySelector(".cm-bar-left .cm-icon-again").click();
        const a = K.state.aufgaben;
        welten.add(K.weltText());
        const oft = {};
        a.forEach((x) => { oft[x.art] = (oft[x.art] || 0) + 1; });
        for (const x of a) arten.add(x.art);
        raus.runden.push({ n: a.length, stufen: [0, 1, 2].map((s) => a.filter((x) => x.stufe === s).length).join("/"), meist: Math.max(...Object.values(oft)), zeiten: a.every((x) => x.zeit === K.ZEITEN[x.stufe]), schnittLeicht: a.some((x) => x.art === "schnitt" && x.stufe === 0), frage: a.every((x) => x.frage.length > 20) });
      }
      raus.welten = welten.size;
      raus.arten = arten.size;
      raus.alle = K.ARTEN.length;
      const bits = (x) => { let n = 0; for (let v = x >>> 0; v; v &= v - 1) n += 1; return n; };
      const kreuz = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
      const punkt = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
      const BLICK = [Math.PI / 2, 0, -Math.PI / 2, Math.PI];
      for (let lauf = 0; lauf < 40; lauf += 1) {
        for (const stufe of [0, 1, 2]) {
          // Falten: jedes Feld nachgefaltet – landet es auf einem Loch?
          const f = K.lege("falten", stufe, Math.random);
          let nach = 0;
          for (let x = 0; x < 4; x += 1) for (let y = 0; y < 4; y += 1) {
            let p = [x, y];
            for (const k of f.falten) {
              const n = k.nachher;
              if (k.achse === "x" && (p[0] < n.x0 || p[0] >= n.x1)) p = [2 * k.bei - 1 - p[0], p[1]];
              if (k.achse === "y" && (p[1] < n.y0 || p[1] >= n.y1)) p = [p[0], 2 * k.bei - 1 - p[1]];
            }
            if (f.loecher.some((l) => l[0] === p[0] && l[1] === p[1])) nach |= 1 << (y * 4 + x);
          }
          if (nach !== f.soll || f.falten.length !== stufe + 1 || bits(f.soll) !== f.loecher.length * 2 ** f.falten.length) merke("falten");
          // Netz: Es schliesst sich zum Würfel, jede Fläche schaut nach aussen.
          const n = K.lege("netz", stufe, Math.random);
          const zu = K.netzLage(n.felder, n.baum, Math.PI / 2);
          const [wx, wy] = n.felder[n.baum.wurzel];
          const aussen = zu.map((l) => kreuz(l.ex, l.ey).map(Math.round));
          zu.forEach((l, i) => {
            const m = [0, 1, 2].map((k) => l.o[k] + l.ex[k] / 2 + l.ey[k] / 2);
            if (Math.abs(punkt(aussen[i], [m[0] - wx - 0.5, m[1] - wy - 0.5, m[2] + 0.5]) - 0.5) > 1e-6) merke("netz Würfel");
          });
          if (new Set(aussen.map(String)).size !== 6) merke("netz Flächen");
          if (n.variante === "flaeche") {
            if (stufe === 2 || n.soll === n.stern || aussen[n.soll].some((x, k) => x !== -aussen[n.stern][k])) merke("netz gegenüber");
          } else {
            const ecke = (k, e) => { const l = zu[k.feld]; const [x, y] = n.felder[k.feld]; return [0, 1, 2].map((i) => Math.round(l.o[i] + l.ex[i] * (e[0] - x) + l.ey[i] * (e[1] - y))).join(","); };
            const name = (k) => [ecke(k, k.a), ecke(k, k.b)].sort().join("|");
            if (stufe !== 2 || n.kanten.length !== 14 || n.soll === n.rot || name(n.kanten[n.soll]) !== name(n.kanten[n.rot])) merke("netz Kante");
            if (n.kanten.filter((k) => name(k) === name(n.kanten[n.rot])).length !== 2) merke("netz Kantenpaar");
          }
          // Ansicht: die Spalten, aus der Blickrichtung der Kamera vermessen.
          const an = K.lege("ansicht", stufe, Math.random);
          const u = K.sicht(BLICK[an.richtung], 0).u;
          const hoch = new Map();
          an.hoehen.forEach((reihe, x) => reihe.forEach((h, y) => { const sx = Math.round((x + 0.5) * u[0] + (y + 0.5) * u[1] - 0.5 + 100); hoch.set(sx, Math.max(hoch.get(sx) || 0, h)); }));
          const gesehen = [...hoch.keys()].sort((x, y) => x - y).map((k) => hoch.get(k));
          let soll = 0;
          gesehen.forEach((h, i) => { soll |= h << (3 * i); });
          if (JSON.stringify(gesehen) !== JSON.stringify(an.spalten) || soll !== an.soll || new Set(an.spalten).size < 2 || (stufe === 2) !== (an.richtung >= 2)) merke("ansicht");
          // Dieselbe Figur: nur die richtige hat die Gestalt der oberen.
          const d = K.lege("drehen", stufe, Math.random);
          const g = K.gestalt(d.figur);
          if (d.bilder.length !== (stufe === 2 ? 4 : 3) || d.bilder.some((b, i) => (K.gestalt(b.wuerfel) === g) !== (i === d.soll)) || K.gestalt(d.figur.map((p) => [-p[0], p[1], p[2]])) === g) merke("drehen");
          // Rollen: Kante um Kante – oben liegt, was zuvor von der Richtung wegschaute.
          const ro = K.lege("rollen", stufe, Math.random);
          let m = ro.lage;
          let ort = [...ro.start];
          for (const [dx, dy] of ro.weg) {
            const erwartet = K.augeNach(m, [-dx, -dy, 0]);
            m = K.rollLage(m, dx, dy);
            ort = [ort[0] + dx, ort[1] + dy];
            if (K.augeNach(m, [0, 0, 1]) !== erwartet || ort.some((x) => x < 0 || x >= ro.n)) merke("rollen Regel");
          }
          if (K.augeNach(m, [0, 0, 1]) - 1 !== ro.soll || ro.weg.length !== [3, 5, 7][stufe] || K.augeNach(m, [0, 0, 1]) + K.augeNach(m, [0, 0, -1]) !== 7) merke("rollen");
          // Schnitt: die Ecken liegen auf Kanten des Würfels und in einer Ebene.
          if (stufe > 0) {
            const sc = K.lege("schnitt", stufe, Math.random);
            const nn = kreuz([0, 1, 2].map((k) => sc.punkte[1][k] - sc.punkte[0][k]), [0, 1, 2].map((k) => sc.punkte[2][k] - sc.punkte[0][k]));
            const aufKante = (p) => p.filter((x) => Math.abs(x) < 1e-9 || Math.abs(x - 1) < 1e-9).length >= 2 && p.every((x) => x > -1e-9 && x < 1 + 1e-9);
            if (sc.flaeche.length - 3 !== sc.soll || sc.flaeche.length < 3 || sc.flaeche.length > 6 || !sc.flaeche.every(aufKante) || sc.flaeche.some((p) => Math.abs(punkt(nn, [0, 1, 2].map((k) => p[k] - sc.punkte[0][k]))) > 1e-9)) merke("schnitt");
          }
          // --- Die fünf Arten der zweiten Fassung ---
          const mal = (m, v) => [0, 1, 2].map((k) => m[0][k] * v[0] + m[1][k] * v[1] + m[2][k] * v[2]);
          // Welcher Würfel: Jedes Bild wird in allen 24 Lagen gegen das
          // gefaltete Netz gehalten – nur das richtige gibt es wirklich.
          const mu = K.lege("muster", stufe, Math.random);
          const zuM = K.netzLage(mu.felder, mu.baum, Math.PI / 2);
          const seiten = [[0, 0, 1], [-1, 0, 0], [0, -1, 0]];
          const zeigt = (lage, belegung, dreh, richtung) => {
            const i = zuM.findIndex((l) => mal(lage, kreuz(l.ex, l.ey)).map(Math.round).join() === richtung.join());
            const q = ((dreh[i] % 4) + 4) % 4;
            const lokal = [zuM[i].ex, zuM[i].ey, zuM[i].ex.map((v) => -v), zuM[i].ey.map((v) => -v)][q];
            return { zeichen: belegung[i], hin: mal(lage, lokal).map(Math.round) };
          };
          const gleich = (a, b) => a.zeichen === b.zeichen && (mu.zeichen[a.zeichen].dreh === 1 || a.hin.join() === b.hin.join() || (mu.zeichen[a.zeichen].dreh === 2 && a.hin.join() === b.hin.map((v) => -v).join()));
          const gibtEs = (b) => K.LAGEN.some((lage) => seiten.every((richtung) => gleich(zeigt(lage, [0, 1, 2, 3, 4, 5], mu.lagen, richtung), zeigt(b.m, b.belegung, b.dreh, richtung))));
          if (mu.bilder.length !== (stufe === 0 ? 3 : 4) || mu.bilder.some((b, i) => gibtEs(b) !== (i === mu.soll)) || mu.zeichen.length !== 6 || new Set(mu.zeichen.map((z) => z.form)).size !== 6
            || mu.zeichen.some((z) => z.dreh > 1) !== (stufe === 2)) merke("muster");
          // Lücke: Nur das richtige Teil hat die Gestalt der Lücke, und jeder
          // fehlende Würfel ist von einer der drei Seiten her zu sehen.
          const lu = K.lege("luecke", stufe, Math.random);
          const fehlt = new Set(lu.weg.map(String));
          const zuSehen = lu.weg.every(([x, y, z]) => {
            let a = true, b = true, c = true;
            for (let i = 0; i < x; i += 1) if (!fehlt.has(`${i},${y},${z}`)) a = false;
            for (let i = 0; i < y; i += 1) if (!fehlt.has(`${x},${i},${z}`)) b = false;
            for (let i = z + 1; i < 3; i += 1) if (!fehlt.has(`${x},${y},${i}`)) c = false;
            return a || b || c;
          });
          const formen = lu.bilder.map((b) => K.gestalt(b.wuerfel));
          if (!zuSehen || fehlt.size !== lu.weg.length || lu.weg.some((p) => p.some((v) => v < 0 || v > 2)) || new Set(formen).size !== lu.bilder.length || lu.bilder.length !== (stufe === 0 ? 3 : 4)
            || lu.bilder.some((b, i) => (formen[i] === K.gestalt(lu.weg)) !== (i === lu.soll) || b.wuerfel.length !== lu.weg.length || b.passt !== (i === lu.soll))) merke("luecke");
          // Drehkörper: lauter verschiedene Formen, jede rechts der Achse und
          // gegen den Uhrzeigersinn umlaufen (so schaut ihr Mantel nach aussen).
          const dk = K.lege("drehkoerper", stufe, Math.random);
          const umlauf = (p) => p.reduce((summe, q, i) => { const n = p[(i + 1) % p.length]; return summe + (q[0] * n[1] - n[0] * q[1]) / 2; }, 0);
          if (dk.profile.length !== (stufe === 0 ? 3 : 4) || new Set(dk.profile.map((p) => p.map((q) => q.map((v) => v.toFixed(3)).join("/")).join(" "))).size !== dk.profile.length
            || dk.profile.some((p) => p.length < 3 || umlauf(p) < 0.05 || p.some((q) => q[0] < -1e-9 || q[0] > 1.08 || q[1] < -1e-9 || q[1] > 1.9))) merke("drehkoerper");
          // Laser: Zelle um Zelle verfolgt.
          const la = K.lege("laser", stufe, Math.random);
          {
            const n2 = la.n;
            const seite2 = Math.floor(la.ein / n2);
            const i2 = la.ein % n2;
            let x = seite2 === 0 || seite2 === 2 ? i2 : seite2 === 1 ? n2 - 1 : 0;
            let y = seite2 === 1 || seite2 === 3 ? i2 : seite2 === 2 ? n2 - 1 : 0;
            let dx = seite2 === 1 ? -1 : seite2 === 3 ? 1 : 0;
            let dy = seite2 === 0 ? 1 : seite2 === 2 ? -1 : 0;
            const getroffen = new Set();
            for (let schritt = 0; schritt < 500 && x >= 0 && y >= 0 && x < n2 && y < n2; schritt += 1) {
              const spiegel = la.spiegel[y * n2 + x];
              if (spiegel) { getroffen.add(y * n2 + x); [dx, dy] = spiegel === 1 ? [-dy, -dx] : [dy, dx]; }
              x += dx;
              y += dy;
            }
            const aus = y < 0 ? x : x >= n2 ? n2 + y : y >= n2 ? 2 * n2 + x : 3 * n2 + y;
            if (aus !== la.soll || la.soll === la.ein || n2 !== [4, 5, 6][stufe] || la.wahl !== 4 * n2 || getroffen.size < [2, 3, 5][stufe] || getroffen.size !== la.treffer) merke("laser");
          }
          // Zahnräder: die Richtung jedes Rades von seinem Antrieb her; kein Rad
          // berührt ein fremdes; und wo zwei ineinandergreifen, trifft ein Zahn
          // auf eine Lücke.
          const za = K.lege("zahnrad", stufe, Math.random);
          {
            const sinn = [1];
            let sollRaeder = 0;
            let gut = za.raeder[0].von === -1;
            za.raeder.forEach((o, i) => {
              if (i === 0) return;
              if (o.von < 0 || o.von >= i || !["zahn", "riemen", "kreuz"].includes(o.art)) { gut = false; return; }
              sinn[i] = o.art === "riemen" ? sinn[o.von] : -sinn[o.von];
              if (sinn[i] !== o.sinn) gut = false;
              if (sinn[i] === 1) sollRaeder |= 1 << (i - 1);
              za.raeder.slice(0, i).forEach((p, j) => {
                const weit = Math.hypot(o.x - p.x, o.y - p.y);
                const summe = (o.z + p.z) * 0.1;
                if (j === o.von && o.art === "zahn" ? Math.abs(weit - summe) > 1e-6 : weit < summe + 0.4) gut = false;
              });
              if (o.art === "zahn") {
                const e2 = za.raeder[o.von];
                const w = Math.atan2(o.y - e2.y, o.x - e2.x);
                const rest = ((w - e2.phase) * e2.z + (w + Math.PI - o.phase) * o.z - Math.PI) / (2 * Math.PI);
                if (Math.abs(rest - Math.round(rest)) > 1e-6 || Math.abs(o.tempo * o.z - e2.tempo * e2.z) > 1e-9) gut = false;
              }
            });
            const riemen = za.raeder.filter((o) => o.art === "riemen" || o.art === "kreuz").length;
            if (!gut || sollRaeder !== za.soll || za.felder !== za.raeder.length - 1 || bits(za.soll) < 1 || bits(za.soll) >= za.felder || za.raeder.length < [4, 6, 8][stufe]
              || (stufe === 0 && riemen !== 0) || (stufe === 2 && riemen !== 2)) merke("zahnrad");
          }
        }
      }
      // Die Wertung.
      const wahl = { eingabe: "wahl", soll: 2, zeit: 14 };
      raus.wertung = {
        zeit: [1, 14 * K.VOLL, 9.45, 14, 99].map((t) => K.punkteFuer(wahl, 2, t)),
        falsch: [K.punkteFuer(wahl, 1, 1), K.punkteFuer(wahl, null, 1)],
        felder: [0b0011, 0b0001, 0b0111, 0b1111, 0b1100, 0].map((x) => K.punkteFuer({ eingabe: "felder", soll: 0b0011, zeit: 14 }, x, 1)),
        spalten: [(2 << 0) | (1 << 3) | (3 << 6), (2 << 0) | (1 << 3) | (1 << 6), (1 << 0), 0].map((x) => K.punkteFuer({ eingabe: "spalten", n: 3, soll: (2 << 0) | (1 << 3) | (3 << 6), zeit: 14 }, x, 1)),
      };
      return raus;
    });
    pruefe(bau.runden.every((r) => r.n === 10 && r.stufen === "3/4/3" && r.meist === 1 && r.zeiten && !r.schnittLeicht && r.frage) && bau.welten === 6 && bau.alle === 11 && bau.arten >= 10,
      `Kopfkino: Die Runden haben nicht ihre drei, vier und drei Aufgaben aus zehn verschiedenen Arten, oder jede Runde ist dieselbe: ${JSON.stringify({ runden: bau.runden, arten: bau.arten, alle: bau.alle })}`);
    pruefe(Object.keys(bau.fehler).length === 0, `Kopfkino: Nachgerechnet stimmt die richtige Antwort nicht überall: ${JSON.stringify(bau.fehler)}`);
    pruefe(JSON.stringify(bau.wertung.zeit) === JSON.stringify([100, 100, 75, 50, 50]) && JSON.stringify(bau.wertung.falsch) === "[0,0]"
      && JSON.stringify(bau.wertung.felder) === JSON.stringify([100, 50, 50, 0, 0, 0])
      && JSON.stringify(bau.wertung.spalten) === JSON.stringify([100, 67, 0, 0]),
      `Kopfkino: Die Punkte fallen nicht, wie sie sollen (richtig mal schnell, «fast» für Teile): ${JSON.stringify(bau.wertung)}`);

    // Eine Runde, Aufgabe um Aufgabe, mit den Eingaben der Prüfung. Die Uhr
    // wird vorgestellt, wo sonst gewartet würde.
    const runde = await seite.evaluate(() => {
      const K = window.LernappKopfkino;
      const st = K.state;
      document.querySelector(".cm-bar-left .cm-icon-again").click();
      [["rollen", 0], ["falten", 1], ["ansicht", 1], ["netz", 2], ["drehen", 1], ["schnitt", 1], ["ansicht", 0], ["zahnrad", 1]].forEach(([art, stufe], i) => { st.aufgaben[i] = K.lege(art, stufe, Math.random); });
      // Beim Getriebe drehen mindestens zwei Räder mit – eines davon fehlt dann.
      while (K.loesung(st.aufgaben[7]).length < 3) st.aufgaben[7] = K.lege("zahnrad", 1, Math.random);
      const stand = (i) => ({ phase: st.phase, punkte: st.liste[i]?.punkte ?? null, anteil: st.liste[i]?.anteil ?? null, antwort: st.antwort, summe: st.punkte });
      const los = (sekunden = 1) => { K.aufgabeLos(); st.t0 -= (K.EINZUG + sekunden) * 1000; };
      const tue = (schritte) => { for (const [was, wert] of schritte) K.eingabe(was, wert); };
      const raus = { vorher: st.phase };
      K.losGehts();
      K.eingabe("wahl", st.aufgaben[0].soll);
      raus.vorschau = { phase: st.phase, index: st.index };
      K.aufgabeLos();
      K.eingabe("wahl", st.aufgaben[0].soll);
      raus.sperre = st.phase;
      // 1: der Würfel rollt – richtig, sofort.
      st.t0 -= 1500;
      tue(K.loesung(st.aufgaben[0]));
      raus.richtig = stand(0);
      K.weiter();
      raus.naechste = { phase: st.phase, index: st.index };
      // 2: Falten – «Fertig» ohne Eingabe zählt nicht; dann alle Löcher, und eines zu viel.
      los();
      K.eingabe("fertig");
      const leer = st.phase;
      const falt = st.aufgaben[1];
      let zuviel = 0;
      while ((falt.soll >> zuviel) & 1) zuviel += 1;
      tue([...K.loesung(falt).slice(0, -1), ["feld", zuviel], ["fertig", 0]]);
      raus.felder = { ...stand(1), soll: falt.soll, loecher: K.loesung(falt).length - 1, leer };
      K.weiter();
      // 3: Ansicht – richtig, aber spät.
      los(st.aufgaben[2].zeit * 0.9);
      const spaet = Math.round(100 * K.zeitFaktor(st.aufgaben[2], st.aufgaben[2].zeit * 0.9));
      K.eingabe("spalte", 1 * 8 + 2);
      K.eingabe("spalte", 1 * 8 + 2);
      const eins = (st.wert >> 3) & 7;
      st.wert = 0;
      tue(K.loesung(st.aufgaben[2]));
      raus.spaet = { ...stand(2), soll: spaet, eins };
      K.weiter();
      // 4: das Netz – die falsche Kante.
      los();
      K.eingabe("wahl", (st.aufgaben[3].soll + 1) % st.aufgaben[3].wahl === st.aufgaben[3].rot ? (st.aufgaben[3].soll + 2) % st.aufgaben[3].wahl : (st.aufgaben[3].soll + 1) % st.aufgaben[3].wahl);
      raus.falsch = stand(3);
      K.weiter();
      // 5: Die Zeit läuft ab, und niemand antwortet.
      los(st.aufgaben[4].zeit + 1);
      K.takt(0.016);
      raus.zeitUm = stand(4);
      K.weiter();
      // 6: der Schnitt – richtig.
      los();
      tue(K.loesung(st.aufgaben[5]));
      raus.schnitt = stand(5);
      K.weiter();
      // 7: Die Spalten stehen da, aber «Fertig» fehlt – die Zeit ist um: Sie zählen, spät.
      K.aufgabeLos();
      st.t0 -= 1000;
      tue(K.loesung(st.aufgaben[6]).slice(0, -1));
      st.t0 -= (st.aufgaben[6].zeit + 1) * 1000;
      K.takt(0.016);
      raus.ohneFertig = stand(6);
      K.weiter();
      // 8: das Getriebe – ein Rad, das mitdreht, fehlt: Es kostet seinen Anteil.
      los();
      const raeder = K.loesung(st.aufgaben[7]);
      tue(raeder.slice(1));
      raus.fehlt = { ...stand(7), k: raeder.length - 1 };
      K.weiter();
      // 9: Wer nicht tippt, bekommt die Aufgabe nach dreissig Sekunden.
      const wartet = st.phase;
      st.vorSeit -= (K.VORSCHAU + 0.5) * 1000;
      K.takt(0.016);
      raus.vonSelbst = { wartet, phase: st.phase, index: st.index };
      st.t0 -= 1500;
      tue(K.loesung(st.aufgaben[8]));
      K.weiter();
      los();
      tue(K.loesung(st.aufgaben[9]));
      raus.letzte = stand(9);
      raus.liste = st.liste.map((e) => e?.punkte ?? null);
      K.weiter();
      raus.ende = { phase: st.phase, summe: st.punkte, volle: st.volle };
      return raus;
    });
    pruefe(runde.vorher === "bereit" && runde.vorschau.phase === "vorschau" && runde.vorschau.index === 0 && runde.sperre === "aufgabe",
      `Kopfkino: In der Vorschau oder gleich nach dem Hinlegen zählt schon ein Tipp: ${JSON.stringify({ vorher: runde.vorher, vorschau: runde.vorschau, sperre: runde.sperre })}`);
    pruefe(runde.richtig.phase === "zeigen" && runde.richtig.punkte === 100 && runde.richtig.anteil === 1 && runde.naechste.phase === "vorschau" && runde.naechste.index === 1,
      `Kopfkino: Die richtige Antwort gibt keine hundert Punkte, oder es geht nicht weiter: ${JSON.stringify({ richtig: runde.richtig, naechste: runde.naechste })}`);
    pruefe(runde.felder.leer === "aufgabe" && runde.felder.punkte === Math.round((100 * (runde.felder.loecher - 1)) / runde.felder.loecher) && runde.felder.antwort !== runde.felder.soll
      && runde.fehlt.phase === "zeigen" && runde.fehlt.punkte === Math.round((100 * (runde.fehlt.k - 1)) / runde.fehlt.k),
      `Kopfkino: «Fertig» ohne Eingabe zählt, oder ein Feld zu viel (ein Rad zu wenig) kostet nicht eines: ${JSON.stringify({ felder: runde.felder, fehlt: runde.fehlt })}`);
    pruefe(runde.spaet.eins === 1 && runde.spaet.anteil === 1 && runde.spaet.punkte === runde.spaet.soll && runde.spaet.punkte >= 50 && runde.spaet.punkte <= 60,
      `Kopfkino: Eine späte richtige Antwort gibt nicht, was die Uhr sagt – oder die Spalten lassen sich nicht setzen: ${JSON.stringify(runde.spaet)}`);
    pruefe(runde.falsch.punkte === 0 && runde.falsch.phase === "zeigen" && runde.zeitUm.punkte === 0 && runde.zeitUm.antwort === null && runde.zeitUm.phase === "zeigen" && runde.schnitt.punkte === 100,
      `Kopfkino: Falsch oder Zeit um gibt nicht null Punkte: ${JSON.stringify({ falsch: runde.falsch, zeitUm: runde.zeitUm, schnitt: runde.schnitt })}`);
    pruefe(runde.ohneFertig.phase === "zeigen" && runde.ohneFertig.punkte === 50 && runde.ohneFertig.anteil === 1,
      `Kopfkino: Ist die Zeit um, zählt die Eingabe nicht, wie sie dasteht: ${JSON.stringify(runde.ohneFertig)}`);
    pruefe(runde.vonSelbst.wartet === "vorschau" && runde.vonSelbst.phase === "aufgabe" && runde.vonSelbst.index === 8,
      `Kopfkino: Die Vorschau endet nicht von selbst: ${JSON.stringify(runde.vonSelbst)}`);
    const summe = runde.liste.reduce((s, p) => s + (p || 0), 0);
    pruefe(runde.liste.every((p) => p !== null) && runde.letzte.punkte === 100 && runde.ende.phase === "ende" && runde.ende.summe === summe && runde.ende.volle === 4,
      `Kopfkino: Nach der zehnten Aufgabe ist die Runde nicht zu Ende, oder die Summe stimmt nicht: ${JSON.stringify({ liste: runde.liste, ende: runde.ende })}`);
    await seite.waitForSelector(".cm-result-score", { timeout: 6000 }).catch(() => {});
    const tafel = await seite.evaluate(() => ({ zahl: document.querySelectorAll(".cm-result-score").length, text: document.querySelector(".cm-result-detail")?.textContent || "" }));
    pruefe(tafel.zahl === 1 && /Neuer Rekord!/.test(tafel.text) && /6 von 10 richtig/.test(tafel.text) && /4 mit vollen Punkten/.test(tafel.text),
      `Kopfkino: Die Tafel zeigt nicht, was war: ${JSON.stringify(tafel)}`);
    await kontext.close();
  }
  {
    // Mit dem Finger: Was das Bild anbietet, lässt sich antippen – die Seite
    // des Würfels, die Felder des Blattes und «Fertig», die Fläche des Netzes.
    const { kontext, seite } = await neueSeite({ width: 420, height: 820 }, { handy: true });
    await seite.goto(`${BASIS}/kopfkino`, { waitUntil: "load" });
    await seite.waitForFunction(() => window.LernappKopfkino?.state?.aufgaben && window.LernappKopfkino.view.cssW > 0, null, { timeout: 8000 });
    await seite.evaluate(() => { const K = window.LernappKopfkino; [["rollen", 1], ["falten", 0], ["netz", 1]].forEach(([art, stufe], i) => { K.state.aufgaben[i] = K.lege(art, stufe, Math.random); }); });
    const tippeAuf = async (suche) => {
      const ort = await seite.evaluate((s) => {
        const K = window.LernappKopfkino;
        const r = document.querySelector("#kn-stage canvas").getBoundingClientRect();
        const stelle = K.stellen().find((x) => x.was === s.was && (s.wert === undefined || x.wert === s.wert));
        if (!stelle) return null;
        return stelle.r !== undefined ? { x: r.left + stelle.cx, y: r.top + stelle.cy } : { x: r.left + stelle.x + stelle.w / 2, y: r.top + stelle.y + stelle.h / 2 };
      }, suche);
      if (ort) await seite.touchscreen.tap(ort.x, ort.y);
      return Boolean(ort);
    };
    const mitte = { x: 210, y: 400 };
    const weiterZur = async (phase) => { await seite.touchscreen.tap(mitte.x, mitte.y); await seite.waitForFunction((p) => window.LernappKopfkino.state.phase === p, phase, { timeout: 5000 }).catch(() => {}); };
    await weiterZur("vorschau");
    await seite.waitForTimeout(450);
    await weiterZur("aufgabe");
    await seite.waitForTimeout(900);
    const soll0 = await seite.evaluate(() => window.LernappKopfkino.state.aufgaben[0].soll);
    const da0 = await tippeAuf({ was: "wahl", wert: soll0 });
    // Ein Bild später bietet die Auflösung nichts mehr zum Antippen an.
    await seite.waitForTimeout(200);
    const wuerfel = await seite.evaluate(() => { const st = window.LernappKopfkino.state; return { phase: st.phase, punkte: st.liste[0]?.punkte ?? null, stellen: window.LernappKopfkino.stellen().length }; });
    await seite.waitForTimeout(1300);
    await weiterZur("vorschau");
    await seite.waitForTimeout(450);
    await weiterZur("aufgabe");
    await seite.waitForTimeout(900);
    const felder = await seite.evaluate(() => { const K = window.LernappKopfkino; return K.loesung(K.state.aufgaben[1]); });
    let da1 = true;
    for (const [was, wert] of felder) da1 = (await tippeAuf(was === "fertig" ? { was } : { was, wert })) && da1;
    const blatt = await seite.evaluate(() => { const st = window.LernappKopfkino.state; return { phase: st.phase, punkte: st.liste[1]?.punkte ?? null, anteil: st.liste[1]?.anteil ?? null }; });
    await seite.waitForTimeout(1300);
    await weiterZur("vorschau");
    await seite.waitForTimeout(450);
    await weiterZur("aufgabe");
    await seite.waitForTimeout(900);
    const soll2 = await seite.evaluate(() => window.LernappKopfkino.state.aufgaben[2].soll);
    const da2 = await tippeAuf({ was: "wahl", wert: soll2 });
    const netz = await seite.evaluate(() => { const st = window.LernappKopfkino.state; return { phase: st.phase, punkte: st.liste[2]?.punkte ?? null }; });
    pruefe(da0 && wuerfel.phase === "zeigen" && wuerfel.punkte === 100 && wuerfel.stellen === 0 && da1 && blatt.phase === "zeigen" && blatt.anteil === 1 && blatt.punkte === 100
      && da2 && netz.phase === "zeigen" && netz.punkte === 100,
      `Kopfkino: Was das Bild anbietet, lässt sich mit dem Finger nicht antippen: ${JSON.stringify({ da0, wuerfel, da1, blatt, da2, netz })}`);
    await kontext.close();
  }
  {
    // Die fünf Arten der zweiten Fassung, eine nach der anderen mit dem Finger
    // gelöst: der Würfel, das Teil und der Körper gewählt, die Stelle am Rand,
    // die Räder und «Fertig».
    const { kontext, seite } = await neueSeite({ width: 420, height: 820 }, { handy: true });
    await seite.goto(`${BASIS}/kopfkino`, { waitUntil: "load" });
    await seite.waitForFunction(() => window.LernappKopfkino?.state?.aufgaben && window.LernappKopfkino.view.cssW > 0, null, { timeout: 8000 });
    const neue = [["muster", 1], ["luecke", 1], ["drehkoerper", 1], ["laser", 1], ["zahnrad", 1]];
    await seite.evaluate((liste) => { const K = window.LernappKopfkino; liste.forEach(([art, stufe], i) => { K.state.aufgaben[i] = K.lege(art, stufe, Math.random); }); }, neue);
    const tippeAuf = async (suche) => {
      const ort = await seite.evaluate((s) => {
        const K = window.LernappKopfkino;
        const r = document.querySelector("#kn-stage canvas").getBoundingClientRect();
        const stelle = K.stellen().find((x) => x.was === s.was && (s.wert === undefined || x.wert === s.wert));
        if (!stelle) return null;
        return stelle.r !== undefined ? { x: r.left + stelle.cx, y: r.top + stelle.cy } : { x: r.left + stelle.x + stelle.w / 2, y: r.top + stelle.y + stelle.h / 2 };
      }, suche);
      if (ort) await seite.touchscreen.tap(ort.x, ort.y);
      return Boolean(ort);
    };
    const weiterZur = async (phase) => { await seite.touchscreen.tap(210, 400); await seite.waitForFunction((p) => window.LernappKopfkino.state.phase === p, phase, { timeout: 5000 }).catch(() => {}); };
    const ergebnis = [];
    for (let i = 0; i < neue.length; i += 1) {
      await weiterZur("vorschau");
      await seite.waitForTimeout(450);
      await weiterZur("aufgabe");
      await seite.waitForTimeout(900);
      const schritte = await seite.evaluate((nr) => { const K = window.LernappKopfkino; return K.loesung(K.state.aufgaben[nr]); }, i);
      let da = true;
      for (const [was, wert] of schritte) da = (await tippeAuf(was === "fertig" ? { was } : { was, wert })) && da;
      await seite.waitForTimeout(200);
      ergebnis.push(await seite.evaluate(({ nr, da2 }) => { const st = window.LernappKopfkino.state; return { art: st.aufgaben[nr].art, da: da2, phase: st.phase, punkte: st.liste[nr]?.punkte ?? null, stellen: window.LernappKopfkino.stellen().length }; }, { nr: i, da2: da }));
      await seite.waitForTimeout(1300);
    }
    pruefe(ergebnis.length === 5 && ergebnis.every((x) => x.da && x.phase === "zeigen" && x.punkte === 100 && x.stellen === 0),
      `Kopfkino: Die neuen Arten lassen sich mit dem Finger nicht lösen: ${JSON.stringify(ergebnis)}`);
    await kontext.close();
  }
  {
    // Eine Runde in echter Zeit – die meisten Aufgaben richtig, eine falsch,
    // eine spät –, aufgezeichnet und angeschaut: dieselben Aufgaben, dieselben
    // Punkte je Aufgabe.
    const { kontext, seite } = await neueSeite({ width: 420, height: 820 });
    await seite.addInitScript(() => {
      if (sessionStorage.getItem("__kopfkino")) return;
      sessionStorage.setItem("__kopfkino", "1");
      localStorage.setItem("mini.name", "Kira");
    });
    await seite.goto(`${BASIS}/kopfkino`, { waitUntil: "load" });
    await seite.waitForFunction(() => window.LernappKopfkino?.state?.aufgaben && window.LernappKopfkino.view.cssW > 0, null, { timeout: 8000 });
    const welt = await seite.evaluate(() => window.LernappKopfkino.weltText());
    await seite.evaluate(() => new Promise((fertig) => {
      const K = window.LernappKopfkino;
      const st = K.state;
      let plan = null;
      const lauf = (jetzt) => {
        if (st.phase === "ende") { fertig(); return; }
        requestAnimationFrame(lauf);
        if (st.phase === "bereit") { K.losGehts(); return; }
        if (st.phase === "vorschau") { if (jetzt - st.vorSeit > 420) { K.aufgabeLos(); plan = null; } return; }
        if (st.phase === "zeigen") { if (jetzt - st.tZeig > 700) K.weiter(); plan = null; return; }
        if (st.phase !== "aufgabe") return;
        const a = st.aufgaben[st.index];
        if (!plan) {
          const schritte = K.loesung(a);
          // Aufgabe 3 falsch (oder ein Teil fehlt), Aufgabe 6 spät.
          if (st.index === 2) {
            if (a.eingabe === "wahl") schritte[0][1] = (a.soll + 1) % a.wahl === a.rot ? (a.soll + 2) % a.wahl : (a.soll + 1) % a.wahl;
            else schritte.shift();
          }
          if (st.index === 5) st.t0 -= a.zeit * 700;
          plan = { schritte, i: 0, ab: jetzt + 520 };
          return;
        }
        if (jetzt < plan.ab || plan.i >= plan.schritte.length) return;
        K.eingabe(plan.schritte[plan.i][0], plan.schritte[plan.i][1]);
        plan.i += 1;
        plan.ab = jetzt + 90;
      };
      requestAnimationFrame(lauf);
    }));
    await seite.waitForSelector(".cm-result-score", { timeout: 60000 }).catch(() => {});
    await seite.waitForFunction(() => [...(window.__miniGeister?.keys?.() || [])].some((k) => k.startsWith("mindsEye_")), null, { timeout: 4000 }).catch(() => {});
    const gespielt = await seite.evaluate(() => {
      const kennung = localStorage.getItem("mini.id");
      const geist = window.__miniGeister?.get(`mindsEye_${kennung}`) || null;
      const st = window.LernappKopfkino.state;
      return { kennung, punkte: geist?.punkte ?? -1, gezaehlt: st.punkte, liste: st.liste.map((e) => e?.punkte ?? null) };
    });
    pruefe(gespielt.kennung && gespielt.punkte === gespielt.gezaehlt && gespielt.punkte >= 600 && gespielt.liste[2] < 100 && gespielt.liste[5] > 50 && gespielt.liste[5] < 100
      && gespielt.liste.filter((p) => p === 100).length >= 7,
      `Kopfkino: Die Runde wird nicht hinterlegt: ${JSON.stringify(gespielt)}`);
    await seite.goto(`${BASIS}/kopfkino?zuschauen=${gespielt.kennung}`, { waitUntil: "load" });
    await seite.waitForFunction(() => ["warten", "vorschau", "aufgabe", "zeigen"].includes(window.LernappKopfkino?.state?.phase) && document.querySelector("#kn-stage")?.dataset.phase === "play", null, { timeout: 8000 }).catch(() => {});
    const zu = await seite.evaluate(() => ({ phase: window.LernappKopfkino.state.phase, welt: window.LernappKopfkino.weltText() }));
    pruefe(zu.welt === welt, `Kopfkino: Beim Zuschauen stehen andere Aufgaben da:\n  gespielt ${welt}\n  angeschaut ${JSON.stringify(zu)}`);
    // Beim Zuschauen antwortet niemand mit.
    await seite.mouse.click(210, 520);
    await seite.waitForSelector(".gz-tafel:not([hidden]) .gz-nochmal", { timeout: 60000 }).catch(() => {});
    const schluss = await seite.evaluate(() => {
      const st = window.LernappKopfkino.state;
      return { punkte: st.punkte, liste: st.liste.map((e) => e?.punkte ?? null), tafel: Boolean(document.querySelector(".gz-tafel:not([hidden]) .gz-nochmal")) };
    });
    pruefe(schluss.tafel && schluss.punkte === gespielt.punkte && JSON.stringify(schluss.liste) === JSON.stringify(gespielt.liste),
      `Kopfkino: Am Ende der angeschauten Runde steht nicht dasselbe: ${JSON.stringify({ schluss, gespielt })}`);
    await kontext.close();
  }

  {
    // Die Testrunde (?alle): jede Art in jeder Stufe, nacheinander – leicht,
    // mittel, schwer, dann die nächste Art. Sie zählt nicht: keine Tafel mit
    // Bestenliste, kein Eintrag, keine Aufzeichnung. ?alle=laser,zahnrad nimmt
    // nur diese Arten; im Turnier gibt es sie nicht.
    const { kontext, seite } = await neueSeite({ width: 420, height: 820 });
    await seite.addInitScript(() => localStorage.setItem("mini.name", "Kira"));
    await seite.goto(`${BASIS}/kopfkino?alle`, { waitUntil: "load" });
    await seite.waitForFunction(() => window.LernappKopfkino?.state?.aufgaben && window.LernappKopfkino.view.cssW > 0, null, { timeout: 8000 });
    const test = await seite.evaluate(() => {
      const K = window.LernappKopfkino;
      const st = K.state;
      const soll = K.ARTEN.flatMap((art) => [0, 1, 2].filter((stufe) => !(stufe === 0 && art === "schnitt")).map((stufe) => `${art}${stufe}`));
      const raus = { folge: st.aufgaben.map((a) => `${a.art}${a.stufe}`).join(" ") === soll.join(" "), zahl: st.aufgaben.length, liste: st.liste.length, speicher: localStorage.getItem("lernapp.kopfkino") };
      K.losGehts();
      // Jede Aufgabe richtig – bis auf die dritte und die zwanzigste.
      for (let i = 0; i < st.aufgaben.length; i += 1) {
        K.aufgabeLos();
        st.t0 -= 2000;
        const a = st.aufgaben[i];
        if ((i === 2 || i === 19) && a.eingabe === "wahl") K.eingabe("wahl", (a.soll + 1) % a.wahl);
        else if (i === 2 || i === 19) { K.eingabe(a.eingabe === "felder" ? "feld" : "spalte", a.eingabe === "spalten" ? 1 : [...Array(a.felder).keys()].find((f) => !((a.soll >> f) & 1))); K.eingabe("fertig"); }
        else for (const [was, wert] of K.loesung(a)) K.eingabe(was, wert);
        // Der Streifen zeigt die zehn, zu denen die Aufgabe gehört.
        K.zeichnen();
        K.weiter();
      }
      raus.ende = { phase: st.phase, punkte: st.punkte, richtig: st.liste.filter((e) => e && e.anteil >= 1).length, offen: st.liste.filter((e) => !e).length };
      raus.nachher = localStorage.getItem("lernapp.kopfkino");
      raus.geist = [...(window.__miniGeister?.keys?.() || [])].some((k) => k.startsWith("mindsEye_"));
      return raus;
    });
    await seite.waitForSelector(".cm-result-score", { timeout: 6000 }).catch(() => {});
    const testTafel = await seite.evaluate(() => ({
      label: document.querySelector(".cm-result-label")?.textContent || "",
      detail: document.querySelector(".cm-result-detail")?.textContent || "",
      liste: document.querySelectorAll(".mini-ergebnis, .mini-namensfeld").length,
      nochmal: document.querySelectorAll(".cm-overlay .cm-actions button").length,
    }));
    pruefe(test.folge && test.zahl === 32 && test.liste === 32 && test.ende.phase === "ende" && test.ende.offen === 0 && test.ende.richtig === 30,
      `Kopfkino: Die Testrunde hat nicht jede Art in jeder Stufe, der Reihe nach, oder sie endet nicht nach der letzten: ${JSON.stringify(test)}`);
    pruefe(testTafel.label === "Testrunde" && /30 von 32 richtig/.test(testTafel.detail) && /daneben: /.test(testTafel.detail) && /nichts gespeichert/.test(testTafel.detail)
      && testTafel.liste === 0 && testTafel.nochmal >= 1 && test.nachher === test.speicher && !test.geist,
      `Kopfkino: Die Testrunde zählt doch, oder ihre Tafel sagt nicht, was war: ${JSON.stringify({ testTafel, speicher: [test.speicher, test.nachher], geist: test.geist })}`);
    // Nur einzelne Arten – und eine, die es nicht gibt, ändert nichts.
    await seite.goto(`${BASIS}/kopfkino?alle=laser,zahnrad`, { waitUntil: "load" });
    await seite.waitForFunction(() => window.LernappKopfkino?.state?.aufgaben, null, { timeout: 8000 });
    const auswahl = await seite.evaluate(() => window.LernappKopfkino.state.aufgaben.map((a) => `${a.art}${a.stufe}`).join(" "));
    await seite.goto(`${BASIS}/kopfkino?alle=gibtsnicht`, { waitUntil: "load" });
    await seite.waitForFunction(() => window.LernappKopfkino?.state?.aufgaben, null, { timeout: 8000 });
    const unbekannt = await seite.evaluate(() => window.LernappKopfkino.state.aufgaben.length);
    await seite.goto(`${BASIS}/kopfkino`, { waitUntil: "load" });
    await seite.waitForFunction(() => window.LernappKopfkino?.state?.aufgaben, null, { timeout: 8000 });
    const normal = await seite.evaluate(() => ({ zahl: window.LernappKopfkino.state.aufgaben.length, test: window.LernappKopfkino.testrunde() }));
    pruefe(auswahl === "laser0 laser1 laser2 zahnrad0 zahnrad1 zahnrad2" && unbekannt === 32 && normal.zahl === 10 && normal.test === null,
      `Kopfkino: ?alle=laser,zahnrad nimmt nicht nur diese Arten, oder die gewöhnliche Runde ist keine mehr: ${JSON.stringify({ auswahl, unbekannt, normal })}`);
    await kontext.close();
  }

  {
    // Die Testrunden von Kopfkino, Freihand, Zeitgefühl und Augenmass (?alle):
    // jede Art einmal, der Reihe nach. Oben links der Knopf «Überspringen»
    // (und die Taste N): Er beginnt die Runde, springt von Aufgabe zu Aufgabe
    // und nach der letzten zur Tafel – die nichts einträgt. In einer
    // gewöhnlichen Runde gibt es ihn nicht.
    for (const [adresse, api, soll, schluessel] of [
      ["/kopfkino", "LernappKopfkino", 32, "lernapp.kopfkino"],
      ["/freihand", "LernappFreihand", 17, "lernapp.freihand"],
      ["/zeitgefuehl", "LernappZeitgefuehl", 12, "lernapp.zeitgefuehl"],
      ["/augenmass", "LernappAugenmass", 18, "lernapp.augenmass"],
    ]) {
      const { kontext, seite } = await neueSeite({ width: 420, height: 820 });
      await seite.addInitScript(() => localStorage.setItem("mini.name", "Kira"));
      await seite.goto(`${BASIS}${adresse}?alle`, { waitUntil: "load" });
      await seite.waitForFunction((a) => window[a]?.state?.phase === "bereit", api, { timeout: 8000 }).catch(() => {});
      const vorher = await seite.evaluate((a) => {
        const A = window[a];
        const liste = A.state.aufgaben || A.state.blaetter;
        const arten = liste.map((x) => x.art);
        // Die Reihenfolge: leicht, mittel, schwer – in Zeitgefühl Zeitlupe und
        // Zeitraffer, Doppelt und Halb je für sich; in Kopfkino jede Art in
        // ihren drei Stufen.
        let reihe = true;
        if (A.LEICHT) {
          const erwartet = [...A.LEICHT, ...A.MITTEL, ...A.SCHWER].flatMap((art) => (a === "LernappZeitgefuehl" && (art === "zeitlupe" || art === "doppelt") ? [art, art] : [art]));
          reihe = arten.join() === erwartet.join();
          if (a === "LernappZeitgefuehl") {
            const lupe = liste.filter((x) => x.art === "zeitlupe");
            const doppelt = liste.filter((x) => x.art === "doppelt");
            reihe = reihe && lupe[0].faktor < 1 && lupe[1].faktor > 1 && doppelt[0].mal === 2 && doppelt[1].mal === 0.5;
          }
        }
        return { zahl: liste.length, reihe, test: Boolean(A.testrunde()) };
      }, api);
      const speicher = await seite.evaluate((k) => localStorage.getItem(k), schluessel);
      const knopf = seite.locator(".cm-icon-weiter");
      const knoepfe = await knopf.count();
      if (knoepfe === 1) await knopf.click();
      const erste = await seite.evaluate((a) => ({ phase: window[a].state.phase, index: window[a].state.index }), api);
      if (knoepfe === 1) await knopf.click();
      const zweite = await seite.evaluate((a) => ({ index: window[a].state.index, weg: Boolean(window[a].state.liste[0]?.uebersprungen) }), api);
      for (let i = 1; i < soll; i += 1) await seite.keyboard.press("n");
      await seite.waitForSelector(".cm-result-score", { timeout: 6000 }).catch(() => {});
      const ende = await seite.evaluate(({ a, k }) => ({
        phase: window[a].state.phase,
        weg: window[a].state.liste.filter((e) => e?.uebersprungen).length,
        label: document.querySelector(".cm-result-label")?.textContent || "",
        detail: document.querySelector(".cm-result-detail")?.textContent || "",
        liste: document.querySelectorAll(".mini-ergebnis, .mini-namensfeld").length,
        speicher: localStorage.getItem(k),
      }), { a: api, k: schluessel });
      pruefe(vorher.zahl === soll && vorher.reihe && vorher.test && knoepfe === 1 && ["vorschau", "warten"].includes(erste.phase) && erste.index === 0 && zweite.index === 1 && zweite.weg
        && ende.phase === "ende" && ende.weg === soll && ende.label === "Testrunde" && ende.detail.includes(`${soll} übersprungen`) && ende.liste === 0 && ende.speicher === speicher,
        `${adresse}: Die Testrunde hat nicht jede Art der Reihe nach, oder «Überspringen» führt nicht bis zur Tafel, die nichts einträgt: ${JSON.stringify({ vorher, knoepfe, erste, zweite, ende })}`);
      // Eine gewöhnliche Runde: kein Knopf, keine Testrunde.
      await seite.goto(`${BASIS}${adresse}`, { waitUntil: "load" });
      await seite.waitForFunction((a) => window[a]?.state?.phase === "bereit", api, { timeout: 8000 }).catch(() => {});
      const normal = await seite.evaluate((a) => ({ test: window[a].testrunde(), knopf: document.querySelectorAll(".cm-icon-weiter").length }), api);
      pruefe(normal.test === null && normal.knopf === 0, `${adresse}: In einer gewöhnlichen Runde steht der Knopf «Überspringen»: ${JSON.stringify(normal)}`);
      await kontext.close();
    }
  }

  // --- 4g41. Eisstock: neun Arten von Bahnen, jede mit einem Schub mitten ins Ziel ---------
  // Jede Runde hat zwei leichte, vier mittlere und vier schwere Bahnen. Für
  // jede Art wird nachgerechnet, dass es einen Schub gibt, der (fast) mitten
  // im Ziel endet – und dass derselbe Schub immer am selben Ort endet. Dazu
  // die Regeln des Eises: halbe Kraft ist ein Viertel des Wegs, Schnee bremst,
  // Glatteis trägt, die Bande wirft zurück, der Hang zieht, und beim
  // Anstossen zählt der goldene Stock.
  {
    const { kontext, seite } = await neueSeite({ width: 420, height: 820 });
    await seite.goto(`${BASIS}/eisstock`, { waitUntil: "load" });
    await seite.waitForFunction(() => window.LernappEisstock?.state?.bahnen && window.LernappEisstock.view.cssW > 0, null, { timeout: 8000 });
    const bau = await seite.evaluate(() => {
      const E = window.LernappEisstock;
      const raus = { runden: [], welten: 0, schlecht: {}, ungleich: 0, dauer: 0 };
      const welten = new Set();
      for (let runde = 0; runde < 6; runde += 1) {
        document.querySelector(".cm-bar-left .cm-icon-again").click();
        const b = E.state.bahnen;
        welten.add(E.weltText());
        const oft = {};
        for (const x of b) oft[x.art] = (oft[x.art] || 0) + 1;
        raus.runden.push({
          stufen: b.map((x) => x.stufe).join(""),
          zeiten: b.every((x) => x.zeit === E.ZEITEN[x.stufe]),
          arten: Object.keys(oft).length,
          max: Math.max(...Object.values(oft)),
          drin: b.every((x) => x.ziel.x >= 1 && x.ziel.x <= E.BREIT - 1 && x.ziel.y >= 3 && x.ziel.y <= E.LANG - 1 && x.start.y === E.START_Y),
        });
      }
      raus.welten = welten.size;
      // Jede Art, je vier Bahnen: Es gibt einen Schub mitten ins Ziel.
      for (const art of E.ARTEN) {
        for (let i = 0; i < 4; i += 1) {
          const bahn = E.lege(art, Math.random);
          const best = E.loese(bahn, 3);
          if (best.punkte < 95) raus.schlecht[art] = (raus.schlecht[art] || 0) + 1;
          const eins = E.simuliere(bahn, best.winkel, best.kraft);
          const zwei = E.simuliere(bahn, best.winkel, best.kraft);
          if (eins.meter !== zwei.meter || eins.schritte !== zwei.schritte || eins.meter !== best.meter) raus.ungleich += 1;
          raus.dauer = Math.max(raus.dauer, eins.schritte * E.TAKT);
        }
      }
      // Die Regeln des Eises, auf einer leeren Bahn nachgemessen.
      const leer = (extra = {}) => ({ art: "gerade", stufe: 0, kurz: "", frage: "", zeit: 12, start: { x: 3, y: E.START_Y }, ziel: { x: 3, y: 7 }, stoecke: [], balken: [], zonen: [], hang: null, ...extra });
      const ende = (bahn, winkel, kraft) => {
        const e = E.simuliere(bahn, winkel, kraft);
        const s = e.welt.stoecke;
        return { x: s[0].x, y: s[0].y, weit: Math.hypot(s[0].x - bahn.start.x, s[0].y - bahn.start.y), meter: e.meter, andere: s.slice(1).map((o) => ({ x: o.x, y: o.y })) };
      };
      raus.weit = [0.3, 0.6, 0.8].map((k) => ende(leer(), 0, k).weit);
      raus.soll = [0.3, 0.6, 0.8].map((k) => k * k * E.WEIT);
      raus.blank = ende(leer(), 0, 0.7).weit;
      raus.schnee = ende(leer({ zonen: [{ art: "schnee", x: 3, y: 4, rx: 2, ry: 1 }] }), 0, 0.7).weit;
      raus.glatt = ende(leer({ zonen: [{ art: "glatt", x: 3, y: 4, rx: 2, ry: 1 }] }), 0, 0.7).weit;
      raus.bande = ende(leer(), Math.PI / 4, 0.8);
      raus.balken = ende(leer({ balken: [{ x0: 2, y0: 4, x1: 4, y1: 4.28 }] }), 0, 0.7);
      raus.hang = ende(leer({ hang: { x: 0.3, y: 0 } }), 0, 0.7);
      const stoss = leer({ stoecke: [{ x: 3, y: 4, gold: true }] });
      raus.stoss = ende(stoss, 0, 0.7);
      raus.stossSoll = Math.round(Math.hypot(raus.stoss.andere[0].x - 3, raus.stoss.andere[0].y - 7) * 1000) / 1000;
      raus.punkte = [0, 0.03, 0.1, 0.4, 1.1, 2.3, 4].map((m) => E.punkteFuer(m));
      raus.faellt = true;
      for (let m = 0; m < 3; m += 0.01) if (E.punkteFuer(m + 0.01) > E.punkteFuer(m)) raus.faellt = false;
      raus.zug = E.zugZu(E.zugVon(0.123456, 0.654321));
      return raus;
    });
    pruefe(bau.runden.length === 6 && bau.runden.every((r) => r.stufen === "0011112222" && r.zeiten && r.arten === 9 && r.max === 2 && r.drin) && bau.welten >= 5,
      `Eisstock: Die Runden haben nicht ihre zwei, vier und vier Bahnen, oder jede Runde ist dieselbe: ${JSON.stringify({ runden: bau.runden, welten: bau.welten })}`);
    pruefe(Object.keys(bau.schlecht).length === 0 && bau.ungleich === 0 && bau.dauer > 1.5 && bau.dauer < 8,
      `Eisstock: Nicht jede Bahn hat einen Schub mitten ins Ziel, oder derselbe Schub endet nicht am selben Ort: ${JSON.stringify({ schlecht: bau.schlecht, ungleich: bau.ungleich, dauer: bau.dauer })}`);
    pruefe(bau.weit.every((w, i) => Math.abs(w - bau.soll[i]) < 0.04) && bau.schnee < bau.blank - 1.5 && bau.glatt > bau.blank + 0.8,
      `Eisstock: Halbe Kraft ist nicht ein Viertel des Wegs, oder Schnee bremst nicht und Glatteis trägt nicht: ${JSON.stringify({ weit: bau.weit, soll: bau.soll, blank: bau.blank, schnee: bau.schnee, glatt: bau.glatt })}`);
    pruefe(bau.bande.x < 5.2 && bau.bande.x > 0.3 && bau.bande.y > 4.3 && bau.balken.y < 3.71 && bau.hang.x > 3.4,
      `Eisstock: Die Bande oder der Balken wirft den Stock nicht zurück, oder der Hang zieht nicht: ${JSON.stringify({ bande: bau.bande, balken: bau.balken, hang: bau.hang })}`);
    pruefe(bau.stoss.andere[0].y > 4.6 && bau.stoss.y < bau.stoss.andere[0].y - 0.6 && bau.stoss.y < 4 && bau.stoss.meter === bau.stossSoll,
      `Eisstock: Beim Anstossen fährt der goldene Stock nicht weiter, oder es zählt nicht er: ${JSON.stringify({ stoss: bau.stoss, soll: bau.stossSoll })}`);
    pruefe(JSON.stringify(bau.punkte) === JSON.stringify([100, 100, 92, 62, 24, 0, 0]) && bau.faellt && bau.zug.winkel === 0.1235 && bau.zug.kraft === 0.6543,
      `Eisstock: Die Punkte fallen nicht mit dem Abstand, oder ein Zug wird nicht auf Zehntausendstel gerundet: ${JSON.stringify({ punkte: bau.punkte, faellt: bau.faellt, zug: bau.zug })}`);

    // Eine Runde, Bahn um Bahn, mit den Zügen der Prüfung. Die Uhr wird
    // vorgestellt, wo sonst gewartet würde; die Fahrt läuft im Zeitraffer.
    const runde = await seite.evaluate(() => {
      const E = window.LernappEisstock;
      const st = E.state;
      document.querySelector(".cm-bar-left .cm-icon-again").click();
      ["gerade", "gerade", "schraeg", "schnee", "bande"].forEach((art, i) => { st.bahnen[i] = E.lege(art, Math.random); });
      const fahre = () => { for (let i = 0; i < 600 && st.phase === "fahrt"; i += 1) E.takt(0.2); };
      const los = (sekunden = 1) => { E.bahnLos(); st.t0 -= (E.EINZUG + sekunden) * 1000; };
      const mx = E.view.eis.x + E.view.eis.w / 2;
      const my = E.view.eis.y + E.view.eis.h / 2;
      // Ein Zug in Bildpunkten: vom Schub weg gezogen.
      const zieh = (winkel, kraft) => {
        const lang = kraft * E.view.zug;
        const hin = E.view.quer ? [Math.cos(winkel), Math.sin(winkel)] : [Math.sin(winkel), -Math.cos(winkel)];
        E.zielZu(mx - hin[0] * lang, my - hin[1] * lang);
      };
      const stand = (i) => ({ phase: st.phase, index: st.index, punkte: st.liste[i]?.punkte ?? null, meter: st.liste[i]?.meter ?? null, summe: st.punkte });
      const raus = { vorher: st.phase, quer: E.view.quer };
      E.losGehts();
      // In der Vorschau lässt sich nicht zielen – und gleich nach dem Hinlegen auch nicht.
      raus.vorschau = { phase: st.phase, zielt: E.zielBeginn(mx, my, 1) };
      E.bahnLos();
      raus.sperre = { phase: st.phase, zielt: E.zielBeginn(mx, my, 1) };
      st.t0 -= (E.EINZUG + 1) * 1000;
      // Gerade zurückgezogen heisst geradeaus, schräg heisst schräg – und die Länge ist die Kraft.
      raus.zielt = E.zielBeginn(mx, my, 1);
      E.zielZu(mx, my + E.view.zug * 0.5);
      raus.gerade = { winkel: st.zielen.winkel, kraft: st.zielen.kraft };
      E.zielZu(mx - 60, my + 60);
      raus.schraeg = { winkel: st.zielen.winkel, kraft: st.zielen.kraft, soll: Math.round((Math.hypot(60, 60) / E.view.zug) * 10000) / 10000 };
      E.zielZu(mx, my + E.view.zug * 3);
      raus.voll = st.zielen.kraft;
      // Ein Zug, der kaum einer ist, gilt nicht.
      E.zielZu(mx, my + E.view.zug * 0.03);
      E.zielEnde();
      raus.kaum = { ...stand(0), zielen: st.zielen };
      // Der beste Schub: mitten ins Ziel.
      const best = E.loese(st.bahnen[0], 3);
      E.zielBeginn(mx, my, 1);
      zieh(best.winkel, best.kraft);
      E.zielEnde();
      raus.schub = { phase: st.phase, gleich: st.schub?.winkel === best.winkel && st.schub?.kraft === best.kraft, unterwegs: E.zielBeginn(mx, my, 1) };
      fahre();
      raus.richtig = stand(0);
      E.weiter();
      raus.naechste = { phase: st.phase, index: st.index };
      // Bahn 2: viel zu kurz – es gibt, was der Abstand hergibt.
      los();
      const b1 = st.bahnen[1];
      E.schiebeAb(Math.atan2(b1.ziel.x - b1.start.x, b1.ziel.y - b1.start.y), Math.sqrt((Math.hypot(b1.ziel.x - b1.start.x, b1.ziel.y - b1.start.y) - 0.4) / E.WEIT));
      fahre();
      const s = st.welt.stoecke[0];
      raus.zuKurz = { ...stand(1), soll: E.punkteFuer(Math.round(Math.hypot(s.x - b1.ziel.x, s.y - b1.ziel.y) * 1000) / 1000) };
      E.weiter();
      // Bahn 3: Die Zeit läuft ab, ohne Zug.
      los();
      st.t0 -= st.bahnen[2].zeit * 1000;
      E.takt(0.016);
      raus.zeitUm = stand(2);
      E.weiter();
      // Bahn 4: Die Zeit läuft ab, während gespannt ist – der Zug gilt, wie er dasteht.
      los();
      const b3 = E.loese(st.bahnen[3], 3);
      E.zielBeginn(mx, my, 1);
      zieh(b3.winkel, b3.kraft);
      st.t0 -= st.bahnen[3].zeit * 1000;
      E.takt(0.016);
      raus.gespannt = { phase: st.phase, gleich: st.schub?.winkel === b3.winkel && st.schub?.kraft === b3.kraft };
      fahre();
      raus.gespanntEnde = stand(3);
      E.weiter();
      // Bahn 5: Die Vorschau endet von selbst.
      raus.vonSelbst = { wartet: st.phase };
      st.vorSeit -= E.VORSCHAU * 1000;
      E.takt(0.016);
      raus.vonSelbst.phase = st.phase;
      raus.vonSelbst.index = st.index;
      // Der Rest der Runde: je der beste Schub.
      for (let i = 4; i < E.BAHNEN; i += 1) {
        if (st.phase === "vorschau") E.bahnLos();
        const b = E.loese(st.bahnen[i], 3);
        E.schiebeAb(b.winkel, b.kraft);
        fahre();
        if (i === E.BAHNEN - 1) raus.letzte = stand(i);
        E.weiter();
      }
      raus.liste = st.liste.map((e) => e?.punkte ?? null);
      raus.ende = { phase: st.phase, summe: st.punkte, genaue: st.genaue };
      return raus;
    });
    pruefe(runde.vorher === "bereit" && !runde.quer && runde.vorschau.phase === "vorschau" && runde.vorschau.zielt === false && runde.sperre.phase === "aufgabe" && runde.sperre.zielt === false && runde.zielt === true,
      `Eisstock: In der Vorschau oder gleich nach dem Hinlegen lässt sich schon zielen: ${JSON.stringify({ vorher: runde.vorher, vorschau: runde.vorschau, sperre: runde.sperre, zielt: runde.zielt })}`);
    pruefe(runde.gerade.winkel === 0 && runde.gerade.kraft === 0.5 && Math.abs(runde.schraeg.winkel - Math.PI / 4) < 0.0001 && runde.schraeg.kraft === runde.schraeg.soll && runde.voll === 1,
      `Eisstock: Aus dem Zug des Fingers werden nicht Richtung und Kraft: ${JSON.stringify({ gerade: runde.gerade, schraeg: runde.schraeg, voll: runde.voll })}`);
    pruefe(runde.kaum.phase === "aufgabe" && runde.kaum.punkte === null && runde.kaum.zielen === null,
      `Eisstock: Ein Zug, der kaum einer ist, gilt als Schub: ${JSON.stringify(runde.kaum)}`);
    pruefe(runde.schub.phase === "fahrt" && runde.schub.gleich && runde.schub.unterwegs === false && runde.richtig.phase === "zeigen" && runde.richtig.punkte >= 95 && runde.richtig.meter < 0.08
      && runde.naechste.phase === "vorschau" && runde.naechste.index === 1,
      `Eisstock: Der beste Schub endet nicht mitten im Ziel, oder es geht nicht weiter: ${JSON.stringify({ schub: runde.schub, richtig: runde.richtig, naechste: runde.naechste })}`);
    pruefe(runde.zuKurz.phase === "zeigen" && runde.zuKurz.punkte === runde.zuKurz.soll && runde.zuKurz.punkte > 30 && runde.zuKurz.punkte < 80 && Math.abs(runde.zuKurz.meter - 0.4) < 0.03,
      `Eisstock: Ein zu kurzer Schub gibt nicht, was der Abstand hergibt: ${JSON.stringify(runde.zuKurz)}`);
    pruefe(runde.zeitUm.phase === "zeigen" && runde.zeitUm.punkte === 0 && runde.zeitUm.meter === null,
      `Eisstock: Zeit um ohne Zug gibt nicht null Punkte: ${JSON.stringify(runde.zeitUm)}`);
    pruefe(runde.gespannt.phase === "fahrt" && runde.gespannt.gleich && runde.gespanntEnde.phase === "zeigen" && runde.gespanntEnde.punkte >= 95,
      `Eisstock: Ist die Zeit um, gilt der Zug nicht, wie er gespannt ist: ${JSON.stringify({ gespannt: runde.gespannt, ende: runde.gespanntEnde })}`);
    pruefe(runde.vonSelbst.wartet === "vorschau" && runde.vonSelbst.phase === "aufgabe" && runde.vonSelbst.index === 4,
      `Eisstock: Die Vorschau endet nicht von selbst: ${JSON.stringify(runde.vonSelbst)}`);
    const summe = runde.liste.reduce((s, p) => s + (p || 0), 0);
    pruefe(runde.liste.every((p) => p !== null) && runde.letzte.punkte >= 95 && runde.ende.phase === "ende" && runde.ende.summe === summe && runde.ende.genaue === 8,
      `Eisstock: Nach der zehnten Bahn ist die Runde nicht zu Ende, oder die Summe stimmt nicht: ${JSON.stringify({ liste: runde.liste, ende: runde.ende })}`);
    await seite.waitForSelector(".cm-result-score", { timeout: 6000 }).catch(() => {});
    const tafel = await seite.evaluate(() => ({ zahl: document.querySelectorAll(".cm-result-score").length, text: document.querySelector(".cm-result-detail")?.textContent || "" }));
    pruefe(tafel.zahl === 1 && /Neuer Rekord!/.test(tafel.text) && /im Schnitt \d+ cm daneben/.test(tafel.text) && /8 auf den Punkt/.test(tafel.text),
      `Eisstock: Die Tafel zeigt nicht, was war: ${JSON.stringify(tafel)}`);
    await kontext.close();
  }
  {
    // Mit dem Zeiger: tippen, um zu beginnen und die Bahn hinzulegen – dann
    // aufsetzen, zurückziehen, loslassen. Hochkant fährt der Stock nach oben,
    // quer nach rechts.
    for (const [viewport, was] of [[{ width: 420, height: 820 }, "hochkant"], [{ width: 1280, height: 720 }, "quer"]]) {
      const { kontext, seite } = await neueSeite(viewport);
      await seite.goto(`${BASIS}/eisstock`, { waitUntil: "load" });
      await seite.waitForFunction(() => window.LernappEisstock?.state?.bahnen && window.LernappEisstock.view.cssW > 0, null, { timeout: 8000 });
      await seite.evaluate(() => { const E = window.LernappEisstock; E.state.bahnen[0] = E.lege("gerade", Math.random); });
      const ort = await seite.evaluate(() => {
        const E = window.LernappEisstock;
        const r = document.querySelector("#es-stage canvas").getBoundingClientRect();
        const e = E.view.eis;
        return { x: r.left + e.x + e.w / 2, y: r.top + e.y + e.h / 2, zug: E.view.zug, quer: E.view.quer };
      });
      const zur = async (phase) => { await seite.mouse.click(ort.x, ort.y); await seite.waitForFunction((p) => window.LernappEisstock.state.phase === p, phase, { timeout: 5000 }).catch(() => {}); };
      await zur("vorschau");
      await seite.waitForTimeout(450);
      await zur("aufgabe");
      await seite.waitForTimeout(900);
      const vorher = await seite.evaluate(() => { const E = window.LernappEisstock; const s = E.state.welt.stoecke[0]; return E.imBild(s.x, s.y); });
      // Vom Schub weg gezogen: hochkant nach unten, quer nach links.
      const lang = Math.round(ort.zug * 0.55);
      const bis = ort.quer ? { x: ort.x - lang, y: ort.y } : { x: ort.x, y: ort.y + lang };
      await seite.mouse.move(ort.x, ort.y);
      await seite.mouse.down();
      await seite.mouse.move(bis.x, bis.y, { steps: 12 });
      const gespannt = await seite.evaluate(() => { const z = window.LernappEisstock.state.zielen; return z ? { winkel: z.winkel, kraft: z.kraft } : null; });
      await seite.mouse.up();
      await seite.waitForFunction(() => window.LernappEisstock.state.phase === "zeigen", null, { timeout: 12000 }).catch(() => {});
      const danach = await seite.evaluate(() => {
        const E = window.LernappEisstock;
        const s = E.state.welt.stoecke[0];
        return { phase: E.state.phase, schub: E.state.schub, ort: E.imBild(s.x, s.y), eintrag: E.state.liste[0] };
      });
      const soll = Math.round((lang / ort.zug) * 10000) / 10000;
      const gefahren = ort.quer ? danach.ort[0] - vorher[0] : vorher[1] - danach.ort[1];
      pruefe(ort.quer === (was === "quer") && gespannt && Math.abs(gespannt.winkel) < 0.0001 && gespannt.kraft === soll && danach.phase === "zeigen" && danach.schub?.kraft === soll
        && gefahren > 60 && danach.eintrag && danach.eintrag.meter !== null,
        `Eisstock (${was}): Der Stock lässt sich nicht mit dem Zeiger spannen und schieben: ${JSON.stringify({ ort, gespannt, danach, soll, gefahren })}`);
      await kontext.close();
    }
  }
  {
    // Eine Runde in echter Zeit – die meisten Bahnen mit dem besten Schub,
    // eine mit halber Kraft, eine ohne Schub (Zeit um), eine mit einem Zug,
    // der erst nicht gilt –, aufgezeichnet und angeschaut: dieselben Bahnen,
    // dieselben Punkte je Bahn.
    const { kontext, seite } = await neueSeite({ width: 420, height: 820 });
    await seite.addInitScript(() => {
      if (sessionStorage.getItem("__eisstock")) return;
      sessionStorage.setItem("__eisstock", "1");
      localStorage.setItem("mini.name", "Kira");
    });
    await seite.goto(`${BASIS}/eisstock`, { waitUntil: "load" });
    await seite.waitForFunction(() => window.LernappEisstock?.state?.bahnen && window.LernappEisstock.view.cssW > 0, null, { timeout: 8000 });
    const welt = await seite.evaluate(() => window.LernappEisstock.weltText());
    await seite.evaluate(() => new Promise((fertig) => {
      const E = window.LernappEisstock;
      const st = E.state;
      const mx = E.view.eis.x + E.view.eis.w / 2;
      const my = E.view.eis.y + E.view.eis.h / 2;
      const zieh = (winkel, kraft) => {
        const lang = kraft * E.view.zug;
        const hin = E.view.quer ? [Math.cos(winkel), Math.sin(winkel)] : [Math.sin(winkel), -Math.cos(winkel)];
        E.zielZu(mx - hin[0] * lang, my - hin[1] * lang);
      };
      let plan = null;
      const lauf = (jetzt) => {
        if (st.phase === "ende") { fertig(); return; }
        requestAnimationFrame(lauf);
        if (st.phase === "bereit") { E.losGehts(); return; }
        if (st.phase === "vorschau") { if (jetzt - st.vorSeit > 420) { E.bahnLos(); plan = null; } return; }
        if (st.phase === "zeigen") { if (jetzt - st.tZeig > 500) E.weiter(); plan = null; return; }
        if (st.phase !== "aufgabe") return;
        if (!plan) {
          const best = E.loese(st.bahnen[st.index], 2);
          // Bahn 3 mit halber Kraft, Bahn 6 ohne Schub, Bahn 8 erst ein Zug, der nicht gilt.
          if (st.index === 2) best.kraft = Math.round(best.kraft * 5000) / 10000;
          plan = { best, schritt: 0, ab: performance.now() + 380, kaum: st.index === 7 };
          if (st.index === 5) { st.t0 -= st.bahnen[5].zeit * 1000; plan.schritt = 9; }
          return;
        }
        if (jetzt < plan.ab || plan.schritt === 9) return;
        if (plan.schritt === 0) { if (E.zielBeginn(mx, my, 1)) plan.schritt = 1; plan.ab = jetzt + 60; return; }
        if (plan.schritt === 1) { zieh(plan.best.winkel, plan.kaum ? 0.03 : plan.best.kraft * 0.6); plan.schritt = 2; plan.ab = jetzt + 230; return; }
        if (plan.schritt === 2 && plan.kaum) { E.zielEnde(); plan.kaum = false; plan.schritt = 0; plan.ab = jetzt + 150; return; }
        if (plan.schritt === 2) { zieh(plan.best.winkel, plan.best.kraft); plan.schritt = 3; plan.ab = jetzt + 120; return; }
        E.zielEnde();
        plan.schritt = 9;
      };
      requestAnimationFrame(lauf);
    }));
    await seite.waitForSelector(".cm-result-score", { timeout: 90000 }).catch(() => {});
    await seite.waitForFunction(() => [...(window.__miniGeister?.keys?.() || [])].some((k) => k.startsWith("iceStock_")), null, { timeout: 4000 }).catch(() => {});
    const gespielt = await seite.evaluate(() => {
      const kennung = localStorage.getItem("mini.id");
      const geist = window.__miniGeister?.get(`iceStock_${kennung}`) || null;
      const st = window.LernappEisstock.state;
      return { kennung, punkte: geist?.punkte ?? -1, gezaehlt: st.punkte, liste: st.liste.map((e) => e?.punkte ?? null), meter: st.liste.map((e) => e?.meter ?? null) };
    });
    pruefe(gespielt.kennung && gespielt.punkte === gespielt.gezaehlt && gespielt.punkte >= 700 && gespielt.liste[2] < 60 && gespielt.liste[5] === 0 && gespielt.meter[5] === null
      && gespielt.liste.filter((p) => p >= 92).length >= 8,
      `Eisstock: Die Runde wird nicht hinterlegt: ${JSON.stringify(gespielt)}`);
    await seite.goto(`${BASIS}/eisstock?zuschauen=${gespielt.kennung}`, { waitUntil: "load" });
    await seite.waitForFunction(() => ["warten", "vorschau", "aufgabe", "fahrt", "zeigen"].includes(window.LernappEisstock?.state?.phase) && document.querySelector("#es-stage")?.dataset.phase === "play", null, { timeout: 8000 }).catch(() => {});
    const zu = await seite.evaluate(() => ({ phase: window.LernappEisstock.state.phase, welt: window.LernappEisstock.weltText() }));
    pruefe(zu.welt === welt, `Eisstock: Beim Zuschauen liegen andere Bahnen da:\n  gespielt ${welt}\n  angeschaut ${JSON.stringify(zu)}`);
    // Beim Zuschauen schiebt niemand mit.
    await seite.mouse.move(210, 420);
    await seite.mouse.down();
    await seite.mouse.move(210, 560, { steps: 4 });
    await seite.mouse.up();
    await seite.waitForSelector(".gz-tafel:not([hidden]) .gz-nochmal", { timeout: 90000 }).catch(() => {});
    const schluss = await seite.evaluate(() => {
      const st = window.LernappEisstock.state;
      return { punkte: st.punkte, liste: st.liste.map((e) => e?.punkte ?? null), meter: st.liste.map((e) => e?.meter ?? null), tafel: Boolean(document.querySelector(".gz-tafel:not([hidden]) .gz-nochmal")) };
    });
    pruefe(schluss.tafel && schluss.punkte === gespielt.punkte && JSON.stringify(schluss.liste) === JSON.stringify(gespielt.liste) && JSON.stringify(schluss.meter) === JSON.stringify(gespielt.meter),
      `Eisstock: Am Ende der angeschauten Runde steht nicht dasselbe: ${JSON.stringify({ schluss, gespielt })}`);
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
    pruefe(zu.length === 3 && zu.every((b) => !b.offen) && JSON.stringify(zu.map((b) => b.titel)) === JSON.stringify(["Turniere", "Spiele", "Spieler"]),
      `Der Adminbereich steht nicht zugeklappt da, oder nicht mit den Bereichen Turniere, Spiele, Spieler: ${JSON.stringify(zu)}`);
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
    // Im Schnitt der gespielten Plätze: Grosi 1, Leo 1,5, Mia 2,5.
    pruefe(/vorne: 1\. Grosi, 2\. Leo, 3\. Mia/.test(await herbst.innerText()), `Beim Herbstcup steht nicht, wer vorne liegt: ${(await herbst.innerText()).replace(/\n/g, " ")}`);

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

    // Die Tiers: Vorgabe 28 / 4 / 5, Tier 4 und 5 noch leer, neben jedem
    // Spiel T1 bis T5. Wer eines umteilt, speichert es – und das nächste
    // Turnier sieht es so.
    await seite.locator(".adm-kachel", { hasText: "Spielen offen" }).click();
    const auswahlText = await seite.locator("#adm-spiele").innerText();
    pruefe(/\d+ von \d+ angehakt/.test(auswahlText) && !/Angehakt heisst/.test(auswahlText) && !/Mit ▶ spielst du/.test(auswahlText),
      `Über der Spielauswahl steht noch der erklärende Absatz, oder die Zahl fehlt: ${auswahlText.slice(0, 200)}`);
    const tierZahlen = () => seite.locator(".adm-tiers .adm-tier-titel").allInnerTexts();
    pruefe(JSON.stringify((await tierZahlen()).map((t) => t.replace(/\s+/g, " "))) === JSON.stringify(["Tier 1 38 Spiele", "Tier 2 4 Spiele", "Tier 3 5 Spiele", "Tier 4 0 Spiele", "Tier 5 0 Spiele"])
      && await seite.locator(".adm-tiers .adm-tier-wahl").count() === SPIELE.length
      && await seite.locator(".adm-tiers .adm-tier-leer").count() === 2
      && JSON.stringify(await seite.locator(".adm-tiers .adm-tier-wahl").first().locator("option").allInnerTexts()) === JSON.stringify(["T1", "T2", "T3", "T4", "T5"]),
      `Die Spiele stehen nicht nach Tier eingeteilt: ${JSON.stringify(await tierZahlen())}`);
    await seite.locator('.adm-tiers .adm-tier-wahl[aria-label="Tier von Fischteich"]').selectOption("1");
    await seite.waitForFunction(() => window.__miniTiers?.fishPond === 1, null, { timeout: 4000 }).catch(() => {});
    const umgeteilt = await seite.evaluate(() => ({ tiers: window.__miniTiers, titel: [...document.querySelectorAll(".adm-tiers .adm-tier-titel")].map((t) => t.textContent) }));
    pruefe(umgeteilt.tiers?.fishPond === 1 && umgeteilt.tiers?.towerStack === 1 && umgeteilt.tiers?.leafFlow === 2 && /39/.test(umgeteilt.titel[0] || ""),
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
    await form.locator("button", { hasText: "Alle abwählen" }).click();
    await form.locator("button", { hasText: /^Tier 1$/ }).click();
    const tierEins = await form.locator(".adm-wahl input:checked").evaluateAll((liste) => liste.map((b) => b.value).sort());
    pruefe(JSON.stringify(tierEins) === JSON.stringify(["balloonRide", "batEcho", "bridgeBuilder", "cliffFlight", "craneHarbor", "driftRace", "duckCrossing", "eyeMeasure", "fireRope", "fishPond", "flagCommand", "flockFlight", "freeDive", "freeHand", "frogHop", "hammerThrow", "highDive", "hillGlide", "iceRun", "iceStock", "juggler", "keepyUppy", "lumberCut", "mindsEye", "mineCart", "ropeWalk", "skiSlalom", "skyDive", "speedClimb", "stoneSkip", "timeNinja", "timeSense", "towerStack", "tunnelFlight", "twinLanes", "twinRotor", "vineSwing", "waveRide", "wireLoop"])
      && await form.locator(".adm-tier-titel").count() === 3,
      `«Tier 1» im Turnierformular wählt nicht die Spiele von Tier 1 (mit dem eben umgeteilten Fischteich): ${tierEins.join(", ")}`);
    await form.locator("button", { hasText: /^Tier 2$/ }).click();
    await form.locator("button", { hasText: /^Tier 1$/ }).click();
    const tierZwei = await form.locator(".adm-wahl input:checked").evaluateAll((liste) => liste.map((b) => b.value).sort());
    pruefe(JSON.stringify(tierZwei) === JSON.stringify(["boilerRoom", "dartWheel", "leafFlow", "planetHop"]),
      `«Tier 2» dazu und «Tier 1» wieder weg ergibt nicht Tier 2: ${tierZwei.join(", ")}`);
    await form.locator('input[type="text"]').first().fill("Test-Cup Ä");
    await form.locator("button", { hasText: "Alle abwählen" }).click();
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
    // Bevor es angelegt wird: alles so, wie es jetzt steht, als Preset
    // merken. Es kommt in die Datenbank (für jedes Gerät), mit allem ausser
    // dem Beginn – und nicht mehr in den Browser.
    await seite.waitForFunction(() => /Keine Presets/.test(document.querySelector("select.adm-preset-wahl")?.textContent || ""), null, { timeout: 3000 }).catch(() => {});
    pruefe(await form.locator("select.adm-preset-wahl").isDisabled(), "Ohne gespeicherte Presets lässt sich trotzdem eines wählen.");
    antwort = "Mein Preset";
    await form.locator("button", { hasText: "Als Preset speichern" }).click();
    await seite.waitForFunction(() => window.__miniPresets.size === 1, null, { timeout: 3000 }).catch(() => {});
    const preset = await seite.evaluate(() => [...window.__miniPresets.values()]);
    pruefe(await seite.evaluate(() => localStorage.getItem("mini.admin.presets")) === null, "Das Preset liegt noch im Browser statt nur in der Datenbank.");
    const p0 = preset[0]?.turnier || {};
    pruefe(preset.length === 1 && preset[0].name === "Mein Preset" && p0.name === "Test-Cup Ä"
      && JSON.stringify([...(p0.spiele || [])].sort()) === JSON.stringify(["fishPond", "towerStack"])
      && p0.versuchsart === "zahl" && p0.anzahl === "4" && p0.zaehlt === "summe" && p0.wertung === "prozent"
      && p0.aufgaben === "wieErster" && p0.sichtbar === "link" && p0.verdeckt === true && p0.ohneGeist === true && p0.ohneReplay === true
      && p0.dauer === String(TAG) && !("startMs" in p0),
      `Das Preset hält nicht fest, was eingestellt war: ${JSON.stringify(preset)}`);
    pruefe(await form.locator("select.adm-preset-wahl").inputValue() === "Mein Preset", "Das eben gespeicherte Preset steht nicht in der Auswahl.");
    pruefe(await seite.evaluate(() => [...window.__miniTurniere.values()].every((t) => t.name !== "Test-Cup Ä")), "«Als Preset speichern» hat das Turnier angelegt.");
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
    // Das Preset von vorhin: Ein Tipp in der Auswahl stellt alles wieder so
    // ein – nur der Beginn ist jetzt.
    await seite.locator(".adm-turnier-form select.adm-preset-wahl").selectOption("Mein Preset");
    const ausPreset = await seite.evaluate(() => {
      const f = document.querySelector(".adm-turnier-form");
      const an = (wert) => Boolean(f.querySelector(`input[type="radio"][value="${wert}"]`)?.checked);
      const haken = (wort) => [...f.querySelectorAll(".adm-option")].find((o) => o.textContent.includes(wort))?.querySelector("input")?.checked;
      return {
        name: f.querySelector('input[type="text"]').value,
        spiele: [...f.querySelectorAll(".adm-wahl input:checked")].map((b) => b.value).sort(),
        regeln: [an("zahl"), f.querySelector("input.adm-feld-zahl").value, an("summe"), an("prozent"), an("link"), an("wieErster")],
        haken: [haken("verdecken"), haken("Gegner beim Spielen"), haken("Replays anschauen")],
      };
    });
    pruefe(ausPreset.name === "Test-Cup Ä" && JSON.stringify(ausPreset.spiele) === JSON.stringify(["fishPond", "towerStack"])
      && JSON.stringify(ausPreset.regeln) === JSON.stringify([true, "4", true, true, true, true])
      && JSON.stringify(ausPreset.haken) === JSON.stringify([true, false, false]),
      `Das Preset stellt das Formular nicht wieder her: ${JSON.stringify(ausPreset)}`);
    await seite.locator(".adm-turnier-form button", { hasText: "Preset löschen" }).click();
    await seite.waitForFunction(() => window.__miniPresets.size === 0, null, { timeout: 3000 }).catch(() => {});
    pruefe(await seite.evaluate(() => window.__miniPresets.size === 0)
      && await seite.locator(".adm-turnier-form select.adm-preset-wahl").isDisabled(),
      "«Preset löschen» lässt das Preset stehen.");
    await seite.locator(".adm-turnier-form-kopf button", { hasText: "Zurück" }).click();

    // Ein Preset, das ein anderes Gerät gespeichert hat (das Handy, hier
    // direkt in die Datenbank gelegt), steht beim nächsten neuen Turnier
    // ebenso in der Auswahl.
    await seite.evaluate(() => window.__miniPresets.set("Vom Handy", {
      name: "Vom Handy", gespeichertMs: Date.now(),
      turnier: { name: "Handy-Cup", spiele: ["fishPond"], dauer: String(24 * 3600 * 1000), versuchsart: "frei", anzahl: "3", zaehlt: "bester", wertung: "platz", aufgaben: "gleich", sichtbar: "alle" },
    }));
    await seite.click('.adm-turniere button:text-is("Neues Turnier")');
    await seite.waitForFunction(() => [...(document.querySelector(".adm-turnier-form select.adm-preset-wahl")?.options || [])].some((o) => o.value === "Vom Handy"), null, { timeout: 3000 }).catch(() => {});
    pruefe(await seite.locator('.adm-turnier-form select.adm-preset-wahl option[value="Vom Handy"]').count() === 1,
      "Ein Preset, das ein anderes Gerät gespeichert hat, steht nicht in der Auswahl.");
    await seite.locator(".adm-turnier-form select.adm-preset-wahl").selectOption("Vom Handy");
    pruefe(await seite.locator(".adm-turnier-form input[type=\"text\"]").first().inputValue() === "Handy-Cup",
      "Das Preset vom anderen Gerät stellt das Formular nicht ein.");
    await seite.locator(".adm-turnier-form-kopf button", { hasText: "Zurück" }).click();

    // Was von früher noch im Browser liegt, zieht beim nächsten Besuch in die
    // Datenbank um – danach steht es auf jedem Gerät, und hier nicht mehr.
    await seite.evaluate(() => localStorage.setItem("mini.admin.presets", JSON.stringify([
      { name: "Vom Laptop", gespeichertMs: 5, turnier: { name: "Laptop-Cup", spiele: ["towerStack"], versuchsart: "zahl", anzahl: "2" } },
      { name: "Vom Handy", gespeichertMs: 4, turnier: { name: "Älter als das in der Datenbank" } },
    ])));
    await seite.locator(".adm-kopf button", { hasText: "Neu laden" }).click();
    await seite.waitForFunction(() => window.__miniPresets.has("Vom Laptop") && localStorage.getItem("mini.admin.presets") === null, null, { timeout: 4000 }).catch(() => {});
    const umgezogen = await seite.evaluate(() => ({
      namen: [...window.__miniPresets.keys()].sort(),
      handy: window.__miniPresets.get("Vom Handy")?.turnier?.name,
      lokal: localStorage.getItem("mini.admin.presets"),
    }));
    pruefe(JSON.stringify(umgezogen.namen) === JSON.stringify(["Vom Handy", "Vom Laptop"]) && umgezogen.handy === "Handy-Cup" && umgezogen.lokal === null,
      `Die Presets aus dem Browser sind nicht (oder falsch) in die Datenbank umgezogen: ${JSON.stringify(umgezogen)}`);
    await seite.evaluate(() => { window.__miniPresets.clear(); localStorage.removeItem("__mini_presets_attrappe"); });
    // Neu geladen bleibt offen, was offen war (ansicht.offen).
    await seite.waitForSelector(".adm-turniere .adm-turnier", { timeout: 8000 });
    pruefe(await seite.locator(".adm-turnier-form").count() === 0, "«Zurück zur Übersicht» schliesst das Formular nicht.");
    pruefe(!(await seite.evaluate(() => document.querySelector(".adm-seite").classList.contains("ist-formular"))), "Nach «Zurück zur Übersicht» bleibt der Adminbereich ausgeblendet.");

    // Ein Spiel spielen: über dem ganzen Adminbereich, ohne dass der
    // Haken daneben sich bewegt – auf der Startseite wäre das sofort
    // gespeichert.
    const auswahl = seite.locator("#adm-spiele");
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
    await dauerForm.locator("select:not(.adm-preset-wahl)").first().selectOption("ohne");
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
    // Die Spiele: ein Feld je Spiel, nach Tier gruppiert, nach Tier, nach
    // dem, was auf der Startseite steht, oder nach einem Turnier zu filtern –
    // und anders zu ordnen. Der Filter gilt überall.
    await seite.locator(".adm-kachel", { hasText: "Einträge" }).click();
    const felder = "#adm-spiele .adm-wahl";
    const feldNamen = () => seite.$$eval(`${felder} .adm-wahl-name`, (z) => z.map((s) => s.textContent.trim()));
    pruefe(await seite.locator(felder).count() === SPIELE.length, `In den Spielen stehen ${await seite.locator(felder).count()} Felder statt ${SPIELE.length}.`);
    await seite.locator('#adm-spiele .adm-chip[data-tier="2"]').click();
    const nurZwei = await seite.$$eval(`${felder} .adm-tier-wahl`, (z) => z.map((w) => w.value));
    pruefe(nurZwei.length > 0 && nurZwei.every((t) => t === "2") && await seite.locator("#adm-spiele .adm-tier-titel").count() === 1,
      `Der Filter «Tier 2» zeigt: ${nurZwei.join(", ")}`);
    pruefe(await seite.locator('#adm-spieler .adm-chip[data-tier="2"][aria-pressed="true"]').count() === 1, "Der Filter gilt bei den Spielern nicht mit.");
    pruefe(/gezeigten anhaken/.test(await seite.locator("#adm-spiele .adm-kopf-aktionen").innerText()), "Mit Filter sagt «Alle anhaken» nicht, dass es nur die gezeigten sind.");
    await seite.locator("#adm-spiele .adm-chip", { hasText: "Alle Tiers" }).click();
    await seite.locator("#adm-spiele .adm-filter-wahl:not(.adm-ordnung)").selectOption(`t:${HERBST}`);
    const imHerbst = await feldNamen();
    pruefe(imHerbst.length === 3 && ["Turmbau", "Fischteich", "Wo hält der Zug?"].every((t) => imHerbst.includes(t)),
      `Der Filter «Im Turnier: Herbstcup» zeigt: ${imHerbst.join(", ")}`);
    await seite.locator("#adm-spiele .adm-filter-weg").click();
    pruefe(await seite.locator(felder).count() === SPIELE.length, "«Filter aufheben» zeigt nicht wieder alle Spiele.");
    // Ordnen: nach Spielern – die meisten zuerst, ohne Gruppen der Tiers.
    await seite.locator("#adm-spiele .adm-ordnung").selectOption("spieler");
    const nachSpielern = await seite.$$eval(`${felder} .adm-wahl-zahl`, (z) => z.map((t) => Number((/(\d+) Spieler/.exec(t.textContent) || [0, 0])[1])));
    pruefe(nachSpielern[0] >= 1 && nachSpielern.every((n, i) => i === 0 || nachSpielern[i - 1] >= n) && await seite.locator("#adm-spiele .adm-tier-titel").count() === 0,
      `Nach Spielern geordnet steht: ${nachSpielern.join(", ")}`);
    await seite.locator(".adm-kachel", { hasText: "Runden" }).click();
    pruefe(await seite.locator("#adm-spiele .adm-ordnung").inputValue() === "runden" && /^\d+ Runden?/.test(await seite.locator(`${felder} .adm-wahl-zahl`).first().innerText()),
      "Die Kachel «Runden» ordnet die Spiele nicht nach Runden.");
    await seite.locator("#adm-spiele .adm-ordnung").selectOption("tier");

    // Nur das Kästchen ist der Haken: Ein Tipp auf das Feld legt nichts um,
    // sondern öffnet das Fenster des Spiels.
    const teichFeld = seite.locator(felder, { hasText: "Fischteich" });
    const teichVorher = await teichFeld.locator('input[type="checkbox"]').isChecked();
    const offenVorher = await seite.evaluate(() => JSON.stringify(window.__miniOffen ?? null));
    await teichFeld.locator(".adm-wahl-feld").click();
    await seite.waitForSelector(".adm-dash.adm-dash-spiel", { timeout: 4000 });
    pruefe(await teichFeld.locator('input[type="checkbox"]').isChecked() === teichVorher && await seite.evaluate(() => JSON.stringify(window.__miniOffen ?? null)) === offenVorher,
      "Ein Tipp auf das Feld des Spiels hat den Haken umgelegt.");
    const teich = seite.locator(".adm-dash.adm-dash-spiel");
    const fenster = await teich.evaluate((k) => ({
      titel: k.querySelector(".adm-dash-titel")?.textContent || "",
      zahlen: k.querySelectorAll(".adm-dash-zahlen > div").length,
      kopf: [...k.querySelectorAll(".adm-bestenliste thead th")].map((th) => th.textContent.trim()),
      sortierbar: k.querySelectorAll(".adm-bestenliste thead .adm-sortier").length,
      zeilen: k.querySelectorAll(".adm-bestenliste tbody tr:not(.adm-leer)").length,
      knoepfe: [...k.querySelectorAll("button")].map((b) => b.textContent.trim()),
    }));
    pruefe(fenster.titel === "Fischteich" && fenster.zahlen === 5 && fenster.zeilen >= 1
      && ["Platz", "Name", "Runden", "Spielzeit", "Zuletzt"].every((t) => fenster.kopf.includes(t)) && fenster.sortierbar === 6
      && ["Namen ändern", "Löschen", "Bestenliste leeren", "▶ Spielen", "Schliessen"].every((t) => fenster.knoepfe.includes(t)),
      `Das Fenster des Fischteichs zeigt nicht Zahlen, sortierbare Bestenliste und alle Knöpfe: ${JSON.stringify(fenster)}`);
    // Nach jeder Spalte zu sortieren: ein Tipp auf die Überschrift, ein zweiter dreht um.
    await teich.locator(".adm-bestenliste th button", { hasText: "Runden" }).click();
    const runden = () => teich.locator(".adm-bestenliste tbody tr td:nth-child(5)").allInnerTexts();
    const rundenAb = (await runden()).map(Number);
    await teich.locator(".adm-bestenliste th button", { hasText: "Runden" }).click();
    const rundenAuf = (await runden()).map(Number);
    pruefe(rundenAb.every((n, i) => i === 0 || rundenAb[i - 1] >= n) && rundenAuf.every((n, i) => i === 0 || rundenAuf[i - 1] <= n)
      && await teich.locator('.adm-bestenliste th[aria-sort="ascending"]').count() === 1,
      `Die Bestenliste sortiert nicht nach Runden, ab- und aufsteigend: ${rundenAb.join(",")} / ${rundenAuf.join(",")}`);
    // Esc schliesst, der Haken ist geblieben; das Kästchen selbst legt um.
    await seite.keyboard.press("Escape");
    pruefe(await seite.locator(".adm-dash").count() === 0, "Esc schliesst das Fenster des Spiels nicht.");
    await teichFeld.locator('input[type="checkbox"]').click();
    await seite.waitForFunction((war) => (window.__miniOffen || []).includes("fishPond") !== war, teichVorher, { timeout: 4000 }).catch(() => {});
    pruefe(await seite.locator(".adm-dash").count() === 0 && (await seite.evaluate(() => window.__miniOffen || [])).includes("fishPond") !== teichVorher,
      "Das Kästchen legt den Haken nicht um, oder es öffnet auch das Fenster.");
    await teichFeld.locator('input[type="checkbox"]').click();
    await seite.waitForFunction((war) => (window.__miniOffen || []).includes("fishPond") === war, teichVorher, { timeout: 4000 }).catch(() => {});

    // Kopfkino hat eine Testrunde: «▶ Alle Aufgaben» im Fenster des Spiels
    // öffnet sie im selben Fenster wie ▶ Spielen – jede Aufgabe einmal.
    await seite.locator(felder, { hasText: "Kopfkino" }).locator(".adm-wahl-feld").click();
    await seite.waitForSelector(".adm-dash.adm-dash-spiel", { timeout: 4000 });
    const alleKnopf = seite.locator(".adm-dash.adm-dash-spiel button", { hasText: "▶ Alle Aufgaben" });
    const alleDa = await alleKnopf.count();
    let alleStand = null;
    if (alleDa === 1) {
      await alleKnopf.click();
      await seite.waitForSelector(".adm-spiel iframe", { timeout: 4000 });
      const rahmen = seite.frameLocator(".adm-spiel iframe");
      await rahmen.locator(".kn-canvas").waitFor({ timeout: 8000 }).catch(() => {});
      const kopfkino = seite.frames().find((f) => f.url().includes("/kopfkino"));
      await kopfkino?.waitForFunction(() => window.LernappKopfkino?.state?.aufgaben, null, { timeout: 8000 }).catch(() => {});
      alleStand = { src: await seite.getAttribute(".adm-spiel iframe", "src"), zahl: await kopfkino?.evaluate(() => window.LernappKopfkino?.state?.aufgaben?.length).catch(() => null) };
      await rahmen.locator(".cm-bar-left a").first().click();
      await seite.waitForFunction(() => !document.querySelector(".adm-spiel"), null, { timeout: 4000 }).catch(() => {});
    }
    pruefe(alleDa === 1 && alleStand?.src === "/kopfkino?alle&von=admin" && alleStand?.zahl === 32 && await seite.locator(".adm-spiel").count() === 0 && !fenster.knoepfe.includes("▶ Alle Aufgaben"),
      `«▶ Alle Aufgaben» öffnet die Testrunde von Kopfkino nicht – oder ein Spiel ohne Testrunde hat den Knopf: ${JSON.stringify({ alleDa, alleStand, fischteich: fenster.knoepfe })}`);
    await seite.keyboard.press("Escape");
    await seite.waitForFunction(() => !document.querySelector(".adm-dash"), null, { timeout: 3000 }).catch(() => {});

    // Eine ganze Bestenliste leeren – im Fenster des Spiels. Danach steht
    // es wieder da, leer.
    await teichFeld.locator(".adm-wahl-feld").click();
    await seite.waitForSelector(".adm-dash.adm-dash-spiel", { timeout: 4000 });
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
    await seite.waitForFunction(() => /Noch hat niemand gespielt/.test(document.querySelector(".adm-dash.adm-dash-spiel")?.textContent || ""), null, { timeout: 4000 }).catch(() => {});
    pruefe(/Noch hat niemand gespielt/.test(await seite.locator(".adm-dash.adm-dash-spiel").innerText().catch(() => "")),
      "Nach «Bestenliste leeren» steht das Fenster des Spiels nicht wieder da, leer.");
    await seite.keyboard.press("Escape");

    // Die Auswertung eines Spielers: ein Tipp auf den Namen. Je Spiel der
    // Platz, dazu die Turniere – und alles, was sich mit ihm machen lässt.
    await seite.locator(".adm-kachel", { hasText: "Spieler" }).click();
    await seite.locator("#adm-spieler .adm-person", { hasText: "Grosi" }).click();
    await seite.waitForSelector(".adm-dash", { timeout: 4000 });
    await seite.waitForFunction(() => /Herbstcup/.test(document.querySelector(".adm-dash-turniere")?.textContent || ""), null, { timeout: 4000 }).catch(() => {});
    const auswertung = await seite.evaluate(() => ({
      titel: document.querySelector(".adm-dash-titel")?.textContent || "",
      // Die Tabelle «Je Spiel» – nicht der Spielverlauf darunter.
      spiele: [...document.querySelectorAll(".adm-dash .adm-sortierbar tbody tr")].map((z) => z.innerText.replace(/\s+/g, " ").trim()),
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
    await seite.locator(".adm-dash .adm-sortierbar tbody tr", { hasText: "Turmbau" }).locator("button", { hasText: "Löschen" }).click();
    await seite.waitForFunction(() => !window.__miniEintraege.has("towerStack_mini_vorherdagewesen"), null, { timeout: 4000 }).catch(() => {});
    pruefe(!(await seite.evaluate(() => window.__miniEintraege.has("towerStack_mini_vorherdagewesen"))), "«Löschen» in der Auswertung hat das Ergebnis stehen lassen.");
    await seite.waitForFunction(() => !document.querySelector(".adm-dash"), null, { timeout: 4000 }).catch(() => {});
    pruefe(await seite.locator(".adm-dash").count() === 0, "Ohne Einträge bleibt die Auswertung offen.");

    // Die Auswahllisten: Ihre aufgeklappte Liste zeichnet der Browser selbst,
    // mit den Farben der Einträge – helle Schrift auf hellem Grund war dort
    // einmal fast unsichtbar. Gemessen wird der Kontrast wie bei WCAG, für
    // einen Eintrag, eine Gruppe und einen, der nicht wählbar ist.
    const farben = await seite.evaluate(() => {
      const rgb = (text) => (String(text).match(/[\d.]+/g) || []).map(Number);
      const licht = ([r, g, b]) => {
        const k = (c) => { const x = c / 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; };
        return 0.2126 * k(r) + 0.7152 * k(g) + 0.0722 * k(b);
      };
      const kontrast = (a, b) => { const [x, y] = [licht(a), licht(b)].sort((m, n) => n - m); return Math.round(((x + 0.05) / (y + 0.05)) * 10) / 10; };
      const messe = (e) => {
        const s = getComputedStyle(e);
        const grund = rgb(s.backgroundColor);
        return { schrift: s.color, grund: s.backgroundColor, deckend: grund.length === 3 || grund[3] === 1, kontrast: kontrast(rgb(s.color), grund), schema: getComputedStyle(e.closest("select")).colorScheme };
      };
      const wahl = document.querySelector("#adm-spieler .adm-filter-wahl");
      const gesperrt = document.createElement("option");
      gesperrt.disabled = true;
      gesperrt.textContent = "nicht wählbar";
      wahl.append(gesperrt);
      const raus = {
        eintrag: messe(wahl.querySelector("option:not(:checked)")),
        gruppe: messe(wahl.querySelector("optgroup")),
        gesperrt: messe(gesperrt),
        tier: messe(document.querySelector(".adm-tier-wahl option")),
        auswahl: getComputedStyle(wahl).backgroundColor,
      };
      gesperrt.remove();
      return raus;
    });
    pruefe(farben.eintrag.deckend && farben.eintrag.kontrast >= 7 && farben.eintrag.schema === "dark"
      && farben.tier.deckend && farben.tier.kontrast >= 7,
      `Die Einträge einer Auswahlliste sind schlecht lesbar: ${JSON.stringify(farben)}`);
    pruefe(farben.gruppe.deckend && farben.gruppe.kontrast >= 4.5, `Die Gruppe «Im Turnier» in der Auswahlliste ist schlecht lesbar: ${JSON.stringify(farben.gruppe)}`);
    pruefe(farben.gesperrt.kontrast >= 3 && farben.gesperrt.schrift !== farben.eintrag.schrift,
      `Ein nicht wählbarer Eintrag ist nicht lesbar oder nicht von den anderen zu unterscheiden: ${JSON.stringify(farben.gesperrt)}`);
    pruefe(!/rgba\(.*, 0\.0\d*\)$/.test(farben.auswahl), `Die Auswahl hat keinen deckenden Grund: ${farben.auswahl}`);

    // Der Zeitraum, bei den Spielern und in der Auswertung – aus den
    // einzelnen Runden. Vor drei Tagen spielen Zeno (zweimal Turmbau) und Yara
    // (Turmbau und Fischteich), am Tag davor Zeno schon einmal, heute Xaver.
    // Die Runden davor (Zeno hat sieben) gibt es nur als Summe.
    const tagTest = await seite.evaluate(() => {
      const tag = new Date();
      tag.setHours(0, 0, 0, 0);
      tag.setDate(tag.getDate() - 3);
      const um = (davor, stunde, minute = 0) => {
        const d = new Date(tag);
        d.setDate(d.getDate() - davor);
        d.setHours(stunde, minute, 0, 0);
        return d.getTime();
      };
      const jetzt = Date.now() - 1000;
      const runden = [
        { game: "towerStack", spieler: "mini_zenozenozeno", name: "Zeno", nr: 5, punkte: 50, ms: 30000, zeitMs: um(1, 12) },
        { game: "towerStack", spieler: "mini_zenozenozeno", name: "Zeno", nr: 6, punkte: 30, ms: 60000, zeitMs: um(0, 10) },
        { game: "towerStack", spieler: "mini_zenozenozeno", name: "Zeno", nr: 7, punkte: 45, ms: 90000, zeitMs: um(0, 15, 30) },
        { game: "towerStack", spieler: "mini_yarayarayara", name: "Yara", nr: 1, punkte: 38, ms: 120000, zeitMs: um(0, 11) },
        { game: "fishPond", spieler: "mini_yarayarayara", name: "Yara", nr: 1, punkte: 7, ms: 45000, zeitMs: um(0, 16) },
        { game: "fishPond", spieler: "mini_xaverxaverxa", name: "Xaver", nr: 1, punkte: 3, ms: 20000, zeitMs: jetzt },
      ];
      runden.forEach((r) => { const id = `${r.game}_${r.spieler}_${r.nr}`; window.__miniRunden.set(id, { ...r, id }); });
      [
        { game: "towerStack", spieler: "mini_zenozenozeno", name: "Zeno", punkte: 50, versuche: 7, spielMs: 400000, erstesMs: um(30, 9), updatedAtMs: um(0, 15, 30) },
        { game: "towerStack", spieler: "mini_yarayarayara", name: "Yara", punkte: 38, versuche: 1, spielMs: 120000, erstesMs: um(0, 11), updatedAtMs: um(0, 11) },
        { game: "fishPond", spieler: "mini_yarayarayara", name: "Yara", punkte: 7, versuche: 1, spielMs: 45000, erstesMs: um(0, 16), updatedAtMs: um(0, 16) },
        { game: "fishPond", spieler: "mini_xaverxaverxa", name: "Xaver", punkte: 3, versuche: 1, spielMs: 20000, erstesMs: jetzt, updatedAtMs: jetzt },
      ].forEach((e) => { const id = `${e.game}_${e.spieler}`; window.__miniEintraege.set(id, { ...e, id }); });
      const feld = (ms) => {
        const d = new Date(ms);
        const z = (n) => String(n).padStart(2, "0");
        return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
      };
      return { tag: feld(tag.getTime()), vorher: feld(um(2, 0)), erste: um(1, 12) };
    });
    await seite.locator(".adm-kopf button", { hasText: "Neu laden" }).click();
    await seite.waitForSelector("#adm-spieler .adm-zeit", { timeout: 4000 });
    await seite.locator(".adm-kachel", { hasText: "Spieler" }).click();
    const liste = "#adm-spieler";
    const zeilenDer = (wo) => seite.$$eval(`${wo} .adm-sortierbar tbody tr`, (z) => z.map((tr) => [...tr.cells].map((c) => c.innerText.replace(/\s+/g, " ").trim())));
    const nachName = (zeilen) => Object.fromEntries(zeilen.filter((z) => z.length > 1).map((z) => [z[0].split(" ")[0], z]));
    const geladen = (wo) => seite.waitForFunction((w) => {
      const s = document.querySelector(`${w} .adm-zeit-streifen`);
      return s && !s.hidden && /Runde/.test(s.textContent) && !/geladen/.test(s.textContent);
    }, wo, { timeout: 4000 }).catch(() => {});
    pruefe(await seite.locator(`${liste} .adm-zeit .adm-chip`).count() === 6
      && await seite.locator(`${liste} .adm-zeit .adm-chip[aria-pressed="true"]`).innerText() === "Alle Zeit"
      && await seite.locator(`${liste} .adm-zeit-streifen`).isHidden(),
      "Bei den Spielern fehlt die Wahl des Zeitraums, oder sie steht nicht auf «Alle Zeit».");
    pruefe(await seite.evaluate(() => window.__miniRundenGefragt === undefined), "Für «Alle Zeit» werden Runden gelesen.");

    // Ein Tag: Zeno und Yara, mit den Runden dieses Tages.
    await seite.locator(`${liste} .adm-zeit .adm-chip`, { hasText: "Ein Tag" }).click();
    await seite.locator(`${liste} .adm-zeit input[type="date"]`).fill(tagTest.tag);
    await geladen(liste);
    let zeilen = nachName(await zeilenDer(liste));
    const streifen = await seite.locator(`${liste} .adm-zeit-streifen`).innerText();
    pruefe(JSON.stringify(Object.keys(zeilen).sort()) === JSON.stringify(["Yara", "Zeno"]),
      `Ein Tag zeigt nicht genau die, die an dem Tag gespielt haben: ${JSON.stringify(zeilen)}`);
    // Spalten: Name, Spiele, Runden, Spielzeit, Ø Platz, 1. Plätze, Zuletzt.
    pruefe(zeilen.Zeno?.slice(1, 6).join("|") === "1|2|3 min|1.0|1" && /15:30/.test(zeilen.Zeno?.[6] || ""),
      `Zeno an einem Tag: ${JSON.stringify(zeilen.Zeno)} (erwartet 1 Spiel, 2 Runden, 3 min, Platz 1.0, ein 1. Platz, zuletzt 15:30)`);
    pruefe(zeilen.Yara?.slice(1, 6).join("|") === "2|2|3 min|1.5|1",
      `Yara an einem Tag: ${JSON.stringify(zeilen.Yara)} (erwartet 2 Spiele, 2 Runden, 3 min, Platz 1.5, ein 1. Platz)`);
    pruefe(/Nur/.test(streifen) && /4 Runden/.test(streifen) && streifen.includes(tagTest.tag.split("-").reverse().join(".")),
      `Der Streifen sagt nicht, dass nur dieser Tag zählt: ${streifen}`);
    pruefe(await seite.locator(`${liste} .adm-zeit-hinweis`).isHidden(), "Ein Tag nach der ersten Runde bekommt den Hinweis auf fehlende Runden.");
    pruefe(/im Zeitraum/.test(await seite.locator(`${liste} .adm-block-zahl`).innerText()), "Zugeklappt sähe man nicht, dass bei den Spielern ein Zeitraum gilt.");
    // Die anderen Filter gelten weiter: der Name, und die Spiele eines
    // Turniers (der Stillcup hat nur Turmbau).
    await seite.locator(`${liste} .adm-suche`).fill("ze");
    zeilen = nachName(await zeilenDer(liste));
    pruefe(JSON.stringify(Object.keys(zeilen)) === JSON.stringify(["Zeno"]), `Name suchen und ein Tag zusammen zeigen: ${Object.keys(zeilen).join(", ")}`);
    await seite.locator(`${liste} .adm-suche`).fill("");
    await seite.locator(`${liste} .adm-filter-wahl`).selectOption(`t:${OHNE_GEGNER}`);
    zeilen = nachName(await zeilenDer(liste));
    pruefe(zeilen.Yara?.slice(1, 3).join("|") === "1|1" && zeilen.Zeno?.slice(1, 3).join("|") === "1|2",
      `Ein Turnier und ein Tag zusammen: ${JSON.stringify(zeilen)}`);
    await seite.locator(`${liste} .adm-filter-weg`).click();

    // Aus der gefilterten Liste in die Auswertung: derselbe Zeitraum.
    await seite.locator(`${liste} .adm-person`, { hasText: "Zeno" }).click();
    await seite.waitForSelector(".adm-dash", { timeout: 4000 });
    const dash = ".adm-dash";
    const imDash = await seite.evaluate(() => ({
      gewaehlt: document.querySelector(".adm-dash .adm-zeit .adm-chip[aria-pressed=\"true\"]")?.textContent || "",
      tag: document.querySelector(".adm-dash .adm-zeit input[type=\"date\"]")?.value || "",
      streifen: document.querySelector(".adm-dash .adm-zeit-streifen")?.innerText || "",
      zeilen: [...document.querySelectorAll(".adm-dash .adm-sortierbar tbody tr")].map((z) => z.innerText.replace(/\s+/g, " ").trim()),
      zahlen: [...document.querySelectorAll(".adm-dash-zahlen > div")].map((k) => k.innerText.replace(/\s+/g, " ").trim()),
    }));
    pruefe(/Ein Tag/.test(imDash.gewaehlt) && imDash.tag === tagTest.tag && /4 Runden/.test(imDash.streifen),
      `Die Auswertung aus der gefilterten Liste hat nicht denselben Zeitraum: ${JSON.stringify(imDash)}`);
    pruefe(imDash.zeilen.length === 1 && /^Turmbau T\d 1\. von 2 45 /.test(imDash.zeilen[0]) && imDash.zahlen.includes("2 Runden"),
      `Zenos Auswertung an einem Tag: ${JSON.stringify(imDash)} (erwartet Turmbau, Platz 1 von 2, Bestwert 45, 2 Runden)`);
    // In der Auswertung geändert, gilt er auch in der Liste: von 10:30 bis
    // 15:00 hat nur Yara gespielt.
    await seite.locator(`${dash} .adm-zeit .adm-chip`, { hasText: "Von – bis" }).click();
    pruefe(await seite.locator(`${dash} .adm-zeit input[type="datetime-local"]`).first().inputValue() === `${tagTest.tag}T00:00`,
      "«Von – bis» übernimmt nicht den Tag, der eben galt.");
    await seite.locator(`${dash} .adm-zeit input[type="datetime-local"]`).first().fill(`${tagTest.tag}T10:30`);
    await seite.locator(`${dash} .adm-zeit input[type="datetime-local"]`).last().fill(`${tagTest.tag}T15:00`);
    await geladen(dash);
    await seite.waitForFunction(() => /10:30 bis 15:00/.test(document.querySelector(".adm-dash .adm-zeit-streifen")?.textContent || ""), null, { timeout: 4000 }).catch(() => {});
    const leerImDash = await seite.locator(`${dash} .adm-sortierbar tbody`).innerText();
    pruefe(/nicht gespielt/.test(leerImDash), `Zeno hat von 10:30 bis 15:00 nicht gespielt, die Auswertung zeigt: ${leerImDash}`);
    await seite.keyboard.press("Escape");
    zeilen = nachName(await zeilenDer(liste));
    pruefe(JSON.stringify(Object.keys(zeilen)) === JSON.stringify(["Yara"]) && zeilen.Yara?.slice(1, 3).join("|") === "1|1",
      `Von 10:30 bis 15:00 zeigt die Liste: ${JSON.stringify(zeilen)}`);
    pruefe(await seite.locator(`${liste} .adm-zeit .adm-chip[aria-pressed="true"]`).innerText() === "Von – bis …",
      "Der Zeitraum aus der Auswertung gilt nicht in der Liste.");

    // Heute: nur Xaver. Und ein Tag vor der ersten Runde sagt, warum er leer ist.
    await seite.locator(`${liste} .adm-zeit .adm-chip`, { hasText: "Heute" }).click();
    await geladen(liste);
    zeilen = nachName(await zeilenDer(liste));
    pruefe(JSON.stringify(Object.keys(zeilen)) === JSON.stringify(["Xaver"]), `«Heute» zeigt: ${Object.keys(zeilen).join(", ")}`);
    await seite.locator(`${liste} .adm-zeit .adm-chip`, { hasText: "Ein Tag" }).click();
    await seite.locator(`${liste} .adm-zeit input[type="date"]`).fill(tagTest.vorher);
    await geladen(liste);
    const hinweis = await seite.locator(`${liste} .adm-zeit-hinweis`).innerText().catch(() => "");
    const ab = await seite.evaluate((ms) => new Date(ms).toLocaleString("de-CH", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }), tagTest.erste);
    pruefe(/Einzelne Runden gibt es erst seit/.test(hinweis) && hinweis.includes(ab),
      `Ein Tag vor der ersten Runde sagt nicht, seit wann es Runden gibt (${ab}): ${hinweis}`);
    pruefe(/niemand gespielt/.test(await seite.locator(`${liste} .adm-sortierbar tbody`).innerText()), "Ein Tag ohne Runden zeigt nicht, dass niemand gespielt hat.");

    // Ein Tipp zurück auf alle Zeit: wieder die Summen aus miniScores.
    await seite.locator(`${liste} .adm-zeit-weg`).click();
    zeilen = nachName(await zeilenDer(liste));
    pruefe(await seite.locator(`${liste} .adm-zeit-streifen`).isHidden() && zeilen.Zeno?.[2] === "7" && ["Yara", "Xaver"].every((n) => zeilen[n]),
      `Nach «Alle Zeit» stehen nicht wieder alle mit allen Runden da: ${JSON.stringify(zeilen)}`);

    // Wer einen Eintrag löscht, löscht seine Runden mit: Yaras Fischteich.
    await seite.locator(`${liste} .adm-person`, { hasText: "Yara" }).click();
    await seite.waitForSelector(".adm-dash", { timeout: 4000 });
    await seite.locator(`${dash} .adm-sortierbar tbody tr`, { hasText: "Fischteich" }).locator("button", { hasText: "Löschen" }).click();
    await seite.waitForFunction(() => !window.__miniEintraege.has("fishPond_mini_yarayarayara")
      && ![...window.__miniRunden.keys()].some((k) => k.startsWith("fishPond_mini_yarayarayara_")), null, { timeout: 4000 }).catch(() => {});
    const nachLoeschen = await seite.evaluate(() => [...window.__miniRunden.keys()].sort());
    pruefe(!nachLoeschen.some((k) => k.startsWith("fishPond_mini_yarayarayara_")) && nachLoeschen.includes("towerStack_mini_yarayarayara_1")
      && nachLoeschen.filter((k) => k.startsWith("towerStack_mini_zenozenozeno_")).length === 3,
      `Nach dem Löschen von Yaras Fischteich stehen diese Runden da: ${nachLoeschen.join(", ")}`);
    await seite.keyboard.press("Escape");

    // Der Spielverlauf: jede Runde für sich. In der Auswertung eines
    // Spielers stehen alle (App, Turniere, Multiplayer), im Fenster eines
    // Spielers im Turnier nur die darin. Zeno spielt heute noch Turmbau im
    // Stillcup und in der App (ohne Netz), und Fischteich im Multiplayer des
    // Herbstcups. Zusammen 10 Runden, 6 davon mit Uhrzeit.
    await seite.evaluate(({ still, herbst }) => {
      const jetzt = Date.now();
      const zeno = "mini_zenozenozeno";
      [
        { game: "towerStack", spieler: zeno, name: "Zeno", nr: 8, punkte: 60, ms: 50000, zeitMs: jetzt - 2 * 60000, quelle: "turnier" },
        { game: "towerStack", spieler: zeno, name: "Zeno", nr: 9, punkte: 20, ms: 10000, zeitMs: jetzt - 60000, offline: true },
        { game: "fishPond", spieler: zeno, name: "Zeno", nr: 1, punkte: 40, ms: 65000, zeitMs: jetzt - 25 * 60000, quelle: "live" },
      ].forEach((r) => { const id = `${r.game}_${r.spieler}_${r.nr}`; window.__miniRunden.set(id, { ...r, id }); });
      const turm = window.__miniEintraege.get(`towerStack_${zeno}`);
      window.__miniEintraege.set(`towerStack_${zeno}`, { ...turm, punkte: 60, versuche: 9, updatedAtMs: jetzt - 60000 });
      window.__miniEintraege.set(`fishPond_${zeno}`, { id: `fishPond_${zeno}`, game: "fishPond", spieler: zeno, name: "Zeno", punkte: 40, versuche: 1, spielMs: 65000, erstesMs: jetzt - 25 * 60000, updatedAtMs: jetzt - 25 * 60000 });
      window.__miniTurnierEintraege.set(`${still}/towerStack_${zeno}`, { turnier: still, id: `towerStack_${zeno}`, game: "towerStack", spieler: zeno, name: "Zeno", punkte: 60, versuche: 1, offen: false, updatedAtMs: jetzt - 2 * 60000 });
      window.__miniTurnierLive = { [herbst]: [{
        id: "ABCD-1", name: "Znachtrunde", gewicht: 1, runden: 1, spiele: ["fishPond"], erstelltMs: jetzt - 30 * 60000, updatedAtMs: jetzt - 20 * 60000,
        endstand: [{ spieler: zeno, name: "Zeno", punkte: 40, platz: 1 }, { spieler: "mini_leoleoleoleo", name: "Leo", punkte: 30, platz: 2 }],
      }] };
    }, { still: OHNE_GEGNER, herbst: HERBST });
    await seite.locator(".adm-kopf button", { hasText: "Neu laden" }).click();
    await seite.waitForSelector(".adm-seite > .adm-klapp", { timeout: 4000 });
    if (await seite.evaluate(() => Boolean(document.querySelector("#adm-spieler .adm-klapp-inhalt")?.hidden))) {
      await seite.locator("#adm-spieler .adm-klapp-knopf").click();
    }
    const vbox = ".adm-dash .adm-verlauf";
    const verlaufStand = () => seite.evaluate(() => {
      const box = document.querySelector(".adm-dash .adm-verlauf");
      if (!box) return null;
      const text = (k) => k.innerText.replace(/\s+/g, " ").trim();
      const zeilen = [...box.querySelectorAll("tbody tr")];
      const hinweis = box.querySelector(".adm-verlauf-hinweis");
      return {
        titel: document.querySelector(".adm-dash .adm-dash-kopf")?.innerText.replace(/\s+/g, " ").trim() || "",
        zahl: box.querySelector(".adm-verlauf-kopf .adm-block-zahl")?.textContent || "",
        hinweis: hinweis && !hinweis.hidden ? hinweis.textContent : "",
        tage: zeilen.filter((z) => z.classList.contains("adm-verlauf-tag")).map(text),
        runden: zeilen.filter((z) => !z.classList.contains("adm-verlauf-tag") && !z.classList.contains("adm-leer"))
          .map((z) => [...z.cells].map(text)),
        leer: zeilen.filter((z) => z.classList.contains("adm-leer")).map(text).join(""),
        woher: getComputedStyle(box.querySelector("thead .adm-verlauf-woher")).display !== "none",
        jeSpiel: [...document.querySelectorAll(".adm-dash .adm-sortierbar:not(.adm-verlauf-tabelle) tbody tr")].map(text),
        kacheln: [...document.querySelectorAll(".adm-dash-zahlen > div")].map(text),
      };
    });
    const geladenImVerlauf = () => seite.waitForFunction(() => {
      const box = document.querySelector(".adm-dash .adm-verlauf");
      return box && !/geladen/.test(box.querySelector("tbody")?.textContent || "geladen");
    }, null, { timeout: 4000 }).catch(() => {});

    await seite.locator(`${liste} .adm-person`, { hasText: "Zeno" }).click();
    await seite.waitForSelector(vbox, { timeout: 4000 });
    await geladenImVerlauf();
    let v = await verlaufStand();
    pruefe(v?.runden.length === 6 && v.zahl === "6 Runden",
      `Zenos Spielverlauf zeigt nicht seine 6 festgehaltenen Runden: ${JSON.stringify(v)}`);
    pruefe(/6 der 10 Runden/.test(v?.hinweis || ""), `Der Spielverlauf sagt nicht, dass 4 Runden nur in den Summen stehen: ${v?.hinweis}`);
    // Nach Tagen, die neuesten zuerst: heute 3 Runden, vor drei Tagen 2,
    // vor vier Tagen 1.
    pruefe(v?.tage.length === 3 && /3 Runden/.test(v.tage[0]) && /2 Runden/.test(v.tage[1]) && /1 Runde\b/.test(v.tage[2]),
      `Der Spielverlauf ist nicht nach Tagen gruppiert, die neuesten zuerst: ${JSON.stringify(v?.tage)}`);
    // Spalten: Uhrzeit, Spiel, Punkte, Dauer, Woher.
    const [letzte, imTurnier, imMultiplayer] = v?.runden || [];
    pruefe(/^\d\d:\d\d:\d\d$/.test(letzte?.[0] || "") && letzte?.[1] === "Turmbau" && /^20 /.test(letzte?.[2] || "") && letzte?.[3] === "10 s"
      && /^App/.test(letzte?.[4] || "") && /ohne Netz/.test(letzte?.[4] || ""),
      `Die letzte Runde steht nicht mit Uhrzeit, Spiel, Punkten, Dauer und «App · ohne Netz» da: ${JSON.stringify(letzte)}`);
    pruefe(/^60 .*★$/.test(imTurnier?.[2] || "") && /Turnier · Stillcup/.test(imTurnier?.[4] || ""),
      `Die Runde im Stillcup steht nicht als bester Turmbau aus dem Turnier da: ${JSON.stringify(imTurnier)}`);
    pruefe(/^40 .*★$/.test(imMultiplayer?.[2] || "") && imMultiplayer?.[3] === "1:05 min" && /Multiplayer · Herbstcup/.test(imMultiplayer?.[4] || ""),
      `Die Runde im Multiplayer des Herbstcups ist nicht als solche erkannt: ${JSON.stringify(imMultiplayer)}`);
    // Filtern: ein Turnier, nur die App, ein Spiel; dann die ältesten zuerst.
    await seite.locator(`${vbox} select[aria-label="Woher"]`).selectOption(`t:${OHNE_GEGNER}`);
    v = await verlaufStand();
    pruefe(v.runden.length === 1 && /Stillcup/.test(v.runden[0][4]) && v.zahl === "1 von 6 Runden",
      `Nur der Stillcup zeigt: ${JSON.stringify(v.runden)} (${v.zahl})`);
    await seite.locator(`${vbox} select[aria-label="Woher"]`).selectOption("app");
    v = await verlaufStand();
    pruefe(v.runden.length === 4 && v.runden.every((z) => /^App/.test(z[4])), `Nur die App zeigt: ${JSON.stringify(v.runden)}`);
    await seite.locator(`${vbox} select[aria-label="Woher"]`).selectOption("");
    await seite.locator(`${vbox} select[aria-label="Welches Spiel"]`).selectOption("fishPond");
    v = await verlaufStand();
    pruefe(v.runden.length === 1 && v.runden[0][1] === "Fischteich", `Nur Fischteich zeigt: ${JSON.stringify(v.runden)}`);
    await seite.locator(`${vbox} select[aria-label="Welches Spiel"]`).selectOption("");
    await seite.locator(`${vbox} .adm-chip`, { hasText: "Älteste zuerst" }).click();
    v = await verlaufStand();
    pruefe(/1 Runde\b/.test(v.tage[0] || "") && /^50 /.test(v.runden[0]?.[2] || ""), `«Älteste zuerst» beginnt nicht mit der ältesten Runde: ${JSON.stringify(v.runden[0])}`);
    // Der Zeitraum oben gilt auch hier: «Heute» sind die drei von heute.
    await seite.locator(".adm-dash .adm-zeit .adm-chip", { hasText: "Heute" }).click();
    await geladenImVerlauf();
    v = await verlaufStand();
    pruefe(v.runden.length === 3 && v.tage.length === 1 && !v.hinweis, `Mit «Heute» zeigt der Spielverlauf: ${JSON.stringify(v)}`);
    await seite.locator(".adm-dash .adm-zeit-weg").click();

    // In seiner Auswertung führt ein Tipp auf ein Turnier zu dem, was er
    // darin gespielt hat – nur dazu.
    await seite.locator(".adm-dash .adm-dash-turnier button", { hasText: "Stillcup" }).click();
    await seite.waitForFunction(() => /Stillcup/.test(document.querySelector(".adm-dash .adm-dash-kopf")?.textContent || ""), null, { timeout: 4000 }).catch(() => {});
    await geladenImVerlauf();
    v = await verlaufStand();
    pruefe(/im Turnier «Stillcup»/.test(v?.titel || "") && v?.runden.length === 1 && /^60 /.test(v.runden[0][2]) && !v.woher,
      `Zeno im Stillcup zeigt nicht genau seine Runde dort (ohne Spalte «Woher»): ${JSON.stringify(v)}`);
    pruefe(v?.jeSpiel.length === 1 && /^Turmbau 1\. von 1 60 /.test(v.jeSpiel[0]) && v.kacheln.includes("1 Runden") && v.kacheln.includes("1. Platz von 1"),
      `Je Spiel im Stillcup: ${JSON.stringify(v?.jeSpiel)} ${JSON.stringify(v?.kacheln)}`);
    await seite.keyboard.press("Escape");
    pruefe(await seite.locator(".adm-dash").count() === 0, "Esc schliesst das Fenster eines Spielers im Turnier nicht.");

    // Im Stand eines Turniers ist jeder Name ein Knopf. Zeno im Herbstcup:
    // nur der Multiplayer – nicht der Stillcup, nicht die App.
    if (await seite.evaluate(() => Boolean(document.querySelector(".adm-turniere .adm-klapp-inhalt")?.hidden))) {
      await seite.locator(".adm-turniere .adm-klapp-knopf").click();
    }
    const herbstKarte = await waehle("Herbstcup");
    pruefe(await herbstKarte.locator(".adm-turnier-tabelle tr", { hasText: "Zeno" }).locator("button", { hasText: "Auswertung" }).count() === 1,
      "Im Stand des Turniers fehlt neben dem Namen der Knopf «Auswertung».");
    await herbstKarte.locator(".adm-turnier-tabelle .adm-person", { hasText: "Zeno" }).click();
    await seite.waitForSelector(vbox, { timeout: 4000 });
    await geladenImVerlauf();
    v = await verlaufStand();
    pruefe(/im Turnier «Herbstcup»/.test(v?.titel || "") && v?.runden.length === 1 && v.woher && /Multiplayer · Znachtrunde/.test(v.runden[0][4]),
      `Zeno im Herbstcup zeigt nicht genau die Runde im Multiplayer: ${JSON.stringify(v)}`);
    pruefe(v?.jeSpiel.some((z) => /^Multiplayer · Znachtrunde 1\. von 2 40 /.test(z)),
      `Je Spiel im Herbstcup fehlt der Multiplayer: ${JSON.stringify(v?.jeSpiel)}`);
    // Und von dort zu allem, was er gespielt hat.
    await seite.locator(".adm-dash button", { hasText: "Alle Spiele von Zeno" }).click();
    await seite.waitForFunction(() => !/im Turnier/.test(document.querySelector(".adm-dash .adm-dash-kopf")?.textContent || "x"), null, { timeout: 4000 }).catch(() => {});
    await geladenImVerlauf();
    v = await verlaufStand();
    pruefe(v?.runden.length === 6, `«Alle Spiele von Zeno» zeigt nicht wieder alle seine Runden: ${JSON.stringify(v?.runden)}`);

    // Am Handy: nichts steht über den Rand – woher steht unter dem Spiel,
    // statt in einer Spalte, die aus dem Bild rollte.
    await seite.setViewportSize({ width: 390, height: 844 });
    const handyVerlauf = await seite.evaluate(() => {
      const dash = document.querySelector(".adm-dash");
      const wirt = dash.querySelector(".adm-verlauf .adm-tabelle-wirt");
      return {
        seite: document.documentElement.scrollWidth - window.innerWidth,
        fenster: dash.scrollWidth - dash.clientWidth,
        tabelle: wirt.scrollWidth - wirt.clientWidth,
        woher: [...dash.querySelectorAll(".adm-verlauf-woher-klein")].filter((m) => m.getClientRects().length).map((m) => m.textContent),
      };
    });
    pruefe(handyVerlauf.seite <= 1 && handyVerlauf.fenster <= 1 && handyVerlauf.tabelle <= 1,
      `Am Handy steht der Spielverlauf über den Rand: ${JSON.stringify(handyVerlauf)}`);
    pruefe(handyVerlauf.woher.length === 6 && handyVerlauf.woher.some((w) => /Stillcup/.test(w)),
      `Am Handy steht nicht bei jeder Runde, woher sie kam: ${JSON.stringify(handyVerlauf.woher)}`);
    await seite.setViewportSize({ width: 1100, height: 1000 });
    await seite.keyboard.press("Escape");

    // Am Handy: der Zeitraum mit seinen Feldern ohne Rollen zur Seite.
    await seite.setViewportSize({ width: 390, height: 844 });
    await seite.locator(`${liste} .adm-zeit .adm-chip`, { hasText: "Von – bis" }).click();
    const handy = await seite.evaluate(() => ({
      ueber: document.documentElement.scrollWidth - window.innerWidth,
      felder: [...document.querySelectorAll("#adm-spieler .adm-zeit-feld")].filter((f) => f.getClientRects().length).map((f) => Math.round(f.getBoundingClientRect().right)),
    }));
    pruefe(handy.ueber <= 1 && handy.felder.length === 2 && handy.felder.every((r) => r <= 390),
      `Am Handy steht der Zeitraum über den Rand: ${JSON.stringify(handy)}`);
    await seite.locator(`${liste} .adm-zeit-weg`).click();
    await seite.setViewportSize({ width: 1100, height: 1000 });

    const ohne = await seite.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    pruefe(ohne <= 1, `Der Adminbereich steht mit den Turnieren ${ohne} px über den Rand.`);

    // Jeder Knopf sieht aus wie ein Knopf – auch einer, der ein Link ist («Zu
    // den Spielen», «Neuer Multiplayer», «Öffnen», «Multiplayer»). Wer eine
    // Farbe von adm-knopf trägt, trägt auch adm-knopf selbst; ohne stand er
    // als unterstrichener Text auf einem Farbfleck da.
    if (await seite.evaluate(() => Boolean(document.querySelector(".adm-turniere .adm-klapp-inhalt")?.hidden))) {
      await seite.locator(".adm-turniere .adm-klapp-knopf").click();
    }
    if (!(await seite.locator(".adm-turnier.ist-offen").count())) await seite.locator(".adm-turnier-wahl").first().click();
    const knoepfe = await seite.evaluate(() => ({
      ohneForm: [...document.querySelectorAll('.adm-seite [class*="adm-knopf-"]')].filter((k) => !k.classList.contains("adm-knopf"))
        .map((k) => `${k.tagName.toLowerCase()} «${k.textContent.trim()}»`),
      links: [...document.querySelectorAll(".adm-seite a.adm-knopf")].filter((a) => a.getClientRects().length)
        .map((a) => ({ text: a.textContent.trim(), strich: getComputedStyle(a).textDecorationLine, rund: parseFloat(getComputedStyle(a).borderRadius) })),
    }));
    pruefe(knoepfe.ohneForm.length === 0, `Diese Knöpfe haben eine Farbe, aber nicht die Form eines Knopfs: ${knoepfe.ohneForm.join(", ")}`);
    pruefe(["Zu den Spielen", "Neuer Multiplayer", "Öffnen", "Multiplayer"].every((t) => knoepfe.links.some((k) => k.text === t))
      && knoepfe.links.every((k) => k.strich === "none" && k.rund >= 20),
      `Die Links im Adminbereich sehen nicht aus wie die Knöpfe daneben: ${JSON.stringify(knoepfe.links)}`);

    // Ein eigener Link: games.alae.app/hotdog statt …/turnier?t=hotdog-party-x7k2m9pq.
    // Er ist die Kennung des Turniers – also kein Name, den eine Seite schon
    // hat, und keiner, den ein Turnier schon hat (das würde überschrieben).
    await seite.click('.adm-turniere button:text-is("Neues Turnier")');
    await seite.waitForSelector(".adm-turnier-form", { timeout: 4000 });
    const lform = seite.locator(".adm-turnier-form");
    const linkFeld = lform.locator(".adm-link-feld");
    const linkStand = () => lform.locator(".adm-link-stand").innerText();
    await lform.locator('input[type="text"]').first().fill("Hotdog Party");
    const autoLink = await lform.locator(".adm-link .adm-option", { hasText: "Automatisch" }).locator("small").innerText();
    pruefe(/^127\.0\.0\.1:\d+\/turnier\?t=hotdog-party-[a-km-np-z2-9]{8}$/.test(autoLink), `Unter «Automatisch» steht nicht der Link, der angelegt würde: ${autoLink}`);
    pruefe(await lform.locator('.adm-link input[value="auto"]').isChecked(), "Ein neues Turnier hat nicht von selbst den automatischen Link.");
    await linkFeld.fill("Turmbau");
    pruefe(await lform.locator('.adm-link input[value="eigen"]').isChecked(), "Wer einen eigenen Link tippt, bleibt bei «Automatisch».");
    pruefe(/turmbau ist schon eine Seite/.test(await linkStand()), `Ein Link, unter dem schon ein Spiel liegt, ist nicht als belegt gemeldet: ${await linkStand()}`);
    await linkFeld.fill("cup");
    pruefe(/zu kurz/.test(await linkStand()), `Ein Link mit drei Zeichen ist nicht als zu kurz gemeldet: ${await linkStand()}`);
    const herbstName = await seite.evaluate((id) => window.__miniTurniere.get(id)?.name || "", HERBST);
    if (herbstName) {
      await linkFeld.fill(HERBST);
      await seite.waitForFunction(() => /gibt es schon/.test(document.querySelector(".adm-link-stand")?.textContent || ""), null, { timeout: 3000 }).catch(() => {});
      pruefe((await linkStand()).includes(`gibt es schon: «${herbstName}»`), `Ein Link, den ein Turnier schon hat, ist nicht als vergeben gemeldet: ${await linkStand()}`);
      await lform.locator('button[type="submit"]').click();
      await seite.waitForFunction(() => /gibt es schon/.test(document.querySelector(".adm-turnier-form > .adm-meldung")?.textContent || ""), null, { timeout: 3000 }).catch(() => {});
      pruefe(/gibt es schon/.test(await lform.locator(":scope > .adm-meldung").innerText())
        && await seite.evaluate((id) => window.__miniTurniere.get(id)?.name, HERBST) === herbstName,
        "Ein neues Turnier mit dem Link eines bestehenden hat das bestehende überschrieben – oder nicht gesagt, warum es nicht geht.");
    }
    await linkFeld.fill("Hot Dög!");
    await linkFeld.blur();
    pruefe(await linkFeld.inputValue() === "hot-doeg", `Aus «Hot Dög!» wird nicht der Link hot-doeg: ${await linkFeld.inputValue()}`);
    await linkFeld.fill("hotdog");
    await seite.waitForFunction(() => /ist frei/.test(document.querySelector(".adm-link-stand")?.textContent || ""), null, { timeout: 3000 }).catch(() => {});
    pruefe(/^127\.0\.0\.1:\d+\/hotdog ist frei\.$/.test(await linkStand()), `Der freie eigene Link steht nicht da: ${await linkStand()}`);
    await lform.locator("button", { hasText: "Alle abwählen" }).click();
    await lform.locator('input[value="towerStack"]').check();
    await lform.locator('button[type="submit"]').click();
    await seite.waitForFunction(() => window.__miniTurniere.has("hotdog"), null, { timeout: 4000 }).catch(() => {});
    pruefe(await seite.evaluate(() => window.__miniTurniere.get("hotdog")?.name) === "Hotdog Party", "Das Turnier mit eigenem Link kam nicht unter «hotdog» an.");
    const hotdogMeldung = await seite.locator(".adm-turniere .adm-klapp-inhalt > .adm-meldung").innerText();
    pruefe(hotdogMeldung.includes(`Der Link: ${BASIS}/hotdog`) && !hotdogMeldung.includes("turnier?t="),
      `Nach dem Anlegen steht nicht der kurze Link da: ${hotdogMeldung}`);
    const hotdogKarte = seite.locator(".adm-turnier.ist-offen");
    pruefe(await hotdogKarte.locator("a", { hasText: "Öffnen" }).getAttribute("href") === "/turnier?t=hotdog",
      "«Öffnen» führt beim eigenen Link nicht direkt auf die Turnierseite.");
    // Beim Ändern steht der Link da – zum Ändern ist er nicht mehr.
    await hotdogKarte.locator("button", { hasText: "Bearbeiten" }).click();
    await seite.waitForSelector(".adm-turnier-form", { timeout: 4000 });
    pruefe(await seite.locator(".adm-turnier-form .adm-link-feld").count() === 0
      && /\/hotdog – der Link bleibt/.test(await seite.locator(".adm-turnier-form .adm-link").innerText()),
      "Beim Ändern lässt sich der Link ändern, oder er steht nicht da.");
    await seite.locator(".adm-turnier-form-kopf button", { hasText: "Zurück" }).click();

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
      runden: [...window.__miniRunden.values()].filter((r) => r.name === "Alain").map((r) => ({ id: r.id, nr: r.nr, punkte: r.punkte, ms: r.ms, vor: Date.now() - r.zeitMs })),
      best: localStorage.getItem("mini.best"),
    }));
    // Und im Rundenprotokoll: diese eine Runde, mit Punkten, Dauer und Uhrzeit.
    pruefe(spur.runden.length === 1 && spur.runden[0].nr === 1 && spur.runden[0].punkte === spur.ewig[0]?.punkte
      && spur.runden[0].ms === spur.ewig[0]?.spielMs && spur.runden[0].vor >= 0 && spur.runden[0].vor < 60000,
      `Die Runde aus dem Adminbereich steht nicht im Rundenprotokoll: ${JSON.stringify(spur.runden)}`);
    pruefe(spur.ewig.length === 1 && spur.ewig[0].game === "towerStack" && spur.ewig[0].punkte > 0,
      `Die Runde aus dem Adminbereich steht nicht unter dem Namen in der ewigen Liste: ${JSON.stringify(spur.ewig)}`);
    // Mit ihrer Dauer: Sie zählt zur Spielzeit des Eintrags (mini-games.js,
    // rundeBeginnt/rundeEndet) – und mehr als eine halbe Stunde ist keine Runde.
    pruefe(spur.ewig[0]?.spielMs > 0 && spur.ewig[0].spielMs < 30 * 60 * 1000,
      `Die Runde kam ohne ihre Dauer in die ewige Liste: ${JSON.stringify(spur.ewig)}`);
    pruefe(Boolean(spur.best), "Die Runde aus dem Adminbereich hat keinen Bestwert auf dem Gerät hinterlassen.");
    await kontext.close();
  }

  // --- 4k2. Den besten Lauf aus dem Adminbereich ansehen ----------------------------
  // Im Fenster eines Spiels steht neben jeder Zahl der Bestenliste ein ▶,
  // wo es ihren Lauf gibt (admin.js, ansehenKnopf), oben «▶ Rekord ansehen»,
  // und in der Auswertung eines Spielers dasselbe ▶ je Spiel. Es öffnet den
  // Lauf über dem Adminbereich; «Beenden», «Zurück» und der Weg oben links
  // machen das Fenster wieder zu. Gezählt wird dabei nichts.
  {
    const kontext = await browser.newContext({ viewport: { width: 1280, height: 1000 }, serviceWorkers: "block" });
    const seite = await kontext.newPage();
    const fehlerHier = [];
    seite.on("pageerror", (fehler) => fehlerHier.push(String(fehler.message || fehler)));
    seite.on("console", (n) => { if (n.type() === "error") fehlerHier.push(n.text()); });
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
    await seite.addInitScript(() => {
      if (sessionStorage.getItem("__ansehen")) return;
      sessionStorage.setItem("__ansehen", "1");
      const eintrag = (spiel, id, name, punkte) => [`${spiel}_${id}`, { id: `${spiel}_${id}`, game: spiel, spieler: id, name, punkte, versuche: 3, spielMs: 60000, updatedAtMs: 1000 }];
      localStorage.setItem("__mini_attrappe", JSON.stringify([
        eintrag("towerStack", "mini_leoleoleoleo", "Leo", 90),
        eintrag("towerStack", "mini_idaidaidaida", "Ida", 60),
        eintrag("towerStack", "mini_noranoranora", "Nora", 50),
        eintrag("fishPond", "mini_leoleoleoleo", "Leo", 12),
      ]));
      // Leo hat den Lauf zu seinem Rekord, Ida nur einen früheren (40 statt
      // 60), Nora keinen.
      const bahn = JSON.stringify({ v: 3, s: 7, e: 900, z: { t: [0, 400], c: [0, 1], p: [0, 0] } });
      localStorage.setItem("__mini_geister_attrappe", JSON.stringify([
        ["towerStack_mini_leoleoleoleo", { game: "towerStack", spieler: "mini_leoleoleoleo", name: "Leo", punkte: 90, level: "z1", bahn }],
        ["towerStack_mini_idaidaidaida", { game: "towerStack", spieler: "mini_idaidaidaida", name: "Ida", punkte: 40, level: "z1", bahn }],
      ]));
    });
    await seite.goto(`${BASIS}/admin`, { waitUntil: "load" });
    await seite.waitForSelector(".adm-seite > .adm-klapp", { timeout: 8000 });
    await seite.locator(".adm-kachel", { hasText: "Spiele" }).first().click();
    await seite.locator("#adm-spiele .adm-wahl", { hasText: "Turmbau" }).locator(".adm-wahl-feld").click();
    const turm = seite.locator(".adm-dash.adm-dash-spiel");
    await turm.locator(".adm-ansehen").first().waitFor({ timeout: 4000 }).catch(() => {});
    const liste = await turm.evaluate((k) => ({
      oben: [...k.querySelectorAll(".adm-dash-marken button")].map((b) => b.textContent.trim()),
      zeilen: Object.fromEntries([...k.querySelectorAll(".adm-bestenliste tbody tr")].map((tr) => {
        const knopf = tr.querySelector(".adm-ansehen");
        return [tr.querySelector(".adm-person")?.textContent, knopf ? { frueher: knopf.classList.contains("ist-frueher"), sagt: knopf.getAttribute("aria-label") } : null];
      })),
      hinweis: !k.querySelector(".adm-lauf-hinweis")?.hidden,
      ueber: (() => { const w = k.querySelector(".adm-bestenliste").closest(".adm-tabelle-wirt"); return w.scrollWidth - w.clientWidth; })(),
    }));
    pruefe(liste.oben.includes("▶ Spielen") && liste.oben.includes("▶ Rekord ansehen"), `Oben im Fenster des Turmbaus fehlt «▶ Rekord ansehen»: ${JSON.stringify(liste.oben)}`);
    pruefe(liste.zeilen.Leo && !liste.zeilen.Leo.frueher && /Leo.*90 Blöcke/.test(liste.zeilen.Leo.sagt), `Bei Leo fehlt das ▶ zu seinem Rekord: ${JSON.stringify(liste.zeilen.Leo)}`);
    pruefe(liste.zeilen.Ida?.frueher && /früheren Lauf.*40 Blöcke/.test(liste.zeilen.Ida.sagt), `Bei Ida sagt das ▶ nicht, dass es nur ein früherer Lauf ist: ${JSON.stringify(liste.zeilen.Ida)}`);
    pruefe(liste.zeilen.Nora === null, "Bei Nora steht ein ▶, obwohl es von ihr keinen Lauf gibt.");
    pruefe(liste.hinweis, "Unter der Bestenliste steht nicht, dass nur der beste Lauf aufgezeichnet wird.");
    pruefe(liste.ueber <= 0, `Mit dem ▶ ist die Bestenliste ${liste.ueber} px breiter als das Fenster.`);

    // ▶ öffnet den Lauf über dem Adminbereich; «Beenden» macht nur dieses Fenster zu.
    await turm.locator("tr", { hasText: "Leo" }).locator(".adm-ansehen").click();
    await seite.waitForSelector(".adm-spiel iframe", { timeout: 4000 });
    const adresse = await seite.getAttribute(".adm-spiel iframe", "src");
    pruefe(adresse === "/turmbau?zuschauen=mini_leoleoleoleo&von=admin", `Das ▶ öffnet ${adresse} statt /turmbau?zuschauen=mini_leoleoleoleo&von=admin.`);
    const imSpiel = seite.frameLocator(".adm-spiel iframe");
    await imSpiel.locator(".gz-titel", { hasText: "Leo" }).waitFor({ timeout: 8000 }).catch(() => {});
    pruefe(/Leo · 90/.test(await imSpiel.locator(".gz-titel").textContent().catch(() => "")), "Im Fenster läuft nicht der Lauf von Leo.");
    await imSpiel.locator(".gz-zu").click();
    await seite.waitForFunction(() => !document.querySelector(".adm-spiel"), null, { timeout: 3000 }).catch(() => {});
    pruefe(await seite.locator(".adm-spiel").count() === 0 && await turm.count() === 1,
      "«Beenden» macht beim Anschauen aus dem Adminbereich nicht (nur) das Fenster des Laufs zu.");
    // Bis zum Schluss: «Zurück» auf der Tafel macht ebenso zu.
    await turm.locator(".adm-dash-marken .adm-ansehen").click();
    const imSpiel2 = seite.frameLocator(".adm-spiel iframe");
    await imSpiel2.locator(".gz-zurueck").waitFor({ timeout: 12000 }).catch(() => {});
    if (await imSpiel2.locator(".gz-zurueck").count()) await imSpiel2.locator(".gz-zurueck").click();
    await seite.waitForFunction(() => !document.querySelector(".adm-spiel"), null, { timeout: 3000 }).catch(() => {});
    pruefe(await seite.locator(".adm-spiel").count() === 0, "«Zurück» am Schluss des Laufs macht das Fenster nicht zu.");
    // Und der Weg oben links im Spiel.
    await turm.locator(".adm-dash-marken .adm-ansehen").click();
    const imSpiel3 = seite.frameLocator(".adm-spiel iframe");
    await imSpiel3.locator(".cm-bar-left a").first().click({ timeout: 8000 }).catch(() => {});
    await seite.waitForFunction(() => !document.querySelector(".adm-spiel"), null, { timeout: 3000 }).catch(() => {});
    pruefe(await seite.locator(".adm-spiel").count() === 0 && seite.url().endsWith("/admin"),
      "Der Weg oben links macht beim Anschauen aus dem Adminbereich das Fenster nicht zu.");
    const lager = await seite.evaluate(() => ({ eintraege: window.__miniEintraege.size, laeufe: window.__miniGeister.size, runden: window.__miniRunden?.size || 0 }));
    pruefe(lager.eintraege === 4 && lager.laeufe === 2 && lager.runden === 0, `Beim Anschauen ist etwas gezählt oder gespeichert worden: ${JSON.stringify(lager)}`);

    // Die Auswertung von Leo: «Je Spiel» mit ▶ beim Turmbau, nicht beim Fischteich.
    await turm.locator(".adm-person", { hasText: "Leo" }).click();
    const dash = seite.locator(".adm-dash");
    await dash.locator(".adm-ansehen").first().waitFor({ timeout: 4000 }).catch(() => {});
    const jeSpiel = await dash.evaluate((k) => {
      const teil = [...k.querySelectorAll("section")].find((s) => s.querySelector("h3")?.textContent === "Je Spiel");
      return Object.fromEntries([...(teil?.querySelectorAll("tbody tr") || [])].map((tr) => [tr.querySelector("td")?.innerText.trim(), tr.querySelectorAll(".adm-ansehen").length]));
    });
    pruefe(jeSpiel.Turmbau === 1 && jeSpiel.Fischteich === 0, `In «Je Spiel» steht das ▶ nicht genau beim Turmbau: ${JSON.stringify(jeSpiel)}`);
    await dash.locator(".adm-ansehen").first().click();
    await seite.waitForSelector(".adm-spiel iframe", { timeout: 4000 });
    pruefe(await seite.getAttribute(".adm-spiel iframe", "src") === "/turmbau?zuschauen=mini_leoleoleoleo&von=admin", "Das ▶ in «Je Spiel» öffnet nicht den Lauf von Leo.");
    await seite.frameLocator(".adm-spiel iframe").locator(".gz-zu").click();
    await seite.waitForFunction(() => !document.querySelector(".adm-spiel"), null, { timeout: 3000 }).catch(() => {});
    pruefe(await seite.locator(".adm-spiel").count() === 0 && await dash.count() === 1, "Nach «Beenden» steht die Auswertung nicht mehr da.");
    pruefe(fehlerHier.length === 0, `Beim Anschauen aus dem Adminbereich hat sich der Browser beschwert – ${fehlerHier.join(" / ")}`);
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

    // Namen ändern auf der Turnierseite (oben rechts): König heisst jetzt
    // Prinz – im Turnier mit allem, was er dort hat. Er liegt weiter vorne,
    // also wartet er weiter.
    await seite.click(".ar-kopf .ar-name-knopf");
    pruefe(await seite.locator(".ar-name-feld .mini-name-steht", { hasText: "König" }).count() === 1, "Auf der Turnierseite steht nicht, unter welchem Namen man spielt.");
    await seite.click(".ar-name-feld .mini-name-steht button");
    await seite.fill(".ar-name-feld .mini-namensfeld input", "Prinz");
    await seite.click(".ar-name-feld .mini-namensfeld button[type=submit]");
    await seite.waitForFunction(() => /mitgekommen/.test(document.querySelector(".ar-name-feld .mini-wer-hinweis")?.textContent || ""), null, { timeout: 4000 }).catch(() => {});
    await seite.keyboard.press("Escape");
    const nachher = await wegeImTurnier(seite);
    const neu = await seite.evaluate(() => ({
      koenig: [...window.__miniTurnierEintraege.values()].filter((e) => e.spieler === "mini_koenigkoenig").map((e) => e.name),
      id: localStorage.getItem("mini.id"),
      chip: document.querySelector(".ar-kopf .ar-name-text")?.textContent || "",
    }));
    pruefe(neu.koenig.length === 2 && neu.koenig.every((n) => n === "Prinz"), `Im Turnier heisst König nach dem Umbenennen: ${neu.koenig.join(", ")}`);
    pruefe(neu.id === "mini_koenigkoenig" && neu.chip === "Prinz", `Nach dem Umbenennen spielt das Gerät nicht mehr als König, oder oben steht: ${JSON.stringify(neu)}`);
    pruefe(nachher.every((w) => !w.link), `Prinz liegt vorne wie König und darf trotzdem spielen: ${JSON.stringify(nachher)}`);

    // Jemand anderes auf diesem Gerät ist im Turnier ein neuer Mitspieler:
    // Prinz' Einträge bleiben, wo sie sind – und der Neue darf spielen.
    await seite.click(".ar-kopf .ar-name-knopf");
    await seite.click(".ar-name-feld .mini-name-steht button");
    await seite.locator(".ar-name-feld button", { hasText: "Jemand anderes spielt" }).click();
    await seite.fill(".ar-name-feld .mini-namensfeld input", "Knappe");
    await seite.click(".ar-name-feld .mini-namensfeld button[type=submit]");
    await seite.waitForFunction(() => document.querySelector(".ar-leiste .ar-play"), null, { timeout: 4000 }).catch(() => {});
    await seite.keyboard.press("Escape");
    const knappe = await wegeImTurnier(seite);
    const neuer = await seite.evaluate(() => ({
      prinz: [...window.__miniTurnierEintraege.values()].filter((e) => e.spieler === "mini_koenigkoenig").map((e) => e.name),
      id: localStorage.getItem("mini.id"),
    }));
    neuer.spielen = knappe.filter((w) => w.link).length;
    pruefe(neuer.spielen === 2, `Der neue Mitspieler kann im Königscup ${neuer.spielen} statt beide Spiele spielen.`);
    pruefe(neuer.prinz.every((n) => n === "Prinz"), `Der neue Mitspieler hat Prinz' Einträge geändert: ${neuer.prinz.join(", ")}`);
    pruefe(neuer.id !== "mini_koenigkoenig", "Der neue Mitspieler spielt im Turnier noch als Prinz.");
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
    // Leo spielt sich nach vorne. Das Gerät rechnet es gleich selbst aus
    // (turnier.js, rechne – mit der Runde im Postausgang): Ein sofortiges
    // «Noch einmal» führt sofort zurück zum Turnier statt in eine Runde, die
    // nicht zählen dürfte – auch bei langsamer Verbindung, ohne auf den
    // Server zu warten. Den Weg dorthin fängt die Prüfung ab (weg), sonst
    // verliesse sie die Seite.
    const { kontext, seite } = await mitTurnieren(`/turmbau?turnier=${KOENIG}`, { vorher: () => { localStorage.setItem("mini.id", "mini_leoleoleoleo"); localStorage.setItem("mini.name", "Leo"); window.__miniLangsam = 400; } });
    await turnierLos(seite, "Leo");
    const befund = await seite.evaluate(async (id) => {
      const tn = window.LernappTurnier;
      tn.weg = (adresse) => { window.__weg = adresse; };
      tn.rundeBeginnt();
      const block = tn.ergebnis({ punkte: 50 });
      let neu = false;
      tn.neuStart({ los: () => { neu = true; } });
      const sofort = { neu, tor: Boolean(document.querySelector(".tn-tor")), weg: window.__weg || "", vorne: tn.stand().vorne };
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
    pruefe(befund.sofort.vorne && befund.sofort.weg === `/turnier?t=${KOENIG}`,
      `«Noch einmal» weiss nicht gleich, dass die Runde nach vorne geführt hat: ${JSON.stringify(befund.sofort)}`);
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
      return { kennung, saat: d?.s ?? null, mitOrt: Boolean(window.LernappGeist.entpacke(geist?.bahn)?.a), punkte: geist?.punkte || 0, korridor: new Function(`return (${quelle})()`)() };
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
      return { kennung, v: d?.v, p: window.LernappGeist.entpacke(geist?.bahn)?.p?.length > 0, zuege: d?.z?.t?.length || 0, saat: d?.s ?? null };
    });
    pruefe(runde.richtig + runde.falsch === 6 && (runde.richtig === 0 || (blatt.v === 4 && blatt.p && blatt.zuege === 6 && Number.isInteger(blatt.saat))),
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

  // --- 4q. Die Klänge (klang.js) -------------------------------------------------
  // Jeder Platz der Klangauswahl erzeugt Töne (die Grillen zirpen zufällig
  // und dürfen in der kurzen Probe schweigen), jede Aufnahme unter klang/
  // lädt, und nichts wirft. Ist der Ton aus, entsteht gar nichts.
  {
    // Brückenbauer: Jeder Treffer in die rote Mitte klingt (die Harfe,
    // «perfekt») – auch der zweite und dritte einer Serie (+3, +4), nicht nur
    // der erste.
    const { kontext, seite } = await neueSeite({ width: 420, height: 820 });
    await seite.goto(`${BASIS}/bruecke`, { waitUntil: "load" });
    await seite.waitForFunction(() => window.LernappBruecke?.state && window.ArcadeKlang?.protokoll, null, { timeout: 8000 }).catch(() => {});
    const harfe = [];
    for (let i = 0; i < 3; i += 1) {
      await seite.waitForFunction(() => { const st = window.LernappBruecke.state; return st.phase === "bereit" || (st.phase === "spiel" && st.schritt === "warten"); }, null, { timeout: 8000 }).catch(() => {});
      await seite.evaluate(() => {
        // Gedrückt, der Balken genau bis zur Mitte des nächsten Pfeilers, losgelassen.
        const st = window.LernappBruecke.state;
        document.dispatchEvent(new KeyboardEvent("keydown", { key: " ", bubbles: true }));
        const p = st.pfeiler[st.hier + 1];
        st.balken.len = p.x - st.balken.x;
        document.dispatchEvent(new KeyboardEvent("keyup", { key: " ", bubbles: true }));
      });
      await seite.waitForFunction((n) => window.LernappBruecke.state.bruecken > n, i, { timeout: 8000 }).catch(() => {});
      harfe.push(await seite.evaluate(() => ({
        kette: window.LernappBruecke.state.kette,
        punkte: window.LernappBruecke.state.punkte,
        harfen: window.ArcadeKlang.protokoll.filter((x) => x.id === "perfekt").length,
      })));
    }
    pruefe(JSON.stringify(harfe.map((h) => [h.kette, h.punkte, h.harfen])) === JSON.stringify([[1, 2, 1], [2, 5, 2], [3, 9, 3]]),
      `Brückenbauer: Nicht jeder Treffer in die Mitte klingt (je Brücke Kette, Punkte, Harfen bis dahin): ${JSON.stringify(harfe)}`);
    await kontext.close();
  }
  {
    const zaehler = () => {
      window.__klangKnoten = 0;
      for (const art of ["createOscillator", "createBufferSource"]) {
        const alt = AudioContext.prototype[art];
        AudioContext.prototype[art] = function (...x) { window.__klangKnoten += 1; return alt.apply(this, x); };
      }
    };
    const { kontext, seite } = await neueSeite({ width: 420, height: 820 });
    await kontext.addInitScript(zaehler);
    const dateien = [];
    seite.on("response", (r) => { if (r.url().includes("/klang/")) dateien.push({ url: r.url(), ok: r.ok() }); });
    await seite.goto(`${BASIS}/ball`, { waitUntil: "load" });
    await seite.mouse.click(5, 5);
    const klang = await seite.evaluate(async () => {
      const K = window.ArcadeKlang;
      if (!K) return null;
      const ids = Object.keys(K.PLAETZE);
      [...new Set(ids.filter((i) => i.includes(".")).map((i) => i.split(".")[0]))].forEach((b) => K.vorladen(b));
      const bis = Date.now() + 8000;
      while (Date.now() < bis && document.readyState !== "complete") await new Promise((r) => setTimeout(r, 50));
      await new Promise((r) => setTimeout(r, 2500));
      const stumm = [];
      for (const id of ids) {
        const vor = window.__klangKnoten;
        if (K.PLAETZE[id].schleife) {
          const k = K.kulisse(id);
          k.setze(0.8);
          await new Promise((r) => setTimeout(r, 400));
          k.stop();
        } else K.ton(id, { stufe: 2 });
        await new Promise((r) => setTimeout(r, 30));
        if (window.__klangKnoten === vor && id !== "frosch.ambient") stumm.push(id);
      }
      K.kulisse("huegel.wind");
      K.stille();
      return { ids: ids.length, stumm, laeuft: K.laeuft("huegel.wind"), dateien: new Set(ids.map((i) => K.PLAETZE[i].d).filter(Boolean)).size };
    });
    pruefe(klang && klang.ids === 210, `klang.js kennt nicht alle 210 Plätze: ${JSON.stringify(klang)}`);
    pruefe(klang && klang.stumm.length === 0, `Diese Klänge erzeugen keinen Ton: ${klang?.stumm?.join(", ")}`);
    pruefe(klang && !klang.laeuft, "stille() hält die Kulissen nicht an.");
    pruefe(klang && dateien.filter((d) => d.ok).length >= klang.dateien && dateien.every((d) => d.ok),
      `Nicht jede Aufnahme unter klang/ lädt: ${dateien.filter((d) => !d.ok).map((d) => d.url).join(", ") || `${dateien.length} von ${klang?.dateien}`}`);
    await kontext.close();

    // Ton aus (der Schalter oben rechts): kein Klang, kein Fehler.
    const aus = await neueSeite({ width: 420, height: 820 });
    await aus.kontext.addInitScript(zaehler);
    await aus.kontext.addInitScript(() => { try { localStorage.setItem("lernapp.audioFeedback", "0"); } catch { /* privat */ } });
    await aus.seite.goto(`${BASIS}/ball`, { waitUntil: "load" });
    await aus.seite.mouse.click(5, 5);
    const stumm = await aus.seite.evaluate(async () => {
      const K = window.ArcadeKlang;
      const vor = window.__klangKnoten;
      ["punkt", "rekord", "ball.kick", "countdown"].forEach((id) => K.ton(id, { stufe: 3 }));
      const k = K.kulisse("ball.publikum");
      k.setze(0.9);
      k.stop();
      await new Promise((r) => setTimeout(r, 300));
      return window.__klangKnoten - vor;
    });
    pruefe(stumm === 0, `Bei ausgeschaltetem Ton entstehen trotzdem Klänge (${stumm}).`);
    await aus.kontext.close();
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

  // --- 6b. Offline vorbereiten, ohne Abzeichen ---------------------------------
  // Die Turnierseite lässt den Service Worker holen, was die Spiele des
  // Turniers ohne Netz brauchen – und zeigt davon nichts: Ob das Gerät
  // bereit ist, ist eine Auskunft für Entwickler (data-offline am Dokument),
  // nicht für Spieler. Bis November 2026 stand dafür oben ein Abzeichen
  // («Offline 60 %», «Offline bereit»).
  {
    const kontext = await browser.newContext({ viewport: { width: 1000, height: 640 } });
    await kontext.route("**/cloud.js*", (route) => route.fulfill({ contentType: "text/javascript; charset=utf-8", body: ATTRAPPE }));
    await kontext.route("https://www.gstatic.com/firebasejs/**", (route) => route.fulfill({ contentType: "text/javascript; charset=utf-8", body: "" }));
    const seite = await kontext.newPage();
    await seite.addInitScript((daten) => { window.__miniTurniereAnfang = daten; }, TURNIERE);
    await seite.goto(`${BASIS}/turnier?t=${HERBST}`, { waitUntil: "load" });
    await seite.waitForFunction(() => document.documentElement.dataset.offline === "bereit", null, { timeout: 60000 }).catch(() => {});
    const still = await seite.evaluate(() => ({
      offline: document.documentElement.dataset.offline || "",
      abzeichen: document.querySelectorAll(".tn-bereit").length,
      text: /Offline (bereit|wird|\d)/.test(document.body.innerText),
    }));
    pruefe(still.offline === "bereit" && !still.abzeichen && !still.text,
      `Turnierseite: Die Spiele werden nicht still für offline vorbereitet: ${JSON.stringify(still)}`);
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
