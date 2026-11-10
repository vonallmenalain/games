/*
 * steinhuepfer.js – Steinhüpfer.
 * ---------------------------------------------------------------------------
 * Ein flacher Stein hüpft über einen spiegelglatten Bergsee, bei Tagesanbruch.
 * Halten holt aus – ein Zeiger pendelt zwischen «zu steil» und «zu flach» –,
 * Loslassen wirft. Danach gibt es nur noch eines zu tun: tippen, genau wenn
 * der Stein das Wasser berührt. Das Zeichen dafür ist das Spiegelbild: Stein
 * und Spiegelbild kommen einander entgegen, und wo sie sich treffen, ist der
 * Moment.
 *
 * Wie genau der Tipp sitzt, entscheidet, wie viel Schwung bleibt: «Perfekt»
 * behält fast alles und zählt eine Serie hoch, «gut» kostet etwas, «knapp»
 * kostet viel, und wer daneben tippt oder gar nicht, dessen Stein versinkt
 * (in den ersten drei Hüpfern verzeiht das Spiel das einmal). Mit dem Schwung
 * werden die Bögen kürzer und flacher, der Takt schneller, das Fenster mit
 * jedem Hüpfer enger – am Schluss prasselt es. Gezählt werden die Meter.
 * Nach 700 Metern liegt das andere Ufer; kaum jemand kommt dort an.
 *
 * Der See würfelt mit (zufall.js): ohne Turnier jedes Mal anders, im Turnier
 * für alle im selben Versuch derselbe. Böen verlängern oder stauchen einen
 * Bogen (man sieht sie als Kräuselband auf dem Wasser), über den Wellen
 * eines Ruderboots setzt der Stein früher auf, Seerosen und Treibholz kosten
 * viel Schwung – eine Perfekt-Serie trägt den Bogen darüber –, und durch
 * einen Libellenring fliegt nur ein perfekter Hüpfer: Der gibt Schub.
 *
 * Der Tipp zählt nach der Spielzeit, nicht nach dem Bild: Jede Eingabe trägt
 * ihren Zeitstempel, das Aufsetzen ist ausgerechnet (ein Bogen ist eine
 * Formel, kein Schritt-für-Schritt), und beide werden der Reihe nach
 * abgearbeitet (ablauf). So ist ein genauer Tipp auch bei dreissig Bildern
 * in der Sekunde «perfekt».
 *
 * Mit der Strecke geht die Sonne auf: Morgengrauen, Alpenglühen,
 * Sonnenaufgang, goldener Morgen. Die Gegner (geist.js) hüpfen als Steine
 * aus Licht mit, und die besten Würfe lassen sich anschauen (?zuschauen=).
 *
 * Gezeichnet wird mit WebGL 2, ohne Bibliothek, nach dem Muster von
 * schwarm.js: Himmel und Berge entstehen aus der Blickrichtung, unter dem
 * Horizont steht derselbe Himmel auf dem Kopf – verbogen von den Ringen, die
 * der Stein hinterlässt –, alles Feste wird gespiegelt darunter gezeichnet,
 * und das Wasser lässt davon stehen, was es spiegelt. Gerechnet wird in
 * Metern; x zeigt nach rechts, y nach oben, z über den See.
 */
