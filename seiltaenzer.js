/*
 * seiltaenzer.js – Seiltänzer.
 * ---------------------------------------------------------------------------
 * Hoch über der Tiefe ist ein Seil gespannt, von Mast zu Mast. Darauf geht
 * ein Seiltänzer mit einer langen Stange nach rechts – das Gehen besorgt er
 * selbst. Wer links aufs Bild hält, lehnt ihn nach links, wer rechts hält,
 * nach rechts; ohne Finger richtet er sich von selbst wieder auf (am Rechner
 * Pfeil links und rechts, A und D). Kippt er zu weit, fällt er ins Netz, und
 * die Runde ist vorbei.
 *
 * Das eigentliche Spiel sind die Störungen (Ereignisse), und man sieht jede
 * kommen:
 *
 *   Böe     Blätter, Staub, Papier oder Schnee ziehen vorher von ihrer
 *           Seite her durchs Bild, die Wimpel drehen sich, ein Pfeil steht
 *           am Rand – dann drückt sie ihn zur Seite.
 *   Vogel   Ein Vogel fliegt heran und landet auf einem Ende der Stange:
 *           Solange er sitzt, zieht er diese Seite hinunter. Wenn er
 *           auffliegt, ist das Gewicht auf einmal weg. Später kommen sie zu
 *           zweit – erst links, dann rechts, und einer fliegt zuerst.
 *   Ramme   Ein Vogel fliegt geradewegs auf ihn zu und prallt gegen ihn:
 *           ein Ruck zur anderen Seite, Federn fliegen.
 *
 * Ohne Gegenhalten wirft jede ihn um – wer zu lange gegenhält, kippt nach
 * der anderen Seite. Es zählt also, wann man drückt, auf welcher Seite und
 * wie lange. Dazu schwingt das Seil fern der Masten, und ein wenig stört der
 * eigene Schritt. Die erste Böe kommt nach gut zwei Sekunden, der erste
 * Vogel nach gut fünf; danach folgt eine Störung dicht auf die andere, es
 * wird schneller, und hinten kommen Böen paarweise, erst von der einen, dann
 * gleich von der anderen Seite – aber nie unfair: Nichts drückt stärker, als
 * die Stange gegenhalten kann.
 *
 * Bis November 2026 kippte er von allein wie ein Stab auf der Fingerspitze,
 * und Halten und Loslassen wirkten immer, nach rechts oder nach links. Das
 * war ein dauerndes Ausgleichen ohne lesbaren Moment; jetzt steht er, bis
 * etwas kommt.
 *
 * Gezählt wird nur eines: wie weit er kommt, in Metern. Unterwegs wechselt
 * die Welt – eine Schlucht im Abendrot, eine Stadt bei Nacht, Gipfel unter
 * dem Polarlicht, und wieder von vorn.
 *
 * Gebaut wird die Strecke aus dem Zufall (zufall.js): Spannweiten, Schwingen
 * und Störungen – ohne Turnier jedes Mal anders, im Turnier für alle im selben
 * Versuch gleich. Gewürfelt wird Spanne um Spanne in fester Reihenfolge, so
 * hängt die Strecke nicht davon ab, wie breit das Bild ist. Tempo und Schwere
 * hängen an der Strecke, nicht an der Uhr: Wer gleich weit kommt, hatte es
 * gleich schwer.
 *
 * Die Gegner (geist.js) gehen als Seiltänzer aus Licht mit – genau so, wie
 * sie in ihrer besten Runde gegangen sind. Platz 1 und die eigene Bestmarke
 * hängen dazu als Wimpel am Seil, bei ihren Metern. Überholt wird hier
 * niemand: Das Tempo hängt nur an der Strecke, alle gehen gleich schnell.
 * Die Schalter sagen deshalb nur, wie weit die Gegner gekommen sind
 * (gleichschritt). Und die besten Läufe lassen sich anschauen (?zuschauen=, geist.js): auf ihrem eigenen Seil,
 * gewürfelt mit derselben Saat.
 *
 * Gerechnet wird in Welteinheiten – zehn sind ein Meter, y zählt nach oben,
 * die Masten tragen das Seil auf der Höhe 0. Gezeichnet wird im Bild: Himmel,
 * Fernsicht und Wolken liegen fertig gemalt in Leinwänden im Speicher und
 * ziehen verschieden schnell vorbei; Seil, Masten und Figur entstehen in
 * jedem Bild neu.
 */
