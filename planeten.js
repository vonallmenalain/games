/*
 * planeten.js – Planetenhüpfer.
 * ---------------------------------------------------------------------------
 * Ein kleiner Astronaut läuft um einen Planeten, immer rundherum. Ein Tipp,
 * und er springt ab – senkrecht vom Planeten weg, dorthin, wohin sein Kopf
 * zeigt. Kommt er durch die Lufthülle des nächsten Planeten, fängt sie ihn
 * ein, und er läuft dort weiter. Verfehlt er sie, treibt er ins All. Eine
 * Zielhilfe gibt es nicht: Man sieht es am Astronauten selbst.
 *
 * Es geht nach oben, Planet um Planet. Die Sprünge werden schnell weiter,
 * die Planeten kleiner, ihre Lufthülle dünner; manche wandern hin und her, um
 * manche kreist ein Mond, an dem man sich den Helm anschlägt. Und der
 * Sauerstoff reicht auf jedem Planeten nur eine Weile – wer zu lange auf den
 * perfekten Moment wartet, wartet zu lange.
 *
 * Gezählt werden Punkte, und es zählt das Tempo: Jeder Sprung auf einen
 * neuen Planeten bringt zwischen 10 und 100, je nachdem, wie viel Sauerstoff
 * beim Absprung noch übrig war. Wer gleich springt, wenn der Weg frei ist,
 * holt fast alles; wer eine Runde mehr dreht, weniger. Der Ring um den
 * Astronauten zeigt es, von Grün über Orange nach Rot.
 *
 * Gebaut wird der Weg aus dem Zufall (zufall.js): ohne Turnier jedes Mal ein
 * anderer, im Turnier für alle im selben Versuch derselbe. Er ist immer
 * schaffbar: Der Astronaut läuft rundherum, also zeigt sein Kopf einmal in
 * jede Richtung, und im All fliegt er geradeaus. Wie genau man treffen muss, hängt
 * an der Grösse der Lufthülle und am Abstand – beides wird nach oben
 * strenger, nie unmöglich.
 *
 * Die Gegner (geist.js) hüpfen als Astronaut aus Licht mit – genau so, wie
 * sie in ihrer besten Runde gehüpft sind, von ihren eigenen Planeten. Und
 * die besten Läufe lassen sich anschauen (?zuschauen=, geist.js): auf ihren
 * eigenen Planeten, gewürfelt mit derselben Saat, die Planeten dort, wo die
 * Uhr sie damals hatte.
 *
 * Gerechnet wird in Welteinheiten, y zählt nach oben.
 */
