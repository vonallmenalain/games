/*
 * tunnelflug.js – Tunnelflug.
 * ---------------------------------------------------------------------------
 * Ein kleines Flugzeug fliegt durch einen Tunnel aus Fels. Wer den Finger
 * aufs Bild legt, gibt Schub, und es steigt; wer loslässt, sinkt es. Die
 * Wände darf es nie berühren – ein Streifen, und die Runde ist vorbei.
 *
 * Nach hinten wird der Tunnel enger und das Flugzeug schneller. Gezählt wird
 * nur eines: wie weit es kommt, in Metern.
 *
 * Gebaut wird der Tunnel aus dem Zufall (zufall.js): ohne Turnier jedes Mal
 * ein anderer, im Turnier für alle im selben Versuch derselbe. Er ist immer
 * fliegbar. Wie steil und wie plötzlich er die Richtung wechselt, richtet
 * sich nach dem Tempo an dieser Stelle – nie mehr, als das Flugzeug dort
 * steigen oder sinken kann. Und das Tempo hängt an der Strecke, nicht an der
 * Uhr: Wer gleich weit kommt, war gleich schnell.
 *
 * Die Gegner (geist.js) fliegen als Flugzeug aus Licht mit – genau so, wie
 * sie in ihrer besten Runde geflogen sind, durch ihren eigenen Tunnel. Platz
 * 1 und die eigene Bestmarke stehen dazu als Tor bei ihren Metern; wer
 * hindurchfliegt, hat sie geschlagen. Und die besten Flüge lassen sich
 * anschauen (?zuschauen=, geist.js): durch ihren eigenen Tunnel, gewürfelt
 * mit derselben Saat.
 *
 * Gezeichnet wird auf eine Leinwand, gerechnet in Welteinheiten – zehn sind
 * ein Meter, y zählt nach oben. Der Tunnel liegt immer im Band zwischen 0
 * und BAND; im Querformat füllt das Band die Höhe, im Hochformat steht
 * darüber und darunter mehr Fels.
 */
