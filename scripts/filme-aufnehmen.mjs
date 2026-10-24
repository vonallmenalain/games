/*
 * Die Bilder und Filme der Startseite: echte Runden, aufgenommen.
 * ---------------------------------------------------------------------------
 * Die Startseite (alae arcade) zeigt jedes Spiel als Bild – mitten in einer
 * Runde, scharf, in der Form des Fensters. Gezeichnet wird es nicht, sondern
 * aufgenommen: Ein Autopilot spielt das echte Spiel, und im richtigen Moment
 * macht der Browser ein Bild, mit doppelter Pixeldichte. Wer ein Spiel ändert,
 * nimmt sein Bild neu auf.
 *
 *   node scripts/filme-aufnehmen.mjs --standbild      alle Bilder (npm run bilder)
 *   node scripts/filme-aufnehmen.mjs                  alle Filme (npm run filme)
 *   node scripts/filme-aufnehmen.mjs turmbau liane    nur diese
 *        --format quer|hoch                           nur eines der Formate
 *        --port 4380                                  der lokale Server
 *        --bilder <ordner>                            Einzelbilder der Filme dort lassen
 *
 * Die Bilder:
 *
 *   bilder/<seite>-quer.webp   16:9, 2560×1440 – für breite Bildschirme
 *   bilder/<seite>-hoch.webp   9:16, 1080×1920 – fürs Handy
 *   bilder/<seite>-klein.webp  480×270 – für die Zeile mit allen Spielen
 *
 * Die Filme (bis Oktober 2026 auf der Startseite, dort ausgeschaltet –
 * mini-games.js, FILME) bleiben aufnehmbar, wie unten beschrieben.
 *
 * Wie sich ein Spiel selbst spielt, steht in scripts/vorfuehrung/<seite>.mjs:
 *
 *   export default {
 *     bereit: () => Boolean(window.LernappTurmbau?.state),   in der Seite: geladen?
 *     spiele: () => { … },     in der Seite: der Autopilot, im Bildtakt
 *     vorlauf: 1500,           so lange wird gespielt, bevor die Aufnahme beginnt
 *     dauer: 9000,             so lange wird aufgenommen
 *     bild: 6000,              wann das Standbild entsteht (ms nach dem Start);
 *                              ohne: vorlauf + standbild (s im Film, sonst 3,2)
 *     bildWenn: () => …,       in der Seite: danach noch warten, bis das gilt
 *                              (der Moment, der das Spiel zeigt)
 *     stil: "…",               nach Bedarf: CSS nur für Bild und Film
 *   };
 *
 * Aufgenommen wird ohne Firestore (dieselbe Attrappe wie in check-spiele, aber
 * leer: kein Gegner läuft mit), ohne die Leiste oben und ohne den Satz vor dem
 * ersten Tipp – im Film steht nur das Spiel. Zwei Formate:
 *
 *   filme/<seite>-quer.mp4   16:9, 1280×720 – für breite Bildschirme
 *   filme/<seite>-hoch.mp4   9:16, 540×960  – fürs Handy
 *   filme/<seite>-quer.webp, -hoch.webp      ein Standbild daraus
 *
 * Die Bilder kommen Bild für Bild über das DevTools-Protokoll
 * (Page.startScreencast) mit ihrer Zeit. ffmpeg legt sie auf 30 Bilder je
 * Sekunde, blendet am Anfang auf und am Ende ab – die Startseite ist dunkel,
 * die Schleife beginnt und endet im Schwarz.
 *
 * Nötig: Playwright und ffmpeg (mit libx264 und libwebp).
 */
import { spawn, spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync, statSync } from "node:fs";
import os from "node:os";
import { SPIELE } from "./seiten-bauen.mjs";

const HIER = path.dirname(fileURLToPath(import.meta.url));
const WURZEL = path.resolve(HIER, "..");
const ZIEL = path.join(WURZEL, "filme");
const ZIEL_BILDER = path.join(WURZEL, "bilder");
const require = createRequire(path.join(WURZEL, "package.json"));
const { chromium } = require("playwright");

const args = process.argv.slice(2);
const wert = (name) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : null; };
const PORT = Number(wert("port") || 4380);
const NUR_FORMAT = wert("format");
const BILDER_BEHALTEN = wert("bilder");
const STANDBILD = args.includes("--standbild");
const OHNE_WERT = new Set(["--standbild"]);
const GEWAEHLT = args.filter((a, i) => !a.startsWith("--") && (!args[i - 1]?.startsWith("--") || OHNE_WERT.has(args[i - 1])));

