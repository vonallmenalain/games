/*
 * slalom.js – Slalom.
 * ---------------------------------------------------------------------------
 * Ein Skifahrer jagt die Piste hinunter, Tor um Tor. Gelenkt wird mit zwei
 * Knöpfen: Wer links aufs Bild hält, carvt nach links, wer rechts hält, nach
 * rechts (am Rechner Pfeil links und rechts). Ohne Finger bleibt die Kante,
 * wie sie ist, und der Fahrer fährt in seiner Richtung weiter. Die Richtung
 * ändert sich dabei nie schlagartig, sondern mit dem Zug einer Kante im
 * Schnee – wer zu spät umsteigt, kommt am Tor vorbei.
 *
 * Jedes Tor sind zwei Stangen, rot und blau im Wechsel. Wer zwischen ihnen
 * durchfährt, hat es; wer eines auslässt, eine Stange mitnimmt oder in den
 * Wald am Pistenrand fährt, stürzt – und die Runde ist vorbei. Jedes Tor
 * gibt einen Punkt. Wer knapp an der inneren Stange vorbeizieht, fährt die
 * kürzere Linie: «perfekt», ein kleiner Schub – und mehr Punkte: das erste
 * perfekte Tor zwei, jedes weitere in Folge drei, bis ein Tor nicht perfekt
 * ist; dann gibt es wieder einen. Auf der Tafel steht, woraus die Zahl
 * besteht: Tore plus Bonus.
 *
 * Das Tempo hängt an der Richtung: Geradeaus die Falllinie hinunter wird der
 * Fahrer schnell, quer zum Hang bremst er. Die enge, direkte Linie ist also
 * nicht nur die sichere, sondern auch die schnelle – und nach hinten wird es
 * ohnehin schneller, die Tore schmaler und weiter versetzt.
 *
 * Gesteckt wird der Kurs aus dem Zufall (zufall.js): ohne Turnier jedes Mal
 * ein anderer, im Turnier für alle im selben Versuch derselbe. Er ist immer
 * fahrbar. Wie weit zwei Tore auseinanderliegen, folgt aus ihrem Versatz und
 * dem Tempo an dieser Stelle: Die Kurve, die sie verlangen, ist nie enger,
 * als der Fahrer sie dort carven kann, und nie steiler, als er quer fahren
 * kann (wie der Tunnel in tunnelflug.js).
 *
 * Die Gegner (geist.js) fahren als farbige Schatten mit – so, wie sie in
 * ihrer besten Runde gefahren sind, durch ihren eigenen Kurs. Platz 1 und die
 * eigene Bestmarke hängen dazu als Banner quer über der Piste, hinter ihrem
 * letzten Tor. Und die besten Läufe lassen sich anschauen (?zuschauen=,
 * geist.js): durch ihren eigenen Kurs, gesteckt mit derselben Saat.
 *
 * Unterwegs wandert der Tag: Morgensonne, heller Mittag, Alpenglühen, und
 * nach gut einem halben Kilometer fährt man unter Flutlicht in die Nacht.
 *
 * Gerechnet wird in Welteinheiten, zehn sind ein Meter. x zählt nach rechts,
 * y den Hang hinunter – im Bild nach unten. Die Richtung des Fahrers ist der
 * Winkel zur Falllinie: null geradeaus hinunter, positiv nach rechts.
 */
