/*
 * wasserlaeufer.js – Wasserläufer.
 * ---------------------------------------------------------------------------
 * Ein Teich am Nachmittag, von oben gesehen. Auf einem Seerosenblatt steht
 * ein Wasserläufer. Gesteuert wird wie mit einer Schleuder, auf jedem Gerät
 * gleich: Finger (oder Maus) irgendwo aufsetzen, zurückziehen, loslassen –
 * das ist ein Ruderschlag, entgegen der Zugrichtung und so kräftig, wie weit
 * gezogen wurde. Beim Ziehen zeigt ein Pfeil Richtung und Stärke, aber nicht,
 * wo er landet; wer in den kleinen Kreis zurückzieht, bricht ab. Er dreht
 * sich nur zum Ziel, und seine Beine spannen sich. Auf dem Wasser gleitet er
 * weit, auf einem Blatt bremst er stärker – wer zu kräftig schleudert,
 * rutscht drüber hinaus. Mit der Tastatur: Pfeile links und rechts zielen,
 * die Leertaste lädt (halten), loslassen schleudert.
 *
 * Ziel: von Blatt zu Blatt den Bach hinauf. Vorne liegen in jeder Reihe
 * zwei oder drei Blätter: grosse sind leicht zu treffen und sinken schnell,
 * kleine sind schwer zu treffen und halten länger, manche pendeln in der
 * Strömung.
 *
 * Die Punkte: einer je 10 cm Bach – gezählt bis zum höchsten Blatt, auf dem
 * er stand; wer im Kreis herum springt, gewinnt nichts. Dazu Boni, aber nur
 * für einen Sprung in eine neue Reihe: Volltreffer (mitten auf dem Blatt
 * gelandet), knapp entwischt (der Fisch war kurz vor dem Biss), letzter
 * Drücker (das alte Blatt war schon im roten Bereich) und kleines Blatt –
 * je ein Punkt.
 *
 * Auf dem Blatt ist er sicher – aber nur kurz: Sobald er darauf sitzt,
 * läuft es voll Wasser (ein Ring auf dem Blatt zeigt, wie lange noch) und
 * geht unter, anfangs nach gut 2 s, später nach weniger als einer. Auf
 * offenem Wasser ist er in Gefahr: Fast sofort steigt unter ihm ein Fisch
 * auf – zuerst ein blasser Schatten, der dunkler wird und ihm folgt, dann
 * schnappt er zu. Entkommen kann ihm nur, wer vorher ein Blatt erreicht.
 * Ein Schlag im Gleiten geht auch, aber Rudern kostet Kraft: zwei Schläge
 * kurz nacheinander, dann braucht er einen Moment.
 *
 * Später liegen die Reihen weiter auseinander, die Blätter sind kleiner,
 * sie halten kürzer, und die Fische kommen schneller.
 *
 * Jede achte Reihe ist besonders, im festen Wechsel und vorher angesagt:
 * eine Strömung (ein Seitenbach reisst quer über den Weg, und hinüber geht
 * es auf treibendem Laub – wer zu weit mitgetragen wird, ist fort) oder
 * eine Hechtgrube (tiefes, dunkles Wasser, ein grosser Hecht zieht seine
 * Kreise, und der Teppich drüben liegt so weit, dass es zwei Schläge
 * braucht, der zweite im Gleiten).
 *
 * Die Welt wechselt bachaufwärts: der Seerosenteich am Nachmittag, der
 * Bachlauf mit Steinen, der Mühlenteich, das Moor in der Dämmerung und die
 * Quelle in der Nacht.
 *
 * Gebaut wird aus dem Zufall (zufall.js): ohne Turnier jedes Mal eine andere
 * Welt, im Turnier für alle im selben Versuch dieselbe. Sie ist immer zu
 * schaffen, weil zuerst der Weg entsteht – Reihe um Reihe, und jeder Sprung
 * wird nachgerechnet: Von jedem Blatt der vorigen Reihe aus muss ein
 * Schlag auf einem Blatt der neuen landen, mit Spielraum in Richtung und
 * Stärke (fensterVon). Ein Autopilot (pilot) mit Streuung beweist es in der
 * Prüfung.
 *
 * Die Runde hängt nur an der Spielzeit, der Saat und den Schlägen (mit
 * ihrer Zeit, Richtung und Stärke: schleudern, voraus). Die Gegner
 * (geist.js) laufen als Wasserläufer aus Licht mit, und die besten Läufe
 * lassen sich anschauen (?zuschauen=) – samt Zielen und Spannen.
 *
 * Einheiten: Zentimeter. x quer (rechts positiv), y bachaufwärts (oben
 * positiv). Eine Richtung w zeigt nach (cos w, sin w).
 */
