/*
 * schwarm.js – Schwarm.
 * ---------------------------------------------------------------------------
 * Ein Starenschwarm zieht im Abendlicht über das Meer, der Sonne entgegen.
 * Die Regel: Links lenkt nach links, rechts nach rechts, beide zusammen
 * ballen den Schwarm. Aufgefächert zählt er, geballt kommt er durch.
 *
 * Jede Reihe Hindernisse – Felsnadeln, ein grosser Fels mitten im Weg, ein
 * Felsbogen, eine Felswand mit Spalt, Windräder, eine Stromleitung – lässt
 * am freien Weg eine Lücke, und in ihrer Mitte hängt ein goldener Ring. Wer
 * die Mitte des Schwarms genau hindurchführt und keinen Vogel verliert,
 * fliegt perfekt: Vögel schliessen sich an, in der Kette immer mehr. Was über
 * den Fels hinausragt, bleibt hängen – genau dort, wo man es sieht; kein
 * Vogel weicht von selbst aus. Trifft die Mitte den Fels, ist die Runde
 * vorbei. Durch die engen Spalten kommt nur ein geballter Schwarm – aber
 * geballt lenkt er nicht und zählt nicht: vorher ausrichten, spät ballen,
 * gleich wieder lösen. Und auf offenen Stücken stösst ein Falke zu: Wer im
 * letzten Moment ballt, pariert ihn; aufgefächert reisst er ein Sechstel
 * heraus.
 *
 * Der Schwarm ist das Leben und die Punktzahl zugleich: Hundert Vögel
 * bringen alle dreissig Meter einen Punkt (PUNKTE_JE_100M), aufgefächert.
 * Ein grosser Schwarm zählt schneller und muss öfter ballen. Die Runde endet,
 * wenn die Mitte am Fels zerschellt, wenn weniger als ein Dutzend übrig sind
 * (dann zerstreut sich der Schwarm), oder am Schlafplatz: Dort, nach 3600
 * Metern und drei letzten Felswänden, ist es Nacht geworden, und jeder
 * Vogel, der ankommt, zählt noch einen Punkt.
 *
 * Gebaut wird der Abend aus dem Zufall (zufall.js): ohne Turnier jedes Mal
 * ein anderer, im Turnier für alle im selben Versuch derselbe. Von Tor zu
 * Tor geht der freie Weg nie weiter zur Seite, als sich in der Zeit lenken
 * lässt (wegBei, reichBei) – wie breit die Lücken sind und wie schnell es
 * geht, hängt an der Strecke, nicht an der Uhr. Auch die Windräder drehen
 * nach der Flugzeit, und der Falke hängt an der Strecke: Wer gleich fliegt,
 * trifft dieselben Flügel und denselben Falken.
 *
 * Die Vögel selbst würfeln nicht mit: Wo jeder im Schwarm fliegt, folgt aus
 * seiner Nummer. Hinten folgt der Schwarm dem Weg, den seine Mitte geflogen
 * ist, vorn zeigt er dorthin, wohin gelenkt wird – so biegt er sich wie ein
 * Band.
 *
 * Die Gegner (geist.js) fliegen als kleiner Schwarm aus Licht mit, und die
 * besten Flüge lassen sich anschauen (?zuschauen=): durch ihren eigenen
 * Abend, gewürfelt mit derselben Saat, geballt an denselben Stellen.
 *
 * Gezeichnet wird mit WebGL 2, ohne Bibliothek: Himmel, Wasser, Felsen und
 * Vögel haben je ein kleines Programm weiter unten. Gerechnet wird in Metern;
 * x zeigt nach rechts, y nach oben, z in Flugrichtung. Die Zahlen und Namen
 * liegen auf einer zweiten Leinwand darüber.
 */
