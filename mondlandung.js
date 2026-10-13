/*
 * mondlandung.js – Mondlandung.
 * ---------------------------------------------------------------------------
 * Eine Mondfähre hüpft von Plattform zu Plattform über den Mond. Wer den
 * Finger aufs Bild legt, zündet das Triebwerk – und die Fähre neigt sich zu
 * ihm hin: Finger rechts über der Fähre, und sie zieht nach rechts oben;
 * Finger genau darüber, und sie steigt senkrecht. Wer loslässt, fällt; der
 * Mond zieht sanft.
 *
 * Gelandet ist, wer mit beiden Füssen auf der nächsten Plattform steht,
 * langsam genug und fast gerade. Über der nächsten Plattform steht ein
 * Leitstrahl: Wer darin sinkt, dem hilft die Fähre – sie richtet sich auf
 * und hält über der Plattform still, übrig bleibt, sanft genug aufzusetzen.
 * Zu schnell, daneben oder gegen einen Berg – und es kracht.
 *
 * Es geht um den Treibstoff. Jede Landung bringt Punkte, und umso mehr, je
 * weniger der Flug dorthin verbraucht hat: Der Balken oben zeigt den Tank,
 * und ein Strich darauf, wie weit er für diesen Flug höchstens sinken
 * sollte. Wer darüber bleibt, fliegt sparsam. Auf der Plattform wird
 * nachgetankt, aber nie ganz – und von Plattform zu Plattform weniger. Fünf,
 * sechs Plattformen schafft jeder; wer weiter will, muss sparsam fliegen.
 *
 * Die Plattformen werden schmaler, liegen weiter auseinander und hinter
 * höheren Bergen. Gezählt werden die Punkte.
 *
 * Gebaut wird der Mond aus dem Zufall (zufall.js): ohne Turnier jedes Mal
 * ein anderer, im Turnier für alle im selben Versuch derselbe. Er ist immer
 * schaffbar: Jede Plattform ist breiter als die Fähre, kein Berg höher, als
 * der Tank auf dem Weg dorthin hergibt.
 *
 * Die Gegner (geist.js) stehen als Zahl oben über der Bühne.
 *
 * Gerechnet wird in Welteinheiten, y zählt nach oben. Die Neigung zählt im
 * Uhrzeigersinn: positiv heisst nach rechts gekippt.
 */
