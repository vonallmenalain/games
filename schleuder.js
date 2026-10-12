/*
 * schleuder.js – Schleuder.
 * ---------------------------------------------------------------------------
 * Unten eine Holzschleuder, oben auf der Wiese eine Zielscheibe. Wer den
 * Finger aufs Bild legt und nach unten zieht, spannt das Gummi: Je weiter
 * gezogen, desto höher trifft der Stein; wer nach links zieht, schiesst nach
 * rechts. Loslassen – und der Stein fliegt in die Tiefe, wird kleiner, und
 * sein Schatten huscht über das Gras.
 *
 * Acht Schüsse. Die ersten drei auf eine Scheibe, die stillsteht; dann
 * pendelt sie hin und her, dann fährt sie eine Acht, und der letzte Schuss
 * geht auf eine schnellere. Dabei wird sie von Schuss zu Schuss kleiner,
 * zuletzt um fast ein Drittel. Ab dem fünften weht Wind – ein Fähnchen
 * zeigt, woher und wie stark. Keine Hilfslinie: Wie weit gezogen werden muss,
 * hat man im Gefühl oder nicht.
 *
 * Gezählt wird nach Ringen: die Mitte 15, dann 10, 7, 4 und 1. Drei Schüsse
 * hintereinander auf 10 oder mehr geben eine Serie und fünf dazu.
 *
 * Gezeichnet wird auf eine Leinwand, in Bildpunkten: Die Szene ist eine
 * Ansicht in die Tiefe, keine Welt mit Kamera. Gerechnet wird in der Ebene
 * der Scheibe (Einheiten: der Radius der grossen Scheibe ist 1).
 */
