#!/usr/bin/env node
/*
 * seiten-bauen.mjs – Baut die Seiten, das Manifest und den Service Worker.
 * ---------------------------------------------------------------------------
 * Zwölf Spielseiten sehen einander bis auf vier Stellen gleich: der Name des
 * Spiels, die Bühne, das Skript, das sie füllt, und welches Spiel in der
 * Bestenliste gemeint ist. Von Hand gepflegt liefen sie auseinander – eine
 * Seite bekäme ein neues Skript, die andere nicht, und niemand merkte es, bis
 * ein Spiel weiss bliebe.
 *
 * Deshalb steht unten eine Tabelle und hier ein Skript. Ein neues Spiel heisst:
 *
 *   1. <spiel>.js aus der App herüberkopieren (und, falls es dazugehört,
 *      seinen Abschnitt aus styles.css).
 *   2. Eine Zeile in SPIELE hier, eine in mini-games.js.
 *   3. npm run bauen
 *
 * Der Service Worker entsteht aus denselben Daten: Was eine Seite lädt, steht
 * in seiner Liste – sonst fehlte offline genau das Spiel, das man spielen
 * wollte.
 *
 *   node scripts/seiten-bauen.mjs            schreibt die Dateien
 *   node scripts/seiten-bauen.mjs --pruefen  sagt nur, ob sie stimmen
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// Die Fassung steht in jeder Adresse (?v=) und im Namen des Zwischenspeichers.
// Ändert sie sich, holt der Browser alles neu – ohne sie bekäme jemand das
// neue Spiel mit dem alten Stylesheet.
export const FASSUNG = "2026-10-27-9";

// Die Farbe der Leiste des Browsers und des Startbilds der installierten App:
// der dunkle Grund aller Seiten (--bg in styles.css).
const DUNKEL = "#0d0c11";

// Wo die arcade wohnt. Die Vorschau eines geteilten Links (WhatsApp, Signal,
// iMessage) holt ihr Bild nur über eine volle Adresse.
const ADRESSE = "https://games.alae.app";

/*
 * Die Spiele.
 *
 *   seite    Datei und Adresse: games.alae.app/turmbau
 *   spiel    der Name in der Bestenliste (miniScores.game), derselbe wie in
 *            der App – wer dort gespielt hat, steht hier in derselben Liste
 *   page     was am body steht; daran erkennt das Skript seine Seite
 *   js       das Skript des Spiels
 *   kunst    zusätzliche Zeichnungen, die es braucht
 *   buehne   id und Klassen des einen Elements, in das alles hineingebaut wird
 */
