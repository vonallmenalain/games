/*
 * wasserlaeufer.js – Wasserläufer.
 * ---------------------------------------------------------------------------
 * Ein Teich am Nachmittag, von oben gesehen. Auf einem Seerosenblatt sitzt
 * ein Wasserläufer und dreht sich unaufhörlich um sich selbst, wie eine
 * Kompassnadel. Eine Regel: Ein Tipp ist ein Ruderschlag – in die Richtung,
 * in die er gerade schaut. Auf dem Wasser gleitet er weit, auf einem Blatt
 * hält er rasch an, denn das Blatt greift. Man steuert nur über den
 * Zeitpunkt; die Richtung macht die Drehung.
 *
 * Ziel: von Blatt zu Blatt den Bach hinauf. Gezählt werden die Blätter.
 *
 * Auf dem Blatt ist er sicher – aber nicht lange: Ein betretenes Blatt
 * schaukelt, läuft voll Wasser und geht unter, und wer dann noch darauf
 * sitzt, den holt der Fisch, der darunter wartet. Auf offenem Wasser ist er
 * in Gefahr: Wer zu lange dort bleibt, unter dem steigt ein Fisch auf –
 * zuerst ein blasser Schatten, der dunkler wird und ihm folgt, dann schnappt
 * er zu. Entkommen kann ihm nur, wer vorher ein Blatt erreicht – dann
 * schnappt er ins Leere. Rudern kostet Kraft: zwei Schläge kurz nacheinander
 * gehen, dann braucht er einen Moment.
 *
 * Jedes Blatt zeigt mit einem Pfeil, wie herum er sich darauf dreht. Später
 * drehen sie schneller, die Blätter liegen weiter auseinander und sind
 * kleiner, sie halten kürzer, und die Fische kommen früher.
 *
 * Jeder achte Abschnitt ist besonders, im festen Wechsel und vorher
 * angesagt: eine Strömung (ein Seitenbach reisst quer über den Weg, und
 * hinüber geht es nur auf treibendem Laub – wer zu weit mitgetragen wird,
 * ist fort) oder eine Hechtgrube (tiefes, dunkles Wasser, ein grosser Hecht
 * zieht seine Kreise, und das nächste Blatt liegt so weit, dass ein Schlag
 * nicht reicht).
 *
 * Die Welt wechselt bachaufwärts: der Seerosenteich am Nachmittag, der
 * Bachlauf mit Steinen, der Mühlenteich, das Moor in der Dämmerung und die
 * Quelle in der Nacht.
 *
 * Gebaut wird aus dem Zufall (zufall.js): ohne Turnier jedes Mal eine andere
 * Welt, im Turnier für alle im selben Versuch dieselbe. Sie ist immer zu
 * schaffen, weil zuerst der Weg entsteht – Blatt um Blatt, und jeder Sprung
 * wird nachgerechnet: Aus der Mitte des Blattes muss ein Schlag in einem
 * Fenster von Richtungen auf dem nächsten Blatt landen, das breit genug ist
 * (blattFenster). Ein Autopilot (pilot) beweist es in der Prüfung.
 *
 * Die Runde hängt nur an der Spielzeit, der Saat und den Tipps (mit ihrer
 * Zeit, tippen, voraus). Die Gegner (geist.js) laufen als Wasserläufer aus
 * Licht mit, und die besten Läufe lassen sich anschauen (?zuschauen=).
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
  const ruhig = () => Boolean(kids()?.prefersReducedMotion?.());

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
  // Der Ruderschlag: so viele Zentimeter je Sekunde, in die Blickrichtung.
  // Mehrere Schläge zählen zusammen; zwei dürfen höchstens SCHLAG_PAUSE
  // dicht aufeinander folgen.
  const J = 74;
  const SCHLAG_PAUSE = 0.07;
  // Die Kraft: Ein Schlag braucht eine ganze; zwei hat er höchstens (der
  // Doppelschlag), und sie kommt mit KRAFT_ZURUECK je Sekunde wieder. Wer
  // dauernd tippt, rudert nicht schneller.
  const KRAFT_MAX = 2;
  const KRAFT_ZURUECK = 1.6;
  // Auf dem Wasser: Das Gleiten klingt in TAU_W Sekunden auf gut ein Drittel
  // ab, dazu bremst es fest um MU_W. Ein Schlag aus dem Stand trägt so gut
  // 38 cm weit.
  const TAU_W = 0.55;
  const MU_W = 7;
  // Auf dem Blatt: Es greift – in TAU_B und mit MU_B ist er fast sofort
  // still. Gelandet ist er, wenn er langsamer ist als LANDEN_V; das Blatt
  // greift, wenn seine Mitte RAND_B innerhalb des Randes ist.
  const TAU_B = 0.05;
  const MU_B = 320;
  const LANDEN_V = 5;
  const RAND_B = 1.3;
  // Gelandet gleitet er in die Mitte des Blattes (in gut SITZ_ZEIT).
  const SITZ_ZEIT = 0.11;
  // Der Fisch: So nah muss er ihm beim Schnappen sein.
  const R_SCHNAPP = 9;
  const FISCH_PAUSE = 0.55;        // so lange taucht er nach einem Fehlgriff ab
  // Das Blatt geht unter: so lange vorher sieht man es sinken.
  const SINKEN = 1.1;
  // Der Hecht: So nah an seinem Kopf ist man gefressen.
  const R_HECHT = 5;
  // So weit sieht man über ihm voraus und unter ihm zurück – auf jedem
  // Gerät gleich weit voraus. Hochkant gibt die Breite FELD_SICHT den
  // Massstab vor, quer die Höhe.
  const SICHT_OBEN = 84;
  const SICHT_UNTEN = 30;
  const FELD_SICHT = 72;
  const TAKT = 1 / 240;
  const STURZ_MS = 2300;
  const INTRO_WEG = 150;           // so weit oben beginnt der Blick beim ersten Start (cm)
  const FASSUNG = "t1";
  // Die Schwere nach dem Blatt n: Die ersten SCHWER_AB Sprünge sind zum
  // Hineinfinden, danach wird es zügig schwerer – nach gut SCHWER_ZAHL
  // Blättern sind sechs Zehntel der Härte da.
  const SCHWER_AB = 3;
  const SCHWER_ZAHL = 13;

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
  // Wie schnell er sich auf Blatt n dreht (Umdrehungen je Sekunde): anfangs
  // gut eine halbe, bald eine ganze.
  const drehBei = (n) => lerp(0.62, 1.52, schwere(n));
  // Wie weit Blatt n vom vorigen liegt (Mitte zu Mitte) und wie gross es ist.
  const abstandBei = (n) => lerp(22, 36, schwere(n));
  const radiusBei = (n) => lerp(10, 5.5, schwere(n));
  // Wie lange ein Blatt hält, wenn er darauf sitzt: immer mindestens eine
  // Umdrehung und etwas mehr, anfangs gut dreieinhalb Sekunden.
  const haltBei = (n, f) => Math.max(1 / f + 0.45, lerp(3.4, 1.15, schwere(n)));
  // Der Fisch: so lange Geduld (auf offenem Wasser, bis er aufsteigt), so
  // lange steigt er (die Warnung), so schnell folgt er.
  const geduldBei = (n) => lerp(1.4, 0.7, schwere(n));
  const warnungBei = (n) => lerp(0.85, 0.5, schwere(n));
  const fischVBei = (n) => lerp(70, 95, schwere(n));
  // Das Fenster: so viele Millisekunden muss die Drehung mindestens auf das
  // nächste Blatt zeigen (aus seiner Mitte, ein Schlag).
  const fensterMinBei = (n) => lerp(140, 34, schwere(n));

  // ---------------------------------------------------------------------------
  // Zustand
  // ---------------------------------------------------------------------------
  // phase:   "bereit" (noch nichts getippt), "spiel", "zuschauen", "ende"
  // schritt: "start" (er sitzt auf dem ersten Blatt), "lauf", "tot"
  const state = {
    phase: "bereit",
    schritt: "start",
    punkte: 0,
    t: 0,                    // die Spielzeit
    zeit: 0,                 // die Uhr des Bildes
    // Der Wasserläufer: Ort, Tempo, Blickrichtung w, Drehung om (rad/s),
    // worauf er sitzt (sitz), von welchem Blatt er sich abgestossen hat
    // (von – es greift erst wieder, wenn er es verlassen hat), wie lange er
    // schon auf offenem Wasser ist (nass) und der Versatz zur Mitte des
    // Blattes (ox, oy).
    l: null,
    schlaege: 0,
    letzterSchlag: -9,
    kraft: KRAFT_MAX,
    blaetter: [],            // die Kette: Blatt um Blatt, nach y geordnet
    stroemungen: [],         // die Strömungen mit ihrem Laub
    hechte: [],
    abschnitte: [],
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
  let ebenen = null;
  let kulisseTeich = null;
  let kulisseBach = null;
  let kulisseAbend = null;

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
   * Ein Blatt der Kette: { nr, x, y, r, kreise, dreh, f, halt, … }. kreise
   * sind seine Teile (ein Seerosenteppich hat mehrere), relativ zu x, y.
   * Betreten wird es zur Zeit betreten; nach halt geht es unter.
   *
   * Das Laub einer Strömung ist kein Blatt der Kette: Blatt k eines Bandes s
   * ist zur Zeit t bei laubX(s, k, t). Es kommt aus dem Seitenbach (xa) und
   * treibt bis zum Abfluss (xb), dann ist es fort – und wer darauf sitzt,
   * mit ihm.
   */
  function drin(p, x, y, rand = RAND_B, t = state.t) {
    if (p.laub) {
      const q = laubOrt(p.s, p.k, t);
      const dx = x - q.x;
      const dy = y - q.y;
      return dx * dx + dy * dy < (p.s.r - rand) ** 2;
    }
    for (const c of p.kreise) {
      const dx = x - p.x - c.x;
      const dy = y - p.y - c.y;
      const r = c.r - rand;
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

  // Das erste Blatt der Kette, dessen obere Kante über y0 liegt.
  function blattAb(y0) {
    const liste = state.blaetter;
    let lo = 0;
    let hi = liste.length;
    while (lo < hi) {
      const m = (lo + hi) >> 1;
      if (liste[m].y + liste[m].ausdehnung < y0) lo = m + 1; else hi = m;
    }
    return lo;
  }

  const laubCache = new Map();
  function laubBlatt(s, k) {
    const key = `${s.nr}:${k}`;
    let p = laubCache.get(key);
    if (!p) {
      p = { laub: true, s, k, nr: -1, dreh: s.dreh, f: s.f, saat: hash01(s.nr * 31.7 + k * 7.3) };
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
  function blattBei(x, y, t, von = null) {
    const liste = state.blaetter;
    for (let i = blattAb(y - 1); i < liste.length; i += 1) {
      const p = liste[i];
      if (p.y - p.ausdehnung > y + 1) break;
      if (p === von || versunken(p, t)) continue;
      if (drin(p, x, y, RAND_B, t)) return p;
    }
    for (const s of state.stroemungen) {
      if (Math.abs(y - s.y) > s.r + 3) continue;
      for (const k of laubImBand(s, t, s.r)) {
        const p = laubBlatt(s, k);
        if (p === von) continue;
        const q = laubOrt(s, k, t);
        if (q.u < 0 || q.u > 1) continue;
        if ((x - q.x) ** 2 + (y - q.y) ** 2 < (s.r - RAND_B) ** 2) return p;
      }
    }
    return null;
  }

  const versunken = (p, t) => !p.laub && p.betreten !== null && t >= p.betreten + p.halt;

  // Wie sehr ein Blatt schon sinkt (0 bis 1, in der letzten SINKEN Sekunden).
  function sinktBei(p, t) {
    if (p.laub || p.betreten === null) return 0;
    return clamp((t - (p.betreten + p.halt - SINKEN)) / SINKEN, 0, 1);
  }

  // ---------------------------------------------------------------------------
  // Der Wasserläufer: Schlag und Schritt
  // ---------------------------------------------------------------------------
  /*
   * Ein Schritt der Physik, für das Spiel und für jede Vorausrechnung
   * (Autopilot, Fenster der Kette) derselbe. L ist der Wasserläufer, t die
   * Zeit zu Beginn des Schritts, h seine Länge. Was geschieht, meldet er an
   * melde(art, was) – die Vorausrechnung bricht dort ab.
   */
  function schritt(L, t, h, melde) {
    L.w += L.om * h;
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
      const k = Math.exp(-h / TAU_B);
      rx *= k;
      ry *= k;
      const v = Math.hypot(rx, ry);
      const weniger = v > 1e-9 ? Math.max(0, v - MU_B * h) / v : 0;
      rx *= weniger;
      ry *= weniger;
      L.vx = ort.vx + rx;
      L.vy = ort.vy + ry;
      L.x += L.vx * h;
      L.y += L.vy * h;
      if (Math.hypot(rx, ry) < LANDEN_V) {
        L.sitz = p;
        L.von = null;
        L.om = p.dreh * TAU * p.f;
        const jetzt = blattOrt(p, t1);
        L.ox = L.x - jetzt.x;
        L.oy = L.y - jetzt.y;
        const m = sitzMitte(p, L.x, L.y);
        L.mx = m.x;
        L.my = m.y;
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
    return { x: p.x, y: p.y, vx: 0, vy: 0, u: 0 };
  }

  // Ein Ruderschlag in die Blickrichtung.
  function schlag(L, t) {
    if (L.sitz) {
      const ort = blattOrt(L.sitz, t);
      L.vx = ort.vx;
      L.vy = ort.vy;
      L.von = L.sitz;
      L.sitz = null;
    }
    L.vx += J * Math.cos(L.w);
    L.vy += J * Math.sin(L.w);
  }

  const kopie = (L) => ({ ...L });

  // Beim Planen des Autopiloten hält er Abstand zum Hecht (sonst 0).
  let hechtRand = 0;

  // Rechnet voraus: Was geschieht, wenn er zur Zeit t0 in Lage L ist und zu
  // den Zeiten schlaege schlägt? Bis er landet (auf einem anderen Blatt als
  // dem, auf dem er sitzt), stirbt oder bis tBis. Gröber als das Spiel
  // (dt), aber mit derselben Physik.
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
      while (i < schlaege.length && schlaege[i] <= t + 1e-9) { schlag(L, t); i += 1; }
      // Bis zum nächsten Schlag genau, sonst im Takt.
      const h = i < schlaege.length ? Math.min(dt, Math.max(1e-4, schlaege[i] - t)) : dt;
      schritt(L, t, h, melde);
      t += h;
      if (i >= schlaege.length && !L.sitz && Math.abs(L.vx) + Math.abs(L.vy) < 3 && Math.abs(stroemungBei(L.x, L.y).x) < 1) break;
    }
    return ergebnis || { art: "offen", t, L };
  }

  // ---------------------------------------------------------------------------
  // Die Welt: der Weg zuerst, Blatt um Blatt
  // ---------------------------------------------------------------------------
  /*
   * Abschnitt n führt von Blatt n − 1 zu Blatt n. Ein gewöhnlicher: das
   * nächste Blatt schräg darüber, im Zickzack, so weit und so gross wie die
   * Schwere es will. Dann wird nachgerechnet (blattFenster): Aus der Mitte
   * des vorigen Blattes, ein Schlag, für jede Blickrichtung – landet er auf
   * dem neuen? Das Fenster der Richtungen, die treffen, muss mindestens
   * fensterMinBei(n) Millisekunden der Drehung breit sein; sonst rückt das
   * Blatt näher und wird grösser, bis es passt.
   *
   * Jeder achte Abschnitt ist besonders, im Wechsel:
   *
   *   stroemung  (8., 24., 40.) Ein Band quer über den Bach, in dem das
   *              Wasser zur Seite reisst; darauf treibt Laub. Das Blatt
   *              darüber ist ein Seerosenteppich, fast so breit wie der
   *              Bach. Das Blatt davor hält länger.
   *   hecht      (16., 32., 48.) Die Hechtgrube: Das nächste Blatt (ein
   *              Teppich) liegt so weit, dass ein Schlag nicht reicht –
   *              zwei kurz hintereinander oder einer im Gleiten. Ein Hecht
   *              zieht seine Kreise quer über den Weg.
   *
   * Immer gleich viele Zahlen ziehen, was auch geschieht: Die Welt soll an
   * der Saat hängen, nicht an den Zweigen dieser Funktion.
   */
  function blattNeu(nr, x, y, r, z, wahl = {}) {
    const p = {
      nr, x, y, r, kreise: [{ x: 0, y: 0, r }], dreh: 1, f: 0.6, halt: 3, betreten: null,
      art: "blatt", bluete: 0, kerbe: z * TAU, saat: z, ausdehnung: r, ...wahl,
    };
    p.ausdehnung = Math.max(...p.kreise.map((c) => Math.abs(c.y) + c.r));
    return p;
  }

  function startBlatt() {
    const p = blattNeu(0, mitteBei(0), 0, 12, 0.37, { art: "start", dreh: 1, f: drehBei(0), halt: 4.5 });
    p.bluete = 1;
    return p;
  }

  // Wie breit (in Millisekunden der Drehung) das Fenster von A nach B ist:
  // Aus der Mitte von A, aus dem Stand, ein Schlag in Richtung w – landet er
  // auf B? Gesucht wird die Richtung zur Mitte und ringsum, dann die Kanten
  // genauer. f: Umdrehungen je Sekunde auf A.
  function blattFenster(A, B, f, t = 0) {
    if (A.kreise.length > 1) {
      // Vom Teppich aus zählt jedes seiner Blätter – er kann auf jedem sitzen.
      let schlecht = null;
      for (const c of A.kreise) {
        const fen = blattFenster({ ...A, x: A.x + c.x, y: A.y + c.y, kreise: [{ x: 0, y: 0, r: c.r }], echt: A }, B, f, t);
        if (!schlecht || fen.ms < schlecht.ms) schlecht = fen;
      }
      return schlecht;
    }
    const von = A.echt || A;
    const L = { x: A.x, y: A.y, vx: 0, vy: 0, w: 0, om: 0, sitz: null, von, nass: 0, ox: 0, oy: 0, mx: 0, my: 0 };
    const trifft = (w) => {
      L.w = w;
      const L0 = { ...L, vx: J * Math.cos(w), vy: J * Math.sin(w) };
      const e = vorausrechnen(L0, t, [], t + 1.4, 1 / 90);
      return e.art === "landen" && e.blatt === B;
    };
    const w0 = Math.atan2(B.y - A.y, B.x - A.x);
    let mitte = null;
    for (let i = 0; i <= 24 && mitte === null; i += 1) {
      const d = (i % 2 ? 1 : -1) * Math.ceil(i / 2) * 0.035;
      if (trifft(w0 + d)) mitte = w0 + d;
    }
    if (mitte === null) return { ms: 0, w: w0, a: w0, b: w0 };
    const kante = (richtung) => {
      let innen = 0;
      let aussen = 0.9;
      if (trifft(mitte + richtung * aussen)) return aussen;
      for (let i = 0; i < 9; i += 1) {
        const m = (innen + aussen) / 2;
        if (trifft(mitte + richtung * m)) innen = m; else aussen = m;
      }
      return innen;
    };
    const a = mitte - kante(-1);
    const b = mitte + kante(1);
    return { ms: ((b - a) / (TAU * f)) * 1000, w: (a + b) / 2, a, b };
  }

  function abschnittBauen() {
    const liste = state.abschnitte;
    const n = liste.length + 1;      // Abschnitt n führt zu Blatt n
    const z = [];
    for (let i = 0; i < 12; i += 1) z.push(zufall.zahl());
    const A = state.blaetter[state.blaetter.length - 1];
    const besonders = n % 8 === 0 ? ((n / 8) % 2 === 1 ? "stroemung" : "hecht") : "";
    const naechsterBesonders = (n + 1) % 8 === 0;
    const k = schwere(n);
    // Die Drehung: Richtung je Blatt (die ersten fest, dann gewürfelt, nie
    // dreimal dieselbe), Tempo nach der Schwere.
    const f = drehBei(n);
    let dreh = n === 1 ? 1 : n === 2 ? -1 : z[0] < 0.5 ? 1 : -1;
    if (n > 2) {
      const a = state.blaetter[n - 1]?.dreh;
      const b = state.blaetter[n - 2]?.dreh;
      if (a === b && a === dreh) dreh = -dreh;
    }

    let B = null;
    let fenster = null;
    if (besonders === "stroemung") {
      B = stroemungBauen(n, A, z, k, f, dreh);
    } else if (besonders === "hecht") {
      B = hechtBauen(n, A, z, k, f, dreh);
    } else {
      // Zickzack: meist die andere Seite als zuletzt, manchmal dieselbe. Vor
      // einer Strömung auf die Seite, von der das Laub kommt.
      const vorSeite = Math.sign(A.x - mitteBei(A.y)) || (z[1] < 0.5 ? 1 : -1);
      let seite = n <= 2 ? (n === 1 ? 1 : -1) : z[1] < 0.72 ? -vorSeite : vorSeite;
      if (naechsterBesonders && ((n + 1) / 8) % 2 === 1) {
        state.stroemungRichtung = z[8] < 0.5 ? 1 : -1;
        seite = -state.stroemungRichtung;
      }
      let D = abstandBei(n) + (z[2] - 0.5) * 3.5;
      let r = radiusBei(n) + (z[3] - 0.5) * 1.4;
      if (naechsterBesonders) r += 1.5;
      const minMs = fensterMinBei(n);
      if (A.kreise.length > 1) D = Math.min(D, lerp(22, 26, k));
      for (let versuch = 0; versuch < 9 && !B; versuch += 1) {
        // Wie schräg: 12° bis 55° neben der Senkrechten – aber so, dass das
        // neue Blatt deutlich höher liegt als das alte.
        const dyMin = Math.max(A.ausdehnung * 0.6 + r * 0.6 + 2, 0.5 * D);
        const neig = Math.min((lerp(12, 55, z[4]) * Math.PI) / 180, Math.acos(clamp(dyMin / D, 0, 1)));
        let w = Math.PI / 2 - seite * neig;
        let x = A.x + D * Math.cos(w);
        let y = A.y + D * Math.sin(w);
        // Im Wasser bleiben: notfalls steiler.
        for (let i = 0; i < 12; i += 1) {
          const m = mitteBei(y);
          const h = halbBei(y) - r - 3;
          if (Math.abs(x - m) <= h) break;
          w = lerp(w, Math.PI / 2 + (m - A.x) * 0.002, 0.3);
          x = A.x + D * Math.cos(w);
          y = A.y + D * Math.sin(w);
        }
        const m = mitteBei(y);
        const h = halbBei(y) - r - 3;
        x = clamp(x, m - h, m + h);
        // Nie zu nah an einem älteren Blatt.
        const zuNah = state.blaetter.slice(-4).some((q) => q !== A && Math.hypot(q.x - x, q.y - y) < q.ausdehnung + r + 4);
        if (y < A.y + A.ausdehnung * 0.6 + r * 0.6 || zuNah) { D *= 0.97; r += 0.3; continue; }
        const kand = blattNeu(n, x, y, r, z[5], { dreh: 1, f });
        kand.halt = haltBei(n, f);
        state.blaetter.push(kand);
        const fen = blattFenster(A, kand, A.f);
        state.blaetter.pop();
        if (fen.ms >= minMs) { B = kand; fenster = fen; break; }
        D *= 0.95;
        r += 0.45;
      }
      if (!B) {
        // Darf nicht vorkommen (die Prüfung zählt mit) – dann eben gerade
        // darüber, gross und nah.
        state.planFehler += 1;
        B = blattNeu(n, mitteBei(A.y + 20), A.y + 20, 11, z[5], { f });
        B.halt = haltBei(n, f);
      }
    }
    B.dreh = dreh;
    B.f = f;
    if (B.art !== "teppich") B.halt = haltBei(n, f);
    if (naechsterBesonders) B.halt += besondersHalt(n + 1, f);
    // Eine Blüte auf manchen Blättern, im Teich öfter.
    B.bluete = z[6] < nachWelt(B.y, [0.32, 0.12, 0.2, 0.15, 0.25]) ? 1 + (z[7] < 0.5 ? 1 : 0) : 0;
    state.blaetter.push(B);
    liste.push({ nr: n, besonders, y: B.y, fenster: fenster ? Math.round(fenster.ms) : null });
  }

  // Wie viel länger das Blatt vor einem besonderen Abschnitt hält: Dort
  // wartet man auf Laub oder darauf, dass der Hecht vorbeizieht.
  function besondersHalt(n, f) {
    return (n / 8) % 2 === 1 ? 2.6 + 1 / f : 3.4 + 1 / f;
  }

  // Die Strömung: ein Band über A, darin Laub, darüber ein Teppich.
  function stroemungBauen(n, A, z, k, f, dreh) {
    const zahl = state.stroemungen.length;
    const r = lerp(8, 6.8, k);
    const halb = r + 3.5;
    const y = A.y + A.r + 8 + halb;
    const m = mitteBei(y);
    const hb = halbBei(y);
    const richtung = state.stroemungRichtung || (z[8] < 0.5 ? 1 : -1);
    state.stroemungRichtung = 0;
    const tempo = lerp(11, 19, k) + 2.5 * zahl;
    const abstand = lerp(25, 31, k) + 3 * z[9];
    const xa = m - richtung * (hb + 6);
    const xb = m + richtung * (hb + 2);
    const spanne = Math.abs(xb - xa);
    const s = {
      nr: zahl, y, halb, r, richtung, tempo, v: richtung * tempo, abstand, xa, xb, spanne,
      phase: z[10] * abstand, dreh: -dreh, f: f * 0.9, abschnitt: n,
    };
    state.stroemungen.push(s);
    // Der Teppich: drei bis vier Blätter quer, knapp über dem Band.
    const yc = y + halb + 6 + 7.5;
    const breite = hbAt(yc) - 7;
    const zahlK = 4;
    const kreise = [];
    for (let i = 0; i < zahlK; i += 1) {
      const u = (i / (zahlK - 1)) * 2 - 1;
      kreise.push({ x: u * breite * 0.78, y: Math.sin(i * 2.1 + z[11] * 6) * 2.2, r: lerp(9, 8, k) + (i % 2) * 1.2 });
    }
    const B = blattNeu(n, mitteBei(yc), yc, 9, z[5], { art: "teppich", kreise, f });
    B.halt = haltBei(n, f) + 0.6;
    zonenNeu(n, y);
    return B;
  }

  const hbAt = (y) => halbBei(y);

  // Die Hechtgrube: tiefes Wasser über A, ein Teppich weit darüber.
  function hechtBauen(n, A, z, k, f, dreh) {
    const zahl = state.hechte.length;
    const D = lerp(48, 57, k) + 3 * z[8];
    const yc = A.y + D;
    const cy = A.y + D * 0.5;
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
    const B = blattNeu(n, mitteBei(yc), yc, 9.5, z[5], { art: "teppich", kreise, f });
    B.halt = haltBei(n, f) + 0.6;
    zonenNeu(n, cy);
    return B;
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

  // Die Welt steht bis y – immer ein Stück über das Bild hinaus. Je Aufruf
  // höchstens «mal» Abschnitte, damit kein Bild lange wartet.
  function planBis(y, mal = 40) {
    for (let i = 0; i < mal; i += 1) {
      const letzt = state.blaetter[state.blaetter.length - 1];
      if (letzt && letzt.y > y) return;
      abschnittBauen();
    }
  }

  function weltNeu() {
    state.blaetter = [];
    state.stroemungen = [];
    state.hechte = [];
    state.abschnitte = [];
    state.zonen = [{ w: 0, y: -1e9 }];
    state.planFehler = 0;
    state.stroemungRichtung = 0;
    laubCache.clear();
    bachMerk.clear();
    state.bach = { p1: zufall.zahl() * TAU, p2: zufall.zahl() * TAU, p3: zufall.zahl() };
    state.blaetter.push(startBlatt());
    planBis(440);
  }

  // Die Welt als Text – für die Prüfung, dass in einem Turnier und beim
  // Zuschauen alle dieselbe bekommen.
  function kursText(bis = 30) {
    while (state.blaetter.length <= bis) abschnittBauen();
    const b = state.blaetter.slice(0, bis + 1).map((p) => `${p.nr}:${p.x.toFixed(1)},${p.y.toFixed(1)}/${p.r.toFixed(1)}${p.dreh > 0 ? "+" : "-"}${p.f.toFixed(2)}h${p.halt.toFixed(2)}${p.art[0]}`);
    const s = state.stroemungen.map((q) => `s${q.y.toFixed(1)}v${q.v.toFixed(1)}a${q.abstand.toFixed(1)}p${q.phase.toFixed(1)}`);
    const h = state.hechte.map((q) => `h${q.cx.toFixed(1)},${q.cy.toFixed(1)}p${q.periode.toFixed(2)}`);
    return `${b.join(" ")} | ${s.join(" ")} | ${h.join(" ")} | ${state.zonen.map((zz) => `${zz.w}@${Math.round(zz.y)}`).join(",")}`;
  }

  // ---------------------------------------------------------------------------
  // Der Autopilot
  // ---------------------------------------------------------------------------
  /*
   * Er rechnet voraus, wann ein Schlag (oder zwei) auf dem nächsten Blatt
   * landet, und schlägt in der Mitte dieses Fensters – um streu Sekunden
   * daneben, wenn er einen Menschen nachahmen soll. Gerechnet wird, sobald
   * er sitzt (und auf dem Wasser, wenn der Plan nicht mehr aufgeht), mit
   * derselben Physik wie das Spiel.
   *
   * Ziel: das nächste Blatt der Kette; in einer Strömung erst Laub, dann
   * der Teppich. Sicher heisst: landen, bevor das Blatt untergeht, bevor der
   * Fisch schnappt, nicht in den Hecht, nicht fort mit der Strömung.
   */
  function zielGut(e, L0) {
    if (e.art !== "landen") return false;
    const p = e.blatt;
    if (p.laub) {
      // Laub nur, wenn es danach noch weit genug treibt.
      const q = laubOrt(p.s, p.k, e.t);
      return !L0.sitz?.laub && q.u < 0.42;
    }
    const vorher = L0.sitz && !L0.sitz.laub ? L0.sitz.nr : state.punkte;
    return p.nr > vorher;
  }

  // Wohin er will: das nächste Blatt der Kette (null in einer Strömung, wenn
  // erst Laub kommt).
  function zielBlatt(L0) {
    const vorher = L0.sitz && !L0.sitz.laub ? L0.sitz.nr : state.punkte;
    const B = state.blaetter[vorher + 1] || null;
    if (!B) return null;
    const a = state.abschnitte[vorher];
    if (a?.besonders === "stroemung" && !(L0.sitz?.laub) && L0.y < state.stroemungen.find((s) => s.abschnitt === a.nr)?.y) return null;
    return B;
  }

  // Die Richtung zum nächsten Teil von B (und wie weit es ist).
  function richtungZu(L, B) {
    let best = null;
    for (const c of B.kreise) {
      const dx = B.x + c.x - L.x;
      const dy = B.y + c.y - L.y;
      const d = Math.hypot(dx, dy) - c.r;
      if (!best || d < best.d) best = { d, w: Math.atan2(dy, dx) };
    }
    return best;
  }

  function planen(t0) {
    hechtRand = 4;
    try { return planenGenau(t0); } finally { hechtRand = 0; }
  }

  function planenGenau(t0) {
    const L0 = state.l;
    const f = Math.abs(L0.om) / TAU || 0.6;
    const periode = 1 / f;
    const sitzt = Boolean(L0.sitz);
    const B = zielBlatt(L0);
    // Wie lange es noch geht: auf dem Blatt bis es sinkt, sonst eine
    // Umdrehung und etwas.
    let bis = t0 + periode * 1.35 + 0.2;
    if (sitzt && !L0.sitz.laub) {
      const naechst = state.abschnitte[L0.sitz.nr];
      bis = naechst?.besonders ? L0.sitz.betreten + L0.sitz.halt - 0.06 : Math.min(bis + 4, L0.sitz.betreten + L0.sitz.halt - 0.06);
    }
    const zwei = B && richtungZu(L0, B).d > 31;
    const dt = zwei ? 1 / 60 : 1 / 120;
    const tref = [];
    // Den Zustand ohne Schlag bis zu jedem Zeitpunkt fortschreiben.
    const L = kopie(L0);
    let tot = false;
    const meldeOhne = (art) => { if (art !== "landen") tot = true; };
    // Die Kraft zur Zeit t (ein Schlag braucht eine ganze).
    const kraftBei = (t) => Math.min(KRAFT_MAX, state.kraft + KRAFT_ZURUECK * (t - t0));
    for (let t = t0; t < bis && !tot; t += dt) {
      let gut = false;
      let zweiter = null;
      const r = B ? richtungZu(L, B) : null;
      const offen = kraftBei(t) >= 1 && (r ? Math.abs(winkelDiff(L.w, r.w)) < (zwei ? 1.05 : 0.8) : Math.abs(winkelDiff(L.w, Math.PI / 2)) < 1.45);
      if (offen) {
        const e = vorausrechnen(L, t, [t], t + 1.9, 1 / 120);
        gut = zielGut(e, L0) && sicherGenug(e, L0, t);
        if (!gut && zwei) {
          zweiter = zweiterSchlag(L, t, B, kraftBei(t));
          gut = zweiter !== null;
        }
      }
      tref.push({ t, gut, zweiter });
      const vorher = L.sitz;
      schritt(L, t, dt, meldeOhne);
      if (vorher && !L.sitz) tot = true;
    }
    // Das erste zusammenhängende Fenster – über die Grube lieber eines mit
    // zwei schnellen Schlägen (die Grube ist dann schneller gequert).
    const fensterVon = (passt) => {
      let a = -1;
      let b = -1;
      for (let i = 0; i < tref.length; i += 1) {
        if (passt(tref[i])) { if (a < 0) a = i; b = i; } else if (a >= 0) break;
      }
      return [a, b];
    };
    let [a, b] = zwei ? fensterVon((x) => x.gut && x.zweiter !== null && x.zweiter - x.t < 0.3) : [-1, -1];
    if (a < 0) [a, b] = fensterVon((x) => x.gut);
    if (a < 0) return null;
    const mitte = tref[Math.round((a + b) / 2)];
    return { t: mitte.t, a: tref[a].t, b: tref[b].t + dt, zweiter: mitte.zweiter ? mitte.zweiter - mitte.t : null };
  }

  // Gibt es nach einem Schlag zur Zeit t einen zweiten, mit dem er auf B
  // landet? Dann wann (die Mitte des Fensters dafür). Geprüft werden nur
  // Zeiten, zu denen er ungefähr hinschaut.
  function zweiterSchlag(L, t, B, kraft = KRAFT_MAX) {
    const L0 = state.l;
    // Nach dem ersten Schlag muss wieder eine ganze Kraft da sein.
    const dMin = Math.max(SCHLAG_PAUSE + 0.005, (1 - (kraft - 1)) / KRAFT_ZURUECK + 0.01);
    let a = -1;
    let b = -1;
    const L1 = kopie(L);
    schlag(L1, t);
    let tt = t;
    const melde = (art) => { if (art !== "landen") tt = Infinity; };
    for (let d = 0; d < 1.4 && tt < Infinity; d += 1 / 60) {
      if (d >= dMin) {
        const r = richtungZu(L1, B);
        let gut = false;
        if (Math.abs(winkelDiff(L1.w, r.w)) < 0.9) {
          const e = vorausrechnen(L1, tt, [tt], tt + 1.8, 1 / 90);
          gut = zielGut(e, L0) && sicherGenug(e, L0, t);
        }
        if (gut) { if (a < 0) a = d; b = d; } else if (a >= 0) break;
      }
      schritt(L1, tt, 1 / 60, melde);
      tt += 1 / 60;
      if (L1.sitz) break;
    }
    if (a < 0) return null;
    return t + (a + b) / 2;
  }

  // Ist er auf dem Weg vor dem Fisch sicher? Er landet, bevor der nächste
  // Fisch schnappt.
  function sicherGenug(e, L0, t) {
    const n = (L0.sitz && !L0.sitz.laub ? L0.sitz.nr : state.punkte) + 1;
    const nassBisher = L0.sitz ? 0 : L0.nass;
    const nass = nassBisher + (e.t - t);
    return nass < geduldBei(n) * (state.hechte.some((h) => h.abschnitt === n) ? 1.6 : 1) + warnungBei(n) - 0.05;
  }

  // Soll er jetzt schlagen? streu: so viele Sekunden daneben (Streuung je
  // Schlag, normalverteilt).
  function pilot({ streu = 0 } = {}) {
    if (state.phase !== "spiel" || state.schritt !== "lauf") return false;
    const L = state.l;
    const jetzt = state.t;
    let p = state.plan;
    const rausch = () => {
      if (!streu) return 0;
      const u = Math.max(1e-9, Math.random());
      return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * Math.random()) * streu;
    };
    const neuPlanen = () => {
      const fen = planen(jetzt);
      if (fen) {
        const t1 = Math.max(jetzt, fen.t + rausch());
        const zeiten = [t1];
        if (fen.zweiter !== null) zeiten.push(t1 + Math.max(SCHLAG_PAUSE + 0.005, fen.zweiter + rausch() * 0.5));
        p = { sitz: L.sitz, zeiten, geschlagen: 0, geprueft: jetzt, ende: zeiten[zeiten.length - 1] + 0.05, fenster: fen };
      } else {
        p = { sitz: L.sitz, zeiten: [], geschlagen: 0, geprueft: jetzt, ende: jetzt + 0.1, fenster: null };
      }
      state.plan = p;
    };
    const offen = p && p.geschlagen < p.zeiten.length;
    if (L.sitz) {
      if (!p || p.sitz !== L.sitz || (!offen && jetzt > p.ende)) neuPlanen();
    } else if (!offen && (!p || jetzt - p.geprueft > 0.1)) {
      // Auf dem Wasser: Trägt ihn das Gleiten ans Ziel? Sonst ein neuer Plan.
      hechtRand = 4;
      const e = vorausrechnen(L, jetzt, [], jetzt + 2.4, 1 / 120);
      hechtRand = 0;
      if (zielGut(e, L) && sicherGenug(e, L, jetzt)) {
        p = { sitz: null, zeiten: [], geschlagen: 0, geprueft: jetzt, ende: jetzt, fenster: null };
        state.plan = p;
      } else {
        neuPlanen();
      }
    }
    if (p && p.geschlagen < p.zeiten.length && jetzt >= p.zeiten[p.geschlagen] - 1e-9) {
      p.geschlagen += 1;
      return true;
    }
    return false;
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

    // Der Hinweis vor dem ersten Tipp: zwei Ringe, die aufgehen – tippen.
    const tipp = shell.el("span", "wa-tipp");
    tipp.setAttribute("aria-hidden", "true");
    const ns = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(ns, "svg");
    svg.setAttribute("viewBox", "0 0 64 64");
    ["wa-tipp-ring", "wa-tipp-ring is-spaet"].forEach((klasse) => {
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
    tippRinge.style.top = `${Math.round(Math.min(view.cssH - 50, view.ankerY + 22 * view.s + 40))}px`;
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
    for (const i of [...kacheln.keys()]) if (i < i0 - 2 || i > i1 + 6) kacheln.delete(i);
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

  // Ein Baum am Ufer, von oben: der Stamm mit Rinde, die Wurzeln greifen
  // ins Wasser.
  function stammMitWurzeln(k, x, y, seite, r, rnd, rinde) {
    for (let i = 0; i < 7; i += 1) {
      const a = (seite > 0 ? Math.PI : 0) + (rnd() - 0.5) * 2.6;
      const l = r * (1.6 + rnd() * 2.2);
      let px = x;
      let py = y;
      let w = a;
      k.strokeStyle = rgb(mix3(rinde, [0, 0, 0], 0.15));
      for (let j = 0; j < 5; j += 1) {
        const nx = px + Math.cos(w) * l / 5;
        const ny = py + Math.sin(w) * l / 5;
        k.lineWidth = r * 0.42 * (1 - j / 5.5);
        k.beginPath();
        k.moveTo(px, py);
        k.lineTo(nx, ny);
        k.stroke();
        px = nx;
        py = ny;
        w += (rnd() - 0.5) * 0.6;
      }
    }
    k.fillStyle = "rgba(10,10,10,0.3)";
    k.beginPath();
    k.arc(x + SONNE.x * 4, y + SONNE.y * 4, r * 1.05, 0, TAU);
    k.fill();
    const v = k.createRadialGradient(x - r * 0.3, y + r * 0.3, r * 0.1, x, y, r);
    v.addColorStop(0, rgb(mix3(rinde, [255, 240, 210], 0.25)));
    v.addColorStop(1, rgb(mix3(rinde, [0, 0, 0], 0.35)));
    k.fillStyle = v;
    k.beginPath();
    k.arc(x, y, r, 0, TAU);
    k.fill();
    k.strokeStyle = rgba(mix3(rinde, [0, 0, 0], 0.5), 0.6);
    k.lineWidth = 0.12;
    for (let i = 0; i < 10; i += 1) {
      const a = rnd() * TAU;
      k.beginPath();
      k.moveTo(x + Math.cos(a) * r * 0.3, y + Math.sin(a) * r * 0.3);
      k.lineTo(x + Math.cos(a) * r * 0.95, y + Math.sin(a) * r * 0.95);
      k.stroke();
    }
  }

  // Die Ufermauer am Mühlenteich: Quader mit Fugen, Moos darin.
  function mauer(k, y0, y1, seite, kc) {
    const kante = (y) => mitteBei(y) + seite * (halbBei(y) + 0.3);
    const breit = 7;
    const H = 4.2;
    for (let j = Math.floor(y0 / H) - 1; j <= Math.floor(y1 / H) + 1; j += 1) {
      const rnd = zellZufall(j, 61);
      const ya = j * H;
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
  const ZWEIG_ZELLE = 34;

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
   * Im Spiel wird je Bild eines davon als Muster über das Wasser gelegt,
   * aufgehellt – im Flachen kräftig, in der Tiefe schwach.
   */
  const KAUSTIK_N = 16;
  const KAUSTIK_CM = 22;
  const KAUSTIK_G = 6;
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
      kaustik = { S: view.S, px: Math.max(32, Math.round(KAUSTIK_CM * view.S)), bilder: [], muster: [], punkte };
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

  // Der Weg des Wassers im Bild: eine Fläche zwischen u0 und u1 (Anteile
  // der halben Breite, −1 links, 1 rechts), von yu bis yo, in Bildpunkten.
  function wasserBand(u0, u1, yu, yo) {
    const S = view.S;
    g.beginPath();
    for (let y = yu; y <= yo + 3.9; y += 4) {
      const { m, h } = bachBild(y);
      g.lineTo(view.mxp + (m + u0 * h) * S - view.cxp, view.myp - y * S + view.cyp);
    }
    for (let y = yo + 4; y >= yu - 0.1; y -= 4) {
      const { m, h } = bachBild(y);
      g.lineTo(view.mxp + (m + u1 * h) * S - view.cxp, view.myp - y * S + view.cyp);
    }
    g.closePath();
  }

  function sichtY() {
    const s = view.s;
    return { yu: state.camY - (view.cssH - view.ankerY) / s - 4, yo: state.camY + view.ankerY / s + 4 };
  }

  function zeichneKaustik() {
    if (!kaustik || kaustik.bilder.length < KAUSTIK_N) return;
    const { yu, yo } = sichtY();
    const yMitte = state.camY;
    let kraft = zahlBei(yMitte, "kaustik");
    // In der Hechtgrube kommt kaum Licht auf den Grund.
    for (const hg of state.hechte) kraft *= 1 - 0.75 * glatt(1 - Math.abs(yMitte - hg.cy) / (hg.ry + 40));
    if (kraft < 0.02) return;
    const i = Math.floor(state.zeit * 11) % KAUSTIK_N;
    const bild = kaustik.bilder[i];
    const T = bild.width;
    const S = view.S;
    // Wo die Kachel des Musters beginnt (an der Welt fest, langsam treibend),
    // auf ganzen Bildpunkten.
    const ox = Math.round(view.mxp - view.cxp + state.zeit * 0.7 * S);
    const oy = Math.round(view.myp + view.cyp + state.zeit * 0.4 * S);
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalCompositeOperation = "lighter";
    // In waagrechten Streifen, Stück für Stück aufgelegt, Punkt auf Punkt:
    // im Flachen am Ufer (in der tiefen Mitte fällt kaum Licht auf den
    // Grund).
    const ZEILE = Math.max(8, Math.round(2.2 * S));
    const H = Math.round(view.cssH * view.dpr);
    const BAENDER = [[-0.97, -0.56], [0.56, 0.97]];
    g.globalAlpha = Math.min(1, kraft);
    for (let py = 0; py < H; py += ZEILE) {
      const y = (view.myp + view.cyp - (py + ZEILE / 2)) / S;
      const { m, h } = bachBild(y);
      const sy = ((((py - oy) % T) + T) % T);
      const hoch = Math.min(ZEILE, H - py, T - sy);
      BAENDER.forEach(([u0, u1]) => {
        let xa = Math.round(view.mxp + (m + u0 * h) * S - view.cxp);
        const xb = Math.round(view.mxp + (m + u1 * h) * S - view.cxp);
        while (xa < xb) {
          const sx = ((((xa - ox) % T) + T) % T);
          const breit = Math.min(xb - xa, T - sx);
          g.drawImage(bild, sx, sy, breit, hoch, xa, py, breit, hoch);
          if (hoch < ZEILE && hoch < H - py) g.drawImage(bild, sx, 0, breit, Math.min(ZEILE - hoch, H - py - hoch), xa, py + hoch, breit, Math.min(ZEILE - hoch, H - py - hoch));
          xa += breit;
        }
      });
    }
    g.globalAlpha = 1;
    g.globalCompositeOperation = "source-over";
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
    p.bild = { ...bild, S: view.S };
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
    sprites.set(key, bild);
    return bild;
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

  function zeichneTreibendes() {
    const { yu, yo } = sichtY();
    const d = state.drift;
    const n0 = Math.floor((yu + d) / TREIB_ABSTAND) - 1;
    const n1 = Math.floor((yo + d) / TREIB_ABSTAND) + 1;
    for (let n = n0; n <= n1; n += 1) {
      const rnd = zellZufall(n, 91);
      const y = n * TREIB_ABSTAND - d + rnd() * TREIB_ABSTAND;
      if (state.stroemungen.some((s) => Math.abs(y - s.y) < s.halb + 3)) continue;
      const w = weltBei(y);
      const { m, h } = bachBild(y);
      const u = rnd() * 2 - 1;
      const x = m + u * h * 0.9 + Math.sin(state.zeit * 0.3 + n) * 0.4;
      const r = rnd();
      const v = Math.floor(rnd() * 4);
      let art = null;
      if (w === 0) art = r < 0.45 ? "linsen" : r < 0.7 ? "bluete" : null;
      else if (w === 1) art = r < 0.4 ? "laub" : null;
      else if (w === 2) art = r < 0.3 ? "linsen" : r < 0.42 ? "feder" : r < 0.55 ? "laub" : null;
      else if (w === 3) art = r < 0.35 ? "flocke" : r < 0.55 ? "linsen" : null;
      else art = r < 0.3 ? "staub" : null;
      if (!art) continue;
      const b = treibBild(art, v);
      const sx = bildX(x);
      const sy = bildY(y);
      if (sy < -20 || sy > view.cssH + 20) continue;
      if (art === "linsen" || art === "staub") bildLegen(b, sx, sy, 0.95);
      else bildDrehen(b, sx, sy, rnd() * TAU + state.zeit * 0.1 * (v - 1.5), 0.95);
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

  function beinPunkte(bein, seite, sw) {
    const pts = [bein.hueft, bein.knie, bein.fuss].map(([x, y]) => [x, y * seite]);
    if (bein.mitte && sw) {
      const [hx, hy] = pts[0];
      const a = sw * seite;
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
  function laeuferMalen(x, y, w, { geist = null, alpha = 1, sitzt = false, gross = 1 } = {}) {
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
      BEINE.forEach((b) => [-1, 1].forEach((seite) => {
        const p = beinPunkte(b, seite, sw);
        g.beginPath();
        g.moveTo(p[0][0], p[0][1]);
        g.lineTo(p[1][0], p[1][1]);
        g.lineTo(p[2][0], p[2][1]);
        g.stroke();
      }));
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
    BEINE.forEach((b) => [-1, 1].forEach((seite) => {
      const p = beinPunkte(b, seite, sw);
      g.lineWidth = linie * (b.mitte ? 1.15 : 1);
      g.beginPath();
      g.moveTo(p[0][0], p[0][1]);
      g.lineTo(p[1][0], p[1][1]);
      g.lineTo(p[2][0], p[2][1]);
      g.stroke();
    }));
    // Die Dellen auf dem Wasser: ein heller Ring um jeden Fuss.
    if (!sitzt && !geist) {
      BEINE.forEach((b) => [-1, 1].forEach((seite) => {
        const p = beinPunkte(b, seite, sw);
        const [fxx, fyy] = p[2];
        g.strokeStyle = "rgba(255,255,255,0.6)";
        g.lineWidth = linie * 0.9;
        g.beginPath();
        g.arc(fxx, fyy, b.delle * 0.55, 0, TAU);
        g.stroke();
        g.fillStyle = "rgba(0,20,20,0.35)";
        g.beginPath();
        g.arc(fxx, fyy, b.delle * 0.3, 0, TAU);
        g.fill();
      }));
    }
    // Der Leib.
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

  // Die Blicklinie: ein paar helle Punkte in die Richtung, in die er schaut
  // – so liest sich die Drehung auch, wenn er klein ist.
  function zeichneBlick(L) {
    const x = bildX(L.x);
    const y = bildY(L.y);
    const fx = Math.cos(L.w);
    const fy = -Math.sin(L.w);
    const s = view.s;
    for (let i = 0; i < 4; i += 1) {
      const d = (3.6 + i * 1.5) * s;
      g.fillStyle = `rgba(255,255,255,${0.55 - i * 0.12})`;
      g.beginPath();
      g.arc(x + fx * d, y + fy * d, Math.max(1, 0.16 * s), 0, TAU);
      g.fill();
    }
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
      schein("weiss", sx, sy, 3.2 * view.s, 0.25 * o.blass);
      laeuferMalen(sx, sy, w, { geist: o.farbe, alpha: 0.5 * o.blass });
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
      if (p.y - p.ausdehnung > yo + 14) break;
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
  // in die Kacheln gemalt. Geht ein Blatt unter, liegt es danach als
  // dunkler Schemen im Wasser über seinem Schatten.
  function blattSchattenMalen(k, kc) {
    const liste = state.blaetter;
    for (let i = blattAb(kc.ya - 20); i < liste.length; i += 1) {
      const p = liste[i];
      if (p.y - p.ausdehnung > kc.yb + 20) break;
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
    const ziel = state.blaetter[(L.sitz && !L.sitz.laub ? L.sitz.nr : state.punkte) + 1];
    sichtbareBlaetter((p) => {
      const weg = versunken(p, state.t) ? clamp((state.t - p.betreten - p.halt) / 0.9, 0, 1) : 0;
      const b = blattBild(p);
      if (weg >= 1) {
        // Versunken: Es liegt auf dem Grund, auf seinem Schatten, vom Wasser
        // überdeckt.
        const sv = schattenVersatz(p.x, p.y);
        bildLegen(b, bildX(p.x + sv.x), bildY(p.y + sv.y), 0.32 * (1 - sv.d * 0.4));
        return;
      }
      const sink = sinktBei(p, state.t);
      const x = bildX(p.x);
      const y = bildY(p.y) + blattWippen(p) * view.s;
      bildLegen(b, x, y, (1 - weg) * (1 - sink * 0.25));
      // Es läuft voll: Wasser kriecht vom Rand her darüber, und es wird dunkel.
      if (sink > 0 || weg > 0) {
        const k = Math.max(sink, 1);
        const wasser = farbeBei(p.y, "wasser");
        p.kreise.forEach((c) => {
          const cx = bildX(p.x + c.x);
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
              const a = hash01(p.nr * 7 + i) * TAU + state.zeit * 0.7;
              const ph = (state.zeit * 1.6 + hash01(i * 3.1 + p.nr)) % 1;
              g.strokeStyle = `rgba(255,255,255,${0.5 * (1 - ph) * sink})`;
              g.beginPath();
              g.arc(cx + Math.cos(a) * r * 1.02, cy + Math.sin(a) * r * 1.02, 0.5 + ph * 1.6, 0, TAU);
              g.stroke();
            }
          }
        });
      }
      // Das nächste Blatt zeigt, wie herum er sich darauf drehen wird: zwei
      // Pfeile auf einem Kreis, die sich langsam in diese Richtung drehen.
      if (p === ziel && state.schritt !== "tot" && state.phase !== "ende") zeichneDrehPfeil(p);
    });
  }

  function zeichneDrehPfeil(p) {
    const c = p.kreise.reduce((a, b) => (b.r > a.r ? b : a), p.kreise[0]);
    const cx = bildX(p.x + c.x);
    const cy = bildY(p.y + c.y);
    const r = c.r * view.s * 0.62;
    const w0 = -p.dreh * state.zeit * TAU * p.f * 0.3;
    g.lineCap = "round";
    g.strokeStyle = "rgba(255,255,255,0.62)";
    g.fillStyle = "rgba(255,255,255,0.62)";
    g.lineWidth = Math.max(1.5, 0.28 * view.s);
    for (let i = 0; i < 2; i += 1) {
      const a0 = w0 + i * Math.PI;
      const a1 = a0 - p.dreh * 1.6;
      g.beginPath();
      g.arc(cx, cy, r, Math.min(a0, a1), Math.max(a0, a1));
      g.stroke();
      // Die Spitze am Ende in Drehrichtung.
      const ax = cx + Math.cos(a1) * r;
      const ay = cy + Math.sin(a1) * r;
      const t = a1 - p.dreh * Math.PI / 2;
      const tx = Math.cos(t + Math.PI);
      const ty = Math.sin(t + Math.PI);
      const sp = Math.max(4, 0.9 * view.s);
      g.beginPath();
      g.moveTo(ax - tx * sp * 0.2, ay - ty * sp * 0.2);
      g.lineTo(ax + tx * sp + Math.cos(a1) * sp * 0.55, ay + ty * sp + Math.sin(a1) * sp * 0.55);
      g.lineTo(ax + tx * sp - Math.cos(a1) * sp * 0.55, ay + ty * sp - Math.sin(a1) * sp * 0.55);
      g.closePath();
      g.fill();
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
      bildDrehen(fischBild(true, 2, true), bildX(o.x + sv.x * 0.6), bildY(o.y + sv.y * 0.6), o.w, 0.5);
    });
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
    sichtbareHechte((hg, o) => {
      const x = bildX(o.x);
      const y = bildY(o.y);
      bildDrehen(fischBild(true, 1, false), x, y, o.w, 0.55);
      bildDrehen(fischBild(true, 0, false), x, y, o.w, 0.6);
    });
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

  function glitzerBild() {
    const key = `glitzer:${view.dpr}`;
    if (sprites.has(key)) return sprites.get(key);
    const n = Math.round(22 * view.dpr);
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
    const b = glitzerBild();
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
        const f = 0.5 + nah * 0.7;
        const n = Math.round(b.c.width * f);
        g.drawImage(b.c, Math.round(sx * view.dpr - n / 2), Math.round(sy * view.dpr - n / 2), n, n);
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

  function libelleMalen(x, y, w, farbe, gross) {
    const s = gross;
    g.save();
    g.translate(x, y);
    g.rotate(w);
    // Die Flügel: vier, durchsichtig, schimmernd.
    const schwirr = 0.6 + 0.4 * Math.sin(state.zeit * 90);
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
      for (let i = 0; i < 26; i += 1) {
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
      libelleMalen(o.x, o.y, o.w, farben[(w + id) % farben.length], gross);
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
      text(`${state.punkte} ${state.punkte === 1 ? "Blatt" : "Blätter"}`, W / 2, y + 30, 15, "#f6f2e8", k, 700);
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
    ebenen = { s: view.s, dpr: view.dpr };
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
    const wipp = L.sitz && !L.sitz.laub ? blattWippen(L.sitz) * view.s : 0;
    if (state.phase !== "zuschauen") zeichneBlick(L);
    laeuferMalen(bildX(L.x), bildY(L.y) + wipp, L.w, { sitzt: Boolean(L.sitz) });
  }

  function zeichnen() {
    if (!g || !view.S) return;
    kaustikVorbereiten(state.phase === "bereit" ? 6 : 2.5);
    view.cxp = Math.round(state.camX * view.S);
    view.cyp = Math.round(state.camY * view.S);
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalAlpha = 1;
    g.globalCompositeOperation = "source-over";
    const [i0, i1] = kachelBereich(view.cyp);
    const X = view.mxp - view.kHalbPx - view.cxp;
    for (let i = i0; i <= i1; i += 1) {
      const kc = kachelHolen(i);
      kachelFertig(kc);
      g.drawImage(kc.c, X, view.myp - (i + 1) * KACHEL_PX + view.cyp);
    }
    // Für Messungen lässt sich jeder Teil abschalten (window.__sbAus, eine
    // Liste von Namen) – im Spiel steht dort nichts.
    const aus = String(window.__sbAus || "");
    const teil = (name, fn) => { if (!aus || !aus.includes(name)) fn(); };
    teil("kaustik", zeichneKaustik);
    g.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
    teil("schatten", () => {
      zeichneLaubSchatten();
      zeichneFischSchatten();
      if (state.l && !state.tot) zeichneDellenSchatten(state.l);
    });
    teil("fische", zeichneFische);
    teil("nacht", zeichneNachtSpiegel);
    teil("stroemung", zeichneStroemungen);
    teil("treib", zeichneTreibendes);
    teil("glitzer", zeichneGlitzer);
    teil("blaetter", zeichneBlaetter);
    teil("laub", zeichneLaub);
    teil("ringe", zeichneRinge);
    teil("geister", zeichneGeister);
    teil("laeufer", zeichneLaeufer);
    teil("spritzer", zeichneSpritzer);
    teil("vorn", zeichneVordergrund);
    teil("insekten", zeichneInsekten);
    teil("texte", zeichneTexte);
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
  function rudern() {
    const L = state.l;
    schlag(L, state.t);
    state.schlaege += 1;
    state.letzterSchlag = state.t;
    state.stossBild = 1;
    klang()?.ton?.("wasserlaeufer.ruder", { laut: 0.55 });
    kids()?.vibrate?.(5);
    // Die Ringe der Mittelbeine.
    const w = L.w;
    const qx = Math.cos(w + Math.PI / 2);
    const qy = Math.sin(w + Math.PI / 2);
    ring(L.x + qx * 3.2 - Math.cos(w) * 1, L.y + qy * 3.2 - Math.sin(w) * 1, 0.6, 16, 0.7, 0.9);
    ring(L.x - qx * 3.2 - Math.cos(w) * 1, L.y - qy * 3.2 - Math.sin(w) * 1, 0.6, 16, 0.7, 0.9);
  }

  function gelandet(p) {
    const L = state.l;
    klang()?.ton?.("wasserlaeufer.landen", { laut: 0.5 });
    ring(L.x, L.y, 1, 10, 0.45, 0.5);
    if (!p.laub) {
      if (p.betreten === null) p.betreten = state.t;
      p.wippen = state.t;
      if (p.nr > state.punkte) {
        state.punkte = p.nr;
        shell.setCount(state.punkte);
      }
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
    const n = (L.sitz && !L.sitz.laub ? L.sitz.nr : state.punkte) + 1;
    const imHecht = state.hechte.some((hg) => hg.abschnitt === n);
    const geduld = geduldBei(n) * (imHecht ? 1.6 : 1);
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
        if (nah && !L.sitz && !blattBei(L.x, L.y, state.t, null) && !nurBild) {
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

  // Der Tipp – zu der Zeit, zu der er geschah (jetzt, wie performance.now).
  function tippen(jetzt) {
    if (state.phase === "zuschauen" || state.phase === "ende") return;
    if (state.phase === "bereit") {
      losGehts();
    }
    if (state.phase !== "spiel" || state.schritt === "tot") return;
    if (Number.isFinite(jetzt) && last) {
      const mehr = clamp((jetzt - last) / 1000 - voraus, 0, 0.05);
      if (mehr > 0) {
        physik(mehr);
        voraus += mehr;
      }
      if (state.schritt === "tot") return;
    }
    if (state.t - state.letzterSchlag < SCHLAG_PAUSE || state.kraft < 1) return;
    state.kraft -= 1;
    rudern();
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
  // in Vierteln, c: die Schläge mal 1000 und die Blickrichtung in
  // Hundertsteln; am Schluss negativ, woran es endete).
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
        const zahl = Math.floor(c / 1000);
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
  // Eine neue Welt bekommt ihren Namen; ein besonderer Abschnitt wird
  // angesagt, sobald er auf dem Blatt davor sitzt.
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
    const naechster = state.abschnitte[nr];
    if (naechster?.besonders === "stroemung") {
      ansage("Strömung voraus", "Ein Seitenbach reisst quer – reite das Laub hinüber", "#cfeaff", 2.8);
      klang()?.ton?.("wasserlaeufer.ansage", { laut: 0.7 });
    } else if (naechster?.besonders === "hecht") {
      ansage("Hechtgrube voraus", "Zu weit für einen Schlag – und der Hecht kreist", "#ffd2a8", 2.8);
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
    } else if (state.phase === "bereit") {
      // Er dreht sich schon, bevor es losgeht.
      L.w += L.om * dt;
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
    planBis(state.camY + SICHT_OBEN + 280, 1);

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

    if (state.phase === "spiel" && state.schritt !== "tot") {
      const c = state.schlaege * 1000 + Math.round((((L.w % TAU) + TAU) % TAU) * 100);
      gegner?.takt(state.punkte, { a: Math.round(L.x * 4), b: Math.round(L.y * 4), c });
    }
  }

  function loop(now) {
    frame = window.requestAnimationFrame(loop);
    const dt = clamp((now - last) / 1000, 0, 0.05);
    last = Math.max(last, now);
    const strecke = Math.max(0, dt - voraus);
    voraus = 0;
    messen();
    takt(dt, strecke);
    zeichnen();
  }

  // Die Runde beginnt: mit dem ersten Tipp – oder im Live-Modus zum
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
    weltNeu();
    const p0 = state.blaetter[0];
    state.l = { x: p0.x, y: p0.y, vx: 0, vy: 0, w: Math.PI * 0.15, om: p0.dreh * TAU * p0.f, sitz: p0, von: null, nass: 0, ox: 0, oy: 0, mx: 0, my: 0 };
    state.camX = mitteBei(25);
    state.camY = 0;
    voraus = 0;
    shell.setCount(0);
    gegner?.runde();

    state.intro = ersterStart && !zuschauer && !shell.live && !ruhig() ? { t: 0, dauer: 3.2 } : null;
    ersterStart = false;
    host.dataset.intro = state.intro ? "an" : "aus";

    shell.clear();
    const prompt = shell.el("p", "cm-prompt wa-prompt", "Er dreht sich – tippe, wenn er zum nächsten Blatt schaut.");
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
    const zeit = `${Math.max(0, Math.round(state.t))} s`;
    shell.showResult({
      label: "Deine Blätter",
      points: punkte,
      detail: rekord ? "Neuer Rekord!" : `${warum ? `${warum} · ` : ""}${zeit}`,
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
    host, spiel: "pondSkater", fassung: FASSUNG, zufall, einheit: "Blätter", nochmal: zuschauenStarten,
  }) || null;
  if (!zuschauer) {
    gegner = window.LernappGeist?.fuer?.({ spiel: "pondSkater", host, art: "tempo", alle: true, zufall }) || null;
  }

  startRun();
  zuschauer?.laden.then((da) => { if (da) zuschauenStarten(); });

  // Ein Tipp irgendwo aufs Bild: ein Ruderschlag. Nur Knöpfe bleiben Knöpfe.
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
  window.LernappWasserlaeufer = {
    J, TAU_W, MU_W, TAU_B, MU_B, R_SCHNAPP, R_HECHT, FASSUNG, state, view,
    takt, tippen, losGehts, physik, planBis, kursText, pilot, planen, blattFenster, blattBei, hechtOrt, laubOrt,
    schwere, drehBei, abstandBei, radiusBei, haltBei, geduldBei, warnungBei, fischVBei, fensterMinBei, mitteBei, halbBei, weltBei,
    bildX, bildY,
    // Was eine Kachel je Stufe kostet (ms), und was die Bilder kosten.
    // Zeit je Bild (ms), n Bilder hintereinander; aus: Teile, die wegfallen.
    messeBild: (n = 40, aus = "") => {
      const vorher = window.__sbAus;
      window.__sbAus = aus;
      zeichnen();
      g.getImageData(0, 0, 1, 1);
      const a = performance.now();
      for (let i = 0; i < n; i += 1) { state.zeit += 1 / 60; zeichnen(); g.getImageData(0, 0, 1, 1); }
      window.__sbAus = vorher;
      return (performance.now() - a) / n;
    },
    // Was das Bauen eines Abschnitts kostet (ms je Abschnitt).
    messeBau: (n = 20) => { const a = performance.now(); for (let i = 0; i < n; i += 1) abschnittBauen(); return (performance.now() - a) / n; },
    messeTakt: (n = 60) => { const a = performance.now(); for (let i = 0; i < n; i += 1) { if (pilot()) tippen(); takt(1 / 60); } return (performance.now() - a) / n; },
    messeKachel: (i) => { const kc = kachelNeu(i); return KACHEL_STUFEN.map((f) => { const a = performance.now(); f(kc.k, kc); return Math.round((performance.now() - a) * 10) / 10; }); },
    messeBilder: () => { const raus = {}; const a = performance.now(); zweigeBei(state.camY - 50, state.camY + 150).forEach((z) => { const b = performance.now(); sprites.delete(`zweig:${z.j}:${view.S}`); zweigBild(z); raus[`zweig ${z.art}`] = Math.round((performance.now() - b) * 10) / 10; }); const b = performance.now(); state.blaetter.slice(0, 10).forEach((p) => { p.bild = null; blattBild(p); }); raus.blaetter10 = Math.round((performance.now() - b) * 10) / 10; raus.gesamt = Math.round((performance.now() - a) * 10) / 10; return raus; },
    vorausTest: (L, t0, schlaege, bis) => { const e = vorausrechnen(L, t0, schlaege, bis, 1 / 240); return { art: e.art, nr: e.blatt?.nr ?? (e.blatt?.laub ? "laub" : null), t: +e.t.toFixed(2), x: +e.L.x.toFixed(1), y: +e.L.y.toFixed(1) }; },
  };
})();