(() => {
  "use strict";

  if (document.body.dataset.page !== "tunnel") return;

  const host = document.querySelector("#tf-stage");
  const shellApi = window.LernappGameShell;
  const cloudApi = window.LernappGameCloud;
  if (!host || !shellApi) return;

  const kids = () => window.LernappKids || null;
  const ruhig = () => Boolean(kids()?.prefersReducedMotion?.());

  // Der Zufall. Ohne Turnier in der Adresse ist das Math.random; in einem
  // Turnier bekommt jeder im selben Versuch denselben Tunnel. Nur der Tunnel
  // zieht daraus – Funken, Rauch und Sterne würfeln Math.random oder hängen
  // an einer festen Zahl, damit der Tunnel nicht davon abhängt, wie jemand
  // fliegt.
  const zufall = window.LernappZufall?.fuer?.("tunnelFlight") || {
    neu() {},
    zahl: () => Math.random(),
  };

  // ---------------------------------------------------------------------------
  // Die Welt
  // ---------------------------------------------------------------------------
  const WELT_W = 300;
  const WELT_W_MAX = 640;
  const SICHT_H = 300;
  const BAND = 300;                // der Tunnel liegt zwischen 0 und BAND
  const RAND = 14;                 // so nah kommt keine Wand an den Rand des Bandes
  const METER = 10;
  const SEG = 22;                  // Abstand der Stützpunkte der Wände
  const VORLAUF = 160;             // so viel Tunnel liegt hinter dem Start
  const START = { x: 0, y: BAND / 2 };
  const FLIEGER_AN = 0.24;         // so weit vom linken Rand fliegt das Flugzeug

  // Der Flug. Halten gibt Schub nach oben, Loslassen lässt fallen – beides
  // gleich kräftig, damit Steigen und Sinken sich gleich anfühlen.
  const G = 560;
  const SCHUB = 1180;
  const VY_MAX = 300;
  const KANN = Math.min(G, SCHUB - G);   // so stark lenkt das Flugzeug um, in beide Richtungen
  const TAKT = 1 / 240;            // gerechnet wird in festen kleinen Schritten

  // Tempo und Weite, beide nach der Strecke. Am Anfang breit und gemächlich,
  // nach einem Kilometer eng und schnell, nach zwei Kilometern fast so eng,
  // wie es geht.
  const V0 = 120;
  const V_MAX = 360;
  const V_WEG = 700;               // Meter, nach denen gut sechs Zehntel des Zuwachses da sind
  const WEIT0 = 200;
  const WEIT_MIN = 56;
  const WEIT_WEG = 560;
  const DURCHLASS_MIN = 50;        // enger wird es nirgends, auch nicht an einer Felsnase
  const NASEN_AB = 600;            // erst ab hier ragt Fels in den Weg
  const GERADE_BIS = 320;          // bis hier geht es geradeaus

  // Das Flugzeug, wie es getroffen wird: Punkte auf seinem Umriss, vorne die
  // Nase, hinten oben das Leitwerk. Dieselben Masse zeichnet zeichneFlieger.
  const UMRISS = [
    { x: 14, y: 0 }, { x: 9, y: 3.5 }, { x: 3, y: 6.2 }, { x: 3, y: -4.6 },
    { x: -6, y: -3.6 }, { x: -12, y: 1 }, { x: -9.5, y: 8.5 }, { x: -5, y: 4 },
  ];

  const HELP = [
    "Tunnelflug. Halte den Finger auf dem Bild, dann gibt das Flugzeug Schub und steigt.",
    "Lass los, dann sinkt es. So fliegst du durch den Tunnel – berühr nie die Wände.",
    "Der Tunnel wird immer enger und das Flugzeug immer schneller. Es zählt, wie weit du kommst, in Metern.",
  ].join(" ");

  const TOP_COUNT = 5;
  const store = cloudApi
    ? cloudApi.register({ key: "lernapp.tunnelflug", empty: { runs: 0, scores: [] }, merge: cloudApi.mergeScores(TOP_COUNT) })
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
  const meterBei = (x) => Math.max(0, (x - START.x) / METER);
  const tempoBei = (x) => V0 + (V_MAX - V0) * (1 - Math.exp(-meterBei(x) / V_WEG));
  const weiteBei = (x) => WEIT_MIN + (WEIT0 - WEIT_MIN) * Math.exp(-meterBei(x) / WEIT_WEG);
  // Wie viel vom Können des Flugzeugs der Tunnel an dieser Stelle verlangt:
  // anfangs wenig, nach hinten immer mehr – nie alles.
  const schwereBei = (x) => 1 - Math.exp(-meterBei(x) / 650);

  // Immer dieselbe Zahl zu derselben Eingabe: Sterne und Kristalle stehen bei
  // jedem Bild am selben Platz, ohne den Zufall des Tunnels anzufassen.
  function hash01(n) {
    const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return x - Math.floor(x);
  }

  // ---------------------------------------------------------------------------
  // Zustand
  // ---------------------------------------------------------------------------
  // phase:   "bereit" (noch nichts gedrückt), "spiel", "ende"
  // schritt: "start", "flug", "crash"
  const state = {
    phase: "bereit",
    schritt: "start",
    punkte: 0,            // dasselbe wie meter – die Strecke ist die Punktzahl
    meter: 0,
    spitze: 0,            // das höchste Tempo der Runde, in Einheiten je Sekunde
    f: { x: START.x, y: START.y, vy: 0 },
    neig: 0,
    camX: 0,
    camY: 0,
    tunnel: { punkte: [], abschnitt: null, nase: null },
    spur: [],
    teile: [],
    schriften: [],
    striche: [],
    stoss: 0,
    zeit: 0,
    crashZeit: 0,
    propeller: 0,
  };

  let shell = null;
  let feld = null;
  let canvas = null;
  let g = null;
  let frame = null;
  let last = 0;
  let stepTimer = null;
  let gedrueckt = false;
  // Die Gegner (geist.js): wer als Geist mitfliegt und als Tor im Tunnel steht.
  let gegner = null;
  // Wer einen Flug anschaut statt zu fliegen (geist.js, zuschauer).
  let zuschauer = null;

  const view = { s: 1, dpr: 1, cssW: 0, cssH: 0, w: WELT_W, h: SICHT_H };

  function clearStep() {
    if (stepTimer) { window.clearTimeout(stepTimer); stepTimer = null; }
  }

  function stopLoop() {
    if (frame) { window.cancelAnimationFrame(frame); frame = null; }
  }

  // ---------------------------------------------------------------------------
  // Der Tunnel
  // ---------------------------------------------------------------------------
  /*
   * Die Wände sind Stützpunkte im Abstand SEG, oben und unten, dazwischen
   * gerade Linien – gezeichnet wie getroffen. Die Mitte des Tunnels wandert
   * in Abschnitten von einer Höhe zur nächsten, sanft wie eine Kosinuskurve.
   * Wie lang ein Abschnitt sein muss, folgt aus dem Tempo dort: Die Kurve
   * darf nie steiler sein, als das Flugzeug steigen kann, und nie
   * plötzlicher, als es umlenken kann. Dazu kommen Felsnasen, die von oben
   * oder unten in den Weg ragen – auch sie so lang, dass man um sie herum
   * kommt – und ein wenig Rauheit, damit Fels nach Fels aussieht.
   */
  function neuerAbschnitt(x) {
    const t = state.tunnel;
    const c0 = t.abschnitt ? t.abschnitt.c1 : START.y;
    if (x < GERADE_BIS) {
      t.abschnitt = { x0: x, L: GERADE_BIS - x + SEG, c0, c1: c0 };
      return;
    }
    const weite = weiteBei(x);
    const k = schwereBei(x);
    const v = tempoBei(x);
    const umlenken = KANN * lerp(0.22, 0.55, k);
    const steil = (VY_MAX / v) * lerp(0.35, 0.7, k);
    const lo = RAND + weite / 2 + 4;
    const hi = BAND - RAND - weite / 2 - 4;

    // Eine Felsnase kommt nur in einem geraden Abschnitt: Kurve und Nase
    // zugleich verlangten mehr, als das Flugzeug kann.
    if (x >= NASEN_AB && zufall.zahl() < lerp(0.18, 0.42, k)) {
      const tiefe = Math.max(0, weite - DURCHLASS_MIN) * lerp(0.45, 0.85, k) * lerp(0.7, 1, zufall.zahl());
      const L = Math.max(120, Math.PI * v * Math.sqrt(tiefe / umlenken), (Math.PI * tiefe) / (2 * steil));
      const seite = zufall.zahl() < 0.5 ? 1 : -1;
      t.nase = { x0: x + L * 0.2, L, seite, tiefe };
      t.abschnitt = { x0: x, L: L * 1.4, c0, c1: c0 };
      return;
    }

    const gerade = zufall.zahl() < lerp(0.3, 0.1, k);
    const c1 = gerade ? clamp(c0, lo, hi) : lerp(lo, hi, zufall.zahl());
    const d = Math.abs(c1 - c0);
    const L = Math.max(lerp(260, 150, k), Math.PI * v * Math.sqrt(d / (2 * umlenken)), (Math.PI / 2) * d / steil);
    t.abschnitt = { x0: x, L, c0, c1 };
  }

  function naechsterPunkt() {
    const t = state.tunnel;
    const i = t.punkte.length;
    const x = i * SEG - VORLAUF;
    if (!t.abschnitt || x >= t.abschnitt.x0 + t.abschnitt.L) neuerAbschnitt(x);
    const a = t.abschnitt;
    const u = clamp((x - a.x0) / a.L, 0, 1);
    const mitte = a.c0 + (a.c1 - a.c0) * (1 - Math.cos(Math.PI * u)) / 2;
    const weite = weiteBei(x);
    let oben = mitte + weite / 2;
    let unten = mitte - weite / 2;

    if (t.nase) {
      const n = t.nase;
      const w = (x - n.x0) / n.L;
      if (w >= 0 && w <= 1) {
        const ragt = n.tiefe * (1 - Math.cos(Math.PI * 2 * w)) / 2;
        if (n.seite > 0) oben -= ragt;
        else unten += ragt;
      } else if (w > 1) {
        t.nase = null;
      }
    }

    // Rauheit: ein paar Einheiten, nach hinten etwas mehr. Ab dem Ende der
    // geraden Einflugschneise.
    if (x > GERADE_BIS) {
      const rauh = lerp(2, 6, schwereBei(x));
      oben -= rauh * zufall.zahl();
      unten += rauh * zufall.zahl();
    }

    // Nie enger als der Durchlass, nie aus dem Band hinaus.
    if (oben - unten < DURCHLASS_MIN) {
      const fehlt = DURCHLASS_MIN - (oben - unten);
      oben += fehlt / 2;
      unten -= fehlt / 2;
    }
    if (oben > BAND - RAND) { unten -= oben - (BAND - RAND); oben = BAND - RAND; }
    if (unten < RAND) { oben += RAND - unten; unten = RAND; }

    t.punkte.push({ x, oben, unten, deko: hash01(i * 2.17 + 0.5) });
  }

  function tunnelBis(x) {
    const t = state.tunnel;
    while (!t.punkte.length || t.punkte[t.punkte.length - 1].x < x) naechsterPunkt();
  }

  // Die Wände an einer beliebigen Stelle: zwischen zwei Stützpunkten gerade.
  function wandBei(x) {
    const t = state.tunnel;
    tunnelBis(x + SEG);
    const k = (x + VORLAUF) / SEG;
    const i = clamp(Math.floor(k), 0, t.punkte.length - 2);
    const u = clamp(k - i, 0, 1);
    const a = t.punkte[i];
    const b = t.punkte[i + 1];
    return { oben: lerp(a.oben, b.oben, u), unten: lerp(a.unten, b.unten, u) };
  }

  // Berührt das Flugzeug eine Wand? Geprüft werden die Punkte seines
  // Umrisses, gedreht wie das Flugzeug gerade liegt.
  function beruehrt() {
    const f = state.f;
    const c = Math.cos(state.neig);
    const s = Math.sin(state.neig);
    return UMRISS.some((p) => {
      const x = f.x + p.x * c - p.y * s;
      const y = f.y + p.x * s + p.y * c;
      const w = wandBei(x);
      return y >= w.oben || y <= w.unten;
    });
  }

  // ---------------------------------------------------------------------------
  // Die Fläche
  // ---------------------------------------------------------------------------
  function buildPlatz() {
    const platz = shell.el("div", "tf-platz");
    feld = shell.el("div", "tf-feld");
    canvas = document.createElement("canvas");
    canvas.className = "tf-canvas";
    canvas.setAttribute("aria-hidden", "true");
    feld.append(canvas);
    g = canvas.getContext("2d");

    // Der Hinweis vor dem ersten Druck: ein Ring, der sich füllt – halten,
    // nicht tippen.
    const tipp = shell.el("span", "tf-tipp");
    tipp.setAttribute("aria-hidden", "true");
    const ns = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(ns, "svg");
    svg.setAttribute("viewBox", "0 0 64 64");
    [
      { r: 22, stroke: "rgba(255,255,255,0.45)", w: 5 },
      { r: 22, stroke: "#ffffff", w: 5, klasse: "tf-tipp-fuell" },
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
    if (cssW === view.cssW && cssH === view.cssH && dpr === view.dpr) return;
    view.cssW = cssW;
    view.cssH = cssH;
    view.dpr = dpr;
    view.w = clamp(SICHT_H * (cssW / cssH), WELT_W, WELT_W_MAX);
    view.s = cssW / view.w;
    view.h = cssH / view.s;
    const pw = Math.round(cssW * dpr);
    const ph = Math.round(cssH * dpr);
    if (canvas.width !== pw) canvas.width = pw;
    if (canvas.height !== ph) canvas.height = ph;
    // Das Band steht in der Mitte; ist das Bild höher, ist darüber und
    // darunter Fels.
    state.camY = (BAND - view.h) / 2;
  }

  const camXZiel = () => state.f.x - view.w * FLIEGER_AN;

  const wackel = () => (ruhig() ? 0 : Math.sin(state.zeit * 70) * 3 * state.stoss);

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
  // Zeichnen
  // ---------------------------------------------------------------------------
  // Der Himmel hinter dem Tunnel: tiefes Blau, zwei Nebel und drei Lagen
  // Sterne, die verschieden schnell vorbeiziehen.
  const STERNE = Array.from({ length: 90 }, (_, i) => ({
    x: hash01(i * 3.1 + 1), y: hash01(i * 5.7 + 2), r: 0.5 + hash01(i * 7.3 + 3) * 1.3, lage: i % 3,
  }));
  const LAGE_TEMPO = [0.06, 0.14, 0.28];

  function zeichneHimmel() {
    bildTransform();
    const W = view.cssW;
    const H = view.cssH;
    const verlauf = g.createLinearGradient(0, 0, 0, H);
    verlauf.addColorStop(0, "#070b24");
    verlauf.addColorStop(0.55, "#141245");
    verlauf.addColorStop(1, "#24124a");
    g.fillStyle = verlauf;
    g.fillRect(0, -10, W, H + 20);

    const nebel = (fx, fy, r, farbe, tempo) => {
      const breite = W + r * 2;
      const x = ((fx * breite - state.camX * view.s * tempo) % breite + breite) % breite - r;
      const n = g.createRadialGradient(x, fy * H, 0, x, fy * H, r);
      n.addColorStop(0, farbe);
      n.addColorStop(1, "rgba(0,0,0,0)");
      g.fillStyle = n;
      g.fillRect(x - r, fy * H - r, r * 2, r * 2);
    };
    nebel(0.3, 0.35, H * 0.7, "rgba(120, 60, 200, 0.22)", 0.03);
    nebel(0.85, 0.7, H * 0.55, "rgba(0, 165, 181, 0.16)", 0.05);

    g.fillStyle = "#ffffff";
    STERNE.forEach((s) => {
      const breite = W + 20;
      const x = ((s.x * breite - state.camX * view.s * LAGE_TEMPO[s.lage]) % breite + breite) % breite - 10;
      g.globalAlpha = 0.35 + s.lage * 0.22;
      g.beginPath();
      g.arc(x, s.y * H, s.r * (0.7 + s.lage * 0.25), 0, Math.PI * 2);
      g.fill();
    });
    g.globalAlpha = 1;
  }

  // Der Fels oben und unten, mit einer leuchtenden Kante zum Tunnel hin und
  // Kristallen, die im Fels stecken – nicht in den Weg hinein.
  function zeichneWaende() {
    const t = state.tunnel;
    const von = state.camX - SEG * 2;
    const bis = state.camX + view.w + SEG * 2;
    tunnelBis(bis);
    const i0 = clamp(Math.floor((von + VORLAUF) / SEG), 0, t.punkte.length - 1);
    const i1 = clamp(Math.ceil((bis + VORLAUF) / SEG), 0, t.punkte.length - 1);
    const sicht = t.punkte.slice(i0, i1 + 1);
    if (sicht.length < 2) return;
    const deckel = state.camY + view.h + 20;
    const boden = state.camY - 20;

    weltTransform();
    const fels = (welche, aussen) => {
      g.beginPath();
      g.moveTo(sicht[0].x, aussen);
      sicht.forEach((p) => g.lineTo(p.x, p[welche]));
      g.lineTo(sicht[sicht.length - 1].x, aussen);
      g.closePath();
    };

    // Der Fels: heller an der Kante, dunkler nach aussen – deutlich anders
    // als der Himmel dahinter, damit man sieht, wo es eng wird.
    const obenVerlauf = g.createLinearGradient(0, BAND / 2 + 30, 0, BAND + 40);
    obenVerlauf.addColorStop(0, "#5a3f8f");
    obenVerlauf.addColorStop(1, "#21143f");
    g.fillStyle = obenVerlauf;
    fels("oben", deckel);
    g.fill();

    const untenVerlauf = g.createLinearGradient(0, BAND / 2 - 30, 0, -40);
    untenVerlauf.addColorStop(0, "#5a3f8f");
    untenVerlauf.addColorStop(1, "#21143f");
    g.fillStyle = untenVerlauf;
    fels("unten", boden);
    g.fill();

    // Struktur im Fels: dunkle und helle Flecken, fest an ihrem Ort in der
    // Welt, und hier und da eine Gruppe Kristalle. Alles mit Abstand zur
    // Kante – in den Weg ragt nichts, was nicht auch trifft.
    sicht.forEach((p, n) => {
      const i = n + i0;
      [["oben", 1], ["unten", -1]].forEach(([welche, richtung], seite) => {
        const h = (k) => hash01(i * 7.13 + seite * 31.7 + k * 1.91);
        for (let k = 0; k < 2; k += 1) {
          const r = 3 + h(k) * 7;
          const tief = r + 9 + h(k + 4) * 50;
          g.fillStyle = h(k + 8) < 0.6 ? "rgba(18, 8, 40, 0.35)" : "rgba(150, 120, 220, 0.16)";
          g.beginPath();
          g.ellipse(p.x + (h(k + 2) - 0.5) * SEG, p[welche] + richtung * tief, r * 1.5, r, 0, 0, Math.PI * 2);
          g.fill();
        }
        if (h(12) > 0.1) return;
        // Ein Kristall: drei schmale Rauten, aus einem Punkt im Fels nach
        // aussen gefächert.
        const tief = 16 + h(13) * 18;
        const fx = p.x;
        const fy = p[welche] + richtung * tief;
        const farbe = h(14) < 0.55 ? "rgba(127, 243, 255, 0.8)" : "rgba(214, 160, 255, 0.75)";
        [-0.55, 0, 0.5].forEach((w, j) => {
          const lang = 9 + h(15 + j) * 9;
          const winkel = Math.PI / 2 * richtung + w;
          const dx = Math.cos(winkel);
          const dy = Math.sin(winkel);
          const breit = 2.4;
          g.fillStyle = farbe;
          g.beginPath();
          g.moveTo(fx, fy);
          g.lineTo(fx + dx * lang * 0.5 - dy * breit, fy + dy * lang * 0.5 + dx * breit);
          g.lineTo(fx + dx * lang, fy + dy * lang);
          g.lineTo(fx + dx * lang * 0.5 + dy * breit, fy + dy * lang * 0.5 - dx * breit);
          g.closePath();
          g.fill();
        });
      });
    });

    // Die Kante: breit und blass, darüber schmal und hell – ein Leuchten ohne
    // teuren Schatten.
    const kante = (welche) => {
      g.beginPath();
      sicht.forEach((p, i) => (i ? g.lineTo(p.x, p[welche]) : g.moveTo(p.x, p[welche])));
    };
    g.lineJoin = "round";
    ["oben", "unten"].forEach((welche) => {
      kante(welche);
      g.strokeStyle = "rgba(90, 230, 240, 0.25)";
      g.lineWidth = 6 / view.s;
      g.stroke();
      g.strokeStyle = "#7ff3ff";
      g.lineWidth = 1.6 / view.s;
      g.stroke();
    });
  }

  // Alle hundert Meter eine Marke am Boden des Tunnels.
  function zeichneMarken() {
    const von = Math.ceil(meterBei(state.camX) / 100) * 100;
    const bis = meterBei(state.camX + view.w);
    if (von > bis) return;
    bildTransform();
    const gross = Math.round(clamp(view.cssH * 0.034, 10, 15));
    g.font = `800 ${gross}px system-ui, sans-serif`;
    g.textAlign = "center";
    g.textBaseline = "top";
    for (let m = Math.max(100, von); m <= bis; m += 100) {
      const x = START.x + m * METER;
      const w = wandBei(x);
      const sx = bildX(x);
      g.strokeStyle = "rgba(127, 243, 255, 0.35)";
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(sx, bildY(w.unten) + 2);
      g.lineTo(sx, bildY(w.unten) + 10);
      g.stroke();
      g.fillStyle = "rgba(127, 243, 255, 0.75)";
      g.fillText(`${m} m`, sx, bildY(w.unten) + 12);
    }
  }

  // Die Gegner: ein Tor quer durch den Tunnel, bei ihren Metern, mit Namen.
  // Wer hindurch ist, hat sie geschlagen – dann wird das Tor blass.
  function zeichneTore() {
    const ziele = (gegner?.gegner?.() || []).filter((ziel) => ziel.art !== "alle");
    if (!ziele.length) return;
    bildTransform();
    const gross = Math.round(clamp(view.cssH * 0.034, 10, 14));
    g.font = `800 ${gross}px system-ui, sans-serif`;
    g.textAlign = "center";
    g.textBaseline = "bottom";
    ziele.forEach((ziel) => {
      const x = START.x + ziel.punkte * METER;
      if (x < state.camX - 20 || x > state.camX + view.w + 20) return;
      const w = wandBei(x);
      const sx = bildX(x);
      const geschlagen = state.punkte > ziel.punkte;
      g.globalAlpha = geschlagen ? 0.35 : 0.95;
      g.strokeStyle = ziel.farbe;
      g.lineWidth = 3;
      g.setLineDash([8, 6]);
      g.beginPath();
      g.moveTo(sx, bildY(w.oben));
      g.lineTo(sx, bildY(w.unten));
      g.stroke();
      g.setLineDash([]);
      const text = ziel.art === "eigen" ? `Bestmarke ${ziel.punkte} m` : `${ziel.name} ${ziel.punkte} m`;
      g.lineWidth = 3;
      g.strokeStyle = "rgba(7, 11, 36, 0.8)";
      g.strokeText(text, sx, bildY(w.oben) - 4 + gross * 1.4);
      g.fillStyle = ziel.farbe;
      g.fillText(text, sx, bildY(w.oben) - 4 + gross * 1.4);
    });
    g.globalAlpha = 1;
  }

  // Tempo, das man sieht: helle Striche, die durch den Tunnel ziehen – mehr
  // und länger, je schneller es geht.
  function zeichneStriche() {
    if (ruhig() || !state.striche.length) return;
    bildTransform();
    g.strokeStyle = "#ffffff";
    g.lineCap = "round";
    state.striche.forEach((s) => {
      g.globalAlpha = s.alpha;
      g.lineWidth = 1.4;
      g.beginPath();
      g.moveTo(s.x, s.y);
      g.lineTo(s.x + s.len, s.y);
      g.stroke();
    });
    g.globalAlpha = 1;
  }

  function zeichneSpur() {
    if (state.spur.length < 2) return;
    weltTransform();
    g.lineCap = "round";
    for (let i = 1; i < state.spur.length; i += 1) {
      const a = state.spur[i - 1];
      const b = state.spur[i];
      const k = i / state.spur.length;
      g.globalAlpha = k * 0.45;
      g.strokeStyle = "#fff4d6";
      g.lineWidth = 0.6 + k * 1.6;
      g.beginPath();
      g.moveTo(a.x, a.y);
      g.lineTo(b.x, b.y);
      g.stroke();
    }
    g.globalAlpha = 1;
  }

  // Das Flugzeug, von der Seite, mit der Nase nach rechts. Gezeichnet im
  // Bild, nicht in der Welt: dort zeigt y nach unten, und die Formen stehen
  // so, wie man sie liest.
  function zeichneFlieger() {
    if (state.schritt === "crash" && state.zeit - state.crashZeit > 0.35) return;
    bildTransform();
    const f = state.f;
    const s = view.s;
    g.save();
    g.translate(bildX(f.x), bildY(f.y));
    g.rotate(-state.neig);
    g.scale(s, s);

    // Leitwerk
    g.fillStyle = "#e8433a";
    g.beginPath();
    g.moveTo(-12, -1);
    g.lineTo(-9.5, -8.5);
    g.lineTo(-6, -8.5);
    g.lineTo(-4, -2);
    g.closePath();
    g.fill();

    // Rumpf
    const rumpf = g.createLinearGradient(0, -5, 0, 5);
    rumpf.addColorStop(0, "#ffffff");
    rumpf.addColorStop(1, "#c9d3e6");
    g.fillStyle = rumpf;
    g.beginPath();
    g.moveTo(-12, -1);
    g.quadraticCurveTo(-8, -4.5, 3, -4.8);
    g.quadraticCurveTo(11, -4.4, 12.5, 0);
    g.quadraticCurveTo(11, 4.2, 3, 4.6);
    g.quadraticCurveTo(-6, 4.2, -12, 1);
    g.closePath();
    g.fill();

    // Nase
    g.fillStyle = "#e8433a";
    g.beginPath();
    g.moveTo(9, -4);
    g.quadraticCurveTo(13.5, -2.5, 13.5, 0);
    g.quadraticCurveTo(13.5, 2.5, 9, 4);
    g.closePath();
    g.fill();

    // Kanzel
    g.fillStyle = "#7fd8ff";
    g.beginPath();
    g.moveTo(-1, -4.6);
    g.quadraticCurveTo(2.5, -8.2, 7, -4.4);
    g.closePath();
    g.fill();

    // Flügel, quer über den Rumpf
    g.fillStyle = "#c2332b";
    g.beginPath();
    g.ellipse(1, 0.8, 6.5, 1.7, 0, 0, Math.PI * 2);
    g.fill();

    // Propeller: ein schneller Schatten vor der Nase.
    const hub = 5.5 * Math.abs(Math.sin(state.propeller));
    g.fillStyle = "rgba(255, 255, 255, 0.55)";
    g.beginPath();
    g.ellipse(14, 0, 1.1, Math.max(1.2, hub), 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "#3a3f55";
    g.beginPath();
    g.arc(13.8, 0, 1.2, 0, Math.PI * 2);
    g.fill();
    g.restore();
  }

  // Die Gegner als Geist (geist.js): ein Flugzeug aus Licht auf ihrem Weg –
  // durch ihren eigenen Tunnel, nicht durch diesen.
  function zeichneGeister() {
    if (!gegner || state.phase === "bereit") return;
    const orte = window.LernappGeist?.orte?.(gegner) || [];
    if (!orte.length) return;
    bildTransform();
    const s = view.s;
    orte.forEach((o) => {
      g.save();
      g.globalAlpha = 0.6 * o.blass;
      g.translate(bildX(START.x + o.a), bildY(START.y + o.b));
      g.rotate(-(o.c || 0) / 100);
      g.scale(s, s);
      g.fillStyle = o.farbe;
      g.beginPath();
      g.moveTo(-12, -1);
      g.quadraticCurveTo(-8, -4.5, 3, -4.8);
      g.quadraticCurveTo(11, -4.4, 13.5, 0);
      g.quadraticCurveTo(11, 4.2, 3, 4.6);
      g.quadraticCurveTo(-6, 4.2, -12, 1);
      g.closePath();
      g.moveTo(-12, -1);
      g.lineTo(-9.5, -8.5);
      g.lineTo(-6, -8.5);
      g.lineTo(-4, -2);
      g.closePath();
      g.fill();
      g.restore();
    });
    window.LernappGeist.namen(g, orte.map((o) => {
      const dx = START.x + o.a - state.f.x;
      return { ...o, sx: bildX(START.x + o.a), sy: bildY(START.y + o.b) - 10 * s, weit: `${dx > 0 ? "+" : ""}${Math.round(dx / METER)} m` };
    }), { breit: view.cssW, hoch: view.cssH });
  }

  function zeichneTeile() {
    if (!state.teile.length) return;
    weltTransform();
    state.teile.forEach((t) => {
      const k = clamp(t.leben / t.max, 0, 1);
      g.globalAlpha = t.art === "rauch" ? k * 0.35 : k;
      g.fillStyle = t.farbe;
      g.beginPath();
      g.arc(t.x, t.y, t.r * (t.art === "rauch" ? 2 - k : 0.5 + k * 0.5), 0, Math.PI * 2);
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
      const steig = (1 - k) * 26;
      g.globalAlpha = Math.min(1, k * 2);
      g.font = `900 ${Math.round(s.gross * view.s)}px system-ui, sans-serif`;
      g.lineWidth = 4;
      g.strokeStyle = "rgba(7, 11, 36, 0.7)";
      g.strokeText(s.text, bildX(s.x), bildY(s.y) - steig);
      g.fillStyle = s.farbe;
      g.fillText(s.text, bildX(s.x), bildY(s.y) - steig);
    });
    g.globalAlpha = 1;
  }

  // Die Meter oben links – die eigentliche Zahl der Runde.
  function zeichneAnzeige() {
    bildTransform();
    const gross = clamp(view.cssH * 0.055, 14, 24);
    g.font = `900 ${Math.round(gross)}px system-ui, sans-serif`;
    g.textAlign = "left";
    g.textBaseline = "middle";
    const text = `${state.meter} m`;
    const w = g.measureText(text).width + gross * 1.1;
    const x = 12;
    const y = 12;
    g.fillStyle = "rgba(7, 11, 36, 0.55)";
    g.beginPath();
    if (g.roundRect) g.roundRect(x, y, w, gross * 1.6, gross * 0.8);
    else g.rect(x, y, w, gross * 1.6);
    g.fill();
    g.fillStyle = "#ffffff";
    g.fillText(text, x + gross * 0.55, y + gross * 0.82);
  }

  function zeichnen() {
    if (!g) return;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, canvas.width, canvas.height);
    zeichneHimmel();
    zeichneStriche();
    zeichneWaende();
    zeichneMarken();
    zeichneTore();
    zeichneSpur();
    zeichneGeister();
    zeichneTeile();
    zeichneFlieger();
    zeichneSchriften();
    zeichneAnzeige();
  }

  // ---------------------------------------------------------------------------
  // Teilchen und Schriften
  // ---------------------------------------------------------------------------
  function funken(x, y, anzahl) {
    if (ruhig()) anzahl = Math.ceil(anzahl / 3);
    const farben = ["#fff4d6", "#ffd166", "#ff8c42", "#e8433a"];
    for (let i = 0; i < anzahl; i += 1) {
      const w = Math.random() * Math.PI * 2;
      const v = 60 + Math.random() * 220;
      state.teile.push({
        art: "funke", x, y, vx: Math.cos(w) * v, vy: Math.sin(w) * v,
        r: 1.4 + Math.random() * 2.2, farbe: farben[i % farben.length], leben: 0.5 + Math.random() * 0.6, max: 1.1,
      });
    }
    for (let i = 0; i < anzahl / 2; i += 1) {
      state.teile.push({
        art: "rauch", x, y, vx: (Math.random() - 0.5) * 60, vy: 20 + Math.random() * 40,
        r: 3 + Math.random() * 4, farbe: "#9aa3c7", leben: 0.8 + Math.random() * 0.7, max: 1.5,
      });
    }
  }

  function wolke(x, y) {
    state.teile.push({
      art: "rauch", x, y, vx: -20 - Math.random() * 20, vy: (Math.random() - 0.5) * 12,
      r: 1.6 + Math.random() * 1.2, farbe: "#e9ecff", leben: 0.45, max: 0.45,
    });
  }

  function schrift(text, x, y, farbe, gross) {
    state.schriften.push({ text, x, y, farbe, gross, leben: 1.1, max: 1.1 });
  }

  // ---------------------------------------------------------------------------
  // Der Lauf
  // ---------------------------------------------------------------------------
  function physik(dt) {
    const f = state.f;
    const v = tempoBei(f.x);
    f.vy = clamp(f.vy + (gedrueckt ? SCHUB - G : -G) * dt, -VY_MAX, VY_MAX);
    f.x += v * dt;
    f.y += f.vy * dt;
    // Die Nase zeigt dorthin, wohin es geht – ein wenig gedämpft.
    state.neig = Math.atan2(f.vy, v) * 0.75;
    state.spitze = Math.max(state.spitze, v);
    if (beruehrt()) crash();
  }

  function crash() {
    if (state.schritt !== "flug") return;
    state.schritt = "crash";
    state.crashZeit = state.zeit;
    state.stoss = 1;
    funken(state.f.x + 6, state.f.y, 34);
    kids()?.playJingle?.("retry");
    kids()?.vibrate?.([30, 40, 60]);
    stepTimer = window.setTimeout(finish, 1100);
  }

  function takt(dt) {
    state.zeit += dt;
    state.propeller += dt * (state.schritt === "crash" ? 4 : 38);
    if (state.stoss > 0) state.stoss = Math.max(0, state.stoss - dt * 2.5);
    const f = state.f;

    if (state.phase === "zuschauen") {
      zuschauenTakt();
      state.spur.push({ x: f.x - 12, y: f.y + 1 });
      if (state.spur.length > 22) state.spur.shift();
    } else if (state.schritt === "flug") {
      const n = Math.max(1, Math.ceil(dt / TAKT));
      for (let i = 0; i < n && state.schritt === "flug"; i += 1) physik(dt / n);

      state.spur.push({ x: f.x - 12, y: f.y + 1 });
      if (state.spur.length > 22) state.spur.shift();
      if (gedrueckt && Math.random() < dt * 30) wolke(f.x - 13, f.y - 1);

      const meter = Math.floor(meterBei(f.x));
      if (meter !== state.meter) {
        if (Math.floor(meter / 100) > Math.floor(state.meter / 100)) {
          schrift(`${Math.floor(meter / 100) * 100} m`, f.x + 30, f.y + 26, "#7ff3ff", 16);
          kids()?.playJingle?.("star");
        }
        state.meter = meter;
        state.punkte = meter;
        shell.setCount(meter);
      }
    } else if (state.schritt === "start") {
      // Vor dem ersten Druck schwebt das Flugzeug am Eingang.
      f.y = START.y + Math.sin(state.zeit * 2.4) * (ruhig() ? 0 : 4);
      state.neig = Math.cos(state.zeit * 2.4) * (ruhig() ? 0 : 0.08);
    } else if (state.schritt === "crash") {
      f.vy -= G * 0.6 * dt;
    }

    // Die Striche: Sie entstehen rechts und ziehen nach links, schneller als
    // der Tunnel – je höher das Tempo, desto mehr.
    const v = state.schritt === "flug" ? tempoBei(f.x) : 0;
    const dichte = clamp((v - 170) / 160, 0, 1);
    if (!ruhig() && dichte > 0 && Math.random() < dt * 40 * dichte) {
      state.striche.push({
        x: view.cssW + 10, y: Math.random() * view.cssH, len: 20 + 60 * dichte,
        tempo: (1.6 + Math.random()) * v * view.s, alpha: 0.12 + 0.25 * dichte,
      });
    }
    for (let i = state.striche.length - 1; i >= 0; i -= 1) {
      const s = state.striche[i];
      s.x -= s.tempo * dt;
      if (s.x + s.len < -10) state.striche.splice(i, 1);
    }

    for (let i = state.teile.length - 1; i >= 0; i -= 1) {
      const t = state.teile[i];
      if (t.art === "funke") t.vy -= 380 * dt;
      t.vx *= 1 - 1.4 * dt;
      t.x += t.vx * dt;
      t.y += t.vy * dt;
      t.leben -= dt;
      if (t.leben <= 0) state.teile.splice(i, 1);
    }
    for (let i = state.schriften.length - 1; i >= 0; i -= 1) {
      state.schriften[i].leben -= dt;
      if (state.schriften[i].leben <= 0) state.schriften.splice(i, 1);
    }

    if (state.schritt !== "crash") state.camX = camXZiel();
    tunnelBis(state.camX + view.w + SEG * 3);

    if (state.phase === "spiel") {
      gegner?.takt(state.punkte, { a: Math.round(state.f.x - START.x), b: Math.round(state.f.y - START.y), c: Math.round(state.neig * 100) });
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
  // Halten und Loslassen
  // ---------------------------------------------------------------------------
  // ---------------------------------------------------------------------------
  // Zuschauen
  // ---------------------------------------------------------------------------
  // Ein aufgezeichneter Flug durch seinen eigenen Tunnel: Der Zufall hält die
  // Saat (geist.js, zuschauer), startRun baut damit denselben Tunnel, und das
  // Flugzeug steht Bild für Bild dort, wo es damals war.
  function zuschauenStarten() {
    if (!zuschauer?.lauf) return;
    startRun();
    state.phase = "zuschauen";
    state.schritt = "flug";
    shell.setPhase("play");
    zuschauer.los();
  }

  function zuschauenTakt() {
    const s = zuschauer.stand();
    if (!s) return;
    const f = state.f;
    f.x = START.x + s.a;
    f.y = START.y + s.b;
    f.vy = s.vb;
    state.neig = (s.c || 0) / 100;
    const meter = Math.max(0, Math.floor(s.punkte));
    if (meter !== state.meter) {
      state.meter = meter;
      state.punkte = meter;
      shell.setCount(meter);
    }
    zuschauer.weiter();
  }

  // Die Runde beginnt: mit dem ersten Druck – oder im Live-Modus zum
  // gemeinsamen Start (game-shell.js, live.los).
  function losGehts() {
    if (state.phase !== "bereit") return;
    state.phase = "spiel";
    state.schritt = "flug";
    state.f.vy = 0;
    shell.setPhase("play");
    gegner?.los();
    kids()?.vibrate?.(8);
  }

  function druecken() {
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
    state.spitze = 0;
    state.f = { x: START.x, y: START.y, vy: 0 };
    state.neig = 0;
    state.tunnel = { punkte: [], abschnitt: null, nase: null };
    state.spur = [];
    state.teile = [];
    state.schriften = [];
    state.striche = [];
    state.stoss = 0;
    state.zeit = 0;
    gedrueckt = false;
    shell.setCount(0);
    gegner?.runde();

    shell.clear();
    const prompt = shell.el("p", "cm-prompt tf-prompt", "Halten – steigen. Loslassen – sinken.");
    shell.play.append(prompt, buildPlatz());
    view.cssW = 0;
    view.cssH = 0;
    messen();
    state.camX = camXZiel();
    tunnelBis(state.camX + view.w + SEG * 3);

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
    // Das Tempo in km/h: zehn Einheiten sind ein Meter.
    const kmh = Math.round(state.spitze / METER * 3.6);
    shell.showResult({
      label: "Deine Meter",
      points: punkte,
      detail: rekord ? "Neuer Rekord!" : `Spitze ${kmh} km/h${vorher ? ` · Bestwert ${vorher} m` : ""}`,
      speech: `${punkte} Meter.${rekord ? " Das ist dein neuer Rekord!" : vorher ? ` Dein Bestwert sind ${vorher} Meter.` : ""}`,
      geist,
    });
    if (rekord) host.querySelector(".cm-result-detail")?.classList.add("tf-rekord");
    zaehleHoch(punkte);
  }

  // ---------------------------------------------------------------------------
  // Start
  // ---------------------------------------------------------------------------
  shell = shellApi.mount({
    host,
    title: "Tunnelflug",
    area: "konzentration",
    accent: "#00A5B5",
    accentDark: "#00707c",
    help: HELP,
    clock: false,
    onRestart: () => (zuschauer ? zuschauenStarten() : startRun()),
    live: { los: losGehts, stopp: () => finish() },
  });
  zuschauer = window.LernappGeist?.zuschauer?.({
    host, spiel: "tunnelFlight", fassung: "t1", zufall, einheit: "m", nochmal: zuschauenStarten,
  }) || null;
  if (!zuschauer) {
    gegner = window.LernappGeist?.fuer?.({ spiel: "tunnelFlight", host, art: "tempo", alle: true, zufall }) || null;
  }

  startRun();
  zuschauer?.laden.then((da) => { if (da) zuschauenStarten(); });

  host.addEventListener("pointerdown", (event) => {
    if (event.target.closest("button, a, input")) return;
    druecken();
  });
  window.addEventListener("pointerup", loslassen);
  window.addEventListener("pointercancel", loslassen);
  // Wer das Fenster verlässt, nimmt auch den Finger vom Schub.
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
  window.LernappTunnelflug = {
    BAND, METER, SEG, DURCHLASS_MIN, VY_MAX, KANN, state, view, takt, druecken, loslassen,
    tunnelBis, wandBei, tempoBei, weiteBei,
  };
})();
