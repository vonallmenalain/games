/*
 * stampfwerk.js – Stampfwerk.
 * ---------------------------------------------------------------------------
 * Eine alte Hammerschmiede bei Nacht. An einer langen Welle hängen schwere
 * Hämmer und stampfen im Takt; darunter muss eine Maus durch. Eine Regel:
 * Halten heisst laufen, loslassen heisst stehen.
 *
 * Die Kunst liegt im Wann. Ein Hammer ist offen, solange sein Kopf über der
 * Maus hängt – er hebt sich langsam, zittert kurz und fällt dann. Wer unter
 * ihm ist, wenn er unten ankommt, oder in ihn hineinläuft, hat verloren.
 * Von hinten kommt der Dampf: Warten kostet, und wen er einholt, der hat
 * ebenfalls verloren. Der erste Fehler beendet die Runde.
 *
 * Gezählt werden die Hämmer, unter denen sie durch ist. Schwerer wird es mit
 * der Strecke: Die Hämmer bleiben kürzer offen, sie stehen enger, zu zweit
 * und zu dritt nebeneinander mit versetztem Takt, und der Dampf wird
 * schneller. «Perfekt» ist, wer im ersten Moment hineinläuft, in dem der
 * Hammer offen ist; «haarscharf», wer im letzten hinaus ist.
 *
 * Der Takt jedes Hammers hängt allein an der Spielzeit seit dem Start (uhr):
 * nicht an der Bildrate, nicht am Zufall während der Runde. Vor dem Start
 * steht das Werk still; mit dem ersten Druck läuft es an.
 *
 * Gebaut wird die Strecke aus dem Zufall (zufall.js): ohne Turnier jedes Mal
 * eine andere, im Turnier für alle im selben Versuch dieselbe. Sie ist immer
 * zu schaffen, weil zuerst ein Weg entsteht und dann die Takte um ihn herum
 * (naechsteEinheit): wo sie steht, wann sie losläuft. Jeder Hammer ist dann
 * offen, wenn dieser Weg unter ihm durchführt – und davor und danach noch um
 * die Luft, die der Strecke nach bleibt. Der Weg ist immer schneller als der
 * Dampf.
 *
 * Drücken und Loslassen gelten zu ihrer Zeit, nicht erst im nächsten Bild
 * (nachholen, voraus).
 *
 * Das Bild: die Schmiede von der Seite. Hinten die Mauer mit dem Bogenfenster
 * und dem Mond, die glühende Esse, das Wasserrad und die Zahnräder; vorn die
 * Welle mit den Nocken, die Hämmer und unter dem Boden die Glut. Mauer und
 * Boden werden einmal gemalt und dann nur noch aufgelegt (wandBild,
 * bodenBild) – auf dem iPhone rechnet der Prozessor jede gemalte Fläche,
 * jedes Bild.
 *
 * Die Gegner (geist.js) laufen als Mäuse aus Licht mit, und die besten Läufe
 * lassen sich anschauen (?zuschauen=): Aufgezeichnet wird neben dem Ort der
 * Maus auch die Spielzeit, damit die Hämmer genau so stampfen wie im Lauf.
 *
 * x zählt die Strecke entlang, y nach oben; der Boden liegt bei 0.
 */