(() => {
  "use strict";

  if (document.body.dataset.page !== "flock") return;

  const host = document.querySelector("#sw-stage");
  const shellApi = window.LernappGameShell;
  const cloudApi = window.LernappGameCloud;
  if (!host || !shellApi) return;

  const kids = () => window.LernappKids || null;
  const klang = () => window.ArcadeKlang || null;
  const ruhig = () => Boolean(kids()?.prefersReducedMotion?.());

  // Der Zufall. Nur der Abend zieht daraus – Felsen, Windräder, Trupps. Wo
  // ein Vogel im Schwarm fliegt und wohin eine Feder fällt, hängt an festen
  // Zahlen oder an Math.random, damit die Welt nicht davon abhängt, wie
  // jemand fliegt.
  const zufall = window.LernappZufall?.fuer?.("flockFlight") || {
    neu() {},
    zahl: () => Math.random(),
  };

  // ---------------------------------------------------------------------------
  // Die Schrauben
  // ---------------------------------------------------------------------------
  const TAKT = 1 / 120;            // gelenkt wird in festen kleinen Schritten
  const Z_ENDE = 3600;             // so weit ist es bis zum Schlafplatz
  const X_MAX = 46;                // so weit weicht die Mitte des Schwarms zur Seite
  const WEG_MAX = 32;              // und so weit der freie Weg
  const FLUG_Y = 13;               // die Flughöhe der Mitte
  const HOCH_MAX = 8;              // höher und tiefer reicht der Schwarm nie

  // Das Tempo, nach der Strecke: am Anfang zügig, am Schluss fast doppelt so
  // schnell. Die ersten Meter nimmt der Schwarm Anlauf. Zur Seite geht es
  // schnell, aber nicht sofort: Ein Schwarm schwenkt wie ein Band, und wer
  // zu spät umlenkt, kommt nicht mehr hinüber (wie die Kante im Slalom).
  const V0 = 38;
  const V_MAX = 74;
  const V_WEG = 1500;
  const QUER0 = 30;                // so schnell geht es zur Seite, in m/s
  const LENK_ZEIT = 0.16;          // so träge folgt der Schwarm dem Finger (Sekunden)
  const LOS_ZEIT = 0.16;           // und so träge läuft er aus, wenn er loslässt

  // Ballen: Liegen beide Seiten auf (ein Daumen links, einer rechts – am
  // Rechner ↓, S oder die Leertaste), zieht sich der Schwarm zu einer
  // dichten Kugel zusammen. Geballt passt er durch jeden Spalt, aber er
  // lenkt nicht und zählt nicht. Loslassen fächert ihn wieder auf.
  const BALL_VERZUG = 0.08;        // so lange müssen beide liegen – ein Daumenwechsel ballt nicht
  const BALL_ZU = 0.07;            // so schnell zieht er sich zusammen (Zeitkonstante)
  const BALL_AUF = 0.12;           // so schnell fächert er sich wieder auf
  const BALL_LANG_ZU = 0.11;       // seine Länge folgt etwas langsamer
  const BALL_LANG_AUF = 0.45;      // (und wächst langsam, damit keiner rückwärts fliegt)
  const GEBALLT = 0.6;             // ab hier ist er geballt (Falke, Aufzeichnung)

  // Der Schwarm: so viele Vögel zu Beginn, so viele höchstens. Hundert Vögel
  // bringen alle 100 / PUNKTE_JE_100M Meter einen Punkt – aber nur
  // aufgefächert. Am Schlafplatz zählt jeder Vogel BONUS dazu.
  const START_VOEGEL = 150;
  const VOEGEL_MAX = 1200;
  const KAPAZITAET = VOEGEL_MAX + 80;
  const MINDEST = 12;              // mit weniger hält kein Schwarm zusammen
  const PUNKTE_JE_100M = 3.4;
  const BONUS = 1;

  // Perfekt ist, wer die Mitte des Schwarms genau durch die Mitte einer Lücke
  // führt – dort hängt ein Licht – und dabei keinen Vogel verliert. Mehrere
  // perfekte in Folge holen immer mehr Vögel dazu (KETTE); ein Tor, das nicht
  // perfekt ist, bricht die Kette.
  const PERFEKT0 = 1.0;            // so weit neben der Mitte ist es am Anfang noch perfekt (m)
  const PERFEKT_MIN = 0.6;         // und am Schluss
  const KETTE = [2, 4, 6, 8, 10];  // so viele Vögel bringt das 1., 2., … perfekte Tor in Folge
  // Grosse Trupps an heiklen Stellen: so viele Vögel, wenn die Mitte durch den Ring geht.
  const TRUPP = { n0: 22, n1: 40, fang: 2.6 };

  // Der freie Weg: am Anfang breit, am Schluss gerade noch ein kleiner Schwarm.
  const BREIT0 = 20;
  const BREIT_MIN = 7.5;
  // Die Spalten in den Felswänden: am Schluss passt nur noch ein Ball durch.
  const SPALT0 = 11;
  const SPALT_MIN = 5.2;
  const SCHLUSS_SPALTEN = [6.0, 5.4, 4.8]; // die drei letzten Wände vor dem Schlafplatz
  const ERSTES_DING = 150;         // bis hier ist das Meer leer
  // Zwischen zwei Toren vergeht diese Zeit ohne Weg zur Seite: geballt durch
  // das eine, Anfahren und Abbremsen. Der Rest ist zum Lenken (anteilBei).
  const T_PAUSE = 0.95;
  // So viele Sekunden liegen mindestens zwischen zwei Reihen eines Felds.
  const REIHE_T0 = 1.5;
  const REIHE_T_MIN = 0.95;

  // Der Falke (ab FALKE_AB): Er kreist voraus, legt die Flügel an und stösst
  // FALKE_STOSS Sekunden später zu. Geballt greift er ins Leere – wer erst in
  // den letzten FALKE_SPAET Sekunden geballt hat, hat ihn «pariert» (die
  // Kette wächst). Aufgefächert reisst er FALKE_RAUB des Schwarms heraus.
  const FALKE_AB = 900;
  const FALKE_STOSS = 0.7;
  const FALKE_SPAET = 0.55;
  const FALKE_RAUB = 0.16;

  // Die Hindernisse. Was davon trifft, steht bei den Treffern weiter unten.
  const NABE = 15;                 // Höhe der Nabe eines Windrads
  const ROTOR = 9.5;               // Länge eines Flügels
  const BLATT = 1.1;               // halbe Breite, in der ein Flügel trifft
  const ROTOR_VOR = 2.6;           // so weit steht der Rotor vor dem Turm
  const MAST = 25;                 // ein gewöhnlicher Mast
  const MAST_HOCH = 48;            // die zwei hohen, zwischen denen der Weg frei ist
  const MAST_R = 1.7;
  const SEILE = [0.9, 0.78, 0.66]; // wo die drei Seile am Mast hängen (mal seine Höhe)
  const DURCHHANG = 6.2;
  const SEIL_TRIFFT = 0.7;         // so nah am Seil ist es getroffen
  const BOGEN_AUSSEN = [1.85, 1.38]; // der Fels um das Tor, mal dessen halbe Breite und Höhe
  const BOGEN_FORM = 2.5;          // wie eckig das Tor ist (2 wäre eine Ellipse)
  const BOGEN_TIEF = 6;
  const WAND_TIEF = 7;             // so dick ist eine Felswand
  const TURM_R = 1.4;              // der Turm eines Windrads

  const TOP_COUNT = 5;
  const store = cloudApi
    ? cloudApi.register({ key: "lernapp.schwarm", empty: { runs: 0, scores: [] }, merge: cloudApi.mergeScores(TOP_COUNT) })
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
  const weich = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const schwereBei = (z) => clamp(z / Z_ENDE, 0, 1);
  const tempoBei = (z) => (V0 + (V_MAX - V0) * (1 - Math.exp(-Math.max(0, z) / V_WEG))) * clamp(0.35 + z / 40, 0.35, 1);
  const querBei = (z) => QUER0 + 0.2 * (tempoBei(Math.max(40, z)) - V0);
  const breiteBei = (z) => lerp(BREIT0, BREIT_MIN, Math.pow(schwereBei(z), 0.8));
  const spaltBei = (z) => lerp(SPALT0, SPALT_MIN, schwereBei(z));
  const perfektBei = (z) => lerp(PERFEKT0, PERFEKT_MIN, schwereBei(z));
  // Wie viel von dem, was der Schwarm zur Seite kann, der Weg verlangt: am
  // Anfang gut die Hälfte, am Schluss fast alles.
  const anteilBei = (z) => lerp(0.55, 0.85, schwereBei(z));
  // Wie weit der Weg zwischen zwei Toren dz Meter auseinander zur Seite geht
  // – höchstens. Abgezogen ist die Pause an jedem Tor (T_PAUSE).
  const reichBei = (z, dz) => querBei(z) * Math.max(0, dz / tempoBei(z) - T_PAUSE) * anteilBei(z);
  // Und umgekehrt: wie viel Strecke s Meter zur Seite brauchen.
  const streckeFuer = (z, s) => tempoBei(z) * (s / (querBei(z) * anteilBei(z)) + T_PAUSE);
  // Wie breit ein Schwarm aus n Vögeln ist (halbe Breite): aufgefächert …
  const radiusBei = (n) => 2.5 + 0.5 * Math.sqrt(Math.max(0, n));
  // … und geballt.
  const ballRadiusBei = (n) => 1.0 + 0.04 * Math.sqrt(Math.max(0, n));

  // Immer dieselbe Zahl zu derselben Eingabe.
  function hash01(n) {
    const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return x - Math.floor(x);
  }

  // ---------------------------------------------------------------------------
  // Der Abend
  // ---------------------------------------------------------------------------
  // Fünf Lichter, nach der Strecke (k = Strecke / Z_ENDE). Dazwischen gleitet
  // alles: die Sonne sinkt (Höhe in Grad), der Himmel wechselt die Farbe, der
  // Dunst rückt näher, und am Schluss stehen Mond und Sterne da.
  const ABEND = [
    {
      k: 0, name: "Goldene Stunde", sonne: 8.5, kraft: 1, nacht: 0, mond: 0, dichte: 1 / 430,
      zenit: [0.20, 0.40, 0.70], horizont: [1.0, 0.80, 0.50], glut: [1.0, 0.62, 0.20], licht: [1.0, 0.85, 0.58],
      nebel: [0.98, 0.76, 0.52], wasser: [0.03, 0.12, 0.16], wolkeHell: [1.0, 0.82, 0.55], wolkeDunkel: [0.55, 0.45, 0.55],
      himmelLicht: [0.55, 0.60, 0.72],
    },
    {
      k: 0.27, name: "Sonnenuntergang", sonne: 3.0, kraft: 0.95, nacht: 0, mond: 0, dichte: 1 / 410,
      zenit: [0.16, 0.27, 0.58], horizont: [1.0, 0.60, 0.30], glut: [1.0, 0.42, 0.10], licht: [1.0, 0.62, 0.30],
      nebel: [0.96, 0.56, 0.36], wasser: [0.03, 0.09, 0.14], wolkeHell: [1.0, 0.60, 0.36], wolkeDunkel: [0.42, 0.28, 0.45],
      himmelLicht: [0.45, 0.45, 0.62],
    },
    {
      k: 0.5, name: "Abendrot", sonne: -1.5, kraft: 0.6, nacht: 0.05, mond: 0, dichte: 1 / 390,
      zenit: [0.11, 0.14, 0.42], horizont: [0.98, 0.42, 0.30], glut: [1.0, 0.30, 0.16], licht: [1.0, 0.42, 0.25],
      nebel: [0.80, 0.40, 0.40], wasser: [0.03, 0.06, 0.12], wolkeHell: [1.0, 0.42, 0.38], wolkeDunkel: [0.28, 0.18, 0.38],
      himmelLicht: [0.36, 0.32, 0.52],
    },
    {
      k: 0.72, name: "Blaue Stunde", sonne: -7, kraft: 0.15, nacht: 0.4, mond: 0.55, dichte: 1 / 370,
      zenit: [0.035, 0.06, 0.22], horizont: [0.50, 0.32, 0.50], glut: [0.92, 0.40, 0.36], licht: [0.6, 0.35, 0.35],
      nebel: [0.32, 0.26, 0.44], wasser: [0.02, 0.04, 0.10], wolkeHell: [0.62, 0.38, 0.52], wolkeDunkel: [0.10, 0.10, 0.24],
      himmelLicht: [0.20, 0.24, 0.44],
    },
    {
      k: 0.9, name: "Nacht", sonne: -12, kraft: 0, nacht: 1, mond: 1, dichte: 1 / 350,
      zenit: [0.012, 0.02, 0.08], horizont: [0.16, 0.17, 0.34], glut: [0.50, 0.30, 0.42], licht: [0.3, 0.2, 0.3],
      nebel: [0.12, 0.13, 0.27], wasser: [0.01, 0.02, 0.06], wolkeHell: [0.26, 0.26, 0.42], wolkeDunkel: [0.03, 0.04, 0.11],
      himmelLicht: [0.12, 0.15, 0.30],
    },
  ];
  const ABEND_FELDER = ["zenit", "horizont", "glut", "licht", "nebel", "wasser", "wolkeHell", "wolkeDunkel", "himmelLicht"];
  const abend = { name: ABEND[0].name, nr: 0, sonne: 0, kraft: 0, nacht: 0, mond: 0, dichte: 0 };
  ABEND_FELDER.forEach((feld) => { abend[feld] = [0, 0, 0]; });

  // Das Licht an einer Stelle der Strecke – in abend, ohne neue Objekte.
  function abendBei(k) {
    let i = 0;
    while (i < ABEND.length - 2 && k >= ABEND[i + 1].k) i += 1;
    const a = ABEND[i];
    const b = ABEND[i + 1];
    const t = weich(a.k, b.k, k);
    abend.nr = k >= b.k ? i + 1 : i;
    abend.name = ABEND[abend.nr].name;
    for (const feld of ["sonne", "kraft", "nacht", "mond", "dichte"]) abend[feld] = lerp(a[feld], b[feld], t);
    for (const feld of ABEND_FELDER) {
      for (let j = 0; j < 3; j += 1) abend[feld][j] = lerp(a[feld][j], b[feld][j], t);
    }
    return abend;
  }

  // ---------------------------------------------------------------------------
  // Zustand
  // ---------------------------------------------------------------------------
  // phase:   "bereit" (noch nichts gedrückt), "spiel", "zuschauen", "ende"
  // schritt: "start" (der Schwarm kreist), "flug", "landung", "aus"
  const state = {
    phase: "bereit",
    schritt: "start",
    punkte: 0,
    roh: 0,               // die Punkte, ungerundet
    x: 0,                 // die Mitte des Schwarms
    z: 0,
    vx: 0,
    lenk: 0,              // -1 links, 1 rechts
    wunsch: false,        // liegen beide Seiten auf (oder die Taste zum Ballen)?
    wunschSeit: 0,
    ballen: false,        // … lange genug: Der Schwarm ballt sich.
    ballenSeit: -1e9,
    ball: 0,              // 0 aufgefächert, 1 geballt (Breite und Höhe)
    ballLang: 0,          // dasselbe für die Länge
    kette: 0,             // perfekte Tore in Folge
    perfekte: 0,
    tore: 0,
    grund: "",            // warum die Runde endete
    R: radiusBei(START_VOEGEL),
    form: 0,              // 0 = Kugel am Start, 1 = im Flug gestreckt
    wirbel: 0,            // der Schwarm dreht sich um seine Flugrichtung
    zeit: 0,              // seit dem Aufbau der Runde
    flugzeit: 0,          // seit dem Start – danach drehen die Windräder
    meter: 0,
    groesster: START_VOEGEL,
    verloren: 0,
    geholt: 0,
    bonus: 0,
    angekommen: false,
    welt: null,
    teile: [],
    schriften: [],
    karte: null,          // der Name des Lichts, wenn es wechselt
    stoss: 0,
    blitz: 0,
    schrittZeit: 0,
    verlustMerker: { zahl: 0, seit: 0 },
  };

  // Der Weg, den die Mitte geflogen ist: ihr x alle halben Meter, im Kreis.
  const SPUR_N = 256;
  const spur = new Float32Array(SPUR_N);
  let spurBis = 0;

  let shell = null;
  let feld = null;
  let canvas = null;       // WebGL: die Welt
  let hud = null;          // 2D: Zahlen und Namen darüber
  let g = null;
  let frame = null;
  let last = 0;
  // Die Gegner (geist.js): wer als Schwarm aus Licht mitfliegt.
  let gegner = null;
  // Wer einen Flug anschaut statt zu fliegen (geist.js, zuschauer).
  let zuschauer = null;

  function stopLoop() {
    if (frame) { window.cancelAnimationFrame(frame); frame = null; }
  }

  // ---------------------------------------------------------------------------
  // Die Welt
  // ---------------------------------------------------------------------------
  /*
   * Der Abend besteht aus Abschnitten, einer hinter dem anderen: ein Feld
   * Felsnadeln, ein Felsbogen, ein Windpark, eine Stromleitung, ein Stück
   * offenes Meer. Jede Reihe Hindernisse bekommt einen Punkt des freien Wegs
   * (weg): Dort ist auf der Breite breiteBei(z) nichts, und von einem Punkt
   * zum nächsten geht es nie weiter zur Seite, als der Schwarm in der Zeit
   * lenken kann – am Anfang mit viel Luft, am Schluss mit wenig.
   *
   *   dinge    alles, was trifft, nach z geordnet
   *   tore     je Reihe die Lücke am freien Weg: ihre Mitte (dort hängt
   *            ein Licht), ihre halbe Breite auf Flughöhe und was zu ihr
   *            gehört – wer dort Vögel verliert, war nicht perfekt
   *   trupps   grosse Trupps an heiklen Stellen
   *   falken   wo ein Falke zustösst
   *   weg      die Punkte des freien Wegs; dazwischen eine weiche Kurve
   */
  function neueWelt() {
    return {
      dinge: [], tore: [], trupps: [], falken: [], weg: [{ z: 0, x: 0 }], bis: ERSTES_DING, vorher: "", fertig: false,
      von: 0, torVon: 0, truppVon: 0, falkeVon: 0, nr: 0, erstesBallen: 0,
    };
  }

  // Ein Tor: die Lücke einer Reihe am freien Weg. Alles, was seit «vor» in
  // die Welt kam, gehört dazu.
  function torDazu(z, x, halb, art, vor) {
    const W = state.welt;
    const dinge = W.dinge.slice(vor);
    W.tore.push({ z, x, halb, art, dinge, zustand: "offen", seit: 0, mitte: 0, nr: W.tore.length });
    return dinge;
  }

  function wegBei(z) {
    const w = state.welt.weg;
    let hi = w.length - 1;
    if (z <= w[0].z) return w[0].x;
    if (z >= w[hi].z) return w[hi].x;
    let lo = 0;
    while (hi - lo > 1) {
      const m = (lo + hi) >> 1;
      if (w[m].z <= z) lo = m;
      else hi = m;
    }
    const a = w[lo];
    const b = w[hi];
    const u = (z - a.z) / (b.z - a.z);
    return a.x + (b.x - a.x) * (1 - Math.cos(Math.PI * u)) / 2;
  }

  // Der nächste Punkt des freien Wegs: so weit zur Seite, wie es bis dorthin
  // zu lenken ist (reichBei) – nie fast geradeaus, mindestens ein gutes
  // Drittel davon, nach links oder rechts, und vom Rand weg zurück zur Mitte.
  function wegPunkt(z, weit = 1) {
    const w = state.welt.weg;
    const letzter = w[w.length - 1];
    const reich = reichBei(z, Math.max(1, z - letzter.z));
    const wurf = zufall.zahl() * 2 - 1;
    let schritt = (wurf < 0 ? -1 : 1) * (0.35 + 0.65 * Math.abs(wurf)) * reich * weit;
    if (Math.abs(letzter.x + schritt) > WEG_MAX) schritt = -schritt;
    const x = clamp(letzter.x + schritt, -WEG_MAX, WEG_MAX);
    w.push({ z, x });
    return x;
  }

  // Ein grosser Trupp an einer heiklen Stelle – am Rand, hinter einem engen
  // Spalt, neben einem Felsen. Er kommt dazu, wenn die Mitte des Schwarms
  // durch seinen Ring geht.
  function truppDazu(z, x, k) {
    const n = Math.round(lerp(TRUPP.n0, TRUPP.n1, zufall.zahl()) + k * 15);
    state.welt.trupps.push({ z, x: clamp(x, -X_MAX + 3, X_MAX - 3), n, art: "gross", zustand: "offen", seit: 0, nr: state.welt.trupps.length });
  }

  // Liegt x an der Stelle z frei – mit Abstand zu allem, was dort steht?
  function frei(z, x, abstand) {
    return state.welt.dinge.every((d) => {
      if (d.art === "nadel") return Math.abs(d.z - z) > d.r + 12 || Math.abs(d.x - x) > d.r + abstand;
      if (Math.abs(d.z - z) > 16) return true;
      if (d.art === "windrad") return Math.abs(d.x - x) > ROTOR + abstand;
      if (d.art === "bogen") return Math.abs(d.x - x) < d.a - abstand || Math.abs(d.x - x) > d.a * BOGEN_AUSSEN[0] + abstand;
      if (d.art === "wand") return d.spalten.some((sp) => Math.abs(sp.x - x) < sp.g / 2 - 1);
      return true;
    });
  }

  // Eine Felsnadel. Die ersten sind schlank.
  function nadel(z, x) {
    const r = lerp(3.5, lerp(4.8, 8, clamp(z / 900, 0, 1)), zufall.zahl());
    return {
      art: "nadel", z, x, r, h: lerp(30, 56, zufall.zahl()), form: Math.floor(zufall.zahl() * 5), dreh: zufall.zahl() * Math.PI * 2,
    };
  }

  // Wie weit eine Nadel auf Flughöhe in die Lücke reicht – unten, wo ein
  // geballter Schwarm noch fliegt, ist sie am dicksten.
  const UNTEN = FLUG_Y - 2.5;
  const OBEN = FLUG_Y + 2.5;
  const nadelDick = (n) => nadelRadius(n, UNTEN);

  // Ein Feld Felsnadeln: Reihe um Reihe ein Kamm aus Nadeln quer übers Meer.
  // Am freien Weg steht links und rechts gleich weit eine Nadel: die Lücke,
  // in ihrer Mitte das Licht. Die Lücken weiter draussen sind, wie sie
  // fallen. In einer davon wartet ab und zu ein grosser Trupp.
  function nadelfeld(z0, k) {
    const W = state.welt;
    const reihen = 3 + Math.floor(zufall.zahl() * 3);
    let z = z0;
    for (let i = 0; i < reihen; i += 1) {
      if (i > 0) z += tempoBei(z) * lerp(REIHE_T0, REIHE_T_MIN, k) * (1 + 0.25 * zufall.zahl());
      const vor = W.dinge.length;
      const xf = wegPunkt(z);
      const halb = breiteBei(z) / 2 + zufall.zahl() * lerp(3, 0.4, k);
      for (const s of [-1, 1]) {
        let erste = true;
        let kante = halb;
        while (kante < 78 + s * xf) {
          // Die Nadel an der Lücke steht genau in der Reihe. Die weiter
          // draussen stehen ein wenig davor oder dahinter.
          const versatz = erste ? 0 : (zufall.zahl() - 0.5) * 12;
          const n = nadel(z + versatz, 0);
          n.x = xf + s * (kante + (erste ? nadelDick(n) : n.r));
          W.dinge.push(n);
          kante = Math.abs(n.x - xf) + n.r + lerp(lerp(13, 8, k), lerp(32, 20, k), zufall.zahl());
          erste = false;
        }
      }
      torDazu(z, xf, halb, "nadeln", vor);
    }
    // Ab und zu ein grosser Trupp weit daneben – wo dort ein Fels steht,
    // gibt es ihn nicht.
    if (reihen > 1) {
      const weit = (zufall.zahl() < 0.5 ? -1 : 1) * lerp(20, 34, zufall.zahl());
      const zwischen = W.tore.length - reihen + Math.floor(zufall.zahl() * (reihen - 1));
      const zGross = (W.tore[zwischen].z + W.tore[zwischen + 1].z) / 2;
      const xGross = clamp(wegBei(zGross) + weit, -X_MAX + 3, X_MAX - 3);
      if (zufall.zahl() < 0.4 && frei(zGross, xGross, 5)) truppDazu(zGross, xGross, k);
    }
    return z - z0;
  }

  // Ein grosser Fels mitten im Weg: Er steht genau dort, wo es geradeaus
  // hinginge – also drum herum, durch die Lücke zwischen ihm und einer Nadel.
  // Später zwei, drei hintereinander, einmal links, einmal rechts vorbei. Auf
  // der anderen Seite bleibt manchmal ein enger Durchlass, und dahinter
  // wartet ein grosser Trupp.
  function massiv(z0, k) {
    const W = state.welt;
    const zahl = 1 + (k > 0.25 && zufall.zahl() < 0.6 ? 1 : 0) + (k > 0.6 && zufall.zahl() < 0.6 ? 1 : 0);
    let seite = zufall.zahl() < 0.5 ? -1 : 1;
    let z = z0;
    for (let i = 0; i < zahl; i += 1) {
      const vorher = W.weg[W.weg.length - 1];
      const vor = W.dinge.length;
      const fels = nadel(z, vorher.x);
      fels.r = lerp(11, 17, zufall.zahl());
      fels.h = lerp(48, 74, zufall.zahl());
      const halb = breiteBei(z + 80) / 2 + zufall.zahl() * lerp(3, 0.4, k);
      const neben = nadelDick(fels) + halb;
      if (Math.abs(vorher.x + seite * neben) > WEG_MAX) seite = -seite;
      const ziel = vorher.x + seite * neben;
      // So weit voraus, dass sich der Bogen um den Fels lenken lässt.
      let weit = 60;
      for (let n = 0; n < 4; n += 1) weit = Math.max(60, streckeFuer(Math.max(z, vorher.z) + weit, neben));
      z = Math.max(z, vorher.z) + weit;
      fels.z = z;
      W.weg.push({ z, x: ziel });
      W.dinge.push(fels);
      // Auf der freien Seite begrenzt eine Nadel die Lücke, gleich weit weg.
      const dritte = nadel(z, 0);
      dritte.x = ziel + seite * (halb + nadelDick(dritte));
      W.dinge.push(dritte);
      // Der enge Durchlass auf der anderen Seite, mit dem grossen Trupp.
      const eng = Math.max(6.5, breiteBei(z) * 0.6);
      const zweite = nadel(z, 0);
      zweite.x = vorher.x - seite * (fels.r + eng + zweite.r);
      const durch = vorher.x - seite * (fels.r + eng / 2);
      if (zufall.zahl() < 0.55 && Math.abs(durch) < X_MAX - 4) {
        W.dinge.push(zweite);
        truppDazu(z + 24, durch, k);
      }
      torDazu(z, ziel, halb, "massiv", vor);
      seite = -seite;
    }
    return z - z0 + 20;
  }

  // Ein Felsbogen quer über dem Weg, das Tor genau dort. Links und rechts
  // stehen bald Nadeln: Dann führt nur das Tor hindurch.
  function felsbogen(z0, k) {
    const W = state.welt;
    const z = z0 + 30;
    const vor = W.dinge.length;
    const xf = wegPunkt(z, 0.85);
    const a = breiteBei(z) / 2 * lerp(1.2, 1.0, k) + 0.5;
    const d = { art: "bogen", z, x: xf, a, h: lerp(29, 35, zufall.zahl()), form: Math.floor(zufall.zahl() * 3) };
    W.dinge.push(d);
    const flanken = zufall.zahl() < lerp(0.3, 0.95, k);
    for (const s of [-1, 1]) {
      const n = nadel(z + (zufall.zahl() - 0.5) * 10, 0);
      n.x = xf + s * (a * BOGEN_AUSSEN[0] + n.r + 2 + zufall.zahl() * 8);
      if (flanken) W.dinge.push(n);
    }
    torDazu(z, xf, bogenBreite(a, d.h, OBEN), "bogen", vor);
    return 80;
  }

  // Eine Felswand quer übers Meer, mit einem Spalt am freien Weg – erst
  // breit, später so schmal, dass nur ein geballter Schwarm hindurchpasst.
  // Manchmal gibt es weiter weg einen zweiten, engeren Spalt: Dahinter wartet
  // ein grosser Trupp.
  function felswand(z0, k, spalt = 0) {
    const W = state.welt;
    const z = z0 + 44;
    const vor = W.dinge.length;
    const xf = wegPunkt(z, 0.9);
    const g = spalt || spaltBei(z);
    const spalten = [{ x: xf, g }];
    const seite = xf > 0 ? -1 : 1;
    const x2 = clamp(xf + seite * lerp(22, 40, zufall.zahl()), -X_MAX + 6, X_MAX - 6);
    const zweiter = zufall.zahl() < 0.55;
    if (!spalt && zweiter && Math.abs(x2 - xf) > g + 12) {
      spalten.push({ x: x2, g: Math.max(4.6, g * 0.75) });
      truppDazu(z + 26, x2, k);
    }
    spalten.sort((p, q) => p.x - q.x);
    W.dinge.push({ art: "wand", z, x: xf, spalten, h: lerp(34, 48, zufall.zahl()), form: Math.floor(zufall.zahl() * 2) });
    torDazu(z, xf, g / 2, "wand", vor);
    return 74;
  }

  // Ein Windpark: Reihen von Windrädern. Wo der Weg hindurchführt, stehen
  // links und rechts zwei gleich weit weg.
  function windpark(z0, k) {
    const W = state.welt;
    const reihen = 2 + Math.floor(zufall.zahl() * 2);
    const raster = lerp(28, 23, k);
    let z = z0;
    for (let i = 0; i < reihen; i += 1) {
      if (i > 0) z += tempoBei(z) * lerp(REIHE_T0 + 0.1, REIHE_T_MIN + 0.1, k);
      const vor = W.dinge.length;
      const xf = wegPunkt(z);
      const halb = breiteBei(z) / 2 + zufall.zahl() * lerp(3, 0.4, k);
      for (const s of [-1, 1]) {
        for (let x = xf + s * (halb + ROTOR); Math.abs(x) < 4.5 * raster; x += s * raster) {
          const phase = zufall.zahl() * Math.PI * 2;
          const tempo = lerp(1.0, 1.9, zufall.zahl()) * (zufall.zahl() < 0.5 ? -1 : 1);
          W.dinge.push({ art: "windrad", z, x, phase, tempo });
        }
      }
      torDazu(z, xf, halb, "windpark", vor);
    }
    return z - z0;
  }

  // Eine Stromleitung quer übers Meer. Zwischen den zwei hohen Masten hängen
  // die Seile über dem Schwarm; überall sonst hängen sie mitten hindurch.
  // Breit genug für jeden Schwarm – aber nur dort.
  function leitung(z0, k) {
    const W = state.welt;
    const z = z0 + 30;
    const vor = W.dinge.length;
    const xf = wegPunkt(z, 0.85);
    const spanne = Math.max(40, breiteBei(z) + 2 * MAST_R + 6);
    const masten = [];
    for (let i = -3; i <= 2; i += 1) masten.push({ x: xf + (i + 0.5) * spanne, h: i === -1 || i === 0 ? MAST_HOCH : MAST });
    W.dinge.push({ art: "leitung", z, x: xf, masten });
    torDazu(z, xf, spanne / 2 - MAST_R, "leitung", vor);
    return 70;
  }

  // Offenes Meer: nichts im Weg. Ganz am Rand wartet manchmal ein grosser
  // Trupp – wer ihn holt, muss rechtzeitig zurück sein. Und ab FALKE_AB
  // kreist hier ein Falke.
  function offen(z0, k) {
    const W = state.welt;
    wegPunkt(z0 + 70);
    if (z0 < FALKE_AB || zufall.zahl() < 0.5) truppDazu(z0 + 72, (zufall.zahl() < 0.5 ? -1 : 1) * (X_MAX - 3), k);
    if (z0 >= FALKE_AB) {
      const seite = zufall.zahl() < 0.5 ? -1 : 1;
      W.falken.push({ z: z0 + 64, seite, zustand: "offen", seit: 0, nr: W.falken.length });
      // Später gleich ein zweiter hinterher.
      if (k > 0.55 && zufall.zahl() < 0.6) W.falken.push({ z: z0 + 64 + tempoBei(z0) * 1.25, seite: -seite, zustand: "offen", seit: 0, nr: W.falken.length });
      if (!W.ersterFalke) W.ersterFalke = z0 + 64;
    }
    return 132;
  }

  const ABSCHNITTE = { nadeln: nadelfeld, massiv, bogen: felsbogen, wand: felswand, windpark, leitung, offen };

  function abschnitt() {
    const W = state.welt;
    const z0 = W.bis;
    // Vor dem Schlafplatz die letzte Prüfung: drei Felswände hintereinander,
    // jede mit einem schmaleren Spalt. Dann führt der Weg geradeaus zur Insel
    // mit ihren Bäumen.
    if (z0 > Z_ENDE - 640) {
      const rest = Z_ENDE - 110 - z0;
      const abstand = clamp((rest - 50) / 2, 80, 130);
      SCHLUSS_SPALTEN.forEach((spalt, i) => felswand(z0 + 6 + i * abstand, 1, spalt));
      W.weg.push({ z: Z_ENDE, x: W.weg[W.weg.length - 1].x });
      W.dinge.push({ art: "insel", z: Z_ENDE + 95, x: 0 });
      W.dinge.sort((a, b) => a.z - b.z);
      W.tore.sort((a, b) => a.z - b.z);
      W.trupps.sort((a, b) => a.z - b.z);
      W.fertig = true;
      return;
    }
    const k = schwereBei(z0);
    // Zuerst ein Feld Nadeln, dann ein grosser Fels, dann die erste Wand –
    // danach, wie es fällt.
    const wahl = [["nadeln", 2.4], ["massiv", 1.7]];
    if (z0 > 300) wahl.push(["bogen", 1.3]);
    if (z0 > 300) wahl.push(["wand", 1.2 + 1.6 * k]);
    if (z0 > 500) wahl.push(["windpark", 1.2]);
    if (z0 > 800) wahl.push(["leitung", 1.0]);
    if (z0 > 250) wahl.push(["offen", z0 >= FALKE_AB ? 1.1 : 0.6]);
    const moeglich = wahl.filter(([art]) => art === "nadeln" || art !== W.vorher);
    let los = zufall.zahl() * moeglich.reduce((summe, [, gewicht]) => summe + gewicht, 0);
    let art = moeglich[0][0];
    for (const [name, gewicht] of moeglich) {
      art = name;
      los -= gewicht;
      if (los <= 0) break;
    }
    if (W.nr === 0) art = "nadeln";
    if (W.nr === 1) art = "massiv";
    if (W.nr === 2) art = "wand";
    const lang = ABSCHNITTE[art](z0, k);
    if (W.nr === 2) W.erstesBallen = W.tore[W.tore.length - 1].z;
    W.vorher = art;
    W.nr += 1;
    W.bis = z0 + lang + lerp(60, 34, k);
    W.dinge.sort((a, b) => a.z - b.z);
    W.tore.sort((a, b) => a.z - b.z);
    W.trupps.sort((a, b) => a.z - b.z);
  }

  function weltBis(z) {
    const W = state.welt;
    while (!W.fertig && W.bis < z) abschnitt();
  }

  // Die gewürfelte Welt in Worten: was auf den ersten Kilometern steht. Im
  // Turnier bekommen alle denselben Text.
  function weltText() {
    weltBis(1600);
    const W = state.welt;
    return W.dinge.slice(0, 40).map((d) => `${d.art.slice(0, 2)}${d.z.toFixed(1)}/${d.x.toFixed(1)}`).join(" ")
      + " | " + W.tore.slice(0, 16).map((t) => `${t.art.slice(0, 2)}${t.z.toFixed(1)}/${t.x.toFixed(1)}:${t.halb.toFixed(1)}`).join(" ")
      + " | " + W.trupps.slice(0, 10).map((t) => `${t.z.toFixed(1)}/${t.x.toFixed(1)}:${t.n}`).join(" ")
      + " | " + W.falken.slice(0, 6).map((f) => `${f.z.toFixed(1)}${f.seite < 0 ? "l" : "r"}`).join(" ")
      + " | " + W.weg.slice(0, 16).map((p) => p.x.toFixed(1)).join(",");
  }

  // ---------------------------------------------------------------------------
  // Was trifft
  // ---------------------------------------------------------------------------
  // Eine Felsnadel wird nach oben schmaler; dieselbe Form hat ihr Netz
  // (nadelNetz).
  const nadelRadius = (d, y) => (y >= d.h ? 0 : d.r * (1 - 0.62 * Math.pow(clamp(y / d.h, 0, 1), 1.3)));
  // Die halbe Breite des Tors und des Felsens darum, in der Höhe y.
  function bogenBreite(halb, hoch, y) {
    if (y >= hoch) return 0;
    return halb * Math.pow(1 - Math.pow(Math.max(0, y) / hoch, BOGEN_FORM), 1 / BOGEN_FORM);
  }
  // Wo ein Windrad seine Flügel hat – nach der Flugzeit, für alle gleich.
  const rotorWinkel = (d) => d.phase + d.tempo * state.flugzeit;
  // Die Höhe des Seils nr an der Stelle x einer Leitung – oder -1, wo keines hängt.
  function seilHoehe(d, x, nr) {
    const m = d.masten;
    if (x < m[0].x || x > m[m.length - 1].x) return -1;
    let i = 0;
    while (i < m.length - 2 && x > m[i + 1].x) i += 1;
    const u = (x - m[i].x) / (m[i + 1].x - m[i].x);
    return lerp(m[i].h, m[i + 1].h, u) * SEILE[nr] - DURCHHANG * 4 * u * (1 - u);
  }

  // ---------------------------------------------------------------------------
  // Der Schwarm
  // ---------------------------------------------------------------------------
  /*
   * Jeder Vogel hat einen Platz im Schwarm: einen Punkt in einer Kugel
   * (ox, oy, oz), zur Mitte hin dichter. Alle paar Sekunden sucht er sich
   * einen neuen (tx, ty, tz) und gleitet dorthin – so schliesst sich eine
   * Lücke, die ein Fels gerissen hat, von selbst. Die Kugel dreht sich um die
   * Flugrichtung, atmet, und wird im Flug zu einer langen Wolke.
   *
   * Wo er in der Welt ist (x, y, z), folgt daraus und aus dem Weg der Mitte:
   * hinten dort, wo die Mitte geflogen ist (spur), vorn dort, wohin gerade
   * gelenkt wird. jx, jy, jz ist der Versatz eines Vogels, der eben erst
   * dazugekommen ist und noch zu seinem Platz fliegt.
   */
  const VG_FELDER = ["ox", "oy", "oz", "tx", "ty", "tz", "warte", "ph", "jx", "jy", "jz", "x", "y", "z", "roll"];
  const vg = { n: 0, plaetze: 0 };
  VG_FELDER.forEach((name) => { vg[name] = new Float32Array(KAPAZITAET); });

  // Wie hash01, aber aus ganzen Zahlen: auf jedem Gerät dieselben Plätze.
  function hashGanz(n) {
    let t = (n + 0x6d2b79f5) | 0;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  function platz(i) {
    const nr = vg.plaetze;
    vg.plaetze += 1;
    const winkel = hashGanz(nr * 4) * Math.PI * 2;
    const c = hashGanz(nr * 4 + 1) * 2 - 1;
    const r = Math.pow(hashGanz(nr * 4 + 2), 0.42);
    const s = Math.sqrt(1 - c * c);
    vg.tx[i] = r * s * Math.cos(winkel);
    vg.ty[i] = r * s * Math.sin(winkel);
    vg.tz[i] = r * c;
    vg.warte[i] = 2.5 + 4 * hashGanz(nr * 4 + 3);
  }

  function neuerVogel() {
    if (vg.n >= VOEGEL_MAX) return -1;
    const i = vg.n;
    vg.n += 1;
    platz(i);
    vg.ox[i] = vg.tx[i];
    vg.oy[i] = vg.ty[i];
    vg.oz[i] = vg.tz[i];
    vg.ph[i] = hashGanz(vg.plaetze * 7 + 5);
    vg.jx[i] = 0;
    vg.jy[i] = 0;
    vg.jz[i] = 0;
    vg.x[i] = state.x;
    vg.y[i] = FLUG_Y;
    // Noch nirgends: Erst ab dem nächsten Bild fliegt er durch etwas hindurch.
    vg.z[i] = Number.NaN;
    vg.roll[i] = 0;
    return i;
  }

  // Ein Vogel weniger: Der letzte rückt an seine Stelle.
  function vogelWeg(i) {
    vg.n -= 1;
    const l = vg.n;
    if (i !== l) for (const name of VG_FELDER) vg[name][i] = vg[name][l];
  }

  // Die Masse des Schwarms: halbe Breite, Höhe und Länge – aufgefächert
  // oder geballt. Kein Vogel fliegt je ausserhalb davon: Was man sieht, ist,
  // was durch eine Lücke muss.
  function masse() {
    const R = state.R;
    const r = ballRadiusBei(vg.n);
    return {
      x: lerp(R, r, state.ball),
      y: lerp(Math.min(R * lerp(0.95, 0.55, state.form), HOCH_MAX), r * 0.9, state.ball),
      z: lerp(R * lerp(1, 1.4, state.form), r * 1.3, state.ballLang),
    };
  }

  function spurNeu() {
    spur.fill(state.x);
    spurBis = Math.floor(state.z * 2);
  }

  // Die Mitte ist weitergeflogen: ihren Weg bis hierher festhalten.
  function spurSchreiben(xVor, zVor) {
    const bis = Math.floor(state.z * 2);
    if (bis - spurBis > SPUR_N) spurBis = bis - SPUR_N;
    for (let i = spurBis + 1; i <= bis; i += 1) {
      const u = state.z > zVor ? clamp((i / 2 - zVor) / (state.z - zVor), 0, 1) : 1;
      spur[i & (SPUR_N - 1)] = lerp(xVor, state.x, u);
    }
    spurBis = Math.max(spurBis, bis);
  }

  function spurBei(z) {
    const k = z * 2;
    let i = Math.floor(k);
    if (i >= spurBis) return state.x;
    const u = k - i;
    if (i < spurBis - SPUR_N + 2) i = spurBis - SPUR_N + 2;
    const a = spur[i & (SPUR_N - 1)];
    const b = i + 1 >= spurBis ? state.x : spur[(i + 1) & (SPUR_N - 1)];
    return a + (b - a) * u;
  }

  /*
   * Was trifft: ob, wer von zVor nach z fliegt, auf der Höhe y bei x an d
   * hängen bleibt. Kein Ausweichen und kein Sog – was über den Fels
   * hinausragt, ist weg, genau dort, wo man es sieht. Das gilt für jeden
   * Vogel und für die Mitte des Schwarms: Die Mitte am Fels beendet die Runde.
   * Gerechnet wird mit dem Ort im Bild davor und jetzt, damit auch ein
   * langsames Bild nichts überspringt.
   */
  const DRITTEL = Math.PI * 2 / 3;
  const quert = (zVor, z, ebene) => zVor < ebene && z >= ebene;
  // Etwas Rundes (Felsnadel, Turm, Mast) mit Radius r: drin, oder eben durch
  // seine Mitte hindurch.
  function rund(x, zVor, z, mx, mz, r) {
    const dx = x - mx;
    if (dx >= r || dx <= -r) return false;
    const dz = z - mz;
    return dx * dx + dz * dz < r * r || quert(zVor, z, mz);
  }
  // Eine Platte der Dicke tief: durch ihre Vorderseite oder schon darin.
  const inPlatte = (zVor, z, mz, tief) => quert(zVor, z, mz - tief / 2) || (z > mz - tief / 2 && z < mz + tief / 2);
  // Durch die Ebene eines Rotors: getroffen ist, wer gerade dort ist, wo ein
  // Flügel steht – oder die Nabe.
  function rotorTrifft(x, y, d) {
    const dx = x - d.x;
    const dy = y - NABE;
    const rad = Math.hypot(dx, dy);
    if (rad >= ROTOR) return false;
    if (rad < 1.3) return true;
    const w = ((Math.atan2(dy, dx) - rotorWinkel(d)) % DRITTEL + DRITTEL) % DRITTEL;
    return Math.min(w, DRITTEL - w) * rad < BLATT;
  }
  function trifft(d, x, y, zVor, z) {
    if (d.art === "nadel") {
      const rr = nadelRadius(d, y);
      return rr > 0 && rund(x, zVor, z, d.x, d.z, rr);
    }
    if (d.art === "bogen") {
      if (!inPlatte(zVor, z, d.z, BOGEN_TIEF)) return false;
      const ab = Math.abs(x - d.x);
      return ab > bogenBreite(d.a, d.h, y) && ab < bogenBreite(d.a * BOGEN_AUSSEN[0], d.h * BOGEN_AUSSEN[1], y);
    }
    if (d.art === "wand") {
      if (y >= d.h || !inPlatte(zVor, z, d.z, WAND_TIEF)) return false;
      for (let j = 0; j < d.spalten.length; j += 1) {
        if (Math.abs(x - d.spalten[j].x) < d.spalten[j].g / 2) return false;
      }
      return true;
    }
    if (d.art === "windrad") {
      if (y < NABE && rund(x, zVor, z, d.x, d.z, TURM_R)) return true;
      return quert(zVor, z, d.z - ROTOR_VOR) && rotorTrifft(x, y, d);
    }
    if (d.art === "leitung") {
      for (let j = 0; j < d.masten.length; j += 1) {
        if (y < d.masten[j].h && rund(x, zVor, z, d.masten[j].x, d.z, MAST_R)) return true;
      }
      if (!quert(zVor, z, d.z)) return false;
      for (let nr = 0; nr < 3; nr += 1) {
        if (Math.abs(y - seilHoehe(d, x, nr)) < SEIL_TRIFFT) return true;
      }
    }
    return false;
  }

  // Was gerade in Reichweite der Mitte steht (von, bis: Meter davor, dahinter).
  const nah = [];
  function nahSammeln(hinten, vorn) {
    const W = state.welt;
    nah.length = 0;
    while (W.von < W.dinge.length && W.dinge[W.von].z < state.z - hinten - 30) W.von += 1;
    for (let i = W.von; i < W.dinge.length && W.dinge[i].z < state.z + vorn + 30; i += 1) {
      if (W.dinge[i].art !== "insel") nah.push(W.dinge[i]);
    }
  }

  function schwarmTakt(dt) {
    const start = state.schritt === "start";
    state.R += (radiusBei(vg.n) - state.R) * (1 - Math.exp(-dt / 0.8));
    state.form += ((start ? 0 : 1) - state.form) * (1 - Math.exp(-dt / 0.7));
    // Ballen: Breite und Höhe folgen schnell, die Länge etwas langsamer.
    const zu = state.ballen ? 1 : 0;
    state.ball += (zu - state.ball) * (1 - Math.exp(-dt / (zu ? BALL_ZU : BALL_AUF)));
    state.ballLang += (zu - state.ballLang) * (1 - Math.exp(-dt / (zu ? BALL_LANG_ZU : BALL_LANG_AUF)));
    state.wirbel += dt * lerp(0.9, 0.42, state.form) * (1 + 1.6 * state.ball);
    // Am Schlafplatz sinkt der Schwarm auf die Insel und zieht sich zusammen.
    const lande = state.schritt === "landung" ? weich(0, 2.2, state.zeit - state.schrittZeit) : 0;
    // Zerstreut oder zerschellt: Die letzten fliegen auseinander und hinauf.
    const streu = state.schritt === "aus" ? weich(0, 1.3, state.zeit - state.schrittZeit) : 0;
    const m = masse();
    const Rx = m.x * lerp(1, 0.8, lande) * (1 + 5 * streu);
    const Ry = m.y * lerp(1, 0.5, lande) * (1 + 2 * streu);
    const Rz = m.z * lerp(1, 0.7, lande) * (1 + 3 * streu);
    const hoehe = lerp(FLUG_Y, 9.5, lande) + 9 * streu;
    const v = Math.max(6, tempoBei(state.z));
    const steig = start ? 0 : state.vx / v;
    const t = state.zeit;
    const kPlatz = 1 - Math.exp(-dt / 0.9);
    const kDazu = Math.exp(-dt / 0.42);
    const kRoll = 1 - Math.exp(-dt / 0.2);
    const rollZiel = clamp(-state.vx / QUER0, -1, 1) * 0.7;
    const twist = 0.8 * Math.sin(t * 0.31);
    // Geballt zittert nichts mehr: dicht und straff.
    const lose = 1 - state.ball;

    nah.length = 0;
    if (state.schritt === "flug") nahSammeln(Rz, Rz);

    let tote = 0;
    let links = 0;
    for (let i = vg.n - 1; i >= 0; i -= 1) {
      vg.warte[i] -= dt;
      if (vg.warte[i] <= 0) platz(i);
      const ox = (vg.ox[i] += (vg.tx[i] - vg.ox[i]) * kPlatz);
      const oy = (vg.oy[i] += (vg.ty[i] - vg.oy[i]) * kPlatz);
      const oz = (vg.oz[i] += (vg.tz[i] - vg.oz[i]) * kPlatz);
      const w = state.wirbel + twist * oz;
      const cw = Math.cos(w);
      const sw = Math.sin(w);
      const atem = 1 + 0.1 * Math.sin(t * 1.7 - oz * 2.6) * lose;
      const ph = vg.ph[i];
      const jx = (vg.jx[i] *= kDazu);
      const jy = (vg.jy[i] *= kDazu);
      const jz = (vg.jz[i] *= kDazu);
      const lz = oz * Rz + 0.5 * Math.sin(t * 1.3 + ph * 23) * lose;
      const zVor = vg.z[i];
      const z = state.z + lz + jz;
      // Quer und hoch nie über den Rand des Schwarms hinaus.
      const quer = clamp((ox * cw - oy * sw) * Rx * atem + 0.4 * Math.sin(t * 2.3 + ph * 40) * lose + jx, -Rx, Rx);
      const x = (lz > 0 ? state.x + steig * lz : spurBei(state.z + lz)) + quer;
      const y = hoehe + clamp((ox * sw + oy * cw) * Ry * atem + 0.35 * Math.sin(t * 1.9 + ph * 71) * lose + jy, -Ry, Ry);

      let hier = null;
      for (let k = 0; k < nah.length; k += 1) {
        const d = nah[k];
        const dz = z - d.z;
        if (dz > 26 || dz < -26) continue;
        if (trifft(d, x, y, zVor, z)) { hier = d; break; }
      }
      if (hier) {
        hier.tote = (hier.tote || 0) + 1;
        federn(x, y, z, tote);
        if (quer < 0) links += 1;
        vogelWeg(i);
        tote += 1;
        continue;
      }
      vg.roll[i] += (rollZiel + 0.25 * Math.sin(t * 3.1 + ph * 55) - vg.roll[i]) * kRoll;
      vg.x[i] = x;
      vg.y[i] = y;
      vg.z[i] = z;
    }
    if (tote) verlust(tote, links);
  }

  // Neue Vögel: Sie fliegen von dort, wo sie warteten (x, z), an ihre Plätze.
  function dazu(viele, x, z) {
    const m = masse();
    let n = 0;
    for (let k = 0; k < viele; k += 1) {
      const i = neuerVogel();
      if (i < 0) break;
      vg.jx[i] = x - state.x + (Math.random() - 0.5) * 3 - vg.ox[i] * m.x;
      vg.jy[i] = (Math.random() - 0.5) * 3 - vg.oy[i] * m.y;
      vg.jz[i] = z - state.z + (Math.random() - 0.5) * 3 - vg.oz[i] * m.z;
      n += 1;
    }
    state.geholt += n;
    state.groesster = Math.max(state.groesster, vg.n);
    return n;
  }

  // Perfekt: Die Kette wächst, und Vögel schliessen sich an – je länger die
  // Kette, desto mehr.
  function perfekt(x, z, wort) {
    state.kette += 1;
    state.perfekte += 1;
    const soll = KETTE[Math.min(state.kette, KETTE.length) - 1];
    const n = state.phase === "spiel" ? dazu(soll, x, z) : soll;
    schrift(`${wort} +${n}`, x, FLUG_Y + 5, z, "#ffe08a", 26 + 2 * Math.min(state.kette, 5));
    funken(x, FLUG_Y, z, 14 + 3 * Math.min(state.kette, 5));
    ton("schwarm.perfekt", { hoehe: 1 + 0.06 * Math.min(state.kette - 1, 6) }, 60);
    kids()?.vibrate?.(8);
  }

  function ketteWeg() {
    state.kette = 0;
  }

  // Die Tore: Wenn die Mitte durch ist, wird gemerkt, wie weit neben der
  // Mitte der Lücke; wenn das Ende des Schwarms durch ist, wird gezählt –
  // ein Vogel verloren, und es war nicht perfekt.
  function toreTakt(zVor) {
    const W = state.welt;
    const lang = masse().z;
    for (let i = W.torVon; i < W.tore.length; i += 1) {
      const tor = W.tore[i];
      if (tor.z > state.z + 1) break;
      if (tor.zustand === "offen") {
        if (!quert(zVor, state.z, tor.z)) continue;
        tor.zustand = "durch";
        tor.mitte = state.x - tor.x;
        state.tore += 1;
      }
      if (tor.zustand === "durch" && state.z > tor.z + lang + 1.5) {
        let verloren = 0;
        for (const d of tor.dinge) verloren += d.tote || 0;
        tor.seit = state.zeit;
        if (verloren > 0) {
          tor.zustand = "verlust";
          ketteWeg();
        } else if (Math.abs(tor.mitte) <= perfektBei(tor.z)) {
          tor.zustand = "perfekt";
          perfekt(tor.x, tor.z + 4, "Perfekt");
        } else {
          tor.zustand = "sauber";
          ketteWeg();
          // Wie weit daneben – und auf welcher Seite.
          const m = Math.abs(tor.mitte).toFixed(1).replace(".", ",");
          schrift(tor.mitte < 0 ? `◂ ${m} m` : `${m} m ▸`, tor.x, FLUG_Y + 4, tor.z + 4, "rgba(255, 255, 255, 0.8)", 17);
        }
      }
    }
    while (W.torVon < W.tore.length && W.tore[W.torVon].zustand !== "offen" && W.tore[W.torVon].zustand !== "durch") W.torVon += 1;
  }

  // Ein grosser Trupp: Geht die Mitte durch seinen Ring, kommt er dazu.
  function truppsTakt(zVor) {
    const W = state.welt;
    while (W.truppVon < W.trupps.length && W.trupps[W.truppVon].z < state.z - 80) W.truppVon += 1;
    for (let i = W.truppVon; i < W.trupps.length; i += 1) {
      const trupp = W.trupps[i];
      if (trupp.z > state.z + 1) break;
      if (trupp.zustand !== "offen" || !quert(zVor, state.z, trupp.z)) continue;
      trupp.seit = state.zeit;
      if (Math.abs(trupp.x - state.x) < TRUPP.fang) {
        trupp.zustand = "geholt";
        const n = state.phase === "spiel" ? dazu(trupp.n, trupp.x, trupp.z) : trupp.n;
        if (state.phase !== "bereit") {
          schrift(`+${n}`, trupp.x, FLUG_Y + 6, trupp.z, "#ffe3f3", 34);
          funken(trupp.x, FLUG_Y, trupp.z, 34);
          ton("schwarm.trupp", { laut: 1.2, hoehe: 1.15 }, 120);
          kids()?.vibrate?.(10);
        }
      } else {
        trupp.zustand = "verpasst";
      }
    }
  }

  /*
   * Der Falke. Bis FALKE_STOSS Sekunden vor seinem Ort kreist er voraus und
   * schreit; dann legt er die Flügel an und stösst auf die Mitte des
   * Schwarms. Ist der geballt, greift er ins Leere – wer erst in den letzten
   * FALKE_SPAET Sekunden geballt hat, hat ihn pariert (die Kette wächst),
   * wer früher ballte, war zu früh (die Kette bricht). Aufgefächert reisst er
   * FALKE_RAUB des Schwarms heraus. Alles hängt an der Strecke, nicht an der
   * Uhr: Wer gleich fliegt, trifft denselben Falken.
   */
  const restBei = (f) => (f.z - state.z) / Math.max(6, tempoBei(state.z));
  function falkenTakt(zVor) {
    const W = state.welt;
    while (W.falkeVon < W.falken.length && W.falken[W.falkeVon].z < state.z - 200) W.falkeVon += 1;
    for (let i = W.falkeVon; i < W.falken.length; i += 1) {
      const f = W.falken[i];
      if (f.z > state.z + 600) break;
      const rest = restBei(f);
      if (f.zustand === "offen") {
        // Vor dem ersten sagt das Spiel einmal, was zu tun ist – früh genug,
        // dass die Tafel weg ist, wenn er zustösst.
        if (!f.gesagt && rest < 3.6) {
          f.gesagt = true;
          if (W.ersterFalke === f.z && state.phase === "spiel") karte("Ein Falke!", "Ballen, wenn er zustösst – nicht vorher", "#ffd0b0", 2.1);
        }
        if (!f.gerufen && rest < 2.2) {
          f.gerufen = true;
          if (state.phase === "spiel") ton("schwarm.falke", { laut: 0.7 }, 200);
        }
        if (rest <= FALKE_STOSS) {
          f.anlegen = falkeOrt(f, FALKE_STOSS + 1e-6).slice();
          f.zustand = "stoss";
          if (state.phase === "spiel") ton("schwarm.falke", { laut: 1.1, hoehe: 1.12 }, 200);
        }
      }
      if (f.zustand === "stoss" && quert(zVor, state.z, f.z)) {
        f.seit = state.zeit;
        f.x = state.x;
        if (state.ball >= GEBALLT) {
          if (state.zeit - state.ballenSeit <= FALKE_SPAET) {
            f.zustand = "pariert";
            perfekt(state.x, f.z + 4, "Pariert");
          } else {
            f.zustand = "leer";
            ketteWeg();
            schrift("zu früh", state.x, FLUG_Y + 5, f.z + 4, "rgba(255, 255, 255, 0.85)", 20);
          }
          ton("schwarm.ballen", { laut: 0.8 }, 60);
        } else {
          f.zustand = "raub";
          ketteWeg();
          if (state.phase === "spiel") {
            const raub = Math.min(vg.n, Math.max(4, Math.round(vg.n * FALKE_RAUB)));
            for (let k = 0; k < raub; k += 1) {
              const j = Math.floor(Math.random() * vg.n);
              federn(vg.x[j], vg.y[j], vg.z[j], k);
              vogelWeg(j);
            }
            f.raub = raub;
            verlust(raub, 0, "Falke");
          }
        }
      }
    }
  }

  // Wo der Falke gerade ist: kreisend voraus, im Stoss auf dem Weg zur Mitte
  // des Schwarms, danach wieder hinauf.
  const falkeHier = [0, 0, 0];
  function falkeOrt(f, rest) {
    const t = state.zeit;
    if (f.zustand === "offen" || rest > FALKE_STOSS) {
      falkeHier[0] = state.x * 0.6 + f.seite * (17 + 5 * Math.sin(t * 1.25 + f.nr));
      falkeHier[1] = 33 + 3 * Math.sin(t * 0.9 + f.nr);
      falkeHier[2] = f.z + 30 + 7 * Math.cos(t * 1.25 + f.nr);
      return falkeHier;
    }
    if (f.zustand === "stoss") {
      const u = 1 - clamp(rest / FALKE_STOSS, 0, 1);
      const a = f.anlegen || falkeHier;
      const k = u * u;
      falkeHier[0] = lerp(a[0], state.x, k);
      falkeHier[1] = lerp(a[1], FLUG_Y + 0.4, k);
      falkeHier[2] = lerp(a[2], f.z, k);
      return falkeHier;
    }
    const s = state.zeit - f.seit;
    falkeHier[0] = (f.x ?? state.x) + f.seite * 10 * s;
    falkeHier[1] = FLUG_Y + 2 + 16 * s;
    falkeHier[2] = f.z + tempoBei(f.z) * 0.8 * s + 6;
    return falkeHier;
  }

  // Beim Zuschauen zählt die Aufzeichnung: Der Schwarm ist so gross, wie er
  // damals war.
  function gleicheAn(soll) {
    const ziel = clamp(Math.round(soll), 0, VOEGEL_MAX);
    while (vg.n > ziel) vogelWeg(Math.floor(Math.random() * vg.n));
    while (vg.n < ziel) {
      const i = neuerVogel();
      if (i < 0) break;
      vg.jz[i] = -8;
    }
  }

  // ---------------------------------------------------------------------------
  // Teilchen und Schriften
  // ---------------------------------------------------------------------------
  // Federn, wo ein Vogel getroffen wurde – helle Punkte, die im Fahrtwind
  // zurückbleiben und sinken. Höchstens ein paar je Bild.
  function federn(x, y, z, schon) {
    if (schon > (ruhig() ? 2 : 9) || state.teile.length > 260) return;
    for (let i = 0; i < 2; i += 1) {
      state.teile.push({
        x, y, z, vx: (Math.random() - 0.5) * 7, vy: 1 + Math.random() * 4, vz: 6 + Math.random() * 10,
        fall: 5, r: 0.22 + Math.random() * 0.2, farbe: [1.0, 0.93, 0.82], leben: 0.9 + Math.random() * 0.7, max: 1.6,
      });
    }
  }

  // Goldene Funken, wo ein Trupp dazustösst.
  function funken(x, y, z, anzahl) {
    if (ruhig()) anzahl = Math.ceil(anzahl / 3);
    for (let i = 0; i < anzahl; i += 1) {
      const w = Math.random() * Math.PI * 2;
      const v = 3 + Math.random() * 9;
      state.teile.push({
        x, y, z, vx: Math.cos(w) * v, vy: Math.sin(w) * v, vz: tempoBei(state.z) * (0.75 + Math.random() * 0.2),
        fall: 2, r: 0.3 + Math.random() * 0.3, farbe: [1.0, 0.78, 0.3], leben: 0.5 + Math.random() * 0.5, max: 1,
      });
    }
  }

  function schrift(text, x, y, z, farbe, gross) {
    state.schriften.push({ text, x, y, z, farbe, gross, leben: 1.3, max: 1.3 });
  }

  // Vögel verloren: ein Ruck, ein Flattern, der Rand des Bilds glüht auf der
  // Seite, die am Fels hing – und nach einem Augenblick steht da, wie viele es
  // auf einmal waren. links: wie viele davon links der Mitte flogen.
  function verlust(tote, links = 0, wer = "") {
    state.verloren += tote;
    if (state.phase === "zuschauen") return;
    const merker = state.verlustMerker;
    merker.zahl += tote;
    merker.links += links;
    merker.seit = state.zeit;
    if (wer) merker.wer = wer;
    state.stoss = Math.min(1, state.stoss + 0.25 + tote * 0.03);
    state.blitz = Math.min(1, state.blitz + 0.2 + tote * 0.03);
    // -1: links, 1: rechts, 0: rundum (der Falke)
    state.blitzSeite = wer ? 0 : links * 2 > tote ? -1 : links * 2 < tote ? 1 : 0;
    ton("schwarm.treffer", { laut: clamp(0.5 + tote * 0.06, 0.5, 1.2) }, 260);
    kids()?.vibrate?.(tote > 6 ? [20, 30, 30] : 14);
  }

  // ---------------------------------------------------------------------------
  // Die Kamera
  // ---------------------------------------------------------------------------
  // Hinter und über dem Schwarm, mit Blick voraus. Die Welt wird relativ zu
  // ihr gezeichnet (x und z der Kamera sind null, nur ihre Höhe bleibt): So
  // rechnet die Grafikkarte auch nach Kilometern mit kleinen Zahlen.
  const view = { cssW: 0, cssH: 0, dpr: 1, frei: 0, pw: 0, ph: 0, guete: 1, fest: false, langsam: 0, schnell: 0 };
  const kam = {
    x: 0, y: 19, z: -34, roll: 0, weit: 34, fov: 1, seit: 1,
    rechts: [1, 0, 0], hoch: [0, 1, 0], vor: [0, 0, 1], tan: [1, 1],
    proj: new Float32Array(16), sicht: new Float32Array(16), pv: new Float32Array(16),
  };

  function kameraTakt(dt) {
    const m = masse();
    const weitZiel = 15 + m.z * 1.15;
    const k = 1 - Math.exp(-dt / 0.6);
    kam.weit += (weitZiel - kam.weit) * k;
    kam.x += (state.x * 0.9 - kam.x) * (1 - Math.exp(-dt / 0.16));
    kam.z = state.z - kam.weit;
    kam.y += (FLUG_Y + 1.6 + m.x * 0.2 - kam.y) * k;
    const rollZiel = ruhig() ? 0 : clamp(state.vx / QUER0, -1, 1) * 0.09;
    kam.roll += (rollZiel - kam.roll) * (1 - Math.exp(-dt / 0.3));
  }

  function kameraStellen() {
    const seit = view.cssW / Math.max(1, view.cssH);
    // 58 Grad in der Höhe – auf einem sehr breiten Bild weniger (zur Seite
    // höchstens 84), hochkant mehr (zur Seite mindestens 54). Mit dem Tempo
    // wird der Blick etwas weiter.
    const schnell = ruhig() ? 0 : clamp((tempoBei(state.z) - V0) / (V_MAX - V0), 0, 1) * (state.schritt === "flug" ? 1 : 0);
    const grad = Math.PI / 180;
    let fov = 58 * grad;
    fov = Math.min(fov, 2 * Math.atan(Math.tan(42 * grad) / seit));
    fov = Math.max(fov, Math.min(1.7, 2 * Math.atan(Math.tan(27 * grad) / seit)));
    fov *= 1 + 0.1 * schnell;
    kam.fov = fov;
    kam.seit = seit;
    const wackel = ruhig() ? 0 : state.stoss;
    const ax = (Math.sin(state.zeit * 61) * 0.25 + Math.sin(state.zeit * 37) * 0.2) * wackel;
    const ay = Math.sin(state.zeit * 53) * 0.3 * wackel;
    // Auge im Ursprung der gezeichneten Welt, Blick ein Stück voraus und hinab.
    const zielX = (state.x - kam.x) * 0.5;
    // Quer liegt der Horizont knapp über der Mitte; hochkant schaut die Kamera
    // höher – sonst wäre die untere Hälfte nur Wasser.
    const zielY = kam.y + lerp(-5.2, 12, clamp((1.15 - seit) / 0.6, 0, 1));
    const zielZ = kam.weit + 62;
    let fx = zielX - ax;
    let fy = zielY - (kam.y + ay);
    let fz = zielZ;
    const fl = Math.hypot(fx, fy, fz);
    fx /= fl; fy /= fl; fz /= fl;
    const ux = Math.sin(kam.roll);
    const uy = Math.cos(kam.roll);
    // rechts = oben × vor, hoch = vor × rechts (x zeigt im Bild nach rechts).
    let rx = uy * fz;
    let ry = -ux * fz;
    let rz = ux * fy - uy * fx;
    const rl = Math.hypot(rx, ry, rz);
    rx /= rl; ry /= rl; rz /= rl;
    const hx = fy * rz - fz * ry;
    const hy = fz * rx - fx * rz;
    const hz = fx * ry - fy * rx;
    kam.rechts = [rx, ry, rz];
    kam.hoch = [hx, hy, hz];
    kam.vor = [fx, fy, fz];
    kam.tan = [Math.tan(fov / 2) * seit, Math.tan(fov / 2)];
    const ex = ax;
    const ey = kam.y + ay;
    const s = kam.sicht;
    s[0] = rx; s[4] = ry; s[8] = rz; s[12] = -(rx * ex + ry * ey);
    s[1] = hx; s[5] = hy; s[9] = hz; s[13] = -(hx * ex + hy * ey);
    s[2] = -fx; s[6] = -fy; s[10] = -fz; s[14] = fx * ex + fy * ey;
    s[3] = 0; s[7] = 0; s[11] = 0; s[15] = 1;
    const f = 1 / Math.tan(fov / 2);
    const NAH = 1;
    const FERN = 1700;
    const p = kam.proj;
    p.fill(0);
    p[0] = f / seit; p[5] = f; p[10] = (FERN + NAH) / (NAH - FERN); p[11] = -1; p[14] = (2 * FERN * NAH) / (NAH - FERN);
    const pv = kam.pv;
    for (let c = 0; c < 4; c += 1) {
      for (let r = 0; r < 4; r += 1) {
        pv[c * 4 + r] = p[r] * s[c * 4] + p[4 + r] * s[c * 4 + 1] + p[8 + r] * s[c * 4 + 2] + p[12 + r] * s[c * 4 + 3];
      }
    }
    kam.auge = [ex, ey, 0];
  }

  // Wo ein Punkt der Welt im Bild steht (in CSS-Pixeln) – oder null, wenn er
  // hinter der Kamera liegt.
  function imBild(x, y, z) {
    const px = x - kam.x;
    const pz = z - kam.z;
    const m = kam.pv;
    const w = m[3] * px + m[7] * y + m[11] * pz + m[15];
    if (w <= 0.01) return null;
    const cx = (m[0] * px + m[4] * y + m[8] * pz + m[12]) / w;
    const cy = (m[1] * px + m[5] * y + m[9] * pz + m[13]) / w;
    return { x: (cx * 0.5 + 0.5) * view.cssW, y: (0.5 - cy * 0.5) * view.cssH, w };
  }

  // ---------------------------------------------------------------------------
  // Zeichnen: die Programme
  // ---------------------------------------------------------------------------
  let gl = null;
  const bild = { ok: false, verloren: false, prog: {}, netz: {}, rausch: null, wasser: null, leer: null };

  // Was alle Programme über das Licht wissen: Sonne, Mond, Dunst.
  const LICHT = `
    uniform vec3 uSonne, uSonneFlach, uLicht, uGlut, uNebel, uHimmelLicht, uMond, uMondLicht, uAuge;
    uniform float uDichte, uZeit;
    vec3 dunst(vec3 farbe, vec3 ort) {
      vec3 hin = ort - uAuge;
      float weit = length(hin);
      float zurSonne = max(dot(normalize(hin.xz + vec2(1e-4)), uSonneFlach.xz), 0.0);
      vec3 nebel = mix(uNebel, uGlut, 0.5 * pow(zurSonne, 6.0));
      return mix(nebel, farbe, exp(-weit * uDichte));
    }
  `;

  // Der Himmel: ein Dreieck über das ganze Bild. Aus der Blickrichtung jedes
  // Punkts entstehen Verlauf, Sonne, Wolken, Berge am Horizont, Mond und
  // Sterne. Unter dem Horizont steht derselbe Himmel auf dem Kopf – das
  // Wasser legt sich darüber und lässt davon durch, was es spiegelt.
  const HIMMEL_VS = `#version 300 es
    out vec2 vBild;
    void main() {
      vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2)) * 2.0 - 1.0;
      vBild = p;
      gl_Position = vec4(p, 0.9999, 1.0);
    }`;
  const HIMMEL_FS = `#version 300 es
    precision highp float;
    in vec2 vBild;
    out vec4 aus;
    uniform vec3 uRechts, uHoch, uVor, uZenit, uHorizont, uWolkeHell, uWolkeDunkel;
    uniform vec2 uTan;
    uniform float uNacht;
    uniform sampler2D uRausch;
    ${LICHT}
    void main() {
      vec3 d = normalize(uVor + vBild.x * uTan.x * uRechts + vBild.y * uTan.y * uHoch);
      float gespiegelt = step(d.y, 0.0);
      d.y = abs(d.y);
      float h = d.y;
      float zurSonne = max(dot(d, uSonne), 0.0);
      float seite = max(dot(normalize(d.xz + vec2(1e-4)), uSonneFlach.xz), 0.0);

      // Der Verlauf: am Horizont warm, oben kühl – und zur Sonne hin glüht er.
      vec3 c = mix(uHorizont, uZenit, 1.0 - pow(1.0 - h, 3.4));
      float band = pow(1.0 - h, 10.0);
      c = mix(c, uGlut, band * (0.3 + 0.7 * seite * seite));

      // Wolken: zwei Lagen Rauschen, zum Horizont hin gestreckt, von unten
      // beleuchtet, wo die Sonne steht.
      vec2 uv = d.xz / (h + 0.11);
      float w1 = texture(uRausch, uv * vec2(0.045, 0.10) + vec2(uZeit * 0.0015, 0.0)).a;
      float w2 = texture(uRausch, uv * vec2(0.12, 0.26) + vec2(-uZeit * 0.0011, 0.37)).r;
      float wolke = smoothstep(0.46, 0.78, w1 * 0.72 + w2 * 0.28 + 0.07);
      wolke *= smoothstep(0.015, 0.11, h) * (1.0 - smoothstep(0.5, 0.95, h));
      float hell = clamp(pow(zurSonne, 2.5) * 0.9 + band * 0.5 + (1.0 - h) * 0.25, 0.0, 1.0);
      c = mix(c, mix(uWolkeDunkel, uWolkeHell, hell), wolke * 0.82);

      // Die Sonne: ein weiter Hof, ein enger, die Scheibe.
      c += uLicht * (pow(zurSonne, 5.0) * 0.20 + pow(zurSonne, 48.0) * 0.40 + pow(zurSonne, 500.0) * 0.9) * (1.0 - wolke * 0.5);
      c += uLicht * smoothstep(0.99945, 0.9998, zurSonne) * 3.0 * (1.0 - gespiegelt);

      // Mond und Sterne.
      float zumMond = max(dot(d, uMond), 0.0);
      c += uMondLicht * (pow(zumMond, 30.0) * 0.25 + smoothstep(0.99975, 0.9999, zumMond) * 2.2 * (1.0 - gespiegelt)) * (1.0 - wolke * 0.7);
      if (uNacht > 0.01) {
        vec3 q = d * 110.0;
        vec3 zelle = floor(q);
        float z = fract(sin(dot(zelle, vec3(127.1, 311.7, 74.7))) * 43758.5453);
        float stern = step(0.988, z) * smoothstep(0.42, 0.05, length(fract(q) - 0.5));
        c += vec3(0.85, 0.9, 1.0) * stern * uNacht * smoothstep(0.03, 0.3, h) * (1.0 - wolke) * (0.65 + 0.35 * sin(uZeit * 2.6 + z * 60.0));
      }

      // Berge am Horizont, zwei Ketten – zur Sonne hin ist das Meer offen.
      float az = atan(d.x, d.z);
      float offen = 1.0 - 0.85 * pow(seite, 5.0);
      float fern = (0.012 + 0.085 * pow(texture(uRausch, vec2(az * 0.21 + 0.31, 0.21)).r, 1.5) + 0.02 * texture(uRausch, vec2(az * 1.7, 0.63)).a) * offen;
      float nahe = (0.004 + 0.045 * pow(texture(uRausch, vec2(az * 0.43 + 0.72, 0.58)).r, 1.4) + 0.008 * texture(uRausch, vec2(az * 2.9, 0.11)).a) * offen;
      vec3 dunstFarbe = mix(uNebel, uGlut, 0.5 * pow(seite, 6.0));
      c = mix(c, mix(dunstFarbe, uZenit * 0.5, 0.25), smoothstep(fern + 0.0025, fern - 0.0025, h) * 0.9);
      c = mix(c, mix(dunstFarbe, uZenit * 0.3, 0.55), smoothstep(nahe + 0.002, nahe - 0.002, h) * 0.95);

      // Ein Hauch Rauschen gegen Streifen im Verlauf.
      c += (fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) / 180.0;
      aus = vec4(c, 1.0);
    }`;

  // Das Wasser: eine grosse Fläche bei y = 0. Seine Farbe ist, was man durch
  // das Wasser sieht (dunkel), plus das Glitzern von Sonne und Mond; wie viel
  // es spiegelt, steht in alpha – so viel bleibt vom gespiegelten Himmel und
  // den gespiegelten Felsen darunter stehen (blendFunc ONE, SRC_ALPHA).
  const WASSER_VS = `#version 300 es
    layout(location = 0) in vec2 aOrt;
    uniform mat4 uPV;
    out vec3 vOrt;
    void main() {
      vOrt = vec3(aOrt.x, 0.0, aOrt.y);
      gl_Position = uPV * vec4(vOrt, 1.0);
    }`;
  const WASSER_FS = `#version 300 es
    precision highp float;
    in vec3 vOrt;
    out vec4 aus;
    uniform sampler2D uRausch;
    uniform vec2 uVersatz1, uVersatz2;
    uniform vec3 uWasser;
    ${LICHT}
    void main() {
      vec3 hin = uAuge - vOrt;
      float weit = length(hin);
      vec3 v = hin / weit;
      vec4 a = texture(uRausch, vOrt.xz * 0.019 + uVersatz1);
      vec4 b = texture(uRausch, vOrt.xz * 0.071 + uVersatz2);
      vec2 neigung = (a.gb - 0.5) * 2.6 + (b.gb - 0.5) * 1.6;
      float ruhe = 1.0 / (1.0 + weit * 0.0035);
      vec3 n = normalize(vec3(-neigung.x * ruhe, 1.0, -neigung.y * ruhe));
      float nv = max(dot(n, v), 0.0);
      float spiegel = 0.04 + 0.96 * pow(1.0 - nv, 3.4);
      vec3 r = reflect(-v, n);
      float zurSonne = max(dot(r, uSonne), 0.0);
      float zumMond = max(dot(r, uMond), 0.0);
      vec3 glanz = uLicht * (pow(zurSonne, 380.0) * 22.0 + pow(zurSonne, 40.0) * 0.45)
        + uMondLicht * (pow(zumMond, 300.0) * 9.0 + pow(zumMond, 30.0) * 0.2);
      aus = vec4(uWasser * (1.0 - spiegel) + glanz * spiegel, spiegel * mix(0.95, 1.0, smoothstep(700.0, 1600.0, weit)));
    }`;

  // Alles Feste: Felsen, Türme, Flügel, Masten, Kugeln. Ein Netz je Form,
  // viele Male gezeichnet – jedes Mal mit Ort, Grösse, Drehung und Farbe.
  // uSpiegel = -1 stellt alles auf den Kopf: das Spiegelbild im Wasser.
  const DING_VS = `#version 300 es
    layout(location = 0) in vec3 aOrt;
    layout(location = 1) in vec3 aNorm;
    layout(location = 2) in vec4 iOrt;    // x, y, z, Drehung um die Hochachse
    layout(location = 3) in vec4 iMass;   // Breite, Höhe, Tiefe, Drehung um die Flugachse
    layout(location = 4) in vec4 iFarbe;  // Farbe, eigenes Leuchten
    uniform mat4 uPV;
    uniform float uSpiegel, uUhr;
    out vec3 vOrt;
    out vec3 vNorm;
    out vec4 vFarbe;
    out float vHoehe;
    void main() {
      vec3 p = aOrt * iMass.xyz;
      vec3 n = aNorm / iMass.xyz;
      float cr = cos(iMass.w), sr = sin(iMass.w);
      p = vec3(p.x * cr - p.y * sr, p.x * sr + p.y * cr, p.z);
      n = vec3(n.x * cr - n.y * sr, n.x * sr + n.y * cr, n.z);
      float cy = cos(iOrt.w), sy = sin(iOrt.w);
      p = vec3(p.x * cy + p.z * sy, p.y, -p.x * sy + p.z * cy);
      n = vec3(n.x * cy + n.z * sy, n.y, -n.x * sy + n.z * cy);
      vec3 w = p + iOrt.xyz;
      vHoehe = w.y;
      if (uSpiegel < 0.0) {
        // Das Spiegelbild zittert, je weiter oben, desto mehr.
        w.x += sin(w.y * 0.5 + uUhr * 1.7 + w.z * 0.11) * 0.028 * max(w.y, 0.0);
        w.y = -w.y;
        n.y = -n.y;
      }
      vOrt = w;
      vNorm = n;
      vFarbe = iFarbe;
      gl_Position = uPV * vec4(w, 1.0);
    }`;
  const DING_FS = `#version 300 es
    precision highp float;
    in vec3 vOrt;
    in vec3 vNorm;
    in vec4 vFarbe;
    in float vHoehe;
    out vec4 aus;
    uniform float uSpiegel;
    ${LICHT}
    void main() {
      if (uSpiegel < 0.0 && vHoehe < 0.0) discard;
      vec3 n = normalize(vNorm);
      vec3 v = normalize(uAuge - vOrt);
      float oben = n.y * uSpiegel * 0.5 + 0.5;
      vec3 c = vFarbe.rgb * (uHimmelLicht * mix(0.32, 1.0, oben)
        + uLicht * max(dot(n, uSonne), 0.0) * 0.9 + uMondLicht * max(dot(n, uMond), 0.0) * 0.9);
      // Gegenlicht: An den Rändern glüht der Abend.
      float rand = pow(1.0 - abs(dot(n, v)), 3.0);
      c += (uGlut * 0.26 + uMondLicht * 0.22) * rand * (0.35 + 0.65 * oben);
      c += vFarbe.rgb * vFarbe.a;
      aus = vec4(dunst(c, vOrt), 1.0);
    }`;

  // Die Vögel: je eine kleine Scheibe, die zur Kamera schaut – von hinten
  // gesehen ein Rumpf und zwei Flügel, die schlagen. Die Form entsteht im
  // Programm aus drei Strecken; so bleibt auch ein ferner Vogel ein Vogel und
  // wird nie dünner als ein paar Bildpunkte.
  const VOGEL_VS = `#version 300 es
    layout(location = 0) in vec2 aEcke;
    layout(location = 1) in vec4 iA;      // x, y, z, Takt
    layout(location = 2) in vec4 iB;      // rollen, –, Grösse, Deckkraft
    layout(location = 3) in vec4 iC;      // Farbe
    uniform mat4 uProj, uSicht;
    uniform float uSpiegel, uUhr, uPunkt;
    out vec2 vEcke;
    out vec3 vOrt;
    out vec4 vFarbe;
    out float vSchlag;
    void main() {
      vec3 w = iA.xyz;
      vec2 e = aEcke;
      float roll = iB.x;
      if (uSpiegel < 0.0) { w.y = -w.y; e.y = -e.y; roll = -roll; }
      vec4 p = uSicht * vec4(w, 1.0);
      float gross = max(iB.z, -p.z * uPunkt * 2.6);
      float c = cos(roll), s = sin(roll);
      p.xy += vec2(e.x * c - e.y * s, e.x * s + e.y * c) * gross;
      vEcke = aEcke;
      vOrt = w;
      vFarbe = vec4(iC.rgb, iB.w);
      vSchlag = sin(uUhr * (24.0 + 8.0 * fract(iA.w * 7.31)) + iA.w * 6.2832);
      gl_Position = uProj * p;
    }`;
  const VOGEL_FS = `#version 300 es
    precision highp float;
    in vec2 vEcke;
    in vec3 vOrt;
    in vec4 vFarbe;
    in float vSchlag;
    out vec4 aus;
    uniform float uGeist;
    ${LICHT}
    float strecke(vec2 p, vec2 a, vec2 b) {
      vec2 pa = p - a;
      vec2 ba = b - a;
      return length(pa - ba * clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0));
    }
    void main() {
      vec2 p = vec2(abs(vEcke.x), vEcke.y);
      float w = 0.12 + 0.62 * vSchlag;
      vec2 gelenk = 0.44 * vec2(cos(w * 0.6), sin(w * 0.6));
      vec2 spitze = gelenk + 0.5 * vec2(cos(w * 1.35), sin(w * 1.35));
      float d = strecke(p, vec2(0.0), gelenk) - 0.075;
      d = min(d, strecke(p, gelenk, spitze) - mix(0.07, 0.022, clamp(length(p - gelenk) * 2.0, 0.0, 1.0)));
      d = min(d, length(p * vec2(1.0, 0.8)) - 0.13);
      float fein = fwidth(d);
      float rand = fein * 0.9 + 1e-4;
      float a = smoothstep(rand, -rand, d) * vFarbe.a;
      if (a < 0.01) discard;
      // Im Gegenlicht glühen die Ränder der Flügel – nur aus der Nähe, sonst
      // wäre ein ferner Vogel kein dunkler Punkt mehr.
      float kante = smoothstep(-0.06, 0.0, d) * smoothstep(0.08, 0.02, fein);
      vec3 gefieder = vFarbe.rgb + (uGlut * 0.8 + uLicht * 0.2 + uMondLicht * 0.55) * kante;
      vec3 c = mix(dunst(gefieder, vOrt), vFarbe.rgb, uGeist);
      aus = vec4(c * a, a);
    }`;

  // Die Seile einer Leitung: Bänder, die durchhängen und nie dünner werden
  // als gut ein Bildpunkt.
  const SEIL_VS = `#version 300 es
    layout(location = 0) in vec2 aOrt;    // wo auf dem Seil (0 bis 1), oben oder unten
    layout(location = 1) in vec4 iA;      // x und Höhe am ersten Mast, z, x am zweiten
    layout(location = 2) in vec4 iB;      // Höhe am zweiten Mast, Durchhang, Dicke
    uniform mat4 uPV;
    uniform float uSpiegel, uPunkt;
    uniform vec3 uAugeV;
    out vec3 vOrt;
    void main() {
      float u = aOrt.x;
      vec3 w = vec3(mix(iA.x, iA.w, u), mix(iA.y, iB.x, u) - iB.y * 4.0 * u * (1.0 - u), iA.z);
      float dick = max(iB.z, length(w - uAugeV) * uPunkt * 1.5);
      w.y += aOrt.y * dick * 0.5;
      if (uSpiegel < 0.0) w.y = -w.y;
      vOrt = w;
      gl_Position = uPV * vec4(w, 1.0);
    }`;
  const SEIL_FS = `#version 300 es
    precision highp float;
    in vec3 vOrt;
    out vec4 aus;
    ${LICHT}
    void main() {
      aus = vec4(dunst(vec3(0.05, 0.045, 0.06) + uGlut * 0.08, vOrt), 1.0);
    }`;

  // Alles, was leuchtet: der Ring um einen Trupp, Warnlichter, Federn,
  // Funken, der Schleier vor der Sonne. Scheiben, die zur Kamera schauen und
  // ihr Licht dazulegen.
  const SCHEIN_VS = `#version 300 es
    layout(location = 0) in vec2 aEcke;
    layout(location = 1) in vec4 iA;      // x, y, z, Grösse
    layout(location = 2) in vec4 iB;      // Farbe, wie hart der Rand ist
    uniform mat4 uProj, uSicht;
    out vec2 vEcke;
    out vec4 vFarbe;
    void main() {
      vec4 p = uSicht * vec4(iA.xyz, 1.0);
      p.xy += aEcke * iA.w;
      vEcke = aEcke;
      vFarbe = iB;
      gl_Position = uProj * p;
    }`;
  const SCHEIN_FS = `#version 300 es
    precision highp float;
    in vec2 vEcke;
    in vec4 vFarbe;
    out vec4 aus;
    void main() {
      float r = length(vEcke);
      float a;
      if (vFarbe.a < 0.0) {
        // Ein Ring aus Licht mit einem Hauch darin (um einen Trupp).
        float ab = (r - 0.84) / 0.055;
        a = exp(-ab * ab) + 0.16 * max(1.0 - r, 0.0);
      } else {
        a = pow(max(1.0 - r, 0.0), vFarbe.a);
      }
      aus = vec4(vFarbe.rgb * a, 1.0);
    }`;

  function programm(name, vs, fs) {
    const baue = (art, quelle) => {
      const s = gl.createShader(art);
      gl.shaderSource(s, quelle);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(`Schwarm, Programm «${name}»: ${gl.getShaderInfoLog(s)}`);
      return s;
    };
    const p = gl.createProgram();
    gl.attachShader(p, baue(gl.VERTEX_SHADER, vs));
    gl.attachShader(p, baue(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(`Schwarm, Programm «${name}»: ${gl.getProgramInfoLog(p)}`);
    const orte = new Map();
    return {
      p,
      ort(u) {
        if (!orte.has(u)) orte.set(u, gl.getUniformLocation(p, u));
        return orte.get(u);
      },
    };
  }

  // ---------------------------------------------------------------------------
  // Zeichnen: die Netze
  // ---------------------------------------------------------------------------
  // Flächen mit je einer eigenen Richtung (kantig, wie gebrochener Fels).
  // innen ist ein Punkt im Inneren des Körpers: Die Fläche schaut von ihm weg.
  function netzBauer() {
    const v = [];
    function dreieck(a, b, c, innen) {
      const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
      const wx = c[0] - a[0], wy = c[1] - a[1], wz = c[2] - a[2];
      let nx = uy * wz - uz * wy;
      let ny = uz * wx - ux * wz;
      let nz = ux * wy - uy * wx;
      const l = Math.hypot(nx, ny, nz) || 1;
      nx /= l; ny /= l; nz /= l;
      const mx = (a[0] + b[0] + c[0]) / 3 - innen[0];
      const my = (a[1] + b[1] + c[1]) / 3 - innen[1];
      const mz = (a[2] + b[2] + c[2]) / 3 - innen[2];
      if (nx * mx + ny * my + nz * mz < 0) { nx = -nx; ny = -ny; nz = -nz; }
      for (const p of [a, b, c]) v.push(p[0], p[1], p[2], nx, ny, nz);
    }
    function viereck(a, b, c, d, innen) {
      dreieck(a, b, c, innen);
      dreieck(a, c, d, innen);
    }
    function kasten(mx, my, mz, hx, hy, hz) {
      const e = (sx, sy, sz) => [mx + sx * hx, my + sy * hy, mz + sz * hz];
      const m = [mx, my, mz];
      viereck(e(-1, -1, 1), e(1, -1, 1), e(1, 1, 1), e(-1, 1, 1), m);
      viereck(e(-1, -1, -1), e(1, -1, -1), e(1, 1, -1), e(-1, 1, -1), m);
      viereck(e(-1, -1, -1), e(-1, -1, 1), e(-1, 1, 1), e(-1, 1, -1), m);
      viereck(e(1, -1, -1), e(1, -1, 1), e(1, 1, 1), e(1, 1, -1), m);
      viereck(e(-1, 1, -1), e(1, 1, -1), e(1, 1, 1), e(-1, 1, 1), m);
      viereck(e(-1, -1, -1), e(1, -1, -1), e(1, -1, 1), e(-1, -1, 1), m);
    }
    return { v, dreieck, viereck, kasten };
  }

  // Eine Felsnadel: ein Turm aus Ringen, nach oben schmaler (wie
  // nadelRadius), jede Ecke ein wenig verrückt. Höhe und Breite sind 1.
  function nadelNetz(form) {
    const b = netzBauer();
    const HOEHEN = [-0.05, 0.05, 0.16, 0.3, 0.45, 0.6, 0.75, 0.89, 1];
    const S = 10;
    const lehne = [(hash01(form * 3.3 + 1) - 0.5) * 0.5, (hash01(form * 5.9 + 2) - 0.5) * 0.5];
    const mitte = (t) => [lehne[0] * t * t, t, lehne[1] * t * t];
    const ringe = HOEHEN.map((t, i) => {
      const r = 1 - 0.62 * Math.pow(Math.max(0, t), 1.3);
      const m = mitte(t);
      return Array.from({ length: S }, (_, j) => {
        const w = (j / S) * Math.PI * 2 + hash01(form * 7.7 + i) * 0.5;
        const rr = r * (0.84 + 0.32 * hash01(form * 91.3 + i * 13.1 + j * 3.7));
        return [m[0] + Math.cos(w) * rr, t + (hash01(form * 17 + i * 5 + j) - 0.5) * 0.03, m[2] + Math.sin(w) * rr];
      });
    });
    for (let i = 0; i < ringe.length - 1; i += 1) {
      const innen = mitte((HOEHEN[i] + HOEHEN[i + 1]) / 2);
      for (let j = 0; j < S; j += 1) {
        const k = (j + 1) % S;
        b.viereck(ringe[i][j], ringe[i][k], ringe[i + 1][k], ringe[i + 1][j], innen);
      }
    }
    const spitze = mitte(1.05);
    spitze[1] = 1.05;
    const oben = ringe[ringe.length - 1];
    for (let j = 0; j < S; j += 1) b.dreieck(oben[j], oben[(j + 1) % S], spitze, mitte(0.9));
    return new Float32Array(b.v);
  }

  // Ein Felsbogen: das Tor ist 1 breit (halb) und 1 hoch, der Fels darum
  // reicht bis BOGEN_AUSSEN – dieselbe Form wie bogenBreite.
  function bogenNetz(form) {
    const b = netzBauer();
    const M = 16;
    const hoch = 2 / BOGEN_FORM;
    const punkt = (i, breit, hoehe) => {
      const w = Math.PI * i / M;
      const c = Math.cos(w);
      const s = Math.sin(w);
      const unten = i === 0 || i === M ? -0.05 : 0;
      return [Math.sign(c) * Math.pow(Math.abs(c), hoch) * breit, Math.pow(Math.abs(s), hoch) * hoehe + unten];
    };
    const reihen = Array.from({ length: M + 1 }, (_, i) => {
      const rauh = (n) => hash01(form * 37.1 + i * 7.3 + n * 1.9);
      const innen = punkt(i, 1, 1);
      const aussen = punkt(i, BOGEN_AUSSEN[0] * (0.92 + 0.16 * rauh(1)), BOGEN_AUSSEN[1] * (0.93 + 0.14 * rauh(2)));
      const halb = [(innen[0] + aussen[0]) / 2, (innen[1] + aussen[1]) / 2];
      const tief = 0.5 * (0.85 + 0.3 * rauh(3));
      const bauch = tief * (1.1 + 0.25 * rauh(4));
      return {
        halb,
        iv: [innen[0], innen[1], tief * 0.9], ih: [innen[0], innen[1], -tief * 0.9],
        mv: [halb[0], halb[1], bauch], mh: [halb[0], halb[1], -bauch],
        av: [aussen[0], aussen[1], tief], ah: [aussen[0], aussen[1], -tief],
      };
    });
    for (let i = 0; i < M; i += 1) {
      const p = reihen[i];
      const q = reihen[i + 1];
      const innen = [(p.halb[0] + q.halb[0]) / 2, (p.halb[1] + q.halb[1]) / 2, 0];
      b.viereck(p.iv, q.iv, q.mv, p.mv, innen);
      b.viereck(p.mv, q.mv, q.av, p.av, innen);
      b.viereck(p.ih, q.ih, q.mh, p.mh, innen);
      b.viereck(p.mh, q.mh, q.ah, p.ah, innen);
      b.viereck(p.iv, q.iv, q.ih, p.ih, innen);
      b.viereck(p.av, q.av, q.ah, p.ah, innen);
    }
    return new Float32Array(b.v);
  }

  // Eine Felswand: eine Platte, 1 breit (von 0 bis 1), 1 hoch, 1 tief – mit
  // zerklüfteter Vorder- und Rückseite und gezacktem Grat. Bei x = 0 ist der
  // Spalt: dort steht sie in voller Höhe und mit klarer Kante.
  function wandNetz(form) {
    const b = netzBauer();
    const S = 9;
    const HOEHEN = [-0.03, 0.26, 0.58, 1];
    const rauh = (i, j, n) => hash01(form * 53.7 + i * 9.1 + j * 4.3 + n * 1.7);
    const spalte = (i) => {
      const x = i === 0 ? 0 : i === S ? 1 : (i + (rauh(i, 0, 1) - 0.5) * 0.5) / S;
      const grat = i === 0 ? 1 : 0.8 + 0.2 * rauh(i, 0, 2);
      return HOEHEN.map((h, j) => {
        const y = j === HOEHEN.length - 1 ? grat : h * grat;
        const tief = 0.5 * (j === HOEHEN.length - 1 ? 0.55 : 0.8 + 0.5 * rauh(i, j, 3)) * (i === 0 ? 0.8 : 1);
        return { v: [x, y, tief * (0.9 + 0.2 * rauh(i, j, 4))], h: [x, y, -tief * (0.9 + 0.2 * rauh(i, j, 5))] };
      });
    };
    const spalten = Array.from({ length: S + 1 }, (_, i) => spalte(i));
    for (let i = 0; i < S; i += 1) {
      const p = spalten[i];
      const q = spalten[i + 1];
      const innen = [(p[0].v[0] + q[0].v[0]) / 2, 0.4, 0];
      for (let j = 0; j < HOEHEN.length - 1; j += 1) {
        b.viereck(p[j].v, q[j].v, q[j + 1].v, p[j + 1].v, innen);
        b.viereck(p[j].h, q[j].h, q[j + 1].h, p[j + 1].h, innen);
      }
      const o = HOEHEN.length - 1;
      b.viereck(p[o].v, q[o].v, q[o].h, p[o].h, innen);
    }
    for (const ende of [spalten[0], spalten[S]]) {
      const innen = [0.5, 0.4, 0];
      for (let j = 0; j < HOEHEN.length - 1; j += 1) b.viereck(ende[j].v, ende[j].h, ende[j + 1].h, ende[j + 1].v, innen);
    }
    return new Float32Array(b.v);
  }

  // Ein runder Turm, unten breiter (Windrad).
  function turmNetz() {
    const b = netzBauer();
    const S = 8;
    const ring = (y, r) => Array.from({ length: S }, (_, j) => [Math.cos(j / S * Math.PI * 2) * r, y, Math.sin(j / S * Math.PI * 2) * r]);
    const unten = ring(-0.03, 1);
    const oben = ring(1, 0.6);
    for (let j = 0; j < S; j += 1) b.viereck(unten[j], unten[(j + 1) % S], oben[(j + 1) % S], oben[j], [0, 0.5, 0]);
    return new Float32Array(b.v);
  }

  // Drei Flügel in einer Ebene, jeder 1 lang, dazu die Nabe.
  function rotorNetz() {
    const b = netzBauer();
    for (let f = 0; f < 3; f += 1) {
      const w = f * DRITTEL;
      const c = Math.cos(w);
      const s = Math.sin(w);
      const p = (r, quer, z) => [c * r - s * quer, s * r + c * quer, z];
      const stuecke = [[0.04, 0.05], [0.3, 0.075], [0.65, 0.05], [1, 0.016]];
      for (const z of [0.5, -0.5]) {
        for (let i = 0; i < stuecke.length - 1; i += 1) {
          const [r0, q0] = stuecke[i];
          const [r1, q1] = stuecke[i + 1];
          b.viereck(p(r0, -q0, z), p(r1, -q1, z), p(r1, q1 * 0.4, z), p(r0, q0 * 0.5, z), [c * 0.5, s * 0.5, 0]);
        }
      }
    }
    b.kasten(0, 0, 0, 0.07, 0.07, 1.4);
    return new Float32Array(b.v);
  }

  // Ein Mast: unten breit, oben schmal, mit drei Auslegern für die Seile.
  function mastNetz() {
    const b = netzBauer();
    const e = (y, r) => [[-r, y, -r], [r, y, -r], [r, y, r], [-r, y, r]];
    const stufen = [[-0.03, 0.085], [0.45, 0.05], [1, 0.022]];
    for (let i = 0; i < stufen.length - 1; i += 1) {
      const u = e(...stufen[i]);
      const o = e(...stufen[i + 1]);
      for (let j = 0; j < 4; j += 1) b.viereck(u[j], u[(j + 1) % 4], o[(j + 1) % 4], o[j], [0, (stufen[i][0] + stufen[i + 1][0]) / 2, 0]);
    }
    for (const h of SEILE) b.kasten(0, h, 0, 0.018, 0.007, 0.13);
    return new Float32Array(b.v);
  }

  // Eine Kugel aus 128 Flächen.
  function kugelNetz() {
    const b = netzBauer();
    const norm = (p) => { const l = Math.hypot(p[0], p[1], p[2]); return [p[0] / l, p[1] / l, p[2] / l]; };
    const halb = (p, q) => norm([(p[0] + q[0]) / 2, (p[1] + q[1]) / 2, (p[2] + q[2]) / 2]);
    let flaechen = [];
    const X = [1, 0, 0], Y = [0, 1, 0], Z = [0, 0, 1], x = [-1, 0, 0], y = [0, -1, 0], z = [0, 0, -1];
    for (const o of [Y, y]) for (const [p, q] of [[X, Z], [Z, x], [x, z], [z, X]]) flaechen.push([o, p, q]);
    for (let n = 0; n < 2; n += 1) {
      const neu = [];
      for (const [p, q, r] of flaechen) {
        const pq = halb(p, q), qr = halb(q, r), rp = halb(r, p);
        neu.push([p, pq, rp], [pq, q, qr], [rp, qr, r], [pq, qr, rp]);
      }
      flaechen = neu;
    }
    for (const [p, q, r] of flaechen) b.dreieck(p, q, r, [0, 0, 0]);
    return new Float32Array(b.v);
  }

  function kastenNetz() {
    const b = netzBauer();
    b.kasten(0, 0, 0, 1, 1, 1);
    return new Float32Array(b.v);
  }

  // Rauschen, das sich nahtlos wiederholt: für Wellen (mit ihrer Neigung in
  // Grün und Blau), Wolken und Berge. Einmal gerechnet, 256 × 256.
  function rauschBild() {
    const N = 256;
    const lage = (saat) => {
      const h = new Float32Array(N * N);
      let amp = 0.5;
      for (let o = 0, p = 4; o < 5; o += 1, p *= 2) {
        const gitter = new Float32Array(p * p);
        for (let i = 0; i < p * p; i += 1) gitter[i] = hashGanz(saat * 7919 + o * 104729 + i);
        for (let y = 0; y < N; y += 1) {
          const fy = (y / N) * p;
          const y0 = Math.floor(fy);
          const ty = fy - y0;
          const sy = ty * ty * (3 - 2 * ty);
          for (let x = 0; x < N; x += 1) {
            const fx = (x / N) * p;
            const x0 = Math.floor(fx);
            const tx = fx - x0;
            const sx = tx * tx * (3 - 2 * tx);
            const a = gitter[(y0 % p) * p + (x0 % p)];
            const bb = gitter[(y0 % p) * p + ((x0 + 1) % p)];
            const c = gitter[((y0 + 1) % p) * p + (x0 % p)];
            const dd = gitter[((y0 + 1) % p) * p + ((x0 + 1) % p)];
            h[y * N + x] += amp * (a + (bb - a) * sx + (c - a) * sy + (a - bb - c + dd) * sx * sy);
          }
        }
        amp *= 0.5;
      }
      let min = Infinity;
      let max = -Infinity;
      for (const w of h) { min = Math.min(min, w); max = Math.max(max, w); }
      for (let i = 0; i < h.length; i += 1) h[i] = (h[i] - min) / (max - min);
      return h;
    };
    const A = lage(11);
    const B = lage(47);
    const px = new Uint8Array(N * N * 4);
    for (let y = 0; y < N; y += 1) {
      for (let x = 0; x < N; x += 1) {
        const i = y * N + x;
        const gx = A[y * N + ((x + 1) % N)] - A[y * N + ((x + N - 1) % N)];
        const gy = A[((y + 1) % N) * N + x] - A[((y + N - 1) % N) * N + x];
        px[i * 4] = Math.round(A[i] * 255);
        px[i * 4 + 1] = Math.round(clamp(0.5 + gx * 9, 0, 1) * 255);
        px[i * 4 + 2] = Math.round(clamp(0.5 + gy * 9, 0, 1) * 255);
        px[i * 4 + 3] = Math.round(B[i] * 255);
      }
    }
    return { N, px };
  }

  // Ein Netz mit seinen Abzügen: die Ecken einmal, dazu ein Puffer, in den
  // jedes Bild schreibt, wo und wie es gezeichnet wird.
  function abzug(ecken, teile, breite, anzahl) {
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    const vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, ecken, gl.STATIC_DRAW);
    const schritt = teile.reduce((summe, t) => summe + t, 0);
    let weit = 0;
    teile.forEach((t, i) => {
      gl.enableVertexAttribArray(i);
      gl.vertexAttribPointer(i, t, gl.FLOAT, false, schritt * 4, weit * 4);
      weit += t;
    });
    const daten = new Float32Array(breite * anzahl);
    const ibo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, ibo);
    gl.bufferData(gl.ARRAY_BUFFER, daten.byteLength, gl.DYNAMIC_DRAW);
    for (let i = 0; i < breite / 4; i += 1) {
      const ort = teile.length + i;
      gl.enableVertexAttribArray(ort);
      gl.vertexAttribPointer(ort, 4, gl.FLOAT, false, breite * 4, i * 16);
      gl.vertexAttribDivisor(ort, 1);
    }
    gl.bindVertexArray(null);
    return { vao, ibo, daten, breite, max: anzahl, n: 0, ecken: ecken.length / schritt };
  }

  function hochladen(a) {
    if (!a.n) return;
    gl.bindBuffer(gl.ARRAY_BUFFER, a.ibo);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, a.daten, 0, a.n * a.breite);
  }

  function zeichneAbzug(a, art = gl.TRIANGLES) {
    if (!a.n) return;
    gl.bindVertexArray(a.vao);
    gl.drawArraysInstanced(art, 0, a.ecken, a.n);
  }

  const FORMEN_NADEL = 5;
  const FORMEN_BOGEN = 3;
  const FORMEN_WAND = 2;
  const WAND_WEIT = 110;           // so weit reicht eine Felswand nach links und rechts

  function grafikBauen() {
    const P = bild.prog;
    P.himmel = programm("Himmel", HIMMEL_VS, HIMMEL_FS);
    P.wasser = programm("Wasser", WASSER_VS, WASSER_FS);
    P.ding = programm("Ding", DING_VS, DING_FS);
    P.vogel = programm("Vogel", VOGEL_VS, VOGEL_FS);
    P.seil = programm("Seil", SEIL_VS, SEIL_FS);
    P.schein = programm("Schein", SCHEIN_VS, SCHEIN_FS);

    const N = bild.netz;
    for (let i = 0; i < FORMEN_NADEL; i += 1) N[`nadel${i}`] = abzug(nadelNetz(i), [3, 3], 12, 96);
    for (let i = 0; i < FORMEN_BOGEN; i += 1) N[`bogen${i}`] = abzug(bogenNetz(i), [3, 3], 12, 24);
    for (let i = 0; i < FORMEN_WAND; i += 1) N[`wand${i}`] = abzug(wandNetz(i), [3, 3], 12, 48);
    N.turm = abzug(turmNetz(), [3, 3], 12, 160);
    N.rotor = abzug(rotorNetz(), [3, 3], 12, 128);
    N.mast = abzug(mastNetz(), [3, 3], 12, 64);
    N.kugel = abzug(kugelNetz(), [3, 3], 12, 160);
    N.kasten = abzug(kastenNetz(), [3, 3], 12, 128);
    const ecken = new Float32Array([-1, -1, 1, -1, 1, 1, -1, -1, 1, 1, -1, 1]);
    N.vogel = abzug(ecken, [2], 12, KAPAZITAET + 400);
    N.geist = abzug(ecken, [2], 12, 420);
    N.seil = abzug(seilNetz(), [2], 8, 160);
    N.schein = abzug(ecken, [2], 8, 520);
    N.sonne = abzug(ecken, [2], 8, 2);

    // Das Wasser: eine Fläche um die Kamera, weit voraus.
    bild.wasser = gl.createVertexArray();
    gl.bindVertexArray(bild.wasser);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-2600, -60, 2600, -60, 2600, 1690, -2600, -60, 2600, 1690, -2600, 1690]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    bild.leer = gl.createVertexArray();
    gl.bindVertexArray(null);

    const r = rauschBild();
    bild.rausch = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, bild.rausch);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, r.N, r.N, 0, gl.RGBA, gl.UNSIGNED_BYTE, r.px);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
    bild.ok = true;
  }

  // Ein Seil als Band aus 14 Stücken.
  function seilNetz() {
    const v = [];
    const S = 14;
    for (let i = 0; i < S; i += 1) {
      const a = i / S;
      const b = (i + 1) / S;
      v.push(a, -1, b, -1, b, 1, a, -1, b, 1, a, 1);
    }
    return new Float32Array(v);
  }

  // Die Leinwand für die Welt entsteht einmal und bleibt über alle Runden –
  // mit ihr die Programme und Netze.
  function grafikStarten() {
    canvas = document.createElement("canvas");
    canvas.className = "sw-canvas";
    canvas.setAttribute("aria-hidden", "true");
    hud = document.createElement("canvas");
    hud.className = "sw-hud";
    hud.setAttribute("aria-hidden", "true");
    g = hud.getContext("2d");
    try {
      gl = canvas.getContext("webgl2", { antialias: true, alpha: false, depth: true, stencil: false, powerPreference: "high-performance" });
      if (gl) grafikBauen();
    } catch (fehler) {
      console.warn(fehler);
      bild.ok = false;
    }
    canvas.addEventListener("webglcontextlost", (event) => {
      event.preventDefault();
      bild.ok = false;
      bild.verloren = true;
    });
    canvas.addEventListener("webglcontextrestored", () => {
      bild.prog = {};
      bild.netz = {};
      try { grafikBauen(); bild.verloren = false; } catch (fehler) { console.warn(fehler); }
    });
  }

  // ---------------------------------------------------------------------------
  // Zeichnen: ein Bild
  // ---------------------------------------------------------------------------
  const FELS = [0.21, 0.165, 0.16];
  const STAHL = [0.72, 0.73, 0.77];
  const EISEN = [0.2, 0.2, 0.24];
  const BOJE = [1.0, 0.4, 0.1];
  const GEFIEDER = [0.03, 0.03, 0.055];
  const FALKE = [0.07, 0.045, 0.03];
  const VOGEL_GROSS = 0.8;         // halbe Breite der Scheibe eines Vogels, in Metern
  const SICHT_WEIT = 1500;

  function ding(a, x, y, z, dreh, sx, sy, sz, roll, farbe, hell = 1, leuchten = 0) {
    if (a.n >= a.max) return;
    const d = a.daten;
    const o = a.n * 12;
    d[o] = x - kam.x; d[o + 1] = y; d[o + 2] = z - kam.z; d[o + 3] = dreh;
    d[o + 4] = sx; d[o + 5] = sy; d[o + 6] = sz; d[o + 7] = roll;
    d[o + 8] = farbe[0] * hell; d[o + 9] = farbe[1] * hell; d[o + 10] = farbe[2] * hell; d[o + 11] = leuchten;
    a.n += 1;
  }

  function schein(x, y, z, gross, r, gr, b, rand = 2.2, a = bild.netz.schein) {
    if (a.n >= a.max) return;
    const d = a.daten;
    const o = a.n * 8;
    d[o] = x - kam.x; d[o + 1] = y; d[o + 2] = z - kam.z; d[o + 3] = gross;
    d[o + 4] = r; d[o + 5] = gr; d[o + 6] = b; d[o + 7] = rand;
    a.n += 1;
  }

  function vogel(a, x, y, z, takt, roll, gross, deck, farbe) {
    if (a.n >= a.max) return;
    const d = a.daten;
    const o = a.n * 12;
    d[o] = x - kam.x; d[o + 1] = y; d[o + 2] = z - kam.z; d[o + 3] = takt;
    d[o + 4] = roll; d[o + 5] = 0; d[o + 6] = gross; d[o + 7] = deck;
    d[o + 8] = farbe[0]; d[o + 9] = farbe[1]; d[o + 10] = farbe[2]; d[o + 11] = 0;
    a.n += 1;
  }

  // Was im Bild steht, in die Abzüge schreiben.
  function weltSammeln() {
    const N = bild.netz;
    const W = state.welt;
    for (const name of Object.keys(N)) N[name].n = 0;
    const blink = 0.5 + 0.5 * Math.sin(state.zeit * 4.2);
    const lichter = 0.35 + 0.65 * abend.nacht;
    const hinten = kam.z - 40;
    const vorn = kam.z + SICHT_WEIT;
    for (let i = Math.max(0, W.von - 12); i < W.dinge.length; i += 1) {
      const d = W.dinge[i];
      if (d.z < hinten) continue;
      if (d.z > vorn) break;
      const hell = 0.85 + 0.3 * hash01(d.z * 0.37 + d.x);
      if (d.art === "nadel") {
        ding(N[`nadel${d.form}`], d.x, 0, d.z, d.dreh, d.r, d.h, d.r, 0, FELS, hell);
      } else if (d.art === "bogen") {
        ding(N[`bogen${d.form}`], d.x, 0, d.z, 0, d.a, d.h, BOGEN_TIEF, 0, FELS, hell);
      } else if (d.art === "wand") {
        // Von jedem Spalt aus eine Platte nach links und eine nach rechts –
        // bis zum Rand oder bis zur Mitte zum nächsten Spalt.
        const platte = N[`wand${d.form}`];
        for (let j = 0; j < d.spalten.length; j += 1) {
          const sp = d.spalten[j];
          const l = sp.x - sp.g / 2;
          const r = sp.x + sp.g / 2;
          const vor = d.spalten[j - 1];
          const nach = d.spalten[j + 1];
          const bisL = vor ? (vor.x + vor.g / 2 + l) / 2 : -WAND_WEIT;
          const bisR = nach ? (r + nach.x - nach.g / 2) / 2 : WAND_WEIT;
          ding(platte, l, 0, d.z, 0, bisL - l, d.h, WAND_TIEF, 0, FELS, hell);
          ding(platte, r, 0, d.z, 0, bisR - r, d.h, WAND_TIEF, 0, FELS, hell * 0.94);
        }
      } else if (d.art === "windrad") {
        ding(N.turm, d.x, 0, d.z, 0, 1.4, NABE, 1.4, 0, STAHL);
        ding(N.kasten, d.x, NABE + 0.3, d.z - 0.4, 0, 1.05, 1.05, 2.6, 0, STAHL);
        ding(N.rotor, d.x, NABE, d.z - ROTOR_VOR, 0, ROTOR, ROTOR, 0.32, rotorWinkel(d), STAHL);
        schein(d.x, NABE + 1.8, d.z - 0.4, 1.3 + blink * 1.4, 1.0 * lichter * blink, 0.12 * lichter * blink, 0.08 * lichter * blink);
      } else if (d.art === "leitung") {
        d.masten.forEach((m, j) => {
          ding(N.mast, m.x, 0, d.z, 0, 30, m.h, 30, 0, EISEN);
          if (m.h > MAST) schein(m.x, m.h + 0.8, d.z, 2.6, 1.0 * lichter, 0.14 * lichter, 0.1 * lichter);
          const n = d.masten[j + 1];
          if (!n) return;
          for (let nr = 0; nr < 3; nr += 1) {
            const a = N.seil;
            if (a.n >= a.max) break;
            const o = a.n * 8;
            a.daten[o] = m.x - kam.x; a.daten[o + 1] = m.h * SEILE[nr]; a.daten[o + 2] = d.z - kam.z; a.daten[o + 3] = n.x - kam.x;
            a.daten[o + 4] = n.h * SEILE[nr]; a.daten[o + 5] = DURCHHANG; a.daten[o + 6] = 0.16; a.daten[o + 7] = 0;
            a.n += 1;
            // Bojen an den Seilen, die im Weg hängen.
            if (m.h > MAST && n.h > MAST) continue;
            for (const u of nr === 1 ? [0.3, 0.7] : [0.5]) {
              ding(N.kugel, lerp(m.x, n.x, u), lerp(m.h, n.h, u) * SEILE[nr] - DURCHHANG * 4 * u * (1 - u), d.z, 0, 0.55, 0.55, 0.55, 0, BOJE, 1, 0.8);
            }
          }
        });
      } else if (d.art === "insel") {
        // Der Schlafplatz: eine flache Insel, Bäume darauf, warmes Licht.
        ding(N.nadel0, d.x, -0.4, d.z, 0.4, 64, 6.5, 36, 0, [0.15, 0.13, 0.1]);
        for (let b = 0; b < 9; b += 1) {
          const bx = d.x + (hash01(b * 3.1) - 0.5) * 70;
          const bz = d.z + (hash01(b * 7.7) - 0.5) * 30;
          const bh = 5 + hash01(b * 1.3) * 5;
          ding(N.turm, bx, 4.5, bz, 0, 0.5, bh, 0.5, 0, [0.07, 0.06, 0.05]);
          ding(N.kugel, bx, 4.5 + bh + 1.4, bz, b, 3.2 + hash01(b) * 1.6, 2.6, 3.2, 0, [0.05, 0.08, 0.06]);
        }
        schein(d.x, 12, d.z, 46, 0.5, 0.36, 0.16, 1.6);
      }
    }

    // Die Tore: In der Mitte jeder Lücke hängt ein goldener Ring, so gross
    // wie das, was dort noch perfekt ist – von weitem ein Schein. Perfekt
    // durchflogen, blüht er auf; sonst verlischt er.
    for (let i = Math.max(0, W.torVon - 3); i < W.tore.length; i += 1) {
      const t = W.tore[i];
      if (t.z > kam.z + 1100) break;
      if (t.z < kam.z) continue;
      const tol = perfektBei(t.z);
      const offen = t.zustand === "offen" || t.zustand === "durch";
      const alter = offen ? 0 : state.zeit - t.seit;
      if (!offen && alter > 0.8) continue;
      const puls = 1 + 0.06 * Math.sin(state.zeit * 4 + t.nr);
      if (t.zustand === "perfekt") {
        const k = clamp(alter / 0.8, 0, 1);
        schein(t.x, FLUG_Y, t.z, (tol / 0.84) * (1 + 5 * k), 1.0 * (1 - k), 0.85 * (1 - k), 0.45 * (1 - k), -1);
        schein(t.x, FLUG_Y, t.z, 7 + 6 * k, 0.9 * (1 - k), 0.6 * (1 - k), 0.2 * (1 - k), 1.6);
        continue;
      }
      const hell = offen ? 1 : 1 - clamp(alter / 0.4, 0, 1);
      const fern = clamp((t.z - kam.z - 60) / 500, 0, 1);
      schein(t.x, FLUG_Y, t.z, (tol / 0.84) * puls, 1.0 * hell, 0.82 * hell, 0.42 * hell, -1);
      schein(t.x, FLUG_Y, t.z, 0.28, 1.0 * hell, 0.9 * hell, 0.6 * hell, 1.2);
      schein(t.x, FLUG_Y, t.z, 3.2 + 4 * fern, (0.34 + 0.3 * fern) * hell, (0.22 + 0.2 * fern) * hell, 0.06 * hell, 1.8);
    }

    // Die grossen Trupps: ein paar Vögel, die in einem hellen Doppelring
    // kreisen – von weitem zu sehen, auch vor der Sonne.
    for (let i = Math.max(0, W.truppVon - 2); i < W.trupps.length; i += 1) {
      const t = W.trupps[i];
      if (t.z > kam.z + 1100) break;
      if (t.z < kam.z || t.zustand === "geholt") continue;
      const fort = t.zustand === "verpasst" ? clamp((state.zeit - t.seit) / 0.8, 0, 1) : 0;
      const puls = 1 + 0.07 * Math.sin(state.zeit * 3.4 + t.nr);
      const hell = (1 - fort) * (1.15 + 0.25 * Math.sin(state.zeit * 3.4 + t.nr));
      schein(t.x, FLUG_Y, t.z, (TRUPP.fang / 0.84) * puls * (1 + fort), 1.0 * hell, 0.78 * hell, 0.92 * hell, -1);
      schein(t.x, FLUG_Y, t.z, (TRUPP.fang / 0.84) * 1.6 * (2 - puls) * (1 + fort), 0.9 * hell, 0.9 * hell, 1.0 * hell, -1);
      schein(t.x, FLUG_Y, t.z, 15, 0.5 * (1 - fort), 0.3 * (1 - fort), 0.42 * (1 - fort), 1.6);
      const anzahl = clamp(Math.round(t.n / 2.5), 16, 34);
      for (let j = 0; j < anzahl; j += 1) {
        const richtung = j % 2 ? 1 : -1;
        const w = state.zeit * (1.5 + 0.5 * hash01(j * 3.3 + t.nr)) * richtung + j * 2.4;
        const r = 2.6 + 4 * hash01(j * 5.1 + t.nr);
        vogel(N.vogel, t.x + Math.cos(w) * r, FLUG_Y + Math.sin(w * 0.7 + j) * 1.6 + fort * 8, t.z + Math.sin(w) * r,
          hash01(j + t.nr * 9), richtung * 0.45, VOGEL_GROSS, 1, GEFIEDER);
      }
    }

    // Die Falken: dunkel und gross, kreisend voraus, dann im Stoss. Sie
    // stehen wie die Gegner fast ohne Dunst im Bild (N.geist) – sonst
    // verschwänden sie vor dem Abendhimmel.
    for (let i = Math.max(0, W.falkeVon - 1); i < W.falken.length; i += 1) {
      const f = W.falken[i];
      if (f.z > state.z + 700) break;
      const fertig = f.zustand !== "offen" && f.zustand !== "stoss";
      if (fertig && state.zeit - f.seit > 2.2) continue;
      const o = falkeOrt(f, restBei(f));
      const stoss = f.zustand === "stoss";
      const deckF = fertig ? 1 - clamp((state.zeit - f.seit - 1.4) / 0.8, 0, 1) : 1;
      vogel(N.geist, o[0], o[1], o[2], 0.37 + f.nr * 0.11, stoss ? f.seite * 0.5 : f.seite * 0.35 * Math.sin(state.zeit * 1.25 + f.nr), VOGEL_GROSS * (stoss ? 4 : 4.6), deckF, FALKE);
    }

    // Die Mitte des Schwarms: ein warmer Schein, den man durch das Licht der
    // Lücke führt.
    if (state.schritt === "flug" && vg.n) {
      const hell = 0.55 + 0.15 * Math.sin(state.zeit * 5);
      schein(state.x, FLUG_Y, state.z, 1.5, 0.9 * hell, 0.6 * hell, 0.22 * hell, 1.4);
    }

    // Der Schwarm.
    const deck = state.schritt === "aus" ? 1 - weich(0.5, 1.5, state.zeit - state.schrittZeit) : 1;
    for (let i = 0; i < vg.n; i += 1) {
      vogel(N.vogel, vg.x[i], vg.y[i], vg.z[i], vg.ph[i], vg.roll[i], VOGEL_GROSS, deck, GEFIEDER);
    }

    // Die Gegner (geist.js): je ein kleiner Schwarm aus Licht.
    geisterOrte.length = 0;
    if (gegner && state.phase !== "bereit") {
      (window.LernappGeist?.orte?.(gegner) || []).forEach((o) => {
        geisterOrte.push(o);
        // Wem im Live-Modus zugeschaut wird, der ist der Schwarm selbst – kein
        // Geist dazu, nur sein Name (geist.js, namen).
        if (o.ziel) return;
        const farbe = farbeAus(o.farbe);
        const gx = o.b / 10;
        const gz = o.a / 10;
        if (gz < kam.z || gz > kam.z + 900) return;
        // Ein Hauch Licht in seiner Farbe, darin ein paar helle Vögel – mehr,
        // wenn sein Schwarm gross war.
        schein(gx, FLUG_Y, gz, 9, farbe[0] * 0.3 * o.blass, farbe[1] * 0.3 * o.blass, farbe[2] * 0.3 * o.blass, 1.8);
        const viele = clamp(Math.round(6 + Math.sqrt(voegelAus(o.c)) * 0.9), 6, 30);
        const eng = geballtAus(o.c) ? 0.3 : 1;
        for (let j = 0; j < viele; j += 1) {
          const w = state.zeit * 0.6 + j * 2.4;
          const r = (1 + 4.5 * hash01(j * 3.7)) * eng;
          vogel(N.geist, gx + Math.cos(w) * r, FLUG_Y + Math.sin(w * 1.3 + j) * 2.4, gz + Math.sin(w) * r * 1.6,
            hash01(j * 1.7), 0, VOGEL_GROSS, 0.85 * o.blass, farbe);
        }
      });
    }

    // Federn und Funken.
    for (const t of state.teile) {
      const k = clamp(t.leben / t.max, 0, 1);
      schein(t.x, t.y, t.z, t.r * (0.6 + 0.4 * k), t.farbe[0] * k, t.farbe[1] * k, t.farbe[2] * k, 1.4);
    }

    // Ein Schleier vor der Sonne (oder dem Mond): Er legt sich auch über die
    // Felsen, die davor stehen.
    const s = bild.sonne;
    schein(kam.x + s[0] * 900, kam.auge[1] + s[1] * 900, kam.z + s[2] * 900, 420,
      abend.licht[0] * 0.34 * abend.kraft + abend.glut[0] * 0.1, abend.licht[1] * 0.34 * abend.kraft + abend.glut[1] * 0.1,
      abend.licht[2] * 0.34 * abend.kraft + abend.glut[2] * 0.1, 2.6, N.sonne);
    for (const name of Object.keys(N)) hochladen(N[name]);
  }

  const geisterOrte = [];
  const farbenMerker = new Map();
  function farbeAus(hex) {
    if (!farbenMerker.has(hex)) {
      const n = parseInt(String(hex || "#ffffff").slice(1), 16) || 0xffffff;
      farbenMerker.set(hex, [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]);
    }
    return farbenMerker.get(hex);
  }

  function lichtSetzen(p) {
    gl.uniform3fv(p.ort("uSonne"), bild.sonne);
    gl.uniform3fv(p.ort("uSonneFlach"), bild.sonneFlach);
    gl.uniform3fv(p.ort("uLicht"), bild.licht);
    gl.uniform3fv(p.ort("uGlut"), abend.glut);
    gl.uniform3fv(p.ort("uNebel"), abend.nebel);
    gl.uniform3fv(p.ort("uHimmelLicht"), abend.himmelLicht);
    gl.uniform3fv(p.ort("uMond"), bild.mond);
    gl.uniform3fv(p.ort("uMondLicht"), bild.mondLicht);
    gl.uniform3fv(p.ort("uAuge"), kam.auge);
    gl.uniform1f(p.ort("uDichte"), abend.dichte);
    gl.uniform1f(p.ort("uZeit"), state.zeit);
  }

  function zeichneFestes(spiegel) {
    const P = bild.prog;
    const N = bild.netz;
    gl.useProgram(P.ding.p);
    gl.uniform1f(P.ding.ort("uSpiegel"), spiegel);
    for (const name of Object.keys(N)) {
      if (N[name].breite === 12 && name !== "vogel" && name !== "geist") zeichneAbzug(N[name]);
    }
    gl.useProgram(P.seil.p);
    gl.uniform1f(P.seil.ort("uSpiegel"), spiegel);
    zeichneAbzug(N.seil);
    // Die Vögel haben weiche Ränder: Sie legen sich über das Bild, ohne
    // einander zu verdecken.
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.depthMask(false);
    gl.useProgram(P.vogel.p);
    gl.uniform1f(P.vogel.ort("uSpiegel"), spiegel);
    gl.uniform1f(P.vogel.ort("uGeist"), 0);
    zeichneAbzug(N.vogel);
    gl.depthMask(true);
    gl.disable(gl.BLEND);
  }

  function zeichneWelt() {
    if (!bild.ok || !gl || gl.isContextLost()) return;
    const P = bild.prog;
    const N = bild.netz;
    abendBei(schwereBei(state.z));
    // Die Sonne steht voraus, ein wenig rechts; der Mond links darüber.
    const hoch = abend.sonne * Math.PI / 180;
    bild.sonne = [Math.sin(0.1) * Math.cos(hoch), Math.sin(hoch), Math.cos(0.1) * Math.cos(hoch)];
    bild.sonneFlach = [Math.sin(0.1), 0, Math.cos(0.1)];
    bild.licht = abend.licht.map((w) => w * abend.kraft);
    bild.mond = [Math.sin(-0.42) * Math.cos(0.36), Math.sin(0.36), Math.cos(-0.42) * Math.cos(0.36)];
    bild.mondLicht = [0.62 * abend.mond, 0.7 * abend.mond, 0.9 * abend.mond];
    kameraStellen();
    weltSammeln();

    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.disable(gl.CULL_FACE);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, bild.rausch);
    for (const name of ["ding", "vogel", "seil", "wasser", "himmel"]) {
      gl.useProgram(P[name].p);
      lichtSetzen(P[name]);
      if (name !== "himmel") gl.uniformMatrix4fv(P[name].ort("uPV"), false, kam.pv);
      if (name === "ding" || name === "vogel") gl.uniform1f(P[name].ort("uUhr"), state.zeit);
    }
    const punkt = 2 * kam.tan[1] / Math.max(1, view.cssH);
    gl.useProgram(P.seil.p);
    gl.uniform3fv(P.seil.ort("uAugeV"), kam.auge);
    gl.uniform1f(P.seil.ort("uPunkt"), punkt);
    gl.useProgram(P.vogel.p);
    gl.uniformMatrix4fv(P.vogel.ort("uProj"), false, kam.proj);
    gl.uniformMatrix4fv(P.vogel.ort("uSicht"), false, kam.sicht);
    gl.uniform1f(P.vogel.ort("uPunkt"), punkt);

    // 1. Der Himmel – und unter dem Horizont sein Spiegelbild.
    gl.disable(gl.DEPTH_TEST);
    gl.depthMask(false);
    gl.disable(gl.BLEND);
    gl.useProgram(P.himmel.p);
    gl.uniform3fv(P.himmel.ort("uRechts"), kam.rechts);
    gl.uniform3fv(P.himmel.ort("uHoch"), kam.hoch);
    gl.uniform3fv(P.himmel.ort("uVor"), kam.vor);
    gl.uniform2fv(P.himmel.ort("uTan"), kam.tan);
    gl.uniform3fv(P.himmel.ort("uZenit"), abend.zenit);
    gl.uniform3fv(P.himmel.ort("uHorizont"), abend.horizont);
    gl.uniform3fv(P.himmel.ort("uWolkeHell"), abend.wolkeHell);
    gl.uniform3fv(P.himmel.ort("uWolkeDunkel"), abend.wolkeDunkel);
    gl.uniform1f(P.himmel.ort("uNacht"), abend.nacht);
    gl.uniform1i(P.himmel.ort("uRausch"), 0);
    gl.bindVertexArray(bild.leer);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    // 2. Alles Feste und die Vögel auf dem Kopf: ihr Spiegelbild.
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.depthMask(true);
    gl.clear(gl.DEPTH_BUFFER_BIT);
    zeichneFestes(-1);

    // 3. Das Wasser darüber: Es lässt vom Spiegelbild stehen, was es spiegelt.
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.SRC_ALPHA);
    gl.useProgram(P.wasser.p);
    gl.uniform1i(P.wasser.ort("uRausch"), 0);
    gl.uniform3fv(P.wasser.ort("uWasser"), abend.wasser);
    const fluss = state.zeit * 0.012;
    gl.uniform2f(P.wasser.ort("uVersatz1"), (kam.x * 0.019 + fluss) % 1, (kam.z * 0.019 - fluss * 0.6) % 1);
    gl.uniform2f(P.wasser.ort("uVersatz2"), (kam.x * 0.071 - fluss * 1.3) % 1, (kam.z * 0.071 - fluss * 2.1) % 1);
    gl.bindVertexArray(bild.wasser);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    gl.disable(gl.BLEND);

    // 4. Die Welt selbst.
    zeichneFestes(1);

    // 5. Was leuchtet, legt sein Licht dazu.
    gl.enable(gl.BLEND);
    gl.depthMask(false);
    gl.blendFunc(gl.ONE, gl.ONE);
    gl.useProgram(P.schein.p);
    gl.uniformMatrix4fv(P.schein.ort("uProj"), false, kam.proj);
    gl.uniformMatrix4fv(P.schein.ort("uSicht"), false, kam.sicht);
    zeichneAbzug(N.schein);

    // 6. Die Gegner, durchscheinend.
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.useProgram(P.vogel.p);
    gl.uniform1f(P.vogel.ort("uSpiegel"), 1);
    gl.uniform1f(P.vogel.ort("uGeist"), 0.85);
    zeichneAbzug(N.geist);

    // 7. Der Schleier vor der Sonne, über allem.
    gl.disable(gl.DEPTH_TEST);
    gl.blendFunc(gl.ONE, gl.ONE);
    gl.useProgram(P.schein.p);
    zeichneAbzug(N.sonne);
    gl.disable(gl.BLEND);
    gl.depthMask(true);
    gl.bindVertexArray(null);
  }

  // ---------------------------------------------------------------------------
  // Die Fläche
  // ---------------------------------------------------------------------------
  function buildPlatz() {
    feld = shell.el("div", "sw-feld");
    feld.append(canvas, hud);
    if (!bild.ok) {
      feld.append(shell.el("p", "sw-ohne", "Dieses Spiel braucht WebGL 2 – dieser Browser kann das leider nicht."));
    }
    return feld;
  }

  function messen() {
    if (!canvas || !feld) return;
    const cssW = Math.max(80, feld.clientWidth);
    const cssH = Math.max(80, feld.clientHeight);
    const dpr = clamp(window.devicePixelRatio || 1, 1, 2);
    // Auf dem Handy reicht die Leinwand unter die Knöpfe oben (game-shell.js,
    // frei): Die Anzeige rückt darunter.
    const oben = Math.min(cssH * 0.4, shell?.frei?.(canvas) || 0);
    if (cssW === view.cssW && cssH === view.cssH && dpr === view.dpr && oben === view.frei) return;
    view.cssW = cssW;
    view.cssH = cssH;
    view.dpr = dpr;
    view.frei = oben;
    view.pw = Math.max(2, Math.round(cssW * dpr * view.guete));
    view.ph = Math.max(2, Math.round(cssH * dpr * view.guete));
    if (canvas.width !== view.pw) canvas.width = view.pw;
    if (canvas.height !== view.ph) canvas.height = view.ph;
    const hw = Math.round(cssW * dpr);
    const hh = Math.round(cssH * dpr);
    if (hud.width !== hw) hud.width = hw;
    if (hud.height !== hh) hud.height = hh;
  }

  // Flüssig geht vor scharf: Kommen die Bilder zu langsam, wird die Welt mit
  // weniger Bildpunkten gezeichnet (die Zahlen darüber bleiben scharf) – und
  // wieder mit mehr, wenn lange Luft war.
  function gueteTakt(sekunden) {
    if (view.fest || !bild.ok) return;
    if (sekunden > 0.027) view.langsam += sekunden;
    else view.langsam = Math.max(0, view.langsam - sekunden * 0.5);
    if (sekunden < 0.0185) view.schnell += sekunden;
    else view.schnell = 0;
    let neu = view.guete;
    if (view.langsam > 1.2) neu = Math.max(0.5, view.guete - 0.15);
    else if (view.schnell > 8) neu = Math.min(1, view.guete + 0.1);
    if (neu === view.guete) return;
    view.guete = neu;
    view.langsam = 0;
    view.schnell = 0;
    view.cssW = 0;
  }

  // ---------------------------------------------------------------------------
  // Zeichnen: Zahlen und Namen
  // ---------------------------------------------------------------------------
  function runde(x, y, w, h, r) {
    g.beginPath();
    if (g.roundRect) g.roundRect(x, y, w, h, r);
    else g.rect(x, y, w, h);
  }

  // Oben links: wie viele Vögel fliegen, und wie weit es schon ging.
  function zeichneAnzeige() {
    const gross = clamp(view.cssH * 0.05, 15, 24);
    const x = 12;
    const y = 12 + view.frei;
    g.font = `900 ${Math.round(gross)}px system-ui, sans-serif`;
    const zahl = String(vg.n);
    const zw = g.measureText(zahl).width;
    g.font = `800 ${Math.round(gross * 0.62)}px system-ui, sans-serif`;
    const meter = `${state.meter} m`;
    const mw = g.measureText(meter).width;
    const breit = gross * 1.9 + zw + gross * 0.7 + mw + gross * 0.6;
    g.fillStyle = "rgba(13, 12, 17, 0.5)";
    runde(x, y, breit, gross * 1.7, gross * 0.85);
    g.fill();
    // Ein kleiner Vogel als Zeichen – geballt ein Punkt: Dann zählt er nicht.
    g.save();
    g.translate(x + gross * 0.95, y + gross * 0.9);
    g.strokeStyle = "#ffd76a";
    g.fillStyle = "#ffd76a";
    g.lineWidth = Math.max(2, gross * 0.13);
    g.lineCap = "round";
    g.lineJoin = "round";
    const ball = clamp(state.ball, 0, 1);
    if (ball > 0.5) {
      g.globalAlpha = 0.85;
      g.beginPath();
      g.arc(0, 0, gross * 0.24, 0, Math.PI * 2);
      g.fill();
      g.globalAlpha = 1;
    } else {
      g.beginPath();
      g.moveTo(-gross * 0.45, -gross * 0.12);
      g.quadraticCurveTo(-gross * 0.2, -gross * 0.36, 0, gross * 0.12);
      g.quadraticCurveTo(gross * 0.2, -gross * 0.36, gross * 0.45, -gross * 0.12);
      g.stroke();
    }
    g.restore();
    g.textAlign = "left";
    g.textBaseline = "middle";
    g.font = `900 ${Math.round(gross)}px system-ui, sans-serif`;
    // Wird es knapp, steht die Zahl in Rot.
    g.fillStyle = vg.n < MINDEST * 3 && state.phase !== "bereit" ? "#ff8a70" : "#ffffff";
    g.fillText(zahl, x + gross * 1.75, y + gross * 0.9);
    g.font = `800 ${Math.round(gross * 0.62)}px system-ui, sans-serif`;
    g.fillStyle = "rgba(255, 255, 255, 0.72)";
    g.fillText(meter, x + gross * 1.75 + zw + gross * 0.7, y + gross * 0.94);
    // Darunter die Kette: so viele perfekte in Folge.
    if (state.kette > 0 && state.phase !== "bereit") {
      const text = `Perfekt ×${state.kette}`;
      g.font = `900 ${Math.round(gross * 0.66)}px system-ui, sans-serif`;
      const kw = g.measureText(text).width + gross * 1.1;
      const ky = y + gross * 1.95;
      g.fillStyle = "rgba(13, 12, 17, 0.5)";
      runde(x, ky, kw, gross * 1.25, gross * 0.62);
      g.fill();
      g.fillStyle = "#ffe08a";
      g.fillText(text, x + gross * 0.55, ky + gross * 0.66);
    }
  }

  // Ein Falke ist nah: ein Ring um ihn, damit man ihn auch vor dem dunklen
  // Himmel sieht – im Stoss heller und enger.
  function zeichneFalken() {
    const W = state.welt;
    if (!W) return;
    for (let i = W.falkeVon; i < W.falken.length; i += 1) {
      const f = W.falken[i];
      if (f.z > state.z + 600) break;
      if (f.zustand !== "offen" && f.zustand !== "stoss") continue;
      const rest = restBei(f);
      if (rest > 2.6) continue;
      const o = falkeOrt(f, rest);
      const p = imBild(o[0], o[1], o[2]);
      if (!p) continue;
      const stoss = f.zustand === "stoss";
      const puls = 0.5 + 0.5 * Math.sin(state.zeit * (stoss ? 22 : 7));
      const r = clamp(view.cssH * 0.045, 14, 30) * (stoss ? 1.15 : 1);
      g.strokeStyle = stoss ? `rgba(255, 110, 70, ${0.7 + 0.3 * puls})` : `rgba(255, 190, 140, ${0.45 + 0.3 * puls})`;
      g.lineWidth = stoss ? 3.5 : 2.5;
      g.beginPath();
      g.arc(p.x, p.y, r, 0, Math.PI * 2);
      g.stroke();
    }
  }

  // Vor dem ersten Druck: links und rechts ein Pfeil – dort wird gehalten.
  function zeichneHinweis() {
    if (state.phase !== "bereit" || shell.live) return;
    const puls = ruhig() ? 0.75 : 0.6 + 0.3 * Math.sin(state.zeit * 3.2);
    const gross = clamp(Math.min(view.cssW, view.cssH) * 0.085, 24, 52);
    const y = view.cssH * 0.72;
    for (const s of [-1, 1]) {
      const x = view.cssW / 2 + s * Math.min(view.cssW * 0.36, 300);
      g.fillStyle = `rgba(13, 12, 17, ${0.42 * puls + 0.1})`;
      g.beginPath();
      g.arc(x, y, gross, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = `rgba(255, 255, 255, ${puls})`;
      g.lineWidth = Math.max(3, gross * 0.14);
      g.lineCap = "round";
      g.lineJoin = "round";
      g.beginPath();
      g.moveTo(x - s * gross * 0.18, y - gross * 0.38);
      g.lineTo(x + s * gross * 0.24, y);
      g.lineTo(x - s * gross * 0.18, y + gross * 0.38);
      g.stroke();
    }
  }

  // Der Name des Lichts, wenn es wechselt – und der Schlafplatz am Schluss.
  function zeichneKarte() {
    const k = state.karte;
    if (!k) return;
    const alter = state.zeit - k.seit;
    const deck = Math.min(1, alter / 0.4) * clamp((k.dauer - alter) / 0.6, 0, 1);
    if (deck <= 0) return;
    const gross = clamp(view.cssW * 0.055, 22, 42);
    // Breit steht sie neben der Anzeige oben links, schmal darunter.
    const anzeigeUnten = 12 + view.frei + clamp(view.cssH * 0.05, 15, 24) * 3.3;
    const y = view.cssW > 640
      ? Math.max(view.cssH * 0.18, view.frei + gross * 1.35)
      : Math.max(view.cssH * 0.2, anzeigeUnten + gross * 0.75);
    g.globalAlpha = deck;
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.font = `900 ${Math.round(gross)}px system-ui, sans-serif`;
    g.lineWidth = Math.max(3, gross * 0.12);
    g.lineJoin = "round";
    g.strokeStyle = "rgba(13, 12, 17, 0.55)";
    g.strokeText(k.gross, view.cssW / 2, y);
    g.fillStyle = k.farbe;
    g.fillText(k.gross, view.cssW / 2, y);
    if (k.klein) {
      g.font = `800 ${Math.round(gross * 0.44)}px system-ui, sans-serif`;
      g.lineWidth = Math.max(2, gross * 0.08);
      g.strokeText(k.klein, view.cssW / 2, y + gross * 0.95);
      g.fillStyle = "#ffffff";
      g.fillText(k.klein, view.cssW / 2, y + gross * 0.95);
    }
    g.globalAlpha = 1;
  }

  function zeichneSchriften() {
    if (!state.schriften.length) return;
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.lineJoin = "round";
    for (const s of state.schriften) {
      const p = imBild(s.x, s.y, s.z);
      if (!p) continue;
      const k = clamp(s.leben / s.max, 0, 1);
      g.globalAlpha = Math.min(1, k * 2.2);
      g.font = `900 ${Math.round(s.gross * clamp(view.cssH / 520, 0.8, 1.4))}px system-ui, sans-serif`;
      g.lineWidth = 4;
      g.strokeStyle = "rgba(13, 12, 17, 0.6)";
      g.strokeText(s.text, p.x, p.y - (1 - k) * 34);
      g.fillStyle = s.farbe;
      g.fillText(s.text, p.x, p.y - (1 - k) * 34);
    }
    g.globalAlpha = 1;
  }

  // Die Namen der Gegner an ihren Schwärmen (geist.js) – wer hinter der
  // Kamera fliegt, steht am unteren Rand.
  function zeichneNamen() {
    if (!geisterOrte.length || !window.LernappGeist?.namen) return;
    const liste = geisterOrte.map((o) => {
      const p = o.ziel ? imBild(state.x, FLUG_Y + masse().y + 3, state.z) : imBild(o.b / 10, FLUG_Y + 5, o.a / 10);
      return { ...o, sx: p ? p.x : view.cssW / 2, sy: p ? p.y : view.cssH + 40, weit: `${voegelAus(o.c)} Vögel` };
    });
    window.LernappGeist.namen(g, liste, { breit: view.cssW, hoch: view.cssH });
  }

  function zeichneHud() {
    if (!g) return;
    g.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
    g.clearRect(0, 0, view.cssW, view.cssH);
    // Vögel verloren: Der Rand des Bilds glüht kurz rot – auf der Seite, die
    // am Fels hing, oder rundum.
    if (state.blitz > 0.01 && !ruhig()) {
      if (state.blitzSeite) {
        const links = state.blitzSeite < 0;
        const breit = view.cssW * 0.3;
        const x0 = links ? 0 : view.cssW;
        const rand = g.createLinearGradient(x0, 0, links ? breit : view.cssW - breit, 0);
        rand.addColorStop(0, `rgba(255, 70, 40, ${0.5 * state.blitz})`);
        rand.addColorStop(1, "rgba(255, 70, 40, 0)");
        g.fillStyle = rand;
        g.fillRect(links ? 0 : view.cssW - breit, 0, breit, view.cssH);
      } else {
        const r = Math.hypot(view.cssW, view.cssH) / 2;
        const rand = g.createRadialGradient(view.cssW / 2, view.cssH / 2, r * 0.55, view.cssW / 2, view.cssH / 2, r);
        rand.addColorStop(0, "rgba(255, 70, 40, 0)");
        rand.addColorStop(1, `rgba(255, 70, 40, ${0.38 * state.blitz})`);
        g.fillStyle = rand;
        g.fillRect(0, 0, view.cssW, view.cssH);
      }
    }
    zeichneFalken();
    zeichneNamen();
    zeichneSchriften();
    zeichneKarte();
    zeichneHinweis();
    zeichneAnzeige();
  }

  function zeichnen() {
    zeichneWelt();
    zeichneHud();
  }

  // ---------------------------------------------------------------------------
  // Klänge (klang.js)
  // ---------------------------------------------------------------------------
  const zuletztTon = new Map();
  function ton(id, o = {}, pause = 80) {
    const ms = performance.now();
    if (ms - (zuletztTon.get(id) ?? -1e9) < pause) return;
    zuletztTon.set(id, ms);
    klang()?.ton?.(id, o);
  }

  // Der Fahrtwind: eine Schleife, die mit dem Tempo heller und lauter wird.
  // Nachgestellt wird sie ein paarmal je Sekunde, nicht in jedem Bild.
  let wind = null;
  let windMs = -1e9;
  function windAn() {
    wind = klang()?.kulisse?.("schwarm.wind") || null;
    windMs = -1e9;
    windStellen();
  }

  function windStellen() {
    if (!wind) return;
    const ms = performance.now();
    if (ms - windMs < 80) return;
    windMs = ms;
    const k = clamp((tempoBei(state.z) - 10) / (V_MAX - 10), 0, 1) * (state.schritt === "flug" ? 1 : 0.4);
    wind.setze(0.2 + 0.6 * k);
    wind.laut(0.5 + 0.5 * k);
  }

  function windAus() {
    wind?.stop();
    wind = null;
  }

  // ---------------------------------------------------------------------------
  // Der Lauf
  // ---------------------------------------------------------------------------
  // Was die Aufzeichnung als c trägt: die Zahl der Vögel – GEBALLT_C dazu,
  // solange der Schwarm geballt ist, und 0, wenn er am Fels zerschellt ist.
  const GEBALLT_C = 2000;
  const ortC = () => (state.grund === "fels" ? 0 : vg.n + (state.ballen ? GEBALLT_C : 0));
  const voegelAus = (c) => Math.max(0, Math.round(Number(c) || 0)) % GEBALLT_C;
  const geballtAus = (c) => (Number(c) || 0) >= GEBALLT_C;

  function karte(gross, klein, farbe = "#ffe9b8", dauer = 2.8) {
    state.karte = { gross, klein, farbe, dauer, seit: state.zeit };
  }

  const lichtNr = (z) => {
    const k = schwereBei(z);
    let nr = 0;
    while (nr < ABEND.length - 1 && k >= ABEND[nr + 1].k) nr += 1;
    return nr;
  };

  // Aufgefächert zählt der Schwarm, geballt nicht.
  function physik(dt) {
    const v = tempoBei(state.z);
    const ziel = state.lenk * querBei(state.z);
    state.vx += (ziel - state.vx) * (1 - Math.exp(-dt / (state.lenk ? LENK_ZEIT : LOS_ZEIT)));
    state.x += state.vx * dt;
    if (state.x > X_MAX) { state.x = X_MAX; state.vx = Math.min(0, state.vx); }
    if (state.x < -X_MAX) { state.x = -X_MAX; state.vx = Math.max(0, state.vx); }
    state.z += v * dt;
    state.roh += vg.n * v * dt * PUNKTE_JE_100M / 10000 * (1 - state.ball);
  }

  // Ballen: Liegen beide Seiten lange genug auf (BALL_VERZUG), ballt sich
  // der Schwarm – dann lenkt er nicht.
  function ballenTakt() {
    const wunsch = state.phase === "spiel" && state.schritt === "flug" && beideAuf();
    if (wunsch && !state.wunsch) state.wunschSeit = state.zeit;
    state.wunsch = wunsch;
    const ballen = wunsch && state.zeit - state.wunschSeit >= BALL_VERZUG - 1e-9;
    if (ballen && !state.ballen) {
      state.ballenSeit = state.zeit;
      ton("schwarm.ballen", { laut: 0.55 }, 90);
    }
    state.ballen = ballen;
    lenkNeu();
  }

  // Die Mitte des Schwarms am Fels: Die Runde ist vorbei.
  function mitteTakt(zVor) {
    for (let k = 0; k < nah.length; k += 1) {
      if (trifft(nah[k], state.x, FLUG_Y, zVor, state.z)) {
        aus("fels");
        return;
      }
    }
  }

  // Die Runde ist vorbei: Zu wenige sind übrig (der Schwarm zerstreut sich),
  // oder die Mitte ist am Fels zerschellt.
  function aus(grund = "zerstreut") {
    state.schritt = "aus";
    state.schrittZeit = state.zeit;
    state.grund = grund;
    state.lenk = 0;
    state.ballen = false;
    windAus();
    if (state.phase !== "spiel") return;
    if (grund === "fels") {
      state.stoss = 1;
      state.blitz = 1;
      state.blitzSeite = 0;
      for (let k = 0; k < 10; k += 1) federn(state.x, FLUG_Y, state.z, 0);
      karte("Am Fels zerschellt", "Die Mitte des Schwarms darf nie an den Fels", "#ff9a7a", 2.2);
      ton("schwarm.fels", { laut: 1.1 }, 0);
      kids()?.vibrate?.([30, 40, 60]);
    } else {
      karte("Zerstreut", `Unter ${MINDEST} Vögeln hält kein Schwarm zusammen`, "#ff9a7a", 2.2);
    }
    klang()?.ton?.("fehler");
  }

  // Am Schlafplatz: Jeder Vogel, der ankommt, zählt noch einmal.
  function landung() {
    state.schritt = "landung";
    state.schrittZeit = state.zeit;
    state.angekommen = true;
    state.lenk = 0;
    state.ballen = false;
    if (state.phase !== "spiel") return;
    state.bonus = Math.round(vg.n * BONUS);
    state.roh += state.bonus;
    state.punkte = Math.floor(state.roh);
    shell.setCount(state.punkte);
    karte("Am Schlafplatz", `${vg.n} Vögel · +${state.bonus}`, "#ffd76a", 3.2);
    klang()?.ton?.("meilenstein");
    kids()?.vibrate?.([20, 40, 20]);
  }

  function takt(dt) {
    state.zeit += dt;
    if (state.stoss > 0) state.stoss = Math.max(0, state.stoss - dt * 2.4);
    if (state.blitz > 0) state.blitz = Math.max(0, state.blitz - dt * 1.8);
    const xVor = state.x;
    const zVor = state.z;

    if (state.phase === "zuschauen") {
      zuschauenTakt();
    } else if (state.phase === "spiel" && state.schritt === "flug") {
      ballenTakt();
      const n = Math.max(1, Math.ceil(dt / TAKT - 1e-9));
      for (let i = 0; i < n; i += 1) physik(dt / n);
      state.flugzeit += dt;
    }
    const seit = state.zeit - state.schrittZeit;
    if (state.schritt === "landung") {
      // Ausgleiten: langsamer, zur Mitte, auf die Insel zu.
      const k = weich(0, 2.2, seit);
      state.z += tempoBei(state.z) * lerp(0.8, 0.1, k) * dt;
      state.vx *= Math.exp(-dt / 0.3);
      state.x += (0 - state.x) * (1 - Math.exp(-dt / 0.9));
    } else if (state.schritt === "aus") {
      state.z += tempoBei(state.z) * 0.6 * Math.max(0, 1 - seit / 1.6) * dt;
    }
    if (state.z !== zVor) spurSchreiben(xVor, zVor);
    weltBis(state.z + SICHT_WEIT + 100);
    schwarmTakt(dt);
    if (state.schritt === "flug") {
      if (state.phase === "spiel") mitteTakt(zVor);
      if (state.schritt === "flug") {
        toreTakt(zVor);
        truppsTakt(zVor);
        falkenTakt(zVor);
      }
    }
    // Vor der ersten Wand sagt das Spiel einmal, was zu tun ist.
    const W = state.welt;
    if (state.phase === "spiel" && W.erstesBallen && !state.gesagt && state.z > W.erstesBallen - tempoBei(state.z) * 3.6) {
      state.gesagt = true;
      karte("Beide halten", "Kurz vor dem Spalt – dann ballt sich der Schwarm und passt hindurch", "#ffe9b8", 2.5);
    }

    for (let i = state.teile.length - 1; i >= 0; i -= 1) {
      const t = state.teile[i];
      t.vy -= t.fall * dt;
      t.x += t.vx * dt;
      t.y = Math.max(0.2, t.y + t.vy * dt);
      t.z += t.vz * dt;
      t.leben -= dt;
      if (t.leben <= 0) state.teile.splice(i, 1);
    }
    for (let i = state.schriften.length - 1; i >= 0; i -= 1) {
      state.schriften[i].leben -= dt;
      if (state.schriften[i].leben <= 0) state.schriften.splice(i, 1);
    }
    const merker = state.verlustMerker;
    if (merker.zahl && state.zeit - merker.seit > 0.25) {
      // Die Zahl steht auf der Seite, die am Fels hing.
      const seite = merker.wer ? 0 : merker.links * 2 > merker.zahl ? -1 : merker.links * 2 < merker.zahl ? 1 : 0;
      const breit = masse().x;
      schrift(merker.wer ? `−${merker.zahl} ${merker.wer}` : `−${merker.zahl}`, state.x + seite * breit * 0.8, FLUG_Y + 4, state.z + 4, "#ff9a7a", 24);
      merker.zahl = 0;
      merker.links = 0;
      merker.wer = "";
    }
    kameraTakt(dt);
    windStellen();

    if (state.phase === "spiel") {
      if (state.schritt === "flug") {
        state.groesster = Math.max(state.groesster, vg.n);
        state.meter = Math.floor(state.z);
        const punkte = Math.floor(state.roh);
        if (punkte !== state.punkte) {
          state.punkte = punkte;
          shell.setCount(punkte);
        }
        const nr = lichtNr(state.z);
        if (nr !== state.licht) {
          state.licht = nr;
          karte(ABEND[nr].name, `noch ${Math.max(0, Math.round((Z_ENDE - state.z) / 100) * 100)} m bis zum Schlafplatz`);
        }
        if (vg.n < MINDEST) aus();
        else if (state.z >= Z_ENDE) landung();
      }
      gegner?.takt(state.punkte, { a: Math.round(state.z * 10), b: Math.round(state.x * 10), c: ortC() });
      // Erst ausfliegen lassen: das Zerstreuen, die Landung. (Neu gerechnet –
      // der Schritt kann eben erst begonnen haben.)
      const dauer = state.zeit - state.schrittZeit;
      if ((state.schritt === "aus" && dauer > 1.6) || (state.schritt === "landung" && dauer > 3)) finish();
    }
  }

  function loop(now) {
    frame = window.requestAnimationFrame(loop);
    const sekunden = (now - last) / 1000;
    last = now;
    gueteTakt(sekunden);
    messen();
    takt(Math.min(0.05, Math.max(0, sekunden)));
    zeichnen();
  }

  // ---------------------------------------------------------------------------
  // Zuschauen
  // ---------------------------------------------------------------------------
  // Ein aufgezeichneter Flug durch seinen eigenen Abend: Der Zufall hält die
  // Saat (geist.js, zuschauer), startRun würfelt damit dieselbe Welt, und die
  // Mitte des Schwarms steht Bild für Bild dort, wo sie damals war. Was er
  // dabei streift, verliert er wie im Spiel; wie gross er ist und was er
  // zählt, steht genau in der Aufzeichnung.
  function zuschauenStarten() {
    if (!zuschauer?.lauf) return;
    startRun();
    state.phase = "zuschauen";
    state.schritt = "flug";
    state.schrittZeit = state.zeit;
    shell.setPhase("play");
    zuschauer.los();
    windAn();
  }

  function zuschauenTakt() {
    const s = zuschauer.stand();
    if (!s) return;
    if (state.schritt === "flug") {
      state.z = Math.max(state.z, s.a / 10);
      state.x = clamp(s.b / 10, -X_MAX, X_MAX);
      state.vx = (s.vb || 0) / 10;
      state.flugzeit = (s.t || 0) / 1000;
      gleicheAn(voegelAus(s.c));
      const ballen = geballtAus(s.c);
      if (ballen && !state.ballen) state.ballenSeit = state.zeit;
      state.ballen = ballen;
      state.meter = Math.floor(state.z);
      if (state.z >= Z_ENDE - 0.5) landung();
      else if (vg.n < MINDEST && state.z > 5) aus();
    }
    const punkte = Math.max(0, Math.floor(s.punkte));
    if (punkte !== state.punkte) {
      state.punkte = punkte;
      shell.setCount(punkte);
    }
    if (!zuschauer.weiter()) windAus();
  }

  // ---------------------------------------------------------------------------
  // Lenken
  // ---------------------------------------------------------------------------
  // Die Runde beginnt mit dem ersten Druck – oder im Live-Modus zum
  // gemeinsamen Start (game-shell.js, live.los).
  function losGehts() {
    if (state.phase !== "bereit") return;
    state.phase = "spiel";
    state.schritt = "flug";
    state.schrittZeit = state.zeit;
    state.licht = 0;
    shell.setPhase("play");
    gegner?.los();
    windAn();
    karte(ABEND[0].name, "Führ die Mitte des Schwarms durch das Licht in jeder Lücke");
    kids()?.vibrate?.(8);
    lenkNeu();
  }

  // Wer hält, lenkt: links vom Bild nach links, rechts nach rechts. Liegen
  // zwei Finger auf einer Seite, zählt der, der zuletzt kam; liegen sie auf
  // beiden Seiten (oder die Taste zum Ballen, Seite 0), ballt sich der
  // Schwarm (ballenTakt) – und lenkt nicht.
  const finger = new Map();
  function lenkNeu() {
    let richtung = 0;
    for (const seite of finger.values()) if (seite) richtung = seite;
    state.lenk = state.phase === "zuschauen" || state.phase === "ende" || state.schritt !== "flug" || state.ballen ? 0 : richtung;
  }

  function beideAuf() {
    let links = false;
    let rechts = false;
    for (const seite of finger.values()) {
      if (!seite) return true;
      if (seite < 0) links = true;
      else rechts = true;
    }
    return links && rechts;
  }

  function fingerAuf(id, seite) {
    if (state.phase === "zuschauen" || state.phase === "ende") return;
    // Ohne Bild keine Runde (ein Browser ohne WebGL 2).
    if (!bild.ok && !bild.verloren) return;
    finger.delete(id);
    finger.set(id, seite);
    if (state.phase === "bereit" && !shell.live) losGehts();
    lenkNeu();
  }

  function fingerWeg(id) {
    if (!finger.delete(id)) return;
    lenkNeu();
  }

  function alleWeg() {
    finger.clear();
    lenkNeu();
  }

  function seiteVon(event) {
    const r = (feld || host).getBoundingClientRect();
    return event.clientX < r.left + r.width / 2 ? -1 : 1;
  }

  // Für die Prüfskripte und die Vorführung: -1, 0 oder 1 – und ballen
  // (true oder false), wie mit der Taste.
  function lenke(richtung) {
    if (richtung) fingerAuf("pilot", richtung < 0 ? -1 : 1);
    else fingerWeg("pilot");
  }
  function ballen(an) {
    if (an) { if (!finger.has("pilotBall")) fingerAuf("pilotBall", 0); }
    else fingerWeg("pilotBall");
  }

  // ---------------------------------------------------------------------------
  // Ablauf
  // ---------------------------------------------------------------------------
  function startRun() {
    stopLoop();
    windAus();
    shell.closeOverlay();
    zufall.neu();
    shell.setPhase("intro");
    Object.assign(state, {
      phase: "bereit", schritt: "start", punkte: 0, roh: 0, x: 0, z: 0, vx: 0, lenk: 0,
      wunsch: false, wunschSeit: 0, ballen: false, ballenSeit: -1e9, ball: 0, ballLang: 0,
      kette: 0, perfekte: 0, tore: 0, grund: "", gesagt: false,
      R: radiusBei(START_VOEGEL), form: 0, wirbel: 0, zeit: 0, flugzeit: 0, meter: 0,
      groesster: START_VOEGEL, verloren: 0, geholt: 0, bonus: 0, angekommen: false, licht: 0,
      teile: [], schriften: [], karte: null, stoss: 0, blitz: 0, blitzSeite: 0, schrittZeit: 0,
      verlustMerker: { zahl: 0, links: 0, wer: "", seit: 0 },
    });
    state.welt = neueWelt();
    vg.n = 0;
    vg.plaetze = 0;
    for (let i = 0; i < START_VOEGEL; i += 1) neuerVogel();
    spurNeu();
    finger.clear();
    shell.setCount(0);
    gegner?.runde();

    shell.clear();
    const prompt = shell.el("p", "cm-prompt sw-prompt", "Links halten – nach links. Rechts halten – nach rechts. Beide – ballen.");
    shell.play.append(prompt, buildPlatz());
    view.cssW = 0;
    messen();
    weltBis(SICHT_WEIT + 100);
    kam.x = 0;
    kam.roll = 0;
    kam.weit = 15 + masse().z * 1.15;
    kam.y = FLUG_Y + 1.6 + masse().x * 0.2;
    kam.z = -kam.weit;
    schwarmTakt(0);

    last = performance.now();
    frame = window.requestAnimationFrame(loop);
  }

  function zaehleHoch(ziel) {
    const zahl = host.querySelector(".cm-result-score");
    if (!zahl) return;
    if (ruhig() || ziel <= 1) { zahl.textContent = String(ziel); return; }
    const dauer = Math.min(900, 250 + ziel / 20);
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
    stopLoop();
    windAus();
    if (state.phase === "ende" || state.phase === "zuschauen") return;
    state.phase = "ende";
    alleWeg();
    const punkte = state.punkte;
    const geist = gegner?.ende(punkte) || null;
    const vorher = Number(store.read()?.scores?.[0]) || 0;
    const rekord = punkte > vorher;
    store.update((old) => ({
      runs: (Number(old.runs) || 0) + 1,
      scores: [...(old.scores || []), punkte].sort((x, y) => y - x).slice(0, TOP_COUNT),
    }));
    const wie = state.angekommen
      ? `Am Schlafplatz mit ${vg.n} Vögeln`
      : state.grund === "fels"
        ? `Am Fels zerschellt nach ${state.meter} m`
        : `Zerstreut nach ${state.meter} m`;
    const genau = state.tore ? `${state.perfekte} von ${state.tore} Toren perfekt` : "";
    shell.showResult({
      label: "Deine Punkte",
      points: punkte,
      detail: rekord ? "Neuer Rekord!" : [wie, genau, vorher ? `Bestwert ${vorher}` : ""].filter(Boolean).join(" · "),
      geist,
    });
    if (rekord) host.querySelector(".cm-result-detail")?.classList.add("sw-rekord");
    zaehleHoch(punkte);
  }

  // ---------------------------------------------------------------------------
  // Start
  // ---------------------------------------------------------------------------
  shell = shellApi.mount({
    host,
    title: "Schwarm",
    area: "geschwindigkeit",
    accent: "#F5A623",
    accentDark: "#b9741a",
    clock: false,
    onRestart: () => (zuschauer ? zuschauenStarten() : startRun()),
    live: { los: losGehts, stopp: () => finish(), zuschauen: (quelle) => { zuschauer = quelle; zuschauenStarten(); } },
  });
  // Fassung t2: seit dem Ballen (c trägt, ob er geballt ist). Läufe aus t1
  // werden nicht mehr abgespielt.
  zuschauer = window.LernappGeist?.zuschauer?.({
    host, spiel: "flockFlight", fassung: "t2", zufall, einheit: "Punkte", nochmal: zuschauenStarten,
  }) || null;
  if (!zuschauer) {
    gegner = window.LernappGeist?.fuer?.({ spiel: "flockFlight", host, art: "tempo", fassung: "t2", alle: true, zufall }) || null;
  }

  grafikStarten();
  startRun();
  zuschauer?.laden.then((da) => { if (da) zuschauenStarten(); });

  // Ein Finger irgendwo im Bild: Start – und solange er liegt, lenkt er. Wer
  // ihn über die Mitte zieht, lenkt um. Nur Knöpfe bleiben Knöpfe.
  host.addEventListener("pointerdown", (event) => {
    if (event.target.closest("button, a, input")) return;
    fingerAuf(event.pointerId, seiteVon(event));
  });
  window.addEventListener("pointermove", (event) => {
    if (!finger.has(event.pointerId)) return;
    const seite = seiteVon(event);
    if (finger.get(event.pointerId) === seite) return;
    finger.set(event.pointerId, seite);
    lenkNeu();
  });
  window.addEventListener("pointerup", (event) => fingerWeg(event.pointerId));
  window.addEventListener("pointercancel", (event) => fingerWeg(event.pointerId));
  // Wer das Fenster verlässt, lässt auch los.
  window.addEventListener("blur", alleWeg);

  // Pfeiltasten oder A und D lenken; ↓, S und die Leertaste ballen (Seite
  // 0), links und rechts zugleich auch. Enter startet nur.
  const TASTEN = { ArrowLeft: -1, ArrowRight: 1, KeyA: -1, KeyD: 1, ArrowDown: 0, KeyS: 0, " ": 0, Space: 0 };
  const tasteVon = (event) => (event.key in TASTEN ? event.key : event.code in TASTEN ? event.code : null);
  document.addEventListener("keydown", (event) => {
    const taste = tasteVon(event);
    const start = event.key === "Enter";
    if (!taste && !start) return;
    if (document.activeElement?.tagName === "BUTTON") return;
    event.preventDefault();
    if (event.repeat) return;
    if (taste) fingerAuf(taste, TASTEN[taste]);
    else if (state.phase === "bereit" && !shell.live) losGehts();
  });
  document.addEventListener("keyup", (event) => {
    const taste = tasteVon(event);
    if (taste) fingerWeg(taste);
  });

  // Steht das Bild (die Tafel ist da), zeichnet eine neue Grösse es einmal neu.
  const neuMessen = () => {
    messen();
    if (!frame) zeichnen();
  };
  window.addEventListener("resize", neuMessen);
  window.addEventListener("orientationchange", neuMessen);
  window.addEventListener("pagehide", () => { stopLoop(); windAus(); });

  // Für die Prüfskripte und die Vorführung. lenke(-1 | 0 | 1) hält links oder
  // rechts oder lässt los; guete(1) hält die Schärfe fest.
  window.LernappSchwarm = {
    TAKT, Z_ENDE, X_MAX, START_VOEGEL, VOEGEL_MAX, MINDEST, BONUS, PUNKTE_JE_100M, FLUG_Y, ROTOR, MAST_R, MAST, BOGEN_AUSSEN,
    BALL_VERZUG, GEBALLT, KETTE, TRUPP, FALKE_STOSS, FALKE_SPAET, FALKE_RAUB, T_PAUSE, GEBALLT_C,
    state, view, kam, vg, bild, takt, zeichnen, weltText, weltBis, wegBei, tempoBei, querBei, breiteBei, spaltBei, radiusBei, ballRadiusBei,
    perfektBei, anteilBei, reichBei, trifft, nadelRadius, bogenBreite, seilHoehe,
    losGehts, lenke, ballen, masse,
    guete(wert) {
      view.fest = wert !== null && wert !== undefined;
      if (view.fest) view.guete = clamp(Number(wert) || 1, 0.3, 1);
      view.cssW = 0;
    },
  };
})();
