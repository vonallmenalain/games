/*
 * schwerkraft.js – Schwerkraft-Läufer.
 * ---------------------------------------------------------------------------
 * Ein kleiner Roboter rennt durch einen Neon-Korridor, von allein und immer
 * schneller. Ein Tipp, und die Schwerkraft kehrt sich um: Er fällt an die
 * Decke und rennt dort kopfüber weiter. Noch ein Tipp, und er fällt zurück.
 *
 * Im Weg liegen Lücken, in die er ins Leere stürzt, Stacheln und Blöcke.
 * Mal am Boden, mal an der Decke – nie an beiden zugleich, und dazwischen
 * immer ein Stück, auf dem beide frei sind, lang genug für einen Wechsel.
 * Wer im falschen Moment wechselt, landet im Loch.
 *
 * Gezählt wird, wie weit er kommt, in Metern.
 *
 * Gebaut wird der Korridor aus dem Zufall (zufall.js): ohne Turnier jedes
 * Mal ein anderer, im Turnier für alle im selben Versuch derselbe. Wie lang
 * die freien Stücke sind, folgt aus dem Tempo an dieser Stelle: so lang, wie
 * ein Wechsel dauert, und etwas Zeit zum Reagieren – nach hinten weniger.
 *
 * Die Gegner (geist.js) stehen als Linie quer durch den Korridor.
 *
 * Gerechnet wird in Welteinheiten, zehn sind ein Meter; y zählt nach oben,
 * der Boden liegt bei 0, die Decke bei HOCH.
 */