(() => {
  "use strict";

  if (document.body.dataset.page !== "skip") return;

  const host = document.querySelector("#sh-stage");
  const shellApi = window.LernappGameShell;
  const cloudApi = window.LernappGameCloud;
  if (!host || !shellApi) return;

  const kids = () => window.LernappKids || null;
  const klang = () => window.ArcadeKlang || null;
  const ruhig = () => Boolean(kids()?.prefersReducedMotion?.());

  // Der Zufall. Nur der See zieht daraus – Böen, Wellen, Seerosen, Ringe.
  // Tropfen, Funken und Enten nehmen Math.random: Sie hängen davon ab, wie
  // jemand spielt, und sollen den See nicht verändern.
  const zufall = window.LernappZufall?.fuer?.("stoneSkip") || {
    neu() {},
    zahl: () => Math.random(),
  };

  // ---------------------------------------------------------------------------
  // Die Schrauben
  // ---------------------------------------------------------------------------
  const Z_UFER = 700;              // so weit ist es bis zum anderen Ufer
  const HAND = { x: 0.44, y: 1.2, z: -3.2 }; // dort liegt der Stein vor dem Wurf in der Hand

  // Der Wurf: Der Zeiger pendelt in AUSHOL_DAUER einmal hin und her, von «zu
  // steil» (-1) über die Mitte (0) nach «zu flach» (1). Wer zu lange hält,
  // dem fliegt der Stein von selbst aus der Hand.
  const AUSHOL_DAUER = 1.5;
  const AUSHOL_MAX = 4.5;
  const WURF_MITTE = 0.12;         // so nah an der Mitte ist ein Wurf perfekt
  const S_WURF = 22;               // Schwung eines perfekten Wurfs, in m/s
  const S_WURF_MIN = 15.5;         // und eines ganz verunglückten
  const START_FRIST = 6;           // im Live-Modus: so lange wartet der Stein auf die Hand

  // Die Bögen: Dauer und Höhe folgen aus dem Schwung. Mit dem Schwung S_NORM
  // dauert ein Bogen T_NORM und steigt H_NORM hoch; wer Schwung verliert,
  // hüpft kürzer, flacher und schneller.
  const S_NORM = 22;
  const T_NORM = 1.0;
  const T_HOCH = 1.4;              // Dauer ~ Schwung hoch T_HOCH
  const H_NORM = 2.1;
  const H_HOCH = 1.5;              // Höhe ~ Dauer hoch H_HOCH
  const H_MAX = 2.8;               // höher steigt kein Bogen (sein Spiegelbild bliebe nicht im Bild)
  const S_MAX = 23.5;              // mehr Schwung trägt kein Stein
  const S_AUS = 6.2;               // darunter hüpft er nicht mehr

  // Die Fenster, halbe Breite in Sekunden: beim ersten Hüpfer FENSTER_WEIT
  // für «perfekt», nach vielen FENSTER_ENG. «Gut» und «knapp» sind Vielfache.
  const FENSTER_WEIT = 0.048;
  const FENSTER_ENG = 0.017;
  const FENSTER_N = 17;            // nach so vielen Hüpfern ist es zu 63 % eng
  // Wer den Schwung hält, braucht wenige Hüpfer – für ihn wird es mit der
  // Strecke eng: ab FENSTER_AB Metern sinkt das engste Fenster bis zum
  // anderen Ufer auf FENSTER_UFER.
  const FENSTER_AB = 260;
  const FENSTER_UFER = 0.01;
  const GUT_MAL = 2.2;
  const KNAPP_MAL = 3.6;

  // Was vom Schwung bleibt.
  const BEHALT_PERFEKT = 0.976;
  const BEHALT_GUT = [0.965, 0.91];    // am Rand von «perfekt» … am Rand von «knapp»
  const BEHALT_KNAPP = [0.84, 0.64];
  const BEHALT_GLUECK = 0.7;           // der eine verziehene Fehler
  const GNADE_BIS = 3;                 // in so vielen Hüpfern wird einmal verziehen
  const SERIE_SCHUB = 0.005;           // je Perfekt in Folge so viel Schwung zurück …
  const SERIE_MAX = 5;                 // … höchstens so oft
  const SERIE_HEBT = 2;                // ab so vielen trägt der Bogen über Seerosen
  const RING_SCHUB = 1.0;              // ein Libellenring, perfekt durchflogen, in m/s
  const BEHALT_SEEROSE = 0.72;
  const BEHALT_HOLZ = 0.55;
  const HIN_RAND = 0.35;               // so weit reicht ein Hindernis über seine Länge hinaus

  // Ein Tipp gleich nach dem Abheben gehört noch zum letzten Aufsetzen (ein
  // Doppeltipp) und zählt nicht: in diesem Teil des Bogens, mindestens so lange.
  const SPERRE = 0.3;
  const SPERRE_MIN = 0.09;
  // Was man sieht, ist ein, zwei Bilder alt, und der Finger braucht einen
  // Augenblick bis zum Glas: So viel früher gilt ein echter Tipp.
  const VERZUG = 0.035;

  const TOP_COUNT = 5;
  const store = cloudApi
    ? cloudApi.register({ key: "lernapp.steinhuepfer", empty: { runs: 0, scores: [] }, merge: cloudApi.mergeScores(TOP_COUNT) })
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

  const bogenDauer = (S) => T_NORM * Math.pow(Math.max(0, S) / S_NORM, T_HOCH);
  const bogenHoehe = (T) => H_NORM * Math.pow(T / T_NORM, H_HOCH);
  // Die Fenster beim n-ten Aufsetzen (n = 1 ist das erste), z Meter vom Ufer.
  function fenster(n, z = 0) {
    const eng = lerp(FENSTER_ENG, FENSTER_UFER, weich(FENSTER_AB, Z_UFER, z));
    const P = eng + (FENSTER_WEIT - eng) * Math.exp(-(Math.max(1, n) - 1) / FENSTER_N);
    return { P, G: P * GUT_MAL, K: P * KNAPP_MAL };
  }

  // Immer dieselbe Zahl zu derselben Eingabe.
  function hash01(n) {
    const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return x - Math.floor(x);
  }
  // Dasselbe aus ganzen Zahlen: auf jedem Gerät derselbe See.
  function hashGanz(n) {
    let t = (n + 0x6d2b79f5) | 0;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  // ---------------------------------------------------------------------------
  // Der Morgen
  // ---------------------------------------------------------------------------
  // Fünf Lichter, nach der Strecke (k = Strecke / Z_UFER). Dazwischen gleitet
  // alles: Die Sonne steigt (Höhe in Grad), die Schattengrenze an den Gipfeln
  // sinkt (schatten: darüber liegt schon Sonne), der Himmel wird hell. Wie
  // viel von der Sonne über dem Grat steht (frei, 0 bis 1), folgt aus ihrer
  // Höhe (morgenBei).
  const MORGEN = [
    {
      k: 0, name: "Morgengrauen", sonne: -4.5, schatten: 0.17, sterne: 0.55, dichte: 1 / 760,
      zenit: [0.09, 0.15, 0.36], horizont: [0.97, 0.62, 0.55], glut: [1.0, 0.48, 0.36], licht: [1.0, 0.55, 0.46],
      nebel: [0.64, 0.58, 0.74], tief: [0.015, 0.05, 0.08], wolkeHell: [1.0, 0.58, 0.56], wolkeDunkel: [0.31, 0.30, 0.52],
      himmelLicht: [0.42, 0.46, 0.62], schnee: [0.62, 0.66, 0.84], fels: [0.25, 0.27, 0.42],
    },
    {
      k: 0.14, name: "Alpenglühen", sonne: -1.8, schatten: 0.08, sterne: 0.1, dichte: 1 / 800,
      zenit: [0.12, 0.22, 0.48], horizont: [1.0, 0.66, 0.48], glut: [1.0, 0.52, 0.28], licht: [1.0, 0.56, 0.40],
      nebel: [0.76, 0.62, 0.70], tief: [0.015, 0.06, 0.09], wolkeHell: [1.0, 0.64, 0.48], wolkeDunkel: [0.38, 0.34, 0.56],
      himmelLicht: [0.50, 0.50, 0.64], schnee: [0.70, 0.71, 0.88], fels: [0.29, 0.30, 0.45],
    },
    {
      k: 0.32, name: "Sonnenaufgang", sonne: 2.9, schatten: 0.02, sterne: 0, dichte: 1 / 900,
      zenit: [0.15, 0.30, 0.60], horizont: [1.0, 0.68, 0.38], glut: [1.0, 0.56, 0.20], licht: [1.0, 0.70, 0.38],
      nebel: [0.90, 0.64, 0.50], tief: [0.02, 0.07, 0.10], wolkeHell: [1.0, 0.72, 0.42], wolkeDunkel: [0.46, 0.38, 0.56],
      himmelLicht: [0.54, 0.54, 0.66], schnee: [0.80, 0.78, 0.90], fels: [0.33, 0.32, 0.45],
    },
    {
      k: 0.6, name: "Goldener Morgen", sonne: 7, schatten: -0.05, sterne: 0, dichte: 1 / 1100,
      zenit: [0.17, 0.38, 0.72], horizont: [1.0, 0.78, 0.48], glut: [1.0, 0.66, 0.28], licht: [1.0, 0.80, 0.52],
      nebel: [0.94, 0.76, 0.58], tief: [0.02, 0.08, 0.12], wolkeHell: [1.0, 0.86, 0.62], wolkeDunkel: [0.56, 0.50, 0.64],
      himmelLicht: [0.58, 0.62, 0.74], schnee: [0.90, 0.88, 0.94], fels: [0.36, 0.35, 0.45],
    },
    {
      k: 0.92, name: "Heller Morgen", sonne: 11.5, schatten: -0.1, sterne: 0, dichte: 1 / 1400,
      zenit: [0.18, 0.44, 0.82], horizont: [0.98, 0.86, 0.66], glut: [1.0, 0.78, 0.42], licht: [1.0, 0.90, 0.70],
      nebel: [0.92, 0.86, 0.76], tief: [0.02, 0.10, 0.15], wolkeHell: [1.0, 0.96, 0.84], wolkeDunkel: [0.62, 0.62, 0.74],
      himmelLicht: [0.62, 0.70, 0.82], schnee: [0.96, 0.95, 0.98], fels: [0.38, 0.38, 0.46],
    },
  ];
  const MORGEN_FELDER = ["zenit", "horizont", "glut", "licht", "nebel", "tief", "wolkeHell", "wolkeDunkel", "himmelLicht", "schnee", "fels"];
  const MORGEN_ZAHLEN = ["sonne", "schatten", "sterne", "dichte"];
  const morgen = { name: MORGEN[0].name, nr: 0, frei: 0 };
  MORGEN_ZAHLEN.forEach((feld) => { morgen[feld] = 0; });
  MORGEN_FELDER.forEach((feld) => { morgen[feld] = [0, 0, 0]; });

  // Das Licht an einer Stelle der Strecke – in morgen, ohne neue Objekte.
  function morgenBei(k) {
    let i = 0;
    while (i < MORGEN.length - 2 && k >= MORGEN[i + 1].k) i += 1;
    const a = MORGEN[i];
    const b = MORGEN[i + 1];
    const t = weich(a.k, b.k, k);
    morgen.nr = k >= b.k ? i + 1 : i;
    morgen.name = MORGEN[morgen.nr].name;
    for (const feld of MORGEN_ZAHLEN) morgen[feld] = lerp(a[feld], b[feld], t);
    // Über dem Sattel steht die Sonne ab gut einem Grad – dann erst fällt ihr
    // Licht auf den See.
    morgen.frei = weich(1.0, 2.6, morgen.sonne);
    for (const feld of MORGEN_FELDER) {
      for (let j = 0; j < 3; j += 1) morgen[feld][j] = lerp(a[feld][j], b[feld][j], t);
    }
    return morgen;
  }

  // ---------------------------------------------------------------------------
  // Zustand
  // ---------------------------------------------------------------------------
  // phase:   "bereit" (noch nichts gedrückt), "spiel", "zuschauen", "ende"
  // schritt: "start" (der Stein liegt in der Hand), "ausholen", "flug",
  //          "nass" (aufgesetzt, der Tipp fehlt noch), "sinkt", "ufer"
  const state = {
    phase: "bereit",
    schritt: "start",
    zeit: 0,              // die Spielzeit, in Sekunden
    punkte: 0,
    meter: 0,
    x: HAND.x,            // wo der Stein ist
    y: HAND.y,
    z: HAND.z,
    S: 0,                 // sein Schwung, in m/s
    bogen: null,          // der Bogen, den er gerade fliegt
    huepfer: 0,
    serie: 0,
    besteSerie: 0,
    perfekte: 0,
    tipp: null,           // der Tipp, der für diesen Bogen zählt (Spielzeit)
    verziehen: false,
    schrittZeit: 0,       // seit wann der Schritt gilt (Spielzeit)
    ausholSeit: 0,
    startFrist: 0,
    wurf: null,           // { a, guete } des Wurfs dieser Runde
    grund: "",            // warum der Stein versank
    welt: null,
    ringe: [],            // die Ringe auf dem Wasser, die jüngsten zuletzt
    teile: [],
    schriften: [],
    lupe: 0,              // ein Hauch Zeitlupe nach «Perfekt» (1 … 0)
    blitz: 0,             // und Licht
    ruck: 0,
    dreh: 0,              // wie weit der Stein sich gedreht hat
    hilfe: false,         // der allererste Wurf: ein Ring zeigt den Moment
    licht: 0,
  };

  let shell = null;
  let feld = null;
  let canvas = null;       // WebGL: die Welt
  let hud = null;          // 2D: Zahlen und Namen darüber
  let g = null;
  let frame = null;
  let last = 0;
  // Die Gegner (geist.js): wer als Stein aus Licht mithüpft.
  let gegner = null;
  // Wer einen Wurf anschaut statt zu werfen (geist.js, zuschauer).
  let zuschauer = null;

  function stopLoop() {
    if (frame) { window.cancelAnimationFrame(frame); frame = null; }
  }

  // ---------------------------------------------------------------------------
  // Der See
  // ---------------------------------------------------------------------------
  /*
   * Auf der Linie des Wurfs liegt, eines hinter dem anderen, was den Takt
   * bricht. Die ersten vierzig Meter sind frei, dann wird es mit der Strecke
   * dichter:
   *
   *   ring      ein Libellenring bei z0; ein perfekter Hüpfer hindurch gibt Schub
   *   boe       von z0 bis z1 weht es: Ein Bogen, der hier beginnt, wird um
   *             staerke länger (Rückenwind) oder kürzer (Gegenwind)
   *   wellen    von z0 bis z1 steht das Wasser um hoch höher (die Wellen
   *             eines Ruderboots): Der Stein setzt früher auf
   *   seerosen  ein Feld von z0 bis z1: Wer darauf aufsetzt, verliert viel
   *   holz      ein Stück Treibholz, schmal und hart
   *
   * Alles ist gleich zu Beginn der Runde gewürfelt – wie weit jemand kommt,
   * ändert nichts daran, was weiter draussen liegt.
   */
  function neueWelt() {
    const dinge = [];
    let z = 42 + zufall.zahl() * 14;
    let vorher = "";
    let ohneRing = 0;
    // Die letzten Meter vor dem anderen Ufer bleiben frei.
    while (z < Z_UFER - 66) {
      const k = z / Z_UFER;
      const wahl = [["ring", 2.2], ["boe", 2.4]];
      if (z > 80) wahl.push(["seerosen", 1.9]);
      if (z > 125) wahl.push(["wellen", 1.7]);
      if (z > 200) wahl.push(["holz", 1.1]);
      const moeglich = wahl.filter(([art]) => art !== vorher);
      let los = zufall.zahl() * moeglich.reduce((summe, [, gewicht]) => summe + gewicht, 0);
      let art = moeglich[0][0];
      for (const [name, gewicht] of moeglich) {
        art = name;
        los -= gewicht;
        if (los <= 0) break;
      }
      // Spätestens nach drei anderen kommt wieder ein Libellenring: Auf jedem
      // See gibt es etwas zu holen.
      if (ohneRing >= 3) art = "ring";
      ohneRing = art === "ring" ? 0 : ohneRing + 1;
      const d = { art, nr: dinge.length, z0: z, z1: z };
      if (art === "ring") {
        d.zustand = "offen";
        d.wann = 0;
        d.y = 0.9;
      } else if (art === "boe") {
        d.z1 = z + lerp(20, 38, zufall.zahl());
        const wurf = zufall.zahl();
        d.staerke = zufall.zahl() < 0.5 ? -lerp(0.18, lerp(0.26, 0.34, k), wurf) : lerp(0.2, lerp(0.3, 0.42, k), wurf);
      } else if (art === "wellen") {
        d.z1 = z + lerp(24, 42, zufall.zahl());
        d.hoch = lerp(0.24, 0.38, zufall.zahl());
        d.seite = zufall.zahl() < 0.5 ? -1 : 1;
      } else if (art === "seerosen") {
        d.z1 = z + lerp(3.5, 7.5, zufall.zahl());
        d.behalt = BEHALT_SEEROSE;
        d.getroffen = false;
      } else {
        d.z1 = z + 1.5;
        d.behalt = BEHALT_HOLZ;
        d.schraeg = (zufall.zahl() - 0.5) * 0.9;
        d.getroffen = false;
      }
      dinge.push(d);
      vorher = art;
      z = d.z1 + lerp(30, 11, Math.pow(k, 0.8)) * (0.65 + 0.7 * zufall.zahl());
    }
    return { dinge };
  }

  // Weht es an der Stelle z? Dann die Böe, sonst null.
  function boeBei(z) {
    for (const d of state.welt.dinge) {
      if (d.art === "boe" && z >= d.z0 && z <= d.z1) return d;
    }
    return null;
  }

  // Wie hoch das Wasser an der Stelle z steht: null, ausser über Wellen.
  const WELLEN_RAND = 3;
  function pegelBei(z) {
    for (const d of state.welt.dinge) {
      if (d.art !== "wellen" || z <= d.z0 || z >= d.z1) continue;
      return d.hoch * weich(d.z0, d.z0 + WELLEN_RAND, z) * (1 - weich(d.z1 - WELLEN_RAND, d.z1, z));
    }
    return 0;
  }

  // Liegt an der Stelle z etwas auf dem Wasser, das noch niemand getroffen hat?
  function hindernisBei(z) {
    for (const d of state.welt.dinge) {
      if ((d.art === "seerosen" || d.art === "holz") && !d.getroffen && z >= d.z0 - HIN_RAND && z <= d.z1 + HIN_RAND) return d;
    }
    return null;
  }

  // Der gewürfelte See in Worten: was auf den ersten 500 Metern liegt. Im
  // Turnier bekommen alle denselben Text.
  function weltText() {
    return state.welt.dinge.filter((d) => d.z0 < 500).map((d) => {
      const wo = d.z1 > d.z0 ? `${d.z0.toFixed(1)}-${d.z1.toFixed(1)}` : d.z0.toFixed(1);
      if (d.art === "boe") return `Böe ${wo} ${d.staerke > 0 ? "+" : ""}${d.staerke.toFixed(2)}`;
      if (d.art === "wellen") return `Wellen ${wo} ${d.hoch.toFixed(2)}${d.seite < 0 ? "l" : "r"}`;
      if (d.art === "seerosen") return `Seerosen ${wo}`;
      if (d.art === "holz") return `Holz ${wo}`;
      return `Ring ${wo}`;
    }).join(" | ");
  }

  // ---------------------------------------------------------------------------
  // Der Stein
  // ---------------------------------------------------------------------------
  /*
   * Ein Bogen ist eine Formel: Er beginnt zur Zeit t0 an der Stelle z0, fliegt
   * mit dem Schwung v und wäre nach Tn wieder auf der Höhe, von der er abhob
   * (eine Parabel, h hoch). Aufsetzen wird er zur Zeit t0 + T – das ist Tn,
   * ausser über Wellen, wo das Wasser höher steht.
   *
   *   boe     die Böe, die ihn trägt oder staucht (schon eingerechnet)
   *   ueber   das Hindernis, über das ihn eine Perfekt-Serie hebt
   *   auf     das Hindernis, auf dem er landen wird
   *   ufer    er landet am anderen Ufer
   */
  function neuerBogen(t0, z0, S, klasse) {
    let Tn = bogenDauer(S);
    let h = bogenHoehe(Tn);
    const boe = boeBei(z0);
    if (boe) {
      Tn *= 1 + boe.staerke;
      // Rückenwind trägt weit, aber kaum höher – sonst flöge der Stein aus dem Bild.
      h = Math.min(H_MAX, h * Math.pow(1 + boe.staerke, boe.staerke > 0 ? 0.7 : 1.3));
    }
    const ya = pegelBei(z0);
    // Seerosen und Treibholz: Mit einer Perfekt-Serie trägt der Bogen darüber.
    let ueber = null;
    const imWeg = hindernisBei(z0 + S * Tn);
    if (imWeg && klasse === "perfekt" && state.serie >= SERIE_HEBT) {
      const mal = (imWeg.z1 + HIN_RAND + 0.6 - z0) / (S * Tn);
      Tn *= mal;
      h *= Math.pow(mal, 1.2);
      ueber = imWeg;
    }
    // Wellen: Wo das Wasser höher steht, setzt der Stein früher auf.
    let u = 1;
    let yb = 0;
    for (let i = 0; i < 2; i += 1) {
      yb = Math.min(pegelBei(z0 + S * Tn * u), ya + 0.7 * h);
      u = (1 + Math.sqrt(Math.max(0, 1 - (yb - ya) / h))) / 2;
    }
    let T = Tn * u;
    let ziel = z0 + S * T;
    const ufer = ziel >= Z_UFER;
    if (ufer) {
      // Der letzte Bogen endet am anderen Ufer: Der Stein landet auf dem
      // Kies, gleich hinter der Wasserlinie.
      const mal = (Z_UFER + 1.2 - z0) / (S * Tn);
      Tn *= mal;
      h *= Math.pow(mal, 1.2);
      T = Tn;
      ziel = Z_UFER + 1.2;
      yb = ya;
    }
    const b = {
      art: "hupf", t0, z0, x0: 0, v: S, Tn, T, h, ya, yb, hand: 0, boe, ueber,
      auf: ueber || ufer ? null : hindernisBei(ziel), ufer, ziel,
    };
    // Die Libellenringe, durch die dieser Bogen führt: Ein perfekter Hüpfer
    // fliegt hindurch und bekommt Schub, jeder andere daran vorbei.
    for (const d of state.welt.dinge) {
      if (d.art !== "ring" || d.zustand !== "offen" || d.z0 <= z0 || d.z0 > ziel) continue;
      const un = (d.z0 - z0) / (S * Tn);
      d.wann = t0 + (d.z0 - z0) / S;
      d.y = Math.max(0.55, ya + 4 * h * un * (1 - un));
      if (klasse === "perfekt") {
        d.zustand = "trifft";
        state.S = Math.min(S_MAX + RING_SCHUB, state.S + RING_SCHUB);
      } else {
        d.zustand = "vorbei";
      }
    }
    return b;
  }

  // Der Wurf selbst: aus der Hand aufs Wasser. a ist der Zeiger beim
  // Loslassen (-1 zu steil … 1 zu flach) – ein steiler Wurf steigt hoch und
  // braucht lange, ein flacher ist gleich unten.
  function wurfBogen(t0, S, a) {
    const T = 0.85 - 0.28 * a;
    return {
      art: "wurf", t0, z0: HAND.z, x0: HAND.x, v: S, Tn: T, T, h: 0.75 * Math.pow(1 - a, 1.4), ya: 0, yb: 0, hand: HAND.y,
      boe: null, ueber: null, auf: null, ufer: false, ziel: HAND.z + S * T,
    };
  }

  // Wo der Stein zur Spielzeit t ist – in state, ohne neue Objekte.
  function steinBei(t) {
    const b = state.bogen;
    if (state.schritt === "flug" && b) {
      const dt = clamp(t - b.t0, 0, b.T);
      const un = dt / b.Tn;
      state.z = b.z0 + b.v * dt;
      state.y = b.ya + 4 * b.h * un * (1 - un) + b.hand * (1 - un) * (1 - un * 0.35);
      state.x = b.x0 * (1 - weich(0, 0.7, un));
    } else if (state.schritt === "nass" && b) {
      // Aufgesetzt, der Tipp fehlt noch: Der Stein pflügt durchs Wasser.
      const dt = Math.max(0, t - state.schrittZeit);
      state.z = b.ziel + b.v * 0.8 * dt;
      state.y = b.yb - 0.5 * dt;
      state.x = 0;
    } else if (state.schritt === "sinkt") {
      const dt = Math.max(0, t - state.schrittZeit);
      state.z = state.sinkZ + state.sinkV * 0.22 * (1 - Math.exp(-dt / 0.22));
      state.y = state.sinkY - 1.5 * dt - 0.6 * dt * dt;
      state.x = 0.25 * Math.sin(dt * 5) * Math.min(1, dt);
    } else if (state.schritt === "ufer") {
      // Am anderen Ufer: noch ein Stück über die Kiesel, dann liegt er.
      const dt = Math.max(0, t - state.schrittZeit);
      state.z = Z_UFER + 2.2 * (1 - Math.exp(-dt / 0.35));
      state.y = 0.12 + 0.3 * Math.abs(Math.sin(dt * 9)) * Math.exp(-dt * 4);
      state.x = 0;
    } else if (state.schritt === "ausholen") {
      const a = zeigerBei(t);
      const zug = 0.5 - 0.5 * Math.cos(Math.min(1, (t - state.ausholSeit) / 0.3) * Math.PI);
      state.x = HAND.x + 0.16 * zug;
      state.y = HAND.y - 0.12 * zug + 0.05 * a;
      state.z = HAND.z - 0.55 * zug;
    } else {
      state.x = HAND.x;
      state.y = HAND.y + (ruhig() ? 0 : 0.025 * Math.sin(t * 1.7));
      state.z = HAND.z;
    }
  }

  // Wo der Zeiger zur Spielzeit t steht: -1 zu steil, 0 genau richtig, 1 zu flach.
  const zeigerBei = (t) => -Math.cos(((t - state.ausholSeit) / AUSHOL_DAUER) * Math.PI * 2);

  // Loslassen: Der Stein fliegt. Je näher der Zeiger an der Mitte, desto mehr
  // Schwung nimmt er mit.
  function werfen(t) {
    const a = clamp(zeigerBei(t), -1, 1);
    const guete = 1 - Math.abs(a);
    const perfekt = Math.abs(a) <= WURF_MITTE;
    const S = perfekt ? S_WURF : lerp(S_WURF_MIN, S_WURF, Math.pow(guete, 0.7) * 0.96);
    state.wurf = { a, guete, perfekt };
    state.S = S;
    state.bogen = wurfBogen(t, S, a);
    state.schritt = "flug";
    state.schrittZeit = t;
    state.tipp = null;
    if (state.phase !== "spiel") return;
    ruf(perfekt ? "Perfekter Wurf" : a < 0 ? "Zu steil" : "Zu flach", perfekt ? GOLD : "#ffffff", perfekt ? 20 : 18, 1, 1.3);
    ton("steinhuepfer.wurf", { laut: 0.6 + 0.4 * guete });
    kids()?.vibrate?.(8);
  }

  // Wie gut ein Tipp sitzt: fehler ist Tipp minus Aufsetzen, in Sekunden
  // (negativ: zu früh), n das wievielte Aufsetzen.
  function werte(fehler, n, z = 0) {
    const f = fenster(n, z);
    const e = Math.abs(fehler);
    if (e <= f.P) return { klasse: "perfekt", behalt: BEHALT_PERFEKT };
    if (e <= f.G) return { klasse: "gut", behalt: lerp(BEHALT_GUT[0], BEHALT_GUT[1], (e - f.P) / (f.G - f.P)) };
    if (e <= f.K) return { klasse: "knapp", behalt: lerp(BEHALT_KNAPP[0], BEHALT_KNAPP[1], (e - f.G) / (f.K - f.G)) };
    return { klasse: "daneben", behalt: 0 };
  }

  // Der Stein berührt das Wasser (zur Spielzeit t). Ist schon getippt, wird
  // gleich gewertet – sonst pflügt er durchs Wasser und wartet auf den Tipp.
  function aufsetzen(t) {
    const b = state.bogen;
    state.z = b.ziel;
    state.y = b.yb;
    state.x = 0;
    if (b.ufer) { ankommen(t); return; }
    ringDazu(b.ziel, b.yb, t, 0.75 + 0.25 * clamp(b.v / S_NORM, 0, 1));
    spritzer(b.ziel, b.yb, b.v, 7);
    if (state.tipp !== null) {
      abheben(t, b.ziel, state.tipp - t);
    } else {
      state.schritt = "nass";
      state.schrittZeit = t;
    }
  }

  // Der Tipp ist da (oder die Frist um): werten und weiter – oder versinken.
  function abheben(t, z0, fehler) {
    const b = state.bogen;
    const n = state.huepfer + 1;
    let { klasse, behalt } = werte(fehler, n, z0);
    if (klasse === "daneben") {
      if (n > GNADE_BIS || state.verziehen) {
        versinken(t, z0, b.yb, !Number.isFinite(fehler) ? "kein Tipp" : fehler < 0 ? "zu früh" : "zu spät");
        return;
      }
      state.verziehen = true;
      klasse = "glueck";
      behalt = BEHALT_GLUECK;
    }
    let S = state.S * behalt;
    if (b.auf && !b.auf.getroffen) {
      // Auf einer Seerose oder auf Treibholz gelandet: Das bremst.
      b.auf.getroffen = true;
      S *= b.auf.behalt;
      if (state.phase === "spiel") ruf(b.auf.art === "holz" ? "Treibholz!" : "Seerosen!", "#ff9a7a", 18, -1);
    }
    if (klasse === "perfekt") {
      state.serie += 1;
      state.perfekte += 1;
      state.besteSerie = Math.max(state.besteSerie, state.serie);
      S *= 1 + SERIE_SCHUB * Math.min(state.serie - 1, SERIE_MAX);
    } else {
      state.serie = 0;
    }
    S = Math.min(S, S_MAX);
    state.huepfer = n;
    state.S = S;
    rueckmeldung(klasse, fehler, z0, b.yb);
    if (S < S_AUS) {
      versinken(t, z0, b.yb, "ausgehüpft");
      return;
    }
    state.bogen = neuerBogen(t, z0, S, klasse);
    state.schritt = "flug";
    state.schrittZeit = t;
    state.tipp = null;
    const neu = state.bogen;
    if (state.phase !== "spiel") return;
    if (neu.ueber) ruf("Darüber!", GOLD, 18, -1);
    if (neu.boe && neu.boe !== b.boe) ruf(neu.boe.staerke > 0 ? "Rückenwind" : "Gegenwind", "#dff3ff", 16, -1, 1.3);
  }

  function versinken(t, z, y, grund) {
    state.schritt = "sinkt";
    state.schrittZeit = t;
    state.sinkZ = z;
    state.sinkY = y;
    state.sinkV = state.bogen ? state.bogen.v : 0;
    state.grund = grund;
    state.serie = 0;
    state.tipp = null;
    state.meter = Math.max(state.meter, Math.floor(z));
    ringDazu(z, y, t, 1.2);
    if (state.phase !== "spiel") return;
    spritzer(z, y, 6, 16);
    const text = grund === "ausgehüpft" ? "Ausgehüpft" : grund === "kein Tipp" ? "Nicht getippt" : grund === "zu früh" ? "Zu früh" : "Zu spät";
    schrift(text, 0, 1.6, z + 1.5, "#ff9a7a", 24);
    kulisseAus();
    ton("steinhuepfer.versinken");
    kids()?.vibrate?.([18, 40, 18]);
  }

  // Das andere Ufer: Der Stein hüpft auf die Kiesel und bleibt liegen.
  function ankommen(t) {
    state.schritt = "ufer";
    state.schrittZeit = t;
    state.meter = Z_UFER;
    state.grund = "ufer";
    state.tipp = null;
    if (state.phase !== "spiel") return;
    schrift("Am anderen Ufer!", 0, 2.4, Z_UFER + 3, GOLD, 28);
    kulisseAus();
    klang()?.ton?.("meilenstein");
    kids()?.vibrate?.([20, 40, 20]);
  }

  // Was man vom Tipp hört und sieht: das Wort, Tropfen, ein Hauch Zeitlupe.
  const GOLD = "#ffd76a";
  function rueckmeldung(klasse, fehler, z, y) {
    if (state.phase !== "spiel") return;
    const wann = fehler < 0 ? "früh" : "spät";
    if (klasse === "perfekt") {
      ruf(state.serie > 1 ? `Perfekt ×${state.serie}` : "Perfekt", GOLD, 19, 1);
      funken(z, y + 0.1, 9);
      state.blitz = 1;
      if (!ruhig() && state.bogen.T > 0.42) state.lupe = 1;
      // Nur das erste Perfekt in Folge klingt eigens (klang.js, weniger ist mehr).
      if (state.serie === 1) klang()?.ton?.("perfekt", { laut: 0.7 });
      kids()?.vibrate?.(10);
    } else if (klasse === "gut") {
      ruf(`Gut · ${wann}`, "#ffffff", 17, 1);
      spritzer(z, y, state.S, 6);
    } else if (klasse === "knapp") {
      ruf(`Knapp · zu ${wann}`, "#ffb38a", 17, 1);
      spritzer(z, y, state.S, 14);
      state.ruck = 1;
      kids()?.vibrate?.(16);
    } else {
      ruf("Glück gehabt", "#ffb38a", 17, 1);
      spritzer(z, y, state.S, 16);
      state.ruck = 1;
    }
    ton("steinhuepfer.hupf", { laut: klasse === "perfekt" ? 0.8 : 1, hoehe: clamp(1.5 - 0.6 * state.S / S_NORM, 0.8, 1.5) * (klasse === "perfekt" ? 1.12 : klasse === "knapp" || klasse === "glueck" ? 0.8 : 1) }, 30);
  }

  // ---------------------------------------------------------------------------
  // Der Ablauf einer Runde, Ereignis um Ereignis
  // ---------------------------------------------------------------------------
  // Die Eingaben, nach ihrer Spielzeit geordnet: { t, ab } – ab = der Finger
  // setzt auf, sonst: er hebt ab.
  const eingaben = [];
  function eingabe(t, ab) {
    let i = eingaben.length;
    while (i > 0 && eingaben[i - 1].t > t) i -= 1;
    eingaben.splice(i, 0, { t, ab });
  }

  // Der Finger setzt auf (zur Spielzeit t).
  function druck(t) {
    if (state.schritt === "start") {
      state.schritt = "ausholen";
      state.schrittZeit = t;
      state.ausholSeit = t;
    } else if (state.schritt === "flug") {
      const b = state.bogen;
      // Der erste Tipp im Bogen zählt – ausser gleich nach dem Abheben.
      if (state.tipp !== null || t - b.t0 < Math.max(SPERRE_MIN, b.T * SPERRE)) return;
      state.tipp = t;
    } else if (state.schritt === "nass") {
      abheben(Math.max(t, state.schrittZeit), state.bogen.ziel + state.bogen.v * 0.8 * Math.max(0, t - state.schrittZeit), t - state.schrittZeit);
    }
  }

  // Der Finger hebt ab.
  function losgelassen(t) {
    if (state.schritt === "ausholen") werfen(Math.max(t, state.ausholSeit));
  }

  // Bis zur Spielzeit ziel: Eingaben und was der Stein von selbst tut, der
  // Reihe nach. Eine Eingabe darf ein wenig in der Vergangenheit liegen (sie
  // kam zwischen zwei Bildern) – gewertet wird nach ihrer Zeit.
  function ablauf(ziel) {
    for (let n = 0; n < 400; n += 1) {
      let wann = Infinity;
      if (state.schritt === "flug") wann = state.bogen.t0 + state.bogen.T;
      else if (state.schritt === "nass") wann = state.schrittZeit + fenster(state.huepfer + 1, state.bogen.ziel).K;
      else if (state.schritt === "ausholen") wann = state.ausholSeit + AUSHOL_MAX;
      else if (state.schritt === "start") wann = state.startFrist;
      const tipp = eingaben.length ? eingaben[0].t : Infinity;
      if (Math.min(wann, tipp) > ziel) break;
      if (tipp <= wann) {
        const e = eingaben.shift();
        if (e.ab) druck(e.t);
        else losgelassen(e.t);
      } else if (state.schritt === "flug") {
        aufsetzen(wann);
      } else if (state.schritt === "nass") {
        abheben(wann, state.bogen.ziel + state.bogen.v * 0.8 * (wann - state.schrittZeit), Infinity);
      } else if (state.schritt === "ausholen") {
        werfen(wann);
      } else {
        // Im Live-Modus hat niemand ausgeholt: Der Stein holt von selbst aus.
        state.schritt = "ausholen";
        state.schrittZeit = wann;
        state.ausholSeit = wann;
      }
    }
  }

  // Wann der Stein das nächste Mal aufsetzt (Spielzeit) – für die Autopiloten.
  const aufsetzZeit = () => (state.schritt === "flug" && state.bogen ? state.bogen.t0 + state.bogen.T : null);
  // Und wann der Zeiger das nächste Mal durch die Mitte geht.
  function mitteZeit() {
    if (state.schritt !== "ausholen") return null;
    const viertel = AUSHOL_DAUER / 4;
    const seit = Math.max(0, state.zeit - state.ausholSeit);
    return state.ausholSeit + viertel + Math.ceil(Math.max(0, seit - viertel) / (AUSHOL_DAUER / 2)) * (AUSHOL_DAUER / 2);
  }

  // ---------------------------------------------------------------------------
  // Ringe, Tropfen, Schriften
  // ---------------------------------------------------------------------------
  // Ein Ring auf dem Wasser: Er breitet sich aus und verbiegt das Spiegelbild
  // (HIMMEL_FS) – die jüngsten als Wellen, alle zusammen als Spur des Wurfs.
  const RINGE_MAX = 140;
  function ringDazu(z, y, t, kraft, x = 0) {
    if (state.ringe.length >= RINGE_MAX) state.ringe.shift();
    state.ringe.push({ x, z, y, t, kraft });
  }

  // Tropfen, die der Stein hochreisst: Sie fliegen mit, glitzern im
  // Gegenlicht und fallen zurück.
  function spritzer(z, y, v, anzahl) {
    if (ruhig()) anzahl = Math.ceil(anzahl / 3);
    for (let i = 0; i < anzahl && state.teile.length < 260; i += 1) {
      const w = Math.random() * Math.PI * 2;
      const quer = 0.4 + Math.random() * 1.9;
      state.teile.push({
        x: Math.cos(w) * 0.12, y: y + 0.03, z: z + Math.sin(w) * 0.12,
        vx: Math.cos(w) * quer, vy: 1.4 + Math.random() * 3.4, vz: v * (0.3 + Math.random() * 0.5) + Math.sin(w) * quer,
        fall: 9.5, r: 0.028 + Math.random() * 0.05, gold: 0, leben: 0.45 + Math.random() * 0.5, max: 0.95,
      });
    }
  }

  // Goldene Funken: ein perfekter Hüpfer, ein Libellenring.
  function funken(z, y, anzahl, v = state.S) {
    if (ruhig()) anzahl = Math.ceil(anzahl / 3);
    for (let i = 0; i < anzahl && state.teile.length < 260; i += 1) {
      const w = Math.random() * Math.PI * 2;
      const weg = 0.8 + Math.random() * 2.6;
      state.teile.push({
        x: 0, y, z, vx: Math.cos(w) * weg, vy: Math.abs(Math.sin(w)) * weg + 0.8, vz: v * (0.55 + Math.random() * 0.4),
        fall: 3.5, r: 0.05 + Math.random() * 0.06, gold: 1, leben: 0.35 + Math.random() * 0.45, max: 0.8,
      });
    }
  }

  function schrift(text, x, y, z, farbe, gross, dauer = 1.15) {
    state.schriften.push({ text, x, y, z, farbe, gross, seite: 0, leben: dauer, max: dauer });
  }

  // Ein kurzes Wort, das neben dem Stein mitfliegt: rechts, wie der Tipp sass,
  // links, was der See dazu tut. Dort ist der Blick ohnehin – und die Linie
  // zwischen Stein und Spiegelbild bleibt frei.
  function ruf(text, farbe, gross, seite, dauer = 0.85) {
    for (const s of state.schriften) if (s.seite === seite) s.leben = Math.min(s.leben, 0.12);
    state.schriften.push({ text, x: 0, y: 0, z: 0, farbe, gross, seite, leben: dauer, max: dauer });
  }

  // ---------------------------------------------------------------------------
  // Die Kamera
  // ---------------------------------------------------------------------------
  // Tief hinter dem Stein, mit Blick über den See. Die Welt wird relativ zu
  // ihr gezeichnet (x und z der Kamera sind null, nur ihre Höhe bleibt): So
  // rechnet die Grafikkarte überall mit kleinen Zahlen.
  const view = { cssW: 0, cssH: 0, dpr: 1, frei: 0, pw: 0, ph: 0, guete: 1, fest: false, langsam: 0, schnell: 0 };
  const kam = {
    x: 0, y: 1.7, z: HAND.z - 3.7, vz: 0, weit: 3.7, gier: 0, nick: -0.11, fov: 1, seit: 1,
    rechts: [1, 0, 0], hoch: [0, 1, 0], vor: [0, 0, 1], tan: [1, 1], auge: [0, 1.7, 0],
    proj: new Float32Array(16), sicht: new Float32Array(16), pv: new Float32Array(16),
  };
  const KAM_HOCH = 1.7;
  // Quer geht der Blick ein wenig hinab: Der Horizont liegt über der Mitte.
  // Hochkant, wo viel mehr Himmel ins Bild passt, liegt er fast in der Mitte
  // – oben die Wolken, unten ihr Spiegelbild.
  const kamNick = () => lerp(-0.112, 0.035, clamp((1.15 - view.cssW / Math.max(1, view.cssH)) / 0.6, 0, 1));

  function kameraNeu() {
    kam.x = 0;
    kam.y = KAM_HOCH;
    kam.weit = 3.7;
    kam.z = HAND.z - kam.weit;
    kam.vz = 0;
    kam.gier = 0;
    kam.nick = kamNick();
  }

  // dt in Spielzeit; vStein ist das Tempo des Steins über den See.
  function kameraTakt(dt, vStein) {
    if (dt <= 0) return;
    const sinkt = state.schritt === "sinkt";
    const amUfer = state.schritt === "ufer";
    const hand = state.schritt === "start" || state.schritt === "ausholen";
    // Mit viel Schwung bleibt die Kamera weiter zurück; wird der Stein
    // langsam, rückt sie auf.
    const weitZiel = hand ? 3.7 : sinkt ? -3.5 : amUfer ? 11 : lerp(6.2, 8.6, clamp((state.S - S_AUS) / (S_NORM - S_AUS), 0, 1));
    kam.weit += (weitZiel - kam.weit) * (1 - Math.exp(-dt / (sinkt ? 0.9 : 0.55)));
    kam.vz += (vStein - kam.vz) * (1 - Math.exp(-dt / 0.28));
    kam.z += kam.vz * dt + (state.z - kam.weit - kam.z) * (1 - Math.exp(-dt / 0.45));
    let hochZiel = KAM_HOCH + (hand ? 0 : 0.1 * Math.max(0, state.y));
    let gierZiel = 0;
    let nickZiel = kamNick();
    if (sinkt && !ruhig()) {
      // Der Stein ist versunken: Die Kamera steigt, dreht sich um und schaut
      // zurück auf die Kette der Ringe – den ganzen Wurf.
      const seit = state.zeit - state.schrittZeit;
      const k = weich(0.2, 1.3, seit);
      hochZiel = lerp(KAM_HOCH, 8 + Math.min(6, state.huepfer * 0.25), k);
      gierZiel = Math.PI * k;
      nickZiel = lerp(nickZiel, nickZiel - 0.05, k);
      kam.gier = gierZiel;
      kam.nick = nickZiel;
      kam.y += (hochZiel - kam.y) * (1 - Math.exp(-dt / 0.3));
      return;
    }
    if (amUfer) hochZiel = 3.6;
    kam.y += (hochZiel - kam.y) * (1 - Math.exp(-dt / 0.4));
    kam.gier += (gierZiel - kam.gier) * (1 - Math.exp(-dt / 0.3));
    kam.nick += (nickZiel - kam.nick) * (1 - Math.exp(-dt / 0.3));
  }

  function kameraStellen() {
    const seit = view.cssW / Math.max(1, view.cssH);
    // 50 Grad in der Höhe – auf einem sehr breiten Bild weniger (zur Seite
    // höchstens 82), hochkant mehr (zur Seite mindestens 48): viel Himmel und
    // viel Spiegelung.
    const grad = Math.PI / 180;
    let fov = 50 * grad;
    fov = Math.min(fov, 2 * Math.atan(Math.tan(41 * grad) / seit));
    fov = Math.max(fov, Math.min(1.55, 2 * Math.atan(Math.tan(24 * grad) / seit)));
    kam.fov = fov;
    kam.seit = seit;
    const wackel = ruhig() ? 0 : state.ruck;
    const ay = Math.sin(state.zeit * 47) * 0.035 * wackel;
    const nick = kam.nick + Math.sin(state.zeit * 61) * 0.006 * wackel;
    const cn = Math.cos(nick);
    const fx = Math.sin(kam.gier) * cn;
    const fy = Math.sin(nick);
    const fz = Math.cos(kam.gier) * cn;
    // rechts = oben × vor, hoch = vor × rechts (x zeigt im Bild nach rechts).
    let rx = fz;
    let ry = 0;
    let rz = -fx;
    const rl = Math.hypot(rx, rz) || 1;
    rx /= rl; rz /= rl;
    const hx = fy * rz - fz * ry;
    const hy = fz * rx - fx * rz;
    const hz = fx * ry - fy * rx;
    kam.rechts = [rx, ry, rz];
    kam.hoch = [hx, hy, hz];
    kam.vor = [fx, fy, fz];
    kam.tan = [Math.tan(fov / 2) * seit, Math.tan(fov / 2)];
    const ex = 0;
    const ey = kam.y + ay;
    const s = kam.sicht;
    s[0] = rx; s[4] = ry; s[8] = rz; s[12] = -(rx * ex + ry * ey);
    s[1] = hx; s[5] = hy; s[9] = hz; s[13] = -(hx * ex + hy * ey);
    s[2] = -fx; s[6] = -fy; s[10] = -fz; s[14] = fx * ex + fy * ey;
    s[3] = 0; s[7] = 0; s[11] = 0; s[15] = 1;
    const f = 1 / Math.tan(fov / 2);
    const NAH = 0.3;
    const FERN = 2400;
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
  const bild = { ok: false, verloren: false, prog: {}, netz: {}, rausch: null, wasser: null, leer: null, land: null };

  // Was alle Programme über das Licht wissen: Sonne, Glut, Dunst. Über dem
  // Wasser liegt der Dunst dichter als weiter oben – so stehen die Wipfel am
  // fernen Ufer über dem Nebel.
  const LICHT = `
    uniform vec3 uSonne, uSonneFlach, uLicht, uGlut, uNebel, uHimmelLicht, uAuge;
    uniform float uDichte, uZeit, uSonneFrei;
    vec3 dunst(vec3 farbe, vec3 ort) {
      vec3 hin = ort - uAuge;
      float weit = length(hin);
      float zurSonne = max(dot(normalize(hin.xz + vec2(1e-4)), uSonneFlach.xz), 0.0);
      vec3 nebel = mix(uNebel, uGlut, 0.4 * pow(zurSonne, 5.0));
      float dicht = uDichte * mix(1.9, 0.7, smoothstep(0.0, 24.0, abs(ort.y)));
      return mix(nebel, farbe, exp(-weit * dicht));
    }
  `;

  // Der Himmel: ein Dreieck über das ganze Bild. Aus der Blickrichtung jedes
  // Punkts entstehen Verlauf, Wolken, Sonne und die Berge rund um den See –
  // zwei Ketten, die hintere mit Schnee, auf dem das erste Licht liegt. Unter
  // dem Horizont steht derselbe Himmel auf dem Kopf: Dort trifft der Blick
  // das Wasser, und was es an dieser Stelle neigt (die Ringe des Steins, die
  // Wellen des Boots, eine Böe), verbiegt das Spiegelbild.
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
    uniform vec3 uRechts, uHoch, uVor, uZenit, uHorizont, uWolkeHell, uWolkeDunkel, uSchnee, uFels;
    uniform vec2 uTan, uKamWelt;
    uniform float uSchatten, uSterne, uSonnenAz, uPunkt;
    uniform sampler2D uRausch;
    uniform vec4 uRing[16];
    uniform int uRinge;
    uniform vec4 uBand[2];
    uniform vec4 uWoge[2];
    ${LICHT}
    const float UMLAUF = 0.15915494;

    // Ein Grat: seine Höhe (0 bis etwa 1) in der Richtung u (ein Umlauf = 1)
    // – und wie steil er dort nach rechts ansteigt. k: Wellen je Umlauf grob
    // und fein, die Zeile im Rauschen, wie zackig er ist.
    vec2 kamm(float u, vec4 k) {
      vec4 a = textureLod(uRausch, vec2(u * k.x + k.z, k.z * 1.7), 0.0);
      vec4 b = textureLod(uRausch, vec2(u * k.y + k.z * 3.1, k.z * 0.6 + 0.3), 0.0);
      float zack = 1.0 - abs(2.0 * b.r - 1.0);
      float richtung = b.r > 0.5 ? -1.0 : 1.0;
      float hoehe = max(a.r * (1.0 - k.w) + zack * k.w - 0.22, 0.0) * 1.28;
      float steig = (a.g - 0.5) * k.x * (1.0 - k.w) + richtung * 2.0 * (b.g - 0.5) * k.y * k.w;
      return vec2(hoehe, steig);
    }
    // Die drei Ketten: Gipfel, zweite Kette, Vorberge.
    const vec4 KETTE[3] = vec4[3](vec4(2.0, 9.0, 0.13, 0.42), vec4(3.0, 14.0, 0.57, 0.36), vec4(5.0, 23.0, 0.31, 0.3));
    // Sockel, Höhe, Schneegrenze (über 0.5: kein Schnee), wie flach der Sattel zur Sonne ist.
    const vec4 MASS[3] = vec4[3](vec4(0.035, 0.24, 0.085, 0.3), vec4(0.022, 0.15, 0.1, 0.3), vec4(0.01, 0.085, 0.9, 0.35));
    const float NEBEL[3] = float[3](0.07, 0.045, 0.028);

    void main() {
      vec3 d = normalize(uVor + vBild.x * uTan.x * uRechts + vBild.y * uTan.y * uHoch);
      float gespiegelt = step(d.y, 0.0);
      float matt = 0.0;
      if (d.y < 0.0) {
        // Wo der Blick das Wasser trifft (von der Kamera aus gemessen).
        float weit = uAuge.y / max(-d.y, 1e-4);
        vec2 p = d.xz * weit;
        vec2 welt = p + uKamWelt;
        // So viele Meter Wasser deckt ein Bildpunkt in der Tiefe: Feinere
        // Wellen verschwimmen, statt zu flimmern.
        float fuss = weit * weit * uPunkt / uAuge.y;
        float nah = 1.0 - smoothstep(110.0, 300.0, weit);
        vec2 neig = vec2(0.0);
        for (int i = 0; i < uRinge; i++) {
          vec4 r = uRing[i];
          vec2 q = p - r.xy;
          float l = length(q) + 1e-3;
          float alter = max(uZeit - r.z, 0.0);
          float radius = 0.25 + 2.0 * (1.0 - exp(-alter * 2.2)) + 0.55 * alter;
          float lang = 0.42 + 0.26 * alter;
          float breit = 0.3 + 0.42 * alter;
          float x = l - radius;
          float kraft = r.w * 0.1 * exp(-alter * 0.3) / (1.0 + 0.12 * radius);
          kraft *= clamp(1.0 - fuss * 2.2 / lang, 0.0, 1.0);
          neig += (q / l) * (sin(x * 6.2832 / lang) * exp(-(x * x) / (breit * breit)) * kraft);
        }
        // Die Wellen des Ruderboots: Kämme quer über die Bahn.
        for (int i = 0; i < 2; i++) {
          vec4 w = uWoge[i];
          float drin = (1.0 - smoothstep(w.y - 4.0, w.y, abs(p.y - w.x))) * w.z;
          float f = clamp(1.0 - fuss * 2.2 / 3.4, 0.0, 1.0);
          float phase = welt.y * 1.85 + welt.x * 0.42 * w.w + uZeit * 2.4;
          neig += vec2(0.3 * w.w, 1.0) * (cos(phase) * 0.075 * drin * f);
          matt = max(matt, drin * 0.25 * (1.0 - f));
        }
        // Eine Böe: Das Wasser kräuselt sich, der Spiegel wird stumpf.
        for (int i = 0; i < 2; i++) {
          vec4 b = uBand[i];
          float drin = (1.0 - smoothstep(b.y - 3.0, b.y + 1.0, abs(p.y - b.x))) * step(0.001, b.y);
          float f = clamp(1.0 - fuss * 0.7, 0.0, 1.0);
          vec2 uv = welt * 0.21 + vec2(0.0, -uZeit * 0.45 * b.w);
          neig += (textureLod(uRausch, uv, 0.0).gb - 0.5) * (0.2 * drin * f);
          matt = max(matt, drin * mix(0.7, 0.3, f));
        }
        // Der See atmet: eine lange, kaum sichtbare Dünung.
        neig += (textureLod(uRausch, welt * 0.011 + vec2(uZeit * 0.003, 0.0), 0.0).gb - 0.5) * 0.02;
        neig *= nah;
        d = reflect(d, normalize(vec3(-neig.x, 1.0, -neig.y)));
        // Was sich ins Wasser hinab spiegeln würde, zeigt den Horizont.
        d.y = max(d.y, 0.004);
        d = normalize(d);
      }
      float h = d.y;
      float az = atan(d.x, d.z);
      float u = az * UMLAUF;
      float zurSonne = max(dot(d, uSonne), 0.0);
      vec2 flach = normalize(d.xz + vec2(1e-4));
      float zuSeite = dot(flach, uSonneFlach.xz);
      float seite = max(zuSeite, 0.0);

      // Der Verlauf: am Horizont warm, oben kühl. Zur Sonne hin glüht er; ihr
      // gegenüber liegt über dem Horizont ein rosa Band, darunter der blaue
      // Schatten der Erde.
      vec3 c = mix(uHorizont, uZenit, 1.0 - pow(1.0 - h, 4.2));
      float band = pow(1.0 - h, 11.0);
      c = mix(c, uGlut, band * (0.2 + 0.8 * seite * seite));
      float gegen = max(-zuSeite, 0.0);
      c = mix(c, mix(uZenit, uHorizont, 0.75) * vec3(1.0, 0.9, 1.05), gegen * smoothstep(0.03, 0.12, h) * (1.0 - smoothstep(0.14, 0.34, h)) * 0.55);
      c = mix(c, uZenit * 0.85, gegen * (1.0 - smoothstep(0.0, 0.07, h)) * 0.5);

      // Die letzten Sterne.
      if (uSterne > 0.01) {
        vec3 q = d * 120.0;
        vec3 zelle = floor(q);
        float z = fract(sin(dot(zelle, vec3(127.1, 311.7, 74.7))) * 43758.5453);
        float stern = step(0.991, z) * smoothstep(0.4, 0.05, length(fract(q) - 0.5));
        c += vec3(0.9, 0.93, 1.0) * stern * uSterne * smoothstep(0.25, 0.7, h);
      }

      // Wolken: lang gezogene Bänke und feine Schleier, von unten beleuchtet.
      // Zur Sonne hin golden, weiter weg rosa, auf der anderen Seite blau.
      vec2 uv = d.xz / (h + 0.1);
      float w1 = texture(uRausch, uv * vec2(0.034, 0.105) + vec2(uZeit * 0.0011, 0.13)).a;
      vec4 s2 = texture(uRausch, uv * vec2(0.09, 0.3) + vec2(-uZeit * 0.0008, 0.37));
      float w3 = texture(uRausch, uv * vec2(0.27, 0.8) + vec2(0.61, 0.0)).a;
      float dichte = w1 * 0.6 + s2.r * 0.28 + w3 * 0.12;
      float wolke = smoothstep(0.49, 0.71, dichte + 0.05) * smoothstep(0.02, 0.13, h) * (1.0 - smoothstep(0.55, 0.98, h));
      float kern = smoothstep(0.63, 0.86, dichte);
      // Wo sich eine Wolke der Sonne zuneigt, glüht sie; ihr Kern bleibt
      // dunkel, ihr dünner Saum fängt das Licht.
      float relief = clamp(0.5 - (s2.b - 0.5) * 2.4, 0.0, 1.0);
      float glanz = clamp(0.14 + 0.78 * pow(seite, 2.0) + 0.3 * (1.0 - h) - 0.5 * gegen, 0.0, 1.0) * (0.6 + 0.7 * relief);
      vec3 wolkenFarbe = mix(uWolkeDunkel, uWolkeHell, clamp(glanz * (1.0 - 0.5 * kern), 0.0, 1.0));
      float saum = wolke * (1.0 - wolke) * 4.0;
      wolkenFarbe += uLicht * (pow(zurSonne, 6.0) * 0.6 * (1.0 - kern) + saum * pow(seite, 3.0) * 0.22);
      c = mix(c, wolkenFarbe, wolke * 0.9);

      // Die Sonne: ein weiter Hof, ein enger, die Scheibe. Steht sie noch
      // hinter dem Grat, malen die Berge darüber.
      c += uLicht * (pow(zurSonne, 6.0) * 0.13 + pow(zurSonne, 60.0) * 0.2) * (1.0 - wolke * 0.5);
      c += uLicht * smoothstep(0.99955, 0.9998, zurSonne) * 3.2;

      if (h < 0.3) {
        vec3 dunstFarbe = mix(uNebel, uGlut, 0.42 * pow(seite, 4.0));
        // Wie viel direktes Licht ein Hang bekommt: gegen die Sonne keines,
        // quer zu ihr und ihr gegenüber alles. Und von welcher Seite es kommt.
        float beschienen = smoothstep(0.96, 0.25, zuSeite);
        float vonRechts = sin(uSonnenAz - az);
        float sgn = vonRechts < 0.0 ? -1.0 : 1.0;
        // Zur Sonne hin ein Sattel in allen Ketten – dort geht sie auf.
        float dAz = atan(sin(az - uSonnenAz), cos(az - uSonnenAz));
        float sattel = exp(-dAz * dAz / 0.05);

        // Drei Ketten, von hinten nach vorn: die Gipfel (weit, hoch,
        // verschneit), eine zweite Kette, die bewaldeten Vorberge.
        for (int i = 0; i < 3; i++) {
          vec4 k = KETTE[i];
          vec4 m = MASS[i];
          vec2 g = kamm(u, k);
          float grat = (m.x + m.y * g.x) * mix(1.0, m.w, sattel);
          if (h < grat + 0.003) {
            float tief = grat - h;
            // Die Kante zwischen Licht und Schatten läuft vom Gipfel schräg
            // hinab: Weiter unten gilt die Neigung des Grats ein Stück weiter
            // zur Sonne hin.
            vec2 g2 = kamm(u + tief * 0.11 * sgn, k);
            float hang = smoothstep(-0.5, 0.5, -g2.y * sgn * 2.2);
            float fern = 1.0 - float(i) * 0.5;
            // Schnee über der Grenze, ausgefranst; darunter Fels, vorn Wald.
            float grenze = m.z + 0.05 * (g2.x - 0.45) - 0.012 * hang;
            float schnee = smoothstep(grenze - 0.006, grenze + 0.008, h) * step(m.z, 0.5);
            vec3 schatten = mix(uFels * mix(vec3(0.5, 0.64, 0.66), vec3(1.0), fern), uSchnee * 0.86, schnee);
            vec3 farbe = schatten * (0.84 + 0.2 * hang);
            // Das erste Licht: oben an den Gipfeln, auf der Seite zur Sonne.
            float sonnig = smoothstep(uSchatten - 0.02, uSchatten + 0.025, h) * beschienen * hang;
            farbe += uLicht * (0.22 + 0.72 * schnee) * sonnig;
            // Und der Widerschein des hellen Horizonts, auch im Schatten.
            farbe += uGlut * 0.07 * hang * (0.4 + 0.6 * beschienen);
            float unten = clamp(tief / max(grat, 0.02), 0.0, 1.0);
            farbe = mix(farbe, dunstFarbe, mix(0.1, 0.46, fern) + 0.3 * unten * unten);
            c = mix(c, farbe, smoothstep(grat + 0.0012, grat - 0.0012, h));
          }
          // Eine Nebelbank vor jeder Kette.
          float bank = textureLod(uRausch, vec2(u * (3.0 + float(i) * 2.0) + uZeit * 0.0007 * (float(i) - 1.0), 0.9 - 0.3 * float(i)), 0.0).a;
          c = mix(c, dunstFarbe * 1.04, smoothstep(NEBEL[i], 0.0, h) * (0.3 + 0.45 * bank));
        }
      }

      // Der Schein der Sonne liegt über allem – auch über dem Grat, hinter
      // dem sie noch steht.
      c += uGlut * pow(zurSonne, 4.0) * 0.1 + uLicht * (pow(zurSonne, 14.0) * 0.08 + pow(zurSonne, 120.0) * 0.3) * uSonneFrei;

      // Eine Böe macht den Spiegel stumpf: Dort liegt das Licht des Himmels.
      c = mix(c, uHimmelLicht * 0.9 + uHorizont * 0.15, matt * gespiegelt);
      // Sehr Helles läuft weich aus und behält seine Farbe, statt weiss
      // auszubrennen – nur die Sonne selbst wird weiss.
      float grell = max(c.r, max(c.g, c.b));
      float sanft = min(grell, 0.7) + 0.3 * (1.0 - exp(-max(grell - 0.7, 0.0) / 0.3));
      c *= sanft / max(grell, 1e-4);
      c = mix(c, vec3(sanft), smoothstep(1.5, 3.6, grell) * 0.85);
      // Ein Hauch Rauschen gegen Streifen im Verlauf.
      c += (fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) / 160.0;
      aus = vec4(c, 1.0);
    }`;

  // Das Wasser: eine grosse Fläche bei y = 0. Seine Farbe ist, was man durch
  // das Wasser sieht – am Ufer die Kiesel auf dem Grund, weiter draussen die
  // dunkle Tiefe –, dazu das Glitzern der Sonne. Wie viel es spiegelt, steht
  // in alpha: So viel bleibt vom Spiegelbild darunter stehen (blendFunc ONE,
  // SRC_ALPHA).
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
    uniform vec2 uKamWelt;
    uniform vec3 uTief;
    uniform vec4 uBand[2];
    ${LICHT}
    void main() {
      vec3 hin = uAuge - vOrt;
      float weit = length(hin);
      vec3 v = hin / weit;
      vec2 welt = vOrt.xz + uKamWelt;
      vec4 a = texture(uRausch, welt * 0.017 + vec2(uZeit * 0.003, uZeit * 0.002));
      vec4 b = texture(uRausch, welt * 0.083 + vec2(-uZeit * 0.004, uZeit * 0.006));
      float boe = 0.0;
      for (int i = 0; i < 2; i++) {
        boe = max(boe, (1.0 - smoothstep(uBand[i].y - 3.0, uBand[i].y + 1.0, abs(vOrt.z - uBand[i].x))) * step(0.001, uBand[i].y));
      }
      vec2 neigung = (a.gb - 0.5) * 0.22 + (b.gb - 0.5) * (0.14 + 1.6 * boe);
      float ruhe = 1.0 / (1.0 + weit * 0.004);
      vec3 n = normalize(vec3(-neigung.x * ruhe, 1.0, -neigung.y * ruhe));
      float nv = max(dot(n, v), 0.0);
      // Ein stiller Bergsee spiegelt stärker, als die Physik es will.
      float spiegel = 0.5 + 0.5 * pow(1.0 - nv, 2.0);

      // Was unter dem Wasser liegt: am Ufer Kiesel, dann fällt der Grund ab.
      float seicht = (1.0 - smoothstep(0.5, 9.0, welt.y)) + (1.0 - smoothstep(0.5, 9.0, 700.0 - welt.y));
      vec3 durch = uTief;
      if (seicht > 0.0) {
        vec2 gu = welt * 1.7 + n.xz * 0.6;
        float k1 = texture(uRausch, gu * 0.11).r;
        float k2 = texture(uRausch, gu * 0.47).a;
        vec3 kiesel = mix(vec3(0.20, 0.19, 0.17), vec3(0.50, 0.46, 0.40), smoothstep(0.35, 0.7, k1 * 0.6 + k2 * 0.4));
        kiesel *= (uHimmelLicht * 0.8 + uLicht * 0.3 * uSonneFrei) * vec3(0.72, 0.9, 0.86);
        durch = mix(uTief, kiesel, seicht * 0.9);
      }
      vec3 r = reflect(-v, n);
      float zurSonne = max(dot(r, uSonne), 0.0);
      vec3 glitzer = uLicht * (pow(zurSonne, 420.0) * 9.0 + pow(zurSonne, 48.0) * 0.25) * uSonneFrei;
      aus = vec4(durch * (1.0 - spiegel) + glitzer * spiegel, spiegel * mix(0.985, 1.0, smoothstep(300.0, 900.0, weit)));
    }`;

  // Alles Feste: das Ufer mit Wald, Steg und Kieseln (ein einziges grosses
  // Netz), dazu der Stein, das Boot, Treibholz, Enten – je ein Netz, viele
  // Male gezeichnet, jedes Mal mit Ort, Grösse, Drehung und Farbe.
  // uSpiegel = -1 stellt alles auf den Kopf: das Spiegelbild im Wasser.
  const DING_VS = `#version 300 es
    layout(location = 0) in vec3 aOrt;
    layout(location = 1) in vec3 aNorm;
    layout(location = 2) in vec3 aFarbe;
    layout(location = 3) in vec4 iOrt;    // x, y, z, Drehung um die Hochachse
    layout(location = 4) in vec4 iMass;   // Breite, Höhe, Tiefe, kippen
    layout(location = 5) in vec4 iFarbe;  // Farbe, Glanz (negativ: eigenes Leuchten)
    uniform mat4 uPV;
    uniform vec3 uVersatz;
    uniform float uSpiegel, uPegel, uNicken;
    out vec3 vOrt;
    out vec3 vNorm;
    out vec4 vFarbe;
    out float vHoehe;
    void main() {
      vec3 p = aOrt * iMass.xyz;
      vec3 n = aNorm / iMass.xyz;
      float ck = cos(iMass.w), sk = sin(iMass.w);
      if (uNicken < 0.5) {
        // Kippen um die Wurfrichtung (rollen), dann drehen.
        p = vec3(p.x * ck - p.y * sk, p.x * sk + p.y * ck, p.z);
        n = vec3(n.x * ck - n.y * sk, n.x * sk + n.y * ck, n.z);
      }
      float cy = cos(iOrt.w), sy = sin(iOrt.w);
      p = vec3(p.x * cy + p.z * sy, p.y, -p.x * sy + p.z * cy);
      n = vec3(n.x * cy + n.z * sy, n.y, -n.x * sy + n.z * cy);
      if (uNicken > 0.5) {
        // Der Stein: erst um sich selbst drehen, dann die Nase heben.
        p = vec3(p.x, p.y * ck + p.z * sk, -p.y * sk + p.z * ck);
        n = vec3(n.x, n.y * ck + n.z * sk, -n.y * sk + n.z * ck);
      }
      vec3 w = p + iOrt.xyz + uVersatz;
      vHoehe = w.y - uPegel;
      if (uSpiegel < 0.0) {
        w.y = 2.0 * uPegel - w.y;
        n.y = -n.y;
      }
      vOrt = w;
      vNorm = n;
      vFarbe = vec4(aFarbe * iFarbe.rgb, iFarbe.a);
      gl_Position = uPV * vec4(w, 1.0);
    }`;
  const DING_FS = `#version 300 es
    precision highp float;
    in vec3 vOrt;
    in vec3 vNorm;
    in vec4 vFarbe;
    in float vHoehe;
    out vec4 aus;
    uniform float uSpiegel, uKies;
    uniform vec2 uKamWelt;
    uniform vec3 uZenit, uHorizont;
    uniform sampler2D uRausch;
    ${LICHT}
    void main() {
      if (uSpiegel < 0.0 && vHoehe < 0.0) discard;
      vec3 n = normalize(vNorm);
      vec3 v = normalize(uAuge - vOrt);
      float oben = n.y * uSpiegel * 0.5 + 0.5;
      vec3 grund = vFarbe.rgb;
      if (uKies > 0.5) {
        // Das Ufer: Wo der Boden flach am Wasser liegt, ist er Kies – fein
        // gesprenkelt, und an der Wasserlinie dunkel vor Nässe.
        vec2 welt = vOrt.xz + uKamWelt;
        float k1 = texture(uRausch, welt * 0.23).r;
        float k2 = texture(uRausch, welt * 1.7).a;
        float k3 = texture(uRausch, welt * 4.9).r;
        float flach = smoothstep(0.8, 0.97, oben) * (1.0 - smoothstep(1.2, 5.0, abs(vHoehe)));
        float kiesel = 0.55 * smoothstep(0.44, 0.6, k2) + 0.45 * smoothstep(0.46, 0.66, k3);
        grund *= mix(1.0, 0.56 + 0.3 * k1 + 0.6 * kiesel, flach);
        grund *= mix(1.0, 0.58, (1.0 - smoothstep(0.02, 0.2, abs(vHoehe))) * flach);
      }
      float sonne = max(dot(n, uSonne), 0.0) * uSonneFrei;
      // Der helle Horizont, wo die Sonne aufgeht, leuchtet schon vor ihr.
      float glut = max(dot(n, normalize(uSonneFlach + vec3(0.0, 0.35, 0.0))), 0.0);
      vec3 c = grund * (uHimmelLicht * mix(0.5, 1.15, oben) + uGlut * glut * 0.5 + uLicht * sonne * 1.15);
      // Gegenlicht: An den Rändern glüht der Morgen.
      float rand = pow(1.0 - abs(dot(n, v)), 3.0);
      c += uGlut * 0.22 * rand * (0.3 + 0.7 * oben);
      if (vFarbe.a > 0.0) {
        // Nass und glatt: Der Stein spiegelt den Himmel – zur Sonne hin den
        // hellen Horizont, auf der anderen Seite das kühle Blau – und die
        // Sonne selbst.
        vec3 r = reflect(-v, n);
        r.y *= uSpiegel;
        float fresnel = 0.16 + 0.84 * pow(1.0 - max(dot(n, v), 0.0), 3.0);
        float zurGlut = max(dot(normalize(r.xz + vec2(1e-4)), uSonneFlach.xz), 0.0);
        vec3 unten = mix(mix(uZenit, uHorizont, 0.45), mix(uHorizont, uGlut, 0.35) * 1.15, zurGlut);
        vec3 himmel = mix(unten, uZenit, clamp(r.y * 1.5, 0.0, 1.0)) * smoothstep(-0.3, 0.08, r.y);
        c += vFarbe.a * (himmel * fresnel * 0.85 + uLicht * (pow(max(dot(r, uSonne), 0.0), 40.0) * 1.4 * (0.25 + 0.75 * uSonneFrei)));
      } else if (vFarbe.a < 0.0) {
        c += vFarbe.rgb * -vFarbe.a;
      }
      aus = vec4(dunst(c, vOrt), 1.0);
    }`;

  // Schilf: je Büschel eine Scheibe, die sich zur Kamera dreht. Die Halme
  // entstehen im Programm – so bleibt auch ein dünner Halm sichtbar.
  const HALM_VS = `#version 300 es
    layout(location = 0) in vec2 aEcke;
    layout(location = 1) in vec4 iA;      // x, y, z, Breite
    layout(location = 2) in vec4 iB;      // Höhe, Saat, hell, –
    uniform mat4 uPV;
    uniform vec3 uVersatz, uRechtsFlach;
    uniform float uSpiegel;
    out vec2 vEcke;
    out vec3 vOrt;
    flat out vec3 vWie;
    void main() {
      float oben = aEcke.y * 0.5 + 0.5;
      vec3 w = iA.xyz + uVersatz + uRechtsFlach * (aEcke.x * iA.w) + vec3(0.0, oben * iB.x, 0.0);
      if (uSpiegel < 0.0) w.y = -w.y;
      vEcke = vec2(aEcke.x, oben);
      vOrt = w;
      vWie = iB.yzw;
      gl_Position = uPV * vec4(w, 1.0);
    }`;
  const HALM_FS = `#version 300 es
    precision highp float;
    in vec2 vEcke;
    in vec3 vOrt;
    flat in vec3 vWie;
    out vec4 aus;
    ${LICHT}
    void main() {
      float fein = fwidth(vEcke.x) * 1.2;
      float a = 0.0;
      float kolben = 0.0;
      for (int i = 0; i < 5; i++) {
        float fi = float(i);
        float s = fract(sin(vWie.x * 91.7 + fi * 37.3) * 4375.85);
        float t = fract(s * 7.31);
        float fuss = (fi - 2.0) * 0.2 + (s - 0.5) * 0.3;
        float hoch = 0.45 + 0.55 * t;
        float y = vEcke.y / hoch;
        float biegung = (fract(s * 3.7) - 0.5) * 1.5 + 0.06 * sin(uZeit * 0.9 + s * 20.0);
        float mitte = fuss + biegung * y * y * 0.6;
        float dick = 0.022 * (1.0 - 0.8 * y) + 0.003;
        float dx = abs(vEcke.x - mitte);
        float halm = smoothstep(dick + fein, dick - fein, dx) * step(y, 1.0);
        a = max(a, halm);
        // Jeder zweite trägt einen Kolben.
        if (t > 0.45) {
          float k = smoothstep(0.034 + fein, 0.034 - fein, dx) * smoothstep(0.72, 0.75, y) * smoothstep(0.93, 0.9, y);
          kolben = max(kolben, k);
        }
      }
      a = max(a, kolben);
      if (a < 0.02) discard;
      vec3 gruen = mix(vec3(0.10, 0.13, 0.06), vec3(0.34, 0.33, 0.14), vEcke.y) * vWie.y;
      vec3 farbe = mix(gruen, vec3(0.16, 0.10, 0.06), kolben);
      farbe *= uHimmelLicht * 0.9 + uLicht * 0.7 * uSonneFrei;
      farbe += uGlut * 0.1 * vEcke.y;
      aus = vec4(dunst(farbe, vOrt) * a, a);
    }`;

  // Alles, was leuchtet: Tropfen, Funken, Libellenringe, der Schleier vor
  // der Sonne. Scheiben, die zur Kamera schauen und ihr Licht dazulegen.
  const SCHEIN_VS = `#version 300 es
    layout(location = 0) in vec2 aEcke;
    layout(location = 1) in vec4 iA;      // x, y, z, Grösse
    layout(location = 2) in vec4 iB;      // Farbe, wie hart der Rand ist
    uniform mat4 uProj, uSicht;
    uniform float uSpiegel, uFerne;
    out vec2 vEcke;
    out vec4 vFarbe;
    void main() {
      vec3 w = iA.xyz;
      if (uSpiegel < 0.0) w.y = -w.y;
      vec4 p = uSicht * vec4(w, 1.0);
      // Weit weg schluckt der Dunst das Licht.
      vFarbe = vec4(iB.rgb * exp(p.z * uFerne), iB.a);
      p.xy += aEcke * iA.w;
      vEcke = aEcke;
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
        // Ein Ring aus Licht mit einem Hauch darin (ein Libellenring).
        float ab = (r - 0.82) / 0.034;
        a = exp(-ab * ab) + 0.03 * max(1.0 - r, 0.0);
      } else {
        a = pow(max(1.0 - r, 0.0), vFarbe.a);
      }
      aus = vec4(vFarbe.rgb * a, 1.0);
    }`;

  // Was flach auf dem Wasser liegt: die Spur der Ringe und die Blätter der
  // Seerosen. Scheiben in der Ebene des Wassers; die Form entsteht im Programm.
  const FLECK_VS = `#version 300 es
    layout(location = 0) in vec2 aEcke;
    layout(location = 1) in vec4 iA;      // x, y, z, Radius
    layout(location = 2) in vec4 iB;      // Art (0 Ring, 1 Blatt), Deckkraft, Drehung, Farbton
    uniform mat4 uPV;
    out vec2 vEcke;
    out vec3 vOrt;
    out vec4 vWie;
    void main() {
      vec3 w = iA.xyz + vec3(aEcke.x, 0.0, aEcke.y) * iA.w;
      vEcke = aEcke;
      vOrt = w;
      vWie = iB;
      gl_Position = uPV * vec4(w, 1.0);
    }`;
  const FLECK_FS = `#version 300 es
    precision highp float;
    in vec2 vEcke;
    in vec3 vOrt;
    in vec4 vWie;
    out vec4 aus;
    uniform vec3 uHorizont;
    ${LICHT}
    void main() {
      float r = length(vEcke);
      float fein = fwidth(r) * 1.3 + 1e-4;
      if (vWie.x < 0.5) {
        // Zwei helle Kämme, dazwischen ein dunkles Tal: ein Ring der Spur.
        float k1 = exp(-pow((r - 0.9) / max(0.035, fein), 2.0));
        float k2 = exp(-pow((r - 0.64) / max(0.035, fein), 2.0)) * 0.6;
        float tal = exp(-pow((r - 0.77) / max(0.05, fein), 2.0));
        float schwach = min(1.0, 0.035 / max(0.035, fein));
        vec3 hell = (uHorizont * 0.55 + uHimmelLicht * 0.35) * (k1 + k2) * vWie.y * schwach;
        aus = vec4(hell, tal * 0.22 * vWie.y * schwach);
      } else {
        // Ein Seerosenblatt: rund, mit einer Kerbe und feinen Adern.
        float c = cos(vWie.z), s = sin(vWie.z);
        vec2 q = vec2(vEcke.x * c - vEcke.y * s, vEcke.x * s + vEcke.y * c);
        float w = atan(q.y, q.x);
        float rand = 0.93 + 0.025 * sin(w * 7.0 + vWie.w * 30.0);
        float blatt = smoothstep(rand, rand - fein, r);
        float kerbe = smoothstep(0.0, 0.2, abs(w)) + smoothstep(0.16, 0.1, r);
        float a = blatt * clamp(kerbe, 0.0, 1.0) * vWie.y;
        if (a < 0.01) discard;
        float adern = 0.5 + 0.5 * cos(w * 13.0);
        vec3 gruen = mix(vec3(0.07, 0.20, 0.10), vec3(0.20, 0.36, 0.14), vWie.w) * (0.82 + 0.18 * adern * smoothstep(0.1, 0.8, r));
        gruen *= mix(1.0, 0.72, smoothstep(0.75, 0.93, r));
        vec3 farbe = gruen * (uHimmelLicht * 1.05 + uLicht * 0.55 * uSonneFrei) + uGlut * 0.05;
        aus = vec4(dunst(farbe, vOrt) * a, a);
      }
    }`;

  // Die Enten, wenn sie auffliegen: je eine kleine Scheibe, die zur Kamera
  // schaut – ein Rumpf und zwei Flügel, die schlagen (wie die Stare im Schwarm).
  const VOGEL_VS = `#version 300 es
    layout(location = 0) in vec2 aEcke;
    layout(location = 1) in vec4 iA;      // x, y, z, Takt
    layout(location = 2) in vec4 iB;      // rollen, –, Grösse, Deckkraft
    uniform mat4 uProj, uSicht;
    uniform float uSpiegel, uPunkt;
    uniform float uUhr;
    out vec2 vEcke;
    out vec3 vOrt;
    out float vDeck;
    out float vSchlag;
    void main() {
      vec3 w = iA.xyz;
      vec2 e = aEcke;
      float roll = iB.x;
      if (uSpiegel < 0.0) { w.y = -w.y; e.y = -e.y; roll = -roll; }
      vec4 p = uSicht * vec4(w, 1.0);
      float gross = max(iB.z, -p.z * uPunkt * 2.4);
      float c = cos(roll), s = sin(roll);
      p.xy += vec2(e.x * c - e.y * s, e.x * s + e.y * c) * gross;
      vEcke = aEcke;
      vOrt = w;
      vDeck = iB.w;
      vSchlag = sin(uUhr * (17.0 + 5.0 * fract(iA.w * 7.31)) + iA.w * 6.2832);
      gl_Position = uProj * p;
    }`;
  const VOGEL_FS = `#version 300 es
    precision highp float;
    in vec2 vEcke;
    in vec3 vOrt;
    in float vDeck;
    in float vSchlag;
    out vec4 aus;
    ${LICHT}
    float strecke(vec2 p, vec2 a, vec2 b) {
      vec2 pa = p - a;
      vec2 ba = b - a;
      return length(pa - ba * clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0));
    }
    void main() {
      vec2 p = vec2(abs(vEcke.x), vEcke.y);
      float w = 0.1 + 0.7 * vSchlag;
      vec2 gelenk = 0.42 * vec2(cos(w * 0.6), sin(w * 0.6));
      vec2 spitze = gelenk + 0.5 * vec2(cos(w * 1.35), sin(w * 1.35));
      float d = strecke(p, vec2(0.0), gelenk) - 0.085;
      d = min(d, strecke(p, gelenk, spitze) - mix(0.08, 0.03, clamp(length(p - gelenk) * 2.0, 0.0, 1.0)));
      d = min(d, length(p * vec2(1.0, 0.75)) - 0.16);
      float rand = fwidth(d) * 0.9 + 1e-4;
      float a = smoothstep(rand, -rand, d) * vDeck;
      if (a < 0.01) discard;
      vec3 c = dunst(vec3(0.05, 0.045, 0.05) + uGlut * 0.16 * smoothstep(-0.06, 0.0, d), vOrt);
      aus = vec4(c * a, a);
    }`;

  function programm(name, vs, fs) {
    const baue = (art, quelle) => {
      const s = gl.createShader(art);
      gl.shaderSource(s, quelle);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(`Steinhüpfer, Programm «${name}»: ${gl.getShaderInfoLog(s)}`);
      return s;
    };
    const p = gl.createProgram();
    gl.attachShader(p, baue(gl.VERTEX_SHADER, vs));
    gl.attachShader(p, baue(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(`Steinhüpfer, Programm «${name}»: ${gl.getProgramInfoLog(p)}`);
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
  // Je Ecke neun Zahlen: Ort, Richtung der Fläche, Farbe. dreieck und viereck
  // geben jeder Fläche ihre eigene Richtung (kantig, wie gebrochener Fels);
  // innen ist ein Punkt im Inneren des Körpers: Die Fläche schaut von ihm weg.
  function netzBauer() {
    const v = [];
    let f = [1, 1, 1];
    function ecke(p, n) {
      v.push(p[0], p[1], p[2], n[0], n[1], n[2], f[0], f[1], f[2]);
    }
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
      const n = [nx, ny, nz];
      ecke(a, n); ecke(b, n); ecke(c, n);
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
    // Ein Dreieck mit vorgegebenen Richtungen an den Ecken: runde Körper.
    // faerbe(richtung) gibt, wenn gewünscht, jeder Ecke ihre eigene Farbe.
    function rund(a, b, c, na, nb, nc, faerbe = null) {
      [[a, na], [b, nb], [c, nc]].forEach(([p, n]) => {
        if (faerbe) f = faerbe(n);
        ecke(p, n);
      });
    }
    return { v, farbe(r, g, b) { f = [r, g, b]; }, dreieck, viereck, kasten, rund };
  }

  // Die Flächen einer Kugel: ein Achtflächner, stufen-mal unterteilt.
  function kugelFlaechen(stufen) {
    const norm = (p) => { const l = Math.hypot(p[0], p[1], p[2]); return [p[0] / l, p[1] / l, p[2] / l]; };
    const halb = (p, q) => norm([(p[0] + q[0]) / 2, (p[1] + q[1]) / 2, (p[2] + q[2]) / 2]);
    let flaechen = [];
    const X = [1, 0, 0], Y = [0, 1, 0], Z = [0, 0, 1], x = [-1, 0, 0], y = [0, -1, 0], z = [0, 0, -1];
    for (const o of [Y, y]) for (const [p, q] of [[X, Z], [Z, x], [x, z], [z, X]]) flaechen.push([o, p, q]);
    for (let n = 0; n < stufen; n += 1) {
      const neu = [];
      for (const [p, q, r] of flaechen) {
        const pq = halb(p, q), qr = halb(q, r), rp = halb(r, p);
        neu.push([p, pq, rp], [pq, q, qr], [rp, qr, r], [pq, qr, rp]);
      }
      flaechen = neu;
    }
    return flaechen;
  }

  // Eine runde Kugel (für Kiesel, Köpfe, Blüten) – mit Radius 1.
  function kugelNetz(stufen) {
    const b = netzBauer();
    for (const [p, q, r] of kugelFlaechen(stufen)) b.rund(p, q, r, p, q, r);
    return new Float32Array(b.v);
  }

  // Der Stein: flach, rund geschliffen, nicht ganz gleichmässig – so sieht
  // man, dass er sich dreht. Breite und Dicke kommen beim Zeichnen dazu.
  function steinNetz() {
    const b = netzBauer();
    const form = (p) => {
      const w = Math.atan2(p[2], p[0]);
      const r = 1 + 0.09 * Math.sin(2 * w + 0.7) + 0.06 * Math.sin(3 * w + 2.1) + 0.03 * Math.sin(5 * w);
      // Oben und unten flacher als eine Kugel, der Rand rund.
      const y = Math.sign(p[1]) * Math.pow(Math.abs(p[1]), 0.72);
      return [p[0] * r, y, p[2] * r];
    };
    // Grau gewölkt, mit einer hellen Ader quer durch – wie ein Kiesel aus dem
    // Bach. Die Farbe folgt aus dem Ort jeder Ecke, sie verläuft weich.
    const faerbe = (p) => {
      const fleck = 0.92 + 0.1 * Math.sin(p[0] * 7 + 1) * Math.sin(p[2] * 6 + 2) + 0.06 * Math.sin(p[0] * 15 + p[2] * 11 + p[1] * 4);
      const ader = 0.5 * Math.exp(-Math.pow((p[0] * 0.8 + p[2] * 0.6 - 0.18 + 0.09 * Math.sin(p[2] * 6)) / 0.075, 2));
      const hell = fleck + ader;
      return [hell, hell, hell * (1 - 0.1 * ader)];
    };
    for (const [p, q, r] of kugelFlaechen(3)) b.rund(form(p), form(q), form(r), p, q, r, faerbe);
    return new Float32Array(b.v);
  }

  // Ein kantiger Felsbrocken.
  function felsNetz(saat) {
    const b = netzBauer();
    const form = (p) => {
      const k = 0.78 + 0.44 * hash01(saat * 13.7 + Math.round(p[0] * 7) * 3.1 + Math.round(p[1] * 7) * 5.3 + Math.round(p[2] * 7) * 7.9);
      return [p[0] * k, p[1] * k, p[2] * k];
    };
    for (const [p, q, r] of kugelFlaechen(1)) b.dreieck(form(p), form(q), form(r), [0, 0, 0]);
    return new Float32Array(b.v);
  }

  // Eine Tanne: ein Stamm und drei Stufen Äste, 1 hoch.
  function tannenNetz(saat) {
    const b = netzBauer();
    const ring = (y, r, n, dreh) => Array.from({ length: n }, (_, j) => {
      const w = (j / n) * Math.PI * 2 + dreh;
      const k = 0.86 + 0.28 * hash01(saat * 9.1 + y * 31.7 + j * 3.3);
      return [Math.cos(w) * r * k, y + (hash01(saat * 3.7 + j * 1.9 + y * 17) - 0.5) * 0.03, Math.sin(w) * r * k];
    });
    b.farbe(0.2, 0.14, 0.1);
    const fuss = ring(-0.03, 0.034, 5, 0);
    const hals = ring(0.24, 0.024, 5, 0);
    for (let j = 0; j < 5; j += 1) b.viereck(fuss[j], fuss[(j + 1) % 5], hals[(j + 1) % 5], hals[j], [0, 0.1, 0]);
    const stufen = [[0.13, 0.56, 0.25], [0.38, 0.8, 0.185], [0.62, 1.0, 0.12]];
    stufen.forEach(([unten, oben, r], i) => {
      const hell = 0.82 + 0.16 * i;
      b.farbe(0.075 * hell, 0.15 * hell, 0.105 * hell);
      const kranz = ring(unten, r, 7, i * 0.45 + saat);
      const spitze = [0, oben, 0];
      for (let j = 0; j < 7; j += 1) b.dreieck(kranz[j], kranz[(j + 1) % 7], spitze, [0, unten + 0.05, 0]);
    });
    return new Float32Array(b.v);
  }

  // Ein Stück Treibholz: ein Stamm entlang x, 1 lang, mit einem Aststummel.
  function holzNetz() {
    const b = netzBauer();
    const S = 7;
    const STUECKE = [-0.5, -0.2, 0.15, 0.5];
    const ring = (x, r, i) => Array.from({ length: S }, (_, j) => {
      const w = (j / S) * Math.PI * 2;
      const k = 0.85 + 0.3 * hash01(i * 7.7 + j * 3.1);
      return [x, Math.cos(w) * r * k, Math.sin(w) * r * k];
    });
    b.farbe(0.27, 0.2, 0.15);
    const ringe = STUECKE.map((x, i) => ring(x, 0.5 * (1 - 0.18 * i), i));
    for (let i = 0; i < ringe.length - 1; i += 1) {
      for (let j = 0; j < S; j += 1) b.viereck(ringe[i][j], ringe[i][(j + 1) % S], ringe[i + 1][(j + 1) % S], ringe[i + 1][j], [(STUECKE[i] + STUECKE[i + 1]) / 2, 0, 0]);
    }
    b.farbe(0.4, 0.33, 0.25);
    for (const [i, x] of [[0, -0.5], [ringe.length - 1, 0.5]]) {
      for (let j = 0; j < S; j += 1) b.dreieck(ringe[i][j], ringe[i][(j + 1) % S], [x, 0, 0], [0, 0, 0]);
    }
    b.farbe(0.22, 0.16, 0.12);
    b.kasten(0.12, 0.55, 0.1, 0.035, 0.42, 0.16);
    return new Float32Array(b.v);
  }

  // Das Ruderboot: ein Rumpf aus Spanten, zwei Bänke, zwei Ruder – und wer
  // darin sitzt. 1 lang (entlang z); die Masse kommen beim Zeichnen dazu.
  function bootNetz() {
    const b = netzBauer();
    const SPANTEN = [-0.5, -0.4, -0.22, 0.02, 0.26, 0.42, 0.5];
    const breit = (z) => 0.15 * Math.pow(Math.max(0, 1 - Math.pow(Math.abs(z) * 2, 2.4)), 0.6) + 0.01;
    const spant = (z) => {
      const w = breit(z);
      const hoch = 0.1 + 0.06 * Math.pow(Math.abs(z) * 2, 2.2);
      return [[-w, hoch, z], [-w * 0.8, 0.02, z], [0, -0.03, z], [w * 0.8, 0.02, z], [w, hoch, z]];
    };
    const reihe = SPANTEN.map(spant);
    for (let i = 0; i < reihe.length - 1; i += 1) {
      // Die Mitte liegt hoch über dem Boot: So schauen die Planken nach
      // aussen und unten, wie ein Rumpf.
      const mitte = [0, 0.6, (SPANTEN[i] + SPANTEN[i + 1]) / 2];
      for (let j = 0; j < 4; j += 1) {
        // Dunkelgrün gestrichen, der oberste Gang heller.
        const oben = j === 0 || j === 3;
        b.farbe(oben ? 0.2 : 0.09, oben ? 0.32 : 0.17, oben ? 0.26 : 0.14);
        b.viereck(reihe[i][j], reihe[i][j + 1], reihe[i + 1][j + 1], reihe[i + 1][j], mitte);
      }
    }
    // Zwei Bänke.
    b.farbe(0.36, 0.27, 0.18);
    b.kasten(0, 0.075, -0.14, 0.135, 0.007, 0.03);
    b.kasten(0, 0.075, 0.2, 0.115, 0.007, 0.03);
    // Der Fischer sitzt hinten, leicht vornübergebeugt: Beine, Rumpf, Kopf, Hut.
    b.farbe(0.13, 0.15, 0.2);
    b.kasten(0, 0.1, -0.09, 0.04, 0.02, 0.055);
    b.farbe(0.17, 0.22, 0.34);
    b.kasten(0, 0.165, -0.135, 0.046, 0.066, 0.034);
    b.farbe(0.5, 0.37, 0.29);
    b.kasten(0, 0.253, -0.125, 0.024, 0.024, 0.024);
    b.farbe(0.46, 0.38, 0.2);
    b.kasten(0, 0.28, -0.125, 0.056, 0.005, 0.056);
    b.kasten(0, 0.292, -0.125, 0.026, 0.012, 0.026);
    // Die Angel, weit über den Bug hinaus.
    b.farbe(0.2, 0.15, 0.1);
    b.viereck([0.02, 0.17, -0.09], [0.02, 0.182, -0.09], [0.05, 0.47, 0.5], [0.05, 0.462, 0.5], [0, -1, 0]);
    // Die Ruder liegen eingezogen auf dem Rand.
    b.farbe(0.4, 0.31, 0.2);
    for (const s of [-1, 1]) b.kasten(s * 0.135, 0.118, 0.06, 0.007, 0.006, 0.2);
    // Am Bug ein Pfosten mit der Laterne.
    b.farbe(0.16, 0.13, 0.11);
    b.kasten(0, 0.17, 0.43, 0.006, 0.06, 0.006);
    b.farbe(1.0, 0.8, 0.45);
    b.kasten(0, 0.215, 0.43, 0.014, 0.018, 0.014);
    return new Float32Array(b.v);
  }

  // Eine Ente auf dem Wasser: Rumpf, Kopf, Schnabel. 1 lang.
  function entenNetz() {
    const b = netzBauer();
    const kugel = kugelFlaechen(1);
    const teil = (mx, my, mz, rx, ry, rz) => {
      for (const [p, q, r] of kugel) {
        b.rund(...[p, q, r].map((e) => [mx + e[0] * rx, my + e[1] * ry, mz + e[2] * rz]), p, q, r);
      }
    };
    b.farbe(0.3, 0.24, 0.19);
    teil(0, 0.16, 0, 0.3, 0.2, 0.5);
    b.farbe(0.2, 0.17, 0.14);
    teil(0, 0.3, -0.36, 0.2, 0.1, 0.2);
    b.farbe(0.08, 0.22, 0.16);
    teil(0, 0.5, 0.36, 0.15, 0.16, 0.16);
    b.farbe(0.75, 0.56, 0.16);
    b.kasten(0, 0.47, 0.56, 0.05, 0.025, 0.09);
    return new Float32Array(b.v);
  }

  function kastenNetz() {
    const b = netzBauer();
    b.kasten(0, 0, 0, 1, 1, 1);
    return new Float32Array(b.v);
  }

  // ---------------------------------------------------------------------------
  // Zeichnen: das Ufer
  // ---------------------------------------------------------------------------
  /*
   * Der See ist immer derselbe (ein Ort, kein Würfelwurf): ein langes Oval,
   * 700 m vom Kiesstrand bis zum anderen Ufer. w ist der Winkel um seine
   * Mitte (-90° ist der Strand, von dem geworfen wird), aus der Abstand von
   * der Wasserlinie landeinwärts.
   */
  const SEE_RX = 160;
  const SEE_RZ = Z_UFER / 2;
  const uferRx = (w) => SEE_RX + 34 * Math.sin(2 * w + 0.6) + 20 * Math.sin(3 * w + 2.0) + 10 * Math.sin(5 * w + 1.1);
  function uferPunkt(w, aus) {
    const x = uferRx(w) * Math.cos(w);
    const z = SEE_RZ + SEE_RZ * Math.sin(w);
    const e = 0.002;
    let tx = uferRx(w + e) * Math.cos(w + e) - x;
    let tz = SEE_RZ + SEE_RZ * Math.sin(w + e) - z;
    const l = Math.hypot(tx, tz) || 1;
    tx /= l; tz /= l;
    return [x + tz * aus, z - tx * aus];
  }
  // Rauschen entlang des Ufers (eine Zahl je Stelle, weich dazwischen).
  function uferRausch(w, zellen, saat) {
    const k = ((w / (Math.PI * 2)) % 1 + 1) % 1 * zellen;
    const i = Math.floor(k);
    const t = k - i;
    const s = t * t * (3 - 2 * t);
    return lerp(hashGanz(saat * 1013 + (i % zellen)), hashGanz(saat * 1013 + ((i + 1) % zellen)), s);
  }
  // Wie hoch die Hügel hinter dem Ufer werden: an den Seiten hoch, am fernen
  // Ende flach (dort geht die Sonne auf) und hinter dem Strand auch – wer am
  // Schluss zurückschaut, sieht darüber die Gipfel im ersten Licht.
  function huegel(w) {
    const s = Math.sin(w);
    return lerp(1, 0.2, weich(0.5, 0.96, s)) * lerp(1, 0.22, weich(0.55, 0.96, -s)) * (0.7 + 0.6 * uferRausch(w, 14, 3));
  }
  function boden(aus, w) {
    if (aus <= 0) return aus * 0.22;
    if (aus <= 10) return aus * 0.09;
    const k = (aus - 10) / 220;
    const h = huegel(w);
    return 0.9 + (aus - 10) * (0.025 + 0.075 * h) + Math.pow(k, 1.7) * 62 * h;
  }

  // In ein grosses Netz schreiben: ein kleines Netz an seinen Ort.
  function setze(v, netz, x, y, z, dreh, sx, sy, sz, r = 1, g = 1, b = 1) {
    const c = Math.cos(dreh);
    const s = Math.sin(dreh);
    for (let i = 0; i < netz.length; i += 9) {
      const px = netz[i] * sx;
      const py = netz[i + 1] * sy;
      const pz = netz[i + 2] * sz;
      let nx = netz[i + 3] / sx;
      let ny = netz[i + 4] / sy;
      let nz = netz[i + 5] / sz;
      const l = Math.hypot(nx, ny, nz) || 1;
      nx /= l; ny /= l; nz /= l;
      v.push(x + px * c + pz * s, y + py, z - px * s + pz * c, nx * c + nz * s, ny, -nx * s + nz * c, netz[i + 6] * r, netz[i + 7] * g, netz[i + 8] * b);
    }
  }

  // Wo am Strand das Schilf steht (für landBauen und die Halme).
  const SCHILF = [];
  // Der Steg: links vom Werfer, ein paar Meter in den See hinaus.
  const STEG = { x: -5.7, breit: 0.95, z0: -4.6, z1: 13.4, y: 0.62 };

  function landBauen() {
    const v = [];
    const b = netzBauer();
    // --- Der Boden: Ringe um den See, am Strand feiner. ---
    const AUS = [-6, -2, 0, 1.2, 3, 6, 10, 18, 34, 60, 100, 150, 230];
    const winkel = [];
    for (let i = 0; i < 170; i += 1) winkel.push(-Math.PI / 2 + (i / 170) * Math.PI * 2);
    for (let i = 1; i < 72; i += 1) winkel.push(-Math.PI / 2 - 0.34 + (i / 72) * 0.68);
    winkel.sort((p, q) => p - q);
    const punkt = (i, j) => {
      const w = winkel[j % winkel.length];
      const zitter = i < 3 ? 0 : (hashGanz(i * 131 + (j % winkel.length) * 7) - 0.5) * 0.3 * (AUS[i] - AUS[i - 1]);
      const aus = AUS[i] + zitter;
      const [x, z] = uferPunkt(w, aus);
      const buckel = (hashGanz(i * 517 + (j % winkel.length) * 11) - 0.5) * (aus < 12 ? 0.07 : aus * 0.035);
      return [x, boden(aus, w) + (i === 2 ? 0 : buckel), z];
    };
    for (let i = 0; i < AUS.length - 1; i += 1) {
      const mitte = (AUS[i] + AUS[i + 1]) / 2;
      for (let j = 0; j < winkel.length; j += 1) {
        const zufaellig = hashGanz(i * 733 + j * 13);
        const hell = mitte < 15 ? 0.95 + 0.1 * zufaellig : 0.86 + 0.28 * zufaellig;
        if (mitte < 0.7) b.farbe(0.2 * hell, 0.19 * hell, 0.18 * hell);
        else if (mitte < 8) b.farbe(0.4 * hell, 0.375 * hell, 0.34 * hell);
        else if (mitte < 15) b.farbe(0.2 * hell, 0.23 * hell, 0.13 * hell);
        else b.farbe(0.075 * hell, 0.11 * hell, 0.08 * hell);
        const p00 = punkt(i, j);
        const p01 = punkt(i, j + 1);
        const p10 = punkt(i + 1, j);
        const p11 = punkt(i + 1, j + 1);
        const innen = [(p00[0] + p11[0]) / 2, -50, (p00[2] + p11[2]) / 2];
        b.viereck(p00, p01, p11, p10, innen);
      }
    }
    for (const zahl of b.v) v.push(zahl);

    // --- Der Wald: vorn am Ufer dicht, den Hang hinauf grösser. ---
    const tannen = [tannenNetz(1), tannenNetz(2), tannenNetz(3)];
    const baum = (nr, w, aus, gross) => {
      const s = Math.sin(w);
      // Der Strand bleibt frei – und am anderen Ufer die Stelle, an der der
      // Stein ankommt.
      if (s < -0.88 && aus < 17) return;
      if (s > 0.985 && aus < 46) return;
      const [x, z] = uferPunkt(w, aus);
      const hoch = gross * (0.8 + 0.5 * hashGanz(nr * 7 + 1));
      const laerche = hashGanz(nr * 7 + 2) < 0.13;
      const hell = 0.8 + 0.45 * hashGanz(nr * 7 + 3);
      setze(v, tannen[nr % 3], x, boden(aus, w) - 0.4, z, hashGanz(nr * 7 + 4) * 6.28, hoch * (0.85 + 0.3 * hashGanz(nr * 7 + 5)), hoch, hoch * (0.85 + 0.3 * hashGanz(nr * 7 + 6)),
        laerche ? 3.4 * hell : hell, laerche ? 1.75 * hell : hell, laerche ? 0.55 * hell : hell);
    };
    let nr = 0;
    for (let i = 0; i < 400; i += 1, nr += 1) baum(nr, hashGanz(nr * 3 + 11) * Math.PI * 2, lerp(4.5, 12, hashGanz(nr * 3 + 12)), 9.5);
    for (let i = 0; i < 330; i += 1, nr += 1) baum(nr, hashGanz(nr * 3 + 11) * Math.PI * 2, lerp(12, 32, hashGanz(nr * 3 + 12)), 12);
    for (let i = 0; i < 480; i += 1, nr += 1) baum(nr, hashGanz(nr * 3 + 11) * Math.PI * 2, lerp(32, 225, Math.pow(hashGanz(nr * 3 + 12), 1.3)), 17);

    // --- Felsbrocken an der Wasserlinie. ---
    const felsen = [felsNetz(1), felsNetz(2), felsNetz(3)];
    for (let i = 0; i < 46; i += 1) {
      const w = i < 8 ? -Math.PI / 2 + (i % 2 ? 1 : -1) * lerp(0.085, 0.3, hashGanz(i * 5 + 71)) : hashGanz(i * 5 + 71) * Math.PI * 2;
      const aus = lerp(-2.2, 2.5, hashGanz(i * 5 + 72));
      const [x, z] = uferPunkt(w, aus);
      const gross = lerp(0.5, 1.7, Math.pow(hashGanz(i * 5 + 73), 1.6));
      const hell = 0.8 + 0.4 * hashGanz(i * 5 + 74);
      setze(v, felsen[i % 3], x, boden(aus, w) + gross * 0.15, z, hashGanz(i * 5 + 75) * 6.28, gross * 1.25, gross * 0.75, gross, 0.3 * hell, 0.3 * hell, 0.33 * hell);
    }

    // --- Der Steg. ---
    const kasten = kastenNetz();
    const planken = Math.round((STEG.z1 - STEG.z0) / 0.36);
    for (let i = 0; i < planken; i += 1) {
      const hell = 0.8 + 0.4 * hashGanz(i + 901);
      setze(v, kasten, STEG.x + (hashGanz(i + 931) - 0.5) * 0.06, STEG.y, STEG.z0 + (i + 0.5) * 0.36, (hashGanz(i + 951) - 0.5) * 0.03,
        STEG.breit, 0.035, 0.155, 0.3 * hell, 0.25 * hell, 0.2 * hell);
    }
    for (const s of [-1, 1]) {
      setze(v, kasten, STEG.x + s * (STEG.breit - 0.14), STEG.y - 0.09, (STEG.z0 + STEG.z1) / 2, 0, 0.05, 0.06, (STEG.z1 - STEG.z0) / 2, 0.19, 0.155, 0.125);
      for (let i = 0; i < 6; i += 1) {
        const z = lerp(STEG.z0 + 3.4, STEG.z1 - 0.2, i / 5);
        const hoch = i === 5 || (i === 2 && s < 0) ? 0.55 : 0.08;
        setze(v, kasten, STEG.x + s * (STEG.breit + 0.02), (STEG.y + hoch - 1.4) / 2, z, 0.3 * i, 0.085, (STEG.y + hoch + 1.4) / 2, 0.085, 0.2, 0.165, 0.135);
      }
    }

    // Bis hierher reicht, was man auch von weitem sieht; die Kiesel danach
    // werden nur gezeichnet, solange die Kamera am Strand ist.
    const fern = v.length / 9;

    // --- Kiesel am Strand, dicht an der Wasserlinie. ---
    const kiesel = kugelNetz(1);
    const KIESEL_FARBEN = [[0.5, 0.48, 0.45], [0.36, 0.35, 0.36], [0.6, 0.55, 0.47], [0.3, 0.28, 0.27], [0.55, 0.42, 0.36], [0.72, 0.7, 0.66]];
    for (let i = 0; i < 640; i += 1) {
      const x = (hashGanz(i * 6 + 301) - 0.5) * 2 * lerp(1.5, 17, Math.pow(hashGanz(i * 6 + 302), 1.5));
      const aus = lerp(-1.6, 11, Math.pow(hashGanz(i * 6 + 303), 1.5));
      const w = -Math.PI / 2 + Math.asin(clamp(x / uferRx(-Math.PI / 2), -1, 1));
      const [px, pz] = uferPunkt(w, aus);
      const r = lerp(0.045, 0.2, Math.pow(hashGanz(i * 6 + 304), 2.4));
      const f = KIESEL_FARBEN[i % KIESEL_FARBEN.length];
      const nass = aus < 0.7 ? 0.62 : 1;
      setze(v, kiesel, px, boden(aus, w) + r * 0.22, pz, hashGanz(i * 6 + 305) * 6.28, r * 1.3, r * 0.55, r, f[0] * nass, f[1] * nass, f[2] * nass);
    }

    // --- Wo das Schilf steht: rechts im seichten Wasser, ein wenig am Steg. ---
    SCHILF.length = 0;
    for (let i = 0; i < 46; i += 1) {
      const rechts = i < 36;
      const x = rechts ? lerp(4.6, 15, Math.pow(hashGanz(i * 4 + 601), 0.8)) : lerp(-12.5, -7.2, hashGanz(i * 4 + 601));
      const w = -Math.PI / 2 + Math.asin(clamp(x / uferRx(-Math.PI / 2), -1, 1));
      const aus = rechts ? lerp(-6.5, 0.6, hashGanz(i * 4 + 602)) : lerp(-3.5, 0.5, hashGanz(i * 4 + 602));
      const [px, pz] = uferPunkt(w, aus);
      SCHILF.push([px, Math.min(0, boden(aus, w)) - 0.05, pz, lerp(0.55, 0.9, hashGanz(i * 4 + 603)), lerp(1.5, 2.5, hashGanz(i * 4 + 604)), i + 1, 0.8 + 0.4 * hashGanz(i * 4 + 605), 0]);
    }
    return { ecken: new Float32Array(v), fern };
  }

  // Rauschen, das sich nahtlos wiederholt: für Wolken, Berge, Kräuseln (mit
  // seiner Neigung in Grün und Blau). Einmal gerechnet, 256 × 256.
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
    const A = lage(23);
    const B = lage(61);
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

  function grafikBauen() {
    const P = bild.prog;
    P.himmel = programm("Himmel", HIMMEL_VS, HIMMEL_FS);
    P.wasser = programm("Wasser", WASSER_VS, WASSER_FS);
    P.ding = programm("Ding", DING_VS, DING_FS);
    P.halm = programm("Halm", HALM_VS, HALM_FS);
    P.schein = programm("Schein", SCHEIN_VS, SCHEIN_FS);
    P.fleck = programm("Fleck", FLECK_VS, FLECK_FS);
    P.vogel = programm("Vogel", VOGEL_VS, VOGEL_FS);

    // Die Netze, die sich bewegen: je eines, mit Abzügen.
    const N = bild.netz;
    N.stein = abzug(steinNetz(), [3, 3, 3], 12, 24);
    N.holz = abzug(holzNetz(), [3, 3, 3], 12, 8);
    N.boot = abzug(bootNetz(), [3, 3, 3], 12, 4);
    N.ente = abzug(entenNetz(), [3, 3, 3], 12, 24);
    N.kugel = abzug(kugelNetz(1), [3, 3, 3], 12, 120);
    const ecken = new Float32Array([-1, -1, 1, -1, 1, 1, -1, -1, 1, 1, -1, 1]);
    N.halm = abzug(ecken, [2], 8, 80);
    N.vogel = abzug(ecken, [2], 8, 24);
    N.fleck = abzug(ecken, [2], 8, 420);
    N.schein = abzug(ecken, [2], 8, 520);
    N.spiegelSchein = abzug(ecken, [2], 8, 160);
    N.sonne = abzug(ecken, [2], 8, 2);

    // Das Ufer mit Wald, Steg und Kieseln: ein einziges Netz, einmal gebaut.
    const land = landBauen();
    bild.land = { vao: gl.createVertexArray(), ecken: land.ecken.length / 9, fern: land.fern };
    gl.bindVertexArray(bild.land.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, land.ecken, gl.STATIC_DRAW);
    for (let i = 0; i < 3; i += 1) {
      gl.enableVertexAttribArray(i);
      gl.vertexAttribPointer(i, 3, gl.FLOAT, false, 36, i * 12);
    }
    // Das Schilf steht fest: einmal hochgeladen.
    N.halm.n = Math.min(N.halm.max, SCHILF.length);
    SCHILF.forEach((s, i) => { if (i < N.halm.max) N.halm.daten.set(s, i * 8); });
    hochladen(N.halm);

    // Das Wasser: eine Fläche um die Kamera, weit in alle Richtungen (am
    // Schluss schaut sie zurück).
    bild.wasser = gl.createVertexArray();
    gl.bindVertexArray(bild.wasser);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-2200, -2200, 2200, -2200, 2200, 2200, -2200, -2200, 2200, 2200, -2200, 2200]), gl.STATIC_DRAW);
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

  // Die Leinwand für die Welt entsteht einmal und bleibt über alle Runden –
  // mit ihr die Programme und Netze.
  function grafikStarten() {
    canvas = document.createElement("canvas");
    canvas.className = "sh-canvas";
    canvas.setAttribute("aria-hidden", "true");
    hud = document.createElement("canvas");
    hud.className = "sh-hud";
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
  // Was auf dem See schwimmt und fliegt (nur Zierde)
  // ---------------------------------------------------------------------------
  // Die Blätter eines Seerosenfelds, die Enten, der Fisch: Sie folgen aus
  // festen Zahlen und aus Math.random – am gewürfelten See ändern sie nichts.
  const schmuck = { blaetter: [], enten: [], fisch: null, fischBald: 2.5 };

  function schmuckNeu() {
    schmuck.blaetter.length = 0;
    for (const d of state.welt.dinge) {
      if (d.art !== "seerosen") continue;
      const lang = d.z1 - d.z0;
      const viele = Math.round(lang * 3) + 6;
      for (let i = 0; i < viele; i += 1) {
        const k = d.nr * 97 + i * 5;
        const r = lerp(0.36, 0.8, hash01(k + 1));
        schmuck.blaetter.push({
          d, x: (hash01(k + 2) - 0.5) * 2 * lerp(1.2, 5, hash01(k + 3)), z: lerp(d.z0 + r * 0.6, d.z1 - r * 0.6, hash01(k + 4)), r,
          dreh: hash01(k + 5) * 6.28, ton: hash01(k + 6), bluete: hash01(k + 7) < 0.34 ? (hash01(k + 8) < 0.5 ? 1 : 2) : 0,
        });
      }
    }
    // Zwei Trupps Enten, ein Stück neben der Bahn.
    schmuck.enten.length = 0;
    for (const [mitte, seite] of [[70 + Math.random() * 50, Math.random() < 0.5 ? -1 : 1], [290 + Math.random() * 120, Math.random() < 0.5 ? -1 : 1]]) {
      const viele = 3 + Math.floor(Math.random() * 3);
      for (let i = 0; i < viele; i += 1) {
        schmuck.enten.push({
          x: seite * (4.5 + Math.random() * 4.5), z: mitte + (Math.random() - 0.5) * 9, y: 0, dreh: Math.random() * 6.28, takt: Math.random(),
          seite, auf: -1, weg: 0.6 + Math.random() * 0.8,
        });
      }
    }
    schmuck.fisch = null;
    schmuck.fischBald = 2 + Math.random() * 3;
  }

  function schmuckTakt(dt) {
    const fliegt = state.schritt === "flug" || state.schritt === "nass";
    // Die Enten: Kommt der Stein, fliegen sie auf.
    for (const e of schmuck.enten) {
      if (e.auf < 0) {
        if (fliegt && state.z > e.z - 13 - e.weg * 5) {
          e.auf = 0;
          ringDazu(e.z, 0, state.zeit, 0.35, e.x);
        }
        continue;
      }
      e.auf += dt;
      const schub = Math.min(1, e.auf / 0.5);
      e.x += e.seite * (3 + 5 * schub) * e.weg * dt;
      e.z += (7 + 6 * e.weg) * schub * dt;
      e.y += (0.6 + 2.6 * schub) * e.weg * dt;
    }
    // Ab und zu springt ein Fisch.
    const f = schmuck.fisch;
    if (f) {
      f.t += dt;
      if (f.t > f.dauer) {
        ringDazu(f.z + f.vz * f.dauer, 0, state.zeit, 0.8, f.x + f.vx * f.dauer);
        schmuck.fisch = null;
      }
    } else if (fliegt && !ruhig()) {
      schmuck.fischBald -= dt;
      if (schmuck.fischBald <= 0 && state.z < Z_UFER - 120) {
        schmuck.fischBald = 4 + Math.random() * 6;
        const seite = Math.random() < 0.5 ? -1 : 1;
        schmuck.fisch = { x: seite * (7 + Math.random() * 12), z: state.z + 38 + Math.random() * 30, vx: -seite * (0.6 + Math.random()), vz: 1.2 * (Math.random() - 0.5), t: 0, dauer: 0.62 };
        ringDazu(schmuck.fisch.z, 0, state.zeit, 0.8, schmuck.fisch.x);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Zeichnen: ein Bild
  // ---------------------------------------------------------------------------
  const STEIN_FARBE = [0.4, 0.415, 0.45];
  const STEIN_MASS = [0.33, 0.08, 0.29];
  const SONNEN_AZ = 0.1;           // die Sonne geht ein wenig rechts von der Bahn auf
  const WEISS = [1, 1, 1];
  const ROSA = [1.0, 0.66, 0.8];
  const CREME = [1.0, 0.96, 0.88];
  const GELB = [1.0, 0.8, 0.25];
  const SILBER = [0.62, 0.68, 0.72];
  const RING_BLAU = [0.3, 0.95, 1.0];
  const RING_GOLD = [1.0, 0.86, 0.4];
  const BOOT_LANG = 4.6;
  const RING_R = 1.15;             // Radius eines Libellenrings

  function ding(a, x, y, z, dreh, sx, sy, sz, kipp, farbe, hell = 1, glanz = 0) {
    if (a.n >= a.max) return;
    const d = a.daten;
    const o = a.n * 12;
    d[o] = x - kam.x; d[o + 1] = y; d[o + 2] = z - kam.z; d[o + 3] = dreh;
    d[o + 4] = sx; d[o + 5] = sy; d[o + 6] = sz; d[o + 7] = kipp;
    d[o + 8] = farbe[0] * hell; d[o + 9] = farbe[1] * hell; d[o + 10] = farbe[2] * hell; d[o + 11] = glanz;
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

  // Dasselbe Licht noch einmal im Wasser.
  function scheinDoppelt(x, y, z, gross, r, gr, b, rand) {
    schein(x, y, z, gross, r, gr, b, rand);
    schein(x, y, z, gross, r, gr, b, rand, bild.netz.spiegelSchein);
  }

  function fleck(x, z, radius, art, deck, dreh, farbton) {
    const a = bild.netz.fleck;
    if (a.n >= a.max) return;
    const d = a.daten;
    const o = a.n * 8;
    d[o] = x - kam.x; d[o + 1] = art ? 0.02 : 0.012; d[o + 2] = z - kam.z; d[o + 3] = radius;
    d[o + 4] = art; d[o + 5] = deck; d[o + 6] = dreh; d[o + 7] = farbton;
    a.n += 1;
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

  // Wie der Stein gerade liegt: die Nase gehoben – so zeigt er der Kamera
  // hinter ihm seine nasse Oberseite. Beim Ausholen kippt er mit dem Zeiger:
  // steil aufgestellt oder flach.
  function steinLage() {
    if (state.schritt === "ausholen") return 0.3 - 0.42 * clamp(zeigerBei(state.zeit), -1, 1);
    if (state.schritt === "start") return 0.26;
    if (state.schritt === "sinkt") return 0.25 + 0.5 * Math.sin((state.zeit - state.schrittZeit) * 6);
    if (state.schritt === "ufer") return 0.05;
    const b = state.bogen;
    if (b && b.art === "wurf") return 0.2 - 0.3 * clamp(state.wurf?.a || 0, -1, 1) * (1 - (state.zeit - b.t0) / b.T);
    return 0.2;
  }

  // Die Radien der Ringe im Bild – dieselbe Formel wie im Programm des Himmels.
  const ringRadius = (alter) => 0.25 + 2.0 * (1 - Math.exp(-alter * 2.2)) + 0.55 * alter;
  const ringUniform = new Float32Array(64);
  const bandUniform = new Float32Array(8);
  const wogeUniform = new Float32Array(8);
  let ringZahl = 0;

  // Was im Bild steht, in die Abzüge schreiben.
  function weltSammeln() {
    const N = bild.netz;
    const W = state.welt;
    for (const name of Object.keys(N)) if (name !== "halm") N[name].n = 0;
    const t = state.zeit;
    const vorX = kam.vor[0];
    const vorZ = kam.vor[2];
    const licht = morgen.licht;
    const tag = 0.55 + 0.45 * morgen.frei;

    // Die Ringe: die jüngsten, die im Blick liegen, verbiegen das Spiegelbild;
    // alle zusammen liegen als Spur auf dem Wasser.
    ringZahl = 0;
    for (let i = state.ringe.length - 1; i >= 0; i -= 1) {
      const r = state.ringe[i];
      const alter = t - r.t;
      if (alter < 0) continue;
      const radius = ringRadius(alter);
      const dx = r.x - kam.x;
      const dz = r.z - kam.z;
      const voraus = dx * vorX + dz * vorZ;
      if (voraus < -radius - 2 || voraus > 420) continue;
      if (ringZahl < 16 && alter < 15) {
        ringUniform[ringZahl * 4] = dx;
        ringUniform[ringZahl * 4 + 1] = dz;
        ringUniform[ringZahl * 4 + 2] = r.t;
        ringUniform[ringZahl * 4 + 3] = r.kraft;
        ringZahl += 1;
      }
      fleck(r.x, r.z, radius / 0.9, 0, r.kraft * Math.min(1, alter / 0.25) * Math.exp(-alter / 26), 0, 0);
    }

    // Böen und Wellen in der Nähe, für die Programme von Himmel und Wasser.
    bandUniform.fill(0);
    wogeUniform.fill(0);
    let baender = 0;
    let wogen = 0;
    for (const d of W.dinge) {
      const mitte = (d.z0 + d.z1) / 2;
      const halb = (d.z1 - d.z0) / 2;
      const voraus = (mitte - kam.z) * vorZ;
      if (voraus < -halb - 30 || voraus > 330) continue;
      if (d.art === "boe" && baender < 2) {
        const o = baender * 4;
        bandUniform[o] = mitte - kam.z;
        bandUniform[o + 1] = halb;
        bandUniform[o + 2] = d.staerke;
        bandUniform[o + 3] = Math.sign(d.staerke);
        baender += 1;
        // Ein paar helle Striche zeigen, wohin es weht: mit dem Stein oder gegen ihn.
        if (!ruhig()) {
          for (let i = 0; i < 14; i += 1) {
            const k = d.nr * 31 + i * 7;
            const lauf = ((hash01(k + 1) + t * 0.32 * Math.sign(d.staerke)) % 1 + 1) % 1;
            const hell = Math.sin(lauf * Math.PI) * 0.12 * tag;
            schein((hash01(k + 2) - 0.5) * 16, 0.25 + 1.5 * hash01(k + 3), d.z0 + lauf * (d.z1 - d.z0), 0.26, hell, hell, hell * 1.1, 1.2);
          }
        }
      } else if (d.art === "wellen") {
        if (wogen < 2) {
          const o = wogen * 4;
          wogeUniform[o] = mitte - kam.z;
          wogeUniform[o + 1] = halb;
          wogeUniform[o + 2] = d.hoch / 0.3;
          wogeUniform[o + 3] = d.seite;
          wogen += 1;
        }
        // Das Ruderboot, von dem die Wellen kommen: quer zur Bahn, der
        // Fischer darin, am Bug eine Laterne.
        const bx = d.seite * (13 + 5 * hash01(d.nr * 3.3)) + 1.5 * Math.sin(t * 0.17 + d.nr);
        const bz = mitte + 2 * Math.sin(d.nr * 2.1);
        const dreh = -d.seite * 1.25;
        const schaukel = ruhig() ? 0 : 0.03 * Math.sin(t * 1.3 + d.nr);
        ding(N.boot, bx, 0.03, bz, dreh, BOOT_LANG, BOOT_LANG, BOOT_LANG, schaukel, WEISS);
        const lampe = 0.8 + 0.1 * Math.sin(t * 7.3 + d.nr);
        const lx = bx + Math.sin(dreh) * 0.43 * BOOT_LANG;
        const lz = bz + Math.cos(dreh) * 0.43 * BOOT_LANG;
        scheinDoppelt(lx, 0.215 * BOOT_LANG + 0.03, lz, 0.5, 1.0 * lampe, 0.66 * lampe, 0.25 * lampe, 2.0);
        scheinDoppelt(lx, 0.215 * BOOT_LANG + 0.03, lz, 2.4, 0.2 * lampe, 0.11 * lampe, 0.04 * lampe, 1.6);
      } else if (d.art === "holz") {
        // Der Stamm liegt quer zur Bahn im Wasser und schaukelt kaum merklich.
        ding(N.holz, 0.4 * Math.sin(d.nr), 0.04, mitte, d.schraeg, 3.9, 0.36, 0.4, ruhig() ? 0 : 0.02 * Math.sin(t * 0.9 + d.nr), WEISS);
      } else if (d.art === "ring") {
        ringZeichnen(d, t);
      }
    }

    // Seerosen: Blätter flach auf dem Wasser, dazwischen Blüten – sie stehen
    // ein wenig über dem Wasser und leuchten schon von weitem.
    for (const b of schmuck.blaetter) {
      const voraus = (b.z - kam.z) * vorZ;
      if (voraus < -4 || voraus > 260) continue;
      fleck(b.x, b.z, b.r, 1, 1, b.dreh, b.ton);
      if (b.bluete) {
        ding(N.kugel, b.x, 0.13, b.z, b.dreh, 0.26, 0.15, 0.26, 0, b.bluete === 1 ? ROSA : CREME, 1, -0.22);
        ding(N.kugel, b.x, 0.25, b.z, b.dreh, 0.1, 0.08, 0.1, 0, GELB, 1, -0.3);
      }
    }

    // Enten: auf dem Wasser als kleine Körper, in der Luft mit schlagenden Flügeln.
    for (const e of schmuck.enten) {
      if (e.auf < 0) {
        const wippen = ruhig() ? 0 : 0.012 * Math.sin(t * 1.9 + e.takt * 9);
        ding(N.ente, e.x, wippen, e.z, e.dreh, 0.56, 0.56, 0.56, 0, WEISS);
      } else if (e.auf < 7) {
        const a = N.vogel;
        if (a.n < a.max) {
          const o = a.n * 8;
          a.daten[o] = e.x - kam.x; a.daten[o + 1] = 0.25 + e.y; a.daten[o + 2] = e.z - kam.z; a.daten[o + 3] = e.takt;
          a.daten[o + 4] = -e.seite * 0.35; a.daten[o + 5] = 0; a.daten[o + 6] = 0.62; a.daten[o + 7] = clamp((7 - e.auf) / 2, 0, 1);
          a.n += 1;
        }
      }
    }
    const fisch = schmuck.fisch;
    if (fisch) {
      const u = fisch.t / fisch.dauer;
      ding(N.kugel, fisch.x + fisch.vx * fisch.t, 0.75 * 4 * u * (1 - u) - 0.05, fisch.z + fisch.vz * fisch.t, Math.atan2(fisch.vx, fisch.vz), 0.07, 0.11, 0.3, 0, SILBER, 1, 0.8);
    }

    // Die Gegner (geist.js): Steine aus Licht, jeder auf seiner Bahn daneben.
    geisterOrte.length = 0;
    if (gegner && state.phase !== "bereit") {
      (window.LernappGeist?.orte?.(gegner) || []).forEach((o, i) => {
        o.spur = (i % 2 ? 1 : -1) * (1.0 + 0.55 * Math.floor(i / 2));
        geisterOrte.push(o);
        // Wem im Live-Modus zugeschaut wird, der ist der Stein selbst – kein
        // Geist dazu, nur sein Name (geist.js, namen).
        if (o.ziel) return;
        const farbe = farbeAus(o.farbe);
        const gz = o.a / 10;
        const gy = Math.max(0.05, o.b / 100);
        if ((gz - kam.z) * vorZ < -2 || (gz - kam.z) * vorZ > 400) return;
        ding(N.stein, o.spur, gy, gz, t * 9 + i, STEIN_MASS[0] * 0.9, STEIN_MASS[1], STEIN_MASS[2] * 0.9, 0.2, farbe, 0.5 * o.blass, -0.9);
        scheinDoppelt(o.spur, gy, gz, 0.75, farbe[0] * 0.5 * o.blass, farbe[1] * 0.5 * o.blass, farbe[2] * 0.5 * o.blass, 1.8);
      });
    }

    // Der Stein. Unter Wasser sieht man ihn nicht mehr – nur was er aufwirbelt.
    if (state.y > -0.5) {
      ding(N.stein, state.x, state.y + STEIN_MASS[1] * 0.6, state.z, state.dreh, STEIN_MASS[0], STEIN_MASS[1], STEIN_MASS[2], steinLage(), STEIN_FARBE, 1, 1);
    }
    // Ein Hauch Licht um ihn: So bleibt er auch vor dunklem Wasser zu sehen.
    schein(state.x, Math.max(0.05, state.y) + 0.05, state.z, 0.7, morgen.glut[0] * 0.1, morgen.glut[1] * 0.1, morgen.glut[2] * 0.1, 1.5);
    if (state.blitz > 0.01) {
      const k = state.blitz * state.blitz;
      scheinDoppelt(state.x, Math.max(0.1, state.y), state.z, 1.1 + 1.6 * (1 - state.blitz), 1.0 * k, 0.86 * k, 0.5 * k, 1.7);
    }

    // Tropfen und Funken.
    for (const teil of state.teile) {
      const k = clamp(teil.leben / teil.max, 0, 1);
      if (teil.gold) schein(teil.x, teil.y, teil.z, teil.r * (0.5 + 0.5 * k), 1.0 * k, 0.8 * k, 0.32 * k, 1.3);
      else schein(teil.x, teil.y, teil.z, teil.r * (0.6 + 0.4 * k), (0.5 + 0.5 * licht[0]) * k * tag, (0.5 + 0.5 * licht[1]) * k * tag, (0.55 + 0.45 * licht[2]) * k * tag, 1.1);
    }

    // Ein Schleier vor der Sonne, sobald sie über dem Grat steht.
    const s = bild.sonne;
    const kraft = morgen.frei * 0.14;
    schein(kam.x + s[0] * 900, kam.auge[1] + s[1] * 900, kam.z + s[2] * 900, 320,
      licht[0] * kraft + morgen.glut[0] * 0.05, licht[1] * kraft + morgen.glut[1] * 0.05, licht[2] * kraft + morgen.glut[2] * 0.05, 2.6, N.sonne);
    for (const name of Object.keys(N)) if (name !== "halm") hochladen(N[name]);
  }

  // Ein Libellenring: ein Kreis aus Licht knapp über dem Wasser, um den
  // Libellen schwirren. Fliegt ein perfekter Hüpfer hindurch, wird er golden
  // und zerstiebt; jeder andere lässt ihn verblassen.
  function ringZeichnen(d, t) {
    d.yBild = d.yBild === undefined ? d.y : d.yBild + (d.y - d.yBild) * 0.2;
    const seit = d.zustand === "offen" || t < d.wann ? 0 : t - d.wann;
    if (seit > 1.2) return;
    const trifft = d.zustand === "trifft";
    const vorbei = d.zustand === "vorbei";
    const puls = 1 + 0.05 * Math.sin(t * 4 + d.nr);
    // Kommt der Stein nah, nimmt sich der Ring zurück – er soll ihn und sein
    // Spiegelbild nicht überstrahlen.
    let hell = (0.62 + 0.14 * Math.sin(t * 4 + d.nr)) * clamp((d.z0 - state.z) / 16, 0.45, 1);
    let gross = RING_R * puls;
    const f = trifft ? RING_GOLD : RING_BLAU;
    if (seit > 0) {
      hell *= Math.max(0, 1 - seit / (trifft ? 0.7 : 1.2)) * (vorbei ? 0.5 : 1.4);
      if (trifft) gross *= 1 + 2.2 * seit;
    }
    if (hell <= 0.01) return;
    scheinDoppelt(0, d.yBild, d.z0, gross / 0.82, f[0] * hell, f[1] * hell, f[2] * hell, -1);
    scheinDoppelt(0, d.yBild, d.z0, gross * 2.2, f[0] * hell * 0.07, f[1] * hell * 0.07, f[2] * hell * 0.07, 1.6);
    if (seit > 0) return;
    for (let i = 0; i < 6; i += 1) {
      const w = t * (1.6 + 0.3 * (i % 3)) * (i % 2 ? 1 : -1) + i * 1.05;
      const r = RING_R * (0.96 + 0.1 * Math.sin(t * 5.1 + i * 2));
      scheinDoppelt(Math.cos(w) * r, d.yBild + Math.sin(w) * r, d.z0 + 0.2 * Math.sin(t * 3 + i), 0.11, 0.8, 1.0, 0.95, 1.0);
    }
  }

  function lichtSetzen(p) {
    gl.uniform3fv(p.ort("uSonne"), bild.sonne);
    gl.uniform3fv(p.ort("uSonneFlach"), bild.sonneFlach);
    gl.uniform3fv(p.ort("uLicht"), morgen.licht);
    gl.uniform3fv(p.ort("uGlut"), morgen.glut);
    gl.uniform3fv(p.ort("uNebel"), morgen.nebel);
    gl.uniform3fv(p.ort("uHimmelLicht"), morgen.himmelLicht);
    gl.uniform3fv(p.ort("uAuge"), kam.auge);
    gl.uniform1f(p.ort("uDichte"), morgen.dichte);
    gl.uniform1f(p.ort("uZeit"), state.zeit);
    gl.uniform1f(p.ort("uSonneFrei"), morgen.frei);
  }

  // Alles Feste, einmal richtig herum und einmal als Spiegelbild.
  function zeichneFestes(spiegel) {
    const P = bild.prog;
    const N = bild.netz;
    gl.useProgram(P.ding.p);
    gl.uniform1f(P.ding.ort("uSpiegel"), spiegel);
    gl.uniform1f(P.ding.ort("uPegel"), 0);
    gl.uniform1f(P.ding.ort("uNicken"), 0);
    // Das Ufer: ein Netz, ohne Abzüge – Ort, Mass und Farbe sind fest.
    gl.uniform3f(P.ding.ort("uVersatz"), -kam.x, 0, -kam.z);
    gl.uniform1f(P.ding.ort("uKies"), 1);
    gl.bindVertexArray(bild.land.vao);
    gl.vertexAttrib4f(3, 0, 0, 0, 0);
    gl.vertexAttrib4f(4, 1, 1, 1, 0);
    gl.vertexAttrib4f(5, 1, 1, 1, 0);
    gl.drawArrays(gl.TRIANGLES, 0, kam.z < 90 ? bild.land.ecken : bild.land.fern);
    gl.uniform3f(P.ding.ort("uVersatz"), 0, 0, 0);
    gl.uniform1f(P.ding.ort("uKies"), 0);
    zeichneAbzug(N.boot);
    zeichneAbzug(N.holz);
    zeichneAbzug(N.ente);
    zeichneAbzug(N.kugel);
    // Der Stein spiegelt sich im Wasser, wie es an seiner Stelle steht – über
    // Wellen höher.
    gl.uniform1f(P.ding.ort("uNicken"), 1);
    gl.uniform1f(P.ding.ort("uPegel"), bild.pegel);
    zeichneAbzug(N.stein);

    // Schilf und Enten haben weiche Ränder.
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.useProgram(P.halm.p);
    gl.uniform1f(P.halm.ort("uSpiegel"), spiegel);
    gl.uniform3f(P.halm.ort("uVersatz"), -kam.x, 0, -kam.z);
    gl.uniform3f(P.halm.ort("uRechtsFlach"), kam.rechts[0], 0, kam.rechts[2]);
    zeichneAbzug(N.halm);
    gl.depthMask(false);
    gl.useProgram(P.vogel.p);
    gl.uniform1f(P.vogel.ort("uSpiegel"), spiegel);
    zeichneAbzug(N.vogel);
    gl.depthMask(true);
    gl.disable(gl.BLEND);
  }

  function zeichneWelt() {
    if (!bild.ok || !gl || gl.isContextLost()) return;
    const P = bild.prog;
    const N = bild.netz;
    morgenBei(clamp(state.z / Z_UFER, 0, 1));
    // Die Sonne geht voraus auf, ein wenig rechts.
    const hoch = morgen.sonne * Math.PI / 180;
    bild.sonne = [Math.sin(SONNEN_AZ) * Math.cos(hoch), Math.sin(hoch), Math.cos(SONNEN_AZ) * Math.cos(hoch)];
    bild.sonneFlach = [Math.sin(SONNEN_AZ), 0, Math.cos(SONNEN_AZ)];
    bild.pegel = pegelBei(state.z);
    kameraStellen();
    weltSammeln();

    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.disable(gl.CULL_FACE);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, bild.rausch);
    const punkt = 2 * kam.tan[1] / Math.max(1, view.ph);
    for (const name of ["ding", "halm", "wasser", "himmel", "fleck", "vogel"]) {
      gl.useProgram(P[name].p);
      lichtSetzen(P[name]);
      if (name !== "himmel" && name !== "vogel") gl.uniformMatrix4fv(P[name].ort("uPV"), false, kam.pv);
    }
    gl.uniformMatrix4fv(P.vogel.ort("uProj"), false, kam.proj);
    gl.uniformMatrix4fv(P.vogel.ort("uSicht"), false, kam.sicht);
    gl.uniform1f(P.vogel.ort("uPunkt"), punkt);
    gl.uniform1f(P.vogel.ort("uUhr"), state.zeit);
    gl.useProgram(P.ding.p);
    gl.uniform3fv(P.ding.ort("uZenit"), morgen.zenit);
    gl.uniform3fv(P.ding.ort("uHorizont"), morgen.horizont);
    gl.uniform2f(P.ding.ort("uKamWelt"), kam.x, kam.z);
    gl.uniform1i(P.ding.ort("uRausch"), 0);
    gl.useProgram(P.fleck.p);
    gl.uniform3fv(P.fleck.ort("uHorizont"), morgen.horizont);

    // 1. Der Himmel mit den Bergen – und unter dem Horizont ihr Spiegelbild,
    //    verbogen von allem, was das Wasser bewegt.
    gl.disable(gl.DEPTH_TEST);
    gl.depthMask(false);
    gl.disable(gl.BLEND);
    gl.useProgram(P.himmel.p);
    gl.uniform3fv(P.himmel.ort("uRechts"), kam.rechts);
    gl.uniform3fv(P.himmel.ort("uHoch"), kam.hoch);
    gl.uniform3fv(P.himmel.ort("uVor"), kam.vor);
    gl.uniform2fv(P.himmel.ort("uTan"), kam.tan);
    gl.uniform2f(P.himmel.ort("uKamWelt"), kam.x, kam.z);
    gl.uniform3fv(P.himmel.ort("uZenit"), morgen.zenit);
    gl.uniform3fv(P.himmel.ort("uHorizont"), morgen.horizont);
    gl.uniform3fv(P.himmel.ort("uWolkeHell"), morgen.wolkeHell);
    gl.uniform3fv(P.himmel.ort("uWolkeDunkel"), morgen.wolkeDunkel);
    gl.uniform3fv(P.himmel.ort("uSchnee"), morgen.schnee);
    gl.uniform3fv(P.himmel.ort("uFels"), morgen.fels);
    gl.uniform1f(P.himmel.ort("uSchatten"), morgen.schatten);
    gl.uniform1f(P.himmel.ort("uSterne"), morgen.sterne);
    gl.uniform1f(P.himmel.ort("uSonnenAz"), SONNEN_AZ);
    gl.uniform1f(P.himmel.ort("uPunkt"), punkt);
    gl.uniform1i(P.himmel.ort("uRausch"), 0);
    gl.uniform1i(P.himmel.ort("uRinge"), ringZahl);
    gl.uniform4fv(P.himmel.ort("uRing"), ringUniform);
    gl.uniform4fv(P.himmel.ort("uBand"), bandUniform);
    gl.uniform4fv(P.himmel.ort("uWoge"), wogeUniform);
    gl.bindVertexArray(bild.leer);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    // 2. Alles Feste auf dem Kopf: sein Spiegelbild. Dazu die Lichter.
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.depthMask(true);
    gl.clear(gl.DEPTH_BUFFER_BIT);
    zeichneFestes(-1);
    gl.enable(gl.BLEND);
    gl.depthMask(false);
    gl.blendFunc(gl.ONE, gl.ONE);
    gl.useProgram(P.schein.p);
    gl.uniformMatrix4fv(P.schein.ort("uProj"), false, kam.proj);
    gl.uniformMatrix4fv(P.schein.ort("uSicht"), false, kam.sicht);
    gl.uniform1f(P.schein.ort("uSpiegel"), -1);
    gl.uniform1f(P.schein.ort("uFerne"), morgen.dichte * 4);
    zeichneAbzug(N.spiegelSchein);
    gl.depthMask(true);

    // 3. Das Wasser darüber: Es lässt vom Spiegelbild stehen, was es spiegelt.
    gl.blendFunc(gl.ONE, gl.SRC_ALPHA);
    gl.useProgram(P.wasser.p);
    gl.uniform1i(P.wasser.ort("uRausch"), 0);
    gl.uniform3fv(P.wasser.ort("uTief"), morgen.tief);
    gl.uniform2f(P.wasser.ort("uKamWelt"), kam.x, kam.z);
    gl.uniform4fv(P.wasser.ort("uBand"), bandUniform);
    gl.bindVertexArray(bild.wasser);
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    // 4. Was flach darauf liegt: die Spur der Ringe, die Seerosen. Ohne
    //    Tiefenprüfung – alles, was davor steht, wird danach gezeichnet.
    gl.disable(gl.DEPTH_TEST);
    gl.depthMask(false);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.useProgram(P.fleck.p);
    zeichneAbzug(N.fleck);
    gl.enable(gl.DEPTH_TEST);
    gl.depthMask(true);
    gl.disable(gl.BLEND);

    // 5. Die Welt selbst.
    zeichneFestes(1);

    // 6. Was leuchtet, legt sein Licht dazu.
    gl.enable(gl.BLEND);
    gl.depthMask(false);
    gl.blendFunc(gl.ONE, gl.ONE);
    gl.useProgram(P.schein.p);
    gl.uniform1f(P.schein.ort("uSpiegel"), 1);
    zeichneAbzug(N.schein);

    // 7. Der Schleier vor der Sonne, über allem.
    gl.disable(gl.DEPTH_TEST);
    gl.uniform1f(P.schein.ort("uFerne"), 0);
    zeichneAbzug(N.sonne);
    gl.disable(gl.BLEND);
    gl.depthMask(true);
    gl.bindVertexArray(null);
  }

  // ---------------------------------------------------------------------------
  // Die Fläche
  // ---------------------------------------------------------------------------
  function buildPlatz() {
    feld = shell.el("div", "sh-feld");
    feld.append(canvas, hud);
    if (!bild.ok) {
      feld.append(shell.el("p", "sh-ohne", "Dieses Spiel braucht WebGL 2 – dieser Browser kann das leider nicht."));
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

  // Oben links: die Meter gross, daneben klein die Serie (oder die Hüpfer).
  function zeichneAnzeige() {
    const gross = clamp(view.cssH * 0.052, 16, 26);
    const x = 12;
    const y = 12 + view.frei;
    g.font = `900 ${Math.round(gross)}px system-ui, sans-serif`;
    const zahl = `${state.meter} m`;
    const zw = g.measureText(zahl).width;
    g.font = `800 ${Math.round(gross * 0.58)}px system-ui, sans-serif`;
    const serie = state.serie >= 2;
    const klein = serie ? `Serie ×${state.serie}` : state.huepfer ? `${state.huepfer} Hüpfer` : "";
    const kw = klein ? g.measureText(klein).width + gross * 0.7 : 0;
    const breit = gross * 1.9 + zw + kw + gross * 0.6;
    g.fillStyle = "rgba(10, 16, 28, 0.5)";
    runde(x, y, breit, gross * 1.7, gross * 0.85);
    g.fill();
    // Ein flacher Stein als Zeichen, mit seinem Spiegelbild.
    g.fillStyle = "#e6eef5";
    g.beginPath();
    g.ellipse(x + gross * 0.95, y + gross * 0.7, gross * 0.42, gross * 0.17, -0.15, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "rgba(230, 238, 245, 0.35)";
    g.beginPath();
    g.ellipse(x + gross * 0.95, y + gross * 1.14, gross * 0.42, gross * 0.13, 0.15, 0, Math.PI * 2);
    g.fill();
    g.textAlign = "left";
    g.textBaseline = "middle";
    g.font = `900 ${Math.round(gross)}px system-ui, sans-serif`;
    g.fillStyle = "#ffffff";
    g.fillText(zahl, x + gross * 1.75, y + gross * 0.9);
    if (klein) {
      g.font = `800 ${Math.round(gross * 0.58)}px system-ui, sans-serif`;
      g.fillStyle = serie ? GOLD : "rgba(255, 255, 255, 0.72)";
      g.fillText(klein, x + gross * 1.75 + zw + gross * 0.7, y + gross * 0.94);
    }
  }

  // Der Zeiger beim Ausholen: ein Bogen von «zu steil» bis «zu flach», in
  // der Mitte das goldene Stück. Vor dem ersten Druck steht er still, und
  // darunter, was zu tun ist.
  function zeichneZeiger() {
    const holt = state.schritt === "ausholen";
    if (!holt && state.schritt !== "start") return;
    if (state.phase === "zuschauen" || state.phase === "ende") return;
    const R = clamp(Math.min(view.cssW, view.cssH) * 0.2, 64, 132);
    const cx = view.cssW / 2;
    const cy = Math.min(view.cssH - 18, view.cssH * 0.93);
    const WEIT = 0.92;                // halber Winkel des Bogens
    const a = holt ? clamp(zeigerBei(state.zeit), -1, 1) : -1;
    const puls = ruhig() ? 0.8 : 0.65 + 0.3 * Math.sin(state.zeit * 3.4);
    g.lineCap = "round";
    g.lineWidth = R * 0.2;
    g.strokeStyle = "rgba(10, 16, 28, 0.55)";
    g.beginPath();
    g.arc(cx, cy, R, -Math.PI / 2 - WEIT, -Math.PI / 2 + WEIT);
    g.stroke();
    g.lineWidth = R * 0.12;
    g.strokeStyle = "rgba(255, 255, 255, 0.28)";
    g.beginPath();
    g.arc(cx, cy, R, -Math.PI / 2 - WEIT, -Math.PI / 2 + WEIT);
    g.stroke();
    // Die Mitte: Dort ist der Wurf perfekt.
    g.lineCap = "butt";
    g.strokeStyle = GOLD;
    g.beginPath();
    g.arc(cx, cy, R, -Math.PI / 2 - WEIT * WURF_MITTE * 1.15, -Math.PI / 2 + WEIT * WURF_MITTE * 1.15);
    g.stroke();
    // Der Zeiger.
    const w = -Math.PI / 2 + a * WEIT;
    g.lineCap = "round";
    g.strokeStyle = "rgba(10, 16, 28, 0.6)";
    g.lineWidth = R * 0.085;
    g.beginPath();
    g.moveTo(cx + Math.cos(w) * R * 0.5, cy + Math.sin(w) * R * 0.5);
    g.lineTo(cx + Math.cos(w) * R * 1.13, cy + Math.sin(w) * R * 1.13);
    g.stroke();
    g.strokeStyle = "#ffffff";
    g.lineWidth = R * 0.045;
    g.stroke();
    const klein = clamp(R * 0.14, 11, 15);
    g.font = `800 ${Math.round(klein)}px system-ui, sans-serif`;
    g.textBaseline = "middle";
    g.fillStyle = "rgba(255, 255, 255, 0.8)";
    g.strokeStyle = "rgba(10, 16, 28, 0.6)";
    g.lineWidth = 3;
    g.lineJoin = "round";
    for (const [s, wort] of [[-1, "zu steil"], [1, "zu flach"]]) {
      const tw = -Math.PI / 2 + s * (WEIT + 0.12);
      g.textAlign = s < 0 ? "right" : "left";
      g.strokeText(wort, cx + Math.cos(tw) * R * 1.16, cy + Math.sin(tw) * R * 1.16);
      g.fillText(wort, cx + Math.cos(tw) * R * 1.16, cy + Math.sin(tw) * R * 1.16);
    }
    if (!holt && !shell.live) {
      g.textAlign = "center";
      g.font = `900 ${Math.round(klein * 1.25)}px system-ui, sans-serif`;
      g.globalAlpha = puls;
      g.strokeText("Halten holt aus – loslassen wirft", cx, cy - R * 0.2);
      g.fillStyle = "#ffffff";
      g.fillText("Halten holt aus – loslassen wirft", cx, cy - R * 0.2);
      g.globalAlpha = 1;
    }
  }

  // Der allererste Wurf: Ein Ring zieht sich auf die Stelle zusammen, an der
  // der Stein aufsetzt – wenn er sie erreicht, tippen. Danach liest man den
  // Moment am Spiegelbild.
  function zeichneHilfe() {
    if (!state.hilfe || state.phase !== "spiel" || state.schritt !== "flug" || state.huepfer >= 3) return;
    const b = state.bogen;
    const p = imBild(0, b.yb, b.ziel);
    if (!p) return;
    const rest = b.t0 + b.T - state.zeit;
    const r0 = clamp(view.cssH * 0.035, 12, 22);
    g.lineWidth = 3;
    g.strokeStyle = "rgba(255, 255, 255, 0.85)";
    g.beginPath();
    g.ellipse(p.x, p.y, r0 * 1.6, r0 * 0.62, 0, 0, Math.PI * 2);
    g.stroke();
    const r = r0 + Math.max(0, rest) * view.cssH * 0.22;
    g.strokeStyle = `rgba(255, 215, 106, ${clamp(1.2 - rest, 0.25, 1)})`;
    g.beginPath();
    g.ellipse(p.x, p.y, r * 1.6, r * 0.62, 0, 0, Math.PI * 2);
    g.stroke();
    if (rest < 0.45) {
      g.font = `900 ${Math.round(r0 * 1.1)}px system-ui, sans-serif`;
      g.textAlign = "center";
      g.textBaseline = "top";
      g.lineWidth = 4;
      g.strokeStyle = "rgba(10, 16, 28, 0.6)";
      g.strokeText("Tippen!", p.x, p.y + r0 * 1.1);
      g.fillStyle = GOLD;
      g.fillText("Tippen!", p.x, p.y + r0 * 1.1);
    }
  }

  // Der Name des Lichts, wenn es wechselt – klein, oben, weit weg vom Stein.
  function zeichneKarte() {
    const k = state.karte;
    if (!k) return;
    const alter = state.zeit - k.seit;
    const deck = Math.min(1, alter / 0.4) * clamp((k.dauer - alter) / 0.6, 0, 1);
    if (deck <= 0) return;
    const gross = clamp(Math.min(view.cssW, view.cssH * 1.6) * 0.03, 13, 22);
    const y = view.frei + gross * 1.9;
    g.globalAlpha = deck * 0.9;
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.font = `900 ${Math.round(gross)}px system-ui, sans-serif`;
    g.lineWidth = Math.max(3, gross * 0.14);
    g.lineJoin = "round";
    g.strokeStyle = "rgba(10, 16, 28, 0.5)";
    g.strokeText(k.text, view.cssW / 2, y);
    g.fillStyle = k.farbe;
    g.fillText(k.text, view.cssW / 2, y);
    g.globalAlpha = 1;
  }

  function zeichneSchriften() {
    if (!state.schriften.length) return;
    g.textBaseline = "middle";
    g.lineJoin = "round";
    const mass = clamp(Math.min(view.cssW * 0.9, view.cssH * 1.2) / 520, 0.8, 1.4);
    const stein = imBild(state.x, Math.max(0, state.y), state.z);
    for (const s of state.schriften) {
      // Neben dem Stein (seite) oder an einem Ort der Welt.
      const p = s.seite ? stein : imBild(s.x, s.y, s.z);
      if (!p) continue;
      const k = clamp(s.leben / s.max, 0, 1);
      g.globalAlpha = Math.min(1, k * 3.2);
      g.font = `900 ${Math.round(s.gross * mass)}px system-ui, sans-serif`;
      g.lineWidth = 4;
      g.strokeStyle = "rgba(10, 16, 28, 0.6)";
      let x = p.x;
      let y = clamp(p.y - (1 - k) * 30, view.frei + 54, view.cssH - 20);
      if (s.seite) {
        const ab = clamp(view.cssW * 0.06, 40, 84);
        g.textAlign = s.seite > 0 ? "left" : "right";
        x = clamp(p.x + s.seite * ab, 8, view.cssW - 8);
        y = clamp(p.y - 4 - (1 - k) * 14, view.frei + 54, view.cssH - 20);
      } else {
        g.textAlign = "center";
      }
      g.strokeText(s.text, x, y);
      g.fillStyle = s.farbe;
      g.fillText(s.text, x, y);
    }
    g.globalAlpha = 1;
  }

  // Die Namen der Gegner an ihren Steinen (geist.js) – wer hinter der Kamera
  // hüpft, steht am unteren Rand.
  function zeichneNamen() {
    if (!geisterOrte.length || !window.LernappGeist?.namen) return;
    const liste = geisterOrte.map((o) => {
      const p = o.ziel ? imBild(state.x, Math.max(0, state.y) + 0.8, state.z) : imBild(o.spur, Math.max(0, o.b / 100) + 0.55, o.a / 10);
      return { ...o, sx: p ? p.x : view.cssW / 2, sy: p ? p.y : view.cssH + 40, weit: `${Math.max(0, Math.round(o.a / 10))} m` };
    });
    window.LernappGeist.namen(g, liste, { breit: view.cssW, hoch: view.cssH });
  }

  function zeichneHud() {
    if (!g) return;
    g.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
    g.clearRect(0, 0, view.cssW, view.cssH);
    // «Perfekt»: ein Hauch Licht über dem ganzen Bild.
    if (state.blitz > 0.01 && !ruhig()) {
      g.fillStyle = `rgba(255, 236, 190, ${0.07 * state.blitz * state.blitz})`;
      g.fillRect(0, 0, view.cssW, view.cssH);
    }
    zeichneNamen();
    zeichneHilfe();
    zeichneSchriften();
    zeichneKarte();
    zeichneZeiger();
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
  function ton(id, o = {}, pause = 60) {
    const ms = performance.now();
    if (ms - (zuletztTon.get(id) ?? -1e9) < pause) return;
    zuletztTon.set(id, ms);
    klang()?.ton?.(id, o);
  }

  // Der See am Morgen: Vögel am Ufer, leise – solange der Stein unterwegs ist.
  let kulisse = null;
  function kulisseAn() {
    kulisse = klang()?.kulisse?.("steinhuepfer.see") || null;
    kulisse?.laut?.(0.7);
  }

  function kulisseAus() {
    kulisse?.stop();
    kulisse = null;
  }

  // ---------------------------------------------------------------------------
  // Der Lauf
  // ---------------------------------------------------------------------------
  const lichtNr = (z) => {
    const k = clamp(z / Z_UFER, 0, 1);
    let nr = 0;
    while (nr < MORGEN.length - 1 && k >= MORGEN[nr + 1].k) nr += 1;
    return nr;
  };

  // Wie lange das Bild nach dem Versinken noch steht: lang genug für den
  // Blick zurück auf die Ringe, kurz nach einem frühen Ende.
  const endeDauer = () => (ruhig() ? 1.1 : 1.6 + 0.9 * clamp(state.huepfer / 8, 0, 1));

  // Ein Schritt: dt ist echte Zeit in Sekunden. Die Spielzeit läuft gleich
  // schnell – ausser im Hauch Zeitlupe nach einem perfekten Hüpfer.
  function takt(dt) {
    const faktor = 1 - 0.22 * state.lupe;
    if (state.lupe > 0) state.lupe = Math.max(0, state.lupe - dt / 0.22);
    if (state.blitz > 0) state.blitz = Math.max(0, state.blitz - dt * 3.2);
    if (state.ruck > 0) state.ruck = Math.max(0, state.ruck - dt * 4);
    const zVor = state.z;
    const tVor = state.zeit;
    const ziel = tVor + dt * faktor;
    if (state.phase === "zuschauen") {
      state.zeit = ziel;
      zuschauenTakt();
    } else {
      if (state.phase === "spiel") ablauf(ziel);
      state.zeit = ziel;
      steinBei(ziel);
    }
    const dts = ziel - tVor;
    const fliegt = state.schritt === "flug" || state.schritt === "nass";
    if (fliegt) state.dreh += dts * (9 + 0.5 * state.S);
    else if (state.schritt === "sinkt") state.dreh += dts * 2;

    // Die Libellenringe: Jetzt fliegt der Stein hindurch (oder daran vorbei).
    for (const d of state.welt.dinge) {
      if (d.art !== "ring" || (d.zustand !== "trifft" && d.zustand !== "vorbei") || d.gemeldet || state.zeit < d.wann) continue;
      d.gemeldet = true;
      if (d.zustand !== "trifft" || state.phase !== "spiel") continue;
      funken(d.z0, d.y, 16, state.bogen ? state.bogen.v : state.S);
      ruf("Schub!", "#9af4ff", 18, -1);
      ton("steinhuepfer.ring");
      kids()?.vibrate?.(12);
    }

    for (let i = state.teile.length - 1; i >= 0; i -= 1) {
      const t = state.teile[i];
      t.vy -= t.fall * dts;
      t.x += t.vx * dts;
      t.y += t.vy * dts;
      t.z += t.vz * dts;
      t.leben -= dts;
      if (t.leben <= 0 || t.y < 0) state.teile.splice(i, 1);
    }
    for (let i = state.schriften.length - 1; i >= 0; i -= 1) {
      state.schriften[i].leben -= dt;
      if (state.schriften[i].leben <= 0) state.schriften.splice(i, 1);
    }
    schmuckTakt(dts);
    kameraTakt(dts, fliegt && dts > 0 ? (state.z - zVor) / dts : 0);

    if (state.phase !== "spiel") return;
    if (fliegt) {
      // Die Meter: wie weit der Stein über den See gekommen ist – am anderen
      // Ufer ist Schluss.
      state.meter = Math.max(state.meter, Math.min(Z_UFER, Math.floor(Math.max(0, state.z))));
      const nr = lichtNr(state.z);
      if (nr !== state.licht) {
        state.licht = nr;
        state.karte = { text: MORGEN[nr].name, farbe: "#ffe9c4", dauer: 2.4, seit: state.zeit };
      }
    }
    if (state.meter !== state.punkte) {
      state.punkte = state.meter;
      shell.setCount(state.punkte);
    }
    gegner?.takt(state.punkte, { a: Math.round(state.z * 10), b: Math.round(state.y * 100), c: state.huepfer });
    const seit = state.zeit - state.schrittZeit;
    if ((state.schritt === "sinkt" && seit > endeDauer()) || (state.schritt === "ufer" && seit > 2.6)) finish();
  }

  // Die echte Zeit des letzten Bilds: Daraus folgt die Spielzeit einer Eingabe.
  const uhr = { echt: 0, faktor: 1 };

  function loop(now) {
    frame = window.requestAnimationFrame(loop);
    const sekunden = (now - last) / 1000;
    last = now;
    gueteTakt(sekunden);
    messen();
    takt(Math.min(0.05, Math.max(0, sekunden)));
    uhr.echt = now;
    uhr.faktor = 1 - 0.22 * state.lupe;
    zeichnen();
  }

  // ---------------------------------------------------------------------------
  // Zuschauen
  // ---------------------------------------------------------------------------
  // Ein aufgezeichneter Wurf über seinen eigenen See: Der Zufall hält die
  // Saat (geist.js, zuschauer), startRun würfelt damit denselben See, und der
  // Stein steht Bild für Bild dort, wo er damals war (Strecke, Höhe, Hüpfer).
  // Jeder neue Hüpfer hinterlässt seinen Ring; was gezählt wird, steht genau
  // in der Aufzeichnung.
  function zuschauenStarten() {
    if (!zuschauer?.lauf) return;
    startRun();
    state.phase = "zuschauen";
    shell.setPhase("play");
    zuschauer.los();
    kulisseAn();
  }

  function zuschauenTakt() {
    const s = zuschauer.stand();
    if (!s) return;
    const z = s.a / 10;
    const y = s.b / 100;
    const huepfer = Math.max(0, Math.round(s.c || 0));
    if (state.schritt !== "sinkt" && state.schritt !== "ufer") {
      if (z >= Z_UFER - 0.05) {
        state.schritt = "ufer";
        state.schrittZeit = state.zeit;
      } else if (y < -0.05 && z > 0) {
        state.schritt = "sinkt";
        state.schrittZeit = state.zeit;
        ringDazu(z, 0, state.zeit, 1.2);
        spritzer(z, 0, 5, 14);
        kulisseAus();
      } else if (z > HAND.z + 0.08 || huepfer > 0) {
        state.schritt = "flug";
      }
    }
    if (huepfer > state.huepfer && state.schritt === "flug") {
      ringDazu(z, 0, state.zeit, 0.9);
      spritzer(z, 0, state.S, 7);
    }
    state.huepfer = Math.max(state.huepfer, huepfer);
    if (state.schritt === "start") {
      steinBei(state.zeit);
    } else {
      state.z = Math.max(state.z, z);
      state.y = state.schritt === "ufer" ? 0.12 : y;
      state.x = HAND.x * (1 - weich(HAND.z, HAND.z + 12, state.z));
      state.S = clamp((s.va || 0) / 10, S_AUS, S_MAX);
    }
    const punkte = Math.max(0, Math.floor(s.punkte));
    if (punkte !== state.punkte) {
      state.punkte = punkte;
      state.meter = punkte;
      shell.setCount(punkte);
    }
    if (!zuschauer.weiter()) kulisseAus();
  }

  // ---------------------------------------------------------------------------
  // Halten, loslassen, tippen
  // ---------------------------------------------------------------------------
  // Die Runde beginnt mit dem ersten Druck – oder im Live-Modus zum
  // gemeinsamen Start (game-shell.js, live.los): Dann liegt der Stein in der
  // Hand, bis jemand ausholt.
  function losGehts() {
    if (state.phase !== "bereit") return;
    state.phase = "spiel";
    state.startFrist = state.zeit + START_FRIST;
    state.licht = 0;
    shell.setPhase("play");
    gegner?.los();
    kulisseAn();
    kids()?.vibrate?.(6);
  }

  // Wann ein Ereignis in der Spielzeit geschah: Das letzte Bild wurde zur
  // echten Zeit uhr.echt gerechnet und stand bei state.zeit. Der Zeitstempel
  // des Ereignisses sagt, wie lange danach der Finger kam.
  function spielzeit(event) {
    const jetzt = performance.now();
    let ms = Number(event?.timeStamp);
    if (!Number.isFinite(ms) || ms <= 0 || Math.abs(ms - jetzt) > 250) ms = jetzt;
    if (!frame) return state.zeit;
    return state.zeit + (clamp(ms - uhr.echt, -60, 120) / 1000) * uhr.faktor - VERZUG;
  }

  // Der Finger setzt auf – zur Spielzeit t.
  function fingerAb(t) {
    if (state.phase === "zuschauen" || state.phase === "ende") return;
    // Ohne Bild keine Runde (ein Browser ohne WebGL 2).
    if (!bild.ok && !bild.verloren) return;
    if (state.phase === "bereit") {
      if (shell.live) return;
      losGehts();
    }
    eingabe(t, true);
  }

  function fingerAuf(t) {
    if (state.phase !== "spiel") return;
    eingabe(t, false);
  }

  // Für die Prüfskripte und die Vorführung: halte(true) setzt den Finger auf,
  // halte(false) hebt ihn ab, tippe() beides zugleich – wahlweise zu einer
  // genauen Spielzeit, auch in der Zukunft.
  function halte(an, t = state.zeit) {
    if (an) fingerAb(t);
    else fingerAuf(t);
  }
  function tippe(t = state.zeit) {
    fingerAb(t);
    fingerAuf(t);
  }

  // ---------------------------------------------------------------------------
  // Ablauf
  // ---------------------------------------------------------------------------
  function startRun() {
    stopLoop();
    kulisseAus();
    shell.closeOverlay();
    zufall.neu();
    shell.setPhase("intro");
    Object.assign(state, {
      phase: "bereit", schritt: "start", zeit: 0, punkte: 0, meter: 0, x: HAND.x, y: HAND.y, z: HAND.z, S: 0, bogen: null,
      huepfer: 0, serie: 0, besteSerie: 0, perfekte: 0, tipp: null, verziehen: false, schrittZeit: 0, ausholSeit: 0,
      startFrist: Infinity, wurf: null, grund: "", ringe: [], teile: [], schriften: [], lupe: 0, blitz: 0, ruck: 0, dreh: 0,
      licht: 0, karte: null, sinkZ: 0, sinkY: 0, sinkV: 0,
    });
    eingaben.length = 0;
    state.welt = neueWelt();
    // Wer noch nie geworfen hat, bekommt im ersten Wurf einen Ring als Hilfe.
    state.hilfe = !(Number(store.read()?.runs) > 0);
    schmuckNeu();
    shell.setCount(0);
    gegner?.runde();

    shell.clear();
    const prompt = shell.el("p", "cm-prompt sh-prompt", "Halten holt aus, loslassen wirft. Dann tippen, wenn der Stein sein Spiegelbild trifft.");
    shell.play.append(prompt, buildPlatz());
    view.cssW = 0;
    messen();
    kameraNeu();
    steinBei(0);

    last = performance.now();
    uhr.echt = last;
    uhr.faktor = 1;
    frame = window.requestAnimationFrame(loop);
  }

  function zaehleHoch(ziel) {
    const zahl = host.querySelector(".cm-result-score");
    if (!zahl) return;
    if (ruhig() || ziel <= 1) { zahl.textContent = String(ziel); return; }
    const dauer = Math.min(700, 220 + ziel);
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
    kulisseAus();
    if (state.phase === "ende" || state.phase === "zuschauen") return;
    state.phase = "ende";
    eingaben.length = 0;
    const punkte = state.punkte;
    const geist = gegner?.ende(punkte) || null;
    const vorher = Number(store.read()?.scores?.[0]) || 0;
    const rekord = punkte > vorher;
    store.update((old) => ({
      runs: (Number(old.runs) || 0) + 1,
      scores: [...(old.scores || []), punkte].sort((x, y) => y - x).slice(0, TOP_COUNT),
    }));
    // «nach einem Hüpfer», «nach zwölf Hüpfern».
    const hupf = state.huepfer === 1 ? "einem Hüpfer" : `${state.huepfer} Hüpfern`;
    const wie = state.grund === "ufer" ? `Am anderen Ufer nach ${hupf}`
      : state.grund === "ausgehüpft" ? `Ausgehüpft nach ${hupf}`
        : `Versunken nach ${hupf}${state.grund ? ` (${state.grund})` : ""}`;
    shell.showResult({
      label: "Deine Meter",
      points: punkte,
      detail: rekord ? "Neuer Rekord!" : [wie, state.besteSerie > 1 ? `längste Serie ${state.besteSerie}` : "", vorher ? `Bestwert ${vorher} m` : ""].filter(Boolean).join(" · "),
      geist,
    });
    if (rekord) host.querySelector(".cm-result-detail")?.classList.add("sh-rekord");
    zaehleHoch(punkte);
  }

  // ---------------------------------------------------------------------------
  // Start
  // ---------------------------------------------------------------------------
  shell = shellApi.mount({
    host,
    title: "Steinhüpfer",
    area: "konzentration",
    accent: "#00A5B5",
    accentDark: "#00707c",
    clock: false,
    onRestart: () => (zuschauer ? zuschauenStarten() : startRun()),
    live: { los: losGehts, stopp: () => finish(), zuschauen: (quelle) => { zuschauer = quelle; zuschauenStarten(); } },
  });
  zuschauer = window.LernappGeist?.zuschauer?.({
    host, spiel: "stoneSkip", fassung: "t1", zufall, einheit: "Meter", nochmal: zuschauenStarten,
  }) || null;
  if (!zuschauer) {
    gegner = window.LernappGeist?.fuer?.({ spiel: "stoneSkip", host, art: "tempo", alle: true, zufall }) || null;
  }

  grafikStarten();
  startRun();
  zuschauer?.laden.then((da) => { if (da) zuschauenStarten(); });

  // Ein Finger irgendwo im Bild: halten, loslassen, tippen. Nur Knöpfe
  // bleiben Knöpfe.
  host.addEventListener("pointerdown", (event) => {
    if (event.target.closest("button, a, input")) return;
    fingerAb(spielzeit(event));
  });
  window.addEventListener("pointerup", (event) => fingerAuf(spielzeit(event)));
  window.addEventListener("pointercancel", (event) => fingerAuf(spielzeit(event)));
  // Wer das Fenster verlässt, lässt auch los.
  window.addEventListener("blur", () => fingerAuf(state.zeit));

  // Leertaste, Enter oder Pfeil nach oben: dasselbe wie der Finger.
  const TASTEN = new Set([" ", "Enter", "ArrowUp"]);
  document.addEventListener("keydown", (event) => {
    if (!TASTEN.has(event.key)) return;
    if (document.activeElement?.tagName === "BUTTON") return;
    event.preventDefault();
    if (event.repeat) return;
    fingerAb(spielzeit(event));
  });
  document.addEventListener("keyup", (event) => {
    if (TASTEN.has(event.key)) fingerAuf(spielzeit(event));
  });

  // Steht das Bild (die Tafel ist da), zeichnet eine neue Grösse es einmal neu.
  const neuMessen = () => {
    messen();
    if (!frame) zeichnen();
  };
  window.addEventListener("resize", neuMessen);
  window.addEventListener("orientationchange", neuMessen);
  window.addEventListener("pagehide", () => { stopLoop(); kulisseAus(); });

  // Für die Prüfskripte und die Vorführung. halte(true | false) und tippe()
  // nehmen wahlweise eine Spielzeit; guete(1) hält die Schärfe fest.
  window.LernappSteinhuepfer = {
    Z_UFER, HAND, AUSHOL_DAUER, AUSHOL_MAX, S_WURF, S_WURF_MIN, S_MAX, S_AUS, GNADE_BIS, RING_SCHUB,
    state, view, kam, bild, morgen, schmuck, takt, zeichnen, weltText, losGehts, halte, tippe, aufsetzZeit, mitteZeit,
    fenster, werte, bogenDauer, bogenHoehe, pegelBei, boeBei, hindernisBei, zeigerBei,
    guete(wert) {
      view.fest = wert !== null && wert !== undefined;
      if (view.fest) view.guete = clamp(Number(wert) || 1, 0.3, 1);
      view.cssW = 0;
    },
  };
})();
