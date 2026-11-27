/*
 * seifenblase.js – Seifenblase.
 * ---------------------------------------------------------------------------
 * Ein Sommerabend. Aus dem Ring über der Schale auf dem Gartentisch steigt
 * eine Seifenblase auf, und vor ihr windet sich eine Rennstrecke in den
 * Abendhimmel: eine Bahn zwischen zwei schillernden Lichtbändern, die mal
 * links, mal rechts, schräg hinauf, quer hinüber und auch wieder hinunter
 * führt. Man berührt die Blase nie. Eine Regel: Ein Tipp irgendwo aufs Bild
 * bläst einen kurzen Luftstoss von der Stelle des Fingers weg, und die Blase
 * treibt vom Finger fort – umso stärker, je näher man tippt. Unter ihr
 * getippt steigt sie schneller, links von ihr treibt sie nach rechts, über
 * ihr drückt man sie hinunter. Wer sie selbst trifft, dem zerplatzt sie
 * unter dem Finger – und wer den Rand der Bahn berührt, dem auch.
 *
 * Es zählt, wie weit man auf der Bahn kommt und wie schnell: Punkte sind die
 * Streckenmeter mal einem Tempofaktor. Hinter der Blase kriecht der
 * Abendnebel die Bahn entlang, immer etwas schneller – wer trödelt, den holt
 * er ein. Die ersten Abschnitte sind nur Bahn, zum Rasen; erst ab gut 15
 * Sekunden kreuzen Vögel und Wolkenfetzen auf festen, sichtbaren Bahnen, und
 * die Bahn wird an Engstellen schmal. Jeder achte Abschnitt ist besonders,
 * im festen Wechsel und vorher angesagt: Rückenwind, der die Blase die Bahn
 * entlang trägt, oder eine Böe quer über die Bahn. Sonst weht kein Wind.
 *
 * Gebaut wird die Bahn aus dem Zufall (zufall.js): ohne Turnier jedes Mal
 * eine andere, im Turnier für alle im selben Versuch dieselbe. Sie hängt nur
 * an der Saat, die Runde nur an Spielzeit, Saat und den Tipps (Zeit und Ort
 * in der Welt). Zuerst entsteht die Mittellinie, Figur um Figur (Gerade,
 * Bogen, Querfahrt, Zickzack, Schikane, Tauchgang), jede aus Geraden und
 * Kreisbögen – nie enger, als die Bahn breit ist, und nie zu nah an einem
 * früheren Stück (figurBauen, passt). Dann die Breite. Dann, was sich
 * bewegt, so getaktet, dass es weg ist, wenn eine Blase im Zeitplan kommt –
 * auch wer «luft» zu früh oder zu spät ist (phasenSuchen).
 *
 * Das Bild: Himmel und Ferne werden einmal gemalt und aufgelegt, die Bahn
 * je Bild als Linien. Man sieht auf jedem Gerät gleich weit voraus: Die
 * Kamera schaut die Bahn entlang nach vorn, und was weiter weg ist als die
 * Sicht, verschwindet im Dunst. Der Himmel wird mit dem Weg Abend, Dämmerung
 * und Nacht. Die schillernde Blase ist ein vorgerechneter Seifenfilm
 * (filmBild), der sich in ihr dreht, hinter einer Maske, darüber Glanz und
 * Fensterkreuz. Beim ersten Start wächst sie erst aus dem Ring.
 *
 * Die Gegner (geist.js) fliegen als Blasen aus Licht mit, und die besten
 * Läufe lassen sich anschauen (?zuschauen=): auf derselben Bahn, gebaut mit
 * derselben Saat; die Luftstösse stehen in der Aufzeichnung, mit Richtung
 * und Abstand des Fingers.
 *
 * Eine Einheit ist ein Zentimeter, hundert sind ein Meter. x zählt quer, y
 * nach oben; die Blase startet bei (0, 0), wo auch die Bahn beginnt.
 */
