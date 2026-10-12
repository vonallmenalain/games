/*
 * liane.js – Lianenschwung.
 * ---------------------------------------------------------------------------
 * Ein Affe schwingt an Lianen über den Fluss. Wer den Finger aufs Bild legt,
 * hält sich fest; wer loslässt, fliegt. Und wer im Flug wieder drückt, greift
 * die nächste Liane – die am Ast mit dem Ring.
 *
 * Die Kunst liegt im Wann. Wer zu früh loslässt, fliegt flach und landet im
 * Wasser; wer zu spät loslässt, fliegt steil hoch und kommt kaum voran. Und
 * wer zu früh wieder greift, hängt an einer langen Liane – deren tiefster
 * Punkt liegt dann im Fluss. Der Ring sagt es: gelb heisst, die Liane trägt;
 * rot heisst, sie ist noch zu lang.
 *
 * Eine Runde dauert vierzig Sekunden, oder bis der Affe ins Wasser fällt.
 * Jeder Meter zählt einen Punkt, jede Banane zehn, und wer einen Ast
 * überspringt, bekommt fünf dazu.
 *
 * Schwerer wird es mit jedem Ast, nicht mit der Zeit: Die Äste hängen weiter
 * auseinander und tiefer. Ab dem achten schwanken manche im Wind, ab dem
 * vierzehnten sind manche morsch und brechen, wenn der Affe zu lange daran
 * hängt.
 *
 * Wer mag, schwingt nicht allein: Platz 1 und die eigene Bestmarke fliegen
 * als Geister mit (geist.js) – an Lianen, die nur sie sehen, aber genau so
 * weit, wie sie zu dieser Sekunde gekommen waren.
 *
 * Gezeichnet wird wie beim Brückenbauer auf eine Leinwand, gerechnet in
 * Welteinheiten – zehn sind ein Meter. Fest steht die Höhe: SICHT_H Einheiten
 * im Querformat. Im Hochformat bleibt die Welt WELT_W breit, und darüber
 * steht mehr Blätterdach.
 */