export const SPIELE = [
  {
    seite: "kacheln", spiel: "tileMemory", page: "tiles", js: "kacheln.js",
    titel: "Kacheln-Knobeln", buehne: { id: "kk-stage", klasse: "cm-stage kk-stage" },
    text: "Kacheln-Knobeln: Merk dir, welche Kacheln geleuchtet haben, und tippe sie nach.",
    baut: "das Raster",
  },
  {
    seite: "fischteich", spiel: "fishPond", page: "pond", js: "fischteich.js",
    titel: "Fischteich", buehne: { id: "ft-stage", klasse: "cm-stage ft-stage" },
    text: "Fischteich: Tippe jeden Fisch genau einmal an und merk dir, welche du schon hattest.",
    baut: "der Teich mit den Fischen",
  },
  {
    seite: "blaetter", spiel: "leafFlow", page: "leaves", js: "blaetter.js",
    titel: "Blätter im Strom", buehne: { id: "bs-stage", klasse: "cm-stage bs-stage" },
    text: "Blätter im Strom: 45 Sekunden lang wischen – orange Blätter wohin sie schwimmen, grüne wohin sie zeigen.",
    baut: "das Wasser mit den Blättern",
  },
  {
    seite: "turmbau", spiel: "towerStack", page: "tower", js: "turmbau.js",
    titel: "Turmbau", buehne: { id: "tb-stage", klasse: "cm-stage tb-stage" },
    text: "Turmbau: ein Block schwingt über dem Turm – tippe im richtigen Moment und stapel so hoch wie du kannst.",
    baut: "die Baustelle",
  },
  {
    seite: "bruecke", spiel: "bridgeBuilder", page: "bridge", js: "bruecke.js",
    titel: "Brückenbauer", buehne: { id: "br-stage", klasse: "cm-stage br-stage" },
    text: "Brückenbauer: Halte gedrückt, bis der Balken über die Schlucht reicht – und triff die rote Mitte des Pfeilers.",
    baut: "die Schlucht mit den Pfeilern",
  },
  {
    seite: "drehscheibe", spiel: "dartWheel", page: "wheel", js: "drehscheibe.js",
    titel: "Drehscheibe", buehne: { id: "dr-stage", klasse: "cm-stage dr-stage" },
    text: "Drehscheibe: Wirf Pfeil um Pfeil in die drehende Holzscheibe – ohne einen anderen zu treffen.",
    baut: "die Scheibe mit den Pfeilen",
  },
  {
    seite: "liane", spiel: "vineSwing", page: "vine", js: "liane.js",
    titel: "Lianenschwung", buehne: { id: "li-stage", klasse: "cm-stage li-stage" },
    text: "Lianenschwung: Halten heisst festhalten, Loslassen heisst fliegen – schwing den Affen über den Fluss, so weit du kommst.",
    baut: "der Fluss mit den Lianen",
  },
  {
    seite: "tunnelflug", spiel: "tunnelFlight", page: "tunnel", js: "tunnelflug.js",
    titel: "Tunnelflug", buehne: { id: "tf-stage", klasse: "cm-stage tf-stage" },
    text: "Tunnelflug: Halten heisst steigen, Loslassen heisst sinken – flieg durch den Tunnel, ohne die Wände zu berühren. Er wird enger, du wirst schneller.",
    baut: "der Tunnel mit dem Flugzeug",
  },
  {
    seite: "drift", spiel: "driftRace", page: "drift", js: "drift.js",
    titel: "Drift-Rennen", buehne: { id: "dt-stage", klasse: "cm-stage dt-stage" },
    text: "Drift-Rennen: Halten heisst driften, Loslassen heisst geradeaus – jag das Auto die Passstrasse hinauf, ohne die Leitplanke zu berühren.",
    baut: "die Passstrasse mit dem Auto",
  },
  {
    seite: "planeten", spiel: "planetHop", page: "planets", js: "planeten.js",
    titel: "Planetenhüpfer", buehne: { id: "ph-stage", klasse: "cm-stage ph-stage" },
    text: "Planetenhüpfer: Der Astronaut läuft um den Planeten – tippe im richtigen Moment, und er springt zum nächsten. Je schneller du springst, desto mehr Punkte.",
    baut: "das All mit den Planeten",
  },
  {
    seite: "mondlandung", spiel: "moonLander", page: "moon", js: "mondlandung.js",
    titel: "Mondlandung", buehne: { id: "ml-stage", klasse: "cm-stage ml-stage" },
    text: "Mondlandung: Halten gibt Schub, der Finger lenkt – setz die Fähre sanft auf die nächste Plattform. Je weniger Treibstoff du brauchst, desto mehr Punkte.",
    baut: "der Mond mit den Plattformen",
  },
  {
    seite: "schwerkraft", spiel: "gravityRun", page: "gravity", js: "schwerkraft.js",
    titel: "Schwerkraft-Läufer", buehne: { id: "sl-stage", klasse: "cm-stage sl-stage" },
    text: "Schwerkraft-Läufer: Tippe, und die Schwerkraft kehrt sich um – renn an Boden und Decke vorbei an Lücken, Stacheln und Blöcken. Es wird immer schneller.",
    baut: "der Neon-Korridor mit dem Läufer",
  },
  {
    seite: "huegel", spiel: "hillGlide", page: "hills", js: "huegel.js",
    titel: "Hügelflieger", buehne: { id: "hf-stage", klasse: "cm-stage hf-stage" },
    text: "Hügelflieger: Halten macht den Vogel schwer, Loslassen leicht – rutsch die Hügel hinab und flieg über die Kuppen, bevor die Sonne untergeht.",
    baut: "die Hügel mit dem Vogel",
  },
  {
    seite: "ballon", spiel: "balloonRide", page: "balloon", js: "ballon.js",
    titel: "Windschichten", buehne: { id: "bl-stage", klasse: "cm-stage bl-stage" },
    text: "Windschichten: Halten heizt den Brenner, Loslassen kühlt – jede Höhe hat ihren eigenen Wind. Such die Schicht, die dich weiterträgt.",
    baut: "der Himmel mit den Winden",
  },
  {
    seite: "slalom", spiel: "skiSlalom", page: "slalom", js: "slalom.js",
    titel: "Slalom", buehne: { id: "sk-stage", klasse: "cm-stage sk-stage" },
    text: "Slalom: Links halten lenkt nach links, rechts halten nach rechts – fahr durch jedes Tor, knapp an der inneren Stange gibt es Bonus.",
    baut: "die Piste mit den Toren",
  },
  {
    seite: "frosch", spiel: "frogHop", page: "frog", js: "frosch.js",
    titel: "Froschsprung", buehne: { id: "fr-stage", klasse: "cm-stage fr-stage" },
    text: "Froschsprung: Halten lädt den Sprung, Loslassen springt – lande auf dem nächsten Seerosenblatt, am besten genau in der Mitte.",
    baut: "der Teich mit den Seerosen",
  },
  {
    seite: "kranhafen", spiel: "craneHarbor", page: "harbor", js: "kranhafen.js",
    titel: "Kranhafen", buehne: { id: "kh-stage", klasse: "cm-stage kh-stage" },
    text: "Kranhafen: Der Container pendelt am Kran – tippe im richtigen Moment und stapel ihn auf das fahrende Schiff.",
    baut: "der Hafen mit dem Kran",
  },
  {
    seite: "seiltaenzer", spiel: "ropeWalk", page: "rope", js: "seiltaenzer.js",
    titel: "Seiltänzer", buehne: { id: "st-stage", klasse: "cm-stage st-stage" },
    text: "Seiltänzer: Halten lehnt nach rechts, Loslassen nach links – halt das Gleichgewicht auf dem Seil, so weit du kommst.",
    baut: "das Seil über der Schlucht",
  },
  {
    seite: "draht", spiel: "wireLoop", page: "wire", js: "draht.js",
    titel: "Heisser Draht", buehne: { id: "hd-stage", klasse: "cm-stage hd-stage" },
    text: "Heisser Draht: Führ den Ring mit dem Finger am Draht entlang – berührt er ihn, ist die Runde vorbei.",
    baut: "der Draht mit dem Ring",
  },
  {
    seite: "spuren", spiel: "twinLanes", page: "lanes", js: "spuren.js",
    titel: "Zwei Spuren", buehne: { id: "zs-stage", klasse: "cm-stage zs-stage" },
    text: "Zwei Spuren: Links tippen lenkt den linken Schlitten, rechts den rechten – weich aus und sammle, mit beiden zugleich.",
    baut: "die zwei Bahnen",
  },
  {
    seite: "ball", spiel: "keepyUppy", page: "keepy", js: "ball.js",
    titel: "Ball hochhalten", buehne: { id: "bh-stage", klasse: "cm-stage bh-stage" },
    text: "Ball hochhalten: Tippe auf den Ball, bevor er fällt – wo du ihn triffst, dorthin fliegt er.",
    baut: "der Platz mit dem Ball",
  },
  {
    seite: "jongleur", spiel: "juggler", page: "juggle", js: "jongleur.js",
    titel: "Jongleur", buehne: { id: "jg-stage", klasse: "cm-stage jg-stage" },
    text: "Jongleur: Links wirft die linke Hand, rechts die rechte – halte alle Bälle in der Luft. Länger halten wirft höher. Alle zehn Fänge kommt einer dazu.",
    baut: "die Manege mit dem Jongleur",
  },
  {
    seite: "skispringen", spiel: "skiJump", page: "skijump", js: "skispringen.js",
    titel: "Skispringen", buehne: { id: "sj-stage", klasse: "cm-stage sj-stage" },
    text: "Skispringen: Tippe genau an der Kante, halte in der Luft die Lage – und lande im Telemark. Gezählt werden die Meter aller Sprünge.",
    baut: "die Schanze mit dem Springer",
  },
  {
    seite: "fallschirm", spiel: "skyDive", page: "skydive", js: "fallschirm.js",
    titel: "Fallschirm", buehne: { id: "fs-stage", klasse: "cm-stage fs-stage" },
    text: "Fallschirm: Halten lenkt, ein Wisch nach oben zieht den Schirm – so spät wie möglich, und lande mitten im Ziel.",
    baut: "der Himmel mit dem Springer",
  },
  {
    seite: "holzfaeller", spiel: "lumberCut", page: "lumber", js: "holzfaeller.js",
    titel: "Holzfäller", buehne: { id: "hl-stage", klasse: "cm-stage hl-stage" },
    text: "Holzfäller: Wisch quer durch jeden fliegenden Stamm – genau am roten Strich. Äste und Nagelstämme nicht treffen!",
    baut: "der Holzplatz mit den Stämmen",
  },
  {
    seite: "fledermaus", spiel: "batEcho", page: "bat", js: "fledermaus.js",
    titel: "Fledermaus", buehne: { id: "fm-stage", klasse: "cm-stage fm-stage" },
    text: "Fledermaus: Die Höhle ist dunkel – tippe links, und dein Ruf lässt die Wände kurz aufleuchten. Rechts flatterst du.",
    baut: "die dunkle Höhle mit der Fledermaus",
  },
  {
    seite: "ninja", spiel: "timeNinja", page: "ninja", js: "ninja.js",
    titel: "Zeitlupen-Ninja", buehne: { id: "nj-stage", klasse: "cm-stage nj-stage" },
    text: "Zeitlupen-Ninja: Die Zeit läuft nur, wenn du läufst – zieh den Ninja an Pfeilen, Klingen und Fallen vorbei bis zum Tor.",
    baut: "der Dojo-Hof mit dem Ninja",
  },
  {
    seite: "zahlengleis", spiel: "numberLine", page: "numberline", js: "zahlengleis.js",
    titel: "Wo hält der Zug?", buehne: { id: "zg-stage", klasse: "cm-stage zg-stage" },
    text: "Wo hält der Zug? Schieb den Zug auf dem Gleis dorthin, wo die Zahl liegt.",
    baut: "das Gleis mit dem Zug",
  },
  {
    seite: "heizer", spiel: "boilerRoom", page: "boiler", js: "heizer.js",
    titel: "Der Heizer", buehne: { id: "hz-stage", klasse: "cm-stage hz-stage" },
    text: "Der Heizer: Jeder Kessel fällt – leg Kohle nach, aber nie im roten Feld.",
    baut: "die Reihe der Kessel",
  },
];

