/*
 * frosch.js – Froschsprung.
 * ---------------------------------------------------------------------------
 * Ein Frosch sitzt auf einem Seerosenblatt, rechts davon schwimmt das nächste.
 * Wer den Finger aufs Bild legt, lädt den Sprung: Der Frosch duckt sich, die
 * Beine spannen sich, sie glühen. Wer loslässt, springt – immer im selben
 * Winkel, so weit, wie geladen ist. Gezielt wird nicht mit einem Strahl,
 * sondern mit dem Gefühl: Wie weit ist es bis drüben, und wie lange muss ich
 * dafür halten?
 *
 * Die Ladung steigt und fällt wieder, hin und her. Wer zu lange hält, hat
 * nicht mehr Kraft, sondern wieder weniger – das Maximum ist ein Moment,
 * keine Taste.
 *
 * Keine Uhr: Eine Runde dauert, bis der Frosch ins Wasser fällt. Jedes neue
 * Blatt zählt einen Punkt. Wer genau in der Mitte landet, trifft «perfekt»:
 * Goldene Ringe laufen über das Wasser, und mehrere perfekte hintereinander
 * zählen immer mehr (wie beim Brückenbauer, bis zu KETTE_MAX dazu). Eine
 * einzige unsaubere Landung bricht die Reihe. Wer ins Wasser fällt, liest
 * gross, warum: zu kurz, zu weit oder zu langsam.
 *
 * Schwerer wird es mit jedem Blatt: Ab dem sechsten treiben manche hin und
 * her, ab dem zwölften werden sie kleiner, später sinken manche, sobald der
 * Frosch darauf sitzt – dort heisst es schnell weiter. Und die Ladung läuft
 * schneller. Kein Blatt trägt ewig: Wer sitzen bleibt, merkt es zittern, dann
 * sinkt es (geduld). Erreichbar ist jedes Blatt immer: Der Teich wird aus der
 * Sprungweite gebaut (blattBauen), nicht aus dem Zufall allein.
 *
 * Gebaut wird der Teich aus dem Zufall (zufall.js): ohne Turnier jedes Mal
 * ein anderer, im Turnier für alle im selben Versuch derselbe. Die Blätter
 * treiben nach der Uhr der Runde (state.uhr), und die läuft erst, wenn die
 * Runde beginnt – so schwimmt beim Anschauen alles genau wie damals.
 *
 * Die Gegner (geist.js) springen als Frösche aus Licht mit, auf ihrem eigenen
 * Weg über ihre eigenen Blätter. Und die besten Runden lassen sich anschauen
 * (?zuschauen=, geist.js): mit derselben Saat derselbe Teich.
 *
 * Gezeichnet wird auf eine Leinwand, gerechnet in Welteinheiten, y zählt nach
 * oben, das Wasser liegt bei null. Fest steht die Höhe: SICHT_H Einheiten im
 * Querformat. Im Hochformat bleibt die Welt WELT_W breit, darüber steht mehr
 * Himmel und darunter mehr Spiegelung. Mit den Blättern wird es Nacht.
 */
