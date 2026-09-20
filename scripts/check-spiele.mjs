/*
 * Die Mini-Games im Browser: läuft, was hier herausgeschnitten wurde?
 * ---------------------------------------------------------------------------
 * pruefen.mjs liest Dateien. Das hier spielt: Es öffnet jedes der zwölf
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
const UNSER = /^(cm|mini|rs|st|kk|wf|sf|ft|sg|bs|tb|dg|zg|scene|help-voice|sound|rotate-hint|confetti)(-|$)/;
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
  for (let tipp = 0; tipp < 120; tipp += 1) {
    if (await seite.locator(".cm-panel").count()) return true;
    await seite.mouse.click(210, 500);
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
    pruefe(stand.knoepfe.length === 4, `${spiel.seite}: Oben links stehen ${stand.knoepfe.length} Knöpfe statt vier (${stand.knoepfe.join(", ")}).`);
    for (const wort of ["Zur App", "Mini Games", "Hall of Fame"]) {
      pruefe(stand.knoepfe.some((k) => k.includes(wort)), `${spiel.seite}: Oben links fehlt "${wort}".`);
    }
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

    const zurApp = await seite.getAttribute('.cm-bar-left a:has-text("Zur App")', "href");
    pruefe(zurApp === "https://kids.alae.app/", `"Zur App" zeigt auf ${zurApp} statt auf die volle Adresse der App.`);
    const halle = await seite.getAttribute('.cm-bar-left a:has-text("Hall of Fame")', "href");
    pruefe(halle === "/", `"Hall of Fame" zeigt auf ${halle} statt auf die Startseite.`);
    pruefe(await seite.locator(".cm-icon-home").count() === 0, "Ein Haus führte auf ein Startbild, das es hier nicht gibt.");
    pruefe(await seite.locator(".cm-icon-again").count() === 1, "Der Knopf zum Neustarten fehlt.");
    pruefe(await seite.getAttribute("body", "data-spiel") === "towerStack", "Am body fehlt data-spiel.");

    // Das Fenster mit allen Mini-Games.
    await seite.click('.cm-bar-left button:has-text("Mini Games")');
    await seite.waitForSelector(".mini-fenster", { timeout: 4000 });
    const fenster = await seite.locator(".mini-tafel").innerText();
    for (const spiel of SPIELE) {
      pruefe(fenster.includes(spiel.titel), `Im Fenster fehlt ${spiel.titel}.`);
    }
    await seite.waitForSelector(".mini-fenster .mini-zeile", { timeout: 4000 });
    pruefe((await seite.locator(".mini-fenster .mini-zeile").first().innerText()).includes("Grosi"),
      "Im Fenster steht die bestehende Bestenliste nicht.");
    const spielen = await seite.getAttribute(".mini-tafel-aktionen a", "href");
    pruefe(spielen === "/turmbau", `"Spielen" zeigt auf ${spielen} statt auf /turmbau.`);
    await seite.keyboard.press("Escape");
    pruefe(await seite.locator(".mini-fenster").count() === 0, "Escape schliesst das Fenster nicht.");

    // Eine Runde, und danach der Name.
    pruefe(await spieleTurmbauZuEnde(seite), "Die Runde kam nicht zu einem Ergebnis.");
    await seite.waitForSelector(".mini-ergebnis", { timeout: 4000 });
    pruefe(await seite.locator(".cm-scores").count() === 0, "Unter dem Ergebnis steht eine eigene Fünferliste – gemeint ist die Liste aller.");
    pruefe(await seite.locator(".cm-runs").count() === 0, "Unter dem Ergebnis steht der Satz über den Wagen – hier gibt es keinen Wagen.");
    pruefe(await seite.locator(".mini-namensfeld input").count() === 1, "Ohne Namen fehlt das Namensfeld.");
    pruefe(await seite.locator(".cm-icon-cup").count() === 1, "Unter dem Ergebnis fehlt der Weg zu den anderen Mini-Games.");

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
    const gefragt = await seite.evaluate(() => window.__miniGefragt || []);
    pruefe(gefragt.length === SPIELE.length, `Die Startseite fragt nach ${gefragt.length} Spielen statt nach ${SPIELE.length}.`);
    const zurApp = await seite.getAttribute(".mini-kopf a", "href");
    pruefe(zurApp === "https://kids.alae.app/", `"Zur App" zeigt auf ${zurApp}.`);
    const spielen = await seite.getAttribute(".mini-karte-aktionen a", "href");
    pruefe(SPIELE.some((s) => spielen === `/${s.seite}`), `Ein Spiel-Link zeigt auf ${spielen}.`);
    const ueberstand = await seite.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    pruefe(ueberstand <= 1, `Die Startseite steht ${ueberstand} px über den rechten Rand.`);
    await kontext.close();
  }

  // --- 4. Die Leiste quer: nichts liegt übereinander ---------------------------
  // Was sich hier überdeckt, ist nicht unschön, sondern unerreichbar: ein
  // Knopf unter einem anderen lässt sich nicht drücken. Gemessen wird deshalb,
  // nicht angesehen.
  for (const [name, viewport] of [["Handy quer", { width: 568, height: 320 }], ["Tablet quer", { width: 844, height: 390 }]]) {
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
      return { stoesse, ueberRand: Math.round(letzte - window.innerWidth) };
    });
    pruefe(befund.stoesse.length === 0, `${name}: In der Leiste liegt etwas übereinander – ${befund.stoesse.join(", ")}`);
    pruefe(befund.ueberRand <= 0, `${name}: Die Leiste steht ${befund.ueberRand} px über den rechten Rand.`);
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
