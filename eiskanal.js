/*
 * eiskanal.js – Eiskanal.
 * ---------------------------------------------------------------------------
 * Eine Bobfahrt bei Nacht, aus der Sicht des Piloten: eine Rinne aus Eis im
 * Flutlicht, 1400 Meter lang, 110 Meter Gefälle. Wer links aufs Bild hält,
 * lenkt nach links, wer rechts hält, nach rechts – mehr gibt es nicht zu tun.
 *
 * Der Schlitten liegt quer in der Rinne wie eine Kugel in einer Schale: In
 * der Kurve drückt ihn die Fliehkraft die Aussenwand hinauf, die Schwerkraft
 * zieht ihn zurück in die Sohle, und dazwischen pendelt er. Lenken schiebt
 * ihn zur Seite – und kostet Tempo, denn die Kufen schaben. Auf den Geraden
 * stehen links und rechts niedrige Banden: Wer sie berührt, verliert viel
 * Tempo, und der dritte harte Schlag kippt den Bob. In den Kurven wächst die
 * Aussenwand zur Steilwand mit einer Lippe; wer über die Lippe hinausschiesst,
 * ist draussen. Am Anfang ist bis zur Lippe viel Luft, unten fast keine mehr.
 *
 * Gezählt wird die Strecke – je zehn Meter ein Punkt, 140 im Ziel – und im
 * Ziel die Zeit: Jede Zehntelsekunde unter der Richtzeit bringt Punkte dazu.
 * Tempo ist alles, und Tempo behält, wer die Kurve ruhig fährt.
 *
 * Gebaut wird die Bahn aus dem Zufall (zufall.js): ohne Turnier jedes Mal
 * eine andere, im Turnier für alle im selben Versuch dieselbe. Geraden,
 * Kurven, S-Kurven, ein Kreisel und ein Labyrinth, nach unten enger – aber
 * immer gleich lang. Wie hoch jede Wand ist, folgt aus der Bahn selbst: Sie
 * wird einmal bei vollem Tempo abgefahren, von einem Schlitten, der ruhig
 * gegen sein Pendeln lenkt (die Sollfahrt) – so hoch er kommt, plus Luft,
 * reicht die Wand. Jede Bahn ist darum ohne Bande fahrbar.
 *
 * Die Gegner (geist.js) fahren als Bob aus Licht mit, und die besten Fahrten
 * lassen sich anschauen (?zuschauen=): durch ihre eigene Bahn, gewürfelt mit
 * derselben Saat.
 *
 * Gezeichnet wird mit WebGL 2, ohne Bibliothek, wie im Schwarm (schwarm.js):
 * die Bahn als ein Netz entlang ihrer Raumkurve, alles andere als Abzüge
 * weniger Formen. Gerechnet wird in Metern; s ist die Strecke entlang der
 * Sohle, phi der Winkel am Rohr (0 in der Sohle, positiv nach rechts). Die
 * Zahlen und Namen liegen auf einer zweiten Leinwand darüber.
 */
