/*
 * marsrover.js – Marsrover.
 * ---------------------------------------------------------------------------
 * Abend auf dem Mars. Ein Rover fährt von selbst über die Ebene, von der
 * Seite gesehen, nach rechts – über Krater, Spalten und Felsen. Eine Regel:
 * Ein Tipp funkt «Springen» von der Erde. Aber der Befehl braucht Zeit bis
 * zum Mars, und der Rover springt erst, wenn das Signal ankommt – immer im
 * selben Bogen. Wer tippt, wenn das Hindernis da ist, ist zu spät: Man muss
 * vorausdenken.
 *
 * Die Verzögerung wächst mit der Strecke («der Mars entfernt sich»), in
 * Stufen von 0,05 s: am Start 0,25 s, nach einer Minute gut 0,8 s. Sie steht
 * oben im Bild, und wenn sie wächst, blinkt sie und klingt. Mehrere Befehle
 * dürfen zugleich unterwegs sein; trifft einer ein, während der Rover in der
 * Luft ist, verpufft er. Beim Tipp erscheint auf dem Boden eine dezente
 * Marke, wo der Sprung beginnen wird – eine Rückmeldung nach dem Entschluss,
 * kein Zielen: Ein Befehl lässt sich nicht zurückholen.
 *
 * Die Hindernisse: Krater (überspringen), Felsen (überspringen) und
 * Felsbögen, unter denen man nicht springen darf – wer es tut, prallt an.
 * Später kommen sie zu zweit und zu dritt kurz hintereinander, und ein Bogen
 * steht gleich vor oder hinter einem Krater (die Zange). Jeder achte
 * Abschnitt ist besonders, im festen Wechsel: ein Funkschatten (Phobos
 * steht vor der Erde, das Signal braucht 0,3 s länger – man sieht ihn
 * kommen) oder eine Schlucht mit Felsinseln, über die es in zwei, später drei
 * Sprüngen geht. Beides wird vorher angesagt. Gezählt werden die Meter.
 *
 * Gebaut wird die Strecke aus dem Zufall (zufall.js): ohne Turnier jedes Mal
 * eine andere, im Turnier für alle im selben Versuch dieselbe. Alles hängt
 * nur an der Spielzeit seit dem Start: Der Rover fährt immer gleich schnell
 * (xBei), ob er springt oder nicht. Sie ist immer zu schaffen, weil zuerst
 * ein Weg entsteht – Abschnitt um Abschnitt, wann er abspringt
 * (naechsterAbschnitt) – und dann die Hindernisse um ihn herum, so gross,
 * dass jeder Sprung bis zu «luft» zu früh oder zu spät noch gelingt. Jeder
 * Abschnitt wird nachgeprüft (sicher): alle Ecken der Luft, auch über den
 * Sprung davor hinweg.
 *
 * Ein Tipp gilt zu seiner Zeit, nicht erst im nächsten Bild (tippen, voraus).
 *
 * Das Bild: ein Marsabend. Der Himmel ochsenblut bis butterscotch, um die
 * tief stehende Sonne blau, wie es auf dem Mars ist; darüber die Erde als
 * heller blauer Punkt mit dem Mond, Phobos und Deimos. Am Horizont der
 * Olympus Mons, davor Tafelberge, Dünen, die Ebene und nahe Felsen – jede
 * Ebene einmal gemalt und dann nur noch aufgelegt, Punkt auf Punkt (auf dem
 * iPhone rechnet der Prozessor jede gemalte Fläche, jedes Bild). Je Bild
 * kommen der Rover, die Hindernisse, die Funksignale und der Staub dazu.
 * Beim ersten Start gleitet die Kamera vom Sternenhimmel mit der Erde
 * hinunter zum Rover.
 *
 * Die Gegner (geist.js) fahren als Rover aus Licht mit, und die besten Läufe
 * lassen sich anschauen (?zuschauen=): auf derselben Strecke, gebaut mit
 * derselben Saat.
 *
 * Zehn Einheiten sind ein Meter. x zählt voraus, y nach oben; der Boden der
 * Strecke liegt bei null.
 */
