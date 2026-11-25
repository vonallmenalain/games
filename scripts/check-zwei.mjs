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
// Farbcode knacken: alle 1296 Codes aus vier Farben (auch doppelt), und die
// Antwort auf einen Versuch.
const FC_ALLE = [];
for (let a = 1; a <= 6; a += 1) for (let b = 1; b <= 6; b += 1) for (let c = 1; c <= 6; c += 1) for (let d = 1; d <= 6; d += 1) {
  FC_ALLE.push(`${a}${b}${c}${d}`);
}
const fcAntwort = (code, versuch) => {
  let p = 0;
  const rc = {};
  const rv = {};
  for (let i = 0; i < 4; i += 1) {
    if (versuch[i] === code[i]) p += 1;
    else { rc[code[i]] = (rc[code[i]] || 0) + 1; rv[versuch[i]] = (rv[versuch[i]] || 0) + 1; }
  }
  let d = 0;
  for (const f of Object.keys(rc)) d += Math.min(rc[f], rv[f] || 0);
  return [p, d];
};
// Einen Code eingeben wie ein Kind: Farbe antippen, dann den Platz – hier von
// rechts nach links; dieselbe Farbe bleibt in der Hand.
async function fcEingeben(s, code) {
  let hand = "";
  for (let i = 3; i >= 0; i -= 1) {
    if (code[i] !== hand) { await s.locator(`.zw-fc-farbe[data-farbe="${code[i]}"]`).click(); hand = code[i]; }
    await s.locator(`.zw-fc-platz[data-platz="${i}"]`).click();
  }
  await s.locator(".zw-fc-los:enabled").click({ timeout: 8000 });
}
// Der versteckte Code eines Sitzes aus dem Speicher seines Geräts – erst, wenn
// er wirklich dort liegt.
const fcCode = async (g, raum, nr, sitz) => {
  const lies = () => g.seite.evaluate((k) => JSON.parse(localStorage.getItem("farbcode.codes") || "{}")[k]?.c || "", `${raum}|${nr}|${sitz}`);
  await bis(() => lies().then((c) => FC_ALLE.includes(c)));
  return lies();
};
// Schatzkarte: die Regeln aus schatzkarte.js; eine Partie, die gelingt
// (der Sucher folgt jedem Hinweis) oder nicht (er gräbt nur am Start).
const SK = (() => { try { return spielAusDatei("schatzkarte.js", "schatzkarte"); } catch { return null; } })();
async function skFolge(raum, papa, lena, beginnt, folgen) {
  const saat = (await (await db(`partie/${raum}/stand`)).json())?.saat;
  const zuege = [];
  const g = (sitz) => (sitz === "a" ? papa : lena);
  let l = SK.lage(zuege, { roh: "", beginnt, saat, stufe: null });
  const liste = [];
  while (!l.ende && zuege.length < 300) {
    const zug = l.phase === "hinweis" ? SK.computer(l, l.dran).zug : (folgen ? `S${l.hinweis}` : "SG");
    liste.push({ g: g(l.dran), zug });
    zuege.push(zug);
    l = SK.lage(zuege, { roh: zuege.join("."), beginnt, saat, stufe: null });
  }
  return liste;
}
// Malen und Raten: die Runden aus malen.js; alles richtig – oder alles falsch.
const MR = (() => { try { return spielAusDatei("malen.js", "malen"); } catch { return null; } })();
async function mrFolge(raum, papa, lena, beginnt, richtig) {
  const saat = (await (await db(`partie/${raum}/stand`)).json())?.saat;
  const zuege = [];
  const liste = [];
  let l = MR.lage(zuege, { roh: "", beginnt, saat, stufe: null });
  while (!l.ende && zuege.length < 40) {
    const r = l.runden[l.runde];
    const zug = richtig ? `R${l.runde}:${r.richtig}` : `R${l.runde}:${r.wahl.findIndex((_, i) => i !== r.richtig && !l.falsch.includes(i))}`;
    liste.push({ g: l.rater === "a" ? papa : lena, zug });
    zuege.push(zug);
    l = MR.lage(zuege, { roh: zuege.join("."), beginnt, saat, stufe: null });
  }
  return liste;
}
// Zwillings-Labyrinth: die Regeln und der Weg aus zwillinge.js.
const ZL = (() => { try { return spielAusDatei("zwillinge.js", "zwillinge"); } catch { return null; } })();
// Bohnen säen: Papa (a) spielt wie «Schwer», Lena (b) wie «Ganz leicht» –
// mit festem Zufall, also jedes Mal dieselbe Partie. Ein Unentschieden, das
// Lena beginnt: zufällig (mit Saat), bis es 24 zu 24 steht.
const BS = (() => { try { return spielAusDatei("bohnen.js", "bohnen"); } catch { return null; } })();
const bsLage = (zuege, beginnt) => BS.lage(zuege, { roh: zuege.join("."), beginnt, saat: 1 });
const BS_SIEG = (() => {
  if (!BS) return null;
  const folge = [];
  const zuege = [];
  for (let l = bsLage(zuege, "a"); !l.ende; l = bsLage(zuege, "a")) {
    const zug = BS.computer(l, l.dran, l.dran === "a" ? "schwer" : "leicht").zug;
    folge.push({ sitz: l.dran, zug });
    zuege.push(zug);
  }
  return bsLage(zuege, "a").ende === "a" ? folge : null;
})();
const BS_REMIS = (() => {
  if (!BS) return null;
  let zufall = 777;
  const wuerfel = () => { zufall = (Math.imul(zufall, 1103515245) + 12345) >>> 0; return zufall / 4294967296; };
  for (let p = 0; p < 5000; p += 1) {
    const folge = [];
    const zuege = [];
    for (let l = bsLage(zuege, "b"); !l.ende; l = bsLage(zuege, "b")) {
      const offen = BS.fuerPruefung.REIHE[l.dran].filter((j) => l.mulden[j] > 0);
      const zug = String(offen[Math.floor(wuerfel() * offen.length)]);
      folge.push({ sitz: l.dran, zug });
      zuege.push(zug);
    }
    if (bsLage(zuege, "b").ende === "u") return folge;
  }
  return null;
})();
// Wolf und Schafe: Papa (a) beginnt, hat also die Schafe, und spielt wie
// «Schwer»; Lena (b) ist der Wolf und spielt wie «Ganz leicht» – mit festem
// Zufall immer dieselbe Partie, die Papa gewinnt.
const WS = (() => { try { return spielAusDatei("wolf.js", "wolf"); } catch { return null; } })();
const WS_SIEG = (() => {
  if (!WS) return null;
  const lage = (zuege) => WS.lage(zuege, { roh: zuege.join("."), beginnt: "a", saat: 1 });
  const folge = [];
  const zuege = [];
  for (let l = lage(zuege); !l.ende && zuege.length < 200; l = lage(zuege)) {
    const zug = WS.computer(l, l.dran, l.dran === "a" ? "schwer" : "leicht");
    folge.push({ sitz: l.dran, zug });
    zuege.push(zug);
  }
  return lage(zuege).ende === "a" ? folge : null;
})();
// Rate-Tier: die Regeln aus ratetier.js – die geheimen Tiere kommen aus der
// Saat der Partie.
const RT = (() => { try { return spielAusDatei("ratetier.js", "ratetier"); } catch { return null; } })();
// Brückenschlag: die Regeln und der Computer aus brueckenschlag.js.
const BK = (() => { try { return spielAusDatei("brueckenschlag.js", "brueckenschlag"); } catch { return null; } })();
// Steine kippen: Papa (a) spielt wie «Schwer», Lena wie «Ganz leicht» – mit
// festem Zufall immer dieselbe Partie. Ein Unentschieden, das Lena beginnt:
// zufällig (mit Saat), bis es gleich steht.
const KP = (() => { try { return spielAusDatei("kippen.js", "kippen"); } catch { return null; } })();
// Rechenduell: die Aufgaben aus rechnen.js (aus der Saat der Partie).
const RD = (() => { try { return spielAusDatei("rechnen.js", "rechnen"); } catch { return null; } })();
// Leiterspiel: die Würfel kommen aus der Saat der Partie – Papa wählt klug,
// Lena ungeschickt, bis Papa gewinnt (mit wechselnder Wahl, falls nötig).
const LT = (() => { try { return spielAusDatei("leiter.js", "leiter"); } catch { return null; } })();
// Baumeister: der Plan kommt aus Saat und Runde (bmPlan) – so weiss die
// Prüfung, was die Planerin antworten muss.
const BM = (() => { try { return spielAusDatei("baumeister.js", "baumeister"); } catch { return null; } })();
// Echo-Duett: die Länge der Melodie kommt aus der Saat der Partie.
const EC = (() => { try { return spielAusDatei("echo.js", "echo"); } catch { return null; } })();
// Kanu zu zweit: Die Fahrt plant die Prüfung mit kanu.js selbst (zwei gute
// Partner, oder böse: auf die Felsen zu) und spielt die Schläge mit ihren
// Ticks ein – der Ausgang hängt nur an den Zügen, nicht an der Uhr.
function spielMitEchtzeit(datei, seite) {
  const kasten = vm.createContext({ window: {}, document: { body: { dataset: { page: seite } } }, performance });
  let spiel = null;
  kasten.window.LernappZwei = { starte: (s) => { spiel = s; }, el: () => ({}), anderer: (s) => (s === "a" ? "b" : "a") };
  vm.runInContext(readFileSync(path.join(WURZEL, "echtzeit.js"), "utf8"), kasten);
  vm.runInContext(readFileSync(path.join(WURZEL, datei), "utf8"), kasten);
  return spiel;
}
const KA = (() => { try { return spielMitEchtzeit("kanu.js", "kanu"); } catch { return null; } })();
async function kaFahrt({ papa, lena, raum }, boese) {
  const st = await (await db(`partie/${raum}/stand`)).json();
  const g = { a: papa, b: lena };
  const r = KA.fuerPruefung.fahrt(KA.fuerPruefung.flussVon(st?.saat, null), { boese });
  const wer = st?.beginnt === "b" ? lena : papa;
  return [{ g: wer, zug: "S" }, ...r.aktionen.map((a) => ({ g: g[a.wer], zug: `${a.wer}${a.tick}:${a.art}` })), { g: wer, zug: `E${r.endTick}` }];
}
async function ecSieg({ papa, lena, raum }) {
  const saat = (await (await db(`partie/${raum}/stand`)).json())?.saat;
  const ziel = EC.fuerPruefung.zielVon(saat, null);
  const folge = [];
  const melodie = [];
  for (let n = 0; n < ziel; n += 1) {
    const g = n % 2 === 0 ? papa : lena;
    melodie.forEach((k) => folge.push({ g, zug: `T${k}` }));
    const neu = (n * 3 + 1) % 4;
    melodie.push(neu);
    folge.push({ g, zug: `T${neu}` });
  }
  return folge;
}
async function bmFolge({ papa, lena, raum }, richtig) {
  const saat = (await (await db(`partie/${raum}/stand`)).json())?.saat;
  const st = (await (await db(`partie/${raum}/stand`)).json());
  const beginnt = st?.beginnt === "b" ? "b" : "a";
  const g = { a: papa, b: lena };
  const grad = BM.fuerPruefung.gradVon(saat, null);
  const folge = [];
  for (let r = 0; r < BM.fuerPruefung.RUNDEN; r += 1) {
    const planerin = r % 2 === 0 ? beginnt : (beginnt === "a" ? "b" : "a");
    const baut = planerin === "a" ? "b" : "a";
    folge.push({ g: g[planerin], zug: "M" });
    if (richtig) BM.fuerPruefung.plan(saat, r, grad).felder.forEach((f, i) => { if (f) folge.push({ g: g[baut], zug: `Q${i}` }, { g: g[planerin], zug: `A${f}` }, { g: g[baut], zug: `B${f}` }); });
    folge.push({ g: g[baut], zug: "X" });
  }
  return folge;
}
function ltSieg(saat) {
  const lage = (zuege) => LT.lage(zuege, { roh: zuege.join("."), beginnt: "a", saat });
  for (const [gut, schlecht] of [["schwer", "klein"], ["mittel", "klein"], ["schwer", "zufall"]]) {
    const folge = [];
    const zuege = [];
    for (let l = lage(zuege); !l.ende && zuege.length < 400; l = lage(zuege)) {
      let zug;
      if (l.phase === "wuerfeln") zug = "W";
      else if (l.dran === "a") zug = LT.computer(l, "a", gut).zug;
      else {
        const nach = (k) => LT.fuerPruefung.ziel(l.brett, l.ort.b, l.liegt[k]).nach;
        zug = schlecht === "klein" ? (nach(0) <= nach(1) ? "Z0" : "Z1") : (zuege.length % 3 ? "Z0" : "Z1");
      }
      folge.push({ sitz: l.dran, zug });
      zuege.push(zug);
    }
    if (lage(zuege).ende === "a") return folge;
  }
  return null;
}
const kpLage = (zuege, beginnt) => KP.lage(zuege, { roh: zuege.join("."), beginnt, saat: 1 });
const KP_SIEG = (() => {
  if (!KP) return null;
  const folge = [];
  const zuege = [];
  for (let l = kpLage(zuege, "a"); !l.ende; l = kpLage(zuege, "a")) {
    const zug = KP.computer(l, l.dran, l.dran === "a" ? "schwer" : "leicht").zug;
    folge.push({ sitz: l.dran, zug });
    zuege.push(zug);
  }
  return kpLage(zuege, "a").ende === "a" ? folge : null;
})();
const KP_REMIS = (() => {
  if (!KP) return null;
  let zufall = 777;
  const wuerfel = () => { zufall = (Math.imul(zufall, 1103515245) + 12345) >>> 0; return zufall / 4294967296; };
  for (let p = 0; p < 5000; p += 1) {
    const folge = [];
    const zuege = [];
    for (let l = kpLage(zuege, "b"); !l.ende; l = kpLage(zuege, "b")) {
      const zug = String(l.moeglich[Math.floor(wuerfel() * l.moeglich.length)]);
      folge.push({ sitz: l.dran, zug });
      zuege.push(zug);
    }
    if (kpLage(zuege, "b").ende === "u") return folge;
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
 *   autoZuege        true: In der Datenbank stehen mehr Züge als getippt
 *                    (Antworten des Geräts, «bereit») – dort nicht vergleichen
 *   gleichzeitig     true: beide sind zugleich dran (Blitzpaar) – niemand
 *                    «beginnt», der Computer «setzt» nicht als Erster
 *   ersterOhneZug    true: wer beginnt, macht zuerst keinen Zug, sondern
 *                    etwas anderes (Malen und Raten: er malt) – der Computer
 *                    «setzt» also nicht als Erster
 *   selbstDran(lage) true, wenn man gegen den Computer etwas tun muss, das
 *                    kein Zug ist, obwohl er dran ist (Malen: man malt, er rät)
 *   selbst(seite, lage) das dann tun
 *   vorDemSieg({ papa, lena, raum, pruefe })  was vor dem Duell zu prüfen ist
 *   gemeinsam        true: ein Spiel miteinander – statt «Papa hat gewonnen»
 *                    heisst es bei beiden «geschafft»; remis ist dann eine
 *                    Partie, die nicht geschafft wird (remisText)
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
      // Erst wenn die Seite weiss, wo sie sitzt – und die neue Partie da ist
      // (nach «Nochmal» steht kurz noch die alte, fertige auf dem Brett).
      const muss = await bis(() => s.evaluate(() => { const l = window.LernappZwei?.test?.lage?.(); return Boolean(l?.phase && l.phase !== "ende" && window.LernappZwei?.test?.sitz?.()); }));
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
  },  farbcode: {
    brett: ".zw-fc",
    tippe: (s, z) => fcEingeben(s, z.slice(1)),
    kannTippen: (s) => s.evaluate(() => {
      const l = window.LernappZwei?.test?.lage?.();
      return Boolean(l && l.phase === "raten" && l.dran === window.LernappZwei.test.sitz()) && !document.querySelector(".zw-fc-eingabe")?.hidden;
    }),
    liegt: (s) => s.locator(".zw-fc-zeile:not(.ist-frei)").count(),
    // Gegen den Computer: ein Code, der zu allen Antworten passt.
    waehle: (lage) => {
      if (lage?.phase !== "raten" || lage.dran !== "a") return null;
      const passt = (code) => lage.versuche.a.every(({ versuch, platz, da }) => {
        const [p, d] = fcAntwort(code, versuch);
        return p === platz && d === da;
      });
      return `R${FC_ALLE.find(passt)}`;
    },
    vorbereiten: async (s) => {
      // Erst wenn die neue Partie da ist (nach «Nochmal» steht kurz noch die
      // alte, fertige auf dem Brett).
      if (!await bis(() => s.evaluate(() => { const l = window.LernappZwei?.test?.lage?.(); return Boolean(l?.phase && l.phase !== "ende" && window.LernappZwei?.test?.sitz?.()); }))) return;
      const offen = await s.evaluate(() => { const l = window.LernappZwei.test.lage(); return l.phase === "verstecken" && !l.bereit[window.LernappZwei.test.sitz()]; });
      if (!offen) return;
      // Ein Code mit doppelter Farbe.
      await fcEingeben(s, "2215");
      await bis(() => s.evaluate(() => window.LernappZwei.test.lage().bereit[window.LernappZwei.test.sitz()]));
    },
    // Papa kennt Lenas Code (aus ihrem Speicher) und knackt ihn sofort;
    // Lena rät daneben – nach der ersten Runde hat Papa gewonnen.
    sieg: async ({ papa, lena, raum, nr }) => {
      const code = await fcCode(lena, raum, nr, "b");
      const papas = await fcCode(papa, raum, nr, "a");
      return [{ g: papa, zug: `R${code}` }, { g: lena, zug: `R${FC_ALLE.find((c) => c !== papas)}` }];
    },
    siegZeichen: [".zw-fc-tafel.ist-angriff .zw-fc-geheim .zw-fc-stift:not(.ist-geheim)", 4],
    // Beide knacken in der ersten Runde: unentschieden.
    remis: async ({ papa, lena, raum, nr }) => [
      { g: lena, zug: `R${await fcCode(papa, raum, nr, "a")}` },
      { g: papa, zug: `R${await fcCode(lena, raum, nr, "b")}` },
    ],
    trenner: ".",
    autoZuege: true,
    schwerSpielen: false,
  },
  blitzpaar: {
    brett: ".zw-bp-feld",
    tippe: (s, z) => s.locator(`.zw-bp-bild[data-feld="${z.split(":")[1]}"]`).click(),
    kannTippen: (s, z) => s.locator(`.zw-bp-bild[data-feld="${z.split(":")[1]}"]:not([disabled])`).count().then((n) => n === 1),
    liegt: (s) => s.evaluate(() => { const l = window.LernappZwei?.test?.lage?.(); return l ? l.punkte.a + l.punkte.b : -1; }),
    // Gegen den Computer: wer das Paar kennt (aus der Lage), tippt es an.
    waehle: (lage) => (lage && !lage.ende && lage.gesperrt.a < 0 ? `a${lage.nr}:${lage.runde.paar[0]}` : null),
    // Papa trifft fünf Runden nacheinander. Die Runden kommen aus der Saat
    // der Partie (aus der Datenbank) und den Regeln aus blitzpaar.js.
    sieg: async ({ papa, raum }) => {
      const B = spielAusDatei("blitzpaar.js", "blitzpaar");
      const saat = (await (await db(`partie/${raum}/stand`)).json())?.saat;
      const zuege = [];
      for (let i = 0; i < 5; i += 1) zuege.push(`a${i}:${B.lage(zuege, { roh: zuege.join("."), beginnt: "a", saat }).runde.paar[0]}`);
      return zuege.map((zug) => ({ g: papa, zug }));
    },
    siegZeichen: [".zw-bp-bild.ist-treffer.ist-a", 1],
    nachSieg: async (s, pruefe) => {
      const texte = await s.locator(".zw-bp-bild").allTextContents();
      pruefe(texte.length === 12 && texte.every((t) => t && !/\d/.test(t)), `Blitzpaar: Auf den Karten stehen Bilder, keine Nummern (${texte.join(" ")})`);
    },
    remis: null,
    trenner: ".",
    gleichzeitig: true,
    schwerSpielen: false,
  },
  schatzkarte: {
    brett: ".zw-sk-feld",
    tippe: (s, z) => s.locator(`.zw-sk-pfeil.ist-${z[1]}`).click(),
    kannTippen: (s, z) => s.evaluate((art) => {
      const l = window.LernappZwei?.test?.lage?.();
      const ich = window.LernappZwei?.test?.sitz?.();
      return Boolean(l && ich && l.dran === ich && (art === "H" ? l.phase === "hinweis" : l.phase === "schritt"))
        && !document.querySelector(".zw-sk-pfeil")?.disabled;
    }, z[0]),
    liegt: (s) => s.evaluate(() => window.LernappZwei?.test?.zuege?.().length ?? -1),
    // Gegen den Computer: als Kartenleserin den kürzesten Weg zeigen, als
    // Sucherin dem Hinweis folgen – mit den Regeln aus schatzkarte.js.
    waehle: (lage) => {
      if (!lage || lage.dran !== "a") return null;
      if (lage.phase === "schritt") return `S${lage.hinweis}`;
      // Die Lage kam als JSON: die Mengen wieder herstellen.
      const insel = { ...lage.insel, fels: new Set(lage.insel.felsen), grube: new Set(lage.insel.gruben) };
      return SK ? SK.computer({ ...lage, insel }, "a").zug : null;
    },
    // Papa (Karte) zeigt den Weg, Lena folgt – bis der Schatz da ist.
    sieg: async ({ papa, lena, raum }) => skFolge(raum, papa, lena, "a", true),
    siegZeichen: [".zw-sk-zelle.ist-gefunden", 1],
    // Die zweite Partie: Lena hat die Karte, Papa gräbt immer nur am Start –
    // bis die Schritte aus sind.
    remis: async ({ papa, lena, raum }) => skFolge(raum, papa, lena, "b", false),
    remisText: /Schritte sind aus/,
    trenner: ".",
    gemeinsam: true,
    schwerSpielen: false,
  },
  malen: {
    brett: ".zw-mr-papier",
    tippe: (s, z) => s.locator(`.zw-mr-antwort[data-antwort="${z.split(":")[1]}"]`).click(),
    kannTippen: (s, z) => s.locator(`.zw-mr-antwort[data-antwort="${z.split(":")[1]}"]:not([disabled])`).count().then((n) => n === 1),
    liegt: (s) => s.evaluate(() => window.LernappZwei?.test?.zuege?.().length ?? -1),
    // Gegen den Computer: Malt er, rät man – die Prüfung weiss die Antwort.
    waehle: (lage) => (lage && lage.dran === "a" ? `R${lage.runde}:${lage.runden[lage.runde].richtig}` : null),
    // Malt man selbst, malt die Prüfung das Bild des Wortes mit der Maus nach
    // (kleiner und verschoben) und tippt «Fertig – rate!»; der Computer rät.
    selbstDran: (lage) => Boolean(lage && !lage.ende && lage.maler === "a" && lage.dran === "b"),
    selbst: async (seite, lage) => {
      const wort = lage.runden[lage.runde].wort;
      const striche = MR.fuerPruefung.WOERTER[wort].malen();
      const box = await seite.locator(".zw-mr-leinwand").boundingBox();
      const hin = ([x, y]) => [box.x + box.width * (0.1 + (x / 1000) * 0.75), box.y + box.height * (0.15 + (y / 1000) * 0.75)];
      for (const strich of striche) {
        const [x0, y0] = hin(strich[0]);
        await seite.mouse.move(x0, y0);
        await seite.mouse.down();
        for (const p of strich.slice(1)) { const [x, y] = hin(p); await seite.mouse.move(x, y, { steps: 2 }); }
        await seite.mouse.up();
      }
      await seite.locator(".zw-mr-fertig:not([disabled])").click({ timeout: 5000 });
    },
    // Bevor geraten wird: Papa malt einen Strich, und Lena sieht ihn.
    vorDemSieg: async ({ papa, lena, raum, pruefe }) => {
      const box = await papa.seite.locator(".zw-mr-leinwand").boundingBox();
      await papa.seite.mouse.move(box.x + box.width * 0.2, box.y + box.height * 0.2);
      await papa.seite.mouse.down();
      for (let i = 1; i <= 10; i += 1) await papa.seite.mouse.move(box.x + box.width * (0.2 + i * 0.06), box.y + box.height * (0.2 + i * 0.05));
      await papa.seite.mouse.up();
      pruefe(await bis(async () => /^[0-9,;|]+$/.test((await (await db(`partie/${raum}/live/0-0`)).json()) || "")), "Malen und Raten: Der Strich steht im Live-Ort der Datenbank");
      const sieht = await bis(() => lena.seite.evaluate(() => {
        const c = document.querySelector(".zw-mr-leinwand");
        const d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data;
        let dunkel = 0;
        for (let i = 3; i < d.length; i += 4) if (d[i] > 200) dunkel += 1;
        return dunkel > 50;
      }));
      pruefe(sieht, "Malen und Raten: Lena sieht Papas Strich auf ihrem Papier");
      pruefe(await papa.seite.locator(".zw-mr-auftrag").isVisible() && !(await lena.seite.locator(".zw-mr-auftrag").isVisible()), "Malen und Raten: Nur wer malt, sieht das Wort");
    },
    sieg: async ({ papa, lena, raum }) => mrFolge(raum, papa, lena, "a", true),
    siegZeichen: [".vr-satz.ist-sieg", 1],
    remis: async ({ papa, lena, raum }) => mrFolge(raum, papa, lena, "b", false),
    remisText: /zu wenig erraten/,
    trenner: ".",
    gemeinsam: true,
    ersterOhneZug: true,
    schwerSpielen: false,
  },  wackelturm: {
    brett: ".zw-wt-himmel",
    // «D*»: der echte Knopf, wo der Klotz gerade schwingt; sonst über den
    // Prüf-Zugang genau an die Stelle (das Schwingen lässt sich nicht
    // abpassen).
    tippe: async (s, z) => {
      if (z === "D*") await s.locator(".zw-wt-los").click();
      else await s.evaluate((zug) => window.LernappZwei.test.zug(zug), z);
    },
    kannTippen: (s, z) => (z === "D*"
      ? s.locator(".zw-wt-los:not([disabled])").count().then((n) => n === 1)
      : s.evaluate(() => { const l = window.LernappZwei?.test?.lage?.(); return Boolean(l && l.dran && l.dran === window.LernappZwei.test.sitz()); })),
    liegt: (s) => s.evaluate(() => window.LernappZwei?.test?.zuege?.().length ?? -1),
    // Gegen den Computer: der erste Klotz mit dem echten Knopf, dann genau
    // auf die Spitze.
    waehle: (lage) => {
      if (!lage || lage.dran !== "a") return null;
      const oben = lage.kloetze[lage.kloetze.length - 1];
      return oben ? `D${oben.x}` : "D*";
    },
    // Zehn Klötze genau übereinander – bis zur Wolke.
    sieg: Array(10).fill("D500"),
    siegZeichen: [".zw-wt-turm .zw-wt-klotz", 10],
    // Lena beginnt, Papa lässt den Klotz weit daneben fallen: umgekippt.
    remis: ["D500", "D900"],
    remisText: /umgekippt/,
    trenner: ".",
    gemeinsam: true,
    schwerSpielen: false,
  },
  zwillinge: {
    brett: ".zw-zl-feld",
    tippe: (s, z) => s.locator(`.zw-zl-pfeil.ist-${z[1]}`).click(),
    kannTippen: (s, z) => s.locator(`.zw-zl-pfeil.ist-${z[1]}:not([disabled]):not(.ist-zu)`).count().then((n) => n === 1),
    liegt: (s) => s.evaluate(() => window.LernappZwei?.test?.zuege?.().length ?? -1),
    // Gegen den Computer: wie der Computer selbst – ein Schritt, der den
    // gemeinsamen Weg verkürzt, sonst warten.
    waehle: (lage) => (lage && !lage.ende && ZL ? ZL.computer(lage, "a")?.zug || null : null),
    // Beide gehen den kürzesten gemeinsamen Weg (aus zwillinge.js).
    sieg: async ({ papa, lena, raum }) => {
      const saat = (await (await db(`partie/${raum}/stand`)).json())?.saat;
      const l = ZL.lage([], { roh: "", beginnt: "a", saat, stufe: null });
      return ZL.fuerPruefung.plan(l).map((zug) => ({ g: zug[0] === "a" ? papa : lena, zug }));
    },
    siegZeichen: [".zw-zl-figur.ist-am-ziel", 2],
    // Papa läuft hin und her, bis die Schritte aus sind – in eine Richtung,
    // in die er vom Start aus gehen kann, und wieder zurück.
    remis: async ({ papa, raum }) => {
      const saat = (await (await db(`partie/${raum}/stand`)).json())?.saat;
      const l = ZL.lage([], { roh: "", beginnt: "b", saat, stufe: null });
      const zurueck = { N: "S", S: "N", O: "W", W: "O" };
      const hin = ["O", "W", "N", "S"].find((d) => ZL.darf(l, `a${d}`, "a") && ZL.darf(ZL.lage([`a${d}`], { roh: `a${d}`, beginnt: "b", saat, stufe: null }), `a${zurueck[d]}`, "a"));
      return Array.from({ length: l.schritte }, (_, i) => ({ g: papa, zug: `a${i % 2 ? zurueck[hin] : hin}` }));
    },
    remisText: /Schritte sind aus/,
    trenner: ".",
    gemeinsam: true,
    gleichzeitig: true,
    schwerSpielen: false,
  },
  bohnen: {
    brett: ".zw-bs-feld",
    tippe: (s, z) => s.locator(`.zw-bs-mulde[data-mulde="${z}"]`).click(),
    kannTippen: (s, z) => s.locator(`.zw-bs-mulde[data-mulde="${z}"]:not([disabled])`).count().then((n) => n === 1),
    // Wie viele Züge zu sehen sind (das Säen dauert einen Moment).
    liegt: (s) => s.locator(".zw-bs").getAttribute("data-zuege").then(Number).catch(() => -1),
    // Gegen den Computer: eine Mulde, deren letzte Bohne im Topf landet,
    // sonst die erste mit Bohnen.
    waehle: (lage) => {
      if (!lage || lage.dran !== "a") return null;
      const offen = [0, 1, 2, 3, 4, 5].filter((i) => lage.mulden[i] > 0);
      return String(offen.find((i) => lage.mulden[i] === 6 - i) ?? offen[0]);
    },
    sieg: ({ papa, lena }) => BS_SIEG.map(({ sitz, zug }) => ({ g: sitz === "a" ? papa : lena, zug })),
    siegZeichen: [".zw-bs-topf.ist-sieger.ist-a", 1],
    remis: BS_REMIS ? ({ papa, lena }) => BS_REMIS.map(({ sitz, zug }) => ({ g: sitz === "a" ? papa : lena, zug })) : null,
    trenner: ".",
    nachSieg: async (s, pruefe) => {
      // Bei Lena (b) liegt die eigene Reihe unten: die Mulden 7 bis 12.
      const unten = await s.evaluate(() => [...document.querySelectorAll(".zw-bs-mulde.ist-unten")].map((m) => m.dataset.mulde).join(","));
      pruefe(unten === "7,8,9,10,11,12", `Bohnen säen: Bei Lena liegt ihre eigene Reihe unten (${unten})`);
      const zahl = await s.evaluate(() => document.querySelector(".zw-bs-topf.ist-a .zw-bs-zahl")?.textContent);
      pruefe(Number(zahl) > 24, `Bohnen säen: In Papas Topf liegen mehr als die Hälfte der Bohnen (${zahl})`);
    },
  },
  wolf: {
    brett: ".zw-ws-gitter",
    // Erst die Figur (ist sie nicht gewählt, nochmal), dann das Ziel.
    tippe: async (s, z) => {
      const [von, nach] = z.split("-");
      const feld = (f) => s.locator(`.zw-ws-feld[data-feld="${f}"]`);
      if (!(await feld(von).evaluate((k) => k.classList.contains("ist-gewaehlt")))) await feld(von).click();
      if (!(await feld(von).evaluate((k) => k.classList.contains("ist-gewaehlt")))) await feld(von).click();
      await feld(nach).click();
    },
    kannTippen: (s, z) => s.locator(`.zw-ws-feld[data-feld="${z.split("-")[0]}"]:not([disabled])`).count().then((n) => n === 1),
    liegt: (s) => s.locator(".zw-ws").getAttribute("data-zuege").then(Number).catch(() => -1),
    // Gegen den Computer: wie der Computer auf «Einfach» – als Schafe oder
    // als Wolf, je nach Partie.
    waehle: (lage) => (lage && lage.dran === "a" && !lage.ende && WS ? WS.computer(lage, "a", "einfach") : null),
    sieg: ({ papa, lena }) => WS_SIEG.map(({ sitz, zug }) => ({ g: sitz === "a" ? papa : lena, zug })),
    siegZeichen: [".zw-ws-feld.ist-gefangen", 1],
    remis: null,
    trenner: ".",
    nachSieg: async (s, pruefe) => {
      // Lena hatte den Wolf: Bei ihr ist das Brett gedreht.
      pruefe(await s.locator(".zw-ws.ist-gedreht").count() === 1, "Wolf und Schafe: Bei Lena (Wolf) ist das Brett gedreht");
    },
  },
  ratetier: {
    brett: ".zw-rt-tiere",
    // Eine Frage antippen – oder ein Tier und dann «Raten!».
    tippe: async (s, z) => {
      if (z[0] === "F") { await s.locator(`.zw-rt-frage[data-frage="${z.slice(1)}"]`).click(); return; }
      const karte = s.locator(`.zw-rt-karte[data-tier="${z.slice(1)}"]`);
      if (!(await karte.evaluate((k) => k.classList.contains("ist-gewaehlt")))) await karte.click();
      await s.locator(".zw-rt-raten").click();
    },
    kannTippen: (s, z) => (z[0] === "F"
      ? s.locator(`.zw-rt-frage[data-frage="${z.slice(1)}"]:not([disabled])`).count().then((n) => n === 1)
      : s.locator(`.zw-rt-karte[data-tier="${z.slice(1)}"]:not([disabled])`).count().then((n) => n === 1)),
    liegt: (s) => s.locator(".zw-rt").getAttribute("data-zuege").then(Number).catch(() => -1),
    // Gegen den Computer: wie er selbst auf «Schwer».
    waehle: (lage) => (lage && lage.dran === "a" && !lage.ende && RT ? RT.computer(lage, "a", "schwer").zug : null),
    // Papa fragt, Lena fragt, Papa rät Lenas Tier (aus der Saat der Partie).
    sieg: async ({ papa, lena, raum }) => {
      const saat = (await (await db(`partie/${raum}/stand`)).json())?.saat;
      const g = RT.fuerPruefung.geheimeTiere(saat);
      return [{ g: papa, zug: "F1" }, { g: lena, zug: "F2" }, { g: papa, zug: `T${g.b}` }];
    },
    siegZeichen: [".zw-rt-karte.ist-richtig", 1],
    remis: null,
    trenner: ".",
    // Wer beginnt, ist im Vorteil, und das Glück entscheidet mit: Auch gut
    // gefragt gewinnt man gegen «Schwer» oft.
    schwerSpielen: false,
    nachSieg: async (s, pruefe) => {
      const frage = await s.evaluate(() => [...document.querySelectorAll(".zw-rt-chip")].length);
      pruefe(frage === 1, `Rate-Tier: Bei Lena steht, was Papa über ihr Tier gefragt hat (${frage})`);
      const weg = await s.locator(".zw-rt-karte.ist-weg").count();
      pruefe(weg > 0 && weg < 16, `Rate-Tier: Bei Lena sind nach ihrer Frage Tiere ausgeschlossen (${weg})`);
    },
  },
  brueckenschlag: {
    brett: ".zw-bk-feld",
    tippe: (s, z) => s.locator(`.zw-bk-zelle[data-feld="${z}"]`).click(),
    kannTippen: (s, z) => s.locator(`.zw-bk-zelle[data-feld="${z}"]:not([disabled])`).count().then((n) => n === 1),
    liegt: (s) => s.locator(".zw-bk-zelle.ist-a, .zw-bk-zelle.ist-b").count(),
    // Gegen den Computer: wie er selbst auf «Mittel».
    waehle: (lage) => (lage && lage.dran === "a" && !lage.ende && BK ? BK.computer(lage, "a", "mittel") : null),
    // Papa legt die mittlere Zeile von links nach rechts, Lena die oberste.
    sieg: ["21", "0", "22", "1", "23", "2", "24", "3", "25", "4", "26", "5", "27"],
    siegZeichen: [".zw-bk-zelle.ist-sieg", 7],
    remis: null,
    trenner: ".",
  },
  kippen: {
    brett: ".zw-kp-gitter",
    tippe: (s, z) => s.locator(`.zw-kp-feld[data-feld="${z}"]`).click(),
    kannTippen: (s, z) => s.locator(`.zw-kp-feld[data-feld="${z}"]:not([disabled])`).count().then((n) => n === 1),
    liegt: (s) => s.locator(".zw-kp").getAttribute("data-zuege").then(Number).catch(() => -1),
    // Gegen den Computer: wie er selbst auf «Einfach».
    waehle: (lage) => (lage && lage.dran === "a" && !lage.ende && KP ? KP.computer(lage, "a", "einfach").zug : null),
    sieg: ({ papa, lena }) => KP_SIEG.map(({ sitz, zug }) => ({ g: sitz === "a" ? papa : lena, zug })),
    siegZeichen: [".zw-kp.ist-sieg-a", 1],
    remis: KP_REMIS ? ({ papa, lena }) => KP_REMIS.map(({ sitz, zug }) => ({ g: sitz === "a" ? papa : lena, zug })) : null,
    trenner: ".",
  },
  rechnen: {
    brett: ".zw-rd-karte",
    tippe: (s, z) => s.locator(`.zw-rd-wahl[data-zug="${z}"]`).click(),
    kannTippen: (s, z) => s.locator(`.zw-rd-wahl[data-zug="${z}"]:not([disabled])`).count().then((n) => n === 1),
    liegt: (s) => s.locator(".zw-rd").getAttribute("data-zuege").then(Number).catch(() => -1),
    // Gegen den Computer: die Aufgabe ausrechnen und die richtige Antwort tippen.
    waehle: async (lage, s) => {
      if (!lage || lage.ende) return null;
      return s.evaluate(() => {
        const m = /^(\d+) ([+−×:]) (\d+)/.exec(document.querySelector(".zw-rd-aufgabe")?.textContent || "");
        if (!m) return null;
        const x = Number(m[1]); const y = Number(m[3]);
        const ergebnis = { "+": x + y, "−": x - y, "×": x * y, ":": x / y }[m[2]];
        const k = [...document.querySelectorAll(".zw-rd-wahl:not([disabled])")].find((b) => Number(b.textContent) === ergebnis);
        return k ? k.dataset.zug : null;
      });
    },
    // Papa rechnet fünf Aufgaben seiner Stufe («bis 10») richtig.
    sieg: async ({ papa, raum }) => {
      const saat = (await (await db(`partie/${raum}/stand`)).json())?.saat;
      const { aufgabe } = RD.fuerPruefung;
      return [0, 1, 2, 3, 4].map((i) => ({ g: papa, zug: `a${i}:0:${aufgabe(saat, "a", i, 0).richtig}` }));
    },
    siegZeichen: [".zw-rd.ist-sieg-andere", 1],
    remis: null,
    trenner: ".",
    gleichzeitig: true,
    // Die Prüfung tippt schneller als jedes Kind – gegen «Schwer» gewinnt sie.
    schwerSpielen: false,
  },
  leiter: {
    brett: ".zw-lt-feld",
    tippe: (s, z) => (z === "W" ? s.locator(".zw-lt-wuerfeln").click() : s.locator(`.zw-lt-wuerfel[data-wahl="${z[1]}"]`).click()),
    kannTippen: (s, z) => (z === "W"
      ? s.locator(".zw-lt-wuerfeln:not([hidden]):not([disabled])").count().then((n) => n === 1)
      : s.locator(`.zw-lt-wahlen:not([hidden]) .zw-lt-wuerfel[data-wahl="${z[1]}"]:not([disabled])`).count().then((n) => n === 1)),
    liegt: (s) => s.locator(".zw-lt").getAttribute("data-zuege").then(Number).catch(() => -1),
    // Gegen den Computer: würfeln, dann wählen wie «Mittel».
    waehle: (lage) => (lage && lage.dran === "a" && !lage.ende && LT ? LT.computer(lage, "a", "mittel").zug : null),
    sieg: async ({ papa, lena, raum }) => {
      const saat = (await (await db(`partie/${raum}/stand`)).json())?.saat;
      return (ltSieg(saat) || []).map(({ sitz, zug }) => ({ g: sitz === "a" ? papa : lena, zug }));
    },
    siegZeichen: [".zw-lt-figur.ist-a.ist-sieger", 1],
    remis: null,
    trenner: ".",
    // Würfelglück: Auch gut gewählt gewinnt man gegen «Schwer» oft.
    schwerSpielen: false,
  },
  baumeister: {
    brett: ".zw-bm-flaeche",
    tippe: (s, z) => {
      if (z === "M") return s.locator(".zw-bm-gemerkt").click();
      if (z === "X") return s.locator(".zw-bm-fertig").click();
      if (z[0] === "Q") return s.locator(`.zw-bm-feld[data-feld="${z.slice(1)}"]`).click();
      return s.locator(`.zw-bm-farbe[data-farbe="${z.slice(1)}"]`).click();
    },
    kannTippen: (s, z) => {
      const wahl = z === "M" ? ".zw-bm-gemerkt" : z === "X" ? ".zw-bm-fertig" : z[0] === "Q" ? `.zw-bm-feld[data-feld="${z.slice(1)}"]` : `.zw-bm-farben:not([hidden]) .zw-bm-farbe[data-farbe="${z.slice(1)}"]`;
      return s.locator(`${wahl}:not([hidden]):not([disabled])`).count().then((n) => n === 1);
    },
    liegt: (s) => s.locator(".zw-bm").getAttribute("data-zuege").then(Number).catch(() => -1),
    // Gegen den Computer: merken, richtig antworten, setzen, was er sagt,
    // jedes Feld fragen und dann fertig.
    waehle: (lage) => {
      if (!lage || lage.ende || lage.dran !== "a") return null;
      if (lage.phase === "merken") return "M";
      if (lage.phase === "antworten") return `A${lage.plan.felder[lage.frage]}`;
      if (lage.phase === "setzen") return `B${lage.antwort}`;
      const frei = lage.bau.findIndex((_, i) => !lage.gefragt.includes(i));
      return frei < 0 ? "X" : `Q${frei}`;
    },
    sieg: (ctx) => bmFolge(ctx, true),
    siegZeichen: [".zw-bm-runde.ist-ja", 4],
    // Lena beginnt, und niemand baut etwas: vier Runden nicht geschafft.
    remis: (ctx) => bmFolge(ctx, false),
    remisText: /nicht geschafft/i,
    trenner: ".",
    gemeinsam: true,
    autoZuege: false,
    schwerSpielen: false,
  },
  echo: {
    brett: ".zw-ec-felder",
    tippe: (s, z) => s.locator(`.zw-ec-feld[data-feld="${z[1]}"]`).click(),
    kannTippen: (s, z) => s.locator(`.zw-ec-feld[data-feld="${z[1]}"]:not([disabled])`).count().then((n) => n === 1),
    liegt: (s) => s.locator(".zw-ec").getAttribute("data-zuege").then(Number).catch(() => -1),
    // Gegen den Computer: die Melodie nachspielen, dann einen Ton anhängen.
    waehle: (lage) => (lage && lage.dran === "a" && !lage.ende ? `T${lage.pos < lage.melodie.length ? lage.melodie[lage.pos] : lage.melodie.length % 4}` : null),
    sieg: ecSieg,
    siegZeichen: [".zw-ec.ist-geschafft", 1],
    // Lena beginnt mit einem Ton, Papa vertut sich dreimal: nicht geschafft.
    remis: ({ papa, lena }) => [{ g: lena, zug: "T0" }, { g: papa, zug: "T1" }, { g: papa, zug: "T2" }, { g: papa, zug: "T3" }],
    remisText: /nicht geschafft/i,
    trenner: ".",
    gemeinsam: true,
    schwerSpielen: false,
  },
  kanu: {
    brett: ".zw-ka-fluss",
    // «S» und Paddeln über die Knöpfe, geplante Schläge und das Ende genau
    // mit ihrem Tick über den Prüf-Zugang.
    tippe: async (s, z) => {
      if (z === "S") await s.locator(".zw-ka-los").click();
      else if (z === "PADDEL") await s.locator(".zw-ka-paddeln").dispatchEvent("pointerdown");
      else await s.evaluate((zug) => window.LernappZwei.test.zug(zug), z);
    },
    kannTippen: (s, z) => {
      if (z === "S") return s.locator(".zw-ka-los:not([hidden]):not([disabled])").count().then((n) => n === 1);
      if (z === "PADDEL") return s.locator(".zw-ka-paddeln:not([hidden]):not([disabled])").count().then((n) => n === 1);
      return s.evaluate((zug) => { const t = window.LernappZwei?.test; const l = t?.lage?.(); return Boolean(l && l.phase === "fahrt" && (zug[0] === "E" || t.sitz() === zug[0])); }, z);
    },
    liegt: (s) => s.locator(".zw-ka").getAttribute("data-zuege").then(Number).catch(() => -1),
    // Gegen den Computer: «Los!», dann paddeln, bis die Fahrt aus ist.
    waehle: (lage) => (!lage || lage.ende ? null : lage.phase === "bereit" ? "S" : "PADDEL"),
    // Die Prüfung tippt langsamer, als ein Kind paddelt: Im Duell geht die
    // Uhr auf beiden Geräten zehnmal langsamer, damit die geplanten Schläge
    // vor ihrem Tick ankommen.
    vorDemSieg: ({ papa, lena }) => Promise.all([papa, lena].map((g) => g.seite.evaluate(() => {
      const echt = performance.now.bind(performance);
      const t0 = echt();
      performance.now = () => t0 + (echt() - t0) / 10;
    }))),
    sieg: (ctx) => kaFahrt(ctx, false),
    siegZeichen: [".zw-ka.ist-geschafft", 1],
    remis: (ctx) => kaFahrt(ctx, true),
    remisText: /nicht geschafft/i,
    trenner: ".",
    gemeinsam: true,
    gleichzeitig: true,
    autoZuege: false,
    schwerSpielen: false,
  },
};
if (!MH_SIEG) befundeVorab.push("Mühle: Keine Partie gefunden, die a gewinnt");
if (!BS_SIEG) befundeVorab.push("Bohnen säen: Keine Partie gefunden, die a gewinnt");
if (!BS_REMIS) befundeVorab.push("Bohnen säen: Kein Unentschieden gefunden");
if (!WS_SIEG) befundeVorab.push("Wolf und Schafe: Keine Partie gefunden, die a gewinnt");
if (!KP_SIEG) befundeVorab.push("Steine kippen: Keine Partie gefunden, die a gewinnt");
if (!KP_REMIS) befundeVorab.push("Steine kippen: Kein Unentschieden gefunden");
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
// Mit LAUT=1 steht jeder Befund sofort da (nicht erst am Schluss).
const pruefe = (bedingung, was) => { geprueft += 1; if (!bedingung) { befunde.push(was); if (process.env.LAUT) console.log(`✗ ${was}`); } };

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
    // Eine Sprachausgabe zum Mithören: Was vorgelesen wird, steht in
    // window.__gesprochen.
    // window.__sprachArt: «gut» (sonst), «stumm-einmal» (das erste Vorlesen
    // endet sofort ohne Ton, wie auf einem Xiaomi-Tablet), «nie» (keine
    // deutsche Stimme, jedes Vorlesen scheitert).
    const gesprochen = [];
    window.__gesprochen = gesprochen;
    window.__sprachWege = [];
    const art = () => window.__sprachArt || "gut";
    const stimme = { lang: "de-CH", name: "Prüfung", localService: true };
    let anzahl = 0;
    Object.defineProperty(window, "speechSynthesis", {
      configurable: true,
      value: {
        speaking: false,
        pending: false,
        speak(a) {
          anzahl += 1;
          gesprochen.push(a.text);
          window.__sprachWege.push({ lang: a.lang || "", stimme: a.voice?.name || "" });
          if (art() === "nie") { setTimeout(() => a.onerror?.({ error: "language-unavailable" }), 10); return; }
          if (art() === "stumm-einmal" && anzahl === 1) { setTimeout(() => a.onend?.(), 10); return; }
          setTimeout(() => a.onstart?.(), 5);
          setTimeout(() => a.onend?.(), 1500);
        },
        cancel() {},
        resume() {},
        getVoices: () => (art() === "nie" ? [] : [stimme]),
        addEventListener() {},
      },
    });
    window.SpeechSynthesisUtterance = function SpeechSynthesisUtterance(text) { this.text = text; };
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
      || ["a", "beide"].includes((await lageVon(seite))?.dran) || Boolean(w.selbstDran?.(await lageVon(seite))), { ms: 8000 });
    if (!dran || await seite.locator(".vr-nochmal").count()) break;
    const lageJetzt = await lageVon(seite);
    if (w.selbstDran?.(lageJetzt)) {
      await w.selbst(seite, lageJetzt);
      // Bis der Computer geantwortet hat.
      const vorher = JSON.stringify([lageJetzt.runde, lageJetzt.falsch]);
      await bis(async () => { const l = await lageVon(seite); return !l || l.ende || JSON.stringify([l.runde, l.falsch]) !== vorher; }, { ms: 12000 });
      continue;
    }
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

