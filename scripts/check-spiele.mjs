/*
 * Die Mini-Games im Browser: läuft, was hier herausgeschnitten wurde?
 * ---------------------------------------------------------------------------
 * pruefen.mjs liest Dateien. Das hier spielt: Es öffnet jedes der sieben
 * Spiele so, wie jemand es öffnet, dem der Link geschickt wurde, und schaut
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
const UNSER = /^(cm|mini|kk|wf|ft|sg|bs|tb|zg|scene|help-voice|sound|confetti)(-|$)/;
const hatRegel = (klasse) => new RegExp(`\\.${klasse.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\w-])`).test(STYLESHEET);
// Klassen ohne eigene Regel – und das ist richtig so. Sie stehen auch in der
// App in keiner:
//   cm-icon-<name>   die Bühne hängt den Namen an jeden Knopf; gestaltet wird
//                    .cm-icon, der Name ist zum Finden da.
//   sound-core …     Teile einer Zeichnung, die Farbe und Strich vom
//                    Elternteil erben.
//   sg-licht         das Licht des Signals; gefärbt wird es über
//                    .sg-licht-gruen bzw. .sg-licht-rot.
const OHNE_REGEL = new Set(["sound-core", "sound-wave-wide", "rs-prompt-text", "rs-klappe", "sg-licht"]);
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
  };
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
    await seite.goto(`${BASIS}/admin`, { waitUntil: "load" });
    await seite.waitForSelector(".adm-anmeldung", { timeout: 8000 });

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