(() => {
  "use strict";

  if (document.body.dataset.page !== "icerun") return;

  const host = document.querySelector("#ek-stage");
  const shellApi = window.LernappGameShell;
  const cloudApi = window.LernappGameCloud;
  if (!host || !shellApi) return;

  const kids = () => window.LernappKids || null;
  const klang = () => window.ArcadeKlang || null;
  const ruhig = () => Boolean(kids()?.prefersReducedMotion?.());

  // Der Zufall. Nur die Bahn zieht daraus – ihre Teile, Radien und Winkel.
  // Wo ein Baum steht und wohin ein Funke fliegt, hängt an festen Zahlen
  // oder an Math.random, damit die Bahn nicht davon abhängt, wie jemand fährt.
  const zufall = window.LernappZufall?.fuer?.("iceRun") || {
    neu() {},
    zahl: () => Math.random(),
  };

  // ---------------------------------------------------------------------------
  // Die Schrauben
  // ---------------------------------------------------------------------------
  const TAKT = 1 / 120;            // gerechnet wird in festen kleinen Schritten
  const GRAD = Math.PI / 180;
  const G = 9.81;

  // Die Bahn.
  const LAENGE = 1400;             // vom Start bis ins Ziel, in Metern
  const GEFAELLE = 110;            // so viel tiefer liegt das Ziel
  const DS = 2;                    // alle zwei Meter eine Probe der Bahn
  const S_VOR = 40;                // so viel Bahn liegt vor der Startlinie
  const S_NACH = 220;              // und so viel Auslauf hinter dem Ziel
  const S_START = -11;             // hier steht der Bob vor dem Start
  const ROHR = 2.5;                // der Radius der Rinne
  const BANDE = 42 * GRAD;         // so weit reicht das Eis auf den Geraden hinauf
  const LIPPE_MAX = 108 * GRAD;    // höher wird keine Steilwand
  const STEIL = 16 * GRAD;         // so viel über der Bande ist es eine Steilwand mit Lippe
  const TORE = [470, 940];         // die zwei Zwischenzeiten

  // Wie viel Luft zwischen der Sollfahrt (bei vollem Tempo) und der Lippe
  // bleibt: oben viel, unten wenig. Das ist die Schraube für «schwer».
  const LUFT0 = 30 * GRAD;
  const LUFT1 = 14 * GRAD;
  const LUFT_FORM = 1.5;           // wie früh es eng wird (grösser = früher)
  // Die Sollfahrt (bahnRechnen): Sie peilt die ruhige Linie ein Stück voraus
  // an, lenkt vor allem gegen den Schwung und nimmt nur einen Teil der Kraft.
  const SOLL_VORAUS = 0.25;        // so viele Sekunden schaut sie voraus
  const SOLL_LINIE = 0.95;         // so nah an die ruhige Linie will sie
  const SOLL_GEGEN = 1.2;          // so stark lenkt sie gegen den Schwung
  const SOLL_BREIT = 0.25;         // ab so viel Abstand (rad) lenkt sie voll
  const SOLL_KRAFT = 0.7;          // und so viel von der Lenkung nimmt sie höchstens
  const VORLAUF = 10;              // so viele Meter vor der Kraft steht die Wand schon
  const NACHLAUF = 34;             // und so viele bleibt sie danach noch stehen

  // Die Kurven, nach der Strecke: Radius und Länge des Übergangs.
  const RADIUS0 = 58;
  const RADIUS1 = 31;
  const UEBERGANG0 = 24;
  const UEBERGANG1 = 13;

  // Die Fahrt.
  const V_ANFANG = 3;              // so rollt der Bob aus dem Starthaus
  const V_START = 11.1;            // 40 km/h an der Startlinie
  const ANSCHUB = 4.6;             // bis dahin schiebt die Mannschaft an
  const ROLL = 0.10;               // was die Kufen immer bremsen, m/s²
  const LUFT_W = 0.00026;          // Luftwiderstand, mal v²
  const GRIFF = 0.42;              // so stark greifen die Kufen beim Lenken (mal Anpressdruck)
  const LENK_ZEIT = 0.08;          // so schnell folgt die Lenkung dem Finger
  const DAEMPFUNG = 0.3;           // wie schnell das Pendeln von selbst nachlässt
  const LENK_KOSTEN = 0.22;        // m/s² Tempo, die volles Lenken je g kostet
  const PRALL = 0.3;               // so viel vom Schwung wirft die Bande zurück
  const HART = 2.4;                // ab so vielen m/s zur Seite ist es ein harter Schlag
  const SANFT = 0.5;               // darunter schleift er nur
  const BANDE_FEST = 0.05;         // was jede Berührung vom Tempo nimmt
  const BANDE_JE = 0.035;          // und je m/s zur Seite dazu
  const BANDE_HOECHST = 0.3;
  const SCHLEIFEN = 2.2;           // m/s², solange er an der Bande schleift
  const SCHLAEGE = 3;              // der dritte harte Schlag kippt den Bob

  // Die Punkte: je zehn Meter einer, und im Ziel je Zehntelsekunde unter der
  // Richtzeit.
  const METER_JE_PUNKT = 10;
  const RICHTZEIT = 61;
  const BONUS_JE_ZEHNTEL = 5;

  const TOP_COUNT = 5;
  const store = cloudApi
    ? cloudApi.register({ key: "lernapp.eiskanal", empty: { runs: 0, scores: [] }, merge: cloudApi.mergeScores(TOP_COUNT) })
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
  const schwereBei = (s) => clamp(s / LAENGE, 0, 1);
  const luftBei = (s) => LUFT1 + (LUFT0 - LUFT1) * Math.pow(1 - schwereBei(s), LUFT_FORM);
  // Die ruhige Linie: der Winkel am Rohr, bei dem der Schlitten liegen bliebe
  // (Schwerkraft gegen Fliehkraft) – beim Tempo v, in einer Krümmung k.
  const linieBei = (v, k) => Math.atan2(-v * v * k, G);

  // Immer dieselbe Zahl zu derselben Eingabe.
  function hash01(n) {
    const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return x - Math.floor(x);
  }

  // Wie hash01, aber aus ganzen Zahlen: auf jedem Gerät dasselbe Rauschen.
  function hashGanz(n) {
    let t = (n + 0x6d2b79f5) | 0;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  // Ein weiches Auf und Ab entlang der Strecke (für Schneewälle).
  function welle(s, weit, saat) {
    const k = s / weit;
    const i = Math.floor(k);
    const u = k - i;
    return lerp(hash01(i * 3.7 + saat), hash01((i + 1) * 3.7 + saat), u * u * (3 - 2 * u));
  }

  // ---------------------------------------------------------------------------
  // Die Bahn
  // ---------------------------------------------------------------------------
  /*
   * Die Bahn ist eine Kurve im Raum, alle zwei Meter eine Probe: wo die Sohle
   * liegt (x, y, z), wohin sie zeigt (richt, im Grundriss), wie stark sie
   * sich krümmt (kr, positiv nach rechts) und wie steil sie fällt (gef).
   * Dazu, wie weit das Eis links und rechts hinaufreicht (wl, wr, als Winkel
   * am Rohr) und wie schnell man dort höchstens sein kann (vf).
   *
   *   teile    die Abschnitte in Worten: Gerade, Kurve, S-Kurve, Kreisel,
   *            Labyrinth – für weltText und die Ansage der nächsten Kurve
   *   boegen   jeder einzelne Bogen: von, bis, Seite, Radius, Winkel
   *
   * Ein Bogen krümmt sich nicht schlagartig: Über die Länge lt wächst die
   * Krümmung weich an und fällt am Ende ebenso ab. Der Winkel, um den er
   * dreht, ist Krümmung mal (Länge − lt).
   */
  const NP = Math.round((S_VOR + LAENGE + S_NACH) / DS) + 1;
  const FELDER = ["x", "y", "z", "richt", "kr", "gef", "wl", "wr", "vf", "soll"];
  const bahn = { teile: [], boegen: [], lampen: [], zier: null, frei: true, versuche: 0, nr: 0, saat: 0 };
  FELDER.forEach((name) => { bahn[name] = new Float32Array(NP); });
  const hilf = { a: new Float32Array(NP), b: new Float32Array(NP), c: new Float32Array(NP) };

  const probe = (s) => clamp((s + S_VOR) / DS, 0, NP - 1);

  // Ein Bogen: um winkel (in Grad) nach seite, mit diesem Radius.
  function bogen(liste, von, winkel, radius, lt, seite, art) {
    const rad = winkel * GRAD;
    const ueber = Math.min(lt, rad * radius);
    const lang = rad * radius + ueber;
    liste.push({ von, bis: von + lang, lt: ueber, k: seite / radius, seite, radius, winkel, art });
    return lang;
  }

  /*
   * Die Teile würfeln. Die Richtung der Bahn im Grundriss wird mitgeführt:
   * Eine Kurve dreht lieber dorthin zurück, wo die Bahn herkam, und nie
   * weiter als gut achtzig Grad davon weg – so schraubt sich die Bahn nicht
   * in sich selbst. Nur der Kreisel dreht weit herum; danach gilt die neue
   * Richtung. sicher = ohne Kreisel (wenn sich die Bahn sonst immer kreuzte).
   */
  function teileWuerfeln(sicher) {
    const teile = [];
    const boegen = [];
    let s = 0;
    let richtung = 0;      // in Grad
    let bezug = 0;
    let vorher = "";
    const kreiselBei = lerp(0.40, 0.62, zufall.zahl());
    const labyrinthBei = zufall.zahl() < 0.5 ? lerp(0.24, 0.34, zufall.zahl()) : lerp(0.68, 0.76, zufall.zahl());
    let kreisel = false;
    let labyrinthe = 0;

    const teil = (art, von, bis, mehr = {}) => { teile.push({ art, von, bis, ...mehr }); vorher = art; };
    const seiteWaehlen = () => {
      const ab = richtung - bezug;
      return zufall.zahl() < 0.5 - 0.5 * clamp(ab / 50, -1, 1) ? 1 : -1;
    };
    // Höchstens so weit, dass die Bahn nicht mehr als 82 Grad vom Bezug wegzeigt.
    const winkelBis = (seite, winkel) => Math.max(24, Math.min(winkel, 82 - seite * (richtung - bezug)));
    const radiusBei = (k) => lerp(RADIUS0, RADIUS1, Math.pow(k, 0.85));
    const ltBei = (k) => lerp(UEBERGANG0, UEBERGANG1, k);

    // Die Startgerade und eine erste, sanfte Kurve zum Kennenlernen.
    teil("gerade", 0, 62);
    s = 62;
    {
      const seite = zufall.zahl() < 0.5 ? -1 : 1;
      const winkel = lerp(36, 52, zufall.zahl());
      const von = s;
      s += bogen(boegen, s, winkel, RADIUS0 * lerp(0.95, 1.1, zufall.zahl()), UEBERGANG0, seite, "kurve");
      richtung += seite * winkel;
      teil("kurve", von, s, { seite, winkel });
      s += lerp(26, 40, zufall.zahl());
    }

    while (LAENGE - s > 82) {
      const k = s / LAENGE;
      const rest = LAENGE - s;
      const von = s;
      const R = radiusBei(k);
      const lt = ltBei(k);
      // Was jetzt kommt: der Kreisel und das Labyrinth, sobald ihre Stelle
      // erreicht ist, sonst nach Gewicht.
      let art = "";
      if (!kreisel && !sicher && k >= kreiselBei && rest > 340) art = "kreisel";
      else if (labyrinthe === 0 && k >= labyrinthBei && rest > 200) art = "labyrinth";
      else {
        const wahl = [["kurve", 3]];
        if (k > 0.08) wahl.push(["s", 1.9]);
        if (vorher !== "gerade") wahl.push(["gerade", 0.9]);
        if (k > 0.5 && labyrinthe < 2 && vorher !== "labyrinth" && rest > 230) wahl.push(["labyrinth", 0.5]);
        let los = zufall.zahl() * wahl.reduce((summe, [, gewicht]) => summe + gewicht, 0);
        for (const [name, gewicht] of wahl) {
          art = name;
          los -= gewicht;
          if (los <= 0) break;
        }
      }
      // Passt nichts Grosses mehr vor die Zielgerade, kommt eine letzte Kurve
      // genau so lang, dass 55 Meter bleiben.
      const platz = rest - 55;
      if (art === "kreisel") {
        const ab = richtung - bezug;
        const seite = ab > 6 ? -1 : ab < -6 ? 1 : (zufall.zahl() < 0.5 ? -1 : 1);
        const winkel = lerp(200, 240, zufall.zahl());
        const radius = lerp(41, 35, k) * lerp(0.96, 1.08, zufall.zahl());
        s += bogen(boegen, s, winkel, radius, 22, seite, "kreisel");
        richtung += seite * winkel;
        teil("kreisel", von, s, { seite, winkel });
        // Wer mehr als eine halbe Drehung macht, fährt zurück, woher er kam –
        // und kreuzte dort die eigene Bahn. Darum gleich die Gegenkurve: Sie
        // dreht so weit zurück, dass es quer zur alten Richtung weitergeht.
        s += lerp(16, 30, zufall.zahl());
        const gegen = winkel - lerp(92, 112, zufall.zahl());
        const vonGegen = s;
        s += bogen(boegen, s, gegen, R * lerp(1.0, 1.15, zufall.zahl()), lt, -seite, "kurve");
        richtung -= seite * gegen;
        teil("kurve", vonGegen, s, { seite: -seite, winkel: gegen });
        bezug = richtung;
        kreisel = true;
      } else if (art === "labyrinth") {
        const anzahl = 4 + Math.floor(zufall.zahl() * 3);
        let seite = seiteWaehlen();
        const radius = Math.max(29, R * lerp(0.9, 1.0, zufall.zahl()));
        for (let i = 0; i < anzahl; i += 1) {
          const winkel = lerp(20, 31, zufall.zahl());
          const kurz = lerp(13, 9, k);
          const lang = bogen(boegen, s, winkel, radius, kurz, seite, "labyrinth");
          richtung += seite * winkel;
          s += lang - kurz * 0.3;
          seite = -seite;
        }
        s += lerp(13, 9, k) * 0.3;
        labyrinthe += 1;
        teil("labyrinth", von, s, { anzahl });
      } else if (art === "s") {
        const seite = seiteWaehlen();
        const radius = R * lerp(0.9, 1.1, zufall.zahl());
        const w1 = winkelBis(seite, lerp(34, 72, zufall.zahl()));
        const l1 = bogen(boegen, s, w1, radius, lt, seite, "s");
        richtung += seite * w1;
        // Der zweite Bogen beginnt, während der erste noch ausläuft: Die
        // Krümmung kippt ohne Pause auf die andere Seite.
        s += l1 - lt * lerp(0.2, 0.6, k);
        const w2 = winkelBis(-seite, lerp(34, 72, zufall.zahl()));
        s += bogen(boegen, s, w2, radius * lerp(0.92, 1.06, zufall.zahl()), lt, -seite, "s");
        richtung -= seite * w2;
        teil("s", von, s, { seite, winkel: w1, winkel2: w2 });
      } else if (art === "gerade") {
        s += lerp(52, 28, k) * lerp(0.8, 1.3, zufall.zahl());
        teil("gerade", von, s);
      } else {
        const seite = seiteWaehlen();
        const radius = R * lerp(0.88, 1.18, zufall.zahl());
        let winkel = winkelBis(seite, lerp(40, 112, zufall.zahl()));
        if (winkel * GRAD * radius + lt > platz) winkel = Math.max(22, (platz - lt) / radius / GRAD);
        s += bogen(boegen, s, winkel, radius, lt, seite, "kurve");
        richtung += seite * winkel;
        teil("kurve", von, s, { seite, winkel });
      }
      // Ein kurzes gerades Stück zum Luftholen, nach unten immer kürzer.
      if (art !== "gerade") s += lerp(30, 9, k) * lerp(0.6, 1.4, zufall.zahl());
      // Übers Ziel hinaus gebaut (ein langes Labyrinth kurz vor Schluss):
      // dann taugt dieser Wurf nichts.
      if (s > LAENGE - 40) return null;
    }
    if (vorher === "gerade") teile[teile.length - 1].bis = LAENGE;
    else teil("gerade", s, LAENGE);
    return { teile, boegen, ganz: labyrinthe > 0 && (kreisel || sicher) };
  }

  // Wie steil ein Stück ist, nach seiner Art (vor dem Abgleich auf GEFAELLE).
  const GEFAELLE_ART = { gerade: 0.094, kurve: 0.068, s: 0.071, labyrinth: 0.076, kreisel: 0.058 };

  /*
   * Aus den Teilen die Bahn rechnen: Krümmung, Richtung, Gefälle, Ort – und
   * daraus das höchste Tempo und die Höhe der Wände. Zurück kommt, ob die
   * Bahn sich selbst frei lässt.
   */
  function bahnRechnen(wurf) {
    const { x, y, z, richt, kr, gef, wl, wr, vf } = bahn;
    kr.fill(0);
    for (const b of wurf.boegen) {
      const i0 = Math.max(0, Math.floor(probe(b.von)));
      const i1 = Math.min(NP - 1, Math.ceil(probe(b.bis)));
      for (let i = i0; i <= i1; i += 1) {
        const s = i * DS - S_VOR;
        kr[i] += b.k * weich(b.von, b.von + b.lt, s) * (1 - weich(b.bis - b.lt, b.bis, s));
      }
    }
    // Das Gefälle: nach der Art des Stücks, am Start steiler, im Auslauf
    // bergauf. Geglättet, dann so gestreckt, dass es genau GEFAELLE Meter sind.
    const roh = hilf.a;
    let t = 0;
    for (let i = 0; i < NP; i += 1) {
      const s = i * DS - S_VOR;
      while (t < wurf.teile.length - 1 && s >= wurf.teile[t].bis) t += 1;
      let g = GEFAELLE_ART[wurf.teile[t].art] || 0.07;
      if (s < 80) g = lerp(0.118, g, weich(40, 80, s));
      if (s < 0) g = lerp(0.03, 0.118, weich(-12, 0, s));
      if (s > LAENGE) g = lerp(g, -0.085, weich(LAENGE, LAENGE + 46, s));
      roh[i] = g;
    }
    const glatt = (aus, nach, halb) => {
      for (let i = 0; i < NP; i += 1) {
        let summe = 0;
        let n = 0;
        for (let j = Math.max(0, i - halb); j <= Math.min(NP - 1, i + halb); j += 1) { summe += aus[j]; n += 1; }
        nach[i] = summe / n;
      }
    };
    glatt(roh, hilf.b, 8);
    glatt(hilf.b, gef, 5);
    let faellt = 0;
    const iStart = Math.round(probe(0));
    const iZiel = Math.round(probe(LAENGE));
    for (let i = iStart; i < iZiel; i += 1) faellt += (gef[i] + gef[i + 1]) / 2 * DS;
    const strecken = GEFAELLE / faellt;
    for (let i = 0; i < NP; i += 1) if (gef[i] > 0) gef[i] *= strecken;

    // Richtung und Ort, Schritt um Schritt.
    richt[0] = 0;
    x[0] = 0; y[0] = 0; z[0] = 0;
    for (let i = 1; i < NP; i += 1) {
      richt[i] = richt[i - 1] + (kr[i - 1] + kr[i]) / 2 * DS;
      const rm = (richt[i - 1] + richt[i]) / 2;
      const gm = (gef[i - 1] + gef[i]) / 2;
      const flach = Math.sqrt(1 - gm * gm) * DS;
      x[i] = x[i - 1] + Math.sin(rm) * flach;
      z[i] = z[i - 1] + Math.cos(rm) * flach;
      y[i] = y[i - 1] - gm * DS;
    }
    // Die Startlinie liegt im Ursprung, GEFAELLE Meter über dem Ziel.
    const x0 = x[iStart], y0 = y[iStart] - GEFAELLE, z0 = z[iStart];
    for (let i = 0; i < NP; i += 1) { x[i] -= x0; y[i] -= y0; z[i] -= z0; }

    // Kommt sich die Bahn zu nahe? Zwei Stellen, die auf der Strecke weit
    // auseinanderliegen, müssen es auch im Grundriss.
    let frei = true;
    for (let i = 0; i < NP && frei; i += 3) {
      for (let j = i + 54; j < NP; j += 3) {
        const dx = x[i] - x[j];
        const dz = z[i] - z[j];
        if (dx * dx + dz * dz < 34 * 34) { frei = false; break; }
      }
    }

    // Das höchste Tempo: ohne Lenken, ohne Bande, auf dem längsten Weg.
    let v = V_START;
    for (let i = 0; i < NP; i += 1) {
      if (i <= iStart) { vf[i] = V_START; continue; }
      const weg = DS * (1 + Math.abs(kr[i - 1]) * ROHR);
      const a = G * gef[i - 1] - ROLL - LUFT_W * v * v;
      v = Math.sqrt(Math.max(16, v * v + 2 * a * weg));
      vf[i] = v;
    }

    // Die Sollfahrt: ein Schlitten bei vollem Tempo, der ruhig gegen sein
    // Pendeln lenkt – mit einem Teil der Kraft, die die Kufen hergeben, und
    // ohne je die Bande zu brauchen. Wo er fährt, steht in soll.
    const soll = bahn.soll;
    {
      let phi = 0;
      let w = 0;
      let e = 0;
      const N = 4;
      for (let i = 0; i < NP; i += 1) {
        soll[i] = phi;
        if (i < iStart || i >= NP - 1) continue;
        for (let j = 0; j < N; j += 1) {
          const u = j / N;
          const v = lerp(vf[i], vf[i + 1], u);
          const dt = DS / N / v;
          const pv = Math.min(NP - 1.001, i + u + v * SOLL_VORAUS / DS);
          const iv = Math.floor(pv);
          const voraus = lerp(kr[iv], kr[iv + 1], pv - iv);
          const lenk = clamp((linieBei(v, voraus) * SOLL_LINIE - phi - SOLL_GEGEN * w) / SOLL_BREIT, -1, 1) * SOLL_KRAFT;
          e += (lenk - e) * (1 - Math.exp(-dt / LENK_ZEIT));
          const ac = v * v * lerp(kr[i], kr[i + 1], u);
          const geff = Math.hypot(G, ac);
          const om = Math.sqrt(geff / ROHR);
          w += (om * om * (GRIFF * e - Math.sin(phi - Math.atan2(-ac, G))) - 2 * DAEMPFUNG * om * w) * dt;
          phi += w * dt;
        }
      }
    }

    // Die Wände: so hoch, wie die Sollfahrt hinaufkommt, plus Luft – oben
    // viel, unten wenig. Sie stehen schon vor der Kurve und bleiben danach
    // noch stehen; dazwischen und auf den Geraden die Bande.
    const lRoh = hilf.a;
    const rRoh = hilf.b;
    for (let i = 0; i < NP; i += 1) {
      const s = i * DS - S_VOR;
      const luft = luftBei(s);
      const hoch = (lage) => clamp(lage + luft * weich(3 * GRAD, 12 * GRAD, lage), BANDE, LIPPE_MAX);
      lRoh[i] = hoch(-soll[i]);
      rRoh[i] = hoch(soll[i]);
      // Käme die Sollfahrt höher, als eine Wand reicht, bliebe weniger Luft
      // als versprochen: Dann taugt dieser Wurf nichts.
      if (Math.abs(soll[i]) + luft > LIPPE_MAX) frei = false;
    }
    const weiten = (aus, nach) => {
      const vor = Math.round(VORLAUF / DS);
      const zurueck = Math.round(NACHLAUF / DS);
      for (let i = 0; i < NP; i += 1) {
        let m = BANDE;
        for (let j = Math.max(0, i - zurueck); j <= Math.min(NP - 1, i + vor); j += 1) if (aus[j] > m) m = aus[j];
        hilf.c[i] = m;
      }
      glatt(hilf.c, nach, 4);
      glatt(nach, hilf.c, 3);
      for (let i = 0; i < NP; i += 1) nach[i] = Math.max(hilf.c[i], aus[i]);
    };
    weiten(lRoh, wl);
    weiten(rRoh, wr);
    return frei;
  }

  /*
   * Eine neue Bahn: würfeln, bis sie sich nicht kreuzt, Kreisel und Labyrinth
   * hat und keine Wand höher sein müsste, als sie sein kann. Das gelingt fast
   * immer in den ersten Würfen; nach vierzig vergeblichen kommt eine ohne
   * Kreisel, die sich nicht kreuzen kann. Alle Würfe ziehen aus demselben
   * Zufall – im Turnier bekommen alle dieselbe Bahn.
   */
  function neueBahn() {
    let wurf = null;
    let frei = false;
    let versuche = 0;
    while (versuche < 70 && !frei) {
      versuche += 1;
      const neu = teileWuerfeln(versuche > 40);
      // Jede Bahn hat ihren Kreisel und ihr Labyrinth.
      if (!neu || !neu.ganz) continue;
      wurf = neu;
      frei = bahnRechnen(wurf);
    }
    bahn.teile = wurf.teile;
    bahn.boegen = wurf.boegen;
    bahn.frei = frei;
    bahn.versuche = versuche;
    bahn.nr += 1;
    bahn.saat = hashGanz(Math.round(bahn.x[NP - 1] * 100) + Math.round(bahn.z[NP - 1] * 7)) * 1000;
    lampenStellen();
    zierStellen();
  }

  // Eine Stelle der Bahn, zwischen zwei Proben – in ort, ohne neue Objekte.
  const ort = { x: 0, y: 0, z: 0, richt: 0, k: 0, gef: 0, wl: 0, wr: 0, vf: 0, soll: 0 };
  function bahnBei(s, o = ort) {
    const p = probe(s);
    const i = Math.min(NP - 2, Math.floor(p));
    const u = p - i;
    o.x = bahn.x[i] + (bahn.x[i + 1] - bahn.x[i]) * u;
    o.y = bahn.y[i] + (bahn.y[i + 1] - bahn.y[i]) * u;
    o.z = bahn.z[i] + (bahn.z[i + 1] - bahn.z[i]) * u;
    o.richt = bahn.richt[i] + (bahn.richt[i + 1] - bahn.richt[i]) * u;
    o.k = bahn.kr[i] + (bahn.kr[i + 1] - bahn.kr[i]) * u;
    o.gef = bahn.gef[i] + (bahn.gef[i + 1] - bahn.gef[i]) * u;
    o.wl = bahn.wl[i] + (bahn.wl[i + 1] - bahn.wl[i]) * u;
    o.wr = bahn.wr[i] + (bahn.wr[i + 1] - bahn.wr[i]) * u;
    o.vf = bahn.vf[i] + (bahn.vf[i + 1] - bahn.vf[i]) * u;
    o.soll = bahn.soll[i] + (bahn.soll[i + 1] - bahn.soll[i]) * u;
    return o;
  }

  /*
   * Ein Punkt im Querschnitt der Bahn: quer (nach rechts) und hoch über der
   * Sohle, an der Stelle s. Zurück kommt der Ort in der Welt (in o), dazu die
   * drei Richtungen dort: rechts (r), oben (u), voraus (t).
   */
  const stelle = { x: 0, y: 0, z: 0, richt: 0, k: 0, gef: 0, wl: 0, wr: 0, vf: 0 };
  function imQuerschnitt(s, quer, hoch, o) {
    const b = bahnBei(s, stelle);
    const st = Math.sin(b.richt);
    const ct = Math.cos(b.richt);
    const sp = b.gef;
    const cp = Math.sqrt(1 - sp * sp);
    o.rx = ct; o.ry = 0; o.rz = -st;
    o.ux = st * sp; o.uy = cp; o.uz = ct * sp;
    o.tx = st * cp; o.ty = -sp; o.tz = ct * cp;
    o.x = b.x + quer * o.rx + hoch * o.ux;
    o.y = b.y + hoch * o.uy;
    o.z = b.z + quer * o.rz + hoch * o.uz;
    o.richt = b.richt;
    return o;
  }

  // Ein Punkt auf dem Eis beim Winkel phi, um ab über dem Eis (zur Achse des
  // Rohrs hin). n ist die Richtung vom Eis weg.
  function aufEis(s, phi, ab, o) {
    const sf = Math.sin(phi);
    const cf = Math.cos(phi);
    imQuerschnitt(s, (ROHR - ab) * sf, ROHR - (ROHR - ab) * cf, o);
    o.nx = -sf * o.rx + cf * o.ux;
    o.ny = cf * o.uy;
    o.nz = -sf * o.rz + cf * o.uz;
    return o;
  }

  // Die Flutlichter: alle LAMPE_AB Meter eines, mitten über der Bahn. Der
  // Mast steht auf der Geraden abwechselnd links und rechts, in der Kurve
  // innen – aussen ist die Steilwand.
  const LAMPE_AB = 24;
  const LAMPE_HOCH = 5.6;
  function lampenStellen() {
    bahn.lampen.length = 0;
    const p = {};
    for (let n = Math.ceil(-S_VOR / LAMPE_AB); n * LAMPE_AB < LAENGE + S_NACH - 4; n += 1) {
      const s = n * LAMPE_AB;
      imQuerschnitt(s, 0, LAMPE_HOCH, p);
      const k = bahnBei(s).k;
      const seite = Math.abs(k) > 0.004 ? (k > 0 ? 1 : -1) : (n % 2 ? 1 : -1);
      bahn.lampen.push({ s, x: p.x, y: p.y, z: p.z, richt: p.richt, seite });
    }
  }

  // Die gewürfelte Bahn in Worten. Im Turnier bekommen alle denselben Text.
  function weltText() {
    const KURZ = { gerade: "G", kurve: "K", s: "S", kreisel: "O", labyrinth: "L" };
    return bahn.teile.map((t) => {
      const seite = t.seite ? (t.seite > 0 ? "r" : "l") : "";
      const winkel = t.winkel ? Math.round(t.winkel) : t.anzahl || "";
      return `${KURZ[t.art]}${Math.round(t.von)}${seite}${winkel}`;
    }).join(" ") + ` | ${bahn.boegen.length} Bögen, unten ${Math.round(bahn.vf[Math.round(probe(LAENGE))] * 3.6)} km/h`;
  }

  // ---------------------------------------------------------------------------
  // Zustand
  // ---------------------------------------------------------------------------
  // phase:   "bereit" (noch nichts gedrückt), "spiel", "zuschauen", "ende"
  // schritt: "start" (der Bob steht im Starthaus), "fahrt", "ziel", "sturz"
  const state = {
    phase: "bereit",
    schritt: "start",
    punkte: 0,
    s: S_START,           // die Strecke entlang der Sohle
    v: 0,                 // das Tempo, m/s
    phi: 0,               // die Lage quer in der Rinne: der Winkel am Rohr
    w: 0,                 // und wie schnell sie sich ändert
    e: 0,                 // die Lenkung, wie sie gerade steht (-1 … 1)
    lenk: 0,              // der Finger: -1 links, 1 rechts
    q: 0,                 // die Lage von -1 (linker Rand) bis 1 (rechter Rand)
    zeit: 0,              // seit dem Aufbau der Runde
    fahrzeit: 0,          // seit der Startlinie
    meter: 0,
    schlaege: 0,          // harte Bandenschläge
    beruehrt: 0,          // alle Berührungen
    schleift: 0,          // schleift gerade an der Bande (klingt aus)
    bonus: 0,
    zielzeit: 0,
    angekommen: false,
    ursache: "",          // warum der Bob gestürzt ist: "lippe" oder "bande"
    sturzSeite: 0,
    tore: [0, 0],         // die Zwischenzeiten dieser Fahrt
    torNr: 0,
    vMax: 0,
    bahn,
    teile: [],
    karte: null,
    stoss: 0,
    blitz: 0,
    schrittZeit: 0,
    flug: 0,              // über die Lippe hinaus: wie weit schon
    kipp: 0,              // der Bob liegt auf der Seite
  };

  let shell = null;
  let feld = null;
  let canvas = null;       // WebGL: die Welt
  let hud = null;          // 2D: Zahlen und Namen darüber
  let g = null;
  let frame = null;
  let last = 0;
  // Die Gegner (geist.js): wer als Bob aus Licht mitfährt.
  let gegner = null;
  // Wer eine Fahrt anschaut statt zu fahren (geist.js, zuschauer).
  let zuschauer = null;

  function stopLoop() {
    if (frame) { window.cancelAnimationFrame(frame); frame = null; }
  }

  // Die Zwischenzeiten der besten Fahrt auf diesem Gerät: An den Toren steht,
  // ob man vorn liegt (grün) oder zurück (rot). Die Bahn ist jedes Mal eine
  // andere, aber immer gleich lang und gleich steil – das lässt sich vergleichen.
  const ZEITEN_KEY = "lernapp.eiskanal.zeiten";
  function besteZeiten() {
    try {
      const d = JSON.parse(localStorage.getItem(ZEITEN_KEY) || "null");
      if (d && Array.isArray(d.tore)) return { punkte: Number(d.punkte) || 0, tore: d.tore.map((t) => Number(t) || 0), ziel: Number(d.ziel) || 0 };
    } catch { /* privat oder kaputt: dann ohne Vergleich */ }
    return null;
  }
  function merkeZeiten(punkte) {
    const alt = besteZeiten();
    if (alt && alt.punkte >= punkte) return;
    try {
      localStorage.setItem(ZEITEN_KEY, JSON.stringify({ punkte, tore: state.tore.map((t) => Math.round(t * 100) / 100), ziel: Math.round(state.zielzeit * 100) / 100 }));
    } catch { /* privat: dann eben nicht */ }
  }
  let vergleich = null;

  // ---------------------------------------------------------------------------
  // Die Fahrt
  // ---------------------------------------------------------------------------
  /*
   * Quer in der Rinne ist der Schlitten ein Pendel. Schwerkraft (nach unten)
   * und Fliehkraft (v² mal Krümmung, nach aussen) geben zusammen den
   * Anpressdruck geff und die ruhige Linie: den Winkel, bei dem er liegen
   * bliebe (linieBei). Um sie pendelt er, je mehr Druck, desto schneller.
   * Lenken verschiebt ihn um einen festen Teil des Drucks (GRIFF) – in einer
   * schnellen Kurve greifen die Kufen also stärker, kosten aber auch mehr.
   *
   * Wer aussen hoch an der Wand fährt, fährt den längeren Weg: Die Strecke
   * entlang der Sohle wächst dort langsamer.
   */

  function physik(dt) {
    const b = bahnBei(state.s);
    const v = state.v;
    const ac = v * v * b.k;
    const geff = Math.hypot(G, ac);
    const om = Math.sqrt(geff / ROHR);
    state.e += (state.lenk - state.e) * (1 - Math.exp(-dt / LENK_ZEIT));
    const linie = Math.atan2(-ac, G);
    const wpp = om * om * (GRIFF * state.e - Math.sin(state.phi - linie)) - 2 * DAEMPFUNG * om * state.w;
    state.w += wpp * dt;
    state.phi += state.w * dt;

    // Der Rand: links oder rechts, Bande oder Lippe.
    let bremst = 0;
    const seite = state.phi > b.wr ? 1 : state.phi < -b.wl ? -1 : 0;
    if (seite) {
      const grenze = seite > 0 ? b.wr : b.wl;
      if (grenze > BANDE + STEIL) {
        sturz("lippe", seite);
        return;
      }
      state.phi = seite * grenze;
      const quer = seite * state.w * ROHR;
      if (quer > SANFT) schlag(quer, seite);
      else bremst = SCHLEIFEN;
      if (state.schritt !== "fahrt") return;
      if (quer > 0) state.w = -state.w * PRALL;
      if (bremst) state.schleift = 1;
    }

    let a = G * b.gef - ROLL - LUFT_W * v * v - LENK_KOSTEN * Math.abs(state.e) * geff / G - bremst;
    if (state.s < 0 && v < V_START) a += ANSCHUB;
    // (state.v, nicht v: Ein Bandenschlag eben hat das Tempo schon gekürzt.)
    state.v = Math.max(2, state.v + a * dt);
    const sVor = state.s;
    state.s += state.v * dt / (1 - b.k * ROHR * Math.sin(state.phi));
    if (sVor < 0) return;
    // Die Zeit läuft ab der Startlinie – und hält im Ziel auf die Hundertstel
    // genau an, auch wenn die Linie mitten in einem Schritt liegt.
    if (state.s >= LAENGE) {
      state.fahrzeit += dt * (LAENGE - sVor) / (state.s - sVor);
      ziel();
      return;
    }
    state.fahrzeit += dt;
    while (state.torNr < TORE.length && state.s >= TORE[state.torNr]) tor(state.torNr);
  }

  // Die Bande: Tempo weg, und ab HART zählt es als Schlag.
  function schlag(quer, seite) {
    const verlust = clamp(BANDE_FEST + BANDE_JE * quer, 0, BANDE_HOECHST);
    state.v *= 1 - verlust;
    state.beruehrt += 1;
    const hart = quer > HART;
    if (hart) state.schlaege += 1;
    if (state.phase === "spiel") {
      state.stoss = Math.min(1, state.stoss + (hart ? 0.8 : 0.35));
      if (hart) state.blitz = 1;
      funken(seite, hart ? 26 : 10);
      ton("eiskanal.bande", { laut: hart ? 1.1 : 0.6 }, 140);
      kids()?.vibrate?.(hart ? [24, 30, 24] : 12);
      if (hart && state.schlaege < SCHLAEGE) {
        karte(state.schlaege === SCHLAEGE - 1 ? "Letzte Warnung" : "Bande!", `${state.schlaege} von ${SCHLAEGE} harten Schlägen`, "#ff9a7a", 1.5);
      }
    }
    if (hart && state.schlaege >= SCHLAEGE) sturz("bande", seite);
  }

  // Ein Tor mit Zwischenzeit: gegen die eigene beste Fahrt.
  function tor(nr) {
    state.tore[nr] = state.fahrzeit;
    state.torNr = nr + 1;
    if (state.phase !== "spiel") return;
    const alt = vergleich?.tore?.[nr] || 0;
    const zeitText = `${state.fahrzeit.toFixed(2)} s`;
    if (alt > 0) {
      const d = state.fahrzeit - alt;
      karte(`${d <= 0 ? "−" : "+"}${Math.abs(d).toFixed(2)}`, `${nr + 1}. Zwischenzeit · ${zeitText}`, d <= 0 ? "#7dffa8" : "#ff8f7a", 2.2);
    } else {
      karte(zeitText, `${nr + 1}. Zwischenzeit`, "#ffffff", 2.0);
    }
  }

  // Im Ziel: Jede Zehntelsekunde unter der Richtzeit zählt.
  const bonusFuer = (zeit) => Math.max(0, Math.floor((RICHTZEIT - zeit) * 10 + 1e-6)) * BONUS_JE_ZEHNTEL;

  function ziel() {
    state.schritt = "ziel";
    state.schrittZeit = state.zeit;
    state.angekommen = true;
    state.zielzeit = state.fahrzeit;
    state.s = Math.max(state.s, LAENGE);
    state.lenk = 0;
    if (state.phase !== "spiel") return;
    state.bonus = bonusFuer(state.zielzeit);
    state.punkte = Math.floor(LAENGE / METER_JE_PUNKT) + state.bonus;
    shell.setCount(state.punkte);
    const alt = vergleich?.ziel || 0;
    const d = alt > 0 ? ` (${state.zielzeit <= alt ? "−" : "+"}${Math.abs(state.zielzeit - alt).toFixed(2)})` : "";
    karte(`${state.zielzeit.toFixed(2)} s`, `Im Ziel${d} · Zeitbonus +${state.bonus}`, "#ffd76a", 3.2);
    klang()?.ton?.("meilenstein");
    kids()?.vibrate?.([20, 40, 20]);
  }

  // Über die Lippe hinaus oder der dritte harte Schlag: Der Bob kippt.
  function sturz(ursache, seite) {
    if (state.schritt === "sturz") return;
    state.schritt = "sturz";
    state.schrittZeit = state.zeit;
    state.ursache = ursache;
    state.sturzSeite = seite;
    state.lenk = 0;
    kulisseAus();
    if (state.phase !== "spiel") return;
    state.stoss = 1;
    state.blitz = 1;
    funken(seite, 34);
    karte(ursache === "lippe" ? "Über die Lippe!" : "Gekippt!", ursache === "lippe" ? "Zu hoch in der Steilwand" : "Der dritte harte Bandenschlag", "#ff9a7a", 2.2);
    ton("eiskanal.sturz", { laut: 1 }, 400);
    kids()?.vibrate?.([30, 40, 60]);
  }

  // Nach Ziel oder Sturz: ausrollen. Im Ziel bremst der Auslauf bergauf, und
  // der Bob gleitet zur Mitte; beim Sturz rutscht er noch ein Stück.
  function ausrollen(dt) {
    const seit = state.zeit - state.schrittZeit;
    if (state.schritt === "ziel") {
      const b = bahnBei(state.s);
      state.v = Math.max(0, state.v + (G * b.gef - 3.2 - 0.0012 * state.v * state.v) * dt);
      state.s = Math.min(LAENGE + S_NACH - 30, state.s + state.v * dt);
      state.w += (-9 * state.phi - 4 * state.w) * dt;
      state.phi += state.w * dt;
      state.e *= Math.exp(-dt / 0.2);
    } else if (state.schritt === "sturz") {
      const bremse = state.ursache === "lippe" ? 14 : 22;
      state.v = Math.max(0, state.v - bremse * dt);
      state.s = Math.min(LAENGE + S_NACH - 30, state.s + state.v * dt);
      state.e *= Math.exp(-dt / 0.1);
      if (state.ursache === "lippe") {
        // Hinaus und hinauf, dabei dreht er sich.
        state.flug += dt * (2.5 + state.v * 0.12);
        state.kipp += dt * 3.4 * state.sturzSeite * Math.max(0.2, 1 - seit * 0.4);
      } else {
        // Auf die Seite, und zurück in die Sohle.
        state.kipp += (state.sturzSeite * 1.75 - state.kipp) * (1 - Math.exp(-dt / 0.25));
        state.w += (-7 * state.phi - 3 * state.w) * dt;
        state.phi += state.w * dt;
        if (state.v > 3 && state.phase !== "bereit" && Math.random() < dt * 40) funken(state.sturzSeite, 1);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Teilchen und die Karte
  // ---------------------------------------------------------------------------
  // Funken an der Bande: Sie sprühen dort, wo der Bob anschlägt, ein Stück
  // voraus – so sieht man sie aus dem Schlitten.
  const funkenOrt = {};
  const funkenBahn = {};
  function funken(seite, anzahl) {
    if (ruhig()) anzahl = Math.ceil(anzahl / 3);
    if (state.teile.length > 220) return;
    const b = bahnBei(state.s + 2.2, funkenBahn);
    const phi = seite * ((seite > 0 ? b.wr : b.wl) - 0.05);
    for (let i = 0; i < anzahl; i += 1) {
      aufEis(state.s + 1.4 + Math.random() * 2.2, phi, 0.08 + Math.random() * 0.2, funkenOrt);
      const o = funkenOrt;
      const vor = state.v * (0.55 + Math.random() * 0.4);
      const ab = 1 + Math.random() * 5;
      state.teile.push({
        x: o.x, y: o.y, z: o.z,
        vx: o.tx * vor + o.nx * ab + (Math.random() - 0.5) * 3,
        vy: o.ty * vor + o.ny * ab + Math.random() * 2.5,
        vz: o.tz * vor + o.nz * ab + (Math.random() - 0.5) * 3,
        fall: 9, r: 0.05 + Math.random() * 0.07, farbe: [1.0, 0.62 + Math.random() * 0.3, 0.2], leben: 0.25 + Math.random() * 0.45, max: 0.7, hart: 1.2,
      });
    }
  }

  // Eiskristalle: Sie stieben von den Kufen, wenn gelenkt wird – und immer
  // ein wenig, wenn es schnell geht.
  function kristalle(dt) {
    if (state.schritt !== "fahrt" || state.teile.length > 260) return;
    const schnell = clamp(state.v / 38, 0, 1);
    const rate = (ruhig() ? 0.3 : 1) * (24 * schnell * schnell + 150 * Math.abs(state.e) * schnell + 90 * state.schleift);
    let n = rate * dt;
    while (n > 0) {
      if (n < 1 && Math.random() > n) break;
      n -= 1;
      // Dort, wohin die Kufen das Eis werfen: auf der Seite, zu der gelenkt wird.
      const seite = state.e > 0.15 ? -1 : state.e < -0.15 ? 1 : (Math.random() < 0.5 ? -1 : 1);
      aufEis(state.s + 1.2 + Math.random() * 1.6, state.phi + seite * (0.14 + Math.random() * 0.1), 0.04, funkenOrt);
      const o = funkenOrt;
      const vor = state.v * (0.72 + Math.random() * 0.2);
      const hoch = 0.6 + Math.random() * 2.6;
      const quer = seite * (1 + Math.random() * 3.5);
      state.teile.push({
        x: o.x, y: o.y, z: o.z,
        vx: o.tx * vor + o.nx * hoch + o.rx * quer,
        vy: o.ty * vor + o.ny * hoch,
        vz: o.tz * vor + o.nz * hoch + o.rz * quer,
        fall: 3, r: 0.012 + Math.random() * 0.022, farbe: [0.75, 0.9, 1.0], leben: 0.25 + Math.random() * 0.4, max: 0.65, hart: 2.6,
      });
    }
  }

  // Die Schrift mitten im Bild: Zwischenzeit, Schlag, Ziel.
  function karte(gross, klein, farbe = "#ffffff", dauer = 2.4) {
    state.karte = { gross, klein, farbe, dauer, seit: state.zeit };
  }

  // ---------------------------------------------------------------------------
  // Die Kamera
  // ---------------------------------------------------------------------------
  // Im Schlitten, knapp über dem Eis, mit Blick voraus in die Bahn. Sie rollt
  // mit der Lage in der Rinne: In der Steilwand steht der Horizont fast
  // senkrecht. Die Welt wird relativ zu ihr gezeichnet (das Auge ist der
  // Ursprung): So rechnet die Grafikkarte überall mit kleinen Zahlen.
  const AUGE = 0.8;               // so hoch sitzt der Pilot über dem Eis
  const view = { cssW: 0, cssH: 0, dpr: 1, frei: 0, pw: 0, ph: 0, guete: 1, fest: false, langsam: 0, schnell: 0 };
  const kam = {
    x: 0, y: 0, z: 0, fov: 1, seit: 1, phi: 0, lenk: 0,
    rechts: [1, 0, 0], hoch: [0, 1, 0], vor: [0, 0, 1], tan: [1, 1],
    proj: new Float32Array(16), projNah: new Float32Array(16), sicht: new Float32Array(16),
    pv: new Float32Array(16), pvNah: new Float32Array(16),
    vx: 0, vy: 0, vz: 0,   // wie schnell sie sich durch die Welt bewegt
  };
  const kamA = {};
  const kamB = {};

  function kameraTakt(dt) {
    // Die Lage folgt dem Schlitten ohne Verzug; nur die Haube lenkt weich mit.
    kam.phi = state.phi;
    kam.lenk += (state.e - kam.lenk) * (1 - Math.exp(-dt / 0.1));
  }

  function projektion(p, fov, seit, nah, fern) {
    const f = 1 / Math.tan(fov / 2);
    p.fill(0);
    p[0] = f / seit; p[5] = f; p[10] = (fern + nah) / (nah - fern); p[11] = -1; p[14] = (2 * fern * nah) / (nah - fern);
  }

  function mal(aus, p, s) {
    for (let c = 0; c < 4; c += 1) {
      for (let r = 0; r < 4; r += 1) {
        aus[c * 4 + r] = p[r] * s[c * 4] + p[4 + r] * s[c * 4 + 1] + p[8 + r] * s[c * 4 + 2] + p[12 + r] * s[c * 4 + 3];
      }
    }
  }

  function kameraStellen() {
    const seit = view.cssW / Math.max(1, view.cssH);
    const still = ruhig();
    const fahrt = state.schritt === "fahrt" || state.schritt === "ziel";
    const schnell = clamp((state.v - V_START) / 28, 0, 1);
    // 64 Grad in der Höhe – auf einem sehr breiten Bild weniger (zur Seite
    // höchstens 84), hochkant mehr (zur Seite mindestens 58). Mit dem Tempo
    // wird der Blick weiter.
    const grad = Math.PI / 180;
    let fov = 64 * grad;
    fov = Math.min(fov, 2 * Math.atan(Math.tan(42 * grad) / seit));
    fov = Math.max(fov, Math.min(1.75, 2 * Math.atan(Math.tan(29 * grad) / seit)));
    fov *= 1 + (still ? 0.04 : 0.15) * schnell * (fahrt ? 1 : 0.5);
    kam.fov = fov;
    kam.seit = seit;

    // Das Auge: über dem Eis, wo der Schlitten liegt. Beim Sturz über die
    // Lippe hebt es ab.
    // Hochkant sitzt das Auge höher: Sonst füllte das Cockpit das untere Drittel.
    const hochkant = clamp((1.2 - seit) / 0.7, 0, 1);
    const hoch = AUGE + 0.15 * hochkant + state.flug * 0.9;
    const phi = kam.phi + (state.flug ? state.sturzSeite * Math.min(0.5, state.flug * 0.08) : 0);
    const A = aufEis(state.s, phi, hoch, kamA);
    // Der Blick: ein Stück voraus in die Bahn, etwas tiefer an der Wand als
    // der Schlitten – so sieht man in die Kurve hinein.
    // In der Kurve kürzer: Sonst schaute die Kamera so weit die Wand hinauf,
    // dass die Haube aus dem Bild fiele.
    const kr = Math.abs(bahnBei(state.s + 6, kamB).k);
    const weit = (7 + state.v * 0.34) / (1 + kr * (7 + state.v * 0.34) * 1.3);
    const Z = aufEis(state.s + weit, phi * 0.8, AUGE * 0.55, kamB);
    let fx = Z.x - A.x;
    let fy = Z.y - A.y;
    let fz = Z.z - A.z;
    // Hochkant schaut die Kamera weiter voraus statt aufs Eis vor der Haube.
    const heben = lerp(0.05, 0.2, hochkant);
    fx += A.nx * heben * weit; fy += A.ny * heben * weit; fz += A.nz * heben * weit;
    let fl = Math.hypot(fx, fy, fz) || 1;
    fx /= fl; fy /= fl; fz /= fl;
    // Oben ist, wohin das Eis unter dem Schlitten zeigt – ein wenig weniger
    // gerollt als der Schlitten selbst, und ruhiger, wer es ruhig will.
    const rollen = still ? 0.45 : 0.86;
    const O = aufEis(state.s, phi * rollen, 0, kamB);
    let ux = O.nx, uy = O.ny, uz = O.nz;
    // Es rüttelt mit dem Tempo, und ein Schlag wirft die Kamera herum.
    const t = state.zeit;
    const ruettel = still ? 0 : (0.004 + 0.012 * schnell * schnell) * (fahrt ? 1 : 0) + 0.05 * state.stoss + 0.012 * state.schleift;
    const kippen = state.kipp + (still ? 0 : (Math.sin(t * 47) * 0.6 + Math.sin(t * 31.7) * 0.4) * ruettel * 0.5);
    if (kippen) {
      // Um die Blickrichtung drehen.
      const c = Math.cos(kippen), sn = Math.sin(kippen);
      const kx = fy * uz - fz * uy, ky = fz * ux - fx * uz, kz = fx * uy - fy * ux;
      const d = fx * ux + fy * uy + fz * uz;
      ux = ux * c + kx * sn + fx * d * (1 - c);
      uy = uy * c + ky * sn + fy * d * (1 - c);
      uz = uz * c + kz * sn + fz * d * (1 - c);
    }
    // rechts = oben × vor, hoch = vor × rechts (x zeigt im Bild nach rechts).
    let rx = uy * fz - uz * fy;
    let ry = uz * fx - ux * fz;
    let rz = ux * fy - uy * fx;
    const rl = Math.hypot(rx, ry, rz) || 1;
    rx /= rl; ry /= rl; rz /= rl;
    const hx = fy * rz - fz * ry;
    const hy = fz * rx - fx * rz;
    const hz = fx * ry - fy * rx;
    const ax = (Math.sin(t * 61) * 0.5 + Math.sin(t * 38.3) * 0.5) * ruettel;
    const ay = Math.sin(t * 53.1) * ruettel;
    const ex = A.x + rx * ax + hx * ay;
    const ey = A.y + ry * ax + hy * ay;
    const ez = A.z + rz * ax + hz * ay;
    kam.rechts = [rx, ry, rz];
    kam.hoch = [hx, hy, hz];
    kam.vor = [fx, fy, fz];
    kam.tan = [Math.tan(fov / 2) * seit, Math.tan(fov / 2)];
    kam.x = ex; kam.y = ey; kam.z = ez;
    // So schnell zieht die Welt vorbei (für den Schneefall).
    kam.vx = A.tx * state.v; kam.vy = A.ty * state.v; kam.vz = A.tz * state.v;
    const s = kam.sicht;
    s[0] = rx; s[4] = ry; s[8] = rz; s[12] = 0;
    s[1] = hx; s[5] = hy; s[9] = hz; s[13] = 0;
    s[2] = -fx; s[6] = -fy; s[10] = -fz; s[14] = 0;
    s[3] = 0; s[7] = 0; s[11] = 0; s[15] = 1;
    projektion(kam.proj, fov, seit, 0.25, 2600);
    projektion(kam.projNah, fov, seit, 0.04, 12);
    mal(kam.pv, kam.proj, s);
    mal(kam.pvNah, kam.projNah, s);
  }

  // Wo ein Punkt der Welt im Bild steht (in CSS-Pixeln) – oder null, wenn er
  // hinter der Kamera liegt.
  function imBild(x, y, z) {
    const px = x - kam.x;
    const py = y - kam.y;
    const pz = z - kam.z;
    const m = kam.pv;
    const w = m[3] * px + m[7] * py + m[11] * pz + m[15];
    if (w <= 0.01) return null;
    const cx = (m[0] * px + m[4] * py + m[8] * pz + m[12]) / w;
    const cy = (m[1] * px + m[5] * py + m[9] * pz + m[13]) / w;
    return { x: (cx * 0.5 + 0.5) * view.cssW, y: (0.5 - cy * 0.5) * view.cssH, w };
  }

  // ---------------------------------------------------------------------------
  // Zeichnen: die Programme
  // ---------------------------------------------------------------------------
  let gl = null;
  const bild = { ok: false, verloren: false, prog: {}, netz: {}, rausch: null, tafeln: null, leer: null, bahn: null, schilder: null, bob: null, bahnNr: -1 };

  // Die Nacht: der Mond voraus und rechts, sein Licht, das Licht des Himmels,
  // der Dunst und die Farbe der Flutlichter.
  const MOND = [0.486, 0.53, 0.695];
  const MOND_LICHT = [0.30, 0.38, 0.55];
  const HIMMEL_LICHT = [0.045, 0.07, 0.13];
  const NEBEL = [0.035, 0.065, 0.125];
  const FLUT = [0.86, 0.94, 1.0];
  const DICHTE = 1 / 330;

  // Was alle Programme über das Licht wissen. Alle Orte sind relativ zur
  // Kamera (das Auge ist der Ursprung).
  const LICHT = `
    uniform vec3 uMond, uMondLicht, uHimmelLicht, uNebel, uFlut;
    uniform float uDichte, uZeit;
    uniform vec4 uLampe[6];
    const vec3 ZENIT = vec3(0.008, 0.017, 0.052);
    const vec3 HORIZONT = vec3(0.065, 0.125, 0.24);
    // Erst der Dunst, dann die Belichtung: Helles läuft weich aus, statt
    // weiss auszufressen.
    vec3 dunst(vec3 farbe, vec3 ort) {
      vec3 c = mix(uNebel, farbe, exp(-length(ort) * uDichte));
      return 1.0 - exp(-c * 1.55);
    }
    // Der Himmel grob, für Spiegelungen: Verlauf, ein Hauch Nordlicht, Mond.
    vec3 himmelGrob(vec3 r) {
      float h = max(r.y, 0.0);
      vec3 c = mix(HORIZONT, ZENIT, 1.0 - pow(1.0 - h, 3.0));
      float nord = smoothstep(-0.3, 0.7, r.z) * smoothstep(0.05, 0.3, h) * (1.0 - smoothstep(0.5, 0.9, h));
      c += vec3(0.1, 0.6, 0.35) * nord * 0.22;
      c += uMondLicht * pow(max(dot(r, uMond), 0.0), 60.0) * 1.2;
      return c;
    }
    // Das Licht der nächsten Flutlichter an einem Ort. rund: wie weit es um
    // die Kante greift (0 hart, 1 ganz herum).
    vec3 flutlicht(vec3 ort, vec3 n, float rund) {
      vec3 summe = vec3(0.0);
      for (int i = 0; i < 6; i++) {
        vec3 d = uLampe[i].xyz - ort;
        float d2 = dot(d, d);
        summe += uFlut * uLampe[i].w * max((dot(n, d) * inversesqrt(d2) + rund) / (1.0 + rund), 0.0) / (1.0 + d2 * 0.03);
      }
      return summe;
    }
  `;

  // Der Himmel: ein Dreieck über das ganze Bild. Aus der Blickrichtung jedes
  // Punkts entstehen der Verlauf der Nacht, Sterne, Mond mit Hof, Nordlicht
  // und die Berge – und unter dem Horizont das Tal mit seinen Lichtern.
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
    uniform vec3 uRechts, uHoch, uVor, uKamOrt;
    uniform vec2 uTan;
    uniform sampler2D uRausch;
    ${LICHT}
    float wuerfel(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    void main() {
      vec3 d = normalize(uVor + vBild.x * uTan.x * uRechts + vBild.y * uTan.y * uHoch);
      float h = d.y;
      float hh = max(h, 0.0);
      float az = atan(d.x, d.z);

      // Die Nacht: am Horizont ein blauer Schimmer, oben fast schwarz.
      vec3 c = mix(HORIZONT, ZENIT, 1.0 - pow(1.0 - hh, 3.2));

      // Sterne, grosse und kleine, und ein heller Streifen quer darüber.
      vec3 q = d * 150.0;
      vec3 zelle = floor(q);
      float z = fract(sin(dot(zelle, vec3(127.1, 311.7, 74.7))) * 43758.5453);
      float stern = step(0.982, z) * smoothstep(0.45, 0.04, length(fract(q) - 0.5));
      float strasse = smoothstep(0.35, 0.75, texture(uRausch, vec2(az * 0.16 + d.y * 0.5, d.y * 0.4 + az * 0.1)).r);
      c += mix(vec3(0.72, 0.84, 1.0), vec3(1.0, 0.9, 0.74), fract(z * 91.7)) * stern * (0.35 + 2.2 * pow(fract(z * 57.3), 3.0) + 0.5 * strasse)
        * smoothstep(0.02, 0.22, hh) * (0.7 + 0.3 * sin(uZeit * 2.6 + z * 60.0));
      c += vec3(0.02, 0.03, 0.055) * strasse * smoothstep(0.1, 0.5, hh);

      // Das Nordlicht: zwei Vorhänge, unten scharf, nach oben verwehend.
      float nord = smoothstep(-0.35, 0.6, d.z / max(length(d.xz), 1e-3));
      for (int i = 0; i < 2; i++) {
        float f = float(i);
        float lauf = texture(uRausch, vec2(az * (0.33 + 0.21 * f) + uZeit * 0.005 + f * 0.37, 0.4 + f * 0.3)).r;
        float fuss = 0.09 + 0.1 * f + 0.2 * lauf;
        float strahl = texture(uRausch, vec2(az * (2.3 + f) - uZeit * 0.011, hh * 0.22 + 0.7 * f)).a;
        float form = smoothstep(fuss - 0.012, fuss + 0.02, hh) * exp(-(hh - fuss) * (5.0 + 3.0 * f));
        vec3 farbe = mix(vec3(0.12, 1.0, 0.5), vec3(0.42, 0.22, 0.9), clamp((hh - fuss) * 3.2, 0.0, 1.0));
        c += farbe * form * (0.3 + 1.2 * strahl * strahl) * nord * (0.52 - 0.2 * f);
      }

      // Der Mond: Scheibe, enger und weiter Schein – und der Hof aus Eiskristallen.
      float zm = max(dot(d, uMond), 0.0);
      c += uMondLicht * (pow(zm, 30.0) * 0.16 + pow(zm, 700.0) * 0.8 + 0.07 * exp(-pow((zm - 0.927) / 0.006, 2.0)));
      float scheibe = smoothstep(0.99962, 0.99977, zm);
      c = mix(c, vec3(0.95, 0.96, 0.9) * (0.75 + 0.4 * texture(uRausch, d.xy * 11.0).r), scheibe);

      // Berge: eine ferne Kette im Mondlicht, davor dunkle, bewaldete Rücken.
      float fern = 0.028 + 0.115 * pow(texture(uRausch, vec2(az * 0.19 + 0.31, 0.21)).r, 1.4) + 0.028 * texture(uRausch, vec2(az * 1.5, 0.63)).a;
      float hang = texture(uRausch, vec2(az * 0.9 + 0.13, h * 2.2 + 0.3)).r + 0.25 * texture(uRausch, vec2(az * 3.7, h * 9.0)).a;
      vec3 cFern = mix(vec3(0.04, 0.065, 0.125), vec3(0.17, 0.25, 0.4), smoothstep(0.5, 0.8, hang) * smoothstep(0.0, 0.05, h));
      c = mix(c, mix(cFern, HORIZONT, 0.35 * smoothstep(0.06, 0.0, h)), smoothstep(fern + 0.003, fern - 0.003, h));
      float nahe = 0.004 + 0.062 * pow(texture(uRausch, vec2(az * 0.41 + 0.72, 0.58)).r, 1.3) + 0.012 * texture(uRausch, vec2(az * 3.1, 0.11)).a;
      vec3 cNah = mix(vec3(0.012, 0.022, 0.045), vec3(0.045, 0.075, 0.13), smoothstep(0.45, 0.7, texture(uRausch, vec2(az * 1.7, h * 6.0)).r));
      c = mix(c, cNah, smoothstep(nahe + 0.002, nahe - 0.002, h));

      // Unter dem Horizont: das Tal. Schneefelder, Wald, und die Lichter der
      // Dörfer – sie rücken näher, je tiefer die Bahn führt.
      {
        float tief = uKamOrt.y + 230.0;
        float weit = tief / max(-h, 0.012);
        vec2 gp = uKamOrt.xz + d.xz * weit;
        float feld = texture(uRausch, gp * 0.0008).r;
        float wald = smoothstep(0.42, 0.6, texture(uRausch, gp * 0.0027 + 0.3).a);
        vec3 tal = mix(vec3(0.05, 0.08, 0.14), vec3(0.012, 0.02, 0.036), wald) * (0.65 + 0.7 * feld);
        float dorf = smoothstep(0.5, 0.74, texture(uRausch, gp * 0.00037 + 0.11).r) * (1.0 - 0.75 * wald);
        vec2 gz = gp / 26.0;
        vec2 zz = floor(gz);
        float w1 = wuerfel(zz);
        float fein = max(fwidth(gz.x), fwidth(gz.y));
        vec2 f = fract(gz) - 0.5 - (vec2(w1, fract(w1 * 7.3)) - 0.5) * 0.5;
        float punkt = smoothstep(0.14 + fein, 0.01, length(f)) * smoothstep(1.3, 0.4, fein) * step(1.0 - 0.6 * dorf, fract(w1 * 31.7));
        vec3 warm = mix(vec3(1.0, 0.68, 0.32), vec3(0.75, 0.88, 1.0), step(0.86, fract(w1 * 13.7)));
        tal += warm * punkt * (1.2 + 0.5 * sin(uZeit * 3.0 + w1 * 40.0)) + vec3(1.0, 0.62, 0.28) * dorf * 0.05;
        tal = mix(HORIZONT * 0.85, tal, exp(-weit * 0.0004));
        c = mix(c, tal, smoothstep(0.0, -0.012, h));
      }

      // Ein Hauch Rauschen gegen Streifen im Verlauf.
      c += (fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) / 200.0;
      aus = vec4(c, 1.0);
    }`;

  /*
   * Die Bahn: ein Netz entlang der ganzen Strecke, einmal je Runde gebaut.
   * Jede Ecke weiss, wo sie im Querschnitt liegt (quer, hoch), wohin ihre
   * Fläche dort zeigt, und woraus sie ist (Stoff): Eis, Bande oder Lippe,
   * Schnee, Dach – dazu die Tafeln am Rand (Pfeile, Meter, Tore).
   *
   * Die Flutlichter hängen alle uLampeMass.x Meter mitten über der Bahn. Wo
   * die nächsten drei sind, folgt darum aus der Strecke allein: Licht und
   * Glanz entstehen je Bildpunkt, ohne dass ein Licht übergeben wird. Auf
   * dem Eis ist der Glanz in Fahrtrichtung gestreckt (die Kufenrillen) – so
   * ziehen die Lichter als lange Streifen über die Wände.
   */
  const BAHN_VS = `#version 300 es
    layout(location = 0) in vec4 aOrt;    // x, y, z in der Welt, Strecke
    layout(location = 1) in vec4 aQuer;   // quer, hoch, Richtung der Fläche (quer, hoch)
    layout(location = 2) in vec4 aMehr;   // Richtung der Bahn, Stoff, zwei Zahlen je Stoff
    layout(location = 3) in vec2 aZus;    // wie steil die Wand auf dieser Seite ist, –
    uniform mat4 uPV;
    uniform vec3 uKam;
    out vec3 vOrt;
    out vec4 vQuer;
    out vec3 vBlick;
    out vec2 vRechts;
    out float vS;
    flat out float vStoff;
    out vec2 vPar;
    out vec2 vZus;
    void main() {
      vec3 w = aOrt.xyz - uKam;
      float c = cos(aMehr.x), s = sin(aMehr.x);
      // Der Blick zum Auge, in den Richtungen der Bahn: quer, hoch, voraus.
      vBlick = vec3(-(w.x * c - w.z * s), -w.y, -(w.x * s + w.z * c));
      vRechts = vec2(c, -s);
      vOrt = w;
      vQuer = aQuer;
      vS = aOrt.w;
      vStoff = aMehr.y;
      vPar = aMehr.zw;
      vZus = aZus;
      gl_Position = uPV * vec4(w, 1.0);
    }`;
  const BAHN_FS = `#version 300 es
    precision highp float;
    in vec3 vOrt;
    in vec4 vQuer;
    in vec3 vBlick;
    in vec2 vRechts;
    in float vS;
    flat in float vStoff;
    in vec2 vPar;
    in vec2 vZus;
    out vec4 aus;
    uniform sampler2D uRausch, uTafeln;
    uniform vec3 uLampeMass;      // Abstand, Höhe, Kraft
    uniform float uWarn;
    ${LICHT}
    // Die nächsten drei Flutlichter: ihr Licht auf der Fläche (zurück) und
    // ihr Glanz (glanz), mit dem Glanz in Fahrtrichtung um lang gestreckt.
    float lampen(vec3 n, vec3 v, vec3 lage, float scharf, float lang, float rund, out float glanz) {
      float i0 = floor(lage.z / uLampeMass.x + 0.5);
      float licht = 0.0;
      glanz = 0.0;
      for (int k = -1; k <= 1; k++) {
        vec3 d = vec3(-lage.x, uLampeMass.y - lage.y, (i0 + float(k)) * uLampeMass.x - lage.z);
        float d2 = dot(d, d);
        vec3 l = d * inversesqrt(d2);
        // Ein Flutlicht strahlt nach unten: unter ihm eine helle Insel,
        // zwischen zweien wird es dunkel – das gibt der Fahrt ihren Takt.
        float kraft = uLampeMass.z * (0.12 + 0.88 * pow(max(l.y, 0.0), 1.7)) / (1.0 + d2 * 0.03);
        licht += max((dot(n, l) + rund) / (1.0 + rund), 0.0) * kraft;
        vec3 hv = l + v;
        hv.z *= lang;
        glanz += pow(max(dot(n, normalize(hv)), 0.0), scharf) * kraft;
      }
      return licht;
    }
    vec3 werbung(float z) {
      // Fünf Farben für die Werbestreifen – ohne Schrift, ohne Marken.
      if (z < 0.2) return vec3(0.96, 0.45, 0.06);
      if (z < 0.4) return vec3(0.05, 0.5, 0.85);
      if (z < 0.6) return vec3(0.85, 0.1, 0.3);
      if (z < 0.8) return vec3(0.95, 0.78, 0.1);
      return vec3(0.1, 0.65, 0.5);
    }
    void main() {
      // Die Tafeln schauen zum Start; alles andere hat seine Richtung im Querschnitt.
      bool tafel = vStoff > 3.5;
      vec3 n = tafel ? vec3(0.0, 0.0, -1.0) : normalize(vec3(vQuer.zw, 0.0));
      vec3 v = normalize(vBlick);
      // Von aussen gesehen? Die Tafeln fragen ihre Richtung, das Netz der
      // Bahn die Seite seiner Dreiecke – die stimmt auch dort, wo die Bahn
      // bergauf führt und die Richtung im Querschnitt allein täuschte.
      bool hinten = tafel ? dot(n, v) < 0.0 : gl_FrontFacing;
      if (dot(n, v) < 0.0) n = -n;
      vec3 nW = vec3(n.x * vRechts.x, n.y, n.x * vRechts.y);
      vec3 vW = normalize(-vOrt);
      vec3 lage = vec3(vQuer.xy, vS);
      vec3 grund = uHimmelLicht * (0.55 + 0.45 * nW.y) + uMondLicht * max(dot(nW, uMond), 0.0) * 0.55;
      float glanz;
      vec3 c;
      if (vStoff < 0.5) {
        // --- Eis ---
        if (hinten) {
          // Von aussen ist die Wand ein dunkler Bau aus Holz und Beton.
          float licht = lampen(n, v, lage, 8.0, 1.0, 0.3, glanz);
          c = vec3(0.09, 0.085, 0.09) * (grund * 1.6 + uFlut * licht);
        } else {
          float phi = vPar.x;
          float rand = vPar.y;
          float schliere = texture(uRausch, vec2(vS * 0.0045, phi * 0.6)).r;
          float rillen = texture(uRausch, vec2(vS * 0.023, phi * 4.6)).a;
          float reif = texture(uRausch, vec2(vS * 0.13, phi * 1.4)).r;
          // Unten dunkles, blankes Eis; erst zum Rand hin liegt Reif.
          float matt = smoothstep(0.5, 1.05, rand + (reif - 0.5) * 0.55);
          vec3 blank = mix(vec3(0.02, 0.09, 0.19), vec3(0.08, 0.3, 0.48), schliere);
          vec3 eis = mix(blank, vec3(0.46, 0.66, 0.84), matt * 0.75) * (0.62 + 0.76 * rillen);
          // Wo die Schlitten vor uns gefahren sind, ist das Eis blank poliert:
          // zwei feine Spuren entlang der ruhigen Linie.
          float spur = smoothstep(0.03, 0.006, abs(abs(phi - vZus.y) - 0.115)) * (1.0 - matt);
          eis *= 1.0 - 0.45 * spur;
          // Alle paar Meter eine Fuge quer durchs Eis: Sie fliegen vorbei.
          float fuge = smoothstep(0.03, 0.0, 0.5 - abs(fract(vS / 4.0) - 0.5)) * smoothstep(0.45, 0.08, fwidth(vS));
          eis *= 1.0 - 0.3 * fuge;
          float licht = lampen(n, v, lage, mix(170.0, 26.0, matt), 0.2, 0.25, glanz);
          c = eis * (grund * 1.6 + uFlut * licht);
          // Blankes Eis spiegelt: den Himmel, und die Flutlichter als Streifen.
          float nv = max(dot(n, v), 0.0);
          float fresnel = 0.03 + 0.97 * pow(1.0 - nv, 4.0);
          c += himmelGrob(reflect(-vW, nW)) * fresnel * (1.0 - 0.7 * matt) * 1.3;
          c += uFlut * glanz * (1.0 - 0.7 * matt) * (0.35 + 1.3 * rillen + spur) * 1.5;
          // Eiskristalle blitzen im Flutlicht auf, einer hier, einer dort.
          float nahe = smoothstep(0.35, 0.05, fwidth(vS));
          float kristall = smoothstep(0.86, 0.97, texture(uRausch, vec2(vS * 0.61, phi * 7.3) + v.xz * 0.11).r);
          c += uFlut * kristall * licht * 0.55 * nahe;
          // Unter dem Sonnensegel hängt eine Lichterkette: Sie färbt die Wand warm.
          c += eis * vec3(1.0, 0.62, 0.28) * vZus.x * smoothstep(0.25, 1.0, rand) * 0.8;
          // Unter der Lippe glüht ihr Licht auf dem Eis.
          c += vec3(1.0, 0.36, 0.08) * vZus.x * pow(rand, 16.0) * (0.25 + 0.9 * uWarn);
        }
      } else if (vStoff < 1.5) {
        // --- Bande (auf der Geraden) oder Lippe (in der Kurve) ---
        float hoehe = vPar.x;
        float lippe = vZus.x;
        float licht = lampen(n, v, lage, 30.0, 1.0, 0.35, glanz);
        float block = floor(vS / 6.0);
        float w = fract(sin(block * 91.7) * 43758.5453);
        float im = fract(vS / 6.0);
        float streifen = step(0.2, hoehe) * step(hoehe, 0.82) * step(0.06, im) * step(im, 0.94) * step(0.3, w);
        float schraeg = step(0.5, fract((vS + hoehe * 0.5) * 1.6)) * step(im, 0.28);
        vec3 brett = mix(vec3(0.82, 0.87, 0.93), mix(werbung(fract(w * 7.7)), vec3(0.95), schraeg * 0.85), streifen);
        brett = mix(brett, vec3(0.86, 0.91, 0.97), smoothstep(1.02, 1.12, hoehe));
        vec3 wulst = mix(vec3(0.07, 0.08, 0.1), vec3(0.8, 0.86, 0.94), smoothstep(1.05, 1.2, hoehe));
        c = mix(brett, wulst, lippe) * (grund * 1.5 + uFlut * licht) + uFlut * glanz * 0.12;
        // Das Lichtband der Lippe: Es warnt – und pulsiert, wenn es knapp wird.
        float band = smoothstep(0.25, 0.42, hoehe) * (1.0 - smoothstep(0.8, 0.98, hoehe));
        c += vec3(1.0, 0.34, 0.06) * lippe * band * (1.5 + 2.2 * uWarn * (0.6 + 0.4 * sin(uZeit * 22.0)));
        if (hinten || hoehe > 1.5) c = vec3(0.1, 0.1, 0.11) * (grund * 1.5 + uFlut * licht);
      } else if (vStoff < 2.5) {
        // --- Schnee ---
        vec4 korn = texture(uRausch, vec2(vS, vQuer.x) * 0.045);
        float duene = texture(uRausch, vec2(vS, vQuer.x) * 0.009).r;
        vec3 ns = normalize(n + vec3((korn.g - 0.5) * 0.7, 0.0, (korn.b - 0.5) * 0.7));
        float licht = lampen(ns, v, lage, 12.0, 1.0, 0.45, glanz);
        vec3 nsW = vec3(ns.x * vRechts.x, ns.y, ns.x * vRechts.y);
        vec3 schnee = mix(vec3(0.42, 0.52, 0.7), vec3(0.62, 0.71, 0.86), duene);
        c = schnee * (uHimmelLicht * (0.8 + 0.5 * nsW.y) + uMondLicht * max(dot(nsW, uMond), 0.0) * 0.8 + uFlut * licht * 0.75);
        // Einzelne Körner blitzen im Flutlicht.
        float funkel = step(0.965, texture(uRausch, vec2(vS, vQuer.x) * 0.73 + v.xy * 0.07).a);
        c += uFlut * funkel * licht * 0.9;
      } else if (vStoff < 3.5) {
        // --- Das Sonnensegel über der Steilwand: Tuch zwischen Bögen, von
        //     unten angestrahlt ---
        float licht = lampen(n, v, lage, 6.0, 1.0, 0.8, glanz);
        float bogen = smoothstep(0.455, 0.48, abs(fract(vS / 3.0) - 0.5));
        float falte = 0.5 + 0.5 * sin(vS * 2.094 * 4.0);
        float saum = smoothstep(0.9, 0.99, vPar.x) + smoothstep(0.06, 0.0, vPar.x);
        // Bahn um Bahn im Wechsel hell und dunkel: Sie fliegen vorbei.
        float bahn = step(0.5, fract(vS / 6.0));
        vec3 tuch = mix(vec3(0.46, 0.52, 0.62), vec3(0.1, 0.17, 0.32), bahn) * (0.8 + 0.2 * falte);
        // Die Lichterkette an seinem Saum leuchtet das Tuch von unten warm an.
        vec3 kette = vec3(1.0, 0.6, 0.28) * (0.12 + 0.6 * vPar.x * vPar.x) * vZus.x;
        c = mix(tuch, vec3(0.05, 0.055, 0.07), max(bogen, saum)) * (grund * 1.6 + uFlut * licht * 0.6 + kette);
        if (hinten) c *= 0.5;
      } else if (vStoff < 4.5) {
        // --- Pfeile vor der Kurve: Sie laufen in ihre Richtung ---
        float x = vQuer.w > 0.0 ? vPar.x : 1.0 - vPar.x;
        float y = abs(vPar.y - 0.5) * 2.0;
        float nr = floor(x * 3.0);
        float d = abs(fract(x * 3.0) - 0.74 + y * 0.44);
        float an = smoothstep(0.17, 0.12, d) * step(y, 0.84);
        float lauf = 0.5 + 0.5 * sin(uZeit * 10.0 - nr * 1.7);
        vec3 farbe = mix(vec3(1.0, 0.82, 0.16), vec3(1.0, 0.22, 0.08), vQuer.z);
        float rahmen = max(step(0.94, y), step(0.975, abs(vPar.x - 0.5) * 2.0));
        c = vec3(0.012, 0.015, 0.025) + farbe * (an * (0.6 + 1.6 * lauf) + rahmen * 0.5);
        if (hinten) c = vec3(0.03, 0.03, 0.04);
      } else {
        // --- Tafeln mit Schrift: Meter, Start, Zwischenzeit, Ziel ---
        vec3 t = texture(uTafeln, vPar).rgb;
        c = t * 1.25 + t * uFlut * 0.2;
        if (hinten) c = vec3(0.03, 0.03, 0.04);
      }
      aus = vec4(dunst(c, vOrt), 1.0);
    }`;

  // Alles Feste neben der Bahn: Tannen, Masten, Lampen, Tore, Pfosten. Ein
  // Netz je Form, viele Male gezeichnet – jedes Mal mit Ort, Grösse, Drehung
  // und Farbe. Ein negatives Leuchten heisst: Auf allem, was nach oben
  // schaut, liegt Schnee (die Tannen).
  const DING_VS = `#version 300 es
    layout(location = 0) in vec3 aOrt;
    layout(location = 1) in vec3 aNorm;
    layout(location = 2) in vec4 iOrt;    // x, y, z, Drehung um die Hochachse
    layout(location = 3) in vec4 iMass;   // Breite, Höhe, Tiefe, Drehung um die Fahrtrichtung
    layout(location = 4) in vec4 iFarbe;  // Farbe, eigenes Leuchten
    uniform mat4 uPV;
    out vec3 vOrt;
    out vec3 vNorm;
    out vec4 vFarbe;
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
    out vec4 aus;
    ${LICHT}
    void main() {
      vec3 n = normalize(vNorm);
      vec3 v = normalize(-vOrt);
      vec3 farbe = vFarbe.rgb;
      if (vFarbe.a < 0.0) farbe = mix(farbe, vec3(0.72, 0.8, 0.92), smoothstep(0.15, 0.6, n.y) * -vFarbe.a);
      vec3 licht = uHimmelLicht * (0.55 + 0.45 * n.y) + uMondLicht * max(dot(n, uMond), 0.0) * 0.6 + flutlicht(vOrt, n, 0.35);
      vec3 c = farbe * licht + farbe * max(vFarbe.a, 0.0);
      // Gegenlicht: An den Rändern fängt sich das Mondlicht.
      c += uMondLicht * 0.12 * pow(1.0 - abs(dot(n, v)), 3.0) * (0.4 + 0.6 * n.y);
      aus = vec4(dunst(c, vOrt), 1.0);
    }`;

  // Der Bob: die eigene Haube unten im Bild – und die Gegner als Bob aus
  // Licht (uGeist). Ein Netz mit runden Flächen; im Lack spiegeln sich die
  // Flutlichter und wandern über die Haube, so schnell wie die Fahrt.
  const BOB_VS = `#version 300 es
    layout(location = 0) in vec3 aOrt;
    layout(location = 1) in vec3 aNorm;
    layout(location = 2) in vec4 aFarbe;  // Farbe, Glanz (2 und 3: die Hände am Lenkseil)
    uniform mat4 uPV;
    uniform mat3 uBasis;
    uniform vec3 uVersatz;
    uniform float uLenk;
    out vec3 vOrt;
    out vec3 vNorm;
    out vec4 vFarbe;
    out vec3 vImBob;
    void main() {
      vec3 p = aOrt;
      vImBob = aOrt;
      if (aFarbe.a > 1.5) p.z += (aFarbe.a > 2.5 ? uLenk : -uLenk) * 0.06;
      vec3 w = uVersatz + uBasis * p;
      vOrt = w;
      vNorm = uBasis * aNorm;
      vFarbe = aFarbe;
      gl_Position = uPV * vec4(w, 1.0);
    }`;
  const BOB_FS = `#version 300 es
    precision highp float;
    in vec3 vOrt;
    in vec3 vNorm;
    in vec4 vFarbe;
    in vec3 vImBob;
    out vec4 aus;
    uniform vec4 uGeist;
    ${LICHT}
    void main() {
      vec3 n = normalize(vNorm);
      vec3 v = normalize(-vOrt);
      float nv = abs(dot(n, v));
      if (uGeist.a > 0.0) {
        // Ein Bob aus Licht: die Ränder hell, die Flächen ein Hauch.
        aus = vec4(uGeist.rgb * (0.16 + 0.95 * pow(1.0 - nv, 2.0)) * uGeist.a * exp(-length(vOrt) * uDichte), 1.0);
        return;
      }
      float lack = min(vFarbe.a, 1.0);
      vec3 farbe = vFarbe.rgb;
      // Über die Haube laufen zwei helle Streifen bis zur Nase.
      if (vFarbe.a > 0.98 && vFarbe.a < 0.995) {
        float ab = abs(abs(vImBob.x) - 0.034);
        farbe = mix(vec3(0.82, 0.82, 0.78), farbe, smoothstep(0.012, 0.016, ab));
      }
      vec3 c = farbe * (uHimmelLicht * (0.6 + 0.4 * n.y) + uMondLicht * max(dot(n, uMond), 0.0) * 0.6 + flutlicht(vOrt, n, 0.3));
      vec3 r = reflect(-v, n);
      vec3 spiegel = himmelGrob(r) * 0.8;
      for (int i = 0; i < 6; i++) {
        vec3 d = uLampe[i].xyz - vOrt;
        float d2 = dot(d, d);
        float rd = max(dot(r, d * inversesqrt(d2)), 0.0);
        spiegel += uFlut * uLampe[i].w * (pow(rd, 420.0) * 7.0 + pow(rd, 40.0) * 0.22) / (1.0 + d2 * 0.006);
      }
      c += spiegel * lack * (0.16 + 0.84 * pow(1.0 - nv, 3.0));
      aus = vec4(1.0 - exp(-c * 1.55), 1.0);
    }`;

  // Der Schneefall: Flocken in einem Kasten um die Kamera, der sich mit ihr
  // durch die Welt schiebt (jede Flocke bleibt dabei an ihrem Ort). Je
  // schneller die Fahrt, desto länger zieht jede ihren Strich – und hell ist
  // sie nur im Schein der Flutlichter.
  const FLOCKE_VS = `#version 300 es
    layout(location = 0) in vec2 aEcke;
    layout(location = 1) in vec4 iSaat;   // drei Zufallszahlen für den Ort, eine für alles andere
    uniform mat4 uProj, uSicht;
    uniform vec3 uKam, uFahrt, uKasten;
    uniform float uBelichtung;
    ${LICHT}
    out vec2 vEcke;
    out float vHell;
    void main() {
      float z = iSaat.w;
      vec3 fall = vec3(0.7 + 0.5 * sin(z * 40.0), -1.5 - z, 0.4 * cos(z * 23.0));
      fall.xz += 0.35 * vec2(sin(uZeit * 1.3 + z * 60.0), cos(uZeit * 1.1 + z * 37.0));
      vec3 w = fract(iSaat.xyz + (fall * uZeit - uKam) / uKasten) * uKasten - 0.5 * uKasten;
      float hell = 0.05;
      for (int i = 0; i < 6; i++) {
        vec3 d = uLampe[i].xyz - w;
        hell += uLampe[i].w / (1.0 + dot(d, d) * 0.045);
      }
      // Der Strich: von dort, wo die Flocke eben war, bis dorthin, wo sie ist.
      vec3 a = (uSicht * vec4(w, 1.0)).xyz;
      vec3 b = a - (uSicht * vec4(fall - uFahrt, 0.0)).xyz * uBelichtung;
      vec3 mitte = mix(a, b, 0.5);
      vec3 lang = b - a;
      vec3 quer = cross(lang, mitte);
      float ql = length(quer);
      quer = ql > 1e-5 ? quer / ql : vec3(1.0, 0.0, 0.0);
      float gross = (0.012 + 0.014 * fract(z * 9.7)) * (1.0 + 0.012 * length(mitte));
      vec3 p = mix(a, b, aEcke.y * 0.5 + 0.5) + quer * aEcke.x * gross + normalize(lang + vec3(1e-5)) * aEcke.y * gross;
      vEcke = aEcke;
      float weit = length(mitte);
      vHell = min(hell, 1.6) * smoothstep(0.35, 1.2, weit) * (1.0 - smoothstep(13.0, 17.0, weit)) * gross / (gross + length(lang) * 0.22);
      gl_Position = uProj * vec4(p, 1.0);
    }`;
  const FLOCKE_FS = `#version 300 es
    precision highp float;
    in vec2 vEcke;
    in float vHell;
    out vec4 aus;
    void main() {
      float a = (1.0 - abs(vEcke.x)) * (1.0 - vEcke.y * vEcke.y);
      aus = vec4(vec3(0.82, 0.9, 1.0) * a * vHell * 2.2, 1.0);
    }`;

  // Alles, was leuchtet: der Schein der Flutlichter, die Lichter der
  // Zuschauer, Funken, Eiskristalle. Scheiben, die zur Kamera schauen und ihr
  // Licht dazulegen – und nie kleiner werden als ein paar Bildpunkte, damit
  // die Kette der Lichter die Bahn weit voraus zeigt.
  const SCHEIN_VS = `#version 300 es
    layout(location = 0) in vec2 aEcke;
    layout(location = 1) in vec4 iA;      // x, y, z, Grösse
    layout(location = 2) in vec4 iB;      // Farbe, wie hart der Rand ist
    uniform mat4 uProj, uSicht;
    uniform float uPunkt, uDichte;
    out vec2 vEcke;
    out vec4 vFarbe;
    void main() {
      vec4 p = uSicht * vec4(iA.xyz, 1.0);
      float gross = max(iA.w, -p.z * uPunkt * 1.5);
      p.xy += aEcke * gross;
      vEcke = aEcke;
      // Was durch die Mindestgrösse grösser wird, wird dafür blasser.
      float blass = iA.w / gross;
      vFarbe = vec4(iB.rgb * exp(length(p.xyz) * -uDichte * 0.6) * mix(1.0, blass, 0.6), iB.a);
      gl_Position = uProj * p;
    }`;
  const SCHEIN_FS = `#version 300 es
    precision highp float;
    in vec2 vEcke;
    in vec4 vFarbe;
    out vec4 aus;
    void main() {
      float r = length(vEcke);
      aus = vec4(vFarbe.rgb * pow(max(1.0 - r, 0.0), vFarbe.a), 1.0);
    }`;

  function programm(name, vs, fs) {
    const baue = (art, quelle) => {
      const s = gl.createShader(art);
      gl.shaderSource(s, quelle);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(`Eiskanal, Programm «${name}»: ${gl.getShaderInfoLog(s)}`);
      return s;
    };
    const p = gl.createProgram();
    gl.attachShader(p, baue(gl.VERTEX_SHADER, vs));
    gl.attachShader(p, baue(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(`Eiskanal, Programm «${name}»: ${gl.getProgramInfoLog(p)}`);
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
  // Flächen mit je einer eigenen Richtung (kantig). innen ist ein Punkt im
  // Inneren des Körpers: Die Fläche schaut von ihm weg.
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

  // Eine Tanne: ein Stamm und vier Kränze aus Ästen, jeder ein kantiger
  // Kegel, die Ecken ein wenig verrückt. Höhe und Breite sind 1.
  function tanneNetz(form) {
    const b = netzBauer();
    const S = 7;
    const KRAENZE = [[0.14, 1.0, 0.46], [0.36, 0.78, 0.64], [0.56, 0.56, 0.82], [0.74, 0.36, 1.03]];
    KRAENZE.forEach(([unten, breit, oben], k) => {
      const rand = Array.from({ length: S }, (_, j) => {
        const w = (j / S) * Math.PI * 2 + k * 0.5 + form;
        const r = breit * (0.8 + 0.4 * hash01(form * 13.1 + k * 7.7 + j * 3.1));
        return [Math.cos(w) * r, unten - 0.05 * hash01(form + j * 5.3 + k), Math.sin(w) * r];
      });
      const spitze = [0, oben, 0];
      const mitte = [0, unten + 0.04, 0];
      for (let j = 0; j < S; j += 1) {
        b.dreieck(rand[j], rand[(j + 1) % S], spitze, [0, unten - 0.3, 0]);
        b.dreieck(rand[j], rand[(j + 1) % S], mitte, [0, unten + 0.5, 0]);
      }
    });
    b.kasten(0, 0.08, 0, 0.07, 0.1, 0.07);
    return new Float32Array(b.v);
  }

  // Ein Mast mit Ausleger: Der Fuss steht bei x = 1, der Ausleger reicht bis
  // über die Mitte der Bahn (x = 0). Die Breite beim Zeichnen ist der Abstand
  // des Fusses – negativ steht er links.
  function mastNetz() {
    const b = netzBauer();
    b.kasten(1, 0.5, 0, 0.028, 0.5, 0.07);
    b.kasten(0.5, 0.985, 0, 0.5, 0.012, 0.05);
    b.kasten(0.85, 0.93, 0, 0.012, 0.012, 0.03);
    return new Float32Array(b.v);
  }

  function kastenNetz() {
    const b = netzBauer();
    b.kasten(0, 0, 0, 1, 1, 1);
    return new Float32Array(b.v);
  }

  /*
   * Der Bob. Der Ursprung liegt auf dem Eis unter dem Piloten, z zeigt nach
   * vorn: ein Rumpf aus Ringen (rund gerechnet, damit der Lack glänzt), vier
   * Kufen, die Hände am Lenkseil – und für die Gegner zwei Helme. Die Farbe
   * hat jede Fläche für sich: Rumpf orange, ein heller Streifen über die
   * Haube, das Cockpit schwarz.
   *
   * Zurück kommen die Ecken und wo Hände, Rumpf und Helme darin liegen: Im
   * eigenen Bob sitzt die Kamera im Helm, dort bleiben die Helme weg.
   */
  function bobNetz() {
    const v = [];
    const ecke = (p, n, f, glanz) => v.push(p[0], p[1], p[2], n[0], n[1], n[2], f[0], f[1], f[2], glanz);
    const kantig = (bauer, farbe, glanz) => {
      const d = bauer.v;
      for (let i = 0; i < d.length; i += 6) ecke([d[i], d[i + 1], d[i + 2]], [d[i + 3], d[i + 4], d[i + 5]], farbe, glanz);
    };
    const kugel = (mx, my, mz, rx, ry, rz, farbe, glanz) => {
      const T = 6;
      const U = 10;
      const kp = (tt, uu) => {
        const w1 = (tt / T) * Math.PI;
        const w2 = (uu / U) * Math.PI * 2;
        return [Math.sin(w1) * Math.cos(w2), Math.cos(w1), Math.sin(w1) * Math.sin(w2)];
      };
      for (let tt = 0; tt < T; tt += 1) {
        for (let uu = 0; uu < U; uu += 1) {
          for (const [a1, a2] of [[tt, uu], [tt + 1, uu], [tt + 1, uu + 1], [tt, uu], [tt + 1, uu + 1], [tt, uu + 1]]) {
            const n = kp(a1, a2);
            ecke([mx + n[0] * rx, my + n[1] * ry, mz + n[2] * rz], n, farbe, glanz);
          }
        }
      }
    };
    // Die Hände am Lenkseil und die Seile nach vorn in die Haube.
    for (const seite of [-1, 1]) {
      const art = seite < 0 ? 2 : 3;
      kugel(seite * 0.2, 0.575, 0.25, 0.05, 0.045, 0.065, [0.05, 0.05, 0.06], art);
      const b = netzBauer();
      b.kasten(seite * 0.185, 0.59, 0.42, 0.006, 0.006, 0.13);
      kantig(b, [0.3, 0.3, 0.32], art);
    }
    const haende = v.length / 10;

    // Der Rumpf: Ringe von hinten nach vorn.
    const ZS = [-1.56, -1.5, -1.25, -0.8, -0.3, 0.14, 0.44, 0.66, 0.92, 1.18, 1.42, 1.62, 1.78, 1.87, 1.9];
    const BREIT = [0.04, 0.24, 0.34, 0.37, 0.375, 0.375, 0.37, 0.36, 0.34, 0.31, 0.26, 0.2, 0.13, 0.06, 0.012];
    const OBEN = [0.36, 0.44, 0.5, 0.52, 0.52, 0.54, 0.6, 0.6, 0.57, 0.525, 0.465, 0.395, 0.33, 0.28, 0.255];
    const UNTEN = [0.3, 0.16, 0.12, 0.11, 0.11, 0.11, 0.11, 0.11, 0.12, 0.13, 0.15, 0.17, 0.2, 0.23, 0.245];
    const M = 28;
    const R = ZS.length;
    const punkt = (i, j) => {
      const w = (j / M) * Math.PI * 2;
      const c = Math.cos(w);
      const s = Math.sin(w);
      const e = 2 / 2.3;
      const mitte = (OBEN[i] + UNTEN[i]) / 2;
      const halb = (OBEN[i] - UNTEN[i]) / 2;
      return [Math.sign(c) * Math.pow(Math.abs(c), e) * BREIT[i], mitte + Math.sign(s) * Math.pow(Math.abs(s), e) * halb, ZS[i]];
    };
    const P = [];
    for (let i = 0; i < R; i += 1) P.push(Array.from({ length: M }, (_, j) => punkt(i, j)));
    const NRM = [];
    for (let i = 0; i < R; i += 1) {
      NRM.push(Array.from({ length: M }, (_, j) => {
        const a = P[Math.max(0, i - 1)][j];
        const b = P[Math.min(R - 1, i + 1)][j];
        const c = P[i][(j + M - 1) % M];
        const d = P[i][(j + 1) % M];
        const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
        const wx = d[0] - c[0], wy = d[1] - c[1], wz = d[2] - c[2];
        let nx = uy * wz - uz * wy, ny = uz * wx - ux * wz, nz = ux * wy - uy * wx;
        const p = P[i][j];
        if (nx * p[0] + ny * (p[1] - 0.35) < 0) { nx = -nx; ny = -ny; nz = -nz; }
        const l = Math.hypot(nx, ny, nz) || 1;
        return [nx / l, ny / l, nz / l];
      }));
    }
    const LACK = [0.92, 0.3, 0.035];
    const DUNKEL = [0.03, 0.03, 0.04];
    for (let i = 0; i < R - 1; i += 1) {
      for (let j = 0; j < M; j += 1) {
        const k = (j + 1) % M;
        const zm = (ZS[i] + ZS[i + 1]) / 2;
        const xm = (P[i][j][0] + P[i][k][0] + P[i + 1][j][0] + P[i + 1][k][0]) / 4;
        const oben = j >= 3 && j <= 10;      // die Flächen, die nach oben schauen
        let farbe = LACK;
        let glanz = 1;
        if (oben && zm < 0.3 && zm > -1.4 && Math.abs(xm) < 0.3) { farbe = DUNKEL; glanz = 0.15; }   // das Cockpit
        else if (zm > 1.72) { farbe = DUNKEL; glanz = 0.6; }                       // die Nase
        else if (j >= 16 && j <= 25) { farbe = [0.08, 0.08, 0.1]; glanz = 0.4; }   // der Boden
        else if (oben && zm > 0.3) glanz = 0.99;                                   // die Haube: Hier läuft der Streifen (BOB_FS)
        const a = [i, j], b = [i + 1, j], c = [i + 1, k], d = [i, k];
        for (const [ri, rj] of [a, b, c, a, c, d]) ecke(P[ri][rj], NRM[ri][rj], farbe, glanz);
      }
    }
    // Vier Kufen.
    {
      const b = netzBauer();
      for (const seite of [-1, 1]) {
        b.kasten(seite * 0.3, 0.06, 1.0, 0.012, 0.06, 0.42);
        b.kasten(seite * 0.3, 0.06, -0.85, 0.012, 0.06, 0.42);
      }
      kantig(b, [0.55, 0.6, 0.66], 1);
    }
    const rumpf = v.length / 10 - haende;
    // Zwei Helme: Pilot und Bremser.
    kugel(0, 0.7, -0.02, 0.15, 0.15, 0.17, [0.9, 0.9, 0.92], 1);
    kugel(0, 0.66, -0.72, 0.15, 0.15, 0.17, [0.9, 0.9, 0.92], 1);
    const alle = v.length / 10;
    return { ecken: new Float32Array(v), haende, rumpf, helme: alle - haende - rumpf };
  }

  // Rauschen, das sich nahtlos wiederholt: für Rillen und Reif im Eis, die
  // Körner im Schnee (mit ihrer Neigung in Grün und Blau), Berge und
  // Nordlicht. Einmal gerechnet, 256 × 256.
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

  // Die Schrift der Tafeln: ein Bild mit 32 Feldern, je 256 × 64. Feld 0 bis
  // 3 sind die Tore (Start, zwei Zwischenzeiten, Ziel), danach die Meter bis
  // ins Ziel.
  const TAFEL_SPALTEN = 4;
  const TAFEL_ZEILEN = 8;
  function tafelBild() {
    const c = document.createElement("canvas");
    c.width = 1024;
    c.height = 512;
    const k = c.getContext("2d");
    k.fillStyle = "#05070c";
    k.fillRect(0, 0, c.width, c.height);
    k.textAlign = "center";
    k.textBaseline = "middle";
    const feld = (nr, zeichne) => {
      k.save();
      k.translate((nr % TAFEL_SPALTEN) * 256, Math.floor(nr / TAFEL_SPALTEN) * 64);
      zeichne();
      k.restore();
    };
    ["START", "1. ZWISCHENZEIT", "2. ZWISCHENZEIT", "ZIEL"].forEach((text, nr) => feld(nr, () => {
      const gold = nr === 0 || nr === 3;
      k.fillStyle = gold ? "#f5a623" : "#101826";
      k.fillRect(0, 0, 256, 64);
      // Ein Schachbrett links und rechts, wie an jeder Ziellinie.
      for (let i = 0; i < 4; i += 1) {
        for (let j = 0; j < 2; j += 1) {
          k.fillStyle = (i + j) % 2 ? "#0b0d12" : "#f4f6fa";
          k.fillRect(j * 16, i * 16, 16, 16);
          k.fillRect(224 + j * 16, i * 16, 16, 16);
        }
      }
      k.fillStyle = gold ? "#14100a" : "#e9f2ff";
      k.font = `900 ${text.length > 6 ? 21 : 40}px system-ui, sans-serif`;
      k.fillText(text, 128, 34);
    }));
    for (let n = 1; n <= 13; n += 1) {
      feld(3 + n, () => {
        k.fillStyle = "#0c1626";
        k.fillRect(0, 0, 256, 64);
        k.strokeStyle = "#9fc6ff";
        k.lineWidth = 4;
        k.strokeRect(4, 4, 248, 56);
        k.fillStyle = "#eaf3ff";
        k.font = "900 40px system-ui, sans-serif";
        k.fillText(`${n * 100} m`, 128, 34);
      });
    }
    return c;
  }

  /*
   * Der Rand der Bahn auf einer Seite (seite -1 links, 1 rechts), an der
   * Probe i: wo das Eis endet, das Brett der Bande oder der Wulst der Lippe,
   * das Dach darüber, und der Schneewall dahinter – als Punkte im
   * Querschnitt [quer, hoch]. Netz und Zierde (Tannen, Zuschauer) fragen
   * beide hier: So steht nichts in der Luft.
   */
  const randMerker = { eis: [0, 0], brett: [0, 0], kappe: [0, 0], fuss: [0, 0], schnee: [[0, 0], [0, 0], [0, 0], [0, 0], [0, 0]], dach: [[0, 0], [0, 0], [0, 0], [0, 0]], steil: 0, bedacht: 0, phi: 0 };
  function randBei(i, seite, o = randMerker) {
    const s = i * DS - S_VOR;
    const W = seite < 0 ? bahn.wl[i] : bahn.wr[i];
    const phi = seite * W;
    const sf = Math.sin(phi);
    const cf = Math.cos(phi);
    // Die Wand hinauf (t) und vom Rohr weg (a).
    const tq = seite * cf, th = seite * sf;
    const aq = sf, ah = -cf;
    const steil = weich(BANDE + 2 * GRAD, BANDE + STEIL + 4 * GRAD, W);
    const bedacht = weich(BANDE + 12 * GRAD, BANDE + 26 * GRAD, W);
    const brett = lerp(0.62, 0.26, steil);
    const eq = ROHR * sf;
    const eh = ROHR * (1 - cf);
    o.phi = phi;
    o.steil = steil;
    o.bedacht = bedacht;
    o.eis[0] = eq; o.eis[1] = eh;
    o.brett[0] = eq + tq * brett; o.brett[1] = eh + th * brett;
    o.kappe[0] = o.brett[0] + aq * 0.16; o.kappe[1] = o.brett[1] + ah * 0.16;
    o.fuss[0] = eq + aq * 0.22 + seite * 0.04; o.fuss[1] = eh + ah * 0.22 - 0.12;
    // Der Schneewall: erst eine Schulter, dann ein Kamm, dahinter fällt er
    // ab. Innen in einer engen Kurve ist weniger Platz – dort rückt er zusammen.
    const k = bahn.kr[i];
    const eng = seite * k > 0 ? clamp((0.55 / Math.abs(k) - Math.abs(o.fuss[0])) / 20, 0.12, 1) : 1;
    const n1 = welle(s, 17, 5 + seite + bahn.saat);
    const n2 = welle(s, 31, 11 + seite * 2 + bahn.saat);
    const n3 = welle(s, 9, 23 + seite + bahn.saat);
    const L = o.fuss[0];
    const U = o.fuss[1];
    const S = o.schnee;
    S[0][0] = L; S[0][1] = U;
    S[1][0] = L + seite * 1.3 * eng; S[1][1] = lerp(U, 0.65, 0.3) - 0.04;
    S[2][0] = L + seite * 4.4 * eng; S[2][1] = lerp(U, 0.8, 0.55) + 0.45 * n1 + 0.2 * n3;
    S[3][0] = L + seite * 9.5 * eng; S[3][1] = lerp(U, 1.0, 0.75) + 0.25 + 1.3 * n2;
    S[4][0] = L + seite * 20 * eng; S[4][1] = lerp(U, 0, 0.9) - 2.6 + n1;
    // Das Dach wächst aus der Lippe: eine Rückwand, dann ein Bogen über die Bahn.
    const D = o.dach;
    D[0][0] = o.kappe[0] + seite * 0.1; D[0][1] = o.kappe[1] - 0.05;
    D[1][0] = D[0][0]; D[1][1] = D[0][1] + 1.05 * bedacht;
    D[2][0] = D[1][0] - seite * 0.7 * bedacht; D[2][1] = D[1][1] + 0.6 * bedacht;
    D[3][0] = D[2][0] - seite * 1.3 * bedacht; D[3][1] = D[2][1] + 0.2 * bedacht;
    return o;
  }

  // Wie hoch der Schnee an einer Stelle liegt, ab Meter hinter dem Fuss der Bande.
  function schneeBei(s, seite, ab, o) {
    const i = Math.round(probe(s));
    const r = randBei(i, seite);
    const S = r.schnee;
    const quer = S[0][0] + seite * ab * (Math.abs(S[4][0] - S[0][0]) / 20);
    let j = 0;
    while (j < 3 && seite * quer > seite * S[j + 1][0]) j += 1;
    const u = clamp((quer - S[j][0]) / ((S[j + 1][0] - S[j][0]) || 1), 0, 1);
    o.quer = quer;
    o.hoch = lerp(S[j][1], S[j + 1][1], u);
    return o;
  }

  const EIS_N = 24;                 // so viele Streifen Eis quer durch die Rinne
  const JE_RING = (EIS_N + 1) + 4 * 2 + 5 * 2 + 4 * 2;
  const ECKE = 14;                  // Zahlen je Ecke
  let bahnDaten = null;
  let bahnIndex = null;
  let indexJeStueck = 0;

  // Das Netz der Bahn: Ring um Ring, in jedem dieselben Ecken in derselben
  // Reihenfolge – Eis, Rand links und rechts, Schnee links und rechts, Dach
  // links und rechts. So ist die Liste der Dreiecke für jedes Stück gleich.
  function bahnNetz() {
    if (!bahnDaten) bahnDaten = new Float32Array(NP * JE_RING * ECKE);
    const d = bahnDaten;
    let o = 0;
    let cx = 0, cy = 0, cz = 0, st = 0, ct = 1, sp = 0, cp = 1, s = 0, th = 0, linie = 0;
    const setze = (quer, hoch, nq, nh, stoff, par, par2, zus) => {
      d[o] = cx + quer * ct + hoch * st * sp;
      d[o + 1] = cy + hoch * cp;
      d[o + 2] = cz - quer * st + hoch * ct * sp;
      d[o + 3] = s;
      d[o + 4] = quer; d[o + 5] = hoch; d[o + 6] = nq; d[o + 7] = nh;
      d[o + 8] = th; d[o + 9] = stoff; d[o + 10] = par; d[o + 11] = par2;
      d[o + 12] = zus; d[o + 13] = linie;
      o += ECKE;
    };
    // Die Richtung einer Fläche zwischen zwei Punkten des Querschnitts, nach oben.
    const lot = (a, b, seite) => {
      let nq = -(b[1] - a[1]) * seite;
      let nh = (b[0] - a[0]) * seite;
      const l = Math.hypot(nq, nh) || 1;
      nq /= l; nh /= l;
      return [nq, nh];
    };
    const links = { eis: [0, 0], brett: [0, 0], kappe: [0, 0], fuss: [0, 0], schnee: [[0, 0], [0, 0], [0, 0], [0, 0], [0, 0]], dach: [[0, 0], [0, 0], [0, 0], [0, 0]], steil: 0, bedacht: 0, phi: 0 };
    const rechts = { eis: [0, 0], brett: [0, 0], kappe: [0, 0], fuss: [0, 0], schnee: [[0, 0], [0, 0], [0, 0], [0, 0], [0, 0]], dach: [[0, 0], [0, 0], [0, 0], [0, 0]], steil: 0, bedacht: 0, phi: 0 };
    for (let i = 0; i < NP; i += 1) {
      s = i * DS - S_VOR;
      th = bahn.richt[i];
      st = Math.sin(th); ct = Math.cos(th);
      sp = bahn.gef[i]; cp = Math.sqrt(1 - sp * sp);
      cx = bahn.x[i]; cy = bahn.y[i]; cz = bahn.z[i];
      const wl = bahn.wl[i];
      const wr = bahn.wr[i];
      // Wo die Sollfahrt liegt, sind die Spuren im Eis.
      linie = bahn.soll[i];
      randBei(i, -1, links);
      randBei(i, 1, rechts);
      // Das Eis.
      for (let j = 0; j <= EIS_N; j += 1) {
        const phi = lerp(-wl, wr, j / EIS_N);
        const sf = Math.sin(phi);
        const cf = Math.cos(phi);
        setze(ROHR * sf, ROHR * (1 - cf), -sf, cf, 0, phi, phi < 0 ? -phi / wl : phi / wr, phi < 0 ? links.steil : rechts.steil);
      }
      for (const [seite, r] of [[-1, links], [1, rechts]]) {
        // Der Rand: das Brett (zur Bahn hin), die Kappe, die Rückseite.
        const sf = Math.sin(r.phi);
        const cf = Math.cos(r.phi);
        setze(r.eis[0], r.eis[1], -sf, cf, 1, 0, 0, r.steil);
        setze(r.brett[0], r.brett[1], -sf, cf, 1, 1, 0, r.steil);
        setze(r.kappe[0], r.kappe[1], seite * cf, seite * sf, 1, 1.3, 0, r.steil);
        setze(r.fuss[0], r.fuss[1], sf, -cf, 1, 2, 0, r.steil);
      }
      for (const [seite, r] of [[-1, links], [1, rechts]]) {
        // Der Schnee.
        const S = r.schnee;
        for (let j = 0; j < 5; j += 1) {
          const n = lot(S[Math.max(0, j - 1)], S[Math.min(4, j + 1)], seite);
          setze(S[j][0], S[j][1], n[0], n[1], 2, j / 4, 0, 0);
        }
      }
      for (const [seite, r] of [[-1, links], [1, rechts]]) {
        // Das Dach: Seine Flächen schauen zur Bahn und nach unten.
        const D = r.dach;
        for (let j = 0; j < 4; j += 1) {
          const n = lot(D[Math.max(0, j - 1)], D[Math.min(3, j + 1)], seite);
          setze(D[j][0], D[j][1], n[0], n[1], 3, j / 3, 0, r.bedacht);
        }
      }
    }
    if (!bahnIndex) {
      // Dieselben Dreiecke für jedes Stück zwischen zwei Ringen.
      // Die Streifen der linken Seite laufen von der Bahn weg nach links,
      // die der rechten nach rechts: Links werden die Dreiecke darum
      // andersherum aufgezählt – so schaut bei allen dieselbe Seite zur Bahn
      // (gl_FrontFacing im Programm).
      const streifen = [[0, EIS_N + 1, false]];
      let ab = EIS_N + 1;
      [4, 4, 5, 5, 4, 4].forEach((n, nr) => { streifen.push([ab, n, nr % 2 === 0]); ab += n; });
      const liste = [];
      for (let i = 0; i < NP - 1; i += 1) {
        const a = i * JE_RING;
        const b = a + JE_RING;
        for (const [von, n, links] of streifen) {
          for (let j = 0; j < n - 1; j += 1) {
            if (links) liste.push(a + von + j, b + von + j + 1, b + von + j, a + von + j, a + von + j + 1, b + von + j + 1);
            else liste.push(a + von + j, b + von + j, b + von + j + 1, a + von + j, b + von + j + 1, a + von + j + 1);
          }
        }
      }
      bahnIndex = new Uint16Array(liste);
      indexJeStueck = liste.length / (NP - 1);
    }
    return d;
  }

  /*
   * Die Zierde neben der Bahn, einmal je Runde gestellt: Tannen hinter den
   * Schneewällen, Zuschauer mit ihren Lichtern, die Tore mit Pfosten und
   * Balken, die Tafeln (Pfeile vor den Kurven, Meter bis ins Ziel). Nichts
   * davon würfelt: Wo was steht, folgt aus der Bahn und festen Zahlen.
   */
  const TOR_HOCH = 6.4;
  function zierStellen() {
    const Z = { baeume: [], dinge: [], leute: [], tafeln: [], lichter: [] };
    const p = {};
    const sh = {};
    const saat = bahn.saat;
    const HOLZ = [0.16, 0.12, 0.09];
    const STAHL = [0.2, 0.22, 0.27];

    // Tannen: in zwei Reihen hinter dem Kamm des Schneewalls.
    for (let n = 0, s = -S_VOR + 3; s < LAENGE + S_NACH - 6; n += 1, s += 4.6) {
      for (const seite of [-1, 1]) {
        const w = hash01(n * 7.31 + seite * 3.3 + saat);
        if (w < 0.24) continue;
        const ab = 9 + 9 * hash01(n * 3.17 + seite + saat * 1.3);
        schneeBei(s, seite, ab, sh);
        imQuerschnitt(s, sh.quer, sh.hoch - 0.7, p);
        const h = 5.5 + 7 * hash01(n * 1.93 + seite * 5 + saat);
        Z.baeume.push({ s, x: p.x, y: p.y, z: p.z, h, r: h * (0.2 + 0.08 * hash01(n * 9.1 + seite)), dreh: w * 6.28, form: Math.floor(w * 97) % 3 });
      }
    }

    // Die Tore: Start, zwei Zwischenzeiten, Ziel. Zwei Pfosten, ein Balken,
    // daran das Tuch mit der Schrift.
    const torStellen = (s, feldNr) => {
      for (const seite of [-1, 1]) {
        imQuerschnitt(s, seite * 3.5, 0, p);
        Z.dinge.push({ s, netz: "kasten", x: p.x, y: p.y + TOR_HOCH / 2, z: p.z, dreh: p.richt, sx: 0.16, sy: TOR_HOCH / 2, sz: 0.16, farbe: STAHL, leuchten: 0 });
      }
      imQuerschnitt(s, 0, TOR_HOCH, p);
      Z.dinge.push({ s, netz: "kasten", x: p.x, y: p.y, z: p.z, dreh: p.richt, sx: 3.66, sy: 0.14, sz: 0.16, farbe: STAHL, leuchten: 0 });
      Z.tafeln.push({ s: s - 0.2, quer: 0, hoch: TOR_HOCH - 1.0, breit: 3.3, halb: 0.82, stoff: 5, feld: feldNr });
    };
    torStellen(0, 0);
    TORE.forEach((s, nr) => torStellen(s, 1 + nr));
    torStellen(LAENGE, 3);

    // Das Starthaus: zwei Wände und ein Dach über dem Bob.
    for (const seite of [-1, 1]) {
      imQuerschnitt(-13, seite * 2.9, 1.9, p);
      Z.dinge.push({ s: -13, netz: "kasten", x: p.x, y: p.y, z: p.z, dreh: p.richt, sx: 0.14, sy: 1.9, sz: 7, farbe: HOLZ, leuchten: 0 });
    }
    imQuerschnitt(-13, 0, 3.9, p);
    Z.dinge.push({ s: -13, netz: "kasten", x: p.x, y: p.y, z: p.z, dreh: p.richt, sx: 3.3, sy: 0.12, sz: 7.4, farbe: HOLZ, leuchten: 0 });

    // Die Meter bis ins Ziel, alle hundert, abwechselnd links und rechts.
    for (let n = 1; n <= 13; n += 1) {
      const s = LAENGE - n * 100;
      if (TORE.some((t) => Math.abs(t - s) < 30)) continue;
      const seite = n % 2 ? 1 : -1;
      const r = randBei(Math.round(probe(s)), seite);
      if (r.steil > 0.3) continue;
      const quer = r.kappe[0] + seite * 1.5;
      const hoch = r.kappe[1] + 1.0;
      Z.tafeln.push({ s, quer, hoch, breit: 1.2, halb: 0.3, stoff: 5, feld: 3 + n });
      imQuerschnitt(s + 0.1, quer, hoch - 0.8, p);
      Z.dinge.push({ s, netz: "kasten", x: p.x, y: p.y, z: p.z, dreh: p.richt, sx: 0.05, sy: 0.8, sz: 0.05, farbe: STAHL, leuchten: 0 });
    }

    // Pfeile vor jeder Kurve, aussen: drei Tafeln, gelb bis rot nach der
    // Wucht der Kurve. Im Labyrinth eine je Bogen.
    for (const b of bahn.boegen) {
      if (b.winkel < 18) continue;
      const mitte = bahnBei((b.von + b.bis) / 2);
      const wucht = clamp((Math.atan(mitte.vf * mitte.vf * Math.abs(mitte.k) / G) / GRAD - 38) / 40, 0, 1);
      const stellen = b.art === "labyrinth" ? [b.von - 3] : [b.von - 10, b.von + 3, b.von + 16];
      for (const s of stellen) {
        const seite = -b.seite;
        const r = randBei(Math.round(probe(s)), seite);
        const quer = r.kappe[0] + seite * 1.45;
        const hoch = r.kappe[1] + 0.85;
        Z.tafeln.push({ s, quer, hoch, breit: 1.25, halb: 0.52, stoff: 4, wucht, richtung: b.seite });
        imQuerschnitt(s + 0.1, quer, hoch - 0.7, p);
        Z.dinge.push({ s, netz: "kasten", x: p.x, y: p.y, z: p.z, dreh: p.richt, sx: 0.05, sy: 0.75, sz: 0.05, farbe: STAHL, leuchten: 0 });
      }
    }

    // Zuschauer: am Start, an den Toren, im Ziel – und innen im Kreisel.
    // Jeder ist ein kleines Licht hinter der Bande.
    const leute = (von, bis, seiten, dicht) => {
      for (let n = 0, s = von; s < bis; n += 1, s += 0.8 / dicht) {
        for (const seite of seiten) {
          for (let reihe = 0; reihe < 3; reihe += 1) {
            const w = hash01(s * 3.1 + seite * 7 + reihe * 13.7 + saat);
            if (w < 0.25) continue;
            const r = randBei(Math.round(probe(s)), seite);
            if (r.steil > 0.2) continue;
            schneeBei(s, seite, 1.4 + reihe * 1.25 + w * 0.5, sh);
            imQuerschnitt(s + w * 0.6, sh.quer, sh.hoch + 1.25 + reihe * 0.12 + w * 0.3, p);
            Z.leute.push({ s, x: p.x, y: p.y, z: p.z, w, nr: Z.leute.length });
          }
        }
      }
    };
    leute(-6, 46, [-1, 1], 1);
    TORE.forEach((s) => leute(s - 22, s + 22, [-1, 1], 0.8));
    leute(LAENGE - 60, LAENGE + 110, [-1, 1], 1.1);
    const kreisel = bahn.teile.find((t) => t.art === "kreisel");
    if (kreisel) leute(kreisel.von + 10, kreisel.bis - 10, [kreisel.seite], 0.5);

    // Eine Lichterkette am Saum jedes Sonnensegels: warme Birnen, alle vier Meter.
    for (let i = 0; i < NP; i += 2) {
      for (const seite of [-1, 1]) {
        const r = randBei(i, seite);
        if (r.bedacht < 0.75) continue;
        const s = i * DS - S_VOR;
        imQuerschnitt(s, r.dach[3][0], r.dach[3][1] - 0.06, p);
        Z.lichter.push({ s, x: p.x, y: p.y, z: p.z });
      }
    }

    for (const liste of [Z.baeume, Z.dinge, Z.leute, Z.tafeln, Z.lichter]) liste.sort((a, b) => a.s - b.s);
    bahn.zier = Z;
  }

  // Die Tafeln als Netz: je zwei Dreiecke, quer zur Bahn, mit Blick zum Start.
  function schilderNetz() {
    const T = bahn.zier.tafeln;
    const d = new Float32Array(T.length * 6 * ECKE);
    const p = {};
    let o = 0;
    for (const t of T) {
      let u0 = 0, v0 = 0, u1 = 1, v1 = 1;
      if (t.stoff === 5) {
        u0 = (t.feld % TAFEL_SPALTEN) / TAFEL_SPALTEN;
        v0 = Math.floor(t.feld / TAFEL_SPALTEN) / TAFEL_ZEILEN;
        u1 = u0 + 1 / TAFEL_SPALTEN;
        v1 = v0 + 1 / TAFEL_ZEILEN;
      }
      const ecken = [[-1, -1], [1, -1], [1, 1], [-1, -1], [1, 1], [-1, 1]];
      for (const [ex, ey] of ecken) {
        imQuerschnitt(t.s, t.quer + ex * t.breit, t.hoch + ey * t.halb, p);
        d[o] = p.x; d[o + 1] = p.y; d[o + 2] = p.z; d[o + 3] = t.s;
        d[o + 4] = t.quer; d[o + 5] = t.hoch; d[o + 6] = t.wucht || 0; d[o + 7] = t.richtung || 0;
        d[o + 8] = p.richt; d[o + 9] = t.stoff;
        // Im Bild der Schrift ist oben links der Anfang; der Pfeil rechnet von unten.
        d[o + 10] = lerp(u0, u1, ex * 0.5 + 0.5);
        d[o + 11] = t.stoff === 5 ? lerp(v1, v0, ey * 0.5 + 0.5) : ey * 0.5 + 0.5;
        d[o + 12] = 0; d[o + 13] = 0;
        o += ECKE;
      }
    }
    return d;
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
      const wo = teile.length + i;
      gl.enableVertexAttribArray(wo);
      gl.vertexAttribPointer(wo, 4, gl.FLOAT, false, breite * 4, i * 16);
      gl.vertexAttribDivisor(wo, 1);
    }
    gl.bindVertexArray(null);
    return { vao, ibo, daten, breite, max: anzahl, n: 0, ecken: ecken.length / schritt };
  }

  function hochladen(a) {
    if (!a.n) return;
    gl.bindBuffer(gl.ARRAY_BUFFER, a.ibo);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, a.daten, 0, a.n * a.breite);
  }

  function zeichneAbzug(a) {
    if (!a.n) return;
    gl.bindVertexArray(a.vao);
    gl.drawArraysInstanced(gl.TRIANGLES, 0, a.ecken, a.n);
  }

  // Ein Netz ohne Abzüge: Ecken mit ihren Teilen (und, wer will, einer Liste
  // der Dreiecke). Die Ecken lassen sich später neu füllen (die Bahn).
  function festesNetz(teile, index = null) {
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    const vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    const schritt = teile.reduce((summe, t) => summe + t, 0);
    let weit = 0;
    teile.forEach((t, i) => {
      gl.enableVertexAttribArray(i);
      gl.vertexAttribPointer(i, t, gl.FLOAT, false, schritt * 4, weit * 4);
      weit += t;
    });
    let ebo = null;
    if (index) {
      ebo = gl.createBuffer();
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ebo);
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, index, gl.STATIC_DRAW);
    }
    gl.bindVertexArray(null);
    return { vao, vbo, ebo, schritt, n: 0 };
  }

  function fuelle(netz, daten) {
    gl.bindBuffer(gl.ARRAY_BUFFER, netz.vbo);
    gl.bufferData(gl.ARRAY_BUFFER, daten, gl.DYNAMIC_DRAW);
    netz.n = daten.length / netz.schritt;
  }

  const FLOCKEN = 520;
  const FORMEN_TANNE = 3;

  function grafikBauen() {
    const P = bild.prog;
    P.himmel = programm("Himmel", HIMMEL_VS, HIMMEL_FS);
    P.bahn = programm("Bahn", BAHN_VS, BAHN_FS);
    P.ding = programm("Ding", DING_VS, DING_FS);
    P.bob = programm("Bob", BOB_VS, BOB_FS);
    P.flocke = programm("Flocke", FLOCKE_VS, FLOCKE_FS);
    P.schein = programm("Schein", SCHEIN_VS, SCHEIN_FS);

    const N = bild.netz;
    for (let i = 0; i < FORMEN_TANNE; i += 1) N[`tanne${i}`] = abzug(tanneNetz(i), [3, 3], 12, 140);
    N.mast = abzug(mastNetz(), [3, 3], 12, 48);
    N.kasten = abzug(kastenNetz(), [3, 3], 12, 160);
    const ecken = new Float32Array([-1, -1, 1, -1, 1, 1, -1, -1, 1, 1, -1, 1]);
    N.schein = abzug(ecken, [2], 8, 900);
    N.flocke = abzug(ecken, [2], 4, FLOCKEN);
    // Die Flocken bekommen ihre Zufallszahlen einmal.
    for (let i = 0; i < FLOCKEN * 4; i += 1) N.flocke.daten[i] = hashGanz(i * 31 + 7);
    N.flocke.n = FLOCKEN;
    hochladen(N.flocke);

    bahnNetz();
    bild.bahn = festesNetz([4, 4, 4, 2], bahnIndex);
    bild.schilder = festesNetz([4, 4, 4, 2]);
    const bob = bobNetz();
    bild.bob = festesNetz([3, 3, 4]);
    fuelle(bild.bob, bob.ecken);
    bild.bob.haende = bob.haende;
    bild.bob.rumpf = bob.rumpf;
    bild.bob.helme = bob.helme;
    bild.leer = gl.createVertexArray();
    bild.bahnNr = -1;

    const r = rauschBild();
    bild.rausch = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, bild.rausch);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, r.N, r.N, 0, gl.RGBA, gl.UNSIGNED_BYTE, r.px);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);

    bild.tafeln = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, bild.tafeln);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, tafelBild());
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    bild.ok = true;
  }

  // Eine neue Bahn ist gewürfelt: ihr Netz und ihre Tafeln auf die Grafikkarte.
  function bahnHochladen() {
    if (!bild.ok || bild.bahnNr === bahn.nr) return;
    fuelle(bild.bahn, bahnNetz());
    fuelle(bild.schilder, schilderNetz());
    bild.bahnNr = bahn.nr;
  }

  // Die Leinwand für die Welt entsteht einmal und bleibt über alle Runden –
  // mit ihr die Programme und Netze.
  function grafikStarten() {
    canvas = document.createElement("canvas");
    canvas.className = "ek-canvas";
    canvas.setAttribute("aria-hidden", "true");
    hud = document.createElement("canvas");
    hud.className = "ek-hud";
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
  const STAHL = [0.2, 0.22, 0.27];
  const TANNE = [0.035, 0.07, 0.06];
  const SICHT_BAHN = 760;          // so weit voraus wird die Bahn gezeichnet
  const SICHT_ZIER = 340;          // und so weit, was neben ihr steht
  const DING_NETZE = ["tanne0", "tanne1", "tanne2", "mast", "kasten"];

  function ding(a, x, y, z, dreh, sx, sy, sz, roll, farbe, hell = 1, leuchten = 0) {
    if (a.n >= a.max) return;
    const d = a.daten;
    const o = a.n * 12;
    d[o] = x - kam.x; d[o + 1] = y - kam.y; d[o + 2] = z - kam.z; d[o + 3] = dreh;
    d[o + 4] = sx; d[o + 5] = sy; d[o + 6] = sz; d[o + 7] = roll;
    d[o + 8] = farbe[0] * hell; d[o + 9] = farbe[1] * hell; d[o + 10] = farbe[2] * hell; d[o + 11] = leuchten;
    a.n += 1;
  }

  function schein(x, y, z, gross, r, gr, b, rand = 2.2) {
    const a = bild.netz.schein;
    if (a.n >= a.max) return;
    const d = a.daten;
    const o = a.n * 8;
    d[o] = x - kam.x; d[o + 1] = y - kam.y; d[o + 2] = z - kam.z; d[o + 3] = gross;
    d[o + 4] = r; d[o + 5] = gr; d[o + 6] = b; d[o + 7] = rand;
    a.n += 1;
  }

  // Wo eine Liste, nach der Strecke geordnet, die Stelle s erreicht.
  function abStelle(liste, s) {
    let lo = 0;
    let hi = liste.length;
    while (lo < hi) {
      const m = (lo + hi) >> 1;
      if (liste[m].s < s) lo = m + 1;
      else hi = m;
    }
    return lo;
  }

  // Die sechs Flutlichter um den Schlitten: Sie beleuchten, was neben der
  // Bahn steht, die Haube und die Flocken. Am Rand des Fensters werden sie
  // weich ein- und ausgeblendet, damit kein Licht springt.
  const lampenNah = new Float32Array(24);
  const zierOrt = {};

  // Was im Bild steht, in die Abzüge schreiben.
  function weltSammeln() {
    const N = bild.netz;
    const Z = bahn.zier;
    for (const name of DING_NETZE) N[name].n = 0;
    N.schein.n = 0;
    const s0 = state.s;

    // Die Flutlichter: Mast, Lampe, ihr Schein – und die Kette der Lichter
    // weit voraus, die zeigt, wohin die Bahn führt.
    lampenNah.fill(0);
    let nah = 0;
    for (const l of bahn.lampen) {
      const ds = l.s - s0;
      if (ds < -40) continue;
      if (ds > SICHT_BAHN) break;
      if (ds > -27 && nah < 6) {
        const kraft = weich(-27, -10, ds) * (1 - weich(96, 122, ds));
        lampenNah[nah * 4] = l.x - kam.x;
        lampenNah[nah * 4 + 1] = l.y - kam.y;
        lampenNah[nah * 4 + 2] = l.z - kam.z;
        lampenNah[nah * 4 + 3] = kraft * 1.8;
        nah += 1;
      }
      if (ds < SICHT_ZIER) {
        imQuerschnitt(l.s, 0, 0, zierOrt);
        ding(N.mast, zierOrt.x, zierOrt.y, zierOrt.z, l.richt, l.seite * 3.25, LAMPE_HOCH + 0.3, 1, 0, STAHL);
        ding(N.kasten, l.x, l.y + 0.12, l.z, l.richt, 0.34, 0.07, 0.2, 0, FLUT, 1, 2.6);
      }
      schein(l.x, l.y, l.z, 0.62, FLUT[0] * 2.3, FLUT[1] * 2.3, FLUT[2] * 2.3, 2.6);
      if (ds < 420) schein(l.x, l.y, l.z, 5.2, FLUT[0] * 0.12, FLUT[1] * 0.12, FLUT[2] * 0.12, 1.7);
    }

    // Tannen, Tore, Pfosten.
    for (let i = abStelle(Z.baeume, s0 - 30); i < Z.baeume.length; i += 1) {
      const b = Z.baeume[i];
      if (b.s > s0 + SICHT_ZIER) break;
      ding(N[`tanne${b.form}`], b.x, b.y, b.z, b.dreh, b.r, b.h, b.r, 0, TANNE, 1, -0.85);
    }
    for (let i = abStelle(Z.dinge, s0 - 30); i < Z.dinge.length; i += 1) {
      const d = Z.dinge[i];
      if (d.s > s0 + SICHT_ZIER + 120) break;
      ding(N[d.netz], d.x, d.y, d.z, d.dreh, d.sx, d.sy, d.sz, 0, d.farbe, 1, d.leuchten);
    }
    // Die Tore tragen warme Lichter am Balken.
    for (const s of [0, TORE[0], TORE[1], LAENGE]) {
      if (s < s0 - 10 || s > s0 + SICHT_BAHN) continue;
      for (const quer of [-3.5, -1.75, 0, 1.75, 3.5]) {
        imQuerschnitt(s, quer, TOR_HOCH + 0.3, zierOrt);
        schein(zierOrt.x, zierOrt.y, zierOrt.z, 0.5, 1.6, 1.0, 0.4, 2.4);
      }
    }

    for (let i = abStelle(Z.lichter, s0 - 6); i < Z.lichter.length; i += 1) {
      const l = Z.lichter[i];
      if (l.s > s0 + 420) break;
      schein(l.x, l.y, l.z, 0.2, 1.5, 0.95, 0.42, 2.4);
    }

    // Die Zuschauer: kleine warme Lichter – und ab und zu ein Blitzlicht.
    const bildNr = Math.floor(state.zeit * 11);
    for (let i = abStelle(Z.leute, s0 - 8); i < Z.leute.length; i += 1) {
      const m = Z.leute[i];
      if (m.s > s0 + 300) break;
      const hell = 0.5 + 0.5 * m.w;
      if (m.w > 0.86) schein(m.x, m.y, m.z, 0.16, 0.3 * hell, 0.9 * hell, 1.0 * hell, 2.2);
      else schein(m.x, m.y, m.z, 0.15, 1.0 * hell, 0.72 * hell, 0.4 * hell, 2.2);
      if (!ruhig() && hashGanz(m.nr * 131 + bildNr) > 0.996) schein(m.x, m.y + 0.1, m.z, 1.5, 1.5, 1.6, 1.8, 2.4);
    }

    // Die Gegner (geist.js): ein Schein in ihrer Farbe – der Bob aus Licht
    // selbst wird danach gezeichnet (zeichneGeister).
    geisterOrte.length = 0;
    if (gegner && state.phase !== "bereit") {
      (window.LernappGeist?.orte?.(gegner) || []).forEach((o) => {
        geisterOrte.push(o);
        // Wem im Live-Modus zugeschaut wird, der ist der Bob selbst – kein
        // Geist dazu, nur sein Name (geist.js, namen).
        if (o.ziel) return;
        const farbe = farbeAus(o.farbe);
        const gs = o.a / 10;
        if (gs < s0 - 20 || gs > s0 + 600) return;
        geistOrt(o, zierOrt, 0.5);
        schein(zierOrt.x, zierOrt.y, zierOrt.z, 2.6, farbe[0] * 0.45 * o.blass, farbe[1] * 0.45 * o.blass, farbe[2] * 0.45 * o.blass, 1.8);
      });
    }

    // Funken und Eiskristalle.
    for (const t of state.teile) {
      const k = clamp(t.leben / t.max, 0, 1);
      schein(t.x, t.y, t.z, t.r * (0.5 + 0.5 * k), t.farbe[0] * k * 1.6, t.farbe[1] * k * 1.6, t.farbe[2] * k * 1.6, t.hart);
    }
    for (const name of DING_NETZE) hochladen(N[name]);
    hochladen(N.schein);
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

  // Wo ein Gegner in der Bahn liegt: seine Strecke (a) und seine Lage von
  // Rand zu Rand (b) – daraus der Winkel am Rohr an dieser Stelle.
  function phiAus(s, q) {
    const b = bahnBei(s);
    return clamp(q, -1, 1) * (q < 0 ? b.wl : b.wr);
  }
  function geistOrt(o, aus, ab = 0) {
    const s = clamp(o.a / 10, -S_VOR + 2, LAENGE + S_NACH - 32);
    const phi = phiAus(s, o.b / 100);
    aufEis(s, phi, ab, aus);
    aus.phi = phi;
    aus.s = s;
    return aus;
  }

  function lichtSetzen(p) {
    gl.uniform3fv(p.ort("uMond"), MOND);
    gl.uniform3fv(p.ort("uMondLicht"), MOND_LICHT);
    gl.uniform3fv(p.ort("uHimmelLicht"), HIMMEL_LICHT);
    gl.uniform3fv(p.ort("uNebel"), NEBEL);
    gl.uniform3fv(p.ort("uFlut"), FLUT);
    gl.uniform1f(p.ort("uDichte"), DICHTE);
    gl.uniform1f(p.ort("uZeit"), state.zeit);
    gl.uniform4fv(p.ort("uLampe[0]"), lampenNah);
  }

  // Ein Bob an einer Stelle der Bahn: Seine drei Richtungen sind die des
  // Eises unter ihm (quer, vom Eis weg, voraus), um drehen noch gerollt.
  const basis = new Float32Array(9);
  const bobOrt = {};
  function bobStellen(p, s, phi, drehen, gieren) {
    const o = aufEis(s, phi, 0, bobOrt);
    const sf = Math.sin(phi);
    const cf = Math.cos(phi);
    // quer = am Eis entlang nach rechts.
    let qx = cf * o.rx + sf * o.ux, qy = sf * o.uy, qz = cf * o.rz + sf * o.uz;
    let nx = o.nx, ny = o.ny, nz = o.nz;
    let tx = o.tx, ty = o.ty, tz = o.tz;
    if (drehen) {
      const c = Math.cos(drehen), sn = Math.sin(drehen);
      const ax = qx * c - nx * sn, ay = qy * c - ny * sn, az = qz * c - nz * sn;
      nx = qx * sn + nx * c; ny = qy * sn + ny * c; nz = qz * sn + nz * c;
      qx = ax; qy = ay; qz = az;
    }
    if (gieren) {
      const c = Math.cos(gieren), sn = Math.sin(gieren);
      const ax = qx * c - tx * sn, ay = qy * c - ty * sn, az = qz * c - tz * sn;
      tx = qx * sn + tx * c; ty = qy * sn + ty * c; tz = qz * sn + tz * c;
      qx = ax; qy = ay; qz = az;
    }
    basis[0] = qx; basis[1] = qy; basis[2] = qz;
    basis[3] = nx; basis[4] = ny; basis[5] = nz;
    basis[6] = tx; basis[7] = ty; basis[8] = tz;
    gl.uniformMatrix3fv(p.ort("uBasis"), false, basis);
    gl.uniform3f(p.ort("uVersatz"), o.x - kam.x, o.y - kam.y, o.z - kam.z);
  }

  // Die Gegner: je ein Bob aus Licht, dort, wo sie in ihrer Fahrt waren.
  function zeichneGeister() {
    if (!geisterOrte.length) return;
    const P = bild.prog.bob;
    const B = bild.bob;
    gl.useProgram(P.p);
    gl.uniformMatrix4fv(P.ort("uPV"), false, kam.pv);
    gl.uniform1f(P.ort("uLenk"), 0);
    gl.bindVertexArray(B.vao);
    for (const o of geisterOrte) {
      if (o.ziel) continue;
      const gs = o.a / 10;
      if (gs < state.s - 20 || gs > state.s + 600) continue;
      const farbe = farbeAus(o.farbe);
      geistOrt(o, zierOrt, 0);
      bobStellen(P, zierOrt.s, zierOrt.phi, 0, 0);
      gl.uniform4f(P.ort("uGeist"), farbe[0], farbe[1], farbe[2], 0.9 * o.blass);
      gl.drawArrays(gl.TRIANGLES, B.haende, B.rumpf + B.helme);
    }
  }

  function zeichneWelt() {
    if (!bild.ok || !gl || gl.isContextLost()) return;
    const P = bild.prog;
    const N = bild.netz;
    kameraStellen();
    bahnHochladen();
    weltSammeln();

    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.disable(gl.CULL_FACE);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, bild.tafeln);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, bild.rausch);
    for (const name of ["himmel", "bahn", "ding", "bob", "flocke"]) {
      gl.useProgram(P[name].p);
      lichtSetzen(P[name]);
    }
    const punkt = 2 * kam.tan[1] / Math.max(1, view.cssH);

    // 1. Die Bahn: Eis, Banden, Schnee, Dächer – das Stück um den Schlitten
    //    und weit voraus – und die Tafeln.
    gl.disable(gl.BLEND);
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.depthMask(true);
    gl.clear(gl.DEPTH_BUFFER_BIT);
    gl.useProgram(P.bahn.p);
    gl.uniformMatrix4fv(P.bahn.ort("uPV"), false, kam.pv);
    gl.uniform3f(P.bahn.ort("uKam"), kam.x, kam.y, kam.z);
    gl.uniform3f(P.bahn.ort("uLampeMass"), LAMPE_AB, LAMPE_HOCH, 2.6);
    gl.uniform1f(P.bahn.ort("uWarn"), ruhig() ? 0 : warnung());
    gl.uniform1i(P.bahn.ort("uRausch"), 0);
    gl.uniform1i(P.bahn.ort("uTafeln"), 1);
    const iA = clamp(Math.floor(probe(state.s - 40)), 0, NP - 2);
    const iB = clamp(Math.ceil(probe(state.s + SICHT_BAHN)), iA + 1, NP - 1);
    gl.bindVertexArray(bild.bahn.vao);
    gl.drawElements(gl.TRIANGLES, (iB - iA) * indexJeStueck, gl.UNSIGNED_SHORT, iA * indexJeStueck * 2);
    gl.bindVertexArray(bild.schilder.vao);
    gl.drawArrays(gl.TRIANGLES, 0, bild.schilder.n);

    // 2. Was neben der Bahn steht.
    gl.useProgram(P.ding.p);
    gl.uniformMatrix4fv(P.ding.ort("uPV"), false, kam.pv);
    for (const name of DING_NETZE) zeichneAbzug(N[name]);

    // 3. Der Himmel – und unter dem Horizont das Tal. Erst jetzt, hinter
    //    allem: Wo schon Eis oder Schnee steht, wird er gar nicht gerechnet.
    gl.depthMask(false);
    gl.useProgram(P.himmel.p);
    gl.uniform3fv(P.himmel.ort("uRechts"), kam.rechts);
    gl.uniform3fv(P.himmel.ort("uHoch"), kam.hoch);
    gl.uniform3fv(P.himmel.ort("uVor"), kam.vor);
    gl.uniform2fv(P.himmel.ort("uTan"), kam.tan);
    gl.uniform3f(P.himmel.ort("uKamOrt"), kam.x, kam.y, kam.z);
    gl.uniform1i(P.himmel.ort("uRausch"), 0);
    gl.bindVertexArray(bild.leer);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    // 4. Was leuchtet, legt sein Licht dazu: die Gegner, die Lichter, der Schnee.
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE);
    zeichneGeister();
    gl.useProgram(P.schein.p);
    gl.uniformMatrix4fv(P.schein.ort("uProj"), false, kam.proj);
    gl.uniformMatrix4fv(P.schein.ort("uSicht"), false, kam.sicht);
    gl.uniform1f(P.schein.ort("uPunkt"), punkt);
    gl.uniform1f(P.schein.ort("uDichte"), DICHTE);
    zeichneAbzug(N.schein);
    gl.useProgram(P.flocke.p);
    gl.uniformMatrix4fv(P.flocke.ort("uProj"), false, kam.proj);
    gl.uniformMatrix4fv(P.flocke.ort("uSicht"), false, kam.sicht);
    gl.uniform3f(P.flocke.ort("uKam"), kam.x, kam.y, kam.z);
    const fahrt = state.schritt === "start" ? 0 : 1;
    gl.uniform3f(P.flocke.ort("uFahrt"), kam.vx * fahrt, kam.vy * fahrt, kam.vz * fahrt);
    gl.uniform3f(P.flocke.ort("uKasten"), 30, 16, 30);
    gl.uniform1f(P.flocke.ort("uBelichtung"), ruhig() ? 0.008 : 0.022);
    zeichneAbzug(N.flocke);
    gl.disable(gl.BLEND);
    gl.depthMask(true);

    // 5. Die eigene Haube, ganz nah – mit eigener Tiefe, über allem.
    gl.clear(gl.DEPTH_BUFFER_BIT);
    gl.useProgram(P.bob.p);
    gl.uniformMatrix4fv(P.bob.ort("uPV"), false, kam.pvNah);
    gl.uniform4f(P.bob.ort("uGeist"), 0, 0, 0, 0);
    gl.uniform1f(P.bob.ort("uLenk"), kam.lenk);
    bobStellen(P.bob, state.s, kam.phi, state.kipp, kam.lenk * 0.045);
    gl.bindVertexArray(bild.bob.vao);
    gl.drawArrays(gl.TRIANGLES, 0, bild.bob.haende + bild.bob.rumpf);
    gl.bindVertexArray(null);
  }

  // Wie nah der Schlitten der Lippe ist (0 weit weg, 1 fast darüber).
  function warnung() {
    if (state.schritt !== "fahrt") return 0;
    const b = bahnBei(state.s);
    const grenze = state.phi < 0 ? b.wl : b.wr;
    if (grenze <= BANDE + STEIL) return 0;
    return weich(grenze - 15 * GRAD, grenze - 3 * GRAD, Math.abs(state.phi));
  }

  // ---------------------------------------------------------------------------
  // Die Fläche
  // ---------------------------------------------------------------------------
  function buildPlatz() {
    feld = shell.el("div", "ek-feld");
    feld.append(canvas, hud);
    if (!bild.ok) {
      feld.append(shell.el("p", "ek-ohne", "Dieses Spiel braucht WebGL 2 – dieser Browser kann das leider nicht."));
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

  const zeitText = (t) => `${Math.floor(t / 60)}:${(t % 60).toFixed(1).padStart(4, "0")}`;

  // Oben links: der Tacho, gross – darunter die Zeit, die Strecke mit den
  // Toren und was der Bob noch aushält.
  function zeichneTacho() {
    const gross = clamp(view.cssH * 0.085, 26, 46);
    const x = 12;
    const y = 12 + view.frei;
    const kmh = String(Math.round(state.v * 3.6));
    g.font = `900 ${Math.round(gross)}px system-ui, sans-serif`;
    const breit = Math.max(gross * 3.6, g.measureText("188").width + gross * 1.75);
    const hoch = gross * 1.95;
    g.fillStyle = "rgba(6, 10, 20, 0.55)";
    runde(x, y, breit, hoch, gross * 0.4);
    g.fill();
    g.textAlign = "left";
    g.textBaseline = "alphabetic";
    g.fillStyle = "#ffffff";
    g.fillText(kmh, x + gross * 0.35, y + gross * 1.0);
    const zw = g.measureText(kmh).width;
    g.font = `800 ${Math.round(gross * 0.34)}px system-ui, sans-serif`;
    g.fillStyle = "rgba(255, 255, 255, 0.7)";
    g.fillText("km/h", x + gross * 0.45 + zw, y + gross * 1.0);
    // Die Zeit, in Zehnteln.
    g.font = `800 ${Math.round(gross * 0.42)}px system-ui, sans-serif`;
    g.fillStyle = "#ffd76a";
    g.fillText(zeitText(state.angekommen ? state.zielzeit : state.fahrzeit), x + gross * 0.38, y + gross * 1.62);
    // Drei Kufen: was der Bob noch aushält.
    for (let i = 0; i < SCHLAEGE; i += 1) {
      const weg = i >= SCHLAEGE - state.schlaege;
      g.fillStyle = weg ? "rgba(255, 110, 90, 0.9)" : "rgba(200, 230, 255, 0.92)";
      const kx = x + breit - gross * 0.36 - i * gross * 0.36;
      runde(kx - gross * 0.11, y + gross * 1.3, gross * 0.22, gross * 0.36, gross * 0.08);
      g.fill();
      if (weg) {
        g.strokeStyle = "rgba(6, 10, 20, 0.9)";
        g.lineWidth = 2;
        g.beginPath();
        g.moveTo(kx - gross * 0.08, y + gross * 1.36);
        g.lineTo(kx + gross * 0.08, y + gross * 1.6);
        g.stroke();
      }
    }
    // Die Strecke: ein Strich vom Start bis ins Ziel, mit den zwei Toren.
    const ly = y + hoch + 7;
    g.fillStyle = "rgba(6, 10, 20, 0.55)";
    runde(x, ly, breit, 6, 3);
    g.fill();
    const k = clamp(state.s / LAENGE, 0, 1);
    g.fillStyle = "#f5a623";
    runde(x, ly, Math.max(6, breit * k), 6, 3);
    g.fill();
    g.fillStyle = "rgba(255, 255, 255, 0.85)";
    for (const t of TORE) g.fillRect(x + breit * (t / LAENGE) - 1, ly - 2, 2, 10);
    return { unten: ly + 12, breit };
  }

  // Die Ansage: welche Kurve als Nächstes kommt, wohin und wie heftig.
  const ART_NAME = { kurve: "Kurve", s: "S-Kurve", kreisel: "Kreisel", labyrinth: "Labyrinth" };
  let ansageNr = 0;
  let ansageY = 0;
  function naechsterBogen() {
    const B = bahn.boegen;
    if (ansageNr >= B.length || (ansageNr > 0 && B[ansageNr - 1].bis - 6 > state.s)) ansageNr = 0;
    while (ansageNr < B.length && B[ansageNr].bis - 6 < state.s) ansageNr += 1;
    return B[ansageNr] || null;
  }

  function zeichneAnsage() {
    if (state.schritt !== "fahrt" && state.schritt !== "start") return;
    const b = naechsterBogen();
    if (!b) return;
    const weit = b.von - state.s;
    if (weit > 170) return;
    const gross = clamp(view.cssH * 0.05, 15, 24);
    const mitte = bahnBei((b.von + b.bis) / 2);
    const wucht = clamp((Math.atan(mitte.vf * mitte.vf * Math.abs(mitte.k) / G) / GRAD - 38) / 40, 0, 1);
    const farbe = `rgb(255, ${Math.round(lerp(214, 96, wucht))}, ${Math.round(lerp(96, 70, wucht))})`;
    const text = weit > 8 ? `${Math.round(weit / 10) * 10} m` : ART_NAME[b.art];
    g.font = `900 ${Math.round(gross * 0.8)}px system-ui, sans-serif`;
    const tw = g.measureText(text).width;
    const breit = gross * 2.2 + tw + gross * 0.5;
    const hochkant = view.cssW < view.cssH * 0.8;
    const x = view.cssW / 2 - breit / 2;
    const y = hochkant ? ansageY : 12 + view.frei;
    const nah = weit <= 8;
    g.fillStyle = nah ? "rgba(6, 10, 20, 0.4)" : "rgba(6, 10, 20, 0.6)";
    runde(x, y, breit, gross * 1.7, gross * 0.85);
    g.fill();
    // Der Pfeil: ein Bogen in die Richtung der Kurve; der Kreisel dreht weiter.
    g.save();
    g.translate(x + gross * 1.05, y + gross * 0.85);
    g.scale(b.seite, 1);
    g.strokeStyle = farbe;
    g.fillStyle = farbe;
    g.lineWidth = Math.max(2.5, gross * 0.16);
    g.lineCap = "round";
    g.lineJoin = "round";
    const dreh = b.art === "kreisel" ? 1.25 : clamp(b.winkel / 110, 0.35, 1) * 0.55;
    g.beginPath();
    g.moveTo(-gross * 0.32, gross * 0.42);
    g.lineTo(-gross * 0.32, gross * 0.05);
    g.arc(0, gross * 0.05, gross * 0.32, Math.PI, Math.PI + Math.PI * dreh);
    g.stroke();
    const w = Math.PI + Math.PI * dreh;
    const px = Math.cos(w) * gross * 0.32;
    const py = gross * 0.05 + Math.sin(w) * gross * 0.32;
    g.translate(px, py);
    g.rotate(w + Math.PI / 2);
    g.beginPath();
    g.moveTo(gross * 0.26, 0);
    g.lineTo(-gross * 0.1, -gross * 0.24);
    g.lineTo(-gross * 0.1, gross * 0.24);
    g.closePath();
    g.fill();
    g.restore();
    g.textAlign = "left";
    g.textBaseline = "middle";
    g.fillStyle = nah ? farbe : "#ffffff";
    g.fillText(text, x + gross * 2.1, y + gross * 0.9);
  }

  /*
   * Die Lage in der Rinne, unten auf der Haube: der Querschnitt der Bahn an
   * dieser Stelle – so weit das Eis links und rechts reicht –, der Schlitten
   * als Punkt darauf und ein feiner Strich für die ruhige Linie. Das Ende ist
   * hell, wo eine Bande steht, und orange, wo es eine Lippe ist.
   */
  function zeichneLage() {
    if (state.schritt === "sturz") return;
    const b = bahnBei(state.s);
    const R = clamp(Math.min(view.cssW, view.cssH) * 0.085, 26, 46);
    const cx = view.cssW / 2;
    const cy = view.cssH - R * 0.5;
    // Die Achse des Rohrs liegt R über der Sohle; phi zählt von der Sohle aus.
    const ort = (phi, r = R) => [cx + Math.sin(phi) * r, cy - R + Math.cos(phi) * r];
    const bogen = (r) => {
      g.beginPath();
      g.arc(cx, cy - R, r, Math.PI / 2 + b.wl, Math.PI / 2 - b.wr, true);
      g.stroke();
    };
    g.lineCap = "round";
    g.strokeStyle = "rgba(6, 10, 20, 0.62)";
    g.lineWidth = R * 0.34;
    bogen(R);
    g.strokeStyle = "rgba(150, 215, 255, 0.92)";
    g.lineWidth = R * 0.1;
    bogen(R);
    // Die Enden: Bande oder Lippe.
    for (const seite of [-1, 1]) {
      const grenze = seite < 0 ? b.wl : b.wr;
      const [ax, ay] = ort(seite * grenze, R * 0.84);
      const [bx, by] = ort(seite * grenze, R * 1.16);
      g.strokeStyle = grenze > BANDE + STEIL ? "#ff7a2a" : "#ffffff";
      g.lineWidth = R * 0.13;
      g.beginPath();
      g.moveTo(ax, ay);
      g.lineTo(bx, by);
      g.stroke();
    }
    // Die ruhige Linie und der Schlitten.
    if (state.schritt === "fahrt") {
      const linie = clamp(linieBei(state.v, b.k), -b.wl, b.wr);
      const [lx, ly] = ort(linie, R * 0.86);
      const [mx, my] = ort(linie, R * 1.14);
      g.strokeStyle = "rgba(125, 255, 168, 0.9)";
      g.lineWidth = Math.max(2, R * 0.07);
      g.beginPath();
      g.moveTo(lx, ly);
      g.lineTo(mx, my);
      g.stroke();
    }
    const [sx, sy] = ort(clamp(state.phi, -b.wl, b.wr));
    g.fillStyle = warnung() > 0.5 ? "#ff5a3a" : "#ffd76a";
    g.strokeStyle = "rgba(6, 10, 20, 0.85)";
    g.lineWidth = 2;
    g.beginPath();
    g.arc(sx, sy, R * 0.16, 0, Math.PI * 2);
    g.fill();
    g.stroke();
  }

  // Vor dem ersten Druck: links und rechts ein Pfeil – dort wird gehalten.
  function zeichneHinweis() {
    if (state.phase !== "bereit" || shell.live) return;
    const puls = ruhig() ? 0.75 : 0.6 + 0.3 * Math.sin(state.zeit * 3.2);
    const gross = clamp(Math.min(view.cssW, view.cssH) * 0.085, 24, 52);
    const y = view.cssH * 0.58;
    for (const s of [-1, 1]) {
      const x = view.cssW / 2 + s * Math.min(view.cssW * 0.36, 300);
      g.fillStyle = `rgba(6, 10, 20, ${0.42 * puls + 0.1})`;
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

  // Die Schrift mitten im Bild: Zwischenzeit, Bande, Ziel.
  function zeichneKarte() {
    const k = state.karte;
    if (!k) return;
    const alter = state.zeit - k.seit;
    const deck = Math.min(1, alter / 0.18) * clamp((k.dauer - alter) / 0.5, 0, 1);
    if (deck <= 0) return;
    const gross = clamp(view.cssW * 0.06, 24, 50);
    const y = Math.max(view.cssH * 0.27, view.frei + gross * 2.6);
    g.globalAlpha = deck;
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.font = `900 ${Math.round(gross)}px system-ui, sans-serif`;
    g.lineWidth = Math.max(3, gross * 0.13);
    g.lineJoin = "round";
    g.strokeStyle = "rgba(6, 10, 20, 0.7)";
    g.strokeText(k.gross, view.cssW / 2, y);
    g.fillStyle = k.farbe;
    g.fillText(k.gross, view.cssW / 2, y);
    if (k.klein) {
      g.font = `800 ${Math.round(gross * 0.42)}px system-ui, sans-serif`;
      g.lineWidth = Math.max(2, gross * 0.08);
      g.strokeText(k.klein, view.cssW / 2, y + gross * 0.92);
      g.fillStyle = "#ffffff";
      g.fillText(k.klein, view.cssW / 2, y + gross * 0.92);
    }
    g.globalAlpha = 1;
  }

  // Die Namen der Gegner an ihren Bobs (geist.js) – wer hinter der Kamera
  // fährt, steht am unteren Rand.
  function zeichneNamen() {
    if (!geisterOrte.length || !window.LernappGeist?.namen) return;
    const liste = geisterOrte.map((o) => {
      let p = null;
      if (o.ziel) {
        p = { x: view.cssW / 2, y: view.cssH * 0.34 };
      } else {
        geistOrt(o, zierOrt, 1.25);
        p = imBild(zierOrt.x, zierOrt.y, zierOrt.z);
      }
      return { ...o, sx: p ? p.x : view.cssW / 2, sy: p ? p.y : view.cssH + 40, weit: `${Math.round(o.a / 10)} m` };
    });
    window.LernappGeist.namen(g, liste, { breit: view.cssW, hoch: view.cssH });
  }

  function zeichneHud() {
    if (!g) return;
    g.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
    g.clearRect(0, 0, view.cssW, view.cssH);
    // Ein harter Schlag oder die Lippe ganz nah: Der Rand des Bilds glüht rot.
    const rot = Math.max(state.blitz, ruhig() ? 0 : warnung() * 0.5);
    if (rot > 0.01) {
      const r = Math.hypot(view.cssW, view.cssH) / 2;
      const rand = g.createRadialGradient(view.cssW / 2, view.cssH / 2, r * 0.5, view.cssW / 2, view.cssH / 2, r);
      rand.addColorStop(0, "rgba(255, 70, 40, 0)");
      rand.addColorStop(1, `rgba(255, 70, 40, ${0.42 * rot})`);
      g.fillStyle = rand;
      g.fillRect(0, 0, view.cssW, view.cssH);
    }
    // Nach dem Sturz wird es dunkel.
    if (state.schritt === "sturz") {
      const zu = weich(0.5, 1.8, state.zeit - state.schrittZeit);
      g.fillStyle = `rgba(4, 6, 12, ${0.75 * zu})`;
      g.fillRect(0, 0, view.cssW, view.cssH);
    }
    zeichneNamen();
    zeichneLage();
    const tacho = zeichneTacho();
    ansageY = tacho.unten + 4;
    zeichneAnsage();
    zeichneKarte();
    zeichneHinweis();
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

  // Zwei Schleifen: die Kufen auf dem Eis und der Fahrtwind. Beide werden mit
  // dem Tempo heller und lauter, die Kufen dazu beim Lenken und an der Bande.
  // Nachgestellt werden sie ein paarmal je Sekunde, nicht in jedem Bild.
  let kufen = null;
  let wind = null;
  let kulisseMs = -1e9;
  function kulisseAn() {
    kufen = klang()?.kulisse?.("eiskanal.kufen") || null;
    wind = klang()?.kulisse?.("eiskanal.wind") || null;
    kulisseMs = -1e9;
    kulisseStellen();
  }

  function kulisseStellen() {
    if (!kufen && !wind) return;
    const ms = performance.now();
    if (ms - kulisseMs < 80) return;
    kulisseMs = ms;
    const k = clamp(state.v / 38, 0, 1);
    kufen?.setze(clamp(0.25 + 0.5 * k + 0.25 * Math.abs(state.e) + 0.3 * state.schleift, 0, 1));
    kufen?.laut(clamp(0.35 + 0.45 * k + 0.3 * Math.abs(state.e) + 0.4 * state.schleift, 0, 1));
    wind?.setze(0.15 + 0.7 * k);
    wind?.laut(0.2 + 0.8 * k * k);
  }

  function kulisseAus() {
    kufen?.stop();
    wind?.stop();
    kufen = null;
    wind = null;
  }

  // ---------------------------------------------------------------------------
  // Der Lauf
  // ---------------------------------------------------------------------------
  function takt(dt) {
    state.zeit += dt;
    if (state.stoss > 0) state.stoss = Math.max(0, state.stoss - dt * 2.6);
    if (state.blitz > 0) state.blitz = Math.max(0, state.blitz - dt * 1.9);
    if (state.schleift > 0) state.schleift = Math.max(0, state.schleift - dt * 5);

    if (state.phase === "zuschauen") {
      zuschauenTakt(dt);
    } else if (state.phase === "spiel" && state.schritt === "fahrt") {
      const n = Math.max(1, Math.ceil(dt / TAKT - 1e-9));
      for (let i = 0; i < n && state.schritt === "fahrt"; i += 1) physik(dt / n);
    }
    if (state.schritt === "ziel" || state.schritt === "sturz") ausrollen(dt);
    const b = bahnBei(state.s);
    state.q = state.phi < 0 ? state.phi / b.wl : state.phi / b.wr;

    kristalle(dt);
    for (let i = state.teile.length - 1; i >= 0; i -= 1) {
      const t = state.teile[i];
      t.vy -= t.fall * dt;
      t.x += t.vx * dt;
      t.y += t.vy * dt;
      t.z += t.vz * dt;
      t.leben -= dt;
      if (t.leben <= 0) {
        state.teile[i] = state.teile[state.teile.length - 1];
        state.teile.pop();
      }
    }
    kameraTakt(dt);
    kulisseStellen();

    if (state.phase === "spiel") {
      if (state.schritt === "fahrt") {
        state.meter = Math.max(0, Math.floor(state.s));
        state.vMax = Math.max(state.vMax, state.v);
        const punkte = Math.floor(Math.max(0, state.s) / METER_JE_PUNKT);
        if (punkte !== state.punkte) {
          state.punkte = punkte;
          shell.setCount(punkte);
        }
      }
      gegner?.takt(state.punkte, { a: Math.round(state.s * 10), b: Math.round(state.q * 100), c: Math.round(state.v * 3.6) });
      // Erst ausrollen lassen: den Sturz, die Fahrt durchs Ziel. (Neu
      // gerechnet – der Schritt kann eben erst begonnen haben.)
      const dauer = state.zeit - state.schrittZeit;
      if ((state.schritt === "sturz" && dauer > 1.9) || (state.schritt === "ziel" && dauer > 3.2)) finish();
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
  // Eine aufgezeichnete Fahrt durch ihre eigene Bahn: Der Zufall hält die
  // Saat (geist.js, zuschauer), startRun würfelt damit dieselbe Bahn, und der
  // Bob liegt Bild für Bild dort, wo er damals war – Strecke, Lage und Tempo
  // stehen in der Aufzeichnung. Was er zählt, auch.
  function zuschauenStarten() {
    if (!zuschauer?.lauf) return;
    startRun();
    state.phase = "zuschauen";
    state.schritt = "fahrt";
    state.schrittZeit = state.zeit;
    shell.setPhase("play");
    zuschauer.los();
    kulisseAn();
  }

  function zuschauenTakt(dt) {
    const s = zuschauer.stand();
    if (!s) return;
    if (state.schritt === "fahrt") {
      const sVor = state.s;
      const qVor = state.q;
      state.s = Math.max(state.s, Math.min(LAENGE + 2, s.a / 10));
      state.q = clamp(s.b / 100, -1, 1);
      state.phi = phiAus(state.s, state.q);
      state.w = dt > 0 ? (state.phi - phiAus(sVor, qVor)) / dt : 0;
      state.v = Math.max(0, (s.c || 0) / 3.6);
      // Die Lenkung steht nicht in der Aufzeichnung: Die Haube folgt dem,
      // wohin der Bob gerade wandert.
      state.e += (clamp(state.w * 0.8, -1, 1) - state.e) * (1 - Math.exp(-dt / 0.2));
      if (state.s > 0) state.fahrzeit += dt;
      state.meter = Math.max(0, Math.floor(state.s));
      // An der Bande sprühen wieder Funken.
      if (Math.abs(state.q) > 0.985 && Math.abs(qVor) <= 0.985 && state.s > 5) {
        const b = bahnBei(state.s);
        if ((state.q < 0 ? b.wl : b.wr) <= BANDE + STEIL) { funken(Math.sign(state.q), 12); state.stoss = Math.min(1, state.stoss + 0.4); }
      }
      while (state.torNr < TORE.length && state.s >= TORE[state.torNr]) tor(state.torNr);
      if (state.s >= LAENGE) {
        state.zielzeit = state.fahrzeit;
        ziel();
      } else if (zuschauer.fertig?.()) {
        // Die Aufzeichnung endet vor dem Ziel: Dort ist er gestürzt.
        const b = bahnBei(state.s);
        const grenze = state.q < 0 ? b.wl : b.wr;
        sturz(grenze > BANDE + STEIL && Math.abs(state.q) > 0.9 ? "lippe" : "bande", Math.sign(state.q) || 1);
      }
    }
    const punkte = Math.max(0, Math.floor(s.punkte));
    if (punkte !== state.punkte) {
      state.punkte = punkte;
      shell.setCount(punkte);
    }
    if (!zuschauer.weiter()) kulisseAus();
  }

  // ---------------------------------------------------------------------------
  // Lenken
  // ---------------------------------------------------------------------------
  // Die Runde beginnt mit dem ersten Druck – oder im Live-Modus zum
  // gemeinsamen Start (game-shell.js, live.los).
  function losGehts() {
    if (state.phase !== "bereit") return;
    state.phase = "spiel";
    state.schritt = "fahrt";
    state.schrittZeit = state.zeit;
    state.v = V_ANFANG;
    shell.setPhase("play");
    gegner?.los();
    kulisseAn();
    karte("Los!", "Lenk gegen das Pendeln – und bleib unter der orangen Lippe", "#ffd76a", 3.4);
    kids()?.vibrate?.(8);
    lenkNeu();
  }

  // Wer hält, lenkt: links vom Bild nach links, rechts nach rechts. Liegen
  // zwei Finger auf, zählt der, der zuletzt kam.
  const finger = new Map();
  function lenkNeu() {
    let richtung = 0;
    for (const seite of finger.values()) richtung = seite;
    state.lenk = state.phase === "zuschauen" || state.phase === "ende" || state.schritt !== "fahrt" ? 0 : richtung;
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

  // Für die Prüfskripte und die Vorführung: -1, 0 oder 1.
  function lenke(richtung) {
    if (richtung) fingerAuf("pilot", richtung < 0 ? -1 : 1);
    else fingerWeg("pilot");
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
      phase: "bereit", schritt: "start", punkte: 0, s: S_START, v: 0, phi: 0, w: 0, e: 0, lenk: 0, q: 0,
      zeit: 0, fahrzeit: 0, meter: 0, schlaege: 0, beruehrt: 0, schleift: 0, bonus: 0, zielzeit: 0,
      angekommen: false, ursache: "", sturzSeite: 0, tore: [0, 0], torNr: 0, vMax: 0,
      teile: [], karte: null, stoss: 0, blitz: 0, schrittZeit: 0, flug: 0, kipp: 0,
    });
    neueBahn();
    vergleich = besteZeiten();
    ansageNr = 0;
    finger.clear();
    shell.setCount(0);
    gegner?.runde();

    shell.clear();
    const prompt = shell.el("p", "cm-prompt ek-prompt", "Links halten – nach links. Rechts halten – nach rechts.");
    shell.play.append(prompt, buildPlatz());
    view.cssW = 0;
    messen();
    kam.phi = 0;
    kam.lenk = 0;

    last = performance.now();
    frame = window.requestAnimationFrame(loop);
  }

  function zaehleHoch(zielZahl) {
    const zahl = host.querySelector(".cm-result-score");
    if (!zahl) return;
    if (ruhig() || zielZahl <= 1) { zahl.textContent = String(zielZahl); return; }
    const dauer = Math.min(900, 250 + zielZahl * 2);
    const start = performance.now();
    zahl.textContent = "0";
    const lauf = (now) => {
      if (!zahl.isConnected) return;
      const k = Math.min(1, (now - start) / dauer);
      zahl.textContent = String(Math.round(zielZahl * (1 - (1 - k) * (1 - k))));
      if (k < 1) window.requestAnimationFrame(lauf);
    };
    window.requestAnimationFrame(lauf);
  }

  function finish() {
    stopLoop();
    kulisseAus();
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
    merkeZeiten(punkte);
    const kmh = `${Math.round(state.vMax * 3.6)} km/h`;
    const wie = state.angekommen
      ? `Im Ziel nach ${state.zielzeit.toFixed(2)} s · Zeitbonus +${state.bonus}`
      : `${state.ursache === "lippe" ? "Über die Lippe" : state.ursache === "bande" ? "Gekippt" : "Aus"} nach ${state.meter} m`;
    shell.showResult({
      label: "Deine Punkte",
      points: punkte,
      detail: rekord ? "Neuer Rekord!" : [wie, `Spitze ${kmh}`, vorher ? `Bestwert ${vorher}` : ""].filter(Boolean).join(" · "),
      geist,
    });
    if (rekord) host.querySelector(".cm-result-detail")?.classList.add("ek-rekord");
    zaehleHoch(punkte);
  }

  // ---------------------------------------------------------------------------
  // Start
  // ---------------------------------------------------------------------------
  shell = shellApi.mount({
    host,
    title: "Eiskanal",
    area: "geschwindigkeit",
    accent: "#F5A623",
    accentDark: "#b9741a",
    clock: false,
    onRestart: () => (zuschauer ? zuschauenStarten() : startRun()),
    live: { los: losGehts, stopp: () => finish(), zuschauen: (quelle) => { zuschauer = quelle; zuschauenStarten(); } },
  });
  zuschauer = window.LernappGeist?.zuschauer?.({
    host, spiel: "iceRun", fassung: "t1", zufall, einheit: "Punkte", nochmal: zuschauenStarten,
  }) || null;
  if (!zuschauer) {
    gegner = window.LernappGeist?.fuer?.({ spiel: "iceRun", host, art: "tempo", alle: true, zufall }) || null;
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

  // Pfeiltasten oder A und D lenken; Leertaste und Enter starten nur.
  const TASTEN = { ArrowLeft: -1, ArrowRight: 1, KeyA: -1, KeyD: 1 };
  const tasteVon = (event) => (TASTEN[event.key] ? event.key : TASTEN[event.code] ? event.code : null);
  document.addEventListener("keydown", (event) => {
    const taste = tasteVon(event);
    const start = event.key === " " || event.key === "Enter";
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
  window.addEventListener("pagehide", () => { stopLoop(); kulisseAus(); });

  // Für die Prüfskripte und die Vorführung. lenke(-1 | 0 | 1) hält links oder
  // rechts oder lässt los; guete(1) hält die Schärfe fest.
  window.LernappEiskanal = {
    TAKT, LAENGE, GEFAELLE, ROHR, BANDE, STEIL, LIPPE_MAX, TORE, SCHLAEGE, RICHTZEIT, BONUS_JE_ZEHNTEL, METER_JE_PUNKT,
    HART, SANFT, GRIFF, DAEMPFUNG, LENK_ZEIT, LENK_KOSTEN, G, DS, S_VOR, NP, V_START,
    SOLL_VORAUS, SOLL_LINIE, SOLL_GEGEN, SOLL_BREIT, SOLL_KRAFT, GRAD,
    state, view, kam, bild, bahn, takt, zeichnen, weltText, bahnBei, linieBei, luftBei, bonusFuer,
    losGehts, lenke,
    guete(wert) {
      view.fest = wert !== null && wert !== undefined;
      if (view.fest) view.guete = clamp(Number(wert) || 1, 0.3, 1);
      view.cssW = 0;
    },
  };
})();
