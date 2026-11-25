/*
 * zeitgefuehl.js – Zeitgefühl. Zehn Aufgaben, eine Stoppuhr, kein Blick drauf.
 *
 * Auf der Werkbank eines Uhrmachers liegt eine grosse Stoppuhr aus Messing.
 * Zehn Aufgaben hintereinander, und jede fragt dasselbe auf eine andere Art:
 * Wann ist es so weit? Die Uhr läuft an – und verschwindet. Wer spielt,
 * zählt im Kopf weiter und tippt im richtigen Augenblick, oder hält so lange,
 * wie es verlangt ist. Danach steht da, was die Uhr wirklich zeigte, und
 * wie viele Hundertstel es daneben war.
 *
 * Jede Aufgabe gibt bis zu hundert Punkte, und jede Hundertstelsekunde
 * daneben kostet einen (bei den mittleren 0,8, bei den schweren 0,6 –
 * KOSTEN). Tausend sind das Dach; wer im Schnitt eine Zehntelsekunde trifft,
 * steht bei neunhundert.
 *
 * Die zehn Aufgaben einer Runde: drei leichte, vier mittlere, drei schwere
 * (PLAN), je aus den Arten ihrer Stufe gewürfelt, keine zweimal, in
 * gewürfelter Reihe und mit gewürfelten Zeiten.
 *
 *   leicht   Stoppuhr   «Stoppe bei 3,50.» Die Ziffern laufen bis zur Hälfte,
 *                       dann stehen Striche da.
 *            Countdown  «Tippe bei null.» Zwei Zahlen sieht man, den Rest
 *                       zählt man selbst.
 *            Zeiger     Der Zeiger läuft einmal um das Blatt und verschwindet
 *                       nach knapp der Hälfte: tippen, wenn er oben ist.
 *            Kerze      Sie brennt gleichmässig herunter: tippen, wenn die
 *                       Flamme die Marke am Massstab erreicht.
 *   mittel   Takt       Vier Schläge leuchten, vier bleiben stumm: tippen
 *                       auf den achten.
 *            Nachhalten Eine Lampe brennt. Danach den Finger genauso lange
 *                       halten.
 *            Blind      «Halte genau 2,5 Sekunden.» Ohne jede Vorgabe.
 *            Lange Uhr  Wie die Stoppuhr, aber sechs, sieben Sekunden – und
 *                       zu sehen sind nur die ersten anderthalb.
 *            Zwei Zeiger  Zwei Zeiger drehen verschieden schnell (oder
 *                       gegeneinander): tippen, wenn sie sich treffen.
 *            Pendel     Es schwingt, dann liegt der Deckel darüber: tippen,
 *                       wenn es zum dritten (vierten) Mal ganz links ist.
 *            Ball       Er läuft zwischen zwei Wänden hin und her – der
 *                       müde wird bei jedem Anprall langsamer: tippen, wenn
 *                       er zum dritten (vierten) Mal rechts anschlägt.
 *   schwer   Zeitlupe   Die Uhr geht langsamer (oder schneller) als die
 *                       Zeit. Gestoppt wird nach dem, was sie zeigt.
 *            Doppelt    Die Lampe brennt – halten soll man doppelt (oder
 *                       halb) so lange.
 *            Störung    Die Uhr verschwindet, und an ihrer Stelle laufen
 *                       rote Zahlen im falschen Tempo. Sie lügen.
 *            Sanduhr    Der Sand rinnt gleichmässig, doch der Trichter ist
 *                       unten eng: Der Pegel fällt zum Schluss immer
 *                       schneller. Tippen, wenn sie leer ist.
 *            Glas füllen  Wasser läuft gleichmässig in einen Kelch, eine
 *                       Vase oder eine Flasche: Wo das Glas breit ist,
 *                       steigt es langsam. Tippen, wenn es voll ist.
 *            Zwei Blinker Zwei Lampen blinken in verschiedenem Takt (2 : 3,
 *                       3 : 4, 2 : 5 oder 3 : 5): tippen, wenn beide wieder
 *                       zugleich aufleuchten.
 *            Bremszeiger  Der Zeiger bremst gleichmässig: tippen, wenn er
 *                       stehen bleibt.
 *
 * Was man zuerst sieht und dann nicht mehr, verschwindet bei den Zeigern
 * und Ziffern; Kerze, Pendel, Ball, Sanduhr, Glas und Blinker deckt ein
 * Deckel aus Messing zu (zeichneDeckel).
 *
 * Vor jeder Aufgabe steht die Uhr. Die Aufgabe liegt da, man liest sie in
 * Ruhe, und erst ein Tipp lässt die Uhr laufen (aufgabeLos) – wie vor der
 * ersten. Wer gar nicht tippt, bekommt sie nach WARTE Sekunden von selbst:
 * Eine Runde soll zu Ende gehen.
 *
 * Gemessen wird die Zeit des Tipps selbst (der Zeitstempel des Fingers),
 * nicht die des nächsten Bildes – auf ganze Millisekunden. Ein Tipp, solange die Vorgabe noch zu sehen
 * ist, gilt nicht – der war ein Versehen. Wer gar nicht tippt, bekommt
 * nichts: Zweieinhalb Sekunden nach dem Augenblick geht es weiter.
 *
 * Welche Zeiten gefragt sind, würfelt der Zufall; in einem Turnier bekommen
 * alle dieselben zehn Aufgaben (zufall.js).
 *
 * Neben der Uhr liegt die Stempelkarte, wie an der Stechuhr einer Fabrik:
 * je Aufgabe eine Zeile, und jede Antwort wird darauf gestempelt – wie weit
 * daneben, wie viele Punkte. Wo neben der Uhr kein Platz ist (Handy hoch),
 * liegt sie kleiner darunter (zeichneStempelkarte).
 *
 * Aufgezeichnet werden die Züge (geist.js, zuege): jede neue Aufgabe, der
 * Tipp, der ihre Uhr startet, der Beginn eines Haltens und die Antwort. Damit lassen sich die besten Läufe
 * anschauen, und im Multiplayer sehen die anderen dasselbe (live-spiel.js).
 */