// Das Firebase-SDK. Kein firebase-auth auf den Spielseiten: Dort meldet sich
// niemand an, und ein SDK, das niemand braucht, lädt trotzdem jeder.
const SDK = [
  "https://www.gstatic.com/firebasejs/12.7.0/firebase-app-compat.js",
  "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore-compat.js",
];
// Nur der Adminbereich meldet jemanden an – und die Live-Seite fragt nach,
// ob dort der Admin sitzt, der leiten darf.
const SDK_AUTH = "https://www.gstatic.com/firebasejs/12.7.0/firebase-auth-compat.js";
// Die Realtime Database braucht nur die Live-Seite (live.js). Die Spiele
// einer Live-Runde reden mit ihr über den Rahmen, nicht selbst.
const SDK_DATABASE = "https://www.gstatic.com/firebasejs/12.7.0/firebase-database-compat.js";

// Was jede Seite lädt, in dieser Reihenfolge. train-art holt sich seine
// Werkzeuge beim Laden, nicht beim Aufruf – es muss vor dem stehen, was es
// benutzt.
//
// vollbild.js steht vorn: Die Knöpfe fürs Vollbild bauen alle anderen damit,
// und auf der äussersten Seite hält es das Vollbild über die Seitenwechsel.
//
// turnier.js steht bei allen: Die Startseite zeigt laufende Turniere, eine
// Spielseite kann in einem gespielt werden, die Turnierseite ist eines, und
// der Adminbereich rechnet mit denselben Wertungen. Es steht vor der Bühne
// (game-shell.js) und vor dem Spiel, denn beide fragen schon beim Aufbauen
// danach.
const GEMEINSAM = ["vollbild.js", "highscore.js", "cloud.js", "klang.js", "mini-games.js", "turnier.js"];
const SPIELSEITE = ["zufall.js", "kids.js", "train-art.js", "train-scenes.js"];
// geist.js steht hinter der Bühne und vor dem Spiel: Es hängt seine Schalter
// in die Bühne, und das Spiel meldet sich beim Aufbauen dort an.
// live-spiel.js steht vor der Bühne: Sie fragt beim Aufbauen, ob diese Seite
// eine Runde eines Multiplayers ist.
const NACH_DER_KUNST = ["game-cloud.js", "live-spiel.js", "game-shell.js", "geist.js"];

