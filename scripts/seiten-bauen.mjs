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
export const FASSUNG = "2026-11-23-18";

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
    text: "Planetenhüpfer: Der Astronaut läuft um den Planeten – tippe im richtigen Moment, und er springt zum nächsten. Mitten auf den Planeten gibt es Bonus, mehrere hintereinander immer mehr.",
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
    text: "Kranhafen: Der Container pendelt am Kran – tippe im richtigen Moment und stapel ihn auf das fahrende Schiff. Jedes Schiff bringt einen Auftrag: Hochhaus, Treppe, Sortieren, Eilfracht, Gefahrgut.",
    baut: "der Hafen mit dem Kran",
  },
  {
    seite: "seiltaenzer", spiel: "ropeWalk", page: "rope", js: "seiltaenzer.js",
    titel: "Seiltänzer", buehne: { id: "st-stage", klasse: "cm-stage st-stage" },
    text: "Seiltänzer: Links halten lehnt nach links, rechts nach rechts – halt gegen Böen und Vögel, so weit du kommst.",
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
    seite: "turmspringen", spiel: "highDive", page: "highdive", js: "turmspringen.js",
    titel: "Turmspringen", buehne: { id: "ts-stage", klasse: "cm-stage ts-stage" },
    text: "Turmspringen: Halten dreht, Loslassen streckt – acht Sprünge, und jeder muss senkrecht ins Wasser. Perfekt zählt doppelt.",
    baut: "der Sprungturm im Bergsee",
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
    seite: "freitaucher", spiel: "freeDive", page: "freedive", js: "freitaucher.js",
    titel: "Freitaucher", buehne: { id: "fd-stage", klasse: "cm-stage fd-stage" },
    text: "Freitaucher: Ein Atemzug, so tief du dich traust – halte, um zu schwimmen. Nur Perlen, die du nach oben bringst, zählen.",
    baut: "das Meer mit dem Taucher",
  },
  {
    seite: "schwarm", spiel: "flockFlight", page: "flock", js: "schwarm.js",
    titel: "Schwarm", buehne: { id: "sw-stage", klasse: "cm-stage sw-stage" },
    text: "Schwarm: Links lenkt nach links, rechts nach rechts, beide ballen den Schwarm – führ ihn genau durch die Mitte jeder Lücke. Perfekt bringt Vögel.",
    baut: "das Meer im Abendlicht mit dem Schwarm",
  },
  {
    seite: "welle", spiel: "waveRide", page: "wave", js: "welle.js",
    titel: "Die Welle", buehne: { id: "wl-stage", klasse: "cm-stage wl-stage" },
    text: "Die Welle: Links halten fährt die Wand hinauf, rechts hinunter – pump dir Schwung und surf tief in der Röhre, nur dort gibt es Punkte. Hinter dir jagt der Schaum.",
    baut: "die Welle im Abendlicht mit der Surferin",
  },
  {
    seite: "steinhuepfer", spiel: "stoneSkip", page: "skip", js: "steinhuepfer.js",
    titel: "Steinhüpfer", buehne: { id: "sh-stage", klasse: "cm-stage sh-stage" },
    text: "Steinhüpfer: Tippe genau, wenn der Stein sein Spiegelbild trifft – so hüpft er über den stillen Bergsee, Hüpfer um Hüpfer schneller. Wie viele Meter schaffst du?",
    baut: "der Bergsee bei Tagesanbruch mit dem Stein",
  },
  {
    seite: "eiskanal", spiel: "iceRun", page: "icerun", js: "eiskanal.js",
    titel: "Eiskanal", buehne: { id: "ek-stage", klasse: "cm-stage ek-stage" },
    text: "Eiskanal: Links halten lenkt nach links, rechts nach rechts – eine Bobfahrt bei Nacht durch Steilkurven im Flutlicht. Die ruhige Linie bringt Tempo, jede Bande bremst.",
    baut: "die Eisbahn bei Nacht mit dem Bob",
  },
  {
    seite: "felsflug", spiel: "cliffFlight", page: "cliff", js: "felsflug.js",
    titel: "Felsflug", buehne: { id: "ff-stage", klasse: "cm-stage ff-stage" },
    text: "Felsflug: Im Wingsuit durch die Schlucht, links oder rechts halten – je näher am Fels, desto mehr Punkte. Der erste Kontakt beendet die Runde.",
    baut: "die Schlucht im Morgenlicht mit dem Flieger",
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
  {
    seite: "hammerwurf", spiel: "hammerThrow", page: "hammer", js: "hammerwurf.js",
    titel: "Hammerwurf", buehne: { id: "hw-stage", klasse: "cm-stage hw-stage" },
    text: "Hammerwurf: Er dreht sich immer schneller – tippe, und er lässt los. Triff den Sektor und wirf über die Linie, die mit jedem Wurf weiter wandert.",
    baut: "das Stadion mit dem Werfer",
  },
  {
    seite: "entenfamilie", spiel: "duckCrossing", page: "ducks", js: "entenfamilie.js",
    titel: "Entenfamilie", buehne: { id: "ef-stage", klasse: "cm-stage ef-stage" },
    text: "Entenfamilie: Halten heisst schwimmen, Loslassen warten – bring die Küken zwischen den Booten über den Fluss. Jedes Ufer bringt ein Küken mehr.",
    baut: "der Fluss mit den Booten",
  },
  {
    seite: "grubenlore", spiel: "mineCart", page: "minecart", js: "grubenlore.js",
    titel: "Höhlenfahrt", buehne: { id: "gl-stage", klasse: "cm-stage gl-stage" },
    text: "Höhlenfahrt: Halten heisst bremsen, Loslassen rollen – jag die Lore durchs Bergwerk: langsam unters Felsdach, mit Schwung über den Schacht. Hinter dir stürzt der Stollen ein.",
    baut: "das Bergwerk mit der Lore",
  },
  {
    seite: "rotoren", spiel: "twinRotor", page: "rotors", js: "rotoren.js",
    titel: "Zwei Rotoren", buehne: { id: "zr-stage", klasse: "cm-stage zr-stage" },
    text: "Zwei Rotoren: Links hält den linken Rotor, rechts den rechten – flieg die Drohne durch die Lichttore über den Dächern, am besten mitten hindurch. Jedes Tor lädt den Akku nach.",
    baut: "die Nacht über den Dächern mit der Drohne",
  },
  {
    seite: "augenmass", spiel: "eyeMeasure", page: "eye", js: "augenmass.js",
    titel: "Augenmass", buehne: { id: "am-stage", klasse: "cm-stage am-stage" },
    text: "Augenmass: Zehn Blätter, kein Lineal – wo trifft die Kugel nach der Bande die Wand, wo landet der Ball, wo ist der Mittelpunkt? Setz das Fadenkreuz so genau du kannst, danach wird auf den Zehntelmillimeter nachgemessen.",
    baut: "die Blaupause mit dem Fadenkreuz",
  },
  {
    seite: "feuerseil", spiel: "fireRope", page: "firerope", js: "feuerseil.js",
    titel: "Feuerseil", buehne: { id: "fe-stage", klasse: "cm-stage fe-stage" },
    text: "Feuerseil: Tippen heisst hüpfen, halten springt höher – bleib über dem brennenden Seil. Es dreht immer schneller, zögert, kehrt um und bekommt ein zweites.",
    baut: "der Dorfplatz bei Nacht mit dem Feuerseil",
  },
  {
    seite: "flaggen", spiel: "flagCommand", page: "flags", js: "flaggen.js",
    titel: "Flaggenkommando", buehne: { id: "fk-stage", klasse: "cm-stage fk-stage" },
    text: "Flaggenkommando: Zeig, was der Kapitän zeigt – links halten hebt den roten Wimpel, rechts die gelbe Fahne. Die Frist wird kürzer, er täuscht an und dreht sich um.",
    baut: "die Brücke des Schiffs mit dem Kapitän",
  },
  {
    seite: "zeitgefuehl", spiel: "timeSense", page: "timesense", js: "zeitgefuehl.js",
    titel: "Zeitgefühl", buehne: { id: "zf-stage", klasse: "cm-stage zf-stage" },
    text: "Zeitgefühl: Die Stoppuhr läuft an und verschwindet – tippe im richtigen Augenblick. Zehn Aufgaben, und jede Hundertstelsekunde daneben kostet einen Punkt.",
    baut: "die Werkbank mit der Stoppuhr",
  },
  {
    seite: "kletterwand", spiel: "speedClimb", page: "climb", js: "kletterwand.js",
    titel: "Kletterwand", buehne: { id: "kw-stage", klasse: "cm-stage kw-stage" },
    text: "Kletterwand: Tippe den nächsten Griff an, genau in die Mitte – je genauer, desto besser der Halt. Die Kraft läuft, die Griffe werden kleiner, bröckeln und gleiten davon.",
    baut: "der Kletterturm im Abendlicht mit der Kletterin",
  },
  {
    seite: "freihand", spiel: "freeHand", page: "sketch", js: "freihand.js",
    titel: "Freihand", buehne: { id: "fh-stage", klasse: "cm-stage fh-stage" },
    text: "Freihand: Zehn Blätter, ein Bleistift, kein Lineal und kein Zirkel – zieh den Kreis, das Lot, das Spiegelbild, das Fünfeck in einem Zug. Danach legt der Rotstift die ideale Form darüber und misst nach.",
    baut: "der Zeichentisch mit dem Blatt und dem Bleistift",
  },
  {
    seite: "kopfkino", spiel: "mindsEye", page: "mindseye", js: "kopfkino.js",
    titel: "Kopfkino", buehne: { id: "kn-stage", klasse: "cm-stage kn-stage" },
    text: "Kopfkino: Zehn Aufgaben fürs Vorstellungsvermögen – Würfelnetze falten, Körper drehen, einen Laser durch Spiegel schicken, ein Getriebe durchschauen. Elf Arten, und nach der Antwort läuft der Film wirklich.",
    baut: "die Leinwand mit dem Würfelnetz, das sich faltet",
  },
  {
    seite: "eisstock", spiel: "iceStock", page: "icestock", js: "eisstock.js",
    titel: "Eisstock", buehne: { id: "es-stage", klasse: "cm-stage es-stage" },
    text: "Eisstock: Zehn Bahnen, je ein Schub – spann den Stock wie eine Schleuder und lass ihn gleiten: durch Schnee, über die Bande, an Balken vorbei. Gemessen wird auf den Zentimeter, wie nah er an der Mitte liegen bleibt.",
    baut: "die Eisbahn mit dem Stock und den Ringen des Ziels",
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
// Die Realtime Database brauchen nur die Live-Seite (live.js) und
// Viererreihe (das Duell zu zweit). Die Spiele einer Live-Runde reden mit ihr
// über den Rahmen, nicht selbst.
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
// Ein Spiel zu zweit: das Fundament, die Realtime Database (für das Duell),
// kids.js (Ton-Knopf, Konfetti, kein Zoom), das Vorlesen (vorlesen.js: ein
// Lautsprecher neben den Texten), der gemeinsame Rahmen (zwei.js) und das
// Spiel selbst. Keine Anmeldung: Wer spielt, sagt nur seinen Namen.
export const zweiSkripte = (spiel) => [...SDK, SDK_DATABASE, ...GEMEINSAM, "kids.js", "vorlesen.js", "zwei.js", ...spiel.js, "pwa.js"];

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

  Die Vorschau eines geteilten Links (Titel, Satz) gilt hier für jedes
  Turnier. Den Namen des einen setzt beim Ausliefern
  netlify/edge-functions/turnier-vorschau.js ein; was hier steht, sieht nur,
  wer ein Turnier teilt, das es nicht (mehr) gibt.
-->
<html lang="de">
  <head>
${kopf({
    titel: "Turnier · arcade",
    text: "Ein Turnier in der arcade: mitspielen mit einem Tipp auf den Link – ohne Konto, ohne Anmeldung.",
    kurz: "Mitspielen mit einem Tipp – ohne Anmeldung.",
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

/*
 * Die Spiele zu zweit (mini-games.js, ZWEI_SPIELER): gegen den Computer oder
 * live auf zwei Geräten. Keine Spiele der Tabelle SPIELE – sie haben keine
 * Bestenliste, sondern eine kleine Bilanz, und sie laufen nicht auf der
 * gemeinsamen Bühne, sondern im Rahmen zwei.js. Die Adresse sagt, wo man ist
 * (?gegen=mittel, ?raum=K7QMX2PA9Z).
 *
 *   seite   Datei und Adresse, zugleich das, was am body steht
 *   js      die Skripte des Spiels, nach zwei.js
 */
export const ZWEI = [
  {
    seite: "viererreihe", titel: "Viererreihe", js: ["viererreihe-ki.js", "viererreihe.js"],
    text: "Viererreihe: Lass die Steine fallen – wer zuerst vier in einer Reihe hat, gewinnt. Gegen den Computer oder live zu zweit.",
    kurz: "Vier in einer Reihe – gegen den Computer oder live zu zweit.",
  },
  {
    seite: "tictactoe", titel: "Tic Tac Toe", js: ["tictactoe.js"],
    text: "Tic Tac Toe: Kreuz oder Kreis, abwechselnd ein Feld – wer zuerst drei in einer Reihe hat, gewinnt. Gegen den Computer oder live zu zweit.",
    kurz: "Drei in einer Reihe – gegen den Computer oder live zu zweit.",
  },
  {
    seite: "schiffe", titel: "Schiffe versenken", js: ["schiffe.js"],
    text: "Schiffe versenken: Versteck deine Flotte und such die des anderen – Treffer heisst nochmal. Gegen den Computer oder live zu zweit, jede auf ihrem Gerät.",
    kurz: "Flotte verstecken, Meer absuchen – gegen den Computer oder live zu zweit.",
  },
  {
    seite: "kaesekaestchen", titel: "Käsekästchen", js: ["kaesekaestchen.js"],
    text: "Käsekästchen: Striche zwischen den Punkten ziehen – wer ein Kästchen schliesst, bekommt es und zieht nochmal. Gegen den Computer oder live zu zweit.",
    kurz: "Striche ziehen, Kästchen schliessen – gegen den Computer oder live zu zweit.",
  },
  {
    seite: "muehle", titel: "Mühle", js: ["muehle.js"],
    text: "Mühle: Steine setzen, ziehen, springen – drei in einer Reihe sind eine Mühle und kosten den anderen einen Stein. Gegen den Computer oder live zu zweit.",
    kurz: "Steine setzen, Mühlen bauen – gegen den Computer oder live zu zweit.",
  },
  {
    seite: "schach", titel: "Schach", js: ["schach.js"],
    text: "Schach mit allen Regeln: Rochade, en passant, Umwandlung, Matt und Patt. Tippe eine Figur an – Punkte zeigen, wohin sie darf. Gegen den Computer oder live zu zweit.",
    kurz: "Schach mit allen Regeln – gegen den Computer oder live zu zweit.",
  },
  {
    seite: "paare", titel: "Paare finden", js: ["paare.js"],
    text: "Paare finden: Karten aufdecken, gleiche Tiere behalten – wer mehr Paare findet, gewinnt. Gegen den Computer oder live zu zweit.",
    kurz: "Karten aufdecken, Paare finden – gegen den Computer oder live zu zweit.",
  },
  {
    seite: "farbcode", titel: "Farbcode knacken", js: ["farbcode.js"],
    text: "Farbcode knacken: Versteck einen Code aus vier Farben und knack den des anderen – grün heisst richtiger Platz, gelb richtige Farbe. Gegen den Computer oder live zu zweit.",
    kurz: "Codes verstecken und knacken – gegen den Computer oder live zu zweit.",
  },
  {
    seite: "blitzpaar", titel: "Blitzpaar", js: ["blitzpaar.js"],
    text: "Blitzpaar: Zwölf Bilder, eines doppelt – wer es zuerst antippt, holt den Punkt. Beide spielen gleichzeitig, gegen den Computer oder live zu zweit.",
    kurz: "Das doppelte Bild finden, schneller als der andere.",
  },
  {
    seite: "schatzkarte", titel: "Schatzkarte & Kompass", js: ["schatzkarte.js"],
    text: "Schatzkarte & Kompass: Zusammen den Schatz finden – eine hat die Karte und zeigt den Weg, die andere sucht. Mit dem Computer als Partner oder live zu zweit.",
    kurz: "Zusammen den Schatz finden – eine hat die Karte, die andere sucht.",
  },
  {
    seite: "malen", titel: "Malen und Raten", js: ["malen.js"],
    text: "Malen und Raten: Eine malt mit dem Finger, die andere rät – zusammen sechs Runden. Mit dem Computer als Maler oder live zu zweit.",
    kurz: "Eine malt, die andere rät – zusammen.",
  },
  {
    seite: "wackelturm", titel: "Wackelturm zu zweit", js: ["wackelturm.js"],
    text: "Wackelturm zu zweit: Abwechselnd einen Klotz fallen lassen – zusammen so hoch, bis die Wolke erreicht ist, ohne dass der Turm kippt. Mit dem Computer als Partner oder live zu zweit.",
    kurz: "Zusammen einen Turm bauen, der nicht kippt.",
  },
  {
    seite: "zwillinge", titel: "Zwillings-Labyrinth", js: ["zwillinge.js"],
    text: "Zwillings-Labyrinth: Zwei Figuren, ein Labyrinth – Türen gehen nur auf, wenn die andere auf der Platte steht. Zusammen zum Ziel, mit dem Computer als Zwilling oder live zu zweit.",
    kurz: "Zusammen durchs Labyrinth – haltet euch die Türen auf.",
  },
];

export function zweiSeite(spiel) {
  return `<!doctype html>
<!--
  Erzeugt von scripts/seiten-bauen.mjs – nicht von Hand ändern.

  ${spiel.titel}: /${spiel.seite} (das Menü), /${spiel.seite}?gegen=mittel (gegen den
  Computer), /${spiel.seite}?raum=K7QMX2PA9Z (ein Duell zu zweit). Den Rahmen baut
  zwei.js, das Spiel ${spiel.js.join(", ")}.
-->
<html lang="de">
  <head>
${kopf({ titel: `${spiel.titel} · arcade`, text: spiel.text, kurz: spiel.kurz, viewport: SPIELVIEWPORT })}
  </head>
  <body data-page="${spiel.seite}">
    <main class="vr-seite" data-zwei>
      <p class="mini-hinweis">${spiel.titel} wird geladen...</p>
    </main>

${skripte(zweiSkripte(spiel))}
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

/*
 * Die Seite für alles, was es nicht gibt – und der Weg zum eigenen Link eines
 * Turniers.
 *
 * Netlify liefert sie aus, wenn unter einer Adresse keine Datei liegt
 * (404.html im veröffentlichten Ordner, ohne eine Zeile in netlify.toml).
 * Genau dort landet der eigene Link, den der Adminbereich vergibt
 * (admin.js, «Eigener Link»): games.alae.app/hotdog. Sieht die Adresse aus
 * wie die Kennung eines Turniers (6 bis 48 Zeichen aus a–z, 0–9 und dem
 * Bindestrich, wie firestore.rules sie verlangt), geht es sofort weiter auf
 * /turnier?t=hotdog. Gibt es das Turnier nicht, sagt das die Turnierseite.
 *
 * Eine Seite, die es gibt, nur anders geschrieben (/Turmbau), führt zu
 * ihr. Alles andere sieht diese Seite: nicht gefunden, und der Weg zu den
 * Spielen.
 *
 * Kein Skript von aussen und nicht im Zwischenspeicher des Service Workers:
 * Sie soll schnell weiterleiten und sonst nichts. Ihre Vorschau ist die eines
 * Turniers – geteilt wird diese Seite fast nur als eigener Link.
 */
export function weiterSeite() {
  const seiten = ["turnier", "live", "admin", ...ZWEI.map((z) => z.seite), ...SPIELE.map((s) => s.seite)];
  return `<!doctype html>
<!--
  Erzeugt von scripts/seiten-bauen.mjs – nicht von Hand ändern.

  Nicht gefunden – oder der eigene Link eines Turniers: /hotdog führt
  weiter auf /turnier?t=hotdog (siehe weiterSeite dort).
-->
<html lang="de">
  <head>
    <!-- Sie antwortet unter jeder Adresse, auch /gibt/es/nicht: Ohne base
         suchte sie ihr Stylesheet unter /gibt/es/styles.css. -->
    <base href="/" />
${kopf({
    titel: "arcade",
    text: "Ein Turnier in der arcade: mitspielen mit einem Tipp auf den Link – ohne Konto, ohne Anmeldung.",
    kurz: "Mitspielen mit einem Tipp – ohne Anmeldung.",
    viewport: "width=device-width, initial-scale=1.0, viewport-fit=cover",
    manifest: false,
  })}
    <meta name="robots" content="noindex, nofollow" />
    <script>
      (function () {
        var seiten = ${JSON.stringify(seiten)};
        var weg = "";
        try { weg = decodeURIComponent(window.location.pathname); } catch (e) { weg = window.location.pathname; }
        weg = weg.replace(/^[/]+|[/]+$/g, "").toLowerCase();
        var ziel = "";
        if (weg === "index") ziel = "/";
        else if (seiten.indexOf(weg) >= 0) ziel = "/" + weg + window.location.search;
        else if (/^[a-z0-9-]{6,48}$/.test(weg)) ziel = "/turnier?t=" + weg;
        if (!ziel) return;
        document.documentElement.className = "ar-weiter-geht";
        window.location.replace(ziel);
      })();
    </script>
  </head>
  <body data-page="nichtda" class="ar">
    <main class="ar-weiter">
      <h1 class="ar-weiter-titel">Hier ist nichts.</h1>
      <p class="ar-weiter-text">Diese Seite gibt es nicht – vielleicht ist der Link nicht ganz vollständig.</p>
      <a class="mini-knopf mini-knopf-voll" href="/">Zu den Spielen</a>
    </main>
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
  const alle = ["./", "./index.html", ...SPIELE.map((s) => `./${s.seite}.html`), "./turnier.html", "./live.html", ...ZWEI.map((z) => `./${z.seite}.html`)];
  const skripteAlle = [...hubSkripte(), ...turnierSkripte(), ...liveSkripte(), ...ZWEI.flatMap(zweiSkripte)];
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

// Je Spielseite, was nur sie braucht – für die Reihenfolge, in der der
// Service Worker füllt, und fürs Vorbereiten der Turnierspiele (turnier.js,
// offlineVorbereiten).
export function spielDateien() {
  const raus = {};
  for (const s of SPIELE) raus[s.seite] = [`./${s.seite}.html`, ...[s.js, ...(s.kunst || [])].map((d) => `./${v(d)}`)];
  return raus;
}

export function serviceWorker() {
  const vorlage = readFileSync(path.join(WURZEL, "scripts", "service-worker-vorlage.js"), "utf8");
  return vorlage
    .replace("__FASSUNG__", FASSUNG)
    .replace("__SDK__", JSON.stringify(SDK, null, 2))
    .replace("__DATEIEN__", JSON.stringify(dateien(), null, 2))
    .replace("__SPIELE__", JSON.stringify(spielDateien(), null, 2));
}

// ---------------------------------------------------------------------------

export function alleDateien() {
  const raus = new Map();
  raus.set("index.html", hubSeite());
  for (const spiel of SPIELE) raus.set(`${spiel.seite}.html`, spielSeite(spiel));
  raus.set("turnier.html", turnierSeite());
  raus.set("live.html", liveSeite());
  for (const z of ZWEI) raus.set(`${z.seite}.html`, zweiSeite(z));
  raus.set("admin.html", adminSeite());
  raus.set("404.html", weiterSeite());
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