// Breite und Höhe der Seite, gleich der Grösse des Films: Die Bilder des
// Screencasts kommen in CSS-Pixeln, ein Pixelfaktor über 1 brächte also nur
// ein kleineres Bild. Die Leiste ist weg (OHNE), und die Bühne liegt über dem
// ganzen Fenster.
const FORMATE = {
  quer: { breit: 1280, hoch: 720, dpr: 1, aus: [1280, 720] },
  hoch: { breit: 540, hoch: 960, dpr: 1, aus: [540, 960] },
};

// Was im Film nicht stehen soll: die Leiste, Vollbild und Ton, die Schalter
// der Gegner, der Satz vor dem ersten Tipp und sein Ring, die Tafel am Ende.
// Nicht aber die Frage zu jeder Welle in Blätter im Strom (.bs-frage): Sie
// ist das Spiel.
const OHNE = `
  .cm-bar, .cm-time, .cm-vollbild, .sound-toggle, .gs-leiste, .gs-chip, .cm-panel, .cm-result,
  [class$="-prompt"]:not(.bs-frage), [class*="-prompt "]:not(.bs-frage),
  [class$="-tipp"], [class*="-tipp "] { display: none !important; }
  .cm-stage, .cm-play { --cm-oben: 0px !important; }
  .cm-play { top: 0 !important; padding-top: 0 !important; padding-bottom: 0 !important; }
  /* Wie auf dem Handy (styles.css, max-height: 500px): Turmbau, Brücke,
     Drift, Liane, Tunnelflug und Schwerkraft-Läufer füllen die ganze Breite,
     statt in ihrem Seitenverhältnis oben zu kleben. */
  .tb-feld, .br-feld, .dr-feld, .li-feld, .tf-feld, .sl-feld {
    aspect-ratio: auto !important; left: 0 !important; right: 0 !important; width: 100% !important; transform: none !important;
  }
  html, body, * { cursor: none !important; }
`;

const quelle = readFileSync(path.join(HIER, "check-spiele.mjs"), "utf8");
const anfang = quelle.indexOf("const ATTRAPPE = `") + "const ATTRAPPE = `".length;
const ATTRAPPE = quelle.slice(anfang, quelle.indexOf("\n`;", anfang));

function ffmpeg(argumente) {
  const r = spawnSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", ...argumente], { encoding: "utf8" });
  if (r.status !== 0) throw new Error(`ffmpeg: ${r.stderr || r.status}`);
}

// Die Seite eines Spiels, bereit für den Autopiloten: ohne Firestore, ohne
// Leiste, das Spiel geladen und schon gestartet.
async function oeffne(browser, spiel, vorfuehrung, f, dpr) {
  const kontext = await browser.newContext({
    viewport: { width: f.breit, height: f.hoch },
    deviceScaleFactor: dpr,
    serviceWorkers: "block",
  });
  await kontext.route("**/cloud.js*", (r) => r.fulfill({ contentType: "text/javascript; charset=utf-8", body: ATTRAPPE }));
  await kontext.route("https://www.gstatic.com/firebasejs/**", (r) => r.fulfill({ contentType: "text/javascript; charset=utf-8", body: "/* */" }));
  // Keine Einträge, keine Geister: Es spielt nur einer.
  await kontext.addInitScript(() => {
    if (sessionStorage.getItem("__film")) return;
    localStorage.clear();
    localStorage.setItem("__mini_attrappe", "[]");
    localStorage.setItem("__mini_geister_attrappe", "[]");
    localStorage.setItem("mini.id", "mini_filmfilmfilmfi");
    localStorage.setItem("mini.name", "Film");
    sessionStorage.setItem("__film", "1");
  });
  const seite = await kontext.newPage();
  const fehler = [];
  seite.on("pageerror", (e) => fehler.push(e.message));
  await seite.goto(`http://127.0.0.1:${PORT}/${spiel.seite}`, { waitUntil: "load" });
  await seite.addStyleTag({ content: OHNE + (vorfuehrung.stil || "") });
  await seite.waitForFunction(vorfuehrung.bereit, null, { timeout: 10000 });
  await seite.waitForTimeout(400);
  await seite.evaluate(vorfuehrung.spiele);
  return { kontext, seite, fehler };
}

