/*
 * gratwanderung.js – Gratwanderung.
 * ---------------------------------------------------------------------------
 * Ein Steinbock rennt über einen schmalen Grat hoch über dem Nebelmeer. Der
 * Grat läuft im Zickzack, und der Steinbock rennt immer schräg: nach links
 * vorn oder nach rechts vorn. Eine Regel: Ein Tipp wechselt die Richtung.
 * Wer die Kehre verpasst, rennt geradeaus über die Kante und stürzt – die
 * Runde ist vorbei.
 *
 * Die Kunst liegt im Wann. Wer genau dort wendet, wo die alte Spur in die
 * neue übergeht, läuft danach mitten auf dem Grat: «perfekt». Wer zu früh
 * oder zu spät wendet, läuft näher an einer Kante weiter – und hat an der
 * nächsten Kehre weniger Luft. Jede Kehre gibt einen Punkt, eine perfekte
 * zwei, jede weitere perfekte in Folge drei. Auf der Tafel steht, woraus die
 * Zahl besteht: Kehren, davon perfekt, und die Meter.
 *
 * Schwerer wird es von selbst: Mit der Strecke rennt der Steinbock schneller,
 * der Grat wird schmaler, und die Kehren folgen dichter – einzeln, als lange
 * Traverse oder als Treppe aus kurzen Stücken im Takt. Das Tempo hängt an der
 * Strecke, nicht an der Uhr: Wer gleich weit kommt, war gleich schnell.
 *
 * Jedes achte Stück (das 8., 16., 24. …) ist anders: breiter, und an seinem
 * linken oder rechten Rand steht ein Felsturm, über die Mitte hinaus. Vorbei
 * kommt nur, wer schon die Kehre davor früh oder spät nimmt und so in der
 * Gasse neben dem Fels läuft – dort ist dann auch «perfekt». Am Anfang ist
 * dieses Stück breit, später wird es schmaler. Wer in den Fels rennt, bleibt
 * im Schnee liegen: Die Runde ist vorbei.
 *
 * Gesteckt wird der Grat aus dem Zufall (zufall.js): ohne Turnier jedes Mal
 * ein anderer, im Turnier für alle im selben Versuch derselbe.
 *
 * Ein Tipp gilt in dem Augenblick, in dem er geschah, nicht erst im nächsten
 * Bild: Vor dem Wenden wird die Strecke bis zur Zeit des Tipps nachgerechnet
 * (tippen, voraus). Das Fenster für eine Kehre ist hinten keine Zehntelsekunde
 * mehr – ein Bild mehr oder weniger wäre ein Fünftel davon.
 *
 * Das Bild: Man schaut von hinten oben auf den Grat, wie er sich in die
 * Ferne schlängelt – eine Bergflanke aus Flächen, links im Licht, rechts im
 * Schatten, darunter das Nebelmeer, am Horizont ferne Ketten. Gerechnet wird
 * in drei Richtungen (x quer, y hoch, z voraus) und mit einer Kamera
 * projiziert (proj); gemalt wird von hinten nach vorn, Scheibe um Scheibe,
 * dazwischen die Reihen des Nebelmeers. Unterwegs wandert der Tag: Morgenrot,
 * heller Tag, Abendrot, Nacht mit Mond und Polarlicht – und wieder Morgen.
 * Vor dem ersten Tipp steht die Kamera tief hinter dem Steinbock, der Himmel
 * füllt das halbe Bild; mit dem Start steigt sie auf.
 *
 * Die Gegner (geist.js) rennen als Steinbock aus Licht mit, und die besten
 * Läufe lassen sich anschauen (?zuschauen=): über ihren eigenen Grat,
 * gesteckt mit derselben Saat.
 *
 * Zehn Einheiten sind ein Meter. Der Grat ist eine Linie x(z) mit Steigung
 * +1 oder −1; begehbar ist, was waagrecht höchstens randBei(z) daneben liegt
 * – so breit, wie der Grat dort gemalt ist.
 */