const v = (datei) => `${datei}?v=${FASSUNG}`;

function skripte(liste) {
  return liste.map((s) => (s.startsWith("http")
    ? `    <script defer src="${s}"></script>`
    : `    <script defer src="${v(s)}"></script>`)).join("\n");
}

export function seitenSkripte(spiel) {
  return [...SDK, ...GEMEINSAM, ...SPIELSEITE, ...(spiel.kunst || []),
    ...NACH_DER_KUNST, spiel.js, "pwa.js"];
}

// Die Startseite (die arcade) zeigt aufgenommene Filme (filme/) und braucht
// dafür kein eigenes Skript.
export const hubSkripte = () => [...SDK, ...GEMEINSAM, "pwa.js"];
// Die Turnierseite: dasselbe wie die Startseite. Was sie zeigt, baut
// turnier.js aus der Adresse (?t=).
export const turnierSkripte = () => [...SDK, ...GEMEINSAM, "pwa.js"];
// Der Adminbereich: dasselbe Fundament, dazu die Anmeldung. Kein pwa.js – er
// gehört nicht in die installierte App, und ein Service Worker, der ihn
// zwischenspeichert, zeigte beim nächsten Mal alte Zahlen.
export const adminSkripte = () => [...SDK, SDK_AUTH, ...GEMEINSAM, "admin.js"];
// Die Live-Seite: das Fundament, die Anmeldung (wer leitet) und die Realtime
// Database. pwa.js gehört dazu – ein Multiplayer lässt sich auch aus der
// installierten App heraus spielen.
export const liveSkripte = () => [...SDK, SDK_AUTH, SDK_DATABASE, ...GEMEINSAM, "live.js", "pwa.js"];

