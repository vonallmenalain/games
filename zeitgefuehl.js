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
 * Die zehn Aufgaben einer Runde: drei leichte, vier mittlere, drei schwere,
 * jede Art einmal, in gewürfelter Reihe und mit gewürfelten Zeiten.
 *
 *   leicht   Stoppuhr   «Stoppe bei 3,50.» Die Ziffern laufen bis zur Hälfte,
 *                       dann stehen Striche da.
 *            Countdown  «Tippe bei null.» Zwei Zahlen sieht man, den Rest
 *                       zählt man selbst.
 *            Zeiger     Der Zeiger läuft einmal um das Blatt und verschwindet
 *                       nach knapp der Hälfte: tippen, wenn er oben ist.
 *   mittel   Takt       Vier Schläge leuchten, vier bleiben stumm: tippen
 *                       auf den achten.
 *            Nachhalten Eine Lampe brennt. Danach den Finger genauso lange
 *                       halten.
 *            Blind      «Halte genau 2,5 Sekunden.» Ohne jede Vorgabe.
 *            Lange Uhr  Wie die Stoppuhr, aber sechs, sieben Sekunden – und
 *                       zu sehen sind nur die ersten anderthalb.
 *   schwer   Zeitlupe   Die Uhr geht langsamer (oder schneller) als die
 *                       Zeit. Gestoppt wird nach dem, was sie zeigt.
 *            Doppelt    Die Lampe brennt – halten soll man doppelt (oder
 *                       halb) so lange.
 *            Störung    Die Uhr verschwindet, und an ihrer Stelle laufen
 *                       rote Zahlen im falschen Tempo. Sie lügen.
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
  const LEICHT = ["stoppuhr", "countdown", "zeiger"];
  const MITTEL = ["takt", "nachhalten", "blind", "lang"];
  const SCHWER = ["zeitlupe", "doppelt", "stoer"];
  const AUFGABEN = LEICHT.length + MITTEL.length + SCHWER.length;

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
      default: {
        const ziel = zz(3500, 5000, 250);
        const sicht = auf(ziel * 0.35, 50);
        const luege = aus([1.4, 0.7]);
        return { art: "stoer", stufe: 2, name: "Störung", frage: `Stoppe bei ${sek(ziel)} – die roten Zahlen lügen.`, eingabe: "tipp", ziel, faktor: 1, sicht, ab: sicht, luege };
      }
    }
  }

  // Die zehn Aufgaben einer Runde: erst die leichten, dann die mittleren,
  // dann die schweren – jede Gruppe gemischt.
  function aufgabenFuer() {
    const reihe = [...zufall.misch(LEICHT), ...zufall.misch(MITTEL), ...zufall.misch(SCHWER)];
    return reihe.map((art) => wuerfle(art));
  }

  // Die gewürfelte Welt in Worten (für die Prüfung).
  function weltText(liste = state.aufgaben) {
    return (liste || []).map((a) => `${a.art}:${Math.round(a.ziel)}${a.faktor !== 1 ? `×${a.faktor}` : ""}${a.mal ? `·${a.mal}` : ""}${a.luege ? `~${a.luege}` : ""}`).join(" ");
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

  const view = { dpr: 1, cssW: 0, cssH: 0, frei: 0, cx: 0, cy: 0, r: 120 };

  const aufgabe = () => state.aufgaben?.[state.index] || null;
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
    if (status) status.textContent = `Aufgabe ${index + 1} von ${AUFGABEN}: ${a.frage} Tippe, wenn du bereit bist.`;
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
    if (status) status.textContent = `Aufgabe ${state.index + 1} von ${AUFGABEN}: ${a.frage}`;
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
    if (state.index + 1 >= AUFGABEN) finish();
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
    const dpr = clamp(window.devicePixelRatio || 1, 1, 2.5);
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
    // Auflösung, ganz unten die zehn Felder.
    const nutzH = cssH - frei;
    view.r = Math.min(cssW * 0.36, nutzH * 0.225);
    view.cx = cssW / 2;
    view.cy = frei + nutzH * 0.5;
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
    const zeilen = zeilenFuer(a.frage, view.cssW - 36, gross);
    const mitte = oben + hoch * 0.5 + (1 - k) * -14;
    const farbe = ["#9ff5bd", GOLD, ROT][a.stufe];
    schrift(`AUFGABE ${state.index + 1} VON ${AUFGABEN} · ${a.name.toUpperCase()}`, cx, mitte - gross * (zeilen.length > 1 ? 1.45 : 0.95), gross * 0.5, farbe, { fett: 900, alpha: k });
    zeilen.forEach((zeile, i) => {
      schrift(zeile, cx, mitte + gross * (zeilen.length > 1 ? i * 1.15 - 0.25 : 0.25), gross, "#ffffff", { fett: 800, alpha: k, breit: view.cssW - 24 });
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
    const W = view.cssW;
    const b = clamp((W - 24) / AUFGABEN - 4, 18, 44);
    const h = clamp(b * 0.7, 18, 28);
    const x0 = view.cx - ((b + 4) * AUFGABEN - 4) / 2;
    const y = view.cssH - h - 12;
    g.save();
    for (let i = 0; i < AUFGABEN; i += 1) {
      const e = state.liste[i];
      const x = x0 + i * (b + 4);
      const dran = i === state.index && state.phase !== "bereit" && state.phase !== "ende";
      g.fillStyle = e ? (e.punkte >= 90 ? "rgba(255, 210, 63, 0.9)" : e.punkte >= 50 ? "rgba(255, 255, 255, 0.85)" : "rgba(255, 107, 94, 0.85)") : "rgba(255, 255, 255, 0.07)";
      g.beginPath();
      if (g.roundRect) g.roundRect(x, y, b, h, 6);
      else g.rect(x, y, b, h);
      g.fill();
      if (dran) {
        g.lineWidth = 2;
        g.strokeStyle = TUERKIS;
        g.stroke();
      }
      if (e) schrift(String(e.punkte), x + b / 2, y + h / 2 + 1, Math.min(h * 0.58, b * 0.48), "#101a1d", { fett: 900 });
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
    state.aufgaben = aufgabenFuer();
    state.phase = "bereit";
    state.index = 0;
    state.punkte = 0;
    state.liste = new Array(AUFGABEN).fill(null);
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
    const prompt = shell.el("p", "cm-prompt zf-prompt", "Zehn Aufgaben, kein Blick auf die Uhr. Jede Hundertstelsekunde daneben kostet einen Punkt.");
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
    host, spiel: "timeSense", fassung: "z1", zufall, zuege: true, nochmal: zuschauenStarten,
  }) || null;
  if (!zuschauer) aufnahme = window.LernappGeist?.zuege?.({ fassung: "z1", zufall }) || null;

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
    LEICHT, MITTEL, SCHWER, AUFGABEN, PUNKTE_JE, KOSTEN, GENAU, HUNDERTSTEL, EINZUG, ZEIGEN_MS, NACHLAUF, WARTEN, HALT_MEHR,
    WARTE, WARTE_ZAEHLT, WARTE_SPERRE, ANLAUF,
    state, view, aufgabe, seit, aufgabenFuer, weltText, punkteFuer, daneben,
    losGehts, aufgabeAuf, aufgabeLos, antworte, weiter, druck, los, zeichnen,
  };
})();