(() => {
  "use strict";

  if (document.body.dataset.page !== "gravity") return;

  const host = document.querySelector("#sl-stage");
  const shellApi = window.LernappGameShell;
  const cloudApi = window.LernappGameCloud;
  if (!host || !shellApi) return;

  const kids = () => window.LernappKids || null;
  const ruhig = () => Boolean(kids()?.prefersReducedMotion?.());

  const zufall = window.LernappZufall?.fuer?.("gravityRun") || {
    neu() {},
    zahl: () => Math.random(),
  };

  // ---------------------------------------------------------------------------
  // Die Welt
  // ---------------------------------------------------------------------------
  const HOCH = 170;                // von Boden zu Decke
  const SICHT_H = 300;
  const WELT_W = 440;              // so viel Korridor ist mindestens zu sehen
  const WELT_W_MAX = 780;
  const LAEUFER_AN = 0.2;          // so weit vom linken Rand rennt er
  const METER = 10;
  const BREIT = 16;                // der Läufer: so breit …
  const GROSS = 22;                // … und so hoch
  const STACHEL = 12;              // so hoch ragen Stacheln
  const LEISTE = 14;               // so dick sind Boden und Decke
  const SCHWER = 2600;             // so stark zieht es
  const VORLAUF = 400;             // freier Korridor vor dem Start
  const START_FREI = 520;          // und danach, bevor das Erste kommt
  const TAKT = 1 / 240;

  const V0 = 240;
  const V_MAX = 500;
  const V_WEG = 900;               // Meter

  // Wie lange ein Wechsel dauert: von einer Seite zur anderen fallen.
  const WECHSEL = Math.sqrt((2 * (HOCH - GROSS)) / SCHWER);

  const HELP = [
    "Schwerkraft-Läufer. Der Roboter rennt von allein.",
    "Tippe aufs Bild, dann kehrt sich die Schwerkraft um: Er fällt an die Decke und rennt dort weiter. Tippe noch einmal, und er fällt zurück auf den Boden.",
    "Weich den Lücken, den Stacheln und den Blöcken aus. Es wird immer schneller. Es zählt, wie weit du kommst, in Metern.",
  ].join(" ");

  const TOP_COUNT = 5;
  const store = cloudApi
    ? cloudApi.register({ key: "lernapp.schwerkraft", empty: { runs: 0, scores: [] }, merge: cloudApi.mergeScores(TOP_COUNT) })
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
  const meterBei = (x) => Math.max(0, x / METER);
  const tempoBei = (x) => V0 + (V_MAX - V0) * (1 - Math.exp(-meterBei(x) / V_WEG));
  const schwereBei = (x) => 1 - Math.exp(-meterBei(x) / 700);

  function hash01(n) {
    const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return x - Math.floor(x);
  }

  // ---------------------------------------------------------------------------
  // Zustand
  // ---------------------------------------------------------------------------
  // phase:   "bereit", "spiel", "ende"
  // schritt: "start", "lauf", "aus"
  const state = {
    phase: "bereit",
    schritt: "start",
    punkte: 0,
    meter: 0,
    wechsel: 0,
    l: { x: 0, y: 0, vy: 0 },
    richtung: -1,         // -1: es zieht zum Boden, 1: zur Decke
    steht: true,
    drehung: 0,           // 0 am Boden, π an der Decke – dazwischen im Fall
    vorgemerkt: 0,        // ein Tipp kurz vor der Landung gilt danach
    losgelassen: 0,       // wann er zuletzt Boden unter den Füssen hatte
    bahnen: [[], []],     // Boden, Decke: { x0, x1, art }
    bloecke: [],          // { x0, x1, bahn, hoch }
    kopf: 0,
    blockiert: 0,         // welche Seite zuletzt versperrt war
    grund: "",
    teile: [],
    schatten: [],
    schriften: [],
    camX: 0,
    stoss: 0,
    zeit: 0,
    endeZeit: 0,
    puls: 0,
  };

  let shell = null;
  let feld = null;
  let canvas = null;
  let g = null;
  let frame = null;
  let last = 0;
  let stepTimer = null;
  let gegner = null;

  const view = { s: 1, dpr: 1, cssW: 0, cssH: 0, w: WELT_W, h: SICHT_H, y0: 0 };

  function clearStep() {
    if (stepTimer) { window.clearTimeout(stepTimer); stepTimer = null; }
  }

  function stopLoop() {
    if (frame) { window.cancelAnimationFrame(frame); frame = null; }
  }

  // ---------------------------------------------------------------------------
  // Der Korridor
  // ---------------------------------------------------------------------------
  /*
   * Boden und Decke sind je eine Kette von Stücken: fest, Lücke oder
   * Stacheln, ohne Fuge. Dazu kommen Blöcke, die auf einem festen Stück
   * stehen. Gebaut wird in Abschnitten:
   *
   *   versperrt   eine Seite hat eine Lücke, Stacheln oder Blöcke, die andere
   *               ist frei – dort muss man sein
   *   frei        beide Seiten frei, so lang, wie ein Wechsel dauert, und
   *               ein wenig länger: Zeit, um zu reagieren
   *
   * So gibt es immer einen Weg, und wer im richtigen Moment wechselt, kommt
   * durch.
   */
  function lege(bahn, x0, x1, art) {
    const liste = state.bahnen[bahn];
    const vor = liste[liste.length - 1];
    if (vor && vor.art === art && Math.abs(vor.x1 - x0) < 0.01) vor.x1 = x1;
    else liste.push({ x0, x1, art });
  }

  function frei(x0, x1) {
    lege(0, x0, x1, "fest");
    lege(1, x0, x1, "fest");
  }

  function naechsterAbschnitt() {
    const x = state.kopf;
    if (x < START_FREI) {
      frei(-VORLAUF, START_FREI);
      state.kopf = START_FREI;
      return;
    }
    const k = schwereBei(x);
    const v = tempoBei(x);
    // Welche Seite versperrt ist: meist die andere als zuletzt.
    const bahn = zufall.zahl() < lerp(0.84, 0.72, k) ? 1 - state.blockiert : state.blockiert;
    state.blockiert = bahn;
    const lang = v * lerp(0.42, 1.05, zufall.zahl()) * lerp(1, 0.85, k);
    const wahl = zufall.zahl();
    const art = wahl < 0.42 ? "luecke" : wahl < 0.74 ? "stachel" : "block";
    if (art === "block") {
      // Ein bis drei Blöcke auf der versperrten Seite. Der Boden darunter
      // bleibt fest; wer zwischen ihnen Platz für zwei Wechsel findet, darf
      // ihn nutzen.
      lege(bahn, x, x + lang, "fest");
      lege(1 - bahn, x, x + lang, "fest");
      // Der erste Block steht erst ein Stück hinter dem Anfang: Wer am Ende
      // des freien Stücks wechselt, ist schon über ihm.
      const anzahl = 1 + Math.floor(zufall.zahl() * 3);
      const hoch = lerp(46, 64, zufall.zahl());
      const von = x + v * 0.18;
      const platz = Math.max(40, x + lang - von);
      const breite = Math.min(70, platz / (anzahl * 1.6));
      for (let i = 0; i < anzahl; i += 1) {
        const bx = von + (platz * (i + 0.5)) / anzahl - breite / 2;
        state.bloecke.push({ x0: bx, x1: bx + breite, bahn, hoch });
      }
    } else {
      lege(bahn, x, x + lang, art);
      lege(1 - bahn, x, x + lang, "fest");
    }
    // Danach frei: ein Wechsel und die Zeit, ihn zu beginnen.
    const reagieren = lerp(0.52, 0.27, k) * (0.85 + zufall.zahl() * 0.4);
    const ruhe = v * (WECHSEL + reagieren) + BREIT * 2;
    frei(x + lang, x + lang + ruhe);
    state.kopf = x + lang + ruhe;
  }

  function korridorBis(x) {
    while (state.kopf < x) naechsterAbschnitt();
  }

  // Das Stück einer Seite an einer Stelle.
  function stueckBei(bahn, x) {
    korridorBis(x + 40);
    const liste = state.bahnen[bahn];
    let lo = 0;
    let hi = liste.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (liste[mid].x0 <= x) lo = mid;
      else hi = mid - 1;
    }
    return liste[lo];
  }

  // Fester Boden unter den Füssen? Ein wenig grosszügig: Steht er mit der
  // Fussspitze noch über dem Rand, hält es.
  function traegt(bahn, x) {
    const a = stueckBei(bahn, x - BREIT / 2 + 3);
    const b = stueckBei(bahn, x + BREIT / 2 - 3);
    return a.art !== "luecke" || b.art !== "luecke";
  }

  // ---------------------------------------------------------------------------
  // Die Fläche
  // ---------------------------------------------------------------------------
  function buildPlatz() {
    const platz = shell.el("div", "sl-platz");
    feld = shell.el("div", "sl-feld");
    canvas = document.createElement("canvas");
    canvas.className = "sl-canvas";
    canvas.setAttribute("aria-hidden", "true");
    feld.append(canvas);
    g = canvas.getContext("2d");

    const tipp = shell.el("span", "sl-tipp");
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
    ring.setAttribute("class", "sl-tipp-ring");
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
    view.w = clamp(SICHT_H * (cssW / cssH), WELT_W, WELT_W_MAX);
    view.s = cssW / view.w;
    view.h = cssH / view.s;
    // Der Korridor steht in der Mitte.
    view.y0 = HOCH / 2 - view.h / 2;
    const pw = Math.round(cssW * dpr);
    const ph = Math.round(cssH * dpr);
    if (canvas.width !== pw) canvas.width = pw;
    if (canvas.height !== ph) canvas.height = ph;
  }

  const wackel = () => (ruhig() ? 0 : Math.sin(state.zeit * 70) * 4 * state.stoss);

  function bildTransform() {
    g.setTransform(view.dpr, 0, 0, view.dpr, 0, wackel() * view.dpr);
  }

  function weltTransform() {
    const f = view.s * view.dpr;
    g.setTransform(f, 0, 0, -f, -state.camX * f, (view.cssH + view.y0 * view.s + wackel()) * view.dpr);
  }

  const bildX = (x) => (x - state.camX) * view.s;
  const bildY = (y) => view.cssH - (y - view.y0) * view.s;

  // ---------------------------------------------------------------------------
  // Zeichnen
  // ---------------------------------------------------------------------------
  const STERNE = Array.from({ length: 70 }, (_, i) => ({
    x: hash01(i * 3.1 + 1), y: hash01(i * 5.7 + 2), r: 0.4 + hash01(i * 7.3 + 3) * 1.1,
  }));

  // Der Hintergrund: ein Himmel von Violett nach Pink, die gestreifte Sonne,
  // Berge mit Neonkante und unten ein Gitter, das auf einen zuläuft.
  function zeichneHimmel() {
    bildTransform();
    const W = view.cssW;
    const H = view.cssH;
    const horizont = bildY(HOCH * 0.38);
    const verlauf = g.createLinearGradient(0, 0, 0, horizont);
    verlauf.addColorStop(0, "#0b0424");
    verlauf.addColorStop(0.55, "#3a0b5c");
    verlauf.addColorStop(1, "#c02a78");
    g.fillStyle = verlauf;
    g.fillRect(0, -10, W, horizont + 10);

    STERNE.forEach((s) => {
      const x = ((s.x * (W + 20) - state.camX * view.s * 0.04) % (W + 20) + W + 20) % (W + 20) - 10;
      const y = s.y * horizont * 0.7;
      g.globalAlpha = 0.6;
      g.fillStyle = "#ffffff";
      g.beginPath();
      g.arc(x, y, s.r, 0, Math.PI * 2);
      g.fill();
    });
    g.globalAlpha = 1;

    // Die Sonne, mit Streifen, die nach unten breiter werden.
    const sr = Math.min(W, H) * 0.22;
    const sx = W * 0.62 - ((state.camX * view.s * 0.02) % (W * 1.2));
    const sy = horizont - sr * 0.35;
    const sonnenX = ((sx % (W + sr * 4)) + W + sr * 4) % (W + sr * 4) - sr * 2;
    const glanz = g.createRadialGradient(sonnenX, sy, sr * 0.6, sonnenX, sy, sr * 1.8);
    glanz.addColorStop(0, "rgba(255, 120, 160, 0.45)");
    glanz.addColorStop(1, "rgba(255, 120, 160, 0)");
    g.fillStyle = glanz;
    g.fillRect(sonnenX - sr * 2, sy - sr * 2, sr * 4, sr * 4);
    g.save();
    g.beginPath();
    g.arc(sonnenX, sy, sr, 0, Math.PI * 2);
    g.clip();
    const sonne = g.createLinearGradient(0, sy - sr, 0, sy + sr);
    sonne.addColorStop(0, "#ffe66b");
    sonne.addColorStop(0.5, "#ff8a4c");
    sonne.addColorStop(1, "#ff3d8b");
    g.fillStyle = sonne;
    g.fillRect(sonnenX - sr, sy - sr, sr * 2, sr * 2);
    g.fillStyle = "#3a0b5c";
    for (let i = 0; i < 6; i += 1) {
      const y = sy + sr * (0.05 + i * 0.17);
      g.fillRect(sonnenX - sr, y, sr * 2, 1.5 + i * 1.6);
    }
    g.restore();

    // Berge mit Neonkante.
    g.fillStyle = "#1a0633";
    g.strokeStyle = "#ff4fd8";
    g.lineWidth = 1.5;
    g.beginPath();
    g.moveTo(0, horizont);
    for (let x = 0; x <= W + 20; x += 18) {
      const wx = (x + state.camX * view.s * 0.08) / 70;
      const hoehe = (Math.abs(Math.sin(wx * 0.7)) * 0.6 + hash01(Math.floor(wx * 2)) * 0.4) * sr * 0.6;
      g.lineTo(x, horizont - hoehe);
    }
    g.lineTo(W + 20, horizont);
    g.closePath();
    g.fill();
    g.stroke();

    // Das Gitter darunter.
    const grund = g.createLinearGradient(0, horizont, 0, H);
    grund.addColorStop(0, "#22053d");
    grund.addColorStop(1, "#090114");
    g.fillStyle = grund;
    g.fillRect(0, horizont, W, H - horizont + 10);
    g.strokeStyle = "rgba(255, 79, 216, 0.5)";
    g.lineWidth = 1;
    const tiefe = H - horizont;
    const lauf = (state.camX * 0.02) % 1;
    for (let i = 0; i < 12; i += 1) {
      const k = (i + 1 - lauf) / 12;
      const y = horizont + tiefe * k * k;
      g.globalAlpha = 0.2 + k * 0.6;
      g.beginPath();
      g.moveTo(0, y);
      g.lineTo(W, y);
      g.stroke();
    }
    g.globalAlpha = 0.45;
    for (let i = -10; i <= 10; i += 1) {
      const versatz = ((state.camX * view.s * 0.3) % 60) / 60;
      const unten = W / 2 + (i - versatz) * W * 0.18;
      g.beginPath();
      g.moveTo(W / 2 + (i - versatz) * W * 0.02, horizont);
      g.lineTo(unten, H);
      g.stroke();
    }
    g.globalAlpha = 1;
  }

  // Boden und Decke: Leisten mit leuchtender Kante. Lücken bleiben offen,
  // Stacheln glühen rot.
  function zeichneKorridor() {
    const x0 = state.camX - 40;
    const x1 = state.camX + view.w + 40;
    korridorBis(x1 + 200);
    weltTransform();

    // Ein Hauch von Glas im Korridor.
    g.fillStyle = "rgba(20, 0, 40, 0.35)";
    g.fillRect(x0, 0, x1 - x0, HOCH);

    const puls = ruhig() ? 0.7 : 0.6 + 0.4 * Math.abs(Math.sin(state.puls));
    [0, 1].forEach((bahn) => {
      const flaeche = bahn === 0 ? 0 : HOCH;
      const nach = bahn === 0 ? -1 : 1;
      const farbe = bahn === 0 ? "0, 240, 255" : "255, 79, 216";
      state.bahnen[bahn].forEach((st) => {
        if (st.x1 < x0 || st.x0 > x1) return;
        const a = Math.max(st.x0, x0);
        const b = Math.min(st.x1, x1);
        if (st.art === "luecke") {
          // Das Loch: Wo die Leiste fehlt, glimmt eine rote Linie, und an
          // beiden Rändern steht eine Warnkante.
          g.strokeStyle = `rgba(255, 70, 100, ${0.35 + 0.25 * puls})`;
          g.lineWidth = 1.4 / view.s;
          g.setLineDash([6, 6]);
          g.beginPath();
          g.moveTo(a, flaeche);
          g.lineTo(b, flaeche);
          g.stroke();
          g.setLineDash([]);
          g.fillStyle = "#ff4664";
          [st.x0, st.x1].forEach((kante) => {
            if (kante < x0 || kante > x1) return;
            g.fillRect(kante - 1.5, flaeche, 3, nach * LEISTE);
          });
          return;
        }
        // Die Leiste.
        const leiste = g.createLinearGradient(0, flaeche, 0, flaeche + nach * LEISTE);
        leiste.addColorStop(0, `rgba(${farbe}, 0.55)`);
        leiste.addColorStop(1, "rgba(20, 4, 40, 0.95)");
        g.fillStyle = leiste;
        g.fillRect(a, flaeche, b - a, nach * LEISTE);
        // Fugen
        g.strokeStyle = `rgba(${farbe}, 0.25)`;
        g.lineWidth = 1 / view.s;
        for (let fx = Math.ceil(a / 40) * 40; fx < b; fx += 40) {
          g.beginPath();
          g.moveTo(fx, flaeche);
          g.lineTo(fx, flaeche + nach * LEISTE);
          g.stroke();
        }
        // Die leuchtende Kante.
        g.strokeStyle = `rgba(${farbe}, ${0.25 * puls})`;
        g.lineWidth = 6 / view.s;
        g.beginPath();
        g.moveTo(a, flaeche);
        g.lineTo(b, flaeche);
        g.stroke();
        g.strokeStyle = `rgb(${farbe})`;
        g.lineWidth = 1.8 / view.s;
        g.stroke();
        if (st.art === "stachel") {
          g.fillStyle = "#ff3355";
          g.beginPath();
          for (let sx = Math.ceil(a / 10) * 10; sx + 10 <= b + 0.01; sx += 10) {
            g.moveTo(sx, flaeche);
            g.lineTo(sx + 5, flaeche - nach * STACHEL);
            g.lineTo(sx + 10, flaeche);
          }
          g.fill();
          g.strokeStyle = `rgba(255, 120, 140, ${0.5 * puls})`;
          g.lineWidth = 1.2 / view.s;
          g.stroke();
        }
      });
    });

    // Die Blöcke: dunkel, mit Neonrand und Warnstreifen.
    state.bloecke.forEach((b) => {
      if (b.x1 < x0 || b.x0 > x1) return;
      const y0 = b.bahn === 0 ? 0 : HOCH - b.hoch;
      g.fillStyle = "#1c0a33";
      g.fillRect(b.x0, y0, b.x1 - b.x0, b.hoch);
      g.save();
      g.beginPath();
      g.rect(b.x0, y0, b.x1 - b.x0, b.hoch);
      g.clip();
      g.strokeStyle = "rgba(255, 200, 60, 0.35)";
      g.lineWidth = 4;
      for (let s = -b.hoch; s < b.x1 - b.x0; s += 12) {
        g.beginPath();
        g.moveTo(b.x0 + s, y0);
        g.lineTo(b.x0 + s + b.hoch, y0 + b.hoch);
        g.stroke();
      }
      g.restore();
      g.strokeStyle = `rgba(255, 200, 60, ${0.3 * puls})`;
      g.lineWidth = 6 / view.s;
      g.strokeRect(b.x0, y0, b.x1 - b.x0, b.hoch);
      g.strokeStyle = "#ffc83c";
      g.lineWidth = 1.6 / view.s;
      g.strokeRect(b.x0, y0, b.x1 - b.x0, b.hoch);
    });
  }

  // Alle hundert Meter eine Marke; die Gegner als Linie quer hindurch.
  function zeichneMarken() {
    bildTransform();
    const gross = Math.round(clamp(view.cssH * 0.03, 10, 14));
    g.font = `800 ${gross}px system-ui, sans-serif`;
    g.textAlign = "center";
    g.textBaseline = "top";
    const von = Math.max(100, Math.ceil(meterBei(state.camX) / 100) * 100);
    for (let m = von; m <= meterBei(state.camX + view.w); m += 100) {
      const sx = bildX(m * METER);
      g.fillStyle = "rgba(0, 240, 255, 0.7)";
      g.fillText(`${m} m`, sx, bildY(0) + LEISTE * view.s + 4);
    }
    const ziele = gegner?.gegner?.() || [];
    ziele.forEach((ziel) => {
      const x = ziel.punkte * METER;
      if (x < state.camX - 20 || x > state.camX + view.w + 20) return;
      const sx = bildX(x);
      const geschlagen = state.punkte > ziel.punkte;
      g.globalAlpha = geschlagen ? 0.35 : 0.95;
      g.strokeStyle = ziel.farbe;
      g.lineWidth = 3;
      g.setLineDash([8, 6]);
      g.beginPath();
      g.moveTo(sx, bildY(HOCH));
      g.lineTo(sx, bildY(0));
      g.stroke();
      g.setLineDash([]);
      const text = ziel.art === "eigen" ? `Bestmarke ${ziel.punkte} m` : `${ziel.name} ${ziel.punkte} m`;
      g.textBaseline = "bottom";
      g.lineWidth = 3;
      g.strokeStyle = "rgba(11, 4, 36, 0.8)";
      g.strokeText(text, sx, bildY(HOCH) - LEISTE * view.s - 4);
      g.fillStyle = ziel.farbe;
      g.fillText(text, sx, bildY(HOCH) - LEISTE * view.s - 4);
      g.textBaseline = "top";
    });
    g.globalAlpha = 1;
  }

  // Der Läufer: ein Würfel-Roboter mit leuchtendem Visier. Gezeichnet in der
  // Welt, um seine Mitte gedreht – an der Decke steht er kopf.
  function zeichneLaeufer(l, drehung, alpha = 1, nachbild = false) {
    weltTransform();
    g.save();
    g.globalAlpha = alpha;
    g.translate(l.x, l.y + GROSS / 2);
    g.rotate(drehung);
    const lauf = state.steht && state.schritt === "lauf" && !nachbild ? Math.sin(state.zeit * 28) : 0;
    if (nachbild) {
      g.fillStyle = state.richtung > 0 ? "rgba(255, 79, 216, 0.5)" : "rgba(0, 240, 255, 0.5)";
      g.fillRect(-BREIT / 2, -GROSS / 2, BREIT, GROSS);
      g.restore();
      return;
    }
    // Beine
    g.strokeStyle = "#cfd6ff";
    g.lineWidth = 2.4;
    g.lineCap = "round";
    g.beginPath();
    g.moveTo(-3.5, -GROSS / 2 + 5);
    g.lineTo(-3.5 + lauf * 3, -GROSS / 2);
    g.moveTo(3.5, -GROSS / 2 + 5);
    g.lineTo(3.5 - lauf * 3, -GROSS / 2);
    g.stroke();
    // Körper
    const k = g.createLinearGradient(-BREIT / 2, 0, BREIT / 2, 0);
    k.addColorStop(0, "#5b5fe0");
    k.addColorStop(1, "#8f7bff");
    g.fillStyle = k;
    g.beginPath();
    if (g.roundRect) g.roundRect(-BREIT / 2, -GROSS / 2 + 4, BREIT, GROSS - 4, 4);
    else g.rect(-BREIT / 2, -GROSS / 2 + 4, BREIT, GROSS - 4);
    g.fill();
    // Visier, nach vorn
    g.fillStyle = "#0b0424";
    g.fillRect(-1, 2, BREIT / 2 + 0.5, 7);
    g.fillStyle = state.richtung > 0 ? "#ff4fd8" : "#00f0ff";
    g.fillRect(1.5, 4, 5.5, 3);
    g.fillStyle = "rgba(255,255,255,0.8)";
    g.fillRect(5, 4.5, 1.2, 1.2);
    // Antenne
    g.strokeStyle = "#cfd6ff";
    g.lineWidth = 1.2;
    g.beginPath();
    g.moveTo(-3, GROSS / 2);
    g.lineTo(-4.5, GROSS / 2 + 4);
    g.stroke();
    g.fillStyle = state.richtung > 0 ? "#ff4fd8" : "#00f0ff";
    g.beginPath();
    g.arc(-4.5, GROSS / 2 + 4.5, 1.6, 0, Math.PI * 2);
    g.fill();
    g.restore();
  }

  function zeichneTeile() {
    if (!state.teile.length) return;
    weltTransform();
    state.teile.forEach((t) => {
      const k = clamp(t.leben / t.max, 0, 1);
      g.globalAlpha = k;
      g.fillStyle = t.farbe;
      g.fillRect(t.x - t.r / 2, t.y - t.r / 2, t.r, t.r);
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
      g.font = `900 ${Math.round(s.gross * clamp(view.s, 0.8, 1.6))}px system-ui, sans-serif`;
      g.lineWidth = 4;
      g.strokeStyle = "rgba(11, 4, 36, 0.8)";
      g.strokeText(s.text, bildX(s.x), bildY(s.y) - (1 - k) * 24);
      g.fillStyle = s.farbe;
      g.fillText(s.text, bildX(s.x), bildY(s.y) - (1 - k) * 24);
    });
    g.globalAlpha = 1;
  }

  function zeichneAnzeige() {
    if (state.schritt === "start") return;
    bildTransform();
    const gross = clamp(view.cssH * 0.05, 14, 24);
    g.font = `900 ${Math.round(gross)}px system-ui, sans-serif`;
    g.textAlign = "left";
    g.textBaseline = "middle";
    const text = `${state.meter} m`;
    const w = g.measureText(text).width + gross * 1.1;
    g.fillStyle = "rgba(11, 4, 36, 0.6)";
    g.beginPath();
    if (g.roundRect) g.roundRect(12, 12, w, gross * 1.6, gross * 0.8);
    else g.rect(12, 12, w, gross * 1.6);
    g.fill();
    g.fillStyle = "#ffffff";
    g.fillText(text, 12 + gross * 0.55, 12 + gross * 0.82);
  }

  function zeichnen() {
    if (!g) return;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, canvas.width, canvas.height);
    zeichneHimmel();
    zeichneKorridor();
    zeichneMarken();
    state.schatten.forEach((s) => zeichneLaeufer(s, s.drehung, s.alpha, true));
    zeichneTeile();
    if (!(state.schritt === "aus" && state.grund !== "loch" && state.zeit - state.endeZeit > 0.1)) {
      zeichneLaeufer(state.l, state.drehung);
    }
    zeichneSchriften();
    zeichneAnzeige();
  }

  // ---------------------------------------------------------------------------
  // Teilchen und Schriften
  // ---------------------------------------------------------------------------
  function funken(x, y, farbe, anzahl, nach = 0) {
    if (ruhig()) anzahl = Math.ceil(anzahl / 3);
    for (let i = 0; i < anzahl; i += 1) {
      const w = Math.random() * Math.PI * 2;
      const v = 40 + Math.random() * 160;
      state.teile.push({
        x, y, vx: Math.cos(w) * v - 60, vy: Math.sin(w) * v + nach * 60,
        r: 1.6 + Math.random() * 2.4, farbe, leben: 0.4 + Math.random() * 0.4, max: 0.8,
      });
    }
  }

  function schrift(text, x, y, farbe, gross) {
    state.schriften.push({ text, x, y, farbe, gross, leben: 1.1, max: 1.1 });
  }

  // ---------------------------------------------------------------------------
  // Der Lauf
  // ---------------------------------------------------------------------------
  function umkehren() {
    state.richtung = -state.richtung;
    state.steht = false;
    state.wechsel += 1;
    state.puls += 0.5;
    funken(state.l.x, state.richtung > 0 ? state.l.y : state.l.y + GROSS, state.richtung > 0 ? "#00f0ff" : "#ff4fd8", 6, -state.richtung);
    kids()?.playJingle?.("tap");
  }

  function aus(grund) {
    if (state.schritt !== "lauf") return;
    state.schritt = "aus";
    state.grund = grund;
    state.endeZeit = state.zeit;
    if (grund !== "loch") {
      state.stoss = 1;
      funken(state.l.x + BREIT / 2, state.l.y + GROSS / 2, "#ff3355", 22);
      funken(state.l.x + BREIT / 2, state.l.y + GROSS / 2, "#8f7bff", 16);
    } else {
      schrift("Ins Leere!", state.l.x + 40, HOCH / 2, "#ff7aa8", 15);
    }
    kids()?.playJingle?.("retry");
    kids()?.vibrate?.([30, 40, 60]);
    stepTimer = window.setTimeout(finish, grund === "loch" ? 900 : 1100);
  }

  function physik(dt) {
    const l = state.l;
    const v = tempoBei(l.x);
    l.x += v * dt;
    const bahn = state.richtung < 0 ? 0 : 1;

    if (state.steht) {
      if (!traegt(bahn, l.x)) {
        // Kein Boden mehr unter den Füssen: Er fällt hinaus.
        state.steht = false;
        state.losgelassen = state.zeit;
      }
    } else {
      l.vy += state.richtung * SCHWER * dt;
      l.y += l.vy * dt;
      // Landen, wenn unter ihm fest ist – sonst fällt er weiter.
      if (state.richtung < 0 && l.y <= 0 && l.y > -8 && traegt(0, l.x)) {
        l.y = 0;
        l.vy = 0;
        state.steht = true;
        landung(0);
      } else if (state.richtung > 0 && l.y + GROSS >= HOCH && l.y + GROSS < HOCH + 8 && traegt(1, l.x)) {
        l.y = HOCH - GROSS;
        l.vy = 0;
        state.steht = true;
        landung(1);
      }
      if (l.y < -70 || l.y > HOCH + 70) { aus("loch"); return; }
    }

    // Stacheln: auf ihnen stehen, oder in sie hineinfallen.
    const fussX0 = l.x - BREIT / 2 + 3;
    const fussX1 = l.x + BREIT / 2 - 3;
    for (const b of [0, 1]) {
      const nahe = b === 0 ? l.y < STACHEL - 2 && l.y > -6 : l.y + GROSS > HOCH - STACHEL + 2 && l.y + GROSS < HOCH + 6;
      if (!nahe) continue;
      if (stueckBei(b, fussX0).art === "stachel" || stueckBei(b, fussX1).art === "stachel") { aus("stachel"); return; }
    }
    // Blöcke.
    for (const b of state.bloecke) {
      if (b.x1 < l.x - BREIT || b.x0 > l.x + BREIT) continue;
      const y0 = b.bahn === 0 ? 0 : HOCH - b.hoch;
      const y1 = y0 + b.hoch;
      if (l.x + BREIT / 2 - 2 > b.x0 && l.x - BREIT / 2 + 2 < b.x1 && l.y + GROSS - 2 > y0 && l.y + 2 < y1) { aus("block"); return; }
    }

    // Ein Tipp kurz vor der Landung gilt jetzt.
    if (state.steht && state.vorgemerkt && state.zeit - state.vorgemerkt < 0.14) {
      state.vorgemerkt = 0;
      umkehren();
    }
  }

  function landung(bahn) {
    funken(state.l.x, bahn === 0 ? 0 : HOCH, bahn === 0 ? "#00f0ff" : "#ff4fd8", 5, bahn === 0 ? 1 : -1);
    kids()?.vibrate?.(6);
  }

  function takt(dt) {
    state.zeit += dt;
    if (state.stoss > 0) state.stoss = Math.max(0, state.stoss - dt * 2.4);
    state.puls += dt * (tempoBei(state.l.x) / 120);

    if (state.schritt === "lauf") {
      const n = Math.max(1, Math.ceil(dt / TAKT));
      for (let i = 0; i < n && state.schritt === "lauf"; i += 1) physik(dt / n);
      const meter = Math.floor(meterBei(state.l.x));
      if (meter !== state.meter) {
        if (Math.floor(meter / 100) > Math.floor(state.meter / 100)) {
          schrift(`${Math.floor(meter / 100) * 100} m`, state.l.x + 60, HOCH / 2, "#00f0ff", 16);
          kids()?.playJingle?.("star");
        }
        state.meter = meter;
        state.punkte = meter;
        shell.setCount(meter);
      }
    } else if (state.schritt === "start") {
      state.l.y = 0;
    } else if (state.schritt === "aus" && state.grund === "loch") {
      state.l.vy += state.richtung * SCHWER * dt;
      state.l.y += state.l.vy * dt;
      state.l.x += tempoBei(state.l.x) * dt * 0.5;
    }

    // Die Drehung folgt dem Weg von einer Seite zur anderen.
    const ziel = state.richtung > 0 ? Math.PI : 0;
    if (state.steht || state.schritt !== "lauf") {
      state.drehung += (ziel - state.drehung) * (1 - Math.exp(-dt * 30));
    } else {
      state.drehung = Math.PI * clamp(state.l.y / (HOCH - GROSS), 0, 1);
    }

    // Nachbilder im Fall.
    if (!ruhig() && state.schritt === "lauf" && !state.steht) {
      state.schatten.push({ x: state.l.x, y: state.l.y, drehung: state.drehung, alpha: 0.35 });
    }
    for (let i = state.schatten.length - 1; i >= 0; i -= 1) {
      state.schatten[i].alpha -= dt * 2.2;
      if (state.schatten[i].alpha <= 0) state.schatten.splice(i, 1);
    }
    for (let i = state.teile.length - 1; i >= 0; i -= 1) {
      const t = state.teile[i];
      t.x += t.vx * dt;
      t.y += t.vy * dt;
      t.leben -= dt;
      if (t.leben <= 0) state.teile.splice(i, 1);
    }
    for (let i = state.schriften.length - 1; i >= 0; i -= 1) {
      state.schriften[i].leben -= dt;
      if (state.schriften[i].leben <= 0) state.schriften.splice(i, 1);
    }

    if (state.schritt !== "aus") state.camX = state.l.x - view.w * LAEUFER_AN;
    korridorBis(state.camX + view.w + 400);
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
  // Tippen
  // ---------------------------------------------------------------------------
  function tippen() {
    if (state.phase === "ende") return;
    if (state.phase === "bereit") {
      // Der erste Tipp: Er rennt los.
      state.phase = "spiel";
      state.schritt = "lauf";
      shell.setPhase("play");
      gegner?.los();
      kids()?.vibrate?.(8);
      return;
    }
    if (state.schritt !== "lauf") return;
    // Am Boden, oder eben erst über eine Kante: Er kehrt um. In der Luft
    // merkt er sich den Tipp für die Landung.
    const kante = !state.steht && Math.abs(state.l.vy) < 200 && state.zeit - state.losgelassen < 0.08;
    if (state.steht || kante) umkehren();
    else state.vorgemerkt = state.zeit;
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
    state.wechsel = 0;
    state.l = { x: 0, y: 0, vy: 0 };
    state.richtung = -1;
    state.steht = true;
    state.drehung = 0;
    state.vorgemerkt = 0;
    state.losgelassen = -1;
    state.bahnen = [[], []];
    state.bloecke = [];
    state.kopf = -VORLAUF;
    state.blockiert = 1;
    state.grund = "";
    state.teile = [];
    state.schatten = [];
    state.schriften = [];
    state.stoss = 0;
    state.zeit = 0;
    state.puls = 0;
    shell.setCount(0);
    gegner?.runde();

    shell.clear();
    const prompt = shell.el("p", "cm-prompt sl-prompt", "Tippen – Schwerkraft umkehren.");
    shell.play.append(prompt, buildPlatz());
    view.cssW = 0;
    view.cssH = 0;
    messen();
    korridorBis(view.w * 3);
    takt(0);

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
    gegner?.ende(punkte);
    const vorher = Number(store.read()?.scores?.[0]) || 0;
    const rekord = punkte > vorher;
    store.update((old) => ({
      runs: (Number(old.runs) || 0) + 1,
      scores: [...(old.scores || []), punkte].sort((x, y) => y - x).slice(0, TOP_COUNT),
    }));
    kids()?.playJingle?.("win");
    const kmh = Math.round((tempoBei(state.l.x) / METER) * 3.6);
    shell.showResult({
      label: "Deine Meter",
      points: punkte,
      detail: rekord ? "Neuer Rekord!" : `${state.wechsel} Wechsel · ${kmh} km/h${vorher ? ` · Bestwert ${vorher} m` : ""}`,
      speech: `${punkte} Meter.${rekord ? " Das ist dein neuer Rekord!" : vorher ? ` Dein Bestwert sind ${vorher} Meter.` : ""}`,
    });
    if (rekord) host.querySelector(".cm-result-detail")?.classList.add("sl-rekord");
    zaehleHoch(punkte);
  }

  // ---------------------------------------------------------------------------
  // Start
  // ---------------------------------------------------------------------------
  shell = shellApi.mount({
    host,
    title: "Schwerkraft-Läufer",
    area: "zahlbuchstabe",
    accent: "#E8543F",
    accentDark: "#a8321f",
    help: HELP,
    clock: false,
    onRestart: startRun,
  });
  gegner = window.LernappGeist?.fuer?.({ spiel: "gravityRun", host, art: "ziel" }) || null;

  startRun();

  host.addEventListener("pointerdown", (event) => {
    if (event.target.closest("button, a, input")) return;
    tippen();
  });

  const TASTEN = new Set([" ", "Enter", "ArrowUp", "ArrowDown"]);
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
  window.LernappSchwerkraft = {
    HOCH, GROSS, BREIT, WECHSEL, METER, state, view, takt, tippen, korridorBis, stueckBei, traegt, tempoBei,
  };
})();