(() => {
  "use strict";

  if (document.body.dataset.page !== "wasserlaeufer") return;

  const host = document.querySelector("#wa-stage");
  const shellApi = window.LernappGameShell;
  const cloudApi = window.LernappGameCloud;
  if (!host || !shellApi) return;

  const kids = () => window.LernappKids || null;
  const klang = () => window.ArcadeKlang || null;
  // Weniger Bewegung? Einmal je Bild gefragt (matchMedia ist nicht umsonst).
  let ruhigJetzt = null;
  const ruhig = () => {
    if (ruhigJetzt === null) ruhigJetzt = Boolean(kids()?.prefersReducedMotion?.());
    return ruhigJetzt;
  };

  // Der Zufall. Nur die Welt zieht daraus – Blätter, Strömungen, Hechte und
  // der Lauf des Baches. Was glitzert, treibt und schwirrt, hängt an festen
  // Zahlen oder an Math.random.
  const zufall = window.LernappZufall?.fuer?.("pondSkater") || {
    neu() {},
    zahl: () => Math.random(),
  };

  // ---------------------------------------------------------------------------
  // Die Regeln
  // ---------------------------------------------------------------------------
  const TAU = Math.PI * 2;
  // Die Schleuder: Finger (oder Maus) aufsetzen, zurückziehen, loslassen.
  // Der Schlag geht entgegen der Zugrichtung, so stark, wie weit gezogen
  // wurde: Unter TOT_ANTEIL der kürzeren Bildseite (mindestens TOT_MIN
  // Bildpunkte) ist nichts – wer dorthin zurückzieht, bricht ab –, bei
  // ZUG_ANTEIL (zwischen ZUG_MIN und ZUG_MAX Bildpunkten) ist die volle
  // Stärke erreicht. Die Stärke 0 bis 1 gibt J_MIN bis J_MAX Zentimeter je
  // Sekunde. Mehrere Schläge zählen zusammen.
  const TOT_ANTEIL = 0.04;
  const TOT_MIN = 12;
  const ZUG_ANTEIL = 0.3;
  const ZUG_MIN = 90;
  const ZUG_MAX = 220;
  const J_MIN = 14;
  const J_MAX = 150;
  const SCHLAG_PAUSE = 0.12;
  // Die Kraft: Ein Schlag braucht eine ganze; zwei hat er höchstens, und sie
  // kommt mit KRAFT_ZURUECK je Sekunde wieder.
  const KRAFT_MAX = 2;
  const KRAFT_ZURUECK = 1.2;
  // Auf dem Wasser: Das Gleiten klingt in TAU_W Sekunden auf gut ein Drittel
  // ab, dazu bremst es fest um MU_W. Der stärkste Schlag trägt knapp 48 cm,
  // der schwächste gut 3 cm.
  const TAU_W = 0.35;
  const MU_W = 10;
  // Auf dem Blatt: Es bremst in TAU_B und mit MU_B – kaum mehr als das
  // Wasser. Wer zu schnell ankommt, rutscht hinüber und auf der anderen
  // Seite wieder ins Wasser; die Stärke muss also passen. Laub ist rau und
  // hält fest (TAU_L, MU_L) – es treibt ja quer. Gelandet ist er, wenn er
  // langsamer ist als LANDEN_V; das Blatt trägt ihn, wenn seine Mitte RAND_B
  // innerhalb des Randes ist (bei kleinen Blättern RAND_ANTEIL des
  // Halbmessers) – wer weiter draussen zur Ruhe kommt, rutscht ab.
  const TAU_B = 0.3;
  const MU_B = 14;
  const TAU_L = 0.12;
  const MU_L = 90;
  const LANDEN_V = 9;
  const RAND_B = 2.2;
  const RAND_ANTEIL = 0.35;
  const randFuer = (r) => Math.min(RAND_B, RAND_ANTEIL * r);
  // Gelandet gleitet er in die Mitte des Blattes (in gut SITZ_ZEIT).
  const SITZ_ZEIT = 0.16;
  // Der Fisch: So nah muss er ihm beim Schnappen sein.
  const R_SCHNAPP = 9;
  const FISCH_PAUSE = 0.45;        // so lange taucht er nach einem Fehlgriff ab
  // Der Hecht: So nah an seinem Kopf ist man gefressen.
  const R_HECHT = 5;
  // Über der Hechtgrube ist der kleine Fisch vorsichtiger (der Hecht ist
  // da): Er wartet so viel mal länger.
  const HECHT_GEDULD = 3;
  // Die Punkte: einer je PUNKT_CM Bach bis zum höchsten Blatt, dazu je ein
  // Bonus für einen Sprung in eine neue Reihe – Volltreffer: höchstens
  // VOLL_ANTEIL des Halbmessers (plus VOLL_CM) neben der Mitte gelandet;
  // knapp entwischt: höchstens KNAPP_S vor dem Biss gelandet; letzter
  // Drücker: abgesprungen, als dem Blatt nur noch DRUECKER_REST seiner Zeit
  // blieb (der Ring ist dann rot); kleines Blatt.
  const PUNKT_CM = 10;
  const VOLL_ANTEIL = 0.15;
  const VOLL_CM = 0.25;
  const KNAPP_S = 0.08;
  const DRUECKER_REST = 0.25;
  const BONI = {
    voll: { text: "Volltreffer", farbe: "#ffe066" },
    knapp: { text: "Knapp entwischt", farbe: "#ffb59a" },
    druecker: { text: "Letzter Drücker", farbe: "#ffcf8a" },
    klein: { text: "Kleines Blatt", farbe: "#c9f29b" },
  };
  // So weit sieht man über ihm voraus und unter ihm zurück – auf jedem
  // Gerät gleich weit voraus. Hochkant gibt die Breite FELD_SICHT den
  // Massstab vor, quer die Höhe.
  const SICHT_OBEN = 84;
  const SICHT_UNTEN = 30;
  const FELD_SICHT = 72;
  const TAKT = 1 / 240;
  const STURZ_MS = 2300;
  const INTRO_WEG = 150;           // so weit oben beginnt der Blick beim ersten Start (cm)
  // Die Fassung der Aufzeichnung (mini-games.js, ANSEHBAR) – dieselbe steht
  // beim Aufzeichnen und Zuschauen (LernappGeist.fuer, .zuschauer).
  const FASSUNG = "t3";
  // Die Schwere nach der Reihe n: Die ersten SCHWER_AB Reihen sind zum
  // Hineinfinden, danach wird es zügig schwerer – nach gut SCHWER_ZAHL
  // Reihen sind sechs Zehntel der Härte da.
  const SCHWER_AB = 3;
  const SCHWER_ZAHL = 8;

  // Die Welten, bachaufwärts. Jede beginnt mit einem besonderen Abschnitt
  // (dem achten, sechzehnten …) und reicht acht Blätter weit; die Quelle in
  // der Nacht bleibt.
  const WELT_NAME = ["Der Seerosenteich", "Der Bachlauf", "Der Mühlenteich", "Das Moor", "Die Quelle"];
  const WELT_UNTER = ["am Nachmittag", "zwischen den Steinen", "im goldenen Licht", "in der Dämmerung", "in der Nacht"];
  const WELTEN = WELT_NAME.length;
  const UEBERGANG = 34;            // so weit gehen zwei Welten ineinander über (cm)

  const TOP_COUNT = 5;
  const store = cloudApi
    ? cloudApi.register({ key: "lernapp.wasserlaeufer", empty: { runs: 0, scores: [] }, merge: cloudApi.mergeScores(TOP_COUNT) })
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
  const winkelDiff = (a, b) => { let d = (a - b) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; };

  function hash01(n) {
    const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return x - Math.floor(x);
  }

  // Ein fester Zufall für das Bild: Die Landschaft sieht bei derselben Saat
  // gleich aus.
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

  const schwere = (n) => 1 - Math.exp(-Math.max(0, n - SCHWER_AB) / SCHWER_ZAHL);
  // Und ab SPAET_AB eine zweite Rampe, damit auch Geübte bald an ihre
  // Grenze kommen – nach gut 30 Reihen mehr ganz da.
  const SPAET_AB = 18;
  const SPAET_ZAHL = 30;
  const spaet = (n) => clamp((n - SPAET_AB) / SPAET_ZAHL, 0, 1);
  // Wie weit Reihe n über der vorigen liegt.
  const reihenAbstandBei = (n) => lerp(20, 30, schwere(n)) + 2 * spaet(n);
  // Die drei Grössen der Blätter in Reihe n (Halbmesser).
  const radienBei = (n) => {
    const k = schwere(n);
    const s = spaet(n);
    return { gross: lerp(9.5, 5.6, k) - 0.6 * s, mittel: lerp(7.3, 4.3, k) - 0.4 * s, klein: lerp(5.4, 3.3, k) - 0.3 * s };
  };
  // Wie lange ein Blatt hält, wenn er darauf sitzt: ein mittleres anfangs
  // gut 2 s, später unter 1 s; ein grosses kürzer, ein kleines länger.
  const haltBei = (n, r) => {
    const mittel = radienBei(n).mittel;
    return (lerp(2.1, 0.85, schwere(n)) - 0.2 * spaet(n)) * clamp(mittel / r, 0.55, 1.7);
  };
  // Der Fisch: Sein Schatten kommt fast sofort (geduld), dann bleibt ihm die
  // Warnung, bis er schnappt – mit der Strecke immer kürzer.
  const geduldBei = (n) => lerp(0.3, 0.2, schwere(n));
  const warnungBei = (n) => lerp(0.85, 0.64, schwere(n)) - 0.08 * spaet(n);
  const fischVBei = (n) => lerp(70, 95, schwere(n));
  // Wie viel Spielraum der Weg mindestens lässt (halbe Breite des Fensters):
  // in der Richtung (rad) und in der Stärke (Anteil von 0 bis 1).
  const spielraumWBei = (n) => ((lerp(7.5, 3.2, schwere(n)) - 0.4 * spaet(n)) * Math.PI) / 180;
  const spielraumSBei = (n) => lerp(0.13, 0.05, schwere(n)) - 0.008 * spaet(n);
  // Wie stark ein Schlag der Stärke st ist (0 bis 1).
  const jVon = (st) => lerp(J_MIN, J_MAX, clamp(st, 0, 1));

  // ---------------------------------------------------------------------------
  // Zustand
  // ---------------------------------------------------------------------------
  // phase:   "bereit" (noch nicht geschleudert), "spiel", "zuschauen", "ende"
  // schritt: "start" (er sitzt auf dem ersten Blatt), "lauf", "tot"
  const state = {
    phase: "bereit",
    schritt: "start",
    punkte: 0,               // Strecke und Boni zusammen
    reihe: 0,                // die höchste Reihe, auf der er stand
    strecke: 0,              // die Punkte der Strecke (je PUNKT_CM eines)
    boni: { voll: 0, knapp: 0, druecker: 0, klein: 0 },
    abflug: null,            // wovon er abgesprungen ist: { rest } des Blattes
    wertung: null,           // die letzte Wertung (wie knapp – für die Prüfung)
    plus: [],                // die Boni im Bild: { text, farbe, x, y, leben, max }
    t: 0,                    // die Spielzeit
    zeit: 0,                 // die Uhr des Bildes
    // Der Wasserläufer: Ort, Tempo, Blickrichtung w, worauf er sitzt
    // (sitz), von welchem Blatt er sich abgestossen hat (von – es greift
    // erst wieder, wenn er es verlassen hat), wie lange er schon auf offenem
    // Wasser ist (nass) und der Versatz zur Mitte des Blattes (ox, oy).
    l: null,
    schlaege: 0,
    letzterSchlag: -9,
    kraft: KRAFT_MAX,
    eingaben: [],            // die Schläge: { t (ms), w, st }
    zug: null,               // das Zielen: { w, st, aktiv, quelle, … }
    stossSt: 0,              // wie stark der letzte Schlag war (fürs Bild)
    reihen: [],              // Reihe um Reihe: { nr, y, blaetter, besonders }
    blaetter: [],            // alle Blätter, nach y geordnet
    blattZahl: 0,
    stroemungen: [],         // die Strömungen mit ihrem Laub
    hechte: [],
    zonen: [],               // wo welche Welt beginnt: [{ w, y }]
    bach: { p1: 0, p2: 0, p3: 0 },
    jagd: { phase: "ruhe", t0: 0, x: 0, y: 0, n: 0, tiefe: 0 },
    tot: null,
    welt: 0,
    abschnitt: 0,
    planFehler: 0,
    teile: [],
    ringe: [],
    schriften: [],
    ansage: null,
    camX: 0,
    camY: 0,
    intro: null,
    stossBild: 0,
    plan: null,
    drift: 0,                // wie weit das Wasser schon getrieben ist (für Treibgut)
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
  let tippRinge = null;
  let ersterStart = true;
  let kulisseTeich = null;
  let kulisseBach = null;
  let kulisseAbend = null;
  // Der Finger (oder die Maus) beim Ziehen, und die Tastatur.
  let zeiger = null;
  const tasten = { links: false, rechts: false, laden: null, w: Math.PI / 2, zuletzt: -9 };
  const TASTEN_DREH = 1.5;         // so schnell dreht der Pfeil, solange ein Pfeil gehalten wird (rad/s)
  const TASTEN_SCHRITT = 0.05;     // so weit bei einem kurzen Druck (rad, knapp 3°)
  const LADE_ZEIT = 0.9;           // so lange hält man die Leertaste bis zur vollen Stärke (s)

  // s: Bildpunkte je Zentimeter; ankerY: wo im Bild der Wasserläufer steht.
  // S: Bildpunkte je Zentimeter; mxp, myp: wo im Bild (in Bildpunkten) die
  // Kamera hinschaut; cxp, cyp: die Kamera in Bildpunkten der Welt.
  const view = {
    s: 1, dpr: 1, cssW: 0, cssH: 0, frei: 0, ankerY: 300, hochkant: true,
    S: 0, mxp: 0, myp: 0, cxp: 0, cyp: 0, kHalbPx: 0, kx0: 0, kwPx: 0, khCm: 1,
  };

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
    kulisseTeich = klang()?.kulisse("wasserlaeufer.teich", { laut: 0 }) || null;
    kulisseBach = klang()?.kulisse("wasserlaeufer.bach", { laut: 0 }) || null;
    kulisseAbend = klang()?.kulisse("wasserlaeufer.abend", { laut: 0 }) || null;
    klangStellen();
  }

  // Die Kulissen nach der Welt: Teich und Mühlenteich still, der Bach
  // rauscht, im Moor und in der Nacht zirpen die Grillen.
  function klangStellen() {
    const mix = weltMix(state.l ? state.l.y : 0);
    let teich = 0;
    let bach = 0;
    let abend = 0;
    mix.forEach(([w, k]) => {
      teich += k * [0.55, 0.15, 0.5, 0.2, 0.15][w];
      bach += k * [0, 0.55, 0.25, 0, 0.3][w];
      abend += k * [0, 0, 0, 0.5, 0.6][w];
    });
    const strom = stroemungNah(state.l ? state.l.y : 0);
    kulisseTeich?.laut(teich);
    kulisseBach?.laut(Math.max(bach, strom * 0.7));
    kulisseAbend?.laut(abend);
  }

  function klangAus() {
    kulisseTeich?.stop();
    kulisseBach?.stop();
    kulisseAbend?.stop();
    kulisseTeich = null;
    kulisseBach = null;
    kulisseAbend = null;
  }

  // ---------------------------------------------------------------------------
  // Der Bach: wo Wasser ist, wie tief, welche Welt
  // ---------------------------------------------------------------------------
  /*
   * Die Welten beginnen, wo der Weg sie hinlegt: Jeder besondere Abschnitt
   * (Strömung, Hechtgrube) trägt eine neue Welt ein (zonen). Dazwischen
   * gehen zwei Welten über UEBERGANG ineinander über – in den Farben, der
   * Breite des Wassers und darin, wie sehr der Bach sich windet.
   */
  function weltBei(y) {
    let w = 0;
    for (const z of state.zonen) if (y >= z.y) w = z.w;
    return w;
  }

  // [[welt, anteil], …] – höchstens zwei.
  function weltMix(y) {
    const z = state.zonen;
    for (let i = z.length - 1; i >= 1; i -= 1) {
      const d = y - z[i].y;
      if (d >= UEBERGANG / 2) return [[z[i].w, 1]];
      if (d > -UEBERGANG / 2) {
        const k = glatt(d / UEBERGANG + 0.5);
        return [[z[i - 1].w, 1 - k], [z[i].w, k]];
      }
    }
    return [[z[0]?.w ?? 0, 1]];
  }

  function nachWelt(y, tabelle) {
    let summe = 0;
    weltMix(y).forEach(([w, k]) => { summe += k * tabelle[Math.min(w, tabelle.length - 1)]; });
    return summe;
  }

  // Wie breit das Wasser ist (halb) und wie sehr sich der Bach windet.
  const HALB = [30, 23, 31, 27, 24];
  const WINDUNG = [5, 9, 4, 8, 7];

  // Die Mitte des Wassers bei y.
  function mitteBei(y) {
    const b = state.bach;
    const a = nachWelt(y, WINDUNG);
    return a * (0.62 * Math.sin(y / 97 + b.p1) + 0.38 * Math.sin(y / 43 + b.p2));
  }

  // Die halbe Breite des Wassers bei y – die Hechtgrube ist breiter.
  function halbBei(y) {
    let h = nachWelt(y, HALB);
    for (const hg of state.hechte) {
      const d = Math.abs(y - hg.cy);
      if (d < hg.ry + 30) h += 7 * glatt(1 - (d - hg.ry) / 30);
    }
    return h;
  }

  // Für das Bild: Mitte und Breite des Wassers, auf Viertelzentimeter
  // gerundet und gemerkt – je Bild werden sie hunderte Male gebraucht. Die
  // Physik rechnet genau (mitteBei, halbBei).
  const bachMerk = new Map();
  function bachBild(y) {
    const key = Math.round(y * 4);
    let b = bachMerk.get(key);
    if (!b) {
      const yy = key / 4;
      b = { m: mitteBei(yy), h: halbBei(yy) };
      if (bachMerk.size > 20000) bachMerk.clear();
      bachMerk.set(key, b);
    }
    return b;
  }

  // Wie tief es bei (x, y) ist: 0 am Ufer, 1 in der Mitte; die Hechtgrube
  // noch tiefer (bis 1,6).
  function tiefeBei(x, y) {
    const m = mitteBei(y);
    const h = halbBei(y);
    const u = clamp(Math.abs(x - m) / h, 0, 1);
    let t = 1 - u ** 2.2;
    t = Math.min(1, t * nachWelt(y, [1.15, 1.35, 1.2, 1.2, 1.25]));
    for (const hg of state.hechte) {
      const dx = (x - hg.cx) / (hg.rx + 14);
      const dy = (y - hg.cy) / (hg.ry + 16);
      const d = dx * dx + dy * dy;
      if (d < 1) t += 0.85 * glatt(1 - d) * (1 - u);
    }
    return t;
  }

  // ---------------------------------------------------------------------------
  // Die Strömung im Bach und in den Seitenbächen
  // ---------------------------------------------------------------------------
  /*
   * Im Bachlauf fliesst das Wasser sanft bachab (bis gut 6 cm/s in der
   * Mitte), in der Quelle ein wenig. In einer Strömung reisst ein Seitenbach
   * quer über den Weg: Im Band (y ± halb) fliesst alles mit v quer, und das
   * Laub darauf auch.
   */
  const BACHAB = [0, 6, 1, 0, 3.5];

  function stroemungBei(x, y) {
    let ux = 0;
    let uy = 0;
    const m = mitteBei(y);
    const h = halbBei(y);
    const q = clamp(1 - ((x - m) / h) ** 2, 0, 1);
    uy = -nachWelt(y, BACHAB) * q;
    for (const s of state.stroemungen) {
      const d = Math.abs(y - s.y);
      if (d > s.halb + 5) continue;
      const k = d <= s.halb ? 1 : glatt(1 - (d - s.halb) / 5);
      ux += s.v * k;
      uy *= 1 - k;
    }
    return { x: ux, y: uy };
  }

  // Wie nah eine Strömung ist (für den Klang): 1 mitten im Band.
  function stroemungNah(y) {
    let k = 0;
    for (const s of state.stroemungen) k = Math.max(k, clamp(1 - (Math.abs(y - s.y) - s.halb) / 60, 0, 1));
    return k;
  }

  // ---------------------------------------------------------------------------
  // Die Blätter
  // ---------------------------------------------------------------------------
  /*
   * Ein Blatt einer Reihe: { nr (die Reihe), id, x, y, r, kreise, halt,
   * groesse, treib, … }. kreise sind seine Teile (ein Seerosenteppich hat
   * mehrere), relativ zu x, y. Ein treibendes Blatt pendelt quer in der
   * Strömung (treib: um a, mit om, ab ph). Betreten wird es zur Zeit
   * betreten; nach halt geht es unter.
   *
   * Das Laub einer Strömung ist kein Blatt einer Reihe: Blatt k eines Bandes
   * s ist zur Zeit t bei laubOrt(s, k, t). Es kommt aus dem Seitenbach (xa) und
   * treibt bis zum Abfluss (xb), dann ist es fort – und wer darauf sitzt,
   * mit ihm.
   */
  // So weit reicht ein Blatt höchstens über seine Mitte hinaus (bachauf
  // und bachab, in cm) – zum Suchen in der Liste, die nach y geordnet ist.
  const AUS_MAX = 14;

  // Wie weit ein treibendes Blatt zur Zeit t von seiner Mitte weg ist.
  const treibX = (p, t) => (p.treib ? p.treib.a * Math.sin(p.treib.om * t + p.treib.ph) : 0);

  // rand: wie weit innerhalb des Randes (null: so weit, dass er darauf
  // stehen kann, randFuer).
  function drin(p, x, y, rand = null, t = state.t) {
    if (p.laub) {
      const q = laubOrt(p.s, p.k, t);
      const dx = x - q.x;
      const dy = y - q.y;
      return dx * dx + dy * dy < (p.s.r - (rand ?? randFuer(p.s.r))) ** 2;
    }
    const px = p.x + treibX(p, t);
    for (const c of p.kreise) {
      const dx = x - px - c.x;
      const dy = y - p.y - c.y;
      const r = c.r - (rand ?? randFuer(c.r));
      if (r > 0 && dx * dx + dy * dy < r * r) return true;
    }
    return false;
  }

  // Die Mitte des Teils eines Blattes, der (x, y) am nächsten ist – dorthin
  // gleitet er nach der Landung.
  function sitzMitte(p, x, y) {
    if (p.laub) return { x: 0, y: 0 };
    let best = p.kreise[0];
    let bestD = Infinity;
    for (const c of p.kreise) {
      const d = (x - p.x - c.x) ** 2 + (y - p.y - c.y) ** 2 - c.r * c.r * 0.6;
      if (d < bestD) { bestD = d; best = c; }
    }
    return { x: best.x, y: best.y };
  }

  // Das erste Blatt der Liste, das über y0 hinaufreichen kann.
  function blattAb(y0) {
    const liste = state.blaetter;
    let lo = 0;
    let hi = liste.length;
    while (lo < hi) {
      const m = (lo + hi) >> 1;
      if (liste[m].y + AUS_MAX < y0) lo = m + 1; else hi = m;
    }
    return lo;
  }

  const laubCache = new Map();
  function laubBlatt(s, k) {
    const key = `${s.nr}:${k}`;
    let p = laubCache.get(key);
    if (!p) {
      p = { laub: true, s, k, nr: -1, saat: hash01(s.nr * 31.7 + k * 7.3) };
      laubCache.set(key, p);
      if (laubCache.size > 400) laubCache.delete(laubCache.keys().next().value);
    }
    return p;
  }

  // Wo Blatt k des Bandes s zur Zeit t treibt (Mitte), und wie weit es auf
  // seinem Weg ist (u: 0 am Zufluss, 1 am Abfluss).
  function laubOrt(s, k, t) {
    const weg = s.tempo * t + s.phase - k * s.abstand;
    const u = weg / s.spanne;
    const x = s.xa + s.richtung * weg;
    const y = s.y + 1.2 * Math.sin(weg * 0.11 + k * 1.7);
    return { x, y, u, vx: s.v, vy: 0 };
  }

  // Welche Laubblätter des Bandes s gerade treiben (zwischen Zufluss und
  // Abfluss, ein Stück darüber hinaus).
  function laubImBand(s, t, rand = 0) {
    const raus = [];
    const w = s.tempo * t + s.phase;
    const k0 = Math.ceil((w - s.spanne - rand) / s.abstand);
    const k1 = Math.floor((w + rand) / s.abstand);
    for (let k = k0; k <= k1; k += 1) raus.push(k);
    return raus;
  }

  // Das Blatt (oder Laub), auf dem (x, y) zur Zeit t liegt – ausser von
  // (dem Blatt, von dem er sich gerade abstösst) und Untergegangenem.
  function blattBei(x, y, t, von = null, rand = null) {
    const liste = state.blaetter;
    for (let i = blattAb(y - 1); i < liste.length; i += 1) {
      const p = liste[i];
      if (p.y - AUS_MAX > y + 1) break;
      if (p === von || versunken(p, t)) continue;
      if (drin(p, x, y, rand, t)) return p;
    }
    for (const s of state.stroemungen) {
      if (Math.abs(y - s.y) > s.r + 3) continue;
      for (const k of laubImBand(s, t, s.r)) {
        const p = laubBlatt(s, k);
        if (p === von) continue;
        const q = laubOrt(s, k, t);
        if (q.u < 0 || q.u > 1) continue;
        if ((x - q.x) ** 2 + (y - q.y) ** 2 < (s.r - (rand ?? randFuer(s.r))) ** 2) return p;
      }
    }
    return null;
  }

  const versunken = (p, t) => !p.laub && p.betreten !== null && t >= p.betreten + p.halt;

  // Wie sehr ein Blatt schon sinkt (0 bis 1): in seiner letzten Zeit, bis
  // höchstens 0,7 s vor dem Untergehen.
  const sinkDauer = (p) => Math.min(0.7, 0.45 * p.halt);
  function sinktBei(p, t) {
    if (p.laub || p.betreten === null) return 0;
    const d = sinkDauer(p);
    return clamp((t - (p.betreten + p.halt - d)) / d, 0, 1);
  }
  // Wie viel von seiner Zeit einem betretenen Blatt noch bleibt (1 bis 0).
  const restBei = (p, t) => (p.laub || p.betreten === null ? 1 : clamp(1 - (t - p.betreten) / p.halt, 0, 1));

  // ---------------------------------------------------------------------------
  // Der Wasserläufer: Schlag und Schritt
  // ---------------------------------------------------------------------------
  /*
   * Ein Schritt der Physik, für das Spiel und für jede Vorausrechnung
   * (Autopilot, Fenster beim Bau der Reihen) derselbe. L ist der Wasserläufer, t die
   * Zeit zu Beginn des Schritts, h seine Länge. Was geschieht, meldet er an
   * melde(art, was) – die Vorausrechnung bricht dort ab.
   */
  function schritt(L, t, h, melde) {
    const t1 = t + h;
    if (L.sitz) {
      const p = L.sitz;
      const ort = blattOrt(p, t1);
      const k = Math.exp(-h / SITZ_ZEIT);
      L.ox = L.mx + (L.ox - L.mx) * k;
      L.oy = L.my + (L.oy - L.my) * k;
      L.x = ort.x + L.ox;
      L.y = ort.y + L.oy;
      L.vx = ort.vx;
      L.vy = ort.vy;
      if (p.laub) {
        if (ort.u > 1) melde("stroemung", p);
      } else if (versunken(p, t1)) {
        melde("blatt", p);
      }
      return;
    }
    const p = blattBei(L.x, L.y, t, L.von);
    if (p) {
      const ort = blattOrt(p, t);
      let rx = L.vx - ort.vx;
      let ry = L.vy - ort.vy;
      const k = Math.exp(-h / (p.laub ? TAU_L : TAU_B));
      rx *= k;
      ry *= k;
      const v = Math.hypot(rx, ry);
      const weniger = v > 1e-9 ? Math.max(0, v - (p.laub ? MU_L : MU_B) * h) / v : 0;
      rx *= weniger;
      ry *= weniger;
      L.vx = ort.vx + rx;
      L.vy = ort.vy + ry;
      L.x += L.vx * h;
      L.y += L.vy * h;
      if (Math.hypot(rx, ry) < LANDEN_V) {
        L.sitz = p;
        L.von = null;
        const jetzt = blattOrt(p, t1);
        L.ox = L.x - jetzt.x;
        L.oy = L.y - jetzt.y;
        const m = sitzMitte(p, L.x, L.y);
        L.mx = m.x;
        L.my = m.y;
        // Wie lange er zuletzt auf offenem Wasser war (für den Autopiloten).
        L.nassVor = L.nass;
        L.nass = 0;
        melde("landen", p);
      }
      return;
    }
    const u = stroemungBei(L.x, L.y);
    let rx = L.vx - u.x;
    let ry = L.vy - u.y;
    const k = Math.exp(-h / TAU_W);
    rx *= k;
    ry *= k;
    const v = Math.hypot(rx, ry);
    const weniger = v > 1e-9 ? Math.max(0, v - MU_W * h) / v : 0;
    L.vx = u.x + rx * weniger;
    L.vy = u.y + ry * weniger;
    L.x += L.vx * h;
    L.y += L.vy * h;
    L.nass += h;
    // Das Ufer: Dort bleibt er hängen.
    const m = mitteBei(L.y);
    const hb = halbBei(L.y) - 1.5;
    if (L.x < m - hb) { L.x = m - hb; if (L.vx < 0) L.vx = 0; }
    if (L.x > m + hb) { L.x = m + hb; if (L.vx > 0) L.vx = 0; }
    if (L.von && !drin(L.von, L.x, L.y, -0.5, t1)) L.von = null;
    // Zu schwach geschleudert, und noch mitten auf dem Blatt: Es trägt ihn
    // wieder (im nächsten Schritt landet er darauf).
    if (L.von && Math.abs(L.vx) + Math.abs(L.vy) < LANDEN_V && drin(L.von, L.x, L.y, null, t1)) L.von = null;
    // Auf dem Rand eines Blattes zur Ruhe gekommen (nicht weit genug
    // darauf): Er rutscht ab, ins Wasser.
    if (Math.abs(L.vx) + Math.abs(L.vy) < 4) {
      const q = blattBei(L.x, L.y, t1, null, 0);
      if (q && !q.laub) {
        const ort = blattOrt(q, t1);
        let c = q.kreise[0];
        let best = Infinity;
        for (const k2 of q.kreise) {
          const d2 = (L.x - ort.x - k2.x) ** 2 + (L.y - ort.y - k2.y) ** 2 - k2.r * k2.r;
          if (d2 < best) { best = d2; c = k2; }
        }
        const dx = L.x - ort.x - c.x;
        const dy = L.y - ort.y - c.y;
        const d = Math.hypot(dx, dy) || 1;
        L.vx += (dx / d) * 9;
        L.vy += (dy / d) * 9;
      }
    }
    // Fort mit der Strömung? Und der Hecht.
    for (const s of state.stroemungen) {
      if (Math.abs(L.y - s.y) > s.halb + 2) continue;
      if ((L.x - s.xb) * s.richtung > 0) melde("stroemung", s);
    }
    for (const hg of state.hechte) {
      if (Math.abs(L.y - hg.cy) > hg.ry + 40) continue;
      const kopf = hechtOrt(hg, t1).kopf;
      const r = R_HECHT + hechtRand;
      if ((L.x - kopf.x) ** 2 + (L.y - kopf.y) ** 2 < r * r) melde("hecht", hg);
    }
  }

  function blattOrt(p, t) {
    if (p.laub) return laubOrt(p.s, p.k, t);
    if (p.treib) {
      const q = p.treib;
      const a = q.om * t + q.ph;
      return { x: p.x + q.a * Math.sin(a), y: p.y, vx: q.a * q.om * Math.cos(a), vy: 0, u: 0 };
    }
    return { x: p.x, y: p.y, vx: 0, vy: 0, u: 0 };
  }

  // Ein Ruderschlag: in Richtung w (in der Welt), mit der Stärke st (0 bis
  // 1). Er schaut danach dorthin.
  function schlag(L, t, w, st) {
    if (L.sitz) {
      const ort = blattOrt(L.sitz, t);
      L.vx = ort.vx;
      L.vy = ort.vy;
      L.von = L.sitz;
      L.sitz = null;
    }
    const j = jVon(st);
    L.w = w;
    L.vx += j * Math.cos(w);
    L.vy += j * Math.sin(w);
  }

  const kopie = (L) => ({ ...L });

  // Beim Planen des Autopiloten hält er Abstand zum Hecht (sonst 0).
  let hechtRand = 0;

  // Rechnet voraus: Was geschieht, wenn er zur Zeit t0 in Lage L ist und
  // die Schläge schlaege ([{ t, w, st }]) macht? Bis er landet (auf einem
  // anderen Blatt als dem, auf dem er sitzt), stirbt oder bis tBis. Gröber
  // als das Spiel (dt), aber mit derselben Physik.
  function vorausrechnen(L0, t0, schlaege, tBis, dt = 1 / 120) {
    const L = kopie(L0);
    let t = t0;
    let ergebnis = null;
    const melde = (art, was) => {
      if (ergebnis) return;
      if (art === "landen") ergebnis = { art, blatt: was, t: t + dt, L };
      else ergebnis = { art, was, t: t + dt, L };
    };
    let i = 0;
    while (t < tBis && !ergebnis) {
      while (i < schlaege.length && schlaege[i].t <= t + 1e-9) { const s = schlaege[i]; schlag(L, t, s.w, s.st); i += 1; }
      // Bis zum nächsten Schlag genau, sonst im Takt.
      const h = i < schlaege.length ? Math.min(dt, Math.max(1e-4, schlaege[i].t - t)) : dt;
      schritt(L, t, h, melde);
      t += h;
      if (i >= schlaege.length && !L.sitz && Math.abs(L.vx) + Math.abs(L.vy) < 3 && Math.abs(stroemungBei(L.x, L.y).x) < 1) break;
    }
    return ergebnis || { art: "offen", t, L };
  }

  // ---------------------------------------------------------------------------
  // Die Welt: der Weg zuerst, Reihe um Reihe
  // ---------------------------------------------------------------------------
  /*
   * Reihe n liegt ein Stück über Reihe n − 1: zwei oder drei Blätter quer
   * über den Bach – gross, mittel, klein. Ein grosses ist leicht zu treffen,
   * sinkt aber schneller; ein kleines ist schwer zu treffen und hält dafür
   * länger (haltBei). Ab Reihe TREIB_AB pendelt manchmal eines in der
   * Strömung hin und her.
   *
   * Dann wird nachgerechnet (fensterVon): Von jedem Blatt der vorigen Reihe
   * aus – aus der Mitte, aus dem Stand, ein treibendes von beiden Enden und
   * aus der Mitte seines Weges – muss mindestens ein stilles Blatt der neuen
   * Reihe mit Spielraum zu treffen sein: um spielraumWBei(n) daneben in der
   * Richtung und um spielraumSBei(n) in der Stärke, auch beides zugleich.
   * Sonst wird die Reihe neu gelegt, enger und mit grösseren Blättern.
   *
   * Jede achte Reihe ist besonders, im Wechsel:
   *
   *   stroemung  (8., 24., 40.) Ein Band quer über den Bach, in dem das
   *              Wasser zur Seite reisst; darauf treibt Laub. Darüber ein
   *              Seerosenteppich, fast so breit wie der Bach.
   *   hecht      (16., 32., 48.) Die Hechtgrube: Der Teppich liegt so weit,
   *              dass ein Schlag nicht reicht – zwei Schleuderschläge, der
   *              zweite im Gleiten. Ein Hecht zieht seine Kreise quer über
   *              den Weg.
   *
   * Die Reihe davor hält länger: Dort wartet man auf Laub oder darauf,
   * dass der Hecht vorbeizieht.
   *
   * Immer gleich viele Zahlen ziehen, was auch geschieht: Die Welt soll an
   * der Saat hängen, nicht an den Zweigen dieser Funktion.
   */
  const TREIB_AB = 6;
  const LUECKE = 3.5;              // so viel Wasser mindestens zwischen zwei Blättern einer Reihe
  const GROESSEN = ["gross", "mittel", "klein"];
  const DREIER = [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]];
  const ZWEIER = [[0, 2], [2, 0], [1, 2], [2, 1], [0, 1], [1, 0]];

  function blattNeu(nr, x, y, r, z, wahl = {}) {
    const p = {
      nr, id: state.blattZahl, x, y, r, kreise: [{ x: 0, y: 0, r }], halt: 2, betreten: null,
      art: "blatt", groesse: "mittel", treib: null, bluete: 0, kerbe: z * TAU, saat: z, ausdehnung: r, ...wahl,
    };
    state.blattZahl += 1;
    p.ausdehnung = Math.max(...p.kreise.map((c) => Math.abs(c.y) + c.r));
    return p;
  }

  function startBlatt() {
    const p = blattNeu(0, mitteBei(0), 0, 12, 0.37, { art: "start", groesse: "gross", halt: 3.2 });
    p.bluete = 1;
    return p;
  }

  // Wie weit ein Schlag mit j (cm/s) aus dem Stand auf stillem Wasser
  // trägt, und welche Stärke ungefähr d weit trägt – wenn er schon mit v0
  // in diese Richtung unterwegs ist.
  const weiteVon = (j) => TAU_W * j - MU_W * TAU_W * TAU_W * Math.log(1 + j / (MU_W * TAU_W));
  function staerkeFuer(d, v0 = 0) {
    let lo = 0;
    let hi = 1;
    for (let i = 0; i < 12; i += 1) {
      const m = (lo + hi) / 2;
      if (weiteVon(Math.max(0, jVon(m) + v0)) < d) lo = m; else hi = m;
    }
    return (lo + hi) / 2;
  }

  // Die Richtung zum nächsten Teil von B zur Zeit t, wie weit dessen Mitte
  // ist und wie gross er ist.
  function richtungZu(L, B, t) {
    let best = null;
    const ort = blattOrt(B, t);
    for (const c of B.laub ? [{ x: 0, y: 0, r: B.s.r }] : B.kreise) {
      const dx = ort.x + c.x - L.x;
      const dy = ort.y + c.y - L.y;
      const d = Math.hypot(dx, dy);
      if (!best || d - c.r < best.d - best.r) best = { d, r: c.r, w: Math.atan2(dy, dx) };
    }
    return best;
  }

  // Das Fenster von L (zur Zeit t) nach B: Mit welcher Richtung und Stärke
  // landet ein Schlag auf B? Gesucht wird zuerst die Stärke – in Richtung
  // w0, sonst zur Mitte des nächsten Teils von B –, dann mit der mittleren
  // Stärke die Richtung. Gibt die Mitte des Fensters und seine halben
  // Breiten (dw in rad, ds in Stärke) zurück, oder null. passt(e): ob das
  // Ergebnis e der Vorausrechnung zählt (sonst: gelandet auf B).
  function fensterVon(L, t, B, { passt = null, w0 = null, d0 = null, dt = 1 / 90, bis = 1.8 } = {}) {
    const gut = passt || ((e) => e.art === "landen" && e.blatt === B);
    const trifft = (w, st) => gut(vorausrechnen(L, t, [{ t, w, st }], t + bis, dt), t);
    const r = richtungZu(L, B, t);
    const ziel = w0 ?? r.w;
    const d = d0 ?? r.d;
    // Wer schon unterwegs ist (im Gleiten, auf treibendem Laub), dem trägt
    // das mit: Die Richtung des Schlags gleicht es aus, die Stärke rechnet
    // es mit ein.
    const v = L.sitz ? blattOrt(L.sitz, t) : L;
    const ex = Math.cos(ziel);
    const ey = Math.sin(ziel);
    const vl = v.vx * ex + v.vy * ey;
    const st0 = staerkeFuer(d, vl);
    let w = ziel;
    const vq = Math.hypot(v.vx, v.vy);
    if (vq > 0.5) {
      const j = jVon(st0);
      const lam = vl + Math.sqrt(Math.max(0, vl * vl - vq * vq + j * j));
      w = Math.atan2(lam * ey - v.vy, lam * ex - v.vx);
    }
    let mitte = null;
    for (let i = 0; i <= 20 && mitte === null; i += 1) {
      const s = st0 + (i % 2 ? 1 : -1) * Math.ceil(i / 2) * 0.05;
      if (s >= 0 && s <= 1 && trifft(w, s)) mitte = s;
    }
    // Notfalls auch etwas daneben gezielt.
    for (let i = 1; i <= 6 && mitte === null; i += 1) {
      const dw = (i % 2 ? 1 : -1) * Math.ceil(i / 2) * 0.12;
      for (const s of [st0 - 0.1, st0, st0 + 0.1]) {
        if (s >= 0 && s <= 1 && trifft(ziel + dw, s)) { mitte = s; w = ziel + dw; break; }
      }
    }
    if (mitte === null) return null;
    // Die Kante zwischen innen (trifft) und aussen.
    const kante = (innen, aussen, pruef) => {
      if (pruef(aussen)) return aussen;
      for (let i = 0; i < 5; i += 1) {
        const m = (innen + aussen) / 2;
        if (pruef(m)) innen = m; else aussen = m;
      }
      return innen;
    };
    const sLo = kante(mitte, Math.max(0, mitte - 0.45), (s) => trifft(w, s));
    const sHi = kante(mitte, Math.min(1, mitte + 0.45), (s) => trifft(w, s));
    let st = (sLo + sHi) / 2;
    if (!trifft(w, st)) st = mitte;
    const wA = kante(0, -0.45, (x) => trifft(w + x, st));
    const wB = kante(0, 0.45, (x) => trifft(w + x, st));
    return { w: w + (wA + wB) / 2, st, dw: (wB - wA) / 2, ds: (sHi - sLo) / 2, trifft };
  }

  // Reicht das Fenster? Mindestens aw breit in der Richtung und as in der
  // Stärke – auch schräg: um sieben Zehntel von beidem zugleich daneben.
  function fensterReicht(L, t, B, aw, as, wahl = {}) {
    const f = fensterVon(L, t, B, wahl);
    if (!f || f.dw < aw || f.ds < as) return null;
    for (const [a, b] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      if (!f.trifft(f.w + 0.7 * aw * a, clamp(f.st + 0.7 * as * b, 0, 1))) return null;
    }
    return f;
  }

  // Von wo aus auf einem Blatt geschleudert wird: aus der Mitte jedes
  // seiner Teile, aus dem Stand – ein treibendes an beiden Enden seines
  // Weges und in der Mitte, wo es am schnellsten ist.
  function abfahrten(p) {
    const raus = [];
    const zeiten = p.treib ? [-Math.PI / 2, 0, Math.PI / 2].map((a) => ((((a - p.treib.ph) % TAU) + TAU) % TAU) / p.treib.om) : [0];
    for (const t of zeiten) {
      const ort = blattOrt(p, t);
      for (const c of p.kreise) {
        raus.push({ t, L: { x: ort.x + c.x, y: ort.y + c.y, vx: ort.vx, vy: ort.vy, w: Math.PI / 2, sitz: p, von: null, nass: 0, ox: c.x, oy: c.y, mx: c.x, my: c.y } });
      }
    }
    return raus;
  }

  // Eine gewöhnliche Reihe: legen, nachrechnen, notfalls neu legen. Ein
  // Generator: Nach jedem nachgerechneten Start gibt er ab (yield) – so
  // verteilt sich das Rechnen über mehrere Bilder (planBis).
  function* reiheLegen(n, vorige, z, vorBesonders) {
    const k = schwere(n);
    const R = radienBei(n);
    const aw = spielraumWBei(n);
    const as = spielraumSBei(n);
    const allowance = geduldBei(n) + warnungBei(n) - 0.08;
    const passtFuer = (B) => (e) => e.art === "landen" && e.blatt === B && e.L.nassVor < allowance;
    const starts = vorige.blaetter.flatMap((p) => abfahrten(p));
    let neu = null;
    let fehlt = 0;
    for (let versuch = 0; versuch < 7; versuch += 1) {
      const zz = versuch === 0 ? (i) => z[i] : (i) => hash01(z[19] * 7919 + versuch * 31.7 + i * 7.13);
      const groesser = 1 + 0.07 * versuch;
      const y = vorige.y + reihenAbstandBei(n) * (1 - 0.06 * versuch) + (zz(0) - 0.5) * 4;
      const m = mitteBei(y);
      const h = halbBei(y) - 2.5;
      // Drei, wenn sie Platz haben – sonst zwei.
      const radien = (folge) => folge.map((gi, i) => R[GROESSEN[gi]] * (1 + (zz(2 + i) - 0.5) * 0.14) * groesser);
      let folge = DREIER[Math.floor(zz(1) * 6) % 6];
      let r = radien(folge);
      const summe = (rr) => rr.reduce((a, b) => a + 2 * b, 0) + LUECKE * (rr.length - 1);
      if (zz(5) > 0.8 || summe(r) > 2 * h - 3) {
        folge = ZWEIER[Math.floor(zz(1) * 6) % 6];
        r = radien(folge);
      }
      const zahl = folge.length;
      if (summe(r) > 2 * h) {
        const f = (2 * h - LUECKE * (zahl - 1)) / (summe(r) - LUECKE * (zahl - 1));
        r = r.map((x) => x * f);
      }
      // Eines pendelt in der Strömung – wenn Platz ist.
      let treibI = -1;
      let treibA = 0;
      if (n >= TREIB_AB && !vorBesonders && zz(6) < lerp(0.25, 0.5, k)) {
        treibI = Math.floor(zz(7) * zahl) % zahl;
        treibA = lerp(3, 6.5, zz(8));
        if (summe(r) + 2 * treibA > 2 * h) { treibI = -1; treibA = 0; }
      }
      const breit = r.map((ri, i) => 2 * ri + (i === treibI ? 2 * treibA : 0));
      const frei = Math.max(0, 2 * h - breit.reduce((a, b) => a + b, 0) - LUECKE * (zahl - 1));
      const gew = [];
      for (let i = 0; i <= zahl; i += 1) gew.push(0.25 + zz(9 + i));
      const gs = gew.reduce((a, b) => a + b, 0);
      let x = m - h;
      neu = [];
      for (let i = 0; i < zahl; i += 1) {
        x += (frei * gew[i]) / gs;
        const p = blattNeu(n, x + breit[i] / 2, y + (zz(13 + i) - 0.5) * 5, r[i], zz(16 + i), { groesse: GROESSEN[folge[i]] });
        x += breit[i] + LUECKE;
        if (i === treibI) p.treib = { a: treibA, om: TAU / lerp(4.5, 7, zz(20)), ph: zz(21) * TAU };
        p.halt = haltBei(n, p.r);
        // Nicht zu nah an die vorige Reihe.
        const pa = p.treib ? p.treib.a : 0;
        for (const q of vorige.blaetter) {
          const qa = q.treib ? q.treib.a : 0;
          for (const c of q.kreise) {
            const dx = Math.max(0, Math.abs(p.x - q.x - c.x) - pa - qa);
            const noetig = p.r + c.r + 3;
            if (dx < noetig) p.y = Math.max(p.y, q.y + c.y + Math.sqrt(noetig * noetig - dx * dx));
          }
        }
        neu.push(p);
      }
      neu.sort((a, b) => a.y - b.y);
      // Nachrechnen: von jedem Start aus mindestens ein stilles Blatt. Die
      // neuen Blätter stehen nur dafür in der Liste, nie über ein yield.
      fehlt = 0;
      for (const s of starts) {
        yield;
        const ziele = neu.filter((B) => !B.treib).sort((a, b) => Math.hypot(a.x - s.L.x, a.y - s.L.y) - 1.5 * a.r - (Math.hypot(b.x - s.L.x, b.y - s.L.y) - 1.5 * b.r));
        neu.forEach((p) => state.blaetter.push(p));
        if (!ziele.some((B) => fensterReicht(s.L, s.t, B, aw, as, { passt: passtFuer(B), bis: 1.5 }))) fehlt += 1;
        state.blaetter.length -= neu.length;
        if (fehlt) break;
      }
      if (!fehlt) return { nr: n, y, blaetter: neu, versuche: versuch + 1 };
    }
    // Darf nicht vorkommen (die Prüfung zählt mit).
    state.planFehler += 1;
    return { nr: n, y: neu.reduce((a, p) => a + p.y, 0) / neu.length, blaetter: neu, versuche: 8 };
  }

  // Wie viel länger die Reihe vor einem besonderen Abschnitt hält.
  const besondersHalt = (art) => (art === "stroemung" ? 2.4 : 3.0);

  // Die Strömung: ein Band über der vorigen Reihe, darin Laub, darüber ein
  // Teppich.
  function stroemungBauen(n, vorige, z) {
    const k = schwere(n);
    const zahl = state.stroemungen.length;
    const r = lerp(8, 6.8, k);
    const halb = r + 3.5;
    const oben = Math.max(...vorige.blaetter.map((p) => p.y + p.ausdehnung));
    const y = oben + 7 + halb;
    const m = mitteBei(y);
    const hb = halbBei(y);
    const richtung = z[8] < 0.5 ? 1 : -1;
    const tempo = lerp(11, 18, k) + 1.5 * Math.min(zahl, 3);
    const abstand = lerp(25, 31, k) + 3 * z[9];
    const xa = m - richtung * (hb + 6);
    const xb = m + richtung * (hb + 2);
    const spanne = Math.abs(xb - xa);
    const s = { nr: zahl, y, halb, r, richtung, tempo, v: richtung * tempo, abstand, xa, xb, spanne, phase: z[10] * abstand, abschnitt: n };
    state.stroemungen.push(s);
    // Der Teppich: vier Blätter quer, knapp über dem Band.
    const yc = y + halb + 6 + 7.5;
    const breite = halbBei(yc) - 7;
    const kreise = [];
    for (let i = 0; i < 4; i += 1) {
      const u = (i / 3) * 2 - 1;
      kreise.push({ x: u * breite * 0.78, y: Math.sin(i * 2.1 + z[11] * 6) * 2.2, r: lerp(9, 8, k) + (i % 2) * 1.2 });
    }
    const B = blattNeu(n, mitteBei(yc), yc, 9, z[5], { art: "teppich", groesse: "gross", kreise });
    B.halt = haltBei(n, radienBei(n).mittel) + 0.6;
    zonenNeu(n, y);
    return { nr: n, y: yc, blaetter: [B] };
  }

  // Die Hechtgrube: tiefes Wasser über der vorigen Reihe, ein Teppich weit
  // darüber – zu weit für einen Schlag.
  function hechtBauen(n, vorige, z) {
    const k = schwere(n);
    const zahl = state.hechte.length;
    const D = lerp(57, 63, k) + 3 * z[8];
    const yc = vorige.y + D;
    const cy = vorige.y + D * 0.5;
    const hg = {
      nr: zahl, cx: mitteBei(cy) + (z[9] - 0.5) * 6, cy, rx: lerp(17, 21, k), ry: lerp(8.5, 10.5, k),
      periode: lerp(4.6, 3.6, k), phase: z[10] * TAU, richtung: z[11] < 0.5 ? 1 : -1, abschnitt: n,
    };
    state.hechte.push(hg);
    const kreise = [
      { x: 0, y: 0, r: 9.5 },
      { x: -13, y: 2.5, r: 8 },
      { x: 13, y: 1.5, r: 8.5 },
    ];
    const B = blattNeu(n, mitteBei(yc), yc, 9.5, z[5], { art: "teppich", groesse: "gross", kreise });
    B.halt = haltBei(n, radienBei(n).mittel) + 0.6;
    zonenNeu(n, cy);
    return { nr: n, y: yc, blaetter: [B] };
  }

  // Ein besonderer Abschnitt beginnt eine neue Welt.
  function zonenNeu(n, y) {
    const w = Math.min(WELTEN - 1, Math.floor(n / 8));
    if (w > (state.zonen[state.zonen.length - 1]?.w ?? 0)) state.zonen.push({ w, y });
    bachMerk.clear();
  }

  // Wo der Hecht zur Zeit t ist: der Kopf, die Richtung, der Leib (vier
  // Punkte von vorn nach hinten).
  function hechtOrt(hg, t) {
    const a = hg.phase + (hg.richtung * TAU * t) / hg.periode;
    const x = hg.cx + hg.rx * Math.cos(a);
    const y = hg.cy + hg.ry * Math.sin(a);
    const vx = -hg.rx * Math.sin(a) * hg.richtung;
    const vy = hg.ry * Math.cos(a) * hg.richtung;
    const w = Math.atan2(vy, vx);
    return { kopf: { x: x + Math.cos(w) * 8, y: y + Math.sin(w) * 8 }, x, y, w, a };
  }

  const besondersBei = (n) => (n > 0 && n % 8 === 0 ? ((n / 8) % 2 === 1 ? "stroemung" : "hecht") : "");

  function* reiheBauen() {
    const n = state.reihen.length;
    const z = [];
    for (let i = 0; i < 24; i += 1) z.push(zufall.zahl());
    const vorige = state.reihen[n - 1];
    const besonders = besondersBei(n);
    const vorBesonders = besondersBei(n + 1);
    const reihe = besonders === "stroemung" ? stroemungBauen(n, vorige, z)
      : besonders === "hecht" ? hechtBauen(n, vorige, z)
        : yield* reiheLegen(n, vorige, z, vorBesonders);
    reihe.besonders = besonders;
    reihe.blaetter.forEach((p, i) => {
      if (vorBesonders) p.halt += besondersHalt(vorBesonders);
      // Eine Blüte auf manchen Blättern, im Teich öfter.
      const b = hash01(z[22] * 977 + i * 3.7);
      p.bluete = b < nachWelt(p.y, [0.3, 0.12, 0.2, 0.15, 0.25]) ? 1 + (hash01(b * 51 + i) < 0.5 ? 1 : 0) : 0;
      state.blaetter.push(p);
    });
    state.reihen.push(reihe);
  }

  // Die Welt steht bis y – immer ein Stück über das Bild hinaus. Im Spiel
  // rechnet sie je Bild höchstens budget Millisekunden daran (und macht im
  // nächsten weiter); ohne budget, bis sie steht.
  let bauer = null;
  function planBis(y, budget = Infinity) {
    const start = performance.now();
    for (;;) {
      const letzt = state.reihen[state.reihen.length - 1];
      if (!bauer && letzt && letzt.y > y) return;
      if (performance.now() - start > budget) return;
      if (!bauer) bauer = reiheBauen();
      let r = bauer.next();
      while (!r.done && performance.now() - start < budget) r = bauer.next();
      if (!r.done) return;
      bauer = null;
    }
  }

  function weltNeu() {
    state.blattZahl = 0;
    state.stroemungen = [];
    state.hechte = [];
    state.zonen = [{ w: 0, y: -1e9 }];
    state.planFehler = 0;
    laubCache.clear();
    bachMerk.clear();
    state.bach = { p1: zufall.zahl() * TAU, p2: zufall.zahl() * TAU, p3: zufall.zahl() };
    const p0 = startBlatt();
    state.blaetter = [p0];
    state.reihen = [{ nr: 0, y: 0, blaetter: [p0], besonders: "" }];
    bauer = null;
    planBis(440);
  }

  // Die Welt als Text – für die Prüfung, dass in einem Turnier und beim
  // Zuschauen alle dieselbe bekommen.
  function kursText(bis = 30) {
    while (state.reihen.length <= bis) planBis(state.reihen[state.reihen.length - 1].y + 1);
    const b = state.reihen.slice(0, bis + 1).map((q) => q.blaetter.map((p) => `${p.nr}:${p.x.toFixed(1)},${p.y.toFixed(1)}/${p.r.toFixed(1)}h${p.halt.toFixed(2)}${p.art[0]}${p.treib ? `~${p.treib.a.toFixed(1)}` : ""}`).join(";"));
    const s = state.stroemungen.map((q) => `s${q.y.toFixed(1)}v${q.v.toFixed(1)}a${q.abstand.toFixed(1)}p${q.phase.toFixed(1)}`);
    const h = state.hechte.map((q) => `h${q.cx.toFixed(1)},${q.cy.toFixed(1)}p${q.periode.toFixed(2)}`);
    return `${b.join(" ")} | ${s.join(" ")} | ${h.join(" ")} | ${state.zonen.map((zz) => `${zz.w}@${Math.round(zz.y)}`).join(",")}`;
  }

  // ---------------------------------------------------------------------------
  // Der Autopilot
  // ---------------------------------------------------------------------------
  /*
   * Er spielt wie ein Mensch: Gelandet, schaut er reaktion Sekunden lang
   * (so lange braucht auch das Zielen) und schleudert dann – dorthin, wo
   * das Fenster den meisten Spielraum lässt, und um streuW (Grad) und streuS
   * (Anteil der Stärke) daneben, normalverteilt. Merkt er im Gleiten, dass
   * es nicht reicht, schleudert er nach kürzerer Zeit noch einmal. Gerechnet
   * wird mit derselben Physik wie das Spiel.
   *
   * Ziele: die Blätter der nächsten zwei Reihen; vor einer Strömung Laub
   * (mit genug Weg vor sich), von dort der Teppich. Vor der Hechtgrube ein
   * voller Schlag – aber nur, wenn danach ein zweiter am Hecht vorbei auf
   * den Teppich trägt. Sicher heisst: landen, bevor der Fisch schnappt,
   * nicht in den Hecht, nicht fort mit der Strömung.
   */
  const reiheVon = (L) => (L.sitz && !L.sitz.laub ? L.sitz.nr : state.reihe);

  // Wie lange er auf dem Wasser sein darf, bis der Fisch schnappt – auf
  // dem Weg zu Reihe n.
  function erlaubtNass(n) {
    const imHecht = state.hechte.some((h) => h.abschnitt === n);
    return geduldBei(n) * (imHecht ? HECHT_GEDULD : 1) + warnungBei(n);
  }

  // Taugt die Landung e nach einem Schlag zur Zeit t0 aus L0? vorwaerts:
  // nur auf eine Reihe weiter oben.
  function zielGut(e, L0, t0, vorwaerts = true) {
    if (e.art !== "landen") return false;
    const p = e.blatt;
    const nass = e.L.nassVor ?? (L0.sitz ? 0 : L0.nass) + (e.t - t0);
    if (nass > erlaubtNass(reiheVon(L0) + 1) - 0.08) return false;
    if (p.laub) return !L0.sitz?.laub && laubOrt(p.s, p.k, e.t).u < 0.5;
    if (p.betreten !== null && p.betreten + p.halt - e.t < 0.6) return false;
    return !vorwaerts || p.nr > reiheVon(L0);
  }

  // L von t0 bis t1 fortgeschrieben (mit den Schlägen schlaege) – oder null,
  // wenn er unterwegs umkommt.
  function fortschreiben(L0, t0, t1, schlaege = []) {
    const L = kopie(L0);
    let tot = false;
    const melde = (art) => { if (art !== "landen") tot = true; };
    let t = t0;
    let i = 0;
    while (t < t1 - 1e-9 && !tot) {
      while (i < schlaege.length && schlaege[i].t <= t + 1e-9) { const s = schlaege[i]; schlag(L, t, s.w, s.st); i += 1; }
      const h = Math.min(1 / 120, t1 - t);
      schritt(L, t, h, melde);
      t += h;
    }
    return tot ? null : L;
  }

  // Wohin er von L aus (zur Zeit t) schleudern könnte.
  function kandidaten(L, t, vorwaerts) {
    const n0 = reiheVon(L);
    const raus = [];
    const naechste = state.reihen[n0 + 1];
    if (naechste?.besonders === "stroemung" && !L.sitz?.laub) {
      const s = state.stroemungen.find((q) => q.abschnitt === n0 + 1);
      if (s && L.y < s.y) for (const k of laubImBand(s, t + 0.5, 0)) raus.push(laubBlatt(s, k));
    }
    const liste = state.blaetter;
    for (let i = blattAb(L.y - 55); i < liste.length; i += 1) {
      const p = liste[i];
      if (p.y - AUS_MAX > L.y + 60) break;
      if (p === L.sitz || versunken(p, t) || p.nr > n0 + 2 || (vorwaerts && p.nr <= n0)) continue;
      const r = richtungZu(L, p, t);
      if (r.d - r.r < 50) raus.push(p);
    }
    return raus;
  }

  // Der beste Schlag von L aus, zur Zeit t: das Fenster mit dem meisten
  // Spielraum, gemessen an der eigenen Streuung (sw in rad, ss Anteil).
  function besterSchlag(L, t, { sw, ss, imWasser }) {
    const n0 = reiheVon(L);
    const naechste = state.reihen[n0 + 1];
    const wertVon = (f) => Math.min(f.dw / sw, f.ds / Math.max(ss * f.st, 0.03));
    if (L.sitz && !L.sitz.laub && naechste?.besonders === "hecht") {
      // Ein voller Schlag zum Teppich, und kurz danach ein zweiter.
      const B = naechste.blaetter[0];
      const w = richtungZu(L, B, t).w;
      const t2 = t + Math.max(SCHLAG_PAUSE + 0.01, state.pilotNach || 0.2);
      const L2 = fortschreiben(L, t, t2, [{ t, w, st: 1 }]);
      if (!L2) return null;
      const f = fensterVon(L2, t2, B, { passt: (e) => e.blatt === B && zielGut(e, L, t) });
      return f ? { w, st: 1, dw: f.dw, ds: f.ds, wert: wertVon(f), ziel: B, zweiter: f } : null;
    }
    let best = null;
    for (const B of kandidaten(L, t, !imWasser)) {
      const passt = (e, t0) => e.blatt === B && zielGut(e, L, t0, !imWasser);
      let f = null;
      if (B.laub) {
        const q = laubOrt(B.s, B.k, t + 0.5);
        if (q.u < 0 || q.u > 0.45) continue;
        f = fensterVon(L, t, B, { passt, w0: Math.atan2(q.y - L.y, q.x - L.x), d0: Math.hypot(q.x - L.x, q.y - L.y) });
      } else {
        f = fensterVon(L, t, B, { passt });
      }
      if (!f) continue;
      let wert = wertVon(f);
      if (!B.laub && B.nr >= n0 + 2) wert *= 1.08;
      // Hält es kürzer, als er zum Zielen braucht? Dann lieber nicht.
      if (!B.laub && B.halt < (state.pilotReaktion || 0.3) * 1.3 + 0.1) wert *= 0.3;
      if (!best || wert > best.wert) best = { ...f, wert, ziel: B };
    }
    return best;
  }

  /*
   * Soll er jetzt schleudern? Dann { w, st }, sonst null. zeigen: Er zielt
   * vorher sichtbar (für die Vorführung).
   */
  function pilot({ streuW = 0, streuS = 0, reaktion = 0.3, zeigen = false } = {}) {
    if (state.phase !== "spiel" || state.schritt !== "lauf") return null;
    const L = state.l;
    const jetzt = state.t;
    const normal = () => Math.sqrt(-2 * Math.log(Math.max(1e-9, Math.random()))) * Math.cos(TAU * Math.random());
    const zufaellig = (r) => Math.max(0.1, r * (0.75 + 0.5 * Math.random()));
    const zielZeit = zeigen ? 0.45 : 0;
    const imWasser = !L.sitz;
    state.pilotWasser = Math.max(0.15, reaktion * 0.6);
    state.pilotNach = reaktion * 0.5 + state.pilotWasser;
    state.pilotReaktion = reaktion;
    let p = state.plan;
    if (!p || p.sitz !== L.sitz) {
      // Gerade gelandet (oder abgestossen): Er schaut erst.
      // Im Wasser merkt er erst nach einer Weile, ob es reicht.
      p = { sitz: L.sitz, denkt: jetzt + (imWasser ? reaktion * 0.5 : Math.max(0, zufaellig(reaktion) - zielZeit)), schlag: null, geprueft: -9 };
      state.plan = p;
    }
    if (!p.schlag && jetzt >= p.denkt && jetzt - p.geprueft >= 0.1 - 1e-9) {
      p.geprueft = jetzt;
      const sw = Math.max((streuW * Math.PI) / 180, (2 * Math.PI) / 180);
      const ss = streuS;
      let tRel = jetzt + zielZeit;
      let noetig = true;
      if (imWasser) {
        // Trägt ihn das Gleiten sicher hin? Sonst bald ein Schlag.
        hechtRand = 4;
        const e = vorausrechnen(L, jetzt, [], jetzt + 2.4, 1 / 120);
        hechtRand = 0;
        noetig = !zielGut(e, L, jetzt, false);
        tRel = Math.max(jetzt + zufaellig(state.pilotWasser), state.letzterSchlag + SCHLAG_PAUSE + 0.01, jetzt + Math.max(0, 1 - state.kraft) / KRAFT_ZURUECK);
      }
      if (noetig) {
        const L1 = tRel > jetzt ? fortschreiben(L, jetzt, tRel) : L;
        hechtRand = 4;
        const best = L1 ? besterSchlag(L1, tRel, { sw, ss, imWasser: !L1.sitz }) : null;
        hechtRand = 0;
        // Warten lohnt, wo sich etwas bewegt (Laub, der Hecht, ein
        // treibendes Blatt) – solange das Blatt noch hält.
        const naechste = state.reihen[reiheVon(L) + 1];
        const bewegt = naechste?.besonders || best?.ziel?.treib || best?.ziel?.laub;
        const zeitBleibt = L.sitz && !L.sitz.laub && L.sitz.betreten + L.sitz.halt - tRel > reaktion + 0.35;
        const warten = !imWasser && (!best || best.wert < 1.15) && bewegt && zeitBleibt;
        if (best && !warten) {
          p.schlag = {
            t: tRel,
            w: best.w + normal() * (streuW * Math.PI) / 180,
            st: clamp(best.st * (1 + normal() * streuS), 0, 1),
            ziel: best.ziel,
            wert: best.wert,
            ab: jetzt,
          };
        }
      }
    }
    const s = p.schlag;
    // Ging der Schlag nicht (keine Kraft), plant er neu.
    if (s && s.fertig && L.sitz && jetzt - s.t > 0.05) p.schlag = null;
    if (s && !s.fertig) {
      if (zeigen) state.zug = { w: s.w, st: s.st * clamp((jetzt - s.ab) / Math.max(0.01, s.t - s.ab), 0, 1), aktiv: true, quelle: "pilot" };
      if (jetzt >= s.t - 1e-9) {
        s.fertig = true;
        if (zeigen) state.zug = null;
        // Im Wasser darf er danach wieder planen.
        if (imWasser) { p.schlag = null; p.geprueft = jetzt; }
        return { w: s.w, st: s.st };
      }
    }
    return null;
  }

  // ---------------------------------------------------------------------------
  // Die Fläche
  // ---------------------------------------------------------------------------
  function buildPlatz() {
    const platz = shell.el("div", "wa-platz");
    feld = shell.el("div", "wa-feld");
    canvas = document.createElement("canvas");
    canvas.className = "wa-canvas";
    canvas.setAttribute("aria-hidden", "true");
    feld.append(canvas);
    g = canvas.getContext("2d");

    // Der Hinweis vor dem ersten Schlag: aufsetzen, zurückziehen, loslassen
    // – und ein Pfeil zeigt, wohin es dann geht.
    const tipp = shell.el("span", "wa-tipp");
    tipp.setAttribute("aria-hidden", "true");
    const ns = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(ns, "svg");
    svg.setAttribute("viewBox", "0 0 64 100");
    const teil = (art, klasse, werte) => {
      const k = document.createElementNS(ns, art);
      if (klasse) k.setAttribute("class", klasse);
      Object.entries(werte).forEach(([a2, v]) => k.setAttribute(a2, String(v)));
      svg.append(k);
      return k;
    };
    teil("path", "wa-zug-pfeil", { d: "M20 16 L32 4 L44 16", fill: "none", stroke: "#ffffff", "stroke-width": 5, "stroke-linecap": "round", "stroke-linejoin": "round" });
    teil("circle", "", { cx: 32, cy: 34, r: 10, fill: "none", stroke: "#ffffff", "stroke-width": 3, opacity: 0.75 });
    teil("rect", "wa-zug-band", { x: 30.5, y: 34, width: 3, height: 40, rx: 1.5, fill: "#ffffff" });
    teil("circle", "wa-zug-punkt", { cx: 32, cy: 34, r: 9, fill: "#ffffff" });
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
    const dpr = shellApi.bildpunkte(cssW, cssH, 1.8);
    const frei = Math.min(cssH * 0.3, shell?.frei?.(canvas) || 0);
    if (cssW === view.cssW && cssH === view.cssH && dpr === view.dpr && frei === view.frei) return;
    view.cssW = cssW;
    view.cssH = cssH;
    view.dpr = dpr;
    view.frei = frei;
    view.hochkant = cssH > cssW * 1.1;
    // Der Massstab: hochkant gibt die Breite FELD_SICHT vor, quer die Höhe –
    // über ihm sieht man auf jedem Gerät gleich weit voraus. Ein Zentimeter
    // ist eine Zahl von Bildpunkten, die sich für die Kacheln gut teilen
    // lässt (auf Viertel gerundet).
    const s0 = Math.min(cssW / FELD_SICHT, (cssH - frei - 8) / (SICHT_OBEN + SICHT_UNTEN));
    view.s = Math.max(1, Math.round(s0 * dpr * 4) / 4) / dpr;
    view.ankerY = Math.round(frei + 4 + Math.min(SICHT_OBEN * view.s, 0.7 * (cssH - frei)));
    const pw = Math.round(cssW * dpr);
    const ph = Math.round(cssH * dpr);
    if (canvas.width !== pw) canvas.width = pw;
    if (canvas.height !== ph) canvas.height = ph;
    ebenenNeu();
    tippOrt();
  }

  // Die Ringe des Hinweises: über dem ersten Blatt, auf das er springen soll.
  function tippOrt() {
    if (!tippRinge || !state.l) return;
    tippRinge.style.left = `${Math.round(view.cssW / 2)}px`;
    tippRinge.style.top = `${Math.round(Math.min(view.cssH - 90, view.ankerY + 14 * view.s + 10))}px`;
  }

  // Die Kamera steht auf ganzen Bildpunkten (cxp, cyp): So liegen die
  // vorgemalten Kacheln Punkt auf Punkt. bildX, bildY: von der Welt ins
  // Bild (CSS-Pixel).
  const bildX = (x) => (view.mxp + x * view.S - view.cxp) / view.dpr;
  const bildY = (y) => (view.myp - y * view.S + view.cyp) / view.dpr;

  // ---------------------------------------------------------------------------
  // Malen: die Farben der Welten
  // ---------------------------------------------------------------------------
  /*
   * Jede Welt hat ihre Farben: der Grund im Flachen (sand, kies) und in der
   * Tiefe (tief), die Farbe des Wassers und wie dicht es in der Tiefe ist
   * (wasser, wasserA), die Lichtnetze (kaustik), der Himmel, der sich im
   * Wasser spiegelt (spiegel), das Ufer (gras, erde, moos) und die Blätter.
   * Zwischen zwei Welten werden sie gemischt (weltMix) – auch in den
   * vorgemalten Kacheln, Zeile für Zeile.
   */
  const FARBEN = [
    { // Der Seerosenteich am Nachmittag: klar, warm, sandiger Grund.
      sand: [214, 192, 140], kies: [172, 156, 112], tief: [30, 84, 76], wasser: [30, 98, 92], wasserA: 0.6,
      kaustik: 0.26, kaustikFarbe: [255, 247, 205], spiegel: [214, 236, 244], spiegelA: 0.1,
      gras: [98, 142, 58], grasHell: [164, 196, 88], erde: [128, 104, 66], moos: [92, 128, 50],
      kiesel: [[200, 186, 158], [170, 140, 104], [214, 204, 186], [146, 120, 96], [186, 160, 118], [120, 116, 104]],
      blatt: [64, 122, 46], blattHell: [132, 184, 74], laub: [204, 120, 40], licht: [255, 246, 214], dunkel: 0,
    },
    { // Der Bachlauf zwischen Steinen: kühler, grauer Kies, starke Lichtnetze.
      sand: [196, 186, 160], kies: [148, 144, 130], tief: [38, 76, 82], wasser: [44, 104, 112], wasserA: 0.5,
      kaustik: 0.3, kaustikFarbe: [250, 252, 228], spiegel: [210, 232, 238], spiegelA: 0.08,
      gras: [70, 118, 54], grasHell: [128, 168, 76], erde: [100, 86, 64], moos: [84, 126, 46],
      kiesel: [[176, 172, 160], [140, 134, 124], [196, 190, 176], [118, 112, 104], [162, 146, 122], [104, 110, 108]],
      blatt: [58, 116, 50], blattHell: [120, 176, 76], laub: [214, 150, 50], licht: [255, 250, 226], dunkel: 0.05,
    },
    { // Der Mühlenteich im goldenen Licht: grünlich, tief, warm.
      sand: [186, 156, 100], kies: [150, 124, 82], tief: [30, 56, 36], wasser: [48, 86, 46], wasserA: 0.68,
      kaustik: 0.22, kaustikFarbe: [255, 222, 150], spiegel: [255, 222, 160], spiegelA: 0.12,
      gras: [112, 130, 56], grasHell: [186, 186, 90], erde: [128, 100, 62], moos: [104, 124, 48],
      kiesel: [[184, 160, 120], [150, 120, 84], [204, 184, 150], [126, 102, 78], [170, 140, 96], [112, 100, 84]],
      blatt: [74, 120, 40], blattHell: [160, 184, 74], laub: [218, 132, 40], licht: [255, 226, 160], dunkel: 0.1,
    },
    { // Das Moor in der Dämmerung: dunkles, torfbraunes Wasser, rosa Himmel darin.
      sand: [118, 84, 56], kies: [96, 70, 50], tief: [22, 15, 14], wasser: [40, 24, 24], wasserA: 0.82,
      kaustik: 0.08, kaustikFarbe: [255, 196, 176], spiegel: [226, 156, 170], spiegelA: 0.2,
      gras: [92, 92, 52], grasHell: [150, 140, 80], erde: [84, 62, 44], moos: [128, 82, 54],
      kiesel: [[120, 96, 74], [96, 72, 56], [140, 116, 92], [80, 62, 50], [110, 84, 60], [90, 82, 72]],
      blatt: [62, 96, 46], blattHell: [130, 150, 74], laub: [214, 104, 52], licht: [255, 196, 170], dunkel: 0.45,
    },
    { // Die Quelle in der Nacht: tiefblau, Mondlicht.
      sand: [84, 98, 110], kies: [64, 74, 88], tief: [8, 16, 30], wasser: [12, 28, 52], wasserA: 0.78,
      kaustik: 0.07, kaustikFarbe: [186, 214, 255], spiegel: [104, 132, 186], spiegelA: 0.18,
      gras: [34, 54, 52], grasHell: [70, 98, 92], erde: [40, 44, 46], moos: [40, 66, 58],
      kiesel: [[96, 108, 122], [74, 84, 98], [116, 128, 140], [60, 66, 78], [86, 94, 104], [70, 80, 92]],
      blatt: [36, 76, 58], blattHell: [92, 140, 120], laub: [150, 110, 70], licht: [200, 224, 255], dunkel: 0.78,
    },
  ];

  function farbeBei(y, name) {
    const c = [0, 0, 0];
    weltMix(y).forEach(([w, k]) => {
      const f = FARBEN[w][name];
      c[0] += f[0] * k;
      c[1] += f[1] * k;
      c[2] += f[2] * k;
    });
    return c;
  }

  function zahlBei(y, name) {
    let summe = 0;
    weltMix(y).forEach(([w, k]) => { summe += FARBEN[w][name] * k; });
    return summe;
  }

  // Das Licht kommt von links oben; Schatten fallen nach rechts unten, auf
  // den Grund um so weiter, je tiefer das Wasser ist.
  const SONNE = { x: 0.5, y: -0.6 };
  function schattenVersatz(x, y) {
    const d = clamp(tiefeBei(x, y), 0, 1.4);
    const f = 1.1 + 4.4 * d;
    return { x: SONNE.x * f, y: SONNE.y * f, d };
  }

  // Ein fester Zufall je Stück Welt: Was in einer Zelle liegt, liegt dort
  // immer – über die Grenzen der Kacheln hinweg.
  function zellZufall(j, salz) {
    const saat = Math.floor(state.bach.p3 * 4294967295) >>> 0;
    return wuerfel((saat ^ Math.imul(j + 7777, 2654435761) ^ Math.imul(salz + 13, 40503)) >>> 0);
  }

  // Ein Verlauf über die Höhe einer Kachel, der den Farben der Welten
  // folgt (wo zwei Welten ineinander übergehen, mischt er mit).
  function hochVerlauf(k, kc, farbe, alpha = 1) {
    const v = k.createLinearGradient(0, kc.ya - 2, 0, kc.yb + 2);
    for (let i = 0; i <= 6; i += 1) {
      const y = lerp(kc.ya - 2, kc.yb + 2, i / 6);
      v.addColorStop(i / 6, rgba(farbe(y), typeof alpha === "function" ? alpha(y) : alpha));
    }
    return v;
  }

  function leinwandPx(w, h) {
    const c = document.createElement("canvas");
    c.width = Math.max(2, Math.round(w));
    c.height = Math.max(2, Math.round(h));
    return c;
  }

  // Der Rand des Wassers zittert ein wenig – gemalt, nicht gerechnet.
  const randZitter = (y, seite) => 0.7 * Math.sin(y * 0.61 + seite * 1.9) + 0.45 * Math.sin(y * 1.73 + seite * 0.7);

  // ---------------------------------------------------------------------------
  // Malen: die Kacheln – Grund, Wasser und Ufer, einmal gemalt
  // ---------------------------------------------------------------------------
  /*
   * Die Welt liegt in waagrechten Kacheln von KACHEL_PX Bildpunkten Höhe,
   * so breit wie das Bild und etwas mehr (die Kamera folgt dem Bach quer).
   * Eine Kachel wird in Stufen gemalt, wenige je Bild, bevor sie ins Bild
   * kommt (kachelnVorbereiten): der Grund mit seinen Farben nach der Tiefe,
   * Kiesel und was auf dem Grund liegt, die Farbe des Wassers darüber, das
   * Ufer und seine Pflanzen. Danach wird sie nur noch aufgelegt, Punkt auf
   * Punkt – auf dem iPhone rechnet der Prozessor jede gemalte Fläche.
   *
   * In der Kachel wird in Zentimetern gemalt, y nach oben – wie in der Welt.
   */
  const KACHEL_PX = 256;
  let kacheln = new Map();

  function kachelGeometrie() {
    const S = view.s * view.dpr;
    view.S = S;
    const halb = view.cssW / (2 * view.s) + 26;
    view.kHalbPx = Math.round(halb * S);
    view.kx0 = -view.kHalbPx / S;
    view.kwPx = view.kHalbPx * 2;
    view.khCm = KACHEL_PX / S;
    view.mxp = Math.round((view.cssW * view.dpr) / 2);
    view.myp = Math.round(view.ankerY * view.dpr);
  }

  function kachelNeu(i) {
    const c = leinwandPx(view.kwPx, KACHEL_PX);
    const k = c.getContext("2d");
    const ya = i * view.khCm;
    const yb = ya + view.khCm;
    const S = view.S;
    k.setTransform(S, 0, 0, -S, -view.kx0 * S, yb * S);
    k.lineCap = "round";
    k.lineJoin = "round";
    return { i, c, k, ya, yb, xa: view.kx0, xb: -view.kx0, stufe: 0 };
  }

  const KACHEL_STUFEN = [
    (k, kc) => grundMalen(k, kc),
    (k, kc) => kieselMalen(k, kc),
    (k, kc) => grundDingeMalen(k, kc),
    (k, kc) => saeuleMalen(k, kc),
    (k, kc) => uferBodenMalen(k, kc, -1),
    (k, kc) => uferBodenMalen(k, kc, 1),
    (k, kc) => kanaeleMalen(k, kc),
    (k, kc) => blattSchattenMalen(k, kc),
    (k, kc) => uferPflanzenMalen(k, kc, -1),
    (k, kc) => uferPflanzenMalen(k, kc, 1),
    (k, kc) => laubSchattenMalen(k, kc),
    (k, kc) => treibgutMalen(k, kc),
    (k, kc) => lichtnetzePhasen(kc),
  ];

  // Waagrechte Streifen über eine Kachel, jeder eine ganze Zahl von
  // Bildpunkten hoch und ohne Überlappung (sonst zeichnen sich die Ränder
  // als feine Linien ab): fn(y, hoch) in Zentimetern, von oben nach unten.
  function streifenUeber(kc, fn) {
    const px = Math.max(4, Math.round(1.5 * view.S));
    const hoch = px / view.S;
    for (let i = 0; i * px < KACHEL_PX; i += 1) {
      const yo = kc.yb - i * hoch;
      fn(yo - hoch, hoch);
    }
  }

  function kachelFertig(kc) {
    while (kc.stufe < KACHEL_STUFEN.length) {
      KACHEL_STUFEN[kc.stufe](kc.k, kc);
      kc.stufe += 1;
    }
  }

  function kachelHolen(i) {
    let kc = kacheln.get(i);
    if (!kc) {
      kc = kachelNeu(i);
      kacheln.set(i, kc);
    }
    return kc;
  }

  // Welche Kacheln das Bild gerade braucht (von unten nach oben).
  function kachelBereich(cyp) {
    const H = Math.round(view.cssH * view.dpr);
    const i0 = Math.floor((cyp + view.myp - H) / KACHEL_PX);
    const i1 = Math.floor((cyp + view.myp) / KACHEL_PX);
    return [i0, i1];
  }

  // Vorarbeit: die Kacheln über dem Bild schon malen, Stufe um Stufe, bis
  // das Bild sein Mass an Zeit verbraucht hat. Was weit unter dem Bild
  // liegt, fällt weg.
  function kachelnVorbereiten(budgetMs = 3) {
    const t0 = performance.now();
    const cyp = Math.round(state.camY * view.S);
    const [i0, i1] = kachelBereich(cyp);
    for (const i of [...kacheln.keys()]) if (i < i0 - 1 || i > i1 + 4) kacheln.delete(i);
    for (let i = i1 + 1; i <= i1 + 3; i += 1) {
      const kc = kachelHolen(i);
      while (kc.stufe < KACHEL_STUFEN.length) {
        if (performance.now() - t0 > budgetMs) return;
        KACHEL_STUFEN[kc.stufe](kc.k, kc);
        kc.stufe += 1;
      }
    }
  }

  // Der Grund: Zeile um Zeile ein Verlauf quer über den Bach, vom Sand im
  // Flachen über den Kies in die Tiefe.
  function grundMalen(k, kc) {
    streifenUeber(kc, (y, hoch) => {
      const m = mitteBei(y);
      const h = halbBei(y);
      const sand = farbeBei(y, "sand");
      const kies = farbeBei(y, "kies");
      const tief = farbeBei(y, "tief");
      const x0 = m - h - 3;
      const x1 = m + h + 3;
      const v = k.createLinearGradient(x0, 0, x1, 0);
      for (let i = 0; i <= 12; i += 1) {
        const u = i / 12;
        const x = lerp(x0, x1, u);
        const d = tiefeBei(x, y);
        const c = d < 0.45 ? mix3(sand, kies, d / 0.45) : d < 1 ? mix3(kies, tief, ((d - 0.45) / 0.55) ** 0.9) : mix3(tief, [4, 8, 8], clamp((d - 1) / 0.7, 0, 1));
        v.addColorStop(u, rgb(c));
      }
      k.fillStyle = v;
      k.fillRect(kc.xa, y, kc.xb - kc.xa, hoch);
    });
  }

  // Kiesel: im Flachen gross und viele, in der Tiefe wenige, und dort von
  // der Farbe des Wassers verschluckt. Jeder mit Schatten und Glanz.
  function kieselMalen(k, kc) {
    const ZELLE = 4;
    for (let j = Math.floor((kc.ya - 3) / ZELLE); j <= Math.floor((kc.yb + 3) / ZELLE); j += 1) {
      const rnd = zellZufall(j, 11);
      const yz = j * ZELLE;
      const m = mitteBei(yz + 2);
      const h = halbBei(yz + 2);
      const liste = FARBEN[weltBei(yz)].kiesel;
      const tief = farbeBei(yz, "tief");
      const kiesFarbe = farbeBei(yz, "kies");
      // Feiner Kies: Punkte.
      for (let i = 0; i < 70; i += 1) {
        const u = rnd() * 2 - 1;
        const x = m + u * (h + 1);
        const y = yz + rnd() * ZELLE;
        const d = tiefeBei(x, y);
        const c = mix3(mix3(kiesFarbe, liste[i % liste.length], 0.6), tief, clamp(d * 0.95, 0, 1));
        k.fillStyle = rgba(rnd() < 0.5 ? mix3(c, [255, 255, 255], 0.15) : mix3(c, [0, 0, 0], 0.25), 0.7);
        const r = 0.08 + rnd() * 0.14;
        k.fillRect(x, y, r, r);
      }
      // Kiesel.
      const n = 16;
      for (let i = 0; i < n; i += 1) {
        const a = rnd();
        const u = (a < 0.5 ? -1 : 1) * (1 - rnd() ** 1.7);
        const x = m + u * (h + 1.5);
        const y = yz + rnd() * ZELLE;
        const d = tiefeBei(x, y);
        const rr = rnd();
        if (d > 0.85 && rr < 0.75) continue;
        const r = lerp(1.25, 0.4, clamp(d, 0, 1)) * (0.45 + rnd() * 0.9);
        const w = rnd() * Math.PI;
        const e = 0.6 + rnd() * 0.35;
        const basis = liste[Math.floor(rnd() * liste.length)];
        const c = mix3(basis, tief, clamp(d * 0.9, 0, 0.92));
        k.fillStyle = rgba(mix3(c, [0, 0, 0], 0.55), 0.45);
        k.beginPath();
        k.ellipse(x + r * 0.22, y - r * 0.25, r, r * e, w, 0, TAU);
        k.fill();
        k.fillStyle = rgb(c);
        k.beginPath();
        k.ellipse(x, y, r, r * e, w, 0, TAU);
        k.fill();
        k.fillStyle = rgba(mix3(c, [255, 252, 236], 0.45), 0.55 * (1 - d * 0.7));
        k.beginPath();
        k.ellipse(x - r * 0.28, y + r * 0.22, r * 0.5, r * e * 0.42, w, 0, TAU);
        k.fill();
      }
    }
  }

  // Was sonst auf dem Grund liegt, je nach Welt: versunkenes Laub, Zweige,
  // grosse Steine, Wasserpflanzen, im Moor helle Birkenäste.
  function grundDingeMalen(k, kc) {
    const ZELLE = 14;
    for (let j = Math.floor((kc.ya - 12) / ZELLE); j <= Math.floor((kc.yb + 12) / ZELLE); j += 1) {
      const rnd = zellZufall(j, 23);
      const yz = j * ZELLE + rnd() * ZELLE;
      const w = weltBei(yz);
      const m = mitteBei(yz);
      const h = halbBei(yz);
      const tief = farbeBei(yz, "tief");
      // Versunkene Blätter: zwei bis vier.
      const zahl = 2 + Math.floor(rnd() * 3);
      for (let i = 0; i < zahl; i += 1) {
        const x = m + (rnd() * 2 - 1) * h * 0.9;
        const y = yz + (rnd() - 0.5) * 10;
        const d = clamp(tiefeBei(x, y), 0, 1);
        const c = mix3(w === 3 ? [70, 46, 30] : [120, 84, 42], tief, d * 0.75);
        blattUmriss(k, x, y, rnd() * TAU, 1.4 + rnd() * 1.4, rgb(c), rgba(mix3(c, [0, 0, 0], 0.4), 0.8), 0.55);
      }
      // Ein Zweig.
      if (rnd() < 0.55) {
        const x = m + (rnd() * 2 - 1) * h * 0.8;
        const d = clamp(tiefeBei(x, yz), 0, 1);
        const c = mix3(w === 3 ? [196, 186, 170] : [92, 70, 48], tief, d * 0.8);
        zweigMalen(k, x, yz, rnd() * TAU, 5 + rnd() * 9, rgb(c), rnd);
      }
      // Wasserpflanzen: Büschel, die im Flachen am Grund wachsen.
      if ((w === 0 || w === 2 || w === 4) && rnd() < 0.7) {
        const seite = rnd() < 0.5 ? -1 : 1;
        const x = m + seite * h * (0.55 + rnd() * 0.3);
        const d = clamp(tiefeBei(x, yz), 0, 1);
        const c = mix3(w === 4 ? [40, 90, 80] : [70, 120, 52], tief, d * 0.7);
        for (let i = 0; i < 9; i += 1) {
          const a = Math.PI / 2 + (rnd() - 0.5) * 2.4;
          const l = 2.5 + rnd() * 4;
          k.strokeStyle = rgba(mix3(c, [255, 255, 200], rnd() * 0.25), 0.85);
          k.lineWidth = 0.22;
          k.beginPath();
          k.moveTo(x, yz);
          k.quadraticCurveTo(x + Math.cos(a) * l * 0.5 + (rnd() - 0.5) * 2, yz + Math.sin(a) * l * 0.5, x + Math.cos(a) * l, yz + Math.sin(a) * l);
          k.stroke();
        }
      }
      // Im Bach: grosse, bemooste Steine am Grund.
      if ((w === 1 || w === 4) && rnd() < 0.8) {
        const seite = rnd() < 0.5 ? -1 : 1;
        const x = m + seite * h * (0.2 + rnd() * 0.6);
        const d = clamp(tiefeBei(x, yz), 0, 1);
        const r = 2.4 + rnd() * 2.6;
        steinMalen(k, x, yz, r, mix3(FARBEN[w].kiesel[Math.floor(rnd() * 6)], tief, d * 0.7), rnd, { moos: w === 1 ? 0.25 : 0.1, tief: d });
      }
      // Im Bach: Rippeln im Sand.
      if (w === 1 && rnd() < 0.6) {
        const x0 = m + (rnd() * 2 - 1) * h * 0.4;
        const d = clamp(tiefeBei(x0, yz), 0, 1);
        k.strokeStyle = rgba(mix3([230, 220, 190], tief, d * 0.7), 0.35);
        k.lineWidth = 0.25;
        for (let i = 0; i < 4; i += 1) {
          const yy = yz + i * 1.2;
          k.beginPath();
          for (let x = x0 - 6; x <= x0 + 6; x += 1) k.lineTo(x, yy + Math.sin(x * 0.8 + i) * 0.35);
          k.stroke();
        }
      }
    }
  }

  // Ein Blatt als Umriss: spitz an beiden Enden, mit Mittelrippe.
  function blattUmriss(k, x, y, w, l, farbe, rippe, breit = 0.5) {
    const c = Math.cos(w);
    const s = Math.sin(w);
    const b = l * breit * 0.5;
    k.fillStyle = farbe;
    k.beginPath();
    k.moveTo(x - c * l * 0.5, y - s * l * 0.5);
    k.quadraticCurveTo(x - s * b, y + c * b, x + c * l * 0.5, y + s * l * 0.5);
    k.quadraticCurveTo(x + s * b, y - c * b, x - c * l * 0.5, y - s * l * 0.5);
    k.fill();
    if (rippe) {
      k.strokeStyle = rippe;
      k.lineWidth = Math.max(0.05, l * 0.035);
      k.beginPath();
      k.moveTo(x - c * l * 0.62, y - s * l * 0.62);
      k.lineTo(x + c * l * 0.45, y + s * l * 0.45);
      k.stroke();
    }
  }

  function zweigMalen(k, x, y, w, l, farbe, rnd) {
    k.strokeStyle = farbe;
    k.lineWidth = 0.35;
    let px = x;
    let py = y;
    let a = w;
    k.beginPath();
    k.moveTo(px, py);
    for (let i = 0; i < 5; i += 1) {
      a += (rnd() - 0.5) * 0.5;
      px += Math.cos(a) * l / 5;
      py += Math.sin(a) * l / 5;
      k.lineTo(px, py);
    }
    k.stroke();
    k.lineWidth = 0.2;
    for (let i = 0; i < 2; i += 1) {
      const f = 0.3 + rnd() * 0.5;
      const bx = x + (px - x) * f;
      const by = y + (py - y) * f;
      const b = a + (rnd() < 0.5 ? 0.7 : -0.7);
      k.beginPath();
      k.moveTo(bx, by);
      k.lineTo(bx + Math.cos(b) * l * 0.25, by + Math.sin(b) * l * 0.25);
      k.stroke();
    }
  }

  // Ein Stein von oben: rundlich, Licht von links oben, Schatten nach rechts
  // unten, oben vielleicht Moos.
  function steinMalen(k, x, y, r, farbe, rnd, { moos = 0, tief = 0, nass = 0 } = {}) {
    const punkte = [];
    const n = 9;
    for (let i = 0; i < n; i += 1) {
      const a = (i / n) * TAU;
      const rr = r * (0.82 + rnd() * 0.3);
      punkte.push([x + Math.cos(a) * rr * 1.12, y + Math.sin(a) * rr * 0.9]);
    }
    const pfad = (dx = 0, dy = 0, f = 1) => {
      k.beginPath();
      for (let i = 0; i <= n; i += 1) {
        const p = punkte[i % n];
        const q = punkte[(i + 1) % n];
        const mx = (p[0] + q[0]) / 2;
        const my = (p[1] + q[1]) / 2;
        const px = x + (p[0] - x) * f + dx;
        const py = y + (p[1] - y) * f + dy;
        if (i === 0) k.moveTo(x + (mx - x) * f + dx, y + (my - y) * f + dy);
        else k.quadraticCurveTo(px, py, x + (mx - x) * f + dx, y + (my - y) * f + dy);
      }
      k.closePath();
    };
    k.fillStyle = `rgba(0,0,0,${0.3 * (1 - tief * 0.5)})`;
    pfad(r * 0.28, -r * 0.32, 1.02);
    k.fill();
    const v = k.createLinearGradient(x - r, y + r, x + r, y - r);
    v.addColorStop(0, rgb(mix3(farbe, [255, 250, 235], 0.3)));
    v.addColorStop(0.55, rgb(farbe));
    v.addColorStop(1, rgb(mix3(farbe, [0, 0, 0], 0.45)));
    k.fillStyle = v;
    pfad();
    k.fill();
    if (moos > 0) {
      k.fillStyle = rgba(mix3([96, 140, 52], farbe, tief * 0.6), 0.85);
      for (let i = 0; i < 6; i += 1) {
        const a = Math.PI * (0.35 + rnd() * 0.6);
        const d = r * (0.1 + rnd() * 0.55);
        k.beginPath();
        k.ellipse(x + Math.cos(a) * d - r * 0.15, y + Math.sin(a) * d * 0.7 + r * 0.1, r * moos * (0.6 + rnd()), r * moos * (0.5 + rnd() * 0.6), rnd() * 3, 0, TAU);
        k.fill();
      }
    }
    if (nass > 0) {
      k.strokeStyle = `rgba(20,30,30,${0.35 * nass})`;
      k.lineWidth = r * 0.12;
      pfad(0, 0, 0.97);
      k.stroke();
    }
    k.fillStyle = `rgba(255,255,245,${0.28 * (1 - tief * 0.6)})`;
    k.beginPath();
    k.ellipse(x - r * 0.35, y + r * 0.3, r * 0.32, r * 0.18, 0.6, 0, TAU);
    k.fill();
  }

  // Wo ein Seitenbach quer über den Weg geht (0 bis 1): Dort ist das Ufer
  // offen.
  function kanalBei(y) {
    let k = 0;
    for (const s of state.stroemungen) {
      const d = Math.abs(y - s.y) - s.halb - 1.5;
      k = Math.max(k, d <= 0 ? 1 : glatt(1 - d / 2.5));
    }
    return k;
  }

  // Der Seitenbach: Er kommt von der einen Seite übers Ufer herein und
  // fliesst auf der anderen weiter – ein heller, kiesiger Arm mit gewellten
  // Rändern, schnellem Wasser und weissen Schlieren, Steine am Rand. Gemalt
  // über dem Ufer; im Bach selbst nur die Schlieren.
  function kanaeleMalen(k, kc) {
    state.stroemungen.forEach((s) => {
      if (s.y + s.halb + 8 < kc.ya || s.y - s.halb - 8 > kc.yb) return;
      const rnd = wuerfel(500 + s.nr * 13);
      const m = mitteBei(s.y);
      const h = halbBei(s.y);
      const tief = farbeBei(s.y, "tief");
      const kies = farbeBei(s.y, "kies");
      const sand = farbeBei(s.y, "sand");
      const wasser = farbeBei(s.y, "wasser");
      const liste = FARBEN[weltBei(s.y)].kiesel;
      const rand = (x, oben) => s.y + (oben ? 1 : -1) * (s.halb + 1.4 + 0.9 * Math.sin(x * 0.23 + (oben ? 1 : 4)) + 0.5 * Math.sin(x * 0.61 + s.nr));
      const arm = (xa, xb, mehr = 0) => {
        k.beginPath();
        for (let x = xa; x <= xb + 0.01; x += 1) k.lineTo(x, rand(x, false) - mehr);
        for (let x = xb; x >= xa - 0.01; x -= 1) k.lineTo(x, rand(x, true) + mehr);
        k.closePath();
      };
      [[kc.xa - 2, m - h + 1.5], [m + h - 1.5, kc.xb + 2]].forEach(([xa, xb]) => {
        if (xb <= xa) return;
        // Nasser Rand, dann der Arm selbst.
        k.fillStyle = rgba(mix3(sand, [40, 30, 20], 0.4), 0.9);
        arm(xa, xb, 1.1);
        k.fill();
        const v = k.createLinearGradient(0, s.y - s.halb - 2, 0, s.y + s.halb + 2);
        v.addColorStop(0, rgb(mix3(kies, sand, 0.4)));
        v.addColorStop(0.5, rgb(mix3(kies, tief, 0.3)));
        v.addColorStop(1, rgb(mix3(kies, sand, 0.4)));
        k.fillStyle = v;
        arm(xa, xb);
        k.fill();
        k.save();
        arm(xa, xb);
        k.clip();
        for (let i = 0; i < (xb - xa) * 1.4; i += 1) {
          const x = xa + rnd() * (xb - xa);
          const y = s.y + (rnd() - 0.5) * 2 * (s.halb + 2);
          k.fillStyle = rgb(mix3(liste[Math.floor(rnd() * 6)], tief, 0.25));
          k.beginPath();
          k.ellipse(x, y, 0.3 + rnd() * 0.7, 0.25 + rnd() * 0.45, rnd() * 3, 0, TAU);
          k.fill();
        }
        k.fillStyle = rgba(wasser, 0.28);
        arm(xa, xb);
        k.fill();
        k.restore();
        k.strokeStyle = "rgba(255,255,255,0.4)";
        k.lineWidth = 0.14;
        k.beginPath();
        for (let x = xa; x <= xb; x += 1) k.lineTo(x, rand(x, true));
        k.stroke();
        k.beginPath();
        for (let x = xa; x <= xb; x += 1) k.lineTo(x, rand(x, false));
        k.stroke();
      });
      // Schlieren im ganzen Band, in Richtung der Strömung.
      k.strokeStyle = "rgba(255,255,255,0.2)";
      k.lineWidth = 0.16;
      for (let i = 0; i < 90; i += 1) {
        const x = kc.xa + rnd() * (kc.xb - kc.xa);
        const y = s.y + (rnd() - 0.5) * 2 * s.halb;
        const l = 3 + rnd() * 7;
        k.beginPath();
        k.moveTo(x, y);
        k.quadraticCurveTo(x + l * 0.5, y + (rnd() - 0.5) * 0.8, x + l, y);
        k.stroke();
      }
      // Steine an den Rändern des Arms (nicht im Bach).
      for (let i = 0; i < 26; i += 1) {
        const oben = rnd() < 0.5;
        const seite = rnd() < 0.5 ? -1 : 1;
        const x = m + seite * (h + 2 + rnd() * 45);
        steinMalen(k, x, rand(x, oben) + (oben ? 0.4 : -0.4), 0.7 + rnd() * 1.5, liste[Math.floor(rnd() * 6)], rnd, { moos: 0.25, nass: 1 });
      }
    });
  }

  // Das Wasser über dem Grund: um so dichter, je tiefer – und am Ufer die
  // Spiegelung der Pflanzen dort, dunkel und grün.
  function saeuleMalen(k, kc) {
    streifenUeber(kc, (y, hoch) => {
      const m = mitteBei(y);
      const h = halbBei(y);
      const wasser = farbeBei(y, "wasser");
      const a = zahlBei(y, "wasserA");
      const x0 = m - h - 1;
      const x1 = m + h + 1;
      const v = k.createLinearGradient(x0, 0, x1, 0);
      for (let i = 0; i <= 10; i += 1) {
        const u = i / 10;
        const d = clamp(tiefeBei(lerp(x0, x1, u), y), 0, 1.5);
        v.addColorStop(u, rgba(wasser, clamp(a * (0.08 + 0.92 * glatt(d)), 0, 0.97)));
      }
      k.fillStyle = v;
      k.fillRect(x0, y, x1 - x0, hoch);
      // Die Spiegelung des Ufers: ein dunkler, grüner Saum.
      const sp = mix3(farbeBei(y, "gras"), [0, 0, 0], 0.55);
      const breit = 4.5 + 1.5 * Math.sin(y * 0.13);
      [-1, 1].forEach((seite) => {
        const xa = m + seite * h;
        const vv = k.createLinearGradient(xa, 0, xa - seite * breit, 0);
        vv.addColorStop(0, rgba(sp, 0.34));
        vv.addColorStop(1, rgba(sp, 0));
        k.fillStyle = vv;
        k.fillRect(Math.min(xa, xa - seite * breit), y, breit, hoch);
      });
    });
    // Der Himmel im Wasser: ein heller Schleier über allem.
    const sa = Math.max(zahlBei(kc.ya, "spiegelA"), zahlBei(kc.yb, "spiegelA"));
    if (sa > 0.01) {
      k.fillStyle = hochVerlauf(k, kc, (y) => farbeBei(y, "spiegel"), (y) => zahlBei(y, "spiegelA"));
      k.beginPath();
      for (let y = kc.ya - 2; y <= kc.yb + 2; y += 2) k.lineTo(mitteBei(y) - halbBei(y), y);
      for (let y = kc.yb + 2; y >= kc.ya - 2; y -= 2) k.lineTo(mitteBei(y) + halbBei(y), y);
      k.closePath();
      k.fill();
    }
  }

  // Die Wiese neben dem Bach: eine Kachel Gras, einmal je Welt gemalt und
  // dann als Muster aufgetragen (an der Welt festgemacht).
  const grasMuster = new Map();
  function grasBild(w) {
    const key = `${w}:${view.S}`;
    if (grasMuster.has(key)) return grasMuster.get(key);
    const CM = 30;
    const S = view.S;
    const n = Math.round(CM * S);
    const c = leinwandPx(n, n);
    const k = c.getContext("2d");
    const F = FARBEN[w];
    k.fillStyle = rgb(mix3(F.gras, F.erde, 0.25));
    k.fillRect(0, 0, n, n);
    k.setTransform(S, 0, 0, S, 0, 0);
    const rnd = wuerfel(911 + w * 17);
    // Erde und Moos in Flecken.
    for (let i = 0; i < 30; i += 1) {
      k.fillStyle = rgba(rnd() < 0.5 ? F.erde : F.moos, 0.25);
      const x = rnd() * CM;
      const y = rnd() * CM;
      for (let dx = -CM; dx <= CM; dx += CM) for (let dy = -CM; dy <= CM; dy += CM) {
        k.beginPath();
        k.ellipse(x + dx, y + dy, 1 + rnd() * 3, 0.8 + rnd() * 2, rnd() * 3, 0, TAU);
        k.fill();
      }
    }
    // Halme: kurze Striche, dunkel unten, hell an der Spitze.
    k.lineCap = "round";
    for (let i = 0; i < 1400; i += 1) {
      const x = rnd() * CM;
      const y = rnd() * CM;
      const a = -Math.PI / 2 + (rnd() - 0.5) * 2.2;
      const l = 0.6 + rnd() * 1.3;
      const c1 = mix3(F.gras, F.grasHell, rnd() * 0.9);
      k.strokeStyle = rgba(rnd() < 0.15 ? mix3(c1, [0, 0, 0], 0.35) : c1, 0.9);
      k.lineWidth = 0.12 + rnd() * 0.1;
      for (let dx = -CM; dx <= CM; dx += CM) for (let dy = -CM; dy <= CM; dy += CM) {
        if (x + dx < -2 || x + dx > CM + 2 || y + dy < -2 || y + dy > CM + 2) continue;
        k.beginPath();
        k.moveTo(x + dx, y + dy);
        k.lineTo(x + dx + Math.cos(a) * l, y + dy + Math.sin(a) * l);
        k.stroke();
      }
    }
    // Blumen: im Teich Gänseblümchen und Hahnenfuss, im Moor Heidekraut,
    // in der Nacht keine.
    const blumen = w === 0 ? 26 : w === 1 ? 10 : w === 2 ? 18 : w === 3 ? 30 : 0;
    for (let i = 0; i < blumen; i += 1) {
      const x = 1 + rnd() * (CM - 2);
      const y = 1 + rnd() * (CM - 2);
      if (w === 3) {
        k.fillStyle = rgba(rnd() < 0.5 ? [196, 120, 186] : [170, 96, 160], 0.9);
        for (let j = 0; j < 5; j += 1) k.fillRect(x + (rnd() - 0.5) * 1.2, y + (rnd() - 0.5) * 1.2, 0.3, 0.3);
      } else if (rnd() < 0.6) {
        // Gänseblümchen: weisse Blättchen um ein gelbes Herz.
        k.fillStyle = "rgba(255,255,250,0.95)";
        for (let j = 0; j < 10; j += 1) {
          const a = (j / 10) * TAU;
          k.beginPath();
          k.ellipse(x + Math.cos(a) * 0.32, y + Math.sin(a) * 0.32, 0.26, 0.09, a, 0, TAU);
          k.fill();
        }
        k.fillStyle = "#f2c430";
        k.beginPath();
        k.arc(x, y, 0.16, 0, TAU);
        k.fill();
      } else {
        // Hahnenfuss: fünf glänzend gelbe Blätter.
        k.fillStyle = "#f6d23a";
        for (let j = 0; j < 5; j += 1) {
          const a = (j / 5) * TAU;
          k.beginPath();
          k.arc(x + Math.cos(a) * 0.22, y + Math.sin(a) * 0.22, 0.2, 0, TAU);
          k.fill();
        }
        k.fillStyle = "#c79a10";
        k.beginPath();
        k.arc(x, y, 0.1, 0, TAU);
        k.fill();
      }
    }
    const muster = { bild: c, cm: CM };
    grasMuster.set(key, muster);
    return muster;
  }

  // Das Ufer einer Seite: Wiese, dann ein Streifen nasser Sand und Kies bis
  // ans Wasser, dort eine helle Linie, wo das Wasser den Sand berührt.
  function uferBodenMalen(k, kc, seite) {
    const y0 = kc.ya - 2;
    const y1 = kc.yb + 2;
    const kante = (y, mehr) => mitteBei(y) + seite * (halbBei(y) + mehr + randZitter(y, seite));
    const aussen = seite < 0 ? kc.xa - 1 : kc.xb + 1;
    const flaeche = (mehr) => {
      k.beginPath();
      k.moveTo(aussen, y0);
      for (let y = y0; y <= y1; y += 1.5) k.lineTo(kante(y, mehr), y);
      k.lineTo(kante(y1, mehr), y1);
      k.lineTo(aussen, y1);
      k.closePath();
    };
    const w = weltBei((kc.ya + kc.yb) / 2);
    // Die Wiese, als Muster an der Welt festgemacht: Ein Bildpunkt des
    // Musters ist ein Bildpunkt der Kachel, sein Ursprung liegt bei x = 0,
    // y = 0 der Welt – so geht die Wiese über die Kacheln. Wo zwei Welten
    // ineinander übergehen, Streifen um Streifen gemischt.
    const S = view.S;
    const musterVon = (welt) => {
      const m = k.createPattern(grasBild(welt).bild, "repeat");
      if (m?.setTransform) m.setTransform(new DOMMatrix([1 / S, 0, 0, -1 / S, 0, 0]));
      return m || rgb(FARBEN[welt].gras);
    };
    const einfach = weltMix(y0).length === 1 && weltMix(y1).length === 1 && weltMix(y0)[0][0] === weltMix(y1)[0][0];
    if (einfach) {
      k.fillStyle = musterVon(weltMix(y0)[0][0]);
      flaeche(2.4);
      k.fill();
    } else {
      const cache = {};
      streifenUeber(kc, (y, hoch) => {
        k.save();
        k.beginPath();
        k.rect(kc.xa - 2, y, kc.xb - kc.xa + 4, hoch);
        k.clip();
        weltMix(y + 0.75).forEach(([welt, anteil], i) => {
          k.globalAlpha = i === 0 ? 1 : anteil;
          k.fillStyle = cache[welt] || (cache[welt] = musterVon(welt));
          flaeche(2.4);
          k.fill();
        });
        k.restore();
      });
    }
    // Weit draussen dunkler: Dort spielt nichts, der Blick gehört dem Bach.
    {
      const m = mitteBei((kc.ya + kc.yb) / 2);
      const h = halbBei((kc.ya + kc.yb) / 2);
      const x0 = m + seite * (h + 14);
      const x1 = m + seite * (h + 70);
      const v = k.createLinearGradient(x0, 0, x1, 0);
      const nacht = mix3(farbeBei(kc.ya, "erde"), [10, 20, 26], 0.6);
      v.addColorStop(0, rgba(nacht, 0));
      v.addColorStop(1, rgba(nacht, 0.42));
      k.fillStyle = v;
      flaeche(14);
      k.fill();
    }
    // Nahe am Wasser etwas dunkler: feuchter Boden.
    k.fillStyle = hochVerlauf(k, kc, (y) => farbeBei(y, "erde"), 0.55);
    k.beginPath();
    for (let y = y0; y <= y1; y += 1.5) k.lineTo(kante(y, 5.5 + 1.5 * Math.sin(y * 0.21)), y);
    for (let y = y1; y >= y0; y -= 1.5) k.lineTo(kante(y, 1.8), y);
    k.closePath();
    k.fill();
    // Der Streifen am Wasser: nasser Sand.
    k.fillStyle = hochVerlauf(k, kc, (y) => mix3(farbeBei(y, "sand"), farbeBei(y, "erde"), 0.35), 0.95);
    k.beginPath();
    for (let y = y0; y <= y1; y += 1.5) k.lineTo(kante(y, 2.6 + 0.8 * Math.sin(y * 0.37)), y);
    for (let y = y1; y >= y0; y -= 1.5) k.lineTo(kante(y, 0.1), y);
    k.closePath();
    k.fill();
    k.fillStyle = hochVerlauf(k, kc, (y) => mix3(farbeBei(y, "sand"), [40, 30, 20], 0.45), 0.5);
    k.beginPath();
    for (let y = y0; y <= y1; y += 1.5) k.lineTo(kante(y, 1.1), y);
    for (let y = y1; y >= y0; y -= 1.5) k.lineTo(kante(y, 0.1), y);
    k.closePath();
    k.fill();
    // Kiesel auf dem Ufer.
    const ZELLE = 5;
    const liste = FARBEN[w].kiesel;
    for (let j = Math.floor(y0 / ZELLE); j <= Math.floor(y1 / ZELLE); j += 1) {
      const rnd = zellZufall(j, seite < 0 ? 31 : 37);
      for (let i = 0; i < 7; i += 1) {
        const y = j * ZELLE + rnd() * ZELLE;
        const x = kante(y, 0.4 + rnd() ** 1.5 * 6);
        const r = 0.3 + rnd() * 0.7;
        const c = liste[Math.floor(rnd() * liste.length)];
        k.fillStyle = "rgba(0,0,0,0.25)";
        k.beginPath();
        k.ellipse(x + r * 0.25, y - r * 0.25, r, r * 0.75, rnd() * 3, 0, TAU);
        k.fill();
        k.fillStyle = rgb(c);
        k.beginPath();
        k.ellipse(x, y, r, r * 0.75, rnd() * 3, 0, TAU);
        k.fill();
        k.fillStyle = "rgba(255,255,245,0.35)";
        k.beginPath();
        k.ellipse(x - r * 0.3, y + r * 0.25, r * 0.4, r * 0.25, 0.5, 0, TAU);
        k.fill();
      }
    }
    // Wo Wasser und Sand sich berühren: eine helle, feine Linie.
    k.strokeStyle = rgba(mix3(farbeBei(kc.ya, "licht"), [255, 255, 255], 0.5), 0.5);
    k.lineWidth = 0.14;
    k.beginPath();
    for (let y = y0; y <= y1; y += 1.2) k.lineTo(kante(y, -0.05), y);
    k.stroke();
    k.strokeStyle = "rgba(255,255,255,0.18)";
    k.lineWidth = 0.1;
    k.beginPath();
    for (let y = y0; y <= y1; y += 1.2) k.lineTo(kante(y, -0.7), y);
    k.stroke();
  }

  // ---------------------------------------------------------------------------
  // Malen: was am Ufer wächst
  // ---------------------------------------------------------------------------
  /*
   * Von oben gesehen, aber so, als stünde man über der Mitte des Baches:
   * Was hoch ist (Schilf, Rohrkolben, Wollgras), lehnt nach aussen, und sein
   * Schatten fällt nach rechts unten. Jede Pflanze hat ihre Form, an der man
   * sie erkennt – das Schilf seine Halme, der Rohrkolben seinen braunen
   * Kolben, die Schwertlilie ihre gelben Blüten, der Farn seine Fiedern.
   */
  function halm(k, x0, y0, x1, y1, bug, breit, farbe) {
    const mx = (x0 + x1) / 2 + bug * (y1 - y0) * 0.25;
    const my = (y0 + y1) / 2 - bug * (x1 - x0) * 0.25;
    const dx = x1 - x0;
    const dy = y1 - y0;
    const l = Math.hypot(dx, dy) || 1;
    const nx = (-dy / l) * breit;
    const ny = (dx / l) * breit;
    k.fillStyle = farbe;
    k.beginPath();
    k.moveTo(x0 + nx, y0 + ny);
    k.quadraticCurveTo(mx + nx * 0.6, my + ny * 0.6, x1, y1);
    k.quadraticCurveTo(mx - nx * 0.6, my - ny * 0.6, x0 - nx, y0 - ny);
    k.closePath();
    k.fill();
  }

  function schattenHalm(k, x0, y0, x1, y1, hoch, breit, alpha = 0.22) {
    // Der Schatten eines Halms, der hoch ist: um so weiter versetzt, je höher.
    k.strokeStyle = `rgba(10,20,10,${alpha})`;
    k.lineWidth = breit;
    k.beginPath();
    k.moveTo(x0, y0);
    k.lineTo(x1 + SONNE.x * hoch, y1 + SONNE.y * hoch);
    k.stroke();
  }

  function schilf(k, x, y, seite, rnd, gruen, { kolben = 0, gross = 1 } = {}) {
    const n = 5 + Math.floor(rnd() * 5);
    const halme = [];
    for (let i = 0; i < n; i += 1) {
      const bx = x + (rnd() - 0.5) * 1.6;
      const by = y + (rnd() - 0.5) * 1.6;
      const l = (8 + rnd() * 8) * gross;
      const a = (seite > 0 ? 0 : Math.PI) + (rnd() - 0.5) * 1.3;
      halme.push({ bx, by, ex: bx + Math.cos(a) * l, ey: by + Math.sin(a) * l * 0.8, bug: (rnd() - 0.5) * 0.7, l });
    }
    halme.forEach((h) => schattenHalm(k, h.bx, h.by, h.ex, h.ey, h.l * 0.4, 0.35, 0.16));
    halme.forEach((h, i) => {
      const c = mix3(gruen, i % 4 === 0 ? [190, 170, 96] : [190, 220, 120], rnd() * 0.45);
      halm(k, h.bx, h.by, h.ex, h.ey, h.bug, 0.3, rgb(mix3(c, [0, 0, 0], 0.22)));
      halm(k, h.bx, h.by, h.ex, h.ey, h.bug, 0.11, rgba(mix3(c, [255, 255, 220], 0.4), 0.85));
    });
    for (let i = 0; i < kolben; i += 1) {
      // Der Rohrkolben: ein Stängel, oben der braune Kolben, darüber die Spitze.
      const bx = x + (rnd() - 0.5) * 1.6;
      const by = y + (rnd() - 0.5) * 1.6;
      const l = (8 + rnd() * 5) * gross;
      const a = (seite > 0 ? 0 : Math.PI) + (rnd() - 0.5) * 0.9;
      const ex = bx + Math.cos(a) * l;
      const ey = by + Math.sin(a) * l * 0.7;
      schattenHalm(k, bx, by, ex, ey, l * 0.6, 0.6, 0.22);
      k.strokeStyle = rgb(mix3(gruen, [120, 110, 60], 0.4));
      k.lineWidth = 0.16;
      k.beginPath();
      k.moveTo(bx, by);
      k.lineTo(ex, ey);
      k.stroke();
      const u = Math.atan2(ey - by, ex - bx);
      const kx = bx + (ex - bx) * 0.72;
      const ky = by + (ey - by) * 0.72;
      k.save();
      k.translate(kx, ky);
      k.rotate(u);
      k.fillStyle = "rgba(10,20,10,0.25)";
      k.beginPath();
      k.ellipse(0.4 + SONNE.x * 4, SONNE.y * 4 - 0.2, 2, 0.55, 0, 0, TAU);
      k.fill();
      k.fillStyle = "#4e2c14";
      k.beginPath();
      k.ellipse(0, 0, 2.1, 0.6, 0, 0, TAU);
      k.fill();
      k.fillStyle = "#7e5028";
      k.beginPath();
      k.ellipse(-0.15, 0.2, 1.8, 0.26, 0, 0, TAU);
      k.fill();
      k.fillStyle = "rgba(255,230,190,0.35)";
      k.beginPath();
      k.ellipse(-0.5, 0.3, 0.9, 0.1, 0, 0, TAU);
      k.fill();
      k.strokeStyle = "#6f6040";
      k.lineWidth = 0.1;
      k.beginPath();
      k.moveTo(2.1, 0);
      k.lineTo(3.6, 0);
      k.stroke();
      k.restore();
    }
  }

  function schwertlilie(k, x, y, seite, rnd, gruen) {
    const n = 6;
    for (let i = 0; i < n; i += 1) {
      const a = (seite > 0 ? 0 : Math.PI) + (i / (n - 1) - 0.5) * 1.6;
      const l = 5 + rnd() * 3;
      const ex = x + Math.cos(a) * l;
      const ey = y + Math.sin(a) * l * 0.85;
      schattenHalm(k, x, y, ex, ey, l * 0.35, 0.5, 0.15);
      halm(k, x, y, ex, ey, (rnd() - 0.5) * 0.5, 0.42, rgb(mix3(gruen, [40, 90, 70], 0.35)));
      halm(k, x, y, ex, ey, 0, 0.12, rgba(mix3(gruen, [220, 240, 200], 0.4), 0.7));
    }
    // Die gelben Blüten.
    const zahl = 1 + Math.floor(rnd() * 2);
    for (let i = 0; i < zahl; i += 1) {
      const a = (seite > 0 ? 0 : Math.PI) + (rnd() - 0.5) * 1.2;
      const d = 3 + rnd() * 3;
      const bx = x + Math.cos(a) * d;
      const by = y + Math.sin(a) * d;
      k.fillStyle = "rgba(10,20,10,0.25)";
      k.beginPath();
      k.arc(bx + SONNE.x * 2.5, by + SONNE.y * 2.5, 1.1, 0, TAU);
      k.fill();
      for (let j = 0; j < 3; j += 1) {
        const w = (j / 3) * TAU + rnd();
        k.fillStyle = "#f3c42a";
        k.beginPath();
        k.ellipse(bx + Math.cos(w) * 0.75, by + Math.sin(w) * 0.75, 0.85, 0.45, w, 0, TAU);
        k.fill();
        k.strokeStyle = "rgba(150,80,20,0.7)";
        k.lineWidth = 0.07;
        k.beginPath();
        k.moveTo(bx + Math.cos(w) * 0.3, by + Math.sin(w) * 0.3);
        k.lineTo(bx + Math.cos(w) * 1.1, by + Math.sin(w) * 1.1);
        k.stroke();
        const w2 = w + Math.PI / 3;
        k.fillStyle = "#ffe06a";
        k.beginPath();
        k.ellipse(bx + Math.cos(w2) * 0.42, by + Math.sin(w2) * 0.42, 0.5, 0.25, w2, 0, TAU);
        k.fill();
      }
    }
  }

  function farn(k, x, y, seite, rnd, gruen, gross = 1) {
    const n = 5 + Math.floor(rnd() * 3);
    for (let i = 0; i < n; i += 1) {
      const a = (seite > 0 ? 0 : Math.PI) + (i / (n - 1) - 0.5) * 2.6 + (rnd() - 0.5) * 0.3;
      const l = (6 + rnd() * 4) * gross;
      const bug = (rnd() - 0.5) * 0.6;
      const c = mix3(gruen, [150, 200, 90], rnd() * 0.3);
      // Die Mittelrippe als Bogen, daran die Fiedern, zur Spitze kleiner.
      const punkt = (u) => {
        const w = a + bug * u;
        return [x + Math.cos(a) * l * u + Math.cos(w + Math.PI / 2) * bug * l * u * u * 0.3, y + Math.sin(a) * l * u + Math.sin(w + Math.PI / 2) * bug * l * u * u * 0.3, w];
      };
      k.fillStyle = "rgba(10,25,10,0.18)";
      for (let j = 2; j < 14; j += 1) {
        const [px, py] = punkt(j / 14);
        k.beginPath();
        k.arc(px + SONNE.x * 1.5, py + SONNE.y * 1.5, l * 0.07 * (1 - j / 16), 0, TAU);
        k.fill();
      }
      for (let j = 2; j < 15; j += 1) {
        const u = j / 15;
        const [px, py, w] = punkt(u);
        const fl = l * 0.2 * (1 - u * 0.85);
        for (const s of [-1, 1]) {
          const fw = w + s * 1.15;
          blattUmriss(k, px + Math.cos(fw) * fl * 0.5, py + Math.sin(fw) * fl * 0.5, fw, fl, rgb(mix3(c, [0, 0, 0], s > 0 ? 0.1 : 0)), null, 0.42);
        }
      }
      k.strokeStyle = rgb(mix3(c, [210, 230, 140], 0.4));
      k.lineWidth = 0.1;
      k.beginPath();
      for (let j = 0; j <= 15; j += 1) { const [px, py] = punkt(j / 15); k.lineTo(px, py); }
      k.stroke();
    }
  }

  // Vergissmeinnicht: Polster kleiner, himmelblauer Blüten mit gelbem Auge.
  function vergissmeinnicht(k, x, y, rnd) {
    for (let i = 0; i < 10; i += 1) {
      const a = rnd() * TAU;
      k.fillStyle = "rgba(60,110,50,0.85)";
      k.beginPath();
      k.ellipse(x + (rnd() - 0.5) * 4, y + (rnd() - 0.5) * 4, 0.9, 0.35, a, 0, TAU);
      k.fill();
    }
    const n = 9 + Math.floor(rnd() * 8);
    for (let i = 0; i < n; i += 1) {
      const bx = x + (rnd() - 0.5) * 4.5;
      const by = y + (rnd() - 0.5) * 4.5;
      k.fillStyle = rnd() < 0.2 ? "#d9a6e8" : "#7fb2ee";
      for (let j = 0; j < 5; j += 1) {
        const w = (j / 5) * TAU;
        k.beginPath();
        k.arc(bx + Math.cos(w) * 0.24, by + Math.sin(w) * 0.24, 0.2, 0, TAU);
        k.fill();
      }
      k.fillStyle = "#f6dc5a";
      k.beginPath();
      k.arc(bx, by, 0.1, 0, TAU);
      k.fill();
    }
  }

  // Wollgras: Büschel feiner Halme, darüber weisse, flauschige Köpfe.
  function wollgras(k, x, y, seite, rnd, gruen) {
    for (let i = 0; i < 8; i += 1) {
      const a = (seite > 0 ? 0 : Math.PI) + (rnd() - 0.5) * 2;
      const l = 3 + rnd() * 4;
      k.strokeStyle = rgba(mix3(gruen, [200, 180, 110], rnd() * 0.5), 0.9);
      k.lineWidth = 0.12;
      k.beginPath();
      k.moveTo(x, y);
      k.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
      k.stroke();
    }
    const n = 3 + Math.floor(rnd() * 4);
    for (let i = 0; i < n; i += 1) {
      const a = (seite > 0 ? 0 : Math.PI) + (rnd() - 0.5) * 1.6;
      const l = 4 + rnd() * 5;
      const ex = x + Math.cos(a) * l;
      const ey = y + Math.sin(a) * l * 0.8;
      schattenHalm(k, x, y, ex, ey, l * 0.5, 0.12, 0.15);
      k.strokeStyle = "rgba(120,110,70,0.9)";
      k.lineWidth = 0.07;
      k.beginPath();
      k.moveTo(x, y);
      k.lineTo(ex, ey);
      k.stroke();
      k.fillStyle = "rgba(20,10,20,0.2)";
      k.beginPath();
      k.arc(ex + SONNE.x * l * 0.5, ey + SONNE.y * l * 0.5, 0.8, 0, TAU);
      k.fill();
      for (let j = 0; j < 14; j += 1) {
        const w = rnd() * TAU;
        const d = rnd() * 0.75;
        k.fillStyle = `rgba(255,252,248,${0.35 + rnd() * 0.4})`;
        k.beginPath();
        k.arc(ex + Math.cos(w) * d, ey + Math.sin(w) * d, 0.25 + rnd() * 0.3, 0, TAU);
        k.fill();
      }
      k.fillStyle = "rgba(255,255,255,0.9)";
      k.beginPath();
      k.arc(ex - 0.15, ey + 0.15, 0.35, 0, TAU);
      k.fill();
    }
  }

  // Torfmoos: ein flaches Polster, rot und grün gesprenkelt – aus lauter
  // kleinen Sternchen (den Köpfchen der Moospflänzchen).
  function torfmoos(k, x, y, rnd) {
    const rx = 2.5 + rnd() * 2;
    const ry = 1.8 + rnd() * 1.5;
    const w = rnd() * Math.PI;
    k.fillStyle = "rgba(60,40,30,0.35)";
    k.beginPath();
    k.ellipse(x + 0.3, y - 0.3, rx, ry, w, 0, TAU);
    k.fill();
    k.fillStyle = rnd() < 0.5 ? "rgba(140,74,58,0.85)" : "rgba(118,120,60,0.85)";
    k.beginPath();
    k.ellipse(x, y, rx, ry, w, 0, TAU);
    k.fill();
    const n = Math.round(rx * ry * 5);
    for (let i = 0; i < n; i += 1) {
      const a = rnd() * TAU;
      const d = Math.sqrt(rnd());
      const px = x + Math.cos(a) * d * rx * Math.cos(w) - Math.sin(a) * d * ry * Math.sin(w);
      const py = y + Math.cos(a) * d * rx * Math.sin(w) + Math.sin(a) * d * ry * Math.cos(w);
      const c = rnd() < 0.45 ? [196, 84, 70] : rnd() < 0.5 ? [150, 170, 70] : [214, 150, 80];
      k.strokeStyle = rgba(c, 0.9);
      k.lineWidth = 0.09;
      const r = 0.18 + rnd() * 0.12;
      k.beginPath();
      for (let j = 0; j < 4; j += 1) {
        const b = (j / 4) * Math.PI + a;
        k.moveTo(px - Math.cos(b) * r, py - Math.sin(b) * r);
        k.lineTo(px + Math.cos(b) * r, py + Math.sin(b) * r);
      }
      k.stroke();
    }
  }

  // Ein Birkenstamm, gefallen: weisse Rinde mit schwarzen Querstrichen.
  function birkenstamm(k, x, y, w, l, rnd) {
    const r = 1.1 + rnd() * 0.5;
    k.save();
    k.translate(x, y);
    k.rotate(w);
    k.fillStyle = "rgba(10,10,20,0.3)";
    k.fillRect(SONNE.x * 1.5, SONNE.y * 1.5 - r, l, r * 2);
    const v = k.createLinearGradient(0, r, 0, -r);
    v.addColorStop(0, "#f4f0e6");
    v.addColorStop(0.6, "#d8d2c4");
    v.addColorStop(1, "#8e887c");
    k.fillStyle = v;
    k.fillRect(0, -r, l, r * 2);
    k.fillStyle = "#2a2622";
    for (let i = 0; i < l / 1.1; i += 1) {
      const px = rnd() * l;
      k.fillRect(px, -r * (0.2 + rnd() * 0.8), 0.25 + rnd() * 0.5, r * (0.2 + rnd() * 0.6));
    }
    k.fillStyle = "#c9a27a";
    k.beginPath();
    k.ellipse(l, 0, 0.35, r, 0, 0, TAU);
    k.fill();
    k.restore();
  }

  // Die Ufermauer am Mühlenteich: Quader mit Fugen, Moos darin.
  function mauer(k, y0, y1, seite, kc) {
    const kante = (y) => mitteBei(y) + seite * (halbBei(y) + 0.3);
    const breit = 7;
    const H = 4.2;
    for (let j = Math.floor(y0 / H) - 1; j <= Math.floor(y1 / H) + 1; j += 1) {
      const rnd = zellZufall(j, 61);
      const ya = j * H;
      // Wo ein Seitenbach durch die Mauer kommt, ist sie offen.
      if (kanalBei(ya + H / 2) > 0.2) continue;
      const xa = kante(ya + H / 2);
      const versatz = (j % 2) * 2.5;
      for (let reihe = 0; reihe < 2; reihe += 1) {
        const x0 = xa + seite * (reihe * breit * 0.5);
        const c = mix3([168, 156, 136], [120, 110, 100], rnd() * 0.6);
        const xL = seite > 0 ? x0 : x0 - breit * 0.5;
        k.fillStyle = rgb(c);
        k.fillRect(xL + 0.15, ya + 0.15 + versatz * 0.1, breit * 0.5 - 0.3, H - 0.3);
        k.fillStyle = "rgba(255,250,230,0.18)";
        k.fillRect(xL + 0.15, ya + H - 0.9, breit * 0.5 - 0.3, 0.6);
        k.fillStyle = "rgba(0,0,0,0.18)";
        k.fillRect(xL + 0.15, ya + 0.15, breit * 0.5 - 0.3, 0.5);
        if (rnd() < 0.4) {
          k.fillStyle = "rgba(90,130,50,0.8)";
          k.beginPath();
          k.ellipse(xL + rnd() * breit * 0.5, ya + 0.2, 0.8 + rnd(), 0.3, 0, 0, TAU);
          k.fill();
        }
      }
    }
    // Die Kante zum Wasser: nass und dunkel.
    k.strokeStyle = "rgba(30,40,30,0.5)";
    k.lineWidth = 0.5;
    k.beginPath();
    for (let y = y0; y <= y1; y += 1.5) k.lineTo(kante(y), y);
    k.stroke();
  }

  // Ein Pfahl im Wasser: Holz mit Jahresringen, Moos am Rand.
  function pfahl(k, x, y, r) {
    k.fillStyle = "rgba(0,0,0,0.3)";
    k.beginPath();
    k.arc(x + SONNE.x * 3, y + SONNE.y * 3, r, 0, TAU);
    k.fill();
    k.fillStyle = "#5e4630";
    k.beginPath();
    k.arc(x, y, r, 0, TAU);
    k.fill();
    k.fillStyle = "#a07c52";
    k.beginPath();
    k.arc(x, y, r * 0.82, 0, TAU);
    k.fill();
    k.strokeStyle = "rgba(90,60,36,0.6)";
    k.lineWidth = 0.08;
    for (let i = 1; i < 5; i += 1) {
      k.beginPath();
      k.arc(x + 0.1, y - 0.05, r * 0.16 * i, 0, TAU);
      k.stroke();
    }
    k.fillStyle = "rgba(96,140,52,0.8)";
    k.beginPath();
    k.arc(x - r * 0.5, y + r * 0.4, r * 0.35, 0, TAU);
    k.fill();
  }

  // Die Brennnessel: Paare gesägter Blätter, gegenständig, kreuzweise.
  function nessel(k, x, y, rnd, gruen) {
    const w0 = rnd() * TAU;
    for (let i = 0; i < 4; i += 1) {
      const w = w0 + i * (Math.PI / 2);
      const l = 2.4 - i * 0.3;
      for (const s of [0, Math.PI]) {
        const a = w + s;
        const bx = x + Math.cos(a) * l * 0.55;
        const by = y + Math.sin(a) * l * 0.55;
        k.fillStyle = "rgba(0,20,0,0.2)";
        k.beginPath();
        k.ellipse(bx + SONNE.x * 1.2, by + SONNE.y * 1.2, l * 0.5, l * 0.3, a, 0, TAU);
        k.fill();
        k.fillStyle = rgb(mix3(gruen, [30, 70, 30], 0.4 + i * 0.1));
        k.beginPath();
        // Gesägter Rand: kleine Zacken.
        for (let j = 0; j <= 16; j += 1) {
          const u = (j / 16) * TAU;
          const rr = (j % 2 ? 0.88 : 1) * 1;
          const ex = Math.cos(u) * l * 0.5 * rr;
          const ey = Math.sin(u) * l * 0.28 * rr;
          k.lineTo(bx + ex * Math.cos(a) - ey * Math.sin(a), by + ex * Math.sin(a) + ey * Math.cos(a));
        }
        k.closePath();
        k.fill();
        k.strokeStyle = "rgba(190,220,150,0.5)";
        k.lineWidth = 0.06;
        k.beginPath();
        k.moveTo(x, y);
        k.lineTo(bx + Math.cos(a) * l * 0.45, by + Math.sin(a) * l * 0.45);
        k.stroke();
      }
    }
  }

  function uferPflanzenMalen(k, kc, seite) {
    const ZELLE = 7;
    const y0 = kc.ya - 12;
    const y1 = kc.yb + 12;
    // Die Mauer des Mühlenteichs: links, so weit der Mühlenteich reicht.
    if (seite < 0) {
      const ab = state.zonen.find((z) => z.w === 2);
      const bis = state.zonen.find((z) => z.w === 3);
      if (ab) {
        const ma = Math.max(y0, ab.y + 6);
        const mb = Math.min(y1, bis ? bis.y - 6 : Infinity);
        if (mb > ma) mauer(k, ma, mb, seite, kc);
      }
    }
    for (let j = Math.floor(y0 / ZELLE); j <= Math.floor(y1 / ZELLE); j += 1) {
      const rnd = zellZufall(j, seite < 0 ? 41 : 43);
      const y = j * ZELLE + rnd() * ZELLE;
      const w = weltBei(y);
      const F = FARBEN[w];
      const m = mitteBei(y);
      const h = halbBei(y);
      const nah = (mehr) => m + seite * (h + mehr);
      const r1 = rnd();
      const r2 = rnd();
      const mauerHier = w === 2 && seite < 0;
      // Was in den Strömungen geschieht: dort, wo das Wasser zu- und
      // abfliesst, keine Pflanzen.
      const imBand = state.stroemungen.some((s) => Math.abs(y - s.y) < s.halb + 4);
      if (imBand) continue;
      if (w === 0) {
        if (r1 < 0.62) schilf(k, nah(1 + r2 * 2), y, seite, rnd, F.gras, { kolben: rnd() < 0.55 ? 1 + Math.floor(rnd() * 2) : 0 });
        else if (r1 < 0.78) schwertlilie(k, nah(1.5 + r2 * 2), y, seite, rnd, F.gras);
        else if (r1 < 0.86) steinMalen(k, nah(0.5 + r2 * 2), y, 2 + rnd() * 1.5, F.kiesel[Math.floor(rnd() * 6)], rnd, { moos: 0.2, nass: 1 });
      } else if (w === 1) {
        if (r1 < 0.42) steinMalen(k, nah(-0.5 + r2 * 2.5), y, 2.2 + rnd() * 2.4, F.kiesel[Math.floor(rnd() * 6)], rnd, { moos: 0.3, nass: 1 });
        else if (r1 < 0.72) farn(k, nah(3 + r2 * 3), y, seite, rnd, F.gras);
        else if (r1 < 0.88) vergissmeinnicht(k, nah(2.5 + r2 * 4), y, rnd);
        else schilf(k, nah(1 + r2), y, seite, rnd, F.gras, { gross: 0.8 });
      } else if (w === 2) {
        if (mauerHier) {
          if (r1 < 0.35) pfahl(k, nah(-1.5 - r2 * 2), y, 1.2 + rnd() * 0.5);
        } else if (r1 < 0.45) schilf(k, nah(1 + r2 * 2), y, seite, rnd, F.gras, { kolben: rnd() < 0.4 ? 1 : 0 });
        else if (r1 < 0.75) nessel(k, nah(3 + r2 * 4), y, rnd, F.gras);
        else if (r1 < 0.85) pfahl(k, nah(-1 - r2 * 2), y, 1.1 + rnd() * 0.5);
      } else if (w === 3) {
        if (r1 < 0.45) wollgras(k, nah(1.5 + r2 * 3), y, seite, rnd, F.gras);
        else if (r1 < 0.72) torfmoos(k, nah(3 + r2 * 3), y, rnd);
        else if (r1 < 0.84) schilf(k, nah(1 + r2), y, seite, rnd, F.gras, { gross: 0.9 });
        else if (r1 < 0.9) birkenstamm(k, nah(-0.5), y, seite > 0 ? 0.2 + rnd() * 0.5 : Math.PI - 0.2 - rnd() * 0.5, 10 + rnd() * 8, rnd);
      } else {
        if (r1 < 0.45) farn(k, nah(2.5 + r2 * 3), y, seite, rnd, F.gras, 1.1);
        else if (r1 < 0.8) steinMalen(k, nah(-0.5 + r2 * 2.5), y, 2 + rnd() * 2.2, F.kiesel[Math.floor(rnd() * 6)], rnd, { moos: 0.25, nass: 1 });
      }
      // Weiter draussen (quer sieht man viel Ufer): Steine und Pflanzen der Welt.
      if (rnd() < 0.16) steinMalen(k, nah(8 + rnd() * 30), y, 1.5 + rnd() * 2.5, F.kiesel[Math.floor(rnd() * 6)], rnd, { moos: 0.25 });
      if (rnd() < 0.45) {
        const xw = nah(12 + rnd() * 55);
        if (w === 0) (rnd() < 0.5 ? schwertlilie : schilf)(k, xw, y, seite, rnd, F.gras);
        else if (w === 1 || w === 4) farn(k, xw, y, seite, rnd, F.gras, 0.9);
        else if (w === 2) nessel(k, xw, y, rnd, F.gras);
        else if (rnd() < 0.5) wollgras(k, xw, y, seite, rnd, F.gras);
        else torfmoos(k, xw, y, rnd);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Malen: das Laub über dem Ufer
  // ---------------------------------------------------------------------------
  /*
   * Über beiden Ufern hängen Zweige ins Bild, näher an uns als das Wasser:
   * Sie ziehen schneller vorbei (VORN) und werfen gefleckten Schatten auf
   * Wasser und Grund. Je Welt ihre Art: Weide am Teich, Erle am Bach, Buche
   * am Mühlenteich, Birke im Moor, Fichte an der Quelle.
   */
  const VORN = 1.24;
  const ZWEIG_ZELLE = 42;

  function zweigeBei(y0, y1) {
    const raus = [];
    for (let j = Math.floor(y0 / ZWEIG_ZELLE) - 1; j <= Math.floor(y1 / ZWEIG_ZELLE) + 1; j += 1) {
      const rnd = zellZufall(j, 71);
      const y = j * ZWEIG_ZELLE + rnd() * ZWEIG_ZELLE * 0.7;
      const seite = (j % 2 === 0 ? 1 : -1) * (rnd() < 0.8 ? 1 : -1);
      const w = weltBei(y);
      if (state.stroemungen.some((s) => Math.abs(y - s.y) < s.halb + 12)) continue;
      const art = ["erle", "buche", "kastanie", "birke", "fichte"][w];
      const aus = 9 + rnd() * 5;
      // Schräg am Ufer entlang, nicht quer übers Wasser: Die Blätter des
      // Weges sollen frei bleiben.
      const schraeg = (rnd() < 0.5 ? 1 : -1) * (0.6 + rnd() * 0.4);
      raus.push({ j, y, seite, art, aus, w: (seite > 0 ? Math.PI : 0) + schraeg, n: Math.floor(rnd() * 3) });
    }
    return raus;
  }

  // Wo ein Zweig steckt: am Ufer, ein Stück draussen.
  function zweigOrt(z) {
    return { x: mitteBei(z.y) + z.seite * (halbBei(z.y) + z.aus), y: z.y };
  }

  // Gefleckter Schatten der Zweige auf der Kachel.
  function laubSchattenMalen(k, kc) {
    zweigeBei(kc.ya - 40, kc.yb + 40).forEach((z) => {
      const o = zweigOrt(z);
      const rnd = zellZufall(z.j, 73);
      const lang = 22;
      k.fillStyle = "rgba(8,24,16,0.13)";
      for (let i = 0; i < 26; i += 1) {
        const u = rnd();
        const q = (rnd() - 0.5) * 12 * u;
        const px = o.x + Math.cos(z.w) * lang * u - Math.sin(z.w) * q + SONNE.x * 9;
        const py = o.y + Math.sin(z.w) * lang * u + Math.cos(z.w) * q + SONNE.y * 9;
        if (py < kc.ya - 6 || py > kc.yb + 6) continue;
        k.beginPath();
        k.ellipse(px, py, 1.4 + rnd() * 2.2, 0.9 + rnd() * 1.4, rnd() * 3, 0, TAU);
        k.fill();
      }
    });
  }

  // ---------------------------------------------------------------------------
  // Malen: die Lichtnetze am Grund
  // ---------------------------------------------------------------------------
  /*
   * Die Kaustik: Die gekräuselte Oberfläche bündelt das Sonnenlicht zu einem
   * Netz heller Linien auf dem Grund, das sich langsam verzieht. Vorgemalt
   * als KAUSTIK_N Bilder einer Kachel, die sich nach allen Seiten fortsetzt
   * (die Linien sind die Grenzen zwischen Zellen um Punkte, die auf kleinen
   * Kreisen wandern – nach KAUSTIK_N Bildern sind sie wieder am Anfang).
   *
   * Sie liegen fest in den Kacheln: Für das Wasser jeder Kachel (nur dessen
   * Breite) gibt es vier Ausschnitte, einen je Phase (lichtnetzePhasen) –
   * im Flachen kräftig, in der Tiefe schwach, in der Hechtgrube kaum. Die
   * Kachel trägt die Phase, die gerade gilt (beim Wechsel einmal
   * hineingelegt); gegen Ende einer Phase wird die nächste darüber
   * geblendet (zeichneKacheln). So bewegt sich das Netz, ohne dass je Bild
   * Licht gemalt wird – auf dem iPhone rechnet der Prozessor jede Fläche.
   */
  const KAUSTIK_N = 4;
  const KAUSTIK_CM = 22;
  const KAUSTIK_G = 6;
  const PHASE_DAUER = 0.95;        // so lange gilt eine Phase; im letzten Drittel blendet sie über (s)
  let kaustik = null;

  function kaustikVorbereiten(budgetMs = 4) {
    if (!kaustik || kaustik.S !== view.S) {
      const rnd = wuerfel(4242);
      const punkte = [];
      for (let gy = 0; gy < KAUSTIK_G; gy += 1) {
        for (let gx = 0; gx < KAUSTIK_G; gx += 1) {
          punkte.push({ x: gx + 0.05 + rnd() * 0.9, y: gy + 0.05 + rnd() * 0.9, r: 0.14 + rnd() * 0.16, p: rnd() * TAU, d: rnd() < 0.5 ? 1 : -1 });
        }
      }
      kaustik = { S: view.S, px: Math.max(32, Math.round(KAUSTIK_CM * view.S)), bilder: [], punkte };
    }
    const t0 = performance.now();
    while (kaustik.bilder.length < KAUSTIK_N && performance.now() - t0 < budgetMs) kaustik.bilder.push(kaustikBild(kaustik.bilder.length));
  }

  function kaustikBild(f) {
    const T = kaustik.px;
    const G = KAUSTIK_G;
    const c = leinwandPx(T, T);
    const k = c.getContext("2d");
    const bild = k.createImageData(T, T);
    const daten = bild.data;
    const ph = (f / KAUSTIK_N) * TAU;
    const pos = kaustik.punkte.map((q) => ({ x: q.x + Math.cos(q.p + q.d * ph) * q.r, y: q.y + Math.sin(q.p + q.d * ph) * q.r }));
    for (let py = 0; py < T; py += 1) {
      for (let px = 0; px < T; px += 1) {
        // Leicht verzogen, damit die Linien sich biegen (periodisch in der Kachel).
        let u = (px / T) * G;
        let v = (py / T) * G;
        u += 0.2 * Math.sin((v / G) * TAU * 2 + ph) + 0.08 * Math.sin((v / G) * TAU * 5 - ph);
        v += 0.2 * Math.sin((u / G) * TAU * 2 - ph * 0.5) + 0.08 * Math.sin((u / G) * TAU * 4 + ph);
        const cx = Math.floor(u);
        const cy = Math.floor(v);
        let f1 = 9;
        let f2 = 9;
        for (let dy = -1; dy <= 1; dy += 1) {
          for (let dx = -1; dx <= 1; dx += 1) {
            const gx = cx + dx;
            const gy = cy + dy;
            const wx = ((gx % G) + G) % G;
            const wy = ((gy % G) + G) % G;
            const q = pos[wy * G + wx];
            const ex = q.x + (gx - wx) - u;
            const ey = q.y + (gy - wy) - v;
            const d = ex * ex + ey * ey;
            if (d < f1) { f2 = f1; f1 = d; } else if (d < f2) f2 = d;
          }
        }
        const e = Math.sqrt(f2) - Math.sqrt(f1);
        const linie = Math.exp(-(e * e) / 0.0016);
        const weich = Math.exp(-(e * e) / 0.012) * 0.16;
        // Hier heller, dort schwächer – wie Wolkenschatten im Kleinen.
        const hell = 0.55 + 0.45 * Math.sin((px / T) * TAU + ph * 0.5) * Math.sin((py / T) * TAU * 2 - ph * 0.3);
        const a = Math.min(1, (linie * 0.9 + weich) * hell);
        const i = (py * T + px) * 4;
        daten[i] = 255;
        daten[i + 1] = 250;
        daten[i + 2] = 226;
        daten[i + 3] = Math.round(a * 255);
      }
    }
    k.putImageData(bild, 0, 0);
    return c;
  }

  // Die Lichtnetze einer fertigen Kachel: die vier Phasen als Ausschnitte
  // so breit wie das Wasser; die erste gleich in die Kachel selbst.
  function lichtnetzePhasen(kc) {
    kaustikVorbereiten(Infinity);
    const S = view.S;
    // Wie breit das Wasser in dieser Kachel ist (in Bildpunkten der Kachel).
    let x0 = Infinity;
    let x1 = -Infinity;
    for (let y = kc.ya - 1; y <= kc.yb + 1; y += 2) {
      const { m, h } = bachBild(y);
      x0 = Math.min(x0, m - h);
      x1 = Math.max(x1, m + h);
    }
    kc.wx0 = clamp(Math.floor((x0 - kc.xa) * S) - 2, 0, view.kwPx);
    kc.wx1 = clamp(Math.ceil((x1 - kc.xa) * S) + 2, 0, view.kwPx);
    const breit = Math.max(1, kc.wx1 - kc.wx0);
    kc.phasen = [];
    for (let p = 0; p < KAUSTIK_N; p += 1) {
      const c = leinwandPx(breit, KACHEL_PX);
      c.getContext("2d").drawImage(kc.c, kc.wx0, 0, breit, KACHEL_PX, 0, 0, breit, KACHEL_PX);
      lichtnetzMalen(c.getContext("2d"), kc, p, kc.wx0);
      kc.phasen.push(c);
    }
    // Die Kachel selbst trägt immer die Phase, die gerade gilt.
    kc.phase = 0;
    kc.k.save();
    kc.k.setTransform(1, 0, 0, 1, 0, 0);
    kc.k.drawImage(kc.phasen[0], kc.wx0, 0);
    kc.k.restore();
  }

  // Ein Lichtnetz der Phase p in eine Kachel (oder ihren Ausschnitt, der bei
  // dx Bildpunkten beginnt): an der Welt fest, Zeile um Zeile, je Band nach
  // der Tiefe aufgehellt.
  function lichtnetzMalen(k, kc, p, dx) {
    const S = view.S;
    const bild = kaustik.bilder[p];
    const T = bild.width;
    const muster = k.createPattern(bild, "repeat");
    if (!muster) return;
    if (muster.setTransform) muster.setTransform(new DOMMatrix().translate((((view.kHalbPx - dx) % T) + T) % T, (((kc.i + 1) * KACHEL_PX) % T + T) % T));
    k.save();
    k.setTransform(1, 0, 0, 1, 0, 0);
    k.globalCompositeOperation = "lighter";
    k.fillStyle = muster;
    const ZEILE = 4;
    const BAENDER = [[-0.97, -0.62, 1], [-0.62, -0.3, 0.55], [-0.3, 0.3, 0.3], [0.3, 0.62, 0.55], [0.62, 0.97, 1]];
    for (let py = 0; py < KACHEL_PX; py += ZEILE) {
      const y = kc.yb - (py + ZEILE / 2) / S;
      let kraft = zahlBei(y, "kaustik");
      // In der Hechtgrube kommt kaum Licht auf den Grund, im Seitenbach viel.
      for (const hg of state.hechte) kraft *= 1 - 0.75 * glatt(1 - Math.abs(y - hg.cy) / (hg.ry + 30));
      if (kraft < 0.01) continue;
      const { m, h } = bachBild(y);
      BAENDER.forEach(([u0, u1, f]) => {
        const xa = Math.round((m + u0 * h - kc.xa) * S) - dx;
        const xb = Math.round((m + u1 * h - kc.xa) * S) - dx;
        if (xb <= xa) return;
        k.globalAlpha = Math.min(1, kraft * f);
        k.fillRect(xa, py, xb - xa, ZEILE);
      });
    }
    k.restore();
  }

  function sichtY() {
    const s = view.s;
    return { yu: state.camY - (view.cssH - view.ankerY) / s - 4, yo: state.camY + view.ankerY / s + 4 };
  }

  // Die Kacheln ins Bild, mit den Lichtnetzen in ihrer Phase: die von
  // jetzt deckend, die nächste darüber, immer kräftiger.
  function zeichneKacheln() {
    const [i0, i1] = kachelBereich(view.cyp);
    const X = view.mxp - view.kHalbPx - view.cxp;
    const ph = ruhig() ? 0 : state.zeit / PHASE_DAUER;
    const a = Math.floor(ph) % KAUSTIK_N;
    const b = (a + 1) % KAUSTIK_N;
    const f = ruhig() ? 0 : glatt(((ph - Math.floor(ph)) - 0.68) / 0.32);
    for (let i = i0; i <= i1; i += 1) {
      const kc = kachelHolen(i);
      kachelFertig(kc);
      const Y = view.myp - (i + 1) * KACHEL_PX + view.cyp;
      if (kc.phase !== a && kc.wx1 > kc.wx0) {
        kc.k.save();
        kc.k.setTransform(1, 0, 0, 1, 0, 0);
        kc.k.drawImage(kc.phasen[a], kc.wx0, 0);
        kc.k.restore();
        kc.phase = a;
      }
      g.drawImage(kc.c, X, Y);
      if (f > 0.02 && kc.wx1 > kc.wx0) {
        g.globalAlpha = f;
        g.drawImage(kc.phasen[b], X + kc.wx0, Y);
        g.globalAlpha = 1;
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Malen: kleine Bilder, einmal gemalt
  // ---------------------------------------------------------------------------
  // Ein Bild in Zentimetern: halb cm in jede Richtung um die Mitte, y nach
  // oben. malen(k) malt darin.
  function bildCm(halbX, halbY, malen, massstab = view.S) {
    const w = Math.ceil(halbX * 2 * massstab) + 2;
    const h = Math.ceil(halbY * 2 * massstab) + 2;
    const c = leinwandPx(w, h);
    const k = c.getContext("2d");
    const cx = Math.round(w / 2);
    const cy = Math.round(h / 2);
    k.setTransform(massstab, 0, 0, -massstab, cx, cy);
    k.lineCap = "round";
    k.lineJoin = "round";
    malen(k);
    return { c, cx, cy };
  }

  // Weiche Scheine (Licht, Glanz, Glühwürmchen), r in CSS-Pixeln.
  const SCHEINE = {
    weiss: [255, 255, 255], warm: [255, 230, 170], gruen: [214, 255, 140], kalt: [190, 220, 255], rosa: [255, 190, 200],
  };
  function scheinBild(name) {
    const key = `schein:${name}:${view.dpr}`;
    if (sprites.has(key)) return sprites.get(key);
    const n = Math.max(8, Math.round(32 * view.dpr));
    const c = leinwandPx(n, n);
    const k = c.getContext("2d");
    const v = k.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2);
    const f = SCHEINE[name];
    v.addColorStop(0, rgba(f, 1));
    v.addColorStop(0.22, rgba(f, 0.55));
    v.addColorStop(1, rgba(f, 0));
    k.fillStyle = v;
    k.fillRect(0, 0, n, n);
    sprites.set(key, c);
    return c;
  }
  function schein(name, x, y, r, alpha = 1) {
    if (alpha <= 0.01) return;
    g.globalAlpha = Math.min(1, alpha);
    g.drawImage(scheinBild(name), x - r, y - r, 2 * r, 2 * r);
    g.globalAlpha = 1;
  }

  let sprites = new Map();

  // Ein Seerosenblatt: fast rund, mit der Kerbe bis zur Mitte, Adern
  // strahlenförmig, der Rand leicht gewellt und zur Sonne hin hell, ein
  // Glanz, ein paar Flecken und Wassertropfen.
  function blattScheibe(k, x, y, r, kerbe, rnd, F, alt = 0) {
    const spalt = 0.1;
    const rand = (a) => r * (1 + 0.018 * Math.sin(a * 5 + kerbe * 3) + 0.01 * Math.sin(a * 11));
    const umriss = () => {
      k.beginPath();
      k.moveTo(x, y);
      for (let i = 0; i <= 64; i += 1) {
        const a = kerbe + spalt + (i / 64) * (TAU - 2 * spalt);
        k.lineTo(x + Math.cos(a) * rand(a), y + Math.sin(a) * rand(a));
      }
      k.closePath();
    };
    const blatt = mix3(F.blatt, [150, 140, 60], alt * 0.5);
    const hell = mix3(F.blattHell, [214, 200, 110], alt * 0.4);
    const v = k.createRadialGradient(x - r * 0.15, y + r * 0.15, r * 0.05, x, y, r * 1.02);
    v.addColorStop(0, rgb(mix3(hell, blatt, 0.25)));
    v.addColorStop(0.55, rgb(mix3(hell, blatt, 0.62)));
    v.addColorStop(0.9, rgb(blatt));
    v.addColorStop(1, rgb(mix3(blatt, [0, 0, 0], 0.25)));
    k.fillStyle = v;
    umriss();
    k.fill();
    // Adern: von der Mitte zum Rand, gegabelt.
    k.strokeStyle = rgba(mix3(hell, [255, 255, 220], 0.4), 0.42);
    k.lineWidth = Math.max(0.05, r * 0.012);
    const zahl = 17;
    for (let i = 0; i < zahl; i += 1) {
      const a = kerbe + spalt + 0.12 + ((i + 0.5) / zahl) * (TAU - 2 * spalt - 0.24);
      const bug = (rnd() - 0.5) * 0.12;
      k.beginPath();
      k.moveTo(x + Math.cos(a) * r * 0.05, y + Math.sin(a) * r * 0.05);
      k.quadraticCurveTo(x + Math.cos(a + bug) * r * 0.5, y + Math.sin(a + bug) * r * 0.5, x + Math.cos(a) * r * 0.92, y + Math.sin(a) * r * 0.92);
      k.stroke();
      if (i % 2 === 0) {
        k.beginPath();
        k.moveTo(x + Math.cos(a) * r * 0.6, y + Math.sin(a) * r * 0.6);
        k.lineTo(x + Math.cos(a + 0.11) * r * 0.9, y + Math.sin(a + 0.11) * r * 0.9);
        k.stroke();
      }
    }
    // Der aufgebogene Rand: zur Sonne hell, auf der anderen Seite dunkel.
    k.lineWidth = Math.max(0.08, r * 0.035);
    k.strokeStyle = rgba(mix3(hell, [255, 255, 230], 0.5), 0.75);
    k.beginPath();
    for (let a = 1.3; a <= 3.4; a += 0.08) if (Math.abs(winkelDiff(a, kerbe)) > spalt + 0.04) k.lineTo(x + Math.cos(a) * rand(a) * 0.985, y + Math.sin(a) * rand(a) * 0.985);
    k.stroke();
    k.strokeStyle = rgba(mix3(blatt, [0, 0, 0], 0.5), 0.6);
    k.beginPath();
    for (let a = 4.4; a <= 6.4; a += 0.08) if (Math.abs(winkelDiff(a, kerbe)) > spalt + 0.04) k.lineTo(x + Math.cos(a) * rand(a) * 0.985, y + Math.sin(a) * rand(a) * 0.985);
    k.stroke();
    // Alte Flecken am Rand.
    const flecken = Math.floor(rnd() * 4 + alt * 3);
    for (let i = 0; i < flecken; i += 1) {
      const a = rnd() * TAU;
      if (Math.abs(winkelDiff(a, kerbe)) < 0.3) continue;
      const d = r * (0.7 + rnd() * 0.22);
      k.fillStyle = rgba(rnd() < 0.5 ? [170, 130, 50] : [120, 70, 40], 0.45);
      k.beginPath();
      k.ellipse(x + Math.cos(a) * d, y + Math.sin(a) * d, r * (0.04 + rnd() * 0.06), r * (0.03 + rnd() * 0.04), a, 0, TAU);
      k.fill();
    }
    // Der Glanz.
    const gl = k.createRadialGradient(x - r * 0.32, y + r * 0.34, 0, x - r * 0.32, y + r * 0.34, r * 0.55);
    gl.addColorStop(0, "rgba(255,255,240,0.22)");
    gl.addColorStop(1, "rgba(255,255,240,0)");
    k.fillStyle = gl;
    umriss();
    k.fill();
    // Wassertropfen: kleine Perlen mit Lichtpunkt.
    const tropfen = Math.floor(rnd() * 3);
    for (let i = 0; i < tropfen; i += 1) {
      const a = rnd() * TAU;
      const d = r * (0.35 + rnd() * 0.45);
      const px = x + Math.cos(a) * d;
      const py = y + Math.sin(a) * d;
      const tr = 0.22 + rnd() * 0.22;
      k.fillStyle = "rgba(20,50,30,0.35)";
      k.beginPath();
      k.arc(px + tr * 0.3, py - tr * 0.3, tr, 0, TAU);
      k.fill();
      k.fillStyle = rgba(mix3(hell, [255, 255, 255], 0.35), 0.85);
      k.beginPath();
      k.arc(px, py, tr, 0, TAU);
      k.fill();
      k.fillStyle = "rgba(255,255,255,0.95)";
      k.beginPath();
      k.arc(px - tr * 0.35, py + tr * 0.35, tr * 0.32, 0, TAU);
      k.fill();
    }
  }

  // Eine Seerose: zwei Kränze spitzer Blütenblätter, weiss bis rosa, innen
  // die gelben Staubblätter.
  function seerose(k, x, y, r, rosa, rnd) {
    k.fillStyle = "rgba(10,30,10,0.3)";
    k.beginPath();
    k.arc(x + SONNE.x * 1.3, y + SONNE.y * 1.3, r * 0.95, 0, TAU);
    k.fill();
    const kraenze = [[11, 1, 0], [9, 0.74, 0.3], [7, 0.5, 0.55]];
    kraenze.forEach(([n, f, d], kr) => {
      const w0 = rnd() * TAU;
      for (let i = 0; i < n; i += 1) {
        const a = w0 + (i / n) * TAU;
        const l = r * f;
        const c1 = mix3([255, 252, 248], rosa ? [236, 120, 160] : [255, 236, 236], 0.25 + d * 0.5);
        const spitze = mix3(c1, rosa ? [214, 70, 120] : [250, 210, 220], 0.6);
        const v = k.createLinearGradient(x, y, x + Math.cos(a) * l, y + Math.sin(a) * l);
        v.addColorStop(0, rgb(mix3(c1, [255, 255, 220], 0.4)));
        v.addColorStop(1, rgb(spitze));
        k.fillStyle = v;
        blattUmriss(k, x + Math.cos(a) * l * 0.5, y + Math.sin(a) * l * 0.5, a, l, k.fillStyle, null, 0.38);
        k.strokeStyle = `rgba(160,110,120,${0.25 + kr * 0.05})`;
        k.lineWidth = 0.04;
        k.beginPath();
        k.moveTo(x + Math.cos(a) * l * 0.15, y + Math.sin(a) * l * 0.15);
        k.lineTo(x + Math.cos(a) * l * 0.92, y + Math.sin(a) * l * 0.92);
        k.stroke();
      }
    });
    k.fillStyle = "#f2b820";
    k.beginPath();
    k.arc(x, y, r * 0.24, 0, TAU);
    k.fill();
    k.fillStyle = "#ffe066";
    for (let i = 0; i < 14; i += 1) {
      const a = rnd() * TAU;
      const d = rnd() * r * 0.2;
      k.beginPath();
      k.arc(x + Math.cos(a) * d, y + Math.sin(a) * d, r * 0.04, 0, TAU);
      k.fill();
    }
  }

  function blattBild(p) {
    if (p.bild && p.bild.S === view.S) return p.bild;
    let rx = 0;
    let ry = 0;
    p.kreise.forEach((c) => { rx = Math.max(rx, Math.abs(c.x) + c.r); ry = Math.max(ry, Math.abs(c.y) + c.r); });
    const blume = p.bluete ? 4.2 : 0;
    const rnd = wuerfel(Math.floor(p.saat * 1e9) + p.nr * 31);
    const F = FARBEN[weltBei(p.y)];
    const bild = bildCm(rx + blume + 0.5, ry + blume + 0.5, (k) => {
      const reihe = p.kreise.map((c, i) => ({ ...c, i })).sort((a, b) => b.y - a.y);
      reihe.forEach((c) => blattScheibe(k, c.x, c.y, c.r, p.kerbe + c.i * 2.1, rnd, F, rnd() * 0.5));
      if (p.bluete) {
        const c = p.kreise[0];
        const a = p.kerbe + Math.PI * (0.6 + rnd() * 0.8);
        seerose(k, c.x + Math.cos(a) * c.r * 0.86, c.y + Math.sin(a) * c.r * 0.86, 2.6, p.bluete === 2, rnd);
      }
    });
    // Nur so gross wie das, was darauf ist (die Blüte ragt nur zu einer
    // Seite hinaus) – jedes Blatt wird je Bild gelegt.
    p.bild = { ...zuschneiden(bild), S: view.S };
    return p.bild;
  }

  // Ein Ahornblatt für die Strömung: fünf Lappen, gesägt, in Herbstfarben.
  function laubBild(s, variante) {
    const key = `laub:${variante}:${Math.round(s.r * 10)}:${view.S}`;
    if (sprites.has(key)) return sprites.get(key);
    const r = s.r;
    const farben = [[[232, 120, 40], [250, 196, 70]], [[200, 60, 36], [240, 140, 60]], [[226, 170, 40], [250, 220, 100]]][variante];
    const bild = bildCm(r * 1.15, r * 1.15, (k) => {
      const rnd = wuerfel(77 + variante);
      k.beginPath();
      const n = 90;
      for (let i = 0; i <= n; i += 1) {
        const a = (i / n) * TAU;
        // Fünf Lappen, nach oben gerichtet; unten der Stiel.
        const lappen = Math.abs(Math.cos((a - Math.PI / 2) * 2.5));
        const zahn = (i % 3 === 0 ? 0.08 : 0);
        const rr = r * (0.42 + 0.58 * lappen ** 0.7 - zahn) * (a > Math.PI * 1.3 && a < Math.PI * 1.7 ? 0.65 : 1);
        k.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
      }
      k.closePath();
      const v = k.createRadialGradient(-r * 0.2, r * 0.2, 0, 0, 0, r);
      v.addColorStop(0, rgb(farben[1]));
      v.addColorStop(1, rgb(farben[0]));
      k.fillStyle = v;
      k.fill();
      k.strokeStyle = rgba(mix3(farben[0], [0, 0, 0], 0.4), 0.6);
      k.lineWidth = 0.1;
      k.stroke();
      k.strokeStyle = rgba(mix3(farben[1], [255, 255, 220], 0.4), 0.8);
      k.lineWidth = 0.12;
      for (let i = 0; i < 5; i += 1) {
        const a = Math.PI / 2 + (i - 2) * 0.72;
        k.beginPath();
        k.moveTo(0, -r * 0.1);
        k.lineTo(Math.cos(a) * r * 0.85, Math.sin(a) * r * 0.85);
        k.stroke();
      }
      k.strokeStyle = "#6a4020";
      k.lineWidth = 0.16;
      k.beginPath();
      k.moveTo(0, -r * 0.1);
      k.lineTo(rnd() * 0.3, -r * 0.95);
      k.stroke();
    });
    sprites.set(key, bild);
    return bild;
  }

  // Ein Fisch von oben (Länge l): Kopf vorn (+x), der Leib schlank, die
  // Schwanzflosse gegabelt, die Brustflossen. art: "fisch" oder "hecht".
  // weich: wie unscharf (er ist tief), schatten: nur der dunkle Umriss.
  function fischForm(k, l, hecht) {
    const b = hecht ? l * 0.1 : l * 0.17;
    k.beginPath();
    if (hecht) {
      // Der Hecht: lang, die Schnauze breit und flach wie ein Entenschnabel.
      k.moveTo(l * 0.5, 0);
      k.quadraticCurveTo(l * 0.48, b * 0.55, l * 0.32, b * 0.62);
      k.quadraticCurveTo(l * 0.1, b * 1.05, -l * 0.25, b * 0.8);
      k.quadraticCurveTo(-l * 0.4, b * 0.45, -l * 0.42, b * 0.25);
      k.lineTo(-l * 0.5, b * 0.95);
      k.lineTo(-l * 0.47, 0);
      k.lineTo(-l * 0.5, -b * 0.95);
      k.lineTo(-l * 0.42, -b * 0.25);
      k.quadraticCurveTo(-l * 0.4, -b * 0.45, -l * 0.25, -b * 0.8);
      k.quadraticCurveTo(l * 0.1, -b * 1.05, l * 0.32, -b * 0.62);
      k.quadraticCurveTo(l * 0.48, -b * 0.55, l * 0.5, 0);
    } else {
      k.moveTo(l * 0.5, 0);
      k.quadraticCurveTo(l * 0.45, b * 0.9, l * 0.15, b);
      k.quadraticCurveTo(-l * 0.2, b * 0.85, -l * 0.33, b * 0.3);
      k.lineTo(-l * 0.5, b * 0.85);
      k.quadraticCurveTo(-l * 0.44, 0, -l * 0.5, -b * 0.85);
      k.lineTo(-l * 0.33, -b * 0.3);
      k.quadraticCurveTo(-l * 0.2, -b * 0.85, l * 0.15, -b);
      k.quadraticCurveTo(l * 0.45, -b * 0.9, l * 0.5, 0);
    }
    k.closePath();
  }

  function fischBild(hecht, weich, schatten) {
    const key = `fisch:${hecht ? 1 : 0}:${weich}:${schatten ? 1 : 0}:${view.S}`;
    if (sprites.has(key)) return sprites.get(key);
    const l = hecht ? 30 : 11;
    const unschaerfe = [0, 0.5, 1.3][weich] * (hecht ? 1.6 : 1);
    const bild = bildCm(l * 0.62 + unschaerfe, l * 0.3 + unschaerfe, (k) => {
      const versatz = unschaerfe > 0 ? [[0, 0], ...Array.from({ length: 8 }, (_, i) => [Math.cos((i / 8) * TAU) * unschaerfe, Math.sin((i / 8) * TAU) * unschaerfe])] : [[0, 0]];
      if (schatten) {
        k.fillStyle = `rgba(0,10,6,${0.9 / versatz.length + 0.05})`;
        versatz.forEach(([dx, dy]) => { k.save(); k.translate(dx, dy); fischForm(k, l, hecht); k.fill(); k.restore(); });
        return;
      }
      if (unschaerfe > 0) {
        k.fillStyle = `rgba(30,48,36,${0.9 / versatz.length + 0.04})`;
        versatz.forEach(([dx, dy]) => { k.save(); k.translate(dx, dy); fischForm(k, l, hecht); k.fill(); k.restore(); });
        return;
      }
      // Scharf: Rücken dunkel, Flanken heller, Flossen, beim Hecht die
      // hellen Flecken, beim Fisch rötliche Flossen (eine Rotfeder).
      const v = k.createLinearGradient(0, l * 0.12, 0, -l * 0.12);
      if (hecht) {
        v.addColorStop(0, "#8c9a5a");
        v.addColorStop(0.5, "#3e4a26");
        v.addColorStop(1, "#8c9a5a");
      } else {
        v.addColorStop(0, "#b8a070");
        v.addColorStop(0.5, "#3c4430");
        v.addColorStop(1, "#b8a070");
      }
      k.fillStyle = v;
      fischForm(k, l, hecht);
      k.fill();
      if (hecht) {
        k.fillStyle = "rgba(220,214,140,0.55)";
        const rnd = wuerfel(55);
        for (let i = 0; i < 40; i += 1) {
          const x = -l * 0.35 + rnd() * l * 0.62;
          const y = (rnd() - 0.5) * l * 0.13;
          k.beginPath();
          k.ellipse(x, y, l * 0.012, l * 0.006, 0, 0, TAU);
          k.fill();
        }
        k.fillStyle = "#2a3018";
        k.beginPath();
        k.ellipse(-l * 0.33, 0, l * 0.06, l * 0.012, 0, 0, TAU);
        k.fill();
        k.fillStyle = "#e8e0b0";
        [-1, 1].forEach((s) => { k.beginPath(); k.arc(l * 0.36, s * l * 0.035, l * 0.011, 0, TAU); k.fill(); });
      } else {
        k.fillStyle = "rgba(200,80,50,0.75)";
        [-1, 1].forEach((s) => {
          k.beginPath();
          k.ellipse(l * 0.18, s * l * 0.17, l * 0.1, l * 0.035, s * 0.6, 0, TAU);
          k.fill();
        });
        k.fillStyle = "rgba(200,80,50,0.6)";
        k.beginPath();
        k.moveTo(-l * 0.33, 0);
        k.lineTo(-l * 0.5, l * 0.15);
        k.lineTo(-l * 0.45, 0);
        k.lineTo(-l * 0.5, -l * 0.15);
        k.closePath();
        k.fill();
        k.strokeStyle = "rgba(20,24,16,0.8)";
        k.lineWidth = l * 0.02;
        k.beginPath();
        k.moveTo(l * 0.3, 0);
        k.lineTo(-l * 0.3, 0);
        k.stroke();
        k.fillStyle = "#e8e4c8";
        [-1, 1].forEach((s) => { k.beginPath(); k.arc(l * 0.38, s * l * 0.07, l * 0.025, 0, TAU); k.fill(); });
      }
    });
    sprites.set(key, bild);
    return bild;
  }

  // Ein Bild drehen und legen (für Fische, Laub): Mitte bei (x, y) in CSS-Pixeln.
  function bildDrehen(b, x, y, w, alpha = 1, f = 1) {
    if (alpha <= 0.01) return;
    g.save();
    g.globalAlpha = Math.min(1, alpha);
    g.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
    g.translate(x, y);
    g.rotate(-w);
    g.scale(f / view.dpr, f / view.dpr);
    g.drawImage(b.c, -b.cx, -b.cy);
    g.restore();
  }

  // Ein Bild unverdreht und Punkt auf Punkt legen.
  function bildLegen(b, x, y, alpha = 1) {
    if (alpha <= 0.01) return;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalAlpha = Math.min(1, alpha);
    g.drawImage(b.c, Math.round(x * view.dpr) - b.cx, Math.round(y * view.dpr) - b.cy);
    g.globalAlpha = 1;
    g.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
  }

  // ---------------------------------------------------------------------------
  // Malen: Zweige über dem Ufer (vorn)
  // ---------------------------------------------------------------------------
  // Ein Blatt einer Art, am Stiel bei (x, y), nach w gerichtet.
  function zweigBlatt(k, art, x, y, w, l, farbe, hell, rnd) {
    const c = Math.cos(w);
    const s = Math.sin(w);
    const P = (u, v) => [x + c * u - s * v, y + s * u + c * v];
    const breit = { weide: 0.15, erle: 0.42, buche: 0.32, birke: 0.36 }[art] || 0.3;
    const b = l * breit;
    const umriss = (zaehne) => {
      k.beginPath();
      const n = 22;
      for (let i = 0; i <= n; i += 1) {
        const u = i / n;
        let br;
        if (art === "erle") br = Math.sin(Math.PI * Math.min(1, u * 1.08)) ** 0.7 * (u > 0.93 ? 0.55 : 1);
        else if (art === "birke") br = u < 0.38 ? Math.sin((u / 0.38) * Math.PI / 2) : (1 - (u - 0.38) / 0.62) ** 0.9;
        else br = Math.sin(Math.PI * u) ** (art === "weide" ? 0.8 : 0.85);
        const z = zaehne && i % 2 ? 0.88 : 1;
        const [px, py] = P(u * l, br * b * z);
        k.lineTo(px, py);
      }
      for (let i = n; i >= 0; i -= 1) {
        const u = i / n;
        let br;
        if (art === "erle") br = Math.sin(Math.PI * Math.min(1, u * 1.08)) ** 0.7 * (u > 0.93 ? 0.55 : 1);
        else if (art === "birke") br = u < 0.38 ? Math.sin((u / 0.38) * Math.PI / 2) : (1 - (u - 0.38) / 0.62) ** 0.9;
        else br = Math.sin(Math.PI * u) ** (art === "weide" ? 0.8 : 0.85);
        const z = zaehne && i % 2 ? 0.88 : 1;
        const [px, py] = P(u * l, -br * b * z);
        k.lineTo(px, py);
      }
      k.closePath();
    };
    umriss(art === "erle" || art === "birke");
    k.fillStyle = rgb(farbe);
    k.fill();
    // Die Hälfte zur Sonne heller.
    const sonne = -s * -0.5 + c * 0.6 > 0 ? 1 : -1;
    k.save();
    k.clip();
    k.fillStyle = rgba(hell, 0.55);
    k.beginPath();
    const [a1, b1] = P(0, 0);
    const [a2, b2] = P(l, 0);
    const [a3, b3] = P(l, sonne * b * 1.2);
    const [a4, b4] = P(0, sonne * b * 1.2);
    k.moveTo(a1, b1);
    k.lineTo(a2, b2);
    k.lineTo(a3, b3);
    k.lineTo(a4, b4);
    k.closePath();
    k.fill();
    k.restore();
    // Die Adern.
    k.strokeStyle = rgba(mix3(hell, [255, 255, 230], 0.4), 0.55);
    k.lineWidth = Math.max(0.03, l * 0.025);
    k.beginPath();
    k.moveTo(...P(0, 0));
    k.lineTo(...P(l * 0.95, 0));
    k.stroke();
    if (art !== "weide") {
      const paare = art === "buche" ? 7 : 5;
      k.lineWidth = Math.max(0.02, l * 0.012);
      for (let i = 1; i <= paare; i += 1) {
        const u = (i / (paare + 1)) * l;
        for (const sg of [-1, 1]) {
          k.beginPath();
          k.moveTo(...P(u, 0));
          k.lineTo(...P(u + l * 0.16, sg * b * 0.8));
          k.stroke();
        }
      }
    }
  }

  function zweigBild(z) {
    const key = `zweig:${z.j}:${view.S}`;
    if (sprites.has(key)) return sprites.get(key);
    const F = FARBEN[weltBei(z.y)];
    const rnd = zellZufall(z.j, 79);
    const L = 15 + rnd() * 5;
    const dunkel = F.dunkel;
    const bild = bildCm(L + 6, L + 6, (k) => {
      k.rotate(z.w);
      // Der Ast mit seinen Zweigen: [x0, y0, w, l, dick]
      const aeste = [[-4, 0, (rnd() - 0.5) * 0.3, L + 4, 0.55]];
      const zahlAeste = z.art === "weide" ? 6 : 4;
      for (let i = 0; i < zahlAeste; i += 1) {
        const u = 0.2 + rnd() * 0.65;
        const breit = z.art === "weide" ? 0.25 + rnd() * 0.35 : 0.5 + rnd() * 0.5;
        aeste.push([-4 + (L + 4) * u, 0, (rnd() < 0.5 ? 1 : -1) * breit, L * (z.art === "weide" ? 0.45 + rnd() * 0.35 : 0.3 + rnd() * 0.35), z.art === "weide" ? 0.12 : 0.28]);
      }
      const rinde = z.art === "birke" ? [220, 214, 200] : z.art === "fichte" ? [60, 46, 36] : [92, 72, 52];
      const blattF = mix3(F.blatt, [10, 18, 24], dunkel * 0.6);
      const hellF = mix3(F.blattHell, [80, 110, 140], dunkel * 0.5);
      // Erst der Schatten des Laubs auf das Laub darunter: nichts; dann Äste.
      k.strokeStyle = rgb(mix3(rinde, [0, 0, 0], dunkel * 0.5));
      const punkte = [];
      aeste.forEach(([x0, y0, w, l, dick], i) => {
        const bx = i === 0 ? x0 : x0;
        k.lineWidth = dick;
        k.beginPath();
        k.moveTo(bx, y0);
        const ex = bx + Math.cos(w) * l;
        const ey = y0 + Math.sin(w) * l;
        const mx = (bx + ex) / 2 + (rnd() - 0.5) * 2;
        const my = (y0 + ey) / 2 + (rnd() - 0.5) * 2;
        k.quadraticCurveTo(mx, my, ex, ey);
        k.stroke();
        const proAst = z.art === "weide" ? 11 : 14;
        for (let j = 0; j < proAst; j += 1) {
          const u = 0.15 + (j / proAst) * 0.85;
          const px = (1 - u) * (1 - u) * bx + 2 * (1 - u) * u * mx + u * u * ex;
          const py = (1 - u) * (1 - u) * y0 + 2 * (1 - u) * u * my + u * u * ey;
          punkte.push([px, py, Math.atan2(ey - y0, ex - bx), j % 2 ? 1 : -1]);
        }
      });
      if (z.art === "fichte") {
        // Nadeln: dicht, kurz, nach vorn geneigt.
        punkte.forEach(([px, py, w, sg]) => {
          for (let i = 0; i < 9; i += 1) {
            const a = w + sg * (0.6 + rnd() * 0.7) * (i % 2 ? 1 : -1);
            const l = 1.1 + rnd() * 0.6;
            k.strokeStyle = rgb(mix3(blattF, hellF, rnd() * 0.5));
            k.lineWidth = 0.16;
            k.beginPath();
            k.moveTo(px, py);
            k.lineTo(px + Math.cos(a) * l, py + Math.sin(a) * l);
            k.stroke();
          }
        });
        k.strokeStyle = "rgba(200,225,255,0.35)";
        k.lineWidth = 0.1;
        punkte.forEach(([px, py, w]) => {
          k.beginPath();
          k.moveTo(px, py);
          k.lineTo(px + Math.cos(w + 1.9) * 1.2, py + Math.sin(w + 1.9) * 1.2);
          k.stroke();
        });
        return;
      }
      const groesse = { weide: 4.4, erle: 2.6, buche: 3.4, birke: 1.9, kastanie: 4.2 }[z.art] || 3;
      if (z.art === "kastanie") {
        // Die Rosskastanie: Hände aus fünf bis sieben Fingerblättern.
        punkte.forEach(([px, py, w, sg], i) => {
          if (i % 3) return;
          const a0 = w + sg * (0.6 + rnd() * 0.5);
          const hx = px + Math.cos(a0) * 1.6;
          const hy = py + Math.sin(a0) * 1.6;
          k.strokeStyle = rgb(mix3(blattF, [90, 70, 40], 0.5));
          k.lineWidth = 0.12;
          k.beginPath();
          k.moveTo(px, py);
          k.lineTo(hx, hy);
          k.stroke();
          const n = 5 + (rnd() < 0.5 ? 2 : 0);
          for (let j = 0; j < n; j += 1) {
            const u = j / (n - 1) - 0.5;
            const a = a0 + u * 2.6;
            const l = groesse * (1 - Math.abs(u) * 0.75) * (0.85 + rnd() * 0.2);
            zweigBlatt(k, "buche", hx, hy, a, l, mix3(blattF, hellF, rnd() * 0.5), mix3(hellF, [255, 250, 200], 0.25), rnd);
          }
        });
        return;
      }
      punkte.forEach(([px, py, w, sg]) => {
        const n = 1;
        for (let i = 0; i < n; i += 1) {
          const a = w + sg * (z.art === "weide" ? 0.25 + rnd() * 0.3 : 0.5 + rnd() * 0.7);
          const l = groesse * (0.75 + rnd() * 0.45);
          const farbe = mix3(blattF, hellF, rnd() * 0.55);
          zweigBlatt(k, z.art, px, py, a, l, farbe, mix3(hellF, [255, 250, 200], 0.25), rnd);
        }
      });
      // Erlenzapfen und Kätzchen.
      if (z.art === "erle") {
        for (let i = 0; i < 3; i += 1) {
          const [px, py] = punkte[Math.floor(rnd() * punkte.length)];
          k.fillStyle = "#5a3a24";
          for (let j = 0; j < 3; j += 1) { k.beginPath(); k.ellipse(px + j * 0.6, py + 0.3 * j, 0.45, 0.32, 0.4, 0, TAU); k.fill(); }
        }
      }
    }, view.S * VORN);
    const knapp = zuschneiden(bild);
    sprites.set(key, knapp);
    return knapp;
  }

  // Ein Bild auf das zuschneiden, was darin gemalt ist: Durchsichtige
  // Ränder kosten beim Legen so viel wie Gemaltes.
  function zuschneiden(b) {
    const { width: w, height: h } = b.c;
    let daten;
    try { daten = b.c.getContext("2d").getImageData(0, 0, w, h).data; } catch { return b; }
    let x0 = w;
    let y0 = h;
    let x1 = -1;
    let y1 = -1;
    for (let y = 0; y < h; y += 1) {
      for (let x = 0; x < w; x += 1) {
        if (daten[(y * w + x) * 4 + 3] > 3) {
          if (x < x0) x0 = x;
          if (x > x1) x1 = x;
          if (y < y0) y0 = y;
          if (y > y1) y1 = y;
        }
      }
    }
    if (x1 < 0) return b;
    const c = leinwandPx(x1 - x0 + 1, y1 - y0 + 1);
    c.getContext("2d").drawImage(b.c, x0, y0, c.width, c.height, 0, 0, c.width, c.height);
    return { c, cx: b.cx - x0, cy: b.cy - y0 };
  }

  function zeichneVordergrund() {
    const { yu, yo } = sichtY();
    const extra = (view.cssH / view.s) * (VORN - 1) * 0.6;
    zweigeBei(yu - extra - 30, yo + extra + 30).forEach((z) => {
      const o = zweigOrt(z);
      const b = zweigBild(z);
      const x = view.mxp / view.dpr + (o.x - state.camX) * view.s * VORN;
      const y = view.myp / view.dpr - (o.y - state.camY) * view.s * VORN;
      if (y < -b.cy / view.dpr - 20 || y > view.cssH + b.cy / view.dpr + 20) return;
      bildLegen(b, x, y, 1);
    });
  }

  // ---------------------------------------------------------------------------
  // Malen: was auf dem Wasser treibt
  // ---------------------------------------------------------------------------
  /*
   * Wasserlinsen und Blütenblätter im Teich, kleines Laub im Bach, Federn im
   * Mühlenteich, Wollgrasflocken im Moor, Blütenstaub an der Quelle. Alles
   * treibt mit dem Wasser: state.drift wächst mit der Strömung dort, wo er
   * gerade ist.
   */
  const TREIB_ABSTAND = 9;

  function treibBild(art, v) {
    const key = `treib:${art}:${v}:${view.S}`;
    if (sprites.has(key)) return sprites.get(key);
    const rnd = wuerfel(300 + v * 7 + art.length * 31);
    const bild = bildCm(3, 3, (k) => {
      if (art === "linsen") {
        for (let i = 0; i < 10 + v * 4; i += 1) {
          const a = rnd() * TAU;
          const d = rnd() ** 0.7 * (1.2 + v * 0.4);
          const x = Math.cos(a) * d;
          const y = Math.sin(a) * d;
          const r = 0.2 + rnd() * 0.14;
          k.fillStyle = "rgba(0,30,10,0.25)";
          k.beginPath();
          k.ellipse(x + 0.08, y - 0.08, r, r * 0.8, a, 0, TAU);
          k.fill();
          k.fillStyle = rgb(mix3([120, 190, 60], [190, 230, 90], rnd()));
          k.beginPath();
          k.ellipse(x, y, r, r * 0.8, a, 0, TAU);
          k.fill();
          k.fillStyle = "rgba(255,255,220,0.5)";
          k.beginPath();
          k.arc(x - r * 0.3, y + r * 0.3, r * 0.3, 0, TAU);
          k.fill();
        }
      } else if (art === "bluete") {
        k.fillStyle = v % 2 ? "rgba(250,196,214,0.95)" : "rgba(255,248,246,0.95)";
        blattUmriss(k, 0, 0, rnd() * TAU, 1.6, k.fillStyle, "rgba(220,150,170,0.6)", 0.42);
      } else if (art === "laub") {
        const c = [[214, 150, 50], [200, 110, 40], [170, 150, 60]][v % 3];
        blattUmriss(k, 0, 0, 0.3, 2.2, rgb(c), rgba(mix3(c, [0, 0, 0], 0.4), 0.8), 0.55);
      } else if (art === "feder") {
        k.strokeStyle = "rgba(250,250,245,0.95)";
        k.lineWidth = 0.08;
        k.beginPath();
        k.moveTo(-1.4, 0);
        k.lineTo(1.4, 0.1);
        k.stroke();
        k.strokeStyle = "rgba(240,240,236,0.8)";
        k.lineWidth = 0.05;
        for (let i = 0; i < 16; i += 1) {
          const x = -1.1 + i * 0.16;
          k.beginPath();
          k.moveTo(x, 0.02);
          k.lineTo(x + 0.35, 0.55 - Math.abs(i - 8) * 0.03);
          k.moveTo(x, 0);
          k.lineTo(x + 0.35, -0.5 + Math.abs(i - 8) * 0.03);
          k.stroke();
        }
      } else if (art === "flocke") {
        for (let i = 0; i < 9; i += 1) {
          const a = rnd() * TAU;
          k.fillStyle = `rgba(255,252,250,${0.4 + rnd() * 0.4})`;
          k.beginPath();
          k.arc(Math.cos(a) * rnd() * 0.5, Math.sin(a) * rnd() * 0.5, 0.2 + rnd() * 0.2, 0, TAU);
          k.fill();
        }
      } else {
        // Blütenstaub: helle Punkte.
        for (let i = 0; i < 12; i += 1) {
          k.fillStyle = `rgba(250,236,170,${0.5 + rnd() * 0.4})`;
          k.beginPath();
          k.arc((rnd() - 0.5) * 3, (rnd() - 0.5) * 3, 0.07 + rnd() * 0.05, 0, TAU);
          k.fill();
        }
      }
    });
    sprites.set(key, bild);
    return bild;
  }

  // Was im Wasser liegt, nach Zelle n: Art, Ort quer, Spielart, Drehung.
  // Wasserlinsen, Blüten, Federn, Flocken und Staub liegen still und sind in
  // die Kacheln gemalt (treibgutMalen); nur das Laub im Bach und am
  // Mühlenteich treibt (zeichneTreibendes).
  function treibgutBei(n, d) {
    const rnd = zellZufall(n, 91);
    const y = n * TREIB_ABSTAND - d + rnd() * TREIB_ABSTAND;
    if (state.stroemungen.some((s) => Math.abs(y - s.y) < s.halb + 3)) return null;
    const w = weltBei(y);
    const { m, h } = bachBild(y);
    const u = rnd() * 2 - 1;
    const x = m + u * h * 0.9;
    const r = rnd();
    const v = Math.floor(rnd() * 4);
    let art = null;
    if (w === 0) art = r < 0.45 ? "linsen" : r < 0.7 ? "bluete" : null;
    else if (w === 1) art = r < 0.4 ? "laub" : null;
    else if (w === 2) art = r < 0.3 ? "linsen" : r < 0.42 ? "feder" : r < 0.55 ? "laub" : null;
    else if (w === 3) art = r < 0.35 ? "flocke" : r < 0.55 ? "linsen" : null;
    else art = r < 0.3 ? "staub" : null;
    return art ? { art, x, y, v, w: rnd() * TAU } : null;
  }

  function treibgutMalen(k, kc) {
    const S = view.S;
    for (let n = Math.floor((kc.ya - 4) / TREIB_ABSTAND) - 1; n <= Math.floor((kc.yb + 4) / TREIB_ABSTAND) + 1; n += 1) {
      const q = treibgutBei(n, 0);
      if (!q || q.art === "laub") continue;
      const b = treibBild(q.art, q.v);
      k.save();
      k.setTransform(1, 0, 0, 1, (q.x - kc.xa) * S, (kc.yb - q.y) * S);
      if (q.art !== "linsen" && q.art !== "staub") k.rotate(-q.w);
      k.globalAlpha = 0.95;
      k.drawImage(b.c, -b.cx, -b.cy);
      k.restore();
    }
  }

  function zeichneTreibendes() {
    const { yu, yo } = sichtY();
    const d = state.drift;
    const n0 = Math.floor((yu + d) / TREIB_ABSTAND) - 1;
    const n1 = Math.floor((yo + d) / TREIB_ABSTAND) + 1;
    for (let n = n0; n <= n1; n += 1) {
      const q = treibgutBei(n, d);
      if (!q || q.art !== "laub") continue;
      const sy = bildY(q.y);
      if (sy < -20 || sy > view.cssH + 20) continue;
      bildDrehen(treibBild(q.art, q.v), bildX(q.x), sy, q.w + state.zeit * 0.1 * (q.v - 1.5), 0.95);
    }
  }

  // ---------------------------------------------------------------------------
  // Malen: der Wasserläufer
  // ---------------------------------------------------------------------------
  /*
   * Von oben: ein schlanker, dunkler Leib (Kopf mit Augen und Fühlern,
   * Brust mit goldenem Strich, langer Hinterleib), zwei kurze Vorderbeine,
   * die langen Mittelbeine, mit denen er rudert, die langen Hinterbeine.
   * Wo seine Füsse das Wasser berühren, drückt er kleine Dellen hinein: ein
   * heller Ring auf dem Wasser – und am Grund ein runder Schatten mit hellem
   * Rand, weil die Delle das Licht wie eine Linse zur Seite lenkt.
   */
  const BEINE = [
    { hueft: [0.95, 0.2], knie: [1.6, 0.75], fuss: [2.05, 1.05], delle: 0.42, mitte: false },
    { hueft: [0.45, 0.26], knie: [0.25, 2.6], fuss: [-1.6, 4.8], delle: 0.85, mitte: true },
    { hueft: [0.18, 0.22], knie: [-1.4, 1.7], fuss: [-3.8, 2.7], delle: 0.65, mitte: false },
  ];

  // Wie weit die Mittelbeine gerade zurückgeschwungen sind (Ruderschlag).
  function schwung() {
    if (state.stossBild <= 0) return 0;
    const p = 1 - state.stossBild;
    return p < 0.35 ? (p / 0.35) * 0.62 : 0.62 * (1 - (p - 0.35) / 0.65);
  }

  // spann: beim Zielen (0 bis 1) – der Leib weicht zurück, die Mittelbeine
  // greifen nach vorn und spannen sich wie ein Gummi.
  function beinPunkte(bein, seite, sw, spann = 0) {
    const pts = [bein.hueft, bein.knie, bein.fuss].map(([x, y]) => [x, y * seite]);
    if (spann) {
      pts[0][0] -= 0.4 * spann;
      pts[1][0] -= 0.2 * spann;
      pts[1][1] *= 1 + 0.12 * spann;
    }
    const dreh = sw - (bein.mitte ? 0.5 * spann : 0);
    if (bein.mitte && dreh) {
      const [hx, hy] = pts[0];
      const a = dreh * seite;
      for (let i = 1; i < 3; i += 1) {
        const dx = pts[i][0] - hx;
        const dy = pts[i][1] - hy;
        pts[i] = [hx + dx * Math.cos(a) - dy * Math.sin(a), hy + dx * Math.sin(a) + dy * Math.cos(a)];
      }
    }
    return pts;
  }

  // Die Füsse in der Welt.
  function fuesse(L) {
    const sw = schwung();
    const c = Math.cos(L.w);
    const s = Math.sin(L.w);
    const raus = [];
    BEINE.forEach((b) => [-1, 1].forEach((seite) => {
      const [, , [lx, ly]] = beinPunkte(b, seite, sw);
      raus.push({ x: L.x + lx * c - ly * s, y: L.y + lx * s + ly * c, r: b.delle });
    }));
    return raus;
  }

  function dellenBild(n) {
    const key = `delle:${n}:${view.S}`;
    if (sprites.has(key)) return sprites.get(key);
    const r = [0.45, 0.65, 0.9][n];
    const bild = bildCm(r * 2.2, r * 2.2, (k) => {
      const v = k.createRadialGradient(0, 0, 0, 0, 0, r * 2);
      v.addColorStop(0, "rgba(0,14,10,0.55)");
      v.addColorStop(0.42, "rgba(0,14,10,0.45)");
      v.addColorStop(0.56, "rgba(255,252,220,0.55)");
      v.addColorStop(0.72, "rgba(255,252,220,0.22)");
      v.addColorStop(1, "rgba(255,252,220,0)");
      k.fillStyle = v;
      k.beginPath();
      k.arc(0, 0, r * 2, 0, TAU);
      k.fill();
    });
    sprites.set(key, bild);
    return bild;
  }

  // Die Schatten seiner Dellen und seines Leibes auf dem Grund.
  function zeichneDellenSchatten(L, alpha = 1) {
    if (L.sitz) return;
    const sv = schattenVersatz(L.x, L.y);
    fuesse(L).forEach((f) => {
      const n = f.r > 0.8 ? 2 : f.r > 0.55 ? 1 : 0;
      bildLegen(dellenBild(n), bildX(f.x + sv.x), bildY(f.y + sv.y), alpha * (1 - sv.d * 0.35));
    });
    g.strokeStyle = `rgba(0,14,10,${0.22 * alpha})`;
    g.lineWidth = Math.max(1, 0.4 * view.s);
    g.beginPath();
    g.moveTo(bildX(L.x + sv.x + Math.cos(L.w) * 1.4), bildY(L.y + sv.y + Math.sin(L.w) * 1.4));
    g.lineTo(bildX(L.x + sv.x - Math.cos(L.w) * 1.7), bildY(L.y + sv.y - Math.sin(L.w) * 1.7));
    g.stroke();
  }

  // Der Wasserläufer an (x, y) im Bild, Blick w (in der Welt).
  function laeuferMalen(x, y, w, { geist = null, alpha = 1, sitzt = false, gross = 1, spann = 0 } = {}) {
    const s = view.s * gross;
    const fx = Math.cos(w);
    const fy = -Math.sin(w);
    const lx = -Math.sin(w);
    const ly = -Math.cos(w);
    const d = view.dpr;
    g.save();
    g.globalAlpha = alpha;
    g.setTransform(d * fx * s, d * fy * s, d * lx * s, d * ly * s, d * x, d * y);
    const sw = schwung();
    const linie = Math.max(1.05 / s, 0.12);
    // Wo die Sonne für ihn steht (in seinen Achsen).
    const sx = -0.5 * Math.cos(w) + 0.6 * Math.sin(w);
    const sy = 0.5 * Math.sin(w) + 0.6 * Math.cos(w);
    if (sitzt && !geist) {
      // Sein Schatten auf dem Blatt.
      g.save();
      g.translate(-sx * 0.35, -sy * 0.35);
      g.strokeStyle = "rgba(10,30,10,0.28)";
      g.lineWidth = linie * 1.4;
      g.beginPath();
      BEINE.forEach((b) => [-1, 1].forEach((seite) => {
        const p = beinPunkte(b, seite, sw, spann);
        g.moveTo(p[0][0], p[0][1]);
        g.lineTo(p[1][0], p[1][1]);
        g.lineTo(p[2][0], p[2][1]);
      }));
      g.stroke();
      g.fillStyle = "rgba(10,30,10,0.3)";
      g.beginPath();
      g.ellipse(-0.3, 0, 1.9, 0.4, 0, 0, TAU);
      g.fill();
      g.restore();
    }
    const dunkel = geist || "#1d1610";
    const glanz = geist ? "rgba(255,255,255,0.8)" : "rgba(230,200,150,0.55)";
    // Die Beine: Schenkel und Schiene, die Füsse liegen auf.
    g.strokeStyle = dunkel;
    g.lineCap = "round";
    g.lineJoin = "round";
    [false, true].forEach((mitte) => {
      g.lineWidth = linie * (mitte ? 1.15 : 1);
      g.beginPath();
      BEINE.forEach((b) => {
        if (b.mitte !== mitte) return;
        [-1, 1].forEach((seite) => {
          const p = beinPunkte(b, seite, sw, spann);
          g.moveTo(p[0][0], p[0][1]);
          g.lineTo(p[1][0], p[1][1]);
          g.lineTo(p[2][0], p[2][1]);
        });
      });
      g.stroke();
    });
    // Die Dellen auf dem Wasser: ein heller Ring um jeden Fuss.
    if (!sitzt && !geist) {
      const ringe = new Path2D();
      const mitten = new Path2D();
      BEINE.forEach((b) => [-1, 1].forEach((seite) => {
        const [fxx, fyy] = beinPunkte(b, seite, sw, spann)[2];
        ringe.moveTo(fxx + b.delle * 0.55, fyy);
        ringe.arc(fxx, fyy, b.delle * 0.55, 0, TAU);
        mitten.moveTo(fxx + b.delle * 0.3, fyy);
        mitten.arc(fxx, fyy, b.delle * 0.3, 0, TAU);
      }));
      g.strokeStyle = "rgba(255,255,255,0.6)";
      g.lineWidth = linie * 0.9;
      g.stroke(ringe);
      g.fillStyle = "rgba(0,20,20,0.35)";
      g.fill(mitten);
    }
    // Gespannt glänzen die Mittelbeine.
    if (spann > 0.05) {
      g.strokeStyle = geist ? `rgba(255,255,255,${0.5 * spann})` : `rgba(255,226,170,${0.55 * spann})`;
      g.lineWidth = linie * 0.45;
      g.beginPath();
      BEINE.forEach((b) => {
        if (!b.mitte) return;
        [-1, 1].forEach((seite) => {
          const p = beinPunkte(b, seite, sw, spann);
          g.moveTo(p[0][0], p[0][1]);
          g.lineTo(p[1][0], p[1][1]);
          g.lineTo(p[2][0], p[2][1]);
        });
      });
      g.stroke();
    }
    // Der Leib (beim Zielen ein wenig zurück).
    if (spann) g.translate(-0.4 * spann, 0);
    g.fillStyle = dunkel;
    g.beginPath();
    g.ellipse(-0.8, 0, 1.05, 0.25, 0, 0, TAU);
    g.fill();
    g.beginPath();
    g.ellipse(0.45, 0, 0.62, 0.33, 0, 0, TAU);
    g.fill();
    g.beginPath();
    g.ellipse(1.22, 0, 0.32, 0.23, 0, 0, TAU);
    g.fill();
    if (!geist) {
      // Der goldene Strich auf der Brust und das Licht auf dem Rücken.
      g.strokeStyle = "rgba(214,168,96,0.75)";
      g.lineWidth = linie * 0.9;
      g.beginPath();
      g.moveTo(0.95, 0);
      g.lineTo(0.0, 0);
      g.stroke();
      g.fillStyle = glanz;
      g.beginPath();
      g.ellipse(-0.75 + sx * 0.15, sy * 0.12, 0.7, 0.08, 0, 0, TAU);
      g.fill();
      g.beginPath();
      g.ellipse(0.45 + sx * 0.12, sy * 0.14, 0.3, 0.09, 0, 0, TAU);
      g.fill();
      // Die Augen.
      g.fillStyle = "#5a2a1a";
      [-1, 1].forEach((seite) => { g.beginPath(); g.arc(1.3, seite * 0.21, 0.11, 0, TAU); g.fill(); });
      g.fillStyle = "rgba(255,240,220,0.8)";
      [-1, 1].forEach((seite) => { g.beginPath(); g.arc(1.33, seite * 0.19, 0.04, 0, TAU); g.fill(); });
    }
    // Die Fühler.
    g.strokeStyle = dunkel;
    g.lineWidth = linie * 0.7;
    [-1, 1].forEach((seite) => {
      g.beginPath();
      g.moveTo(1.45, seite * 0.08);
      g.quadraticCurveTo(1.95, seite * 0.18, 2.45, seite * 0.42);
      g.stroke();
    });
    g.restore();
  }

  function zeichneGeister() {
    if (!gegner || state.phase === "bereit") return;
    const orte = window.LernappGeist?.orte?.(gegner) || [];
    if (!orte.length) return;
    const namen = [];
    orte.forEach((o) => {
      if (o.ziel) return;
      const x = o.a / 4;
      const y = o.b / 4;
      const sx = bildX(x);
      const sy = bildY(y);
      if (sx < -40 || sx > view.cssW + 40 || sy < -60 || sy > view.cssH + 60) {
        namen.push({ ...o, sx, sy, weit: `${Math.round(o.punkte) - state.punkte >= 0 ? "+" : ""}${Math.round(o.punkte) - state.punkte}` });
        return;
      }
      const c = Math.round(o.c || 0);
      const w = c >= 0 ? (c % 1000) / 100 : 0;
      const spann = c >= 0 ? Math.floor((c % 10000) / 1000) / 9 : 0;
      schein("weiss", sx, sy, 3.2 * view.s, 0.25 * o.blass);
      laeuferMalen(sx, sy, w, { geist: o.farbe, alpha: 0.5 * o.blass, spann });
      namen.push({ ...o, sx, sy: sy - 5 * view.s });
    });
    window.LernappGeist.namen(g, namen, { breit: view.cssW, hoch: view.cssH });
  }

  // ---------------------------------------------------------------------------
  // Malen: Blätter, Laub, Fische
  // ---------------------------------------------------------------------------
  function sichtbareBlaetter(fn) {
    const { yu, yo } = sichtY();
    const liste = state.blaetter;
    for (let i = blattAb(yu - 14); i < liste.length; i += 1) {
      const p = liste[i];
      if (p.y - AUS_MAX > yo + 14) break;
      fn(p);
    }
  }

  // Wo ein Blatt gerade ist: Nach der Landung wippt es kurz, beim Sinken
  // sackt es ab.
  function blattWippen(p) {
    if (p.wippen === undefined || p.wippen === null) return 0;
    const t = state.t - p.wippen;
    return t > 0 && t < 0.6 ? Math.sin(t * 22) * Math.exp(-t * 7) * 0.35 : 0;
  }

  // Die Schatten der Seerosenblätter auf dem Grund und ihre Stängel (unter
  // Wasser, vom Blatt schräg zum Grund) – sie stehen still und sind darum
  // in die Kacheln gemalt (die treibenden nicht: deren Schatten wandert
  // mit, zeichneBlaetter). Geht ein Blatt unter, liegt es danach als
  // dunkler Schemen im Wasser über seinem Schatten.
  function blattSchattenMalen(k, kc) {
    const liste = state.blaetter;
    for (let i = blattAb(kc.ya - 20); i < liste.length; i += 1) {
      const p = liste[i];
      if (p.y - AUS_MAX > kc.yb + 20) break;
      if (p.treib) continue;
      const sv = schattenVersatz(p.x, p.y);
      const tief = farbeBei(p.y, "tief");
      // Die Stängel.
      if (p.art !== "start") {
        k.strokeStyle = rgba(mix3([110, 120, 60], tief, 0.45), 0.5);
        k.lineWidth = 0.32;
        p.kreise.forEach((c, j) => {
          const w = p.kerbe + j * 1.3;
          const x0 = p.x + c.x;
          const y0 = p.y + c.y;
          const x1 = x0 + sv.x * 1.3 + Math.cos(w) * 4;
          const y1 = y0 + sv.y * 1.3 + Math.sin(w) * 4;
          k.beginPath();
          k.moveTo(x0, y0);
          k.quadraticCurveTo((x0 + x1) / 2 + 0.8, (y0 + y1) / 2, x1, y1);
          k.stroke();
        });
      }
      // Der Schatten, weich: dieselbe Form, mehrmals leicht versetzt.
      k.fillStyle = `rgba(0,12,8,${0.085 * (1 - sv.d * 0.3)})`;
      for (const [dx, dy] of [[0, 0], [0.5, 0], [-0.5, 0], [0, 0.5], [0, -0.5], [0.9, 0.3], [-0.9, -0.3]]) {
        p.kreise.forEach((c) => {
          k.beginPath();
          k.arc(p.x + c.x + sv.x + dx, p.y + c.y + sv.y + dy, c.r * 0.98, 0, TAU);
          k.fill();
        });
      }
    }
  }

  function zeichneBlaetter() {
    const L = state.l;
    sichtbareBlaetter((p) => {
      const weg = versunken(p, state.t) ? clamp((state.t - p.betreten - p.halt) / 0.9, 0, 1) : 0;
      const b = blattBild(p);
      const dx = treibX(p, state.t);
      if (weg >= 1) {
        // Versunken: Es sinkt auf den Grund, auf seinen Schatten, und
        // verschwindet im Wasser.
        const fort = clamp((state.t - p.betreten - p.halt - 0.9) / 1.6, 0, 1);
        if (fort >= 1) return;
        const sv = schattenVersatz(p.x, p.y);
        bildLegen(b, bildX(p.x + dx + sv.x), bildY(p.y + sv.y), 0.32 * (1 - sv.d * 0.4) * (1 - fort));
        return;
      }
      if (p.treib) {
        // Der Schatten des treibenden Blattes wandert mit.
        const sv = schattenVersatz(p.x, p.y);
        g.fillStyle = `rgba(0,12,8,${0.3 * (1 - sv.d * 0.3)})`;
        g.beginPath();
        g.arc(bildX(p.x + dx + sv.x), bildY(p.y + sv.y), p.r * view.s, 0, TAU);
        g.fill();
      }
      const sink = sinktBei(p, state.t);
      const x = bildX(p.x + dx);
      const y = bildY(p.y) + blattWippen(p) * view.s;
      bildLegen(b, x, y, (1 - weg) * (1 - sink * 0.25));
      // Es läuft voll: Wasser kriecht vom Rand her darüber, und es wird dunkel.
      if (sink > 0 || weg > 0) {
        const k = Math.max(sink, 1);
        const wasser = farbeBei(p.y, "wasser");
        p.kreise.forEach((c) => {
          const cx = bildX(p.x + dx + c.x);
          const cy = bildY(p.y + c.y) + blattWippen(p) * view.s;
          const r = c.r * view.s;
          g.fillStyle = rgba(wasser, 0.25 + 0.55 * sink + 0.2 * weg);
          g.beginPath();
          g.arc(cx, cy, r * 1.01, 0, TAU);
          g.arc(cx, cy, r * Math.max(0.02, 1 - sink * 0.95 - weg), 0, TAU, true);
          g.fill();
          g.strokeStyle = `rgba(255,255,255,${0.35 * sink * (1 - weg)})`;
          g.lineWidth = 1;
          g.beginPath();
          g.arc(cx, cy, r * Math.max(0.02, 1 - sink * 0.95), 0, TAU);
          g.stroke();
          // Blasen am Rand.
          if (!ruhig() && k > 0) {
            for (let i = 0; i < 5; i += 1) {
              const a = hash01(p.id * 7 + i) * TAU + state.zeit * 0.7;
              const ph = (state.zeit * 1.6 + hash01(i * 3.1 + p.id)) % 1;
              g.strokeStyle = `rgba(255,255,255,${0.5 * (1 - ph) * sink})`;
              g.beginPath();
              g.arc(cx + Math.cos(a) * r * 1.02, cy + Math.sin(a) * r * 1.02, 0.5 + ph * 1.6, 0, TAU);
              g.stroke();
            }
          }
        });
      }
      // Der Ring der Haltezeit: Wer darauf sitzt, sieht, wie lange es noch
      // trägt.
      if (L && L.sitz === p && p.betreten !== null && weg <= 0 && state.phase !== "ende") zeichneHaltRing(p, dx);
    });
  }

  // Der Ring der Haltezeit: HALT_PUNKTE Punkte rund um das Blatt, die im
  // Uhrzeigersinn verlöschen – hell, dann gelb, zuletzt rot und pulsierend.
  // Punkte statt eines Bogens: Jeder ist ein kleines, vorgemaltes Bild, das
  // kostet im Software-Raster fast nichts.
  const HALT_PUNKTE = 20;
  const HALT_FARBEN = [[232, 255, 214], [255, 214, 92], [255, 96, 72]];
  function haltPunkt(f, px) {
    const key = `halt:${f}:${px}`;
    let b = sprites.get(key);
    if (b) return b;
    const n = Math.ceil(px * 2 + 4);
    const c = leinwandPx(n, n);
    const k = c.getContext("2d");
    k.fillStyle = "rgba(10,30,20,0.55)";
    k.beginPath();
    k.arc(n / 2, n / 2, px + 1.2, 0, TAU);
    k.fill();
    k.fillStyle = rgb(HALT_FARBEN[f]);
    k.beginPath();
    k.arc(n / 2, n / 2, px, 0, TAU);
    k.fill();
    b = { c, cx: Math.round(n / 2), cy: Math.round(n / 2) };
    sprites.set(key, b);
    return b;
  }

  function zeichneHaltRing(p, dx) {
    const rest = restBei(p, state.t);
    if (rest <= 0) return;
    // Beim Teppich um das Blatt, auf dem er sitzt.
    const L = state.l;
    let c = p.kreise[0];
    if (p.kreise.length > 1) {
      let best = Infinity;
      for (const q of p.kreise) {
        const d = (L.x - p.x - dx - q.x) ** 2 + (L.y - p.y - q.y) ** 2;
        if (d < best) { best = d; c = q; }
      }
    }
    const cx = bildX(p.x + dx + c.x);
    const cy = bildY(p.y + c.y) + blattWippen(p) * view.s;
    const r = c.r * view.s * 0.84;
    const f = rest > 0.5 ? 0 : rest > 0.25 ? 1 : 2;
    const bild = haltPunkt(f, Math.max(2, Math.round(0.36 * view.s * view.dpr)));
    // Knapp vor dem Ende pulsiert er.
    const puls = f === 2 && !ruhig() ? 0.7 + 0.3 * Math.sin(state.zeit * 22) : 1;
    const voll = rest * HALT_PUNKTE;
    for (let i = 0; i < HALT_PUNKTE && i < voll; i += 1) {
      const a = -Math.PI / 2 + ((i + 0.5) / HALT_PUNKTE) * TAU;
      bildLegen(bild, cx + Math.cos(a) * r, cy + Math.sin(a) * r, puls * Math.min(1, voll - i));
    }
  }

  // Das Laub der Strömungen: Schatten, dann die Blätter, die sich drehen.
  function laubSichtbar(fn) {
    const { yu, yo } = sichtY();
    state.stroemungen.forEach((s) => {
      if (s.y < yu - 20 || s.y > yo + 20) return;
      laubImBand(s, state.t, s.r * 2).forEach((k) => {
        const q = laubOrt(s, k, state.t);
        fn(s, k, q);
      });
    });
  }

  function zeichneLaubSchatten() {
    laubSichtbar((s, k, q) => {
      const sv = schattenVersatz(q.x, q.y);
      const a = clamp(q.u * 8 + 0.4, 0, 1) * clamp((1.06 - q.u) * 8, 0, 1);
      if (a <= 0.02) return;
      g.fillStyle = `rgba(0,12,8,${0.22 * a})`;
      g.beginPath();
      g.arc(bildX(q.x + sv.x), bildY(q.y + sv.y), s.r * view.s * 0.9, 0, TAU);
      g.fill();
    });
  }

  function zeichneLaub() {
    laubSichtbar((s, k, q) => {
      const b = laubBild(s, ((k % 3) + 3) % 3);
      // Am Zufluss taucht es aus dem Schaum auf, am Abfluss verschwindet es.
      const a = clamp(q.u * 8 + 0.4, 0, 1) * clamp((1.06 - q.u) * 8, 0, 1);
      bildDrehen(b, bildX(q.x), bildY(q.y), hash01(k * 3.3) * TAU + (q.u * s.richtung) * 2.2, a);
    });
  }

  // Die Strömung: schnelle, helle Striche quer über das Band, Schaum am
  // Zufluss und am Abfluss.
  function zeichneStroemungen() {
    const { yu, yo } = sichtY();
    g.lineCap = "round";
    state.stroemungen.forEach((s) => {
      if (s.y < yu - 20 || s.y > yo + 20) return;
      const n = 34;
      for (let i = 0; i < n; i += 1) {
        const basis = hash01(i * 1.7 + s.nr) * s.spanne;
        const tempo = s.tempo * (0.85 + hash01(i * 2.9) * 0.4);
        const u = ((tempo * state.zeit + basis) % s.spanne) / s.spanne;
        const x = s.xa + s.richtung * u * s.spanne;
        const y = s.y + (hash01(i * 4.1 + s.nr) - 0.5) * 2 * (s.halb + 1);
        const l = (2.5 + hash01(i * 5.3) * 4) * view.s;
        const a = 0.35 * Math.sin(Math.PI * u);
        g.strokeStyle = `rgba(255,255,255,${a})`;
        g.lineWidth = Math.max(1, 0.18 * view.s);
        g.beginPath();
        g.moveTo(bildX(x), bildY(y));
        g.lineTo(bildX(x) - s.richtung * l, bildY(y));
        g.stroke();
      }
      // Schaum: am Zufluss quillt es, am Abfluss stürzt es weg.
      [[s.xa + s.richtung * 3, 1], [s.xb, 1.3]].forEach(([xs, f]) => {
        for (let i = 0; i < 16; i += 1) {
          const ph = (state.zeit * 1.3 + hash01(i * 2.3 + xs)) % 1;
          const yy = s.y + (hash01(i * 7.7 + xs) - 0.5) * 2 * s.halb;
          const xx = xs + s.richtung * ph * 4 * f;
          g.fillStyle = `rgba(255,255,255,${0.55 * (1 - ph)})`;
          g.beginPath();
          g.arc(bildX(xx), bildY(yy), (0.4 + ph * 0.9) * view.s, 0, TAU);
          g.fill();
        }
      });
    });
  }

  // Die Fische: der, der jagt (aus der Tiefe, erst ein Schatten), und die
  // Hechte in ihren Gruben.
  function zeichneFischSchatten() {
    const j = state.jagd;
    if (j.phase === "steigt" || j.phase === "taucht") {
      const k = fischHoehe();
      const sv = schattenVersatz(j.x, j.y);
      const b = fischBild(false, 2, true);
      bildDrehen(b, bildX(j.x + sv.x * k), bildY(j.y + sv.y * k), j.w, 0.2 + 0.4 * k, 1 + 0.2 * (1 - k));
    }
    sichtbareHechte((hg, o) => {
      const sv = schattenVersatz(o.x, o.y);
      bildLegen(hechtGedreht("schatten", o.w), bildX(o.x + sv.x * 0.6), bildY(o.y + sv.y * 0.6), 1);
    });
  }

  // Der Hecht ist gross; ihn je Bild zu drehen kostet im Software-Raster
  // viel. Darum vorgedreht in HECHT_RICHTUNGEN Richtungen: der Leib (halb
  // unscharf, halb scharf, wie er in der dunklen Tiefe zu sehen ist) und
  // sein Schatten, je ein Bild – gelegt Punkt auf Punkt. Ist keine Grube
  // mehr im Bild, wird der Speicher frei.
  const HECHT_RICHTUNGEN = 32;
  const hechtBilder = new Map();
  function hechtGedreht(art, w) {
    const n = ((Math.round((w / TAU) * HECHT_RICHTUNGEN) % HECHT_RICHTUNGEN) + HECHT_RICHTUNGEN) % HECHT_RICHTUNGEN;
    const key = `${art}:${n}:${view.S}`;
    let b = hechtBilder.get(key);
    if (b) return b;
    const quellen = art === "schatten" ? [[fischBild(true, 2, true), 0.5]] : [[fischBild(true, 1, false), 0.55], [fischBild(true, 0, false), 0.6]];
    const q = quellen[0][0];
    const wn = (n / HECHT_RICHTUNGEN) * TAU;
    const c0 = Math.abs(Math.cos(wn));
    const s0 = Math.abs(Math.sin(wn));
    const bw = Math.ceil(q.c.width * c0 + q.c.height * s0) + 4;
    const bh = Math.ceil(q.c.width * s0 + q.c.height * c0) + 4;
    const c = leinwandPx(bw, bh);
    const k = c.getContext("2d");
    k.translate(bw / 2, bh / 2);
    k.rotate(-wn);
    quellen.forEach(([bild, alpha]) => {
      k.globalAlpha = alpha;
      k.drawImage(bild.c, -bild.cx, -bild.cy);
    });
    b = { c, cx: Math.round(bw / 2), cy: Math.round(bh / 2) };
    hechtBilder.set(key, b);
    return b;
  }

  // Wie weit der jagende Fisch aufgestiegen ist (0 tief, 1 an der Oberfläche).
  function fischHoehe() {
    const j = state.jagd;
    if (j.phase === "steigt") return clamp((state.t - j.t0) / j.warn, 0, 1) ** 1.3;
    if (j.phase === "taucht") return clamp(1 - (state.t - j.t0) / FISCH_PAUSE, 0, 1) ** 2;
    return 0;
  }

  function sichtbareHechte(fn) {
    const { yu, yo } = sichtY();
    state.hechte.forEach((hg) => {
      if (hg.cy < yu - 50 || hg.cy > yo + 50) return;
      fn(hg, hechtOrt(hg, state.t));
    });
  }

  function zeichneFische() {
    const j = state.jagd;
    if (j.phase === "steigt" || j.phase === "taucht") {
      const k = fischHoehe();
      const x = bildX(j.x);
      const y = bildY(j.y);
      const f = 0.85 + 0.3 * k;
      // Von unscharf zu scharf, je höher er kommt.
      if (k < 0.5) bildDrehen(fischBild(false, 2, false), x, y, j.w, (0.25 + 0.5 * k) * (1 - k * 2 * 0.4), f);
      if (k > 0.25) bildDrehen(fischBild(false, 1, false), x, y, j.w, clamp((k - 0.25) * 2.4, 0, 0.75), f);
      if (k > 0.65) bildDrehen(fischBild(false, 0, false), x, y, j.w, clamp((k - 0.65) * 3, 0, 0.9), f);
      // Kurz vor dem Schnappen: Das Wasser über ihm wölbt sich.
      if (j.phase === "steigt" && k > 0.6) {
        g.strokeStyle = `rgba(255,255,255,${0.4 * (k - 0.6) / 0.4})`;
        g.lineWidth = 1.2;
        g.beginPath();
        g.arc(x + Math.cos(j.w) * 4 * view.s, y - Math.sin(j.w) * 4 * view.s, (2.4 - k) * view.s, 0, TAU);
        g.stroke();
      }
    }
    let hechtDa = false;
    sichtbareHechte((hg, o) => {
      hechtDa = true;
      bildLegen(hechtGedreht("leib", o.w), bildX(o.x), bildY(o.y), 1);
    });
    if (!hechtDa && hechtBilder.size) hechtBilder.clear();
    // Das Maul, das zuschnappt: am Ende der Runde, wo er gefressen wurde.
    const tot = state.tot;
    if (tot && (tot.art === "fisch" || tot.art === "blatt" || tot.art === "hecht") && tot.zeit < 0.9) {
      const k = tot.zeit < 0.25 ? tot.zeit / 0.25 : 1 - (tot.zeit - 0.25) / 0.65;
      const hecht = tot.art === "hecht";
      bildDrehen(fischBild(hecht, 0, false), bildX(tot.x - Math.cos(tot.fw) * (hecht ? 14 : 4)), bildY(tot.y - Math.sin(tot.fw) * (hecht ? 14 : 4)), tot.fw, 0.9 * clamp(k, 0, 1), 1.1);
      g.fillStyle = `rgba(20,10,10,${0.8 * clamp(k, 0, 1)})`;
      g.beginPath();
      g.ellipse(bildX(tot.x), bildY(tot.y), (hecht ? 2.6 : 1.5) * view.s * k, (hecht ? 1.8 : 1.1) * view.s * k, -tot.fw, 0, TAU);
      g.fill();
    }
  }

  // ---------------------------------------------------------------------------
  // Malen: Ringe, Spritzer, Glitzern, Mond
  // ---------------------------------------------------------------------------
  function zeichneRinge() {
    state.ringe.forEach((r) => {
      const k = clamp(r.leben / r.max, 0, 1);
      const x = bildX(r.x);
      const y = bildY(r.y);
      const rr = r.r * view.s;
      g.lineWidth = Math.max(1, 0.18 * view.s);
      g.strokeStyle = `rgba(255,255,255,${0.42 * k * r.kraft})`;
      g.beginPath();
      g.arc(x, y, rr, 0, TAU);
      g.stroke();
      g.strokeStyle = `rgba(0,20,20,${0.18 * k * r.kraft})`;
      g.beginPath();
      g.arc(x + 0.6, y + 0.6, rr * 0.9, 0, TAU);
      g.stroke();
    });
  }

  function zeichneSpritzer() {
    g.fillStyle = "#ffffff";
    state.teile.forEach((t) => {
      const k = clamp(t.leben / t.max, 0, 1);
      g.globalAlpha = Math.min(1, k * 1.6);
      g.beginPath();
      g.arc(bildX(t.x), bildY(t.y) - t.z * view.s * 0.25, Math.max(1, t.r * view.s * (1 + t.z * 0.04)), 0, TAU);
      g.fill();
    });
    g.globalAlpha = 1;
  }

  // Ein Glitzern, vorgemalt in zwei Grössen (gelegt wird Punkt auf Punkt).
  function glitzerBild(klein = false) {
    const key = `glitzer:${klein ? 1 : 0}:${view.dpr}`;
    if (sprites.has(key)) return sprites.get(key);
    const n = Math.round((klein ? 13 : 22) * view.dpr);
    const c = leinwandPx(n, n);
    const k = c.getContext("2d");
    const v = k.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2);
    v.addColorStop(0, "rgba(255,255,250,1)");
    v.addColorStop(0.12, "rgba(255,250,230,0.8)");
    v.addColorStop(0.35, "rgba(255,240,200,0.12)");
    v.addColorStop(1, "rgba(255,240,200,0)");
    k.fillStyle = v;
    k.fillRect(0, 0, n, n);
    k.strokeStyle = "rgba(255,255,245,0.85)";
    k.lineWidth = Math.max(1, view.dpr * 0.8);
    k.beginPath();
    k.moveTo(n / 2, n * 0.08);
    k.lineTo(n / 2, n * 0.92);
    k.moveTo(n * 0.08, n / 2);
    k.lineTo(n * 0.92, n / 2);
    k.stroke();
    const bild = { c, cx: n / 2, cy: n / 2 };
    sprites.set(key, bild);
    return bild;
  }

  // Die Sonne glitzert auf dem Wasser – oben im Bild, wo sie sich spiegelt.
  // Nachts der Mond, und die Sterne im Wasser.
  function zeichneGlitzer() {
    if (ruhig()) return;
    const y0 = state.camY;
    const dunkel = zahlBei(y0, "dunkel");
    const { yu, yo } = sichtY();
    const W = view.cssW;
    const H = view.cssH;
    // Wo die Sonne sich spiegelt (im Bild): links oben; im Moor tiefer und
    // rot, nachts der Mond rechts oben.
    const gx = W * (dunkel > 0.6 ? 0.68 : 0.32);
    const gy = view.frei + (H - view.frei) * (dunkel > 0.6 ? 0.22 : 0.3);
    const rx = W * 0.42;
    const ry = (H - view.frei) * 0.26;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalCompositeOperation = "lighter";
    const ZELLE = 5;
    for (let j = Math.floor(yu / ZELLE); j <= Math.floor(yo / ZELLE); j += 1) {
      const rnd = zellZufall(j, 97);
      for (let i = 0; i < 2; i += 1) {
        const y = j * ZELLE + rnd() * ZELLE;
        const { m, h } = bachBild(y);
        const x = m + (rnd() * 2 - 1) * h * 0.95;
        const sx = bildX(x);
        const sy = bildY(y);
        const e = ((sx - gx) / rx) ** 2 + ((sy - gy) / ry) ** 2;
        const nah = Math.max(0, 1 - e);
        if (nah <= 0.02 && rnd() < 0.85) continue;
        const ph = rnd() * TAU;
        const tw = Math.sin(state.zeit * (3 + rnd() * 4) + ph);
        const a = Math.max(0, tw - 0.55) / 0.45 * (0.25 + nah * 0.85);
        if (a <= 0.02) continue;
        g.globalAlpha = Math.min(1, a);
        const b = glitzerBild(nah < 0.45);
        g.drawImage(b.c, Math.round(sx * view.dpr - b.cx), Math.round(sy * view.dpr - b.cy));
      }
    }
    g.globalAlpha = 1;
    g.globalCompositeOperation = "source-over";
    g.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
  }

  // Der Mond im Wasser und die Sterne – nur nachts, und nur auf dem Wasser.
  // Ohne Zuschnitt (der kostet im Software-Raster viel): Jeder Stern wird
  // nur gezeichnet, wo Wasser ist, und der Mond liegt in der Mitte des
  // Baches.
  function zeichneNachtSpiegel() {
    const dunkel = zahlBei(state.camY, "dunkel");
    if (dunkel < 0.55) return;
    const k = clamp((dunkel - 0.55) / 0.25, 0, 1);
    const W = view.cssW;
    const H = view.cssH;
    const weltY = (sy) => state.camY + (view.ankerY - sy) / view.s;
    // Sterne: fest im Bild (sie sind unendlich weit weg), funkelnd.
    for (let i = 0; i < 60; i += 1) {
      const x = hash01(i * 3.1) * W;
      const y = view.frei + hash01(i * 7.3) * (H - view.frei);
      const { m, h } = bachBild(weltY(y));
      if (Math.abs(x - bildX(m)) > (h - 1.5) * view.s) continue;
      const a = (0.35 + 0.35 * Math.sin(state.zeit * (1 + hash01(i)) + i)) * k;
      g.fillStyle = `rgba(220,230,255,${a})`;
      g.fillRect(x, y, 1.2, 1.2);
    }
    // Der Mond: ein weicher Schein, darin feine, gewellte Lichtlinien, die
    // zittern – wie ein Mond in leicht bewegtem Wasser.
    const my = view.frei + (H - view.frei) * 0.2;
    const { m, h } = bachBild(weltY(my));
    const r = Math.min(W, H, h * view.s) * 0.11;
    const mx = bildX(m + h * 0.3);
    schein("kalt", mx, my, r * 3.2, 0.4 * k);
    g.lineCap = "round";
    for (let i = -6; i <= 6; i += 1) {
      const yy = my + i * r * 0.28;
      const breit = r * Math.sqrt(Math.max(0, 1 - (i / 6.6) ** 2)) * (0.75 + 0.3 * Math.sin(state.zeit * 1.9 + i * 1.7));
      const versatz = Math.sin(state.zeit * 1.3 + i * 0.9) * r * 0.18;
      g.strokeStyle = `rgba(236,244,255,${0.55 * k * (1 - Math.abs(i) / 8)})`;
      g.lineWidth = Math.max(1, r * 0.07);
      g.beginPath();
      for (let j = -4; j <= 4; j += 1) {
        g.lineTo(mx + versatz + (j / 4) * breit, yy + Math.sin(j * 0.9 + state.zeit * 3 + i) * r * 0.03);
      }
      g.stroke();
    }
  }

  // ---------------------------------------------------------------------------
  // Malen: was über dem Wasser fliegt
  // ---------------------------------------------------------------------------
  /*
   * Libellen am Teich, am Mühlenteich und im Moor: Sie stehen in der Luft,
   * schiessen weiter, stehen wieder – mit schwirrenden Flügeln und ihrem
   * Schatten auf dem Wasser. Sonnenstäubchen am Nachmittag, Glühwürmchen im
   * Moor und an der Quelle.
   */
  function libelleOrt(id, t) {
    const T = 1.7;
    const i = Math.floor(t / T + id * 0.37);
    const f = t / T + id * 0.37 - i;
    const P = (n) => ({
      x: view.cssW * (0.12 + 0.76 * hash01(n * 3.7 + id * 91)),
      y: view.frei + (view.cssH - view.frei) * (0.1 + 0.7 * hash01(n * 5.3 + id * 57)),
    });
    const a = P(i);
    const b = P(i + 1);
    const k = f < 0.72 ? 0 : glatt((f - 0.72) / 0.28);
    const zitter = Math.sin(t * 9 + id) * 1.5;
    return { x: lerp(a.x, b.x, k) + zitter, y: lerp(a.y, b.y, k) + Math.cos(t * 7 + id) * 1.2, w: Math.atan2(b.y - a.y, b.x - a.x), fliegt: k > 0 && k < 1 };
  }

  function libelleMalen(x, y, w, farbe, gross, schwirr) {
    const s = gross;
    g.save();
    g.translate(x, y);
    g.rotate(w);
    // Die Flügel: vier, durchsichtig, schimmernd.
    g.fillStyle = `rgba(230,240,255,${0.3 * schwirr + 0.14})`;
    g.beginPath();
    [[-0.2, 1], [-1.6, 0.9]].forEach(([dx, f]) => {
      [-1, 1].forEach((seite) => {
        g.moveTo(dx * s + 1.15 * s, seite * 4.4 * s * f);
        g.ellipse(dx * s, seite * 4.4 * s * f, 1.15 * s, 4.2 * s * f, seite * 0.18, 0, TAU);
      });
    });
    g.fill();
    // Der Hinterleib: lang und gegliedert.
    g.strokeStyle = farbe;
    g.lineWidth = 1.3 * s;
    g.lineCap = "round";
    g.beginPath();
    g.moveTo(-1.5 * s, 0);
    g.lineTo(-11 * s, 0);
    g.stroke();
    g.strokeStyle = "rgba(10,10,20,0.8)";
    g.lineWidth = 1.35 * s;
    for (let i = 0; i < 6; i += 1) {
      g.beginPath();
      g.moveTo((-2.6 - i * 1.5) * s, 0);
      g.lineTo((-3.0 - i * 1.5) * s, 0);
      g.stroke();
    }
    g.fillStyle = farbe;
    g.beginPath();
    g.ellipse(0, 0, 1.8 * s, 1.15 * s, 0, 0, TAU);
    g.fill();
    // Die grossen Augen.
    g.fillStyle = "#24343c";
    [-1, 1].forEach((seite) => { g.beginPath(); g.arc(1.9 * s, seite * 0.75 * s, 0.85 * s, 0, TAU); g.fill(); });
    g.fillStyle = "rgba(255,255,255,0.7)";
    g.beginPath();
    g.arc(2.1 * s, -0.95 * s, 0.25 * s, 0, TAU);
    g.fill();
    g.restore();
  }

  // Eine Libelle, vorgemalt (je Farbe drei Stufen des Flügelschimmers).
  function libelleBild(farbe, stufe) {
    const key = `libelle:${farbe}:${stufe}:${view.S}`;
    if (sprites.has(key)) return sprites.get(key);
    const gross = view.s * 0.62;
    const n = Math.ceil(26 * gross * view.dpr) + 2;
    const c = leinwandPx(n, n);
    const k = c.getContext("2d");
    const alt = g;
    g = k;
    k.setTransform(view.dpr, 0, 0, view.dpr, n / 2, n / 2);
    libelleMalen(5 * gross, 0, 0, farbe, gross, [0.2, 0.6, 1][stufe]);
    g = alt;
    const bild = { c, cx: n / 2, cy: n / 2 };
    sprites.set(key, bild);
    return bild;
  }

  function zeichneInsekten() {
    if (ruhig()) return;
    const y0 = state.camY;
    const mix = weltMix(y0);
    let libellen = 0;
    let gluehen = 0;
    let staub = 0;
    mix.forEach(([w, k]) => {
      libellen += k * [1.3, 0.6, 1, 1.2, 0][w];
      gluehen += k * [0, 0, 0, 0.7, 1][w];
      staub += k * [1, 0.5, 1, 0.2, 0][w];
    });
    // Sonnenstäubchen.
    if (staub > 0.05) {
      g.fillStyle = "rgba(255,248,220,0.7)";
      for (let i = 0; i < 14; i += 1) {
        const x = ((hash01(i * 2.3) * view.cssW + state.zeit * (4 + hash01(i) * 6) + Math.sin(state.zeit * 0.5 + i) * 10) % (view.cssW + 20)) - 10;
        const y = view.frei + hash01(i * 4.7) * (view.cssH - view.frei) + Math.sin(state.zeit * 0.7 + i * 1.3) * 8;
        g.globalAlpha = staub * (0.25 + 0.35 * Math.sin(state.zeit * 1.3 + i * 2));
        g.fillRect(x, y, 1.4, 1.4);
      }
      g.globalAlpha = 1;
    }
    // Libellen.
    const farben = ["#3aa6d8", "#2f8fc4", "#4cb0a0", "#d8483a", "#5aa0d0"];
    for (let id = 0; id < Math.round(libellen); id += 1) {
      const w = weltBei(y0);
      const o = libelleOrt(id, state.zeit);
      const gross = view.s * 0.62;
      // Ihr Schatten auf dem Wasser: ein dunkler Strich mit Flügeln.
      g.save();
      g.translate(o.x + 9 * gross, o.y + 13 * gross);
      g.rotate(o.w);
      g.fillStyle = "rgba(0,10,10,0.16)";
      g.fillRect(-11 * gross, -0.7 * gross, 13 * gross, 1.4 * gross);
      g.fillRect(-1.5 * gross, -8 * gross, 2.2 * gross, 16 * gross);
      g.restore();
      bildDrehen(libelleBild(farben[(w + id) % farben.length], Math.floor(state.zeit * 40 + id) % 3), o.x, o.y, -o.w);
    }
    // Glühwürmchen.
    if (gluehen > 0.05) {
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.globalCompositeOperation = "lighter";
      g.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
      for (let i = 0; i < 28; i += 1) {
        const x = hash01(i * 1.9) * view.cssW + Math.sin(state.zeit * 0.4 + i * 2.1) * 30;
        const y = view.frei + hash01(i * 3.7) * (view.cssH - view.frei) + Math.cos(state.zeit * 0.33 + i) * 24 + ((state.camY * view.s * 0.15) % 40);
        const an = Math.max(0, Math.sin(state.zeit * (0.9 + hash01(i * 7) * 1.1) + i * 1.7));
        schein("gruen", x, y, 9, gluehen * an * 0.85);
        g.fillStyle = `rgba(240,255,200,${gluehen * an})`;
        g.fillRect(x - 0.8, y - 0.8, 1.6, 1.6);
      }
      g.globalCompositeOperation = "source-over";
    }
  }

  // ---------------------------------------------------------------------------
  // Malen: Schrift
  // ---------------------------------------------------------------------------
  function text(t, x, y, gross, farbe, alpha = 1, gewicht = 800) {
    g.globalAlpha = alpha;
    g.font = `${gewicht} ${gross}px system-ui, sans-serif`;
    g.lineWidth = Math.max(3, gross * 0.22);
    g.strokeStyle = "rgba(8,26,24,0.82)";
    g.strokeText(t, x, y);
    g.fillStyle = farbe;
    g.fillText(t, x, y);
    g.globalAlpha = 1;
  }

  function zeichneTexte() {
    const W = view.cssW;
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.lineJoin = "round";
    const an = state.ansage;
    if (an && an.leben > 0) {
      const k = clamp(an.leben / an.max, 0, 1);
      const sicht = Math.min(1, k * 3) * Math.min(1, (an.max - an.leben) * 6);
      const y = view.frei + 34;
      text(an.text, W / 2, y, 21, an.farbe, sicht, 900);
      if (an.unter) text(an.unter, W / 2, y + 22, 13, "#eaf6f2", sicht, 700);
    }
    // Die Boni: Sie steigen über ihm auf und verblassen.
    state.plus.forEach((q) => {
      const k = clamp(q.leben / q.max, 0, 1);
      const sicht = Math.min(1, k * 3) * Math.min(1, (q.max - q.leben) * 8);
      const gross = Math.round(clamp(W * 0.04, 14, 18));
      const y = bildY(q.y) - 26 - (1 - k) * 34 - q.stufe * (gross + 4);
      text(q.text, clamp(bildX(q.x), 70, W - 70), y, gross, q.farbe, sicht, 800);
    });
    state.schriften.forEach((s) => {
      const k = clamp(s.leben / s.max, 0, 1);
      const sicht = Math.min(1, k * 2.5) * Math.min(1, (s.max - s.leben) * 3);
      const y = view.frei + (view.cssH - view.frei) * 0.4;
      text(s.text, W / 2, y - (1 - k) * 10, Math.round(clamp(W * 0.075, 22, 34)), s.farbe, sicht, 900);
      if (s.unter) text(s.unter, W / 2, y + 24 - (1 - k) * 10, 14, "#f4efe0", sicht * 0.95, 700);
    });
    // Am Ende: was geschah.
    const tot = state.tot;
    if (tot && tot.zeit > 0.45) {
      const k = clamp((tot.zeit - 0.45) / 0.3, 0, 1);
      const wort = { fisch: "Geschnappt!", blatt: "Untergegangen!", hecht: "Vom Hecht geholt!", stroemung: "Fortgerissen!" }[tot.art] || "";
      const y = view.frei + (view.ankerY - view.frei) * 0.45;
      text(wort, W / 2, y, Math.round(clamp(W * 0.085, 24, 40)), "#ffe6c0", k, 900);
      text(`${state.punkte} ${state.punkte === 1 ? "Punkt" : "Punkte"}`, W / 2, y + 30, 15, "#f6f2e8", k, 700);
      // Woraus sie bestehen (beim Zuschauen kennt man nur die Summe).
      if (state.phase !== "zuschauen" && bonusSumme() > 0) {
        const b = state.boni;
        const teile = [`Strecke ${state.strecke}`];
        if (b.voll) teile.push(`Volltreffer ${b.voll}`);
        if (b.knapp) teile.push(`Knapp ${b.knapp}`);
        if (b.druecker) teile.push(`Drücker ${b.druecker}`);
        if (b.klein) teile.push(`Klein ${b.klein}`);
        text(teile.join(" · "), W / 2, y + 50, Math.round(clamp(W * 0.032, 11, 13)), "#e6efe9", k * 0.95, 700);
      }
    }
    // Beim ersten Start: der Name.
    if (state.intro) {
      const k = state.intro.t / state.intro.dauer;
      const sicht = clamp(k * 4, 0, 1) * clamp((1 - k) * 3, 0, 1);
      text("Wasserläufer", W / 2, view.frei + (view.cssH - view.frei) * 0.28, Math.round(clamp(W * 0.1, 26, 46)), "#fffaf0", sicht, 900);
    }
  }

  // ---------------------------------------------------------------------------
  // Malen: alles zusammen
  // ---------------------------------------------------------------------------
  function ebenenNeu() {
    kachelGeometrie();
    kacheln = new Map();
    sprites = new Map();
    grasMuster.clear();
    kaustik = null;
  }

  function zeichneLaeufer() {
    const L = state.l;
    if (!L) return;
    const tot = state.tot;
    if (tot) {
      if (tot.art !== "stroemung") return;
      // Fortgerissen: Er treibt weg, dreht sich, und ist fort.
      const k = clamp(tot.zeit / 1.2, 0, 1);
      const s = state.stroemungen.find((q) => q === tot.was) || state.stroemungen.find((q) => Math.abs(q.y - tot.y) < 30);
      const v = s ? s.v : 20;
      const x = tot.x + v * tot.zeit * 1.6;
      laeuferMalen(bildX(x), bildY(tot.y), tot.w + tot.zeit * 14, { alpha: 1 - k });
      return;
    }
    // Sitzt er, wippt er leicht (mit dem Blatt, und ein wenig von selbst).
    const wipp = L.sitz && !L.sitz.laub ? blattWippen(L.sitz) * view.s : 0;
    const selbst = L.sitz && !ruhig() ? Math.sin(state.zeit * 3.1) * 0.12 * view.s : 0;
    const z = state.zug;
    laeuferMalen(bildX(L.x), bildY(L.y) + wipp + selbst, L.w, { sitzt: Boolean(L.sitz), spann: z?.aktiv ? z.st : 0 });
  }

  // Der Pfeil beim Zielen: Richtung und Stärke (länger, dicker, wärmer) –
  // aber nicht, wie weit es trägt. Mit dem Finger dazu das Band vom
  // Aufsetzen bis zum Finger und der kleine Kreis, in dem nichts geschieht.
  function zeichneZielen() {
    const z = state.zug;
    const L = state.l;
    if (!z || !L || state.tot || state.phase === "ende") return;
    g.lineCap = "round";
    if (z.quelle === "zeiger") {
      const tot = totPx();
      g.strokeStyle = "rgba(255,255,255,0.4)";
      g.lineWidth = 1.5;
      g.beginPath();
      g.arc(z.x0, z.y0, tot, 0, TAU);
      g.stroke();
      if (z.aktiv) {
        g.strokeStyle = "rgba(255,255,255,0.28)";
        g.lineWidth = 2;
        g.beginPath();
        g.moveTo(z.x0, z.y0);
        g.lineTo(z.x, z.y);
        g.stroke();
        g.fillStyle = "rgba(255,255,255,0.5)";
        g.beginPath();
        g.arc(z.x, z.y, 4, 0, TAU);
        g.fill();
      }
    }
    if (!z.aktiv) return;
    const x = bildX(L.x);
    const y = bildY(L.y);
    const fx = Math.cos(z.w);
    const fy = -Math.sin(z.w);
    const s = view.s;
    const st = clamp(z.st, 0, 1);
    const l0 = 3.6 * s;
    const l1 = (7.5 + 11 * st) * s;
    const spitze = (1.7 + 0.7 * st) * s;
    const farbe = st < 0.55 ? mix3([255, 255, 255], [255, 200, 80], st / 0.55) : mix3([255, 200, 80], [255, 92, 56], (st - 0.55) / 0.45);
    const breit = Math.max(2.5, (0.45 + 0.5 * st) * s);
    const ex = x + fx * (l1 - spitze * 0.6);
    const ey = y + fy * (l1 - spitze * 0.6);
    g.strokeStyle = rgba(farbe, 0.95);
    g.lineWidth = breit;
    g.beginPath();
    g.moveTo(x + fx * l0, y + fy * l0);
    g.lineTo(ex, ey);
    g.stroke();
    const qx = -fy;
    const qy = fx;
    const hx = x + fx * l1;
    const hy = y + fy * l1;
    const bx = hx - fx * spitze;
    const by = hy - fy * spitze;
    g.beginPath();
    g.moveTo(hx + fx * 1.2, hy + fy * 1.2);
    g.lineTo(bx + qx * (spitze * 0.62 + 1.2), by + qy * (spitze * 0.62 + 1.2));
    g.lineTo(bx - qx * (spitze * 0.62 + 1.2), by - qy * (spitze * 0.62 + 1.2));
    g.closePath();
    g.fillStyle = "rgba(10,24,20,0.42)";
    g.fill();
    g.beginPath();
    g.moveTo(hx, hy);
    g.lineTo(bx + qx * spitze * 0.62, by + qy * spitze * 0.62);
    g.lineTo(bx - qx * spitze * 0.62, by - qy * spitze * 0.62);
    g.closePath();
    g.fillStyle = rgba(farbe, 0.95);
    g.fill();
  }

  function zeichnen() {
    if (!g || !view.S) return;
    kaustikVorbereiten(state.phase === "bereit" ? 6 : 2.5);
    view.cxp = Math.round(state.camX * view.S);
    view.cyp = Math.round(state.camY * view.S);
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalAlpha = 1;
    g.globalCompositeOperation = "source-over";
    zeichneKacheln();
    g.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
    zeichneLaubSchatten();
    zeichneFischSchatten();
    if (state.l && !state.tot) zeichneDellenSchatten(state.l);
    zeichneFische();
    zeichneNachtSpiegel();
    zeichneStroemungen();
    zeichneTreibendes();
    zeichneGlitzer();
    zeichneBlaetter();
    zeichneLaub();
    zeichneRinge();
    zeichneGeister();
    zeichneLaeufer();
    zeichneZielen();
    zeichneSpritzer();
    zeichneVordergrund();
    zeichneInsekten();
    zeichneTexte();
    kachelnVorbereiten(state.phase === "bereit" ? 8 : 2.5);
  }

  // ---------------------------------------------------------------------------
  // Was aufspritzt
  // ---------------------------------------------------------------------------
  function ring(x, y, r0, wachs, leben, kraft = 1) {
    if (ruhig() && state.ringe.length > 6) return;
    state.ringe.push({ x, y, r: r0, wachs, leben, max: leben, kraft });
    if (state.ringe.length > 40) state.ringe.shift();
  }

  function spritzer(x, y, n, kraft) {
    if (ruhig()) return;
    for (let i = 0; i < n; i += 1) {
      const w = Math.random() * TAU;
      const v = (8 + Math.random() * 26) * kraft;
      const leben = 0.35 + Math.random() * 0.35;
      state.teile.push({ x, y, z: 0, vx: Math.cos(w) * v, vy: Math.sin(w) * v, vz: 20 + Math.random() * 40 * kraft, leben, max: leben, r: 0.3 + Math.random() * 0.5 });
    }
    if (state.teile.length > 120) state.teile.splice(0, state.teile.length - 120);
  }

  function schrift(text, farbe, gross = 24, dauer = 1.6, unter = "") {
    state.schriften = [{ text, unter, farbe, gross, leben: dauer, max: dauer }];
  }

  function ansage(text, unter, farbe = "#ffffff", dauer = 2.4) {
    state.ansage = { text, unter, farbe, leben: dauer, max: dauer };
  }

  // ---------------------------------------------------------------------------
  // Schlagen, landen, gefressen werden
  // ---------------------------------------------------------------------------
  function rudern(w, st) {
    const L = state.l;
    // Vom Blatt ab: wie viel Zeit ihm noch blieb (für den letzten Drücker).
    // Ein Schlag im Gleiten ändert daran nichts; vom Laub ab gibt es keinen.
    if (L.sitz) state.abflug = L.sitz.laub ? null : { rest: restBei(L.sitz, state.t) };
    schlag(L, state.t, w, st);
    state.schlaege += 1;
    state.letzterSchlag = state.t;
    state.stossBild = 1;
    state.stossSt = st;
    // Jeder Schlag mit Zeit (ms), Richtung (rad) und Stärke – für die
    // Prüfung und zum Nachsehen.
    state.eingaben.push({ t: Math.round(state.t * 1000), w: Math.round(w * 1000) / 1000, st: Math.round(st * 1000) / 1000 });
    klang()?.ton?.("wasserlaeufer.ruder", { laut: 0.35 + 0.35 * st });
    kids()?.vibrate?.(4 + Math.round(st * 5));
    // Die Ringe der Mittelbeine – je kräftiger, desto grösser.
    const qx = Math.cos(w + Math.PI / 2);
    const qy = Math.sin(w + Math.PI / 2);
    const wachs = 10 + 10 * st;
    ring(L.x + qx * 3.2 - Math.cos(w) * 1, L.y + qy * 3.2 - Math.sin(w) * 1, 0.6, wachs, 0.7, 0.6 + 0.4 * st);
    ring(L.x - qx * 3.2 - Math.cos(w) * 1, L.y - qy * 3.2 - Math.sin(w) * 1, 0.6, wachs, 0.7, 0.6 + 0.4 * st);
  }

  function gelandet(p) {
    const L = state.l;
    klang()?.ton?.("wasserlaeufer.landen", { laut: 0.5 });
    ring(L.x, L.y, 1, 10, 0.45, 0.5);
    if (!p.laub) {
      if (p.betreten === null) p.betreten = state.t;
      p.wippen = state.t;
      if (p.nr > state.reihe) {
        state.reihe = p.nr;
        // Beim Zuschauen kommen die Punkte aus der Aufzeichnung.
        if (state.phase !== "zuschauen") werten(p);
      }
      state.abflug = null;
    }
    // Der Fisch, der gerade aufsteigt, schnappt ins Leere – an den Rand des
    // Blattes – und taucht ab.
    const j = state.jagd;
    if (j.phase === "steigt") {
      spritzer(j.x, j.y, 8, 0.8);
      ring(j.x, j.y, 2, 18, 0.6, 0.9);
      klang()?.ton?.("wasserlaeufer.schnapp", { laut: 0.45 });
      j.phase = "taucht";
      j.t0 = state.t;
      j.leer = state.t;
    } else if (j.phase === "taucht") {
      j.phase = "ruhe";
    }
    state.plan = null;
  }

  // Ein Sprung in eine neue Reihe: die Strecke bis zu diesem Blatt, und
  // was er dabei an Boni verdient hat. Vor dem Fisch in gelandet(), der
  // danach ins Leere schnappt.
  function werten(p) {
    const L = state.l;
    const neu = [];
    const c = p.kreise.find((q) => q.x === L.mx && q.y === L.my) || p.kreise[0];
    const daneben = Math.hypot(L.ox - L.mx, L.oy - L.my);
    if (daneben <= c.r * VOLL_ANTEIL + VOLL_CM) neu.push("voll");
    const j = state.jagd;
    const vorBiss = j.phase === "steigt" ? j.warn - (state.t - j.t0) : null;
    if (vorBiss !== null && vorBiss <= KNAPP_S) neu.push("knapp");
    // Für die Prüfung: wie knapp es war.
    state.wertung = { reihe: p.nr, daneben: daneben / c.r, vorBiss, rest: state.abflug?.rest ?? null };
    if (state.abflug && state.abflug.rest <= DRUECKER_REST) neu.push("druecker");
    if (p.groesse === "klein") neu.push("klein");
    state.strecke = Math.max(state.strecke, Math.floor(Math.max(0, p.y) / PUNKT_CM));
    neu.forEach((art) => { state.boni[art] += 1; });
    state.punkte = state.strecke + bonusSumme();
    shell.setCount(state.punkte);
    if (!neu.length) return;
    klang()?.ton?.("wasserlaeufer.bonus", { laut: 0.35 + 0.1 * neu.length });
    if (neu.includes("voll")) {
      ring(L.x, L.y, 1.5, 14, 0.55, 1);
      ring(L.x, L.y, 0.5, 8, 0.4, 0.8);
    }
    // Die Schriften steigen über ihm auf, die ältesten zuerst weg.
    state.plus = state.plus.filter((q) => q.leben > 0.3).slice(-4);
    neu.forEach((art, i) => {
      state.plus.push({ text: `+1 ${BONI[art].text}`, farbe: BONI[art].farbe, x: L.x, y: L.y, stufe: i, leben: 1.3 + 0.12 * i, max: 1.3 + 0.12 * i });
    });
  }

  const bonusSumme = () => state.boni.voll + state.boni.knapp + state.boni.druecker + state.boni.klein;

  const ARTEN = ["fisch", "blatt", "hecht", "stroemung"];

  function sterben(art, was = null, nurBild = false) {
    if (state.schritt === "tot") return;
    const L = state.l;
    state.schritt = "tot";
    // Woher der Fisch kam (für das Bild): der Jäger aus seiner Richtung, der
    // Hecht aus seiner, unter dem Blatt von irgendwo.
    let fw = L.w + Math.PI;
    if (art === "fisch" && state.jagd.phase === "steigt") fw = state.jagd.w;
    if (art === "hecht" && was) fw = hechtOrt(was, state.t).w;
    state.tot = { art, zeit: 0, x: L.x, y: L.y, w: L.w, was, fw };
    if (art === "stroemung") {
      klang()?.ton?.("wasserlaeufer.fort", { laut: 0.8 });
    } else {
      klang()?.ton?.("wasserlaeufer.schnapp", { laut: 0.9 });
      spritzer(L.x, L.y, 18, 1.3);
      ring(L.x, L.y, 2, 26, 0.9, 1.2);
      ring(L.x, L.y, 1, 16, 0.7, 0.9);
    }
    kids()?.vibrate?.([30, 40, 70]);
    klangAus();
    if (nurBild) return;
    // In der Aufzeichnung: am Schluss negativ, woran es endete.
    gegner?.takt(state.punkte, { a: Math.round(L.x * 4), b: Math.round(L.y * 4), c: -(1 + Math.max(0, ARTEN.indexOf(art))) });
    stepTimer = window.setTimeout(finish, ruhig() ? 900 : STURZ_MS);
  }

  // Der Fisch auf offenem Wasser: Nach der Geduld steigt er unter ihm auf,
  // folgt ihm und schnappt nach der Warnung dort, wo er dann ist.
  // nurBild: beim Zuschauen – dort schnappt er, aber das Ende bestimmt die
  // Aufzeichnung.
  function jagdTakt(h, nurBild = false) {
    const L = state.l;
    const j = state.jagd;
    const n = (L.sitz && !L.sitz.laub ? L.sitz.nr : state.reihe) + 1;
    const imHecht = state.hechte.some((hg) => hg.abschnitt === n);
    const geduld = geduldBei(n) * (imHecht ? HECHT_GEDULD : 1);
    if (j.phase === "ruhe") {
      if (!L.sitz && L.nass >= geduld) {
        j.phase = "steigt";
        j.t0 = state.t;
        j.warn = warnungBei(n);
        j.v = fischVBei(n);
        j.x = L.x - Math.cos(L.w) * 3;
        j.y = L.y - Math.sin(L.w) * 3;
        j.w = L.w;
        klang()?.ton?.("wasserlaeufer.fisch", { laut: 0.7 });
      }
    } else if (j.phase === "steigt") {
      const dx = L.x - j.x;
      const dy = L.y - j.y;
      const d = Math.hypot(dx, dy);
      const schritt1 = Math.min(d, j.v * h);
      if (d > 1e-6) {
        j.x += (dx / d) * schritt1;
        j.y += (dy / d) * schritt1;
        j.w = Math.atan2(dy, dx);
      }
      if (state.t - j.t0 >= j.warn) {
        const nah = (L.x - j.x) ** 2 + (L.y - j.y) ** 2 < R_SCHNAPP * R_SCHNAPP;
        spritzer(j.x, j.y, 10, 0.9);
        ring(j.x, j.y, 2, 20, 0.7, 1);
        if (nah && !L.sitz && !blattBei(L.x, L.y, state.t, null, 0) && !nurBild) {
          sterben("fisch", j);
          return;
        }
        klang()?.ton?.("wasserlaeufer.schnapp", { laut: 0.5 });
        j.phase = "taucht";
        j.t0 = state.t;
      }
    } else if (j.phase === "taucht") {
      if (state.t - j.t0 > FISCH_PAUSE) {
        j.phase = "ruhe";
        // Wer seit dem Fehlgriff auf dem Wasser blieb, hat seine Geduld schon
        // aufgebraucht.
        if (!L.sitz && L.nass > FISCH_PAUSE) L.nass = Math.max(L.nass, geduld);
      }
    }
  }

  function physik(dt) {
    const L = state.l;
    const n = Math.max(1, Math.ceil(dt / TAKT - 1e-9));
    const h = dt / n;
    const melde = (art, was) => {
      if (art === "landen") gelandet(was);
      else sterben(art, was);
    };
    for (let i = 0; i < n; i += 1) {
      if (state.schritt === "tot") return;
      schritt(L, state.t, h, melde);
      state.t += h;
      if (state.schritt === "tot") return;
      jagdTakt(h);
    }
  }

  // Ein Schleuderschlag in Richtung w (in der Welt) mit der Stärke st (0
  // bis 1) – zu der Zeit, zu der er geschah (jetzt, wie performance.now).
  // Der erste startet die Runde.
  function schleudern(w, st, jetzt) {
    if (state.phase === "zuschauen" || state.phase === "ende") return false;
    if (!Number.isFinite(w) || !(st >= 0)) return false;
    if (state.phase === "bereit") losGehts();
    if (state.phase !== "spiel" || state.schritt === "tot") return false;
    if (Number.isFinite(jetzt) && last) {
      const mehr = clamp((jetzt - last) / 1000 - voraus, 0, 0.05);
      if (mehr > 0) {
        physik(mehr);
        voraus += mehr;
      }
      if (state.schritt === "tot") return false;
    }
    if (state.t - state.letzterSchlag < SCHLAG_PAUSE || state.kraft < 1) return false;
    state.kraft -= 1;
    rudern(w, clamp(st, 0, 1));
    return true;
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

  // Er steht, wo die Aufzeichnung ihn hat (a: quer in Vierteln, b: bachauf
  // in Vierteln, c: die Schläge mal 10000, die Spannung beim Zielen (0 bis
  // 9) mal 1000 und die Blickrichtung in Hundertsteln; am Schluss negativ,
  // woran es endete). Zielt er, zeigt der Pfeil dasselbe wie beim Spielen.
  function zuschauenTakt(dt) {
    const st = zuschauer.stand();
    if (!st) return;
    const L = state.l;
    if (state.schritt !== "tot") {
      state.t = Math.max(state.t, st.t / 1000);
      L.x = st.a / 4;
      L.y = st.b / 4;
      L.vx = st.va / 4;
      L.vy = st.vb / 4;
      const c = Math.round(st.c || 0);
      if (c < 0) {
        sterben(ARTEN[-c - 1] || "fisch", null, true);
      } else {
        L.w = (c % 1000) / 100;
        const spann = Math.floor((c % 10000) / 1000);
        state.zug = spann > 0 ? { w: L.w, st: spann / 9, aktiv: true, quelle: "zuschauen" } : null;
        const zahl = Math.floor(c / 10000);
        while (state.schlaege < zahl) {
          state.schlaege += 1;
          state.letzterSchlag = state.t;
          state.stossBild = 1;
          klang()?.ton?.("wasserlaeufer.ruder", { laut: 0.4 });
          ring(L.x, L.y, 0.6, 16, 0.7, 0.9);
        }
        // Worauf er sitzt: das Blatt unter ihm.
        const p = blattBei(L.x, L.y, state.t, null);
        const sitzt = p && Math.hypot(L.vx - blattOrt(p, state.t).vx, L.vy - blattOrt(p, state.t).vy) < 8;
        if (sitzt && L.sitz !== p) {
          L.sitz = p;
          gelandet(p);
        } else if (!sitzt && L.sitz && !drin(L.sitz, L.x, L.y, 0)) {
          L.sitz = null;
        }
        L.nass = L.sitz ? 0 : L.nass + dt;
        jagdTakt(dt, true);
      }
      const punkte = Math.max(0, Math.floor(st.punkte));
      if (punkte !== state.punkte) {
        state.punkte = punkte;
        shell.setCount(punkte);
      }
      klangStellen();
    }
    if (!zuschauer.weiter() && state.schritt !== "tot") sterben("fisch", null, true);
  }

  // ---------------------------------------------------------------------------
  // Der Takt
  // ---------------------------------------------------------------------------
  // Eine neue Welt bekommt ihren Namen; eine besondere Reihe wird
  // angesagt, sobald er auf der Reihe davor sitzt.
  function abschnittPruefen() {
    const L = state.l;
    const w = weltBei(L.y);
    if (w !== state.welt) {
      state.welt = w;
      schrift(WELT_NAME[w], "#fff6e0", 26, 2.6, WELT_UNTER[w]);
      klang()?.ton?.("wasserlaeufer.welt", { laut: 0.6 });
    }
    const nr = L.sitz && !L.sitz.laub ? L.sitz.nr : -1;
    if (nr < 0 || nr === state.abschnitt) return;
    state.abschnitt = nr;
    const naechster = state.reihen[nr + 1];
    if (naechster?.besonders === "stroemung") {
      ansage("Strömung voraus", "Ein Seitenbach reisst quer – reite das Laub hinüber", "#cfeaff", 2.8);
      klang()?.ton?.("wasserlaeufer.ansage", { laut: 0.7 });
    } else if (naechster?.besonders === "hecht") {
      ansage("Hechtgrube voraus", "Zu weit für einen Schlag – schleudere im Gleiten nach", "#ffd2a8", 2.8);
      klang()?.ton?.("wasserlaeufer.ansage", { laut: 0.7 });
    }
  }

  function takt(dt, strecke = dt) {
    state.zeit += dt;
    const L = state.l;
    if (state.ansage) { state.ansage.leben -= dt; if (state.ansage.leben <= 0) state.ansage = null; }
    if (state.stossBild > 0) state.stossBild = Math.max(0, state.stossBild - dt * 4);
    if (state.intro) {
      state.intro.t += dt;
      if (state.intro.t >= state.intro.dauer) {
        state.intro = null;
        host.dataset.intro = "aus";
      }
    }

    if (state.phase === "zuschauen") {
      zuschauenTakt(dt);
      if (state.schritt !== "tot") abschnittPruefen();
    } else if (state.phase === "spiel" && state.schritt !== "tot") {
      state.kraft = Math.min(KRAFT_MAX, state.kraft + KRAFT_ZURUECK * dt);
      if (strecke > 0) physik(strecke);
      if (state.schritt !== "tot") abschnittPruefen();
      klangStellen();
    }
    if (state.tot) state.tot.zeit += dt;

    for (let i = state.ringe.length - 1; i >= 0; i -= 1) {
      const r = state.ringe[i];
      r.r += r.wachs * dt;
      r.leben -= dt;
      if (r.leben <= 0) state.ringe.splice(i, 1);
    }
    for (let i = state.teile.length - 1; i >= 0; i -= 1) {
      const t = state.teile[i];
      t.vz -= 260 * dt;
      t.x += t.vx * dt;
      t.y += t.vy * dt;
      t.z += t.vz * dt;
      t.leben -= dt;
      if (t.leben <= 0 || t.z < -1) state.teile.splice(i, 1);
    }
    for (let i = state.plus.length - 1; i >= 0; i -= 1) {
      state.plus[i].leben -= dt;
      if (state.plus[i].leben <= 0) state.plus.splice(i, 1);
    }
    for (let i = state.schriften.length - 1; i >= 0; i -= 1) {
      state.schriften[i].leben -= dt;
      if (state.schriften[i].leben <= 0) state.schriften.splice(i, 1);
    }

    state.drift += (0.5 + nachWelt(state.camY, BACHAB)) * dt;

    // Die Kamera folgt ihm bachauf und dem Lauf des Baches quer. Beim ersten
    // Start gleitet sie vom Bach oben hinunter zu ihm.
    const zielY = L.y;
    const zielX = mitteBei(L.y + 25) * 0.7 + L.x * 0.3;
    if (state.phase === "bereit") {
      const k = state.intro ? glatt(state.intro.t / state.intro.dauer) : 1;
      state.camY = zielY + INTRO_WEG * (1 - k);
      state.camX = lerp(mitteBei(zielY + INTRO_WEG), zielX, k);
    } else if (state.schritt !== "tot") {
      state.camY += (zielY - state.camY) * (1 - Math.exp(-dt * 3.2));
      state.camX += (zielX - state.camX) * (1 - Math.exp(-dt * 2));
    }
    planBis(state.camY + SICHT_OBEN + 280, 2);

    // Das Blatt unter ihm beginnt zu sinken: ein Gurgeln. Der Hecht zieht
    // nah vorbei: ein Flossenschlag.
    if ((state.phase === "spiel" || state.phase === "zuschauen") && state.schritt !== "tot") {
      const p = L.sitz && !L.sitz.laub ? L.sitz : null;
      if (p && sinktBei(p, state.t) > 0 && p.gurgelt !== true) {
        p.gurgelt = true;
        klang()?.ton?.("wasserlaeufer.sinken", { laut: 0.7 });
      }
      for (const hg of state.hechte) {
        if (Math.abs(hg.cy - L.y) > 60) continue;
        const o = hechtOrt(hg, state.t);
        const nah = Math.hypot(o.x - L.x, o.y - L.y) < 22;
        if (nah && !hg.nah && state.t - (hg.klang || -9) > 1.2) {
          hg.klang = state.t;
          klang()?.ton?.("wasserlaeufer.hecht", { laut: 0.8 });
        }
        hg.nah = nah;
      }
    }

    zielenTakt(dt);

    if (state.phase === "spiel" && state.schritt !== "tot") {
      const z = state.zug;
      const spann = z?.aktiv ? Math.round(z.st * 9) : 0;
      const c = state.schlaege * 10000 + spann * 1000 + Math.round((((L.w % TAU) + TAU) % TAU) * 100);
      gegner?.takt(state.punkte, { a: Math.round(L.x * 4), b: Math.round(L.y * 4), c });
    }
  }

  // Zielen: Er dreht sich zum Ziel (nur das Bild – die Richtung gibt der
  // Schlag), und mit der Tastatur dreht der Pfeil und lädt die Stärke.
  function zielenTakt(dt) {
    const L = state.l;
    if (!L || state.schritt === "tot" || state.phase === "ende") return;
    if (state.phase !== "zuschauen" && !zeiger && (tasten.links || tasten.rechts || tasten.laden !== null || state.zeit - tasten.zuletzt < 1.6)) {
      const dreh = (tasten.links ? 1 : 0) - (tasten.rechts ? 1 : 0);
      tasten.w += dreh * TASTEN_DREH * dt;
      const st = tasten.laden === null ? 0 : clamp((performance.now() - tasten.laden) / 1000 / LADE_ZEIT, 0, 1);
      state.zug = { w: tasten.w, st, aktiv: true, quelle: "tasten", laedt: tasten.laden !== null };
      if (dreh || tasten.laden !== null) tasten.zuletzt = state.zeit;
    } else if (state.zug?.quelle === "tasten") {
      state.zug = null;
    }
    const z = state.zug;
    if (z?.aktiv) L.w += winkelDiff(z.w, L.w) * (1 - Math.exp(-dt * 16));
  }

  function loop(now) {
    frame = window.requestAnimationFrame(loop);
    ruhigJetzt = null;
    const dt = clamp((now - last) / 1000, 0, 0.05);
    last = Math.max(last, now);
    const strecke = Math.max(0, dt - voraus);
    voraus = 0;
    messen();
    takt(dt, strecke);
    zeichnen();
  }

  // Die Runde beginnt: mit dem ersten Schlag – oder im Live-Modus zum
  // gemeinsamen Start. Das Blatt, auf dem er sitzt, gilt ab jetzt als
  // betreten.
  function losGehts() {
    if (state.phase !== "bereit") return;
    state.phase = "spiel";
    state.schritt = "lauf";
    state.t = 0;
    state.blaetter[0].betreten = 0;
    if (state.intro) { state.intro = null; host.dataset.intro = "aus"; }
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
    state.reihe = 0;
    state.strecke = 0;
    state.boni = { voll: 0, knapp: 0, druecker: 0, klein: 0 };
    state.abflug = null;
    state.wertung = null;
    state.plus = [];
    state.t = 0;
    state.zeit = 0;
    state.schlaege = 0;
    state.letzterSchlag = -9;
    state.kraft = KRAFT_MAX;
    state.tot = null;
    state.teile = [];
    state.ringe = [];
    state.schriften = [];
    state.ansage = null;
    state.welt = 0;
    state.abschnitt = -1;
    state.plan = null;
    state.stossBild = 0;
    state.jagd = { phase: "ruhe", t0: 0, x: 0, y: 0, w: 0, v: 0, warn: 1 };
    state.drift = 0;
    state.eingaben = [];
    state.zug = null;
    state.stossSt = 0;
    zeiger = null;
    tasten.laden = null;
    tasten.w = Math.PI / 2;
    tasten.zuletzt = -9;
    weltNeu();
    const p0 = state.blaetter[0];
    state.l = { x: p0.x, y: p0.y, vx: 0, vy: 0, w: Math.PI / 2, sitz: p0, von: null, nass: 0, ox: 0, oy: 0, mx: 0, my: 0 };
    state.camX = mitteBei(25);
    state.camY = 0;
    voraus = 0;
    shell.setCount(0);
    gegner?.runde();

    state.intro = ersterStart && !zuschauer && !shell.live && !ruhig() ? { t: 0, dauer: 3.2 } : null;
    ersterStart = false;
    host.dataset.intro = state.intro ? "an" : "aus";

    shell.clear();
    const prompt = shell.el("p", "cm-prompt wa-prompt", "Zieh zurück und lass los – wie eine Schleuder.");
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
    const dauer = Math.min(900, 160 + ziel * 14);
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
    fisch: "Von einem Fisch geschnappt",
    blatt: "Das Blatt ging unter",
    hecht: "Vom Hecht gefressen",
    stroemung: "Von der Strömung fortgerissen",
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
    const warum = WARUM[state.tot?.art] || "";
    // Wie weit (je Punkt der Strecke PUNKT_CM) und was an Boni dazukam.
    const meter = `${((state.strecke * PUNKT_CM) / 100).toFixed(1).replace(".", ",")} m`;
    const boni = bonusSumme();
    const wie = `${meter}${boni ? ` + ${boni} Bonus` : ""}`;
    shell.showResult({
      label: "Deine Punkte",
      points: punkte,
      detail: rekord ? `Neuer Rekord! · ${wie}` : `${warum ? `${warum} · ` : ""}${wie}`,
      geist,
    });
    if (rekord) host.querySelector(".cm-result-detail")?.classList.add("wa-rekord");
    zaehleHoch(punkte);
  }

  // ---------------------------------------------------------------------------
  // Start
  // ---------------------------------------------------------------------------
  shell = shellApi.mount({
    host,
    title: "Wasserläufer",
    area: "geschwindigkeit",
    accent: "#F5A623",
    accentDark: "#b9741a",
    clock: false,
    onRestart: () => (zuschauer ? zuschauenStarten() : startRun()),
    live: { los: losGehts, stopp: () => finish(), zuschauen: (quelle) => { zuschauer = quelle; zuschauenStarten(); } },
  });
  zuschauer = window.LernappGeist?.zuschauer?.({
    host, spiel: "pondSkater", fassung: "t3", zufall, einheit: "Punkte", nochmal: zuschauenStarten,
  }) || null;
  if (!zuschauer) {
    gegner = window.LernappGeist?.fuer?.({ spiel: "pondSkater", host, art: "tempo", fassung: "t3", alle: true, zufall }) || null;
  }

  startRun();
  zuschauer?.laden.then((da) => { if (da) zuschauenStarten(); });

  // Die Schleuder: irgendwo aufsetzen, ziehen, loslassen. Nur Knöpfe
  // bleiben Knöpfe. Gezählt wird in CSS-Pixeln der Fläche.
  const totPx = () => Math.max(TOT_MIN, TOT_ANTEIL * Math.min(view.cssW, view.cssH));
  const zugPx = () => clamp(ZUG_ANTEIL * Math.min(view.cssW, view.cssH), ZUG_MIN, ZUG_MAX);
  // Aus dem Zug (vom Aufsetzen zum Finger) die Richtung (entgegen) und die
  // Stärke – oder null im Kreis, in dem nichts geschieht.
  function zugWert(z) {
    const dx = z.x - z.x0;
    const dy = z.y - z.y0;
    const tot = totPx();
    const len = Math.hypot(dx, dy);
    if (len < tot) return null;
    return { w: Math.atan2(dy, -dx), st: clamp((len - tot) / (zugPx() - tot), 0, 1) };
  }
  function zeigerStellen() {
    const v = zugWert(zeiger);
    state.zug = {
      w: v ? v.w : state.zug?.w ?? state.l?.w ?? Math.PI / 2, st: v ? v.st : 0, aktiv: Boolean(v), quelle: "zeiger",
      x0: zeiger.x0, y0: zeiger.y0, x: zeiger.x, y: zeiger.y,
    };
  }
  const zeitVon = (event) => (Math.abs(performance.now() - event.timeStamp) < 250 ? event.timeStamp : performance.now());

  host.addEventListener("pointerdown", (event) => {
    if (event.target.closest("button, a, input")) return;
    if (zeiger || !canvas || state.phase === "zuschauen" || state.phase === "ende") return;
    if (event.button > 0) return;
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    zeiger = { id: event.pointerId, links: rect.left, oben: rect.top, x0: x, y0: y, x, y };
    try { host.setPointerCapture(event.pointerId); } catch { /* egal */ }
    zeigerStellen();
  });
  host.addEventListener("pointermove", (event) => {
    if (!zeiger || event.pointerId !== zeiger.id) return;
    zeiger.x = event.clientX - zeiger.links;
    zeiger.y = event.clientY - zeiger.oben;
    zeigerStellen();
  });
  host.addEventListener("pointerup", (event) => {
    if (!zeiger || event.pointerId !== zeiger.id) return;
    zeiger.x = event.clientX - zeiger.links;
    zeiger.y = event.clientY - zeiger.oben;
    const v = zugWert(zeiger);
    zeiger = null;
    state.zug = null;
    if (v) schleudern(v.w, v.st, zeitVon(event));
  });
  host.addEventListener("pointercancel", (event) => {
    if (!zeiger || event.pointerId !== zeiger.id) return;
    zeiger = null;
    state.zug = null;
  });

  // Die Tastatur: links und rechts zielen (halten dreht), oben zielt gerade
  // bachauf; Leertaste oder Enter halten lädt, loslassen schleudert, Escape
  // bricht ab.
  document.addEventListener("keydown", (event) => {
    if (document.activeElement?.tagName === "BUTTON" || state.phase === "zuschauen" || state.phase === "ende") return;
    const k = event.key;
    if (k === "ArrowLeft" || k === "ArrowRight") {
      event.preventDefault();
      if (!event.repeat) tasten.w += (k === "ArrowLeft" ? 1 : -1) * TASTEN_SCHRITT;
      if (k === "ArrowLeft") tasten.links = true; else tasten.rechts = true;
      tasten.zuletzt = state.zeit;
    } else if (k === "ArrowUp") {
      event.preventDefault();
      tasten.w = Math.PI / 2;
      tasten.zuletzt = state.zeit;
    } else if (k === " " || k === "Enter") {
      event.preventDefault();
      if (event.repeat || tasten.laden !== null) return;
      tasten.laden = performance.now();
      tasten.zuletzt = state.zeit;
    } else if (k === "Escape" && tasten.laden !== null) {
      event.preventDefault();
      tasten.laden = null;
    }
  });
  document.addEventListener("keyup", (event) => {
    const k = event.key;
    if (k === "ArrowLeft") tasten.links = false;
    if (k === "ArrowRight") tasten.rechts = false;
    if ((k === " " || k === "Enter") && tasten.laden !== null) {
      event.preventDefault();
      const jetzt = zeitVon(event);
      const st = clamp((jetzt - tasten.laden) / 1000 / LADE_ZEIT, 0, 1);
      tasten.laden = null;
      tasten.zuletzt = state.zeit;
      schleudern(tasten.w, st, jetzt);
    }
  });
  window.addEventListener("blur", () => { tasten.links = false; tasten.rechts = false; tasten.laden = null; });

  window.addEventListener("resize", messen);
  window.addEventListener("orientationchange", messen);
  window.addEventListener("pagehide", () => { clearStep(); stopLoop(); klangAus(); });

  // Für die Prüfskripte und die Vorführung.
  window.LernappWasserlaeufer = {
    J_MIN, J_MAX, TAU_W, MU_W, TAU_B, MU_B, R_SCHNAPP, R_HECHT, FASSUNG, KRAFT_MAX, state, view,
    PUNKT_CM, VOLL_ANTEIL, VOLL_CM, KNAPP_S, DRUECKER_REST, gelandet,
    takt, schleudern, losGehts, physik, planBis, kursText, pilot, fensterVon, blattBei, blattOrt, hechtOrt, laubOrt, vorausrechnen,
    schwere, spaet, reihenAbstandBei, radienBei, haltBei, geduldBei, warnungBei, fischVBei, spielraumWBei, spielraumSBei, jVon, weiteVon,
    mitteBei, halbBei, weltBei, bildX, bildY, totPx, zugPx,
    // Zielen wie mit dem Finger (für die Vorführung und die Bilder): Pfeil
    // und Spannung ohne Schlag; null räumt weg.
    zielen: (w, st) => { state.zug = w === null || w === undefined ? null : { w, st, aktiv: true, quelle: "pilot" }; },
  };
})();
