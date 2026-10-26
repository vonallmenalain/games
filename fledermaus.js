/*
 * fledermaus.js – Fledermaus.
 * ---------------------------------------------------------------------------
 * Eine Fledermaus fliegt durch eine stockdunkle Höhle. Zu sehen ist fast
 * nichts: die Fledermaus selbst mit ihren leuchtenden Augen, Glühwürmchen
 * und Leuchtpilze an den Wänden. Wer links tippt, ruft: Ein Ring aus Schall
 * läuft durch die Höhle, und wo er Fels trifft, glühen die Kanten auf –
 * erst weiss, dann cyan, dann violett – und erlöschen langsam wieder.
 * Kristalle funkeln dabei und leuchten länger nach. Den Weg voraus muss man
 * sich also merken und im richtigen Moment wieder rufen. Wer rechts tippt,
 * schlägt mit den Flügeln: ein Schub nach oben, dazwischen zieht die
 * Schwerkraft, und die Flügel gleiten weich. Mit der Tastatur: ↑ oder
 * Leertaste für den Flügelschlag, ← oder E für den Ruf. Jeder Finger zählt
 * für sich – man kann zugleich flattern und rufen.
 *
 * Rufe gibt es nicht beliebig: drei Ladungen, die langsam nachladen. Ein
 * gefangenes Glühwürmchen lädt sofort eine nach und leuchtet die Wände
 * ringsum kurz an – und Glühwürmchen fliegen gern dort, wo es knapp ist.
 *
 * Gezählt werden die Meter. Die Höhle zieht nach rechts weiter, immer
 * schneller (das Tempo hängt an der Strecke, nicht an der Uhr), und sie wird
 * enger und verwinkelter; der Ruf reicht weniger weit, die Kanten verblassen
 * schneller, die Ladungen kommen langsamer, Pilze werden seltener. Dazu
 * kommen Tropfsteine von oben und unten und Felsbrocken (ab 50 m), Slaloms
 * zwischen Tropfsteinen (ab 90 m), Kammern (ab 120 m), Engstellen (ab
 * 150 m), Spinnen, die am Faden auf und ab laufen (ab 250 m), Tropfsteine,
 * die sich lösen, wenn man darunter durchfliegt (ab 380 m), und
 * Abzweigungen, von denen eine eine Sackgasse ist (ab 560 m). Eine
 * Berührung mit Fels, Tropfstein oder Spinne beendet die Runde: Die
 * Fledermaus prallt ab und trudelt zu Boden.
 *
 * Gebaut wird die Höhle aus dem Zufall (zufall.js), Abschnitt für
 * Abschnitt, und jeder Abschnitt zieht gleich viele Zahlen: ohne Turnier
 * jedes Mal eine andere, im Turnier für alle im selben Versuch dieselbe. Sie
 * ist immer fliegbar. Jeder Abschnitt legt zuerst einen Weg fest (pfadBei) –
 * nie steiler und nie plötzlicher, als die Fledermaus dort steigen, sinken
 * und umlenken kann – und hält um ihn einen Korridor frei (halbBei): Wände,
 * Tropfsteine, Brocken, Spinnen und Zungen bleiben ausserhalb. Auch die
 * bewegten: Weil das Tempo nur an der Strecke hängt, ist jeder zur selben
 * Zeit an derselben Stelle (zeitBei), und alles, was sich bewegt, bewegt
 * sich nach dieser Weltzeit. Der Autopilot der Prüfung fliegt diesen Weg.
 *
 * Die Gegner (geist.js) fliegen als leuchtende Umrisse mit – so, wie sie in
 * ihrer besten Runde geflogen sind, durch ihre eigene Höhle (a = x, b = y,
 * c = Rufe × 1000 + 500 + Neigung × 100: Innerhalb gleich vieler Rufe ist c
 * ein Winkel und wird weich übergeblendet, ein neuer Ruf springt um 1000).
 * Platz 1 und die eigene Bestmarke stehen dazu als Tor bei ihren Metern.
 * Und die besten Flüge lassen sich anschauen (?zuschauen=, geist.js): durch
 * ihre eigene Höhle, gebaut mit derselben Saat, mit ihren Rufen.
 *
 * Gerechnet wird in Welteinheiten – zehn sind ein Meter, y zählt nach oben.
 * Die Höhle liegt im Band zwischen 0 und BAND; quer füllt das Band die Höhe,
 * hochkant steht darüber und darunter Fels. Was selbst leuchtet, sieht man
 * höchstens SICHT weit voraus – auf jedem Bild gleich weit.
 */