/*
 * Der Kopf jeder Seite. Dazu die Vorschau, wenn jemand den Link teilt: Titel,
 * ein kurzer Satz (kurz – so wenig Text wie möglich) und das Logo als Bild
 * (icons/vorschau.jpg, 1200 × 630, entsteht mit npm run icons).
 */
const kopf = ({ titel, text, kurz = text, viewport, manifest = true, farbe = DUNKEL }) => `    <meta charset="UTF-8" />
    <meta name="viewport" content="${viewport}" />
    <meta name="application-name" content="arcade" />
    <meta name="description" content="${text}" />
    <meta name="mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
    <meta name="apple-mobile-web-app-title" content="arcade" />
    <meta name="theme-color" content="${farbe}" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="arcade" />
    <meta property="og:title" content="${titel}" />
    <meta property="og:description" content="${kurz}" />
    <meta property="og:image" content="${ADRESSE}/icons/vorschau.jpg" />
    <meta property="og:image:type" content="image/jpeg" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:image:alt" content="arcade" />
    <meta name="twitter:card" content="summary_large_image" />
    <title>${titel}</title>
    <link rel="stylesheet" href="${v("styles.css")}" />
${manifest ? `    <link rel="manifest" href="${v("app.webmanifest")}" />\n` : ""}    <link rel="icon" type="image/png" sizes="32x32" href="icons/icon-32.png" />
    <link rel="apple-touch-icon" sizes="180x180" href="icons/icon-180.png" />`;