(() => {
  "use strict";

  if (document.body.dataset.page !== "moon") return;

  const host = document.querySelector("#ml-stage");
  const shellApi = window.LernappGameShell;
  const cloudApi = window.LernappGameCloud;
  if (!host || !shellApi) return;

  const kids = () => window.LernappKids || null;
  const ruhig = () => Boolean(kids()?.prefersReducedMotion?.());

  const zufall = window.LernappZufall?.fuer?.("moonLander") || {
    neu() {},
    zahl: () => Math.random(),
  };

  // ---------------------------------------------------------------------------
  // Die Welt
  // ---------------------------------------------------------------------------
  const MIN_W = 270;
  const MIN_H = 400;
  const SEG = 14;                  // Abstand der Stützpunkte des Bodens
  const TAKT = 1 / 240;

  const G = 44;                    // der Mond zieht
  const SCHUB = 118;               // das Triebwerk schiebt, gut zweieinhalb Mal so stark
  const NEIG_MAX = 0.7;            // so weit neigt sich die Fähre höchstens
  const NEIG_TEMPO = 3.2;          // so schnell dreht sie sich dorthin
  const TANK = 100;
  const VERBRAUCH = 8;             // je Sekunde Schub
  const PUNKTE_PLATTE = 100;       // für jede erreichte Plattform …
  const PUNKTE_SPAREN = 200;       // … und höchstens so viel dazu für einen sparsamen Flug

  // Was als Landung gilt.
  const LANDE_VY = 55;
  const LANDE_VX = 40;
  const LANDE_NEIG = 0.45;
  // Der Leitstrahl über der nächsten Plattform: so hoch reicht er, und so
  // weit seitlich daneben fängt er die Fähre noch ein.
  const STRAHL_HOCH = 170;
  const STRAHL_RAND = 22;

  // Die Fähre, wie sie trifft: die Füsse, und Punkte auf dem Rumpf.
  const FUSS = [{ x: -11.5, y: -13 }, { x: 11.5, y: -13 }];
  const RUMPF = [
    { x: -9, y: -5 }, { x: 9, y: -5 }, { x: -10, y: 3 }, { x: 10, y: 3 },
    { x: -6, y: 11 }, { x: 6, y: 11 }, { x: 0, y: 15 },
  ];

  const HELP = [
    "Mondlandung. Halte den Finger auf dem Bild, dann zündet das Triebwerk, und die Fähre neigt sich zu deinem Finger hin.",
    "Finger über der Fähre: Sie steigt. Finger rechts oder links: Sie zieht dorthin. Lass los, dann fällt sie.",
    "Über der nächsten Plattform leuchtet ein Leitstrahl. Sinkst du darin, richtet sich die Fähre von selbst auf und hält über der Plattform still.",
    "Du musst nur noch sanft aufsetzen – wenn die Lichter an den Füssen grün sind, bist du langsam genug.",
    "Jede Plattform gibt 100 Punkte, und bis zu 200 dazu, je weniger Treibstoff dein Flug braucht. Der Strich auf dem Tankbalken zeigt, wie weit er für einen sparsamen Flug höchstens sinken sollte.",
    "Auf der Plattform wird nachgetankt, aber nie ganz – und immer weniger. Wer weit kommen will, muss sparsam fliegen.",
  ].join(" ");

  const TOP_COUNT = 5;
  const store = cloudApi
    ? cloudApi.register({ key: "lernapp.mondlandung", empty: { runs: 0, scores: [] }, merge: cloudApi.mergeScores(TOP_COUNT) })
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
  const schwereBei = (n) => 1 - Math.exp(-n / 12);

  // Der Bonus für einen Flug, gemessen an dem, was er braucht (platte.bedarf):
  // voll, wer nicht mehr als 85 Prozent davon verbraucht – bis zum Strich
  // auf dem Balken –, nichts mehr ab dem Siebenviertelfachen.
  const SPARSAM = 0.85;
  const sparBonus = (verbraucht, bedarf) =>
    Math.round(PUNKTE_SPAREN * clamp((1.75 - verbraucht / Math.max(1, bedarf)) / (1.75 - SPARSAM), 0, 1));

  // Wie viel auf einer Plattform nachgetankt wird: am Anfang reichlich für
  // den nächsten Flug, nach fünf, sechs Plattformen weniger, als ein
  // ordentlicher Flug braucht. Wer dann weiter will, lebt von dem, was er
  // vorher gespart hat – und fliegt sparsam.
  const tankFaktor = (n) => lerp(1.5, 0.85, 1 - Math.exp(-n / 4.5));
  // Und voll wird er dabei nie: höchstens so weit.
  const TANK_NACH = TANK * 0.9;

  function hash01(n) {
    const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return x - Math.floor(x);
  }

  // ---------------------------------------------------------------------------
  // Zustand
  // ---------------------------------------------------------------------------
  // phase:   "bereit", "spiel", "ende"
  // schritt: "start", "flug", "gelandet", "crash"
  const state = {
    phase: "bereit",
    schritt: "start",
    punkte: 0,
    sparsam: 0,           // Flüge mit vollem Bonus
    landungen: 0,
    f: { x: 0, y: 0, vx: 0, vy: 0, neig: 0 },
    tank: TANK,
    tankAb: TANK,         // so voll war der Tank, als der Flug zur nächsten Plattform begann
    anzeige: TANK,        // was der Balken zeigt: folgt dem Tank, beim Tanken sichtbar
    getankt: null,        // { menge, zeit } – die letzte Füllung, für den Balken
    schub: false,
    neigZiel: 0,
    auf: 0,               // auf welcher Plattform sie steht (oder zuletzt stand)
    boden: [],            // Stützpunkte { x, y }
    platten: [],          // { n, x0, x1, y }
    kopf: 0,              // bis wohin der Boden gebaut ist
    teile: [],
    schriften: [],
    camX: 0,
    camY: 0,
    stoss: 0,
    zeit: 0,
    schrittZeit: 0,
    flamme: 0,
    strahl: false,        // hilft der Leitstrahl gerade?
  };

  let shell = null;
  let feld = null;
  let canvas = null;
  let g = null;
  let frame = null;
  let last = 0;
  let stepTimer = null;
  let gegner = null;
  // Wo der Finger ist (im Bild), solange er liegt.
  const finger = { an: false, x: 0, y: 0, id: null };
  const tasten = { links: false, rechts: false, schub: false };
  // Für die Prüfskripte: eine Neigung, so fein wie ein Finger.
  const pruef = { neig: null };

  const view = { s: 1, grund: 1, zoom: 1, dpr: 1, cssW: 0, cssH: 0, w: MIN_W, h: MIN_H };

  function clearStep() {
    if (stepTimer) { window.clearTimeout(stepTimer); stepTimer = null; }
  }

  function stopLoop() {
    if (frame) { window.cancelAnimationFrame(frame); frame = null; }
  }

  // ---------------------------------------------------------------------------
  // Der Mond
  // ---------------------------------------------------------------------------
  /*
   * Der Boden ist eine Kette von Stützpunkten im Abstand SEG, dazwischen
   * gerade. Er besteht aus Plattformen und dem Gelände dazwischen. Jede
   * neue Plattform liegt weiter weg und ist schmaler; das Gelände davor hat
   * Hügel, Krater und manchmal einen Berg, der höher ist als beide
   * Plattformen – über den muss man hinüber.
   */
  function bodenBis(x) {
    while (state.kopf < x) naechstePlatte();
  }

  function punkt(x, y) {
    state.boden.push({ x, y });
    state.kopf = x;
  }

  function naechstePlatte() {
    const platten = state.platten;
    const n = platten.length;
    if (!n) {
      // Vor der ersten Plattform ein Stück Gelände, damit links nicht das
      // Nichts beginnt.
      for (let x = -600; x < -60; x += SEG) punkt(x, 40 + Math.sin(x * 0.02) * 18 + hash01(x) * 8);
      platten.push({ n: 0, x0: -60, x1: 60, y: 60 });
      punkt(-60, 60);
      punkt(60, 60);
      return;
    }
    const k = schwereBei(n);
    const vor = platten[n - 1];
    const breite = lerp(130, 58, k) * (0.85 + zufall.zahl() * 0.3);
    const weg = lerp(170, 470, k) * (0.8 + zufall.zahl() * 0.4);
    const y = clamp(vor.y + lerp(-80, 110, zufall.zahl()) * lerp(0.5, 1.1, k), 20, 560);
    const x0 = vor.x1 + weg;
    const x1 = x0 + breite;

    // Das Gelände dazwischen: unter beiden Plattformen bleibt es meist, ab
    // und zu ragt ein Berg darüber hinaus.
    const unten = Math.min(vor.y, y) - lerp(40, 90, zufall.zahl());
    // Die ersten Sprünge gehen ohne Berg; danach immer öfter einer, immer höher.
    const berg = zufall.zahl() < (n < 3 ? 0 : lerp(0.15, 0.65, k));
    const bergHoch = Math.max(vor.y, y) + lerp(20, 200, k) * (0.5 + zufall.zahl() * 0.5);
    const bergMitte = lerp(0.3, 0.7, zufall.zahl());
    const wellen = 1 + Math.floor(zufall.zahl() * 3);
    const phase = zufall.zahl() * Math.PI * 2;
    const x = state.kopf;
    const L = x0 - x;
    let hoechster = Math.max(vor.y, y);
    for (let px = x + SEG; px < x0 - SEG; px += SEG) {
      const u = (px - x) / L;
      // Am Rand der Plattformen fällt es ab, in der Mitte wellt es sich.
      const rand = Math.min(1, u * 6, (1 - u) * 6);
      let h = lerp(vor.y - 6, y - 6, u) * (1 - rand) + (unten + Math.sin(u * Math.PI * wellen + phase) * 30) * rand;
      if (berg) {
        const d = (u - bergMitte) / 0.16;
        h = Math.max(h, bergHoch - d * d * (bergHoch - unten) * 0.5);
      }
      h += (hash01(px * 0.37 + n) - 0.5) * 10;
      hoechster = Math.max(hoechster, h);
      punkt(px, h);
    }
    // Was der Weg hierher an Treibstoff kostet, wenn man ordentlich fliegt:
    // die Strecke, der Aufstieg über den höchsten Punkt, Abheben und Landen.
    // So viel (und etwas mehr) gibt es bei der Landung davor.
    const steigen = Math.max(0, hoechster + 40 - vor.y);
    const bedarf = VERBRAUCH * ((weg / 85) * 0.45 + (steigen / 35) * 0.6 + 1.3);
    platten.push({ n, x0, x1, y, bedarf });
    punkt(x0, y);
    punkt(x1, y);
  }

  // Die Höhe des Bodens an einer Stelle.
  function bodenBei(x) {
    bodenBis(x + SEG * 2);
    const b = state.boden;
    let lo = 0;
    let hi = b.length - 1;
    while (lo < hi - 1) {
      const mid = (lo + hi) >> 1;
      if (b[mid].x <= x) lo = mid;
      else hi = mid;
    }
    const a = b[lo];
    const c = b[hi];
    if (c.x === a.x) return Math.max(a.y, c.y);
    return lerp(a.y, c.y, clamp((x - a.x) / (c.x - a.x), 0, 1));
  }

  function platteBei(x) {
    return state.platten.find((p) => x >= p.x0 - 0.5 && x <= p.x1 + 0.5) || null;
  }

  // Wo ein Punkt der Fähre in der Welt liegt.
  function welt(p) {
    const f = state.f;
    const c = Math.cos(f.neig);
    const s = Math.sin(f.neig);
    // Neigung im Uhrzeigersinn: x' = x cos + y sin, y' = -x sin + y cos.
    return { x: f.x + p.x * c + p.y * s, y: f.y - p.x * s + p.y * c };
  }

  // ---------------------------------------------------------------------------
  // Die Fläche
  // ---------------------------------------------------------------------------
  function buildPlatz() {
    const platz = shell.el("div", "ml-platz");
    feld = shell.el("div", "ml-feld");
    canvas = document.createElement("canvas");
    canvas.className = "ml-canvas";
    canvas.setAttribute("aria-hidden", "true");
    feld.append(canvas);
    g = canvas.getContext("2d");

    const tipp = shell.el("span", "ml-tipp");
    tipp.setAttribute("aria-hidden", "true");
    const ns = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(ns, "svg");
    svg.setAttribute("viewBox", "0 0 64 64");
    [
      { r: 22, stroke: "rgba(255,255,255,0.45)", w: 5 },
      { r: 22, stroke: "#ffffff", w: 5, klasse: "ml-tipp-fuell" },
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
    const punktSvg = document.createElementNS(ns, "circle");
    punktSvg.setAttribute("cx", "32");
    punktSvg.setAttribute("cy", "32");
    punktSvg.setAttribute("r", "9");
    punktSvg.setAttribute("fill", "#ffffff");
    svg.append(punktSvg);
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
    if (cssW === view.cssW && cssH === view.cssH && dpr === view.dpr) return;
    view.cssW = cssW;
    view.cssH = cssH;
    view.dpr = dpr;
    view.grund = Math.min(cssW / MIN_W, cssH / MIN_H);
    skaliere();
    const pw = Math.round(cssW * dpr);
    const ph = Math.round(cssH * dpr);
    if (canvas.width !== pw) canvas.width = pw;
    if (canvas.height !== ph) canvas.height = ph;
  }

  function skaliere() {
    view.s = view.grund * view.zoom;
    view.w = view.cssW / view.s;
    view.h = view.cssH / view.s;
  }

  const wackel = () => (ruhig() ? 0 : Math.sin(state.zeit * 70) * 5 * state.stoss);

  function bildTransform() {
    g.setTransform(view.dpr, 0, 0, view.dpr, 0, wackel() * view.dpr);
  }

  function weltTransform() {
    const f = view.s * view.dpr;
    g.setTransform(f, 0, 0, -f, (view.cssW / 2 - state.camX * view.s) * view.dpr, (view.cssH / 2 + state.camY * view.s + wackel()) * view.dpr);
  }

  const bildX = (x) => view.cssW / 2 + (x - state.camX) * view.s;
  const bildY = (y) => view.cssH / 2 - (y - state.camY) * view.s;

  // ---------------------------------------------------------------------------
  // Zeichnen
  // ---------------------------------------------------------------------------
  const STERNE = Array.from({ length: 140 }, (_, i) => ({
    x: hash01(i * 3.1 + 1), y: hash01(i * 5.7 + 2), r: 0.4 + hash01(i * 7.3 + 3) * 1.2, funkel: hash01(i * 2.2) * 6.3,
  }));

  // Der Himmel: schwarz mit Sternen, darin die Erde – weit weg, sie zieht
  // kaum mit.
  function zeichneHimmel() {
    bildTransform();
    const W = view.cssW;
    const H = view.cssH;
    const verlauf = g.createLinearGradient(0, 0, 0, H);
    verlauf.addColorStop(0, "#020309");
    verlauf.addColorStop(1, "#0b0f22");
    g.fillStyle = verlauf;
    g.fillRect(0, -10, W, H + 20);
    STERNE.forEach((s) => {
      const x = ((s.x * (W + 20) - state.camX * view.s * 0.03) % (W + 20) + W + 20) % (W + 20) - 10;
      const y = ((s.y * (H + 20) + state.camY * view.s * 0.03) % (H + 20) + H + 20) % (H + 20) - 10;
      g.globalAlpha = 0.45 + 0.4 * (ruhig() ? 1 : 0.5 + 0.5 * Math.sin(state.zeit * 2 + s.funkel));
      g.fillStyle = "#ffffff";
      g.beginPath();
      g.arc(x, y, s.r, 0, Math.PI * 2);
      g.fill();
    });
    g.globalAlpha = 1;

    // Die Erde: Ozean, Kontinente, Wolken, ein Schatten und ein blauer Hof.
    const r = Math.min(W, H) * 0.12;
    const ex = W * 0.78 - state.camX * view.s * 0.015;
    const ey = H * 0.22 + state.camY * view.s * 0.01;
    const hof = g.createRadialGradient(ex, ey, r * 0.9, ex, ey, r * 1.6);
    hof.addColorStop(0, "rgba(120, 190, 255, 0.35)");
    hof.addColorStop(1, "rgba(120, 190, 255, 0)");
    g.fillStyle = hof;
    g.beginPath();
    g.arc(ex, ey, r * 1.6, 0, Math.PI * 2);
    g.fill();
    const meer = g.createRadialGradient(ex - r * 0.4, ey - r * 0.4, r * 0.1, ex, ey, r);
    meer.addColorStop(0, "#7fd0ff");
    meer.addColorStop(0.6, "#2a7fd0");
    meer.addColorStop(1, "#0d2f6e");
    g.fillStyle = meer;
    g.beginPath();
    g.arc(ex, ey, r, 0, Math.PI * 2);
    g.fill();
    g.save();
    g.beginPath();
    g.arc(ex, ey, r, 0, Math.PI * 2);
    g.clip();
    g.fillStyle = "#4caf50";
    [[-0.35, -0.2, 0.32, 0.22], [0.25, 0.15, 0.28, 0.35], [-0.1, 0.45, 0.22, 0.14], [0.45, -0.35, 0.18, 0.12]].forEach(([dx, dy, rx, ry]) => {
      g.beginPath();
      g.ellipse(ex + dx * r, ey + dy * r, rx * r, ry * r, 0.4, 0, Math.PI * 2);
      g.fill();
    });
    g.fillStyle = "rgba(255,255,255,0.75)";
    const wolkenZug = state.zeit * 0.02;
    [[-0.5, -0.5, 0.4], [0.1, -0.05, 0.5], [-0.3, 0.3, 0.35], [0.4, 0.55, 0.3]].forEach(([dx, dy, rx], i) => {
      g.beginPath();
      g.ellipse(ex + (((dx + wolkenZug + i * 0.1) % 2 + 2) % 2 - 1) * r, ey + dy * r, rx * r, r * 0.07, 0, 0, Math.PI * 2);
      g.fill();
    });
    const nacht = g.createLinearGradient(ex - r * 0.2, ey - r * 0.2, ex + r, ey + r);
    nacht.addColorStop(0, "rgba(0,0,0,0)");
    nacht.addColorStop(1, "rgba(2, 4, 16, 0.85)");
    g.fillStyle = nacht;
    g.fillRect(ex - r, ey - r, r * 2, r * 2);
    g.restore();
  }

  // Berge weit hinten, in zwei Lagen, die langsamer vorbeiziehen.
  function zeichneHintergrund() {
    bildTransform();
    const W = view.cssW;
    const H = view.cssH;
    [[0.25, "#1a1d2c", 0.62, 90], [0.5, "#24283a", 0.7, 60]].forEach(([tempo, farbe, hoehe, zacke], lage) => {
      g.fillStyle = farbe;
      g.beginPath();
      g.moveTo(0, H);
      const basis = H * hoehe + state.camY * view.s * tempo * 0.4;
      for (let sx = 0; sx <= W + 20; sx += 20) {
        const wx = (sx + state.camX * view.s * tempo) / 60;
        const y = basis - (Math.sin(wx * 0.9 + lage) * 0.5 + Math.sin(wx * 2.3 + lage * 3) * 0.3 + hash01(Math.floor(wx) + lage * 99) * 0.2) * zacke;
        g.lineTo(sx, y);
      }
      g.lineTo(W, H);
      g.closePath();
      g.fill();
    });
  }

  function zeichneBoden() {
    const x0 = state.camX - view.w / 2 - SEG * 2;
    const x1 = state.camX + view.w / 2 + SEG * 2;
    bodenBis(x1);
    const b = state.boden;
    const sichtbar = b.filter((p) => p.x >= x0 && p.x <= x1);
    if (sichtbar.length < 2) return;
    const tief = state.camY - view.h / 2 - 40;
    weltTransform();
    const fels = g.createLinearGradient(0, state.camY + view.h / 2, 0, tief);
    fels.addColorStop(0, "#c9cbd2");
    fels.addColorStop(0.5, "#8e919c");
    fels.addColorStop(1, "#4a4d5a");
    g.fillStyle = fels;
    g.beginPath();
    g.moveTo(sichtbar[0].x, tief);
    sichtbar.forEach((p) => g.lineTo(p.x, p.y));
    g.lineTo(sichtbar[sichtbar.length - 1].x, tief);
    g.closePath();
    g.fill();

    // Krater und Steine, fest an ihrem Ort.
    g.save();
    g.clip();
    for (let i = Math.floor(x0 / 46); i <= Math.ceil(x1 / 46); i += 1) {
      const h = hash01(i * 4.37 + 0.9);
      if (h > 0.55) continue;
      const kx = i * 46 + hash01(i * 2.1) * 30;
      const ky = bodenBei(kx) - 8 - hash01(i * 7.7) * 90;
      const kr = 4 + hash01(i * 5.5) * 13;
      g.fillStyle = "rgba(60, 62, 76, 0.45)";
      g.beginPath();
      g.ellipse(kx, ky, kr, kr * 0.42, 0, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = "rgba(230, 232, 240, 0.35)";
      g.beginPath();
      g.ellipse(kx, ky - kr * 0.12, kr * 0.8, kr * 0.28, 0, Math.PI, Math.PI * 2);
      g.fill();
    }
    g.restore();

    // Die Kante: hell, wo die Sonne von links oben trifft.
    g.strokeStyle = "rgba(255,255,255,0.55)";
    g.lineWidth = 1.6 / view.s;
    g.beginPath();
    sichtbar.forEach((p, i) => (i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y)));
    g.stroke();
  }

  // Eine Plattform: Stahl, gelb-schwarze Kanten, blinkende Lichter. Die
  // nächste bekommt dazu einen Lichtstrahl, die erreichten leuchten grün.
  function zeichnePlatten() {
    weltTransform();
    state.platten.forEach((p) => {
      if (p.x1 < state.camX - view.w / 2 - 40 || p.x0 > state.camX + view.w / 2 + 40) return;
      const naechste = p.n === state.auf + 1;
      const erreicht = p.n <= state.auf;
      if (naechste) {
        // Der Leitstrahl: golden, und grün und heller, solange er hilft.
        const farbe = state.strahl ? "120, 255, 170" : "255, 220, 120";
        const hell = state.strahl ? 0.42 : 0.26;
        const oben = p.y + STRAHL_HOCH + 13;
        const strahl = g.createLinearGradient(0, p.y, 0, oben);
        strahl.addColorStop(0, `rgba(${farbe}, ${hell})`);
        strahl.addColorStop(0.75, `rgba(${farbe}, ${hell * 0.4})`);
        strahl.addColorStop(1, `rgba(${farbe}, 0)`);
        g.fillStyle = strahl;
        g.beginPath();
        g.moveTo(p.x0 + 4, p.y);
        g.lineTo(p.x0 - STRAHL_RAND, oben);
        g.lineTo(p.x1 + STRAHL_RAND, oben);
        g.lineTo(p.x1 - 4, p.y);
        g.closePath();
        g.fill();
        // Feine Ringe, die im Strahl nach oben wandern.
        if (!ruhig()) {
          g.strokeStyle = `rgba(${farbe}, ${hell * 0.9})`;
          g.lineWidth = 1.4 / view.s;
          for (let i = 0; i < 3; i += 1) {
            const u = (state.zeit * 0.45 + i / 3) % 1;
            const y = p.y + 6 + u * STRAHL_HOCH;
            const halb = (p.x1 - p.x0) / 2 + u * (STRAHL_RAND - 4);
            const mx = (p.x0 + p.x1) / 2;
            g.globalAlpha = 1 - u;
            g.beginPath();
            g.moveTo(mx - halb, y);
            g.lineTo(mx + halb, y);
            g.stroke();
          }
          g.globalAlpha = 1;
        }
      }
      // Stützen
      g.fillStyle = "#5c6070";
      g.fillRect(p.x0 + 4, p.y - 18, 4, 18);
      g.fillRect(p.x1 - 8, p.y - 18, 4, 18);
      // Platte
      g.fillStyle = "#d8dbe4";
      g.fillRect(p.x0, p.y - 5, p.x1 - p.x0, 5);
      g.fillStyle = "#9aa0b0";
      g.fillRect(p.x0, p.y - 7, p.x1 - p.x0, 2);
      // Gelb-schwarze Kanten
      for (let x = p.x0; x < p.x1; x += 6) {
        const kante = x < p.x0 + 14 || x > p.x1 - 20;
        if (!kante) continue;
        g.fillStyle = Math.floor((x - p.x0) / 6) % 2 ? "#1c1d22" : "#ffc82e";
        g.fillRect(x, p.y - 5, Math.min(6, p.x1 - x), 5);
      }
      // Lichter
      const an = ruhig() || Math.sin(state.zeit * 6 + p.n) > -0.2;
      const farbe = erreicht ? "#4cff8a" : naechste ? "#ffd166" : "#ff6b6b";
      [p.x0 + 2, p.x1 - 2].forEach((lx) => {
        g.fillStyle = an ? farbe : "rgba(255,255,255,0.2)";
        g.beginPath();
        g.arc(lx, p.y + 2, 2.2, 0, Math.PI * 2);
        g.fill();
        if (an) {
          g.fillStyle = `${farbe}44`;
          g.beginPath();
          g.arc(lx, p.y + 2, 6, 0, Math.PI * 2);
          g.fill();
        }
      });
    });
  }

  // Ist sie gerade langsam und gerade genug für eine Landung?
  function sanft() {
    const f = state.f;
    return -f.vy < LANDE_VY && Math.abs(f.vx) < LANDE_VX && Math.abs(f.neig) < LANDE_NEIG;
  }

  // Die Fähre: goldene Folie, silberne Kabine mit Fenster, vier Beine,
  // darunter die Düse – und die Flamme, wenn das Triebwerk läuft.
  function zeichneFaehre() {
    if (state.schritt === "crash" && state.zeit - state.schrittZeit > 0.15) return;
    const f = state.f;
    weltTransform();
    g.save();
    g.translate(f.x, f.y);
    g.rotate(-f.neig);

    // Flamme
    if (state.schub && state.tank > 0 && state.schritt === "flug") {
      const lang = 12 + state.flamme * 10;
      const flamme = g.createLinearGradient(0, -8, 0, -8 - lang);
      flamme.addColorStop(0, "rgba(255, 255, 230, 0.95)");
      flamme.addColorStop(0.35, "rgba(255, 190, 80, 0.85)");
      flamme.addColorStop(1, "rgba(255, 90, 40, 0)");
      g.fillStyle = flamme;
      g.beginPath();
      g.moveTo(-4.5, -8);
      g.quadraticCurveTo(-3, -8 - lang * 0.6, 0, -8 - lang);
      g.quadraticCurveTo(3, -8 - lang * 0.6, 4.5, -8);
      g.closePath();
      g.fill();
    }
    // Beine
    g.strokeStyle = "#b9bdc9";
    g.lineWidth = 1.6;
    g.beginPath();
    g.moveTo(-6, -3);
    g.lineTo(-11.5, -12);
    g.moveTo(6, -3);
    g.lineTo(11.5, -12);
    g.moveTo(-4, -5);
    g.lineTo(-11.5, -12);
    g.moveTo(4, -5);
    g.lineTo(11.5, -12);
    g.stroke();
    // Füsse mit Lichtern: grün, wenn eine Landung jetzt gelänge.
    const gut = sanft();
    [-11.5, 11.5].forEach((fx) => {
      g.fillStyle = "#d8dbe4";
      g.fillRect(fx - 3, -13.5, 6, 1.8);
      if (state.schritt === "flug") {
        g.fillStyle = gut ? "#4cff8a" : "#ff6b6b";
        g.beginPath();
        g.arc(fx, -10.5, 1.3, 0, Math.PI * 2);
        g.fill();
      }
    });
    // Düse
    g.fillStyle = "#6b6f80";
    g.beginPath();
    g.moveTo(-3, -4);
    g.lineTo(-4.5, -8.5);
    g.lineTo(4.5, -8.5);
    g.lineTo(3, -4);
    g.closePath();
    g.fill();
    // Unterteil in Goldfolie
    const gold = g.createLinearGradient(-10, 0, 10, 0);
    gold.addColorStop(0, "#9a6a12");
    gold.addColorStop(0.5, "#ffd56a");
    gold.addColorStop(1, "#a8761a");
    g.fillStyle = gold;
    g.beginPath();
    g.moveTo(-10, -4);
    g.lineTo(10, -4);
    g.lineTo(11, 3);
    g.lineTo(-11, 3);
    g.closePath();
    g.fill();
    g.strokeStyle = "rgba(120, 80, 10, 0.6)";
    g.lineWidth = 0.6;
    g.beginPath();
    g.moveTo(-3, -4);
    g.lineTo(-3.5, 3);
    g.moveTo(3, -4);
    g.lineTo(3.5, 3);
    g.stroke();
    // Kabine
    const silber = g.createLinearGradient(-8, 0, 8, 0);
    silber.addColorStop(0, "#9ca2b4");
    silber.addColorStop(0.5, "#f2f4fa");
    silber.addColorStop(1, "#a7adbf");
    g.fillStyle = silber;
    g.beginPath();
    g.moveTo(-8, 3);
    g.lineTo(8, 3);
    g.lineTo(6.5, 11);
    g.lineTo(2.5, 14);
    g.lineTo(-2.5, 14);
    g.lineTo(-6.5, 11);
    g.closePath();
    g.fill();
    g.fillStyle = "#1d2a44";
    g.beginPath();
    g.moveTo(-3.5, 6);
    g.lineTo(3.5, 6);
    g.lineTo(2.5, 10);
    g.lineTo(-2.5, 10);
    g.closePath();
    g.fill();
    g.fillStyle = "rgba(160, 220, 255, 0.6)";
    g.fillRect(-2.6, 8.4, 2, 1);
    // Antenne
    g.strokeStyle = "#d8dbe4";
    g.lineWidth = 0.8;
    g.beginPath();
    g.moveTo(4, 12);
    g.lineTo(7, 17);
    g.stroke();
    g.restore();
  }

  function zeichneTeile() {
    if (!state.teile.length) return;
    weltTransform();
    state.teile.forEach((t) => {
      const k = clamp(t.leben / t.max, 0, 1);
      g.globalAlpha = t.art === "staub" ? k * 0.45 : k;
      g.fillStyle = t.farbe;
      g.beginPath();
      g.arc(t.x, t.y, t.r * (t.art === "staub" ? 2.2 - k * 1.2 : 0.5 + k * 0.5), 0, Math.PI * 2);
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
      const steig = (1 - k) * 30;
      const gross = s.gross * clamp(view.s, 0.8, 1.6);
      g.globalAlpha = Math.min(1, k * 2);
      g.font = `900 ${Math.round(gross)}px system-ui, sans-serif`;
      g.lineWidth = 4;
      g.strokeStyle = "rgba(2, 3, 9, 0.75)";
      g.strokeText(s.text, bildX(s.x), bildY(s.y) - steig);
      g.fillStyle = s.farbe;
      g.fillText(s.text, bildX(s.x), bildY(s.y) - steig);
    });
    g.globalAlpha = 1;
  }

  // Liegt die nächste Plattform ausserhalb des Bildes, zeigt ein Pfeil am
  // Rand dorthin, mit der Entfernung.
  function zeichneWegweiser() {
    if (state.schritt === "crash" || state.schritt === "start") return;
    const p = state.platten[state.auf + 1];
    if (!p) return;
    const mx = (p.x0 + p.x1) / 2;
    const sx = bildX(mx);
    const sy = bildY(p.y);
    const rand = 26;
    if (sx > rand && sx < view.cssW - rand && sy > rand + 50 && sy < view.cssH - rand) return;
    const cx = clamp(sx, rand, view.cssW - rand);
    const cy = clamp(sy, rand + 60, view.cssH - rand);
    const w = Math.atan2(sy - cy, sx - cx);
    bildTransform();
    g.save();
    g.translate(cx, cy);
    g.fillStyle = "rgba(2, 3, 9, 0.6)";
    g.beginPath();
    g.arc(0, 0, 17, 0, Math.PI * 2);
    g.fill();
    g.rotate(w);
    g.fillStyle = "#ffd166";
    g.beginPath();
    g.moveTo(12, 0);
    g.lineTo(2, -7);
    g.lineTo(2, 7);
    g.closePath();
    g.fill();
    g.restore();
    const meter = Math.round(Math.hypot(mx - state.f.x, p.y - state.f.y) / 10);
    g.font = "800 11px system-ui, sans-serif";
    g.textAlign = "center";
    g.textBaseline = "top";
    g.fillStyle = "#ffffff";
    g.fillText(`${meter} m`, cx, cy + 19);
  }

  // Oben links die Punkte und die Landungen, darunter, breit, der Tank.
  //
  // Der Balken sinkt, solange das Triebwerk brennt. Hell abgesetzt steht
  // daneben, was dieser Flug schon verbraucht hat, und ein Strich zeigt, wie
  // weit er für einen sparsamen Flug höchstens sinken sollte: Wer darüber
  // landet, bekommt den vollen Bonus. Beim Tanken füllt er sich sichtbar auf.
  function zeichneAnzeige() {
    bildTransform();
    const W = view.cssW;
    const gross = clamp(view.cssH * 0.045, 14, 22);
    const x = 12;
    const y = 12;
    let unten = y;

    if (state.schritt !== "start") {
      g.font = `900 ${Math.round(gross)}px system-ui, sans-serif`;
      g.textAlign = "left";
      g.textBaseline = "middle";
      const text = String(state.punkte);
      const klein = Math.round(gross * 0.62);
      const landText = `${state.landungen}`;
      g.font = `800 ${klein}px system-ui, sans-serif`;
      const landW = g.measureText(landText).width;
      g.font = `900 ${Math.round(gross)}px system-ui, sans-serif`;
      const w = g.measureText(text).width + gross * 1.3 + landW + gross * 1.6;
      const h = gross * 1.6;
      g.fillStyle = "rgba(2, 3, 9, 0.6)";
      g.beginPath();
      if (g.roundRect) g.roundRect(x, y, w, h, h / 2);
      else g.rect(x, y, w, h);
      g.fill();
      g.fillStyle = "#ffffff";
      g.fillText(text, x + gross * 0.6, y + h * 0.53);
      // Daneben klein die Landungen, mit einer kleinen Plattform davor.
      const px = x + gross * 0.6 + g.measureText(text).width + gross * 0.55;
      const py = y + h * 0.62;
      g.fillStyle = "#d8dbe4";
      g.fillRect(px, py, gross * 0.75, gross * 0.15);
      g.fillStyle = "#ffc82e";
      g.fillRect(px, py, gross * 0.17, gross * 0.15);
      g.fillRect(px + gross * 0.58, py, gross * 0.17, gross * 0.15);
      g.fillStyle = "#4cff8a";
      g.beginPath();
      g.arc(px + gross * 0.37, py - gross * 0.22, gross * 0.12, 0, Math.PI * 2);
      g.fill();
      g.font = `800 ${klein}px system-ui, sans-serif`;
      g.fillStyle = "rgba(255,255,255,0.85)";
      g.fillText(landText, px + gross * 0.95, y + h * 0.55);
      unten = y + h + 8;
    }

    // Der Tank.
    const bw = Math.min(W - 24, 440);
    const bh = clamp(gross * 0.95, 15, 20);
    const bx = x;
    const by = unten;
    const k = clamp(state.anzeige / TANK, 0, 1);
    const ab = clamp(state.tankAb / TANK, 0, 1);
    g.fillStyle = "rgba(2, 3, 9, 0.62)";
    g.beginPath();
    if (g.roundRect) g.roundRect(bx - 3, by - 3, bw + 6, bh + 6, (bh + 6) / 2);
    else g.rect(bx - 3, by - 3, bw + 6, bh + 6);
    g.fill();
    // Was dieser Flug schon verbraucht hat.
    if (ab > k && state.schritt === "flug") {
      g.fillStyle = "rgba(255, 150, 70, 0.38)";
      g.fillRect(bx + bw * k, by, bw * (ab - k), bh);
    }
    // Der Inhalt: grün, wenn genug da ist, gelb, rot, wenn es knapp wird.
    const farbe = k > 0.5 ? "#5ee08a" : k > 0.25 ? "#ffd166" : "#ff6b6b";
    const blinkt = k <= 0.25 && !ruhig() && Math.sin(state.zeit * 12) < 0;
    const inhalt = g.createLinearGradient(0, by, 0, by + bh);
    inhalt.addColorStop(0, blinkt ? "#ffb0b0" : farbe);
    inhalt.addColorStop(1, blinkt ? "#ff8080" : k > 0.5 ? "#2fa865" : k > 0.25 ? "#e0a020" : "#d83a3a");
    g.fillStyle = inhalt;
    g.beginPath();
    if (g.roundRect) g.roundRect(bx, by, Math.max(bh * 0.5, bw * k), bh, bh / 2);
    else g.rect(bx, by, bw * k, bh);
    g.fill();
    // Ein Glanz beim Tanken.
    const getankt = state.getankt && state.zeit - state.getankt.zeit < 1.4 ? state.getankt : null;
    if (getankt && !ruhig()) {
      g.fillStyle = `rgba(255, 255, 255, ${0.35 * (1 - (state.zeit - getankt.zeit) / 1.4)})`;
      g.fillRect(bx, by, bw * k, bh);
    }
    // Der Strich: so tief darf der Tank auf diesem Flug sinken, damit er
    // sparsam war.
    const p = state.platten[state.auf + 1];
    if (p && state.schritt !== "crash") {
      const strich = clamp((state.tankAb - p.bedarf * SPARSAM) / TANK, 0, 1);
      const sx = bx + bw * strich;
      g.fillStyle = "#ffffff";
      g.fillRect(sx - 1.5, by - 5, 3, bh + 10);
      g.beginPath();
      g.moveTo(sx - 5, by - 7);
      g.lineTo(sx + 5, by - 7);
      g.lineTo(sx, by - 2);
      g.closePath();
      g.fill();
    }
    // Die Beschriftung im Balken.
    const schrift = Math.round(bh * 0.66);
    g.font = `800 ${schrift}px system-ui, sans-serif`;
    g.textAlign = "left";
    g.textBaseline = "middle";
    g.fillStyle = "rgba(10, 20, 30, 0.85)";
    if (bw * k > schrift * 6) g.fillText("Treibstoff", bx + bh * 0.45, by + bh * 0.54);
    if (getankt) {
      g.textAlign = "left";
      g.fillStyle = "#ffd166";
      g.font = `900 ${schrift + 2}px system-ui, sans-serif`;
      const tx = Math.min(bx + bw * k + 8, bx + bw - schrift * 3);
      g.fillText(`+${getankt.menge}`, tx, by + bh * 0.54);
    }
  }

  function zeichnen() {
    if (!g) return;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, canvas.width, canvas.height);
    zeichneHimmel();
    zeichneHintergrund();
    zeichneBoden();
    zeichnePlatten();
    zeichneTeile();
    zeichneFaehre();
    zeichneSchriften();
    zeichneWegweiser();
    zeichneAnzeige();
  }

  // ---------------------------------------------------------------------------
  // Teilchen und Schriften
  // ---------------------------------------------------------------------------
  function staub(x, y, anzahl, kraft = 1) {
    if (ruhig()) anzahl = Math.ceil(anzahl / 3);
    for (let i = 0; i < anzahl; i += 1) {
      const seite = Math.random() < 0.5 ? -1 : 1;
      state.teile.push({
        art: "staub", x: x + (Math.random() - 0.5) * 6, y: y + 2,
        vx: seite * (30 + Math.random() * 90) * kraft, vy: 6 + Math.random() * 24 * kraft,
        r: 2 + Math.random() * 3, farbe: "#c9cbd2", leben: 0.7 + Math.random() * 0.6, max: 1.3, schwer: 0.3,
      });
    }
  }

  function explosion(x, y) {
    const farben = ["#fff4d6", "#ffd166", "#ff8c42", "#e8433a", "#ffd56a", "#b9bdc9"];
    const n = ruhig() ? 14 : 46;
    for (let i = 0; i < n; i += 1) {
      const w = Math.random() * Math.PI * 2;
      const v = 40 + Math.random() * 180;
      state.teile.push({
        art: i % 4 ? "funke" : "staub", x, y, vx: Math.cos(w) * v, vy: Math.sin(w) * v + 40,
        r: 1.3 + Math.random() * 2.4, farbe: farben[i % farben.length], leben: 0.6 + Math.random() * 0.9, max: 1.5, schwer: 1,
      });
    }
  }

  function schrift(text, x, y, farbe, gross) {
    state.schriften.push({ text, x, y, farbe, gross, leben: 1.2, max: 1.2 });
  }

  // ---------------------------------------------------------------------------
  // Der Flug
  // ---------------------------------------------------------------------------
  // Wohin sie sich neigen will: zum Finger hin, oder nach den Pfeiltasten.
  function stelleNeigung() {
    if (finger.an) {
      const dx = finger.x - bildX(state.f.x);
      const dy = bildY(state.f.y) - finger.y;
      state.neigZiel = Math.abs(dx) < 16 ? 0 : clamp(Math.atan2(dx, Math.max(dy, 50)), -NEIG_MAX, NEIG_MAX);
    } else if (pruef.neig !== null) {
      state.neigZiel = clamp(pruef.neig, -NEIG_MAX, NEIG_MAX);
    } else if (tasten.links !== tasten.rechts) {
      state.neigZiel = tasten.links ? -NEIG_MAX * 0.75 : NEIG_MAX * 0.75;
    } else {
      state.neigZiel = 0;
    }
  }

  // Ist sie im Leitstrahl der nächsten Plattform – darüber, nicht zu hoch,
  // und nicht im Steigen? Dann gibt das die Plattform zurück.
  function imStrahl() {
    const f = state.f;
    const p = state.platten[state.auf + 1];
    if (!p || state.schritt !== "flug") return null;
    const ueber = f.y - 13 - p.y;
    if (f.x < p.x0 - STRAHL_RAND || f.x > p.x1 + STRAHL_RAND) return null;
    if (ueber < -4 || ueber > STRAHL_HOCH || f.vy > 25) return null;
    return p;
  }

  function physik(dt) {
    const f = state.f;
    stelleNeigung();
    // Ohne Schub richtet sie sich langsam auf – und gleich nach dem Abheben
    // steigt sie erst ein Stück gerade, bevor sie sich neigt. Im Leitstrahl
    // richtet sie sich zügig auf, was der Finger auch sagt.
    const strahl = imStrahl();
    state.strahl = Boolean(strahl);
    const frisch = state.zeit - state.schrittZeit < 0.3;
    const ziel = !strahl && !frisch && (state.schub || tasten.links || tasten.rechts || pruef.neig !== null) ? state.neigZiel : 0;
    const tempo = strahl ? NEIG_TEMPO * 1.6 : state.schub ? NEIG_TEMPO : NEIG_TEMPO * 0.6;
    const fehlt = ziel - f.neig;
    f.neig += clamp(fehlt, -tempo * dt, tempo * dt);
    // Und sie gleitet über die Mitte der Plattform und hält dort still.
    if (strahl) {
      const mitte = (strahl.x0 + strahl.x1) / 2;
      const soll = clamp((mitte - f.x) * 1.4, -45, 45);
      f.vx += (soll - f.vx) * (1 - Math.exp(-dt * 3));
    }

    const brennt = state.schub && state.tank > 0;
    if (brennt) {
      state.tank = Math.max(0, state.tank - VERBRAUCH * dt);
      if (state.tank <= 0) schrift("Tank leer!", f.x, f.y + 40, "#ff8c8c", 15);
      f.vx += Math.sin(f.neig) * SCHUB * dt;
      f.vy += Math.cos(f.neig) * SCHUB * dt;
    }
    f.vy -= G * dt;
    f.x += f.vx * dt;
    f.y += f.vy * dt;

    // Staub, wenn das Triebwerk nahe am Boden brennt.
    if (brennt) {
      const unter = bodenBei(f.x);
      const abstand = f.y - 13 - unter;
      if (abstand < 60 && Math.random() < dt * 40 * (1 - abstand / 60)) staub(f.x, unter, 1, 1 - abstand / 80);
    }

    // Berührt sie den Boden?
    const fuesse = FUSS.map(welt);
    const fussUnten = fuesse.some((p) => p.y <= bodenBei(p.x));
    const rumpfUnten = RUMPF.map(welt).some((p) => p.y <= bodenBei(p.x));
    if (rumpfUnten) { crash(); return; }
    if (fussUnten) {
      const platte = platteBei(fuesse[0].x);
      const beide = platte && platteBei(fuesse[1].x) === platte;
      if (beide && sanft() && f.vy > 0) {
        // Steigt sie noch und streift dabei mit einem Fuss die Plattform –
        // beim Abheben, schon leicht geneigt –, hebt der Fuss eben ab.
        const tiefster = Math.min(fuesse[0].y, fuesse[1].y);
        f.y += Math.max(0, platte.y - tiefster) + 0.01;
      } else if (beide && sanft()) {
        landen(platte);
      } else {
        crash();
      }
    }
  }

  function landen(platte) {
    const f = state.f;
    f.y = platte.y + 13;
    f.vx = 0;
    f.vy = 0;
    f.neig = 0;
    state.schritt = "gelandet";
    state.schrittZeit = state.zeit;
    staub(f.x, platte.y, 14, 0.8);
    kids()?.vibrate?.(14);
    if (platte.n > state.auf) {
      state.auf = platte.n;
      state.landungen += 1;
      // Die Punkte: für die Plattform, und dazu, wie sparsam der Flug
      // hierher war – gemessen an dem, was er braucht.
      const verbraucht = Math.max(0, state.tankAb - state.tank);
      const bonus = sparBonus(verbraucht, platte.bedarf);
      const plus = PUNKTE_PLATTE + bonus;
      state.punkte += plus;
      if (bonus >= PUNKTE_SPAREN * 0.9) state.sparsam += 1;
      shell.setCount(state.punkte);
      // Tanken – nie ganz voll, und von Plattform zu Plattform weniger.
      while (state.platten.length < platte.n + 3) naechstePlatte();
      const nach = clamp(Math.round(state.platten[platte.n + 1].bedarf * tankFaktor(platte.n)), 6, 60);
      const vorher = state.tank;
      state.tank = Math.max(vorher, Math.min(TANK_NACH, vorher + nach));
      state.tankAb = state.tank;
      state.getankt = { menge: Math.round(state.tank - vorher), zeit: state.zeit };
      if (bonus >= PUNKTE_SPAREN * 0.9) {
        schrift(`Sehr sparsam! +${plus}`, f.x, f.y + 34, "#ffe08a", 16);
        kids()?.playJingle?.("star");
      } else if (bonus >= PUNKTE_SPAREN * 0.45) {
        schrift(`Sparsam +${plus}`, f.x, f.y + 34, "#9effc0", 15);
        kids()?.playJingle?.("tap");
      } else {
        schrift(`Gelandet +${plus}`, f.x, f.y + 34, "#ffffff", 15);
        kids()?.playJingle?.("tap");
      }
    }
    while (state.platten.length < state.auf + 4) naechstePlatte();
  }

  function crash() {
    if (state.schritt !== "flug") return;
    state.schritt = "crash";
    state.schrittZeit = state.zeit;
    state.stoss = 1;
    explosion(state.f.x, state.f.y);
    kids()?.playJingle?.("retry");
    kids()?.vibrate?.([30, 40, 80]);
    stepTimer = window.setTimeout(finish, 1500);
  }

  function takt(dt) {
    state.zeit += dt;
    if (state.stoss > 0) state.stoss = Math.max(0, state.stoss - dt * 2.2);
    state.flamme = ruhig() ? 0.5 : Math.random();
    // Der Balken: Sinkt der Tank, sinkt er sofort; beim Tanken füllt er sich.
    if (state.tank < state.anzeige) state.anzeige = state.tank;
    else state.anzeige += (state.tank - state.anzeige) * (1 - Math.exp(-dt * 4));

    if (state.schritt !== "flug") state.strahl = false;
    if (state.schritt === "flug") {
      const n = Math.max(1, Math.ceil(dt / TAKT));
      for (let i = 0; i < n && state.schritt === "flug"; i += 1) physik(dt / n);
    } else if (state.schritt === "gelandet" || state.schritt === "start") {
      // Wer auf einer Plattform steht und Schub gibt, hebt ab.
      if (state.schub && state.phase === "spiel" && state.tank > 0 && state.zeit - state.schrittZeit > 0.25) {
        state.schritt = "flug";
        state.schrittZeit = state.zeit;
        state.f.vy = 8;
      }
    }

    for (let i = state.teile.length - 1; i >= 0; i -= 1) {
      const t = state.teile[i];
      t.vy -= G * (t.schwer || 0) * dt;
      t.vx *= 1 - 1.2 * dt;
      t.x += t.vx * dt;
      t.y += t.vy * dt;
      t.leben -= dt;
      if (t.leben <= 0) state.teile.splice(i, 1);
    }
    for (let i = state.schriften.length - 1; i >= 0; i -= 1) {
      state.schriften[i].leben -= dt;
      if (state.schriften[i].leben <= 0) state.schriften.splice(i, 1);
    }

    // Die Kamera: die Fähre und die nächste Plattform im Bild, notfalls
    // herausgezoomt – nie weiter als bis zur Hälfte.
    while (state.platten.length < state.auf + 4) naechstePlatte();
    const f = state.f;
    const p = state.platten[state.auf + 1];
    const box = { x0: f.x - 40, x1: f.x + 40, y0: f.y - 50, y1: f.y + 40 };
    if (p && state.schritt !== "crash") {
      box.x0 = Math.min(box.x0, p.x0 - 30);
      box.x1 = Math.max(box.x1, p.x1 + 30);
      box.y0 = Math.min(box.y0, p.y - 40);
      box.y1 = Math.max(box.y1, p.y + 40);
    }
    const breit = (box.x1 - box.x0) * 1.08;
    const hoch = (box.y1 - box.y0) * 1.15 + 70;
    const zoomZiel = clamp(Math.min(view.cssW / (breit * view.grund), view.cssH / (hoch * view.grund)), 0.55, 1);
    const k = state.zeit < 0.05 ? 1 : 1 - Math.exp(-dt * 2.4);
    view.zoom += (zoomZiel - view.zoom) * k;
    skaliere();
    // Ist der Weg zu weit für das Bild, bleibt die Fähre drin und das Ziel
    // zeigt der Pfeil am Rand.
    let mx = (box.x0 + box.x1) / 2;
    let my = (box.y0 + box.y1) / 2 + 16;
    mx = clamp(mx, f.x - view.w * 0.32, f.x + view.w * 0.32);
    my = clamp(my, f.y - view.h * 0.3, f.y + view.h * 0.3);
    state.camX += (mx - state.camX) * k;
    state.camY += (my - state.camY) * k;

    if (state.phase === "spiel") gegner?.takt(state.punkte);
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
  // Finger und Tasten
  // ---------------------------------------------------------------------------
  function schubAn() {
    state.schub = true;
    if (state.phase !== "bereit") return;
    state.phase = "spiel";
    shell.setPhase("play");
    gegner?.los();
    kids()?.vibrate?.(8);
  }

  function schubAus() {
    state.schub = Boolean(finger.an || tasten.schub);
  }

  function fingerBei(event) {
    const rect = canvas?.getBoundingClientRect();
    if (!rect) return;
    finger.x = event.clientX - rect.left;
    finger.y = event.clientY - rect.top;
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
    state.sparsam = 0;
    state.landungen = 0;
    state.boden = [];
    state.platten = [];
    state.kopf = -600;
    naechstePlatte();
    while (state.platten.length < 4) naechstePlatte();
    state.auf = 0;
    state.f = { x: 0, y: state.platten[0].y + 13, vx: 0, vy: 0, neig: 0 };
    state.tank = TANK;
    state.tankAb = TANK;
    state.anzeige = TANK;
    state.getankt = null;
    state.schub = false;
    state.neigZiel = 0;
    state.teile = [];
    state.schriften = [];
    state.stoss = 0;
    state.zeit = 0;
    state.schrittZeit = 0;
    finger.an = false;
    tasten.links = false;
    tasten.rechts = false;
    tasten.schub = false;
    pruef.neig = null;
    view.zoom = 1;
    shell.setCount(0);
    gegner?.runde();

    shell.clear();
    const prompt = shell.el("p", "cm-prompt ml-prompt", "Halten – Schub. Spar Treibstoff!");
    shell.play.append(prompt, buildPlatz());
    view.cssW = 0;
    view.cssH = 0;
    messen();
    state.camX = 0;
    state.camY = state.f.y;
    takt(0);

    last = performance.now();
    frame = window.requestAnimationFrame(loop);
  }

  function zaehleHoch(ziel) {
    const zahl = host.querySelector(".cm-result-score");
    if (!zahl) return;
    if (ruhig() || ziel <= 1) { zahl.textContent = String(ziel); return; }
    const dauer = Math.min(800, 200 + ziel * 30);
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
    gegner?.ende(punkte);
    const vorher = Number(store.read()?.scores?.[0]) || 0;
    const rekord = punkte > vorher;
    store.update((old) => ({
      runs: (Number(old.runs) || 0) + 1,
      scores: [...(old.scores || []), punkte].sort((x, y) => y - x).slice(0, TOP_COUNT),
    }));
    kids()?.playJingle?.("win");
    const landungen = state.landungen === 1 ? "1 Landung" : `${state.landungen} Landungen`;
    const sparsam = state.sparsam ? ` · ${state.sparsam} sehr sparsam` : "";
    shell.showResult({
      label: "Deine Punkte",
      points: punkte,
      detail: rekord ? `Neuer Rekord! ${landungen}${sparsam}` : `${landungen}${sparsam}${vorher ? ` · Bestwert ${vorher}` : ""}`,
      speech: `${punkte} Punkte, ${landungen}.${rekord ? " Das ist dein neuer Rekord!" : vorher ? ` Dein Bestwert sind ${vorher} Punkte.` : ""}`,
    });
    if (rekord) host.querySelector(".cm-result-detail")?.classList.add("ml-rekord");
    zaehleHoch(punkte);
  }

  // ---------------------------------------------------------------------------
  // Start
  // ---------------------------------------------------------------------------
  shell = shellApi.mount({
    host,
    title: "Mondlandung",
    area: "problemloesen",
    accent: "#3FA34D",
    accentDark: "#2c7337",
    help: HELP,
    clock: false,
    onRestart: startRun,
  });
  gegner = window.LernappGeist?.fuer?.({ spiel: "moonLander", host, art: "ziel", fassung: "p2" }) || null;

  startRun();

  host.addEventListener("pointerdown", (event) => {
    if (event.target.closest("button, a, input")) return;
    finger.an = true;
    finger.id = event.pointerId;
    fingerBei(event);
    schubAn();
  });
  window.addEventListener("pointermove", (event) => {
    if (finger.an && event.pointerId === finger.id) fingerBei(event);
  });
  const fingerWeg = (event) => {
    if (event && finger.id !== null && event.pointerId !== finger.id) return;
    finger.an = false;
    finger.id = null;
    schubAus();
  };
  window.addEventListener("pointerup", fingerWeg);
  window.addEventListener("pointercancel", fingerWeg);
  window.addEventListener("blur", () => {
    finger.an = false;
    tasten.links = false;
    tasten.rechts = false;
    tasten.schub = false;
    schubAus();
  });

  const SCHUB_TASTEN = new Set([" ", "Enter", "ArrowUp", "w", "W"]);
  const LINKS = new Set(["ArrowLeft", "a", "A"]);
  const RECHTS = new Set(["ArrowRight", "d", "D"]);
  document.addEventListener("keydown", (event) => {
    const art = SCHUB_TASTEN.has(event.key) ? "schub" : LINKS.has(event.key) ? "links" : RECHTS.has(event.key) ? "rechts" : "";
    if (!art) return;
    if (document.activeElement?.tagName === "BUTTON") return;
    event.preventDefault();
    if (event.repeat) return;
    tasten[art] = true;
    if (art === "schub") schubAn();
  });
  document.addEventListener("keyup", (event) => {
    const art = SCHUB_TASTEN.has(event.key) ? "schub" : LINKS.has(event.key) ? "links" : RECHTS.has(event.key) ? "rechts" : "";
    if (!art) return;
    tasten[art] = false;
    schubAus();
  });

  window.addEventListener("resize", messen);
  window.addEventListener("orientationchange", messen);
  window.addEventListener("pagehide", () => { clearStep(); stopLoop(); });

  // Für die Prüfskripte: steuern wie mit Finger und Tasten.
  window.LernappMondlandung = {
    G, SCHUB, TANK, LANDE_VY, LANDE_VX, LANDE_NEIG, state, view, takt, bodenBei, platteBei,
    schub(an) { tasten.schub = Boolean(an); if (an) schubAn(); else schubAus(); },
    lenke(richtung) { tasten.links = richtung < 0; tasten.rechts = richtung > 0; },
    neige(winkel) { pruef.neig = winkel; },
  };
})();