(() => {
  "use strict";

  if (document.body.dataset.page !== "timesense") return;

  const host = document.querySelector("#zf-stage");
  const shellApi = window.LernappGameShell;
  const cloudApi = window.LernappGameCloud;
  if (!host || !shellApi) return;

  const kids = () => window.LernappKids || null;
  const klang = () => window.ArcadeKlang || null;
  const ruhig = () => Boolean(kids()?.prefersReducedMotion?.());

  // Der Zufall: die Reihe der Aufgaben und ihre Zeiten.
  const zufall = window.LernappZufall?.fuer?.("timeSense") || {
    fest: false, neu() {}, zahl: Math.random,
  };

  // ---------------------------------------------------------------------------
  // Die Schrauben
  // ---------------------------------------------------------------------------
  const LEICHT = ["stoppuhr", "countdown", "zeiger", "kerze"];
  const MITTEL = ["takt", "nachhalten", "blind", "lang", "zweizeiger", "pendel", "ball"];
  const SCHWER = ["zeitlupe", "doppelt", "stoer", "sanduhr", "glas", "blinker", "bremse"];
  // So viele jeder Stufe kommen in eine Runde – gewürfelt aus ihren Arten.
  const PLAN = [3, 4, 3];
  const AUFGABEN = PLAN[0] + PLAN[1] + PLAN[2];

  const PUNKTE_JE = 100;
  // So viele Punkte kostet eine Hundertstelsekunde: leicht, mittel, schwer.
  const KOSTEN = [1, 0.8, 0.6];
  // Bis hierhin (ms) ist eine Antwort «haargenau»: goldene Schrift, Funken.
  const GENAU = 30;
  // Und darunter steht sie auf die Hundertstel.
  const HUNDERTSTEL = 5;

  const EINZUG = 700;        // ms: so lange legt sich eine neue Aufgabe hin
  const ZEIGEN_MS = 1900;    // so lange steht die Auflösung da
  const NACHLAUF = 2500;     // so lange nach dem Augenblick wartet eine Tipp-Aufgabe noch
  const WARTEN = 6000;       // so lange wartet eine Halte-Aufgabe auf den Finger
  const HALT_MEHR = 3000;    // so viel länger als verlangt lässt sich halten
  const AUSBLENDEN = 300;    // so lange verblasst, was verschwindet
  // Die Stempelkarte (zeichneStempelkarte): neben der Uhr, wenn links davon
  // so viel Platz ist (CSS-Pixel), sonst klein darunter. Kopf und Fuss der
  // grossen, Kopf und Zeile der kleinen; FELDER_H ist, was die zehn Felder
  // ganz unten brauchen, TEXT_H der Satz der Aufgabe über der Uhr.
  const KARTE_SEITE_MIN = 234;
  const KARTE_KOPF = 38;
  const KARTE_FUSS = 34;
  const KARTE_KLEIN_KOPF = 26;
  const KARTE_KLEIN_ZEILE = 21;
  const FELDER_H = 46;
  const TEXT_H = 96;
  const STEMPEL_MS = 260;
  // Vor jeder Aufgabe steht die Uhr, bis jemand tippt – aber nicht ewig:
  // Nach WARTE Sekunden läuft sie von selbst, in den letzten WARTE_ZAEHLT
  // zählt sie sichtbar herunter. Ein Tipp gilt erst nach WARTE_SPERRE (nicht
  // der, der noch der letzten Aufgabe galt), und die Uhr läuft ANLAUF ms
  // nach ihm an.
  const WARTE = 30;
  const WARTE_ZAEHLT = 5;
  const WARTE_SPERRE = 0.35;
  const ANLAUF = 200;
  const TOP_COUNT = 5;

  // ---------------------------------------------------------------------------
  // Kleine Rechnungen
  // ---------------------------------------------------------------------------
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const lerp = (a, b, k) => a + (b - a) * k;
  const TAU = Math.PI * 2;
  const auf = (x, schritt) => Math.round(x / schritt) * schritt;
  // Eine gewürfelte Zahl zwischen a und b, auf den Schritt gerundet.
  const zz = (a, b, schritt) => auf(a + (b - a) * zufall.zahl(), schritt);
  const aus = (liste) => liste[Math.min(liste.length - 1, Math.floor(zufall.zahl() * liste.length))];
  // 3500 → «3,50», und 2500 → «2,5» für die Sätze.
  const sek = (ms) => (ms / 1000).toFixed(2).replace(".", ",");
  const sekKurz = (ms) => String(ms / 1000).replace(".", ",");

  // Der müde Ball: Nach jedem Anprall bleibt so viel vom Tempo.
  const MUEDE = 0.85;
  // Die Sanduhr: Ihre Hälften sind Kegel; der Hals ist so weit (Teil der
  // grössten Weite).
  const HALS = 0.22;
  // Wie weit das Pendel ausschlägt (Bogenmass).
  const PENDEL_AUS = 0.6;
  // Die Gläser: ihre Weite (0 … 1) über der Höhe (0 Boden … 1 Rand) – und,
  // einmal ausgerechnet, wie viel Wasser bis zu jeder Höhe in ihnen steht
  // (rund, also mit der Weite im Quadrat).
  const GLAESER = (() => {
    const glatt = (x) => x * x * (3 - 2 * x);
    const formen = {
      kelch: (y) => 0.22 + 0.78 * y,
      bauch: (y) => 0.42 + 0.53 * Math.sin(Math.PI * y),
      flasche: (y) => (y < 0.55 ? 0.92 : 0.92 - 0.66 * glatt((y - 0.55) / 0.45)),
    };
    const SCHRITTE = 200;
    const raus = {};
    for (const [name, weite] of Object.entries(formen)) {
      const menge = new Float64Array(SCHRITTE + 1);
      for (let i = 1; i <= SCHRITTE; i += 1) menge[i] = menge[i - 1] + weite((i - 0.5) / SCHRITTE) ** 2 / SCHRITTE;
      raus[name] = { weite, menge, schritte: SCHRITTE };
    }
    return raus;
  })();

  // ---------------------------------------------------------------------------
  // Die Aufgaben
  // ---------------------------------------------------------------------------
  /*
   * Eine Aufgabe:
   *
   *   art, stufe (0 leicht, 1 mittel, 2 schwer), name, frage
   *   eingabe   "tipp" – die Antwort ist der Augenblick des Tipps (ms seit
   *             Beginn); "halten" – die Antwort ist, wie lange gehalten wurde
   *   ziel      die richtige Antwort in ms
   *   faktor    was eine echte Millisekunde auf dieser Uhr ist (Zeitlupe);
   *             daneben wird gemessen, wie die Uhr es zeigt
   *   ab        ab wann (ms) eine Eingabe gilt
   *   sicht     wie lange (ms) die Vorgabe zu sehen ist
   *
   * Jede Art würfelt immer gleich viele Zahlen.
   */
  function wuerfle(art) {
    switch (art) {
      case "stoppuhr": {
        const ziel = zz(2500, 4000, 250);
        const sicht = auf(ziel * 0.5, 50);
        return { art, stufe: 0, name: "Stoppuhr", frage: `Stoppe bei ${sek(ziel)}.`, eingabe: "tipp", ziel, faktor: 1, sicht, ab: sicht };
      }
      case "countdown": {
        const von = aus([4, 5]);
        return { art, stufe: 0, name: "Countdown", frage: "Zähl still weiter – tippe bei null.", eingabe: "tipp", ziel: von * 1000, faktor: 1, sicht: 2000, ab: 2000, von };
      }
      case "zeiger": {
        const umlauf = zz(3000, 4500, 500);
        const sicht = auf(umlauf * 0.4, 50);
        return { art, stufe: 0, name: "Zeiger", frage: "Tippe, wenn der Zeiger wieder oben ist.", eingabe: "tipp", ziel: umlauf, faktor: 1, sicht, ab: sicht, umlauf };
      }
      case "takt": {
        const schlag = zz(450, 750, 50);
        const start = 300;
        return { art, stufe: 1, name: "Takt", frage: "Vier Schläge siehst du – tippe auf den achten.", eingabe: "tipp", ziel: start + 7 * schlag, faktor: 1, sicht: start + 3 * schlag + 150, ab: start + 3 * schlag + 150, schlag, start };
      }
      case "nachhalten": {
        const dauer = zz(1500, 3000, 100);
        const an = 400;
        return { art, stufe: 1, name: "Nachhalten", frage: "Halte so lange, wie die Lampe brennt.", eingabe: "halten", ziel: dauer, faktor: 1, sicht: an + dauer, ab: an + dauer + 150, an, dauer };
      }
      case "blind": {
        const ziel = zz(2000, 3500, 500);
        return { art, stufe: 1, name: "Blind", frage: `Halte genau ${sekKurz(ziel)} Sekunden.`, eingabe: "halten", ziel, faktor: 1, sicht: 0, ab: 200 };
      }
      case "lang": {
        const ziel = zz(5500, 7000, 500);
        return { art, stufe: 1, name: "Lange Uhr", frage: `Stoppe bei ${sek(ziel)} – du siehst sie nur kurz.`, eingabe: "tipp", ziel, faktor: 1, sicht: 1500, ab: 1500 };
      }
      case "zeitlupe": {
        const faktor = aus([0.5, 0.75, 1.5, 2]);
        const zeige = auf(zz(3000, 4500, 50) * faktor, 250);
        const ziel = zeige / faktor;
        const sicht = auf(ziel * 0.5, 50);
        return {
          art, stufe: 2, name: faktor < 1 ? "Zeitlupe" : "Zeitraffer",
          frage: `Diese Uhr geht ${faktor < 1 ? "langsamer" : "schneller"}. Stoppe bei ${sek(zeige)}.`,
          eingabe: "tipp", ziel, faktor, sicht, ab: sicht, zeige,
        };
      }
      case "doppelt": {
        const mal = aus([2, 0.5]);
        const dauer = mal === 2 ? zz(1000, 1800, 100) : zz(3000, 4400, 200);
        const an = 400;
        return {
          art, stufe: 2, name: mal === 2 ? "Doppelt" : "Halb",
          frage: `Halte ${mal === 2 ? "doppelt" : "halb"} so lange, wie die Lampe brennt.`,
          eingabe: "halten", ziel: dauer * mal, faktor: 1, sicht: an + dauer, ab: an + dauer + 150, an, dauer, mal,
        };
      }
      case "kerze": {
        // Die Kerze brennt gleichmässig herunter: vom Anfang (oben, Teil der
        // ganzen Höhe) bis zur Marke dauert es ziel.
        const ziel = zz(3000, 4500, 250);
        const sicht = auf(ziel * 0.45, 50);
        const oben = zz(0.82, 0.95, 0.01);
        const marke = zz(0.22, 0.42, 0.01);
        return { art, stufe: 0, name: "Kerze", frage: "Tippe, wenn die Flamme die Marke erreicht.", eingabe: "tipp", ziel, faktor: 1, sicht, ab: sicht, oben, marke };
      }
      case "zweizeiger": {
        // Zwei Zeiger, verschieden schnell (oder gegeneinander): Sie treffen
        // sich zum ersten Mal bei ziel, über dem Winkel treffen. Bis dahin
        // holt der eine den anderen um den Teil teil einer Runde ein.
        const gegen = aus([false, true]);
        const ziel = zz(2800, 4200, 100);
        const teil = zz(0.6, 0.85, 0.05);
        const zusammen = ziel / teil;
        const s = zz(1.2, 2.2, 0.1);
        const sicht = auf(ziel * 0.45, 50);
        const treffen = zz(0, 345, 15);
        // Gleich herum: der schnelle (rot) und der langsame (türkis) im
        // Uhrzeigersinn. Gegeneinander: der rote im, der türkise gegen ihn.
        const umlauf = gegen ? [zusammen * (1 + s), zusammen * (1 + 1 / s)] : [(zusammen * s) / (1 + s), zusammen * s];
        return {
          art, stufe: 1, name: gegen ? "Gegenläufig" : "Zwei Zeiger",
          frage: gegen ? "Die Zeiger laufen gegeneinander. Tippe, wenn sie sich treffen." : "Tippe, wenn die beiden Zeiger übereinanderliegen.",
          eingabe: "tipp", ziel, faktor: 1, sicht, ab: sicht, gegen, umlauf, treffen,
        };
      }
      case "pendel": {
        // Das Pendel startet rechts aussen; ganz links ist es nach einer
        // halben Schwingung, dann jede ganze: zum n-ten Mal bei (n − ½)·schwingung.
        const schwingung = zz(1300, 1900, 50);
        const mal = aus([3, 4]);
        const sicht = auf(schwingung * 1.15, 50);
        return {
          art, stufe: 1, name: "Pendel", frage: `Tippe, wenn das Pendel zum ${mal === 3 ? "dritten" : "vierten"} Mal ganz links ist.`,
          eingabe: "tipp", ziel: (mal - 0.5) * schwingung, faktor: 1, sicht, ab: sicht, schwingung, mal,
        };
      }
      case "ball": {
        // Der Ball läuft von der linken Wand los; eine Strecke dauert strecke
        // ms – der müde Ball wird bei jedem Anprall langsamer (MUEDE).
        const muede = aus([false, true]);
        const strecke = zz(450, 750, 25);
        const mal = muede ? 3 : aus([3, 4]);
        const dauer = (i) => strecke / (muede ? MUEDE ** i : 1);
        let ziel = 0;
        for (let i = 0; i < 2 * mal - 1; i += 1) ziel += dauer(i);
        const sicht = auf(dauer(0) + dauer(1) + 0.3 * dauer(2), 50);
        return {
          art, stufe: 1, name: muede ? "Müder Ball" : "Ball",
          frage: `${muede ? "Der Ball wird bei jedem Anprall langsamer. Tippe, wenn er" : "Tippe, wenn der Ball"} zum ${mal === 3 ? "dritten" : "vierten"} Mal rechts anschlägt.`,
          eingabe: "tipp", ziel: Math.round(ziel), faktor: 1, sicht, ab: sicht, strecke, muede, mal,
        };
      }
      case "sanduhr": {
        // Der Sand rinnt gleichmässig – aber der Trichter ist unten eng: Der
        // Pegel fällt zum Schluss immer schneller (sandBei).
        const ziel = zz(3500, 5500, 250);
        const sicht = auf(ziel * 0.7, 50);
        const voll = zz(0.8, 0.95, 0.01);
        return { art, stufe: 2, name: "Sanduhr", frage: "Tippe, wenn die Sanduhr leer ist.", eingabe: "tipp", ziel, faktor: 1, sicht, ab: sicht, voll };
      }
      case "glas": {
        // Wasser läuft gleichmässig in ein Glas mit Form (GLAESER): Wo es
        // breit ist, steigt der Pegel langsam.
        const form = aus(Object.keys(GLAESER));
        const ziel = zz(3200, 5000, 200);
        const sicht = auf(ziel * 0.65, 50);
        return { art, stufe: 2, name: "Glas füllen", frage: "Das Wasser läuft gleichmässig. Tippe, wenn das Glas voll ist.", eingabe: "tipp", ziel, faktor: 1, sicht, ab: sicht, form };
      }
      case "blinker": {
        // Zwei Lampen, beide blinken bei null. Ihre Takte stehen im Verhältnis
        // m : n – gleichzeitig blinken sie wieder nach m·n Grundtakten (ziel).
        const [m, n] = aus([[2, 3], [3, 4], [2, 5], [3, 5]]);
        const ziel = zz(3000, 4200, 300);
        const takte = [(ziel / (m * n)) * m, (ziel / (m * n)) * n];
        const sicht = auf(Math.min(ziel - 1000, takte[1] + 0.6 * takte[0]), 50);
        return { art, stufe: 2, name: "Zwei Blinker", frage: "Tippe, wenn beide Lampen wieder gleichzeitig aufleuchten.", eingabe: "tipp", ziel, faktor: 1, sicht, ab: sicht, takte };
      }
      case "bremse": {
        // Der Zeiger bremst gleichmässig und steht bei ziel – nach runden Umläufen.
        const ziel = zz(3000, 4500, 100);
        const sicht = auf(ziel * 0.6, 50);
        const runden = zz(0.9, 1.6, 0.05);
        return { art, stufe: 2, name: "Bremszeiger", frage: "Der Zeiger wird langsamer. Tippe, wenn er stehen bleibt.", eingabe: "tipp", ziel, faktor: 1, sicht, ab: sicht, runden };
      }
      default: {
        const ziel = zz(3500, 5000, 250);
        const sicht = auf(ziel * 0.35, 50);
        const luege = aus([1.4, 0.7]);
        return { art: "stoer", stufe: 2, name: "Störung", frage: `Stoppe bei ${sek(ziel)} – die roten Zahlen lügen.`, eingabe: "tipp", ziel, faktor: 1, sicht, ab: sicht, luege };
      }
    }
  }

  // --- Wie es um eine Aufgabe steht, t ms nach ihrem Beginn ------------------
  // Die Kerze: wie hoch sie noch ist (Teil der ganzen Höhe).
  const kerzeBei = (a, t) => Math.max(0.03, a.oben - ((a.oben - a.marke) * Math.max(0, t)) / a.ziel);
  // Die zwei Zeiger: der Winkel des Zeigers i (im Uhrzeigersinn von oben).
  const zweiWinkel = (a, i, t) => (a.treffen / 180) * Math.PI + (i === 1 && a.gegen ? -1 : 1) * TAU * ((Math.max(0, t) - a.ziel) / a.umlauf[i]);
  // Das Pendel: sein Winkel (rechts positiv); bei null rechts aussen.
  const pendelWinkel = (a, t) => PENDEL_AUS * Math.cos((TAU * Math.max(0, t)) / a.schwingung);
  // Der Ball: wo er ist (0 links, 1 rechts), auf der wievielten Strecke,
  // seit wann (ms), und wie oft er rechts angeschlagen hat.
  function ballBei(a, t) {
    let anfang = 0;
    for (let i = 0; i < 60; i += 1) {
      const dauer = a.strecke / (a.muede ? MUEDE ** i : 1);
      if (Math.max(0, t) < anfang + dauer || i === 59) {
        const k = clamp((Math.max(0, t) - anfang) / dauer, 0, 1);
        return { ort: i % 2 ? 1 - k : k, strecke: i, seit: Math.max(0, t) - anfang, rechts: Math.floor((i + 1) / 2) };
      }
      anfang += dauer;
    }
    return { ort: 0, strecke: 0, seit: 0, rechts: 0 };
  }
  // Die Sanduhr: wie hoch der Sand oben noch steht und unten schon liegt
  // (je Teil der Höhe einer Hälfte). Oben fliesst gleich viel Sand je
  // Millisekunde ab – im engen Trichter fällt der Pegel darum immer schneller.
  function sandBei(a, t) {
    const b = 1 - HALS;
    const menge = (h) => ((HALS + b * h) ** 3 - HALS ** 3) / (3 * b);
    const ganz = menge(a.voll);
    const oben = ganz * clamp(1 - Math.max(0, t) / a.ziel, 0, 1);
    const unten = ganz - oben;
    return {
      oben: oben <= 0 ? 0 : (Math.cbrt(3 * b * oben + HALS ** 3) - HALS) / b,
      unten: (1 - Math.cbrt(Math.max(0, 1 - 3 * b * unten))) / b,
    };
  }
  // Das Glas: wie hoch das Wasser steht (Teil der Höhe) – bei ziel am Rand.
  function glasBei(a, t) {
    const glas = GLAESER[a.form];
    const soll = glas.menge[glas.schritte] * clamp(Math.max(0, t) / a.ziel, 0, 1);
    let i = 0;
    while (i < glas.schritte && glas.menge[i + 1] < soll) i += 1;
    if (i >= glas.schritte) return 1;
    const k = (soll - glas.menge[i]) / Math.max(1e-12, glas.menge[i + 1] - glas.menge[i]);
    return (i + clamp(k, 0, 1)) / glas.schritte;
  }
  // Die Blinker: wie hell Lampe i gerade ist (1 im Augenblick des Blinkens).
  const blinkHell = (a, i, t) => (t < 0 ? 0 : clamp(1 - (t - Math.floor(t / a.takte[i]) * a.takte[i]) / 260, 0, 1));
  // Der bremsende Zeiger: sein Winkel – er bremst gleichmässig bis ziel.
  const bremsWinkel = (a, t) => a.runden * TAU * (1 - (1 - clamp(t, 0, a.ziel) / a.ziel) ** 2);

  // Die zehn Aufgaben einer Runde: erst drei leichte, dann vier mittlere,
  // dann drei schwere – je aus den Arten ihrer Stufe gewürfelt, keine zweimal.
  function aufgabenFuer() {
    const reihe = [...zufall.misch(LEICHT).slice(0, PLAN[0]), ...zufall.misch(MITTEL).slice(0, PLAN[1]), ...zufall.misch(SCHWER).slice(0, PLAN[2])];
    return reihe.map((art) => wuerfle(art));
  }

  /*
   * Die Testrunde (?alle in der Adresse; im Adminbereich «▶ Alle Aufgaben»):
   * jede Art einmal, die leichten zuerst – Zeitlupe und Zeitraffer, Doppelt
   * und Halb, die zwei Zeiger gleich und gegenläufig, der Ball frisch und
   * müde sowie Kelch, Vase und Flasche je für sich, also vierundzwanzig
   * (SPIELARTEN). Zum Ausprobieren: Sie geht in keine
   * Bestenliste und wird nicht aufgezeichnet; oben steht der Knopf
   * «Überspringen». ?alle=takt,stoer nimmt nur diese Arten. Im Turnier, im
   * Live-Modus und beim Zuschauen gibt es sie nicht.
   */
  const TESTRUNDE = (() => {
    const p = new URLSearchParams(window.location.search);
    if (!p.has("alle") || p.has("turnier") || p.has("live") || p.has("zuschauen") || zufall.fest) return null;
    const alle = [...LEICHT, ...MITTEL, ...SCHWER];
    const wunsch = String(p.get("alle") || "").toLowerCase().split(/[\s,]+/).filter(Boolean);
    const arten = alle.filter((art) => wunsch.includes(art));
    return arten.length ? arten : alle;
  })();
  // Die Spielarten einer Art, die in der Testrunde je einmal drankommen.
  const SPIELARTEN = {
    zeitlupe: [(a) => a.faktor < 1, (a) => a.faktor > 1],
    doppelt: [(a) => a.mal === 2, (a) => a.mal !== 2],
    zweizeiger: [(a) => !a.gegen, (a) => a.gegen],
    ball: [(a) => !a.muede, (a) => a.muede],
    glas: [(a) => a.form === "kelch", (a) => a.form === "bauch", (a) => a.form === "flasche"],
  };
  function testAufgaben() {
    const raus = [];
    for (const art of TESTRUNDE) {
      for (const passt of SPIELARTEN[art] || [() => true]) {
        let a = wuerfle(art);
        for (let i = 0; i < 80 && !passt(a); i += 1) a = wuerfle(art);
        raus.push(a);
      }
    }
    return raus;
  }

  // Die gewürfelte Welt in Worten (für die Prüfung).
  function weltText(liste = state.aufgaben) {
    return (liste || []).map((a) => `${a.art}:${Math.round(a.ziel)}${a.faktor !== 1 ? `×${a.faktor}` : ""}${a.mal ? `·${a.mal}` : ""}${a.luege ? `~${a.luege}` : ""}${a.form ? `/${a.form}` : ""}${a.gegen || a.muede ? "!" : ""}${a.takte ? `/${a.takte.map(Math.round).join(":")}` : ""}`).join(" ");
  }

  // Wie weit daneben, in Millisekunden dieser Uhr: plus heisst zu spät (oder
  // zu lang), minus zu früh. null: gar keine Antwort.
  const daneben = (a, wert) => (wert === null || wert === undefined ? null : (wert - a.ziel) * a.faktor);

  // Die Punkte: hundert, und jede Hundertstelsekunde daneben kostet.
  function punkteFuer(ms, stufe = 0) {
    if (ms === null || !Number.isFinite(ms)) return 0;
    return clamp(Math.round(PUNKTE_JE - (Math.abs(ms) / 10) * KOSTEN[stufe]), 0, PUNKTE_JE);
  }

  // ---------------------------------------------------------------------------
  // Zustand
  // ---------------------------------------------------------------------------
  // phase: "bereit" (noch kein Tipp), "warten" (die Aufgabe liegt da, die
  //        Uhr steht), "aufgabe" (sie läuft), "zeigen" (die Auflösung),
  //        "zuschauen", "ende"
  const state = {
    phase: "bereit",
    aufgaben: null,
    index: 0,
    punkte: 0,
    liste: [],             // je Aufgabe { ms, punkte, wert } – null, solange sie offen ist
    t0: 0,                 // wann die Aufgabe hingelegt wurde (performance.now)
    wartSeit: 0,           // seit wann sie daliegt und auf den Tipp wartet
    tZeig: 0,              // wann die Auflösung begann
    haltAb: null,          // seit wann gehalten wird (ms der Aufgabe) – null: nicht
    wertung: null,         // { wert, ms, punkte }, sobald die Auflösung dasteht
    serie: 0,
    tickBei: -1,
    zuFrueh: -9e9,         // wann zuletzt zu früh getippt wurde (performance.now)
    unten: false,          // ob gerade ein Finger liegt (für die Krone der Uhr)
    funken: [],
    zeit: 0,
  };

  let shell = null;
  let feld = null;
  let canvas = null;
  let g = null;
  let status = null;
  let frame = null;
  let last = 0;
  let stepTimer = null;
  // Wem zugeschaut wird: im Multiplayer nach den eigenen zehn Aufgaben
  // (live-spiel.js), oder ein Lauf aus der Hall of Fame (geist.js, zuschauer).
  let zuschauer = null;
  // Die Aufzeichnung der Züge (geist.js, zuege).
  let aufnahme = null;

  const view = { dpr: 1, cssW: 0, cssH: 0, frei: 0, cx: 0, cy: 0, r: 120, karte: null };

  const aufgabe = () => state.aufgaben?.[state.index] || null;
  // Wie viele Aufgaben die Runde hat: zehn – in der Testrunde vierundzwanzig.
  const anzahl = () => state.aufgaben?.length || AUFGABEN;
  // Die Zeit der Aufgabe in ms: null ist, wenn sie fertig hingelegt ist.
  const seit = (jetzt = performance.now()) => jetzt - state.t0 - EINZUG;

  function clearStep() {
    if (stepTimer) { window.clearTimeout(stepTimer); stepTimer = null; }
  }

  function stopLoop() {
    if (frame) { window.cancelAnimationFrame(frame); frame = null; }
  }

  // ---------------------------------------------------------------------------
  // Klang
  // ---------------------------------------------------------------------------
  const zuletzt = new Map();
  function ton(id, o = {}, pause = 60) {
    const ms = performance.now();
    if (ms - (zuletzt.get(id) ?? -1e9) < pause) return;
    zuletzt.set(id, ms);
    klang()?.ton?.(id, o);
  }

  // Die Antwort steht: erst der Drücker der Uhr, einen Wimpernschlag später,
  // wie nah es war.
  function antwortKlang(punkte) {
    ton("zeitgefuehl.stopp");
    const spaeter = { verzoegerung: 0.3 };
    if (punkte >= 97) {
      state.serie += 1;
      ton(state.serie >= 3 ? "meilenstein" : "perfekt", spaeter);
      return;
    }
    state.serie = 0;
    if (punkte >= 50) ton("punkt", spaeter);
    else ton("fehler", spaeter);
  }

  function funkenBei(x, y) {
    if (ruhig()) return;
    for (let i = 0; i < 22; i += 1) {
      const w = Math.random() * TAU;
      const v = 60 + Math.random() * 200;
      state.funken.push({ x, y, vx: Math.cos(w) * v, vy: Math.sin(w) * v - 40, alt: 0, leben: 0.5 + Math.random() * 0.5 });
    }
  }

  // ---------------------------------------------------------------------------
  // Im Multiplayer und beim Anschauen: die Züge
  // ---------------------------------------------------------------------------
  /*
   * Ein Zug (geist.js, zuege; live-spiel.js, zug):
   *
   *   c   die wievielte Aufgabe × 8 + was gerade ist: 4 sie liegt da und
   *       wartet auf den Tipp, 0 ihre Uhr läuft an, 2 der Finger liegt
   *       (gehalten wird), 1 die Antwort steht, 3 niemand hat geantwortet
   *   a   bei 1 die Antwort in ms (der Augenblick des Tipps oder wie lange
   *       gehalten wurde), bei 2 seit wann gehalten wird, bei 0 eine 1, wenn
   *       die Uhr nach einem Tipp anläuft (ANLAUF) – ältere Aufzeichnungen
   *       kennen das Warten nicht: Dort heisst 0 «sie liegt da», und die Uhr
   *       läuft EINZUG später
   *
   * Die Aufgaben kommen aus derselben Saat. Wer zuschaut, legt sie in
   * derselben Reihe hin, lässt die Uhr von da an selbst laufen und rechnet
   * die Punkte der Antwort selbst.
   */
  function meldeZug(was, a = 0) {
    if (zuschauer) return;
    const ort = { a: Math.round(a), b: 0, c: state.index * 8 + was };
    aufnahme?.zug(state.punkte, ort);
    const live = window.LernappLiveSpiel;
    if (shell?.live && live?.zug && live.gestartet?.()) live.zug(state.punkte, ort);
  }

  // ---------------------------------------------------------------------------
  // Ablauf
  // ---------------------------------------------------------------------------
  // Eine neue Aufgabe liegt auf der Werkbank. Die Uhr steht noch: Erst ein
  // Tipp lässt sie laufen (aufgabeLos).
  function aufgabeAuf(index) {
    clearStep();
    state.index = index;
    state.phase = "warten";
    state.t0 = performance.now();
    state.wartSeit = state.t0;
    state.haltAb = null;
    state.wertung = null;
    state.tickBei = -1;
    const a = aufgabe();
    if (status) status.textContent = `Aufgabe ${index + 1} von ${anzahl()}: ${a.frage} Tippe, wenn du bereit bist.`;
    ton("zeitgefuehl.blatt");
    meldeZug(4);
  }

  // Der Tipp: Jetzt läuft die Uhr an.
  function aufgabeLos() {
    if (state.phase !== "warten") return;
    state.phase = "aufgabe";
    // Hingelegt ist sie schon: Die Uhr beginnt ANLAUF ms nach dem Tipp.
    state.t0 = performance.now() - EINZUG + ANLAUF;
    state.tickBei = -1;
    const a = aufgabe();
    if (status) status.textContent = `Aufgabe ${state.index + 1} von ${anzahl()}: ${a.frage}`;
    ton("zeitgefuehl.tick");
    meldeZug(0, 1);
  }
  // Ob die wartende Aufgabe schon einen Tipp annimmt.
  const bereitZumLos = () => state.phase === "warten" && performance.now() - state.wartSeit >= WARTE_SPERRE * 1000;

  // Die Antwort – der Augenblick des Tipps oder die gehaltene Dauer in ms,
  // oder null, wenn niemand geantwortet hat. Gerechnet wird mit ganzen
  // Millisekunden: So steht sie auch in der Aufzeichnung, und wer zuschaut,
  // kommt auf dieselben Punkte.
  function antworte(roh) {
    if (state.phase !== "aufgabe") return;
    clearStep();
    const a = aufgabe();
    const wert = roh === null || roh === undefined ? null : Math.round(roh);
    state.phase = "zeigen";
    state.tZeig = performance.now();
    state.haltAb = null;
    const ms = daneben(a, wert);
    const punkte = punkteFuer(ms, a.stufe);
    state.wertung = { wert, ms, punkte };
    state.liste[state.index] = { wert, ms, punkte };
    state.punkte += punkte;
    shell.setCount(state.punkte);
    meldeZug(wert === null ? 3 : 1, wert ?? 0);
    antwortKlang(punkte);
    if (ms !== null && Math.abs(ms) <= GENAU) { funkenBei(view.cx, view.cy); kids()?.vibrate?.([14, 40, 22]); } else if (punkte >= 50) kids()?.vibrate?.(12);
    if (status) status.textContent = ms === null ? "Keine Antwort: 0 Punkte." : `${sek(Math.abs(ms))} Sekunden daneben: ${punkte} Punkte.`;
    stepTimer = window.setTimeout(weiter, ZEIGEN_MS);
  }

  // Die Auflösung hat lange genug dagestanden: die nächste Aufgabe – oder,
  // nach der zehnten, das Ergebnis.
  function weiter() {
    if (state.phase !== "zeigen") return;
    clearStep();
    if (state.index + 1 >= anzahl()) finish();
    else aufgabeAuf(state.index + 1);
  }

  // Überspringen (nur in der Testrunde): die nächste Aufgabe legt sich hin,
  // ohne dass die jetzige gemessen wird – nach der letzten die Tafel.
  function ueberspringe() {
    if (!TESTRUNDE || zuschauer) return;
    if (state.phase === "bereit") { losGehts(); return; }
    if (state.phase !== "warten" && state.phase !== "aufgabe" && state.phase !== "zeigen") return;
    clearStep();
    state.haltAb = null;
    if (!state.liste[state.index]) state.liste[state.index] = { wert: null, ms: null, punkte: 0, uebersprungen: true };
    if (state.index + 1 >= anzahl()) finish();
    else aufgabeAuf(state.index + 1);
  }

  // Die Zeit eines Fingers oder einer Taste: ihr eigener Zeitstempel, wenn er
  // zur Uhr der Seite passt – sonst jetzt.
  function zeitVon(zeitstempel) {
    const nun = performance.now();
    return zeitstempel > 0 && Math.abs(zeitstempel - nun) < 400 ? zeitstempel : nun;
  }

  // Drücken: bei einer Tipp-Aufgabe die Antwort, bei einer Halte-Aufgabe der
  // Beginn. Solange die Vorgabe noch zu sehen ist, gilt es nicht.
  function druck(zeitstempel = 0) {
    if (state.phase !== "aufgabe") return;
    const a = aufgabe();
    const t = seit(zeitVon(zeitstempel));
    if (t < a.ab) { if (t > 0) state.zuFrueh = performance.now(); return; }
    if (a.eingabe === "tipp") { antworte(t); return; }
    if (state.haltAb !== null) return;
    state.haltAb = t;
    ton("zeitgefuehl.lampe");
    meldeZug(2, t);
  }

  // Loslassen: bei einer Halte-Aufgabe die Antwort.
  function los(zeitstempel = 0) {
    if (state.phase !== "aufgabe" || state.haltAb === null) return;
    antworte(Math.max(0, seit(zeitVon(zeitstempel)) - state.haltAb));
  }

  // Was die Uhr tut, Bild für Bild: ticken, solange man sie sieht, und
  // weitergehen, wenn niemand antwortet.
  function uhrTakt() {
    // Die Aufgabe wartet auf den Tipp – aber nicht ewig.
    if (state.phase === "warten") {
      if (performance.now() - state.wartSeit >= WARTE * 1000) aufgabeLos();
      return;
    }
    if (state.phase !== "aufgabe") return;
    const a = aufgabe();
    const t = seit();
    if (t < 0) return;
    // Das Ticken: jede Sekunde der sichtbaren Uhr, jeder sichtbare Schlag.
    let tick = -1;
    if (a.art === "takt") { if (t < a.sicht) tick = Math.floor((t - a.start) / a.schlag); } else if (a.art === "nachhalten" || a.art === "doppelt") {
      const lampe = t >= a.an && t < a.an + a.dauer ? 1 : t >= a.an + a.dauer ? 2 : 0;
      if (lampe !== state.tickBei && lampe > 0) { state.tickBei = lampe; ton("zeitgefuehl.lampe", { laut: lampe === 1 ? 1 : 0.6 }); }
    } else if (a.art === "pendel") { if (t < a.sicht) tick = Math.floor(t / (a.schwingung / 2)); } else if (a.art === "ball") { if (t < a.sicht) tick = ballBei(a, t).strecke; } else if (a.art === "blinker") {
      // Jedes Blinken klingt – solange man die Lampen sieht.
      const blink = Math.floor(t / a.takte[0]) * 100 + Math.floor(t / a.takte[1]);
      if (t < a.sicht && blink !== state.tickBei) { state.tickBei = blink; ton("zeitgefuehl.lampe", { laut: 0.55 }); }
    } else if (a.sicht && t < a.sicht) tick = Math.floor((t * a.faktor) / 1000);
    if (tick >= 0 && tick !== state.tickBei) { state.tickBei = tick; ton("zeitgefuehl.tick"); }
    // Niemand antwortet.
    if (a.eingabe === "tipp") {
      if (t >= a.ziel + NACHLAUF) antworte(null);
    } else if (state.haltAb === null) {
      if (t >= a.ab + WARTEN) antworte(null);
    } else if (t - state.haltAb >= a.ziel + HALT_MEHR) {
      antworte(t - state.haltAb);
    }
  }

  function takt(dt) {
    state.zeit += dt;
    if (state.phase === "zuschauen") zuschauenTakt();
    else uhrTakt();
    for (let i = state.funken.length - 1; i >= 0; i -= 1) {
      const f = state.funken[i];
      f.alt += dt;
      if (f.alt >= f.leben) { state.funken.splice(i, 1); continue; }
      f.x += f.vx * dt;
      f.y += f.vy * dt;
      f.vy += 260 * dt;
      f.vx *= 1 - 1.8 * dt;
    }
  }

  function loop(now) {
    frame = window.requestAnimationFrame(loop);
    const dt = clamp((now - last) / 1000, 0, 0.05);
    last = now;
    messen();
    takt(dt);
    zeichnen();
  }

  // ---------------------------------------------------------------------------
  // Die Fläche
  // ---------------------------------------------------------------------------
  function buildPlatz() {
    const platz = shell.el("div", "zf-platz");
    feld = shell.el("div", "zf-feld");
    canvas = document.createElement("canvas");
    canvas.className = "zf-canvas";
    canvas.setAttribute("aria-hidden", "true");
    feld.append(canvas);
    g = canvas.getContext("2d");
    platz.append(feld);
    return platz;
  }

  function messen() {
    if (!canvas || !feld) return;
    const cssW = Math.max(80, feld.clientWidth);
    const cssH = Math.max(80, feld.clientHeight);
    const dpr = shellApi.bildpunkte(cssW, cssH, 2.5);
    const frei = Math.min(cssH * 0.4, shell?.frei?.(canvas) || 0);
    if (cssW === view.cssW && cssH === view.cssH && dpr === view.dpr && frei === view.frei) return;
    view.cssW = cssW;
    view.cssH = cssH;
    view.dpr = dpr;
    view.frei = frei;
    const pw = Math.round(cssW * dpr);
    const ph = Math.round(cssH * dpr);
    if (canvas.width !== pw) canvas.width = pw;
    if (canvas.height !== ph) canvas.height = ph;
    // Die Uhr in der Mitte: oben der Satz der Aufgabe, darunter die
    // Auflösung, ganz unten die zehn Felder. Links neben der Uhr die
    // Stempelkarte – oder, wo dort kein Platz ist, unter ihr, statt der
    // Felder (sie sagt mehr als sie).
    const nutzH = cssH - frei;
    let R = Math.min(cssW * 0.36, nutzH * 0.225);
    let cy = frei + nutzH * 0.5;
    const cx = cssW / 2;
    view.karte = null;
    const links = cx - R * 1.25 - 12;
    if (links >= KARTE_SEITE_MIN) {
      const w = Math.min(290, links - 24);
      const platz = cssH - frei - 16 - FELDER_H;
      const zeile = clamp((platz - KARTE_KOPF - KARTE_FUSS) / anzahl(), 17, 26);
      const h = KARTE_KOPF + KARTE_FUSS + zeile * anzahl();
      view.karte = {
        art: "seite", klein: false, w, h, zeile,
        x: Math.round((cx - R * 1.25) / 2 - w / 2),
        y: Math.round(clamp(cy - h / 2, frei + 8, Math.max(frei + 8, cssH - FELDER_H - 8 - h))),
      };
    } else {
      // Unter der Uhr. Darüber muss Platz bleiben für den Satz der Aufgabe
      // (TEXT_H), die Uhr und ihre Auflösung. Wo viel Platz ist (Tablet
      // hoch), liegt dort die ganze Karte, wenn die Uhr dafür nicht viel
      // kleiner werden muss; sonst die kleine, in zwei Spalten – und für sie
      // wird die Uhr kleiner, wenn es sein muss, aber nie zu klein.
      const zeileGross = 22;
      const hGross = KARTE_KOPF + KARTE_FUSS + zeileGross * anzahl();
      const hKlein = KARTE_KLEIN_KOPF + KARTE_KLEIN_ZEILE * Math.ceil(anzahl() / 2) + 10;
      const rGross = (cssH - frei - TEXT_H - 20 - hGross) / 3.03;
      const rKlein = (cssH - frei - TEXT_H - 20 - hKlein) / 3.03;
      const gross = rGross >= Math.max(150, R * 0.8);
      if (gross || rKlein >= 80) {
        const h = gross ? hGross : hKlein;
        R = Math.min(R, gross ? rGross : rKlein);
        const w = gross ? Math.min(cssW - 24, 400) : Math.min(cssW - 24, 520);
        const y = cssH - 12 - h;
        const oben = frei + TEXT_H + R * 1.38;
        const unten = y - 8 - R * 1.65;
        cy = Math.max(oben, Math.min(cy, (oben + unten) / 2));
        view.karte = { art: "unten", klein: !gross, w, h, zeile: gross ? zeileGross : KARTE_KLEIN_ZEILE, x: Math.round(cx - w / 2), y };
      }
    }
    view.r = R;
    view.cx = cx;
    view.cy = cy;
    // Der Hinweis «schaut zu» (geist.js) steht über einer Karte am unteren Rand.
    host.dataset.karte = view.karte?.art || "";
  }

  // ---------------------------------------------------------------------------
  // Zeichnen
  // ---------------------------------------------------------------------------
  const MESSING = "#d9a441";
  const GOLD = "#ffd23f";
  const TUERKIS = "#35d6c6";
  const ROT = "#ff6b5e";

  function schrift(text, x, y, gross, farbe, { fett = 800, breit = 0, mono = false, alpha = 1, rand = 0 } = {}) {
    g.save();
    g.globalAlpha *= alpha;
    g.font = `${fett} ${Math.round(gross)}px ${mono ? "ui-monospace, 'SF Mono', Menlo, Consolas, monospace" : "system-ui, sans-serif"}`;
    g.textAlign = "center";
    g.textBaseline = "middle";
    if (rand) {
      g.lineWidth = rand;
      g.lineJoin = "round";
      g.strokeStyle = "rgba(6, 10, 12, 0.85)";
      g.strokeText(text, x, y, breit || undefined);
    }
    g.fillStyle = farbe;
    g.fillText(text, x, y, breit || undefined);
    g.restore();
  }

  // Ein Zahnrad: Zierde auf der Werkbank.
  function zahnrad(x, y, r, zaehne, winkel, farbe) {
    g.save();
    g.translate(x, y);
    g.rotate(winkel);
    g.strokeStyle = farbe;
    g.lineWidth = Math.max(1.5, r * 0.07);
    g.beginPath();
    for (let i = 0; i < zaehne * 2; i += 1) {
      const w = (i / (zaehne * 2)) * TAU;
      const rr = i % 2 ? r : r * 0.84;
      const w2 = ((i + 1) / (zaehne * 2)) * TAU;
      g.lineTo(Math.cos(w) * rr, Math.sin(w) * rr);
      g.lineTo(Math.cos(w2) * rr, Math.sin(w2) * rr);
    }
    g.closePath();
    g.stroke();
    g.beginPath();
    g.arc(0, 0, r * 0.5, 0, TAU);
    g.stroke();
    for (let i = 0; i < 5; i += 1) {
      const w = (i / 5) * TAU;
      g.beginPath();
      g.moveTo(Math.cos(w) * r * 0.16, Math.sin(w) * r * 0.16);
      g.lineTo(Math.cos(w) * r * 0.5, Math.sin(w) * r * 0.5);
      g.stroke();
    }
    g.beginPath();
    g.arc(0, 0, r * 0.16, 0, TAU);
    g.stroke();
    g.restore();
  }

  // Die Werkbank: dunkles Holz, darauf ein Tuch und ein paar Räder, die sich
  // langsam drehen.
  function zeichneWerkbank() {
    const W = view.cssW;
    const H = view.cssH;
    const holz = g.createLinearGradient(0, 0, 0, H);
    holz.addColorStop(0, "#1b2428");
    holz.addColorStop(1, "#0f1518");
    g.fillStyle = holz;
    g.fillRect(0, 0, W, H);
    const t = ruhig() ? 0 : state.zeit;
    const R = view.r;
    g.globalAlpha = 0.22;
    zahnrad(view.cx - R * 1.55, view.cy - R * 0.9, R * 0.62, 14, t * 0.25, MESSING);
    zahnrad(view.cx - R * 2.02, view.cy - R * 0.05, R * 0.34, 8, -t * 0.4375 + 0.2, MESSING);
    zahnrad(view.cx + R * 1.6, view.cy + R * 0.85, R * 0.72, 16, -t * 0.2, MESSING);
    zahnrad(view.cx + R * 1.95, view.cy - R * 0.2, R * 0.4, 9, t * 0.3555 + 0.1, MESSING);
    g.globalAlpha = 1;
    // Das Licht der Lampe über der Bank.
    const licht = g.createRadialGradient(view.cx, view.cy, R * 0.4, view.cx, view.cy, Math.max(W, H) * 0.7);
    licht.addColorStop(0, "rgba(255, 220, 160, 0.14)");
    licht.addColorStop(1, "rgba(0, 0, 0, 0.35)");
    g.fillStyle = licht;
    g.fillRect(0, 0, W, H);
  }

  // Das Gehäuse der Stoppuhr: Messing, oben die Krone – sie geht hinein,
  // solange ein Finger liegt.
  function zeichneGehaeuse() {
    const { cx, cy, r: R } = view;
    const tief = state.unten ? R * 0.045 : 0;
    g.save();
    // Der Schatten auf der Bank.
    g.fillStyle = "rgba(0, 0, 0, 0.35)";
    g.beginPath();
    g.ellipse(cx + R * 0.06, cy + R * 0.1, R * 1.04, R * 1.04, 0, 0, TAU);
    g.fill();
    // Die zwei Drücker und die Krone.
    g.fillStyle = "#a57a2a";
    for (const s of [-1, 1]) {
      g.save();
      g.translate(cx, cy);
      g.rotate(s * 0.62);
      g.fillRect(-R * 0.07, -R * 1.16, R * 0.14, R * 0.2);
      g.restore();
    }
    const krone = g.createLinearGradient(cx - R * 0.14, 0, cx + R * 0.14, 0);
    krone.addColorStop(0, "#8a6420");
    krone.addColorStop(0.5, "#f0c869");
    krone.addColorStop(1, "#8a6420");
    g.fillStyle = krone;
    g.fillRect(cx - R * 0.06, cy - R * 1.2 + tief, R * 0.12, R * 0.24);
    g.beginPath();
    if (g.roundRect) g.roundRect(cx - R * 0.15, cy - R * 1.3 + tief, R * 0.3, R * 0.15, R * 0.04);
    else g.rect(cx - R * 0.15, cy - R * 1.3 + tief, R * 0.3, R * 0.15);
    g.fill();
    // Der Ring.
    const ring = g.createLinearGradient(cx - R, cy - R, cx + R, cy + R);
    ring.addColorStop(0, "#f6d889");
    ring.addColorStop(0.45, "#c08a2c");
    ring.addColorStop(1, "#7a5518");
    g.fillStyle = ring;
    g.beginPath();
    g.arc(cx, cy, R, 0, TAU);
    g.fill();
    g.fillStyle = "#6b4a14";
    g.beginPath();
    g.arc(cx, cy, R * 0.9, 0, TAU);
    g.fill();
    // Das Blatt: dunkles Email, am Rand die Striche der Sekunden.
    const blatt = g.createRadialGradient(cx - R * 0.2, cy - R * 0.3, R * 0.1, cx, cy, R * 0.88);
    blatt.addColorStop(0, "#1c3038");
    blatt.addColorStop(1, "#0c1619");
    g.fillStyle = blatt;
    g.beginPath();
    g.arc(cx, cy, R * 0.86, 0, TAU);
    g.fill();
    g.strokeStyle = "rgba(217, 164, 65, 0.55)";
    g.lineCap = "butt";
    for (let i = 0; i < 60; i += 1) {
      const w = (i / 60) * TAU;
      const lang = i % 5 ? 0.035 : 0.075;
      g.lineWidth = i % 5 ? 1 : 2;
      g.beginPath();
      g.moveTo(cx + Math.sin(w) * R * 0.83, cy - Math.cos(w) * R * 0.83);
      g.lineTo(cx + Math.sin(w) * R * (0.83 - lang), cy - Math.cos(w) * R * (0.83 - lang));
      g.stroke();
    }
    g.restore();
  }

  // Das Fenster mit den Ziffern.
  function zeichneZiffern(text, farbe, { alpha = 1, klein = "", kleinFarbe = GOLD, oben = "" } = {}) {
    const { cx, cy, r: R } = view;
    const b = R * 1.22;
    const h = R * 0.5;
    g.save();
    g.fillStyle = "#060d0f";
    g.beginPath();
    if (g.roundRect) g.roundRect(cx - b / 2, cy - h / 2, b, h, R * 0.07);
    else g.rect(cx - b / 2, cy - h / 2, b, h);
    g.fill();
    g.strokeStyle = "rgba(217, 164, 65, 0.4)";
    g.lineWidth = 1.5;
    g.stroke();
    g.restore();
    schrift(text, cx, cy + R * 0.02, R * 0.4, farbe, { fett: 700, mono: true, alpha, breit: b * 0.9 });
    if (oben) schrift(oben, cx, cy - R * 0.44, R * 0.13, "#9fb4ba", { fett: 800 });
    if (klein) schrift(klein, cx, cy + R * 0.45, R * 0.15, kleinFarbe, { fett: 800 });
  }

  // Eine Glühbirne mitten auf dem Blatt: aus, an (die Vorgabe, bernstein)
  // oder an, weil der Finger liegt (türkis).
  function zeichneLampe(an, farbe) {
    const { cx, cy, r: R } = view;
    const y = cy - R * 0.1;
    const rr = R * 0.3;
    g.save();
    if (an) {
      const schein = g.createRadialGradient(cx, y, rr * 0.3, cx, y, R * 0.85);
      schein.addColorStop(0, farbe === TUERKIS ? "rgba(53, 214, 198, 0.75)" : "rgba(255, 190, 80, 0.8)");
      schein.addColorStop(1, "rgba(0, 0, 0, 0)");
      g.fillStyle = schein;
      g.beginPath();
      g.arc(cx, cy, R * 0.86, 0, TAU);
      g.fill();
    }
    // Der Sockel.
    g.fillStyle = "#8f9aa0";
    g.fillRect(cx - rr * 0.36, y + rr * 0.86, rr * 0.72, rr * 0.5);
    g.fillStyle = "#5f6a70";
    g.fillRect(cx - rr * 0.26, y + rr * 1.36, rr * 0.52, rr * 0.16);
    // Das Glas.
    g.fillStyle = an ? (farbe === TUERKIS ? "#c9fff8" : "#fff1c2") : "#27363b";
    g.strokeStyle = an ? farbe : "#51646b";
    g.lineWidth = Math.max(2, R * 0.02);
    g.beginPath();
    g.arc(cx, y, rr, Math.PI * 0.72, Math.PI * 0.28);
    g.lineTo(cx + rr * 0.36, y + rr * 0.9);
    g.lineTo(cx - rr * 0.36, y + rr * 0.9);
    g.closePath();
    g.fill();
    g.stroke();
    // Der Faden.
    g.strokeStyle = an ? farbe : "#51646b";
    g.lineWidth = Math.max(1.5, R * 0.015);
    g.beginPath();
    g.moveTo(cx - rr * 0.2, y + rr * 0.86);
    g.lineTo(cx - rr * 0.26, y + rr * 0.1);
    g.lineTo(cx - rr * 0.08, y + rr * 0.32);
    g.lineTo(cx + rr * 0.08, y + rr * 0.1);
    g.lineTo(cx + rr * 0.26, y + rr * 0.32);
    g.lineTo(cx + rr * 0.2, y + rr * 0.86);
    g.stroke();
    g.restore();
  }

  // Zwei Balken auf dem Blatt: die Vorgabe (gold) und was gehalten wurde.
  function zeichneBalken(ziel, wert) {
    const { cx, cy, r: R } = view;
    const voll = Math.max(ziel, wert || 0, 1) * 1.05;
    const b = R * 1.3;
    const zeile = (y, ms, farbe, wort) => {
      g.fillStyle = "rgba(255, 255, 255, 0.08)";
      g.fillRect(cx - b / 2, y, b, R * 0.11);
      g.fillStyle = farbe;
      g.fillRect(cx - b / 2, y, b * (ms / voll), R * 0.11);
      schrift(`${wort} ${sek(ms)}`, cx, y - R * 0.1, R * 0.13, farbe, { fett: 800 });
    };
    zeile(cy - R * 0.14, ziel, GOLD, "Soll");
    if (wert !== null && wert !== undefined) zeile(cy + R * 0.28, wert, "#ffffff", "Du");
  }

  // --- Die neuen Bilder auf dem Blatt ------------------------------------------
  // Der Deckel: Er legt sich über das Blatt, sobald die Vorgabe vorbei ist –
  // Messing wie der Deckel einer Taschenuhr, mit einem Fragezeichen.
  function zeichneDeckel(k) {
    if (k <= 0) return;
    const { cx, cy, r: R } = view;
    g.save();
    g.globalAlpha = k;
    const deckel = g.createRadialGradient(cx - R * 0.3, cy - R * 0.35, R * 0.05, cx, cy, R * 0.88);
    deckel.addColorStop(0, "#c99a45");
    deckel.addColorStop(0.55, "#8d6526");
    deckel.addColorStop(1, "#4f3810");
    g.fillStyle = deckel;
    g.beginPath();
    g.arc(cx, cy, R * 0.865, 0, TAU);
    g.fill();
    g.strokeStyle = "rgba(255, 232, 170, 0.28)";
    g.lineWidth = Math.max(1, R * 0.012);
    for (const rr of [0.78, 0.6]) { g.beginPath(); g.arc(cx, cy, R * rr, 0, TAU); g.stroke(); }
    g.restore();
    schrift("?", cx, cy + R * 0.03, R * 0.62, "rgba(40, 26, 6, 0.55)", { fett: 900, alpha: k });
  }

  // Ein Zeiger aus der Mitte des Blatts, im Uhrzeigersinn von oben gedreht.
  function zeigerStrich(winkel, farbe, alpha, dick, lang = 0.7) {
    const { cx, cy, r: R } = view;
    g.save();
    g.globalAlpha *= alpha;
    g.strokeStyle = farbe;
    g.lineWidth = Math.max(2, R * dick);
    g.lineCap = "round";
    g.beginPath();
    g.moveTo(cx - Math.sin(winkel) * R * 0.14, cy + Math.cos(winkel) * R * 0.14);
    g.lineTo(cx + Math.sin(winkel) * R * lang, cy - Math.cos(winkel) * R * lang);
    g.stroke();
    g.restore();
  }
  function zeigerAchse() {
    const { cx, cy, r: R } = view;
    g.fillStyle = MESSING;
    g.beginPath();
    g.arc(cx, cy, R * 0.055, 0, TAU);
    g.fill();
  }

  // Die Kerze: Sie brennt herunter, links ein Massstab mit der Marke.
  function zeichneKerze(a, t, w) {
    const { cx, cy, r: R } = view;
    const fuss = cy + R * 0.56;
    const hoch = R * 1.08;
    const x = cx + R * 0.1;
    const b = R * 0.2;
    const hoehe = kerzeBei(a, w ? (w.wert ?? a.ziel) : t);
    const kopf = fuss - hoch * hoehe;
    const marke = fuss - hoch * a.marke;
    g.save();
    // Der Massstab und die Marke, quer bis über die Kerze.
    const sx = cx - R * 0.3;
    g.strokeStyle = "rgba(217, 164, 65, 0.45)";
    g.lineWidth = 1.5;
    g.beginPath(); g.moveTo(sx, fuss); g.lineTo(sx, fuss - hoch); g.stroke();
    for (let i = 0; i <= 10; i += 1) {
      const y = fuss - (hoch * i) / 10;
      g.beginPath(); g.moveTo(sx, y); g.lineTo(sx + R * (i % 5 ? 0.04 : 0.08), y); g.stroke();
    }
    g.strokeStyle = GOLD;
    g.lineWidth = Math.max(2, R * 0.018);
    g.setLineDash([R * 0.05, R * 0.035]);
    g.beginPath(); g.moveTo(sx, marke); g.lineTo(x + b * 0.75, marke); g.stroke();
    g.setLineDash([]);
    g.fillStyle = GOLD;
    g.beginPath(); g.moveTo(sx - R * 0.02, marke); g.lineTo(sx - R * 0.1, marke - R * 0.05); g.lineTo(sx - R * 0.1, marke + R * 0.05); g.closePath(); g.fill();
    // Der Teller.
    g.fillStyle = "#a57a2a";
    g.beginPath(); g.ellipse(x, fuss + R * 0.03, b * 1.25, R * 0.05, 0, 0, TAU); g.fill();
    // Das Wachs, mit einem Rand, wo es schmilzt.
    const wachs = g.createLinearGradient(x - b / 2, 0, x + b / 2, 0);
    wachs.addColorStop(0, "#d9cdb2");
    wachs.addColorStop(0.45, "#fff6e2");
    wachs.addColorStop(1, "#c7b894");
    g.fillStyle = wachs;
    g.fillRect(x - b / 2, kopf, b, fuss - kopf);
    g.fillStyle = "#fffaf0";
    g.beginPath(); g.ellipse(x, kopf, b / 2, R * 0.025, 0, 0, TAU); g.fill();
    // Der Docht und die Flamme – sie flackert.
    g.strokeStyle = "#2b2118";
    g.lineWidth = Math.max(1.5, R * 0.014);
    g.beginPath(); g.moveTo(x, kopf); g.lineTo(x, kopf - R * 0.05); g.stroke();
    const flacker = ruhig() ? 1 : 1 + 0.07 * Math.sin(state.zeit * 17) + 0.04 * Math.sin(state.zeit * 31);
    const fh = R * 0.2 * flacker;
    const schein = g.createRadialGradient(x, kopf - fh * 0.5, 1, x, kopf - fh * 0.5, R * 0.36);
    schein.addColorStop(0, "rgba(255, 200, 90, 0.45)");
    schein.addColorStop(1, "rgba(255, 200, 90, 0)");
    g.fillStyle = schein;
    g.beginPath(); g.arc(x, kopf - fh * 0.5, R * 0.36, 0, TAU); g.fill();
    const flamme = g.createLinearGradient(0, kopf, 0, kopf - fh);
    flamme.addColorStop(0, "#ff8a2a");
    flamme.addColorStop(0.45, "#ffd23f");
    flamme.addColorStop(1, "#fff6c8");
    g.fillStyle = flamme;
    g.beginPath();
    g.moveTo(x, kopf - fh);
    g.quadraticCurveTo(x + R * 0.065, kopf - fh * 0.35, x, kopf - R * 0.02);
    g.quadraticCurveTo(x - R * 0.065, kopf - fh * 0.35, x, kopf - fh);
    g.fill();
    g.restore();
  }

  // Zwei Zeiger: der rote und der türkise. In der Auflösung steht golden,
  // wo sie sich trafen.
  function zeichneZweiZeiger(a, t, w, blass, farbeW) {
    if (w) {
      zeigerStrich(zweiWinkel(a, 0, a.ziel), GOLD, 0.55, 0.025);
      if (w.wert !== null) {
        zeigerStrich(zweiWinkel(a, 0, w.wert), ROT, 1, 0.032);
        zeigerStrich(zweiWinkel(a, 1, w.wert), TUERKIS, 1, 0.032, 0.58);
      }
    } else if (t < a.sicht + AUSBLENDEN) {
      zeigerStrich(zweiWinkel(a, 0, t), ROT, blass, 0.035);
      zeigerStrich(zweiWinkel(a, 1, t), TUERKIS, blass, 0.035, 0.58);
    }
    zeigerAchse();
  }

  // Der bremsende Zeiger. In der Auflösung steht golden, wo er stehen blieb.
  function zeichneBremse(a, t, w, blass, farbeW) {
    if (w) {
      zeigerStrich(bremsWinkel(a, a.ziel), GOLD, 0.55, 0.025);
      if (w.wert !== null) zeigerStrich(bremsWinkel(a, w.wert), farbeW, 1, 0.035);
    } else if (t < a.sicht + AUSBLENDEN) {
      zeigerStrich(bremsWinkel(a, t), ROT, blass, 0.035);
    }
    zeigerAchse();
  }

  // Das Pendel: an einer Achse oben, links aussen eine goldene Marke, an der
  // mitgezählt wird, solange man es sieht.
  function zeichnePendel(a, t, w, farbeW) {
    const { cx, cy, r: R } = view;
    const px = cx;
    const py = cy - R * 0.62;
    const lang = R * 1.02;
    const ort = (w) => [px + Math.sin(w) * lang, py + Math.cos(w) * lang];
    g.save();
    // Der Bogen, auf dem es schwingt, und die Marke links.
    g.strokeStyle = "rgba(191, 247, 230, 0.18)";
    g.lineWidth = Math.max(1.5, R * 0.012);
    g.setLineDash([R * 0.03, R * 0.04]);
    g.beginPath(); g.arc(px, py, lang, Math.PI / 2 - PENDEL_AUS, Math.PI / 2 + PENDEL_AUS); g.stroke();
    g.setLineDash([]);
    const [lx, ly] = ort(-PENDEL_AUS);
    g.strokeStyle = GOLD;
    g.lineWidth = Math.max(2, R * 0.02);
    g.beginPath(); g.moveTo(lx - R * 0.13, ly + R * 0.07); g.lineTo(lx - R * 0.05, ly + R * 0.02); g.stroke();
    if (!w) {
      const links = t >= a.schwingung / 2 ? Math.floor(t / a.schwingung + 0.5) : 0;
      if (links > 0 && t < a.sicht) schrift(`${links}.`, lx - R * 0.16, ly - R * 0.08, R * 0.13, GOLD, { fett: 900 });
    }
    const pendel = (winkel, farbe, alpha) => {
      const [bx, by] = ort(winkel);
      g.globalAlpha = alpha;
      g.strokeStyle = "#c8a25a";
      g.lineWidth = Math.max(2, R * 0.016);
      g.beginPath(); g.moveTo(px, py); g.lineTo(bx, by); g.stroke();
      const kugel = g.createRadialGradient(bx - R * 0.03, by - R * 0.03, R * 0.01, bx, by, R * 0.1);
      kugel.addColorStop(0, "#fff1c2");
      kugel.addColorStop(1, farbe);
      g.fillStyle = kugel;
      g.beginPath(); g.arc(bx, by, R * 0.1, 0, TAU); g.fill();
      g.globalAlpha = 1;
    };
    if (w) {
      pendel(-PENDEL_AUS, GOLD, 0.45);
      if (w.wert !== null) pendel(pendelWinkel(a, w.wert), farbeW === "#ffffff" ? "#cfdde0" : farbeW, 1);
    } else pendel(pendelWinkel(a, t), MESSING, 1);
    g.fillStyle = MESSING;
    g.beginPath(); g.arc(px, py, R * 0.045, 0, TAU); g.fill();
    g.restore();
  }

  // Der Ball zwischen zwei Wänden: Die rechte leuchtet auf, wenn er
  // anschlägt, und zählt mit, solange man ihn sieht.
  function zeichneBall(a, t, w, farbeW) {
    const { cx, cy, r: R } = view;
    const links = cx - R * 0.64;
    const rechts = cx + R * 0.64;
    const rb = R * 0.085;
    const x = (ort) => links + R * 0.03 + rb + ort * (rechts - links - R * 0.06 - 2 * rb);
    const b = ballBei(a, w ? (w.wert ?? a.ziel) : t);
    g.save();
    // Der Boden und die Wände; die rechte leuchtet kurz nach dem Anschlag.
    g.fillStyle = "rgba(191, 247, 230, 0.12)";
    g.fillRect(links, cy + rb, rechts - links, R * 0.03);
    const hell = !w && b.strecke % 2 === 1 ? clamp(1 - b.seit / 250, 0, 1) : 0;
    for (const [wx, glanz] of [[links, 0], [rechts, hell]]) {
      g.fillStyle = glanz > 0 ? `rgba(255, 210, 63, ${0.5 + 0.5 * glanz})` : "#a57a2a";
      g.fillRect(wx - (wx === links ? R * 0.03 : 0), cy - R * 0.26, R * 0.03, R * 0.26 + rb + R * 0.03);
    }
    if (!w && b.rechts > 0 && t < a.sicht) schrift(`${b.rechts}.`, rechts - R * 0.02, cy - R * 0.36, R * 0.13, GOLD, { fett: 900 });
    const ball = (ort, farbe, alpha) => {
      const bx = x(ort);
      g.globalAlpha = alpha;
      const kugel = g.createRadialGradient(bx - rb * 0.35, cy - rb * 0.35, rb * 0.1, bx, cy, rb);
      kugel.addColorStop(0, "#ffffff");
      kugel.addColorStop(1, farbe);
      g.fillStyle = kugel;
      g.beginPath(); g.arc(bx, cy, rb, 0, TAU); g.fill();
      g.globalAlpha = 1;
    };
    if (w) {
      ball(1, GOLD, 0.45);
      if (w.wert !== null) ball(b.ort, farbeW === "#ffffff" ? "#cfdde0" : farbeW, 1);
    } else ball(b.ort, ROT, 1);
    g.restore();
  }

  // Die Sanduhr: zwei Kegel aus Glas, oben rinnt der Sand aus, unten
  // häuft er sich.
  function zeichneSanduhr(a, t, w) {
    const { cx, cy, r: R } = view;
    const H = R * 0.56;
    const W = R * 0.4;
    const sand = sandBei(a, w ? (w.wert ?? a.ziel) : t);
    const oben = (y) => W * (HALS + (1 - HALS) * y);
    const unten = (y) => W * (1 - (1 - HALS) * y);
    g.save();
    // Das Gestell: zwei Platten, zwei Stäbe.
    g.fillStyle = "#8a6420";
    g.fillRect(cx - W * 1.3, cy - H - R * 0.08, W * 2.6, R * 0.08);
    g.fillRect(cx - W * 1.3, cy + H, W * 2.6, R * 0.08);
    g.fillStyle = "#a57a2a";
    g.fillRect(cx - W * 1.2, cy - H, R * 0.035, 2 * H);
    g.fillRect(cx + W * 1.2 - R * 0.035, cy - H, R * 0.035, 2 * H);
    // Der Sand oben – vom Hals bis zum Pegel.
    const farbe = g.createLinearGradient(0, cy - H, 0, cy + H);
    farbe.addColorStop(0, "#f1d295");
    farbe.addColorStop(1, "#c99a4a");
    g.fillStyle = farbe;
    if (sand.oben > 0.001) {
      g.beginPath();
      g.moveTo(cx - oben(0), cy);
      g.lineTo(cx - oben(sand.oben), cy - H * sand.oben);
      g.lineTo(cx + oben(sand.oben), cy - H * sand.oben);
      g.lineTo(cx + oben(0), cy);
      g.closePath();
      g.fill();
      // Der Strahl hinunter.
      g.fillRect(cx - R * 0.008, cy, R * 0.016, H * (1 - sand.unten));
    }
    // Der Sand unten – vom Boden bis zu seiner Höhe, mit einem kleinen Hügel.
    if (sand.unten > 0.001) {
      const yh = cy + H - H * sand.unten;
      g.beginPath();
      g.moveTo(cx - W, cy + H);
      g.lineTo(cx - unten(sand.unten), yh);
      g.lineTo(cx - R * 0.02, yh - Math.min(R * 0.07, H * sand.unten * 0.5));
      g.lineTo(cx + R * 0.02, yh - Math.min(R * 0.07, H * sand.unten * 0.5));
      g.lineTo(cx + unten(sand.unten), yh);
      g.lineTo(cx + W, cy + H);
      g.closePath();
      g.fill();
    }
    // Das Glas.
    g.strokeStyle = "rgba(200, 235, 245, 0.7)";
    g.lineWidth = Math.max(1.5, R * 0.014);
    g.fillStyle = "rgba(190, 230, 255, 0.07)";
    g.beginPath();
    g.moveTo(cx - W, cy - H);
    g.lineTo(cx - oben(0), cy);
    g.lineTo(cx - W, cy + H);
    g.lineTo(cx + W, cy + H);
    g.lineTo(cx + oben(0), cy);
    g.lineTo(cx + W, cy - H);
    g.closePath();
    g.fill();
    g.stroke();
    g.restore();
  }

  // Das Glas: Oben läuft Wasser aus einem Hahn, gleichmässig. Der Rand ist
  // golden – dort ist es voll.
  function zeichneGlas(a, t, w) {
    const { cx, cy, r: R } = view;
    const glas = GLAESER[a.form];
    const boden = cy + R * 0.55;
    const H = R * 0.92;
    const W = R * 0.4;
    const yAuf = (y) => boden - H * y;
    const zeit = w ? (w.wert ?? a.ziel) : t;
    const pegel = glasBei(a, zeit);
    const laeuft = zeit >= 0 && zeit < a.ziel;
    g.save();
    // Der Hahn und, solange es läuft, der Strahl.
    const hahnY = cy - R * 0.66;
    g.fillStyle = "#a57a2a";
    g.fillRect(cx, hahnY - R * 0.035, R * 0.5, R * 0.07);
    g.fillRect(cx - R * 0.035, hahnY - R * 0.035, R * 0.07, R * 0.11);
    if (laeuft) {
      g.fillStyle = "rgba(120, 200, 255, 0.85)";
      g.fillRect(cx - R * 0.012, hahnY + R * 0.07, R * 0.024, yAuf(pegel) - hahnY - R * 0.07);
    }
    // Das Wasser: vom Boden bis zum Pegel, so breit wie das Glas dort.
    const N = 40;
    if (pegel > 0.001) {
      const wasser = g.createLinearGradient(0, boden, 0, yAuf(1));
      wasser.addColorStop(0, "rgba(40, 130, 220, 0.85)");
      wasser.addColorStop(1, "rgba(110, 200, 255, 0.75)");
      g.fillStyle = wasser;
      g.beginPath();
      for (let i = 0; i <= N; i += 1) { const y = (pegel * i) / N; g.lineTo(cx - W * glas.weite(y), yAuf(y)); }
      for (let i = N; i >= 0; i -= 1) { const y = (pegel * i) / N; g.lineTo(cx + W * glas.weite(y), yAuf(y)); }
      g.closePath();
      g.fill();
      g.strokeStyle = "rgba(220, 245, 255, 0.8)";
      g.lineWidth = 1.5;
      g.beginPath(); g.moveTo(cx - W * glas.weite(pegel), yAuf(pegel)); g.lineTo(cx + W * glas.weite(pegel), yAuf(pegel)); g.stroke();
    }
    // Das Glas selbst, und der goldene Rand.
    g.strokeStyle = "rgba(200, 235, 245, 0.75)";
    g.lineWidth = Math.max(1.5, R * 0.016);
    g.lineJoin = "round";
    g.beginPath();
    for (let i = N; i >= 0; i -= 1) g.lineTo(cx - W * glas.weite(i / N), yAuf(i / N));
    for (let i = 0; i <= N; i += 1) g.lineTo(cx + W * glas.weite(i / N), yAuf(i / N));
    g.stroke();
    g.strokeStyle = GOLD;
    g.lineWidth = Math.max(2, R * 0.022);
    for (const s of [-1, 1]) { g.beginPath(); g.moveTo(cx + s * W * glas.weite(1) - s * R * 0.05, yAuf(1)); g.lineTo(cx + s * W * glas.weite(1) + s * R * 0.06, yAuf(1)); g.stroke(); }
    g.restore();
  }

  // Eine kleine Lampe für die Blinker: hell zwischen 0 und 1.
  function blinkLampe(x, y, rr, hell, farbe, licht) {
    g.save();
    if (hell > 0) {
      const schein = g.createRadialGradient(x, y, rr * 0.3, x, y, rr * 2.6);
      schein.addColorStop(0, licht.replace("A", String(0.75 * hell)));
      schein.addColorStop(1, "rgba(0, 0, 0, 0)");
      g.fillStyle = schein;
      g.beginPath(); g.arc(x, y, rr * 2.6, 0, TAU); g.fill();
    }
    g.fillStyle = "#5f6a70";
    g.fillRect(x - rr * 0.4, y + rr * 0.8, rr * 0.8, rr * 0.45);
    g.fillStyle = hell > 0 ? farbe : "#27363b";
    g.globalAlpha = hell > 0 ? 0.35 + 0.65 * hell : 1;
    g.beginPath(); g.arc(x, y, rr, 0, TAU); g.fill();
    g.globalAlpha = 1;
    g.strokeStyle = "#51646b";
    g.lineWidth = Math.max(1.5, rr * 0.08);
    g.stroke();
    g.restore();
  }

  // Zwei Blinker. In der Auflösung: wann jede blinkte, als zwei Reihen von
  // Punkten – golden der Augenblick, an dem beide zugleich blinken.
  function zeichneBlinker(a, t, w, farbeW) {
    const { cx, cy, r: R } = view;
    if (!w) {
      blinkLampe(cx - R * 0.3, cy - R * 0.08, R * 0.16, blinkHell(a, 0, t), "#ffd27a", "rgba(255, 190, 80, A)");
      blinkLampe(cx + R * 0.3, cy - R * 0.08, R * 0.16, blinkHell(a, 1, t), "#bff7f0", "rgba(53, 214, 198, A)");
      return;
    }
    const bis = a.ziel * 1.25;
    const x = (ms) => cx - R * 0.66 + (R * 1.32 * ms) / bis;
    g.save();
    a.takte.forEach((takt, i) => {
      const y = cy + (i ? 0.16 : -0.16) * R;
      g.fillStyle = i ? TUERKIS : "#ffbe50";
      for (let ms = 0; ms <= bis; ms += takt) { g.beginPath(); g.arc(x(ms), y, R * 0.04, 0, TAU); g.fill(); }
    });
    g.strokeStyle = GOLD;
    g.lineWidth = 3;
    g.beginPath(); g.moveTo(x(a.ziel), cy - R * 0.3); g.lineTo(x(a.ziel), cy + R * 0.3); g.stroke();
    if (w.wert !== null) {
      const xi = clamp(x(w.wert), cx - R * 0.72, cx + R * 0.72);
      g.strokeStyle = farbeW;
      g.lineWidth = 2;
      g.setLineDash([4, 3]);
      g.beginPath(); g.moveTo(xi, cy - R * 0.36); g.lineTo(xi, cy + R * 0.36); g.stroke();
      g.setLineDash([]);
    }
    g.restore();
  }

  /*
   * Was auf dem Blatt der Uhr steht – je nach Aufgabe. t ist die Zeit der
   * Aufgabe in ms; w die Wertung, sobald die Auflösung dasteht (dann zeigt
   * die Uhr, was sie beim Tipp wirklich zeigte).
   */
  function zeichneInhalt(a, t, w, haltAb) {
    const { cx, cy, r: R } = view;
    const blass = (bis) => clamp(1 - (t - bis) / AUSBLENDEN, 0, 1);
    const wert = w ? w.wert : null;
    const farbeW = !w ? "#ffffff" : w.punkte >= 90 ? GOLD : w.punkte >= 50 ? "#ffffff" : ROT;
    switch (a.art) {
      case "stoppuhr":
      case "lang":
      case "zeitlupe":
      case "stoer": {
        const ziel = `Ziel ${sek(a.ziel * a.faktor)}`;
        const oben = a.art === "zeitlupe" ? `${a.faktor < 1 ? "Zeitlupe" : "Zeitraffer"} ×${String(a.faktor).replace(".", ",")}` : "";
        if (w) {
          zeichneZiffern(wert === null ? "–,––" : sek(wert * a.faktor), farbeW, { klein: ziel, oben });
          return;
        }
        if (a.art === "stoer" && t >= a.sicht) {
          // Die roten Zahlen: Sie laufen dort weiter, wo die Uhr verschwand,
          // aber im falschen Tempo – und sie flackern.
          const falsch = a.sicht + (t - a.sicht) * a.luege;
          const flackern = ruhig() ? 1 : 0.75 + 0.25 * Math.sin(state.zeit * 31);
          zeichneZiffern(sek(falsch), ROT, { alpha: flackern, klein: ziel, oben: "Störung" });
          return;
        }
        if (t < a.sicht + AUSBLENDEN) {
          const k = blass(a.sicht);
          zeichneZiffern(sek(Math.max(0, t) * a.faktor), "#bff7e6", { alpha: k, klein: ziel, oben });
          if (k < 1) schrift("–,––", cx, cy + R * 0.02, R * 0.4, "#3d5a60", { fett: 700, mono: true, alpha: 1 - k });
          return;
        }
        zeichneZiffern("–,––", "#3d5a60", { klein: ziel, oben });
        return;
      }
      case "countdown": {
        const rest = a.ziel - t;
        if (w) {
          const ms = w.ms;
          zeichneZiffern(wert === null ? "–" : `${ms >= 0 ? "+" : "−"}${sek(Math.abs(ms))}`, farbeW, { klein: "Soll: 0,00" });
          return;
        }
        const zahl = Math.ceil(rest / 1000);
        const k = blass(a.sicht);
        if (t < 0) { schrift(String(a.von), cx, cy, R * 0.8, "#bff7e6", { fett: 800, mono: true, alpha: 0.35 }); return; }
        if (k > 0) {
          // Jede Sekunde springt die Zahl ein Stück auf und setzt sich.
          const puls = 1 + 0.12 * clamp(1 - ((t % 1000) / 220), 0, 1);
          schrift(String(zahl), cx, cy, R * 0.8 * puls, "#bff7e6", { fett: 800, mono: true, alpha: k });
        }
        if (k < 1) schrift("?", cx, cy, R * 0.7, "#3d5a60", { fett: 800, alpha: 1 - k });
        return;
      }
      case "zeiger": {
        // Oben die Marke; der Zeiger läuft im Uhrzeigersinn.
        g.save();
        g.fillStyle = GOLD;
        g.beginPath();
        g.moveTo(cx, cy - R * 0.72);
        g.lineTo(cx - R * 0.06, cy - R * 0.84);
        g.lineTo(cx + R * 0.06, cy - R * 0.84);
        g.closePath();
        g.fill();
        const zeiger = (ms, farbe, alpha, dick) => {
          const wnk = (ms / a.umlauf) * TAU;
          g.globalAlpha = alpha;
          g.strokeStyle = farbe;
          g.lineWidth = Math.max(2, R * dick);
          g.lineCap = "round";
          g.beginPath();
          g.moveTo(cx - Math.sin(wnk) * R * 0.14, cy + Math.cos(wnk) * R * 0.14);
          g.lineTo(cx + Math.sin(wnk) * R * 0.7, cy - Math.cos(wnk) * R * 0.7);
          g.stroke();
          g.globalAlpha = 1;
        };
        if (w) {
          zeiger(a.ziel, GOLD, 0.55, 0.025);
          if (wert !== null) zeiger(wert, farbeW, 1, 0.035);
        } else if (t < a.sicht + AUSBLENDEN) {
          zeiger(Math.max(0, t), ROT, blass(a.sicht), 0.035);
        }
        g.fillStyle = MESSING;
        g.beginPath();
        g.arc(cx, cy, R * 0.055, 0, TAU);
        g.fill();
        g.restore();
        return;
      }
      case "kerze":
      case "pendel":
      case "ball":
      case "sanduhr":
      case "glas":
      case "blinker": {
        // Erst sieht man es, dann legt sich der Deckel darüber.
        if (a.art === "kerze") zeichneKerze(a, t, w);
        else if (a.art === "pendel") zeichnePendel(a, t, w, farbeW);
        else if (a.art === "ball") zeichneBall(a, t, w, farbeW);
        else if (a.art === "sanduhr") zeichneSanduhr(a, t, w);
        else if (a.art === "glas") zeichneGlas(a, t, w);
        else zeichneBlinker(a, t, w, farbeW);
        if (!w && t >= a.sicht) zeichneDeckel(clamp((t - a.sicht) / AUSBLENDEN, 0, 1));
        return;
      }
      case "zweizeiger":
        zeichneZweiZeiger(a, t, w, blass(a.sicht), farbeW);
        return;
      case "bremse":
        zeichneBremse(a, t, w, blass(a.sicht), farbeW);
        return;
      case "takt": {
        // Acht Punkte in einer Reihe: Vier leuchten im Takt, der achte ist
        // das Ziel.
        const x = (i) => cx + (i - 3.5) * R * 0.19;
        const stelle = (t - a.start) / a.schlag;
        g.save();
        for (let i = 0; i < 8; i += 1) {
          const seitSchlag = t - (a.start + i * a.schlag);
          const an = i < 4 && seitSchlag >= 0 ? clamp(1 - seitSchlag / 260, 0, 1) : 0;
          g.beginPath();
          g.arc(x(i), cy, R * (0.06 + 0.03 * an), 0, TAU);
          g.fillStyle = i < 4 ? `rgba(191, 247, 230, ${0.25 + 0.75 * an})` : "rgba(255, 255, 255, 0.08)";
          g.fill();
          g.lineWidth = i === 7 ? 3 : 1.5;
          g.strokeStyle = i === 7 ? GOLD : "rgba(191, 247, 230, 0.4)";
          g.stroke();
        }
        if (w && wert !== null) {
          // Wo der Tipp in der Reihe lag.
          const xi = clamp(x((wert - a.start) / a.schlag), cx - R * 0.8, cx + R * 0.8);
          g.strokeStyle = farbeW;
          g.lineWidth = 3;
          g.beginPath();
          g.moveTo(xi, cy - R * 0.2);
          g.lineTo(xi, cy + R * 0.2);
          g.stroke();
        } else if (!w && stelle >= 0 && stelle < 3.6 && !ruhig()) {
          // Ein Lichtpunkt läuft von Schlag zu Schlag – und geht mit dem
          // vierten aus.
          g.fillStyle = "rgba(191, 247, 230, 0.5)";
          g.beginPath();
          g.arc(x(stelle), cy - R * 0.2, R * 0.025, 0, TAU);
          g.fill();
        }
        g.restore();
        schrift("8", x(7), cy + R * 0.2, R * 0.13, GOLD, { fett: 800 });
        return;
      }
      default: {
        // Die Lampe: erst die Vorgabe, dann – solange der Finger liegt – die
        // eigene.
        if (w) { zeichneBalken(a.ziel, wert); return; }
        const vorgabe = a.an !== undefined && t >= a.an && t < a.an + a.dauer;
        const haelt = haltAb !== null && haltAb !== undefined;
        zeichneLampe(vorgabe || haelt, haelt ? TUERKIS : MESSING);
        let unten = "";
        if (haelt) unten = "Halten …";
        else if (a.art === "blind") unten = t >= a.ab ? `${sekKurz(a.ziel)} s – jetzt halten` : "";
        else if (t < a.an + a.dauer) unten = "Schau zu";
        else unten = a.mal ? `Jetzt du: ${a.mal === 2 ? "doppelt" : "halb"} so lange` : "Jetzt du: halten";
        if (unten) schrift(unten, cx, cy + R * 0.58, R * 0.13, haelt ? TUERKIS : "#cfdde0", { fett: 800 });
        return;
      }
    }
  }

  // Ein Satz, auf höchstens zwei Zeilen verteilt.
  function zeilenFuer(text, breit, gross) {
    g.font = `800 ${Math.round(gross)}px system-ui, sans-serif`;
    if (g.measureText(text).width <= breit) return [text];
    const worte = text.split(" ");
    let beste = [text];
    let unterschied = Infinity;
    for (let i = 1; i < worte.length; i += 1) {
      // Keine Zeile beginnt mit einem Gedankenstrich.
      if (worte[i] === "–") continue;
      const a = worte.slice(0, i).join(" ");
      const b = worte.slice(i).join(" ");
      const d = Math.abs(g.measureText(a).width - g.measureText(b).width);
      if (d < unterschied) { unterschied = d; beste = [a, b]; }
    }
    return beste;
  }

  // Über der Uhr: die wievielte Aufgabe, wie sie heisst und was zu tun ist.
  function zeichneKarte(a, k) {
    const { cx, cy, r: R } = view;
    const oben = view.frei + 10;
    const unten = cy - R * 1.38;
    const hoch = Math.max(40, unten - oben);
    const gross = clamp(Math.min(view.cssW * 0.055, hoch * 0.26), 14, 30);
    // Neben der Stempelkarte reicht der Satz nicht über sie hinaus.
    const karte = view.karte?.art === "seite" ? view.karte : null;
    const breit = karte ? Math.min(view.cssW - 36, 2 * (cx - karte.x - karte.w - 16)) : view.cssW - 36;
    const zeilen = zeilenFuer(a.frage, breit, gross);
    const mitte = oben + hoch * 0.5 + (1 - k) * -14;
    const farbe = ["#9ff5bd", GOLD, ROT][a.stufe];
    schrift(`${TESTRUNDE ? "TEST" : "AUFGABE"} ${state.index + 1} VON ${anzahl()} · ${a.name.toUpperCase()}`, cx, mitte - gross * (zeilen.length > 1 ? 1.45 : 0.95), gross * 0.5, farbe, { fett: 900, alpha: k });
    zeilen.forEach((zeile, i) => {
      schrift(zeile, cx, mitte + gross * (zeilen.length > 1 ? i * 1.15 - 0.25 : 0.25), gross, "#ffffff", { fett: 800, alpha: k, breit: breit + 12 });
    });
  }

  // Die Aufgabe wartet: ein Ring um die Uhr, der ruft, und darunter, was zu
  // tun ist. In den letzten Sekunden zählt der Ruf herunter. (Wer zuschaut,
  // sieht nur den Ring – tippen kann er nicht.)
  function zeichneRuf(nun, k) {
    const { cx, cy, r: R } = view;
    if (!ruhig()) {
      const p = (state.zeit * 0.7) % 1;
      g.strokeStyle = `rgba(53, 214, 198, ${0.6 * (1 - p) * k})`;
      g.lineWidth = 3;
      g.beginPath();
      g.arc(cx, cy, R * (1.02 + 0.22 * p), 0, TAU);
      g.stroke();
    }
    if (state.phase !== "warten") return;
    const rest = WARTE - (nun - state.wartSeit) / 1000;
    const zaehlt = rest <= WARTE_ZAEHLT;
    const ruf = zaehlt ? `Los geht's in ${Math.max(1, Math.ceil(rest))} …` : "Tippe, wenn du bereit bist";
    const gross = clamp(R * 0.15, 14, 20);
    g.save();
    g.font = `800 ${gross}px system-ui, sans-serif`;
    const breit = g.measureText(ruf).width + gross * 2.2;
    const hoch = Math.round(gross * 2.1);
    // Knapp unter dem Gehäuse – auch dort, wo die Uhr klein ist.
    const y = cy + R * 1.14 + hoch / 2 + 4;
    const puls = ruhig() ? 0 : 0.5 + 0.5 * Math.sin(state.zeit * 3.4);
    g.globalAlpha = k;
    g.beginPath();
    if (g.roundRect) g.roundRect(cx - breit / 2, y - hoch / 2, breit, hoch, hoch / 2); else g.rect(cx - breit / 2, y - hoch / 2, breit, hoch);
    g.fillStyle = zaehlt ? "rgba(255, 184, 77, 0.95)" : `rgba(53, 214, 198, ${0.82 + 0.16 * puls})`;
    g.fill();
    g.fillStyle = "#06201f";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText(ruf, cx, y + 1);
    g.restore();
  }

  // Unter der Uhr: wie weit daneben und wie viele Punkte.
  function zeichneAufloesung(a, w, k) {
    const { cx, cy, r: R } = view;
    const y = cy + R * 1.22;
    const gross = clamp(R * 0.2, 15, 30);
    let text;
    let farbe = "#ffffff";
    if (w.ms === null) { text = "Keine Antwort"; farbe = ROT; } else if (Math.abs(w.ms) < HUNDERTSTEL) { text = "Auf die Hundertstel!"; farbe = GOLD; } else {
      const wort = a.eingabe === "halten" ? (w.ms > 0 ? "zu lang" : "zu kurz") : (w.ms > 0 ? "zu spät" : "zu früh");
      text = `${sek(Math.abs(w.ms))} s ${wort}`;
      if (Math.abs(w.ms) <= GENAU) farbe = GOLD;
    }
    schrift(text, cx, y + (1 - k) * 10, gross, farbe, { fett: 800, alpha: k, rand: 4 });
    const farbeP = w.punkte >= 90 ? GOLD : w.punkte >= 50 ? "#ffffff" : ROT;
    schrift(`+${w.punkte}`, cx, y + gross * 1.35 + (1 - k) * 10, gross * 1.25, farbeP, { fett: 900, alpha: k, rand: 4 });
  }

  // Ganz unten: zehn Felder, eines je Aufgabe, mit den Punkten.
  function zeichneFelder() {
    if (view.karte?.art === "unten") return;
    const W = view.cssW;
    const b = clamp((W - 24) / anzahl() - 4, 18, 44);
    const h = clamp(b * 0.7, 18, 28);
    const x0 = view.cx - ((b + 4) * anzahl() - 4) / 2;
    const y = view.cssH - h - 12;
    g.save();
    for (let i = 0; i < anzahl(); i += 1) {
      const e = state.liste[i];
      const x = x0 + i * (b + 4);
      const dran = i === state.index && state.phase !== "bereit" && state.phase !== "ende";
      g.fillStyle = e?.uebersprungen ? "rgba(255, 255, 255, 0.16)" : e ? (e.punkte >= 90 ? "rgba(255, 210, 63, 0.9)" : e.punkte >= 50 ? "rgba(255, 255, 255, 0.85)" : "rgba(255, 107, 94, 0.85)") : "rgba(255, 255, 255, 0.07)";
      g.beginPath();
      if (g.roundRect) g.roundRect(x, y, b, h, 6);
      else g.rect(x, y, b, h);
      g.fill();
      if (dran) {
        g.lineWidth = 2;
        g.strokeStyle = TUERKIS;
        g.stroke();
      }
      if (e) schrift(e.uebersprungen ? "–" : String(e.punkte), x + b / 2, y + h / 2 + 1, Math.min(h * 0.58, b * 0.48), e.uebersprungen ? "#e8f3f1" : "#101a1d", { fett: 900 });
      else {
        // Wie schwer sie wird: ein Punkt in der Farbe der Stufe.
        const a = state.aufgaben?.[i];
        g.fillStyle = a ? ["rgba(159, 245, 189, 0.5)", "rgba(255, 210, 63, 0.5)", "rgba(255, 107, 94, 0.55)"][a.stufe] : "rgba(255,255,255,0.2)";
        g.beginPath();
        g.arc(x + b / 2, y + h / 2, 3, 0, TAU);
        g.fill();
      }
    }
    g.restore();
  }

  /*
   * Die Stempelkarte: eine Stechkarte, wie sie neben der Stempeluhr einer
   * Fabrik steckt – cremefarbenes Papier, rot der Kopf, je Aufgabe eine
   * Zeile. Jede Antwort wird darauf gestempelt: die Abweichung in Tinte,
   * die Punkte in einem violetten Stempel, der beim Antworten mit einem
   * kleinen Ruck aufs Papier kommt (STEMPEL_MS). Die Aufgabe, die gerade
   * dran ist, steht im Schlitz – türkis hinterlegt; was noch kommt, ist
   * verdeckt wie bei Augenmass (· · ·). Unten die Summe.
   *
   * Neben der Uhr (art "seite") mit allem, unter der Uhr (art "unten") auch –
   * oder, wo es eng ist (Handy hoch, klein), in zwei Spalten, ohne die
   * Abweichung: Die steht dort ohnehin gross unter der Uhr.
   */
  const PAPIER = "#f2e9d0";
  const TINTE = "#3b3226";
  const STEMPEL = "#5a3fa0";
  const KOPF_ROT = "#b8452f";

  // Text auf der Karte, links, rechts oder mittig gesetzt.
  function kartenText(text, x, y, gross, farbe, { ausrichtung = "left", fett = 700, mono = false, alpha = 1, breit = 0 } = {}) {
    g.save();
    g.globalAlpha *= alpha;
    g.font = `${fett} ${Math.round(gross)}px ${mono ? "ui-monospace, 'SF Mono', Menlo, Consolas, monospace" : "system-ui, sans-serif"}`;
    g.textAlign = ausrichtung;
    g.textBaseline = "middle";
    g.fillStyle = farbe;
    g.fillText(text, x, y, breit || undefined);
    g.restore();
  }

  // Wie weit daneben, so kurz wie möglich: +0,07 oder −1,20 – ohne Antwort ein Strich.
  const abweichung = (e) => (e.ms === null ? "–" : `${e.ms >= 0 ? "+" : "−"}${sek(Math.abs(e.ms))}`);

  // Ein Stempel mit den Punkten: Rahmen und Zahl in violetter Tinte, ein wenig
  // schief – jede Zeile ein bisschen anders, aber immer gleich (nach i).
  function stempel(punkte, x, y, gross, i, nun) {
    const neu = i === state.index && state.wertung && nun - state.tZeig < STEMPEL_MS && !ruhig();
    const k = neu ? clamp((nun - state.tZeig) / STEMPEL_MS, 0, 1) : 1;
    const text = punkte === null ? "0" : String(punkte);
    g.save();
    g.translate(x, y);
    g.rotate(((i * 37) % 7 - 3) * 0.035);
    g.scale(1 + 0.7 * (1 - k), 1 + 0.7 * (1 - k));
    g.globalAlpha *= 0.25 + 0.65 * k;
    g.font = `900 ${Math.round(gross)}px ui-monospace, 'SF Mono', Menlo, Consolas, monospace`;
    const w = Math.max(gross * 1.9, g.measureText(text).width + gross * 0.7);
    const h = gross * 1.35;
    const farbe = punkte === null || punkte < 50 ? KOPF_ROT : STEMPEL;
    g.strokeStyle = farbe;
    g.lineWidth = Math.max(1.4, gross * 0.1);
    g.beginPath();
    if (g.roundRect) g.roundRect(-w / 2, -h / 2, w, h, gross * 0.22);
    else g.rect(-w / 2, -h / 2, w, h);
    g.stroke();
    g.fillStyle = farbe;
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText(text, 0, gross * 0.04);
    g.restore();
  }

  function zeichneStempelkarte() {
    const karte = view.karte;
    const liste = state.aufgaben;
    if (!karte || !liste) return;
    const nun = performance.now();
    const { klein } = karte;
    const { w, h, zeile } = karte;
    const kopf = klein ? KARTE_KLEIN_KOPF : KARTE_KOPF;
    const laeuft = state.phase !== "bereit";
    g.save();
    g.translate(karte.x + w / 2, karte.y + h / 2);
    // Neben der Uhr liegt sie ein wenig schief, wie hingelegt.
    if (karte.art === "seite") g.rotate(-0.022);
    g.translate(-w / 2, -h / 2);
    const rund = (x, y, bw, bh, r) => {
      g.beginPath();
      if (g.roundRect) g.roundRect(x, y, bw, bh, r);
      else g.rect(x, y, bw, bh);
    };
    // Schatten und Papier.
    g.fillStyle = "rgba(0, 0, 0, 0.4)";
    rund(3, 5, w, h, 6);
    g.fill();
    const papier = g.createLinearGradient(0, 0, 0, h);
    papier.addColorStop(0, PAPIER);
    papier.addColorStop(1, "#e3d6b4");
    g.fillStyle = papier;
    rund(0, 0, w, h, 6);
    g.fill();
    // Der Kopf: rot, wie auf einer Stechkarte.
    const rand = klein ? 10 : 12;
    g.fillStyle = KOPF_ROT;
    g.fillRect(0, kopf - 3, w, 2);
    kartenText("STEMPELKARTE", rand, kopf / 2, klein ? 11 : 13, KOPF_ROT, { fett: 900, mono: true });
    const summe = laeuft ? String(state.punkte) : "–";
    if (klein) {
      kartenText(`TOTAL ${summe}`, w - rand, kopf / 2, 11, TINTE, { ausrichtung: "right", fett: 900, mono: true });
    } else {
      kartenText("ZEITGEFÜHL", w - rand, kopf / 2, 10, TINTE, { ausrichtung: "right", fett: 800, mono: true, alpha: 0.6 });
    }

    // Die Zeilen. Klein in zwei Spalten zu fünf, gross untereinander.
    const spalten = klein ? 2 : 1;
    const proSpalte = Math.ceil(anzahl() / spalten);
    const spalteB = (w - rand * (spalten + 1)) / spalten;
    const gross = clamp(zeile * 0.52, 10, 14);
    for (let i = 0; i < anzahl(); i += 1) {
      const a = liste[i];
      const e = state.liste[i];
      const sp = Math.floor(i / proSpalte);
      const x = rand + sp * (spalteB + rand);
      const y = kopf + 4 + (i % proSpalte) * zeile;
      const mitte = y + zeile / 2;
      const dran = laeuft && i === state.index && !e && state.phase !== "ende";
      if (dran) {
        // Der Schlitz: die Aufgabe, die gerade dran ist.
        g.fillStyle = "rgba(53, 214, 198, 0.28)";
        rund(x - 4, y + 1, spalteB + 8, zeile - 2, 4);
        g.fill();
      }
      // Linien wie auf einer Karte – unter jeder Zeile eine.
      g.strokeStyle = "rgba(90, 70, 40, 0.18)";
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(x, y + zeile - 0.5);
      g.lineTo(x + spalteB, y + zeile - 0.5);
      g.stroke();
      const sichtbar = e || dran || state.phase === "ende";
      kartenText(String(i + 1).padStart(2, "0"), x, mitte, gross * 0.9, TINTE, { fett: 800, mono: true, alpha: 0.55 });
      // Die Stufe als kleiner Punkt vor dem Namen.
      g.fillStyle = ["#3f9d67", "#c99a1a", "#c4513f"][a.stufe];
      g.beginPath();
      g.arc(x + gross * 1.75, mitte, 2.6, 0, TAU);
      g.fill();
      const nameX = x + gross * 2.3;
      // Der Stempel ist für «100» gut zweieinhalb Zeichen breit – Platz
      // dafür, und links davon die Abweichung.
      const punkteX = x + spalteB - gross * 1.3;
      const nameBreit = (klein ? punkteX - gross * 1.5 : x + spalteB - gross * 6.8) - nameX;
      kartenText(sichtbar ? a.name : "· · ·", nameX, mitte, gross, TINTE, { fett: sichtbar ? 800 : 700, alpha: sichtbar ? 1 : 0.4, breit: nameBreit });
      if (!e) continue;
      if (!klein) {
        kartenText(abweichung(e), x + spalteB - gross * 3.05, mitte, gross * 0.92, e.ms === null ? KOPF_ROT : TINTE, { ausrichtung: "right", fett: 700, mono: true, alpha: 0.85 });
      }
      // Übersprungen (Testrunde): kein Stempel, nur ein Strich.
      if (e.uebersprungen) kartenText("–", punkteX, mitte, gross, TINTE, { ausrichtung: "center", fett: 800, mono: true, alpha: 0.55 });
      else stempel(e.ms === null ? null : e.punkte, punkteX, mitte, gross * 0.95, i, nun);
    }

    // Unten die Summe – gross nur neben der Uhr; klein steht sie im Kopf.
    if (!klein) {
      const y = h - KARTE_FUSS / 2;
      g.strokeStyle = "rgba(90, 70, 40, 0.45)";
      g.lineWidth = 1.5;
      g.beginPath();
      g.moveTo(rand, h - KARTE_FUSS + 2);
      g.lineTo(w - rand, h - KARTE_FUSS + 2);
      g.stroke();
      kartenText("TOTAL", rand, y, 12, TINTE, { fett: 900, mono: true });
      kartenText(`${summe} / ${anzahl() * PUNKTE_JE}`, w - rand, y, 15, STEMPEL, { ausrichtung: "right", fett: 900, mono: true });
    }
    g.restore();
  }

  function zeichneFunken() {
    g.save();
    g.globalCompositeOperation = "lighter";
    for (const f of state.funken) {
      const k = 1 - f.alt / f.leben;
      g.globalAlpha = k;
      g.fillStyle = GOLD;
      g.beginPath();
      g.arc(f.x, f.y, 1.5 + 2.5 * k, 0, TAU);
      g.fill();
    }
    g.restore();
  }

  function zeichnen() {
    if (!g || !view.cssW) return;
    const nun = performance.now();
    g.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
    g.globalAlpha = 1;
    g.globalCompositeOperation = "source-over";
    zeichneWerkbank();
    zeichneGehaeuse();
    const a = aufgabe();
    const { cx, cy, r: R } = view;
    if (state.phase === "bereit" || !a) {
      // Vor dem ersten Tipp: die Uhr auf null, und ein Ring, der ruft.
      zeichneZiffern("0,00", "#bff7e6", { klein: "Tippe zum Start" });
      if (!ruhig()) {
        const k = (state.zeit * 0.7) % 1;
        g.strokeStyle = `rgba(53, 214, 198, ${0.6 * (1 - k)})`;
        g.lineWidth = 3;
        g.beginPath();
        g.arc(cx, cy, R * (1.02 + 0.22 * k), 0, TAU);
        g.stroke();
      }
    } else {
      const zeigt = state.phase === "zeigen" || state.phase === "ende" || (state.phase === "zuschauen" && state.wertung);
      // Solange die Aufgabe wartet, steht die Uhr auf ihrem Anfang.
      const wartet = !zeigt && (state.phase === "warten" || (state.phase === "zuschauen" && zuschau.wartet));
      const t = wartet ? -1 : seit(nun);
      const kEin = clamp((nun - state.t0) / (EINZUG * 0.7), 0, 1);
      zeichneKarte(a, kEin);
      zeichneInhalt(a, t, zeigt ? state.wertung : null, state.haltAb);
      if (wartet) zeichneRuf(nun, kEin);
      if (zeigt && state.wertung) zeichneAufloesung(a, state.wertung, clamp((nun - state.tZeig) / 220, 0, 1));
      // Zu früh getippt: ein kurzes «Noch nicht».
      const seitFrueh = nun - state.zuFrueh;
      if (!zeigt && seitFrueh < 700) schrift("Noch nicht", cx, cy + R * 1.25, clamp(R * 0.16, 13, 22), "#cfdde0", { fett: 800, alpha: clamp(1 - seitFrueh / 700, 0, 1), rand: 3 });
    }
    zeichneFelder();
    zeichneStempelkarte();
    zeichneFunken();
  }

  // ---------------------------------------------------------------------------
  // Zuschauen
  // ---------------------------------------------------------------------------
  // Im Multiplayer nach der eigenen Runde, oder ein Lauf aus der Hall of
  // Fame: dieselben zehn Aufgaben, die Uhr läuft hier selbst, und die Antwort
  // wird hier noch einmal nachgerechnet.
  const zuschau = { index: -1, was: -1, wartet: false };

  function zuschauenTakt() {
    zuschauer?.weiter?.();
    const jetzt = zuschauer?.jetzt?.();
    const probe = zuschauer?.letzte?.(jetzt);
    if (!probe) return;
    const index = clamp(Math.floor(probe.c / 8), 0, AUFGABEN - 1);
    const was = probe.c - Math.floor(probe.c / 8) * 8;
    const nun = performance.now();
    // Zu hören ist, was beim anderen gerade geschieht – nicht, was beim
    // Einsteigen schon zurückliegt.
    const frisch = jetzt - probe.t < 1500;
    // Wann die Aufgabe hingelegt wurde: beim Zug «sie liegt da» genau, nach
    // einem Tipp so, dass die Uhr ANLAUF später läuft, sonst aus dem, was
    // der Zug sagt.
    const hingelegt = (a) => {
      let her = jetzt - probe.t;
      if (was === 0 && probe.a === 1) her += EINZUG - ANLAUF;
      else if (was === 2) her += EINZUG + probe.a;
      else if (was === 1) her += EINZUG + (a.eingabe === "tipp" ? probe.a : a.ab + 400 + probe.a);
      else if (was === 3) her += EINZUG + a.ziel + NACHLAUF;
      return nun - her;
    };
    if (index !== zuschau.index) {
      zuschau.index = index;
      zuschau.was = -1;
      zuschau.wartet = was === 4;
      state.index = index;
      state.wertung = null;
      state.haltAb = null;
      const a = aufgabe();
      state.t0 = hingelegt(a);
      if (status) status.textContent = `Aufgabe ${index + 1} von ${AUFGABEN}: ${a.frage}`;
      if (frisch && (was === 0 || was === 4)) ton("zeitgefuehl.blatt");
    } else if (zuschau.wartet && was !== 4) {
      // Der andere hat getippt: Jetzt läuft die Uhr.
      zuschau.wartet = false;
      state.t0 = hingelegt(aufgabe());
      if (frisch && was === 0) ton("zeitgefuehl.tick");
    }
    const a = aufgabe();
    if (was === 1 || was === 3) {
      if (zuschau.was !== was) {
        zuschau.was = was;
        const wert = was === 1 ? probe.a : null;
        const ms = daneben(a, wert);
        const punkte = punkteFuer(ms, a.stufe);
        state.wertung = { wert, ms, punkte };
        state.liste[index] = { wert, ms, punkte };
        state.haltAb = null;
        state.tZeig = nun - (jetzt - probe.t);
        if (frisch) {
          antwortKlang(punkte);
          if (ms !== null && Math.abs(ms) <= GENAU) funkenBei(view.cx, view.cy);
        }
      }
    } else {
      if (zuschau.was !== was && was === 2 && frisch) ton("zeitgefuehl.lampe");
      zuschau.was = was;
      state.wertung = null;
      state.haltAb = was === 2 ? probe.a : null;
    }
    state.unten = was === 2;
    if (probe.p !== state.punkte) {
      state.punkte = probe.p;
      shell.setCount(probe.p);
    }
  }

  // Ab jetzt die Aufgaben des anderen: dieselben, und wann er tippt.
  function zuschauenStarten() {
    if (!zuschauer?.letzte) return;
    startRun();
    state.phase = "zuschauen";
    shell.setPhase("play");
    zuschau.index = -1;
    zuschau.was = -1;
    zuschau.wartet = false;
    zuschauer.los?.();
  }

  // ---------------------------------------------------------------------------
  // Ablauf
  // ---------------------------------------------------------------------------
  // Die Runde beginnt: mit dem ersten Tipp – oder im Live-Modus zum
  // gemeinsamen Start (game-shell.js, live.los).
  function losGehts() {
    if (state.phase !== "bereit") return;
    shell.setPhase("play");
    aufnahme?.los();
    aufgabeAuf(0);
  }

  function startRun() {
    clearStep();
    stopLoop();
    shell.closeOverlay();
    zufall.neu();
    shell.setPhase("intro");
    state.aufgaben = TESTRUNDE ? testAufgaben() : aufgabenFuer();
    state.phase = "bereit";
    state.index = 0;
    state.punkte = 0;
    state.liste = new Array(anzahl()).fill(null);
    state.haltAb = null;
    state.wertung = null;
    state.serie = 0;
    state.funken = [];
    state.unten = false;
    state.zuFrueh = -9e9;
    state.t0 = performance.now();
    state.wartSeit = state.t0;
    shell.setCount(0);

    shell.clear();
    const prompt = shell.el("p", "cm-prompt zf-prompt", TESTRUNDE
      ? `Testrunde: alle ${anzahl()} Aufgaben nacheinander – nichts wird gespeichert.`
      : "Zehn Aufgaben, kein Blick auf die Uhr. Jede Hundertstelsekunde daneben kostet einen Punkt.");
    status = shell.el("p", "zf-status");
    status.setAttribute("role", "status");
    status.setAttribute("aria-live", "polite");
    shell.play.append(prompt, status, buildPlatz());
    view.cssW = 0;
    view.cssH = 0;
    messen();

    last = performance.now();
    frame = window.requestAnimationFrame(loop);
  }

  function zaehleHoch(ziel) {
    const zahl = host.querySelector(".cm-result-score");
    if (!zahl) return;
    if (ruhig() || ziel <= 1) { zahl.textContent = String(ziel); return; }
    const dauer = Math.min(900, 200 + ziel * 0.9);
    const start = performance.now();
    zahl.textContent = "0";
    const lauf = (now) => {
      if (!zahl.isConnected) return;
      const k = Math.min(1, (now - start) / dauer);
      zahl.textContent = String(Math.round(ziel * (1 - (1 - k) * (1 - k))));
      if (k < 1) window.requestAnimationFrame(lauf);
    };
    window.requestAnimationFrame(lauf);
  }

  function finish() {
    if (zuschauer) return;
    clearStep();
    stopLoop();
    if (state.phase === "ende") return;
    // Im Live-Modus endet die Runde auch mitten in einer Aufgabe: Es zählt,
    // was bis dahin gemessen ist.
    state.phase = "ende";
    state.haltAb = null;
    state.unten = false;
    zeichnen();
    const punkte = state.punkte;
    if (TESTRUNDE) { testEnde(punkte); return; }
    const geist = aufnahme?.ende() || null;
    const vorher = Number(store.read()?.scores?.[0]) || 0;
    const rekord = punkte > vorher;
    store.update((old) => ({
      runs: (Number(old.runs) || 0) + 1,
      scores: [...(old.scores || []), punkte].sort((x, y) => y - x).slice(0, TOP_COUNT),
    }));
    const gemessen = state.liste.filter((e) => e && e.ms !== null);
    const schnitt = gemessen.length ? gemessen.reduce((summe, e) => summe + Math.abs(e.ms), 0) / gemessen.length : 0;
    const genau = gemessen.filter((e) => Math.abs(e.ms) <= GENAU).length;
    shell.showResult({
      label: "Deine Punkte",
      points: punkte,
      detail: [
        rekord ? "Neuer Rekord!" : "",
        genau ? `${genau}× haargenau` : "",
        gemessen.length ? `im Schnitt ${sek(schnitt)} s daneben` : "",
        !rekord && vorher ? `Bestwert ${vorher}` : "",
      ].filter(Boolean).join(" · "),
      geist,
    });
    if (rekord) host.querySelector(".cm-result-detail")?.classList.add("zf-rekord");
    zaehleHoch(punkte);
  }

  // Die Tafel der Testrunde: die Punkte, wie genau, was übersprungen wurde
  // und welche Aufgaben schwach waren – ohne Bestenliste und Aufzeichnung.
  function testEnde(punkte) {
    const fertig = state.liste.map((e, i) => (e ? { ...e, name: state.aufgaben[i].name } : null)).filter(Boolean);
    const gemessen = fertig.filter((e) => e.ms !== null);
    const schnitt = gemessen.length ? gemessen.reduce((summe, e) => summe + Math.abs(e.ms), 0) / gemessen.length : 0;
    const genau = gemessen.filter((e) => Math.abs(e.ms) <= GENAU).length;
    const weg = fertig.filter((e) => e.uebersprungen).length;
    const schwach = fertig.filter((e) => !e.uebersprungen && e.punkte < 50).map((e) => `${e.name} ${e.punkte}`);
    shell.showResult({
      label: "Testrunde",
      points: punkte,
      detail: [
        genau ? `${genau}× haargenau` : "",
        gemessen.length ? `im Schnitt ${sek(schnitt)} s daneben` : "",
        weg ? `${weg} übersprungen` : "",
        schwach.length ? `unter 50: ${schwach.join(", ")}` : "",
        "nichts gespeichert",
      ].filter(Boolean).join(" · "),
      eintragen: false,
    });
    zaehleHoch(punkte);
  }

  const store = cloudApi
    ? cloudApi.register({ key: "lernapp.zeitgefuehl", empty: { runs: 0, scores: [] }, merge: cloudApi.mergeScores(TOP_COUNT) })
    : {
      read: () => ({ runs: 0, scores: [] }),
      write(data) { return data; },
      update(fn) { return fn(this.read()); },
      onChange() { return () => {}; },
    };

  // ---------------------------------------------------------------------------
  // Start
  // ---------------------------------------------------------------------------
  shell = shellApi.mount({
    host,
    title: "Zeitgefühl",
    area: "konzentration",
    accent: "#00A5B5",
    accentDark: "#00707c",
    clock: false,
    onRestart: () => (zuschauer ? zuschauenStarten() : startRun()),
    live: { los: losGehts, stopp: () => finish(), zuschauen: (quelle) => { zuschauer = quelle; zuschauenStarten(); } },
  });
  zuschauer = window.LernappGeist?.zuschauer?.({
    host, spiel: "timeSense", fassung: "z2", zufall, zuege: true, nochmal: zuschauenStarten,
  }) || null;
  // Die Testrunde wird nicht aufgezeichnet – und hat oben den Knopf «Überspringen».
  if (TESTRUNDE) shell.ueberspringen(ueberspringe);
  if (!zuschauer && !TESTRUNDE) aufnahme = window.LernappGeist?.zuege?.({ fassung: "z2", zufall }) || null;

  startRun();
  zuschauer?.laden.then((da) => { if (da) zuschauenStarten(); });

  // --- Tippen und Halten ---------------------------------------------------------
  // Getippt wird auf der ganzen Bühne, mit einem Finger: Ein zweiter zählt
  // nicht, solange der erste liegt.
  let finger = null;
  let tasteUnten = false;

  host.addEventListener("pointerdown", (event) => {
    if (event.target.closest("button, a, input")) return;
    if (state.phase === "bereit") {
      if (!shell.live && !zuschauer) losGehts();
      return;
    }
    // Der Tipp, der die Uhr der wartenden Aufgabe startet.
    if (state.phase === "warten") {
      if (!zuschauer && bereitZumLos()) aufgabeLos();
      return;
    }
    if (zuschauer || finger !== null || tasteUnten) return;
    finger = event.pointerId;
    state.unten = true;
    druck(event.timeStamp);
  });
  const fingerWeg = (event) => {
    if (finger === null || event.pointerId !== finger) return;
    finger = null;
    if (zuschauer) return;
    state.unten = false;
    los(event.timeStamp);
  };
  window.addEventListener("pointerup", fingerWeg);
  window.addEventListener("pointercancel", fingerWeg);

  // Leertaste oder Enter: drücken und loslassen wie der Finger.
  document.addEventListener("keydown", (event) => {
    if (event.key !== " " && event.key !== "Enter") return;
    if (document.activeElement?.tagName === "BUTTON") return;
    event.preventDefault();
    if (event.repeat) return;
    if (state.phase === "bereit") {
      if (!shell.live && !zuschauer) losGehts();
      return;
    }
    if (state.phase === "warten") {
      if (!zuschauer && bereitZumLos()) aufgabeLos();
      return;
    }
    if (zuschauer || finger !== null || tasteUnten) return;
    tasteUnten = true;
    state.unten = true;
    druck(event.timeStamp);
  });
  document.addEventListener("keyup", (event) => {
    if (event.key !== " " && event.key !== "Enter") return;
    if (!tasteUnten) return;
    tasteUnten = false;
    if (zuschauer) return;
    state.unten = false;
    los(event.timeStamp);
  });
  // Wer das Fenster verlässt, lässt los.
  window.addEventListener("blur", () => {
    if (finger === null && !tasteUnten) return;
    finger = null;
    tasteUnten = false;
    if (zuschauer) return;
    state.unten = false;
    los();
  });

  window.addEventListener("resize", messen);
  window.addEventListener("orientationchange", messen);
  window.addEventListener("pagehide", () => { clearStep(); stopLoop(); });

  // Für die Prüfskripte und die Vorführung.
  window.LernappZeitgefuehl = {
    LEICHT, MITTEL, SCHWER, PLAN, AUFGABEN, PUNKTE_JE, KOSTEN, GENAU, HUNDERTSTEL, EINZUG, ZEIGEN_MS, NACHLAUF, WARTEN, HALT_MEHR,
    WARTE, WARTE_ZAEHLT, WARTE_SPERRE, ANLAUF,
    state, view, aufgabe, seit, wuerfle, aufgabenFuer, weltText, punkteFuer, daneben,
    kerzeBei, zweiWinkel, pendelWinkel, ballBei, sandBei, glasBei, bremsWinkel,
    losGehts, aufgabeAuf, aufgabeLos, antworte, weiter, druck, los, zeichnen,
    testrunde: () => TESTRUNDE, ueberspringe,
  };
})();