const SPIELVIEWPORT = "width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0, user-scalable=no, viewport-fit=cover";

// Für die Vorschau eines geteilten Spiels: der Text ohne den Namen davor (der
// steht schon im Titel) und nur bis zum ersten Gedankenstrich.
export function kurzText(spiel) {
  const ohneName = spiel.text.startsWith(spiel.titel)
    ? spiel.text.slice(spiel.titel.length).replace(/^[:?]?\s*/, "")
    : spiel.text;
  const satz = ohneName.split(" – ")[0].trim().replace(/[.,;:]$/, "");
  const gross = satz.charAt(0).toLocaleUpperCase("de") + satz.slice(1);
  return /[.!?]$/.test(gross) ? gross : `${gross}.`;
}

export function spielSeite(spiel) {
  return `<!doctype html>
<!--
  Erzeugt von scripts/seiten-bauen.mjs – nicht von Hand ändern.
  Geändert wird die Tabelle dort, dann "npm run bauen".
-->
<html lang="de">
  <head>
${kopf({ titel: `${spiel.titel} · arcade`, text: spiel.text, kurz: kurzText(spiel), viewport: SPIELVIEWPORT })}
  </head>
  <body data-page="${spiel.page}" data-spiel="${spiel.spiel}">
    <!-- Die Bühne baut ${spiel.js}: die Landschaft, darauf ${spiel.baut}.
         Bewusst leer im HTML – hier steht kein Wort ausser dem Namen des
         Spiels, und den setzt die Bühne. -->
    <div id="${spiel.buehne.id}" class="${spiel.buehne.klasse}" aria-label="${spiel.titel}"></div>

${skripte(seitenSkripte(spiel))}
  </body>
</html>
`;
}

export function hubSeite() {
  return `<!doctype html>
<!--
  Erzeugt von scripts/seiten-bauen.mjs – nicht von Hand ändern.

  Die Startseite und zugleich der Startpunkt der installierten App: Wer die
  Spiele auf den Startbildschirm legt, landet hier. Was darauf steht, baut
  mini-games.js – die arcade: oben ein Spiel als Film mit seiner
  Bestenliste, darunter alle Spiele in Reihen. Dunkel schon hier, damit beim
  Laden nichts hell aufblitzt.
-->
<html lang="de">
  <head>
${kopf({
    titel: "arcade",
    text: "arcade: eine Runde spielen, Namen eintragen, oben stehen. Ohne Konto, ohne Anmeldung – die Bestenliste sehen alle.",
    kurz: "Eine Runde spielen, Namen eintragen, oben stehen.",
    viewport: "width=device-width, initial-scale=1.0, viewport-fit=cover",
    farbe: DUNKEL,
  })}
  </head>
  <body data-page="hub" class="ar">
    <main class="mini-seite ar-seite" data-uebersicht>
      <p class="mini-hinweis ar-leer">arcade wird geladen...</p>
    </main>

${skripte(hubSkripte())}
  </body>
</html>
`;
}