(() => {
  "use strict";

  if (document.body.dataset.page !== "planets") return;

  const host = document.querySelector("#ph-stage");
  const shellApi = window.LernappGameShell;
  const cloudApi = window.LernappGameCloud;
  if (!host || !shellApi) return;

  const kids = () => window.LernappKids || null;
  const ruhig = () => Boolean(kids()?.prefersReducedMotion?.());

  // Der Zufall. Nur der Weg zieht daraus – Sterne, Nebel und Funken hängen
  // an festen Zahlen oder an Math.random.
  const zufall = window.LernappZufall?.fuer?.("planetHop") || {
    neu() {},
    zahl: () => Math.random(),
  };

  // ---------------------------------------------------------------------------
  // Die Welt
  // ---------------------------------------------------------------------------
  const MIN_W = 320;               // so viel Welt ist mindestens zu sehen, quer …
  const MIN_H = 520;               // … und hoch
  const ASTRO = 1.3;               // so gross wird der Astronaut gezeichnet
  const HOEHE = 9.2 * ASTRO;       // so weit liegt seine Mitte über dem Boden
  const TAKT = 1 / 240;

  // Wie schnell er rundherum läuft (Bogenmass je Sekunde) und wie schnell er
  // springt – beides nach den erreichten Planeten. Auf jedem Planeten gleich
  // schnell im Kreis: Ein kleiner Planet dreht ihn nicht schneller als ein
  // grosser, sonst würde das Treffen dort zur Glückssache.
  const DREH0 = 1.55;
  const DREH_MAX = 2.55;
  const SPRUNG0 = 270;
  const SPRUNG_MAX = 360;
  const LUFT0 = 9.5;               // Sekunden Sauerstoff auf einem Planeten
  const LUFT_MIN = 5.5;
  const PUNKTE_MIN = 10;           // so viel bringt ein Sprung mindestens …
  const PUNKTE_MAX = 100;          // … und so viel, wer sofort springt

  const HELP = [
    "Planetenhüpfer. Der Astronaut läuft um den Planeten herum.",
    "Tippe aufs Bild, dann springt er ab – senkrecht vom Planeten weg, dorthin, wohin sein Kopf zeigt.",
    "Fliegt er durch die leuchtende Lufthülle des nächsten Planeten, landet er dort. Verfehlt er sie, treibt er ins All.",
    "Jeder neue Planet bringt Punkte – umso mehr, je schneller du abspringst. Der Ring um den Astronauten zeigt den Sauerstoff, von Grün über Orange nach Rot.",
    "Pass auf die Monde auf, und warte nicht zu lange: Geht der Sauerstoff aus, ist die Runde vorbei.",
  ].join(" ");

  const TOP_COUNT = 5;
  const store = cloudApi
    ? cloudApi.register({ key: "lernapp.planeten", empty: { runs: 0, scores: [] }, merge: cloudApi.mergeScores(TOP_COUNT) })
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
  // Wie streng es beim Planeten n zugeht: anfangs wenig, dann immer mehr.
  // Die Abstände wachsen schneller als der Rest – nach zehn Planeten sind
  // sie schon fast so weit, wie sie werden.
  const schwereBei = (n) => 1 - Math.exp(-n / 12);
  const weiteBei = (n) => 1 - Math.exp(-n / 6);
  const drehBei = (n) => lerp(DREH0, DREH_MAX, schwereBei(n));
  const sprungBei = (n) => lerp(SPRUNG0, SPRUNG_MAX, schwereBei(n));
  const luftBei = (n) => lerp(LUFT0, LUFT_MIN, schwereBei(n));

  function hash01(n) {
    const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return x - Math.floor(x);
  }

  // Die Farbe des Sauerstoffs: Grün, solange viel da ist, über Orange nach
  // Rot – fliessend, ohne Sprung.
  const LUFT_FARBEN = [[255, 84, 84], [255, 168, 64], [126, 226, 120]];
  function luftFarbe(k, alpha = 1) {
    const t = clamp(k, 0, 1) * (LUFT_FARBEN.length - 1);
    const i = Math.min(LUFT_FARBEN.length - 2, Math.floor(t));
    const u = t - i;
    const c = LUFT_FARBEN[i].map((wert, j) => Math.round(lerp(wert, LUFT_FARBEN[i + 1][j], u)));
    return `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${alpha})`;
  }

  // ---------------------------------------------------------------------------
  // Zustand
  // ---------------------------------------------------------------------------
  // phase:   "bereit" (noch nichts gedrückt), "spiel", "ende"
  // schritt: "start", "lauf" (auf einem Planeten), "flug", "verloren"
  const state = {
    phase: "bereit",
    schritt: "start",
    punkte: 0,
    erreicht: 0,          // wie viele Planeten er erreicht hat
    volltreffer: 0,
    sprungLuft: 1,        // wie viel Sauerstoff beim letzten Absprung übrig war (0…1)
    planeten: [],
    auf: 0,               // auf welchem Planeten er steht
    theta: Math.PI / 2,   // wo, als Winkel um die Mitte
    richtung: 1,          // 1 gegen den Uhrzeiger, -1 mit ihm
    hoehe: HOEHE,         // über dem Boden; nach einer Landung erst höher
    astro: { x: 0, y: 0, vx: 0, vy: 0, w: 0 },
    verlassen: -1,        // der Planet, von dem er eben abgesprungen ist
    flugZeit: 0,
    luft: LUFT0,
    luftMax: LUFT0,
    grund: "",            // warum es zu Ende ging: "all", "mond", "luft"
    besucht: new Set(),
    spur: [],
    teile: [],
    schriften: [],
    camX: 0,
    camY: 0,
    stoss: 0,
    zeit: 0,
    uhr: 0,               // die Zeit, nach der sich Planeten und Monde bewegen
    schrittZeit: 0,
    endeZeit: 0,
  };

  let shell = null;
  let feld = null;
  let canvas = null;
  let g = null;
  let frame = null;
  let last = 0;
  let stepTimer = null;
  let gegner = null;
  // Wer einen Lauf anschaut statt zu spielen (geist.js, zuschauer).
  let zuschauer = null;

  const view = { s: 1, grund: 1, zoom: 1, dpr: 1, cssW: 0, cssH: 0, w: MIN_W, h: MIN_H };

  function clearStep() {
    if (stepTimer) { window.clearTimeout(stepTimer); stepTimer = null; }
  }

  function stopLoop() {
    if (frame) { window.cancelAnimationFrame(frame); frame = null; }
  }

  // ---------------------------------------------------------------------------
  // Die Planeten
  // ---------------------------------------------------------------------------
  // Wie ein Planet aussieht: Grundfarben, Zeichnung und ob er Ringe hat. Die
  // Auswahl hängt an seiner Nummer, nicht am Zufall des Wegs.
  const ARTEN = [
    { name: "erde", hell: "#7fd4ff", mitte: "#2f8fd8", dunkel: "#123a7a", fleck: "#49b86a", fleck2: "#8fd47a", luft: "120, 210, 255", wolken: true },
    { name: "lava", hell: "#ffb36b", mitte: "#e5532d", dunkel: "#5a1414", fleck: "#2b0e0e", fleck2: "#ffd36b", luft: "255, 140, 80", glut: true },
    { name: "eis", hell: "#ffffff", mitte: "#a9dcf5", dunkel: "#4a7fb4", fleck: "#e3f5ff", fleck2: "#7fbfe6", luft: "190, 235, 255" },
    { name: "gas", hell: "#ffe2a8", mitte: "#e0a15a", dunkel: "#6b3c1d", fleck: "#c9814a", fleck2: "#f7cf8f", luft: "255, 210, 150", baender: true, ring: true },
    { name: "kristall", hell: "#f2c7ff", mitte: "#a35ce0", dunkel: "#3a1670", fleck: "#d79bff", fleck2: "#6b2fb8", luft: "210, 150, 255", ring: true },
    { name: "wueste", hell: "#ffe7b3", mitte: "#e8b06a", dunkel: "#7a4a22", fleck: "#c98a4e", fleck2: "#f5d39a", luft: "255, 220, 160" },
    { name: "moos", hell: "#d6ffb0", mitte: "#5fbf5a", dunkel: "#1d5a32", fleck: "#2f8a44", fleck2: "#a8e88a", luft: "170, 255, 170", wolken: true },
  ];

  function artFuer(n) {
    if (n === 0) return ARTEN[0];
    return ARTEN[Math.floor(hash01(n * 7.31 + 0.4) * ARTEN.length)];
  }

  // Wo ein Planet gerade ist: fest, oder auf seiner Bahn hin und her.
  function mitte(p, t = state.uhr) {
    const b = p.bahn;
    if (!b) return { x: p.x, y: p.y };
    const w = (t / b.periode) * Math.PI * 2 + b.phase;
    if (b.art === "kreis") return { x: p.x + Math.cos(w) * b.amp, y: p.y + Math.sin(w) * b.amp * 0.6 };
    if (b.art === "senk") return { x: p.x, y: p.y + Math.sin(w) * b.amp };
    return { x: p.x + Math.sin(w) * b.amp, y: p.y };
  }

  function mondBei(p, t = state.uhr) {
    if (!p.mond) return null;
    const m = mitte(p, t);
    const w = p.mond.phase + t * p.mond.tempo;
    return { x: m.x + Math.cos(w) * p.mond.bahnR, y: m.y + Math.sin(w) * p.mond.bahnR, r: p.mond.r };
  }

  // Wie weit ein Planet auf seiner Bahn höchstens von seinem Platz weg ist.
  const reichweite = (p) => (p.bahn ? p.bahn.amp : 0) + (p.mond ? p.mond.bahnR + p.mond.r : p.r + p.luft);

  function neuerPlanet() {
    const liste = state.planeten;
    const n = liste.length;
    if (!n) {
      liste.push({ n: 0, x: 0, y: 0, r: 58, luft: 30, art: artFuer(0), dreh: 0.1, bahn: null, mond: null });
      return;
    }
    const k = schwereBei(n);
    const kWeit = weiteBei(n);
    const vor = liste[n - 1];
    for (let versuch = 0; versuch < 12; versuch += 1) {
      const r = lerp(46, 21, k) * (0.82 + zufall.zahl() * 0.36);
      const luft = lerp(36, 15, k) * (0.9 + zufall.zahl() * 0.2);
      const luecke = lerp(80, 205, kWeit) * (0.82 + zufall.zahl() * 0.36);
      // Meist nach oben, ein wenig zur Seite – und zurück zur Mitte, wenn
      // der Weg zu weit hinausläuft.
      const streu = lerp(0.65, 1.0, k);
      const zurueck = clamp(-vor.x / 900, -0.5, 0.5);
      const winkel = Math.PI / 2 + (zufall.zahl() - 0.5) * 2 * streu + zurueck;
      const abstandMitte = vor.r + luecke + r;
      const x = vor.x + Math.cos(winkel) * abstandMitte;
      const y = vor.y + Math.sin(winkel) * abstandMitte;

      // Bewegung ab dem fünften Planeten, ein Mond ab dem zehnten.
      let bahn = null;
      if (n >= 5 && zufall.zahl() < lerp(0.18, 0.6, k)) {
        const wahl = zufall.zahl();
        bahn = {
          art: wahl < 0.6 ? "quer" : wahl < 0.85 ? "senk" : "kreis",
          amp: lerp(28, 80, k) * (0.6 + zufall.zahl() * 0.4),
          periode: lerp(5.2, 3.2, k) * (0.85 + zufall.zahl() * 0.3),
          phase: zufall.zahl() * Math.PI * 2,
        };
      }
      let mond = null;
      if (n >= 10 && zufall.zahl() < lerp(0.1, 0.45, k)) {
        mond = {
          r: 6 + zufall.zahl() * 3,
          bahnR: r + luft + 16 + zufall.zahl() * 10,
          tempo: (zufall.zahl() < 0.5 ? -1 : 1) * lerp(0.8, 1.5, zufall.zahl()),
          phase: zufall.zahl() * Math.PI * 2,
        };
      }
      const neu = { n, x, y, r, luft, art: artFuer(n), dreh: (hash01(n * 3.7) - 0.5) * 0.6, bahn, mond };
      // Keiner kommt einem der letzten Planeten zu nahe – auch nicht mit
      // seiner Bahn und seinem Mond.
      const frei = liste.slice(-4).every((p) => Math.hypot(p.x - x, p.y - y) > reichweite(p) + reichweite(neu) + 24);
      if (frei || versuch === 11) {
        liste.push(neu);
        return;
      }
    }
  }

  function planetenBis(n) {
    while (state.planeten.length <= n) neuerPlanet();
  }

  // ---------------------------------------------------------------------------
  // Die Fläche
  // ---------------------------------------------------------------------------
  function buildPlatz() {
    const platz = shell.el("div", "ph-platz");
    feld = shell.el("div", "ph-feld");
    canvas = document.createElement("canvas");
    canvas.className = "ph-canvas";
    canvas.setAttribute("aria-hidden", "true");
    feld.append(canvas);
    g = canvas.getContext("2d");

    // Der Hinweis vor dem ersten Tipp: ein Finger, der tippt.
    const tipp = shell.el("span", "ph-tipp");
    tipp.setAttribute("aria-hidden", "true");
    const ns = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(ns, "svg");
    svg.setAttribute("viewBox", "0 0 64 64");
    const ring = document.createElementNS(ns, "circle");
    ring.setAttribute("cx", "32");
    ring.setAttribute("cy", "32");
    ring.setAttribute("r", "22");
    ring.setAttribute("fill", "none");
    ring.setAttribute("stroke", "#ffffff");
    ring.setAttribute("stroke-width", "4");
    ring.setAttribute("class", "ph-tipp-ring");
    const punkt = document.createElementNS(ns, "circle");
    punkt.setAttribute("cx", "32");
    punkt.setAttribute("cy", "32");
    punkt.setAttribute("r", "9");
    punkt.setAttribute("fill", "#ffffff");
    svg.append(ring, punkt);
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

  const wackel = () => (ruhig() ? 0 : Math.sin(state.zeit * 70) * 4 * state.stoss);

  function bildTransform() {
    g.setTransform(view.dpr, 0, 0, view.dpr, 0, wackel() * view.dpr);
  }

  function weltTransform() {
    const f = view.s * view.dpr;
    g.setTransform(f, 0, 0, -f, (view.cssW / 2 - state.camX * view.s) * view.dpr, (view.cssH / 2 + state.camY * view.s + wackel()) * view.dpr);
  }

  const bildX = (x) => view.cssW / 2 + (x - state.camX) * view.s;
  const bildY = (y) => view.cssH / 2 - (y - state.camY) * view.s;

  function imBild(x, y, rand) {
    return Math.abs(x - state.camX) < view.w / 2 + rand && Math.abs(y - state.camY) < view.h / 2 + rand;
  }

  // ---------------------------------------------------------------------------
  // Zeichnen
  // ---------------------------------------------------------------------------
  const STERNE = Array.from({ length: 160 }, (_, i) => ({
    x: hash01(i * 3.1 + 1), y: hash01(i * 5.7 + 2), r: 0.4 + hash01(i * 7.3 + 3) * 1.3,
    lage: i % 3, funkel: hash01(i * 9.1 + 4) * Math.PI * 2,
  }));
  const LAGE_TEMPO = [0.04, 0.1, 0.22];

  // Der Himmel: tiefes Blau ins Violette, Nebel in drei Farben, drei Lagen
  // Sterne, die verschieden schnell vorbeiziehen, und weit hinten alle paar
  // tausend Einheiten ein grosser Himmelskörper.
  function zeichneHimmel() {
    bildTransform();
    const W = view.cssW;
    const H = view.cssH;
    const verlauf = g.createLinearGradient(0, 0, 0, H);
    verlauf.addColorStop(0, "#05061a");
    verlauf.addColorStop(0.5, "#120d3a");
    verlauf.addColorStop(1, "#22104a");
    g.fillStyle = verlauf;
    g.fillRect(0, -10, W, H + 20);

    // Am Massstab ohne Zoom: Am gezoomten sprangen Sterne und Nebel bei
    // jedem Zoom, und je höher man war, desto weiter.
    const camSX = state.camX * view.grund;
    const camSY = state.camY * view.grund;
    const nebel = (fx, fy, r, farbe, tempo) => {
      const breite = W + r * 2;
      const hoch = H + r * 2;
      const x = ((fx * breite - camSX * tempo) % breite + breite) % breite - r;
      const y = ((fy * hoch + camSY * tempo) % hoch + hoch) % hoch - r;
      const n = g.createRadialGradient(x, y, 0, x, y, r);
      n.addColorStop(0, farbe);
      n.addColorStop(1, "rgba(0,0,0,0)");
      g.fillStyle = n;
      g.fillRect(x - r, y - r, r * 2, r * 2);
    };
    nebel(0.2, 0.3, Math.max(W, H) * 0.55, "rgba(160, 60, 220, 0.2)", 0.03);
    nebel(0.85, 0.65, Math.max(W, H) * 0.5, "rgba(40, 140, 255, 0.16)", 0.045);
    nebel(0.55, 0.05, Math.max(W, H) * 0.4, "rgba(255, 90, 160, 0.12)", 0.06);

    // Weit hinten: ein Gasriese mit Ring, eine Galaxie oder ein Sternhaufen.
    const FERN = 0.05;
    const zelle = 3000;
    const basis = Math.floor(state.camY * FERN / (zelle * FERN)) ;
    for (let i = basis - 1; i <= basis + 1; i += 1) {
      const art = Math.floor(hash01(i * 5.17 + 0.3) * 3);
      const fx = hash01(i * 2.9 + 1.7);
      const sx = fx * W;
      const sy = H * 0.5 - (i * zelle - state.camY) * view.s * FERN * 6;
      const gross = Math.min(W, H) * (0.14 + hash01(i * 4.3) * 0.1);
      if (sy < -gross * 2 || sy > H + gross * 2) continue;
      if (art === 0) fernerRiese(sx, sy, gross, i);
      else if (art === 1) galaxie(sx, sy, gross, i);
      else haufen(sx, sy, gross, i);
    }

    STERNE.forEach((s) => {
      const breite = W + 20;
      const hoch = H + 20;
      const x = ((s.x * breite - camSX * LAGE_TEMPO[s.lage]) % breite + breite) % breite - 10;
      const y = ((s.y * hoch + camSY * LAGE_TEMPO[s.lage]) % hoch + hoch) % hoch - 10;
      const funkeln = ruhig() ? 1 : 0.7 + 0.3 * Math.sin(state.zeit * 3 + s.funkel);
      g.globalAlpha = (0.3 + s.lage * 0.25) * funkeln;
      g.fillStyle = s.lage === 2 && s.funkel < 1 ? "#ffe6b0" : "#ffffff";
      g.beginPath();
      g.arc(x, y, s.r * (0.7 + s.lage * 0.25), 0, Math.PI * 2);
      g.fill();
    });
    g.globalAlpha = 1;
  }

  function fernerRiese(x, y, r, i) {
    g.save();
    g.globalAlpha = 0.26;
    const k = g.createRadialGradient(x - r * 0.35, y - r * 0.35, r * 0.1, x, y, r);
    const farben = [["#ffd9a8", "#c47a4a", "#3a1a2a"], ["#bfe3ff", "#5a8fd8", "#1a1f4a"], ["#f5c4ff", "#9a5ad8", "#2a1450"]][i % 3 < 0 ? 0 : Math.abs(i) % 3];
    k.addColorStop(0, farben[0]);
    k.addColorStop(0.6, farben[1]);
    k.addColorStop(1, farben[2]);
    g.fillStyle = k;
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
    g.save();
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.clip();
    g.globalAlpha = 0.1;
    g.fillStyle = "#ffffff";
    for (let b = 0; b < 5; b += 1) {
      g.fillRect(x - r, y - r * 0.75 + b * r * 0.34, r * 2, r * 0.09);
    }
    g.restore();
    g.globalAlpha = 0.28;
    g.strokeStyle = farben[0];
    g.lineWidth = r * 0.08;
    g.beginPath();
    g.ellipse(x, y, r * 1.7, r * 0.38, -0.35, 0, Math.PI * 2);
    g.stroke();
    g.restore();
  }

  function galaxie(x, y, r, i) {
    g.save();
    g.translate(x, y);
    g.rotate(hash01(i * 3.3) * Math.PI);
    g.scale(1, 0.45);
    const k = g.createRadialGradient(0, 0, 0, 0, 0, r);
    k.addColorStop(0, "rgba(255, 240, 220, 0.55)");
    k.addColorStop(0.25, "rgba(200, 160, 255, 0.25)");
    k.addColorStop(1, "rgba(80, 60, 200, 0)");
    g.fillStyle = k;
    g.beginPath();
    g.arc(0, 0, r, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "rgba(255,255,255,0.5)";
    for (let j = 0; j < 60; j += 1) {
      const t = j / 60;
      const w = t * Math.PI * 4 + (j % 2) * Math.PI;
      const rr = t * r;
      g.beginPath();
      g.arc(Math.cos(w) * rr, Math.sin(w) * rr, 0.8 + (1 - t) * 1.2, 0, Math.PI * 2);
      g.fill();
    }
    g.restore();
  }

  function haufen(x, y, r, i) {
    g.save();
    const k = g.createRadialGradient(x, y, 0, x, y, r);
    k.addColorStop(0, "rgba(120, 200, 255, 0.25)");
    k.addColorStop(1, "rgba(120, 200, 255, 0)");
    g.fillStyle = k;
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "#e8f6ff";
    for (let j = 0; j < 40; j += 1) {
      const w = hash01(i * 9 + j * 1.3) * Math.PI * 2;
      const rr = Math.pow(hash01(i * 5 + j * 2.1), 1.8) * r * 0.8;
      g.globalAlpha = 0.4 + hash01(j * 3.7) * 0.5;
      g.beginPath();
      g.arc(x + Math.cos(w) * rr, y + Math.sin(w) * rr, 0.6 + hash01(j * 1.9) * 1.4, 0, Math.PI * 2);
      g.fill();
    }
    g.restore();
  }

  // Die Lufthülle: ein weiches Leuchten bis an ihren Rand – genau so weit
  // reicht der Fang. Darum herum ein feiner Ring, damit man den Rand sieht.
  function zeichneLufthuelle(p, m) {
    const aussen = p.r + p.luft;
    const k = g.createRadialGradient(m.x, m.y, p.r * 0.9, m.x, m.y, aussen);
    k.addColorStop(0, `rgba(${p.art.luft}, 0.34)`);
    k.addColorStop(0.7, `rgba(${p.art.luft}, 0.12)`);
    k.addColorStop(1, `rgba(${p.art.luft}, 0.02)`);
    g.fillStyle = k;
    g.beginPath();
    g.arc(m.x, m.y, aussen, 0, Math.PI * 2);
    g.fill();
    const naechster = p.n === state.auf + 1 && state.schritt !== "verloren";
    g.strokeStyle = `rgba(${p.art.luft}, ${naechster ? 0.55 + 0.25 * Math.sin(state.zeit * 4) : 0.25})`;
    g.lineWidth = (naechster ? 1.6 : 1) / view.s * 1.2;
    g.setLineDash(naechster ? [5, 5] : []);
    g.lineDashOffset = -state.zeit * 8;
    g.beginPath();
    g.arc(m.x, m.y, aussen, 0, Math.PI * 2);
    g.stroke();
    g.setLineDash([]);
  }

  function zeichneRing(p, m, vorne) {
    if (!p.art.ring) return;
    g.save();
    g.translate(m.x, m.y);
    g.rotate(-0.38 + p.dreh * 0.3);
    g.strokeStyle = vorne ? "rgba(255, 236, 200, 0.75)" : "rgba(255, 236, 200, 0.45)";
    g.lineWidth = p.r * 0.14;
    g.beginPath();
    g.ellipse(0, 0, p.r * 1.65, p.r * 0.42, 0, vorne ? Math.PI : 0, vorne ? Math.PI * 2 : Math.PI);
    g.stroke();
    g.strokeStyle = vorne ? "rgba(200, 160, 120, 0.6)" : "rgba(200, 160, 120, 0.35)";
    g.lineWidth = p.r * 0.06;
    g.beginPath();
    g.ellipse(0, 0, p.r * 1.95, p.r * 0.5, 0, vorne ? Math.PI : 0, vorne ? Math.PI * 2 : Math.PI);
    g.stroke();
    g.restore();
  }

  // Ein Planet: Kugel mit Licht von links oben, seine Zeichnung (Kontinente,
  // Bänder, Krater, Glut), die sich langsam dreht, Wolken, und ein Schatten
  // auf der abgewandten Seite.
  function zeichnePlanet(p) {
    const m = mitte(p);
    if (!imBild(m.x, m.y, reichweite(p) + 40)) return;
    const a = p.art;
    zeichneLufthuelle(p, m);
    zeichneRing(p, m, false);

    const kugel = g.createRadialGradient(m.x - p.r * 0.4, m.y + p.r * 0.4, p.r * 0.1, m.x, m.y, p.r);
    kugel.addColorStop(0, a.hell);
    kugel.addColorStop(0.55, a.mitte);
    kugel.addColorStop(1, a.dunkel);
    g.fillStyle = kugel;
    g.beginPath();
    g.arc(m.x, m.y, p.r, 0, Math.PI * 2);
    g.fill();

    g.save();
    g.beginPath();
    g.arc(m.x, m.y, p.r, 0, Math.PI * 2);
    g.clip();
    const drehung = state.uhr * p.dreh;
    if (a.baender) {
      for (let b = -4; b <= 4; b += 1) {
        g.fillStyle = b % 2 ? a.fleck : a.fleck2;
        g.globalAlpha = 0.45;
        const y = m.y + b * p.r * 0.24 + Math.sin(drehung * 2 + b) * p.r * 0.03;
        g.fillRect(m.x - p.r, y - p.r * 0.07, p.r * 2, p.r * (0.1 + hash01(p.n + b) * 0.06));
      }
      g.globalAlpha = 0.5;
      g.fillStyle = a.dunkel;
      g.beginPath();
      g.ellipse(m.x + Math.cos(drehung) * p.r * 0.45, m.y - p.r * 0.3, p.r * 0.2, p.r * 0.11, 0, 0, Math.PI * 2);
      g.fill();
    } else {
      // Was auf der Kugel liegt – Kontinente, Krater, Krusten mit Glut. Es
      // wandert mit der Drehung von links nach rechts über die Oberfläche
      // und wird zum Rand hin schmaler.
      const krater = a.name === "eis" || a.name === "wueste" || a.name === "kristall";
      for (let f = 0; f < 10; f += 1) {
        const h = hash01(p.n * 13.7 + f * 3.1);
        const lon = h * Math.PI * 2 + drehung;
        const lat = (hash01(p.n * 5.3 + f * 7.7) - 0.5) * 1.6;
        const sichtbar = Math.cos(lon);
        if (sichtbar < -0.05) continue;
        const fx = m.x + Math.sin(lon) * Math.cos(lat) * p.r;
        const fy = m.y + Math.sin(lat) * p.r;
        const fr = p.r * (0.1 + hash01(p.n + f * 9.9) * 0.2);
        const quer = clamp(Math.abs(sichtbar) + 0.15, 0.25, 1);
        const sicht = clamp(sichtbar * 1.6 + 0.2, 0, 1);
        if (krater) {
          // Ein Krater: dunkle Mulde, heller Rand auf der Lichtseite.
          g.globalAlpha = 0.55 * sicht;
          g.fillStyle = a.dunkel;
          g.beginPath();
          g.ellipse(fx, fy, fr * quer, fr, 0, 0, Math.PI * 2);
          g.fill();
          g.globalAlpha = 0.5 * sicht;
          g.fillStyle = a.fleck;
          g.beginPath();
          g.ellipse(fx + fr * 0.18 * quer, fy - fr * 0.18, fr * 0.72 * quer, fr * 0.72, 0, 0, Math.PI * 2);
          g.fill();
        } else if (a.glut) {
          // Dunkle Kruste; die Glut läuft in Adern dazwischen (unten).
          g.globalAlpha = 0.4 * sicht;
          g.fillStyle = a.fleck;
          g.beginPath();
          g.ellipse(fx, fy, fr * 1.2 * quer, fr, 0, 0, Math.PI * 2);
          g.fill();
        } else {
          // Ein Kontinent aus drei sich überlappenden Flecken.
          g.globalAlpha = 0.85 * sicht;
          g.fillStyle = f % 3 === 0 ? a.fleck2 : a.fleck;
          for (let t = 0; t < 3; t += 1) {
            const ox = (hash01(p.n * 3.3 + f + t * 1.7) - 0.5) * fr * 1.2 * quer;
            const oy = (hash01(p.n * 6.1 + f + t * 2.3) - 0.5) * fr * 1.2;
            g.beginPath();
            g.ellipse(fx + ox, fy + oy, fr * 0.75 * quer, fr * 0.7, 0, 0, Math.PI * 2);
            g.fill();
          }
        }
      }
      if (a.glut) {
        // Glutadern: feine, helle Linien quer über die Kugel, die mit der
        // Drehung wandern.
        g.lineCap = "round";
        for (let ader = 0; ader < 6; ader += 1) {
          const lon = hash01(p.n * 8.1 + ader * 2.7) * Math.PI * 2 + drehung;
          if (Math.cos(lon) < 0.05) continue;
          const lat = (hash01(p.n * 4.9 + ader * 1.3) - 0.5) * 1.4;
          const ax = m.x + Math.sin(lon) * Math.cos(lat) * p.r;
          const ay = m.y + Math.sin(lat) * p.r;
          const lang = p.r * (0.35 + hash01(ader * 3.9 + p.n) * 0.35);
          const w = hash01(ader * 6.3 + p.n * 2) * Math.PI;
          g.globalAlpha = 0.85 * clamp(Math.cos(lon) * 1.5, 0, 1);
          g.strokeStyle = "rgba(255, 140, 50, 0.45)";
          g.lineWidth = 3.2 / view.s;
          g.beginPath();
          g.moveTo(ax - Math.cos(w) * lang / 2, ay - Math.sin(w) * lang / 2);
          g.quadraticCurveTo(ax + Math.sin(w) * lang * 0.2, ay - Math.cos(w) * lang * 0.2, ax + Math.cos(w) * lang / 2, ay + Math.sin(w) * lang / 2);
          g.stroke();
          g.strokeStyle = "#ffd36b";
          g.lineWidth = 1.1 / view.s;
          g.stroke();
        }
      }
      if (a.wolken) {
        g.globalAlpha = 0.55;
        g.fillStyle = "#ffffff";
        for (let w = 0; w < 4; w += 1) {
          const lon = hash01(p.n * 2.2 + w) * Math.PI * 2 + drehung * 1.4;
          if (Math.cos(lon) < 0) continue;
          const fx = m.x + Math.sin(lon) * p.r * 0.85;
          const fy = m.y + (hash01(p.n * 4.4 + w) - 0.5) * p.r * 1.3;
          g.beginPath();
          g.ellipse(fx, fy, p.r * 0.32, p.r * 0.08, 0, 0, Math.PI * 2);
          g.fill();
        }
      }
    }
    g.globalAlpha = 1;
    // Der Schatten rechts unten, und ein heller Saum links oben.
    const schatten = g.createRadialGradient(m.x - p.r * 0.5, m.y + p.r * 0.5, p.r * 0.6, m.x - p.r * 0.2, m.y + p.r * 0.2, p.r * 1.5);
    schatten.addColorStop(0, "rgba(0,0,0,0)");
    schatten.addColorStop(1, "rgba(5, 4, 20, 0.7)");
    g.fillStyle = schatten;
    g.fillRect(m.x - p.r, m.y - p.r, p.r * 2, p.r * 2);
    g.restore();
    g.strokeStyle = "rgba(255,255,255,0.25)";
    g.lineWidth = 1.2 / view.s;
    g.beginPath();
    g.arc(m.x, m.y, p.r - 0.5, Math.PI * 0.55, Math.PI * 1.05);
    g.stroke();

    zeichneRing(p, m, true);

    const mond = mondBei(p);
    if (mond) {
      g.strokeStyle = "rgba(255,255,255,0.08)";
      g.lineWidth = 1 / view.s;
      g.beginPath();
      g.arc(m.x, m.y, p.mond.bahnR, 0, Math.PI * 2);
      g.stroke();
      const mk = g.createRadialGradient(mond.x - mond.r * 0.4, mond.y + mond.r * 0.4, 0.5, mond.x, mond.y, mond.r);
      mk.addColorStop(0, "#f1f1f1");
      mk.addColorStop(1, "#6d6f80");
      g.fillStyle = mk;
      g.beginPath();
      g.arc(mond.x, mond.y, mond.r, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = "rgba(60, 60, 80, 0.45)";
      g.beginPath();
      g.arc(mond.x + mond.r * 0.3, mond.y - mond.r * 0.1, mond.r * 0.25, 0, Math.PI * 2);
      g.arc(mond.x - mond.r * 0.3, mond.y + mond.r * 0.35, mond.r * 0.18, 0, Math.PI * 2);
      g.fill();
    }
  }



  function zeichneSpur() {
    if (state.spur.length < 2) return;
    weltTransform();
    g.lineCap = "round";
    for (let i = 1; i < state.spur.length; i += 1) {
      const a = state.spur[i - 1];
      const b = state.spur[i];
      const k = i / state.spur.length;
      g.globalAlpha = k * 0.6;
      g.strokeStyle = "#9fe8ff";
      g.lineWidth = 0.8 + k * 2.6;
      g.beginPath();
      g.moveTo(a.x, a.y);
      g.lineTo(b.x, b.y);
      g.stroke();
    }
    g.globalAlpha = 1;
  }

  // Der Astronaut: weisser Anzug, runder Helm mit goldenem Visier, Rucksack.
  // Gezeichnet im Bild; "oben" ist bei ihm weg vom Planeten.
  // Die Gegner als Geist: ein Astronaut aus Licht auf seinem eigenen Weg.
  function zeichneGeister() {
    if (!gegner || state.phase === "bereit") return;
    const orte = window.LernappGeist?.orte?.(gegner) || [];
    if (!orte.length) return;
    bildTransform();
    const s = view.s * ASTRO;
    orte.forEach((o) => {
      // Wem im Live-Modus zugeschaut wird, der ist die Figur selbst – kein
      // Geist dazu, nur sein Name (geist.js, namen).
      if (o.ziel) return;
      g.save();
      g.globalAlpha = 0.6 * o.blass;
      g.translate(bildX(o.a), bildY(o.b));
      g.rotate(-((o.c || 0) / 100 - Math.PI / 2));
      g.scale(s, s);
      g.fillStyle = o.farbe;
      g.beginPath();
      if (g.roundRect) g.roundRect(-4, -4.5, 8, 12, 3);
      else g.rect(-4, -4.5, 8, 12);
      g.moveTo(5.8, -8.5);
      g.arc(0.4, -8.5, 5.4, 0, Math.PI * 2);
      g.fill();
      g.restore();
    });
    const ms = gegner.zeit();
    window.LernappGeist.namen(g, orte.map((o) => {
      const d = Math.round(o.lauf.wert(ms) - state.punkte);
      return { ...o, sx: bildX(o.a), sy: bildY(o.b) - 20 * s, weit: `${d > 0 ? "+" : ""}${d}` };
    }), { breit: view.cssW, hoch: view.cssH });
  }

  function zeichneAstronaut() {
    if (state.schritt === "verloren" && state.zeit - state.schrittZeit > 2.5) return;
    const a = state.astro;
    bildTransform();
    g.save();
    g.translate(bildX(a.x), bildY(a.y));
    // Im Bild zeigt y nach unten: Der Winkel der Welt kehrt sich um.
    g.rotate(-(a.w - Math.PI / 2));
    const s = view.s * ASTRO;
    g.scale(s, s);
    const lauf = state.schritt === "lauf" ? Math.sin(state.zeit * 16) : 0;
    const blick = state.schritt === "lauf" ? state.richtung : 1;
    g.scale(blick, 1);

    // Flamme des Rucksacks im Flug.
    if (state.schritt === "flug") {
      const f = 5 + Math.random() * 4;
      const fl = g.createLinearGradient(0, 4, 0, 4 + f);
      fl.addColorStop(0, "rgba(255, 240, 180, 0.95)");
      fl.addColorStop(1, "rgba(255, 120, 60, 0)");
      g.fillStyle = fl;
      g.beginPath();
      g.moveTo(-5.5, 3);
      g.lineTo(-3.5, 3 + f);
      g.lineTo(-1.5, 3);
      g.closePath();
      g.fill();
    }
    // Beine
    g.strokeStyle = "#e6e9f5";
    g.lineCap = "round";
    g.lineWidth = 2.6;
    g.beginPath();
    g.moveTo(-1.2, 2.5);
    g.lineTo(-1.6 - lauf * 1.8, 7.5);
    g.moveTo(1.2, 2.5);
    g.lineTo(1.6 + lauf * 1.8, 7.5);
    g.stroke();
    g.fillStyle = "#8a90a8";
    g.beginPath();
    g.arc(-1.6 - lauf * 1.8, 7.8, 1.3, 0, Math.PI * 2);
    g.arc(1.6 + lauf * 1.8, 7.8, 1.3, 0, Math.PI * 2);
    g.fill();
    // Rucksack
    g.fillStyle = "#c9cede";
    g.beginPath();
    if (g.roundRect) g.roundRect(-6.6, -4.5, 3.4, 7.5, 1.2);
    else g.rect(-6.6, -4.5, 3.4, 7.5);
    g.fill();
    // Körper
    g.fillStyle = "#ffffff";
    g.beginPath();
    if (g.roundRect) g.roundRect(-4, -4.5, 8, 8, 3);
    else g.rect(-4, -4.5, 8, 8);
    g.fill();
    g.fillStyle = "#ff7a3d";
    g.fillRect(-1, -1.6, 3.2, 1.6);
    // Arme
    g.strokeStyle = "#f0f2fa";
    g.lineWidth = 2.2;
    g.beginPath();
    g.moveTo(3, -2.5);
    g.lineTo(5 + lauf * 1.2, 0.5);
    g.moveTo(-3, -2.5);
    g.lineTo(-4.5 - lauf * 1.2, 0.5);
    g.stroke();
    // Helm mit Visier
    g.fillStyle = "#ffffff";
    g.beginPath();
    g.arc(0.4, -8.5, 5.4, 0, Math.PI * 2);
    g.fill();
    const visier = g.createLinearGradient(0, -12, 4, -6);
    visier.addColorStop(0, "#ffd66b");
    visier.addColorStop(1, "#e07a1f");
    g.fillStyle = visier;
    g.beginPath();
    g.ellipse(2, -8.6, 3.4, 2.6, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "rgba(255,255,255,0.75)";
    g.beginPath();
    g.ellipse(1, -9.6, 1.2, 0.7, -0.4, 0, Math.PI * 2);
    g.fill();
    g.restore();
  }

  // Wie lange der Sauerstoff noch reicht – und wie viele Punkte der nächste
  // Sprung noch bringt: ein feiner Ring um den Astronauten, immer da, der
  // kürzer wird und von Grün über Orange nach Rot wechselt. Am Schluss
  // pulsiert er.
  function zeichneLuft() {
    if (state.schritt !== "lauf" || state.phase !== "spiel") return;
    const a = state.astro;
    const k = clamp(state.luft / state.luftMax, 0, 1);
    weltTransform();
    const puls = k < 0.2 && !ruhig() ? 0.25 * (1 + Math.sin(state.zeit * 12)) : 0;
    g.lineCap = "round";
    g.strokeStyle = "rgba(255, 255, 255, 0.12)";
    g.lineWidth = 1.6 / Math.max(0.6, view.s) * 1.4;
    g.beginPath();
    g.arc(a.x, a.y, 18, 0, Math.PI * 2);
    g.stroke();
    g.strokeStyle = luftFarbe(k, 0.6 + puls);
    g.lineWidth = 2.2 / Math.max(0.6, view.s) * 1.4;
    g.beginPath();
    g.arc(a.x, a.y, 18, Math.PI / 2, Math.PI / 2 + Math.PI * 2 * k);
    g.stroke();
  }

  function zeichneTeile() {
    if (!state.teile.length) return;
    weltTransform();
    state.teile.forEach((t) => {
      const k = clamp(t.leben / t.max, 0, 1);
      g.globalAlpha = t.art === "staub" ? k * 0.5 : k;
      g.fillStyle = t.farbe;
      g.beginPath();
      g.arc(t.x, t.y, t.r * (t.art === "staub" ? 2 - k : 0.5 + k * 0.5), 0, Math.PI * 2);
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
      g.strokeStyle = "rgba(5, 6, 26, 0.75)";
      g.strokeText(s.text, bildX(s.x), bildY(s.y) - steig);
      g.fillStyle = s.farbe;
      g.fillText(s.text, bildX(s.x), bildY(s.y) - steig);
    });
    g.globalAlpha = 1;
  }

  // Oben links die Planeten, darunter der Sauerstoff als Balken.
  function zeichneAnzeige() {
    if (state.schritt === "start") return;
    bildTransform();
    const gross = clamp(view.cssH * 0.05, 14, 24);
    g.font = `900 ${Math.round(gross)}px system-ui, sans-serif`;
    g.textAlign = "left";
    g.textBaseline = "middle";
    // Die Punkte, und daneben klein die erreichten Planeten.
    const text = String(state.punkte);
    const textW = g.measureText(text).width;
    const klein = Math.round(gross * 0.62);
    g.font = `800 ${klein}px system-ui, sans-serif`;
    const zahl = String(state.erreicht);
    const zahlW = g.measureText(zahl).width;
    const w = gross * 0.6 + textW + gross * 1.5 + zahlW + gross * 0.6;
    const x = 12;
    const y = 12;
    g.fillStyle = "rgba(5, 6, 26, 0.55)";
    g.beginPath();
    if (g.roundRect) g.roundRect(x, y, w, gross * 1.6, gross * 0.8);
    else g.rect(x, y, w, gross * 1.6);
    g.fill();
    g.font = `900 ${Math.round(gross)}px system-ui, sans-serif`;
    g.fillStyle = "#ffffff";
    g.fillText(text, x + gross * 0.6, y + gross * 0.84);
    // Ein kleiner Planet mit Ring vor der Zahl der Planeten.
    const px = x + gross * 0.6 + textW + gross * 0.75;
    const py = y + gross * 0.8;
    const pk = g.createRadialGradient(px - 2, py - 2, 1, px, py, gross * 0.3);
    pk.addColorStop(0, "#ffe2a8");
    pk.addColorStop(1, "#c4703a");
    g.fillStyle = pk;
    g.beginPath();
    g.arc(px, py, gross * 0.28, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = "rgba(255, 236, 200, 0.85)";
    g.lineWidth = 1.3;
    g.beginPath();
    g.ellipse(px, py, gross * 0.48, gross * 0.13, -0.4, 0, Math.PI * 2);
    g.stroke();
    g.font = `800 ${klein}px system-ui, sans-serif`;
    g.fillStyle = "rgba(255,255,255,0.85)";
    g.fillText(zahl, px + gross * 0.62, y + gross * 0.86);

    // Der Sauerstoff.
    const bw = Math.max(w, 86);
    const by = y + gross * 1.6 + 6;
    const k = clamp(state.luft / state.luftMax, 0, 1);
    g.fillStyle = "rgba(5, 6, 26, 0.55)";
    g.beginPath();
    if (g.roundRect) g.roundRect(x, by, bw, 8, 4);
    else g.rect(x, by, bw, 8);
    g.fill();
    g.fillStyle = luftFarbe(k);
    g.beginPath();
    if (g.roundRect) g.roundRect(x + 1.5, by + 1.5, Math.max(0, (bw - 3) * k), 5, 2.5);
    else g.rect(x + 1.5, by + 1.5, Math.max(0, (bw - 3) * k), 5);
    g.fill();
    // Daneben, was ein Sprung jetzt noch bringt.
    if (state.schritt === "lauf") {
      const jetzt = Math.round(PUNKTE_MIN + (PUNKTE_MAX - PUNKTE_MIN) * k);
      g.font = `800 ${Math.round(gross * 0.6)}px system-ui, sans-serif`;
      g.textAlign = "left";
      g.textBaseline = "middle";
      g.fillStyle = luftFarbe(k, 0.95);
      g.fillText(`+${jetzt}`, x + bw + 8, by + 4);
    }
  }

  function zeichnen() {
    if (!g) return;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, canvas.width, canvas.height);
    zeichneHimmel();
    weltTransform();
    const von = Math.max(0, state.auf - 3);
    planetenBis(state.auf + 6);
    for (let i = von; i < Math.min(state.planeten.length, state.auf + 7); i += 1) {
      weltTransform();
      zeichnePlanet(state.planeten[i]);
    }
    zeichneSpur();
    zeichneTeile();
    zeichneGeister();
    zeichneLuft();
    zeichneAstronaut();
    zeichneSchriften();
    zeichneAnzeige();
  }

  // ---------------------------------------------------------------------------
  // Teilchen und Schriften
  // ---------------------------------------------------------------------------
  function staub(x, y, farbe, anzahl) {
    if (ruhig()) anzahl = Math.ceil(anzahl / 3);
    for (let i = 0; i < anzahl; i += 1) {
      const w = Math.random() * Math.PI * 2;
      const v = 30 + Math.random() * 90;
      state.teile.push({
        art: i % 3 ? "funke" : "staub", x, y, vx: Math.cos(w) * v, vy: Math.sin(w) * v,
        r: 1 + Math.random() * 1.8, farbe: i % 3 ? farbe : "#ffffff", leben: 0.5 + Math.random() * 0.5, max: 1,
      });
    }
  }

  function schrift(text, x, y, farbe, gross) {
    state.schriften.push({ text, x, y, farbe, gross, leben: 1.15, max: 1.15 });
  }

  // ---------------------------------------------------------------------------
  // Der Lauf
  // ---------------------------------------------------------------------------
  // Wohin er springen würde: senkrecht vom Planeten weg, dorthin, wohin
  // sein Kopf zeigt.
  function absprung() {
    return { x: Math.cos(state.theta), y: Math.sin(state.theta) };
  }

  function stellePosition() {
    const p = state.planeten[state.auf];
    const m = mitte(p);
    const r = p.r + state.hoehe;
    state.astro.x = m.x + Math.cos(state.theta) * r;
    state.astro.y = m.y + Math.sin(state.theta) * r;
    state.astro.w = state.theta;
  }

  function springen() {
    if (state.schritt !== "lauf") return;
    const t = absprung();
    const v = sprungBei(state.erreicht);
    // Genau dorthin, wohin sein Kopf zeigt – auch von einem Planeten, der
    // wandert. Dessen Schwung käme sonst dazu, und man flöge anderswohin,
    // als man zielt.
    state.astro.vx = t.x * v;
    state.astro.vy = t.y * v;
    state.verlassen = state.auf;
    state.sprungLuft = clamp(state.luft / state.luftMax, 0, 1);
    state.flugZeit = 0;
    state.schritt = "flug";
    state.schrittZeit = state.zeit;
    state.spur = [];
    staub(state.astro.x - Math.cos(state.theta) * 4, state.astro.y - Math.sin(state.theta) * 4, "#e9ecff", 8);
    kids()?.playJingle?.("tap");
  }

  function landen(p, m) {
    const a = state.astro;
    const rx = a.x - m.x;
    const ry = a.y - m.y;
    const d = Math.hypot(rx, ry) || 1;
    // Wie dicht an der Mitte er vorbeigeflogen wäre: so sieht man, ob er
    // voll getroffen hat.
    const v = Math.hypot(a.vx, a.vy) || 1;
    const vorbei = Math.abs(rx * a.vy - ry * a.vx) / v;
    const kreuz = rx * a.vy - ry * a.vx;
    state.auf = p.n;
    state.theta = Math.atan2(ry, rx);
    state.richtung = kreuz >= 0 ? 1 : -1;
    state.hoehe = d - p.r;
    state.schritt = "lauf";
    state.schrittZeit = state.zeit;
    state.luftMax = luftBei(p.n);
    state.luft = state.luftMax;
    state.spur = [];
    staub(m.x + (rx / d) * p.r, m.y + (ry / d) * p.r, p.art.fleck2, 16);
    kids()?.vibrate?.(12);
    if (!state.besucht.has(p.n)) {
      state.besucht.add(p.n);
      state.erreicht = state.besucht.size;
      const plus = Math.round(PUNKTE_MIN + (PUNKTE_MAX - PUNKTE_MIN) * state.sprungLuft);
      state.punkte += plus;
      shell.setCount(state.punkte);
      schrift(`+${plus}`, a.x, a.y + 62, luftFarbe(state.sprungLuft), 17);
      if (vorbei < p.r * 0.35) {
        state.volltreffer += 1;
        schrift("Volltreffer!", a.x, a.y + 26, "#ffe08a", 16);
        kids()?.playJingle?.("star");
      } else {
        kids()?.playJingle?.("tap");
      }
      if (state.erreicht % 10 === 0) schrift(`${state.erreicht} Planeten!`, a.x, a.y + 44, "#9fe8ff", 18);
    }
    planetenBis(state.auf + 6);
  }

  function verloren(grund) {
    if (state.schritt === "verloren") return;
    state.schritt = "verloren";
    state.grund = grund;
    state.schrittZeit = state.zeit;
    if (grund === "mond") {
      state.stoss = 1;
      staub(state.astro.x, state.astro.y, "#ffd166", 26);
      state.astro.vx *= -0.3;
      state.astro.vy *= -0.3;
    }
    if (grund === "luft") {
      state.astro.vx = Math.cos(state.theta) * 40;
      state.astro.vy = Math.sin(state.theta) * 40;
      schrift("Kein Sauerstoff mehr!", state.astro.x, state.astro.y + 30, "#ff8c8c", 15);
    }
    kids()?.playJingle?.("retry");
    kids()?.vibrate?.([30, 40, 60]);
    stepTimer = window.setTimeout(finish, grund === "all" ? 900 : 1500);
  }

  function physik(dt) {
    state.uhr += dt;
    if (state.schritt === "lauf") {
      state.theta += state.richtung * drehBei(state.erreicht) * dt;
      state.hoehe += (HOEHE - state.hoehe) * (1 - Math.exp(-dt * 12));
      stellePosition();
      if (state.phase === "spiel") {
        state.luft -= dt;
        if (state.luft <= 0) verloren("luft");
      }
      return;
    }
    if (state.schritt === "flug") {
      const a = state.astro;
      a.x += a.vx * dt;
      a.y += a.vy * dt;
      state.flugZeit += dt;
      // Er fliegt mit dem Kopf voran los und dreht sich vor dem nächsten
      // Planeten um, damit er auf den Füssen landet.
      const ziel = state.planeten[Math.min(state.planeten.length - 1, state.auf + 1)];
      const zm = mitte(ziel);
      const nah = Math.hypot(a.x - zm.x, a.y - zm.y) - ziel.r - ziel.luft;
      if (state.flugZeit > 0.12 && nah < 90) {
        const soll = Math.atan2(a.y - zm.y, a.x - zm.x);
        const diff = Math.atan2(Math.sin(soll - a.w), Math.cos(soll - a.w));
        a.w += diff * (1 - Math.exp(-dt * 9));
      }
      const von = Math.max(0, state.auf - 2);
      const bis = Math.min(state.planeten.length - 1, state.auf + 5);
      for (let i = von; i <= bis; i += 1) {
        const p = state.planeten[i];
        // Den eben verlassenen Planeten lässt er erst einmal hinter sich.
        if (i === state.verlassen && state.flugZeit < 0.45) continue;
        const m = mitte(p);
        if (Math.hypot(a.x - m.x, a.y - m.y) < p.r + p.luft) { landen(p, m); return; }
        const mond = mondBei(p);
        if (mond && Math.hypot(a.x - mond.x, a.y - mond.y) < mond.r + 4) { verloren("mond"); return; }
      }
      // Zu weit weg von allem: Er treibt ins All.
      const naechster = state.planeten[Math.min(state.planeten.length - 1, state.auf + 1)];
      const m = mitte(naechster);
      const weg = Math.hypot(a.x - m.x, a.y - m.y);
      if (state.flugZeit > 0.5 && !imBild(a.x, a.y, 30) && weg > reichweite(naechster) + 60) verloren("all");
      else if (state.flugZeit > 2.4) verloren("all");
      return;
    }
    if (state.schritt === "verloren") {
      const a = state.astro;
      a.x += a.vx * dt;
      a.y += a.vy * dt;
      a.w += dt * 2.4;
    }
  }

  function takt(dt) {
    state.zeit += dt;
    if (state.stoss > 0) state.stoss = Math.max(0, state.stoss - dt * 2.4);

    if (state.phase === "zuschauen") {
      zuschauenTakt(dt);
    } else if (state.schritt === "start") {
      // Im Live-Modus läuft die Uhr der Planeten nach der Uhr des Abends: Beim
      // gemeinsamen Start steht sie auf jedem Gerät auf null – sonst stünden
      // die Planeten dort, wo sie seit dem Laden der Seite hingewandert sind.
      const live = shell.live ? window.LernappLiveSpiel : null;
      state.uhr = live ? live.zeit() / 1000 : state.uhr + dt;
      // Vor dem ersten Tipp steht er oben auf dem Planeten und wippt.
      state.theta = Math.PI / 2;
      state.hoehe = HOEHE + (ruhig() ? 0 : Math.abs(Math.sin(state.zeit * 3)) * 2);
      stellePosition();
    } else {
      const n = Math.max(1, Math.ceil(dt / TAKT));
      for (let i = 0; i < n; i += 1) physik(dt / n);
    }

    if (state.schritt === "flug") {
      state.spur.push({ x: state.astro.x, y: state.astro.y });
      if (state.spur.length > 28) state.spur.shift();
    } else if (state.spur.length) {
      state.spur.shift();
    }

    for (let i = state.teile.length - 1; i >= 0; i -= 1) {
      const t = state.teile[i];
      t.vx *= 1 - 2 * dt;
      t.vy *= 1 - 2 * dt;
      t.x += t.vx * dt;
      t.y += t.vy * dt;
      t.leben -= dt;
      if (t.leben <= 0) state.teile.splice(i, 1);
    }
    for (let i = state.schriften.length - 1; i >= 0; i -= 1) {
      state.schriften[i].leben -= dt;
      if (state.schriften[i].leben <= 0) state.schriften.splice(i, 1);
    }

    // Die Kamera: Sie zeigt den Planeten, auf dem er steht (oder ihn selbst
    // im Flug), und den nächsten mit seiner ganzen Lufthülle – und zoomt
    // dafür heraus, wenn der Abstand es verlangt. Näher heran als die
    // Grundgrösse geht sie nie.
    planetenBis(state.auf + 6);
    const a = state.astro;
    const k = state.schritt === "start" && state.zeit < 0.05 ? 1 : 1 - Math.exp(-dt * 3.6);
    if (state.schritt === "verloren") {
      state.camX += (a.x - state.camX) * k;
      state.camY += (a.y - state.camY) * k;
    } else {
      const box = { x0: a.x - 26, x1: a.x + 26, y0: a.y - 26, y1: a.y + 26 };
      const dazu = (x, y, r) => {
        box.x0 = Math.min(box.x0, x - r);
        box.x1 = Math.max(box.x1, x + r);
        box.y0 = Math.min(box.y0, y - r);
        box.y1 = Math.max(box.y1, y + r);
      };
      const hier = state.planeten[state.auf];
      const naechster = state.planeten[state.auf + 1];
      if (state.schritt !== "flug") { const m = mitte(hier); dazu(m.x, m.y, hier.r + 18); }
      const m = mitte(naechster);
      dazu(m.x, m.y, naechster.r + naechster.luft + 14);
      // Oben bleibt Platz für die Anzeige.
      const breit = (box.x1 - box.x0) * 1.08;
      const hoch = (box.y1 - box.y0) * 1.12 + 70;
      const zoomZiel = clamp(Math.min(view.cssW / (breit * view.grund), view.cssH / (hoch * view.grund)), 0.5, 1);
      view.zoom += (zoomZiel - view.zoom) * k;
      skaliere();
      const mx = (box.x0 + box.x1) / 2;
      const my = (box.y0 + box.y1) / 2 + 18;
      state.camX += (mx - state.camX) * k;
      state.camY += (my - state.camY) * k;
    }

    if (state.phase === "spiel") {
      gegner?.takt(state.punkte, { a: Math.round(state.astro.x), b: Math.round(state.astro.y), c: Math.round(state.astro.w * 100) });
    }
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
  // Tippen
  // ---------------------------------------------------------------------------
  // ---------------------------------------------------------------------------
  // Zuschauen
  // ---------------------------------------------------------------------------
  // Ein aufgezeichneter Lauf auf seinen eigenen Planeten: Der Zufall hält die
  // Saat (geist.js, zuschauer), startRun baut damit dieselben Planeten, die
  // Uhr beginnt, wo sie damals stand, und der Astronaut ist Bild für Bild
  // dort, wo er damals war.
  function zuschauenStarten() {
    if (!zuschauer?.lauf) return;
    startRun();
    state.phase = "zuschauen";
    state.schritt = "lauf";
    state.uhr = (zuschauer.lauf.vorlauf || 0) / 1000;
    shell.setPhase("play");
    zuschauer.los();
  }

  function zuschauenTakt(dt) {
    const s = zuschauer.stand();
    if (!s) { state.uhr += dt; return; }
    // Die Uhr der Planeten nach der Zeit des Laufs – auch wenn das Zuschauen
    // mitten in einem Live-Lauf beginnt.
    state.uhr = ((zuschauer.lauf?.vorlauf || 0) + s.t) / 1000;
    const a = state.astro;
    a.x = s.a;
    a.y = s.b;
    a.w = (s.c || 0) / 100;
    // Steht er auf einem Planeten? Dann läuft er dort – und der Planet zählt
    // als erreicht.
    let steht = -1;
    const bis = Math.min(state.planeten.length - 1, state.auf + 3);
    for (let i = Math.max(0, state.auf - 1); i <= bis; i += 1) {
      const p = state.planeten[i];
      const m = mitte(p);
      if (Math.abs(Math.hypot(a.x - m.x, a.y - m.y) - (p.r + HOEHE)) < 5) { steht = i; break; }
    }
    if (steht >= 0) {
      if (steht > state.auf) state.auf = steht;
      state.erreicht = Math.max(state.erreicht, state.auf);
      state.schritt = "lauf";
      state.theta = a.w;
      state.hoehe = HOEHE;
    } else {
      state.schritt = "flug";
    }
    const punkte = Math.max(0, Math.round(s.punkte));
    if (punkte !== state.punkte) {
      state.punkte = punkte;
      shell.setCount(punkte);
    }
    zuschauer.weiter();
  }

  function tippen() {
    if (state.phase === "ende" || state.phase === "zuschauen") return;
    if (state.phase === "bereit") {
      losGehts();
      return;
    }
    springen();
  }

  // Der erste Tipp: Er läuft los – oder im Live-Modus der gemeinsame Start
  // (game-shell.js, live.los).
  function losGehts() {
    if (state.phase !== "bereit") return;
    state.phase = "spiel";
    state.schritt = "lauf";
    state.schrittZeit = state.zeit;
    state.luftMax = luftBei(0);
    state.luft = state.luftMax;
    shell.setPhase("play");
    gegner?.los();
    kids()?.vibrate?.(8);
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
    state.sprungLuft = 1;
    state.volltreffer = 0;
    state.planeten = [];
    planetenBis(8);
    state.auf = 0;
    state.theta = Math.PI / 2;
    state.richtung = 1;
    state.hoehe = HOEHE;
    state.astro = { x: 0, y: 0, vx: 0, vy: 0, w: Math.PI / 2 };
    state.verlassen = -1;
    state.flugZeit = 0;
    state.luft = LUFT0;
    state.luftMax = LUFT0;
    state.grund = "";
    state.besucht = new Set();
    state.spur = [];
    state.teile = [];
    state.schriften = [];
    state.stoss = 0;
    state.zeit = 0;
    state.uhr = 0;
    shell.setCount(0);
    gegner?.runde();

    shell.clear();
    const prompt = shell.el("p", "cm-prompt ph-prompt", "Tippen – springen. Triff die leuchtende Hülle.");
    shell.play.append(prompt, buildPlatz());
    view.cssW = 0;
    view.cssH = 0;
    messen();
    stellePosition();
    takt(0);

    last = performance.now();
    frame = window.requestAnimationFrame(loop);
  }

  function zaehleHoch(ziel) {
    const zahl = host.querySelector(".cm-result-score");
    if (!zahl) return;
    if (ruhig() || ziel <= 1) { zahl.textContent = String(ziel); return; }
    const dauer = Math.min(800, 200 + ziel * 25);
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
    const planeten = state.erreicht === 1 ? "1 Planet" : `${state.erreicht} Planeten`;
    const treffer = state.volltreffer ? ` · ${state.volltreffer} Volltreffer` : "";
    shell.showResult({
      label: "Deine Punkte",
      points: punkte,
      detail: rekord ? `Neuer Rekord! ${planeten}` : `${planeten}${treffer}${vorher ? ` · Bestwert ${vorher}` : ""}`,
      speech: `${punkte} Punkte, ${planeten}.${rekord ? " Das ist dein neuer Rekord!" : vorher ? ` Dein Bestwert sind ${vorher} Punkte.` : ""}`,
      geist,
    });
    if (rekord) host.querySelector(".cm-result-detail")?.classList.add("ph-rekord");
    zaehleHoch(punkte);
  }

  // ---------------------------------------------------------------------------
  // Start
  // ---------------------------------------------------------------------------
  shell = shellApi.mount({
    host,
    title: "Planetenhüpfer",
    area: "gedaechtnis",
    accent: "#7C5CE6",
    accentDark: "#5a41b8",
    help: HELP,
    clock: false,
    onRestart: () => (zuschauer ? zuschauenStarten() : startRun()),
    live: { los: losGehts, stopp: () => finish(), zuschauen: (quelle) => { zuschauer = quelle; zuschauenStarten(); } },
  });
  zuschauer = window.LernappGeist?.zuschauer?.({
    host, spiel: "planetHop", fassung: "p2", zufall, nochmal: zuschauenStarten,
  }) || null;
  if (!zuschauer) {
    gegner = window.LernappGeist?.fuer?.({
      spiel: "planetHop", host, art: "tempo", fassung: "p2", alle: true, zufall, vorlauf: () => state.uhr * 1000,
    }) || null;
  }

  startRun();
  zuschauer?.laden.then((da) => { if (da) zuschauenStarten(); });

  host.addEventListener("pointerdown", (event) => {
    if (event.target.closest("button, a, input")) return;
    tippen();
  });

  const TASTEN = new Set([" ", "Enter", "ArrowUp"]);
  document.addEventListener("keydown", (event) => {
    if (!TASTEN.has(event.key)) return;
    if (document.activeElement?.tagName === "BUTTON") return;
    event.preventDefault();
    if (event.repeat) return;
    tippen();
  });

  window.addEventListener("resize", messen);
  window.addEventListener("orientationchange", messen);
  window.addEventListener("pagehide", () => { clearStep(); stopLoop(); });

  // Für die Prüfskripte.
  window.LernappPlaneten = {
    state, view, takt, tippen, planetenBis, mitte, mondBei, absprung, drehBei, sprungBei, luftBei, weiteBei,
  };
})();