(() => {
  "use strict";

  if (document.body.dataset.page !== "slalom") return;

  const host = document.querySelector("#sk-stage");
  const shellApi = window.LernappGameShell;
  const cloudApi = window.LernappGameCloud;
  if (!host || !shellApi) return;

  const kids = () => window.LernappKids || null;
  const ruhig = () => Boolean(kids()?.prefersReducedMotion?.());
  const klang = () => window.ArcadeKlang || null;

  // Der Zufall. Nur der Kurs zieht daraus – die Tore und der Schwung der
  // Piste. Bäume, Glitzern, Pulverschnee und Wolken hängen an festen Zahlen
  // oder an Math.random, damit der Kurs nicht davon abhängt, wie jemand fährt.
  const zufall = window.LernappZufall?.fuer?.("skiSlalom") || {
    neu() {},
    zahl: () => Math.random(),
  };

  // ---------------------------------------------------------------------------
  // Die Welt
  // ---------------------------------------------------------------------------
  const METER = 10;
  const MIN_W = 310;               // so viel Welt ist mindestens zu sehen, quer …
  const MIN_H = 380;               // … und den Hang hinunter
  const FAHRER_AN = [0.27, 0.17];  // so weit unter dem oberen Rand fährt er – langsam, schnell
  const PISTE_HALB = 140;          // halbe Breite der Piste; dahinter Wald
  const ERSTES_TOR = 280;          // hier steht das erste Tor
  const HOEHE_K = 0.55;            // wie stark Höhe im Bild nach oben zeigt
  const FIGUR = 1.45;              // der Fahrer wird grösser gezeichnet, als er trifft
  const START = { x: 0, y: 0 };

  // Der Fahrer. Die Drehrate ist das Können: so schnell schwenkt die Kante
  // um, in Bogenmass je Sekunde. Umgestiegen wird nicht schlagartig, sondern
  // in DREH_TAU – das ist das Carving-Gefühl.
  const DREH_TAU = 0.07;
  const PHI_MAX = 1.25;            // quer zum Hang (gut 70°) dreht er nicht weiter
  const ANZUG = 1.3;               // so schnell nähert sich das Tempo seinem Ziel
  const V_MIN = 45;
  const STOSS_PERFEKT = 16;        // der kleine Schub einer perfekten Linie
  // Was ein Tor wert ist: eins, perfekt zwei, perfekt in Folge drei.
  const wertDesTors = (perfekt, reihe) => (!perfekt ? 1 : reihe >= 2 ? 3 : 2);
  const TAKT = 1 / 240;            // gerechnet wird in festen kleinen Schritten
  const R_FAHRER = 3.4;            // so breit trifft er (halbe Breite)
  const R_STANGE = 1.5;

  // Tempo, Drehrate und Tore nach der Strecke: am Anfang breite Tore und
  // gemächlich, nach einem Kilometer schnell und eng.
  const V0 = 150;
  const V_MAX = 360;
  const V_WEG = 700;               // Meter, nach denen gut sechs Zehntel des Zuwachses da sind

  const TOP_COUNT = 5;
  const store = cloudApi
    ? cloudApi.register({ key: "lernapp.slalom", empty: { runs: 0, scores: [] }, merge: cloudApi.mergeScores(TOP_COUNT) })
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
  const meterBei = (y) => Math.max(0, (y - START.y) / METER);
  const tempoBei = (y) => V0 + (V_MAX - V0) * (1 - Math.exp(-meterBei(y) / V_WEG));
  // Wie viel der Kurs an dieser Stelle verlangt: anfangs wenig, nach hinten
  // immer mehr – nie alles.
  const schwereBei = (y) => 1 - Math.exp(-meterBei(y) / 750);
  const drehBei = (y) => lerp(2.9, 3.4, schwereBei(y));

  // Immer dieselbe Zahl zu derselben Eingabe: Bäume, Glitzern und Lichter
  // stehen bei jedem Bild am selben Platz, ohne den Zufall des Kurses
  // anzufassen.
  function hash01(n) {
    const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return x - Math.floor(x);
  }

  // ---------------------------------------------------------------------------
  // Zustand
  // ---------------------------------------------------------------------------
  // phase:   "bereit" (noch nichts gedrückt), "spiel", "zuschauen", "ende"
  // schritt: "start", "fahrt", "sturz"
  const state = {
    phase: "bereit",
    schritt: "start",
    punkte: 0,            // Tore plus Bonus
    tore: 0,
    bonus: 0,             // was perfekte Tore mehr gebracht haben
    perfekte: 0,
    reihe: 0,             // perfekte Tore in Folge
    spitze: 0,
    sk: { x: START.x, y: START.y, phi: 0, w: 0, v: 0 },
    kurs: { tore: [], seite: 1, vertikale: 0, pause: 0, wellen: [0, 0] },
    spur: { l: [], r: [], weg: 0 },
    schal: [],
    teile: [],            // Pulverschnee
    truemmer: [],         // was beim Sturz davonfliegt
    ringe: [],            // die Druckwelle im Schnee beim Sturz
    flocken: [],          // Schneeflocken zwischen Kamera und Hang
    schriften: [],
    striche: [],
    camX: 0,
    camY: 0,
    stoss: 0,
    zeit: 0,
    losZeit: 0,
    zeitlupe: 0,
    sturz: null,
    tumble: 0,
    lean: 0,
    sprayRest: 0,
  };

  let shell = null;
  let feld = null;
  let canvas = null;
  let g = null;
  let frame = null;
  let last = 0;
  let stepTimer = null;
  // Wohin gelenkt wird: -1 links, 0 gar nicht, 1 rechts. Dazu die Finger (und
  // Tasten), die gerade aufliegen – liegen zwei auf, gilt der zuletzt
  // gekommene.
  let lenkung = 0;
  const finger = [];
  let knoepfe = null;
  // Die Gegner (geist.js): wer als Schatten mitfährt und als Banner über der
  // Piste hängt.
  let gegner = null;
  // Wer einen Lauf anschaut statt zu fahren (geist.js, zuschauer).
  let zuschauer = null;

  const view = { s: 1, dpr: 1, cssW: 0, cssH: 0, w: MIN_W, h: MIN_H, nutz: MIN_H, frei: 0, freiPx: 0 };

  function clearStep() {
    if (stepTimer) { window.clearTimeout(stepTimer); stepTimer = null; }
  }

  function stopLoop() {
    if (frame) { window.cancelAnimationFrame(frame); frame = null; }
  }

  // ---------------------------------------------------------------------------
  // Klänge (klang.js)
  // ---------------------------------------------------------------------------
  // Die Kanten im Schnee laufen als Kulisse, solange er fährt – beim Spielen
  // wie beim Zuschauen. Ihr Tempo ist seins, laut wird sie in der Kurve.
  let carven = null;
  function carvenAn() {
    if (!carven?.laeuft) carven = klang()?.kulisse("slalom.carven") || null;
  }
  function carvenAus() {
    carven?.stop();
    carven = null;
  }
  // Nachgestellt wird höchstens alle 40 ms: Die Kulisse gleitet ohnehin
  // weich, und die Prüfskripte rechnen tausende Bilder am Stück.
  let carvenGestellt = -1e9;
  function carvenStellen() {
    if (!carven?.laeuft) return;
    const jetzt = performance.now();
    if (jetzt - carvenGestellt < 40) return;
    carvenGestellt = jetzt;
    const sk = state.sk;
    carven.setze(clamp((sk.v - V_MIN) / (V_MAX - V_MIN), 0, 1));
    carven.laut(0.45 + 0.75 * clamp(Math.abs(sk.w) / drehBei(sk.y), 0, 1));
  }
  // Tore können in einer Vertikalen dicht kommen – und die Prüfskripte
  // rechnen viele Bilder auf einmal: ein Klack höchstens alle 60 ms.
  let torKlack = -1e9;

  // ---------------------------------------------------------------------------
  // Der Kurs
  // ---------------------------------------------------------------------------
  /*
   * Die Piste schwingt sanft (zwei langsame Wellen, deren Lage die Saat
   * bestimmt – höchstens ein Fünftel Seitenneigung); um ihre Mitte stehen
   * die Tore abwechselnd links und rechts, um den Ausschlag A versetzt.
   *
   * Zwischen zwei Toren fährt der Fahrer also eine halbe Welle: vom einen
   * Ausschlag zum anderen über die Strecke D. Zwei Dinge darf sie nicht
   * verlangen: schneller umlenken, als er kann (die Krümmung A·π²/D² mal dem
   * Tempo ist eine Drehrate – höchstens ein Teil seiner eigenen), und
   * steiler queren, als er kann (π·A/D ist die Steigung – höchstens die
   * eines Winkels unter seinem Anschlag). Daraus folgt das kleinste D; der
   * Zufall legt etwas darauf. Nach hinten nimmt beides zu, nie bis ans Ende.
   *
   * Ab und zu eine Vertikale: drei, vier Tore kurz hintereinander, kaum
   * versetzt – schnelle kleine Schwünge.
   */
  function pisteBei(y) {
    const [p1, p2] = state.kurs.wellen;
    const an = clamp((y - 200) / 700, 0, 1);
    return START.x + an * (55 * Math.sin(y / 650 + p1) + 30 * Math.sin(y / 290 + p2));
  }

  function neuesTor() {
    const k = state.kurs;
    const vorher = k.tore[k.tore.length - 1];
    const y0 = vorher ? vorher.y : START.y;
    const schwer = schwereBei(y0);
    const v = tempoBei(y0 + 120) * 0.95;
    const dreh = drehBei(y0);
    const teil = lerp(0.55, 0.68, schwer);           // so viel der Drehrate verlangt eine Kurve
    const quer = lerp(0.62, 0.90, schwer);           // so steil quert sie höchstens
    const nr = k.tore.length;

    // Eine Vertikale beginnt nur nach dem zwölften Tor, und nach einer kommen
    // erst wieder ein paar gewöhnliche.
    if (!k.vertikale && !k.pause && nr > 12 && zufall.zahl() < lerp(0.06, 0.18, schwer)) k.vertikale = 3 + (zufall.zahl() < 0.4 ? 1 : 0);
    const vertikal = k.vertikale > 0;
    if (vertikal) {
      k.vertikale -= 1;
      if (!k.vertikale) k.pause = 5;
    } else if (k.pause) k.pause -= 1;

    const A = vertikal
      ? lerp(10, 16, schwer) * lerp(0.8, 1, zufall.zahl())
      : lerp(40, 72, schwer) * lerp(0.75, 1, zufall.zahl());
    const dMin = vertikal ? lerp(80, 66, schwer) : lerp(110, 90, schwer);
    const D = nr === 0
      ? ERSTES_TOR
      : Math.max(dMin, Math.sqrt((v * A * Math.PI * Math.PI) / (dreh * teil)), (Math.PI * A) / Math.tan(quer)) * lerp(1, 1.25, zufall.zahl());
    const y = y0 + D;
    const breite = lerp(72, 36, schwer) * lerp(0.92, 1.08, zufall.zahl());
    const seite = nr === 0 ? (zufall.zahl() < 0.5 ? -1 : 1) : -k.seite;
    k.seite = seite;
    const mitte = pisteBei(y) + seite * A + (zufall.zahl() - 0.5) * A * 0.35;
    // Die Stangen bleiben auf der Piste – mit Platz für den Bogen dahinter.
    const halb = breite / 2;
    const x = clamp(mitte, pisteBei(y) - PISTE_HALB + halb + 30, pisteBei(y) + PISTE_HALB - halb - 30);
    k.tore.push({
      nr,
      y,
      x,
      breite,
      rot: nr % 2 === 0,
      // Die innere Stange: die, die näher an der Mitte der Piste steht – dort
      // vorbei ist die Linie am kürzesten.
      innen: x > pisteBei(y) ? -1 : 1,
      zustand: "offen",   // "durch", "perfekt", "verpasst", "getroffen"
      wackel: [0, 0],
      blink: 0,
    });
  }

  function toreBis(y) {
    const t = state.kurs.tore;
    while (!t.length || t[t.length - 1].y < y) neuesTor();
  }

  function toreBisNr(n) {
    const t = state.kurs.tore;
    while (t.length <= n) neuesTor();
  }

  // Die Stangen eines Tores: links und rechts.
  const stangeL = (t) => t.x - t.breite / 2;
  const stangeR = (t) => t.x + t.breite / 2;

  // ---------------------------------------------------------------------------
  // Die Fläche
  // ---------------------------------------------------------------------------
  function buildPlatz() {
    const platz = shell.el("div", "sk-platz");
    feld = shell.el("div", "sk-feld");
    canvas = document.createElement("canvas");
    canvas.className = "sk-canvas";
    canvas.setAttribute("aria-hidden", "true");
    feld.append(canvas);
    g = canvas.getContext("2d");

    // Die zwei Knöpfe unten links und rechts. Gedrückt wird die ganze Hälfte
    // des Bildes – die Knöpfe zeigen nur, wo, und leuchten, solange ein
    // Finger darauf liegt. Vor dem ersten Druck pulsieren sie.
    knoepfe = shell.el("div", "sk-tipp");
    knoepfe.setAttribute("aria-hidden", "true");
    const ns = "http://www.w3.org/2000/svg";
    [-1, 1].forEach((seite) => {
      const knopf = shell.el("span", `sk-knopf ${seite < 0 ? "sk-knopf-l" : "sk-knopf-r"}`);
      const svg = document.createElementNS(ns, "svg");
      svg.setAttribute("viewBox", "0 0 24 24");
      const pfeil = document.createElementNS(ns, "path");
      pfeil.setAttribute("d", seite < 0 ? "M14.5 5.5 8 12l6.5 6.5" : "M9.5 5.5 16 12l-6.5 6.5");
      pfeil.setAttribute("fill", "none");
      pfeil.setAttribute("stroke", "currentColor");
      pfeil.setAttribute("stroke-width", "3");
      pfeil.setAttribute("stroke-linecap", "round");
      pfeil.setAttribute("stroke-linejoin", "round");
      svg.append(pfeil);
      knopf.append(svg);
      knoepfe.append(knopf);
    });
    feld.append(knoepfe);
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
    if (cssW === view.cssW && cssH === view.cssH && dpr === view.dpr && frei === view.freiPx) return;
    view.cssW = cssW;
    view.cssH = cssH;
    view.dpr = dpr;
    view.freiPx = frei;
    const nutzH = cssH - frei;
    // Hochkant entscheidet die Breite, quer die Länge den Hang hinunter:
    // So sieht man immer genug voraus, und auf breiten Bildern mehr Wald.
    view.s = Math.min(cssW / MIN_W, nutzH / MIN_H);
    view.w = cssW / view.s;
    view.h = cssH / view.s;
    view.nutz = nutzH / view.s;
    view.frei = frei / view.s;
    const pw = Math.round(cssW * dpr);
    const ph = Math.round(cssH * dpr);
    if (canvas.width !== pw) canvas.width = pw;
    if (canvas.height !== ph) canvas.height = ph;
    baueBilder();
  }

  // Je schneller, desto höher steht der Fahrer im Bild: So bleibt vor ihm
  // genug Hang, um das nächste Tor zu sehen.
  const camYZiel = () => {
    const schnell = clamp((tempoBei(state.sk.y) - V0) / (V_MAX - V0), 0, 1);
    return state.sk.y - view.frei - view.nutz * lerp(FAHRER_AN[0], FAHRER_AN[1], schnell);
  };
  // Quer folgt die Kamera halb dem Fahrer, halb der Piste voraus: So steht
  // die Piste meist mittig, und der Fahrer fällt nie aus dem Bild.
  const camXZiel = () => {
    const sk = state.sk;
    const vor = pisteBei(sk.y + view.nutz * 0.4);
    const mitte = view.w >= PISTE_HALB * 2 + 60 ? lerp(vor, sk.x, 0.25) : lerp(vor, sk.x, 0.6);
    return mitte - view.w / 2;
  };

  const wackelX = () => (ruhig() ? 0 : Math.sin(state.zeit * 61) * 6 * state.stoss * state.stoss);
  const wackelY = () => (ruhig() ? 0 : Math.cos(state.zeit * 47) * 6 * state.stoss * state.stoss);

  // Weltkoordinaten (x rechts, y den Hang hinunter) auf die Leinwand.
  // Die Kamera springt in ganzen Bildpunkten: So liegen Schnee und Bäume
  // genau auf dem Raster und werden nur kopiert, nicht umgerechnet.
  const kamera = { x: 0, y: 0 };
  function welt() {
    const f = view.s * view.dpr;
    kamera.x = Math.round((-state.camX * view.s + wackelX()) * view.dpr);
    kamera.y = Math.round((-state.camY * view.s + wackelY()) * view.dpr);
    g.setTransform(f, 0, 0, f, kamera.x, kamera.y);
  }

  function bildschirm() {
    g.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
  }

  const bildX = (x) => (x - state.camX) * view.s;
  const bildY = (y) => (y - state.camY) * view.s;

  // ---------------------------------------------------------------------------
  // Vorgezeichnet: Schnee, Bäume, Licht, Pulver
  // ---------------------------------------------------------------------------
  /*
   * Was in jedem Bild gleich aussieht, wird einmal gemalt und dann nur noch
   * kopiert – das hält die Piste auch auf einem Handy bei sechzig Bildern:
   *
   *   pulver-  eine Kachel Tiefschnee neben der Piste, nahtlos: Buckel mit
   *   schnee   bläulichem Schatten und sonniger Kuppe, feine Körnung
   *   cord     eine Kachel präparierte Piste: die Bahnen der Pistenraupe mit
   *            ihren feinen Rippen, alte Spuren, Körnung
   *            (beide in der Auflösung der Leinwand – ein Bildpunkt der
   *            Kachel ist ein Bildpunkt auf dem Schirm)
   *   baeume   neun Tannen von oben, mit Schneehauben und Schatten
   *   licht    ein weicher Lichtkegel (Flutlicht, Stirnlampe)
   *   pulver   ein Flöckchen Pulverschnee, weiss und als Schatten – im Licht
   *            des Tages getönt (pulverIm)
   *   wolke    ein weicher Wolkenschatten
   *   flocke   eine Schneeflocke nah an der Kamera
   *
   * Daraus entstehen die Streifen des Hangs (siehe unten).
   */
  const KACHEL = 360;
  const bilder = {
    q: 0, pulverSchnee: null, cord: null,
    baeume: [], licht: null, wolke: null, flocke: null, pulverTon: new Map(),
  };

  function leinwand(w, h) {
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  function baueBilder() {
    const q = view.s * view.dpr;
    if (Math.abs(q - bilder.q) < 0.001 && bilder.cord) return;
    bilder.q = q;
    const n = Math.round(KACHEL * q);
    bilder.pulverSchnee = baueKachel(n, malePulverschnee);
    bilder.cord = baueKachel(n, maleCord);
    // Neun Tannen: drei Arten in drei Grössen.
    bilder.baeume = [];
    for (const R of [15, 20, 26]) for (let v = 0; v < 3; v += 1) bilder.baeume.push(baueBaum(R + v * 1.5, v, q));
    bilder.licht = baueLicht();
    bilder.wolke = baueWolke();
    bilder.flocke = bauePulver([255, 255, 255], [244, 248, 255]);
    hangLeeren();
  }

  function baueKachel(n, malen) {
    const c = leinwand(n, n);
    const x = c.getContext("2d");
    x.scale(n / KACHEL, n / KACHEL);
    // Alles, was über den Rand reicht, kommt auf der anderen Seite wieder
    // herein – sonst sähe man die Kachel.
    const rund = (fn) => {
      for (const dx of [-KACHEL, 0, KACHEL]) for (const dy of [-KACHEL, 0, KACHEL]) { x.save(); x.translate(dx, dy); fn(); x.restore(); }
    };
    malen(x, rund);
    return c;
  }

  function buckel(x, rund, anzahl, rMin, rMax, schatten, licht) {
    for (let i = 0; i < anzahl; i += 1) {
      const mx = Math.random() * KACHEL;
      const my = Math.random() * KACHEL;
      const r = rMin + Math.random() * (rMax - rMin);
      rund(() => {
        // Schatten auf der sonnenabgewandten Seite (unten rechts), eine
        // helle Kuppe zur Sonne (oben links).
        let grad = x.createRadialGradient(mx + r * 0.25, my + r * 0.25, r * 0.1, mx + r * 0.25, my + r * 0.25, r);
        grad.addColorStop(0, `rgba(128, 156, 210, ${schatten})`);
        grad.addColorStop(1, "rgba(128, 156, 210, 0)");
        x.fillStyle = grad;
        x.beginPath();
        x.ellipse(mx + r * 0.25, my + r * 0.25, r, r * 0.8, 0.3, 0, Math.PI * 2);
        x.fill();
        grad = x.createRadialGradient(mx - r * 0.25, my - r * 0.25, 0, mx - r * 0.25, my - r * 0.25, r * 0.7);
        grad.addColorStop(0, `rgba(255, 255, 255, ${licht})`);
        grad.addColorStop(1, "rgba(255, 255, 255, 0)");
        x.fillStyle = grad;
        x.beginPath();
        x.ellipse(mx - r * 0.25, my - r * 0.25, r * 0.7, r * 0.55, 0.3, 0, Math.PI * 2);
        x.fill();
      });
    }
  }

  function koernung(x, anzahl, farbe, gross) {
    x.fillStyle = farbe;
    for (let i = 0; i < anzahl; i += 1) {
      const r = gross * (0.4 + Math.random() * 0.8);
      x.fillRect(Math.random() * KACHEL, Math.random() * KACHEL, r, r);
    }
  }

  // Tiefschnee: kräftige Buckel, bläulich im Schatten.
  function malePulverschnee(x, rund) {
    x.fillStyle = "#e9f0fa";
    x.fillRect(0, 0, KACHEL, KACHEL);
    buckel(x, rund, 22, 18, 44, 0.42, 0.95);
    koernung(x, 1400, "rgba(140, 165, 215, 0.30)", 0.6);
    koernung(x, 500, "rgba(255, 255, 255, 0.9)", 0.5);
  }

  // Die Piste: frisch präpariert. Die Pistenraupe zieht Bahnen den Hang
  // hinunter, jede mit feinen Rippen und einer etwas anderen Helligkeit;
  // darüber ein paar weiche Wellen und alte, verwehte Spuren.
  function maleCord(x, rund) {
    x.fillStyle = "#f7faff";
    x.fillRect(0, 0, KACHEL, KACHEL);
    const bahn = KACHEL / 8;
    for (let i = 0; i < 8; i += 1) {
      x.fillStyle = `rgba(196, 212, 240, ${(0.05 + (i % 3) * 0.04).toFixed(3)})`;
      x.fillRect(i * bahn, 0, bahn, KACHEL);
      x.fillStyle = "rgba(150, 172, 214, 0.28)";
      x.fillRect(i * bahn, 0, 0.7, KACHEL);
      x.fillStyle = "rgba(255, 255, 255, 0.8)";
      x.fillRect(i * bahn + 0.7, 0, 0.6, KACHEL);
    }
    x.fillStyle = "rgba(150, 174, 216, 0.14)";
    for (let rx = 0; rx < KACHEL; rx += 2.5) x.fillRect(rx, 0, 0.9, KACHEL);
    buckel(x, rund, 10, 30, 60, 0.12, 0.5);
    koernung(x, 1100, "rgba(150, 172, 214, 0.24)", 0.55);
    koernung(x, 400, "rgba(255, 255, 255, 0.9)", 0.45);
    // Alte Spuren: Wellen, deren Länge in der Kachel aufgeht.
    x.strokeStyle = "rgba(150, 174, 218, 0.20)";
    x.lineWidth = 0.7;
    for (let i = 0; i < 4; i += 1) {
      const sx = Math.random() * KACHEL;
      const amp = 10 + Math.random() * 18;
      const ph = Math.random() * Math.PI * 2;
      const wellen = 2 + Math.floor(Math.random() * 2);
      rund(() => {
        for (const versatz of [0, 2.2]) {
          x.beginPath();
          for (let yy = 0; yy <= KACHEL; yy += 5) {
            const xx = sx + versatz + Math.sin((yy / KACHEL) * Math.PI * 2 * wellen + ph) * amp;
            if (yy === 0) x.moveTo(xx, yy); else x.lineTo(xx, yy);
          }
          x.stroke();
        }
      });
    }
  }

  // Eine Tanne von oben, leicht schräg: drei Stockwerke, nach oben kleiner
  // und im Bild ein Stück höher, mit Schnee auf der Sonnenseite. Der Schatten
  // fällt nach unten rechts.
  function baueBaum(R, variante, q) {
    // Eng um Krone und Schatten – jeder leere Bildpunkt kostet beim Kopieren.
    const links = R * 1.1;
    const oben = R * 1.4;
    const breit = links + R * 2.1;
    const hoch = oben + R * 1.45;
    const c = leinwand(breit * q, hoch * q);
    const x = c.getContext("2d");
    x.scale(q, q);
    const cx = links;
    const cy = oben;
    // Schatten
    x.save();
    x.translate(cx + R * 0.7, cy + R * 0.45);
    x.rotate(0.45);
    const sg = x.createRadialGradient(0, 0, R * 0.2, 0, 0, R * 1.25);
    sg.addColorStop(0, "rgba(70, 92, 150, 0.38)");
    sg.addColorStop(1, "rgba(70, 92, 150, 0)");
    x.fillStyle = sg;
    x.beginPath();
    x.ellipse(0, 0, R * 1.35, R * 0.8, 0, 0, Math.PI * 2);
    x.fill();
    x.restore();
    const stern = (mx, my, r, zacken, dreh, zufallSaat) => {
      x.beginPath();
      for (let i = 0; i <= zacken * 2; i += 1) {
        const w = dreh + (i / (zacken * 2)) * Math.PI * 2;
        const rr = i % 2 === 0 ? r * (0.92 + hash01(zufallSaat + i) * 0.12) : r * 0.66;
        const px = mx + Math.cos(w) * rr;
        const py = my + Math.sin(w) * rr * 0.9;
        if (i === 0) x.moveTo(px, py); else x.lineTo(px, py);
      }
      x.closePath();
    };
    const gruen = [["#1f4a3a", "#2c6b4f"], ["#1c4436", "#2f7356"], ["#22503f", "#356f52"]][variante];
    for (let k = 0; k < 4; k += 1) {
      const r = R * (1 - k * 0.23);
      const my = cy - k * R * 0.34;
      const zacken = 9 - k;
      const dreh = variante * 0.7 + k * 0.4;
      const saat = variante * 100 + k * 17;
      const grad = x.createRadialGradient(cx - r * 0.3, my - r * 0.3, r * 0.1, cx, my, r);
      grad.addColorStop(0, gruen[1]);
      grad.addColorStop(1, gruen[0]);
      x.fillStyle = grad;
      stern(cx, my, r, zacken, dreh, saat);
      x.fill();
      // Schnee auf den Ästen, zur Sonne hin
      x.fillStyle = "rgba(246, 250, 255, 0.93)";
      stern(cx - r * 0.12, my - r * 0.14, r * 0.74, zacken, dreh + 0.15, saat + 5);
      x.fill();
      x.fillStyle = gruen[0];
      stern(cx + r * 0.1, my + r * 0.1, r * 0.42, zacken, dreh + 0.3, saat + 9);
      x.fill();
    }
    x.fillStyle = "#ffffff";
    x.beginPath();
    x.arc(cx - R * 0.08, cy - R * 1.08, R * 0.12, 0, Math.PI * 2);
    x.fill();
    return { c, ox: Math.round(cx * q), oy: Math.round(cy * q) };
  }

  function baueLicht() {
    const n = 128;
    const c = leinwand(n, n);
    const x = c.getContext("2d");
    const grad = x.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2);
    grad.addColorStop(0, "rgba(255, 246, 220, 1)");
    grad.addColorStop(0.35, "rgba(255, 236, 200, 0.55)");
    grad.addColorStop(1, "rgba(255, 230, 190, 0)");
    x.fillStyle = grad;
    x.fillRect(0, 0, n, n);
    return c;
  }

  function bauePulver(innen, mitte) {
    const n = 32;
    const c = leinwand(n, n);
    const x = c.getContext("2d");
    const grad = x.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2);
    grad.addColorStop(0, `rgba(${innen.join(",")}, 1)`);
    grad.addColorStop(0.5, `rgba(${mitte.join(",")}, 0.75)`);
    grad.addColorStop(1, `rgba(${mitte.join(",")}, 0)`);
    x.fillStyle = grad;
    x.fillRect(0, 0, n, n);
    return c;
  }

  // Das Flöckchen im Licht des Tages (tonF): Nachts leuchtet Pulverschnee
  // nicht weiss. Gemerkt in groben Stufen – das Licht ändert sich langsam.
  const PULVER = { weiss: [[255, 255, 255], [244, 248, 255]], schatten: [[110, 135, 196], [110, 135, 196]] };
  function pulverIm(art) {
    const stufe = tonF.map((v) => Math.round(v * 32));
    const schluessel = `${art}${stufe.join(",")}`;
    let c = bilder.pulverTon.get(schluessel);
    if (!c) {
      if (bilder.pulverTon.size > 120) bilder.pulverTon.clear();
      const [innen, mitte] = PULVER[art].map((rgb) => rgb.map((v, i) => Math.round((v * stufe[i]) / 32)));
      c = bauePulver(innen, mitte);
      bilder.pulverTon.set(schluessel, c);
    }
    return c;
  }

  function baueWolke() {
    const n = 160;
    const c = leinwand(n, n);
    const x = c.getContext("2d");
    for (let i = 0; i < 7; i += 1) {
      const px = n / 2 + Math.cos(i * 0.9) * n * 0.18;
      const py = n / 2 + Math.sin(i * 1.7) * n * 0.12;
      const grad = x.createRadialGradient(px, py, 0, px, py, n * 0.32);
      grad.addColorStop(0, "rgba(60, 80, 140, 0.30)");
      grad.addColorStop(1, "rgba(60, 80, 140, 0)");
      x.fillStyle = grad;
      x.fillRect(0, 0, n, n);
    }
    return c;
  }

  // ---------------------------------------------------------------------------
  // Der Tag
  // ---------------------------------------------------------------------------
  // Wie das Licht nach der Strecke steht: Morgen, Mittag, Alpenglühen,
  // Dämmerung, Nacht. tint färbt (multipliziert, mit der Stärke a), nacht
  // schaltet das Flutlicht ein, sonne die Schatten der Wolken und das
  // Glitzern. Das Licht hängt am Ort am Hang: Wer hinunterschaut, sieht die
  // Nacht unten schon kommen.
  const TAG = [
    { m: 0, tint: [255, 214, 176], a: 0.2, nacht: 0, sonne: 0.8 },
    { m: 150, tint: [255, 255, 255], a: 0, nacht: 0, sonne: 1 },
    { m: 330, tint: [255, 168, 150], a: 0.36, nacht: 0, sonne: 0.7 },
    { m: 470, tint: [96, 92, 168], a: 0.62, nacht: 0.45, sonne: 0.15 },
    { m: 600, tint: [26, 34, 82], a: 0.86, nacht: 1, sonne: 0 },
  ];

  // f: womit das Licht jeden Farbkanal malnimmt (1 heisst unverändert).
  function lichtBei(m, ziel = { f: [1, 1, 1], nacht: 0, sonne: 1 }) {
    let i = 0;
    while (i < TAG.length - 2 && m > TAG[i + 1].m) i += 1;
    const a = TAG[i];
    const b = TAG[i + 1];
    const k = clamp((m - a.m) / (b.m - a.m), 0, 1);
    const glatt = k * k * (3 - 2 * k);
    const staerke = lerp(a.a, b.a, glatt);
    for (let j = 0; j < 3; j += 1) ziel.f[j] = 1 - staerke + (staerke * lerp(a.tint[j], b.tint[j], glatt)) / 255;
    ziel.nacht = lerp(a.nacht, b.nacht, glatt);
    ziel.sonne = lerp(a.sonne, b.sonne, glatt);
    return ziel;
  }

  // Was sich bewegt – Fahrer, Stangen, Spuren, Pulver –, steht im selben
  // Licht wie der Hang darunter: tonAn(y) stellt es ein, ton() färbt.
  // Nachts hellt das Flutlicht auf, wer in seinem Kegel steht (x gegeben).
  const tonLicht = lichtBei(0);
  let tonF = tonLicht.f;
  const tonHell = [1, 1, 1];
  function tonAn(y, x = null) {
    lichtBei(meterBei(y), tonLicht);
    tonF = tonLicht.f;
    if (x !== null && tonLicht.nacht > 0.02) {
      const hell = Math.min(1, flutlichtBei(x, y) * 1.3);
      for (let j = 0; j < 3; j += 1) tonHell[j] = tonF[j] + (1 - tonF[j]) * hell;
      tonF = tonHell;
    }
    return tonLicht;
  }
  const ton = (rgb, a = 1) => `rgba(${Math.round(rgb[0] * tonF[0])}, ${Math.round(rgb[1] * tonF[1])}, ${Math.round(rgb[2] * tonF[2])}, ${a})`;
  const HEX = new Map();
  function rgbAus(hex) {
    if (!HEX.has(hex)) HEX.set(hex, [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)));
    return HEX.get(hex);
  }

  // ---------------------------------------------------------------------------
  // Der Hang in Streifen
  // ---------------------------------------------------------------------------
  /*
   * Was am Hang stillsteht – Tiefschnee und Piste, ihr Rand mit den
   * Markierungen, die Wälder, die Schatten der Wolken, das Licht des Tages
   * und nachts das Flutlicht –, wird in Streifen quer über den Hang
   * vorgezeichnet: STREIFEN_PX Bildpunkte hoch und links und rechts so weit
   * über das Bild hinaus (RAND_X), dass die Kamera nicht hinausschaut. Jedes
   * Bild kopiert dann nur noch die Streifen, die zu sehen sind, Bildpunkt
   * auf Bildpunkt – schneller kann eine Leinwand nichts.
   *
   * Neue Streifen entstehen voraus, in drei Schritten auf drei Bilder
   * verteilt (Schnee, Wald, Licht), damit kein Bild zu lange braucht. Was
   * oben aus dem Bild ist, kommt in den Vorrat und wird wiederverwendet.
   */
  const STREIFEN_PX = 256;
  const RAND_X = 240;
  const hang = { q: 0, hoch: 1, breitPx: 0, viewW: 0, liste: new Map(), vorrat: [] };

  function hangLeeren() {
    hang.liste.forEach((s) => { if (hang.vorrat.length < 8) hang.vorrat.push(s.c); });
    hang.liste.clear();
  }

  function hangPruefen() {
    const q = view.s * view.dpr;
    if (q === hang.q && view.w === hang.viewW) return;
    hangLeeren();
    hang.q = q;
    hang.viewW = view.w;
    hang.hoch = STREIFEN_PX / q;
    hang.breitPx = Math.ceil((view.w + 2 * RAND_X) * q);
  }

  function streifenHolen(j) {
    let s = hang.liste.get(j);
    if (s) return s;
    const c = hang.vorrat.pop() || document.createElement("canvas");
    if (c.width !== hang.breitPx) c.width = hang.breitPx;
    if (c.height !== STREIFEN_PX) c.height = STREIFEN_PX;
    const mitte = pisteBei((j + 0.5) * hang.hoch);
    s = { j, c, x: c.getContext("2d"), x0px: Math.round((mitte - view.w / 2 - RAND_X) * hang.q), schritt: 0 };
    hang.liste.set(j, s);
    return s;
  }

  // Eine Kachel Bildpunkt auf Bildpunkt über den ganzen Streifen legen – im
  // Raster der Welt, damit die Streifen nahtlos aneinanderpassen.
  function kachelnLegen(x, kachel, s) {
    const n = kachel.width;
    const x0 = s.x0px;
    const y0 = s.j * STREIFEN_PX;
    for (let kx = Math.floor(x0 / n); kx * n < x0 + hang.breitPx; kx += 1) {
      for (let ky = Math.floor(y0 / n); ky * n < y0 + STREIFEN_PX; ky += 1) x.drawImage(kachel, kx * n - x0, ky * n - y0);
    }
  }

  function streifenWeiter(s) {
    const x = s.x;
    const q = hang.q;
    const y0 = s.j * hang.hoch;
    const y1 = y0 + hang.hoch;
    const links = s.x0px / q;
    const rechts = (s.x0px + hang.breitPx) / q;
    const welt = () => x.setTransform(q, 0, 0, q, -s.x0px, -s.j * STREIFEN_PX);
    x.globalCompositeOperation = "source-over";
    x.globalAlpha = 1;
    if (s.schritt === 0) {
      // Tiefschnee, darauf die Piste, dann ihr Rand
      x.setTransform(1, 0, 0, 1, 0, 0);
      kachelnLegen(x, bilder.pulverSchnee, s);
      x.save();
      welt();
      const schritt = 12;
      const oben = Math.floor((y0 - 24) / schritt) * schritt;
      const unten = Math.ceil((y1 + 24) / schritt) * schritt;
      x.beginPath();
      for (let y = oben; y <= unten; y += schritt) x.lineTo(pisteBei(y) - PISTE_HALB, y);
      for (let y = unten; y >= oben; y -= schritt) x.lineTo(pisteBei(y) + PISTE_HALB, y);
      x.closePath();
      x.clip();
      x.setTransform(1, 0, 0, 1, 0, 0);
      kachelnLegen(x, bilder.cord, s);
      x.restore();
      welt();
      maleRand(x, y0, y1);
    } else if (s.schritt === 1) {
      x.setTransform(1, 0, 0, 1, 0, 0);
      maleWald(x, s, y0, y1, links, rechts);
    } else if (s.schritt === 2) {
      welt();
      maleWolken(x, y0, y1, links, rechts);
      maleLicht(x, y0, y1, links, rechts);
    }
    s.schritt += 1;
  }

  // Der Rand der Piste: ein weicher Wall, den die Raupe aufgeschoben hat, mit
  // seinem Schatten nach aussen – und Markierungen mit orangen Köpfen.
  function maleRand(x, y0, y1) {
    const schritt = 24;
    const oben = Math.floor((y0 - 30) / schritt) * schritt;
    const unten = Math.ceil((y1 + 30) / schritt) * schritt;
    x.lineJoin = "round";
    for (const seite of [-1, 1]) {
      const linie = (aussen) => {
        x.beginPath();
        for (let y = oben; y <= unten; y += schritt) x.lineTo(pisteBei(y) + seite * (PISTE_HALB + aussen), y);
      };
      linie(7);
      x.strokeStyle = "rgba(120, 146, 205, 0.30)";
      x.lineWidth = 7;
      x.stroke();
      linie(2);
      x.strokeStyle = "rgba(255, 255, 255, 0.95)";
      x.lineWidth = 6;
      x.stroke();
      linie(-1.5);
      x.strokeStyle = "rgba(140, 165, 215, 0.35)";
      x.lineWidth = 1;
      x.stroke();
    }
    // Die Markierungen, alle 60 Einheiten
    for (let y = Math.floor((y0 - 10) / 60) * 60; y <= y1 + 10; y += 60) {
      for (const seite of [-1, 1]) {
        const px = pisteBei(y) + seite * (PISTE_HALB + 6);
        x.fillStyle = "rgba(60, 80, 140, 0.25)";
        x.beginPath();
        x.ellipse(px + 2.5, y + 1.5, 2.2, 1.2, 0.4, 0, Math.PI * 2);
        x.fill();
        x.strokeStyle = "#3a3f55";
        x.lineWidth = 1;
        x.beginPath();
        x.moveTo(px, y);
        x.lineTo(px, y - 10 * HOEHE_K);
        x.stroke();
        x.fillStyle = "#ff7a2f";
        x.fillRect(px - 1, y - 10 * HOEHE_K - 3, 2, 3.4);
      }
    }
  }

  // Der Wald: Reihe um Reihe den Hang hinunter, in derselben Reihenfolge in
  // jedem Streifen – so überdecken sich die Bäume an jeder Naht gleich.
  function maleWald(x, s, y0, y1, links, rechts) {
    const q = hang.q;
    const oy = s.j * STREIFEN_PX;
    for (let j = Math.floor((y0 - 50) / 26); j <= Math.ceil((y1 + 50) / 26); j += 1) {
      for (const seite of [-1, 1]) {
        for (let reihe = 0; reihe < 4; reihe += 1) {
          const h = hash01(j * 13.37 + seite * 7.1 + reihe * 3.3);
          if (reihe > 0 && h < 0.35) continue;
          const y = j * 26 + hash01(h * 5.1) * 18;
          const abstand = 22 + reihe * 34 + hash01(h * 9.3) * 22;
          const px = pisteBei(y) + seite * (PISTE_HALB + abstand);
          if (px < links - 60 || px > rechts + 60) continue;
          const b = bilder.baeume[Math.floor(hash01(h * 3.7) * 9)];
          x.drawImage(b.c, Math.round(px * q) - s.x0px - b.ox, Math.round(y * q) - oy - b.oy);
        }
      }
    }
  }

  // Die Schatten der Wolken liegen still auf dem Schnee – mal hier, mal dort,
  // je nach Feld –, und nur, solange die Sonne scheint.
  const WOLKE_FELD = 520;
  function maleWolken(x, y0, y1, links, rechts) {
    if (ruhig()) return;
    const licht = lichtBei(0);
    for (let i = Math.floor((links - 300) / WOLKE_FELD); i <= Math.floor((rechts + 300) / WOLKE_FELD); i += 1) {
      for (let k = Math.floor((y0 - 300) / WOLKE_FELD); k <= Math.floor((y1 + 300) / WOLKE_FELD); k += 1) {
        const h = hash01(i * 41.3 + k * 17.9 + 5);
        if (h < 0.4) continue;
        const r = 150 + hash01(h * 7.7) * 110;
        const cx = (i + hash01(h * 3.1)) * WOLKE_FELD;
        const cy = (k + hash01(h * 5.3)) * WOLKE_FELD;
        if (cy + r < y0 || cy - r > y1) continue;
        const sonne = lichtBei(meterBei(cy), licht).sonne;
        if (sonne < 0.05) continue;
        x.globalAlpha = 0.55 * sonne;
        x.drawImage(bilder.wolke, cx - r, cy - r * 0.7, r * 2, r * 1.4);
      }
    }
    x.globalAlpha = 1;
  }

  // Nachts das Flutlicht: Masten am Rand alle 230 Einheiten, abwechselnd
  // links und rechts, ihr Licht fällt schräg auf die Piste.
  const MAST_ABSTAND = 230;
  function mastBei(i) {
    const y = i * MAST_ABSTAND;
    const seite = i % 2 === 0 ? -1 : 1;
    return { y, mast: pisteBei(y) + seite * (PISTE_HALB + 18), ziel: pisteBei(y + 40) + seite * PISTE_HALB * 0.25 };
  }

  // Wie hell das Flutlicht an einer Stelle ist (0 bis etwa 0.6) – grob wie
  // der Lichtfleck, den maleLicht in den Hang legt.
  const flutLicht = lichtBei(0);
  function flutlichtBei(x, y) {
    let summe = 0;
    const mitte = Math.round((y - 40) / MAST_ABSTAND);
    for (let i = mitte - 1; i <= mitte + 1; i += 1) {
      const m = mastBei(i);
      const d = Math.hypot((x - m.ziel) / 210, (y - m.y - 40) / 150);
      if (d >= 1) continue;
      summe += 0.62 * lichtBei(meterBei(m.y), flutLicht).nacht * (1 - d) * (1 - d);
    }
    return summe;
  }

  // Das Licht des Tages, von oben nach unten durch den Streifen verlaufend,
  // und das Flutlicht.
  function maleLicht(x, y0, y1, links, rechts) {
    const oben = lichtBei(meterBei(y0));
    const unten = lichtBei(meterBei(y1));
    if (Math.min(...oben.f, ...unten.f) < 0.998) {
      const rgb = (f) => `rgb(${f.map((v) => Math.round(v * 255)).join(",")})`;
      const verlauf = x.createLinearGradient(0, y0, 0, y1);
      verlauf.addColorStop(0, rgb(oben.f));
      verlauf.addColorStop(1, rgb(unten.f));
      x.globalCompositeOperation = "multiply";
      x.fillStyle = verlauf;
      x.fillRect(links, y0, rechts - links, y1 - y0);
    }
    if (Math.max(oben.nacht, unten.nacht) > 0.02) {
      x.globalCompositeOperation = "lighter";
      const licht = lichtBei(0);
      for (let i = Math.floor((y0 - 230) / MAST_ABSTAND); i <= Math.ceil((y1 + 190) / MAST_ABSTAND); i += 1) {
        const { y, mast, ziel } = mastBei(i);
        const nacht = lichtBei(meterBei(y), licht).nacht;
        if (nacht <= 0.02) continue;
        x.globalAlpha = 0.62 * nacht;
        x.drawImage(bilder.licht, ziel - 210, y + 40 - 150, 420, 300);
        x.globalAlpha = 0.9 * nacht;
        x.drawImage(bilder.licht, mast - 14, y - 26 * HOEHE_K - 14, 28, 28);
      }
    }
    x.globalAlpha = 1;
    x.globalCompositeOperation = "source-over";
  }

  // ---------------------------------------------------------------------------
  // Zeichnen
  // ---------------------------------------------------------------------------
  // Der Hang: die Streifen, die zu sehen sind, und voraus ein Schritt am
  // nächsten, der noch fehlt.
  function zeichneHang() {
    hangPruefen();
    welt();
    g.setTransform(1, 0, 0, 1, 0, 0);
    const j0 = Math.floor((state.camY - 8) / hang.hoch);
    const j1 = Math.floor((state.camY + view.h + 8) / hang.hoch);
    let rand = null;
    for (let j = j0; j <= j1; j += 1) {
      const s = streifenHolen(j);
      while (s.schritt < 3) streifenWeiter(s);
      const px = s.x0px + kamera.x;
      const py = j * STREIFEN_PX + kamera.y;
      g.drawImage(s.c, px, py);
      // Schaut die Kamera doch einmal über einen Streifen hinaus (beim Sturz
      // weit in den Wald): dort Tiefschnee in seiner Farbe.
      if (px > 0 || px + hang.breitPx < canvas.width) {
        if (!rand) { tonAn(state.camY + view.h / 2); rand = ton([233, 240, 250]); }
        g.fillStyle = rand;
        if (px > 0) g.fillRect(0, py, px, STREIFEN_PX);
        if (px + hang.breitPx < canvas.width) g.fillRect(px + hang.breitPx, py, canvas.width - px - hang.breitPx, STREIFEN_PX);
      }
    }
    for (let j = j1 + 1; j <= j1 + 3; j += 1) {
      const s = streifenHolen(j);
      if (s.schritt < 3) { streifenWeiter(s); break; }
    }
    hang.liste.forEach((s, j) => {
      if (j >= j0 - 1 && j <= j1 + 4) return;
      hang.liste.delete(j);
      if (hang.vorrat.length < 8) hang.vorrat.push(s.c);
    });
  }

  function zeichneGlitzern(licht) {
    if (licht.sonne < 0.05) return;
    welt();
    const zelle = 40;
    const i0 = Math.floor(state.camX / zelle);
    const i1 = Math.ceil((state.camX + view.w) / zelle);
    const j0 = Math.floor(state.camY / zelle);
    const j1 = Math.ceil((state.camY + view.h) / zelle);
    g.strokeStyle = "#ffffff";
    g.lineWidth = 0.5;
    for (let i = i0; i <= i1; i += 1) {
      for (let j = j0; j <= j1; j += 1) {
        const h = hash01(i * 73.13 + j * 19.7);
        if (h > 0.13) continue;
        const a = Math.pow(Math.max(0, Math.sin(state.zeit * 2.3 + h * 60)), 14) * licht.sonne;
        if (a < 0.05) continue;
        const x = i * zelle + hash01(h * 91.7) * zelle;
        const y = j * zelle + hash01(h * 37.3) * zelle;
        const r = 1.2 + 1.6 * a;
        g.globalAlpha = a;
        g.beginPath();
        g.moveTo(x - r, y);
        g.lineTo(x + r, y);
        g.moveTo(x, y - r);
        g.lineTo(x, y + r);
        g.stroke();
      }
    }
    g.globalAlpha = 1;
  }

  // Die Spuren: zwei Kantenlinien je Ski, nach hinten blasser.
  function zeichneSpur() {
    const sp = state.spur;
    if (sp.l.length < 2) return;
    welt();
    tonAn(state.sk.y, state.sk.x);
    g.lineCap = "round";
    g.lineJoin = "round";
    for (const seite of [sp.l, sp.r]) {
      const n = seite.length;
      const stueck = 12;
      for (let a = 0; a < n - 1; a += stueck) {
        const b = Math.min(n - 1, a + stueck);
        const alt = 1 - a / n;
        g.beginPath();
        g.moveTo(seite[a].x, seite[a].y);
        for (let i = a + 1; i <= b; i += 1) g.lineTo(seite[i].x, seite[i].y);
        g.strokeStyle = ton([118, 146, 205], (0.18 + 0.38 * (1 - alt)).toFixed(3));
        g.lineWidth = 1.5;
        g.stroke();
        g.strokeStyle = ton([255, 255, 255], (0.35 * (1 - alt)).toFixed(3));
        g.lineWidth = 0.6;
        g.stroke();
      }
    }
  }

  // Die Linie auf dem Schnee zwischen den Stangen – damit das Tor als Tor zu
  // lesen ist, auch von weitem. Das Stück an der inneren Stange ist golden:
  // Wer dort durchfährt, fährt die kürzeste Linie («perfekt»).
  function zeichneTorlinien() {
    welt();
    g.lineCap = "round";
    for (const tor of state.kurs.tore) {
      if (tor.y < state.camY - 40) continue;
      if (tor.y > state.camY + view.h + 40) break;
      const l = stangeL(tor);
      const r = stangeR(tor);
      const fehler = tor.zustand === "verpasst" || tor.zustand === "getroffen";
      tonAn(tor.y, tor.x);
      // Um jede Stange ein Kranz aufgewühlter Schnee.
      g.fillStyle = ton([130, 156, 212], 0.28);
      for (const x of [l, r]) {
        g.beginPath();
        g.ellipse(x + 0.6, tor.y + 0.4, 3.6, 2.2, 0, 0, Math.PI * 2);
        g.fill();
      }
      // Rot für das verpasste Tor und Gold für die kürzeste Linie leuchten in
      // jedem Licht – das sind Zeichen, keine Farben im Schnee.
      g.strokeStyle = fehler ? "rgba(232, 40, 40, 0.85)" : tor.rot ? ton([232, 67, 58], 0.35) : ton([47, 111, 220], 0.35);
      g.lineWidth = fehler ? 2 : 1.3;
      g.setLineDash([3, 4]);
      g.beginPath();
      g.moveTo(l + 3, tor.y);
      g.lineTo(r - 3, tor.y);
      g.stroke();
      g.setLineDash([]);
      if (fehler) continue;
      const innen = tor.innen < 0 ? l : r;
      const gold = Math.max(7, tor.breite * 0.26);
      const glanz = tor.zustand === "perfekt" ? 0.95 : tor.zustand === "offen" ? 0.5 : 0.18;
      g.strokeStyle = `rgba(255, 196, 40, ${glanz})`;
      g.lineWidth = tor.zustand === "perfekt" ? 2.4 : 1.8;
      g.beginPath();
      g.moveTo(innen - tor.innen * 3.5, tor.y);
      g.lineTo(innen - tor.innen * gold, tor.y);
      g.stroke();
    }
  }

  // Eine Stange mit ihrer Fahne, ein Stück schräg von oben gesehen: Die
  // Spitze steht im Bild höher als der Fuss, der Schatten fällt nach unten
  // rechts. Die Fahne zeigt nach aussen (aussen: -1 links, 1 rechts) und
  // schlägt im Wind; eine getroffene Stange wackelt.
  function zeichneStange(x, y, farbe, dunkel, aussen, wackel, phase, blink) {
    const h = 34 * HOEHE_K;
    const kipp = wackel * 0.6;
    const topX = x + Math.sin(kipp) * h;
    const topY = y - Math.cos(kipp) * h;
    // Schatten
    g.strokeStyle = ton([70, 92, 150], 0.3);
    g.lineWidth = 1.8;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + 13, y + 7);
    g.lineTo(x + 13 + aussen * 6, y + 7 + 2);
    g.stroke();
    const f = blink ? "#ff2a2a" : ton(farbe);
    // Stange
    g.strokeStyle = f;
    g.lineWidth = 2.2;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(topX, topY);
    g.stroke();
    g.strokeStyle = ton([255, 255, 255], 0.65);
    g.lineWidth = 0.6;
    g.beginPath();
    g.moveTo(x - 0.5, y - 1);
    g.lineTo(topX - 0.5, topY + 1);
    g.stroke();
    // Fahne
    const fl = 11;
    const welle = ruhig() ? 0 : Math.sin(state.zeit * 8 + phase) * 1.6;
    const welle2 = ruhig() ? 0 : Math.sin(state.zeit * 8 + phase + 1.3) * 1.2;
    const fx = topX + aussen * fl;
    g.fillStyle = blink ? "#ff2a2a" : ton(dunkel);
    g.beginPath();
    g.moveTo(topX, topY + 1);
    g.quadraticCurveTo(topX + aussen * fl * 0.5, topY + 1 + welle, fx, topY + 1.5 + welle2);
    g.lineTo(fx, topY + 10 + welle2);
    g.quadraticCurveTo(topX + aussen * fl * 0.5, topY + 9.5 + welle, topX, topY + 9);
    g.closePath();
    g.fill();
    // Die vordere, helle Hälfte des Tuchs – so wirkt es gewölbt.
    g.fillStyle = f;
    g.beginPath();
    g.moveTo(topX, topY + 1);
    g.quadraticCurveTo(topX + aussen * fl * 0.5, topY + 1 + welle, fx, topY + 1.5 + welle2);
    g.lineTo(fx, topY + 6 + welle2);
    g.quadraticCurveTo(topX + aussen * fl * 0.5, topY + 5.5 + welle, topX, topY + 5);
    g.closePath();
    g.fill();
    g.fillStyle = ton([255, 255, 255], 0.9);
    g.beginPath();
    g.moveTo(topX + aussen * fl * 0.42, topY + 1.4 + welle * 0.9);
    g.lineTo(topX + aussen * fl * 0.62, topY + 1.5 + welle * 0.8);
    g.lineTo(topX + aussen * fl * 0.62, topY + 9.7 + welle * 0.8);
    g.lineTo(topX + aussen * fl * 0.42, topY + 9.6 + welle * 0.9);
    g.closePath();
    g.fill();
    g.fillStyle = ton([255, 255, 255]);
    g.beginPath();
    g.arc(topX, topY, 1.1, 0, Math.PI * 2);
    g.fill();
  }

  function zeichneTore(vorDemFahrer) {
    welt();
    const sk = state.sk;
    for (const tor of state.kurs.tore) {
      if (tor.y < state.camY - 40) continue;
      if (tor.y > state.camY + view.h + 60) break;
      if ((tor.y < sk.y) !== vorDemFahrer) continue;
      const farbe = tor.rot ? [239, 74, 60] : [47, 116, 230];
      const dunkel = tor.rot ? [181, 38, 29] : [29, 79, 174];
      tonAn(tor.y, tor.x);
      const blink = tor.blink > 0 && Math.floor(tor.blink * 10) % 2 === 0;
      zeichneStange(stangeL(tor), tor.y, farbe, dunkel, -1, tor.wackel[0], tor.nr * 1.7, blink);
      zeichneStange(stangeR(tor), tor.y, farbe, dunkel, 1, tor.wackel[1], tor.nr * 1.7 + 2, blink);
    }
  }

  // Der Start: eine Holzrampe mit Schneerändern, dahinter das Starttor mit
  // seinem Banner. Der Startbügel vor dem Fahrer klappt auf, sobald es
  // losgeht.
  function zeichneStart() {
    const y = START.y;
    if (y < state.camY - 80 || y > state.camY + view.h + 60) return;
    welt();
    tonAn(y);
    const x = pisteBei(y);
    g.fillStyle = ton([70, 92, 150], 0.25);
    g.fillRect(x - 24, y - 52, 56, 70);
    g.fillStyle = ton([154, 106, 64]);
    g.fillRect(x - 28, y - 56, 56, 68);
    g.fillStyle = ton([60, 34, 14], 0.35);
    for (let k = -56; k < 12; k += 6) g.fillRect(x - 28, y + k, 56, 0.8);
    g.fillStyle = ton([246, 249, 254]);
    g.fillRect(x - 31, y - 58, 5, 72);
    g.fillRect(x + 26, y - 58, 5, 72);
    // Startbügel
    const auf = state.phase === "bereit" ? 0 : Math.min(1, (state.zeit - state.losZeit) * 4);
    g.strokeStyle = ton([58, 63, 85]);
    g.lineWidth = 1.4;
    g.beginPath();
    g.moveTo(x - 10, y + 12);
    g.lineTo(x - 10 + Math.cos(auf * 1.4) * 20, y + 12 + Math.sin(auf * 1.4) * 20);
    g.stroke();
    // Starttor hinter dem Fahrer: zwei Pfosten und ein Banner, im Bild hoch.
    const h = 30 * HOEHE_K;
    const yb = y - 10;
    for (const s of [-1, 1]) {
      g.strokeStyle = ton([70, 92, 150], 0.3);
      g.lineWidth = 1.6;
      g.beginPath();
      g.moveTo(x + s * 30, yb);
      g.lineTo(x + s * 30 + 12, yb + 7);
      g.stroke();
      g.strokeStyle = ton([58, 63, 85]);
      g.beginPath();
      g.moveTo(x + s * 30, yb);
      g.lineTo(x + s * 30, yb - h);
      g.stroke();
    }
    g.fillStyle = ton([245, 166, 35]);
    g.fillRect(x - 30, yb - h, 60, 8);
    g.fillStyle = ton([58, 36, 0]);
    g.font = "900 6px system-ui, sans-serif";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText("START", x, yb - h + 4.2);
  }

  // Hinter welchem Tor ein Gegner aufgehört hat: aus seinem Lauf, wo er
  // zuletzt war. Ohne Lauf (eine Zahl von früher, als jedes Tor einen Punkt
  // gab) aus seiner Zahl.
  const toreDesLaufs = new WeakMap();
  function torZahlVon(z) {
    if (!z.lauf?.ort) return Math.max(1, z.punkte);
    if (!toreDesLaufs.has(z.lauf)) {
      const ende = z.lauf.ort(z.lauf.dauer);
      const y = START.y + (Number(ende?.b) || 0);
      toreBis(y + 1);
      toreDesLaufs.set(z.lauf, Math.max(1, state.kurs.tore.filter((t) => t.y <= y).length));
    }
    return toreDesLaufs.get(z.lauf);
  }

  // Platz 1 und die eigene Bestmarke: ein Banner quer über die Piste, hinter
  // ihrem letzten Tor. Wer darunter durchfährt, hat sie hinter sich.
  function zeichneBanner() {
    const ziele = (gegner?.gegner?.() || []).filter((z) => z.art !== "alle" && z.punkte > 0);
    if (!ziele.length) return;
    const gross = Math.round(clamp(view.cssH * 0.03, 11, 15));
    ziele.forEach((z, i) => {
      const n = torZahlVon(z);
      toreBisNr(n);
      const t = state.kurs.tore;
      const y = (t[n - 1].y + t[n].y) / 2 + i * 16;
      if (y < state.camY - 40 || y > state.camY + view.h + 40) return;
      const x0 = pisteBei(y) - PISTE_HALB - 4;
      const x1 = pisteBei(y) + PISTE_HALB + 4;
      const h = 34 * HOEHE_K;
      welt();
      tonAn(y);
      g.globalAlpha = state.tore >= n ? 0.4 : 1;
      // Schatten des Banners auf dem Schnee, die Pfosten
      g.fillStyle = ton([70, 92, 150], 0.22);
      g.fillRect(x0 + 10, y + 3, x1 - x0, 5);
      g.strokeStyle = ton([58, 63, 85]);
      g.lineWidth = 1.8;
      for (const x of [x0, x1]) {
        g.beginPath();
        g.moveTo(x, y);
        g.lineTo(x, y - h);
        g.stroke();
      }
      // Das Tuch, das im Wind leicht durchhängt und schlägt
      const welle = (u) => (ruhig() ? 0 : Math.sin(state.zeit * 3 + u * 9) * 1.1) + Math.sin(u * Math.PI) * 3;
      const band = (oben, unten) => {
        g.beginPath();
        for (let k = 0; k <= 20; k += 1) g.lineTo(lerp(x0, x1, k / 20), y - h + oben + welle(k / 20));
        for (let k = 20; k >= 0; k -= 1) g.lineTo(lerp(x0, x1, k / 20), y - h + unten + welle(k / 20));
        g.closePath();
        g.fill();
      };
      g.fillStyle = /^#[0-9a-f]{6}$/i.test(z.farbe || "") ? ton(rgbAus(z.farbe)) : z.farbe;
      band(0, 10);
      g.fillStyle = "rgba(0, 0, 0, 0.18)";
      band(7, 10);
      g.fillStyle = ton([255, 255, 255], 0.45);
      band(0, 1.5);
      // Die Schrift in Bildpunkten, damit sie überall lesbar ist.
      const text = z.art === "eigen" ? `Bestmarke · ${z.punkte} Punkte` : `Platz 1 · ${z.name} · ${z.punkte} Punkte`;
      bildschirm();
      g.font = `900 ${gross}px system-ui, sans-serif`;
      g.textAlign = "center";
      g.textBaseline = "middle";
      const sx = clamp(bildX(pisteBei(y)), 80, view.cssW - 80);
      const sy = bildY(y - h + 5 + welle(0.5));
      g.lineWidth = 3;
      g.strokeStyle = "rgba(20, 26, 60, 0.55)";
      g.strokeText(text, sx, sy);
      g.fillStyle = "#ffffff";
      g.fillText(text, sx, sy);
      g.globalAlpha = 1;
    });
  }


  /*
   * Der Fahrer, von oben und ein wenig schräg – wie die Stangen: Was hoch
   * ist, steht im Bild ein Stück weiter oben. Unten die Ski und die Teller
   * der Stöcke, auf dem Schnee; darüber, um HUEFTE angehoben, Hüfte und
   * Oberkörper in der Jacke, die Arme mit den Stöcken, der Helm mit der
   * Brille. Die Beine verbinden beides. In der Kurve legt er sich nach innen
   * (lean, in Einheiten quer zur Fahrt), die Ski kanten mit.
   *
   * Gedreht wird nach der Richtung: lokal zeigt +y nach vorn, +x nach links
   * aus seiner Sicht – auf die Innenseite einer Rechtskurve.
   */
  const HUEFTE = 4;

  // Wo der Kopf in der Welt ist – für den Schal.
  function kopfOrt(sk, lean, ziel) {
    const c = Math.cos(sk.phi);
    const s = Math.sin(sk.phi);
    // lokal (lean, 1.3) → Welt: x = c·lx + s·ly, y = −s·lx + c·ly
    ziel.x = sk.x + FIGUR * (c * lean + s * 1.3);
    ziel.y = sk.y - HUEFTE * FIGUR + FIGUR * (-s * lean + c * 1.3);
    return ziel;
  }

  function zeichneFahrer(x, y, phi, lean, { geist = null, alpha = 1, tumble = 0, ohneSki = false, hoch = 1 } = {}) {
    welt();
    tonAn(y, x);
    g.save();
    g.globalAlpha = alpha;
    // Schatten auf dem Schnee, nach unten rechts.
    if (!geist) {
      g.fillStyle = ton([60, 82, 140], 0.3);
      g.beginPath();
      g.ellipse(x + 4.6 + lean * 0.8, y + 4.2, 9.5, 6, -phi + 0.4, 0, Math.PI * 2);
      g.fill();
    }
    const winkel = -phi + tumble;
    const h = HUEFTE * hoch;
    // Wo die Füsse im angehobenen Rahmen des Körpers liegen.
    const fx = -Math.sin(phi - tumble) * h;
    const fy = Math.cos(phi - tumble) * h;
    const kante = clamp(lean / 3, -1, 1);
    const dunkel = geist || ton([29, 35, 64]);

    // Unten: Ski und Stockteller
    g.save();
    g.translate(x, y);
    g.rotate(winkel);
    g.scale(FIGUR, FIGUR);
    if (!ohneSki) {
      for (const s of [-1, 1]) {
        const sx = s * 2.4 + kante * 0.8;
        g.fillStyle = dunkel;
        g.beginPath();
        if (g.roundRect) g.roundRect(sx - 0.85, -9, 1.7, 21, 0.85);
        else g.rect(sx - 0.85, -9, 1.7, 21);
        g.fill();
        if (!geist) {
          g.fillStyle = ton([245, 166, 35]);
          g.beginPath();
          if (g.roundRect) g.roundRect(sx - 0.85, 8.5, 1.7, 3.5, 0.85);
          else g.rect(sx - 0.85, 8.5, 1.7, 3.5);
          g.fill();
          g.fillStyle = ton([255, 255, 255], 0.55);
          g.fillRect(sx - 0.25, -8, 0.5, 15);
        }
      }
      if (!geist) {
        g.fillStyle = ton([91, 99, 128]);
        for (const s of [-1, 1]) {
          g.beginPath();
          g.arc(s * 7.6 + lean * 0.3, -7.5, 0.9, 0, Math.PI * 2);
          g.fill();
        }
      }
    }
    g.restore();

    // Oben: Körper, angehoben
    g.translate(x, y - h * FIGUR);
    g.rotate(winkel);
    g.scale(FIGUR, FIGUR);
    g.lineCap = "round";
    // Beine: von der Hüfte zu den Schuhen auf den Ski
    g.strokeStyle = geist || ton([39, 48, 79]);
    g.lineWidth = 2.1;
    for (const s of [-1, 1]) {
      g.beginPath();
      g.moveTo(lean * 0.6 + s * 1.5, -0.8);
      g.lineTo(fx + s * 2.4 + kante * 0.8, fy + 0.6);
      g.stroke();
    }
    // Stöcke: von den Händen schräg nach hinten zu den Tellern
    if (!ohneSki) {
      g.strokeStyle = geist || ton([89, 97, 126]);
      g.lineWidth = 0.6;
      for (const s of [-1, 1]) {
        g.beginPath();
        g.moveTo(lean + s * 5.6, 3.4);
        g.lineTo(fx + s * 7.6 + lean * 0.3, fy - 7.5);
        g.stroke();
      }
    }
    // Arme
    g.strokeStyle = geist || ton([217, 83, 30]);
    g.lineWidth = 1.8;
    for (const s of [-1, 1]) {
      g.beginPath();
      g.moveTo(lean + s * 3.4, 0.2);
      g.lineTo(lean + s * 5.6, 3.4);
      g.stroke();
    }
    if (!geist) {
      g.fillStyle = ton([29, 35, 64]);
      for (const s of [-1, 1]) {
        g.beginPath();
        g.arc(lean + s * 5.6, 3.4, 0.95, 0, Math.PI * 2);
        g.fill();
      }
    }
    // Oberkörper
    if (geist) {
      g.fillStyle = geist;
      g.beginPath();
      g.ellipse(lean, 0, 4.2, 3.3, 0, 0, Math.PI * 2);
      g.fill();
      g.beginPath();
      g.arc(lean, 1.3, 2.4, 0, Math.PI * 2);
      g.fill();
    } else {
      const jacke = g.createLinearGradient(lean - 4, -3, lean + 4, 3);
      jacke.addColorStop(0, ton([255, 164, 67]));
      jacke.addColorStop(1, ton([226, 86, 28]));
      g.fillStyle = jacke;
      g.beginPath();
      g.ellipse(lean, 0, 4.2, 3.3, 0, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = ton([255, 255, 255], 0.9);
      g.lineWidth = 0.7;
      g.beginPath();
      g.moveTo(lean - 3.9, -0.6);
      g.lineTo(lean + 3.9, -0.6);
      g.stroke();
      // Startnummer auf dem Rücken
      g.fillStyle = ton([255, 255, 255]);
      g.fillRect(lean - 1.4, -2.6, 2.8, 1.6);
      // Helm, Brille
      const helm = g.createRadialGradient(lean - 0.8, 0.6, 0.3, lean, 1.3, 2.6);
      helm.addColorStop(0, ton([255, 255, 255]));
      helm.addColorStop(1, ton([201, 214, 234]));
      g.fillStyle = helm;
      g.beginPath();
      g.arc(lean, 1.3, 2.45, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = ton([47, 116, 230]);
      g.fillRect(lean - 0.45, -1.1, 0.9, 4.6);
      const brille = g.createLinearGradient(lean - 2, 3, lean + 2, 3);
      brille.addColorStop(0, ton([255, 209, 102]));
      brille.addColorStop(0.5, ton([255, 122, 89]));
      brille.addColorStop(1, ton([155, 93, 229]));
      g.strokeStyle = brille;
      g.lineWidth = 1.3;
      g.beginPath();
      g.arc(lean, 1.3, 2.3, Math.PI * 0.16, Math.PI * 0.84);
      g.stroke();
    }
    g.restore();
  }

  // Der Schal weht hinter dem Kopf her – eine Kette, die der Bewegung folgt.
  function zeichneSchal() {
    const s = state.schal;
    if (s.length < 2) return;
    welt();
    tonAn(state.sk.y, state.sk.x);
    g.lineCap = "round";
    g.lineJoin = "round";
    g.strokeStyle = ton([232, 67, 58]);
    g.lineWidth = 1.5;
    g.beginPath();
    g.moveTo(s[0].x, s[0].y);
    for (let i = 1; i < s.length; i += 1) g.lineTo(s[i].x, s[i].y);
    g.stroke();
    g.strokeStyle = ton([255, 210, 63]);
    g.lineWidth = 0.6;
    g.stroke();
  }

  function zeichneGeister() {
    if (!gegner || state.phase === "bereit") return;
    const orte = window.LernappGeist?.orte?.(gegner) || [];
    if (!orte.length) return;
    orte.forEach((o) => {
      // Wem im Live-Modus zugeschaut wird, der ist der Fahrer selbst – kein
      // Schatten dazu, nur sein Name (geist.js, namen).
      if (o.ziel) return;
      zeichneFahrer(START.x + o.a, START.y + o.b, (o.c || 0) / 100, 0, { geist: o.farbe, alpha: 0.5 * o.blass });
    });
    bildschirm();
    window.LernappGeist.namen(g, orte.map((o) => {
      const dy = START.y + o.b - state.sk.y;
      return { ...o, sx: bildX(START.x + o.a), sy: bildY(START.y + o.b) - 12 * view.s, weit: `${dy > 0 ? "+" : ""}${Math.round(dy / METER)} m` };
    }), { breit: view.cssW, hoch: view.cssH });
  }

  function zeichnePulver() {
    if (!state.teile.length && !state.ringe.length) return;
    welt();
    tonAn(state.sk.y, state.sk.x);
    const weiss = pulverIm("weiss");
    const schatten = pulverIm("schatten");
    for (const r of state.ringe) {
      const k = clamp(r.leben / r.max, 0, 1);
      g.globalAlpha = k * 0.8;
      g.strokeStyle = ton([255, 255, 255]);
      g.lineWidth = 3 * k + 0.5;
      g.beginPath();
      g.ellipse(r.x, r.y, r.r, r.r * 0.75, 0, 0, Math.PI * 2);
      g.stroke();
    }
    // Die Schneewolke eines Sturzes wirft einen bläulichen Schatten – sonst
    // verschwände sie weiss auf weiss.
    for (const t of state.teile) {
      if (!t.schatten) continue;
      const k = clamp(t.leben / t.max, 0, 1);
      const r = t.r * (1.6 - k * 0.6);
      g.globalAlpha = Math.min(1, k * 1.6) * t.a * 0.5;
      g.drawImage(schatten, t.x - r + r * 0.35, t.y - r + r * 0.45, r * 2, r * 2);
    }
    for (const t of state.teile) {
      const k = clamp(t.leben / t.max, 0, 1);
      const r = t.r * (1.6 - k * 0.6);
      g.globalAlpha = Math.min(1, k * 1.6) * t.a;
      g.drawImage(weiss, t.x - r, t.y - r, r * 2, r * 2);
    }
    g.globalAlpha = 1;
  }

  function zeichneTruemmer() {
    if (!state.truemmer.length) return;
    welt();
    tonAn(state.sk.y, state.sk.x);
    for (const t of state.truemmer) {
      g.save();
      g.translate(t.x, t.y - t.z * HOEHE_K);
      g.rotate(t.rot);
      g.scale(FIGUR, FIGUR);
      if (t.art === "ski") {
        g.fillStyle = ton([29, 35, 64]);
        g.fillRect(-0.85, -10, 1.7, 21);
        g.fillStyle = ton([245, 166, 35]);
        g.fillRect(-0.85, 8, 1.7, 3);
      } else {
        g.strokeStyle = ton([91, 99, 128]);
        g.lineWidth = 0.6;
        g.beginPath();
        g.moveTo(0, -6.5);
        g.lineTo(0, 6.5);
        g.stroke();
      }
      g.restore();
    }
  }

  // Nachts die Stirnlampe des Fahrers: ein Kegel voraus und ein Schein um
  // ihn. Das Licht des Tages und das Flutlicht liegen schon im Hang.
  function zeichneLicht(licht) {
    if (licht.nacht <= 0.02) return;
    welt();
    g.globalCompositeOperation = "lighter";
    const sk = state.sk;
    g.globalAlpha = 0.3 * licht.nacht;
    g.save();
    g.translate(sk.x + Math.sin(sk.phi) * 70, sk.y + Math.cos(sk.phi) * 70);
    g.rotate(-sk.phi);
    g.drawImage(bilder.licht, -40, -70, 80, 140);
    g.restore();
    g.globalAlpha = 0.14 * licht.nacht;
    g.drawImage(bilder.licht, sk.x - 22, sk.y - 22, 44, 44);
    g.globalAlpha = 1;
    g.globalCompositeOperation = "source-over";
  }

  // Schneeflocken zwischen Kamera und Hang: Je näher an der Kamera, desto
  // grösser und desto schneller ziehen sie vorbei – das gibt dem Bild Tiefe.
  function zeichneFlocken(licht) {
    if (!state.flocken.length) return;
    bildschirm();
    for (const f of state.flocken) {
      const r = 0.8 + f.z * 2.6;
      g.globalAlpha = (0.35 + 0.5 * f.z) * (0.75 + 0.25 * licht.nacht);
      g.drawImage(bilder.flocke, f.x - r, f.y - r, r * 2, r * 2);
    }
    g.globalAlpha = 1;
  }

  function zeichneStriche() {
    if (!state.striche.length) return;
    bildschirm();
    g.lineCap = "round";
    g.lineWidth = 1.2;
    for (const s of state.striche) {
      g.strokeStyle = `rgba(255, 255, 255, ${s.alpha.toFixed(3)})`;
      g.beginPath();
      g.moveTo(s.x, s.y);
      g.lineTo(s.x, s.y + s.len);
      g.stroke();
    }
  }

  function zeichneSchriften() {
    if (!state.schriften.length) return;
    bildschirm();
    g.textAlign = "center";
    g.textBaseline = "middle";
    state.schriften.forEach((s) => {
      const k = clamp(s.leben / s.max, 0, 1);
      const steig = (1 - k) * 30;
      const pop = 1 + Math.max(0, (k - 0.82) / 0.18) * 0.35;
      g.globalAlpha = Math.min(1, k * 2);
      const gross = Math.round(s.gross * clamp(view.s, 0.9, 1.6) * pop);
      g.font = `900 ${gross}px system-ui, sans-serif`;
      // Nie über den Rand und nie unter die Knöpfe oben.
      const halb = g.measureText(s.text).width / 2 + 8;
      const wx = s.folgt ? state.sk.x + s.x : s.x;
      const wy = s.folgt ? state.sk.y + s.y : s.y;
      const x = clamp(bildX(wx), halb, Math.max(halb, view.cssW - halb));
      const y = Math.max(view.freiPx + gross, bildY(wy) - steig);
      g.lineWidth = 4;
      g.strokeStyle = "rgba(20, 30, 70, 0.55)";
      g.strokeText(s.text, x, y);
      g.fillStyle = s.farbe;
      g.fillText(s.text, x, y);
    });
    g.globalAlpha = 1;
  }

  // Die Tore oben links und darunter die Reihe perfekter Tore mit dem, was
  // jedes davon gerade wert ist. Die Punkte stehen oben in der Leiste.
  function zeichneAnzeige() {
    bildschirm();
    // Auf dem Handy liegt der obere Rand unter den Knöpfen: dann darunter.
    g.translate(0, shell?.frei?.(canvas) || 0);
    const gross = clamp(view.cssH * 0.055, 14, 24);
    g.font = `900 ${Math.round(gross)}px system-ui, sans-serif`;
    g.textAlign = "left";
    g.textBaseline = "middle";
    const text = `${state.tore} ${state.tore === 1 ? "Tor" : "Tore"}`;
    const w = g.measureText(text).width + gross * 1.1;
    const x = 12;
    const y = 12;
    g.fillStyle = "rgba(24, 34, 74, 0.6)";
    g.beginPath();
    if (g.roundRect) g.roundRect(x, y, w, gross * 1.6, gross * 0.8);
    else g.rect(x, y, w, gross * 1.6);
    g.fill();
    g.fillStyle = "#ffffff";
    g.fillText(text, x + gross * 0.55, y + gross * 0.82);
    if (state.reihe >= 1) {
      const klein = Math.round(gross * 0.7);
      g.font = `900 ${klein}px system-ui, sans-serif`;
      const t2 = `perfekt ×${state.reihe} · +${wertDesTors(true, state.reihe)}`;
      const w2 = g.measureText(t2).width + klein * 1.2;
      const glanz = 0.75 + 0.25 * Math.sin(state.zeit * 8);
      g.fillStyle = `rgba(255, 196, 64, ${(0.85 * glanz).toFixed(3)})`;
      g.beginPath();
      if (g.roundRect) g.roundRect(x, y + gross * 1.85, w2, klein * 1.6, klein * 0.8);
      else g.rect(x, y + gross * 1.85, w2, klein * 1.6);
      g.fill();
      g.fillStyle = "#3a2400";
      g.fillText(t2, x + klein * 0.6, y + gross * 1.85 + klein * 0.82);
    }
  }

  const zeichenLicht = lichtBei(0);
  function zeichnen() {
    if (!g) return;
    zeichneHang();
    const licht = lichtBei(meterBei(state.sk.y), zeichenLicht);
    zeichneGlitzern(licht);
    zeichneSpur();
    zeichneTorlinien();
    zeichneStart();
    zeichneBanner();
    zeichneTore(true);
    zeichneGeister();
    zeichnePulver();
    const sk = state.sk;
    if (state.schritt === "sturz") {
      zeichneFahrer(sk.x, sk.y, sk.phi, 0, { tumble: state.tumble, ohneSki: true, hoch: 0.3 });
      zeichneTruemmer();
    } else {
      zeichneSchal();
      zeichneFahrer(sk.x, sk.y, sk.phi, state.lean);
    }
    zeichneTore(false);
    zeichneLicht(licht);
    zeichneFlocken(licht);
    zeichneStriche();
    zeichneSchriften();
    if (state.phase !== "bereit") zeichneAnzeige();
  }

  // ---------------------------------------------------------------------------
  // Teilchen und Schriften
  // ---------------------------------------------------------------------------
  // Pulverschnee, der von der äusseren Kante weggeschleudert wird. dichte:
  // wie viele je Sekunde, nach der Härte der Kurve.
  function spray(dt, aussenX, aussenY, kraft) {
    if (kraft <= 0.02) return;
    const sk = state.sk;
    let anzahl = kraft * 150 * dt * (ruhig() ? 0.3 : 1) + state.sprayRest;
    state.sprayRest = anzahl % 1;
    anzahl = Math.floor(anzahl);
    const vx = Math.sin(sk.phi) * sk.v;
    const vy = Math.cos(sk.phi) * sk.v;
    const zurueck = -1;
    for (let i = 0; i < anzahl && state.teile.length < 260; i += 1) {
      // Aus der äusseren Kante, irgendwo zwischen Schuh und Skiende.
      const laengs = Math.random() * 12 * zurueck;
      const quer = 25 + Math.random() * 90 * kraft;
      state.teile.push({
        x: sk.x + aussenX * 5 + Math.sin(sk.phi) * laengs,
        y: sk.y + aussenY * 5 + Math.cos(sk.phi) * laengs,
        vx: aussenX * quer + vx * 0.15 + (Math.random() - 0.5) * 24,
        vy: aussenY * quer + vy * 0.15 + (Math.random() - 0.5) * 24,
        r: 2 + Math.random() * 4 * kraft,
        a: 0.65 + Math.random() * 0.35,
        schatten: true,
        leben: 0.3 + Math.random() * 0.4,
        max: 0.7,
      });
    }
  }

  function wolkeSchnee(x, y, anzahl, kraft = 1, gross = 1) {
    if (ruhig()) anzahl = Math.ceil(anzahl / 3);
    for (let i = 0; i < anzahl && state.teile.length < 320; i += 1) {
      const w = Math.random() * Math.PI * 2;
      const v = (30 + Math.random() * 160) * kraft;
      state.teile.push({
        x: x + (Math.random() - 0.5) * 6,
        y: y + (Math.random() - 0.5) * 6,
        vx: Math.cos(w) * v,
        vy: Math.sin(w) * v,
        r: (2 + Math.random() * 4) * gross,
        schatten: true,
        a: 0.6 + Math.random() * 0.4,
        leben: 0.6 + Math.random() * 0.8,
        max: 1.4,
      });
    }
  }

  function funkeln(x, y) {
    if (ruhig()) return;
    for (let i = 0; i < 14 && state.teile.length < 320; i += 1) {
      const w = Math.random() * Math.PI * 2;
      const v = 20 + Math.random() * 70;
      state.teile.push({ x, y, vx: Math.cos(w) * v, vy: Math.sin(w) * v, r: 1 + Math.random() * 1.2, a: 1, leben: 0.5 + Math.random() * 0.3, max: 0.8 });
    }
  }

  // folgt: x, y zählen vom Fahrer aus – die Schrift fährt mit.
  function schrift(text, x, y, farbe, gross, leben = 1.1, folgt = false) {
    // Am Fahrer steht an einem Platz nur eine Schrift: die neue ersetzt die alte.
    if (folgt) state.schriften = state.schriften.filter((s) => !(s.folgt && s.x === x && s.y === y));
    state.schriften.push({ text, x, y, farbe, gross, leben, max: leben, folgt });
  }

  // ---------------------------------------------------------------------------
  // Die Fahrt
  // ---------------------------------------------------------------------------
  // Wo die Ski stehen – für die Spur. Quer zur Fahrt, die Kante nach innen.
  function merkeSpur() {
    const sk = state.sk;
    const qx = Math.cos(sk.phi);
    const qy = -Math.sin(sk.phi);
    const kante = clamp(state.lean / 3, -1, 1) * 0.7;
    const sp = state.spur;
    sp.l.push({ x: sk.x + qx * (2.5 + kante) - Math.sin(sk.phi) * 2, y: sk.y + qy * (2.5 + kante) - Math.cos(sk.phi) * 2 });
    sp.r.push({ x: sk.x - qx * (2.5 - kante) - Math.sin(sk.phi) * 2, y: sk.y - qy * (2.5 - kante) - Math.cos(sk.phi) * 2 });
    // Was oben aus dem Bild ist, braucht niemand mehr.
    while (sp.l.length > 700 || (sp.l.length > 2 && sp.l[0].y < state.camY - 30)) { sp.l.shift(); sp.r.shift(); }
  }

  // Ist er zwischen zwei Bildern über die Linie eines Tores gefahren? Dann
  // zählt, wo er sie gekreuzt hat. pruefen: falsch beim Zuschauen – dort
  // stürzt niemand, die Tore werden nur abgehakt.
  function toreQueren(x0, y0, x1, y1, pruefen) {
    for (const tor of state.kurs.tore) {
      if (tor.zustand !== "offen") continue;
      if (tor.y > y1) break;
      if (tor.y <= y0) continue;
      const k = (tor.y - y0) / Math.max(1e-6, y1 - y0);
      const x = lerp(x0, x1, k);
      const l = stangeL(tor);
      const r = stangeR(tor);
      const frei = R_STANGE + R_FAHRER * 0.55;
      if (x > l + frei && x < r - frei) {
        torDurch(tor, x);
      } else if (!pruefen) {
        tor.zustand = "durch";
        state.tore += 1;
      } else if (Math.abs(x - l) < R_STANGE + R_FAHRER || Math.abs(x - r) < R_STANGE + R_FAHRER) {
        tor.zustand = "getroffen";
        tor.wackel[Math.abs(x - l) < Math.abs(x - r) ? 0 : 1] = 1;
        sturz(tor, "stange");
        return;
      } else {
        tor.zustand = "verpasst";
        sturz(tor, "verpasst");
        return;
      }
    }
  }

  // Das Tor klackt, beim Spielen wie beim Zuschauen. Dazu leise die Harfe
  // für ein perfektes, in Folge die Leiter – alle 25 Tore stattdessen der
  // Meilenstein (nie drei Klänge übereinander).
  function torKlang(perfekt) {
    const jetzt = performance.now();
    if (jetzt - torKlack < 60) return;
    torKlack = jetzt;
    klang()?.ton("slalom.tor", { laut: 0.8 });
    if (state.tore % 25 === 0) klang()?.ton("meilenstein");
    else if (perfekt && state.reihe < 2) klang()?.ton("perfekt", { laut: 0.7 });
  }

  function torDurch(tor, x) {
    const sk = state.sk;
    const l = stangeL(tor);
    const r = stangeR(tor);
    const innen = tor.innen < 0 ? l : r;
    const perfekt = Math.abs(x - innen) < Math.max(7, tor.breite * 0.26);
    // Haarscharf an einer Stange vorbei: ein Wimpernschlag Zeitlupe.
    const knapp = Math.min(x - l, r - x) < R_STANGE + R_FAHRER + 1.5;
    tor.zustand = perfekt ? "perfekt" : "durch";
    tor.wackel[tor.innen < 0 ? 0 : 1] = perfekt ? 0.9 : 0.25;
    state.reihe = perfekt ? state.reihe + 1 : 0;
    const wert = wertDesTors(perfekt, state.reihe);
    if (perfekt) {
      funkeln(innen, tor.y);
      schrift(state.reihe >= 2 ? `+${wert} perfekt ×${state.reihe}` : `+${wert} perfekt!`, 0, -30, "#ffd23f", 13, 1.1, true);
    } else if (knapp) {
      schrift("knapp!", 0, -30, "#ffffff", 12, 0.9, true);
    }
    if (knapp && !ruhig() && state.phase === "spiel") state.zeitlupe = Math.max(state.zeitlupe, 0.12);
    state.tore += 1;
    torKlang(perfekt);
    // Beim Zuschauen kommt die Zahl aus dem Lauf.
    if (state.phase === "zuschauen") return;
    state.bonus += wert - 1;
    state.punkte += wert;
    shell.setCount(state.punkte);
    if (perfekt) {
      state.perfekte += 1;
      sk.v += STOSS_PERFEKT;
      kids()?.vibrate?.(12);
    } else {
      kids()?.vibrate?.(5);
    }
    if (state.tore % 25 === 0) schrift(`${state.tore} Tore!`, 0, -52, "#7ff3ff", 18, 1.4, true);
  }

  function randPruefen() {
    const sk = state.sk;
    const p = pisteBei(sk.y);
    if (Math.abs(sk.x - p) > PISTE_HALB - 4) sturz(null, "rand");
  }

  function sturz(tor, grund) {
    if (state.schritt !== "fahrt") return;
    const sk = state.sk;
    state.schritt = "sturz";
    state.sturz = { grund, tor, vx: Math.sin(sk.phi) * sk.v, vy: Math.cos(sk.phi) * sk.v, dreh: (Math.random() < 0.5 ? -1 : 1) * (7 + Math.random() * 4) };
    state.reihe = 0;
    state.stoss = 1;
    state.zeitlupe = ruhig() ? 0 : 0.35;
    if (tor) tor.blink = 1.4;
    wolkeSchnee(sk.x, sk.y, 80, 1.2, 1.6);
    state.ringe.push({ x: sk.x, y: sk.y, r: 6, leben: 0.6, max: 0.6 });
    // Was passiert ist, steht gross da: Daran soll man sich erinnern.
    const text = { verpasst: "Tor verpasst!", stange: "Stange!", rand: "Ab in den Wald!" }[grund];
    if (text) schrift(text, sk.x, sk.y - 26, "#ff5a4a", 19, 1.6);
    // Die Kanten verstummen, er stürzt in den Schnee – auch am Ende eines
    // Laufs, den man anschaut.
    carvenAus();
    klang()?.ton("slalom.sturz");
    // Ski und Stöcke fliegen davon.
    const v = sk.v;
    for (let i = 0; i < 4; i += 1) {
      const w = sk.phi + (Math.random() - 0.5) * 1.6;
      const tempo = v * (0.35 + Math.random() * 0.5);
      state.truemmer.push({
        art: i < 2 ? "ski" : "stock",
        x: sk.x, y: sk.y, z: 0,
        vx: Math.sin(w) * tempo + (Math.random() - 0.5) * 60,
        vy: Math.cos(w) * tempo + (Math.random() - 0.5) * 60,
        vz: 40 + Math.random() * 70,
        rot: -sk.phi, vrot: (Math.random() - 0.5) * 18,
      });
    }
    if (state.phase === "spiel") {
      kids()?.vibrate?.([30, 40, 60]);
      stepTimer = window.setTimeout(finish, 1150);
    }
  }

  function physik(dt) {
    const sk = state.sk;
    const dreh = drehBei(sk.y);
    const ziel = lenkung * dreh;
    sk.w += (ziel - sk.w) * (1 - Math.exp(-dt / DREH_TAU));
    sk.phi += sk.w * dt;
    if (sk.phi > PHI_MAX) { sk.phi = PHI_MAX; if (sk.w > 0) sk.w = 0; }
    if (sk.phi < -PHI_MAX) { sk.phi = -PHI_MAX; if (sk.w < 0) sk.w = 0; }
    const zielV = tempoBei(sk.y) * Math.pow(Math.max(0, Math.cos(sk.phi)), 0.8);
    sk.v += (zielV - sk.v) * (1 - Math.exp(-dt * ANZUG));
    sk.v = Math.max(V_MIN, sk.v);
    const x0 = sk.x;
    const y0 = sk.y;
    sk.x += sk.v * Math.sin(sk.phi) * dt;
    sk.y += sk.v * Math.cos(sk.phi) * dt;
    state.spitze = Math.max(state.spitze, sk.v);
    toreBis(sk.y + 400);
    toreQueren(x0, y0, sk.x, sk.y, true);
    if (state.schritt === "fahrt") randPruefen();
  }

  // Der Sturz: der Fahrer rutscht und überschlägt sich, Ski und Stöcke
  // fliegen, der Schnee staubt.
  function sturzTakt(dt) {
    const sk = state.sk;
    const st = state.sturz;
    if (!st) return;
    const brems = Math.exp(-dt * 2.6);
    st.vx *= brems;
    st.vy *= brems;
    st.dreh *= Math.exp(-dt * 1.8);
    sk.x += st.vx * dt;
    sk.y += st.vy * dt;
    state.tumble += st.dreh * dt;
    if (Math.hypot(st.vx, st.vy) > 30 && Math.random() < dt * 30) wolkeSchnee(sk.x, sk.y, 2, 0.4);
    for (const t of state.truemmer) {
      t.vz -= 260 * dt;
      t.z += t.vz * dt;
      if (t.z < 0) { t.z = 0; t.vz *= -0.3; t.vx *= 0.6; t.vy *= 0.6; t.vrot *= 0.6; }
      t.vx *= Math.exp(-dt * 1.2);
      t.vy *= Math.exp(-dt * 1.2);
      t.x += t.vx * dt;
      t.y += t.vy * dt;
      t.rot += t.vrot * dt;
    }
  }

  const schalKopf = { x: 0, y: 0 };

  // Der Schal: ein paar Glieder, die dem Kopf mit Abstand folgen und im
  // Fahrtwind flattern.
  function schalTakt() {
    const sk = state.sk;
    const s = state.schal;
    const kopf = kopfOrt(sk, state.lean, schalKopf);
    if (!s.length) for (let i = 0; i < 7; i += 1) s.push({ x: kopf.x, y: kopf.y - i * 2.2 });
    s[0].x = kopf.x;
    s[0].y = kopf.y;
    const zurueckX = -Math.sin(sk.phi);
    const zurueckY = -Math.cos(sk.phi);
    for (let i = 1; i < s.length; i += 1) {
      const a = s[i - 1];
      const b = s[i];
      const flattern = Math.sin(state.zeit * 18 - i * 0.9) * 0.7 * (ruhig() ? 0 : 1);
      const zx = a.x + zurueckX * 2.2 + Math.cos(sk.phi) * flattern;
      const zy = a.y + zurueckY * 2.2 - Math.sin(sk.phi) * flattern;
      b.x += (zx - b.x) * 0.5;
      b.y += (zy - b.y) * 0.5;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d = Math.hypot(dx, dy) || 1;
      b.x = a.x + (dx / d) * 2.2;
      b.y = a.y + (dy / d) * 2.2;
    }
  }

  // Die Flocken ziehen gegen die Fahrt über das Bild – um den Fahrer herum,
  // wie der Hang, nur schneller, je näher sie der Kamera sind – und treiben
  // ein wenig im Wind. Wer aus dem Bild ist, kommt am anderen Rand wieder.
  function flockenTakt(dt) {
    const fl = state.flocken;
    const soll = ruhig() ? 0 : 46;
    while (fl.length < soll) fl.push({ x: Math.random() * view.cssW, y: Math.random() * view.cssH, z: Math.random(), wind: (Math.random() - 0.3) * 20 });
    if (fl.length > soll) fl.length = soll;
    const sk = state.sk;
    const faehrt = state.schritt === "fahrt" && state.phase !== "bereit";
    const vx = faehrt ? Math.sin(sk.phi) * sk.v * view.s : 0;
    const vy = faehrt ? Math.cos(sk.phi) * sk.v * view.s : 0;
    for (const f of fl) {
      const tiefe = 1 + f.z * 0.9;
      f.x += (f.wind - vx * tiefe) * dt;
      f.y += (8 - vy * tiefe) * dt;
      if (f.y < -6) { f.y += view.cssH + 12; f.x = Math.random() * view.cssW; }
      if (f.y > view.cssH + 6) f.y -= view.cssH + 12;
      if (f.x < -6) f.x += view.cssW + 12;
      if (f.x > view.cssW + 6) f.x -= view.cssW + 12;
    }
  }

  // Was sich bewegt, auch wenn gerade niemand fährt: Pulver, Schriften,
  // Fahnen, Flocken, Geschwindigkeitslinien, Kamera.
  function nebenbei(dt) {
    const sk = state.sk;
    for (let i = state.teile.length - 1; i >= 0; i -= 1) {
      const t = state.teile[i];
      t.vx *= Math.exp(-dt * 3.2);
      t.vy *= Math.exp(-dt * 3.2);
      t.x += t.vx * dt;
      t.y += t.vy * dt;
      t.leben -= dt;
      if (t.leben <= 0) state.teile.splice(i, 1);
    }
    for (let i = state.ringe.length - 1; i >= 0; i -= 1) {
      const r = state.ringe[i];
      r.leben -= dt;
      r.r += dt * 110 * (r.leben / r.max + 0.2);
      if (r.leben <= 0) state.ringe.splice(i, 1);
    }
    flockenTakt(dt);
    for (let i = state.schriften.length - 1; i >= 0; i -= 1) {
      state.schriften[i].leben -= dt;
      if (state.schriften[i].leben <= 0) state.schriften.splice(i, 1);
    }
    for (const tor of state.kurs.tore) {
      if (tor.y < state.camY - 60) continue;
      if (tor.y > state.camY + view.h + 80) break;
      tor.wackel[0] *= Math.exp(-dt * 4);
      tor.wackel[1] *= Math.exp(-dt * 4);
      if (tor.wackel[0] > 0.01) tor.wackel[0] = Math.abs(tor.wackel[0]) * Math.cos(state.zeit * 26);
      if (tor.wackel[1] > 0.01) tor.wackel[1] = Math.abs(tor.wackel[1]) * Math.cos(state.zeit * 26 + 1);
      if (tor.blink > 0) tor.blink = Math.max(0, tor.blink - dt);
    }
    // Geschwindigkeitslinien: Sie ziehen nach oben, je schneller, desto mehr.
    const v = state.schritt === "fahrt" && state.phase !== "bereit" ? sk.v : 0;
    const dichte = clamp((v - 210) / 150, 0, 1);
    if (!ruhig() && dichte > 0 && Math.random() < dt * 30 * dichte) {
      // Nur an den Rändern – die Mitte gehört den Toren.
      const rand = Math.random() * view.cssW * 0.2;
      state.striche.push({ x: Math.random() < 0.5 ? rand : view.cssW - rand, y: view.cssH + 10, len: 16 + 40 * dichte, tempo: (1.4 + Math.random()) * v * view.s, alpha: 0.14 + 0.24 * dichte });
    }
    for (let i = state.striche.length - 1; i >= 0; i -= 1) {
      const s = state.striche[i];
      s.y -= s.tempo * dt;
      if (s.y + s.len < -10) state.striche.splice(i, 1);
    }
    if (state.stoss > 0) state.stoss = Math.max(0, state.stoss - dt * 2.4);
    // Die Kamera: den Hang hinunter fest am Fahrer, quer weich nach.
    if (state.schritt !== "sturz") state.camY = camYZiel();
    else state.camY += (camYZiel() - state.camY) * (1 - Math.exp(-dt * 6));
    state.camX += (camXZiel() - state.camX) * (1 - Math.exp(-dt * (state.phase === "bereit" ? 20 : 3.5)));
    toreBis(state.camY + view.h + 200);
  }

  function takt(dtEcht) {
    let dt = dtEcht;
    // Beim Sturz kurz Zeitlupe – man soll sehen, was passiert ist –, und
    // einen Wimpernschlag lang, wenn es haarscharf war.
    if (state.zeitlupe > 0) {
      state.zeitlupe = Math.max(0, state.zeitlupe - dtEcht);
      dt = dtEcht * 0.3;
    }
    state.zeit += dt;
    const sk = state.sk;

    if (state.phase === "zuschauen") {
      zuschauenTakt(dt);
    } else if (state.schritt === "fahrt" && state.phase === "spiel") {
      const n = Math.max(1, Math.ceil(dt / TAKT));
      for (let i = 0; i < n && state.schritt === "fahrt"; i += 1) physik(dt / n);
      if (state.schritt === "fahrt") {
        state.lean += (clamp((sk.w * sk.v) / 260, -1, 1) * 2.6 - state.lean) * (1 - Math.exp(-dt * 10));
        fahrtEffekte(dt);
      }
    } else if (state.schritt === "start") {
      // Vor dem ersten Druck steht er am Start und wippt.
      sk.phi = Math.sin(state.zeit * 1.6) * (ruhig() ? 0 : 0.05);
      state.lean = Math.sin(state.zeit * 2.2) * (ruhig() ? 0 : 0.4);
    }
    if (state.schritt === "sturz") sturzTakt(dt);
    if (state.schritt !== "sturz") schalTakt();
    nebenbei(dt);

    if (state.phase === "spiel") {
      gegner?.takt(state.punkte, { a: Math.round(sk.x - START.x), b: Math.round(sk.y - START.y), c: Math.round(sk.phi * 100) });
    }
  }

  // Spur und Pulver aus der Bewegung – beim Fahren wie beim Zuschauen.
  function fahrtEffekte(dt) {
    const sk = state.sk;
    const sp = state.spur;
    sp.weg += sk.v * dt;
    if (sp.weg > 4) { sp.weg = 0; merkeSpur(); }
    // Je enger die Kurve und je schneller, desto mehr Pulver – von der
    // äusseren Kante.
    const kraft = clamp((Math.abs(sk.w) * sk.v) / 700, 0, 1) * clamp(Math.abs(sk.phi) * 1.6 + 0.3, 0, 1);
    const innen = Math.sign(sk.w || 1);
    spray(dt, -innen * Math.cos(sk.phi), innen * Math.sin(sk.phi), kraft);
    carvenStellen();
  }

  function loop(now) {
    frame = window.requestAnimationFrame(loop);
    // Nie rückwärts: Der Zeitstempel eines Bildes kann vor dem letzten
    // Neustart liegen.
    const dt = clamp((now - last) / 1000, 0, 0.05);
    last = now;
    messen();
    takt(dt);
    zeichnen();
  }

  // ---------------------------------------------------------------------------
  // Zuschauen
  // ---------------------------------------------------------------------------
  // Ein aufgezeichneter Lauf durch seinen eigenen Kurs: Der Zufall hält die
  // Saat (geist.js, zuschauer), startRun steckt damit dieselben Tore, und der
  // Fahrer steht Bild für Bild dort, wo er damals war. Kurven, Spur und
  // Pulver folgen aus seiner Bewegung; am Ende des Laufs stürzt er.
  function zuschauenStarten() {
    if (!zuschauer?.lauf) return;
    startRun();
    state.phase = "zuschauen";
    state.schritt = "fahrt";
    shell.setPhase("play");
    zuschauer.los();
    carvenAn();
  }

  function zuschauenTakt(dt) {
    const sk = state.sk;
    if (state.schritt === "sturz") { zuschauer.weiter(); return; }
    const s = zuschauer.stand();
    if (!s) return;
    const x0 = sk.x;
    const y0 = sk.y;
    const phiVorher = sk.phi;
    sk.x = START.x + s.a;
    sk.y = START.y + s.b;
    sk.phi = (s.c || 0) / 100;
    sk.v = Math.hypot(s.va || 0, s.vb || 0);
    const w = dt > 0 ? (sk.phi - phiVorher) / dt : 0;
    sk.w += (clamp(w, -4, 4) - sk.w) * (1 - Math.exp(-dt * 12));
    state.lean += (clamp((sk.w * sk.v) / 260, -1, 1) * 2.6 - state.lean) * (1 - Math.exp(-dt * 10));
    toreBis(sk.y + 400);
    if (sk.y > y0) toreQueren(x0, y0, sk.x, sk.y, false);
    const punkte = Math.max(0, Math.floor(s.punkte));
    if (punkte !== state.punkte) {
      state.punkte = punkte;
      shell.setCount(punkte);
    }
    if (sk.v > 1) fahrtEffekte(dt);
    // Am Ende des Laufs: der Sturz, wie er damals war.
    if (zuschauer.fertig?.() && state.schritt === "fahrt") {
      const naechstes = state.kurs.tore.find((t) => t.zustand === "offen" && t.y > sk.y - 5);
      sk.v = Math.max(sk.v, 80);
      state.schritt = "fahrt";
      sturz(naechstes && naechstes.y - sk.y < 40 ? naechstes : null, "ende");
    }
    zuschauer.weiter();
  }

  // ---------------------------------------------------------------------------
  // Links und rechts
  // ---------------------------------------------------------------------------
  // Die Runde beginnt: mit dem ersten Druck – oder im Live-Modus zum
  // gemeinsamen Start (game-shell.js, live.los).
  function losGehts() {
    if (state.phase !== "bereit") return;
    state.phase = "spiel";
    state.schritt = "fahrt";
    state.sk.v = 70;
    state.losZeit = state.zeit;
    shell.setPhase("play");
    gegner?.los();
    wolkeSchnee(state.sk.x, state.sk.y + 4, 10, 0.4);
    kids()?.vibrate?.(8);
    carvenAn();
  }

  function lenkeNeu() {
    lenkung = finger.length ? finger[finger.length - 1].r : 0;
    knoepfe?.querySelector(".sk-knopf-l")?.classList.toggle("ist-an", lenkung < 0);
    knoepfe?.querySelector(".sk-knopf-r")?.classList.toggle("ist-an", lenkung > 0);
  }

  // Ein Finger (oder eine Taste) kommt: Er lenkt, bis er geht. Der erste
  // startet die Runde.
  function fingerAuf(id, r) {
    const da = finger.findIndex((f) => f.id === id);
    if (da >= 0) finger.splice(da, 1);
    finger.push({ id, r });
    lenkeNeu();
    losGehts();
  }

  function fingerWeg(id) {
    const da = finger.findIndex((f) => f.id === id);
    if (da < 0) return;
    finger.splice(da, 1);
    lenkeNeu();
  }

  function alleWeg() {
    finger.length = 0;
    lenkeNeu();
  }

  // Für die Prüfskripte und die Vorführung: lenken wie mit einem Finger –
  // -1 links, 1 rechts, 0 loslassen.
  function lenke(r) {
    finger.length = 0;
    if (r) finger.push({ id: "auto", r: Math.sign(r) });
    lenkeNeu();
    if (r) losGehts();
  }

  // ---------------------------------------------------------------------------
  // Ablauf
  // ---------------------------------------------------------------------------
  function startRun() {
    clearStep();
    stopLoop();
    carvenAus();
    shell.closeOverlay();
    zufall.neu();
    shell.setPhase("intro");
    state.phase = "bereit";
    state.schritt = "start";
    state.punkte = 0;
    state.tore = 0;
    state.bonus = 0;
    state.perfekte = 0;
    state.reihe = 0;
    state.spitze = 0;
    // Zuerst die Lage der beiden Wellen der Piste, dann Tor um Tor – immer
    // in dieser Reihenfolge, damit der Kurs aus derselben Saat derselbe ist.
    state.kurs = { tore: [], seite: 1, vertikale: 0, pause: 0, wellen: [zufall.zahl() * Math.PI * 2, zufall.zahl() * Math.PI * 2] };
    // Die Streifen des Hangs gehören zum alten Kurs.
    hangLeeren();
    START.x = 0;
    state.sk = { x: START.x, y: START.y, phi: 0, w: 0, v: 0 };
    state.spur = { l: [], r: [], weg: 0 };
    state.schal = [];
    state.teile = [];
    state.truemmer = [];
    state.ringe = [];
    state.schriften = [];
    state.striche = [];
    state.stoss = 0;
    state.zeit = 0;
    state.zeitlupe = 0;
    state.sturz = null;
    state.tumble = 0;
    state.lean = 0;
    state.sprayRest = 0;
    shell.setCount(0);
    gegner?.runde();

    shell.clear();
    const prompt = shell.el("p", "cm-prompt sk-prompt", "Links halten – nach links, rechts – nach rechts.");
    shell.play.append(prompt, buildPlatz());
    alleWeg();
    view.cssW = 0;
    view.cssH = 0;
    messen();
    toreBis(START.y + 1200);
    state.camY = camYZiel();
    state.camX = camXZiel();

    last = performance.now();
    frame = window.requestAnimationFrame(loop);
  }

  function zaehleHoch(ziel) {
    const zahl = host.querySelector(".cm-result-score");
    if (!zahl) return;
    if (ruhig() || ziel <= 1) { zahl.textContent = String(ziel); return; }
    const dauer = Math.min(800, 160 + ziel * 12);
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
    carvenAus();
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
    // Das Tempo in km/h: zehn Einheiten sind ein Meter.
    const kmh = Math.round(state.spitze / METER * 3.6);
    const perfekt = state.perfekte === 1 ? "1 perfekt" : `${state.perfekte} perfekt`;
    shell.showResult({
      label: "Deine Punkte",
      points: punkte,
      detail: rekord ? "Neuer Rekord!" : `${perfekt} · Spitze ${kmh} km/h${vorher ? ` · Bestwert ${vorher}` : ""}`,
      geist,
    });
    if (rekord) host.querySelector(".cm-result-detail")?.classList.add("sk-rekord");
    // Unter der Zahl, woraus sie besteht: Tore plus Bonus der perfekten.
    const zahl = host.querySelector(".cm-result-score");
    if (zahl) {
      const aufstellung = shell.el("p", "sk-aufstellung");
      const tore = shell.el("span", "", `${state.tore} ${state.tore === 1 ? "Tor" : "Tore"}`);
      const bonus = shell.el("span", "sk-aufstellung-bonus", `+ ${state.bonus} Bonus`);
      aufstellung.append(tore, bonus, shell.el("span", "", `= ${punkte}`));
      zahl.after(aufstellung);
    }
    zaehleHoch(punkte);
  }

  // ---------------------------------------------------------------------------
  // Start
  // ---------------------------------------------------------------------------
  shell = shellApi.mount({
    host,
    title: "Slalom",
    area: "geschwindigkeit",
    accent: "#F5A623",
    accentDark: "#b9741a",
    clock: false,
    onRestart: () => (zuschauer ? zuschauenStarten() : startRun()),
    live: { los: losGehts, stopp: () => finish(), zuschauen: (quelle) => { zuschauer = quelle; zuschauenStarten(); } },
  });
  zuschauer = window.LernappGeist?.zuschauer?.({
    host, spiel: "skiSlalom", fassung: "t1", zufall, einheit: "Punkte", nochmal: zuschauenStarten,
  }) || null;
  if (!zuschauer) {
    gegner = window.LernappGeist?.fuer?.({ spiel: "skiSlalom", host, art: "tempo", alle: true, zufall }) || null;
  }

  startRun();
  zuschauer?.laden.then((da) => { if (da) zuschauenStarten(); });

  // Die linke Hälfte des Bildes lenkt nach links, die rechte nach rechts –
  // jeder Finger für sich (pointerdown je Zeiger). Ein Finger bleibt auf
  // seiner Seite, bis er geht. Nur Knöpfe bleiben Knöpfe.
  host.addEventListener("pointerdown", (event) => {
    if (event.target.closest("button, a, input")) return;
    const rahmen = (feld || host).getBoundingClientRect();
    fingerAuf(event.pointerId, event.clientX < rahmen.left + rahmen.width / 2 ? -1 : 1);
  });
  window.addEventListener("pointerup", (event) => fingerWeg(event.pointerId));
  window.addEventListener("pointercancel", (event) => fingerWeg(event.pointerId));
  // Wer das Fenster verlässt, nimmt auch die Finger vom Bild.
  window.addEventListener("blur", alleWeg);

  // Pfeil links oder A, Pfeil rechts oder D. Leertaste und Enter starten nur.
  // Steht der Fokus auf einem Knopf, gilt die Taste dem Knopf.
  const seiteDerTaste = (event) => {
    if (event.key === "ArrowLeft" || event.code === "KeyA") return -1;
    if (event.key === "ArrowRight" || event.code === "KeyD") return 1;
    return 0;
  };
  document.addEventListener("keydown", (event) => {
    const r = seiteDerTaste(event);
    const start = event.key === " " || event.key === "Enter";
    if (!r && !start) return;
    if (document.activeElement?.tagName === "BUTTON") return;
    event.preventDefault();
    if (event.repeat) return;
    if (r) fingerAuf(r < 0 ? "taste-l" : "taste-r", r);
    else losGehts();
  });
  document.addEventListener("keyup", (event) => {
    const r = seiteDerTaste(event);
    if (r) fingerWeg(r < 0 ? "taste-l" : "taste-r");
  });

  window.addEventListener("resize", messen);
  window.addEventListener("orientationchange", messen);
  window.addEventListener("pagehide", () => { clearStep(); stopLoop(); carvenAus(); });

  // Für die Prüfskripte.
  window.LernappSlalom = {
    METER, PISTE_HALB, PHI_MAX, R_FAHRER, R_STANGE, state, view, takt, lenke,
    toreBis, toreBisNr, pisteBei, tempoBei, drehBei, stangeL, stangeR,
  };
})();