(() => {
  "use strict";

  if (document.body.dataset.page !== "ridge") return;

  const host = document.querySelector("#gw-stage");
  const shellApi = window.LernappGameShell;
  const cloudApi = window.LernappGameCloud;
  if (!host || !shellApi) return;

  const kids = () => window.LernappKids || null;
  const klang = () => window.ArcadeKlang || null;
  const ruhig = () => Boolean(kids()?.prefersReducedMotion?.());

  // Der Zufall. Nur der Grat zieht daraus – wie lang jedes Stück ist. Schnee,
  // Funken, Felsen und Wolken würfeln Math.random oder hängen an festen
  // Zahlen, damit der Grat nicht davon abhängt, wie jemand läuft.
  const zufall = window.LernappZufall?.fuer?.("ridgeRun") || {
    neu() {},
    zahl: () => Math.random(),
  };

  // ---------------------------------------------------------------------------
  // Die Regeln
  // ---------------------------------------------------------------------------
  const METER = 10;
  const VORLAUF = 460;             // so viel Grat liegt hinter dem Start
  const ERSTE = 260;               // so weit ist es bis zur ersten Kehre
  // Tempo (voraus, in Einheiten je Sekunde) und halbe Breite (waagrecht),
  // beide nach der Strecke. Das Fenster für eine Kehre ist halb / (2 · tempo)
  // vor und nach dem besten Moment: am Start 170 ms, nach 200 Metern 105,
  // nach 400 Metern 80, nach einem Kilometer knapp 60.
  //
  // Ausgespielt mit einem nachgebildeten Spieler, dessen Tipp um den besten
  // Moment streut (und der am Fels auf die Mitte der Gasse zielt): Wer 130 ms
  // daneben liegt, nimmt im Mittel zwei Kehren, wer 90 daneben liegt fünf,
  // wer 60 daneben liegt vierzehn (18 Sekunden), wer 40 daneben liegt gut
  // fünfundzwanzig – und wer auf 25 ms genau tippt, gut sechzig.
  const V0 = 140;
  const V_MAX = 256;
  const V_WEG = 400;               // Meter, nach denen gut sechs Zehntel des Zuwachses da sind
  const HALB0 = 48;
  const HALB_MIN = 27.5;
  const HALB_WEG = 360;
  const SCHWER_WEG = 380;          // so schnell werden die Stücke kürzer und die Treppen häufiger
  const GNADE = 1.5;               // so weit darf ein Huf über die Kante
  // Der Fels: Jedes achte Stück (das 8., 16., 24. …) ist breiter, und an
  // seinem linken oder rechten Rand steht ein Felsturm – über die Mitte
  // hinaus. Vorbei kommt nur, wer schon die Kehre davor früh oder spät
  // nimmt und so in der Gasse daneben läuft. Wie breit das Stück ist (mal
  // die halbe Breite) und wie breit die Gasse (mal die ganze Breite eines
  // gewöhnlichen Stücks): am Start und in der Ferne.
  const FELS_JE = 8;
  const FELS_BREIT0 = 2.2;
  const FELS_BREIT1 = 1.7;
  const FELS_GASSE0 = 1;
  const FELS_GASSE1 = 0.75;
  // «Perfekt»: nach der Kehre höchstens so weit neben der Mitte (Anteil der
  // halben Breite, mindestens PERFEKT_MIN Einheiten).
  const PERFEKT = 0.22;
  const PERFEKT_MIN = 8;
  const TAKT = 1 / 240;            // gerechnet wird in festen kleinen Schritten
  const STURZ_MS = 1250;

  // ---------------------------------------------------------------------------
  // Das Bild
  // ---------------------------------------------------------------------------
  const NB = 4;                    // Bänder je Flanke
  // Die Flanke im Querschnitt: so weit neben der Kante, so tief darunter.
  const PROFIL_D = [0, 18, 68, 162, 310];
  const PROFIL_H = [0, -36, -134, -270, -440];
  const KRONE = 3;                 // die Mitte des Grats liegt eine Spur höher
  const WOLKE = 400;               // so tief unter dem Grat liegt das Nebelmeer
  const STUECK = 92;               // höchstens so lang ist eine Scheibe des Grats
  const SICHT = 2700;              // so weit voraus wird der Grat gemalt
  const REIHE = 150;               // Abstand der Reihen des Nebelmeers
  const BAUSCH = 190;              // Abstand der Bäusche in einer Reihe
  const TAG_WEG = 380;             // Meter je Tageszeit
  const GROB_AB = 1250;            // ab dieser Tiefe wird der Berg grob gemalt

  const TOP_COUNT = 5;
  const store = cloudApi
    ? cloudApi.register({ key: "lernapp.gratwanderung", empty: { runs: 0, scores: [] }, merge: cloudApi.mergeScores(TOP_COUNT) })
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
  const meterBei = (z) => Math.max(0, z / METER);
  const tempoBei = (z) => V0 + (V_MAX - V0) * (1 - Math.exp(-meterBei(z) / V_WEG));
  const halbBei = (z) => HALB_MIN + (HALB0 - HALB_MIN) * Math.exp(-meterBei(z) / HALB_WEG);
  const schwereBei = (z) => 1 - Math.exp(-meterBei(z) / SCHWER_WEG);
  const perfektBei = (z) => Math.max(PERFEKT_MIN, halbBei(z) * PERFEKT);

  // Immer dieselbe Zahl zu derselben Eingabe: Felsen und Wolken stehen bei
  // jedem Bild am selben Platz, ohne den Zufall des Grats anzufassen.
  function hash01(n) {
    const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return x - Math.floor(x);
  }

  const norm3 = (x, y, z) => { const l = Math.hypot(x, y, z) || 1; return [x / l, y / l, z / l]; };
  // Woher das Licht kommt: morgens von links, abends von rechts, am Tag von
  // oben. Jede Fläche merkt sich, wie hell sie in jedem der drei steht.
  const LICHT_L = norm3(-0.82, 0.45, 0.34);
  const LICHT_R = norm3(0.82, 0.45, 0.34);
  const LICHT_O = norm3(-0.2, 0.95, 0.24);

  // ---------------------------------------------------------------------------
  // Die Tageszeiten
  // ---------------------------------------------------------------------------
  // Farben als [rot, grün, blau]. Dazwischen wird gemischt (mische).
  const ZEITEN = [
    { // Morgenrot
      himmel: [[22, 24, 72], [96, 56, 150], [232, 102, 124], [255, 198, 130]],
      sonne: { x: 0.29, hoch: 0.055, kraft: 1, farbe: [255, 246, 214], schein: [255, 168, 92] },
      mond: { x: 0.76, hoch: 0.5, kraft: 0 },
      fern: [[196, 154, 198], [150, 114, 182], [100, 82, 158]],
      fernLicht: [[255, 200, 172], [246, 152, 152], [228, 122, 134]],
      dunst: [255, 190, 150],
      wolkeFern: [255, 214, 170], wolkeNah: [108, 100, 188], wolkeRand: [255, 242, 216],
      felsLicht: [242, 136, 96], felsSchatten: [44, 40, 98],
      schneeLicht: [255, 238, 214], schneeSchatten: [124, 122, 206],
      pfadLicht: [255, 247, 234], pfadSchatten: [206, 190, 232], kante: [64, 54, 124],
      licht: [1, 0, 0.12], sterne: 0.55, polar: 0,
    },
    { // Tag
      himmel: [[26, 92, 194], [66, 148, 232], [150, 206, 250], [228, 245, 255]],
      sonne: { x: 0.4, hoch: 0.7, kraft: 0.75, farbe: [255, 255, 240], schein: [255, 250, 222] },
      mond: { x: 0.76, hoch: 0.5, kraft: 0 },
      fern: [[178, 208, 240], [136, 174, 218], [98, 136, 188]],
      fernLicht: [[240, 248, 255], [214, 232, 250], [184, 208, 238]],
      dunst: [224, 241, 255],
      wolkeFern: [247, 251, 255], wolkeNah: [146, 178, 226], wolkeRand: [255, 255, 255],
      felsLicht: [198, 178, 152], felsSchatten: [72, 86, 124],
      schneeLicht: [255, 255, 255], schneeSchatten: [166, 194, 236],
      pfadLicht: [255, 255, 255], pfadSchatten: [204, 222, 246], kante: [92, 112, 158],
      licht: [0.42, 0.06, 0.62], sterne: 0, polar: 0,
    },
    { // Abendrot
      himmel: [[38, 26, 94], [150, 54, 130], [250, 114, 84], [255, 210, 122]],
      sonne: { x: 0.71, hoch: 0.055, kraft: 1, farbe: [255, 236, 190], schein: [255, 138, 70] },
      mond: { x: 0.3, hoch: 0.3, kraft: 0 },
      fern: [[216, 142, 162], [170, 96, 150], [112, 66, 132]],
      fernLicht: [[255, 192, 142], [255, 150, 110], [242, 116, 100]],
      dunst: [255, 172, 122],
      wolkeFern: [255, 198, 142], wolkeNah: [118, 82, 160], wolkeRand: [255, 228, 182],
      felsLicht: [250, 128, 76], felsSchatten: [50, 34, 90],
      schneeLicht: [255, 226, 190], schneeSchatten: [140, 108, 190],
      pfadLicht: [255, 241, 218], pfadSchatten: [222, 186, 214], kante: [80, 50, 112],
      licht: [0, 1, 0.12], sterne: 0.35, polar: 0,
    },
    { // Nacht
      himmel: [[3, 6, 26], [8, 20, 62], [20, 42, 102], [50, 78, 150]],
      sonne: { x: 0.85, hoch: -0.2, kraft: 0, farbe: [255, 236, 190], schein: [255, 138, 70] },
      mond: { x: 0.3, hoch: 0.2, kraft: 1 },
      fern: [[40, 60, 122], [28, 44, 100], [18, 30, 78]],
      fernLicht: [[98, 124, 192], [78, 102, 172], [60, 82, 150]],
      dunst: [62, 92, 164],
      wolkeFern: [88, 114, 190], wolkeNah: [20, 28, 76], wolkeRand: [172, 198, 255],
      felsLicht: [88, 106, 178], felsSchatten: [12, 16, 50],
      schneeLicht: [202, 218, 255], schneeSchatten: [54, 68, 140],
      pfadLicht: [228, 238, 255], pfadSchatten: [148, 168, 230], kante: [28, 38, 94],
      licht: [0.78, 0, 0.24], sterne: 1, polar: 1,
    },
  ];

  function mische(a, b, k) {
    if (typeof a === "number") return a + (b - a) * k;
    if (Array.isArray(a)) return a.map((wert, i) => mische(wert, b[i], k));
    const raus = {};
    for (const schluessel of Object.keys(a)) raus[schluessel] = mische(a[schluessel], b[schluessel], k);
    return raus;
  }
  const mix3 = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
  const rgb = (c) => `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`;
  const rgba = (c, alpha) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${alpha})`;

  // Die Farben an dieser Stelle der Strecke: Jede Tageszeit steht die erste
  // Hälfte ihres Abschnitts still und geht in der zweiten in die nächste über.
  function farbenBei(z) {
    const u = (meterBei(z) / TAG_WEG) % ZEITEN.length;
    const i = Math.floor(u);
    const k = glatt((u - i - 0.5) / 0.5);
    if (k <= 0) return ZEITEN[i];
    return mische(ZEITEN[i], ZEITEN[(i + 1) % ZEITEN.length], k);
  }

  // ---------------------------------------------------------------------------
  // Zustand
  // ---------------------------------------------------------------------------
  // phase:   "bereit" (noch nichts getippt), "spiel", "zuschauen", "ende"
  // schritt: "start", "lauf", "sturz"
  const state = {
    phase: "bereit",
    schritt: "start",
    punkte: 0,
    genommen: 0,          // Kehren, die genommen sind
    perfekte: 0,
    reihe: 0,             // perfekte Kehren in Folge
    meter: 0,
    spitze: 0,
    // Der Steinbock: wo er ist, wohin er rennt (r: −1 links, 1 rechts) und
    // wie hoch über dem Grat (beim Sturz darunter).
    bock: { x: 0, y: 0, z: 0, r: 1 },
    seg: 0,               // auf welchem Stück des Grats er ist
    stat: 0,              // und zwischen welchen Stationen (randBei)
    naechste: 1,          // die Kehre, die als nächste zu nehmen ist
    kehren: [],
    stationen: [],
    scheiben: [],
    figur: { rest: 0, T: 0 },
    sturz: null,
    spur: [],
    spurWeg: 0,
    teile: [],
    ringe: [],
    schriften: [],
    zeit: 0,
    blick: 0,             // 0 die Kamera vor dem Start, 1 die im Spiel
    stoss: 0,
    galopp: 0,
    dreh: 1,              // wohin die Figur schaut (−1 bis 1), gleitend
    sprung: 0,            // der kleine Satz bei einer Kehre, klingt ab
    ersteScheibe: 0,      // die hinterste Scheibe, die noch im Bild ist
    kreuzBei: 0,          // an welcher Station das Gipfelkreuz steht
    blickFest: null,      // nur für die Vorführung: die Kamera festhalten
    P: ZEITEN[0],
  };

  let shell = null;
  let feld = null;
  let canvas = null;
  let g = null;
  let frame = null;
  let last = 0;
  // Wie viel Strecke seit dem letzten Bild schon gerechnet ist (tippen).
  let voraus = 0;
  let bildNr = 0;
  let stepTimer = null;
  let gegner = null;
  let zuschauer = null;
  let wind = null;
  let hufe = null;

  const view = { dpr: 1, cssW: 0, cssH: 0, frei: 0 };
  // Die Kamera: wo sie steht, wie sie neigt (cos, sin), Brennweite, Bildmitte
  // und wo im Bild der Horizont liegt.
  const cam = { x: 0, y: 300, z: -300, cos: 1, sin: 0, F: 400, cx: 0, cy: 0, hy: 0, mass: 1 };

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
    wind = klang()?.kulisse("gratwanderung.wind") || null;
    hufe = klang()?.kulisse("gratwanderung.hufe") || null;
    klangStellen();
  }

  function klangStellen() {
    const k = clamp((tempoBei(state.bock.z) - V0) / (V_MAX - V0), 0, 1);
    wind?.setze(0.25 + 0.6 * k);
    wind?.laut(0.55 + 0.35 * k);
    hufe?.setze(0.45 + 0.55 * k);
  }

  function klangAus() {
    wind?.stop();
    hufe?.stop();
    wind = null;
    hufe = null;
  }

  // ---------------------------------------------------------------------------
  // Der Grat
  // ---------------------------------------------------------------------------
  /*
   * Kehren sind Punkte (z, x); von jeder läuft ein Stück der Länge L (in z)
   * mit der Steigung s zur nächsten. Wie lang ein Stück ist, folgt aus dem
   * Tempo dort – gewürfelt wird die Zeit bis zur nächsten Kehre, nicht die
   * Strecke: Wer schneller rennt, bekommt längere Stücke und dieselbe Zeit.
   *
   *   einzeln    eine Zeit aus einer Spanne, die nach hinten kürzer wird
   *   Treppe     drei bis sechs kurze Stücke gleicher Länge – ein Takt
   *   Traverse   ein langes Stück zum Luftholen
   *
   * Kürzer als das Zweieinhalbfache der halben Breite wird keines: Sonst
   * griffen zwei Kehren ineinander.
   *
   * Jedes achte Stück trägt einen Felsturm (felsFuer). Es ist lang – der
   * Fels steht in seiner Mitte, weit genug von beiden Kehren –, und das
   * Stück davor und das danach sind ruhige, einzelne Stücke: keine Treppe
   * führt in den Fels hinein oder aus ihm heraus.
   */
  // Das wievielte Stück an der Kehre nr beginnt: das Startstück ist das erste.
  const stueckNr = (nr) => nr + 1;
  const mitFels = (nr) => stueckNr(nr) % FELS_JE === 0;

  function laengeFuer(z, nr) {
    const k = schwereBei(z);
    const v = tempoBei(z);
    const kurz = Math.max(lerp(0.68, 0.36, k), (2.5 * halbBei(z)) / v);
    const f = state.figur;
    if (mitFels(nr)) {
      f.rest = 0;
      return lerp(1.9, 2.3, zufall.zahl()) * lerp(1, 0.88, k) * v;
    }
    if (nr > 1 && (mitFels(nr + 1) || mitFels(nr - 1))) {
      f.rest = 0;
      return Math.max(kurz * 1.4, lerp(1.05, 1.4, zufall.zahl()) * lerp(1, 0.8, k)) * v;
    }
    if (f.rest > 0) {
      f.rest -= 1;
      return f.T * v;
    }
    const w = zufall.zahl();
    const wie = zufall.zahl();
    if (z > 400 && w < lerp(0.1, 0.3, k)) {
      f.rest = 2 + Math.floor(wie * lerp(2, 4, k));
      f.T = kurz * lerp(1, 1.22, zufall.zahl());
      return f.T * v;
    }
    if (w > 0.9) return lerp(1.5, 2.1, wie) * lerp(1, 0.78, k) * v;
    const lo = Math.max(kurz * 1.25, lerp(0.92, 0.55, k));
    const hi = lerp(1.6, 1.08, k);
    return lerp(lo, hi, wie) * v;
  }

  function neueEcke(a, b, c, band, zuf) {
    let nx = (b.y - a.y) * (c.z - a.z) - (b.z - a.z) * (c.y - a.y);
    let ny = (b.z - a.z) * (c.x - a.x) - (b.x - a.x) * (c.z - a.z);
    let nz = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
    const l = Math.hypot(nx, ny, nz) || 1;
    nx /= l; ny /= l; nz /= l;
    if (ny < 0) { nx = -nx; ny = -ny; nz = -nz; }
    const hell = (L) => Math.max(0, nx * L[0] + ny * L[1] + nz * L[2]);
    return {
      a, b, c, nx, ny, nz,
      mx: (a.x + b.x + c.x) / 3, my: (a.y + b.y + c.y) / 3, mz: (a.z + b.z + c.z) / 3,
      ll: hell(LICHT_L), lr: hell(LICHT_R), lo: hell(LICHT_O),
      // Oben liegt Schnee, darunter nur, wo es flach genug ist.
      schnee: band === 1 || (band === 2 && ny > 0.4 && zuf < 0.55),
      v: zuf * 2 - 1,
    };
  }

  // Eine Scheibe des Bergs zwischen zwei Stationen: die Flächen beider
  // Flanken, von aussen nach innen (so werden sie gemalt).
  function neueScheibe(nah, fern) {
    const flaechen = [];
    for (const seite of ["L", "R"]) {
      for (let j = NB; j >= 1; j -= 1) {
        const p = nah[seite][j - 1];
        const q = nah[seite][j];
        const r = fern[seite][j];
        const s = fern[seite][j - 1];
        const z1 = hash01(nah.i * 5.77 + j * 2.31 + (seite === "L" ? 0.4 : 9.1));
        const z2 = hash01(nah.i * 8.13 + j * 6.07 + (seite === "L" ? 3.3 : 1.7));
        if ((nah.i + j) % 2) flaechen.push(neueEcke(p, q, r, j, z1), neueEcke(p, r, s, j, z2));
        else flaechen.push(neueEcke(p, q, s, j, z1), neueEcke(q, r, s, j, z2));
      }
    }
    // Für die Ferne: je Flanke eine einzige Fläche vom Grat bis in den
    // Nebel, so hell wie ihre Flächen im Mittel (zeichneScheibe, GROB_AB).
    const grob = ["L", "R"].map((seite, nr) => {
      const teil = flaechen.slice(nr * NB * 2, (nr + 1) * NB * 2);
      const mittel = (wert) => teil.reduce((summe, f) => summe + wert(f), 0) / teil.length;
      return {
        ecken: [nah[seite][0], nah[seite][NB - 1], fern[seite][NB - 1], fern[seite][0]],
        nx: mittel((f) => f.nx), ny: mittel((f) => f.ny), nz: mittel((f) => f.nz),
        mx: mittel((f) => f.mx), my: mittel((f) => f.my), mz: mittel((f) => f.mz),
        ll: mittel((f) => f.ll), lr: mittel((f) => f.lr), lo: mittel((f) => f.lo),
      };
    });
    return { nah, fern, flaechen, grob, v: hash01(nah.i * 3.71) * 2 - 1 };
  }

  // seg: zu welchem Stück die Station gehört. hw: die halbe Breite dort.
  // fx: wo die alte Fährte verläuft (in der Mitte, am Fels in der Gasse).
  function neueStation(z, x, kehre, seg, hw, fx) {
    const liste = state.stationen;
    const i = liste.length;
    const st = { i, z, x, hw, fx, seg, kehre, L: [], R: [], M: { x, y: KRONE, z, sx: 0, sy: 0, cz: 0 }, bild: -1 };
    for (const seite of [-1, 1]) {
      const ring = seite < 0 ? st.L : st.R;
      for (let j = 0; j <= NB; j += 1) {
        const h1 = hash01(i * 12.9898 + j * 78.233 + seite * 37.719);
        const h2 = hash01(i * 39.3468 + j * 11.135 + seite * 83.155);
        const h3 = hash01(i * 73.156 + j * 52.235 + seite * 9.151);
        ring.push({
          x: x + seite * (hw + PROFIL_D[j] * (j ? 0.76 + 0.52 * h1 : 1)),
          y: PROFIL_H[j] * (j ? 0.8 + 0.4 * h2 : 1),
          z: z + (j ? (h3 - 0.5) * 36 * Math.min(1, j / 2) : 0),
          sx: 0, sy: 0, cz: 0,
        });
      }
    }
    liste.push(st);
    if (i > 0) state.scheiben.push(neueScheibe(liste[i - 1], st));
    return st;
  }

  /*
   * Der Fels auf einem Stück. Das Stück wird breiter (hw), und an einem
   * Rand – seite, −1 links, 1 rechts – steht der Turm: von dort bis rand
   * (waagrecht neben der Mitte, zur Seite des Felsens hin gezählt; negativ
   * heisst: über die Mitte hinaus). Frei bleibt die Gasse am anderen Rand;
   * ziel ist ihre Mitte. In der Länge steht er von z0 bis z1.
   */
  function felsFuer(k) {
    const h = halbBei(k.z);
    const s = schwereBei(k.z);
    const breit = h * lerp(FELS_BREIT0, FELS_BREIT1, s);
    const gasse = 2 * h * lerp(FELS_GASSE0, FELS_GASSE1, s);
    const seite = zufall.zahl() < 0.5 ? -1 : 1;
    const lang = clamp(0.3 * tempoBei(k.z), 46, 84);
    const mitte = k.z + k.L * lerp(0.46, 0.54, zufall.zahl());
    k.hw = breit;
    k.ziel = -seite * (breit - gasse / 2);
    k.fels = { seite, z0: mitte - lang / 2, z1: mitte + lang / 2, rand: gasse - breit, breit, saat: zufall.zahl(), teile: null };
  }

  function naechsteKehre() {
    const k = state.kehren;
    const a = k[k.length - 1];
    const davor = k.length > 1 ? k[k.length - 2] : null;
    const neu = { z: a.z + a.L, x: a.x + a.s * a.L, s: -a.s, L: 0, nr: k.length, hw: 0, ziel: 0, fels: null };
    neu.hw = halbBei(neu.z);
    neu.L = laengeFuer(neu.z, neu.nr);
    if (mitFels(neu.nr)) felsFuer(neu);
    // Das Stück von a bis hierher bekommt seine Stationen. Ein Stück mit Fels
    // ist breit von seiner Kehre bis zur nächsten, beide eingeschlossen:
    // Das Stück davor weitet sich auf seinem letzten Teil, das danach
    // verengt sich auf seinem ersten.
    const n = Math.max(1, Math.round(a.L / STUECK));
    for (let m = 0; m < n; m += 1) {
      const u = m / n;
      const z = a.z + a.L * u;
      const x = a.x + a.s * a.L * u;
      const hw = a.fels ? a.hw : m === 0 && davor && davor.fels ? davor.hw : halbBei(z);
      neueStation(z, x, m === 0 ? a.nr : -1, a.nr, hw, a.fels ? x + a.ziel : x);
    }
    k.push(neu);
  }

  // Die halbe Breite des Grats an dieser Stelle – so, wie er gemalt ist:
  // von Station zu Station gerade.
  function randBei(z) {
    kehrenBis(z + 400);
    const st = state.stationen;
    let i = clamp(state.stat, 0, st.length - 2);
    while (i > 0 && z < st[i].z) i -= 1;
    while (i < st.length - 2 && z >= st[i + 1].z) i += 1;
    state.stat = i;
    const a = st[i];
    const b = st[i + 1];
    return a.hw + (b.hw - a.hw) * clamp((z - a.z) / (b.z - a.z || 1), 0, 1);
  }

  // Steht hier der Fels? (daneben: waagrecht neben der Mitte des Stücks k.)
  function imFels(k, z, daneben, luft = GNADE) {
    const f = k.fels;
    return Boolean(f) && z >= f.z0 && z <= f.z1 && daneben * f.seite > f.rand + luft;
  }

  function kehrenBis(z) {
    const k = state.kehren;
    while (k[k.length - 1].z < z) naechsteKehre();
  }

  function segBei(z, hinweis = state.seg) {
    const k = state.kehren;
    let i = clamp(hinweis, 0, k.length - 2);
    while (i > 0 && z < k[i].z) i -= 1;
    while (i < k.length - 2 && z >= k[i + 1].z) i += 1;
    return i;
  }

  // Wo die Mitte des Grats an dieser Stelle liegt.
  function mitteBei(z, hinweis) {
    kehrenBis(z + 1);
    const a = state.kehren[segBei(z, hinweis)];
    return a.x + a.s * (z - a.z);
  }

  function grateNeu() {
    state.kehren = [];
    state.stationen = [];
    state.scheiben = [];
    state.figur = { rest: 0, T: 0 };
    state.stat = 0;
    // Die Seite des ersten Stücks gehört zum Kurs.
    const s0 = zufall.zahl() < 0.5 ? -1 : 1;
    // Das erste Stück läuft durch den Start (0, 0).
    state.kehren.push({ z: -VORLAUF, x: -s0 * VORLAUF, s: s0, L: VORLAUF + ERSTE, nr: 0, hw: HALB0, ziel: 0, fels: null });
    kehrenBis(SICHT);
  }

  // Der Grat als Text – für die Prüfung, dass in einem Turnier alle
  // denselben bekommen.
  function kursText(n = 12) {
    while (state.kehren.length <= n) naechsteKehre();
    return state.kehren.slice(0, n + 1).map((k) => `${Math.round(k.z)}/${Math.round(k.x)}${k.fels ? (k.fels.seite < 0 ? "L" : "R") : ""}`).join(" ");
  }

  // ---------------------------------------------------------------------------
  // Die Fläche
  // ---------------------------------------------------------------------------
  function buildPlatz() {
    const platz = shell.el("div", "gw-platz");
    feld = shell.el("div", "gw-feld");
    canvas = document.createElement("canvas");
    canvas.className = "gw-canvas";
    canvas.setAttribute("aria-hidden", "true");
    feld.append(canvas);
    g = canvas.getContext("2d");

    // Der Hinweis vor dem ersten Tipp: zwei Ringe, die aufgehen – tippen.
    const tipp = shell.el("span", "gw-tipp");
    tipp.setAttribute("aria-hidden", "true");
    const ns = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(ns, "svg");
    svg.setAttribute("viewBox", "0 0 64 64");
    ["gw-tipp-ring", "gw-tipp-ring is-spaet"].forEach((klasse) => {
      const kreis = document.createElementNS(ns, "circle");
      kreis.setAttribute("class", klasse);
      kreis.setAttribute("cx", "32");
      kreis.setAttribute("cy", "32");
      kreis.setAttribute("r", "14");
      kreis.setAttribute("fill", "none");
      kreis.setAttribute("stroke", "#ffffff");
      kreis.setAttribute("stroke-width", "4");
      svg.append(kreis);
    });
    const punkt = document.createElementNS(ns, "circle");
    punkt.setAttribute("cx", "32");
    punkt.setAttribute("cy", "32");
    punkt.setAttribute("r", "8");
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
    const dpr = shellApi.bildpunkte(cssW, cssH, 2);
    // Auf dem Handy reicht die Leinwand unter die Knöpfe oben (game-shell.js,
    // frei). Gemalt wird dort auch – aber der Horizont steht darunter.
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
  }

  // ---------------------------------------------------------------------------
  // Die Kamera
  // ---------------------------------------------------------------------------
  /*
   * Zwei Einstellungen, zwischen denen state.blick gleitet:
   *
   *   vor dem Start   tief und nah hinter dem Steinbock, flach geneigt – der
   *                   Himmel füllt fast das halbe Bild
   *   im Spiel        hoch und steil: Der Grat liegt wie eine Karte da, und
   *                   der Horizont steht oben am Rand (quer sogar darüber –
   *                   sonst bliebe für die Kehren voraus zu wenig Höhe)
   *
   * Gewählt wird nicht die Kamera, sondern das Bild: wie gross der Steinbock
   * ist (mass, Bildpunkte je Einheit), wo er steht und wo der Horizont liegt.
   * Daraus folgen Höhe, Abstand und Bildmitte.
   */
  function kameraStellen() {
    const W = view.cssW;
    const H = view.cssH;
    const quer = clamp((W / H - 0.8) / 0.8, 0, 1);
    const k = glatt(state.blick);
    const massSpiel = clamp(Math.min(W / 330, H / 420), 0.55, 2.6);
    const mass = lerp(massSpiel * lerp(1.3, 1.2, quer), massSpiel, k);
    const winkel = lerp(lerp(0.36, 0.3, quer), lerp(0.6, 0.72, quer), k);
    const oben = view.frei;
    const horizont = lerp(oben * 0.3 + H * 0.4, lerp(oben + (H - oben) * 0.1, -H * 0.22, quer), k);
    const bockY = H * lerp(lerp(0.8, 0.8, quer), lerp(0.74, 0.72, quer), k);
    const F = Math.max(0.62 * W, 0.52 * H);
    cam.cos = Math.cos(winkel);
    cam.sin = Math.sin(winkel);
    cam.F = F;
    cam.mass = mass;
    cam.hy = horizont;
    cam.cx = W / 2;
    cam.cy = horizont + F * (cam.sin / cam.cos);
    // Der Abstand zwischen Horizont und Steinbock im Bild ist mass · Höhe /
    // cos; die Tiefe des Steinbocks vor der Kamera ist F / mass.
    const hoehe = ((bockY - horizont) * cam.cos) / mass;
    const tiefe = F / mass;
    const abstand = (tiefe - hoehe * cam.sin) / cam.cos;
    cam.y = hoehe;
    cam.abstand = abstand;
  }

  function proj(p) {
    const dx = p.x - cam.x;
    const dy = p.y - cam.y;
    const dz = p.z - cam.z;
    const cz = dz * cam.cos - dy * cam.sin;
    p.cz = cz;
    if (cz < 6) return false;
    const k = cam.F / cz;
    p.sx = cam.cx + dx * k;
    p.sy = cam.cy - (dy * cam.cos + dz * cam.sin) * k;
    return true;
  }

  const hilf = { x: 0, y: 0, z: 0, sx: 0, sy: 0, cz: 0 };
  function projXYZ(x, y, z) {
    hilf.x = x; hilf.y = y; hilf.z = z;
    return proj(hilf) ? hilf : null;
  }

  // Wohin die Kamera will: hinter den Steinbock, ein Stück dorthin versetzt,
  // wohin der Grat führt.
  function kameraZiel() {
    const b = state.bock;
    const vorn = mitteBei(b.z + 240);
    return lerp(b.x, vorn, 0.3 * glatt(state.blick));
  }

  // ---------------------------------------------------------------------------
  // Zeichnen: Himmel und Ferne
  // ---------------------------------------------------------------------------
  const STERNE = Array.from({ length: 80 }, (_, i) => ({
    x: hash01(i * 3.1 + 1), y: hash01(i * 5.7 + 2), r: 0.5 + hash01(i * 7.3 + 3) * 1.1, t: hash01(i * 9.9) * 6,
  }));

  function zeichneHimmel(P) {
    const W = view.cssW;
    const hy = cam.hy;
    if (hy < -30) return;
    // Der Himmel ist immer gleich hoch – im Spiel sieht man nur seinen Fuss.
    const S = view.cssH * 0.62;
    const verlauf = g.createLinearGradient(0, hy - S, 0, hy);
    verlauf.addColorStop(0, rgb(P.himmel[0]));
    verlauf.addColorStop(0.46, rgb(P.himmel[1]));
    verlauf.addColorStop(0.8, rgb(P.himmel[2]));
    verlauf.addColorStop(1, rgb(P.himmel[3]));
    g.fillStyle = verlauf;
    g.fillRect(0, Math.min(0, hy - S), W, hy - Math.min(0, hy - S) + 2);
    if (hy - S > 0) {
      g.fillStyle = rgb(P.himmel[0]);
      g.fillRect(0, 0, W, hy - S + 1);
    }

    if (P.sterne > 0.02) {
      g.fillStyle = "#ffffff";
      STERNE.forEach((s) => {
        const y = hy - S + s.y * S * 0.72;
        if (y < -2 || y > hy) return;
        const funkeln = ruhig() ? 0.8 : 0.6 + 0.4 * Math.sin(state.zeit * 1.7 + s.t);
        g.globalAlpha = P.sterne * funkeln * (1 - s.y * 0.6);
        g.fillRect(s.x * W, y, s.r, s.r);
      });
      g.globalAlpha = 1;
    }

    if (P.polar > 0.02) zeichnePolarlicht(P, S);

    const gestirn = (wo, farbe, schein, scheibe) => {
      if (wo.kraft < 0.02) return;
      const x = W * wo.x;
      const y = hy - wo.hoch * S;
      const r = S * 0.85;
      const hof = g.createRadialGradient(x, y, 0, x, y, r);
      hof.addColorStop(0, rgba(schein, 0.85 * wo.kraft));
      hof.addColorStop(0.18, rgba(schein, 0.4 * wo.kraft));
      hof.addColorStop(0.5, rgba(schein, 0.12 * wo.kraft));
      hof.addColorStop(1, rgba(schein, 0));
      g.fillStyle = hof;
      g.fillRect(x - r, Math.max(0, y - r), r * 2, Math.min(hy + 2, y + r) - Math.max(0, y - r));
      g.fillStyle = rgba(farbe, wo.kraft);
      g.beginPath();
      g.arc(x, y, S * scheibe, 0, Math.PI * 2);
      g.fill();
    };
    gestirn(P.sonne, P.sonne.farbe, P.sonne.schein, 0.05);
    // Strahlen: ein paar blasse Keile, die langsam wandern.
    if (P.sonne.kraft > 0.3 && P.sonne.hoch < 0.3 && !ruhig()) {
      const x = W * P.sonne.x;
      const y = hy - P.sonne.hoch * S;
      g.fillStyle = rgba(P.sonne.schein, 0.07 * P.sonne.kraft);
      g.beginPath();
      for (let i = 0; i < 7; i += 1) {
        const w = -Math.PI * (0.08 + 0.84 * (i / 6)) + Math.sin(state.zeit * 0.13 + i * 1.9) * 0.07;
        const b = 0.035 + 0.03 * hash01(i * 3.7);
        const lang = S * (0.75 + 0.5 * hash01(i * 5.3));
        g.moveTo(x, y);
        g.lineTo(x + Math.cos(w - b) * lang, y + Math.sin(w - b) * lang);
        g.lineTo(x + Math.cos(w + b) * lang, y + Math.sin(w + b) * lang);
        g.closePath();
      }
      g.fill();
    }
    zeichneDohlen(P, S);
    if (P.mond.kraft > 0.02) {
      gestirn(P.mond, [236, 242, 255], [150, 182, 255], 0.046);
      // Der Vollmond mit seinen Meeren.
      const mx = W * P.mond.x;
      const my = hy - P.mond.hoch * S;
      const mr = S * 0.046;
      g.fillStyle = rgba([150, 170, 220], 0.32 * P.mond.kraft);
      g.beginPath();
      [[-0.3, -0.25, 0.3], [0.28, 0.1, 0.22], [-0.12, 0.42, 0.18], [0.4, -0.42, 0.13]].forEach(([dx, dy, r]) => {
        g.moveTo(mx + (dx + r) * mr, my + dy * mr);
        g.arc(mx + dx * mr, my + dy * mr, r * mr, 0, Math.PI * 2);
      });
      g.fill();
    }
  }

  // Ein paar Bergdohlen, die vor dem Himmel kreisen: zwei geschwungene
  // Flügel, mehr nicht. Nachts schlafen sie.
  function zeichneDohlen(P, S) {
    const tag = 1 - P.polar;
    if (tag < 0.05 || cam.hy < 30) return;
    const W = view.cssW;
    const hy = cam.hy;
    const t = ruhig() ? 3 : state.zeit;
    g.strokeStyle = rgba(mix3(P.felsSchatten, [20, 16, 40], 0.5), 0.75 * tag);
    g.lineCap = "round";
    g.lineJoin = "round";
    for (let i = 0; i < 5; i += 1) {
      const kreis = 0.22 + 0.1 * hash01(i * 3.1);
      const tempo = 0.16 + 0.08 * hash01(i * 7.7);
      const w = t * tempo + i * 1.9;
      const x = W * (0.6 + 0.24 * hash01(i * 2.3)) + Math.cos(w) * W * kreis;
      const y = hy - S * (0.2 + 0.1 * hash01(i * 5.9)) + Math.sin(w * 1.3) * S * 0.05;
      if (y < -10 || y > hy - 4) continue;
      const gross = S * (0.012 + 0.007 * hash01(i * 9.1)) * (0.8 + 0.3 * Math.sin(w));
      const schlag = Math.sin(t * (5 + hash01(i * 4.4) * 2) + i) * 0.5;
      g.lineWidth = Math.max(1, gross * 0.28);
      g.beginPath();
      g.moveTo(x - gross, y - gross * (0.25 + schlag * 0.5));
      g.quadraticCurveTo(x - gross * 0.5, y - gross * (0.5 + schlag * 0.3), x, y);
      g.quadraticCurveTo(x + gross * 0.5, y - gross * (0.5 + schlag * 0.3), x + gross, y - gross * (0.25 + schlag * 0.5));
      g.stroke();
    }
  }

  function zeichnePolarlicht(P, S) {
    const W = view.cssW;
    const hy = cam.hy;
    const t = ruhig() ? 0 : state.zeit;
    [[0.06, [90, 255, 170], 0], [0.2, [70, 220, 255], 2.1], [0.4, [150, 120, 255], 4.4]].forEach(([hoehe, farbe, phase]) => {
      const fuss = hy - S * hoehe;
      const hoch = S * 0.34;
      const verlauf = g.createLinearGradient(0, fuss - hoch, 0, fuss);
      verlauf.addColorStop(0, rgba(farbe, 0));
      verlauf.addColorStop(0.6, rgba(farbe, 0.3 * P.polar));
      verlauf.addColorStop(1, rgba(farbe, 0));
      g.fillStyle = verlauf;
      g.beginPath();
      const welle = (x) => Math.sin(x * 0.011 + t * 0.35 + phase) * S * 0.04 + Math.sin(x * 0.027 - t * 0.22 + phase * 2) * S * 0.02;
      g.moveTo(-10, fuss + welle(-10));
      for (let x = 0; x <= W + 20; x += 24) g.lineTo(x, fuss + welle(x));
      for (let x = W + 20; x >= -10; x -= 24) g.lineTo(x, fuss - hoch + welle(x * 1.3) * 1.6);
      g.closePath();
      g.fill();
    });
  }

  // Vier Ketten am Horizont, die fernste blass, die nächste kräftig. Jeder
  // Berg hat einen Gipfel, zwei Schultern und eine Seite zur Sonne. Sie
  // wandern kaum – sie sind weit weg. Über ihrem Fuss liegt Dunst.
  function zeichneFerne(P) {
    const W = view.cssW;
    const hy = cam.hy;
    if (hy < -10) return;
    const S = view.cssH * 0.62;
    const links = P.licht[0] >= P.licht[1];
    const zurSonne = links ? -1 : 1;
    const fuss = hy + 3;
    for (let lage = 0; lage < 4; lage += 1) {
      const abstand = S * [0.105, 0.15, 0.21, 0.3][lage];
      const hoch = S * [0.04, 0.062, 0.09, 0.125][lage];
      const versatz = cam.x * [0.006, 0.011, 0.02, 0.034][lage] * cam.mass + lage * 137.3;
      const erster = Math.floor(versatz / abstand) - 1;
      const anzahl = Math.ceil(W / abstand) + 3;
      const farbe = lage < 3 ? P.fern[lage] : mix3(P.fern[2], P.felsSchatten, 0.45);
      const licht = lage < 3 ? P.fernLicht[lage] : mix3(P.fernLicht[2], P.felsLicht, 0.45);
      const berge = [];
      for (let i = 0; i <= anzahl; i += 1) {
        const n = erster + i;
        const z1 = hash01(n * 1.7 + lage * 31.3);
        const z2 = hash01(n * 2.9 + lage * 17.1);
        const z3 = hash01(n * 4.3 + lage * 5.9);
        const z4 = hash01(n * 6.1 + lage * 2.3);
        const x = (n + (z1 - 0.5) * 0.7) * abstand - versatz;
        // Jeder dritte, vierte ragt heraus.
        const h = hoch * (0.38 + 0.4 * z2 + (z4 > 0.72 ? 0.42 : 0));
        berge.push({ x, h, l: abstand * (0.26 + 0.2 * z3), r: abstand * (0.26 + 0.2 * z1), hl: h * (0.5 + 0.25 * z4), hr: h * (0.45 + 0.3 * z3) });
      }
      g.fillStyle = rgb(farbe);
      g.beginPath();
      g.moveTo(berge[0].x - abstand, fuss);
      berge.forEach((m) => {
        g.lineTo(m.x - m.l * 2.1, fuss - m.h * 0.12);
        g.lineTo(m.x - m.l, fuss - m.hl);
        g.lineTo(m.x, fuss - m.h);
        g.lineTo(m.x + m.r, fuss - m.hr);
        g.lineTo(m.x + m.r * 2.1, fuss - m.h * 0.12);
      });
      g.lineTo(berge[berge.length - 1].x + abstand, fuss);
      g.closePath();
      g.fill();
      // Die Seite zur Sonne: vom Gipfel über die Schulter hinunter.
      g.fillStyle = rgb(licht);
      g.beginPath();
      berge.forEach((m) => {
        const weit = zurSonne < 0 ? m.l : m.r;
        const schulter = zurSonne < 0 ? m.hl : m.hr;
        g.moveTo(m.x, fuss - m.h);
        g.lineTo(m.x + zurSonne * weit, fuss - schulter);
        g.lineTo(m.x + zurSonne * weit * 2.1, fuss - m.h * 0.12);
        g.lineTo(m.x + zurSonne * weit * 0.5, fuss);
        g.lineTo(m.x - zurSonne * weit * 0.12, fuss - m.h * 0.45);
        g.closePath();
      });
      g.fill();
    }
    // Dunst über dem Fuss der Ketten: Sie stehen im Nebelmeer, nicht darauf.
    const dunst = g.createLinearGradient(0, fuss - S * 0.11, 0, fuss);
    dunst.addColorStop(0, rgba(P.dunst, 0));
    dunst.addColorStop(1, rgba(mix3(P.wolkeFern, P.dunst, 0.45), 0.92));
    g.fillStyle = dunst;
    g.fillRect(0, fuss - S * 0.11, W, S * 0.11 + 1);
  }

  // ---------------------------------------------------------------------------
  // Zeichnen: das Nebelmeer
  // ---------------------------------------------------------------------------
  // Am Horizont liegt ein Verlauf – nur so weit, bis die erste Reihe deckt
  // (was darunter läge, übermalten die Reihen ohnehin). Davor Reihen aus
  // Bäuschen, jede an ihrem Platz in der Welt: Sie kommen
  // mit der Strecke näher, und weil sie tief unter dem Grat liegen, ziehen sie
  // langsamer durchs Bild als er – daran sieht man die Höhe.
  function zeichneMeer(P, bis) {
    const W = view.cssW;
    const H = view.cssH;
    const y0 = Math.max(0, cam.hy);
    const y1 = Math.min(H, bis);
    if (y1 <= y0) return;
    const verlauf = g.createLinearGradient(0, cam.hy, 0, Math.max(H, cam.hy + H * 0.9));
    verlauf.addColorStop(0, rgb(mix3(P.wolkeFern, P.dunst, 0.45)));
    verlauf.addColorStop(0.3, rgb(mix3(P.wolkeFern, P.wolkeNah, 0.35)));
    verlauf.addColorStop(1, rgb(P.wolkeNah));
    g.fillStyle = verlauf;
    g.fillRect(0, y0, W, y1 - y0);
  }

  // Die Reihen, die gerade zu sehen sind, von fern nach nah. Weit weg steht
  // nur jede zweite, vierte, achte – sonst läge am Horizont Reihe auf Reihe.
  // Was neu dazukommt, blendet ein.
  const reihenListe = [];
  function reihen() {
    reihenListe.length = 0;
    const k0 = Math.floor((cam.z + 40) / REIHE);
    for (let k = k0; k * REIHE - cam.z < 5400; k += 1) {
      let stufe = 0;
      let n = Math.abs(k);
      while (n > 0 && n % 2 === 0 && stufe < 4) { n /= 2; stufe += 1; }
      if (k === 0) stufe = 4;
      const weit = 640 * (1 << stufe);
      const d = k * REIHE - cam.z;
      if (d > weit) continue;
      const cz = d * cam.cos + (cam.y + WOLKE) * cam.sin;
      if (cz < 60) continue;
      const kk = cam.F / cz;
      const sy = cam.cy - ((-WOLKE - cam.y) * cam.cos + d * cam.sin) * kk;
      if (sy > view.cssH + 260 * kk) continue;
      reihenListe.push({ k, z: k * REIHE, cz, kk, sy, alpha: clamp((weit - d) / (weit * 0.22), 0, 1), bis: view.cssH + 10 });
    }
    reihenListe.sort((a, b) => b.z - a.z);
    // Jede Reihe reicht bis unter die nächste, die ganz da ist: Unter einer,
    // die erst einblendet, liegt so immer eine deckende.
    for (let i = 0; i < reihenListe.length - 1; i += 1) {
      let j = i + 1;
      while (j < reihenListe.length - 1 && reihenListe[j].alpha < 1) j += 1;
      reihenListe[i].bis = reihenListe[j].alpha < 1 ? view.cssH + 10 : reihenListe[j].sy + BAUSCH * 0.5 * reihenListe[j].kk + 4;
    }
    return reihenListe;
  }

  /*
   * Eine Reihe ist ein Umriss: oben die Bäusche, darunter ein Band bis zur
   * nächsten Reihe. Gemalt wird nicht Kreis um Kreis (viele Kreise
   * übereinander kosten auf dem iPhone am meisten), sondern eine einzige
   * Linie – an jeder Stelle so hoch wie der höchste Bausch dort – und
   * darunter eine Fläche. Der helle Rand ist dieselbe Linie als Strich.
   */
  const bausch = { x: new Float64Array(64), y: new Float64Array(64), r: new Float64Array(64) };
  const umrissX = new Float64Array(700);
  const umrissY = new Float64Array(700);
  function zeichneReihe(r, P) {
    const W = view.cssW;
    const t = clamp((r.cz - 320) / 3000, 0, 1) ** 0.7;
    // Jede Reihe eine Spur heller oder dunkler als ihre Nachbarn: So lesen
    // sich die Bäusche als Körper, nicht als Linien.
    const ton = 1 + (hash01(r.k * 2.3) - 0.5) * 0.07;
    const grund = mix3(P.wolkeNah, P.wolkeFern, t);
    const koerper = [grund[0] * ton, grund[1] * ton, grund[2] * ton];
    const rand = mix3(koerper, P.wolkeRand, 0.12 + 0.62 * t);
    const zug = ruhig() ? 0 : state.zeit * (5 + hash01(r.k * 7.7) * 7) * (r.k % 2 ? 1 : -1);
    const halb = W / 2 / r.kk + BAUSCH;
    const m0 = Math.floor((cam.x - halb - zug) / BAUSCH);
    const m1 = Math.min(m0 + 62, Math.ceil((cam.x + halb - zug) / BAUSCH));
    let n = 0;
    for (let m = m0; m <= m1; m += 1) {
      const wx = (m + (hash01(m * 3.3 + r.k * 17.7) - 0.5) * 0.7) * BAUSCH + zug;
      const gross = hash01(m * 5.1 + r.k * 9.3);
      const rs = BAUSCH * (0.34 + 0.62 * gross * gross) * r.kk;
      bausch.x[n] = cam.cx + (wx - cam.x) * r.kk;
      bausch.y[n] = r.sy + rs * 0.5;
      bausch.r[n] = rs;
      n += 1;
    }
    const grundY = r.sy + BAUSCH * 0.3 * r.kk;
    const schritt = clamp(r.kk * 22, 2.6, 10);
    let punkte = 0;
    let erster = 0;
    for (let x = -6; x <= W + 6 + schritt && punkte < umrissY.length; x += schritt) {
      // Die Bäusche stehen nach x geordnet: Was links schon vorbei ist,
      // kommt nicht wieder.
      while (erster < n && bausch.x[erster] + bausch.r[erster] < x - BAUSCH * r.kk) erster += 1;
      let y = grundY;
      for (let i = erster; i < n; i += 1) {
        const dx = x - bausch.x[i];
        const rs = bausch.r[i];
        if (dx < -rs) { if (bausch.x[i] - BAUSCH * r.kk > x) break; continue; }
        if (dx > rs) continue;
        const oben = bausch.y[i] - Math.sqrt(rs * rs - dx * dx);
        if (oben < y) y = oben;
      }
      umrissX[punkte] = x;
      umrissY[punkte] = y;
      punkte += 1;
    }
    // Zweimal dieselbe Linie als Fläche: erst hell, ein schmales Band – dann
    // eine Spur tiefer der Körper. Was vom hellen übrig bleibt, ist der Rand.
    // (Als Strich gemalt kostete derselbe Rand das Vierfache.)
    const dick = clamp(11 * r.kk, 1.2, 5);
    const unten = Math.max(r.bis, grundY) + 2;
    const flaeche = (runter, bis, farbe) => {
      g.fillStyle = farbe;
      g.beginPath();
      g.moveTo(umrissX[0], umrissY[0] + runter);
      for (let i = 1; i < punkte; i += 1) g.lineTo(umrissX[i], umrissY[i] + runter);
      g.lineTo(umrissX[punkte - 1], bis);
      g.lineTo(umrissX[0], bis);
      g.closePath();
      g.fill();
    };
    g.globalAlpha = r.alpha;
    flaeche(0, Math.min(unten, grundY + dick + 2), rgb(rand));
    flaeche(dick, unten, rgb(koerper));
    g.globalAlpha = 1;
  }

  // ---------------------------------------------------------------------------
  // Zeichnen: der Grat
  // ---------------------------------------------------------------------------
  function stationProj(st) {
    if (st.bild === bildNr) return;
    st.bild = bildNr;
    for (let j = 0; j <= NB; j += 1) {
      proj(st.L[j]);
      proj(st.R[j]);
    }
    proj(st.M);
  }

  // Wie viel Dunst zwischen Kamera und Fläche liegt, und wie tief sie schon
  // im Nebel steckt.
  const dunstBei = (cz) => clamp((cz - 620) / 3300, 0, 1) * 0.82;
  const nebelBei = (y) => glatt((-290 - y) / 170) * 0.8;

  function flaecheMalen(a, b, c, farbe) {
    // Eine Spur grösser als gerechnet: Sonst schimmerte zwischen zwei
    // Flächen der Grund durch.
    const mx = (a.sx + b.sx + c.sx) / 3;
    const my = (a.sy + b.sy + c.sy) / 3;
    const raus = (p) => {
      const dx = p.sx - mx;
      const dy = p.sy - my;
      const l = Math.hypot(dx, dy) || 1;
      return [p.sx + (dx / l) * 0.7, p.sy + (dy / l) * 0.7];
    };
    const p = raus(a);
    const q = raus(b);
    const r = raus(c);
    g.fillStyle = farbe;
    g.beginPath();
    g.moveTo(p[0], p[1]);
    g.lineTo(q[0], q[1]);
    g.lineTo(r[0], r[1]);
    g.closePath();
    g.fill();
  }

  function viereck(a, b, c, d, farbe) {
    g.fillStyle = farbe;
    g.beginPath();
    g.moveTo(a.sx, a.sy);
    g.lineTo(b.sx, b.sy);
    g.lineTo(c.sx, c.sy);
    g.lineTo(d.sx, d.sy);
    g.closePath();
    g.fill();
  }

  function zeichneScheibe(sl, P) {
    const nah = sl.nah;
    const fern = sl.fern;
    stationProj(nah);
    stationProj(fern);
    const [wl, wr, wo] = P.licht;
    const nebelFarbe = mix3(P.wolkeNah, P.wolkeFern, clamp((nah.M.cz - 320) / 3000, 0, 1) ** 0.7);
    // Weit weg ist eine Fläche wenige Bildpunkte gross: Dort genügt je
    // Flanke eine – das spart zwei Drittel der Zeichenbefehle.
    const grob = nah.M.cz > GROB_AB;
    if (grob) {
      const dunst = dunstBei(nah.M.cz);
      for (let i = 0; i < 2; i += 1) {
        const f = sl.grob[i];
        const e = f.ecken;
        if (e[0].cz < 16 || e[1].cz < 16 || e[2].cz < 16 || e[3].cz < 16) continue;
        if (f.nx * (cam.x - f.mx) + f.ny * (cam.y - f.my) + f.nz * (cam.z - f.mz) <= 0) continue;
        const hell = clamp(wl * f.ll + wr * f.lr + wo * f.lo, 0, 1) ** 0.8;
        let farbe = mix3(mix3(P.felsSchatten, P.felsLicht, hell), mix3(P.schneeSchatten, P.schneeLicht, hell), 0.3);
        farbe = mix3(mix3(farbe, nebelFarbe, 0.25), P.dunst, dunst);
        viereck(e[0], e[1], e[2], e[3], rgb(farbe));
      }
    }
    for (let i = 0; !grob && i < sl.flaechen.length; i += 1) {
      const f = sl.flaechen[i];
      if (f.a.cz < 16 || f.b.cz < 16 || f.c.cz < 16) continue;
      // Was von der Kamera wegschaut, sieht niemand.
      if (f.nx * (cam.x - f.mx) + f.ny * (cam.y - f.my) + f.nz * (cam.z - f.mz) <= 0) continue;
      const hell = clamp(wl * f.ll + wr * f.lr + wo * f.lo, 0, 1) ** 0.8;
      let farbe = f.schnee ? mix3(P.schneeSchatten, P.schneeLicht, hell) : mix3(P.felsSchatten, P.felsLicht, hell);
      const ton = 1 + f.v * (f.schnee ? 0.035 : 0.1);
      farbe = [farbe[0] * ton, farbe[1] * ton, farbe[2] * ton];
      farbe = mix3(farbe, nebelFarbe, nebelBei(f.my));
      farbe = mix3(farbe, P.dunst, dunstBei((f.a.cz + f.b.cz + f.c.cz) / 3));
      flaecheMalen(f.a, f.b, f.c, rgb(farbe));
    }
    // Oben der Grat selbst: Schnee, zur Sonne hin hell, auf der anderen
    // Seite eine Spur im Schatten.
    if (nah.M.cz < 16 || fern.M.cz < 16 || nah.L[0].cz < 16 || nah.R[0].cz < 16) return;
    const dunst = dunstBei((nah.M.cz + fern.M.cz) / 2) * 0.75;
    const ton = 1 + sl.v * 0.025;
    const seite = (k) => {
      const c = mix3(P.pfadSchatten, P.pfadLicht, k);
      return rgb(mix3([c[0] * ton, c[1] * ton, c[2] * ton], P.dunst, dunst));
    };
    viereck(nah.L[0], nah.M, fern.M, fern.L[0], seite(clamp(1 - wr * 0.6, 0, 1)));
    viereck(nah.M, nah.R[0], fern.R[0], fern.M, seite(clamp(1 - wl * 0.6, 0, 1)));
    // Die Kanten: Sie sagen, wo der Grat aufhört.
    g.lineWidth = clamp(1.6 * cam.F / nah.M.cz, 0.6, 2.4);
    g.strokeStyle = rgba(mix3(P.kante, P.dunst, dunst), 0.8);
    g.beginPath();
    g.moveTo(nah.L[0].sx, nah.L[0].sy);
    g.lineTo(fern.L[0].sx, fern.L[0].sy);
    g.moveTo(nah.R[0].sx, nah.R[0].sy);
    g.lineTo(fern.R[0].sx, fern.R[0].sy);
    g.stroke();
  }

  // Eine alte Fährte in der Mitte des Grats (am Fels: in der Gasse): Wer ihr
  // folgt, läuft richtig.
  function zeichneFaehrte(sl, P) {
    const nah = sl.nah;
    if (nah.M.cz > 1500 || nah.M.cz < 30) return;
    const fern = sl.fern;
    const lang = fern.z - nah.z;
    const n = Math.max(1, Math.round(lang / 30));
    g.fillStyle = rgba(P.kante, 0.3 * (1 - nah.M.cz / 1500));
    g.beginPath();
    for (let i = 0; i < n; i += 1) {
      const u = (i + 0.5) / n;
      const p = projXYZ(lerp(nah.fx, fern.fx, u) + ((nah.i * 7 + i) % 2 ? 3.2 : -3.2), KRONE, lerp(nah.z, fern.z, u));
      if (!p) continue;
      const r = 2.3 * cam.F / p.cz;
      g.moveTo(p.sx + r, p.sy);
      g.ellipse(p.sx, p.sy, r, r * 0.62, 0, 0, Math.PI * 2);
    }
    g.fill();
  }

  /*
   * Der Felsturm als Körper: drei Ringe aus acht Ecken, nach oben enger,
   * darüber die Spitze. Der unterste Ring ist der Umriss am Boden – das
   * Rechteck, in dem er steht (imFels), mit gekappten Ecken; nach innen, zur
   * Gasse hin, steht keine Ecke darüber hinaus. Jede Fläche merkt sich wie
   * die des Bergs, wie hell sie in jedem der drei Lichter steht.
   */
  const FELS_UMRISS = [[1, -0.5], [1, 0.5], [0.55, 1], [-0.55, 1], [-1, 0.5], [-1, -0.5], [-0.55, -1], [0.55, -1]];
  // Höhe (Anteil), Grösse, Versatz quer und längs (Anteil der halben Masse).
  const FELS_STUFEN = [[0, 1, 0, 0], [0.36, 0.82, 0.06, 0.07], [0.7, 0.52, 0.14, -0.1]];

  function felsBauen(k) {
    const f = k.fels;
    const uM = (f.rand + f.breit) / 2;
    const ru = (f.breit - f.rand) / 2;
    const zM = (f.z0 + f.z1) / 2;
    const rz = (f.z1 - f.z0) / 2;
    const hoch = lerp(80, 116, f.saat);
    const zuf = (n) => hash01(f.saat * 97.3 + n * 7.31);
    const punkt = (u, z, y) => ({ x: k.x + k.s * (z - k.z) + f.seite * u, y, z, sx: 0, sy: 0, cz: 0 });
    const punkte = [];
    const ringe = FELS_STUFEN.map(([h, gross, du, dz], nr) => FELS_UMRISS.map(([cu, cz], j) => {
      const wackel = nr ? 1 + (zuf(nr * 10 + j) - 0.5) * 0.3 : 1;
      const u = clamp(cu * gross * wackel + du * (zuf(nr + 40) * 2 - 0.6), -1, 1);
      const z = clamp(cz * gross * wackel + dz, -1, 1);
      const p = punkt(uM + u * ru, zM + z * rz, nr ? hoch * h * (0.9 + 0.2 * zuf(nr * 20 + j)) : KRONE - 3);
      punkte.push(p);
      return p;
    }));
    const spitze = punkt(uM + (zuf(60) - 0.5) * 0.4 * ru, zM + (zuf(61) - 0.5) * 0.3 * rz, hoch);
    punkte.push(spitze);
    const achse = punkt(uM, zM, 0);
    const flaechen = [];
    const ecke = (a, b, c, band, zahl) => {
      let nx = (b.y - a.y) * (c.z - a.z) - (b.z - a.z) * (c.y - a.y);
      let ny = (b.z - a.z) * (c.x - a.x) - (b.x - a.x) * (c.z - a.z);
      let nz = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
      const l = Math.hypot(nx, ny, nz) || 1;
      nx /= l; ny /= l; nz /= l;
      const mx = (a.x + b.x + c.x) / 3;
      const my = (a.y + b.y + c.y) / 3;
      const mz = (a.z + b.z + c.z) / 3;
      // Nach aussen: weg von der Achse des Turms.
      const aussen = nx * (mx - achse.x) + nz * (mz - achse.z);
      if (aussen < 0 || (Math.abs(aussen) < 1e-6 && ny < 0)) { nx = -nx; ny = -ny; nz = -nz; }
      const hell = (L) => Math.max(0, nx * L[0] + ny * L[1] + nz * L[2]);
      flaechen.push({
        a, b, c, nx, ny, nz, mx, my, mz,
        ll: hell(LICHT_L), lr: hell(LICHT_R), lo: hell(LICHT_O),
        // Schnee liegt auf der Spitze und wo es flach genug ist.
        schnee: band === 2 || (band === 1 && ny > 0.42),
        v: zahl * 2 - 1,
      });
    };
    for (let nr = 0; nr < 2; nr += 1) {
      for (let j = 0; j < 8; j += 1) {
        const a = ringe[nr][j];
        const b = ringe[nr][(j + 1) % 8];
        const c = ringe[nr + 1][(j + 1) % 8];
        const d = ringe[nr + 1][j];
        ecke(a, b, c, nr, zuf(100 + nr * 16 + j));
        ecke(a, c, d, nr, zuf(140 + nr * 16 + j));
      }
    }
    for (let j = 0; j < 8; j += 1) ecke(ringe[2][j], ringe[2][(j + 1) % 8], spitze, 2, zuf(180 + j));
    f.teile = { punkte, flaechen, fuss: ringe[0], achse };
  }

  function zeichneFels(k, P) {
    const f = k.fels;
    if (!f.teile) felsBauen(k);
    const t = f.teile;
    if (!proj(t.achse) || t.achse.cz > SICHT) return;
    for (let i = 0; i < t.punkte.length; i += 1) {
      if (!proj(t.punkte[i]) || t.punkte[i].cz < 16) return;
    }
    const [wl, wr, wo] = P.licht;
    const dunst = dunstBei(t.achse.cz);
    // Der Schatten am Fuss: der Umriss, eine Spur grösser.
    g.fillStyle = rgba(mix3(P.kante, P.dunst, dunst), 0.3);
    g.beginPath();
    t.fuss.forEach((p, i) => {
      const x = t.achse.sx + (p.sx - t.achse.sx) * 1.14;
      const y = t.achse.sy + (p.sy - t.achse.sy) * 1.14;
      if (i === 0) g.moveTo(x, y);
      else g.lineTo(x, y);
    });
    g.closePath();
    g.fill();
    // Die Flächen, die zur Kamera schauen – von hinten nach vorn.
    const sicht = [];
    for (let i = 0; i < t.flaechen.length; i += 1) {
      const fl = t.flaechen[i];
      if (fl.nx * (cam.x - fl.mx) + fl.ny * (cam.y - fl.my) + fl.nz * (cam.z - fl.mz) > 0) sicht.push(fl);
    }
    sicht.sort((p, q) => (q.a.cz + q.b.cz + q.c.cz) - (p.a.cz + p.b.cz + p.c.cz));
    for (let i = 0; i < sicht.length; i += 1) {
      const fl = sicht[i];
      const hell = clamp(wl * fl.ll + wr * fl.lr + wo * fl.lo, 0, 1) ** 0.8;
      // Der Fels dunkler als die Flanken: Er soll sich vom Schnee abheben.
      let farbe = fl.schnee ? mix3(P.schneeSchatten, P.schneeLicht, hell) : mix3(mix3(P.felsSchatten, P.felsLicht, hell), P.felsSchatten, 0.3);
      const ton = 1 + fl.v * (fl.schnee ? 0.035 : 0.1);
      farbe = mix3([farbe[0] * ton, farbe[1] * ton, farbe[2] * ton], P.dunst, dunst);
      flaecheMalen(fl.a, fl.b, fl.c, rgb(farbe));
    }
  }

  // Was auf dem Grat steht: das Gipfelkreuz am Start, eine Fahne an jeder
  // zehnten Kehre, da und dort ein Steinmann.
  function zeichneZeichen(st, P) {
    if (st.i === state.kreuzBei) zeichneKreuz(st, P);
    if (st.kehre < 1) return;
    const k = state.kehren[st.kehre];
    // Die äussere Spitze der Kehre zeigt dorthin, wohin das Stück davor lief.
    const aussen = -k.s;
    const p = projXYZ(k.x + aussen * st.hw * 0.72, KRONE, k.z);
    if (!p || p.cz > 2300) return;
    const s = cam.F / p.cz;
    const dunst = dunstBei(p.cz);
    if (st.kehre % 10 === 0) {
      // Die Fahne: rot mit weissem Kreuz, und darunter die Zahl der Kehre.
      const hoch = 44 * s;
      const flattern = ruhig() ? 0 : Math.sin(state.zeit * 6 + st.kehre) * 0.18;
      g.strokeStyle = rgb(mix3([70, 52, 44], P.dunst, dunst));
      g.lineWidth = Math.max(1, 2.2 * s);
      g.lineCap = "round";
      g.beginPath();
      g.moveTo(p.sx, p.sy);
      g.lineTo(p.sx, p.sy - hoch);
      g.stroke();
      const fx = p.sx + 1 * s;
      const fy = p.sy - hoch;
      const b = 22 * s;
      const h = 15 * s;
      g.fillStyle = rgb(mix3([226, 44, 52], P.dunst, dunst));
      g.beginPath();
      g.moveTo(fx, fy);
      g.quadraticCurveTo(fx + b * 0.5, fy + flattern * h, fx + b, fy + flattern * h * 1.6);
      g.lineTo(fx + b, fy + h + flattern * h * 1.6);
      g.quadraticCurveTo(fx + b * 0.5, fy + h + flattern * h, fx, fy + h);
      g.closePath();
      g.fill();
      g.fillStyle = rgb(mix3([255, 255, 255], P.dunst, dunst));
      g.fillRect(fx + b * 0.42, fy + h * 0.2 + flattern * h * 0.8, b * 0.16, h * 0.6);
      g.fillRect(fx + b * 0.26, fy + h * 0.41 + flattern * h * 0.8, b * 0.48, h * 0.18);
      if (s > 0.35) {
        g.font = `900 ${Math.round(clamp(12 * s, 8, 20))}px system-ui, sans-serif`;
        g.textAlign = "center";
        g.textBaseline = "top";
        g.lineWidth = 3;
        g.strokeStyle = rgba(P.kante, 0.85);
        g.strokeText(String(st.kehre), p.sx, p.sy + 3 * s);
        g.fillStyle = "#ffffff";
        g.fillText(String(st.kehre), p.sx, p.sy + 3 * s);
      }
    } else if (hash01(st.kehre * 4.71) < 0.4) {
      // Ein Steinmann: drei Steine übereinander.
      const [wl, wr] = P.licht;
      const stein = mix3(mix3(P.felsSchatten, [120, 112, 128], 0.55), P.dunst, dunst);
      const steinHell = mix3(mix3(P.schneeLicht, [200, 190, 190], 0.35), P.dunst, dunst);
      [[0, 6.6, 4.4], [-5, 4.8, 3.2], [-9, 3.1, 2.3]].forEach(([dy, rx, ry]) => {
        g.fillStyle = rgb(stein);
        g.beginPath();
        g.ellipse(p.sx, p.sy + dy * s - 2 * s, rx * s, ry * s, 0, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = rgb(steinHell);
        g.beginPath();
        g.ellipse(p.sx + (wr > wl ? 1.4 : -1.4) * s, p.sy + dy * s - 3.2 * s, rx * 0.62 * s, ry * 0.5 * s, 0, 0, Math.PI * 2);
        g.fill();
      });
    }
  }

  function zeichneKreuz(st, P) {
    const s0 = state.kehren[0].s;
    // Auf der Seite, von der der Grat wegläuft – dort steht es frei.
    const p = projXYZ(st.x - s0 * st.hw * 0.66, KRONE, st.z);
    if (!p || p.cz > 2000) return;
    const s = (cam.F / p.cz) * 0.8;
    const [wl, wr] = P.licht;
    const holz = mix3([58, 40, 34], P.felsSchatten, 0.35);
    const hell = mix3([150, 104, 74], P.felsLicht, 0.4);
    const seite = wr > wl ? 1 : -1;
    // Der Sockel aus Steinen.
    [[-9, 0, 9, 5], [8, -1, 8, 4.5], [0, -5, 9, 5]].forEach(([dx, dy, rx, ry]) => {
      g.fillStyle = rgb(mix3(P.felsSchatten, P.felsLicht, 0.28));
      g.beginPath();
      g.ellipse(p.sx + dx * s, p.sy + dy * s, rx * s, ry * s, 0, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = rgb(P.schneeLicht);
      g.beginPath();
      g.ellipse(p.sx + (dx + seite * 1.5) * s, p.sy + (dy - 2.4) * s, rx * 0.7 * s, ry * 0.45 * s, 0, 0, Math.PI * 2);
      g.fill();
    });
    const balken = (x, y, w, h) => {
      g.fillStyle = rgb(holz);
      g.fillRect(p.sx + x * s, p.sy + y * s, w * s, h * s);
      g.fillStyle = rgb(hell);
      if (h > w) g.fillRect(p.sx + (seite > 0 ? x + w * 0.55 : x) * s, p.sy + y * s, w * 0.45 * s, h * s);
      else g.fillRect(p.sx + x * s, p.sy + y * s, w * s, h * 0.42 * s);
    };
    balken(-3, -78, 6, 74);
    balken(-21, -62, 42, 6);
    // Schnee auf dem Querbalken.
    g.fillStyle = rgb(P.schneeLicht);
    g.fillRect(p.sx - 21 * s, p.sy - 64.5 * s, 42 * s, 2.8 * s);
    g.fillRect(p.sx - 3.6 * s, p.sy - 80.5 * s, 7.2 * s, 2.8 * s);
  }

  // ---------------------------------------------------------------------------
  // Zeichnen: der Steinbock
  // ---------------------------------------------------------------------------
  /*
   * Von der Seite, wie eine Figur in einem Bilderbuch: der gedrungene
   * Körper, der Bart, und die zwei langen, nach hinten gebogenen Hörner mit
   * ihren Wülsten – an ihnen erkennt man ihn auf einen Blick. Er schaut
   * nach rechts (x nach vorn, y nach unten, die Hufe bei null) und wird für
   * links gespiegelt; weil der Grat im Bild schräg nach hinten läuft, steigt
   * er ein wenig an (steig).
   *
   * Die helle Kante zur Sonne entsteht, indem der Körper zweimal gemalt
   * wird: einmal hell, dann eine Spur von der Sonne weg in seiner Farbe.
   *
   * takt: der Galopp als Winkel. Im Stand null.
   */
  function zeichneBock(sx, sy, s, blick, takt, wahl = {}) {
    const { geist = null, alpha = 1, hub = 0, kipp = 0, sonne = -1, schatten = true, steig = 0.3, laeuft = true } = wahl;
    const fell = geist || "#a06d40";
    const fellDunkel = geist || "#6f4729";
    const bauch = geist || "#d2a877";
    const beinFern = geist || "#4d3220";
    const beinNah = geist || "#6a4428";
    const huf = geist || "#1f1712";
    const hornFarbe = geist || "#3b2d24";
    const hornHell = geist || "#a18c74";
    const licht = geist || "#ffdcae";
    g.save();
    g.globalAlpha = alpha;
    if (schatten && !geist) {
      // Der Schatten bleibt auf dem Schnee, auch wenn der Körper springt.
      g.fillStyle = "rgba(44, 36, 104, 0.3)";
      g.beginPath();
      g.ellipse(sx - sonne * 6 * s, sy + 1.5 * s, (15 - hub * 0.6) * s, (4.6 - hub * 0.2) * s, 0, 0, Math.PI * 2);
      g.fill();
    }
    g.translate(sx, sy - hub * s);
    // Die Wendung: Die Figur klappt um wie ein Blatt (blick −1 bis 1).
    const breit = Math.sign(blick || 1) * Math.max(0.16, Math.abs(blick));
    g.scale(s * breit, s);
    g.rotate(-steig + kipp * Math.sign(blick || 1));
    g.lineCap = "round";
    g.lineJoin = "round";
    const galopp = laeuft ? Math.sin(takt) : 0;
    const wippe = laeuft ? Math.cos(takt) * 0.07 : 0;
    g.rotate(wippe);

    // Ein Bein: Oberschenkel und Lauf, vom Rumpf weg. w ist der Winkel des
    // Oberschenkels (0 senkrecht, positiv nach vorn), knick der des Laufs.
    const bein = (x, y, w, knick, farbe) => {
      const kx = x + Math.sin(w) * 7.5;
      const ky = y + Math.cos(w) * 7.5;
      const fx = kx + Math.sin(w + knick) * 8;
      const fy = ky + Math.cos(w + knick) * 8;
      g.strokeStyle = farbe;
      g.lineWidth = 3.4;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(kx, ky);
      g.stroke();
      g.lineWidth = 2.5;
      g.beginPath();
      g.moveTo(kx, ky);
      g.lineTo(fx, fy);
      g.stroke();
      g.fillStyle = huf;
      g.beginPath();
      g.ellipse(fx + 0.4, fy + 0.3, 2, 1.5, 0, 0, Math.PI * 2);
      g.fill();
    };
    // Im Galopp greifen die Vorderbeine aus, während die Hinterbeine
    // abstossen – und umgekehrt. Die fernen Beine laufen eine Spur versetzt.
    const vorn = (versatz) => 0.75 * Math.sin(takt + versatz);
    const hinten = (versatz) => -0.75 * Math.sin(takt + versatz + 0.5);
    if (laeuft) {
      bein(9.5, -11, vorn(0.7), -0.5 - 0.3 * Math.cos(takt + 0.7), beinFern);
      bein(-9, -11, hinten(0.7), 0.55 + 0.3 * Math.cos(takt + 1.2), beinFern);
    } else {
      bein(10.5, -11, 0.1, -0.12, beinFern);
      bein(-8, -11, -0.12, 0.2, beinFern);
    }

    // Das ferne Horn zuerst: Es steht hinter dem Kopf.
    const hornWeg = (dx, dy) => {
      g.beginPath();
      g.moveTo(18 + dx, -31.5 + dy);
      g.bezierCurveTo(17 + dx, -45 + dy, 3 + dx, -50 + dy, -6.5 + dx, -38.5 + dy);
    };
    g.strokeStyle = geist || "#2c211a";
    g.lineWidth = 3;
    hornWeg(3, 1.2);
    g.stroke();

    const rumpf = () => {
      g.beginPath();
      g.ellipse(0, -16, 14.5, 7.8, 0, 0, Math.PI * 2);
      g.fill();
      g.beginPath();
      g.arc(9.5, -17, 8.6, 0, Math.PI * 2);
      g.fill();
      g.beginPath();
      g.arc(-9.5, -16.2, 7.8, 0, Math.PI * 2);
      g.fill();
      // Der Hals.
      g.beginPath();
      g.moveTo(8, -24);
      g.lineTo(16.5, -33.5);
      g.lineTo(22.5, -29);
      g.lineTo(16.5, -13);
      g.closePath();
      g.fill();
    };
    // Das Licht kommt von der Sonnenseite und von oben.
    const lx = sonne * Math.sign(blick || 1);
    g.fillStyle = licht;
    g.save();
    g.translate(lx * 1.3, -1.3);
    rumpf();
    g.restore();
    g.fillStyle = fell;
    rumpf();
    // Der helle Bauch und die dunkle Flanke darüber.
    g.fillStyle = bauch;
    g.beginPath();
    g.ellipse(0.5, -10.4, 11.5, 2.6, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = fellDunkel;
    g.globalAlpha = alpha * (geist ? 0 : 0.5);
    g.beginPath();
    g.ellipse(-1, -13.6, 13, 2.7, 0, 0, Math.PI * 2);
    g.fill();
    g.globalAlpha = alpha;
    // Der Schwanz.
    g.strokeStyle = fellDunkel;
    g.lineWidth = 2.6;
    g.beginPath();
    g.moveTo(-16.4, -19);
    g.lineTo(-19.6, -21.4 + galopp * 1.2);
    g.stroke();

    // Die nahen Beine.
    if (laeuft) {
      bein(7.5, -10.5, vorn(0), -0.5 - 0.3 * Math.cos(takt), beinNah);
      bein(-10.5, -10.5, hinten(0), 0.55 + 0.3 * Math.cos(takt + 0.5), beinNah);
    } else {
      bein(8, -10.5, 0.02, -0.06, beinNah);
      bein(-11, -10.5, -0.04, 0.14, beinNah);
    }

    // Der Kopf: Stirn, Schnauze, Ohr, Auge und der Bart.
    g.fillStyle = licht;
    g.beginPath();
    g.ellipse(21 + lx * 1.1, -31.6, 6.4, 4.5, -0.32, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = fell;
    g.beginPath();
    g.ellipse(21, -30.5, 6.4, 4.5, -0.32, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = bauch;
    g.beginPath();
    g.ellipse(26, -28.3, 3, 2.5, -0.3, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = huf;
    g.beginPath();
    g.ellipse(28.2, -28.6, 1, 1.2, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = fellDunkel;
    g.beginPath();
    g.moveTo(23.2, -26.6);
    g.lineTo(22.2, -20.6);
    g.lineTo(25.4, -26.2);
    g.closePath();
    g.fill();
    g.beginPath();
    g.ellipse(15.6, -33.2, 3.2, 1.5, -0.9, 0, Math.PI * 2);
    g.fill();
    if (!geist) {
      g.fillStyle = "#16100c";
      g.beginPath();
      g.arc(22.2, -31.6, 0.95, 0, Math.PI * 2);
      g.fill();
    }
    // Das nahe Horn mit seinen Wülsten.
    g.strokeStyle = hornFarbe;
    g.lineWidth = 3.8;
    hornWeg(0, 0);
    g.stroke();
    g.strokeStyle = hornHell;
    g.lineWidth = 1.2;
    g.setLineDash([1.4, 3.1]);
    hornWeg(0, -0.4);
    g.stroke();
    g.setLineDash([]);
    g.restore();
  }

  // In welchem Winkel eine Laufrichtung im Bild liegt.
  function bildWinkel(x, z, r) {
    const p0 = projXYZ(x, KRONE, z);
    if (!p0) return r > 0 ? -0.8 : -2.34;
    const ax = p0.sx;
    const ay = p0.sy;
    const p1 = projXYZ(x + r * 20, KRONE, z + 20);
    if (!p1) return r > 0 ? -0.8 : -2.34;
    return Math.atan2(p1.sy - ay, p1.sx - ax);
  }

  function zeichneSpur(P) {
    if (!state.spur.length) return;
    g.fillStyle = rgba(P.kante, 0.5);
    g.beginPath();
    state.spur.forEach((t, i) => {
      const p = projXYZ(t.x, KRONE, t.z);
      if (!p || p.cz > 1300) return;
      const r = 2.6 * cam.F / p.cz * (0.5 + 0.5 * (i / state.spur.length));
      g.moveTo(p.sx + r, p.sy);
      g.ellipse(p.sx, p.sy, r, r * 0.62, 0, 0, Math.PI * 2);
    });
    g.fill();
  }

  // Wie stark die Laufrichtung im Bild ansteigt – so schräg steht die Figur.
  function steigBei(x, z, r) {
    const w = bildWinkel(x, z, r);
    return clamp(Math.atan2(-Math.sin(w), Math.abs(Math.cos(w))), 0, 1.2) * 0.42;
  }

  function zeichneFigur(P) {
    const b = state.bock;
    const p = projXYZ(b.x, b.y + KRONE, b.z);
    if (!p) return;
    const sx = p.sx;
    const sy = p.sy;
    const s = (cam.F / p.cz) * 1.12;
    const sonne = P.licht[1] > P.licht[0] ? 1 : -1;
    const steig = steigBei(b.x, Math.max(b.z, -100), 1);
    if (state.schritt === "sturz" && state.sturz && state.sturz.art === "prall") {
      // In den Fels gerannt: Er liegt im Schnee, und über ihm kreisen Sterne.
      const f = state.sturz;
      zeichneBock(sx, sy, s, state.dreh, 0, { kipp: f.dreh, sonne, steig: 0, laeuft: false });
      if (f.liegt && !ruhig()) {
        g.fillStyle = "#ffe08a";
        for (let i = 0; i < 3; i += 1) {
          const w = state.zeit * 5 + (i * Math.PI * 2) / 3;
          const x = sx + Math.cos(w) * 13 * s;
          const y = sy - 24 * s + Math.sin(w) * 4 * s;
          const r = (2.6 + Math.sin(w) * 0.8) * s;
          g.beginPath();
          for (let j = 0; j < 10; j += 1) {
            const a = (j / 10) * Math.PI * 2 - Math.PI / 2;
            const rr = j % 2 ? r * 0.45 : r;
            if (j === 0) g.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
            else g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
          }
          g.closePath();
          g.fill();
        }
      }
      return;
    }
    if (state.schritt === "sturz" && state.sturz) {
      const f = state.sturz;
      const blass = clamp(1 - (-b.y - WOLKE * 0.55) / (WOLKE * 0.35), 0, 1);
      if (blass <= 0) return;
      zeichneBock(sx, sy, s, state.dreh, state.zeit * 24, { kipp: f.dreh, alpha: blass, sonne, schatten: false, steig });
      return;
    }
    const laeuft = state.schritt === "lauf";
    const hub = laeuft && !ruhig() ? (0.5 - 0.5 * Math.cos(state.galopp * 2)) * 2.6 + state.sprung * 7 : 0;
    zeichneBock(sx, sy, s, state.dreh, state.galopp, { hub, sonne, steig, laeuft });
  }

  // Die Gegner als Geist (geist.js): ein Steinbock aus Licht auf seinem Weg.
  function zeichneGeister() {
    if (!gegner || state.phase === "bereit") return;
    const orte = window.LernappGeist?.orte?.(gegner) || [];
    if (!orte.length) return;
    const namen = [];
    orte.forEach((o) => {
      // Wem im Live-Modus zugeschaut wird, der ist die Figur selbst.
      if (o.ziel) return;
      const p = projXYZ(o.a, KRONE, o.b);
      if (!p || p.cz > 2400) return;
      const sx = p.sx;
      const sy = p.sy;
      const s = cam.F / p.cz;
      const r = (o.c & 1) ? 1 : -1;
      zeichneBock(sx, sy, s * 1.12, r, state.zeit * 13 + o.a * 0.05, { geist: o.farbe, alpha: 0.55 * o.blass, steig: steigBei(o.a, o.b, 1) });
      const dz = o.b - state.bock.z;
      namen.push({ ...o, sx, sy: sy - 52 * s, weit: `${dz > 0 ? "+" : ""}${Math.round(dz / METER)} m` });
    });
    window.LernappGeist.namen(g, namen, { breit: view.cssW, hoch: view.cssH });
  }

  // ---------------------------------------------------------------------------
  // Zeichnen: Schnee, Funken, Schrift
  // ---------------------------------------------------------------------------
  function zeichneTeile(P) {
    if (!state.teile.length) return;
    state.teile.forEach((t) => {
      const p = projXYZ(t.x, t.y, t.z);
      if (!p) return;
      const k = clamp(t.leben / t.max, 0, 1);
      const r = t.r * (cam.F / p.cz) * (t.art === "funke" ? k : 1.4 - 0.4 * k);
      g.globalAlpha = t.art === "funke" ? k : k * 0.8;
      g.fillStyle = t.art === "funke" ? "#ffe9a3" : rgb(P.schneeLicht);
      g.beginPath();
      g.arc(p.sx, p.sy, Math.max(0.6, r), 0, Math.PI * 2);
      g.fill();
    });
    g.globalAlpha = 1;
  }

  // Der Ring einer perfekten Kehre liegt flach auf dem Schnee.
  function zeichneRinge() {
    state.ringe.forEach((ring) => {
      const k = ring.t / 0.6;
      const radius = lerp(8, 46, 1 - (1 - k) * (1 - k));
      g.strokeStyle = `rgba(255, 221, 120, ${0.9 * (1 - k)})`;
      g.lineWidth = Math.max(1, 3 * cam.mass * (1 - k * 0.6));
      g.beginPath();
      for (let i = 0; i <= 24; i += 1) {
        const w = (i / 24) * Math.PI * 2;
        const p = projXYZ(ring.x + Math.cos(w) * radius, KRONE + 1, ring.z + Math.sin(w) * radius);
        if (!p) return;
        if (i === 0) g.moveTo(p.sx, p.sy);
        else g.lineTo(p.sx, p.sy);
      }
      g.stroke();
    });
  }

  // Was über dem Steinbock steht («Perfekt ×3»), läuft mit ihm mit und
  // steigt dabei auf.
  function zeichneSchriften() {
    if (!state.schriften.length) return;
    const b = state.bock;
    const p = projXYZ(b.x, KRONE, b.z);
    if (!p) return;
    const sx = p.sx;
    const sy = p.sy;
    const s = cam.F / p.cz;
    g.textAlign = "center";
    g.textBaseline = "middle";
    state.schriften.forEach((t) => {
      const k = clamp(t.leben / t.max, 0, 1);
      const gross = Math.round(clamp(t.gross * cam.mass, 12, 30));
      g.font = `900 ${gross}px system-ui, sans-serif`;
      const halb = g.measureText(t.text).width / 2 + 8;
      const x = clamp(sx, halb, view.cssW - halb);
      const y = sy - (62 + (1 - k) * 30) * s;
      g.globalAlpha = Math.min(1, k * 2.4);
      g.lineWidth = Math.max(3, gross * 0.22);
      g.strokeStyle = "rgba(26, 20, 60, 0.85)";
      g.strokeText(t.text, x, y);
      g.fillStyle = t.farbe;
      g.fillText(t.text, x, y);
    });
    g.globalAlpha = 1;
  }

  // Nebelfetzen, die nah an der Kamera vorbeiziehen: Tempo, das man sieht.
  // Ein weicher Fleck, einmal gemalt und dann nur noch gestreckt aufgelegt.
  let fetzenBild = null;
  function fetzen() {
    if (fetzenBild) return fetzenBild;
    fetzenBild = document.createElement("canvas");
    fetzenBild.width = 128;
    fetzenBild.height = 64;
    const f = fetzenBild.getContext("2d");
    const verlauf = f.createRadialGradient(64, 32, 0, 64, 32, 64);
    verlauf.addColorStop(0, "rgba(255, 255, 255, 1)");
    verlauf.addColorStop(0.5, "rgba(255, 255, 255, 0.35)");
    verlauf.addColorStop(1, "rgba(255, 255, 255, 0)");
    f.scale(1, 0.5);
    f.fillStyle = verlauf;
    f.fillRect(0, 0, 128, 128);
    return fetzenBild;
  }

  function zeichneFetzen(P) {
    if (ruhig()) return;
    const W = view.cssW;
    const H = view.cssH;
    const tempo = state.schritt === "lauf" ? tempoBei(state.bock.z) : 20;
    const lauf = state.zeit * (0.4 + tempo / 400);
    const bild = fetzen();
    g.globalAlpha = 0.1 + 0.1 * P.sterne;
    for (let i = 0; i < 3; i += 1) {
      const dauer = 5 + hash01(i * 3.3) * 4;
      const t = lauf + hash01(i * 8.1) * dauer;
      const y = lerp(-0.25, 1.25, (t % dauer) / dauer) * H;
      const x = W * hash01(i * 5.5 + Math.floor(t / dauer) * 1.7);
      const breit = W * (0.6 + 0.4 * hash01(i * 2.2));
      const hoch = H * 0.16;
      g.drawImage(bild, x - breit / 2, y - hoch / 2, breit, hoch);
    }
    g.globalAlpha = 1;
  }

  function zeichnen() {
    if (!g) return;
    bildNr += 1;
    const P = state.P;
    const wackel = ruhig() ? 0 : Math.sin(state.zeit * 64) * 4 * state.stoss;
    g.setTransform(view.dpr, 0, 0, view.dpr, 0, wackel * view.dpr);
    g.globalAlpha = 1;
    zeichneHimmel(P);
    zeichneFerne(P);
    // Von hinten nach vorn: die Reihen des Nebelmeers und die Scheiben des
    // Grats, nach ihrer Tiefe gemischt.
    const wolken = reihen();
    const ersteDeckend = wolken.find((r) => r.alpha >= 1);
    zeichneMeer(P, ersteDeckend ? ersteDeckend.sy + BAUSCH * 0.5 * ersteDeckend.kk + 6 : view.cssH);
    const sl = state.scheiben;
    let erste = state.ersteScheibe;
    while (erste < sl.length - 1 && sl[erste].fern.z < cam.z - 40) erste += 1;
    while (erste > 0 && sl[erste - 1].fern.z >= cam.z - 40) erste -= 1;
    state.ersteScheibe = erste;
    let letzte = erste;
    while (letzte < sl.length - 1 && sl[letzte + 1].nah.z < cam.z + SICHT) letzte += 1;
    // Stürzt der Steinbock über die Seite, die von der Kamera wegschaut,
    // verschwindet er hinter dem Grat: Er wird vor seiner Scheibe gemalt.
    const sturz = state.schritt === "sturz" ? state.sturz : null;
    let figurOffen = !(sturz && sturz.hinten);
    let w = 0;
    for (let i = letzte; i >= erste; i -= 1) {
      const scheibe = sl[i];
      while (w < wolken.length && wolken[w].z >= scheibe.nah.z) {
        zeichneReihe(wolken[w], P);
        w += 1;
      }
      if (sturz && sturz.hinten && sturz.scheibe === i) zeichneFigur(P);
      zeichneScheibe(scheibe, P);
      zeichneFaehrte(scheibe, P);
      zeichneZeichen(scheibe.nah, P);
      // Der Felsturm steht auf der Scheibe, in der er beginnt. Ist der
      // Steinbock schon an ihm vorbei, steht der Fels vor ihm: erst er.
      const k = state.kehren[scheibe.nah.seg];
      if (k && k.fels && scheibe.nah.z <= k.fels.z0 && k.fels.z0 < scheibe.fern.z) {
        if (figurOffen && state.bock.z > k.fels.z1) {
          zeichneFigur(P);
          figurOffen = false;
        }
        zeichneFels(k, P);
      }
    }
    while (w < wolken.length) {
      zeichneReihe(wolken[w], P);
      w += 1;
    }

    zeichneSpur(P);
    zeichneRinge();
    zeichneGeister();
    if (figurOffen) zeichneFigur(P);
    zeichneTeile(P);
    zeichneFetzen(P);
    zeichneSchriften();
  }

  // ---------------------------------------------------------------------------
  // Was beim Laufen aufstiebt
  // ---------------------------------------------------------------------------
  function staub(x, z, n, kraft, art = "schnee") {
    if (ruhig()) return;
    for (let i = 0; i < n; i += 1) {
      const w = Math.random() * Math.PI * 2;
      const v = (20 + Math.random() * 60) * kraft;
      const leben = art === "funke" ? 0.5 + Math.random() * 0.4 : 0.35 + Math.random() * 0.35;
      state.teile.push({
        art, x, y: KRONE + 2, z,
        vx: Math.cos(w) * v, vy: (30 + Math.random() * 70) * kraft, vz: Math.sin(w) * v,
        r: art === "funke" ? 2.4 : 2 + Math.random() * 2.4, leben, max: leben,
      });
    }
    if (state.teile.length > 160) state.teile.splice(0, state.teile.length - 160);
  }

  // Es steht immer nur eine da: Die neue ersetzt die alte.
  function schrift(text, farbe, gross) {
    state.schriften = [{ text, farbe, gross, leben: 0.8, max: 0.8 }];
  }

  // ---------------------------------------------------------------------------
  // Laufen, wenden, stürzen
  // ---------------------------------------------------------------------------
  function physik(dt) {
    const b = state.bock;
    const n = Math.max(1, Math.ceil(dt / TAKT - 1e-9));
    const h = dt / n;
    for (let i = 0; i < n && state.schritt === "lauf"; i += 1) {
      const v = tempoBei(b.z);
      const dz = v * h;
      b.z += dz;
      b.x += b.r * dz;
      state.galopp += (dz * 1.4142 / 62) * Math.PI * 2;
      state.seg = segBei(b.z);
      const a = state.kehren[state.seg];
      const daneben = b.x - (a.x + a.s * (b.z - a.z));
      if (Math.abs(daneben) > randBei(b.z) + GNADE) {
        sturz(Math.sign(daneben) || b.r);
        return;
      }
      if (imFels(a, b.z, daneben)) {
        prall();
        return;
      }
      if (v > state.spitze) state.spitze = v;
    }
  }

  // Die Richtung wechselt. Führt der Wechsel auf das nächste Stück, zählt
  // die Kehre – und perfekt ist sie, wenn der Steinbock danach in der Mitte
  // läuft (am Fels: in der Mitte der Gasse). Gemessen wird gegen die Linie des nächsten Stücks, auch vor der
  // Kehre: Ab dem Tipp läuft er zu ihr parallel.
  function wende() {
    const b = state.bock;
    b.r = -b.r;
    kehrenBis(b.z + 400);
    const k = state.kehren[state.naechste];
    const daneben = b.x - (k.x + k.s * (b.z - k.z));
    // Am Fels zählt die Kehre auf der ganzen Breite des Stücks – und perfekt
    // ist sie, wenn er danach mitten in der Gasse läuft (ziel).
    if (b.r === k.s && Math.abs(daneben) <= k.hw + GNADE) {
      const perfekt = Math.abs(daneben - k.ziel) <= perfektBei(k.z);
      state.naechste += 1;
      state.genommen += 1;
      let plus = 1;
      if (perfekt) {
        state.reihe += 1;
        state.perfekte += 1;
        plus = state.reihe >= 2 ? 3 : 2;
      } else {
        state.reihe = 0;
      }
      state.punkte += plus;
      shell.setCount(state.punkte);
      if (perfekt) {
        klang()?.ton?.("gratwanderung.perfekt", { hoehe: 1 + Math.min(6, state.reihe - 1) * 0.06 });
        staub(b.x, b.z, 10, 1.1, "funke");
        state.ringe.push({ x: b.x, z: b.z, t: 0 });
        schrift(state.reihe >= 2 ? `Perfekt ×${state.reihe}` : "Perfekt", "#ffe08a", 16);
        kids()?.vibrate?.(10);
      } else {
        klang()?.ton?.("gratwanderung.kehre");
      }
    } else {
      klang()?.ton?.("gratwanderung.kehre", { laut: 0.6 });
    }
    // Schnee stiebt nach aussen weg, und der Steinbock macht einen Satz.
    staub(b.x - b.r * 6, b.z, 7, 0.9);
    state.sprung = 1;
  }

  function sturz(seite, nurBild = false) {
    if (state.schritt === "sturz") return;
    const b = state.bock;
    const v = tempoBei(b.z);
    state.schritt = "sturz";
    // Die Seite, die von der Kamera wegschaut: die, auf die das Stück zuläuft.
    const a = state.kehren[state.seg];
    let scheibe = state.ersteScheibe || 0;
    const sl = state.scheiben;
    while (scheibe < sl.length - 1 && sl[scheibe].fern.z < b.z) scheibe += 1;
    state.sturz = { seite, vx: seite * v * 0.55, vy: 40, vz: v * 0.45, dreh: 0, drehV: seite * (5 + Math.random() * 3), hinten: seite === a.s, scheibe, zeit: 0 };
    state.stoss = 1;
    klangAus();
    klang()?.ton?.("gratwanderung.sturz");
    klang()?.ton?.("gratwanderung.fall", { verzoegerung: 0.12 });
    kids()?.vibrate?.([30, 40, 60]);
    staub(b.x, b.z, 18, 1.4);
    if (nurBild) return;
    stepTimer = window.setTimeout(finish, ruhig() ? 500 : STURZ_MS);
  }

  // In den Fels gerannt: Er prallt zurück, überschlägt sich und bleibt im
  // Schnee liegen.
  function prall(nurBild = false) {
    if (state.schritt === "sturz") return;
    const b = state.bock;
    const v = tempoBei(b.z);
    const dreh = -b.r * (7 + Math.random() * 3);
    state.schritt = "sturz";
    state.sturz = { art: "prall", seite: b.r, vx: -b.r * v * 0.3, vy: 150, vz: -v * 0.3, dreh: 0, drehV: dreh, ruhe: 0, liegt: false, hinten: false, scheibe: 0, zeit: 0 };
    state.stoss = 1;
    klangAus();
    klang()?.ton?.("gratwanderung.sturz");
    kids()?.vibrate?.([30, 40, 60]);
    staub(b.x + b.r * 8, b.z + 8, 16, 1.2);
    if (nurBild) return;
    stepTimer = window.setTimeout(finish, ruhig() ? 500 : STURZ_MS);
  }

  function sturzTakt(dt) {
    const f = state.sturz;
    const b = state.bock;
    if (!f) return;
    if (f.art === "prall") {
      f.zeit += dt;
      if (f.liegt) {
        f.dreh += (f.ruhe - f.dreh) * (1 - Math.exp(-12 * dt));
        return;
      }
      f.vy -= 900 * dt;
      b.x += f.vx * dt;
      b.z += f.vz * dt;
      b.y += f.vy * dt;
      f.dreh += f.drehV * dt;
      if (b.y <= 0 && f.vy < 0) {
        b.y = 0;
        if (f.vy < -120) {
          f.vy *= -0.32;
          f.vx *= 0.5;
          f.vz *= 0.5;
          f.drehV *= 0.5;
          staub(b.x, b.z, 6, 0.7);
        } else {
          // Auf der Seite, in der Richtung, in die er sich gerade dreht.
          const seite = Math.sign(f.drehV) || 1;
          f.liegt = true;
          f.ruhe = Math.round((f.dreh - seite * 1.5) / (Math.PI * 2)) * Math.PI * 2 + seite * 1.5;
        }
      }
      return;
    }
    f.zeit += dt;
    f.vy -= 900 * dt;
    f.vx *= 1 - 0.8 * dt;
    f.vz *= 1 - 1.6 * dt;
    b.x += f.vx * dt;
    b.y += f.vy * dt;
    b.z += f.vz * dt;
    f.dreh += f.drehV * dt;
    if (!ruhig() && b.y > -WOLKE * 0.5 && Math.random() < dt * 40) staub(b.x, b.z, 1, 0.5);
  }

  // Der Tipp – zu der Zeit, zu der er geschah (jetzt, wie performance.now).
  function tippen(jetzt) {
    if (state.phase === "zuschauen" || state.phase === "ende") return;
    if (state.phase === "bereit") {
      losGehts();
      return;
    }
    if (state.phase !== "spiel" || state.schritt !== "lauf") return;
    if (Number.isFinite(jetzt) && last) {
      const mehr = clamp((jetzt - last) / 1000 - voraus, 0, 0.05);
      if (mehr > 0) {
        physik(mehr);
        voraus += mehr;
      }
      if (state.schritt !== "lauf") return;
    }
    wende();
  }

  // ---------------------------------------------------------------------------
  // Zuschauen
  // ---------------------------------------------------------------------------
  // Ein aufgezeichneter Lauf über seinen eigenen Grat: Der Zufall hält die
  // Saat (geist.js, zuschauer), startRun steckt damit denselben Grat, und der
  // Steinbock steht Bild für Bild dort, wo er damals war.
  function zuschauenStarten() {
    if (!zuschauer?.lauf) return;
    startRun();
    state.phase = "zuschauen";
    state.schritt = "lauf";
    state.blick = 1;
    shell.setPhase("play");
    zuschauer.los();
    klangAn();
  }

  function zuschauenTakt(dt) {
    const s = zuschauer.stand();
    if (!s) return;
    const b = state.bock;
    if (state.schritt === "lauf") {
      const weg = Math.hypot(s.a - b.x, s.b - b.z);
      const r = (s.c & 1) ? 1 : -1;
      if (r !== b.r && weg < 200) staub(b.x, b.z, 6, 0.9);
      b.x = s.a;
      b.z = s.b;
      b.r = r;
      b.y = 0;
      state.galopp += (weg / 62) * Math.PI * 2;
      state.seg = segBei(b.z);
      const punkte = Math.max(0, Math.floor(s.punkte));
      if (punkte !== state.punkte) {
        state.punkte = punkte;
        shell.setCount(punkte);
      }
      klangStellen();
    }
    // Am Ende des Laufs stürzt er, wie er damals gestürzt ist.
    if (!zuschauer.weiter() && state.schritt === "lauf") {
      const daneben = b.x - mitteBei(b.z);
      // Aufgezeichnet ist nur alle paar Bilder ein Ort: Der letzte liegt
      // bis zu einer Viertelsekunde vor dem Fels, in den er gerannt ist.
      const f = state.kehren[state.seg].fels;
      if (f && daneben * f.seite > f.rand - 6 && b.z <= f.z1 && b.z + tempoBei(b.z) * 0.25 >= f.z0) prall(true);
      else if (Math.abs(daneben) > randBei(b.z) * 0.6) sturz(Math.sign(daneben) || b.r, true);
      else { state.schritt = "start"; klangAus(); }
    }
    if (state.schritt === "sturz") sturzTakt(dt);
  }

  // ---------------------------------------------------------------------------
  // Der Takt
  // ---------------------------------------------------------------------------
  // strecke: wie viel davon noch zu laufen ist – ein Tipp hat vielleicht
  // schon ein Stück vorausgerechnet (tippen).
  function takt(dt, strecke = dt) {
    state.zeit += dt;
    const b = state.bock;
    if (state.stoss > 0) state.stoss = Math.max(0, state.stoss - dt * 3.2);

    if (state.phase === "zuschauen") {
      zuschauenTakt(dt);
    } else if (state.schritt === "lauf") {
      if (strecke > 0) physik(strecke);
      const meter = Math.floor(meterBei(b.z));
      if (meter !== state.meter) state.meter = meter;
      klangStellen();
    } else if (state.schritt === "sturz") {
      sturzTakt(dt);
    }

    if (state.schritt === "lauf") {
      // Die Spur im Schnee: alle paar Schritte ein Abdruck.
      state.spurWeg += tempoBei(b.z) * dt;
      if (state.spurWeg > 15) {
        state.spurWeg = 0;
        state.spur.push({ x: b.x + (state.spur.length % 2 ? 3 : -3), z: b.z });
        if (state.spur.length > 34) state.spur.shift();
        if (!ruhig() && Math.random() < 0.6) staub(b.x - b.r * 4, b.z - 6, 1, 0.45);
      }
    }

    // Die Figur klappt in ihre neue Richtung um – schnell, aber nicht im
    // selben Bild. Dazu ein kleiner Satz bei jeder Kehre.
    if (state.schritt !== "sturz") {
      state.dreh += (b.r - state.dreh) * (1 - Math.exp(-(ruhig() ? 200 : 26) * dt));
      if (Math.abs(b.r - state.dreh) < 0.01) state.dreh = b.r;
    }
    if (state.sprung > 0) state.sprung = Math.max(0, state.sprung - dt * 5.5);

    for (let i = state.teile.length - 1; i >= 0; i -= 1) {
      const t = state.teile[i];
      t.vy -= (t.art === "funke" ? 160 : 260) * dt;
      t.x += t.vx * dt;
      t.y += t.vy * dt;
      t.z += t.vz * dt;
      t.leben -= dt;
      if (t.leben <= 0) state.teile.splice(i, 1);
    }
    for (let i = state.ringe.length - 1; i >= 0; i -= 1) {
      state.ringe[i].t += dt;
      if (state.ringe[i].t > 0.6) state.ringe.splice(i, 1);
    }
    for (let i = state.schriften.length - 1; i >= 0; i -= 1) {
      state.schriften[i].leben -= dt;
      if (state.schriften[i].leben <= 0) state.schriften.splice(i, 1);
    }

    // Die Kamera: steigt mit dem Start auf, folgt dem Steinbock und bleibt
    // beim Sturz stehen.
    // blickFest: für die Bilder der Startseite – die Kamera bleibt, wo die
    // Vorführung sie haben will.
    const blickZiel = state.blickFest ?? (state.phase === "bereit" ? 0 : 1);
    state.blick += (blickZiel - state.blick) * (1 - Math.exp(-(ruhig() ? 40 : 3.2) * dt));
    if (Math.abs(blickZiel - state.blick) < 0.002) state.blick = blickZiel;
    kameraStellen();
    if (state.schritt !== "sturz") {
      cam.z = b.z - cam.abstand;
      cam.x += (kameraZiel() - cam.x) * (1 - Math.exp(-(state.phase === "bereit" ? 30 : 4.5) * dt));
    }
    kehrenBis(cam.z + SICHT + 200);
    state.P = farbenBei(state.schritt === "sturz" && state.sturz ? b.z : Math.max(0, b.z));

    if (state.phase === "spiel") {
      gegner?.takt(state.punkte, { a: Math.round(b.x), b: Math.round(b.z), c: b.r > 0 ? 1 : 0 });
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

  // Die Runde beginnt: mit dem ersten Tipp – oder im Live-Modus zum
  // gemeinsamen Start (game-shell.js, live.los).
  function losGehts() {
    if (state.phase !== "bereit") return;
    state.phase = "spiel";
    state.schritt = "lauf";
    shell.setPhase("play");
    gegner?.los();
    klangAn();
    kids()?.vibrate?.(8);
    staub(state.bock.x, state.bock.z, 8, 1);
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
    state.genommen = 0;
    state.perfekte = 0;
    state.reihe = 0;
    state.meter = 0;
    state.spitze = 0;
    state.seg = 0;
    state.naechste = 1;
    state.sturz = null;
    state.spur = [];
    state.spurWeg = 0;
    state.teile = [];
    state.ringe = [];
    state.schriften = [];
    state.zeit = 0;
    state.blick = 0;
    state.stoss = 0;
    state.galopp = 0;
    state.sprung = 0;
    state.ersteScheibe = 0;
    grateNeu();
    state.bock = { x: 0, y: 0, z: 0, r: state.kehren[0].s };
    // Das Gipfelkreuz steht ein paar Schritte vor dem Start am Rand.
    state.kreuzBei = state.stationen.reduce((best, st) => (Math.abs(st.z - 110) < Math.abs(state.stationen[best].z - 110) ? st.i : best), 0);
    state.P = ZEITEN[0];
    voraus = 0;
    shell.setCount(0);
    gegner?.runde();

    shell.clear();
    const prompt = shell.el("p", "cm-prompt gw-prompt", "Tippen – Richtung wechseln. Bleib auf dem Grat!");
    shell.play.append(prompt, buildPlatz());
    view.cssW = 0;
    view.cssH = 0;
    messen();
    kameraStellen();
    cam.x = 0;
    cam.z = -cam.abstand;
    state.dreh = state.bock.r;

    last = performance.now();
    frame = window.requestAnimationFrame(loop);
  }

  function zaehleHoch(ziel) {
    const zahl = host.querySelector(".cm-result-score");
    if (!zahl) return;
    if (ruhig() || ziel <= 1) { zahl.textContent = String(ziel); return; }
    const dauer = Math.min(800, 160 + ziel * 8);
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
    const kehren = `${state.genommen} ${state.genommen === 1 ? "Kehre" : "Kehren"}`;
    const woraus = `${kehren} · ${state.perfekte} perfekt · ${state.meter} m`;
    shell.showResult({
      label: "Deine Punkte",
      points: punkte,
      detail: rekord ? "Neuer Rekord!" : woraus,
      geist,
    });
    if (rekord) host.querySelector(".cm-result-detail")?.classList.add("gw-rekord");
    zaehleHoch(punkte);
  }

  // ---------------------------------------------------------------------------
  // Start
  // ---------------------------------------------------------------------------
  shell = shellApi.mount({
    host,
    title: "Gratwanderung",
    area: "geschwindigkeit",
    accent: "#F5A623",
    accentDark: "#b9741a",
    clock: false,
    onRestart: () => (zuschauer ? zuschauenStarten() : startRun()),
    live: { los: losGehts, stopp: () => finish(), zuschauen: (quelle) => { zuschauer = quelle; zuschauenStarten(); } },
  });
  zuschauer = window.LernappGeist?.zuschauer?.({
    host, spiel: "ridgeRun", fassung: "t2", zufall, einheit: "Punkte", nochmal: zuschauenStarten,
  }) || null;
  if (!zuschauer) {
    gegner = window.LernappGeist?.fuer?.({ spiel: "ridgeRun", host, art: "tempo", fassung: "t2", alle: true, zufall }) || null;
  }

  startRun();
  zuschauer?.laden.then((da) => { if (da) zuschauenStarten(); });

  // Ein Tipp irgendwo aufs Bild wechselt die Richtung. Nur Knöpfe bleiben
  // Knöpfe.
  host.addEventListener("pointerdown", (event) => {
    if (event.target.closest("button, a, input")) return;
    // Die Zeit des Tipps, wenn sie zur Uhr des Bildes passt.
    const t = Math.abs(performance.now() - event.timeStamp) < 250 ? event.timeStamp : performance.now();
    tippen(t);
  });

  // Leertaste, Enter oder ein Pfeil. Steht der Fokus auf einem Knopf, gilt
  // die Taste dem Knopf.
  const TASTEN = new Set([" ", "Enter", "ArrowLeft", "ArrowRight", "ArrowUp"]);
  document.addEventListener("keydown", (event) => {
    if (!TASTEN.has(event.key)) return;
    if (document.activeElement?.tagName === "BUTTON") return;
    event.preventDefault();
    if (event.repeat) return;
    tippen(performance.now());
  });

  window.addEventListener("resize", messen);
  window.addEventListener("orientationchange", messen);
  window.addEventListener("pagehide", () => { clearStep(); stopLoop(); klangAus(); });

  // Für die Prüfskripte und die Vorführung.
  window.LernappGratwanderung = {
    METER, ERSTE, V0, V_MAX, HALB0, HALB_MIN, GNADE, state, view, cam,
    takt, tippen, losGehts, physik, kehrenBis, mitteBei, halbBei, randBei, tempoBei, perfektBei, kursText, farbenBei, FELS_JE,
  };
})();