(() => {
  "use strict";

  if (document.body.dataset.page !== "seifenblase") return;

  const host = document.querySelector("#sb-stage");
  const shellApi = window.LernappGameShell;
  const cloudApi = window.LernappGameCloud;
  if (!host || !shellApi) return;

  const kids = () => window.LernappKids || null;
  const klang = () => window.ArcadeKlang || null;
  const ruhig = () => Boolean(kids()?.prefersReducedMotion?.());

  // Der Zufall. Nur die Welt zieht daraus – der Weg, die Hindernisse, der
  // Wind. Glitzer, Tröpfchen, Pollen und Glühwürmchen hängen an festen
  // Zahlen oder an Math.random.
  const zufall = window.LernappZufall?.fuer?.("soapBubble") || {
    neu() {},
    zahl: () => Math.random(),
  };
  // ---------------------------------------------------------------------------
  // Die Regeln
  // ---------------------------------------------------------------------------
  const METER = 100;
  const R = 7;                     // so gross ist sie (Halbmesser)
  const RH = R * 0.97;             // so nah darf etwas kommen – sie wabert ein wenig
  // Der Luftwiderstand: So schnell gleicht sie sich der Luft an – ein Stoss
  // ist nach 0,65 s auf gut ein Drittel abgeklungen. Ein Stoss von J
  // Einheiten je Sekunde trägt sie so um J × TAU weit.
  const TAU_X = 0.65;
  const TAU_Y = 0.65;
  // Der Luftstoss: J0 dicht neben ihr, halb so stark D0 weiter weg, ab DMAX
  // nichts mehr. Wer näher als BERUEHRT an ihre Mitte tippt, trifft sie.
  const J0 = 80;
  const D0 = 22;
  const DMAX = 95;
  const BERUEHRT = R * 0.85;
  // Der Auftrieb: Sie steigt von selbst, immer gleich schnell.
  const AUFTRIEB = 32;
  // Der Zeitplan: So schnell kommt eine Blase im Plan die Bahn entlang – von
  // V0 cm in der Sekunde gegen V_MAX. Ihm folgt der Nebel, an ihm misst sich
  // der Tempofaktor, nach ihm sind die Vögel getaktet.
  const V0 = 34;
  const V_MAX = 100;
  const V_ZEIT = 50;
  // Die Bahn: so weit reicht sie von der Mitte zu jedem Rand – am Anfang
  // 44 cm (die Blase hat 37 cm Luft je Seite), dann schmaler gegen 16.
  const W0 = 44;
  const W_MIN = 16;
  const W_AB = 6;
  const W_ZEIT = 20;
  // Die Bögen: ihr Halbmesser, am Anfang weit, dann enger – nie enger als
  // die Bahn breit ist (der innere Rand bleibt ein Bogen).
  const RHO0 = 110;
  const RHO_MIN = 36;
  const RHO_ZEIT = 22;
  const WAND = 22;                 // so viel Himmel bleibt zwischen zwei Stücken der Bahn
  const DS = 2;                    // alle zwei Zentimeter ein Punkt der Mittellinie
  const RASTER = 60;               // das Gitter, in dem frühere Stücke gesucht werden
  // Die Luft: so viel zu früh oder zu spät darf sie bei allem sein, was sich
  // bewegt – von 0,36 s gegen 0,14 s.
  const E0 = 0.36;
  const E_MIN = 0.14;
  const E_ZEIT = 20;
  const E_AB = 4;
  const SCHWER_ZEIT = 22;          // nach so vielen Sekunden sind gut sechs Zehntel der Härte da
  const SCHWER_AB = 4;
  const HINDERNIS_AB = 15;         // erst ab dieser Zeit im Plan kreuzt etwas, wird es eng
  const RUECKENWIND = 85;          // so schnell trägt der Rückenwind die Bahn entlang
  // So weit sieht man um den Blickpunkt (er liegt die Bahn entlang vor der
  // Blase): auf jedem Gerät gleich weit; dahinter verschwindet die Bahn im
  // Dunst.
  const SICHT = 100;
  const SICHT_VOR = 0.42;          // so weit (in SICHT) liegt der Blickpunkt vor der Blase
  const TAKT = 1 / 240;
  const STURZ_MS = 2100;
  // Die Fassung der Aufzeichnung: t3 seit der Rennstrecke – Läufe in t2
  // (Höhe, Gasse) passen nicht mehr dazu. Sie steht auch wörtlich bei
  // zuschauer und fuer (unten), wo scripts/pruefen.mjs sie mit mini-games.js
  // (ANSEHBAR) vergleicht.
  const FASSUNG = "t3";
  // Die Stimmungen nach dem Weg auf der Bahn: ihre Namen und die Farben der
  // Lichtbänder (der Kern, der Schein).
  const STIMMUNGEN = [
    { ab: 0, name: "Abendrot", kern: [255, 214, 150], schein: [255, 150, 96] },
    { ab: 4500, name: "Dämmerung", kern: [255, 184, 214], schein: [236, 110, 176] },
    { ab: 11000, name: "Blaue Stunde", kern: [200, 186, 255], schein: [130, 112, 246] },
    { ab: 18000, name: "Sternennacht", kern: [206, 238, 255], schein: [110, 186, 255] },
  ];
  const UEBERGANG = 300;
  const HIMMEL_WEG = 0.32;         // so viel des Wegs auf der Bahn wird der Himmel Abend

  const TOP_COUNT = 5;
  const store = cloudApi
    ? cloudApi.register({ key: "lernapp.seifenblase", empty: { runs: 0, scores: [] }, merge: cloudApi.mergeScores(TOP_COUNT) })
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
  const glatt = (k) => { const t = clamp(k, 0, 1); return t * t * (3 - 2 * t); };
  const TAU = Math.PI * 2;

  const vRef = (t) => V_MAX - (V_MAX - V0) * Math.exp(-Math.max(0, t) / V_ZEIT);
  // So weit ist eine Blase im Plan nach t Sekunden – und wann sie bei s ist.
  const sRef = (t) => {
    const tt = Math.max(0, t);
    return V_MAX * tt - (V_MAX - V0) * V_ZEIT * (1 - Math.exp(-tt / V_ZEIT));
  };
  function tRef(s) {
    if (s <= 0) return 0;
    let t = s / ((V0 + V_MAX) / 2);
    for (let i = 0; i < 8; i += 1) t = Math.max(0, t - (sRef(t) - s) / vRef(t));
    return t;
  }
  const breiteBei = (t) => W_MIN + (W0 - W_MIN) * Math.exp(-Math.max(0, t - W_AB) / W_ZEIT);
  const rhoBei = (t) => RHO_MIN + (RHO0 - RHO_MIN) * Math.exp(-Math.max(0, t) / RHO_ZEIT);
  const luftBei = (t) => E_MIN + (E0 - E_MIN) * Math.exp(-Math.max(0, t - E_AB) / E_ZEIT);
  const schwere = (t) => 1 - Math.exp(-Math.max(0, t - SCHWER_AB) / SCHWER_ZEIT);
  // So weit hinter dem Zeitplan kriecht der Nebel die Bahn entlang: am Start
  // anderthalb Meter, bald gut siebzig Zentimeter.
  const abstandNebel = (t) => 72 + 80 * Math.exp(-Math.max(0, t) / 10);
  const nebelS = (t) => sRef(t) - abstandNebel(t);

  /*
   * Die Punkte: die Streckenmeter (der weiteste Punkt auf der Bahn, in
   * Dezimetern) mal dem Tempofaktor. Der Faktor misst, wie viel schneller
   * man im Mittel die Bahn entlang war als eine Blase im Zeitplan – so
   * schnell kriecht auch der Nebel: je km/h mehr im Durchschnitt TEMPO_K
   * mehr, nie unter 1, nie über FAKTOR_MAX. Linear im Tempo, nicht im
   * Verhältnis: Wer in den ersten Sekunden davonfliegt und dann zerplatzt,
   * bekommt so viel, aber nicht mehr als einer, der deutlich weiter kommt;
   * wer gleich weit kommt und schneller ist, liegt klar vorn. Der Faktor
   * hängt nur an Strecke und Spielzeit; Geister, Zuschauen und Turnier
   * rechnen gleich.
   */
  const TEMPO_K = 0.3;
  const FAKTOR_MAX = 2;
  const KMH = 0.036;               // cm/s in km/h
  function faktorBei(s, t) {
    const tt = Math.max(1, t);
    const mehr = (Math.max(0, s) / tt - sRef(tt) / tt) * KMH;
    return clamp(1 + TEMPO_K * mehr, 1, FAKTOR_MAX);
  }
  // Eine Zahl mit Komma, wie man sie hier schreibt.
  const zahlText = (x, stellen = 1) => x.toFixed(stellen).replace(".", ",");
  const punkteBei = (s, t) => Math.round((Math.max(0, s) / 10) * faktorBei(s, t));

  // Wie stark ein Luftstoss aus dem Abstand d (zur Mitte der Blase) ist, und
  // umgekehrt, wie weit weg man für einen Stoss der Stärke j tippt.
  function stossBei(d) {
    if (d >= DMAX) return 0;
    const q = (Math.max(d, R) - R) / D0;
    return (J0 / (1 + q * q)) * glatt((DMAX - d) / 25);
  }
  function abstandFuer(j) {
    let lo = R;
    let hi = DMAX;
    for (let i = 0; i < 22; i += 1) {
      const m = (lo + hi) / 2;
      if (stossBei(m) > j) lo = m; else hi = m;
    }
    return (lo + hi) / 2;
  }

  function hash01(n) {
    const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return x - Math.floor(x);
  }

  // Ein fester Zufall für das Bild: die Landschaft sieht jedes Mal gleich aus.
  function wuerfel(saat) {
    let a = saat >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const mix3 = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
  const rgb = (c) => `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`;
  const rgba = (c, alpha) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${alpha})`;
  // Welche Stimmung beim Weg s – und wie weit es schon die nächste ist.
  function stimmungBei(s) {
    let i = 0;
    while (i + 1 < STIMMUNGEN.length && s >= STIMMUNGEN[i + 1].ab) i += 1;
    return i;
  }
  function stimmungMix(s) {
    for (let i = 1; i < STIMMUNGEN.length; i += 1) {
      const d = s - STIMMUNGEN[i].ab;
      if (Math.abs(d) < UEBERGANG) return { a: i - 1, b: i, k: glatt((d + UEBERGANG) / (2 * UEBERGANG)) };
    }
    const w = stimmungBei(s);
    return { a: w, b: w, k: 0 };
  }

  // ---------------------------------------------------------------------------
  // Formen: Kreise, Stäbe, Vielecke – gerechnet und gemalt
  // ---------------------------------------------------------------------------
  // k: 0 Kreis (x, y, r), 1 Stab (von x1, y1 bis x2, y2, dick r), 2 Vieleck
  // (pts). rolle sagt, wie es gemalt wird.
  const kreis = (x, y, r, rolle) => ({ k: 0, x, y, r, rolle });
  const stab = (x1, y1, x2, y2, r, rolle) => ({ k: 1, x1, y1, x2, y2, r, rolle });
  const poly = (pts, rolle) => ({ k: 2, pts, rolle });

  function primBox(p) {
    if (p.k === 0) { p.x0 = p.x - p.r; p.x1 = p.x + p.r; p.y0 = p.y - p.r; p.y1 = p.y + p.r; return p; }
    if (p.k === 1) {
      p.x0 = Math.min(p.x1, p.x2) - p.r; p.x1b = Math.max(p.x1, p.x2) + p.r;
      p.y0 = Math.min(p.y1, p.y2) - p.r; p.y1b = Math.max(p.y1, p.y2) + p.r;
      return p;
    }
    let x0 = Infinity; let x1 = -Infinity; let y0 = Infinity; let y1 = -Infinity;
    p.pts.forEach(([x, y]) => { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); });
    p.x0 = x0; p.x1 = x1; p.y0 = y0; p.y1 = y1;
    return p;
  }
  // Die rechte und obere Kante (beim Stab heissen x1, y1 schon anders).
  const rechts = (p) => (p.k === 1 ? p.x1b : p.x1);
  const oben = (p) => (p.k === 1 ? p.y1b : p.y1);

  function schiebe(p, dx, dy) {
    if (p.k === 0) { p.x += dx; p.y += dy; } else if (p.k === 1) { p.x1 += dx; p.x2 += dx; p.y1 += dy; p.y2 += dy; } else p.pts = p.pts.map(([x, y]) => [x + dx, y + dy]);
    return primBox(p);
  }

  function abstandStrecke(px, py, x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const l2 = dx * dx + dy * dy;
    let u = l2 > 0 ? ((px - x1) * dx + (py - y1) * dy) / l2 : 0;
    u = u < 0 ? 0 : u > 1 ? 1 : u;
    const ex = x1 + u * dx - px;
    const ey = y1 + u * dy - py;
    return Math.sqrt(ex * ex + ey * ey);
  }

  function imPoly(px, py, pts) {
    let drin = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i, i += 1) {
      const xi = pts[i][0]; const yi = pts[i][1]; const xj = pts[j][0]; const yj = pts[j][1];
      if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) drin = !drin;
    }
    return drin;
  }

  // Wie weit der Punkt (x, y) von der Form weg ist (negativ: drin).
  function abstandForm(p, x, y) {
    if (p.k === 0) return Math.hypot(x - p.x, y - p.y) - p.r;
    if (p.k === 1) return abstandStrecke(x, y, p.x1, p.y1, p.x2, p.y2) - p.r;
    if (imPoly(x, y, p.pts)) return -1;
    const pts = p.pts;
    let d = Infinity;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i, i += 1) d = Math.min(d, abstandStrecke(x, y, pts[j][0], pts[j][1], pts[i][0], pts[i][1]));
    return d;
  }

  // Trifft eine Blase mit Halbmesser r an (x, y) eine der Formen? Dann die.
  function formTrifft(prims, x, y, r) {
    for (let i = 0; i < prims.length; i += 1) {
      const p = prims[i];
      if (p.x0 > x + r || rechts(p) < x - r || p.y0 > y + r || oben(p) < y - r) continue;
      if (abstandForm(p, x, y) < r) return p;
    }
    return null;
  }
  // ---------------------------------------------------------------------------
  // Zustand
  // ---------------------------------------------------------------------------
  // phase:   "bereit" (noch nichts getippt), "spiel", "zuschauen", "ende"
  // schritt: "start" (sie schwebt über dem Ring), "flug", "geplatzt"
  const state = {
    phase: "bereit",
    schritt: "start",
    punkte: 0,
    weiteste: 0,             // so weit war sie schon auf der Bahn (für die Punkte)
    tacho: 0,                // was die Nadel zeigt (km/h, gedämpft)
    t: 0,                    // die Spielzeit; sie läuft bei null los
    zeit: 0,                 // die Uhr des Bildes
    // Die Blase: Ort, Tempo, wie sie wabert (Richtung, Stärke, seit wann)
    // und der nächste Punkt der Mittellinie (i).
    blase: { x: 0, y: 0, vx: 0, vy: AUFTRIEB, ww: 0, wa: 0, wt: 9, i: 0 },
    stoesse: 0,              // so viele Luftstösse
    letzterStoss: null,      // { w: Richtung vom Finger, d: Abstand }
    // Die Bahn: Punkte der Mittellinie alle DS cm – Ort, Richtung, Krümmung,
    // halbe Breite und die Figur, zu der sie gehören. s = i × DS.
    bahn: { x: [], y: [], tx: [], ty: [], k: [], w: [], fig: [] },
    figuren: [],             // { nr, art, d, i0, i1, w, t0, besonders, wind, eng }
    beweger: [],             // was sich bewegt (nach s0 geordnet)
    raster: new Map(),       // jeder dritte Punkt der Bahn, nach Gitterfeld
    kasten: [],              // die Bahnen der Beweger: Dort darf keine spätere Figur hin
    kopf: { x: 0, y: 0, th: Math.PI / 2 },
    planFehler: 0,           // so oft blieb nur eine Gerade
    figur: -1,
    stimmung: 0,
    geplatzt: null,
    teile: [],
    stossBilder: [],
    schriften: [],
    ansage: null,
    cam: { x: 0, y: 0 },
    himmel: 0,               // wie weit der Abend ist (geglätteter Weg)
    intro: null,
    pilotBis: 0,
  };

  let shell = null;
  let feld = null;
  let canvas = null;
  let g = null;
  let frame = null;
  let last = 0;
  let voraus = 0;
  let stepTimer = null;
  let gegner = null;
  let zuschauer = null;
  let abend = null;
  let wind = null;
  let tippRinge = null;
  let ersterStart = true;
  let ebenen = null;

  // s: Bildpunkte je Einheit; (mx, my): wohin im Bild der Blickpunkt fällt;
  // camBild: der Blickpunkt des letzten Bildes (dorthin hat der Finger
  // gezielt).
  const view = { s: 1, dpr: 1, cssW: 0, cssH: 0, frei: 0, mx: 0, my: 0, camBild: { x: 0, y: 0 }, camY0: 0 };

  function clearStep() {
    if (stepTimer) { window.clearTimeout(stepTimer); stepTimer = null; }
  }

  function stopLoop() {
    if (frame) { window.cancelAnimationFrame(frame); frame = null; }
  }

  // ---------------------------------------------------------------------------
  // Klang
  // ---------------------------------------------------------------------------
  function klangAn() {
    abend = klang()?.kulisse("seifenblase.abend") || null;
    abend?.laut(0.4);
    wind = klang()?.kulisse("seifenblase.wind") || null;
    wind?.setze(0.15);
    wind?.laut(0.2);
  }

  // Die Grillen gehören in den Garten am Anfang; der Fahrtwind wird mit dem
  // Tempo lauter.
  function klangStellen() {
    const b = state.blase;
    abend?.laut(0.42 * (1 - glatt((b.i * DS - 300) / 1500)));
    const v = Math.max(0, tempoEntlang());
    wind?.setze(clamp(0.12 + v / 260, 0.12, 0.9));
    wind?.laut(clamp(0.14 + v / 520, 0.14, 0.55));
  }

  function klangAus() {
    abend?.stop();
    wind?.stop();
    abend = null;
    wind = null;
  }

  // ---------------------------------------------------------------------------
  // Die Bahn: Figur um Figur
  // ---------------------------------------------------------------------------
  /*
   * Eine Figur ist eine Folge von Zügen: ["L", l] geradeaus l cm, ["B", a, r]
   * ein Bogen um den Winkel a (positiv: nach links) mit dem Halbmesser r. Jede
   * beginnt nach oben und endet nach oben, am höchsten Punkt, den sie
   * erreicht – so führt eine Gerade nach oben immer ins Freie. d: 1 nach
   * rechts, −1 nach links.
   *
   *   gerade     nur hinauf – zum Rasen
   *   bogen      schräg hinüber und wieder hinauf
   *   quer       quer hinüber und wieder hinauf
   *   zickzack   schräg hin und her, drei Schläge
   *   schikane   quer hinüber, hinauf, quer zurück, hinauf – eng
   *   tauchgang  quer hinüber, HINUNTER (gegen den Auftrieb, von oben
   *              stossen), quer weiter, wieder hinauf
   *
   * Jeder achte Abschnitt ist besonders, im Wechsel: der 8., 24., 40. mit
   * Rückenwind (er trägt die Blase die Bahn entlang), der 16., 32., 48. eine
   * Gerade mit einer Böe quer über die Bahn – beide vorher angesagt.
   */
  function figurZuege(art, d, p) {
    const q = Math.PI / 2;
    const r = p.rho;
    if (art === "gerade") return [["L", p.a0]];
    if (art === "bogen") return [["L", p.a0], ["B", (-d * q) / 2, r], ["L", p.b], ["B", (d * q) / 2, r], ["L", p.c]];
    if (art === "quer") return [["L", p.a0], ["B", -d * q, r], ["L", p.b], ["B", d * q, r], ["L", p.c]];
    if (art === "zickzack") {
      return [["L", p.a0], ["B", (-d * q) / 2, r], ["L", p.b * 0.7], ["B", d * q, r], ["L", p.b * 0.7], ["B", -d * q, r], ["L", p.b * 0.7], ["B", (d * q) / 2, r], ["L", p.c]];
    }
    if (art === "schikane") {
      return [["L", p.a0], ["B", -d * q, p.rs], ["L", p.b * 0.6], ["B", d * q, p.rs], ["L", p.e], ["B", d * q, p.rs], ["L", p.b * 0.6], ["B", -d * q, p.rs], ["L", p.c]];
    }
    // Der Tauchgang.
    return [["L", p.a0], ["B", -d * q, r], ["L", p.b * 0.6], ["B", -d * q, r], ["L", p.tief], ["B", d * q, r], ["L", p.e], ["B", d * q, r], ["L", p.c]];
  }

  // Die Punkte einer Figur (ohne den ersten, der schon zur Bahn gehört):
  // [x, y, Richtung, Krümmung]; dazu die Geraden (für Vögel und Engstellen).
  function zuegePunkte(kopf, zuege) {
    let { x, y, th } = kopf;
    const pts = [];
    const geraden = [];
    zuege.forEach(([art, a, rho]) => {
      if (art === "L") {
        const n = Math.max(0, Math.round(a / DS));
        const cx = Math.cos(th) * DS;
        const cy = Math.sin(th) * DS;
        const j0 = pts.length;
        for (let i = 0; i < n; i += 1) { x += cx; y += cy; pts.push([x, y, th, 0]); }
        if (n > 0) geraden.push({ j0, j1: pts.length - 1, th });
        return;
      }
      const n = Math.max(1, Math.round((Math.abs(a) * rho) / DS));
      const dth = a / n;
      const l = 2 * rho * Math.sin(Math.abs(dth) / 2);
      for (let i = 0; i < n; i += 1) {
        const h = th + dth / 2;
        x += Math.cos(h) * l;
        y += Math.sin(h) * l;
        th += dth;
        pts.push([x, y, th, dth / l]);
      }
    });
    return { pts, geraden, kopf: { x, y, th } };
  }

  const rasterFeld = (x, y) => `${Math.floor(x / RASTER)},${Math.floor(y / RASTER)}`;
  function rasterRein(i) {
    const B = state.bahn;
    const key = rasterFeld(B.x[i], B.y[i]);
    const liste = state.raster.get(key);
    if (liste) liste.push(i); else state.raster.set(key, [i]);
  }
  // Die Punkte früherer Stücke um (x, y), so weit r reicht.
  function rasterUm(x, y, r, f) {
    const a = Math.floor((x - r) / RASTER);
    const b = Math.floor((x + r) / RASTER);
    const c = Math.floor((y - r) / RASTER);
    const d = Math.floor((y + r) / RASTER);
    for (let ix = a; ix <= b; ix += 1) {
      for (let iy = c; iy <= d; iy += 1) {
        const liste = state.raster.get(`${ix},${iy}`);
        if (!liste) continue;
        for (let j = 0; j < liste.length; j += 1) if (f(liste[j]) === false) return false;
      }
    }
    return true;
  }

  /*
   * Passt die Figur? Kein Punkt darf einem früheren Stück der Bahn (oder
   * sich selbst, weiter hinten) näher kommen als beide halben Breiten und
   * WAND dazu – ausser er liegt auf der Bahn ohnehin dicht dahinter. Und
   * keiner darf in die Bahn eines Bewegers.
   */
  function passt(pts, w, i0) {
    const B = state.bahn;
    for (let j = 0; j < pts.length; j += 3) {
      const [x, y] = pts[j];
      const sj = (i0 + 1 + j) * DS;
      const ok = rasterUm(x, y, w + W0 + WAND, (i) => {
        const wi = B.w[i];
        if (sj - i * DS < 2.5 * (w + wi) + 60) return true;
        return Math.hypot(B.x[i] - x, B.y[i] - y) >= w + wi + WAND ? true : false;
      });
      if (!ok) return false;
      for (let k = 0; k < j; k += 3) {
        if (sj - (i0 + 1 + k) * DS < 5 * w + 60) break;
        if (Math.hypot(pts[k][0] - x, pts[k][1] - y) < 2 * w + WAND) return false;
      }
      for (let k = 0; k < state.kasten.length; k += 1) {
        const q = state.kasten[k];
        if (x > q.x0 - w && x < q.x1 + w && y > q.y0 - w && y < q.y1 + w) return false;
      }
    }
    return true;
  }

  // Wie die nächste Figur aussieht: die Art nach Nummer und Härte, die
  // Masse aus der Saat. Immer gleich viele Zahlen ziehen, was auch geschieht.
  function naechsteFigur() {
    const n = state.figuren.length;
    const z = [];
    for (let i = 0; i < 24; i += 1) z.push(zufall.zahl());
    const nr = n + 1;
    const besonders = nr % 8 === 0 ? ((nr / 8) % 2 === 1 ? "rueckenwind" : "boee") : "";
    const B = state.bahn;
    const i0 = B.x.length - 1;
    const t0 = tRef(i0 * DS);
    const k = schwere(t0);
    const w = breiteBei(t0);
    const rho = Math.max(w + 12, rhoBei(t0) * (0.85 + 0.3 * z[2]));
    const lang = lerp(1.25, 0.8, k);
    const p = {
      rho,
      rs: Math.max(w + 10, rho * 0.78),
      a0: (24 + 40 * z[3]) * lang,
      b: (80 + 120 * z[4]) * lang,
      c: (36 + 50 * z[5]) * lang,
      tief: lerp(50, 150, k) * (0.75 + 0.5 * z[6]),
      e: 0,
    };
    let art;
    if (besonders === "rueckenwind") art = ["gerade", "bogen", "zickzack"][Math.floor(z[0] * 3)];
    else if (besonders === "boee") art = "gerade";
    else if (n === 0) art = "bogen";
    else if (n === 1) art = "quer";
    else if (n === 2) art = "gerade";
    else if (n === 3) art = "tauchgang";
    else if (n === 4) art = "zickzack";
    else {
      const gewichte = [
        ["gerade", lerp(1.0, 0.55, k)],
        ["bogen", 1],
        ["quer", 0.9],
        ["zickzack", lerp(0.35, 0.8, k)],
        ["schikane", lerp(0.25, 0.9, k)],
        ["tauchgang", lerp(0.4, 0.85, k)],
      ];
      let summe = 0;
      gewichte.forEach(([, gw]) => { summe += gw; });
      let r = z[0] * summe;
      art = gewichte[0][0];
      for (const [name, gw] of gewichte) {
        if (r < gw) { art = name; break; }
        r -= gw;
      }
    }
    if (art === "gerade") p.a0 = besonders === "boee" ? 300 : (170 + 150 * z[3]) * lang;
    if (n === 0) { p.a0 = 100; p.rho = Math.max(p.rho, 70); }
    if (n === 3) p.tief = 44;
    p.e = art === "schikane" ? Math.max(2 * w + WAND - 2 * p.rs + 8, 20 + 30 * z[7]) : Math.max(2 * w + WAND - 2 * rho + 10, 30 + 50 * z[7]);
    // Nach rechts oder links – weg vom Rand der Gegend, sonst nach der Saat.
    const kx = state.kopf.x;
    const d = kx > 180 ? -1 : kx < -180 ? 1 : z[1] < 0.5 ? -1 : 1;

    // Die Figur und ihre Ersatzfiguren, der Reihe nach: andersherum,
    // kleiner, ein Bogen – zuletzt eine Gerade hinauf, die immer passt.
    const versuche = [[art, d, p], [art, -d, p], [art, d, { ...p, b: p.b * 0.5, tief: p.tief * 0.5 }], ["bogen", d, p], ["bogen", -d, p]];
    if (besonders) versuche.splice(1);
    let gebaut = null;
    for (const [a, dd, pp] of versuche) {
      const f = figurPunkte(a, dd, pp);
      if (passt(f.pts, w, i0)) { gebaut = { ...f, art: a, d: dd }; break; }
    }
    if (!gebaut) {
      state.planFehler += besonders ? 0 : 1;
      const f = figurPunkte("gerade", d, { ...p, a0: 160 });
      gebaut = { ...f, art: besonders === "boee" ? "gerade" : "gerade", d };
    }

    // Die Punkte in die Bahn – die Breite geht weich von der letzten zur
    // neuen über.
    const wVor = B.w[i0] ?? W0;
    const fig = { nr: n, art: gebaut.art, d: gebaut.d, i0, i1: i0 + gebaut.pts.length, w, t0, besonders, wind: null, eng: null };
    gebaut.pts.forEach(([x, y, th, kr], j) => {
      B.x.push(x);
      B.y.push(y);
      B.tx.push(Math.cos(th));
      B.ty.push(Math.sin(th));
      B.k.push(kr);
      B.w.push(lerp(wVor, w, glatt((j + 1) / 25)));
      B.fig.push(n);
      const i = i0 + 1 + j;
      if (i % 3 === 0) rasterRein(i);
    });
    state.kopf = gebaut.kopf;
    state.figuren.push(fig);
    if (besonders === "rueckenwind") fig.wind = { art: "rueckenwind" };
    else if (besonders === "boee") fig.wind = { art: "boee", w: (z[8] < 0.5 ? 1 : -1) * (34 + 14 * k) };

    // Hindernisse – erst ab HINDERNIS_AB, nicht in besonderen Abschnitten.
    if (!besonders && t0 >= HINDERNIS_AB) {
      const geraden = gebaut.geraden.filter((q) => q.j1 - q.j0 >= 35);
      const senkrecht = geraden.filter((q) => Math.abs(Math.sin(q.th)) > 0.7);
      let vogelGerade = null;
      if (senkrecht.length && z[9] < 0.42 + 0.45 * k) {
        vogelGerade = senkrecht[Math.floor(z[10] * senkrecht.length)];
        const mitte = i0 + 1 + Math.round((vogelGerade.j0 + vogelGerade.j1) / 2);
        const mv = vogelBauen(fig, mitte, z, k);
        if (mv && phasenSuchen(mv, luftBei(tRef(mitte * DS)))) bewegerEinreihen(mv);
      }
      const rest = geraden.filter((q) => q !== vogelGerade);
      if (rest.length && z[11] < 0.25 + 0.4 * k) {
        const q = rest[Math.floor(z[12] * rest.length)];
        const ic = i0 + 1 + Math.round((q.j0 + q.j1) / 2);
        engstelle(fig, ic, k);
      }
    }
    return fig;
  }

  function figurPunkte(art, d, p) {
    const zuege = figurZuege(art, d, p);
    let f = zuegePunkte(state.kopf, zuege);
    // Am Ende am höchsten Punkt: sonst die letzte Gerade länger.
    let hoch = -Infinity;
    f.pts.forEach((q) => { hoch = Math.max(hoch, q[1]); });
    if (f.kopf.y < hoch + 10) {
      zuege[zuege.length - 1] = ["L", zuege[zuege.length - 1][1] + hoch + 10 - f.kopf.y];
      f = zuegePunkte(state.kopf, zuege);
    }
    return f;
  }

  // Eine Engstelle: Die Bahn wird für ein kurzes Stück schmal (weich hinein
  // und hinaus), die Blase hat dort nur noch knapp Luft.
  function engstelle(fig, ic, k) {
    const B = state.bahn;
    const schmal = Math.max(R + 7, fig.w * lerp(0.66, 0.56, k));
    for (let i = ic - 26; i <= ic + 26; i += 1) {
      if (i <= fig.i0 || i > fig.i1) continue;
      const f = glatt((26 - Math.abs(i - ic)) / 14);
      B.w[i] = Math.min(B.w[i], lerp(B.w[i], schmal, f));
    }
    fig.eng = { ic, w: schmal };
  }

  // Wo auf der Bahn die Figur zum Punkt i ist.
  function figurBei(i) {
    const L = state.figuren;
    let lo = 0;
    let hi = L.length - 1;
    if (hi < 0) return null;
    while (lo < hi) {
      const m = (lo + hi + 1) >> 1;
      if (L[m].i0 < i) lo = m; else hi = m - 1;
    }
    return L[lo];
  }

  // Die Bahn steht bis zum Weg s – je Aufruf höchstens «mal» Figuren,
  // damit kein Bild lange wartet.
  const bahnLaenge = () => Math.max(0, state.bahn.x.length - 1) * DS;
  function planBis(s, mal = 40) {
    for (let i = 0; i < mal && bahnLaenge() < s; i += 1) naechsteFigur();
  }

  function weltNeu() {
    state.bahn = { x: [0], y: [0], tx: [0], ty: [1], k: [0], w: [W0], fig: [0] };
    state.figuren = [];
    state.beweger = [];
    state.raster = new Map();
    state.kasten = [];
    state.kopf = { x: 0, y: 0, th: Math.PI / 2 };
    state.planFehler = 0;
    state.figur = -1;
    state.stimmung = 0;
    rasterRein(0);
    planBis(1600);
  }

  // Die Bahn als Text – für die Prüfung, dass in einem Turnier alle
  // dieselbe bekommen.
  function kursText(bis = 60) {
    planBis(sRef(bis) + 200, 400);
    const iB = Math.min(state.bahn.x.length - 1, Math.round(sRef(bis) / DS));
    const figuren = state.figuren.filter((f) => f.i0 < iB).map((f) => `${f.art}${f.d > 0 ? "+" : "-"}${f.w.toFixed(1)}${f.eng ? `e${f.eng.ic}` : ""}`);
    const flieger = state.beweger.filter((m) => m.i < iB).map((m) => `${m.art}${(m.ph ?? m.tc).toFixed(3)}`);
    const punkte = [];
    for (let i = 0; i <= iB; i += 50) punkte.push(`${state.bahn.x[i].toFixed(1)}/${state.bahn.y[i].toFixed(1)}`);
    return `${figuren.join(",")} | ${flieger.join(",")} | ${punkte.join(",")}`;
  }

  // ---------------------------------------------------------------------------
  // Wo die Blase auf der Bahn ist
  // ---------------------------------------------------------------------------
  /*
   * Der nächste Punkt der Mittellinie zu (x, y), gesucht in der Nähe von i0
   * (die Blase kommt nie weit), dann genau auf den Strecken davor und
   * danach: wie weit auf der Bahn (s), wie weit von der Mitte (d) und wie
   * breit die Bahn dort ist (w).
   */
  const nah = { i: 0, s: 0, d: 0, w: W0 };
  function naechster(x, y, i0) {
    const B = state.bahn;
    const N = B.x.length;
    let best = clamp(i0 | 0, 0, N - 1);
    let bd = (B.x[best] - x) ** 2 + (B.y[best] - y) ** 2;
    for (let runde = 0; runde < 60; runde += 1) {
      const a = Math.max(0, best - 8);
      const z = Math.min(N - 1, best + 8);
      let nb = best;
      let nd = bd;
      for (let i = a; i <= z; i += 1) {
        const d = (B.x[i] - x) ** 2 + (B.y[i] - y) ** 2;
        if (d < nd) { nd = d; nb = i; }
      }
      if (nb === best) break;
      best = nb;
      bd = nd;
    }
    let s = best * DS;
    let dMin = Math.sqrt(bd);
    let w = B.w[best];
    for (let j = Math.max(0, best - 1); j < Math.min(N - 1, best + 1); j += 1) {
      const dx = B.x[j + 1] - B.x[j];
      const dy = B.y[j + 1] - B.y[j];
      const l2 = dx * dx + dy * dy || 1;
      const u = clamp(((x - B.x[j]) * dx + (y - B.y[j]) * dy) / l2, 0, 1);
      const d = Math.hypot(B.x[j] + u * dx - x, B.y[j] + u * dy - y);
      if (d < dMin) { dMin = d; s = (j + u) * DS; w = lerp(B.w[j], B.w[j + 1], u); }
    }
    nah.i = best;
    nah.s = s;
    nah.d = dMin;
    nah.w = w;
    return nah;
  }

  // Wie weit auf der Bahn ein Ort ist, ohne zu wissen, wo man suchen soll
  // (für die Gegner): im Gitter, dann genau.
  function sVon(x, y) {
    const B = state.bahn;
    let best = -1;
    let bd = Infinity;
    rasterUm(x, y, RASTER, (i) => {
      const d = (B.x[i] - x) ** 2 + (B.y[i] - y) ** 2;
      if (d < bd) { bd = d; best = i; }
      return true;
    });
    if (best < 0) return null;
    return naechster(x, y, best).s;
  }

  // Die Luft, in der die Blase am Punkt i treibt: der Auftrieb, dazu
  // Rückenwind oder Böe. Sonst weht nichts.
  const luft = { x: 0, y: AUFTRIEB };
  function stroemung(i) {
    luft.x = 0;
    luft.y = AUFTRIEB;
    const f = figurBei(i);
    if (f?.wind) {
      const a = glatt((i - f.i0) / 20) * glatt((f.i1 - i) / 20);
      if (f.wind.art === "rueckenwind") {
        const B = state.bahn;
        luft.x += B.tx[i] * RUECKENWIND * a;
        luft.y += B.ty[i] * RUECKENWIND * a;
      } else luft.x += f.wind.w * a;
    }
    return luft;
  }

  // So schnell ist sie gerade die Bahn entlang (cm/s).
  function tempoEntlang() {
    const b = state.blase;
    const B = state.bahn;
    const i = clamp(b.i, 0, B.x.length - 1);
    return b.vx * (B.tx[i] ?? 0) + b.vy * (B.ty[i] ?? 1);
  }

  // ---------------------------------------------------------------------------
  // Was sich bewegt: Vögel und Wolkenfetzen
  // ---------------------------------------------------------------------------
  /*
   * Alles bewegt sich auf festen Bahnen, nach der Spielzeit: Schwalben und
   * Mauersegler ziehen flache Schleifen quer über die Bahn, Wolkenfetzen
   * treiben einmal quer hindurch. Sie kreuzen nur Stücke, die (fast)
   * senkrecht hinauf führen – so fliegen sie waagrecht. Wann genau,
   * entscheidet der Bau (phasenSuchen): so, dass sie weg sind, wenn die
   * Blase des Zeitplans kommt – auch wer luft zu früh oder zu spät ist.
   * Wer schneller ist als der Plan, muss sie selbst abpassen.
   */
  function bewegerOrt(m, t) {
    if (m.art === "wespe") {
      const a = m.w * t + m.ph;
      return { x: m.xc + m.A * Math.sin(a), y: m.yc + m.B * Math.sin(2 * a), dir: Math.cos(a) * m.sinn >= 0 ? 1 : -1, schlag: t * 34 };
    }
    if (m.art === "schwalbe" || m.art === "segler") {
      const a = m.w * t + m.ph;
      return { x: m.xc + m.A * Math.cos(a) * m.sinn, y: m.yc + m.B * Math.sin(a), dir: -Math.sin(a) * m.sinn >= 0 ? 1 : -1, schlag: t * m.schlagT + m.ph };
    }
    // Der Wolkenfetzen treibt quer.
    return { x: m.x0 + m.u * (t - m.tc), y: m.yc, dir: 1, schlag: 0 };
  }

  // Die Formen eines Bewegers, nach vorn (+x) gerichtet, um seine Mitte.
  function bewegerForm(m, o) {
    if (m.art === "wespe") {
      const f = Math.sin(o.schlag) * 0.7;
      return [
        kreis(3.5, 0.5, 1.25, "kopf"), kreis(1.25, 0.15, 1.55, "brust"),
        kreis(-1.4, -0.35, 1.95, "leib"), kreis(-3.5, -0.85, 1.4, "leib"),
        poly([[1.4, 1.1], [-0.6, 4.6 + f], [-3.4, 4.4 + f * 0.8], [-0.4, 1.0]], "fluegel"),
      ];
    }
    if (m.art === "schwalbe" || m.art === "segler") {
      const k = m.art === "segler" ? 1.12 : 1;
      const auf = Math.sin(o.schlag);
      const ty = (auf > 0 ? 8.6 * auf : 5.8 * auf) * k;
      const tx = (m.art === "segler" ? -7.5 : -6.2) * k;
      const form = [
        stab(-3.4 * k, 0, 3.2 * k, 0.35, 1.45 * k, "koerper"), kreis(4.2 * k, 0.7, 1.4 * k, "kopf"),
        poly([[1.8 * k, 0.8], [-0.4 * k, ty * 0.62 + 0.6], [tx, ty], [-2.1 * k, 0.5]], "fluegel"),
      ];
      if (m.art === "schwalbe") form.push(poly([[-3.2, 0.7], [-10.6, 2.8], [-8.0, 0.2], [-10.9, -2.1], [-3.2, -0.9]], "schwanz"));
      else form.push(poly([[-3.4 * k, 0.8], [-6.6 * k, 1.4], [-5.4 * k, 0.1], [-6.6 * k, -1.2], [-3.4 * k, -0.9]], "schwanz"));
      return form;
    }
    return m.puffs.map((p) => kreis(p[0], p[1], p[2], "fetzen"));
  }
  function bewegerTrifft(m, x, y, t, r) {
    const o = bewegerOrt(m, t);
    if (m.art === "fetzen" && Math.abs(o.x - m.xc) > m.A) return false;
    const lx = (x - o.x) * o.dir;
    const ly = y - o.y;
    if (Math.abs(lx) > m.gross + r || Math.abs(ly) > m.gross + r) return false;
    const prims = bewegerForm(m, o);
    for (let i = 0; i < prims.length; i += 1) if (abstandForm(prims[i], lx, ly) < r) return true;
    return false;
  }

  function bewegerEinreihen(m) {
    const liste = state.beweger;
    let i = liste.length;
    while (i > 0 && liste[i - 1].s0 > m.s0) i -= 1;
    liste.splice(i, 0, m);
    state.kasten.push({ x0: m.xc - m.A - m.gross, x1: m.xc + m.A + m.gross, y0: m.yc - m.B - m.gross, y1: m.yc + m.B + m.gross });
  }

  // Ein Vogel oder Wolkenfetzen über den Punkt ic der Bahn – nach der
  // Stimmung. Kreuzt seine Bahn ein anderes Stück, kommt keiner.
  function vogelBauen(fig, ic, z, k) {
    const B = state.bahn;
    const xc = B.x[ic];
    const yc = B.y[ic];
    const w = B.w[ic];
    const st = stimmungBei(ic * DS);
    let mv;
    if (st === 0 || (st === 3 && z[13] < 0.3)) {
      const periode = lerp(2.9, 2.2, k);
      mv = { art: "schwalbe", xc, yc, A: w + 30 + z[14] * 14, B: 5 + z[15] * 5, w: TAU / periode, ph: 0, sinn: z[16] < 0.5 ? 1 : -1, schlagT: 13, periode, gross: 12 };
    } else if (z[13] < 0.45) {
      const u = (z[16] < 0.5 ? 1 : -1) * (18 + 10 * z[14]);
      const puffs = [[0, 0, 7.5], [-8, -1.5, 5.5], [8.5, 0.5, 6], [3, 4.5, 5]];
      mv = { art: "fetzen", xc, yc, A: w + 34, B: 6, x0: xc, u, tc: tRef(ic * DS), puffs, periode: 6, gross: 16 };
    } else {
      const periode = lerp(2.2, 1.7, k);
      mv = { art: "segler", xc, yc, A: w + 34 + z[14] * 14, B: 4 + z[15] * 4, w: TAU / periode, ph: 0, sinn: z[16] < 0.5 ? 1 : -1, schlagT: 20, periode, gross: 12 };
    }
    mv.nr = fig.nr;
    mv.i = ic;
    // Die Punkte der Bahn, die er erreichen kann – alle aus dieser Figur.
    const x0 = xc - mv.A - mv.gross;
    const x1 = xc + mv.A + mv.gross;
    const y0 = yc - mv.B - mv.gross;
    const y1 = yc + mv.B + mv.gross;
    let fremd = false;
    rasterUm(xc, yc, mv.A + mv.gross + W0, (i) => {
      if (B.x[i] + B.w[i] < x0 || B.x[i] - B.w[i] > x1 || B.y[i] + B.w[i] < y0 || B.y[i] - B.w[i] > y1) return true;
      if (B.fig[i] !== fig.nr) { fremd = true; return false; }
      return true;
    });
    if (fremd) return null;
    mv.punkte = [];
    for (let i = fig.i0; i <= fig.i1; i += 2) {
      if (B.x[i] + B.w[i] < x0 || B.x[i] - B.w[i] > x1 || B.y[i] + B.w[i] < y0 || B.y[i] - B.w[i] > y1) continue;
      mv.punkte.push(i);
    }
    if (!mv.punkte.length) return null;
    mv.s0 = mv.punkte[0] * DS - 30;
    mv.s1 = mv.punkte[mv.punkte.length - 1] * DS + 30;
    return mv;
  }

  /*
   * Die Phase eines Bewegers so wählen, dass er die Bahn frei lässt, wenn
   * die Blase des Zeitplans kommt – zu früh oder zu spät bis luft, quer
   * über die ganze Breite. Zwölf Phasen werden der Reihe nach versucht.
   */
  function phasenSuchen(mv, e) {
    for (let i = 0; i < 12; i += 1) {
      const f = ((i * 5) % 12) / 12;
      if (mv.art === "fetzen") mv.tc = tRef(mv.i * DS) + (f - 0.5) * 2 * 2.6 + (f < 0.5 ? -1.4 : 1.4);
      else mv.ph = f * TAU;
      if (bewegerFrei(mv, e)) return true;
    }
    return false;
  }

  function bewegerFrei(mv, e) {
    const B = state.bahn;
    for (let j = 0; j < mv.punkte.length; j += 1) {
      const i = mv.punkte[j];
      const x = B.x[i];
      const y = B.y[i];
      const nx = -B.ty[i];
      const ny = B.tx[i];
      const w = B.w[i] - R + 1;
      const t = tRef(i * DS);
      const n = Math.max(1, Math.ceil((2 * w) / 4));
      for (let q = 0; q <= 4; q += 1) {
        const tt = t + (q / 2 - 1) * e;
        for (let l = 0; l <= n; l += 1) {
          const o = -w + (2 * w * l) / n;
          if (bewegerTrifft(mv, x + nx * o, y + ny * o, tt, RH + 0.3)) return false;
        }
      }
    }
    return true;
  }

  // Was die Blase an (x, y) zur Zeit t trifft – der Rand (aus naechster:
  // d und w), der Tisch, was sich bewegt. null heisst: nichts.
  function trifft(x, y, t, r = RH, n = null) {
    const q = n || naechster(x, y, state.blase.i);
    if (q.d > q.w - r) return { art: "rand" };
    // Unten beim Start: der Gartentisch.
    if (y - r < -35 && Math.abs(x) < 38 && y > -45) return { art: "tisch" };
    const s = q.s;
    const L = state.beweger;
    for (let i = 0; i < L.length; i += 1) {
      const m = L[i];
      if (m.s0 > s + 40) break;
      if (m.s1 < s - 40) continue;
      if (bewegerTrifft(m, x, y, t, r)) return { art: m.art, m };
    }
    return null;
  }

  // ---------------------------------------------------------------------------
  // Die Fläche
  // ---------------------------------------------------------------------------
  function buildPlatz() {
    const platz = shell.el("div", "sb-platz");
    feld = shell.el("div", "sb-feld");
    canvas = document.createElement("canvas");
    canvas.className = "sb-canvas";
    canvas.setAttribute("aria-hidden", "true");
    feld.append(canvas);
    g = canvas.getContext("2d");

    // Der Hinweis vor dem ersten Tipp: zwei Ringe unter der Blase – von dort
    // bläst ein Tipp sie hinauf.
    const tipp = shell.el("span", "sb-tipp");
    tipp.setAttribute("aria-hidden", "true");
    const ns = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(ns, "svg");
    svg.setAttribute("viewBox", "0 0 64 64");
    ["sb-tipp-ring", "sb-tipp-ring is-spaet"].forEach((klasse) => {
      const k = document.createElementNS(ns, "circle");
      k.setAttribute("class", klasse);
      k.setAttribute("cx", "32");
      k.setAttribute("cy", "32");
      k.setAttribute("r", "14");
      k.setAttribute("fill", "none");
      k.setAttribute("stroke", "#ffffff");
      k.setAttribute("stroke-width", "4");
      svg.append(k);
    });
    const punkt = document.createElementNS(ns, "circle");
    punkt.setAttribute("cx", "32");
    punkt.setAttribute("cy", "32");
    punkt.setAttribute("r", "8");
    punkt.setAttribute("fill", "#ffffff");
    svg.append(punkt);
    tipp.append(svg);
    tippRinge = tipp;
    feld.append(tipp);
    platz.append(feld);
    return platz;
  }
  /*
   * Der Massstab: Um den Blickpunkt sieht man auf jedem Gerät gleich weit,
   * SICHT in jede Richtung – hochkant gibt die Breite das Mass vor, quer die
   * Höhe. Was weiter weg ist, verschwindet im Dunst (sichtbar). Der
   * Blickpunkt fällt in die Mitte der freien Fläche unter der Leiste.
   */
  function messen() {
    if (!canvas || !feld) return;
    const cssW = Math.max(80, feld.clientWidth);
    const cssH = Math.max(80, feld.clientHeight);
    const dpr = shellApi.bildpunkte(cssW, cssH, 2);
    const frei = Math.min(cssH * 0.3, shell?.frei?.(canvas) || 0);
    if (cssW === view.cssW && cssH === view.cssH && dpr === view.dpr && frei === view.frei) return;
    view.cssW = cssW;
    view.cssH = cssH;
    view.dpr = dpr;
    view.frei = frei;
    view.s = Math.min(cssW, cssH - frei - 8) / (2 * SICHT);
    view.mx = cssW / 2;
    view.my = frei + (cssH - frei) / 2;
    const pw = Math.round(cssW * dpr);
    const ph = Math.round(cssH * dpr);
    if (canvas.width !== pw) canvas.width = pw;
    if (canvas.height !== ph) canvas.height = ph;
    ebenenNeu();
    ringeStellen();
    // Steht die Schleife (auf der Tafel nach dem Platzen), malt niemand
    // nach – also hier, sonst bliebe die Leinwand nach dem Drehen leer.
    if (!frame) zeichnen();
  }

  const bildX = (x) => view.mx + (x - state.cam.x) * view.s;
  const bildY = (y) => view.my - (y - state.cam.y) * view.s;

  // Der Hinweis vor dem ersten Tipp: die Ringe unter der Blase.
  function ringeStellen() {
    if (!tippRinge) return;
    tippRinge.style.left = `${Math.round(bildX(state.blase.x))}px`;
    tippRinge.style.top = `${Math.round(bildY(state.blase.y) + 24 * view.s)}px`;
  }

  /*
   * Wohin die Kamera schaut: vor die Blase, in die Richtung, in die die Bahn
   * auf dem nächsten Meter führt – so sieht man die nächste Kurve früh. Vor
   * dem Start etwas über sie, damit der Tisch im Bild ist.
   */
  function blickZiel() {
    const b = state.blase;
    const B = state.bahn;
    if (state.phase === "bereit" || B.x.length < 2) return { x: b.x, y: b.y + SICHT * 0.3 };
    const i0 = clamp(b.i, 0, B.x.length - 1);
    const i1 = Math.min(B.x.length - 1, i0 + 45);
    const ux = B.x[i1] - B.x[i0];
    const uy = B.y[i1] - B.y[i0];
    const l = Math.hypot(ux, uy) || 1;
    return { x: b.x + (ux / l) * SICHT * SICHT_VOR, y: b.y + (uy / l) * SICHT * SICHT_VOR };
  }

  // Wie sichtbar etwas im Abstand d vom Blickpunkt ist: ganz bis gut zur
  // Sicht, dann verschwindet es im Dunst.
  const sichtbar = (d) => 1 - glatt((d - SICHT * 1.1) / (SICHT * 0.3));

  // ---------------------------------------------------------------------------
  // Malen: die Farben des Abends
  // ---------------------------------------------------------------------------
  // Das Licht kommt tief von links (die Sonne steht über dem Horizont):
  // warm auf allem, was nach links schaut, violett im Schatten.
  const LICHT = [255, 196, 128];
  const SCHATTEN = [74, 52, 96];

  // Kleine Scheine, einmal gemalt: Licht, Glanz, Glühwürmchen, Bokeh.
  const SCHEINE = {
    warm: [[255, 214, 150], 1, 0.8],
    gold: [[255, 186, 90], 1, 0.8],
    weiss: [[255, 255, 255], 1, 0.8],
    kalt: [[190, 226, 255], 1, 0.8],
    gruen: [[214, 255, 140], 1, 0.8],
    rosa: [[255, 170, 200], 0.9, 0.8],
    nebel: [[236, 230, 250], 0.7, 0.8],
  };
  function scheinAus(farbe, kraft, r) {
    const c = document.createElement("canvas");
    const n = Math.max(8, Math.round(r * 2 * view.dpr));
    c.width = n;
    c.height = n;
    const k = c.getContext("2d");
    const v = k.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2);
    v.addColorStop(0, rgba(farbe, kraft));
    v.addColorStop(0.25, rgba(farbe, kraft * 0.5));
    v.addColorStop(1, rgba(farbe, 0));
    k.fillStyle = v;
    k.fillRect(0, 0, n, n);
    return c;
  }
  // r in CSS-Pixeln.
  function schein(name, x, y, r, alpha = 1) {
    const bild = ebenen?.scheine?.[name];
    if (!bild || alpha <= 0.01) return;
    g.globalAlpha = Math.min(1, alpha);
    g.drawImage(bild, x - r, y - r, 2 * r, 2 * r);
    g.globalAlpha = 1;
  }

  // Eine leere Leinwand von w × h CSS-Pixeln (in Bildpunkten).
  function leinwand(w, h) {
    const c = document.createElement("canvas");
    c.width = Math.max(2, Math.round(w * view.dpr));
    c.height = Math.max(2, Math.round(h * view.dpr));
    return c;
  }
  // ---------------------------------------------------------------------------
  // Malen: der Himmel – ein hohes Bild, das mit dem Weg hinabgleitet
  // ---------------------------------------------------------------------------
  /*
   * Der ganze Abendhimmel der Reise steht in einem einzigen hohen Bild: unten
   * die Sonne über den Alpen, goldene und rosa Wolkenbänke, darüber Flieder
   * und Violett, ganz oben die Nacht mit Mond und Sternen. Mit dem Weg auf
   * der Bahn gleitet es langsam hinab – der Abend schreitet voran, auch wenn
   * die Bahn einmal hinunter führt. Die Ferne (Hügel, das Dorf) sinkt, wenn
   * die Blase steigt.
   */
  const HIMMEL_HOCH = 7000;
  const PH = 0.055;

  function maleHimmel(k, W, Ht, H) {
    // Die Farben von unten (0) nach oben, in Bildhöhen über dem unteren Rand.
    const stufen = [
      [0, [255, 212, 150]], [0.3, [252, 178, 138]], [0.75, [228, 142, 156]], [1.15, [176, 124, 178]],
      [1.5, [118, 98, 170]], [1.9, [64, 62, 136]], [2.4, [34, 36, 96]], [3, [18, 20, 60]],
    ];
    const v = k.createLinearGradient(0, Ht, 0, 0);
    stufen.forEach(([u, c]) => v.addColorStop(clamp((u * H) / Ht, 0, 1), rgb(c)));
    k.fillStyle = v;
    k.fillRect(0, 0, W, Ht);
    const rnd = wuerfel(4711);
    // Die Sonne tief links, mit grossem warmem Hof.
    const sx = W * 0.24;
    const sy = Ht - H * 0.3;
    const sr = Math.max(18, Math.min(W, H) * 0.06);
    k.globalCompositeOperation = "lighter";
    [[sr * 14, [255, 150, 80], 0.32], [sr * 6, [255, 190, 110], 0.4], [sr * 2.4, [255, 230, 170], 0.6]].forEach(([r, c, a]) => {
      const h = k.createRadialGradient(sx, sy, 0, sx, sy, r);
      h.addColorStop(0, rgba(c, a));
      h.addColorStop(1, rgba(c, 0));
      k.fillStyle = h;
      k.fillRect(sx - r, sy - r, 2 * r, 2 * r);
    });
    k.globalCompositeOperation = "source-over";
    k.fillStyle = "rgb(255, 246, 220)";
    k.beginPath();
    k.arc(sx, sy, sr, 0, TAU);
    k.fill();
    // Strahlen, die die Sonne durch den Dunst wirft.
    k.globalCompositeOperation = "lighter";
    // Jeder Strahl aus drei Keilen ineinander: so hat er weiche Ränder.
    for (let i = 0; i < 9; i += 1) {
      const w = -Math.PI / 2 + (rnd() - 0.5) * 2.4;
      const l = H * (0.7 + rnd() * 0.6);
      const b = 0.03 + rnd() * 0.05;
      const gr = k.createLinearGradient(sx, sy, sx + Math.cos(w) * l, sy + Math.sin(w) * l);
      gr.addColorStop(0, "rgba(255, 220, 160, 0.07)");
      gr.addColorStop(0.6, "rgba(255, 220, 160, 0.03)");
      gr.addColorStop(1, "rgba(255, 220, 160, 0)");
      k.fillStyle = gr;
      [1, 0.62, 0.3].forEach((f) => {
        k.beginPath();
        k.moveTo(sx, sy);
        k.lineTo(sx + Math.cos(w - b * f) * l, sy + Math.sin(w - b * f) * l);
        k.lineTo(sx + Math.cos(w + b * f) * l, sy + Math.sin(w + b * f) * l);
        k.closePath();
        k.fill();
      });
    }
    k.globalCompositeOperation = "source-over";
    // Wolkenbänke: unten golden von unten angestrahlt, oben flieder.
    for (let i = 0; i < 16; i += 1) {
      const u = 0.12 + Math.pow(rnd(), 1.25) * 2.4;
      const cy = Ht - u * H;
      const cx = rnd() * W;
      const breit = W * (0.25 + rnd() * 0.5);
      const hoch = H * (0.012 + rnd() * 0.025);
      const warm = clamp(1 - u / 1.6, 0, 1);
      for (let j = 0; j < 7; j += 1) {
        const ex = cx + (rnd() - 0.5) * breit;
        const ey = cy + (rnd() - 0.5) * hoch * 2;
        const rx = breit * (0.12 + rnd() * 0.18);
        const ry = hoch * (0.8 + rnd());
        const c1 = mix3([150, 110, 170], [255, 170, 130], warm);
        const c2 = mix3([200, 150, 200], [255, 214, 160], warm);
        k.save();
        k.translate(ex, ey);
        k.scale(rx / ry, 1);
        const h = k.createRadialGradient(0, ry * 0.35, 0, 0, 0, ry);
        h.addColorStop(0, rgba(c2, 0.55));
        h.addColorStop(0.6, rgba(c1, 0.35));
        h.addColorStop(1, rgba(c1, 0));
        k.fillStyle = h;
        k.beginPath();
        k.arc(0, 0, ry, 0, TAU);
        k.fill();
        k.restore();
      }
    }
    // Die Alpen am Horizont: ein Kamm in Blauviolett, die Gipfel rosa.
    const fuss = Ht - H * 0.18;
    k.beginPath();
    k.moveTo(0, Ht);
    let gx = 0;
    const kamm = [];
    while (gx <= W + 20) {
      const h = H * (0.05 + 0.13 * Math.pow(Math.abs(Math.sin(gx * 0.011 + 1.3) * Math.sin(gx * 0.0047 + 0.4)), 0.8) + 0.025 * rnd());
      kamm.push([gx, fuss - h]);
      k.lineTo(gx, fuss - h);
      gx += 6 + rnd() * 12;
    }
    k.lineTo(W, Ht);
    k.closePath();
    const bg = k.createLinearGradient(0, fuss - H * 0.2, 0, fuss);
    bg.addColorStop(0, "rgb(150, 120, 176)");
    bg.addColorStop(1, "rgb(196, 150, 176)");
    k.fillStyle = bg;
    k.fill();
    k.fillStyle = "rgba(255, 196, 196, 0.55)";
    for (let i = 1; i < kamm.length - 1; i += 1) {
      const [x, y] = kamm[i];
      if (y < kamm[i - 1][1] && y < kamm[i + 1][1] && fuss - y > H * 0.1) {
        k.beginPath();
        k.moveTo(x, y);
        k.lineTo(x - (fuss - y) * 0.22, y + (fuss - y) * 0.3);
        k.lineTo(x + (fuss - y) * 0.06, y + (fuss - y) * 0.22);
        k.closePath();
        k.fill();
      }
    }
    // Dunst über dem Horizont.
    const d = k.createLinearGradient(0, fuss - H * 0.1, 0, Ht);
    d.addColorStop(0, "rgba(255, 210, 170, 0)");
    d.addColorStop(1, "rgba(255, 210, 170, 0.6)");
    k.fillStyle = d;
    k.fillRect(0, fuss - H * 0.1, W, Ht - fuss + H * 0.1);
    // Sterne: je höher, desto mehr.
    for (let i = 0; i < 260; i += 1) {
      const u = 1.15 + rnd() * (Ht / H - 1.15);
      const y = Ht - u * H;
      if (y < 0) continue;
      const a = clamp((u - 1.15) / 0.8, 0, 1) * (0.35 + 0.65 * rnd());
      k.fillStyle = `rgba(255, 250, 235, ${a})`;
      const r = 0.6 + rnd() * rnd() * 1.6;
      k.fillRect(rnd() * W, y, r * view.dpr * 0.6, r * view.dpr * 0.6);
    }
    // Die Mondsichel.
    const mx = W * 0.76;
    const my = Ht - Math.min(Ht / H - 0.3, 1.75) * H;
    const mr = Math.max(10, Math.min(W, H) * 0.035);
    const hof = k.createRadialGradient(mx, my, 0, mx, my, mr * 5);
    hof.addColorStop(0, "rgba(220, 220, 255, 0.25)");
    hof.addColorStop(1, "rgba(220, 220, 255, 0)");
    k.fillStyle = hof;
    k.fillRect(mx - mr * 5, my - mr * 5, mr * 10, mr * 10);
    // Die Sichel in einem eigenen kleinen Bild: Scheibe, davon der Schatten
    // weggenommen – so bleibt der Himmel hinter ihr, wie er ist.
    const sichel = document.createElement("canvas");
    sichel.width = Math.ceil(mr * 2 + 4);
    sichel.height = sichel.width;
    const q = sichel.getContext("2d");
    const m = sichel.width / 2;
    q.fillStyle = "rgb(250, 244, 222)";
    q.beginPath();
    q.arc(m, m, mr, 0, TAU);
    q.fill();
    q.globalCompositeOperation = "destination-out";
    q.beginPath();
    q.arc(m + mr * 0.45, m - mr * 0.2, mr * 0.92, 0, TAU);
    q.fill();
    k.drawImage(sichel, mx - m, my - m);
  }

  // Die Ferne: Hügel und das Dorf im Tal, hinter dem Garten.
  function maleFerne(k, W, H) {
    const rnd = wuerfel(99);
    const s = view.dpr;
    // Das Bild reicht bis an den unteren Rand; Hügel und Dorf stehen im
    // oberen Teil (O), darunter das Tal.
    const O = H * 0.75;
    // Zwei Hügelzüge im Dunst.
    [[0.35, [176, 132, 170], 0.9], [0.55, [140, 104, 150], 1]].forEach(([hh, c, a], j) => {
      k.fillStyle = rgba(c, a);
      k.beginPath();
      k.moveTo(0, H);
      for (let x = 0; x <= W + 8; x += 8) k.lineTo(x, O * (1 - hh) + Math.sin(x * 0.006 + j * 2) * O * 0.05 + Math.sin(x * 0.017 + j) * O * 0.02);
      k.lineTo(W, H);
      k.closePath();
      k.fill();
    });
    // Das Dorf: Häuser mit Giebeln, warme Fenster, die Kirche.
    const basis = O * 0.72;
    let x = -10;
    while (x < W + 10) {
      const b = (18 + rnd() * 22) * s;
      const h = (12 + rnd() * 16) * s;
      const dachH = h * (0.5 + rnd() * 0.4);
      const y = basis + (rnd() - 0.5) * 10 * s;
      k.fillStyle = rgb(mix3([92, 60, 98], [120, 70, 90], rnd()));
      k.fillRect(x, y - h, b, h + H);
      k.fillStyle = rgb(mix3([116, 56, 70], [140, 72, 72], rnd()));
      k.beginPath();
      k.moveTo(x - 2 * s, y - h);
      k.lineTo(x + b / 2, y - h - dachH);
      k.lineTo(x + b + 2 * s, y - h);
      k.closePath();
      k.fill();
      // Licht am Giebel von links.
      k.strokeStyle = "rgba(255, 190, 130, 0.5)";
      k.lineWidth = 1 * s;
      k.beginPath();
      k.moveTo(x - 2 * s, y - h);
      k.lineTo(x + b / 2, y - h - dachH);
      k.stroke();
      for (let i = 0; i < 3; i += 1) {
        if (rnd() < 0.45) {
          k.fillStyle = `rgba(255, ${200 + rnd() * 40}, 120, 0.9)`;
          k.fillRect(x + b * (0.2 + i * 0.25), y - h * (0.35 + rnd() * 0.3), 2.2 * s, 2.6 * s);
        }
      }
      if (rnd() < 0.12) {
        // Die Kirche mit dem Wetterhahn.
        const tb = 9 * s;
        const tx = x + b + 6 * s;
        const th = 46 * s;
        k.fillStyle = "rgb(96, 64, 102)";
        k.fillRect(tx, y - th, tb, th + H);
        k.fillStyle = "rgb(70, 92, 100)";
        k.beginPath();
        k.moveTo(tx - 2 * s, y - th);
        k.lineTo(tx + tb / 2, y - th - 26 * s);
        k.lineTo(tx + tb + 2 * s, y - th);
        k.closePath();
        k.fill();
        k.fillStyle = "rgb(230, 180, 90)";
        k.fillRect(tx + tb / 2 - 0.5 * s, y - th - 33 * s, 1 * s, 7 * s);
        k.beginPath();
        k.moveTo(tx + tb / 2 - 2.5 * s, y - th - 33 * s);
        k.lineTo(tx + tb / 2 + 3 * s, y - th - 34.5 * s);
        k.lineTo(tx + tb / 2 + 1.5 * s, y - th - 31 * s);
        k.closePath();
        k.fill();
        x += 14 * s;
      }
      x += b + (2 + rnd() * 8) * s;
    }
    // Das Tal unter dem Dorf: Wiesen und Hecken im Abenddunst.
    const tal = k.createLinearGradient(0, basis, 0, H);
    tal.addColorStop(0, "rgb(126, 96, 116)");
    tal.addColorStop(1, "rgb(96, 82, 104)");
    k.fillStyle = tal;
    k.fillRect(0, basis + 4 * s, W, H - basis);
    // Wiesenstreifen und Hecken im Tal.
    for (let i = 0; i < 7; i += 1) {
      const y = basis + 10 * s + (i / 7) * (H - basis);
      k.fillStyle = rgba(i % 2 ? [150, 116, 120] : [116, 96, 116], 0.6);
      k.beginPath();
      k.moveTo(0, y);
      for (let x = 0; x <= W + 10; x += 10) k.lineTo(x, y + Math.sin(x * 0.01 + i * 1.7) * 6 * s);
      k.lineTo(W, y + 30 * s);
      k.lineTo(0, y + 30 * s);
      k.closePath();
      k.fill();
    }
    // Dunst über dem Dorf.
    const d = k.createLinearGradient(0, O * 0.3, 0, H);
    d.addColorStop(0, "rgba(255, 200, 170, 0)");
    d.addColorStop(1, "rgba(255, 190, 160, 0.3)");
    k.fillStyle = d;
    k.fillRect(0, O * 0.3, W, H - O * 0.3);
  }
  // ---------------------------------------------------------------------------
  // Malen: der Boden beim Start – Rasen, Tisch, Schale und Ring
  // ---------------------------------------------------------------------------
  const BODEN_UNTEN = -150;
  const BODEN_OBEN = 10;
  const BODEN_HALB = 70;           // so breit (je Seite) ist sein Bild – der Rasen geht weiter
  const RING = { x: 0, y: -15, r: 5.6 };

  function maleBoden(k, W) {
    const s = view.s * view.dpr;
    const X = (x) => W / 2 + x * s;
    const Y = (y) => (BODEN_OBEN - y) * s;
    const rnd = wuerfel(2024);
    // Der Rasen.
    const rasenY = -118;
    const gr = k.createLinearGradient(0, Y(rasenY + 6), 0, Y(BODEN_UNTEN));
    gr.addColorStop(0, "rgb(120, 150, 62)");
    gr.addColorStop(0.3, "rgb(78, 110, 50)");
    gr.addColorStop(1, "rgb(40, 62, 38)");
    k.fillStyle = gr;
    k.fillRect(0, Y(rasenY + 2), W, Y(BODEN_UNTEN) - Y(rasenY + 2));
    k.lineCap = "round";
    for (let i = 0; i < W / (s * 0.9); i += 1) {
      const x = rnd() * W;
      const h = (3 + rnd() * 6) * s;
      const y = Y(rasenY + 2) + rnd() * s * 6;
      k.strokeStyle = rgb(mix3([70, 110, 44], [190, 200, 90], rnd() * rnd()));
      k.lineWidth = s * 0.35;
      k.beginPath();
      k.moveTo(x, y);
      k.quadraticCurveTo(x + (rnd() - 0.5) * s * 3, y - h * 0.6, x + (rnd() - 0.3) * s * 3, y - h);
      k.stroke();
    }
    // Ein Blumenbeet: Lavendel und Ringelblumen.
    for (let i = 0; i < 40; i += 1) {
      const x = (rnd() - 0.5) * 2 * (W / 2 / s);
      if (Math.abs(x) < 40) continue;
      const lav = rnd() < 0.55;
      const h = 10 + rnd() * 16;
      k.strokeStyle = "rgb(80, 110, 60)";
      k.lineWidth = s * 0.4;
      k.beginPath();
      k.moveTo(X(x), Y(rasenY));
      k.lineTo(X(x + (rnd() - 0.5) * 3), Y(rasenY + h));
      k.stroke();
      if (lav) {
        k.fillStyle = rgb(mix3([140, 110, 200], [176, 140, 230], rnd()));
        for (let j = 0; j < 5; j += 1) { k.beginPath(); k.arc(X(x), Y(rasenY + h - j * 1.3), s * 0.9, 0, TAU); k.fill(); }
      } else {
        k.fillStyle = rgb(mix3([255, 150, 40], [255, 200, 60], rnd()));
        k.beginPath();
        k.arc(X(x), Y(rasenY + h), s * 2.2, 0, TAU);
        k.fill();
        k.fillStyle = "rgb(150, 70, 20)";
        k.beginPath();
        k.arc(X(x), Y(rasenY + h), s * 0.8, 0, TAU);
        k.fill();
      }
    }
    // Der Gartentisch aus Holz.
    const holz = (x0, y0, x1, y1, c) => {
      k.fillStyle = c;
      k.fillRect(X(x0), Y(y1), (x1 - x0) * s, (y1 - y0) * s);
    };
    holz(-30, -118, -26.5, -38, "rgb(108, 70, 50)");
    holz(26.5, -118, 30, -38, "rgb(90, 58, 46)");
    holz(-30, -110, 30, -107, "rgb(84, 54, 44)");
    holz(-38, -40, 38, -35, "rgb(150, 98, 62)");
    k.fillStyle = "rgba(255, 200, 140, 0.55)";
    k.fillRect(X(-38), Y(-35), 76 * s, 1 * s);
    for (let x = -36; x < 38; x += 9) {
      k.fillStyle = "rgba(70, 40, 30, 0.45)";
      k.fillRect(X(x), Y(-35), 0.4 * s, 5 * s);
    }
    // Schatten unter dem Tisch.
    k.fillStyle = "rgba(30, 30, 40, 0.3)";
    k.beginPath();
    k.ellipse(X(4), Y(-119), 40 * s, 3 * s, 0, 0, TAU);
    k.fill();
    // Die Schale mit Seifenwasser.
    k.fillStyle = "rgb(70, 120, 170)";
    k.beginPath();
    k.moveTo(X(-12), Y(-25));
    k.quadraticCurveTo(X(-11), Y(-35), X(0), Y(-35));
    k.quadraticCurveTo(X(11), Y(-35), X(12), Y(-25));
    k.closePath();
    k.fill();
    k.fillStyle = "rgba(255, 220, 170, 0.5)";
    k.beginPath();
    k.ellipse(X(-6), Y(-29), 2.2 * s, 3.6 * s, 0.5, 0, TAU);
    k.fill();
    k.fillStyle = "rgb(220, 236, 250)";
    k.beginPath();
    k.ellipse(X(0), Y(-25), 12 * s, 1.6 * s, 0, 0, TAU);
    k.fill();
    // Schaum, mit kleinen Bläschen.
    for (let i = 0; i < 14; i += 1) {
      const x = (rnd() - 0.5) * 20;
      const r = 0.6 + rnd() * 1.4;
      k.strokeStyle = "rgba(255, 255, 255, 0.85)";
      k.lineWidth = s * 0.2;
      k.beginPath();
      k.arc(X(x), Y(-24.4 + r * 0.6), r * s, 0, TAU);
      k.stroke();
    }
    // Der Stiel des Rings, schräg in die Schale.
    k.strokeStyle = "rgb(52, 138, 200)";
    k.lineWidth = s * 1.5;
    k.beginPath();
    k.moveTo(X(RING.x + 0.3), Y(RING.y - RING.r * 0.3));
    k.quadraticCurveTo(X(2.5), Y(-22), X(7.5), Y(-27.5));
    k.stroke();
  }

  // Der Ring (vor der Blase gemalt, damit sie aus ihm wächst).
  function zeichneRing() {
    const s = view.s;
    const x = bildX(RING.x);
    const y = bildY(RING.y);
    if (y > view.cssH + 40 || y < -40) return;
    g.lineWidth = s * 1.2;
    g.strokeStyle = "rgb(60, 150, 210)";
    g.beginPath();
    g.ellipse(x, y, RING.r * s, RING.r * s * 0.32, 0, 0, TAU);
    g.stroke();
    g.strokeStyle = "rgba(255, 230, 200, 0.6)";
    g.lineWidth = s * 0.4;
    g.beginPath();
    g.ellipse(x, y, RING.r * s, RING.r * s * 0.32, 0, Math.PI * 1.05, Math.PI * 1.6);
    g.stroke();
  }
  // ---------------------------------------------------------------------------
  // Malen: die Blase – vorgerechnet
  // ---------------------------------------------------------------------------
  /*
   * Der Seifenfilm: ein Bild, dreimal so breit wie die Blase, in den Farben
   * dünner Schichten – für jede Dicke die Farbe, die das Licht dort zeigt
   * (Rot, Grün und Blau löschen sich bei verschiedenen Dicken aus). Oben ist
   * der Film dünner (er läuft ab), dazu Wirbel. Je Bild wird er in die Blase
   * gedreht und verschoben, durch eine Maske, die zum Rand hin mehr spiegelt
   * – so wandern die Regenbogenfarben, ohne je neu gerechnet zu werden.
   */
  function filmBild(n) {
    const c = document.createElement("canvas");
    c.width = n;
    c.height = n;
    const k = c.getContext("2d");
    const bild = k.createImageData(n, n);
    const d = bild.data;
    const lam = [640, 532, 455];
    for (let j = 0; j < n; j += 1) {
      for (let i = 0; i < n; i += 1) {
        const u = (i / n) * 3 - 1.5;
        const v = (j / n) * 3 - 1.5;
        const wirbel = Math.sin(3.1 * u + 1.7 * Math.sin(2.3 * v + 0.4)) + Math.sin(2.6 * v + 1.4 * Math.sin(3.4 * u + 1.1)) * 0.8 + Math.sin(5.3 * (u + v) + 0.7) * 0.25;
        const dicke = 420 + 230 * v + 150 * wirbel;
        const o = (j * n + i) * 4;
        for (let q = 0; q < 3; q += 1) {
          const sn = Math.sin((TAU * 1.33 * Math.max(60, dicke)) / lam[q]);
          d[o + q] = 70 + 185 * sn * sn;
        }
        d[o + 3] = 255;
      }
    }
    k.putImageData(bild, 0, 0);
    return c;
  }

  // Die Maske: in der Mitte durchsichtig, zum Rand hin spiegelnd.
  function maskeBild(n, r) {
    const c = document.createElement("canvas");
    c.width = n;
    c.height = n;
    const k = c.getContext("2d");
    const v = k.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, r);
    v.addColorStop(0, "rgba(0, 0, 0, 0.05)");
    v.addColorStop(0.5, "rgba(0, 0, 0, 0.1)");
    v.addColorStop(0.75, "rgba(0, 0, 0, 0.26)");
    v.addColorStop(0.9, "rgba(0, 0, 0, 0.62)");
    v.addColorStop(0.97, "rgba(0, 0, 0, 0.9)");
    v.addColorStop(1, "rgba(0, 0, 0, 0.0)");
    k.fillStyle = v;
    k.beginPath();
    k.arc(n / 2, n / 2, r, 0, TAU);
    k.fill();
    return c;
  }

  // Der Glanz: ein heller Fleck, das gespiegelte Fensterkreuz, ein kleiner
  // Gegenschein unten rechts und der dünne Rand.
  function glanzBild(n, r) {
    const c = document.createElement("canvas");
    c.width = n;
    c.height = n;
    const k = c.getContext("2d");
    const m = n / 2;
    // Der Rand: innen eine zarte dunkle Linie (dort bricht das Licht),
    // aussen ein feiner heller Saum.
    k.strokeStyle = "rgba(50, 30, 70, 0.22)";
    k.lineWidth = Math.max(1, r * 0.05);
    k.beginPath();
    k.arc(m, m, r * 0.94, 0, TAU);
    k.stroke();
    k.strokeStyle = "rgba(255, 255, 255, 0.6)";
    k.lineWidth = Math.max(1, r * 0.03);
    k.beginPath();
    k.arc(m, m, r * 0.99, 0, TAU);
    k.stroke();
    // Der Abend spiegelt sich unten warm.
    k.strokeStyle = "rgba(255, 200, 140, 0.5)";
    k.lineWidth = Math.max(1, r * 0.08);
    k.beginPath();
    k.arc(m, m, r * 0.93, Math.PI * 0.15, Math.PI * 0.85);
    k.stroke();
    // Das Fenster: vier gewölbte Scheiben oben links.
    k.save();
    k.translate(m - r * 0.42, m - r * 0.44);
    k.rotate(-0.35);
    const fb = r * 0.21;
    const fh = r * 0.25;
    k.fillStyle = "rgba(255, 255, 255, 0.62)";
    for (let i = 0; i < 2; i += 1) {
      for (let j = 0; j < 2; j += 1) {
        const x0 = (i - 1) * fb * 1.08;
        const y0 = (j - 1) * fh * 1.08;
        k.beginPath();
        k.moveTo(x0 + fb * 0.1, y0);
        k.quadraticCurveTo(x0 + fb * 0.5, y0 - fh * 0.12, x0 + fb, y0 + fh * 0.05);
        k.lineTo(x0 + fb * 0.95, y0 + fh);
        k.quadraticCurveTo(x0 + fb * 0.5, y0 + fh * 1.06, x0, y0 + fh * 0.95);
        k.closePath();
        k.fill();
      }
    }
    k.restore();
    // Der Glanzpunkt, weich.
    const gl = k.createRadialGradient(m - r * 0.36, m - r * 0.5, 0, m - r * 0.36, m - r * 0.5, r * 0.32);
    gl.addColorStop(0, "rgba(255, 255, 255, 0.9)");
    gl.addColorStop(1, "rgba(255, 255, 255, 0)");
    k.fillStyle = gl;
    k.fillRect(0, 0, n, n);
    // Der Gegenschein unten rechts.
    const gg = k.createRadialGradient(m + r * 0.5, m + r * 0.52, 0, m + r * 0.5, m + r * 0.52, r * 0.18);
    gg.addColorStop(0, "rgba(255, 240, 220, 0.75)");
    gg.addColorStop(1, "rgba(255, 240, 220, 0)");
    k.fillStyle = gg;
    k.fillRect(0, 0, n, n);
    return c;
  }
  // ---------------------------------------------------------------------------
  // Die Ebenen neu malen (beim Laden und wenn sich die Grösse ändert)
  // ---------------------------------------------------------------------------
  function ebenenNeu() {
    const W = view.cssW;
    const H = view.cssH;
    const s = view.s;
    const dpr = view.dpr;
    ebenen = { scheine: {}, fetzen: new Map() };
    Object.entries(SCHEINE).forEach(([name, [farbe, kraft, r]]) => { ebenen.scheine[name] = scheinAus(farbe, kraft, r * 16); });
    // Der Himmel: ein hohes Bild.
    const zug = Math.ceil(HIMMEL_HOCH * s * PH);
    ebenen.himmel = leinwand(W, H + zug);
    maleHimmel(ebenen.himmel.getContext("2d"), ebenen.himmel.width, ebenen.himmel.height, H * dpr);
    // Die Ferne.
    ebenen.ferneH = Math.round(H * 0.56);
    // Ab dort (Bildpunkte im Bild der Ferne) deckt sie: unter den Hügeln.
    ebenen.ferneDicht = Math.round(H * 0.56 * 0.75 * 0.52 * dpr);
    ebenen.ferne = leinwand(W, ebenen.ferneH);
    maleFerne(ebenen.ferne.getContext("2d"), ebenen.ferne.width, ebenen.ferne.height);
    // Der Boden beim Start: Tisch, Schale, ein Stück Rasen.
    ebenen.boden = leinwand(2 * BODEN_HALB * s, (BODEN_OBEN - BODEN_UNTEN) * s);
    maleBoden(ebenen.boden.getContext("2d"), ebenen.boden.width);
    // Die Blase.
    const rb = R * s * dpr;
    const nb = Math.ceil(rb * 2 + 4);
    ebenen.blaseN = nb;
    ebenen.film = filmBild(Math.ceil(rb * 3.2));
    ebenen.maske = maskeBild(nb, rb);
    ebenen.glanz = glanzBild(nb, rb);
    // Der Tacho: ein Messinstrument aus Messing, einmal gemalt.
    ebenen.tachoR = Math.round(clamp(Math.min(W, H) * 0.13, 44, 72));
    ebenen.tacho = tachoBild(ebenen.tachoR);
    ebenen.tachoNabe = tachoNabeBild(ebenen.tachoR);
    ebenen.tachoZahl = leinwand(ebenen.tachoR * 1.2, ebenen.tachoR * 0.5);
    ebenen.tachoSchild = leinwand(tachoMasse(ebenen.tachoR).b, tachoMasse(ebenen.tachoR).schildH);
    ebenen.tachoZahlText = "";
    ebenen.tachoSchildText = "";
    ebenen.blaseTmp = document.createElement("canvas");
    ebenen.blaseTmp.width = nb;
    ebenen.blaseTmp.height = nb;
  }

  // Eine Form als Pfad (in Einheiten, y nach oben – die Leinwand ist
  // entsprechend gestellt).
  function pfad(k, p) {
    k.beginPath();
    if (p.k === 0) k.arc(p.x, p.y, p.r, 0, TAU);
    else if (p.k === 2) {
      k.moveTo(p.pts[0][0], p.pts[0][1]);
      for (let i = 1; i < p.pts.length; i += 1) k.lineTo(p.pts[i][0], p.pts[i][1]);
      k.closePath();
    }
  }
  function strich(k, p, farbe, f = 1, dy = 0) {
    k.strokeStyle = farbe;
    k.lineWidth = p.r * 2 * f;
    k.beginPath();
    k.moveTo(p.x1, p.y1 + dy);
    k.lineTo(p.x2, p.y2 + dy);
    k.stroke();
  }
  // Ein Wolkenfetzen: alle Ballen als eine Form – unten golden angestrahlt,
  // oben flieder –, darin weiche, hellere Wölbungen und nur auf dem äusseren
  // Rand ein Lichtsaum. Gemalt wird genau die Fläche der Kreise.
  function maleWolke(k, ballen) {
    const y0 = Math.min(...ballen.map((p) => p.y - p.r));
    const y1 = Math.max(...ballen.map((p) => p.y + p.r));
    const x0 = Math.min(...ballen.map((p) => p.x - p.r));
    const x1 = Math.max(...ballen.map((p) => p.x + p.r));
    k.save();
    k.beginPath();
    ballen.forEach((p) => { k.moveTo(p.x + p.r, p.y); k.arc(p.x, p.y, p.r, 0, TAU); });
    k.clip();
    const v = k.createLinearGradient(0, y0, 0, y1);
    v.addColorStop(0, "rgb(255, 188, 150)");
    v.addColorStop(0.35, "rgb(240, 168, 172)");
    v.addColorStop(0.75, "rgb(204, 146, 190)");
    v.addColorStop(1, "rgb(176, 136, 196)");
    k.fillStyle = v;
    k.fillRect(x0, y0, x1 - x0, y1 - y0);
    ballen.forEach((p, i) => {
      for (let j = 0; j < 3; j += 1) {
        const w = Math.PI * (0.55 + 0.25 * j) + hash01(i * 7 + j) * 0.4;
        const rr = p.r * (0.45 - j * 0.08);
        const x = p.x + Math.cos(w) * p.r * 0.38;
        const y = p.y + Math.sin(w) * p.r * 0.38;
        const h = k.createRadialGradient(x, y, 0, x, y, rr);
        h.addColorStop(0, "rgba(255, 236, 226, 0.4)");
        h.addColorStop(0.6, "rgba(255, 226, 220, 0.16)");
        h.addColorStop(1, "rgba(255, 226, 220, 0)");
        k.fillStyle = h;
        k.fillRect(x - rr, y - rr, 2 * rr, 2 * rr);
      }
    });
    k.lineCap = "round";
    ballen.forEach((p) => {
      for (let w = 0; w < TAU; w += 0.16) {
        const mx = p.x + Math.cos(w + 0.08) * (p.r - 0.2);
        const my = p.y + Math.sin(w + 0.08) * (p.r - 0.2);
        if (ballen.some((q) => q !== p && Math.hypot(mx - q.x, my - q.y) < q.r - 0.1)) continue;
        const licht = clamp(0.3 - Math.cos(w) * 0.45 - Math.sin(w) * 0.45, 0, 1);
        if (licht < 0.05) continue;
        k.strokeStyle = `rgba(255, 220, 186, ${0.4 * licht * licht})`;
        k.lineWidth = 1.6;
        k.beginPath();
        k.arc(p.x, p.y, p.r - 0.45, w, w + 0.17);
        k.stroke();
      }
    });
    k.restore();
  }

  // ---------------------------------------------------------------------------
  // Zeichnen: die Welt, je Bild aufgelegt
  // ---------------------------------------------------------------------------
  function zeichneWelt() {
    const dpr = view.dpr;
    const s = view.s;
    g.setTransform(1, 0, 0, 1, 0, 0);
    const H = canvas.height;
    const hh = ebenen.himmel.height;
    // Der Himmel: ein Fenster aus dem hohen Bild, nach dem Weg.
    const abend = state.himmel * HIMMEL_WEG * s * dpr;
    const yH = clamp(Math.round(hh - H - abend * PH), 0, hh - H);
    // Die Ferne sinkt, wenn die Blase steigt, bis sie weg ist; sie deckt
    // unten alles – bis dorthin genügt der Himmel.
    const hoch = (state.cam.y - view.camY0) * s * dpr;
    const yF = Math.round(H - ebenen.ferne.height + Math.max(0, hoch) * 0.16);
    const hH = clamp(yF + ebenen.ferneDicht, 1, H);
    g.drawImage(ebenen.himmel, 0, yH, canvas.width, hH, 0, 0, canvas.width, hH);
    if (yF < H) g.drawImage(ebenen.ferne, 0, yF);
  }

  // Der Boden beim Start: der Rasen über die ganze Breite, darauf Tisch,
  // Schale und Ring.
  function zeichneBoden() {
    const top = bildY(BODEN_OBEN);
    if (top > view.cssH) return;
    const dpr = view.dpr;
    g.setTransform(1, 0, 0, 1, 0, 0);
    const yr = Math.round(bildY(-116) * dpr);
    if (yr < canvas.height) {
      const gr = g.createLinearGradient(0, yr, 0, yr + 40 * view.s * dpr);
      gr.addColorStop(0, "rgb(120, 150, 62)");
      gr.addColorStop(0.3, "rgb(78, 110, 50)");
      gr.addColorStop(1, "rgb(40, 62, 38)");
      g.fillStyle = gr;
      g.fillRect(0, yr, canvas.width, canvas.height - yr);
    }
    g.drawImage(ebenen.boden, Math.round(bildX(-BODEN_HALB) * dpr), Math.round(top * dpr));
  }

  // Die Farben der Lichtbänder beim Weg s – nach der Stimmung.
  function bandFarbe(s) {
    const m = stimmungMix(s);
    const a = STIMMUNGEN[m.a];
    const b = STIMMUNGEN[m.b];
    return { kern: mix3(a.kern, b.kern, m.k), schein: mix3(a.schein, b.schein, m.k) };
  }

  /*
   * Die Bahn: innen ein Hauch von Seifenfilm, an jedem Rand ein Lichtband –
   * ein dunkler Saum (er hebt das Band vom hellen Abendhimmel ab), ein
   * schillernder Schein, der Kern, ein heller Grat. Jeder Rand ist ein
   * einziger Pfad; was weiter weg ist als die Sicht, verschwindet im Dunst
   * (ein runder Verlauf um den Blickpunkt) – auf jedem Gerät gleich.
   */
  function zeichneBahn() {
    const B = state.bahn;
    const N = B.x.length;
    if (N < 2) return;
    const s = view.s;
    const cx = state.cam.x;
    const cy = state.cam.y;
    const sb = state.blase.i * DS;
    const ia = Math.max(0, Math.floor((sb - 320) / DS));
    const iz = Math.min(N - 1, Math.ceil((sb + 760) / DS));
    const reich = SICHT * 1.45;
    g.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
    g.lineJoin = "round";
    g.lineCap = "round";
    // Welche Punkte im Blick sind (in Stücken zu sechs).
    const drin = [];
    for (let i = ia; i <= iz; i += 6) drin.push(Math.hypot(B.x[i] - cx, B.y[i] - cy) - B.w[i] < reich);
    const im = (i) => drin[Math.floor((i - ia) / 6)];
    const rx = (i, f) => bildX(B.x[i] - B.ty[i] * B.w[i] * f);
    const ry = (i, f) => bildY(B.y[i] + B.tx[i] * B.w[i] * f);
    const fx = bildX(cx);
    const fy = bildY(cy);
    const verlauf = (stopps) => {
      const v = g.createRadialGradient(fx, fy, SICHT * 1.1 * s, fx, fy, SICHT * 1.4 * s);
      stopps.forEach(([k, c]) => v.addColorStop(k, c));
      return v;
    };
    const c = bandFarbe(sb);
    // Innen: ein Hauch Film – Stück für Stück entlang, eine Fläche.
    g.beginPath();
    let offen = false;
    let von = -1;
    const flaeche = (a, z) => {
      g.moveTo(rx(a, 1), ry(a, 1));
      for (let q = a + 2; q <= z; q += 2) g.lineTo(rx(q, 1), ry(q, 1));
      for (let q = z; q >= a; q -= 2) g.lineTo(rx(q, -1), ry(q, -1));
      g.closePath();
    };
    for (let i = ia; i <= iz; i += 2) {
      const ja = im(i);
      if (ja && von < 0) von = i;
      if ((!ja || i + 2 > iz) && von >= 0) { flaeche(von, ja ? i : i - 2); von = -1; offen = true; }
    }
    if (offen) {
      g.fillStyle = verlauf([[0, "rgba(255, 246, 252, 0.2)"], [1, "rgba(255, 246, 252, 0)"]]);
      g.fill();
    }
    // Die Ränder: je ein Pfad.
    const rand = (f) => {
      g.beginPath();
      let zug = false;
      for (let i = ia; i <= iz; i += 2) {
        if (!im(i)) { zug = false; continue; }
        if (!zug) { g.moveTo(rx(i, f), ry(i, f)); zug = true; } else g.lineTo(rx(i, f), ry(i, f));
      }
      if (ia === 0 && im(0) && f > 0) {
        // Der Anfang: unten herum geschlossen.
        g.moveTo(rx(0, 1), ry(0, 1));
        g.arc(bildX(B.x[0]), bildY(B.y[0]), B.w[0] * s, Math.PI, 0, true);
      }
    };
    const saum = verlauf([[0, "rgba(60, 26, 76, 0.38)"], [1, "rgba(60, 26, 76, 0)"]]);
    const schein = verlauf([[0, rgba(c.schein, 0.42)], [1, rgba(c.schein, 0)]]);
    const kern = verlauf([[0, rgba(c.kern, 1)], [1, rgba(c.kern, 0)]]);
    const grat = verlauf([[0, "rgba(255, 252, 244, 0.85)"], [1, "rgba(255, 252, 244, 0)"]]);
    const breiteKern = Math.max(3, 1.6 * s);
    [1, -1].forEach((f) => {
      rand(f);
      g.strokeStyle = schein;
      g.lineWidth = Math.max(9, 4.6 * s);
      g.stroke();
      g.strokeStyle = saum;
      g.lineWidth = breiteKern + 2.4;
      g.stroke();
      g.strokeStyle = kern;
      g.lineWidth = breiteKern;
      g.stroke();
      g.strokeStyle = grat;
      g.lineWidth = Math.max(0.9, 0.4 * s);
      g.stroke();
    });
    // Das Schillern: kurze Lichter in den Farben dünner Seifenhaut, die die
    // Bänder entlang wandern.
    if (!ruhig()) {
      const FARBEN = ["rgba(255, 150, 220, 0.75)", "rgba(140, 236, 255, 0.75)", "rgba(255, 244, 150, 0.75)"];
      g.lineWidth = Math.max(1.6, 0.8 * s);
      for (let i = ia - (ia % 30); i <= iz; i += 30) {
        [1, -1].forEach((f, seite) => {
          const j = i + Math.floor(((state.zeit * 9 + seite * 7) % 30));
          if (j < ia || j + 4 > iz || !im(j)) return;
          const d = Math.hypot(B.x[j] - cx, B.y[j] - cy);
          const a = sichtbar(d);
          if (a <= 0.02) return;
          g.globalAlpha = a;
          g.strokeStyle = FARBEN[((i / 30) | 0) % 3];
          g.beginPath();
          g.moveTo(rx(j, f), ry(j, f));
          g.lineTo(rx(j + 4, f), ry(j + 4, f));
          g.stroke();
        });
      }
      g.globalAlpha = 1;
    }
  }

  // Die Marken: alle zehn Meter Bahn ein feiner Strich quer und die Zahl.
  function zeichneMarken() {
    const B = state.bahn;
    const s = view.s;
    const sb = state.blase.i * DS;
    g.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
    g.font = "700 11px system-ui, sans-serif";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.lineWidth = 1;
    for (let m = Math.max(10, Math.ceil((sb - 300) / 1000) * 10); m * METER <= sb + 700; m += 10) {
      const i = Math.round((m * METER) / DS);
      if (i >= B.x.length) break;
      const a = sichtbar(Math.hypot(B.x[i] - state.cam.x, B.y[i] - state.cam.y));
      if (a <= 0.02) continue;
      const nx = -B.ty[i];
      const ny = B.tx[i];
      const w = B.w[i];
      g.globalAlpha = a * 0.5;
      g.strokeStyle = "rgb(255, 255, 255)";
      g.setLineDash([3, 4]);
      g.beginPath();
      g.moveTo(bildX(B.x[i] + nx * w), bildY(B.y[i] + ny * w));
      g.lineTo(bildX(B.x[i] - nx * w), bildY(B.y[i] - ny * w));
      g.stroke();
      g.setLineDash([]);
      g.globalAlpha = a * 0.8;
      g.fillStyle = "rgb(255, 250, 240)";
      g.fillText(`${m} m`, bildX(B.x[i] - nx * (w + 9 + 4 / s)), bildY(B.y[i] - ny * (w + 9 + 4 / s)));
    }
    g.globalAlpha = 1;
  }

  /*
   * Der Nebel kriecht die Bahn entlang: ein dichter Schleier, der die Bahn
   * hinter seiner Grenze füllt, vorn weich und wallend.
   */
  function zeichneNebel() {
    const B = state.bahn;
    const sn = nebelS(state.t);
    if (sn <= 0 || state.phase === "bereit") return;
    const s = view.s;
    const iv = Math.min(B.x.length - 1, Math.floor(sn / DS));
    const ia = Math.max(0, iv - Math.round(320 / DS));
    const cx = state.cam.x;
    const cy = state.cam.y;
    if (Math.hypot(B.x[iv] - cx, B.y[iv] - cy) > SICHT * 2.2 && Math.hypot(B.x[ia] - cx, B.y[ia] - cy) > SICHT * 2.2) return;
    g.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
    g.lineJoin = "round";
    g.lineCap = "butt";
    const STUECK = 10;
    for (let i = ia; i < iv; i += STUECK) {
      const j = Math.min(iv, i + STUECK + 1);
      const f = 1 - (iv - i) / (iv - ia + 1);
      g.globalAlpha = lerp(0.88, 0.62, f * f);
      g.strokeStyle = "rgb(234, 226, 246)";
      g.lineWidth = B.w[i] * 2 * s;
      g.beginPath();
      g.moveTo(bildX(B.x[i]), bildY(B.y[i]));
      for (let q = i + 2; q < j; q += 2) g.lineTo(bildX(B.x[q]), bildY(B.y[q]));
      g.lineTo(bildX(B.x[j]), bildY(B.y[j]));
      g.stroke();
    }
    g.globalAlpha = 1;
    // Die Grenze: wallende Schwaden.
    const x = B.x[iv];
    const y = B.y[iv];
    const nx = -B.ty[iv];
    const ny = B.tx[iv];
    const w = B.w[iv];
    for (let q = 0; q < 7; q += 1) {
      const o = (q / 3 - 1) * w * 0.8;
      const vor = ruhig() ? 0 : Math.sin(state.zeit * 1.4 + q * 1.7) * 3;
      schein("nebel", bildX(x + nx * o + B.tx[iv] * vor), bildY(y + ny * o + B.ty[iv] * vor), s * (w * 0.55 + 4 * hash01(q)), 0.7);
    }
  }

  // Der Rückenwind: goldene Pfeile, die die Bahn entlang ziehen; die Böe:
  // Windstreifen quer über ihr Stück.
  function zeichneWinde() {
    const B = state.bahn;
    const s = view.s;
    const sb = state.blase.i * DS;
    g.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
    g.lineCap = "round";
    g.lineJoin = "round";
    state.figuren.forEach((f) => {
      if (!f.wind || f.i1 * DS < sb - 300 || f.i0 * DS > sb + 760) return;
      const lang = (f.i1 - f.i0) * DS;
      if (f.wind.art === "rueckenwind") {
        // Ein warmer Schimmer über der ganzen Bahn, dann die Pfeile.
        for (let i = f.i0; i < f.i1; i += 12) {
          const a = sichtbar(Math.hypot(B.x[i] - state.cam.x, B.y[i] - state.cam.y));
          if (a <= 0.02) continue;
          const j = Math.min(f.i1, i + 13);
          g.globalAlpha = 0.12 * a * glatt((i - f.i0) / 20) * glatt((f.i1 - i) / 20);
          g.strokeStyle = "rgb(255, 214, 140)";
          g.lineWidth = B.w[i] * 1.7 * s;
          g.beginPath();
          g.moveTo(bildX(B.x[i]), bildY(B.y[i]));
          g.lineTo(bildX(B.x[j]), bildY(B.y[j]));
          g.stroke();
        }
        const zahl = Math.floor(lang / 26);
        for (let p = 0; p < zahl; p += 1) {
          const sp = f.i0 * DS + ((p * 26 + (ruhig() ? 0 : state.zeit * RUECKENWIND * 0.8)) % lang);
          const i = Math.round(sp / DS);
          const a = sichtbar(Math.hypot(B.x[i] - state.cam.x, B.y[i] - state.cam.y)) * glatt((i - f.i0) / 20) * glatt((f.i1 - i) / 20);
          if (a <= 0.02) continue;
          const tx = B.tx[i];
          const ty = B.ty[i];
          const nx = -ty;
          const ny = tx;
          const w = B.w[i] * 0.45;
          [-1, 1].forEach((seite) => {
            const ox = nx * w * 0.55 * seite;
            const oy = ny * w * 0.55 * seite;
            g.globalAlpha = 0.75 * a;
            g.strokeStyle = "rgb(255, 226, 160)";
            g.lineWidth = Math.max(1.4, 0.7 * s);
            g.beginPath();
            g.moveTo(bildX(B.x[i] + ox - tx * 5 + nx * 4), bildY(B.y[i] + oy - ty * 5 + ny * 4));
            g.lineTo(bildX(B.x[i] + ox), bildY(B.y[i] + oy));
            g.lineTo(bildX(B.x[i] + ox - tx * 5 - nx * 4), bildY(B.y[i] + oy - ty * 5 - ny * 4));
            g.stroke();
          });
        }
      } else if (!ruhig()) {
        // Die Böe: Streifen, die quer durch ihr Stück jagen.
        const sg = Math.sign(f.wind.w);
        let x0 = Infinity;
        let x1 = -Infinity;
        for (let i = f.i0; i <= f.i1; i += 10) { x0 = Math.min(x0, B.x[i] - B.w[i]); x1 = Math.max(x1, B.x[i] + B.w[i]); }
        x0 -= 50;
        x1 += 50;
        const yA = B.y[f.i0];
        const yB = B.y[f.i1];
        for (let q = 0; q < 30; q += 1) {
          const y = yA + hash01(q * 2.3) * (yB - yA);
          const l = 18 + hash01(q * 7.1) * 24;
          const u = (state.zeit * (Math.abs(f.wind.w) / 60) * (0.8 + hash01(q) * 0.5) + hash01(q * 1.7)) % 1;
          const x = sg > 0 ? x0 + u * (x1 - x0) : x1 - u * (x1 - x0);
          const kante = glatt((y - yA) / 50) * glatt((yB - y) / 50) * sichtbar(Math.hypot(x - state.cam.x, y - state.cam.y));
          if (kante <= 0.02) continue;
          g.globalAlpha = 0.55 * kante;
          g.strokeStyle = "rgb(236, 246, 255)";
          g.lineWidth = Math.max(1.2, s * 0.45);
          g.beginPath();
          g.moveTo(bildX(x), bildY(y));
          g.quadraticCurveTo(bildX(x - sg * l * 0.5), bildY(y + 1.5 + Math.sin(q) * 1.5), bildX(x - sg * l), bildY(y + Math.sin(q * 3) * 2.5));
          g.stroke();
        }
      }
    });
    g.globalAlpha = 1;
  }

  // Was sich bewegt: Vögel, Fetzen – so sichtbar, wie weit sie weg sind.
  function zeichneBeweger() {
    const s = view.s;
    const t = state.t;
    const sb = state.blase.i * DS;
    g.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
    state.beweger.forEach((m) => {
      if (m.s1 < sb - 300 || m.s0 > sb + 760) return;
      const o = bewegerOrt(m, t);
      let a = sichtbar(Math.hypot(o.x - state.cam.x, o.y - state.cam.y));
      if (m.art === "fetzen") a *= 1 - glatt((Math.abs(o.x - m.xc) - m.A + 14) / 14);
      if (a <= 0.02) return;
      g.globalAlpha = a;
      if (m.art === "fetzen") { zeichneFetzen(m, o); g.globalAlpha = 1; return; }
      g.save();
      g.translate(bildX(o.x), bildY(o.y));
      g.scale(s * o.dir, -s);
      zeichneTier(m, bewegerForm(m, o));
      g.restore();
      g.globalAlpha = 1;
    });
  }

  function zeichneTier(m, form) {
    g.lineCap = "round";
    g.lineJoin = "round";
    const fl = form.filter((p) => p.rolle === "fluegel");
    if (m.art === "wespe") {
      fl.forEach((p) => { pfad(g, p); g.fillStyle = "rgba(230, 240, 255, 0.55)"; g.fill(); g.strokeStyle = "rgba(255, 255, 255, 0.7)"; g.lineWidth = 0.15; g.stroke(); });
      form.forEach((p) => {
        if (p.rolle === "fluegel") return;
        pfad(g, p);
        g.fillStyle = p.rolle === "brust" ? "rgb(70, 50, 30)" : p.rolle === "kopf" ? "rgb(240, 190, 40)" : "rgb(250, 200, 30)";
        g.fill();
        if (p.rolle === "leib") {
          g.save();
          pfad(g, p);
          g.clip();
          g.fillStyle = "rgb(30, 24, 20)";
          for (let x = p.x - p.r; x < p.x + p.r; x += 1.3) g.fillRect(x, p.y - p.r, 0.6, 2 * p.r);
          g.restore();
        }
      });
      g.strokeStyle = "rgb(30, 24, 20)";
      g.lineWidth = 0.2;
      g.beginPath();
      g.moveTo(4.2, 1.2);
      g.lineTo(5.6, 2.8);
      g.stroke();
      return;
    }
    // Schwalbe und Mauersegler: dunkel, die Schwalbe mit hellem Bauch und
    // roter Kehle.
    const dunkel = m.art === "schwalbe" ? "rgb(30, 34, 70)" : "rgb(48, 40, 46)";
    form.forEach((p) => {
      if (p.k === 1) strich(g, p, dunkel);
      else { pfad(g, p); g.fillStyle = dunkel; g.fill(); }
    });
    if (m.art === "schwalbe") {
      g.fillStyle = "rgb(236, 230, 220)";
      g.beginPath();
      g.ellipse(0.2, -0.6, 3, 0.9, 0, 0, TAU);
      g.fill();
      g.fillStyle = "rgb(190, 80, 50)";
      g.beginPath();
      g.arc(4.6, 0.1, 0.8, 0, TAU);
      g.fill();
    }
    g.fillStyle = "rgba(255, 190, 140, 0.45)";
    fl.forEach((p) => { g.beginPath(); g.moveTo(p.pts[0][0], p.pts[0][1]); g.lineTo(p.pts[2][0], p.pts[2][1]); g.lineTo(p.pts[1][0], p.pts[1][1]); g.closePath(); g.fill(); });
  }

  function zeichneFetzen(m, o) {
    let b = ebenen.fetzen.get(m);
    const s = view.s * view.dpr;
    if (!b) {
      const c = document.createElement("canvas");
      c.width = Math.ceil(40 * s);
      c.height = Math.ceil(30 * s);
      const k = c.getContext("2d");
      k.setTransform(s, 0, 0, -s, 20 * s, 15 * s);
      maleWolke(k, m.puffs.map((p) => kreis(p[0], p[1], p[2], "wolke")));
      b = c;
      ebenen.fetzen.set(m, b);
    }
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.drawImage(b, Math.round((bildX(o.x) - 20 * view.s) * view.dpr), Math.round((bildY(o.y) - 15 * view.s) * view.dpr));
    g.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
  }
  // ---------------------------------------------------------------------------
  // Zeichnen: die Blase, ihre Luftstösse, ihr Platzen
  // ---------------------------------------------------------------------------
  function blaseMalen(x, y, gross = 1, alpha = 1, geist = null) {
    const s = view.s;
    const dpr = view.dpr;
    const b = state.blase;
    const n = ebenen.blaseN;
    const tmp = ebenen.blaseTmp;
    // Wie sie wabert: nach einem Stoss in seiner Richtung gestaucht, dann
    // schwingend; dazu ein leises Atmen.
    const still = ruhig();
    const a = geist || still ? 0 : b.wa * Math.exp(-b.wt / 0.45) * Math.cos(TAU * 3.2 * b.wt);
    const atem = still ? 0 : 0.014 * Math.sin(state.zeit * 5.3);
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (geist) {
      g.globalAlpha = alpha;
      g.strokeStyle = geist;
      g.lineWidth = 1.5;
      g.beginPath();
      g.arc(x, y, R * s * gross, 0, TAU);
      g.stroke();
      g.globalAlpha = alpha * 0.25;
      g.fillStyle = geist;
      g.fill();
      g.globalAlpha = 1;
      return;
    }
    // Der Film, gedreht und verschoben, durch die Maske.
    const k = tmp.getContext("2d");
    k.setTransform(1, 0, 0, 1, 0, 0);
    k.globalCompositeOperation = "source-over";
    k.clearRect(0, 0, n, n);
    const f = ebenen.film;
    k.translate(n / 2, n / 2);
    k.rotate(state.zeit * 0.45 + b.x * 0.01);
    k.translate(Math.sin(state.zeit * 0.31) * n * 0.12, Math.cos(state.zeit * 0.23) * n * 0.1);
    k.drawImage(f, -f.width / 2, -f.height / 2);
    k.setTransform(1, 0, 0, 1, 0, 0);
    k.globalCompositeOperation = "destination-in";
    k.drawImage(ebenen.maske, 0, 0);
    k.globalCompositeOperation = "source-over";
    g.save();
    g.translate(x, y);
    g.rotate(b.ww);
    g.scale((1 + a + atem) * gross, (1 - a * 0.9 - atem) * gross);
    g.rotate(-b.ww);
    g.globalAlpha = alpha * 0.92;
    g.drawImage(tmp, -n / 2 / dpr, -n / 2 / dpr, n / dpr, n / dpr);
    g.globalAlpha = alpha;
    g.drawImage(ebenen.glanz, -n / 2 / dpr, -n / 2 / dpr, n / dpr, n / dpr);
    g.restore();
    g.globalAlpha = 1;
  }

  function zeichneBlase() {
    const b = state.blase;
    if (state.schritt === "geplatzt") {
      // Im ersten Augenblick reisst die Haut auf und weitet sich – dann ist
      // sie fort.
      const z = state.geplatzt?.zeit ?? 1;
      if (z < 0.09 && !ruhig()) blaseMalen(bildX(state.geplatzt.x), bildY(state.geplatzt.y), 1 + z * 4, 1 - z / 0.09);
      return;
    }
    let x = bildX(b.x);
    let y = bildY(b.y);
    let gross = 1;
    if (state.intro) {
      // Sie wächst aus dem Ring und löst sich.
      const t = state.intro.t;
      const k = glatt(t / 1.3);
      gross = 0.15 + 0.85 * k;
      const hoch = RING.y + R * gross * 0.9 + glatt((t - 1.3) / 1.1) * (0 - RING.y - R * 0.9);
      y = bildY(hoch);
    } else if (state.phase === "bereit") {
      y += Math.sin(state.zeit * 1.6) * 1.2 * view.s;
      x += Math.sin(state.zeit * 1.1) * 0.6 * view.s;
    }
    blaseMalen(x, y, gross);
  }

  // Die Luftstösse: ein Wirbel am Finger, Linien zur Blase.
  function zeichneStoesse() {
    const s = view.s;
    g.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
    g.lineCap = "round";
    state.stossBilder.forEach((st) => {
      const k = clamp(st.zeit / 0.38, 0, 1);
      const fx = bildX(st.fx);
      const fy = bildY(st.fy);
      const bx = bildX(st.bx);
      const by = bildY(st.by);
      const dx = bx - fx;
      const dy = by - fy;
      const l = Math.hypot(dx, dy) || 1;
      const ux = dx / l;
      const uy = dy / l;
      // Der Ring am Finger.
      g.strokeStyle = `rgba(255, 255, 255, ${0.7 * (1 - k)})`;
      g.lineWidth = 1.6;
      g.beginPath();
      g.arc(fx, fy, (2 + k * 9) * s, 0, TAU);
      g.stroke();
      schein("weiss", fx, fy, 6 * s, 0.4 * (1 - k));
      // Luftlinien, die vom Finger zur Blase ziehen.
      const kraft = clamp(st.kraft / J0, 0.15, 1);
      for (let i = -2; i <= 2; i += 1) {
        const off = i * 2.2 * s;
        const kopf = clamp(k * 1.25 - Math.abs(i) * 0.06, 0, 1);
        const schwanz = clamp(kopf - 0.35, 0, 1);
        const krumm = i * 0.12;
        const p = (f) => [fx + dx * f - uy * off * (1 + f * 0.6) + uy * Math.sin(f * Math.PI) * krumm * l * 0.2, fy + dy * f + ux * off * (1 + f * 0.6) - ux * Math.sin(f * Math.PI) * krumm * l * 0.2];
        const [x0, y0] = p(schwanz);
        const [x1, y1] = p(kopf * 0.92);
        g.strokeStyle = `rgba(255, 255, 255, ${0.6 * kraft * (1 - k * 0.8)})`;
        g.lineWidth = 1.2;
        g.beginPath();
        g.moveTo(x0, y0);
        g.lineTo(x1, y1);
        g.stroke();
      }
    });
  }

  // Was beim Platzen aufstiebt: Tröpfchen, Fetzen des Films.
  function zeichneTeilchen() {
    if (!state.teile.length) return;
    const s = view.s;
    g.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
    state.teile.forEach((t) => {
      const k = clamp(t.leben / t.max, 0, 1);
      const x = bildX(t.x);
      const y = bildY(t.y);
      if (t.art === "troepfchen") {
        g.globalAlpha = k;
        g.fillStyle = t.farbe;
        const r = 0.5 + 0.9 * k;
        g.beginPath();
        g.arc(x, y, r, 0, TAU);
        g.fill();
      } else if (t.art === "ring") {
        g.globalAlpha = k * t.kraft;
        g.strokeStyle = "rgba(255, 255, 255, 0.9)";
        g.lineWidth = 1.2 * k + 0.3;
        g.beginPath();
        g.arc(x, y, t.r * s, 0, TAU);
        g.stroke();
      } else if (t.art === "blitz") {
        schein("weiss", x, y, t.r * s, k * 0.9);
      } else if (t.art === "fetzen") {
        g.globalAlpha = k * 0.8;
        g.strokeStyle = t.farbe;
        g.lineWidth = 1;
        g.beginPath();
        g.arc(x, y, 1.6 * s, t.w, t.w + 1.4);
        g.stroke();
      }
      g.globalAlpha = 1;
    });
  }
  // Die Gegner als Blasen aus Licht (geist.js); daneben, wie weit sie auf
  // der Bahn vorn oder hinten sind.
  function zeichneGeister() {
    if (!gegner || state.phase === "bereit") return;
    const orte = window.LernappGeist?.orte?.(gegner) || [];
    if (!orte.length) return;
    const namen = [];
    const sb = state.blase.i * DS;
    orte.forEach((o) => {
      if (o.ziel) return;
      const x = o.a / 4;
      const y = o.b / 2;
      const sx = bildX(x);
      const sy = bildY(y);
      if (sx > -40 && sx < view.cssW + 40 && sy > -40 && sy < view.cssH + 40) blaseMalen(sx, sy, 1, 0.5 * o.blass, o.farbe);
      const sg = sVon(x, y);
      const dy = sg === null ? 0 : sg - sb;
      namen.push({ ...o, sx, sy: sy - R * view.s - 6, weit: `${dy > 0 ? "+" : ""}${Math.round(dy / METER)} m` });
    });
    window.LernappGeist.namen(g, namen, { breit: view.cssW, hoch: view.cssH });
  }

  function zeichneSchriften() {
    if (!state.schriften.length) return;
    g.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
    g.lineJoin = "round";
    g.textAlign = "center";
    g.textBaseline = "middle";
    state.schriften.forEach((t) => {
      const k = clamp(t.leben / t.max, 0, 1);
      const gross = t.gross;
      g.font = `900 ${gross}px system-ui, sans-serif`;
      const x = view.cssW / 2;
      const y = view.frei + (view.cssH - view.frei) * 0.22 - (1 - k) * 10;
      g.globalAlpha = Math.min(1, k * 2.4) * Math.min(1, (t.max - t.leben) * 5);
      g.lineWidth = Math.max(4, gross * 0.22);
      g.strokeStyle = "rgba(40, 20, 50, 0.7)";
      g.strokeText(t.text, x, y);
      g.fillStyle = t.farbe;
      g.fillText(t.text, x, y);
    });
    g.globalAlpha = 1;
  }

  // Die Ansage oben im Bild: was kommt.
  function zeichneAnsage() {
    const an = state.ansage;
    if (!an || an.leben <= 0 || state.phase === "bereit") return;
    g.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
    const W = view.cssW;
    const k = clamp(an.leben / an.max, 0, 1);
    const sicht = Math.min(1, k * 3) * Math.min(1, (an.max - an.leben) * 6);
    const y = view.frei + 26;
    g.lineJoin = "round";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.globalAlpha = sicht;
    g.font = "900 20px system-ui, sans-serif";
    let breit = g.measureText(an.text).width;
    if (an.unter) {
      g.font = "700 13px system-ui, sans-serif";
      breit = Math.max(breit, g.measureText(an.unter).width);
      g.font = "900 20px system-ui, sans-serif";
    }
    g.fillStyle = "rgba(40, 22, 56, 0.5)";
    g.beginPath();
    g.roundRect(W / 2 - breit / 2 - 16, y - 17, breit + 32, an.unter ? 54 : 34, 17);
    g.fill();
    g.lineWidth = 5;
    g.strokeStyle = "rgba(36, 18, 50, 0.8)";
    g.strokeText(an.text, W / 2, y);
    g.fillStyle = an.farbe;
    g.fillText(an.text, W / 2, y);
    if (an.unter) {
      g.font = "700 13px system-ui, sans-serif";
      g.lineWidth = 4;
      g.strokeText(an.unter, W / 2, y + 21);
      g.fillStyle = "#fff4ee";
      g.fillText(an.unter, W / 2, y + 21);
    }
    g.globalAlpha = 1;
  }
  function zeichnen() {
    if (!g || !ebenen) return;
    zeichneWelt();
    zeichneBoden();
    zeichneNebel();
    zeichneWinde();
    zeichneBahn();
    zeichneMarken();
    zeichneBeweger();
    zeichneGeister();
    if (state.intro || state.blase.y < 40) {
      g.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
      zeichneRing();
    }
    zeichneStoesse();
    zeichneBlase();
    zeichneTeilchen();
    zeichneTacho();
    g.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
    zeichneSchriften();
    zeichneAnsage();
  }

  // ---------------------------------------------------------------------------
  // Der Tacho
  // ---------------------------------------------------------------------------
  /*
   * Unten links ein kleines Messinstrument aus Messing: das Zifferblatt
   * zeigt, wie schnell die Blase gerade die Bahn entlang fliegt (0 bis
   * TACHO_MAX km/h, die Nadel gedämpft), eine fliederfarbene Marke das Ø
   * des Zeitplans (so schnell kriecht der Nebel; darunter bleibt der Faktor
   * bei ×1), eine goldene das eigene Ø. Liegt die goldene rechts der
   * fliederfarbenen, zählt jeder Meter mehr. Darunter ein Schild mit dem Faktor, dem Ø und
   * den Punkten. Das Gehäuse, die Skala und das Schild sind vorgemalt; je
   * Bild kommen nur Nadel, Marken und Zahlen dazu.
   */
  const TACHO_MAX = 10;
  const tachoWinkel = (kmh) => Math.PI * (0.75 + 1.5 * clamp(kmh / TACHO_MAX, 0, 1.03));

  // Masse in CSS-Pixeln, bezogen auf den Halbmesser r des Zifferblatts.
  const tachoMasse = (r) => ({ b: Math.round(r * 2.5), h: Math.round(r * 3.05), cx: Math.round(r * 1.25), cy: Math.round(r * 1.2), schildY: Math.round(r * 2.18), schildH: Math.round(r * 0.82) });

  function tachoBild(r) {
    const m = tachoMasse(r);
    const c = leinwand(m.b, m.h);
    const k = c.getContext("2d");
    const d = view.dpr;
    k.scale(d, d);
    const { cx, cy } = m;
    // Schatten, Messingring, Zifferblatt.
    k.fillStyle = "rgba(30, 14, 30, 0.35)";
    k.beginPath();
    k.arc(cx + r * 0.05, cy + r * 0.08, r * 1.12, 0, TAU);
    k.fill();
    const ring = k.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
    ring.addColorStop(0, "rgb(255, 228, 150)");
    ring.addColorStop(0.45, "rgb(196, 146, 60)");
    ring.addColorStop(1, "rgb(110, 72, 30)");
    k.fillStyle = ring;
    k.beginPath();
    k.arc(cx, cy, r * 1.1, 0, TAU);
    k.fill();
    const blatt = k.createRadialGradient(cx - r * 0.25, cy - r * 0.35, r * 0.1, cx, cy, r);
    blatt.addColorStop(0, "rgb(255, 250, 236)");
    blatt.addColorStop(0.8, "rgb(244, 230, 204)");
    blatt.addColorStop(1, "rgb(214, 192, 160)");
    k.fillStyle = blatt;
    k.beginPath();
    k.arc(cx, cy, r * 0.97, 0, TAU);
    k.fill();
    // Ein Farbband: ruhig, dann warm, oben rot.
    k.lineWidth = r * 0.1;
    for (let v = 0; v < TACHO_MAX; v += 0.25) {
      const f = v / TACHO_MAX;
      k.strokeStyle = rgb(f < 0.5 ? mix3([150, 190, 160], [240, 190, 90], f * 2) : mix3([240, 190, 90], [214, 70, 60], (f - 0.5) * 2));
      k.beginPath();
      k.arc(cx, cy, r * 0.8, tachoWinkel(v), tachoWinkel(v + 0.26));
      k.stroke();
    }
    // Striche und Zahlen.
    k.strokeStyle = "rgb(60, 40, 40)";
    k.fillStyle = "rgb(60, 40, 40)";
    k.textAlign = "center";
    k.textBaseline = "middle";
    k.font = `800 ${Math.round(r * 0.22)}px system-ui, sans-serif`;
    for (let v = 0; v <= TACHO_MAX; v += 0.5) {
      const w = tachoWinkel(v);
      const lang = v % 2 === 0 ? 0.2 : v % 1 === 0 ? 0.13 : 0.08;
      k.lineWidth = v % 1 === 0 ? Math.max(1, r * 0.035) : Math.max(0.7, r * 0.02);
      k.beginPath();
      k.moveTo(cx + Math.cos(w) * r * 0.92, cy + Math.sin(w) * r * 0.92);
      k.lineTo(cx + Math.cos(w) * r * (0.92 - lang), cy + Math.sin(w) * r * (0.92 - lang));
      k.stroke();
      if (v % 2 === 0 && v > 0 && v < TACHO_MAX) k.fillText(String(v), cx + Math.cos(w) * r * 0.58, cy + Math.sin(w) * r * 0.58);
    }
    k.font = `700 ${Math.round(r * 0.16)}px system-ui, sans-serif`;
    k.fillStyle = "rgb(120, 90, 70)";
    k.fillText("km/h", cx, cy + r * 0.74);
    // Ein Glanz auf dem Glas.
    const glas = k.createLinearGradient(cx - r, cy - r, cx + r * 0.2, cy + r * 0.2);
    glas.addColorStop(0, "rgba(255, 255, 255, 0.35)");
    glas.addColorStop(0.5, "rgba(255, 255, 255, 0.05)");
    glas.addColorStop(1, "rgba(255, 255, 255, 0)");
    k.fillStyle = glas;
    k.beginPath();
    k.arc(cx, cy, r * 0.97, Math.PI * 0.95, Math.PI * 1.85);
    k.closePath();
    k.fill();
    // Das Schild darunter, aus Messing.
    const sy = m.schildY;
    const sh = m.schildH;
    const schild = k.createLinearGradient(0, sy, 0, sy + sh);
    schild.addColorStop(0, "rgb(250, 220, 150)");
    schild.addColorStop(0.5, "rgb(206, 156, 70)");
    schild.addColorStop(1, "rgb(150, 100, 40)");
    k.fillStyle = "rgba(30, 14, 30, 0.3)";
    k.beginPath();
    k.roundRect(r * 0.08, sy + r * 0.06, m.b - r * 0.12, sh, r * 0.18);
    k.fill();
    k.fillStyle = schild;
    k.beginPath();
    k.roundRect(r * 0.04, sy, m.b - r * 0.08, sh, r * 0.18);
    k.fill();
    k.fillStyle = "rgb(250, 238, 210)";
    k.beginPath();
    k.roundRect(r * 0.12, sy + r * 0.08, m.b - r * 0.24, sh - r * 0.16, r * 0.12);
    k.fill();
    return c;
  }

  // Wo der Tacho steht (in Bildpunkten): unten links, unter der Blase –
  // dort ist nur, was sie schon hinter sich hat.
  function tachoOrt() {
    const r = ebenen?.tachoR || 0;
    const m = tachoMasse(r);
    return { x: 8, y: Math.round(view.cssH - m.h - 8), b: m.b, h: m.h, r };
  }
  function zeichneTacho() {
    if (!ebenen?.tacho || state.intro) return;
    const r = ebenen.tachoR;
    const m = tachoMasse(r);
    const { x: x0, y: y0 } = tachoOrt();
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.drawImage(ebenen.tacho, Math.round(x0 * view.dpr), Math.round(y0 * view.dpr));
    g.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
    const cx = x0 + m.cx;
    const cy = y0 + m.cy;
    const t = Math.max(0.1, state.t);
    const laeuft = state.phase === "spiel" || state.phase === "zuschauen" || state.phase === "ende";
    const schnitt = laeuft ? (state.weiteste / t) * KMH : 0;
    const plan = laeuft ? (sRef(Math.max(1, t)) / Math.max(1, t)) * KMH : 0;
    // Die Marken am Rand: das Ø des Zeitplans (flieder) und das eigene
    // (gold).
    [[plan, "rgb(150, 110, 200)"], [schnitt, "rgb(214, 150, 40)"]].forEach(([v, farbe]) => {
      if (!laeuft) return;
      const w = tachoWinkel(v);
      const ax = cx + Math.cos(w) * r * 0.99;
      const ay = cy + Math.sin(w) * r * 0.99;
      g.fillStyle = farbe;
      g.beginPath();
      g.moveTo(ax, ay);
      g.lineTo(cx + Math.cos(w - 0.08) * r * 1.16, cy + Math.sin(w - 0.08) * r * 1.16);
      g.lineTo(cx + Math.cos(w + 0.08) * r * 1.16, cy + Math.sin(w + 0.08) * r * 1.16);
      g.closePath();
      g.fill();
    });
    // Die Nadel.
    const w = tachoWinkel(state.tacho);
    g.strokeStyle = "rgba(40, 20, 20, 0.3)";
    g.lineCap = "round";
    g.lineWidth = Math.max(2, r * 0.07);
    g.beginPath();
    g.moveTo(cx + 1.5, cy + 2);
    g.lineTo(cx + Math.cos(w) * r * 0.8 + 1.5, cy + Math.sin(w) * r * 0.8 + 2);
    g.stroke();
    g.strokeStyle = "rgb(200, 40, 40)";
    g.lineWidth = Math.max(1.6, r * 0.055);
    g.beginPath();
    g.moveTo(cx - Math.cos(w) * r * 0.15, cy - Math.sin(w) * r * 0.15);
    g.lineTo(cx + Math.cos(w) * r * 0.82, cy + Math.sin(w) * r * 0.82);
    g.stroke();
    g.setTransform(1, 0, 0, 1, 0, 0);
    const d = view.dpr;
    g.drawImage(ebenen.tachoNabe, Math.round((cx - r * 0.14) * d), Math.round((cy - r * 0.14) * d));
    // Die Zahlen: das Tempo jetzt im Fenster unten, auf dem Schild Faktor,
    // Ø und Punkte – je als kleines Bild, neu gemalt nur, wenn sich ein
    // Text ändert (Schrift setzen ist teuer, und sie ändert sich selten).
    const f = laeuft ? faktorBei(state.weiteste, t) : 1;
    const zahl = zahlText(state.tacho);
    if (ebenen.tachoZahlText !== zahl) {
      ebenen.tachoZahlText = zahl;
      const k = ebenen.tachoZahl.getContext("2d");
      k.setTransform(d, 0, 0, d, 0, 0);
      k.clearRect(0, 0, r * 1.2, r * 0.5);
      k.textAlign = "center";
      k.textBaseline = "middle";
      k.fillStyle = "rgb(60, 36, 36)";
      k.font = `900 ${Math.round(r * 0.3)}px system-ui, sans-serif`;
      k.fillText(zahl, r * 0.6, r * 0.25);
    }
    g.drawImage(ebenen.tachoZahl, Math.round((cx - r * 0.6) * d), Math.round((cy + r * 0.22) * d));
    const schild = `${zahlText(f, 2)}|${zahlText(schnitt)}|${state.punkte}`;
    if (ebenen.tachoSchildText !== schild) {
      ebenen.tachoSchildText = schild;
      const k = ebenen.tachoSchild.getContext("2d");
      k.setTransform(d, 0, 0, d, 0, 0);
      k.clearRect(0, 0, m.b, m.schildH);
      const sy = m.schildH / 2;
      k.textBaseline = "middle";
      k.fillStyle = f > 1.005 ? "rgb(170, 70, 20)" : "rgb(90, 66, 50)";
      k.textAlign = "left";
      k.font = `900 ${Math.round(r * 0.34)}px system-ui, sans-serif`;
      const faktorText = `×${zahlText(f, 2)}`;
      k.fillText(faktorText, r * 0.2, sy + r * 0.01);
      // Rechts Ø und Punkte – bei vielen Stellen etwas kleiner, damit
      // nichts in den Faktor läuft.
      const rechts = m.b - r * 0.18;
      const platz = rechts - (r * 0.2 + k.measureText(faktorText).width + r * 0.12);
      k.textAlign = "right";
      k.fillStyle = "rgb(80, 56, 44)";
      [[`Ø ${zahlText(schnitt)} km/h`, 0.18, 700, sy - r * 0.16], [`${state.punkte} Punkte`, 0.21, 800, sy + r * 0.17]].forEach(([text, gross, dick, y]) => {
        let px = Math.round(r * gross);
        k.font = `${dick} ${px}px system-ui, sans-serif`;
        const breit = k.measureText(text).width;
        if (breit > platz) {
          px = Math.max(8, Math.floor((px * platz) / breit));
          k.font = `${dick} ${px}px system-ui, sans-serif`;
        }
        k.fillText(text, rechts, y);
      });
    }
    g.drawImage(ebenen.tachoSchild, Math.round(x0 * d), Math.round((y0 + m.schildY) * d));
    g.setTransform(d, 0, 0, d, 0, 0);
  }

  // Die Nabe der Nadel, einmal gemalt.
  function tachoNabeBild(r) {
    const c = leinwand(r * 0.28, r * 0.28);
    const k = c.getContext("2d");
    k.scale(view.dpr, view.dpr);
    const n = r * 0.14;
    const nabe = k.createRadialGradient(n - r * 0.03, n - r * 0.03, 0, n, n, r * 0.12);
    nabe.addColorStop(0, "rgb(255, 230, 160)");
    nabe.addColorStop(1, "rgb(140, 90, 30)");
    k.fillStyle = nabe;
    k.beginPath();
    k.arc(n, n, r * 0.12, 0, TAU);
    k.fill();
    return c;
  }
  // ---------------------------------------------------------------------------
  // Der Luftstoss
  // ---------------------------------------------------------------------------
  // Ein Tipp an (fx, fy) in der Welt. Gibt zurück, wie stark er war.
  function stoss(fx, fy) {
    const b = state.blase;
    const dx = b.x - fx;
    const dy = b.y - fy;
    const d = Math.hypot(dx, dy);
    if (d < BERUEHRT) {
      platzen({ art: "finger" });
      return 0;
    }
    const j = stossBei(d);
    state.stoesse += 1;
    const w = Math.atan2(fy - b.y, fx - b.x);
    state.letzterStoss = { w, d };
    stossZeigen(fx, fy, j);
    if (j <= 0.01) return 0;
    b.vx += (dx / d) * j;
    b.vy += (dy / d) * j;
    // Sie wabert: in der Richtung des Stosses gestaucht, je stärker, desto mehr.
    b.ww = Math.atan2(dy, dx);
    b.wa = Math.min(0.14, b.wa * Math.exp(-b.wt / 0.45) * 0.6 + (j / J0) * 0.1);
    b.wt = 0;
    klang()?.ton?.("seifenblase.pusten", { laut: 0.25 + 0.5 * (j / J0), hoehe: 0.9 + 0.3 * (j / J0) });
    kids()?.vibrate?.(4);
    return j;
  }

  function stossZeigen(fx, fy, j) {
    if (ruhig()) return;
    const b = state.blase;
    state.stossBilder.push({ fx, fy, bx: b.x, by: b.y, kraft: j, zeit: 0 });
    if (state.stossBilder.length > 6) state.stossBilder.shift();
  }

  // ---------------------------------------------------------------------------
  // Platzen
  // ---------------------------------------------------------------------------
  function platzen(was, nurBild = false) {
    if (state.schritt === "geplatzt") return;
    const b = state.blase;
    state.schritt = "geplatzt";
    state.geplatzt = { ...was, zeit: 0, x: b.x, y: b.y };
    klangAus();
    // Ein Ring aus feinsten Tröpfchen, ein Blitz, ein Nachhall.
    if (!ruhig()) {
      for (let i = 0; i < 72; i += 1) {
        const w = (i / 72) * TAU + Math.random() * 0.1;
        const v = 50 + Math.random() * 110;
        const leben = 0.35 + Math.random() * 0.45;
        const c = ["rgb(255, 255, 255)", "rgb(170, 236, 255)", "rgb(255, 190, 240)", "rgb(255, 246, 170)", "rgb(190, 255, 200)"][i % 5];
        state.teile.push({ art: "troepfchen", x: b.x + Math.cos(w) * R, y: b.y + Math.sin(w) * R, vx: Math.cos(w) * v + b.vx * 0.3, vy: Math.sin(w) * v + b.vy * 0.3, leben, max: leben, farbe: c });
      }
      for (let i = 0; i < 10; i += 1) {
        const w = Math.random() * TAU;
        const leben = 0.6 + Math.random() * 0.5;
        state.teile.push({ art: "fetzen", x: b.x + Math.cos(w) * R * 0.8, y: b.y + Math.sin(w) * R * 0.8, vx: Math.cos(w) * 20, vy: Math.sin(w) * 20 + 10, w, leben, max: leben, farbe: ["#ff9ad5", "#9ae6ff", "#fff09a", "#b8ff9a"][i % 4] });
      }
      state.teile.push({ art: "blitz", x: b.x, y: b.y, r: 30, vx: 0, vy: 0, leben: 0.2, max: 0.2 });
      state.teile.push({ art: "ring", x: b.x, y: b.y, r: R, wachs: 60, vx: 0, vy: 0, leben: 0.45, max: 0.45, kraft: 1 });
      state.teile.push({ art: "ring", x: b.x, y: b.y, r: R * 0.6, wachs: 34, warte: 0.32, vx: 0, vy: 0, leben: 0.6, max: 0.6, kraft: 0.45 });
    }
    klang()?.ton?.("seifenblase.platzen", { laut: 0.9, hoehe: 1.3 });
    klang()?.ton?.("seifenblase.nachhall", { laut: 0.35, verzoegerung: 0.3 });
    if (was.art === "tropfen" || was.art === "nebel") klang()?.ton?.("seifenblase.tropfen", { laut: 0.5 });
    kids()?.vibrate?.([20, 30, 50]);
    if (nurBild) return;
    if (state.phase === "spiel") {
      // Woran sie zerplatzt ist, steht als Letztes in der Aufzeichnung.
      gegner?.takt(state.punkte, { a: Math.round(b.x * 4), b: Math.round(b.y * 2), c: -(1 + Math.max(0, ARTEN.indexOf(was.art))) });
    }
    stepTimer = window.setTimeout(finish, ruhig() ? 900 : STURZ_MS);
  }
  const ARTEN = ["rand", "nebel", "finger", "tisch", "schwalbe", "segler", "fetzen"];

  // ---------------------------------------------------------------------------
  // Die Physik
  // ---------------------------------------------------------------------------
  // Sie gleicht sich der Luft an (Auftrieb, Rückenwind, Böe), fliegt, und
  // dann wird nachgesehen: der weiteste Punkt auf der Bahn und die Punkte,
  // der Rand, der Tisch, was sich bewegt, der Nebel.
  function physik(dt) {
    const b = state.blase;
    const n = Math.max(1, Math.ceil(dt / TAKT - 1e-9));
    const h = dt / n;
    for (let i = 0; i < n; i += 1) {
      if (state.schritt === "geplatzt") return;
      const l = stroemung(b.i);
      b.vx += (l.x - b.vx) * (h / TAU_X);
      b.vy += (l.y - b.vy) * (h / TAU_Y);
      b.x += b.vx * h;
      b.y += b.vy * h;
      state.t += h;
      b.wt += h;
      const q = naechster(b.x, b.y, b.i);
      b.i = q.i;
      // Die Punkte zuerst: Auch der Schritt, in dem sie zerplatzt, zählt –
      // so passen sie genau zu Strecke und Zeit auf der Tafel.
      if (q.s > state.weiteste) state.weiteste = q.s;
      const punkte = punkteBei(state.weiteste, state.t);
      if (punkte !== state.punkte) {
        state.punkte = punkte;
        shell.setCount(punkte);
      }
      const o = trifft(b.x, b.y, state.t, RH, q);
      if (o) { platzen(o); return; }
      if (q.s < nebelS(state.t)) { platzen({ art: "nebel" }); return; }
    }
  }

  /*
   * Ein Tipp an der Stelle (sx, sy) des Bildes (CSS-Pixel) – zu der Zeit, zu
   * der er geschah (jetzt, wie performance.now). Der Ort zählt, wie er im
   * letzten Bild war: Dorthin hat der Finger gezielt.
   */
  function tippen(jetzt, sx = bildX(state.blase.x), sy = bildY(state.blase.y) + 30 * view.s) {
    const x = view.camBild.x + (sx - view.mx) / view.s;
    const y = view.camBild.y - (sy - view.my) / view.s;
    return tippeWelt(x, y, jetzt);
  }

  function tippeWelt(x, y, jetzt) {
    if (state.phase === "zuschauen" || state.phase === "ende") return 0;
    if (state.phase === "bereit") {
      losGehts();
      // Der erste Tipp startet – und bläst schon, wenn er die Blase nicht trifft.
      if (Math.hypot(x - state.blase.x, y - state.blase.y) < R * 1.4) return 0;
    }
    if (state.phase !== "spiel" || state.schritt === "geplatzt") return 0;
    if (Number.isFinite(jetzt) && last) {
      const mehr = clamp((jetzt - last) / 1000 - voraus, 0, 0.05);
      if (mehr > 0) {
        physik(mehr);
        voraus += mehr;
      }
      if (state.schritt === "geplatzt") return 0;
    }
    return stoss(x, y);
  }

  /*
   * Der Autopilot: wohin er tippen würde, um die Bahn entlang zu fliegen
   * (für die Prüfung und die Vorführung). Er schaut, wo die Blase in «vor»
   * Sekunden ist (wenn sein Tipp ankommt), und will dann in der Richtung,
   * die die Bahn bis zum nächsten Tipp im Mittel hat, so schnell sein wie der
   * Zeitplan (und holt auf, was ihm fehlt) – der Raser so schnell wie
   * «raser», in Kurven nur so schnell, wie er um sie herum kommt. Quer will
   * er zur Mitte (in «zeit» Sekunden). Bis zum nächsten Tipp zieht die Luft
   * das Tempo zu sich: So viel mehr muss der Stoss geben. Er tippt so nah,
   * dass es genau der fehlende Unterschied ist.
   */
  const A_KURVE = 260;             // so stark kann er in einer Kurve umlenken (cm/s²)
  function pilot({ abstand = 0.1, vor = 0.02, zeit = 0.3, maxJ = J0 * 0.97, raser = 0, kurve = A_KURVE } = {}) {
    const b = state.blase;
    if (state.phase !== "spiel" || state.schritt !== "flug") return null;
    if (state.t < state.pilotBis) return null;
    const B = state.bahn;
    const px = b.x + b.vx * vor;
    const py = b.y + b.vy * vor;
    const q = naechster(px, py, b.i);
    const ip = q.i;
    const sp = q.s;
    // Wie schnell er die Bahn entlang will.
    let vSoll;
    if (raser > 0) {
      let kMax = 0;
      const bis = Math.min(B.x.length - 1, ip + Math.round((raser * 0.7) / DS));
      for (let i = ip; i <= bis; i += 2) kMax = Math.max(kMax, Math.abs(B.k[i]));
      vSoll = kMax > 0 ? Math.min(raser, Math.sqrt(kurve / kMax)) : raser;
    } else {
      vSoll = vRef(state.t + vor) + (sRef(state.t + vor) - sp) / (zeit + 0.3);
    }
    // Der Raser passt ab, was die Bahn vor ihm kreuzt: das schnellste Tempo,
    // bei dem es weg ist, wenn er kommt.
    if (raser > 0) vSoll = abpassen(sp, vSoll);
    vSoll = clamp(vSoll, 12, 260);
    // Die Richtung: die der Bahn in der Mitte bis zum nächsten Tipp.
    const iv = Math.min(B.x.length - 1, ip + Math.round((vSoll * abstand * 0.5) / DS));
    const tx = B.tx[iv];
    const ty = B.ty[iv];
    // Quer zur Mitte.
    const nx = -B.ty[ip];
    const ny = B.tx[ip];
    const quer = (px - B.x[ip]) * nx + (py - B.y[ip]) * ny;
    const vx = tx * vSoll - (nx * quer) / zeit;
    const vy = ty * vSoll - (ny * quer) / zeit;
    const l = stroemung(b.i);
    const mittel = (TAU_X / abstand) * (1 - Math.exp(-abstand / TAU_X));
    const dvx = l.x + (vx - l.x) / mittel - b.vx;
    const dvy = l.y + (vy - l.y) / mittel - b.vy;
    const betrag = Math.hypot(dvx, dvy);
    if (betrag < 4) return null;
    const d = abstandFuer(Math.min(betrag, maxJ));
    state.pilotBis = state.t + abstand;
    const dx = -(dvx / betrag) * d;
    const dy = -(dvy / betrag) * d;
    return { x: b.x + dx, y: b.y + dy, dx, dy };
  }

  function abpassen(sp, vSoll) {
    const B = state.bahn;
    const vor = state.beweger.filter((m) => m.s1 > sp && m.s0 < sp + 260);
    if (!vor.length) return vSoll;
    for (const f of [1, 0.8, 0.62, 0.45]) {
      const v = vSoll * f;
      const frei = vor.every((m) => m.punkte.every((i) => {
        const ds = i * DS - sp;
        if (ds < -20) return true;
        const t = state.t + Math.max(0, ds) / v;
        const w = B.w[i] - R;
        for (let q = -1; q <= 1; q += 1) {
          for (let o = -w; o <= w + 0.1; o += w / 2) if (bewegerTrifft(m, B.x[i] - B.ty[i] * o, B.y[i] + B.tx[i] * o, t + q * 0.15, RH + 1)) return false;
        }
        return true;
      }));
      if (frei) return v;
    }
    return vSoll * 0.45;
  }

  // ---------------------------------------------------------------------------
  // Zuschauen
  // ---------------------------------------------------------------------------
  function zuschauenStarten() {
    if (!zuschauer?.lauf) return;
    startRun();
    state.phase = "zuschauen";
    state.schritt = "flug";
    state.t = 0;
    shell.setPhase("play");
    zuschauer.los();
    klangAn();
  }

  // Sie steht, wo die Aufzeichnung sie hat (a: x in Vierteln, b: y in
  // Halben, c: die Luftstösse und woher der letzte kam; am Schluss negativ,
  // woran sie zerplatzt ist).
  function zuschauenTakt(dt) {
    const st = zuschauer.stand();
    if (!st) return;
    const b = state.blase;
    if (state.schritt !== "geplatzt") {
      state.t = Math.max(state.t, st.t / 1000);
      b.x = st.a / 4;
      b.y = st.b / 2;
      b.vx = st.va / 4;
      b.vy = st.vb / 2;
      b.wt += dt;
      planBis(Math.max(b.i * DS + 900, sRef(state.t + 8) + 400), 2);
      const q = naechster(b.x, b.y, b.i);
      b.i = q.i;
      if (q.s > state.weiteste) state.weiteste = q.s;
      const c = Math.round(st.c || 0);
      let punkte = Math.max(0, Math.floor(st.punkte));
      if (c < 0) {
        platzen({ art: ARTEN[-c - 1] || "rand" }, true);
        // Das Platzen erscheint schon auf halbem Weg zur letzten Probe, die
        // Punkte stehen dort noch einen Schritt zurück – also die letzten.
        const lauf = zuschauer.lauf;
        if (lauf?.wert) punkte = Math.max(punkte, Math.floor(lauf.wert(lauf.dauer)));
      } else {
        const zahl = Math.floor(c / 1024);
        while (state.stoesse < zahl) {
          state.stoesse += 1;
          // Woher der Finger kam: Richtung und Abstand.
          const w = ((Math.floor(c / 32) % 32) / 32) * TAU;
          const d = (c % 32) * 3 + R;
          const fx = b.x + Math.cos(w) * d;
          const fy = b.y + Math.sin(w) * d;
          const j = stossBei(d);
          stossZeigen(fx, fy, j);
          b.ww = Math.atan2(-Math.sin(w), -Math.cos(w));
          b.wa = Math.min(0.14, (j / J0) * 0.1);
          b.wt = 0;
          klang()?.ton?.("seifenblase.pusten", { laut: 0.2 + 0.4 * (j / J0) });
        }
      }
      if (punkte !== state.punkte) {
        state.punkte = punkte;
        shell.setCount(punkte);
      }
      klangStellen();
    }
    if (!zuschauer.weiter() && state.schritt !== "geplatzt") {
      platzen(trifft(b.x, b.y, state.t, RH + 3) || { art: "rand" }, true);
    }
  }

  // ---------------------------------------------------------------------------
  // Der Takt
  // ---------------------------------------------------------------------------
  // Eine neue Figur: Eine besondere wird vorher angesagt; eine neue
  // Stimmung bekommt ihren Namen.
  function abschnittPruefen() {
    const b = state.blase;
    const st = stimmungBei(b.i * DS);
    if (st !== state.stimmung) {
      state.stimmung = st;
      schrift(STIMMUNGEN[st].name, "#fff6e0", 26, 2.4);
      klang()?.ton?.("seifenblase.welt", { laut: 0.7 });
    }
    const f = figurBei(b.i);
    if (!f || f.nr === state.figur) return;
    state.figur = f.nr;
    const naechste = state.figuren[f.nr + 1];
    if (naechste?.besonders === "rueckenwind") {
      ansage("Rückenwind voraus", "Er trägt dich die Bahn entlang – rasen!", "#ffd79a", 2.4);
      klang()?.ton?.("seifenblase.ansage", { laut: 0.7 });
    } else if (naechste?.besonders === "boee") {
      ansage(naechste.wind?.w > 0 ? "Böe von links" : "Böe von rechts", "Tippe von der Windseite dagegen", "#cfe8ff", 2.4);
      klang()?.ton?.("seifenblase.ansage", { laut: 0.7 });
    }
    if (f.besonders === "rueckenwind") klang()?.ton?.("seifenblase.aufwind", { laut: 0.6 });
    if (f.besonders === "boee") klang()?.ton?.("seifenblase.boee", { laut: 0.7 });
  }

  function takt(dt, strecke = dt) {
    state.zeit += dt;
    const b = state.blase;
    if (state.ansage) { state.ansage.leben -= dt; if (state.ansage.leben <= 0) state.ansage = null; }
    if (state.intro) {
      state.intro.t += dt;
      if (state.intro.t >= state.intro.dauer) {
        state.intro = null;
        host.dataset.intro = "aus";
      }
    }

    if (state.phase === "zuschauen") {
      zuschauenTakt(dt);
      abschnittPruefen();
    } else if (state.phase === "spiel" && state.schritt !== "geplatzt") {
      if (strecke > 0) physik(strecke);
      if (state.schritt !== "geplatzt") abschnittPruefen();
      klangStellen();
    }
    if (state.geplatzt) state.geplatzt.zeit += dt;

    for (let i = state.stossBilder.length - 1; i >= 0; i -= 1) {
      state.stossBilder[i].zeit += dt;
      if (state.stossBilder[i].zeit > 0.45) state.stossBilder.splice(i, 1);
    }
    for (let i = state.teile.length - 1; i >= 0; i -= 1) {
      const t = state.teile[i];
      if (t.warte > 0) { t.warte -= dt; continue; }
      if (t.art === "ring") t.r += t.wachs * dt;
      t.vx *= 1 - 2.2 * dt;
      t.vy = t.vy * (1 - 2.2 * dt) - (t.art === "troepfchen" ? 60 : 12) * dt;
      t.x += t.vx * dt;
      t.y += t.vy * dt;
      t.leben -= dt;
      if (t.leben <= 0) state.teile.splice(i, 1);
    }
    for (let i = state.schriften.length - 1; i >= 0; i -= 1) {
      state.schriften[i].leben -= dt;
      if (state.schriften[i].leben <= 0) state.schriften.splice(i, 1);
    }
    // Die Nadel des Tachos folgt dem Tempo die Bahn entlang, gedämpft.
    const kmh = state.schritt === "geplatzt" || state.phase === "bereit" ? 0 : Math.max(0, tempoEntlang()) * KMH;
    state.tacho += (kmh - state.tacho) * (1 - Math.exp(-dt * 6));
    // Der Abend schreitet mit dem Weg voran (geglättet).
    state.himmel += (b.i * DS - state.himmel) * (1 - Math.exp(-dt * 1.5));

    // Die Kamera folgt dem Blickpunkt vor der Blase.
    if (state.schritt !== "geplatzt") {
      const ziel = blickZiel();
      const k = state.phase === "bereit" ? 1 : 1 - Math.exp(-dt * 3.2);
      state.cam.x += (ziel.x - state.cam.x) * k;
      state.cam.y += (ziel.y - state.cam.y) * k;
      // Nie so, dass sie unter die Knöpfe oben gerät oder aus dem Bild.
      const sy = bildY(b.y);
      if (sy < view.frei + 30) state.cam.y += (view.frei + 30 - sy) / view.s;
      if (sy > view.cssH - 20) state.cam.y -= (sy - view.cssH + 20) / view.s;
      const sx = bildX(b.x);
      if (sx < 20) state.cam.x -= (20 - sx) / view.s;
      if (sx > view.cssW - 20) state.cam.x += (sx - view.cssW + 20) / view.s;
      // Und nie unter den Tacho.
      const o = tachoOrt();
      const rb = R * view.s + 10;
      if (sx < o.x + o.b + rb && sy > o.y - rb) state.cam.y -= (sy - o.y + rb) / view.s;
    }
    planBis(Math.max(b.i * DS + 900, sRef(state.t + 8) + 400), 1);

    if (state.phase === "spiel" && state.schritt !== "geplatzt") {
      const ls = state.letzterStoss;
      const c = state.stoesse * 1024 + (ls ? (((Math.round((ls.w / TAU) * 32) % 32) + 32) % 32) * 32 + clamp(Math.round((ls.d - R) / 3), 0, 31) : 0);
      gegner?.takt(state.punkte, { a: Math.round(b.x * 4), b: Math.round(b.y * 2), c });
    }
  }

  function loop(now) {
    frame = window.requestAnimationFrame(loop);
    // Der erste Takt nach dem Start kann vor dem Start liegen (der Zeitstempel
    // des Bildes ist älter) – dann eben null.
    const dt = clamp((now - last) / 1000, 0, 0.05);
    last = Math.max(last, now);
    const strecke = Math.max(0, dt - voraus);
    voraus = 0;
    messen();
    takt(dt, strecke);
    view.camBild = { x: state.cam.x, y: state.cam.y };
    zeichnen();
  }

  // Die Runde beginnt: mit dem ersten Tipp – oder im Live-Modus zum
  // gemeinsamen Start.
  function losGehts() {
    if (state.phase !== "bereit") return;
    state.phase = "spiel";
    state.schritt = "flug";
    state.t = 0;
    state.blase.vy = AUFTRIEB;
    if (state.intro) { state.intro = null; host.dataset.intro = "aus"; }
    shell.setPhase("play");
    gegner?.los();
    klangAn();
    kids()?.vibrate?.(8);
  }

  // ---------------------------------------------------------------------------
  // Ablauf
  // ---------------------------------------------------------------------------
  function schrift(text, farbe, gross = 24, dauer = 1.6) {
    state.schriften = [{ text, farbe, gross, leben: dauer, max: dauer }];
  }

  function ansage(text, unter, farbe = "#ffffff", dauer = 2.2) {
    state.ansage = { text, unter, farbe, leben: dauer, max: dauer };
  }

  function startRun() {
    clearStep();
    stopLoop();
    klangAus();
    shell.closeOverlay();
    zufall.neu();
    shell.setPhase("intro");
    state.phase = "bereit";
    state.schritt = "start";
    state.punkte = 0;
    state.weiteste = 0;
    state.tacho = 0;
    state.t = 0;
    state.zeit = 0;
    state.himmel = 0;
    state.blase = { x: 0, y: 0, vx: 0, vy: AUFTRIEB, ww: 0, wa: 0, wt: 9, i: 0 };
    state.stoesse = 0;
    state.letzterStoss = null;
    state.geplatzt = null;
    state.teile = [];
    state.stossBilder = [];
    state.schriften = [];
    state.ansage = null;
    state.pilotBis = 0;
    weltNeu();
    if (ebenen) ebenen.fetzen = new Map();
    voraus = 0;
    shell.setCount(0);
    gegner?.runde();

    // Beim ersten Start wächst die Blase erst aus dem Ring.
    state.intro = ersterStart && !zuschauer && !shell.live && !ruhig() ? { t: 0, dauer: 2.6 } : null;
    ersterStart = false;
    host.dataset.intro = state.intro ? "an" : "aus";

    shell.clear();
    const prompt = shell.el("p", "cm-prompt sb-prompt", "Tippe neben die Blase – der Luftstoss treibt sie vom Finger weg. Bleib in der Bahn!");
    shell.play.append(prompt, buildPlatz());
    const ziel = blickZiel();
    state.cam = { x: ziel.x, y: ziel.y };
    view.camY0 = ziel.y;
    view.camBild = { x: ziel.x, y: ziel.y };
    view.cssW = 0;
    view.cssH = 0;
    messen();

    last = performance.now();
    frame = window.requestAnimationFrame(loop);
  }

  function zaehleHoch(ziel) {
    const zahl = host.querySelector(".cm-result-score");
    if (!zahl) return;
    if (ruhig() || ziel <= 1) { zahl.textContent = String(ziel); return; }
    const dauer = Math.min(900, 160 + ziel * 8);
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
  const WARUM = {
    rand: "Am Rand der Bahn zerplatzt",
    nebel: "Vom Nebel eingeholt",
    finger: "Mit dem Finger berührt",
    tisch: "Auf dem Gartentisch zerplatzt",
    schwalbe: "Eine Schwalbe flog hindurch",
    segler: "Ein Mauersegler flog hindurch",
    fetzen: "In einen Wolkenfetzen geraten",
  };
  const warumText = (was) => (was ? WARUM[was.art] || "" : "");

  function finish() {
    clearStep();
    stopLoop();
    klangAus();
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
    const warum = warumText(state.geplatzt);
    // Wie die Punkte zustande kamen: Strecke, Zeit, Ø-Tempo und Faktor.
    const t = Math.max(0.1, state.t);
    const rechnung = `${zahlText(state.weiteste / METER)} m Bahn in ${Math.round(t)} s · Ø ${zahlText((state.weiteste / t) * KMH)} km/h · ×${zahlText(faktorBei(state.weiteste, t), 2)}`;
    shell.showResult({
      label: "Deine Punkte",
      points: punkte,
      detail: rekord ? `Neuer Rekord! · ${rechnung}` : `${warum ? `${warum} · ` : ""}${rechnung}`,
      geist,
    });
    if (rekord) host.querySelector(".cm-result-detail")?.classList.add("sb-rekord");
    zaehleHoch(punkte);
  }

  // ---------------------------------------------------------------------------
  // Start
  // ---------------------------------------------------------------------------
  shell = shellApi.mount({
    host,
    title: "Seifenblase",
    area: "geschwindigkeit",
    accent: "#F5A623",
    accentDark: "#b9741a",
    clock: false,
    onRestart: () => (zuschauer ? zuschauenStarten() : startRun()),
    live: { los: losGehts, stopp: () => finish(), zuschauen: (quelle) => { zuschauer = quelle; zuschauenStarten(); } },
  });
  zuschauer = window.LernappGeist?.zuschauer?.({
    host, spiel: "soapBubble", fassung: "t3", zufall, einheit: "Punkte", nochmal: zuschauenStarten,
  }) || null;
  if (!zuschauer) {
    gegner = window.LernappGeist?.fuer?.({ spiel: "soapBubble", host, art: "tempo", fassung: "t3", alle: true, zufall }) || null;
  }

  startRun();
  zuschauer?.laden.then((da) => { if (da) zuschauenStarten(); });

  // Ein Tipp irgendwo aufs Bild: Von dort kommt der Luftstoss. Nur Knöpfe
  // bleiben Knöpfe.
  host.addEventListener("pointerdown", (event) => {
    if (event.target.closest("button, a, input")) return;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width) return;
    const t = Math.abs(performance.now() - event.timeStamp) < 250 ? event.timeStamp : performance.now();
    tippen(t, (event.clientX - rect.left) * (view.cssW / rect.width), (event.clientY - rect.top) * (view.cssH / rect.height));
  });

  // Mit der Tastatur: ein Stoss aus mittlerem Abstand – ← schiebt nach
  // links, → nach rechts, ↑ und Leertaste hinauf, ↓ bremst.
  const TASTEN = { ArrowLeft: [1, 0], ArrowRight: [-1, 0], ArrowUp: [0, -1], " ": [0, -1], Enter: [0, -1], ArrowDown: [0, 1] };
  document.addEventListener("keydown", (event) => {
    const r = TASTEN[event.key];
    if (!r) return;
    if (document.activeElement?.tagName === "BUTTON") return;
    event.preventDefault();
    if (event.repeat) return;
    const b = state.blase;
    tippeWelt(b.x + r[0] * 24, b.y + r[1] * 24, performance.now());
  });

  window.addEventListener("resize", messen);
  window.addEventListener("orientationchange", messen);
  window.addEventListener("pagehide", () => { clearStep(); stopLoop(); klangAus(); });
  // Für die Prüfskripte und die Vorführung. tippeWelt(x, y) nimmt
  // Weltkoordinaten, tippen(jetzt, sx, sy) CSS-Pixel der Leinwand.
  window.LernappSeifenblase = {
    METER, R, RH, J0, D0, DMAX, BERUEHRT, TAU_X, TAU_Y, AUFTRIEB, DS, SICHT, HINDERNIS_AB, FASSUNG, STIMMUNGEN, state, view,
    takt, tippen, tippeWelt, losGehts, physik, planBis, kursText, trifft, naechster, sVon, stroemung, figurBei, tempoEntlang,
    vRef, sRef, tRef, nebelS, breiteBei, rhoBei, luftBei, stossBei, abstandFuer, pilot, faktorBei, punkteBei, KMH, tachoOrt, bildX, bildY,
    bewegerOrt, bewegerTrifft, stimmungBei, bahnLaenge,
  };
})();