(() => {
  "use strict";

  if (document.body.dataset.page !== "sling") return;

  const host = document.querySelector("#sl-stage");
  const shellApi = window.LernappGameShell;
  const cloudApi = window.LernappGameCloud;
  const art = window.LernappTrainArt;
  if (!host || !shellApi || !art) return;

  const kids = () => window.LernappKids || null;
  const ruhig = () => Boolean(kids()?.prefersReducedMotion?.());

  // Der Zufall. Ohne Turnier Math.random; im Turnier fährt die Scheibe für
  // alle dieselbe Bahn und weht derselbe Wind (zufall.js). Splitter und
  // Grashalme würfeln weiter Math.random.
  const zufall = window.LernappZufall?.fuer?.("slingShot") || {
    fest: false, neu() {}, zahl: Math.random,
  };

  // ---------------------------------------------------------------------------
  // Regeln
  // ---------------------------------------------------------------------------
  const SCHUESSE = 8;
  const MITTE_Y = 2.2;             // so hoch hängt die Scheibe, in Scheibenradien
  const X_GEWINN = 3;              // ganz zur Seite gezogen: so weit daneben
  const Y_GEWINN = 5.2;            // so viel höher je ganzer Zugweite
  const KRAFT_MITTE = 0.62;        // bei dieser Zugweite trifft der Stein die Höhe der Mitte
  const FLUG_MS = 560;             // so lange fliegt der Stein bis zur Scheibe
  const RUHE_MS = 950;             // bis der nächste Stein in der Schleuder liegt
  const ZUG_MIN = 0.12;            // weniger gezogen: kein Schuss, nur losgelassen

  // Die Ringe, von innen: bis zu welchem Anteil des Radius, und was sie zählen.
  const RINGE = [
    { bis: 0.12, punkte: 15, farbe: "#ffd23f" },
    { bis: 0.35, punkte: 10, farbe: "#e8473f" },
    { bis: 0.6, punkte: 7, farbe: "#3d7fd1" },
    { bis: 0.85, punkte: 4, farbe: "#2b2f3a" },
    { bis: 1, punkte: 1, farbe: "#f4f1e8" },
  ];
  const SERIE = 3;                 // so viele hintereinander auf 10 oder mehr ...
  const SERIE_BONUS = 5;           // ... geben das dazu

  const HELP = [
    "Schleuder. Leg den Finger aufs Bild und zieh nach unten: Je weiter du ziehst, desto höher trifft der Stein.",
    "Ziehst du nach links, fliegt er nach rechts, und umgekehrt. Lass los, dann fliegt er.",
    "Du hast acht Schüsse. Die Mitte zählt 15, die Ringe 10, 7, 4 und 1. Drei Treffer auf 10 oder mehr hintereinander geben fünf dazu.",
    "Erst steht die Scheibe still, dann bewegt sie sich, und ab dem fünften Schuss weht Wind – das Fähnchen zeigt, wohin.",
  ].join(" ");

  const TOP_COUNT = 5;
  const store = cloudApi
    ? cloudApi.register({ key: "lernapp.schleuder", empty: { runs: 0, scores: [] }, merge: cloudApi.mergeScores(TOP_COUNT) })
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
  const von = (a, b) => a + zufall.zahl() * (b - a);

  function hash01(n) {
    const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return x - Math.floor(x);
  }

  // ---------------------------------------------------------------------------
  // Der Schuss n
  // ---------------------------------------------------------------------------
  // Wie die Scheibe sich bewegt und wie der Wind weht, steht fest, bevor die
  // Runde beginnt – allein aus dem Zufall, nie daraus, wie jemand spielt.
  //
  //   still    Schuss 1–3: steht, von Schuss zu Schuss ein Stück woanders
  //   pendel   Schuss 4–5: hin und her
  //   acht     Schuss 6–7: eine liegende Acht
  //   klein    Schuss 8:   kleiner, und eine schnellere Acht
  //
  // Und von Schuss zu Schuss wird die Scheibe ein wenig kleiner.
  const GROESSE = [1, 1, 0.95, 0.92, 0.88, 0.84, 0.8, 0.7];
  function plane() {
    const liste = [];
    for (let n = 0; n < SCHUESSE; n += 1) {
      const art = n < 3 ? "still" : n < 5 ? "pendel" : n < 7 ? "acht" : "klein";
      const wind = n >= 4 ? von(0.25, lerp(0.55, 0.9, (n - 4) / 3)) * (zufall.zahl() < 0.5 ? -1 : 1) : 0;
      liste.push({
        art,
        r: GROESSE[n],
        x0: art === "still" ? von(-1.2, 1.2) : 0,
        y0: art === "still" ? MITTE_Y + von(-0.35, 0.45) : MITTE_Y,
        weite: art === "pendel" ? von(1.1, 1.6) : art === "acht" ? von(1.1, 1.5) : art === "klein" ? 1.5 : 0,
        hoch: art === "acht" ? von(0.35, 0.55) : art === "klein" ? 0.5 : 0,
        periode: art === "pendel" ? von(2.6, 3.2) : art === "acht" ? von(3.2, 3.8) : art === "klein" ? 2.4 : 0,
        ph: zufall.zahl() * Math.PI * 2,
        wind,
      });
    }
    return liste;
  }

  // Wo die Mitte der Scheibe zur Zeit t steht (Sekunden ab Beginn des Schusses).
  function scheibeBei(s, t) {
    if (s.art === "still") return { x: s.x0, y: s.y0 };
    const w = (Math.PI * 2) / s.periode;
    const a = t * w + s.ph;
    if (s.art === "pendel") return { x: Math.sin(a) * s.weite, y: s.y0 };
    return { x: Math.sin(a) * s.weite, y: s.y0 + Math.sin(a * 2) * s.hoch };
  }

  // Wohin der Stein trifft, in der Ebene der Scheibe. kraft 0..1, seite -1..1
  // (Zug nach links ist negativ – der Stein fliegt dann nach rechts).
  function treffpunkt(kraft, seite, wind) {
    return {
      x: -seite * X_GEWINN + wind,
      y: MITTE_Y + (kraft - KRAFT_MITTE) * Y_GEWINN,
    };
  }

  function wertung(abstand) {
    for (const ring of RINGE) if (abstand <= ring.bis) return ring.punkte;
    return 0;
  }

  // ---------------------------------------------------------------------------
  // Zustand
  // ---------------------------------------------------------------------------
  // phase:   "bereit", "spiel", "ende"
  // schritt: "laden" (der Stein kommt), "warten", "ziehen", "flug", "treffer"
  const state = {
    phase: "bereit",
    schritt: "warten",
    plan: [],
    schuss: 0,
    punkte: 0,
    serie: 0,
    ergebnisse: [],       // je Schuss die Punkte (null: noch nicht)
    t: 0,                 // Sekunden seit Beginn des Schusses
    zug: null,            // { sx, sy, dx, dy } – wo gedrückt, wie weit gezogen
    flug: null,           // { kraft, seite, ziel, start, x, y }
    narben: [],           // Treffer auf der Scheibe: { x, y } relativ zur Mitte, in Radien
    wackel: 0,
    gummi: { x: 0, y: 0, vx: 0, vy: 0 },
    teile: [],
    schriften: [],
    zeit: 0,
  };

  let shell = null;
  let feld = null;
  let canvas = null;
  let g = null;
  let frame = null;
  let last = 0;
  let stepTimer = null;
  // Die Gegner (geist.js): Platz 1 und die eigene Bestmarke als Zielmarke.
  let gegner = null;

  const view = { dpr: 1, w: 0, h: 0 };

  function clearStep() {
    if (stepTimer) { window.clearTimeout(stepTimer); stepTimer = null; }
  }

  function stopLoop() {
    if (frame) { window.cancelAnimationFrame(frame); frame = null; }
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

    // Der Hinweis vor dem ersten Schuss: ein Punkt, der nach unten zieht.
    const tipp = shell.el("span", "sl-tipp");
    tipp.setAttribute("aria-hidden", "true");
    tipp.append(art.el("svg", { viewBox: "0 0 64 96" }, [
      art.el("path", { d: "M32 18v52", stroke: "rgba(255,255,255,0.7)", "stroke-width": 5, "stroke-linecap": "round", fill: "none", "stroke-dasharray": "2 9" }),
      art.el("path", { d: "M20 62l12 14 12-14", stroke: "#ffffff", "stroke-width": 5, "stroke-linecap": "round", "stroke-linejoin": "round", fill: "none" }),
      art.el("circle", { class: "sl-tipp-punkt", cx: 32, cy: 18, r: 10, fill: "#ffffff" }),
    ]));
    feld.append(tipp);
    platz.append(feld);
    return platz;
  }

  function messen() {
    if (!canvas || !feld) return;
    const w = Math.max(80, feld.clientWidth);
    const h = Math.max(80, feld.clientHeight);
    const dpr = clamp(window.devicePixelRatio || 1, 1, 2.5);
    if (w === view.w && h === view.h && dpr === view.dpr) return;
    view.w = w;
    view.h = h;
    view.dpr = dpr;
    const pw = Math.round(w * dpr);
    const ph = Math.round(h * dpr);
    if (canvas.width !== pw) canvas.width = pw;
    if (canvas.height !== ph) canvas.height = ph;
  }

  // Die Masse der Szene, aus der Grösse der Fläche.
  function masse() {
    const W = view.w;
    const H = view.h;
    const horizont = H * 0.34;
    // Bildpunkte je Scheibenradius in der Ebene der Scheibe.
    const k = Math.min(W / 7.2, H / 7.4);
    const boden = horizont + k * 1.35;             // wo der Fuss des Gestells steht
    const schleuderY = H * 0.8;
    const ruhe = { x: W / 2, y: schleuderY + Math.min(W, H) * 0.02 };
    const zugMax = Math.max(90, Math.min(W, H) * 0.36);
    // Die Tasche folgt dem Finger, aber nie aus dem Bild: Auf einem flachen
    // Bild geht sie einen kürzeren Weg als der Finger.
    const zugBild = clamp((H - 16 - ruhe.y) / zugMax, 0.3, 1);
    return { W, H, horizont, k, boden, schleuderY, ruhe, zugMax, zugBild };
  }

  // Ebene der Scheibe → Bild.
  function insBild(m, x, y) {
    return { x: m.W / 2 + x * m.k, y: m.boden - y * m.k };
  }

  // ---------------------------------------------------------------------------
  // Zeichnen
  // ---------------------------------------------------------------------------
  function rundRect(x, y, w, h, r) {
    const rad = Math.max(0, Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2));
    g.beginPath();
    g.moveTo(x + rad, y);
    g.lineTo(x + w - rad, y);
    g.quadraticCurveTo(x + w, y, x + w, y + rad);
    g.lineTo(x + w, y + h - rad);
    g.quadraticCurveTo(x + w, y + h, x + w - rad, y + h);
    g.lineTo(x + rad, y + h);
    g.quadraticCurveTo(x, y + h, x, y + h - rad);
    g.lineTo(x, y + rad);
    g.quadraticCurveTo(x, y, x + rad, y);
    g.closePath();
  }

  function kreis(x, y, r) {
    g.beginPath();
    g.arc(x, y, Math.max(0.1, r), 0, Math.PI * 2);
    g.fill();
  }

  function zeichneLandschaft(m) {
    const himmel = g.createLinearGradient(0, 0, 0, m.horizont);
    himmel.addColorStop(0, "#6fb6f0");
    himmel.addColorStop(1, "#cfeaff");
    g.fillStyle = himmel;
    g.fillRect(0, 0, m.W, m.horizont + 1);

    // Wolken treiben mit dem Wind.
    const wind = aktuellerWind();
    g.fillStyle = "rgba(255, 255, 255, 0.85)";
    for (let i = 0; i < 4; i += 1) {
      const treib = ruhig() ? 0 : state.zeit * (6 + hash01(i * 3.3) * 6 + wind * 30);
      const breite = m.W + 160;
      const x = ((hash01(i * 7.1) * breite + treib) % breite + breite) % breite - 80;
      const y = m.horizont * (0.18 + hash01(i * 2.7) * 0.45);
      const r = m.k * (0.32 + hash01(i * 5.9) * 0.22);
      kreis(x, y, r);
      kreis(x + r * 0.9, y - r * 0.3, r * 0.75);
      kreis(x + r * 1.7, y, r * 0.6);
    }

    // Hügel am Horizont.
    g.fillStyle = "#7fbf6a";
    g.beginPath();
    g.moveTo(0, m.horizont + 4);
    for (let i = 0; i <= 8; i += 1) {
      const x = (i / 8) * m.W;
      g.lineTo(x, m.horizont - m.k * (0.15 + hash01(i * 4.1) * 0.35));
    }
    g.lineTo(m.W, m.horizont + 4);
    g.closePath();
    g.fill();

    // Die Wiese, mit gemähten Streifen, die in die Tiefe laufen.
    const wiese = g.createLinearGradient(0, m.horizont, 0, m.H);
    wiese.addColorStop(0, "#8fcf6b");
    wiese.addColorStop(1, "#4f9a3f");
    g.fillStyle = wiese;
    g.fillRect(0, m.horizont, m.W, m.H - m.horizont);
    g.fillStyle = "rgba(255, 255, 255, 0.07)";
    const flucht = m.W / 2;
    for (let i = -6; i <= 6; i += 2) {
      g.beginPath();
      g.moveTo(flucht + i * m.k * 0.18, m.horizont);
      g.lineTo(flucht + (i + 1) * m.k * 0.18, m.horizont);
      g.lineTo(flucht + (i + 1) * m.W * 0.22, m.H);
      g.lineTo(flucht + i * m.W * 0.22, m.H);
      g.closePath();
      g.fill();
    }
  }

  // Der Wind dieses Schusses, und ein Fähnchen, das ihn zeigt.
  function aktuellerWind() {
    return state.plan[state.schuss]?.wind || 0;
  }

  function zeichneFahne(m) {
    const wind = aktuellerWind();
    const x = m.W * 0.86;
    const fuss = m.horizont + m.k * 0.9;
    const kopf = fuss - m.k * 1.9;
    g.strokeStyle = "#5b4636";
    g.lineWidth = Math.max(2, m.k * 0.05);
    g.beginPath();
    g.moveTo(x, fuss);
    g.lineTo(x, kopf);
    g.stroke();
    const staerke = Math.abs(wind);
    const richtung = wind >= 0 ? 1 : -1;
    const lang = m.k * (0.35 + staerke * 0.9);
    const flatter = ruhig() ? 0 : Math.sin(state.zeit * (6 + staerke * 10)) * m.k * 0.06 * (0.3 + staerke);
    g.fillStyle = staerke > 0 ? "#e8473f" : "#c9c2b6";
    g.beginPath();
    g.moveTo(x, kopf);
    if (staerke > 0) {
      g.quadraticCurveTo(x + richtung * lang * 0.5, kopf + flatter, x + richtung * lang, kopf + m.k * 0.12 + flatter);
      g.quadraticCurveTo(x + richtung * lang * 0.5, kopf + m.k * 0.3 - flatter, x, kopf + m.k * 0.32);
    } else {
      // Kein Wind: das Fähnchen hängt.
      g.lineTo(x + m.k * 0.12, kopf + m.k * 0.45);
      g.lineTo(x, kopf + m.k * 0.4);
    }
    g.closePath();
    g.fill();
    if (staerke > 0) {
      g.fillStyle = "rgba(255, 255, 255, 0.92)";
      g.font = `900 ${Math.round(clamp(m.k * 0.32, 11, 16))}px system-ui, sans-serif`;
      g.textAlign = "center";
      g.textBaseline = "top";
      g.fillText(`Wind ${Math.max(1, Math.round(staerke * 5))}`, x, fuss + 4);
    }
  }

  // Die Scheibe auf ihrem Gestell, mit allen Treffern dieses Schusses.
  function zeichneScheibe(m) {
    const s = state.plan[state.schuss];
    if (!s) return;
    const pos = scheibeBei(s, state.t);
    const mitte = insBild(m, pos.x, pos.y);
    const r = s.r * m.k;
    const neig = ruhig() ? 0 : Math.sin(state.zeit * 40) * 0.05 * state.wackel;

    // Das Gestell: zwei Beine, die bis auf den Boden reichen.
    const fussY = m.boden;
    g.strokeStyle = "#7a5230";
    g.lineWidth = Math.max(3, r * 0.11);
    g.lineCap = "round";
    g.beginPath();
    g.moveTo(mitte.x - r * 0.55, mitte.y + r * 0.3);
    g.lineTo(mitte.x - r * 0.8, fussY);
    g.moveTo(mitte.x + r * 0.55, mitte.y + r * 0.3);
    g.lineTo(mitte.x + r * 0.8, fussY);
    g.stroke();
    // Schatten des Gestells.
    g.fillStyle = "rgba(30, 60, 20, 0.25)";
    g.beginPath();
    g.ellipse(mitte.x, fussY + 2, r * 1.1, r * 0.16, 0, 0, Math.PI * 2);
    g.fill();

    g.save();
    g.translate(mitte.x, mitte.y);
    g.rotate(neig);
    g.fillStyle = "#6e4826";
    kreis(0, r * 0.06, r * 1.08);
    for (let i = RINGE.length - 1; i >= 0; i -= 1) {
      g.fillStyle = RINGE[i].farbe;
      kreis(0, 0, r * RINGE[i].bis);
    }
    g.strokeStyle = "rgba(0, 0, 0, 0.18)";
    g.lineWidth = 1;
    RINGE.forEach((ring) => {
      g.beginPath();
      g.arc(0, 0, r * ring.bis, 0, Math.PI * 2);
      g.stroke();
    });
    // Die Treffer: kleine Steine, die in der Scheibe stecken.
    state.narben.forEach((n) => {
      g.fillStyle = "#4a4e5c";
      kreis(n.x * r, -n.y * r, Math.max(2, r * 0.07));
      g.fillStyle = "rgba(255, 255, 255, 0.5)";
      kreis(n.x * r - r * 0.02, -n.y * r - r * 0.02, Math.max(0.8, r * 0.025));
    });
    g.restore();
  }

  // Die Schleuder, das Gummi und der Stein darin.
  function zeichneSchleuder(m) {
    const gabel = Math.min(m.W, m.H) * 0.13;
    const links = { x: m.W / 2 - gabel, y: m.schleuderY - gabel * 0.95 };
    const rechts = { x: m.W / 2 + gabel, y: m.schleuderY - gabel * 0.95 };
    const tasche = taschenOrt(m);

    // Das hintere Gummi liegt hinter der Gabel.
    g.strokeStyle = "#8a3b2a";
    g.lineWidth = Math.max(3, gabel * 0.09);
    g.lineCap = "round";
    g.beginPath();
    g.moveTo(rechts.x, rechts.y);
    g.lineTo(tasche.x, tasche.y);
    g.stroke();

    // Die Gabel.
    const holz = "#8b5a2b";
    g.strokeStyle = holz;
    g.lineWidth = Math.max(8, gabel * 0.26);
    g.beginPath();
    g.moveTo(m.W / 2, m.H + 10);
    g.lineTo(m.W / 2, m.schleuderY + gabel * 0.25);
    g.quadraticCurveTo(m.W / 2, m.schleuderY - gabel * 0.1, links.x, links.y);
    g.moveTo(m.W / 2, m.schleuderY + gabel * 0.25);
    g.quadraticCurveTo(m.W / 2, m.schleuderY - gabel * 0.1, rechts.x, rechts.y);
    g.stroke();
    g.strokeStyle = "#b07a42";
    g.lineWidth = Math.max(2, gabel * 0.08);
    g.beginPath();
    g.moveTo(m.W / 2 - gabel * 0.05, m.H + 10);
    g.lineTo(m.W / 2 - gabel * 0.05, m.schleuderY + gabel * 0.25);
    g.stroke();

    // Der Stein in der Tasche – ausser, er fliegt gerade.
    const steinR = Math.max(7, gabel * 0.32);
    if (!state.flug && state.schritt !== "laden") {
      g.fillStyle = "rgba(0, 0, 0, 0.18)";
      kreis(tasche.x + 3, tasche.y + 4, steinR);
      zeichneStein(tasche.x, tasche.y, steinR, 0);
    }
    // Die Tasche aus Leder.
    g.fillStyle = "#5a3418";
    g.beginPath();
    g.ellipse(tasche.x, tasche.y + steinR * 0.35, steinR * 1.25, steinR * 0.55, 0, 0, Math.PI);
    g.fill();

    // Das vordere Gummi liegt vor dem Stein.
    g.strokeStyle = "#a8472f";
    g.lineWidth = Math.max(3, gabel * 0.09);
    g.beginPath();
    g.moveTo(links.x, links.y);
    g.lineTo(tasche.x, tasche.y);
    g.stroke();
  }

  function taschenOrt(m) {
    if (state.zug) {
      const z = zugVektor(m);
      return { x: m.ruhe.x + z.dx * m.zugBild, y: m.ruhe.y + z.dy * m.zugBild };
    }
    return { x: m.ruhe.x + state.gummi.x, y: m.ruhe.y + state.gummi.y };
  }

  function zeichneStein(x, y, r, dreh) {
    g.save();
    g.translate(x, y);
    g.rotate(dreh);
    g.fillStyle = "#7d8494";
    g.beginPath();
    g.ellipse(0, 0, r, r * 0.86, 0.3, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "#a5acba";
    g.beginPath();
    g.ellipse(-r * 0.25, -r * 0.25, r * 0.45, r * 0.3, 0.3, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "#5d6372";
    kreis(r * 0.35, r * 0.3, r * 0.14);
    g.restore();
  }

  // Der Stein im Flug: vom Gummi in die Tiefe, immer kleiner, auf einem Bogen
  // – und sein Schatten auf dem Gras darunter.
  function zeichneFlug(m) {
    const f = state.flug;
    if (!f) return;
    const k = clamp((performance.now() - f.start) / FLUG_MS, 0, 1);
    const tiefe = 1 - Math.pow(1 - k, 1.6);
    const ziel = insBild(m, f.ziel.x, Math.max(f.ziel.y, -0.2));
    const x = lerp(m.ruhe.x, ziel.x, tiefe);
    const bogen = Math.sin(k * Math.PI) * m.H * 0.16;
    const y = lerp(m.ruhe.y, ziel.y, tiefe) - bogen;
    const gabel = Math.min(m.W, m.H) * 0.13;
    const r = lerp(Math.max(7, gabel * 0.32), Math.max(2.5, m.k * 0.08), tiefe);
    const schattenY = lerp(m.H * 0.92, m.boden + 2, tiefe);
    g.fillStyle = `rgba(20, 50, 15, ${0.25 * (1 - k * 0.5)})`;
    g.beginPath();
    g.ellipse(x, schattenY, r * 1.1, r * 0.35, 0, 0, Math.PI * 2);
    g.fill();
    zeichneStein(x, y, r, k * 9);
  }

  function zeichneTeile() {
    state.teile.forEach((t) => {
      g.globalAlpha = clamp(t.leben / t.max, 0, 1);
      g.fillStyle = t.farbe;
      kreis(t.x, t.y, t.r);
    });
    g.globalAlpha = 1;
  }

  // Oben links: welcher Schuss, und wie die bisherigen waren – ein Punkt je
  // Schuss, in der Farbe des Rings, den er traf.
  function zeichneAnzeige(m) {
    const gross = clamp(m.H * 0.04, 12, 18);
    g.font = `900 ${Math.round(gross)}px system-ui, sans-serif`;
    g.textAlign = "left";
    g.textBaseline = "middle";
    const text = state.schuss < SCHUESSE ? `Schuss ${state.schuss + 1}/${SCHUESSE}` : "Fertig";
    const w = g.measureText(text).width + gross * 1.1;
    g.fillStyle = "rgba(20, 40, 60, 0.45)";
    rundRect(10, 10, w, gross * 1.7, gross * 0.85);
    g.fill();
    g.fillStyle = "#ffffff";
    g.fillText(text, 10 + gross * 0.55, 10 + gross * 0.86);
    const punktR = gross * 0.32;
    for (let i = 0; i < SCHUESSE; i += 1) {
      const x = 10 + punktR + i * punktR * 2.7;
      const y = 10 + gross * 1.7 + punktR + 6;
      const e = state.ergebnisse[i];
      g.fillStyle = e === null || e === undefined
        ? (i === state.schuss ? "rgba(255, 255, 255, 0.95)" : "rgba(255, 255, 255, 0.45)")
        : e === 0 ? "#7d8494" : (RINGE.find((ring) => ring.punkte === e)?.farbe || "#ffffff");
      kreis(x, y, punktR);
      if (i === state.schuss && state.phase !== "ende") {
        g.strokeStyle = "rgba(20, 40, 60, 0.6)";
        g.lineWidth = 1.5;
        g.beginPath();
        g.arc(x, y, punktR + 2, 0, Math.PI * 2);
        g.stroke();
      }
    }
    if (state.serie >= 2) {
      g.font = `900 ${Math.round(gross * 0.85)}px system-ui, sans-serif`;
      g.fillStyle = "#ffe066";
      g.fillText(`Serie ×${state.serie}`, 10, 10 + gross * 1.7 + punktR * 2 + 20);
    }
  }

  function zeichneSchriften() {
    g.textAlign = "center";
    g.textBaseline = "middle";
    state.schriften.forEach((s) => {
      const k = clamp(s.leben / s.max, 0, 1);
      g.globalAlpha = Math.min(1, k * 2);
      g.font = `900 ${Math.round(s.gross)}px system-ui, sans-serif`;
      g.lineWidth = 4;
      g.strokeStyle = "rgba(20, 30, 50, 0.55)";
      const y = s.y - (1 - k) * 26;
      g.strokeText(s.text, s.x, y);
      g.fillStyle = s.farbe;
      g.fillText(s.text, s.x, y);
    });
    g.globalAlpha = 1;
  }

  function zeichnen() {
    if (!g) return;
    const m = masse();
    g.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
    g.clearRect(0, 0, m.W, m.H);
    zeichneLandschaft(m);
    zeichneFahne(m);
    // Was zu kurz fliegt, fällt vor der Scheibe ins Gras; was trifft oder
    // darüber geht, fliegt bis in ihre Ebene. Hinter der Scheibe ist nichts.
    const vorne = state.flug && state.flug.ziel.y < 0;
    if (!vorne) zeichneFlugHinten(m);
    zeichneScheibe(m);
    if (vorne) zeichneFlug(m);
    zeichneTeile();
    zeichneSchleuder(m);
    if (!vorne) zeichneFlugVorne(m);
    zeichneAnzeige(m);
    zeichneSchriften();
  }

  // Ein Stein, der trifft oder darüber fliegt, ist bis kurz vor dem Ende vor
  // der Scheibe zu sehen; wer daneben oder darüber geht, verschwindet am Ende
  // dahinter.
  function zeichneFlugVorne(m) {
    const f = state.flug;
    if (!f) return;
    const k = (performance.now() - f.start) / FLUG_MS;
    if (k < 0.97 || f.trifft) zeichneFlug(m);
  }

  function zeichneFlugHinten(m) {
    const f = state.flug;
    if (!f || f.trifft) return;
    const k = (performance.now() - f.start) / FLUG_MS;
    if (k >= 0.97) zeichneFlug(m);
  }

  // ---------------------------------------------------------------------------
  // Ziehen und Schiessen
  // ---------------------------------------------------------------------------
  // Gezogen wird von dort, wo der Finger aufgesetzt hat – nicht von der
  // Tasche aus: Auf einem kleinen Bildschirm trifft niemand die Tasche, und
  // es soll nicht darauf ankommen.
  function zugVektor(m) {
    const z = state.zug;
    let dx = z.dx;
    let dy = Math.max(-m.zugMax * 0.15, z.dy);
    const lang = Math.hypot(dx, dy);
    if (lang > m.zugMax) { dx *= m.zugMax / lang; dy *= m.zugMax / lang; }
    return { dx, dy, kraft: clamp(Math.max(0, dy) / m.zugMax, 0, 1), seite: clamp(dx / m.zugMax, -1, 1) };
  }

  function druecken(event) {
    if (state.phase === "ende" || state.schritt !== "warten") return;
    if (state.phase === "bereit") {
      state.phase = "spiel";
      shell.setPhase("play");
      gegner?.los();
    }
    state.zug = { sx: event.clientX, sy: event.clientY, dx: 0, dy: 0, id: event.pointerId };
    state.schritt = "ziehen";
    try { host.setPointerCapture(event.pointerId); } catch { /* dann ohne Bindung */ }
  }

  function ziehen(event) {
    const z = state.zug;
    if (!z || state.schritt !== "ziehen" || event.pointerId !== z.id) return;
    z.dx = event.clientX - z.sx;
    z.dy = event.clientY - z.sy;
  }

  function loslassen(event) {
    const z = state.zug;
    if (!z || state.schritt !== "ziehen" || (event && event.pointerId !== z.id)) return;
    const m = masse();
    const v = zugVektor(m);
    state.zug = null;
    // Kaum gezogen: das war kein Schuss, nur ein Tipp.
    if (v.kraft < ZUG_MIN) {
      state.gummi = { x: v.dx * m.zugBild, y: v.dy * m.zugBild, vx: 0, vy: 0 };
      state.schritt = "warten";
      return;
    }
    schiessen(v, m);
  }

  function schiessen(v, m) {
    const s = state.plan[state.schuss];
    const ziel = treffpunkt(v.kraft, v.seite, s.wind);
    const ankunft = state.t + FLUG_MS / 1000;
    const scheibe = scheibeBei(s, ankunft);
    const dx = (ziel.x - scheibe.x) / s.r;
    const dy = (ziel.y - scheibe.y) / s.r;
    const abstand = Math.hypot(dx, dy);
    const punkte = wertung(abstand);
    state.flug = {
      kraft: v.kraft, seite: v.seite, ziel, start: performance.now(),
      trifft: punkte > 0, punkte, rel: { x: dx, y: dy },
    };
    state.schritt = "flug";
    // Das Gummi schnellt zurück und schwingt nach.
    state.gummi = { x: v.dx * m.zugBild * -0.35, y: v.dy * m.zugBild * -0.35, vx: 0, vy: 0 };
    kids()?.vibrate?.(10);
    stepTimer = window.setTimeout(ankommen, FLUG_MS);
  }

  function ankommen() {
    const f = state.flug;
    const s = state.plan[state.schuss];
    const m = masse();
    const scheibe = scheibeBei(s, state.t);
    const bild = insBild(m, f.ziel.x, Math.max(-0.2, f.ziel.y));
    let plus = f.punkte;
    if (f.trifft) {
      state.narben.push(f.rel);
      state.wackel = 1;
      splitter(bild.x, bild.y, "#d9b77c", 10);
      if (plus >= 10) state.serie += 1;
      else state.serie = 0;
      let text = `+${plus}`;
      if (plus === 15) text = "Mitte! +15";
      if (state.serie >= SERIE && state.serie % SERIE === 0) {
        plus += SERIE_BONUS;
        text += ` · Serie +${SERIE_BONUS}`;
        kids()?.playJingle?.("unlock");
      } else {
        kids()?.playJingle?.(plus >= 10 ? "correct" : "star");
      }
      const p = insBild(m, scheibe.x, scheibe.y + s.r * 1.4);
      schrift(text, p.x, p.y, plus >= 10 ? "#ffe066" : "#ffffff", clamp(m.k * 0.42, 15, 26));
      kids()?.vibrate?.(plus >= 15 ? [16, 30, 16] : 14);
    } else {
      state.serie = 0;
      if (f.ziel.y < 0) splitter(bild.x, insBild(m, 0, 0).y, "#6a9f4a", 8);
      const p = insBild(m, scheibe.x, scheibe.y + s.r * 1.4);
      schrift("Daneben", p.x, p.y, "#ffffff", clamp(m.k * 0.36, 14, 22));
      kids()?.playJingle?.("retry");
    }
    state.ergebnisse[state.schuss] = f.punkte;
    state.punkte += plus;
    shell.setCount(state.punkte);
    gegner?.takt(state.punkte);
    state.flug = null;
    state.schritt = "treffer";
    stepTimer = window.setTimeout(naechster, RUHE_MS);
  }

  function naechster() {
    stepTimer = null;
    if (state.schuss + 1 >= SCHUESSE) { finish(); return; }
    state.schuss += 1;
    state.t = 0;
    state.narben = [];
    state.schritt = "laden";
    stepTimer = window.setTimeout(() => {
      stepTimer = null;
      state.schritt = "warten";
    }, 260);
  }

  function splitter(x, y, farbe, anzahl) {
    for (let i = 0; i < anzahl; i += 1) {
      const w = Math.random() * Math.PI * 2;
      const v = 40 + Math.random() * 120;
      state.teile.push({ x, y, vx: Math.cos(w) * v, vy: Math.sin(w) * v - 60, r: 1.5 + Math.random() * 2.5, leben: 0.6, max: 0.6, farbe });
    }
  }

  function schrift(text, x, y, farbe, gross) {
    state.schriften.push({ text, x, y, farbe, gross, leben: 1.1, max: 1.1 });
  }

  // ---------------------------------------------------------------------------
  // Die Schleife
  // ---------------------------------------------------------------------------
  function schritt(dt) {
    state.zeit += dt;
    // Die Uhr der Scheibe läuft, solange geschossen wird – auch während der
    // Stein fliegt.
    if (state.schritt !== "treffer" && state.schritt !== "laden") state.t += dt;
    if (state.wackel > 0) state.wackel = Math.max(0, state.wackel - dt * 3);

    // Das Gummi schwingt nach dem Schuss in seine Ruhe zurück.
    const gu = state.gummi;
    if (!state.zug) {
      const feder = 260;
      const daempf = 14;
      gu.vx += (-gu.x * feder - gu.vx * daempf) * dt;
      gu.vy += (-gu.y * feder - gu.vy * daempf) * dt;
      gu.x += gu.vx * dt;
      gu.y += gu.vy * dt;
    }

    for (let i = state.teile.length - 1; i >= 0; i -= 1) {
      const t = state.teile[i];
      t.vy += 420 * dt;
      t.x += t.vx * dt;
      t.y += t.vy * dt;
      t.leben -= dt;
      if (t.leben <= 0) state.teile.splice(i, 1);
    }
    for (let i = state.schriften.length - 1; i >= 0; i -= 1) {
      state.schriften[i].leben -= dt;
      if (state.schriften[i].leben <= 0) state.schriften.splice(i, 1);
    }
  }

  function loop(now) {
    frame = window.requestAnimationFrame(loop);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    messen();
    schritt(dt);
    zeichnen();
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
    state.schritt = "warten";
    state.plan = plane();
    state.schuss = 0;
    state.punkte = 0;
    state.serie = 0;
    state.ergebnisse = new Array(SCHUESSE).fill(null);
    state.t = 0;
    state.zug = null;
    state.flug = null;
    state.narben = [];
    state.wackel = 0;
    state.gummi = { x: 0, y: 0, vx: 0, vy: 0 };
    state.teile = [];
    state.schriften = [];
    state.zeit = 0;
    shell.setCount(0);
    gegner?.runde();

    shell.clear();
    const prompt = shell.el("p", "cm-prompt sl-prompt", "Zieh nach unten und lass los.");
    shell.play.append(prompt, buildPlatz());
    view.w = 0;
    view.h = 0;
    messen();

    last = performance.now();
    frame = window.requestAnimationFrame(loop);
  }

  function zaehleHoch(ziel) {
    const zahl = host.querySelector(".cm-result-score");
    if (!zahl) return;
    if (ruhig() || ziel <= 1) { zahl.textContent = String(ziel); return; }
    const dauer = Math.min(700, 120 + ziel * 6);
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
    const mitten = state.ergebnisse.filter((e) => e === 15).length;
    const treffer = state.ergebnisse.filter((e) => e > 0).length;
    const satz = `${treffer} von ${SCHUESSE} getroffen${mitten ? ` · ${mitten}× Mitte` : ""}`;
    shell.showResult({
      label: "Deine Punkte",
      points: punkte,
      detail: rekord ? "Neuer Rekord!" : `${satz}${vorher ? ` · Bestwert ${vorher}` : ""}`,
      speech: `${punkte} Punkte. ${treffer} von ${SCHUESSE} Schüssen getroffen.${rekord ? " Das ist dein neuer Rekord!" : ""}`,
    });
    if (rekord) host.querySelector(".cm-result-detail")?.classList.add("sl-rekord");
    zaehleHoch(punkte);
  }

  // ---------------------------------------------------------------------------
  // Start
  // ---------------------------------------------------------------------------
  shell = shellApi.mount({
    host,
    title: "Schleuder",
    area: "problemloesen",
    accent: "#3FA34D",
    accentDark: "#2c7337",
    help: HELP,
    clock: false,
    onRestart: startRun,
  });
  gegner = window.LernappGeist?.fuer?.({ spiel: "slingShot", host, art: "ziel" }) || null;

  startRun();

  host.addEventListener("pointerdown", (event) => {
    if (event.target.closest("button, a, input")) return;
    druecken(event);
  });
  host.addEventListener("pointermove", ziehen);
  host.addEventListener("pointerup", loslassen);
  host.addEventListener("pointercancel", () => {
    if (state.schritt === "ziehen") { state.zug = null; state.schritt = "warten"; }
  });

  window.addEventListener("resize", messen);
  window.addEventListener("orientationchange", messen);
  window.addEventListener("pagehide", () => { clearStep(); stopLoop(); });

  // Für die Prüfskripte.
  window.LernappSchleuder = {
    SCHUESSE, RINGE, KRAFT_MITTE, X_GEWINN, Y_GEWINN, FLUG_MS,
    state, plane, scheibeBei, treffpunkt, wertung, masse,
  };
})();