// Vorlesen, wenn das Gerät sich ziert: Endet das erste Vorlesen sofort ohne
// Ton (so auf einem Xiaomi-Tablet), versucht es der nächste Weg und spricht;
// gibt es gar keine deutsche Stimme, steht ein Hinweis da.
async function pruefeVorlesen(seiteName) {
  for (const art of ["stumm-einmal", "nie"]) {
    const g = await geraet(`Vorlesen ${art}`);
    await g.kontext.addInitScript((a) => { window.__sprachArt = a; }, art);
    await g.seite.goto(`${BASIS}/${seiteName}`);
    await g.seite.locator(".vr-unter .vl-knopf").click();
    if (art === "stumm-einmal") {
      const ok = await bis(() => g.seite.evaluate(() => window.__sprachWege.length >= 2));
      const wege = await g.seite.evaluate(() => window.__sprachWege);
      pruefe(ok && wege[0].stimme === "Prüfung" && wege[1].lang === "de-DE" && !wege[1].stimme, `Vorlesen: Endet es sofort ohne Ton, spricht der nächste Weg (${JSON.stringify(wege)})`);
      pruefe(await g.seite.locator(".vr-unter .vl-knopf.ist-spricht").count() === 1, "Vorlesen: Dann leuchtet der Lautsprecher, solange er spricht");
      pruefe(await g.seite.locator(".vl-hinweis").count() === 0, "Vorlesen: Klappt es, steht kein Hinweis da");
    } else {
      pruefe(await bis(() => g.seite.locator(".vl-hinweis").isVisible(), { ms: 5000 }), "Vorlesen: Ohne deutsche Stimme steht ein Hinweis da");
      pruefe(/deutsche Stimme/.test(await g.seite.locator(".vl-hinweis").textContent()) && /Sprachausgabe/.test(await g.seite.locator(".vl-hinweis").textContent()), "Vorlesen: Der Hinweis sagt, was fehlt und wo man es holt");
      pruefe(await g.seite.locator(".vl-knopf.ist-spricht").count() === 0, "Vorlesen: Der Lautsprecher leuchtet dann nicht mehr");
      pruefe((await g.seite.evaluate(() => window.__sprachWege.length)) === 2, "Vorlesen: Ohne Stimme versucht es zwei Wege (Deutsch, dann die des Geräts)");
    }
    await g.kontext.close();
  }
}

