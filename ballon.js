/*
 * ballon.js – Windschichten.
 * ---------------------------------------------------------------------------
 * Ein Heissluftballon hat keinen Motor. Wer den Finger aufs Bild legt, zündet
 * den Brenner: Die Hülle wird heiss, und – ein wenig träge – steigt er. Wer
 * loslässt, lässt sie abkühlen, und er sinkt. Mehr kann der Ballon nicht.
 * Seitwärts treibt ihn allein der Wind, und der weht in jeder Höhe anders.
 *
 * Der Himmel ist in Schichten geteilt, drei bis fünf übereinander: Manche
 * wehen nach Osten (rechts, dorthin will man), manche nach Westen (zurück),
 * manche nur schwach. Gold leuchtet, was nach Osten trägt, blau, was zurück
 * drückt; Windstreifen und Wolkenfetzen ziehen mit ihrer Schicht, und am
 * rechten Rand zeigen Pfeile, wie es voraus weht. Die Schichten wechseln
 * entlang der Strecke, und ihre Grenzen wogen langsam auf und ab. Wer gut
 * fährt, liest voraus («dort oben weht es nach rechts») und steigt oder sinkt
 * rechtzeitig – die Hülle braucht ihre Zeit, bis sie heiss oder kalt ist.
 *
 * Von Westen zieht eine Gewitterfront nach. Wer zu lange im falschen Wind
 * hängt, den holt sie ein. Dazu Berge unten, die Gewitterdecke oben und
 * Gewitterzellen in manchen Schichten – am liebsten in den schnellen: Dort
 * kommt man flott voran, muss den Zellen aber ausweichen. Eine Berührung,
 * und die Hülle reisst. Gezählt wird, wie weit der Ballon nach Osten kommt,
 * in Metern.
 *
 * Die Welt kommt aus dem Zufall (zufall.js): ohne Turnier jedes Mal eine
 * andere, im Turnier für alle im selben Versuch dieselbe. Sie ist in
 * Abschnitte geteilt. Jeder hat eine gute Schicht, die schneller nach Osten
 * weht, als die Front nachzieht, und die sich mit der guten Schicht des
 * nächsten Abschnitts überlappt – wer dort ist, wenn der Wind wechselt,
 * fährt ohne Halt weiter. Wie weit die gute Schicht springt und wie lang ein
 * Abschnitt ist, richtet sich danach, wie schnell der Ballon steigen und
 * sinken kann. Berge bleiben unter der guten Schicht, Gewitterzellen mit
 * Abstand ausserhalb: Es gibt immer einen Weg nach Osten. Nach hinten werden
 * die guten Schichten schmaler, die Gegenwinde stärker, die Front schneller.
 *
 * Mit der Strecke vergeht der Tag: Morgenrot, heller Mittag, Abendrot und
 * eine Nacht mit Mond und Sternen, in der die Hülle vom Brenner leuchtet.
 *
 * Die Gegner (geist.js) fahren als farbige Ballone aus Licht mit – genau so,
 * wie sie in ihrer besten Runde gefahren sind, durch ihre eigene Welt (a: wie
 * weit nach Osten, b: die Höhe, beides in Welteinheiten; c: ob der Brenner
 * brannte, ab 100, und wie heiss die Hülle war, 0 bis 99). Platz 1 und die
 * eigene Bestmarke stehen als Fahne bei ihren Metern im Gelände. Und die
 * besten Fahrten lassen sich anschauen (?zuschauen=, geist.js): durch ihre
 * eigene Welt, gewürfelt mit derselben Saat, mit derselben Flamme – im
 * Multiplayer genauso die Fahrt dessen, dem man zuschaut.
 *
 * Gerechnet wird in Welteinheiten – zehn sind ein Meter, y zählt nach oben,
 * 0 ist der Talgrund. Die ganze Höhe vom Tal bis unter die Gewitterdecke
 * steht immer im Bild; im Hochformat steht darunter mehr Gebirge.
 */