export function turnierSeite() {
  return `<!doctype html>
<!--
  Erzeugt von scripts/seiten-bauen.mjs – nicht von Hand ändern.

  Die Turnierseite: /turnier?t=<id>. Welches Turnier gemeint ist, steht in der
  Adresse; was darauf steht, baut turnier.js – wie die Startseite (die
  arcade), oben aber Name und Stand des Turniers und die Gesamtwertung, unten
  nur seine Spiele. Dunkel schon hier, damit beim Laden nichts hell
  aufblitzt. Kein Weg hinaus zu den anderen Spielen: Ein Turnier ist ein Raum
  für sich. Sie gehört zur
  installierten App: Wer im Turnier spielt, kommt von jedem Spiel hierher
  zurück, auch ohne Netz – und wer sie auf den Startbildschirm legt, legt das
  Turnier dorthin, mit seinem Namen (turnier.js, alsApp).

  Nicht für Suchmaschinen: Ein Turnier "nur mit Link" soll auch dort nicht
  auftauchen.
-->
<html lang="de">
  <head>
${kopf({
    titel: "Turnier · arcade",
    text: "Ein Turnier in der arcade: dieselben Spiele, eine eigene Rangliste, ein Ende. Ohne Konto, ohne Anmeldung.",
    kurz: "Dieselben Spiele, eine eigene Rangliste.",
    viewport: "width=device-width, initial-scale=1.0, viewport-fit=cover",
    farbe: DUNKEL,
  })}
    <meta name="robots" content="noindex, nofollow" />
  </head>
  <body data-page="turnier" class="ar">
    <main class="mini-seite ar-seite ist-turnier" data-turnier>
      <p class="mini-hinweis ar-leer">Das Turnier wird geladen...</p>
    </main>

${skripte(turnierSkripte())}
  </body>
</html>
`;
}

export function liveSeite() {
  return `<!doctype html>
<!--
  Erzeugt von scripts/seiten-bauen.mjs – nicht von Hand ändern.

  Der Multiplayer: /live (die, die gerade für alle offen sind; als Admin
  /live?neu, um einen anzulegen), /live?code=K7QMX2PA9Z (Lobby, Runden,
  Podest). Was darauf steht, baut live.js; die Spiele laufen in einem Rahmen
  darüber (live-spiel.js).

  Nicht für Suchmaschinen: Ein Multiplayer ist eine Verabredung, kein Ort.
-->
<html lang="de">
  <head>
${kopf({
    titel: "Multiplayer · arcade",
    text: "Multiplayer in der arcade: alle spielen zur selben Zeit dasselbe Level. Ohne Konto, mit einem Link.",
    kurz: "Alle spielen gleichzeitig dasselbe Level.",
    viewport: "width=device-width, initial-scale=1.0, viewport-fit=cover",
  })}
    <meta name="robots" content="noindex, nofollow" />
  </head>
  <body data-page="live">
    <main class="mini-seite lv-seite" data-live>
      <p class="mini-hinweis">Der Multiplayer wird geladen...</p>
    </main>

${skripte(liveSkripte())}
  </body>
</html>
`;
}

export function adminSeite() {
  return `<!doctype html>
<!--
  Erzeugt von scripts/seiten-bauen.mjs – nicht von Hand ändern.

  Der Adminbereich. Er steht bewusst neben der App und nicht in ihr: kein
  pwa.js, nicht im Zwischenspeicher des Service Workers, nicht im Manifest.
  Wer hierherkommt, will die aktuellen Zahlen sehen, nicht die von gestern.
-->
<html lang="de">
  <head>
${kopf({
    titel: "Adminbereich · arcade",
    text: "Die Bestenlisten der arcade ansehen und aufräumen.",
    viewport: "width=device-width, initial-scale=1.0, viewport-fit=cover",
    manifest: false,
  })}
    <meta name="robots" content="noindex, nofollow" />
  </head>
  <body data-page="admin">
    <main class="adm-seite" data-admin>
      <p class="adm-hinweis">Wird geladen...</p>
    </main>

${skripte(adminSkripte())}
  </body>
</html>
`;
}

