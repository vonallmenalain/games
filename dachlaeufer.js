/*
 * dachlaeufer.js – Dachläufer.
 * ---------------------------------------------------------------------------
 * Abenddämmerung über der Altstadt am See. Ein Bote mit rotem Schal rennt
 * über die Dächer – von selbst, und immer schneller. Eine Regel: Halten
 * springt, und länger halten springt weiter. Solange der Finger liegt,
 * trägt der Sprung (bis zu einer Obergrenze); wer loslässt, beendet den
 * Auftrieb, und von da an fällt er im Bogen.
 *
 * Zwischen den Dächern liegen Lücken, einmal schmal, einmal breit, und die
 * Dächer liegen verschieden hoch. Dazwischen stehen Türme: so schmal, dass
 * er landen und gleich wieder abspringen muss. Wer zu kurz springt, prallt an die
 * Hauswand; wer zu weit springt, fliegt über das nächste Dach hinaus; wer
 * gar nicht springt, fällt in die Lücke. Der erste Fehler beendet die Runde.
 * Gezählt werden die Meter.
 *
 * Die Kunst ist das Dosieren in voller Fahrt: Es gibt keine Pause zum
 * Zielen. Wer auf dem letzten Stück vor der Kante abspringt oder gleich
 * hinter der Kante aufsetzt, bekommt es gesagt («Kante!», «Knapp!») – die
 * Zahl auf der Tafel bleiben die Meter.
 *
 * Gebaut wird die Strecke aus dem Zufall (zufall.js): ohne Turnier jedes Mal
 * eine andere, im Turnier für alle im selben Versuch dieselbe. Sie ist immer
 * zu schaffen, weil zuerst ein Weg entsteht und dann die Dächer um ihn herum
 * (naechstesDach): wo er abspringt, wie lange er hält, wo er landet. Jedes
 * Dach beginnt kurz vor der frühesten Landung und endet kurz nach dem
 * spätesten Absprung dieses Wegs – mit Luft für den, der etwas früher oder
 * später drückt und etwas kürzer oder länger hält (luftBei).
 *
 * Drücken und Loslassen gelten zu ihrer Zeit, nicht erst im nächsten Bild
 * (vorholen), und wer kurz vor dem Aufsetzen drückt, springt gleich weiter
 * (PUFFER).
 *
 * Das Bild: Der Himmel wandert mit der Strecke von der goldenen Stunde über
 * das Abendrot in die blaue Stunde und in die Nacht. Himmel, Sonne, Wolken,
 * Berge und See stehen in einem eigenen Bild (himmelBild) und werden nur
 * alle paar Meter neu gemalt; die ferne Stadt, die Dächer davor und die
 * Fassaden sind Kacheln (ebenenNeu), einmal gemalt und dann Punkt auf Punkt
 * aufgelegt – auf dem iPhone rechnet der Prozessor jede gemalte Fläche.
 *
 * Die Gegner (geist.js) rennen als Boten aus Licht mit, und die besten Läufe
 * lassen sich anschauen (?zuschauen=): auf ihrer eigenen Strecke, gebaut mit
 * derselben Saat.
 *
 * Zwölf Einheiten sind ein Meter. x zählt voraus, y nach oben.
 */
