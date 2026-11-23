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
import vm from "node:vm";
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

const befundeVorab = [];

// --- Käsekästchen: Zugfolgen, nach den Regeln ausgerechnet -----------------------
// 4 × 4 Kästchen, Striche 0–19 waagrecht, 20–39 senkrecht (kaesekaestchen.js).
// Wer ein Kästchen schliesst, zieht nochmal – darum stehen die Folgen nicht
// einfach abwechselnd da, sondern mit dem, der jeweils dran ist.
const KK_SEITEN = Array.from({ length: 16 }, (_, k) => {
  const r = Math.floor(k / 4); const c = k % 4;
  return [r * 4 + c, (r + 1) * 4 + c, 20 + r * 5 + c, 20 + r * 5 + c + 1];
});
function kkFolge(wahl, beginnt) {
  const gez = new Array(40).fill(false);
  const punkte = { a: 0, b: 0 };
  const folge = [];
  let dran = beginnt;
  while (folge.length < 40) {
    const zug = wahl(gez, dran);
    gez[zug] = true;
    const neu = KK_SEITEN.filter((s) => s.includes(zug) && s.every((x) => gez[x])).length;
    punkte[dran] += neu;
    folge.push({ sitz: dran, zug: String(zug) });
    if (!neu) dran = dran === "a" ? "b" : "a";
  }
  return { folge, punkte };
}
const kkSeiten = (gez, k) => KK_SEITEN[k].filter((x) => gez[x]).length;
const kkSchliesst = (gez, l) => KK_SEITEN.some((s, k) => s.includes(l) && kkSeiten(gez, k) === 3);
const kkGibt = (gez, l) => KK_SEITEN.some((s, k) => s.includes(l) && kkSeiten(gez, k) === 2);
// Papa (a) nimmt jedes Kästchen und gibt keines her, solange es geht; Lena
// (b) nimmt keines und legt gern die dritte Seite hin.
const KK_SIEG = kkFolge((gez, dran) => {
  const frei = [...Array(40).keys()].filter((l) => !gez[l]);
  if (dran === "a") return frei.find((l) => kkSchliesst(gez, l)) ?? frei.find((l) => !kkGibt(gez, l)) ?? frei[0];
  return frei.find((l) => !kkSchliesst(gez, l) && kkGibt(gez, l)) ?? frei.find((l) => !kkSchliesst(gez, l)) ?? frei[0];
}, "a");
// Ein Unentschieden, das Lena beginnt: zufällig (mit Saat), bis es acht zu
// acht steht.
const KK_REMIS = (() => {
  let zufall = 777;
  const wuerfel = () => { zufall = (Math.imul(zufall, 1103515245) + 12345) >>> 0; return zufall / 4294967296; };
  for (let p = 0; p < 2000; p += 1) {
    const r = kkFolge((gez) => { const frei = [...Array(40).keys()].filter((l) => !gez[l]); return frei[Math.floor(wuerfel() * frei.length)]; }, "b");
    if (r.punkte.a === 8) return r;
  }
  return null;
})();

