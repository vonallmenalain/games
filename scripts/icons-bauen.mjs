/*
 * icons-bauen.mjs – die Zeichen der App aus ihren SVGs
 * ---------------------------------------------------------------------------
 * Das Zeichen von alae arcade sind die zwei Winkel von alae.app als
 * 8-Bit-Figur (icons/icon.svg). Daraus entstehen hier alle Grössen, die
 * Manifest und Seiten verlangen:
 *
 *   icon-maskable-512/192   vollflächig: Android schneidet selbst zu (Kreis,
 *                           Squircle); die Figur liegt im Kreis mit 80 %
 *                           Durchmesser, der Sicherheitszone
 *   icon-512/192            mit runden Ecken und durchsichtig daneben – für
 *                           alles, was nicht selbst zuschneidet (Installation
 *                           am Computer, Liste der Apps)
 *   icon-180                vollflächig: iOS rundet selbst ab und füllte
 *                           Durchsichtiges schwarz
 *   icon-32                 aus icons/favicon.svg: nur die Winkel, eng
 *                           geschnitten, ohne Sterne und Boden – so ist
 *                           jeder Block genau 2 px gross und bleibt scharf
 *
 * Wer das Zeichen ändert, ändert das SVG und lässt das hier laufen:
 *
 *   node scripts/icons-bauen.mjs
 *
 * Nötig: Playwright mit Chromium (wie für die Prüfung im Browser).
 */
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";
import path from "node:path";

const HIER = path.dirname(fileURLToPath(import.meta.url));
const ICONS = path.resolve(HIER, "..", "icons");

let playwright;
try {
  playwright = createRequire(import.meta.url)("playwright");
} catch {
  console.error("Playwright fehlt – einmalig: npm i && npx playwright install chromium");
  process.exit(2);
}

const gross = readFileSync(path.join(ICONS, "icon.svg"), "utf8");
const klein = readFileSync(path.join(ICONS, "favicon.svg"), "utf8");

// Die Ecken der Zeichen mit Rand: wie ein Squircle, nur einfacher.
const ECKE = "22.5%";

const AUFTRAEGE = [
  { datei: "icon-maskable-512.png", svg: gross, groesse: 512 },
  { datei: "icon-maskable-192.png", svg: gross, groesse: 192 },
  { datei: "icon-512.png", svg: gross, groesse: 512, ecke: ECKE },
  { datei: "icon-192.png", svg: gross, groesse: 192, ecke: ECKE },
  { datei: "icon-180.png", svg: gross, groesse: 180 },
  { datei: "icon-32.png", svg: klein, groesse: 32, ecke: "18%" },
];

const browser = await playwright.chromium.launch();
try {
  for (const { datei, svg, groesse, ecke = "0" } of AUFTRAEGE) {
    const seite = await browser.newPage({ viewport: { width: groesse, height: groesse }, deviceScaleFactor: 1 });
    await seite.setContent(`<!doctype html><html><body style="margin:0;background:transparent">
      <div style="width:${groesse}px;height:${groesse}px;border-radius:${ecke};overflow:hidden">
        ${svg.replace(/<svg /, '<svg style="display:block;width:100%;height:100%" ')}
      </div></body></html>`);
    await seite.screenshot({ path: path.join(ICONS, datei), omitBackground: true });
    await seite.close();
    console.log(`icons/${datei} (${groesse} px)`);
  }
} finally {
  await browser.close();
}