try {
  if (ZU_PRUEFEN.length) await pruefeVorlesen(ZU_PRUEFEN[0].seite);
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
    // Vorlesen: ein Lautsprecher neben der Beschreibung, bei den Stufen und
    // beim Duell.
    const gesagt = (s) => s.evaluate(() => window.__gesprochen.slice());
    pruefe(await papa.seite.locator(".vr-unter .vl-knopf").isVisible(), `${T}: Neben der Beschreibung steht ein Lautsprecher`);
    await papa.seite.locator(".vr-unter .vl-knopf").click();
    pruefe(await bis(() => gesagt(papa.seite).then((g) => g.some((x) => x.startsWith(`${T}.`) && x.length > T.length + 20))), `${T}: Der Lautsprecher liest Titel und Beschreibung vor`);
    if (stufen.length) {
      const ersteStufe = (await papa.seite.locator(".vr-stufe-name").first().textContent()).trim();
      await papa.seite.locator(".vr-karte-pc .vr-karte-titel .vl-knopf").click();
      pruefe(await bis(() => gesagt(papa.seite).then((g) => g.some((x) => x.startsWith("Gegen den Computer") && x.includes(`${ersteStufe}:`)))), `${T}: Die Stufen lassen sich vorlesen`);
    }
    pruefe(await papa.seite.locator(".vr-karte-live .vl-knopf").count() === 1, `${T}: «Zu zweit» lässt sich vorlesen`);
    await bild(papa.seite, fotos("1-menue"));

    const leicht = stufen[0];
    const schwer = stufen[stufen.length - 1];
    await papa.seite.locator(`.vr-stufe[data-stufe="${leicht}"]`).click();
    pruefe(await bis(() => papa.seite.locator(w.brett).count().then((n) => n === 1)), `${T}: Gegen den Computer steht das Brett`);
    await w.vorbereiten?.(papa.seite);
    if (!w.gleichzeitig) pruefe(await bis(() => satz(papa.seite).then((t) => /Du beginnst/.test(t)), { ms: 4000 }), `${T}: Gegen den Computer beginnst du die erste Partie`);
    // Der Lautsprecher beim Satz liest den Satz vor (und was das Spiel dazu sagt).
    {
      const vorher = (await gesagt(papa.seite)).length;
      const text = await satz(papa.seite);
      await papa.seite.locator(".vr-satz .vl-knopf").click();
      pruefe(await bis(() => gesagt(papa.seite).then((g) => g.length > vorher)), `${T}: Der Lautsprecher beim Satz liest vor`);
      const gelesen = (await gesagt(papa.seite)).at(-1) || "";
      const erwartet = await papa.seite.evaluate((t) => window.LernappVorlesen.sauber(t), text);
      if (text === await satz(papa.seite)) pruefe(gelesen.startsWith(erwartet), `${T}: Vorgelesen wird der Satz über dem Brett («${gelesen}» statt «${erwartet}»)`);
    }
    pruefe(new URL(papa.seite.url()).searchParams.get("gegen") === leicht, `${T}: Die Adresse sagt die Stufe`);
    if (w.computerZuege) {
      // Nur ein paar Züge – dann neu anfangen.
      await gegenComputer(papa, z, w, leicht, { maxZuege: w.computerZuege });
      pruefe(await bis(async () => (await lageVon(papa.seite))?.dran === "a"), `${T}: Der Computer antwortet auf jeden Zug`);
      await bild(papa.seite, fotos("2-computer"));
      await papa.seite.locator(".vr-neu").click();
    } else {
      const ende1 = await gegenComputer(papa, z, w, leicht);
      pruefe(await papa.seite.locator(".vr-satz.ist-ende").count() === 1, `${T}: Am Ende steht, wie es ausging (${ende1})`);
      await warte(700);
      await bild(papa.seite, fotos("2-computer-ende"));
      const bilanz = await papa.seite.evaluate((schluessel) => JSON.parse(localStorage.getItem(schluessel) || "{}"), `${id}.bilanz`);
      const gezaehlt = (bilanz[leicht]?.s || 0) + (bilanz[leicht]?.n || 0) + (bilanz[leicht]?.u || 0);
      pruefe(gezaehlt === 1, `${T}: Die Bilanz zählt die Partie (${JSON.stringify(bilanz)})`);
      await papa.seite.locator(".vr-nochmal").click();
    }
    await w.vorbereiten?.(papa.seite);
    if (!w.gleichzeitig) {
      pruefe(await bis(() => satz(papa.seite).then((t) => /Computer beginnt|Computer überlegt/.test(t))), `${T}: Die zweite Partie beginnt der Computer`);
      if (!w.ersterOhneZug) pruefe(await bis(() => w.liegt(papa.seite).then((n) => n >= 1), { ms: 6000 }), `${T}: Der Computer setzt als Erster`);
    } else pruefe(await bis(() => w.liegt(papa.seite).then((n) => n === 0), { ms: 4000 }), `${T}: Die zweite Partie beginnt frisch`);
    await papa.seite.locator(".vr-menue-knopf").click();
    pruefe(await bis(() => papa.seite.locator(".vr-stufe").count().then((n) => n === stufen.length)), `${T}: Zurück im Menü`);

    // Auf Tablets – quer, flach, hoch – steht beim ersten Zug alles im Bild
    // (bei Schiffe versenken: das Meer und «Fertig!»), auch wenn unten 64 px
    // fehlen (die Leiste, die manches Tablet im Vollbild nicht meldet).
    for (const [breit, hoch, name] of [[1280, 800, "Tablet quer"], [1180, 650, "Tablet flach"], [800, 1280, "Tablet hoch"]]) {
      const t = await geraet(`${name}`, { viewport: { width: breit, height: hoch } });
      await t.seite.goto(`${BASIS}/${z.seite}`);
      await t.seite.addStyleTag({ content: ".vr-seite { --vr-unten: 64px !important; }" });
      await bis(() => t.seite.locator(".vr-stufe").count().then((n) => n >= 1));
      await t.seite.locator(`.vr-stufe[data-stufe="${leicht}"]`).click();
      await bis(() => t.seite.locator(w.brett).count().then((n) => n === 1));
      await warte(1200);
      const m = await t.seite.evaluate(() => {
        const alle = [...document.querySelectorAll(".vr-seite *")].filter((e) => e.offsetParent && !e.closest(".confetti-layer"));
        const r = alle.map((e) => e.getBoundingClientRect()).filter((x) => x.width && x.height);
        return { unten: Math.max(...r.map((x) => x.bottom)), rechts: Math.max(...r.map((x) => x.right)), hoch: innerHeight, breit: innerWidth };
      });
      pruefe(m.unten <= m.hoch - 64 + 1, `${T} ${name} (${breit} × ${hoch}): alles steht im Bild, auch mit 64 px Leiste (unten ${Math.round(m.unten)} von ${m.hoch - 64})`);
      pruefe(m.rechts <= m.breit + 1, `${T} ${name}: nichts ragt rechts hinaus (${Math.round(m.rechts)} von ${m.breit})`);
      await bild(t.seite, fotos(`1-${name.replace(/\s+/g, "-").toLowerCase()}`));
      await t.kontext.close();
    }

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
    await papa.seite.locator(".vr-code-block .vl-knopf").click();
    pruefe(await bis(() => gesagt(papa.seite).then((g) => g.some((x) => x.includes(`Der Code ist: ${[...code].join(", ")}`)))), `${T}: Der Code lässt sich vorlesen`);

    const lena = await geraet("Lena", { viewport: { width: 820, height: 1000 } });
    await lena.seite.goto(`${BASIS}/${z.seite}`);
    await lena.seite.locator(".vr-code-feld").fill(code);
    await lena.seite.locator(".vr-code-ok").click();
    pruefe(await bis(() => lena.seite.locator(w.brett).count().then((n) => n === 1)), `${T}: Mit dem Code sitzt Lena am Brett`);
    pruefe(await bis(() => papa.seite.locator(w.brett).count().then((n) => n === 1)), `${T}: Papa sieht das Brett, sobald Lena da ist`);
    await Promise.all([w.vorbereiten?.(papa.seite), w.vorbereiten?.(lena.seite)]);
    if (!w.gleichzeitig) {
      pruefe(await bis(() => satz(papa.seite).then((t) => /Du beginnst/.test(t))), `${T}: Wer eröffnet, beginnt`);
      pruefe(await bis(() => satz(lena.seite).then((t) => /Papa ist dran/.test(t))), `${T}: Lena sieht, dass Papa dran ist`);
    }

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
    await w.vorDemSieg?.({ papa, lena, raum, pruefe });
    await spiele(w.sieg, "a", 1);
    if (w.gemeinsam) {
      pruefe(await bis(() => satz(papa.seite).then((t) => /geschafft/i.test(t))), `${T}: Geschafft – bei Papa`);
      pruefe(await bis(() => satz(lena.seite).then((t) => /geschafft/i.test(t))), `${T}: Geschafft – bei Lena`);
    } else {
      pruefe(await bis(() => satz(papa.seite).then((t) => /du hast gewonnen/i.test(t))), `${T}: Papa hat gewonnen – bei Papa`);
      pruefe(await bis(() => satz(lena.seite).then((t) => /Papa hat gewonnen/.test(t))), `${T}: Papa hat gewonnen – bei Lena`);
    }
    const [siegWahl, siegZahl] = w.siegZeichen;
    pruefe(await bis(() => lena.seite.locator(siegWahl).count().then((n) => n === siegZahl)), `${T}: Bei Lena leuchtet, womit Papa gewonnen hat`);
    await w.nachSieg?.(lena.seite, pruefe);
    if (w.gemeinsam) {
      // Miteinander: keine Punkte gegeneinander, nur die Namen mit «&».
      pruefe(!(await lena.seite.locator(".vr-wer-zahl").first().isVisible()) && !(await papa.seite.locator(".vr-wer-zahl").first().isVisible()), `${T}: Miteinander steht keine Punktzahl in der Leiste`);
      pruefe((await lena.seite.locator(".vr-leiste-mitte").textContent()) === "&", `${T}: Zwischen den Namen steht «&»`);
    } else pruefe((await lena.seite.locator(".vr-wer.ist-a .vr-wer-zahl").textContent()) === "1", `${T}: Die Bilanz: Papa 1`);
    await warte(800);
    await bild(lena.seite, fotos("3-duell-sieg"));

    await lena.seite.locator(".vr-nochmal").click();
    await Promise.all([w.vorbereiten?.(papa.seite), w.vorbereiten?.(lena.seite)]);
    if (!w.gleichzeitig) {
      pruefe(await bis(() => satz(lena.seite).then((t) => /Du beginnst/.test(t))), `${T}: Die zweite Partie beginnt Lena`);
      pruefe(await bis(() => satz(papa.seite).then((t) => /Lena ist dran/.test(t))), `${T}: Papa sieht, dass Lena beginnt`);
    }
    pruefe(await bis(() => w.liegt(papa.seite).then((n) => n === 0), { ms: 3000 }), `${T}: Das Brett ist leer`);
    if (w.remis) {
      const remisListe = await spiele(w.remis, "b", 2);
      const remisText = w.remisText || /unentschieden/i;
      pruefe(await bis(() => satz(papa.seite).then((t) => remisText.test(t))), `${T}: ${w.gemeinsam ? "Nicht geschafft" : "Unentschieden"} – bei Papa`);
      pruefe(await bis(() => satz(lena.seite).then((t) => remisText.test(t))), `${T}: ${w.gemeinsam ? "Nicht geschafft" : "Unentschieden"} – bei Lena`);
      const st = await (await db(`partie/${raum}/stand`)).json();
      pruefe(st?.serie === (w.gemeinsam ? "g" : "a") && st?.beginnt === "b" && (w.autoZuege || st?.zuege === remisListe.map((x) => x.zug).join(w.trenner ?? "")) && st?.nr === 1,
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
    pruefe(await bis(() => lenaT.seite.locator(".tn-bereich:not([hidden]) .tn-bereich-knopf").count().then((n) => n === 2)), `${T}: Im Turnier steht oben das Register «Allein» / «Zu zweit»`);
    pruefe(await bis(() => lenaT.seite.locator(".ar-kachel").count().then((n) => n > 0)) && await lenaT.seite.locator(".ar-vr-kachel").count() === 0, `${T}: Unter «Allein» die Bühne, ohne Spiele zu zweit`);
    await lenaT.seite.locator('.tn-bereich-knopf[data-reiter="zwei"]').click();
    pruefe(await bis(() => lenaT.seite.locator(".ar-vr-kachel.ist-gross").count().then((n) => n === ALLE_ZWEI.length)), `${T}: Unter «Zu zweit» stehen alle ${ALLE_ZWEI.length} Spiele zu zweit als grosse Karten`);
    const karten = await lenaT.seite.evaluate(() => {
      const raster = document.querySelector(".tn-zwei-karten").getBoundingClientRect();
      const r = [...document.querySelectorAll(".tn-zwei-karten .ar-vr-kachel")].map((k) => k.getBoundingClientRect());
      const ueber = r.some((a, i) => r.some((b, j) => j > i && a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1));
      return { oben: r[0].top >= raster.top - 1, ueber, breite: Math.round(r[0].width), buehne: document.querySelectorAll(".ar-buehne").length };
    });
    pruefe(karten.oben && !karten.ueber && karten.buehne === 0, `${T}: Die Karten statt der Bühne, die erste oben ganz im Bild, keine über der anderen (${JSON.stringify(karten)})`);
    pruefe(karten.breite >= 300, `${T}: Die Karten sind gross (${karten.breite} px breit)`);
    await lenaT.seite.locator(`a.ar-vr-kachel[href="/${z.seite}?turnier=${TURNIER_ID}"]`).click();
    pruefe(await bis(() => lenaT.seite.locator(".vr-eroeffnen").count().then((n) => n === 1)), `${T}: Im Turnier: das Menü`);
    pruefe((await lenaT.seite.locator(".vr-kopf .mini-knopf-zurueck").getAttribute("href")) === `/turnier?t=${TURNIER_ID}`, `${T}: Der Weg zurück führt ins Turnier`);
    await lenaT.seite.locator(".vr-eroeffnen").click();
    pruefe(await bis(() => lenaT.seite.locator(".vr-vorschau-knopf").count().then((n) => n === 1)), `${T}: Lena wartet im Turnier`);
    const raumT = new URL(lenaT.seite.url()).searchParams.get("raum") || "";
    pruefe(await bis(async () => (await (await db(`partieOffen/${TURNIER_ID}/${raumT}`)).json())?.spiel === id), `${T}: Lena wartet bei genau diesem Spiel`);

    await miaT.seite.goto(`${BASIS}/turnier?t=${TURNIER_ID}`);
    pruefe(await bis(() => miaT.seite.locator(".tn-bereich-knopf.ist-zwei.ist-wartet").count().then((n) => n === 1), { ms: 12000 }), `${T}: Bei Mia leuchtet unter «Allein» der Reiter «Zu zweit»`);
    await miaT.seite.locator('.tn-bereich-knopf[data-reiter="zwei"]').click();
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
    if (!w.gleichzeitig) {
      pruefe(await bis(() => satz(miaT.seite).then((t) => /Lena ist dran/.test(t))), `${T}: Mia sieht, dass Lena dran ist`);
      pruefe(await bis(() => satz(lenaT.seite).then((t) => /Du beginnst/.test(t))), `${T}: Lena sieht Mia kommen`);
    } else pruefe(await bis(() => lenaT.seite.locator(w.brett).count().then((n) => n === 1)), `${T}: Lena sieht Mia kommen`);
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
      pruefe(await bis(() => (w.gleichzeitig ? max.seite.locator(w.brett).count().then((n) => n === 1) : satz(max.seite).then((t) => /Du beginnst/.test(t)))), `${T}: Max sieht Ben kommen`);
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