(() => {
  "use strict";

  if (document.body.dataset.page !== "balloon") return;

  const host = document.querySelector("#bl-stage");
  const shellApi = window.LernappGameShell;
  const cloudApi = window.LernappGameCloud;
  if (!host || !shellApi) return;

  const kids = () => window.LernappKids || null;
  const ruhig = () => Boolean(kids()?.prefersReducedMotion?.());

  // Der Zufall. Ohne Turnier in der Adresse ist das Math.random; in einem
  // Turnier bekommt jeder im selben Versuch dieselbe Welt. Nur die Welt zieht
  // daraus, immer in derselben Reihenfolge – Blitze, Regen, Funken und
  // Windstreifen würfeln Math.random oder hängen an einer festen Zahl, damit
  // die Welt nicht davon abhängt, wie jemand fährt.
  const zufall = window.LernappZufall?.fuer?.("balloonRide") || { neu() {}, zahl: () => Math.random() };

  // ---------------------------------------------------------------------------
  // Die Welt
  // ---------------------------------------------------------------------------
  const DECKE = 392;               // Unterkante der Gewitterdecke, im Mittel
  const TAL = 6;                   // tiefer geht kein Tal – dort liegt ein See
  const METER = 10;
  const SEG = 12;                  // Abstand der Stützpunkte des Geländes
  const VORLAUF = 1200;            // so viel Welt liegt hinter dem Start
  const VORAUS = 520;              // so weit voraus stehen die Abschnitte fest
  const START = { x: 0, y: 150 };
  const AN_VORN = 0.2;             // so weit vom linken Rand fährt der Ballon, wenn ihn der Wind trägt …
  const AN_HINTEN = 0.42;          // … und so weit, wenn er zurücktreibt
  const WELT_W = 380;
  const WELT_W_MAX = 760;
  const SICHT_UNTEN = -4;          // so viel muss immer im Bild stehen …
  const SICHT_OBEN = DECKE + 36;   // … vom Talgrund bis in die Decke
  const SICHT_H = SICHT_OBEN - SICHT_UNTEN;

  // Die Fahrt. Die Wärme der Hülle (0 kalt … 1 heiss) folgt dem Brenner
  // gleichmässig; daraus folgt der Auftrieb, und der Luftwiderstand bremst.
  // Bei halber Wärme schwebt der Ballon. Seitwärts nimmt ihn der Wind seiner
  // Höhe mit, nicht sofort, aber bald (MITNAHME).
  const AUF = 280;                 // Auftrieb bei heisser (Abtrieb bei kalter) Hülle
  const DAEMPF = 2.4;              // Luftwiderstand, senkrecht
  const VT = AUF / DAEMPF;         // schneller steigt oder sinkt er nie
  const HEIZ = 1.8;                // so schnell wird die Hülle heiss (je Sekunde)
  const KUEHL = 1.2;               // so schnell kühlt sie ab
  const MITNAHME = 1.7;            // so schnell nimmt ihn der Wind mit
  const TAKT = 1 / 240;            // gerechnet wird in festen kleinen Schritten
  // Der Wind greift an der Mitte der Hülle an, MESS über dem Brenner. Von
  // dort reicht der Ballon OBEN_RAND hinauf und UNTEN_RAND hinab (Korb).
  const MESS = 14;
  const OBEN_RAND = 20;
  const UNTEN_RAND = 31;

  // Das Grundtempo des Windes, nach der Strecke: Daran messen sich alle
  // Schichten und die Front.
  const V0 = 64;
  const V_MAX = 150;
  const V_WEG = 700;               // Meter, nach denen gut sechs Zehntel des Zuwachses da sind

  // Die Gewitterfront zieht mit einem Teil des Grundtempos – anfangs gut der
  // Hälfte, nach hinten fast so schnell wie die gute Schicht. Weiter als
  // FRONT_MAX fällt sie nie zurück.
  const FRONT_F0 = 0.5;
  const FRONT_F1 = 0.92;
  const FRONT_START = 540;
  const FRONT_MAX = 600;

  // Die Schichten
  const UEBER = 150;               // so lang ist der Übergang zwischen zwei Abschnitten
  const SCHERUNG = 18;             // so dick ist die Grenze zwischen zwei Schichten
  const GUT_UNTEN = 64;            // so tief liegt eine gute Schicht höchstens …
  const GUT_OBEN = DECKE - 46;     // … und so hoch
  const GRENZE_MIN = 46;           // so dünn wird keine andere Schicht
  const SCHNELL_AB = 90;           // Meter: ab hier gibt es schnelle Schichten …
  const STURM_AB = 170;            // … und ab hier Gewitter darin
  const START_FLACH = 320;         // bis hier ist das Gelände eine Wiese
  const LUECKE_MIN = 3;            // so nah kommt kein Berg an die gute Schicht

  // Die Hülle von der Seite, rechte Hälfte, von oben nach unten – im Bild
  // gezeichnet (y nach unten), um den Ballon herum: der Mund bei y = 1, der
  // Korb von 9 bis 17. Dieselben Masse prüft pruefen().
  const PROFIL = (() => {
    const raus = [];
    for (let n = 0; n <= 7; n += 1) {
      const w = (n / 7) * (Math.PI / 2);
      raus.push({ y: -15 - 18 * Math.cos(w), b: 17.5 * Math.sin(w) });
    }
    for (let n = 1; n <= 7; n += 1) {
      const u = n / 7;
      raus.push({ y: -15 + 16 * u, b: 5 + 12.5 * Math.pow(1 - Math.pow(u, 1.7), 1.1) });
    }
    return raus;
  })();
  const KORB = { b: 5.5, oben: 9, unten: 17 };
  const DREH = -12;                // um diesen Punkt neigt sich der Ballon
  // Die Punkte, die treffen: ein wenig innerhalb des Gezeichneten.
  const UMRISS = (() => {
    const raus = [{ x: 0, y: -32.4 }];
    [1, 3, 5, 7, 9, 11, 13, 14].forEach((n) => {
      const p = PROFIL[n];
      raus.push({ x: p.b * 0.94, y: p.y }, { x: -p.b * 0.94, y: p.y });
    });
    raus.push({ x: 5.2, y: 16.6 }, { x: -5.2, y: 16.6 }, { x: 5.4, y: 9.6 }, { x: -5.4, y: 9.6 });
    return raus;
  })();
  // So weit reicht der Ballon nach links (für die Front).
  const LINKS = 16.5;

  const TOP_COUNT = 5;
  const store = cloudApi
    ? cloudApi.register({ key: "lernapp.wind", empty: { runs: 0, scores: [] }, merge: cloudApi.mergeScores(TOP_COUNT) })
    : {
      read: () => ({ runs: 0, scores: [] }),
      write(data) { return data; },
      update(fn) { return fn(this.read()); },
      onChange() { return () => {}; },
    };

  // Was eine Runde beendet hat – auf der Tafel und als Schrift im Bild.
  const GRUENDE = {
    berg: { tafel: "Am Berg hängen geblieben", bild: "Berg!" },
    boden: { tafel: "Zu tief gesunken", bild: "Boden!" },
    fels: { tafel: "Am Felsbogen gestreift", bild: "Fels!" },
    wolke: { tafel: "Vom Blitz getroffen", bild: "Blitz!" },
    decke: { tafel: "In die Gewitterdecke gestiegen", bild: "Gewitter!" },
    front: { tafel: "Von der Gewitterfront eingeholt", bild: "Die Front!" },
  };

  // ---------------------------------------------------------------------------
  // Kleine Rechnungen
  // ---------------------------------------------------------------------------
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const lerp = (a, b, k) => a + (b - a) * k;
  const glatt = (k) => k * k * (3 - 2 * k);
  const meterBei = (x) => Math.max(0, (x - START.x) / METER);
  const tempoBei = (x) => V0 + (V_MAX - V0) * (1 - Math.exp(-meterBei(x) / V_WEG));
  // Wie viel vom Können des Ballons die Welt an dieser Stelle verlangt:
  // anfangs wenig, nach hinten immer mehr – nie alles.
  const schwereBei = (x) => 1 - Math.exp(-meterBei(x) / 380);

  // Immer dieselbe Zahl zu derselben Eingabe: Sterne, Bäume und ferne Berge
  // stehen bei jedem Bild am selben Platz, ohne den Zufall der Welt
  // anzufassen.
  function hash01(n) {
    const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return x - Math.floor(x);
  }

  // Glattes Rauschen und Grate daraus – für die fernen Berge.
  function rausch(x) {
    const i = Math.floor(x);
    return lerp(hash01(i), hash01(i + 1), glatt(x - i));
  }
  function grat(x, saat, scharf) {
    let summe = 0;
    let norm = 0;
    let amp = 1;
    let f = 1;
    for (let o = 0; o < 3; o += 1) {
      const n = rausch(x * f + saat * 17.3 + o * 51.7);
      summe += (scharf ? 1 - Math.abs(n * 2 - 1) : n) * amp;
      norm += amp;
      amp *= 0.48;
      f *= 2.13;
    }
    return summe / norm;
  }

  // Farben: als [r, g, b], gemischt und als Text für die Leinwand.
  const hex = (h) => {
    const n = parseInt(h.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };
  const mische = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
  const farbe = (c, a = 1) => (a >= 1
    ? `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`
    : `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${Math.max(0, a).toFixed(3)})`);

  // ---------------------------------------------------------------------------
  // Die Tageszeit – sie hängt an der Strecke
  // ---------------------------------------------------------------------------
  // Alle ZYKLUS Meter ein Tag: Morgenrot, Mittag, Abendrot, Nacht. sonne ist
  // die Höhe der Sonne (unter 0: untergegangen), nacht wie dunkel es ist,
  // wolke die Mischung der vier Wolkenfarben (Morgen, Tag, Abend, Nacht).
  const ZYKLUS = 2600;
  const TAGESZEIT = [
    { m: 0, oben: "#41539c", mitte: "#c88aa6", horizont: "#ffc898", licht: "#ffc48c", fern: "#857da9", wiese: "#6c8a58", fels: "#7d6b6c", sturm: "#3a3550", sonne: 0.05, nacht: 0.2, hell: 0.8, wolke: [1, 0, 0, 0] },
    { m: 260, oben: "#3a7bd0", mitte: "#8fc0ea", horizont: "#ffe9c8", licht: "#fff2d6", fern: "#7f9cc4", wiese: "#73a257", fels: "#8a7b72", sturm: "#3c4058", sonne: 0.36, nacht: 0, hell: 1, wolke: [0.2, 0.8, 0, 0] },
    { m: 520, oben: "#2f78d8", mitte: "#86c1f2", horizont: "#d8f0ff", licht: "#ffffff", fern: "#86a5cc", wiese: "#6aa64f", fels: "#8d8178", sturm: "#3c4159", sonne: 0.62, nacht: 0, hell: 1, wolke: [0, 1, 0, 0] },
    { m: 800, oben: "#3c6fc4", mitte: "#a4c3e6", horizont: "#ffe1a6", licht: "#ffe3a6", fern: "#8f9cc0", wiese: "#789a4c", fels: "#8f7a6a", sturm: "#3e3f56", sonne: 0.3, nacht: 0, hell: 0.97, wolke: [0, 0.75, 0.25, 0] },
    { m: 1040, oben: "#34478f", mitte: "#d77a86", horizont: "#ffaa58", licht: "#ffaa66", fern: "#8a6f96", wiese: "#5d6c46", fels: "#6e5560", sturm: "#3d3047", sonne: 0.05, nacht: 0.12, hell: 0.82, wolke: [0, 0, 1, 0] },
    { m: 1200, oben: "#1c2256", mitte: "#5b3a73", horizont: "#c8655c", licht: "#e28f86", fern: "#4c3f68", wiese: "#38463f", fels: "#463b50", sturm: "#2c2540", sonne: -0.08, nacht: 0.6, hell: 0.58, wolke: [0, 0, 0.5, 0.5] },
    { m: 1380, oben: "#080c26", mitte: "#131b46", horizont: "#28376c", licht: "#b8c8ff", fern: "#232c56", wiese: "#1f2d38", fels: "#29304a", sturm: "#1d1f38", sonne: -0.3, nacht: 1, hell: 0.45, wolke: [0, 0, 0, 1] },
    { m: 2120, oben: "#080c26", mitte: "#131b46", horizont: "#28376c", licht: "#b8c8ff", fern: "#232c56", wiese: "#1f2d38", fels: "#29304a", sturm: "#1d1f38", sonne: -0.3, nacht: 1, hell: 0.45, wolke: [0, 0, 0, 1] },
    { m: 2400, oben: "#1b2158", mitte: "#4b3c78", horizont: "#b4728a", licht: "#e6a6b6", fern: "#4f4a78", wiese: "#3b4a44", fels: "#4a4058", sturm: "#2a2642", sonne: -0.06, nacht: 0.55, hell: 0.62, wolke: [0.5, 0, 0, 0.5] },
  ];
  const FARB_FELDER = ["oben", "mitte", "horizont", "licht", "fern", "wiese", "fels", "sturm"];
  TAGESZEIT.forEach((k) => FARB_FELDER.forEach((feld) => { k[feld] = hex(k[feld]); }));
  TAGESZEIT.push({ ...TAGESZEIT[0], m: ZYKLUS });

  // Die Lage des Lichts in diesem Bild – einmal je Bild gemischt.
  const tag = { oben: [0, 0, 0], mitte: [0, 0, 0], horizont: [0, 0, 0], licht: [0, 0, 0], fern: [0, 0, 0], wiese: [0, 0, 0], fels: [0, 0, 0], sturm: [0, 0, 0], sonne: 0, nacht: 0, hell: 1, wolke: [0, 1, 0, 0] };

  function tageszeit(meter) {
    const m = ((meter % ZYKLUS) + ZYKLUS) % ZYKLUS;
    let i = 0;
    while (i < TAGESZEIT.length - 2 && TAGESZEIT[i + 1].m <= m) i += 1;
    const a = TAGESZEIT[i];
    const b = TAGESZEIT[i + 1];
    const k = glatt(clamp((m - a.m) / (b.m - a.m), 0, 1));
    FARB_FELDER.forEach((feld) => { tag[feld] = mische(a[feld], b[feld], k); });
    tag.sonne = lerp(a.sonne, b.sonne, k);
    tag.nacht = lerp(a.nacht, b.nacht, k);
    tag.hell = lerp(a.hell, b.hell, k);
    tag.wolke = a.wolke.map((w, n) => lerp(w, b.wolke[n], k));
  }

  // ---------------------------------------------------------------------------
  // Zustand
  // ---------------------------------------------------------------------------
  // phase:   "bereit" (noch nichts gedrückt), "spiel", "zuschauen", "ende"
  // schritt: "start", "fahrt", "crash"
  const state = {
    phase: "bereit",
    schritt: "start",
    punkte: 0,            // dasselbe wie meter – die Strecke ist die Punktzahl
    meter: 0,
    weit: START.x,        // so weit im Osten war der Ballon schon
    f: { x: START.x, y: START.y, vx: 0, vy: 0 },
    hitze: 0.5,           // Wärme der Hülle, 0 … 1; bei 0,5 schwebt er
    flamme: 0,            // wie hell die Flamme gerade brennt (nur fürs Bild)
    neig: 0,              // Schräglage der Hülle (Bogenmass, rechts herum positiv)
    neigV: 0,
    an: AN_VORN,          // wo der Ballon im Bild steht (Anteil der Breite von links)
    front: { x: START.x - FRONT_START },
    uhr: 0,               // die Zeit der Fahrt – die Schichten wogen mit ihr
    camX: 0,
    camY: 0,
    welt: null,
    grund: "",
    abschnitt: 0,         // der Abschnitt, in dem der Ballon gerade ist
    serie: 0,             // so viele Übergänge hintereinander ohne zu bremsen
    schlieren: [],
    fetzen: [],
    teile: [],
    schriften: [],
    blitze: [],
    blitz: 0,             // wie hell der Himmel gerade aufleuchtet
    stoss: 0,
    zeitlupe: 0,
    knappZeit: -9,
    windZeit: -9,
    zeit: 0,
    crashZeit: 0,
    rissSeite: 1,
    geschlagen: new Set(),
  };

  let shell = null;
  let feld = null;
  let canvas = null;
  let g = null;
  let frame = null;
  let last = 0;
  let stepTimer = null;
  let gedrueckt = false;
  // Die Gegner (geist.js): wer als Geist mitfährt und als Fahne im Gelände steht.
  let gegner = null;
  // Wer eine Fahrt anschaut statt zu fahren (geist.js, zuschauer).
  let zuschauer = null;

  const view = { s: 1, dpr: 1, cssW: 0, cssH: 0, w: WELT_W, h: SICHT_H, nutz: SICHT_H, frei: 0 };

  function clearStep() {
    if (stepTimer) { window.clearTimeout(stepTimer); stepTimer = null; }
  }

  function stopLoop() {
    if (frame) { window.cancelAnimationFrame(frame); frame = null; }
  }

  // ---------------------------------------------------------------------------
  // Die Welt bauen
  // ---------------------------------------------------------------------------
  /*
   * Die Welt besteht aus Abschnitten. Jeder hat seine Schichten, von unten
   * nach oben, getrennt durch Grenzen. Eine Grenze liegt auf ihrer Höhe y,
   * wogt mit der Zeit langsam auf und ab (A) und läuft entlang der Strecke in
   * flachen Wellen (B), die mit dem Wind weiterziehen. Zwischen zwei
   * Schichten geht der Wind auf SCHERUNG Einheiten weich über, und zwischen
   * zwei Abschnitten auf UEBER Einheiten.
   *
   * Jeder Abschnitt hat eine gute Schicht. a bis b ist ihr sicherer Kern: Wo
   * der Messpunkt des Ballons darin liegt, weht immer der volle gute Wind,
   * wie auch immer die Grenzen gerade liegen. Die Kerne zweier Abschnitte
   * überlappen sich; in der Mitte dieser Überlappung (aus, ein) führt der
   * Weg über den Übergang. Dazwischen steigt oder sinkt er sanft wie eine
   * Kosinuskurve – der Abschnitt ist so lang, dass der Ballon mitkommt
   * (laengeFuer).
   *
   * Das Gelände ist eine Reihe von Stützpunkten im Abstand SEG. Der Boden
   * liegt um eine Lücke unter dem tiefsten Kern in der Nähe: in Tälern weit,
   * an Graten, Gipfeln und Nadeln knapp. Ganz oben liegt die Gewitterdecke.
   *
   * Alles wird der Reihe nach gewürfelt, Punkt für Punkt, die Abschnitte
   * VORAUS Einheiten vor dem Gelände – egal, wie weit voraus gerade gebaut
   * wird, entsteht dieselbe Welt.
   */
  function neueWelt() {
    return { punkte: [], schichten: [], gelaende: null, wolken: [], decke: [] };
  }

  // Wie lang ein Abschnitt sein muss, damit der Ballon um d steigt oder
  // sinkt: nie schneller, als er kann, nie mit mehr Kraft, als die Hülle
  // hergibt, und nie so plötzlich, dass sie nicht schnell genug heiss oder
  // kalt wird. Von allem verlangt die Welt nur einen Teil – nach hinten mehr.
  function laengeFuer(d, v, k) {
    const teil = lerp(0.3, 0.6, k);
    let L = Math.max(120, (Math.PI * d * v) / (2 * VT * teil));
    for (let n = 0; n < 80; n += 1) {
      const om = (Math.PI * v) / L;
      const vy = (om * d) / 2;
      const a = (om * om * d) / 2;
      const kraft = Math.hypot(a, DAEMPF * vy);
      if (kraft <= AUF * teil && (om * kraft) / (2 * AUF) <= KUEHL * teil) break;
      L *= 1.06;
    }
    return L;
  }

  // Eine Grenze zwischen zwei Schichten, um die Höhe y.
  function neueGrenze(y, k) {
    return {
      y,
      A: lerp(lerp(3, 8, k), lerp(6, 16, k), zufall.zahl()),
      om: (Math.PI * 2) / lerp(5, 9, zufall.zahl()),
      ph: zufall.zahl() * Math.PI * 2,
      B: lerp(2, lerp(4, 10, k), zufall.zahl()),
      kap: (Math.PI * 2) / lerp(200, 420, zufall.zahl()),
      psi: zufall.zahl() * Math.PI * 2,
      zug: 0,
    };
  }
  // So weit kann eine Grenze von ihrer Höhe abweichen, samt Scherung.
  const ausschlag = (gr) => gr.A + gr.B + SCHERUNG / 2;

  function grenzeY(gr, x, t) {
    return gr.y + gr.A * Math.sin(gr.om * t + gr.ph) + gr.B * Math.sin(gr.kap * (x - gr.zug * t) + gr.psi);
  }

  /*
   * Ein Abschnitt um seinen guten Kern [a, b]. Die gute Schicht reicht so
   * weit über den Kern hinaus, wie ihre Grenzen wogen. Darunter und darüber
   * je eine oder zwei Schichten mehr, wenn Platz ist. Eine der Nachbarinnen
   * kann schnell sein (mit Gewittern), die anderen wehen zurück oder nur
   * lahm nach Osten – langsamer als die Front.
   */
  function baueSchicht(x0, a, b, k, T) {
    const vGut = T * lerp(1.0, 1.12, zufall.zahl());
    const unten = neueGrenze(0, k);
    const oben = neueGrenze(0, k);
    unten.y = a - ausschlag(unten);
    oben.y = b + ausschlag(oben);
    const unter = [];
    const ueber = [];
    if (unten.y >= 50) {
      unter.push(unten);
      const extra = neueGrenze(0, k);
      const bis = unten.y - ausschlag(unten) - ausschlag(extra) - GRENZE_MIN;
      const wahl = zufall.zahl();
      if (bis >= 64 && wahl < 0.6) {
        extra.y = lerp(56, bis, zufall.zahl());
        unter.unshift(extra);
      }
    }
    if (oben.y <= DECKE - 44) {
      ueber.push(oben);
      const extra = neueGrenze(0, k);
      const von = oben.y + ausschlag(oben) + ausschlag(extra) + GRENZE_MIN;
      const wahl = zufall.zahl();
      // Ohne Schicht darunter wird oben eher geteilt: drei sollen es sein.
      if (von <= DECKE - 52 && wahl < (unter.length ? 0.55 : 0.9)) {
        extra.y = lerp(von, DECKE - 52, zufall.zahl());
        ueber.push(extra);
      }
    }
    const grenzen = [...unter, ...ueber];
    const gut = unter.length;
    const n = grenzen.length + 1;
    const baender = [];
    for (let j = 0; j < n; j += 1) baender.push({ w: 0, art: "west" });
    baender[gut] = { w: vGut, art: "gut" };

    // Eine schnelle Schicht, gleich neben der guten.
    let schnell = -1;
    const wurf = zufall.zahl();
    const welche = zufall.zahl();
    if (meterBei(x0) >= SCHNELL_AB && wurf < lerp(0.35, 0.62, k)) {
      const kandidaten = [];
      if (gut > 0) kandidaten.push(gut - 1);
      if (gut < n - 1) kandidaten.push(gut + 1);
      if (kandidaten.length) schnell = kandidaten[Math.min(kandidaten.length - 1, Math.floor(welche * kandidaten.length))];
    }
    for (let j = 0; j < n; j += 1) {
      if (j === gut) continue;
      const art = zufall.zahl();
      const staerke = zufall.zahl();
      if (j === schnell) {
        baender[j] = { w: T * lerp(1.5, 1.85, staerke), art: "schnell" };
      } else if (art < (Math.abs(j - gut) === 1 ? 0.8 : 0.62)) {
        baender[j] = { w: -T * lerp(lerp(0.35, 0.7, k), lerp(0.7, 1.15, k), staerke), art: "west" };
      } else {
        baender[j] = { w: T * lerp(0.15, 0.38, staerke), art: "lahm" };
      }
    }
    // Die Wellen auf einer Grenze ziehen mit dem Wind der beiden Schichten.
    grenzen.forEach((gr, j) => { gr.zug = (baender[j].w + baender[j + 1].w) * 0.22; });

    return { nr: 0, x0, x1: Infinity, a, b, gut, grenzen, baender, vGut, ein: (a + b) / 2, aus: (a + b) / 2, zellen: [], boegen: [] };
  }

  function ersteSchicht() {
    const c = START.y + MESS;
    const D = lerp(150, 175, zufall.zahl());
    const s = baueSchicht(-VORLAUF, c - D / 2, c + D / 2, 0, tempoBei(START.x + 600));
    s.ein = c;
    return s;
  }

  // Der nächste Abschnitt: wo seine gute Schicht liegt (so, dass sie sich mit
  // der alten genug überlappt), wie lang der alte wird – und die Gewitter
  // des alten, jetzt wo er feststeht.
  function neueSchicht() {
    const w = state.welt;
    const alt = w.schichten[w.schichten.length - 1];
    const kAlt = schwereBei(alt.x0);
    const xNeu = Math.max(alt.x0 + lerp(900, 400, kAlt), START.x + 700);
    const k = schwereBei(xNeu);
    const DAlt = alt.b - alt.a;
    const cAlt = (alt.a + alt.b) / 2;
    const D = lerp(lerp(140, 40, k), lerp(170, 72, k), zufall.zahl());
    const ue = Math.min(lerp(lerp(64, 22, k), lerp(90, 36, k), zufall.zahl()), Math.min(D, DAlt) - 6);
    const m = Math.max(0, (D + DAlt) / 2 - ue);
    const hoch = Math.max(0, Math.min(m, GUT_OBEN - D / 2 - cAlt));
    const tief = Math.max(0, Math.min(m, cAlt - GUT_UNTEN - D / 2));
    const rauf = zufall.zahl() * (hoch + tief) < hoch;
    const weit = lerp(lerp(0.2, 0.6, k), 1, Math.sqrt(zufall.zahl()));
    let c = clamp(cAlt + (rauf ? hoch : -tief) * weit, GUT_UNTEN + D / 2, GUT_OBEN - D / 2);
    let lo = Math.max(c - D / 2, alt.a);
    let hi = Math.min(c + D / 2, alt.b);
    if (hi - lo < ue) {
      // Sicher ist sicher: dann eben auf derselben Höhe weiter.
      c = clamp(cAlt, GUT_UNTEN + D / 2, GUT_OBEN - D / 2);
      lo = Math.max(c - D / 2, alt.a);
      hi = Math.min(c + D / 2, alt.b);
    }
    alt.aus = (lo + hi) / 2;
    const L = Math.max(
      alt.nr === 0 ? VORLAUF + 720 : lerp(900, 400, kAlt),
      laengeFuer(Math.abs(alt.aus - alt.ein), alt.vGut, kAlt) + UEBER,
    ) + zufall.zahl() * lerp(320, 140, kAlt);
    alt.x1 = alt.x0 + L;
    const s = baueSchicht(alt.x1, c - D / 2, c + D / 2, k, tempoBei(alt.x1 + 500));
    s.nr = alt.nr + 1;
    s.ein = alt.aus;
    gewitterIn(alt);
    boegenIn(alt);
    w.schichten.push(s);
  }

  /*
   * Gewitterzellen in einem fertigen Abschnitt: in der schnellen Schicht
   * mehrere hintereinander, in einer anderen manchmal eine. Sie bleiben dem
   * Kern der guten Schicht fern – so weit, dass der ganze Ballon daran
   * vorbeikommt –, und weg von den Übergängen, wo die gute Schicht wechselt.
   * Eine Zelle füllt ihre Schicht: Wer an ihr vorbei will, muss hinaus.
   */
  function gewitterIn(s) {
    const k = schwereBei(s.x0);
    const m = meterBei(s.x0);
    const von = s.x0 + UEBER / 2 + 80;
    const bis = s.x1 - UEBER / 2 - 80;
    s.baender.forEach((band, j) => {
      if (j === s.gut) return;
      const wurf = zufall.zahl();
      // Unter der guten Schicht nur in einer schnellen – sonst stünden sie
      // in den Bergen.
      if (j < s.gut && band.art !== "schnell") return;
      const schritt = band.art === "schnell"
        ? lerp(lerp(560, 300, k), lerp(420, 220, k), zufall.zahl())
        : Infinity;
      if (band.art === "schnell" ? m < STURM_AB : (m < STURM_AB + 140 || wurf > lerp(0.12, 0.38, k))) return;
      let x = von + lerp(0.15, 0.9, zufall.zahl()) * Math.min(schritt, Math.max(0, bis - von));
      for (let n = 0; n < 12 && x < bis; n += 1) {
        const breite = lerp(46, 96, zufall.zahl()) * lerp(1, 1.2, k);
        const halb = breite / 2;
        if (x - halb >= von && x + halb <= bis) baueZelle(s, j, x, breite, k);
        if (!Number.isFinite(schritt)) break;
        x += schritt + breite * 0.5;
      }
    });

    // Ab der Mitte der Strecke hängt manchmal eine Zelle von oben in die
    // gute Schicht hinein oder steht von unten darin. Der sichere Weg führt
    // mit Abstand daran vorbei – aber man muss die Höhe genau halten.
    const wurf = zufall.zahl();
    const zwei = zufall.zahl();
    if (m >= STURM_AB + 80 && wurf < lerp(0.1, 0.62, k) && bis - von > 160) {
      const anzahl = zwei < k * 0.6 ? 2 : 1;
      for (let n = 0; n < anzahl; n += 1) {
        const x = lerp(von + 50, bis - 50, (n + lerp(0.2, 0.8, zufall.zahl())) / anzahl);
        const breite = lerp(40, 76, zufall.zahl());
        const vonOben = zufall.zahl() < 0.6;
        zelleImWeg(s, x, breite, vonOben, k);
      }
    }
  }

  // Eine Zelle in der guten Schicht, mit Abstand zum sicheren Weg darunter
  // (vonOben) oder darüber.
  function zelleImWeg(s, x, breite, vonOben, k) {
    const abstand = lerp(24, 9, k);
    let lo = Infinity;
    let hi = -Infinity;
    for (let xx = x - breite / 2 - 30; xx <= x + breite / 2 + 30.01; xx += 10) {
      const y = pfadIn(s, xx);
      lo = Math.min(lo, y);
      hi = Math.max(hi, y);
    }
    const n = s.grenzen.length;
    if (vonOben) {
      const oben = s.gut < n ? s.grenzen[s.gut].y + 40 : DECKE + 40;
      baueZelleIn(s, x, breite, hi + OBEN_RAND + abstand, Math.min(DECKE + 40, oben), true);
    } else {
      const unten = s.gut > 0 ? s.grenzen[s.gut - 1].y - 40 : 40;
      baueZelleIn(s, x, breite, Math.max(40, unten), lo - UNTEN_RAND - abstand, false);
    }
  }

  function baueZelle(s, j, x, breite, k) {
    const abstand = lerp(26, 7, k);
    const n = s.grenzen.length;
    const bandUnten = j > 0 ? s.grenzen[j - 1].y : 0;
    const bandOben = j < n ? s.grenzen[j].y : DECKE + 40;
    let u;
    let o;
    const ueberGut = j > s.gut;
    if (ueberGut) {
      u = Math.max(s.b + OBEN_RAND + abstand, bandUnten - 6);
      o = j === n ? DECKE + 40 : Math.min(DECKE + 40, bandOben + lerp(10, 40, zufall.zahl()));
    } else {
      o = Math.min(s.a - UNTEN_RAND - abstand, bandOben + 6);
      u = Math.max(40, bandUnten - 10, o - lerp(70, 110, zufall.zahl()));
    }
    baueZelleIn(s, x, breite, u, o, ueberGut);
  }

  // Die Ballen einer Zelle zwischen u und o – kein Ballen reicht darüber
  // hinaus (dort trifft er).
  function baueZelleIn(s, x, breite, u, o, ueberGut) {
    const w = state.welt;
    if (o - u < 36) return;
    // Säulen aus Ballen, von unten nach oben – in der Mitte höher, am Rand
    // tiefer und unten gerundet: ein Gewitterturm.
    const kreise = [];
    const spalten = Math.max(3, Math.round(breite / 17));
    const hoch = o - u;
    for (let sp = 0; sp < spalten; sp += 1) {
      const q = (sp + 0.5) / spalten;
      const mitte = 1 - Math.abs(q - 0.5) * 2;
      const cx = x + (q - 0.5) * breite + (zufall.zahl() - 0.5) * 6;
      const ende = o - (1 - Math.sqrt(mitte)) * Math.min(34, hoch * 0.35);
      const fuss = u + (1 - mitte) * Math.min(12, hoch * 0.15);
      let cy = fuss;
      for (let z = 0; z < 16; z += 1) {
        const r = Math.min(lerp(13, 21, zufall.zahl()), (ende - fuss) / 2);
        if (r < 7) break;
        if (z === 0) cy = fuss + r;
        const y = Math.min(cy, ende - r);
        kreise.push({ x: cx + (zufall.zahl() - 0.5) * 5, y, r });
        if (y + r >= ende - 0.5) break;
        cy = y + r * 0.85;
      }
    }
    if (!kreise.length) return;
    let x0 = Infinity;
    let x1 = -Infinity;
    let unten = Infinity;
    let oben = -Infinity;
    kreise.forEach((c) => {
      x0 = Math.min(x0, c.x - c.r);
      x1 = Math.max(x1, c.x + c.r);
      unten = Math.min(unten, c.y - c.r);
      oben = Math.max(oben, c.y + c.r);
    });
    const zelle = { x, x0, x1, unten, oben, kreise, licht: 0, ueberGut, regen: !ueberGut, nr: w.wolken.length };
    s.zellen.push(zelle);
    w.wolken.push(zelle);
  }

  /*
   * Felsbögen: grosse Bögen aus Fels, die im Tal stehen – mit einem Fenster,
   * durch das man den Himmel sieht. Ihr Scheitel bleibt unter dem sicheren
   * Weg wie jeder Gipfel; wer zu tief fährt, streift sie. Unter dem Fenster
   * senkt sich das Gelände, damit man hindurchsieht.
   */
  function boegenIn(s) {
    const k = schwereBei(s.x0);
    const m = meterBei(s.x0);
    const wurf = zufall.zahl();
    const wo = zufall.zahl();
    const breiteZ = zufall.zahl();
    const hoeheZ = zufall.zahl();
    const dickeZ = zufall.zahl();
    const beinZ = zufall.zahl();
    if (m < 140 || wurf > lerp(0.35, 0.55, k)) return;
    const von = s.x0 + UEBER / 2 + 60;
    const bis = s.x1 - UEBER / 2 - 60;
    const breite = lerp(130, 230, breiteZ);
    if (bis - von < breite + 20) return;
    const x0 = lerp(von, bis - breite, wo);
    const x1 = x0 + breite;
    if (s.zellen.some((c) => !c.ueberGut && c.x1 + 40 > x0 && c.x0 - 40 < x1)) return;
    let frei = Infinity;
    for (let x = x0 - 20; x <= x1 + 20.01; x += 10) frei = Math.min(frei, freiBei(x));
    const oben = frei - lerp(16, 5, k) - hoeheZ * 40;
    if (oben < 90) return;
    s.boegen.push({ x0, x1, oben, dicke: lerp(18, 30, dickeZ), bein: lerp(0.15, 0.22, beinZ), fuss: -30 });
  }

  // Die Oberkante eines Felsbogens bei x – oder -Infinity daneben.
  function bogenAussen(b, x) {
    const u = (x - b.x0) / (b.x1 - b.x0);
    if (u <= 0 || u >= 1) return -Infinity;
    return b.fuss + (b.oben - b.fuss) * Math.pow(Math.sin(Math.PI * u), 0.3);
  }

  // Die Oberkante seines Fensters bei x – unter den Pfeilern -Infinity:
  // dort ist Fels bis hinab.
  function bogenInnen(b, x) {
    const u = (x - b.x0) / (b.x1 - b.x0);
    const v = (u - b.bein) / (1 - 2 * b.bein);
    if (v <= 0 || v >= 1) return -Infinity;
    return b.fuss + (b.oben - b.dicke - b.fuss) * Math.pow(Math.sin(Math.PI * v), 0.45);
  }

  // Der sichere Weg in einem fertigen Abschnitt: über den Übergang auf der
  // Höhe ein, dann sanft wie eine Kosinuskurve auf die Höhe aus.
  function pfadIn(s, x) {
    const von = s.x0 + UEBER / 2;
    const bis = s.x1 - UEBER / 2;
    if (x <= von) return s.ein;
    if (x >= bis) return s.aus;
    const u = (x - von) / (bis - von);
    return s.ein + (s.aus - s.ein) * (1 - Math.cos(Math.PI * u)) / 2;
  }

  // Ein Stück Gelände: Wiese, Tal oder Grat – mit Gipfeln und Nadeln.
  function neuesGelaende(x) {
    const w = state.welt;
    const k = schwereBei(x);
    const g0 = w.gelaende ? w.gelaende.g1 : 26;
    const z = zufall.zahl();
    let art = "wiese";
    if (x >= START_FLACH) {
      if (z < lerp(0.22, 0.14, k)) art = "tal";
      else if (z < lerp(0.55, 0.38, k)) art = "wiese";
      else art = "grat";
    }
    const L = lerp(200, 420, zufall.zahl()) * lerp(1, 0.75, k);
    let g1 = 0;
    if (x < START_FLACH) g1 = lerp(16, 34, zufall.zahl());
    else if (art === "tal") g1 = 420;
    else if (art === "wiese") g1 = lerp(lerp(64, 36, k), lerp(120, 76, k), zufall.zahl());
    else g1 = lerp(lerp(44, 8, k), lerp(78, 28, k), zufall.zahl());

    // Gipfel und Nadeln: Sie ziehen den Boden bis auf eine kleine Lücke an
    // die gute Schicht heran – Nadeln schmal und spitz, Gipfel breit.
    const spitzen = [];
    if (x >= START_FLACH) {
      const anzahl = Math.floor(zufall.zahl() * lerp(2.2, 3.6, k));
      for (let n = 0; n < anzahl; n += 1) {
        const nadel = zufall.zahl() < lerp(0.3, 0.55, k);
        spitzen.push({
          x: x + L * lerp(0.15, 0.85, zufall.zahl()),
          halb: nadel ? lerp(14, 26, zufall.zahl()) : lerp(50, 110, zufall.zahl()),
          ziel: nadel ? lerp(lerp(28, 3, k), lerp(50, 14, k), zufall.zahl()) : lerp(lerp(40, 6, k), lerp(80, 24, k), zufall.zahl()),
          nadel,
        });
      }
    }
    w.gelaende = { x0: x, L, g0, g1, spitzen, rauh: art === "wiese" ? lerp(1, 3, k) : lerp(3, 8, k) };
  }

  // Wie hoch der Boden bei x höchstens kommen darf: anfangs unter dem
  // tiefsten Kern der Abschnitte in der Nähe, nach hinten immer näher am
  // sicheren Weg – so, dass der Korb dort noch frei ist. Und unter den
  // Gewittern, die tief hängen.
  function freiBei(x) {
    const l = state.welt.schichten;
    const nah = UEBER / 2 + 30;
    const kt = 0.85 * clamp((schwereBei(x) - 0.3) / 0.5, 0, 1);
    let weg = Infinity;
    for (let dx = -24; dx <= 24.01; dx += 12) weg = Math.min(weg, pfadIn(l[schichtNr(x + dx)], x + dx));
    let frei = Infinity;
    for (let i = Math.max(0, schichtNr(x) - 1); i < l.length; i += 1) {
      const s = l[i];
      if (s.x0 - nah > x) break;
      if (s.x1 + nah < x) continue;
      frei = Math.min(frei, lerp(s.a, Math.max(s.a, weg), kt) - UNTEN_RAND);
      // Unter einer tiefen Zelle senkt sich das Gelände zu einem Tal.
      s.zellen.forEach((c) => {
        if (c.ueberGut) return;
        const neben = Math.max(0, c.x0 - 20 - x, x - c.x1 - 20);
        frei = Math.min(frei, c.unten - 14 + neben * 1.4);
      });
    }
    return frei;
  }

  function naechsterPunkt() {
    const w = state.welt;
    const i = w.punkte.length;
    const x = i * SEG - VORLAUF;
    if (!w.schichten.length) w.schichten.push(ersteSchicht());
    while (w.schichten[w.schichten.length - 1].x0 <= x + VORAUS) neueSchicht();
    if (!w.gelaende || x >= w.gelaende.x0 + w.gelaende.L) neuesGelaende(x);

    const ge = w.gelaende;
    const v = clamp((x - ge.x0) / ge.L, 0, 1);
    let luecke = ge.g0 + (ge.g1 - ge.g0) * (1 - Math.cos(Math.PI * v)) / 2;
    ge.spitzen.forEach((sp) => {
      const q = Math.abs(x - sp.x) / sp.halb;
      if (q >= 1 || luecke <= sp.ziel) return;
      const form = sp.nadel ? Math.pow(1 - q, 1.4) : (1 + Math.cos(Math.PI * q)) / 2;
      luecke = lerp(luecke, sp.ziel, form);
    });
    if (x > START_FLACH) luecke -= ge.rauh * zufall.zahl();
    luecke = Math.max(LUECKE_MIN, luecke);
    let boden = Math.max(TAL, freiBei(x) - luecke);
    // Ein Felsbogen steht frei in einem Tal: unter seinem Fenster liegt der
    // Talgrund, an seinen Pfeilern bleibt das Gelände unter ihm.
    const nr = schichtNr(x);
    for (let n = Math.max(0, nr - 1); n <= Math.min(w.schichten.length - 1, nr + 1); n += 1) {
      for (const b of w.schichten[n].boegen) {
        if (x < b.x0 - 40 || x > b.x1 + 40) continue;
        if (bogenInnen(b, x) > -Infinity) boden = TAL;
        else {
          const rand = Math.max(0, b.x0 - x, x - b.x1);
          boden = Math.min(boden, Math.max(TAL, b.oben * 0.55 + rand * 2));
        }
      }
    }
    w.punkte.push({ x, boden, deko: hash01(i * 1.37 + 0.2) });

    // Die Gewitterdecke: alle drei Punkte ein Ballen.
    if (i % 3 === 0) {
      const r = lerp(30, 48, zufall.zahl());
      const tief = DECKE + lerp(-6, 10, zufall.zahl());
      w.decke.push({ x: x + (zufall.zahl() - 0.5) * 14, y: tief + r, r });
    }
  }

  function weltBis(x) {
    const w = state.welt;
    while (!w.punkte.length || w.punkte[w.punkte.length - 1].x < x) naechsterPunkt();
  }

  // Der Boden aus den schon gebauten Punkten.
  function roh(x) {
    const p = state.welt.punkte;
    const k = (x + VORLAUF) / SEG;
    const i = clamp(Math.floor(k), 0, p.length - 2);
    const u = clamp(k - i, 0, 1);
    return lerp(p[i].boden, p[i + 1].boden, u);
  }

  const bodenBei = (x) => { weltBis(x + SEG * 2); return roh(x); };

  // Der Abschnitt bei x (als Nummer in der Liste). Gefragt wird meist in der
  // Nähe der letzten Frage – deshalb wird von dort aus gesucht.
  let nrHinweis = 0;
  function schichtNr(x) {
    const l = state.welt.schichten;
    let i = clamp(nrHinweis, 0, l.length - 1);
    while (i > 0 && x < l[i].x0) i -= 1;
    while (i < l.length - 1 && x >= l[i].x1) i += 1;
    nrHinweis = i;
    return i;
  }

  // Der Wind in einem Abschnitt: von unten nach oben, an jeder Grenze ein
  // weicher Schritt zum Wind der nächsten Schicht.
  function windIn(s, x, y, t) {
    const gr = s.grenzen;
    const bd = s.baender;
    let w = bd[0].w;
    for (let j = 0; j < gr.length; j += 1) {
      const u = (y - grenzeY(gr[j], x, t)) / SCHERUNG + 0.5;
      if (u <= 0) break;
      w += (bd[j + 1].w - bd[j].w) * (u >= 1 ? 1 : u * u * (3 - 2 * u));
    }
    return w;
  }

  // Der Wind bei (x, y) zur Zeit t – im Übergang zwischen zwei Abschnitten
  // weich von einem zum anderen.
  function windBei(x, y, t = state.uhr) {
    const l = state.welt.schichten;
    const i = schichtNr(x);
    const s = l[i];
    if (i > 0 && x - s.x0 < UEBER / 2) {
      const u = glatt(clamp(0.5 + (x - s.x0) / UEBER, 0, 1));
      return lerp(windIn(l[i - 1], x, y, t), windIn(s, x, y, t), u);
    }
    if (i < l.length - 1 && s.x1 - x < UEBER / 2) {
      const u = glatt(clamp(0.5 - (s.x1 - x) / UEBER, 0, 1));
      return lerp(windIn(s, x, y, t), windIn(l[i + 1], x, y, t), u);
    }
    return windIn(s, x, y, t);
  }

  // Der sichere Weg: die Höhe des Messpunkts, auf der man bei x immer im
  // guten Wind ist und allem fern bleibt. Für die Prüfskripte und die
  // Vorführung – im Spiel sieht man ihn nicht.
  function zielBei(x) {
    weltBis(x + SEG * 2);
    return pfadIn(state.welt.schichten[schichtNr(x)], x);
  }

  const schichtBei = (x) => { weltBis(x + SEG * 2); return state.welt.schichten[schichtNr(x)]; };

  // Wie schnell die Front gerade zieht – nach der weitesten Stelle der Fahrt.
  const frontTempo = () => tempoBei(state.weit) * lerp(FRONT_F0, FRONT_F1, schwereBei(state.weit));

  // ---------------------------------------------------------------------------
  // Treffen
  // ---------------------------------------------------------------------------
  // Die Punkte des Umrisses in der Welt, so wie der Ballon gerade liegt.
  const welt = UMRISS.map(() => ({ x: 0, y: 0 }));
  function umrissInDerWelt() {
    const f = state.f;
    const c = Math.cos(state.neig);
    const s = Math.sin(state.neig);
    UMRISS.forEach((p, n) => {
      const dy = p.y - DREH;
      welt[n].x = f.x + p.x * c - dy * s;
      welt[n].y = f.y - (p.x * s + dy * c + DREH);
    });
    return welt;
  }

  // Was der Ballon berührt – oder "". Dazu, wie knapp er an allem vorbei ist
  // (fürs "knapp!").
  const pruef = { grund: "", knapp: Infinity, x: 0, y: 0 };
  function pruefen() {
    const f = state.f;
    const w = state.welt;
    const pkte = umrissInDerWelt();
    pruef.grund = "";
    pruef.knapp = Infinity;
    const treffer = (grund, p) => {
      if (pruef.grund) return;
      pruef.grund = grund;
      pruef.x = p.x;
      pruef.y = p.y;
    };
    weltBis(f.x + 60);
    // Die Front
    if (f.x - LINKS - state.front.x <= 0) treffer("front", { x: f.x - LINKS, y: f.y + 8 });
    // Boden und Decke
    for (const p of pkte) {
      const boden = roh(p.x);
      const ueber = p.y - boden;
      if (ueber <= 0) treffer(boden < TAL + 30 ? "boden" : "berg", p);
      pruef.knapp = Math.min(pruef.knapp, ueber);
      if (p.y >= DECKE + 24) treffer("decke", p);
    }
    // Die Ballen der Decke in der Nähe
    if (f.y > DECKE - 110) {
      const d0 = Math.max(0, Math.floor((f.x - 80 + VORLAUF) / (SEG * 3)) - 1);
      for (let n = d0; n < w.decke.length && w.decke[n].x < f.x + 80; n += 1) {
        const c = w.decke[n];
        for (const p of pkte) {
          const d = Math.hypot(p.x - c.x, p.y - c.y) - c.r;
          if (d <= 0) treffer("decke", p);
          pruef.knapp = Math.min(pruef.knapp, d);
        }
      }
    }
    // Die Felsbögen und die Gewitterzellen in der Nähe – in den Abschnitten
    // um den Ballon.
    const l = w.schichten;
    const nr = schichtNr(f.x);
    for (let i = Math.max(0, nr - 1); i <= Math.min(l.length - 1, nr + 1); i += 1) {
      for (const b of l[i].boegen) {
        if (b.x1 < f.x - 40 || b.x0 > f.x + 40 || b.oben < f.y - 40) continue;
        for (const p of pkte) {
          const aussen = bogenAussen(b, p.x);
          if (aussen === -Infinity) continue;
          const innen = bogenInnen(b, p.x);
          if (p.y <= aussen && p.y >= innen) treffer("fels", p);
          pruef.knapp = Math.min(pruef.knapp, p.y > aussen ? p.y - aussen : p.y < innen ? innen - p.y : 0);
        }
      }
    }
    for (let i = Math.max(0, nr - 1); i <= Math.min(l.length - 1, nr + 1); i += 1) {
      for (const wo of l[i].zellen) {
        if (wo.x1 < f.x - 40 || wo.x0 > f.x + 40) continue;
        if (wo.unten > f.y + 60 || wo.oben < f.y - 40) continue;
        for (const c of wo.kreise) {
          if (Math.abs(c.x - f.x) > c.r + 24) continue;
          for (const p of pkte) {
            const d = Math.hypot(p.x - c.x, p.y - c.y) - c.r;
            if (d <= 0) treffer("wolke", p);
            pruef.knapp = Math.min(pruef.knapp, d);
          }
        }
      }
    }
    return pruef;
  }

  // ---------------------------------------------------------------------------
  // Die Fläche
  // ---------------------------------------------------------------------------
  function buildPlatz() {
    const platz = shell.el("div", "bl-platz");
    feld = shell.el("div", "bl-feld");
    canvas = document.createElement("canvas");
    canvas.className = "bl-canvas";
    canvas.setAttribute("aria-hidden", "true");
    feld.append(canvas);
    g = canvas.getContext("2d");

    // Der Hinweis vor dem ersten Druck: ein Ring, der sich füllt – halten,
    // nicht tippen.
    const tipp = shell.el("span", "bl-tipp");
    tipp.setAttribute("aria-hidden", "true");
    const ns = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(ns, "svg");
    svg.setAttribute("viewBox", "0 0 64 64");
    [
      { r: 22, stroke: "rgba(255,255,255,0.45)", w: 5 },
      { r: 22, stroke: "#ffffff", w: 5, klasse: "bl-tipp-fuell" },
    ].forEach((ring) => {
      const kreis = document.createElementNS(ns, "circle");
      kreis.setAttribute("cx", "32");
      kreis.setAttribute("cy", "32");
      kreis.setAttribute("r", String(ring.r));
      kreis.setAttribute("fill", "none");
      kreis.setAttribute("stroke", ring.stroke);
      kreis.setAttribute("stroke-width", String(ring.w));
      if (ring.klasse) {
        kreis.setAttribute("class", ring.klasse);
        kreis.setAttribute("stroke-linecap", "round");
      }
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

  function messen() {
    if (!canvas || !feld) return;
    const cssW = Math.max(80, feld.clientWidth);
    const cssH = Math.max(80, feld.clientHeight);
    const dpr = clamp(window.devicePixelRatio || 1, 1, 2.5);
    // Auf dem Handy reicht die Leinwand unter die Knöpfe oben (game-shell.js,
    // frei). Gemalt wird dort auch – aber was zählt, steht darunter.
    const frei = Math.min(cssH * 0.4, shell?.frei?.(canvas) || 0);
    if (cssW === view.cssW && cssH === view.cssH && dpr === view.dpr && frei === view.frei) return;
    view.cssW = cssW;
    view.cssH = cssH;
    view.dpr = dpr;
    view.frei = frei;
    const nutzH = cssH - frei;
    view.w = clamp(SICHT_H * (cssW / nutzH), WELT_W, WELT_W_MAX);
    // Die ganze Höhe steht immer im Bild; ist es dafür zu flach, steht vorn
    // ein Stück mehr Welt.
    view.s = Math.min(cssW / view.w, nutzH / SICHT_H);
    view.w = cssW / view.s;
    view.h = cssH / view.s;
    view.nutz = nutzH / view.s;
    const pw = Math.round(cssW * dpr);
    const ph = Math.round(cssH * dpr);
    if (canvas.width !== pw) canvas.width = pw;
    if (canvas.height !== ph) canvas.height = ph;
    // Ist das Bild höher als nötig, steht das meiste davon unten: mehr
    // Gebirge, weniger Gewitterdecke.
    state.camY = SICHT_UNTEN - (view.nutz - SICHT_H) * 0.72;
  }

  const camXZiel = () => state.f.x - view.w * state.an;

  // Wo der Ballon im Bild stehen soll: weit links, wenn ihn der Wind nach
  // Osten trägt (man sieht voraus), weiter in der Mitte, wenn er
  // zurücktreibt (man sieht die Front kommen).
  function anZiel() {
    const T = tempoBei(state.f.x);
    return lerp(AN_VORN, AN_HINTEN, clamp((T * 0.8 - state.f.vx) / (T * 1.1), 0, 1));
  }

  const wackel = () => (ruhig() ? 0 : Math.sin(state.zeit * 70) * 4 * state.stoss);

  function bildTransform() {
    g.setTransform(view.dpr, 0, 0, view.dpr, 0, wackel() * view.dpr);
  }

  function weltTransform() {
    const f = view.s * view.dpr;
    g.setTransform(f, 0, 0, -f, -state.camX * f, (view.cssH + state.camY * view.s + wackel()) * view.dpr);
  }

  const bildX = (x) => (x - state.camX) * view.s;
  const bildY = (y) => view.cssH - (y - state.camY) * view.s;

  // ---------------------------------------------------------------------------
  // Vorgemalt: Wolken, Gewitterballen, Lichter
  // ---------------------------------------------------------------------------
  // Was oft und weich gezeichnet wird, liegt fertig auf kleinen Leinwänden –
  // einmal gemalt, tausendmal kopiert.
  function leinwand(b, h) {
    const c = document.createElement("canvas");
    c.width = b;
    c.height = h;
    return c;
  }

  // Ein Licht: rund, innen voll, nach aussen weich.
  function lichtBild(rgb, kern = 0) {
    const c = leinwand(128, 128);
    const x = c.getContext("2d");
    const v = x.createRadialGradient(64, 64, 0, 64, 64, 64);
    v.addColorStop(0, farbe(rgb, 1));
    if (kern) v.addColorStop(kern, farbe(rgb, 0.85));
    v.addColorStop(0.45, farbe(rgb, 0.32));
    v.addColorStop(1, farbe(rgb, 0));
    x.fillStyle = v;
    x.fillRect(0, 0, 128, 128);
    return c;
  }

  // Ein Gewitterballen: bis 86 % des Halbmessers voll – genau dort trifft
  // er –, darüber ein weicher Saum, der nicht trifft.
  function ballenBild(innen, aussen) {
    const c = leinwand(160, 160);
    const x = c.getContext("2d");
    const v = x.createRadialGradient(70, 62, 0, 80, 80, 80);
    v.addColorStop(0, farbe(innen, 1));
    v.addColorStop(0.84, farbe(aussen, 1));
    v.addColorStop(0.865, farbe(aussen, 0.9));
    v.addColorStop(0.93, farbe(aussen, 0.35));
    v.addColorStop(1, farbe(aussen, 0));
    x.fillStyle = v;
    x.fillRect(0, 0, 160, 160);
    return c;
  }

  // Eine Schönwetterwolke aus weichen Ballen, oben hell, unten im Schatten.
  // Drei Formen, je in vier Farben (Morgen, Tag, Abend, Nacht).
  const WOLKEN_FARBEN = [
    { hell: "#ffe2d2", schatten: "#c99bb4" },
    { hell: "#ffffff", schatten: "#c3d3e8" },
    { hell: "#ffc995", schatten: "#b07689" },
    { hell: "#8a95c4", schatten: "#3f4a78" },
  ].map((f) => ({ hell: hex(f.hell), schatten: hex(f.schatten) }));

  function wolkenBild(form, farben) {
    const c = leinwand(256, 128);
    const x = c.getContext("2d");
    const ballen = 7 + form * 2;
    for (let n = 0; n < ballen; n += 1) {
      const h = (k) => hash01(form * 31.7 + n * 7.3 + k * 1.9);
      const u = (n + 0.5) / ballen;
      const r = lerp(22, 44, h(1)) * (1 - Math.abs(u - 0.5) * 0.9);
      const cx = 30 + u * 196 + (h(2) - 0.5) * 16;
      const cy = 86 - r * lerp(0.5, 0.95, h(3)) - (1 - Math.abs(u - 0.5) * 2) * 18;
      const v = x.createRadialGradient(cx, cy - r * 0.3, r * 0.1, cx, cy, r);
      v.addColorStop(0, farbe(farben.hell, 1));
      v.addColorStop(0.6, farbe(mische(farben.hell, farben.schatten, 0.35), 0.95));
      v.addColorStop(1, farbe(farben.schatten, 0));
      x.fillStyle = v;
      x.beginPath();
      x.arc(cx, cy, r, 0, Math.PI * 2);
      x.fill();
    }
    // Unten ein flacher Schatten, damit die Wolke aufliegt.
    x.globalCompositeOperation = "source-atop";
    const unten = x.createLinearGradient(0, 40, 0, 110);
    unten.addColorStop(0, farbe(farben.schatten, 0));
    unten.addColorStop(1, farbe(farben.schatten, 0.75));
    x.fillStyle = unten;
    x.fillRect(0, 0, 256, 128);
    return c;
  }

  const BILDER = {
    wolken: [0, 1, 2].map((form) => WOLKEN_FARBEN.map((f) => wolkenBild(form, f))),
    ballenTag: ballenBild(hex("#6c7192"), hex("#2f3249")),
    ballenNacht: ballenBild(hex("#463f72"), hex("#1b1c35")),
    ballenLicht: lichtBild(hex("#e6e3f6")),
    glut: lichtBild(hex("#c9b8ff")),
    flamme: lichtBild(hex("#ffae4a"), 0.12),
    sonne: lichtBild(hex("#fff0c0"), 0.08),
    mond: lichtBild(hex("#dfe8ff")),
    gold: lichtBild(hex("#ffd977"), 0.1),
  };

  // Dieselben Bilder in genau der Grösse, in der sie ins Bild kommen – in
  // Gerätepunkten, auf eine Stufe gerundet. Ein Bild nur zu kopieren ist für
  // den Browser viel billiger, als es zu strecken.
  const groessen = new WeakMap();
  function inGroesse(bild, b, h) {
    let m = groessen.get(bild);
    if (!m) {
      m = new Map();
      groessen.set(bild, m);
    }
    const key = b * 100000 + h;
    let c = m.get(key);
    if (!c) {
      c = leinwand(b, h);
      c.getContext("2d").drawImage(bild, 0, 0, b, h);
      m.set(key, c);
      if (m.size > 72) m.delete(m.keys().next().value);
    }
    return c;
  }

  // Ein Bild in das Rechteck (x, y, b, h) – alles in Gerätepunkten, die
  // Leinwand x ohne Verschiebung oder Massstab.
  function stempel(x, bild, px, py, b, h, stufe = 4) {
    const B = Math.max(stufe, Math.round(b / stufe) * stufe);
    const H = Math.max(stufe, Math.round(h / stufe) * stufe);
    x.drawImage(inGroesse(bild, B, H), Math.round(px + (b - B) / 2), Math.round(py + (h - H) / 2));
  }

  // ---------------------------------------------------------------------------
  // Zeichnen: Himmel und Ferne
  // ---------------------------------------------------------------------------
  const STERNE = Array.from({ length: 150 }, (_, i) => ({
    x: hash01(i * 3.1 + 1), y: hash01(i * 5.7 + 2), r: 0.6 + hash01(i * 7.3 + 3) * 1.3, t: hash01(i * 9.1 + 4) * 6.28,
  }));

  // Wo der Horizont im Bild steht, und die Sonne.
  const horizontY = () => bildY(36);
  // Wo der freie Himmel beginnt: unter der Gewitterdecke.
  const himmelOben = () => Math.max(view.frei, bildY(DECKE - 26));

  function sonnenOrt(hoehe = tag.sonne) {
    const hy = horizontY();
    const top = himmelOben();
    return { x: view.cssW * 0.76, y: hy - hoehe * (hy - top) * 1.25, r: clamp(Math.min(view.cssH, view.cssW) * 0.045, 10, 26) };
  }

  function mondOrt() {
    const hy = horizontY();
    return { x: view.cssW * 0.62, y: himmelOben() + (hy - himmelOben()) * 0.2, r: clamp(view.cssH * 0.03, 10, 22) };
  }

  // Der Himmel hängt nicht an der Kamera: Verlauf, Sonne und Mond liegen
  // fertig gemalt in einem Bild in voller Auflösung, das jedes Bild nur
  // kopiert wird – das kostet kaum etwas. Ändert sich das Licht, entsteht
  // nebenher ein neues, Streifen für Streifen, und wird getauscht, sobald es
  // fertig ist. Nur die Sterne funkeln Bild für Bild darüber.
  const HIMMEL_STREIFEN = 10;
  const himmel = { bilder: [null, null], zeigt: 0, key: "", baut: null };

  function himmelKey() {
    const c = (rgb) => `${Math.round(rgb[0] / 6)},${Math.round(rgb[1] / 6)},${Math.round(rgb[2] / 6)}`;
    return `${c(tag.oben)}|${c(tag.mitte)}|${c(tag.horizont)}|${c(tag.licht)}|${Math.round(tag.sonne * 150)}|${Math.round(tag.nacht * 24)}`;
  }

  // Wo man den Himmel überhaupt sieht: unter der Gewitterdecke und über dem
  // Fuss der fernsten Berge. Nur dieses Band liegt im Bild bereit.
  function himmelBand() {
    const oben = Math.max(0, Math.floor(bildY(DECKE + 34)));
    const unten = Math.min(view.cssH, Math.ceil(bildY(LAGEN[0].fuss + 4)));
    return { oben, unten: Math.max(oben + 1, unten) };
  }

  function himmelBild(n, band) {
    let c = himmel.bilder[n];
    if (!c) {
      c = document.createElement("canvas");
      himmel.bilder[n] = c;
    }
    const h = Math.ceil((band.unten - band.oben) * view.dpr);
    if (c.width !== canvas.width) c.width = canvas.width;
    if (c.height !== h) c.height = h;
    return c;
  }

  // Ein Streifen [y0, y1] des Himmels (in CSS-Pixeln) mit dem Licht t.
  function maleHimmel(x, t, y0, y1, band) {
    const W = view.cssW;
    const hy = horizontY();
    x.save();
    x.setTransform(view.dpr, 0, 0, view.dpr, 0, -band.oben * view.dpr);
    x.beginPath();
    x.rect(0, y0, W, y1 - y0);
    x.clip();
    const verlauf = x.createLinearGradient(0, 0, 0, hy);
    verlauf.addColorStop(0, farbe(t.oben));
    verlauf.addColorStop(0.62, farbe(t.mitte));
    verlauf.addColorStop(1, farbe(t.horizont));
    x.fillStyle = verlauf;
    x.fillRect(0, y0, W, y1 - y0);
    if (t.nacht > 0.02) {
      const m = mondOrt();
      const d = view.dpr;
      x.setTransform(1, 0, 0, 1, 0, 0);
      x.globalCompositeOperation = "lighter";
      x.globalAlpha = t.nacht * 0.5;
      stempel(x, BILDER.mond, (m.x - m.r * 6) * d, (m.y - m.r * 6 - band.oben) * d, m.r * 12 * d, m.r * 12 * d, 8);
      x.globalCompositeOperation = "source-over";
      x.setTransform(d, 0, 0, d, 0, -band.oben * d);
      x.globalAlpha = t.nacht;
      x.fillStyle = "#f2f4ff";
      x.beginPath();
      x.arc(m.x, m.y, m.r, 0, Math.PI * 2);
      x.fill();
      x.fillStyle = "rgba(160, 170, 210, 0.45)";
      [[-0.3, -0.2, 0.22], [0.25, 0.15, 0.16], [-0.05, 0.4, 0.12], [0.35, -0.35, 0.1]].forEach(([dx, dy, r]) => {
        x.beginPath();
        x.arc(m.x + dx * m.r, m.y + dy * m.r, r * m.r, 0, Math.PI * 2);
        x.fill();
      });
      x.globalAlpha = 1;
    }
    // Die Sonne mit ihrem Schein – hinter den Bergen geht sie unter.
    if (t.sonne > -0.12) {
      const so = sonnenOrt(t.sonne);
      const sicht = clamp((t.sonne + 0.12) / 0.16, 0, 1);
      const d = view.dpr;
      x.setTransform(1, 0, 0, 1, 0, 0);
      x.globalCompositeOperation = "lighter";
      x.globalAlpha = 0.55 * sicht;
      const R = so.r * (t.sonne < 0.2 ? 5.5 : 4);
      stempel(x, BILDER.sonne, (so.x - R) * d, (so.y - R - band.oben) * d, R * 2 * d, R * 2 * d, 8);
      x.globalCompositeOperation = "source-over";
      x.setTransform(d, 0, 0, d, 0, -band.oben * d);
      x.globalAlpha = sicht;
      x.fillStyle = farbe(mische([255, 250, 230], t.licht, 0.4));
      x.beginPath();
      x.arc(so.x, so.y, so.r, 0, Math.PI * 2);
      x.fill();
      x.globalAlpha = 1;
    }
    x.restore();
  }

  function zeichneHimmel() {
    const band = himmelBand();
    const groesse = `${canvas.width}x${canvas.height}|${band.oben}|${band.unten}|${Math.round(state.camY)}|`;
    const key = groesse + himmelKey();
    if (!himmel.bilder[himmel.zeigt] || !himmel.key.startsWith(groesse)) {
      // Das erste Bild (oder eine neue Grösse): sofort ganz.
      const c = himmelBild(himmel.zeigt, band);
      maleHimmel(c.getContext("2d"), { ...tag }, band.oben, band.unten, band);
      himmel.key = key;
      himmel.baut = null;
    } else if (key !== himmel.key && !himmel.baut) {
      himmel.baut = { key, t: { ...tag }, streifen: 0 };
    }
    if (himmel.baut) {
      const b = himmel.baut;
      const c = himmelBild(1 - himmel.zeigt, band);
      const hoch = band.unten - band.oben;
      const y0 = band.oben + (hoch * b.streifen) / HIMMEL_STREIFEN;
      const y1 = band.oben + (hoch * (b.streifen + 1)) / HIMMEL_STREIFEN;
      maleHimmel(c.getContext("2d"), b.t, Math.floor(y0) - 1, Math.ceil(y1) + 1, band);
      b.streifen += 1;
      if (b.streifen >= HIMMEL_STREIFEN) {
        himmel.zeigt = 1 - himmel.zeigt;
        himmel.key = b.key;
        himmel.baut = null;
      }
    }
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.drawImage(himmel.bilder[himmel.zeigt], 0, Math.round((band.oben + wackel()) * view.dpr));

    // Sterne in drei Helligkeiten, je in einem Zug – sie funkeln, indem sie
    // die Stufe wechseln.
    if (tag.nacht > 0.02) {
      bildTransform();
      const W = view.cssW;
      const hy = horizontY();
      g.fillStyle = "#ffffff";
      for (let stufe = 0; stufe < 3; stufe += 1) {
        g.globalAlpha = tag.nacht * (0.35 + stufe * 0.3);
        g.beginPath();
        STERNE.forEach((s, n) => {
          const funkeln = ruhig() ? n % 3 : Math.floor((Math.sin(state.zeit * 1.7 + s.t) * 0.5 + 0.5) * 2.99);
          if (funkeln !== stufe) return;
          const x = s.x * W;
          const y = s.y * hy * 0.92;
          g.rect(x, y, s.r, s.r);
        });
        g.fill();
      }
      g.globalAlpha = 1;
    }
  }

  // Vier Lagen Berge, die verschieden schnell vorbeiziehen – je weiter weg,
  // desto blasser im Dunst. Die beiden hinteren tragen Schnee. Sie bleiben
  // niedrig: Der Himmel darüber gehört den Windschichten.
  const LAGEN = [
    { p: 0.05, fuss: 26, hoch: 140, f: 1 / 240, saat: 1, scharf: true, dunst: 0.7, schnee: 138 },
    { p: 0.12, fuss: 12, hoch: 118, f: 1 / 180, saat: 2, scharf: true, dunst: 0.55, schnee: 112 },
    { p: 0.24, fuss: -4, hoch: 86, f: 1 / 140, saat: 3, scharf: false, dunst: 0.4, schnee: 0 },
    { p: 0.4, fuss: -16, hoch: 58, f: 1 / 100, saat: 4, scharf: false, dunst: 0.24, schnee: 0 },
  ];

  function lagenHoehe(lage, sx) {
    const u = (sx / view.s + state.camX * lage.p) * lage.f;
    return lage.fuss + lage.hoch * grat(u, lage.saat, lage.scharf);
  }

  // Die Umrisse der fernen Lagen und des Gebirges vorn, Spalte für Spalte
  // im Bild. Gefüllt wird jede Lage nur bis dorthin, wo die nächste (oder
  // das Gebirge) sie sicher verdeckt – so wird jeder Punkt des Hintergrunds
  // fast nur einmal gemalt.
  const FERNE_SCHRITT = 7;
  const ferneY = LAGEN.map(() => []);
  const vorneY = [];

  function umrisseRechnen() {
    const zahl = Math.ceil((view.cssW + 20) / FERNE_SCHRITT) + 1;
    LAGEN.forEach((lage, n) => {
      const ys = ferneY[n];
      ys.length = zahl;
      for (let i = 0; i < zahl; i += 1) ys[i] = bildY(lagenHoehe(lage, -10 + i * FERNE_SCHRITT));
    });
    vorneY.length = zahl;
    for (let i = 0; i < zahl; i += 1) {
      const x = state.camX + (-10 + i * FERNE_SCHRITT) / view.s;
      vorneY[i] = bildY(roh(x)) + 12;
    }
  }

  function zeichneFerne() {
    bildTransform();
    const zahl = ferneY[0].length;
    LAGEN.forEach((lage, n) => {
      const ys = ferneY[n];
      const naechste = n < LAGEN.length - 1 ? ferneY[n + 1] : null;
      const c = mische(mische(tag.fern, tag.wiese, n / 5), tag.horizont, lage.dunst);
      g.beginPath();
      for (let i = 0; i < zahl; i += 1) (i ? g.lineTo(-10 + i * FERNE_SCHRITT, ys[i]) : g.moveTo(-10, ys[i]));
      for (let i = zahl - 1; i >= 0; i -= 1) {
        const unten = Math.min(vorneY[i], naechste ? naechste[i] + 2 : Infinity);
        g.lineTo(-10 + i * FERNE_SCHRITT, Math.max(ys[i], unten));
      }
      g.closePath();
      // Je weiter weg, desto mehr im Dunst – eine Farbe je Lage; ein Verlauf
      // über so viel Fläche kostete zu viel.
      g.fillStyle = farbe(c);
      g.fill();
      if (lage.schnee) {
        // Schnee: zwischen dem Umriss und einer welligen Schneegrenze.
        const sy = bildY(lage.schnee);
        const grenze = (sx) => sy + (rausch((sx / view.s + state.camX * lage.p) * 0.045 + n * 7) - 0.5) * 26 * view.s;
        g.fillStyle = farbe(mische(mische([250, 252, 255], tag.licht, 0.35), tag.horizont, lage.dunst * 0.7), 0.85 * (0.5 + 0.5 * tag.hell));
        g.beginPath();
        for (let i = 0; i < zahl; i += 1) {
          const sx = -10 + i * FERNE_SCHRITT;
          const y = Math.min(ys[i], grenze(sx));
          if (i === 0) g.moveTo(sx, y);
          else g.lineTo(sx, y);
        }
        for (let i = zahl - 1; i >= 0; i -= 1) {
          const sx = -10 + i * FERNE_SCHRITT;
          g.lineTo(sx, Math.min(grenze(sx), naechste ? Math.max(ys[i], naechste[i]) : Infinity));
        }
        g.closePath();
        g.fill();
      }
    });
  }

  // Schönwetterwolken in der Ferne und Vögel – nur Schmuck.
  const FERNWOLKEN = Array.from({ length: 3 }, (_, i) => ({
    x: hash01(i * 4.1 + 7), y: 230 + hash01(i * 2.3 + 1) * 120, b: 110 + hash01(i * 6.7 + 2) * 120, form: i % 3, p: 0.06 + hash01(i * 3.3) * 0.1,
  }));

  // Eine Schönwetterwolke, fertig in ihrer Grösse im Bild (in Gerätepunkten)
  // gemalt: So wird sie Bild für Bild nur kopiert, nicht gestreckt.
  function zeichneWolkeFertig(halter, form, x, y, b, alpha) {
    const dpr = view.dpr;
    const key = `${form}|${Math.round(b * dpr)}|${tag.wolke.map((w) => Math.round(w * 12)).join(",")}|${Math.round(tag.nacht * 12)}|${alpha}`;
    if (!halter.bild || halter.bild.key !== key) {
      const c = halter.bild?.c || document.createElement("canvas");
      c.width = Math.max(1, Math.ceil(b * dpr));
      c.height = Math.max(1, Math.ceil(b * 0.5 * dpr));
      const echt = g;
      g = c.getContext("2d");
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, b, b * 0.5);
      zeichneWolkenBild(form, b / 2, b * 0.375, b, alpha);
      g.globalAlpha = 1;
      g = echt;
      halter.bild = { c, key };
    }
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.drawImage(halter.bild.c, Math.round((x - b / 2) * dpr), Math.round((y - b * 0.375 + wackel()) * dpr));
  }

  function zeichneWolkenBild(form, x, y, b, alpha) {
    const h = b * 0.5;
    alpha *= 1 - tag.nacht * 0.55;
    // Meist überwiegt eine Farbe – dann nur sie.
    let haupt = 0;
    tag.wolke.forEach((anteil, n) => { if (anteil > tag.wolke[haupt]) haupt = n; });
    tag.wolke.forEach((anteil, n) => {
      if (anteil < 0.02 || (tag.wolke[haupt] > 0.8 && n !== haupt)) return;
      g.globalAlpha = alpha * (tag.wolke[haupt] > 0.8 ? 1 : anteil);
      g.drawImage(BILDER.wolken[form][n], x - b / 2, y - h * 0.75, b, h);
    });
  }

  function zeichneFernwolken() {
    bildTransform();
    const W = view.cssW;
    FERNWOLKEN.forEach((w) => {
      const b = w.b * view.s;
      const breite = W + b * 2;
      const x = ((w.x * breite - (state.camX * w.p + state.zeit * 4) * view.s) % breite + breite) % breite - b;
      zeichneWolkeFertig(w, w.form, x, bildY(w.y), b, 0.45);
    });
    bildTransform();

    // Vögel: kleine Schwärme, die Flügel auf und ab – am Tag.
    const tagHell = 1 - tag.nacht;
    if (tagHell < 0.05) return;
    g.strokeStyle = farbe(mische([40, 40, 60], tag.fern, 0.3), 0.7 * tagHell);
    g.lineWidth = Math.max(1, 1.3 * view.s);
    g.lineCap = "round";
    const p = 0.55;
    const abstand = 1500;
    const von = Math.floor((state.camX * p - state.zeit * 26 - 200) / abstand);
    for (let k = von; k <= von + 2; k += 1) {
      if (hash01(k * 9.7) < 0.35) continue;
      const anzahl = 3 + Math.floor(hash01(k * 3.9) * 4);
      const ax = k * abstand + hash01(k * 5.1) * 600 + state.zeit * 26;
      const ay = 180 + hash01(k * 7.7) * 160;
      g.beginPath();
      for (let n = 0; n < anzahl; n += 1) {
        const bx = (ax - n * 16 - state.camX * p) * view.s;
        const by = bildY(ay - (n % 2 ? 1 : -1) * Math.ceil(n / 2) * 8 + Math.sin(state.zeit * 0.8 + k) * 6);
        const schlag = Math.sin(state.zeit * 9 + n * 1.3 + k) * 3.2 * view.s;
        const sp = 5 * view.s;
        g.moveTo(bx - sp, by - schlag);
        g.quadraticCurveTo(bx - sp * 0.4, by - schlag * 0.2, bx, by);
        g.quadraticCurveTo(bx + sp * 0.4, by - schlag * 0.2, bx + sp, by - schlag);
      }
      g.stroke();
    }
  }

  // Himmel, ferne Berge und ferne Wolken.
  function zeichneHintergrund() {
    umrisseRechnen();
    zeichneHimmel();
    zeichneFerne();
    zeichneFernwolken();
  }

  // Wie das Licht gerade fällt, grob gestuft: Ändert es sich, werden die
  // fertig gemalten Wolken und die Decke neu gemalt – höchstens eines je Bild.
  const toenung = () => `${Math.round(tag.nacht * 16)}|${Math.round(tag.hell * 16)}`;
  let neuGemalt = 0;

  // ---------------------------------------------------------------------------
  // Zeichnen: die Windschichten
  // ---------------------------------------------------------------------------
  /*
   * Die Schichten als Licht und Schatten: Der Wind wird auf einem groben
   * Raster über dem ganzen Himmel ausgerechnet – aus derselben Rechnung wie
   * für den Ballon –, in ein kleines Bild geschrieben und weich aufgezogen
   * (ein einziges Bild über den Himmel: mehr Fläche kostete auf dem Handy
   * zu viel). Was nach Osten trägt, hellt den Himmel golden auf (je
   * schneller, desto kräftiger, die schnellen orange); was zurück drückt,
   * legt einen blauen Schatten darüber. So steht es auf jedem Himmel, ob
   * Morgenrot oder Nacht. Übergänge und wogende Grenzen stehen von selbst
   * richtig im Bild.
   */
  const FELD = { bild: null, sp: 0, ze: 0 };
  const FELD_A = new Float64Array(8);
  const FELD_B = new Float64Array(8);
  const FELD_OBEN = DECKE + 20;
  const FELD_UNTEN = -10;

  function grenzenIn(s, x, t, ziel) {
    const gr = s.grenzen;
    for (let j = 0; j < gr.length; j += 1) ziel[j] = grenzeY(gr[j], x, t);
  }

  function stufen(s, hoehen, y) {
    const bd = s.baender;
    const n = s.grenzen.length;
    let w = bd[0].w;
    for (let j = 0; j < n; j += 1) {
      const u = (y - hoehen[j]) / SCHERUNG + 0.5;
      if (u <= 0) break;
      w += (bd[j + 1].w - bd[j].w) * (u >= 1 ? 1 : u * u * (3 - 2 * u));
    }
    return w;
  }

  function feldBild(sp, ze) {
    const c = document.createElement("canvas");
    c.width = sp;
    c.height = ze;
    const x = c.getContext("2d");
    return { c, x, bild: x.createImageData(sp, ze) };
  }

  function zeichneWindfeld() {
    const sp = clamp(Math.round(view.cssW / 16), 28, 84);
    const ze = clamp(Math.round((FELD_OBEN - FELD_UNTEN) / 5), 40, 100);
    if (!FELD.bild || FELD.sp !== sp || FELD.ze !== ze) {
      FELD.bild = feldBild(sp, ze);
      FELD.sp = sp;
      FELD.ze = ze;
    }
    const d = FELD.bild.bild.data;
    const l = state.welt.schichten;
    const t = state.uhr;
    const nacht = tag.nacht;
    // Nachts leuchten die Ostschichten etwas mehr, damit sie im Dunkeln stehen.
    const hell = lerp(0.46, 0.5, nacht);
    const schatten = lerp(0.36, 0.42, nacht);
    const ostG = lerp(240, 214, nacht);
    const ostB = lerp(184, 150, nacht);
    for (let i = 0; i < sp; i += 1) {
      const x = state.camX + ((i + 0.5) * view.w) / sp;
      const nr = schichtNr(x);
      const s = l[nr];
      let s2 = null;
      let k2 = 0;
      if (nr > 0 && x - s.x0 < UEBER / 2) {
        s2 = l[nr - 1];
        k2 = 1 - glatt(clamp(0.5 + (x - s.x0) / UEBER, 0, 1));
      } else if (nr < l.length - 1 && s.x1 - x < UEBER / 2) {
        s2 = l[nr + 1];
        k2 = glatt(clamp(0.5 - (s.x1 - x) / UEBER, 0, 1));
      }
      grenzenIn(s, x, t, FELD_A);
      if (s2) grenzenIn(s2, x, t, FELD_B);
      const T = tempoBei(x);
      for (let j = 0; j < ze; j += 1) {
        const y = FELD_OBEN - ((j + 0.5) * (FELD_OBEN - FELD_UNTEN)) / ze;
        let w = stufen(s, FELD_A, y);
        if (s2) w += (stufen(s2, FELD_B, y) - w) * k2;
        const r = w / T;
        const o = (j * sp + i) * 4;
        if (r > 0) {
          // Die schnellen Schichten werden orange.
          const schnell = clamp((r - 1.15) / 0.5, 0, 1);
          d[o] = 255;
          d[o + 1] = ostG - 70 * schnell;
          d[o + 2] = ostB - 90 * schnell;
          d[o + 3] = 255 * clamp(r * r * 0.5 * hell, 0, hell);
        } else {
          d[o] = 26;
          d[o + 1] = 44;
          d[o + 2] = 128;
          d[o + 3] = 255 * clamp((0.12 + 0.34 * -r) * schatten * 2.2, 0, schatten);
        }
      }
    }
    FELD.bild.x.putImageData(FELD.bild.bild, 0, 0);
    // Aufgezogen wird nur, was man sieht: unter der Decke und über dem
    // tiefsten Gelände im Bild.
    const y0 = bildY(FELD_OBEN);
    const zeile = (bildY(FELD_UNTEN) - y0) / ze;
    let tiefst = 0;
    for (let i = 0; i < vorneY.length; i += 1) tiefst = Math.max(tiefst, vorneY[i]);
    const r0 = clamp(Math.floor((bildY(DECKE - 12) - y0) / zeile), 0, ze - 1);
    const r1 = clamp(Math.ceil((tiefst - y0) / zeile) + 1, r0 + 1, ze);
    g.setTransform(view.dpr, 0, 0, view.dpr, 0, wackel() * view.dpr);
    g.imageSmoothingEnabled = true;
    g.drawImage(FELD.bild.c, 0, r0, sp, r1 - r0, 0, y0 + r0 * zeile, view.cssW, (r1 - r0) * zeile);
  }

  /*
   * Pfeile in den Schichten, fest im Gelände: golden nach rechts, blau nach
   * links, doppelt in den schnellen. Sie gleiten langsam in ihre Richtung –
   * so liest man auch auf einem stehenden Bild, wie es weht.
   */
  const PFEIL_Y = new Float64Array(8);
  const PFEIL_ABSTAND = 130;
  const pfeilListe = [[], [], [], []];   // Ost, schnell, lahm, West: je x, y, Grösse, Richtung

  function zeichnePfeile() {
    const l = state.welt.schichten;
    const t = state.uhr;
    const von = state.camX - 40;
    const bis = state.camX + view.w + 40;
    pfeilListe.forEach((liste) => { liste.length = 0; });
    const lauf = ruhig() ? 0.5 : (state.zeit * 0.55) % 1;
    for (let i = schichtNr(von); i < l.length && l[i].x0 < bis; i += 1) {
      const s = l[i];
      const a = Math.max(von, s.x0 + UEBER * 0.55);
      const b = Math.min(bis, s.x1 - UEBER * 0.55);
      if (b <= a) continue;
      const T = tempoBei(s.x0);
      const n = s.baender.length;
      for (let x0 = Math.ceil(a / PFEIL_ABSTAND) * PFEIL_ABSTAND; x0 <= b; x0 += PFEIL_ABSTAND) {
        grenzenIn(s, x0, t, PFEIL_Y);
        for (let j = 0; j < n; j += 1) {
          const band = s.baender[j];
          const r = band.w / T;
          const richtung = band.w >= 0 ? 1 : -1;
          const x = x0 + ((j % 2) * PFEIL_ABSTAND) / 2 + richtung * (lauf - 0.5) * 22;
          if (x < a || x > b) continue;
          const boden = roh(x) + 8;
          const lo = Math.max(j > 0 ? PFEIL_Y[j - 1] : boden, boden);
          const hi = Math.min(j < n - 1 ? PFEIL_Y[j] : DECKE - 12, DECKE - 12);
          if (hi - lo < 30) continue;
          const gross = clamp((hi - lo) * 0.2, 7, 16);
          const art = band.art === "schnell" ? 1 : r < 0 ? 3 : r < 0.6 ? 2 : 0;
          pfeilListe[art].push(x, (lo + hi) / 2, gross, richtung);
        }
      }
    }
    bildTransform();
    const s = view.s;
    const sicht = Math.sin(Math.PI * lauf) * 0.35 + 0.65;
    const FARBEN = ["255, 236, 170", "255, 196, 120", "255, 240, 200", "190, 210, 255"];
    const ALPHA = [0.55, 0.62, 0.3, 0.5];
    g.lineCap = "round";
    g.lineJoin = "round";
    pfeilListe.forEach((liste, art) => {
      if (!liste.length) return;
      g.strokeStyle = `rgba(${FARBEN[art]}, ${(ALPHA[art] * sicht).toFixed(3)})`;
      g.lineWidth = Math.max(1.5, 2.6 * s);
      g.beginPath();
      for (let n = 0; n < liste.length; n += 4) {
        const x = bildX(liste[n]);
        const y = bildY(liste[n + 1]);
        const gr = liste[n + 2] * s;
        const ri = liste[n + 3];
        const doppelt = art === 1 ? 2 : 1;
        for (let d = 0; d < doppelt; d += 1) {
          const dx = d * gr * 0.75 * ri;
          g.moveTo(x - ri * gr * 0.5 + dx, y - gr * 0.7);
          g.lineTo(x + ri * gr * 0.3 + dx, y);
          g.lineTo(x - ri * gr * 0.5 + dx, y + gr * 0.7);
        }
      }
      g.stroke();
    });
  }

  // Die Grenzen der Schichten als feine Linien – wo sie wechseln, sieht man
  // genau, wo man hin muss. Im Übergang zwischen zwei Abschnitten blenden
  // sie aus.
  function zeichneGrenzen() {
    const l = state.welt.schichten;
    const t = state.uhr;
    const von = state.camX - 20;
    const bis = state.camX + view.w + 20;
    const schritt = 14;
    bildTransform();
    g.lineWidth = Math.max(1, 1.1 * view.s);
    g.lineCap = "round";
    g.setLineDash([3 * view.s, 7 * view.s]);
    for (let i = schichtNr(von); i < l.length && l[i].x0 < bis; i += 1) {
      const s = l[i];
      const a = Math.max(von, s.x0 + UEBER * 0.35);
      const b = Math.min(bis, s.x1 - UEBER * 0.35);
      if (b <= a) continue;
      s.grenzen.forEach((gr, j) => {
        const oben = s.baender[j + 1].w;
        const unten = s.baender[j].w;
        // Wo der Wind kippt (Ost auf West), deutlicher.
        const kippt = (oben > 0) !== (unten > 0);
        g.strokeStyle = kippt ? "rgba(255, 255, 255, 0.5)" : "rgba(255, 255, 255, 0.26)";
        g.beginPath();
        for (let x = a; x <= b + 0.01; x += schritt) {
          const xx = Math.min(x, b);
          const y = bildY(grenzeY(gr, xx, t));
          if (x === a) g.moveTo(bildX(xx), y);
          else g.lineTo(bildX(xx), y);
        }
        g.stroke();
      });
    }
    g.setLineDash([]);
  }

  /*
   * Der Wind, den man sieht: Windstreifen und Wolkenfetzen, die mit dem
   * Wind ihrer Stelle ziehen. Jeder Streifen hat einen hellen Kopf vorn und
   * einen Schweif hinten – so sieht man auch an einem stehenden Bild, wohin
   * er weht, nicht nur daran, wie er sich gegen die Kamera bewegt.
   */
  function schlierenPflegen(dt) {
    const soll = Math.round((view.w * SICHT_H) / (ruhig() ? 9000 : 3200));
    const vKam = state.schritt === "fahrt" ? state.f.vx : 0;
    const neu = (s, ueberall) => {
      s.y = lerp(10, DECKE - 6, Math.random());
      s.w = windBei(state.camX + view.w * 0.5, s.y);
      const rechts = s.w < vKam;
      s.x = ueberall ? state.camX + Math.random() * view.w : rechts ? state.camX + view.w + 20 + Math.random() * 60 : state.camX - 60 - Math.random() * 40;
      s.len = 14 + Math.random() * 26;
      s.alpha = 0.55 + Math.random() * 0.45;
      return s;
    };
    const liste = state.schlieren;
    const anfang = liste.length === 0;
    while (liste.length < soll) liste.push(neu({}, anfang));
    if (liste.length > soll) liste.length = soll;
    for (let i = liste.length - 1; i >= 0; i -= 1) {
      const s = liste[i];
      s.w = windBei(s.x, s.y);
      s.x += s.w * dt;
      if (s.x < state.camX - 100 || s.x > state.camX + view.w + 100 || roh(s.x) > s.y - 4) neu(s, false);
    }

    const fetzen = state.fetzen;
    const sollF = ruhig() ? 2 : 5;
    while (fetzen.length < sollF) fetzen.push({ x: state.camX + Math.random() * view.w * 1.4, y: lerp(40, DECKE - 50, Math.random()), b: 34 + Math.random() * 40, form: Math.floor(Math.random() * 3) });
    fetzen.forEach((w) => {
      w.x += windBei(w.x, w.y) * dt;
      if (w.x < state.camX - 120 || w.x > state.camX + view.w + 160) {
        w.y = lerp(40, DECKE - 50, Math.random());
        w.x = windBei(state.camX + view.w * 0.5, w.y) < vKam ? state.camX + view.w + 60 + Math.random() * 80 : state.camX - 110;
      }
    });
  }

  function zeichneWind() {
    bildTransform();
    const s = view.s;
    state.fetzen.forEach((w) => {
      if (roh(w.x) > w.y - 10) return;
      zeichneWolkeFertig(w, w.form, bildX(w.x), bildY(w.y), w.b * s, 0.4);
    });
    bildTransform();
    const T = tempoBei(state.f.x);
    g.lineCap = "round";
    const licht = mische([255, 255, 255], tag.licht, 0.3);
    // Zwei Farben (Ost hell-golden, West hell-blau), je zwei Stärken: erst
    // die Schweife, dann die Köpfe.
    for (let ost = 0; ost < 2; ost += 1) {
      const c = ost ? mische(licht, [255, 230, 160], 0.35) : mische(licht, [170, 200, 255], 0.45);
      for (let stufe = 0; stufe < 2; stufe += 1) {
        g.strokeStyle = farbe(c, (0.16 + stufe * 0.14) * (0.65 + 0.35 * tag.hell));
        g.lineWidth = Math.max(1, 1.1 * s);
        g.beginPath();
        for (const l of state.schlieren) {
          if ((l.w > 0 ? 1 : 0) !== ost || (l.alpha > 0.78 ? 1 : 0) !== stufe) continue;
          const r = Math.abs(l.w) / T;
          if (r < 0.06) continue;
          const lang = l.len * clamp(0.35 + 0.65 * r, 0.35, 1.6) * s;
          const x = bildX(l.x);
          const y = bildY(l.y);
          const richtung = l.w > 0 ? 1 : -1;
          g.moveTo(x, y);
          g.lineTo(x - lang * richtung, y);
        }
        g.stroke();
        g.strokeStyle = farbe(c, (0.45 + stufe * 0.3) * (0.65 + 0.35 * tag.hell));
        g.lineWidth = Math.max(1.4, 1.9 * s);
        g.beginPath();
        for (const l of state.schlieren) {
          if ((l.w > 0 ? 1 : 0) !== ost || (l.alpha > 0.78 ? 1 : 0) !== stufe) continue;
          const r = Math.abs(l.w) / T;
          if (r < 0.06) continue;
          const x = bildX(l.x);
          const y = bildY(l.y);
          const richtung = l.w > 0 ? 1 : -1;
          g.moveTo(x, y);
          g.lineTo(x - 3.5 * s * richtung, y);
        }
        g.stroke();
      }
    }
  }

  /*
   * Am rechten Rand: wie es voraus weht. Für jede Schicht dort ein kleines
   * Schild mit Pfeilen – nach rechts golden, nach links blau, ein bis drei
   * Pfeile je nach Stärke –, die in ihrer Richtung ziehen.
   */
  const ZEIGER_Y = new Float64Array(8);
  function zeichneZeiger() {
    const s = view.s;
    const xr = state.camX + view.w - 16 / s;
    const sc = schichtBei(xr);
    grenzenIn(sc, xr, state.uhr, ZEIGER_Y);
    const T = tempoBei(xr);
    const n = sc.baender.length;
    const boden = Math.max(TAL, roh(xr));
    bildTransform();
    const gross = clamp(view.cssH * 0.022, 8, 12);
    const rechts = view.cssW - 8;
    const lauf = ruhig() ? 0 : (state.zeit * 1.4) % 1;
    const schritt = gross * 0.85;
    const rand = gross * 0.75;
    for (let j = 0; j < n; j += 1) {
      const lo = Math.max(j > 0 ? ZEIGER_Y[j - 1] : boden, boden);
      const hi = Math.min(j < n - 1 ? ZEIGER_Y[j] : DECKE - 8, DECKE - 8);
      if (hi - lo < 26) continue;
      const w = sc.baender[j].w;
      const r = w / T;
      const zahl = Math.abs(r) > 1.3 ? 3 : Math.abs(r) > 0.55 ? 2 : 1;
      const richtung = w >= 0 ? 1 : -1;
      const y = bildY((lo + hi) / 2);
      if (y < view.frei + gross * 2) continue;
      const breit = rand * 2 + zahl * schritt;
      const links = rechts - breit;
      // Ein dunkles Schild darunter, damit die Pfeile auf jedem Himmel stehen.
      g.fillStyle = "rgba(18, 22, 48, 0.45)";
      g.beginPath();
      if (g.roundRect) g.roundRect(links, y - gross * 1.05, breit, gross * 2.1, gross * 1.05);
      else g.rect(links, y - gross * 1.05, breit, gross * 2.1);
      g.fill();
      g.strokeStyle = w >= 0 ? (r > 1.3 ? "#ffb070" : "#ffd977") : "#9ec0ff";
      g.lineWidth = Math.max(1.6, gross * 0.3);
      g.lineJoin = "round";
      g.lineCap = "round";
      // Ein Lichtschein läuft in Windrichtung über die Pfeile.
      for (let p = 0; p < zahl; p += 1) {
        const cx = richtung > 0 ? links + rand + (p + 0.5) * schritt : rechts - rand - (p + 0.5) * schritt;
        g.globalAlpha = 0.4 + 0.6 * Math.max(0, Math.cos(Math.PI * 2 * (p / Math.max(2, zahl) - lauf)));
        g.beginPath();
        g.moveTo(cx - richtung * gross * 0.32, y - gross * 0.52);
        g.lineTo(cx + richtung * gross * 0.24, y);
        g.lineTo(cx - richtung * gross * 0.32, y + gross * 0.52);
        g.stroke();
      }
      g.globalAlpha = 1;
    }
  }

  // ---------------------------------------------------------------------------
  // Zeichnen: Gewitter
  // ---------------------------------------------------------------------------
  // Ein Ballen aus den vorgemalten: tags grau, nachts violett.
  // Alles in Gerätepunkten, die Leinwand ohne Verschiebung.
  function ballen(x, y, r, alpha = 1) {
    const R = r / 0.86;
    const nacht = tag.nacht;
    if (nacht < 0.98) {
      g.globalAlpha = alpha;
      stempel(g, BILDER.ballenTag, x - R, y - R, R * 2, R * 2, 6);
    }
    if (nacht > 0.02) {
      g.globalAlpha = alpha * nacht;
      stempel(g, BILDER.ballenNacht, x - R, y - R, R * 2, R * 2, 6);
    }
  }

  function zeichneWolken() {
    const w = state.welt;
    const von = state.camX - 80;
    const bis = state.camX + view.w + 80;
    const s = view.s;
    bildTransform();

    // Regen unter den tiefen Zellen: schräge Striche, die fallen.
    if (!ruhig()) {
      g.strokeStyle = farbe(mische([190, 200, 230], tag.licht, 0.2), 0.16);
      g.lineWidth = Math.max(1, 0.9 * s);
      g.setLineDash([9 * s, 13 * s]);
      g.lineDashOffset = -state.zeit * 420 * s;
      g.beginPath();
      w.wolken.forEach((wo) => {
        if (!wo.regen || wo.x1 < von || wo.x0 > bis) return;
        const oben = bildY(wo.unten + 8);
        for (let x = wo.x0 + 14; x < wo.x1 - 10; x += 9) {
          const unten = bildY(Math.max(TAL, roh(x)));
          if (unten <= oben) continue;
          g.moveTo(bildX(x), oben);
          g.lineTo(bildX(x) - (unten - oben) * 0.18, unten);
        }
      });
      g.stroke();
      g.setLineDash([]);
    }

    // Die Zellen: dunkle Ballen, oben vom Licht gestreift, innen ein Glimmen
    // – und wenn es blitzt, leuchten sie auf.
    w.wolken.forEach((wo) => {
      if (wo.x1 < von || wo.x0 > bis) {
        if (wo.x1 < von - 200) wo.bild = null;
        // Wer gleich ins Bild kommt, wird schon jetzt gemalt – wenn in
        // diesem Bild noch nichts gemalt wurde.
        else if (!wo.bild && wo.x0 < bis + 500 && neuGemalt < 1) gewitterBild(wo);
        return;
      }
      const b = gewitterBild(wo);
      if (b.f === s * view.dpr) {
        // In seiner Grösse gemalt: nur kopieren, auf ganze Punkte gesetzt.
        g.setTransform(1, 0, 0, 1, 0, 0);
        g.drawImage(b.c, Math.round(bildX(b.x0) * view.dpr), Math.round((bildY(b.oben) + wackel()) * view.dpr));
        bildTransform();
      } else {
        g.drawImage(b.c, bildX(b.x0), bildY(b.oben), b.b * s, b.h * s);
      }
      // Blitzt es in ihr, leuchtet sie auf.
      if (wo.licht > 0.04) {
        const hoehe = Math.max(1, Math.min(wo.oben, DECKE) - wo.unten);
        const d = view.dpr;
        const r = (wo.x1 - wo.x0) * 0.5 * s;
        const my = bildY(wo.unten + Math.min(hoehe, 90) * 0.5) + wackel();
        g.setTransform(1, 0, 0, 1, 0, 0);
        g.globalCompositeOperation = "lighter";
        g.globalAlpha = Math.min(1, wo.licht * 0.9);
        stempel(g, BILDER.glut, (bildX((wo.x0 + wo.x1) / 2) - r) * d, (my - r * 0.7) * d, r * 2 * d, r * 1.4 * d, 16);
        g.globalCompositeOperation = "source-over";
        g.globalAlpha = 1;
        bildTransform();
      }
    });
  }

  // Eine Gewitterzelle, fertig gemalt in ihrem eigenen kleinen Bild.
  function gewitterBild(wo) {
    const key = `${(view.s * view.dpr).toFixed(3)}|${toenung()}`;
    if (wo.bild && (wo.bild.key === key || neuGemalt >= 1)) return wo.bild;
    neuGemalt += 1;
    const rand = 12;
    const f = view.s * view.dpr;
    const x0 = wo.x0 - rand;
    const oben = wo.oben + rand;
    const b = wo.x1 - wo.x0 + rand * 2;
    const h = oben - (wo.unten - rand);
    const c = wo.bild?.c || document.createElement("canvas");
    c.width = Math.max(1, Math.ceil(b * f));
    c.height = Math.max(1, Math.ceil(h * f));
    const echt = g;
    g = c.getContext("2d");
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, c.width, c.height);
    wo.kreise.forEach((k) => ballen((k.x - x0) * f, (oben - k.y) * f, k.r * f));
    const hoehe = Math.max(1, Math.min(wo.oben, DECKE) - wo.unten);
    wo.kreise.forEach((k) => {
      const hoch = clamp((k.y - wo.unten) / hoehe, 0, 1);
      g.globalAlpha = (0.12 + 0.26 * hoch) * tag.hell;
      const r = k.r * 0.72;
      stempel(g, BILDER.ballenLicht, (k.x + k.r * 0.22 - x0 - r) * f, (oben - (k.y + k.r * 0.34) - r) * f, r * 2 * f, r * 2 * f, 6);
    });
    // Ein Glimmen im Innern – nachts deutlicher.
    const r = (wo.x1 - wo.x0) * 0.5;
    const my = oben - (wo.unten + Math.min(hoehe, 90) * 0.5);
    g.globalCompositeOperation = "lighter";
    g.globalAlpha = 0.1 + tag.nacht * 0.16;
    stempel(g, BILDER.glut, ((wo.x0 + wo.x1) / 2 - x0 - r) * f, (my - r * 0.7) * f, r * 2 * f, r * 1.4 * f, 16);
    g.globalCompositeOperation = "source-over";
    g.globalAlpha = 1;
    g = echt;
    wo.bild = { c, key, x0, oben, b, h, f };
    return wo.bild;
  }

  // Die Gewitterdecke: Ballen an der Unterkante, darüber dicht. Sie liegt
  // fertig gemalt in Kacheln zu KACHEL Einheiten.
  const KACHEL = 400;
  const kacheln = new Map();

  function maleKachel(t, key, unten, oben, f, alt) {
    const w = state.welt;
    const c = alt?.c || document.createElement("canvas");
    c.width = Math.max(1, Math.ceil(KACHEL * f) + 2);
    c.height = Math.max(1, Math.round((oben - unten) * f));
    const echt = g;
    g = c.getContext("2d");
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, c.width, c.height);
    const links = t * KACHEL;
    const band = oben - (DECKE + 30);
    if (band > 0) {
      const v = g.createLinearGradient(0, 0, 0, band * f);
      v.addColorStop(0, farbe(mische(tag.sturm, [0, 0, 0], 0.35)));
      v.addColorStop(1, farbe(tag.sturm));
      g.fillStyle = v;
      g.fillRect(0, 0, c.width, band * f + 1);
    }
    weltBis(links + KACHEL + 80);
    const d0 = Math.max(0, Math.floor((links - 70 + VORLAUF) / (SEG * 3)) - 1);
    for (let n = d0; n < w.decke.length && w.decke[n].x < links + KACHEL + 70; n += 1) {
      const k = w.decke[n];
      ballen((k.x - links) * f, (oben - k.y) * f, k.r * f);
    }
    g.globalAlpha = 0.16 * tag.hell;
    for (let n = d0; n < w.decke.length && w.decke[n].x < links + KACHEL + 70; n += 1) {
      const k = w.decke[n];
      const r = k.r * 0.6;
      stempel(g, BILDER.ballenLicht, (k.x + k.r * 0.2 - links - r) * f, (oben - (k.y - k.r * 0.35) - r) * f, r * 2 * f, r * 2 * f, 6);
    }
    g.globalAlpha = 1;
    g = echt;
    return { c, key, unten, oben };
  }

  function zeichneDecke() {
    const f = view.s * view.dpr;
    const unten = DECKE - 24;
    const oben = Math.max(DECKE + 60, state.camY + view.h + 12);
    const key = `${f.toFixed(3)}|${Math.round(oben)}|${toenung()}`;
    const t0 = Math.floor(state.camX / KACHEL);
    const t1 = Math.floor((state.camX + view.w) / KACHEL);
    g.setTransform(1, 0, 0, 1, 0, wackel() * view.dpr);
    for (let t = t0; t <= t1; t += 1) {
      let k = kacheln.get(t);
      if (!k || (k.key !== key && neuGemalt < 1)) {
        if (k) neuGemalt += 1;
        k = maleKachel(t, key, unten, oben, f, k);
        kacheln.set(t, k);
      }
      const links = Math.round((t * KACHEL - state.camX) * f);
      const y0 = Math.round(bildY(k.oben) * view.dpr);
      // Eine Kachel aus einer anderen Grösse (gleich nach dem Drehen) wird
      // gestreckt, bis sie neu gemalt ist; sonst nur kopiert.
      if (k.key === key) g.drawImage(k.c, links, y0);
      else g.drawImage(k.c, links, y0, Math.ceil(KACHEL * f) + 2, Math.round(bildY(k.unten) * view.dpr) - y0);
    }
    // Die nächste Kachel schon vorbereiten, wenn Zeit ist.
    if (!kacheln.has(t1 + 1) && neuGemalt < 1) {
      neuGemalt += 1;
      kacheln.set(t1 + 1, maleKachel(t1 + 1, key, unten, oben, f, null));
    }
    kacheln.forEach((_, t) => { if (t < t0 - 1 || t > t1 + 1) kacheln.delete(t); });
  }

  // Die Gewitterfront: eine dunkle Wand von links, mit Regen und Blitzen.
  function zeichneFront() {
    const fx = state.front.x;
    if (fx < state.camX - 60) return;
    bildTransform();
    const s = view.s;
    const r = 46;
    const kante = bildX(fx);
    g.fillStyle = farbe(mische(tag.sturm, [0, 0, 0], 0.2));
    g.fillRect(-10, -10, kante - r * s * 0.6 + 10, view.cssH + 20);
    const d = view.dpr;
    const dy = wackel();
    g.setTransform(1, 0, 0, 1, 0, 0);
    for (let y = -20, n = 0; y <= SICHT_OBEN + 80; y += 34, n += 1) {
      const wob = 5 + Math.sin(y * 0.045 + state.zeit * 1.4 + n) * 5;
      ballen((kante - (r * 0.86 - wob) * s) * d, (bildY(y) + dy) * d, r * s * d);
    }
    g.globalAlpha = 1;
    // Ein fahler Schein an der Kante.
    g.globalCompositeOperation = "lighter";
    g.globalAlpha = 0.12 + 0.1 * Math.sin(state.zeit * 7);
    const R = 120 * s;
    stempel(g, BILDER.glut, (kante - R * 1.1) * d, (bildY(DECKE * 0.5) - R * 2 + dy) * d, R * d, R * 4 * d, 16);
    g.globalCompositeOperation = "source-over";
    g.globalAlpha = 1;
    bildTransform();
  }

  // Wie nah die Front ist, auch wenn man sie noch nicht sieht: ein Schatten
  // am linken Rand, der pulsiert, wenn es eng wird.
  function zeichneFrontSchatten() {
    const weg = state.camX - state.front.x;
    if (weg <= 0 || state.phase === "bereit") return;
    const nah = clamp(1 - weg / (view.w * 0.8), 0, 1);
    if (nah <= 0) return;
    bildTransform();
    const puls = nah > 0.6 && !ruhig() ? 0.85 + 0.15 * Math.sin(state.zeit * 9) : 1;
    const b = view.cssW * 0.24;
    const v = g.createLinearGradient(0, 0, b, 0);
    v.addColorStop(0, farbe(mische(tag.sturm, [0, 0, 0], 0.3), 0.8 * nah * puls));
    v.addColorStop(1, farbe(tag.sturm, 0));
    g.fillStyle = v;
    g.fillRect(0, 0, b, view.cssH);
  }

  // Ein Blitz: ein gezackter Weg von oben nach unten, mit Ästen.
  function blitzWeg(x0, y0, x1, y1, tiefe, raus) {
    if (tiefe === 0) {
      raus.push(x1, y1);
      return;
    }
    const mx = (x0 + x1) / 2 + (Math.random() - 0.5) * Math.abs(y1 - y0) * 0.32;
    const my = (y0 + y1) / 2;
    blitzWeg(x0, y0, mx, my, tiefe - 1, raus);
    blitzWeg(mx, my, x1, y1, tiefe - 1, raus);
  }

  function blitzSchlagen(x0, y0, x1, y1, staerke = 1) {
    if (state.blitze.length > 5) return;
    const haupt = [x0, y0];
    blitzWeg(x0, y0, x1, y1, 5, haupt);
    const aeste = [];
    for (let n = 0; n < 3; n += 1) {
      if (Math.random() < 0.35) continue;
      const k = 2 + Math.floor(Math.random() * (haupt.length / 2 - 4));
      const ax = haupt[k * 2];
      const ay = haupt[k * 2 + 1];
      const lang = Math.abs(y0 - y1) * (0.2 + Math.random() * 0.25);
      const ast = [ax, ay];
      blitzWeg(ax, ay, ax + (Math.random() - 0.5) * lang * 1.4, ay - lang, 3, ast);
      aeste.push(ast);
    }
    state.blitze.push({ haupt, aeste, leben: 0.32, max: 0.32, staerke });
    if (!ruhig()) state.blitz = Math.max(state.blitz, 0.45 * staerke);
  }

  // Blitze: in den Zellen im Bild (sie leuchten auf, und kurze Blitze
  // zucken in ihnen – nie bis in die gute Schicht), unter der Decke und an
  // der Front bis auf den Boden.
  function blitzePflegen(dt) {
    const w = state.welt;
    const f = state.f;
    const k = schwereBei(f.x);
    const weitWeg = (x) => Math.abs(x - f.x) > 60;
    w.wolken.forEach((wo) => {
      wo.licht = Math.max(0, wo.licht - dt * 3.5);
      if (wo.x1 < state.camX || wo.x0 > state.camX + view.w) return;
      if (Math.random() < dt * lerp(0.25, 0.5, k)) {
        wo.licht = 1;
        const x = wo.x0 + (wo.x1 - wo.x0) * (0.25 + Math.random() * 0.5);
        if (!weitWeg(x) || wo.oben - wo.unten < 50) return;
        const oben = Math.min(wo.oben, DECKE) - 10;
        const unten = wo.unten + 12;
        if (oben - unten > 30) blitzSchlagen(x, oben, x + (Math.random() - 0.5) * 24, unten, 0.7);
      }
    });
    if (Math.random() < dt * 0.22) {
      const x = state.camX + Math.random() * view.w;
      if (weitWeg(x)) blitzSchlagen(x, DECKE, x + (Math.random() - 0.5) * 60, DECKE - 30 - Math.random() * 40, 0.6);
    }
    const fx = state.front.x;
    if (fx > state.camX - 40 && Math.random() < dt * 0.9) {
      const x = fx - 20 - Math.random() * 100;
      blitzSchlagen(x, DECKE, x + (Math.random() - 0.5) * 60, Math.max(TAL, roh(x)));
    }
    for (let i = state.blitze.length - 1; i >= 0; i -= 1) {
      state.blitze[i].leben -= dt;
      if (state.blitze[i].leben <= 0) state.blitze.splice(i, 1);
    }
    state.blitz = Math.max(0, state.blitz - dt * 3);
  }

  function zeichneBlitze() {
    if (!state.blitze.length) return;
    bildTransform();
    g.lineJoin = "round";
    g.lineCap = "round";
    g.globalCompositeOperation = "lighter";
    const s = view.s;
    const linie = (pkte) => {
      g.beginPath();
      g.moveTo(bildX(pkte[0]), bildY(pkte[1]));
      for (let n = 2; n < pkte.length; n += 2) g.lineTo(bildX(pkte[n]), bildY(pkte[n + 1]));
      g.stroke();
    };
    state.blitze.forEach((b) => {
      const k = b.leben / b.max;
      // Ein Blitz flackert: hell, kurz dunkler, noch einmal hell.
      const flacker = k > 0.75 ? 1 : k > 0.55 ? 0.35 : k > 0.35 ? 0.9 : k * 2;
      const a = flacker * b.staerke * (ruhig() ? 0.5 : 1);
      g.strokeStyle = `rgba(170, 150, 255, ${(0.35 * a).toFixed(3)})`;
      g.lineWidth = 7 * s;
      linie(b.haupt);
      g.strokeStyle = `rgba(255, 255, 255, ${a.toFixed(3)})`;
      g.lineWidth = 1.8 * s;
      linie(b.haupt);
      g.lineWidth = 1 * s;
      g.strokeStyle = `rgba(220, 210, 255, ${(0.7 * a).toFixed(3)})`;
      b.aeste.forEach(linie);
    });
    g.globalCompositeOperation = "source-over";
  }

  // ---------------------------------------------------------------------------
  // Zeichnen: das Gebirge
  // ---------------------------------------------------------------------------
  function sichtbar() {
    const p = state.welt.punkte;
    const von = state.camX - SEG * 3;
    const bis = state.camX + view.w + SEG * 3;
    weltBis(bis + SEG * 2);
    const i0 = clamp(Math.floor((von + VORLAUF) / SEG), 0, p.length - 1);
    const i1 = clamp(Math.ceil((bis + VORLAUF) / SEG), 0, p.length - 1);
    return { i0, i1 };
  }

  function zeichneGebirge() {
    const p = state.welt.punkte;
    const { i0, i1 } = sichtbar();
    if (i1 - i0 < 2) return;
    const s = view.s;
    const tief = state.camY - 20;
    weltTransform();

    // Der Körper: oben Fels, weiter unten Wiese, ganz unten im Schatten.
    const koerper = () => {
      g.beginPath();
      g.moveTo(p[i0].x, tief);
      for (let i = i0; i <= i1; i += 1) g.lineTo(p[i].x, p[i].boden);
      g.lineTo(p[i1].x, tief);
      g.closePath();
    };
    const verlauf = g.createLinearGradient(0, 300, 0, Math.min(-40, tief));
    verlauf.addColorStop(0, farbe(mische(tag.fels, [255, 255, 255], 0.08)));
    verlauf.addColorStop(0.35, farbe(tag.fels));
    verlauf.addColorStop(0.62, farbe(mische(tag.wiese, tag.fels, 0.25)));
    verlauf.addColorStop(0.8, farbe(tag.wiese));
    verlauf.addColorStop(1, farbe(mische(tag.wiese, [10, 16, 30], 0.55)));
    g.fillStyle = verlauf;
    koerper();
    g.fill();

    // Schnee auf den hohen Gipfeln: zwischen dem Grat und einer welligen
    // Schneegrenze – ohne Maske, Stück für Stück, wo der Grat darüber liegt.
    const schnee = (i) => 236 + (p[i].deko - 0.5) * 16;
    g.fillStyle = farbe(mische(mische([248, 250, 255], tag.licht, 0.3), [20, 30, 70], tag.nacht * 0.45));
    g.beginPath();
    let lauf = -1;
    for (let i = i0; i <= i1 + 1; i += 1) {
      const drin = i <= i1 && p[i].boden > schnee(i);
      if (drin && lauf < 0) lauf = i;
      if (!drin && lauf >= 0) {
        const a = Math.max(i0, lauf - 1);
        const b = Math.min(i1, i);
        g.moveTo(p[a].x, Math.min(p[a].boden, schnee(a)));
        for (let n = lauf; n < i; n += 1) g.lineTo(p[n].x, p[n].boden);
        g.lineTo(p[b].x, Math.min(p[b].boden, schnee(b)));
        for (let n = i - 1; n >= lauf; n -= 1) g.lineTo(p[n].x, schnee(n));
        g.closePath();
        lauf = -1;
      }
    }
    g.fill();
    // Schichten im Fels – nur an flachen Stellen, damit sie im Fels bleiben.
    g.strokeStyle = farbe(mische(tag.fels, [0, 0, 0], 0.35), 0.35);
    g.lineWidth = 1.4 / s;
    g.beginPath();
    for (let i = Math.max(i0, 1); i < i1; i += 1) {
      const q = p[i];
      if (q.boden < 120 || q.deko > 0.45) continue;
      if (Math.abs(p[i + 1].boden - p[i - 1].boden) > 14) continue;
      const tiefe = 12 + q.deko * 30;
      g.moveTo(q.x - 8, q.boden - tiefe);
      g.lineTo(q.x + 6, q.boden - tiefe - 5 + q.deko * 8);
    }
    g.stroke();

    // Seen in den Talgründen: der Himmel darin, oben ein heller Rand.
    const wasser = g.createLinearGradient(0, TAL, 0, TAL - 14);
    wasser.addColorStop(0, farbe(mische(tag.horizont, tag.oben, 0.3)));
    wasser.addColorStop(1, farbe(mische(tag.oben, [0, 10, 40], 0.4)));
    let see = -1;
    for (let i = i0; i <= i1 + 1; i += 1) {
      const nass = i <= i1 && p[i].boden <= TAL + 0.5;
      if (nass && see < 0) see = i;
      if (!nass && see >= 0) {
        const x0 = p[see].x - SEG * 0.6;
        const b = p[i - 1].x - p[see].x + SEG * 1.2;
        g.fillStyle = wasser;
        g.fillRect(x0, TAL - 14, b, 14.5);
        g.fillStyle = farbe(mische(tag.licht, [255, 255, 255], 0.5), 0.7);
        g.fillRect(x0 + 2, TAL - 0.4, b - 4, 1.4 / s);
        see = -1;
      }
    }

    // Tannen auf den sanften Hängen unter der Baumgrenze.
    g.fillStyle = farbe(mische(tag.wiese, [8, 24, 18], 0.55));
    g.beginPath();
    for (let i = i0; i < i1; i += 1) {
      const q = p[i];
      if (q.deko > 0.42 || q.boden > 210 || q.boden <= TAL + 1) continue;
      const steil = Math.abs(p[i + 1].boden - q.boden) / SEG;
      if (steil > 0.9) continue;
      const h = 10 + q.deko * 14;
      const x = q.x + q.deko * 8;
      const y = lerp(q.boden, p[i + 1].boden, q.deko * 8 / SEG) - 2;
      g.moveTo(x - h * 0.28, y);
      g.lineTo(x, y + h);
      g.lineTo(x + h * 0.28, y);
      g.closePath();
    }
    g.fill();

    // Die Kante: dunkel umrandet, und wo sie zur Sonne (oder zum Mond)
    // schaut, ein heller Saum.
    const kante = () => {
      g.beginPath();
      for (let i = i0; i <= i1; i += 1) (i === i0 ? g.moveTo(p[i].x, p[i].boden) : g.lineTo(p[i].x, p[i].boden));
    };
    g.lineJoin = "round";
    kante();
    g.strokeStyle = farbe(mische(tag.fels, [0, 0, 0], 0.55), 0.6);
    g.lineWidth = 2.6 / s;
    g.stroke();
    g.strokeStyle = farbe(mische(tag.licht, [255, 255, 255], 0.2), 0.45 + tag.nacht * 0.25);
    g.lineWidth = 1.6 / s;
    g.beginPath();
    for (let i = i0; i < i1; i += 1) {
      if (p[i + 1].boden > p[i].boden + 1) continue;
      g.moveTo(p[i].x, p[i].boden - 0.6 / s);
      g.lineTo(p[i + 1].x, p[i + 1].boden - 0.6 / s);
    }
    g.stroke();
  }

  /*
   * Der Talboden vorn – nur wo das Bild höher ist als nötig (Hochformat):
   * Felder, schräg von oben gesehen, Hecken mit Büschen und hier und da ein
   * Haus. Je näher eine Reihe, desto schneller zieht sie vorbei.
   */
  function zeichneVordergrund() {
    const oben = bildY(-2);
    const H = view.cssH - oben;
    if (H < 36) return;
    bildTransform();
    const W = view.cssW;
    const s = view.s;
    const wiese = tag.wiese;
    const sorten = [
      wiese,
      mische(wiese, [222, 204, 110], 0.38),
      mische(wiese, [255, 255, 255], 0.12),
      mische(wiese, [30, 60, 30], 0.16),
      mische(wiese, [168, 128, 84], 0.42),
    ];
    const hecke = farbe(mische(wiese, [10, 30, 16], 0.45 + tag.nacht * 0.2));
    const reihen = 4;
    for (let k = 0; k < reihen; k += 1) {
      const y0 = oben + H * Math.pow(k / reihen, 1.4);
      const y1 = oben + H * Math.pow((k + 1) / reihen, 1.4);
      const p = 1.06 + k * 0.24;
      const breit = (120 + k * 46) * s;
      const versatz = state.camX * p * s;
      const i0 = Math.floor(versatz / breit) - 1;
      const i1 = Math.ceil((versatz + W) / breit) + 1;
      // Hinten im Dunst, vorn etwas dunkler.
      const dunst = clamp(0.32 - k * 0.11, 0, 0.32);
      const dunkel = k * 0.05 + tag.nacht * 0.2;
      // Die Felder, an den Rändern leicht schräg – zur Mitte des Bildes hin.
      for (let i = i0; i <= i1; i += 1) {
        const h = hash01(i * 7.31 + k * 13.7);
        const sorte = sorten[Math.floor(h * sorten.length)];
        const xa = i * breit - versatz;
        const xb = xa + breit;
        const kippA = (xa - W / 2) * 0.12;
        const kippB = (xb - W / 2) * 0.12;
        g.fillStyle = farbe(mische(mische(sorte, tag.horizont, dunst), [8, 14, 24], dunkel));
        g.beginPath();
        g.moveTo(xa - kippA * 0.5, y0);
        g.lineTo(xb - kippB * 0.5, y0);
        g.lineTo(xb + kippB * 0.5, y1 + 1);
        g.lineTo(xa + kippA * 0.5, y1 + 1);
        g.closePath();
        g.fill();
        // Furchen im gepflügten und im Kornfeld.
        if ((h > 0.2 && h < 0.4) || h > 0.8) {
          g.strokeStyle = farbe(mische(sorte, [0, 0, 0], 0.25), 0.35);
          g.lineWidth = Math.max(1, 0.7 * s);
          g.beginPath();
          for (let f = 1; f < 6; f += 1) {
            const u = f / 6;
            g.moveTo(lerp(xa - kippA * 0.5, xb - kippB * 0.5, u), y0 + 1);
            g.lineTo(lerp(xa + kippA * 0.5, xb + kippB * 0.5, u), y1);
          }
          g.stroke();
        }
      }
      // Eine schmale Hecke an der oberen Kante der Reihe, mit ein paar
      // Büschen und Bäumen.
      g.fillStyle = hecke;
      g.fillRect(0, y0 - Math.max(1, 0.8 * s), W, Math.max(1.5, (1.2 + k * 0.4) * s));
      const busch = (2.2 + k * 1.1) * s;
      const schritt = busch * 3.2;
      g.beginPath();
      for (let b = Math.floor(versatz / schritt) - 1; b * schritt - versatz < W + busch; b += 1) {
        const h = hash01(b * 3.17 + k * 5.9);
        if (h < 0.55) continue;
        const bx = b * schritt - versatz;
        const r = busch * (0.7 + (h - 0.55) * 1.6);
        g.moveTo(bx + r, y0 - r * 0.6);
        g.arc(bx, y0 - r * 0.6, r, 0, Math.PI * 2);
      }
      g.fill();
      // Häuser in der hintersten Reihe: weisse Wände, rote Dächer.
      if (k === 0) {
        for (let i = i0; i <= i1; i += 1) {
          const h = hash01(i * 5.13 + 2.2);
          if (h < 0.55) continue;
          const hx = i * breit - versatz + breit * (0.2 + h * 0.5);
          const hb = 8 * s;
          const hy = y0 + (y1 - y0) * 0.55;
          g.fillStyle = farbe(mische([246, 238, 222], [30, 40, 70], tag.nacht * 0.6));
          g.fillRect(hx - hb / 2, hy - hb * 0.7, hb, hb * 0.7);
          g.fillStyle = farbe(mische([196, 70, 52], [30, 30, 60], tag.nacht * 0.5));
          g.beginPath();
          g.moveTo(hx - hb * 0.65, hy - hb * 0.65);
          g.lineTo(hx, hy - hb * 1.2);
          g.lineTo(hx + hb * 0.65, hy - hb * 0.65);
          g.closePath();
          g.fill();
          // Nachts brennt Licht.
          if (tag.nacht > 0.3) {
            g.fillStyle = `rgba(255, 214, 120, ${(tag.nacht * 0.9).toFixed(3)})`;
            g.fillRect(hx - hb * 0.18, hy - hb * 0.45, hb * 0.28, hb * 0.24);
          }
        }
      }
    }
  }

  // Die Felsbögen: Fels mit einem Fenster, unten vom Gelände verdeckt, oben
  // im Licht – mit derselben Kante wie das Gebirge.
  function zeichneBoegen() {
    const l = state.welt.schichten;
    const von = state.camX - 40;
    const bis = state.camX + view.w + 40;
    const s = view.s;
    let welt = false;
    for (let i = Math.max(0, schichtNr(von) - 1); i < l.length && l[i].x0 < bis + 300; i += 1) {
      for (const b of l[i].boegen) {
        if (b.x1 < von || b.x0 > bis) continue;
        if (!welt) { weltTransform(); welt = true; }
        const schritt = (b.x1 - b.x0) / 40;
        const form = () => {
          g.beginPath();
          g.moveTo(b.x0, b.fuss);
          for (let x = b.x0 + schritt; x < b.x1 - 0.01; x += schritt) g.lineTo(x, bogenAussen(b, x));
          g.lineTo(b.x1, b.fuss);
          g.closePath();
          const w0 = b.x0 + (b.x1 - b.x0) * b.bein;
          const w1 = b.x1 - (b.x1 - b.x0) * b.bein;
          g.moveTo(w0, b.fuss);
          for (let x = w0 + schritt / 2; x < w1 - 0.01; x += schritt / 2) g.lineTo(x, bogenInnen(b, x));
          g.lineTo(w1, b.fuss);
          g.closePath();
        };
        const verlauf = g.createLinearGradient(0, b.oben, 0, b.oben - 140);
        verlauf.addColorStop(0, farbe(mische(tag.fels, [255, 255, 255], 0.1)));
        verlauf.addColorStop(0.25, farbe(tag.fels));
        verlauf.addColorStop(1, farbe(mische(tag.fels, [10, 12, 30], 0.35)));
        g.fillStyle = verlauf;
        form();
        g.fill("evenodd");
        // Risse im Fels und der Schatten unter dem Bogen.
        g.save();
        form();
        g.clip("evenodd");
        g.strokeStyle = farbe(mische(tag.fels, [0, 0, 0], 0.4), 0.4);
        g.lineWidth = 1.3 / s;
        g.beginPath();
        for (let n = 0; n < 9; n += 1) {
          const x = lerp(b.x0, b.x1, hash01(b.x0 * 0.01 + n * 3.7));
          const y = b.oben - 12 - hash01(b.x0 * 0.02 + n * 5.3) * 110;
          g.moveTo(x - 7, y);
          g.lineTo(x + 6, y + 4 - hash01(n * 9.1) * 8);
        }
        g.stroke();
        g.restore();
        form();
        g.lineJoin = "round";
        g.strokeStyle = farbe(mische(tag.fels, [0, 0, 0], 0.6), 0.7);
        g.lineWidth = 2.4 / s;
        g.stroke();
        g.strokeStyle = farbe(mische(tag.licht, [255, 255, 255], 0.2), 0.5);
        g.lineWidth = 1.5 / s;
        g.beginPath();
        for (let x = b.x0 + schritt * 3; x < b.x1 - schritt * 3; x += schritt) {
          const y = bogenAussen(b, x) - 0.6 / s;
          if (x === b.x0 + schritt * 3) g.moveTo(x, y);
          else g.lineTo(x, y);
        }
        g.stroke();
      }
    }
  }

  // Alle hundert Meter ein Wegweiser im Gelände.
  function zeichneMarken() {
    const von = Math.ceil(meterBei(state.camX) / 100) * 100;
    const bis = meterBei(state.camX + view.w);
    if (von > bis) return;
    bildTransform();
    const s = view.s;
    const gross = Math.round(clamp(view.cssH * 0.026, 9, 13));
    g.font = `800 ${gross}px system-ui, sans-serif`;
    g.textAlign = "center";
    g.textBaseline = "middle";
    for (let m = Math.max(100, von); m <= bis; m += 100) {
      const x = START.x + m * METER;
      const sx = bildX(x);
      const fuss = bildY(roh(x));
      const hoch = 20 * s;
      g.strokeStyle = "rgba(60, 40, 25, 0.9)";
      g.lineWidth = Math.max(1.5, 2 * s);
      g.beginPath();
      g.moveTo(sx, fuss + 2);
      g.lineTo(sx, fuss - hoch);
      g.stroke();
      const text = `${m} m`;
      const b = g.measureText(text).width + 8;
      g.fillStyle = "rgba(255, 244, 214, 0.92)";
      g.fillRect(sx - b / 2, fuss - hoch - gross - 2, b, gross + 4);
      g.fillStyle = "#4a3320";
      g.fillText(text, sx, fuss - hoch - gross / 2);
    }
  }

  // Die Gegner: eine Fahne im Gelände, bei ihren Metern, mit Namen. Wer an
  // ihr vorbei ist, hat sie geschlagen – dann wird sie blass.
  function zeichneFahnen() {
    const ziele = (gegner?.gegner?.() || []).filter((ziel) => ziel.art !== "alle");
    if (!ziele.length) return;
    bildTransform();
    const s = view.s;
    const gross = Math.round(clamp(view.cssH * 0.03, 10, 14));
    g.font = `800 ${gross}px system-ui, sans-serif`;
    g.textAlign = "left";
    g.textBaseline = "bottom";
    ziele.forEach((ziel) => {
      const x = START.x + ziel.punkte * METER;
      if (x < state.camX - 40 || x > state.camX + view.w + 120) return;
      const sx = bildX(x);
      const fuss = bildY(roh(x));
      const spitze = fuss - 46 * s;
      g.globalAlpha = state.punkte > ziel.punkte ? 0.35 : 0.95;
      // Eine feine Linie bis unter die Decke: Hier liegt die Marke.
      g.strokeStyle = ziel.farbe;
      g.lineWidth = 1.5;
      g.setLineDash([6, 7]);
      g.beginPath();
      g.moveTo(sx, spitze);
      g.lineTo(sx, bildY(DECKE - 6));
      g.stroke();
      g.setLineDash([]);
      g.strokeStyle = "#3a2a1c";
      g.lineWidth = Math.max(1.5, 2.2 * s);
      g.beginPath();
      g.moveTo(sx, fuss + 2);
      g.lineTo(sx, spitze);
      g.stroke();
      // Das Tuch flattert im Wind.
      const lang = 22 * s;
      const hoch = 13 * s;
      g.fillStyle = ziel.farbe;
      g.beginPath();
      g.moveTo(sx, spitze);
      for (let n = 1; n <= 6; n += 1) {
        const u = n / 6;
        g.lineTo(sx + lang * u, spitze + Math.sin(state.zeit * 7 - u * 4) * 2.2 * s * u);
      }
      for (let n = 6; n >= 0; n -= 1) {
        const u = n / 6;
        g.lineTo(sx + lang * u, spitze + hoch + Math.sin(state.zeit * 7 - u * 4) * 2.2 * s * u);
      }
      g.closePath();
      g.fill();
      const text = ziel.art === "eigen" ? `Bestmarke ${ziel.punkte} m` : `${ziel.name} ${ziel.punkte} m`;
      g.lineWidth = 3;
      g.strokeStyle = "rgba(20, 24, 50, 0.75)";
      g.strokeText(text, sx + 3, spitze - 4);
      g.fillStyle = "#ffffff";
      g.fillText(text, sx + 3, spitze - 4);
    });
    g.globalAlpha = 1;
  }

  // ---------------------------------------------------------------------------
  // Zeichnen: der Ballon
  // ---------------------------------------------------------------------------
  // Bahnen der Hülle in Regenbogenfarben – sie drehen sich langsam, wie bei
  // einem echten Ballon.
  const BAHNEN = ["#e8433a", "#ff8f1f", "#ffd23f", "#3FA34D", "#2f9fd8", "#6f5bd6"];
  const BAHN_ZAHL = 8;

  // Die Hülle als Umriss: rechts hinunter, links hinauf. q: wie weit sie
  // noch steht (1) oder zusammengefallen ist (0,3); flatter: Wellen im Stoff.
  function huellenPfad(q, flatter) {
    g.beginPath();
    for (let n = 0; n < PROFIL.length; n += 1) {
      const p = PROFIL[n];
      const y = 1 + (p.y - 1) * q;
      if (n === 0) g.moveTo(laengengrad(q, flatter, n, 1), y);
      else g.lineTo(laengengrad(q, flatter, n, 1), y);
    }
    for (let n = PROFIL.length - 1; n >= 0; n -= 1) {
      g.lineTo(laengengrad(q, flatter, n, -1), 1 + (PROFIL[n].y - 1) * q);
    }
    g.closePath();
  }

  function huellenBreite(q, flatter, n) {
    return (1 + (1 - q) * 0.4) * (1 + flatter * Math.sin(state.zeit * 26 + n * 1.3));
  }

  // x eines Längengrads der Hülle (sa: sein Sinus, -1 links … 1 rechts).
  function laengengrad(q, flatter, n, sa) {
    const b = PROFIL[n].b;
    if (!flatter) return b * (1 + (1 - q) * 0.4) * sa;
    return b * lerp(huellenBreite(q, flatter, n + 3.1), huellenBreite(q, flatter, n), (sa + 1) / 2) * sa;
  }

  function zeichneHuelle(q, flatter, licht, glut) {
    // Die Bahnen: zwischen zwei Längengraden der Hülle, im Bild gestaucht.
    const breite = Math.PI / BAHN_ZAHL;
    const dreh = (state.zeit * 0.25) % (breite * BAHNEN.length);
    const versatz = dreh % breite;
    const erste = Math.floor(dreh / breite);
    for (let j = -1; j <= BAHN_ZAHL; j += 1) {
      const a = Math.max(-Math.PI / 2, -Math.PI / 2 + j * breite + versatz);
      const b = Math.min(Math.PI / 2, -Math.PI / 2 + (j + 1) * breite + versatz);
      if (b <= a) continue;
      g.fillStyle = BAHNEN[(((j - erste) % BAHNEN.length) + BAHNEN.length) % BAHNEN.length];
      const sa = Math.sin(a);
      const sb = Math.sin(b);
      g.beginPath();
      for (let n = 0; n < PROFIL.length; n += 1) {
        const x = laengengrad(q, flatter, n, sa);
        const y = 1 + (PROFIL[n].y - 1) * q;
        if (n === 0) g.moveTo(x, y);
        else g.lineTo(x, y);
      }
      for (let n = PROFIL.length - 1; n >= 0; n -= 1) {
        g.lineTo(laengengrad(q, flatter, n, sb), 1 + (PROFIL[n].y - 1) * q);
      }
      g.closePath();
      g.fill();
    }

    // Licht und Schatten, dazu der Schein des Brenners von innen.
    g.save();
    huellenPfad(q, flatter);
    g.clip();
    const seite = licht.x >= 0 ? 1 : -1;
    const glanz = g.createRadialGradient(seite * 7, -24, 1, seite * 5, -20, 22);
    glanz.addColorStop(0, farbe(mische([255, 255, 255], tag.licht, 0.3), 0.5 * tag.hell));
    glanz.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = glanz;
    g.fillRect(-20, -36, 40, 40);
    const schatten = g.createLinearGradient(seite * 12, 0, -seite * 18, 0);
    schatten.addColorStop(0, "rgba(20, 16, 50, 0)");
    schatten.addColorStop(1, `rgba(20, 16, 50, ${(0.42 + tag.nacht * 0.15).toFixed(3)})`);
    g.fillStyle = schatten;
    g.fillRect(-20, -36, 40, 40);
    const fuss = g.createLinearGradient(0, -12, 0, 2);
    fuss.addColorStop(0, "rgba(10, 10, 30, 0)");
    fuss.addColorStop(1, "rgba(10, 10, 30, 0.3)");
    g.fillStyle = fuss;
    g.fillRect(-20, -12, 40, 16);
    if (tag.nacht > 0.02) {
      g.fillStyle = `rgba(8, 12, 40, ${(tag.nacht * 0.5).toFixed(3)})`;
      g.fillRect(-20, -36, 40, 40);
    }
    if (glut > 0.01) {
      g.globalCompositeOperation = "lighter";
      g.globalAlpha = Math.min(1, glut);
      g.drawImage(BILDER.flamme, -30, -34, 60, 60);
      g.globalCompositeOperation = "source-over";
      g.globalAlpha = 1;
    }
    // Die Nähte zwischen den Bahnen.
    g.strokeStyle = "rgba(30, 20, 40, 0.22)";
    g.lineWidth = 0.5;
    g.beginPath();
    for (let j = 0; j <= BAHN_ZAHL; j += 1) {
      const a = -Math.PI / 2 + j * breite + versatz;
      if (a <= -Math.PI / 2 || a >= Math.PI / 2) continue;
      const sa = Math.sin(a);
      for (let n = 0; n < PROFIL.length; n += 1) {
        const x = laengengrad(q, flatter, n, sa);
        const y = 1 + (PROFIL[n].y - 1) * q;
        if (n === 0) g.moveTo(x, y);
        else g.lineTo(x, y);
      }
    }
    g.stroke();
    g.restore();
  }

  // Der Ballon an seinem Ort. art: "ich" mit allem, oder ein Geist.
  function zeichneBallonBei(x, y, neig, opt) {
    const s = view.s;
    g.save();
    g.translate(bildX(x), bildY(y));
    g.scale(s, s);
    g.translate(0, DREH);
    g.rotate(neig);
    g.translate(0, -DREH);

    const q = opt.q ?? 1;
    const flatter = opt.flatter || 0;
    const flamme = opt.flamme || 0;

    // Seile und Korb
    g.strokeStyle = "rgba(70, 50, 35, 0.95)";
    g.lineWidth = 0.6;
    g.beginPath();
    [[-5, -5.5], [-2, -2.5], [2, 2.5], [5, 5.5]].forEach(([oben, unten]) => {
      g.moveTo(oben * huellenBreite(q, flatter, 14), 1);
      g.lineTo(unten, KORB.oben);
    });
    g.stroke();
    const korb = g.createLinearGradient(0, KORB.oben, 0, KORB.unten);
    korb.addColorStop(0, "#b77a43");
    korb.addColorStop(1, "#7a4a24");
    g.fillStyle = korb;
    g.beginPath();
    g.moveTo(-KORB.b, KORB.oben);
    g.lineTo(KORB.b, KORB.oben);
    g.lineTo(KORB.b * 0.86, KORB.unten);
    g.lineTo(-KORB.b * 0.86, KORB.unten);
    g.closePath();
    g.fill();
    g.strokeStyle = "rgba(60, 35, 15, 0.55)";
    g.lineWidth = 0.45;
    g.beginPath();
    for (let n = 1; n < 4; n += 1) {
      const yy = KORB.oben + n * 2;
      g.moveTo(-KORB.b * (1 - n * 0.035), yy);
      g.lineTo(KORB.b * (1 - n * 0.035), yy);
    }
    for (let n = -2; n <= 2; n += 1) {
      g.moveTo(n * 2.2, KORB.oben);
      g.lineTo(n * 1.9, KORB.unten);
    }
    g.stroke();
    g.fillStyle = "#5a361a";
    g.fillRect(-KORB.b - 0.4, KORB.oben - 0.8, KORB.b * 2 + 0.8, 1.5);
    // Der Brenner über dem Korb
    g.fillStyle = "#4a4f60";
    g.fillRect(-2.6, 5.2, 5.2, 2);

    zeichneHuelle(q, flatter, opt.licht, opt.glut || 0);

    // Die Flamme: blau am Brenner, gelb-weiss im Kern, orange nach oben.
    if (flamme > 0.02 && q > 0.6) {
      const lang = (4 + 9 * flamme) * (ruhig() ? 1 : 0.85 + Math.random() * 0.3);
      const breit = 1.6 + flamme * 1.6;
      const v = g.createLinearGradient(0, 5.2, 0, 5.2 - lang);
      v.addColorStop(0, "rgba(120, 180, 255, 0.95)");
      v.addColorStop(0.18, "rgba(255, 250, 220, 1)");
      v.addColorStop(0.5, "rgba(255, 196, 70, 0.95)");
      v.addColorStop(1, "rgba(255, 110, 30, 0)");
      g.fillStyle = v;
      g.beginPath();
      g.moveTo(-breit, 5.2);
      g.quadraticCurveTo(-breit * 1.2, 5.2 - lang * 0.45, 0, 5.2 - lang);
      g.quadraticCurveTo(breit * 1.2, 5.2 - lang * 0.45, breit, 5.2);
      g.closePath();
      g.fill();
      g.globalCompositeOperation = "lighter";
      g.globalAlpha = 0.65 * flamme;
      g.drawImage(BILDER.flamme, -12, -8, 24, 24);
      g.globalCompositeOperation = "source-over";
      g.globalAlpha = 1;
      // Flimmern über der Flamme
      if (!ruhig() && flamme > 0.4) {
        g.strokeStyle = `rgba(255, 240, 210, ${(0.22 * flamme).toFixed(3)})`;
        g.lineWidth = 0.5;
        g.beginPath();
        for (let n = -1; n <= 1; n += 2) {
          for (let k = 0; k <= 6; k += 1) {
            const yy = 1 - k * 1.6;
            const xx = n * 1.6 + Math.sin(state.zeit * 18 + k * 1.2 + n) * 0.9;
            if (k === 0) g.moveTo(xx, yy);
            else g.lineTo(xx, yy);
          }
        }
        g.stroke();
      }
    } else if (q > 0.6) {
      // Die Zündflamme: ein kleines blaues Licht.
      g.fillStyle = "rgba(130, 190, 255, 0.85)";
      g.beginPath();
      g.ellipse(0, 4.4, 0.7, 1.3, 0, 0, Math.PI * 2);
      g.fill();
    }

    // Wie heiss die Hülle ist: ein Bogen links von ihr, mit einer Marke beim
    // Schweben.
    if (opt.anzeige) {
      const r = 24;
      const a0 = Math.PI * 0.66;
      const a1 = Math.PI * 1.34;
      g.lineCap = "round";
      g.lineWidth = 1.8;
      g.strokeStyle = "rgba(255, 255, 255, 0.28)";
      g.beginPath();
      g.arc(0, -15, r, a0, a1);
      g.stroke();
      const h = state.hitze;
      g.strokeStyle = farbe(mische([110, 190, 255], [255, 120, 40], h), 0.9);
      g.beginPath();
      g.arc(0, -15, r, a0, lerp(a0, a1, h) + 0.001);
      g.stroke();
      g.strokeStyle = "rgba(255, 255, 255, 0.85)";
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(-r + 2.4, -15);
      g.lineTo(-r - 2.4, -15);
      g.stroke();
    }

    // Der Riss, wenn die Hülle reisst.
    if (opt.riss) {
      g.strokeStyle = "rgba(25, 15, 25, 0.85)";
      g.lineWidth = 1.4;
      g.beginPath();
      const seite = opt.riss;
      for (let n = 0; n <= 6; n += 1) {
        const yy = -28 + n * 4 * q;
        const xx = seite * (6 + (n % 2) * 3.5) * huellenBreite(q, flatter, n);
        if (n === 0) g.moveTo(xx, yy);
        else g.lineTo(xx, yy);
      }
      g.stroke();
    }
    g.restore();
  }

  // Der Wind am Ballon: Trägt ihn eine gute Schicht, liegt ein goldener
  // Schein um ihn, in einer schnellen ein oranger mit Fahrtstreifen; drückt
  // ihn der Wind zurück, ein kalter.
  function zeichneBallonWind() {
    const f = state.f;
    const T = tempoBei(f.x);
    const r = f.vx / T;
    bildTransform();
    const s = view.s;
    const x = bildX(f.x);
    const y = bildY(f.y + 8);
    const d = view.dpr;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalCompositeOperation = "lighter";
    if (r > 0.85) {
      g.globalAlpha = clamp((r - 0.85) * 0.9, 0, 0.45) * (0.7 + 0.3 * tag.nacht);
      const R = 46 * s;
      stempel(g, BILDER.gold, (x - R) * d, (y - R + wackel()) * d, R * 2 * d, R * 2 * d, 8);
    }
    g.globalCompositeOperation = "source-over";
    g.globalAlpha = 1;
    bildTransform();
    // Fahrtstreifen hinter dem Ballon, wenn er schnell ist.
    if (r > 1.25 && !ruhig()) {
      g.strokeStyle = `rgba(255, 236, 190, ${clamp((r - 1.25) * 0.9, 0, 0.5).toFixed(3)})`;
      g.lineWidth = Math.max(1, 1.2 * s);
      g.lineCap = "round";
      g.beginPath();
      for (let n = 0; n < 4; n += 1) {
        const yy = y + (n - 1.5) * 9 * s + Math.sin(state.zeit * 3 + n) * 2 * s;
        const lauf = ((state.zeit * 2.2 + n * 0.37) % 1);
        const x0 = x - (22 + lauf * 30) * s;
        g.moveTo(x0, yy);
        g.lineTo(x0 - (14 + n * 3) * s * (1 - lauf * 0.5), yy);
      }
      g.stroke();
    }
  }

  function zeichneBallon() {
    const f = state.f;
    bildTransform();
    const sonne = sonnenOrt();
    const licht = { x: (tag.nacht > 0.5 ? view.cssW * 0.62 : sonne.x) - bildX(f.x) };
    const nachGlut = 0.32 + tag.nacht * 0.55;
    if (state.schritt === "crash") {
      const t = state.zeit - state.crashZeit;
      const q = lerp(1, 0.3, glatt(clamp(t / 0.8, 0, 1)));
      const flatter = 0.18 * clamp(1 - t / 1.4, 0, 1) * (ruhig() ? 0.3 : 1);
      zeichneBallonBei(f.x, f.y, state.neig, { q, flatter, flamme: 0, licht, glut: 0, riss: state.rissSeite || 1 });
      return;
    }
    if (state.schritt === "fahrt") zeichneBallonWind();
    bildTransform();
    zeichneBallonBei(f.x, f.y, state.neig, {
      flamme: state.flamme,
      licht,
      glut: state.flamme * nachGlut + state.hitze * 0.12 * tag.nacht,
      anzeige: state.phase === "spiel",
    });
  }

  // Die Gegner als Geist (geist.js): ein Ballon aus Licht auf ihrem Weg –
  // durch ihre eigene Welt, nicht durch diese.
  function zeichneGeister() {
    if (!gegner || state.phase === "bereit") return;
    const orte = window.LernappGeist?.orte?.(gegner) || [];
    if (!orte.length) return;
    bildTransform();
    const s = view.s;
    orte.forEach((o) => {
      // Wem im Live-Modus zugeschaut wird, der ist der Ballon selbst – kein
      // Geist dazu, nur sein Name (geist.js, namen).
      if (o.ziel) return;
      const brennt = (o.c || 0) >= 100;
      g.save();
      g.globalAlpha = 0.5 * o.blass;
      g.translate(bildX(START.x + o.a), bildY(o.b));
      g.scale(s, s);
      g.fillStyle = o.farbe;
      huellenPfad(1, 0);
      g.fill();
      g.beginPath();
      g.moveTo(-KORB.b, KORB.oben);
      g.lineTo(KORB.b, KORB.oben);
      g.lineTo(KORB.b * 0.86, KORB.unten);
      g.lineTo(-KORB.b * 0.86, KORB.unten);
      g.closePath();
      g.fill();
      g.strokeStyle = o.farbe;
      g.lineWidth = 0.6;
      g.beginPath();
      g.moveTo(-5, 1);
      g.lineTo(-5.5, KORB.oben);
      g.moveTo(5, 1);
      g.lineTo(5.5, KORB.oben);
      g.stroke();
      if (brennt) {
        g.globalCompositeOperation = "lighter";
        g.globalAlpha = 0.6 * o.blass;
        g.drawImage(BILDER.flamme, -9, -5, 18, 18);
      }
      g.restore();
    });
    window.LernappGeist.namen(g, orte.map((o) => {
      const dx = START.x + o.a - state.f.x;
      return { ...o, sx: bildX(START.x + o.a), sy: bildY(o.b + 36), weit: `${dx > 0 ? "+" : ""}${Math.round(dx / METER)} m` };
    }), { breit: view.cssW, hoch: view.cssH });
  }

  function zeichneTeile() {
    if (!state.teile.length) return;
    bildTransform();
    const s = view.s;
    state.teile.forEach((t) => {
      const k = clamp(t.leben / t.max, 0, 1);
      const x = bildX(t.x);
      const y = bildY(t.y);
      if (t.art === "stoff") {
        g.globalAlpha = Math.min(1, k * 1.6);
        g.fillStyle = t.farbe;
        g.save();
        g.translate(x, y);
        g.rotate(t.dreh);
        g.scale(1, Math.cos(t.dreh * 2.3));
        g.fillRect(-t.r * s, -t.r * 0.6 * s, t.r * 2 * s, t.r * 1.2 * s);
        g.restore();
      } else if (t.art === "funke" || t.art === "glanz") {
        g.globalAlpha = k;
        g.fillStyle = t.farbe;
        g.beginPath();
        g.arc(x, y, t.r * s * (0.5 + k * 0.5), 0, Math.PI * 2);
        g.fill();
      } else {
        g.globalAlpha = k * (t.art === "staub" ? 0.5 : 0.35);
        g.fillStyle = t.farbe;
        g.beginPath();
        g.arc(x, y, t.r * s * (2.2 - k * 1.2), 0, Math.PI * 2);
        g.fill();
      }
    });
    g.globalAlpha = 1;
  }

  function zeichneSchriften() {
    if (!state.schriften.length) return;
    bildTransform();
    g.textAlign = "center";
    g.textBaseline = "middle";
    state.schriften.forEach((s) => {
      const k = clamp(s.leben / s.max, 0, 1);
      const steig = (1 - k) * 26;
      // Erst gross, dann setzt sie sich.
      const auf = 1 + Math.max(0, (k - 0.85) / 0.15) * 0.35;
      g.globalAlpha = Math.min(1, k * 2.2);
      g.font = `900 ${Math.round(s.gross * clamp(view.s, 0.8, 1.6) * auf)}px system-ui, sans-serif`;
      g.lineWidth = 4;
      g.strokeStyle = "rgba(20, 16, 40, 0.75)";
      const halb = g.measureText(s.text).width / 2 + 8;
      const x = clamp(bildX(s.x), halb, Math.max(halb, view.cssW - halb));
      const y = clamp(bildY(s.y) - steig, view.frei + 20, view.cssH - 20);
      g.strokeText(s.text, x, y);
      g.fillStyle = s.farbe;
      g.fillText(s.text, x, y);
    });
    g.globalAlpha = 1;
  }

  // Die Meter oben links – die eigentliche Zahl der Runde –, daneben ein
  // Pfeil, wohin der Ballon gerade treibt: golden nach Osten, blau zurück.
  function zeichneAnzeige() {
    if (state.phase === "bereit") return;
    bildTransform();
    // Auf dem Handy liegt der obere Rand unter den Knöpfen: dann darunter.
    g.translate(0, shell?.frei?.(canvas) || 0);
    const gross = clamp(view.cssH * 0.055, 14, 24);
    g.font = `900 ${Math.round(gross)}px system-ui, sans-serif`;
    g.textAlign = "left";
    g.textBaseline = "middle";
    const text = `${state.meter} m`;
    const tw = g.measureText(text).width;
    const pfeil = gross * 1.3;
    const w = tw + gross * 1.1 + pfeil;
    const x = 12;
    const y = 12;
    g.fillStyle = "rgba(20, 22, 50, 0.55)";
    g.beginPath();
    if (g.roundRect) g.roundRect(x, y, w, gross * 1.6, gross * 0.8);
    else g.rect(x, y, w, gross * 1.6);
    g.fill();
    g.fillStyle = "#ffffff";
    g.fillText(text, x + gross * 0.55, y + gross * 0.82);
    // Der Pfeil
    const vx = state.schritt === "start" ? 0 : state.f.vx;
    const r = vx / tempoBei(state.f.x);
    const mx = x + gross * 0.55 + tw + pfeil * 0.55;
    const my = y + gross * 0.8;
    const lang = clamp(Math.abs(r), 0.25, 1.5) * pfeil * 0.42;
    const richtung = vx >= 0 ? 1 : -1;
    g.strokeStyle = vx >= frontTempo() ? (r > 1.3 ? "#ffb070" : "#ffd977") : vx >= 0 ? "#d9e2ff" : "#8fb4ff";
    g.lineWidth = Math.max(2, gross * 0.16);
    g.lineCap = "round";
    g.lineJoin = "round";
    g.beginPath();
    g.moveTo(mx - lang * richtung, my);
    g.lineTo(mx + lang * richtung, my);
    g.moveTo(mx + lang * richtung - gross * 0.28 * richtung, my - gross * 0.26);
    g.lineTo(mx + lang * richtung, my);
    g.lineTo(mx + lang * richtung - gross * 0.28 * richtung, my + gross * 0.26);
    g.stroke();
  }

  function zeichnen() {
    if (!g) return;
    tageszeit(meterBei(state.f.x));
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, canvas.width, canvas.height);
    neuGemalt = 0;
    zeichneHintergrund();
    zeichneWindfeld();
    zeichneGrenzen();
    zeichnePfeile();
    zeichneWind();
    zeichneWolken();
    zeichneBoegen();
    zeichneGebirge();
    zeichneVordergrund();
    zeichneDecke();
    zeichneMarken();
    zeichneFahnen();
    zeichneFront();
    zeichneGeister();
    zeichneTeile();
    zeichneBallon();
    zeichneBlitze();
    zeichneZeiger();
    zeichneFrontSchatten();
    // Ein Blitz lässt den ganzen Himmel aufleuchten.
    if (state.blitz > 0.01) {
      bildTransform();
      g.fillStyle = `rgba(235, 230, 255, ${(state.blitz * 0.35).toFixed(3)})`;
      g.fillRect(0, 0, view.cssW, view.cssH);
    }
    zeichneSchriften();
    zeichneAnzeige();
  }

  // ---------------------------------------------------------------------------
  // Teilchen und Schriften
  // ---------------------------------------------------------------------------
  function teil(t) {
    if (state.teile.length < 160) state.teile.push(t);
  }

  function zerreissen(x, y) {
    const anzahl = ruhig() ? 8 : 22;
    for (let i = 0; i < anzahl; i += 1) {
      const w = Math.random() * Math.PI * 2;
      const v = 40 + Math.random() * 120;
      teil({
        art: "stoff", x: x + (Math.random() - 0.5) * 20, y: y + Math.random() * 20, vx: Math.cos(w) * v, vy: Math.sin(w) * v + 40,
        r: 1.6 + Math.random() * 2.4, dreh: Math.random() * 6, farbe: BAHNEN[i % BAHNEN.length], leben: 0.9 + Math.random() * 0.8, max: 1.7,
      });
    }
    for (let i = 0; i < anzahl / 2; i += 1) {
      teil({
        art: "rauch", x, y: y + 10, vx: (Math.random() - 0.5) * 50, vy: 20 + Math.random() * 30,
        r: 3 + Math.random() * 4, farbe: "#9aa0bd", leben: 0.8 + Math.random() * 0.7, max: 1.5,
      });
    }
  }

  function staub(x, y) {
    const anzahl = ruhig() ? 5 : 14;
    for (let i = 0; i < anzahl; i += 1) {
      teil({
        art: "staub", x: x + (Math.random() - 0.5) * 16, y, vx: (Math.random() - 0.5) * 120, vy: 10 + Math.random() * 50,
        r: 2.5 + Math.random() * 3, farbe: farbe(mische(tag.fels, [230, 220, 200], 0.4)), leben: 0.6 + Math.random() * 0.6, max: 1.2,
      });
    }
  }

  function funken(x, y) {
    if (ruhig()) return;
    teil({
      art: "funke", x: x + (Math.random() - 0.5) * 3, y, vx: (Math.random() - 0.5) * 30, vy: -20 - Math.random() * 30,
      r: 0.8 + Math.random() * 0.8, farbe: Math.random() < 0.5 ? "#ffd166" : "#ff8c42", leben: 0.3 + Math.random() * 0.3, max: 0.6,
    });
  }

  // Goldener Glanz um den Ballon – für einen sauberen Übergang.
  function glanz(x, y, staerke) {
    const anzahl = ruhig() ? 4 : Math.round(10 + staerke * 6);
    for (let i = 0; i < anzahl; i += 1) {
      const w = Math.random() * Math.PI * 2;
      const v = 30 + Math.random() * 70;
      teil({
        art: "glanz", x: x + Math.cos(w) * 14, y: y + Math.sin(w) * 18, vx: Math.cos(w) * v + 40, vy: Math.sin(w) * v,
        r: 1 + Math.random() * 1.3, farbe: Math.random() < 0.6 ? "#ffe9a8" : "#ffffff", leben: 0.5 + Math.random() * 0.4, max: 0.9,
      });
    }
  }

  function schrift(text, x, y, farbeText, gross) {
    state.schriften.push({ text, x, y, farbe: farbeText, gross, leben: 1.15, max: 1.15 });
  }

  // ---------------------------------------------------------------------------
  // Der Lauf
  // ---------------------------------------------------------------------------
  function physik(dt) {
    const f = state.f;
    state.uhr += dt;
    state.hitze = clamp(state.hitze + (gedrueckt ? HEIZ : -KUEHL) * dt, 0, 1);
    const wind = windBei(f.x, f.y + MESS, state.uhr);
    const ax = (wind - f.vx) * MITNAHME;
    f.vx += ax * dt;
    f.vy += ((state.hitze - 0.5) * 2 * AUF - DAEMPF * f.vy) * dt;
    f.x += f.vx * dt;
    f.y += f.vy * dt;
    pendeln(ax, dt);
    state.weit = Math.max(state.weit, f.x);
    // Die Front zieht nach – nie weiter zurück als FRONT_MAX.
    state.front.x = Math.max(state.front.x + frontTempo() * dt, f.x - FRONT_MAX);
    const p = pruefen();
    if (p.grund) crash(p.grund, p.x, p.y);
  }

  // Die Hülle schaukelt: Zieht der Wind an ihr, bleibt der Korb zurück.
  function pendeln(ax, dt) {
    state.neigV += (-state.neig * 22 - state.neigV * 4.5 + ax * 0.016) * dt;
    state.neig = clamp(state.neig + state.neigV * dt, -0.22, 0.22);
  }

  function crash(grund, px, py) {
    if (state.schritt !== "fahrt") return;
    const f = state.f;
    state.schritt = "crash";
    state.grund = grund;
    state.crashZeit = state.zeit;
    state.stoss = 1;
    state.zeitlupe = 0;
    state.rissSeite = px >= f.x ? 1 : -1;
    zerreissen(f.x, f.y + 4);
    if (grund === "berg" || grund === "boden") staub(px, py);
    else blitzSchlagen(px + (Math.random() - 0.5) * 30, grund === "front" ? DECKE : Math.min(DECKE, py + 140), px, py, 1.4);
    state.schriften = [];
    schrift(GRUENDE[grund]?.bild || "", f.x + 20, f.y + 48, "#ffd6a0", 22);
    kids()?.playJingle?.("retry");
    kids()?.vibrate?.([30, 40, 60]);
    stepTimer = window.setTimeout(finish, 1100);
  }

  // Nach dem Riss: Die Hülle fällt in sich zusammen, der Ballon stürzt und
  // bleibt auf dem Hang liegen.
  function stuerzen(dt) {
    const f = state.f;
    f.vy = Math.max(-260, f.vy - 420 * dt);
    f.vx *= 1 - 1.6 * dt;
    f.x += f.vx * dt;
    f.y += f.vy * dt;
    const boden = roh(f.x) + KORB.unten - 1;
    if (f.y < boden) {
      f.y = boden;
      if (f.vy < -60) staub(f.x, boden - KORB.unten);
      f.vy = 0;
      f.vx *= 0.5;
    }
    state.neig += (state.rissSeite * 0.5 - state.neig) * dt * 2;
  }

  // Was der Spieler im Wind erlebt: der Übergang in den nächsten Abschnitt
  // (sauber erwischt? dann «perfekt!», hintereinander eine Serie), eine
  // schnelle Schicht («Rückenwind!») und der Moment, in dem es zurück geht
  // («Gegenwind!»).
  function windErleben() {
    const f = state.f;
    const l = state.welt.schichten;
    const nr = schichtNr(f.x);
    const T = tempoBei(f.x);
    if (nr > state.abschnitt) {
      const vor = l[nr - 1];
      const soll = Math.min(vor.vGut, l[nr].vGut);
      if (f.vx >= soll * 0.82) {
        state.serie += 1;
        const text = state.serie > 1 ? `perfekt! ×${state.serie}` : "perfekt!";
        schrift(text, f.x + 24, f.y + 56, state.serie > 2 ? "#ffd23f" : "#fff1a8", state.serie > 2 ? 20 : 18);
        glanz(f.x, f.y + 12, Math.min(3, state.serie));
        kids()?.playJingle?.(state.serie > 2 ? "star" : "correct");
        kids()?.vibrate?.(10);
      } else {
        state.serie = 0;
      }
      state.abschnitt = nr;
    } else if (nr < state.abschnitt) {
      state.abschnitt = nr;
    }
    if (state.zeit - state.windZeit > 3.5) {
      const w = windBei(f.x, f.y + MESS);
      if (w > T * 1.35 && f.vx > T * 1.2) {
        state.windZeit = state.zeit;
        schrift("Rückenwind!", f.x + 20, f.y + 56, "#ffc27a", 16);
      } else if (f.vx < -T * 0.12 && w < 0) {
        state.windZeit = state.zeit;
        schrift("Gegenwind!", f.x - 10, f.y + 56, "#b8ccff", 16);
        kids()?.vibrate?.(8);
      }
    }
  }

  function takt(dtEcht) {
    // Ein knapper Vorbeiflug dehnt die Zeit für einen Augenblick.
    const dt = dtEcht * (1 - 0.62 * glatt(clamp(state.zeitlupe, 0, 1)));
    state.zeitlupe = Math.max(0, state.zeitlupe - dtEcht * 2.6);
    state.zeit += dt;
    if (state.stoss > 0) state.stoss = Math.max(0, state.stoss - dt * 2.5);
    const f = state.f;

    if (state.phase === "zuschauen") {
      zuschauenTakt(dt);
    } else if (state.schritt === "fahrt") {
      const brannte = gedrueckt;
      const n = Math.max(1, Math.ceil(dt / TAKT - 1e-9));
      for (let i = 0; i < n && state.schritt === "fahrt"; i += 1) physik(dt / n);
      state.flamme = brannte ? Math.min(1, state.flamme + dt * 14) : Math.max(0, state.flamme - dt * 10);
      if (brannte && Math.random() < dt * 8) funken(f.x, f.y - 6);

      if (state.schritt === "fahrt") {
        // Knapp vorbei: eine Schrift, kurz Zeitlupe.
        if (pruef.knapp < 5 && state.zeit - state.knappZeit > 1.3) {
          state.knappZeit = state.zeit;
          state.zeitlupe = 1;
          schrift("knapp!", f.x + 10, f.y + 52, "#fff1a8", 17);
          kids()?.vibrate?.(12);
        }
        windErleben();
        const meter = Math.floor(meterBei(state.weit));
        if (meter !== state.meter) {
          if (Math.floor(meter / 100) > Math.floor(state.meter / 100)) {
            schrift(`${Math.floor(meter / 100) * 100} m`, f.x + 40, f.y + 36, "#ffffff", 16);
            kids()?.playJingle?.("star");
          }
          state.meter = meter;
          state.punkte = meter;
          shell.setCount(meter);
          ueberholen();
        }
      }
    } else if (state.schritt === "start") {
      // Vor dem ersten Druck schwebt der Ballon über der Wiese, und ab und
      // zu faucht der Brenner.
      f.y = START.y + Math.sin(state.zeit * 1.6) * (ruhig() ? 0 : 5);
      f.vx = 0;
      const faucht = !ruhig() && state.zeit % 3 < 0.45;
      state.flamme = faucht ? Math.min(1, state.flamme + dt * 14) : Math.max(0, state.flamme - dt * 10);
      pendeln(Math.sin(state.zeit * 1.1) * 20, dt);
    } else if (state.schritt === "crash") {
      stuerzen(dt);
      state.flamme = 0;
    }

    schlierenPflegen(dt);
    blitzePflegen(dt);

    for (let i = state.teile.length - 1; i >= 0; i -= 1) {
      const t = state.teile[i];
      if (t.art === "stoff") {
        t.vy -= 90 * dt;
        t.vx *= 1 - 2.2 * dt;
        t.vy *= 1 - 1.6 * dt;
        t.dreh += dt * 7;
      } else if (t.art === "funke") {
        t.vy -= 60 * dt;
      } else if (t.art === "glanz") {
        t.vx *= 1 - 2.4 * dt;
        t.vy *= 1 - 2.4 * dt;
      } else {
        t.vx *= 1 - 1.4 * dt;
      }
      t.x += t.vx * dt;
      t.y += t.vy * dt;
      t.leben -= dt;
      if (t.leben <= 0) state.teile.splice(i, 1);
    }
    for (let i = state.schriften.length - 1; i >= 0; i -= 1) {
      state.schriften[i].leben -= dt;
      if (state.schriften[i].leben <= 0) state.schriften.splice(i, 1);
    }

    if (state.schritt === "crash") {
      state.camX += (camXZiel() - state.camX) * Math.min(1, dt * 2);
    } else {
      if (state.schritt === "fahrt") state.an += (anZiel() - state.an) * Math.min(1, dtEcht * 1.1);
      state.camX = camXZiel();
    }
    weltBis(state.camX + view.w + 420);

    if (state.phase === "spiel") {
      gegner?.takt(state.punkte, { a: Math.round(f.x - START.x), b: Math.round(f.y), c: zustand() });
    }
  }

  // c für geist.js: ab 100 brennt der Brenner, der Rest ist die Wärme.
  const zustand = () => (gedrueckt ? 100 : 0) + Math.round(state.hitze * 99);

  // An Platz 1 und der eigenen Bestmarke vorbei: Das soll man merken.
  function ueberholen() {
    if (state.phase !== "spiel") return;
    (gegner?.gegner?.() || []).forEach((ziel) => {
      if (ziel.art === "alle" || !(ziel.punkte > 0)) return;
      const schluessel = `${ziel.art}:${ziel.punkte}`;
      if (state.punkte <= ziel.punkte || state.geschlagen.has(schluessel)) return;
      state.geschlagen.add(schluessel);
      schrift(ziel.art === "eigen" ? "Bestmarke!" : "Platz 1!", state.f.x + 30, state.f.y + 60, ziel.farbe, 19);
      kids()?.playJingle?.("correct");
    });
  }

  function loop(now) {
    frame = window.requestAnimationFrame(loop);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    messen();
    takt(dt);
    zeichnen();
  }

  // ---------------------------------------------------------------------------
  // Zuschauen
  // ---------------------------------------------------------------------------
  // Eine aufgezeichnete Fahrt durch ihre eigene Welt: Der Zufall hält die
  // Saat (geist.js, zuschauer), startRun baut damit dieselbe Welt, und der
  // Ballon steht Bild für Bild dort, wo er damals war – mit der Flamme, wenn
  // der Brenner brannte. Die Front zieht wie damals nach; am Ende reisst die
  // Hülle.
  function zuschauenStarten() {
    if (!zuschauer?.lauf) return;
    startRun();
    state.phase = "zuschauen";
    shell.setPhase("play");
    zuschauer.los();
  }

  function zuschauenTakt(dt) {
    const s = zuschauer.stand();
    if (!s) return;
    const f = state.f;
    if (state.schritt === "crash") {
      stuerzen(dt);
      zuschauer.weiter();
      return;
    }
    state.schritt = "fahrt";
    state.uhr += dt;
    const vorher = f.vx;
    f.x = START.x + s.a;
    f.y = s.b;
    f.vx = Number.isFinite(s.va) ? s.va : f.vx;
    f.vy = Number.isFinite(s.vb) ? s.vb : 0;
    const c = s.c || 0;
    const brennt = c >= 100;
    state.hitze = clamp((c % 100) / 99, 0, 1);
    state.flamme = brennt ? Math.min(1, state.flamme + dt * 14) : Math.max(0, state.flamme - dt * 10);
    if (brennt && Math.random() < dt * 8) funken(f.x, f.y - 6);
    pendeln(dt > 0 ? ((f.vx - vorher) / dt) * 0.3 : 0, dt);
    state.weit = Math.max(state.weit, f.x);
    state.front.x = Math.max(state.front.x + frontTempo() * dt, f.x - FRONT_MAX);
    state.an += (anZiel() - state.an) * Math.min(1, dt * 1.1);
    const meter = Math.max(0, Math.floor(s.punkte));
    if (meter !== state.meter) {
      state.meter = meter;
      state.punkte = meter;
      shell.setCount(meter);
    }
    // Am Ende der Fahrt: die Hülle reisst, wie damals – nur im Bild.
    if (zuschauer.fertig?.()) {
      const p = pruefen();
      state.schritt = "crash";
      state.crashZeit = state.zeit;
      state.stoss = 0.6;
      state.rissSeite = p.x >= f.x ? 1 : -1;
      f.vy = Math.min(f.vy, 0);
      zerreissen(f.x, f.y + 4);
    }
    zuschauer.weiter();
  }

  // Die Runde beginnt: mit dem ersten Druck – oder im Live-Modus zum
  // gemeinsamen Start (game-shell.js, live.los).
  function losGehts() {
    if (state.phase !== "bereit") return;
    state.phase = "spiel";
    state.schritt = "fahrt";
    state.f.y = START.y;
    state.f.vy = 0;
    state.f.vx = windBei(state.f.x, state.f.y + MESS) * 0.6;
    state.neig = 0;
    state.neigV = 0;
    shell.setPhase("play");
    gegner?.los();
    kids()?.vibrate?.(8);
  }

  // ---------------------------------------------------------------------------
  // Halten und Loslassen
  // ---------------------------------------------------------------------------
  function druecken() {
    if (state.phase === "zuschauen") return;
    gedrueckt = true;
    // Im Live-Modus beginnt die Runde für alle zugleich (live.los).
    if (!shell.live) losGehts();
  }

  function loslassen() {
    gedrueckt = false;
  }

  // ---------------------------------------------------------------------------
  // Ablauf
  // ---------------------------------------------------------------------------
  function startRun() {
    clearStep();
    stopLoop();
    shell.closeOverlay();
    zufall.neu();
    shell.setPhase("intro");
    state.phase = "bereit";
    state.schritt = "start";
    state.punkte = 0;
    state.meter = 0;
    state.weit = START.x;
    state.f = { x: START.x, y: START.y, vx: 0, vy: 0 };
    state.hitze = 0.5;
    state.flamme = 0;
    state.neig = 0;
    state.neigV = 0;
    state.an = AN_VORN;
    state.front = { x: START.x - FRONT_START };
    state.uhr = 0;
    state.welt = neueWelt();
    nrHinweis = 0;
    kacheln.clear();
    state.grund = "";
    state.abschnitt = 0;
    state.serie = 0;
    state.rissSeite = 1;
    state.schlieren = [];
    state.fetzen = [];
    state.teile = [];
    state.schriften = [];
    state.blitze = [];
    state.blitz = 0;
    state.stoss = 0;
    state.zeitlupe = 0;
    state.knappZeit = -9;
    state.windZeit = -9;
    state.zeit = 0;
    state.geschlagen = new Set();
    gedrueckt = false;
    shell.setCount(0);
    gegner?.runde();

    shell.clear();
    const prompt = shell.el("p", "cm-prompt bl-prompt", "Halten heizt, Loslassen kühlt – such den Wind nach rechts!");
    shell.play.append(prompt, buildPlatz());
    view.cssW = 0;
    view.cssH = 0;
    messen();
    weltBis(START.x + view.w + 420);
    state.abschnitt = schichtNr(START.x);
    state.camX = camXZiel();

    last = performance.now();
    frame = window.requestAnimationFrame(loop);
  }

  function zaehleHoch(ziel) {
    const zahl = host.querySelector(".cm-result-score");
    if (!zahl) return;
    if (ruhig() || ziel <= 1) { zahl.textContent = String(ziel); return; }
    const dauer = Math.min(800, 160 + ziel * 2);
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
    clearStep();
    stopLoop();
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
    kids()?.playJingle?.("win");
    const grund = GRUENDE[state.grund]?.tafel || "";
    shell.showResult({
      label: "Deine Meter",
      points: punkte,
      detail: rekord ? "Neuer Rekord!" : `${grund}${grund && vorher ? " · " : ""}${vorher ? `Bestwert ${vorher} m` : ""}`,
      geist,
    });
    if (rekord) host.querySelector(".cm-result-detail")?.classList.add("bl-rekord");
    zaehleHoch(punkte);
  }

  // ---------------------------------------------------------------------------
  // Start
  // ---------------------------------------------------------------------------
  shell = shellApi.mount({
    host,
    title: "Windschichten",
    area: "problemloesen",
    accent: "#3FA34D",
    accentDark: "#2c7337",
    clock: false,
    onRestart: () => (zuschauer ? zuschauenStarten() : startRun()),
    live: { los: losGehts, stopp: () => finish(), zuschauen: (quelle) => { zuschauer = quelle; zuschauenStarten(); } },
  });
  zuschauer = window.LernappGeist?.zuschauer?.({
    host, spiel: "balloonRide", fassung: "t2", zufall, einheit: "m", nochmal: zuschauenStarten,
  }) || null;
  if (!zuschauer) {
    gegner = window.LernappGeist?.fuer?.({ spiel: "balloonRide", host, art: "tempo", fassung: "t2", alle: true, zufall }) || null;
  }

  startRun();
  zuschauer?.laden.then((da) => { if (da) zuschauenStarten(); });

  host.addEventListener("pointerdown", (event) => {
    if (event.target.closest("button, a, input")) return;
    druecken();
  });
  window.addEventListener("pointerup", loslassen);
  window.addEventListener("pointercancel", loslassen);
  // Wer das Fenster verlässt, nimmt auch den Finger vom Brenner.
  window.addEventListener("blur", loslassen);

  const TASTEN = new Set([" ", "Enter", "ArrowUp"]);
  document.addEventListener("keydown", (event) => {
    if (!TASTEN.has(event.key)) return;
    if (document.activeElement?.tagName === "BUTTON") return;
    event.preventDefault();
    if (event.repeat) return;
    druecken();
  });
  document.addEventListener("keyup", (event) => {
    if (!TASTEN.has(event.key)) return;
    loslassen();
  });

  window.addEventListener("resize", messen);
  window.addEventListener("orientationchange", messen);
  window.addEventListener("pagehide", () => { clearStep(); stopLoop(); });

  // Für die Vorführung: eine feste Welt (dieselbe Saat wie beim Zuschauen).
  function festeWelt(saat) {
    zufall.halte?.(saat);
    startRun();
  }

  // Für die Prüfskripte.
  window.LernappBallon = {
    DECKE, METER, SEG, TAL, VT, AUF, DAEMPF, HEIZ, KUEHL, MESS, MITNAHME, UEBER, OBEN_RAND, UNTEN_RAND, FRONT_MAX,
    state, view, takt, druecken, loslassen, zeichnen, festeWelt,
    weltBis, windBei, zielBei, schichtBei, bodenBei, tempoBei, frontTempo, pruefen,
  };
})();