(() => {
  "use strict";

  if (document.body.dataset.page !== "roofrun") return;

  const host = document.querySelector("#dl-stage");
  const shellApi = window.LernappGameShell;
  const cloudApi = window.LernappGameCloud;
  if (!host || !shellApi) return;

  const kids = () => window.LernappKids || null;
  const klang = () => window.ArcadeKlang || null;
  const ruhig = () => Boolean(kids()?.prefersReducedMotion?.());

  // Der Zufall. Nur die Strecke zieht daraus – der Weg und die Dächer. Was
  // auf den Dächern steht, welche Fenster leuchten und was aufstiebt, hängt
  // an festen Zahlen oder an Math.random.
  const zufall = window.LernappZufall?.fuer?.("roofRun") || {
    neu() {},
    zahl: () => Math.random(),
  };

  // ---------------------------------------------------------------------------
  // Die Regeln
  // ---------------------------------------------------------------------------
  const METER = 12;
  // Der Sprung: Solange gehalten wird, steigt er gleichmässig (V_AUF) – nie
  // kürzer als HALT_MIN, nie länger als HALT_MAX. Danach zieht ihn G im
  // Bogen hinunter. Ein Tipp trägt ihn 0,40 s weit, voll gehalten 0,82 s.
  const V_AUF = 230;
  const G = 1500;
  const HALT_MIN = 0.05;
  const HALT_MAX = 0.32;
  const PUFFER = 0.11;             // so kurz vor dem Aufsetzen gedrückt: Er springt gleich weiter
  // Das Tempo nach der Strecke: von 15 Metern in der Sekunde auf bald 33.
  const TEMPO0 = 180;
  const TEMPO_MAX = 400;
  const TEMPO_WEG = 200;           // Meter, nach denen gut sechs Zehntel des Zuwachses da sind
  // Die Luft um den geplanten Weg, in Sekunden: so viel früher oder später
  // darf er abspringen UND so viel kürzer oder länger halten.
  const LUFT0 = 0.075;
  const LUFT_MIN = 0.027;
  const LUFT_WEG = 160;
  const SCHWER_WEG = 150;          // so schnell häufen sich die engen Dächer
  // Der Turm: ein wirklich schmales Dach – landen und gleich wieder
  // abspringen. Für den Sprung auf ihn und den von ihm weg gilt nur ein Teil
  // der Luft (TURM_LUFT), darum wird er so schmal. Die ersten stehen nach
  // TURM_AB Metern, weiter hinten ist bald jedes dritte Dach einer – und
  // erst dort stehen auch zwei hintereinander (TURM_REIHE).
  const TURM_LUFT = 0.58;
  const TURM_AB = 90;
  const TURM_WEG = 420;
  const TURM_OFT = 0.4;
  const TURM_REIHE = 380;
  const DH_AUF = 52;               // so viel höher liegt das nächste Dach höchstens
  const DH_AB = 46;                // und so viel tiefer
  const HOCH_MAX = 126;            // höher liegt kein Dach
  const KOPF = 8;                  // so hoch geht auch der kürzeste geplante Sprung über die Kante
  const RAND = 3;                  // so viel Dach liegt vor der frühesten Landung
  const LUECKE_MIN = 26;
  const KNAPP = 8;                 // so nah vor (hinter) der Kante: «Kante!» («Knapp!»)
  const TIEF = 150;                // so tief in der Lücke ist er aus dem Bild
  const START_HOCH = 44;
  const TAKT = 1 / 240;
  const STURZ_MS = 1150;

  const TOP_COUNT = 5;
  const store = cloudApi
    ? cloudApi.register({ key: "lernapp.dachlaeufer", empty: { runs: 0, scores: [] }, merge: cloudApi.mergeScores(TOP_COUNT) })
    : {
      read: () => ({ runs: 0, scores: [] }),
      write(data) { return data; },
      update(fn) { return fn(this.read()); },
      onChange() { return () => {}; },
    };

  // ---------------------------------------------------------------------------
  // Kleine Rechnungen
  // ---------------------------------------------------------------------------
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const lerp = (a, b, k) => a + (b - a) * k;
  const glatt = (k) => { const t = clamp(k, 0, 1); return t * t * (3 - 2 * t); };
  const meterBei = (x) => Math.max(0, x / METER);
  const tempoBei = (x) => TEMPO0 + (TEMPO_MAX - TEMPO0) * (1 - Math.exp(-meterBei(x) / TEMPO_WEG));
  const luftBei = (x) => LUFT_MIN + (LUFT0 - LUFT_MIN) * Math.exp(-meterBei(x) / LUFT_WEG);
  const schwereBei = (x) => 1 - Math.exp(-meterBei(x) / SCHWER_WEG);
  const turmBei = (x) => TURM_OFT * glatt((meterBei(x) - TURM_AB) / TURM_WEG);

  function hash01(n) {
    const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return x - Math.floor(x);
  }

  // Weiches Rauschen über x (für die Bergkämme).
  function rauschen(x) {
    const i = Math.floor(x);
    const f = x - i;
    return lerp(hash01(i), hash01(i + 1), f * f * (3 - 2 * f));
  }

  const mix3 = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
  const rgb = (c) => `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`;
  const rgba = (c, alpha) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${alpha})`;

  // ---------------------------------------------------------------------------
  // Zustand
  // ---------------------------------------------------------------------------
  // phase:   "bereit" (noch nichts gedrückt), "spiel", "zuschauen", "ende"
  // schritt: "start" (er steht), "lauf" (er rennt oder fliegt), "sturz"
  const state = {
    phase: "bereit",
    schritt: "start",
    punkte: 0,
    spruenge: 0,
    perfekte: 0,
    reihe: 0,
    // Der Läufer: wo er ist, ob er auf einem Dach steht (und auf welchem),
    // wie lange der Sprung schon trägt, von welchem Dach er absprang (ab)
    // und welches als nächstes unter oder vor ihm liegt (vorn).
    lf: { x: 0, y: START_HOCH, vy: 0, boden: true, dach: 0, halt: 0, traegt: false, gesprungen: false, ab: 0, vorn: 0, lauf: 0 },
    gedrueckt: false,
    puffer: 0,
    daecher: [],
    sturz: null,
    teile: [],
    schriften: [],
    zeit: 0,
    camX: 0,
    camY: START_HOCH,
    stoss: 0,
    stauch: 0,
  };

  let shell = null;
  let feld = null;
  let canvas = null;
  let g = null;
  let frame = null;
  let last = 0;
  let voraus = 0;
  let stepTimer = null;
  let gegner = null;
  let zuschauer = null;
  let schritte = null;
  let abend = null;

  const view = { s: 1, dpr: 1, cssW: 0, cssH: 0, w: 440, h: 700, frei: 0, boden: 0, f: 1, vorn: 88 };

  function clearStep() {
    if (stepTimer) { window.clearTimeout(stepTimer); stepTimer = null; }
  }

  function stopLoop() {
    if (frame) { window.cancelAnimationFrame(frame); frame = null; }
  }

  // ---------------------------------------------------------------------------
  // Klang
  // ---------------------------------------------------------------------------
  function klangAn() {
    abend = klang()?.kulisse("dachlaeufer.abend") || null;
    abend?.setze(0.3);
    abend?.laut(0.45);
    schritte = klang()?.kulisse("dachlaeufer.schritte", { laut: 0 }) || null;
  }

  function klangStellen() {
    const rennt = state.schritt === "lauf" && state.lf.boden;
    schritte?.setze(clamp((tempoBei(state.lf.x) - TEMPO0) / (TEMPO_MAX - TEMPO0), 0, 1));
    schritte?.laut(rennt ? 0.65 : 0);
  }

  function klangAus() {
    schritte?.stop();
    abend?.stop();
    schritte = null;
    abend = null;
  }

  // ---------------------------------------------------------------------------
  // Der Sprung
  // ---------------------------------------------------------------------------
  // Ein Rechenschritt in der Luft. bis: so lange trägt der Sprung. Beides
  // ist genau gerechnet (gleichmässig steigen, dann der Bogen), damit die
  // Strecke und das Spiel dieselbe Bahn sehen, wie fein auch geteilt wird.
  function luftSchritt(k, h, bis) {
    k.x += tempoBei(k.x) * h;
    let rest = h;
    if (k.traegt) {
      const d = Math.min(rest, Math.max(0, bis - k.halt));
      k.y += V_AUF * d;
      k.halt += d;
      rest -= d;
      if (k.halt >= bis - 1e-9) { k.traegt = false; k.vy = V_AUF; }
    }
    if (!k.traegt && rest > 0) {
      k.y += k.vy * rest - (G * rest * rest) / 2;
      k.vy -= G * rest;
    }
  }

  // Wo landet, wer bei x auf der Höhe y0 abspringt und so lange hält – auf
  // einem Dach der Höhe ziel? (NaN: Er kommt gar nicht so hoch.)
  function lande(x, y0, halt, ziel) {
    const bis = clamp(halt, HALT_MIN, HALT_MAX);
    const k = { x, y: y0, vy: 0, halt: 0, traegt: true };
    let hoch = y0;
    for (let n = 0; n < 1200; n += 1) {
      const xa = k.x;
      const ya = k.y;
      luftSchritt(k, TAKT, bis);
      hoch = Math.max(hoch, k.y);
      if (!k.traegt && k.vy < 0 && k.y <= ziel) {
        if (hoch < ziel) return NaN;
        return xa + (k.x - xa) * ((ya - ziel) / Math.max(1e-9, ya - k.y));
      }
    }
    return NaN;
  }

  // Wie lange muss halten, wer von (x, y0) aus bei zielX auf der Höhe ziel
  // landen will? Für die nachgebildeten Spieler der Prüfung.
  function haltFuer(x, y0, zielX, ziel) {
    let a = HALT_MIN;
    let b = HALT_MAX;
    for (let i = 0; i < 16; i += 1) {
      const m = (a + b) / 2;
      const l = lande(x, y0, m, ziel);
      if (Number.isNaN(l) || l < zielX) a = m; else b = m;
    }
    return (a + b) / 2;
  }

  // ---------------------------------------------------------------------------
  // Die Strecke
  // ---------------------------------------------------------------------------
  /*
   * Zuerst der Weg, dann die Dächer. Auf jedem Dach A steht, wo der Weg
   * abspringt (t) und wie lange er hält (halt); e ist die Luft in Sekunden.
   *
   *   A.x1    endet kurz nach dem spätesten Absprung:  t + e · Tempo + Rand
   *   B.x0    beginnt kurz vor der frühesten Landung:  wer um e früher
   *           abspringt und um e kürzer hält, landet bei «frueh»
   *   B.spaet die späteste Landung: um e später, um e länger
   *   B.t     der nächste Absprung liegt erst nach der spätesten Landung –
   *           gleich danach («eng»: Das Dach ist nur ein Tritt) oder nach
   *           einem Stück Lauf.
   *
   * Die Höhe des nächsten Dachs richtet sich danach, wie hoch der kürzeste
   * geplante Sprung kommt (mit KOPF darüber). Liegt die Lücke sonst zu
   * schmal, wird länger gehalten.
   *
   * Ein Turm ist ein Dach, auf das und von dem weg nur ein Teil der Luft
   * gilt: Früheste und späteste Landung liegen dichter beisammen, und der
   * nächste Absprung folgt gleich – so wird er schmal. Der Weg sieht vor,
   * was der Spieler dort tun muss: landen und sofort wieder abspringen.
   */
  function naechstesDach() {
    const d = state.daecher;
    const n = d.length;
    const A = d[n - 1];
    // Immer gleich viele Zahlen ziehen, was auch geschieht: Die Strecke soll
    // an der Saat hängen, nicht an den Zweigen dieser Funktion.
    const z = [zufall.zahl(), zufall.zahl(), zufall.zahl(), zufall.zahl(), zufall.zahl(), zufall.zahl()];
    const k = schwereBei(A.spaet);
    // Wird das nächste Dach ein Turm? Dann gilt für diesen Sprung nur ein
    // Teil der Luft – und ebenso für den Sprung von einem Turm weg.
    const turm = n >= 5 && z[5] < turmBei(A.spaet) && (!A.turm || meterBei(A.spaet) > TURM_REIHE);
    const e = luftBei(A.spaet) * (turm || A.turm ? TURM_LUFT : 1);
    const eng = A.turm || (n >= 3 && z[0] < lerp(0.4, 0.86, k));
    const lauf = n < 3 ? lerp(0.75, 1.05, z[1]) : A.turm ? 0 : eng ? z[1] * 0.06 : lerp(0.2, lerp(0.7, 0.34, k), z[1]);
    A.eng = eng;
    A.e = e;
    A.t = A.spaet + (e + lauf) * tempoBei(A.spaet) + 2;
    const weg = e * tempoBei(A.t);
    A.x1 = A.t + weg + RAND + 1;
    let halt = n < 2 ? lerp(0.12, 0.2, z[2]) : lerp(HALT_MIN + 0.005, HALT_MAX - 0.01, z[2]);
    let dh = 0;
    let frueh = 0;
    let spaet = 0;
    for (let versuch = 0; versuch < 8; versuch += 1) {
      const steig = V_AUF * Math.max(HALT_MIN, halt - e) + (V_AUF * V_AUF) / (2 * G) - KOPF;
      dh = Math.round(lerp(-DH_AB, Math.min(DH_AUF, steig), z[3]));
      if (n < 2) dh = Math.round(lerp(-8, 10, z[3]));
      if (versuch >= 6) dh = Math.min(dh, 0);
      if (A.top + dh > HOCH_MAX) dh = -Math.abs(dh);
      if (A.top + dh < 0) dh = -A.top;
      frueh = lande(A.t - weg, A.top, halt - e, A.top + dh);
      spaet = lande(A.t + weg, A.top, halt + e, A.top + dh);
      if (frueh - RAND - A.x1 >= LUECKE_MIN) break;
      halt = Math.min(HALT_MAX - 0.01, halt + 0.04);
    }
    A.halt = halt;
    d.push({
      nr: n, x0: frueh - RAND, x1: Infinity, top: A.top + dh, frueh, spaet,
      l: lande(A.t, A.top, halt, A.top + dh), t: 0, halt: 0, e: 0, eng: false, turm, saat: z[4], ton: Math.floor(z[4] * 97) % 3,
    });
  }

  function planBis(x) {
    const d = state.daecher;
    while (d[d.length - 1].x0 < x) naechstesDach();
  }

  function streckeNeu() {
    state.daecher = [{ nr: 0, x0: -560, x1: Infinity, top: START_HOCH, frueh: 0, spaet: 0, l: 0, t: 0, halt: 0, e: 0, eng: false, turm: false, saat: 0.37, ton: 0 }];
    planBis(2400);
  }

  // Die Strecke als Text – für die Prüfung, dass in einem Turnier alle
  // dieselbe bekommen.
  function kursText(bis = 6000) {
    planBis(bis + 400);
    return state.daecher.filter((r) => r.x0 < bis && Number.isFinite(r.x1)).map((r) => `${r.x0.toFixed(1)}-${r.x1.toFixed(1)}@${r.top}${r.turm ? "T" : ""}`).join(",");
  }

  // ---------------------------------------------------------------------------
  // Die Fläche
  // ---------------------------------------------------------------------------
  function buildPlatz() {
    const platz = shell.el("div", "dl-platz");
    feld = shell.el("div", "dl-feld");
    canvas = document.createElement("canvas");
    canvas.className = "dl-canvas";
    canvas.setAttribute("aria-hidden", "true");
    feld.append(canvas);
    g = canvas.getContext("2d");

    // Der Hinweis vor dem ersten Druck: ein Ring, der sich füllt – halten.
    const tipp = shell.el("span", "dl-tipp");
    tipp.setAttribute("aria-hidden", "true");
    const ns = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(ns, "svg");
    svg.setAttribute("viewBox", "0 0 64 64");
    const spur = document.createElementNS(ns, "circle");
    spur.setAttribute("class", "dl-tipp-spur");
    const ring = document.createElementNS(ns, "circle");
    ring.setAttribute("class", "dl-tipp-ring");
    [spur, ring].forEach((kreis) => {
      kreis.setAttribute("cx", "32");
      kreis.setAttribute("cy", "32");
      kreis.setAttribute("r", "22");
      kreis.setAttribute("fill", "none");
      kreis.setAttribute("stroke", "#ffffff");
      kreis.setAttribute("stroke-width", "5");
      svg.append(kreis);
    });
    const punkt = document.createElementNS(ns, "circle");
    punkt.setAttribute("cx", "32");
    punkt.setAttribute("cy", "32");
    punkt.setAttribute("r", "9");
    punkt.setAttribute("fill", "#ffffff");
    svg.append(punkt);
    tipp.append(svg);
    feld.append(tipp);
    platz.append(feld);
    return platz;
  }

  const ZELLE = 16;                // eine Fensterspalte der Fassade
  const REIHE = 24;                // eine Fensterreihe

  function messen() {
    if (!canvas || !feld) return;
    const cssW = Math.max(80, feld.clientWidth);
    const cssH = Math.max(80, feld.clientHeight);
    const dpr = shellApi.bildpunkte(cssW, cssH, 2);
    const frei = Math.min(cssH * 0.4, shell?.frei?.(canvas) || 0);
    if (cssW === view.cssW && cssH === view.cssH && dpr === view.dpr && frei === view.frei) return;
    view.cssW = cssW;
    view.cssH = cssH;
    view.dpr = dpr;
    view.frei = frei;
    // Hochkant sind 440 Einheiten im Bild (und viel Himmel darüber), quer
    // 300 in der Höhe. Eine Fensterspalte ist eine ganze Zahl Bildpunkte
    // breit: So lassen sich die Fassaden auflegen, ohne gestreckt zu werden.
    const s = Math.min(cssH / 300, cssW / 440);
    view.s = Math.max(2, Math.round(ZELLE * s * dpr)) / (ZELLE * dpr);
    view.w = cssW / view.s;
    view.h = cssH / view.s;
    view.f = clamp((view.h - 300) / 300, 0, 1);
    view.boden = Math.round(cssH * lerp(0.7, 0.64, view.f));
    // So weit sieht er voraus: hochkant vier Fünftel des Bildes, quer nicht
    // viel mehr – sonst hätte, wer quer spielt, die Dächer früher im Blick.
    view.vorn = view.w - Math.min(view.w * 0.8, 470);
    const pw = Math.round(cssW * dpr);
    const ph = Math.round(cssH * dpr);
    if (canvas.width !== pw) canvas.width = pw;
    if (canvas.height !== ph) canvas.height = ph;
    ebenenNeu();
  }

  const bildX = (x) => (x - state.camX) * view.s;
  const bildY = (y) => view.boden - (y - state.camY) * view.s;
  // Der Horizont: das Ufer des Sees, auf dem die Berge stehen.
  const horizont = () => view.boden - (40 + 18 * view.f) * view.s;
  const bergHoch = () => (60 + 50 * view.f) * view.s;

  // ---------------------------------------------------------------------------
  // Zeichnen: der Himmel, die Berge, der See
  // ---------------------------------------------------------------------------
  // Die Tageszeit nach der Strecke: goldene Stunde, Abendrot, blaue Stunde,
  // Nacht. glut: der Schein der Sonne; stern: wie hell die Sterne sind;
  // kante: das Licht auf den Dachkanten.
  const HIMMEL = [
    { m: 0, oben: [36, 44, 108], mitte: [204, 112, 122], unten: [255, 196, 112], berg1: [70, 46, 104], berg2: [128, 82, 128], see: [240, 150, 110], wolke: [112, 70, 122], licht: [255, 176, 120], kante: [255, 206, 140], glut: 1, stern: 0.12, mond: 0 },
    { m: 170, oben: [26, 26, 86], mitte: [166, 72, 124], unten: [255, 146, 94], berg1: [52, 34, 92], berg2: [104, 60, 118], see: [214, 108, 106], wolke: [86, 50, 108], licht: [255, 128, 104], kante: [255, 170, 130], glut: 0.8, stern: 0.35, mond: 0 },
    { m: 400, oben: [12, 16, 62], mitte: [62, 52, 124], unten: [196, 112, 134], berg1: [32, 28, 82], berg2: [62, 50, 110], see: [124, 84, 132], wolke: [48, 42, 100], licht: [200, 120, 150], kante: [214, 170, 200], glut: 0.3, stern: 0.75, mond: 0.5 },
    { m: 760, oben: [5, 8, 36], mitte: [16, 26, 80], unten: [48, 62, 126], berg1: [12, 16, 52], berg2: [24, 32, 78], see: [36, 50, 108], wolke: [22, 28, 70], licht: [70, 86, 150], kante: [170, 190, 255], glut: 0, stern: 1, mond: 1 },
  ];
  const FARBEN = ["oben", "mitte", "unten", "berg1", "berg2", "see", "wolke", "licht", "kante"];

  function himmelBei(m) {
    for (let i = 0; i < HIMMEL.length - 1; i += 1) {
      const a = HIMMEL[i];
      const b = HIMMEL[i + 1];
      if (m <= b.m) {
        const k = glatt((m - a.m) / (b.m - a.m));
        const f = { glut: lerp(a.glut, b.glut, k), stern: lerp(a.stern, b.stern, k), mond: lerp(a.mond, b.mond, k) };
        FARBEN.forEach((name) => { f[name] = mix3(a[name], b[name], k); });
        return f;
      }
    }
    return HIMMEL[HIMMEL.length - 1];
  }

  const STERNE = Array.from({ length: 80 }, (_, i) => ({
    x: hash01(i * 3.1 + 1), y: hash01(i * 5.7 + 2), r: 0.7 + hash01(i * 7.3 + 3) * 1.3, t: hash01(i * 9.9) * 6,
  }));
  // Wolkenbänke: wo (in Teilen der Breite und der Höhe bis zum Horizont),
  // wie breit, wie dick.
  const WOLKEN = [
    { x: 0.16, y: 0.3, b: 0.42, d: 1 }, { x: 0.8, y: 0.2, b: 0.5, d: 1.2 }, { x: 0.46, y: 0.47, b: 0.36, d: 0.8 },
    { x: 0.96, y: 0.56, b: 0.34, d: 0.7 }, { x: 0.3, y: 0.11, b: 0.3, d: 0.7 }, { x: 0.02, y: 0.6, b: 0.3, d: 0.6 },
  ];

  let himmelBild = null;
  let himmelG = null;
  const himmelStand = { m: -99 };

  // Der Kamm eines Bergzugs als Weg: von links nach rechts über die Breite.
  function kamm(k, W, hz, hoch, saat, zacken) {
    const sx = W * 0.68;
    k.beginPath();
    k.moveTo(0, hz + 2);
    for (let x = 0; x <= W + 6; x += 6) {
      const u = (x / Math.max(320, W)) * 3.2 + saat;
      const n = 0.56 * rauschen(u) + 0.3 * rauschen(u * 2.3 + 7) + 0.14 * rauschen(u * 6.1 + 3) * zacken;
      // Rechts der Mitte liegt eine Senke: dort geht die Sonne unter.
      const senke = 1 - 0.62 * Math.exp(-(((x - sx) / (W * 0.17)) ** 2));
      k.lineTo(x, hz - hoch * (0.3 + 0.7 * n) * senke);
    }
    k.lineTo(W + 6, hz + 2);
    k.closePath();
  }

  function himmelMalen(k, F, m) {
    const W = view.cssW;
    const hz = horizont();
    const unten = himmelBild.height / view.dpr;
    const verlauf = k.createLinearGradient(0, 0, 0, hz);
    verlauf.addColorStop(0, rgb(F.oben));
    verlauf.addColorStop(0.6, rgb(F.mitte));
    verlauf.addColorStop(1, rgb(F.unten));
    k.fillStyle = verlauf;
    k.fillRect(0, 0, W, hz + 1);

    // Die Sonne sinkt in die Senke der Berge – nach 200 Metern ist sie weg,
    // ihr Schein bleibt noch lange.
    const R = Math.min(W, view.cssH) * 0.075 + 8;
    const bh = bergHoch();
    const sx = W * 0.68;
    const sy = hz - bh * (0.5 - 1.05 * glatt(m / 230));
    if (F.glut > 0.01) {
      const my = Math.min(sy, hz - bh * 0.1);
      const schein = k.createRadialGradient(sx, my, R * 0.6, sx, my, Math.max(W, hz) * 0.8);
      schein.addColorStop(0, rgba([255, 236, 176], 0.85 * F.glut));
      schein.addColorStop(0.16, rgba([255, 190, 120], 0.42 * F.glut));
      schein.addColorStop(0.5, rgba([255, 140, 110], 0.14 * F.glut));
      schein.addColorStop(1, "rgba(255, 140, 110, 0)");
      k.fillStyle = schein;
      k.fillRect(0, 0, W, hz + 1);
    }
    if (sy - R < hz) {
      k.fillStyle = "#fff3cf";
      k.beginPath();
      k.arc(sx, sy, R, 0, Math.PI * 2);
      k.fill();
    }

    // Der Mond: eine Sichel, links oben.
    if (F.mond > 0.02) {
      const mx = W * 0.3;
      const my = hz * 0.3 + 14;
      const mr = R * 0.72;
      k.fillStyle = rgba([240, 244, 255], F.mond);
      k.beginPath();
      k.arc(mx, my, mr, 0, Math.PI * 2);
      k.fill();
      k.fillStyle = rgb(mix3(F.oben, F.mitte, 0.2));
      k.beginPath();
      k.arc(mx + mr * 0.44, my - mr * 0.18, mr * 0.92, 0, Math.PI * 2);
      k.fill();
    }

    // Wolkenbänke, von unten angeleuchtet.
    WOLKEN.forEach((w, i) => {
      const cx = w.x * W;
      const cy = hz * w.y + 6;
      const b = Math.max(90, w.b * W);
      const dick = (5 + 0.016 * hz) * w.d;
      [[F.licht, 0.72, dick * 0.55], [F.wolke, 0.8, 0]].forEach(([farbe, alpha, tiefer]) => {
        k.fillStyle = rgba(farbe, alpha);
        k.beginPath();
        for (let j = 0; j < 5; j += 1) {
          const u = j / 4 - 0.5;
          const br = b * (0.2 + 0.16 * hash01(i * 11 + j));
          const ex = cx + u * b * 0.8;
          const ey = cy + tiefer + dick * 0.5 * (hash01(i * 5 + j * 3) - 0.5);
          k.moveTo(ex + br, ey);
          k.ellipse(ex, ey, br, dick * (0.7 + 0.5 * hash01(i * 7 + j)), 0, 0, Math.PI * 2);
        }
        k.fill();
      });
    });

    // Zwei Bergzüge: hinten der hohe im Dunst, mit einem Saum aus Licht,
    // davor der dunkle.
    k.fillStyle = rgba(F.kante, 0.55 * Math.max(0.25, F.glut));
    kamm(k, W, hz, bh, 3.7, 1);
    k.fill();
    k.save();
    k.translate(0, 1.6);
    k.fillStyle = rgb(F.berg2);
    kamm(k, W, hz, bh, 3.7, 1);
    k.fill();
    k.restore();
    k.fillStyle = rgb(F.berg1);
    kamm(k, W, hz, bh * 0.56, 9.2, 0.6);
    k.fill();

    // Der See: der Himmel noch einmal, dunkler – und die Bahn der Sonne.
    const seeH = Math.max(10, unten - hz);
    const see = k.createLinearGradient(0, hz, 0, hz + Math.min(seeH, 46 * view.s));
    see.addColorStop(0, rgb(mix3(F.see, F.unten, 0.35)));
    see.addColorStop(1, rgb(mix3(F.see, F.berg1, 0.6)));
    k.fillStyle = see;
    k.fillRect(0, hz, W, seeH);
    if (F.glut > 0.05) {
      for (let i = 0; i < 9; i += 1) {
        const b = R * (0.5 + i * 0.32) * (0.75 + 0.5 * hash01(i * 3.3));
        k.fillStyle = rgba([255, 226, 170], (0.75 - i * 0.07) * F.glut);
        k.fillRect(sx - b / 2 + (hash01(i * 9.1) - 0.5) * R * 0.4, hz + 1.5 + i * 3.2 * view.s, b, Math.max(1, 1.1 * view.s));
      }
    }
    k.fillStyle = rgba(F.berg1, 0.9);
    k.fillRect(0, hz - 0.6, W, 1.6);
  }

  function zeichneHimmel(F, m) {
    const W = view.cssW;
    const hz = horizont();
    // Unter der fernen Stadt sieht den Himmel niemand: Sein Bild reicht nur
    // bis dorthin.
    const hoch = Math.min(canvas.height, Math.ceil((view.boden + 72 * view.s) * view.dpr));
    if (!himmelBild || himmelBild.width !== canvas.width || himmelBild.height !== hoch) {
      himmelBild = document.createElement("canvas");
      himmelBild.width = canvas.width;
      himmelBild.height = hoch;
      himmelG = himmelBild.getContext("2d");
      himmelStand.m = -99;
    }
    if (Math.abs(m - himmelStand.m) > 8) {
      himmelStand.m = m;
      himmelG.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
      himmelMalen(himmelG, F, m);
    }
    // Auflegen, Punkt auf Punkt.
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.drawImage(himmelBild, 0, 0);
    g.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);

    const still = ruhig();
    // Die ersten Sterne – und mit der Nacht alle.
    if (F.stern > 0.05) {
      g.fillStyle = "#ffffff";
      const n = Math.round(STERNE.length * clamp(F.stern * 1.3, 0.2, 1));
      for (let i = 0; i < n; i += 1) {
        const st = STERNE[i];
        const funkeln = still ? 0.8 : 0.55 + 0.45 * Math.sin(state.zeit * 1.9 + st.t);
        g.globalAlpha = funkeln * F.stern * (1 - st.y * 0.7);
        g.fillRect(st.x * W, st.y * (hz - bergHoch()) * 0.92, st.r, st.r);
      }
      g.globalAlpha = 1;
    }
    // Ein Zug Vögel, solange es hell ist.
    if (F.stern < 0.85) {
      const t = still ? 3 : state.zeit;
      const lauf = ((t * 0.022 + 0.3) % 1.4) - 0.2;
      g.strokeStyle = rgba(F.berg1, 0.85 * (1 - F.stern));
      g.lineWidth = Math.max(1, 1.1 * view.s);
      g.beginPath();
      for (let i = 0; i < 7; i += 1) {
        const reihe = Math.ceil(i / 2);
        const seite = i % 2 ? 1 : -1;
        const x = lauf * W - reihe * 13 * view.s;
        const y = hz * 0.36 + reihe * seite * 7 * view.s + Math.sin(t * 0.7 + i) * 2;
        const fl = Math.sin(t * 8 + i * 1.3) * 2.6 * view.s;
        const sp = 4.2 * view.s;
        g.moveTo(x - sp, y - fl);
        g.lineTo(x, y);
        g.lineTo(x + sp, y - fl);
      }
      g.stroke();
    }
  }

  // ---------------------------------------------------------------------------
  // Zeichnen: die Stadt dahinter und die Fassaden – Kacheln
  // ---------------------------------------------------------------------------
  /*
   * Drei Sorten Kacheln, einmal gemalt (ebenenNeu), dann je Bild nur noch
   * aufgelegt, Punkt auf Punkt:
   *
   *   fern     die Altstadt am Ufer, im Dunst: Giebel, Türme, eine Kuppel
   *   mittel   die Dächer gleich hinter der Strecke, mit Kaminen, Antennen,
   *            Wäscheleinen und Licht in den Fenstern
   *   fassade  die Wand eines Hauses der Strecke, drei Farbtöne: Fenster in
   *            Spalten (ZELLE) und Reihen (REIHE), nach unten dunkler
   */
  const FERN = { b: 720, h: 84 };
  const MITTEL = { b: 640, h: 112 };
  const FASSADE = { spalten: 32, reihen: 18 };
  const TOENE = [
    { wand: [38, 30, 82], dach: [22, 18, 54] },
    { wand: [30, 36, 90], dach: [18, 22, 58] },
    { wand: [50, 32, 78], dach: [28, 18, 50] },
  ];
  const WARM = [[255, 208, 122], [255, 176, 96], [255, 226, 160]];
  let ebenen = null;

  function kachel(b, h, malen) {
    const f = view.s * view.dpr;
    const c = document.createElement("canvas");
    c.width = Math.max(8, Math.round(b * f));
    c.height = Math.max(8, Math.round(h * f));
    const k = c.getContext("2d");
    k.scale(c.width / b, c.height / h);
    malen(k);
    return c;
  }

  function maleFern(k) {
    const { b, h } = FERN;
    const grund = k.createLinearGradient(0, 0, 0, h);
    grund.addColorStop(0, "rgb(104, 72, 132)");
    grund.addColorStop(1, "rgb(60, 44, 106)");
    k.fillStyle = grund;
    let x = 0;
    let nr = 0;
    while (x < b) {
      const z = (n) => hash01(nr * 5.31 + n * 2.17 + 0.4);
      let breit = 12 + z(1) * 16;
      if (b - x - breit < 12) breit = b - x;
      const hoch = 18 + z(2) * 30;
      const art = z(3);
      k.fillRect(x, h - hoch, breit + 0.4, hoch);
      if (art < 0.5) {
        // Giebel
        const g1 = 5 + z(4) * 7;
        k.beginPath();
        k.moveTo(x, h - hoch + 0.2);
        k.lineTo(x + breit / 2, h - hoch - g1);
        k.lineTo(x + breit, h - hoch + 0.2);
        k.fill();
      } else if (art > 0.93) {
        // Turm mit Helm
        const tb = 8;
        const th = 56 + z(5) * 10;
        k.fillRect(x + breit / 2 - tb / 2, h - th, tb, th);
        k.beginPath();
        k.moveTo(x + breit / 2 - tb / 2 - 1, h - th + 0.2);
        k.lineTo(x + breit / 2, h - th - 20);
        k.lineTo(x + breit / 2 + tb / 2 + 1, h - th + 0.2);
        k.fill();
      } else if (art > 0.87) {
        // Kuppel
        k.beginPath();
        k.arc(x + breit / 2, h - hoch, breit * 0.42, Math.PI, 0);
        k.fill();
        k.fillRect(x + breit / 2 - 0.6, h - hoch - breit * 0.42 - 6, 1.2, 7);
      }
      x += breit;
      nr += 1;
    }
    // Wenige Lichter.
    for (let i = 0; i < 90; i += 1) {
      k.fillStyle = rgba(WARM[i % 3], 0.5 + 0.4 * hash01(i * 3.7));
      k.fillRect(hash01(i * 1.9 + 5) * (b - 2), h - 3 - hash01(i * 4.3 + 1) * 15, 1.3, 1.7);
    }
  }

  function maleMittel(k) {
    const { b, h } = MITTEL;
    const grund = k.createLinearGradient(0, 0, 0, h);
    grund.addColorStop(0, "rgb(48, 36, 96)");
    grund.addColorStop(1, "rgb(20, 16, 54)");
    let x = 0;
    let nr = 0;
    let vorX = 0;
    let vorY = h;
    while (x < b) {
      const z = (n) => hash01(nr * 9.13 + n * 3.71 + 2.2);
      let breit = 28 + z(1) * 26;
      if (b - x - breit < 28) breit = b - x;
      const hoch = 40 + z(2) * 56;
      const y = h - hoch;
      k.fillStyle = grund;
      k.fillRect(x, y, breit + 0.4, hoch);
      const giebel = z(3) < 0.55 ? 6 + z(4) * 9 : 0;
      if (giebel) {
        k.beginPath();
        k.moveTo(x - 1, y + 0.3);
        k.lineTo(x + breit / 2, y - giebel);
        k.lineTo(x + breit + 1, y + 0.3);
        k.fill();
      } else {
        k.fillRect(x - 1, y - 2, breit + 2, 2.4);
      }
      // Kamin, Antenne
      if (z(5) < 0.6) k.fillRect(x + breit * (0.2 + 0.5 * z(6)), y - giebel * 0.5 - 7, 4, 9);
      if (z(7) < 0.35) {
        const ax = x + breit * (0.3 + 0.4 * z(8));
        k.fillRect(ax, y - giebel - 13, 0.8, 14);
        k.fillRect(ax - 3.4, y - giebel - 12, 7.6, 0.7);
        k.fillRect(ax - 2.2, y - giebel - 9, 5.2, 0.7);
      }
      // Das Licht der Sonne auf der Dachkante.
      k.fillStyle = "rgba(255, 176, 150, 0.4)";
      if (giebel) {
        k.beginPath();
        k.moveTo(x + breit / 2, y - giebel);
        k.lineTo(x + breit + 1, y + 0.3);
        k.lineTo(x + breit + 1, y + 1.5);
        k.lineTo(x + breit / 2, y - giebel + 1.2);
        k.fill();
      } else {
        k.fillRect(x - 1, y - 2, breit + 2, 0.9);
      }
      // Fenster
      for (let fy = y + 7; fy < h - 6; fy += 13) {
        for (let fx = x + 5; fx < x + breit - 8; fx += 10) {
          const an = hash01(fx * 1.31 + fy * 2.77 + nr) < 0.3;
          k.fillStyle = an ? rgba(WARM[(Math.floor(fx + fy)) % 3], 0.92) : "rgba(84, 78, 150, 0.35)";
          k.fillRect(fx, fy, 4.6, 6.4);
        }
      }
      // Eine Wäscheleine zum Haus davor.
      if (nr > 0 && z(9) < 0.4) {
        const y0 = Math.max(vorY, y) + 9;
        k.strokeStyle = "rgba(220, 210, 255, 0.55)";
        k.lineWidth = 0.5;
        k.beginPath();
        k.moveTo(vorX, y0);
        k.quadraticCurveTo((vorX + x + 8) / 2, y0 + 5, x + 8, y0 + 1);
        k.stroke();
        ["#f1ecff", "#ff8f6e", "#9fc4ff", "#f6d98a"].forEach((farbe, i) => {
          const u = 0.2 + i * 0.2;
          const lx = lerp(vorX, x + 8, u);
          k.fillStyle = farbe;
          k.globalAlpha = 0.8;
          k.fillRect(lx, y0 + 4.6 * (1 - (2 * u - 1) ** 2) + 0.4, 3.2, 4.4 + (i % 2));
          k.globalAlpha = 1;
        });
      }
      vorX = x + breit - 8;
      vorY = y;
      x += breit;
      nr += 1;
    }
  }

  function maleFassade(k, ton) {
    const b = FASSADE.spalten * ZELLE;
    const h = FASSADE.reihen * REIHE;
    k.fillStyle = rgb(ton.wand);
    k.fillRect(0, 0, b, h);
    const dunkel = rgb(mix3(ton.wand, [8, 6, 30], 0.42));
    for (let r = 0; r < FASSADE.reihen; r += 1) {
      // Ein Gesims alle drei Reihen.
      if (r % 3 === 0) {
        k.fillStyle = rgba(mix3(ton.wand, [150, 130, 210], 0.5), 0.5);
        k.fillRect(0, r * REIHE + 2.4, b, 1);
      }
      for (let c = 0; c < FASSADE.spalten; c += 1) {
        const z = hash01(r * 17.7 + c * 5.3 + ton.wand[0]);
        const an = z < 0.3 - r * 0.008;
        const x = c * ZELLE + 4.5;
        const y = r * REIHE + 8;
        if (an) {
          k.fillStyle = z < 0.03 ? "rgb(150, 196, 255)" : rgb(WARM[Math.floor(z * 60) % 3]);
          k.fillRect(x, y, 7, 11);
          // Vorhang oder Fensterkreuz
          k.fillStyle = "rgba(60, 30, 40, 0.5)";
          if (z < 0.14) k.fillRect(x, y, 7, 3.4); else k.fillRect(x + 3.1, y, 0.9, 11);
        } else {
          k.fillStyle = dunkel;
          k.fillRect(x, y, 7, 11);
          k.fillStyle = "rgba(150, 160, 240, 0.16)";
          k.fillRect(x, y, 7, 2.2);
        }
        // Sims unter dem Fenster
        k.fillStyle = rgba(mix3(ton.wand, [150, 130, 210], 0.5), 0.6);
        k.fillRect(x - 1, y + 11, 9, 1);
      }
    }
    // Nach unten, zur Gasse hin, wird es dunkel.
    const tiefe = k.createLinearGradient(0, 0, 0, h);
    tiefe.addColorStop(0, "rgba(8, 6, 28, 0)");
    tiefe.addColorStop(0.45, "rgba(8, 6, 28, 0.42)");
    tiefe.addColorStop(1, "rgba(8, 6, 28, 0.92)");
    k.fillStyle = tiefe;
    k.fillRect(0, 0, b, h);
  }

  function ebenenNeu() {
    ebenen = {
      fern: kachel(FERN.b, FERN.h, maleFern),
      mittel: kachel(MITTEL.b, MITTEL.h, maleMittel),
      fassaden: TOENE.map((ton) => kachel(FASSADE.spalten * ZELLE, FASSADE.reihen * REIHE, (k) => maleFassade(k, ton))),
      zelle: Math.round(ZELLE * view.s * view.dpr),
    };
    himmelStand.m = -99;
  }

  // Einen Streifen quer übers Bild legen (in Bildpunkten), immer wieder.
  function legeStreifen(bild, versatz, y) {
    const bw = bild.width;
    for (let x = -(((Math.round(versatz) % bw) + bw) % bw); x < canvas.width; x += bw) g.drawImage(bild, x, y);
  }

  function zeichneStadt() {
    if (!ebenen) return;
    const s = view.s;
    const dpr = view.dpr;
    const W = view.cssW;
    const H = view.cssH;
    // Je näher, desto schneller zieht es vorbei – und desto mehr sinkt es,
    // wenn er höher kommt.
    const fernY = Math.round((view.boden + (26 + 0.1 * state.camY) * s) * dpr) - ebenen.fern.height;
    const mittelY = Math.round((view.boden + (4 + 0.3 * state.camY) * s) * dpr);
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalAlpha = 0.86;
    legeStreifen(ebenen.fern, state.camX * 0.1 * s * dpr, fernY);
    g.globalAlpha = 1;
    g.fillStyle = "rgb(58, 42, 104)";
    g.fillRect(0, fernY + ebenen.fern.height, canvas.width, Math.max(0, mittelY + ebenen.mittel.height - fernY - ebenen.fern.height));
    legeStreifen(ebenen.mittel, state.camX * 0.32 * s * dpr, mittelY);
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const unter = (mittelY + ebenen.mittel.height) / dpr;
    if (unter < H) {
      g.fillStyle = "rgb(20, 16, 54)";
      g.fillRect(0, unter - 0.5, W, H - unter + 1);
    }
  }

  // ---------------------------------------------------------------------------
  // Zeichnen: die Dächer der Strecke
  // ---------------------------------------------------------------------------
  // Was auf einem Dach steht – nur Bild, nichts davon steht im Weg. Gemalt
  // in den Massen der Welt, y nach unten, 0 ist die Dachkante.
  function maleDeko(art, kante, z) {
    const dunkel = "#1a1640";
    const licht = rgba(kante, 0.85);
    g.fillStyle = dunkel;
    if (art === 0) {
      // Kamin
      g.fillRect(-4, -15, 8, 15);
      g.fillRect(-5.2, -17.4, 10.4, 2.6);
      g.fillStyle = licht;
      g.fillRect(-5.2, -17.4, 10.4, 0.9);
      g.fillRect(3.1, -14.6, 0.9, 14.6);
    } else if (art === 1) {
      // Antenne
      g.fillRect(-0.5, -27, 1, 27);
      g.fillRect(-6.5, -25, 13, 0.9);
      g.fillRect(-4.5, -21, 9, 0.9);
      g.fillRect(-5.5, -17, 11, 0.9);
    } else if (art === 2) {
      // Der Aufgang mit der Tür, aus der Licht fällt
      g.fillRect(-11, -18, 22, 18);
      g.fillRect(-12.5, -20.4, 25, 2.6);
      g.fillStyle = rgb(WARM[Math.floor(z * 3) % 3]);
      g.fillRect(-6.5, -13, 6, 13);
      g.fillStyle = licht;
      g.fillRect(-12.5, -20.4, 25, 0.9);
      g.fillRect(10.1, -17.6, 0.9, 17.6);
    } else if (art === 3) {
      // Wassertank auf Beinen
      g.fillRect(-7, -9, 1.2, 9);
      g.fillRect(5.8, -9, 1.2, 9);
      g.fillRect(-9, -23, 18, 14.4);
      g.beginPath();
      g.moveTo(-9.6, -22.6);
      g.lineTo(0, -28);
      g.lineTo(9.6, -22.6);
      g.fill();
      g.fillStyle = licht;
      g.fillRect(8.1, -22.6, 0.9, 13.6);
      g.fillRect(-9, -16, 18, 0.6);
    } else if (art === 4) {
      // Wäscheleine
      g.fillRect(-19, -16, 1, 16);
      g.fillRect(18, -16, 1, 16);
      g.fillStyle = "rgba(226, 218, 255, 0.6)";
      g.fillRect(-18.5, -15.4, 37, 0.5);
      const weht = ruhig() ? 0 : Math.sin(state.zeit * 3.1 + z * 9) * 0.9;
      ["#f1ecff", "#ff8f6e", "#9fc4ff", "#f6d98a", "#f1ecff"].forEach((farbe, i) => {
        g.fillStyle = farbe;
        g.fillRect(-15 + i * 6.6 + weht * (i % 2 ? 0.5 : 0.3), -14.8, 4.2, 6 + (i % 3) * 1.4);
      });
    } else if (art === 5) {
      // Oberlicht: ein Glasdach, darunter brennt Licht
      g.fillStyle = rgb(WARM[Math.floor(z * 3) % 3]);
      g.beginPath();
      g.moveTo(-11, 0);
      g.lineTo(-7, -6.4);
      g.lineTo(7, -6.4);
      g.lineTo(11, 0);
      g.fill();
      g.fillStyle = dunkel;
      g.fillRect(-0.5, -6.4, 1, 6.4);
      g.fillRect(-4.8, -6.4, 0.9, 6.4);
      g.fillRect(3.9, -6.4, 0.9, 6.4);
      g.fillRect(-7.6, -7.2, 15.2, 1);
    } else {
      // Lichterkette
      g.fillRect(-21, -17, 1, 17);
      g.fillRect(20, -17, 1, 17);
      for (let i = 0; i < 8; i += 1) {
        const u = (i + 0.5) / 8;
        const blinkt = ruhig() ? 1 : 0.72 + 0.28 * Math.sin(state.zeit * 2.3 + i * 1.7 + z * 20);
        g.fillStyle = rgba(WARM[i % 3], blinkt);
        g.fillRect(-20 + u * 40 - 0.8, -16.4 + 6.2 * (1 - (2 * u - 1) ** 2), 1.7, 1.9);
      }
    }
  }

  // Ein Turm: schmal, aus Stein, mit einer Uhr unter dem Kranz – man sieht
  // von weitem, dass hier nur ein Tritt Platz ist.
  function zeichneTurm(r, X0, X1, Y, F) {
    const s = view.s;
    const breit = X1 - X0;
    const mitte = (X0 + X1) / 2;
    const stein = [58, 50, 104];
    g.fillStyle = rgb(stein);
    g.fillRect(X0, Y + 4 * s, breit, view.cssH - Y);
    // Lagen aus Quadern, nach unten wird es dunkel.
    g.fillStyle = "rgba(10, 8, 34, 0.3)";
    for (let q = 1; (4 + q * 15) * s < view.cssH - Y; q += 1) g.fillRect(X0, Y + (4 + q * 15) * s, breit, Math.max(1, 0.9 * s));
    g.fillStyle = "rgba(8, 6, 28, 0.36)";
    g.fillRect(X0, Y + 70 * s, breit, view.cssH - Y);
    g.fillStyle = "rgba(8, 6, 28, 0.42)";
    g.fillRect(X0, Y + 150 * s, breit, view.cssH - Y);
    // Die Seite zur Sonne ist hell, die andere im Schatten.
    g.fillStyle = rgba(F.kante, 0.34);
    g.fillRect(X1 - 1.8 * s, Y + 4 * s, 1.8 * s, view.cssH - Y);
    g.fillStyle = "rgba(6, 4, 22, 0.45)";
    g.fillRect(X0, Y + 4 * s, 2.2 * s, view.cssH - Y);
    // Die Uhr: ein helles Blatt, zwei Zeiger.
    const ur = Math.min(breit * 0.3, 10 * s);
    const uy = Y + 9 * s + ur + 4 * s;
    g.fillStyle = "#1a1640";
    g.beginPath();
    g.arc(mitte, uy, ur + 1.4 * s, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "#ffe9b8";
    g.beginPath();
    g.arc(mitte, uy, ur, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = "#2a1f4a";
    g.lineCap = "round";
    g.lineWidth = Math.max(1, 1.1 * s);
    const w = r.saat * Math.PI * 2;
    g.beginPath();
    g.moveTo(mitte, uy);
    g.lineTo(mitte + Math.sin(w) * ur * 0.8, uy - Math.cos(w) * ur * 0.8);
    g.moveTo(mitte, uy);
    g.lineTo(mitte + Math.sin(w * 12) * ur * 0.5, uy - Math.cos(w * 12) * ur * 0.5);
    g.stroke();
    // Darunter schmale Fenster, in einem brennt Licht.
    for (let f = 0; f < 3; f += 1) {
      const fy = uy + ur + (10 + f * 26) * s;
      g.fillStyle = f === Math.floor(r.saat * 3) % 3 ? rgb(WARM[f % 3]) : "rgb(24, 20, 60)";
      g.fillRect(mitte - 1.8 * s, fy, 3.6 * s, 9 * s);
    }
    // Der Kranz: eine Platte, die übersteht – und obenauf das letzte Licht.
    g.fillStyle = "#241d55";
    g.fillRect(X0 - 2 * s, Y, breit + 4 * s, 6 * s);
    g.fillStyle = "rgba(8, 6, 28, 0.5)";
    g.fillRect(X0, Y + 6 * s, breit, 1.6 * s);
    g.fillStyle = rgb(F.kante);
    g.fillRect(X0 - 2 * s, Y, breit + 4 * s, Math.max(1.5, 1.5 * s));
    g.fillStyle = "rgba(255, 255, 255, 0.55)";
    g.fillRect(X1 - 3 * s, Y, 5 * s, Math.max(1.5, 1.5 * s));
  }

  function zeichneDaecher(F) {
    if (!ebenen) return;
    const s = view.s;
    const dpr = view.dpr;
    const d = state.daecher;
    const zelle = ebenen.zelle;
    const kante = rgb(F.kante);
    for (let i = 0; i < d.length; i += 1) {
      const r = d[i];
      if (!Number.isFinite(r.x1)) break;
      const X0 = bildX(r.x0);
      const X1 = bildX(r.x1);
      if (X1 < -4) continue;
      if (X0 > view.cssW + 4) break;
      const Y = bildY(r.top);
      const ton = TOENE[r.ton];
      if (r.turm) {
        zeichneTurm(r, X0, X1, Y, F);
        continue;
      }
      // Die Fassade: ganze Fensterspalten aus der Kachel, Punkt auf Punkt;
      // was rechts übrig bleibt, ist Mauer.
      const kachelBild = ebenen.fassaden[r.ton];
      const px0 = Math.round(X0 * dpr);
      const py0 = Math.round((Y + 4.5 * s) * dpr);
      const spalten = Math.floor(((X1 - X0) * dpr - 3 * s * dpr) / zelle);
      const hoch = Math.min(kachelBild.height, canvas.height - py0);
      g.fillStyle = rgb(mix3(ton.wand, [8, 6, 28], 0.3));
      g.fillRect(X0, Y + 4 * s, X1 - X0, view.cssH - Y);
      if (hoch > 0) {
        g.setTransform(1, 0, 0, 1, 0, 0);
        let rest = spalten;
        let von = Math.floor(r.saat * FASSADE.spalten);
        let px = px0 + Math.round(1.5 * s * dpr);
        while (rest > 0) {
          const n = Math.min(rest, FASSADE.spalten - von);
          if (px + n * zelle > 0 && px < canvas.width) g.drawImage(kachelBild, von * zelle, 0, n * zelle, hoch, px, py0, n * zelle, hoch);
          px += n * zelle;
          rest -= n;
          von = 0;
        }
        g.setTransform(dpr, 0, 0, dpr, 0, 0);
        if (py0 + hoch < canvas.height) {
          g.fillStyle = "rgb(11, 9, 32)";
          g.fillRect(X0, (py0 + hoch) / dpr - 0.5, X1 - X0, view.cssH);
        }
      }
      // Die Seite zur Sonne ist hell, die andere im Schatten.
      g.fillStyle = rgba(F.kante, 0.3);
      g.fillRect(X1 - 1.6 * s, Y + 4 * s, 1.6 * s, view.cssH - Y);
      g.fillStyle = "rgba(6, 4, 22, 0.4)";
      g.fillRect(X0, Y + 4 * s, 2 * s, view.cssH - Y);

      // Was auf dem Dach steht.
      const breit = r.x1 - r.x0;
      const plaetze = Math.max(0, Math.min(4, Math.floor((breit - 44) / 52) + 1));
      for (let p = 0; p < plaetze && breit >= 60; p += 1) {
        const z = hash01(r.nr * 7.77 + p * 3.3 + 1.1);
        if (z < 0.18) continue;
        const wx = r.x0 + 30 + ((breit - 60) * (p + 0.5 * hash01(r.nr * 2.1 + p))) / Math.max(1, plaetze - 0.5);
        const sx = bildX(Math.min(wx, r.x1 - 26));
        if (sx < -40 * s || sx > view.cssW + 40 * s) continue;
        g.save();
        g.translate(sx, Y + 0.5);
        g.scale(s, s);
        maleDeko(Math.floor(z * 97) % 7, F.kante, z);
        g.restore();
      }

      // Das Dach selbst: eine Platte, vorn die Traufe – und obenauf das
      // letzte Licht.
      g.fillStyle = rgb(ton.dach);
      g.fillRect(X0, Y, X1 - X0, 5 * s);
      g.fillStyle = kante;
      g.fillRect(X0, Y, X1 - X0, Math.max(1.5, 1.5 * s));
      g.fillStyle = "rgba(255, 255, 255, 0.5)";
      g.fillRect(X1 - 5 * s, Y, 5 * s, Math.max(1.5, 1.5 * s));
    }
  }

  // ---------------------------------------------------------------------------
  // Zeichnen: der Bote
  // ---------------------------------------------------------------------------
  /*
   * Gemalt in den Massen der Welt, die Füsse bei (0, 0), y nach unten. Eine
   * dunkle Gestalt mit einem Saum aus Licht und einem roten Schal, der
   * hinter ihm herweht.
   *   pose   "steh", "lauf", "auf" (er steigt), "ab" (er fällt), "sturz"
   *   wahl   phase (der Schritt im Lauf), stauch, dreh, vy, geist, alpha
   */
  function zeichneBote(sx, sy, s, pose, wahl = {}) {
    const geist = wahl.geist || null;
    const still = ruhig();
    const t = still ? 0.9 : wahl.phase || 0;
    const zeit = still ? 0 : state.zeit;
    g.save();
    g.translate(sx, sy);
    if (wahl.dreh) {
      g.translate(0, -11 * s);
      g.rotate(wahl.dreh);
      g.translate(0, 11 * s);
    }
    g.scale(s, s);
    if (wahl.alpha !== undefined) g.globalAlpha = wahl.alpha;
    const stauch = (wahl.stauch || 0) * 2.4;
    const neig = pose === "lauf" ? 0.24 : pose === "auf" ? 0.12 : pose === "ab" ? 0.04 : pose === "sturz" ? -0.3 : 0.02;
    const hx = 0;
    const hy = -10.6 + stauch;
    const nx = hx + Math.sin(neig) * 8.6;
    const ny = hy - Math.cos(neig) * 8.6;
    // Beine: Winkel aus der Senkrechten (voraus positiv) und Knick im Knie.
    let b1;
    let b2;
    let a1;
    let a2;
    if (pose === "lauf") {
      b1 = [Math.sin(t) * 0.95, 0.3 + 0.95 * Math.max(0, Math.cos(t))];
      b2 = [-Math.sin(t) * 0.95, 0.3 + 0.95 * Math.max(0, -Math.cos(t))];
      a1 = [-Math.sin(t) * 1.05, 1.25];
      a2 = [Math.sin(t) * 1.05, 1.25];
    } else if (pose === "auf") {
      b1 = [1.15, 1.45];
      b2 = [-0.75, 0.55];
      a1 = [2.3, 0.5];
      a2 = [-1.0, 0.9];
    } else if (pose === "ab") {
      b1 = [0.75, 0.35];
      b2 = [0.1, 0.75];
      a1 = [2.7, 0.3];
      a2 = [-2.2, 0.4];
    } else if (pose === "sturz") {
      b1 = [0.9, 0.9];
      b2 = [-0.5, 1.1];
      a1 = [2.6, 0.4];
      a2 = [-2.4, 0.6];
    } else {
      b1 = [0.14, 0.06];
      b2 = [-0.14, 0.06];
      a1 = [0.12, 0.2];
      a2 = [-0.16, 0.2];
    }
    const glieder = () => {
      g.beginPath();
      [b1, b2].forEach(([a, knick]) => {
        const kx = hx + Math.sin(a) * 5.5;
        const ky = hy + Math.cos(a) * 5.5;
        g.moveTo(hx, hy);
        g.lineTo(kx, ky);
        g.lineTo(kx + Math.sin(a - knick) * 5.7, ky + Math.cos(a - knick) * 5.7 - (pose === "steh" || pose === "lauf" ? 0 : 0.4));
      });
      [a1, a2].forEach(([a, knick]) => {
        const ex = nx - 0.3 + Math.sin(a) * 4.3;
        const ey = ny + 1.6 + Math.cos(a) * 4.3;
        g.moveTo(nx - 0.3, ny + 1.6);
        g.lineTo(ex, ey);
        g.lineTo(ex + Math.sin(a + knick) * 4.1, ey + Math.cos(a + knick) * 4.1);
      });
    };
    g.lineCap = "round";
    g.lineJoin = "round";

    // Der Schal: zwei Zipfel, die hinter ihm herwehen – im Steigen nach
    // unten, im Fallen nach oben.
    const zug = pose === "steh" ? 0.45 : 1;
    const steil = clamp((wahl.vy || 0) / 520, -0.9, 0.9);
    g.strokeStyle = geist || "#ff5436";
    [[0, 15, 2.5], [1.7, 11, 1.9]].forEach(([versatz, lang, dick], nr) => {
      g.lineWidth = dick;
      g.beginPath();
      g.moveTo(nx - 0.6, ny + 1 + versatz * 0.4);
      for (let i = 1; i <= 4; i += 1) {
        const u = i / 4;
        g.lineTo(
          nx - 0.6 - u * lang * zug,
          ny + 1 + versatz + u * lang * steil * 0.7 + Math.sin(zeit * 13 + i * 1.3 + nr * 2) * 1.5 * u + (1 - zug) * u * 8,
        );
      }
      g.stroke();
    });

    // Der Saum aus Licht (von der Sonne her), dann die Gestalt selbst.
    if (!geist) {
      g.strokeStyle = wahl.saum || "rgba(255, 214, 160, 0.9)";
      g.lineWidth = 4.3;
      glieder();
      g.moveTo(hx, hy);
      g.lineTo(nx, ny);
      g.stroke();
      g.fillStyle = g.strokeStyle;
      g.beginPath();
      g.arc(nx + 1.5, ny - 3.3, 3.9, 0, Math.PI * 2);
      g.fill();
    }
    const dunkel = geist || "#15102f";
    g.strokeStyle = dunkel;
    g.fillStyle = dunkel;
    g.lineWidth = 2.7;
    glieder();
    g.stroke();
    g.lineWidth = 5;
    g.beginPath();
    g.moveTo(hx, hy);
    g.lineTo(nx, ny);
    g.stroke();
    // Die Tasche des Boten, der Kopf mit der Mütze.
    g.fillRect(hx - 4.6, hy - 4.2, 4.4, 4.8);
    g.beginPath();
    g.arc(nx + 1.5, ny - 3.3, 3.2, 0, Math.PI * 2);
    g.fill();
    if (!geist) {
      g.fillStyle = "#ff5436";
      g.beginPath();
      g.arc(nx + 1.5, ny - 3.6, 3.3, Math.PI * 1.02, Math.PI * 1.98);
      g.fill();
      g.fillRect(nx + 3.4, ny - 4.3, 3, 1.1);
      // Der Schal um den Hals.
      g.strokeStyle = "#ff5436";
      g.lineWidth = 2.4;
      g.beginPath();
      g.moveTo(nx - 1.4, ny + 0.4);
      g.lineTo(nx + 2.2, ny + 0.2);
      g.stroke();
    }
    g.restore();
  }

  // Etwas grösser gemalt, als er misst: So ist er auch auf dem Handy gut zu sehen.
  // Hochkant ist die Welt klein im Bild (440 Einheiten auf die Breite): Dort
  // wird der Bote grösser gemalt, damit er auf dem Handy nicht verschwindet.
  // Gerechnet wird mit seinen Füssen, nicht mit seiner Grösse im Bild.
  const gross = () => lerp(1.3, 1.8, view.f);
  const poseVon = (k) => (k.boden ? (state.schritt === "start" ? "steh" : "lauf") : (k.traegt || k.vy > 0 ? "auf" : "ab"));

  function zeichneFigur(F) {
    const k = state.lf;
    const sx = bildX(k.x);
    const sy = bildY(k.y);
    const saum = rgba(F.kante, 0.9);
    if (state.schritt === "sturz" && state.sturz) {
      zeichneBote(sx, sy, view.s * gross(), "sturz", { dreh: state.sturz.dreh, vy: state.sturz.vy, saum });
      return;
    }
    zeichneBote(sx, sy, view.s * gross(), poseVon(k), { phase: k.lauf / 7.4, stauch: state.stauch, vy: k.boden ? 0 : (k.traegt ? V_AUF : k.vy), saum });
  }

  // Die Gegner als Geist (geist.js): ein Bote aus Licht.
  function zeichneGeister() {
    if (!gegner || state.phase === "bereit") return;
    const orte = window.LernappGeist?.orte?.(gegner) || [];
    if (!orte.length) return;
    const namen = [];
    orte.forEach((o) => {
      if (o.ziel) return;
      const sx = bildX(o.a);
      const sy = bildY(o.b);
      if (sx < -40 || sx > view.cssW + 40) return;
      const wie = o.c & 3;
      zeichneBote(sx, sy, view.s * gross(), wie === 3 ? "ab" : wie === 2 ? "auf" : wie === 1 ? "lauf" : "steh", { geist: o.farbe, alpha: 0.6 * o.blass, phase: o.a / 7.4, vy: wie === 2 ? 200 : wie === 3 ? -200 : 0 });
      const dx = o.a - state.lf.x;
      namen.push({ ...o, sx, sy: sy - 30 * view.s, weit: `${dx > 0 ? "+" : ""}${Math.round(dx / METER)} m` });
    });
    window.LernappGeist.namen(g, namen, { breit: view.cssW, hoch: view.cssH });
  }

  // ---------------------------------------------------------------------------
  // Zeichnen: Staub, Funken, Fahrtwind, Schrift
  // ---------------------------------------------------------------------------
  function zeichneTeile() {
    if (!state.teile.length) return;
    state.teile.forEach((t) => {
      const k = clamp(t.leben / t.max, 0, 1);
      g.globalAlpha = t.art === "staub" ? k * 0.5 : k;
      g.fillStyle = t.art === "staub" ? "#e9defc" : "#ffe9a3";
      const r = Math.max(0.6, t.r * view.s * (t.art === "staub" ? 1.5 - 0.5 * k : k));
      g.fillRect(bildX(t.x) - r, bildY(t.y) - r, 2 * r, 2 * r);
    });
    g.globalAlpha = 1;
  }

  // Der Fahrtwind: ein paar Striche, je schneller, desto mehr.
  function zeichneWind() {
    if (ruhig() || state.schritt !== "lauf") return;
    const k = clamp((tempoBei(state.lf.x) - TEMPO0) / (TEMPO_MAX - TEMPO0), 0, 1);
    const n = Math.round(3 + k * 7);
    g.fillStyle = "#ffffff";
    for (let i = 0; i < n; i += 1) {
      const lauf = (state.zeit * (1.1 + hash01(i * 3.3) * 0.9) + hash01(i * 7.1)) % 1;
      const lang = (26 + 60 * k) * view.s * (0.6 + hash01(i * 1.7));
      g.globalAlpha = (0.05 + 0.1 * k) * Math.sin(lauf * Math.PI);
      g.fillRect(view.cssW * (1.1 - lauf * 1.3), view.boden - (150 * hash01(i * 5.9 + 2) - 18) * view.s, lang, Math.max(1, view.s));
    }
    g.globalAlpha = 1;
  }

  function zeichneSchriften() {
    if (!state.schriften.length) return;
    const k0 = state.lf;
    g.textAlign = "center";
    g.textBaseline = "middle";
    state.schriften.forEach((t) => {
      const k = clamp(t.leben / t.max, 0, 1);
      const gross = Math.round(clamp(t.gross * view.s * 0.5, 13, 26));
      g.font = `900 ${gross}px system-ui, sans-serif`;
      const halb = g.measureText(t.text).width / 2 + 8;
      const x = clamp(bildX(k0.x) + 10 * view.s, halb, view.cssW - halb);
      const y = Math.max(view.frei + gross, bildY(Math.max(k0.y, state.camY)) - (44 + (1 - k) * 12) * view.s);
      g.globalAlpha = Math.min(1, k * 2.4);
      g.lineWidth = Math.max(3, gross * 0.22);
      g.strokeStyle = "rgba(16, 10, 40, 0.9)";
      g.strokeText(t.text, x, y);
      g.fillStyle = t.farbe;
      g.fillText(t.text, x, y);
    });
    g.globalAlpha = 1;
  }

  function zeichnen() {
    if (!g || !ebenen) return;
    const wackel = ruhig() ? 0 : Math.sin(state.zeit * 64) * 4 * state.stoss;
    g.globalAlpha = 1;
    const m = meterBei(state.camX + view.vorn);
    const F = himmelBei(m);
    zeichneHimmel(F, m);
    zeichneStadt();
    g.setTransform(view.dpr, 0, 0, view.dpr, 0, Math.round(wackel * view.dpr));
    zeichneDaecher(F);
    zeichneGeister();
    zeichneFigur(F);
    zeichneTeile();
    zeichneWind();
    zeichneSchriften();
  }

  // ---------------------------------------------------------------------------
  // Was aufstiebt
  // ---------------------------------------------------------------------------
  function teile(art, x, y, n, kraft) {
    if (ruhig()) return;
    for (let i = 0; i < n; i += 1) {
      const w = Math.random() * Math.PI;
      const v = (10 + Math.random() * 30) * kraft;
      const leben = 0.3 + Math.random() * 0.4;
      state.teile.push({
        art, x, y, vx: Math.cos(w) * v + (art === "staub" ? tempoBei(x) * 0.55 : tempoBei(x) * 0.8), vy: Math.sin(w) * v * (art === "staub" ? 0.5 : 1.3),
        r: art === "staub" ? 1.2 + Math.random() * 1.3 : 0.7 + Math.random() * 0.5, leben, max: leben,
      });
    }
    if (state.teile.length > 90) state.teile.splice(0, state.teile.length - 90);
  }

  function schrift(text, farbe, gross) {
    state.schriften = [{ text, farbe, gross, leben: 0.75, max: 0.75 }];
  }

  // ---------------------------------------------------------------------------
  // Springen, landen, stürzen
  // ---------------------------------------------------------------------------
  function perfekt(text) {
    state.perfekte += 1;
    state.reihe += 1;
    klang()?.ton?.("dachlaeufer.perfekt", { hoehe: 1 + Math.min(8, state.reihe - 1) * 0.04 });
    schrift(text, "#ffe08a", 40);
    teile("funke", state.lf.x, state.lf.y + 2, 8, 1);
    kids()?.vibrate?.(10);
  }

  function absprung() {
    const k = state.lf;
    const r = state.daecher[k.dach];
    const knapp = state.phase === "spiel" && r.x1 - k.x <= KNAPP;
    k.boden = false;
    k.traegt = true;
    k.halt = 0;
    k.vy = 0;
    k.gesprungen = true;
    k.ab = k.dach;
    k.vorn = k.dach;
    state.puffer = 0;
    state.spruenge += 1;
    klang()?.ton?.("dachlaeufer.sprung", { hoehe: 0.94 + Math.min(8, state.reihe) * 0.03 });
    teile("staub", k.x - 2, k.y + 1, 4, 0.7);
    if (knapp) perfekt("Kante!"); else state.reihe = 0;
  }

  function landen(nr) {
    const k = state.lf;
    const r = state.daecher[nr];
    const neu = nr !== k.dach;
    k.boden = true;
    k.traegt = false;
    k.dach = nr;
    k.y = r.top;
    k.vy = 0;
    state.stauch = 1;
    planBis(k.x + 2400);
    klang()?.ton?.("dachlaeufer.landung");
    teile("staub", k.x, k.y + 1, 5, 0.8);
    // Gleich hinter der Kante aufgesetzt: knapp – und gut.
    if (state.phase === "spiel" && neu && k.gesprungen && k.x - r.x0 <= KNAPP) perfekt("Knapp!");
    // Ein Druck kurz vor dem Aufsetzen gilt jetzt.
    if (state.puffer > 0 && state.phase === "spiel") absprung();
  }

  function sturz(warum, nurBild = false, wand = false) {
    if (state.schritt === "sturz") return;
    const k = state.lf;
    state.schritt = "sturz";
    state.sturz = wand
      ? { warum, vx: -46 - Math.random() * 20, vy: 120, dreh: 0, drehV: -6 - Math.random() * 3 }
      : { warum, vx: warum === "ende" ? 30 : tempoBei(k.x) * 0.45, vy: Math.min(k.vy, 60), dreh: 0, drehV: 4.5 };
    state.stoss = wand ? 1 : 0.45;
    state.puffer = 0;
    klangAus();
    if (wand) klang()?.ton?.("dachlaeufer.prall");
    klang()?.ton?.("dachlaeufer.fall", { verzoegerung: wand ? 0.1 : 0 });
    kids()?.vibrate?.([30, 40, 60]);
    if (wand) teile("staub", k.x, k.y, 12, 1.3);
    if (nurBild) return;
    stepTimer = window.setTimeout(finish, ruhig() ? 500 : STURZ_MS);
  }

  function sturzTakt(dt) {
    const f = state.sturz;
    const k = state.lf;
    if (!f) return;
    f.vy -= 1100 * dt;
    k.x += f.vx * dt;
    k.y += f.vy * dt;
    f.dreh += f.drehV * dt;
  }

  function physik(dt) {
    const k = state.lf;
    const d = state.daecher;
    const n = Math.max(1, Math.ceil(dt / TAKT - 1e-9));
    const h = dt / n;
    for (let i = 0; i < n; i += 1) {
      if (state.schritt === "sturz") return;
      if (state.puffer > 0) state.puffer -= h;
      if (k.boden) {
        const weg = tempoBei(k.x) * h;
        k.x += weg;
        k.lauf += weg;
        // Über die Kante gerannt, ohne zu springen: Er fällt.
        if (k.x > d[k.dach].x1) {
          k.boden = false;
          k.traegt = false;
          k.vy = 0;
          k.gesprungen = false;
          k.ab = k.dach;
          k.vorn = k.dach;
        }
      } else {
        const xa = k.x;
        const ya = k.y;
        luftSchritt(k, h, state.gedrueckt ? HALT_MAX : Math.max(HALT_MIN, k.halt));
        while (d[k.vorn].x1 < xa) k.vorn += 1;
        const r = d[k.vorn];
        const warum = !k.gesprungen ? "luecke" : k.vorn - k.ab >= 2 ? "weit" : "kurz";
        if (xa < r.x0 && k.x >= r.x0) {
          // An der Kante des nächsten Dachs: darüber – oder an die Wand.
          const yK = ya + (k.y - ya) * ((r.x0 - xa) / (k.x - xa));
          if (yK < r.top) {
            k.x = r.x0 - 1.5;
            k.y = yK;
            sturz(warum, false, true);
            return;
          }
        }
        if (k.x >= r.x0 && k.x <= r.x1) {
          if (!k.traegt && k.vy <= 0 && k.y <= r.top) landen(k.vorn);
        } else if (k.x < r.x0 && k.y < Math.min(d[Math.max(0, k.vorn - 1)].top, r.top) - TIEF) {
          sturz(warum);
          return;
        }
      }
      const meter = Math.floor(meterBei(k.x));
      if (meter !== state.punkte) {
        state.punkte = meter;
        shell.setCount(meter);
      }
    }
  }

  // Drücken und Loslassen gelten zu der Zeit, zu der sie geschahen (jetzt,
  // wie performance.now): Die Rechnung läuft bis dorthin voraus, das nächste
  // Bild rechnet nur noch den Rest.
  function vorholen(jetzt) {
    if (!Number.isFinite(jetzt) || !last) return;
    const mehr = clamp((jetzt - last) / 1000 - voraus, 0, 0.05);
    if (mehr > 0) {
      physik(mehr);
      voraus += mehr;
    }
  }

  function druecken(jetzt) {
    if (state.phase === "zuschauen" || state.phase === "ende") return;
    state.gedrueckt = true;
    // Der erste Druck: Er rennt los.
    if (state.phase === "bereit") {
      losGehts();
      return;
    }
    if (state.phase !== "spiel" || state.schritt === "sturz") return;
    vorholen(jetzt);
    if (state.schritt === "sturz") return;
    if (state.lf.boden) absprung(); else state.puffer = PUFFER;
  }

  function loslassen(jetzt) {
    if (!state.gedrueckt) return;
    if (state.phase === "spiel" && state.schritt !== "sturz") vorholen(jetzt);
    state.gedrueckt = false;
  }

  // ---------------------------------------------------------------------------
  // Zuschauen
  // ---------------------------------------------------------------------------
  function zuschauenStarten() {
    if (!zuschauer?.lauf) return;
    startRun();
    state.phase = "zuschauen";
    state.schritt = "lauf";
    shell.setPhase("play");
    zuschauer.los();
    klangAn();
  }

  function zuschauenTakt(dt) {
    const s = zuschauer.stand();
    if (!s) return;
    const k = state.lf;
    if (state.schritt !== "sturz") {
      const wie = s.c & 3;
      const vorher = k.boden;
      k.lauf += Math.max(0, s.a - k.x);
      k.x = s.a;
      k.y = s.b;
      k.boden = wie <= 1;
      k.traegt = false;
      k.vy = wie === 2 ? 200 : wie === 3 ? -200 : 0;
      state.schritt = wie === 0 ? "start" : "lauf";
      if (!vorher && k.boden) { state.stauch = 1; teile("staub", k.x, k.y + 1, 4, 0.7); }
      const punkte = Math.max(0, Math.floor(s.punkte));
      if (punkte !== state.punkte) {
        state.punkte = punkte;
        shell.setCount(punkte);
      }
      klangStellen();
    }
    if (!zuschauer.weiter() && state.schritt !== "sturz") sturz("ende", true);
    if (state.schritt === "sturz") sturzTakt(dt);
  }

  // ---------------------------------------------------------------------------
  // Der Takt
  // ---------------------------------------------------------------------------
  function takt(dt, strecke = dt) {
    state.zeit += dt;
    const k = state.lf;
    if (state.stoss > 0) state.stoss = Math.max(0, state.stoss - dt * 3.2);
    if (state.stauch > 0) state.stauch = Math.max(0, state.stauch - dt * 8);

    if (state.phase === "zuschauen") {
      zuschauenTakt(dt);
    } else if (state.schritt === "sturz") {
      sturzTakt(dt);
    } else if (state.phase === "spiel") {
      if (strecke > 0) physik(strecke);
      klangStellen();
    }

    for (let i = state.teile.length - 1; i >= 0; i -= 1) {
      const t = state.teile[i];
      t.vy -= (t.art === "staub" ? 40 : 300) * dt;
      t.vx *= 1 - 2.4 * dt;
      t.x += t.vx * dt;
      t.y += t.vy * dt;
      t.leben -= dt;
      if (t.leben <= 0) state.teile.splice(i, 1);
    }
    for (let i = state.schriften.length - 1; i >= 0; i -= 1) {
      state.schriften[i].leben -= dt;
      if (state.schriften[i].leben <= 0) state.schriften.splice(i, 1);
    }

    // Die Kamera: voraus fest an ihm, in der Höhe weich dem Dach nach, auf
    // dem er steht oder das vor ihm liegt. Beim Sturz bleibt sie stehen.
    if (state.schritt !== "sturz") {
      state.camX = k.x - view.vorn;
      planBis(state.camX + view.w + 1200);
      const d = state.daecher;
      let nr = k.boden ? k.dach : k.vorn;
      if (!k.boden && d[nr].x1 < k.x && d[nr + 1]) nr += 1;
      const ziel = d[nr].top;
      state.camY += (ziel - state.camY) * (1 - Math.exp(-(state.phase === "bereit" ? 30 : 3.4) * dt));
    }

    if (state.phase === "spiel" && state.schritt !== "sturz") {
      const wie = state.schritt === "start" ? 0 : k.boden ? 1 : (k.traegt || k.vy > 0 ? 2 : 3);
      gegner?.takt(state.punkte, { a: Math.round(k.x), b: Math.round(k.y), c: wie });
    }
  }

  function loop(now) {
    frame = window.requestAnimationFrame(loop);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const strecke = Math.max(0, dt - voraus);
    voraus = 0;
    messen();
    takt(dt, strecke);
    zeichnen();
  }

  // Die Runde beginnt: mit dem ersten Druck – oder im Live-Modus zum
  // gemeinsamen Start. Er rennt los; bis zur ersten Lücke bleibt gut eine
  // Sekunde.
  function losGehts() {
    if (state.phase !== "bereit") return;
    state.phase = "spiel";
    state.schritt = "lauf";
    shell.setPhase("play");
    gegner?.los();
    klangAn();
    kids()?.vibrate?.(8);
  }

  // ---------------------------------------------------------------------------
  // Ablauf
  // ---------------------------------------------------------------------------
  function startRun() {
    clearStep();
    stopLoop();
    klangAus();
    shell.closeOverlay();
    zufall.neu();
    shell.setPhase("intro");
    state.phase = "bereit";
    state.schritt = "start";
    state.punkte = 0;
    state.spruenge = 0;
    state.perfekte = 0;
    state.reihe = 0;
    state.lf = { x: 0, y: START_HOCH, vy: 0, boden: true, dach: 0, halt: 0, traegt: false, gesprungen: false, ab: 0, vorn: 0, lauf: 0 };
    state.gedrueckt = false;
    state.puffer = 0;
    state.sturz = null;
    state.teile = [];
    state.schriften = [];
    state.zeit = 0;
    state.stoss = 0;
    state.stauch = 0;
    streckeNeu();
    voraus = 0;
    shell.setCount(0);
    gegner?.runde();

    shell.clear();
    const prompt = shell.el("p", "cm-prompt dl-prompt", "Halten springt – länger halten, weiter springen.");
    shell.play.append(prompt, buildPlatz());
    view.cssW = 0;
    view.cssH = 0;
    messen();
    state.camX = -view.vorn;
    state.camY = START_HOCH;

    last = performance.now();
    frame = window.requestAnimationFrame(loop);
  }

  function zaehleHoch(ziel) {
    const zahl = host.querySelector(".cm-result-score");
    if (!zahl) return;
    if (ruhig() || ziel <= 1) { zahl.textContent = String(ziel); return; }
    const dauer = Math.min(800, 160 + ziel * 4);
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

  const WARUM = { kurz: "Zu kurz gesprungen", weit: "Zu weit gesprungen", luecke: "In die Lücke gefallen" };

  function finish() {
    clearStep();
    stopLoop();
    klangAus();
    if (state.phase === "ende") return;
    state.phase = "ende";
    const punkte = state.punkte;
    const geist = gegner?.ende(punkte) || null;
    const vorher = Number(store.read()?.scores?.[0]) || 0;
    const rekord = punkte > vorher;
    store.update((old) => ({
      runs: (Number(old.runs) || 0) + 1,
      scores: [...(old.scores || []), punkte].sort((x, y) => y - x).slice(0, TOP_COUNT),
    }));
    const spruenge = `${state.spruenge} ${state.spruenge === 1 ? "Sprung" : "Sprünge"}`;
    const warum = WARUM[state.sturz?.warum] || "";
    shell.showResult({
      label: "Deine Meter",
      points: punkte,
      detail: rekord ? "Neuer Rekord!" : `${warum ? `${warum} · ` : ""}${spruenge} · ${state.perfekte} perfekt`,
      geist,
    });
    if (rekord) host.querySelector(".cm-result-detail")?.classList.add("dl-rekord");
    zaehleHoch(punkte);
  }

  // ---------------------------------------------------------------------------
  // Start
  // ---------------------------------------------------------------------------
  shell = shellApi.mount({
    host,
    title: "Dachläufer",
    area: "geschwindigkeit",
    accent: "#F5A623",
    accentDark: "#b9741a",
    clock: false,
    onRestart: () => (zuschauer ? zuschauenStarten() : startRun()),
    live: { los: losGehts, stopp: () => finish(), zuschauen: (quelle) => { zuschauer = quelle; zuschauenStarten(); }, halten: true },
  });
  zuschauer = window.LernappGeist?.zuschauer?.({
    host, spiel: "roofRun", fassung: "t2", zufall, einheit: "m", nochmal: zuschauenStarten,
  }) || null;
  if (!zuschauer) {
    gegner = window.LernappGeist?.fuer?.({ spiel: "roofRun", host, art: "tempo", fassung: "t2", alle: true, zufall }) || null;
  }

  startRun();
  zuschauer?.laden.then((da) => { if (da) zuschauenStarten(); });

  // Drücken irgendwo aufs Bild: Er springt, solange der Finger liegt. Nur
  // Knöpfe bleiben Knöpfe.
  const zeitVon = (event) => (Math.abs(performance.now() - event.timeStamp) < 250 ? event.timeStamp : performance.now());
  host.addEventListener("pointerdown", (event) => {
    if (event.target.closest("button, a, input")) return;
    druecken(zeitVon(event));
  });
  window.addEventListener("pointerup", (event) => loslassen(zeitVon(event)));
  window.addEventListener("pointercancel", (event) => loslassen(zeitVon(event)));
  // Wer das Fenster verlässt, lässt auch los.
  window.addEventListener("blur", () => loslassen(performance.now()));

  const TASTEN = new Set([" ", "Enter", "ArrowUp"]);
  document.addEventListener("keydown", (event) => {
    if (!TASTEN.has(event.key)) return;
    if (document.activeElement?.tagName === "BUTTON") return;
    event.preventDefault();
    if (event.repeat) return;
    druecken(performance.now());
  });
  document.addEventListener("keyup", (event) => {
    if (!TASTEN.has(event.key)) return;
    loslassen(performance.now());
  });

  window.addEventListener("resize", messen);
  window.addEventListener("orientationchange", messen);
  window.addEventListener("pagehide", () => { clearStep(); stopLoop(); klangAus(); });

  // Für die Prüfskripte und die Vorführung.
  window.LernappDachlaeufer = {
    METER, V_AUF, G, HALT_MIN, HALT_MAX, KNAPP, LUFT0, LUFT_MIN, START_HOCH, state, view,
    takt, druecken, loslassen, losGehts, physik, planBis, kursText, lande, haltFuer, tempoBei, luftBei, turmBei, TURM_AB,
  };
})();