(() => {
  "use strict";

  if (document.body.dataset.page !== "frog") return;

  const host = document.querySelector("#fr-stage");
  const shellApi = window.LernappGameShell;
  const cloudApi = window.LernappGameCloud;
  if (!host || !shellApi) return;

  const kids = () => window.LernappKids || null;
  const ruhig = () => Boolean(kids()?.prefersReducedMotion?.());

  // Der Zufall. Ohne Turnier Math.random; im Turnier bekommen alle dieselben
  // Blätter in derselben Reihenfolge. Nur die Blätter ziehen daraus – Tropfen,
  // Funken und Glühwürmchen würfeln Math.random oder hängen an hash01, damit
  // der Teich nicht davon abhängt, wie jemand springt.
  const zufall = window.LernappZufall?.fuer?.("frogHop") || {
    neu() {},
    zahl: () => Math.random(),
  };

  // ---------------------------------------------------------------------------
  // Die Welt
  // ---------------------------------------------------------------------------
  const WELT_W = 270;              // so breit mindestens (Hochformat)
  const WELT_W_MAX = 560;
  const SICHT_H = 230;             // so hoch im Querformat
  const WASSER = 0;
  const BLATT_Y = 3;               // die Oberfläche eines Blattes über dem Wasser
  const START = { x: 0, y: BLATT_Y };
  const WASSER_AN = 0.66;          // die Wasserlinie bei diesem Anteil der Höhe

  // Der Sprung. Immer derselbe Winkel; die Weite folgt der Ladung, gerade
  // hindurch von W_MIN bis W_MAX – so lässt sie sich lernen.
  const W_MIN = 55;
  const W_MAX = 175;
  const WINKEL = (56 * Math.PI) / 180;
  const G = 790;                   // Schwerkraft – ein weiter Sprung dauert so gut 0,8 s
  const TAKT = 1 / 240;            // die Flugbahn in festen kleinen Schritten
  const LANDE_RUHE = 0.07;         // so lange nach der Landung lädt noch nichts

  // Wie fein «perfekt» ist: ein Fünftel des Blattes um die Mitte, mindestens
  // 3,5 Einheiten. Und ab hier ist es «knapp»: vier Fünftel nach aussen.
  const PERFEKT_ANTEIL = 0.2;
  const PERFEKT_MIN = 3.5;
  const KNAPP_ANTEIL = 0.8;
  // Jede perfekte Landung in Folge zählt einen Punkt mehr – bis zu so vielen.
  const KETTE_MAX = 5;

  // Wie schwer es mit den Blättern wird. Bei SCHWER_BIS ist das Härteste
  // erreicht – danach wird es nicht mehr schwerer, nur noch dunkler.
  const SCHWER_BIS = 42;
  const TREIBEN_AB = 6;
  const KLEINER_AB = 12;
  const SINKEN_AB = 18;
  const NACHT_BEI = 28;            // bei so vielen Blättern ist es Nacht

  const TOP_COUNT = 5;
  const store = cloudApi
    ? cloudApi.register({ key: "lernapp.frosch", empty: { runs: 0, scores: [] }, merge: cloudApi.mergeScores(TOP_COUNT) })
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
  const glatt = (k) => k * k * (3 - 2 * k);
  const TAU = Math.PI * 2;

  // Immer dieselbe Zahl zu derselben Eingabe: Schilf, Sterne und Blüten stehen
  // bei jedem Bild am selben Platz, ohne den Zufall des Teichs anzufassen.
  function hash01(n) {
    const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return x - Math.floor(x);
  }

  // Die Weite eines Sprungs aus der Ladung (0 bis 1) – und wie lange er dauert.
  const reichweite = (ladung) => W_MIN + (W_MAX - W_MIN) * clamp(ladung, 0, 1);
  const abflug = (weite) => Math.sqrt((weite * G) / Math.sin(2 * WINKEL));
  const flugzeit = (weite) => (2 * abflug(weite) * Math.sin(WINKEL)) / G;

  // Wie lange die Ladung von leer bis voll braucht – je weiter, desto kürzer.
  const ladeZeit = (n) => lerp(0.86, 0.58, glatt(clamp(n / SCHWER_BIS, 0, 1)));
  // Hin und her: 0 → 1 → 0 → 1 …
  const pendel = (u) => {
    const r = u % 2;
    return r <= 1 ? r : 2 - r;
  };

  // ---------------------------------------------------------------------------
  // Farben: Abenddämmerung → Nacht
  // ---------------------------------------------------------------------------
  const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const FARBEN = {
    himmelOben: [hex("#2b1a5a"), hex("#040818")],
    himmelMitte: [hex("#b9507c"), hex("#0d1a40")],
    horizont: [hex("#ffb26a"), hex("#1b3a5a")],
    berge: [hex("#6d4f86"), hex("#131d38")],
    wald: [hex("#2a2440"), hex("#060b17")],
    wasserOben: [hex("#d77b78"), hex("#0f2a42")],
    wasserUnten: [hex("#0d3540"), hex("#020a12")],
    nebel: [hex("#ffd2b0"), hex("#5c79a8")],
    fern: [hex("#a06c98"), hex("#18264a")],
  };
  const SCHILF = {
    halm: [hex("#3b4a2a"), hex("#0b1410")],
    kolben: [hex("#4a3322"), hex("#120c08")],
  };
  // hell: mal so viel Licht (0,6 = dunkler, wie im Wasser gespiegelt).
  function mische(paar, k, alpha = 1, hell = 1) {
    const [a, b] = paar;
    const r = Math.round((a[0] + (b[0] - a[0]) * k) * hell);
    const gg = Math.round((a[1] + (b[1] - a[1]) * k) * hell);
    const bb = Math.round((a[2] + (b[2] - a[2]) * k) * hell);
    return alpha >= 1 ? `rgb(${r},${gg},${bb})` : `rgba(${r},${gg},${bb},${alpha})`;
  }

  // ---------------------------------------------------------------------------
  // Zustand
  // ---------------------------------------------------------------------------
  // phase:   "bereit" (noch nichts gedrückt), "spiel", "zuschauen", "ende"
  // schritt: "start" (vor dem ersten Druck), "sitzt", "flug", "platsch"
  const state = {
    phase: "bereit",
    schritt: "start",
    punkte: 0,
    erreicht: 0,          // so viele neue Blätter erreicht
    auf: 0,               // auf welchem Blatt der Frosch sitzt (Index)
    kette: 0,             // perfekte Landungen hintereinander
    besteKette: 0,
    perfekte: 0,
    blaetter: [],
    frosch: { x: START.x, y: START.y, vx: 0, vy: 0, dreh: 0 },
    ladung: 0,            // 0 bis 1
    laedt: false,
    ladeUhr: 0,
    landeRuhe: 0,
    sitzZeit: 0,          // wie lange er schon auf diesem Blatt sitzt (geduld)
    feder: 0,             // Nachfedern nach der Landung (1 → 0)
    gold: 0,              // Leuchten nach «perfekt» (1 → 0)
    zeitlupe: 0,          // so lange läuft der Flug noch langsamer (beinahe)
    zeitlupeSchon: false,
    geprustet: false,
    blinzeln: 0,
    quaken: 0,
    uhr: 0,               // die Uhr der Runde – nach ihr treiben die Blätter
    nacht: 0,             // 0 Dämmerung … 1 Nacht, weich nachgezogen
    camX: 0,
    ringe: [],
    teile: [],
    schriften: [],
    stoss: 0,
    zeit: 0,
    platschZeit: 0,
    grund: "",            // warum er im Wasser ist: "daneben", "gesunken"
    // Was das Bild von einer Ebene an die nächste weitergibt.
    mondX: 0,
    mondK: 0,
    uferBerge: null,
    uferWald: null,
  };

  let shell = null;
  let feld = null;
  let canvas = null;
  let g = null;
  let frame = null;
  let last = 0;
  let stepTimer = null;
  let gedrueckt = false;
  // Die Gegner (geist.js): wer als Frosch aus Licht mitspringt.
  let gegner = null;
  // Wer eine Runde anschaut statt zu springen (geist.js, zuschauer).
  let zuschauer = null;

  const view = { s: 1, dpr: 1, cssW: 0, cssH: 0, w: WELT_W, h: SICHT_H, nutz: SICHT_H, frei: 0, wasserY: 0 };

  function clearStep() {
    if (stepTimer) { window.clearTimeout(stepTimer); stepTimer = null; }
  }

  function stopLoop() {
    if (frame) { window.cancelAnimationFrame(frame); frame = null; }
  }

  // ---------------------------------------------------------------------------
  // Der Teich
  // ---------------------------------------------------------------------------
  /*
   * Ein Blatt hat eine Mitte (x0), einen Halbmesser (r), und vielleicht treibt
   * es: um amp hin und her, in periode Sekunden. Manche sinken, sobald der
   * Frosch darauf sitzt (sinkt, in sinkDauer Sekunden).
   *
   * Wie weit das nächste liegt, folgt aus dem Sprung: Von jeder Stelle des
   * Blattes, auf dem der Frosch sitzt – auch am Rand, auch wenn es treibt –,
   * liegt die Mitte des nächsten innerhalb der Sprungweite. Treibt das
   * nächste, kommt es dazu nur näher oder weiter: Wer wartet, findet immer
   * einen Moment, in dem es passt.
   *
   * Je Blatt werden immer gleich viele Zahlen gezogen, egal was daraus wird –
   * so bleibt die Reihe im Turnier für alle dieselbe.
   */
  function blattBauen(n, vor) {
    const k = glatt(clamp(n / SCHWER_BIS, 0, 1));
    const u = [];
    for (let i = 0; i < 7; i += 1) u.push(zufall.zahl());

    let r = n < KLEINER_AB ? lerp(28, 32, u[0]) : lerp(27, 15, glatt(clamp((n - KLEINER_AB) / (SCHWER_BIS - KLEINER_AB), 0, 1))) + lerp(-2, 2, u[0]);
    r = clamp(r, 14, 32);

    let amp = 0;
    let periode = 3;
    let phase = 0;
    if (n >= TREIBEN_AB && u[1] < lerp(0.35, 0.62, k)) {
      amp = lerp(9, 24, k) * lerp(0.6, 1, u[2]);
      periode = lerp(4.4, 2.5, k) * lerp(0.86, 1.14, u[3]);
      phase = u[4] * TAU;
    }

    let sinkt = false;
    let sinkDauer = 0;
    if (n >= SINKEN_AB && u[5] < lerp(0.16, 0.36, k) && (amp === 0 || n >= 30)) {
      sinkt = true;
      sinkDauer = lerp(2.6, 1.55, k);
    }

    // Der Abstand: von jeder Stelle des Blattes davor erreichbar.
    const rv = vor.r;
    const av = vor.amp;
    const lo = Math.max(W_MIN + rv + av + 4, rv + r + 8);
    const hi = W_MAX - rv - av - 4;
    // Treibt dieses, darf es auch dabei nie aus der Weite treiben.
    if (amp > 0) amp = Math.min(amp, Math.max(0, (hi - lo) / 2 - 2));
    const d = lerp(lo + amp, Math.max(lo + amp, hi - amp), u[6]);

    return {
      n,
      x0: vor.x0 + d,
      r,
      amp,
      periode,
      phase,
      sinkt,
      sinkDauer,
      sinkZeit: 0,
      besetzt: false,
      erreicht: false,
      wipp: 0,              // wie es nach einer Landung nachwippt (1 → 0)
      blume: hash01(n * 3.7 + 1.3) < 0.42,
      blumeDa: lerp(-0.45, 0.4, hash01(n * 5.1 + 2.2)),
      farbe: hash01(n * 7.3 + 0.7),
      kerbe: lerp(-0.5, 0.5, hash01(n * 2.9 + 4.1)),
    };
  }

  function blaetterBis(n) {
    const b = state.blaetter;
    if (!b.length) {
      b.push({
        n: 0, x0: START.x, r: 32, amp: 0, periode: 3, phase: 0, sinkt: false, sinkDauer: 0, sinkZeit: 0,
        besetzt: true, erreicht: true, wipp: 0, blume: true, blumeDa: -0.4, farbe: 0.3, kerbe: 0.2,
      });
    }
    while (b.length <= n) b.push(blattBauen(b.length, b[b.length - 1]));
  }

  // Wo ein Blatt zu einer Zeit der Runde schwimmt.
  const blattX = (b, uhr = state.uhr) => b.x0 + (b.amp ? b.amp * Math.sin(b.phase + (TAU * uhr) / b.periode) : 0);
  // Wie tief es gerade liegt: ein sinkendes langsam tiefer, dann schnell.
  const sinkTiefe = (b) => (b.sinkt && b.sinkDauer ? Math.pow(clamp(b.sinkZeit / b.sinkDauer, 0, 1.2), 2.2) * 9 : 0);
  const blattOben = (b) => BLATT_Y - sinkTiefe(b) - b.wipp * 1.6;

  // Das Blatt unter der Stelle x – zuerst das, auf dem er sitzt, dann die
  // davor und dahinter.
  function blattUnter(x) {
    const b = state.blaetter;
    const von = Math.max(0, state.auf - 1);
    const bis = Math.min(b.length - 1, state.auf + 4);
    for (let i = von; i <= bis; i += 1) {
      const bl = b[i];
      if (Math.abs(x - blattX(bl)) <= bl.r * 0.97) return bl;
    }
    return null;
  }

  // ---------------------------------------------------------------------------
  // Die Fläche
  // ---------------------------------------------------------------------------
  function buildPlatz() {
    const platz = shell.el("div", "fr-platz");
    feld = shell.el("div", "fr-feld");
    canvas = document.createElement("canvas");
    canvas.className = "fr-canvas";
    canvas.setAttribute("aria-hidden", "true");
    feld.append(canvas);
    g = canvas.getContext("2d");

    // Der Hinweis vor dem ersten Druck: ein Ring, der sich füllt – halten,
    // nicht tippen.
    const tipp = shell.el("span", "fr-tipp");
    tipp.setAttribute("aria-hidden", "true");
    const ns = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(ns, "svg");
    svg.setAttribute("viewBox", "0 0 64 64");
    [
      { r: 22, stroke: "rgba(255,255,255,0.45)", w: 5 },
      { r: 22, stroke: "#ffffff", w: 5, klasse: "fr-tipp-fuell" },
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
    view.s = Math.min(cssW / WELT_W, nutzH / SICHT_H);
    view.w = cssW / view.s;
    if (view.w > WELT_W_MAX) {
      view.s = cssW / WELT_W_MAX;
      view.w = WELT_W_MAX;
    }
    view.h = cssH / view.s;
    view.nutz = nutzH / view.s;
    // Die Wasserlinie: im Querformat bei zwei Dritteln, im Hochformat etwas
    // höher – dort ist unten Platz für die Spiegelung, oben für den Himmel.
    const hoch = nutzH > cssW * 1.2;
    view.wasserY = frei + nutzH * (hoch ? 0.6 : WASSER_AN);
    const pw = Math.round(cssW * dpr);
    const ph = Math.round(cssH * dpr);
    if (canvas.width !== pw) canvas.width = pw;
    if (canvas.height !== ph) canvas.height = ph;
    baueSprites();
  }

  const wackel = () => (ruhig() ? 0 : Math.sin(state.zeit * 64) * 3.5 * state.stoss);

  function bildTransform() {
    g.setTransform(view.dpr, 0, 0, view.dpr, 0, wackel() * view.dpr);
  }

  const bildX = (x) => (x - state.camX) * view.s;
  const bildY = (y) => view.wasserY - y * view.s;

  // Wohin die Kamera will: das Blatt, auf dem er sitzt, und das nächste, so
  // mittig, wie es geht – aber nie so, dass das nächste aus dem Bild treibt.
  function camZiel() {
    const f = state.frosch;
    const b = state.blaetter;
    const naechstes = b[Math.min(b.length - 1, state.auf + 1)];
    const links = Math.min(f.x, blattX(b[state.auf])) - 34;
    const rechts = naechstes ? naechstes.x0 + naechstes.r + naechstes.amp + 16 : f.x + W_MAX;
    const spanne = rechts - links;
    if (spanne >= view.w) return links - 4;
    return links - (view.w - spanne) * 0.42;
  }

  // ---------------------------------------------------------------------------
  // Vorgerenderte Bilder: Glühen, Mond, Blüte
  // ---------------------------------------------------------------------------
  const sprites = {};
  function leinwand(w, h) {
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(w));
    c.height = Math.max(1, Math.round(h));
    return c;
  }
  function glueh(farbe, r) {
    const c = leinwand(r * 2, r * 2);
    const k = c.getContext("2d");
    const v = k.createRadialGradient(r, r, 0, r, r, r);
    v.addColorStop(0, farbe.replace("A", "1"));
    v.addColorStop(0.25, farbe.replace("A", "0.55"));
    v.addColorStop(1, farbe.replace("A", "0"));
    k.fillStyle = v;
    k.fillRect(0, 0, r * 2, r * 2);
    return c;
  }
  function baueSprites() {
    if (sprites.fertig) return;
    sprites.fertig = true;
    sprites.gelb = glueh("rgba(255,236,140,A)", 32);
    sprites.gruen = glueh("rgba(200,255,140,A)", 32);
    sprites.gold = glueh("rgba(255,205,90,A)", 32);
    sprites.mond = glueh("rgba(220,232,255,A)", 64);
    sprites.sonne = glueh("rgba(255,190,110,A)", 64);
    sprites.weiss = glueh("rgba(255,255,255,A)", 32);
  }

  // ---------------------------------------------------------------------------
  // Zeichnen
  // ---------------------------------------------------------------------------
  // Sterne, Schilf, Glühwürmchen: einmal gewürfelt, mit hash01.
  const STERNE = Array.from({ length: 80 }, (_, i) => ({
    x: hash01(i * 3.1 + 1), y: hash01(i * 5.7 + 2), r: 0.5 + hash01(i * 7.3 + 3) * 1.2, t: hash01(i * 1.9) * TAU,
  }));
  const LICHTER = Array.from({ length: 26 }, (_, i) => ({
    x: hash01(i * 4.3 + 8) * 900, y: 8 + hash01(i * 6.1 + 9) * 70, t: hash01(i * 2.3 + 1) * TAU, v: 0.6 + hash01(i * 1.7) * 0.9,
  }));

  function zeichneHimmel() {
    bildTransform();
    const W = view.cssW;
    const wy = view.wasserY;
    const k = state.nacht;
    const v = g.createLinearGradient(0, 0, 0, wy);
    v.addColorStop(0, mische(FARBEN.himmelOben, k));
    v.addColorStop(0.55, mische(FARBEN.himmelMitte, k));
    v.addColorStop(1, mische(FARBEN.horizont, k));
    g.fillStyle = v;
    g.fillRect(0, 0, W, wy + 2);

    // Sterne, sobald es dunkel wird – sie funkeln.
    if (k > 0.25) {
      const a = clamp((k - 0.25) / 0.5, 0, 1);
      g.fillStyle = "#ffffff";
      STERNE.forEach((s) => {
        const funkel = 0.55 + 0.45 * Math.sin(state.zeit * 2.2 + s.t);
        g.globalAlpha = a * funkel * (1 - s.y * 0.55);
        const x = ((s.x * W * 1.3 - state.camX * view.s * 0.03) % (W * 1.3) + W * 1.3) % (W * 1.3) - W * 0.15;
        g.fillRect(x, s.y * wy * 0.82, s.r, s.r);
      });
      g.globalAlpha = 1;
    }

    // Die Sonne geht unter, der Mond geht auf.
    const s = view.s;
    const sonneY = wy - lerp(38, -30, clamp(k * 1.6, 0, 1)) * s;
    if (k < 0.65) {
      const sx = W * 0.26;
      g.globalAlpha = 1 - k / 0.65;
      g.drawImage(sprites.sonne, sx - 70 * s, sonneY - 70 * s, 140 * s, 140 * s);
      g.fillStyle = "#ffd59a";
      g.beginPath();
      g.arc(sx, sonneY, 15 * s, 0, TAU);
      g.fill();
      g.globalAlpha = 1;
    }
    const mondK = clamp((k - 0.3) / 0.6, 0, 1);
    if (mondK > 0) {
      const mx = W * 0.74;
      const my = lerp(wy - 10 * s, Math.max(view.frei + 46 * s, wy * 0.28), glatt(mondK));
      g.globalAlpha = mondK;
      g.drawImage(sprites.mond, mx - 60 * s, my - 60 * s, 120 * s, 120 * s);
      g.fillStyle = "#f4f6ff";
      g.beginPath();
      g.arc(mx, my, 11 * s, 0, TAU);
      g.fill();
      g.fillStyle = "rgba(170,182,214,0.55)";
      g.beginPath();
      g.arc(mx - 3.5 * s, my - 2 * s, 2.6 * s, 0, TAU);
      g.arc(mx + 4 * s, my + 3.5 * s, 1.8 * s, 0, TAU);
      g.arc(mx + 1.5 * s, my - 5 * s, 1.2 * s, 0, TAU);
      g.fill();
      g.globalAlpha = 1;
    }
    state.mondX = W * 0.74;
    state.mondK = mondK;
  }

  // Berge und Wald am Ufer: Linien aus Sinuswellen und hash01, verschieden
  // schnell (faktor: wie stark sie der Kamera folgen). Die Berge sind weich,
  // der Wald hat Spitzen – Tannen, abwechselnd hoch und tief.
  function uferLinie(faktor, schritt, hoehe, grund, rauh, saat, spitz) {
    const s = view.s;
    const W = view.cssW;
    const ox = state.camX * faktor;
    const i0 = Math.floor(ox / schritt) - 1;
    const i1 = Math.ceil((ox + W / s) / schritt) + 1;
    const punkte = [];
    for (let i = i0; i <= i1; i += 1) {
      const xw = i * schritt;
      let h = grund + hoehe * (0.5 + 0.28 * Math.sin(xw * 0.012 + saat) + 0.16 * Math.sin(xw * 0.029 + saat * 1.9)
        + 0.06 * Math.sin(xw * 0.083 + saat * 2.7));
      h += spitz ? (i % 2 ? -rauh * 0.35 : rauh * (0.45 + 0.55 * hash01(i * 7.7 + saat))) : rauh * hash01(i * 7.7 + saat * 3);
      punkte.push([(xw - ox) * s, Math.max(1, h) * s]);
    }
    return punkte;
  }

  function malUfer(punkte, wy, farbe, spiegel) {
    g.fillStyle = farbe;
    g.beginPath();
    g.moveTo(punkte[0][0], wy);
    for (const [x, h] of punkte) g.lineTo(x, spiegel ? wy + h * 0.55 : wy - h);
    g.lineTo(punkte[punkte.length - 1][0], wy);
    g.closePath();
    g.fill();
  }

  function zeichneUfer() {
    const k = state.nacht;
    const wy = view.wasserY + 1;
    const fern = uferLinie(0.05, 12, 58, 26, 3, 0.4, false);
    const berge = uferLinie(0.12, 8, 46, 12, 2.5, 1.7, false);
    const wald = uferLinie(0.3, 3.2, 10, 7, 7, 4.2, true);
    malUfer(fern, wy, mische(FARBEN.fern, k), false);
    malUfer(berge, wy, mische(FARBEN.berge, k), false);
    // Dunst zwischen Bergen und Wald.
    const nebel = g.createLinearGradient(0, wy - 40 * view.s, 0, wy);
    nebel.addColorStop(0, mische(FARBEN.nebel, k, 0));
    nebel.addColorStop(1, mische(FARBEN.nebel, k, 0.35 - k * 0.18));
    g.fillStyle = nebel;
    g.fillRect(0, wy - 40 * view.s, view.cssW, 40 * view.s);
    malUfer(wald, wy, mische(FARBEN.wald, k), false);
    state.uferBerge = berge;
    state.uferWald = wald;
  }

  // Das Wasser spiegelt den Himmel: oben hell wie der Horizont, nach unten
  // dunkler – dort spiegelt sich der Himmel weiter oben.
  function zeichneWasser() {
    const W = view.cssW;
    const wy = view.wasserY;
    const k = state.nacht;
    const v = g.createLinearGradient(0, wy, 0, view.cssH);
    v.addColorStop(0, mische(FARBEN.horizont, k, 1, 0.62));
    v.addColorStop(0.18, mische(FARBEN.himmelMitte, k, 1, 0.5));
    v.addColorStop(0.55, mische(FARBEN.wasserUnten, k * 0.8 + 0.1));
    v.addColorStop(1, mische(FARBEN.wasserUnten, k, 1, 0.8));
    g.fillStyle = v;
    g.fillRect(0, wy, W, view.cssH - wy);

    // Das Ufer im Wasser gespiegelt, leicht gestaucht und blass.
    g.globalAlpha = 0.45;
    malUfer(state.uferBerge, wy, mische(FARBEN.berge, k), true);
    g.globalAlpha = 0.6;
    malUfer(state.uferWald, wy, mische(FARBEN.wald, k), true);
    g.globalAlpha = 1;

    // Der Sonnen- bzw. Mondpfad: tanzende Glanzstriche.
    const s = view.s;
    const lichtX = k < 0.5 ? W * 0.26 : state.mondX;
    const lichtA = k < 0.5 ? (1 - k * 2) * 0.8 : state.mondK * 0.75;
    const farbe = k < 0.5 ? "rgba(255,214,160," : "rgba(220,232,255,";
    const tiefeH = view.cssH - wy;
    // Ein weicher Schein unter dem Licht, darauf die Glanzstriche.
    g.save();
    g.globalCompositeOperation = "lighter";
    g.globalAlpha = lichtA * 0.32;
    g.drawImage(k < 0.5 ? sprites.sonne : sprites.mond, lichtX - 34 * s, wy - 6 * s, 68 * s, Math.min(tiefeH, 120 * s));
    g.restore();
    for (let i = 0; i < 34; i += 1) {
      const t = hash01(i * 3.3);
      const tiefe = Math.pow(hash01(i * 5.9 + 1), 1.3);
      const y = wy + 2 + tiefe * Math.min(tiefeH * 0.9, 130 * s);
      const breite = (5 + tiefe * 22) * s * 0.4 * (0.6 + hash01(i * 2.1));
      const flimmer = 0.35 + 0.65 * Math.max(0, Math.sin(state.zeit * (1.6 + t * 2.4) + t * TAU));
      const x = lichtX + (hash01(i * 7.7) - 0.5) * (10 + tiefe * 40) * s + Math.sin(state.zeit * 0.9 + i) * 3 * s;
      g.fillStyle = `${farbe}${(lichtA * flimmer * (1 - tiefe * 0.55)).toFixed(3)})`;
      g.fillRect(x - breite / 2, y, breite, Math.max(1.2, 0.8 * s));
    }

    // Feine Wellenlinien über die ganze Fläche, die mit der Welt ziehen.
    g.strokeStyle = k < 0.5 ? "rgba(255,230,210,0.10)" : "rgba(170,200,255,0.08)";
    g.lineWidth = 1;
    g.beginPath();
    for (let i = 0; i < 30; i += 1) {
      const tiefe = hash01(i * 4.4 + 3);
      const y = wy + 4 + tiefe * (view.cssH - wy - 6);
      const welt = hash01(i * 9.1) * 700;
      const x = ((welt - state.camX * (0.6 + tiefe * 0.6)) * s % (W + 80) + W + 80) % (W + 80) - 40;
      const l = (8 + tiefe * 22) * s;
      g.moveTo(x, y);
      g.quadraticCurveTo(x + l / 2, y - 1.2, x + l, y);
    }
    g.stroke();
  }

  // Der Spiegel im Wasser: Blätter, Frösche und Ringe, nach unten geklappt
  // um die Wasserlinie, blass und leicht gewellt.
  function zeichneSpiegelung() {
    const wy = view.wasserY;
    g.save();
    g.beginPath();
    g.rect(0, wy + 0.5, view.cssW, view.cssH - wy);
    g.clip();
    g.translate(0, wy * 2);
    g.scale(1, -1);
    g.globalAlpha = 0.32;
    const f = state.frosch;
    if (f.y > WASSER - 1) {
      const welle = Math.sin(state.zeit * 3) * 0.04;
      zeichneFroschAn(f.x, f.y, f.dreh + welle, state.schritt, 1);
    }
    g.restore();
  }

  function zeichneRinge() {
    if (!state.ringe.length) return;
    const s = view.s;
    g.lineWidth = 1.4;
    state.ringe.forEach((r) => {
      const k = clamp(r.leben / r.max, 0, 1);
      const rad = r.r0 + (r.r1 - r.r0) * (1 - k * k);
      g.strokeStyle = r.gold ? `rgba(255,214,100,${(k * 0.95).toFixed(3)})` : `rgba(230,250,255,${(k * 0.55).toFixed(3)})`;
      g.lineWidth = (r.gold ? 2.2 : 1.3) * Math.max(0.8, s * 0.6);
      g.beginPath();
      g.ellipse(bildX(r.x), bildY(WASSER) + 0.5, rad * s, rad * s * 0.26, 0, 0, TAU);
      g.stroke();
    });
  }

  // Ein Seerosenblatt: von schräg oben, mit Kerbe, Adern, Rand und vielleicht
  // einer Blüte.
  function zeichneBlatt(b) {
    const s = view.s;
    const x = bildX(blattX(b));
    if (x < -b.r * s * 2 || x > view.cssW + b.r * s * 2) return;
    const tief = sinkTiefe(b);
    const y = bildY(blattOben(b) - BLATT_Y + 0.6);
    const rx = b.r * s;
    const ry = b.r * s * 0.3;
    const kipp = b.sinkt ? clamp(b.sinkZeit / b.sinkDauer, 0, 1) * 0.1 : 0;
    // Je tiefer, desto mehr Wasser deckt es zu.
    const unter = clamp(tief / 9, 0, 1);

    // Trägt es nicht mehr lange, zittert es (geduld).
    const zittern = b.unruhe && !ruhig() ? Math.sin(state.zeit * 47 + b.n) * b.unruhe * 1.6 * s : 0;

    g.save();
    g.translate(x + zittern, y);
    g.rotate(kipp);

    // Schatten auf dem Wasser.
    g.fillStyle = "rgba(0,20,25,0.28)";
    g.beginPath();
    g.ellipse(2 * s, 1.6 * s, rx * 1.02, ry * 0.95, 0, 0, TAU);
    g.fill();
    // Die Dicke des Blattes: ein dunkler Rand darunter.
    g.fillStyle = `rgba(${Math.round(lerp(22, 8, state.nacht))},${Math.round(lerp(70, 40, state.nacht))},${Math.round(lerp(40, 34, state.nacht))},0.95)`;
    g.beginPath();
    g.ellipse(0, 0.9 * s, rx * 0.995, ry, 0, 0, TAU);
    g.fill();

    // Das Blatt: ein Oval mit einer Kerbe zum Betrachter hin.
    const kerbeW = 0.32;
    const kerbe = Math.PI / 2 + b.kerbe;
    const nacht = state.nacht;
    // Ein sinkendes Blatt welkt – eines, das bald sinkt, beginnt damit.
    const welk = b.sinkt ? clamp(0.35 + b.sinkZeit / b.sinkDauer, 0, 1) : (b.unruhe || 0) * 0.35;
    const hell = `rgb(${Math.round(lerp(lerp(118, 96, nacht), 176, welk))},${Math.round(lerp(lerp(196, 168, nacht), 152, welk))},${Math.round(lerp(lerp(92, 112, nacht), 62, welk))})`;
    const dunkel = `rgb(${Math.round(lerp(lerp(34, 22, nacht), 96, welk))},${Math.round(lerp(lerp(112, 86, nacht), 84, welk))},${Math.round(lerp(lerp(64, 70, nacht), 30, welk))})`;
    const v = g.createLinearGradient(0, -ry, 0, ry);
    v.addColorStop(0, hell);
    v.addColorStop(1, dunkel);
    g.fillStyle = v;
    g.beginPath();
    g.moveTo(0, 0);
    g.ellipse(0, 0, rx, ry, 0, kerbe + kerbeW / 2, kerbe - kerbeW / 2 + TAU);
    g.closePath();
    g.fill();
    // Der Rand, hell oben, dunkel unten.
    g.strokeStyle = `rgba(210,255,170,${(0.35 - nacht * 0.15).toFixed(3)})`;
    g.lineWidth = Math.max(1, 1.1 * s * 0.6);
    g.beginPath();
    g.ellipse(0, 0, rx, ry, 0, Math.PI + 0.15, TAU - 0.15);
    g.stroke();
    g.strokeStyle = "rgba(10,40,20,0.45)";
    g.beginPath();
    g.ellipse(0, 0.6 * s, rx, ry, 0, 0.2, Math.PI - 0.2);
    g.stroke();
    // Adern von der Mitte aus – dort ist «perfekt».
    g.strokeStyle = `rgba(200,240,150,${(0.32 - nacht * 0.12).toFixed(3)})`;
    g.lineWidth = Math.max(0.7, 0.7 * s * 0.6);
    g.beginPath();
    for (let i = 0; i < 9; i += 1) {
      const w = kerbe + kerbeW / 2 + ((TAU - kerbeW) * (i + 0.5)) / 9;
      g.moveTo(0, 0);
      g.lineTo(Math.cos(w) * rx * 0.86, Math.sin(w) * ry * 0.86);
    }
    g.stroke();
    // Die Mitte.
    g.fillStyle = `rgba(230,255,190,${(0.4 - nacht * 0.15).toFixed(3)})`;
    g.beginPath();
    g.ellipse(0, 0, 1.6 * s, 0.6 * s, 0, 0, TAU);
    g.fill();

    // Eine Blüte am Rand.
    if (b.blume && !b.sinkt) zeichneBluete(Math.cos(b.blumeDa * Math.PI) * rx * 0.62, -ry * 0.25, s * (0.75 + b.farbe * 0.35), b.farbe);

    // Wasser schwappt über ein sinkendes Blatt.
    if (unter > 0) {
      g.fillStyle = `rgba(40,90,110,${(unter * 0.75).toFixed(3)})`;
      g.beginPath();
      g.ellipse(0, 0, rx * 1.02, ry * 1.05, 0, 0, TAU);
      g.fill();
    }
    g.restore();

    // Ein treibendes Blatt zieht eine feine Spur.
    if (b.amp) {
      const vx = Math.cos(b.phase + (TAU * state.uhr) / b.periode);
      g.strokeStyle = `rgba(220,245,255,${(Math.abs(vx) * 0.22).toFixed(3)})`;
      g.lineWidth = 1;
      g.beginPath();
      const seite = vx > 0 ? -1 : 1;
      g.ellipse(x + seite * rx * 0.9, y + ry * 0.4, rx * 0.35, ry * 0.5, 0, seite > 0 ? -0.6 : Math.PI - 0.6, seite > 0 ? 1.4 : Math.PI + 1.4);
      g.stroke();
    }
  }

  function zeichneBluete(x, y, gross, farbe) {
    const rosa = farbe < 0.5;
    const blatt = rosa ? ["#ffd1e6", "#f58fbd"] : ["#fff6f0", "#f3c8d8"];
    g.save();
    g.translate(x, y);
    g.scale(gross, gross);
    for (let lage = 0; lage < 2; lage += 1) {
      const n = 7;
      for (let i = 0; i < n; i += 1) {
        const w = (i / n) * Math.PI - Math.PI + (lage ? 0.22 : 0);
        const l = lage ? 5.5 : 7;
        g.fillStyle = lage ? blatt[0] : blatt[1];
        g.beginPath();
        g.ellipse(Math.cos(w) * l * 0.55, Math.sin(w) * l * 0.42 - 1, 1.9, l * 0.55, w + Math.PI / 2, 0, TAU);
        g.fill();
      }
    }
    g.fillStyle = "#ffd447";
    g.beginPath();
    g.arc(0, -2.2, 1.8, 0, TAU);
    g.fill();
    g.restore();
  }

  // ---------------------------------------------------------------------------
  // Der Frosch
  // ---------------------------------------------------------------------------
  /*
   * Gezeichnet in eigenen Einheiten: die Füsse bei (0, 0), y nach unten,
   * der Kopf schaut nach rechts. Gut 24 Einheiten breit, 20 hoch – im Bild
   * mal view.s. Wie er gerade aussieht, sagt der Schritt: sitzend (geduckt
   * nach der Ladung, federnd nach der Landung) oder fliegend (gestreckt).
   */
  // an: { x, y } – wohin im Bild, statt aus der Welt gerechnet (Geist).
  function zeichneFroschAn(wx, wy, dreh, schritt, deckkraft = 1, farbe = null, an = null) {
    const s = view.s;
    const x = an ? an.x : bildX(wx);
    const y = an ? an.y : bildY(wy);
    if (x < -40 * s || x > view.cssW + 40 * s) return;
    const fliegt = schritt === "flug";
    const q = fliegt ? 0 : state.ladung;                    // wie geduckt
    const feder = fliegt ? 0 : state.feder;
    const zitter = !ruhig() && q > 0.72 ? Math.sin(state.zeit * 95) * (q - 0.72) * 2.2 : 0;
    const sx = fliegt ? 0.9 : 1 + q * 0.26 + feder * 0.22;
    const sy = fliegt ? 1.16 : 1 - q * 0.3 - feder * 0.2;

    g.save();
    g.translate(x + zitter * s, y);
    g.rotate(-dreh);
    g.scale(s, s);
    g.globalAlpha *= deckkraft;

    const geist = Boolean(farbe);
    const haut = geist ? farbe : "#4fb64a";
    const hautHell = geist ? farbe : "#8fdc5c";
    const hautDunkel = geist ? farbe : "#2c7a2e";
    const bauch = geist ? farbe : "#dff2b0";

    // Glühen der Beine beim Laden.
    if (!geist && q > 0.05) {
      g.save();
      g.globalCompositeOperation = "lighter";
      g.globalAlpha = q * 0.85;
      g.drawImage(sprites.gold, -24, -16, 30, 22);
      g.restore();
    }

    // Hinterbeine.
    const bein = !geist && q > 0.05
      ? `rgb(${Math.round(lerp(44, 255, q * 0.7))},${Math.round(lerp(122, 190, q * 0.7))},${Math.round(lerp(46, 80, q * 0.7))})`
      : hautDunkel;
    g.fillStyle = bein;
    if (fliegt) {
      // Gestreckt nach hinten: Oberschenkel, Unterschenkel, Fuss mit Zehen.
      g.save();
      g.rotate(0.28);
      g.beginPath();
      g.ellipse(-12, -6, 7.5, 3.4, -0.25, 0, TAU);
      g.fill();
      g.beginPath();
      g.ellipse(-21, -2.5, 6, 2.2, 0.12, 0, TAU);
      g.fill();
      g.beginPath();
      g.moveTo(-26, -1.5);
      g.lineTo(-32, -4);
      g.lineTo(-31, 0);
      g.lineTo(-33, 2.2);
      g.lineTo(-26, 1.4);
      g.closePath();
      g.fill();
      g.restore();
    } else {
      g.save();
      g.scale(sx, sy);
      g.beginPath();
      g.ellipse(-7.5, -5, 7.2, 5.2, -0.35, 0, TAU);
      g.fill();
      g.beginPath();
      g.ellipse(-6, -0.8, 7.6, 1.8, 0, 0, TAU);
      g.fill();
      g.restore();
    }

    // Der Körper: eine Tropfenform, dick hinten, Kopf vorn.
    g.save();
    g.scale(sx, sy);
    const v = geist ? null : g.createLinearGradient(0, -20, 0, 0);
    if (v) {
      v.addColorStop(0, hautHell);
      v.addColorStop(0.6, haut);
      v.addColorStop(1, hautDunkel);
    }
    g.fillStyle = v || haut;
    g.beginPath();
    g.moveTo(-11, -4);
    g.bezierCurveTo(-13, -14, -4, -18, 4, -17);
    g.bezierCurveTo(10, -17, 14, -13, 13.5, -8);
    g.bezierCurveTo(13, -3, 8, -1, 2, -1);
    g.bezierCurveTo(-5, -1, -10, -1, -11, -4);
    g.closePath();
    g.fill();
    if (!geist) {
      // Bauch und Kehle.
      g.fillStyle = bauch;
      g.beginPath();
      g.ellipse(4.5, -3.6, 7.8, 2.8, 0.05, 0, TAU);
      g.fill();
      // Die Kehle bläht sich beim Quaken.
      if (state.quaken > 0 && !fliegt) {
        const b = Math.sin(clamp(state.quaken, 0, 1) * Math.PI);
        g.fillStyle = "rgba(245,255,215,0.92)";
        g.beginPath();
        g.ellipse(10.5, -4 + b * 0.5, 3 + b * 3.6, 2.2 + b * 2.6, 0, 0, TAU);
        g.fill();
      }
      // Flecken.
      g.fillStyle = "rgba(30,90,34,0.55)";
      g.beginPath();
      g.ellipse(-4, -12, 2.2, 1.6, 0.3, 0, TAU);
      g.ellipse(1.5, -14.5, 1.6, 1.1, 0, 0, TAU);
      g.ellipse(-7.5, -8, 1.4, 1.1, 0, 0, TAU);
      g.fill();
      // Glanz auf dem Rücken.
      g.fillStyle = "rgba(255,255,255,0.28)";
      g.beginPath();
      g.ellipse(-1, -15.2, 4.6, 1.2, -0.1, 0, TAU);
      g.fill();
      // Der Mund.
      g.strokeStyle = "rgba(20,60,24,0.85)";
      g.lineWidth = 0.9;
      g.beginPath();
      g.moveTo(13.2, -8.4);
      g.quadraticCurveTo(10, -6.2, 5.5, -7.6);
      g.stroke();
    }
    g.restore();

    // Die Vorderbeine.
    g.fillStyle = geist ? farbe : haut;
    if (fliegt) {
      g.beginPath();
      g.ellipse(9, -3, 5, 1.6, -0.5, 0, TAU);
      g.fill();
    } else {
      g.save();
      g.scale(1, sy);
      g.beginPath();
      g.ellipse(8.5 + q * 1.5, -2.2, 1.7, 3.2, -0.25, 0, TAU);
      g.fill();
      g.beginPath();
      g.ellipse(10 + q * 1.5, -0.4, 2.8, 0.9, 0, 0, TAU);
      g.fill();
      g.restore();
    }

    // Die Augen: oben auf dem Kopf, gross und glänzend.
    const augeY = -17.5 * sy + (fliegt ? -0.5 : 0);
    const zu = !geist && state.blinzeln > 0 ? 1 - Math.abs(state.blinzeln * 2 - 1) : 0;
    [[3.2, 0.92], [8.4, 1]].forEach(([ax, gross]) => {
      const axs = ax * sx;
      g.fillStyle = geist ? farbe : haut;
      g.beginPath();
      g.arc(axs, augeY, 3.6 * gross, 0, TAU);
      g.fill();
      if (geist) {
        // Ein Geist hat helle Augen aus Licht.
        g.fillStyle = "rgba(255,255,255,0.9)";
        g.beginPath();
        g.arc(axs + 0.8, augeY - 0.2, 1.7 * gross, 0, TAU);
        g.fill();
        return;
      }
      g.fillStyle = "#fbfff0";
      g.beginPath();
      g.arc(axs + 0.4, augeY - 0.3, 2.7 * gross, 0, TAU);
      g.fill();
      // Die Pupille: im Flug schaut er nach vorn unten (dorthin, wo er landet).
      const px = axs + (fliegt ? 1.2 : 0.8) + (state.schritt === "platsch" ? -0.6 : 0);
      const py = augeY + (fliegt ? 0.6 : -0.2);
      g.fillStyle = "#14200f";
      g.beginPath();
      g.ellipse(px, py, 1.25 * gross, 1.55 * gross, 0, 0, TAU);
      g.fill();
      g.fillStyle = "#ffffff";
      g.beginPath();
      g.arc(px - 0.5, py - 0.7, 0.55, 0, TAU);
      g.fill();
      if (zu > 0) {
        g.fillStyle = haut;
        g.beginPath();
        g.ellipse(axs + 0.4, augeY - 3 * gross + zu * 3 * gross, 3 * gross, 3 * gross * zu, 0, Math.PI, TAU);
        g.fill();
      }
    });
    g.restore();
  }

  // Der Frosch selbst. Nach einer perfekten Landung leuchtet er kurz golden;
  // im Wasser sieht man nur, was herausschaut.
  function zeichneFrosch() {
    const f = state.frosch;
    const s = view.s;
    if (state.gold > 0 && state.schritt !== "platsch") {
      g.save();
      g.globalCompositeOperation = "lighter";
      g.globalAlpha = state.gold * 0.8;
      const r = (26 + (1 - state.gold) * 14) * s;
      g.drawImage(sprites.gold, bildX(f.x) - r, bildY(f.y + 9) - r, r * 2, r * 2);
      g.restore();
    }
    if (state.schritt !== "platsch") {
      zeichneFroschAn(f.x, f.y, f.dreh, state.schritt);
      return;
    }
    const wy = view.wasserY;
    g.save();
    g.beginPath();
    g.rect(0, 0, view.cssW, wy + 0.5);
    g.clip();
    zeichneFroschAn(f.x, f.y, f.dreh, state.schritt);
    g.restore();
    // Wo er im Wasser steckt, ein dunkler Ring.
    if (f.y < WASSER && f.y > WASSER - 18) {
      g.strokeStyle = "rgba(220,245,255,0.5)";
      g.lineWidth = Math.max(1, 0.9 * s);
      g.beginPath();
      g.ellipse(bildX(f.x + 3), wy + 0.5, 15 * s, 3.4 * s, 0, 0, TAU);
      g.stroke();
    }
  }

  // Ein Geist-Frosch auf seiner eigenen Leinwand: GEIST_W × GEIST_H
  // Einheiten, die Füsse bei (GEIST_X, GEIST_Y).
  const GEIST_W = 84;
  const GEIST_H = 68;
  const GEIST_X = 42;
  const GEIST_Y = 44;
  function geistBild(lage, farbe) {
    const s = view.s;
    const w = Math.ceil(GEIST_W * s * view.dpr);
    const h = Math.ceil(GEIST_H * s * view.dpr);
    if (!sprites.geist || sprites.geist.width !== w || sprites.geist.height !== h) sprites.geist = leinwand(w, h);
    const k = sprites.geist.getContext("2d");
    k.setTransform(1, 0, 0, 1, 0, 0);
    k.clearRect(0, 0, w, h);
    k.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
    const haupt = g;
    const ladung = state.ladung;
    const feder = state.feder;
    g = k;
    state.ladung = lage.sitzt ? lage.ladung : 0;
    state.feder = 0;
    zeichneFroschAn(0, 0, lage.sitzt ? 0 : lage.dreh, lage.sitzt ? "sitzt" : "flug", 1, farbe, { x: GEIST_X * s, y: GEIST_Y * s });
    g = haupt;
    state.ladung = ladung;
    state.feder = feder;
    return sprites.geist;
  }

  // Die Gegner als Frösche aus Licht (geist.js) – auf ihrem eigenen Weg,
  // über ihre eigenen Blätter. Sitzen sie, liegt ein Schimmer von Blatt
  // unter ihnen.
  function zeichneGeister() {
    if (!gegner || state.phase === "bereit") return;
    const orte = window.LernappGeist?.orte?.(gegner) || [];
    if (!orte.length) return;
    bildTransform();
    const s = view.s;
    orte.forEach((o) => {
      // Wem im Live-Modus zugeschaut wird, der ist die Figur selbst – kein
      // Geist dazu, nur sein Name (geist.js, namen).
      if (o.ziel) return;
      const lage = deuteC(o.c);
      // Wer ins Wasser gefallen ist, ist nicht mehr zu sehen.
      if (lage.platsch) return;
      const wx = START.x + o.a;
      const wy = START.y + o.b;
      const bx = bildX(wx);
      if (bx < -50 * s || bx > view.cssW + 50 * s) return;
      if (lage.sitzt) {
        g.fillStyle = o.farbe;
        g.globalAlpha = 0.18 * o.blass;
        g.beginPath();
        g.ellipse(bx, bildY(BLATT_Y - 0.4), 20 * s, 6 * s, 0, 0, TAU);
        g.fill();
      }
      // Erst ganz auf eine eigene kleine Leinwand, dann durchscheinend ins
      // Bild – sonst schimmerten die Stellen dunkler, wo Teile übereinanderliegen.
      const bild = geistBild(lage, o.farbe);
      g.globalAlpha = 0.55 * o.blass;
      g.drawImage(bild, bx - GEIST_X * s, bildY(wy) - GEIST_Y * s, GEIST_W * s, GEIST_H * s);
      g.globalAlpha = 1;
    });
    window.LernappGeist.namen(g, orte.map((o) => ({
      ...o, sx: bildX(START.x + o.a), sy: bildY(START.y + o.b) - 24 * s,
    })), { breit: view.cssW, hoch: view.cssH });
  }

  // Was in c steckt: Ist er im Wasser (20000), sitzt er (ab 10000, dahinter
  // die Ladung in Hundertsteln), oder fliegt er (die Drehung mal hundert).
  // Zwischen diesen Bereichen springt c um Tausende – geist.js zieht dort
  // keine Linie dazwischen, sondern springt mit (kurve, winkel).
  function deuteC(c) {
    const z = Number(c) || 0;
    if (z >= 15000) return { sitzt: false, platsch: true, ladung: 0, dreh: 0 };
    if (z >= 5000) return { sitzt: true, platsch: false, ladung: clamp((z - 10000) / 100, 0, 1), dreh: 0 };
    return { sitzt: false, platsch: false, ladung: 0, dreh: z / 100 };
  }

  // ---------------------------------------------------------------------------
  // Was dazwischen lebt: Schilf, Libellen, Glühwürmchen
  // ---------------------------------------------------------------------------
  function zeichneSchilf(faktor, vorn) {
    const s = view.s;
    const W = view.cssW;
    const schritt = vorn ? 95 : 38;
    const ox = state.camX * faktor;
    const i0 = Math.floor(ox / schritt) - 1;
    const i1 = Math.ceil((ox + W / s) / schritt) + 1;
    const k = state.nacht;
    const halm = vorn ? (k < 0.5 ? "#1b2a1c" : "#060d09") : mische(SCHILF.halm, k);
    const kolben = vorn ? (k < 0.5 ? "#2b1d14" : "#0b0806") : mische(SCHILF.kolben, k);
    // Vorn reicht es nie bis an die Blätter: Was zählt, bleibt frei.
    const platz = Math.max(10, view.cssH - view.wasserY - 30 * s);
    g.lineCap = "round";
    for (let i = i0; i <= i1; i += 1) {
      const h0 = hash01(i * 2.7 + (vorn ? 9 : 3));
      if (vorn && h0 < 0.45) continue;
      if (!vorn && h0 < 0.3) continue;
      const bx = (i * schritt + hash01(i * 5.3) * schritt * 0.7 - ox) * s;
      const halme = vorn ? 5 : 3;
      for (let j = 0; j < halme; j += 1) {
        const hh = vorn
          ? Math.min(60 * s, platz) * (0.45 + hash01(i * 3.1 + j) * 0.55)
          : 22 * (0.55 + hash01(i * 3.1 + j) * 0.6) * s;
        const neig = Math.sin(state.zeit * (0.9 + j * 0.13) + i * 1.7 + j) * (vorn ? 7 : 3) * s * (ruhig() ? 0.3 : 1);
        const x = bx + (j - halme / 2) * (vorn ? 5 : 3) * s;
        const yFuss = vorn ? view.cssH + 6 : view.wasserY + 1;
        g.strokeStyle = halm;
        g.lineWidth = (vorn ? 3.2 : 1.6) * Math.max(0.7, s * 0.6);
        g.beginPath();
        g.moveTo(x, yFuss);
        g.quadraticCurveTo(x + neig * 0.3, yFuss - hh * 0.6, x + neig, yFuss - hh);
        g.stroke();
        // Rohrkolben auf manchen Halmen.
        if (hash01(i * 1.9 + j * 4.4) < (vorn ? 0.45 : 0.35)) {
          g.fillStyle = kolben;
          g.beginPath();
          g.ellipse(x + neig, yFuss - hh - (vorn ? 6 : 2.5) * s, (vorn ? 3 : 1.4) * s, (vorn ? 9 : 3.6) * s, neig * 0.01, 0, TAU);
          g.fill();
        }
      }
    }
  }

  function zeichneLeben() {
    const s = view.s;
    const k = state.nacht;
    // Libellen in der Dämmerung.
    if (k < 0.7) {
      const a = 1 - k / 0.7;
      for (let i = 0; i < 3; i += 1) {
        const t = state.zeit * (0.35 + i * 0.07) + i * 2.1;
        const wx = state.camX + view.w * (0.2 + 0.3 * i) + Math.sin(t * 1.3) * 40 + Math.sin(t * 3.1) * 8;
        const wy = 40 + i * 14 + Math.sin(t * 1.9) * 16 + Math.sin(t * 5) * 3;
        const x = bildX(wx);
        const y = bildY(wy);
        const richtung = Math.cos(t * 1.3) >= 0 ? 1 : -1;
        g.save();
        g.translate(x, y);
        g.scale(richtung * s, s);
        g.globalAlpha = a;
        g.strokeStyle = i % 2 ? "#3fd0d9" : "#7bd36a";
        g.lineWidth = 1.4;
        g.beginPath();
        g.moveTo(-7, 0);
        g.lineTo(4, 0);
        g.stroke();
        g.fillStyle = i % 2 ? "#3fd0d9" : "#7bd36a";
        g.beginPath();
        g.arc(5, 0, 1.4, 0, TAU);
        g.fill();
        const schlag = Math.sin(state.zeit * 70 + i) * 0.5;
        g.fillStyle = "rgba(230,250,255,0.45)";
        g.beginPath();
        g.ellipse(-0.5, -2.5 - schlag, 4.5, 1.3, -0.3, 0, TAU);
        g.ellipse(-0.5, 2.5 + schlag, 4.5, 1.3, 0.3, 0, TAU);
        g.fill();
        g.restore();
      }
    }
    // Glühwürmchen in der Nacht.
    if (k > 0.3) {
      const a = clamp((k - 0.3) / 0.5, 0, 1);
      g.save();
      g.globalCompositeOperation = "lighter";
      const breite = 900;
      LICHTER.forEach((l, i) => {
        const t = state.zeit * l.v + l.t;
        const wx = state.camX - 60 + (((l.x - state.camX * 0.2) % breite) + breite) % breite + Math.sin(t) * 14;
        const wy = l.y + Math.sin(t * 1.4) * 8;
        const puls = 0.45 + 0.55 * Math.max(0, Math.sin(t * 2.2 + i));
        const x = bildX(wx);
        const y = bildY(wy);
        if (x < -20 || x > view.cssW + 20) return;
        g.globalAlpha = a * puls;
        const r = 5.5 * s;
        g.drawImage(sprites.gruen, x - r, y - r, r * 2, r * 2);
        g.fillStyle = "#f6ffc8";
        g.beginPath();
        g.arc(x, y, Math.max(1, 0.7 * s), 0, TAU);
        g.fill();
      });
      g.restore();
    }
  }

  // ---------------------------------------------------------------------------
  // Teilchen und Schriften
  // ---------------------------------------------------------------------------
  const TEILE_MAX = 220;
  function teil(t) {
    if (state.teile.length >= TEILE_MAX) state.teile.shift();
    state.teile.push(t);
  }

  function spritzer(x, anzahl, kraft = 1) {
    if (ruhig()) anzahl = Math.ceil(anzahl / 3);
    for (let i = 0; i < anzahl; i += 1) {
      const w = lerp(0.25, Math.PI - 0.25, Math.random());
      const v = (60 + Math.random() * 150) * kraft;
      teil({
        art: "tropfen", x: x + (Math.random() - 0.5) * 10, y: WASSER + 1,
        vx: Math.cos(w) * v * 0.7, vy: Math.sin(w) * v, r: 0.8 + Math.random() * 1.8, leben: 1.6, max: 1.6,
      });
    }
  }

  function glanz(x, y, anzahl, farbe = "gold") {
    if (ruhig()) anzahl = Math.ceil(anzahl / 3);
    for (let i = 0; i < anzahl; i += 1) {
      const w = Math.random() * TAU;
      const v = 30 + Math.random() * 90;
      teil({
        art: "glanz", farbe, x, y, vx: Math.cos(w) * v, vy: Math.sin(w) * v * 0.7 + 30,
        r: 1.5 + Math.random() * 2.2, leben: 0.6 + Math.random() * 0.5, max: 1.1,
      });
    }
  }

  function blasen(x, anzahl) {
    for (let i = 0; i < anzahl; i += 1) {
      teil({
        art: "blase", x: x + (Math.random() - 0.5) * 14, y: WASSER - 6 - Math.random() * 10,
        vx: (Math.random() - 0.5) * 8, vy: 14 + Math.random() * 20, r: 0.8 + Math.random() * 1.6, leben: 0.7 + Math.random() * 0.6, max: 1.3,
      });
    }
  }

  function ring(x, gold = false, gross = 1) {
    state.ringe.push({ x, r0: 4 * gross, r1: (gold ? 46 : 30) * gross, leben: gold ? 1.3 : 1, max: gold ? 1.3 : 1, gold });
    if (state.ringe.length > 24) state.ringe.shift();
  }

  function schrift(text, x, y, farbe, gross) {
    state.schriften.push({ text, x, y, farbe, gross, leben: 1.15, max: 1.15 });
    if (state.schriften.length > 6) state.schriften.shift();
  }

  function zeichneTeile() {
    if (!state.teile.length) return;
    const s = view.s;
    state.teile.forEach((t) => {
      const k = clamp(t.leben / t.max, 0, 1);
      const x = bildX(t.x);
      const y = bildY(t.y);
      if (t.art === "glanz") {
        g.save();
        g.globalCompositeOperation = "lighter";
        g.globalAlpha = k;
        const r = t.r * s * 2.4;
        g.drawImage(t.farbe === "weiss" ? sprites.weiss : sprites.gold, x - r, y - r, r * 2, r * 2);
        g.restore();
      } else if (t.art === "blase") {
        g.globalAlpha = k * 0.8;
        g.strokeStyle = "rgba(220,245,255,0.9)";
        g.lineWidth = 1;
        g.beginPath();
        g.arc(x, y, t.r * s, 0, TAU);
        g.stroke();
      } else {
        g.globalAlpha = Math.min(1, k * 1.6);
        g.fillStyle = "#e6f7ff";
        g.beginPath();
        g.arc(x, y, t.r * s * 0.7, 0, TAU);
        g.fill();
      }
    });
    g.globalAlpha = 1;
  }

  function zeichneSchriften() {
    if (!state.schriften.length) return;
    g.textAlign = "center";
    g.textBaseline = "middle";
    state.schriften.forEach((t) => {
      const k = clamp(t.leben / t.max, 0, 1);
      const steig = (1 - k) * 30;
      const pop = 1 + Math.max(0, (k - 0.82) / 0.18) * 0.35;
      g.globalAlpha = Math.min(1, k * 2.2);
      g.font = `900 ${Math.round(t.gross * clamp(view.s, 1.1, 2.4) * pop)}px system-ui, sans-serif`;
      g.lineWidth = 4;
      g.strokeStyle = "rgba(8, 20, 30, 0.7)";
      g.strokeText(t.text, bildX(t.x), bildY(t.y) - steig);
      g.fillStyle = t.farbe;
      g.fillText(t.text, bildX(t.x), bildY(t.y) - steig);
    });
    g.globalAlpha = 1;
  }

  // Oben links die Punkte, daneben ein kleines Blatt mit der Zahl der Blätter
  // und, solange sie läuft, die Reihe perfekter Landungen.
  function zeichneAnzeige() {
    if (state.schritt === "start" && state.phase === "bereit") return;
    bildTransform();
    // Auf dem Handy liegt der obere Rand unter den Knöpfen: dann darunter.
    g.translate(0, shell?.frei?.(canvas) || 0);
    const gross = clamp(view.cssH * 0.05, 15, 24);
    g.textAlign = "left";
    g.textBaseline = "middle";
    g.font = `900 ${Math.round(gross)}px system-ui, sans-serif`;
    const text = String(state.punkte);
    const textW = g.measureText(text).width;
    const klein = Math.round(gross * 0.62);
    g.font = `800 ${klein}px system-ui, sans-serif`;
    const zahl = String(state.erreicht);
    const zahlW = g.measureText(zahl).width;
    const w = gross * 0.6 + textW + gross * 1.45 + zahlW + gross * 0.6;
    const x = 12;
    const y = 12;
    g.fillStyle = "rgba(6, 22, 26, 0.55)";
    g.beginPath();
    if (g.roundRect) g.roundRect(x, y, w, gross * 1.6, gross * 0.8);
    else g.rect(x, y, w, gross * 1.6);
    g.fill();
    g.font = `900 ${Math.round(gross)}px system-ui, sans-serif`;
    g.fillStyle = "#ffffff";
    g.fillText(text, x + gross * 0.6, y + gross * 0.84);
    // Ein kleines Seerosenblatt vor der Zahl der Blätter.
    const bx = x + gross * 0.6 + textW + gross * 0.72;
    const by = y + gross * 0.82;
    g.fillStyle = "#6fcf5a";
    g.beginPath();
    g.moveTo(bx, by);
    g.arc(bx, by, gross * 0.33, Math.PI / 2 + 0.3, Math.PI / 2 - 0.3 + TAU);
    g.closePath();
    g.fill();
    g.font = `800 ${klein}px system-ui, sans-serif`;
    g.fillStyle = "rgba(255,255,255,0.88)";
    g.fillText(zahl, bx + gross * 0.5, y + gross * 0.86);

    // Die Reihe perfekter Landungen.
    if (state.kette >= 2) {
      const kx = x;
      const ky = y + gross * 1.6 + 6;
      const kt = `perfekt ×${state.kette}`;
      g.font = `900 ${Math.round(gross * 0.66)}px system-ui, sans-serif`;
      const kw = g.measureText(kt).width + gross * 0.9;
      const puls = 0.85 + 0.15 * Math.sin(state.zeit * 6);
      g.fillStyle = `rgba(255,200,70,${(0.9 * puls).toFixed(3)})`;
      g.beginPath();
      if (g.roundRect) g.roundRect(kx, ky, kw, gross * 1.05, gross * 0.52);
      else g.rect(kx, ky, kw, gross * 1.05);
      g.fill();
      g.fillStyle = "#3a2400";
      g.fillText(kt, kx + gross * 0.45, ky + gross * 0.55);
    }
  }

  function zeichnen() {
    if (!g) return;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, canvas.width, canvas.height);
    zeichneHimmel();
    zeichneUfer();
    zeichneWasser();
    zeichneSchilf(0.85, false);
    zeichneSpiegelung();
    zeichneRinge();
    const b = state.blaetter;
    for (let i = Math.max(0, state.auf - 2); i < Math.min(b.length, state.auf + 6); i += 1) zeichneBlatt(b[i]);
    zeichneGeister();
    bildTransform();
    zeichneFrosch();
    zeichneTeile();
    zeichneLeben();
    zeichneSchilf(1.35, true);
    zeichneSchriften();
    zeichneAnzeige();
  }

  // ---------------------------------------------------------------------------
  // Springen und Landen
  // ---------------------------------------------------------------------------
  function springen() {
    if (state.schritt !== "sitzt" || !state.laedt) return;
    const f = state.frosch;
    const weite = reichweite(state.ladung);
    const v = abflug(weite);
    f.vx = Math.cos(WINKEL) * v;
    f.vy = Math.sin(WINKEL) * v;
    state.schritt = "flug";
    state.laedt = false;
    state.ladung = 0;
    state.feder = 0;
    state.zeitlupeSchon = false;
    const b = state.blaetter[state.auf];
    if (b) {
      b.besetzt = false;
      b.wipp = 1;
      b.unruhe = 0;
    }
    spritzer(f.x - 4, 6, 0.5);
    ring(f.x, false, 0.7);
    if (state.phase !== "zuschauen") kids()?.vibrate?.(8);
  }

  function landen(b) {
    const f = state.frosch;
    const mitte = blattX(b);
    const ab = Math.abs(f.x - mitte);
    f.y = blattOben(b);
    f.vx = 0;
    f.vy = 0;
    f.dreh = 0;
    state.schritt = "sitzt";
    state.landeRuhe = LANDE_RUHE;
    state.sitzZeit = 0;
    // Die Zeitlupe klingt mit der Landung aus – das nächste Laden läuft
    // wieder in echter Zeit.
    state.zeitlupe = Math.min(state.zeitlupe, 0.12);
    state.feder = 1;
    b.wipp = 1;
    b.besetzt = true;
    ring(f.x, false, 1);
    spritzer(f.x, 8, 0.45);

    const neu = b.n > state.auf && !b.erreicht;
    state.auf = Math.max(state.auf, b.n);
    if (!neu) {
      // Zurück aufs selbe Blatt: kein Punkt, und die Reihe ist vorbei.
      state.kette = 0;
      return;
    }
    // Übersprungene Blätter zählen als erreicht.
    for (let i = 1; i <= b.n; i += 1) state.blaetter[i].erreicht = true;
    state.erreicht = b.n;
    blaetterBis(state.auf + 6);
    const zuschauen = state.phase === "zuschauen";
    let plus = 1;
    if (ab <= Math.max(PERFEKT_MIN, b.r * PERFEKT_ANTEIL)) {
      state.kette += 1;
      state.perfekte += 1;
      state.besteKette = Math.max(state.besteKette, state.kette);
      plus += Math.min(state.kette, KETTE_MAX);
      state.gold = 1;
      ring(mitte, true, 1);
      ring(mitte, true, 0.6);
      if (state.kette >= 3) ring(mitte, true, 1.5);
      glanz(mitte, BLATT_Y + 6, 12 + Math.min(16, state.kette * 2));
      schrift(state.kette >= 2 ? `perfekt ×${state.kette}` : "perfekt!", mitte, BLATT_Y + 34, "#ffd451", 15);
      if (!zuschauen) {
        kids()?.playJingle?.(state.kette >= 3 ? "unlock" : "correct");
        kids()?.vibrate?.(18);
      }
    } else {
      state.kette = 0;
      if (ab >= b.r * KNAPP_ANTEIL) {
        schrift("knapp!", f.x, BLATT_Y + 30, "#ffad5c", 13);
        state.stoss = Math.max(state.stoss, 0.35);
      }
      if (!zuschauen) kids()?.playJingle?.("star");
    }
    if (!zuschauen) {
      state.punkte += plus;
      shell.setCount(state.punkte);
    }
    schrift(`+${plus}`, f.x, BLATT_Y + 20, plus > 1 ? "#ffe9a6" : "#ffffff", plus > 1 ? 12 : 10);
    // Alle zehn Blätter ein kleines Fest.
    if (b.n % 10 === 0) glanz(mitte, BLATT_Y + 20, 22, "weiss");
  }

  // Ins Wasser. grund: "daneben" oder "gesunken". Was falsch war, steht
  // gross da: zu kurz, zu weit oder zu langsam – damit man weiss, was man
  // beim nächsten Mal anders macht.
  function platsch(grund) {
    if (state.schritt === "platsch") return;
    const f = state.frosch;
    state.schritt = "platsch";
    state.grund = grund;
    state.laedt = false;
    state.ladung = 0;
    state.platschZeit = state.zeit;
    state.geprustet = false;
    state.zeitlupe = 0;
    state.stoss = 1;
    state.kette = 0;
    state.gold = 0;
    f.vx *= 0.2;
    f.vy = Math.min(f.vy, -40);
    spritzer(f.x, 34, 1);
    ring(f.x, false, 1.4);
    ring(f.x, false, 0.9);
    let text = "zu langsam!";
    if (grund === "daneben") {
      const ziel = state.blaetter[state.auf + 1];
      text = ziel && f.x < blattX(ziel) ? "zu kurz!" : "zu weit!";
    }
    schrift(text, f.x, BLATT_Y + 32, "#ff8f6b", 17);
    if (state.phase !== "zuschauen") {
      kids()?.playJingle?.("retry");
      kids()?.vibrate?.([30, 40, 60]);
      stepTimer = window.setTimeout(finish, 1150);
    }
  }

  // Kein Blatt trägt ewig: Wer zu lange sitzt, merkt, wie es unruhig wird –
  // es zittert, Blasen steigen –, dann sinkt es. So endet auch eine Runde,
  // in der niemand mehr springt, und zum Zögern bleibt nur so viel Zeit.
  const geduld = (n) => lerp(5, 3, glatt(clamp(n / SCHWER_BIS, 0, 1)));
  const GEDULD_WARNT = 1.5;
  const GEDULD_SINKT = 1.2;

  function geduldTakt(bl, dt) {
    if (!bl) return;
    state.sitzZeit += dt;
    if (bl.sinkt) return;
    const gd = geduld(bl.n);
    bl.unruhe = clamp((state.sitzZeit - (gd - GEDULD_WARNT)) / GEDULD_WARNT, 0, 1);
    if (bl.unruhe > 0 && Math.random() < dt * 9 * bl.unruhe) blasen(blattX(bl) + (Math.random() - 0.5) * bl.r * 1.8, 1);
    if (state.sitzZeit >= gd) {
      bl.sinkt = true;
      bl.sinkDauer = GEDULD_SINKT;
      bl.sinkZeit = 0;
    }
  }

  // ---------------------------------------------------------------------------
  // Der Lauf
  // ---------------------------------------------------------------------------
  // Kurz vor einer Landung auf der Kippe – knapp am Rand oder knapp daneben –
  // läuft der Flug für einen Moment langsamer: Schafft er es?
  const ZEITLUPE = 0.3;
  function beinahe() {
    const f = state.frosch;
    const ueber = f.y - BLATT_Y;
    if (state.zeitlupeSchon || f.vy >= 0 || ueber > 16 || ueber < 0) return;
    state.zeitlupeSchon = true;
    const t = (f.vy + Math.sqrt(f.vy * f.vy + 2 * G * ueber)) / G;
    const xl = f.x + f.vx * t;
    let best = Infinity;
    for (let i = state.auf + 1; i < Math.min(state.blaetter.length, state.auf + 4); i += 1) {
      const bl = state.blaetter[i];
      best = Math.min(best, Math.abs(xl - blattX(bl, state.uhr + t)) / bl.r);
    }
    if (best >= KNAPP_ANTEIL && best <= 1.15) state.zeitlupe = 0.4;
  }

  function flug(dt) {
    const f = state.frosch;
    const vorY = f.y;
    f.x += f.vx * dt;
    f.y += f.vy * dt;
    f.vy -= G * dt;
    // Er dreht sich mit der Bahn: hoch hinaus die Nase oben, dann nach vorn.
    f.dreh = Math.atan2(f.vy, f.vx) * 0.42;
    if (f.vy < 0) {
      beinahe();
      const b = blattUnter(f.x);
      if (b) {
        const oben = blattOben(b);
        if (vorY >= oben && f.y <= oben) { landen(b); return; }
      }
      if (f.y <= WASSER - 1.5) platsch("daneben");
    }
  }

  function takt(dt) {
    // echt: die Zeit der Welt – nach ihr treiben und sinken die Blätter.
    // dt: die Zeit des Frosches, in der Zeitlupe langsamer.
    const echt = dt;
    if (state.zeitlupe > 0) {
      state.zeitlupe = Math.max(0, state.zeitlupe - echt);
      dt = echt * ZEITLUPE;
    }
    state.zeit += dt;
    if (state.stoss > 0) state.stoss = Math.max(0, state.stoss - dt * 2.6);
    if (state.feder > 0) state.feder = Math.max(0, state.feder - dt * 5.5);
    if (state.gold > 0) state.gold = Math.max(0, state.gold - dt * 1.4);
    const f = state.frosch;
    const laeuft = state.phase === "spiel" || state.phase === "zuschauen";

    const uhrVor = state.uhr;
    if (state.phase === "spiel") state.uhr += echt;

    // Blinzeln und Quaken, wenn er sitzt und nichts lädt.
    if (state.blinzeln > 0) state.blinzeln = Math.max(0, state.blinzeln - dt * 6);
    else if (Math.random() < dt * 0.35) state.blinzeln = 1;
    if (state.quaken > 0) state.quaken = Math.max(0, state.quaken - dt * 1.6);
    else if ((state.schritt === "sitzt" || state.schritt === "start") && !state.laedt && Math.random() < dt * 0.12) state.quaken = 1;

    // Die Blätter: sie wippen nach, die sinkenden sinken (und blubbern).
    const b = state.blaetter;
    for (let i = Math.max(0, state.auf - 2); i < Math.min(b.length, state.auf + 6); i += 1) {
      const bl = b[i];
      if (bl.wipp > 0) bl.wipp = Math.max(0, bl.wipp - dt * 3.2);
      if (bl.sinkt && (bl.besetzt || (bl.erreicht && bl.sinkZeit > 0))) {
        bl.sinkZeit += echt;
        if (bl.sinkZeit < bl.sinkDauer + 0.5 && Math.random() < echt * 7) blasen(blattX(bl) + (Math.random() - 0.5) * bl.r * 1.6, 1);
      }
    }

    if (state.phase === "zuschauen") {
      zuschauenTakt(echt);
    } else if (state.schritt === "start") {
      // Vor dem ersten Druck sitzt er da und atmet.
      f.y = blattOben(b[0]);
    } else if (state.schritt === "sitzt") {
      const bl = b[state.auf];
      // Er treibt mit seinem Blatt.
      f.x += blattX(bl) - blattX(bl, uhrVor);
      f.y = blattOben(bl);
      if (state.landeRuhe > 0) state.landeRuhe -= echt;
      if (state.phase === "spiel") geduldTakt(bl, echt);
      if (gedrueckt && state.phase === "spiel" && state.landeRuhe <= 0) {
        if (!state.laedt) {
          state.laedt = true;
          state.ladeUhr = 0;
        }
        state.ladeUhr += echt;
        state.ladung = pendel(state.ladeUhr / ladeZeit(state.auf));
      }
      // Ein sinkendes Blatt: ist es unter Wasser, ist er es auch.
      if (bl.sinkt && bl.sinkZeit >= bl.sinkDauer) {
        f.vy = -10;
        platsch("gesunken");
      }
    } else if (state.schritt === "flug") {
      const n = Math.max(1, Math.ceil(dt / TAKT));
      for (let i = 0; i < n && state.schritt === "flug"; i += 1) flug(dt / n);
    } else if (state.schritt === "platsch") {
      // Er geht unter – und kommt wieder hoch, bis die Augen herausschauen.
      const seit = state.zeit - state.platschZeit;
      if (seit < 0.42) {
        f.y = Math.max(WASSER - 26, f.y + f.vy * dt);
        f.vy -= 160 * dt;
      } else {
        const ziel = WASSER - 12 + Math.sin(state.zeit * 5) * 0.8;
        f.y += (ziel - f.y) * (1 - Math.exp(-dt * 7));
        f.dreh *= 1 - Math.min(1, dt * 5);
      }
    }

    // Im Wasser: Blasen, und wenn er auftaucht, prustet er.
    if (state.schritt === "platsch") {
      const seit = state.zeit - state.platschZeit;
      if (seit < 0.6 && Math.random() < dt * 14) blasen(f.x, 1);
      if (!state.geprustet && seit > 0.66) {
        state.geprustet = true;
        for (let i = 0; i < (ruhig() ? 4 : 11); i += 1) {
          teil({
            art: "tropfen", x: f.x + 11, y: WASSER + 2,
            vx: 30 + Math.random() * 70, vy: 70 + Math.random() * 90, r: 0.6 + Math.random() * 1.1, leben: 1.2, max: 1.2,
          });
        }
        ring(f.x + 8, false, 0.5);
      }
    }

    // Die Nacht kommt mit den Blättern, weich.
    const nachtZiel = clamp(state.erreicht / NACHT_BEI, 0, 1);
    state.nacht += (nachtZiel - state.nacht) * (1 - Math.exp(-echt * 0.8));

    // Teilchen, Ringe, Schriften.
    for (let i = state.teile.length - 1; i >= 0; i -= 1) {
      const t = state.teile[i];
      if (t.art === "tropfen") {
        t.vy -= 420 * dt;
        if (t.y < WASSER && t.vy < 0) {
          if (Math.random() < 0.15) ring(t.x, false, 0.25);
          state.teile.splice(i, 1);
          continue;
        }
      } else if (t.art === "glanz") {
        t.vy -= 40 * dt;
        t.vx *= 1 - 2 * dt;
      } else if (t.art === "blase") {
        if (t.y > WASSER - 1) { t.leben = 0; ring(t.x, false, 0.2); }
      }
      t.x += t.vx * dt;
      t.y += t.vy * dt;
      t.leben -= dt;
      if (t.leben <= 0) state.teile.splice(i, 1);
    }
    for (let i = state.ringe.length - 1; i >= 0; i -= 1) {
      state.ringe[i].leben -= dt;
      if (state.ringe[i].leben <= 0) state.ringe.splice(i, 1);
    }
    for (let i = state.schriften.length - 1; i >= 0; i -= 1) {
      state.schriften[i].leben -= dt;
      if (state.schriften[i].leben <= 0) state.schriften.splice(i, 1);
    }

    // Die Kamera gleitet.
    const ziel = camZiel();
    state.camX += (ziel - state.camX) * (1 - Math.exp(-echt * (laeuft ? 3.2 : 8)));

    if (state.phase === "spiel") {
      gegner?.takt(state.punkte, { a: Math.round(f.x - START.x), b: Math.round(f.y - START.y), c: cFuer() });
    }
  }

  // Was der Geist über die Figur wissen muss (deuteC).
  function cFuer() {
    if (state.schritt === "flug") return Math.round(state.frosch.dreh * 100);
    if (state.schritt === "platsch") return 20000;
    return 10000 + Math.round(state.ladung * 100);
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
  // Eine aufgezeichnete Runde in ihrem eigenen Teich: Der Zufall hält die Saat
  // (geist.js, zuschauer), startRun baut damit dieselben Blätter, die Uhr des
  // Teichs folgt der Zeit des Laufs, und der Frosch ist Bild für Bild dort,
  // wo er damals war. Absprung, Landung, «perfekt» und Platsch liest das Bild
  // aus c (deuteC) und zeigt sie wie im Spiel – nur still.
  function zuschauenStarten() {
    if (!zuschauer?.lauf) return;
    startRun();
    state.phase = "zuschauen";
    state.schritt = "sitzt";
    shell.setPhase("play");
    zuschauer.los();
  }

  function zuschauenTakt(dt) {
    const s = zuschauer.stand();
    if (!s) return;
    state.uhr = Math.max(0, s.t) / 1000;
    const f = state.frosch;
    const lage = deuteC(s.c);
    f.x = START.x + s.a;
    f.y = START.y + s.b;
    const war = state.schritt;
    if (war === "platsch") {
      // Einmal im Wasser bleibt er dort.
    } else if (lage.platsch) {
      platsch(war === "sitzt" ? "gesunken" : "daneben");
    } else if (lage.sitzt) {
      if (war === "flug") {
        const b = blattUnter(f.x);
        if (b) landen(b);
      }
      state.schritt = "sitzt";
      state.laedt = lage.ladung > 0.01;
      state.ladung = lage.ladung;
      f.dreh = 0;
      const bl = blattUnter(f.x);
      if (bl && bl.n > state.auf) state.auf = bl.n;
      if (bl) {
        bl.besetzt = true;
        if (bl.n === state.auf) geduldTakt(bl, dt);
      }
    } else {
      if (war === "sitzt") {
        state.laedt = true;
        springen();
      }
      state.schritt = "flug";
      f.dreh = lage.dreh;
    }
    const punkte = Math.max(0, Math.round(s.punkte));
    if (punkte !== state.punkte) {
      state.punkte = punkte;
      shell.setCount(punkte);
    }
    zuschauer.weiter();
  }

  // ---------------------------------------------------------------------------
  // Halten und Loslassen
  // ---------------------------------------------------------------------------
  // Die Runde beginnt: mit dem ersten Druck – oder im Live-Modus zum
  // gemeinsamen Start (game-shell.js, live.los).
  function losGehts() {
    if (state.phase !== "bereit") return;
    state.phase = "spiel";
    state.schritt = "sitzt";
    state.landeRuhe = 0;
    state.sitzZeit = 0;
    shell.setPhase("play");
    gegner?.los();
    kids()?.vibrate?.(8);
  }

  function druecken() {
    if (state.phase === "zuschauen" || state.phase === "ende") return;
    gedrueckt = true;
    losGehts();
  }

  function loslassen() {
    if (!gedrueckt) return;
    gedrueckt = false;
    if (state.phase === "spiel" && state.laedt) springen();
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
    state.erreicht = 0;
    state.auf = 0;
    state.kette = 0;
    state.besteKette = 0;
    state.perfekte = 0;
    state.blaetter = [];
    blaetterBis(8);
    state.frosch = { x: START.x, y: START.y, vx: 0, vy: 0, dreh: 0 };
    state.ladung = 0;
    state.laedt = false;
    state.ladeUhr = 0;
    state.landeRuhe = 0;
    state.sitzZeit = 0;
    state.feder = 0;
    state.gold = 0;
    state.zeitlupe = 0;
    state.zeitlupeSchon = false;
    state.geprustet = false;
    state.uhr = 0;
    state.nacht = 0;
    state.ringe = [];
    state.teile = [];
    state.schriften = [];
    state.stoss = 0;
    state.zeit = 0;
    state.grund = "";
    gedrueckt = false;
    shell.setCount(0);
    gegner?.runde();

    shell.clear();
    const prompt = shell.el("p", "cm-prompt fr-prompt", "Halten lädt den Sprung – Loslassen springt.");
    shell.play.append(prompt, buildPlatz());
    view.cssW = 0;
    view.cssH = 0;
    messen();
    state.camX = camZiel();

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
    if (state.phase === "ende") return;
    if (state.phase === "zuschauen") return;
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
    const blaetter = state.erreicht === 1 ? "1 Blatt" : `${state.erreicht} Blätter`;
    const reihe = state.besteKette >= 2 ? ` · ${state.besteKette} perfekt in Folge` : state.perfekte ? ` · ${state.perfekte} perfekt` : "";
    shell.showResult({
      label: "Deine Punkte",
      points: punkte,
      detail: rekord ? `Neuer Rekord! ${blaetter}` : `${blaetter}${reihe}${vorher ? ` · Bestwert ${vorher}` : ""}`,
      geist,
    });
    if (rekord) host.querySelector(".cm-result-detail")?.classList.add("fr-rekord");
    zaehleHoch(punkte);
  }

  // ---------------------------------------------------------------------------
  // Start
  // ---------------------------------------------------------------------------
  shell = shellApi.mount({
    host,
    title: "Froschsprung",
    area: "konzentration",
    accent: "#00A5B5",
    accentDark: "#00707c",
    clock: false,
    onRestart: () => (zuschauer ? zuschauenStarten() : startRun()),
    live: { los: losGehts, stopp: () => finish(), zuschauen: (quelle) => { zuschauer = quelle; zuschauenStarten(); } },
  });
  zuschauer = window.LernappGeist?.zuschauer?.({
    host, spiel: "frogHop", fassung: "t1", zufall, einheit: "Punkte", nochmal: zuschauenStarten,
  }) || null;
  if (!zuschauer) {
    gegner = window.LernappGeist?.fuer?.({ spiel: "frogHop", host, art: "tempo", alle: true, zufall }) || null;
  }

  startRun();
  zuschauer?.laden.then((da) => { if (da) zuschauenStarten(); });

  host.addEventListener("pointerdown", (event) => {
    if (event.target.closest("button, a, input")) return;
    druecken();
  });
  window.addEventListener("pointerup", loslassen);
  window.addEventListener("pointercancel", loslassen);
  // Wer das Fenster verlässt, lässt los – und springt.
  window.addEventListener("blur", loslassen);

  const TASTEN = new Set([" ", "Enter", "ArrowUp", "ArrowRight"]);
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
  window.LernappFrosch = {
    W_MIN, W_MAX, G, WINKEL, BLATT_Y, PERFEKT_ANTEIL,
    state, view, takt, druecken, loslassen, blaetterBis, blattX, reichweite, flugzeit, ladeZeit, pendel, geduld,
  };
})();
