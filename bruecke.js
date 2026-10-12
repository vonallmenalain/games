/*
 * bruecke.js – Brückenbauer.
 * ---------------------------------------------------------------------------
 * Ein Bauarbeiter steht an der Kante eines Felspfeilers, vor ihm die Schlucht,
 * drüben der nächste Pfeiler. Wer den Finger aufs Bild legt, lässt an der
 * Kante einen Balken in die Höhe wachsen; wer loslässt, lässt ihn nach vorn
 * kippen. Reicht er genau auf den Pfeiler drüben, geht der Arbeiter hinüber,
 * und der nächste kommt. Ist er zu kurz oder zu lang, fällt er.
 *
 * Eine Runde dauert vierzig Sekunden, oder bis jemand fällt. Gezählt werden
 * die Brücken – und jede, deren Balken genau auf der roten Mitte des Pfeilers
 * liegt, zählt doppelt. Mehrere genaue hintereinander zählen noch mehr: Das
 * ist der Grund, die nächste Runde besser machen zu wollen.
 *
 * Schwerer wird es mit jeder Brücke, nicht mit der Zeit: Die Pfeiler werden
 * schmaler, die Schluchten streuen weiter, der Balken wächst schneller. Ab der
 * zehnten Brücke steht der Pfeiler drüben nicht mehr still – er pendelt, und
 * wer loslässt, muss mitrechnen, wo er ist, wenn der Balken aufschlägt.
 *
 * Wer mag, spielt nicht allein: Platz 1 und die eigene Bestmarke laufen als
 * Geister mit (geist.js) – auf den eigenen Pfeilern, so weit, wie sie zu
 * dieser Sekunde gekommen waren.
 *
 * Gezeichnet wird wie beim Turmbau auf eine Leinwand, gerechnet in
 * Welteinheiten. Fest steht die Höhe: SICHT_H Einheiten im Querformat. Wie
 * breit die Welt ist, sagt die Form der Fläche – im Hochformat bleibt sie
 * WELT_W breit, und darüber steht mehr Himmel. Die weiteste Schlucht passt in
 * jede Form.
 */
