/*
 * huegel.js – Hügelflieger.
 * ---------------------------------------------------------------------------
 * Ein kleiner Vogel rutscht über eine Kette von Hügeln. Fliegen kann er
 * nicht recht – aber schwer und leicht werden. Wer den Finger aufs Bild
 * legt, macht ihn schwer: Er saust die Hügel hinab und holt Schwung, und in
 * der Luft stürzt er wie ein Stein. Wer loslässt, macht ihn leicht: Er
 * trägt den Schwung den nächsten Hügel hinauf, hebt an der Kuppe ab und
 * breitet in der Luft die Flügel aus – er gleitet, und mit genug Schwung
 * über den nächsten Hügel hinweg.
 *
 * Der Trick ist die Landung. Wer genau auf einem Abhang aufsetzt, im
 * selben Winkel, in dem der Hang abfällt, behält den Schwung und bekommt
 * etwas dazu: Perfekt! (+8 % Tempo). Drei perfekte Landungen, ohne dass eine
 * harte dazwischen kommt, und er ist On Fire: Er zieht eine kleine
 * Feuerspur hinter sich her, brennt sich nach vorn (steter Schub, mehr
 * Höchsttempo – gut ein Drittel weiter), und jede weitere perfekte Landung
 * gibt +14 % statt +8 % – bis zur nächsten harten Landung. Wer in einen Gegenhang
 * kracht, verliert Tempo, und das Feuer ist aus. Oben links zählen drei
 * Punkte bis On Fire mit; brennt es, steht dort, was es bringt.
 *
 * Flüssig vor prächtig: Der Hintergrund zieht ruhig mit, und was gezeichnet
 * wird, ist so gebaut, dass es auch auf einem einfachen Handy jedes Bild
 * schafft.
 *
 * Eine Minute lang, dann geht die Sonne unter. Gezählt wird, wie weit er
 * bis dahin kommt, in Metern.
 *
 * Gebaut werden die Hügel aus dem Zufall (zufall.js): ohne Turnier jedes
 * Mal andere, im Turnier für alle im selben Versuch dieselben. Nach hinten
 * werden sie höher und weiter.
 *
 * Die Gegner (geist.js) fliegen als Vögel aus Licht mit – genau so, wie sie
 * in ihrer besten Runde geflogen sind, Sekunde für Sekunde. Und die besten
 * Flüge lassen sich anschauen (?zuschauen=, geist.js): über ihren eigenen
 * Hügeln, gewürfelt mit derselben Saat – mit Feuer, wo sie brannten.
 *
 * Gerechnet wird in Welteinheiten, zehn sind ein Meter; y zählt nach oben.
 */