(() => {
  "use strict";

  if (document.body.dataset.page !== "vine") return;

  const host = document.querySelector("#li-stage");
  const shellApi = window.LernappGameShell;
  const cloudApi = window.LernappGameCloud;
  const art = window.LernappTrainArt;
  if (!host || !shellApi || !art) return;

  const kids = () => window.LernappKids || null;
  const ruhig = () => Boolean(kids()?.prefersReducedMotion?.());

  // Der Zufall. Ohne Turnier Math.random; im Turnier hängen für alle dieselben
  // Äste an denselben Stellen (zufall.js). Blätter und Spritzer würfeln weiter
  // Math.random – sie hängen daran, wie jemand spielt.
  const zufall = window.LernappZufall?.fuer?.("vineSwing") || {
    fest: false, neu() {}, zahl: Math.random,
  };

  // ---------------------------------------------------------------------------
  // Die Welt
  // ---------------------------------------------------------------------------
  // y zählt nach oben. Bei null liegt der Grund des Flusses, bis WASSER steht
  // das Wasser.
  const WELT_W = 300;
  const WELT_W_MAX = 640;
  const SICHT_H = 300;
  const WASSER = 26;
  const METER = 10;
  const RUNDE_MS = 40000;

  // Der Schwung. Die Zahlen sind ausgespielt: Ein Pendel von gut zehn Metern
  // schwingt in gut zwei Sekunden hin und her – schnell genug, dass es zieht,
  // langsam genug, dass jemand den Augenblick zum Loslassen trifft.
  const G = 720;                   // Fallbeschleunigung
  const LUFT = 0.04;               // so viel Tempo frisst die Luft je Sekunde
  const PUMP = 80;                 // wer vorwärts schwingt, legt sich hinein
  const V_MAX = 700;
  const UMLENK = 0.55;             // so viel vom Schwung zur Liane hin bleibt beim Greifen
  const TAKT = 1 / 240;            // gerechnet wird in festen kleinen Schritten

  const REICH = 165;               // so weit reicht der Griff
  const SEIL_MIN = 30;             // kürzer hängt keine Liane
  const AFFE_GROSS = 1.3;          // gezeichnet ist er knapp 30 Einheiten gross
  const KOERPER = 12.6 * AFFE_GROSS;   // von der Mitte bis an die Füsse
  const HAND = 15;                 // von der Mitte bis an die Hände (ungestreckt)
  // Tiefer darf eine Liane nicht schwingen: sonst taucht der Affe ein.
  const SICHER = WASSER + KOERPER + 3;

  const BANANE = 10;               // Punkte für eine Banane
  const WEIT = 5;                  // Punkte für jeden übersprungenen Ast

  const BRUCH_MS = 1150;           // so lange trägt ein morscher Ast

  // Wie schwer der nächste Ast ist – nach Nummer, nicht nach Zeit.
  const SCHWER_BIS = 24;
  const BEWEGT_AB = 8;
  const MORSCH_AB = 14;

  // Hier beginnt jeder: auf dem Ast eines Baums, die erste Liane in der Hand.
  const START = { x: -88, y: 171 };
  const ERSTER = { x: 0, y: 240 };

  const HELP = [
    "Lianenschwung. Halte den Finger auf dem Bild, dann springt der Affe ab und schwingt an der Liane.",
    "Lass los, dann fliegt er. Drück wieder, dann greift er die nächste Liane – die am Ast mit dem Ring.",
    "Ist der Ring rot, ist die Liane noch zu lang: Der Affe würde ins Wasser schwingen. Warte, bis er gelb ist.",
    "Jeder Meter zählt einen Punkt, jede Banane zehn. Wer einen Ast überspringt, bekommt fünf dazu.",
    "Du hast vierzig Sekunden. Später hängen die Äste weiter auseinander, manche schwanken, und morsche brechen, wenn du zu lange daran hängst.",
  ].join(" ");

  const TOP_COUNT = 5;
  const store = cloudApi
    ? cloudApi.register({ key: "lernapp.liane", empty: { runs: 0, scores: [] }, merge: cloudApi.mergeScores(TOP_COUNT) })
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

  // Immer dieselbe Zahl zu derselben Eingabe: Bäume, Seerosen und Blätter
  // stehen bei jedem Neustart am selben Platz.
  function hash01(n) {
    const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return x - Math.floor(x);
  }

  // Der kürzeste Weg von Winkel a nach Winkel b.
  function winkelDiff(a, b) {
    let d = (b - a) % (Math.PI * 2);
    if (d > Math.PI) d -= Math.PI * 2;
    if (d < -Math.PI) d += Math.PI * 2;
    return d;
  }

  // ---------------------------------------------------------------------------
  // Zustand
  // ---------------------------------------------------------------------------
  // phase:   "bereit" (noch nichts gedrückt), "spiel", "ende"
  // schritt: "start" (der Affe steht auf dem Baum), "schwingen", "fliegen",
  //          "platsch" (ins Wasser) und "ende" (die Zeit ist um)
  const state = {
    phase: "bereit",
    schritt: "start",
    punkte: 0,
    meter: 0,
    bonus: 0,
    bananen: 0,
    anker: [],            // { x, y, basis, hoehe, weite, periode, ph, t, morsch, halt, weg, saat }
    fruechte: [],         // { x, y, weg, saat }
    haken: -1,            // an welchem Ast der Affe hängt
    seil: 0,              // wie lang die Liane ist, an der er hängt
    letzter: 0,           // der weiteste Ast, den er gegriffen hat
    ziel: -1,             // der Ast, den er greifen würde
    greift: false,        // im Flug gedrückt: greift, sobald ein Ast in Reichweite ist
    p: { x: START.x, y: START.y, vx: 0, vy: 0 },
    dreh: 0,
    maxX: START.x,
    camX: 0,
    camY: 0,
    spur: [],
    teile: [],
    schriften: [],
    ringe: [],
    stoss: 0,
    zeit: 0,
  };

  let shell = null;
  let feld = null;
  let canvas = null;
  let g = null;
  let frame = null;
  let last = 0;
  let stepTimer = null;
  let gedrueckt = false;
  // Die Gegner (geist.js): wer mitfliegt, und wo er gerade ist.
  let gegner = null;

  const view = { s: 1, dpr: 1, cssW: 0, cssH: 0, w: WELT_W, h: SICHT_H };

  function clearStep() {
    if (stepTimer) { window.clearTimeout(stepTimer); stepTimer = null; }
  }

  function stopLoop() {
    if (frame) { window.cancelAnimationFrame(frame); frame = null; }
  }

  // ---------------------------------------------------------------------------
  // Äste und Bananen
  // ---------------------------------------------------------------------------
  // Der Ast i hängt dort, wo ihn der i-te Schwung erreichen soll. Seine Lage
  // hängt allein an i und am Zufall – nie daran, wie jemand spielt. Mit ihm
  // entsteht die Banane, die davor in der Luft hängt (oder keine).
  function neuerAnker(i, vorher) {
    const k = clamp(i / SCHWER_BIS, 0, 1);
    const dx = von(lerp(98, 128, k), lerp(138, 192, k));
    const hoehe = von(lerp(214, 184, k), lerp(256, 262, k));
    const wurf = zufall.zahl();
    const bewegt = i >= BEWEGT_AB && wurf < lerp(0.3, 0.55, clamp((i - BEWEGT_AB) / 12, 0, 1));
    const morsch = !bewegt && i >= MORSCH_AB && wurf > 1 - lerp(0.3, 0.5, clamp((i - MORSCH_AB) / 10, 0, 1));
    const weite = bewegt ? von(12, lerp(20, 30, k)) : 0;
    const periode = bewegt ? von(1.7, 2.8) : 0;
    const ph = zufall.zahl() * Math.PI * 2;
    const basis = vorher.basis + dx;
    const a = {
      x: basis, y: hoehe, basis, hoehe, weite, periode, ph,
      t: 0, morsch, halt: 0, weg: false, saat: hash01(i * 3.7 + 0.4),
    };
    bewegeAnker(a);

    // Die Banane: meist auf halbem Weg, mal tief, mal so hoch, dass nur ein
    // steiler Flug sie holt.
    const frucht = zufall.zahl();
    const fx = vorher.basis + dx * von(0.35, 0.7);
    const fy = Math.min(vorher.hoehe, hoehe) - von(28, 96);
    if (frucht < 0.62 && i > 0) {
      state.fruechte.push({ x: fx, y: Math.max(SICHER + 42, fy), weg: false, saat: hash01(i * 1.9) });
    }
    return a;
  }

  // Ein schwankender Ast pendelt wie ein Zweig im Wind – an den Enden etwas
  // höher. Er hat seine eigene Uhr: Solange der Affe daran hängt, steht sie
  // still, und danach schwankt er dort weiter, wo er war.
  function bewegeAnker(a) {
    if (!a.weite) return;
    const s = Math.sin(a.t * (Math.PI * 2 / a.periode) + a.ph);
    a.x = a.basis + s * a.weite;
    a.y = a.hoehe + s * s * a.weite * 0.2;
  }

  function aesteBis(x) {
    while (state.anker[state.anker.length - 1].basis < x) {
      const i = state.anker.length;
      state.anker.push(neuerAnker(i, state.anker[i - 1]));
    }
  }

  // ---------------------------------------------------------------------------
  // Die Fläche
  // ---------------------------------------------------------------------------
  function buildPlatz() {
    const platz = shell.el("div", "li-platz");
    feld = shell.el("div", "li-feld");
    canvas = document.createElement("canvas");
    canvas.className = "li-canvas";
    canvas.setAttribute("aria-hidden", "true");
    feld.append(canvas);
    g = canvas.getContext("2d");

    // Der Hinweis vor dem ersten Druck: ein Ring, der sich füllt – halten,
    // nicht tippen.
    const tipp = shell.el("span", "li-tipp");
    tipp.setAttribute("aria-hidden", "true");
    tipp.append(art.el("svg", { viewBox: "0 0 64 64" }, [
      art.el("circle", { cx: 32, cy: 32, r: 22, fill: "none", stroke: "rgba(255,255,255,0.45)", "stroke-width": 5 }),
      art.el("circle", { class: "li-tipp-fuell", cx: 32, cy: 32, r: 22, fill: "none", stroke: "#ffffff", "stroke-width": 5, "stroke-linecap": "round" }),
      art.el("circle", { cx: 32, cy: 32, r: 9, fill: "#ffffff" }),
    ]));
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
  }

  // Der Affe steht ein Drittel vom linken Rand: Nach vorn sieht man weiter.
  const camXZiel = () => state.p.x - view.w * 0.32 + clamp(state.p.vx * 0.1, -20, 45);
  // Das Wasser bleibt unten im Bild – ausser der Affe fliegt höher hinauf.
  const camYZiel = () => Math.max(0, state.p.y + 70 - view.h);

  const wackel = () => (ruhig() ? 0 : Math.sin(state.zeit * 70) * 2.2 * state.stoss);

  function bildTransform() {
    g.setTransform(view.dpr, 0, 0, view.dpr, 0, wackel() * view.dpr);
  }

  function weltTransform() {
    const f = view.s * view.dpr;
    g.setTransform(f, 0, 0, -f, -state.camX * f, (view.cssH + state.camY * view.s + wackel()) * view.dpr);
  }

  const bildX = (x) => (x - state.camX) * view.s;
  const bildY = (y) => view.cssH - (y - state.camY) * view.s;
  const oben = () => state.camY + view.h;

  function kreis(x, y, r) {
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
  }

  function oval(x, y, rx, ry, dreh = 0) {
    g.beginPath();
    g.ellipse(x, y, rx, ry, dreh, 0, Math.PI * 2);
    g.fill();
  }

  function welle(x) {
    if (ruhig()) return Math.sin(x * 0.06) * 1.2;
    return Math.sin(x * 0.06 + state.zeit * 2.2) * 1.6 + Math.sin(x * 0.023 - state.zeit * 1.3) * 1.2;
  }

  // ---------------------------------------------------------------------------
  // Der Dschungel dahinter
  // ---------------------------------------------------------------------------
  function zeichneHintergrund() {
    bildTransform();
    const verlauf = g.createLinearGradient(0, 0, 0, view.cssH);
    verlauf.addColorStop(0, "#0c3a2b");
    verlauf.addColorStop(0.55, "#1d6b48");
    verlauf.addColorStop(1, "#9bd8a3");
    g.fillStyle = verlauf;
    g.fillRect(0, -10, view.cssW, view.cssH + 20);

    // Licht, das schräg durchs Blätterdach fällt.
    const puls = ruhig() ? 0 : state.zeit;
    for (let i = 0; i < 4; i += 1) {
      const breite = view.cssW + 300;
      const x0 = ((hash01(i * 4.1) * breite - state.camX * view.s * 0.06) % breite + breite) % breite - 150;
      const w0 = (18 + hash01(i * 8.3) * 30) * view.s;
      g.fillStyle = `rgba(255, 252, 214, ${0.05 + 0.03 * Math.sin(puls * 0.8 + i * 1.7)})`;
      g.beginPath();
      g.moveTo(x0, 0);
      g.lineTo(x0 + w0, 0);
      g.lineTo(x0 + w0 + view.cssH * 0.45, view.cssH);
      g.lineTo(x0 + view.cssH * 0.45, view.cssH);
      g.closePath();
      g.fill();
    }

    fernBaeume(0.18, 70, "rgba(16, 72, 52, 0.75)", 3.3, 12);
    fernBaeume(0.42, 110, "rgba(10, 52, 38, 0.8)", 7.9, 20);
    haengeLianen(0.6);
  }

  // Eine Reihe Bäume in der Ferne, die langsamer mitzieht als der Affe.
  function fernBaeume(tiefe, abstand, farbe, saat, dicke) {
    const versatz = state.camX * tiefe;
    const erster = Math.floor(versatz / abstand) - 1;
    const anzahl = Math.ceil(view.w / abstand) + 3;
    const wasser = bildY(WASSER);
    g.fillStyle = farbe;
    for (let i = 0; i <= anzahl; i += 1) {
      const n = erster + i;
      const sx = (n * abstand + hash01(n * 1.7 + saat) * abstand * 0.6 - versatz) * view.s;
      const b = dicke * (0.6 + hash01(n * 2.3 + saat) * 0.8) * view.s;
      g.fillRect(sx - b / 2, 0, b, wasser);
      for (let j = 0; j < 3; j += 1) {
        const by = wasser * (0.06 + hash01(n * 5.1 + j * 1.3 + saat) * 0.55);
        const r = (12 + hash01(n * 3.3 + j + saat) * 16) * view.s;
        kreis(sx + (hash01(n + j * 9.1 + saat) - 0.5) * r * 1.6, by, r);
      }
    }
  }

  // Dünne Lianen als Schmuck – sie tragen nichts.
  function haengeLianen(tiefe) {
    const versatz = state.camX * tiefe;
    const abstand = 54;
    const erster = Math.floor(versatz / abstand) - 1;
    const anzahl = Math.ceil(view.w / abstand) + 3;
    g.strokeStyle = "rgba(20, 70, 40, 0.55)";
    g.lineWidth = Math.max(1, 1.6 * view.s);
    g.lineCap = "round";
    for (let i = 0; i <= anzahl; i += 1) {
      const n = erster + i;
      if (hash01(n * 6.1) < 0.45) continue;
      const sx = (n * abstand + hash01(n * 2.9) * abstand - versatz) * view.s;
      const lang = view.cssH * (0.2 + hash01(n * 4.7) * 0.35);
      const schwank = ruhig() ? 0 : Math.sin(state.zeit * 0.9 + n) * 6 * view.s;
      g.beginPath();
      g.moveTo(sx, -4);
      g.quadraticCurveTo(sx + schwank, lang * 0.6, sx + schwank * 0.4, lang);
      g.stroke();
    }
  }

  // Das Blätterdach oben. Es zieht mit dem Bild, steht aber immer am oberen
  // Rand – die Äste hängen daraus herab.
  function zeichneDach() {
    bildTransform();
    const abstand = 26;
    const erster = Math.floor(state.camX / abstand) - 1;
    const anzahl = Math.ceil(view.w / abstand) + 3;
    [["#0a3022", 0, 1], ["#135037", 0.5, 0.75]].forEach(([farbe, versatz, gross]) => {
      g.fillStyle = farbe;
      for (let i = 0; i <= anzahl; i += 1) {
        const n = erster + i;
        const sx = bildX((n + versatz) * abstand);
        const r = (13 + hash01(n * 7.3 + versatz) * 12) * gross * view.s;
        kreis(sx, -r * 0.35 + hash01(n * 2.1 + versatz) * 6 * view.s, r);
      }
    });
  }

  // ---------------------------------------------------------------------------
  // Fluss
  // ---------------------------------------------------------------------------
  function zeichneWasser() {
    const links = state.camX - 10;
    const rechts = state.camX + view.w + 10;
    const unten = state.camY - 30;
    const verlauf = g.createLinearGradient(0, WASSER, 0, Math.min(unten, -10));
    verlauf.addColorStop(0, "rgba(58, 160, 165, 0.9)");
    verlauf.addColorStop(1, "rgba(14, 70, 84, 0.97)");
    g.fillStyle = verlauf;
    g.beginPath();
    g.moveTo(links, unten);
    for (let x = links; x <= rechts + 6; x += 6) g.lineTo(x, WASSER + welle(x));
    g.lineTo(rechts + 6, unten);
    g.closePath();
    g.fill();

    g.strokeStyle = "rgba(225, 250, 245, 0.6)";
    g.lineWidth = 1.3;
    g.beginPath();
    for (let x = links; x <= rechts + 6; x += 6) {
      if (x === links) g.moveTo(x, WASSER + welle(x));
      else g.lineTo(x, WASSER + welle(x));
    }
    g.stroke();

    // Glitzern unter der Oberfläche.
    g.fillStyle = "rgba(255, 255, 255, 0.18)";
    const erster = Math.floor(links / 37);
    for (let n = erster; n * 37 < rechts; n += 1) {
      const x = n * 37 + hash01(n * 3.9) * 20;
      const y = WASSER - 6 - hash01(n * 8.1) * 12;
      const zuck = ruhig() ? 0.5 : 0.5 + 0.5 * Math.sin(state.zeit * 2 + n);
      g.fillRect(x, y, 6 + 6 * zuck, 0.9);
    }

    // Seerosen, auf der Welle.
    for (let n = Math.floor(links / 83) - 1; n * 83 < rechts + 40; n += 1) {
      if (hash01(n * 9.7) < 0.45) continue;
      const x = n * 83 + hash01(n * 4.3) * 40;
      const y = WASSER + welle(x) + 0.4;
      g.fillStyle = "#3e9a4a";
      oval(x, y, 9.5, 2.6);
      g.fillStyle = "#57b25e";
      oval(x - 1, y + 0.6, 6.5, 1.5);
      if (hash01(n * 5.5) > 0.6) {
        g.fillStyle = "#f6a6c8";
        oval(x + 2, y + 2, 2.6, 2);
        g.fillStyle = "#ffe066";
        kreis(x + 2, y + 2.4, 0.9);
      }
    }

    state.ringe.forEach((r) => {
      const k = clamp(r.t / 0.9, 0, 1);
      g.globalAlpha = 1 - k;
      g.strokeStyle = "#ffffff";
      g.lineWidth = 1.4;
      g.beginPath();
      g.ellipse(r.x, WASSER + 0.5, 6 + k * 34, 1.5 + k * 5, 0, 0, Math.PI * 2);
      g.stroke();
    });
    g.globalAlpha = 1;
  }

  // Pfosten im Fluss, alle fünfzig Meter.
  function zeichnePfosten() {
    bildTransform();
    const schritt = 50 * METER;
    const erster = Math.max(1, Math.floor((state.camX - START.x) / schritt));
    g.textAlign = "center";
    g.textBaseline = "middle";
    for (let m = erster; START.x + m * schritt < state.camX + view.w + 40; m += 1) {
      const x = bildX(START.x + m * schritt);
      const fuss = bildY(WASSER - 2);
      const kopf = bildY(WASSER + 30);
      g.fillStyle = "#6b4423";
      g.fillRect(x - 2 * view.s, kopf, 4 * view.s, fuss - kopf);
      g.fillStyle = "#f3e2c0";
      const bw = 30 * view.s;
      const bh = 13 * view.s;
      g.beginPath();
      g.roundRect?.(x - bw / 2, kopf - bh / 2, bw, bh, 3 * view.s);
      if (!g.roundRect) g.rect(x - bw / 2, kopf - bh / 2, bw, bh);
      g.fill();
      g.fillStyle = "#5a3a1a";
      g.font = `800 ${Math.round(8.5 * view.s)}px system-ui, sans-serif`;
      g.fillText(`${m * 50} m`, x, kopf + 0.5);
    }
  }

  // ---------------------------------------------------------------------------
  // Baum, Äste, Lianen, Bananen
  // ---------------------------------------------------------------------------
  // Der Baum, auf dem jeder beginnt.
  function zeichneStartbaum() {
    if (state.camX > -50) return;
    const unten = state.camY - 30;
    const hoch = oben() + 20;
    g.fillStyle = "#4a2f17";
    g.fillRect(-166, unten, 46, hoch - unten);
    g.fillStyle = "#6b4423";
    g.fillRect(-140, unten, 16, hoch - unten);
    // Rinde
    g.strokeStyle = "rgba(30, 18, 8, 0.45)";
    g.lineWidth = 1.2;
    g.beginPath();
    for (let i = 0; i < 6; i += 1) {
      const y = WASSER + 20 + i * 38;
      g.moveTo(-160 + (i % 2) * 8, y);
      g.lineTo(-152 + (i % 2) * 8, y + 16);
    }
    g.stroke();
    // Der Ast, auf dem der Affe steht.
    const ast = START.y - KOERPER - 4;
    g.fillStyle = "#5b3a1e";
    g.beginPath();
    g.moveTo(-124, ast - 8);
    g.lineTo(-68, ast - 2);
    g.lineTo(-66, ast + 3);
    g.lineTo(-124, ast + 4);
    g.closePath();
    g.fill();
    g.fillStyle = "#4f9a3a";
    oval(-70, ast + 6, 8, 4, 0.3);
    oval(-62, ast + 2, 6, 3, -0.4);
  }

  // Ein Ast hängt aus dem Blätterdach herab; an seiner Spitze der Knoten, an
  // dem die Liane hängt.
  function zeichneAst(a, i) {
    let ax = a.x;
    if (a.morsch && i === state.haken && !ruhig()) {
      ax += Math.sin(state.zeit * 55) * 1.6 * (a.halt / BRUCH_MS);
    }
    const top = oben() + 14;
    const wurzel = a.basis + (a.saat - 0.5) * 60;
    const knick = (wurzel + ax) / 2 + (hash01(a.saat * 13) - 0.5) * 36;
    const mitteY = (top + a.y) / 2 + 22;
    g.lineCap = "round";
    g.strokeStyle = a.morsch ? "#7a6b5a" : "#4a2f17";
    g.lineWidth = 6.5;
    g.beginPath();
    g.moveTo(wurzel, top);
    g.quadraticCurveTo(knick, mitteY, ax, a.y);
    g.stroke();
    g.strokeStyle = a.morsch ? "#a39582" : "#6e4826";
    g.lineWidth = 2.4;
    g.beginPath();
    g.moveTo(wurzel + 1.5, top);
    g.quadraticCurveTo(knick + 1.5, mitteY, ax + 1, a.y + 1);
    g.stroke();

    // Blätter am Ast – morsche haben braune.
    for (let j = 0; j < 3; j += 1) {
      const t = 0.45 + j * 0.18;
      const bx = (1 - t) * (1 - t) * wurzel + 2 * (1 - t) * t * knick + t * t * ax;
      const by = (1 - t) * (1 - t) * top + 2 * (1 - t) * t * mitteY + t * t * a.y;
      const seite = j % 2 ? 1 : -1;
      g.fillStyle = a.morsch ? "#a8823f" : (j === 1 ? "#3f8f3a" : "#58ad46");
      oval(bx + seite * 5, by - 1, 5.5, 2.6, seite * 0.6);
    }

    if (a.morsch) {
      // Risse nahe der Spitze.
      g.strokeStyle = "#3a2c1e";
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(ax - 2, a.y + 12);
      g.lineTo(ax + 1.5, a.y + 9);
      g.lineTo(ax - 1, a.y + 6);
      g.stroke();
    }
    g.fillStyle = a.morsch ? "#5c4a38" : "#2f1d0d";
    kreis(ax, a.y, 3.6);
    g.fillStyle = a.morsch ? "#8d7a64" : "#7a5230";
    kreis(ax - 0.8, a.y + 0.8, 1.5);
  }

  // Eine Liane, an der niemand hängt: ein kurzes Stück, das im Wind pendelt.
  function zeichneStummel(a, i) {
    const schwank = ruhig() ? 0 : Math.sin(state.zeit * 1.7 + i * 1.3) * 3;
    const ex = a.x + schwank;
    const ey = a.y - 24;
    g.strokeStyle = "#3d7a26";
    g.lineWidth = 2.4;
    g.beginPath();
    g.moveTo(a.x, a.y);
    g.quadraticCurveTo(a.x + schwank * 0.2, a.y - 13, ex, ey);
    g.stroke();
    g.fillStyle = "#62b84a";
    oval(ex + 2, ey + 3, 3.4, 1.7, 0.6);
    oval(a.x - 2, a.y - 10, 3, 1.5, -0.6);
  }

  // Die Liane, an der der Affe hängt – bis zu seinen Händen. Hängt sie lose,
  // weil er über den Ast hinausschwingt, hängt sie durch.
  function zeichneSeil() {
    if (state.haken < 0) return;
    const a = state.anker[state.haken];
    const p = state.p;
    const hand = handPunkt();
    const d = Math.hypot(p.x - a.x, p.y - a.y);
    const lose = Math.max(0, state.seil - d) * 0.7;
    const mx = (a.x + hand.x) / 2;
    const my = (a.y + hand.y) / 2 - lose;
    g.lineCap = "round";
    g.strokeStyle = "#2f5a1a";
    g.lineWidth = 3.4;
    g.beginPath();
    g.moveTo(a.x, a.y);
    g.quadraticCurveTo(mx, my, hand.x, hand.y);
    g.stroke();
    g.strokeStyle = "#5a9a33";
    g.lineWidth = 1.8;
    g.stroke();
    // Blätter entlang der Liane.
    const lang = Math.hypot(hand.x - a.x, hand.y - a.y);
    const stueck = Math.floor(lang / 20);
    for (let j = 1; j <= stueck; j += 1) {
      const t = j / (stueck + 1);
      const bx = (1 - t) * (1 - t) * a.x + 2 * (1 - t) * t * mx + t * t * hand.x;
      const by = (1 - t) * (1 - t) * a.y + 2 * (1 - t) * t * my + t * t * hand.y;
      const seite = j % 2 ? 1 : -1;
      g.fillStyle = j % 3 ? "#62b84a" : "#4a9a38";
      oval(bx + seite * 3, by, 3.4, 1.6, seite * 0.7);
    }
  }

  function handPunkt() {
    const p = state.p;
    const s = HAND * AFFE_GROSS;
    return { x: p.x - Math.sin(state.dreh) * s, y: p.y + Math.cos(state.dreh) * s };
  }

  // Der Ring um den Ast, den der Affe greifen würde: gelb trägt, rot ist zu
  // lang. Dazu eine feine Linie vom Affen hin.
  function zeichneZiel() {
    const p = state.p;
    if (state.schritt === "schwingen") {
      // Beim Schwingen nur ein leiser Hinweis auf den nächsten Ast.
      const naechster = state.anker[state.haken + 1];
      if (!naechster || naechster.weg) return;
      g.strokeStyle = "rgba(255, 255, 255, 0.45)";
      g.lineWidth = 1.4;
      g.beginPath();
      g.arc(naechster.x, naechster.y, 7.5, 0, Math.PI * 2);
      g.stroke();
      return;
    }
    if (state.schritt !== "fliegen" || state.ziel < 0) return;
    const a = state.anker[state.ziel];
    const d = Math.hypot(p.x - a.x, p.y - a.y);
    const traegt = a.y - d >= SICHER;
    const farbe = traegt ? "255, 224, 102" : "255, 107, 91";
    const puls = ruhig() ? 0.5 : 0.5 + 0.5 * Math.sin(state.zeit * 12);
    g.setLineDash([3, 5]);
    g.strokeStyle = `rgba(${farbe}, ${state.greift ? 0.8 : 0.4})`;
    g.lineWidth = 1.2;
    g.beginPath();
    g.moveTo(p.x, p.y);
    g.lineTo(a.x, a.y);
    g.stroke();
    g.setLineDash([]);
    g.strokeStyle = `rgba(${farbe}, 0.95)`;
    g.lineWidth = 2.2;
    g.beginPath();
    g.arc(a.x, a.y, 8 + puls * 2.5, 0, Math.PI * 2);
    g.stroke();
  }

  function zeichneFruechte() {
    const links = state.camX - 20;
    const rechts = state.camX + view.w + 20;
    state.fruechte.forEach((f) => {
      if (f.weg || f.x < links || f.x > rechts) return;
      const wipp = ruhig() ? 0 : Math.sin(state.zeit * 2.4 + f.saat * 6) * 1.6;
      const x = f.x;
      const y = f.y + wipp;
      const schein = g.createRadialGradient(x, y, 2, x, y, 16);
      schein.addColorStop(0, "rgba(255, 236, 120, 0.55)");
      schein.addColorStop(1, "rgba(255, 236, 120, 0)");
      g.fillStyle = schein;
      kreis(x, y, 16);
      g.save();
      g.translate(x, y + 3);
      g.rotate(-0.45 + f.saat * 0.5);
      g.lineCap = "round";
      g.strokeStyle = "#e0a800";
      g.lineWidth = 5.4;
      g.beginPath();
      g.arc(0, 0, 8, Math.PI * 0.18, Math.PI * 0.82);
      g.stroke();
      g.strokeStyle = "#ffe066";
      g.lineWidth = 3.4;
      g.stroke();
      g.fillStyle = "#5a3a1a";
      kreis(Math.cos(Math.PI * 0.18) * 8, Math.sin(Math.PI * 0.18) * 8, 1.4);
      kreis(Math.cos(Math.PI * 0.82) * 8, Math.sin(Math.PI * 0.82) * 8, 1.1);
      g.restore();
    });
  }

  // ---------------------------------------------------------------------------
  // Der Affe
  // ---------------------------------------------------------------------------
  function zeichneAffe() {
    const p = state.p;
    const haengt = state.haken >= 0;
    const fliegt = state.schritt === "fliegen";
    const zeit = ruhig() ? 0 : state.zeit;
    // Spur im Flug.
    state.spur.forEach((s, i) => {
      g.fillStyle = `rgba(255, 255, 255, ${(i / state.spur.length) * 0.35})`;
      kreis(s.x, s.y, 1.6);
    });

    g.save();
    g.translate(p.x, p.y);
    g.rotate(state.dreh);
    g.scale(AFFE_GROSS, AFFE_GROSS);
    g.lineCap = "round";
    g.lineJoin = "round";
    const fell = "#7a4a26";
    const hell = "#e3b47e";

    // Schwanz
    const wedel = Math.sin(zeit * 5) * 1.5;
    g.strokeStyle = "#6b3f1f";
    g.lineWidth = 2.4;
    g.beginPath();
    g.moveTo(-3, -6);
    g.bezierCurveTo(-12, -9, -15 + wedel, 1, -9, 3 + wedel);
    g.stroke();

    // Beine: hängend locker, im Flug gestreckt.
    const spreiz = fliegt ? 2.5 : 0.5 + Math.sin(zeit * 3) * 0.3;
    g.strokeStyle = fell;
    g.lineWidth = 3.2;
    g.beginPath();
    g.moveTo(-2.5, -5);
    g.lineTo(-3.5 - spreiz, -12);
    g.moveTo(2.5, -5);
    g.lineTo(3.5 + spreiz, -12);
    g.stroke();
    g.fillStyle = "#5a3418";
    kreis(-3.5 - spreiz, -12.4, 1.7);
    kreis(3.5 + spreiz, -12.4, 1.7);

    // Rumpf
    g.fillStyle = fell;
    oval(0, -0.5, 6.4, 7.8);
    g.fillStyle = hell;
    oval(0.8, -1.5, 3.8, 5.2);

    // Arme: hängend zur Liane hinauf, im Flug ausgebreitet.
    g.strokeStyle = fell;
    g.lineWidth = 3;
    g.beginPath();
    if (haengt || state.schritt === "start") {
      g.moveTo(-3.6, 3.5);
      g.lineTo(-0.9, HAND - 0.5);
      g.moveTo(3.6, 3.5);
      g.lineTo(0.9, HAND - 0.5);
    } else {
      const flatter = Math.sin(zeit * 14) * 1.5;
      g.moveTo(-4, 3.5);
      g.lineTo(-11, 9 + flatter);
      g.moveTo(4, 3.5);
      g.lineTo(11, 9 - flatter);
    }
    g.stroke();

    // Kopf
    g.fillStyle = fell;
    kreis(-6, 10.2, 2.4);
    kreis(6, 10.2, 2.4);
    g.fillStyle = hell;
    kreis(-6, 10.2, 1.2);
    kreis(6, 10.2, 1.2);
    g.fillStyle = fell;
    kreis(0, 9.6, 6.1);
    g.fillStyle = hell;
    oval(0.7, 8.4, 4.4, 3.8);
    oval(-1.2, 11.2, 2, 1.8);
    oval(2.6, 11.2, 2, 1.8);
    g.fillStyle = "#2b1a0e";
    kreis(-1.1, 11, 0.95);
    kreis(2.5, 11, 0.95);
    g.strokeStyle = "#2b1a0e";
    g.lineWidth = 0.8;
    g.beginPath();
    if (state.schritt === "platsch") g.arc(0.7, 6.8, 1.2, 0, Math.PI * 2);
    else g.arc(0.7, 8, 1.8, Math.PI * 1.15, Math.PI * 1.85);
    g.stroke();
    g.restore();
  }

  function zeichneTeile() {
    state.teile.forEach((t) => {
      const k = clamp(t.leben / t.max, 0, 1);
      g.globalAlpha = Math.min(1, k * 1.5);
      g.fillStyle = t.farbe;
      if (t.art === "blatt") {
        oval(t.x, t.y, t.r * 1.6, t.r * 0.8, t.dreh);
      } else if (t.art === "ast") {
        g.save();
        g.translate(t.x, t.y);
        g.rotate(t.dreh);
        g.fillRect(-2.5, -9, 5, 18);
        g.restore();
      } else {
        kreis(t.x, t.y, t.r * (0.4 + 0.6 * k));
      }
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
    g.fillStyle = "rgba(6, 34, 24, 0.45)";
    g.beginPath();
    if (g.roundRect) g.roundRect(x, y, w, gross * 1.6, gross * 0.8);
    else g.rect(x, y, w, gross * 1.6);
    g.fill();
    g.fillStyle = "#ffffff";
    g.fillText(text, x + gross * 0.55, y + gross * 0.82);
  }

  function zeichneSchriften() {
    bildTransform();
    g.textAlign = "center";
    g.textBaseline = "middle";
    state.schriften.forEach((s) => {
      const k = clamp(s.leben / s.max, 0, 1);
      const steig = (1 - k) * 26;
      g.globalAlpha = Math.min(1, k * 2);
      g.font = `900 ${Math.round(s.gross * view.s)}px system-ui, sans-serif`;
      g.lineWidth = 4;
      g.strokeStyle = "rgba(10, 40, 30, 0.6)";
      g.strokeText(s.text, bildX(s.x), bildY(s.y) - steig);
      g.fillStyle = s.farbe;
      g.fillText(s.text, bildX(s.x), bildY(s.y) - steig);
    });
    g.globalAlpha = 1;
  }

  function zeichnen() {
    if (!g) return;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, canvas.width, canvas.height);
    zeichneHintergrund();
    weltTransform();
    zeichneStartbaum();
    const links = state.camX - 80;
    const rechts = state.camX + view.w + 80;
    state.anker.forEach((a, i) => {
      if (a.weg || a.x < links || a.x > rechts) return;
      zeichneAst(a, i);
      if (i !== state.haken) zeichneStummel(a, i);
    });
    zeichneFruechte();
    zeichneZiel();
    const geister = geisterOrte();
    geister.forEach(zeichneGeist);
    zeichneSeil();
    zeichneAffe();
    zeichneTeile();
    zeichneWasser();
    zeichnePfosten();
    zeichneDach();
    zeichneGeistNamen(geister);
    zeichneAnzeige();
    zeichneSchriften();
  }

  // ---------------------------------------------------------------------------
  // Die Geister
  // ---------------------------------------------------------------------------
  // Aufgezeichnet ist, wo der Affe des Gegners war: wie weit vom Startbaum
  // (a) und wie hoch (b). Seine Äste waren andere, also hängt er hier an
  // keinem – aber wie weit er zu dieser Sekunde war, stimmt.
  function geisterOrte() {
    if (!gegner || state.phase === "bereit") return [];
    const ms = gegner.zeit();
    return gegner.gegner().filter((geg) => geg.lauf?.mitOrt).map((geg) => {
      const ort = geg.lauf.ort(ms);
      const bald = geg.lauf.ort(ms + 120);
      const vx = (bald.a - ort.a) / 0.12;
      const fertig = geg.lauf.fertig(ms);
      return {
        ...geg,
        x: START.x + ort.a,
        y: ort.b,
        dreh: -clamp(vx / 900, -0.45, 0.45),
        blass: fertig ? clamp(1 - (ms - geg.lauf.dauer) / 1200, 0, 1) : 1,
        meter: Math.round((ort.a - (state.p.x - START.x)) / METER),
      };
    });
  }

  // Ein Affe aus Licht: dieselbe Gestalt, in der Farbe des Gegners.
  function zeichneGeist(geist) {
    if (geist.blass <= 0) return;
    g.save();
    g.globalAlpha = 0.45 * geist.blass;
    g.translate(geist.x, geist.y);
    g.rotate(geist.dreh);
    g.scale(AFFE_GROSS, AFFE_GROSS);
    g.lineCap = "round";
    g.strokeStyle = geist.farbe;
    g.fillStyle = geist.farbe;
    g.lineWidth = 2.4;
    g.beginPath();
    g.moveTo(-3, -6);
    g.bezierCurveTo(-12, -9, -15, 1, -9, 3);
    g.stroke();
    g.lineWidth = 3.2;
    g.beginPath();
    g.moveTo(-2.5, -5);
    g.lineTo(-5, -12);
    g.moveTo(2.5, -5);
    g.lineTo(5, -12);
    g.stroke();
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(-3.6, 3.5);
    g.lineTo(-1.5, HAND - 0.5);
    g.moveTo(3.6, 3.5);
    g.lineTo(1.5, HAND - 0.5);
    g.stroke();
    oval(0, -0.5, 6.4, 7.8);
    kreis(-6, 10.2, 2.4);
    kreis(6, 10.2, 2.4);
    kreis(0, 9.6, 6.1);
    g.restore();
  }

  // Der Name über dem Geist – oder, wenn er ausserhalb des Bildes fliegt,
  // ein Schild am Rand: wie viele Meter er voraus ist oder zurückliegt.
  function zeichneGeistNamen(geister) {
    if (!geister.length) return;
    bildTransform();
    g.textBaseline = "middle";
    const gross = Math.round(clamp(10 * view.s, 11, 16));
    g.font = `800 ${gross}px system-ui, sans-serif`;
    geister.forEach((geist, i) => {
      if (geist.blass <= 0) return;
      g.globalAlpha = 0.9 * geist.blass;
      const sx = bildX(geist.x);
      if (sx > -10 && sx < view.cssW + 10) {
        g.textAlign = "center";
        const sy = bildY(geist.y + 26 * AFFE_GROSS) - i * (gross + 3);
        g.lineWidth = 3;
        g.strokeStyle = "rgba(10, 40, 30, 0.6)";
        g.strokeText(geist.name, sx, sy);
        g.fillStyle = geist.farbe;
        g.fillText(geist.name, sx, sy);
        return;
      }
      const rechts = sx >= view.cssW;
      const text = rechts ? `${geist.name} +${Math.max(1, geist.meter)} m ▸` : `◂ ${geist.name} ${Math.min(-1, geist.meter)} m`;
      const w = g.measureText(text).width + gross;
      const y = view.cssH * 0.3 + i * (gross + 10);
      const x = rechts ? view.cssW - w - 8 : 8;
      g.fillStyle = "rgba(6, 34, 24, 0.6)";
      g.beginPath();
      if (g.roundRect) g.roundRect(x, y - gross * 0.75, w, gross * 1.5, gross * 0.75);
      else g.rect(x, y - gross * 0.75, w, gross * 1.5);
      g.fill();
      g.textAlign = "left";
      g.fillStyle = geist.farbe;
      g.fillText(text, x + gross / 2, y);
    });
    g.globalAlpha = 1;
  }

  // ---------------------------------------------------------------------------
  // Eingabe
  // ---------------------------------------------------------------------------
  function druecken() {
    gedrueckt = true;
    if (state.phase === "bereit") {
      state.phase = "spiel";
      state.schritt = "schwingen";
      shell.setPhase("play");
      shell.startClock(RUNDE_MS, zeitUm);
      gegner?.los();
      kids()?.vibrate?.(8);
      return;
    }
    if (state.phase !== "spiel") return;
    if (state.schritt === "fliegen") state.greift = true;
  }

  function loslassen() {
    if (!gedrueckt) return;
    gedrueckt = false;
    state.greift = false;
    if (state.phase !== "spiel" || state.schritt !== "schwingen") return;
    // Vom Baum weg zählt erst, wer unter dem ersten Ast durch ist: Wer nur
    // tippt, springt ab und schwingt – statt gleich ins Wasser zu fallen.
    if (state.haken === 0 && state.p.x < state.anker[0].x) return;
    abspringen();
  }

  // ---------------------------------------------------------------------------
  // Greifen, Loslassen, Brechen
  // ---------------------------------------------------------------------------
  function abspringen() {
    state.haken = -1;
    state.schritt = "fliegen";
    state.spur = [];
  }

  // Wohin würde der Affe jetzt greifen? Zum nächsten Ast in Reichweite, der
  // über ihm und nicht hinter ihm hängt.
  function zielSuchen() {
    const p = state.p;
    let best = -1;
    let bestD = REICH;
    for (let i = Math.max(0, state.letzter - 1); i < state.anker.length; i += 1) {
      const a = state.anker[i];
      if (a.x > p.x + REICH) break;
      if (a.weg || a.x < p.x - 12 || a.y < p.y + 6) continue;
      const d = Math.hypot(a.x - p.x, a.y - p.y);
      if (d <= bestD) { best = i; bestD = d; }
    }
    return best;
  }

  function greifen(i) {
    const a = state.anker[i];
    const p = state.p;
    const dx = p.x - a.x;
    const dy = p.y - a.y;
    const d = Math.max(1, Math.hypot(dx, dy));
    const rx = dx / d;
    const ry = dy / d;
    const tx = -ry;
    const ty = rx;
    // Was vom Ast weg zieht, fängt die Liane ab. Ein Teil davon wird zu
    // Schwung entlang des Bogens – sonst bräche jeder Griff den Flug.
    const vr = p.vx * rx + p.vy * ry;
    const vt = p.vx * tx + p.vy * ty;
    if (vr > 0) {
      const neu = (vt >= 0 ? 1 : -1) * Math.sqrt(vt * vt + UMLENK * vr * vr);
      p.vx = tx * neu;
      p.vy = ty * neu;
    }
    state.haken = i;
    state.seil = Math.max(SEIL_MIN, d);
    state.schritt = "schwingen";
    state.greift = false;
    state.spur = [];
    a.halt = 0;
    blaetter(a.x, a.y, 3);
    kids()?.vibrate?.(10);
    if (i > state.letzter) {
      const uebersprungen = i - state.letzter - 1;
      if (uebersprungen > 0) {
        const plus = uebersprungen * WEIT;
        state.bonus += plus;
        schrift(`Weit! +${plus}`, a.x, a.y - 30, "#c8f7a8", 17);
        kids()?.playJingle?.("unlock");
      }
      state.letzter = i;
    }
  }

  function brechen(a) {
    a.weg = true;
    state.teile.push({ art: "ast", x: a.x, y: a.y + 8, vx: state.p.vx * 0.2, vy: 20, r: 0, dreh: 0.3, drehV: 4, leben: 1.2, max: 1.2, farbe: "#7a6b5a", schwer: 1 });
    blaetter(a.x, a.y + 6, 6);
    schrift("Knack!", a.x, a.y + 16, "#ffd0a0", 16);
    abspringen();
    state.stoss = 0.6;
    kids()?.vibrate?.([14, 30, 14]);
  }

  function platsch() {
    state.schritt = "platsch";
    state.haken = -1;
    state.greift = false;
    state.p.vx *= 0.2;
    state.p.vy = -40;
    state.stoss = 1;
    shell.stopClock();
    spritzer(state.p.x, WASSER + 2, 20);
    state.ringe.push({ x: state.p.x, t: 0 });
    kids()?.playJingle?.("retry");
    kids()?.vibrate?.([20, 40, 30]);
    stepTimer = window.setTimeout(finish, 1000);
  }

  function blaetter(x, y, anzahl) {
    for (let i = 0; i < anzahl; i += 1) {
      state.teile.push({
        art: "blatt",
        x: x + (Math.random() - 0.5) * 8,
        y,
        vx: (Math.random() - 0.5) * 30,
        vy: -10 - Math.random() * 20,
        r: 2 + Math.random() * 1.2,
        dreh: Math.random() * 3,
        drehV: (Math.random() - 0.5) * 6,
        leben: 0.9 + Math.random() * 0.5,
        max: 1.4,
        farbe: Math.random() < 0.5 ? "#62b84a" : "#3f8f3a",
        schwer: 0.08,
      });
    }
  }

  function spritzer(x, y, anzahl) {
    for (let i = 0; i < anzahl; i += 1) {
      const w = Math.PI * (0.15 + Math.random() * 0.7);
      const v = 80 + Math.random() * 150;
      state.teile.push({
        art: "tropfen", x, y,
        vx: Math.cos(w) * v,
        vy: Math.sin(w) * v,
        r: 1.4 + Math.random() * 2.2,
        dreh: 0, drehV: 0,
        leben: 0.5 + Math.random() * 0.4,
        max: 0.9,
        farbe: i % 3 ? "rgba(220, 248, 250, 0.95)" : "rgba(120, 200, 210, 0.95)",
        schwer: 1,
      });
    }
  }

  function funkeln(x, y, farbe, anzahl) {
    for (let i = 0; i < anzahl; i += 1) {
      const w = Math.random() * Math.PI * 2;
      const v = 40 + Math.random() * 90;
      state.teile.push({
        art: "funke", x, y,
        vx: Math.cos(w) * v,
        vy: Math.sin(w) * v,
        r: 1.3 + Math.random() * 1.8,
        dreh: 0, drehV: 0,
        leben: 0.4 + Math.random() * 0.3,
        max: 0.7,
        farbe,
        schwer: 0.3,
      });
    }
  }

  function schrift(text, x, y, farbe, gross) {
    state.schriften.push({ text, x, y, farbe, gross, leben: 0.9, max: 0.9 });
  }

  // ---------------------------------------------------------------------------
  // Die Schleife
  // ---------------------------------------------------------------------------
  // Ein kleiner Schritt Physik: Schwerkraft, Luft, Schwung – und die Liane,
  // die nicht länger wird. Sie ist ein Seil, keine Stange: Kürzer werden darf
  // sie, dann hängt sie lose.
  function physik(h) {
    const p = state.p;
    p.vy -= G * h;
    const luft = 1 - LUFT * h;
    p.vx *= luft;
    p.vy *= luft;
    const a = state.haken >= 0 ? state.anker[state.haken] : null;
    if (a) {
      const dx = p.x - a.x;
      const dy = p.y - a.y;
      const d = Math.hypot(dx, dy) || 0.001;
      if (d >= state.seil - 0.5) {
        const tx = -dy / d;
        const ty = dx / d;
        if (p.vx * tx + p.vy * ty > 0) {
          p.vx += tx * PUMP * h;
          p.vy += ty * PUMP * h;
        }
      }
    }
    const v = Math.hypot(p.vx, p.vy);
    if (v > V_MAX) {
      p.vx *= V_MAX / v;
      p.vy *= V_MAX / v;
    }
    p.x += p.vx * h;
    p.y += p.vy * h;
    if (a) {
      const dx = p.x - a.x;
      const dy = p.y - a.y;
      const d = Math.hypot(dx, dy) || 0.001;
      if (d > state.seil) {
        const rx = dx / d;
        const ry = dy / d;
        p.x = a.x + rx * state.seil;
        p.y = a.y + ry * state.seil;
        const vr = p.vx * rx + p.vy * ry;
        if (vr > 0) {
          p.vx -= rx * vr;
          p.vy -= ry * vr;
        }
      }
    }
  }

  function takt(dt) {
    state.zeit += dt;
    if (state.stoss > 0) state.stoss = Math.max(0, state.stoss - dt * 5);
    const p = state.p;

    state.anker.forEach((a, i) => {
      if (!a.weite || i === state.haken) return;
      a.t += dt;
      bewegeAnker(a);
    });

    if (state.schritt === "schwingen" || state.schritt === "fliegen") {
      const n = Math.max(1, Math.ceil(dt / TAKT));
      for (let i = 0; i < n; i += 1) physik(dt / n);

      if (state.schritt === "schwingen") {
        const a = state.anker[state.haken];
        if (a.morsch) {
          a.halt += dt * 1000;
          if (a.halt >= BRUCH_MS) brechen(a);
        }
      }
      if (state.schritt === "fliegen") {
        state.ziel = zielSuchen();
        if (state.greift && state.ziel >= 0) greifen(state.ziel);
        state.spur.push({ x: p.x, y: p.y });
        if (state.spur.length > 16) state.spur.shift();
      }

      state.fruechte.forEach((f) => {
        if (f.weg || Math.abs(f.x - p.x) > 20) return;
        if (Math.hypot(f.x - p.x, f.y - p.y) > 19) return;
        f.weg = true;
        state.bananen += 1;
        state.bonus += BANANE;
        funkeln(f.x, f.y, "#ffe066", 12);
        schrift(`+${BANANE}`, f.x, f.y + 20, "#ffe066", 19);
        kids()?.playJingle?.("star");
        kids()?.vibrate?.(14);
      });

      if (p.y < WASSER + KOERPER) platsch();

      state.maxX = Math.max(state.maxX, p.x);
      state.meter = Math.max(0, Math.floor((state.maxX - START.x) / METER));
      const punkte = state.meter + state.bonus;
      if (punkte !== state.punkte) {
        state.punkte = punkte;
        shell.setCount(punkte);
      }
    } else if (state.schritt === "platsch") {
      p.vy -= 160 * dt;
      p.vy *= 1 - 3 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }

    // Die Haltung: an der Liane zeigt der Kopf zum Ast, im Flug richtet sich
    // der Affe auf und lehnt sich in die Richtung, in die er fliegt.
    let zielDreh = 0;
    if (state.haken >= 0 && state.schritt !== "start") {
      const a = state.anker[state.haken];
      zielDreh = Math.atan2(-(a.x - p.x), a.y - p.y);
    } else if (state.schritt === "fliegen") {
      zielDreh = -clamp(p.vx / 900, -0.45, 0.45);
    }
    const rate = state.haken >= 0 ? 18 : 5;
    state.dreh += winkelDiff(state.dreh, zielDreh) * (1 - Math.exp(-rate * dt));

    for (let i = state.teile.length - 1; i >= 0; i -= 1) {
      const t = state.teile[i];
      t.vy -= 520 * t.schwer * dt;
      if (t.art === "blatt") {
        t.vx += Math.sin(state.zeit * 4 + i) * 20 * dt;
        t.vx *= 1 - 1.5 * dt;
        t.vy = Math.max(t.vy, -28);
      }
      t.x += t.vx * dt;
      t.y += t.vy * dt;
      t.dreh += t.drehV * dt;
      t.leben -= dt;
      if (t.leben <= 0) state.teile.splice(i, 1);
    }
    for (let i = state.schriften.length - 1; i >= 0; i -= 1) {
      state.schriften[i].leben -= dt;
      if (state.schriften[i].leben <= 0) state.schriften.splice(i, 1);
    }
    for (let i = state.ringe.length - 1; i >= 0; i -= 1) {
      state.ringe[i].t += dt;
      if (state.ringe[i].t > 0.9) state.ringe.splice(i, 1);
    }

    if (state.schritt !== "start") {
      const kx = 1 - Math.exp(-5 * dt);
      state.camX += (camXZiel() - state.camX) * kx;
      state.camY += (camYZiel() - state.camY) * (1 - Math.exp(-4 * dt));
    }
    aesteBis(state.camX + view.w + REICH + 80);

    if (state.phase === "spiel") gegner?.takt(state.punkte, { a: p.x - START.x, b: p.y });
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
    state.schritt = "start";
    state.punkte = 0;
    state.meter = 0;
    state.bonus = 0;
    state.bananen = 0;
    state.fruechte = [];
    state.haken = 0;
    state.letzter = 0;
    state.ziel = -1;
    state.greift = false;
    state.p = { x: START.x, y: START.y, vx: 0, vy: 0 };
    state.seil = Math.hypot(START.x - ERSTER.x, START.y - ERSTER.y);
    state.dreh = 0;
    state.maxX = START.x;
    state.spur = [];
    state.teile = [];
    state.schriften = [];
    state.ringe = [];
    state.stoss = 0;
    state.zeit = 0;
    gedrueckt = false;
    shell.setCount(0);
    gegner?.runde();

    shell.clear();
    const prompt = shell.el("p", "cm-prompt li-prompt", "Halten – schwingen. Loslassen – fliegen.");
    shell.play.append(prompt, buildPlatz());
    view.cssW = 0;
    view.cssH = 0;
    messen();

    // Der erste Ast hängt fest und für alle gleich.
    state.anker = [{
      x: ERSTER.x, y: ERSTER.y, basis: ERSTER.x, hoehe: ERSTER.y, weite: 0, periode: 0, ph: 0,
      t: 0, morsch: false, halt: 0, weg: false, saat: 0.3,
    }];
    state.camX = START.x - view.w * 0.32;
    state.camY = 0;
    aesteBis(state.camX + view.w + REICH + 80);

    last = performance.now();
    frame = window.requestAnimationFrame(loop);
  }

  function zeitUm() {
    // Wer schon ins Wasser fällt, fällt zu Ende – die Tafel kommt dann ohnehin.
    if (state.phase !== "spiel" || state.schritt === "platsch" || state.schritt === "ende") return;
    state.schritt = "ende";
    schrift("Zeit!", state.p.x, state.p.y + 34, "#ffffff", 22);
    kids()?.playJingle?.("star");
    stepTimer = window.setTimeout(finish, 450);
  }

  function zaehleHoch(ziel) {
    const zahl = host.querySelector(".cm-result-score");
    if (!zahl) return;
    if (ruhig() || ziel <= 1) { zahl.textContent = String(ziel); return; }
    const dauer = Math.min(800, 160 + ziel * 4);
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
    const bananen = state.bananen === 1 ? "1 Banane" : `${state.bananen} Bananen`;
    const strecke = `${state.meter} m · ${bananen}`;
    shell.showResult({
      label: "Deine Punkte",
      points: punkte,
      detail: rekord ? "Neuer Rekord!" : `${strecke}${vorher ? ` · Bestwert ${vorher}` : ""}`,
      speech: `${punkte} Punkte: ${state.meter} Meter und ${bananen}.${rekord ? " Das ist dein neuer Rekord!" : ""}`,
      geist,
    });
    if (rekord) host.querySelector(".cm-result-detail")?.classList.add("li-rekord");
    zaehleHoch(punkte);
  }

  // ---------------------------------------------------------------------------
  // Start
  // ---------------------------------------------------------------------------
  shell = shellApi.mount({
    host,
    title: "Lianenschwung",
    area: "geschwindigkeit",
    accent: "#F5A623",
    accentDark: "#b9741a",
    help: HELP,
    clock: true,
    onRestart: startRun,
  });
  gegner = window.LernappGeist?.fuer?.({ spiel: "vineSwing", host, art: "tempo" }) || null;

  startRun();

  host.addEventListener("pointerdown", (event) => {
    if (event.target.closest("button, a, input")) return;
    druecken();
  });
  window.addEventListener("pointerup", loslassen);
  window.addEventListener("pointercancel", loslassen);
  // Wer das Fenster verlässt, lässt auch die Liane los.
  window.addEventListener("blur", loslassen);

  document.addEventListener("keydown", (event) => {
    if (event.key !== " " && event.key !== "Enter") return;
    if (document.activeElement?.tagName === "BUTTON") return;
    event.preventDefault();
    if (event.repeat) return;
    druecken();
  });
  document.addEventListener("keyup", (event) => {
    if (event.key !== " " && event.key !== "Enter") return;
    loslassen();
  });

  window.addEventListener("resize", messen);
  window.addEventListener("orientationchange", messen);
  window.addEventListener("pagehide", () => { clearStep(); stopLoop(); });

  // Für die Prüfskripte.
  window.LernappLiane = {
    WASSER, SICHER, REICH, RUNDE_MS, START, state, view, takt, druecken, loslassen, neuerAnker,
  };
})();