(() => {
  "use strict";

  if (document.body.dataset.page !== "rope") return;

  const host = document.querySelector("#st-stage");
  const shellApi = window.LernappGameShell;
  const cloudApi = window.LernappGameCloud;
  if (!host || !shellApi) return;

  const kids = () => window.LernappKids || null;
  const ruhig = () => Boolean(kids()?.prefersReducedMotion?.());
  const klang = () => window.ArcadeKlang || null;

  // Der Zufall. Ohne Turnier in der Adresse ist das Math.random; in einem
  // Turnier bekommt jeder im selben Versuch dasselbe Seil. Nur die Strecke
  // zieht daraus – Blätter, Funken und Sterne würfeln Math.random oder hängen
  // an einer festen Zahl, damit die Strecke nicht davon abhängt, wie jemand
  // geht.
  const zufall = window.LernappZufall?.fuer?.("ropeWalk") || {
    neu() {},
    zahl: () => Math.random(),
  };

  // ---------------------------------------------------------------------------
  // Die Welt
  // ---------------------------------------------------------------------------
  const WELT_W = 240;
  const WELT_W_MAX = 560;
  const SICHT_H = 260;
  const SEIL_AN = 0.38;            // so weit unter dem oberen Rand (des freien Bildes) hängt das Seil
  const LAEUFER_AN = 0.36;         // so weit vom linken Rand geht der Seiltänzer
  const METER = 10;
  const START = { x: 0, y: 0 };
  const SOCKEL = 120;              // so tief unter dem Seil stehen die Masten auf Fels, Dach oder Gipfel
  const NETZ = 90;                 // so tief hängt das Netz
  const MAST_OBEN = 18;
  const DURCHHANG = 0.03;          // so viel seiner Spannweite hängt das Seil in der Mitte durch
  const DELLE = 10;                // und unter dem Seiltänzer noch so viel mehr
  const SCHRITT = 18;              // ein Schritt, in Einheiten
  const SPANNE = [300, 400];       // Abstand der Masten, am Anfang und ganz hinten
  const SCHWING_BILD = 10;         // so weit schwingt das Seil im Bild, je Einheit Störung

  // Die Balance: ein Pendel, das sich von selbst aufrichtet – aber nur
  // schwach. Die Neigung θ (plus: nach rechts) folgt
  //
  //   θ'' = −AUFRICHT · sin θ + STANGE · p − DAEMPF · θ' + Störung,
  //
  // p folgt dem Finger in gut einer Achtelsekunde: −1 links, 0 ohne, +1
  // rechts. Weil STANGE stärker ist als das Aufrichten (STANGE / AUFRICHT
  // über sin KIPP_MAX), kippt auch, wer ohne Böe zu lange hält. Die Dämpfung
  // wird nach hinten schwächer, das Schwingen des Seils stärker.
  const TAKT = 1 / 240;            // gerechnet wird in festen kleinen Schritten
  const KIPP_MAX = 0.62;           // weiter geneigt, und er fällt (gut 35°)
  const V0 = 26;
  const V_MAX = 58;
  const V_WEG = 180;               // Meter, nach denen gut sechs Zehntel des Zuwachses da sind
  const SCHWER_WEG = 90;           // Meter, nach denen es gut sechs Zehntel so schwer ist wie ganz hinten
  const AUFRICHT = 1.6;
  const STANGE = 3;
  const DAEMPF = [2.2, 1.2];
  const STANGE_TEMPO = 8;
  const SCHRITT_STOSS = 0.1;
  const SCHWING = [0.1, 0.5];
  const SCHWING_HZ = 0.6;

  /*
   * Die Störungen liegen auf der Strecke wie die Masten: jede von x0 bis x1.
   * Zwischen zweien liegt eine Pause (ABSTAND, in Sekunden – nach hinten
   * kürzer). Gezählt wird für die Schwere nach Metern, für Längen und
   * Pausen nach Sekunden des Gehens: Wird er schneller, wird eine Böe nicht
   * länger.
   *
   * Böe: Ihre Kraft wirft jeden um, der nicht gegenhält (über AUFRICHT ·
   * sin KIPP_MAX), und ist gedeckelt: Die Stange behält gegen sie immer
   * BOE_RESERVE übrig. Später folgt einer Böe oft gleich eine von der
   * anderen Seite (DOPPEL).
   *
   * Vogel: Sein Gewicht am Ende der Stange (VOGEL_LAST) ist so gross wie
   * eine sanfte Böe – wer nicht gegenhält, kippt zu ihm hin; beim Landen und
   * beim Auffliegen gibt es einen kleinen Ruck. Ab PAAR_AB kommt manchmal
   * ein zweiter auf die andere Seite.
   *
   * Ramme: ein Ruck (RAMME_STOSS, in der Drehung um die Füsse) – so stark,
   * dass ihn ohne Gegenhalten wirft, wer nicht reagiert; wer ihn kommen
   * sieht, lehnt sich vorher hinein.
   */
  const STOER_AB = 55;             // so weit geht er ruhig (Einheiten): die erste Böe nach gut zwei Sekunden
  const ABSTAND = [1.2, 0.6];      // Sekunden Pause zwischen zwei Störungen: anfangs, hinten
  const BOE_KRAFT = [2, 2.6];
  const BOE_RESERVE = 0.4;
  const BOE_DAUER = [[2.3, 3], [1.5, 2.3]]; // so lang ist eine Böe (s): anfangs, hinten
  const DOPPEL_AB = 45;            // Meter, ab denen Doppelböen kommen …
  const DOPPEL = 0.5;              // … und wie oft höchstens
  const VOGEL_AB = 12;             // Meter: so früh landet der erste Vogel
  const VOGEL_LAST = [1.3, 1.8];
  const VOGEL_SITZT = [[2.4, 3.2], [1.5, 2.4]]; // so lange sitzt er (s)
  const VOGEL_LANDEN = 0.4;        // der Ruck beim Landen …
  const VOGEL_AUF = 0.25;          // … und beim Auffliegen
  const PAAR_AB = 55;              // Meter, ab denen manchmal zwei kommen
  const RAMME_AB = 26;             // Meter, ab denen ein Vogel ihn rammt
  const RAMME_STOSS = [1.5, 1.9];
  const RAMME_NACH = 1.3;          // so lange nach dem Aufprall zählt er noch (s)
  const VORWARNUNG = 1.3;          // Sekunden, die man eine Böe kommen sieht
  const ANFLUG = 1.4;              // so lange sieht man einen Vogel heranfliegen (s)
  const ZAHLEN_JE = 9;             // so viele Zahlen zieht jede Störung aus dem Zufall

  // Rückmeldung
  const KNAPP = 0.47;              // so schief – und doch gerettet: «knapp!»
  const PARIERT = 0.2;             // so wenig schief durch eine Störung: «pariert», die Reihe wächst
  // Ein Vogel, der landet, ruckt ein wenig; einen, der rammt, pariert nur,
  // wer sich vorher hineinlehnt.
  const PARIERT_JE = { vogel: 0.26, ramme: 0.42 };
  const LUPE = 0.35;               // so lange läuft die Zeit nach «knapp!» langsamer
  const LUPE_TEMPO = 0.5;
  const LUFT_MAX = 120;
  const PIXEL_MAX = 2.4e6;

  const TOP_COUNT = 5;
  const store = cloudApi
    ? cloudApi.register({ key: "lernapp.seiltaenzer", empty: { runs: 0, scores: [] }, merge: cloudApi.mergeScores(TOP_COUNT) })
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
  const glatt = (k) => k * k * (3 - 2 * k);
  const meterBei = (x) => Math.max(0, (x - START.x) / METER);
  const tempoBei = (x) => V0 + (V_MAX - V0) * (1 - Math.exp(-meterBei(x) / V_WEG));
  // Wie schwer es an dieser Stelle ist: anfangs fast nichts, nach hinten
  // immer mehr – nie ganz.
  const schwereBei = (x) => 1 - Math.exp(-meterBei(x) / SCHWER_WEG);
  const daempf = (k) => lerp(DAEMPF[0], DAEMPF[1], k);
  const schwing = (k) => lerp(SCHWING[0], SCHWING[1], k);

  // Immer dieselbe Zahl zu derselben Eingabe: Fenster, Sterne und Felsen
  // stehen bei jedem Bild am selben Platz, ohne den Zufall der Strecke
  // anzufassen.
  function hash01(n) {
    const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return x - Math.floor(x);
  }

  // Eine Zahlenfolge zum Malen der Landschaften – fest je Landschaft.
  function folge(saat) {
    let s = Math.floor(saat) % 2147483646 + 1;
    return () => {
      s = (s * 16807) % 2147483647;
      return (s - 1) / 2147483646;
    };
  }

  // ---------------------------------------------------------------------------
  // Die Landschaften
  // ---------------------------------------------------------------------------
  // Alle ETAPPE Meter wechselt die Welt, über die letzten UEBERGANG Meter
  // hinweg. Die Stellen im Himmelsverlauf zählen vom oberen Rand (0) über
  // das Seil (1) bis zum unteren Rand (2).
  const ETAPPE = 160;
  const UEBERGANG = 30;
  const ZONEN = [
    {
      name: "Schlucht im Abendrot",
      himmel: [[0, "#1d1040"], [0.55, "#4a1f62"], [0.9, "#93366e"], [1.15, "#d4566c"], [1.45, "#f58a5e"], [1.75, "#ffc278"], [2, "#ffd99a"]],
      seil: "#2a140e", seilLicht: "#ffc48a", netz: "255, 226, 200",
      wolkeHell: "#ffcfa8", wolkeDunkel: "#c25e7e", wolken: 0.55,
      luft: ["#e88a3a", "#c95a2a", "#f4c050"], luftArt: "blatt",
      wimpel: ["#ff5a4a", "#ffd166"], schrift: "#ffd27a", mast: "holz",
    },
    {
      name: "Stadt bei Nacht",
      himmel: [[0, "#03061a"], [0.6, "#0a1236"], [1, "#151d4c"], [1.5, "#2a2462"], [2, "#5a2c6c"]],
      seil: "#0d0d1c", seilLicht: "#8ff6ff", netz: "180, 230, 255",
      wolkeHell: "#5a4f96", wolkeDunkel: "#241f50", wolken: 0.35,
      luft: ["#f2f2ff", "#ffd36b", "#8fe8ff"], luftArt: "papier",
      wimpel: ["#ff4fd8", "#4ff3ff"], schrift: "#8ff6ff", mast: "stahl",
    },
    {
      name: "Gipfel im Polarlicht",
      himmel: [[0, "#010a12"], [0.6, "#03192a"], [1, "#062b3c"], [1.5, "#0b3f4e"], [2, "#15585f"]],
      seil: "#0e1e28", seilLicht: "#a8ffd8", netz: "200, 255, 235",
      wolkeHell: "#eafcff", wolkeDunkel: "#7fb3c4", wolken: 1,
      luft: ["#ffffff", "#d8f6ff", "#bff0ff"], luftArt: "flocke",
      wimpel: ["#3a7bff", "#ffffff", "#ff4a4a", "#38c172", "#ffd23f"], schrift: "#a8ffd8", mast: "holz",
    },
  ];

  const etappe = { n: 0, a: 0, b: 1, k: 0, rest: 0 };
  function etappeBei(x) {
    const m = meterBei(x);
    const n = Math.floor(m / ETAPPE);
    etappe.n = n;
    etappe.rest = m - n * ETAPPE;
    etappe.a = n % ZONEN.length;
    etappe.b = (n + 1) % ZONEN.length;
    etappe.k = clamp((etappe.rest - (ETAPPE - UEBERGANG)) / UEBERGANG, 0, 1);
    return etappe;
  }
  const zoneVon = (x) => Math.floor(meterBei(x) / ETAPPE) % ZONEN.length;
  // Wie stark eine Landschaft gerade zu sehen ist (0 … 1).
  const gewicht = (e, z) => (z === e.a ? 1 - e.k : 0) + (z === e.b ? e.k : 0);

  // ---------------------------------------------------------------------------
  // Zustand
  // ---------------------------------------------------------------------------
  // phase:   "bereit" (noch nichts gedrückt), "spiel", "zuschauen", "ende"
  // schritt: "start", "lauf", "sturz"
  const state = {
    phase: "bereit",
    schritt: "start",
    punkte: 0,            // dasselbe wie meter – die Strecke ist die Punktzahl
    meter: 0,
    l: { x: START.x, y: START.y, th: 0, w: 0, p: 0, v: 0 },
    gang: 0,              // gegangene Schritte
    geht: 0,              // 0 steht, 1 geht – fürs Bild
    schwing: 0,           // die Phase, in der die Seile schwingen
    welt: { masten: [], ereignisse: [], naechstes: 0, doppel: 0, vorher: "" },
    ereignis: 0,          // die laufende oder nächste Störung
    spanne: null,         // die Spanne unter dem Seiltänzer
    wind: { warn: 0, wirkt: 0, dir: 0, rel: 0 },
    fahne: -0.3,          // so wehen die Wimpel (−1 nach links … +1 nach rechts)
    camX: 0,
    camY: 0,
    camBasis: 0,
    camFall: 0,
    rolle: 0,
    sturz: null,
    netz: null,
    delle: 1,
    teile: [],
    luft: [],
    luftKonto: 0,
    schriften: [],
    stoss: 0,
    zeit: 0,
    echt: 0,
    sturzZeit: 0,
    sturzGrund: "",       // woran es lag: "gehalten", die Art der Störung oder ""
    lupe: 0,
    knapp: false,
    knappZeit: -9,
    ruheN: 0,             // Störungen hintereinander pariert
    ereignisMax: 0,       // wie schief er in der laufenden Störung schon stand
    ereignisIn: -1,       // in welcher Störung er zuletzt stand
    gesehen: -1,          // bis zu welcher Stelle Federn, Ruck und Klang schon kamen
    glanz: 0,
    gefahr: 0,
    gekippt: 0,
    etappe: 0,
    etappeZeit: -9,
    blick: 0,
  };

  let shell = null;
  let feld = null;
  let canvas = null;
  let g = null;
  let frame = null;
  let last = 0;
  let stepTimer = null;
  // Wohin gelehnt wird: −1 links, 0 gar nicht, +1 rechts. Dazu die Finger
  // (und Tasten), die gerade aufliegen – liegen zwei auf, gilt der zuletzt
  // gekommene.
  let lehne = 0;
  const finger = [];
  let knoepfe = null;
  // Die Gegner (geist.js): wer als Geist mitgeht und als Wimpel am Seil hängt.
  let gegner = null;
  // Wer einen Lauf anschaut statt zu gehen (geist.js, zuschauer).
  let zuschauer = null;

  const view = { s: 1, dpr: 1, cssW: 0, cssH: 0, w: WELT_W, h: SICHT_H, nutz: SICHT_H, frei: 0 };

  function clearStep() {
    if (stepTimer) { window.clearTimeout(stepTimer); stepTimer = null; }
  }

  function stopLoop() {
    if (frame) { window.cancelAnimationFrame(frame); frame = null; }
  }

  // ---------------------------------------------------------------------------
  // Klänge (klang.js)
  // ---------------------------------------------------------------------------
  // Leise Schritte auf dem Seil, Böen, die man kommen hört, der Absturz –
  // beim Zuschauen wie beim Spielen. Was dicht kommen kann, hat eine
  // Mindestpause in echter Zeit (die Prüfskripte rechnen viele Bilder am
  // Stück).
  let schrittGezaehlt = 0;
  let schrittZuletzt = -1e9;
  let boeGehoert = -1;

  // Ein Schritt je ganzem Gang, leise.
  function schrittKlang() {
    const n = Math.floor(state.gang);
    if (n === schrittGezaehlt) return;
    schrittGezaehlt = n;
    const jetzt = performance.now();
    if (jetzt - schrittZuletzt < 120) return;
    schrittZuletzt = jetzt;
    klang()?.ton("seiltaenzer.schritt", { laut: 0.45 });
  }

  // Die Böe schwillt an, kurz bevor sie drückt – wie man sie an den Blättern
  // kommen sieht. Je mehr sie der Stange abverlangt, desto lauter.
  function boeKlang() {
    const w = state.wind;
    if (boeGehoert === state.ereignis || !w.dir || (w.warn < 0.45 && w.wirkt <= 0)) return;
    boeGehoert = state.ereignis;
    klang()?.ton("seiltaenzer.boee", { laut: 0.6 + 0.6 * w.rel });
  }

  // «Pariert ×n»: die Harfe – nur das erste Mal in Folge.
  function ruheKlang(n) {
    if (n === 1) klang()?.ton("perfekt", { laut: 0.8 });
  }

  // ---------------------------------------------------------------------------
  // Die Strecke
  // ---------------------------------------------------------------------------
  /*
   * Masten im Abstand einer Spanne; jede Spanne hat ihre eigene Phase, in
   * der sie schwingt. Die Störungen liegen auf der Strecke wie die Masten:
   * von x0 bis x1, mit Richtung (dir: +1 drückt nach rechts) und Kraft (G).
   * Gewürfelt wird Spanne um Spanne – erst die Spanne, dann die Störungen,
   * die in ihr beginnen –, immer in derselben Reihenfolge und je Störung
   * immer ZAHLEN_JE Zahlen.
   */
  function neueSpanne() {
    const w = state.welt;
    const a = w.masten[w.masten.length - 1];
    const k = schwereBei(a.x);
    a.L = Math.round(lerp(SPANNE[0], SPANNE[1], k) * (0.85 + 0.3 * zufall.zahl()));
    a.phase = zufall.zahl() * Math.PI * 2;
    const b = { x: a.x + a.L, L: 0, phase: 0, i: w.masten.length };
    w.masten.push(b);
    while (w.naechstes < b.x) neuesEreignis();
  }

  // Wirft eine Böe (Kraft G, so viele Sekunden, Dämpfung c) einen um, der
  // nicht gegenhält? Nachgerechnet wie in physik, ohne Seil und Schritt.
  function boeWirft(G, dauer, c) {
    let th = 0;
    let w = 0;
    const h = 1 / 240;
    for (let t = 0; t < dauer + 1; t += h) {
      const s = t < dauer ? Math.sin((Math.PI * t) / dauer) : 0;
      w += (-AUFRICHT * Math.sin(th) - c * w + G * s * s) * h;
      th += w * h;
      if (th > KIPP_MAX) return true;
    }
    return false;
  }

  // Sekunden des Gehens ab der Stelle x in Einheiten (über die kurze Strecke
  // ändert sich das Tempo kaum).
  const strecke = (x, sekunden) => sekunden * tempoBei(x);

  // Was als Nächstes kommt: eine Böe – die erste immer –, ein Vogel, der
  // landet – der zweite immer – oder ein Vogel, der rammt.
  function neuesEreignis() {
    const w = state.welt;
    const x0 = w.naechstes;
    const m = meterBei(x0);
    const k = schwereBei(x0);
    const z = [];
    for (let i = 0; i < ZAHLEN_JE; i += 1) z.push(zufall.zahl());
    const nr = w.ereignisse.length;
    let art = "boe";
    if (w.doppel) art = "boe";
    else if (nr === 1 && m >= VOGEL_AB - 8) art = "vogel";
    else if (nr > 1) {
      const wahl = [["boe", 3]];
      if (m >= VOGEL_AB) wahl.push(["vogel", 2.4]);
      if (m >= RAMME_AB) wahl.push(["ramme", 1.6]);
      // Nicht zweimal dasselbe (ausser Böen).
      for (const e of wahl) if (e[0] === w.vorher && e[0] !== "boe") e[1] *= 0.25;
      let los = z[5] * wahl.reduce((summe, e) => summe + e[1], 0);
      for (const [name, gewicht] of wahl) {
        art = name;
        los -= gewicht;
        if (los <= 0) break;
      }
    }
    const e = { art, x0, x1: x0, dir: z[2] < 0.5 ? -1 : 1, G: 0, doppelt: false };
    if (art === "boe") {
      let dauer = lerp(lerp(BOE_DAUER[0][0], BOE_DAUER[1][0], k), lerp(BOE_DAUER[0][1], BOE_DAUER[1][1], k), z[0]);
      e.G = Math.min(STANGE - BOE_RESERVE, lerp(BOE_KRAFT[0], BOE_KRAFT[1], k) * (0.88 + 0.12 * z[1]));
      // Lang genug, dass sie umwirft, wer nicht gegenhält – nachgerechnet.
      while (!boeWirft(e.G, dauer, daempf(k)) && dauer < 4) dauer += 0.1;
      e.x1 = x0 + strecke(x0, dauer);
      e.doppelt = w.doppel !== 0;
      if (e.doppelt) e.dir = -w.doppel;
    } else if (art === "vogel") {
      // Einer landet auf dem Ende der Stange (dir: auf welchem) – manchmal
      // ein zweiter auf dem anderen. Wer zuerst kam, fliegt zuerst.
      e.G = Math.min(STANGE - BOE_RESERVE, lerp(VOGEL_LAST[0], VOGEL_LAST[1], k) * (0.92 + 0.16 * z[1]));
      const sitzt = lerp(lerp(VOGEL_SITZT[0][0], VOGEL_SITZT[1][0], k), lerp(VOGEL_SITZT[0][1], VOGEL_SITZT[1][1], k), z[0]);
      e.voegel = [{ an: x0, ab: x0 + strecke(x0, sitzt), seite: e.dir, nr: Math.floor(z[6] * 1000) }];
      if (m >= PAAR_AB && z[7] < 0.55 * k) {
        const an = x0 + strecke(x0, lerp(0.8, 1.3, z[8]));
        const ab = e.voegel[0].ab + strecke(x0, lerp(0.9, 1.4, z[3]));
        e.voegel.push({ an, ab: Math.max(ab, an + strecke(x0, 1.4)), seite: -e.dir, nr: Math.floor(z[6] * 1000) + 7 });
      }
      e.x1 = Math.max(...e.voegel.map((v) => v.ab));
      e.stoesse = [];
      for (const v of e.voegel) {
        e.stoesse.push(
          { x: v.an - strecke(v.an, 0.8), w: 0, art: "anflug", seite: v.seite },
          { x: v.an, w: v.seite * VOGEL_LANDEN, art: "landen", seite: v.seite },
          { x: v.ab, w: v.seite * VOGEL_AUF, art: "auf", seite: v.seite },
        );
      }
      e.stoesse.sort((p, q) => p.x - q.x);
    } else {
      // Ramme. dir: wohin der Ruck ihn wirft – der Vogel kommt von der anderen Seite.
      e.G = lerp(RAMME_STOSS[0], RAMME_STOSS[1], k) * (0.96 + 0.08 * z[1]);
      e.x1 = x0 + strecke(x0, RAMME_NACH);
      e.hoehe = lerp(-0.4, 0.4, z[0]);
      e.stoesse = [{ x: x0 - strecke(x0, 0.9), w: 0, art: "anflug", seite: -e.dir }, { x: x0, w: e.dir * e.G, art: "ramme", seite: -e.dir }];
    }
    w.ereignisse.push(e);
    w.vorher = art;
    // Folgt gleich eine zweite Böe, von der anderen Seite? Nie eine dritte.
    const pDoppel = art !== "boe" || m < DOPPEL_AB ? 0 : DOPPEL * k;
    w.doppel = !e.doppelt && z[4] < pDoppel ? e.dir : 0;
    const pause = w.doppel ? lerp(0.25, 0.7, z[3]) : lerp(ABSTAND[0], ABSTAND[1], k) * (0.75 + 0.5 * z[3]);
    w.naechstes = e.x1 + strecke(e.x1, pause);
  }

  function weltBis(x) {
    const ms = state.welt.masten;
    while (ms[ms.length - 1].x < x) neueSpanne();
  }

  // Die Spanne, über der x liegt (links vom Start: die erste).
  function spanneBei(x) {
    const ms = state.welt.masten;
    weltBis(x + 1);
    if (x <= ms[0].x) return ms[0];
    let lo = 0;
    let hi = ms.length - 2;
    while (lo < hi) {
      const mitte = (lo + hi + 1) >> 1;
      if (ms[mitte].x <= x) lo = mitte;
      else hi = mitte - 1;
    }
    return ms[lo];
  }

  // Das Seil: durchgehängt wie eine Kette, schwingend – fern der Masten mehr –
  // und unter dem Seiltänzer eingedellt, im Takt seiner Schritte.
  function seilYIn(sp, x) {
    const u = clamp((x - sp.x) / sp.L, 0, 1);
    let y = -DURCHHANG * sp.L * 4 * u * (1 - u);
    y -= SCHWING_BILD * schwing(schwereBei(sp.x)) * Math.sin(state.schwing + sp.phase) * Math.sin(Math.PI * u);
    if (sp === state.spanne && state.delle !== 0) {
      const uw = clamp((state.l.x - sp.x) / sp.L, 0, 1);
      const tief = DELLE * 4 * uw * (1 - uw) * state.delle * (1 + 0.1 * Math.abs(Math.sin(Math.PI * state.gang)));
      y -= tief * (u < uw ? u / Math.max(uw, 1e-3) : (1 - u) / Math.max(1 - uw, 1e-3));
    }
    return y;
  }

  const seilY = (x) => seilYIn(spanneBei(x), x);

  // Das Netz: tiefer, weicher durchgehängt, und wo der Seiltänzer hineinfällt,
  // federt es nach.
  function netzY(x) {
    const sp = spanneBei(x);
    const u = clamp((x - sp.x) / (sp.L || 1), 0, 1);
    let y = -NETZ - 0.045 * sp.L * 4 * u * (1 - u);
    const n = state.netz;
    if (n) {
      const t = state.zeit - n.zeit;
      const nah = Math.exp(-(((x - n.x) / 42) ** 2));
      y -= nah * (n.tiefe * Math.exp(-t * 2.6) * Math.cos(t * 13) + (state.sturz?.liegt ? 7 : 0));
    }
    return y;
  }

  // Wie stark eine Störung an der Stelle x drückt (plus: nach rechts). Der
  // Ruck einer Ramme und beim Landen kommt nicht hier, sondern auf einmal
  // (stoesse, in physik).
  function kraftVon(e, x) {
    if (!e || x < e.x0 || x > e.x1) return 0;
    const u = (x - e.x0) / (e.x1 - e.x0 || 1);
    if (e.art === "boe") {
      const s = Math.sin(Math.PI * u);
      return e.dir * e.G * s * s;
    }
    if (e.art === "vogel") {
      let d = 0;
      for (const v of e.voegel) if (x >= v.an && x < v.ab) d += v.seite * e.G;
      return d;
    }
    return 0;
  }

  // Was den Seiltänzer gerade stört: die Störung, das Schwingen seiner
  // Spanne und sein Schritt – abwechselnd ein wenig nach links und rechts.
  function stoerung(x, k) {
    let d = kraftVon(state.welt.ereignisse[state.ereignis], x);
    const sp = state.spanne;
    if (sp && sp.L) {
      const u = clamp((x - sp.x) / sp.L, 0, 1);
      d += schwing(k) * Math.sin(state.schwing + sp.phase) * Math.sin(Math.PI * u);
    }
    d += SCHRITT_STOSS * Math.sin(Math.PI * state.gang);
    return d;
  }

  // ---------------------------------------------------------------------------
  // Die Fläche
  // ---------------------------------------------------------------------------
  function buildPlatz() {
    const platz = shell.el("div", "st-platz");
    feld = shell.el("div", "st-feld");
    canvas = document.createElement("canvas");
    canvas.className = "st-canvas";
    canvas.setAttribute("aria-hidden", "true");
    feld.append(canvas);
    g = canvas.getContext("2d");

    // Die zwei Knöpfe unten links und rechts, wie im Slalom: Gedrückt wird
    // die ganze Hälfte des Bildes, die Knöpfe zeigen nur, wo, und leuchten,
    // solange ein Finger darauf liegt. Vor dem ersten Druck pulsieren sie.
    knoepfe = shell.el("div", "st-knoepfe");
    knoepfe.setAttribute("aria-hidden", "true");
    const ns = "http://www.w3.org/2000/svg";
    [-1, 1].forEach((seite) => {
      const knopf = shell.el("span", `st-knopf ${seite < 0 ? "st-knopf-l" : "st-knopf-r"}`);
      const svg = document.createElementNS(ns, "svg");
      svg.setAttribute("viewBox", "0 0 24 24");
      const pfeil = document.createElementNS(ns, "path");
      pfeil.setAttribute("d", seite < 0 ? "M14.5 5.5 8 12l6.5 6.5" : "M9.5 5.5 16 12l-6.5 6.5");
      pfeil.setAttribute("fill", "none");
      pfeil.setAttribute("stroke", "currentColor");
      pfeil.setAttribute("stroke-width", "3");
      pfeil.setAttribute("stroke-linecap", "round");
      pfeil.setAttribute("stroke-linejoin", "round");
      svg.append(pfeil);
      knopf.append(svg);
      knoepfe.append(knopf);
    });
    feld.append(knoepfe);
    platz.append(feld);
    return platz;
  }

  function messen() {
    if (!canvas || !feld) return;
    const cssW = Math.max(80, feld.clientWidth);
    const cssH = Math.max(80, feld.clientHeight);
    // Höchstens PIXEL_MAX Bildpunkte: Auf einem grossen, dichten Bildschirm
    // wird die Leinwand etwas weicher, aber nicht langsamer.
    const dpr = Math.max(1, Math.min(clamp(window.devicePixelRatio || 1, 1, 2.5), Math.sqrt(PIXEL_MAX / (cssW * cssH))));
    // Auf dem Handy reicht die Leinwand unter die Knöpfe oben (game-shell.js,
    // frei). Gemalt wird dort auch – aber was zählt, steht darunter.
    const frei = Math.min(cssH * 0.4, shell?.frei?.(canvas) || 0);
    if (cssW === view.cssW && cssH === view.cssH && dpr === view.dpr && frei === view.frei) return;
    view.cssW = cssW;
    view.cssH = cssH;
    view.dpr = dpr;
    view.frei = frei;
    const nutzH = cssH - frei;
    view.w = clamp(SICHT_H * (cssW / nutzH), WELT_W, WELT_W_MAX);
    // Seiltänzer und ein Stück Tiefe stehen immer ganz im Bild; ist es dafür
    // zu flach, steht mehr Seil voraus.
    view.s = Math.min(cssW / view.w, nutzH / SICHT_H);
    view.w = cssW / view.s;
    view.h = cssH / view.s;
    view.nutz = nutzH / view.s;
    const pw = Math.round(cssW * dpr);
    const ph = Math.round(cssH * dpr);
    if (canvas.width !== pw) canvas.width = pw;
    if (canvas.height !== ph) canvas.height = ph;
    // Das Seil (y = 0) hängt bei SEIL_AN des freien Bildes.
    state.camBasis = (seilSchirm() - cssH) / view.s;
    state.camY = state.camBasis + state.camFall;
  }

  // Wo das Seil im Bild hängt, ohne Kamerafahrt beim Sturz – danach richten
  // sich Horizont, Sonne und Wolken.
  const seilSchirm = () => view.frei + SEIL_AN * (view.cssH - view.frei);
  const ueberstand = () => Math.round(Math.max(view.cssW, view.cssH) * 0.05);

  const camXZiel = () => state.l.x - view.w * LAEUFER_AN;

  const wackelY = () => (ruhig() ? 0 : Math.sin(state.echt * 70) * 3 * state.stoss);
  const wackelX = () => (ruhig() ? 0 : Math.cos(state.echt * 53) * 2 * state.stoss);

  // Das Bild ohne alles: für die Anzeige.
  function flachTransform() {
    g.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
  }

  // Das Bild mit Kamerastoss: für Wind und Schriften.
  function bildTransform() {
    g.setTransform(view.dpr, 0, 0, view.dpr, wackelX() * view.dpr, wackelY() * view.dpr);
  }

  // Die nahe Welt: Sie neigt sich ein wenig mit dem Seiltänzer, um den
  // Punkt, an dem er geht – als kippte die Kamera mit.
  function szeneTransform() {
    const d = view.dpr;
    const c = Math.cos(state.rolle);
    const s = Math.sin(state.rolle);
    const px = view.cssW * LAEUFER_AN;
    const py = seilSchirm();
    g.setTransform(c * d, s * d, -s * d, c * d, (px - c * px + s * py + wackelX()) * d, (py - s * px - c * py + wackelY()) * d);
  }

  // Ein Punkt der Szene, wie er nach dem Neigen im Bild steht.
  function geneigt(sx, sy) {
    const c = Math.cos(state.rolle);
    const s = Math.sin(state.rolle);
    const px = view.cssW * LAEUFER_AN;
    const py = seilSchirm();
    return { x: c * (sx - px) - s * (sy - py) + px, y: s * (sx - px) + c * (sy - py) + py };
  }

  const bildX = (x) => (x - state.camX) * view.s;
  const bildY = (y) => view.cssH - (y - state.camY) * view.s;

  // ---------------------------------------------------------------------------
  // Die gemalten Landschaften
  // ---------------------------------------------------------------------------
  /*
   * Je Landschaft vier Leinwände: der Himmel (so gross wie das Bild, mit
   * Überstand für den Kamerastoss, die Fernsicht schon darin), die Mitte
   * (breiter als das Bild, nahtlos aneinanderzulegen) und eine Wolke. Gemalt
   * wird in höchstens gut 1.25-facher Auflösung (bildQ). Höchstens zwei
   * Landschaften liegen im Speicher; die nächste wird vor dem Übergang Stück
   * für Stück gemalt, eine Leinwand je Bild.
   */
  const bilder = { schluessel: "", zonen: [], glanz: null };
  // Die Auflösung der Leinwände im Speicher: höchstens etwa 1.25-fach, und
  // immer so, dass sie um einen ganzen Faktor vergrössert ins Bild kommen –
  // dann geht das ohne Glätten, und das ist viel schneller.
  const bildFaktor = () => Math.max(1, Math.round(view.dpr / 1.25));
  const bildQ = () => view.dpr / bildFaktor();
  const TEILE = ["himmel", "mitte", "wolke"];

  function leinwand(w, h) {
    const q = bildQ();
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.ceil(w * q));
    c.height = Math.max(1, Math.ceil(h * q));
    const cg = c.getContext("2d");
    cg.scale(q, q);
    return { c, g: cg, w, h };
  }

  function zonenBilder(z) {
    const schluessel = `${view.cssW}|${view.cssH}|${view.frei}|${bildQ()}`;
    if (bilder.schluessel !== schluessel) {
      bilder.schluessel = schluessel;
      bilder.zonen = [];
    }
    if (!bilder.zonen[z]) bilder.zonen[z] = { himmel: null, fern: null, mitte: null, wolke: null };
    return bilder.zonen[z];
  }

  function baue(z, teil) {
    if (teil === "himmel") return baueHimmel(z);
    if (teil === "mitte") return baueMitte(z);
    return baueWolke(z);
  }

  // Alles, was eine Landschaft braucht – sofort.
  function zone(z) {
    const b = zonenBilder(z);
    TEILE.forEach((t) => { if (!b[t]) b[t] = baue(z, t); });
    return b;
  }

  // Vorbauen und Aufräumen: die laufende Landschaft, kurz vor dem Übergang
  // auch die nächste – eine Leinwand je Bild.
  function vorbauen(e) {
    const bald = e.rest > ETAPPE - UEBERGANG - 30;
    for (let z = 0; z < ZONEN.length; z += 1) {
      if (z !== e.a && !(bald && z === e.b) && bilder.zonen[z]) bilder.zonen[z] = null;
    }
    if (!bald) return;
    const b = zonenBilder(e.b);
    const t = TEILE.find((n) => !b[n]);
    if (t) b[t] = baue(e.b, t);
  }

  function sterne(cg, rnd, anzahl, breit, bis, hell) {
    cg.fillStyle = "#ffffff";
    for (let i = 0; i < anzahl; i += 1) {
      const r = 0.4 + rnd() * 1.1;
      cg.globalAlpha = hell * (0.3 + rnd() * 0.7);
      cg.beginPath();
      cg.arc(rnd() * breit, rnd() * rnd() * bis, r, 0, Math.PI * 2);
      cg.fill();
    }
    cg.globalAlpha = 1;
  }

  function baueHimmel(z) {
    const Z = ZONEN[z];
    const m = ueberstand();
    const W = view.cssW + 2 * m;
    const H = view.cssH + 2 * m;
    const b = leinwand(W, H);
    const cg = b.g;
    const rs = seilSchirm() + m;
    const unten = H - rs;
    const stelle = (t) => (t <= 1 ? t * rs : rs + (t - 1) * unten);
    const verlauf = cg.createLinearGradient(0, 0, 0, H);
    Z.himmel.forEach(([t, farbe]) => verlauf.addColorStop(clamp(stelle(t) / H, 0, 1), farbe));
    cg.fillStyle = verlauf;
    cg.fillRect(0, 0, W, H);
    const rnd = folge(17 + z * 101);
    const klein = Math.min(view.cssW, view.cssH);

    if (z === 0) {
      // Die ersten Sterne über dem Abendrot – und die Sonne, halb hinter
      // den Tafelbergen.
      sterne(cg, rnd, 26, W, rs * 0.7, 0.45);
      const r = clamp(klein * 0.07, 20, 54);
      const sx = W * 0.7;
      const sy = rs + unten * 0.3;
      const schein = cg.createRadialGradient(sx, sy, 0, sx, sy, r * 7);
      schein.addColorStop(0, "rgba(255, 236, 190, 0.9)");
      schein.addColorStop(0.12, "rgba(255, 200, 130, 0.55)");
      schein.addColorStop(0.4, "rgba(255, 140, 100, 0.18)");
      schein.addColorStop(1, "rgba(255, 120, 100, 0)");
      cg.fillStyle = schein;
      cg.fillRect(sx - r * 7, sy - r * 7, r * 14, r * 14);
      const scheibe = cg.createRadialGradient(sx, sy - r * 0.3, 0, sx, sy, r);
      scheibe.addColorStop(0, "#fffbe8");
      scheibe.addColorStop(1, "#ffd98a");
      cg.fillStyle = scheibe;
      cg.beginPath();
      cg.arc(sx, sy, r, 0, Math.PI * 2);
      cg.fill();
      // Dünne Wolkenstreifen vor der Sonne.
      cg.fillStyle = "rgba(120, 40, 90, 0.45)";
      for (let j = 0; j < 4; j += 1) {
        cg.beginPath();
        cg.ellipse(sx + (j - 1.5) * r * 1.6, sy - r * 0.25 + j * r * 0.32, r * (2 + j * 0.6), r * 0.08, 0, 0, Math.PI * 2);
        cg.fill();
      }
      cg.fillStyle = "rgba(255, 170, 140, 0.25)";
      for (let j = 0; j < 3; j += 1) {
        cg.beginPath();
        cg.ellipse(W * (0.15 + j * 0.3), rs * (0.45 + j * 0.12), W * 0.16, 3, 0, 0, Math.PI * 2);
        cg.fill();
      }
    } else if (z === 1) {
      // Sterne, der Mond und unten das Leuchten der Stadt.
      sterne(cg, rnd, 80, W, rs * 1.1, 0.85);
      const r = clamp(klein * 0.035, 12, 30);
      const mx = W * 0.78;
      const my = Math.max(m + view.frei + r * 2.5, rs * 0.42);
      const schein = cg.createRadialGradient(mx, my, 0, mx, my, r * 5);
      schein.addColorStop(0, "rgba(200, 220, 255, 0.35)");
      schein.addColorStop(1, "rgba(200, 220, 255, 0)");
      cg.fillStyle = schein;
      cg.fillRect(mx - r * 5, my - r * 5, r * 10, r * 10);
      cg.fillStyle = "#f3f0dd";
      cg.beginPath();
      cg.arc(mx, my, r, 0, Math.PI * 2);
      cg.fill();
      cg.fillStyle = "rgba(170, 165, 150, 0.35)";
      [[-0.3, -0.2, 0.25], [0.25, 0.15, 0.18], [-0.05, 0.4, 0.13], [0.35, -0.35, 0.1]].forEach(([dx, dy, rr]) => {
        cg.beginPath();
        cg.arc(mx + dx * r, my + dy * r, rr * r, 0, Math.PI * 2);
        cg.fill();
      });
      const glut = cg.createLinearGradient(0, rs + unten * 0.2, 0, H);
      glut.addColorStop(0, "rgba(255, 110, 80, 0)");
      glut.addColorStop(1, "rgba(255, 110, 80, 0.3)");
      cg.fillStyle = glut;
      cg.fillRect(0, rs, W, H - rs);
    } else {
      // Ein dichter Sternenhimmel mit der Milchstrasse quer darüber.
      sterne(cg, rnd, 150, W, rs * 1.3, 1);
      cg.globalCompositeOperation = "lighter";
      for (let i = 0; i < 7; i += 1) {
        const k = i / 6;
        const x = lerp(W * 0.05, W * 0.95, k);
        const y = lerp(rs * 0.15, rs * 0.85, k) + Math.sin(k * 5) * 12;
        const rr = clamp(klein * 0.16, 50, 160);
        const band = cg.createRadialGradient(x, y, 0, x, y, rr);
        band.addColorStop(0, "rgba(150, 190, 255, 0.07)");
        band.addColorStop(1, "rgba(150, 190, 255, 0)");
        cg.fillStyle = band;
        cg.fillRect(x - rr, y - rr, rr * 2, rr * 2);
      }
      cg.fillStyle = "#ffffff";
      for (let i = 0; i < 160; i += 1) {
        const k = rnd();
        const x = lerp(W * 0.05, W * 0.95, k) + (rnd() - 0.5) * 80;
        const y = lerp(rs * 0.15, rs * 0.85, k) + (rnd() - 0.5) * 60;
        cg.globalAlpha = 0.25 + rnd() * 0.4;
        cg.fillRect(x, y, 0.9, 0.9);
      }
      cg.globalAlpha = 1;
      cg.globalCompositeOperation = "source-over";
      const glut = cg.createLinearGradient(0, rs, 0, H);
      glut.addColorStop(0, "rgba(60, 200, 180, 0)");
      glut.addColorStop(1, "rgba(60, 200, 180, 0.18)");
      cg.fillStyle = glut;
      cg.fillRect(0, rs, W, H - rs);
    }
    // Die Fernsicht gehört zum Himmel: Sie zöge mit 0.05 ohnehin kaum
    // vorbei, und so ist sie im Bild keine eigene Fläche mehr.
    const fern = baueFern(z);
    cg.save();
    cg.translate(m, m);
    for (let x = -m; x < view.cssW + m; x += fern.w) cg.drawImage(fern.c, x, fern.y0, fern.w, fern.h);
    cg.fillStyle = fern.unten;
    cg.fillRect(-m, fern.y0 + fern.h - 1, view.cssW + 2 * m, m + 2);
    cg.restore();
    return { ...b, x: -m, y: -m };
  }

  const kachelBreite = () => Math.ceil(Math.max(view.cssW * 1.6, 800));

  // Schattenhänge: Wo ein Grat nach rechts abfällt, liegt eine schräge,
  // dunklere Facette – vom Gipfel über den Hang ins Tal und schräg zurück.
  // Nur für Hänge, die wirklich abfallen; die kleinen Zacken bleiben hell.
  function schattenHaenge(cg, linie, W, H, farbe) {
    cg.fillStyle = farbe;
    cg.beginPath();
    let von = -1;
    for (let x = 0; x <= W; x += 4) {
      const faellt = x < W && linie(x + 4) > linie(x);
      if (faellt && von < 0) von = x;
      if (!faellt && von >= 0) {
        const gipfel = linie(von);
        const tal = linie(x);
        const fall = tal - gipfel;
        if (fall > 10 && x - von >= 12) {
          cg.moveTo(von, gipfel);
          for (let u = von + 4; u <= x; u += 4) cg.lineTo(u, linie(u));
          cg.lineTo(von + (x - von) * 0.35, Math.min(H, tal + fall * 0.7));
          cg.closePath();
        }
        von = -1;
      }
    }
    cg.fill();
  }

  // Die Fernsicht: Tafelberge, eine Silhouette der Stadt oder eine Kette
  // verschneiter Gipfel – gemalt in den Himmel hinein.
  function baueFern(z) {
    const m = ueberstand();
    const W = kachelBreite();
    const rs = seilSchirm();
    const unten = view.cssH - rs;
    const rnd = folge(29 + z * 57);

    if (z === 0) {
      const y0 = rs + unten * 0.12;
      const H = view.cssH + m - y0;
      const b = leinwand(W, H);
      const cg = b.g;
      const basis = rs + unten * 0.4 - y0;
      const hoch = unten * 0.13 + 12;
      const berge = [];
      let x = 0;
      while (x < W - 80) {
        x += 20 + rnd() * 90;
        const w = 60 + rnd() * 170;
        if (x + w > W - 20) break;
        berge.push({ x, w, top: basis - hoch * (0.45 + 0.55 * rnd()), seite: 6 + rnd() * 14 });
        x += w;
      }
      cg.beginPath();
      cg.moveTo(0, basis);
      berge.forEach((t) => {
        cg.lineTo(t.x, basis);
        cg.lineTo(t.x + t.seite * 0.4, basis - (basis - t.top) * 0.6);
        cg.lineTo(t.x + t.seite, t.top);
        cg.lineTo(t.x + t.w - t.seite, t.top);
        cg.lineTo(t.x + t.w - t.seite * 0.5, basis - (basis - t.top) * 0.5);
        cg.lineTo(t.x + t.w, basis);
      });
      cg.lineTo(W, basis);
      cg.lineTo(W, H);
      cg.lineTo(0, H);
      cg.closePath();
      const fels = cg.createLinearGradient(0, basis - hoch, 0, H);
      fels.addColorStop(0, "#8d4573");
      fels.addColorStop(clamp(hoch / (H - basis + hoch), 0, 1), "#b4587a");
      fels.addColorStop(1, "#e58a7c");
      cg.fillStyle = fels;
      cg.fill();
      cg.strokeStyle = "rgba(255, 190, 140, 0.85)";
      cg.lineWidth = 1.4;
      cg.beginPath();
      berge.forEach((t) => {
        cg.moveTo(t.x + t.seite, t.top);
        cg.lineTo(t.x + t.w - t.seite, t.top);
        cg.lineTo(t.x + t.w - t.seite * 0.5, basis - (basis - t.top) * 0.5);
      });
      cg.stroke();
      cg.strokeStyle = "rgba(90, 30, 70, 0.22)";
      cg.lineWidth = 1;
      cg.beginPath();
      berge.forEach((t) => {
        [0.35, 0.65].forEach((f) => {
          const y = t.top + (basis - t.top) * f;
          cg.moveTo(t.x + t.seite * (1 - f * 0.5), y);
          cg.lineTo(t.x + t.w - t.seite * (1 - f * 0.5), y);
        });
      });
      cg.stroke();
      const dunst = cg.createLinearGradient(0, basis - 4, 0, basis + unten * 0.25);
      dunst.addColorStop(0, "rgba(255, 170, 130, 0)");
      dunst.addColorStop(1, "rgba(255, 170, 130, 0.4)");
      cg.fillStyle = dunst;
      cg.fillRect(0, basis - 4, W, H - basis + 4);
      return { ...b, y0, unten: "#ec9a80" };
    }

    if (z === 1) {
      const y0 = rs + unten * 0.02;
      const H = view.cssH + m - y0;
      const b = leinwand(W, H);
      const cg = b.g;
      const basis = rs + unten * 0.5 - y0;
      let x = 0;
      cg.fillStyle = "#1b2152";
      const fenster = [];
      while (x < W) {
        let w = 14 + rnd() * 40;
        if (x + w > W) w = W - x;
        const hoehe = (0.1 + rnd() * 0.32) * unten + 10;
        const top = basis - hoehe;
        cg.fillRect(x, top, w + 0.5, H - top);
        if (rnd() < 0.18) cg.fillRect(x + w * 0.5 - 0.6, top - 10 - rnd() * 10, 1.2, 20);
        for (let fy = top + 4; fy < basis + unten * 0.3; fy += 6) {
          for (let fx = x + 2; fx < x + w - 2; fx += 5) {
            if (rnd() < 0.1) fenster.push(fx, fy);
          }
        }
        x += w + (rnd() < 0.3 ? rnd() * 6 : 0);
      }
      cg.fillStyle = "rgba(255, 216, 140, 0.6)";
      for (let i = 0; i < fenster.length; i += 2) cg.fillRect(fenster[i], fenster[i + 1], 1.4, 1.8);
      const dunst = cg.createLinearGradient(0, basis - unten * 0.15, 0, H);
      dunst.addColorStop(0, "rgba(90, 50, 120, 0)");
      dunst.addColorStop(1, "rgba(90, 50, 120, 0.6)");
      cg.fillStyle = dunst;
      cg.fillRect(0, basis - unten * 0.15, W, H);
      // Strassen, tief unten: Lichterketten.
      cg.fillStyle = "rgba(255, 190, 120, 0.5)";
      for (let i = 0; i < 260; i += 1) {
        const reihe = Math.floor(rnd() * 5);
        cg.fillRect(rnd() * W, basis + unten * (0.08 + reihe * 0.09), 1.6, 1.2);
      }
      return { ...b, y0, unten: "#3a2a68" };
    }

    const y0 = rs * 0.35;
    const H = view.cssH + m - y0;
    const b = leinwand(W, H);
    const cg = b.g;
    const basis = rs + unten * 0.35 - y0;
    const hoch = basis - (rs * 0.5 - y0);
    const tau = Math.PI * 2;
    const grat = (x) => {
      const u = x / W;
      return basis - hoch * (0.52 + 0.2 * Math.sin(tau * 2 * u + 0.7) + 0.13 * Math.sin(tau * 5 * u + 2.1)
        + 0.12 * (1 - Math.abs(Math.sin(tau * 9 * u + 0.4))) + 0.05 * (1 - Math.abs(Math.sin(tau * 23 * u + 1.3))) - 0.1);
    };
    cg.beginPath();
    cg.moveTo(0, H);
    for (let x = 0; x <= W; x += 4) cg.lineTo(x, grat(x));
    cg.lineTo(W, H);
    cg.closePath();
    const fels = cg.createLinearGradient(0, basis - hoch, 0, H);
    fels.addColorStop(0, "#1d4a5c");
    fels.addColorStop(clamp(hoch / (H - basis + hoch), 0, 1), "#0e2c3a");
    fels.addColorStop(1, "#0c3440");
    cg.fillStyle = fels;
    cg.fill();
    cg.save();
    cg.clip();
    cg.beginPath();
    cg.moveTo(0, 0);
    for (let x = 0; x <= W; x += 6) cg.lineTo(x, basis - hoch * 0.58 + 7 * Math.sin(tau * 13 * x / W) + 4 * Math.sin(tau * 31 * x / W));
    cg.lineTo(W, 0);
    cg.closePath();
    const schnee = cg.createLinearGradient(0, basis - hoch, 0, basis - hoch * 0.5);
    schnee.addColorStop(0, "rgba(230, 251, 255, 0.95)");
    schnee.addColorStop(1, "rgba(180, 230, 240, 0.55)");
    cg.fillStyle = schnee;
    cg.fill();
    schattenHaenge(cg, grat, W, H, "rgba(10, 40, 60, 0.28)");
    cg.restore();
    const dunst = cg.createLinearGradient(0, basis - unten * 0.1, 0, H);
    dunst.addColorStop(0, "rgba(20, 90, 100, 0)");
    dunst.addColorStop(1, "rgba(20, 90, 100, 0.65)");
    cg.fillStyle = dunst;
    cg.fillRect(0, basis - unten * 0.1, W, H);
    return { ...b, y0, unten: "#14505a" };
  }

  // Die Mitte: glühende Felswände der Schlucht, Hochhäuser mit hellen
  // Fenstern oder dunkle Grate mit Schneerinnen.
  function baueMitte(z) {
    const m = ueberstand();
    const W = kachelBreite();
    const rs = seilSchirm();
    const unten = view.cssH - rs;
    const rnd = folge(43 + z * 71);

    if (z === 0) {
      const y0 = rs + unten * 0.22;
      const H = view.cssH + m - y0;
      const b = leinwand(W, H);
      const cg = b.g;
      const felsen = [];
      let x = 10;
      while (x < W - 120) {
        const w = 110 + rnd() * 150;
        if (x + w > W - 20) break;
        const top = (0.04 + rnd() * 0.22) * unten;
        const links = [];
        const rechts = [];
        for (let j = 0; j <= 5; j += 1) {
          const y = top + (H - top) * (j / 5) ** 1.4;
          links.push([x - j * 6 + (rnd() - 0.5) * 10, y]);
          rechts.push([x + w + j * 6 + (rnd() - 0.5) * 10, y]);
        }
        felsen.push({ x, w, top, links, rechts });
        x += w + 30 + rnd() * 110;
      }
      // Fluss am Grund der Schlucht, der den Himmel spiegelt.
      const tau = Math.PI * 2;
      cg.strokeStyle = "rgba(255, 200, 140, 0.45)";
      cg.lineWidth = 3;
      cg.beginPath();
      for (let fx = 0; fx <= W; fx += 8) {
        const fy = H - m - unten * 0.06 + Math.sin(tau * 3 * fx / W) * 6 + Math.sin(tau * 7 * fx / W) * 3;
        if (fx === 0) cg.moveTo(fx, fy);
        else cg.lineTo(fx, fy);
      }
      cg.stroke();
      felsen.forEach((f) => {
        cg.beginPath();
        cg.moveTo(f.links[f.links.length - 1][0], H);
        for (let j = f.links.length - 1; j >= 0; j -= 1) cg.lineTo(f.links[j][0], f.links[j][1]);
        cg.lineTo(f.x + f.w * 0.3, f.top - 3);
        cg.lineTo(f.x + f.w * 0.7, f.top + 2);
        f.rechts.forEach(([rx, ry]) => cg.lineTo(rx, ry));
        cg.lineTo(f.rechts[f.rechts.length - 1][0], H);
        cg.closePath();
        const verlauf = cg.createLinearGradient(0, f.top, 0, H);
        verlauf.addColorStop(0, "#d26a50");
        verlauf.addColorStop(clamp(36 / (H - f.top), 0, 1), "#a4434f");
        verlauf.addColorStop(1, "#3e1438");
        cg.fillStyle = verlauf;
        cg.fill();
        cg.save();
        cg.clip();
        cg.strokeStyle = "rgba(60, 15, 45, 0.3)";
        cg.lineWidth = 1.5;
        cg.beginPath();
        for (let y = f.top + 14; y < H; y += 15 + (y % 7)) {
          cg.moveTo(f.x - 40, y);
          cg.lineTo(f.x + f.w + 40, y + 3);
        }
        cg.stroke();
        cg.restore();
        cg.strokeStyle = "#ffb27a";
        cg.lineWidth = 2;
        cg.beginPath();
        cg.moveTo(f.links[0][0], f.links[0][1]);
        cg.lineTo(f.x + f.w * 0.3, f.top - 3);
        cg.lineTo(f.x + f.w * 0.7, f.top + 2);
        f.rechts.slice(0, 3).forEach(([rx, ry]) => cg.lineTo(rx, ry));
        cg.stroke();
      });
      const dunst = cg.createLinearGradient(0, unten * 0.1, 0, H);
      dunst.addColorStop(0, "rgba(120, 40, 80, 0)");
      dunst.addColorStop(1, "rgba(70, 20, 60, 0.55)");
      cg.fillStyle = dunst;
      cg.fillRect(0, unten * 0.1, W, H);
      return { ...b, y0, unten: "#3a1236" };
    }

    if (z === 1) {
      const y0 = rs + unten * 0.02;
      const H = view.cssH + m - y0;
      const b = leinwand(W, H);
      const cg = b.g;
      const warm = [];
      const hell = [];
      const kalt = [];
      let x = 0;
      while (x < W - 30) {
        const w = Math.min(36 + rnd() * 44, W - x);
        const top = (0.08 + rnd() * 0.38) * unten;
        cg.fillStyle = "#0e1538";
        cg.fillRect(x, top, w, H - top);
        cg.fillStyle = "#1a2456";
        cg.fillRect(x, top, 3, H - top);
        cg.fillRect(x - 1, top - 3, w + 2, 3);
        if (rnd() < 0.35) {
          cg.fillStyle = "#0e1538";
          cg.fillRect(x + w * 0.2, top - 9, w * 0.25, 6);
        }
        const neigung = rnd();
        for (let fy = top + 6; fy < H; fy += 9) {
          for (let fx = x + 5; fx < x + w - 4; fx += 7) {
            const r = rnd();
            if (r < 0.33) (r < 0.33 * neigung ? kalt : (r < 0.3 ? warm : hell)).push(fx, fy);
          }
        }
        if (rnd() < 0.5) {
          cg.fillStyle = "#ff4040";
          cg.fillRect(x + w - 4, top - 5, 2.2, 2.2);
        }
        x += w + 6 + rnd() * 24;
      }
      [[warm, "rgba(255, 211, 107, 0.85)"], [hell, "rgba(255, 241, 184, 0.75)"], [kalt, "rgba(127, 224, 255, 0.8)"]].forEach(([liste, farbe]) => {
        cg.fillStyle = farbe;
        for (let i = 0; i < liste.length; i += 2) cg.fillRect(liste[i], liste[i + 1], 3, 4);
      });
      const dunst = cg.createLinearGradient(0, unten * 0.3, 0, H);
      dunst.addColorStop(0, "rgba(40, 20, 80, 0)");
      dunst.addColorStop(1, "rgba(40, 20, 80, 0.65)");
      cg.fillStyle = dunst;
      cg.fillRect(0, unten * 0.3, W, H);
      return { ...b, y0, unten: "#1a1442" };
    }

    const y0 = rs + unten * 0.04;
    const H = view.cssH + m - y0;
    const b = leinwand(W, H);
    const cg = b.g;
    const tau = Math.PI * 2;
    // Zwei Grate: hinten heller, vorn dunkler, beide mit Schnee oben.
    const grate = [
      { hoch: 0.1, f: [3, 7, 13], ph: 1.1, fels: ["#2c6478", "#163c4a"], schnee: 0 },
      { hoch: 0.24, f: [2, 5, 11], ph: 2.7, fels: ["#1a4554", "#0a2430"], schnee: -0.6 },
    ];
    grate.forEach((gr) => {
      const linie = (x) => {
        const u = x / W;
        return unten * (gr.hoch + 0.07 * Math.sin(tau * gr.f[0] * u + gr.ph) + 0.05 * Math.sin(tau * gr.f[1] * u + gr.ph * 2)
          - 0.06 * (1 - Math.abs(Math.sin(tau * gr.f[2] * u + gr.ph))));
      };
      cg.beginPath();
      cg.moveTo(0, H);
      for (let x = 0; x <= W; x += 4) cg.lineTo(x, linie(x));
      cg.lineTo(W, H);
      cg.closePath();
      const fels = cg.createLinearGradient(0, 0, 0, unten * 0.6);
      fels.addColorStop(0, gr.fels[0]);
      fels.addColorStop(1, gr.fels[1]);
      cg.fillStyle = fels;
      cg.fill();
      cg.save();
      cg.clip();
      // Schnee nur, wo der Grat über die Schneegrenze ragt.
      const grenze = unten * (gr.hoch + gr.schnee * 0.05);
      cg.beginPath();
      cg.moveTo(0, 0);
      for (let x = 0; x <= W; x += 6) cg.lineTo(x, grenze + 5 * Math.sin(tau * 17 * x / W + gr.ph) + 3 * Math.sin(tau * 29 * x / W));
      cg.lineTo(W, 0);
      cg.closePath();
      cg.fillStyle = "rgba(225, 248, 252, 0.88)";
      cg.fill();
      schattenHaenge(cg, linie, W, H, "rgba(15, 50, 70, 0.3)");
      cg.restore();
      cg.strokeStyle = "rgba(168, 255, 216, 0.22)";
      cg.lineWidth = 1;
      cg.beginPath();
      for (let x = 0; x <= W; x += 4) {
        if (x === 0) cg.moveTo(x, linie(x));
        else cg.lineTo(x, linie(x));
      }
      cg.stroke();
    });
    // Das Nebelmeer: eine Decke aus Wolkenkuppen, die die Täler füllt.
    const meer = unten * 0.56;
    const unterNebel = cg.createLinearGradient(0, meer, 0, H);
    unterNebel.addColorStop(0, "rgba(150, 196, 210, 0.92)");
    unterNebel.addColorStop(1, "rgba(52, 96, 116, 0.97)");
    cg.fillStyle = unterNebel;
    cg.fillRect(0, meer + 6, W, H - meer - 6);
    const kuppen = [];
    for (let i = 0; i < 70; i += 1) kuppen.push({ x: rnd() * W, r: 8 + rnd() * 20, y: meer + rnd() * 16 });
    kuppen.sort((a, b) => a.y - b.y);
    kuppen.forEach((k) => {
      const kuppe = cg.createRadialGradient(k.x - k.r * 0.2, k.y - k.r * 0.55, k.r * 0.1, k.x, k.y, k.r);
      kuppe.addColorStop(0, "rgba(236, 251, 255, 0.95)");
      kuppe.addColorStop(0.7, "rgba(178, 216, 228, 0.92)");
      kuppe.addColorStop(1, "rgba(150, 196, 210, 0)");
      cg.fillStyle = kuppe;
      [k.x - W, k.x, k.x + W].forEach((kx) => {
        if (kx < -k.r || kx > W + k.r) return;
        cg.beginPath();
        cg.arc(kx, k.y, k.r, 0, Math.PI * 2);
        cg.fill();
      });
    });
    return { ...b, y0, unten: "#346074" };
  }

  // Eine Wolke aus Bällen: oben hell, unten im Schatten.
  function baueWolke(z) {
    const Z = ZONEN[z];
    const b = leinwand(240, 90);
    const cg = b.g;
    [[60, 55, 26], [100, 42, 34], [145, 46, 31], [185, 58, 24], [120, 60, 36], [40, 64, 20], [205, 66, 18]].forEach(([x, y, r]) => {
      const v = cg.createRadialGradient(x, y - r * 0.5, r * 0.1, x, y, r);
      v.addColorStop(0, Z.wolkeHell);
      v.addColorStop(1, Z.wolkeDunkel);
      cg.fillStyle = v;
      cg.beginPath();
      cg.arc(x, y, r, 0, Math.PI * 2);
      cg.fill();
    });
    return b;
  }

  // Ein weiches Licht: für das Leuchten im Gleichgewicht und die Lampen.
  function glanzBild() {
    if (bilder.glanz) return bilder.glanz;
    const c = document.createElement("canvas");
    c.width = 128;
    c.height = 128;
    const cg = c.getContext("2d");
    const v = cg.createRadialGradient(64, 64, 0, 64, 64, 64);
    v.addColorStop(0, "rgba(255, 255, 255, 1)");
    v.addColorStop(0.25, "rgba(255, 255, 255, 0.45)");
    v.addColorStop(1, "rgba(255, 255, 255, 0)");
    cg.fillStyle = v;
    cg.fillRect(0, 0, 128, 128);
    bilder.glanz = c;
    return c;
  }

  // ---------------------------------------------------------------------------
  // Zeichnen: Hintergrund
  // ---------------------------------------------------------------------------
  // Wie weit die Kamera beim Sturz nach unten gefahren ist, im Bild.
  const fallVersatz = () => (state.camY - state.camBasis) * view.s;

  // Im Übergang zwei Himmel übereinander in jedem Bild wären teuer: Sie
  // werden in zwanzig Stufen in einen Puffer gemischt, und das Bild zeichnet
  // nur den Puffer.
  const misch = { c: null, g: null, a: -1, b: -1, stufe: -1, schluessel: "" };

  function zeichneHimmel(e) {
    const a = zone(e.a).himmel;
    g.imageSmoothingEnabled = false;
    if (e.k <= 0) {
      g.drawImage(a.c, a.x, a.y, a.w, a.h);
      g.imageSmoothingEnabled = true;
      return;
    }
    const b = zonenBilder(e.b).himmel || zone(e.b).himmel;
    const stufe = Math.round(e.k * 20) / 20;
    if (misch.a !== e.a || misch.b !== e.b || misch.stufe !== stufe || misch.schluessel !== bilder.schluessel) {
      if (!misch.c || misch.c.width !== a.c.width || misch.c.height !== a.c.height) {
        misch.c = document.createElement("canvas");
        misch.c.width = a.c.width;
        misch.c.height = a.c.height;
        misch.g = misch.c.getContext("2d");
      }
      misch.g.globalAlpha = 1;
      misch.g.drawImage(a.c, 0, 0);
      misch.g.globalAlpha = stufe;
      misch.g.drawImage(b.c, 0, 0);
      misch.g.globalAlpha = 1;
      Object.assign(misch, { a: e.a, b: e.b, stufe, schluessel: bilder.schluessel });
    }
    g.drawImage(misch.c, a.x, a.y, a.w, a.h);
    g.imageSmoothingEnabled = true;
  }

  // Eine Kachel nahtlos über die ganze Breite, verschoben nach ihrer
  // Entfernung (faktor: 0 steht still, 1 zieht mit dem Seil).
  function zeichneKachel(k, faktor, alpha) {
    if (!k || alpha <= 0) return;
    const m = ueberstand();
    const W = view.cssW;
    const off = state.camX * view.s * faktor;
    let x = -(((off % k.w) + k.w) % k.w);
    while (x > -m) x -= k.w;
    const y = k.y0 + fallVersatz() * faktor * 1.4;
    g.globalAlpha = alpha;
    g.imageSmoothingEnabled = false;
    for (; x < W + m; x += k.w) g.drawImage(k.c, x, y, k.w, k.h);
    g.imageSmoothingEnabled = true;
    if (y + k.h < view.cssH + m) {
      g.fillStyle = k.unten;
      g.fillRect(-m, y + k.h - 1, W + 2 * m, view.cssH + m - y - k.h + 1);
    }
    g.globalAlpha = 1;
  }

  // Im Übergang erst die neue über die alte, dann die alte darunter weg –
  // so wird nichts auf einmal durchsichtig und nichts springt.
  function zeichneLage(e, teil, faktor) {
    const ka = 1 - glatt(clamp(e.k * 2 - 1, 0, 1));
    const kb = glatt(clamp(e.k * 2, 0, 1));
    zeichneKachel(zone(e.a)[teil], faktor, ka);
    if (kb > 0) zeichneKachel(zonenBilder(e.b)[teil] || zone(e.b)[teil], faktor, kb);
  }

  // Das Polarlicht: drei Bänder, die langsam wehen, unten hell, nach oben
  // vergehend – mit Licht addiert.
  const BAENDER = [
    { y: 0.18, a: 18, f1: 0.006, s1: 0.35, f2: 0.013, s2: 0.22, hoch: 70, farbe: "90, 255, 170", ph: 0 },
    { y: 0.34, a: 14, f1: 0.008, s1: 0.28, f2: 0.017, s2: 0.31, hoch: 55, farbe: "80, 220, 255", ph: 2 },
    { y: 0.08, a: 22, f1: 0.004, s1: 0.2, f2: 0.011, s2: 0.17, hoch: 90, farbe: "170, 110, 255", ph: 4 },
  ];
  const BAND_N = 28;
  const bandOben = new Float32Array(BAND_N + 1);

  function zeichnePolarlicht(alpha) {
    if (alpha <= 0.01) return;
    const m = ueberstand();
    const W = view.cssW + 2 * m;
    const rs = seilSchirm();
    const t = ruhig() ? 0 : state.echt;
    g.globalCompositeOperation = "lighter";
    BAENDER.forEach((b) => {
      const basis = view.frei * 0.6 + b.y * rs;
      const hoch = b.hoch * clamp(rs / 300, 0.6, 1.6);
      g.beginPath();
      for (let i = 0; i <= BAND_N; i += 1) {
        const x = -m + (W * i) / BAND_N;
        const y = basis + b.a * Math.sin(x * b.f1 + t * b.s1 + b.ph) + b.a * 0.6 * Math.sin(x * b.f2 - t * b.s2);
        bandOben[i] = y;
        if (i) g.lineTo(x, y);
        else g.moveTo(x, y);
      }
      for (let i = BAND_N; i >= 0; i -= 1) {
        const x = -m + (W * i) / BAND_N;
        g.lineTo(x, bandOben[i] + hoch * (0.55 + 0.45 * Math.sin(x * 0.009 + t * 0.4 + b.ph)));
      }
      g.closePath();
      const v = g.createLinearGradient(0, basis - b.a, 0, basis + hoch + b.a);
      v.addColorStop(0, `rgba(${b.farbe}, 0)`);
      v.addColorStop(0.55, `rgba(${b.farbe}, ${0.16 * alpha})`);
      v.addColorStop(0.88, `rgba(${b.farbe}, ${0.42 * alpha})`);
      v.addColorStop(1, `rgba(${b.farbe}, 0)`);
      g.fillStyle = v;
      g.fill();
    });
    g.globalCompositeOperation = "source-over";
  }

  // Wolken unter dem Seil, in zwei Tiefen; die tieferen sind näher und
  // ziehen schneller vorbei.
  const WOLKEN = Array.from({ length: 10 }, (_, i) => ({
    x: hash01(i * 4.7 + 1), y: 0.12 + hash01(i * 2.3 + 5) * 0.78, s: 0.5 + hash01(i * 9.1 + 2) * 0.7, wahl: hash01(i * 6.1 + 3),
  }));

  function zeichneWolken(e, nah) {
    const rs = seilSchirm();
    const unten = view.cssH - rs;
    const m = ueberstand();
    const groesse = clamp(Math.min(view.cssW / 700, unten / 300), 0.5, 1.3);
    const zeichne = (z, alpha) => {
      if (alpha <= 0.01) return;
      const bild = zonenBilder(z).wolke || zone(z).wolke;
      const Z = ZONEN[z];
      WOLKEN.forEach((w) => {
        if (w.wahl > Z.wolken || (w.y > 0.5) !== nah) return;
        const f = 0.12 + w.y * 0.4;
        const sc = w.s * groesse * (0.7 + w.y * 0.6);
        const bw = 240 * sc;
        const breite = view.cssW + 2 * m + bw;
        const x = (((w.x * breite - state.camX * view.s * f - state.echt * 5 * f) % breite) + breite) % breite - bw - m;
        const y = rs + w.y * unten + fallVersatz() * f * 1.4 - 45 * sc;
        g.globalAlpha = alpha * 0.85;
        g.drawImage(bild.c, x, y, bw, 90 * sc);
      });
      g.globalAlpha = 1;
    };
    zeichne(e.a, 1 - glatt(clamp(e.k * 2 - 1, 0, 1)));
    if (e.k > 0) zeichne(e.b, glatt(clamp(e.k * 2, 0, 1)));
  }

  // Vögel unter dem Seil, in der Schlucht.
  const VOEGEL = Array.from({ length: 7 }, (_, i) => ({
    x: hash01(i * 3.9 + 11), y: 0.08 + hash01(i * 7.7 + 4) * 0.35, v: 12 + hash01(i * 1.3 + 8) * 18, f: 7 + hash01(i * 2.9) * 4, ph: hash01(i * 5.5) * 6,
  }));

  function zeichneVoegel(alpha) {
    if (alpha <= 0.01) return;
    const rs = seilSchirm();
    const unten = view.cssH - rs;
    const t = state.echt;
    const s = clamp(view.s * 0.8, 0.8, 2);
    g.strokeStyle = "#3a1534";
    g.lineWidth = 1.4;
    g.lineCap = "round";
    g.globalAlpha = alpha * 0.8;
    g.beginPath();
    VOEGEL.forEach((b) => {
      const breite = view.cssW + 80;
      const x = (((b.x * breite - state.camX * view.s * 0.5 + t * b.v) % breite) + breite) % breite - 40;
      const y = rs + b.y * unten + Math.sin(t * 0.7 + b.ph) * 6 + fallVersatz() * 0.5;
      const flug = ruhig() ? 0.4 : Math.sin(t * b.f + b.ph);
      g.moveTo(x - 6 * s, y - flug * 3 * s);
      g.quadraticCurveTo(x - 3 * s, y - 1.5 * s, x, y);
      g.quadraticCurveTo(x + 3 * s, y - 1.5 * s, x + 6 * s, y - flug * 3 * s);
    });
    g.stroke();
    g.globalAlpha = 1;
  }

  // ---------------------------------------------------------------------------
  // Zeichnen: Seil, Masten, Netz
  // ---------------------------------------------------------------------------
  function sichtbareMasten() {
    const ms = state.welt.masten;
    const von = spanneBei(state.camX - 140).i;
    const bis = spanneBei(state.camX + view.w + 140).i + 1;
    return { ms, von, bis: Math.min(bis, ms.length - 1) };
  }

  // Worauf die Masten stehen: ein Felsturm, ein Hochhaus oder eine
  // verschneite Felsnadel – tief hinunter, bis aus dem Bild.
  function zeichneStuetze(mast) {
    const z = zoneVon(mast.x);
    const s = view.s;
    const sx = bildX(mast.x);
    const top = bildY(-SOCKEL);
    const boden = view.cssH + ueberstand() + 4;
    if (top > boden) return;
    const h = (k) => hash01(mast.i * 7.31 + k * 1.93 + z * 13.7);
    const erster = mast.i === 0;

    if (z === 1) {
      const halb = (40 + 18 * h(1)) * s;
      const links = erster ? sx - 900 * s : sx - halb;
      const rechts = sx + halb;
      g.fillStyle = "#141b44";
      g.fillRect(links, top, rechts - links, boden - top);
      g.fillStyle = "#0b1030";
      g.fillRect(rechts - halb * 0.35, top, halb * 0.35, boden - top);
      g.fillStyle = "#232c62";
      g.fillRect(links - 2 * s, top - 4 * s, rechts - links + 4 * s, 4 * s);
      // Fenster, nur die Reihen im Bild.
      const warm = h(2) < 0.6;
      const reihe0 = Math.max(0, Math.floor((-top - 8 * s) / (11 * s)));
      const reihen = Math.ceil((boden - top) / (11 * s));
      const breiteF = 4 * s;
      const hoeheF = 5.5 * s;
      g.fillStyle = warm ? "rgba(255, 211, 107, 0.9)" : "rgba(143, 232, 255, 0.85)";
      g.beginPath();
      for (let r = reihe0; r < reihen; r += 1) {
        const fy = top + 8 * s + r * 11 * s;
        for (let c = 0; ; c += 1) {
          const fx = links + 6 * s + c * 9 * s;
          if (fx > rechts - 6 * s) break;
          if (fx < -20 || fx > view.cssW + 20) continue;
          if (hash01(mast.i * 131 + c * 17.3 + r * 7.1) > 0.42) g.rect(fx, fy, breiteF, hoeheF);
        }
      }
      g.fill();
      // Eine Leuchtschrift an der Seite.
      if (h(3) < 0.55 && !erster) {
        const farbe = h(4) < 0.5 ? "255, 79, 216" : "79, 243, 255";
        const nx = sx - halb + 7 * s;
        const ny = top + 16 * s;
        g.globalCompositeOperation = "lighter";
        [[7, 0.12], [3.5, 0.3], [1.4, 1]].forEach(([breit, a]) => {
          g.strokeStyle = `rgba(${farbe}, ${a})`;
          g.lineWidth = breit * s;
          g.strokeRect(nx, ny, 7 * s, 42 * s);
        });
        g.globalCompositeOperation = "source-over";
      }
      // Rote Lampen auf dem Dach, die blinken.
      const an = 0.5 + 0.5 * Math.sin(state.echt * 3 + mast.i);
      g.globalCompositeOperation = "lighter";
      g.globalAlpha = 0.3 + 0.7 * an;
      const licht = glanzBild();
      [rechts - 4 * s, Math.max(links, sx - halb) + 4 * s].forEach((lx) => {
        g.drawImage(licht, lx - 9 * s, top - 13 * s, 18 * s, 18 * s);
      });
      g.globalAlpha = 1;
      g.globalCompositeOperation = "source-over";
      g.fillStyle = "#ff4040";
      [rechts - 4 * s, Math.max(links, sx - halb) + 4 * s].forEach((lx) => g.fillRect(lx - 1.2 * s, top - 5.2 * s, 2.4 * s, 2.4 * s));
      return;
    }

    if (z === 0) {
      // Ein Felsturm: oben schmal, nach unten breiter, mit Schichten und
      // einer glühenden Kante zur Sonne hin.
      const halb = (24 + 12 * h(1)) * s;
      g.beginPath();
      if (erster) {
        g.moveTo(sx - 1000 * s, boden);
        g.lineTo(sx - 1000 * s, top + 4 * s);
      } else {
        g.moveTo(sx - halb - (boden - top) * 0.22, boden);
        for (let j = 5; j >= 1; j -= 1) {
          const y = top + ((boden - top) * j) / 6;
          g.lineTo(sx - halb - (y - top) * 0.22 + (h(j + 4) - 0.5) * 8 * s, y);
        }
        g.lineTo(sx - halb, top + 3 * s);
      }
      g.lineTo(sx - halb * 0.4, top - 2 * s);
      g.lineTo(sx + halb * 0.5, top);
      g.lineTo(sx + halb, top + 4 * s);
      for (let j = 1; j <= 5; j += 1) {
        const y = top + ((boden - top) * j) / 6;
        g.lineTo(sx + halb + (y - top) * 0.22 + (h(j + 11) - 0.5) * 8 * s, y);
      }
      g.lineTo(sx + halb + (boden - top) * 0.22, boden);
      g.closePath();
      const verlauf = g.createLinearGradient(0, top, 0, Math.max(top + 1, boden));
      verlauf.addColorStop(0, "#de7a52");
      verlauf.addColorStop(clamp(40 * s / Math.max(1, boden - top), 0, 1), "#a8434f");
      verlauf.addColorStop(1, "#3a1236");
      g.fillStyle = verlauf;
      g.fill();
      g.save();
      g.clip();
      g.strokeStyle = "rgba(70, 20, 45, 0.35)";
      g.lineWidth = 1.5;
      g.beginPath();
      for (let j = 0; j < 7; j += 1) {
        const y = top + (12 + j * 19 + h(20 + j) * 6) * s;
        g.moveTo(sx - 1000 * s, y);
        g.lineTo(sx + 300 * s, y + 2 * s);
      }
      g.stroke();
      g.restore();
      g.strokeStyle = "rgba(255, 178, 122, 0.85)";
      g.lineWidth = 1.8;
      g.beginPath();
      g.moveTo(sx - halb * 0.4, top - 2 * s);
      g.lineTo(sx + halb * 0.5, top);
      g.lineTo(sx + halb, top + 4 * s);
      g.lineTo(sx + halb + 30 * s * 0.22, top + 30 * s);
      g.stroke();
      // Ein paar Büsche oben.
      g.fillStyle = "#4a3a2a";
      [[-0.6, 3], [0.7, 2.4]].forEach(([fx, r]) => {
        g.beginPath();
        g.arc(sx + fx * halb, top - r * s * 0.4, r * s, 0, Math.PI * 2);
        g.fill();
      });
      return;
    }

    // Eine Felsnadel mit Schnee auf der Spitze und kaltem Licht an der Kante.
    const halb = 15 * s;
    const jit = (j) => (h(j) - 0.5) * 10 * s;
    g.beginPath();
    if (erster) {
      g.moveTo(sx - 1000 * s, boden);
      g.lineTo(sx - 1000 * s, top + 8 * s);
    } else {
      g.moveTo(sx - halb - (boden - top) * 0.55, boden);
      for (let j = 4; j >= 1; j -= 1) {
        const y = top + ((boden - top) * j) / 5;
        g.lineTo(sx - halb - (y - top) * 0.55 + jit(j), y);
      }
    }
    g.lineTo(sx - halb, top + 4 * s);
    g.lineTo(sx, top - 3 * s);
    g.lineTo(sx + halb, top + 5 * s);
    for (let j = 1; j <= 4; j += 1) {
      const y = top + ((boden - top) * j) / 5;
      g.lineTo(sx + halb + (y - top) * 0.55 + jit(j + 7), y);
    }
    g.lineTo(sx + halb + (boden - top) * 0.55, boden);
    g.closePath();
    const verlauf = g.createLinearGradient(0, top, 0, Math.max(top + 1, boden));
    verlauf.addColorStop(0, "#2a5566");
    verlauf.addColorStop(1, "#0a2430");
    g.fillStyle = verlauf;
    g.fill();
    // Schnee: eine Kappe mit welligem Rand, rechts im Schatten.
    const kappe = 30 * s;
    g.fillStyle = "#eafcff";
    g.beginPath();
    g.moveTo(sx - halb - 2 * s, top + 4 * s);
    g.lineTo(sx, top - 4 * s);
    g.lineTo(sx + halb + 2 * s, top + 5 * s);
    g.lineTo(sx + halb + kappe * 0.55, top + kappe);
    for (let j = 6; j >= 0; j -= 1) {
      const fx = lerp(sx - halb - kappe * 0.55, sx + halb + kappe * 0.55, j / 6);
      g.lineTo(fx, top + kappe * (0.55 + 0.3 * Math.sin(j * 2.1 + mast.i)));
    }
    g.closePath();
    g.fill();
    g.fillStyle = "rgba(120, 170, 200, 0.45)";
    g.beginPath();
    g.moveTo(sx + 1 * s, top - 3 * s);
    g.lineTo(sx + halb + 2 * s, top + 5 * s);
    g.lineTo(sx + halb + kappe * 0.55, top + kappe);
    g.lineTo(sx + 4 * s, top + kappe * 0.75);
    g.closePath();
    g.fill();
    g.strokeStyle = "rgba(127, 233, 208, 0.6)";
    g.lineWidth = 1.4;
    g.beginPath();
    g.moveTo(sx - halb - 2 * s, top + 4 * s);
    g.lineTo(sx - halb - 60 * s * 0.55, top + 60 * s);
    g.stroke();
  }

  function zeichneNetz() {
    const { ms, von, bis } = sichtbareMasten();
    g.lineWidth = 1;
    for (let i = von; i < bis; i += 1) {
      const a = ms[i];
      const Z = ZONEN[zoneVon(a.x)];
      g.strokeStyle = `rgba(${Z.netz}, 0.3)`;
      g.beginPath();
      const schritte = Math.max(6, Math.ceil(a.L / 8));
      for (let j = 0; j <= schritte; j += 1) {
        const x = a.x + (a.L * j) / schritte;
        const y = netzY(x);
        const sx = bildX(x);
        if (j === 0) g.moveTo(sx, bildY(y));
        else g.lineTo(sx, bildY(y));
      }
      for (let j = 0; j <= schritte; j += 1) {
        const x = a.x + (a.L * j) / schritte;
        const y = netzY(x) - (j % 2 ? 7 : 0);
        if (j === 0) g.moveTo(bildX(x), bildY(y));
        else g.lineTo(bildX(x), bildY(y));
      }
      g.stroke();
    }
  }

  // Ein Wimpel, der im Wind weht: gestreckt, wenn es bläst, hängend, wenn
  // nicht.
  function zeichneWimpel(sx, sy, lang, hoch, farbe, phase) {
    const s = view.s;
    const wind = state.fahne;
    const dir = wind >= 0 ? 1 : -1;
    const kraft = clamp(Math.abs(wind), 0, 1);
    const t = ruhig() ? 0 : state.echt;
    g.fillStyle = farbe;
    g.beginPath();
    g.moveTo(sx, sy);
    for (let j = 1; j <= 6; j += 1) {
      const k = j / 6;
      const weh = Math.sin(t * (6 + kraft * 8) - j * 0.9 + phase) * 3 * k * (0.4 + kraft);
      const haengt = (1 - kraft) * k * 12;
      g.lineTo(sx + dir * lang * k * (0.55 + 0.45 * kraft) * s, sy + (weh + haengt + hoch * k * 0.5) * s);
    }
    g.lineTo(sx, sy + hoch * s);
    g.closePath();
    g.fill();
  }

  function zeichneMasten() {
    const { ms, von, bis } = sichtbareMasten();
    const s = view.s;
    const meterGross = Math.round(clamp(9 * s, 9, 13));
    for (let i = von; i <= bis; i += 1) {
      const mast = ms[i];
      const Z = ZONEN[zoneVon(mast.x)];
      const sx = bildX(mast.x);
      const oben = bildY(MAST_OBEN);
      const fuss = bildY(-SOCKEL);
      // Abspannseile
      g.strokeStyle = "rgba(20, 10, 20, 0.45)";
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(sx, oben);
      g.lineTo(sx - 48 * s, fuss);
      g.moveTo(sx, oben);
      g.lineTo(sx + 48 * s, fuss);
      g.stroke();
      if (Z.mast === "stahl") {
        // Ein Gittermast, oben rot-weiss.
        const b = 3.5 * s;
        g.strokeStyle = "#5a6488";
        g.lineWidth = Math.max(1, 1.2 * s);
        g.beginPath();
        g.moveTo(sx - b, fuss);
        g.lineTo(sx - b, oben);
        g.moveTo(sx + b, fuss);
        g.lineTo(sx + b, oben);
        let links = true;
        for (let y = fuss; y > oben + 4 * s; y -= 7 * s) {
          g.moveTo(sx + (links ? -b : b), y);
          g.lineTo(sx + (links ? b : -b), y - 7 * s);
          links = !links;
        }
        g.stroke();
        for (let j = 0; j < 4; j += 1) {
          g.fillStyle = j % 2 ? "#ffffff" : "#e8433a";
          g.fillRect(sx - b - 0.5, oben + j * 6 * s, 2 * b + 1, 6 * s);
        }
        const an = 0.5 + 0.5 * Math.sin(state.echt * 4 + i * 1.7);
        g.globalCompositeOperation = "lighter";
        g.globalAlpha = 0.25 + 0.75 * an;
        g.drawImage(glanzBild(), sx - 10 * s, oben - 12 * s, 20 * s, 20 * s);
        g.globalAlpha = 1;
        g.globalCompositeOperation = "source-over";
        g.fillStyle = "#ff5050";
        g.beginPath();
        g.arc(sx, oben - 2 * s, 1.6 * s, 0, Math.PI * 2);
        g.fill();
      } else {
        // Ein Holzmast mit hellem Streifen und Knauf.
        const b = 2.3 * s;
        g.fillStyle = "#6e3d22";
        g.fillRect(sx - b, oben, 2 * b, fuss - oben);
        g.fillStyle = "#a86a40";
        g.fillRect(sx - b, oben, b * 0.6, fuss - oben);
        g.fillStyle = "#d9a066";
        g.beginPath();
        g.arc(sx, oben, 2.6 * s, 0, Math.PI * 2);
        g.fill();
      }
      // Der Sattel, über den das Seil läuft.
      g.fillStyle = "#2a1a14";
      g.fillRect(sx - 4 * s, bildY(0) - 1 * s, 8 * s, 4 * s);
      // Wimpelstange und Wimpel
      g.strokeStyle = "#d8c8a8";
      g.lineWidth = Math.max(1, 0.9 * s);
      g.beginPath();
      g.moveTo(sx, oben);
      g.lineTo(sx, oben - 14 * s);
      g.stroke();
      zeichneWimpel(sx, oben - 14 * s, 24, 10, Z.wimpel[i % Z.wimpel.length], i * 1.3);
      // Die Meter des Masts, auf einem Schild unter dem Seil.
      if (i > 0) {
        const text = `${Math.round(meterBei(mast.x))} m`;
        g.font = `800 ${meterGross}px system-ui, sans-serif`;
        g.textAlign = "center";
        g.textBaseline = "middle";
        const w = g.measureText(text).width + 8;
        const y = bildY(-15);
        g.fillStyle = "rgba(20, 12, 30, 0.7)";
        g.fillRect(sx - w / 2, y - meterGross * 0.75, w, meterGross * 1.5);
        g.fillStyle = Z.schrift;
        g.fillText(text, sx, y + 0.5);
      } else {
        zeichnePodest(sx);
      }
    }
  }

  // Das Podest am ersten Mast, auf dem der Seiltänzer wartet.
  function zeichnePodest(sx) {
    const s = view.s;
    const y = bildY(0);
    const fuss = bildY(-SOCKEL);
    g.strokeStyle = "#5a3220";
    g.lineWidth = Math.max(1.5, 2.2 * s);
    g.beginPath();
    g.moveTo(sx - 46 * s, y);
    g.lineTo(sx - 50 * s, fuss);
    g.moveTo(sx + 4 * s, y);
    g.lineTo(sx + 6 * s, fuss);
    for (let j = 0; j < 4; j += 1) {
      const y1 = lerp(y, fuss, j / 4);
      const y2 = lerp(y, fuss, (j + 1) / 4);
      g.moveTo(sx - 46 * s, y1);
      g.lineTo(sx + 5 * s, y2);
    }
    g.stroke();
    g.fillStyle = "#8a5232";
    g.fillRect(sx - 52 * s, y, 60 * s, 5 * s);
    g.fillStyle = "#b8784a";
    g.fillRect(sx - 52 * s, y, 60 * s, 1.5 * s);
    g.strokeStyle = "#5a3220";
    g.lineWidth = Math.max(1, 1.2 * s);
    g.beginPath();
    g.moveTo(sx - 48 * s, y);
    g.lineTo(sx - 48 * s, y - 20 * s);
    g.lineTo(sx - 28 * s, y - 20 * s);
    g.lineTo(sx - 28 * s, y);
    g.stroke();
  }

  function zeichneSeil() {
    const { ms, von, bis } = sichtbareMasten();
    const breit = clamp(2.2 * view.s, 2, 4.5);
    g.lineCap = "round";
    g.lineJoin = "round";
    for (let i = von; i < bis; i += 1) {
      const a = ms[i];
      const Z = ZONEN[zoneVon(a.x)];
      const schritte = Math.max(8, Math.ceil(a.L / 8));
      g.beginPath();
      for (let j = 0; j <= schritte; j += 1) {
        const x = a.x + (a.L * j) / schritte;
        const sx = bildX(x);
        const sy = bildY(seilYIn(a, x));
        if (j === 0) g.moveTo(sx, sy);
        else g.lineTo(sx, sy);
      }
      g.strokeStyle = Z.seil;
      g.lineWidth = breit;
      g.stroke();
      g.save();
      g.translate(0, -breit * 0.3);
      g.strokeStyle = Z.seilLicht;
      g.globalAlpha = 0.75;
      g.lineWidth = Math.max(0.8, breit * 0.35);
      g.stroke();
      g.restore();
    }
  }

  // Die Gegner: ein Wimpel am Seil bei ihren Metern, mit Namen. Wer daran
  // vorbei ist, hat sie geschlagen – dann wird er blass.
  function zeichneZiele() {
    const ziele = (gegner?.gegner?.() || []).filter((ziel) => ziel.art !== "alle");
    if (!ziele.length) return;
    const s = view.s;
    const gross = Math.round(clamp(view.cssH * 0.03, 10, 14));
    g.font = `800 ${gross}px system-ui, sans-serif`;
    g.textAlign = "center";
    g.textBaseline = "bottom";
    ziele.forEach((ziel) => {
      const x = START.x + ziel.punkte * METER;
      if (x < state.camX - 40 || x > state.camX + view.w + 40) return;
      const sx = bildX(x);
      const sy = bildY(seilY(x));
      const oben = sy - 72 * s;
      g.globalAlpha = state.punkte > ziel.punkte ? 0.35 : 0.95;
      g.strokeStyle = ziel.farbe;
      g.lineWidth = 2;
      g.setLineDash([6, 5]);
      g.beginPath();
      g.moveTo(sx, sy);
      g.lineTo(sx, oben);
      g.stroke();
      g.setLineDash([]);
      g.fillStyle = ziel.farbe;
      g.beginPath();
      g.moveTo(sx, oben);
      g.lineTo(sx + 16 * s, oben + 5 * s);
      g.lineTo(sx, oben + 10 * s);
      g.closePath();
      g.fill();
      const text = ziel.art === "eigen" ? `Bestmarke ${ziel.punkte} m` : `${ziel.name} ${ziel.punkte} m`;
      g.lineWidth = 3;
      g.strokeStyle = "rgba(7, 11, 36, 0.8)";
      g.strokeText(text, sx, oben - 3);
      g.fillText(text, sx, oben - 3);
    });
    g.globalAlpha = 1;
  }

  // ---------------------------------------------------------------------------
  // Zeichnen: der Seiltänzer
  // ---------------------------------------------------------------------------
  const FIGUR = {
    haut: "#ffd1a4", hemd: "#fff4e6", streifen: "#e8433a", hose: "#2b2350", schuh: "#1b1530",
    haar: "#4a2a1a", hut: "#00A5B5", hutBand: "#00707c", stange: "#f3dfae", stangeRand: "#6b4a2a",
    gewicht: "#00A5B5", auge: "#1b1530",
  };

  /*
   * Die Figur steht mit den Füssen auf dem Punkt (px, py) und ist um dreh
   * geneigt – um die Füsse, wie ein Stab. Gezeichnet im Bild, eine Einheit
   * mal view.s. pose:
   *   dreh     Neigung (Bogenmass, positiv nach rechts)
   *   stange   Neigung der Stange gegen den Körper (rechts hinunter positiv)
   *   phase    Schrittphase (eine Eins: zwei Schritte)
   *   geht     0 steht, 1 geht
   *   arme     null – die Hände halten die Stange; sonst der Winkel beim Rudern
   *   gefahr   0 … 1, wie nah er am Kippen ist
   *   sturz    fällt er gerade?
   * Mit farbe ein Geist: alles in einer Farbe, ohne Gesicht.
   */
  function zeichneFigur(px, py, pose, farbe) {
    const F = FIGUR;
    const ein = (name) => farbe || F[name];
    const t = state.echt;
    g.save();
    g.translate(px, py);
    g.rotate(pose.dreh);
    g.scale(view.s, view.s);
    g.lineCap = "round";
    g.lineJoin = "round";

    // Die Schritte: ein Fuss schwingt nach vorn, der andere steht und
    // gleitet unter dem Körper nach hinten.
    const ph = ((pose.phase % 1) + 1) % 1;
    const u = ph < 0.5 ? ph * 2 : ph * 2 - 1;
    const hebt = Math.sin(Math.PI * u) * 5 * pose.geht;
    const vorn = lerp(-5, 5, glatt(u));
    const hinten = lerp(5, -5, u);
    const lx = lerp(-3, ph < 0.5 ? vorn : hinten, pose.geht);
    const ly = ph < 0.5 ? -hebt : 0;
    const rx = lerp(3, ph < 0.5 ? hinten : vorn, pose.geht);
    const ry = ph < 0.5 ? 0 : -hebt;
    const wipp = -Math.abs(Math.sin(Math.PI * u)) * 1.2 * pose.geht;
    const hy = -22 + wipp;
    const sy = -39 + wipp;

    // Beine
    const bein = (hx, fx, fy, aussen) => {
      const dx = fx - hx;
      const dy = fy - hy;
      const d = Math.hypot(dx, dy) || 1;
      const beug = Math.sqrt(Math.max(0, 11.5 * 11.5 - (d / 2) * (d / 2)));
      g.beginPath();
      g.moveTo(hx, hy);
      g.lineTo((hx + fx) / 2 + (dy / d) * beug * aussen, (hy + fy) / 2 - (dx / d) * beug * aussen);
      g.lineTo(fx, fy);
      g.stroke();
    };
    g.strokeStyle = ein("hose");
    g.lineWidth = 4.6;
    bein(-3.4, lx, ly, -1);
    bein(3.4, rx, ry, 1);
    g.fillStyle = ein("schuh");
    [[lx, ly], [rx, ry]].forEach(([fx, fy]) => {
      g.beginPath();
      g.ellipse(fx + 1.3, fy - 0.6, 3.4, 1.8, 0, 0, Math.PI * 2);
      g.fill();
    });

    // Der Körper: ein gestreiftes Trikot mit Gürtel.
    g.fillStyle = ein("hemd");
    g.beginPath();
    g.moveTo(-5.4, hy + 0.5);
    g.lineTo(5.4, hy + 0.5);
    g.lineTo(7.2, sy + 1.5);
    g.quadraticCurveTo(0, sy - 2.5, -7.2, sy + 1.5);
    g.closePath();
    g.fill();
    if (!farbe) {
      g.save();
      g.clip();
      g.fillStyle = F.streifen;
      for (let y = hy - 1; y > sy - 3; y -= 4) g.fillRect(-8, y - 2, 16, 2);
      g.restore();
      g.fillStyle = F.hose;
      g.fillRect(-5.6, hy - 1.2, 11.2, 2.2);
    }

    // Kopf
    const ky = sy - 9.5;
    g.fillStyle = ein("haut");
    g.fillRect(-1.5, sy - 3.5, 3, 3);
    g.beginPath();
    g.arc(0, ky, 7, 0, Math.PI * 2);
    g.fill();
    if (!farbe) {
      g.fillStyle = F.haar;
      g.beginPath();
      g.arc(0, ky, 7.3, Math.PI * 1.06, Math.PI * 1.94);
      g.quadraticCurveTo(1, ky - 4.8, -6.9, ky - 2.4);
      g.closePath();
      g.fill();
      // Ein kleiner Fes mit Quaste.
      g.fillStyle = F.hut;
      g.beginPath();
      g.moveTo(-4.4, ky - 5.4);
      g.lineTo(4.6, ky - 6.2);
      g.lineTo(3.6, ky - 12);
      g.lineTo(-3.2, ky - 11.6);
      g.closePath();
      g.fill();
      g.fillStyle = F.hutBand;
      g.beginPath();
      g.moveTo(-4.4, ky - 5.4);
      g.lineTo(4.6, ky - 6.2);
      g.lineTo(4.4, ky - 7.6);
      g.lineTo(-4.2, ky - 6.8);
      g.closePath();
      g.fill();
      const quaste = Math.sin(t * 6) * (ruhig() ? 0 : 1);
      g.strokeStyle = "#ffd166";
      g.lineWidth = 1.1;
      g.beginPath();
      g.moveTo(0.3, ky - 11.8);
      g.quadraticCurveTo(3, ky - 13, 4.6, ky - 9 + quaste);
      g.stroke();
      g.fillStyle = "#ffd166";
      g.beginPath();
      g.arc(4.6, ky - 8.6 + quaste, 1.2, 0, Math.PI * 2);
      g.fill();

      // Das Gesicht: Augen, die dorthin schauen, wohin er kippt; der Mund
      // wird rund, wenn es eng wird.
      const bx = clamp(pose.blick || 0, -1.3, 1.3);
      const angst = pose.sturz || pose.gefahr > 0.6;
      if (angst) {
        g.fillStyle = "#ffffff";
        [-2.6, 2.6].forEach((ax) => {
          g.beginPath();
          g.arc(ax, ky - 0.6, 1.9, 0, Math.PI * 2);
          g.fill();
        });
        g.fillStyle = F.auge;
        [-2.6, 2.6].forEach((ax) => {
          g.beginPath();
          g.arc(ax + bx * 0.6, ky - 0.6, 0.95, 0, Math.PI * 2);
          g.fill();
        });
      } else {
        g.fillStyle = F.auge;
        [-2.5, 2.5].forEach((ax) => {
          g.beginPath();
          g.arc(ax + bx * 0.5, ky - 0.5, 1.1, 0, Math.PI * 2);
          g.fill();
        });
      }
      g.strokeStyle = F.auge;
      g.lineWidth = 0.8;
      g.beginPath();
      const hebtBraue = angst ? 1.4 : 0;
      g.moveTo(-4, ky - 3.2);
      g.lineTo(-1.3, ky - 3.6 - hebtBraue);
      g.moveTo(4, ky - 3.2);
      g.lineTo(1.3, ky - 3.6 - hebtBraue);
      g.stroke();
      g.fillStyle = "rgba(255, 110, 110, 0.35)";
      [-4.6, 4.6].forEach((ax) => {
        g.beginPath();
        g.arc(ax, ky + 1.6, 1.5, 0, Math.PI * 2);
        g.fill();
      });
      if (pose.sturz) {
        g.fillStyle = "#6a1a1a";
        g.beginPath();
        g.ellipse(0, ky + 3.3, 1.8, 2.3, 0, 0, Math.PI * 2);
        g.fill();
      } else if (pose.gefahr > 0.6) {
        g.fillStyle = "#6a1a1a";
        g.beginPath();
        g.ellipse(0, ky + 3.1, 1.2, 1.5, 0, 0, Math.PI * 2);
        g.fill();
      } else {
        g.lineWidth = 0.9;
        g.beginPath();
        g.arc(0, ky + 1.6, 2.4, Math.PI * 0.18, Math.PI * 0.82);
        g.stroke();
      }
    }

    // Die Stange: lang, an den Enden etwas durchgebogen, mit Gewichten und
    // Bändern, die im Fahrtwind wehen.
    const cx = 0;
    const cy = -31 + wipp;
    const ca = Math.cos(pose.stange);
    const sa = Math.sin(pose.stange);
    const durch = 3.2 + Math.abs(Math.sin(Math.PI * u)) * 1.2 * pose.geht;
    if (!pose.arme) {
      const lex = cx - ca * 58 - sa * durch;
      const ley = cy - sa * 58 + ca * durch;
      const rex = cx + ca * 58 - sa * durch;
      const rey = cy + sa * 58 + ca * durch;
      const kx = cx + sa * durch;
      const ky2 = cy - ca * durch;
      g.beginPath();
      g.moveTo(lex, ley);
      g.quadraticCurveTo(kx, ky2, rex, rey);
      if (!farbe) {
        g.strokeStyle = F.stangeRand;
        g.lineWidth = 3.6;
        g.stroke();
      }
      g.strokeStyle = ein("stange");
      g.lineWidth = 2.2;
      g.stroke();
      if (!farbe) {
        const wehen = ruhig() ? 0 : 1;
        g.strokeStyle = "#ffd166";
        g.lineWidth = 1.2;
        [[lex, ley], [rex, rey]].forEach(([ex, ey], j) => {
          g.beginPath();
          g.moveTo(ex, ey);
          for (let n = 1; n <= 4; n += 1) g.lineTo(ex - n * 3.2, ey + Math.sin(t * 11 + n * 1.3 + j) * 1.6 * wehen + n * 0.6);
          g.stroke();
        });
      }
      g.fillStyle = ein("gewicht");
      [[lex, ley], [rex, rey]].forEach(([ex, ey]) => {
        g.beginPath();
        g.arc(ex, ey, 3.2, 0, Math.PI * 2);
        g.fill();
      });
      if (!farbe) {
        g.fillStyle = "rgba(255, 255, 255, 0.6)";
        [[lex, ley], [rex, rey]].forEach(([ex, ey]) => {
          g.beginPath();
          g.arc(ex - 1, ey - 1.1, 1, 0, Math.PI * 2);
          g.fill();
        });
      }
    }

    // Die Arme: an der Stange – oder rudernd, wenn er fällt.
    [-1, 1].forEach((seite) => {
      const schx = seite * 6.6;
      const schy = sy + 0.8;
      let hx;
      let hy2;
      if (pose.arme) {
        const w = pose.arme + (seite > 0 ? 0 : Math.PI);
        hx = schx + Math.cos(w) * 12;
        hy2 = schy + Math.sin(w) * 12;
      } else {
        hx = cx + seite * ca * 13;
        hy2 = cy + seite * sa * 13;
      }
      const ex = (schx + hx) / 2 + seite * 2.4;
      const ey = (schy + hy2) / 2 + 2.6;
      g.strokeStyle = farbe || F.streifen;
      g.lineWidth = 3.6;
      g.beginPath();
      g.moveTo(schx, schy);
      g.lineTo(ex, ey);
      g.stroke();
      g.strokeStyle = ein("haut");
      g.lineWidth = 2.9;
      g.beginPath();
      g.moveTo(ex, ey);
      g.lineTo(hx, hy2);
      g.stroke();
      g.fillStyle = ein("haut");
      g.beginPath();
      g.arc(hx, hy2, 1.9, 0, Math.PI * 2);
      g.fill();
    });
    g.restore();
  }

  function zeichneLaeufer() {
    const l = state.l;
    const st = state.sturz;
    const s = view.s;
    if (state.schritt === "sturz" && st) {
      const t = state.zeit - state.sturzZeit;
      zeichneFigur(bildX(st.x), bildY(st.y), {
        dreh: st.dreh, stange: 0, phase: t * 3, geht: st.liegt ? 0.2 : 1, arme: t * (st.liegt ? 4 : 17) + 0.5, gefahr: 1, sturz: true, blick: st.dir,
      }, null);
      // Die Stange fällt für sich.
      const p = st.stange;
      const px = bildX(p.x);
      const py = bildY(p.y);
      const ca = Math.cos(p.dreh) * 58 * s;
      const sa = Math.sin(p.dreh) * 58 * s;
      g.lineCap = "round";
      g.strokeStyle = FIGUR.stangeRand;
      g.lineWidth = 3.6 * s;
      g.beginPath();
      g.moveTo(px - ca, py - sa);
      g.lineTo(px + ca, py + sa);
      g.stroke();
      g.strokeStyle = FIGUR.stange;
      g.lineWidth = 2.2 * s;
      g.stroke();
      g.fillStyle = FIGUR.gewicht;
      [[px - ca, py - sa], [px + ca, py + sa]].forEach(([ex, ey]) => {
        g.beginPath();
        g.arc(ex, ey, 3.2 * s, 0, Math.PI * 2);
        g.fill();
      });
      return;
    }
    const px = bildX(l.x);
    const py = bildY(l.y);
    // Im Gleichgewicht ein warmes Leuchten hinter ihm.
    if (state.glanz > 0.01) {
      const r = (58 + state.ruheN * 4) * s;
      g.globalCompositeOperation = "lighter";
      g.globalAlpha = clamp(state.glanz * (0.35 + 0.08 * state.ruheN), 0, 0.75);
      g.drawImage(glanzBild(), px + Math.sin(l.th) * 30 * s - r, py - Math.cos(l.th) * 30 * s - r, r * 2, r * 2);
      g.globalAlpha = 1;
      g.globalCompositeOperation = "source-over";
    }
    zeichneFigur(px, py, {
      dreh: l.th, stange: stangeNeigung(), phase: state.gang / 2, geht: state.geht, arme: null, gefahr: state.gefahr, sturz: false, blick: state.blick,
    }, null);
  }

  // Wie die Stange gegen den Körper steht: wohin er drückt – und wo ein
  // Vogel sitzt, biegt sie sich hinunter.
  function stangeNeigung() {
    let n = state.l.p * 0.2;
    const e = state.welt.ereignisse[state.ereignis];
    if (e?.art === "vogel") for (const v of e.voegel) if (state.l.x >= v.an && state.l.x < v.ab) n += v.seite * 0.07;
    return n;
  }

  // Ein Punkt der Figur (fx, fy wie in zeichneFigur: von den Füssen aus, y
  // nach unten) im Bild – so, wie sie gerade steht und geht.
  function figurPunkt(fx, fy) {
    const l = state.l;
    const c = Math.cos(l.th);
    const sn = Math.sin(l.th);
    return { x: bildX(l.x) + (fx * c - fy * sn) * view.s, y: bildY(l.y) + (fx * sn + fy * c) * view.s };
  }

  // Wo ein Vogel auf dem Ende der Stange steht (seite −1 links, +1 rechts):
  // oben auf dem Gewicht – wie zeichneFigur die Stange zeichnet.
  function stangenEnde(seite) {
    const ph = (((state.gang / 2) % 1) + 1) % 1;
    const u = ph < 0.5 ? ph * 2 : ph * 2 - 1;
    const wipp = -Math.abs(Math.sin(Math.PI * u)) * 1.2 * state.geht;
    const durch = 3.2 + Math.abs(Math.sin(Math.PI * u)) * 1.2 * state.geht;
    const st = stangeNeigung();
    const ca = Math.cos(st);
    const sa = Math.sin(st);
    return figurPunkt(seite * ca * 58 - sa * durch, -31 + wipp + seite * sa * 58 + ca * durch - 3.2);
  }

  // ---------------------------------------------------------------------------
  // Zeichnen: die Vögel
  // ---------------------------------------------------------------------------
  // Je Landschaft ein Vogel: in der Schlucht eine Dohle, in der Stadt eine
  // Taube, bei den Gipfeln eine Möwe.
  const VOGELARTEN = [
    { koerper: "#2b2932", fluegel: "#1a1920", bauch: "#3b3944", kopf: "#2b2932", nacken: "#8f939f", schnabel: "#17161b", auge: "#e9eef4", ring: true, gross: 1.5 },
    { koerper: "#8f97a9", fluegel: "#6a7285", bauch: "#a8afc0", kopf: "#7c849a", nacken: "#3ea48f", schnabel: "#3a3330", auge: "#ff8a3d", ring: false, gross: 1.5 },
    { koerper: "#f2f5f8", fluegel: "#aab5c1", bauch: "#ffffff", kopf: "#ffffff", nacken: "#ffffff", schnabel: "#f2b632", auge: "#1a1a1a", ring: false, gross: 1.65 },
  ];
  const vogelArt = (x) => VOGELARTEN[zoneVon(x)];
  const vogelFarben = (x) => { const a = vogelArt(x); return [a.koerper, a.fluegel, a.bauch]; };

  /*
   * Ein Vogel von der Seite, die Füsse bei (x, y). blick: +1 schaut nach
   * rechts. schlag: die Phase des Flügelschlags (Bogenmass), offen: wie weit
   * die Flügel gehen (0 angelegt). sitzt: Beine sichtbar. dreh: geneigt.
   */
  function zeichneVogel(x, y, art, { blick = 1, schlag = 0, offen = 0, sitzt = true, dreh = 0, alpha = 1 } = {}) {
    const k = view.s * art.gross;
    g.save();
    g.globalAlpha = alpha;
    g.translate(x, y);
    g.rotate(dreh);
    g.scale(k * blick, k);
    g.lineCap = "round";
    g.lineJoin = "round";
    const fluegel = (vorn) => {
      const a = Math.sin(schlag) * offen;
      g.fillStyle = vorn ? art.fluegel : art.bauch;
      g.beginPath();
      if (offen < 0.05) {
        g.ellipse(-1.6, -5, 4.4, 2, -0.15, 0, Math.PI * 2);
      } else {
        const hub = vorn ? 1 : 0.75;
        g.moveTo(1.2, -5.6);
        g.quadraticCurveTo(0.5, -5.6 - 6 * a * hub, -2.5 + 2 * Math.abs(a), -5.6 - 10.5 * a * hub);
        g.lineTo(-6, -5.4 - 7.5 * a * hub);
        g.quadraticCurveTo(-3, -5.2 - 2 * a, -3.5, -4.8);
        g.closePath();
      }
      g.fill();
    };
    if (sitzt) {
      g.strokeStyle = art.schnabel;
      g.lineWidth = 0.7;
      g.beginPath();
      g.moveTo(-0.8, -2);
      g.lineTo(-0.6, 0);
      g.moveTo(0.6, -2);
      g.lineTo(0.9, 0);
      g.stroke();
    }
    if (offen >= 0.05) fluegel(false);
    // Schwanz, Körper, Bauch.
    g.fillStyle = art.fluegel;
    g.beginPath();
    g.moveTo(-4.4, -4.4);
    g.lineTo(-9.6, -3.3);
    g.lineTo(-9.3, -5.5);
    g.lineTo(-4, -6.2);
    g.closePath();
    g.fill();
    g.fillStyle = art.koerper;
    g.beginPath();
    g.ellipse(-0.5, -4.6, 5.3, 3.3, -0.18, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = art.bauch;
    g.beginPath();
    g.ellipse(0.4, -3.5, 3.7, 1.9, -0.1, 0, Math.PI * 2);
    g.fill();
    // Kopf mit Nacken, Schnabel und Auge.
    g.fillStyle = art.nacken;
    g.beginPath();
    g.ellipse(2.6, -6.9, 2.3, 1.9, -0.6, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = art.kopf;
    g.beginPath();
    g.arc(4.1, -7.8, 2.5, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = art.schnabel;
    g.beginPath();
    g.moveTo(6.2, -8.3);
    g.lineTo(9, -7.5);
    g.lineTo(6.2, -6.9);
    g.closePath();
    g.fill();
    g.fillStyle = art.auge;
    g.beginPath();
    g.arc(4.8, -8.4, art.ring ? 0.75 : 0.55, 0, Math.PI * 2);
    g.fill();
    if (art.ring) {
      g.fillStyle = "#111014";
      g.beginPath();
      g.arc(4.9, -8.4, 0.38, 0, Math.PI * 2);
      g.fill();
    }
    fluegel(true);
    g.restore();
  }

  /*
   * Die Vögel der Störungen, Bild für Bild aus der Stelle, an der er gerade
   * ist – darum stimmen sie auch beim Zuschauen. Ein Vogel, der landet,
   * fliegt in den letzten ANFLUG Sekunden von oben heran, sitzt auf dem Ende
   * der Stange, plustert sich vor dem Abflug und fliegt nach aussen davon.
   * Einer, der rammt, kommt flach von der Seite, prallt ab und trudelt.
   */
  const fortgeflogen = [];
  function zeichneStoerVoegel() {
    const l = state.l;
    const t = state.echt;
    const W = view.cssW;
    const s = view.s;
    const sturz = state.schritt === "sturz";
    // Wer auf der Stange sass, als er fiel, fliegt erschrocken davon.
    if (sturz) {
      const seit = state.zeit - state.sturzZeit;
      fortgeflogen.forEach((v) => {
        const q = seit / 1.2;
        if (q > 1) return;
        zeichneVogel(v.x + v.seite * 160 * q * s, v.y - 130 * q * s, v.art, { blick: v.seite, schlag: t * 24, offen: 1, sitzt: false, dreh: -0.3 * v.seite, alpha: 1 - q * q });
      });
      return;
    }
    fortgeflogen.length = 0;
    if (state.schritt !== "lauf") return;
    const v = Math.max(5, l.v || tempoBei(l.x));
    const alle = state.welt.ereignisse;
    for (let i = Math.max(0, state.ereignis - 2); i < alle.length; i += 1) {
      const e = alle[i];
      if ((e.x0 - l.x) / v > ANFLUG + 1.2) break;
      if (e.art === "vogel") {
        const art = vogelArt(e.x0);
        e.voegel.forEach((b) => {
          const vorAn = (b.an - l.x) / v;
          const vorAb = (b.ab - l.x) / v;
          if (vorAn > ANFLUG || vorAb < -1.3) return;
          const ende = stangenEnde(b.seite);
          const rand = b.seite > 0 ? W - ende.x + 40 : ende.x + 40;
          if (vorAn > 0) {
            // Der Anflug: von oben aussen, zuletzt gebremst.
            const q = vorAn / ANFLUG;
            const bremst = vorAn < 0.25;
            zeichneVogel(ende.x + b.seite * (rand * q * q + 18 * s * Math.sin(Math.PI * q)), ende.y - (150 * q + 30 * Math.sin(Math.PI * q)) * s, art, {
              blick: -b.seite, schlag: t * (bremst ? 12 : 24) + b.nr, offen: bremst ? 1.2 : 1, sitzt: bremst, dreh: b.seite * 0.25 * q,
            });
          } else if (vorAb > 0) {
            // Er sitzt: wippt mit, schaut sich um – und plustert sich vor dem Abflug.
            const geht = vorAb < 0.45;
            const nicken = ruhig() ? 0 : Math.sin(t * 3 + b.nr) * 0.4;
            fortgeflogen.push({ x: ende.x, y: ende.y, seite: b.seite, art });
            zeichneVogel(ende.x, ende.y + nicken * s, art, {
              blick: Math.sin(t * 0.9 + b.nr) > 0.6 ? b.seite : -b.seite, schlag: t * 18 + b.nr, offen: geht ? 0.6 : 0, sitzt: true, dreh: l.th * 0.5,
            });
          } else {
            // Davon: nach oben aussen.
            const q = -vorAb / 1.3;
            zeichneVogel(ende.x + b.seite * (rand + 60) * q * q * 1.2 + b.seite * 40 * q * s, ende.y - (40 * q + 110 * q * q) * s, art, {
              blick: b.seite, schlag: t * 24 + b.nr, offen: 1, sitzt: false, dreh: -0.35 * b.seite, alpha: 1 - Math.max(0, q - 0.8) * 5,
            });
          }
        });
      } else if (e.art === "ramme") {
        const art = vogelArt(e.x0);
        const vor = (e.x0 - l.x) / v;
        const von = -e.dir;
        const ziel = figurPunkt(von * 8, -34 + e.hoehe * 8);
        if (vor > ANFLUG || vor < -1.3) continue;
        if (vor > 0) {
          // Flach heran, mit schnellem Flügelschlag – und Strichen dahinter.
          const q = vor / ANFLUG;
          const rand = von > 0 ? W - ziel.x + 50 : ziel.x + 50;
          const x = ziel.x + von * (rand * q + 6 * s);
          const y = ziel.y - 10 * s * Math.sin(Math.PI * q) + 6 * s;
          g.strokeStyle = "rgba(255, 255, 255, 0.55)";
          g.lineWidth = 1.2;
          g.beginPath();
          for (const dy of [-6, -2, 2]) {
            g.moveTo(x + von * 12 * s, y + dy * s - 4 * s);
            g.lineTo(x + von * (26 + 8 * Math.abs(dy) / 6) * s, y + dy * s - 4 * s);
          }
          g.stroke();
          zeichneVogel(x, y, art, { blick: -von, schlag: t * 30, offen: 1, sitzt: false, dreh: -von * 0.12 });
        } else {
          // Abgeprallt: Er trudelt zurück und hinab.
          const q = -vor / 1.3;
          zeichneVogel(ziel.x + von * (14 + 70 * q) * s, ziel.y + (6 - 20 * q + 160 * q * q) * s, art, {
            blick: -von, schlag: t * 9, offen: 0.5, sitzt: false, dreh: von * q * 7, alpha: 1 - Math.max(0, q - 0.7) / 0.3,
          });
          // Ein paar Sterne um den Kopf – kurz.
          if (q < 0.5) {
            g.fillStyle = "#ffe08a";
            g.globalAlpha = 1 - q * 2;
            for (let n = 0; n < 3; n += 1) {
              const w = t * 6 + (n * Math.PI * 2) / 3;
              g.beginPath();
              g.arc(ziel.x + von * (14 + 70 * q) * s + Math.cos(w) * 8 * s, ziel.y + (-6 - 20 * q + 160 * q * q) * s + Math.sin(w) * 3 * s, 1.4 * s, 0, Math.PI * 2);
              g.fill();
            }
            g.globalAlpha = 1;
          }
        }
      }
    }
  }

  // Die Waage über dem Kopf: ein Bogen von ganz links bis ganz rechts, grün
  // in der Mitte, rot am Rand – und ein Zeiger, wohin er gerade neigt.
  const WAAGE = [[-KIPP_MAX, -KNAPP, "255, 77, 77"], [-KNAPP, -0.28, "255, 190, 70"], [-0.28, 0.28, "120, 230, 140"], [0.28, KNAPP, "255, 190, 70"], [KNAPP, KIPP_MAX, "255, 77, 77"]];

  function zeichneWaage() {
    if (state.schritt === "sturz" && state.zeit - state.sturzZeit > 0.4) return;
    const l = state.l;
    const s = view.s;
    const px = bildX(l.x);
    const py = bildY(l.y);
    const R = 74 * s;
    const gf = state.gefahr;
    const grund = state.schritt === "start" ? 0.3 : 0.25 + 0.55 * gf;
    const puls = gf > 0.75 && !ruhig() ? 0.25 * Math.sin(state.echt * 18) : 0;
    g.lineCap = "butt";
    g.lineWidth = Math.max(2.5, 3.2 * s * 0.8);
    WAAGE.forEach(([a, b, farbe], j) => {
      const rand = j === 0 || j === 4;
      g.strokeStyle = `rgba(${farbe}, ${clamp(grund + (rand ? puls : 0), 0, 1)})`;
      g.beginPath();
      g.arc(px, py, R, -Math.PI / 2 + a + 0.015, -Math.PI / 2 + b - 0.015);
      g.stroke();
    });
    const th = state.schritt === "sturz" ? clamp(state.sturz.dreh, -KIPP_MAX, KIPP_MAX) : clamp(l.th, -KIPP_MAX, KIPP_MAX);
    const w = -Math.PI / 2 + th;
    const zx = px + Math.cos(w) * R;
    const zy = py + Math.sin(w) * R;
    const nx = Math.cos(w);
    const ny = Math.sin(w);
    g.fillStyle = gf > 0.75 ? "#ff6b6b" : "#ffffff";
    g.globalAlpha = clamp(0.55 + gf * 0.45, 0, 1);
    g.beginPath();
    g.moveTo(zx - nx * 5 * s, zy - ny * 5 * s);
    g.lineTo(zx + nx * 4 * s - ny * 4 * s, zy + ny * 4 * s + nx * 4 * s);
    g.lineTo(zx + nx * 4 * s + ny * 4 * s, zy + ny * 4 * s - nx * 4 * s);
    g.closePath();
    g.fill();
    g.globalAlpha = 1;
  }

  // Die Gegner als Geist (geist.js): ein Seiltänzer aus Licht auf diesem
  // Seil, an der Stelle, an der sie damals waren.
  function zeichneGeister() {
    if (!gegner || state.phase === "bereit") return;
    const orte = window.LernappGeist?.orte?.(gegner) || [];
    if (!orte.length) return;
    orte.forEach((o) => {
      // Wem im Live-Modus zugeschaut wird, der ist die Figur selbst – kein
      // Geist dazu, nur sein Name (geist.js, namen).
      if (o.ziel) return;
      const x = START.x + o.a;
      if (x < state.camX - 80 || x > state.camX + view.w + 80) return;
      const faellt = o.b < -40;
      const y = faellt ? START.y + o.b : seilY(x);
      const dreh = (o.c || 0) / 100;
      g.globalAlpha = 0.5 * o.blass;
      zeichneFigur(bildX(x), bildY(y), {
        dreh, stange: -dreh * 0.5, phase: x / SCHRITT / 2, geht: faellt ? 0 : 1, arme: faellt ? state.echt * 17 : null, gefahr: 0, sturz: faellt,
      }, o.farbe);
    });
    g.globalAlpha = 1;
    g.lineCap = "butt";
  }

  function zeichneGeisterNamen() {
    if (!gegner || state.phase === "bereit") return;
    const orte = window.LernappGeist?.orte?.(gegner) || [];
    if (!orte.length) return;
    const s = view.s;
    const ich = state.schritt === "sturz" && state.sturz ? state.sturz.x : state.l.x;
    flachTransform();
    window.LernappGeist.namen(g, orte.map((o) => {
      const x = START.x + o.a;
      const y = o.b < -40 ? START.y + o.b : seilY(x);
      const p = geneigt(bildX(x), bildY(y) - 66 * s);
      const dx = x - ich;
      return { ...o, sx: p.x, sy: p.y, weit: `${dx > 0 ? "+" : ""}${Math.round(dx / METER)} m` };
    }), { breit: view.cssW, hoch: view.cssH });
  }

  // ---------------------------------------------------------------------------
  // Zeichnen: Teilchen, Wind, Schriften, Anzeige
  // ---------------------------------------------------------------------------
  function zeichneTeile() {
    if (!state.teile.length) return;
    const s = view.s;
    state.teile.forEach((t) => {
      const k = clamp(t.leben / t.max, 0, 1);
      g.globalAlpha = k;
      if (t.art === "feder") {
        g.globalAlpha = Math.min(1, k * 2.5);
        g.fillStyle = t.farbe;
        g.beginPath();
        g.ellipse(bildX(t.x), bildY(t.y), t.r * s * 1.6, t.r * s * 0.55, Math.sin(t.dreh) * 0.9, 0, Math.PI * 2);
        g.fill();
        return;
      }
      if (t.art === "glanz") g.globalCompositeOperation = "lighter";
      g.fillStyle = t.farbe;
      g.beginPath();
      g.arc(bildX(t.x), bildY(t.y), t.r * s * (t.art === "glanz" ? 0.5 + k : 0.6 + k * 0.4), 0, Math.PI * 2);
      g.fill();
      g.globalCompositeOperation = "source-over";
    });
    g.globalAlpha = 1;
  }

  // Wie stark der Wind gerade zu sehen ist: schon vor der Böe, wenn sie
  // naht, und am stärksten in ihrer Mitte.
  const windSicht = () => Math.max(state.wind.warn * 0.85, state.wind.wirkt) * (0.45 + state.wind.rel);

  function zeichneLuft() {
    const W = view.cssW;
    const H = view.cssH;
    const w = state.wind;
    const st = windSicht();
    if (st > 0.03 && w.dir) {
      // Der Rand, von dem es weht, hellt sich auf.
      const links = w.dir > 0;
      const breite = W * 0.16;
      const v = g.createLinearGradient(links ? 0 : W, 0, links ? breite : W - breite, 0);
      v.addColorStop(0, `rgba(255, 255, 255, ${0.16 * clamp(st, 0, 1)})`);
      v.addColorStop(1, "rgba(255, 255, 255, 0)");
      g.fillStyle = v;
      g.fillRect(links ? 0 : W - breite, 0, breite, H);
    }
    if (state.luft.length) {
      state.luft.forEach((t) => {
        const k = clamp(t.leben / t.max, 0, 1);
        g.globalAlpha = Math.min(1, k * 3) * t.alpha;
        if (t.art === "strich") {
          g.strokeStyle = "#ffffff";
          g.lineWidth = 1.3;
          g.lineCap = "round";
          g.beginPath();
          g.moveTo(t.x, t.y);
          g.quadraticCurveTo(t.x - t.dir * t.lang * 0.5, t.y - 4 * Math.sin(t.phase), t.x - t.dir * t.lang, t.y);
          g.stroke();
          return;
        }
        g.fillStyle = t.farbe;
        if (t.art === "flocke" || t.art === "staub") {
          g.beginPath();
          g.arc(t.x, t.y, t.gross, 0, Math.PI * 2);
          g.fill();
          return;
        }
        const c = Math.cos(t.rot);
        const sn = Math.sin(t.rot);
        g.setTransform(c * view.dpr, sn * view.dpr, -sn * view.dpr, c * view.dpr, t.x * view.dpr, t.y * view.dpr);
        if (t.art === "blatt") {
          g.beginPath();
          g.ellipse(0, 0, t.gross, t.gross * 0.45 * Math.abs(Math.cos(t.phase)) + 0.6, 0, 0, Math.PI * 2);
          g.fill();
        } else {
          g.fillRect(-t.gross / 2, -t.gross * 0.35 * Math.abs(Math.cos(t.phase)) - 0.3, t.gross, t.gross * 0.7 * Math.abs(Math.cos(t.phase)) + 0.6);
        }
        bildTransform();
      });
      g.globalAlpha = 1;
    }
    if (st > 0.05 && w.dir && state.schritt !== "sturz") {
      // Pfeile neben dem Kopf, von der Seite, von der es kommt.
      const p = geneigt(bildX(state.l.x), bildY(state.l.y) - 60 * view.s);
      const s = view.s;
      const schub = ruhig() ? 0 : (state.echt * 30) % 12;
      g.strokeStyle = "#ffffff";
      g.lineWidth = 2.6;
      g.lineCap = "round";
      g.lineJoin = "round";
      for (let j = 0; j < 3; j += 1) {
        const x = p.x - w.dir * (70 - j * 12 - schub) * s;
        g.globalAlpha = clamp(st * 1.4, 0, 1) * (0.35 + 0.25 * j);
        g.beginPath();
        g.moveTo(x - w.dir * 4 * s, p.y - 6 * s);
        g.lineTo(x, p.y);
        g.lineTo(x - w.dir * 4 * s, p.y + 6 * s);
        g.stroke();
      }
      if (w.warn > 0 && w.wirkt === 0) {
        const gross = Math.round(clamp(11 * s, 11, 15));
        g.globalAlpha = clamp(w.warn * 1.5, 0, 1);
        g.font = `800 ${gross}px system-ui, sans-serif`;
        g.textAlign = "center";
        g.textBaseline = "top";
        g.fillStyle = "#ffffff";
        g.fillText("Wind", p.x - w.dir * 58 * s, p.y + 10 * s);
      }
      g.globalAlpha = 1;
    }
  }

  // Wenn es eng wird, glüht der Rand rot – auf der Seite, zu der er kippt.
  function zeichneGefahr() {
    const gf = state.gefahr;
    if (gf < 0.55 || state.schritt !== "lauf") return;
    const W = view.cssW;
    const a = ((gf - 0.55) / 0.45) * 0.45;
    const rechts = state.l.th > 0;
    const breite = W * 0.3;
    const v = g.createLinearGradient(rechts ? W : 0, 0, rechts ? W - breite : breite, 0);
    v.addColorStop(0, `rgba(255, 50, 60, ${a})`);
    v.addColorStop(1, "rgba(255, 50, 60, 0)");
    g.fillStyle = v;
    g.fillRect(rechts ? W - breite : 0, 0, breite, view.cssH);
  }

  function zeichneSchriften() {
    if (!state.schriften.length) return;
    g.textAlign = "center";
    g.textBaseline = "middle";
    state.schriften.forEach((s) => {
      const k = clamp(s.leben / s.max, 0, 1);
      const steig = (1 - k) * 26;
      const p = geneigt(bildX(s.x), bildY(s.y) - steig);
      const pop = 1 + Math.max(0, (k - 0.85) / 0.15) * 0.35;
      g.globalAlpha = Math.min(1, k * 2);
      g.font = `900 ${Math.round(s.gross * clamp(view.s, 1, 2.2) * pop)}px system-ui, sans-serif`;
      g.lineWidth = 4;
      g.strokeStyle = "rgba(7, 11, 36, 0.7)";
      g.strokeText(s.text, p.x, p.y);
      g.fillStyle = s.farbe;
      g.fillText(s.text, p.x, p.y);
    });
    g.globalAlpha = 1;
  }

  // Der Name der neuen Landschaft, gross unter dem Seil.
  function zeichneEtappe() {
    const t = state.echt - state.etappeZeit;
    if (t < 0 || t > 2.8 || state.etappe < 1) return;
    const Z = ZONEN[state.etappe % ZONEN.length];
    const a = Math.min(1, t / 0.4, (2.8 - t) / 0.7);
    const rs = seilSchirm();
    const gross = Math.round(clamp(view.cssH * 0.045, 16, 30));
    g.globalAlpha = clamp(a, 0, 1);
    g.font = `900 ${gross}px system-ui, sans-serif`;
    g.textAlign = "center";
    g.textBaseline = "middle";
    const y = rs + (view.cssH - rs) * 0.3 - (1 - a) * 8;
    g.lineWidth = 5;
    g.strokeStyle = "rgba(7, 11, 36, 0.6)";
    g.strokeText(Z.name, view.cssW / 2, y);
    g.fillStyle = Z.schrift;
    g.fillText(Z.name, view.cssW / 2, y);
    g.globalAlpha = 1;
  }

  // Die Meter oben links – die eigentliche Zahl der Runde. Daneben, solange
  // er im Gleichgewicht bleibt, die Serie.
  function zeichneAnzeige() {
    flachTransform();
    // Auf dem Handy liegt der obere Rand unter den Knöpfen: dann darunter.
    g.translate(0, shell?.frei?.(canvas) || 0);
    const gross = clamp(view.cssH * 0.055, 14, 24);
    g.font = `900 ${Math.round(gross)}px system-ui, sans-serif`;
    g.textAlign = "left";
    g.textBaseline = "middle";
    const text = `${state.meter} m`;
    const w = g.measureText(text).width + gross * 1.1;
    const x = 12;
    const y = 12;
    g.fillStyle = "rgba(7, 11, 36, 0.55)";
    g.beginPath();
    if (g.roundRect) g.roundRect(x, y, w, gross * 1.6, gross * 0.8);
    else g.rect(x, y, w, gross * 1.6);
    g.fill();
    g.fillStyle = "#ffffff";
    g.fillText(text, x + gross * 0.55, y + gross * 0.82);
    if (state.ruheN > 0 && state.schritt === "lauf") {
      const serie = `×${state.ruheN}`;
      const klein = Math.round(gross * 0.75);
      g.font = `900 ${klein}px system-ui, sans-serif`;
      const sw = g.measureText(serie).width + klein;
      const sx = x + w + 6;
      g.fillStyle = "rgba(255, 209, 102, 0.9)";
      g.beginPath();
      if (g.roundRect) g.roundRect(sx, y + gross * 0.2, sw, gross * 1.2, gross * 0.6);
      else g.rect(sx, y + gross * 0.2, sw, gross * 1.2);
      g.fill();
      g.fillStyle = "#3a2400";
      g.fillText(serie, sx + klein * 0.5, y + gross * 0.82);
    }
  }

  function zeichnen() {
    if (!g) return;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, canvas.width, canvas.height);
    const e = etappeBei(state.l.x);
    vorbauen(e);
    // Der Hintergrund steht gerade – gedreht wären die grossen Bilder teuer.
    bildTransform();
    zeichneHimmel(e);
    zeichnePolarlicht(gewicht(e, 2));
    zeichneVoegel(gewicht(e, 0));
    zeichneWolken(e, false);
    zeichneLage(e, "mitte", 0.2);
    zeichneWolken(e, true);
    // Die nahe Welt neigt sich mit.
    szeneTransform();
    const { ms, von, bis } = sichtbareMasten();
    for (let i = von; i <= bis; i += 1) zeichneStuetze(ms[i]);
    zeichneNetz();
    zeichneMasten();
    zeichneSeil();
    zeichneZiele();
    zeichneGeister();
    zeichneTeile();
    zeichneLaeufer();
    zeichneStoerVoegel();
    zeichneWaage();
    bildTransform();
    zeichneLuft();
    zeichneGefahr();
    zeichneGeisterNamen();
    bildTransform();
    zeichneSchriften();
    zeichneEtappe();
    zeichneAnzeige();
  }

  // ---------------------------------------------------------------------------
  // Teilchen und Schriften
  // ---------------------------------------------------------------------------
  function funken(x, y, anzahl, farben, art = "funke") {
    if (ruhig()) anzahl = Math.ceil(anzahl / 3);
    for (let i = 0; i < anzahl; i += 1) {
      const w = Math.random() * Math.PI * 2;
      const v = 30 + Math.random() * 110;
      state.teile.push({
        art, x, y, vx: Math.cos(w) * v, vy: Math.sin(w) * v + 20,
        r: 1.2 + Math.random() * 2, farbe: farben[i % farben.length], leben: 0.5 + Math.random() * 0.6, max: 1.1,
      });
    }
    if (state.teile.length > 160) state.teile.splice(0, state.teile.length - 160);
  }

  // Federn: Sie trudeln langsam hinab.
  function federn(x, y, anzahl, farben) {
    if (ruhig()) anzahl = Math.ceil(anzahl / 3);
    for (let i = 0; i < anzahl; i += 1) {
      const w = Math.random() * Math.PI * 2;
      const v = 20 + Math.random() * 60;
      state.teile.push({
        art: "feder", x, y, vx: Math.cos(w) * v, vy: Math.sin(w) * v + 25, r: 2.2 + Math.random() * 1.6,
        dreh: Math.random() * 6, farbe: farben[i % farben.length], leben: 1.4 + Math.random() * 0.9, max: 2.3,
      });
    }
    if (state.teile.length > 160) state.teile.splice(0, state.teile.length - 160);
  }

  function schrift(text, x, y, farbe, gross) {
    state.schriften.push({ text, x, y, farbe, gross, leben: 1.2, max: 1.2 });
  }

  // Der Wind im Bild: bei einer Böe Striche und Blätter (Papier, Schnee)
  // von ihrer Seite her, quer durchs Bild; dazu, je nach Landschaft, Staub
  // oder fallender Schnee.
  function luftTakt(dt) {
    const W = view.cssW;
    const H = view.cssH;
    if (!W) return;
    const w = state.wind;
    const e = etappeBei(state.l.x);
    const Z = ZONEN[e.k < 0.5 ? e.a : e.b];
    const st = windSicht();
    const dichte = ruhig() ? 0.3 : 1;
    if (st > 0.02 && w.dir && state.schritt !== "start") {
      state.luftKonto += 46 * st * dichte * dt;
      const rs = seilSchirm();
      while (state.luftKonto >= 1 && state.luft.length < LUFT_MAX) {
        state.luftKonto -= 1;
        const strich = Math.random() < 0.4;
        const v = W * (0.55 + Math.random() * 0.5) * (0.6 + Math.min(1, st));
        state.luft.push({
          art: strich ? "strich" : Z.luftArt,
          x: w.dir > 0 ? -30 : W + 30,
          y: rs - rs * 0.55 * Math.random() + (H - rs) * 0.6 * Math.random(),
          vx: w.dir * v * (strich ? 1.3 : 1), vy: (Math.random() - 0.5) * 40,
          dir: w.dir, lang: 30 + Math.random() * 50, gross: 2.5 + Math.random() * 3,
          rot: Math.random() * 6, vr: (Math.random() - 0.5) * 12, phase: Math.random() * 6,
          farbe: Z.luft[Math.floor(Math.random() * Z.luft.length)], alpha: strich ? 0.35 + Math.random() * 0.3 : 0.9,
          leben: 3, max: 3,
        });
      }
    } else {
      state.luftKonto = 0;
    }
    // Was in der Luft liegt, auch ohne Böe.
    const ruhe = Z.luftArt === "flocke" ? 7 : (Z.luftArt === "blatt" ? 2.5 : 0);
    if (ruhe && Math.random() < ruhe * dichte * dt && state.luft.length < LUFT_MAX) {
      const schnee = Z.luftArt === "flocke";
      state.luft.push({
        art: schnee ? "flocke" : "staub",
        x: Math.random() * (W + 60), y: schnee ? -10 : seilSchirm() + (Math.random() - 0.3) * H * 0.5,
        vx: -10, vy: schnee ? 18 + Math.random() * 24 : (Math.random() - 0.5) * 8,
        dir: 0, lang: 0, gross: schnee ? 0.8 + Math.random() * 1.6 : 0.8 + Math.random() * 1.2,
        rot: 0, vr: 0, phase: Math.random() * 6, farbe: schnee ? "#ffffff" : "#ffd9a0", alpha: schnee ? 0.75 : 0.5,
        leben: schnee ? 9 : 5, max: schnee ? 9 : 5, mitWelt: true,
      });
    }
    const zug = state.schritt === "lauf" ? state.l.v * view.s : 0;
    for (let i = state.luft.length - 1; i >= 0; i -= 1) {
      const t = state.luft[i];
      t.phase += dt * 5;
      t.rot += t.vr * dt;
      t.x += (t.vx - (t.mitWelt ? zug * 0.8 : 0)) * dt;
      t.y += (t.vy + Math.sin(t.phase) * (t.art === "strich" ? 10 : 30)) * dt;
      t.leben -= dt;
      if (t.leben <= 0 || t.x < -80 || t.x > W + 80 || t.y > H + 20) state.luft.splice(i, 1);
    }
  }

  // ---------------------------------------------------------------------------
  // Der Lauf
  // ---------------------------------------------------------------------------
  function physik(dt) {
    const l = state.l;
    const k = schwereBei(l.x);
    l.v = tempoBei(l.x);
    l.p += (lehne - l.p) * Math.min(1, STANGE_TEMPO * dt);
    const alle = state.welt.ereignisse;
    while (alle[state.ereignis] && alle[state.ereignis].x1 < l.x) state.ereignis += 1;
    l.w += (-AUFRICHT * Math.sin(l.th) + STANGE * l.p - daempf(k) * l.w + stoerung(l.x, k)) * dt;
    l.th += l.w * dt;
    // Ein Ruck auf einmal: ein Vogel landet, fliegt auf oder prallt gegen ihn.
    const vorher = l.x;
    l.x += l.v * dt;
    for (let i = state.ereignis; i < alle.length && alle[i].x0 <= l.x + 1; i += 1) {
      for (const s of alle[i].stoesse || []) if (s.x > vorher && s.x <= l.x) l.w += s.w;
    }
    state.gang += (l.v * dt) / SCHRITT;
    state.schwing += Math.PI * 2 * SCHWING_HZ * dt;
    if (state.spanne && state.spanne.L && l.x > state.spanne.x + state.spanne.L) state.spanne = spanneBei(l.x);
    if (Math.abs(l.th) > KIPP_MAX) stuerzen(false);
  }

  // Er kippt: Die Füsse rutschen vom Seil, die Stange fliegt davon, und er
  // fällt rudernd ins Netz. Beim Zuschauen kommt die Bahn aus der Aufnahme
  // (gefuehrt) – nur die Stange fällt dann von allein.
  function stuerzen(gefuehrt) {
    if (state.schritt === "sturz") return;
    const l = state.l;
    const dir = Math.sign(l.th) || 1;
    state.schritt = "sturz";
    state.sturzZeit = state.zeit;
    state.gekippt = dir;
    // Woran es lag: Hielt er zur selben Seite, hat er zu lange gehalten; kam
    // die Störung von der anderen Seite, hat er zu wenig gegengehalten.
    const e = letzteStoerung(l.x);
    const wirkt = e && Math.sign(e.wohin) === dir;
    state.sturzGrund = Math.sign(l.p) === dir && Math.abs(l.p) > 0.3 ? "gehalten" : wirkt ? e.art : "";
    state.sturzSeite = e?.wohin || 0;
    state.stoss = 1;
    state.lupe = 0;
    state.ruheN = 0;
    const stangeX = l.x + Math.sin(l.th) * 31;
    const stangeY = l.y + Math.cos(l.th) * 31;
    state.sturz = {
      x: l.x, y: l.y, vx: dir * 45 + l.v * 0.35, vy: 30, dreh: l.th, w: dir * 3.2 + l.w, dir, liegt: false, gefuehrt,
      stange: { x: stangeX, y: stangeY, vx: -dir * 25 + l.v * 0.3, vy: 70, dreh: l.th + l.p * 0.2, w: -dir * 4.5, liegt: false },
    };
    funken(l.x, l.y + 2, 10, ["#ffffff", "#ffd166"]);
    klang()?.ton("seiltaenzer.absturz");
    if (gefuehrt) return;
    kids()?.vibrate?.([30, 40, 60]);
    stepTimer = window.setTimeout(finish, 1250);
  }

  /*
   * Was beim Anflug, Landen, Auffliegen und Aufprallen zu hören und zu sehen
   * ist – im Spiel wie beim Zuschauen: einmal, wenn er an der Stelle
   * vorbeikommt. (Den Ruck selbst gibt physik.)
   */
  function ereignisZeichen() {
    const x = state.l.x;
    if (state.schritt !== "lauf" || x <= state.gesehen) return;
    const alle = state.welt.ereignisse;
    const hoeren = state.phase === "spiel" || state.phase === "zuschauen";
    for (let i = Math.max(0, state.ereignis - 1); i < alle.length && alle[i].x0 - 400 <= x; i += 1) {
      for (const s of alle[i].stoesse || []) {
        if (s.x <= state.gesehen || s.x > x) continue;
        if (s.art === "ramme") {
          // Federn fliegen, wo der Vogel ihn trifft.
          const by = state.l.y + 36 + alle[i].hoehe * 8;
          federn(x + s.seite * 6, by, 16, vogelFarben(x));
          state.stoss = Math.max(state.stoss, 0.6);
          if (hoeren) klang()?.ton("seiltaenzer.stoss", { laut: 0.9 });
          if (state.phase === "spiel") kids()?.vibrate?.([18, 30, 18]);
        } else if (hoeren) {
          klang()?.ton("seiltaenzer.flattern", { laut: s.art === "anflug" ? 0.45 : 0.6 });
          if (s.art === "landen") federn(x + s.seite * 58, state.l.y + 38, 4, vogelFarben(x));
        }
      }
    }
    state.gesehen = x;
  }

  // Die Störung, die ihn eben noch bedrängte – und wohin sie ihn drückte
  // (bei zwei Vögeln: wohin es zuletzt zog).
  function letzteStoerung(x) {
    const alle = state.welt.ereignisse;
    for (let i = Math.min(state.ereignis, alle.length - 1); i >= Math.max(0, state.ereignis - 2); i -= 1) {
      const e = alle[i];
      if (!e || x < e.x0 - 20 || x > e.x1 + strecke(e.x1, 0.9)) continue;
      let wohin = e.dir;
      if (e.art === "vogel") {
        const q = Math.min(x, e.x1 - 1);
        wohin = kraftVon(e, q) || e.voegel[e.voegel.length - 1].seite;
      }
      return { art: e.art, wohin };
    }
    return null;
  }

  function netzTreffer(x, tempo) {
    state.netz = { x, tiefe: clamp(tempo * 0.06, 4, 18), zeit: state.zeit };
    state.stoss = Math.max(state.stoss, 0.45);
    funken(x, netzY(x) + 2, 12, ["#ffffff", "#e9ecff"]);
    if (state.phase !== "zuschauen") kids()?.vibrate?.(20);
  }

  function sturzTakt(dt) {
    const st = state.sturz;
    if (!st) return;
    if (!st.gefuehrt) {
      st.vy -= 680 * dt;
      st.x += st.vx * dt;
      st.y += st.vy * dt;
      st.dreh += st.w * dt;
      if (Math.abs(st.dreh) > 1.55) { st.dreh = st.dir * 1.55; st.w = 0; }
      const ny = netzY(st.x);
      if (st.y <= ny && st.vy <= 0) {
        if (!st.liegt && st.vy < -60) netzTreffer(st.x, -st.vy);
        st.y = ny;
        st.vy = -st.vy * 0.38;
        st.vx *= 0.5;
        if (Math.abs(st.vy) < 30) { st.vy = 0; st.liegt = true; }
      }
      if (st.liegt) { st.y = ny; st.vx *= 1 - Math.min(1, dt * 4); }
    } else if (!st.liegt && st.y <= netzY(st.x) + 3) {
      st.liegt = true;
      netzTreffer(st.x, 300);
    }
    const p = st.stange;
    p.vy -= 680 * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.dreh += p.w * dt;
    const py = netzY(p.x) + 2;
    if (p.y <= py && p.vy < 0) {
      p.y = py;
      p.vy = -p.vy * 0.3;
      p.vx *= 0.5;
      p.w *= 0.4;
      if (Math.abs(p.vy) < 25) { p.vy = 0; p.liegt = true; }
    }
    if (p.liegt) { p.y = py; p.vx *= 1 - Math.min(1, dt * 4); p.w *= 1 - Math.min(1, dt * 5); }
    // Im Netz legt sich die Stange flach.
    if (p.liegt || p.y < py + 12) {
      const flach = Math.round(p.dreh / Math.PI) * Math.PI;
      p.dreh += (flach - p.dreh) * Math.min(1, dt * 9);
    }
    // Das Seil schnellt zurück, wo er eben noch stand.
    const t = state.zeit - state.sturzZeit;
    state.delle = Math.cos(t * 11) * Math.exp(-t * 3.5);
  }

  // Eine Störung ist vorbei: Stand er dabei kaum schief, hat er sie
  // pariert, und die Reihe wächst – sonst beginnt sie von vorn. Beim
  // Zuschauen ohne Schrift.
  const PARIERT_WORT = { boe: "Böe pariert!", vogel: "Vogel ausbalanciert!", ramme: "Zusammenstoss pariert!" };
  function ereignisBilanz(mitSchrift) {
    const l = state.l;
    // Erst die vorige abschliessen – eine Doppelböe folgt ihr dicht.
    if (state.ereignisIn >= 0 && state.ereignisIn !== state.ereignis) {
      const art = state.welt.ereignisse[state.ereignisIn]?.art || "boe";
      const sauber = state.ereignisMax < (PARIERT_JE[art] || PARIERT);
      state.ereignisIn = -1;
      if (!sauber) state.ruheN = 0;
      else {
        state.ruheN += 1;
        state.glanz = 1;
        ruheKlang(state.ruheN);
        if (mitSchrift) {
          schrift(state.ruheN >= 2 ? `Pariert ×${state.ruheN}` : PARIERT_WORT[art], l.x, l.y + 82, "#ffe08a", 13);
          funken(l.x, l.y + 30, 16, ["#fff4d6", "#ffd166", "#ffe08a"], "glanz");
        }
      }
    }
    const e = state.welt.ereignisse[state.ereignis];
    if (e && l.x >= e.x0 && l.x <= e.x1) {
      if (state.ereignisIn !== state.ereignis) { state.ereignisIn = state.ereignis; state.ereignisMax = 0; }
      state.ereignisMax = Math.max(state.ereignisMax, Math.abs(l.th));
    }
  }

  // Beinahe gefallen und doch gehalten – und eine Böe sauber pariert: beides
  // gibt es zu sehen und zu hören.
  function rueckmeldung(dt) {
    const l = state.l;
    const a = Math.abs(l.th);
    if (a > KNAPP) state.knapp = true;
    else if (state.knapp && a < 0.25) {
      state.knapp = false;
      if (state.zeit - state.knappZeit > 2.5) {
        state.knappZeit = state.zeit;
        schrift("knapp!", l.x, l.y + 82, "#ffb347", 15);
        funken(l.x, l.y + 48, 10, ["#ffb347", "#ffd166", "#ffffff"]);
        if (!ruhig()) state.lupe = LUPE;
        kids()?.vibrate?.(12);
      }
    }
    ereignisBilanz(true);
    state.glanz = Math.max(state.ruheN > 0 ? 0.35 : 0, state.glanz - dt * 0.6);
  }

  function takt(dt) {
    state.echt += dt;
    if (state.lupe > 0) {
      state.lupe -= dt;
      dt *= LUPE_TEMPO;
    }
    state.zeit += dt;
    if (state.stoss > 0) state.stoss = Math.max(0, state.stoss - dt * 2.5);
    const l = state.l;

    if (state.phase === "zuschauen") {
      zuschauenTakt(dt);
    } else if (state.schritt === "lauf") {
      weltBis(l.x + 2000);
      const n = Math.max(1, Math.ceil(dt / TAKT));
      for (let i = 0; i < n && state.schritt === "lauf"; i += 1) physik(dt / n);
      if (state.schritt === "lauf") {
        l.y = seilY(l.x);
        rueckmeldung(dt);
        ereignisZeichen();
      }
      const meter = Math.floor(meterBei(l.x));
      if (meter !== state.meter && state.schritt === "lauf") {
        if (Math.floor(meter / 100) > Math.floor(state.meter / 100)) {
          schrift(`${Math.floor(meter / 100) * 100} m`, l.x + 40, l.y + 64, "#ffffff", 17);
        }
        state.meter = meter;
        state.punkte = meter;
        shell.setCount(meter);
      }
    } else if (state.schritt === "start") {
      // Vor dem ersten Druck wiegt er sich auf dem Podest.
      const t = state.echt;
      l.th = ruhig() ? 0 : Math.sin(t * 1.6) * 0.05;
      l.p = ruhig() ? 0 : -Math.sin(t * 1.6 - 0.5) * 0.6;
      l.y = 0;
    }
    if (state.schritt === "sturz") sturzTakt(dt);
    if (state.schritt === "lauf" && (state.phase === "spiel" || state.phase === "zuschauen")) schrittKlang();

    // Fürs Bild: Gehen, Blick, Gefahr, Wind, Wimpel, Kamera.
    state.geht += ((state.schritt === "lauf" ? 1 : 0) - state.geht) * Math.min(1, dt * 6);
    state.blick += (clamp(l.th * 5, -1.3, 1.3) - state.blick) * Math.min(1, dt * 8);
    const gf = state.schritt === "lauf" ? Math.abs(l.th) / KIPP_MAX : 0;
    state.gefahr += (gf - state.gefahr) * Math.min(1, dt * 14);
    windLage();
    if (state.schritt === "lauf" && (state.phase === "spiel" || state.phase === "zuschauen")) boeKlang();
    const wind = state.wind;
    const fahneZiel = wind.dir ? -0.3 + wind.dir * (wind.warn * 0.6 + wind.wirkt) * 1.3 : -0.3;
    state.fahne += (clamp(fahneZiel, -1, 1) - state.fahne) * Math.min(1, dt * 3);
    luftTakt(dt);

    for (let i = state.teile.length - 1; i >= 0; i -= 1) {
      const t = state.teile[i];
      if (t.art === "feder") {
        // Eine Feder fällt langsam, und sie pendelt.
        t.vy += (-28 - t.vy) * Math.min(1, dt * 2.5);
        t.vx += (Math.sin(state.echt * 4 + t.dreh) * 26 - t.vx) * Math.min(1, dt * 2);
        t.dreh += dt * 3;
      } else t.vy -= (t.art === "glanz" ? 20 : 220) * dt;
      t.vx *= 1 - 1.4 * dt;
      t.x += t.vx * dt;
      t.y += t.vy * dt;
      t.leben -= dt;
      if (t.leben <= 0) state.teile.splice(i, 1);
    }
    for (let i = state.schriften.length - 1; i >= 0; i -= 1) {
      state.schriften[i].leben -= dt;
      if (state.schriften[i].leben <= 0) state.schriften.splice(i, 1);
    }

    // Eine neue Landschaft beginnt.
    const n = Math.floor(meterBei(l.x) / ETAPPE);
    if (n > state.etappe) {
      state.etappe = n;
      state.etappeZeit = state.echt;
    }

    // Die Kamera: folgt ihm; beim Sturz fährt sie ein Stück mit nach unten.
    if (state.schritt === "sturz" && state.sturz) {
      const st = state.sturz;
      state.camX += (st.x - view.w * LAEUFER_AN - state.camX) * Math.min(1, dt * 3);
      const ziel = Math.min(0, st.y + 30) * 0.85;
      state.camFall += (ziel - state.camFall) * Math.min(1, dt * 5);
    } else {
      state.camX = camXZiel();
      state.camFall += (0 - state.camFall) * Math.min(1, dt * 5);
    }
    state.camY = state.camBasis + state.camFall;
    const rolle = state.schritt === "lauf" && !ruhig() ? clamp(l.th * 0.045, -0.026, 0.026) : 0;
    state.rolle += (rolle - state.rolle) * Math.min(1, dt * 5);
    weltBis(state.camX + view.w + 400);

    if (state.phase === "spiel") {
      const st = state.sturz;
      const a = st && state.schritt === "sturz" ? { x: st.x, y: st.y, c: st.dreh } : { x: l.x, y: l.y, c: l.th };
      gegner?.takt(state.punkte, { a: Math.round(a.x - START.x), b: Math.round(a.y - START.y), c: Math.round(a.c * 100) });
    }
  }

  // Die Böe, die gerade weht oder als nächste kommt – fürs Bild.
  function windLage() {
    const w = state.wind;
    w.warn = 0;
    w.wirkt = 0;
    if (state.schritt === "start") return;
    const x = state.schritt === "sturz" && state.sturz ? state.sturz.x : state.l.x;
    const alle = state.welt.ereignisse;
    while (alle[state.ereignis] && alle[state.ereignis].x1 < x) state.ereignis += 1;
    const b = alle[state.ereignis];
    if (!b || b.art !== "boe") return;
    w.dir = b.dir;
    w.rel = clamp(b.G / STANGE, 0, 1);
    if (x >= b.x0) {
      const s = Math.sin(Math.PI * (x - b.x0) / (b.x1 - b.x0));
      w.wirkt = s * s;
    } else if (state.schritt === "lauf") {
      const t = (b.x0 - x) / Math.max(10, state.l.v || tempoBei(x));
      if (t < VORWARNUNG) w.warn = 1 - t / VORWARNUNG;
    }
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
  // Zuschauen
  // ---------------------------------------------------------------------------
  // Ein aufgezeichneter Lauf auf seinem eigenen Seil: Der Zufall hält die
  // Saat (geist.js, zuschauer), startRun baut damit dieselbe Strecke, und
  // der Seiltänzer steht Bild für Bild dort, wo er damals war, so schief, wie
  // er damals stand. Was er gedrückt hat, steht nicht in der Aufnahme – die
  // Stange hält hier einfach gegen die Neigung.
  function zuschauenStarten() {
    if (!zuschauer?.lauf) return;
    startRun();
    state.phase = "zuschauen";
    state.schritt = "lauf";
    shell.setPhase("play");
    zuschauer.los();
  }

  function zuschauenTakt(dt) {
    const s = zuschauer.stand();
    if (!s) return;
    const l = state.l;
    const x = START.x + s.a;
    const th = (s.c || 0) / 100;
    if (state.schritt !== "sturz" && (s.b < -40 || Math.abs(th) > KIPP_MAX + 0.02)) {
      l.th = clamp(th, -KIPP_MAX - 0.05, KIPP_MAX + 0.05);
      stuerzen(true);
    }
    if (state.schritt === "sturz") {
      const st = state.sturz;
      st.x = x;
      st.y = Math.min(START.y + s.b, seilY(x));
      st.dreh = th;
    } else {
      weltBis(x + 2000);
      const alt = l.th;
      l.x = x;
      l.th = th;
      l.v = Math.max(0, s.va || 0);
      l.w += ((th - alt) / Math.max(dt, 1e-3) - l.w) * Math.min(1, dt * 10);
      l.p += (clamp(-l.th * 2.2 - l.w * 0.5, -1, 1) - l.p) * Math.min(1, dt * 8);
      state.gang += (l.v * dt) / SCHRITT;
      state.schwing += Math.PI * 2 * SCHWING_HZ * dt;
      state.spanne = spanneBei(l.x);
      l.y = seilY(l.x);
      rueckmeldungZuschauen();
      ereignisZeichen();
    }
    const meter = Math.max(0, Math.floor(s.punkte));
    if (meter !== state.meter) {
      state.meter = meter;
      state.punkte = meter;
      shell.setCount(meter);
    }
    zuschauer.weiter();
  }

  // Beim Zuschauen nur das Leuchten und der Klang – ohne Schrift.
  function rueckmeldungZuschauen() {
    ereignisBilanz(false);
    state.glanz = Math.max(state.ruheN > 0 ? 0.35 : 0, state.glanz - 0.01);
  }

  // ---------------------------------------------------------------------------
  // Halten und Loslassen
  // ---------------------------------------------------------------------------
  // Die Runde beginnt: mit dem ersten Druck – oder im Live-Modus zum
  // gemeinsamen Start (game-shell.js, live.los).
  function losGehts() {
    if (state.phase !== "bereit") return;
    state.phase = "spiel";
    state.schritt = "lauf";
    const l = state.l;
    l.th = 0.02;
    l.w = 0;
    l.p = 0;
    l.v = tempoBei(l.x);
    state.spanne = spanneBei(l.x);
    shell.setPhase("play");
    gegner?.los();
    kids()?.vibrate?.(8);
  }

  function lehneNeu() {
    lehne = finger.length ? finger[finger.length - 1].r : 0;
    knoepfe?.querySelector(".st-knopf-l")?.classList.toggle("ist-an", lehne < 0);
    knoepfe?.querySelector(".st-knopf-r")?.classList.toggle("ist-an", lehne > 0);
  }

  // Ein Finger (oder eine Taste) kommt: Er lehnt, bis er geht. Der erste
  // startet die Runde.
  function fingerAuf(id, r) {
    if (state.phase === "zuschauen") return;
    const da = finger.findIndex((f) => f.id === id);
    if (da >= 0) finger.splice(da, 1);
    finger.push({ id, r });
    lehneNeu();
    losGehts();
  }

  function fingerWeg(id) {
    const da = finger.findIndex((f) => f.id === id);
    if (da < 0) return;
    finger.splice(da, 1);
    lehneNeu();
  }

  function alleWeg() {
    finger.length = 0;
    lehneNeu();
  }

  // Für die Prüfskripte und die Vorführung: lehnen wie mit einem Finger –
  // −1 links, 1 rechts, 0 loslassen. Die erste Lehne startet die Runde.
  function lehnen(r) {
    finger.length = 0;
    if (r) finger.push({ id: "auto", r: Math.sign(r) });
    lehneNeu();
    if (r) losGehts();
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
    state.l = { x: START.x, y: START.y, th: 0, w: 0, p: 0, v: 0 };
    state.gang = 0;
    state.geht = 0;
    state.schwing = 0;
    state.welt = { masten: [{ x: START.x, L: 0, phase: 0, i: 0 }], ereignisse: [], naechstes: 0, doppel: 0, vorher: "" };
    state.welt.naechstes = STOER_AB + 15 * zufall.zahl();
    state.ereignis = 0;
    state.gesehen = START.x;
    state.wind = { warn: 0, wirkt: 0, dir: 0, rel: 0 };
    state.fahne = -0.3;
    state.camFall = 0;
    state.rolle = 0;
    state.sturz = null;
    state.netz = null;
    state.delle = 1;
    state.teile = [];
    state.luft = [];
    state.luftKonto = 0;
    state.schriften = [];
    state.stoss = 0;
    state.zeit = 0;
    state.echt = 0;
    state.lupe = 0;
    state.knapp = false;
    state.knappZeit = -9;
    state.ruheN = 0;
    state.ereignisMax = 0;
    state.ereignisIn = -1;
    state.sturzSeite = 0;
    state.glanz = 0;
    state.gefahr = 0;
    state.gekippt = 0;
    state.sturzGrund = "";
    state.etappe = 0;
    state.etappeZeit = -9;
    state.blick = 0;
    finger.length = 0;
    lehne = 0;
    schrittGezaehlt = 0;
    boeGehoert = -1;
    weltBis(START.x + 2000);
    state.spanne = spanneBei(START.x);
    shell.setCount(0);
    gegner?.runde();

    shell.clear();
    const prompt = shell.el("p", "cm-prompt st-prompt", "Links halten – nach links lehnen, rechts – nach rechts. Halt gegen Böen und Vögel.");
    shell.play.append(prompt, buildPlatz());
    lehneNeu();
    view.cssW = 0;
    view.cssH = 0;
    messen();
    state.camX = camXZiel();
    state.camY = state.camBasis;
    weltBis(state.camX + view.w + 400);

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
    const geist = gegner?.ende(punkte) || null;
    const vorher = Number(store.read()?.scores?.[0]) || 0;
    const rekord = punkte > vorher;
    store.update((old) => ({
      runs: (Number(old.runs) || 0) + 1,
      scores: [...(old.scores || []), punkte].sort((x, y) => y - x).slice(0, TOP_COUNT),
    }));
    // Woran es lag: zu lange gehalten, oder eine Störung ohne Gegenhalten.
    const seite = state.gekippt > 0 ? "rechts" : "links";
    const gegen = state.gekippt > 0 ? "links" : "rechts";
    const GRUND = {
      gehalten: `Zu lange ${seite} gehalten – früher loslassen`,
      boe: `Die Böe von ${gegen} – rechtzeitig ${gegen} halten`,
      vogel: `Der Vogel ${seite} auf der Stange – ${gegen} gegenhalten`,
      ramme: `Der Vogel von ${gegen} – vorher ${gegen} hineinlehnen`,
    };
    const grund = !state.gekippt ? "" : GRUND[state.sturzGrund] || `Nach ${seite} gekippt`;
    const best = vorher ? `Bestwert ${vorher} m` : "";
    shell.showResult({
      label: "Deine Meter",
      points: punkte,
      detail: rekord ? "Neuer Rekord!" : [grund, best].filter(Boolean).join(" · "),
      geist,
    });
    if (rekord) host.querySelector(".cm-result-detail")?.classList.add("st-rekord");
    zaehleHoch(punkte);
  }

  // ---------------------------------------------------------------------------
  // Start
  // ---------------------------------------------------------------------------
  shell = shellApi.mount({
    host,
    title: "Seiltänzer",
    area: "konzentration",
    accent: "#00A5B5",
    accentDark: "#00707c",
    clock: false,
    onRestart: () => (zuschauer ? zuschauenStarten() : startRun()),
    live: { los: losGehts, stopp: () => finish(), zuschauen: (quelle) => { zuschauer = quelle; zuschauenStarten(); } },
  });
  zuschauer = window.LernappGeist?.zuschauer?.({
    host, spiel: "ropeWalk", fassung: "t4", zufall, einheit: "m", nochmal: zuschauenStarten,
  }) || null;
  if (!zuschauer) {
    // Fassung t4: Böen und Vögel (ohne die Wellen von t3). Ältere Läufe
    // gehören nicht dazu – ihre Welt sah anders aus.
    gegner = window.LernappGeist?.fuer?.({ spiel: "ropeWalk", host, art: "tempo", fassung: "t4", alle: true, zufall, gleichschritt: true }) || null;
  }

  startRun();
  zuschauer?.laden.then((da) => { if (da) zuschauenStarten(); });

  // Ein Finger auf der linken Hälfte lehnt nach links, auf der rechten nach
  // rechts. Nur Knöpfe bleiben Knöpfe.
  host.addEventListener("pointerdown", (event) => {
    if (event.target.closest("button, a, input")) return;
    const rahmen = (feld || host).getBoundingClientRect();
    fingerAuf(event.pointerId, event.clientX < rahmen.left + rahmen.width / 2 ? -1 : 1);
  });
  window.addEventListener("pointerup", (event) => fingerWeg(event.pointerId));
  window.addEventListener("pointercancel", (event) => fingerWeg(event.pointerId));
  // Wer das Fenster verlässt, nimmt auch die Finger vom Bild.
  window.addEventListener("blur", alleWeg);

  // Pfeil links oder A, Pfeil rechts oder D. Leertaste und Enter starten nur.
  // Steht der Fokus auf einem Knopf, gilt die Taste dem Knopf.
  const seiteDerTaste = (event) => {
    if (event.key === "ArrowLeft" || event.code === "KeyA") return -1;
    if (event.key === "ArrowRight" || event.code === "KeyD") return 1;
    return 0;
  };
  document.addEventListener("keydown", (event) => {
    const r = seiteDerTaste(event);
    const start = event.key === " " || event.key === "Enter";
    if (!r && !start) return;
    if (document.activeElement?.tagName === "BUTTON") return;
    event.preventDefault();
    if (event.repeat) return;
    if (r) fingerAuf(r < 0 ? "taste-l" : "taste-r", r);
    else losGehts();
  });
  document.addEventListener("keyup", (event) => {
    const r = seiteDerTaste(event);
    if (r) fingerWeg(r < 0 ? "taste-l" : "taste-r");
  });

  window.addEventListener("resize", messen);
  window.addEventListener("orientationchange", messen);
  window.addEventListener("pagehide", () => { clearStep(); stopLoop(); });

  // Für die Prüfskripte.
  window.LernappSeiltaenzer = {
    METER, KIPP_MAX, TAKT, AUFRICHT, STANGE, BOE_RESERVE, state, view, takt, zeichnen, lehnen, losGehts,
    weltBis, spanneBei, seilY, tempoBei, schwereBei, daempf, kraftVon,
  };
})();