(() => {
  "use strict";

  if (document.body.dataset.page !== "hills") return;

  const host = document.querySelector("#hf-stage");
  const shellApi = window.LernappGameShell;
  const cloudApi = window.LernappGameCloud;
  if (!host || !shellApi) return;

  const kids = () => window.LernappKids || null;
  const ruhig = () => Boolean(kids()?.prefersReducedMotion?.());

  const zufall = window.LernappZufall?.fuer?.("hillGlide") || {
    neu() {},
    zahl: () => Math.random(),
  };

  // ---------------------------------------------------------------------------
  // Die Welt
  // ---------------------------------------------------------------------------
  const RUNDE_MS = 60000;
  const METER = 10;
  const SICHT_H = 300;
  const SICHT_W_MIN = 380;
  const VOGEL_AN = 0.3;            // so weit vom linken Rand fliegt er
  const START_X = 0;
  const TAKT = 1 / 240;

  const G_LEICHT = 520;            // so zieht es, wenn er leicht ist …
  const G_SCHWER = 3600;           // … und so, wenn er schwer ist
  const GLEITEN = 1.5;             // losgelassen in der Luft: so fängt die Luft das Sinken ab …
  const AUFTRIEB = 0.35;           // … und so viel davon schiebt ihn nach vorn
  const V_MIN = 120;               // langsamer rutscht er nie – er flattert
  const V_MAX = 1150;
  // On Fire: Er brennt sich nach vorn – ein steter Schub in Flugrichtung,
  // weniger Luftwiderstand und mehr Höchsttempo.
  const FEUER_SCHUB = 140;
  const FEUER_TEMPO = 1.3;
  const REIBUNG = 0.055;           // am Boden, mit dem Gewicht: schwer bremst mehr
  const PERFEKT_WINKEL = 0.48;     // so flach muss er auf dem Abhang landen
  const SCHLECHT_WINKEL = 0.66;    // so steiler ist es eine harte Landung
  const R = 11;                    // der Vogel, als Kreis

  const HELP = [
    "Hügelflieger. Halte den Finger auf dem Bild, dann wird der Vogel schwer und saust die Hügel hinab.",
    "Lass los, dann wird er leicht, fliegt über die Kuppe und gleitet mit ausgebreiteten Flügeln – mit genug Schwung über den nächsten Hügel hinweg. In der Luft halten, und er stürzt hinab.",
    "Lande genau auf einem Abhang, im Winkel des Hangs: Perfekt! Das gibt Schwung. Oben links zählen drei Punkte mit.",
    "Nach drei perfekten Landungen ist er On Fire: Er zieht eine Feuerspur hinter sich her, fliegt schneller, und jede weitere perfekte Landung gibt fast doppelt so viel Schwung. Eine harte Landung löscht das Feuer.",
    "Nach einer Minute geht die Sonne unter. Es zählt, wie weit du kommst, in Metern.",
  ].join(" ");

  const TOP_COUNT = 5;
  const store = cloudApi
    ? cloudApi.register({ key: "lernapp.huegel", empty: { runs: 0, scores: [] }, merge: cloudApi.mergeScores(TOP_COUNT) })
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
  const meterBei = (x) => Math.max(0, (x - START_X) / METER);
  const schwereBei = (x) => 1 - Math.exp(-meterBei(x) / 1600);

  function hash01(n) {
    const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return x - Math.floor(x);
  }

  // ---------------------------------------------------------------------------
  // Zustand
  // ---------------------------------------------------------------------------
  // phase:   "bereit", "spiel", "ende"
  const state = {
    phase: "bereit",
    punkte: 0,
    meter: 0,
    perfekt: 0,
    serie: 0,
    feuer: false,         // On Fire
    feuerZeit: -9,        // wann das Feuer zuletzt anging – für die Einblendung
    vorbeiZeit: -9,       // … und wann es zuletzt ausging
    flammenTakt: 0,       // wann die nächste Flamme der Spur kommt
    v: { x: START_X, y: 0, vx: 0, vy: 0 },
    amBoden: true,
    flugZeit: 0,
    hoechste: 0,
    huegel: [],           // Extrempunkte { x, y }, abwechselnd Tal und Kuppe
    spur: [],
    teile: [],
    schriften: [],
    camX: 0,
    camY: 0,
    zoom: 1,
    zeit: 0,
    tag: 0,               // 0 Mittag … 1 Abend
    flattern: 0,
  };

  let shell = null;
  let feld = null;
  let canvas = null;
  let g = null;
  let frame = null;
  let last = 0;
  let stepTimer = null;
  let gedrueckt = false;
  let gegner = null;
  // Wer einen Flug anschaut statt zu fliegen (geist.js, zuschauer).
  let zuschauer = null;
  let rundeStart = 0;

  const view = { s: 1, grundS: 1, dpr: 1, cssW: 0, cssH: 0, w: SICHT_W_MIN, h: SICHT_H, w0: SICHT_W_MIN, h0: SICHT_H };

  function clearStep() {
    if (stepTimer) { window.clearTimeout(stepTimer); stepTimer = null; }
  }

  function stopLoop() {
    if (frame) { window.cancelAnimationFrame(frame); frame = null; }
  }

  // ---------------------------------------------------------------------------
  // Die Hügel
  // ---------------------------------------------------------------------------
  /*
   * Die Hügel sind eine Kette von Tälern und Kuppen, verbunden mit einer
   * Kosinuskurve – glatt, ohne Knick. Je weiter hinten, desto höher und
   * weiter. Jeder Hügel (von Tal zu Tal) bekommt seine Farben.
   */
  function neuerPunkt() {
    const h = state.huegel;
    if (!h.length) {
      // Der Start: ein langer Hang hinab, damit es gleich Schwung gibt.
      h.push({ x: START_X - 300, y: 90 }, { x: START_X - 120, y: 140 }, { x: START_X + 260, y: -60 });
      return;
    }
    const vor = h[h.length - 1];
    const kuppe = vor.y < (h[h.length - 2]?.y ?? 0);   // nach einem Tal kommt eine Kuppe
    const k = schwereBei(vor.x);
    const weit = lerp(230, 380, k) * (0.8 + zufall.zahl() * 0.4);
    const hoch = lerp(100, 230, k) * (0.65 + zufall.zahl() * 0.5);
    // Die Mitte der Hügel bleibt bei 0: Täler unter, Kuppen über ihr.
    const y = kuppe ? clamp(vor.y + hoch, 10, 260) : clamp(vor.y - hoch, -240, -10);
    h.push({ x: vor.x + weit, y });
  }

  function huegelBis(x) {
    while (!state.huegel.length || state.huegel[state.huegel.length - 1].x < x) neuerPunkt();
  }

  function abschnitt(x) {
    huegelBis(x + 10);
    const h = state.huegel;
    let lo = 0;
    let hi = h.length - 1;
    while (lo < hi - 1) {
      const mid = (lo + hi) >> 1;
      if (h[mid].x <= x) lo = mid;
      else hi = mid;
    }
    return lo;
  }

  function bodenBei(x) {
    const i = abschnitt(x);
    const a = state.huegel[i];
    const b = state.huegel[i + 1];
    const u = clamp((x - a.x) / (b.x - a.x), 0, 1);
    return a.y + (b.y - a.y) * (1 - Math.cos(Math.PI * u)) / 2;
  }

  function steigungBei(x) {
    const i = abschnitt(x);
    const a = state.huegel[i];
    const b = state.huegel[i + 1];
    const L = b.x - a.x;
    const u = clamp((x - a.x) / L, 0, 1);
    return ((b.y - a.y) * Math.PI * Math.sin(Math.PI * u)) / (2 * L);
  }

  // Die Farben eines Hügels: zwei Streifen, im Wechsel. Nach der Nummer
  // seines Tals, nicht nach dem Zufall.
  const STREIFEN = [
    ["#7fd36b", "#5fbf55"], ["#ffcf6b", "#ffb347"], ["#ff8fb1", "#ff6f99"],
    ["#7fc8ff", "#5aa9f0"], ["#b9a2ff", "#9a7ff0"], ["#6fe0c8", "#4cc7ad"], ["#ffa07a", "#ff8460"],
  ];

  // ---------------------------------------------------------------------------
  // Die Fläche
  // ---------------------------------------------------------------------------
  function buildPlatz() {
    const platz = shell.el("div", "hf-platz");
    feld = shell.el("div", "hf-feld");
    canvas = document.createElement("canvas");
    canvas.className = "hf-canvas";
    canvas.setAttribute("aria-hidden", "true");
    feld.append(canvas);
    g = canvas.getContext("2d");

    const tipp = shell.el("span", "hf-tipp");
    tipp.setAttribute("aria-hidden", "true");
    const ns = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(ns, "svg");
    svg.setAttribute("viewBox", "0 0 64 64");
    [
      { r: 22, stroke: "rgba(255,255,255,0.5)", w: 5 },
      { r: 22, stroke: "#ffffff", w: 5, klasse: "hf-tipp-fuell" },
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
    // Höchstens doppelt so fein wie ein Bildpunkt: Feiner sieht niemand,
    // aber jedes Bild kostete ein Drittel mehr.
    const dpr = clamp(window.devicePixelRatio || 1, 1, 2);
    if (cssW === view.cssW && cssH === view.cssH && dpr === view.dpr) return;
    view.cssW = cssW;
    view.cssH = cssH;
    view.dpr = dpr;
    // Mindestens SICHT_H hoch und SICHT_W_MIN breit.
    view.w0 = Math.max(SICHT_H * (cssW / cssH), SICHT_W_MIN);
    view.h0 = view.w0 / (cssW / cssH);
    // Der Massstab ohne Zoom – an ihm zieht der Hintergrund vorbei.
    view.s0 = cssW / view.w0;
    skaliere();
    const pw = Math.round(cssW * dpr);
    const ph = Math.round(cssH * dpr);
    if (canvas.width !== pw) canvas.width = pw;
    if (canvas.height !== ph) canvas.height = ph;
  }

  function skaliere() {
    view.w = view.w0 * state.zoom;
    view.h = view.h0 * state.zoom;
    view.s = view.cssW / view.w;
  }

  function bildTransform() {
    g.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
  }

  function weltTransform() {
    const f = view.s * view.dpr;
    g.setTransform(f, 0, 0, -f, -state.camX * f, (view.cssH + state.camY * view.s) * view.dpr);
  }

  const bildX = (x) => (x - state.camX) * view.s;
  const bildY = (y) => view.cssH - (y - state.camY) * view.s;

  // ---------------------------------------------------------------------------
  // Zeichnen
  // ---------------------------------------------------------------------------
  // Der Himmel im Lauf des Tages: Mittag, goldener Nachmittag, Abendrot,
  // Dämmerung. tag läuft von 0 bis 1.
  const HIMMEL = [
    { k: 0, oben: [86, 170, 255], unten: [190, 232, 255] },
    { k: 0.55, oben: [92, 150, 230], unten: [255, 220, 160] },
    { k: 0.8, oben: [120, 90, 190], unten: [255, 150, 110] },
    { k: 1, oben: [30, 30, 90], unten: [200, 90, 120] },
  ];

  function himmelBei(tag, welche) {
    for (let i = 0; i < HIMMEL.length - 1; i += 1) {
      const a = HIMMEL[i];
      const b = HIMMEL[i + 1];
      if (tag <= b.k) {
        const k = (tag - a.k) / (b.k - a.k);
        const c = a[welche].map((v, j) => Math.round(lerp(v, b[welche][j], k)));
        return `rgb(${c[0]},${c[1]},${c[2]})`;
      }
    }
    const c = HIMMEL[HIMMEL.length - 1][welche];
    return `rgb(${c[0]},${c[1]},${c[2]})`;
  }

  // Die Wolken: eine Lage, gleichmässig verteilt. Alle ziehen gleich schnell,
  // so holt keine eine andere ein.
  const WOLKEN = Array.from({ length: 6 }, (_, i) => ({
    x: (i + 0.2 + hash01(i * 3.3 + 1) * 0.6) / 6, y: 0.08 + hash01(i * 5.1 + 2) * 0.34, s: 0.7 + hash01(i * 7.7) * 0.5,
  }));

  function zeichneHimmel() {
    bildTransform();
    const W = view.cssW;
    const H = view.cssH;
    const verlauf = g.createLinearGradient(0, 0, 0, H);
    verlauf.addColorStop(0, himmelBei(state.tag, "oben"));
    verlauf.addColorStop(1, himmelBei(state.tag, "unten"));
    g.fillStyle = verlauf;
    g.fillRect(0, 0, W, H);

    // Die Sonne sinkt im Lauf der Minute zum Horizont.
    const sx = W * 0.75;
    const sy = H * lerp(0.16, 0.78, state.tag);
    const sr = Math.min(W, H) * 0.08;
    const hof = g.createRadialGradient(sx, sy, sr * 0.5, sx, sy, sr * 3.4);
    hof.addColorStop(0, `rgba(255, ${Math.round(lerp(250, 170, state.tag))}, 150, 0.55)`);
    hof.addColorStop(1, "rgba(255, 200, 150, 0)");
    g.fillStyle = hof;
    g.fillRect(sx - sr * 3.4, sy - sr * 3.4, sr * 6.8, sr * 6.8);
    g.fillStyle = `rgb(255, ${Math.round(lerp(244, 150, state.tag))}, ${Math.round(lerp(170, 90, state.tag))})`;
    g.beginPath();
    g.arc(sx, sy, sr, 0, Math.PI * 2);
    g.fill();

    // Sterne in der Dämmerung.
    if (state.tag > 0.8) {
      g.fillStyle = "#ffffff";
      g.globalAlpha = (state.tag - 0.8) * 4;
      for (let i = 0; i < 40; i += 1) {
        g.beginPath();
        g.arc(hash01(i * 2.7) * W, hash01(i * 4.1) * H * 0.5, 0.5 + hash01(i) * 1.2, 0, Math.PI * 2);
        g.fill();
      }
      g.globalAlpha = 1;
    }

    // Der Hintergrund zieht ruhig mit: nach dem Weg, den der Vogel macht,
    // gemessen im Massstab ohne Zoom. Am gezoomten Massstab sprang er bei
    // jedem Zoom – je weiter vorn, desto weiter, bis die Wolken rückwärts
    // flogen.
    const weg = state.camX * view.s0;

    // Wolken.
    const breite = W + 240;
    WOLKEN.forEach((w) => {
      const x = ((w.x * breite - weg * 0.06) % breite + breite) % breite - 120;
      const y = w.y * H;
      const s = w.s * Math.min(W, H) * 0.07;
      g.fillStyle = `rgba(255, 255, 255, ${lerp(0.85, 0.5, state.tag)})`;
      g.beginPath();
      g.arc(x, y, s, 0, Math.PI * 2);
      g.arc(x + s * 0.9, y + s * 0.2, s * 0.8, 0, Math.PI * 2);
      g.arc(x - s * 0.9, y + s * 0.25, s * 0.7, 0, Math.PI * 2);
      g.arc(x + s * 0.2, y - s * 0.4, s * 0.75, 0, Math.PI * 2);
      g.fill();
    });

    // Ferne Hügel, zwei Lagen, im Dunst. Die Punkte ihres Kamms gehören zu
    // den Hügeln, nicht zum Bildschirm: Sie ziehen mit, statt sich bei jedem
    // Bild neu zu formen.
    [[0.15, 0.62, "rgba(140, 190, 230, 0.55)"], [0.3, 0.7, "rgba(110, 170, 200, 0.6)"]].forEach(([tempo, hoehe, farbe], lage) => {
      const zug = weg * tempo;
      const schritt = 16;
      g.fillStyle = farbe;
      g.beginPath();
      g.moveTo(-schritt, H);
      for (let i = Math.floor(zug / schritt) - 1; ; i += 1) {
        const x = i * schritt - zug;
        const wx = (i * schritt) / 90;
        g.lineTo(x, H * hoehe - (Math.sin(wx * 0.8 + lage) * 0.6 + Math.sin(wx * 1.9 + lage * 2) * 0.4) * H * 0.07);
        if (x > W + schritt) break;
      }
      g.lineTo(W + schritt * 2, H);
      g.closePath();
      g.fill();
    });
    // Abends färbt sich der Dunst.
    if (state.tag > 0.5) {
      g.fillStyle = `rgba(255, 120, 90, ${(state.tag - 0.5) * 0.25})`;
      g.fillRect(0, 0, W, H);
    }
  }

  // Die Hügel: von Tal zu Tal einer, in Streifen, mit heller Kante und einem
  // Schatten nach unten.
  function zeichneHuegel() {
    const x0 = state.camX - 20;
    const x1 = state.camX + view.w + 20;
    huegelBis(x1 + 400);
    const h = state.huegel;
    const unten = state.camY - 40;
    weltTransform();
    let i = abschnitt(x0);
    if (h[i].y > (h[i + 1]?.y ?? 0)) i = Math.max(0, i - 1);
    // i ist jetzt ein Tal (oder davor): ein Hügel reicht bis zum übernächsten Punkt.
    for (; i < h.length - 1 && h[i].x < x1; i += 1) {
      const a = h[i];
      const b = h[i + 1];
      const c = h[i + 2] || b;
      const tal = a.y < b.y;
      if (!tal) continue;
      const von = a.x;
      const bis = c.x;
      const farben = STREIFEN[Math.abs(Math.round(a.x / 7)) % STREIFEN.length];
      g.save();
      g.beginPath();
      g.moveTo(von, unten);
      for (let x = von; x <= bis; x += 6) g.lineTo(x, bodenBei(x));
      g.lineTo(bis, bodenBei(bis));
      g.lineTo(bis, unten);
      g.closePath();
      g.fillStyle = farben[0];
      g.fill();
      g.clip();
      // Schräge Streifen – alle in einem Pfad, einmal gefüllt.
      g.fillStyle = farben[1];
      const hoch = Math.max(a.y, b.y) + 40;
      g.beginPath();
      for (let sx = von - 300; sx < bis + 300; sx += 36) {
        g.moveTo(sx, unten);
        g.lineTo(sx + 18, unten);
        g.lineTo(sx + 18 + (hoch - unten) * 0.6, hoch);
        g.lineTo(sx + (hoch - unten) * 0.6, hoch);
        g.closePath();
      }
      g.fill();
      // Nach unten dunkler.
      const schatten = g.createLinearGradient(0, b.y, 0, unten);
      schatten.addColorStop(0, "rgba(0,0,0,0)");
      schatten.addColorStop(1, "rgba(20, 20, 60, 0.45)");
      g.fillStyle = schatten;
      g.fillRect(von, unten, bis - von, b.y - unten + 60);
      g.restore();
    }
    // Die helle Kante oben auf allen Hügeln.
    g.strokeStyle = "rgba(255,255,255,0.75)";
    g.lineWidth = 4 / view.s;
    g.lineJoin = "round";
    g.beginPath();
    for (let x = x0; x <= x1; x += 6) {
      const y = bodenBei(x);
      if (x === x0) g.moveTo(x, y);
      else g.lineTo(x, y);
    }
    g.stroke();
    // Abends ein warmer Schleier über allem.
    if (state.tag > 0.6) {
      bildTransform();
      g.fillStyle = `rgba(80, 30, 90, ${(state.tag - 0.6) * 0.35})`;
      g.fillRect(0, 0, view.cssW, view.cssH);
    }
  }

  // Alle hundert Meter ein Fähnchen auf dem Hügel.
  function zeichneMarken() {
    const von = Math.max(100, Math.ceil(meterBei(state.camX) / 100) * 100);
    const bis = meterBei(state.camX + view.w);
    bildTransform();
    const gross = Math.round(clamp(view.cssH * 0.03, 10, 14));
    g.font = `800 ${gross}px system-ui, sans-serif`;
    g.textAlign = "center";
    g.textBaseline = "bottom";
    for (let m = von; m <= bis; m += 100) {
      const x = START_X + m * METER;
      const sx = bildX(x);
      const sy = bildY(bodenBei(x));
      g.strokeStyle = "rgba(255,255,255,0.8)";
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(sx, sy);
      g.lineTo(sx, sy - 22);
      g.stroke();
      g.fillStyle = "#ffffff";
      g.beginPath();
      g.moveTo(sx, sy - 22);
      g.lineTo(sx + 12, sy - 18);
      g.lineTo(sx, sy - 14);
      g.closePath();
      g.fill();
      g.fillStyle = "rgba(30, 40, 80, 0.75)";
      g.fillText(`${m} m`, sx, sy - 24);
    }
  }

  // Der Vogel: rund, mit Auge, Schnabel und Flügel. Leicht flattert er, schwer
  // legt er die Flügel an und wird etwas flacher.
  function vogel(x, y, winkel, farbe, alpha, schwer, flattern, gleitet = false) {
    g.save();
    g.globalAlpha = alpha;
    g.translate(x, y);
    g.rotate(winkel);
    const sx = schwer ? 1.12 : 1;
    const sy = schwer ? 0.9 : 1;
    g.scale(sx, sy);
    // Im Gleiten: beide Flügel weit ausgebreitet, der hintere etwas dunkler.
    if (gleitet) {
      g.fillStyle = farbe[1];
      g.globalAlpha = alpha * 0.7;
      g.beginPath();
      g.ellipse(-R * 0.15, R * 0.95, R * 1.35, R * 0.34, -0.7, 0, Math.PI * 2);
      g.fill();
      g.globalAlpha = alpha;
    }
    // Körper
    const k = g.createRadialGradient(-R * 0.3, R * 0.35, R * 0.2, 0, 0, R);
    k.addColorStop(0, farbe[0]);
    k.addColorStop(1, farbe[1]);
    g.fillStyle = k;
    g.beginPath();
    g.arc(0, 0, R, 0, Math.PI * 2);
    g.fill();
    // Bauch
    g.fillStyle = "rgba(255,255,255,0.55)";
    g.beginPath();
    g.ellipse(R * 0.15, -R * 0.35, R * 0.6, R * 0.42, 0, 0, Math.PI * 2);
    g.fill();
    // Flügel: angelegt, wenn er schwer ist, ausgebreitet im Gleiten, sonst
    // flatternd.
    g.fillStyle = farbe[1];
    g.beginPath();
    if (gleitet) {
      g.ellipse(-R * 0.45, R * 0.75, R * 1.6, R * 0.44, -0.42, 0, Math.PI * 2);
    } else {
      const schlag = schwer ? -0.2 : Math.sin(flattern) * 0.9;
      g.ellipse(-R * 0.25, R * 0.15, R * 0.65, R * 0.32, schlag, 0, Math.PI * 2);
    }
    g.fill();
    if (gleitet) {
      // Die Schwungfedern als feine Linien.
      g.strokeStyle = "rgba(255,255,255,0.45)";
      g.lineWidth = R * 0.08;
      g.beginPath();
      for (let i = 0; i < 3; i += 1) {
        g.moveTo(-R * (0.8 + i * 0.35), R * (0.8 + i * 0.16));
        g.lineTo(-R * (1.35 + i * 0.35), R * (1.1 + i * 0.16));
      }
      g.stroke();
    }
    // Auge
    g.fillStyle = "#ffffff";
    g.beginPath();
    g.arc(R * 0.45, R * 0.38, R * 0.3, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "#1d2440";
    g.beginPath();
    g.arc(R * 0.53, R * 0.36, R * 0.15, 0, Math.PI * 2);
    g.fill();
    // Schnabel
    g.fillStyle = "#ffb52e";
    g.beginPath();
    g.moveTo(R * 0.85, R * 0.12);
    g.lineTo(R * 1.45, -R * 0.02);
    g.lineTo(R * 0.85, -R * 0.2);
    g.closePath();
    g.fill();
    g.restore();
  }

  function zeichneSpur() {
    if (state.spur.length < 2) return;
    weltTransform();
    g.lineCap = "round";
    for (let i = 1; i < state.spur.length; i += 1) {
      const a = state.spur[i - 1];
      const b = state.spur[i];
      const k = i / state.spur.length;
      g.globalAlpha = k * (state.feuer ? 0.7 : 0.5);
      g.strokeStyle = state.feuer ? "#ff8a1f" : "#ffffff";
      g.lineWidth = (1 + k * 3.5) / Math.max(0.6, view.s) * 1.2;
      g.beginPath();
      g.moveTo(a.x, a.y);
      g.lineTo(b.x, b.y);
      g.stroke();
    }
    g.globalAlpha = 1;
  }

  // Die Gegner als Vögel aus Licht, mit Namen darüber.
  function geisterOrte() {
    if (!gegner || state.phase === "bereit") return [];
    const ms = gegner.zeit();
    return gegner.gegner().filter((geg) => geg.lauf?.mitOrt).map((geg) => {
      const ort = geg.lauf.ort(ms);
      const bald = geg.lauf.ort(ms + 100);
      return {
        ...geg,
        x: START_X + ort.a,
        y: ort.b,
        winkel: Math.atan2(bald.b - ort.b, Math.max(1, bald.a - ort.a)),
        blass: geg.lauf.fertig(ms) ? clamp(1 - (ms - geg.lauf.dauer) / 1200, 0, 1) : 1,
      };
    });
  }

  function zeichneGeister(geister) {
    weltTransform();
    geister.forEach((geist) => {
      if (geist.blass <= 0) return;
      vogel(geist.x, geist.y + R, geist.winkel, [geist.farbe, geist.farbe], 0.45 * geist.blass, false, state.flattern);
    });
    bildTransform();
    const gross = Math.round(clamp(view.cssH * 0.028, 10, 13));
    g.font = `800 ${gross}px system-ui, sans-serif`;
    g.textAlign = "center";
    g.textBaseline = "bottom";
    geister.forEach((geist) => {
      if (geist.blass <= 0) return;
      const sx = bildX(geist.x);
      const sy = bildY(geist.y + R * 2.4);
      const text = geist.art === "eigen" ? "Bestmarke" : geist.name;
      g.globalAlpha = geist.blass;
      g.lineWidth = 3;
      g.strokeStyle = "rgba(30, 40, 80, 0.6)";
      if (sx < 0 || sx > view.cssW) {
        // Ausserhalb des Bildes: ein Hinweis am Rand, wie weit er weg ist –
        // für Platz 1 und die Bestmarke, nicht für die vielen unter «Alle».
        if (geist.art === "alle") return;
        const rand = clamp(sx, 30, view.cssW - 30);
        const meter = Math.round((geist.x - state.v.x) / METER);
        const zeile = `${text} ${meter > 0 ? "+" : ""}${meter} m`;
        g.strokeText(zeile, rand, clamp(sy, 70, view.cssH - 10));
        g.fillStyle = geist.farbe;
        g.fillText(zeile, rand, clamp(sy, 70, view.cssH - 10));
      } else {
        g.strokeText(text, sx, sy);
        g.fillStyle = "#ffffff";
        g.fillText(text, sx, sy);
      }
    });
    g.globalAlpha = 1;
  }

  function zeichneVogel() {
    weltTransform();
    const v = state.v;
    const winkel = Math.atan2(v.vy, Math.max(1, v.vx));
    const farbe = ["#9fd8ff", "#3f8fe0"];
    const gleitet = !gedrueckt && !state.amBoden && state.flugZeit > 0.12;
    vogel(v.x, v.y + R, winkel, farbe, 1, gedrueckt, state.flattern, gleitet);
  }

  function zeichneTeile() {
    if (!state.teile.length) return;
    weltTransform();
    state.teile.forEach((t) => {
      const k = clamp(t.leben / t.max, 0, 1);
      g.globalAlpha = k;
      g.fillStyle = t.farbe;
      g.beginPath();
      if (t.art === "flamme") {
        // Ein Tropfen mit Spitze: hell und gross, wenn sie entsteht; dann
        // orange, rot und klein.
        g.globalAlpha = Math.min(1, k * 1.4);
        g.fillStyle = k > 0.7 ? "#fff3b8" : k > 0.4 ? "#ffa62b" : "#ff4d1f";
        const r = t.r * (0.4 + k * 0.6);
        const px = -t.dy * r;
        const py = t.dx * r;
        g.moveTo(t.x + px, t.y + py);
        g.quadraticCurveTo(t.x + px * 0.8 + t.dx * r * 1.3, t.y + py * 0.8 + t.dy * r * 1.3, t.x + t.dx * r * 2.4, t.y + t.dy * r * 2.4);
        g.quadraticCurveTo(t.x - px * 0.8 + t.dx * r * 1.3, t.y - py * 0.8 + t.dy * r * 1.3, t.x - px, t.y - py);
        g.quadraticCurveTo(t.x - t.dx * r * 1.5, t.y - t.dy * r * 1.5, t.x + px, t.y + py);
      } else if (t.art === "stern") {
        const r = t.r * (0.6 + k * 0.6);
        for (let i = 0; i < 10; i += 1) {
          const w = (i / 10) * Math.PI * 2 + t.dreh;
          const rr = i % 2 ? r * 0.45 : r;
          if (i) g.lineTo(t.x + Math.cos(w) * rr, t.y + Math.sin(w) * rr);
          else g.moveTo(t.x + Math.cos(w) * rr, t.y + Math.sin(w) * rr);
        }
        g.closePath();
      } else {
        g.arc(t.x, t.y, t.r * (1.6 - k * 0.6), 0, Math.PI * 2);
      }
      g.fill();
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
      g.globalAlpha = Math.min(1, k * 2);
      g.font = `900 ${Math.round(s.gross * clamp(view.s, 0.85, 1.5))}px system-ui, sans-serif`;
      g.lineWidth = 4;
      g.strokeStyle = "rgba(30, 40, 80, 0.6)";
      g.strokeText(s.text, bildX(s.x), bildY(s.y) - (1 - k) * 30);
      g.fillStyle = s.farbe;
      g.fillText(s.text, bildX(s.x), bildY(s.y) - (1 - k) * 30);
    });
    g.globalAlpha = 1;
  }

  function zeichneAnzeige() {
    if (state.phase === "bereit") return;
    bildTransform();
    const W = view.cssW;
    const H = view.cssH;
    const gross = clamp(view.cssH * 0.05, 14, 24);

    g.font = `900 ${Math.round(gross)}px system-ui, sans-serif`;
    g.textAlign = "left";
    g.textBaseline = "middle";
    const text = `${state.meter} m`;
    const w = g.measureText(text).width + gross * 1.1;
    g.fillStyle = "rgba(30, 40, 80, 0.45)";
    g.beginPath();
    if (g.roundRect) g.roundRect(12, 12, w, gross * 1.6, gross * 0.8);
    else g.rect(12, 12, w, gross * 1.6);
    g.fill();
    g.fillStyle = "#ffffff";
    g.fillText(text, 12 + gross * 0.55, 12 + gross * 0.82);

    // Darunter die Serie: drei Punkte, die sich mit jeder perfekten Landung
    // füllen – oder, wenn er brennt, was es bringt.
    const klein = Math.round(gross * 0.6);
    const y = 12 + gross * 1.6 + 6;
    const h = klein * 1.75;
    g.font = `800 ${klein}px system-ui, sans-serif`;
    if (state.feuer) {
      const titel = `On Fire ×${state.serie}`;
      const zusatz = "schneller · +14 % je Perfekt";
      const tw = g.measureText(titel).width;
      g.font = `700 ${Math.round(klein * 0.85)}px system-ui, sans-serif`;
      const zw = g.measureText(zusatz).width;
      const bw = h * 0.9 + tw + klein * 0.6 + zw + klein * 0.9;
      const verlauf = g.createLinearGradient(12, y, 12 + bw, y);
      verlauf.addColorStop(0, "#ff8a1f");
      verlauf.addColorStop(1, "#ffcf3d");
      g.fillStyle = verlauf;
      g.beginPath();
      if (g.roundRect) g.roundRect(12, y, bw, h, h / 2);
      else g.rect(12, y, bw, h);
      g.fill();
      // Eine kleine Flamme.
      const fx = 12 + h * 0.5;
      const fy = y + h * 0.55;
      const flacker = ruhig() ? 1 : 1 + 0.12 * Math.sin(state.zeit * 18);
      g.fillStyle = "#fff4c2";
      g.beginPath();
      g.moveTo(fx, fy - h * 0.36 * flacker);
      g.quadraticCurveTo(fx + h * 0.24, fy - h * 0.02, fx, fy + h * 0.26);
      g.quadraticCurveTo(fx - h * 0.24, fy - h * 0.02, fx, fy - h * 0.36 * flacker);
      g.fill();
      g.fillStyle = "#5a1e00";
      g.font = `900 ${klein}px system-ui, sans-serif`;
      g.fillText(titel, 12 + h * 0.9, y + h * 0.53);
      g.font = `700 ${Math.round(klein * 0.85)}px system-ui, sans-serif`;
      g.fillStyle = "rgba(90, 30, 0, 0.85)";
      g.fillText(zusatz, 12 + h * 0.9 + tw + klein * 0.6, y + h * 0.55);
    } else {
      const label = "On Fire";
      const lw = g.measureText(label).width;
      const bw = klein * 0.7 + 3 * klein * 1.05 + klein * 0.4 + lw + klein * 0.8;
      g.fillStyle = "rgba(30, 40, 80, 0.45)";
      g.beginPath();
      if (g.roundRect) g.roundRect(12, y, bw, h, h / 2);
      else g.rect(12, y, bw, h);
      g.fill();
      for (let i = 0; i < 3; i += 1) {
        const cx = 12 + klein * 0.7 + klein * 0.45 + i * klein * 1.05;
        const voll = i < state.serie;
        g.beginPath();
        g.arc(cx, y + h / 2, klein * 0.36, 0, Math.PI * 2);
        g.fillStyle = voll ? "#ffd84d" : "rgba(255, 255, 255, 0.25)";
        g.fill();
      }
      g.fillStyle = state.serie ? "#ffe9a0" : "rgba(255, 255, 255, 0.7)";
      g.fillText(label, 12 + klein * 0.7 + 3 * klein * 1.05 + klein * 0.4, y + h * 0.53);
    }

    // Die Einblendung, wenn das Feuer angeht oder ausgeht.
    const seitBeginn = state.zeit - state.feuerZeit;
    const seitEnde = state.zeit - state.vorbeiZeit;
    const banner = seitBeginn < 2.2
      ? { titel: "ON FIRE!", text: "Er fliegt schneller – und jede perfekte Landung gibt +14 %", farbe: "#ffd84d", t: seitBeginn, dauer: 2.2 }
      : seitEnde < 1.8
        ? { titel: "Feuer aus", text: "Harte Landung – drei perfekte, und er brennt wieder", farbe: "#ffe0e0", t: seitEnde, dauer: 1.8 }
        : null;
    if (banner) {
      const a = Math.min(1, banner.t * 5, (banner.dauer - banner.t) * 3);
      g.globalAlpha = clamp(a, 0, 1);
      const titelGross = Math.round(clamp(W * 0.09, 26, 48));
      const by = H * 0.3;
      g.textAlign = "center";
      g.font = `900 ${titelGross}px system-ui, sans-serif`;
      g.lineWidth = 5;
      g.strokeStyle = "rgba(90, 30, 0, 0.55)";
      g.strokeText(banner.titel, W / 2, by);
      g.fillStyle = banner.farbe;
      g.fillText(banner.titel, W / 2, by);
      g.font = `800 ${Math.round(clamp(W * 0.032, 12, 17))}px system-ui, sans-serif`;
      g.lineWidth = 4;
      g.strokeStyle = "rgba(20, 30, 60, 0.6)";
      g.strokeText(banner.text, W / 2, by + titelGross * 0.85, W - 24);
      g.fillStyle = "#ffffff";
      g.fillText(banner.text, W / 2, by + titelGross * 0.85, W - 24);
      g.globalAlpha = 1;
    }
  }


  function zeichnen() {
    if (!g) return;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, canvas.width, canvas.height);
    zeichneHimmel();
    zeichneHuegel();
    zeichneMarken();
    const geister = geisterOrte();
    zeichneGeister(geister);
    zeichneSpur();
    zeichneTeile();
    zeichneVogel();
    zeichneSchriften();
    zeichneAnzeige();
  }

  // ---------------------------------------------------------------------------
  // Teilchen und Schriften
  // ---------------------------------------------------------------------------
  function sterne(x, y, anzahl, farbe) {
    if (ruhig()) anzahl = Math.ceil(anzahl / 3);
    for (let i = 0; i < anzahl; i += 1) {
      const w = Math.random() * Math.PI;
      const v = 60 + Math.random() * 160;
      state.teile.push({
        art: "stern", x, y, vx: Math.cos(w) * v, vy: Math.sin(w) * v, r: 3 + Math.random() * 3,
        farbe, leben: 0.6 + Math.random() * 0.4, max: 1, dreh: Math.random() * 6,
      });
    }
  }

  function staub(x, y, anzahl) {
    if (ruhig()) anzahl = Math.ceil(anzahl / 3);
    for (let i = 0; i < anzahl; i += 1) {
      state.teile.push({
        art: "staub", x, y, vx: (Math.random() - 0.7) * 120, vy: Math.random() * 60, r: 2 + Math.random() * 2.5,
        farbe: "rgba(255,255,255,0.8)", leben: 0.4 + Math.random() * 0.3, max: 0.7,
      });
    }
  }

  // Die Feuerspur: kleine Flammen, die am Rücken entstehen, hinter ihm
  // zurückbleiben und verglühen – die jüngsten sitzen noch an ihm, als
  // brenne er. Wenige auf einmal (um die zwanzig): Sie sollen brennen, nicht
  // das Bild aufhalten.
  function flamme() {
    const v = state.v;
    const tempo = Math.max(1, Math.hypot(v.vx, v.vy));
    const rx = -v.vx / tempo;
    const ry = -v.vy / tempo;
    const quer = (Math.random() - 0.5) * R * 0.8;
    // Die Spitze zeigt nach hinten und etwas nach oben.
    const sx = rx * 0.8;
    const sy = ry * 0.8 + 0.6;
    const sl = Math.hypot(sx, sy) || 1;
    state.teile.push({
      art: "flamme",
      x: v.x + rx * R * 0.55 - ry * quer,
      y: v.y + R + ry * R * 0.55 + rx * quer + R * 0.3,
      vx: v.vx * 0.55 + (Math.random() - 0.5) * 30,
      vy: v.vy * 0.55 + 15 + Math.random() * 25,
      r: R * (0.6 + Math.random() * 0.3),
      dx: sx / sl,
      dy: sy / sl,
      leben: 0.24 + Math.random() * 0.1, max: 0.34,
    });
  }

  function schrift(text, x, y, farbe, gross) {
    state.schriften.push({ text, x, y, farbe, gross, leben: 1.1, max: 1.1 });
  }

  // ---------------------------------------------------------------------------
  // Der Flug
  // ---------------------------------------------------------------------------
  function physik(dt) {
    const v = state.v;
    const gEff = gedrueckt ? G_SCHWER : G_LEICHT;
    v.vy -= gEff * dt;
    // In der Luft, losgelassen: Er breitet die Flügel aus und gleitet. Die
    // Luft fängt das Sinken ab, ein Teil davon schiebt ihn nach vorn.
    if (!state.amBoden && !gedrueckt && v.vy < 0) {
      const ab = -v.vy * (1 - Math.exp(-GLEITEN * dt));
      v.vy += ab;
      v.vx += ab * AUFTRIEB;
    }
    if (state.feuer) {
      const tempo = Math.max(1, Math.hypot(v.vx, v.vy));
      v.vx += (v.vx / tempo) * FEUER_SCHUB * dt;
      v.vy += (v.vy / tempo) * FEUER_SCHUB * dt;
    }
    v.x += v.vx * dt;
    v.y += v.vy * dt;
    // Luftwiderstand: kaum spürbar, bei hohem Tempo mehr – im Feuer erst
    // später.
    const schnell = Math.hypot(v.vx, v.vy);
    const bremse = 1 - (0.012 + Math.max(0, schnell - (state.feuer ? 850 : 650)) * 0.0012) * dt;
    v.vx *= bremse;
    v.vy *= bremse;

    const boden = bodenBei(v.x);
    if (v.y <= boden) {
      const s = steigungBei(v.x);
      const len = Math.hypot(1, s);
      const tx = 1 / len;
      const ty = s / len;
      const nx = -s / len;
      const ny = 1 / len;
      const vn = v.vx * nx + v.vy * ny;
      const vt = v.vx * tx + v.vy * ty;
      if (!state.amBoden && state.flugZeit > 0.22) landung(vn, vt, s);
      if (vn < 0) {
        v.vx -= vn * nx;
        v.vy -= vn * ny;
      }
      v.y = boden;
      state.amBoden = true;
      state.flugZeit = 0;
      // Reibung am Boden, je schwerer, desto mehr: Wer bergauf schwer
      // bleibt, bremst sich aus.
      const t0 = v.vx * tx + v.vy * ty;
      if (t0 > 0) {
        const weniger = Math.min(t0, REIBUNG * gEff * ny * dt);
        v.vx -= weniger * tx;
        v.vy -= weniger * ty;
      }
      // Er flattert, wenn er zu langsam wird – stehen bleibt er nie.
      const jetzt = v.vx * tx + v.vy * ty;
      if (jetzt < V_MIN) {
        v.vx += (V_MIN - jetzt) * tx;
        v.vy += (V_MIN - jetzt) * ty;
      }
    } else if (v.y > boden + 1.5) {
      state.amBoden = false;
      state.flugZeit += dt;
    }
    const tempo = Math.hypot(v.vx, v.vy);
    const hoechstens = state.feuer ? V_MAX * FEUER_TEMPO : V_MAX;
    if (tempo > hoechstens) {
      v.vx *= hoechstens / tempo;
      v.vy *= hoechstens / tempo;
    }
    state.hoechste = Math.max(state.hoechste, v.y - boden);
  }

  // Wie er landet: Auf einem Abhang, im Winkel des Hangs, ist es perfekt.
  // In einen Gegenhang hinein kostet es Tempo.
  function landung(vn, vt, steigung) {
    const v = state.v;
    const winkel = Math.atan2(Math.abs(vn), Math.max(1, Math.abs(vt)));
    if (steigung < -0.05 && winkel < PERFEKT_WINKEL && vt > 0) {
      state.perfekt += 1;
      state.serie += 1;
      const schub = state.feuer ? 1.14 : 1.08;
      v.vx *= schub;
      v.vy *= schub;
      if (state.serie >= 3 && !state.feuer) {
        state.feuer = true;
        state.feuerZeit = state.zeit;
        kids()?.playJingle?.("win");
      } else if (state.feuer) {
        schrift(`Perfekt! +14 %`, v.x, v.y + 40, "#ffd84d", 16);
        kids()?.playJingle?.("star");
      } else {
        schrift(`Perfekt! ${state.serie}/3`, v.x, v.y + 40, "#ffffff", 16);
        kids()?.playJingle?.("star");
      }
      sterne(v.x, v.y, 8, state.feuer ? "#ffd84d" : "#ffffff");
    } else if (winkel > SCHLECHT_WINKEL) {
      if (state.feuer) {
        state.vorbeiZeit = state.zeit;
      } else if (state.serie > 0) {
        schrift("Harte Landung – Serie weg", v.x, v.y + 40, "#ffe0e0", 13);
      }
      state.serie = 0;
      state.feuer = false;
      v.vx *= 0.82;
      v.vy *= 0.82;
      staub(v.x, v.y, 10);
      kids()?.vibrate?.(16);
    } else {
      staub(v.x, v.y, 4);
    }
  }

  function zeitUm() {
    if (state.phase !== "spiel") return;
    state.phase = "aus";
    schrift("Die Sonne ist untergegangen", state.v.x + 60, state.v.y + 70, "#ffe2a8", 15);
    stepTimer = window.setTimeout(finish, 900);
  }

  function takt(dt) {
    state.zeit += dt;
    state.flattern += dt * (gedrueckt ? 4 : 22);
    if (state.phase === "spiel") {
      state.tag = clamp((performance.now() - rundeStart) / RUNDE_MS, 0, 1);
      const n = Math.max(1, Math.ceil(dt / TAKT));
      for (let i = 0; i < n; i += 1) physik(dt / n);
      const meter = Math.floor(meterBei(state.v.x));
      if (meter !== state.meter) {
        if (Math.floor(meter / 100) > Math.floor(state.meter / 100)) kids()?.playJingle?.("tap");
        state.meter = meter;
        state.punkte = meter;
        shell.setCount(meter);
      }
      // c: ob er brennt (1) und ob er gedrückt wird (2) – fürs Zuschauen.
      gegner?.takt(state.punkte, { a: Math.round(state.v.x - START_X), b: Math.round(state.v.y), c: (state.feuer ? 1 : 0) + (gedrueckt ? 2 : 0) });
    } else if (state.phase === "zuschauen") {
      zuschauenTakt(dt);
    } else if (state.phase === "aus") {
      // Er rutscht noch aus.
      const v = state.v;
      v.vx *= 1 - 2.5 * dt;
      v.x += v.vx * dt;
      v.y = Math.max(bodenBei(v.x), v.y + v.vy * dt);
      v.vy -= G_LEICHT * dt;
    } else if (state.phase === "bereit") {
      // Vor dem ersten Druck sitzt er oben am Starthang und wippt.
      state.v.y = bodenBei(state.v.x) + (ruhig() ? 0 : Math.abs(Math.sin(state.zeit * 3)) * 4);
    }

    state.spur.push({ x: state.v.x, y: state.v.y + R });
    if (state.spur.length > 26) state.spur.shift();

    if (state.feuer && (state.phase === "spiel" || state.phase === "zuschauen")) {
      const abstand = ruhig() ? 1 / 16 : 1 / 60;
      state.flammenTakt += dt;
      while (state.flammenTakt >= abstand) { state.flammenTakt -= abstand; flamme(); }
    } else {
      state.flammenTakt = 0;
    }

    for (let i = state.teile.length - 1; i >= 0; i -= 1) {
      const t = state.teile[i];
      // Flammen steigen auf und bleiben in der Luft zurück; alles andere fällt.
      if (t.art === "flamme") { t.vy += 160 * dt; t.vx *= 1 - 2.5 * dt; } else t.vy -= 200 * dt;
      t.x += t.vx * dt;
      t.y += t.vy * dt;
      t.dreh = (t.dreh || 0) + dt * 4;
      t.leben -= dt;
      if (t.leben <= 0) state.teile.splice(i, 1);
    }
    for (let i = state.schriften.length - 1; i >= 0; i -= 1) {
      state.schriften[i].leben -= dt;
      if (state.schriften[i].leben <= 0) state.schriften.splice(i, 1);
    }

    // Die Kamera: der Vogel bei einem knappen Drittel; steigt er hoch, zoomt
    // sie heraus, damit Vogel und Hügel im Bild bleiben.
    const v = state.v;
    huegelBis(v.x + view.w * 2.5);
    let tief = Infinity;
    for (let x = v.x - view.w * VOGEL_AN; x <= v.x + view.w * (1 - VOGEL_AN); x += 20) tief = Math.min(tief, bodenBei(x));
    const noetig = (v.y + 60) - (tief - 30);
    const zoomZiel = clamp(noetig / (view.h0 * 0.85), 1, 2.6);
    const k = state.zeit < 0.05 ? 1 : 1 - Math.exp(-dt * 2.2);
    state.zoom += (zoomZiel - state.zoom) * k;
    skaliere();
    state.camX = v.x - view.w * VOGEL_AN;
    const zielY = Math.min(tief - 30, v.y - view.h * 0.55);
    state.camY += (zielY - state.camY) * (state.zeit < 0.05 ? 1 : 1 - Math.exp(-dt * 4));
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
  // Halten und Loslassen
  // ---------------------------------------------------------------------------
  // ---------------------------------------------------------------------------
  // Zuschauen
  // ---------------------------------------------------------------------------
  // Ein aufgezeichneter Flug über seinen eigenen Hügeln: Der Zufall hält die
  // Saat (geist.js, zuschauer), startRun baut damit dieselben Hügel, und der
  // Vogel ist Bild für Bild dort, wo er damals war – schwer, wo er gedrückt
  // wurde, mit Feuer, wo er brannte.
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
    const v = state.v;
    v.x = START_X + s.a;
    v.y = s.b;
    v.vx = s.va;
    v.vy = s.vb;
    const c = s.c || 0;
    gedrueckt = Boolean(c & 2);
    const brennt = Boolean(c & 1);
    if (brennt && !state.feuer) state.feuerZeit = state.zeit;
    if (!brennt && state.feuer) state.vorbeiZeit = state.zeit;
    state.feuer = brennt;
    state.serie = brennt ? Math.max(3, state.serie) : 0;
    state.amBoden = v.y - bodenBei(v.x) < 1.5;
    state.flugZeit = state.amBoden ? 0 : state.flugZeit + dt;
    state.tag = clamp(s.t / RUNDE_MS, 0, 1);
    const meter = Math.max(0, Math.floor(s.punkte));
    if (meter !== state.meter) {
      state.meter = meter;
      state.punkte = meter;
      shell.setCount(meter);
    }
    zuschauer.weiter();
  }

  function druecken() {
    if (state.phase === "zuschauen") return;
    gedrueckt = true;
    if (state.phase !== "bereit") return;
    state.phase = "spiel";
    state.v.vx = 160;
    rundeStart = performance.now();
    shell.setPhase("play");
    shell.startClock(RUNDE_MS, zeitUm);
    gegner?.los();
    kids()?.vibrate?.(8);
  }

  function loslassen() {
    if (state.phase === "zuschauen") return;
    gedrueckt = false;
  }

  // ---------------------------------------------------------------------------
  // Ablauf
  // ---------------------------------------------------------------------------
  function startRun() {
    clearStep();
    stopLoop();
    shell.stopClock();
    shell.closeOverlay();
    zufall.neu();
    shell.setPhase("intro");
    state.phase = "bereit";
    state.punkte = 0;
    state.meter = 0;
    state.perfekt = 0;
    state.serie = 0;
    state.feuer = false;
    state.feuerZeit = -9;
    state.vorbeiZeit = -9;
    state.flammenTakt = 0;
    state.huegel = [];
    huegelBis(4000);
    state.v = { x: START_X - 110, y: 0, vx: 0, vy: 0 };
    state.v.y = bodenBei(state.v.x);
    state.amBoden = true;
    state.flugZeit = 0;
    state.hoechste = 0;
    state.spur = [];
    state.teile = [];
    state.schriften = [];
    state.zoom = 1;
    state.zeit = 0;
    state.tag = 0;
    gedrueckt = false;
    shell.setCount(0);
    gegner?.runde();

    shell.clear();
    const prompt = shell.el("p", "cm-prompt hf-prompt", "Halten – schwer. Loslassen – fliegen.");
    shell.play.append(prompt, buildPlatz());
    view.cssW = 0;
    view.cssH = 0;
    messen();
    takt(0);

    last = performance.now();
    frame = window.requestAnimationFrame(loop);
  }

  function zaehleHoch(ziel) {
    const zahl = host.querySelector(".cm-result-score");
    if (!zahl) return;
    if (ruhig() || ziel <= 1) { zahl.textContent = String(ziel); return; }
    const dauer = Math.min(900, 200 + ziel);
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
    shell.stopClock();
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
    const perfekt = state.perfekt === 1 ? "1 perfekte Landung" : `${state.perfekt} perfekte Landungen`;
    shell.showResult({
      label: "Deine Meter",
      points: punkte,
      detail: rekord ? "Neuer Rekord!" : `${perfekt}${vorher ? ` · Bestwert ${vorher} m` : ""}`,
      speech: `${punkte} Meter.${rekord ? " Das ist dein neuer Rekord!" : vorher ? ` Dein Bestwert sind ${vorher} Meter.` : ""}`,
      geist,
    });
    if (rekord) host.querySelector(".cm-result-detail")?.classList.add("hf-rekord");
    zaehleHoch(punkte);
  }

  // ---------------------------------------------------------------------------
  // Start
  // ---------------------------------------------------------------------------
  shell = shellApi.mount({
    host,
    title: "Hügelflieger",
    area: "geschwindigkeit",
    accent: "#F5A623",
    accentDark: "#b9741a",
    help: HELP,
    clock: true,
    onRestart: () => (zuschauer ? zuschauenStarten() : startRun()),
  });
  zuschauer = window.LernappGeist?.zuschauer?.({
    host, spiel: "hillGlide", fassung: "t1", zufall, einheit: "m", nochmal: zuschauenStarten,
  }) || null;
  if (!zuschauer) {
    gegner = window.LernappGeist?.fuer?.({ spiel: "hillGlide", host, art: "tempo", alle: true, zufall }) || null;
  }

  startRun();
  zuschauer?.laden.then((da) => { if (da) zuschauenStarten(); });

  host.addEventListener("pointerdown", (event) => {
    if (event.target.closest("button, a, input")) return;
    druecken();
  });
  window.addEventListener("pointerup", loslassen);
  window.addEventListener("pointercancel", loslassen);
  window.addEventListener("blur", loslassen);

  const TASTEN = new Set([" ", "Enter", "ArrowDown"]);
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

  // Für die Prüfskripte. "zeit" stellt die Uhr der Runde, ohne zu warten.
  window.LernappHuegel = {
    RUNDE_MS, METER, state, view, takt, druecken, loslassen, bodenBei, steigungBei,
    spuleVor(ms) { rundeStart -= ms; },
    zeitUm,
    get gedrueckt() { return gedrueckt; },
  };
})();