(() => {
  "use strict";

  if (document.body.dataset.page !== "marsrover") return;

  const host = document.querySelector("#mr-stage");
  const shellApi = window.LernappGameShell;
  const cloudApi = window.LernappGameCloud;
  if (!host || !shellApi) return;

  const kids = () => window.LernappKids || null;
  const klang = () => window.ArcadeKlang || null;
  const ruhig = () => Boolean(kids()?.prefersReducedMotion?.());

  // Der Zufall. Nur die Strecke zieht daraus – der Weg und die Hindernisse.
  // Staub, Steinchen am Boden und was aufstiebt hängen an festen Zahlen
  // oder an Math.random.
  const zufall = window.LernappZufall?.fuer?.("marsRover") || {
    neu() {},
    zahl: () => Math.random(),
  };

  // ---------------------------------------------------------------------------
  // Die Regeln
  // ---------------------------------------------------------------------------
  const METER = 10;
  const LH = 12.5;                 // halbe Länge des Rovers, von Rad zu Rad
  const TOP = 27;                  // so hoch ragt der Mast über den Boden
  const RAND = 4;                  // so weit darf seine Mitte über einen Kraterrand
  // Der Sprung: immer derselbe Bogen, SPRUNG Sekunden lang, HOCH hoch.
  const SPRUNG = 0.68;
  const HOCH = 42;
  // Unter einem Felsbogen: Die Unterkante liegt DECKE über dem Boden – wer
  // dort mehr als DECKE − TOP abhebt, stösst mit dem Mast an.
  const DECKE = TOP + 6;
  // Das Tempo nach der Spielzeit: von 13 Metern in der Sekunde auf bald 18;
  // in den ersten ANFAHRT Sekunden fährt er an.
  const V0 = 130;
  const V_MAX = 185;
  const V_ZEIT = 55;
  const ANFAHRT = 0.6;
  // Die Verzögerung des Funks: am Start 0,25 s, ab VERZUG_AB Sekunden
  // wachsend, in Stufen von 0,05 s, gegen VERZUG_MAX – nach 30 s 0,6, nach
  // einer Minute 0,8, nach anderthalb 0,95. Im Funkschatten SCHATTEN mehr,
  // aber nie über SCHATTEN_MAX.
  const VERZUG0 = 0.25;
  const VERZUG_MAX = 1.05;
  const VERZUG_ZEIT = 40;
  const VERZUG_AB = 6;
  const STUFE = 0.05;
  const SCHATTEN = 0.3;
  const SCHATTEN_MAX = 1.2;
  // Die Luft: um so viele Sekunden darf jeder Sprung zu früh oder zu spät
  // kommen. Die ersten Sekunden zum Hineinfinden ±160 ms, nach 10 s ±133,
  // nach 20 s ±96, nach 30 s ±73, nach 45 s ±54, nach einer Minute ±46, nie
  // unter ±38.
  const E0 = 0.16;
  const E_MIN = 0.038;
  const E_ZEIT = 20;
  const E_AB = 5;
  const SCHWER_ZEIT = 30;          // nach so vielen Sekunden sind gut sechs Zehntel der Härte da
  const SCHWER_AB = 4;
  const SICHT = 270;               // so weit sieht man voraus, hoch wie quer
  const PERIODE = 480;             // so lang ist ein Stück gemalter Boden
  const TAKT = 1 / 240;
  const STURZ_MS = 2300;
  const FASSUNG = "t1";

  const TOP_COUNT = 5;
  const store = cloudApi
    ? cloudApi.register({ key: "lernapp.marsrover", empty: { runs: 0, scores: [] }, merge: cloudApi.mergeScores(TOP_COUNT) })
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

  // Der Weg nach der Zeit: erst anfahren, dann V0 gegen V_MAX. Geschlossen
  // gerechnet – der Ort hängt nur an der Zeit, nie an der Länge der
  // Rechenschritte.
  const tempoHaupt = (t) => V_MAX - (V_MAX - V0) * Math.exp(-t / V_ZEIT);
  const wegHaupt = (t) => V_MAX * t - (V_MAX - V0) * V_ZEIT * (1 - Math.exp(-t / V_ZEIT));
  const X_ANFAHRT = (V0 * ANFAHRT) / 2;
  const WEG_ANFAHRT = wegHaupt(ANFAHRT);
  function xBei(t) {
    if (t <= 0) return 0;
    if (t < ANFAHRT) return (V0 * t * t) / (2 * ANFAHRT);
    return X_ANFAHRT + wegHaupt(t) - WEG_ANFAHRT;
  }
  function tempoBei(t) {
    if (t <= 0) return 0;
    if (t < ANFAHRT) return (V0 * t) / ANFAHRT;
    return tempoHaupt(t);
  }
  // Und umgekehrt: wann er an der Stelle x ist.
  function tBei(x) {
    if (x <= 0) return 0;
    if (x < X_ANFAHRT) return Math.sqrt((2 * ANFAHRT * x) / V0);
    let t = ANFAHRT + (x - X_ANFAHRT) / V0;
    for (let i = 0; i < 8; i += 1) t -= (xBei(t) - x) / tempoBei(t);
    return t;
  }

  // Der Bogen des Sprungs, tau Sekunden nach dem Absprung.
  const bogenY = (tau) => (tau <= 0 || tau >= SPRUNG ? 0 : (4 * HOCH * tau * (SPRUNG - tau)) / (SPRUNG * SPRUNG));
  // So lange nach dem Absprung (und so lange vor der Landung) ist er höher
  // als DECKE − TOP.
  const TAU_DECKE = (SPRUNG - Math.sqrt(SPRUNG * SPRUNG - ((DECKE - TOP) * SPRUNG * SPRUNG) / HOCH)) / 2;

  const verzugKurve = (t) => VERZUG0 + (VERZUG_MAX - VERZUG0) * (1 - Math.exp(-Math.max(0, t - VERZUG_AB) / VERZUG_ZEIT));
  const aufStufe = (d) => Math.round(Math.floor(d / STUFE + 1e-6) * STUFE * 100) / 100;
  const luftBei = (t) => E_MIN + (E0 - E_MIN) * Math.exp(-Math.max(0, t - E_AB) / E_ZEIT);
  const schwere = (t) => 1 - Math.exp(-Math.max(0, t - SCHWER_AB) / SCHWER_ZEIT);

  function hash01(n) {
    const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return x - Math.floor(x);
  }

  // Ein fester Zufall für das Bild: Die Landschaft sieht jedes Mal gleich aus.
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
  const sekunden = (d) => `${d.toFixed(2).replace(".", ",")} s`;

  // ---------------------------------------------------------------------------
  // Zustand
  // ---------------------------------------------------------------------------
  // phase:   "bereit" (noch nichts getippt), "spiel", "zuschauen", "ende"
  // schritt: "start" (er steht), "fahrt", "sturz"
  const state = {
    phase: "bereit",
    schritt: "start",
    punkte: 0,
    t: 0,                    // die Spielzeit; der Rover fährt bei null los
    zeit: 0,                 // die Uhr des Bildes
    // Der Rover: wo er ist, wie hoch, wann er zuletzt absprang (null: am
    // Boden) und wann er zuletzt landete.
    rover: { x: 0, y: 0, sprung: null, landung: -9, absprung: -9 },
    // Die Befehle: wann getippt (ab), wann sie ankommen (an), was daraus
    // wurde (zustand 0 unterwegs, 1 gesprungen, 2 verpufft, 3 los).
    befehle: [],
    gesendet: 0,
    spruenge: 0,
    verpufft: 0,
    weg: [],
    hindernisse: [],
    abschnitte: [],
    freiAb: ANFAHRT,
    planFehler: 0,
    schluchten: 0,
    abschnitt: -1,
    sturz: null,
    teile: [],
    schriften: [],
    ansage: null,
    spur: [],
    camX: 0,
    stoss: 0,
    stufeBlitz: 0,
    stufeUm: 0,
    intro: null,
  };

  let shell = null;
  let feld = null;
  let canvas = null;
  let g = null;
  let frame = null;
  let last = 0;
  let voraus = 0;
  let stepTimer = null;
  let verlorenTimer = null;
  let gegner = null;
  let zuschauer = null;
  let wind = null;
  let fahrt = null;
  let tippRinge = null;
  let ersterStart = true;

  const view = { s: 1, dpr: 1, cssW: 0, cssH: 0, frei: 0, rx: 40, boden: 400, hz: 300, pan: 0, panMax: 0, extra: 0 };

  function clearStep() {
    if (stepTimer) { window.clearTimeout(stepTimer); stepTimer = null; }
    if (verlorenTimer) { window.clearTimeout(verlorenTimer); verlorenTimer = null; }
  }

  function stopLoop() {
    if (frame) { window.cancelAnimationFrame(frame); frame = null; }
  }

  // ---------------------------------------------------------------------------
  // Klang
  // ---------------------------------------------------------------------------
  function klangAn() {
    wind = klang()?.kulisse("marsrover.wind") || null;
    wind?.setze(0.3);
    wind?.laut(0.45);
    fahrt = klang()?.kulisse("marsrover.fahrt", { laut: 0 }) || null;
  }

  function klangStellen() {
    const r = state.rover;
    const rollt = state.schritt === "fahrt" && r.sprung === null && state.t > 0;
    fahrt?.setze(clamp(tempoBei(state.t) / V_MAX, 0.3, 1));
    fahrt?.laut(rollt ? 0.5 : 0);
  }

  function klangAus() {
    fahrt?.stop();
    wind?.stop();
    fahrt = null;
    wind = null;
  }

  // ---------------------------------------------------------------------------
  // Die Strecke: die Hindernisse
  // ---------------------------------------------------------------------------
  /*
   * Drei Arten:
   *
   *   krater  [a, b]: Wer am Boden ist und mit seiner Mitte mehr als RAND
   *           über den Rand hinaus ist, stürzt hinein. Die Spalten einer
   *           Schlucht sind auch Krater (schlucht: true), nur tiefer.
   *   fels    [a, b], h hoch, der Gipfel bei p (Anteil), Flanken nach q:
   *           Wer ihn mit dem Rover zwischen den Rädern berührt, prallt.
   *           Gemalt wird genau dieser Umriss (felsHoehe).
   *   bogen   [a, b], die Unterkante bei DECKE: Wer darunter abhebt,
   *           stösst an. Die Pfeiler stehen hinter der Strecke.
   */
  function felsHoehe(f, x) {
    if (x <= f.a || x >= f.b) return 0;
    const u = (x - f.a) / (f.b - f.a);
    const k = u < f.p ? (f.p - u) / f.p : (u - f.p) / (1 - f.p);
    return f.h * Math.sqrt(Math.max(0, 1 - k ** f.q));
  }

  // Der höchste Punkt eines Felsens zwischen x0 und x1.
  function felsMax(f, x0, x1) {
    if (x1 <= f.a || x0 >= f.b) return 0;
    const gipfel = f.a + f.p * (f.b - f.a);
    if (x0 <= gipfel && x1 >= gipfel) return f.h;
    return x1 < gipfel ? felsHoehe(f, x1) : felsHoehe(f, x0);
  }

  // Das erste Hindernis, das nicht ganz links von x liegt (sie liegen der
  // Reihe nach und überlappen sich nicht).
  function abIndex(x) {
    const liste = state.hindernisse;
    let lo = 0;
    let hi = liste.length;
    while (lo < hi) {
      const m = (lo + hi) >> 1;
      if (liste[m].b < x) lo = m + 1; else hi = m;
    }
    return lo;
  }

  // Was ihn hier trifft: x seine Mitte, y die Höhe der Räder über dem Boden,
  // luft ob er fliegt. null heisst: nichts.
  function trifft(x, y, luft) {
    const liste = state.hindernisse;
    for (let i = abIndex(x - LH - 1); i < liste.length; i += 1) {
      const o = liste[i];
      if (o.a > x + LH + 1) break;
      if (o.art === "krater") {
        if (!luft && x > o.a + RAND && x < o.b - RAND) return o;
      } else if (o.art === "fels") {
        if (felsMax(o, x - LH, x + LH) > y + 0.3) return o;
      } else if (o.art === "bogen") {
        if (x + LH > o.a && x - LH < o.b && y + TOP > DECKE) return o;
      }
    }
    return null;
  }

  function einreihen(o) {
    const liste = state.hindernisse;
    let i = liste.length;
    while (i > 0 && liste[i - 1].a > o.a) i -= 1;
    liste.splice(i, 0, o);
  }

  // Ein Krater, über den ein Sprung zwischen lo und hi hinwegkommt – nicht
  // früher und nicht später: Wer nach hi abspringt, steht schon über dem
  // Rand; wer vor lo abspringt, landet noch darin.
  function kraterBauen(lo, hi, wahl = {}) {
    const a = xBei(hi) - RAND;
    const b = xBei(lo + SPRUNG) + RAND;
    return { art: "krater", a, b, tief: lerp(46, 64, hash01(a * 0.37)), saat: hash01(a * 0.11 + 3), ...wahl };
  }

  // Überlebt ein Sprung von t0 diesen Felsen? Am Boden davor darf er ihn
  // nicht berühren, im Flug nicht streifen, und gelandet muss er dahinter
  // sein.
  function felsUeberlebt(f, t0) {
    const vor = xBei(t0);
    if (felsMax(f, vor - LH, vor + LH) > 0.3) return false;
    const nach = xBei(t0 + SPRUNG);
    if (nach - LH < f.a + f.p * (f.b - f.a) || felsMax(f, nach - LH, nach + LH) > 0.3) return false;
    for (let tau = 0; tau < SPRUNG; tau += 1 / 600) {
      const x = xBei(t0 + tau);
      if (felsMax(f, x - LH, x + LH) > bogenY(tau) + 0.3) return false;
    }
    return true;
  }

  // Von wann bis wann ein Sprung über diesen Felsen gelingt (null: nie).
  function felsFenster(f) {
    const gipfel = f.a + f.p * (f.b - f.a);
    const mitte = tBei(gipfel) - SPRUNG / 2;
    if (!felsUeberlebt(f, mitte)) return null;
    let a = mitte;
    let b = mitte + 0.6;
    for (let i = 0; i < 18; i += 1) { const m = (a + b) / 2; if (felsUeberlebt(f, m)) a = m; else b = m; }
    const hi = a;
    a = mitte - 0.6;
    b = mitte;
    for (let i = 0; i < 18; i += 1) { const m = (a + b) / 2; if (felsUeberlebt(f, m)) b = m; else a = m; }
    return { lo: b, hi };
  }

  // Ein Fels, über den ein Sprung zwischen lo und hi hinwegkommt: Die Höhe
  // nach der Schwere, die Breite so, dass genau dieses Fenster bleibt.
  function felsBauen(lo, hi, zH, zP, zQ, k) {
    const W = hi - lo;
    const tm = (lo + hi) / 2;
    const v = tempoBei(tm + SPRUNG / 2);
    let h = lerp(lerp(9, 12, k), lerp(13, 22, k), zH);
    const p = lerp(0.34, 0.62, zP);
    const q = lerp(2, 3.2, zQ);
    let w = 9;
    for (;;) {
      w = v * (SPRUNG * Math.sqrt(1 - h / HOCH) - W) - 2 * LH + 3;
      if (w >= 9 || h <= 7) break;
      h -= 1;
    }
    w = Math.max(7, w);
    const f = { art: "fels", a: 0, b: 0, h, p, q, saat: hash01(tm * 7.7) };
    let mitte = xBei(tm + SPRUNG / 2);
    const setze = () => { f.a = mitte - w * p; f.b = f.a + w; };
    setze();
    for (let i = 0; i < 5; i += 1) {
      const fen = felsFenster(f);
      if (!fen) { w *= 0.8; setze(); continue; }
      w = Math.max(6, w + (fen.hi - fen.lo - W) * v * 0.95);
      mitte += (tm - (fen.lo + fen.hi) / 2) * v;
      setze();
    }
    // Zuletzt muss das Fenster [lo, hi] ganz decken – sonst etwas schmaler.
    for (let i = 0; i < 24; i += 1) {
      const fen = felsFenster(f);
      if (fen && fen.lo <= lo + 1e-4 && fen.hi >= hi - 1e-4) break;
      if (fen) mitte += (tm - (fen.lo + fen.hi) / 2) * v;
      w = Math.max(4, w - 0.8);
      setze();
    }
    return f;
  }

  function bogenBauen(a, b, z) {
    return { art: "bogen", a, b, saat: z, dick: lerp(13, 19, z) };
  }

  // ---------------------------------------------------------------------------
  // Die Strecke: der Weg, Abschnitt um Abschnitt
  // ---------------------------------------------------------------------------
  /*
   * Ein Abschnitt ist eine Lage: ein bis drei Sprünge, um die herum die
   * Hindernisse stehen. Zuerst der Weg (wann er abspringt, zeiten), dann die
   * Hindernisse so, dass jeder Sprung bis zu e zu früh oder zu spät noch
   * gelingt (dazu ein wenig mehr, s). Die Lagen:
   *
   *   krater, fels   ein Sprung
   *   doppel         zwei kurz hintereinander – später sind beide Befehle
   *                  zugleich unterwegs
   *   dreifach       drei
   *   bogenFels      erst ein Bogen, gleich dahinter ein Krater oder Fels:
   *                  springen erst, wenn der Mast frei ist (die Zange)
   *   felsBogen      erst ein Krater oder Fels, gleich hinter der Landung
   *                  ein Bogen: Wer zu spät springt, landet unter ihm
   *   schlucht       jeder sechzehnte Abschnitt: Spalten und Felsinseln
   *
   * Jeder achte Abschnitt ist besonders, im Wechsel: der 8., 24., 40. ein
   * Funkschatten (der Verzug SCHATTEN länger, um den Weg etwas mehr Luft),
   * der 16., 32., 48. eine Schlucht.
   *
   * Der Verzug: Ein Abschnitt hat einen (D), und er gilt für jeden Befehl,
   * der ab S getippt wird. S liegt gleich nach dem letzten Moment, zu dem
   * ein Befehl für den letzten Sprung davor noch rechtzeitig käme; und kein
   * Sprung des Abschnitts beginnt, bevor ein ab S getippter Befehl ankommen
   * kann. So gilt für jeden Sprung genau der Verzug, der beim Tippen oben
   * im Bild steht.
   *
   * Immer gleich viele Zahlen ziehen, was auch geschieht: Die Strecke soll
   * an der Saat hängen, nicht an den Zweigen dieser Funktion.
   */
  function naechsterAbschnitt() {
    const liste = state.abschnitte;
    const n = liste.length;
    const z = [];
    for (let i = 0; i < 12; i += 1) z.push(zufall.zahl());
    const vor = liste[n - 1] || null;
    const letzt = state.weg[state.weg.length - 1] || null;
    const nr = n + 1;
    const besonders = nr % 8 === 0 ? ((nr / 8) % 2 === 1 ? "schatten" : "schlucht") : "";
    const S = !vor ? -VERZUG0 : Math.max(vor.S + 0.1, letzt ? letzt.t + letzt.e - vor.D + 0.01 : vor.S + 0.1);
    const basis = !vor ? VERZUG0 : Math.max(vor.basis, aufStufe(verzugKurve(S)));
    const D = Math.round((besonders === "schatten" ? Math.max(basis, Math.min(SCHATTEN_MAX, basis + SCHATTEN)) : basis) * 100) / 100;
    const tSchaetz = Math.max(S + D, state.freiAb) + 0.5;
    const k0 = schwere(tSchaetz);
    const e0 = luftBei(tSchaetz) * (besonders === "schatten" ? 1.15 : 1);

    let lage;
    if (besonders === "schlucht") lage = "schlucht";
    else if (n === 0) lage = "krater";
    else if (n === 1) lage = "fels";
    else if (n === 2) lage = z[0] < 0.5 ? "krater" : "fels";
    else {
      const gewichte = [
        ["krater", 1],
        ["fels", 1],
        ["doppel", lerp(0.45, 1.1, k0)],
        ["bogenFels", n >= 4 ? lerp(0.35, 0.85, k0) : 0],
        ["felsBogen", n >= 5 ? lerp(0.25, 0.65, k0) : 0],
        ["dreifach", n >= 10 ? lerp(0.05, 0.6, k0) : 0],
      ];
      let summe = 0;
      gewichte.forEach(([, w]) => { summe += w; });
      let r = z[0] * summe;
      lage = gewichte[0][0];
      for (const [name, w] of gewichte) {
        r -= w;
        if (r < 0) { lage = name; break; }
      }
    }

    const vorlauf = n === 0 ? 0 : n <= 3 ? 0.75 + 0.4 * z[1] : lerp(0.62, 0.16, k0) + z[1] * lerp(0.5, 0.22, k0);
    const frueh = Math.max(state.freiAb + vorlauf + e0, S + D + e0 + 0.02);

    // Ein Versuch, die Lage zu bauen; weicht ihr Weg nachgeprüft ab (sicher),
    // der nächste mit kleineren Hindernissen, zuletzt ein einfacher Krater.
    const versuch = (lageJetzt, mass) => {
      const e = e0 * mass;
      const k = k0 / mass;
      const hind = [];
      const zeiten = [];
      let freiAb = 0;
      const gZeit = (zi) => lerp(0.16, 0.05, k) + 0.08 * zi * (1 - k);
      const s = (zi) => e * lerp(0.22, 0.03, k) * zi;
      const ueber = (lo, hi, zArt, zH, zP, zQ) => (zArt < lerp(0.5, 0.42, k) ? kraterBauen(lo, hi) : felsBauen(lo, hi, zH, zP, zQ, k));
      let t1 = n === 0 ? 2.4 : frueh;
      if (lageJetzt === "krater") {
        zeiten.push(t1);
        hind.push(kraterBauen(t1 - e - s(z[2]), t1 + e + s(z[3])));
      } else if (lageJetzt === "fels") {
        zeiten.push(t1);
        hind.push(felsBauen(t1 - e - s(z[2]), t1 + e + s(z[3]), z[4], z[5], z[6], k));
      } else if (lageJetzt === "doppel" || lageJetzt === "dreifach") {
        const zahl = lageJetzt === "doppel" ? 2 : 3;
        let t = t1;
        for (let i = 0; i < zahl; i += 1) {
          if (i > 0) t += SPRUNG + 2 * e + gZeit(z[8 + i]);
          zeiten.push(t);
          hind.push(ueber(t - e - s(z[(2 + i) % 12]), t + e + s(z[(3 + i) % 12]), z[(7 + i * 2) % 12], z[(4 + i) % 12], z[(5 + i) % 12], z[(6 + i) % 12]));
        }
      } else if (lageJetzt === "bogenFels") {
        // Der Bogen endet so, dass der früheste Sprung, der ihn freilässt,
        // genau am Anfang des Fensters liegt.
        const span = lerp(34, 56, z[9]);
        const sA = s(z[2]);
        const zeitBogen = (span + 2 * LH + 6) / tempoBei(state.freiAb + 0.5);
        t1 = Math.max(state.freiAb + 0.5 * vorlauf + zeitBogen + TAU_DECKE + e + sA, frueh);
        const b = xBei(t1 - e - sA + TAU_DECKE) - LH;
        hind.push(bogenBauen(b - span, b, z[10]));
        zeiten.push(t1);
        // Was dahinter kommt, liesse auch früher springen: Begrenzt wird
        // vorn nur vom Bogen.
        const mehr = e * lerp(0.7, 0.3, k) * z[11];
        hind.push(ueber(t1 - e - sA - mehr, t1 + e + s(z[3]), z[7], z[4], z[5], z[6]));
      } else if (lageJetzt === "felsBogen") {
        // Erst das Hindernis, gleich hinter der Landung der Bogen: Begrenzt
        // wird hinten nur vom Bogen.
        const span = lerp(34, 56, z[9]);
        const sB = s(z[3]);
        zeiten.push(t1);
        const mehr = e * lerp(0.7, 0.3, k) * z[11];
        hind.push(ueber(t1 - e - s(z[2]), t1 + e + sB + mehr, z[7], z[4], z[5], z[6]));
        const a = xBei(t1 + e + sB + SPRUNG - TAU_DECKE) + LH;
        hind.push(bogenBauen(a, a + span, z[10]));
        freiAb = tBei(a + span + LH) - TAU_DECKE + 0.02;
      } else if (lageJetzt === "schlucht") {
        // Spalten und Felsinseln: zwei Sprünge, ab der zweiten Schlucht drei.
        const zahl = state.schluchten === 0 ? 2 : 3;
        let t = t1;
        for (let i = 0; i < zahl; i += 1) {
          if (i > 0) t += SPRUNG + 2 * e + lerp(0.14, 0.07, k) + 0.05 * z[8 + i];
          zeiten.push(t);
          hind.push(kraterBauen(t - e - s(z[2 + i]), t + e + s(z[3 + i]), { schlucht: true, tief: 400, insel: i < zahl - 1 }));
        }
      }
      return { zeiten, hind, e, freiAb };
    };

    const vorher = letzt ? [{ t: letzt.t, e: letzt.e }] : [];
    let fertig = null;
    for (const [lageJetzt, mass] of [[lage, 1], [lage, 1.12], ["krater", 1.2]]) {
      const v = versuch(lageJetzt, mass);
      v.hind.forEach((o) => { o.nr = n; einreihen(o); });
      const folge = [...vorher, ...v.zeiten.map((t) => ({ t, e: v.e }))];
      // Ab dem frühesten Absprung des letzten Sprungs davor (bis dahin ist
      // der Abschnitt davor schon geprüft), sonst kurz vor dem ersten.
      const von = vorher.length ? letzt.t - letzt.e - 0.005 : v.zeiten[0] - 0.45;
      const bis = v.zeiten[v.zeiten.length - 1] + v.e + SPRUNG + 0.45;
      if (sicher(folge, von, bis)) { fertig = { ...v, lage: lageJetzt }; break; }
      state.hindernisse = state.hindernisse.filter((o) => o.nr !== n);
    }
    if (!fertig) {
      // Darf nicht vorkommen (die Prüfung zählt mit) – dann eben dieser.
      state.planFehler += 1;
      const v = versuch("krater", 1.3);
      v.hind.forEach((o) => { o.nr = n; einreihen(o); });
      fertig = { ...v, lage: "krater" };
    }
    if (fertig.lage === "schlucht") state.schluchten += 1;
    fertig.zeiten.forEach((t) => state.weg.push({ t, e: fertig.e, nr: n }));
    const tLetzt = fertig.zeiten[fertig.zeiten.length - 1];
    state.freiAb = Math.max(tLetzt + fertig.e + SPRUNG + 0.04, fertig.freiAb);
    liste.push({ nr: n, S, D, basis, lage: fertig.lage, besonders, t0: fertig.zeiten[0], t1: tLetzt, e: fertig.e });
  }

  // Hält die Folge? Für jede Ecke der Luft (jeder Sprung so früh oder so
  // spät, wie er darf) und genau nach dem Weg: am Boden, im Flug, gelandet.
  function sicher(folge, von, bis) {
    const n = folge.length;
    const faelle = [folge.map((s) => s.t)];
    for (let m = 0; m < (1 << n); m += 1) faelle.push(folge.map((s, i) => s.t + (((m >> i) & 1) ? 0.97 : -0.97) * s.e));
    return faelle.every((zeiten) => folgeHaelt(zeiten, von, bis));
  }

  function folgeHaelt(zeiten, von, bis) {
    for (let i = 1; i < zeiten.length; i += 1) if (zeiten[i] < zeiten[i - 1] + SPRUNG + 0.004) return false;
    let j = -1;
    for (let t = von; t <= bis; t += 1 / 400) {
      while (j + 1 < zeiten.length && zeiten[j + 1] <= t) j += 1;
      const luft = j >= 0 && t < zeiten[j] + SPRUNG;
      if (trifft(xBei(t), luft ? bogenY(t - zeiten[j]) : 0, luft)) return false;
    }
    return true;
  }

  // Die Strecke steht bis zur Zeit t – und immer bis über den nächsten
  // Funkschatten hinaus (Phobos muss wissen, wann er vor der Erde steht).
  // Je Aufruf höchstens «mal» Abschnitte, damit kein Bild lange wartet.
  function planBis(t, mal = 40) {
    for (let i = 0; i < mal; i += 1) {
      const liste = state.abschnitte;
      const letzt = liste[liste.length - 1];
      const schattenDa = liste.some((a) => a.besonders === "schatten" && a.S > state.t);
      if (letzt && letzt.t1 > t && schattenDa && liste.length > state.abschnitt + 2) return;
      naechsterAbschnitt();
    }
  }

  function streckeNeu() {
    state.weg = [];
    state.hindernisse = [];
    state.abschnitte = [];
    state.freiAb = ANFAHRT;
    state.planFehler = 0;
    state.schluchten = 0;
    state.abschnitt = -1;
    planBis(10);
  }

  // Der Abschnitt, dessen Verzug für einen Befehl zur Zeit t gilt.
  function abschnittBei(t) {
    const liste = state.abschnitte;
    let lo = 0;
    let hi = liste.length - 1;
    if (hi < 0 || t < liste[0].S) return 0;
    while (lo < hi) {
      const m = (lo + hi + 1) >> 1;
      if (liste[m].S <= t) lo = m; else hi = m - 1;
    }
    return lo;
  }
  const verzugBei = (t) => state.abschnitte[abschnittBei(t)]?.D ?? VERZUG0;

  // Die Strecke als Text – für die Prüfung, dass in einem Turnier alle
  // dieselbe bekommen.
  function kursText(bis = 60) {
    while (!state.abschnitte.length || state.abschnitte[state.abschnitte.length - 1].t1 < bis) naechsterAbschnitt();
    const xb = xBei(bis);
    const teile = state.hindernisse.filter((o) => o.a < xb).map((o) => `${o.art[0]}${o.a.toFixed(1)}-${o.b.toFixed(1)}${o.h ? `/${o.h.toFixed(1)}` : ""}`);
    const verzug = state.abschnitte.filter((a) => a.S < bis).map((a) => `${a.lage}@${a.D}`);
    return `${teile.join(",")} | ${verzug.join(",")}`;
  }

  // ---------------------------------------------------------------------------
  // Die Fläche
  // ---------------------------------------------------------------------------
  function buildPlatz() {
    const platz = shell.el("div", "mr-platz");
    feld = shell.el("div", "mr-feld");
    canvas = document.createElement("canvas");
    canvas.className = "mr-canvas";
    canvas.setAttribute("aria-hidden", "true");
    feld.append(canvas);
    g = canvas.getContext("2d");

    // Der Hinweis vor dem ersten Tipp: zwei Ringe, die aufgehen – tippen.
    const tipp = shell.el("span", "mr-tipp");
    tipp.setAttribute("aria-hidden", "true");
    const ns = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(ns, "svg");
    svg.setAttribute("viewBox", "0 0 64 64");
    ["mr-tipp-ring", "mr-tipp-ring is-spaet"].forEach((klasse) => {
      const kreis = document.createElementNS(ns, "circle");
      kreis.setAttribute("class", klasse);
      kreis.setAttribute("cx", "32");
      kreis.setAttribute("cy", "32");
      kreis.setAttribute("r", "14");
      kreis.setAttribute("fill", "none");
      kreis.setAttribute("stroke", "#ffffff");
      kreis.setAttribute("stroke-width", "4");
      svg.append(kreis);
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

  function messen() {
    if (!canvas || !feld) return;
    const cssW = Math.max(80, feld.clientWidth);
    const cssH = Math.max(80, feld.clientHeight);
    const dpr = shellApi.bildpunkte(cssW, cssH, 2);
    const frei = Math.min(cssH * 0.4, shell?.frei?.(canvas) || 0);
    if (cssW === view.cssW && cssH === view.cssH && dpr === view.dpr && frei === view.frei) return;
    view.cssW = cssW;
    view.cssH = cssH;
    view.dpr = dpr;
    view.frei = frei;
    // Der Massstab: SICHT Einheiten voraus müssen ins Bild (hochkant gibt
    // das die Breite vor), und über und unter dem Boden genug Höhe (quer).
    // Ein Stück Boden ist eine ganze Zahl Bildpunkte breit: So lässt es sich
    // auflegen, ohne gestreckt zu werden.
    const links = Math.max(34, cssW * 0.1);
    const s0 = Math.min((cssW - links - 6) / SICHT, (cssH - frei - 12) / 150);
    view.s = Math.max(1, Math.round(PERIODE * s0 * dpr)) / (PERIODE * dpr);
    const s = view.s;
    // So weit rechts, dass genau SICHT voraus im Bild ist – quer steht er
    // darum weiter in der Mitte, und hinter ihm sieht man seine Spur.
    view.rx = Math.round(cssW - 6 - SICHT * s);
    const hochkant = cssH > cssW * 1.15;
    let boden = frei + (cssH - frei) * (hochkant ? 0.64 : 0.73);
    boden = Math.min(boden, cssH - 42 * s);
    boden = Math.max(boden, frei + 112 * s);
    view.boden = Math.round(boden);
    view.hz = Math.round(view.boden - Math.max(26, cssH * (hochkant ? 0.1 : 0.12)));
    view.panMax = Math.round(cssH * 0.85);
    view.extra = Math.round(view.panMax * 0.36);
    const pw = Math.round(cssW * dpr);
    const ph = Math.round(cssH * dpr);
    if (canvas.width !== pw) canvas.width = pw;
    if (canvas.height !== ph) canvas.height = ph;
    if (tippRinge) {
      tippRinge.style.left = `${Math.round(Math.min(cssW - 40, view.rx + 0.45 * (cssW - view.rx)))}px`;
      tippRinge.style.top = `${Math.round(lerp(view.boden, cssH, 0.5))}px`;
    }
    ebenenNeu();
  }

  const bildX = (x) => view.rx + (x - state.camX) * view.s;
  const bildY = (y) => view.boden + view.pan - y * view.s;

  // ---------------------------------------------------------------------------
  // Zeichnen: der Himmel – einmal gemalt, dann nur aufgelegt
  // ---------------------------------------------------------------------------
  /*
   * Ein Marsabend: oben fast schon Nacht, darunter ochsenblut und
   * butterscotch, am Horizont fahles Ocker. Um die tief stehende Sonne aber
   * blau – der Staub der Marsluft streut das blaue Licht nach vorn, ein
   * Sonnenuntergang wie nirgends auf der Erde. Darüber, in der Dämmerung,
   * die Erde als Abendstern.
   *
   * Der Himmel steht in einem eigenen Bild (himmelBild), höher als der
   * Schirm um view.extra: Beim ersten Start gleitet die Kamera von dort oben
   * hinunter. Mit der Strecke wird es Abend (abend): Die Sonne sinkt, das
   * Blau wird enger, es wird dunkler. Neu gemalt wird dann nicht auf einmal,
   * sondern Streifen um Streifen in ein zweites Bild, das danach getauscht
   * wird – so ruckelt kein Bild.
   */
  let himmelBild = null;
  let himmelNeu = null;
  const himmelStand = { abend: -1, ziel: -1, streifen: 0 };

  function sonnenOrt(abend) {
    const W = view.cssW;
    const x = view.rx < W * 0.24 ? W * 0.34 : W * 0.15;
    return { x, y: view.extra + view.hz - (view.hz - view.frei) * lerp(0.16, 0.02, abend), r: Math.max(3, Math.min(W, view.cssH) * 0.011) };
  }

  // Wo die Erde steht (im Bild des Himmels): über der Sonne, wie ein
  // Abendstern – die Erde läuft näher um die Sonne als der Mars.
  function erdeOrt() {
    const sonne = sonnenOrt(0);
    return { x: sonne.x + view.cssW * 0.035, y: view.extra + view.hz - (view.hz - view.frei) * 0.62 };
  }

  function himmelMalen(k, abend, oben, unten) {
    const W = view.cssW;
    const Hs = view.cssH + view.extra;
    const hz = view.extra + view.hz;
    k.save();
    k.beginPath();
    k.rect(0, oben, W, unten - oben);
    k.clip();
    const verlauf = k.createLinearGradient(0, 0, 0, hz);
    const dunkel = abend * 0.55;
    verlauf.addColorStop(0, rgb(mix3([22, 16, 30], [8, 7, 16], dunkel)));
    verlauf.addColorStop(view.extra / hz * 0.9, rgb(mix3([44, 30, 44], [20, 15, 30], dunkel)));
    verlauf.addColorStop(lerp(view.extra / hz, 1, 0.35), rgb(mix3([104, 64, 62], [62, 40, 50], dunkel)));
    verlauf.addColorStop(lerp(view.extra / hz, 1, 0.68), rgb(mix3([176, 116, 84], [128, 80, 70], dunkel)));
    verlauf.addColorStop(1, rgb(mix3([222, 170, 122], [178, 124, 98], dunkel)));
    k.fillStyle = verlauf;
    k.fillRect(0, 0, W, Hs);

    // Das Blau um die Sonne: ein breiter, flacher Hof.
    const sonne = sonnenOrt(abend);
    const r = Math.max(W, view.cssH * 0.8) * lerp(0.5, 0.36, abend);
    k.save();
    k.translate(sonne.x, sonne.y);
    k.scale(1.25, 1);
    const hof = k.createRadialGradient(0, 0, 0, 0, 0, r);
    hof.addColorStop(0, "rgba(238, 248, 255, 1)");
    hof.addColorStop(0.03, "rgba(204, 232, 255, 0.95)");
    hof.addColorStop(0.1, "rgba(136, 186, 244, 0.82)");
    hof.addColorStop(0.24, "rgba(96, 146, 222, 0.5)");
    hof.addColorStop(0.45, "rgba(92, 124, 196, 0.2)");
    hof.addColorStop(0.75, "rgba(92, 112, 176, 0.05)");
    hof.addColorStop(1, "rgba(92, 112, 176, 0)");
    k.fillStyle = hof;
    k.fillRect(-r, -r, 2 * r, 2 * r);
    k.restore();
    // Die Sonne selbst: klein und weiss – auf dem Mars zwei Drittel so gross.
    const kern = k.createRadialGradient(sonne.x, sonne.y, 0, sonne.x, sonne.y, sonne.r * 5);
    kern.addColorStop(0, "rgba(255, 255, 255, 1)");
    kern.addColorStop(0.2, "rgba(250, 252, 255, 0.95)");
    kern.addColorStop(0.32, "rgba(214, 234, 255, 0.45)");
    kern.addColorStop(1, "rgba(200, 226, 255, 0)");
    k.fillStyle = kern;
    k.fillRect(sonne.x - sonne.r * 5, sonne.y - sonne.r * 5, sonne.r * 10, sonne.r * 10);
    // Unter dem Horizont: die ferne Ebene im Dunst, zur Strecke hin satter,
    // mit flachen Wellen – erst nach dem blauen Hof, sie liegt im Schatten.
    const ebene = k.createLinearGradient(0, hz, 0, view.extra + view.boden);
    ebene.addColorStop(0, rgb(mix3([206, 150, 112], [160, 108, 88], dunkel)));
    ebene.addColorStop(1, rgb(mix3([166, 96, 66], [116, 70, 54], dunkel)));
    k.fillStyle = ebene;
    k.fillRect(0, hz, W, Hs - hz);
    k.strokeStyle = rgba([132, 74, 54], 0.25);
    k.lineWidth = 1;
    for (let i = 1; i < 6; i += 1) {
      const y = hz + (view.boden - view.hz) * (i / 6) ** 1.4;
      k.beginPath();
      k.moveTo(0, y);
      for (let x = 0; x <= W; x += 20) k.lineTo(x, y + Math.sin(x * 0.02 + i * 1.7) * (1 + i * 0.4));
      k.stroke();
    }
    // Staubschleier über dem Horizont: zwei fahle Bänder.
    [[0.06, 0.16, 0.22], [0.15, 0.1, 0.12]].forEach(([ab, dick, kraft]) => {
      const y = hz - (view.hz - view.frei) * ab;
      const band = k.createLinearGradient(0, y - (view.hz - view.frei) * dick, 0, y + 6);
      band.addColorStop(0, "rgba(236, 196, 156, 0)");
      band.addColorStop(0.7, `rgba(236, 196, 156, ${kraft * (1 - abend * 0.5)})`);
      band.addColorStop(1, "rgba(236, 196, 156, 0)");
      k.fillStyle = band;
      k.fillRect(0, y - (view.hz - view.frei) * dick, W, (view.hz - view.frei) * dick + 6);
    });
    k.restore();
  }

  function himmelPruefen(abend) {
    const Hs = view.cssH + view.extra;
    const pw = Math.round(view.cssW * view.dpr);
    const ph = Math.round(Hs * view.dpr);
    if (!himmelBild || himmelBild.width !== pw || himmelBild.height !== ph) {
      himmelBild = document.createElement("canvas");
      himmelBild.width = pw;
      himmelBild.height = ph;
      const k = himmelBild.getContext("2d");
      k.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
      himmelMalen(k, abend, 0, Hs);
      himmelStand.abend = abend;
      himmelStand.ziel = -1;
      himmelNeu = null;
      return;
    }
    // Streifen um Streifen in das zweite Bild, dann tauschen.
    if (himmelStand.ziel < 0 && Math.abs(abend - himmelStand.abend) > 0.06) {
      himmelStand.ziel = abend;
      himmelStand.streifen = 0;
      if (!himmelNeu || himmelNeu.width !== pw || himmelNeu.height !== ph) {
        himmelNeu = document.createElement("canvas");
        himmelNeu.width = pw;
        himmelNeu.height = ph;
      }
    }
    if (himmelStand.ziel >= 0) {
      const STREIFEN = 10;
      const k = himmelNeu.getContext("2d");
      k.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
      const i = himmelStand.streifen;
      himmelMalen(k, himmelStand.ziel, (Hs * i) / STREIFEN - 1, (Hs * (i + 1)) / STREIFEN + 1);
      himmelStand.streifen += 1;
      if (himmelStand.streifen >= STREIFEN) {
        const alt = himmelBild;
        himmelBild = himmelNeu;
        himmelNeu = alt;
        himmelStand.abend = himmelStand.ziel;
        himmelStand.ziel = -1;
      }
    }
  }

  // Wie weit der Abend ist: nach 1500 Metern ist die Sonne fast weg.
  const abendBei = (x) => clamp(x / 15000, 0, 1);

  const STERNE = Array.from({ length: 170 }, (_, i) => ({
    x: hash01(i * 3.1 + 1), y: hash01(i * 5.7 + 2) ** 1.3, r: 0.5 + hash01(i * 7.3 + 3) ** 2 * 1.4, t: hash01(i * 9.9) * 6,
  }));

  // Phobos zieht über den Himmel, auf einer Linie durch die Erde: Vor jedem
  // Funkschatten wandert er auf sie zu, während des Schattens steht er vor
  // ihr, danach zieht er weiter, geht unter und kommt von links wieder.
  const PHOBOS_U = 0.24;
  const PHOBOS_D = 0.022;
  function phobosLinie() {
    const erde = erdeOrt();
    const dx = view.cssW * 1.16;
    const dy = -(view.hz - view.frei) * 0.92;
    return { ax: erde.x - PHOBOS_U * dx, ay: erde.y - PHOBOS_U * dy, dx, dy };
  }

  function schattenListe() {
    const liste = state.abschnitte;
    const raus = [];
    for (let i = 0; i < liste.length; i += 1) {
      if (liste[i].besonders !== "schatten") continue;
      raus.push({ S: liste[i].S, E: liste[i + 1] ? liste[i + 1].S : liste[i].S + 2.5 });
    }
    return raus;
  }

  // w läuft von 0 bis RUNDE und wieder von vorn; der Ort auf der Linie ist
  // w − 0,5 (darunter steht er hinter dem Horizont).
  function phobosU(t) {
    const schatten = schattenListe();
    const RUNDE = 1.5;
    const WE = PHOBOS_U + 0.5;
    let w;
    const im = schatten.find((s) => t >= s.S && t < s.E);
    if (im) {
      w = lerp(WE - PHOBOS_D, WE + PHOBOS_D, (t - im.S) / (im.E - im.S));
    } else {
      const davor = schatten.filter((s) => s.E <= t).pop() || null;
      const danach = schatten.find((s) => s.S > t) || null;
      const von = davor ? davor.E : -1;
      const bis = danach ? danach.S : von + 32;
      const w0 = davor ? WE + PHOBOS_D : WE - PHOBOS_D + RUNDE - (bis - von) * (RUNDE / 34);
      const w1 = WE - PHOBOS_D + RUNDE;
      w = lerp(w0, w1, clamp((t - von) / Math.max(0.1, bis - von), 0, 1));
    }
    w %= RUNDE;
    return (w < 0 ? w + RUNDE : w) - 0.5;
  }

  // Die Lichter am Himmel – jedes Bild, denn sie sind klein: Sterne, die
  // Erde mit dem Mond, Phobos und Deimos.
  function zeichneHimmelslichter(oben) {
    const W = view.cssW;
    const still = ruhig();
    const abend = himmelStand.abend;
    const hz = view.hz + oben;
    g.fillStyle = "#ffffff";
    for (let i = 0; i < STERNE.length; i += 1) {
      const st = STERNE[i];
      const y = st.y * (view.hz + view.extra) - view.extra + oben;
      if (y > hz - 20 || y < -4) continue;
      // Nah am Horizont und im Hof der Sonne sieht man sie nicht.
      const hoehe = clamp((hz - y) / (view.hz - view.frei + view.extra * 0.5), 0, 1);
      const sicht = clamp(hoehe * 1.6 - 0.35 + abend * 0.5, 0, 1);
      if (sicht <= 0.02) continue;
      const funkeln = still ? 0.8 : 0.6 + 0.4 * Math.sin(state.zeit * 1.7 + st.t);
      g.globalAlpha = funkeln * sicht * 0.9;
      g.fillRect(st.x * W, y, st.r, st.r);
    }
    g.globalAlpha = 1;

    // Die Erde: ein heller, blauer Punkt, daneben der Mond.
    const erde = erdeOrt();
    const ex = erde.x;
    const ey = erde.y - view.extra + oben;
    const im = state.phase === "spiel" && state.abschnitte[abschnittBei(state.t)]?.besonders === "schatten";
    schein("blau", ex, ey, 1.25, im ? 0.35 : 0.85);
    g.fillStyle = "#eaf6ff";
    g.beginPath();
    g.arc(ex, ey, 1.9, 0, TAU);
    g.fill();
    g.fillStyle = "rgba(214, 214, 220, 0.85)";
    g.beginPath();
    g.arc(ex + 5, ey - 1.6, 0.8, 0, TAU);
    g.fill();

    // Deimos: klein, wie ein Stern, wandert langsam.
    const dt = (state.zeit * 0.004 + 0.62) % 1;
    g.fillStyle = "rgba(255, 236, 214, 0.85)";
    g.fillRect(W * (1.05 - dt * 1.1), hz - (view.hz - view.frei) * (0.45 + 0.35 * Math.sin(dt * Math.PI)), 1.6, 1.6);

    // Phobos: eine dunkle Kartoffel, zur Sonne hin beleuchtet.
    const u = phobosU(state.phase === "bereit" ? -VERZUG0 : state.t);
    if (u <= 1.05) {
      const L = phobosLinie();
      const px = L.ax + u * L.dx;
      const py = L.ay + u * L.dy - view.extra + oben;
      const r = Math.max(4.5, Math.min(W, view.cssH) * 0.017);
      g.save();
      g.translate(px, py);
      g.rotate(0.5 + u * 0.8);
      g.fillStyle = "rgb(52, 40, 40)";
      g.beginPath();
      g.ellipse(0, 0, r * 1.25, r, 0, 0, TAU);
      g.fill();
      g.fillStyle = "rgba(196, 160, 132, 0.85)";
      g.beginPath();
      g.ellipse(-r * 0.3, -r * 0.08, r * 0.95, r * 0.82, 0, Math.PI * 0.55, Math.PI * 1.55);
      g.fill();
      g.fillStyle = "rgba(40, 28, 30, 0.6)";
      g.beginPath();
      g.arc(-r * 0.4, r * 0.15, r * 0.28, 0, TAU);
      g.fill();
      g.restore();
    }

    // Beim ersten Start: wer da oben blau leuchtet.
    if (state.intro && view.pan > 2) {
      const k = clamp(state.intro.t / 0.6, 0, 1) * clamp((view.pan / view.panMax - 0.08) * 4, 0, 1);
      if (k > 0.01) {
        g.globalAlpha = k;
        g.strokeStyle = "rgba(220, 236, 255, 0.7)";
        g.lineWidth = 1;
        g.beginPath();
        g.moveTo(ex + 6, ey + 4);
        g.lineTo(ex + 22, ey + 16);
        g.stroke();
        g.font = "600 13px system-ui, sans-serif";
        g.textAlign = "left";
        g.textBaseline = "middle";
        g.fillStyle = "rgba(236, 244, 255, 0.95)";
        g.fillText("Erde", ex + 26, ey + 19);
        g.globalAlpha = 1;
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Zeichnen: die Landschaft – Streifen, einmal gemalt, dann aufgelegt
  // ---------------------------------------------------------------------------
  /*
   * Fünf Streifen, je weiter weg, desto langsamer und blasser:
   *
   *   fern     der Horizont mit dem Olympus Mons, flach und riesig, im Dunst
   *   tafel    Tafelberge mit Schichten, die Westwände im letzten Licht
   *   duenen   Dünen mit scharfen Kämmen, eine Seite im Licht
   *   boden    die Ebene, auf der er fährt (Einheiten der Strecke, PERIODE
   *            lang, ihre Kante ist bodenWelle)
   *   vorn     nahe Steine und Sand im Schatten, schneller als die Strecke
   *
   * Jeder Streifen wiederholt sich nach seiner Breite; alles, was darauf
   * steht, wird darum auch um eine Breite versetzt noch einmal gemalt.
   */
  let ebenen = null;
  const LAGEN_FAKTOR = { fern: 0.035, tafel: 0.11, duenen: 0.3, vorn: 1.45 };
  const LAGEN_PAN = { himmel: 0.36, fern: 0.5, tafel: 0.62, duenen: 0.76, boden: 1, vorn: 1.15 };

  function streifen(breit, hoch, malen) {
    const c = document.createElement("canvas");
    c.width = Math.max(8, Math.round(breit * view.dpr));
    c.height = Math.max(8, Math.round(hoch * view.dpr));
    const k = c.getContext("2d");
    k.scale(c.width / breit, c.height / hoch);
    malen(k, breit, hoch);
    return c;
  }

  // Eine Form an x, und noch einmal eine Breite links und rechts davon.
  const rundum = (W, malen) => { malen(-W); malen(0); malen(W); };

  // Weiches Rauschen, das sich nach n Stützstellen wiederholt.
  function rauschenRund(u, n, saat) {
    const i = Math.floor(u);
    const f = u - i;
    const a = hash01((((i % n) + n) % n) * 1.37 + saat);
    const b = hash01(((((i + 1) % n) + n) % n) * 1.37 + saat);
    return lerp(a, b, f * f * (3 - 2 * f));
  }

  function maleFern(k, W, H) {
    const dunst = [214, 164, 124];
    const grund = mix3([150, 98, 92], dunst, 0.5);
    k.fillStyle = rgb(grund);
    k.beginPath();
    k.moveTo(0, H);
    // Ferne Hügel und Kraterränder.
    for (let x = 0; x <= W; x += 3) {
      const u = (x / W) * 24;
      let y = H * (0.82 - 0.16 * rauschenRund(u, 24, 2) - 0.08 * rauschenRund(u * 3.3, 79, 5));
      // Der Olympus Mons: ein Schild, so breit wie das halbe Bild, mit dem
      // Steilhang am Fuss und der Caldera oben.
      const d = Math.abs(x - W * 0.58) / (W * 0.27);
      if (d < 1) {
        const kuppe = (1 - d * d) ** 1.4 * 0.72 + (d < 0.96 ? 0.14 : 0.14 * (1 - d) / 0.04);
        const caldera = 0.05 * Math.exp(-(((x - W * 0.58) / (W * 0.018)) ** 2));
        y = Math.min(y, H * (0.86 - 0.8 * (kuppe - caldera)));
      }
      k.lineTo(x, y);
    }
    k.lineTo(W, H);
    k.closePath();
    k.fill();
    // Die Westflanke des Vulkans im letzten Licht.
    k.save();
    k.clip();
    const licht = k.createLinearGradient(W * 0.3, 0, W * 0.62, 0);
    licht.addColorStop(0, "rgba(255, 214, 170, 0.22)");
    licht.addColorStop(1, "rgba(255, 214, 170, 0)");
    k.fillStyle = licht;
    k.fillRect(0, 0, W, H);
    const unten = k.createLinearGradient(0, H * 0.4, 0, H);
    unten.addColorStop(0, rgba(dunst, 0));
    unten.addColorStop(1, rgba(dunst, 0.55));
    k.fillStyle = unten;
    k.fillRect(0, 0, W, H);
    k.restore();
  }

  function maleTafel(k, W, H) {
    const z = wuerfel(7781);
    const dunst = [212, 158, 118];
    const grund = mix3([124, 70, 58], dunst, 0.34);
    const licht = mix3([196, 118, 80], dunst, 0.25);
    const schatten = mix3([86, 52, 58], dunst, 0.3);
    // Flache Hügel dahinter.
    k.fillStyle = rgb(mix3(grund, dunst, 0.25));
    k.beginPath();
    k.moveTo(0, H);
    for (let x = 0; x <= W; x += 4) k.lineTo(x, H * (0.78 - 0.1 * rauschenRund((x / W) * 9, 9, 11)));
    k.lineTo(W, H);
    k.closePath();
    k.fill();
    // Die Tafelberge.
    const berge = [];
    let x = W * 0.05;
    while (x < W * 0.95) {
      const breit = W * lerp(0.08, 0.2, z());
      const hoch = H * lerp(0.38, 0.78, z());
      berge.push({ x, breit, hoch, hang: lerp(0.08, 0.16, z()) * breit, schutt: lerp(0.2, 0.45, z()) });
      x += breit + W * lerp(0.08, 0.26, z());
    }
    berge.forEach((b) => rundum(W, (dx) => {
      const x0 = b.x + dx;
      const fuss = H * 0.93;
      const kante = fuss - b.hoch;
      const schutt = fuss - b.hoch * b.schutt;
      const pfad = () => {
        k.beginPath();
        k.moveTo(x0 - b.hang * 2.2, fuss);
        k.quadraticCurveTo(x0 - b.hang * 0.6, schutt + (fuss - schutt) * 0.2, x0, schutt);
        k.lineTo(x0 + b.hang * 0.25, kante + 2);
        k.lineTo(x0 + b.hang * 0.6, kante);
        k.lineTo(x0 + b.breit - b.hang * 0.6, kante + 0.6);
        k.lineTo(x0 + b.breit - b.hang * 0.25, kante + 2);
        k.lineTo(x0 + b.breit, schutt);
        k.quadraticCurveTo(x0 + b.breit + b.hang * 0.6, schutt + (fuss - schutt) * 0.2, x0 + b.breit + b.hang * 2.2, fuss);
        k.closePath();
      };
      pfad();
      k.fillStyle = rgb(grund);
      k.fill();
      k.save();
      pfad();
      k.clip();
      // Die Westwand und der Schutt davor im letzten Licht …
      k.fillStyle = rgb(licht);
      k.beginPath();
      k.moveTo(x0 - b.hang * 2.2, fuss);
      k.lineTo(x0, schutt);
      k.lineTo(x0 + b.hang * 0.6, kante);
      k.lineTo(x0 + b.hang * 1.5, kante);
      k.lineTo(x0 + b.hang * 1.1, schutt);
      k.lineTo(x0 + b.hang * 0.6, fuss);
      k.closePath();
      k.fill();
      // … die Ostseite im blauen Schatten.
      k.fillStyle = rgb(schatten);
      k.beginPath();
      k.moveTo(x0 + b.breit - b.hang * 1.3, kante);
      k.lineTo(x0 + b.breit + b.hang * 2.4, fuss);
      k.lineTo(x0 + b.breit - b.hang * 0.6, fuss);
      k.lineTo(x0 + b.breit - b.hang * 1.6, schutt);
      k.closePath();
      k.fill();
      // Rinnen in der Wand, vom Regen einer anderen Zeit.
      k.strokeStyle = rgba([60, 32, 36], 0.16);
      k.lineWidth = 0.8;
      k.beginPath();
      for (let i = 0; i < 4; i += 1) {
        const rx = x0 + b.hang * 1.6 + (b.breit - b.hang * 3) * hash01(b.x * 0.01 + i * 1.7);
        k.moveTo(rx, kante + 2);
        k.lineTo(rx + (hash01(i * 3.3 + b.x) - 0.5) * 3, schutt + (fuss - schutt) * 0.3);
      }
      k.stroke();
      // Schichten im Fels.
      k.strokeStyle = rgba([70, 38, 40], 0.32);
      k.lineWidth = 0.8;
      for (let i = 1; i < 5; i += 1) {
        const y = kante + (schutt - kante) * (i / 5) + Math.sin(i * 3.1 + b.x) * 1.2;
        k.beginPath();
        k.moveTo(x0 - 4, y);
        k.lineTo(x0 + b.breit + 4, y + 0.6);
        k.stroke();
      }
      // Die Kante oben im letzten Licht.
      k.strokeStyle = "rgba(255, 214, 166, 0.6)";
      k.lineWidth = 1.1;
      k.beginPath();
      k.moveTo(x0 + b.hang * 0.6, kante + 0.4);
      k.lineTo(x0 + b.breit * 0.8, kante + 0.8);
      k.stroke();
      k.restore();
    }));
    const unten = k.createLinearGradient(0, H * 0.55, 0, H);
    unten.addColorStop(0, rgba(dunst, 0));
    unten.addColorStop(1, rgba(dunst, 0.5));
    k.fillStyle = unten;
    k.fillRect(0, H * 0.55, W, H * 0.45);
  }

  function maleDuenen(k, W, H) {
    const z = wuerfel(5113);
    const licht = [196, 116, 72];
    const schatten = [126, 66, 52];
    const grund = [160, 90, 60];
    k.fillStyle = rgb(grund);
    k.fillRect(0, H * 0.78, W, H * 0.22);
    let x = 0;
    const duenen = [];
    while (x < W) {
      const breit = W * lerp(0.16, 0.32, z());
      duenen.push({ x, breit, hoch: H * lerp(0.3, 0.62, z()), kamm: lerp(0.62, 0.78, z()) });
      x += breit * lerp(0.5, 0.8, z());
    }
    duenen.forEach((d) => rundum(W, (dx) => {
      const x0 = d.x + dx;
      const fuss = H;
      const kx = x0 + d.breit * d.kamm;
      const ky = fuss - d.hoch;
      const ende = x0 + d.breit * 1.12;
      // Die ganze Düne im Schatten …
      k.fillStyle = rgb(schatten);
      k.beginPath();
      k.moveTo(x0, fuss);
      k.bezierCurveTo(x0 + d.breit * 0.35, fuss - d.hoch * 0.2, kx - d.breit * 0.28, ky, kx, ky);
      k.bezierCurveTo(kx + d.breit * 0.08, ky + d.hoch * 0.12, ende - d.breit * 0.12, fuss - d.hoch * 0.1, ende, fuss);
      k.closePath();
      k.fill();
      // … die lange Luvseite im Licht, bis an den scharfen Kamm.
      k.fillStyle = rgb(licht);
      k.beginPath();
      k.moveTo(x0, fuss);
      k.bezierCurveTo(x0 + d.breit * 0.35, fuss - d.hoch * 0.2, kx - d.breit * 0.28, ky, kx, ky);
      k.bezierCurveTo(kx - d.breit * 0.02, ky + d.hoch * 0.4, kx - d.breit * 0.1, fuss - d.hoch * 0.15, kx - d.breit * 0.22, fuss);
      k.closePath();
      k.fill();
      // Rippeln auf der Luvseite.
      k.strokeStyle = "rgba(130, 70, 50, 0.3)";
      k.lineWidth = 0.7;
      k.beginPath();
      for (let i = 1; i < 6; i += 1) {
        const f = i / 6;
        const rx = lerp(x0 + d.breit * 0.1, kx - d.breit * 0.1, f);
        const ry = lerp(fuss - d.hoch * 0.05, ky + d.hoch * 0.2, f);
        k.moveTo(rx - d.breit * 0.06, ry + 1.5);
        k.quadraticCurveTo(rx, ry - 1, rx + d.breit * 0.06, ry + 1.2);
      }
      k.stroke();
      // Der Kamm leuchtet.
      k.strokeStyle = "rgba(255, 210, 156, 0.7)";
      k.lineWidth = 1;
      k.beginPath();
      k.moveTo(kx - d.breit * 0.3, ky + d.hoch * 0.06);
      k.quadraticCurveTo(kx - d.breit * 0.1, ky - 0.5, kx, ky);
      k.stroke();
    }));
    const dunst = k.createLinearGradient(0, 0, 0, H);
    dunst.addColorStop(0, "rgba(214, 160, 120, 0.3)");
    dunst.addColorStop(1, "rgba(214, 160, 120, 0)");
    k.fillStyle = dunst;
    k.fillRect(0, 0, W, H);
  }

  // Die Kante der Ebene: sanfte Wellen, die sich nach PERIODE wiederholen.
  const bodenWelle = (x) => {
    const u = (x / PERIODE) * TAU;
    return 1 * Math.sin(u * 3 + 0.4) + 0.5 * Math.sin(u * 7 + 1.9) + 0.25 * Math.sin(u * 17 + 0.2);
  };

  // Der Boden, auf dem er fährt: PERIODE Einheiten breit, oben die Kante
  // (bodenWelle), darunter Kies, Steinchen und Rippeln – nach unten näher
  // und dunkler.
  function maleBoden(k, W, H, oben) {
    const s = W / PERIODE;
    const kante = (x) => oben - bodenWelle(x / s) * s;
    const flaeche = () => {
      k.beginPath();
      k.moveTo(-2, H);
      for (let x = -2; x <= W + 2; x += 2) k.lineTo(x, kante(x));
      k.lineTo(W + 2, H);
      k.closePath();
    };
    flaeche();
    const verlauf = k.createLinearGradient(0, oben - 4, 0, H);
    verlauf.addColorStop(0, "rgb(186, 108, 68)");
    verlauf.addColorStop(Math.min(0.99, 26 / H), "rgb(150, 82, 52)");
    verlauf.addColorStop(Math.min(0.995, 90 / H), "rgb(112, 58, 40)");
    verlauf.addColorStop(1, "rgb(70, 36, 30)");
    k.fillStyle = verlauf;
    k.fill();
    k.save();
    flaeche();
    k.clip();
    const z = wuerfel(9127);
    // Rippeln im Sand.
    k.strokeStyle = "rgba(90, 44, 30, 0.22)";
    k.lineWidth = 0.8;
    for (let i = 0; i < 26; i += 1) {
      const y = oben + 6 + z() * (H - oben - 6);
      const x = z() * W;
      const lang = (10 + z() * 30) * s;
      rundum(W, (dx) => {
        k.beginPath();
        k.moveTo(x + dx, y);
        k.quadraticCurveTo(x + dx + lang / 2, y - 2, x + dx + lang, y);
        k.stroke();
      });
    }
    // Steinchen: je tiefer im Bild, desto näher und grösser.
    const zahl = Math.round(W / 4);
    for (let i = 0; i < zahl; i += 1) {
      const tief = z() ** 1.6;
      const y = oben + 3 + tief * (H - oben - 3);
      const x = z() * W;
      const r = (0.5 + z() * 1.4) * (1 + tief * 3) * Math.max(0.8, s * 0.7);
      const flach = 0.45 + z() * 0.25;
      rundum(W, (dx) => {
        k.fillStyle = "rgba(52, 24, 20, 0.35)";
        k.beginPath();
        k.ellipse(x + dx + r * 0.5, y + r * flach * 0.6, r * 1.1, r * flach * 0.7, 0, 0, TAU);
        k.fill();
        k.fillStyle = i % 3 ? "rgb(122, 64, 44)" : "rgb(98, 52, 40)";
        k.beginPath();
        k.ellipse(x + dx, y, r, r * flach, 0, 0, TAU);
        k.fill();
        k.fillStyle = "rgba(236, 170, 120, 0.55)";
        k.beginPath();
        k.ellipse(x + dx - r * 0.35, y - r * flach * 0.35, r * 0.45, r * flach * 0.35, 0, 0, TAU);
        k.fill();
      });
    }
    k.restore();
    // Die Kante im letzten Licht.
    k.strokeStyle = "rgba(244, 184, 128, 0.85)";
    k.lineWidth = 1.2;
    k.beginPath();
    for (let x = -2; x <= W + 2; x += 2) {
      if (x === -2) k.moveTo(x, kante(x) + 0.5); else k.lineTo(x, kante(x) + 0.5);
    }
    k.stroke();
  }

  function maleVorn(k, W, H) {
    const z = wuerfel(3301);
    k.fillStyle = "rgb(52, 26, 24)";
    k.beginPath();
    k.moveTo(0, H);
    for (let x = 0; x <= W; x += 4) k.lineTo(x, H * (0.62 - 0.22 * rauschenRund((x / W) * 7, 7, 31) - 0.1 * rauschenRund((x / W) * 19, 19, 37)));
    k.lineTo(W, H);
    k.closePath();
    k.fill();
    // Grosse Steine im Vordergrund, mit Licht auf der Westseite.
    for (let i = 0; i < 6; i += 1) {
      const x = z() * W;
      const r = H * lerp(0.18, 0.4, z());
      const y = H * lerp(0.5, 0.75, z());
      rundum(W, (dx) => {
        k.fillStyle = "rgb(44, 22, 22)";
        k.beginPath();
        k.ellipse(x + dx, y, r * 1.35, r * 0.75, 0, Math.PI, TAU);
        k.lineTo(x + dx + r * 1.35, H);
        k.lineTo(x + dx - r * 1.35, H);
        k.closePath();
        k.fill();
        k.strokeStyle = "rgba(226, 130, 84, 0.5)";
        k.lineWidth = 1.2;
        k.beginPath();
        k.ellipse(x + dx, y, r * 1.35, r * 0.75, 0, Math.PI * 1.05, Math.PI * 1.45);
        k.stroke();
      });
    }
  }

  // Kleine Scheine, einmal gemalt: Licht der Signale, der Erde, der
  // Lampen, und ein Staubbausch.
  const SCHEINE = {
    puls: [[180, 236, 255], 1, 0.9],
    blau: [[150, 200, 255], 1, 0.7],
    warm: [[255, 226, 170], 1, 0.8],
    rot: [[255, 70, 50], 1, 0.9],
    staub: [[206, 146, 104], 0.7, 0.55],
  };
  function scheinAus(farbe, kraft, r) {
    const c = document.createElement("canvas");
    const n = Math.max(8, Math.round(r * 2 * view.dpr));
    c.width = n;
    c.height = n;
    const k = c.getContext("2d");
    const v = k.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2);
    v.addColorStop(0, rgba(farbe, kraft));
    v.addColorStop(0.25, rgba(farbe, kraft * 0.55));
    v.addColorStop(1, rgba(farbe, 0));
    k.fillStyle = v;
    k.fillRect(0, 0, n, n);
    return c;
  }

  function schein(name, x, y, mass = 1, alpha = 1) {
    const bild = ebenen?.scheine?.[name];
    if (!bild || alpha <= 0.01) return;
    const r = SCHEINE[name][2] * 16 * mass;
    g.globalAlpha = alpha;
    g.drawImage(bild, x - r, y - r, 2 * r, 2 * r);
    g.globalAlpha = 1;
  }

  // Eine Staubhose in der Ferne: ein heller, gedrehter Trichter, unten
  // dicht, oben verweht.
  function maleStaubhose(k, W, H) {
    const n = 90;
    for (let i = 0; i < n; i += 1) {
      const f = i / n;
      const y = H * (1 - f) - 1.5;
      const breit = W * lerp(0.06, 0.36, f ** 1.3);
      const x = W / 2 + Math.sin(f * 4.2) * W * 0.1;
      const alpha = 0.075 * (1 - f) ** 0.8 * Math.min(1, f / 0.05 + 0.3);
      k.fillStyle = `rgba(234, 192, 150, ${alpha})`;
      k.beginPath();
      k.ellipse(x, y, breit, Math.max((H / n) * 1.6, breit * 0.2), 0, 0, TAU);
      k.fill();
    }
  }

  function ebenenNeu() {
    const W = view.cssW;
    const H = view.cssH;
    const s = view.s;
    const hoch = (H - view.frei);
    const fernH = Math.round(Math.max(30, hoch * 0.16));
    const tafelH = Math.round(Math.max(30, hoch * 0.2));
    const duenenH = Math.round(Math.max(16, (view.boden - view.hz) * 0.85));
    const bodenOben = Math.ceil(5 * s) + 2;
    const bodenH = Math.round(H - view.boden + bodenOben + 2);
    const vornH = Math.round(Math.min(hoch * 0.15, (H - view.boden) * 0.62));
    ebenen = {
      fern: streifen(Math.round(W * 1.7), fernH, maleFern),
      tafel: streifen(Math.round(W * 1.4), tafelH, maleTafel),
      duenen: streifen(Math.round(W * 1.25), duenenH, maleDuenen),
      boden: streifen(PERIODE * s, bodenH, (k, bw, bh) => maleBoden(k, bw, bh, bodenOben)),
      vorn: vornH > 8 ? streifen(Math.round(W * 1.3), vornH, maleVorn) : null,
      hose: streifen(Math.round((view.boden - view.hz) * 0.9 + 10), Math.round((view.boden - view.hz) * 1.9 + 10), maleStaubhose),
      bodenOben,
      scheine: {},
    };
    Object.entries(SCHEINE).forEach(([name, [farbe, kraft, r]]) => { ebenen.scheine[name] = scheinAus(farbe, kraft, r * 16); });
    himmelBild = null;
    himmelStand.ziel = -1;
  }

  // Einen Streifen quer übers Bild legen (in Bildpunkten), immer wieder.
  function legeStreifen(bild, versatz, y) {
    const bw = bild.width;
    for (let x = -(((Math.round(versatz) % bw) + bw) % bw); x < canvas.width; x += bw) g.drawImage(bild, x, y);
  }

  function zeichneLandschaft() {
    const dpr = view.dpr;
    const s = view.s;
    const pan = view.pan;
    const cam = state.camX * s * dpr;
    g.setTransform(1, 0, 0, 1, 0, 0);
    // Der Himmel: das untere Stück seines Bildes, beim Hinuntergleiten mehr.
    g.drawImage(himmelBild, 0, Math.round((-view.extra + pan * LAGEN_PAN.himmel) * dpr));
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    zeichneHimmelslichter(pan * LAGEN_PAN.himmel);
    g.setTransform(1, 0, 0, 1, 0, 0);
    const hz = view.hz;
    legeStreifen(ebenen.fern, cam * LAGEN_FAKTOR.fern, Math.round((hz + 3 + pan * LAGEN_PAN.fern) * dpr) - ebenen.fern.height);
    const tafelFuss = Math.round((hz + (view.boden - hz) * 0.32 + pan * LAGEN_PAN.tafel) * dpr);
    legeStreifen(ebenen.tafel, cam * LAGEN_FAKTOR.tafel, tafelFuss - ebenen.tafel.height);
    if (pan > 0.5) {
      g.fillStyle = "rgb(186, 124, 90)";
      g.fillRect(0, tafelFuss - 1, canvas.width, canvas.height);
    }
    // Eine Staubhose zwischen den Tafelbergen und den Dünen, die langsam
    // über die Ebene zieht.
    if (!ruhig()) {
      const hose = ebenen.hose;
      const breit = view.cssW * 2.2;
      const wo = ((view.cssW * 1.1 - state.camX * s * 0.2 - state.zeit * 6) % breit + breit) % breit - hose.width / dpr;
      const fuss = hz + (view.boden - hz) * 0.62 + pan * LAGEN_PAN.duenen;
      g.globalAlpha = 0.7 + 0.3 * Math.sin(state.zeit * 0.7);
      g.drawImage(hose, Math.round((wo + Math.sin(state.zeit * 1.3) * 3) * dpr), Math.round(fuss * dpr) - hose.height);
      g.globalAlpha = 1;
    }
    const duenenFuss = Math.round((view.boden + 4 * s + pan * LAGEN_PAN.duenen) * dpr);
    legeStreifen(ebenen.duenen, cam * LAGEN_FAKTOR.duenen, duenenFuss - ebenen.duenen.height);
    // Beim Hinuntergleiten zieht die Ebene langsamer hoch als die Strecke:
    // Darunter bleibt kein Spalt.
    if (pan > 0.5) {
      g.fillStyle = "rgb(160, 88, 58)";
      g.fillRect(0, duenenFuss - 1, canvas.width, canvas.height);
    }
    // Die Ebene: genau mit der Strecke, Punkt auf Punkt.
    legeStreifen(ebenen.boden, cam - view.rx * dpr, Math.round((view.boden + pan) * dpr) - Math.round(ebenen.bodenOben * dpr));
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function zeichneVorn() {
    if (!ebenen.vorn) return;
    const dpr = view.dpr;
    g.setTransform(1, 0, 0, 1, 0, 0);
    legeStreifen(ebenen.vorn, state.camX * view.s * dpr * LAGEN_FAKTOR.vorn, Math.round((view.cssH + view.pan * (LAGEN_PAN.vorn - 1)) * dpr) - ebenen.vorn.height + Math.round(view.pan * dpr));
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  // ---------------------------------------------------------------------------
  // Zeichnen: die Hindernisse
  // ---------------------------------------------------------------------------
  // Wie hoch der Boden an der Stelle x im Bild ist (in Einheiten): die
  // Welle der Ebene und die Wälle der Krater; in einem Krater −Infinity.
  function bodenSicht(x) {
    let y = bodenWelle(x);
    const liste = state.hindernisse;
    for (let i = abIndex(x - 12); i < liste.length; i += 1) {
      const o = liste[i];
      if (o.a > x + 12) break;
      if (o.art !== "krater") continue;
      if (x > o.a && x < o.b) return -Infinity;
      const wall = o.schlucht ? 0 : 2.6;
      if (wall) {
        const d = Math.min(Math.abs(x - (o.a - 3)), Math.abs(x - (o.b + 3)));
        if (d < 8) y += wall * (1 - (d / 8) ** 2);
      }
    }
    return y;
  }

  const kraterTiefe = (o) => clamp((o.b - o.a) * 0.62 + 8, 22, o.tief);

  // Die Schüssel eines Kraters als Pfad: steile Wände, unten rund.
  function kraterLoch(o) {
    const x0 = bildX(o.a);
    const x1 = bildX(o.b);
    const y0 = bildY(bodenWelle(o.a));
    const y1 = bildY(bodenWelle(o.b));
    const breit = x1 - x0;
    const boden = bildY(-kraterTiefe(o));
    g.moveTo(x0 - 1, y0);
    g.bezierCurveTo(x0 + breit * 0.03, y0 + (boden - y0) * 0.7, x0 + breit * 0.16, boden, x0 + breit * 0.48, boden);
    g.bezierCurveTo(x1 - breit * 0.16, boden, x1 - breit * 0.03, y1 + (boden - y1) * 0.7, x1 + 1, y1);
    g.closePath();
  }

  function zeichneKrater(o) {
    const s = view.s;
    const x0 = bildX(o.a);
    const x1 = bildX(o.b);
    if (x1 < -20 || x0 > view.cssW + 20) return;
    if (o.schlucht) { zeichneSpalte(o); return; }
    const y0 = bildY(bodenWelle(o.a));
    const y1 = bildY(bodenWelle(o.b));
    const breit = x1 - x0;
    const boden = bildY(-kraterTiefe(o));
    const loch = () => { g.beginPath(); kraterLoch(o); };
    const dunkel = g.createLinearGradient(0, Math.min(y0, y1), 0, boden);
    dunkel.addColorStop(0, "rgb(96, 46, 34)");
    dunkel.addColorStop(0.4, "rgb(50, 24, 22)");
    dunkel.addColorStop(1, "rgb(22, 11, 13)");
    loch();
    g.fillStyle = dunkel;
    g.fill();
    g.save();
    loch();
    g.clip();
    // Die Ostwand innen schaut zur tiefen Sonne: Sie glüht, oben am meisten.
    const licht = g.createRadialGradient(x1, y1, 0, x1, y1, Math.max(breit * 0.55, (boden - y1) * 0.9));
    licht.addColorStop(0, "rgba(236, 140, 88, 0.85)");
    licht.addColorStop(0.5, "rgba(186, 92, 60, 0.35)");
    licht.addColorStop(1, "rgba(186, 92, 60, 0)");
    g.fillStyle = licht;
    g.fillRect(x0, y1 - 2, breit + 2, boden - y1 + 4);
    // Der Schatten der Westkante fällt schräg hinein.
    g.fillStyle = "rgba(24, 10, 12, 0.45)";
    g.beginPath();
    g.moveTo(x0 - 1, y0);
    g.lineTo(x0 + breit * 0.62, y0 + 1);
    g.lineTo(x0 + breit * 0.4, boden);
    g.lineTo(x0 - 1, boden);
    g.closePath();
    g.fill();
    // Schichten in den Wänden und Geröll am Grund.
    g.strokeStyle = "rgba(30, 12, 12, 0.3)";
    g.lineWidth = 1;
    g.beginPath();
    for (let i = 1; i < 4; i += 1) {
      const y = y0 + i * 9 * s;
      g.moveTo(x0, y);
      g.quadraticCurveTo((x0 + x1) / 2, y + 3 + Math.sin(o.saat * 9 + i) * 2, x1, y + Math.sin(o.saat * 5 + i) * 2);
    }
    g.stroke();
    g.fillStyle = "rgba(14, 6, 8, 0.55)";
    g.beginPath();
    for (let i = 0; i < 6; i += 1) {
      const x = x0 + breit * (0.2 + 0.6 * hash01(o.saat * 31 + i));
      const r = (1.2 + 2 * hash01(o.saat * 17 + i * 3)) * s;
      g.moveTo(x + r, boden - r * 0.3);
      g.ellipse(x, boden - r * 0.3, r, r * 0.55, 0, 0, TAU);
    }
    g.fill();
    g.restore();
    // Die Wälle rundum, mit einer hellen Kante.
    [o.a - 3, o.b + 3].forEach((mx, i) => {
      g.fillStyle = i ? "rgb(170, 96, 60)" : "rgb(190, 112, 70)";
      g.beginPath();
      g.moveTo(bildX(mx - 8), bildY(bodenWelle(mx - 8)) + 1);
      for (let d = -8; d <= 8; d += 2) {
        const y = bodenSicht(mx + d);
        g.lineTo(bildX(mx + d), bildY(y === -Infinity ? bodenWelle(mx + d) : y));
      }
      g.lineTo(bildX(mx + 8), bildY(bodenWelle(mx + 8)) + 1);
      g.closePath();
      g.fill();
      g.strokeStyle = "rgba(250, 196, 140, 0.85)";
      g.lineWidth = 1;
      g.beginPath();
      for (let d = -7; d <= 2; d += 1.5) {
        const y = bodenSicht(mx + d);
        const sy = bildY(y === -Infinity ? bodenWelle(mx + d) : y) + 0.5;
        if (d === -7) g.moveTo(bildX(mx + d), sy); else g.lineTo(bildX(mx + d), sy);
      }
      g.stroke();
    });
  }

  // Die Schlucht: Die erste Spalte malt die ganze Schlucht (tief bis ins
  // Dunkel, Schichten in den Wänden), jede weitere nur ihren Teil; zwischen
  // zwei Spalten steht eine Felsinsel – eine Säule aus der Tiefe, oben eben.
  function zeichneSpalte(o) {
    const s = view.s;
    const liste = state.hindernisse;
    const nr = liste.indexOf(o);
    const vor = liste[nr - 1];
    if (vor && vor.schlucht && vor.b > o.a - 400) return;
    let ende = o;
    for (let i = nr + 1; i < liste.length && liste[i].schlucht && liste[i].a < ende.b + 400; i += 1) ende = liste[i];
    const x0 = bildX(o.a);
    const x1 = bildX(ende.b);
    const y0 = bildY(bodenWelle(o.a));
    const y1 = bildY(bodenWelle(ende.b));
    const unten = view.cssH + 4;
    const breit = x1 - x0;
    const schlucht = () => {
      g.beginPath();
      g.moveTo(x0 - 1, y0);
      g.bezierCurveTo(x0 + 4 * s, y0 + 30 * s, x0 + 1 * s, y0 + 60 * s, x0 + 6 * s, unten);
      g.lineTo(x1 - 6 * s, unten);
      g.bezierCurveTo(x1 - 1 * s, y1 + 60 * s, x1 - 4 * s, y1 + 30 * s, x1 + 1, y1);
      g.closePath();
    };
    const tiefe = g.createLinearGradient(0, Math.min(y0, y1), 0, unten);
    tiefe.addColorStop(0, "rgb(80, 36, 30)");
    tiefe.addColorStop(0.3, "rgb(34, 16, 20)");
    tiefe.addColorStop(1, "rgb(8, 5, 10)");
    schlucht();
    g.fillStyle = tiefe;
    g.fill();
    g.save();
    schlucht();
    g.clip();
    // Die Wand gegenüber, im letzten Licht; Dunst über der Tiefe.
    const licht = g.createLinearGradient(x1 - 40 * s, 0, x1, 0);
    licht.addColorStop(0, "rgba(214, 112, 72, 0)");
    licht.addColorStop(1, "rgba(214, 112, 72, 0.55)");
    g.fillStyle = licht;
    g.fillRect(x1 - 40 * s, y1, 40 * s, unten - y1);
    const dunst = g.createLinearGradient(0, y0 + 40 * s, 0, y0 + 90 * s);
    dunst.addColorStop(0, "rgba(150, 80, 60, 0)");
    dunst.addColorStop(0.5, "rgba(150, 80, 60, 0.18)");
    dunst.addColorStop(1, "rgba(150, 80, 60, 0)");
    g.fillStyle = dunst;
    g.fillRect(x0, y0 + 40 * s, breit, 50 * s);
    g.strokeStyle = "rgba(20, 8, 10, 0.3)";
    g.lineWidth = 1;
    g.beginPath();
    for (let i = 1; i < 9; i += 1) {
      const y = y0 + i * 8 * s;
      g.moveTo(x0, y);
      g.lineTo(x1, y + Math.sin(o.saat * 7 + i) * 2);
    }
    g.stroke();
    // Die Inseln.
    for (let i = nr; i < liste.length && liste[i] !== ende; i += 1) {
      const a = liste[i];
      const b = liste[i + 1];
      const ia = bildX(a.b);
      const ib = bildX(b.a);
      const oben = bildY(bodenWelle(a.b));
      const iw = ib - ia;
      const saeule = () => {
        g.beginPath();
        g.moveTo(ia, oben);
        g.lineTo(ib, bildY(bodenWelle(b.a)));
        g.bezierCurveTo(ib - iw * 0.02, oben + 30 * s, ib - iw * 0.12, oben + 60 * s, ib - iw * 0.06, unten);
        g.lineTo(ia + iw * 0.08, unten);
        g.bezierCurveTo(ia + iw * 0.14, oben + 60 * s, ia + iw * 0.02, oben + 30 * s, ia, oben);
        g.closePath();
      };
      saeule();
      g.fillStyle = "rgb(112, 58, 42)";
      g.fill();
      g.save();
      saeule();
      g.clip();
      const seite = g.createLinearGradient(ia, 0, ib, 0);
      seite.addColorStop(0, "rgba(244, 154, 98, 0.75)");
      seite.addColorStop(0.3, "rgba(180, 96, 64, 0.2)");
      seite.addColorStop(1, "rgba(40, 16, 18, 0.55)");
      g.fillStyle = seite;
      g.fillRect(ia, oben, iw, unten - oben);
      const dunkler = g.createLinearGradient(0, oben, 0, unten);
      dunkler.addColorStop(0, "rgba(20, 8, 12, 0)");
      dunkler.addColorStop(1, "rgba(20, 8, 12, 0.85)");
      g.fillStyle = dunkler;
      g.fillRect(ia, oben, iw, unten - oben);
      g.strokeStyle = "rgba(40, 16, 14, 0.4)";
      g.beginPath();
      for (let j = 1; j < 9; j += 1) {
        const y = oben + j * 8 * s;
        g.moveTo(ia, y);
        g.lineTo(ib, y + 1);
      }
      g.stroke();
      g.restore();
      g.strokeStyle = "rgba(250, 196, 140, 0.85)";
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(ia, oben + 0.5);
      g.lineTo(ib, bildY(bodenWelle(b.a)) + 0.5);
      g.stroke();
    }
    g.restore();
  }

  function felsPfad(o) {
    g.beginPath();
    const n = 16;
    g.moveTo(bildX(o.a - 0.5), bildY(-3));
    for (let i = 0; i <= n; i += 1) {
      const x = o.a + ((o.b - o.a) * i) / n;
      g.lineTo(bildX(x), bildY(felsHoehe(o, x)));
    }
    g.lineTo(bildX(o.b + 0.5), bildY(-3));
    g.closePath();
  }

  // Ein Felsbrocken: der Umriss genau wie felsHoehe (was man sieht, trifft
  // man), innen Flächen in verschiedenem Licht – die Westseite glüht, die
  // Ostseite liegt im Schatten, oben ein heller Grat –, Risse und am Fuss
  // ein paar Steine.
  function zeichneFels(o) {
    const s = view.s;
    const x0 = bildX(o.a);
    const x1 = bildX(o.b);
    if (x1 < -40 || x0 > view.cssW + 20) return;
    const w = o.b - o.a;
    const gipfel = o.a + o.p * w;
    const z = (i) => hash01(o.saat * 97 + i * 13.7);
    // Der Schatten nach Osten, lang in der tiefen Sonne.
    g.fillStyle = "rgba(48, 20, 18, 0.36)";
    g.beginPath();
    g.moveTo(bildX(o.a + w * 0.3), bildY(0.2));
    g.lineTo(bildX(o.b + o.h * 1.6), bildY(-0.6));
    g.lineTo(bildX(o.b + o.h * 1.2), bildY(-1.8));
    g.lineTo(bildX(o.a + w * 0.5), bildY(-1.4));
    g.closePath();
    g.fill();
    felsPfad(o);
    g.fillStyle = "rgb(110, 58, 44)";
    g.fill();
    g.save();
    felsPfad(o);
    g.clip();
    const P = (u, v) => [bildX(o.a + u * w), bildY(v * o.h)];
    const flaeche = (punkte, farbe) => {
      g.fillStyle = farbe;
      g.beginPath();
      punkte.forEach(([u, v], i) => { const [x, y] = P(u, v); if (i) g.lineTo(x, y); else g.moveTo(x, y); });
      g.closePath();
      g.fill();
    };
    const p = o.p;
    // Die Westseite im Licht, in zwei Flächen.
    flaeche([[-0.05, -0.1], [-0.05, 0.6], [p * 0.55, 1.1], [p + 0.02, 1.1], [p - 0.04 + z(1) * 0.08, 0.55], [p * 0.5 + z(2) * 0.1, -0.1]], "rgb(206, 120, 78)");
    flaeche([[-0.05, 0.45], [p * 0.45, 1.1], [p * 0.8, 1.1], [p * 0.55, 0.62 + z(3) * 0.1]], "rgb(236, 154, 104)");
    // Der helle Grat oben.
    flaeche([[p - 0.18, 0.92], [p, 1.1], [p + 0.16, 0.96], [p + 0.02, 0.8 - z(4) * 0.1]], "rgba(250, 178, 124, 0.85)");
    // Die Ostseite im Schatten.
    flaeche([[p + 0.1, 1.1], [1.05, 0.6], [1.05, -0.1], [p + 0.12 + z(5) * 0.12, -0.1], [p + 0.2, 0.5]], "rgb(84, 42, 38)");
    // Risse.
    g.strokeStyle = "rgba(44, 18, 16, 0.6)";
    g.lineWidth = Math.max(0.8, s * 0.5);
    g.beginPath();
    for (let i = 0; i < 2; i += 1) {
      const u = 0.15 + z(10 + i) * 0.7;
      const v = 0.3 + z(12 + i) * 0.5;
      const [ax, ay] = P(u, v);
      const [bx, by] = P(u + (z(14 + i) - 0.5) * 0.25, v - 0.18 - z(16 + i) * 0.2);
      const [cx, cy] = P(u + (z(18 + i) - 0.5) * 0.3, v - 0.4);
      g.moveTo(ax, ay);
      g.lineTo(bx, by);
      g.lineTo(cx, cy);
    }
    g.stroke();
    // Unten dunkler, wo er im Sand steckt.
    const fuss = g.createLinearGradient(0, bildY(o.h * 0.35), 0, bildY(0));
    fuss.addColorStop(0, "rgba(40, 16, 16, 0)");
    fuss.addColorStop(1, "rgba(40, 16, 16, 0.55)");
    g.fillStyle = fuss;
    g.fillRect(x0 - 2, bildY(o.h * 0.35), x1 - x0 + 4, o.h * 0.35 * s + 3 * s);
    g.restore();
    // Der Rand im letzten Licht.
    g.strokeStyle = "rgba(255, 204, 146, 0.9)";
    g.lineWidth = 1;
    g.beginPath();
    for (let i = 0; i <= 10; i += 1) {
      const x = o.a + (gipfel - o.a) * (i / 10);
      if (i === 0) g.moveTo(bildX(x), bildY(felsHoehe(o, x)) + 0.5); else g.lineTo(bildX(x), bildY(felsHoehe(o, x)) + 0.5);
    }
    g.stroke();
    // Ein paar Steine am Fuss.
    for (let i = 0; i < 3; i += 1) {
      const x = i === 0 ? o.a - 2 - z(20) * 3 : i === 1 ? o.b + 1 + z(21) * 4 : o.b + 6 + z(22) * 5;
      const r = (0.8 + z(23 + i) * 1.4) * s;
      const y = bildY(bodenWelle(x)) - r * 0.3;
      g.fillStyle = "rgb(96, 50, 38)";
      g.beginPath();
      g.ellipse(bildX(x), y, r * 1.3, r * 0.75, 0, 0, TAU);
      g.fill();
      g.fillStyle = "rgba(240, 160, 110, 0.6)";
      g.beginPath();
      g.ellipse(bildX(x) - r * 0.4, y - r * 0.25, r * 0.5, r * 0.3, 0, 0, TAU);
      g.fill();
    }
  }

  // Der Felsbogen: ein Bogen aus Fels über der Strecke, die Öffnung oben
  // flach bei DECKE (genau über [a, b]), zu den Füssen hin rund. Gemalt wird
  // er zweimal: ganz hinter dem Rover (die Füsse stehen hinter der Strecke)
  // und noch einmal davor, aber nur, was über DECKE liegt – wer springt,
  // verschwindet mit dem Mast im Fels.
  function bogenUmriss(o) {
    const fuss = 9 + o.saat * 5;
    const rund = 7;
    const a = o.a;
    const b = o.b;
    const oben = DECKE + o.dick;
    const z = (i) => Math.sin(i * 2.3 + o.saat * 11) * 1.8 + Math.sin(i * 5.1 + o.saat * 3) * 0.9;
    g.beginPath();
    // Aussen, im Uhrzeigersinn: der linke Fuss, der Rücken, der rechte Fuss.
    g.moveTo(bildX(a - rund - fuss - 4), bildY(-1));
    g.bezierCurveTo(bildX(a - rund - fuss - 2), bildY(DECKE * 0.5), bildX(a - rund - fuss), bildY(oben - 4), bildX(a - rund), bildY(oben + z(1)));
    const n = 8;
    for (let i = 1; i <= n; i += 1) {
      const x = a - rund + ((b - a + 2 * rund) * i) / n;
      g.lineTo(bildX(x), bildY(oben + z(i + 1) + Math.sin((i / n) * Math.PI) * 3));
    }
    g.bezierCurveTo(bildX(b + rund + fuss), bildY(oben - 4), bildX(b + rund + fuss + 2), bildY(DECKE * 0.5), bildX(b + rund + fuss + 4), bildY(-1));
    g.lineTo(bildX(b + rund), bildY(-1));
    // Innen, zurück: die Öffnung.
    g.bezierCurveTo(bildX(b + rund), bildY(DECKE * 0.7), bildX(b + rund * 0.4), bildY(DECKE), bildX(b), bildY(DECKE));
    g.lineTo(bildX(a), bildY(DECKE));
    g.bezierCurveTo(bildX(a - rund * 0.4), bildY(DECKE), bildX(a - rund), bildY(DECKE * 0.7), bildX(a - rund), bildY(-1));
    g.closePath();
  }

  function bogenMalen(o, vorn) {
    const s = view.s;
    const fuss = 9 + o.saat * 5;
    const xa = bildX(o.a - fuss - 12);
    const xb = bildX(o.b + fuss + 12);
    g.save();
    if (vorn) {
      g.beginPath();
      g.rect(xa - 4, -10, xb - xa + 8, bildY(DECKE) + 10);
      g.clip();
    }
    bogenUmriss(o);
    g.fillStyle = vorn ? "rgb(122, 64, 46)" : "rgb(92, 48, 40)";
    g.fill("evenodd");
    g.save();
    bogenUmriss(o);
    g.clip("evenodd");
    // Oben im letzten Licht, unten zur Öffnung hin dunkel.
    const licht = g.createLinearGradient(0, bildY(DECKE + o.dick + 4), 0, bildY(DECKE));
    licht.addColorStop(0, "rgba(244, 164, 108, 0.9)");
    licht.addColorStop(0.45, "rgba(176, 96, 64, 0.3)");
    licht.addColorStop(1, "rgba(40, 16, 16, 0.65)");
    g.fillStyle = licht;
    g.fillRect(xa, bildY(DECKE + o.dick + 8), xb - xa, (o.dick + 9) * s);
    // Die Westseite der Füsse im Licht.
    const west = g.createLinearGradient(xa, 0, xa + fuss * 1.6 * s, 0);
    west.addColorStop(0, "rgba(236, 140, 92, 0.6)");
    west.addColorStop(1, "rgba(236, 140, 92, 0)");
    g.fillStyle = west;
    g.fillRect(xa, bildY(DECKE + o.dick), fuss * 1.6 * s, (DECKE + o.dick + 2) * s);
    const west2 = g.createLinearGradient(bildX(o.b), 0, bildX(o.b + 10), 0);
    west2.addColorStop(0, "rgba(236, 140, 92, 0.45)");
    west2.addColorStop(1, "rgba(236, 140, 92, 0)");
    g.fillStyle = west2;
    g.fillRect(bildX(o.b), bildY(DECKE), 10 * s, DECKE * s);
    // Schichten.
    g.strokeStyle = "rgba(46, 18, 16, 0.4)";
    g.lineWidth = 1;
    g.beginPath();
    for (let i = 1; i < 6; i += 1) {
      const y = bildY(DECKE + o.dick - i * 6);
      g.moveTo(xa, y);
      g.lineTo(xb, y + Math.sin(o.saat * 5 + i) * 2);
    }
    g.stroke();
    g.restore();
    // Die Unterkante: ein dunkler Saum, an dem man sieht, wie tief sie hängt.
    g.strokeStyle = "rgba(26, 8, 8, 0.8)";
    g.lineWidth = Math.max(1, s * 0.8);
    g.beginPath();
    g.moveTo(bildX(o.a), bildY(DECKE) + 0.5);
    g.lineTo(bildX(o.b), bildY(DECKE) + 0.5);
    g.stroke();
    g.restore();
  }

  function bogenPfeiler(o) {
    const x1 = bildX(o.b + 40);
    const x0 = bildX(o.a - 40);
    if (x1 < 0 || x0 > view.cssW) return;
    // Der Schatten des Bogens auf dem Boden.
    g.fillStyle = "rgba(40, 16, 16, 0.3)";
    g.fillRect(bildX(o.a + 3), bildY(0.8), (o.b - o.a + 14) * view.s, 2.4 * view.s);
    bogenMalen(o, false);
  }

  function bogenBruecke(o) {
    const x1 = bildX(o.b + 40);
    const x0 = bildX(o.a - 40);
    if (x1 < 0 || x0 > view.cssW) return;
    bogenMalen(o, true);
  }

  function sichtbareHindernisse(fn) {
    const liste = state.hindernisse;
    const von = state.camX - view.rx / view.s - 80;
    const bis = state.camX + (view.cssW - view.rx) / view.s + 80;
    for (let i = abIndex(von); i < liste.length; i += 1) {
      const o = liste[i];
      if (o.a > bis) break;
      fn(o);
    }
  }

  // ---------------------------------------------------------------------------
  // Zeichnen: der Rover
  // ---------------------------------------------------------------------------
  /*
   * Von der Seite, die Nase nach rechts (x voraus, y nach oben, null unter
   * dem mittleren Rad am Boden): sechs Räder an Kipphebeln (rocker-bogie),
   * von denen man drei sieht – jedes folgt dem Boden für sich. Darauf der
   * Kasten mit Goldfolie, hinten die Radionuklidbatterie mit ihren Rippen,
   * die Schüssel, die Funkantenne (sie blinkt, wenn ein Befehl ankommt),
   * vorn der Mast mit dem Kamerakopf und der gefaltete Arm. Kleine Lichter:
   * zwei Scheinwerfer und eine rote Lampe auf dem Deck.
   *
   *   wahl.raeder  wie hoch jedes Rad über dem Boden der Mitte steht
   *   wahl.neig    wie der Kasten geneigt ist
   *   wahl.feder   wie weit er eingefedert ist
   *   wahl.dreh    wie weit sich die Räder gedreht haben
   */
  const RAEDER = [-10.5, -0.5, 10];
  const RAD_R = 3.6;

  function zeichneRover(sx, sy, s, wahl = {}) {
    const { geist = null, alpha = 1, raeder = [0, 0, 0], neig = 0, feder = 0, dreh = 0, antenne = 0, rot = 0, ohne = -1, licht = 1 } = wahl;
    const weiss = geist || "rgb(232, 218, 196)";
    const weissDunkel = geist || "rgb(168, 146, 128)";
    const gold = geist || "rgb(196, 146, 64)";
    const dunkel = geist || "rgb(44, 40, 42)";
    const grau = geist || "rgb(132, 128, 130)";
    const kante = geist || "rgba(255, 204, 150, 0.9)";
    g.save();
    g.globalAlpha = alpha;
    g.translate(sx, sy);
    g.scale(s, -s);
    g.lineCap = "round";
    g.lineJoin = "round";
    // Die Naben der Räder und wo der Kasten sitzt.
    const naben = RAEDER.map((x, i) => [x, RAD_R + raeder[i]]);
    const mitte = (naben[0][1] + naben[1][1] + naben[2][1]) / 3;
    const koerper = mitte + 6.4 - feder;
    const kipp = Math.atan2((naben[2][1] + naben[1][1]) / 2 - naben[0][1], 16) * 0.5 + neig;
    const auf = (x, y) => [x * Math.cos(kipp) - (y - koerper) * Math.sin(kipp), koerper + x * Math.sin(kipp) + (y - koerper) * Math.cos(kipp)];

    // Die Kipphebel: hinten vom Rad zum Gelenk am Kasten und weiter zum
    // Drehgestell, das das mittlere und das vordere Rad trägt.
    const gelenk = auf(-3, koerper - 1.2);
    const dg = [(naben[1][0] + naben[2][0]) / 2 + 0.3, (naben[1][1] + naben[2][1]) / 2 + 3.1];
    g.strokeStyle = grau;
    g.lineWidth = 1.25;
    g.beginPath();
    g.moveTo(naben[0][0], naben[0][1]);
    g.lineTo(gelenk[0], gelenk[1]);
    g.lineTo(dg[0], dg[1]);
    g.moveTo(naben[1][0], naben[1][1]);
    g.lineTo(dg[0], dg[1]);
    g.lineTo(naben[2][0], naben[2][1]);
    g.stroke();
    g.fillStyle = dunkel;
    g.beginPath();
    g.arc(gelenk[0], gelenk[1], 0.9, 0, TAU);
    g.arc(dg[0], dg[1], 0.8, 0, TAU);
    g.fill();

    // Die Räder: Reifen mit Stollen, die sich drehen, die Nabe hell.
    naben.forEach(([x, y], i) => {
      if (i === ohne) return;
      radMalen(x, y, dreh, geist);
    });

    g.save();
    g.translate(0, koerper);
    g.rotate(kipp);
    g.translate(0, -koerper);
    // Die Batterie hinten: ein schräger Zylinder mit Rippen.
    g.fillStyle = dunkel;
    g.beginPath();
    g.moveTo(-11, koerper + 1.5);
    g.lineTo(-16.2, koerper + 5.6);
    g.lineTo(-14.6, koerper + 7.6);
    g.lineTo(-9.6, koerper + 3.6);
    g.closePath();
    g.fill();
    if (!geist) {
      g.strokeStyle = "rgb(110, 100, 96)";
      g.lineWidth = 0.4;
      g.beginPath();
      for (let i = 0; i < 4; i += 1) {
        const f = 0.2 + i * 0.2;
        g.moveTo(lerp(-11, -16.2, f) + 0.4, lerp(koerper + 1.5, koerper + 5.6, f) + 0.6);
        g.lineTo(lerp(-9.6, -14.6, f) - 0.6, lerp(koerper + 3.6, koerper + 7.6, f) - 0.2);
      }
      g.stroke();
    }
    // Der Kasten: unten Goldfolie, oben weiss, das Deck mit hellem Rand.
    g.fillStyle = gold;
    g.beginPath();
    g.roundRect(-11.5, koerper - 2.4, 22, 2.8, 0.6);
    g.fill();
    g.fillStyle = weiss;
    g.beginPath();
    g.roundRect(-11.8, koerper, 22.6, 5.2, 1);
    g.fill();
    if (!geist) {
      // Ostseite (vorn) im Schatten, Westseite (hinten) im Licht.
      const schatten = g.createLinearGradient(-11.8, 0, 10.8, 0);
      schatten.addColorStop(0, "rgba(255, 226, 190, 0.25)");
      schatten.addColorStop(1, "rgba(80, 56, 60, 0.35)");
      g.fillStyle = schatten;
      g.fillRect(-11.8, koerper, 22.6, 5.2);
      g.strokeStyle = weissDunkel;
      g.lineWidth = 0.35;
      g.beginPath();
      g.moveTo(-4, koerper + 0.6);
      g.lineTo(-4, koerper + 4.6);
      g.moveTo(3.5, koerper + 0.6);
      g.lineTo(3.5, koerper + 4.6);
      g.stroke();
    }
    g.strokeStyle = kante;
    g.lineWidth = 0.55;
    g.beginPath();
    g.moveTo(-11.6, koerper + 5.3);
    g.lineTo(10.6, koerper + 5.3);
    g.stroke();
    const deck = koerper + 5.2;
    if (!geist) {
      // Auf dem Deck: ein Gerätekasten und die Wetterstation am Mast.
      g.fillStyle = "rgb(150, 136, 124)";
      g.beginPath();
      g.roundRect(-1.6, deck - 0.1, 4.4, 1.3, 0.3);
      g.fill();
      g.fillStyle = "rgba(255, 220, 180, 0.6)";
      g.fillRect(-1.6, deck + 1, 4.4, 0.22);
      g.strokeStyle = "rgb(120, 112, 108)";
      g.lineWidth = 0.3;
      g.beginPath();
      g.moveTo(6.5, deck + 6.2);
      g.lineTo(4.2, deck + 6.9);
      g.moveTo(4.2, deck + 6.4);
      g.lineTo(4.2, deck + 7.6);
      g.stroke();
      // Unter dem Deck eine Schattenkante, an den Seiten Nieten.
      g.fillStyle = "rgba(60, 40, 36, 0.35)";
      g.fillRect(-11.8, koerper, 22.6, 0.7);
      g.fillStyle = "rgba(90, 70, 64, 0.55)";
      for (let i = 0; i < 6; i += 1) g.fillRect(-10.4 + i * 4, koerper + 4.2, 0.35, 0.35);
    }
    // Die Schüssel.
    g.strokeStyle = grau;
    g.lineWidth = 0.6;
    g.beginPath();
    g.moveTo(-4.8, deck);
    g.lineTo(-4.8, deck + 2.2);
    g.stroke();
    g.fillStyle = weiss;
    g.beginPath();
    g.ellipse(-4.8, deck + 2.9, 2.8, 0.9, -0.35, 0, TAU);
    g.fill();
    // Die Funkantenne mit ihrem Licht.
    g.strokeStyle = grau;
    g.lineWidth = 0.45;
    g.beginPath();
    g.moveTo(-8.6, deck);
    g.lineTo(-8.6, deck + 6.6);
    g.stroke();
    g.fillStyle = antenne > 0.05 ? (rot ? "#ff9b7a" : "#e8fbff") : weissDunkel;
    g.beginPath();
    g.arc(-8.6, deck + 6.8, 0.55, 0, TAU);
    g.fill();
    // Der Mast mit dem Kamerakopf, der nach vorn schaut.
    g.fillStyle = weiss;
    g.fillRect(5.9, deck, 1.3, 9.8);
    g.fillStyle = weiss;
    g.beginPath();
    g.roundRect(4.4, deck + 9.4, 5.4, 2.8, 0.6);
    g.fill();
    g.fillStyle = dunkel;
    g.beginPath();
    g.arc(9.1, deck + 10.8, 0.75, 0, TAU);
    g.arc(7.4, deck + 10.8, 0.6, 0, TAU);
    g.fill();
    if (!geist) {
      g.fillStyle = "rgba(150, 230, 255, 0.9)";
      g.fillRect(9.15, deck + 10.95, 0.32, 0.32);
      g.fillStyle = "rgba(80, 56, 60, 0.35)";
      g.fillRect(4.4, deck + 9.4, 5.4, 0.9);
    }
    // Der gefaltete Arm vorn.
    g.strokeStyle = grau;
    g.lineWidth = 0.9;
    g.beginPath();
    g.moveTo(10.4, koerper + 3);
    g.lineTo(12.6, koerper + 0.6);
    g.lineTo(11.8, koerper - 2.2);
    g.stroke();
    g.fillStyle = dunkel;
    g.beginPath();
    g.arc(11.9, koerper - 2.6, 1.15, 0, TAU);
    g.fill();
    // Die roten Lampe auf dem Deck und die Scheinwerfer.
    if (!geist) {
      g.fillStyle = "#ffe9b8";
      g.fillRect(10.4, koerper + 3.4, 0.6, 0.8);
      g.fillRect(10.4, koerper + 1.4, 0.6, 0.8);
      const an = Math.sin(state.zeit * 4) > 0.2;
      g.fillStyle = an ? "#ff4a3a" : "#7a2a26";
      g.fillRect(-1.2, deck, 0.8, 0.6);
    }
    g.restore();
    g.restore();
    // Was leuchtet, kommt obendrauf (nicht gespiegelt).
    if (!geist && licht > 0) {
      const p = (x, y) => {
        const c = Math.cos(kipp);
        const sn = Math.sin(kipp);
        const xx = x * c - (y - koerper) * sn;
        const yy = koerper + x * sn + (y - koerper) * c;
        return [sx + xx * s, sy - yy * s];
      };
      const [lx, ly] = p(10.7, koerper + 2.8);
      schein("warm", lx, ly, 0.35 * s, 0.9 * licht);
      const an = Math.sin(state.zeit * 4) > 0.2 && licht > 0.5;
      if (an) {
        const [rx, ry] = p(-0.8, koerper + 5.5);
        schein("rot", rx, ry, 0.22 * s, 0.7);
      }
      if (antenne > 0.02) {
        const [ax, ay] = p(-8.6, koerper + 12);
        schein(rot ? "rot" : "puls", ax, ay, (0.5 + antenne * 0.6) * s, antenne);
      }
    }
  }

  // Ein Rad: Aluminium mit Stollen, innen dunkel, geschwungene Speichen.
  // In den Massen des Rovers (y nach oben).
  function radMalen(x, y, dreh, geist = null) {
    g.fillStyle = geist || "rgb(150, 142, 136)";
    g.beginPath();
    g.arc(x, y, RAD_R, 0, TAU);
    g.fill();
    if (geist) return;
    g.fillStyle = "rgb(40, 34, 34)";
    g.beginPath();
    g.arc(x, y, RAD_R * 0.74, 0, TAU);
    g.fill();
    // Die Stollen auf der Lauffläche.
    g.strokeStyle = "rgb(70, 62, 60)";
    g.lineWidth = 0.5;
    g.beginPath();
    for (let j = 0; j < 12; j += 1) {
      const w = -dreh + (j / 12) * TAU;
      g.moveTo(x + Math.cos(w) * RAD_R * 0.78, y + Math.sin(w) * RAD_R * 0.78);
      g.lineTo(x + Math.cos(w + 0.12) * RAD_R, y + Math.sin(w + 0.12) * RAD_R);
    }
    g.stroke();
    // Geschwungene Speichen.
    g.strokeStyle = "rgb(176, 168, 160)";
    g.lineWidth = 0.42;
    g.beginPath();
    for (let j = 0; j < 6; j += 1) {
      const w = -dreh + (j / 6) * TAU;
      g.moveTo(x + Math.cos(w) * RAD_R * 0.25, y + Math.sin(w) * RAD_R * 0.25);
      g.quadraticCurveTo(x + Math.cos(w + 0.5) * RAD_R * 0.55, y + Math.sin(w + 0.5) * RAD_R * 0.55, x + Math.cos(w + 0.35) * RAD_R * 0.74, y + Math.sin(w + 0.35) * RAD_R * 0.74);
    }
    g.stroke();
    g.fillStyle = "rgb(196, 190, 184)";
    g.beginPath();
    g.arc(x, y, RAD_R * 0.26, 0, TAU);
    g.fill();
    // Oben links fängt der Rand das letzte Licht.
    g.strokeStyle = "rgba(255, 206, 156, 0.75)";
    g.lineWidth = 0.45;
    g.beginPath();
    g.arc(x, y, RAD_R - 0.2, Math.PI * 0.55, Math.PI * 1.05);
    g.stroke();
  }

  // Wo die Spitze der Funkantenne im Bild ist.
  function antennenOrt() {
    const r = state.rover;
    return { x: bildX(r.x - 8.6), y: bildY(r.y + RAD_R + 6.4 + 5.2 + 6.8) };
  }

  // Die Haltung des Rovers für das Bild: wo die Räder stehen, wie er
  // federt, wie er sich neigt.
  function haltung() {
    const r = state.rover;
    const zeit = state.t;
    const fliegt = r.sprung !== null;
    const tau = fliegt ? zeit - r.sprung : 0;
    let raeder;
    let neig = 0;
    if (fliegt) {
      // Im Flug hängen die Räder aus, vorn ein wenig mehr; der Kasten
      // hebt die Nase und senkt sie zur Landung.
      const aus = clamp(tau / 0.08, 0, 1) * clamp((SPRUNG - tau) / 0.06, 0.35, 1) * 2.2;
      raeder = [-aus, -aus * 0.8, -aus * 1.1];
      neig = ruhig() ? 0 : 0.09 * (1 - (2 * tau) / SPRUNG);
    } else {
      const mitte = bodenSicht(r.x);
      const basis = mitte === -Infinity ? 0 : mitte;
      raeder = RAEDER.map((dx) => {
        const y = bodenSicht(r.x + dx);
        return y === -Infinity ? -2.4 : clamp(y - basis, -2.4, 3.5);
      });
    }
    // Federn nach der Landung: kurz ein, dann ausschwingen.
    const seit = zeit - r.landung;
    const feder = !ruhig() && seit >= 0 && seit < 0.5 ? 2.6 * Math.exp(-seit * 9) * Math.cos(seit * 26) : 0;
    const welle = (x) => { const y = bodenSicht(x); return y === -Infinity ? bodenWelle(x) : y; };
    const boden = fliegt ? lerp(welle(xBei(r.sprung)), welle(xBei(r.sprung + SPRUNG)), clamp(tau / SPRUNG, 0, 1)) : welle(r.x);
    return { raeder, neig, feder, boden };
  }

  function zeichneFigur() {
    const r = state.rover;
    const s = view.s;
    if (state.schritt === "sturz" && state.sturz) {
      zeichneSturz();
      return;
    }
    const h = haltung();
    const sx = bildX(r.x);
    const sy = bildY(r.y + h.boden);
    // Beim ersten Start gehen die Lichter erst an, wenn die Kamera unten ist.
    let licht = 1;
    if (state.intro) {
      const k = state.intro.t / state.intro.dauer;
      licht = k < 0.8 ? 0 : k < 0.9 ? (Math.sin(state.intro.t * 60) > 0 ? 1 : 0.2) : 1;
    }
    // Der Schatten: in der tiefen Sonne lang nach rechts, im Flug blasser.
    if (bodenSicht(r.x + 8) !== -Infinity) {
      g.fillStyle = `rgba(40, 16, 16, ${clamp(0.36 - r.y * 0.006, 0.08, 0.36)})`;
      g.beginPath();
      g.ellipse(bildX(r.x + 9 + r.y * 0.4), bildY(0.2), (17 + r.y * 0.2) * s, 1.6 * s, 0, 0, TAU);
      g.fill();
    }
    // Die Scheinwerfer werfen ihr Licht auf den Boden voraus.
    const kraft = clamp(1 - r.y / 8, 0, 1) * licht;
    if (kraft > 0.02) {
      const lx = sx + 11 * s;
      const ly = sy - 10 * s;
      const kegel = g.createLinearGradient(lx, 0, lx + 46 * s, 0);
      kegel.addColorStop(0, `rgba(255, 236, 196, ${0.22 * kraft})`);
      kegel.addColorStop(1, "rgba(255, 236, 196, 0)");
      g.fillStyle = kegel;
      g.beginPath();
      g.moveTo(lx, ly - 0.6 * s);
      g.lineTo(lx + 46 * s, bildY(-1));
      g.lineTo(lx + 46 * s, bildY(-5));
      g.lineTo(lx, ly + 0.8 * s);
      g.closePath();
      g.fill();
    }
    const blink = antennenBlink();
    zeichneRover(sx, sy, s, {
      raeder: h.raeder, neig: h.neig, feder: h.feder, dreh: r.x / RAD_R, antenne: blink.k, rot: blink.rot, licht,
    });
  }

  // Wie hell die Antenne gerade leuchtet: kurz nach jedem angekommenen
  // Befehl, rot, wenn er verpufft ist.
  function antennenBlink() {
    let k = 0;
    let rot = 0;
    for (let i = state.befehle.length - 1; i >= 0; i -= 1) {
      const b = state.befehle[i];
      if (b.zustand === 0) continue;
      const seit = state.t - b.an;
      if (seit < 0 || seit > 0.4) continue;
      const w = 1 - seit / 0.4;
      if (w > k) { k = w; rot = b.zustand === 2 ? 1 : 0; }
    }
    return { k, rot };
  }

  function zeichneSturz() {
    const f = state.sturz;
    const s = view.s;
    const sx = bildX(f.x);
    const sy = bildY(f.y);
    g.save();
    // Im Krater sieht man ihn nur in der Öffnung – nicht durch die Wände.
    if (f.grube && !f.grube.schlucht) {
      g.beginPath();
      g.rect(-50, -50, view.cssW + 100, bildY(3) + 50);
      kraterLoch(f.grube);
      g.clip();
    }
    g.translate(sx, sy - 9 * s);
    g.rotate(-f.dreh);
    g.translate(-sx, -(sy - 9 * s));
    zeichneRover(sx, sy, s, { raeder: [-1, -0.5, -1.5], feder: 0, dreh: f.x / RAD_R, ohne: 2, antenne: 0, licht: f.zeit < 0.3 || Math.sin(f.zeit * 30) > 0.6 ? 1 : 0 });
    g.restore();
    // Das Rad, das wegfliegt.
    const rad = f.rad;
    g.save();
    g.translate(bildX(rad.x), bildY(rad.y));
    g.scale(s, -s);
    radMalen(0, 0, rad.dreh);
    g.restore();
  }

  // Die Gegner als Rover aus Licht (geist.js).
  function zeichneGeister() {
    if (!gegner || state.phase === "bereit") return;
    const orte = window.LernappGeist?.orte?.(gegner) || [];
    if (!orte.length) return;
    const namen = [];
    orte.forEach((o) => {
      if (o.ziel) return;
      const x = o.a;
      const sx = bildX(x);
      if (sx < -40 || sx > view.cssW + 40) return;
      const y = Math.max(0, o.b / 10);
      const sy = bildY(y);
      zeichneRover(sx, sy, view.s, { geist: o.farbe, alpha: 0.5 * o.blass });
      const dx = x - state.rover.x;
      namen.push({ ...o, sx, sy: sy - (TOP + 8) * view.s, weit: `${dx > 0 ? "+" : ""}${Math.round(dx / METER)} m` });
    });
    window.LernappGeist.namen(g, namen, { breit: view.cssW, hoch: view.cssH });
  }

  // ---------------------------------------------------------------------------
  // Zeichnen: Spuren, Marken, Signale, Staub, Schrift
  // ---------------------------------------------------------------------------
  // Die Spur der Räder im Sand: wo er am Boden war, kleine Eindrücke.
  function zeichneSpur() {
    const s = view.s;
    const von = state.camX - view.rx / s - 4;
    g.fillStyle = "rgba(66, 30, 24, 0.5)";
    for (let i = state.spur.length - 1; i >= 0; i -= 1) {
      const [a, b] = state.spur[i];
      if (b < von) break;
      const start = Math.max(a, von);
      const ende = Math.min(b, state.rover.x - LH);
      for (let x = Math.ceil(start / 3.2) * 3.2; x < ende; x += 3.2) {
        const y = bodenSicht(x);
        if (y === -Infinity) continue;
        g.fillRect(bildX(x), bildY(y) + 0.6, Math.max(1, 1.4 * s), Math.max(1, 0.7 * s));
      }
    }
  }

  // Die Marke am Boden, wo ein Befehl den Sprung beginnen lässt: dezent,
  // und sie verblasst, sobald er dort ist.
  function zeichneMarken() {
    const s = view.s;
    state.befehle.forEach((b) => {
      if (b.los) return;
      const seit = state.t - b.ab;
      const bis = state.t - b.an;
      if (bis > 0.35) return;
      const x = bildX(b.x);
      if (x < -10 || x > view.cssW + 10) return;
      const y = bildY(bodenWelle(b.x));
      const k = clamp(seit / 0.08, 0, 1) * (bis > 0 ? 1 - bis / 0.35 : 1);
      const verpufft = b.zustand === 2;
      g.globalAlpha = k * 0.55;
      g.fillStyle = verpufft ? "rgb(255, 150, 120)" : "rgb(190, 240, 255)";
      g.beginPath();
      g.moveTo(x, y - 1.2 * s);
      g.lineTo(x - 2.2 * s, y + 1.4 * s);
      g.lineTo(x + 2.2 * s, y + 1.4 * s);
      g.closePath();
      g.fill();
      g.globalAlpha = k * 0.3;
      g.fillRect(x - 0.35 * s, y - 9 * s, 0.7 * s, 7.6 * s);
      g.globalAlpha = 1;
    });
  }

  // Die Signale: ein Lichtpuls von der Erde zur Antenne – er kommt genau
  // dann an, wenn der Befehl ankommt.
  function zeichneSignale() {
    const erde = erdeOrt();
    const oben = view.pan * LAGEN_PAN.himmel - view.extra;
    const ex = erde.x;
    const ey = erde.y + oben;
    const ziel = antennenOrt();
    const schatten = state.abschnitte[abschnittBei(state.t)]?.besonders === "schatten";
    state.befehle.forEach((b) => {
      const f = (state.t - b.ab) / (b.an - b.ab);
      if (f < 0 || f > 1) return;
      const x = lerp(ex, ziel.x, f);
      const y = lerp(ey, ziel.y, f);
      // Eine feine Spur hinter dem Puls.
      const zx = lerp(ex, ziel.x, Math.max(0, f - 0.22));
      const zy = lerp(ey, ziel.y, Math.max(0, f - 0.22));
      const spur = g.createLinearGradient(zx, zy, x, y);
      spur.addColorStop(0, "rgba(170, 230, 255, 0)");
      spur.addColorStop(1, `rgba(200, 240, 255, ${b.D > b.basis + 0.01 ? 0.45 : 0.7})`);
      g.strokeStyle = spur;
      g.lineWidth = 1.6;
      g.beginPath();
      g.moveTo(zx, zy);
      g.lineTo(x, y);
      g.stroke();
      const flackern = b.D > b.basis + 0.01 && !ruhig() ? 0.6 + 0.4 * Math.sin(state.zeit * 40 + b.ab * 9) : 1;
      schein("puls", x, y, 0.85, flackern);
      g.fillStyle = "#f4fdff";
      g.beginPath();
      g.arc(x, y, 1.6, 0, TAU);
      g.fill();
    });
    // Im Funkschatten: Phobos vor der Erde – ein feiner Ring um sie.
    if (schatten && state.phase === "spiel") {
      g.strokeStyle = `rgba(255, 170, 110, ${0.5 + 0.3 * Math.sin(state.zeit * 5)})`;
      g.lineWidth = 1.2;
      g.beginPath();
      g.arc(ex, ey, 12, 0, TAU);
      g.stroke();
    }
  }

  function zeichneTeile() {
    if (!state.teile.length) return;
    state.teile.forEach((t) => {
      const k = clamp(t.leben / t.max, 0, 1);
      const x = bildX(t.x);
      const y = bildY(t.y);
      if (t.art === "staub") {
        schein("staub", x, y, (t.r * (1.6 - 0.8 * k) * view.s) / 11, k * t.kraft);
      } else if (t.art === "funke") {
        g.globalAlpha = k;
        g.fillStyle = "#ffe6a8";
        g.fillRect(x, y, 1.6, 1.6);
        g.globalAlpha = 1;
      } else {
        g.globalAlpha = Math.min(1, k * 2);
        g.fillStyle = "rgb(96, 50, 38)";
        g.fillRect(x - t.r * view.s * 0.5, y - t.r * view.s * 0.5, t.r * view.s, t.r * view.s);
        g.globalAlpha = 1;
      }
    });
  }

  // Feiner Staub, der im Abendwind treibt.
  const KOERNER = Array.from({ length: 46 }, (_, i) => ({
    x: hash01(i * 2.9 + 4), y: hash01(i * 6.1 + 7), r: 0.5 + hash01(i * 8.3) * 1.1, v: 0.03 + hash01(i * 4.7) * 0.06, p: 0.3 + hash01(i * 1.9) * 1.1,
  }));
  function zeichneKoerner() {
    if (ruhig()) return;
    const W = view.cssW;
    const H = view.cssH;
    g.fillStyle = "rgba(250, 214, 174, 0.5)";
    KOERNER.forEach((k) => {
      const x = (((k.x - state.zeit * k.v - (state.camX * view.s * k.p) / W / 3) % 1) + 1) % 1;
      const y = view.frei + (k.y * 0.85 + 0.1 * Math.sin(state.zeit * 0.6 + k.x * 9)) * (H - view.frei);
      g.globalAlpha = 0.35 + 0.35 * Math.sin(state.zeit * 1.3 + k.y * 7);
      g.fillRect(x * W, y, k.r, k.r);
    });
    g.globalAlpha = 1;
  }

  function zeichneSchriften() {
    if (!state.schriften.length) return;
    g.lineJoin = "round";
    g.textAlign = "center";
    g.textBaseline = "middle";
    state.schriften.forEach((t) => {
      const k = clamp(t.leben / t.max, 0, 1);
      const gross = Math.round(clamp(t.gross * view.s * 0.5, 12, 22));
      g.font = `800 ${gross}px system-ui, sans-serif`;
      const x = clamp(bildX(t.x), 40, view.cssW - 40);
      const y = bildY(t.y) - (1 - k) * 14;
      g.globalAlpha = Math.min(1, k * 2.4);
      g.lineWidth = Math.max(3, gross * 0.22);
      g.strokeStyle = "rgba(30, 12, 12, 0.85)";
      g.strokeText(t.text, x, y);
      g.fillStyle = t.farbe;
      g.fillText(t.text, x, y);
    });
    g.globalAlpha = 1;
  }

  // Oben im Bild: der Verzug, darunter die Funkstrecke mit den Befehlen,
  // die gerade unterwegs sind; dazu die Ansagen.
  function zeichneAnzeige() {
    if (state.phase === "bereit") return;
    g.lineJoin = "round";
    const W = view.cssW;
    const nr = abschnittBei(Math.max(state.t, -VERZUG0));
    const a = state.abschnitte[nr];
    if (!a) return;
    const schatten = a.besonders === "schatten";
    const y = view.frei + 18 + view.pan * 0.2;
    const blitz = state.stufeBlitz;
    const gross = Math.round(15 + blitz * 5);
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.font = `800 ${gross}px system-ui, sans-serif`;
    const text = `${schatten ? "Funkschatten · " : ""}Signal ${sekunden(a.D)}`;
    g.lineWidth = 4;
    g.strokeStyle = "rgba(34, 14, 18, 0.75)";
    g.strokeText(text, W / 2, y);
    g.fillStyle = schatten ? "#ffb27a" : blitz > 0.01 ? rgb(mix3([255, 255, 255], [255, 226, 120], blitz)) : "#ffffff";
    g.fillText(text, W / 2, y);
    // Gewachsen: «+0,05 s» daneben, steigt auf und verblasst.
    if (blitz > 0.01 && !schatten && state.stufeUm > 0) {
      const breit = g.measureText(text).width;
      g.font = "800 13px system-ui, sans-serif";
      g.textAlign = "left";
      g.globalAlpha = Math.min(1, blitz * 1.6);
      const um = `+${state.stufeUm.toFixed(2).replace(".", ",")} s`;
      g.lineWidth = 3;
      g.strokeText(um, W / 2 + breit / 2 + 8, y - (1 - blitz) * 10);
      g.fillStyle = "#ffe38a";
      g.fillText(um, W / 2 + breit / 2 + 8, y - (1 - blitz) * 10);
      g.globalAlpha = 1;
      g.textAlign = "center";
    }
    // Die Funkstrecke: links die Erde, rechts der Mars, dazwischen jeder
    // Befehl, der unterwegs ist.
    const breit = Math.min(150, W * 0.38);
    const x0 = W / 2 - breit / 2;
    const yy = y + 16;
    g.strokeStyle = "rgba(255, 236, 214, 0.35)";
    g.lineWidth = 1.5;
    g.beginPath();
    g.moveTo(x0 + 6, yy);
    g.lineTo(x0 + breit - 6, yy);
    g.stroke();
    g.fillStyle = "#8fd0ff";
    g.beginPath();
    g.arc(x0 + 3, yy, 3, 0, TAU);
    g.fill();
    g.fillStyle = "#e0764a";
    g.beginPath();
    g.arc(x0 + breit - 3, yy, 3.4, 0, TAU);
    g.fill();
    state.befehle.forEach((b) => {
      const f = (state.t - b.ab) / (b.an - b.ab);
      if (f < 0 || f > 1) return;
      const x = lerp(x0 + 6, x0 + breit - 6, f);
      schein("puls", x, yy, 0.35, 0.9);
      g.fillStyle = "#ffffff";
      g.beginPath();
      g.arc(x, yy, 2, 0, TAU);
      g.fill();
    });
    // Die Ansage: was kommt.
    const an = state.ansage;
    if (an && an.leben > 0) {
      const k = clamp(an.leben / an.max, 0, 1);
      const sicht = Math.min(1, k * 3) * Math.min(1, (an.max - an.leben) * 6);
      const ya = y + 46;
      g.globalAlpha = sicht;
      g.font = "900 19px system-ui, sans-serif";
      g.lineWidth = 5;
      g.strokeStyle = "rgba(34, 14, 18, 0.8)";
      g.strokeText(an.text, W / 2, ya);
      g.fillStyle = an.farbe;
      g.fillText(an.text, W / 2, ya);
      if (an.unter) {
        g.font = "700 13px system-ui, sans-serif";
        g.lineWidth = 4;
        g.strokeText(an.unter, W / 2, ya + 20);
        g.fillStyle = "#ffeedd";
        g.fillText(an.unter, W / 2, ya + 20);
      }
      g.globalAlpha = 1;
    }
  }

  // Nach dem Sturz: der Funkspruch, im Rauschen.
  function zeichneVerloren() {
    const f = state.sturz;
    if (!f || f.zeit < 0.5) return;
    const W = view.cssW;
    const H = view.cssH;
    const k = clamp((f.zeit - 0.5) / 0.3, 0, 1);
    if (!ruhig()) {
      g.fillStyle = "rgba(255, 240, 230, 0.06)";
      for (let i = 0; i < 26; i += 1) {
        const y = (hash01(i * 3.3 + Math.floor(state.zeit * 24) * 0.71) * H) | 0;
        g.fillRect(0, y, W, 1 + (i % 3));
      }
    }
    const y = view.frei + (view.boden - view.frei) * 0.42;
    g.lineJoin = "round";
    g.globalAlpha = k * (ruhig() ? 1 : 0.85 + 0.15 * Math.sin(state.zeit * 50));
    g.textAlign = "center";
    g.textBaseline = "middle";
    const gross = Math.round(clamp(W * 0.065, 20, 34));
    g.font = `800 ${gross}px ui-monospace, Menlo, Consolas, monospace`;
    g.lineWidth = 6;
    g.strokeStyle = "rgba(20, 8, 10, 0.85)";
    g.strokeText("VERBINDUNG VERLOREN", W / 2, y);
    g.fillStyle = "#ff9a76";
    g.fillText("VERBINDUNG VERLOREN", W / 2, y);
    g.font = "600 13px ui-monospace, Menlo, Consolas, monospace";
    g.lineWidth = 4;
    const unter = `Letzter Kontakt bei ${state.punkte} m`;
    g.strokeText(unter, W / 2, y + gross * 0.9);
    g.fillStyle = "#ffe4d4";
    g.fillText(unter, W / 2, y + gross * 0.9);
    g.globalAlpha = 1;
  }

  function zeichnen() {
    if (!g || !ebenen) return;
    const abend = abendBei(state.camX);
    himmelPruefen(abend);
    const wackel = ruhig() ? 0 : Math.sin(state.zeit * 60) * 4 * state.stoss;
    zeichneLandschaft();
    g.setTransform(view.dpr, 0, 0, view.dpr, Math.round(wackel * view.dpr), 0);
    sichtbareHindernisse((o) => { if (o.art === "krater") zeichneKrater(o); else if (o.art === "bogen") bogenPfeiler(o); });
    zeichneSpur();
    zeichneMarken();
    sichtbareHindernisse((o) => { if (o.art === "fels") zeichneFels(o); });
    zeichneGeister();
    zeichneFigur();
    sichtbareHindernisse((o) => { if (o.art === "bogen") bogenBruecke(o); });
    zeichneTeile();
    g.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
    zeichneVorn();
    zeichneSignale();
    zeichneKoerner();
    zeichneSchriften();
    zeichneAnzeige();
    zeichneVerloren();
  }

  // ---------------------------------------------------------------------------
  // Was aufstiebt
  // ---------------------------------------------------------------------------
  function teile(art, x, y, n, kraft, richtung = 0) {
    if (ruhig()) return;
    for (let i = 0; i < n; i += 1) {
      const w = Math.random() * Math.PI;
      const v = (6 + Math.random() * 22) * kraft;
      const leben = art === "staub" ? 0.7 + Math.random() * 0.9 : 0.4 + Math.random() * 0.5;
      state.teile.push({
        art, x, y, vx: Math.cos(w) * v + richtung, vy: Math.sin(w) * v * (art === "staub" ? 0.5 : 1.4),
        r: art === "staub" ? 4 + Math.random() * 5 * kraft : 0.8 + Math.random() * 1.2, leben, max: leben, kraft: art === "staub" ? 0.55 : 1,
      });
    }
    if (state.teile.length > 160) state.teile.splice(0, state.teile.length - 160);
  }

  function schrift(text, farbe, x, y, gross = 30) {
    state.schriften = [{ text, farbe, x, y, gross, leben: 0.8, max: 0.8 }];
  }

  function ansage(text, unter, farbe = "#ffffff", dauer = 2.2) {
    state.ansage = { text, unter, farbe, leben: dauer, max: dauer };
  }

  // ---------------------------------------------------------------------------
  // Funken, springen, landen, stürzen
  // ---------------------------------------------------------------------------
  function senden() {
    const D = verzugBei(state.t);
    const a = state.abschnitte[abschnittBei(state.t)];
    const an = state.t + D;
    state.befehle.push({ ab: state.t, an, D, basis: a?.basis ?? D, x: xBei(an), zustand: 0 });
    state.gesendet += 1;
    klang()?.ton?.("marsrover.funk", { laut: 0.7 });
    kids()?.vibrate?.(6);
  }

  function absprung(t) {
    const r = state.rover;
    r.sprung = t;
    r.absprung = t;
    state.spruenge += 1;
    klang()?.ton?.("marsrover.sprung");
    teile("staub", r.x - 6, 1, 6, 0.9, -10);
    // Die Spur endet hier.
    const letzte = state.spur[state.spur.length - 1];
    if (letzte) letzte[1] = Math.min(letzte[1], xBei(t));
  }

  function landen(t) {
    const r = state.rover;
    r.sprung = null;
    r.landung = t;
    klang()?.ton?.("marsrover.landung");
    const x = xBei(t);
    teile("staub", x - 8, 1, 7, 1.1, -14);
    teile("staub", x + 8, 1, 4, 0.8, 6);
    state.spur.push([x - LH, x - LH]);
  }

  // Ein Befehl kommt an: Am Boden springt er, in der Luft verpufft er.
  function ankunft(b) {
    const r = state.rover;
    if (b.los) { b.zustand = 3; return; }
    if (r.sprung !== null && b.an < r.sprung + SPRUNG) {
      b.zustand = 2;
      state.verpufft += 1;
      klang()?.ton?.("marsrover.verpufft", { laut: 0.8 });
      schrift("verpufft", "#ffb59a", r.x, r.y + TOP + 10, 24);
      return;
    }
    if (r.sprung !== null) {
      landen(r.sprung + SPRUNG);
      const drin = trifft(xBei(r.landung), 0, false);
      if (drin) { b.zustand = 2; sturz(drin); return; }
    }
    // Am Boden: Steht er schon im Krater, hilft kein Sprung mehr.
    const o = trifft(xBei(b.an), 0, false);
    if (o) { b.zustand = 2; sturz(o); return; }
    b.zustand = 1;
    absprung(b.an);
  }

  function sturz(o, nurBild = false) {
    if (state.schritt === "sturz") return;
    const r = state.rover;
    state.schritt = "sturz";
    const grube = o?.art === "krater";
    const warum = grube ? (o.schlucht ? "schlucht" : "krater") : (o?.art || "fels");
    const v = tempoBei(Math.max(0, state.t));
    state.sturz = {
      warum, zeit: 0, x: r.x, y: r.y,
      vx: grube ? v * 0.5 : warum === "bogen" ? v * 0.25 : -v * 0.15,
      vy: grube ? 0 : warum === "bogen" ? -40 : 75,
      dreh: 0,
      drehV: grube ? -2.6 : warum === "bogen" ? -1.6 : 3.2,
      // In einem Krater bleibt er unten liegen, in der Schlucht fällt er ins Dunkel.
      boden: grube ? (o.schlucht ? -600 : -kraterTiefe(o) + 9) : 0,
      grube: grube ? o : null,
      rad: { x: r.x + RAEDER[2], y: r.y + RAD_R, vx: v * 0.45, vy: 110 + Math.random() * 40, dreh: 0 },
    };
    state.stoss = 1;
    klangAus();
    if (grube) {
      klang()?.ton?.("marsrover.fall");
      teile("staub", r.x, 0, 10, 1.2, 0);
    } else {
      klang()?.ton?.("marsrover.krach");
      teile("staub", r.x + 10, r.y + 6, 16, 1.6, -20);
      teile("funke", r.x + 12, r.y + 8, 12, 2.2, -10);
      teile("stein", r.x + 12, r.y + 4, 8, 1.6, -20);
    }
    verlorenTimer = window.setTimeout(() => { klang()?.ton?.("marsrover.verloren"); }, 520);
    kids()?.vibrate?.([30, 40, 70]);
    if (nurBild) return;
    stepTimer = window.setTimeout(finish, ruhig() ? 900 : STURZ_MS);
  }

  function sturzTakt(dt) {
    const f = state.sturz;
    if (!f) return;
    f.zeit += dt;
    f.vy -= 240 * dt;
    f.x += f.vx * dt;
    f.y += f.vy * dt;
    f.dreh += f.drehV * dt;
    if (f.grube) {
      // In den Krater: vorn zuerst hinunter, bis er im Dunkel verschwindet.
      f.vx *= 1 - 1.5 * dt;
      const mitte = (f.grube.a + f.grube.b) / 2;
      f.x = clamp(f.x, f.grube.a + LH * 0.5, Math.max(mitte, f.grube.b - LH * 1.1));
      if (f.y < f.boden) {
        f.y = f.boden;
        if (f.vy < -40) teile("staub", f.x, f.boden + 2, 6, 1.2, 0);
        f.vy = f.vy < -40 ? -f.vy * 0.2 : 0;
        f.drehV *= 0.3;
      }
      if (f.y <= f.boden + 0.5) f.dreh += (-1.15 - f.dreh) * Math.min(1, dt * 5);
      if (f.zeit > 0.35 && f.zeit < 0.6 && Math.random() < dt * 30) teile("staub", f.grube.a + Math.random() * (f.grube.b - f.grube.a), 0, 1, 1.4, 0);
    } else if (f.y < 0) {
      // Auf den Boden: aufschlagen, rutschen, liegen bleiben.
      f.y = 0;
      f.vy = Math.abs(f.vy) > 30 ? -f.vy * 0.25 : 0;
      f.vx *= 0.5;
      f.drehV *= 0.4;
      if (Math.abs(f.vy) > 1) teile("staub", f.x, 0, 5, 1, 0);
    }
    if (!f.grube && f.y === 0) {
      f.vx *= 1 - 4 * dt;
      // Er kippt auf die Seite, auf der er liegt.
      const ziel = Math.round(f.dreh / (Math.PI / 2)) * (Math.PI / 2) * 0.35;
      f.dreh += (ziel - f.dreh) * Math.min(1, dt * 6);
    }
    const rad = f.rad;
    rad.vy -= 240 * dt;
    rad.x += rad.vx * dt;
    rad.y += rad.vy * dt;
    rad.dreh += rad.vx * dt * 0.3;
    // Der Boden für das Rad: die Ebene – oder der Grund eines Kraters.
    let grund = RAD_R;
    if (bodenSicht(rad.x) === -Infinity) {
      const o = state.hindernisse[abIndex(rad.x)];
      grund = o && o.art === "krater" && !o.schlucht && rad.x > o.a && rad.x < o.b ? -kraterTiefe(o) + RAD_R : -9999;
    }
    if (rad.y < grund && rad.vy < 0) {
      rad.y = grund;
      rad.vy = Math.abs(rad.vy) > 20 ? -rad.vy * 0.4 : 0;
      rad.vx *= 0.7;
    }
  }

  function physik(dt) {
    const r = state.rover;
    const n = Math.max(1, Math.ceil(dt / TAKT - 1e-9));
    const h = dt / n;
    for (let i = 0; i < n; i += 1) {
      if (state.schritt === "sturz") return;
      state.t += h;
      // Was angekommen ist, der Reihe nach (nach einem Funkschatten kann
      // ein späterer Befehl einen früheren überholen).
      for (;;) {
        let b = null;
        for (const x of state.befehle) if (x.zustand === 0 && x.an <= state.t && (!b || x.an < b.an)) b = x;
        if (!b) break;
        ankunft(b);
        if (state.schritt === "sturz") return;
      }
      if (r.sprung !== null && state.t >= r.sprung + SPRUNG) {
        landen(r.sprung + SPRUNG);
        const o = trifft(xBei(r.landung), 0, false);
        if (o) { sturz(o); return; }
      }
      r.x = xBei(state.t);
      r.y = r.sprung !== null ? bogenY(state.t - r.sprung) : 0;
      const o = trifft(r.x, r.y, r.sprung !== null);
      if (o) {
        sturz(o);
        return;
      }
      if (r.sprung === null && state.t > 0) {
        const letzte = state.spur[state.spur.length - 1];
        if (letzte && letzte[1] >= r.x - LH - 8) letzte[1] = r.x - LH;
        else state.spur.push([r.x - LH, r.x - LH]);
        if (state.spur.length > 60) state.spur.shift();
      }
      const meter = Math.floor(r.x / METER);
      if (meter !== state.punkte) {
        state.punkte = meter;
        shell.setCount(meter);
      }
    }
  }

  // Der Tipp – zu der Zeit, zu der er geschah (jetzt, wie performance.now).
  function tippen(jetzt) {
    if (state.phase === "zuschauen" || state.phase === "ende") return;
    if (state.phase === "bereit") {
      losGehts();
      return;
    }
    if (state.phase !== "spiel" || state.schritt === "sturz") return;
    if (Number.isFinite(jetzt) && last) {
      const mehr = clamp((jetzt - last) / 1000 - voraus, 0, 0.05);
      if (mehr > 0) {
        physik(mehr);
        voraus += mehr;
      }
      if (state.schritt === "sturz") return;
    }
    senden();
  }

  // ---------------------------------------------------------------------------
  // Zuschauen
  // ---------------------------------------------------------------------------
  function zuschauenStarten() {
    if (!zuschauer?.lauf) return;
    startRun();
    state.phase = "zuschauen";
    state.schritt = "fahrt";
    state.t = -VERZUG0;
    shell.setPhase("play");
    zuschauer.los();
    klangAn();
  }

  // Woran ein Lauf zu Ende ging, aus der Stelle, an der er aufhört.
  function warumAm(x, y) {
    const o = trifft(x, y, y > 0.5);
    if (o) return o;
    const liste = state.hindernisse;
    for (let i = abIndex(x - LH - 20); i < liste.length; i += 1) {
      if (liste[i].a > x + LH + 30) break;
      return liste[i];
    }
    return { art: "fels" };
  }

  // Der Rover steht, wo die Aufzeichnung ihn hat (a: der Weg, b: die Höhe
  // in Zehnteln, c: ob er fliegt und wie viele Befehle schon gefunkt sind).
  function zuschauenTakt(dt) {
    const s = zuschauer.stand();
    if (!s) return;
    const r = state.rover;
    if (state.schritt !== "sturz") {
      const x = Math.max(0, s.a);
      state.t = x > 0.5 ? Math.max(state.t, tBei(x)) : Math.min(0, state.t + dt);
      const c = Math.max(0, Math.round(s.c));
      const fliegt = (c & 1) === 1;
      const gefunkt = c >> 1;
      while (state.gesendet < gefunkt) {
        const D = verzugBei(state.t);
        const a = state.abschnitte[abschnittBei(state.t)];
        state.befehle.push({ ab: state.t, an: state.t + D, D, basis: a?.basis ?? D, x: xBei(state.t + D), zustand: 0, los: state.gesendet === 0 });
        state.gesendet += 1;
        klang()?.ton?.("marsrover.funk", { laut: 0.5 });
      }
      state.befehle.forEach((b) => { if (b.zustand === 0 && b.an <= state.t) b.zustand = b.los ? 3 : 1; });
      if (fliegt && r.sprung === null) { r.sprung = state.t; r.absprung = state.t; teile("staub", x - 6, 1, 5, 0.9, -10); }
      if (!fliegt && r.sprung !== null) { r.sprung = null; r.landung = state.t; teile("staub", x - 8, 1, 6, 1, -14); }
      r.x = x;
      r.y = Math.max(0, s.b / 10);
      if (r.sprung === null && state.t > 0) {
        const letzte = state.spur[state.spur.length - 1];
        if (letzte && letzte[1] >= r.x - LH - 8) letzte[1] = r.x - LH;
        else state.spur.push([r.x - LH, r.x - LH]);
      }
      const punkte = Math.max(0, Math.floor(s.punkte));
      if (punkte !== state.punkte) {
        state.punkte = punkte;
        shell.setCount(punkte);
      }
      klangStellen();
    }
    if (!zuschauer.weiter() && state.schritt !== "sturz") sturz(warumAm(r.x, r.y), true);
    if (state.schritt === "sturz") sturzTakt(dt);
  }

  // ---------------------------------------------------------------------------
  // Der Takt
  // ---------------------------------------------------------------------------
  // Ein neuer Abschnitt: wächst der Verzug, merkt man es; ein besonderer
  // wird vorher angesagt.
  function abschnittPruefen() {
    const nr = abschnittBei(state.t);
    if (nr === state.abschnitt) return;
    const alt = state.abschnitte[state.abschnitt];
    const a = state.abschnitte[nr];
    state.abschnitt = nr;
    if (!a || !alt) return;
    const naechster = state.abschnitte[nr + 1];
    if (a.besonders === "schatten") {
      ansage("Funkschatten", `Phobos vor der Erde – Signal ${sekunden(a.D)}`, "#ffb27a", 2.4);
      state.stufeBlitz = 1;
      klang()?.ton?.("marsrover.stufe");
    } else if (alt.besonders === "schatten") {
      ansage("Wieder freie Sicht", `Signal ${sekunden(a.D)}`, "#cfeaff", 1.6);
    } else if (a.D > alt.D + 0.001) {
      state.stufeBlitz = 1;
      state.stufeUm = a.D - alt.D;
      klang()?.ton?.("marsrover.stufe", { laut: 0.5 });
    }
    if (naechster?.besonders === "schatten") ansage("Funkschatten voraus", "Phobos zieht vor die Erde", "#ffd2a8", 2);
    else if (naechster?.besonders === "schlucht") ansage("Schlucht voraus", "Felsinseln – Sprung um Sprung", "#ffd2a8", 2);
  }

  function takt(dt, strecke = dt) {
    state.zeit += dt;
    const r = state.rover;
    if (state.stoss > 0) state.stoss = Math.max(0, state.stoss - dt * 3);
    if (state.stufeBlitz > 0) state.stufeBlitz = Math.max(0, state.stufeBlitz - dt * 1.6);
    if (state.ansage) { state.ansage.leben -= dt; if (state.ansage.leben <= 0) state.ansage = null; }
    if (state.intro) {
      state.intro.t += dt;
      const k = clamp(state.intro.t / state.intro.dauer, 0, 1);
      view.pan = Math.round(view.panMax * (1 - glatt(k) ** 0.9));
      if (k >= 1) {
        state.intro = null;
        view.pan = 0;
        host.dataset.intro = "aus";
      }
    }

    if (state.phase === "zuschauen") {
      zuschauenTakt(dt);
      abschnittPruefen();
    } else if (state.schritt === "sturz") {
      sturzTakt(dt);
    } else if (state.phase === "spiel") {
      if (strecke > 0) physik(strecke);
      if (state.schritt !== "sturz") abschnittPruefen();
      klangStellen();
    }

    // Staub hinter den Rädern, solange er fährt.
    if (state.schritt === "fahrt" && r.sprung === null && state.t > 0.05 && !ruhig() && Math.random() < dt * 22) {
      teile("staub", r.x - 11 - Math.random() * 3, 0.8, 1, 0.6, -tempoBei(state.t) * 0.12);
    }
    for (let i = state.teile.length - 1; i >= 0; i -= 1) {
      const t = state.teile[i];
      if (t.art === "staub") {
        t.vx *= 1 - 1.6 * dt;
        t.vy = t.vy * (1 - 1.2 * dt) + 3 * dt;
      } else {
        t.vy -= 160 * dt;
        t.vx *= 1 - 1.2 * dt;
      }
      t.x += t.vx * dt;
      t.y += t.vy * dt;
      if (t.art !== "staub" && t.y < 0 && bodenSicht(t.x) !== -Infinity) { t.y = 0; t.vy *= -0.3; t.vx *= 0.6; }
      t.leben -= dt;
      if (t.leben <= 0) state.teile.splice(i, 1);
    }
    for (let i = state.schriften.length - 1; i >= 0; i -= 1) {
      state.schriften[i].leben -= dt;
      if (state.schriften[i].leben <= 0) state.schriften.splice(i, 1);
    }
    // Was angekommen und lange vorbei ist, fällt weg.
    if (state.befehle.length > 12) state.befehle = state.befehle.filter((b) => b.zustand === 0 || state.t - b.an < 1);

    // Die Kamera bleibt beim Rover; beim Sturz gleitet sie ein Stück zurück,
    // bis der Unfall ein Drittel weit im Bild liegt.
    if (state.schritt !== "sturz") state.camX = r.x;
    else if (state.sturz) {
      const ziel = state.sturz.x - Math.max(0, view.cssW * 0.36 - view.rx) / view.s;
      state.camX += (ziel - state.camX) * (1 - Math.exp(-dt * 3.2));
    }
    planBis(state.t + 9, 2);

    if (state.phase === "spiel" && state.schritt !== "sturz") {
      gegner?.takt(state.punkte, { a: Math.round(r.x), b: Math.round(r.y * 10), c: (r.sprung !== null ? 1 : 0) + 2 * state.gesendet });
    }
  }

  function loop(now) {
    frame = window.requestAnimationFrame(loop);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const strecke = Math.max(0, dt - voraus);
    voraus = 0;
    messen();
    takt(dt, strecke);
    zeichnen();
  }

  // Die Runde beginnt: mit dem ersten Tipp – oder im Live-Modus zum
  // gemeinsamen Start. Auch das ist ein Funkspruch: «Losfahren». Er braucht
  // seine Zeit, dann rollt der Rover an (bei der Spielzeit null).
  function losGehts() {
    if (state.phase !== "bereit") return;
    state.phase = "spiel";
    state.schritt = "fahrt";
    state.t = -VERZUG0;
    state.befehle.push({ ab: -VERZUG0, an: 0, D: VERZUG0, basis: VERZUG0, x: 0, zustand: 0, los: true });
    state.gesendet = 1;
    klang()?.ton?.("marsrover.funk", { laut: 0.7 });
    if (state.intro) state.intro.t = Math.max(state.intro.t, state.intro.dauer - 0.45);
    shell.setPhase("play");
    gegner?.los();
    klangAn();
    kids()?.vibrate?.(8);
  }

  // ---------------------------------------------------------------------------
  // Ablauf
  // ---------------------------------------------------------------------------
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
    state.t = 0;
    state.rover = { x: 0, y: 0, sprung: null, landung: -9, absprung: -9 };
    state.befehle = [];
    state.gesendet = 0;
    state.spruenge = 0;
    state.verpufft = 0;
    state.sturz = null;
    state.teile = [];
    state.schriften = [];
    state.ansage = null;
    state.spur = [];
    state.zeit = 0;
    state.stoss = 0;
    state.stufeBlitz = 0;
    state.camX = 0;
    streckeNeu();
    voraus = 0;
    shell.setCount(0);
    gegner?.runde();

    // Beim ersten Start gleitet die Kamera vom Sternenhimmel hinunter.
    state.intro = ersterStart && !zuschauer && !shell.live && !ruhig() ? { t: 0, dauer: 3.6 } : null;
    ersterStart = false;
    host.dataset.intro = state.intro ? "an" : "aus";

    shell.clear();
    const prompt = shell.el("p", "cm-prompt mr-prompt", "Tippen – der Befehl braucht Zeit bis zum Mars.");
    shell.play.append(prompt, buildPlatz());
    view.cssW = 0;
    view.cssH = 0;
    messen();
    view.pan = state.intro ? view.panMax : 0;

    last = performance.now();
    frame = window.requestAnimationFrame(loop);
  }

  function zaehleHoch(ziel) {
    const zahl = host.querySelector(".cm-result-score");
    if (!zahl) return;
    if (ruhig() || ziel <= 1) { zahl.textContent = String(ziel); return; }
    const dauer = Math.min(900, 160 + ziel * 2);
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
    krater: "In einen Krater gestürzt",
    schlucht: "In die Schlucht gestürzt",
    fels: "An einem Felsen zerschellt",
    bogen: "Unter dem Felsbogen angestossen",
  };

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
    const warum = WARUM[state.sturz?.warum] || "";
    const zeit = `${Math.max(0, Math.round(state.t))} s`;
    const verzug = `Signal zuletzt ${sekunden(verzugBei(state.t))}`;
    shell.showResult({
      label: "Deine Meter",
      points: punkte,
      detail: rekord ? "Neuer Rekord!" : `${warum ? `${warum} · ` : ""}${zeit} · ${verzug}`,
      geist,
    });
    if (rekord) host.querySelector(".cm-result-detail")?.classList.add("mr-rekord");
    zaehleHoch(punkte);
  }

  // ---------------------------------------------------------------------------
  // Start
  // ---------------------------------------------------------------------------
  shell = shellApi.mount({
    host,
    title: "Marsrover",
    area: "geschwindigkeit",
    accent: "#F5A623",
    accentDark: "#b9741a",
    clock: false,
    onRestart: () => (zuschauer ? zuschauenStarten() : startRun()),
    live: { los: losGehts, stopp: () => finish(), zuschauen: (quelle) => { zuschauer = quelle; zuschauenStarten(); } },
  });
  zuschauer = window.LernappGeist?.zuschauer?.({
    host, spiel: "marsRover", fassung: "t1", zufall, einheit: "m", nochmal: zuschauenStarten,
  }) || null;
  if (!zuschauer) {
    gegner = window.LernappGeist?.fuer?.({ spiel: "marsRover", host, art: "tempo", alle: true, zufall }) || null;
  }

  startRun();
  zuschauer?.laden.then((da) => { if (da) zuschauenStarten(); });

  // Ein Tipp irgendwo aufs Bild: Der Befehl geht los. Nur Knöpfe bleiben Knöpfe.
  host.addEventListener("pointerdown", (event) => {
    if (event.target.closest("button, a, input")) return;
    const t = Math.abs(performance.now() - event.timeStamp) < 250 ? event.timeStamp : performance.now();
    tippen(t);
  });

  const TASTEN = new Set([" ", "Enter", "ArrowUp"]);
  document.addEventListener("keydown", (event) => {
    if (!TASTEN.has(event.key)) return;
    if (document.activeElement?.tagName === "BUTTON") return;
    event.preventDefault();
    if (event.repeat) return;
    tippen(performance.now());
  });

  window.addEventListener("resize", messen);
  window.addEventListener("orientationchange", messen);
  window.addEventListener("pagehide", () => { clearStep(); stopLoop(); klangAus(); });

  // Für die Prüfskripte und die Vorführung.
  window.LernappMarsrover = {
    METER, LH, TOP, DECKE, SPRUNG, HOCH, RAND, E_MIN, VERZUG0, SCHATTEN, FASSUNG, state, view,
    takt, tippen, losGehts, physik, planBis, kursText, trifft, xBei, tBei, tempoBei, bogenY, verzugBei, abschnittBei, luftBei, schwere, folgeHaelt,
  };
})();