// --- Mühle: eine Partie, die a gewinnt – mit den Regeln aus muehle.js, ---------------
// gespielt vom Computer selbst («Mittel» gegen «Ganz leicht», mit festem
// Zufall, damit es jedes Mal dieselbe ist).
function spielAusDatei(datei, seite) {
  const kasten = vm.createContext({ window: {}, document: { body: { dataset: { page: seite } } } });
  vm.runInContext("Math.random = (() => { let t = 20261123; return () => { t = (Math.imul(t, 1103515245) + 12345) >>> 0; return t / 4294967296; }; })();", kasten);
  let spiel = null;
  kasten.window.LernappZwei = { starte: (s) => { spiel = s; }, el: () => ({}), anderer: (s) => (s === "a" ? "b" : "a") };
  vm.runInContext(readFileSync(path.join(path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."), datei), "utf8"), kasten);
  return spiel;
}
const MH_SIEG = (() => {
  const M = spielAusDatei("muehle.js", "muehle");
  if (!M) return null;
  for (let versuch = 0; versuch < 10; versuch += 1) {
    const zuege = [];
    let l = M.lage(zuege, { roh: "", beginnt: "a" });
    while (!l.ende && zuege.length < 400) {
      zuege.push(M.computer(l, l.dran, l.dran === "a" ? "mittel" : "leicht"));
      l = M.lage(zuege, { roh: zuege.join("."), beginnt: "a" });
    }
    if (l.ende === "a") {
      let dran = "a";
      const folge = zuege.map((zug, i) => {
        const vorher = M.lage(zuege.slice(0, i), { roh: zuege.slice(0, i).join("."), beginnt: "a" });
        dran = vorher.dran;
        return { sitz: dran, zug };
      });
      return { folge, steineA: l.brett.filter((x) => x === "a").length };
    }
  }
  return null;
})();
// Schach: ein Feld wie «e2» als Nummer (0 = a8, oben links).
const scFeld = (t) => "abcdefgh".indexOf(t[0]) + (8 - Number(t[1])) * 8;
// Ein Zug als Tipps: von (beim Ziehen), nach, und was genommen wird.
const mhTipps = (z) => { const m = /^(?:(\d+)-)?(\d+)(?:x(\d+))?$/.exec(z); return [m[1], m[2], m[3]].filter((x) => x !== undefined); };

// --- Was jedes Spiel wissen muss --------------------------------------------------
/*
 *   brett        woran man sieht, dass das Brett steht
 *   tippe(s, z)  den Zug z tippen (s ist die Seite)
 *   kannTippen(s, z)  ob das gerade geht (der Knopf frei ist)
 *   liegt(s)     wie viel auf dem Brett liegt (Zeichen, Steine, Schüsse …)
 *   waehle(lage, s)  ein Zug für a gegen den Computer – oder null, wenn a
 *                gerade nichts zu tippen hat (darf auch async sein)
 *   sieg         Züge der Reihe nach, a beginnt und gewinnt – oder eine
 *                Funktion ({ papa, lena, raum, nr }) → [{ g, zug }], wenn
 *                die Züge erst im Spiel feststehen (eine versteckte Flotte)
 *   siegZeichen  was danach bei Lena leuchtet, und wie viele
 *   remis        Züge der Reihe nach bis zum Unentschieden (oder null)
 *   trenner      zwischen den Zügen in der Datenbank (wie im Spiel; "")
 *   vorbereiten(s)   was vor dem ersten Zug zu tun ist (Schiffe verstecken)
 *   nachNeuladen(s, pruefe)  was nach dem Neuladen noch da sein muss
 *   schwerSpielen    false: keine Partie gegen die schwerste Stufe (dauert
 *                    zu lange, oder das Glück entscheidet mit)
 *   computerZuege    gegen den Computer nur so viele eigene Züge, dann «Neu
 *                    anfangen» (eine ganze Partie dauert zu lange: Schach)
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
  schiffe: {
    brett: ".zw-sv",
    tippe: (s, z) => s.locator(`.zw-sv-meer.ist-gegner .zw-sv-zelle[data-feld="${z.slice(1)}"]`).click(),
    kannTippen: (s, z) => s.locator(`.zw-sv-meer.ist-gegner .zw-sv-zelle[data-feld="${z.slice(1)}"]:not([disabled])`).count().then((n) => n === 1),
    liegt: (s) => s.locator(".zw-sv-zelle.ist-wasser, .zw-sv-zelle.ist-treffer").count(),
    // Wer am Zug ist, sucht um Treffer herum, sonst das erste freie Feld.
    waehle: async (lage, s) => {
      if (lage?.phase !== "schiessen" || lage.dran !== "a") return null;
      const f = await s.evaluate(() => {
        const frei = [...document.querySelectorAll(".zw-sv-meer.ist-gegner .zw-sv-zelle:not([disabled])")].map((z) => Number(z.dataset.feld));
        const treffer = [...document.querySelectorAll(".zw-sv-meer.ist-gegner .zw-sv-zelle.ist-treffer:not(.ist-versenkt)")].map((z) => Number(z.dataset.feld));
        const nah = frei.filter((x) => treffer.some((t) => (Math.abs(t - x) === 1 && Math.floor(t / 8) === Math.floor(x / 8)) || Math.abs(t - x) === 8));
        return (nah.length ? nah : frei)[0];
      });
      return f === undefined ? null : `S${f}`;
    },
    vorbereiten: async (s) => {
      // Erst wenn die Seite weiss, wo sie sitzt.
      const muss = await bis(() => s.evaluate(() => Boolean(window.LernappZwei?.test?.lage?.()?.phase && window.LernappZwei?.test?.sitz?.())), { ms: 6000 });
      if (!muss) return;
      const offen = await s.evaluate(() => {
        const l = window.LernappZwei.test.lage();
        return l.phase === "aufstellen" && !l.bereit[window.LernappZwei.test.sitz()];
      });
      if (offen) {
        await s.locator(".zw-sv-fertig").click();
        await bis(() => s.evaluate(() => window.LernappZwei.test.lage().bereit[window.LernappZwei.test.sitz()]), { ms: 5000 });
      }
    },
    // Papa kennt Lenas Flotte (aus ihrem Speicher) und trifft immer – wer
    // trifft, darf nochmal: zwölf Schüsse, und alles ist versenkt.
    sieg: async ({ papa, lena, raum, nr }) => {
      const flotte = await lena.seite.evaluate((k) => JSON.parse(localStorage.getItem("schiffe.flotten") || "{}")[k]?.f || [], `${raum}|${nr}|b`);
      return flotte.flat().map((f) => ({ g: papa, zug: `S${f}` }));
    },
    siegZeichen: [".zw-sv-meer.ist-gegner .zw-sv-rumpf.ist-gezeigt", 4],
    remis: null,
    trenner: ".",
    nachSieg: async (s, pruefe) => {
      pruefe(await s.locator(".zw-sv-meer.ist-meins .zw-sv-rumpf.ist-versenkt").count() === 4, "Schiffe versenken: Bei Lena liegen alle vier eigenen Schiffe versenkt da");
      const deckt = await s.evaluate(() => [...document.querySelectorAll(".zw-sv-zelle")].map((z) => getComputedStyle(z).opacity).filter((o) => o !== "1").length);
      pruefe(deckt === 0, `Schiffe versenken: Auch gesperrte Felder decken ganz (${deckt} nicht)`);
      const hoch = await s.evaluate(() => [...document.querySelectorAll(".zw-sv-gitter")].map((g) => {
        const r = g.getBoundingClientRect();
        const z = g.querySelector(".zw-sv-zelle").getBoundingClientRect();
        return Math.abs(z.height - r.height / 8) < 1.5;
      }));
      pruefe(hoch.length === 2 && hoch.every(Boolean), `Schiffe versenken: In beiden Meeren ist ein Feld ein Achtel hoch (${hoch})`);
    },
    nachNeuladen: async (s, pruefe) => {
      pruefe(await bis(() => s.locator(".zw-sv-meer.ist-meins .zw-sv-rumpf").count().then((n) => n === 4)), "Schiffe versenken: Nach dem Neuladen liegt die eigene Flotte noch da");
    },
    schwerSpielen: false,
  },
  kaesekaestchen: {
    brett: ".zw-kk-feld",
    tippe: (s, z) => s.locator(`.zw-kk-linie[data-linie="${z}"]`).click(),
    kannTippen: (s, z) => s.locator(`.zw-kk-linie[data-linie="${z}"]:not([disabled])`).count().then((n) => n === 1),
    liegt: (s) => s.locator(".zw-kk-linie.ist-gezogen").count(),
    // Gegen den Computer: ein Kästchen nehmen, sonst keine dritte Seite
    // hinlegen, sonst irgendeinen Strich.
    waehle: (lage) => {
      if (!lage || lage.dran !== "a") return null;
      const gez = lage.gezogen.map(Boolean);
      const frei = [...Array(40).keys()].filter((l) => !gez[l]);
      return String(frei.find((l) => kkSchliesst(gez, l)) ?? frei.find((l) => !kkGibt(gez, l)) ?? frei[0]);
    },
    sieg: ({ papa, lena }) => KK_SIEG.folge.map(({ sitz, zug }) => ({ g: sitz === "a" ? papa : lena, zug })),
    siegZeichen: [".zw-kk-box.ist-a", KK_SIEG.punkte.a],
    remis: KK_REMIS ? ({ papa, lena }) => KK_REMIS.folge.map(({ sitz, zug }) => ({ g: sitz === "a" ? papa : lena, zug })) : null,
    trenner: ".",
  },
  muehle: {
    brett: ".zw-mh-feld",
    tippe: async (s, z) => {
      for (const p of mhTipps(z)) {
        await s.locator(`.zw-mh-punkt[data-punkt="${p}"]`).click();
        await warte(60);
      }
    },
    kannTippen: (s, z) => s.locator(`.zw-mh-punkt[data-punkt="${mhTipps(z)[0]}"]:not([disabled])`).count().then((n) => n === 1),
    liegt: (s) => s.locator(".zw-mh-stein:not(.ist-weg):not(.ist-vorschau)").count(),
    // Gegen den Computer: eine Mühle, wenn es geht, sonst irgendein Zug.
    waehle: (lage) => {
      if (!lage || lage.dran !== "a" || !lage.legal?.length) return null;
      return lage.legal.find((z) => z.includes("x")) || lage.legal[Math.floor(Math.random() * lage.legal.length)];
    },
    sieg: ({ papa, lena }) => (MH_SIEG?.folge || []).map(({ sitz, zug }) => ({ g: sitz === "a" ? papa : lena, zug })),
    siegZeichen: [".zw-mh-stein.ist-a:not(.ist-weg):not(.ist-vorschau)", MH_SIEG?.steineA ?? -1],
    remis: null,
    trenner: ".",
    schwerSpielen: false,
  },
  schach: {
    brett: ".zw-sc-feld",
    tippe: async (s, z) => {
      await s.locator(`.zw-sc-zelle[data-feld="${scFeld(z.slice(0, 2))}"]`).click();
      await s.locator(`.zw-sc-zelle[data-feld="${scFeld(z.slice(2, 4))}"]`).click();
      if (z.length === 5) await s.locator(".zw-sc-umwandlung-knopf").nth("qrbn".indexOf(z[4])).click();
    },
    kannTippen: (s, z) => s.locator(`.zw-sc-zelle[data-feld="${scFeld(z.slice(0, 2))}"]:not([disabled])`).count().then((n) => n === 1),
    // Wie viel schon gezogen ist: Nach dem ersten Zug leuchten Start und Ziel.
    liegt: (s) => s.locator(".zw-sc-zelle.ist-letzter").count(),
    waehle: (lage) => {
      if (!lage || lage.dran !== "a" || !lage.legal?.length) return null;
      const schlagen = lage.legal.filter((z) => lage.brett[scFeld(z.slice(2, 4))]);
      return (schlagen.length ? schlagen : lage.legal)[0];
    },
    // Schäfermatt: Papa beginnt (Weiss) und setzt im vierten Zug matt.
    sieg: ["e2e4", "e7e5", "d1h5", "b8c6", "f1c4", "g8f6", "h5f7"],
    siegZeichen: [".zw-sc-zelle.ist-schach", 1],
    // Patt in zehn Zügen (Sam Loyd) – in der zweiten Partie beginnt Lena.
    remis: ["e2e3", "a7a5", "d1h5", "a8a6", "h5a5", "h7h5", "h2h4", "a6h6", "a5c7", "f7f6", "c7d7", "e8f7", "d7b7", "d8d3", "b7b8", "d3h7", "b8c8", "f7g6", "c8e6"],
    trenner: ".",
    schwerSpielen: false,
    computerZuege: 5,
  },
  paare: {
    brett: ".zw-pa-feld",
    tippe: (s, z) => s.locator(`.zw-pa-karte[data-karte="${z}"]`).click(),
    kannTippen: (s, z) => s.locator(`.zw-pa-karte[data-karte="${z}"]:not([disabled])`).count().then((n) => n === 1),
    liegt: (s) => s.locator(".zw-pa-karte.ist-offen").count(),
    // Gegen den Computer: wer die Karten kennt (aus der Lage), findet jedes Paar.
    waehle: (lage) => {
      if (!lage || lage.dran !== "a") return null;
      const frei = lage.karten.map((_, k) => k).filter((k) => !lage.besitz[k] && k !== lage.offen);
      if (lage.offen < 0) return String(frei[0]);
      return String(frei.find((k) => lage.karten[k] === lage.karten[lage.offen]));
    },
    // Papa deckt alle zwölf Paare nacheinander auf (die Auslage kommt aus der
    // Saat, darum steht die Folge erst im Spiel fest).
    sieg: async ({ papa }) => {
      const karten = await papa.seite.evaluate(() => window.LernappZwei.test.lage().karten);
      const frei = new Set(karten.keys());
      const folge = [];
      while (frei.size) {
        const k = Math.min(...frei);
        const p = [...frei].find((x) => x !== k && karten[x] === karten[k]);
        frei.delete(k); frei.delete(p);
        folge.push({ g: papa, zug: String(k) }, { g: papa, zug: String(p) });
      }
      return folge;
    },
    siegZeichen: [".zw-pa-karte.ist-paar.ist-a", 24],
    // Lena (beginnt) findet sechs Paare, deckt zwei falsche auf, Papa findet
    // die anderen sechs.
    remis: async ({ papa, lena }) => {
      const karten = await lena.seite.evaluate(() => window.LernappZwei.test.lage().karten);
      const frei = new Set(karten.keys());
      const folge = [];
      const paar = (g) => {
        const k = Math.min(...frei);
        const p = [...frei].find((x) => x !== k && karten[x] === karten[k]);
        frei.delete(k); frei.delete(p);
        folge.push({ g, zug: String(k) }, { g, zug: String(p) });
      };
      for (let i = 0; i < 6; i += 1) paar(lena);
      const k = Math.min(...frei);
      folge.push({ g: lena, zug: String(k) }, { g: lena, zug: String([...frei].find((x) => karten[x] !== karten[k])) });
      for (let i = 0; i < 6; i += 1) paar(papa);
      return folge;
    },
    trenner: ".",
    // Die Prüfung kennt alle Karten – sie schlägt auch «Schwer».
    schwerSpielen: false,
  },
};
if (!MH_SIEG) befundeVorab.push("Mühle: Keine Partie gefunden, die a gewinnt");
if (!(KK_SIEG.punkte.a > KK_SIEG.punkte.b)) befundeVorab.push(`Käsekästchen: Die ausgerechnete Siegfolge gewinnt nicht (${JSON.stringify(KK_SIEG.punkte)})`);
if (!KK_REMIS) befundeVorab.push("Käsekästchen: Kein Unentschieden gefunden");

const GEWAEHLT = process.argv.slice(2);
const ZU_PRUEFEN = ZWEI.filter((z) => z.seite !== "viererreihe" && (!GEWAEHLT.length || GEWAEHLT.includes(z.seite)));

// --- Innen ------------------------------------------------------------------------
const EMULATOR = process.env.FIREBASE_DATABASE_EMULATOR_HOST;
const PORT = Number(process.env.PORT || 4295);
const BASIS = `http://127.0.0.1:${PORT}`;
const BILDER = process.env.BILDER || "";
if (BILDER) mkdirSync(BILDER, { recursive: true });

const befunde = [...befundeVorab];
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
async function gegenComputer(g, z, w, stufe, { maxZuege = Infinity } = {}) {
  const seite = g.seite;
  await w.vorbereiten?.(seite);
  const bisSpaetestens = Date.now() + 240000;
  let eigene = 0;
  while (Date.now() < bisSpaetestens && eigene < maxZuege) {
    if (await seite.locator(".vr-nochmal").count()) break;
    const dran = await bis(async () => (await seite.locator(".vr-nochmal").count()) > 0
      || (await lageVon(seite))?.dran === "a", { ms: 8000 });
    if (!dran || await seite.locator(".vr-nochmal").count()) break;
    const zug = await w.waehle(await lageVon(seite), seite);
    if (zug === null || zug === undefined) { await warte(150); continue; }
    if (!await bis(() => w.kannTippen(seite, zug), { ms: 3000 })) continue;
    await w.tippe(seite, zug);
    eigene += 1;
    await warte(120);
  }
  if (eigene >= maxZuege) return null;
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
    await w.vorbereiten?.(papa.seite);
    pruefe(await bis(() => satz(papa.seite).then((t) => /Du beginnst/.test(t)), { ms: 4000 }), `${T}: Gegen den Computer beginnst du die erste Partie`);
    pruefe(new URL(papa.seite.url()).searchParams.get("gegen") === leicht, `${T}: Die Adresse sagt die Stufe`);
    if (w.computerZuege) {
      // Nur ein paar Züge – dann neu anfangen.
      await gegenComputer(papa, z, w, leicht, { maxZuege: w.computerZuege });
      pruefe(await bis(async () => (await lageVon(papa.seite))?.dran === "a"), `${T}: Der Computer antwortet auf jeden Zug`);
      await bild(papa.seite, fotos("2-computer"));
      await papa.seite.locator(".vr-neu").click();
    } else {
      const ende1 = await gegenComputer(papa, z, w, leicht);
      pruefe(/gewonnen|Unentschieden|unentschieden/.test(ende1), `${T}: Am Ende steht, wie es ausging (${ende1})`);
      await warte(700);
      await bild(papa.seite, fotos("2-computer-ende"));
      const bilanz = await papa.seite.evaluate((schluessel) => JSON.parse(localStorage.getItem(schluessel) || "{}"), `${id}.bilanz`);
      const gezaehlt = (bilanz[leicht]?.s || 0) + (bilanz[leicht]?.n || 0) + (bilanz[leicht]?.u || 0);
      pruefe(gezaehlt === 1, `${T}: Die Bilanz zählt die Partie (${JSON.stringify(bilanz)})`);
      await papa.seite.locator(".vr-nochmal").click();
    }
    await w.vorbereiten?.(papa.seite);
    pruefe(await bis(() => satz(papa.seite).then((t) => /Computer beginnt|Computer überlegt/.test(t))), `${T}: Die zweite Partie beginnt der Computer`);
    pruefe(await bis(() => w.liegt(papa.seite).then((n) => n >= 1), { ms: 6000 }), `${T}: Der Computer setzt als Erster`);
    await papa.seite.locator(".vr-menue-knopf").click();
    pruefe(await bis(() => papa.seite.locator(".vr-stufe").count().then((n) => n === stufen.length)), `${T}: Zurück im Menü`);

    // Auf der schwersten Stufe: Gewinnen sollte schwer sein – zumindest mit
    // der einfachen Spielweise der Prüfung.
    if (w.schwerSpielen !== false) {
      await papa.seite.locator(`.vr-stufe[data-stufe="${schwer}"]`).click();
      pruefe(await bis(() => papa.seite.locator(w.brett).count().then((n) => n === 1)), `${T} (${schwer}): Das Brett steht`);
      const ende2 = await gegenComputer(papa, z, w, schwer);
      pruefe(!/Du hast gewonnen/.test(ende2), `${T}: Gegen «${schwer}» gewinnt die einfache Spielweise nicht (${ende2})`);
      await papa.seite.locator(".vr-menue-knopf").click();
      pruefe(await bis(() => papa.seite.locator(".vr-stufe").count().then((n) => n === stufen.length)), `${T}: Wieder im Menü`);
    }

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
    await Promise.all([w.vorbereiten?.(papa.seite), w.vorbereiten?.(lena.seite)]);
    pruefe(await bis(() => satz(papa.seite).then((t) => /Du beginnst/.test(t))), `${T}: Wer eröffnet, beginnt`);
    pruefe(await bis(() => satz(lena.seite).then((t) => /Papa ist dran/.test(t))), `${T}: Lena sieht, dass Papa dran ist`);

    const spiele = async (folge, beginnt, nr) => {
      const [erst, dann] = beginnt === "a" ? [papa, lena] : [lena, papa];
      const liste = typeof folge === "function"
        ? await folge({ papa, lena, raum, nr: nr - 1 })
        : folge.map((zug, i) => ({ g: i % 2 === 0 ? erst : dann, zug }));
      pruefe(liste.length > 0, `${T}: Für Partie ${nr} stehen Züge fest`);
      for (let i = 0; i < liste.length; i += 1) {
        const { g, zug } = liste[i];
        pruefe(await bis(() => w.kannTippen(g.seite, zug)), `${T}: ${g.name} darf in Partie ${nr} Zug ${i + 1} setzen (${zug})`);
        await w.tippe(g.seite, zug);
        // Gleich nach dem Zug kann niemand weitertippen.
        if (i === 0 && liste[1] && liste[1].g !== g) pruefe(await bis(async () => !(await w.kannTippen(g.seite, liste[1].zug)), { ms: 4000 }), `${T}: Nach dem Zug wartet ${g.name}`);
      }
      return liste;
    };
    await spiele(w.sieg, "a", 1);
    pruefe(await bis(() => satz(papa.seite).then((t) => /du hast gewonnen/i.test(t))), `${T}: Papa hat gewonnen – bei Papa`);
    pruefe(await bis(() => satz(lena.seite).then((t) => /Papa hat gewonnen/.test(t))), `${T}: Papa hat gewonnen – bei Lena`);
    const [siegWahl, siegZahl] = w.siegZeichen;
    pruefe(await bis(() => lena.seite.locator(siegWahl).count().then((n) => n === siegZahl)), `${T}: Bei Lena leuchtet, womit Papa gewonnen hat`);
    await w.nachSieg?.(lena.seite, pruefe);
    pruefe((await lena.seite.locator(".vr-wer.ist-a .vr-wer-zahl").textContent()) === "1", `${T}: Die Bilanz: Papa 1`);
    await warte(800);
    await bild(lena.seite, fotos("3-duell-sieg"));

    await lena.seite.locator(".vr-nochmal").click();
    await Promise.all([w.vorbereiten?.(papa.seite), w.vorbereiten?.(lena.seite)]);
    pruefe(await bis(() => satz(lena.seite).then((t) => /Du beginnst/.test(t))), `${T}: Die zweite Partie beginnt Lena`);
    pruefe(await bis(() => satz(papa.seite).then((t) => /Lena ist dran/.test(t))), `${T}: Papa sieht, dass Lena beginnt`);
    pruefe(await bis(() => w.liegt(papa.seite).then((n) => n === 0), { ms: 3000 }), `${T}: Das Brett ist leer`);
    if (w.remis) {
      const remisListe = await spiele(w.remis, "b", 2);
      pruefe(await bis(() => satz(papa.seite).then((t) => /unentschieden/i.test(t))), `${T}: Unentschieden – bei Papa`);
      pruefe(await bis(() => satz(lena.seite).then((t) => /unentschieden/i.test(t))), `${T}: Unentschieden – bei Lena`);
      const st = await (await db(`partie/${raum}/stand`)).json();
      pruefe(st?.serie === "a" && st?.beginnt === "b" && st?.zuege === remisListe.map((x) => x.zug).join(w.trenner ?? "") && st?.nr === 1,
        `${T}: Der Stand in der Datenbank (${JSON.stringify(st)})`);
      await bild(papa.seite, fotos("4-duell-remis"));
    }

    // Neuladen: Papa sitzt wieder auf a, das Brett liegt noch.
    const vorher = await w.liegt(papa.seite);
    await papa.seite.reload();
    pruefe(await bis(() => papa.seite.locator(w.brett).count().then((n) => n === 1)), `${T}: Nach dem Neuladen steht das Brett`);
    pruefe(await bis(() => w.liegt(papa.seite).then((n) => n === vorher)), `${T}: Nach dem Neuladen liegt alles noch (${vorher})`);
    pruefe((await papa.seite.locator(".vr-wer.ist-a .vr-wer-name").textContent()).includes("Papa"), `${T}: Nach dem Neuladen ist Papa wieder auf a`);
    await w.nachNeuladen?.(papa.seite, pruefe);

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
    pruefe(await bis(() => miaT.seite.locator(w.brett).count().then((n) => n === 1)), `${T}: Ein Tipp, und Mia sitzt am Brett`);
    await Promise.all([w.vorbereiten?.(miaT.seite), w.vorbereiten?.(lenaT.seite)]);
    pruefe(await bis(() => satz(miaT.seite).then((t) => /Lena ist dran/.test(t))), `${T}: Mia sieht, dass Lena dran ist`);
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
      await Promise.all([w.vorbereiten?.(max.seite), w.vorbereiten?.(ben.seite)]);
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