// Ein Standbild: im richtigen Moment ein Bild mit doppelter Pixeldichte,
// daraus das Bild fürs Fenster (und quer das kleine für die Zeile).
async function standbild(browser, spiel, vorfuehrung, formatName) {
  const f = FORMATE[formatName];
  const { kontext, seite, fehler } = await oeffne(browser, spiel, vorfuehrung, f, 2);
  const moment = vorfuehrung.bild ?? ((vorfuehrung.vorlauf ?? 1500) + (vorfuehrung.standbild ?? 3.2) * 1000);
  await seite.waitForTimeout(moment);
  if (vorfuehrung.bildWenn) await seite.waitForFunction(vorfuehrung.bildWenn, null, { timeout: 30000, polling: "raf" });
  const ordner = mkdtempSync(path.join(os.tmpdir(), "bild-"));
  const roh = path.join(ordner, "roh.png");
  await seite.screenshot({ path: roh });
  await kontext.close();
  if (fehler.length) throw new Error(`${spiel.seite}: Fehler in der Seite – ${fehler.join(" | ")}`);
  mkdirSync(ZIEL_BILDER, { recursive: true });
  const bild = path.join(ZIEL_BILDER, `${spiel.seite}-${formatName}.webp`);
  ffmpeg(["-i", roh, "-c:v", "libwebp", "-quality", "88", bild]);
  const raus = { kb: Math.round(statSync(bild).size / 1024) };
  if (formatName === "quer") {
    const klein = path.join(ZIEL_BILDER, `${spiel.seite}-klein.webp`);
    ffmpeg(["-i", roh, "-vf", "scale=480:270:flags=lanczos", "-c:v", "libwebp", "-quality", "80", klein]);
    raus.kleinKb = Math.round(statSync(klein).size / 1024);
  }
  rmSync(ordner, { recursive: true, force: true });
  return raus;
}

async function aufnehmen(browser, spiel, vorfuehrung, formatName) {
  const f = FORMATE[formatName];
  const { kontext, seite, fehler } = await oeffne(browser, spiel, vorfuehrung, f, f.dpr);
  await seite.waitForTimeout(vorfuehrung.vorlauf ?? 1500);

  const bilder = [];
  const cdp = await kontext.newCDPSession(seite);
  cdp.on("Page.screencastFrame", ({ data, metadata, sessionId }) => {
    bilder.push({ data, t: metadata.timestamp });
    cdp.send("Page.screencastFrameAck", { sessionId }).catch(() => {});
  });
  await cdp.send("Page.startScreencast", { format: "jpeg", quality: 92, everyNthFrame: 1, maxWidth: f.breit, maxHeight: f.hoch });
  await seite.waitForTimeout(vorfuehrung.dauer ?? 9000);
  await cdp.send("Page.stopScreencast");
  await kontext.close();
  if (fehler.length) throw new Error(`${spiel.seite}: Fehler in der Seite – ${fehler.join(" | ")}`);
  if (bilder.length < 30) throw new Error(`${spiel.seite}/${formatName}: nur ${bilder.length} Bilder aufgenommen.`);
  // Stockt der Screencast unterwegs (unter Last schon vorgekommen), wäre der
  // Film zu kurz – dann lieber noch einmal.
  const soll = (vorfuehrung.dauer ?? 9000) / 1000;
  const sekunden = bilder[bilder.length - 1].t - bilder[0].t;
  if (sekunden < soll * 0.85) throw new Error(`${spiel.seite}/${formatName}: nur ${sekunden.toFixed(1)} von ${soll} s aufgenommen.`);

  // Die Bilder mit ihrer Dauer in eine Liste für ffmpeg (concat).
  const ordner = BILDER_BEHALTEN ? path.join(BILDER_BEHALTEN, `${spiel.seite}-${formatName}`) : mkdtempSync(path.join(os.tmpdir(), "film-"));
  mkdirSync(ordner, { recursive: true });
  const liste = [];
  bilder.forEach((b, i) => {
    const datei = path.join(ordner, `b${String(i).padStart(5, "0")}.jpg`);
    writeFileSync(datei, Buffer.from(b.data, "base64"));
    const dauer = i + 1 < bilder.length ? Math.max(0.001, bilder[i + 1].t - b.t) : 1 / 30;
    liste.push(`file '${datei}'`, `duration ${dauer.toFixed(4)}`);
  });
  liste.push(`file '${path.join(ordner, `b${String(bilder.length - 1).padStart(5, "0")}.jpg`)}'`);
  const listenDatei = path.join(ordner, "liste.txt");
  writeFileSync(listenDatei, `${liste.join("\n")}\n`);

  mkdirSync(ZIEL, { recursive: true });
  const [w, h] = f.aus;
  const film = path.join(ZIEL, `${spiel.seite}-${formatName}.mp4`);
  const blende = 0.45;
  ffmpeg([
    "-f", "concat", "-safe", "0", "-i", listenDatei,
    "-vf", `fps=30,scale=${w}:${h}:flags=lanczos,fade=t=in:st=0:d=${blende},fade=t=out:st=${(sekunden - blende).toFixed(2)}:d=${blende}`,
    "-c:v", "libx264", "-preset", "slow", "-crf", "27", "-pix_fmt", "yuv420p", "-profile:v", "high",
    "-movflags", "+faststart", "-an", film,
  ]);
  const bild = path.join(ZIEL, `${spiel.seite}-${formatName}.webp`);
  ffmpeg(["-ss", (vorfuehrung.standbild ?? Math.min(3.2, sekunden / 2)).toFixed(2), "-i", film, "-frames:v", "1", "-c:v", "libwebp", "-quality", "78", bild]);
  if (!BILDER_BEHALTEN) rmSync(ordner, { recursive: true, force: true });
  return {
    bilder: bilder.length,
    jeSekunde: +(bilder.length / Math.max(0.1, sekunden)).toFixed(1),
    kb: Math.round(statSync(film).size / 1024),
    bildKb: Math.round(statSync(bild).size / 1024),
  };
}