(() => {
  "use strict";

  if (document.body.dataset.page !== "bat") return;

  const host = document.querySelector("#fm-stage");
  const shellApi = window.LernappGameShell;
  const cloudApi = window.LernappGameCloud;
  if (!host || !shellApi) return;

  const kids = () => window.LernappKids || null;
  // Weniger Bewegung? Einmal je Bild gefragt (loop), nicht bei jedem Strich.
  let ruhigJetzt = false;
  const ruhigFragen = () => { ruhigJetzt = Boolean(kids()?.prefersReducedMotion?.()); };
  const ruhig = () => ruhigJetzt;

  // Der Zufall. Ohne Turnier in der Adresse ist das Math.random; in einem
  // Turnier bekommt jeder im selben Versuch dieselbe Höhle. Nur die Höhle
  // zieht daraus – Funken, Staub und Tropfen würfeln Math.random oder hängen
  // an einer festen Zahl, damit die Höhle nicht davon abhängt, wie jemand
  // fliegt.
  const zufall = window.LernappZufall?.fuer?.("batEcho") || {
    neu() {},
    zahl: () => Math.random(),
  };

  // ---------------------------------------------------------------------------
  // Die Welt
  // ---------------------------------------------------------------------------
  const METER = 10;
  const BAND = 300;                // die Höhle liegt zwischen 0 und BAND
  const RAND = 6;                  // so nah kommt der Weg dem Rand des Bandes
  const WELT_W = 300;              // so viel Höhle ist mindestens zu sehen, quer
  const SEG = 16;                  // Abstand der Stützpunkte der Wände
  const VORLAUF = 480;             // so viel Welt liegt links vom Start: draussen und der Eingang
  const MUND = -70;                // hier beginnt die Höhle – der Eingang in der Felswand
  const START = { x: 0, y: BAND / 2 };
  const FM_AN = 0.2;               // so weit vom linken Rand fliegt die Fledermaus
  const EINGANG_BIS = 300;         // bis hier geht es geradeaus, im Mondlicht
  const MOND_BIS = 330;            // so weit fällt Mondlicht in die Höhle
  const TAKT = 1 / 240;            // gerechnet wird in festen kleinen Schritten

  // Der Flug. Ein Flügelschlag setzt das Steigen neu (SCHLAG, bei schnellem
  // Fall etwas weniger), weich über SCHLAG_DAUER verteilt. Dazwischen zieht
  // die Schwerkraft – beim Fallen gebremst vom Luftwiderstand der Flügel:
  // Schneller als VY_FALL sinkt die Fledermaus nie, sie gleitet.
  const G = 380;
  const ZUG = 1.9;                 // Bremse beim Fallen (je s): G / ZUG ist das Gleiten
  const VY_FALL = G / ZUG;
  const SCHLAG = 128;
  const SCHLAG_DAUER = 0.07;
  const VY_MAX = 230;
  const R_FM = 7;                  // so gross trifft die Fledermaus: der Leib, nicht die Flügel
  const FIGUR = 1.35;              // so viel grösser wird sie gezeichnet, als sie trifft

  // Tempo, Korridor und Luft daneben – alles nach der Strecke, in Metern.
  const V0 = 100;
  const V_MAX = 235;
  const V_WEG = 1000;
  const H0 = 56;                   // halbe Breite des Korridors für die Mitte der Fledermaus
  const H_MIN = 21;
  const H_WEG = 700;
  const S0 = 46;                   // so viel Luft liegt neben dem Korridor (höchstens, je Seite)
  const S_MIN = 6;
  const S_WEG = 600;
  const MARGE = 4;                 // und so viel Fels bleibt noch weg
  // Der Weg: nie schneller auf und ab als PFAD_VY, nie steiler als
  // PFAD_STEIL, nie plötzlicher als PFAD_A (Einheiten je s²) – weit unter
  // dem, was die Fledermaus kann (steigen gut 190, sinken 200).
  const PFAD_VY = 105;
  const PFAD_STEIL = 0.72;
  const PFAD_A0 = 140;
  const PFAD_A1 = 220;

  // Der Ruf.
  const RUF_TEMPO = 640;           // so schnell läuft der Ring
  const RUF_R0 = 245;              // so weit reicht er am Anfang …
  const RUF_R_MIN = 172;           // … und später
  const RUF_WEG = 900;
  const FADE0 = 2.3;               // so lange glühen die Kanten nach (s) …
  const FADE_MIN = 1.15;
  const FADE_WEG = 700;
  const KRISTALL_FADE = 2.2;       // Kristalle leuchten so viel länger
  const LADUNG_MAX = 3;
  const LADE0 = 1.4;               // so lange braucht eine Ladung am Anfang (s) …
  const LADE_MAX = 2.5;            // … und später
  const LADE_WEG = 800;
  const SICHT = 270;               // so weit voraus sieht man, was selbst leuchtet

  // Ab wann was kommt (Meter).
  const ZAPFEN_AB = 50;
  const SLALOM_AB = 90;
  const KAMMER_AB = 120;
  const ENGE_AB = 150;
  const SPINNE_AB = 250;
  const FALLER_AB = 380;
  const GABEL_AB = 560;
  const Z_JE = 24;                 // so viele Zufallszahlen zieht jeder Abschnitt, immer gleich viele

  // Die Spinne und der fallende Tropfstein.
  const R_SPINNE = 5.5;
  const G_FALL = 700;
  const WACKELN = 0.7;             // so lange wackelt ein Tropfstein, bevor er fällt (s)

  const TOP_COUNT = 5;
  const store = cloudApi
    ? cloudApi.register({ key: "lernapp.fledermaus", empty: { runs: 0, scores: [] }, merge: cloudApi.mergeScores(TOP_COUNT) })
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
  const meterBei = (x) => Math.max(0, (x - START.x) / METER);
  const nach = (x, weg) => Math.exp(-meterBei(x) / weg);
  const tempoBei = (x) => V0 + (V_MAX - V0) * (1 - nach(x, V_WEG));
  const halbBei = (x) => H_MIN + (H0 - H_MIN) * nach(x, H_WEG);
  const spielBei = (x) => S_MIN + (S0 - S_MIN) * nach(x, S_WEG);
  const schwereBei = (x) => 1 - nach(x, 800);
  const rufWeite = (x) => RUF_R_MIN + (RUF_R0 - RUF_R_MIN) * nach(x, RUF_WEG);
  const fadeBei = (x) => FADE_MIN + (FADE0 - FADE_MIN) * nach(x, FADE_WEG);
  const ladeZeit = (x) => LADE_MAX - (LADE_MAX - LADE0) * nach(x, LADE_WEG);

  /*
   * Die Flugzeit vom Start bis x: das Integral über dx / v(x). Mit
   * v = a − b·e^(−u/c) geht es geschlossen:
   *   t(u) = u/a + (c/a)·ln((a − b·e^(−u/c)) / (a − b)).
   * Nach dieser Zeit bewegt sich alles, was sich in der Höhle bewegt – im
   * Spiel, beim Zuschauen und im Autopiloten dieselbe.
   */
  function zeitBei(x) {
    if (x <= START.x) return (x - START.x) / V0;
    const a = V_MAX;
    const b = V_MAX - V0;
    const c = V_WEG * METER;
    const u = x - START.x;
    return u / a + (c / a) * Math.log((a - b * Math.exp(-u / c)) / (a - b));
  }

  // Immer dieselbe Zahl zu derselben Eingabe: Risse, Kristalle, Pilze und
  // Staub stehen bei jedem Bild am selben Platz, ohne den Zufall anzufassen.
  function hash01(n) {
    const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return x - Math.floor(x);
  }

  // ---------------------------------------------------------------------------
  // Zustand
  // ---------------------------------------------------------------------------
  // phase:   "bereit" (noch nichts getippt), "spiel", "zuschauen", "ende"
  // schritt: "start", "flug", "crash"
  const state = {
    phase: "bereit",
    schritt: "start",
    punkte: 0,            // dasselbe wie meter – die Strecke ist die Punktzahl
    meter: 0,
    fm: { x: START.x, y: START.y, vy: 0, vx: 0, schub: 0, schubA: 0 },
    winkel: 0,            // Neigung der Fledermaus (rad, positiv: Nase hoch)
    dreh: 0,              // wie schnell sie beim Trudeln dreht
    fluegel: 0.3,         // Stellung der Flügel: 1 oben, −1 unten
    schlagZeit: -9,       // wann der letzte Flügelschlag war
    schlagVon: 0.3,       // wo die Flügel da standen
    ladung: LADUNG_MAX,   // Rufe: der ganze Teil ist verfügbar, der Rest lädt
    rufZahl: 0,           // so oft wurde gerufen
    rufe: [],             // die Ringe, die gerade laufen oder nachglühen
    gefangen: 0,          // so viele Glühwürmchen
    schlaege: 0,
    hoehle: null,
    weltZeit: 0,          // die Zeit der Höhle (zeitBei der Fledermaus)
    camX: 0,
    camMix: 0,            // 0: die Kamera zeigt den Eingang, 1: sie folgt der Fledermaus
    crashZeit: 0,
    crashX: 0,
    crashWelt: 0,
    grund: "",
    lampen: [],           // Lichter dieses Bildes: Fledermaus, Pilze, Glühwürmchen, Blitze
    blitze: [],           // Licht, das kurz aufflammt: Aufprall, Fang, Bruch
    teile: [],
    schriften: [],
    stoss: 0,
    blitz: 0,
    lupe: 0,
    rufBlitz: 0,
    leerBis: -9,
    hinweis: false,       // der Satz zum ersten Ruf steht schon da
    zeit: 0,
    echt: 0,
  };

  let shell = null;
  let feld = null;
  let canvas = null;
  let g = null;
  let tipp = null;
  let frame = null;
  let last = 0;
  let stepTimer = null;
  // Die Gegner (geist.js): wer als leuchtender Umriss mitfliegt und als Tor
  // in der Höhle steht.
  let gegner = null;
  // Wer einen Flug anschaut statt zu fliegen (geist.js, zuschauer).
  let zuschauer = null;

  // bildY(y) = oy − y·s: Das Band steht mitten in der freien Fläche.
  const view = { s: 1, dpr: 1, cssW: 0, cssH: 0, w: WELT_W, h: BAND, frei: 0, oy: 0 };

  function clearStep() {
    if (stepTimer) { window.clearTimeout(stepTimer); stepTimer = null; }
  }

  function stopLoop() {
    if (frame) { window.cancelAnimationFrame(frame); frame = null; }
  }

  // ---------------------------------------------------------------------------
  // Klänge (klang.js)
  // ---------------------------------------------------------------------------
  // Beim Zuschauen klingt es wie gespielt. Jeder Klang hat eine Mindestpause
  // in echter Zeit – die Prüfskripte fliegen ganze Höhlen am Stück.
  const klang = () => window.ArcadeKlang || null;
  const zuletzt = new Map();
  function ton(id, o = {}, pause = 80) {
    const ms = performance.now();
    if (ms - (zuletzt.get(id) ?? -1e9) < pause) return;
    zuletzt.set(id, ms);
    klang()?.ton?.(id, o);
  }

  // Eine Kulisse, die mit der Runde läuft: an() jedes Bild – weitergegeben
  // höchstens alle 50 ms, der Takt kommt in kleinen Schritten –, aus() am
  // Ende. Hat die Tafel oder der Neustart sie gestoppt, holt an() sie neu
  // (ohne Ton nur alle zwei Sekunden).
  function schleife(id) {
    let k = null;
    let ms = -1e9;
    let neu = -1e9;
    return {
      an(wert, laut = 1) {
        const jetzt = performance.now();
        if (jetzt - ms < 50) return;
        ms = jetzt;
        if (!k || (!k.laeuft && jetzt - neu > 2000)) { k = klang()?.kulisse?.(id) || null; neu = jetzt; }
        k?.setze(wert);
        k?.laut(laut);
      },
      aus() { k?.stop(); k = null; ms = -1e9; },
    };
  }

  // Die Höhle: Tropfen und Stille, solange sie fliegt. Draussen im Mondlicht
  // leise, drinnen voller.
  const hoehle = schleife("fledermaus.hoehle");
  function klangTakt() {
    const an = state.schritt === "flug" && (state.phase === "spiel" || (state.phase === "zuschauen" && !zuschauer?.fertig?.()));
    if (an) hoehle.an(0.2 + 0.6 * clamp(state.fm.x / MOND_BIS, 0, 1), 0.8);
    else hoehle.aus();
  }

  // ---------------------------------------------------------------------------
  // Die Höhle
  // ---------------------------------------------------------------------------
  /*
   * Die Höhle entsteht in Abschnitten. Jeder Abschnitt zieht Z_JE Zahlen und
   * legt fest:
   *
   *   knoten   den Weg: Punkte, zwischen denen er weich wie eine
   *            Kosinuskurve von einer Höhe zur nächsten geht. Wie lang ein
   *            Stück sein muss, folgt aus dem Tempo dort (laengeFuer).
   *   beulen   wo die Wände vom Weg weg- oder an ihn heranrücken: Kammern,
   *            Engstellen, Platz für Spinnen, die Sackgasse einer Gabel.
   *   dinge    Tropfsteine, Brocken, Spinnen, fallende Tropfsteine.
   *   lichter  Glühwürmchen.
   *   zungen   der Fels zwischen den Zweigen einer Gabel.
   *
   * Die Wände selbst (punkte) sind Stützpunkte im Abstand SEG, oben und
   * unten: der Weg, plus der Korridor, plus Luft (mit weichem Rauschen und
   * den Beulen), plus ein wenig Rauheit – immer nur nach aussen. Getroffen
   * wird genau, was gezeichnet ist: die Linie zwischen den Stützpunkten.
   */
  function neueHoehle() {
    const h = {
      saat: zufall.zahl(),
      phasen: [],
      knoten: [{ x: -VORLAUF - 4 * SEG, y: START.y }],
      ende: -VORLAUF - 4 * SEG,
      abschnitte: [],
      beulen: [],
      dinge: [],
      lichter: [],
      zungen: [],
      verstecke: [],
      zonen: [],
      punkte: [],
      letzteArt: "",
      bodenAussen: 0,
    };
    for (let i = 0; i < 6; i += 1) h.phasen.push(zufall.zahl() * Math.PI * 2);
    return h;
  }

  // Auf einen Stützpunkt gerundet.
  const aufPunkt = (x) => Math.round((x + VORLAUF) / SEG) * SEG - VORLAUF;

  let pfadIndex = 0;
  function pfadBei(x) {
    const h = state.hoehle;
    if (h.ende < x + 1) abschnitteBis(x);
    const kn = h.knoten;
    let i = Math.min(pfadIndex, kn.length - 2);
    if (kn[i].x > x) {
      let lo = 0;
      let hi = i;
      while (hi - lo > 1) {
        const mitte = (lo + hi) >> 1;
        if (kn[mitte].x <= x) lo = mitte; else hi = mitte;
      }
      i = lo;
    } else {
      while (i < kn.length - 2 && kn[i + 1].x <= x) i += 1;
    }
    pfadIndex = i;
    const a = kn[i];
    const b = kn[i + 1];
    if (x <= a.x) return a.y;
    if (x >= b.x) return b.y;
    const u = (x - a.x) / (b.x - a.x);
    return a.y + (b.y - a.y) * (1 - Math.cos(Math.PI * u)) / 2;
  }

  // Das weiche Rauschen der Wände: drei Wellen mit gewürfelten Phasen.
  function rauschen(x, seite) {
    const p = state.hoehle.phasen;
    const o = seite > 0 ? 0 : 3;
    return 0.55 * Math.sin(x * 0.0103 + p[o]) + 0.3 * Math.sin(x * 0.0244 + p[o + 1]) + 0.15 * Math.sin(x * 0.051 + p[o + 2]);
  }

  // Wie tief die Sackgasse einer Gabel an der Stelle x ist: Sie öffnet sich
  // vor der Zunge, ist hinter ihr voll offen und schliesst sich rund bei xz.
  // Von xz bis xz + SEG steigt die Wand durch die Zunge hindurch (versteckt).
  function taschenTiefe(e, x) {
    if (x < e.xa) {
      const s = Math.sin((Math.PI / 2) * (x - e.x0) / (e.xa - e.x0));
      return e.h * s * s;
    }
    if (x <= e.xz - e.rund) return e.h;
    if (x <= e.xz) {
      const u = (x - (e.xz - e.rund)) / e.rund;
      return e.T + (e.h - e.T) * Math.sqrt(Math.max(0, 1 - u * u));
    }
    return e.T * Math.max(0, 1 - (x - e.xz) / SEG);
  }

  function beulenBei(x, seite, ohneTasche) {
    let summe = 0;
    const b = state.hoehle.beulen;
    for (let i = b.length - 1; i >= 0; i -= 1) {
      const e = b[i];
      if (e.x1 < x - 3000) break;
      if (x < e.x0 || x > e.x1 || (e.seite !== seite && e.seite !== 0)) continue;
      if (e.form === "tasche") {
        if (!ohneTasche) summe += taschenTiefe(e, x);
        continue;
      }
      const s = Math.sin(Math.PI * (x - e.x0) / (e.x1 - e.x0));
      summe += e.h * s * s;
    }
    return summe;
  }

  // Die Wand, wie sie ohne Rauheit wäre: oben (seite 1) oder unten (−1).
  function wandAnalytisch(x, seite, ohneTasche = false) {
    const P = pfadBei(x);
    const min = halbBei(x) + R_FM + MARGE;
    const off = Math.max(min, min + spielBei(x) * (0.5 + 0.5 * rauschen(x, seite)) + beulenBei(x, seite, ohneTasche));
    const y = P + seite * off;
    return seite > 0 ? Math.min(y, BAND + 24) : Math.max(y, -24);
  }

  // Die Grenzen des Weges im Band, an der Stelle x.
  const pfadRand = (x) => halbBei(x) + R_FM + MARGE + 6;
  const pfadLo = (x) => RAND + pfadRand(x);
  const pfadHi = (x) => BAND - RAND - pfadRand(x);

  // So lang muss ein Stück Weg sein, das um d steigt oder sinkt.
  function laengeFuer(d, x, minL) {
    const k = schwereBei(x);
    const v = tempoBei(x + 300);
    const A = lerp(PFAD_A0, PFAD_A1, k);
    return Math.max(minL, Math.PI * v * Math.sqrt(d / (2 * A)), (Math.PI / 2) * d * v / PFAD_VY, (Math.PI * d) / (2 * PFAD_STEIL));
  }

  // Wo gebaut wird: Hindernisse fragen den Weg nur innerhalb ihres Abschnitts.
  const bau = { a: 0, b: 0 };
  const imBau = (x) => clamp(x, bau.a, bau.b);

  function knoten(x, y) {
    state.hoehle.knoten.push({ x, y });
  }

  function beule(x0, x1, seite, hoehe) {
    state.hoehle.beulen.push({ x0, x1, seite, h: hoehe, form: "sanft" });
  }

  // Wie viel Platz an der Stelle x zwischen Korridor und Wand bleibt, über
  // die Breite b (und die Fledermaus daneben): need ist der Rand des
  // Korridors, wand die nächste Wand.
  function platzBei(x, b, seite) {
    let need = seite > 0 ? -Infinity : Infinity;
    let wand = seite > 0 ? Infinity : -Infinity;
    const xa = imBau(x - b / 2 - R_FM - 3);
    const xb = imBau(x + b / 2 + R_FM + 3);
    for (let xx = xa; xx <= xb + 0.01; xx += Math.max(2, (xb - xa) / 6)) {
      const p = pfadBei(xx);
      const rand = halbBei(xx) + R_FM + MARGE;
      if (seite > 0) {
        need = Math.max(need, p + rand);
        wand = Math.min(wand, wandAnalytisch(xx, 1));
      } else {
        need = Math.min(need, p - rand);
        wand = Math.max(wand, wandAnalytisch(xx, -1));
      }
    }
    return { need, wand, raum: seite > 0 ? wand - need : need - wand };
  }

  // Ein Tropfstein: oben ein Stalaktit, unten ein Stalagmit. Die Spitze
  // reicht frac des freien Platzes an den Korridor heran.
  function setzeZapfen(x, seite, zl, zb, frac0 = 0.5, frac1 = 0.94) {
    if (x < bau.a + 12 || x > bau.b - 12) return null;
    const b = lerp(10, 22, zb) * (seite > 0 ? 1 : 1.2);
    const p = platzBei(x, b, seite);
    if (p.raum < 14) return null;
    const lang = p.raum * lerp(frac0, frac1, zl);
    const d = {
      art: "zapfen", x, seite, breit: b,
      wand: p.wand, basis: p.wand + seite * 12, spitze: p.wand - seite * lang,
      tipX: x + (zb - 0.5) * b * 0.3,
      x0: x - b / 2, x1: x + b / 2,
      tropft: hash01(x * 0.37 + state.hoehle.saat * 91) < 0.35 && seite > 0,
    };
    state.hoehle.dinge.push(d);
    return d;
  }

  // Ein Felsbrocken: ein runder Buckel auf dem Boden oder an der Decke.
  function setzeBrocken(x, seite, zl, zb) {
    if (x < bau.a + 20 || x > bau.b - 20) return null;
    const b = lerp(22, 40, zb);
    const p = platzBei(x, b, seite);
    if (p.raum < 12) return null;
    const hoch = Math.min(p.raum * lerp(0.55, 0.9, zl), b * 0.75);
    const punkte = [];
    const n = 9;
    const s = state.hoehle.saat * 53 + x * 0.11;
    for (let j = 0; j <= n; j += 1) {
      const w = (Math.PI * j) / n;
      const rx = (b / 2) * (j === 0 || j === n ? 1 : 0.9 + hash01(s + j) * 0.18);
      const ry = hoch * (j === 0 || j === n ? 0 : 0.85 + hash01(s + j * 3.1) * 0.15);
      punkte.push(x + Math.cos(w) * rx, p.wand - seite * Math.sin(w) * ry);
    }
    // Unten (im Fels) geschlossen.
    punkte.push(x - b / 2, p.wand + seite * 10, x + b / 2, p.wand + seite * 10);
    const d = { art: "brocken", x, seite, breit: b, wand: p.wand, spitze: p.wand - seite * hoch, punkte, x0: x - b / 2, x1: x + b / 2 };
    state.hoehle.dinge.push(d);
    return d;
  }

  /*
   * Eine Spinne am Faden. Sie läuft auf und ab, zwischen yTop (oben) und
   * yBot (tief im Korridor) – aber wenn die Fledermaus unter ihr ist
   * (tArr, die Weltzeit dort), ist sie oben: Unter ihr ist dann der Weg
   * frei. Über ihr ist der Faden, und der klebt.
   */
  function setzeSpinne(xs, za, zb, k) {
    if (xs < bau.a + 20 || xs > bau.b - 20) return null;
    const p = platzBei(xs, R_SPINNE * 2, 1);
    const tArr = zeitBei(xs);
    const v = tempoBei(xs);
    const per = lerp(2.3, 1.45, k) * lerp(0.9, 1.1, za);
    const w = (R_SPINNE + R_FM + 3) / v;
    const sink = (1 - Math.cos((2 * Math.PI * w) / per)) / 2;
    const need = p.need + R_SPINNE;
    const yTop = p.wand - 16;
    if (yTop < need + 4) return null;
    const P = pfadBei(xs);
    const boden = wandAnalytisch(xs, -1);
    let yBot = Math.max(boden + R_SPINNE + 8, P - halbBei(xs) * lerp(0.1, 0.8, zb));
    // So tief darf sie nicht, dass sie beim Vorbeiflug schon wieder sinkt.
    if (sink > 0 && yTop - (yTop - yBot) * sink < need) yBot = yTop - (yTop - need) / sink;
    const d = {
      art: "spinne", x: xs, anker: p.wand + 8, yTop, yBot, per, tArr,
      x0: xs - 10, x1: xs + 10, wand: p.wand,
    };
    state.hoehle.dinge.push(d);
    return d;
  }

  /*
   * Ein Tropfstein, der sich löst: Er wackelt WACKELN Sekunden lang (Kalk
   * rieselt und leuchtet), dann fällt er – kurz bevor die Fledermaus unter
   * ihm ist. Er hängt genau so tief, dass er sie im Korridor knapp verfehlt,
   * und schlägt hinter ihr auf.
   */
  function setzeFaller(xf, zl, zb, k) {
    if (xf < bau.a + 20 || xf > bau.b - 20) return null;
    const b = lerp(12, 20, zb);
    const p = platzBei(xf, b, 1);
    const tArr = zeitBei(xf);
    const tFall = tArr - lerp(0.24, 0.13, k) * lerp(0.85, 1.15, zl);
    const tKlar = zeitBei(xf + b / 2 + R_FM + 3);
    const fallBisKlar = 0.5 * G_FALL * (tKlar - tFall) ** 2;
    const spitze = p.need + fallBisKlar + 3;
    if (p.wand - spitze < 18) return null;
    const boden = wandAnalytisch(xf, -1);
    const d = {
      art: "faller", x: xf, seite: 1, breit: b, wand: p.wand, basis: p.wand + 12, spitze,
      tipX: xf + (zb - 0.5) * b * 0.2, tLos: tFall - WACKELN, tFall,
      tBruch: tFall + Math.sqrt((2 * Math.max(4, spitze - boden)) / G_FALL), boden,
      x0: xf - b / 2 - 2, x1: xf + b / 2 + 2, gebrochen: false, gewackelt: false,
    };
    state.hoehle.dinge.push(d);
    return d;
  }

  // Ein Glühwürmchen im Korridor, quer um off · H vom Weg.
  function setzeLicht(x, off) {
    const y = pfadBei(x) + off * halbBei(x);
    state.hoehle.lichter.push({ x, y, phase: hash01(x * 0.71 + state.hoehle.saat * 17) * 6.28, gefangen: -1 });
  }

  // Ein paar Tropfsteine und Brocken im Abschnitt, aus den Zahlen z[i …].
  function zapfenReihe(x0, x1, z, i, k, m, max = 3) {
    if (m < ZAPFEN_AB) return;
    const n = Math.min(max, Math.floor(z[i] * (1.4 + 2.4 * k)));
    for (let j = 0; j < n; j += 1) {
      const x = x0 + ((x1 - x0) * (j + 0.5 + (z[i + 1 + j * 3] - 0.5) * 0.6)) / n;
      const seite = z[i + 2 + j * 3] < 0.5 ? 1 : -1;
      const zl = z[i + 3 + j * 3];
      if (zl > 0.82 && m > ZAPFEN_AB + 30) setzeBrocken(x, seite, (zl - 0.82) / 0.18, z[i + 1 + j * 3]);
      else setzeZapfen(x, seite, zl / 0.82, z[i + 1 + j * 3]);
    }
  }

  function vielleichtLicht(x0, L, z0, z1, z2, k) {
    if (z0 > lerp(0.55, 0.36, k)) return;
    setzeLicht(x0 + L * lerp(0.3, 0.8, z1), (z2 - 0.5) * lerp(0.9, 1.7, k));
  }

  // Welche Art von Abschnitt kommt? Gewichte nach den Metern; dieselbe Art
  // (ausser Kurven) nicht zweimal hintereinander.
  function waehleArt(m, z, letzte, x0) {
    const gewichte = [
      ["kurve", 3],
      ["gerade", 1.4],
      ["slalom", m >= SLALOM_AB ? 2 : 0],
      ["kammer", m >= KAMMER_AB ? 0.8 : 0],
      ["enge", m >= ENGE_AB ? 1.1 : 0],
      ["spinne", m >= SPINNE_AB ? 1.4 : 0],
      ["faller", m >= FALLER_AB ? 1.3 : 0],
      ["gabel", m >= GABEL_AB && gabelPasst(x0) ? 1.25 : 0],
    ].map(([art, w]) => [art, art === letzte && art !== "kurve" ? 0 : w]);
    const summe = gewichte.reduce((s, [, w]) => s + w, 0);
    let rest = z * summe;
    for (const [art, w] of gewichte) {
      if (rest < w) return art;
      rest -= w;
    }
    return "kurve";
  }

  const BAU = {
    // Der Eingang: geradeaus, hoch gewölbt, im Mondlicht. Ein Glühwürmchen
    // zeigt, wie es geht.
    eingang(x0) {
      knoten(EINGANG_BIS, START.y);
      state.hoehle.ende = EINGANG_BIS;
      beule(MUND - 30, MUND + 230, 1, 44);
      beule(MUND + 120, EINGANG_BIS, -1, 18);
      setzeLicht(205, 0.25);
      return x0;
    },

    // Eine Kurve zu einer neuen Höhe, dazu ein paar Tropfsteine.
    kurve(x0, c0, z, m, k) {
      const lo = pfadLo(x0);
      const hi = pfadHi(x0);
      let c1 = lerp(lo, hi, z[1]);
      if (Math.abs(c1 - c0) < 30) c1 = clamp(c0 + (c1 >= c0 ? 30 : -30), lo, hi);
      const L = laengeFuer(Math.abs(c1 - c0), x0, lerp(210, 150, k)) * lerp(1, 1.3, z[2]);
      knoten(x0 + L, c1);
      state.hoehle.ende = x0 + L;
      bau.b = x0 + L;
      zapfenReihe(x0, x0 + L, z, 3, k, m);
      vielleichtLicht(x0, L, z[20], z[21], z[22], k);
    },

    // Fast geradeaus – mit mehr Tropfsteinen und Brocken.
    gerade(x0, c0, z, m, k) {
      const c1 = clamp(c0 + (z[1] - 0.5) * 40, pfadLo(x0), pfadHi(x0));
      const L = laengeFuer(Math.abs(c1 - c0), x0, lerp(240, 180, k)) * lerp(1, 1.4, z[2]);
      knoten(x0 + L, c1);
      state.hoehle.ende = x0 + L;
      bau.b = x0 + L;
      zapfenReihe(x0, x0 + L, z, 3, Math.min(1, k + 0.3), m, 3);
      vielleichtLicht(x0, L, z[20], z[21], z[22], k);
    },

    // Slalom: Der Weg pendelt auf und ab, und wo er tief ist, hängt ein
    // Tropfstein von oben bis knapp an ihn heran – wo er hoch ist, wächst
    // einer von unten.
    slalom(x0, c0, z, m, k) {
      const lo = pfadLo(x0);
      const hi = pfadHi(x0);
      let A = lerp(28, 62, k) * lerp(0.85, 1.1, z[2]);
      A = Math.min(A, (hi - lo) / 2);
      const mitte = clamp(c0, lo + A, hi - A);
      const n = 2 + Math.floor(z[1] * (1.2 + 2 * k));
      let seite = z[3] < 0.5 ? 1 : -1;
      let x = x0;
      let y = c0;
      const extreme = [];
      for (let j = 0; j < n; j += 1) {
        const ziel = mitte + seite * A;
        const L = laengeFuer(Math.abs(ziel - y), x, 110) * lerp(1, 1.25, z[4 + j]);
        x += L;
        y = ziel;
        knoten(x, y);
        extreme.push({ x, seite });
        seite = -seite;
      }
      // Zum Schluss ein Stück geradeaus: Der letzte Tropfstein braucht Platz.
      x += 60;
      knoten(x, y);
      state.hoehle.ende = x;
      bau.b = x;
      beule(x0, x, 1, lerp(18, 34, k));
      beule(x0, x, -1, lerp(18, 34, k));
      extreme.forEach((e, j) => setzeZapfen(e.x, -e.seite, z[8 + j], z[12 + j], 0.84, 0.97));
      vielleichtLicht(x0, x - x0, z[20], z[21], z[22], k);
    },

    // Eine Kammer: Die Wände weichen weit zurück, Kristalle glitzern, lange
    // Tropfsteine hängen weit weg vom Weg – zum Durchatmen.
    kammer(x0, c0, z, m, k) {
      const lo = pfadLo(x0);
      const hi = pfadHi(x0);
      const c1 = lerp(lo, hi, z[1]);
      const L = Math.max(laengeFuer(Math.abs(c1 - c0), x0, 0), lerp(380, 300, k)) * lerp(1, 1.3, z[2]);
      knoten(x0 + L, c1);
      state.hoehle.ende = x0 + L;
      bau.b = x0 + L;
      beule(x0, x0 + L, 1, lerp(50, 95, z[3]));
      beule(x0, x0 + L, -1, lerp(40, 85, z[4]));
      state.hoehle.zonen.push({ x0, x1: x0 + L });
      for (let j = 0; j < 4; j += 1) {
        setzeZapfen(x0 + L * (0.15 + j * 0.22 + (z[5 + j] - 0.5) * 0.12), z[9 + j] < 0.55 ? 1 : -1, z[13 + j], z[17 + j], 0.35, 0.75);
      }
      setzeLicht(x0 + L * lerp(0.35, 0.65, z[21]), (z[22] - 0.5) * 1.2);
    },

    // Eine Engstelle: Die Wände rücken bis an den Korridor heran.
    enge(x0, c0, z, m, k) {
      const c1 = clamp(c0 + (z[1] - 0.5) * 90, pfadLo(x0), pfadHi(x0));
      const L = laengeFuer(Math.abs(c1 - c0), x0, lerp(240, 180, k)) * lerp(1.1, 1.6, z[2]);
      knoten(x0 + L, c1);
      state.hoehle.ende = x0 + L;
      bau.b = x0 + L;
      beule(x0, x0 + L, 1, -S0 * 1.6);
      beule(x0, x0 + L, -1, -S0 * 1.6);
      vielleichtLicht(x0, L, z[20], z[21], z[22], k);
    },

    // Spinnen: Die Decke weicht nach oben, und dort hängen sie am Faden.
    spinne(x0, c0, z, m, k) {
      const c1 = clamp(c0 + (z[1] - 0.5) * 70, pfadLo(x0), pfadHi(x0) - 30);
      const L = Math.max(laengeFuer(Math.abs(c1 - c0), x0, 0), lerp(300, 240, k)) * lerp(1, 1.2, z[2]);
      knoten(x0 + L, c1);
      state.hoehle.ende = x0 + L;
      bau.b = x0 + L;
      beule(x0, x0 + L, 1, lerp(58, 80, z[3]));
      const zwei = z[4] < lerp(0.25, 0.65, k);
      if (zwei) {
        setzeSpinne(x0 + L * lerp(0.26, 0.36, z[5]), z[6], z[7], k);
        setzeSpinne(x0 + L * lerp(0.62, 0.74, z[8]), z[9], z[10], k);
      } else {
        setzeSpinne(x0 + L * lerp(0.4, 0.6, z[5]), z[6], z[7], k);
      }
      if (z[11] < 0.6) setzeZapfen(x0 + L * lerp(0.2, 0.8, z[12]), -1, z[13], z[14]);
      vielleichtLicht(x0, L, z[20], z[21], z[22], k);
    },

    // Tropfsteine, die sich lösen.
    faller(x0, c0, z, m, k) {
      const c1 = clamp(c0 + (z[1] - 0.5) * 60, pfadLo(x0), pfadHi(x0) - 30);
      const L = Math.max(laengeFuer(Math.abs(c1 - c0), x0, 0), lerp(280, 220, k)) * lerp(1, 1.2, z[2]);
      knoten(x0 + L, c1);
      state.hoehle.ende = x0 + L;
      bau.b = x0 + L;
      beule(x0, x0 + L, 1, lerp(45, 70, z[3]));
      setzeFaller(x0 + L * lerp(0.32, 0.46, z[4]), z[5], z[6], k);
      if (z[7] < 0.5) setzeFaller(x0 + L * lerp(0.62, 0.78, z[8]), z[9], z[10], k);
      if (z[11] < 0.5) setzeZapfen(x0 + L * lerp(0.2, 0.8, z[12]), -1, z[13], z[14]);
      vielleichtLicht(x0, L, z[20], z[21], z[22], k);
    },

    /*
     * Eine Gabel: Eine Zunge aus Fels teilt die Höhle in zwei Zweige. Einer
     * geht weiter, der andere endet nach ein paar Metern rund – eine
     * Sackgasse. Wer vorher ruft, sieht, welcher; wer zu früh ruft, sieht
     * nur die Nase der Zunge.
     */
    gabel(x0, c0, z, m, k) {
      const H = halbBei(x0);
      const T = lerp(26, 34, z[1]);
      const PH = 2 * (H + R_FM) + lerp(4, 14, z[2]);
      const S = spielBei(x0);
      const rand = H + R_FM + MARGE;
      const unten = z[3] < 0.5;
      const lo = pfadLo(x0);
      const hi = pfadHi(x0);
      let c1;
      if (unten) {
        const min = RAND + rand + S + T + PH + 4;
        c1 = lerp(Math.max(lo, min), hi, z[4] * 0.35);
      } else {
        const max = BAND - RAND - rand - S - T - PH - 4;
        c1 = lerp(Math.min(hi, max), lo, z[4] * 0.35);
      }
      const Lin = laengeFuer(Math.abs(c1 - c0), x0, lerp(200, 160, k));
      const xa = aufPunkt(x0 + Lin + lerp(24, 50, z[5]));
      const Ltasche = lerp(95, 58, k) * lerp(0.85, 1.15, z[6]);
      const xz = aufPunkt(xa + Ltasche);
      const x1 = xz + SEG * 3 + lerp(30, 70, z[7]);
      knoten(x0 + Lin, c1);
      knoten(x1, c1);
      state.hoehle.ende = x1;
      bau.b = x1;
      const seite = unten ? -1 : 1;
      const offen = xa - lerp(110, 150, z[8]);
      state.hoehle.beulen.push({ x0: Math.max(x0, offen), x1: xz + SEG, seite, h: T + PH, form: "tasche", xa, xz, rund: PH * 0.6, T });
      state.hoehle.verstecke.push({ x: xz, seite });
      baueZunge(xa, xz, seite, T);
      if (z[9] < 0.75) setzeLicht(xa + (xz - xa) * lerp(0.2, 0.8, z[10]), (z[11] - 0.5) * 0.8);
    },
  };

  // Passt eine Gabel überhaupt ins Band? Zwei Zweige und die Zunge brauchen
  // Platz – erst wenn der Korridor schmal genug ist.
  function gabelPasst(x) {
    const H = halbBei(x);
    const zweig = 2 * (H + R_FM) + 14;
    return 2 * (zweig + MARGE) + 34 + spielBei(x) * 2 + 2 * RAND + 16 < BAND;
  }

  /*
   * Die Zunge einer Gabel: zwischen dem Zweig, der weitergeht, und der
   * Sackgasse. Ihre äussere Kante ist die Wand des lebendigen Zweigs (ohne
   * die Tasche), ihre innere die Decke (oder der Boden) der Sackgasse. Vorne
   * ist sie rund wie eine Nase. Rechts steckt sie im Fels – diese Seite wird
   * weder gezeichnet noch gebraucht.
   */
  function baueZunge(xa, xz, seite, T) {
    const x1 = xz + SEG;
    const xs = [];
    const aussen = [];
    const innen = [];
    const nase = T * 0.9;
    for (let x = xa; x <= x1 + 0.01; x += x < xa + nase ? nase / 6 : SEG / 2) {
      const wN = wandAnalytisch(x, seite, true);
      const n = x < xa + nase ? Math.sqrt(Math.max(0, 1 - (1 - (x - xa) / nase) ** 2)) : 1;
      xs.push(x);
      // seite −1 (Sackgasse unten): aussen ist die obere Kante.
      aussen.push(wN + seite * (T / 2) * (1 - n));
      innen.push(wN + seite * (T / 2 + (T / 2) * n));
    }
    // Der Umriss: aussen von hinten bis zur Nase, dann innen bis xz.
    const umriss = [];
    for (let j = xs.length - 1; j >= 0; j -= 1) umriss.push(xs[j], aussen[j]);
    for (let j = 1; j < xs.length && xs[j] <= xz + 0.01; j += 1) umriss.push(xs[j], innen[j]);
    state.hoehle.zungen.push({ xa, xz, x1, seite, T, xs, aussen, innen, umriss });
  }

  function abschnitteBis(x) {
    const h = state.hoehle;
    while (h.ende < x + 1) neuerAbschnitt();
  }

  function neuerAbschnitt() {
    const h = state.hoehle;
    const x0 = h.ende;
    const z = [];
    for (let i = 0; i < Z_JE; i += 1) z.push(zufall.zahl());
    const m = meterBei(x0);
    const k = schwereBei(x0);
    const c0 = h.knoten[h.knoten.length - 1].y;
    const art = x0 < EINGANG_BIS ? "eingang" : waehleArt(m, z[0], h.letzteArt, x0);
    const bauVorher = { a: bau.a, b: bau.b };
    bau.a = x0;
    bau.b = x0 + 2000;
    const vorher = h.dinge.length;
    BAU[art](x0, c0, z, m, k);
    bau.a = bauVorher.a;
    bau.b = bauVorher.b;
    if (h.dinge.length > vorher) h.dinge.sort((a, b) => a.x0 - b.x0);
    h.abschnitte.push({ art, x0, x1: h.ende, y: h.knoten[h.knoten.length - 1].y });
    h.letzteArt = art;
  }

  /*
   * Ein Stützpunkt der Wände, mit allem, was an ihm wächst: Risse und
   * Gesteinsschichten (leuchten mit, wenn der Ruf vorbeikommt), Kristalle
   * (funkeln und leuchten länger nach) und Leuchtpilze (leuchten selbst).
   * Alles aus festen Zahlen (hash01 mit der Saat der Höhle).
   */
  function naechsterPunkt() {
    const h = state.hoehle;
    const i = h.punkte.length;
    const x = i * SEG - VORLAUF;
    abschnitteBis(x + 420);
    if (x < MUND) {
      h.punkte.push({ x, o: BAND + 400, u: h.bodenAussen, aussen: true });
      return;
    }
    const r = (n) => hash01(i * 3.17 + n * 11.31 + h.saat * 917.3);
    const k = schwereBei(x);
    const versteckt = h.verstecke.find((v) => Math.abs(v.x - x) < 1);
    const genau = h.verstecke.find((v) => Math.abs(v.x - x) < 1 || Math.abs(v.x + SEG - x) < 1);
    const rauh = lerp(2.5, 5, k);
    let o = wandAnalytisch(x, 1);
    let u = wandAnalytisch(x, -1);
    if (!(genau && genau.seite > 0)) o += r(1) * rauh;
    if (!(genau && genau.seite < 0)) u -= r(2) * rauh;
    const zone = h.zonen.some((zo) => x >= zo.x0 && x <= zo.x1);
    const pK = zone ? 0.16 : 0.035;
    const pP = x < 520 ? 0.16 : lerp(0.075, 0.02, k);
    const p = {
      x, o, u, aussen: false,
      versteckO: Boolean(versteckt && versteckt.seite > 0),
      versteckU: Boolean(versteckt && versteckt.seite < 0),
      // Risse: Winkel zur Wand und Länge.
      rissO: r(3) < 0.4 ? 6 + r(4) * 16 : 0, rissOw: (r(5) - 0.5) * 1.3,
      rissU: r(6) < 0.4 ? 6 + r(7) * 16 : 0, rissUw: (r(8) - 0.5) * 1.3,
      // Schichten: so tief im Fels läuft eine Linie mit.
      schO: r(9) < 0.55 ? 12 + r(10) * 18 : 0,
      schU: r(11) < 0.55 ? 12 + r(12) * 18 : 0,
      kristallO: r(13) < pK ? 2 + Math.floor(r(14) * 3) : 0,
      kristallU: r(15) < pK ? 2 + Math.floor(r(16) * 3) : 0,
      pilzO: 0,
      pilzU: 0,
      seed: r(17),
      // Licht dieses Bildes, je Seite (zeichneWaende).
      lo: 0, lu: 0, fo: 0, fu: 0, ko: 0, ku: 0,
      funkeO: -1, funkeU: -1,
    };
    if (!p.kristallU && !versteckt && r(18) < pP) p.pilzU = 1 + Math.floor(r(19) * 3);
    if (!p.kristallO && !versteckt && r(20) < pP * 0.35) p.pilzO = 1 + Math.floor(r(21) * 2);
    h.punkte.push(p);
  }

  function hoehleBis(x) {
    const h = state.hoehle;
    while (!h.punkte.length || h.punkte[h.punkte.length - 1].x < x) naechsterPunkt();
  }

  // Die Wände an einer beliebigen Stelle: zwischen zwei Stützpunkten gerade.
  function wandBei(x) {
    const h = state.hoehle;
    hoehleBis(x + SEG * 2);
    const k = (x + VORLAUF) / SEG;
    const i = clamp(Math.floor(k), 0, h.punkte.length - 2);
    const u = clamp(k - i, 0, 1);
    const a = h.punkte[i];
    const b = h.punkte[i + 1];
    return { o: lerp(a.o, b.o, u), u: lerp(a.u, b.u, u) };
  }

  // ---------------------------------------------------------------------------
  // Was sich bewegt
  // ---------------------------------------------------------------------------
  // Die Spinne nach der Weltzeit: oben bei tArr, dazwischen tief.
  const spinneY = (d, wt) => d.yTop - (d.yTop - d.yBot) * (1 - Math.cos((2 * Math.PI * (wt - d.tArr)) / d.per)) / 2;

  // Wie weit ein fallender Tropfstein gefallen ist – und wie er wackelt.
  function fallLage(d, wt) {
    if (wt < d.tLos) return { dy: 0, dx: 0, weg: false };
    if (wt < d.tFall) {
      const u = (wt - d.tLos) / WACKELN;
      return { dy: 0, dx: Math.sin(wt * 55) * (0.4 + u * 1.2) * (ruhig() ? 0.4 : 1), weg: false };
    }
    const dy = 0.5 * G_FALL * (wt - d.tFall) ** 2;
    return { dy, dx: 0, weg: wt >= d.tBruch };
  }

  // ---------------------------------------------------------------------------
  // Treffen
  // ---------------------------------------------------------------------------
  function streckeAbstand(px, py, ax, ay, bx, by) {
    const dx = bx - ax;
    const dy = by - ay;
    const l2 = dx * dx + dy * dy || 1;
    const u = clamp(((px - ax) * dx + (py - ay) * dy) / l2, 0, 1);
    return Math.hypot(px - ax - dx * u, py - ay - dy * u);
  }

  // Liegt (px, py) im Dreieck? Dann negativ, sonst der Abstand zum Rand.
  function dreieckAbstand(px, py, ax, ay, bx, by, cx, cy) {
    const d = Math.min(streckeAbstand(px, py, ax, ay, bx, by), streckeAbstand(px, py, bx, by, cx, cy), streckeAbstand(px, py, cx, cy, ax, ay));
    const s1 = (bx - ax) * (py - ay) - (by - ay) * (px - ax);
    const s2 = (cx - bx) * (py - by) - (cy - by) * (px - bx);
    const s3 = (ax - cx) * (py - cy) - (ay - cy) * (px - cx);
    const innen = (s1 >= 0 && s2 >= 0 && s3 >= 0) || (s1 <= 0 && s2 <= 0 && s3 <= 0);
    return innen ? -d : d;
  }

  function vieleckAbstand(px, py, pts) {
    let d = Infinity;
    let innen = false;
    const n = pts.length / 2;
    for (let i = 0, j = n - 1; i < n; j = i, i += 1) {
      const xi = pts[i * 2];
      const yi = pts[i * 2 + 1];
      const xj = pts[j * 2];
      const yj = pts[j * 2 + 1];
      d = Math.min(d, streckeAbstand(px, py, xj, yj, xi, yi));
      if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) innen = !innen;
    }
    return innen ? -d : d;
  }

  // Der erste Eintrag in dinge, der bei x oder später beginnen könnte.
  function dingeAb(x) {
    const d = state.hoehle.dinge;
    let lo = 0;
    let hi = d.length;
    while (lo < hi) {
      const mitte = (lo + hi) >> 1;
      if (d[mitte].x0 < x) lo = mitte + 1; else hi = mitte;
    }
    return lo;
  }

  /*
   * Wie weit (x, y) vom nächsten Fels ist – negativ, wenn der Punkt drin
   * steckt. wt ist die Weltzeit (für Spinnen und fallende Tropfsteine);
   * ohne Angabe die Zeit, zu der die Fledermaus bei x ist. Woran es lag,
   * steht danach in trefferArt.
   */
  let trefferArt = "wand";
  function abstand(x, y, wt = zeitBei(x)) {
    const h = state.hoehle;
    hoehleBis(x + 80);
    let best = Infinity;
    let art = "wand";
    // Die Wände.
    const k = (x + VORLAUF) / SEG;
    const i = clamp(Math.floor(k), 0, h.punkte.length - 2);
    const u = clamp(k - i, 0, 1);
    const p0 = h.punkte[i];
    const p1 = h.punkte[i + 1];
    const o = lerp(p0.o, p1.o, u);
    const un = lerp(p0.u, p1.u, u);
    if (y >= o) { trefferArt = "wand"; return o - y; }
    if (y <= un) { trefferArt = "wand"; return y - un; }
    const j0 = clamp(Math.floor((x - 26 + VORLAUF) / SEG), 0, h.punkte.length - 2);
    const j1 = clamp(Math.ceil((x + 26 + VORLAUF) / SEG), 0, h.punkte.length - 2);
    for (let j = j0; j < j1; j += 1) {
      const a = h.punkte[j];
      const b = h.punkte[j + 1];
      if (a.o - y < 26 || b.o - y < 26) best = Math.min(best, streckeAbstand(x, y, a.x, a.o, b.x, b.o));
      if (y - a.u < 26 || y - b.u < 26) best = Math.min(best, streckeAbstand(x, y, a.x, a.u, b.x, b.u));
    }
    // Die Zungen der Gabeln.
    for (const zu of h.zungen) {
      if (x < zu.xa - 30 || x > zu.x1 + 30) continue;
      if (x >= zu.xa && x <= zu.x1) {
        let q = zu.xs.findIndex((xx) => xx > x);
        if (q < 0) q = zu.xs.length - 1;
        q = Math.max(1, q);
        const v = (x - zu.xs[q - 1]) / (zu.xs[q] - zu.xs[q - 1] || 1);
        const ya = lerp(zu.aussen[q - 1], zu.aussen[q], v);
        const yi = lerp(zu.innen[q - 1], zu.innen[q], v);
        const lo = Math.min(ya, yi);
        const hi = Math.max(ya, yi);
        if (y >= lo && y <= hi) { trefferArt = "zunge"; return -Math.min(y - lo, hi - y); }
      }
      const um = zu.umriss;
      for (let j = 0; j + 3 < um.length; j += 2) {
        const d = streckeAbstand(x, y, um[j], um[j + 1], um[j + 2], um[j + 3]);
        if (d < best) { best = d; art = "zunge"; }
      }
    }
    // Tropfsteine, Brocken, Spinnen.
    const d = h.dinge;
    for (let j = dingeAb(x - 70); j < d.length && d[j].x0 <= x + 40; j += 1) {
      const e = d[j];
      if (e.x1 < x - 40) continue;
      let a = Infinity;
      if (e.art === "zapfen") {
        a = dreieckAbstand(x, y, e.x - e.breit / 2, e.basis, e.x + e.breit / 2, e.basis, e.tipX, e.spitze);
      } else if (e.art === "faller") {
        const f = fallLage(e, wt);
        if (f.weg) continue;
        a = dreieckAbstand(x, y, e.x - e.breit / 2 + f.dx, e.basis - f.dy, e.x + e.breit / 2 + f.dx, e.basis - f.dy, e.tipX + f.dx, e.spitze - f.dy);
      } else if (e.art === "brocken") {
        a = vieleckAbstand(x, y, e.punkte);
      } else if (e.art === "spinne") {
        const sy = spinneY(e, wt);
        a = Math.hypot(x - e.x, y - sy) - R_SPINNE;
        const faden = streckeAbstand(x, y, e.x, sy, e.x, e.anker) - 0.8;
        if (faden < a) { a = faden; }
      }
      if (a < best) { best = a; art = e.art; }
      if (a < 0) break;
    }
    trefferArt = art;
    return best;
  }

  // ---------------------------------------------------------------------------
  // Der Flug
  // ---------------------------------------------------------------------------
  // Ein Flügelschlag: Er setzt das Steigen neu – weich, über SCHLAG_DAUER.
  // Wer schon steigt, steigt mit einem weiteren Schlag noch schneller; wer
  // schnell fällt, bremst erst einmal.
  function schlagAuf(f) {
    const ziel = f.vy < 0 ? SCHLAG + f.vy * 0.3 : Math.min(VY_MAX, SCHLAG + f.vy * 0.5);
    f.schub = SCHLAG_DAUER;
    f.schubA = (ziel - f.vy) / SCHLAG_DAUER + G;
  }

  // Ein Rechenschritt des Flugs, ohne Wände: vorwärts mit dem Tempo der
  // Strecke, auf und ab nach Flügel und Schwerkraft.
  function fliegeSchritt(f, h) {
    let a = -G;
    if (f.schub > 0) {
      a += f.schubA * Math.min(1, f.schub / h);
      f.schub -= h;
    }
    if (f.vy < 0) a += ZUG * -f.vy;
    f.vy = clamp(f.vy + a * h, -VY_FALL - 5, VY_MAX + 20);
    f.x += tempoBei(f.x) * h;
    f.y += f.vy * h;
  }

  // ---------------------------------------------------------------------------
  // Die Fläche
  // ---------------------------------------------------------------------------
  function buildPlatz() {
    feld = shell.el("div", "fm-feld");
    canvas = document.createElement("canvas");
    canvas.className = "fm-canvas";
    canvas.setAttribute("aria-hidden", "true");
    feld.append(canvas);
    g = canvas.getContext("2d");

    // Die zwei Knöpfe unten links (Ruf) und rechts (Flügelschlag). Gedrückt
    // wird die ganze Hälfte des Bildes – die Knöpfe zeigen nur, wo, und
    // leuchten kurz auf. Vor dem ersten Tipp pulsieren sie.
    tipp = shell.el("div", "fm-tipp");
    tipp.setAttribute("aria-hidden", "true");
    const ns = "http://www.w3.org/2000/svg";
    [
      { klasse: "fm-knopf fm-knopf-ruf", pfade: ["M6.5 12a1.6 1.6 0 1 0 0 .01", "M10.5 7.8a6 6 0 0 1 0 8.4", "M14 4.8a10.2 10.2 0 0 1 0 14.4", "M17.5 2.2a14 14 0 0 1 0 19.6"] },
      { klasse: "fm-knopf fm-knopf-schlag", pfade: ["M12 20V9", "M6.5 13.5 12 8l5.5 5.5", "M3 9.5c2.6.2 4.6-1 6-3.6M21 9.5c-2.6.2-4.6-1-6-3.6"] },
    ].forEach(({ klasse, pfade }) => {
      const knopf = shell.el("span", klasse);
      const svg = document.createElementNS(ns, "svg");
      svg.setAttribute("viewBox", "0 0 24 24");
      pfade.forEach((d) => {
        const pfad = document.createElementNS(ns, "path");
        pfad.setAttribute("d", d);
        pfad.setAttribute("fill", "none");
        pfad.setAttribute("stroke", "currentColor");
        pfad.setAttribute("stroke-width", "2.4");
        pfad.setAttribute("stroke-linecap", "round");
        pfad.setAttribute("stroke-linejoin", "round");
        svg.append(pfad);
      });
      knopf.append(svg);
      tipp.append(knopf);
    });
    feld.append(tipp);
    return feld;
  }

  function messen() {
    if (!canvas || !feld) return;
    const cssW = Math.max(80, feld.clientWidth);
    const cssH = Math.max(80, feld.clientHeight);
    const dpr = clamp(window.devicePixelRatio || 1, 1, 2.5);
    // Auf dem Handy reicht die Leinwand unter die Knöpfe oben (game-shell.js,
    // frei). Gemalt wird dort auch – aber das Band steht darunter.
    const frei = Math.min(cssH * 0.4, shell?.frei?.(canvas) || 0);
    if (cssW === view.cssW && cssH === view.cssH && dpr === view.dpr && frei === view.frei) return;
    view.cssW = cssW;
    view.cssH = cssH;
    view.dpr = dpr;
    view.frei = frei;
    const nutzH = cssH - frei;
    // Das Band füllt die freie Höhe, aber nie weniger als WELT_W in der
    // Breite: Hochkant steht dann Fels darüber und darunter, quer mehr
    // Höhle voraus (was selbst leuchtet, nur bis SICHT).
    view.s = Math.min(cssW / WELT_W, nutzH / (BAND + 16));
    view.w = cssW / view.s;
    view.h = cssH / view.s;
    view.oy = frei + nutzH / 2 + (BAND / 2) * view.s;
    const pw = Math.round(cssW * dpr);
    const ph = Math.round(cssH * dpr);
    if (canvas.width !== pw) canvas.width = pw;
    if (canvas.height !== ph) canvas.height = ph;
    bilder.schluessel = "";
  }

  const bildX = (x) => (x - state.camX) * view.s;
  const bildY = (y) => view.oy - y * view.s;

  const wackelX = () => (ruhig() ? 0 : Math.cos(state.echt * 53) * 4 * state.stoss);
  const wackelY = () => (ruhig() ? 0 : Math.sin(state.echt * 71) * 5 * state.stoss);

  function flachTransform() {
    g.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
  }

  function bildTransform() {
    g.setTransform(view.dpr, 0, 0, view.dpr, wackelX() * view.dpr, wackelY() * view.dpr);
  }

  // Die Kamera: vor dem Start steht die Fledermaus in der Mitte, vor dem
  // Mondlicht; danach folgt das Bild ihr, sie bleibt bei FM_AN.
  function camZiel() {
    const vorne = state.fm.x - FM_AN * view.w;
    const eingang = START.x - 0.5 * view.w;
    const k = state.camMix;
    const weich = k * k * (3 - 2 * k);
    return lerp(eingang, vorne, weich);
  }

  // ---------------------------------------------------------------------------
  // Die gemalten Bilder im Speicher
  // ---------------------------------------------------------------------------
  /*
   * Was sich nicht bewegt, liegt fertig gemalt in Leinwänden, so gross wie
   * das Bild: das Dunkel der Höhle mit der Tiefe dahinter und dem dunkleren
   * Rand, der Himmel vor dem Eingang. Dazu leuchtende Flecken
   * je Farbe, die nur noch kopiert werden.
   */
  const bilder = { schluessel: "", grund: null, himmel: null, glut: {} };

  function leinwand(w, h) {
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return { c, g: c.getContext("2d") };
  }

  function bilderBereit() {
    const schluessel = `${view.cssW}|${view.cssH}|${view.dpr}|${view.s}`;
    if (bilder.schluessel === schluessel) return;
    bilder.schluessel = schluessel;
    const W = canvas.width;
    const H = canvas.height;
    const q = view.dpr;

    // Das Dunkel: kaum Farbe, in der Mitte ein Hauch Violett.
    let l = leinwand(W, H);
    let cg = l.g;
    const mitte = cg.createRadialGradient(W * 0.45, view.oy * q - BAND * view.s * q / 2, 10, W * 0.45, H * 0.5, Math.max(W, H) * 0.8);
    mitte.addColorStop(0, "#0d0a18");
    mitte.addColorStop(0.55, "#07060d");
    mitte.addColorStop(1, "#030207");
    cg.fillStyle = mitte;
    cg.fillRect(0, 0, W, H);
    const rand = cg.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.32, W / 2, H / 2, Math.hypot(W, H) * 0.56);
    rand.addColorStop(0, "rgba(0, 0, 0, 0)");
    rand.addColorStop(1, "rgba(0, 0, 0, 0.7)");
    // Die Tiefe: ferne Säulen und Nebel, kaum zu sehen – weiche Flecken
    // ohne Kanten, fest im Dunkel (eine eigene Ebene, die langsamer
    // vorbeizieht, kostete je Bild einen Durchgang über das ganze Bild).
    const mitteY = view.oy * q - (BAND / 2) * view.s * q;
    const bandH = BAND * view.s * q;
    for (let n = 0; n < 16; n += 1) {
      const x = hash01(n * 7.1 + 3) * W;
      const rx = (16 + hash01(n * 3.3) * 34) * view.s * q;
      const ry = (60 + hash01(n * 5.7) * 110) * view.s * q;
      const y = mitteY + (n % 2 === 0 ? -1 : 1) * bandH * (0.35 + hash01(n * 2.9) * 0.3);
      const a = 0.05 + hash01(n * 1.7) * 0.05;
      cg.save();
      cg.translate(x, y);
      cg.scale(rx / 100, ry / 100);
      const fleckG = cg.createRadialGradient(0, 0, 0, 0, 0, 100);
      fleckG.addColorStop(0, `rgba(78, 58, 140, ${a.toFixed(3)})`);
      fleckG.addColorStop(1, "rgba(78, 58, 140, 0)");
      cg.fillStyle = fleckG;
      cg.fillRect(-100, -100, 200, 200);
      cg.restore();
    }
    // Ringsum dunkler – gleich hier hinein gemalt, nicht als eigene Schicht
    // über allem: Das spart je Bild einen Durchgang über das ganze Bild.
    cg.fillStyle = rand;
    cg.fillRect(0, 0, W, H);
    bilder.grund = l.c;

    // Der Himmel vor dem Eingang: Nacht, Sterne, der Mond mit Hof.
    l = leinwand(W, H);
    cg = l.g;
    const boden = bildY(state.hoehle?.bodenAussen ?? 80) * q;
    const himmel = cg.createLinearGradient(0, 0, 0, boden);
    himmel.addColorStop(0, "#03051a");
    himmel.addColorStop(0.55, "#0c1440");
    himmel.addColorStop(1, "#27306a");
    cg.fillStyle = himmel;
    cg.fillRect(0, 0, W, H);
    cg.fillStyle = "#ffffff";
    for (let n = 0; n < 120; n += 1) {
      cg.globalAlpha = 0.25 + hash01(n * 9.1) * 0.7;
      cg.beginPath();
      cg.arc(hash01(n * 3.7 + 1) * W, hash01(n * 5.3 + 2) * boden * 0.92, (0.4 + hash01(n * 7.7) * 1.1) * q, 0, Math.PI * 2);
      cg.fill();
    }
    cg.globalAlpha = 1;
    bilder.himmel = l.c;

    // Leuchtende Flecken: in der Mitte die Farbe, nach aussen nichts.
    bilder.glut = {};
    const FLECK = { gelb: [214, 255, 110], pilz: [80, 255, 196], auge: [160, 240, 255], violett: [150, 110, 255], rot: [255, 60, 90], mond: [215, 228, 255], warm: [255, 240, 215] };
    Object.entries(FLECK).forEach(([name, [r, gg, b]]) => {
      const n = Math.ceil(64 * q);
      const f = leinwand(n, n);
      const verlauf = f.g.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2);
      verlauf.addColorStop(0, `rgba(${r}, ${gg}, ${b}, 1)`);
      verlauf.addColorStop(0.18, `rgba(${r}, ${gg}, ${b}, 0.55)`);
      verlauf.addColorStop(0.5, `rgba(${r}, ${gg}, ${b}, 0.14)`);
      verlauf.addColorStop(1, `rgba(${r}, ${gg}, ${b}, 0)`);
      f.g.fillStyle = verlauf;
      f.g.fillRect(0, 0, n, n);
      bilder.glut[name] = f.c;
    });
  }

  // Ein leuchtender Fleck mit Radius r (CSS-Pixel), im Bildmassstab.
  function fleck(name, sx, sy, r, alpha) {
    if (alpha <= 0.004 || r <= 0.5) return;
    g.globalAlpha = Math.min(1, alpha);
    g.drawImage(bilder.glut[name], sx - r, sy - r, r * 2, r * 2);
  }

  // ---------------------------------------------------------------------------
  // Licht
  // ---------------------------------------------------------------------------
  /*
   * Wie hell eine Stelle gerade ist, und in welcher Farbe. Am hellsten ist
   * meist ein Ruf: Er trifft eine Stelle im Abstand d nach d / RUF_TEMPO
   * Sekunden, dann glüht sie kurz weiss auf und verblasst über fade
   * Sekunden – erst cyan, dann violett. Dazu die Lampen dieses Bildes (die
   * Augen der Fledermaus, Pilze, Glühwürmchen, Blitze) und am Eingang das
   * Mondlicht. Das Hellste gewinnt.
   */
  const FARBEN = [
    [236, 252, 255],   // 0 frisch: fast weiss
    [92, 232, 255],    // 1 jung: cyan
    [112, 150, 255],   // 2 mittel: blauviolett
    [152, 104, 255],   // 3 alt: violett
    [168, 194, 255],   // 4 Mond
    [80, 255, 196],    // 5 Pilz
    [214, 255, 110],   // 6 Glühwürmchen
    [184, 156, 255],   // 7 Fledermaus
    [255, 238, 214],   // 8 Blitz
  ];
  const STUFEN = 12;
  let lichtFarbe = 0;
  let lichtFrisch = 0;     // wie frisch der hellste Ruf hier ist (1 eben getroffen)

  function mondBei(x) {
    if (x > MOND_BIS || x < MUND - 10) return 0;
    return 0.62 * (1 - (x - MUND) / (MOND_BIS - MUND)) ** 1.5;
  }

  function lichtBei(x, y, fadeMal = 1) {
    let best = mondBei(x);
    lichtFarbe = 4;
    lichtFrisch = 0;
    for (const e of state.rufe) {
      const dx = x - e.x;
      if (dx > e.r || dx < -e.r) continue;
      const d = Math.hypot(dx, y - e.y);
      if (d > e.r) continue;
      const alter = state.zeit - e.t0 - d / RUF_TEMPO;
      if (alter < 0) continue;
      const u = alter / (e.fade * fadeMal);
      if (u >= 1) continue;
      const staerke = (1 - 0.45 * (d / e.r) ** 2) * (u < 0.05 ? 1.35 - u * 4 : ((1 - u) / 0.95) ** 1.6 * 1.15);
      if (staerke > best) {
        best = staerke;
        lichtFarbe = u < 0.06 ? 0 : u < 0.3 ? 1 : u < 0.6 ? 2 : 3;
        lichtFrisch = 1 - u;
      }
    }
    const lampen = state.lampen;
    for (let i = 0; i < lampen.length; i += 1) {
      const l = lampen[i];
      const dx = x - l.x;
      if (dx > l.r || dx < -l.r) continue;
      const d = Math.hypot(dx, y - l.y);
      if (d >= l.r) continue;
      const k = 1 - d / l.r;
      const staerke = l.st * k * k;
      if (staerke > best) { best = staerke; lichtFarbe = l.f; lichtFrisch = 0; }
    }
    return best;
  }

  // Die Lampen dieses Bildes. Sie liegen in einer Liste, die bleibt (kein
  // Müll je Bild).
  const lampenVorrat = [];
  function lampe(x, y, r, st, f) {
    const l = lampenVorrat[state.lampen.length] || (lampenVorrat[state.lampen.length] = {});
    l.x = x; l.y = y; l.r = r; l.st = st; l.f = f;
    state.lampen.push(l);
  }

  // Wie gut man etwas sieht, das selbst leuchtet: bis SICHT voraus ganz,
  // dahinter nichts.
  const nebel = (x) => (state.phase === "bereit" ? 1 : clamp((state.fm.x + SICHT - x) / 70, 0, 1));

  function lampenSammeln() {
    state.lampen.length = 0;
    const f = state.fm;
    // Die Augen der Fledermaus: ein Hauch Licht ringsum.
    lampe(f.x + 5, f.y + 2, 44, state.schritt === "crash" ? 0.18 : 0.3, 7);
    const h = state.hoehle;
    const x0 = state.camX - 60;
    const x1 = state.camX + view.w + 60;
    // Die Pilze.
    const i0 = clamp(Math.floor((x0 + VORLAUF) / SEG), 0, h.punkte.length - 1);
    const i1 = clamp(Math.ceil((x1 + VORLAUF) / SEG), 0, h.punkte.length - 1);
    for (let i = i0; i <= i1; i += 1) {
      const p = h.punkte[i];
      if (p.aussen) continue;
      const n = nebel(p.x);
      if (n <= 0) continue;
      const puls = 0.85 + 0.15 * Math.sin(state.echt * 1.3 + p.seed * 9);
      if (p.pilzU) lampe(p.x, p.u + 5, 46, 0.42 * n * puls, 5);
      if (p.pilzO) lampe(p.x, p.o - 5, 40, 0.36 * n * puls, 5);
    }
    // Die Glühwürmchen.
    for (const l of h.lichter) {
      if (l.x < x0 || l.x > x1 || l.gefangen >= 0) continue;
      const n = nebel(l.x);
      if (n > 0) lampe(l.x, l.y, 38, 0.42 * n * glimmen(l), 6);
    }
    // Was gerade aufblitzt.
    for (const b of state.blitze) {
      const u = (state.zeit - b.t0) / b.dauer;
      if (u >= 0 && u < 1) lampe(b.x, b.y, b.r, b.st * (1 - u) * (1 - u), b.f);
    }
    // Tropfsteine, die wackeln: Kalk rieselt und leuchtet.
    const wt = state.weltZeit;
    for (let j = dingeAb(x0); j < h.dinge.length && h.dinge[j].x0 <= x1; j += 1) {
      const d = h.dinge[j];
      if (d.art !== "faller" || wt < d.tLos || wt > d.tFall + 0.5) continue;
      lampe(d.x, d.wand - 4, 46, wt < d.tFall ? 0.36 + 0.2 * (wt - d.tLos) / WACKELN : 0.5, 8);
    }
  }

  // Wie hell ein Glühwürmchen gerade glimmt.
  const glimmen = (l) => 0.62 + 0.38 * Math.max(0, Math.sin(state.echt * 2.6 + l.phase)) ** 0.6;

  // Wo ein Glühwürmchen gerade ist: ein wenig auf und ab, nach der Weltzeit.
  const lichtX = (l) => l.x + Math.sin(state.weltZeit * 1.7 + l.phase) * 3;
  const lichtY = (l) => l.y + Math.sin(state.weltZeit * 2.3 + l.phase * 1.7) * 4;

  // ---------------------------------------------------------------------------
  // Leuchtende Linien
  // ---------------------------------------------------------------------------
  /*
   * Alle Kanten, die leuchten, kommen in Eimer: je Farbe und Helligkeit
   * einer. Jeder Eimer wird mit zwei Strichen gezeichnet – breit und matt
   * für den Schein, schmal und hell für die Kante. So sind es höchstens ein
   * paar Dutzend Striche je Bild, egal wie viele Kanten leuchten.
   */
  const EIMER = FARBEN.length * STUFEN;
  const eimer = Array.from({ length: EIMER }, () => ({ n: 0, d: new Float32Array(4 * 512), dick: 1 }));
  const STIL = FARBEN.map(([r, gg, b]) => Array.from({ length: STUFEN }, (_, s) => {
    const a = (s + 0.6) / STUFEN;
    return {
      kern: `rgba(${Math.min(255, r + 30)}, ${Math.min(255, gg + 20)}, ${Math.min(255, b + 10)}, ${Math.min(1, a * 1.05).toFixed(3)})`,
      schein: `rgba(${r}, ${gg}, ${b}, ${(a * 0.24).toFixed(3)})`,
    };
  }));

  function eimerLeeren() {
    for (let i = 0; i < EIMER; i += 1) eimer[i].n = 0;
  }

  function strich(x1, y1, x2, y2, L, f) {
    if (L < 0.035) return;
    const s = Math.min(STUFEN - 1, Math.floor(L * STUFEN));
    const e = eimer[f * STUFEN + s];
    if (e.n + 4 > e.d.length) return;
    e.d[e.n] = x1;
    e.d[e.n + 1] = y1;
    e.d[e.n + 2] = x2;
    e.d[e.n + 3] = y2;
    e.n += 4;
  }

  function eimerZeichnen() {
    bildTransform();
    g.lineCap = "round";
    g.lineJoin = "round";
    const s = view.s;
    const schein = Math.max(4.5, 6 * s);
    const kern = Math.max(1.1, 1.05 * s);
    for (let durchgang = 0; durchgang < 2; durchgang += 1) {
      g.globalCompositeOperation = durchgang === 0 ? "lighter" : "source-over";
      g.lineWidth = durchgang === 0 ? schein : kern;
      for (let f = 0; f < FARBEN.length; f += 1) {
        for (let st = 0; st < STUFEN; st += 1) {
          const e = eimer[f * STUFEN + st];
          if (!e.n) continue;
          g.strokeStyle = durchgang === 0 ? STIL[f][st].schein : STIL[f][st].kern;
          g.beginPath();
          let lx = NaN;
          let ly = NaN;
          for (let j = 0; j < e.n; j += 4) {
            if (e.d[j] !== lx || e.d[j + 1] !== ly) g.moveTo(e.d[j], e.d[j + 1]);
            g.lineTo(e.d[j + 2], e.d[j + 3]);
            lx = e.d[j + 2];
            ly = e.d[j + 3];
          }
          g.stroke();
        }
      }
    }
    g.globalCompositeOperation = "source-over";
  }

  // ---------------------------------------------------------------------------
  // Zeichnen
  // ---------------------------------------------------------------------------
  // Das Dunkel ersetzt das letzte Bild ganz: kopieren, nicht überblenden.
  function zeichneGrund() {
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalCompositeOperation = "copy";
    g.drawImage(bilder.grund, 0, 0);
    g.globalCompositeOperation = "source-over";
  }

  /*
   * Draussen vor der Höhle: Nachthimmel mit Mond, ferne Hügel und Tannen,
   * die Wiese. Die Felswand mit dem Eingang, an ihrer Kante Mondlicht, und
   * ein Strahl Mondlicht, der schräg in die Höhle fällt.
   */
  function zeichneEingang() {
    const mx = bildX(MUND);
    if (mx < -40) return;
    const s = view.s;
    const h = state.hoehle;
    const boden = bildY(h.bodenAussen);
    bildTransform();
    g.save();
    g.beginPath();
    g.rect(-20, -20, mx + 22, view.cssH + 40);
    g.clip();
    g.globalAlpha = 1;
    g.drawImage(bilder.himmel, -20, 0, view.cssW + 20, view.cssH);
    // Der Mond, mit Hof – immer im Stück Himmel, das zu sehen ist, und er
    // bleibt langsamer zurück als die Felswand.
    const anfangX = START.x - 0.5 * view.w;
    const mondX = Math.max(18 * s, mx * 0.42) - (state.camX - anfangX) * s * 0.12;
    const mondY = Math.max(view.frei + 40 * s, bildY(BAND - 40));
    g.globalCompositeOperation = "lighter";
    fleck("mond", mondX, mondY, 70 * s, 0.4);
    g.globalAlpha = 1;
    g.globalCompositeOperation = "source-over";
    g.fillStyle = "#eef2ff";
    g.beginPath();
    g.arc(mondX, mondY, 13 * s, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "rgba(170, 180, 215, 0.35)";
    [[-4, 3, 3], [3, -4, 2.2], [4, 4, 1.6]].forEach(([dx, dy, r]) => {
      g.beginPath();
      g.arc(mondX + dx * s, mondY + dy * s, r * s, 0, Math.PI * 2);
      g.fill();
    });
    // Zwei Reihen Hügel, die hintere langsamer.
    [[0.35, "#0c1236", 70, 0.013], [0.62, "#070a22", 38, 0.021]].forEach(([tiefe, farbe, hoch, welle]) => {
      g.fillStyle = farbe;
      g.beginPath();
      g.moveTo(-20, boden + 2);
      for (let sx = -20; sx <= mx + 24; sx += 8) {
        const wx = state.camX * tiefe + sx / s;
        const y = h.bodenAussen + hoch * (0.55 + 0.45 * Math.sin(wx * welle + tiefe * 5)) + 12 * Math.sin(wx * welle * 2.7);
        g.lineTo(sx, bildY(y));
      }
      g.lineTo(mx + 24, boden + 2);
      g.closePath();
      g.fill();
      if (tiefe > 0.5) {
        // Tannen auf der vorderen Reihe.
        for (let n = Math.floor((state.camX * tiefe - 40) / 23); n < (state.camX * tiefe + mx / s + 40) / 23; n += 1) {
          if (hash01(n * 4.3) < 0.45) continue;
          const wx = n * 23 + hash01(n * 1.9) * 10;
          const sx = (wx - state.camX * tiefe) * s;
          const fuss = h.bodenAussen + hoch * (0.55 + 0.45 * Math.sin(wx * welle + tiefe * 5)) + 12 * Math.sin(wx * welle * 2.7) - 2;
          const th = (14 + hash01(n * 2.7) * 16) * s;
          g.beginPath();
          g.moveTo(sx - th * 0.28, bildY(fuss));
          g.lineTo(sx, bildY(fuss) - th);
          g.lineTo(sx + th * 0.28, bildY(fuss));
          g.closePath();
          g.fill();
        }
      }
    });
    // Die Wiese.
    g.fillStyle = "#04050c";
    g.fillRect(-20, boden, mx + 40, view.cssH - boden + 20);
    g.strokeStyle = "rgba(150, 170, 230, 0.5)";
    g.lineWidth = Math.max(1, 0.7 * s);
    g.beginPath();
    for (let wx = Math.floor((state.camX - 20) / 3) * 3; wx < MUND + 4; wx += 3) {
      const hh = hash01(wx * 0.37);
      g.moveTo(bildX(wx), boden + 1);
      g.lineTo(bildX(wx + (hh - 0.5) * 3), boden - (2 + hh * 5) * s);
    }
    g.stroke();
    g.restore();

    // Die Felswand: dunkel, an der Kante vom Mond beschienen.
    const decke = h.punkte.find((p) => !p.aussen);
    if (!decke) return;
    const lippe = decke.o;
    g.fillStyle = "#040308";
    g.beginPath();
    g.moveTo(bildX(MUND + 70), bildY(BAND + 300));
    const kante = [];
    for (let y = BAND + 300; y >= lippe; y -= 14) {
      const versatz = (hash01(y * 0.31) - 0.5) * 9 + (y - lippe) * 0.06;
      kante.push([bildX(MUND - versatz), bildY(y)]);
    }
    kante.push([bildX(MUND + 4), bildY(lippe - 3)]);
    kante.forEach(([x, y]) => g.lineTo(x, y));
    for (let i = h.punkte.indexOf(decke); i < h.punkte.length && h.punkte[i].x <= MUND + 70; i += 1) {
      g.lineTo(bildX(h.punkte[i].x), bildY(h.punkte[i].o));
    }
    g.lineTo(bildX(MUND + 70), bildY(BAND + 300));
    g.closePath();
    g.fill();
    g.strokeStyle = "rgba(190, 205, 255, 0.55)";
    g.lineWidth = Math.max(1, 1.2 * s);
    g.beginPath();
    kante.forEach(([x, y], j) => (j ? g.lineTo(x, y) : g.moveTo(x, y)));
    g.stroke();
    // Ein paar Halme an der Lippe.
    g.strokeStyle = "rgba(120, 150, 210, 0.45)";
    g.beginPath();
    for (let n = 0; n < 7; n += 1) {
      const wx = MUND - 4 + n * 2.2;
      g.moveTo(bildX(wx), bildY(lippe - 2));
      g.lineTo(bildX(wx + (hash01(n * 3.1) - 0.5) * 4), bildY(lippe - 6 - hash01(n * 1.3) * 10));
    }
    g.stroke();

    // Der Mondstrahl: schräg durch den Eingang in die Höhle, dreimal
    // übereinander, jedes Mal schmaler – so hat er weiche Ränder. Draussen
    // ist überall Mondlicht; zu sehen ist der Strahl erst drinnen.
    const unten = decke.u;
    const weit = MUND + (lippe - unten) / 1.05;
    const strahl = g.createLinearGradient(bildX(MUND), 0, bildX(weit + 40), 0);
    strahl.addColorStop(0, "rgba(180, 200, 255, 0.045)");
    strahl.addColorStop(0.6, "rgba(180, 200, 255, 0.018)");
    strahl.addColorStop(1, "rgba(180, 200, 255, 0)");
    g.save();
    g.beginPath();
    g.rect(bildX(MUND + 2), -20, view.cssW + 40, view.cssH + 40);
    g.clip();
    g.globalCompositeOperation = "lighter";
    g.fillStyle = strahl;
    for (let k = 0; k < 3; k += 1) {
      const enger = k * 16;
      g.beginPath();
      g.moveTo(bildX(MUND - 20), bildY(lippe + 12 - enger));
      g.lineTo(bildX(weit + 30 - enger * 1.6), bildY(unten - 4));
      g.lineTo(bildX(MUND - 20), bildY(unten - 4));
      g.closePath();
      g.fill();
    }
    g.restore();
  }

  // Die Wände: Kanten, Risse und Schichten, Kristalle. Was leuchtet, kommt
  // in die Eimer; die Kristalle zeichnen sich selbst.
  function zeichneWaende() {
    const h = state.hoehle;
    const i0 = clamp(Math.floor((state.camX - 40 + VORLAUF) / SEG), 0, h.punkte.length - 2);
    const i1 = clamp(Math.ceil((state.camX + view.w + 40 + VORLAUF) / SEG), 0, h.punkte.length - 2);
    for (let i = i0; i <= i1 + 1; i += 1) {
      const p = h.punkte[i];
      if (p.aussen) { p.lo = 0; p.lu = 0; continue; }
      p.lo = lichtBei(p.x, p.o);
      p.fo = lichtFarbe;
      p.lu = lichtBei(p.x, p.u);
      p.fu = lichtFarbe;
    }
    for (let i = i0; i <= i1; i += 1) {
      const p = h.punkte[i];
      const q = h.punkte[i + 1];
      if (p.aussen || q.aussen) continue;
      const px = bildX(p.x);
      const qx = bildX(q.x);
      if (!p.versteckO) strich(px, bildY(p.o), qx, bildY(q.o), (p.lo + q.lo) / 2, p.lo >= q.lo ? p.fo : q.fo);
      if (!p.versteckU) strich(px, bildY(p.u), qx, bildY(q.u), (p.lu + q.lu) / 2, p.lu >= q.lu ? p.fu : q.fu);
      // Schichten im Fels, schwächer.
      if (p.schO && q.schO && !p.versteckO) strich(px, bildY(p.o + p.schO), qx, bildY(q.o + q.schO), (p.lo + q.lo) * 0.16, p.fo);
      if (p.schU && q.schU && !p.versteckU) strich(px, bildY(p.u - p.schU), qx, bildY(q.u - q.schU), (p.lu + q.lu) * 0.16, p.fu);
      // Risse, vom Rand in den Fels.
      if (p.rissO && p.lo > 0.08) strich(px, bildY(p.o), bildX(p.x + Math.sin(p.rissOw) * p.rissO), bildY(p.o + Math.cos(p.rissOw) * p.rissO), p.lo * 0.5, p.fo);
      if (p.rissU && p.lu > 0.08) strich(px, bildY(p.u), bildX(p.x + Math.sin(p.rissUw) * p.rissU), bildY(p.u - Math.cos(p.rissUw) * p.rissU), p.lu * 0.5, p.fu);
    }
  }

  // Körner im Fels: Im Licht glitzert die Oberfläche ein Stück in den Fels
  // hinein – so sieht er nach Stein aus und nicht nach einer Linie. Das Licht
  // je Stützpunkt hat zeichneWaende eben gerechnet.
  function zeichneKoerner() {
    const h = state.hoehle;
    const i0 = clamp(Math.floor((state.camX - 20 + VORLAUF) / SEG), 0, h.punkte.length - 2);
    const i1 = clamp(Math.ceil((state.camX + view.w + 20 + VORLAUF) / SEG), 0, h.punkte.length - 2);
    bildTransform();
    const s = view.s;
    g.globalCompositeOperation = "lighter";
    for (let i = i0; i <= i1; i += 1) {
      const p = h.punkte[i];
      if (p.aussen) continue;
      for (let seite = -1; seite <= 1; seite += 2) {
        const L = seite > 0 ? p.lo : p.lu;
        if (L < 0.12 || (seite > 0 ? p.versteckO : p.versteckU)) continue;
        const f = seite > 0 ? p.fo : p.fu;
        const y = seite > 0 ? p.o : p.u;
        for (let k = 0; k < 5; k += 1) {
          const hx = hash01(p.seed * 71 + k * 13 + seite);
          const hy = hash01(p.seed * 37 + k * 7 - seite);
          const tief = 2 + hy * hy * 22;
          const st = Math.min(STUFEN - 1, Math.floor(L * (1 - tief / 30) * STUFEN * 0.8));
          if (st < 1) continue;
          g.fillStyle = STIL[f][st].kern;
          const r = (0.5 + hash01(p.seed * 5 + k) * 0.7) * s;
          g.fillRect(bildX(p.x + (hx - 0.5) * SEG) - r, bildY(y + seite * tief) - r, r * 2, r * 2);
        }
      }
    }
    g.globalCompositeOperation = "source-over";
  }

  // Die Zungen der Gabeln: ihr Umriss, Punkt für Punkt beleuchtet.
  function zeichneZungen() {
    const x0 = state.camX - 40;
    const x1 = state.camX + view.w + 40;
    for (const zu of state.hoehle.zungen) {
      if (zu.x1 < x0 || zu.xa > x1) continue;
      const um = zu.umriss;
      let la = lichtBei(um[0], um[1]);
      let fa = lichtFarbe;
      for (let j = 0; j + 3 < um.length; j += 2) {
        const lb = lichtBei(um[j + 2], um[j + 3]);
        const fb = lichtFarbe;
        strich(bildX(um[j]), bildY(um[j + 1]), bildX(um[j + 2]), bildY(um[j + 3]), (la + lb) / 2, la >= lb ? fa : fb);
        la = lb;
        fa = fb;
      }
    }
  }

  // Ein Umriss aus Punkten (Weltkoordinaten) in die Eimer, Punkt für Punkt
  // beleuchtet. mal: so viel heller oder dunkler.
  const umrissPuffer = new Float32Array(64);
  function umrissLicht(pts, n, mal = 1) {
    let la = lichtBei(pts[0], pts[1]) * mal;
    let fa = lichtFarbe;
    for (let j = 0; j + 3 < n; j += 2) {
      const lb = lichtBei(pts[j + 2], pts[j + 3]) * mal;
      const fb = lichtFarbe;
      strich(bildX(pts[j]), bildY(pts[j + 1]), bildX(pts[j + 2]), bildY(pts[j + 3]), (la + lb) / 2, la >= lb ? fa : fb);
      la = lb;
      fa = fb;
    }
  }

  // Der Umriss eines Tropfsteins, von der Wand bis zur Spitze und zurück –
  // leicht gewölbt, mit zwei Ringen aus Kalk.
  function zapfenUmriss(d, dx, dy) {
    const b = d.breit / 2;
    const lang = d.basis - d.spitze;
    const t = (d.basis - d.wand) / lang;
    const ax = d.x - b + dx;
    const bx = d.x + b + dx;
    const ty = d.spitze - dy;
    const by = d.basis - dy;
    const tx = d.tipX + dx;
    const P = umrissPuffer;
    const auf = (x0, y0, x1, y1, u) => [x0 + (x1 - x0) * u, y0 + (y1 - y0) * u];
    const [lx, ly] = auf(ax, by, tx, ty, t);
    const [rx, ry] = auf(bx, by, tx, ty, t);
    const wolb = d.seite * 0.07 * d.breit;
    const [m1x, m1y] = auf(ax, by, tx, ty, (t + 1) / 2);
    const [m2x, m2y] = auf(bx, by, tx, ty, (t + 1) / 2);
    P[0] = lx; P[1] = ly;
    P[2] = m1x - Math.abs(wolb) * 0.6; P[3] = m1y;
    P[4] = tx; P[5] = ty;
    P[6] = m2x + Math.abs(wolb) * 0.6; P[7] = m2y;
    P[8] = rx; P[9] = ry;
    return 10;
  }

  function zeichneDinge() {
    const h = state.hoehle;
    const x0 = state.camX - 60;
    const x1 = state.camX + view.w + 60;
    const wt = state.weltZeit;
    for (let j = dingeAb(x0); j < h.dinge.length && h.dinge[j].x0 <= x1; j += 1) {
      const d = h.dinge[j];
      if (d.x1 < x0) continue;
      if (d.art === "zapfen") {
        const n = zapfenUmriss(d, 0, 0);
        umrissLicht(umrissPuffer, n);
        // Ringe aus Kalk quer über den Tropfstein.
        const L = lichtBei(d.x, (d.wand + d.spitze) / 2);
        if (L > 0.1) {
          const f = lichtFarbe;
          for (const u of [0.35, 0.62]) {
            const y = lerp(d.wand, d.spitze, u);
            const halb = (d.breit / 2) * (1 - u) * 0.85;
            strich(bildX(d.x - halb + (d.tipX - d.x) * u), bildY(y), bildX(d.x + halb + (d.tipX - d.x) * u), bildY(y + d.seite * 1.5), L * 0.4, f);
          }
        }
      } else if (d.art === "faller") {
        const f = fallLage(d, wt);
        if (!f.weg) {
          const n = zapfenUmriss(d, f.dx, f.dy);
          umrissLicht(umrissPuffer, n);
        } else {
          // Liegen geblieben: ein Haufen Bruch am Boden.
          const P = umrissPuffer;
          const b = d.breit * 0.8;
          P[0] = d.x - b; P[1] = d.boden;
          P[2] = d.x - b * 0.4; P[3] = d.boden + 5;
          P[4] = d.x + b * 0.1; P[5] = d.boden + 3;
          P[6] = d.x + b * 0.5; P[7] = d.boden + 6;
          P[8] = d.x + b; P[9] = d.boden;
          umrissLicht(P, 10, 0.8);
        }
      } else if (d.art === "brocken") {
        // Nur der Teil über dem Boden (unter der Decke) wird gezeichnet.
        umrissLicht(d.punkte, d.punkte.length - 4);
        const L = lichtBei(d.x, (d.wand + d.spitze) / 2);
        if (L > 0.1) strich(bildX(d.x - d.breit * 0.15), bildY(lerp(d.wand, d.spitze, 0.75)), bildX(d.x + d.breit * 0.05), bildY(lerp(d.wand, d.spitze, 0.35)), L * 0.45, lichtFarbe);
      } else if (d.art === "spinne") {
        zeichneSpinne(d, wt);
      }
    }
  }

  // Die Spinne: Faden und Leib leuchten nur im Licht; die acht roten Augen
  // sieht man immer (bis SICHT voraus).
  function zeichneSpinne(d, wt) {
    const sy = spinneY(d, wt);
    // Der Faden.
    const lf = lichtBei(d.x, (sy + d.wand) / 2);
    strich(bildX(d.x), bildY(sy + R_SPINNE), bildX(d.x), bildY(d.wand), lf * 0.8, lichtFarbe);
    // Der Leib: ein Kreis aus acht Punkten, dazu acht Beine.
    const P = umrissPuffer;
    for (let j = 0; j <= 10; j += 1) {
      const w = (j / 10) * Math.PI * 2;
      P[j * 2] = d.x + Math.cos(w) * R_SPINNE;
      P[j * 2 + 1] = sy + Math.sin(w) * R_SPINNE * 0.9;
    }
    umrissLicht(P, 22);
    const lb = lichtBei(d.x, sy);
    const fb = lichtFarbe;
    if (lb > 0.06) {
      for (let j = 0; j < 8; j += 1) {
        const seite = j < 4 ? -1 : 1;
        const n = j % 4;
        const zappeln = Math.sin(state.echt * 9 + j * 1.7) * 1.2;
        const kx = d.x + seite * R_SPINNE * 0.7;
        const ky = sy + (n - 1.5) * 1.6;
        const gx = d.x + seite * (R_SPINNE + 4 + n * 0.6);
        const gy = sy + (n - 1.5) * 3.2 + 3 + zappeln;
        const fx = d.x + seite * (R_SPINNE + 6.5 + n * 0.8);
        const fy = sy + (n - 1.5) * 4.4 - 3;
        strich(bildX(kx), bildY(ky), bildX(gx), bildY(gy), lb * 0.75, fb);
        strich(bildX(gx), bildY(gy), bildX(fx), bildY(fy), lb * 0.75, fb);
      }
    }
  }

  // Die Augen der Spinnen: immer da, solange sie in Sicht sind.
  function zeichneSpinnenAugen() {
    const h = state.hoehle;
    const x0 = state.camX - 20;
    const x1 = state.camX + view.w + 20;
    const wt = state.weltZeit;
    const s = view.s;
    bildTransform();
    g.globalCompositeOperation = "lighter";
    for (let j = dingeAb(x0 - 20); j < h.dinge.length && h.dinge[j].x0 <= x1; j += 1) {
      const d = h.dinge[j];
      if (d.art !== "spinne") continue;
      const n = nebel(d.x);
      if (n <= 0) continue;
      const sx = bildX(d.x);
      const sy = bildY(spinneY(d, wt));
      const blinzeln = Math.sin(state.echt * 0.9 + d.x) > 0.97 ? 0.2 : 1;
      fleck("rot", sx, sy - 1.5 * s, 9 * s, 0.55 * n * blinzeln);
      g.globalAlpha = 0.95 * n * blinzeln;
      g.fillStyle = "#ff5a7a";
      for (let a = 0; a < 8; a += 1) {
        const ex = (a % 4 - 1.5) * 1.25 * s;
        const ey = (a < 4 ? -2.2 : -0.9) * s;
        const r = (a === 1 || a === 2 ? 0.75 : 0.5) * s;
        g.beginPath();
        g.arc(sx + ex, sy + ey, Math.max(0.5, r), 0, Math.PI * 2);
        g.fill();
      }
    }
    g.globalAlpha = 1;
    g.globalCompositeOperation = "source-over";
  }

  // Die Kristalle: Splitter, die vom Fels in die Höhle zeigen. Im Licht eines
  // Rufs funkeln sie und leuchten länger nach als der Fels.
  function zeichneKristalle() {
    const h = state.hoehle;
    const i0 = clamp(Math.floor((state.camX - 30 + VORLAUF) / SEG), 0, h.punkte.length - 1);
    const i1 = clamp(Math.ceil((state.camX + view.w + 30 + VORLAUF) / SEG), 0, h.punkte.length - 1);
    bildTransform();
    const s = view.s;
    g.globalCompositeOperation = "lighter";
    for (let i = i0; i <= i1; i += 1) {
      const p = h.punkte[i];
      if (p.aussen) continue;
      for (const seite of [1, -1]) {
        const n = seite > 0 ? p.kristallO : p.kristallU;
        if (!n) continue;
        const y = seite > 0 ? p.o : p.u;
        const L = lichtBei(p.x, y - seite * 4, KRISTALL_FADE);
        const frisch = lichtFrisch;
        const f = lichtFarbe;
        if (L < 0.03) continue;
        // Ein Funke, wenn ein Ruf sie eben trifft.
        if (frisch > 0.97 && f <= 1) {
          const funke = seite > 0 ? p.funkeO : p.funkeU;
          if (funke !== state.rufZahl) {
            if (seite > 0) p.funkeO = state.rufZahl; else p.funkeU = state.rufZahl;
            funkeln(p.x, y - seite * 6, ruhig() ? 1 : 3);
          }
        }
        const [r, gg, b] = f <= 3 ? [190, 245, 255] : FARBEN[f];
        for (let k = 0; k < n; k += 1) {
          const w = (hash01(p.seed * 31 + k * 7) - 0.5) * 1.3 + (seite > 0 ? Math.PI : 0);
          const lang = (5 + hash01(p.seed * 17 + k * 3) * 7) * s;
          const breit = (1.4 + hash01(p.seed * 13 + k) * 1.4) * s;
          const fx = bildX(p.x + (k - (n - 1) / 2) * 3.2);
          const fy = bildY(y) + seite * 1.5 * s;
          const dx = Math.sin(w);
          const dy = -Math.cos(w);
          g.fillStyle = `rgba(${r}, ${gg}, ${b}, ${Math.min(0.9, L * 0.75).toFixed(3)})`;
          g.beginPath();
          g.moveTo(fx - dy * breit, fy + dx * breit);
          g.lineTo(fx + dx * lang * 0.75 - dy * breit * 0.8, fy + dy * lang * 0.75 + dx * breit * 0.8);
          g.lineTo(fx + dx * lang, fy + dy * lang);
          g.lineTo(fx + dx * lang * 0.75 + dy * breit * 0.8, fy + dy * lang * 0.75 - dx * breit * 0.8);
          g.lineTo(fx + dy * breit, fy - dx * breit);
          g.closePath();
          g.fill();
        }
        fleck("auge", bildX(p.x), bildY(y) + seite * 4 * s, 14 * s, L * 0.35);
        g.globalAlpha = 1;
      }
    }
    g.globalCompositeOperation = "source-over";
  }

  // Die Leuchtpilze: Stiel und Hut, sanft pulsierend, mit einem Hof.
  function zeichnePilze() {
    const h = state.hoehle;
    const i0 = clamp(Math.floor((state.camX - 30 + VORLAUF) / SEG), 0, h.punkte.length - 1);
    const i1 = clamp(Math.ceil((state.camX + view.w + 30 + VORLAUF) / SEG), 0, h.punkte.length - 1);
    bildTransform();
    const s = view.s;
    for (let i = i0; i <= i1; i += 1) {
      const p = h.punkte[i];
      if (p.aussen || (!p.pilzO && !p.pilzU)) continue;
      const n = nebel(p.x);
      if (n <= 0) continue;
      const puls = 0.8 + 0.2 * Math.sin(state.echt * 1.3 + p.seed * 9);
      for (const seite of [-1, 1]) {
        const anzahl = seite > 0 ? p.pilzO : p.pilzU;
        if (!anzahl) continue;
        const y = seite > 0 ? p.o : p.u;
        g.globalCompositeOperation = "lighter";
        fleck("pilz", bildX(p.x), bildY(y - seite * 5), 30 * s, 0.32 * n * puls);
        g.globalCompositeOperation = "source-over";
        for (let k = 0; k < anzahl; k += 1) {
          const hh = hash01(p.seed * 41 + k * 5);
          const fx = bildX(p.x + (k - (anzahl - 1) / 2) * 5 + (hh - 0.5) * 3);
          const fy = bildY(y) + seite * 1.2 * s;
          const stiel = (3.5 + hh * 5) * s;
          const hut = (2.4 + hash01(p.seed * 7 + k) * 2.4) * s;
          const ton = hash01(p.seed * 3 + k * 11);
          const farbe = ton < 0.5 ? [90, 255, 200] : ton < 0.8 ? [110, 220, 255] : [190, 255, 130];
          g.globalAlpha = n * (0.7 + 0.3 * puls);
          g.strokeStyle = `rgba(${farbe[0]}, ${farbe[1]}, ${farbe[2]}, 0.55)`;
          g.lineWidth = Math.max(1, 0.9 * s);
          g.beginPath();
          g.moveTo(fx, fy);
          g.lineTo(fx + (hh - 0.5) * 2 * s, fy + seite * stiel);
          g.stroke();
          g.fillStyle = `rgb(${farbe[0]}, ${farbe[1]}, ${farbe[2]})`;
          g.beginPath();
          g.ellipse(fx + (hh - 0.5) * 2 * s, fy + seite * stiel, hut, hut * 0.62, 0, seite > 0 ? 0 : Math.PI, seite > 0 ? Math.PI : Math.PI * 2);
          g.fill();
          g.fillStyle = "rgba(255, 255, 255, 0.75)";
          g.beginPath();
          g.arc(fx + (hh - 0.5) * 2 * s - hut * 0.3, fy + seite * (stiel + hut * 0.3), Math.max(0.5, hut * 0.18), 0, Math.PI * 2);
          g.fill();
        }
      }
    }
    g.globalAlpha = 1;
  }

  // Die Glühwürmchen: ein gelbgrüner Punkt mit Hof, der glimmt.
  function zeichneLichter() {
    const h = state.hoehle;
    const x0 = state.camX - 30;
    const x1 = state.camX + view.w + 30;
    bildTransform();
    const s = view.s;
    g.globalCompositeOperation = "lighter";
    for (const l of h.lichter) {
      if (l.x < x0 || l.x > x1 || l.gefangen >= 0) continue;
      const n = nebel(l.x);
      if (n <= 0) continue;
      const gl = glimmen(l);
      const sx = bildX(lichtX(l));
      const sy = bildY(lichtY(l));
      fleck("gelb", sx, sy, 26 * s * (0.8 + gl * 0.3), 0.45 * n * gl);
      fleck("gelb", sx, sy, 7 * s, 0.9 * n);
      g.globalAlpha = n;
      g.fillStyle = "#fbffe0";
      g.beginPath();
      g.arc(sx, sy, Math.max(1, 1.5 * s), 0, Math.PI * 2);
      g.fill();
      // Flügelchen, ganz fein.
      const schlag = Math.sin(state.echt * 40 + l.phase) * 1.6 * s;
      g.globalAlpha = 0.45 * n;
      g.fillStyle = "#e6ffd0";
      g.beginPath();
      g.ellipse(sx - 1 * s, sy - 1.5 * s - schlag * 0.3, 1.8 * s, Math.max(0.4, Math.abs(schlag) * 0.6 + 0.3), 0.4, 0, Math.PI * 2);
      g.fill();
    }
    g.globalAlpha = 1;
    g.globalCompositeOperation = "source-over";
  }

  // Staub in der Luft: unsichtbar, ausser wo Licht ist – um die Fledermaus,
  // im Mondstrahl, und wo der Ring eines Rufs gerade durchläuft.
  function zeichneStaub() {
    const s = view.s;
    const f = state.fm;
    bildTransform();
    g.globalCompositeOperation = "lighter";
    const c0 = Math.floor((state.camX - 20) / 64);
    const c1 = Math.ceil((state.camX + view.w + 20) / 64);
    for (let c = c0; c <= c1; c += 1) {
      for (let k = 0; k < 7; k += 1) {
        const n = c * 7 + k;
        const x = c * 64 + hash01(n * 1.31) * 64 + Math.sin(state.echt * 0.3 + n) * 6;
        const y = -20 + hash01(n * 2.71) * (BAND + 40) + Math.sin(state.echt * 0.23 + n * 1.7) * 5 - ((state.echt * (2 + hash01(n) * 3)) % 30);
        let L = 0;
        // Um die Fledermaus.
        const df = Math.hypot(x - f.x, y - f.y);
        if (df < 50) L = (1 - df / 50) * 0.5;
        // Im Mondlicht.
        L = Math.max(L, mondBei(x) * 0.7 * (y < BAND - 40 ? 1 : 0));
        // Wo ein Ring gerade ist.
        for (const e of state.rufe) {
          const r = (state.zeit - e.t0) * RUF_TEMPO;
          if (r > e.r + 10) continue;
          const d = Math.hypot(x - e.x, y - e.y);
          const band = Math.abs(d - r);
          if (band < 14) L = Math.max(L, (1 - band / 14) * (1 - r / (e.r + 10)) * 1.1);
        }
        if (L < 0.04) continue;
        g.globalAlpha = Math.min(1, L);
        g.fillStyle = L > 0.7 ? "#e8fbff" : "#9fdcff";
        const r = (0.5 + hash01(n * 3.9) * 0.8) * s;
        g.fillRect(bildX(x) - r, bildY(y) - r, r * 2, r * 2);
      }
    }
    g.globalAlpha = 1;
    g.globalCompositeOperation = "source-over";
  }

  // Tropfen aus manchen Tropfsteinen: Sie glitzern im Fall und schlagen am
  // Boden kleine Ringe – nur zum Schauen.
  function zeichneTropfen() {
    const h = state.hoehle;
    const x0 = state.camX - 20;
    const x1 = state.camX + view.w + 20;
    const s = view.s;
    bildTransform();
    g.globalCompositeOperation = "lighter";
    for (let j = dingeAb(x0 - 20); j < h.dinge.length && h.dinge[j].x0 <= x1; j += 1) {
      const d = h.dinge[j];
      if (d.art !== "zapfen" || !d.tropft) continue;
      const n = nebel(d.x);
      if (n <= 0) continue;
      const boden = wandBei(d.tipX).u;
      const fall = Math.max(4, d.spitze - boden);
      const tFall = Math.sqrt((2 * fall) / 600);
      const per = 1.3 + hash01(d.x) * 1.4;
      const t = (state.echt + hash01(d.x * 3) * per) % per;
      if (t < tFall) {
        const y = d.spitze - 300 * t * t;
        fleck("auge", bildX(d.tipX), bildY(y), 5 * s, 0.5 * n);
      } else if (t < tFall + 0.45) {
        const u = (t - tFall) / 0.45;
        g.globalAlpha = (1 - u) * 0.6 * n;
        g.strokeStyle = "#8fe9ff";
        g.lineWidth = Math.max(1, 0.8 * s);
        g.beginPath();
        g.ellipse(bildX(d.tipX), bildY(boden) - 1, (2 + u * 9) * s, (0.6 + u * 1.8) * s, 0, 0, Math.PI * 2);
        g.stroke();
        g.globalAlpha = 1;
      }
    }
    g.globalCompositeOperation = "source-over";
  }

  // Die Ringe der Rufe: eine weiche Druckwelle, darin eine helle, leicht
  // zitternde Linie. Vor dem Maul drei kleine Bögen.
  function zeichneRufe() {
    if (!state.rufe.length) return;
    bildTransform();
    const s = view.s;
    g.globalCompositeOperation = "lighter";
    for (const e of state.rufe) {
      const alter = state.zeit - e.t0;
      const r = alter * RUF_TEMPO;
      const sx = bildX(e.x);
      const sy = bildY(e.y);
      if (alter < 0.32) {
        // Die Bögen vor dem Maul.
        g.strokeStyle = `rgba(220, 250, 255, ${(0.85 * (1 - alter / 0.32)).toFixed(3)})`;
        g.lineWidth = Math.max(1, 1.3 * s);
        for (let k = 0; k < 3; k += 1) {
          const rr = (4 + k * 4 + alter * 60) * s;
          g.beginPath();
          g.arc(sx + 6 * s, sy - 1 * s, rr, -0.6, 0.6);
          g.stroke();
        }
      }
      if (r > e.r + 30) continue;
      const a = clamp(1 - r / e.r, 0, 1) ** 0.6 * (r > e.r ? Math.max(0, 1 - (r - e.r) / 30) : 1);
      if (a <= 0.01) continue;
      const rs = r * s;
      // Die Druckwelle: hinten violett, vorne cyan.
      const welle = g.createRadialGradient(sx, sy, Math.max(0, rs * 0.62), sx, sy, rs + 3 * s);
      welle.addColorStop(0, "rgba(90, 200, 255, 0)");
      welle.addColorStop(0.55, `rgba(120, 90, 255, ${(0.06 * a).toFixed(3)})`);
      welle.addColorStop(0.9, `rgba(110, 200, 255, ${(0.2 * a).toFixed(3)})`);
      welle.addColorStop(0.97, `rgba(170, 245, 255, ${(0.42 * a).toFixed(3)})`);
      welle.addColorStop(1, "rgba(170, 245, 255, 0)");
      g.fillStyle = welle;
      // Nur der Ring, nicht das ganze Quadrat: innen ist sie ohnehin leer.
      g.beginPath();
      g.arc(sx, sy, rs + 3 * s, 0, Math.PI * 2);
      g.arc(sx, sy, Math.max(0, rs * 0.62), 0, Math.PI * 2, true);
      g.fill("evenodd");
      // Die Linie, mit einem leichten Zittern: einmal breit und matt, einmal
      // schmal und hell.
      const zittern = ruhig() ? 0 : 1;
      g.beginPath();
      const N = 80;
      for (let k = 0; k <= N; k += 1) {
        const w = (k / N) * Math.PI * 2;
        const rr = rs * (1 + zittern * (0.012 * Math.sin(5 * w + state.echt * 7 + e.t0) + 0.008 * Math.sin(9 * w - state.echt * 11)));
        const x = sx + Math.cos(w) * rr;
        const y = sy + Math.sin(w) * rr;
        if (k) g.lineTo(x, y); else g.moveTo(x, y);
      }
      g.strokeStyle = `rgba(120, 220, 255, ${(0.22 * a).toFixed(3)})`;
      g.lineWidth = Math.max(3, 5 * s);
      g.stroke();
      g.strokeStyle = `rgba(225, 252, 255, ${(0.85 * a).toFixed(3)})`;
      g.lineWidth = Math.max(1.2, 1.6 * s);
      g.stroke();
      // Zwei schwächere Ringe dahinter.
      if (rs > 20 * s) {
        g.lineWidth = Math.max(1, 1 * s);
        g.strokeStyle = `rgba(150, 120, 255, ${(0.32 * a).toFixed(3)})`;
        g.beginPath();
        g.arc(sx, sy, rs * 0.87, 0, Math.PI * 2);
        g.stroke();
        g.strokeStyle = `rgba(150, 120, 255, ${(0.14 * a).toFixed(3)})`;
        g.beginPath();
        g.arc(sx, sy, rs * 0.74, 0, Math.PI * 2);
        g.stroke();
      }
    }
    g.globalCompositeOperation = "source-over";
  }

  /*
   * Die Fledermaus, in Welteinheiten um ihren Leib (0, 0), nach rechts
   * fliegend, y nach oben. fluegel: 1 ganz oben, −1 ganz unten. art "echt"
   * ist die Fledermaus selbst (dunkles Fell, Flughäute, Augen, die
   * leuchten), "geist" ein Umriss aus Licht in der Farbe des Gegners.
   */
  const FLUEGEL = [-1, 11, 7, 19, -4, 22.5, -12, 18, -15.5, 9, -8.5, 0.5];
  const fluegelPunkte = new Float32Array(12);
  function fluegelPfad(sx0, sy0, a, mass) {
    const P = fluegelPunkte;
    const flach = 1 - Math.abs(a);
    for (let j = 0; j < 12; j += 2) {
      const px = FLUEGEL[j];
      const py = FLUEGEL[j + 1];
      P[j] = sx0 + (px - flach * py * 0.2) * mass;
      P[j + 1] = sy0 + py * a * mass;
    }
    const zacke = (ax, ay, bx, by, zu) => {
      const mx = (ax + bx) / 2;
      const my = (ay + by) / 2;
      g.quadraticCurveTo(mx + (P[0] - mx) * zu, my + (P[1] - my) * zu, bx, by);
    };
    g.moveTo(sx0, sy0);
    g.lineTo(P[0], P[1]);
    g.lineTo(P[2], P[3]);
    zacke(P[2], P[3], P[4], P[5], 0.32);
    zacke(P[4], P[5], P[6], P[7], 0.3);
    zacke(P[6], P[7], P[8], P[9], 0.3);
    const mx = (P[8] + P[10]) / 2;
    const my = (P[9] + P[11]) / 2;
    g.quadraticCurveTo(mx + (sx0 - mx) * 0.25, my + (sy0 - my) * 0.25, P[10], P[11]);
    g.closePath();
  }

  function fluegelKnochen(sx0, sy0) {
    const P = fluegelPunkte;
    g.moveTo(sx0, sy0);
    g.lineTo(P[0], P[1]);
    for (let j = 2; j <= 8; j += 2) {
      g.moveTo(P[0], P[1]);
      g.lineTo(P[j], P[j + 1]);
    }
  }

  function leibPfad() {
    g.ellipse(0, 0, 7.6, 5.4, 0.08, 0, Math.PI * 2);
    g.moveTo(11.1, 1.8);
    g.arc(6.8, 1.8, 4.3, 0, Math.PI * 2);
  }

  function ohrenPfad() {
    g.moveTo(5, 4.6);
    g.lineTo(4.3, 10.6);
    g.lineTo(7.2, 5.6);
    g.closePath();
    g.moveTo(7.6, 4.9);
    g.lineTo(8.9, 10.2);
    g.lineTo(9.9, 4.5);
    g.closePath();
    // Das Schwänzchen mit der Haut.
    g.moveTo(-6.8, -1.2);
    g.lineTo(-11.5, -3.6);
    g.lineTo(-6.4, -4.2);
    g.closePath();
  }

  function maleFledermaus(x, y, winkel, fluegel, art, farbe = "", alpha = 1) {
    const s = view.s * FIGUR;
    g.save();
    g.translate(bildX(x), bildY(y));
    g.scale(s, -s);
    g.rotate(winkel);
    const fern = clamp(fluegel + 0.12, -1, 1);
    if (art === "geist") {
      g.globalAlpha = alpha;
      g.strokeStyle = farbe;
      g.lineWidth = 1.3 / s;
      g.lineJoin = "round";
      g.beginPath();
      fluegelPfad(3, 3.2, fern, 0.82);
      g.stroke();
      g.beginPath();
      leibPfad();
      ohrenPfad();
      fluegelPfad(1.5, 2.5, fluegel, 1);
      g.stroke();
      g.fillStyle = farbe;
      g.beginPath();
      g.arc(9.2, 2.6, 1.2, 0, Math.PI * 2);
      g.fill();
      g.restore();
      return;
    }
    // Der ferne Flügel, dunkler, hinter dem Leib.
    g.fillStyle = "rgba(34, 24, 56, 0.96)";
    g.beginPath();
    fluegelPfad(3, 3.2, fern, 0.82);
    g.fill();
    g.strokeStyle = "rgba(140, 115, 220, 0.45)";
    g.lineWidth = 0.9 / s;
    g.stroke();
    // Der Leib mit Kopf, Ohren und Schwänzchen.
    g.fillStyle = "#2b2140";
    g.beginPath();
    leibPfad();
    g.fill();
    g.beginPath();
    ohrenPfad();
    g.fill();
    g.strokeStyle = `rgba(190, 165, 255, ${(0.6 + state.rufBlitz * 0.4).toFixed(3)})`;
    g.lineWidth = 1 / s;
    g.beginPath();
    leibPfad();
    ohrenPfad();
    g.stroke();
    // Fell: ein paar Striche.
    g.strokeStyle = "rgba(120, 100, 170, 0.5)";
    g.beginPath();
    for (let k = 0; k < 4; k += 1) {
      g.moveTo(-4 + k * 2.4, -2.5);
      g.lineTo(-3 + k * 2.4, -0.8);
    }
    g.stroke();
    // Der nahe Flügel, vor dem Leib.
    const haut = g.createLinearGradient(0, 0, 0, 22 * Math.sign(fluegel || 1));
    haut.addColorStop(0, "rgba(64, 44, 104, 0.97)");
    haut.addColorStop(1, "rgba(92, 64, 150, 0.92)");
    g.fillStyle = haut;
    g.beginPath();
    fluegelPfad(1.5, 2.5, fluegel, 1);
    g.fill();
    g.strokeStyle = `rgba(200, 180, 255, ${(0.55 + state.rufBlitz * 0.45).toFixed(3)})`;
    g.lineWidth = 1 / s;
    g.stroke();
    g.strokeStyle = "rgba(170, 150, 235, 0.65)";
    g.lineWidth = 0.8 / s;
    g.beginPath();
    fluegelKnochen(1.5, 2.5);
    g.stroke();
    // Die Augen: hell, mit Hof.
    g.globalCompositeOperation = "lighter";
    g.globalAlpha = 0.9;
    g.drawImage(bilder.glut.auge, 9.2 - 6, 2.6 - 6, 12, 12);
    g.globalAlpha = 1;
    g.fillStyle = "#f2fdff";
    g.beginPath();
    g.arc(9.2, 2.6, 1.15, 0, Math.PI * 2);
    g.arc(7.4, 3.1, 0.75, 0, Math.PI * 2);
    g.fill();
    g.globalCompositeOperation = "source-over";
    g.restore();
  }

  function zeichneFledermaus() {
    const f = state.fm;
    bildTransform();
    const s = view.s;
    // Ein violetter Hof um die Fledermaus – sie ist das Hellste im Bild.
    g.globalCompositeOperation = "lighter";
    fleck("violett", bildX(f.x), bildY(f.y), 34 * s, 0.22 + state.rufBlitz * 0.35);
    g.globalAlpha = 1;
    g.globalCompositeOperation = "source-over";
    maleFledermaus(f.x, f.y, state.winkel, state.fluegel, "echt");
  }

  // Die Gegner als leuchtende Umrisse (geist.js) – durch ihre eigene Höhle.
  function zeichneGeister() {
    if (!gegner || state.phase === "bereit") return;
    const orte = window.LernappGeist?.orte?.(gegner) || [];
    if (!orte.length) return;
    bildTransform();
    const s = view.s;
    g.globalCompositeOperation = "lighter";
    orte.forEach((o, n) => {
      // Wem im Live-Modus zugeschaut wird, der ist die Figur selbst – kein
      // Geist dazu, nur sein Name (geist.js, namen).
      if (o.ziel) return;
      const c = Math.round(o.c || 0);
      const winkel = c >= 300 ? clamp(((c % 1000) - 500) / 100, -1.3, 1.3) : 0;
      const steigt = (o.db || 0) > 0;
      const fl = steigt ? Math.sin(state.echt * 16 + n) : 0.3 + 0.08 * Math.sin(state.echt * 3 + n);
      fleck("violett", bildX(o.a), bildY(o.b), 22 * s, 0.18 * o.blass);
      maleFledermaus(o.a, o.b, winkel, fl, "geist", o.farbe, 0.75 * o.blass);
    });
    g.globalAlpha = 1;
    g.globalCompositeOperation = "source-over";
    window.LernappGeist.namen(g, orte.map((o) => {
      const dx = o.a - state.fm.x;
      return { ...o, sx: bildX(o.a), sy: bildY(o.b) - 14 * s, weit: `${dx > 0 ? "+" : ""}${Math.round(dx / METER)} m` };
    }), { breit: view.cssW, hoch: view.cssH });
  }

  // Platz 1 und die eigene Bestmarke: ein Tor aus Licht bei ihren Metern,
  // über die ganze Höhe – es verrät nichts über die Wände.
  function zeichneTore() {
    const ziele = (gegner?.gegner?.() || []).filter((ziel) => ziel.art !== "alle");
    if (!ziele.length) return;
    bildTransform();
    const gross = Math.round(clamp(view.cssH * 0.032, 10, 13));
    g.font = `800 ${gross}px system-ui, sans-serif`;
    g.textAlign = "center";
    g.textBaseline = "top";
    ziele.forEach((ziel) => {
      const x = START.x + ziel.punkte * METER;
      if (x < state.camX - 20 || x > state.camX + view.w + 20) return;
      const sx = bildX(x);
      const geschlagen = state.punkte > ziel.punkte;
      g.globalAlpha = geschlagen ? 0.3 : 0.8;
      g.strokeStyle = ziel.farbe;
      g.lineWidth = 2;
      g.setLineDash([7, 7]);
      g.beginPath();
      g.moveTo(sx, view.frei + 26);
      g.lineTo(sx, view.cssH);
      g.stroke();
      g.setLineDash([]);
      const text = ziel.art === "eigen" ? `Bestmarke ${ziel.punkte} m` : `${ziel.name} ${ziel.punkte} m`;
      g.lineWidth = 3;
      g.strokeStyle = "rgba(7, 6, 16, 0.85)";
      g.strokeText(text, sx, view.frei + 8);
      g.fillStyle = ziel.farbe;
      g.fillText(text, sx, view.frei + 8);
    });
    g.globalAlpha = 1;
  }

  function zeichneTeile() {
    if (!state.teile.length) return;
    bildTransform();
    const s = view.s;
    g.globalCompositeOperation = "lighter";
    for (const t of state.teile) {
      const k = clamp(t.leben / t.max, 0, 1);
      g.globalAlpha = t.art === "staub" ? k * 0.6 : k;
      g.fillStyle = t.farbe;
      const r = t.r * s * (t.art === "staub" ? 2 - k : 0.5 + k * 0.5);
      g.beginPath();
      g.arc(bildX(t.x), bildY(t.y), Math.max(0.5, r), 0, Math.PI * 2);
      g.fill();
    }
    g.globalAlpha = 1;
    g.globalCompositeOperation = "source-over";
  }

  function zeichneSchriften() {
    if (!state.schriften.length) return;
    flachTransform();
    g.textAlign = "center";
    g.textBaseline = "middle";
    for (const sch of state.schriften) {
      const k = clamp(sch.leben / sch.max, 0, 1);
      const alter = sch.max - sch.leben;
      const pop = alter < 0.15 && !ruhig() ? 0.6 + (alter / 0.15) * 0.4 + Math.sin((alter / 0.15) * Math.PI) * 0.2 : 1;
      const gross = Math.round(sch.gross * clamp(view.s, 0.9, 1.5) * pop);
      g.font = `900 ${gross}px system-ui, sans-serif`;
      const breit = g.measureText(sch.text).width;
      const x = clamp(sch.fest ? view.cssW / 2 : bildX(sch.x), breit / 2 + 8, view.cssW - breit / 2 - 8);
      const y = Math.max(view.frei + gross, sch.fest ? view.frei + view.cssH * 0.16 : bildY(sch.y) - (1 - k) * 22);
      g.globalAlpha = Math.min(1, k * 2.5);
      g.lineWidth = Math.max(3, gross * 0.2);
      g.lineJoin = "round";
      g.strokeStyle = "rgba(8, 6, 20, 0.85)";
      g.strokeText(sch.text, x, y);
      g.fillStyle = sch.farbe;
      g.fillText(sch.text, x, y);
    }
    g.globalAlpha = 1;
  }

  // Oben links, unter den Knöpfen: die Meter, darunter die Rufe – drei
  // Zeichen, die sich füllen, während sie nachladen.
  function zeichneAnzeige() {
    if (state.phase === "bereit") return;
    flachTransform();
    g.translate(0, view.frei);
    const gross = clamp(view.cssH * 0.05, 14, 24);
    g.font = `900 ${Math.round(gross)}px system-ui, sans-serif`;
    g.textAlign = "left";
    g.textBaseline = "middle";
    const text = `${state.punkte} m`;
    const x = 12;
    let y = 12;
    const hoch = gross * 1.6;
    const w = g.measureText(text).width + gross * 1.2;
    g.fillStyle = "rgba(14, 10, 28, 0.62)";
    g.beginPath();
    if (g.roundRect) g.roundRect(x, y, w, hoch, hoch / 2); else g.rect(x, y, w, hoch);
    g.fill();
    g.strokeStyle = "rgba(170, 140, 255, 0.25)";
    g.lineWidth = 1;
    g.stroke();
    g.fillStyle = "#ffffff";
    g.fillText(text, x + gross * 0.6, y + hoch / 2 + 1);
    y += hoch + 6;

    // Die Rufe.
    const klein = Math.round(gross * 0.62);
    const ph = klein * 1.9;
    const leer = state.zeit < state.leerBis;
    const zittern = leer && !ruhig() ? Math.sin(state.echt * 70) * 3 : 0;
    const pw = klein * (LADUNG_MAX * 2.3 + 0.9);
    g.fillStyle = leer ? "rgba(70, 18, 40, 0.7)" : "rgba(14, 10, 28, 0.62)";
    g.beginPath();
    if (g.roundRect) g.roundRect(x + zittern, y, pw, ph, ph / 2); else g.rect(x + zittern, y, pw, ph);
    g.fill();
    for (let n = 0; n < LADUNG_MAX; n += 1) {
      const cx = x + zittern + klein * (1.05 + n * 2.3);
      const cy = y + ph / 2;
      const voll = clamp(state.ladung - n, 0, 1);
      const da = voll >= 1;
      g.lineCap = "round";
      g.lineWidth = Math.max(1.5, klein * 0.16);
      // Punkt und zwei Bögen; was nachlädt, füllt sich von innen.
      g.fillStyle = da ? "#bff6ff" : "rgba(190, 230, 255, 0.25)";
      g.beginPath();
      g.arc(cx - klein * 0.35, cy, klein * 0.17, 0, Math.PI * 2);
      g.fill();
      for (let b = 0; b < 2; b += 1) {
        const an = da || voll > (b + 1) / 3;
        g.strokeStyle = an ? (da ? "#7fe8ff" : "rgba(127, 232, 255, 0.7)") : "rgba(190, 230, 255, 0.2)";
        g.beginPath();
        g.arc(cx - klein * 0.35, cy, klein * (0.42 + b * 0.32), -0.75, 0.75);
        g.stroke();
      }
    }
    g.lineCap = "butt";
  }

  function zeichnen() {
    if (!g) return;
    bilderBereit();
    lampenSammeln();
    zeichneGrund();
    zeichneEingang();
    eimerLeeren();
    zeichneWaende();
    zeichneZungen();
    zeichneDinge();
    zeichneKoerner();
    eimerZeichnen();
    zeichneKristalle();
    zeichneStaub();
    zeichneTropfen();
    zeichnePilze();
    zeichneLichter();
    zeichneSpinnenAugen();
    zeichneRufe();
    zeichneTore();
    zeichneGeister();
    zeichneFledermaus();
    zeichneTeile();
    if (state.blitz > 0.01 && !ruhig()) {
      flachTransform();
      g.fillStyle = `rgba(230, 220, 255, ${(state.blitz * 0.18).toFixed(3)})`;
      g.fillRect(0, 0, view.cssW, view.cssH);
    }
    zeichneSchriften();
    zeichneAnzeige();
  }

  // ---------------------------------------------------------------------------
  // Teilchen und Schriften
  // ---------------------------------------------------------------------------
  const TEILE_MAX = 220;

  function teil(t) {
    if (state.teile.length >= TEILE_MAX) state.teile.shift();
    state.teile.push(t);
  }

  function funken(x, y, anzahl, farben, tempo = 150) {
    if (ruhig()) anzahl = Math.ceil(anzahl / 3);
    for (let i = 0; i < anzahl; i += 1) {
      const w = Math.random() * Math.PI * 2;
      const v = tempo * (0.3 + Math.random() * 0.9);
      teil({ art: "funke", x, y, vx: Math.cos(w) * v, vy: Math.sin(w) * v, r: 0.9 + Math.random() * 1.4,
        farbe: farben[i % farben.length], leben: 0.35 + Math.random() * 0.5, max: 0.85 });
    }
  }

  function funkeln(x, y, anzahl) {
    for (let i = 0; i < anzahl; i += 1) {
      teil({ art: "glanz", x: x + (Math.random() - 0.5) * 8, y: y + (Math.random() - 0.5) * 8, vx: (Math.random() - 0.5) * 20,
        vy: (Math.random() - 0.5) * 20, r: 1 + Math.random(), farbe: i % 2 ? "#ffffff" : "#bff3ff", leben: 0.5, max: 0.5 });
    }
  }

  function staubWolke(x, y, anzahl, farbe = "#d9d2ff") {
    if (ruhig()) anzahl = Math.ceil(anzahl / 3);
    for (let i = 0; i < anzahl; i += 1) {
      const w = Math.random() * Math.PI * 2;
      const v = 20 + Math.random() * 60;
      teil({ art: "staub", x: x + (Math.random() - 0.5) * 10, y, vx: Math.cos(w) * v, vy: Math.abs(Math.sin(w)) * v * 0.6,
        r: 1.5 + Math.random() * 2.5, farbe, leben: 0.6 + Math.random() * 0.6, max: 1.2 });
    }
  }

  function blitzLicht(x, y, r, st, dauer, f = 8) {
    state.blitze.push({ x, y, r, st, t0: state.zeit, dauer, f });
    if (state.blitze.length > 10) state.blitze.shift();
  }

  function schrift(text, x, y, farbe, gross, dauer = 1.1, fest = false) {
    state.schriften.push({ text, x, y, farbe, gross, leben: dauer, max: dauer, fest });
    if (state.schriften.length > 6) state.schriften.shift();
  }

  // ---------------------------------------------------------------------------
  // Flügelschlag, Ruf, Fang, Aufprall
  // ---------------------------------------------------------------------------
  function fluegelAnimation() {
    state.schlagVon = state.fluegel;
    state.schlagZeit = state.zeit;
  }

  // Wo die Flügel gerade stehen: Abschlag, Aufschlag, dann Gleiten.
  function fluegelStellung() {
    const t = state.zeit - state.schlagZeit;
    if (t < 0.1) {
      const u = t / 0.1;
      return lerp(state.schlagVon, -1, u * u);
    }
    if (t < 0.3) {
      const u = (t - 0.1) / 0.2;
      return lerp(-1, 0.85, 1 - (1 - u) * (1 - u));
    }
    const gleiten = 0.32 + 0.07 * Math.sin(state.echt * 3.4) + (state.fm.vy < -110 ? 0.3 : 0);
    const u = clamp((t - 0.3) / 0.25, 0, 1);
    return lerp(0.85, gleiten, u * u * (3 - 2 * u));
  }

  function schlag() {
    if (state.phase === "zuschauen" || state.phase === "ende") return;
    if (state.phase === "bereit") {
      // Im Live-Modus beginnt die Runde für alle zugleich (live.los).
      if (shell.live) return;
      losGehts();
    }
    if (state.schritt !== "flug") return;
    schlagAuf(state.fm);
    state.schlaege += 1;
    fluegelAnimation();
    // Flügelschläge kommen dicht – leise.
    ton("fledermaus.fluegel", { laut: 0.55 }, 60);
    // Ein Hauch Staub unter den Flügeln.
    if (!ruhig() && Math.random() < 0.7) {
      teil({ art: "staub", x: state.fm.x - 4, y: state.fm.y - 8, vx: -40 - Math.random() * 30, vy: -30 - Math.random() * 30,
        r: 1.2, farbe: "#b9a6ff", leben: 0.5, max: 0.5 });
    }
  }

  // Ein Ruf geht hinaus – im Spiel aus einer Ladung, beim Zuschauen aus der
  // Aufzeichnung.
  function rufAus(x, y) {
    state.rufe.push({ x: x + 6, y: y + 1, t0: state.zeit, r: rufWeite(x), fade: fadeBei(x) });
    state.rufBlitz = 1;
    ton("fledermaus.echo", { laut: 0.9 });
  }

  function ruf() {
    if (state.phase === "zuschauen" || state.phase === "ende") return;
    if (state.phase === "bereit") {
      if (shell.live) return;
      losGehts();
    }
    if (state.schritt !== "flug") return;
    if (state.ladung < 1) {
      // Leer: kein Echo, nur ein leises «nichts».
      state.leerBis = state.zeit + 0.45;
      ton("fehler", { laut: 0.45 }, 500);
      funken(state.fm.x + 8, state.fm.y, 3, ["#ff9ab8", "#ffffff"], 50);
      if (Math.random() < 0.5) schrift("Ruf lädt …", state.fm.x + 24, state.fm.y + 26, "#ffb3c9", 13, 0.7);
      return;
    }
    state.ladung -= 1;
    state.rufZahl += 1;
    rufAus(state.fm.x, state.fm.y);
    kids()?.vibrate?.(6);
  }

  // Ein Glühwürmchen gefangen: eine Ladung mehr, und ringsum wird es kurz
  // hell.
  function fangen(l, still = false) {
    l.gefangen = state.zeit;
    state.gefangen += 1;
    const x = lichtX(l);
    const y = lichtY(l);
    blitzLicht(x, y, 85, 0.75, 0.9, 6);
    funken(x, y, 14, ["#f4ffc0", "#d8ff6a", "#ffffff"], 110);
    state.ladung = Math.min(LADUNG_MAX, state.ladung + 1);
    ton("punkt", { laut: 0.9 }, 100);
    if (still) return;
    schrift("+1 Ruf", x, y + 16, "#e4ff8a", 15, 0.9);
    kids()?.vibrate?.(10);
  }

  function lichterPruefen() {
    const f = state.fm;
    for (const l of state.hoehle.lichter) {
      if (l.gefangen >= 0 || Math.abs(l.x - f.x) > 22) continue;
      if (Math.hypot(lichtX(l) - f.x, lichtY(l) - f.y) < R_FM + 8) fangen(l, state.phase === "zuschauen");
    }
  }

  const GRUENDE = {
    wand: "An die Wand geflogen",
    zunge: "An den Fels geflogen",
    zapfen: "Tropfstein gestreift",
    brocken: "Felsbrocken gestreift",
    spinne: "Spinne erwischt",
    faller: "Vom Tropfstein getroffen",
  };

  // Steckt die Fledermaus in einer Sackgasse?
  function inSackgasse(x, y) {
    return state.hoehle.zungen.some((zu) => x >= zu.xa && x <= zu.xz + SEG && (zu.seite < 0 ? y < zu.innen[zu.innen.length - 1] + 4 : y > zu.innen[zu.innen.length - 1] - 4));
  }

  // Die Richtung weg vom Fels an (x, y): der Anstieg des Abstands.
  function normaleBei(x, y, wt) {
    const e = 1.5;
    const nx = abstand(x + e, y, wt) - abstand(x - e, y, wt);
    const ny = abstand(x, y + e, wt) - abstand(x, y - e, wt);
    const l = Math.hypot(nx, ny) || 1;
    return { x: nx / l, y: ny / l };
  }

  // Der Aufprall: Die Fledermaus prallt ab und trudelt. Ein Blitz zeigt, was
  // sie getroffen hat.
  function crash(still = false) {
    if (state.schritt !== "flug") return;
    const f = state.fm;
    const art = trefferArt;
    state.schritt = "crash";
    state.crashZeit = state.zeit;
    state.crashX = f.x;
    state.crashWelt = state.weltZeit;
    state.grund = inSackgasse(f.x, f.y) ? "In die Sackgasse geflogen" : (GRUENDE[art] || GRUENDE.wand);
    const n = normaleBei(f.x, f.y, state.weltZeit);
    f.vx = -50 + Math.min(0, n.x) * 60;
    f.vy = n.y * 150 + 30;
    state.dreh = (n.y >= 0 ? -1 : 1) * 11;
    state.stoss = 1;
    state.blitz = 1;
    if (!ruhig()) state.lupe = 0.28;
    blitzLicht(f.x, f.y, 140, 1.1, 1.1, 8);
    funken(f.x + 4, f.y, 26, ["#ffffff", "#e3d6ff", "#a98bff", "#7fe8ff"], 170);
    staubWolke(f.x, f.y, 10);
    // Der Aufprall beendet die Runde – die Höhle verstummt.
    hoehle.aus();
    ton("fledermaus.aufprall", {}, 300);
    if (still) return;
    kids()?.vibrate?.([30, 40, 60]);
    stepTimer = window.setTimeout(finish, 1350);
  }

  // Nach dem Aufprall: Sie trudelt zu Boden und bleibt liegen.
  function trudeln(h) {
    const f = state.fm;
    f.vy -= 520 * h;
    f.vx *= 1 - 0.8 * h;
    const nx = f.x + f.vx * h;
    const ny = f.y + f.vy * h;
    const wt = state.weltZeit;
    if (abstand(nx, ny, wt) < R_FM * 0.8) {
      const n = normaleBei(f.x, f.y, wt);
      const vn = f.vx * n.x + f.vy * n.y;
      if (vn < 0) {
        f.vx -= 1.4 * vn * n.x;
        f.vy -= 1.4 * vn * n.y;
      }
      f.vx *= 0.6;
      f.vy *= 0.6;
      state.dreh *= 0.6;
      if (Math.abs(vn) > 60) staubWolke(f.x, f.y - 3, 4);
      return;
    }
    f.x = nx;
    f.y = ny;
    state.winkel += state.dreh * h;
  }

  // ---------------------------------------------------------------------------
  // Der Lauf
  // ---------------------------------------------------------------------------
  function physik(h) {
    const f = state.fm;
    fliegeSchritt(f, h);
    state.weltZeit = zeitBei(f.x);
    if (abstand(f.x, f.y, state.weltZeit) < R_FM) crash();
  }

  // Was in der Höhle von selbst geschieht, nach der Weltzeit: Tropfsteine
  // beginnen zu wackeln und brechen am Boden.
  function hoehleTakt() {
    const h = state.hoehle;
    const wt = state.weltZeit;
    const x0 = state.camX - 60;
    const x1 = state.camX + view.w + 60;
    for (let j = dingeAb(x0); j < h.dinge.length && h.dinge[j].x0 <= x1; j += 1) {
      const d = h.dinge[j];
      if (d.art !== "faller") continue;
      if (wt >= d.tLos && wt < d.tFall && !ruhig() && Math.random() < 0.35) {
        teil({ art: "staub", x: d.x + (Math.random() - 0.5) * d.breit * 0.6, y: d.wand - 2, vx: (Math.random() - 0.5) * 10,
          vy: -20 - Math.random() * 30, r: 0.9, farbe: "#fff0d8", leben: 0.7, max: 0.7 });
      }
      if (!d.gewackelt && wt >= d.tLos && wt < d.tFall) {
        d.gewackelt = true;
        if (state.phase === "spiel") kids()?.vibrate?.(5);
      }
      if (!d.gebrochen && wt >= d.tBruch) {
        d.gebrochen = true;
        blitzLicht(d.x, d.boden + 6, 70, 0.7, 0.7, 8);
        staubWolke(d.x, d.boden + 2, 12, "#f3e8ff");
        funken(d.x, d.boden + 4, 10, ["#ffffff", "#e6dcff"], 120);
        if (state.phase !== "bereit") state.stoss = Math.max(state.stoss, 0.25);
      }
    }
  }

  function takt(dt) {
    state.echt += dt;
    if (state.lupe > 0) {
      state.lupe -= dt;
      dt *= 0.35;
    }
    state.zeit += dt;
    const f = state.fm;
    if (state.stoss > 0) state.stoss = Math.max(0, state.stoss - dt * 2.6);
    if (state.blitz > 0) state.blitz = Math.max(0, state.blitz - dt * 3);
    if (state.rufBlitz > 0) state.rufBlitz = Math.max(0, state.rufBlitz - dt * 4);

    if (state.phase === "zuschauen") {
      zuschauenTakt(dt);
    } else if (state.schritt === "flug") {
      const n = Math.max(1, Math.ceil(dt / TAKT - 1e-9));
      for (let i = 0; i < n && state.schritt === "flug"; i += 1) physik(dt / n);
      if (state.schritt === "flug") {
        lichterPruefen();
        state.ladung = Math.min(LADUNG_MAX, state.ladung + dt / ladeZeit(f.x));
        const meter = Math.floor(meterBei(f.x));
        if (meter !== state.meter) {
          if (Math.floor(meter / 100) > Math.floor(state.meter / 100)) {
            schrift(`${Math.floor(meter / 100) * 100} m`, f.x + 40, f.y + 30, "#c9b8ff", 17);
          }
          state.meter = meter;
          state.punkte = meter;
          shell.setCount(meter);
        }
        // Wo das Mondlicht endet, der Satz zum ersten Ruf.
        if (!state.hinweis && f.x > MOND_BIS - 60 && state.rufZahl === 0 && state.phase === "spiel") {
          state.hinweis = true;
          schrift("Dunkel! Links tippen: rufen", 0, 0, "#bff3ff", 17, 2.4, true);
        }
      }
      if (state.camMix < 1) state.camMix = Math.min(1, state.camMix + dt / 1.1);
    } else if (state.schritt === "start") {
      // Vor dem ersten Tipp schwebt die Fledermaus im Mondlicht und schlägt
      // gemächlich mit den Flügeln.
      f.y = START.y + (ruhig() ? 0 : Math.sin(state.echt * 2.2) * 5);
      f.vy = Math.cos(state.echt * 2.2) * 11;
      if (state.zeit - state.schlagZeit > 0.6) fluegelAnimation();
    } else if (state.schritt === "crash") {
      state.weltZeit = state.crashWelt + (state.zeit - state.crashZeit);
      const n = Math.max(1, Math.ceil(dt / TAKT - 1e-9));
      for (let i = 0; i < n; i += 1) trudeln(dt / n);
    }

    // Die Lage der Fledermaus: Nase in Flugrichtung, die Flügel im Takt.
    if (state.schritt === "flug" && state.phase !== "zuschauen") {
      state.winkel = Math.atan2(f.vy, tempoBei(f.x)) * 0.55;
    }
    if (state.schritt === "crash") state.fluegel = Math.sin(state.echt * 26) * 0.9;
    else state.fluegel = fluegelStellung();

    hoehleTakt();

    // Rufe, die ganz verglüht sind, gehen.
    for (let i = state.rufe.length - 1; i >= 0; i -= 1) {
      const e = state.rufe[i];
      if (state.zeit - e.t0 > e.r / RUF_TEMPO + e.fade * KRISTALL_FADE + 0.2) state.rufe.splice(i, 1);
    }
    for (let i = state.blitze.length - 1; i >= 0; i -= 1) {
      if (state.zeit - state.blitze[i].t0 > state.blitze[i].dauer) state.blitze.splice(i, 1);
    }
    for (let i = state.teile.length - 1; i >= 0; i -= 1) {
      const t = state.teile[i];
      if (t.art === "funke") t.vy -= 260 * dt;
      else if (t.art === "staub") t.vy -= 30 * dt;
      t.vx *= 1 - 1.6 * dt;
      t.x += t.vx * dt;
      t.y += t.vy * dt;
      t.leben -= dt;
      if (t.leben <= 0) state.teile.splice(i, 1);
    }
    for (let i = state.schriften.length - 1; i >= 0; i -= 1) {
      state.schriften[i].leben -= dt;
      if (state.schriften[i].leben <= 0) state.schriften.splice(i, 1);
    }

    if (state.schritt !== "crash") state.camX = camZiel();
    hoehleBis(state.camX + view.w + SEG * 6);

    klangTakt();

    if (state.phase === "spiel") {
      const winkel = Math.round(clamp(state.winkel, -1.2, 1.2) * 100);
      gegner?.takt(state.punkte, { a: Math.round(f.x), b: Math.round(f.y), c: state.rufZahl * 1000 + 500 + winkel });
    }
  }

  function loop(now) {
    frame = window.requestAnimationFrame(loop);
    // Nie rückwärts: Der Zeitstempel eines Bildes kann vor dem letzten
    // Neustart liegen – ein Ruf gleich danach liefe sonst mit negativem Alter.
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
    last = now;
    ruhigFragen();
    messen();
    takt(dt);
    zeichnen();
  }

  // ---------------------------------------------------------------------------
  // Zuschauen
  // ---------------------------------------------------------------------------
  // Ein aufgezeichneter Flug durch seine eigene Höhle: Der Zufall hält die
  // Saat (geist.js, zuschauer), startRun baut damit dieselbe Höhle, und die
  // Fledermaus steht Bild für Bild dort, wo sie damals war. Aus c kommen die
  // Rufe – jeder neue geht dort hinaus, wo sie gerade ist – und die
  // Neigung. Der Aufprall zeigt sich, wo sie in den Fels gerät oder
  // zurückprallt.
  function zuschauenStarten() {
    if (!zuschauer?.lauf) return;
    startRun();
    state.phase = "zuschauen";
    state.schritt = "flug";
    shell.setPhase("play");
    zuschauer.los();
  }

  function zuschauenTakt(dt) {
    const s = zuschauer.stand();
    if (!s) return;
    const f = state.fm;
    const c = Math.max(0, Math.round(s.c || 0));
    const rufe = Math.floor(c / 1000);
    if (state.schritt === "flug") {
      const vorher = f.vy;
      f.x = s.a;
      f.y = s.b;
      f.vy = s.vb || 0;
      state.weltZeit = zeitBei(f.x);
      state.winkel = clamp(((c % 1000) - 500) / 100, -1.3, 1.3);
      // Ein Flügelschlag zeigt sich als Ruck nach oben.
      if (f.vy - vorher > 45 * Math.max(1, dt * 60) && state.zeit - state.schlagZeit > 0.12) {
        fluegelAnimation();
        ton("fledermaus.fluegel", { laut: 0.55 }, 60);
      }
      while (state.rufZahl < rufe) {
        state.rufZahl += 1;
        state.ladung = Math.max(0, state.ladung - 1);
        rufAus(f.x, f.y);
      }
      state.ladung = Math.min(LADUNG_MAX, state.ladung + dt / ladeZeit(f.x));
      lichterPruefen();
      if (state.camMix < 1) state.camMix = Math.min(1, state.camMix + dt / 1.1);
      if (meterBei(f.x) > 1 && ((s.va || 0) < -15 || abstand(f.x, f.y, state.weltZeit) < R_FM - 2.5)) crash(true);
    } else {
      // Nach dem Aufprall: die Aufzeichnung, so gut sie es weiss, und das
      // Trudeln dazu.
      state.weltZeit = state.crashWelt + (state.zeit - state.crashZeit);
      f.x = s.a;
      f.y = s.b;
      state.winkel += state.dreh * dt;
    }
    const punkte = Math.max(0, Math.floor(s.punkte));
    if (punkte !== state.punkte) {
      state.punkte = punkte;
      state.meter = punkte;
      shell.setCount(punkte);
    }
    zuschauer.weiter();
  }

  // ---------------------------------------------------------------------------
  // Tippen
  // ---------------------------------------------------------------------------
  // Die Runde beginnt: mit dem ersten Tipp (links oder rechts) – oder im
  // Live-Modus zum gemeinsamen Start (game-shell.js, live.los).
  function losGehts() {
    if (state.phase !== "bereit") return;
    state.phase = "spiel";
    state.schritt = "flug";
    state.fm.vy = 30;
    state.fm.schub = 0;
    shell.setPhase("play");
    gegner?.los();
    kids()?.vibrate?.(8);
  }

  // Die Knöpfe leuchten kurz auf, solange ein Finger darauf liegt.
  const gedrueckt = new Map();
  function knopfAn(id, art) {
    gedrueckt.set(id, art);
    knoepfeZeigen();
  }
  function knopfAus(id) {
    if (!gedrueckt.delete(id)) return;
    knoepfeZeigen();
  }
  function knoepfeZeigen() {
    const arten = new Set(gedrueckt.values());
    tipp?.querySelector(".fm-knopf-ruf")?.classList.toggle("ist-an", arten.has("ruf"));
    tipp?.querySelector(".fm-knopf-schlag")?.classList.toggle("ist-an", arten.has("schlag"));
  }

  // ---------------------------------------------------------------------------
  // Ablauf
  // ---------------------------------------------------------------------------
  function startRun() {
    clearStep();
    stopLoop();
    hoehle.aus();
    shell.closeOverlay();
    ruhigFragen();
    zufall.neu();
    shell.setPhase("intro");
    state.phase = "bereit";
    state.schritt = "start";
    state.punkte = 0;
    state.meter = 0;
    state.fm = { x: START.x, y: START.y, vy: 0, vx: 0, schub: 0, schubA: 0 };
    state.winkel = 0;
    state.dreh = 0;
    state.fluegel = 0.3;
    state.schlagZeit = -9;
    state.schlagVon = 0.3;
    state.ladung = LADUNG_MAX;
    state.rufZahl = 0;
    state.rufe = [];
    state.gefangen = 0;
    state.schlaege = 0;
    pfadIndex = 0;
    state.hoehle = neueHoehle();
    state.hoehle.bodenAussen = wandAnalytisch(MUND, -1);
    state.weltZeit = 0;
    state.camMix = 0;
    state.crashZeit = 0;
    state.crashX = 0;
    state.crashWelt = 0;
    state.grund = "";
    state.lampen = [];
    state.blitze = [];
    state.teile = [];
    state.schriften = [];
    state.stoss = 0;
    state.blitz = 0;
    state.lupe = 0;
    state.rufBlitz = 0;
    state.leerBis = -9;
    state.hinweis = false;
    state.zeit = 0;
    state.echt = 0;
    gedrueckt.clear();
    shell.setCount(0);
    gegner?.runde();

    shell.clear();
    const prompt = shell.el("p", "cm-prompt fm-prompt", "Rechts: flattern · links: rufen");
    shell.play.append(prompt, buildPlatz());
    view.cssW = 0;
    view.cssH = 0;
    messen();
    state.camX = camZiel();
    hoehleBis(state.camX + view.w + SEG * 6);

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
    if (state.phase === "ende" || state.phase === "zuschauen") return;
    state.phase = "ende";
    hoehle.aus();
    const punkte = state.punkte;
    const geist = gegner?.ende(punkte) || null;
    const vorher = Number(store.read()?.scores?.[0]) || 0;
    const rekord = punkte > vorher;
    store.update((old) => ({
      runs: (Number(old.runs) || 0) + 1,
      scores: [...(old.scores || []), punkte].sort((x, y) => y - x).slice(0, TOP_COUNT),
    }));
    const rufe = `${state.rufZahl} ${state.rufZahl === 1 ? "Ruf" : "Rufe"}`;
    const best = vorher ? `Bestwert ${vorher} m` : "";
    shell.showResult({
      label: "Deine Meter",
      points: punkte,
      detail: rekord ? "Neuer Rekord!" : [state.grund, rufe, best].filter(Boolean).join(" · "),
      geist,
    });
    if (rekord) host.querySelector(".cm-result-detail")?.classList.add("fm-rekord");
    zaehleHoch(punkte);
  }

  // Die Welt dieser Runde als Text: die ersten Abschnitte, Hindernisse und
  // Glühwürmchen, ein paar Wände – für die Prüfung, dass im Turnier alle
  // dieselbe Höhle bekommen.
  function weltText() {
    hoehleBis(START.x + 4000);
    const h = state.hoehle;
    const ab = h.abschnitte.slice(0, 20).map((a) => `${a.art.slice(0, 2)}${Math.round(a.x0)}-${Math.round(a.x1)}:${Math.round(a.y)}`).join(" ");
    const di = h.dinge.slice(0, 20).map((d) => `${d.art.slice(0, 2)}${Math.round(d.x)}/${Math.round(d.spitze ?? d.yTop)}`).join(" ");
    const li = h.lichter.slice(0, 10).map((l) => `${Math.round(l.x)}/${Math.round(l.y)}`).join(" ");
    const wa = [600, 1500, 3000].map((x) => { const w = wandBei(x); return `${Math.round(w.o)}/${Math.round(w.u)}`; }).join(" ");
    return `${ab} | ${di} | ${li} | ${wa}`;
  }

  // ---------------------------------------------------------------------------
  // Start
  // ---------------------------------------------------------------------------
  shell = shellApi.mount({
    host,
    title: "Fledermaus",
    area: "gedaechtnis",
    accent: "#7C5CE6",
    accentDark: "#5a41b8",
    clock: false,
    onRestart: () => (zuschauer ? zuschauenStarten() : startRun()),
    live: { los: losGehts, stopp: () => finish(), zuschauen: (quelle) => { zuschauer = quelle; zuschauenStarten(); } },
  });
  zuschauer = window.LernappGeist?.zuschauer?.({
    host, spiel: "batEcho", fassung: "t1", zufall, einheit: "m", nochmal: zuschauenStarten,
  }) || null;
  if (!zuschauer) {
    gegner = window.LernappGeist?.fuer?.({ spiel: "batEcho", host, art: "tempo", alle: true, zufall }) || null;
  }

  startRun();
  zuschauer?.laden.then((da) => { if (da) zuschauenStarten(); });

  // Die linke Hälfte des Bildes ruft, die rechte schlägt mit den Flügeln –
  // jeder Finger für sich. Nur Knöpfe bleiben Knöpfe.
  host.addEventListener("pointerdown", (event) => {
    if (event.target.closest("button, a, input")) return;
    const rahmen = (feld || host).getBoundingClientRect();
    const links = event.clientX < rahmen.left + rahmen.width / 2;
    knopfAn(event.pointerId, links ? "ruf" : "schlag");
    if (links) ruf(); else schlag();
  });
  window.addEventListener("pointerup", (event) => knopfAus(event.pointerId));
  window.addEventListener("pointercancel", (event) => knopfAus(event.pointerId));
  window.addEventListener("blur", () => { gedrueckt.clear(); knoepfeZeigen(); });

  // ↑ und Leertaste: Flügelschlag. ← und E: Ruf. Steht der Fokus auf einem
  // Knopf, gilt die Taste dem Knopf.
  const artDerTaste = (event) => {
    if (event.key === "ArrowUp" || event.key === " " || event.code === "KeyW") return "schlag";
    if (event.key === "ArrowLeft" || event.code === "KeyE") return "ruf";
    return "";
  };
  document.addEventListener("keydown", (event) => {
    const art = artDerTaste(event);
    if (!art) return;
    if (document.activeElement?.tagName === "BUTTON") return;
    event.preventDefault();
    if (event.repeat) return;
    knopfAn(`taste-${art}`, art);
    if (art === "ruf") ruf(); else schlag();
  });
  document.addEventListener("keyup", (event) => {
    const art = artDerTaste(event);
    if (art) knopfAus(`taste-${art}`);
  });

  window.addEventListener("resize", messen);
  window.addEventListener("orientationchange", messen);
  window.addEventListener("pagehide", () => { clearStep(); stopLoop(); });

  // Für die Prüfskripte. Gerechnet wird in Welteinheiten (zehn sind ein
  // Meter, y nach oben). pfadBei/halbBei: der Weg und der freie Korridor um
  // ihn; abstand(x, y, wt): wie weit es zum Fels ist (negativ: drin);
  // fliegeSchritt/schlagAuf: dieselbe Physik wie im Spiel, an einem eigenen
  // Objekt { x, y, vy, schub, schubA }.
  window.LernappFledermaus = {
    METER, BAND, SEG, R_FM, G, ZUG, SCHLAG, SCHLAG_DAUER, VY_MAX, VY_FALL, TAKT, LADUNG_MAX, START,
    state, view, takt, zeichnen, schlag, ruf, losGehts, hoehleBis, pfadBei, halbBei, tempoBei, zeitBei, abstand,
    fliegeSchritt, schlagAuf, wandBei, rufWeite, fadeBei, ladeZeit, weltText,
    get trefferArt() { return trefferArt; },
  };
})();