(() => {
  "use strict";

  if (document.body.dataset.page !== "stampmill") return;

  const host = document.querySelector("#sm-stage");
  const shellApi = window.LernappGameShell;
  const cloudApi = window.LernappGameCloud;
  if (!host || !shellApi) return;

  const kids = () => window.LernappKids || null;
  const klang = () => window.ArcadeKlang || null;
  const ruhig = () => Boolean(kids()?.prefersReducedMotion?.());

  // Der Zufall. Nur die Strecke zieht daraus – wo die Hämmer stehen und wie
  // sie schlagen. Funken, Staub und Glut hängen an Math.random oder an
  // festen Zahlen.
  const zufall = window.LernappZufall?.fuer?.("stampMill") || {
    neu() {},
    zahl: () => Math.random(),
  };

  // ---------------------------------------------------------------------------
  // Die Regeln
  // ---------------------------------------------------------------------------
  const TEMPO = 120;               // so schnell läuft die Maus (Einheiten je Sekunde)
  const KOPF = 12;                 // halbe Breite eines Hammerkopfs
  const MAUS = 7;                  // halbe Breite der Maus – so viel von ihr zählt: der Leib, nicht Nasenspitze und Schwanz
  const MAUS_MITTE = 3.5;          // so weit liegt die Mitte ihres Leibs hinter dem Punkt, um den sie gemalt wird
  const ZONE = KOPF + MAUS;        // so weit vor und hinter der Mitte trifft der Hammer
  const QUER = (2 * ZONE) / TEMPO; // so lange braucht sie unter einem Hammer durch
  const HOCH = 46;                 // so hoch hebt die Nocke den Kopf
  const MAUS_H = 15;               // so hoch ist die Maus
  const KOPF_H = 22;               // so hoch ist der Kopf selbst
  const STIEL = 96;                // so lang ist der Stiel über dem Kopf
  // Der Fall: so lange vom höchsten Punkt bis auf den Boden. Der Hammer ist
  // zu, sobald der Kopf die Höhe der Maus erreicht – F0 nach dem Loslassen.
  const FALL = 0.09;
  const F0 = FALL * Math.sqrt(1 - MAUS_H / HOCH);
  const F1 = FALL - F0;
  const HEBEN = 0.3;               // so lange hebt die Nocke ihn höchstens
  const ZITTERN = 0.3;             // so lange zittert er höchstens vor dem Schlag
  const START_X = 0;
  const ERSTER = 80;               // dort steht der erste Hammer
  const STAND = 3;                 // so weit vor einem Hammer hält der geplante Weg
  // Die Luft: so viel früher oder später als geplant darf sie loslaufen. Das
  // Fenster für den Start ist zweimal die Luft (plus etwas Spiel): am Anfang
  // gut 300 ms, später nur noch gut 100.
  const LUFT0 = 0.17;
  const LUFT1 = 0.056;
  const LUFT_WEG = 12;             // nach so vielen Hämmern ist die Hälfte des Wegs dahin gegangen
  const SPIEL0 = 0.1;
  const SPIEL1 = 0.03;
  // Der Dampf: wie schnell er kommt, und wie weit er höchstens zurückbleibt.
  const DAMPF0 = 40;
  const DAMPF1 = 64;
  const DAMPF_WEG = 28;
  const RAUM0 = 150;
  const RAUM1 = 96;
  const DAMPF_START = 118;         // so weit hinter ihr beginnt er
  const VORSPRUNG = 1.2;           // um so viel ist der geplante Weg schneller als der Dampf
  const WARTE_MAX = 0.85;          // länger wartet der geplante Weg nie
  const PERFEKT = 0.075;           // so kurz nach dem Öffnen hinein: «perfekt»
  const KNAPP = 0.06;              // so kurz vor dem Schlag hinaus: «haarscharf»
  const ANLAUF = 0.4;              // so lange braucht das Werk, bis es im Takt ist
  const TAKT = 1 / 240;
  const ENDE_MS = 1150;

  const TOP_COUNT = 5;
  const store = cloudApi
    ? cloudApi.register({ key: "lernapp.stampfwerk", empty: { runs: 0, scores: [] }, merge: cloudApi.mergeScores(TOP_COUNT) })
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
  const mod = (a, n) => ((a % n) + n) % n;
  // Nach dem wievielten Hammer – ohne Exponent und Sinus, damit die Strecke
  // auf jedem Gerät bis auf die letzte Stelle dieselbe ist.
  const anteil = (n, weg) => n / (n + weg);
  const luftBei = (n) => lerp(LUFT0, LUFT1, anteil(n, LUFT_WEG));
  const spielBei = (n) => lerp(SPIEL0, SPIEL1, anteil(n, LUFT_WEG));
  const dampfBei = (n) => lerp(DAMPF0, DAMPF1, anteil(n, DAMPF_WEG));
  const raumBei = (n) => lerp(RAUM0, RAUM1, anteil(n, DAMPF_WEG));

  function hash01(n) {
    const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return x - Math.floor(x);
  }

  // ---------------------------------------------------------------------------
  // Zustand
  // ---------------------------------------------------------------------------
  // phase:   "bereit" (noch nichts gedrückt), "spiel", "zuschauen", "ende"
  // schritt: "lauf" (sie lebt), "aus" (getroffen oder eingeholt)
  const state = {
    phase: "bereit",
    schritt: "lauf",
    punkte: 0,
    perfekte: 0,
    knappe: 0,
    uhr: 0,                 // die Spielzeit seit dem Start – an ihr hängen die Hämmer
    halten: false,
    maus: { x: START_X, lief: 0, schritt: 0, stauch: 0 },
    dampf: START_X - DAMPF_START,
    haemmer: [],
    plan: [],
    naechster: 0,           // der erste Hammer, unter dem sie noch nicht durch ist
    aus: null,
    teile: [],
    schriften: [],
    zeit: 0,                // die Zeit des Bildes (Feuer, Rad, Staub)
    rad: 0,                 // wie weit sich Wasserrad und Welle gedreht haben
    camX: 0,
    stoss: 0,
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
  let werkKlang = null;
  let dampfKlang = null;
  let trippeln = null;
  const finger = new Set();

  const view = { s: 1, dpr: 1, f: 1, cssW: 0, cssH: 0, w: 220, bodenY: 0, bodenU: 200, untenU: 60, frei: 0, vorn: 0.2 };

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
    werkKlang = klang()?.kulisse("stampfwerk.werk") || null;
    werkKlang?.setze(0.4);
    werkKlang?.laut(0.45);
    dampfKlang = klang()?.kulisse("stampfwerk.dampf", { laut: 0 }) || null;
    trippeln = klang()?.kulisse("stampfwerk.trippeln", { laut: 0 }) || null;
    trippeln?.setze(0.9);
  }

  function klangStellen() {
    const nah = clamp(1 - (state.maus.x - state.dampf) / 110, 0, 1);
    dampfKlang?.setze(0.3 + 0.6 * nah);
    dampfKlang?.laut(nah * nah * 0.9);
    trippeln?.laut(state.maus.lief > 0.5 && state.schritt === "lauf" ? 0.5 : 0);
  }

  function klangAus() {
    werkKlang?.stop();
    dampfKlang?.stop();
    trippeln?.stop();
    werkKlang = null;
    dampfKlang = null;
    trippeln = null;
  }

  // ---------------------------------------------------------------------------
  // Die Hämmer
  // ---------------------------------------------------------------------------
  /*
   * Ein Hammer schlägt immer gleich, im Takt T. q zählt die Zeit seit dem
   * Öffnen:
   *
   *   0 … offen     offen: Der Kopf hängt über der Maus. Erst hebt ihn die
   *                 Nocke weiter bis ganz oben, dort zittert er, F0 vor dem
   *                 Ende lässt sie ihn los.
   *   offen … T     zu: Der Kopf ist tiefer als die Maus – er fällt die
   *                 letzten F1, liegt unten und wird wieder gehoben.
   *
   * Was das Bild zeigt (hoeheBei) und was zählt (offenBei), ist dasselbe.
   */
  const phaseBei = (h, t) => mod(t - h.off, h.T);
  const offenBei = (h, t) => phaseBei(h, t) < h.offen;

  function hoeheBei(h, t) {
    const q = phaseBei(h, t);
    if (q < h.r2) return MAUS_H + (HOCH - MAUS_H) * (q / h.r2);
    const los = h.offen - F0;
    if (q < los) return HOCH;
    if (q < h.offen + F1) {
      const u = (q - los) / FALL;
      return HOCH * (1 - u * u);
    }
    if (q < h.T - h.r1) return 0;
    return MAUS_H * ((q - (h.T - h.r1)) / h.r1);
  }

  // Zittert er gerade? 0 … 1 – kurz bevor die Nocke ihn loslässt.
  function zitternBei(h, t) {
    const q = phaseBei(h, t);
    const los = h.offen - F0;
    if (q >= los || q < los - h.warnt) return 0;
    return 1 - (los - q) / h.warnt;
  }

  /*
   * Zuerst der Weg, dann die Takte. Eine Einheit ist ein Hammer oder zwei,
   * drei dicht nebeneinander: Der Weg hält STAND davor (p), wartet (w) und
   * läuft zur Zeit s los – in einem Zug unter allen durch. Jeder Hammer der
   * Einheit ist offen, wenn dieser Weg unter ihm ist, dazu davor und danach
   * die Luft e und etwas Spiel. Bei zweien und dreien öffnet deshalb einer
   * nach dem anderen: eine Welle, die durchläuft.
   *
   * Gewartet wird höchstens so lange, dass der Weg von Halt zu Halt
   * VORSPRUNG-mal so schnell bleibt wie der Dampf. So holt der Dampf den
   * Weg nie ein – auch nicht den, der überall um die ganze Luft zu spät ist.
   */
  function naechsteEinheit() {
    const plan = state.plan;
    const v = plan[plan.length - 1];
    const n = state.haemmer.length;
    const k = anteil(n, LUFT_WEG);
    // Immer gleich viele Zahlen ziehen, was auch geschieht: Die Strecke soll
    // an der Saat hängen, nicht an den Zweigen dieser Funktion.
    const z = [zufall.zahl(), zufall.zahl(), zufall.zahl(), zufall.zahl(), zufall.zahl(), zufall.zahl(), zufall.zahl(), zufall.zahl()];
    const e = luftBei(n);
    const spiel = z[5] * spielBei(n);
    let zahl = 1;
    if (n >= 4 && z[0] < lerp(0.06, 0.42, k)) zahl = 2;
    if (n >= 10 && z[0] < lerp(0, 0.2, k)) zahl = 3;
    // Der Abstand zum Hammer davor: weit – oder eng, mit einer Insel
    // dazwischen, auf der sie gerade Platz hat.
    const eng = n >= 3 && z[1] < lerp(0.08, 0.4, k);
    const abstand = n === 0 ? ERSTER - v.letzter
      : eng ? 2 * ZONE + lerp(24, 13, k) + z[2] * 8
        : lerp(86, 62, k) + z[2] * 36;
    const x0 = v.letzter + abstand;
    const weite = 2 * KOPF + 2 + z[3] * 6;
    const p = x0 - ZONE - STAND;
    const an = v.s + (p - v.p) / TEMPO;
    const wMax = Math.min(WARTE_MAX, (p - v.p) * (1 / (dampfBei(n) * VORSPRUNG) - 1 / TEMPO));
    // Vor dem ersten Hammer wartet der Weg in jedem Fall: Wer einfach
    // durchläuft, läuft in ihn hinein.
    const w = n === 0 ? e + spiel + 0.14 + z[4] * 0.2 : z[4] * wMax;
    const s = an + w;
    const zu = lerp(0.6, 0.4, k) + z[6] * lerp(0.2, 0.34, k);
    const offen = QUER + 2 * e + spiel;
    const T = offen + zu;
    const heben = Math.min(HEBEN, offen * 0.5);
    const r1 = heben * (MAUS_H / HOCH);
    const r2 = heben - r1;
    for (let i = 0; i < zahl; i += 1) {
      const x = x0 + i * weite;
      const rein = s + (x - ZONE - p) / TEMPO;
      state.haemmer.push({
        x, T, offen, off: rein - e - z[7] * spiel, r1, r2, warnt: Math.min(ZITTERN, offen - r2 - F0),
        nr: n + i, einheit: plan.length, schlaege: null, drin: false, frueh: false, zuBeiEintritt: false, glut: 0,
      });
    }
    plan.push({ p, s, an, w, e, spiel, zahl, erster: n, letzter: x0 + (zahl - 1) * weite });
  }

  function planBis(x) {
    const plan = state.plan;
    while (plan[plan.length - 1].letzter < x) naechsteEinheit();
  }

  function kursNeu() {
    state.haemmer = [];
    state.plan = [{ p: START_X, s: 0, an: 0, w: 0, e: 0, spiel: 0, zahl: 0, erster: 0, letzter: START_X - ZONE }];
    planBis(900);
  }

  // Die Strecke als Text – für die Prüfung, dass in einem Turnier alle
  // dieselbe bekommen.
  function kursText(zahl = 60) {
    while (state.haemmer.length < zahl) naechsteEinheit();
    return state.haemmer.slice(0, zahl).map((h) => `${h.x.toFixed(2)}/${h.T.toFixed(4)}/${h.offen.toFixed(4)}/${h.off.toFixed(4)}`).join(" ");
  }

  // ---------------------------------------------------------------------------
  // Die Fläche
  // ---------------------------------------------------------------------------
  function buildPlatz() {
    const platz = shell.el("div", "sm-platz");
    feld = shell.el("div", "sm-feld");
    canvas = document.createElement("canvas");
    canvas.className = "sm-canvas";
    canvas.setAttribute("aria-hidden", "true");
    feld.append(canvas);
    g = canvas.getContext("2d", { alpha: false });

    // Der Hinweis vor dem ersten Druck: ein Ring, der sich füllt – halten,
    // nicht tippen.
    const tipp = shell.el("span", "sm-tipp");
    tipp.setAttribute("aria-hidden", "true");
    const ns = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(ns, "svg");
    svg.setAttribute("viewBox", "0 0 64 64");
    const kreis = (klasse, r, strich, farbe, fuell) => {
      const el = document.createElementNS(ns, "circle");
      if (klasse) el.setAttribute("class", klasse);
      el.setAttribute("cx", "32");
      el.setAttribute("cy", "32");
      el.setAttribute("r", String(r));
      el.setAttribute("fill", fuell);
      if (strich) {
        el.setAttribute("stroke", farbe);
        el.setAttribute("stroke-width", String(strich));
        el.setAttribute("stroke-linecap", "round");
      }
      svg.append(el);
    };
    kreis("", 22, 5, "rgba(255,255,255,0.4)", "none");
    kreis("sm-tipp-fuell", 22, 5, "#ffffff", "none");
    kreis("", 9, 0, "", "#ffffff");
    tipp.append(svg);
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
    // Hochkant bestimmt die Breite: 220 Einheiten sind im Bild, damit die
    // nächsten zwei Hämmer zu sehen sind. Quer bestimmt die Höhe.
    const hochkant = cssH > cssW * 1.05;
    view.s = Math.min(cssW / 220, cssH / 185);
    view.f = view.s * dpr;
    view.w = cssW / view.s;
    view.vorn = hochkant ? 0.19 : 0.21;
    view.bodenY = Math.round(cssH * (hochkant ? 0.71 : 0.8) * dpr) / dpr;
    view.bodenU = view.bodenY / view.s;
    view.untenU = (cssH - view.bodenY) / view.s;
    const pw = Math.round(cssW * dpr);
    const ph = Math.round(cssH * dpr);
    if (canvas.width !== pw) canvas.width = pw;
    if (canvas.height !== ph) canvas.height = ph;
    bilderNeu();
  }

  const bildX = (x) => (x - state.camX) * view.s;
  const bildY = (y) => view.bodenY - y * view.s;
  const camZiel = () => state.maus.x - view.w * view.vorn;

  // ---------------------------------------------------------------------------
  // Vorgemalt: Mauer, Boden, Hammerkopf, Schein, Dampf
  // ---------------------------------------------------------------------------
  /*
   * Was sich nicht ändert, wird einmal gemalt, in der Grösse des Bildes, und
   * dann Punkt auf Punkt aufgelegt: die Mauer hinten (sie zieht langsamer
   * vorbei als der Boden), der Boden mit der Glut darunter, der Hammerkopf,
   * der Schein eines Schlags und die Schwaden des Dampfs. Verläufe über das
   * ganze Bild kosten so nichts mehr.
   */
  const WAND = 300;                // so breit ist ein Stück Mauer, dann wiederholt sie sich
  const BODEN = 96;                // ebenso der Boden
  const FERN = 0.4;                // so viel langsamer zieht die Mauer vorbei
  let wandBild = null;
  let bodenBild = null;
  let kopfBild = null;
  let scheinBild = null;
  let dampfBild = null;
  let randBild = null;
  const ort = { radX: 142, radY: 178, radR: 56, oben: 0 };

  function leinwand(w, h, deckend) {
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(w));
    c.height = Math.max(1, Math.round(h));
    return { c, k: c.getContext("2d", deckend ? { alpha: false } : undefined) };
  }

  function bilderNeu() {
    const f = view.f;
    const hU = view.bodenU;
    // Was oben an der Mauer hängt (Fenster, Rad), rückt im Querformat
    // herunter: Dort ist die Halle niedriger.
    ort.oben = clamp(hU - 262, -92, 40);
    ort.radY = 178 + ort.oben;
    ort.radR = hU > 200 ? 56 : 48;
    maleWand(f, hU);
    maleBoden(f);
    maleKopf(f);
    maleSchein(f);
    maleDampf(f);
  }

  function maleWand(f, hU) {
    const pw = Math.round(WAND * f);
    const ph = Math.round(view.bodenY * view.dpr);
    const { c, k } = leinwand(pw, ph, true);
    wandBild = c;
    k.scale(pw / WAND, ph / hU);
    // y zählt hier von oben; Y(y) ist die Höhe über dem Boden.
    const Y = (y) => hU - y;
    const grund = k.createLinearGradient(0, 0, 0, hU);
    grund.addColorStop(0, "#070a1e");
    grund.addColorStop(0.45, "#121838");
    grund.addColorStop(0.82, "#241d3c");
    grund.addColorStop(1, "#3a2336");
    k.fillStyle = grund;
    k.fillRect(0, 0, WAND, hU);

    // Die Steine der Mauer.
    for (let reihe = 0; reihe * 8 < hU; reihe += 1) {
      const y = reihe * 8;
      k.fillStyle = "rgba(140, 160, 240, 0.05)";
      k.fillRect(0, y, WAND, 0.5);
      for (let i = 0; i < WAND / 20; i += 1) {
        const x = i * 20 + (reihe % 2) * 10;
        k.fillRect(x, y, 0.5, 8);
        const z = hash01(reihe * 31.7 + i * 7.3);
        if (z > 0.72) {
          k.fillStyle = z > 0.86 ? "rgba(150, 170, 255, 0.055)" : "rgba(0, 0, 10, 0.16)";
          k.fillRect(x + 0.5, y + 0.5, 19.5, 7.5);
          k.fillStyle = "rgba(140, 160, 240, 0.05)";
        }
      }
    }

    // Das Glutlicht der Esse – zweimal, damit es über die Naht reicht.
    const ex = 232;
    [ex, ex - WAND].forEach((x) => {
      const glut = k.createRadialGradient(x, Y(20), 4, x, Y(20), 130);
      glut.addColorStop(0, "rgba(255, 150, 50, 0.6)");
      glut.addColorStop(0.35, "rgba(255, 100, 40, 0.26)");
      glut.addColorStop(1, "rgba(255, 80, 30, 0)");
      k.fillStyle = glut;
      k.fillRect(x - 130, Y(150), 260, 150);
    });

    // Das Bogenfenster mit dem Mond – und sein kaltes Licht, das schräg in
    // die Halle fällt.
    const fx = 50;
    const fu = 128 + ort.oben;       // Unterkante
    const fo = fu + 62;              // wo der Bogen beginnt
    const hof = k.createRadialGradient(fx, Y(fo), 6, fx, Y(fo), 96);
    hof.addColorStop(0, "rgba(120, 170, 255, 0.34)");
    hof.addColorStop(1, "rgba(120, 170, 255, 0)");
    k.fillStyle = hof;
    k.fillRect(fx - 96, Y(fo + 96), 192, 192);
    const strahl = k.createLinearGradient(fx, Y(fu), fx + 90, Y(0));
    strahl.addColorStop(0, "rgba(150, 195, 255, 0.2)");
    strahl.addColorStop(1, "rgba(150, 195, 255, 0)");
    k.fillStyle = strahl;
    k.beginPath();
    k.moveTo(fx - 22, Y(fu));
    k.lineTo(fx + 22, Y(fu));
    k.lineTo(fx + 22 + fu * 0.75, Y(0));
    k.lineTo(fx - 22 + fu * 0.5, Y(0));
    k.closePath();
    k.fill();
    const bogen = () => {
      k.beginPath();
      k.moveTo(fx - 22, Y(fu));
      k.lineTo(fx - 22, Y(fo));
      k.arc(fx, Y(fo), 22, Math.PI, 0);
      k.lineTo(fx + 22, Y(fu));
      k.closePath();
    };
    const glas = k.createLinearGradient(0, Y(fo + 22), 0, Y(fu));
    glas.addColorStop(0, "#1c3a86");
    glas.addColorStop(0.6, "#3d6fc4");
    glas.addColorStop(1, "#7fb0ee");
    k.fillStyle = glas;
    bogen();
    k.fill();
    k.save();
    bogen();
    k.clip();
    const mond = k.createRadialGradient(fx + 6, Y(fo + 2), 2, fx + 6, Y(fo + 2), 30);
    mond.addColorStop(0, "rgba(255, 255, 255, 0.9)");
    mond.addColorStop(0.3, "rgba(200, 225, 255, 0.5)");
    mond.addColorStop(1, "rgba(200, 225, 255, 0)");
    k.fillStyle = mond;
    k.fillRect(fx - 30, Y(fo + 32), 70, 70);
    k.fillStyle = "#f6f9ff";
    k.beginPath();
    k.arc(fx + 6, Y(fo + 2), 8, 0, Math.PI * 2);
    k.fill();
    k.restore();
    k.strokeStyle = "#0b1030";
    k.lineWidth = 1.8;
    k.beginPath();
    k.moveTo(fx, Y(fu));
    k.lineTo(fx, Y(fo + 22));
    [fu + 20, fu + 41, fo].forEach((y) => { k.moveTo(fx - 22, Y(y)); k.lineTo(fx + 22, Y(y)); });
    k.moveTo(fx, Y(fo));
    k.lineTo(fx - 15.5, Y(fo + 15.5));
    k.moveTo(fx, Y(fo));
    k.lineTo(fx + 15.5, Y(fo + 15.5));
    k.stroke();
    k.strokeStyle = "#39447c";
    k.lineWidth = 3.2;
    bogen();
    k.stroke();
    k.fillStyle = "#39447c";
    k.fillRect(fx - 27, Y(fu), 54, 4);

    // Der Dachbalken mit seinen Streben.
    const by = Math.min(hU - 10, 250 + ort.oben);
    k.fillStyle = "#150f1c";
    k.fillRect(0, Y(by), WAND, 9);
    k.fillStyle = "rgba(120, 150, 240, 0.22)";
    k.fillRect(0, Y(by), WAND, 0.8);
    k.strokeStyle = "#150f1c";
    k.lineWidth = 5;
    k.beginPath();
    [0, WAND].forEach((x) => {
      k.moveTo(x - 46, Y(by - 6));
      k.lineTo(x, Y(by - 50));
      k.lineTo(x + 46, Y(by - 6));
    });
    k.stroke();

    // Ketten mit Haken.
    k.strokeStyle = "#2c3566";
    k.lineWidth = 1.4;
    [[118, 60], [262, 84]].forEach(([x, lang]) => {
      k.setLineDash([2.4, 1.6]);
      k.beginPath();
      k.moveTo(x, Y(by - 9));
      k.lineTo(x, Y(by - 9 - lang));
      k.stroke();
      k.setLineDash([]);
      k.beginPath();
      k.arc(x, Y(by - 9 - lang - 4), 4, -Math.PI * 0.5, Math.PI * 0.9);
      k.stroke();
    });

    // Die Esse: der Herd mit der Glut, darüber die Haube und der Kamin.
    k.fillStyle = "#1b1526";
    k.beginPath();
    k.moveTo(ex - 14, Y(hU));
    k.lineTo(ex - 14, Y(92));
    k.lineTo(ex - 38, Y(46));
    k.lineTo(ex + 38, Y(46));
    k.lineTo(ex + 14, Y(92));
    k.lineTo(ex + 14, Y(hU));
    k.closePath();
    k.fill();
    k.strokeStyle = "rgba(255, 150, 70, 0.55)";
    k.lineWidth = 1;
    k.beginPath();
    k.moveTo(ex - 14, Y(hU));
    k.lineTo(ex - 14, Y(92));
    k.lineTo(ex - 38, Y(46));
    k.lineTo(ex + 38, Y(46));
    k.stroke();
    k.fillStyle = "#2a2132";
    k.fillRect(ex - 36, Y(40), 72, 40);
    k.fillStyle = "rgba(255, 170, 90, 0.35)";
    k.fillRect(ex - 36, Y(40), 72, 1);
    for (let i = 0; i < 4; i += 1) {
      k.fillStyle = "rgba(0, 0, 0, 0.25)";
      k.fillRect(ex - 36, Y(40 - i * 10), 72, 0.7);
    }
    const feuer = k.createRadialGradient(ex, Y(8), 1, ex, Y(8), 26);
    feuer.addColorStop(0, "#fff6c4");
    feuer.addColorStop(0.3, "#ffbe4a");
    feuer.addColorStop(0.65, "#f0541e");
    feuer.addColorStop(1, "#4a1420");
    k.fillStyle = feuer;
    k.beginPath();
    k.moveTo(ex - 22, Y(2));
    k.lineTo(ex - 22, Y(18));
    k.arc(ex, Y(18), 22, Math.PI, 0);
    k.lineTo(ex + 22, Y(2));
    k.closePath();
    k.fill();

    // Das Gestell mit dem Werkzeug: Zangen und Hämmer als Schatten.
    k.fillStyle = "#120e1c";
    k.fillRect(118, Y(52), 62, 2.4);
    k.strokeStyle = "#120e1c";
    k.lineWidth = 1.8;
    k.beginPath();
    [124, 135, 147, 160, 172].forEach((x, i) => {
      const lang = 20 + (i % 3) * 7;
      k.moveTo(x, Y(52));
      k.lineTo(x, Y(52 - lang));
      if (i % 2 === 0) { k.moveTo(x - 4, Y(52 - lang)); k.lineTo(x + 4, Y(52 - lang)); k.moveTo(x - 4, Y(52 - lang + 3)); k.lineTo(x + 4, Y(52 - lang + 3)); }
      else { k.moveTo(x, Y(52 - lang)); k.lineTo(x - 3, Y(52 - lang - 9)); k.moveTo(x, Y(52 - lang)); k.lineTo(x + 3, Y(52 - lang - 9)); }
    });
    k.stroke();

    // Das Lager des Wasserrads und die Rinne, aus der das Wasser fällt.
    k.fillStyle = "#171226";
    k.fillRect(ort.radX - 7, Y(ort.radY + 5), 14, ort.radY + 5);
    k.fillStyle = "#1e1830";
    k.fillRect(ort.radX - 96, Y(ort.radY + ort.radR + 15), 70, 6);
    const wasser = k.createLinearGradient(0, Y(ort.radY + ort.radR + 9), 0, Y(ort.radY + ort.radR - 40));
    wasser.addColorStop(0, "rgba(170, 215, 255, 0.5)");
    wasser.addColorStop(1, "rgba(170, 215, 255, 0)");
    k.fillStyle = wasser;
    k.fillRect(ort.radX - 31, Y(ort.radY + ort.radR + 9), 5, 49);

    // Die Pfeiler an der Naht: links kalt, rechts warm beleuchtet.
    [0, WAND].forEach((x) => {
      const stein = k.createLinearGradient(x - 9, 0, x + 9, 0);
      stein.addColorStop(0, "#252c58");
      stein.addColorStop(0.5, "#1a1a38");
      stein.addColorStop(1, "#4a2c40");
      k.fillStyle = stein;
      k.fillRect(x - 9, 0, 18, hU);
      k.fillStyle = "#12122a";
      k.fillRect(x - 12, Y(by - 50), 24, 6);
      k.fillRect(x - 12, Y(8), 24, 8);
    });

    // Nach unten hin dunkler: Davor stehen die Hämmer.
    const fuss = k.createLinearGradient(0, Y(34), 0, hU);
    fuss.addColorStop(0, "rgba(8, 6, 20, 0)");
    fuss.addColorStop(1, "rgba(8, 6, 20, 0.5)");
    k.fillStyle = fuss;
    k.fillRect(0, Y(34), WAND, 34);
  }

  function maleBoden(f) {
    const tief = view.untenU;
    const pw = Math.round(BODEN * f);
    const ph = Math.round(canvas.height - view.bodenY * view.dpr);
    const { c, k } = leinwand(pw, ph, true);
    bodenBild = c;
    k.scale(pw / BODEN, ph / tief);
    k.fillStyle = "#0c0a1a";
    k.fillRect(0, 0, BODEN, tief);
    // Das Gewölbe unter dem Boden, in dem die Glut liegt.
    const mitte = BODEN / 2;
    const breit = 31;
    const oben = 15;
    const unten = Math.min(tief, 86);
    for (let reihe = 0; reihe * 9 < tief; reihe += 1) {
      k.fillStyle = "rgba(120, 120, 200, 0.07)";
      k.fillRect(0, 7 + reihe * 9, BODEN, 0.5);
      for (let i = 0; i < 5; i += 1) k.fillRect(i * 24 + (reihe % 2) * 12, 7 + reihe * 9, 0.5, 9);
    }
    k.save();
    k.beginPath();
    k.moveTo(mitte - breit, unten);
    k.lineTo(mitte - breit, oben + breit * 0.7);
    k.quadraticCurveTo(mitte - breit, oben, mitte, oben);
    k.quadraticCurveTo(mitte + breit, oben, mitte + breit, oben + breit * 0.7);
    k.lineTo(mitte + breit, unten);
    k.closePath();
    k.fillStyle = "#170a14";
    k.fill();
    k.clip();
    const glut = k.createRadialGradient(mitte, unten + 4, 2, mitte, unten + 4, Math.max(40, (unten - oben) * 1.05));
    glut.addColorStop(0, "#fff0b0");
    glut.addColorStop(0.22, "#ffae3a");
    glut.addColorStop(0.55, "#d8421c");
    glut.addColorStop(1, "rgba(80, 16, 28, 0)");
    k.fillStyle = glut;
    k.fillRect(mitte - breit, oben, breit * 2, unten - oben);
    // Das Gitter davor.
    k.fillStyle = "#0c0814";
    for (let x = mitte - breit + 6; x < mitte + breit; x += 8.5) k.fillRect(x, oben, 1.6, unten - oben);
    k.fillRect(mitte - breit, oben + (unten - oben) * 0.55, breit * 2, 1.6);
    k.restore();
    k.strokeStyle = "rgba(255, 150, 70, 0.5)";
    k.lineWidth = 1;
    k.beginPath();
    k.moveTo(mitte - breit, unten);
    k.lineTo(mitte - breit, oben + breit * 0.7);
    k.quadraticCurveTo(mitte - breit, oben, mitte, oben);
    k.quadraticCurveTo(mitte + breit, oben, mitte + breit, oben + breit * 0.7);
    k.lineTo(mitte + breit, unten);
    k.stroke();
    // Die Bodenplatten: Stein mit einer hellen Kante.
    const platte = k.createLinearGradient(0, 0, 0, 7);
    platte.addColorStop(0, "#4f4868");
    platte.addColorStop(1, "#241f38");
    k.fillStyle = platte;
    k.fillRect(0, 0, BODEN, 7);
    k.fillStyle = "#b3a6cf";
    k.fillRect(0, 0, BODEN, 0.9);
    k.fillStyle = "rgba(8, 6, 20, 0.6)";
    [0, 24, 48, 72].forEach((x) => k.fillRect(x + 11, 0.9, 0.7, 6.1));
    k.fillStyle = "rgba(255, 150, 70, 0.2)";
    k.fillRect(mitte - breit, 6.2, breit * 2, 0.8);
    // Ganz unten wird es dunkel.
    if (tief > unten + 2) {
      const fuss = k.createLinearGradient(0, unten - 14, 0, tief);
      fuss.addColorStop(0, "rgba(6, 5, 14, 0)");
      fuss.addColorStop(0.3, "rgba(6, 5, 14, 0.9)");
      fuss.addColorStop(1, "#06050e");
      k.fillStyle = fuss;
      k.fillRect(0, unten - 14, BODEN, tief - unten + 14);
    }
  }

  // Der Kopf eines Hammers: ein Block aus Eisen, oben ein Band mit Nieten,
  // unten die blanke Bahn – von der Glut am Boden her warm beleuchtet.
  function maleKopf(f) {
    const b = 2 * KOPF;
    const { c, k } = leinwand(b * f, KOPF_H * f, false);
    kopfBild = c;
    k.scale(c.width / b, c.height / KOPF_H);
    const eisen = k.createLinearGradient(0, 0, b, 0);
    eisen.addColorStop(0, "#7f8cb8");
    eisen.addColorStop(0.16, "#565c80");
    eisen.addColorStop(0.7, "#33354f");
    eisen.addColorStop(1, "#1d1c30");
    k.fillStyle = eisen;
    k.beginPath();
    k.moveTo(1.5, 0);
    k.lineTo(b - 1.5, 0);
    k.lineTo(b, 1.5);
    k.lineTo(b, KOPF_H - 2);
    k.lineTo(b - 2, KOPF_H);
    k.lineTo(2, KOPF_H);
    k.lineTo(0, KOPF_H - 2);
    k.lineTo(0, 1.5);
    k.closePath();
    k.fill();
    k.fillStyle = "rgba(12, 10, 28, 0.55)";
    k.fillRect(0, 4.5, b, 4.2);
    k.fillStyle = "#aab4dc";
    [3.5, 9, 15, 20.5].forEach((x) => { k.beginPath(); k.arc(x, 6.6, 0.85, 0, Math.PI * 2); k.fill(); });
    k.fillStyle = "rgba(190, 205, 255, 0.5)";
    k.fillRect(0.8, 1.6, 0.9, KOPF_H - 4);
    const bahn = k.createLinearGradient(0, KOPF_H - 5.5, 0, KOPF_H);
    bahn.addColorStop(0, "rgba(255, 150, 70, 0)");
    bahn.addColorStop(0.55, "rgba(255, 160, 80, 0.55)");
    bahn.addColorStop(1, "#ffd9a0");
    k.fillStyle = bahn;
    k.fillRect(0.6, KOPF_H - 5.5, b - 1.2, 5.5);
  }

  function maleSchein(f) {
    const r = 27;
    const gross = leinwand(2 * r * f, 2 * r * f, false);
    scheinBild = gross.c;
    const k = gross.k;
    k.scale(scheinBild.width / (2 * r), scheinBild.height / (2 * r));
    const schein = k.createRadialGradient(r, r, 0, r, r, r);
    schein.addColorStop(0, "rgba(255, 244, 200, 0.95)");
    schein.addColorStop(0.25, "rgba(255, 180, 80, 0.6)");
    schein.addColorStop(0.6, "rgba(255, 110, 40, 0.18)");
    schein.addColorStop(1, "rgba(255, 90, 30, 0)");
    k.fillStyle = schein;
    k.fillRect(0, 0, 2 * r, 2 * r);
  }

  function maleDampf(f) {
    const r = 30;
    const puff = leinwand(2 * r * f, 2 * r * f, false);
    dampfBild = puff.c;
    let k = puff.k;
    k.scale(dampfBild.width / (2 * r), dampfBild.height / (2 * r));
    const weiss = k.createRadialGradient(r, r, 0, r, r, r);
    weiss.addColorStop(0, "rgba(244, 247, 255, 0.95)");
    weiss.addColorStop(0.55, "rgba(232, 238, 252, 0.7)");
    weiss.addColorStop(1, "rgba(226, 232, 250, 0)");
    k.fillStyle = weiss;
    k.fillRect(0, 0, 2 * r, 2 * r);
    // Der Schleier am linken Rand, wenn der Dampf nah ist, aber noch nicht
    // im Bild.
    const breit = 46;
    const rand = leinwand(breit * f, Math.round(view.bodenY * view.dpr), false);
    randBild = rand.c;
    k = rand.k;
    const verlauf = k.createLinearGradient(0, 0, randBild.width, 0);
    verlauf.addColorStop(0, "rgba(236, 241, 255, 0.8)");
    verlauf.addColorStop(1, "rgba(236, 241, 255, 0)");
    k.fillStyle = verlauf;
    k.fillRect(0, 0, randBild.width, randBild.height);
  }

  // ---------------------------------------------------------------------------
  // Zeichnen: die Halle
  // ---------------------------------------------------------------------------
  // Wie sehr das Werk läuft (0 … 1): vor dem Start steht es.
  const anlauf = () => (state.phase === "bereit" ? 0 : glatt(state.uhr / ANLAUF));

  function zeichneWand(dx, dy) {
    const pw = wandBild.width;
    let x = -Math.round(mod(state.camX * view.f * FERN, pw)) + dx;
    for (; x < canvas.width; x += pw) g.drawImage(wandBild, x, dy);
  }

  function zeichneBoden(dx, dy) {
    const pw = bodenBild.width;
    const y = Math.round(view.bodenY * view.dpr) + dy;
    let x = -Math.round(mod(state.camX * view.f, pw)) + dx;
    for (; x < canvas.width; x += pw) g.drawImage(bodenBild, x, y);
  }

  function zahnrad(cx, cy, r, zaehne, winkel) {
    const n = zaehne * 4;
    g.beginPath();
    for (let i = 0; i < n; i += 1) {
      const a = winkel + (i / n) * Math.PI * 2;
      const rr = (i % 4 < 2) ? r : r * 0.84;
      const x = cx + Math.cos(a) * rr;
      const y = cy + Math.sin(a) * rr;
      if (i === 0) g.moveTo(x, y);
      else g.lineTo(x, y);
    }
    g.closePath();
    g.fill();
  }

  // Das Wasserrad und die Zahnräder an der Mauer: Sie drehen sich, also
  // werden sie jedes Bild gemalt – als Striche und flache Flächen.
  function zeichneRaeder() {
    const s = view.s;
    const breit = wandBild.width / view.dpr;
    const x0 = -mod(state.camX * view.f * FERN, wandBild.width) / view.dpr;
    const r = ort.radR * s;
    const cy = bildY(ort.radY);
    const w = state.rad;
    for (let x = x0; x < view.cssW + breit; x += breit) {
      const cx = x + (ort.radX / WAND) * breit;
      if (cx + r * 1.7 < 0 || cx - r * 1.1 > view.cssW) continue;
      // Das Rad: Felge, Speichen, Schaufeln.
      g.strokeStyle = "#2c2030";
      g.lineWidth = 3.4 * s;
      g.beginPath();
      g.arc(cx, cy, r, 0, Math.PI * 2);
      g.stroke();
      g.lineWidth = 1.7 * s;
      g.beginPath();
      g.arc(cx, cy, r * 0.8, 0, Math.PI * 2);
      for (let i = 0; i < 8; i += 1) {
        const a = w + (i / 8) * Math.PI * 2;
        g.moveTo(cx + Math.cos(a) * r * 0.1, cy + Math.sin(a) * r * 0.1);
        g.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
      }
      g.stroke();
      g.strokeStyle = "#3a2a36";
      g.lineWidth = 2.6 * s;
      g.beginPath();
      for (let i = 0; i < 16; i += 1) {
        const a = w + (i / 16) * Math.PI * 2;
        g.moveTo(cx + Math.cos(a) * r * 0.86, cy + Math.sin(a) * r * 0.86);
        g.lineTo(cx + Math.cos(a + 0.09) * r * 1.07, cy + Math.sin(a + 0.09) * r * 1.07);
      }
      g.stroke();
      // Kaltes Licht vom Fenster auf der einen Seite, Glut auf der anderen.
      g.lineWidth = 1.1 * s;
      g.strokeStyle = "rgba(140, 185, 255, 0.5)";
      g.beginPath();
      g.arc(cx, cy, r + 1.4 * s, Math.PI * 0.95, Math.PI * 1.45);
      g.stroke();
      g.strokeStyle = "rgba(255, 150, 70, 0.5)";
      g.beginPath();
      g.arc(cx, cy, r + 1.4 * s, Math.PI * 0.1, Math.PI * 0.5);
      g.stroke();
      g.fillStyle = "#4a3640";
      g.beginPath();
      g.arc(cx, cy, r * 0.13, 0, Math.PI * 2);
      g.fill();
      // Zwei Zahnräder, die ineinandergreifen.
      const r1 = 21 * s;
      const r2 = 13 * s;
      const ax = cx + r + r1 * 0.72;
      const ay = cy + r * 0.3;
      g.fillStyle = "#2a2036";
      zahnrad(ax, ay, r1, 12, -w * 2.4);
      g.fillStyle = "#342640";
      zahnrad(ax + (r1 + r2) * 0.74, ay - (r1 + r2) * 0.56, r2, 8, w * 3.6 + 0.3);
      g.fillStyle = "#151022";
      g.beginPath();
      g.arc(ax, ay, r1 * 0.45, 0, Math.PI * 2);
      g.moveTo(ax + (r1 + r2) * 0.74 + r2 * 0.4, ay - (r1 + r2) * 0.56);
      g.arc(ax + (r1 + r2) * 0.74, ay - (r1 + r2) * 0.56, r2 * 0.4, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = "rgba(255, 150, 70, 0.45)";
      g.lineWidth = 1 * s;
      g.beginPath();
      g.arc(ax, ay, r1 * 0.9, Math.PI * 0.15, Math.PI * 0.6);
      g.stroke();
    }
  }

  // Die Glut in der Esse flackert: ein kleiner Schein über dem Feuer.
  function zeichneFeuer() {
    if (ruhig()) return;
    const breit = wandBild.width / view.dpr;
    const x0 = -mod(state.camX * view.f * FERN, wandBild.width) / view.dpr;
    const gross = scheinBild.width / view.dpr;
    const kraft = 0.3 + 0.2 * Math.sin(state.zeit * 9.1) + 0.14 * Math.sin(state.zeit * 23.7);
    g.globalAlpha = clamp(kraft, 0.05, 0.7);
    for (let x = x0; x < view.cssW + breit; x += breit) {
      const cx = x + (232 / WAND) * breit;
      if (cx + gross < 0 || cx - gross > view.cssW) continue;
      g.drawImage(scheinBild, cx - gross / 2, bildY(14) - gross / 2, gross, gross);
    }
    g.globalAlpha = 1;
  }

  // ---------------------------------------------------------------------------
  // Zeichnen: die Hämmer
  // ---------------------------------------------------------------------------
  const WELLE_Y = 124;             // dort dreht sich die Welle mit den Nocken
  const FUEHRUNG_Y = 100;          // dort führt ein Balken die Stiele

  function sichtbar() {
    const liste = state.haemmer;
    const von = state.camX - 30;
    const bis = state.camX + view.w + 30;
    let a = Math.max(0, state.naechster - 8);
    while (a < liste.length && liste[a].x < von) a += 1;
    let b = a;
    while (b < liste.length && liste[b].x < bis) b += 1;
    return [a, b];
  }

  function zeichneHaemmer() {
    const s = view.s;
    const W = view.cssW;
    const an = anlauf();
    const [a, b] = sichtbar();
    const liste = state.haemmer;
    // Die Welle: ein langer runder Balken, quer durchs Bild.
    const wy = bildY(WELLE_Y + 4);
    g.fillStyle = "#1c1524";
    g.fillRect(0, wy, W, 8 * s);
    g.fillStyle = "#5d4c66";
    g.fillRect(0, wy + 1.4 * s, W, 1.5 * s);
    // Ihre Lager: alle 96 Einheiten ein Bock, der vom Dach herunterhängt.
    g.fillStyle = "#120d1a";
    for (let x = Math.floor(state.camX / 96) * 96; x < state.camX + view.w + 10; x += 96) {
      g.fillRect(bildX(x + 44), 0, 6 * s, wy + 9 * s);
    }
    // Die Nocken und die Stiele.
    for (let i = a; i < b; i += 1) {
      const h = liste[i];
      const sx = bildX(h.x);
      const q = phaseBei(h, state.uhr) / h.T;
      // Die Nocke dreht einmal je Schlag.
      g.save();
      g.translate(sx + 7 * s, wy + 4 * s);
      g.rotate(an > 0 ? q * Math.PI * 2 : 0.6 + h.nr);
      g.fillStyle = "#6f5a50";
      g.fillRect(-2.4 * s, -10 * s, 4.8 * s, 10 * s);
      g.beginPath();
      g.arc(0, 0, 5.2 * s, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = "#2a2030";
      g.fillRect(-1.6 * s, -1.6 * s, 3.2 * s, 3.2 * s);
      g.restore();
    }
    for (let i = a; i < b; i += 1) {
      const h = liste[i];
      const hoch = lerp(HOCH, hoeheBei(h, state.uhr), an);
      const zit = an >= 1 ? zitternBei(h, state.uhr) : 0;
      const dx = zit > 0 && !ruhig() ? Math.sin(state.zeit * 71 + h.nr) * 0.9 * zit * s : 0;
      h.bildX = bildX(h.x) + dx;
      h.bildHoch = hoch;
      h.zit = zit;
      const oben = bildY(hoch + KOPF_H + STIEL);
      const lang = STIEL * s;
      // Der Stiel aus Holz mit dem Daumen, an dem die Nocke ihn hebt.
      g.fillStyle = "#4a3230";
      g.fillRect(h.bildX - 3 * s, oben, 6 * s, lang);
      g.fillStyle = "#7a5646";
      g.fillRect(h.bildX - 3 * s, oben, 1.3 * s, lang);
      g.fillStyle = "#2c2a44";
      g.fillRect(h.bildX - 3 * s, bildY(hoch + KOPF_H + 58), 12 * s, 4.5 * s);
    }
    // Der Balken, der die Stiele führt – vor ihnen.
    const fy = bildY(FUEHRUNG_Y + 8);
    g.fillStyle = "#1a121e";
    g.fillRect(0, fy, W, 8 * s);
    g.fillStyle = "#4b3a42";
    g.fillRect(0, fy, W, 1.1 * s);
    g.fillStyle = "rgba(255, 150, 70, 0.25)";
    g.fillRect(0, fy + 7 * s, W, 1 * s);
    for (let i = a; i < b; i += 1) {
      const h = liste[i];
      const sx = bildX(h.x);
      g.fillStyle = "#34364e";
      g.fillRect(sx - 6 * s, fy - 1 * s, 12 * s, 10 * s);
      g.fillStyle = "#8f9bc8";
      g.fillRect(sx - 6 * s, fy - 1 * s, 12 * s, 0.9 * s);
    }
    // Die Platten im Boden, auf die sie schlagen – sie glühen nach.
    for (let i = a; i < b; i += 1) {
      const h = liste[i];
      const sx = bildX(h.x);
      g.fillStyle = "#6a6680";
      g.fillRect(sx - (KOPF + 1) * s, view.bodenY, (2 * KOPF + 2) * s, 2.6 * s);
      const glut = 0.35 + 0.65 * h.glut;
      g.fillStyle = `rgba(255, ${Math.round(120 + 110 * h.glut)}, ${Math.round(40 + 120 * h.glut)}, ${glut})`;
      g.fillRect(sx - (KOPF - 3) * s, view.bodenY, (2 * KOPF - 6) * s, 1.6 * s);
    }
    // Die Köpfe.
    const kb = 2 * KOPF * s;
    const kh = KOPF_H * s;
    for (let i = a; i < b; i += 1) {
      const h = liste[i];
      g.drawImage(kopfBild, h.bildX - KOPF * s, bildY(h.bildHoch + KOPF_H), kb, kh);
      // Kurz vor dem Schlag glüht seine Bahn auf.
      if (h.zit > 0) {
        g.fillStyle = `rgba(255, 96, 40, ${0.3 + 0.6 * h.zit})`;
        g.fillRect(h.bildX - (KOPF - 0.6) * s, bildY(h.bildHoch + 2.6), (2 * KOPF - 1.2) * s, 2.6 * s);
      }
    }
    // Der Schein der Schläge.
    g.globalCompositeOperation = "lighter";
    const gross = scheinBild.width / view.dpr;
    for (let i = a; i < b; i += 1) {
      const h = liste[i];
      if (h.glut <= 0.04) continue;
      g.globalAlpha = Math.min(1, h.glut * h.glut * 1.2);
      const sx = bildX(h.x);
      g.drawImage(scheinBild, sx - gross / 2, view.bodenY - gross / 2, gross, gross);
    }
    g.globalAlpha = 1;
    g.globalCompositeOperation = "source-over";
  }

  // ---------------------------------------------------------------------------
  // Zeichnen: die Maus
  // ---------------------------------------------------------------------------
  /*
   * Die Maus von der Seite, die Nase nach rechts: heller Pelz, grosse runde
   * Ohren, ein rotes Halstuch. lauf (0 … 1) ist, wie sehr sie läuft; schritt
   * zählt ihre Schritte. Als Geist ist sie aus Licht.
   */
  function zeichneMaus(sx, sy, s, wahl = {}) {
    const lauf = wahl.lauf || 0;
    const ph = wahl.schritt || 0;
    const geist = wahl.geist || null;
    const pelz = geist || "#e6ddd0";
    const dunkel = geist || "#bdb09f";
    const rosa = geist || "#f2a9a4";
    g.save();
    g.translate(sx, sy);
    if (wahl.dreh) g.rotate(wahl.dreh);
    const stauch = wahl.stauch || 0;
    g.scale(s * (1 + stauch * 0.14), s * (1 - stauch * 0.16));
    if (wahl.alpha !== undefined) g.globalAlpha = wahl.alpha;
    const wipp = lauf * Math.abs(Math.sin(ph * Math.PI * 2)) * 1.1;
    const t = state.zeit;
    // Der Schwanz: im Lauf gestreckt und wellig, im Stehen geringelt.
    g.strokeStyle = rosa;
    g.lineWidth = 1.5;
    g.lineCap = "round";
    g.beginPath();
    g.moveTo(-8, -5 - wipp);
    const schwung = Math.sin(ph * Math.PI * 2 + 1) * 3 * lauf + Math.sin(t * 2.2) * 1.2 * (1 - lauf);
    g.bezierCurveTo(-14, -3 - wipp, -16 - 4 * lauf, -9 - schwung, -21 - 5 * lauf, -8 + schwung - 5 * (1 - lauf));
    g.stroke();
    // Die Beine: vier, im Wechsel.
    g.strokeStyle = dunkel;
    g.lineWidth = 2;
    g.beginPath();
    [[-5, 0], [-2.5, 0.5], [4, 0.25], [6.5, 0.75]].forEach(([x, versatz]) => {
      const a = Math.sin((ph + versatz) * Math.PI * 2) * lauf;
      const hub = Math.max(0, Math.cos((ph + versatz) * Math.PI * 2)) * 2 * lauf;
      g.moveTo(x, -3.5 - wipp);
      g.lineTo(x + a * 4.2, -0.6 - hub);
    });
    g.stroke();
    if (!geist) {
      g.strokeStyle = rosa;
      g.lineWidth = 1.5;
      g.beginPath();
      [[-5, 0], [-2.5, 0.5], [4, 0.25], [6.5, 0.75]].forEach(([x, versatz]) => {
        const a = Math.sin((ph + versatz) * Math.PI * 2) * lauf;
        const hub = Math.max(0, Math.cos((ph + versatz) * Math.PI * 2)) * 2 * lauf;
        g.moveTo(x + a * 4.2, -0.6 - hub);
        g.lineTo(x + a * 4.2 + 1.6, -0.6 - hub);
      });
      g.stroke();
    }
    // Der Leib.
    g.translate(0, -wipp);
    g.rotate(-0.1 * lauf);
    g.fillStyle = pelz;
    g.beginPath();
    g.ellipse(-1, -6.4, 9.2, 5.3, 0, 0, Math.PI * 2);
    g.fill();
    if (!geist) {
      g.fillStyle = "#fbf6ee";
      g.beginPath();
      g.ellipse(0, -4.2, 6.5, 2.6, 0, 0, Math.PI * 2);
      g.fill();
    }
    // Das hintere Ohr, der Kopf, die Schnauze.
    const kx = 8.2;
    const ky = -8.6 - 0.8 * (1 - lauf);
    g.fillStyle = dunkel;
    g.beginPath();
    g.arc(kx - 0.4, ky - 5, 3.5, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = pelz;
    g.beginPath();
    g.arc(kx, ky, 4.9, 0, Math.PI * 2);
    g.moveTo(kx + 1, ky - 4);
    g.lineTo(kx + 8.6, ky + 1.6);
    g.lineTo(kx + 1, ky + 4.4);
    g.closePath();
    g.fill();
    // Das Halstuch.
    if (!geist) {
      g.fillStyle = "#e0412c";
      g.beginPath();
      g.moveTo(kx - 4.6, ky - 1);
      g.lineTo(kx - 1, ky + 5.2);
      g.lineTo(kx - 6.5 - 3 * lauf, ky + 5.6 + Math.sin(ph * Math.PI * 4) * 1.2 * lauf);
      g.closePath();
      g.fill();
    }
    // Das vordere Ohr: gross und rund.
    const zuck = geist ? 0 : Math.max(0, Math.sin(t * 1.3 + 2) - 0.96) * 8 * (1 - lauf);
    g.fillStyle = pelz;
    g.beginPath();
    g.arc(kx - 2.8, ky - 5.2 - zuck, 4.4, 0, Math.PI * 2);
    g.fill();
    if (!geist) {
      g.fillStyle = rosa;
      g.beginPath();
      g.arc(kx - 2.8, ky - 5.2 - zuck, 2.7, 0, Math.PI * 2);
      g.fill();
      // Auge, Nase, Schnurrhaare.
      g.fillStyle = "#14101e";
      g.beginPath();
      g.arc(kx + 2.3, ky - 0.9, 1.05, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = "#ffffff";
      g.fillRect(kx + 2.4, ky - 1.5, 0.6, 0.6);
      g.fillStyle = "#e9837e";
      g.beginPath();
      g.arc(kx + 8.4, ky + 1.5, 1, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = "rgba(255, 255, 255, 0.7)";
      g.lineWidth = 0.4;
      g.beginPath();
      g.moveTo(kx + 6, ky + 2);
      g.lineTo(kx + 9.5, ky + 4.4);
      g.moveTo(kx + 6, ky + 1.4);
      g.lineTo(kx + 10.4, ky + 2.6);
      g.stroke();
    }
    g.restore();
  }

  function zeichneFigur() {
    const m = state.maus;
    const s = view.s;
    const sx = bildX(m.x - MAUS_MITTE);
    if (state.schritt === "aus" && state.aus) {
      const f = state.aus;
      if (f.warum === "dampf") {
        if (f.weg < 1) zeichneMaus(sx, bildY(f.y), s, { lauf: 0, alpha: 1 - f.weg });
        return;
      }
      zeichneMaus(bildX(f.x - MAUS_MITTE), bildY(f.y + 6) + 6 * s, s, { lauf: 0.6, schritt: state.zeit * 3, dreh: f.dreh });
      // Sterne um den Kopf.
      if (!ruhig()) {
        g.fillStyle = "#ffe08a";
        for (let i = 0; i < 3; i += 1) {
          const a = state.zeit * 6 + i * 2.1;
          g.fillRect(bildX(f.x) + Math.cos(a) * 11 * s - 1.5, bildY(f.y + 16) + Math.sin(a) * 4 * s - 1.5, 3, 3);
        }
      }
      return;
    }
    // Ihr Schatten am Boden.
    g.fillStyle = "rgba(6, 4, 16, 0.4)";
    g.beginPath();
    g.ellipse(sx, view.bodenY + 1.2 * s, 10 * s, 1.8 * s, 0, 0, Math.PI * 2);
    g.fill();
    zeichneMaus(sx, view.bodenY, s, { lauf: m.lief, schritt: m.schritt, stauch: m.stauch });
  }

  // Die Gegner als Geist (geist.js): eine Maus aus Licht.
  function zeichneGeister() {
    if (!gegner || state.phase === "bereit") return;
    const orte = window.LernappGeist?.orte?.(gegner) || [];
    if (!orte.length) return;
    const namen = [];
    orte.forEach((o) => {
      if (o.ziel) return;
      const x = o.a / 3;
      const sx = bildX(x - MAUS_MITTE);
      if (sx < -30 || sx > view.cssW + 30) return;
      zeichneMaus(sx, view.bodenY, view.s, { geist: o.farbe, alpha: 0.55 * o.blass, lauf: (o.c & 1) ? 1 : 0, schritt: x / 13 });
      namen.push({ ...o, sx, sy: view.bodenY - 20 * view.s });
    });
    window.LernappGeist.namen(g, namen, { breit: view.cssW, hoch: view.cssH });
  }

  // ---------------------------------------------------------------------------
  // Zeichnen: Dampf, Funken, Schrift
  // ---------------------------------------------------------------------------
  function zeichneDampf() {
    const s = view.s;
    const front = bildX(state.dampf);
    const gross = dampfBild.width / view.dpr;
    if (front < -gross * 0.4) {
      // Noch nicht im Bild: Der Rand wird heller, je näher er ihr ist.
      const nah = clamp((78 - (state.maus.x - state.dampf)) / 40, 0, 1);
      if (nah > 0.02 && state.phase !== "bereit") {
        g.globalAlpha = nah * (ruhig() ? 0.7 : 0.75 + 0.25 * Math.sin(state.zeit * 5));
        g.drawImage(randBild, 0, 0, randBild.width / view.dpr, randBild.height / view.dpr);
        g.globalAlpha = 1;
      }
      return;
    }
    // Dahinter ist alles weiss.
    const fest = front - gross * 0.3;
    if (fest > 0) {
      g.fillStyle = "#e9eeff";
      g.fillRect(0, 0, fest, view.bodenY);
    }
    const t = ruhig() ? 0 : state.zeit;
    const hoch = view.bodenU;
    for (let i = 0; i * 34 < hoch + 20; i += 1) {
      const y = i * 34 + 8;
      const vor = Math.sin(t * 1.7 + i * 1.9) * 7 + Math.sin(t * 3.1 + i * 0.7) * 3 - (i % 2) * 9;
      g.drawImage(dampfBild, front + vor * s - gross * 0.62, bildY(y) - gross / 2, gross, gross);
    }
    // Am Boden kriecht er voraus.
    g.globalAlpha = 0.7;
    g.drawImage(dampfBild, front - gross * 0.25 + Math.sin(t * 2.3) * 5 * s, view.bodenY - gross * 0.62, gross, gross);
    g.globalAlpha = 1;
  }

  function zeichneTeile() {
    if (!state.teile.length) return;
    const s = view.s;
    state.teile.forEach((t) => {
      const k = clamp(t.leben / t.max, 0, 1);
      if (t.art === "staub") {
        g.globalAlpha = k * 0.4;
        g.fillStyle = "#cfc6e0";
        g.beginPath();
        g.arc(bildX(t.x), bildY(t.y), Math.max(0.6, t.r * s * (1.7 - k)), 0, Math.PI * 2);
        g.fill();
        return;
      }
      g.globalAlpha = Math.min(1, k * 1.6);
      g.fillStyle = k > 0.6 ? "#fff3c2" : k > 0.3 ? "#ffb347" : "#ff5a22";
      const r = Math.max(1.2, t.r * s);
      g.fillRect(bildX(t.x) - r / 2, bildY(t.y) - r / 2, r, r);
      // Der Schweif: noch ein Punkt, wo der Funke eben war.
      g.fillRect(bildX(t.x - t.vx * 0.018) - r / 2, bildY(t.y - t.vy * 0.018) - r / 2, r * 0.8, r * 0.8);
    });
    g.globalAlpha = 1;
  }

  // Glut, die durch die Halle treibt – auch vor dem Start.
  const FLOCKEN = Array.from({ length: 26 }, (_, i) => ({
    x: hash01(i * 2.9 + 4), y: hash01(i * 6.1 + 7), v: 0.02 + hash01(i * 4.7) * 0.05, w: hash01(i * 1.3) * 6,
  }));

  function zeichneGlut() {
    if (ruhig()) return;
    const W = view.cssW;
    const H = view.bodenY;
    g.fillStyle = "#ffb95a";
    FLOCKEN.forEach((f) => {
      const y = mod(f.y - state.zeit * f.v, 1);
      const x = mod(f.x + Math.sin(state.zeit * 0.6 + f.w) * 0.03 - (state.camX * view.s * 0.7) / W, 1);
      g.globalAlpha = (0.35 + 0.4 * Math.sin(state.zeit * 3 + f.w)) * Math.min(1, y * 3);
      g.fillRect(x * W, y * H, 2, 2);
    });
    g.globalAlpha = 1;
  }

  function zeichneSchriften() {
    if (!state.schriften.length) return;
    g.textAlign = "center";
    g.textBaseline = "middle";
    state.schriften.forEach((t) => {
      const k = clamp(t.leben / t.max, 0, 1);
      const gross = Math.round(clamp(t.gross * view.s * 0.5, 13, 28));
      g.font = `900 ${gross}px system-ui, sans-serif`;
      const halb = g.measureText(t.text).width / 2 + 8;
      const x = clamp(bildX(state.maus.x), halb, view.cssW - halb);
      const y = view.bodenY - (30 + (1 - k) * 12) * view.s;
      g.globalAlpha = Math.min(1, k * 2.4);
      g.lineWidth = Math.max(3, gross * 0.22);
      g.strokeStyle = "rgba(10, 8, 26, 0.9)";
      g.strokeText(t.text, x, y);
      g.fillStyle = t.farbe;
      g.fillText(t.text, x, y);
    });
    g.globalAlpha = 1;
  }

  function zeichnen() {
    if (!g || !wandBild) return;
    // Beim Schlag bebt das Bild – ein, zwei Punkte, kurz.
    const beben = ruhig() ? 0 : state.stoss;
    const dx = Math.round(Math.sin(state.zeit * 83) * 1.6 * beben * view.dpr);
    const dy = Math.round(Math.cos(state.zeit * 67) * 2.6 * beben * view.dpr);
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalAlpha = 1;
    zeichneWand(dx, dy);
    zeichneBoden(dx, dy);
    g.setTransform(view.dpr, 0, 0, view.dpr, dx, dy);
    zeichneRaeder();
    zeichneFeuer();
    zeichneHaemmer();
    zeichneGeister();
    zeichneFigur();
    zeichneTeile();
    zeichneGlut();
    zeichneDampf();
    zeichneSchriften();
  }

  // ---------------------------------------------------------------------------
  // Was aufstiebt
  // ---------------------------------------------------------------------------
  function funken(x, n, kraft) {
    if (ruhig()) return;
    for (let i = 0; i < n; i += 1) {
      const seite = Math.random() < 0.5 ? -1 : 1;
      const leben = 0.3 + Math.random() * 0.55;
      state.teile.push({
        art: "funke", x: x + seite * (KOPF - 2 + Math.random() * 3), y: 1.5,
        vx: seite * (30 + Math.random() * 130) * kraft, vy: (40 + Math.random() * 170) * kraft,
        r: 0.9 + Math.random() * 0.7, leben, max: leben,
      });
    }
    if (state.teile.length > 150) state.teile.splice(0, state.teile.length - 150);
  }

  function staub(x, n, richtung) {
    if (ruhig()) return;
    for (let i = 0; i < n; i += 1) {
      const leben = 0.3 + Math.random() * 0.3;
      state.teile.push({
        art: "staub", x: x - richtung * 4, y: 1 + Math.random() * 2,
        vx: -richtung * (10 + Math.random() * 26), vy: 6 + Math.random() * 14,
        r: 1.2 + Math.random() * 1.2, leben, max: leben,
      });
    }
  }

  function schrift(text, farbe, gross) {
    state.schriften = [{ text, farbe, gross, leben: 0.75, max: 0.75 }];
  }

  // ---------------------------------------------------------------------------
  // Laufen, durchkommen, getroffen werden
  // ---------------------------------------------------------------------------
  function durch(h) {
    state.naechster = h.nr + 1;
    if (state.phase !== "spiel") return;
    state.punkte += 1;
    shell.setCount(state.punkte);
    const rest = h.offen - phaseBei(h, state.uhr);
    if (h.frueh) {
      state.perfekte += 1;
      klang()?.ton?.("stampfwerk.perfekt", { hoehe: 1 + Math.min(8, state.perfekte - 1) * 0.035 });
      schrift("Perfekt!", "#ffe08a", 44);
      kids()?.vibrate?.(10);
    } else if (rest < KNAPP) {
      state.knappe += 1;
      klang()?.ton?.("stampfwerk.perfekt", { hoehe: 0.8 });
      schrift("Haarscharf!", "#ff9d6a", 44);
      kids()?.vibrate?.(10);
    } else {
      klang()?.ton?.("stampfwerk.durch", { laut: 0.6 });
    }
  }

  function treffer(warum, h = null, nurBild = false) {
    if (state.schritt === "aus") return;
    const m = state.maus;
    state.schritt = "aus";
    state.halten = false;
    state.aus = { warum, x: m.x, y: 0, vx: warum === "gelaufen" ? -70 : -34, vy: warum === "dampf" ? 0 : 150, dreh: 0, weg: 0, hammer: h };
    state.stoss = warum === "dampf" ? 0.3 : 1;
    klangAus();
    if (warum === "dampf") {
      klang()?.ton?.("stampfwerk.zisch");
      kids()?.vibrate?.([20, 30, 40]);
    } else {
      klang()?.ton?.("stampfwerk.treffer");
      kids()?.vibrate?.([30, 40, 60]);
      funken(m.x, 16, 1.2);
      staub(m.x, 8, 0);
    }
    if (nurBild) return;
    stepTimer = window.setTimeout(finish, ruhig() ? 500 : ENDE_MS);
  }

  function ausTakt(dt) {
    const f = state.aus;
    if (!f) return;
    if (f.warum === "dampf") {
      f.weg = Math.min(1, f.weg + dt * 2.4);
      // Der Dampf zieht noch ein Stück über sie hinweg.
      state.dampf += 60 * dt * (1 - f.weg);
      return;
    }
    f.vy -= 520 * dt;
    f.x += f.vx * dt;
    f.y += f.vy * dt;
    f.dreh -= 7 * dt;
    if (f.y < 0) {
      f.y = 0;
      f.vy = f.vy < -80 ? -f.vy * 0.35 : 0;
      f.vx *= 0.5;
      if (f.vy === 0) f.dreh = Math.PI;
    }
  }

  function physik(dt) {
    const m = state.maus;
    const liste = state.haemmer;
    const n = Math.max(1, Math.ceil(dt / TAKT - 1e-9));
    const h = dt / n;
    for (let i = 0; i < n; i += 1) {
      if (state.schritt === "aus") return;
      state.uhr += h;
      if (state.halten) m.x += TEMPO * h;
      // Unter welchen Hämmern steckt sie? Vom ersten an, unter dem sie noch
      // nicht durch ist – bei zweien und dreien können es mehrere sein.
      for (let j = state.naechster; j < liste.length; j += 1) {
        const hm = liste[j];
        if (m.x <= hm.x - ZONE) break;
        if (m.x >= hm.x + ZONE) {
          if (j === state.naechster) durch(hm);
          continue;
        }
        const offen = offenBei(hm, state.uhr);
        if (!hm.drin) {
          hm.drin = true;
          hm.zuBeiEintritt = !offen;
          hm.frueh = offen && phaseBei(hm, state.uhr) < PERFEKT;
        }
        if (!offen) {
          treffer(hm.zuBeiEintritt ? "gelaufen" : "getroffen", hm);
          return;
        }
      }
      // Der Dampf kommt – und bleibt nie weiter zurück als der Raum.
      state.dampf = Math.max(state.dampf + dampfBei(state.punkte) * h, m.x - raumBei(state.punkte));
      if (state.dampf >= m.x - 2) {
        treffer("dampf");
        return;
      }
    }
  }

  // Bis zu der Zeit rechnen, zu der gedrückt oder losgelassen wurde (jetzt,
  // wie performance.now) – mit dem, was bis dahin galt.
  function nachholen(jetzt) {
    if (!Number.isFinite(jetzt) || !last) return;
    const mehr = clamp((jetzt - last) / 1000 - voraus, 0, 0.05);
    if (mehr > 0) {
      physik(mehr);
      voraus += mehr;
    }
  }

  function druecken(jetzt) {
    if (state.phase === "zuschauen" || state.phase === "ende") return;
    if (state.phase === "bereit") {
      losGehts();
      state.halten = true;
      return;
    }
    if (state.phase !== "spiel" || state.schritt === "aus" || state.halten) return;
    nachholen(jetzt);
    if (state.schritt === "aus") return;
    state.halten = true;
    staub(state.maus.x, 3, 1);
  }

  function loslassen(jetzt) {
    if (!state.halten) return;
    if (state.phase === "spiel" && state.schritt !== "aus") nachholen(jetzt);
    state.halten = false;
    if (state.schritt !== "aus") {
      state.maus.stauch = 1;
      staub(state.maus.x + 6, 3, -1);
    }
  }

  // ---------------------------------------------------------------------------
  // Zuschauen
  // ---------------------------------------------------------------------------
  function zuschauenStarten() {
    if (!zuschauer?.lauf) return;
    startRun();
    state.phase = "zuschauen";
    shell.setPhase("play");
    zuschauer.los();
    klangAn();
  }

  // Die Aufzeichnung trägt den Ort der Maus (a) und die Spielzeit (b): Die
  // Hämmer stampfen zu dieser Zeit, also genau so, wie sie im Lauf standen.
  function zuschauenTakt(dt) {
    const s = zuschauer.stand();
    if (!s) return;
    const m = state.maus;
    if (state.schritt !== "aus") {
      const uhr = Math.max(0, s.b / 250);
      const schritt = Math.max(0, uhr - state.uhr);
      state.uhr = uhr;
      m.x = Math.max(m.x, s.a / 3);
      state.halten = s.va > 12;
      const liste = state.haemmer;
      while (state.naechster < liste.length && m.x >= liste[state.naechster].x + ZONE) state.naechster += 1;
      const punkte = Math.max(0, Math.floor(s.punkte));
      if (punkte !== state.punkte) {
        state.punkte = punkte;
        shell.setCount(punkte);
      }
      // Der Dampf folgt ihr, wie im Spiel.
      state.dampf = Math.min(m.x - 2, Math.max(state.dampf + dampfBei(state.punkte) * schritt, m.x - raumBei(state.punkte)));
      klangStellen();
    }
    if (!zuschauer.weiter() && state.schritt !== "aus") {
      const h = state.haemmer[state.naechster];
      const unter = h && m.x > h.x - ZONE;
      if (!unter) state.dampf = m.x;
      treffer(unter ? "getroffen" : "dampf", unter ? h : null, true);
    }
    if (state.schritt === "aus") ausTakt(dt);
  }

  // ---------------------------------------------------------------------------
  // Der Takt
  // ---------------------------------------------------------------------------
  // Die Schläge der Hämmer im Bild: Funken, Glut, Beben, Klang.
  function schlaege(dt) {
    const [a, b] = sichtbar();
    const liste = state.haemmer;
    const laeuft = state.phase !== "bereit" && state.uhr > ANLAUF;
    for (let i = a; i < b; i += 1) {
      const h = liste[i];
      h.glut = Math.max(0, h.glut - dt * 2.6);
      const zahl = Math.floor((state.uhr - h.off - h.offen - F1) / h.T);
      const neu = h.schlaege !== null && zahl > h.schlaege && laeuft;
      h.schlaege = zahl;
      if (!neu || state.schritt === "aus") continue;
      h.glut = 1;
      funken(h.x, 9, 1);
      const weit = Math.abs(h.x - state.maus.x);
      const nah = clamp(1 - weit / 190, 0, 1);
      state.stoss = Math.max(state.stoss, 0.25 + 0.5 * nah);
      if (nah > 0.05) klang()?.ton?.("stampfwerk.schlag", { laut: 0.25 + 0.6 * nah, hoehe: 0.86 + (h.nr % 5) * 0.045 });
    }
  }

  function takt(dt, strecke = dt) {
    state.zeit += dt;
    const m = state.maus;
    if (state.stoss > 0) state.stoss = Math.max(0, state.stoss - dt * 7);
    if (m.stauch > 0) m.stauch = Math.max(0, m.stauch - dt * 8);

    if (state.phase === "zuschauen") {
      zuschauenTakt(dt);
    } else if (state.schritt === "aus") {
      ausTakt(dt);
    } else if (state.phase === "spiel") {
      if (strecke > 0) physik(strecke);
      klangStellen();
    }
    // Wie sehr sie läuft – fürs Bild: Die Beine kommen rasch in Gang.
    const laeuft = state.halten && state.schritt !== "aus" && state.phase !== "bereit" && state.phase !== "ende";
    m.lief += ((laeuft ? 1 : 0) - m.lief) * (1 - Math.exp(-22 * dt));
    m.schritt += dt * 5.2 * m.lief;
    state.rad += dt * 0.7 * anlauf();
    schlaege(dt);

    for (let i = state.teile.length - 1; i >= 0; i -= 1) {
      const t = state.teile[i];
      if (t.art === "funke") {
        t.vy -= 430 * dt;
        if (t.y < 0.5 && t.vy < 0) { t.vy = -t.vy * 0.4; t.vx *= 0.6; }
      } else {
        t.vx *= 1 - 3 * dt;
      }
      t.x += t.vx * dt;
      t.y += t.vy * dt;
      t.leben -= dt;
      if (t.leben <= 0) state.teile.splice(i, 1);
    }
    for (let i = state.schriften.length - 1; i >= 0; i -= 1) {
      state.schriften[i].leben -= dt;
      if (state.schriften[i].leben <= 0) state.schriften.splice(i, 1);
    }

    // Die Kamera folgt ihr weich – ist sie getroffen, bleibt sie stehen.
    if (state.schritt !== "aus") {
      const ziel = camZiel();
      state.camX += (ziel - state.camX) * (1 - Math.exp(-(state.phase === "bereit" ? 30 : 9) * dt));
    }
    planBis(state.camX + view.w + 500);

    if (state.phase === "spiel" && state.schritt !== "aus") {
      gegner?.takt(state.punkte, { a: Math.round(m.x * 3), b: Math.round(state.uhr * 250), c: state.halten ? 1 : 0 });
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

  // Die Runde beginnt: mit dem ersten Druck (sie läuft gleich los) – oder im
  // Live-Modus zum gemeinsamen Start. Das Werk läuft an, der Dampf kommt.
  function losGehts() {
    if (state.phase !== "bereit") return;
    state.phase = "spiel";
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
    state.schritt = "lauf";
    state.punkte = 0;
    state.perfekte = 0;
    state.knappe = 0;
    state.uhr = 0;
    state.halten = false;
    state.maus = { x: START_X, lief: 0, schritt: 0, stauch: 0 };
    state.dampf = START_X - DAMPF_START;
    state.naechster = 0;
    state.aus = null;
    state.teile = [];
    state.schriften = [];
    state.zeit = 0;
    state.rad = 0;
    state.stoss = 0;
    finger.clear();
    kursNeu();
    voraus = 0;
    shell.setCount(0);
    gegner?.runde();

    shell.clear();
    const prompt = shell.el("p", "cm-prompt sm-prompt", "Halten – die Maus läuft. Loslassen – sie steht. Unter den Hämmern durch!");
    shell.play.append(prompt, buildPlatz());
    view.cssW = 0;
    view.cssH = 0;
    messen();
    state.camX = camZiel();

    last = performance.now();
    frame = window.requestAnimationFrame(loop);
  }

  function zaehleHoch(ziel) {
    const zahl = host.querySelector(".cm-result-score");
    if (!zahl) return;
    if (ruhig() || ziel <= 1) { zahl.textContent = String(ziel); return; }
    const dauer = Math.min(800, 160 + ziel * 14);
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

  const WARUM = { getroffen: "Vom Hammer getroffen", gelaufen: "In den Hammer gelaufen", dampf: "Vom Dampf eingeholt" };

  function finish() {
    clearStep();
    stopLoop();
    klangAus();
    if (state.phase === "ende") return;
    state.phase = "ende";
    state.halten = false;
    const punkte = state.punkte;
    const geist = gegner?.ende(punkte) || null;
    const vorher = Number(store.read()?.scores?.[0]) || 0;
    const rekord = punkte > vorher;
    store.update((old) => ({
      runs: (Number(old.runs) || 0) + 1,
      scores: [...(old.scores || []), punkte].sort((x, y) => y - x).slice(0, TOP_COUNT),
    }));
    const warum = WARUM[state.aus?.warum] || "";
    shell.showResult({
      label: "Deine Hämmer",
      points: punkte,
      detail: rekord ? "Neuer Rekord!" : `${warum ? `${warum} · ` : ""}${state.perfekte} perfekt · ${state.knappe} haarscharf`,
      geist,
    });
    if (rekord) host.querySelector(".cm-result-detail")?.classList.add("sm-rekord");
    zaehleHoch(punkte);
  }

  // ---------------------------------------------------------------------------
  // Start
  // ---------------------------------------------------------------------------
  shell = shellApi.mount({
    host,
    title: "Stampfwerk",
    area: "geschwindigkeit",
    accent: "#F5A623",
    accentDark: "#b9741a",
    clock: false,
    onRestart: () => (zuschauer ? zuschauenStarten() : startRun()),
    live: { los: losGehts, stopp: () => finish(), zuschauen: (quelle) => { zuschauer = quelle; zuschauenStarten(); }, halten: true },
  });
  zuschauer = window.LernappGeist?.zuschauer?.({
    host, spiel: "stampMill", fassung: "t1", zufall, einheit: "Hämmer", nochmal: zuschauenStarten,
  }) || null;
  if (!zuschauer) {
    gegner = window.LernappGeist?.fuer?.({ spiel: "stampMill", host, art: "tempo", alle: true, zufall }) || null;
  }

  startRun();
  zuschauer?.laden.then((da) => { if (da) zuschauenStarten(); });

  // Ein Finger irgendwo auf dem Bild: Sie läuft, solange er liegt. Nur
  // Knöpfe bleiben Knöpfe. Liegen zwei Finger, läuft sie, bis beide weg sind.
  const zeitVon = (event) => (Math.abs(performance.now() - event.timeStamp) < 250 ? event.timeStamp : performance.now());
  host.addEventListener("pointerdown", (event) => {
    if (event.target.closest("button, a, input")) return;
    finger.add(event.pointerId);
    druecken(zeitVon(event));
  });
  const hoch = (event) => {
    if (!finger.delete(event.pointerId)) return;
    if (finger.size === 0) loslassen(zeitVon(event));
  };
  window.addEventListener("pointerup", hoch);
  window.addEventListener("pointercancel", hoch);
  // Wer das Fenster verlässt, lässt auch los.
  window.addEventListener("blur", () => { finger.clear(); loslassen(performance.now()); });

  const TASTEN = new Set([" ", "Enter", "ArrowRight", "ArrowUp"]);
  document.addEventListener("keydown", (event) => {
    if (!TASTEN.has(event.key)) return;
    if (document.activeElement?.tagName === "BUTTON") return;
    event.preventDefault();
    if (event.repeat) return;
    finger.add(`taste ${event.key}`);
    druecken(performance.now());
  });
  document.addEventListener("keyup", (event) => {
    if (!finger.delete(`taste ${event.key}`)) return;
    if (finger.size === 0) loslassen(performance.now());
  });

  window.addEventListener("resize", messen);
  window.addEventListener("orientationchange", messen);
  window.addEventListener("pagehide", () => { clearStep(); stopLoop(); klangAus(); });

  // Für die Prüfskripte und die Vorführung.
  window.LernappStampfwerk = {
    TEMPO, ZONE, QUER, STAND, START_X, MAUS_H, PERFEKT, KNAPP, F0, state, view,
    takt, druecken, loslassen, losGehts, physik, planBis, kursText, phaseBei, offenBei, hoeheBei, luftBei, spielBei, dampfBei, raumBei,
  };
})();