const server = spawn(process.execPath, [path.join(HIER, "local-pwa-server.cjs"), String(PORT)], { cwd: WURZEL, stdio: "ignore" });
const halt = () => { try { server.kill(); } catch { /* schon weg */ } };
process.on("exit", halt);
for (let i = 0; i < 60; i += 1) {
  try { if ((await fetch(`http://127.0.0.1:${PORT}/index.html`)).ok) break; } catch { /* noch nicht da */ }
  await new Promise((weiter) => setTimeout(weiter, 100));
}

const browser = await chromium.launch();
let fehlgeschlagen = 0;
try {
  const spiele = SPIELE.filter((s) => !GEWAEHLT.length || GEWAEHLT.includes(s.seite));
  for (const spiel of spiele) {
    const datei = path.join(HIER, "vorfuehrung", `${spiel.seite}.mjs`);
    if (!existsSync(datei)) { console.log(`– ${spiel.seite}: keine Vorführung (scripts/vorfuehrung/${spiel.seite}.mjs)`); continue; }
    const vorfuehrung = (await import(pathToFileURL(datei).href)).default;
    for (const formatName of Object.keys(FORMATE)) {
      if (NUR_FORMAT && NUR_FORMAT !== formatName) continue;
      // Ein zweiter Versuch, wenn der erste scheitert; erst dann zählt es.
      for (let versuch = 1; versuch <= 2; versuch += 1) {
        try {
          if (STANDBILD) {
            const r = await standbild(browser, spiel, vorfuehrung, formatName);
            console.log(`✓ ${spiel.seite}-${formatName}: Bild ${r.kb} KB${r.kleinKb ? `, klein ${r.kleinKb} KB` : ""}`);
            break;
          }
          const r = await aufnehmen(browser, spiel, vorfuehrung, formatName);
          console.log(`✓ ${spiel.seite}-${formatName}: ${r.bilder} Bilder (${r.jeSekunde}/s), ${r.kb} KB, Standbild ${r.bildKb} KB`);
          break;
        } catch (f) {
          if (versuch < 2) { console.log(`… ${spiel.seite}-${formatName}: ${f.message} – noch einmal`); continue; }
          fehlgeschlagen += 1;
          console.log(`✗ ${spiel.seite}-${formatName}: ${f.message}`);
        }
      }
    }
  }
} finally {
  await browser.close();
  halt();
}
process.exit(fehlgeschlagen ? 1 : 0);