(() => {
  "use strict";

  if (document.body.dataset.page !== "bridge") return;

  const host = document.querySelector("#br-stage");
  const shellApi = window.LernappGameShell;
  const cloudApi = window.LernappGameCloud;
  const art = window.LernappTrainArt;
  if (!host || !shellApi || !art) return;

  const kids = () => window.LernappKids || null;
  const ruhig = () => Boolean(kids()?.prefersReducedMotion?.());

  // Der Zufall. Ohne Turnier Math.random; im Turnier bekommen alle dieselben
  // Pfeiler in derselben Reihenfolge (zufall.js). Staub und Funken würfeln
  // weiter Math.random – sie hängen daran, wie jemand spielt.
  const zufall = window.LernappZufall?.fuer?.("bridgeBuilder") || {
    fest: false, neu() {}, zahl: Math.random,
  };

  // ---------------------------------------------------------------------------
  // Die Welt
  // ---------------------------------------------------------------------------
  // y zählt nach oben, der Grund der Schlucht liegt bei null – sehen tut ihn
  // niemand, er liegt im Nebel. Die Pfeiler ragen bis OBEN.
  const WELT_W = 300;
  const WELT_W_MAX = 640;
  const SICHT_H = 260;
  const OBEN = 92;
  // So weit steht die Kante des eigenen Pfeilers vom linken Bildrand. Die
  // weiteste Schlucht samt Pfeiler passt danach noch in WELT_W.
  const VOR_KANTE = 62;
  const RUNDE_MS = 40000;

  // Der Balken.
  const BALKEN_D = 5.6;            // Dicke
  const WACHS_START = 150;         // Einheiten je Sekunde
  const WACHS_SCHRITT = 7;         // je Brücke schneller ...
  const WACHS_MAX = 300;           // ... aber nie schneller als das
  const KIPP_MS = 330;             // so lange fällt er nach vorn
  // Die rote Mitte. Genau heisst: die Spitze liegt darin.
  const MITTE_W = 7;

  // Der Arbeiter.
  const GEH_V = 290;               // Einheiten je Sekunde
  const ARBEITER_GROSS = 1.45;     // gezeichnet ist er 27 Einheiten hoch
  const FALL_G = 1300;

  // ---------------------------------------------------------------------------
  // Wie schwer die nächste Schlucht ist
  // ---------------------------------------------------------------------------
  // Die Zahlen sind ausgespielt, nicht ausgerechnet. Die ersten fünf Brücken
  // schafft fast jeder; ab zehn wird es eng; ab fünfzehn trifft nur noch, wer
  // den Balken wirklich im Gefühl hat.
  const SCHWER_BIS = 16;           // nach so vielen Brücken ist das Härteste erreicht
  const BEWEGT_AB = 10;            // ab dieser Brücke pendelt der Pfeiler drüben
  const PENDEL_MAX = 26;           // so weit pendelt er höchstens (halbe Weite)

  const HELP = [
    "Brückenbauer. Halte den Finger auf dem Bild, dann wächst an der Kante ein Balken in die Höhe.",
    "Lass los, dann kippt er nach vorn über die Schlucht.",
    "Reicht er genau auf den nächsten Pfeiler, geht der Arbeiter hinüber. Ist er zu kurz oder zu lang, fällt er.",
    "Triffst du die rote Mitte des Pfeilers, zählt die Brücke doppelt – und mehrere genaue hintereinander zählen noch mehr.",
    "Du hast vierzig Sekunden. Später werden die Pfeiler schmaler, und manche bewegen sich.",
  ].join(" ");

  const TOP_COUNT = 5;
  const store = cloudApi
    ? cloudApi.register({ key: "lernapp.bruecke", empty: { runs: 0, scores: [] }, merge: cloudApi.mergeScores(TOP_COUNT) })
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

  // Immer dieselbe Zahl zu derselben Eingabe: Risse im Fels und Wolken stehen
  // bei jedem Neustart am selben Platz.
  function hash01(n) {
    const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return x - Math.floor(x);
  }

  // ---------------------------------------------------------------------------
  // Zustand
  // ---------------------------------------------------------------------------
  // phase:   "bereit" (noch nichts gedrückt), "spiel", "ende"
  // schritt: was gerade geschieht – "warten" auf den Finger, "wachsen",
  //          "kippen", "gehen", "schieben" (das Bild rückt nach) und "fallen"
  const state = {
    phase: "bereit",
    schritt: "warten",
    punkte: 0,
    bruecken: 0,
    kette: 0,             // genaue Treffer hintereinander
    pfeiler: [],          // { x, w, mitte, basis, weite, periode, ph, fest }
    hier: 0,              // Index des Pfeilers, auf dem der Arbeiter steht
    balken: null,         // { x, len, winkel }
    alte: [],             // liegende Balken früherer Brücken
    arbeiter: { x: 0, y: OBEN, vy: 0, dreh: 0, schritt: 0 },
    ziel: 0,
    gehVon: 0,
    treffer: false,
    genau: false,
    kippZeit: 0,
    camX: 0,
    camY: 0,
    funken: [],
    schriften: [],
    stoss: 0,
    zeit: 0,
    endeZeit: 0,
  };

  let shell = null;
  let feld = null;
  let canvas = null;
  let g = null;
  let combo = null;
  let frame = null;
  let last = 0;
  let stepTimer = null;
  let gedrueckt = false;
  // Die Gegner (geist.js): wer mitläuft, und wo er gerade ist.
  let gegner = null;

  const view = { s: 1, dpr: 1, cssW: 0, cssH: 0, w: WELT_W, h: SICHT_H };

  function clearStep() {
    if (stepTimer) { window.clearTimeout(stepTimer); stepTimer = null; }
  }

  function stopLoop() {
    if (frame) { window.cancelAnimationFrame(frame); frame = null; }
  }

  // ---------------------------------------------------------------------------
  // Pfeiler
  // ---------------------------------------------------------------------------
  // Der Pfeiler n ist der, den die n-te Brücke erreichen muss. Seine Lage
  // hängt allein an n und am Zufall – nie daran, wie lange jemand überlegt.
  function neuerPfeiler(n, vorher) {
    const k = clamp(n / SCHWER_BIS, 0, 1);
    const w = von(lerp(42, 13, k), lerp(64, 30, k));
    const bewegt = n >= BEWEGT_AB;
    const weite = bewegt ? lerp(10, PENDEL_MAX, clamp((n - BEWEGT_AB) / 8, 0, 1)) : 0;
    // Nicht näher als 26 Einheiten an der Kante – auch nicht, wenn der
    // Pfeiler herüberpendelt – und nie so weit, dass er aus dem Bild ragte.
    const minLuecke = 26 + weite;
    const maxLuecke = Math.max(minLuecke + 10, WELT_W - VOR_KANTE - w - weite - 8);
    const luecke = clamp(von(lerp(44, 34, k), lerp(104, 172, k)), minLuecke, maxLuecke);
    const x = vorher.x + vorher.w / 2 + luecke + w / 2;
    return {
      x,
      basis: x,
      w,
      weite,
      periode: bewegt ? von(lerp(2.6, 1.5, k), lerp(3.2, 2.1, k)) : 0,
      ph: zufall.zahl() * Math.PI * 2,
      fest: !bewegt,
      gras: hash01(n * 3.1),
    };
  }

  const kante = (p) => p.x + p.w / 2;

  // ---------------------------------------------------------------------------
  // Die Fläche
  // ---------------------------------------------------------------------------
  function buildPlatz() {
    const platz = shell.el("div", "br-platz");
    feld = shell.el("div", "br-feld");
    canvas = document.createElement("canvas");
    canvas.className = "br-canvas";
    canvas.setAttribute("aria-hidden", "true");
    feld.append(canvas);
    g = canvas.getContext("2d");

    combo = shell.el("span", "br-combo");
    combo.setAttribute("aria-hidden", "true");
    feld.append(combo);

    // Der Hinweis vor dem ersten Druck: ein Ring, der sich füllt – halten,
    // nicht tippen.
    const tipp = shell.el("span", "br-tipp");
    tipp.setAttribute("aria-hidden", "true");
    tipp.append(art.el("svg", { viewBox: "0 0 64 64" }, [
      art.el("circle", { cx: 32, cy: 32, r: 22, fill: "none", stroke: "rgba(255,255,255,0.45)", "stroke-width": 5 }),
      art.el("circle", { class: "br-tipp-fuell", cx: 32, cy: 32, r: 22, fill: "none", stroke: "#ffffff", "stroke-width": 5, "stroke-linecap": "round" }),
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

  // Die Oberkante der Pfeiler steht auf einem Viertel der Bildhöhe: darüber
  // ist Platz für den Balken, auch für den längsten (172 Einheiten Schlucht
  // und ein halber Pfeiler – drei Viertel von SICHT_H sind 195).
  const camYZiel = () => OBEN - view.h * 0.25;

  const wackel = () => (ruhig() ? 0 : Math.sin(state.zeit * 70) * 2.2 * state.stoss);

  function bildTransform() {
    g.setTransform(view.dpr, 0, 0, view.dpr, 0, wackel() * view.dpr);
  }

  // Welt nach Bild: x vom linken Bildrand (camX), y vom unteren (camY).
  function weltTransform() {
    const f = view.s * view.dpr;
    g.setTransform(f, 0, 0, -f, -state.camX * f, (view.cssH + state.camY * view.s + wackel()) * view.dpr);
  }

  const bildX = (x) => (x - state.camX) * view.s;
  const bildY = (y) => view.cssH - (y - state.camY) * view.s;

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

  // ---------------------------------------------------------------------------
  // Himmel, Berge, Nebel
  // ---------------------------------------------------------------------------
  // Abendlicht: warm unten, blau oben. Zwei Bergketten ziehen langsamer mit
  // als die Pfeiler – so liegt die Schlucht vor einer Ferne.
  function zeichneHimmel() {
    bildTransform();
    const verlauf = g.createLinearGradient(0, 0, 0, view.cssH);
    verlauf.addColorStop(0, "#3d5a9e");
    verlauf.addColorStop(0.55, "#e88b6a");
    verlauf.addColorStop(1, "#ffd49a");
    g.fillStyle = verlauf;
    g.fillRect(0, -10, view.cssW, view.cssH + 20);

    const kurz = Math.min(view.cssW, view.cssH);
    const sx = view.cssW * 0.72;
    const sy = bildY(OBEN + 70);
    const sr = kurz * 0.11;
    const schein = g.createRadialGradient(sx, sy, sr * 0.4, sx, sy, sr * 3.2);
    schein.addColorStop(0, "rgba(255, 236, 170, 0.75)");
    schein.addColorStop(1, "rgba(255, 236, 170, 0)");
    g.fillStyle = schein;
    g.fillRect(sx - sr * 3.2, sy - sr * 3.2, sr * 6.4, sr * 6.4);
    g.fillStyle = "#fff1c4";
    g.beginPath();
    g.arc(sx, sy, sr, 0, Math.PI * 2);
    g.fill();

    // Wolken treiben langsam, unabhängig vom Bild.
    g.fillStyle = "rgba(255, 255, 255, 0.55)";
    for (let i = 0; i < 5; i += 1) {
      const treib = ruhig() ? 0 : state.zeit * (4 + hash01(i * 7.7) * 6);
      const breite = view.cssW + 200;
      const x = ((hash01(i * 2.3) * breite - state.camX * view.s * 0.08 + treib) % breite + breite) % breite - 100;
      const y = view.cssH * (0.12 + hash01(i * 9.1) * 0.28);
      const r = (14 + hash01(i * 4.4) * 12) * view.s;
      g.beginPath();
      g.arc(x, y, r, 0, Math.PI * 2);
      g.arc(x + r * 0.9, y - r * 0.35, r * 0.75, 0, Math.PI * 2);
      g.arc(x + r * 1.8, y, r * 0.6, 0, Math.PI * 2);
      g.fill();
    }

    berge(0.16, OBEN + 40, 64, "#8a6f9e", 1.7);
    berge(0.34, OBEN + 6, 52, "#5c4f7d", 4.1);
  }

  // Eine Bergkette als Zickzack aus festen Spitzen, die mit dem Bild wandert –
  // nur langsamer (tiefe = Anteil der Bewegung).
  function berge(tiefe, hoehe, zacke, farbe, saat) {
    const versatz = state.camX * tiefe;
    const schritt = 46;
    const erster = Math.floor(versatz / schritt) - 1;
    const anzahl = Math.ceil(view.w / schritt) + 3;
    g.fillStyle = farbe;
    g.beginPath();
    g.moveTo(-10, view.cssH + 10);
    for (let i = 0; i <= anzahl; i += 1) {
      const n = erster + i;
      const wx = n * schritt - versatz;
      const spitze = hoehe + hash01(n * 1.37 + saat) * zacke;
      g.lineTo(wx * view.s, bildY(spitze));
    }
    g.lineTo(view.cssW + 10, view.cssH + 10);
    g.closePath();
    g.fill();
  }

  function zeichneNebel() {
    bildTransform();
    const oben = bildY(OBEN - 70);
    const verlauf = g.createLinearGradient(0, oben, 0, view.cssH);
    verlauf.addColorStop(0, "rgba(255, 226, 196, 0)");
    verlauf.addColorStop(1, "rgba(255, 226, 196, 0.85)");
    g.fillStyle = verlauf;
    g.fillRect(0, oben, view.cssW, view.cssH - oben + 10);
  }

  // ---------------------------------------------------------------------------
  // Pfeiler, Balken, Arbeiter
  // ---------------------------------------------------------------------------
  function zeichnePfeiler(p, i) {
    const x1 = p.x - p.w / 2;
    const unten = state.camY - 20;
    const hoch = OBEN - unten;
    g.fillStyle = "#4b4f63";
    g.fillRect(x1, unten, p.w, hoch);
    // Licht von rechts, wo die Sonne steht.
    g.fillStyle = "#6a6f87";
    g.fillRect(x1 + p.w * 0.62, unten, p.w * 0.38, hoch);
    g.fillStyle = "#3a3d4f";
    g.fillRect(x1, unten, Math.min(3, p.w * 0.15), hoch);
    // Risse im Fels, je Pfeiler an denselben Stellen.
    g.strokeStyle = "rgba(30, 32, 44, 0.45)";
    g.lineWidth = 1.2;
    g.beginPath();
    for (let r = 0; r < 3; r += 1) {
      const rx = x1 + p.w * (0.2 + hash01(i * 5.3 + r) * 0.6);
      const ry = OBEN - 18 - hash01(i * 2.9 + r * 3.1) * 50;
      g.moveTo(rx, ry);
      g.lineTo(rx + (hash01(i + r * 7.7) - 0.5) * 6, ry - 14);
      g.lineTo(rx + (hash01(i * 3 + r) - 0.5) * 8, ry - 26);
    }
    g.stroke();
    // Gras auf der Kante.
    g.fillStyle = "#6fb35a";
    rundRect(x1 - 1.5, OBEN - 4, p.w + 3, 6, 2.5);
    g.fill();
    g.fillStyle = "#93cf6f";
    g.fillRect(x1, OBEN, p.w, 1.6);
    // Die rote Mitte – auf den Pfeilern, die noch erreicht werden wollen. Wer
    // sie getroffen hat, sieht sie gelb aufleuchten.
    if (i > state.hier || p.getroffen) {
      const glimm = p.getroffen ? 1 : 0.85 + 0.15 * Math.sin(state.zeit * 6);
      g.globalAlpha = glimm;
      g.fillStyle = p.getroffen ? "#ffe066" : "#e8473f";
      g.fillRect(p.x - MITTE_W / 2, OBEN - 1.5, MITTE_W, 3.2);
      g.globalAlpha = 1;
    }
  }

  // Ein Balken aus Holz, der sich um seinen Fuss an der Kante dreht.
  function zeichneBalken(b) {
    if (!b || b.len <= 0.5) return;
    g.save();
    g.translate(b.x, OBEN);
    g.rotate(-b.winkel);
    g.fillStyle = "#8b5a2b";
    g.fillRect(-BALKEN_D / 2, 0, BALKEN_D, b.len);
    g.fillStyle = "#b07a42";
    g.fillRect(-BALKEN_D / 2, 0, BALKEN_D * 0.45, b.len);
    // Maserung: ein paar Querstriche, damit er nach Holz aussieht.
    g.fillStyle = "rgba(70, 40, 18, 0.45)";
    for (let y = 9; y < b.len - 3; y += 17) g.fillRect(-BALKEN_D / 2, y, BALKEN_D, 1);
    g.restore();
  }

  // Der Arbeiter: Helm, Weste, zwei Beine, die beim Gehen schwingen.
  function zeichneArbeiter() {
    const a = state.arbeiter;
    const gehen = state.schritt === "gehen";
    const pendel = gehen ? Math.sin(a.schritt * 14) : 0;
    const wippen = gehen ? Math.abs(Math.sin(a.schritt * 14)) * 1.6 : Math.sin(state.zeit * 3) * 0.5;
    // Beim Wachsen stemmt er sich hinein.
    const druck = state.schritt === "wachsen" ? 1.6 : 0;
    g.save();
    g.translate(a.x, a.y);
    g.rotate(a.dreh);
    g.scale(ARBEITER_GROSS, ARBEITER_GROSS);
    g.lineCap = "round";
    g.strokeStyle = "#2c3446";
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(-1.6, 9);
    g.lineTo(-1.6 + pendel * 3, 0.6);
    g.moveTo(1.6, 9);
    g.lineTo(1.6 - pendel * 3, 0.6);
    g.stroke();
    g.translate(0, wippen - druck * 0.5);
    // Rumpf mit Weste
    g.fillStyle = "#f08a24";
    rundRect(-5.2, 8, 10.4, 11, 3.5);
    g.fill();
    g.fillStyle = "#ffe066";
    g.fillRect(-5.2, 12.5, 10.4, 1.7);
    // Arm, der zum Balken greift
    g.strokeStyle = "#f08a24";
    g.lineWidth = 2.6;
    g.beginPath();
    g.moveTo(3, 16);
    g.lineTo(7 + druck, 12 + (gehen ? pendel * 2 : 0));
    g.stroke();
    // Kopf
    g.fillStyle = "#f2c39b";
    g.beginPath();
    g.arc(0.6, 23, 4.4, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "#2c3446";
    g.beginPath();
    g.arc(2.6, 23.4, 0.9, 0, Math.PI * 2);
    g.fill();
    // Helm
    g.fillStyle = "#ffd23f";
    g.beginPath();
    g.arc(0.4, 24.6, 5, 0, Math.PI);
    g.fill();
    g.fillRect(-5.4, 24, 12.4, 1.8);
    g.restore();
  }

  function zeichneFunken() {
    state.funken.forEach((f) => {
      const k = clamp(f.leben / f.max, 0, 1);
      g.globalAlpha = k;
      g.fillStyle = f.farbe;
      g.beginPath();
      g.arc(f.x, f.y, f.r * (0.4 + 0.6 * k), 0, Math.PI * 2);
      g.fill();
    });
    g.globalAlpha = 1;
  }

  // Die schwebenden Zahlen nach einer Brücke: im Bild gezeichnet, nicht in
  // der Welt – sonst stünden sie auf dem Kopf.
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
      g.strokeStyle = "rgba(40, 30, 60, 0.55)";
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
    zeichneHimmel();
    weltTransform();
    const links = state.camX - 40;
    const rechts = state.camX + view.w + 40;
    state.pfeiler.forEach((p, i) => {
      if (p.x + p.w / 2 < links || p.x - p.w / 2 > rechts) return;
      zeichnePfeiler(p, i);
    });
    state.alte.forEach(zeichneBalken);
    zeichneBalken(state.balken);
    const geister = geisterOrte();
    geister.forEach(zeichneGeist);
    zeichneArbeiter();
    zeichneFunken();
    zeichneNebel();
    zeichneGeistNamen(geister);
    zeichneSchriften();
  }

  // ---------------------------------------------------------------------------
  // Die Geister
  // ---------------------------------------------------------------------------
  // Wie weit jemand ist, sagt eine Zahl: die Brücken, die er hinter sich hat,
  // und wie weit er über die nächste gegangen ist (2,5 = mitten auf der
  // dritten). Aufgezeichnet wird sie mal hundert. Gezeigt wird der Geist auf
  // den eigenen Pfeilern – seine waren andere, aber gezählt wird hier wie
  // dort in Brücken.
  function fortschritt() {
    const a = state.arbeiter;
    if (state.schritt !== "gehen" || !state.treffer) return state.bruecken;
    const weg = state.ziel - state.gehVon;
    return state.bruecken + (weg > 0 ? clamp((a.x - state.gehVon) / weg, 0, 0.99) : 0);
  }

  // Wo die Geister jetzt stehen. Vor der Runde stehen sie nicht da: Sie
  // stünden alle genau auf dem Arbeiter.
  function geisterOrte() {
    if (!gegner || state.phase === "bereit") return [];
    const ms = gegner.zeit();
    return gegner.gegner().filter((geg) => geg.lauf?.mitOrt).map((geg) => {
      const f = Math.max(0, geg.lauf.ort(ms).a / 100);
      const n = Math.floor(f + 0.001);
      const anteil = clamp(f - n, 0, 1);
      const von = state.pfeiler[n];
      const nach = state.pfeiler[n + 1];
      let x = null;
      if (von) x = kante(von) - 9 + (nach && anteil > 0 ? (kante(nach) - kante(von)) * anteil : 0);
      const fertig = geg.lauf.fertig(ms);
      const blass = fertig ? clamp(1 - (ms - geg.lauf.dauer) / 1200, 0, 1) : 1;
      return { ...geg, x, n, anteil, ms, blass, vorsprung: n - state.bruecken };
    });
  }

  function zeichneGeist(geist) {
    if (geist.x === null || geist.blass <= 0) return;
    const gehen = geist.anteil > 0;
    const pendel = gehen ? Math.sin(geist.ms / 1000 * 14) : 0;
    g.save();
    g.globalAlpha = 0.5 * geist.blass;
    g.translate(geist.x, OBEN);
    g.scale(ARBEITER_GROSS, ARBEITER_GROSS);
    g.lineCap = "round";
    g.strokeStyle = geist.farbe;
    g.fillStyle = geist.farbe;
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(-1.6, 9);
    g.lineTo(-1.6 + pendel * 3, 0.6);
    g.moveTo(1.6, 9);
    g.lineTo(1.6 - pendel * 3, 0.6);
    g.stroke();
    rundRect(-5.2, 8, 10.4, 11, 3.5);
    g.fill();
    g.beginPath();
    g.arc(0.6, 23, 4.4, 0, Math.PI * 2);
    g.fill();
    g.beginPath();
    g.arc(0.4, 24.6, 5, 0, Math.PI);
    g.fill();
    g.restore();
  }

  // Der Name über dem Geist – oder, wenn er ausserhalb des Bildes ist, ein
  // Schild am Rand: wie viele Brücken er voraus ist oder zurückliegt.
  function zeichneGeistNamen(geister) {
    if (!geister.length) return;
    bildTransform();
    g.textBaseline = "middle";
    const gross = Math.round(clamp(10 * view.s, 11, 16));
    g.font = `800 ${gross}px system-ui, sans-serif`;
    geister.forEach((geist, i) => {
      if (geist.blass <= 0) return;
      g.globalAlpha = 0.9 * geist.blass;
      const sx = geist.x === null ? Infinity : bildX(geist.x);
      if (sx > -10 && sx < view.cssW + 10) {
        g.textAlign = "center";
        const sy = bildY(OBEN + 27 * ARBEITER_GROSS + 8) - i * (gross + 3);
        g.lineWidth = 3;
        g.strokeStyle = "rgba(40, 30, 60, 0.55)";
        g.strokeText(geist.name, sx, sy);
        g.fillStyle = geist.farbe;
        g.fillText(geist.name, sx, sy);
        return;
      }
      const rechts = sx >= view.cssW;
      const text = rechts ? `${geist.name} +${Math.max(1, geist.vorsprung)} ▸` : `◂ ${geist.name} ${Math.min(-1, geist.vorsprung)}`;
      const w = g.measureText(text).width + gross;
      const y = view.cssH * 0.18 + i * (gross + 10);
      const x = rechts ? view.cssW - w - 8 : 8;
      g.fillStyle = "rgba(30, 30, 50, 0.55)";
      rundRect(x, y - gross * 0.75, w, gross * 1.5, gross * 0.75);
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
      shell.setPhase("play");
      shell.startClock(RUNDE_MS, zeitUm);
      gegner?.los();
    }
    if (state.phase !== "spiel" || state.schritt !== "warten") return;
    const p = state.pfeiler[state.hier];
    state.balken = { x: kante(p), len: 0, winkel: 0 };
    state.schritt = "wachsen";
    kids()?.vibrate?.(8);
  }

  function loslassen() {
    if (!gedrueckt) return;
    gedrueckt = false;
    if (state.phase !== "spiel" || state.schritt !== "wachsen") return;
    state.schritt = "kippen";
    state.kippZeit = 0;
  }

  // ---------------------------------------------------------------------------
  // Der Ablauf einer Brücke
  // ---------------------------------------------------------------------------
  function wachsTempo() {
    return Math.min(WACHS_MAX, WACHS_START + state.bruecken * WACHS_SCHRITT);
  }

  // Der Balken liegt. Wohin reicht er, und wo steht der Pfeiler gerade?
  function aufgeschlagen() {
    const b = state.balken;
    const p = state.pfeiler[state.hier + 1];
    p.fest = true;  // was trägt, pendelt nicht mehr
    const spitze = b.x + b.len;
    state.treffer = b.len > 0 && spitze >= p.x - p.w / 2 && spitze <= p.x + p.w / 2;
    // Zu kurz fällt der Balken mit in die Schlucht; zu lang bleibt er liegen,
    // und nur der Arbeiter tritt ins Leere.
    b.faellt = !state.treffer && spitze < p.x - p.w / 2;
    state.genau = state.treffer && Math.abs(spitze - p.x) <= MITTE_W / 2;
    state.ziel = state.treffer ? kante(p) - 9 : spitze;
    state.gehVon = state.arbeiter.x;
    state.schritt = "gehen";
    state.stoss = state.treffer ? 0.5 : 0.2;
    staub(spitze, OBEN, 7);
    kids()?.vibrate?.(12);
  }

  function angekommen() {
    if (!state.treffer) {
      state.schritt = "fallen";
      state.arbeiter.vy = 40;
      shell.stopClock();
      state.kette = 0;
      zeigeCombo();
      kids()?.playJingle?.("retry");
      kids()?.vibrate?.([20, 40, 30]);
      stepTimer = window.setTimeout(finish, 950);
      return;
    }
    const p = state.pfeiler[state.hier + 1];
    let plus = 1;
    if (state.genau) {
      state.kette += 1;
      plus += Math.min(state.kette, 3);
      p.getroffen = true;
      state.stoss = 1;
      funken(p.x, OBEN + 2, "#ffe066", 16);
      schrift(`+${plus}`, p.x, OBEN + 34, "#ffe066", 22);
      kids()?.playJingle?.(state.kette >= 3 ? "unlock" : "correct");
      kids()?.vibrate?.(24);
    } else {
      state.kette = 0;
      schrift("+1", p.x, OBEN + 30, "#ffffff", 16);
      kids()?.playJingle?.("star");
    }
    zeigeCombo();
    state.punkte += plus;
    state.bruecken += 1;
    shell.setCount(state.punkte);
    state.alte.push(state.balken);
    state.balken = null;
    state.hier += 1;
    state.pfeiler.push(neuerPfeiler(state.bruecken, state.pfeiler[state.pfeiler.length - 1]));
    // Was weit links liegt, sieht niemand mehr.
    while (state.alte.length > 6) state.alte.shift();
    state.schritt = "schieben";
  }

  function staub(x, y, anzahl) {
    for (let i = 0; i < anzahl; i += 1) {
      state.funken.push({
        x, y,
        vx: (Math.random() - 0.5) * 70,
        vy: 20 + Math.random() * 40,
        r: 1.5 + Math.random() * 2,
        leben: 0.4 + Math.random() * 0.3,
        max: 0.7,
        farbe: "rgba(240, 220, 190, 0.9)",
      });
    }
  }

  function funken(x, y, farbe, anzahl) {
    for (let i = 0; i < anzahl; i += 1) {
      const w = Math.PI * (0.1 + Math.random() * 0.8);
      const v = 50 + Math.random() * 110;
      state.funken.push({
        x, y,
        vx: Math.cos(w) * v,
        vy: Math.sin(w) * v,
        r: 1.4 + Math.random() * 2,
        leben: 0.5 + Math.random() * 0.3,
        max: 0.8,
        farbe,
      });
    }
  }

  function schrift(text, x, y, farbe, gross) {
    state.schriften.push({ text, x, y, farbe, gross, leben: 0.9, max: 0.9 });
  }

  function zeigeCombo() {
    if (!combo) return;
    if (state.kette < 2) { combo.classList.remove("is-an"); return; }
    combo.textContent = `Genau ×${state.kette}`;
    combo.classList.remove("is-an", "is-pop");
    void combo.offsetWidth;
    combo.classList.add("is-an", "is-pop");
  }

  // ---------------------------------------------------------------------------
  // Die Schleife
  // ---------------------------------------------------------------------------
  function schritt(dt) {
    state.zeit += dt;
    if (state.stoss > 0) state.stoss = Math.max(0, state.stoss - dt * 6);

    // Pendelnde Pfeiler – nur der, der als nächster erreicht werden will.
    state.pfeiler.forEach((p) => {
      if (p.fest || !p.periode) return;
      p.x = p.basis + Math.sin(state.zeit * (Math.PI * 2 / p.periode) + p.ph) * p.weite;
    });

    const a = state.arbeiter;
    const b = state.balken;
    switch (state.schritt) {
      case "wachsen":
        b.len += wachsTempo() * dt;
        // Länger als das Bild hoch ist, wird kein Balken – das wäre keine
        // Brücke mehr, sondern ein Versehen.
        if (b.len > view.h) b.len = view.h;
        break;
      case "kippen": {
        state.kippZeit += dt * 1000;
        const k = clamp(state.kippZeit / KIPP_MS, 0, 1);
        b.winkel = (Math.PI / 2) * k * k;
        if (k >= 1) aufgeschlagen();
        break;
      }
      case "gehen":
        a.schritt += dt;
        a.x = Math.min(state.ziel, a.x + GEH_V * dt);
        if (a.x >= state.ziel) angekommen();
        break;
      case "schieben": {
        const ziel = kante(state.pfeiler[state.hier]) - VOR_KANTE;
        const k = 1 - Math.exp(-11 * dt);
        state.camX += (ziel - state.camX) * k;
        if (Math.abs(ziel - state.camX) < 0.6) {
          state.camX = ziel;
          state.schritt = "warten";
          // Wer den Finger schon wieder unten hat, baut gleich weiter.
          if (gedrueckt) druecken();
        }
        break;
      }
      case "fallen":
        a.vy -= FALL_G * dt;
        a.y += a.vy * dt;
        a.dreh -= dt * 4;
        if (b && b.faellt && b.winkel < Math.PI) b.winkel = Math.min(Math.PI, b.winkel + dt * 5);
        break;
      default:
        break;
    }

    for (let i = state.funken.length - 1; i >= 0; i -= 1) {
      const f = state.funken[i];
      f.vy -= 260 * dt;
      f.x += f.vx * dt;
      f.y += f.vy * dt;
      f.leben -= dt;
      if (f.leben <= 0) state.funken.splice(i, 1);
    }
    for (let i = state.schriften.length - 1; i >= 0; i -= 1) {
      state.schriften[i].leben -= dt;
      if (state.schriften[i].leben <= 0) state.schriften.splice(i, 1);
    }

    const zielY = camYZiel();
    state.camY += (zielY - state.camY) * (1 - Math.exp(-10 * dt));

    if (state.phase === "spiel") gegner?.takt(state.punkte, { a: Math.round(fortschritt() * 100), b: 0 });
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
    shell.stopClock();
    shell.closeOverlay();
    zufall.neu();
    shell.setPhase("intro");
    state.phase = "bereit";
    state.schritt = "warten";
    state.punkte = 0;
    state.bruecken = 0;
    state.kette = 0;
    state.hier = 0;
    state.balken = null;
    state.alte = [];
    state.funken = [];
    state.schriften = [];
    state.stoss = 0;
    state.zeit = 0;
    gedrueckt = false;
    shell.setCount(0);
    gegner?.runde();

    shell.clear();
    const prompt = shell.el("p", "cm-prompt br-prompt", "Halten – der Balken wächst. Loslassen – er kippt.");
    shell.play.append(prompt, buildPlatz());
    view.cssW = 0;
    view.cssH = 0;
    messen();

    // Der erste Pfeiler ist breit und steht fest: Dort beginnt jeder gleich.
    const erster = { x: 0, basis: 0, w: 70, weite: 0, periode: 0, ph: 0, fest: true, gras: 0 };
    state.pfeiler = [erster];
    state.pfeiler.push(neuerPfeiler(0, erster));
    state.arbeiter = { x: kante(erster) - 9, y: OBEN, vy: 0, dreh: 0, schritt: 0 };
    state.camX = kante(erster) - VOR_KANTE;
    state.camY = camYZiel();
    zeigeCombo();

    last = performance.now();
    frame = window.requestAnimationFrame(loop);
  }

  function zeitUm() {
    // Wer schon fällt, fällt zu Ende – die Tafel kommt dann ohnehin.
    if (state.phase !== "spiel" || state.schritt === "fallen" || state.schritt === "ende") return;
    // Eine Brücke, die gerade begangen wird, zählt nicht mehr – die Zeit ist
    // um, wenn sie um ist.
    state.schritt = "ende";
    kids()?.playJingle?.("star");
    stepTimer = window.setTimeout(finish, 350);
  }

  function zaehleHoch(ziel) {
    const zahl = host.querySelector(".cm-result-score");
    if (!zahl) return;
    if (ruhig() || ziel <= 1) { zahl.textContent = String(ziel); return; }
    const dauer = Math.min(700, 120 + ziel * 30);
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
    const bruecken = state.bruecken === 1 ? "1 Brücke" : `${state.bruecken} Brücken`;
    shell.showResult({
      label: "Deine Punkte",
      points: punkte,
      detail: rekord ? "Neuer Rekord!" : `${bruecken}${vorher ? ` · Bestwert ${vorher}` : ""}`,
      speech: `${punkte} Punkte, ${bruecken}.${rekord ? " Das ist dein neuer Rekord!" : ""}`,
      geist,
    });
    if (rekord) host.querySelector(".cm-result-detail")?.classList.add("br-rekord");
    zaehleHoch(punkte);
  }

  // ---------------------------------------------------------------------------
  // Start
  // ---------------------------------------------------------------------------
  shell = shellApi.mount({
    host,
    title: "Brückenbauer",
    area: "problemloesen",
    accent: "#3FA34D",
    accentDark: "#2c7337",
    help: HELP,
    clock: true,
    onRestart: startRun,
  });
  gegner = window.LernappGeist?.fuer?.({ spiel: "bridgeBuilder", host, art: "tempo" }) || null;

  startRun();

  host.addEventListener("pointerdown", (event) => {
    if (event.target.closest("button, a, input")) return;
    druecken();
  });
  window.addEventListener("pointerup", loslassen);
  window.addEventListener("pointercancel", loslassen);
  // Wer das Fenster verlässt, während der Balken wächst, hat losgelassen.
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
  window.LernappBruecke = {
    OBEN, MITTE_W, RUNDE_MS, state, view, neuerPfeiler, wachsTempo, fortschritt,
  };
})();