export function manifest() {
  return JSON.stringify({
    id: "/",
    name: "arcade",
    short_name: "arcade",
    description: "Eine Runde spielen, Namen eintragen, oben stehen. Ohne Konto, ohne Anmeldung – die Bestenliste sehen alle.",
    lang: "de",
    dir: "ltr",
    start_url: "/",
    scope: "/",
    display: "fullscreen",
    display_override: ["fullscreen", "standalone", "minimal-ui"],
    orientation: "any",
    background_color: DUNKEL,
    theme_color: DUNKEL,
    categories: ["games"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  }, null, 2) + "\n";
}

// Alles, was eine Seite lädt – jede Datei einmal, in der Reihenfolge, in der
// sie zum ersten Mal vorkommt.
export function dateien() {
  const alle = ["./", "./index.html", ...SPIELE.map((s) => `./${s.seite}.html`), "./turnier.html", "./live.html"];
  const skripteAlle = [...hubSkripte(), ...turnierSkripte(), ...liveSkripte()];
  for (const s of SPIELE) for (const datei of seitenSkripte(s)) skripteAlle.push(datei);
  for (const datei of skripteAlle) {
    if (datei.startsWith("http")) continue;
    const mit = `./${v(datei)}`;
    if (!alle.includes(mit)) alle.push(mit);
  }
  alle.push(`./${v("styles.css")}`, `./${v("app.webmanifest")}`);
  for (const name of ["icon-32", "icon-180", "icon-192", "icon-512", "icon-maskable-192", "icon-maskable-512"]) {
    alle.push(`./icons/${name}.png`);
  }
  return alle;
}

export function serviceWorker() {
  const vorlage = readFileSync(path.join(WURZEL, "scripts", "service-worker-vorlage.js"), "utf8");
  return vorlage
    .replace("__FASSUNG__", FASSUNG)
    .replace("__SDK__", JSON.stringify(SDK, null, 2))
    .replace("__DATEIEN__", JSON.stringify(dateien(), null, 2));
}

// ---------------------------------------------------------------------------

export function alleDateien() {
  const raus = new Map();
  raus.set("index.html", hubSeite());
  for (const spiel of SPIELE) raus.set(`${spiel.seite}.html`, spielSeite(spiel));
  raus.set("turnier.html", turnierSeite());
  raus.set("live.html", liveSeite());
  raus.set("admin.html", adminSeite());
  raus.set("app.webmanifest", manifest());
  raus.set("service-worker.js", serviceWorker());
  return raus;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const nurPruefen = process.argv.includes("--pruefen");
  const raus = alleDateien();
  let anders = 0;
  for (const [name, inhalt] of raus) {
    const ziel = path.join(WURZEL, name);
    let alt = null;
    try { alt = readFileSync(ziel, "utf8"); } catch { /* gibt es noch nicht */ }
    if (alt === inhalt) continue;
    anders += 1;
    if (nurPruefen) console.error(`✗ ${name} ist nicht das, was das Skript baut.`);
    else { writeFileSync(ziel, inhalt); console.log(`· ${name}`); }
  }
  if (nurPruefen) {
    if (anders) {
      console.error(`\n${anders} Datei(en) weichen ab. "npm run bauen" bringt sie in Ordnung.`);
      process.exit(1);
    }
    console.log(`Alle ${raus.size} erzeugten Dateien stimmen (Fassung ${FASSUNG}).`);
  } else {
    console.log(anders ? `\n${anders} von ${raus.size} Dateien neu geschrieben.` : "Nichts zu tun – alles war schon aktuell.");
  }
}
