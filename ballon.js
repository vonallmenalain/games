/*
 * ballon.js – Ballonfahrt.
 * ---------------------------------------------------------------------------
 * Ein Heissluftballon treibt mit dem Wind über ein Gebirge. Wer den Finger
 * aufs Bild legt, zündet den Brenner: Die Hülle wird heiss, und – ein wenig
 * träge – steigt der Ballon. Wer loslässt, lässt sie abkühlen, und er sinkt.
 * Weil die Luft in der Hülle erst warm oder kalt werden muss, dreht er nie
 * sofort um: Wer gut fährt, heizt, bevor er steigen muss.
 *
 * Der Wind weht oben schneller als unten. Hoch oben kommt man flott voran,
 * aber dort hängen die Gewitter; unten ist es ruhig, aber dort stehen die
 * Berge. Und von hinten zieht eine Gewitterfront nach, etwas langsamer als
 * der Wind auf mittlerer Höhe: Wer zu lange tief im Tal bleibt, den holt
 * sie ein. Berg, Fels, Gewitterwolke, die Gewitterdecke über allem oder die
 * Front – eine Berührung, und die Hülle reisst. Gezählt wird, wie weit der
 * Ballon kommt, in Metern.
 *
 * Die Welt kommt aus dem Zufall (zufall.js): ohne Turnier jedes Mal eine
 * andere, im Turnier für alle im selben Versuch dieselbe. Durch sie führt
 * immer eine Gasse, die der Ballon schaffen kann – wie steil und wie
 * plötzlich sie die Höhe wechselt, richtet sich danach, wie schnell er dort
 * steigen und sinken und wie schnell die Hülle heiss oder kalt werden kann.
 * Die Gasse liegt nie so tief, dass die Front sie einholte. Berge,
 * Felsnadeln und Felsbögen stehen unter ihr, Gewitter über ihr – nach
 * hinten immer näher; die Gasse wird enger und der Wind schneller.
 *
 * Mit der Strecke vergeht der Tag: Morgenrot, heller Mittag, Abendrot und
 * eine Nacht mit Mond und Sternen, in der die Hülle vom Brenner leuchtet.
 *
 * Die Gegner (geist.js) fahren als farbige Ballone aus Licht mit – genau so,
 * wie sie in ihrer besten Runde gefahren sind, durch ihre eigene Welt.
 * Platz 1 und die eigene Bestmarke stehen als Fahne bei ihren Metern im
 * Gelände. Und die besten Fahrten lassen sich anschauen (?zuschauen=,
 * geist.js): durch ihre eigene Welt, gewürfelt mit derselben Saat. c sagt
 * dabei, ob der Brenner brannte (ab 100) und wie heiss die Hülle war (der
 * Rest, 0 bis 99) – so brennt die Flamme auch beim Zuschauen.
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
  // daraus – Blitze, Regen, Funken und Vögel würfeln Math.random oder hängen
  // an einer festen Zahl, damit die Welt nicht davon abhängt, wie jemand
  // fährt.
  const zufall = window.LernappZufall?.fuer?.("balloonRide") || { neu() {}, zahl: () => Math.random() };

  // ---------------------------------------------------------------------------
  // Die Welt
  // ---------------------------------------------------------------------------
  const DECKE = 392;               // Unterkante der Gewitterdecke, im Mittel
  const BAND = 420;                // vom Talgrund bis in die Decke hinein
  const TAL = 6;                   // tiefer geht kein Tal – dort liegt ein See
  const METER = 10;
  const SEG = 12;                  // Abstand der Stützpunkte des Geländes
  const VORLAUF = 420;             // so viel Welt liegt hinter dem Start
  const START = { x: 0, y: 230 };
  const BALLON_AN = 0.22;          // so weit vom linken Rand fährt der Ballon
  const WELT_W = 340;
  const WELT_W_MAX = 760;
  const SICHT_UNTEN = -4;          // so viel muss immer im Bild stehen …
  const SICHT_OBEN = DECKE + 36;   // … vom Talgrund bis in die Decke
  const SICHT_H = SICHT_OBEN - SICHT_UNTEN;

  // Die Fahrt. Die Wärme der Hülle (0 kalt … 1 heiss) folgt dem Brenner
  // gleichmässig; daraus folgt der Auftrieb, und der Luftwiderstand bremst.
  // Bei halber Wärme schwebt der Ballon. Vom vollen Sinken bis zum Steigen
  // vergehen so gut sechs Zehntel Sekunden, umgekehrt etwas mehr.
  const AUF = 280;                 // Auftrieb bei heisser (Abtrieb bei kalter) Hülle
  const DAEMPF = 2.4;              // Luftwiderstand, senkrecht
  const VT = AUF / DAEMPF;         // schneller steigt oder sinkt er nie
  const HEIZ = 1.8;                // so schnell wird die Hülle heiss (je Sekunde)
  const KUEHL = 1.2;               // so schnell kühlt sie ab
  const MITNAHME = 1.6;            // so schnell nimmt ihn der Wind mit
  const TAKT = 1 / 240;            // gerechnet wird in festen kleinen Schritten

  // Der Wind: ein Grundtempo nach der Strecke, und je höher, desto mehr –
  // unten sechs Zehntel davon, unter der Decke das Anderthalbfache.
  const V0 = 92;
  const V_MAX = 210;
  const V_WEG = 900;               // Meter, nach denen gut sechs Zehntel des Zuwachses da sind
  const WIND_UNTEN = 0.6;
  const WIND_OBEN = 1.45;

  // Die Gewitterfront. Sie zieht mit FRONT_F des Grundtempos – das ist der
  // Wind auf etwa einem Drittel der Höhe. Die Gasse liegt immer darüber
  // (MITTE_MIN), wer ihr folgt, entkommt also. Weiter als FRONT_MAX fällt
  // die Front nie zurück.
  const FRONT_F = 0.86;
  const FRONT_START = 560;
  const FRONT_MAX = 720;

  // Die Gasse: anfangs breit, nach hinten enger.
  const WEIT0 = 196;
  const WEIT_MIN = 96;
  const WEIT_WEG = 850;
  const MITTE_MIN = 182;           // hier weht der Wind gut ein Zehntel schneller als die Front zieht
  const DECKE_FREI = 30;           // so viel Luft bleibt zwischen Gasse und Decke
  const GERADE_BIS = 320;          // bis hier geht es geradeaus …
  const WOLKEN_AB = 600;           // … und erst ab hier hängen Gewitter
  const NADELN_AB = 240;           // Meter: Felsnadeln
  const BOEGEN_AB = 800;           // Meter: Felsbögen
  const LUECKE_MIN = 3;            // so nah kommt kein Berg an die Gasse

  // Die Hülle von der Seite, rechte Hälfte, von oben nach unten – im Bild
  // gezeichnet (y nach unten), um den Ballon herum: der Mund bei y = 1, der
  // Korb von 9 bis 17. Dieselben Masse prüft beruehrt().
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
    ? cloudApi.register({ key: "lernapp.ballon", empty: { runs: 0, scores: [] }, merge: cloudApi.mergeScores(TOP_COUNT) })
    : {
      read: () => ({ runs: 0, scores: [] }),
      write(data) { return data; },
      update(fn) { return fn(this.read()); },
      onChange() { return () => {}; },
    };

  // Was eine Runde beendet hat – auf der Tafel und als Schrift im Bild.
  const GRUENDE = {
    berg: { tafel: "Am Berg hängen geblieben", bild: "Berg!" },
    fels: { tafel: "Am Felsbogen gestreift", bild: "Fels!" },
    wolke: { tafel: "Ins Gewitter geraten", bild: "Gewitter!" },
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
  const windFaktor = (y) => WIND_UNTEN + (WIND_OBEN - WIND_UNTEN) * clamp(y / DECKE, 0, 1);
  const windBei = (x, y) => tempoBei(x) * windFaktor(y);
  const weiteBei = (x) => WEIT_MIN + (WEIT0 - WEIT_MIN) * Math.exp(-meterBei(x) / WEIT_WEG);
  // Wie viel vom Können des Ballons die Welt an dieser Stelle verlangt:
  // anfangs wenig, nach hinten immer mehr – nie alles.
  const schwereBei = (x) => 1 - Math.exp(-meterBei(x) / 650);

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
  const ZYKLUS = 3500;
  const TAGESZEIT = [
    { m: 0, oben: "#41539c", mitte: "#c88aa6", horizont: "#ffc898", licht: "#ffc48c", fern: "#857da9", wiese: "#6c8a58", fels: "#7d6b6c", sturm: "#3a3550", sonne: 0.05, nacht: 0.2, hell: 0.8, wolke: [1, 0, 0, 0] },
    { m: 380, oben: "#3a7bd0", mitte: "#8fc0ea", horizont: "#ffe9c8", licht: "#fff2d6", fern: "#7f9cc4", wiese: "#73a257", fels: "#8a7b72", sturm: "#3c4058", sonne: 0.36, nacht: 0, hell: 1, wolke: [0.2, 0.8, 0, 0] },
    { m: 760, oben: "#2f78d8", mitte: "#86c1f2", horizont: "#d8f0ff", licht: "#ffffff", fern: "#86a5cc", wiese: "#6aa64f", fels: "#8d8178", sturm: "#3c4159", sonne: 0.62, nacht: 0, hell: 1, wolke: [0, 1, 0, 0] },
    { m: 1120, oben: "#3c6fc4", mitte: "#a4c3e6", horizont: "#ffe1a6", licht: "#ffe3a6", fern: "#8f9cc0", wiese: "#789a4c", fels: "#8f7a6a", sturm: "#3e3f56", sonne: 0.3, nacht: 0, hell: 0.97, wolke: [0, 0.75, 0.25, 0] },
    { m: 1420, oben: "#34478f", mitte: "#d77a86", horizont: "#ffaa58", licht: "#ffaa66", fern: "#8a6f96", wiese: "#5d6c46", fels: "#6e5560", sturm: "#3d3047", sonne: 0.05, nacht: 0.12, hell: 0.82, wolke: [0, 0, 1, 0] },
    { m: 1620, oben: "#1c2256", mitte: "#5b3a73", horizont: "#c8655c", licht: "#e28f86", fern: "#4c3f68", wiese: "#38463f", fels: "#463b50", sturm: "#2c2540", sonne: -0.08, nacht: 0.6, hell: 0.58, wolke: [0, 0, 0.5, 0.5] },
    { m: 1860, oben: "#080c26", mitte: "#131b46", horizont: "#28376c", licht: "#b8c8ff", fern: "#232c56", wiese: "#1f2d38", fels: "#29304a", sturm: "#1d1f38", sonne: -0.3, nacht: 1, hell: 0.45, wolke: [0, 0, 0, 1] },
    { m: 2900, oben: "#080c26", mitte: "#131b46", horizont: "#28376c", licht: "#b8c8ff", fern: "#232c56", wiese: "#1f2d38", fels: "#29304a", sturm: "#1d1f38", sonne: -0.3, nacht: 1, hell: 0.45, wolke: [0, 0, 0, 1] },
    { m: 3260, oben: "#1b2158", mitte: "#4b3c78", horizont: "#b4728a", licht: "#e6a6b6", fern: "#4f4a78", wiese: "#3b4a44", fels: "#4a4058", sturm: "#2a2642", sonne: -0.06, nacht: 0.55, hell: 0.62, wolke: [0.5, 0, 0, 0.5] },
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
    hoechst: 0,           // die höchste Fahrt der Runde, in Einheiten über dem Tal
    f: { x: START.x, y: START.y, vx: V0, vy: 0 },
    hitze: 0.5,           // Wärme der Hülle, 0 … 1; bei 0,5 schwebt er
    flamme: 0,            // wie hell die Flamme gerade brennt (nur fürs Bild)
    neig: 0,              // Schräglage der Hülle (Bogenmass, rechts herum positiv)
    neigV: 0,
    front: { x: START.x - FRONT_START },
    camX: 0,
    camY: 0,
    welt: null,
    grund: "",
    schlieren: [],
    fetzen: [],
    teile: [],
    schriften: [],
    blitze: [],
    blitz: 0,             // wie hell der Himmel gerade aufleuchtet
    stoss: 0,
    zeitlupe: 0,
    knappZeit: -9,
    zeit: 0,
    crashZeit: 0,
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
   * Die Welt sind Stützpunkte im Abstand SEG. Jeder trägt die Mitte und die
   * Weite der Gasse und die Höhe des Bodens darunter. Die Mitte wandert in
   * Abschnitten von einer Höhe zur nächsten, sanft wie eine Kosinuskurve –
   * so lang, dass der Ballon mitkommt (laengeFuer). Der Boden liegt um eine
   * Lücke unter der Gasse: in Tälern weit, an Graten, Gipfeln und Nadeln
   * knapp. Über der Gasse hängen Gewitterwolken aus Ballen, und manchmal
   * spannt sich ein Felsbogen über sie. Ganz oben liegt die Gewitterdecke.
   *
   * Alles wird der Reihe nach gewürfelt, Punkt für Punkt – egal, wie weit
   * voraus gerade gebaut wird, entsteht dieselbe Welt.
   */
  function neueWelt() {
    return {
      punkte: [],
      abschnitt: null,
      gelaende: null,
      bogen: null,
      boegen: [],
      wolken: [],
      wolkeNaechste: null,
      decke: [],
    };
  }

  // Wie lang ein Abschnitt sein muss, damit der Ballon um d steigt oder
  // sinkt: nie schneller, als er kann, nie mit mehr Kraft, als die Hülle
  // hergibt, und nie so plötzlich, dass sie nicht schnell genug heiss oder
  // kalt wird. Von allem verlangt die Welt nur einen Teil – nach hinten mehr.
  function laengeFuer(d, v, k) {
    const teil = lerp(0.3, 0.58, k);
    let L = Math.max(lerp(340, 190, k), (Math.PI * d * v) / (2 * VT * teil));
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

  function neuerAbschnitt(x) {
    const w = state.welt;
    const c0 = w.abschnitt ? w.abschnitt.c1 : START.y;
    if (x < GERADE_BIS) {
      w.abschnitt = { x0: x, L: GERADE_BIS - x + SEG, c0, c1: c0 };
      return;
    }
    const k = schwereBei(x);
    const weite = weiteBei(x);
    const lo = MITTE_MIN;
    const hi = DECKE - DECKE_FREI - weite / 2;

    // Ein Felsbogen kommt nur in einem geraden Abschnitt: Kurve und Bogen
    // zugleich verlangten zu viel.
    if (meterBei(x) >= BOEGEN_AB && !w.bogen && zufall.zahl() < lerp(0.06, 0.16, k)) {
      const lang = lerp(150, 260, zufall.zahl());
      const bogen = {
        x0: x + 90,
        x1: x + 90 + lang,
        c: c0,
        rand: lerp(lerp(24, 8, k), lerp(12, 3, k), zufall.zahl()),
        bauch: lerp(6, 26, zufall.zahl()),
        sockel: lerp(lerp(26, 8, k), lerp(14, 3, k), zufall.zahl()),
        // Ein Gipfel, der in die Decke reicht – oder einer, über den man
        // auch hinwegfahren kann.
        offen: zufall.zahl() < 0.4,
        gipfel: lerp(50, 120, zufall.zahl()),
        h1: zufall.zahl() * 2 - 1,
        h2: zufall.zahl() * 2 - 1,
      };
      w.boegen.push(bogen);
      w.bogen = bogen;
      w.abschnitt = { x0: x, L: lang + 220, c0, c1: c0 };
      return;
    }

    const gerade = zufall.zahl() < lerp(0.25, 0.1, k);
    const c1 = gerade ? clamp(c0, lo, hi) : lerp(lo, hi, zufall.zahl());
    const v = tempoBei(x) * windFaktor(Math.max(c0, c1) + weite / 2);
    w.abschnitt = { x0: x, L: laengeFuer(Math.abs(c1 - c0), v, k), c0, c1 };
  }

  // Ein Stück Gelände: Wiese, Tal oder Grat – mit Gipfeln und Nadeln.
  function neuesGelaende(x) {
    const w = state.welt;
    const k = schwereBei(x);
    const g0 = w.gelaende ? w.gelaende.g1 : 70;
    const z = zufall.zahl();
    let art = "wiese";
    if (x >= GERADE_BIS + 120) {
      if (z < lerp(0.22, 0.14, k)) art = "tal";
      else if (z < lerp(0.55, 0.38, k)) art = "wiese";
      else art = "grat";
    }
    const L = lerp(200, 420, zufall.zahl()) * lerp(1, 0.75, k);
    let g1 = 0;
    if (art === "tal") g1 = 420;
    else if (art === "wiese") g1 = lerp(lerp(64, 36, k), lerp(120, 76, k), zufall.zahl());
    else g1 = lerp(lerp(44, 8, k), lerp(78, 28, k), zufall.zahl());

    // Gipfel und Nadeln: Sie ziehen den Boden bis auf eine kleine Lücke an
    // die Gasse heran – Nadeln schmal und spitz, Gipfel breit.
    const spitzen = [];
    if (x >= GERADE_BIS + 120) {
      const anzahl = Math.floor(zufall.zahl() * lerp(2.2, 3.6, k));
      for (let n = 0; n < anzahl; n += 1) {
        const nadel = meterBei(x) >= NADELN_AB && zufall.zahl() < lerp(0.3, 0.55, k);
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

  // Die nächste Gewitterwolke vormerken – gebaut wird sie, sobald die Gasse
  // unter ihr feststeht.
  function planeWolke(ab) {
    const k = schwereBei(ab);
    state.welt.wolkeNaechste = {
      x: ab + lerp(lerp(420, 130, k), lerp(640, 230, k), zufall.zahl()),
      breite: lerp(70, 160, zufall.zahl()) * lerp(1, 1.3, k),
      nah: zufall.zahl(),
      hoch: zufall.zahl(),
      decke: zufall.zahl(),
    };
  }

  // Die Oberkante der Gasse aus den schon gebauten Punkten.
  function roh(x, feldName) {
    const p = state.welt.punkte;
    const k = (x + VORLAUF) / SEG;
    const i = clamp(Math.floor(k), 0, p.length - 2);
    const u = clamp(k - i, 0, 1);
    return lerp(p[i][feldName], p[i + 1][feldName], u);
  }

  // Die höchste Oberkante der Gasse unter einem Stück [x0, x1].
  function obenMax(x0, x1) {
    let o = -Infinity;
    for (let x = x0; x <= x1 + 0.01; x += SEG / 2) o = Math.max(o, roh(Math.min(x, x1), "oben"));
    return o;
  }

  function baueWolke(n) {
    const w = state.welt;
    const halb = n.breite / 2;
    // Über einem Felsbogen hängt kein Gewitter.
    if (w.boegen.some((b) => b.x1 + 40 > n.x - halb - 40 && b.x0 - 40 < n.x + halb + 40)) return;
    const k = schwereBei(n.x);
    const abstand = lerp(lerp(90, 26, k), lerp(20, 2, k), Math.pow(n.nah, 0.8));
    // Jeder Ballen hält seinen Abstand zur Gasse genau unter sich – so
    // schmiegt sich die Wolke an, auch wo die Gasse steigt oder fällt.
    const kreise = [];
    const setze = (x, y, r) => {
      const frei = obenMax(x - r - 4, x + r + 4) + abstand;
      kreise.push({ x, y: Math.max(y, frei + r), r });
    };
    const m = Math.max(2, Math.round(n.breite / 30));
    let unten = Infinity;
    for (let j = 0; j < m; j += 1) {
      const r = lerp(17, 26, zufall.zahl());
      const x = n.x + (j - (m - 1) / 2) * (n.breite / m) + (zufall.zahl() - 0.5) * 8;
      setze(x, -Infinity, r);
      const c = kreise[kreise.length - 1];
      c.y += zufall.zahl() * 4;
      unten = Math.min(unten, c.y - c.r);
    }
    if (unten > DECKE - 40) return;
    // Manche hängen als Zapfen aus der Decke, andere schweben frei.
    const spitze = n.decke < lerp(0.35, 0.6, k) ? DECKE + 40 : Math.min(unten + lerp(40, 130, n.hoch), DECKE + 40);
    // Darüber aufgetürmt, zur Mitte hin höher – ein Gewitterturm.
    for (let reihe = 1; unten + 20 + reihe * 24 < spitze; reihe += 1) {
      const anzahl = Math.max(1, m - Math.floor(reihe / 2));
      for (let j = 0; j < anzahl; j += 1) {
        const r = lerp(22, 34, zufall.zahl());
        setze(
          n.x + (j - (anzahl - 1) / 2) * (n.breite / Math.max(1, anzahl)) * 0.9 + (zufall.zahl() - 0.5) * 12,
          unten + 20 + reihe * 24 + r * 0.3,
          r,
        );
      }
    }
    let x0 = Infinity;
    let x1 = -Infinity;
    let oben = -Infinity;
    kreise.forEach((c) => {
      x0 = Math.min(x0, c.x - c.r);
      x1 = Math.max(x1, c.x + c.r);
      oben = Math.max(oben, c.y + c.r);
    });
    w.wolken.push({ x: n.x, x0, x1, unten, oben, kreise, licht: 0, regen: unten < DECKE - 90, nr: w.wolken.length });
  }

  function naechsterPunkt() {
    const w = state.welt;
    const i = w.punkte.length;
    const x = i * SEG - VORLAUF;
    if (!w.abschnitt || x >= w.abschnitt.x0 + w.abschnitt.L) neuerAbschnitt(x);
    if (!w.gelaende || x >= w.gelaende.x0 + w.gelaende.L) neuesGelaende(x);

    const a = w.abschnitt;
    const u = clamp((x - a.x0) / a.L, 0, 1);
    const mitte = a.c0 + (a.c1 - a.c0) * (1 - Math.cos(Math.PI * u)) / 2;
    const weite = weiteBei(x);
    const unten = mitte - weite / 2;

    const ge = w.gelaende;
    const v = clamp((x - ge.x0) / ge.L, 0, 1);
    let luecke = ge.g0 + (ge.g1 - ge.g0) * (1 - Math.cos(Math.PI * v)) / 2;
    ge.spitzen.forEach((sp) => {
      const q = Math.abs(x - sp.x) / sp.halb;
      if (q >= 1 || luecke <= sp.ziel) return;
      const form = sp.nadel ? Math.pow(1 - q, 1.4) : (1 + Math.cos(Math.PI * q)) / 2;
      luecke = lerp(luecke, sp.ziel, form);
    });
    // Unter einem Felsbogen steigt der Fels bis knapp an die Gasse.
    const b = w.bogen;
    if (b) {
      const rein = clamp((x - (b.x0 - 70)) / 70, 0, 1) * clamp(((b.x1 + 70) - x) / 70, 0, 1);
      if (luecke > b.sockel) luecke = lerp(luecke, b.sockel, glatt(rein));
      if (x > b.x1 + 80) w.bogen = null;
    }
    if (x > GERADE_BIS) luecke -= ge.rauh * zufall.zahl();
    luecke = Math.max(LUECKE_MIN, luecke);
    const boden = Math.max(TAL, unten - luecke);
    w.punkte.push({ x, mitte, weite, unten, oben: mitte + weite / 2, boden, deko: hash01(i * 1.37 + 0.2) });

    // Die Gewitterdecke: alle drei Punkte ein Ballen.
    if (i % 3 === 0) {
      const r = lerp(30, 48, zufall.zahl());
      const tief = DECKE + lerp(-6, 10, zufall.zahl());
      w.decke.push({ x: x + (zufall.zahl() - 0.5) * 14, y: tief + r, r });
    }

    // Die Gewitter
    if (!w.wolkeNaechste) planeWolke(WOLKEN_AB - 400);
    const n = w.wolkeNaechste;
    if (x >= n.x + n.breite / 2 + 52) {
      baueWolke(n);
      planeWolke(n.x);
    }
  }

  function weltBis(x) {
    const w = state.welt;
    while (!w.punkte.length || w.punkte[w.punkte.length - 1].x < x) naechsterPunkt();
  }

  const bodenBei = (x) => { weltBis(x + SEG * 2); return roh(x, "boden"); };
  const mitteBei = (x) => { weltBis(x + SEG * 2); return roh(x, "mitte"); };

  // Die Unter- und Oberkante eines Felsbogens bei x – oder null.
  function bogenBei(b, x) {
    if (x < b.x0 || x > b.x1) return null;
    const u = (x - b.x0) / (b.x1 - b.x0);
    // Die Gasse ist hier gerade: ihre Oberkante bei der Mitte des Bogens.
    const gasse = b.c + weiteBei(x) / 2;
    const unten = gasse + b.rand + b.bauch * Math.sin(Math.PI * u);
    const welle = Math.sin(u * Math.PI * 3 + b.h1 * 3) * 6 * b.h2 + Math.sin(u * Math.PI * 7) * 3 * b.h1;
    const bogen = Math.sin(Math.PI * u);
    // Ein offener Bogen hat einen Gipfel, über den man auch hinwegkommt; ein
    // geschlossener reicht gerade hinauf in die Gewitterdecke.
    const oben = b.offen
      ? lerp(unten + 30, Math.min(gasse + b.rand + b.bauch + b.gipfel, DECKE - 90) + welle, Math.pow(bogen, 0.6))
      : lerp(unten + 30, DECKE + 70 + welle, Math.pow(bogen, 0.3));
    return { unten, oben: Math.max(unten + 28, oben) };
  }

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
    const vorn = f.x - LINKS - state.front.x;
    if (vorn <= 0) treffer("front", { x: f.x - LINKS, y: f.y - 10 });
    // Boden und Decke
    for (const p of pkte) {
      const ueber = p.y - roh(p.x, "boden");
      if (ueber <= 0) treffer("berg", p);
      pruef.knapp = Math.min(pruef.knapp, ueber);
      if (p.y >= DECKE + 24) treffer("decke", p);
    }
    // Die Ballen der Decke in der Nähe
    const d0 = Math.max(0, Math.floor((f.x - 80 + VORLAUF) / (SEG * 3)) - 1);
    for (let n = d0; n < w.decke.length && w.decke[n].x < f.x + 80; n += 1) {
      const c = w.decke[n];
      for (const p of pkte) {
        const d = Math.hypot(p.x - c.x, p.y - c.y) - c.r;
        if (d <= 0) treffer("decke", p);
        pruef.knapp = Math.min(pruef.knapp, d);
      }
    }
    // Die Gewitter in der Nähe
    for (let n = w.wolken.length - 1; n >= 0; n -= 1) {
      const wo = w.wolken[n];
      if (wo.x1 < f.x - 40) break;
      if (wo.x0 > f.x + 40) continue;
      for (const c of wo.kreise) {
        if (Math.abs(c.x - f.x) > c.r + 24) continue;
        for (const p of pkte) {
          const d = Math.hypot(p.x - c.x, p.y - c.y) - c.r;
          if (d <= 0) treffer("wolke", p);
          pruef.knapp = Math.min(pruef.knapp, d);
        }
      }
    }
    // Die Felsbögen
    for (let n = w.boegen.length - 1; n >= 0; n -= 1) {
      const b = w.boegen[n];
      if (b.x1 < f.x - 40) break;
      if (b.x0 > f.x + 40) continue;
      for (const p of pkte) {
        const k = bogenBei(b, p.x);
        if (!k) continue;
        if (p.y >= k.unten && p.y <= k.oben) treffer("fels", p);
        pruef.knapp = Math.min(pruef.knapp, p.y < k.unten ? k.unten - p.y : p.y - k.oben);
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

  const camXZiel = () => state.f.x - view.w * BALLON_AN;

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
    return { x: view.cssW * 0.76, y: hy - hoehe * (hy - top) * 1.25, r: clamp(view.cssH * 0.04, 12, 30) };
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
      const R = so.r * (t.sonne < 0.2 ? 7 : 5);
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
  // desto blasser im Dunst. Die beiden hinteren tragen Schnee.
  const LAGEN = [
    { p: 0.05, fuss: 50, hoch: 215, f: 1 / 240, saat: 1, scharf: true, dunst: 0.68, schnee: 205 },
    { p: 0.12, fuss: 26, hoch: 170, f: 1 / 180, saat: 2, scharf: true, dunst: 0.52, schnee: 168 },
    { p: 0.24, fuss: 0, hoch: 112, f: 1 / 140, saat: 3, scharf: false, dunst: 0.37, schnee: 0 },
    { p: 0.4, fuss: -16, hoch: 72, f: 1 / 100, saat: 4, scharf: false, dunst: 0.22, schnee: 0 },
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
      vorneY[i] = bildY(roh(x, "boden")) + 12;
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
  const FERNWOLKEN = Array.from({ length: 4 }, (_, i) => ({
    x: hash01(i * 4.1 + 7), y: 190 + hash01(i * 2.3 + 1) * 150, b: 110 + hash01(i * 6.7 + 2) * 120, form: i % 3, p: 0.06 + hash01(i * 3.3) * 0.1,
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
      zeichneWolkeFertig(w, w.form, x, bildY(w.y), b, 0.55);
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
  // Zeichnen: Wind
  // ---------------------------------------------------------------------------
  // Der Wind, den man sieht: helle Schlieren und Wolkenfetzen, die mit dem
  // Wind ihrer Höhe ziehen. Weil die Kamera mit dem Ballon fährt, ziehen
  // die oben nach rechts davon und die unten nach links zurück.
  function schlierenPflegen(dt) {
    const soll = Math.round((view.w * SICHT_H) / (ruhig() ? 16000 : 6500));
    const vKam = state.schritt === "fahrt" || state.phase === "zuschauen" ? state.f.vx : 0;
    const neu = (ueberall) => {
      const y = lerp(20, DECKE - 10, Math.random());
      const wind = windBei(state.f.x, y);
      const rechts = wind < vKam;
      const x = ueberall ? state.camX + Math.random() * view.w : rechts ? state.camX + view.w + 30 + Math.random() * 60 : state.camX - 80 - Math.random() * 40;
      return { x, y, len: 16 + Math.random() * 36, alpha: 0.1 + Math.random() * 0.2 };
    };
    const liste = state.schlieren;
    const anfang = liste.length === 0;
    while (liste.length < soll) liste.push(neu(anfang));
    for (let i = liste.length - 1; i >= 0; i -= 1) {
      const s = liste[i];
      s.x += windBei(state.f.x, s.y) * dt;
      if (s.x < state.camX - 140 || s.x > state.camX + view.w + 140) liste[i] = neu(false);
    }
    if (liste.length > soll) liste.length = soll;

    const fetzen = state.fetzen;
    const sollF = ruhig() ? 2 : 4;
    while (fetzen.length < sollF) fetzen.push({ x: state.camX + Math.random() * view.w * 1.4, y: lerp(60, DECKE - 40, Math.random()), b: 40 + Math.random() * 50, form: Math.floor(Math.random() * 3) });
    fetzen.forEach((w) => {
      w.x += windBei(state.f.x, w.y) * dt;
      if (w.x < state.camX - 120 || w.x > state.camX + view.w + 160) {
        w.y = lerp(60, DECKE - 40, Math.random());
        w.x = windBei(state.f.x, w.y) < vKam ? state.camX + view.w + 60 + Math.random() * 80 : state.camX - 110;
      }
    });
  }

  function zeichneWind() {
    bildTransform();
    const s = view.s;
    state.fetzen.forEach((w) => zeichneWolkeFertig(w, w.form, bildX(w.x), bildY(w.y), w.b * s, 0.26));
    bildTransform();
    g.strokeStyle = farbe(mische([255, 255, 255], tag.licht, 0.3));
    g.lineCap = "round";
    g.lineWidth = Math.max(1, 1.1 * s);
    for (let stufe = 0; stufe < 3; stufe += 1) {
      g.globalAlpha = (0.12 + stufe * 0.08) * (0.6 + 0.4 * tag.hell);
      g.beginPath();
      state.schlieren.forEach((l, n) => {
        if (n % 3 !== stufe) return;
        const tempo = windFaktor(l.y);
        const x = bildX(l.x);
        const y = bildY(l.y);
        g.moveTo(x, y);
        g.lineTo(x - l.len * tempo * s, y);
      });
      g.stroke();
    }
    g.globalAlpha = 1;
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

    // Regen unter den Wolken: schräge Striche, die fallen.
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
          const unten = bildY(Math.max(TAL, roh(x, "boden")));
          g.moveTo(bildX(x), oben);
          g.lineTo(bildX(x) - (unten - oben) * 0.18, unten);
        }
      });
      g.stroke();
      g.setLineDash([]);
    }

    // Die Wolken: dunkle Ballen, oben vom Licht gestreift, innen ein Glimmen
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

  // Eine Gewitterwolke, fertig gemalt in ihrem eigenen kleinen Bild.
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
    g.globalAlpha = 0.08 + tag.nacht * 0.16;
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
  // am linken Rand.
  function zeichneFrontSchatten() {
    const weg = state.camX - state.front.x;
    if (weg <= 0 || state.phase === "bereit") return;
    const nah = clamp(1 - weg / (view.w * 0.7), 0, 1);
    if (nah <= 0) return;
    bildTransform();
    const b = view.cssW * 0.22;
    const v = g.createLinearGradient(0, 0, b, 0);
    v.addColorStop(0, farbe(mische(tag.sturm, [0, 0, 0], 0.3), 0.75 * nah));
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
      const lang = (y0 - y1) * (0.2 + Math.random() * 0.25);
      const ast = [ax, ay];
      blitzWeg(ax, ay, ax + (Math.random() - 0.5) * lang * 1.4, ay - lang, 3, ast);
      aeste.push(ast);
    }
    state.blitze.push({ haupt, aeste, leben: 0.32, max: 0.32, staerke });
    if (!ruhig()) state.blitz = Math.max(state.blitz, 0.45 * staerke);
  }

  // Blitze, wo Gewitter im Bild sind – nie dort, wo der Ballon fährt: Ein
  // Blitz, der ihn träfe, ohne zu zählen, wäre ein falsches Zeichen.
  function blitzePflegen(dt) {
    const w = state.welt;
    const f = state.f;
    const k = schwereBei(f.x);
    const weitWeg = (x) => Math.abs(x - f.x) > 60;
    w.wolken.forEach((wo) => {
      wo.licht = Math.max(0, wo.licht - dt * 3.5);
      if (wo.x1 < state.camX || wo.x0 > state.camX + view.w) return;
      if (Math.random() < dt * lerp(0.12, 0.35, k)) {
        const c = wo.kreise[Math.floor(Math.random() * Math.min(wo.kreise.length, 4))];
        const x = c.x + (Math.random() - 0.5) * c.r;
        wo.licht = 1;
        if (!weitWeg(x)) return;
        blitzSchlagen(x, wo.unten + 4, x + (Math.random() - 0.5) * 50, Math.max(TAL, roh(x, "boden")));
      }
    });
    if (Math.random() < dt * 0.22) {
      const x = state.camX + Math.random() * view.w;
      if (weitWeg(x)) blitzSchlagen(x, DECKE, x + (Math.random() - 0.5) * 60, DECKE - 50 - Math.random() * 90, 0.6);
    }
    const fx = state.front.x;
    if (fx > state.camX - 40 && Math.random() < dt * 0.9) {
      const x = fx - 20 - Math.random() * 100;
      blitzSchlagen(x, DECKE, x + (Math.random() - 0.5) * 60, Math.max(TAL, roh(x, "boden")));
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

  // Die Pfeiler der Felsbögen: hinter der Fahrbahn, im Schatten des Bogens
  // und unten im Dunst – sie tragen ihn, aber im Weg stehen sie nicht.
  function zeichnePfeiler() {
    const w = state.welt;
    weltTransform();
    w.boegen.forEach((b) => {
      if (b.x1 < state.camX - 60 || b.x0 > state.camX + view.w + 60) return;
      [b.x0 + 12, b.x1 - 12].forEach((px, seite) => {
        const k = bogenBei(b, px);
        if (!k) return;
        const fuss = roh(px, "boden") - 24;
        const oben = k.unten + 8;
        const v = g.createLinearGradient(0, oben, 0, fuss);
        v.addColorStop(0, farbe(mische(tag.fels, [8, 10, 28], 0.62)));
        v.addColorStop(0.55, farbe(mische(mische(tag.fels, [8, 10, 28], 0.45), tag.horizont, 0.2)));
        v.addColorStop(1, farbe(mische(tag.fels, tag.horizont, 0.5)));
        g.fillStyle = v;
        // Ein Pfeiler aus Fels: unten breit auf dem Hang, in der Mitte
        // schlanker, oben breit in den Bogen hinein – mit ein paar Kerben.
        const h = (n) => hash01(b.x0 * 0.013 + seite * 7.1 + n * 1.73);
        const breite = (u) => 10 + 16 * Math.pow(1 - u, 2.2) + 9 * Math.pow(u, 3) + (h(Math.round(u * 6)) - 0.5) * 3;
        g.beginPath();
        for (let n = 0; n <= 8; n += 1) {
          const u = n / 8;
          const y = lerp(fuss, oben, u);
          if (n === 0) g.moveTo(px - breite(u), y);
          else g.lineTo(px - breite(u), y);
        }
        for (let n = 8; n >= 0; n -= 1) {
          const u = n / 8;
          g.lineTo(px + breite(u) * (0.85 + h(n + 20) * 0.3), lerp(fuss, oben, u));
        }
        g.closePath();
        g.fill();
        g.strokeStyle = farbe(mische(tag.fels, [8, 10, 28], 0.7), 0.35);
        g.lineWidth = 1.2 / view.s;
        g.beginPath();
        for (let n = 1; n < 6; n += 1) {
          const y = lerp(fuss, oben, n / 6 + (h(n + 40) - 0.5) * 0.06);
          g.moveTo(px - 6, y);
          g.lineTo(px + 5, y - 3 + h(n + 50) * 6);
        }
        g.stroke();
      });
    });
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
    const verlauf = g.createLinearGradient(0, 330, 0, Math.min(-40, tief));
    verlauf.addColorStop(0, farbe(mische(tag.fels, [255, 255, 255], 0.08)));
    verlauf.addColorStop(0.35, farbe(tag.fels));
    verlauf.addColorStop(0.62, farbe(mische(tag.wiese, tag.fels, 0.25)));
    verlauf.addColorStop(0.8, farbe(tag.wiese));
    verlauf.addColorStop(1, farbe(mische(tag.wiese, [10, 16, 30], 0.55)));
    g.fillStyle = verlauf;
    koerper();
    g.fill();

    // Schnee auf den hohen Gipfeln, Schichten im Fels.
    g.save();
    koerper();
    g.clip();
    g.fillStyle = farbe(mische(mische([248, 250, 255], tag.licht, 0.3), [20, 30, 70], tag.nacht * 0.45));
    g.beginPath();
    g.moveTo(p[i0].x, 400);
    for (let i = i0; i <= i1; i += 1) g.lineTo(p[i].x, 282 + (p[i].deko - 0.5) * 16);
    g.lineTo(p[i1].x, 400);
    g.closePath();
    g.fill();
    g.strokeStyle = farbe(mische(tag.fels, [0, 0, 0], 0.35), 0.35);
    g.lineWidth = 1.4 / s;
    g.beginPath();
    for (let i = i0; i <= i1; i += 1) {
      const q = p[i];
      if (q.boden < 120 || q.deko > 0.45) continue;
      const tiefe = 10 + q.deko * 30;
      g.moveTo(q.x - 9, q.boden - tiefe);
      g.lineTo(q.x + 7, q.boden - tiefe - 6 + q.deko * 8);
    }
    g.stroke();
    g.restore();

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
      if (q.deko > 0.42 || q.boden > 230 || q.boden <= TAL + 1) continue;
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

  // Die Felsbögen selbst: Fels über der Gasse, unten im eigenen Schatten,
  // oben im Licht – mit derselben Kante wie das Gebirge.
  function zeichneBoegen() {
    const w = state.welt;
    const s = view.s;
    weltTransform();
    w.boegen.forEach((b) => {
      if (b.x1 < state.camX - 40 || b.x0 > state.camX + view.w + 40) return;
      const unten = [];
      const oben = [];
      for (let x = b.x0; x <= b.x1 + 0.01; x += 5) {
        const k = bogenBei(b, Math.min(x, b.x1));
        unten.push(x, k.unten);
        oben.push(x, k.oben);
      }
      const form = () => {
        g.beginPath();
        g.moveTo(unten[0], unten[1]);
        for (let n = 2; n < unten.length; n += 2) g.lineTo(unten[n], unten[n + 1]);
        for (let n = oben.length - 2; n >= 0; n -= 2) g.lineTo(oben[n], oben[n + 1]);
        g.closePath();
      };
      const tief = unten[Math.floor(unten.length / 4) * 2 + 1];
      const verlauf = g.createLinearGradient(0, tief - 4, 0, tief + 90);
      verlauf.addColorStop(0, farbe(mische(tag.fels, [8, 10, 28], 0.5)));
      verlauf.addColorStop(0.3, farbe(mische(tag.fels, [0, 0, 0], 0.18)));
      verlauf.addColorStop(1, farbe(mische(tag.fels, [255, 255, 255], 0.06)));
      g.fillStyle = verlauf;
      form();
      g.fill();
      // Risse im Fels, fest an ihrem Ort.
      g.save();
      form();
      g.clip();
      g.strokeStyle = farbe(mische(tag.fels, [0, 0, 0], 0.4), 0.45);
      g.lineWidth = 1.3 / s;
      g.beginPath();
      for (let n = 0; n < 10; n += 1) {
        const x = lerp(b.x0, b.x1, hash01(b.x0 * 0.01 + n * 3.7));
        const y = tief + 14 + hash01(b.x0 * 0.02 + n * 5.3) * 70;
        g.moveTo(x - 8, y);
        g.lineTo(x + 6, y + 5 - hash01(n * 9.1) * 10);
      }
      g.stroke();
      g.restore();
      form();
      g.strokeStyle = farbe(mische(tag.fels, [0, 0, 0], 0.6), 0.75);
      g.lineWidth = 2.6 / s;
      g.lineJoin = "round";
      g.stroke();
      g.strokeStyle = farbe(mische(tag.licht, [255, 255, 255], 0.2), 0.5);
      g.lineWidth = 1.6 / s;
      g.beginPath();
      for (let n = 0; n < oben.length; n += 2) (n ? g.lineTo(oben[n], oben[n + 1] - 0.6 / s) : g.moveTo(oben[n], oben[n + 1] - 0.6 / s));
      g.stroke();
    });
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
      const fuss = bildY(roh(x, "boden"));
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
      const fuss = bildY(roh(x, "boden"));
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
    // Die Nähte zwischen den Bahnen und ein Band oben.
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
      g.translate(bildX(START.x + o.a), bildY(START.y + o.b));
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
      return { ...o, sx: bildX(START.x + o.a), sy: bildY(START.y + o.b + 36), weit: `${dx > 0 ? "+" : ""}${Math.round(dx / METER)} m` };
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
      } else if (t.art === "funke") {
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
      const x = clamp(bildX(s.x), 60, view.cssW - 60);
      const y = clamp(bildY(s.y) - steig, view.frei + 20, view.cssH - 20);
      g.strokeText(s.text, x, y);
      g.fillStyle = s.farbe;
      g.fillText(s.text, x, y);
    });
    g.globalAlpha = 1;
  }

  // Die Meter oben links – die eigentliche Zahl der Runde.
  function zeichneAnzeige() {
    bildTransform();
    // Auf dem Handy liegt der obere Rand unter den Knöpfen: dann darunter.
    g.translate(0, shell?.frei?.(canvas) || 0);
    const gross = clamp(view.cssH * 0.055, 14, 24);
    g.font = `900 ${Math.round(gross)}px system-ui, sans-serif`;
    g.textAlign = "left";
    g.textBaseline = "middle";
    const text = `${state.meter} m`;
    const w = g.measureText(text).width + gross * 1.1;
    const x = 12;
    const y = 12;
    g.fillStyle = "rgba(20, 22, 50, 0.55)";
    g.beginPath();
    if (g.roundRect) g.roundRect(x, y, w, gross * 1.6, gross * 0.8);
    else g.rect(x, y, w, gross * 1.6);
    g.fill();
    g.fillStyle = "#ffffff";
    g.fillText(text, x + gross * 0.55, y + gross * 0.82);
  }

  function zeichnen() {
    if (!g) return;
    tageszeit(meterBei(state.f.x));
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, canvas.width, canvas.height);
    neuGemalt = 0;
    zeichneHintergrund();
    zeichneWind();
    zeichnePfeiler();
    zeichneWolken();
    zeichneGebirge();
    zeichneBoegen();
    zeichneDecke();
    zeichneMarken();
    zeichneFahnen();
    zeichneFront();
    zeichneGeister();
    zeichneTeile();
    zeichneBallon();
    zeichneBlitze();
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
    if (state.teile.length < 180) state.teile.push(t);
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

  function schrift(text, x, y, farbeText, gross) {
    state.schriften.push({ text, x, y, farbe: farbeText, gross, leben: 1.15, max: 1.15 });
  }

  // ---------------------------------------------------------------------------
  // Der Lauf
  // ---------------------------------------------------------------------------
  function physik(dt) {
    const f = state.f;
    state.hitze = clamp(state.hitze + (gedrueckt ? HEIZ : -KUEHL) * dt, 0, 1);
    const wind = windBei(f.x, f.y);
    const ax = (wind - f.vx) * MITNAHME;
    f.vx += ax * dt;
    f.vy += ((state.hitze - 0.5) * 2 * AUF - DAEMPF * f.vy) * dt;
    f.x += f.vx * dt;
    f.y += f.vy * dt;
    pendeln(ax, dt);
    // Die Front zieht nach – nie weiter zurück als FRONT_MAX.
    state.front.x = Math.max(state.front.x + tempoBei(f.x) * FRONT_F * dt, f.x - FRONT_MAX);
    state.hoechst = Math.max(state.hoechst, f.y);
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
    zerreissen(f.x, f.y - 12);
    if (grund === "berg" || grund === "fels") staub(px, py);
    else blitzSchlagen(px + (Math.random() - 0.5) * 30, grund === "front" ? DECKE : Math.min(DECKE, py + 140), px, py, 1.4);
    state.schriften = [];
    schrift(GRUENDE[grund]?.bild || "", f.x + 20, f.y + 40, "#ffd6a0", 22);
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
    const boden = roh(f.x, "boden") + KORB.unten - 1;
    if (f.y < boden) {
      f.y = boden;
      if (f.vy < -60) staub(f.x, boden - KORB.unten);
      f.vy = 0;
      f.vx *= 0.5;
    }
    state.neig += (state.rissSeite * 0.5 - state.neig) * dt * 2;
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
      const n = Math.max(1, Math.ceil(dt / TAKT));
      for (let i = 0; i < n && state.schritt === "fahrt"; i += 1) physik(dt / n);
      state.flamme = brannte ? Math.min(1, state.flamme + dt * 14) : Math.max(0, state.flamme - dt * 10);
      if (brannte && Math.random() < dt * 8) funken(f.x, f.y - 6);

      if (state.schritt === "fahrt") {
        // Knapp vorbei: eine Schrift, kurz Zeitlupe.
        if (pruef.knapp < 5 && state.zeit - state.knappZeit > 1.3) {
          state.knappZeit = state.zeit;
          state.zeitlupe = 1;
          schrift("knapp!", f.x + 10, f.y + 44, "#fff1a8", 17);
          kids()?.vibrate?.(12);
        }
        const meter = Math.floor(meterBei(f.x));
        if (meter !== state.meter) {
          if (Math.floor(meter / 100) > Math.floor(state.meter / 100)) {
            schrift(`${Math.floor(meter / 100) * 100} m`, f.x + 40, f.y + 30, "#ffffff", 16);
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
      f.vx = windBei(f.x, f.y);
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

    if (state.schritt === "crash") state.camX += (camXZiel() - state.camX) * Math.min(1, dt * 2);
    else state.camX = camXZiel();
    weltBis(state.camX + view.w + 420);

    if (state.phase === "spiel") {
      gegner?.takt(state.punkte, { a: Math.round(f.x - START.x), b: Math.round(f.y - START.y), c: zustand() });
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
      schrift(ziel.art === "eigen" ? "Bestmarke!" : "Platz 1!", state.f.x + 30, state.f.y + 52, ziel.farbe, 19);
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
  // der Brenner brannte. Am Ende reisst die Hülle wie damals.
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
    const vorher = f.vx;
    f.x = START.x + s.a;
    f.y = START.y + s.b;
    f.vx = s.va || f.vx;
    f.vy = s.vb || 0;
    const c = s.c || 0;
    const brennt = c >= 100;
    state.hitze = clamp((c % 100) / 99, 0, 1);
    state.flamme = brennt ? Math.min(1, state.flamme + dt * 14) : Math.max(0, state.flamme - dt * 10);
    if (brennt && Math.random() < dt * 8) funken(f.x, f.y - 6);
    pendeln(dt > 0 ? (f.vx - vorher) / dt * 0.3 : 0, dt);
    state.front.x = Math.max(state.front.x + tempoBei(f.x) * FRONT_F * dt, f.x - FRONT_MAX);
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
      zerreissen(f.x, f.y - 12);
    }
    zuschauer.weiter();
  }

  // Die Runde beginnt: mit dem ersten Druck – oder im Live-Modus zum
  // gemeinsamen Start (game-shell.js, live.los).
  function losGehts() {
    if (state.phase !== "bereit") return;
    state.phase = "spiel";
    state.schritt = "fahrt";
    state.f.vy = 0;
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
    losGehts();
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
    state.hoechst = 0;
    state.f = { x: START.x, y: START.y, vx: windBei(START.x, START.y), vy: 0 };
    state.hitze = 0.5;
    state.flamme = 0;
    state.neig = 0;
    state.neigV = 0;
    state.front = { x: START.x - FRONT_START };
    state.welt = neueWelt();
    kacheln.clear();
    state.grund = "";
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
    state.zeit = 0;
    state.geschlagen = new Set();
    gedrueckt = false;
    shell.setCount(0);
    gegner?.runde();

    shell.clear();
    const prompt = shell.el("p", "cm-prompt bl-prompt", "Halten heizt – der Ballon steigt. Loslassen – er sinkt.");
    shell.play.append(prompt, buildPlatz());
    view.cssW = 0;
    view.cssH = 0;
    messen();
    state.camX = camXZiel();
    weltBis(state.camX + view.w + 420);

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
    title: "Ballonfahrt",
    area: "problemloesen",
    accent: "#3FA34D",
    accentDark: "#2c7337",
    clock: false,
    onRestart: () => (zuschauer ? zuschauenStarten() : startRun()),
    live: { los: losGehts, stopp: () => finish(), zuschauen: (quelle) => { zuschauer = quelle; zuschauenStarten(); } },
  });
  zuschauer = window.LernappGeist?.zuschauer?.({
    host, spiel: "balloonRide", fassung: "t1", zufall, einheit: "m", nochmal: zuschauenStarten,
  }) || null;
  if (!zuschauer) {
    gegner = window.LernappGeist?.fuer?.({ spiel: "balloonRide", host, art: "tempo", alle: true, zufall }) || null;
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

  // Für die Prüfskripte.
  window.LernappBallon = {
    BAND, DECKE, METER, SEG, TAL, VT, AUF, DAEMPF, HEIZ, KUEHL, MITTE_MIN, FRONT_F, LUECKE_MIN,
    state, view, takt, druecken, loslassen, zeichnen,
    weltBis, mitteBei, weiteBei, bodenBei, tempoBei, windBei, bogenBei, pruefen,
  };
})();
