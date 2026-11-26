/*
 * spiegelsee.js – Spiegelsee.
 * ---------------------------------------------------------------------------
 * Ein stiller Bergsee im Morgengrauen. Eine Läuferin rennt von selbst am Ufer
 * entlang nach rechts, darunter läuft ihr Spiegelbild kopfüber im Wasser mit.
 * Eine Regel: Ein Tipp lässt beide zugleich springen – die Läuferin hinauf,
 * das Spiegelbild hinab in die Tiefe des Sees, immer im selben Bogen. Einen
 * Doppelsprung gibt es nicht: Ein Tipp in der Luft verfällt.
 *
 * Aber der See zeigt nicht die Wirklichkeit. Die ersten Sekunden spiegelt er
 * treu – unten steht genau, was oben steht, und man lernt den Sprung. Dann
 * erwacht er (angesagt): Ein Lichtschimmer läuft über die Wasserlinie, unten
 * wird es Nacht mit Sternen und Mond, oben bleibt die Morgenröte – und die
 * Spiegelwelt geht eigene Wege. Unten stehen andere Hindernisse als oben,
 * und ein Sprung muss für beide Welten passen. Man liest zwei Welten
 * zugleich; das ist das Ungewohnte, das man durch Üben lernt.
 *
 * Die Bildsprache ist in beiden Welten dieselbe:
 *
 *   Was den Weg berührt, muss man überspringen – oben Steine und Baumstämme,
 *   unten, was von der Wasserlinie in die Tiefe hängt: Eiskristalle,
 *   Schilf, Wurzeln.
 *   Was frei über dem Kopf hängt, darunter springt man nicht – oben Äste und
 *   Felsdächer, unten, was tiefer im Wasser schwebt: Hechte, Quallen,
 *   Treibholz. Unter jedem liegt auf dem Weg ein Schatten, unten ein Schein
 *   auf der Wasserlinie: So weit reicht es.
 *
 * Jeder achte Abschnitt ist besonders, im festen Wechsel und vorher
 * angesagt: Nebel zieht über das Ufer und verdeckt die Hindernisse, aber der
 * See zeigt sie für diesen Abschnitt wieder treu – man liest die obere Welt
 * aus dem Spiegel. Und ein Holzsteg über eine Bucht, in dem Bretter fehlen;
 * ab dem zweiten schwimmen darunter Hechte. Gezählt werden die Meter.
 *
 * Gebaut wird die Strecke aus dem Zufall (zufall.js): ohne Turnier jedes Mal
 * eine andere, im Turnier für alle im selben Versuch dieselbe. Alles hängt
 * nur an der Spielzeit seit dem Start: Die Läuferin rennt immer gleich
 * schnell (xBei), ob sie springt oder nicht. Die Strecke ist immer zu
 * schaffen, weil zuerst ein Weg entsteht – Abschnitt um Abschnitt, wann sie
 * abspringt (naechsterAbschnitt) – und dann die Hindernisse beider Welten um
 * ihn herum, so gross, dass jeder Sprung bis zu «luft» zu früh oder zu spät
 * noch gelingt. Jeder Abschnitt wird nachgeprüft (sicher): alle Ecken der
 * Luft, auch über den Sprung davor hinweg. Ein Tipp gilt zu seiner Zeit,
 * nicht erst im nächsten Bild (tippen, voraus).
 *
 * Das Bild: oben ein Schweizer Bergsee im Alpenglühen – Gipfel und Gletscher
 * im ersten Licht, Hänge mit Lärchen und Arven, eine Alphütte, Morgennebel,
 * Vögel. Unten erst ihr Spiegelbild, nach dem Erwachen eine Nacht in Blau,
 * Violett und Türkis mit Mond, Sternen, Lichtfäden, Schwebeteilchen und
 * einem Grund, auf den Licht durchs Wasser fällt. Jede grosse Fläche wird
 * einmal gemalt (gespiegelte Ebenen schon gespiegelt) und dann nur noch
 * aufgelegt, Punkt auf Punkt: Auf dem iPhone rechnet der Prozessor jede
 * gemalte Fläche, jedes Bild. Beim ersten Start glühen die Gipfel erst auf.
 *
 * Die Gegner (geist.js) laufen als Läuferinnen aus Licht mit, und die besten
 * Läufe lassen sich anschauen (?zuschauen=): auf derselben Strecke, gebaut
 * mit derselben Saat.
 *
 * Zehn Einheiten sind ein Meter. x zählt voraus, y vom Weg weg: oben nach
 * oben, in der Spiegelwelt nach unten – beide Welten rechnen gleich.
 */
(() => {
  "use strict";

  if (document.body.dataset.page !== "spiegelsee") return;

  const host = document.querySelector("#sg-stage");
  const shellApi = window.LernappGameShell;
  const cloudApi = window.LernappGameCloud;
  if (!host || !shellApi) return;

  const kids = () => window.LernappKids || null;
  const klang = () => window.ArcadeKlang || null;
  const ruhig = () => Boolean(kids()?.prefersReducedMotion?.());

  // Der Zufall. Nur die Strecke zieht daraus – der Weg und die Hindernisse.
  // Atem, Ringe, Funkeln und was aufstiebt hängen an festen Zahlen oder an
  // Math.random.
  const zufall = window.LernappZufall?.fuer?.("mirrorLake") || {
    neu() {},
    zahl: () => Math.random(),
  };

  // ---------------------------------------------------------------------------
  // Die Regeln
  // ---------------------------------------------------------------------------
  const METER = 10;
  const TOP = 24;                  // so gross ist sie, von den Sohlen bis zum Scheitel
  const LH = 4.5;                  // so breit stösst sie an (halb), Arme und Beine weniger
  const UFER = 5;                  // so hoch liegt der Weg über dem Wasser
  // Der Sprung: immer derselbe Bogen, SPRUNG Sekunden lang, HOCH hoch.
  const SPRUNG = 0.6;
  const HOCH = 40;
  // Was über dem Kopf hängt, hängt mit der Unterkante DECKE über dem Weg
  // (unten: so tief unter dem gespiegelten Weg) – wer dort mehr als
  // DECKE − TOP abhebt, stösst an.
  const DECKE = TOP + 6;
  const RAND = 3;                  // so weit darf ihre Mitte über eine Steglücke
  // Das Tempo nach der Spielzeit: von 14 Metern in der Sekunde auf bald 20;
  // in den ersten ANFAHRT Sekunden läuft sie an.
  const V0 = 140;
  const V_MAX = 215;
  const V_ZEIT = 50;
  const ANFAHRT = 0.5;
  // Die Luft: um so viele Sekunden darf jeder Sprung zu früh oder zu spät
  // kommen. Die ersten Sekunden zum Hineinfinden ±150 ms, nach 20 s ±89,
  // nach 30 s ±69, nach einer Minute ±45, nie unter ±38.
  const E0 = 0.15;
  const E_MIN = 0.03;
  const E_ZEIT = 16;
  const E_AB = 5;
  const SCHWER_ZEIT = 21;          // nach so vielen Sekunden sind gut sechs Zehntel der Härte da
  const SCHWER_AB = 4;
  const ERWACHEN_AB = 7.6;         // ab hier erwacht der See (mit dem nächsten Abschnitt)
  const SICHT = 250;               // so weit sieht man voraus, hoch wie quer
  const PERIODE = 480;             // so lang ist ein Stück gemaltes Ufer
  const TAKT = 1 / 240;
  const STURZ_MS = 2300;
  const FASSUNG = "t1";

  const TOP_COUNT = 5;
  const store = cloudApi
    ? cloudApi.register({ key: "lernapp.spiegelsee", empty: { runs: 0, scores: [] }, merge: cloudApi.mergeScores(TOP_COUNT) })
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

  // Der Weg nach der Zeit: erst anlaufen, dann V0 gegen V_MAX. Geschlossen
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
  // Und umgekehrt: wann sie an der Stelle x ist.
  function tBei(x) {
    if (x <= 0) return 0;
    if (x < X_ANFAHRT) return Math.sqrt((2 * ANFAHRT * x) / V0);
    let t = ANFAHRT + (x - X_ANFAHRT) / V0;
    for (let i = 0; i < 8; i += 1) t -= (xBei(t) - x) / tempoBei(t);
    return t;
  }

  // Der Bogen des Sprungs, tau Sekunden nach dem Absprung.
  const bogenY = (tau) => (tau <= 0 || tau >= SPRUNG ? 0 : (4 * HOCH * tau * (SPRUNG - tau)) / (SPRUNG * SPRUNG));
  // So lange nach dem Absprung (und so lange vor der Landung) ist sie höher
  // als DECKE − TOP.
  const TAU_DECKE = (SPRUNG - Math.sqrt(SPRUNG * SPRUNG - ((DECKE - TOP) * SPRUNG * SPRUNG) / HOCH)) / 2;

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

  // Weiches Rauschen; rauschenRund wiederholt sich nach n Stützstellen.
  function rauschenRund(u, n, saat) {
    const i = Math.floor(u);
    const f = u - i;
    const a = hash01((((i % n) + n) % n) * 1.37 + saat);
    const b = hash01(((((i + 1) % n) + n) % n) * 1.37 + saat);
    return lerp(a, b, f * f * (3 - 2 * f));
  }
  function rauschen(u, saat) {
    const i = Math.floor(u);
    const f = u - i;
    return lerp(hash01(i * 1.37 + saat), hash01((i + 1) * 1.37 + saat), f * f * (3 - 2 * f));
  }

  const mix3 = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
  const rgb = (c) => `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`;
  const rgba = (c, alpha) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${alpha})`;

  // ---------------------------------------------------------------------------
  // Zustand
  // ---------------------------------------------------------------------------
  // phase:   "bereit" (noch nichts getippt), "spiel", "zuschauen", "ende"
  // schritt: "start" (sie steht), "lauf", "sturz"
  const state = {
    phase: "bereit",
    schritt: "start",
    punkte: 0,
    t: 0,                    // die Spielzeit; sie läuft bei null los
    zeit: 0,                 // die Uhr des Bildes
    // Die Läuferin: wo sie ist, wie hoch, wann sie zuletzt absprang (null:
    // am Boden) und wann sie zuletzt landete.
    laeuferin: { x: 0, y: 0, sprung: null, landung: -9, absprung: -9 },
    spruenge: 0,
    verfallen: 0,            // Tipps in der Luft
    weg: [],
    hindernisse: [],
    abschnitte: [],
    stege: [],
    nebel: [],
    freiAb: ANFAHRT,
    planFehler: 0,
    nebelZahl: 0,
    stegZahl: 0,
    langMax: 120,
    erwacheT: null,          // wann der See erwacht (aus dem Plan)
    nachWecken: 0,
    erwacht: false,
    angesagt: false,
    abschnitt: -1,
    sturz: null,
    teile: [],
    ringe: [],
    atem: [],
    schriften: [],
    ansage: null,
    camX: 0,
    stoss: 0,
    stauch: 0,
    lauf: 0,                 // die Phase der Schritte
    atemUhr: 0,
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
  let gegner = null;
  let zuschauer = null;
  let morgen = null;
  let wind = null;
  let schritte = null;
  let tippRinge = null;
  let ersterStart = true;

  const view = { s: 1, dpr: 1, cssW: 0, cssH: 0, frei: 0, rx: 30, wl: 300, pfad: 290, hz: 200, berg: 100 };

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
    morgen = klang()?.kulisse("spiegelsee.morgen") || null;
    morgen?.laut(0.5);
    wind = klang()?.kulisse("spiegelsee.wind") || null;
    wind?.setze(0.22);
    wind?.laut(0.3);
    schritte = klang()?.kulisse("spiegelsee.schritte", { laut: 0 }) || null;
  }

  function klangStellen() {
    const r = state.laeuferin;
    const laeuft = state.schritt === "lauf" && r.sprung === null && state.t > 0.05;
    schritte?.setze(clamp((tempoBei(state.t) - 60) / 700, 0.08, 0.26));
    schritte?.laut(laeuft ? 0.55 : 0);
  }

  function klangAus() {
    schritte?.stop();
    morgen?.stop();
    wind?.stop();
    schritte = null;
    morgen = null;
    wind = null;
  }

  // ---------------------------------------------------------------------------
  // Die Hindernisse
  // ---------------------------------------------------------------------------
  /*
   * Drei Arten, in beiden Welten gleich gerechnet (welt "oben" oder "unten"):
   *
   *   boden   [a, b], h hoch (unten: so tief), der höchste Punkt bei p
   *           (Anteil), Flanken nach q. Wer es mit dem Körper (x ± LH)
   *           berührt, stürzt. Gemalt wird genau dieser Umriss (profil).
   *           Oben: stein, stamm. Unten: kristall, schilf, wurzel.
   *   decke   [a, b], die Kante bei DECKE: Wer darunter abhebt, stösst an.
   *           Oben: ast, dach. Unten: hecht, qualle, treibholz.
   *   luecke  [a, b], ein fehlendes Stück im Steg: Wer am Boden mit seiner
   *           Mitte mehr als RAND über die Kante kommt, fällt ins Wasser.
   *
   * spiegel: Der See zeigt es treu (in den ersten Sekunden, im Nebel, am
   * Steg). nebel: Oben verdeckt es der Nebel.
   */
  function profil(o, x) {
    if (x <= o.a || x >= o.b) return 0;
    const u = (x - o.a) / (o.b - o.a);
    const k = u < o.p ? (o.p - u) / o.p : (u - o.p) / (1 - o.p);
    return o.h * Math.sqrt(Math.max(0, 1 - k ** o.q));
  }

  // Der höchste Punkt zwischen x0 und x1.
  function profilMax(o, x0, x1) {
    if (x1 <= o.a || x0 >= o.b) return 0;
    const gipfel = o.a + o.p * (o.b - o.a);
    if (x0 <= gipfel && x1 >= gipfel) return o.h;
    return x1 < gipfel ? profil(o, x1) : profil(o, x0);
  }

  // Das erste Hindernis, das bei x noch reichen könnte (sie liegen nach a
  // geordnet; aus beiden Welten dürfen sie sich überdecken, darum der Blick
  // um die grösste Länge zurück).
  function abIndex(x) {
    const liste = state.hindernisse;
    const ziel = x - state.langMax;
    let lo = 0;
    let hi = liste.length;
    while (lo < hi) {
      const m = (lo + hi) >> 1;
      if (liste[m].a < ziel) lo = m + 1; else hi = m;
    }
    return lo;
  }

  // Was sie (oder ihr Spiegelbild) hier trifft: x ihre Mitte, y die Höhe der
  // Sohlen über dem Weg, luft ob sie fliegt. null heisst: nichts.
  function trifft(x, y, luft) {
    const liste = state.hindernisse;
    for (let i = abIndex(x - LH - 1); i < liste.length; i += 1) {
      const o = liste[i];
      if (o.a > x + LH + 1) break;
      if (o.b < x - LH - 1) continue;
      if (o.kind === "luecke") {
        if (!luft && x > o.a + RAND && x < o.b - RAND) return o;
      } else if (o.kind === "boden") {
        if (profilMax(o, x - LH, x + LH) > y + 0.3) return o;
      } else if (x + LH > o.a && x - LH < o.b && y + TOP > DECKE) {
        return o;
      }
    }
    return null;
  }

  function einreihen(o) {
    const liste = state.hindernisse;
    let i = liste.length;
    while (i > 0 && liste[i - 1].a > o.a) i -= 1;
    liste.splice(i, 0, o);
    state.langMax = Math.max(state.langMax, o.b - o.a + 2);
  }

  // Die Formen der Hindernisse, die man überspringt: Höhe (leicht, schwer –
  // je von bis), wo der höchste Punkt liegt, wie rund die Flanken sind, wie
  // breit sie mindestens sind.
  const FORMEN = {
    stein: { h: [9, 12, 13, 20], p: [0.36, 0.62], q: [2, 3.2], minB: 9 },
    stamm: { h: [7, 8, 9, 11], p: [0.48, 0.52], q: [6, 9], minB: 14 },
    kristall: { h: [10, 13, 14, 20], p: [0.3, 0.7], q: [1.5, 2.2], minB: 9 },
    schilf: { h: [11, 13, 15, 19], p: [0.42, 0.58], q: [3, 4.5], minB: 9 },
    wurzel: { h: [9, 11, 12, 16], p: [0.3, 0.55], q: [2.4, 3.4], minB: 9 },
  };
  // Und die, unter denen man durchläuft: wie lang (von bis).
  const DECKEN = {
    ast: [18, 36], dach: [38, 70], hecht: [30, 50], qualle: [16, 32], treibholz: [34, 62],
  };

  // Überlebt ein Sprung von t0 dieses Hindernis? Am Boden davor darf sie es
  // nicht berühren, im Flug nicht streifen, und gelandet muss sie dahinter
  // sein.
  function bodenUeberlebt(o, t0) {
    const vor = xBei(t0);
    if (profilMax(o, vor - LH, vor + LH) > 0.3) return false;
    const nach = xBei(t0 + SPRUNG);
    if (nach - LH < o.a + o.p * (o.b - o.a) || profilMax(o, nach - LH, nach + LH) > 0.3) return false;
    for (let tau = 0; tau < SPRUNG; tau += 1 / 600) {
      const x = xBei(t0 + tau);
      if (profilMax(o, x - LH, x + LH) > bogenY(tau) + 0.3) return false;
    }
    return true;
  }

  // Von wann bis wann ein Sprung darüber gelingt (null: nie).
  function bodenFenster(o) {
    const gipfel = o.a + o.p * (o.b - o.a);
    const mitte = tBei(gipfel) - SPRUNG / 2;
    if (!bodenUeberlebt(o, mitte)) return null;
    let a = mitte;
    let b = mitte + 0.6;
    for (let i = 0; i < 14; i += 1) { const m = (a + b) / 2; if (bodenUeberlebt(o, m)) a = m; else b = m; }
    const hi = a;
    a = mitte - 0.6;
    b = mitte;
    for (let i = 0; i < 14; i += 1) { const m = (a + b) / 2; if (bodenUeberlebt(o, m)) b = m; else a = m; }
    return { lo: b, hi };
  }

  // Ein Hindernis zum Überspringen, über das ein Sprung zwischen lo und hi
  // hinwegkommt: die Höhe nach der Schwere, die Breite so, dass genau dieses
  // Fenster bleibt.
  function bodenBauen(lo, hi, welt, art, zH, zP, zQ, k) {
    const m = FORMEN[art];
    const W = hi - lo;
    const tm = (lo + hi) / 2;
    const v = tempoBei(tm + SPRUNG / 2);
    let h = lerp(lerp(m.h[0], m.h[1], k), lerp(m.h[2], m.h[3], k), zH);
    const p = lerp(m.p[0], m.p[1], zP);
    const q = lerp(m.q[0], m.q[1], zQ);
    let w = 9;
    for (;;) {
      w = v * (SPRUNG * Math.sqrt(1 - h / HOCH) - W) - 2 * LH + 3;
      if (w >= m.minB || h <= 6) break;
      h -= 1;
    }
    w = Math.max(6, w);
    const o = { kind: "boden", art, welt, a: 0, b: 0, h, p, q, saat: hash01(tm * 7.7 + (welt === "unten" ? 3.3 : 0)) };
    let mitte = xBei(tm + SPRUNG / 2);
    const setze = () => { o.a = mitte - w * p; o.b = o.a + w; };
    setze();
    for (let i = 0; i < 5; i += 1) {
      const fen = bodenFenster(o);
      if (!fen) { w *= 0.8; setze(); continue; }
      w = Math.max(6, w + (fen.hi - fen.lo - W) * v * 0.95);
      mitte += (tm - (fen.lo + fen.hi) / 2) * v;
      setze();
    }
    // Zuletzt muss das Fenster [lo, hi] ganz drin sein – sonst etwas schmaler.
    for (let i = 0; i < 24; i += 1) {
      const fen = bodenFenster(o);
      if (fen && fen.lo <= lo + 1e-4 && fen.hi >= hi - 1e-4) break;
      if (fen) mitte += (tm - (fen.lo + fen.hi) / 2) * v;
      w = Math.max(4, w - 0.8);
      setze();
    }
    return o;
  }

  function deckeBauen(a, b, welt, art, z) {
    return { kind: "decke", art, welt, a, b, dick: lerp(8, 13, z), saat: hash01(a * 0.37 + (welt === "unten" ? 5.1 : 0)) };
  }

  // Eine Lücke im Steg, über die ein Sprung zwischen lo und hi hinwegkommt:
  // Wer nach hi abspringt, steht schon über der Kante; wer vor lo abspringt,
  // landet noch darin.
  function lueckeBauen(lo, hi) {
    return { kind: "luecke", art: "luecke", welt: "oben", a: xBei(hi) - RAND, b: xBei(lo + SPRUNG) + RAND, spiegel: true, saat: hash01(lo * 3.7) };
  }

  // Welche Form in welcher Welt.
  const bodenArt = (welt, z) => (welt === "oben" ? (z < 0.62 ? "stein" : "stamm") : z < 0.45 ? "kristall" : z < 0.73 ? "schilf" : "wurzel");
  const deckeArt = (welt, z) => (welt === "oben" ? (z < 0.66 ? "ast" : "dach") : z < 0.4 ? "qualle" : z < 0.76 ? "hecht" : "treibholz");
  const anders = (welt) => (welt === "oben" ? "unten" : "oben");

  // ---------------------------------------------------------------------------
  // Die Strecke: der Weg, Abschnitt um Abschnitt
  // ---------------------------------------------------------------------------
  /*
   * Ein Abschnitt ist eine Lage: ein bis vier Sprünge, um die herum die
   * Hindernisse beider Welten stehen. Zuerst der Weg (wann sie abspringt,
   * zeiten), dann die Hindernisse so, dass jeder Sprung bis zu e zu früh oder
   * zu spät noch gelingt (dazu ein wenig mehr, s). Die Lagen:
   *
   *   einzeln     ein Hindernis zum Überspringen, oben oder unten
   *   beide       oben und unten zugleich eines
   *   doppel      zwei kurz hintereinander, meist in verschiedenen Welten
   *   dreifach    drei
   *   zangeVor    erst etwas über dem Kopf, gleich dahinter eines zum
   *               Überspringen – springen erst, wenn der Kopf frei ist
   *   zangeNach   erst eines zum Überspringen, gleich hinter der Landung
   *               etwas über dem Kopf: Wer zu spät springt, landet darunter
   *   klammer     beides: davor und dahinter etwas über dem Kopf
   *
   * Bei den Zangen und der Klammer stehen die Teile meist in verschiedenen
   * Welten: Oben hängt ein Ast, unten ragt Schilf – das Fenster bilden
   * beide zusammen.
   *
   * Die ersten Abschnitte spiegelt der See treu (nur oben, alles gespiegelt):
   * ein Stein, ein Stamm, ein Ast mit einem Stein. Mit dem ersten Abschnitt
   * ab ERWACHEN_AB erwacht er (erwacheT, davor eine ruhige Strecke zum
   * Staunen); dann zuerst ein Kristall unten allein, danach ein Stein oben
   * mit einer Qualle unten gleich hinter der Landung.
   *
   * Jeder achte Abschnitt ist besonders, im Wechsel: der 8., 24., 40. Nebel
   * (drei, dann vier Sprünge, nur oben, der See zeigt sie treu), der 16.,
   * 32., 48. der Steg (zwei, dann drei Lücken; ab dem zweiten unten Hechte,
   * die das Fenster des nächsten Sprungs vorn begrenzen). Beide mit etwas
   * mehr Luft.
   *
   * Immer gleich viele Zahlen ziehen, was auch geschieht: Die Strecke soll an
   * der Saat hängen, nicht an den Zweigen dieser Funktion.
   */
  function naechsterAbschnitt() {
    const liste = state.abschnitte;
    const n = liste.length;
    const z = [];
    for (let i = 0; i < 16; i += 1) z.push(zufall.zahl());
    const letzt = state.weg[state.weg.length - 1] || null;
    const nr = n + 1;
    const besonders = nr % 8 === 0 ? ((nr / 8) % 2 === 1 ? "nebel" : "steg") : "";
    const start = state.freiAb;
    // Erwacht der See mit diesem Abschnitt? Dann zuerst eine ruhige Strecke.
    const wecken = state.erwacheT === null && !besonders && state.freiAb >= ERWACHEN_AB - 0.4;
    let ruhe = 0;
    if (wecken) {
      state.erwacheT = Math.round((state.freiAb + 0.45) * 1000) / 1000;
      ruhe = 1.6;
    }
    const treu = state.erwacheT === null;
    const tSchaetz = state.freiAb + 0.5 + ruhe;
    const k0 = schwere(tSchaetz);
    const e0 = luftBei(tSchaetz) * (besonders ? 1.12 : 1);
    const nachWecken = treu || wecken ? 0 : state.nachWecken + 1;

    let lage;
    // Die Welten der Teile: w1 das erste Hindernis, w2 das andere.
    let w1 = z[13] < 0.52 ? "unten" : "oben";
    let w2 = z[14] < 0.72 ? anders(w1) : w1;
    let a1 = z[15];
    if (besonders) lage = besonders;
    else if (n === 0) { lage = "einzeln"; w1 = "oben"; a1 = 0.2; }
    else if (n === 1) { lage = "einzeln"; w1 = "oben"; a1 = 0.9; }
    else if (n === 2) { lage = "zangeVor"; w1 = "oben"; w2 = "oben"; a1 = 0.2; }
    else if (wecken) { lage = "einzeln"; w1 = "unten"; a1 = 0.2; }
    else if (nachWecken === 1) { lage = "zangeNach"; w1 = "oben"; w2 = "unten"; a1 = 0.2; }
    else if (treu) { lage = z[0] < 0.55 ? "einzeln" : "doppel"; }
    else {
      const gewichte = [
        ["einzeln", 1],
        ["beide", lerp(0.5, 0.25, k0)],
        ["doppel", lerp(0.5, 1.05, k0)],
        ["zangeVor", lerp(0.6, 1.05, k0)],
        ["zangeNach", lerp(0.45, 0.95, k0)],
        ["dreifach", n >= 9 ? lerp(0.1, 0.7, k0) : 0],
        ["klammer", n >= 11 ? lerp(0.05, 0.65, k0) : 0],
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
    if (treu) { w1 = "oben"; w2 = "oben"; }

    const vorlauf = ruhe + (n === 0 ? 0 : n <= 3 ? 0.62 + 0.36 * z[1] : lerp(0.55, 0.12, k0) + z[1] * lerp(0.45, 0.18, k0));
    const frueh = state.freiAb + vorlauf + e0;

    // Ein Versuch, die Lage zu bauen; weicht ihr Weg nachgeprüft ab (sicher),
    // der nächste mit kleineren Hindernissen, zuletzt ein einfacher Stein.
    const versuch = (lageJetzt, mass) => {
      const e = e0 * mass;
      const k = k0 / mass;
      const hind = [];
      const zeiten = [];
      let freiAb = 0;
      const s = (zi) => e * lerp(0.22, 0.03, k) * zi;
      const gZeit = (zi) => lerp(0.17, 0.06, k) + 0.08 * zi * (1 - k);
      // Wo ein anderes Teil das Fenster begrenzt, darf das Hindernis auf
      // dieser Seite mehr erlauben.
      const mehr = (zi) => e * (0.3 + lerp(0.7, 0.3, k) * zi);
      const ueber = (lo, hi, welt, za, zh, zp, zq) => bodenBauen(lo, hi, welt, bodenArt(welt, za), zh, zp, zq, k);
      const spanne = (art, zi) => lerp(DECKEN[art][0], DECKEN[art][1], zi);
      let t1 = n === 0 ? 1.9 : frueh;

      if (lageJetzt === "einzeln") {
        zeiten.push(t1);
        hind.push(ueber(t1 - e - s(z[2]), t1 + e + s(z[3]), w1, a1, z[4], z[5], z[6]));
      } else if (lageJetzt === "beide") {
        zeiten.push(t1);
        hind.push(ueber(t1 - e - s(z[2]), t1 + e + s(z[3]), "oben", z[7], z[4], z[5], z[6]));
        hind.push(ueber(t1 - e - s(z[3]), t1 + e + s(z[2]), "unten", z[8], z[6], z[4], z[5]));
      } else if (lageJetzt === "doppel" || lageJetzt === "dreifach") {
        const zahl = lageJetzt === "doppel" ? 2 : 3;
        let t = t1;
        let welt = w1;
        for (let i = 0; i < zahl; i += 1) {
          if (i > 0) {
            t += SPRUNG + 2 * e + gZeit(z[8 + i]);
            if (!treu && z[(10 + i) % 16] < 0.72) welt = anders(welt);
          }
          zeiten.push(t);
          hind.push(ueber(t - e - s(z[(2 + i) % 16]), t + e + s(z[(3 + i) % 16]), welt, z[(7 + i * 2) % 16], z[(4 + i) % 16], z[(5 + i) % 16], z[(6 + i) % 16]));
        }
      } else if (lageJetzt === "zangeVor" || lageJetzt === "klammer") {
        // Das obere Teil endet so, dass der früheste Sprung, der unter ihm
        // nicht anstösst, genau am Anfang des Fensters liegt.
        const art = n === 2 ? "ast" : deckeArt(w2, z[9]);
        const span = spanne(art, z[10]);
        const sA = s(z[2]);
        const zeitDecke = (span + 2 * LH + 8) / tempoBei(state.freiAb + 0.5);
        t1 = Math.max(state.freiAb + 0.5 * vorlauf + zeitDecke + TAU_DECKE + e + sA, frueh);
        const b = xBei(t1 - e - sA + TAU_DECKE) - LH;
        hind.push(deckeBauen(b - span, b, w2, art, z[11]));
        zeiten.push(t1);
        const sB = s(z[3]);
        if (lageJetzt === "zangeVor") {
          hind.push(ueber(t1 - e - sA - mehr(z[12]), t1 + e + sB, w1, a1, z[4], z[5], z[6]));
        } else {
          // Die Klammer: auch hinten begrenzt ein Teil über dem Kopf, in der
          // anderen Welt als das vordere.
          hind.push(ueber(t1 - e - sA - mehr(z[12]), t1 + e + sB + mehr(z[8]), w1, a1, z[4], z[5], z[6]));
          const w3 = anders(w2);
          const art2 = deckeArt(w3, z[7]);
          const span2 = spanne(art2, z[1]);
          const a = xBei(t1 + e + sB + SPRUNG - TAU_DECKE) + LH;
          hind.push(deckeBauen(a, a + span2, w3, art2, z[8]));
          freiAb = tBei(a + span2 + LH) - TAU_DECKE + 0.02;
        }
      } else if (lageJetzt === "zangeNach") {
        // Erst das Hindernis, gleich hinter der Landung das Teil über dem
        // Kopf: Begrenzt wird hinten nur von ihm.
        const art = deckeArt(w2, z[9]);
        const span = spanne(art, z[10]);
        const sB = s(z[3]);
        zeiten.push(t1);
        hind.push(ueber(t1 - e - s(z[2]), t1 + e + sB + mehr(z[12]), w1, a1, z[4], z[5], z[6]));
        const a = xBei(t1 + e + sB + SPRUNG - TAU_DECKE) + LH;
        hind.push(deckeBauen(a, a + span, w2, art, z[11]));
        freiAb = tBei(a + span + LH) - TAU_DECKE + 0.02;
      } else if (lageJetzt === "nebel") {
        // Nur oben, und der See zeigt alles treu. Zwischen den Sprüngen
        // hängt manchmal ein Ast, der den nächsten Sprung vorn begrenzt.
        const zahl = state.nebelZahl === 0 ? 3 : 4;
        let t = t1;
        for (let i = 0; i < zahl; i += 1) {
          let mitAst = false;
          if (i > 0) {
            mitAst = z[(4 + i) % 16] < 0.55;
            t += SPRUNG + 2 * e + (mitAst ? lerp(0.34, 0.26, k) : gZeit(z[8 + i]));
          }
          zeiten.push(t);
          const sA = s(z[(2 + i) % 16]);
          if (mitAst) {
            const b = xBei(t - e - sA + TAU_DECKE) - LH;
            const a = Math.max(xBei(zeiten[i - 1] + e + SPRUNG - TAU_DECKE) + LH, b - 34);
            hind.push(deckeBauen(a, b, "oben", "ast", z[(9 + i) % 16]));
          }
          hind.push(ueber(t - e - sA - (mitAst ? mehr(z[(6 + i) % 16]) : 0), t + e + s(z[(3 + i) % 16]), "oben", z[(7 + i * 2) % 16], z[(4 + i) % 16], z[(5 + i) % 16], z[(6 + i) % 16]));
        }
      } else if (lageJetzt === "steg") {
        // Lücken im Steg: zwei, ab dem zweiten Steg drei – und dann unten
        // zwischen ihnen ein Hecht, der den nächsten Sprung vorn begrenzt.
        const zahl = state.stegZahl === 0 ? 2 : 3;
        const mitHecht = state.stegZahl > 0;
        let t = t1 + 0.25;
        for (let i = 0; i < zahl; i += 1) {
          if (i > 0) t += SPRUNG + 2 * e + (mitHecht ? lerp(0.3, 0.22, k) : lerp(0.16, 0.08, k) + 0.06 * z[8 + i]);
          zeiten.push(t);
          const sA = s(z[(2 + i) % 16]);
          let vorn = 0;
          if (mitHecht && i > 0) {
            const b = xBei(t - e - sA + TAU_DECKE) - LH;
            const a = Math.max(xBei(zeiten[i - 1] + e + SPRUNG - TAU_DECKE) + LH, b - 46);
            if (b - a >= 16) {
              hind.push(deckeBauen(a, b, "unten", "hecht", z[(9 + i) % 16]));
              vorn = mehr(z[(6 + i) % 16]) * 0.6;
            }
          }
          hind.push(lueckeBauen(t - e - sA - vorn, t + e + s(z[(3 + i) % 16])));
        }
        freiAb = zeiten[zeiten.length - 1] + e + SPRUNG + 0.3;
      }
      return { zeiten, hind, e, freiAb };
    };

    const vorher = letzt ? [{ t: letzt.t, e: letzt.e }] : [];
    let fertig = null;
    for (const [lageJetzt, mass] of [[lage, 1], [lage, 1.12], ["einzeln", 1.2]]) {
      const v = versuch(lageJetzt, mass);
      v.hind.forEach((o) => {
        o.nr = n;
        if (treu || besonders) o.spiegel = true;
        if (besonders === "nebel") o.nebel = true;
        einreihen(o);
      });
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
      const v = versuch("einzeln", 1.3);
      v.hind.forEach((o) => { o.nr = n; if (treu || besonders) o.spiegel = true; einreihen(o); });
      fertig = { ...v, lage: "einzeln" };
    }
    if (fertig.lage === "nebel") state.nebelZahl += 1;
    if (fertig.lage === "steg") state.stegZahl += 1;
    fertig.zeiten.forEach((t) => state.weg.push({ t, e: fertig.e, nr: n }));
    const tLetzt = fertig.zeiten[fertig.zeiten.length - 1];
    state.freiAb = Math.max(tLetzt + fertig.e + SPRUNG + 0.04, fertig.freiAb);
    const eigene = state.hindernisse.filter((o) => o.nr === n);
    const xa = Math.min(...eigene.map((o) => o.a));
    const xb = Math.max(...eigene.map((o) => o.b));
    if (fertig.lage === "nebel") state.nebel.push({ a: xa - 70, b: xb + 60, nr: n });
    if (fertig.lage === "steg") state.stege.push({ a: xa - 46, b: xb + 40, nr: n });
    if (!treu) state.nachWecken = nachWecken;
    liste.push({ nr: n, lage: fertig.lage, besonders, treu, wecken, start, ende: state.freiAb, t0: fertig.zeiten[0], t1: tLetzt, e: fertig.e });
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

  // Die Strecke steht bis zur Zeit t – und immer zwei Abschnitte über den
  // laufenden hinaus (ein besonderer wird einen Abschnitt vorher angesagt).
  // Je Aufruf höchstens «mal» Abschnitte, damit kein Bild lange wartet.
  function planBis(t, mal = 40) {
    for (let i = 0; i < mal; i += 1) {
      const liste = state.abschnitte;
      const letzt = liste[liste.length - 1];
      if (letzt && letzt.t1 > t && liste.length > state.abschnitt + 3) return;
      naechsterAbschnitt();
    }
  }

  function streckeNeu() {
    state.weg = [];
    state.hindernisse = [];
    state.abschnitte = [];
    state.stege = [];
    state.nebel = [];
    state.freiAb = ANFAHRT;
    state.planFehler = 0;
    state.nebelZahl = 0;
    state.stegZahl = 0;
    state.langMax = 120;
    state.erwacheT = null;
    state.nachWecken = 0;
    state.abschnitt = -1;
    planBis(10);
  }

  // Der Abschnitt, in dem die Zeit t liegt.
  function abschnittBei(t) {
    const liste = state.abschnitte;
    let lo = 0;
    let hi = liste.length - 1;
    if (hi < 0 || t < liste[0].start) return 0;
    while (lo < hi) {
      const m = (lo + hi + 1) >> 1;
      if (liste[m].start <= t) lo = m; else hi = m - 1;
    }
    return lo;
  }

  // Die Strecke als Text – für die Prüfung, dass in einem Turnier alle
  // dieselbe bekommen.
  function kursText(bis = 60) {
    while (!state.abschnitte.length || state.abschnitte[state.abschnitte.length - 1].t1 < bis) naechsterAbschnitt();
    const xb = xBei(bis);
    const teile = state.hindernisse.filter((o) => o.a < xb).map((o) => `${o.art}${o.welt === "unten" ? "_" : ""}${o.a.toFixed(1)}-${o.b.toFixed(1)}${o.h ? `/${o.h.toFixed(1)}` : ""}`);
    const lagen = state.abschnitte.filter((a) => a.start < bis).map((a) => a.lage);
    return `${teile.join(",")} | ${lagen.join(",")} | erwacht ${state.erwacheT}`;
  }

  // ---------------------------------------------------------------------------
  // Die Fläche
  // ---------------------------------------------------------------------------
  function buildPlatz() {
    const platz = shell.el("div", "sg-platz");
    feld = shell.el("div", "sg-feld");
    canvas = document.createElement("canvas");
    canvas.className = "sg-canvas";
    canvas.setAttribute("aria-hidden", "true");
    feld.append(canvas);
    g = canvas.getContext("2d");

    // Der Hinweis vor dem ersten Tipp: zwei Ringe, die aufgehen – tippen.
    const tipp = shell.el("span", "sg-tipp");
    tipp.setAttribute("aria-hidden", "true");
    const ns = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(ns, "svg");
    svg.setAttribute("viewBox", "0 0 64 64");
    ["sg-tipp-ring", "sg-tipp-ring is-spaet"].forEach((klasse) => {
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

  // Was Platz braucht: über dem Wasser alles, was oben hängt (es muss unter
  // die Knöpfe und Bestmarken passen – der Scheitel im höchsten Sprung darf
  // dahinter), unter dem Wasser der ganze Bogen des Spiegelbilds.
  const OBEN = UFER + DECKE + 16;
  const UNTEN = UFER + HOCH + TOP + 6;

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
    // Der Massstab: SICHT Einheiten voraus müssen ins Bild (hochkant gibt
    // das die Breite vor), und über und unter dem Wasser je BEDARF und etwas
    // Welt (quer). Ein Stück Ufer ist eine ganze Zahl Bildpunkte breit: So
    // lässt es sich auflegen, ohne gestreckt zu werden.
    const hochkant = cssH > cssW * 1.15;
    const links = Math.max(30, cssW * 0.08);
    const s0 = Math.min((cssW - links - 6) / SICHT, (cssH - frei - 8) / (OBEN + UNTEN + (hochkant ? 90 : 4)));
    view.s = Math.max(1, Math.round(PERIODE * s0 * dpr)) / (PERIODE * dpr);
    const s = view.s;
    // So weit rechts, dass genau SICHT voraus im Bild ist – quer steht sie
    // darum weiter in der Mitte.
    view.rx = Math.round(cssW - 6 - SICHT * s);
    // Die Wasserlinie: in der Mitte der freien Höhe – ein Bergsee ist ein
    // Spiegel, oben und unten gleich viel Welt.
    let wl = frei + (cssH - frei) * 0.5;
    wl = clamp(wl, frei + OBEN * s + 4, cssH - UNTEN * s);
    view.wl = Math.round(wl);
    view.pfad = view.wl - UFER * s;
    // Der Fuss der fernen Berge und wie hoch sie werden.
    view.hz = Math.round(view.pfad - Math.max((view.pfad - frei) * 0.3, (TOP + 10) * s));
    // Hochkant stehen sie unter den Bestmarken, quer reichen sie dahinter.
    view.berg = Math.max(30, (view.hz - frei * (hochkant ? 1 : 0.3)) * 0.86);
    const pw = Math.round(cssW * dpr);
    const ph = Math.round(cssH * dpr);
    if (canvas.width !== pw) canvas.width = pw;
    if (canvas.height !== ph) canvas.height = ph;
    if (tippRinge) {
      tippRinge.style.left = `${Math.round(Math.min(cssW - 40, view.rx + 0.5 * (cssW - view.rx)))}px`;
      tippRinge.style.top = `${Math.round(view.wl + (cssH - view.wl) * 0.42)}px`;
    }
    ebenenNeu();
  }

  const bildX = (x) => view.rx + (x - state.camX) * view.s;
  // Höhe y über dem Weg (oben) und Tiefe y unter dem gespiegelten Weg.
  const obenY = (y) => view.wl - (UFER + y) * view.s;
  const untenY = (y) => view.wl + (UFER + y) * view.s;

  // ---------------------------------------------------------------------------
  // Farben: wie gemalt wird
  // ---------------------------------------------------------------------------
  // "tag": die Welt am Ufer. "spiegel": ihr treues Spiegelbild im
  // Morgenlicht, dunkler und blauer. "nacht": das Ufer, wie es der erwachte
  // See zeigt (im Nebel) – dunkel, mit kalt leuchtender Kante. "glanz": das
  // Spiegelbild der Läuferin im erwachten See.
  let stil = "tag";
  const SPIEGEL_TON = [36, 46, 96];
  function ton(c) {
    if (stil === "spiegel") return mix3(c, SPIEGEL_TON, 0.42);
    if (stil === "nacht") return mix3(c, [34, 66, 124], 0.68);
    if (stil === "glanz") return mix3(c, [74, 80, 186], 0.72);
    return c;
  }
  const F = (c, a = 1) => (a >= 1 ? rgb(ton(c)) : rgba(ton(c), a));
  // Ein Licht: Im erwachten See leuchtet es kalt.
  const L = (c, a = 1) => (stil === "nacht" ? rgba([150, 248, 255], a) : F(c, a));

  // ---------------------------------------------------------------------------
  // Zeichnen: die Berge
  // ---------------------------------------------------------------------------
  /*
   * Ein Schweizer Panorama, um einen steilen Zahn (wie das Matterhorn) bei
   * 62 % der Breite. Die Gipfel stehen in Einheiten der Berghöhe, damit sie
   * hoch wie quer gleich aussehen: hochkant sieht man den Zahn und seine
   * Nachbarn, quer die ganze Kette. Jeder Gipfel hat eine Flanke im Licht
   * (links: Osten, wo die Sonne aufgeht) und eine im Schatten, getrennt von
   * einem Grat, der vom Gipfel schräg hinunterläuft; oben Schnee, dazwischen
   * Felsrippen, am breiten Massiv ein Gletscher. Die ferneren stehen tiefer
   * im Dunst.
   */
  const GIPFEL = [
    { x: -4.2, h: 0.5, l: 0.8, r: 0.9, a: 0.3, d: 0.5 },
    { x: -3.1, h: 0.6, l: 0.8, r: 0.9, a: 0.4, d: 0.15 },
    { x: -1.75, h: 0.74, l: 1.05, r: 0.8, a: 0.34, d: 0.05, gletscher: true },
    { x: -0.82, h: 0.5, l: 0.45, r: 0.45, a: 0.3, d: 0.45 },
    { x: 0, h: 1, l: 0.42, r: 0.72, a: 0.16, d: 0.2, zahn: true },
    { x: 0.52, h: 0.62, l: 0.22, r: 0.42, a: 0.2, d: 0.28 },
    { x: 1.35, h: 0.56, l: 0.62, r: 0.7, a: 0.3, d: 0.08 },
    { x: 2.35, h: 0.68, l: 0.8, r: 0.8, a: 0.35, d: 0.22 },
    { x: 3.45, h: 0.5, l: 0.75, r: 0.9, a: 0.3, d: 0.4 },
    { x: 4.5, h: 0.62, l: 0.7, r: 0.8, a: 0.3, d: 0.2 },
  ];

  const BERG_GLUT = {
    felsLicht: [218, 128, 116], felsSchatten: [78, 72, 124], schneeLicht: [255, 206, 186], schneeSchatten: [150, 152, 212],
    dunst: [232, 168, 170], kante: [255, 240, 222], gletscher: [214, 226, 255], links: true,
  };
  const BERG_BLAU = {
    felsLicht: [108, 102, 154], felsSchatten: [66, 66, 116], schneeLicht: [190, 194, 230], schneeSchatten: [124, 130, 188],
    dunst: [150, 146, 192], kante: [214, 218, 244], gletscher: [170, 186, 232], links: true,
  };
  // So hoch stehen die Berge im erwachten See, gemessen an den wirklichen.
  const BERG_TRAUM = 0.58;
  const BERG_NACHT = {
    felsLicht: [24, 36, 74], felsSchatten: [10, 16, 40], schneeLicht: [76, 118, 170], schneeSchatten: [30, 48, 96],
    dunst: [12, 28, 62], kante: [150, 246, 255], gletscher: [60, 120, 170], links: false,
  };

  function gipfelPunkte(G, x0, fuss, H, z, Hx = H) {
    // Die Kanten: links vom Fuss zum Gipfel, rechts hinunter, mit Zacken.
    // Hx: der Massstab quer (im erwachten See sind sie niedriger, nicht
    // schmaler).
    const gx = x0 + G.x * Hx;
    const gy = fuss - G.h * H;
    const lx = gx - G.l * Hx;
    const rx = gx + G.r * Hx;
    const links = [];
    const rechts = [];
    const n = 14;
    for (let i = 0; i <= n; i += 1) {
      const f = i / n;
      const zack = i > 0 && i < n ? (z() - 0.5) * H * 0.05 * (1 - Math.abs(f - 0.5)) : 0;
      // Die Flanken sind unten flacher, oben steiler.
      const hoehe = Math.pow(f, G.zahn ? 1.15 : 1.35);
      links.push([lerp(lx, gx, f) + zack * 0.4, fuss - hoehe * (fuss - gy) + zack]);
    }
    for (let i = 1; i <= n; i += 1) {
      const f = i / n;
      const zack = i < n ? (z() - 0.5) * H * 0.05 * (1 - Math.abs(f - 0.5)) : 0;
      const hoehe = Math.pow(1 - f, G.zahn ? 1.05 : 1.3);
      // Die Schulter des Zahns: ein kleiner Absatz im rechten Grat.
      const absatz = G.zahn && f > 0.28 && f < 0.42 ? -H * 0.05 * Math.sin(((f - 0.28) / 0.14) * Math.PI) : 0;
      rechts.push([lerp(gx, rx, f) + zack * 0.4, fuss - hoehe * (fuss - gy) + zack + absatz]);
    }
    return { gx, gy, lx, rx, links, rechts };
  }

  function maleBerge(k, W, fuss, H, pal, Hx = H) {
    const z = wuerfel(4411);
    const x0 = W * 0.62;
    const reihe = GIPFEL.map((G, i) => ({ G, i })).sort((a, b) => b.G.d - a.G.d);
    // Die Zacken hängen an der Reihenfolge der Gipfel, nicht der Zeichnung.
    const punkte = GIPFEL.map((G) => gipfelPunkte(G, x0, fuss, H, z, Hx));
    reihe.forEach(({ G, i }) => {
      const P = punkte[i];
      if (P.rx < -10 || P.lx > W + 10) return;
      const umriss = () => {
        k.beginPath();
        k.moveTo(P.lx, fuss + 2);
        P.links.forEach(([x, y]) => k.lineTo(x, y));
        P.rechts.forEach(([x, y]) => k.lineTo(x, y));
        k.lineTo(P.rx, fuss + 2);
        k.closePath();
      };
      // Der Grat vom Gipfel hinunter trennt Licht und Schatten.
      const gratX = P.gx + G.a * G.r * H * (pal.links ? 1 : -1.6);
      const grat = [];
      for (let j = 0; j <= 10; j += 1) {
        const f = j / 10;
        grat.push([lerp(P.gx, gratX, f ** 0.8) + Math.sin(j * 2.1 + G.x) * H * 0.012, lerp(P.gy, fuss, f)]);
      }
      const lichtSeite = () => {
        k.beginPath();
        if (pal.links) {
          k.moveTo(P.lx - 2, fuss + 2);
          P.links.forEach(([x, y]) => k.lineTo(x, y));
          grat.forEach(([x, y]) => k.lineTo(x, y));
        } else {
          k.moveTo(P.rx + 2, fuss + 2);
          [...P.rechts].reverse().forEach(([x, y]) => k.lineTo(x, y));
          k.lineTo(P.gx, P.gy);
          grat.forEach(([x, y]) => k.lineTo(x, y));
        }
        k.closePath();
      };
      const dunst = (c, f) => mix3(c, pal.dunst, f);
      const d = G.d * 0.45;
      umriss();
      k.fillStyle = rgb(dunst(pal.felsSchatten, d));
      k.fill();
      k.save();
      umriss();
      k.clip();
      lichtSeite();
      k.fillStyle = rgb(dunst(pal.felsLicht, d));
      k.fill();
      // Der Schnee: über einer Linie mit Zacken, auf steilen Wänden nur in
      // Rinnen und Bändern.
      const schneeY = (x) => fuss - H * (0.34 + 0.1 * rauschen(x / H * 3.1, 7) + 0.04 * Math.sin(x / H * 13 + G.x));
      const schnee = () => {
        k.beginPath();
        k.moveTo(P.lx - 4, schneeY(P.lx - 4));
        for (let x = P.lx - 4; x <= P.rx + 4; x += 3) k.lineTo(x, schneeY(x));
        k.lineTo(P.rx + 4, fuss - H * 1.2);
        k.lineTo(P.lx - 4, fuss - H * 1.2);
        k.closePath();
      };
      schnee();
      k.fillStyle = rgb(dunst(pal.schneeSchatten, d));
      k.fill();
      k.save();
      schnee();
      k.clip();
      lichtSeite();
      k.fillStyle = rgb(dunst(pal.schneeLicht, d * 0.8));
      k.fill();
      k.restore();
      // Felsrippen durch den Schnee: feine, auslaufende Striche vom Grat
      // schräg hinab, im Schatten dunkler als im Licht.
      const steil = G.zahn ? 1.5 : 1;
      k.lineCap = "round";
      for (let j = 0; j < (G.zahn ? 14 : 8); j += 1) {
        const f = 0.12 + z() * 0.75;
        const links = z() < 0.5;
        const seite = links ? P.links : P.rechts;
        const [sx, sy] = seite[Math.min(seite.length - 1, Math.floor(f * seite.length))];
        const lang = H * (0.04 + z() * 0.1) * steil;
        const richtung = links ? 0.3 : -0.3;
        const imLicht = links === pal.links;
        for (let m = 0; m < 3; m += 1) {
          k.strokeStyle = rgba(dunst(pal.felsSchatten, d), (imLicht ? 0.28 : 0.4) * (1 - m * 0.3));
          k.lineWidth = Math.max(0.5, H * 0.007 * (1 - m * 0.3));
          k.beginPath();
          k.moveTo(sx + richtung * lang * 0.33 * m, sy + 1 + lang * 0.33 * m);
          k.lineTo(sx + richtung * lang * 0.33 * (m + 1), sy + 1 + lang * 0.33 * (m + 1));
          k.stroke();
        }
      }
      // Am breiten Massiv: ein Gletscher, der in ein Tal fliesst.
      if (G.gletscher) {
        const gx = P.gx + G.r * H * 0.38;
        const top = fuss - H * 0.5;
        const unten = fuss - H * 0.08;
        k.beginPath();
        k.moveTo(gx - H * 0.2, top);
        k.bezierCurveTo(gx - H * 0.12, top + H * 0.12, gx - H * 0.08, unten - H * 0.1, gx - H * 0.02, unten);
        k.quadraticCurveTo(gx + H * 0.03, unten + H * 0.02, gx + H * 0.06, unten - H * 0.01);
        k.bezierCurveTo(gx + H * 0.05, unten - H * 0.12, gx + H * 0.1, top + H * 0.1, gx + H * 0.18, top - H * 0.02);
        k.closePath();
        const eis = k.createLinearGradient(0, top, 0, unten);
        eis.addColorStop(0, rgba(dunst(pal.schneeLicht, d), 0.95));
        eis.addColorStop(1, rgba(dunst(pal.gletscher, d), 0.95));
        k.fillStyle = eis;
        k.fill();
        k.strokeStyle = rgba(dunst(pal.felsSchatten, d * 0.5), 0.1);
        k.lineWidth = 0.5;
        for (let j = 1; j < 4; j += 1) {
          const y = lerp(top + H * 0.08, unten - H * 0.04, j / 6);
          k.beginPath();
          k.moveTo(gx - H * 0.08, y);
          k.quadraticCurveTo(gx, y + H * 0.025, gx + H * 0.06, y - H * 0.005);
          k.stroke();
        }
      }
      // Unten in den Dunst des Tals.
      const tal = k.createLinearGradient(0, P.gy, 0, fuss);
      tal.addColorStop(0, rgba(pal.dunst, 0.04 + G.d * 0.25));
      tal.addColorStop(0.6, rgba(pal.dunst, 0.12 + G.d * 0.3));
      tal.addColorStop(1, rgba(pal.dunst, 0.75));
      k.fillStyle = tal;
      k.fillRect(P.lx - 4, P.gy - 2, P.rx - P.lx + 8, fuss - P.gy + 4);
      k.restore();
      // Die Grate fangen das erste Licht.
      k.strokeStyle = rgba(pal.kante, 0.55 * (1 - G.d * 0.6));
      k.lineWidth = 0.9;
      k.beginPath();
      const kante = pal.links ? P.links : [[P.gx, P.gy], ...P.rechts];
      kante.forEach(([x, y], j) => { if (j) k.lineTo(x, y + 0.4); else k.moveTo(x, y + 0.4); });
      k.stroke();
    });
  }

  // ---------------------------------------------------------------------------
  // Zeichnen: der Himmel über dem See – einmal gemalt, dann aufgelegt
  // ---------------------------------------------------------------------------
  /*
   * Morgendämmerung: oben noch tiefes Blau mit den letzten Sternen und der
   * Venus, dann Violett, Rosa und Pfirsich zum Horizont; links hinter den
   * Bergen geht bald die Sonne auf. Lange, dünne Wolken, von unten rosa und
   * golden beleuchtet. Davor das Panorama (maleBerge). Zwei Fassungen: vor
   * dem Alpenglühen (blau) – nur beim ersten Start, wenn die Gipfel
   * aufglühen – und glühend.
   */
  const HIMMEL_GLUT = {
    stops: [[0, [20, 28, 70]], [0.26, [40, 44, 102]], [0.48, [92, 74, 134]], [0.66, [166, 102, 144]], [0.8, [226, 138, 140]], [0.92, [246, 176, 136]], [1, [251, 208, 162]]],
    tal: [236, 188, 176], wolke: [255, 186, 160], wolkeDunkel: [116, 84, 140], sonne: [255, 206, 150],
  };
  const HIMMEL_BLAU = {
    stops: [[0, [14, 22, 60]], [0.3, [32, 42, 96]], [0.55, [64, 72, 130]], [0.75, [116, 112, 166]], [0.9, [160, 150, 188]], [1, [186, 172, 200]]],
    tal: [170, 160, 196], wolke: [176, 168, 206], wolkeDunkel: [74, 74, 124], sonne: [210, 190, 210],
  };

  function maleHimmel(k, W, H, glut) {
    const pal = glut ? HIMMEL_GLUT : HIMMEL_BLAU;
    const hz = view.hz;
    const frei = view.frei;
    const v = k.createLinearGradient(0, 0, 0, hz);
    pal.stops.forEach(([f, c]) => v.addColorStop(f, rgb(c)));
    k.fillStyle = v;
    k.fillRect(0, 0, W, hz + 1);
    k.fillStyle = rgb(pal.tal);
    k.fillRect(0, hz, W, H - hz);
    // Links hinter den Bergen: Bald geht dort die Sonne auf.
    const sx = W * 0.16;
    const r = Math.max(W, H) * 0.75;
    k.save();
    k.translate(sx, hz);
    k.scale(1.6, 1);
    const hof = k.createRadialGradient(0, 0, 0, 0, 0, r);
    hof.addColorStop(0, rgba(pal.sonne, glut ? 0.75 : 0.25));
    hof.addColorStop(0.18, rgba(pal.sonne, glut ? 0.38 : 0.12));
    hof.addColorStop(0.5, rgba(pal.sonne, glut ? 0.08 : 0.03));
    hof.addColorStop(1, rgba(pal.sonne, 0));
    k.fillStyle = hof;
    k.fillRect(-r, -r, 2 * r, 2 * r);
    k.restore();
    // Die letzten Sterne, oben.
    const z = wuerfel(2207);
    k.fillStyle = "#ffffff";
    for (let i = 0; i < 70; i += 1) {
      const x = z() * W;
      const y = frei * 0.3 + z() ** 1.6 * (hz - frei) * 0.55;
      const a = clamp(1 - y / (hz * 0.6), 0, 1) * (0.25 + z() * 0.6);
      k.globalAlpha = a * (glut ? 0.75 : 1);
      const g2 = 0.5 + z() * 0.9;
      k.fillRect(x, y, g2, g2);
    }
    k.globalAlpha = 1;
    // Lange, dünne Wolken: oben im Schatten, unten im Licht der Sonne.
    for (let i = 0; i < 6; i += 1) {
      const cx = (0.1 + i * 0.17 + z() * 0.08) * W;
      const cy = frei + (hz - frei) * (0.18 + z() * 0.42);
      const lang = W * (0.12 + z() * 0.22);
      const dick = Math.max(2, (hz - frei) * (0.012 + z() * 0.018));
      for (let j = 0; j < 5; j += 1) {
        const ox = (z() - 0.5) * lang * 0.9;
        const oy = (z() - 0.5) * dick * 1.4;
        const rx = lang * (0.25 + z() * 0.35);
        const ry = dick * (0.7 + z() * 0.6);
        const w2 = k.createLinearGradient(0, cy + oy - ry, 0, cy + oy + ry);
        w2.addColorStop(0, rgba(pal.wolkeDunkel, 0.35));
        w2.addColorStop(0.55, rgba(pal.wolke, 0.5));
        w2.addColorStop(1, rgba(pal.wolke, glut ? 0.85 : 0.4));
        k.fillStyle = w2;
        k.beginPath();
        k.ellipse(cx + ox, cy + oy, rx, ry, 0, 0, TAU);
        k.fill();
      }
    }
    // Die Berge.
    maleBerge(k, W, hz, view.berg, glut ? BERG_GLUT : BERG_BLAU);
    // Morgennebel über dem Tal, am Fuss der Berge.
    const nebel = k.createLinearGradient(0, hz - view.berg * 0.18, 0, hz + 6);
    nebel.addColorStop(0, rgba(pal.tal, 0));
    nebel.addColorStop(0.75, rgba(pal.tal, 0.55));
    nebel.addColorStop(1, rgba(pal.tal, 0.9));
    k.fillStyle = nebel;
    k.fillRect(0, hz - view.berg * 0.18, W, view.berg * 0.18 + 6);
  }

  // ---------------------------------------------------------------------------
  // Zeichnen: Hänge, Wald und Ufer – Streifen, einmal gemalt, dann aufgelegt
  // ---------------------------------------------------------------------------
  /*
   * Hinter den fernen Bergen stehen drei Streifen, je näher, desto
   * schneller:
   *
   *   hang   bewaldete Hänge mit goldenen Lärchen, Felsen, einer Alphütte
   *          (Licht im Fenster, Rauch) und einer Kapelle; unten Nebel
   *   wald   Lärchen und Arven gleich hinter dem Weg, im Dunst
   *   ufer   der Weg, die Uferkante und ihr Spiegelbild (Einheiten der
   *          Strecke, PERIODE lang)
   *
   * Jeder Streifen wiederholt sich nach seiner Breite; was darauf steht, wird
   * darum um eine Breite versetzt noch einmal gemalt. Für den See gibt es
   * jeden schon gespiegelt: im Morgenlicht (dunkler, blauer, mit feinen
   * Wellen) und in der Nacht des erwachten Sees.
   */
  let ebenen = null;
  const PAR = { hang: 0.07, wald: 0.24 };

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

  // Ein Bild, auf den Kopf gestellt – und danach getönt (nach).
  function gespiegelt(bild, nach) {
    const c = document.createElement("canvas");
    c.width = bild.width;
    c.height = bild.height;
    const k = c.getContext("2d");
    k.translate(0, c.height);
    k.scale(1, -1);
    k.drawImage(bild, 0, 0);
    k.setTransform(1, 0, 0, 1, 0, 0);
    if (nach) {
      k.globalCompositeOperation = "source-atop";
      nach(k, c.width, c.height);
      k.globalCompositeOperation = "source-over";
    }
    return c;
  }

  // Die Tönung des treuen Spiegels: dunkler und blauer, mit feinen hellen
  // Wellen (in Bildpunkten des Bildes).
  function spiegelTon(k, w, h, saat) {
    k.fillStyle = "rgba(30, 40, 92, 0.36)";
    k.fillRect(0, 0, w, h);
    const z = wuerfel(saat);
    const d = view.dpr;
    for (let i = 0; i < Math.round(w * h / (900 * d * d)); i += 1) {
      const x = z() * w;
      const y = z() * h;
      const lang = (6 + z() * 34) * d;
      k.fillStyle = z() < 0.6 ? "rgba(255, 236, 226, 0.11)" : "rgba(16, 20, 50, 0.16)";
      k.fillRect(x, y, lang, Math.max(1, d * 0.8));
    }
  }

  const HANG_TAG = {
    fern: [120, 102, 150], fernLicht: [226, 150, 150], nah: [64, 66, 110], nahLicht: [188, 120, 126],
    baum: [44, 50, 88], laerche: [214, 160, 84], fels: [150, 134, 168], huette: [58, 44, 66], dach: [92, 70, 86],
    fenster: [255, 206, 122], kapelle: [242, 220, 226], nebel: [240, 196, 190], rauch: [230, 210, 220],
  };
  const HANG_NACHT = {
    fern: [16, 30, 62], fernLicht: [110, 230, 240], nah: [10, 20, 44], nahLicht: [80, 200, 230],
    baum: [8, 16, 36], laerche: [54, 120, 150], fels: [30, 48, 82], huette: [8, 14, 30], dach: [16, 26, 50],
    fenster: [130, 250, 255], kapelle: [96, 140, 190], nebel: [18, 50, 92], rauch: [70, 140, 170],
  };

  function maleHang(k, W, voll, pal) {
    // Die Formen hängen an der Höhe ohne das Tal darunter (unterTal).
    const H = voll - (pal.unterTal || 0);
    const z = wuerfel(6203);
    const kammA = (x) => H * (0.3 + 0.2 * rauschenRund((x / W) * 6, 6, 3) + 0.08 * rauschenRund((x / W) * 15, 15, 9));
    const kammB = (x) => H * (0.56 + 0.16 * rauschenRund((x / W) * 5, 5, 17) + 0.06 * rauschenRund((x / W) * 19, 19, 23));
    // Der ferne Hang, mit hellem Saum im ersten Licht.
    k.fillStyle = rgb(pal.fern);
    k.beginPath();
    k.moveTo(0, H);
    for (let x = 0; x <= W; x += 3) k.lineTo(x, kammA(x));
    k.lineTo(W, H);
    k.closePath();
    k.fill();
    k.strokeStyle = rgba(pal.fernLicht, 0.55);
    k.lineWidth = 1;
    k.beginPath();
    for (let x = 0; x <= W; x += 3) { if (x) k.lineTo(x, kammA(x) + 0.5); else k.moveTo(x, kammA(x) + 0.5); }
    k.stroke();
    // Wald auf dem fernen Hang: kleine Spitzen, dicht.
    k.fillStyle = rgba(mix3(pal.fern, pal.baum, 0.5), 0.9);
    for (let x = 0; x < W; x += 2.2) {
      const y0 = kammA(x) + H * 0.04 + z() * H * 0.05;
      if (z() < 0.35) continue;
      const h = H * (0.025 + z() * 0.03);
      rundum(W, (dx) => {
        k.beginPath();
        k.moveTo(x + dx - h * 0.3, y0 + h);
        k.lineTo(x + dx, y0);
        k.lineTo(x + dx + h * 0.3, y0 + h);
        k.fill();
      });
    }
    // Felsen im fernen Hang.
    for (let i = 0; i < 6; i += 1) {
      const x = z() * W;
      const y = kammA(x) + H * (0.02 + z() * 0.06);
      const b = W * (0.02 + z() * 0.03);
      rundum(W, (dx) => {
        k.fillStyle = rgba(pal.fels, 0.55);
        k.beginPath();
        k.moveTo(x + dx - b, y + b * 0.5);
        k.lineTo(x + dx - b * 0.2, y - b * 0.2);
        k.lineTo(x + dx + b * 0.6, y + b * 0.1);
        k.lineTo(x + dx + b, y + b * 0.6);
        k.closePath();
        k.fill();
      });
    }
    // Der nahe Hang.
    k.fillStyle = rgb(pal.nah);
    k.beginPath();
    k.moveTo(0, H);
    for (let x = 0; x <= W; x += 3) k.lineTo(x, kammB(x));
    k.lineTo(W, H);
    k.closePath();
    k.fill();
    k.strokeStyle = rgba(pal.nahLicht, 0.5);
    k.lineWidth = 1;
    k.beginPath();
    for (let x = 0; x <= W; x += 3) { if (x) k.lineTo(x, kammB(x) + 0.5); else k.moveTo(x, kammB(x) + 0.5); }
    k.stroke();
    // Wald: Arven dunkel, dazwischen die goldenen Lärchen.
    for (let x = 0; x < W; x += 1.6) {
      const y0 = kammB(x) + 1 + z() * H * 0.16;
      if (z() < 0.25) continue;
      const laerche = z() < 0.34;
      const h = H * (0.035 + z() * 0.04);
      rundum(W, (dx) => {
        k.fillStyle = laerche ? rgba(pal.laerche, 0.85) : rgba(pal.baum, 0.95);
        k.beginPath();
        k.moveTo(x + dx - h * 0.28, y0 + h);
        k.lineTo(x + dx, y0);
        k.lineTo(x + dx + h * 0.28, y0 + h);
        k.fill();
      });
    }
    // Eine Alphütte mit Licht im Fenster und Rauch, und eine Kapelle.
    const huette = W * 0.27;
    const kapelle = W * 0.71;
    rundum(W, (dx) => {
      const hx = huette + dx;
      const hy = kammB(huette) + H * 0.05;
      const b = H * 0.075;
      k.fillStyle = rgb(pal.huette);
      k.fillRect(hx - b * 0.6, hy - b * 0.45, b * 1.2, b * 0.55);
      k.fillStyle = rgb(pal.dach);
      k.beginPath();
      k.moveTo(hx - b * 0.8, hy - b * 0.42);
      k.lineTo(hx, hy - b * 0.95);
      k.lineTo(hx + b * 0.8, hy - b * 0.42);
      k.closePath();
      k.fill();
      k.fillStyle = rgb(pal.fenster);
      k.fillRect(hx + b * 0.12, hy - b * 0.3, b * 0.22, b * 0.18);
      const schein = k.createRadialGradient(hx + b * 0.23, hy - b * 0.21, 0, hx + b * 0.23, hy - b * 0.21, b * 0.9);
      schein.addColorStop(0, rgba(pal.fenster, 0.4));
      schein.addColorStop(1, rgba(pal.fenster, 0));
      k.fillStyle = schein;
      k.fillRect(hx - b, hy - b * 1.2, b * 2.4, b * 2);
      k.strokeStyle = rgba(pal.rauch, 0.35);
      k.lineWidth = b * 0.12;
      k.lineCap = "round";
      k.beginPath();
      k.moveTo(hx - b * 0.35, hy - b * 0.8);
      k.bezierCurveTo(hx - b * 0.1, hy - b * 1.6, hx - b * 0.8, hy - b * 2.1, hx - b * 0.2, hy - b * 2.9);
      k.stroke();
      // Die Kapelle: weiss, mit spitzem Turm.
      const kx = kapelle + dx;
      const ky = kammB(kapelle) + H * 0.035;
      const c = H * 0.06;
      k.fillStyle = rgb(pal.kapelle);
      k.fillRect(kx - c * 0.55, ky - c * 0.5, c * 1.1, c * 0.6);
      k.fillRect(kx + c * 0.25, ky - c * 1.05, c * 0.32, c * 0.6);
      k.fillStyle = rgb(pal.dach);
      k.beginPath();
      k.moveTo(kx - c * 0.65, ky - c * 0.48);
      k.lineTo(kx - c * 0.1, ky - c * 0.85);
      k.lineTo(kx + c * 0.45, ky - c * 0.48);
      k.closePath();
      k.fill();
      k.beginPath();
      k.moveTo(kx + c * 0.2, ky - c * 1.03);
      k.lineTo(kx + c * 0.41, ky - c * 1.55);
      k.lineTo(kx + c * 0.62, ky - c * 1.03);
      k.closePath();
      k.fill();
    });
    // Nebel in den Senken, unten dicht – und darunter, bis zum Weg, das Tal
    // im Nebel (deckend: Hinter dem Hang muss kein Himmel mehr liegen).
    const tal = H;
    const nebel = k.createLinearGradient(0, H * 0.55, 0, tal);
    nebel.addColorStop(0, rgba(pal.nebel, 0));
    nebel.addColorStop(0.6, rgba(pal.nebel, 0.38));
    nebel.addColorStop(1, rgba(pal.nebel, 0.78));
    k.fillStyle = nebel;
    k.fillRect(0, H * 0.55, W, tal - H * 0.55);
    if (pal.unterTal) {
      k.fillStyle = rgb(mix3(pal.nah, pal.nebel, 0.78));
      k.fillRect(0, tal, W, voll - tal);
    }
  }

  const WALD_TAG = {
    laerche: [202, 150, 92], laercheLicht: [246, 196, 126], arve: [30, 56, 56], arveLicht: [86, 118, 104],
    stamm: [70, 56, 80], wiese: [92, 84, 124], nebel: [238, 200, 198], funken: null,
  };
  const WALD_NACHT = {
    laerche: [20, 38, 66], laercheLicht: [80, 200, 226], arve: [8, 16, 38], arveLicht: [56, 150, 196],
    stamm: [8, 14, 30], wiese: [8, 16, 36], nebel: [16, 44, 84], funken: [160, 255, 240],
  };

  // Lärchen und Arven gleich hinter dem Weg. Ihr Fuss liegt unten im
  // Streifen (vom Ufer verdeckt). Das Licht kommt von links.
  function maleWald(k, W, H, pal, s) {
    const z = wuerfel(8831);
    const baeume = [];
    let x = 0;
    while (x < W) {
      const laerche = z() < 0.62;
      baeume.push({ x, laerche, hoch: H * lerp(0.42, 0.98, z() ** 0.8), breit: lerp(0.15, 0.22, z()), saat: z(), nah: z() });
      x += W * lerp(0.03, 0.09, z());
    }
    baeume.sort((a, b) => a.nah - b.nah);
    // Eine Wiese ganz unten, im Nebel.
    k.fillStyle = rgb(pal.wiese);
    k.fillRect(0, H * 0.9, W, H * 0.1);
    baeume.forEach((b) => rundum(W, (dx) => {
      const bx = b.x + dx;
      const fuss = H + 2;
      const top = fuss - b.hoch;
      const dunst = (1 - b.nah) * 0.35;
      const nebel = pal.nebel;
      k.strokeStyle = rgb(mix3(pal.stamm, nebel, dunst));
      k.lineWidth = Math.max(0.8, b.hoch * 0.022);
      k.beginPath();
      k.moveTo(bx, fuss);
      k.lineTo(bx, top + b.hoch * 0.05);
      k.stroke();
      if (b.laerche) {
        // Die Lärche: schlank, mit hängenden Zweigen in vielen Stufen,
        // golden; links im Licht.
        const stufen = 12;
        for (let i = 0; i < stufen; i += 1) {
          const f = i / (stufen - 1);
          const y = top + b.hoch * (0.03 + f * 0.86);
          const w = b.hoch * b.breit * (0.12 + f * 0.88) * (0.75 + hash01(b.saat * 31 + i) * 0.5);
          const fall = b.hoch * (0.05 + f * 0.035);
          const zweig = (x0, rand) => {
            k.beginPath();
            k.moveTo(bx, y - fall * 0.2);
            k.quadraticCurveTo(bx + (x0 - bx) * 0.55, y - fall * 0.35, x0, y + fall * rand);
            k.quadraticCurveTo(bx + (x0 - bx) * 0.5, y + fall * 0.55, bx, y + fall * 0.45);
            k.closePath();
          };
          k.fillStyle = rgb(mix3(pal.laerche, nebel, dunst));
          zweig(bx - w, 1);
          k.fill();
          zweig(bx + w * 0.92, 1.1);
          k.fill();
          k.fillStyle = rgba(mix3(pal.laercheLicht, nebel, dunst), 0.8);
          zweig(bx - w * 0.85, 0.7);
          k.fill();
        }
      } else {
        // Die Arve: dunkel, dicht, mit Büscheln an den Enden der Äste, die
        // in Stockwerken stehen; oben breit und rund. Links im Licht.
        const stock = 8;
        const buschel = [];
        for (let i = 0; i < stock; i += 1) {
          const f = i / (stock - 1);
          const y = top + b.hoch * (0.07 + f * 0.72);
          const w = b.hoch * b.breit * (0.45 + 0.55 * Math.sin(Math.min(1, f * 1.2 + 0.25) * Math.PI * 0.75)) * 1.1;
          const r = b.hoch * (0.05 + hash01(b.saat * 13 + i) * 0.025);
          buschel.push([bx - w * (0.6 + hash01(b.saat * 7 + i) * 0.4), y, r]);
          buschel.push([bx + w * (0.55 + hash01(b.saat * 11 + i) * 0.45), y + r * 0.3, r * 0.95]);
          buschel.push([bx + (hash01(b.saat * 19 + i) - 0.5) * w * 0.5, y - r * 0.4, r * 1.1]);
        }
        k.strokeStyle = rgb(mix3(pal.stamm, nebel, dunst));
        k.lineWidth = Math.max(0.6, b.hoch * 0.01);
        k.beginPath();
        buschel.forEach(([x2, y]) => { k.moveTo(bx, y + b.hoch * 0.03); k.lineTo(x2, y); });
        k.stroke();
        // Jedes Büschel aus ein paar runden Nadelballen, unregelmässig.
        const ballen = [];
        buschel.forEach(([x2, y, r], i) => {
          for (let j = 0; j < 4; j += 1) {
            const q = hash01(b.saat * 41 + i * 4.1 + j * 1.7);
            const q2 = hash01(b.saat * 23 + i * 2.9 + j * 3.1);
            ballen.push([x2 + (q - 0.5) * r * 2.4, y + (q2 - 0.55) * r * 1.1, r * (0.5 + hash01(i * 5.3 + j + b.saat) * 0.35)]);
          }
        });
        k.fillStyle = rgb(mix3(pal.arve, nebel, dunst * 0.7));
        k.beginPath();
        ballen.forEach(([x2, y, r]) => { k.moveTo(x2 + r, y); k.arc(x2, y, r, 0, TAU); });
        k.fill();
        k.fillStyle = rgba(mix3(pal.arveLicht, nebel, dunst * 0.7), 0.55);
        k.beginPath();
        ballen.forEach(([x2, y, r]) => {
          if (x2 > bx + b.hoch * 0.04) return;
          k.moveTo(x2 - r * 0.25 + r * 0.6, y - r * 0.35);
          k.arc(x2 - r * 0.25, y - r * 0.35, r * 0.6, 0, TAU);
        });
        k.fill();
      }
      if (pal.funken && hash01(b.saat * 7) < 0.5) {
        // In der Nacht des Sees: Lichter in den Zweigen.
        for (let i = 0; i < 3; i += 1) {
          const fx = bx + (hash01(b.saat * 3 + i) - 0.5) * b.hoch * 0.3;
          const fy = top + b.hoch * (0.2 + hash01(b.saat * 5 + i) * 0.6);
          const fr = Math.max(0.6, s * 0.7);
          const schein = k.createRadialGradient(fx, fy, 0, fx, fy, fr * 5);
          schein.addColorStop(0, rgba(pal.funken, 0.6));
          schein.addColorStop(1, rgba(pal.funken, 0));
          k.fillStyle = schein;
          k.fillRect(fx - fr * 5, fy - fr * 5, fr * 10, fr * 10);
          k.fillStyle = rgb(pal.funken);
          k.fillRect(fx - fr * 0.5, fy - fr * 0.5, fr, fr);
        }
      }
    }));
    // Nebel zwischen den Stämmen, unten dicht.
    const nebel = k.createLinearGradient(0, H * 0.45, 0, H);
    nebel.addColorStop(0, rgba(pal.nebel, 0));
    nebel.addColorStop(0.7, rgba(pal.nebel, pal.funken ? 0.3 : 0.45));
    nebel.addColorStop(1, rgba(pal.nebel, pal.funken ? 0.55 : 0.8));
    k.fillStyle = nebel;
    k.fillRect(0, H * 0.45, W, H * 0.55);
  }

  // Das Ufer: oben der Weg (pfadY), ein heller Kiesweg im Reif, darunter
  // die Uferkante aus Steinen bis zum Wasser (wlY), darunter ihr
  // Spiegelbild. PERIODE Einheiten breit. Nichts davon ragt über den Weg
  // hinaus, was man für ein Hindernis halten könnte.
  function maleUfer(k, W, H, pfadY, wlY, nacht) {
    const s = W / PERIODE;
    const z = wuerfel(9127);
    const bank = wlY - pfadY;
    k.fillStyle = "rgb(52, 42, 72)";
    k.fillRect(0, pfadY, W, bank);
    // Die Steine der Kante, dicht an dicht, im Licht von links.
    const steine = [];
    let x = 0;
    while (x < W) {
      const r = (1.4 + z() * 2) * s;
      const y = clamp(pfadY + bank * (0.4 + z() * 0.5), pfadY + r * 0.75 + 0.6 * s, wlY + r * 0.2);
      steine.push({ x: x + r, r, y, hell: z(), flach: 0.6 + z() * 0.25 });
      x += r * (1.25 + z() * 0.8);
    }
    steine.forEach((st) => rundum(W, (dx) => {
      const c = mix3([74, 64, 98], [128, 112, 142], st.hell);
      k.fillStyle = rgb(c);
      k.beginPath();
      k.ellipse(st.x + dx, st.y, st.r * 1.2, st.r * st.flach, 0, 0, TAU);
      k.fill();
      k.fillStyle = "rgba(246, 188, 176, 0.45)";
      k.beginPath();
      k.ellipse(st.x + dx - st.r * 0.35, st.y - st.r * st.flach * 0.4, st.r * 0.62, st.r * st.flach * 0.38, -0.2, 0, TAU);
      k.fill();
      k.fillStyle = "rgba(236, 242, 255, 0.55)";
      k.fillRect(st.x + dx - st.r * 0.6, st.y - st.r * st.flach * 0.92, st.r * 0.9, Math.max(0.6, s * 0.35));
    }));
    // Nass und dunkel, wo das Wasser die Steine berührt.
    const nass = k.createLinearGradient(0, wlY - bank * 0.35, 0, wlY);
    nass.addColorStop(0, "rgba(24, 18, 44, 0)");
    nass.addColorStop(1, "rgba(24, 18, 44, 0.7)");
    k.fillStyle = nass;
    k.fillRect(0, wlY - bank * 0.35, W, bank * 0.35);
    // Der Weg: heller Kies, im Reif, mit dunkleren Körnern.
    const dick = Math.max(1.4, 1.3 * s);
    const weg = k.createLinearGradient(0, pfadY - dick * 0.5, 0, pfadY + dick);
    weg.addColorStop(0, "rgb(236, 216, 212)");
    weg.addColorStop(1, "rgb(178, 152, 170)");
    k.fillStyle = weg;
    k.fillRect(0, pfadY - dick * 0.5, W, dick * 1.5);
    for (let i = 0; i < Math.round(W / 2.5); i += 1) {
      const kx = z() * W;
      const ky = pfadY - dick * 0.3 + z() * dick * 1.1;
      k.fillStyle = z() < 0.5 ? "rgba(120, 96, 124, 0.55)" : "rgba(255, 250, 250, 0.8)";
      k.fillRect(kx, ky, Math.max(0.6, s * (0.3 + z() * 0.5)), Math.max(0.6, s * 0.3));
    }
    // Gräser am hinteren Rand, niedrig, im Reif (sie sind kein Hindernis).
    for (let i = 0; i < Math.round(W / 11); i += 1) {
      const gx = z() * W;
      const hoch = (1 + z() * 1.6) * s;
      const zahl = 3 + Math.floor(z() * 3);
      rundum(W, (dx) => {
        k.strokeStyle = "rgba(176, 160, 198, 0.9)";
        k.lineWidth = Math.max(0.5, s * 0.28);
        k.beginPath();
        for (let j = 0; j < zahl; j += 1) {
          const w = (j / (zahl - 1) - 0.5) * 1.2;
          k.moveTo(gx + dx + j * s * 0.45, pfadY - dick * 0.4);
          k.quadraticCurveTo(gx + dx + j * s * 0.45 + w * hoch * 0.3, pfadY - dick * 0.4 - hoch * 0.6, gx + dx + j * s * 0.45 + w * hoch, pfadY - dick * 0.4 - hoch);
        }
        k.stroke();
      });
    }
    // Das Spiegelbild darunter: alles kopfüber, getönt.
    k.save();
    k.beginPath();
    k.rect(0, wlY, W, H - wlY);
    k.clip();
    k.translate(0, 2 * wlY);
    k.scale(1, -1);
    k.drawImage(k.canvas, 0, 0, k.canvas.width, Math.round(wlY * view.dpr), 0, 0, W, wlY);
    k.restore();
    k.fillStyle = nacht ? "rgba(6, 12, 34, 0.8)" : "rgba(28, 36, 88, 0.45)";
    k.fillRect(0, wlY, W, H - wlY);
    if (nacht) {
      // Der Saum des gespiegelten Weges leuchtet.
      k.fillStyle = "rgba(120, 240, 255, 0.35)";
      k.fillRect(0, wlY + bank, W, Math.max(0.8, s * 0.5));
    }
  }

  // ---------------------------------------------------------------------------
  // Zeichnen: die Nacht im erwachten See – einmal gemalt
  // ---------------------------------------------------------------------------
  /*
   * Kopfüber, wie alles im See: Nahe der Wasserlinie die gespiegelten Berge
   * im Mondlicht, darunter ein Nachthimmel von Türkis über Blau zu Violett,
   * eine Milchstrasse, Sterne, der Mond mit seinem Hof und Lichtfäden wie
   * Polarlicht. Licht fällt in Bahnen von der Wasserlinie in die Tiefe, und
   * ganz unten ahnt man einen Grund mit Steinen, auf denen Licht spielt.
   */
  function maleNacht(k, W, H) {
    const wl = view.wl;
    const v = k.createLinearGradient(0, 0, 0, H);
    v.addColorStop(0, "rgb(10, 30, 62)");
    v.addColorStop(0.1, "rgb(12, 30, 70)");
    v.addColorStop(0.32, "rgb(20, 28, 82)");
    v.addColorStop(0.58, "rgb(34, 22, 86)");
    v.addColorStop(0.82, "rgb(18, 12, 52)");
    v.addColorStop(1, "rgb(8, 8, 28)");
    k.fillStyle = v;
    k.fillRect(0, 0, W, H);
    // Der Horizont des Sees: ein türkiser Schein.
    const hz = (wl - view.hz);
    const hof = k.createLinearGradient(0, hz - view.berg * 0.2, 0, hz + view.berg * 0.9);
    hof.addColorStop(0, "rgba(60, 220, 210, 0)");
    hof.addColorStop(0.3, "rgba(60, 220, 210, 0.12)");
    hof.addColorStop(1, "rgba(60, 220, 210, 0)");
    k.fillStyle = hof;
    k.fillRect(0, hz - view.berg * 0.2, W, view.berg * 1.1);
    const z = wuerfel(5521);
    // Die Milchstrasse: ein schräges Band aus feinem Licht.
    for (let i = 0; i < 900; i += 1) {
      const f = z();
      const quer = (z() + z() + z() - 1.5) * 0.12;
      const x = f * W;
      const y = H * (0.88 - f * 0.4 + quer);
      if (y < hz + view.berg * 0.3) continue;
      k.fillStyle = z() < 0.5 ? "rgba(180, 200, 255, 0.16)" : "rgba(230, 200, 255, 0.12)";
      const r = 0.6 + z() * 1.8;
      k.fillRect(x, y, r, r);
    }
    // Sterne.
    for (let i = 0; i < 260; i += 1) {
      const x = z() * W;
      const y = hz + view.berg * BERG_TRAUM * 0.2 + z() * (H - hz);
      const r = 0.4 + z() ** 3 * 1.6;
      const farbe = z();
      k.fillStyle = farbe < 0.15 ? "rgba(255, 220, 200, 0.8)" : farbe < 0.35 ? "rgba(180, 240, 255, 0.85)" : "rgba(235, 240, 255, 0.75)";
      k.globalAlpha = 0.35 + z() * 0.6;
      k.fillRect(x, y, r, r);
    }
    k.globalAlpha = 1;
    // Lichtfäden: Bahnen wie Polarlicht, die aus der Tiefe wehen.
    const himmelAb = hz + view.berg * BERG_TRAUM * 0.7;
    [[0.12, [70, 240, 210], 0.3], [0.3, [150, 110, 255], 0.26], [0.48, [80, 200, 255], 0.18]].forEach(([tief, farbe, kraft], j) => {
      const y0 = himmelAb + (H - himmelAb) * tief;
      for (let x = -10; x < W + 10; x += 2) {
        const u = x / W;
        const y = y0 + Math.sin(u * 5.2 + j * 2.1) * H * 0.04 + Math.sin(u * 13 + j) * H * 0.012;
        const lang = H * (0.07 + 0.05 * (0.5 + 0.5 * Math.sin(u * 9 + j * 3)));
        const band = k.createLinearGradient(0, y, 0, y + lang);
        band.addColorStop(0, rgba(farbe, kraft * (0.6 + 0.4 * Math.sin(u * 23 + j))));
        band.addColorStop(1, rgba(farbe, 0));
        k.fillStyle = band;
        k.fillRect(x, y, 2.2, lang);
      }
    });
    // Der Mond mit seinem Hof.
    // Unter den gespiegelten Gipfeln, wo die Berge niedrig sind.
    const mr = clamp(view.berg * 0.08, 7, 42);
    const mx = W * 0.22;
    const my = Math.min(H * 0.8 - mr, hz + view.berg * BERG_TRAUM * 0.75 + (H - hz - view.berg * BERG_TRAUM) * 0.3 + mr);
    const halo = k.createRadialGradient(mx, my, 0, mx, my, mr * 7);
    halo.addColorStop(0, "rgba(200, 240, 255, 0.6)");
    halo.addColorStop(0.15, "rgba(150, 220, 255, 0.3)");
    halo.addColorStop(0.45, "rgba(120, 160, 255, 0.1)");
    halo.addColorStop(1, "rgba(120, 160, 255, 0)");
    k.fillStyle = halo;
    k.fillRect(mx - mr * 7, my - mr * 7, mr * 14, mr * 14);
    k.fillStyle = "rgb(236, 244, 255)";
    k.beginPath();
    k.arc(mx, my, mr, 0, TAU);
    k.fill();
    k.fillStyle = "rgba(170, 190, 226, 0.55)";
    [[-0.3, -0.2, 0.32], [0.25, 0.1, 0.22], [-0.05, 0.4, 0.18], [0.35, -0.38, 0.14]].forEach(([dx, dy, r]) => {
      k.beginPath();
      k.arc(mx + dx * mr, my + dy * mr, r * mr, 0, TAU);
      k.fill();
    });
    // Licht, das in Bahnen durchs Wasser fällt.
    for (let i = 0; i < 7; i += 1) {
      const x0 = W * (0.05 + i * 0.15 + z() * 0.06);
      const breit = W * (0.02 + z() * 0.04);
      const lang = H * (0.5 + z() * 0.45);
      const schraeg = W * 0.12;
      const bahn = k.createLinearGradient(0, 0, 0, lang);
      bahn.addColorStop(0, "rgba(140, 240, 255, 0.1)");
      bahn.addColorStop(1, "rgba(140, 240, 255, 0)");
      k.fillStyle = bahn;
      k.beginPath();
      k.moveTo(x0, 0);
      k.lineTo(x0 + breit, 0);
      k.lineTo(x0 + breit * 3 + schraeg, lang);
      k.lineTo(x0 + schraeg, lang);
      k.closePath();
      k.fill();
    }
    // Die Berge im Mondlicht, gespiegelt – im erwachten See niedriger und
    // ferner: Er zeigt nicht die Wirklichkeit, und darunter beginnt sein
    // eigener Himmel.
    k.save();
    k.translate(0, wl);
    k.scale(1, -1);
    maleBerge(k, W, view.hz, view.berg * BERG_TRAUM, BERG_NACHT, view.berg);
    k.restore();
    // Ihr Fuss verschwindet im Dunst über dem Wasser, wie oben im Tal.
    const fuss = wl - view.hz;
    const dunstBand = k.createLinearGradient(0, fuss - view.berg * 0.2, 0, fuss + view.berg * BERG_TRAUM * 0.5);
    dunstBand.addColorStop(0, "rgba(14, 32, 68, 0.95)");
    dunstBand.addColorStop(0.4, "rgba(14, 34, 70, 0.8)");
    dunstBand.addColorStop(1, "rgba(14, 34, 70, 0)");
    k.fillStyle = dunstBand;
    k.fillRect(0, fuss - view.berg * 0.2, W, view.berg * (0.2 + BERG_TRAUM * 0.5));
    // Der Grund: Steine, auf denen das Licht spielt, und Wasserpflanzen.
    const grund = H * 0.9;
    if (grund > hz + view.berg * BERG_TRAUM + 20) {
      const dunkel = k.createLinearGradient(0, grund - H * 0.06, 0, H);
      dunkel.addColorStop(0, "rgba(6, 10, 30, 0)");
      dunkel.addColorStop(0.5, "rgba(6, 10, 30, 0.7)");
      dunkel.addColorStop(1, "rgba(4, 6, 20, 0.95)");
      k.fillStyle = dunkel;
      k.fillRect(0, grund - H * 0.06, W, H - grund + H * 0.06);
      for (let i = 0; i < 26; i += 1) {
        const x = z() * W;
        const r = H * (0.012 + z() * 0.03);
        const y = grund + (H - grund) * (0.35 + z() * 0.7);
        k.fillStyle = "rgb(10, 18, 40)";
        k.beginPath();
        k.ellipse(x, y, r * 1.4, r, 0, 0, TAU);
        k.fill();
        k.strokeStyle = "rgba(80, 230, 230, 0.35)";
        k.lineWidth = 1;
        k.beginPath();
        k.ellipse(x, y, r * 1.4, r, 0, Math.PI * 1.1, Math.PI * 1.75);
        k.stroke();
        if (z() < 0.35) {
          k.fillStyle = "rgba(120, 255, 230, 0.7)";
          k.beginPath();
          k.arc(x + r * 0.4, y - r * 0.8, 1.1, 0, TAU);
          k.fill();
        }
      }
      k.strokeStyle = "rgba(40, 130, 130, 0.28)";
      k.lineWidth = 1.1;
      for (let i = 0; i < 12; i += 1) {
        const x = z() * W;
        const lang = H * (0.05 + z() * 0.08);
        k.beginPath();
        k.moveTo(x, H);
        k.bezierCurveTo(x + lang * 0.3, H - lang * 0.4, x - lang * 0.3, H - lang * 0.7, x + lang * 0.1, H - lang);
        k.stroke();
      }
      // Lichtnetz auf dem Grund.
      k.strokeStyle = "rgba(120, 240, 240, 0.12)";
      k.lineWidth = 0.8;
      for (let i = 0; i < 40; i += 1) {
        const x = z() * W;
        const y = grund + z() * (H - grund);
        const r = H * (0.01 + z() * 0.02);
        k.beginPath();
        k.moveTo(x - r, y);
        k.quadraticCurveTo(x, y - r * 0.6, x + r, y + r * 0.1);
        k.stroke();
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Die Ebenen neu malen (beim Laden und wenn sich die Grösse ändert)
  // ---------------------------------------------------------------------------
  // Kleine Scheine, einmal gemalt: Licht, Atem, Glanz.
  const SCHEINE = {
    warm: [[255, 220, 170], 1, 0.8],
    kalt: [[140, 250, 255], 1, 0.8],
    violett: [[200, 140, 255], 1, 0.8],
    weiss: [[255, 255, 255], 1, 0.8],
    atem: [[246, 244, 255], 0.7, 0.6],
    staub: [[236, 220, 222], 0.7, 0.55],
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

  // Der Nebel, der über das Ufer zieht: ein Grund, unten dicht und nach
  // oben dünner, an den Rändern ausgeblendet (nebelRand), und darüber
  // weiche Schwaden (nebelSchwade), die langsam ziehen.
  function nebelVerlauf(k, y, h) {
    const v = k.createLinearGradient(0, y, 0, y + h);
    v.addColorStop(0, "rgba(246, 226, 232, 0)");
    v.addColorStop(0.32, "rgba(246, 228, 234, 0.3)");
    v.addColorStop(0.55, "rgba(246, 230, 236, 0.86)");
    v.addColorStop(1, "rgba(246, 232, 238, 0.95)");
    return v;
  }

  function ebenenNeu() {
    const W = view.cssW;
    const H = view.cssH;
    const s = view.s;
    const dpr = view.dpr;
    const wl = view.wl;
    const hangUnten = view.pfad - (view.pfad - view.hz) * 0.22;
    const hangH = Math.round(Math.max(20, (hangUnten - view.hz) + view.berg * 0.28));
    // Oben reicht der Hang bis an den Weg und deckt ab seinem Kamm alles ab.
    const tal = Math.ceil(view.pfad + 2 - hangUnten);
    const waldH = Math.round(Math.max(20, (view.pfad - view.hz) * 0.98));
    const uferOben = 8 * s;
    const uferH = uferOben + UFER * s * 2 + 8 * s;
    const breitUfer = PERIODE * s;
    const unten = H - wl;
    ebenen = {
      hangUnten,
      uferOben,
      scheine: {},
    };
    Object.entries(SCHEINE).forEach(([name, [farbe, kraft, r]]) => { ebenen.scheine[name] = scheinAus(farbe, kraft, r * 16); });
    // Der Himmel mit den Bergen – und sein Spiegelbild, schon gespiegelt.
    const himmel = (glut) => streifen(W, wl, (k, w, h) => maleHimmel(k, w, h, glut));
    const spiegelVon = (bild, saat) => {
      const c = document.createElement("canvas");
      c.width = Math.round(W * dpr);
      c.height = Math.max(8, Math.round(unten * dpr));
      const k = c.getContext("2d");
      const hoch = bild.height;
      // Tiefer als der Himmel reicht: sein Zenit.
      k.fillStyle = "rgb(14, 20, 54)";
      k.fillRect(0, 0, c.width, c.height);
      k.save();
      k.translate(0, hoch);
      k.scale(1, -1);
      k.drawImage(bild, 0, 0);
      k.restore();
      spiegelTon(k, c.width, c.height, saat);
      const tief = k.createLinearGradient(0, 0, 0, c.height);
      tief.addColorStop(0, "rgba(10, 16, 44, 0)");
      tief.addColorStop(1, "rgba(10, 16, 44, 0.45)");
      k.fillStyle = tief;
      k.fillRect(0, 0, c.width, c.height);
      return c;
    };
    ebenen.himmel = himmel(true);
    ebenen.spiegel = spiegelVon(ebenen.himmel, 101);
    if (state.intro) {
      ebenen.himmelBlau = himmel(false);
      ebenen.spiegelBlau = spiegelVon(ebenen.himmelBlau, 101);
    }
    ebenen.hang = streifen(Math.round(W * 1.5), hangH + tal, (k, w, h) => maleHang(k, w, h, { ...HANG_TAG, unterTal: tal }));
    ebenen.hangSp = gespiegelt(ebenen.hang, (k, w, h) => spiegelTon(k, w, h, 202));
    ebenen.hangTal = tal;
    // Bis dorthin muss der Himmel gelegt werden: bis unter den höchsten
    // Kamm des Hangs (maleHang: 0,58 seiner Höhe).
    ebenen.himmelBis = Math.min(wl, hangUnten - hangH + (hangH) * 0.6);
    // Im erwachten See stehen die Hänge still (er zeigt nicht die
    // Wirklichkeit): einmal ins Bild der Nacht gemalt.
    const hangNacht = gespiegelt(streifen(Math.round(W * 1.5), hangH, (k, w, h) => maleHang(k, w, h, HANG_NACHT)));
    ebenen.wald = streifen(Math.round(W * 1.3), waldH, (k, w, h) => maleWald(k, w, h, WALD_TAG, s));
    ebenen.waldSp = gespiegelt(ebenen.wald, (k, w, h) => spiegelTon(k, w, h, 303));
    ebenen.waldNacht = gespiegelt(streifen(Math.round(W * 1.3), waldH, (k, w, h) => maleWald(k, w, h, WALD_NACHT, s)));
    ebenen.ufer = streifen(breitUfer, uferH, (k, w, h) => maleUfer(k, w, h, uferOben, uferOben + UFER * s, false));
    ebenen.uferNacht = streifen(breitUfer, uferH, (k, w, h) => maleUfer(k, w, h, uferOben, uferOben + UFER * s, true));
    ebenen.nacht = streifen(W, unten, (k, w, h) => maleNacht(k, w, h));
    {
      const k = ebenen.nacht.getContext("2d");
      k.setTransform(1, 0, 0, 1, 0, 0);
      k.drawImage(hangNacht, -Math.round(W * 0.2 * dpr), Math.round((wl - hangUnten) * dpr));
    }
    // Der Nebel: seine Ränder und eine Schwade, je einmal gemalt.
    const nebelH = Math.round((DECKE + 40) * s * dpr);
    const rand = Math.max(8, Math.round(60 * s * dpr));
    ebenen.nebelH = nebelH;
    ebenen.nebelRand = [0, 1].map((seite) => {
      const c = document.createElement("canvas");
      c.width = rand;
      c.height = nebelH;
      const k = c.getContext("2d");
      k.fillStyle = nebelVerlauf(k, 0, nebelH);
      k.fillRect(0, 0, rand, nebelH);
      k.globalCompositeOperation = "destination-in";
      const v = k.createLinearGradient(0, 0, rand, 0);
      v.addColorStop(seite ? 1 : 0, "rgba(0, 0, 0, 0)");
      v.addColorStop(seite ? 0 : 1, "rgba(0, 0, 0, 1)");
      k.fillStyle = v;
      k.fillRect(0, 0, rand, c.height);
      return c;
    });
    ebenen.nebelSchwade = (() => {
      const r = 26 * s * dpr;
      const c = document.createElement("canvas");
      c.width = Math.round(r * 4.8);
      c.height = Math.round(r * 2);
      const k = c.getContext("2d");
      k.translate(c.width / 2, c.height / 2);
      k.scale(2.4, 1);
      const v = k.createRadialGradient(0, 0, 0, 0, 0, r);
      v.addColorStop(0, "rgba(255, 242, 246, 0.6)");
      v.addColorStop(0.5, "rgba(255, 242, 246, 0.28)");
      v.addColorStop(1, "rgba(255, 242, 246, 0)");
      k.fillStyle = v;
      k.fillRect(-r, -r, 2 * r, 2 * r);
      return c;
    })();
  }

  // Einen Streifen quer übers Bild legen (in Bildpunkten), immer wieder.
  function legeStreifen(bild, versatz, y) {
    const bw = bild.width;
    for (let x = -(((Math.round(versatz) % bw) + bw) % bw); x < canvas.width; x += bw) g.drawImage(bild, x, y);
  }

  // ---------------------------------------------------------------------------
  // Zeichnen: die Welt, je Bild aufgelegt
  // ---------------------------------------------------------------------------
  // Wie weit der See erwacht ist: 0 der treue Spiegel, 1 die Nacht.
  function nachtK() {
    if (state.erwacheT === null) return 0;
    return clamp((state.t - state.erwacheT - 0.25) / 1.7, 0, 1);
  }

  function zeichneWelt() {
    const dpr = view.dpr;
    const s = view.s;
    const cam = state.camX * s * dpr;
    const wlPx = Math.round(view.wl * dpr);
    g.setTransform(1, 0, 0, 1, 0, 0);
    // Oben: der Himmel mit den Bergen – beim ersten Start glühen die Gipfel
    // von oben nach unten auf.
    const intro = state.intro && ebenen.himmelBlau ? clamp(state.intro.t / state.intro.dauer, 0, 1) : 1;
    if (intro < 1) {
      g.drawImage(ebenen.himmelBlau, 0, 0);
      g.drawImage(ebenen.spiegelBlau, 0, wlPx);
      // Die Grenze des Lichts ist weich: ein paar Streifen mit wachsender
      // Deckkraft.
      const weich = Math.round(view.berg * 0.35 * dpr);
      const front = Math.round(lerp(view.frei * 0.5 - view.berg * 0.35, view.wl, glatt(intro) ** 0.8) * dpr);
      const W2 = ebenen.himmel.width;
      const lege = (y0, y1, alpha) => {
        const a = clamp(Math.round(y0), 0, wlPx);
        const b = clamp(Math.round(y1), 0, wlPx);
        if (b <= a) return;
        g.globalAlpha = alpha;
        g.drawImage(ebenen.himmel, 0, a, W2, b - a, 0, a, W2, b - a);
        // Im See glüht es von der Tiefe zur Wasserlinie hin auf.
        const sa = wlPx - b;
        const sb = Math.min(ebenen.spiegel.height, wlPx - a);
        if (sb > sa && sa >= 0) g.drawImage(ebenen.spiegel, 0, sa, W2, sb - sa, 0, wlPx + sa, W2, sb - sa);
        g.globalAlpha = 1;
      };
      lege(0, front - weich, 1);
      for (let i = 0; i < 6; i += 1) lege(front - weich + (weich * i) / 6, front - weich + (weich * (i + 1)) / 6, 1 - (i + 0.5) / 6);
    } else {
      const bis = Math.round(ebenen.himmelBis * dpr);
      g.drawImage(ebenen.himmel, 0, 0, ebenen.himmel.width, bis, 0, 0, ebenen.himmel.width, bis);
    }
    const hangY = Math.round((ebenen.hangUnten + ebenen.hangTal) * dpr);
    legeStreifen(ebenen.hang, cam * PAR.hang, hangY - ebenen.hang.height);
    const waldY = Math.round((view.pfad + 1) * dpr);
    legeStreifen(ebenen.wald, cam * PAR.wald, waldY - ebenen.wald.height);
    // Unten: der treue Spiegel, darüber (erwacht) die Nacht.
    const n = nachtK();
    if (n < 1) {
      if (intro >= 1) g.drawImage(ebenen.spiegel, 0, wlPx);
      legeStreifen(ebenen.hangSp, cam * PAR.hang, 2 * wlPx - hangY);
      legeStreifen(ebenen.waldSp, cam * PAR.wald, 2 * wlPx - waldY);
    }
    const uferY = Math.round((view.pfad - ebenen.uferOben) * dpr);
    const uferX = cam - view.rx * dpr;
    legeStreifen(ebenen.ufer, uferX, uferY);
    if (n > 0) {
      const front = Math.round((canvas.height - wlPx) * glatt(n) ** 0.85) + 1;
      g.save();
      if (n < 1) {
        g.beginPath();
        g.rect(0, wlPx, canvas.width, front);
        g.clip();
      }
      g.drawImage(ebenen.nacht, 0, wlPx);
      legeStreifen(ebenen.waldNacht, cam * PAR.wald, 2 * wlPx - waldY);
      g.beginPath();
      g.rect(0, wlPx, canvas.width, canvas.height - wlPx);
      g.clip();
      legeStreifen(ebenen.uferNacht, uferX, uferY);
      g.restore();
    }
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (n > 0 && n < 1) {
      // Die Front der Nacht: ein heller Saum, der in die Tiefe sinkt.
      const y = view.wl + (view.cssH - view.wl) * glatt(n) ** 0.85;
      const saum = g.createLinearGradient(0, y - 30, 0, y + 8);
      saum.addColorStop(0, "rgba(140, 250, 255, 0)");
      saum.addColorStop(0.78, `rgba(190, 252, 255, ${0.75 * (1 - n * 0.6)})`);
      saum.addColorStop(1, "rgba(190, 252, 255, 0)");
      g.fillStyle = saum;
      g.fillRect(0, y - 30, view.cssW, 38);
    }
  }

  // Was am Himmel und im See je Bild lebt: die Venus, Vögel, Sterne, die
  // funkeln, und Teilchen, die zur Wasserlinie hinauf schweben.
  const VOEGEL = Array.from({ length: 5 }, (_, i) => ({ dx: i * 14 + hash01(i * 3.1) * 10, dy: (i % 2) * 6 + hash01(i * 7.7) * 5, p: hash01(i * 1.3) * 6 }));
  const FUNKELN = Array.from({ length: 70 }, (_, i) => ({ x: hash01(i * 3.7 + 1), y: hash01(i * 5.3 + 2), r: 0.8 + hash01(i * 9.1) * 1.6, p: hash01(i * 2.9) * 6 }));
  const SCHWEBE = Array.from({ length: 56 }, (_, i) => ({
    x: hash01(i * 4.1 + 3), y: hash01(i * 6.7 + 5), r: 0.6 + hash01(i * 8.3) ** 2 * 2.2, v: 0.012 + hash01(i * 2.3) * 0.03, p: hash01(i * 1.7) * 6, farbe: i % 3,
  }));

  function zeichneHimmelsleben() {
    const W = view.cssW;
    const still = ruhig();
    // Die Venus, der Morgenstern.
    const vx = W * 0.86;
    const vy = view.frei + (view.hz - view.frei) * 0.14;
    schein("weiss", vx, vy, 0.28, 0.6 + (still ? 0 : 0.15 * Math.sin(state.zeit * 2.1)));
    g.fillStyle = "#ffffff";
    g.fillRect(vx - 0.9, vy - 0.9, 1.8, 1.8);
    // Ein paar Vögel ziehen langsam über den See.
    if (!still) {
      const breit = W * 1.8;
      const wo = W * 1.2 - ((state.zeit * 14 + state.camX * view.s * 0.05) % breit);
      const hoehe = view.frei + (view.hz - view.frei) * 0.34;
      const treu = nachtK() < 1;
      VOEGEL.forEach((v, i) => {
        const x = wo + v.dx;
        const y = hoehe + v.dy + Math.sin(state.zeit * 0.8 + i) * 2;
        if (x < -10 || x > W + 10) return;
        const fl = Math.sin(state.zeit * 9 + v.p) * 2.2;
        g.strokeStyle = "rgba(40, 30, 64, 0.75)";
        g.lineWidth = 1;
        g.beginPath();
        g.moveTo(x - 3.2, y - fl);
        g.quadraticCurveTo(x - 1.2, y - 1, x, y);
        g.quadraticCurveTo(x + 1.2, y - 1, x + 3.2, y - fl);
        g.stroke();
        if (treu) {
          // Im treuen Spiegel fliegen sie mit.
          const y2 = 2 * view.wl - y;
          g.strokeStyle = "rgba(30, 30, 70, 0.45)";
          g.beginPath();
          g.moveTo(x - 3.2, y2 + fl);
          g.quadraticCurveTo(x - 1.2, y2 + 1, x, y2);
          g.quadraticCurveTo(x + 1.2, y2 + 1, x + 3.2, y2 + fl);
          g.stroke();
        }
      });
    }
  }

  function zeichneSeeleben() {
    const n = nachtK();
    if (n <= 0) return;
    const W = view.cssW;
    const wl = view.wl;
    const H = view.cssH - wl;
    const still = ruhig();
    const front = wl + H * glatt(n) ** 0.85;
    // Sterne, die funkeln.
    FUNKELN.forEach((f) => {
      const ab = (view.wl - view.hz) + view.berg * BERG_TRAUM * 0.5;
      const y = wl + ab + f.y * (H - ab);
      if (y > front) return;
      const a = still ? 0.7 : 0.45 + 0.45 * Math.sin(state.zeit * (1.3 + f.p * 0.3) + f.p);
      g.globalAlpha = a * n;
      g.fillStyle = "#f4fbff";
      g.fillRect(f.x * W, y, f.r, f.r);
    });
    g.globalAlpha = 1;
    // Teilchen, die zur Wasserlinie hinauf schweben.
    if (still) return;
    SCHWEBE.forEach((p) => {
      const y = wl + 6 + (((p.y - state.zeit * p.v) % 1) + 1) % 1 * (H - 6);
      if (y > front) return;
      const x = ((((p.x * W - state.camX * view.s * 0.35 + Math.sin(state.zeit * 0.7 + p.p) * 8) % W) + W) % W);
      const a = (0.35 + 0.35 * Math.sin(state.zeit * 1.9 + p.p)) * n;
      if (p.r > 2) schein(p.farbe ? "kalt" : "violett", x, y, 0.16 * p.r, a * 0.7);
      g.globalAlpha = a;
      g.fillStyle = p.farbe === 0 ? "#e2c8ff" : "#c8fbff";
      g.fillRect(x, y, Math.max(0.8, p.r * 0.6), Math.max(0.8, p.r * 0.6));
    });
    g.globalAlpha = 1;
  }

  // Die Wasserlinie: ein heller Streif, feines Glitzern, Ringe, wo sie
  // aufsetzt – und beim Erwachen ein Licht, das darüber läuft.
  function zeichneWasserlinie() {
    const W = view.cssW;
    const wl = view.wl;
    const n = nachtK();
    const still = ruhig();
    g.fillStyle = n > 0.5 ? "rgba(170, 250, 255, 0.85)" : "rgba(255, 240, 228, 0.85)";
    g.fillRect(0, wl - 0.6, W, 1.2);
    for (let i = 0; i < 40; i += 1) {
      const lang = 3 + hash01(i * 2.3) * 12;
      const x = ((((hash01(i * 7.1) * W * 1.3 - state.camX * view.s * 0.92 + (still ? 0 : state.zeit * (4 + hash01(i) * 6))) % (W + 30)) + W + 30) % (W + 30)) - 15;
      const a = still ? 0.4 : 0.15 + 0.5 * (0.5 + 0.5 * Math.sin(state.zeit * (1.5 + hash01(i * 3)) + i));
      g.globalAlpha = a;
      g.fillStyle = n > 0.5 ? (i % 3 ? "#bffcff" : "#e6d4ff") : "#fff4ea";
      g.fillRect(x, wl + 1 + (i % 4) * 1.6, lang, 0.9);
    }
    g.globalAlpha = 1;
    // Ringe.
    state.ringe.forEach((r) => {
      const k = clamp(r.leben / r.max, 0, 1);
      const x = bildX(r.x);
      if (x < -60 || x > W + 60) return;
      const rad = (1 - k) * r.weit * view.s + 2;
      g.strokeStyle = n > 0.5 ? `rgba(170, 250, 255, ${0.65 * k})` : `rgba(255, 244, 236, ${0.6 * k})`;
      g.lineWidth = 1;
      g.beginPath();
      g.ellipse(x, wl + 1, rad, rad * 0.16, 0, 0, TAU);
      g.stroke();
    });
    // Das Erwachen: ein Licht läuft von der Läuferin aus über die Linie.
    if (state.erwacheT !== null) {
      const w = state.t - state.erwacheT;
      if (w > -0.05 && w < 1.6) {
        const x0 = bildX(state.laeuferin.x);
        const weit = Math.max(0, w) * W * 1.15;
        const kraft = clamp(1 - w / 1.6, 0, 1);
        [x0 + weit, x0 - weit * 0.6].forEach((x) => {
          schein("kalt", x, wl, 1.6, kraft);
          schein("weiss", x, wl, 0.5, kraft);
        });
        const band = g.createLinearGradient(x0 - weit * 0.6, 0, x0 + weit, 0);
        band.addColorStop(0, `rgba(170, 250, 255, ${0.2 * kraft})`);
        band.addColorStop(1, `rgba(255, 255, 255, ${0.9 * kraft})`);
        g.fillStyle = band;
        g.fillRect(x0 - weit * 0.6, wl - 1.2, weit * 1.6, 2.4);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Zeichnen: der Steg und der Nebel
  // ---------------------------------------------------------------------------
  // Ein Holzsteg über eine Bucht: Unter ihm Wasser statt Ufer, Pfähle, und
  // wo Bretter fehlen, sieht man hinab. Gespiegelt im See.
  function zeichneStege() {
    const W = view.cssW;
    const s = view.s;
    const n = nachtK();
    state.stege.forEach((st) => {
      if (bildX(st.b) < -30 || bildX(st.a) > W + 30) return;
      const luecken = state.hindernisse.filter((o) => o.kind === "luecke" && o.a >= st.a && o.b <= st.b);
      const offen = (x) => luecken.some((o) => x > o.a && x < o.b);
      [false, true].forEach((unten) => {
        const Y = unten ? untenY : obenY;
        stil = unten ? (n > 0.5 ? "nacht" : "spiegel") : "tag";
        g.save();
        g.beginPath();
        if (unten) g.rect(-10, view.wl, W + 20, view.cssH); else g.rect(-10, -10, W + 20, view.wl + 10);
        g.clip();
        // Die Bucht: Wasser statt der Uferkante.
        g.fillStyle = unten ? (n > 0.5 ? "rgb(10, 28, 56)" : F([40, 46, 92])) : "rgb(58, 66, 118)";
        const ya = Y(0.2);
        const yb = view.wl;
        g.fillRect(bildX(st.a + 6), Math.min(ya, yb), (st.b - st.a - 12) * s, Math.abs(yb - ya));
        // Pfähle – wo Bretter fehlen, nur noch Stümpfe, tiefer als der Weg.
        for (let x = st.a + 8; x < st.b - 4; x += 16) {
          const stumpf = offen(x);
          g.fillStyle = F([70, 52, 60]);
          const y0 = Y(stumpf ? -UFER + 1.2 + hash01(x) * 1.4 : -2.4);
          g.fillRect(bildX(x) - 1.1 * s, Math.min(y0, yb), 2.2 * s, Math.abs(yb - y0) + (unten ? 0 : 1));
          g.fillStyle = L([214, 160, 130], 0.5);
          g.fillRect(bildX(x) - 1.1 * s, Math.min(y0, yb), 0.6 * s, Math.abs(yb - y0));
        }
        // Lose Bretter treiben in den Lücken.
        luecken.forEach((o) => {
          for (let i = 0; i < 2; i += 1) {
            const x = o.a + (o.b - o.a) * (0.3 + i * 0.35 + hash01(o.saat * 7 + i) * 0.1);
            const dreh = (hash01(o.saat * 3 + i) - 0.5) * 0.2 + (ruhig() ? 0 : Math.sin(state.zeit * 1.3 + i) * 0.04);
            g.save();
            g.translate(bildX(x), Y(-UFER + 0.5));
            g.rotate(dreh * (unten ? -1 : 1));
            g.fillStyle = F([128, 96, 84]);
            g.fillRect(-5 * s, -0.6 * s, 10 * s, 1.2 * s);
            g.fillStyle = L([240, 196, 160], 0.6);
            g.fillRect(-5 * s, unten ? 0.3 * s : -0.6 * s, 10 * s, 0.35 * s);
            g.restore();
          }
        });
        // Das Deck: Bretter mit Fugen, vorn im Licht.
        let x = st.a;
        while (x < st.b) {
          const luecke = luecken.find((o) => o.a <= x + 0.01 && o.b > x);
          if (luecke) { x = luecke.b; continue; }
          const naechste = luecken.filter((o) => o.a > x).sort((p, q) => p.a - q.a)[0];
          const ende = Math.min(st.b, naechste ? naechste.a : st.b);
          const x0 = bildX(x);
          const x1 = bildX(ende);
          const y0 = Y(0);
          const y1 = Y(-2.6);
          // Unter den Brettern ein dunkler Balken.
          g.fillStyle = F([66, 46, 54]);
          g.fillRect(x0 + 1.5 * s, Math.min(y1, Y(-3.6)), x1 - x0 - 3 * s, Math.abs(Y(-3.6) - y1));
          g.fillStyle = F([122, 92, 82]);
          g.fillRect(x0, Math.min(y0, y1), x1 - x0, Math.abs(y1 - y0));
          g.fillStyle = L([250, 206, 170], 0.75);
          g.fillRect(x0, unten ? y0 - 0.9 : y0 - 0.2, x1 - x0, 0.9);
          g.fillStyle = F([60, 42, 50], 0.7);
          for (let f = Math.ceil(x / 5.5) * 5.5; f < ende; f += 5.5) g.fillRect(bildX(f), Math.min(y0, y1), Math.max(0.6, s * 0.4), Math.abs(y1 - y0));
          // Gesplitterte Enden an den Lücken.
          [[x, -1], [ende, 1]].forEach(([kx, seite]) => {
            if (!luecken.some((o) => Math.abs(o.a - kx) < 0.01 || Math.abs(o.b - kx) < 0.01)) return;
            g.fillStyle = F([150, 112, 96]);
            g.beginPath();
            g.moveTo(bildX(kx), y0);
            g.lineTo(bildX(kx) + seite * 1.8 * s, lerp(y0, y1, 0.3));
            g.lineTo(bildX(kx), lerp(y0, y1, 0.6));
            g.lineTo(bildX(kx) + seite * 1.2 * s, y1);
            g.lineTo(bildX(kx), y1);
            g.closePath();
            g.fill();
          });
          x = ende;
        }
        g.restore();
      });
      stil = "tag";
    });
  }

  function zeichneNebel() {
    if (!ebenen?.nebelRand || !state.nebel.length) return;
    const dpr = view.dpr;
    const W = view.cssW;
    const h = ebenen.nebelH;
    const y = Math.round((view.wl + 1) * dpr) - h;
    const [randL, randR] = ebenen.nebelRand;
    const rand = randL.width;
    const schwade = ebenen.nebelSchwade;
    g.setTransform(1, 0, 0, 1, 0, 0);
    state.nebel.forEach((nb) => {
      const xa = Math.round(bildX(nb.a) * dpr);
      const xb = Math.round(bildX(nb.b) * dpr);
      if (xb < 0 || xa > W * dpr) return;
      if (xb - xa > 2 * rand) {
        g.fillStyle = nebelVerlauf(g, y, h);
        g.fillRect(Math.max(-4, xa + rand), y, Math.min(canvas.width + 4, xb - rand) - Math.max(-4, xa + rand), h);
      }
      g.drawImage(randL, xa, y);
      g.drawImage(randR, xb - rand, y);
      // Die Schwaden ziehen langsam gegen die Läuferin.
      if (ruhig()) return;
      const lang = nb.b - nb.a;
      for (let i = 0; i < Math.ceil(lang / 26); i += 1) {
        const x = nb.a + ((i * 26 + hash01(i * 3.3 + nb.nr) * 20 - state.zeit * 7) % lang + lang) % lang;
        const kraft = nebelBei(x);
        if (kraft <= 0.05) continue;
        const sx = Math.round(bildX(x) * dpr - schwade.width / 2);
        if (sx > canvas.width || sx + schwade.width < 0) continue;
        const sy = Math.round(obenY(DECKE * (0.25 + hash01(i * 7.1 + nb.nr) * 0.85)) * dpr - schwade.height / 2);
        g.globalAlpha = kraft * (0.55 + 0.35 * Math.sin(state.zeit * 0.9 + i));
        g.drawImage(schwade, sx, sy);
      }
      g.globalAlpha = 1;
    });
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  // Wie dicht der Nebel an der Stelle x ist (für das, was er verdeckt).
  function nebelBei(x) {
    for (const nb of state.nebel) {
      if (x > nb.a && x < nb.b) return clamp(Math.min(x - nb.a, nb.b - x) / 60, 0, 1);
    }
    return 0;
  }

  // ---------------------------------------------------------------------------
  // Zeichnen: die Hindernisse oben
  // ---------------------------------------------------------------------------
  /*
   * Jedes wird mit Y gezeichnet (Höhe über dem Weg → Bild): oben obenY, als
   * treues Spiegelbild im See untenY – dann steht es kopfüber, wie es soll,
   * und das Licht auf ihm auch. Der Umriss ist genau der, an dem man
   * anstösst (profil bzw. DECKE).
   */
  function profilPfad(o, Y, n = 18) {
    g.beginPath();
    g.moveTo(bildX(o.a - 0.5), Y(-1.5));
    for (let i = 0; i <= n; i += 1) {
      const x = o.a + ((o.b - o.a) * i) / n;
      g.lineTo(bildX(x), Y(profil(o, x)));
    }
    g.lineTo(bildX(o.b + 0.5), Y(-1.5));
    g.closePath();
  }

  // Ein Granitblock: Flächen in verschiedenem Licht (links die Morgenröte),
  // Reif obenauf, Flechten, ein Riss.
  function zeichneStein(o, Y) {
    const s = view.s;
    const w = o.b - o.a;
    const z = (i) => hash01(o.saat * 97 + i * 13.7);
    const P = (u, v) => [bildX(o.a + u * w), Y(v * o.h)];
    // Sein Schatten auf dem Weg, nach rechts.
    g.fillStyle = F([40, 30, 60], 0.35);
    g.beginPath();
    const [sx, sy] = P(0.6, 0);
    g.ellipse(sx + w * 0.2 * s, sy, w * 0.6 * s, 1.2 * s, 0, 0, TAU);
    g.fill();
    profilPfad(o, Y);
    g.fillStyle = F([92, 86, 118]);
    g.fill();
    g.save();
    profilPfad(o, Y);
    g.clip();
    const flaeche = (punkte, farbe) => {
      g.fillStyle = farbe;
      g.beginPath();
      punkte.forEach(([u, v], i) => { const [x, y] = P(u, v); if (i) g.lineTo(x, y); else g.moveTo(x, y); });
      g.closePath();
      g.fill();
    };
    const p = o.p;
    flaeche([[-0.05, -0.1], [-0.05, 0.7], [p * 0.6, 1.1], [p + 0.03, 1.1], [p - 0.05 + z(1) * 0.1, 0.5], [p * 0.5 + z(2) * 0.1, -0.1]], F([196, 150, 150]));
    flaeche([[-0.05, 0.5], [p * 0.45, 1.1], [p * 0.8, 1.1], [p * 0.5, 0.64 + z(3) * 0.1]], L([236, 176, 160]));
    flaeche([[p + 0.1, 1.1], [1.05, 0.65], [1.05, -0.1], [p + 0.1 + z(5) * 0.12, -0.1], [p + 0.2, 0.52]], F([60, 56, 92]));
    // Reif obenauf.
    g.fillStyle = L([240, 244, 255], 0.85);
    g.beginPath();
    for (let i = 0; i <= 12; i += 1) {
      const x = o.a + w * (0.08 + 0.84 * (i / 12));
      const y = profil(o, x);
      if (i === 0) g.moveTo(bildX(x), Y(y + 0.2)); else g.lineTo(bildX(x), Y(y + 0.2));
    }
    for (let i = 12; i >= 0; i -= 1) {
      const x = o.a + w * (0.08 + 0.84 * (i / 12));
      const y = profil(o, x);
      g.lineTo(bildX(x), Y(y - Math.min(2.2, y * 0.18) * (0.6 + 0.4 * Math.sin(i * 1.7 + o.saat * 9))));
    }
    g.closePath();
    g.fill();
    // Flechten und ein Riss.
    g.fillStyle = F([184, 178, 96], 0.7);
    for (let i = 0; i < 4; i += 1) {
      const [x, y] = P(0.15 + z(10 + i) * 0.7, 0.2 + z(14 + i) * 0.4);
      g.beginPath();
      g.arc(x, y, (0.5 + z(18 + i) * 0.7) * s, 0, TAU);
      g.fill();
    }
    g.strokeStyle = F([40, 34, 62], 0.32);
    g.lineWidth = Math.max(0.5, s * 0.3);
    g.beginPath();
    const [ax, ay] = P(0.3 + z(20) * 0.4, 0.75);
    const [bx, by] = P(0.35 + z(21) * 0.3, 0.45);
    const [cx, cy] = P(0.3 + z(22) * 0.4, 0.15);
    g.moveTo(ax, ay);
    g.lineTo(bx, by);
    g.lineTo(cx, cy);
    g.stroke();
    g.restore();
    // Der Rand im Morgenlicht.
    g.strokeStyle = L([255, 222, 200], 0.9);
    g.lineWidth = 1;
    g.beginPath();
    const gipfel = o.a + o.p * w;
    for (let i = 0; i <= 10; i += 1) {
      const x = o.a + (gipfel - o.a) * (i / 10);
      if (i === 0) g.moveTo(bildX(x), Y(profil(o, x)) + 0.3); else g.lineTo(bildX(x), Y(profil(o, x)) + 0.3);
    }
    g.stroke();
  }

  // Ein umgestürzter Lärchenstamm: Rinde mit Furchen, Moos und Reif oben,
  // vorn die Schnittfläche mit Jahrringen.
  function zeichneStamm(o, Y) {
    const s = view.s;
    const w = o.b - o.a;
    g.fillStyle = F([40, 30, 60], 0.3);
    g.fillRect(bildX(o.a + 2), Math.min(Y(0), Y(-0.6)), (w + 6) * s, 1.4 * s);
    profilPfad(o, Y);
    g.fillStyle = F([96, 64, 64]);
    g.fill();
    g.save();
    profilPfad(o, Y);
    g.clip();
    // Unten im Schatten, oben im Licht.
    g.fillStyle = F([58, 40, 52]);
    g.fillRect(bildX(o.a), Math.min(Y(0), Y(o.h * 0.4)), w * s, o.h * 0.4 * s + 1);
    g.fillStyle = L([214, 150, 128], 0.75);
    g.fillRect(bildX(o.a), Math.min(Y(o.h * 0.72), Y(o.h)), w * s, o.h * 0.28 * s);
    // Furchen in der Rinde.
    g.strokeStyle = F([46, 30, 42], 0.6);
    g.lineWidth = Math.max(0.6, s * 0.4);
    g.beginPath();
    for (let i = 1; i < 5; i += 1) {
      const y = o.h * (i / 5);
      g.moveTo(bildX(o.a), Y(y));
      for (let x = o.a; x <= o.b; x += 6) g.lineTo(bildX(x), Y(y + Math.sin(x * 0.4 + i * 2 + o.saat * 9) * 0.5));
    }
    g.stroke();
    // Moos und Reif.
    g.fillStyle = F([110, 138, 92], 0.85);
    for (let x = o.a + 4; x < o.b - 4; x += 7) {
      const r = (1.2 + hash01(x * 0.3 + o.saat) * 1.6) * s;
      g.beginPath();
      g.ellipse(bildX(x), Y(profil(o, x) - 0.4), r * 1.4, r * 0.6, 0, 0, TAU);
      g.fill();
    }
    g.fillStyle = L([242, 246, 255], 0.8);
    g.fillRect(bildX(o.a + 3), Math.min(Y(o.h + 0.1), Y(o.h - 0.7)), (w - 6) * s, 0.8 * s);
    g.restore();
    // Die Schnittfläche vorn: hell, mit Ringen.
    const ex = bildX(o.b - o.h * 0.18);
    const ey = Y(o.h / 2);
    g.fillStyle = F([226, 176, 132]);
    g.beginPath();
    g.ellipse(ex, ey, o.h * 0.22 * s, o.h * 0.5 * s, 0, 0, TAU);
    g.fill();
    g.strokeStyle = F([156, 102, 80], 0.8);
    g.lineWidth = Math.max(0.5, s * 0.3);
    for (let r = 0.32; r > 0.05; r -= 0.12) {
      g.beginPath();
      g.ellipse(ex, ey, o.h * r * 0.44 * s, o.h * r * s, 0, 0, TAU);
      g.stroke();
    }
    // Ein Aststummel obenauf.
    const st = o.a + w * (0.3 + o.saat * 0.3);
    g.strokeStyle = F([84, 58, 60]);
    g.lineWidth = Math.max(1, s * 1.2);
    g.beginPath();
    g.moveTo(bildX(st), Y(o.h - 0.5));
    g.lineTo(bildX(st + 2.5), Y(Math.min(o.h + 2.2, o.h * 1.1)));
    g.stroke();
  }

  // Ein Ast über dem Weg: der unterste, schwere Ast einer Lärche, die
  // hinter dem Weg steht (ihr Stamm und ihre Krone im Dunst – sie ist kein
  // Hindernis). Er reicht quer über den Weg, seine Nadeln hängen in Büscheln
  // hinunter, die Spitzen genau bis DECKE. Auf dem Weg liegt sein Schatten:
  // so weit reicht er.
  function zeichneAst(o, Y, oben) {
    const s = view.s;
    const w = o.b - o.a;
    const rechts = o.saat >= 0.5;
    const stammX = rechts ? o.b + 4 : o.a - 4;
    const z = (i) => hash01(o.saat * 53 + i * 7.3);
    if (oben) {
      g.fillStyle = "rgba(30, 20, 50, 0.3)";
      g.beginPath();
      g.ellipse(bildX((o.a + o.b) / 2), obenY(0.2), (w / 2 + 2) * s, 1.3 * s, 0, 0, TAU);
      g.fill();
    }
    const astY = DECKE + o.dick * 0.7;
    const hoch = DECKE + 64 + z(1) * 16;
    // Der Stamm: vom Weg bis in die Krone, nach oben schmaler.
    g.fillStyle = F([104, 84, 108]);
    g.beginPath();
    g.moveTo(bildX(stammX - 2.6), Y(0));
    g.lineTo(bildX(stammX - 1.2), Y(hoch - 6));
    g.lineTo(bildX(stammX + 1.2), Y(hoch - 6));
    g.lineTo(bildX(stammX + 2.6), Y(0));
    g.closePath();
    g.fill();
    g.fillStyle = L([236, 180, 160], 0.45);
    g.beginPath();
    g.moveTo(bildX(stammX - 2.6), Y(0));
    g.lineTo(bildX(stammX - 1.2), Y(hoch - 6));
    g.lineTo(bildX(stammX - 0.4), Y(hoch - 6));
    g.lineTo(bildX(stammX - 1.4), Y(0));
    g.closePath();
    g.fill();
    // Die Krone über dem Ast: Stufen hängender Zweige, golden, im Dunst.
    const stufen = 7;
    for (let i = 0; i < stufen; i += 1) {
      const f = i / (stufen - 1);
      const y = lerp(hoch, astY + 12, f);
      const breit = lerp(3, 13, f) * (0.85 + z(i + 3) * 0.3);
      g.fillStyle = F(i % 2 ? [198, 150, 104] : [184, 136, 98]);
      g.beginPath();
      g.moveTo(bildX(stammX), Y(y + 1.5));
      g.quadraticCurveTo(bildX(stammX - breit * 0.6), Y(y + 1), bildX(stammX - breit), Y(y - 4));
      g.quadraticCurveTo(bildX(stammX - breit * 0.3), Y(y - 2.6), bildX(stammX), Y(y - 2));
      g.quadraticCurveTo(bildX(stammX + breit * 0.3), Y(y - 2.6), bildX(stammX + breit), Y(y - 4));
      g.quadraticCurveTo(bildX(stammX + breit * 0.6), Y(y + 1), bildX(stammX), Y(y + 1.5));
      g.fill();
    }
    // Der Ast: vom Stamm quer über den Weg, zum Ende dünner und hängend.
    const ende = rechts ? o.a - 1 : o.b + 1;
    const punkt = (f) => [lerp(stammX, ende, f), astY + 2.5 - f * f * 3];
    g.strokeStyle = F([70, 50, 62]);
    g.lineCap = "round";
    for (let i = 0; i < 6; i += 1) {
      const [x0, y0] = punkt(i / 6);
      const [x1, y1] = punkt((i + 1) / 6);
      g.lineWidth = Math.max(0.8, lerp(2.6, 0.9, i / 6) * s);
      g.beginPath();
      g.moveTo(bildX(x0), Y(y0));
      g.lineTo(bildX(x1), Y(y1));
      g.stroke();
    }
    // Der Behang: Büschel hängender Zweige, golden, oben im Licht. Ihre
    // Spitzen enden genau bei DECKE (manche etwas höher) – eine klare
    // Unterkante, aber kein Lineal.
    const zahl = Math.max(4, Math.round(w / 4.2));
    for (let i = 0; i <= zahl; i += 1) {
      const f = i / zahl;
      const x = lerp(o.a + 2.2, o.b - 2.2, f) + (z(i + 7) - 0.5) * 1.2;
      const fa = clamp(Math.abs(x - stammX) / Math.abs(ende - stammX), 0, 1);
      const oberk = punkt(fa)[1] - 0.6;
      const unterk = DECKE + (i % 3 === 1 ? 1.2 + z(i) * 1.4 : z(i) * 0.4);
      const b = 2.3 + z(i + 20) * 1.1;
      const kipp = (z(i + 30) - 0.5) * 1.4;
      const buschel = () => {
        g.beginPath();
        g.moveTo(bildX(x - b * 0.7), Y(oberk));
        g.bezierCurveTo(bildX(x - b * 1.1), Y(lerp(oberk, unterk, 0.45)), bildX(x - b * 0.5 + kipp), Y(unterk + 1.2), bildX(x + kipp * 0.6), Y(unterk));
        g.bezierCurveTo(bildX(x + b * 0.5 + kipp), Y(unterk + 1.2), bildX(x + b * 1.05), Y(lerp(oberk, unterk, 0.45)), bildX(x + b * 0.7), Y(oberk));
        g.closePath();
      };
      buschel();
      g.fillStyle = F(i % 2 ? [190, 134, 78] : [214, 156, 88]);
      g.fill();
      g.save();
      buschel();
      g.clip();
      g.fillStyle = L([252, 210, 140], 0.8);
      g.fillRect(bildX(x - b * 1.2), Math.min(Y(oberk + 1), Y(lerp(oberk, unterk, 0.4))), b * 0.9 * s, Math.abs(Y(lerp(oberk, unterk, 0.4)) - Y(oberk + 1)));
      g.strokeStyle = F([140, 92, 60], 0.6);
      g.lineWidth = Math.max(0.5, 0.3 * s);
      g.beginPath();
      for (let j = 0; j < 3; j += 1) {
        const u = (j - 1) * b * 0.4;
        g.moveTo(bildX(x + u), Y(oberk));
        g.quadraticCurveTo(bildX(x + u * 1.2), Y(lerp(oberk, unterk, 0.5)), bildX(x + u * 0.6 + kipp * 0.5), Y(unterk + 0.6));
      }
      g.stroke();
      g.restore();
    }
    // Reif auf dem Ast.
    g.strokeStyle = L([244, 246, 255], 0.75);
    g.lineWidth = Math.max(0.6, 0.55 * s);
    g.beginPath();
    for (let i = 0; i <= 6; i += 1) {
      const [x, y] = punkt(i / 6);
      if (i) g.lineTo(bildX(x), Y(y + 1.3 - i * 0.12)); else g.moveTo(bildX(x), Y(y + 1.3));
    }
    g.stroke();
  }

  // Ein Felsdach: eine Platte, die aus einer Felswand hinter dem Weg
  // vorspringt, die Unterseite genau bei DECKE.
  function zeichneDach(o, Y, oben) {
    const s = view.s;
    const w = o.b - o.a;
    const z = (i) => hash01(o.saat * 41 + i * 5.9);
    if (oben) {
      g.fillStyle = "rgba(30, 20, 50, 0.32)";
      g.fillRect(bildX(o.a), obenY(0.3), w * s, 1.6 * s);
    }
    const yFern = oben ? -20 : view.cssH + 20;
    const dick = o.dick + 4;
    // Die Wand dahinter, am rechten Ende, vom Weg bis aus dem Bild (im
    // Dunst: Sie steht hinter dem Weg).
    const wandA = o.b - 10;
    g.fillStyle = F([124, 112, 142]);
    g.beginPath();
    g.moveTo(bildX(wandA + 6), Y(0));
    g.lineTo(bildX(wandA), Y(DECKE));
    g.lineTo(bildX(wandA - 4), Y(DECKE + dick + 6));
    g.lineTo(bildX(wandA - 2), yFern);
    g.lineTo(bildX(o.b + 24), yFern);
    g.lineTo(bildX(o.b + 22), Y(0));
    g.closePath();
    g.fill();
    // Die Platte.
    const platte = () => {
      g.beginPath();
      g.moveTo(bildX(o.a), Y(DECKE));
      for (let i = 1; i <= 8; i += 1) {
        const x = o.a + (w * i) / 8;
        g.lineTo(bildX(x), Y(DECKE + (i === 8 ? 0 : 0)));
      }
      g.lineTo(bildX(o.b + 18), Y(DECKE + 2));
      g.lineTo(bildX(o.b + 12), Y(DECKE + dick + 2));
      for (let i = 8; i >= 0; i -= 1) {
        const x = o.a + (w * i) / 8;
        g.lineTo(bildX(x), Y(DECKE + dick * (0.6 + 0.4 * (i / 8)) + Math.sin(i * 2.1 + o.saat * 7) * 1.2));
      }
      g.closePath();
    };
    platte();
    g.fillStyle = F([102, 94, 128]);
    g.fill();
    g.save();
    platte();
    g.clip();
    g.fillStyle = L([224, 170, 160], 0.7);
    g.fillRect(bildX(o.a - 2), Math.min(Y(DECKE + dick + 3), Y(DECKE + dick * 0.62)), (w + 24) * s, dick * 0.4 * s);
    g.fillStyle = F([48, 42, 72], 0.8);
    g.fillRect(bildX(o.a - 2), Math.min(Y(DECKE), Y(DECKE + dick * 0.3)), (w + 24) * s, dick * 0.3 * s);
    g.strokeStyle = F([50, 44, 76], 0.5);
    g.lineWidth = Math.max(0.6, s * 0.4);
    for (let i = 0; i < 4; i += 1) {
      const x = o.a + w * z(i);
      g.beginPath();
      g.moveTo(bildX(x), Y(DECKE + dick));
      g.lineTo(bildX(x + 2), Y(DECKE + dick * 0.4));
      g.stroke();
    }
    g.restore();
    g.fillStyle = L([244, 246, 255], 0.7);
    g.fillRect(bildX(o.a + 1), Math.min(Y(DECKE + dick * 0.6 + 0.6), Y(DECKE + dick * 0.6)), (w - 2) * s, 0.7 * s);
    g.fillStyle = F([30, 22, 44], 0.85);
    g.fillRect(bildX(o.a), Math.min(Y(DECKE), Y(DECKE + 0.7)), w * s, 0.7 * s);
  }

  // ---------------------------------------------------------------------------
  // Zeichnen: die Hindernisse der Spiegelwelt
  // ---------------------------------------------------------------------------
  /*
   * Unten leuchtet alles von innen: Was von der Wasserlinie in die Tiefe
   * hängt (Kristalle, Schilf, Wurzeln), in Türkis und Weiss; was tiefer
   * schwebt (Hecht, Quallen, Treibholz), in Violett, mit einem Schein auf
   * der Wasserlinie darüber: so weit reicht es. Gemessen wird wie oben, nur
   * kopfüber: y ist die Tiefe unter dem gespiegelten Weg (untenY).
   */
  function zeichneKristall(o) {
    const s = view.s;
    const w = o.b - o.a;
    const z = (i) => hash01(o.saat * 71 + i * 3.1);
    // Der Schleier: die ganze Form, durchscheinend – so weit reicht er.
    profilPfad(o, untenY, 20);
    g.fillStyle = "rgba(90, 220, 255, 0.22)";
    g.fill();
    schein("kalt", bildX(o.a + o.p * w), untenY(o.h * 0.45), (w * 0.05 + o.h * 0.04) * s, 0.55);
    // Die Kristalle: lange Prismen mit Spitzen, ihre Spitzen auf dem Umriss.
    const zahl = Math.max(3, Math.round(w / 3.2));
    for (let i = 0; i < zahl; i += 1) {
      const x = o.a + 1.2 + (w - 2.4) * ((i + 0.5) / zahl) + (z(i) - 0.5) * 1.2;
      const tief = Math.max(2, profil(o, x));
      const b = (1.1 + z(i + 20) * 0.9);
      const x0 = bildX(x - b);
      const x1 = bildX(x + b);
      const xm = bildX(x);
      g.fillStyle = i % 2 ? "rgba(150, 240, 255, 0.85)" : "rgba(110, 214, 250, 0.85)";
      g.beginPath();
      g.moveTo(x0, untenY(-UFER));
      g.lineTo(x1, untenY(-UFER));
      g.lineTo(x1, untenY(tief - b * 1.6));
      g.lineTo(xm, untenY(tief));
      g.lineTo(x0, untenY(tief - b * 1.6));
      g.closePath();
      g.fill();
      g.fillStyle = "rgba(240, 255, 255, 0.85)";
      g.fillRect(x0 + 0.3, untenY(-UFER), Math.max(0.7, (x1 - x0) * 0.28), (tief - b * 1.6 + UFER) * s);
    }
    // Die Spitzen funkeln.
    g.fillStyle = "#ffffff";
    for (let i = 0; i < 3; i += 1) {
      const x = o.a + w * (0.2 + z(i + 40) * 0.6);
      const a = 0.5 + 0.5 * Math.sin(state.zeit * 3 + i * 2 + o.saat * 9);
      g.globalAlpha = a;
      g.fillRect(bildX(x) - 0.8, untenY(profil(o, x)) - 2, 1.6, 1.6);
    }
    g.globalAlpha = 1;
  }

  // Von (x0, y0) in Richtung w (0: gerade in die Tiefe) bis an den Umriss,
  // ein wenig krumm: die Punkte eines Halms oder einer Wurzel.
  function bisUmriss(o, x0, y0, w, krumm, saat) {
    const pts = [[x0, y0]];
    let x = x0;
    let y = y0;
    let r = w;
    for (let i = 0; i < 90; i += 1) {
      r += krumm * (hash01(saat * 13.1 + i * 1.7) - 0.5);
      const nx = x + Math.sin(r) * 0.6;
      const ny = y + Math.cos(r) * 0.6;
      if (nx <= o.a + 0.3 || nx >= o.b - 0.3 || ny >= profil(o, nx) - 0.25) break;
      x = nx;
      y = ny;
      if (i % 2) pts.push([x, y]);
    }
    if (pts.length < 2 || pts[pts.length - 1][0] !== x) pts.push([x, y]);
    return pts;
  }

  // Eine Linie aus Punkten, die zum Ende dünner wird.
  function auslaufend(pts, Y, b0, b1, farbe) {
    g.strokeStyle = farbe;
    for (let i = 0; i < pts.length - 1; i += 1) {
      g.lineWidth = Math.max(0.5, lerp(b0, b1, i / Math.max(1, pts.length - 2)) * view.s);
      g.beginPath();
      g.moveTo(bildX(pts[i][0]), Y(pts[i][1]));
      g.lineTo(bildX(pts[i + 1][0]), Y(pts[i + 1][1]));
      g.stroke();
    }
  }

  // Schilf: Büschel, die von der Wasserlinie in die Tiefe hängen und sich
  // auffächern, mit Blättern und Rohrkolben.
  function zeichneSchilf(o) {
    const s = view.s;
    const w = o.b - o.a;
    const z = (i) => hash01(o.saat * 61 + i * 4.7);
    if (!o.gestalt) {
      const buschel = Math.max(2, Math.round(w / 7));
      const halme = [];
      const blaetter = [];
      for (let c = 0; c < buschel; c += 1) {
        const x0 = o.a + w * ((c + 0.5) / buschel) + (z(c) - 0.5) * 2;
        for (let j = 0; j < 6; j += 1) {
          const wi = lerp(-0.42, 0.42, j / 5) + (z(c * 9 + j) - 0.5) * 0.14;
          halme.push({ pts: bisUmriss(o, x0, -UFER, wi, 0.05, o.saat * 7 + c * 3 + j), kolben: z(c * 5 + j + 40) < 0.22, farbe: (c + j) % 3 });
        }
        for (let j = 0; j < 3; j += 1) {
          const seite = j % 2 ? 1 : -1;
          blaetter.push(bisUmriss(o, x0, -UFER + 1, seite * (0.75 + z(c * 3 + j + 80) * 0.4), 0.2, o.saat * 11 + c * 5 + j));
        }
      }
      o.gestalt = { halme, blaetter };
    }
    profilPfad(o, untenY, 20);
    g.fillStyle = "rgba(60, 200, 170, 0.08)";
    g.fill();
    schein("kalt", bildX(o.a + w / 2), untenY(o.h * 0.4), (w * 0.05 + 0.8) * s, 0.35);
    g.lineCap = "round";
    o.gestalt.blaetter.forEach((pts) => auslaufend(pts, untenY, 1.3, 0.3, "rgba(52, 160, 140, 0.9)"));
    o.gestalt.halme.forEach((h) => {
      auslaufend(h.pts, untenY, 0.8, 0.4, h.farbe === 0 ? "rgb(110, 224, 190)" : h.farbe === 1 ? "rgb(62, 176, 156)" : "rgb(44, 136, 130)");
      if (h.kolben && h.pts.length > 5) {
        const a = h.pts[Math.floor(h.pts.length * 0.55)];
        const b = h.pts[Math.floor(h.pts.length * 0.85)];
        g.strokeStyle = "rgb(126, 82, 108)";
        g.lineWidth = Math.max(1.6, s * 1.5);
        g.beginPath();
        g.moveTo(bildX(a[0]), untenY(a[1]));
        g.lineTo(bildX(b[0]), untenY(b[1]));
        g.stroke();
        g.strokeStyle = "rgba(236, 176, 226, 0.75)";
        g.lineWidth = Math.max(0.5, s * 0.35);
        g.beginPath();
        g.moveTo(bildX(a[0]) - 0.6 * s, untenY(a[1]));
        g.lineTo(bildX(b[0]) - 0.6 * s, untenY(b[1]));
        g.stroke();
      }
      const [tx, ty] = h.pts[h.pts.length - 1];
      g.fillStyle = "rgba(190, 255, 232, 0.85)";
      g.fillRect(bildX(tx) - 0.6, untenY(ty) - 0.6, 1.2, 1.2);
    });
  }

  function zeichneWurzel(o) {
    const s = view.s;
    const w = o.b - o.a;
    const z = (i) => hash01(o.saat * 43 + i * 6.1);
    if (!o.gestalt) {
      const wurzeln = [];
      const zahl = Math.max(3, Math.round(w / 6));
      for (let i = 0; i < zahl; i += 1) {
        const x0 = o.a + w * ((i + 0.5) / zahl) + (z(i) - 0.5) * 2;
        const haupt = bisUmriss(o, x0, 1, (z(i + 5) - 0.5) * 0.5, 0.45, o.saat * 5 + i);
        wurzeln.push({ pts: haupt, dick: 1.7 });
        [0.3, 0.55].forEach((f, j) => {
          const ab = haupt[Math.floor(haupt.length * f)];
          if (!ab) return;
          const seite = (i + j) % 2 ? 1 : -1;
          wurzeln.push({ pts: bisUmriss(o, ab[0], ab[1], seite * (0.55 + z(i * 3 + j) * 0.4), 0.5, o.saat * 9 + i * 4 + j), dick: 0.9 });
        });
      }
      o.gestalt = { wurzeln };
    }
    profilPfad(o, untenY, 20);
    g.fillStyle = "rgba(90, 200, 220, 0.07)";
    g.fill();
    // Der Wurzelballen an der Wasserlinie.
    g.fillStyle = "rgb(48, 34, 60)";
    g.beginPath();
    g.moveTo(bildX(o.a - 1), untenY(-UFER));
    for (let i = 0; i <= 10; i += 1) {
      const x = o.a - 1 + (w + 2) * (i / 10);
      g.lineTo(bildX(x), untenY(Math.min(profil(o, x), 2.5 + z(i + 70) * 2)));
    }
    g.lineTo(bildX(o.b + 1), untenY(-UFER));
    g.closePath();
    g.fill();
    g.lineCap = "round";
    o.gestalt.wurzeln.forEach((r) => {
      auslaufend(r.pts, untenY, r.dick, 0.35, "rgb(64, 46, 78)");
      // Die Kante im Licht des Sees.
      g.strokeStyle = "rgba(130, 246, 240, 0.65)";
      g.lineWidth = Math.max(0.5, 0.28 * s);
      g.beginPath();
      r.pts.forEach(([px, py], j) => { if (j) g.lineTo(bildX(px) - 0.45 * s, untenY(py)); else g.moveTo(bildX(px) - 0.45 * s, untenY(py)); });
      g.stroke();
    });
    // Lichtpunkte im Wurzelwerk.
    for (let i = 0; i < 3; i += 1) {
      const x = o.a + w * (0.2 + z(i + 20) * 0.6);
      schein("kalt", bildX(x), untenY(profil(o, x) * (0.3 + z(i + 30) * 0.5)), 0.22, 0.5 + 0.3 * Math.sin(state.zeit * 2 + i));
    }
  }

  // Was tiefer schwebt: Auf der Wasserlinie darüber liegt ein violetter
  // Schein, so breit wie es.
  function deckenSchein(o) {
    const s = view.s;
    const band = g.createLinearGradient(0, view.wl, 0, untenY(0.6));
    band.addColorStop(0, "rgba(210, 150, 255, 0.5)");
    band.addColorStop(1, "rgba(210, 150, 255, 0)");
    g.fillStyle = band;
    g.fillRect(bildX(o.a), view.wl, (o.b - o.a) * s, (UFER + 0.6) * s);
  }

  function zeichneHecht(o) {
    const s = view.s;
    const w = o.b - o.a;
    deckenSchein(o);
    const mitte = DECKE + 4.8;
    const kopfLinks = o.saat < 0.6;     // meist schwimmt er ihr entgegen
    const schlag = ruhig() ? 0 : Math.sin(state.zeit * 7 + o.saat * 9) * 1.6;
    const vorn = kopfLinks ? o.a : o.b;
    const hinten = kopfLinks ? o.b : o.a;
    const X = (u) => bildX(lerp(vorn, hinten, u));
    const halb = 4.8;
    schein("violett", bildX((o.a + o.b) / 2), untenY(mitte), (w * 0.05 + 1) * s, 0.45);
    // Der Körper: lang, spitz zum Maul, die Schwanzflosse hinten.
    g.fillStyle = "rgb(46, 82, 104)";
    g.beginPath();
    g.moveTo(X(0), untenY(mitte + 0.4));
    g.quadraticCurveTo(X(0.12), untenY(mitte - halb), X(0.35), untenY(mitte - halb));
    g.quadraticCurveTo(X(0.75), untenY(mitte - halb * 0.95), X(0.86), untenY(mitte - 1.2 + schlag * 0.2));
    g.lineTo(X(0.86), untenY(mitte + 1.2 + schlag * 0.2));
    g.quadraticCurveTo(X(0.7), untenY(mitte + halb), X(0.3), untenY(mitte + halb * 0.9));
    g.quadraticCurveTo(X(0.1), untenY(mitte + halb * 0.6), X(0), untenY(mitte + 0.4));
    g.closePath();
    g.fill();
    // Rücken (zur Wasserlinie hin) dunkler, Bauch hell, Flecken.
    g.fillStyle = "rgba(170, 220, 190, 0.35)";
    g.beginPath();
    g.ellipse(X(0.45), untenY(mitte + halb * 0.45), (w * 0.3) * s, halb * 0.35 * s, 0, 0, TAU);
    g.fill();
    g.fillStyle = "rgba(190, 240, 210, 0.45)";
    for (let i = 0; i < 7; i += 1) {
      const u = 0.25 + i * 0.08;
      g.beginPath();
      g.ellipse(X(u), untenY(mitte - halb * 0.2 + (i % 2) * 1.6), 0.9 * s, 0.5 * s, 0, 0, TAU);
      g.fill();
    }
    // Flossen.
    g.fillStyle = "rgb(60, 100, 112)";
    g.beginPath();
    g.moveTo(X(0.86), untenY(mitte + schlag * 0.2));
    g.lineTo(X(1), untenY(mitte - 3.6 + schlag));
    g.lineTo(X(0.96), untenY(mitte + schlag));
    g.lineTo(X(1), untenY(mitte + 3.6 + schlag));
    g.closePath();
    g.fill();
    g.beginPath();
    g.moveTo(X(0.68), untenY(mitte - halb * 0.9));
    g.lineTo(X(0.78), untenY(mitte - halb - 1.6));
    g.lineTo(X(0.8), untenY(mitte - halb * 0.85));
    g.closePath();
    g.fill();
    // Das Auge leuchtet.
    schein("kalt", X(0.07), untenY(mitte - 0.9), 0.18, 0.9);
    g.fillStyle = "#e8ffff";
    g.beginPath();
    g.arc(X(0.07), untenY(mitte - 0.9), Math.max(0.8, 0.7 * s), 0, TAU);
    g.fill();
    // Die leuchtende Kante.
    g.strokeStyle = "rgba(150, 250, 255, 0.75)";
    g.lineWidth = 0.9;
    g.beginPath();
    g.moveTo(X(0), untenY(mitte + 0.4));
    g.quadraticCurveTo(X(0.12), untenY(mitte - halb), X(0.35), untenY(mitte - halb));
    g.quadraticCurveTo(X(0.75), untenY(mitte - halb * 0.95), X(0.86), untenY(mitte - 1.2 + schlag * 0.2));
    g.stroke();
    g.fillStyle = "rgba(60, 30, 80, 0.9)";
    g.fillRect(bildX(o.a), untenY(DECKE) - 0.35, w * s, 0.7);
  }

  function zeichneQualle(o) {
    const s = view.s;
    const w = o.b - o.a;
    deckenSchein(o);
    const zahl = Math.max(1, Math.round(w / 13));
    const breit = w / zahl;
    for (let i = 0; i < zahl; i += 1) {
      const cx = o.a + breit * (i + 0.5);
      const puls = ruhig() ? 0 : Math.sin(state.zeit * 3.2 + i * 1.7 + o.saat * 8);
      const rb = breit * 0.46 * (1 + puls * 0.06);
      const tief = DECKE + 7.5 - puls * 0.6;
      // Die Fäden wehen in die Tiefe.
      g.strokeStyle = "rgba(220, 160, 255, 0.55)";
      g.lineWidth = Math.max(0.6, s * 0.4);
      for (let j = 0; j < 5; j += 1) {
        const fx = cx - rb * 0.7 + (rb * 1.4 * j) / 4;
        g.beginPath();
        g.moveTo(bildX(fx), untenY(tief));
        for (let k = 1; k <= 4; k += 1) {
          g.lineTo(bildX(fx + Math.sin(state.zeit * 2 + j + k) * 0.8), untenY(tief + k * 2.6));
        }
        g.stroke();
      }
      schein("violett", bildX(cx), untenY(DECKE + 4), (rb * 0.1 + 0.4) * s, 0.75);
      // Der Schirm: zur Wasserlinie hin gewölbt.
      g.fillStyle = "rgba(196, 120, 255, 0.78)";
      g.beginPath();
      g.moveTo(bildX(cx - rb), untenY(tief));
      g.bezierCurveTo(bildX(cx - rb), untenY(DECKE + 1), bildX(cx - rb * 0.5), untenY(DECKE), bildX(cx), untenY(DECKE));
      g.bezierCurveTo(bildX(cx + rb * 0.5), untenY(DECKE), bildX(cx + rb), untenY(DECKE + 1), bildX(cx + rb), untenY(tief));
      g.quadraticCurveTo(bildX(cx), untenY(tief - 1.6), bildX(cx - rb), untenY(tief));
      g.closePath();
      g.fill();
      g.fillStyle = "rgba(255, 220, 255, 0.7)";
      g.beginPath();
      g.ellipse(bildX(cx - rb * 0.25), untenY(DECKE + 2.4), rb * 0.32 * s, 1.1 * s, 0, 0, TAU);
      g.fill();
      g.strokeStyle = "rgba(255, 230, 255, 0.9)";
      g.lineWidth = 0.8;
      g.beginPath();
      g.moveTo(bildX(cx - rb), untenY(tief));
      g.bezierCurveTo(bildX(cx - rb), untenY(DECKE + 1), bildX(cx - rb * 0.5), untenY(DECKE), bildX(cx), untenY(DECKE));
      g.bezierCurveTo(bildX(cx + rb * 0.5), untenY(DECKE), bildX(cx + rb), untenY(DECKE + 1), bildX(cx + rb), untenY(tief));
      g.stroke();
    }
  }

  function zeichneTreibholz(o) {
    const s = view.s;
    const w = o.b - o.a;
    const z = (i) => hash01(o.saat * 29 + i * 8.3);
    deckenSchein(o);
    schein("violett", bildX((o.a + o.b) / 2), untenY(DECKE + 4), (w * 0.06 + 1) * s, 0.55);
    // Ein versunkener Ast: dick, die Kante zur Wasserlinie hin genau bei
    // DECKE, mit Gabeln und Algen, die in die Tiefe hängen.
    const dick = 5.2;
    const oben = (x) => DECKE + 0.3 * Math.sin((x - o.a) * 0.25 + o.saat * 9) + 0.3;
    const stamm = () => {
      g.beginPath();
      g.moveTo(bildX(o.a), untenY(DECKE + dick * 0.5));
      for (let i = 0; i <= 10; i += 1) {
        const x = o.a + 1 + (w - 2) * (i / 10);
        g.lineTo(bildX(x), untenY(oben(x)));
      }
      g.lineTo(bildX(o.b), untenY(DECKE + dick * 0.45));
      for (let i = 10; i >= 0; i -= 1) {
        const x = o.a + 1 + (w - 2) * (i / 10);
        g.lineTo(bildX(x), untenY(DECKE + dick * (0.85 + 0.2 * Math.sin(i * 1.3 + o.saat * 5))));
      }
      g.closePath();
    };
    // Die Gabeln, tiefer.
    g.strokeStyle = "rgb(84, 70, 110)";
    g.lineCap = "round";
    [0.3 + z(1) * 0.2, 0.65 + z(2) * 0.2].forEach((f, i) => {
      const x = o.a + w * f;
      g.lineWidth = Math.max(1, 1.5 * s);
      g.beginPath();
      g.moveTo(bildX(x), untenY(DECKE + dick * 0.6));
      g.quadraticCurveTo(bildX(x + (i ? 3 : -3)), untenY(DECKE + dick + 3), bildX(x + (i ? 6 : -5)), untenY(DECKE + dick + 6));
      g.stroke();
    });
    stamm();
    g.fillStyle = "rgb(84, 70, 110)";
    g.fill();
    g.save();
    stamm();
    g.clip();
    g.fillStyle = "rgba(150, 140, 190, 0.6)";
    g.fillRect(bildX(o.a), untenY(DECKE - 0.5), w * s, dick * 0.35 * s);
    g.strokeStyle = "rgba(40, 30, 60, 0.6)";
    g.lineWidth = Math.max(0.5, 0.35 * s);
    for (let i = 1; i < 3; i += 1) {
      g.beginPath();
      g.moveTo(bildX(o.a), untenY(DECKE + dick * 0.3 * i));
      for (let x = o.a; x <= o.b; x += 5) g.lineTo(bildX(x), untenY(DECKE + dick * 0.3 * i + Math.sin(x * 0.5 + i) * 0.3));
      g.stroke();
    }
    g.restore();
    // Die Kante zur Wasserlinie leuchtet.
    g.strokeStyle = "rgba(170, 252, 255, 0.95)";
    g.lineWidth = Math.max(1, 0.7 * s);
    g.beginPath();
    for (let i = 0; i <= 10; i += 1) {
      const x = o.a + 1 + (w - 2) * (i / 10);
      if (i) g.lineTo(bildX(x), untenY(oben(x))); else g.moveTo(bildX(x), untenY(oben(x)));
    }
    g.stroke();
    // Algen, die in die Tiefe wehen, und Moos, das leuchtet.
    g.strokeStyle = "rgba(110, 240, 190, 0.75)";
    g.lineWidth = Math.max(0.6, s * 0.4);
    for (let i = 0; i < 8; i += 1) {
      const x = o.a + w * (0.08 + i * 0.12);
      g.beginPath();
      g.moveTo(bildX(x), untenY(DECKE + dick * 0.85));
      g.quadraticCurveTo(bildX(x + Math.sin(state.zeit * 1.7 + i) * 1.2), untenY(DECKE + dick + 2.5), bildX(x - 0.5), untenY(DECKE + dick + 3 + z(i) * 3));
      g.stroke();
    }
    g.fillStyle = "rgba(150, 255, 210, 0.8)";
    for (let i = 0; i < 5; i += 1) {
      const x = o.a + w * (0.1 + z(i + 9) * 0.8);
      g.beginPath();
      g.ellipse(bildX(x), untenY(oben(x) + 0.6), 1.2 * s, 0.5 * s, 0, 0, TAU);
      g.fill();
    }
  }

  function sichtbare(fn) {
    const liste = state.hindernisse;
    const von = state.camX - view.rx / view.s - 90;
    const bis = state.camX + (view.cssW - view.rx) / view.s + 90;
    for (let i = abIndex(von); i < liste.length; i += 1) {
      const o = liste[i];
      if (o.a > bis) break;
      if (o.b < von) continue;
      fn(o);
    }
  }

  // Oben: was den Weg berührt (vor der Läuferin), unten die Spiegelwelt mit
  // ihren eigenen Hindernissen und – wo der See treu ist – den Spiegelbildern.
  function zeichneHindernisseUnten() {
    const n = nachtK();
    g.save();
    g.beginPath();
    g.rect(-10, view.wl + 0.5, view.cssW + 20, view.cssH);
    g.clip();
    sichtbare((o) => {
      if (o.welt === "unten") {
        if (o.art === "kristall") zeichneKristall(o);
        else if (o.art === "schilf") zeichneSchilf(o);
        else if (o.art === "wurzel") zeichneWurzel(o);
        else if (o.art === "hecht") zeichneHecht(o);
        else if (o.art === "qualle") zeichneQualle(o);
        else if (o.art === "treibholz") zeichneTreibholz(o);
      } else if (o.spiegel && o.kind !== "luecke") {
        stil = n > 0.5 ? "nacht" : "spiegel";
        if (n > 0.5) {
          // Im erwachten See leuchtet das treue Spiegelbild des Ufers.
          const tief = o.kind === "decke" ? DECKE + 6 : o.h * 0.5;
          schein("kalt", bildX((o.a + o.b) / 2), untenY(tief), ((o.b - o.a) * 0.05 + 1.2) * view.s, 0.5);
        }
        zeichneOben(o, untenY, false);
        stil = "tag";
      }
    });
    g.restore();
  }

  function zeichneOben(o, Y, oben) {
    if (o.art === "stein") zeichneStein(o, Y);
    else if (o.art === "stamm") zeichneStamm(o, Y);
    else if (o.art === "ast") zeichneAst(o, Y, oben);
    else if (o.art === "dach") zeichneDach(o, Y, oben);
  }

  function zeichneHindernisseOben(decken) {
    g.save();
    g.beginPath();
    g.rect(-10, -20, view.cssW + 20, view.wl + 19.5);
    g.clip();
    sichtbare((o) => {
      if (o.welt !== "oben" || o.kind === "luecke") return;
      if ((o.kind === "decke") !== decken) return;
      const verdeckt = o.nebel ? nebelBei((o.a + o.b) / 2) : 0;
      if (verdeckt > 0) g.globalAlpha = 1 - verdeckt * 0.85;
      zeichneOben(o, obenY, true);
      g.globalAlpha = 1;
    });
    g.restore();
  }

  // ---------------------------------------------------------------------------
  // Zeichnen: die Läuferin
  // ---------------------------------------------------------------------------
  /*
   * Von der Seite, nach rechts laufend (x voraus, y nach oben, null zwischen
   * den Sohlen am Boden). Eine Jacke in Petrol, dunkle Laufhosen, weisse
   * Schuhe mit roter Sohle, ein senffarbener Wollschal, der hinter ihr weht,
   * ein Stirnband und ein kastanienroter Pferdeschwanz, der bei jedem
   * Schritt wippt. Das Licht kommt von links hinten (die Sonne hinter den
   * Bergen): eine helle Kante an Rücken und Kopf.
   *
   *   p.beine[i]  { t: Oberschenkel nach vorn, k: Knie gebeugt, f: Fuss }
   *               (0 das nahe Bein, 1 das ferne)
   *   p.arme[i]   { o: Oberarm nach vorn, u: Ellbogen gebeugt }
   *   p.lean      wie weit sie sich nach vorn lehnt
   *   p.zopf      wie der Pferdeschwanz gerade schwingt (−1 … 1)
   *   p.schal     wie sehr der Schal weht (0 hängt, 1 fliegt)
   *   p.huefte    die Höhe der Hüfte, wenn nicht die Beine sie bestimmen
   */
  const OS = 5.6;
  const US = 5.4;
  const RUMPF = 6.5;
  const OA = 3.5;
  const UA = 3.3;
  const KOPF = 2.4;
  const FUSS = 2.3;
  const FARBEN = {
    jacke: [30, 116, 132], jackeHell: [86, 186, 190], jackeDunkel: [18, 70, 88],
    hose: [44, 34, 68], hoseDunkel: [26, 20, 44],
    schuh: [246, 242, 246], sohle: [255, 98, 84],
    haut: [242, 198, 166], hautDunkel: [206, 150, 124],
    haar: [128, 52, 32], haarHell: [204, 104, 64],
    band: [255, 106, 92], schal: [244, 180, 46], schalDunkel: [196, 124, 26],
    kante: [255, 220, 192],
  };

  function bein(hx, hy, b) {
    const kx = hx + Math.sin(b.t) * OS;
    const ky = hy - Math.cos(b.t) * OS;
    const sa = b.t - b.k;
    const ax = kx + Math.sin(sa) * US;
    const ay = ky - Math.cos(sa) * US;
    const fw = sa + (b.f || 0);
    return { kx, ky, ax, ay, tx: ax + Math.cos(fw) * FUSS, ty: ay + Math.sin(fw) * FUSS, hx: ax - Math.cos(fw) * 0.6, hy: ay - Math.sin(fw) * 0.6, fw };
  }

  function zeichneLaeuferin(sx, sy, s, flip, p, wahl = {}) {
    const { geist = null, alpha = 1, kontur = null, kante = false, dreh = 0, stauch = 0, zeit = state.zeit } = wahl;
    const C = (c) => (geist || rgb(ton(c)));
    // Die Hüfte: so hoch, dass der tiefere Fuss den Boden berührt.
    const tief = (b) => {
      const j = bein(0, 0, b);
      return Math.min(j.ay - 0.55, j.ty - 0.35, j.hy - 0.35);
    };
    const hy = p.huefte ?? -Math.min(tief(p.beine[0]), tief(p.beine[1]));
    const hx = -0.3;
    const lean = p.lean;
    const sh = [hx + Math.sin(lean) * RUMPF, hy + Math.cos(lean) * RUMPF];
    const kopf = [sh[0] + Math.sin(lean + (p.kopf || 0)) * (KOPF + 1.05) + 0.25, sh[1] + Math.cos(lean + (p.kopf || 0)) * (KOPF + 1.05)];
    const B = p.beine.map((b) => bein(hx, hy, b));
    const arm = (a) => {
      const ex = sh[0] - 0.2 + Math.sin(a.o) * OA;
      const ey = sh[1] - 0.4 - Math.cos(a.o) * OA;
      const w = a.o + a.u;
      return { ex, ey, hx: ex + Math.sin(w) * UA, hy: ey - Math.cos(w) * UA };
    };
    const A = p.arme.map(arm);
    // Der Schal und der Pferdeschwanz: Ketten, die hinter ihr wehen.
    const wehen = p.schal ?? 1;
    const schalA = [sh[0] - 1.1, sh[1] + 0.6];
    const schalPunkte = (phase, lang) => {
      const pts = [schalA];
      const winkel = lerp(1.35, 0.1, wehen);
      for (let i = 1; i <= lang; i += 1) {
        const welle = Math.sin(zeit * 11 - i * 0.9 + phase) * 0.22 * i * wehen;
        pts.push([schalA[0] - Math.cos(winkel) * 1.45 * i, schalA[1] - Math.sin(winkel) * 1.45 * i + welle - (1 - wehen) * 0.1 * i]);
      }
      return pts;
    };
    const zopfA = [kopf[0] - KOPF * 0.78, kopf[1] + KOPF * 0.5];
    const zb = p.zopf || 0;
    const zopf = [zopfA, [zopfA[0] - 2.4, zopfA[1] - 0.5 + zb * 0.7], [zopfA[0] - 4.4, zopfA[1] - 1.6 + zb * 1.4], [zopfA[0] - 5.6, zopfA[1] - 3.2 + zb * 1.6]];

    g.save();
    g.globalAlpha = alpha;
    g.translate(sx, sy);
    g.scale(s, flip ? s : -s);
    if (stauch > 0) g.scale(1 + stauch * 0.08, 1 - stauch * 0.12);
    if (dreh) {
      g.translate(hx, hy);
      g.rotate(-dreh);
      g.translate(-hx, -hy);
    }
    g.lineCap = "round";
    g.lineJoin = "round";

    // pass(kf, plus, ox, oy): einmal die ganze Figur. kf gesetzt: alles in
    // dieser einen Farbe, um plus dicker – für die helle Kante und den
    // leuchtenden Umriss.
    const pass = (kf, plus, ox, oy) => {
      g.save();
      if (ox || oy) g.translate(ox, oy);
      const strich = (c, b) => { g.strokeStyle = kf || C(c); g.lineWidth = b + plus; };
      const linie = (pts, b, c) => {
        strich(c, b);
        g.beginPath();
        pts.forEach(([x, y], i) => { if (i) g.lineTo(x, y); else g.moveTo(x, y); });
        g.stroke();
      };
      const fuell = (pfad, c) => {
        pfad();
        g.fillStyle = kf || C(c);
        g.fill();
        if (kf && plus > 0) { g.strokeStyle = kf; g.lineWidth = plus; g.stroke(); }
      };
      const beinMalen = (j, fern) => {
        linie([[hx, hy], [j.kx, j.ky]], 2.6, fern ? FARBEN.hoseDunkel : FARBEN.hose);
        linie([[j.kx, j.ky], [j.ax, j.ay]], 1.9, fern ? FARBEN.hoseDunkel : FARBEN.hose);
        // Der Schuh: weiss, mit roter Sohle.
        linie([[j.hx, j.hy], [j.tx, j.ty]], 1.55, fern ? mix3(FARBEN.schuh, [120, 110, 140], 0.35) : FARBEN.schuh);
        if (!kf) {
          const nx = Math.sin(j.fw) * 0.62;
          const ny = -Math.cos(j.fw) * 0.62;
          linie([[j.hx + nx, j.hy + ny], [j.tx + nx, j.ty + ny]], 0.55, FARBEN.sohle);
        }
      };
      const armMalen = (a, fern) => {
        linie([[sh[0] - 0.2, sh[1] - 0.4], [a.ex, a.ey]], 1.6, fern ? FARBEN.jackeDunkel : FARBEN.jacke);
        linie([[a.ex, a.ey], [a.hx, a.hy]], 1.35, fern ? FARBEN.jackeDunkel : FARBEN.jacke);
        fuell(() => { g.beginPath(); g.arc(a.hx, a.hy, 0.72, 0, TAU); }, fern ? FARBEN.hautDunkel : FARBEN.haut);
      };
      // Das ferne Bein und der ferne Arm.
      beinMalen(B[1], true);
      armMalen(A[1], true);
      // Der Pferdeschwanz, hinter dem Kopf.
      strich(FARBEN.haar, 2);
      g.beginPath();
      g.moveTo(zopf[0][0], zopf[0][1]);
      g.bezierCurveTo(zopf[1][0], zopf[1][1], zopf[2][0], zopf[2][1], zopf[3][0], zopf[3][1]);
      g.stroke();
      strich(FARBEN.haar, 1.1);
      g.beginPath();
      g.moveTo(zopf[2][0], zopf[2][1]);
      g.quadraticCurveTo(zopf[3][0] + 0.3, zopf[3][1] - 0.6, zopf[3][0] - 0.8, zopf[3][1] - 1.6);
      g.stroke();
      if (!kf) {
        strich(FARBEN.haarHell, 0.5);
        g.beginPath();
        g.moveTo(zopf[0][0], zopf[0][1] + 0.5);
        g.bezierCurveTo(zopf[1][0], zopf[1][1] + 0.5, zopf[2][0], zopf[2][1] + 0.4, zopf[3][0], zopf[3][1] + 0.3);
        g.stroke();
      }
      // Die Enden des Schals, hinter dem Rumpf.
      [[0, 6, 1.25], [1.7, 5, 1.0]].forEach(([phase, lang, b], i) => {
        const pts = schalPunkte(phase, lang).map(([x, y]) => [x, y - i * 0.6]);
        linie(pts.slice(0, 3), b + 0.25, i ? FARBEN.schalDunkel : FARBEN.schal);
        linie(pts.slice(2), b, i ? FARBEN.schalDunkel : FARBEN.schal);
        if (!kf && !i) {
          // Fransen am Ende.
          const [ex, ey] = pts[pts.length - 1];
          linie([[ex, ey], [ex - 0.9, ey - 0.3]], 0.35, FARBEN.schal);
          linie([[ex, ey + 0.4], [ex - 0.9, ey + 0.3]], 0.35, FARBEN.schal);
        }
      });
      // Der Rumpf: die Jacke.
      const dx = Math.sin(lean);
      const dy = Math.cos(lean);
      fuell(() => {
        g.beginPath();
        g.moveTo(hx - dy * 1.6, hy + dx * 1.6);
        g.lineTo(sh[0] - dy * 1.85, sh[1] + dx * 1.85);
        g.quadraticCurveTo(sh[0] + dx * 0.9, sh[1] + dy * 0.9, sh[0] + dy * 1.5, sh[1] - dx * 1.5);
        g.quadraticCurveTo(hx + dx * RUMPF * 0.55 + dy * 2.1, hy + dy * RUMPF * 0.55 - dx * 2.1, hx + dy * 1.4, hy - dx * 1.4);
        g.quadraticCurveTo(hx, hy - 1.1, hx - dy * 1.6, hy + dx * 1.6);
        g.closePath();
      }, FARBEN.jacke);
      if (!kf) {
        // Ein heller Streifen an der Seite und der Saum.
        linie([[hx + dx * 1 - dy * 0.2, hy + dy * 1 + dx * 0.2], [sh[0] - dx * 0.8 - dy * 0.3, sh[1] - dy * 0.8 + dx * 0.3]], 0.45, FARBEN.jackeHell);
        linie([[hx - dy * 1.5, hy + dx * 1.5 + 0.1], [hx + dy * 1.3, hy - dx * 1.3 + 0.1]], 0.6, FARBEN.jackeDunkel);
      }
      // Das nahe Bein.
      beinMalen(B[0], false);
      // Der Hals und der Schal um ihn.
      linie([[sh[0] + 0.1, sh[1]], [kopf[0] - 0.3, kopf[1] - KOPF * 0.6]], 1.25, FARBEN.haut);
      linie([[sh[0] - 1.3, sh[1] + 0.55], [sh[0] + 1.1, sh[1] + 0.85]], 1.5, FARBEN.schal);
      // Der Kopf: Gesicht, Haar, Stirnband.
      fuell(() => { g.beginPath(); g.arc(kopf[0], kopf[1], KOPF, 0, TAU); }, FARBEN.haut);
      fuell(() => {
        g.beginPath();
        g.arc(kopf[0] - 0.12, kopf[1] + 0.05, KOPF * 1.05, Math.PI * 0.3, Math.PI * 1.32);
        g.quadraticCurveTo(kopf[0] - 0.4, kopf[1] - 0.2, kopf[0] - 0.12 + Math.cos(Math.PI * 0.3) * KOPF * 1.05, kopf[1] + 0.05 + Math.sin(Math.PI * 0.3) * KOPF * 1.05);
        g.closePath();
      }, FARBEN.haar);
      linie([[kopf[0] + KOPF * 0.86, kopf[1] + KOPF * 0.5], [kopf[0] - KOPF * 0.98, kopf[1] + KOPF * 0.18]], 0.95, FARBEN.band);
      if (!kf) {
        // Haargummi, Ohr, Auge, Nase, ein wenig Röte von der Kälte.
        fuell(() => { g.beginPath(); g.arc(zopfA[0] + 0.2, zopfA[1], 0.55, 0, TAU); }, FARBEN.band);
        fuell(() => { g.beginPath(); g.arc(kopf[0] - 0.25, kopf[1] - 0.15, 0.5, 0, TAU); }, FARBEN.hautDunkel);
        g.fillStyle = geist || "rgba(30, 20, 40, 0.95)";
        g.beginPath();
        g.arc(kopf[0] + 1.25, kopf[1] + 0.35, 0.33, 0, TAU);
        g.fill();
        fuell(() => { g.beginPath(); g.arc(kopf[0] + KOPF * 0.98, kopf[1] - 0.15, 0.42, 0, TAU); }, FARBEN.haut);
        g.fillStyle = geist || rgba(ton([255, 120, 120]), 0.35);
        g.beginPath();
        g.arc(kopf[0] + 1.0, kopf[1] - 0.75, 0.55, 0, TAU);
        g.fill();
      }
      // Der nahe Arm, vor allem.
      armMalen(A[0], false);
      g.restore();
    };

    if (kontur) pass(kontur.farbe, kontur.plus, 0, 0);
    if (kante && !geist) pass(rgba(ton(FARBEN.kante), 0.9), 0.25, -0.42, 0.38);
    pass(null, 0, 0, 0);
    g.restore();
    return { kopf, hy };
  }

  // Die Haltungen.
  function poseLauf(ph) {
    const a = ph * TAU;
    const b = (w) => ({ t: 0.12 + 0.7 * Math.sin(w), k: 0.22 + 1.6 * Math.pow(Math.max(0, Math.cos(w + 0.55)), 1.3), f: -0.1 - 0.4 * Math.max(0, Math.cos(w + 0.2)) });
    const arm = (w) => ({ o: -0.85 * Math.sin(w) + 0.12, u: 1.5 + 0.25 * Math.sin(w + 0.4) });
    return { beine: [b(a), b(a + Math.PI)], arme: [arm(a), arm(a + Math.PI)], lean: 0.2, zopf: Math.sin(a * 2 + 1.2), schal: 1, kopf: -0.08 };
  }
  function poseSprung(f) {
    const hock = Math.sin(Math.min(1, f / 0.82) * Math.PI);
    const vorn = { t: lerp(0.5, 1.2, hock), k: lerp(0.35, 1.55, hock), f: -0.1 };
    const hinten = { t: lerp(-0.45, 0.15, hock), k: lerp(0.9, 1.75, hock), f: -0.45 };
    if (f > 0.78) {
      const e = (f - 0.78) / 0.22;
      vorn.t = lerp(vorn.t, 0.42, e);
      vorn.k = lerp(vorn.k, 0.4, e);
      hinten.t = lerp(hinten.t, -0.05, e);
      hinten.k = lerp(hinten.k, 0.55, e);
    }
    return {
      beine: [vorn, hinten], arme: [{ o: lerp(-0.7, 2.1, hock), u: lerp(1.2, 0.6, hock) }, { o: lerp(1.0, 2.5, hock), u: 0.6 }],
      lean: lerp(0.28, 0.06, hock), zopf: lerp(0.8, -1, hock), schal: 1, kopf: -0.05,
    };
  }
  function poseStehen(t) {
    const atem = Math.sin(t * 2.4);
    return {
      beine: [{ t: 0.12, k: 0.16, f: 0 }, { t: -0.1, k: 0.2, f: 0 }], arme: [{ o: -0.1, u: 1.0 + 0.05 * atem }, { o: 0.2, u: 1.2 }],
      lean: 0.05, zopf: 0.15 * atem - 0.6, schal: 0.25 + 0.1 * atem, kopf: 0.02 * atem,
    };
  }
  function poseLiegt() {
    return { beine: [{ t: 0.7, k: 0.6, f: 0 }, { t: -0.35, k: 0.9, f: -0.3 }], arme: [{ o: 2.4, u: 0.4 }, { o: 1.5, u: 0.6 }], lean: 0.1, zopf: 0.5, schal: 0.6, kopf: 0.2 };
  }
  function poseKnien() {
    return { beine: [{ t: 1.45, k: 1.5, f: 0 }, { t: 0.15, k: 1.65, f: -0.4 }], arme: [{ o: 2.3, u: 2.1 }, { o: 2.0, u: 2.0 }], lean: 0.32, zopf: -0.6, schal: 0.3, kopf: 0.3, huefte: 6.1 };
  }
  function poseFallen() {
    return { beine: [{ t: 0.15, k: 0.25, f: 0.2 }, { t: -0.15, k: 0.35, f: 0.2 }], arme: [{ o: 2.9, u: 0.2 }, { o: 2.6, u: 0.3 }], lean: 0, zopf: -1, schal: 1, kopf: 0 };
  }

  function haltung() {
    const r = state.laeuferin;
    if (state.schritt === "start") return poseStehen(state.zeit);
    if (r.sprung !== null) return poseSprung(clamp((state.t - r.sprung) / SPRUNG, 0, 1));
    return poseLauf(state.lauf);
  }

  // Die Läuferin und ihr Spiegelbild. Im treuen See: dieselbe Figur,
  // dunkler und blauer. Im erwachten: im Spiegelton, mit leuchtendem Umriss
  // und ein wenig wässrig (sie wiegt sich leicht).
  function zeichneFigur() {
    const r = state.laeuferin;
    const s = view.s;
    if (state.schritt === "sturz" && state.sturz) {
      zeichneSturz();
      return;
    }
    const p = haltung();
    const sx = bildX(r.x);
    const n = nachtK();
    const still = ruhig();
    // Das Spiegelbild.
    g.save();
    g.beginPath();
    g.rect(-10, view.wl + 0.3, view.cssW + 20, view.cssH);
    g.clip();
    const sy2 = untenY(r.y);
    if (n < 1) {
      stil = "spiegel";
      zeichneLaeuferin(sx, sy2, s, true, p, { stauch: state.stauch, alpha: 1 - n });
    }
    if (n > 0) {
      stil = "glanz";
      schein("kalt", sx + 0.5 * s, untenY(r.y + TOP * 0.55), 0.9 * s, 0.4 * n);
      g.save();
      if (!still) {
        g.translate(sx, sy2);
        g.transform(1, 0, Math.sin(state.zeit * 2.3) * 0.05, 1, 0, 0);
        g.translate(-sx, -sy2);
      }
      zeichneLaeuferin(sx, sy2, s, true, p, { stauch: state.stauch, alpha: n, kontur: { farbe: "rgba(150, 250, 255, 0.85)", plus: 1.1 } });
      g.restore();
    }
    stil = "tag";
    g.restore();
    // Ihr Schatten auf dem Weg, im Sprung blasser.
    g.fillStyle = `rgba(40, 30, 60, ${clamp(0.3 - r.y * 0.006, 0.06, 0.3)})`;
    g.beginPath();
    g.ellipse(sx + 2 * s, obenY(0.1), (6 + r.y * 0.08) * s, 1.1 * s, 0, 0, TAU);
    g.fill();
    // Sie selbst.
    zeichneLaeuferin(sx, obenY(r.y), s, false, p, { stauch: state.stauch, kante: true });
  }

  function zeichneSturz() {
    const f = state.sturz;
    const s = view.s;
    const sx = bildX(f.x);
    const n = nachtK();
    const pose = f.warum === "glas" ? poseKnien() : f.warum === "wasser" ? poseFallen() : (f.zeit < 0.2 ? poseSprung(0.4) : poseLiegt());
    // Wer liegt, liegt auf dem Weg: um die Hüfte gedreht, und so viel tiefer.
    const lieg = f.warum === "kopf" || f.warum === "stolpern" ? Math.abs(Math.sin(f.dreh)) * 9.5 : 0;
    // Das Spiegelbild: Beim Glas zerspringt es, sonst fällt es mit.
    if (f.warum !== "glas" || f.zeit < 0.06) {
      g.save();
      g.beginPath();
      g.rect(-10, view.wl + 0.3, view.cssW + 20, view.cssH);
      g.clip();
      stil = n > 0.5 ? "glanz" : "spiegel";
      zeichneLaeuferin(sx, untenY(f.y - lieg), s, true, pose, { dreh: f.dreh, kontur: n > 0.5 ? { farbe: "rgba(150, 250, 255, 0.85)", plus: 1.1 } : null });
      stil = "tag";
      g.restore();
    }
    g.save();
    g.beginPath();
    g.rect(-10, -20, view.cssW + 20, view.wl + 19.6);
    g.clip();
    zeichneLaeuferin(sx, obenY(f.y - lieg), s, false, pose, { dreh: f.dreh, kante: true });
    g.restore();
  }

  // Die Gegner als Läuferinnen aus Licht (geist.js).
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
      const fliegt = (Math.round(o.c || 0) & 1) === 1;
      const p = fliegt ? poseSprung(0.45) : poseLauf((x / 62) % 1);
      zeichneLaeuferin(sx, obenY(y), view.s, false, p, { geist: o.farbe, alpha: 0.45 * o.blass });
      const dx = x - state.laeuferin.x;
      namen.push({ ...o, sx, sy: obenY(y + TOP + 6), weit: `${dx > 0 ? "+" : ""}${Math.round(dx / METER)} m` });
    });
    window.LernappGeist.namen(g, namen, { breit: view.cssW, hoch: view.cssH });
  }

  // ---------------------------------------------------------------------------
  // Zeichnen: Atem, Teile, Risse, Schrift
  // ---------------------------------------------------------------------------
  function zeichneAtem() {
    const n = nachtK();
    state.atem.forEach((a) => {
      const k = clamp(a.leben / a.max, 0, 1);
      const r = (1 + (1 - k) * 2.4) * view.s / 6;
      const x = bildX(a.x);
      schein("atem", x, obenY(a.y), r, k * 0.55);
      // Im See haucht das Spiegelbild mit.
      schein(n > 0.5 ? "kalt" : "atem", x, untenY(a.y), r, k * (n > 0.5 ? 0.5 : 0.3));
    });
  }

  function zeichneTeile() {
    if (!state.teile.length) return;
    state.teile.forEach((t) => {
      const k = clamp(t.leben / t.max, 0, 1);
      const x = bildX(t.x);
      const y = t.unten ? untenY(t.y) : obenY(t.y);
      if (t.art === "staub") {
        schein("staub", x, y, (t.r * (1.6 - 0.8 * k) * view.s) / 11, k * t.kraft);
      } else if (t.art === "tropfen") {
        g.globalAlpha = k;
        g.fillStyle = t.unten ? "#c8fbff" : "#f4f8ff";
        g.fillRect(x - 0.6, y - 0.6, 1.3, 1.3);
        g.globalAlpha = 1;
      } else if (t.art === "nadel") {
        g.globalAlpha = Math.min(1, k * 2);
        g.strokeStyle = "rgb(214, 150, 80)";
        g.lineWidth = 0.8;
        g.beginPath();
        g.moveTo(x, y);
        g.lineTo(x + Math.cos(t.w) * 1.6 * view.s, y + Math.sin(t.w) * 1.6 * view.s);
        g.stroke();
        g.globalAlpha = 1;
      } else if (t.art === "scherbe") {
        g.globalAlpha = Math.min(1, k * 1.6);
        g.save();
        g.translate(x, y);
        g.rotate(t.w);
        g.fillStyle = "rgba(190, 250, 255, 0.55)";
        g.strokeStyle = "rgba(240, 255, 255, 0.95)";
        g.lineWidth = 0.7;
        g.beginPath();
        g.moveTo(-t.r * view.s, -t.r * 0.4 * view.s);
        g.lineTo(t.r * 0.8 * view.s, -t.r * 0.7 * view.s);
        g.lineTo(t.r * 0.2 * view.s, t.r * 0.9 * view.s);
        g.closePath();
        g.fill();
        g.stroke();
        g.restore();
        g.globalAlpha = 1;
      } else {
        g.globalAlpha = Math.min(1, k * 2);
        g.fillStyle = "rgb(110, 96, 130)";
        g.fillRect(x - t.r * view.s * 0.5, y - t.r * view.s * 0.5, t.r * view.s, t.r * view.s);
        g.globalAlpha = 1;
      }
    });
  }

  // Wenn das Spiegelbild anstösst, zerspringt der See wie Glas: Risse
  // laufen vom Aufprall über das Wasser.
  function risseBauen(cx, cy) {
    const risse = [];
    const W = view.cssW;
    const zahl = 11;
    for (let i = 0; i < zahl; i += 1) {
      const w0 = (i / zahl) * TAU + (Math.random() - 0.5) * 0.4;
      const w = Math.atan2(Math.sin(w0) * 0.55, Math.cos(w0));
      const pts = [[cx, cy]];
      let x = cx;
      let y = cy;
      let r = w;
      const lang = W * (0.35 + Math.random() * 0.65);
      let weit = 0;
      while (weit < lang) {
        const schritt = 7 + Math.random() * 14;
        r += (Math.random() - 0.5) * 0.5;
        x += Math.cos(r) * schritt;
        y += Math.sin(r) * schritt;
        weit += schritt;
        pts.push([x, y]);
        if (Math.random() < 0.18) {
          const ast = [[x, y]];
          let ax = x;
          let ay = y;
          let ar = r + (Math.random() < 0.5 ? -1 : 1) * (0.5 + Math.random() * 0.6);
          for (let j = 0; j < 3 + Math.random() * 4; j += 1) {
            ar += (Math.random() - 0.5) * 0.5;
            ax += Math.cos(ar) * (6 + Math.random() * 10);
            ay += Math.sin(ar) * (6 + Math.random() * 10);
            ast.push([ax, ay]);
          }
          risse.push({ pts: ast, ab: weit / lang });
        }
      }
      risse.push({ pts, ab: 0 });
    }
    // Ringe um den Aufprall, gebrochen.
    const ringe = [6, 13, 22].map((rr) => ({ r: rr + Math.random() * 3, von: Math.random() * TAU }));
    // Die Risse gehören an den Ort in der Welt: Gleitet die Kamera danach,
    // gleiten sie mit (wx, cx: wo der Aufprall war, in der Welt und im Bild).
    return { risse, ringe, cx, cy, wx: state.camX + (cx - view.rx) / view.s };
  }

  function zeichneRisse() {
    const f = state.sturz;
    if (!f || !f.glas) return;
    const k = clamp(f.zeit / 0.45, 0, 1);
    const { risse, ringe, cx, cy } = f.glas;
    g.save();
    g.beginPath();
    g.rect(0, view.wl + 0.5, view.cssW, view.cssH);
    g.clip();
    g.translate(bildX(f.glas.wx) - cx, 0);
    // Der Blitz des Aufpralls.
    if (f.zeit < 0.35) schein("weiss", cx, cy, 3.5, 1 - f.zeit / 0.35);
    g.lineCap = "round";
    g.lineJoin = "round";
    [[3, "rgba(120, 240, 255, 0.22)"], [1, "rgba(245, 255, 255, 0.9)"]].forEach(([b, farbe]) => {
      g.strokeStyle = farbe;
      g.lineWidth = b;
      g.beginPath();
      risse.forEach((r) => {
        const anteil = clamp((k - r.ab) / Math.max(0.05, 1 - r.ab), 0, 1);
        const n = Math.max(2, Math.ceil(r.pts.length * anteil));
        if (anteil <= 0) return;
        r.pts.slice(0, n).forEach(([x, y], i) => { if (i) g.lineTo(x, y); else g.moveTo(x, y); });
      });
      g.stroke();
    });
    g.strokeStyle = "rgba(230, 255, 255, 0.7)";
    g.lineWidth = 0.8;
    ringe.forEach((r) => {
      for (let i = 0; i < 5; i += 1) {
        const a = r.von + i * 1.3;
        g.beginPath();
        g.ellipse(cx, cy, r.r * k, r.r * 0.6 * k, 0, a, a + 0.8);
        g.stroke();
      }
    });
    // Splitter, die das Licht fangen.
    g.globalAlpha = 0.15 + 0.15 * Math.sin(state.zeit * 6);
    g.fillStyle = "#e8ffff";
    risse.forEach((r, i) => {
      if (i % 2) return;
      const [x, y] = r.pts[Math.min(r.pts.length - 1, 2 + (i % 4))];
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + 8, y + 3);
      g.lineTo(x + 3, y + 9);
      g.closePath();
      g.fill();
    });
    g.globalAlpha = 1;
    g.restore();
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
      const y = obenY(t.y) - (1 - k) * 14;
      g.globalAlpha = Math.min(1, k * 2.4);
      g.lineWidth = Math.max(3, gross * 0.22);
      g.strokeStyle = "rgba(24, 16, 40, 0.85)";
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
    g.fillStyle = "rgba(22, 18, 46, 0.5)";
    g.beginPath();
    g.roundRect(W / 2 - breit / 2 - 16, y - 17, breit + 32, an.unter ? 54 : 34, 17);
    g.fill();
    g.lineWidth = 5;
    g.strokeStyle = "rgba(20, 16, 44, 0.8)";
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
    const wackel = ruhig() ? 0 : Math.sin(state.zeit * 60) * 3 * state.stoss;
    zeichneWelt();
    zeichneHimmelsleben();
    zeichneSeeleben();
    g.setTransform(view.dpr, 0, 0, view.dpr, Math.round(wackel * view.dpr), 0);
    zeichneStege();
    zeichneWasserlinie();
    zeichneHindernisseUnten();
    zeichneHindernisseOben(false);
    const imNebel = state.nebel.some((nb) => bildX(nb.b) > -10 && bildX(nb.a) < view.cssW + 10);
    if (imNebel) {
      // Im Nebel verdeckt er auch die Äste – die Läuferin bleibt davor.
      zeichneHindernisseOben(true);
      zeichneNebel();
    }
    zeichneGeister();
    zeichneAtem();
    zeichneFigur();
    if (!imNebel) zeichneHindernisseOben(true);
    zeichneTeile();
    zeichneRisse();
    g.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
    zeichneSchriften();
    zeichneAnsage();
  }

  // ---------------------------------------------------------------------------
  // Was aufstiebt
  // ---------------------------------------------------------------------------
  function teile(art, x, y, n, kraft, richtung = 0, unten = false) {
    if (ruhig()) return;
    for (let i = 0; i < n; i += 1) {
      const w = Math.random() * (art === "scherbe" ? TAU : Math.PI);
      const v = (6 + Math.random() * 22) * kraft;
      const leben = art === "staub" ? 0.6 + Math.random() * 0.8 : 0.4 + Math.random() * 0.5;
      state.teile.push({
        art, x, y, unten, vx: Math.cos(w) * v + richtung, vy: Math.sin(w) * v * (art === "staub" ? 0.5 : 1.4), w: Math.random() * TAU,
        r: art === "staub" ? 4 + Math.random() * 5 * kraft : art === "scherbe" ? 1.2 + Math.random() * 2.2 : 0.8 + Math.random() * 1.2, leben, max: leben, kraft: art === "staub" ? 0.5 : 1,
      });
    }
    if (state.teile.length > 180) state.teile.splice(0, state.teile.length - 180);
  }

  function ring(x, weit = 26, leben = 1.1) {
    if (ruhig()) return;
    state.ringe.push({ x, weit, leben, max: leben });
    if (state.ringe.length > 12) state.ringe.shift();
  }

  function schrift(text, farbe, x, y, gross = 30) {
    state.schriften = [{ text, farbe, x, y, gross, leben: 0.8, max: 0.8 }];
  }

  function ansage(text, unter, farbe = "#ffffff", dauer = 2.2) {
    state.ansage = { text, unter, farbe, leben: dauer, max: dauer };
  }

  // ---------------------------------------------------------------------------
  // Springen, landen, stürzen
  // ---------------------------------------------------------------------------
  function absprung() {
    const r = state.laeuferin;
    if (r.sprung !== null) {
      // In der Luft verfällt der Tipp.
      state.verfallen += 1;
      return;
    }
    r.sprung = state.t;
    r.absprung = state.t;
    state.spruenge += 1;
    klang()?.ton?.("spiegelsee.sprung", { laut: 0.8 });
    klang()?.ton?.("spiegelsee.tauchen", { laut: 0.45, hoehe: 0.8 });
    kids()?.vibrate?.(6);
    teile("staub", r.x - 4, 0.5, 4, 0.7, -10);
    // Das Spiegelbild taucht: Tropfen an der Wasserlinie, ein Ring.
    teile("tropfen", r.x, -UFER, 5, 1, 20, true);
    ring(r.x + 6, 18, 0.8);
  }

  function landen(t) {
    const r = state.laeuferin;
    r.sprung = null;
    r.landung = t;
    state.stauch = 1;
    klang()?.ton?.("spiegelsee.landung", { laut: 0.55 });
    const x = xBei(t);
    teile("staub", x - 4, 0.5, 5, 0.9, -14);
    teile("staub", x + 5, 0.5, 3, 0.6, 6);
    ring(x, 30, 1.2);
  }

  function sturz(o, nurBild = false) {
    if (state.schritt === "sturz") return;
    const r = state.laeuferin;
    state.schritt = "sturz";
    const v = tempoBei(Math.max(0, state.t));
    const warum = o?.welt === "unten" ? "glas" : o?.kind === "luecke" ? "wasser" : o?.kind === "decke" ? "kopf" : "stolpern";
    state.sturz = {
      warum, art: o?.art || "stein", zeit: 0, x: r.x, y: r.y,
      vx: warum === "glas" ? v * 0.3 : warum === "kopf" ? -v * 0.1 : warum === "wasser" ? v * 0.35 : v * 0.55,
      vy: warum === "kopf" ? -10 : warum === "stolpern" ? 40 : warum === "wasser" ? 0 : 0,
      dreh: 0,
      drehV: warum === "kopf" ? -4.2 : warum === "stolpern" ? 6.5 : 0,
      glas: null,
    };
    state.stoss = 1;
    klangAus();
    if (warum === "glas") {
      // Wo das Spiegelbild anstösst: am Kopf (oben im Wasser) oder an den
      // Füssen (an dem, was von der Wasserlinie hängt).
      const tiefe = o.kind === "decke" ? r.y + TOP - 1 : r.y + 2;
      state.sturz.glas = risseBauen(bildX(r.x + LH), untenY(tiefe));
      klang()?.ton?.("spiegelsee.glas");
      teile("scherbe", r.x + LH, tiefe, 26, 2.6, 0, true);
    } else if (warum === "wasser") {
      klang()?.ton?.("spiegelsee.platsch");
    } else if (warum === "kopf") {
      klang()?.ton?.("spiegelsee.ast");
      teile("nadel", r.x + 3, DECKE, 14, 1.4, -10);
    } else {
      klang()?.ton?.("spiegelsee.stolpern");
      teile("staub", r.x + 5, 1, 10, 1.3, 10);
      teile("stein", r.x + 6, 2, 6, 1.2, 12);
    }
    kids()?.vibrate?.([30, 40, 70]);
    if (nurBild) return;
    stepTimer = window.setTimeout(finish, ruhig() ? 900 : STURZ_MS);
  }

  function sturzTakt(dt) {
    const f = state.sturz;
    if (!f) return;
    f.zeit += dt;
    if (f.warum === "glas") {
      // Sie bremst, sinkt auf die Knie und schaut in den zerbrochenen See.
      f.vx *= 1 - 4 * dt;
      f.x += f.vx * dt;
      f.y = Math.max(0, f.y - 60 * dt);
      return;
    }
    if (f.warum === "wasser") {
      // Durch die Lücke ins Wasser – und das Spiegelbild ihr entgegen.
      f.vx *= 1 - 3 * dt;
      f.vy -= 260 * dt;
      f.x += f.vx * dt;
      f.y += f.vy * dt;
      if (f.y < -UFER && !f.platsch) {
        f.platsch = true;
        teile("tropfen", f.x, -UFER + 1, 18, 2.4, 0);
        teile("tropfen", f.x, -UFER + 1, 10, 2, 0, true);
        ring(f.x, 40, 1.6);
        ring(f.x + 4, 24, 1.2);
      }
      if (f.y < -UFER - 30) f.y = -UFER - 30;
      return;
    }
    f.vy -= 260 * dt;
    f.x += f.vx * dt;
    f.y += f.vy * dt;
    f.dreh += f.drehV * dt;
    if (f.y < 0) {
      f.y = 0;
      if (Math.abs(f.vy) > 30) teile("staub", f.x, 0.5, 4, 1, 0);
      f.vy = Math.abs(f.vy) > 30 ? -f.vy * 0.25 : 0;
      f.vx *= 0.5;
      f.drehV *= 0.4;
    }
    if (f.y === 0) {
      f.vx *= 1 - 5 * dt;
      // Sie bleibt liegen, flach auf dem Weg.
      const ziel = f.warum === "kopf" ? -1.35 : 1.35;
      f.dreh += (ziel - f.dreh) * Math.min(1, dt * 7);
    }
  }

  function physik(dt) {
    const r = state.laeuferin;
    const n = Math.max(1, Math.ceil(dt / TAKT - 1e-9));
    const h = dt / n;
    for (let i = 0; i < n; i += 1) {
      if (state.schritt === "sturz") return;
      state.t += h;
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
    if (state.t < 0) return;
    absprung();
  }

  // ---------------------------------------------------------------------------
  // Zuschauen
  // ---------------------------------------------------------------------------
  function zuschauenStarten() {
    if (!zuschauer?.lauf) return;
    startRun();
    state.phase = "zuschauen";
    state.schritt = "lauf";
    state.t = 0;
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
      if (liste[i].b < x - LH - 20) continue;
      return liste[i];
    }
    return { kind: "boden", art: "stein", welt: "oben" };
  }

  // Sie steht, wo die Aufzeichnung sie hat (a: der Weg, b: die Höhe in
  // Zehnteln, c: ob sie springt und wie viele Sprünge es sind).
  function zuschauenTakt(dt) {
    const st = zuschauer.stand();
    if (!st) return;
    const r = state.laeuferin;
    if (state.schritt !== "sturz") {
      const x = Math.max(0, st.a);
      state.t = x > 0.5 ? Math.max(state.t, tBei(x)) : state.t + dt * 0.2;
      const c = Math.max(0, Math.round(st.c));
      const fliegt = (c & 1) === 1;
      const zahl = c >> 1;
      if (fliegt && r.sprung === null) {
        r.sprung = state.t;
        r.absprung = state.t;
        state.spruenge = zahl;
        klang()?.ton?.("spiegelsee.sprung", { laut: 0.6 });
        teile("tropfen", x, -UFER, 5, 1, 20, true);
        ring(x + 6, 18, 0.8);
      }
      if (!fliegt && r.sprung !== null) { r.sprung = null; r.landung = state.t; state.stauch = 1; ring(x, 30, 1.2); teile("staub", x - 4, 0.5, 5, 0.9, -14); }
      r.x = x;
      r.y = Math.max(0, st.b / 10);
      const punkte = Math.max(0, Math.floor(st.punkte));
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
  // Ein neuer Abschnitt: Ein besonderer wird vorher angesagt, das Erwachen
  // auch.
  function abschnittPruefen() {
    const nr = abschnittBei(state.t);
    if (state.erwacheT !== null && !state.angesagt && state.t >= state.erwacheT - 1.35) {
      state.angesagt = true;
      ansage("Der See erwacht", "Unten gelten jetzt eigene Hindernisse", "#aef8ff", 2.6);
    }
    if (state.erwacheT !== null && !state.erwacht && state.t >= state.erwacheT) {
      state.erwacht = true;
      klang()?.ton?.("spiegelsee.erwachen", { laut: 0.9 });
      kids()?.vibrate?.(12);
    }
    if (nr === state.abschnitt) return;
    state.abschnitt = nr;
    const naechster = state.abschnitte[nr + 1];
    if (naechster?.besonders === "nebel") {
      ansage("Nebel zieht auf", "Der See zeigt dir das Ufer", "#ffe6ee", 2.2);
      klang()?.ton?.("spiegelsee.nebel", { laut: 0.7 });
    } else if (naechster?.besonders === "steg") {
      ansage("Holzsteg voraus", naechster.nr >= 30 ? "Lücken in den Brettern – unten Hechte" : "Lücken in den Brettern", "#ffd8a8", 2.2);
      klang()?.ton?.("spiegelsee.steg", { laut: 0.7 });
    }
  }

  function takt(dt, strecke = dt) {
    state.zeit += dt;
    const r = state.laeuferin;
    if (state.stoss > 0) state.stoss = Math.max(0, state.stoss - dt * 3);
    if (state.stauch > 0) state.stauch = Math.max(0, state.stauch - dt * 7);
    if (state.ansage) { state.ansage.leben -= dt; if (state.ansage.leben <= 0) state.ansage = null; }
    if (state.intro) {
      state.intro.t += dt;
      if (state.intro.t >= state.intro.dauer) {
        state.intro = null;
        host.dataset.intro = "aus";
        if (ebenen) { ebenen.himmelBlau = null; ebenen.spiegelBlau = null; }
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

    // Die Schritte: je schneller, desto rascher.
    if (state.schritt === "lauf" && r.sprung === null) state.lauf = (state.lauf + dt * (1.45 + tempoBei(state.t) / 140)) % 1;
    // Der Atem in der kalten Luft.
    state.atemUhr -= dt;
    if (state.atemUhr <= 0 && state.schritt !== "sturz" && !ruhig()) {
      state.atemUhr = state.schritt === "start" ? 1.5 : 0.62;
      state.atem.push({ x: r.x + (state.schritt === "start" ? 3 : 4.2), y: r.y + 20, leben: 0.9, max: 0.9 });
      if (state.atem.length > 8) state.atem.shift();
    }
    for (let i = state.atem.length - 1; i >= 0; i -= 1) {
      const a = state.atem[i];
      a.leben -= dt;
      a.x += 6 * dt;
      a.y += 3 * dt;
      if (a.leben <= 0) state.atem.splice(i, 1);
    }
    for (let i = state.ringe.length - 1; i >= 0; i -= 1) {
      state.ringe[i].leben -= dt;
      if (state.ringe[i].leben <= 0) state.ringe.splice(i, 1);
    }
    for (let i = state.teile.length - 1; i >= 0; i -= 1) {
      const t = state.teile[i];
      if (t.art === "staub") {
        t.vx *= 1 - 1.6 * dt;
        t.vy = t.vy * (1 - 1.2 * dt) + 3 * dt;
      } else if (t.art === "scherbe") {
        // Scherben sinken in die Tiefe (unten zählt y nach unten).
        t.vy += 40 * dt;
        t.vx *= 1 - 0.8 * dt;
        t.w += dt * 4;
      } else {
        t.vy -= 160 * dt;
        t.vx *= 1 - 1.2 * dt;
        t.w += dt * 6;
      }
      t.x += t.vx * dt;
      t.y += t.vy * dt;
      if (t.art !== "staub" && t.art !== "scherbe" && t.y < (t.art === "tropfen" ? -UFER : 0)) { t.leben = Math.min(t.leben, 0.05); }
      t.leben -= dt;
      if (t.leben <= 0) state.teile.splice(i, 1);
    }
    for (let i = state.schriften.length - 1; i >= 0; i -= 1) {
      state.schriften[i].leben -= dt;
      if (state.schriften[i].leben <= 0) state.schriften.splice(i, 1);
    }

    // Die Kamera bleibt bei ihr; beim Sturz gleitet sie ein Stück zurück.
    if (state.schritt !== "sturz") state.camX = r.x;
    else if (state.sturz) {
      const ziel = state.sturz.x - Math.max(0, view.cssW * 0.36 - view.rx) / view.s;
      state.camX += (ziel - state.camX) * (1 - Math.exp(-dt * 3.2));
    }
    planBis(state.t + 9, 1);

    if (state.phase === "spiel" && state.schritt !== "sturz") {
      gegner?.takt(state.punkte, { a: Math.round(r.x), b: Math.round(r.y * 10), c: (r.sprung !== null ? 1 : 0) + 2 * state.spruenge });
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
  // gemeinsamen Start.
  function losGehts() {
    if (state.phase !== "bereit") return;
    state.phase = "spiel";
    state.schritt = "lauf";
    state.t = 0;
    if (state.intro) state.intro.t = Math.max(state.intro.t, state.intro.dauer - 0.4);
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
    state.laeuferin = { x: 0, y: 0, sprung: null, landung: -9, absprung: -9 };
    state.spruenge = 0;
    state.verfallen = 0;
    state.sturz = null;
    state.teile = [];
    state.ringe = [];
    state.atem = [];
    state.schriften = [];
    state.ansage = null;
    state.zeit = 0;
    state.stoss = 0;
    state.stauch = 0;
    state.lauf = 0;
    state.atemUhr = 0.4;
    state.camX = 0;
    state.erwacht = false;
    state.angesagt = false;
    streckeNeu();
    voraus = 0;
    shell.setCount(0);
    gegner?.runde();

    // Beim ersten Start glühen die Gipfel erst auf.
    state.intro = ersterStart && !zuschauer && !shell.live && !ruhig() ? { t: 0, dauer: 2.8 } : null;
    ersterStart = false;
    host.dataset.intro = state.intro ? "an" : "aus";

    shell.clear();
    const prompt = shell.el("p", "cm-prompt sg-prompt", "Tippen – du und dein Spiegelbild springen zugleich.");
    shell.play.append(prompt, buildPlatz());
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
    stein: "Über einen Stein gestolpert",
    stamm: "Über einen Baumstamm gestolpert",
    ast: "Mit dem Kopf an einen Ast",
    dach: "Am Felsdach angestossen",
    luecke: "Durch den Steg ins Wasser",
    kristall: "Das Spiegelbild traf einen Eiskristall",
    schilf: "Das Spiegelbild blieb im Schilf hängen",
    wurzel: "Das Spiegelbild traf eine Wurzel",
    hecht: "Das Spiegelbild stiess an einen Hecht",
    qualle: "Das Spiegelbild stiess an eine Qualle",
    treibholz: "Das Spiegelbild stiess an Treibholz",
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
    const warum = WARUM[state.sturz?.art] || "";
    const zeit = `${Math.max(0, Math.round(state.t))} s`;
    shell.showResult({
      label: "Deine Meter",
      points: punkte,
      detail: rekord ? "Neuer Rekord!" : `${warum ? `${warum} · ` : ""}${zeit}`,
      geist,
    });
    if (rekord) host.querySelector(".cm-result-detail")?.classList.add("sg-rekord");
    zaehleHoch(punkte);
  }

  // ---------------------------------------------------------------------------
  // Start
  // ---------------------------------------------------------------------------
  shell = shellApi.mount({
    host,
    title: "Spiegelsee",
    area: "geschwindigkeit",
    accent: "#F5A623",
    accentDark: "#b9741a",
    clock: false,
    onRestart: () => (zuschauer ? zuschauenStarten() : startRun()),
    live: { los: losGehts, stopp: () => finish(), zuschauen: (quelle) => { zuschauer = quelle; zuschauenStarten(); } },
  });
  zuschauer = window.LernappGeist?.zuschauer?.({
    host, spiel: "mirrorLake", fassung: FASSUNG, zufall, einheit: "m", nochmal: zuschauenStarten,
  }) || null;
  if (!zuschauer) {
    gegner = window.LernappGeist?.fuer?.({ spiel: "mirrorLake", host, art: "tempo", alle: true, zufall }) || null;
  }

  startRun();
  zuschauer?.laden.then((da) => { if (da) zuschauenStarten(); });

  // Ein Tipp irgendwo aufs Bild: Sie springt. Nur Knöpfe bleiben Knöpfe.
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
  window.LernappSpiegelsee = {
    METER, LH, TOP, UFER, DECKE, SPRUNG, HOCH, RAND, E_MIN, FASSUNG, state, view,
    takt, tippen, losGehts, physik, planBis, kursText, trifft, xBei, tBei, tempoBei, bogenY, luftBei, schwere, folgeHaelt, abschnittBei, nachtK,
  };
})();
