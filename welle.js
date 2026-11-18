/*
 * welle.js – Die Welle.
 * ---------------------------------------------------------------------------
 * Eine riesige Welle bei Sonnenuntergang, und eine Surferin, die sie
 * entlangfährt – immer in dieselbe Richtung, die Kamera dicht hinter ihr.
 * Hinter ihr bricht die Welle: Der Schaum jagt sie. Gesteuert wird mit dem
 * Finger: links halten fährt die Wand hinauf, rechts halten hinunter, und
 * wer loslässt, fährt geradeaus (am Rechner die Pfeiltasten).
 *
 * Zwei Grössen entscheiden: h, wie hoch sie an der Wand steht (0 das Tal, 1
 * die Lippe), und d, wie viele Meter sie vor dem Schaum ist. Ihr Tempo ist
 * Schwung, der bleibt: Hinunter gibt Tempo, hinauf kostet nur einen Teil
 * davon (die Welle hebt mit) – darum gibt jedes Auf und Ab Schwung, und wer
 * rhythmisch pumpt oder von hoch oben hinunterschiesst, fährt dem Schaum
 * davon. Hoch an der Wand bremst es, dort fällt sie tiefer in die Röhre;
 * ganz unten im Flachen verhungert sie. Punkte gibt es allein in der Röhre,
 * dort, wo das Dach über ihr zu ist (d unter 9 m), und umso mehr, je tiefer
 * sie darin steckt. Wer ohne Unterbruch in der Röhre bleibt, vervielfacht
 * sie (bis ×4). Verschluckt sie der Schaum (d unter null) oder trägt es sie
 * über die Lippe (h über 1), ist die Runde vorbei. Sonst läuft die Welle
 * nach 80 Sekunden am Strand aus.
 *
 * Die Welle bricht nicht gleichmässig: Schnelle Abschnitte (der Schaum zieht
 * für ein paar Sekunden an), langsame und später kurze Doppelschläge kommen
 * aus dem Zufall (zufall.js) – ohne Turnier jedes Mal andere, im Turnier für
 * alle im selben Versuch dieselben. Wo ein schneller Abschnitt kommt, läuft
 * voraus weisse Gischt die Lippe entlang. Der Schaum hängt nur an der Zeit,
 * nie daran, wie jemand fährt.
 *
 * Die Gegner (geist.js) fahren als Surfer aus Licht mit, so tief in der
 * Röhre, wie sie damals waren, und die besten Läufe lassen sich anschauen
 * (?zuschauen=). Aufgezeichnet wird in Fassung t2 (mit der neuen Steuerung).
 *
 * Gezeichnet wird mit WebGL 2, ohne Bibliothek, in einem Durchgang: die Welle
 * als ein Netz, dessen Querschnitt im Programm entsteht (ein Formwert je
 * Reihe: wie weit die Lippe schon überwirft), dazu Himmel und Meer, die
 * Surferin (ein Netz, das in jedem Bild aus ihrer Haltung neu entsteht), die
 * Spur ihres Bretts, Gischt und Sprühnebel. Gerechnet wird in
 * Metern: x zeigt zum Strand (im Bild nach rechts), y nach oben, z die Welle
 * entlang. Die Zahlen liegen auf einer zweiten Leinwand darüber.
 */
(() => {
  "use strict";

  if (document.body.dataset.page !== "wave") return;

  const host = document.querySelector("#wl-stage");
  const shellApi = window.LernappGameShell;
  const cloudApi = window.LernappGameCloud;
  if (!host || !shellApi) return;

  const kids = () => window.LernappKids || null;
  const klang = () => window.ArcadeKlang || null;
  const ruhig = () => Boolean(kids()?.prefersReducedMotion?.());

  // Der Zufall. Nur die Abschnitte der Welle ziehen daraus – wann der Schaum
  // anzieht, wie stark, wie lange. Gischt, Tropfen und Sprühnebel sind Zierde
  // und nehmen Math.random.
  const zufall = window.LernappZufall?.fuer?.("waveRide") || {
    neu() {},
    zahl: () => Math.random(),
  };

  // ---------------------------------------------------------------------------
  // Die Schrauben
  // ---------------------------------------------------------------------------
  const TAKT = 1 / 120;            // gerechnet wird in festen kleinen Schritten
  const DAUER = 80;                // nach so vielen Sekunden läuft die Welle am Strand aus
  const ROEHRE = 9;                // näher am Schaum ist das Dach zu: Dort gibt es Punkte
  const WAND = 10.5;               // vom Tal bis zur Lippe, in Metern (gerechnet, nicht gezeichnet)
  const START_D = 17;              // so weit vor dem Schaum beginnt die Runde
  const START_H = 0.42;

  // Das Tempo der Welle: so schnell läuft der Schaum, am Anfang und am
  // Schluss. Die ersten Sekunden sind sanft.
  const C0 = 9.5;
  const C1 = 16;
  const SANFT = 6;
  const SANFT_FAKTOR = 0.82;

  // Die Surferin. Gelenkt wird in drei Richtungen: hinauf (links halten),
  // hinunter (rechts halten) – und lässt man los, fährt sie geradeaus und
  // sinkt dabei nur ganz langsam. Ihre Richtung auf der Wand dreht dorthin.
  const PSI_AUF = 0.62;            // so steil geht es hinauf, im Bogenmass
  const PSI_AB = 0.66;             // und hinunter
  const PSI_FREI = -0.035;         // und so sacht sinkt sie, wenn niemand lenkt
  const DREH = 0.12;               // so träge dreht sie
  // Der Schwung: Was sie über das Tempo ihrer Linie hinaus hat, verliert sie
  // nur langsam – hoch an der Wand aber rasch (dort bremst es). Was ihr
  // fehlt, schiebt die Welle schnell nach.
  const TRAEG_SCHWUNG = 3.2;
  const TRAEG_HOCH = 1.2;
  const BREMS_AB = 0.58;           // ab dieser Höhe bremst es
  const TRAEG_SCHUB = 1.3;
  const V_MIN = 2;
  const V_MAX = 1.9;               // mal das Tempo der Welle
  // Die Linie: wie schnell die Welle in welcher Höhe trägt (mal ihr eigenes
  // Tempo). Ganz unten im Flachen wenig, in der Mitte der Wand am meisten,
  // zur Lippe hin weniger – hoch oben fährt man langsam und fällt tiefer in
  // die Röhre.
  const LINIE = [[0, 0.5], [0.12, 0.8], [0.3, 1.0], [0.45, 1.05], [0.6, 0.98], [0.75, 0.85], [0.9, 0.73], [1, 0.64]];
  // Die Tasche: Nahe am Schaum schiebt die Welle stärker, weit vorn auf der
  // Schulter schwächer – und gegen Ende der Runde immer schwächer. Wer
  // davonfährt, dem fehlt bald die Kraft der Welle.
  const TASCHE_NAH = 1.2;
  const TASCHE_FERN = [0.86, 0.7];
  const TASCHE_WEIT = 10;
  // Der Sog: Ganz dicht am Schaum reisst das Wasser zurück – wer zu gierig
  // ist, kommt dort nur mit Pumpen wieder heraus.
  const SOG = 0.22;
  const SOG_WEIT = 1.2;
  // Der Hang: wie stark Höhe und Tempo sich tauschen (m/s²). Hinunter gibt
  // es den vollen Hang, hinauf kostet es nur einen Teil davon – die Welle
  // hebt mit. Darum gibt jedes Auf und Ab Schwung: Pumpen.
  const HANG = 12;
  const HEBT = 0.45;
  const STEIL_OBEN = 1.4;          // um so viel steiler ist die Wand unter der Lippe
  const ZAEH = 0.6;                // unter der Lippe geht es zäh hinauf …
  const ZAEH_AB = 0.7;             // … ab dieser Höhe
  // Was ein guter Pumper im Mittel schafft (mal die Linie in der Tasche):
  // Damit wird nachgerechnet, ob jede Welle schaffbar bleibt.
  const PUMP_IDEAL = 1.14;
  const SCHWUNG_ZEIGEN = 0.2;      // so viel Tempo (mal die Welle) muss ein Abstieg bringen, damit «Schwung» erscheint

  // Die Punkte: je Sekunde in der Röhre, am Rand wenig, in der Tiefe viel –
  // mal die Serie, die mit der Zeit ohne Unterbruch wächst.
  const P_RAND = 0.35;
  const P_TIEF = 10.5;
  const P_HOCH = 2.6;
  const SERIE_MAX = 4;
  const SERIE_VOLL = 30;           // nach so vielen Sekunden in der Röhre gilt ×4
  const GNADE = 0.45;              // so lange darf man kurz hinaus, ohne die Serie zu verlieren
  const BONUS = 25;                // am Strand

  // Die Abschnitte.
  const RAMPE = 0.3;               // so lange braucht der Schaum, um anzuziehen
  const RESERVE = 4;               // so viel Luft bleibt auf der schnellsten Linie immer (m)
  const TAB_SCHRITT = 0.05;        // die Tabelle des Schaums: alle 50 ms

  const TOP_COUNT = 5;
  const store = cloudApi
    ? cloudApi.register({ key: "lernapp.welle", empty: { runs: 0, scores: [] }, merge: cloudApi.mergeScores(TOP_COUNT) })
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
  const GRAD = Math.PI / 180;

  // Eine Kurve durch Stützstellen [[x, y], …]: zwischen zwei Stellen weich,
  // ohne über eine hinauszuschiessen.
  function kurve(stellen, x, spalte = 1) {
    const n = stellen.length;
    if (x <= stellen[0][0]) return stellen[0][spalte];
    if (x >= stellen[n - 1][0]) return stellen[n - 1][spalte];
    let i = 0;
    while (i < n - 2 && x >= stellen[i + 1][0]) i += 1;
    const a = stellen[i];
    const b = stellen[i + 1];
    const steig = (j) => {
      const vor = stellen[j - 1];
      const nach = stellen[j + 1];
      const d0 = vor ? (stellen[j][spalte] - vor[spalte]) / (stellen[j][0] - vor[0]) : null;
      const d1 = nach ? (nach[spalte] - stellen[j][spalte]) / (nach[0] - stellen[j][0]) : null;
      if (d0 === null) return d1 ?? 0;
      if (d1 === null) return d0;
      if (d0 * d1 <= 0) return 0;
      return (2 * d0 * d1) / (d0 + d1);
    };
    const h = b[0] - a[0];
    const s = (x - a[0]) / h;
    const s2 = s * s;
    const s3 = s2 * s;
    return (2 * s3 - 3 * s2 + 1) * a[spalte] + (s3 - 2 * s2 + s) * h * steig(i)
      + (3 * s2 - 2 * s3) * b[spalte] + (s3 - s2) * h * steig(i + 1);
  }

  const tempoBei = (t) => C0 + (C1 - C0) * Math.pow(clamp(t / DAUER, 0, 1), 0.85);
  const linie = (h) => kurve(LINIE, clamp(h, 0, 1));
  const tasche = (d, t) => {
    const fern = lerp(TASCHE_FERN[0], TASCHE_FERN[1], clamp(t / DAUER, 0, 1));
    const nah = Math.max(0, d);
    return fern + (TASCHE_NAH - fern) * Math.exp(-nah / TASCHE_WEIT) - SOG * Math.exp(-nah / SOG_WEIT);
  };
  // Wie steil die Wand in der Höhe h ist: im Tal flach, zur Lippe hin senkrecht
  // – dort oben kostet jeder Meter Tempo, und hinunter gibt er viel.
  const steilBei = (h) => 0.3 + 0.7 * weich(0, 0.35, h) + STEIL_OBEN * weich(0.72, 1, h);
  // Die Serie: ×1 beim Eintauchen, ×4 nach SERIE_VOLL Sekunden.
  const malBei = (serie) => 1 + (SERIE_MAX - 1) * clamp(serie / SERIE_VOLL, 0, 1);
  // Punkte je Sekunde in der Tiefe d (ohne Serie).
  const punkteBei = (d) => (d < ROEHRE && d >= 0 ? P_RAND + P_TIEF * Math.pow(1 - d / ROEHRE, P_HOCH) : 0);

  // ---------------------------------------------------------------------------
  // Der Abend
  // ---------------------------------------------------------------------------
  // Drei Lichter über die Runde (k = Zeit / DAUER): Die Sonne sinkt, der
  // Himmel wird rot, das Wasser dunkler. Dazwischen gleitet alles.
  const ABEND = [
    {
      k: 0, name: "Goldene Stunde", sonne: 7.2, kraft: 1, dichte: 1 / 300,
      zenit: [0.17, 0.36, 0.66], horizont: [1.0, 0.80, 0.52], glut: [1.0, 0.64, 0.24], licht: [1.0, 0.86, 0.60],
      wolkeHell: [1.0, 0.84, 0.58], wolkeDunkel: [0.55, 0.46, 0.56], himmelLicht: [0.50, 0.58, 0.70],
      tief: [0.010, 0.085, 0.115], streu: [0.03, 0.30, 0.30], durch: [1.0, 0.95, 0.72],
    },
    {
      k: 0.5, name: "Sonnenuntergang", sonne: 3.4, kraft: 0.98, dichte: 1 / 280,
      zenit: [0.15, 0.25, 0.56], horizont: [1.0, 0.62, 0.32], glut: [1.0, 0.44, 0.12], licht: [1.0, 0.68, 0.36],
      wolkeHell: [1.0, 0.62, 0.38], wolkeDunkel: [0.42, 0.28, 0.46], himmelLicht: [0.44, 0.44, 0.62],
      tief: [0.010, 0.070, 0.105], streu: [0.03, 0.25, 0.27], durch: [1.0, 0.86, 0.58],
    },
    {
      k: 1, name: "Abendrot", sonne: 0.9, kraft: 0.86, dichte: 1 / 260,
      zenit: [0.11, 0.15, 0.44], horizont: [0.98, 0.45, 0.30], glut: [1.0, 0.32, 0.14], licht: [1.0, 0.50, 0.26],
      wolkeHell: [1.0, 0.46, 0.38], wolkeDunkel: [0.30, 0.19, 0.40], himmelLicht: [0.36, 0.33, 0.54],
      tief: [0.010, 0.055, 0.095], streu: [0.03, 0.20, 0.24], durch: [1.0, 0.74, 0.46],
    },
  ];
  const ABEND_FELDER = ["zenit", "horizont", "glut", "licht", "wolkeHell", "wolkeDunkel", "himmelLicht", "tief", "streu", "durch"];
  const abend = { name: ABEND[0].name, sonne: 0, kraft: 0, dichte: 0 };
  ABEND_FELDER.forEach((feld) => { abend[feld] = [0, 0, 0]; });

  // Das Licht zu einer Zeit der Runde – in abend, ohne neue Objekte.
  function abendBei(k) {
    let i = 0;
    while (i < ABEND.length - 2 && k >= ABEND[i + 1].k) i += 1;
    const a = ABEND[i];
    const b = ABEND[i + 1];
    const t = weich(a.k, b.k, k);
    abend.name = ABEND[k >= b.k ? i + 1 : i].name;
    abend.sonne = lerp(a.sonne, b.sonne, t);
    abend.kraft = lerp(a.kraft, b.kraft, t);
    abend.dichte = lerp(a.dichte, b.dichte, t);
    for (const feld of ABEND_FELDER) {
      for (let j = 0; j < 3; j += 1) abend[feld][j] = lerp(a[feld][j], b[feld][j], t);
    }
    return abend;
  }

  // ---------------------------------------------------------------------------
  // Zustand
  // ---------------------------------------------------------------------------
  // phase:   "bereit" (noch nichts gedrückt), "spiel", "zuschauen", "ende"
  // schritt: "start" (er gleitet auf der Schulter), "fahrt", "aus" (verschluckt
  //          oder gestürzt), "strand"
  const state = {
    phase: "bereit",
    schritt: "start",
    schluss: "",          // "schaum", "lippe" oder "strand"
    punkte: 0,
    roh: 0,               // die Punkte, ungerundet
    z0: 0,                // wo der Schaum beim Start der Runde stand
    zp: START_D,          // der Surfer, längs der Welle
    zs: 0,                // der Schaum
    h: START_H,           // wie hoch an der Wand
    psi: 0,               // seine Richtung auf der Wand
    v: C0,
    halten: false,        // lenkt sie hinauf (für ältere Prüfungen)
    lenk: 0,              // 1 hinauf, -1 hinunter, 0 geradeaus
    schwungZahl: 0,       // wie oft ein Abstieg sichtbar Schwung gab
    zeit: 0,              // seit dem Aufbau der Runde
    spielzeit: 0,         // seit dem Start – danach läuft der Schaum
    serie: 0,             // Sekunden in der Röhre ohne Unterbruch
    draussen: 0,          // wie lange gerade nicht in der Röhre
    drin: false,
    roehrenzeit: 0,
    tiefste: ROEHRE,
    besteSerie: 1,
    kraft: 1,             // wie hoch die Welle steht (am Strand fällt sie zusammen)
    welt: null,
    spur: [],
    karte: null,
    stoss: 0,
    weiss: 0,             // Schaum vor der Linse
    knapp: 0,             // eben knapp entkommen: Tropfen auf der Linse
    schrittZeit: 0,
    licht: 0,
  };

  let shell = null;
  let feld = null;
  let canvas = null;       // WebGL: die Welt
  let hud = null;          // 2D: Zahlen und Namen darüber
  let g = null;
  let frame = null;
  let last = 0;
  // Die Gegner (geist.js): wer als Surfer aus Licht mitfährt.
  let gegner = null;
  // Wer einen Lauf anschaut statt zu fahren (geist.js, zuschauer).
  let zuschauer = null;

  function stopLoop() {
    if (frame) { window.cancelAnimationFrame(frame); frame = null; }
  }

  // ---------------------------------------------------------------------------
  // Die Welt: die Abschnitte der Welle
  // ---------------------------------------------------------------------------
  /*
   * Die Runde besteht aus ruhigen Strecken und Abschnitten, einer nach dem
   * anderen, nach der Zeit:
   *
   *   schnell   der Schaum zieht für 2–4 s an (mal f, über 1)
   *   langsam   er lässt für ein paar Sekunden nach (f unter 1)
   *   doppel    zwei kurze, harte Schläge kurz hintereinander
   *
   * Mit der Zeit werden die Pausen kürzer und die Abschnitte heftiger. Aus
   * den Abschnitten und dem Tempo der Welle entsteht die Tabelle des Schaums
   * (weg): wo er zu welcher Zeit ist – für alle gleich, wie auch immer
   * jemand fährt. Aus ihr folgt, wo längs der Welle ein Abschnitt liegt
   * (z0 bis z1): Dort läuft die Gischt die Lippe entlang.
   */
  function neueWelt() {
    const ab = [];
    let t = SANFT + 2 + zufall.zahl() * 1.5;
    let vorher = "";
    while (t < DAUER - 3.5) {
      const k = t / DAUER;
      const wahl = [["schnell", 3]];
      if (vorher !== "langsam") wahl.push(["langsam", 1.3]);
      if (k > 0.3 && vorher !== "doppel") wahl.push(["doppel", 0.5 + 2.2 * k]);
      let los = zufall.zahl() * wahl.reduce((summe, [, gewicht]) => summe + gewicht, 0);
      let art = wahl[0][0];
      for (const [name, gewicht] of wahl) {
        art = name;
        los -= gewicht;
        if (los <= 0) break;
      }
      if (art === "schnell") {
        const dauer = lerp(2, 4, zufall.zahl());
        const f = lerp(1.2, 1.42, Math.pow(k, 0.7)) + 0.12 * zufall.zahl() * (0.4 + 0.6 * k);
        ab.push({ art, t0: t, t1: t + dauer, f });
        t += dauer;
      } else if (art === "langsam") {
        const dauer = lerp(2.4, 4, zufall.zahl());
        const f = 0.85 - 0.07 * zufall.zahl();
        ab.push({ art, t0: t, t1: t + dauer, f });
        t += dauer;
      } else {
        const f = lerp(1.45, 1.6, k) + 0.1 * zufall.zahl();
        const schlag = lerp(0.9, 0.7, zufall.zahl());
        const luecke = lerp(0.9, 0.6, zufall.zahl());
        ab.push({ art, t0: t, t1: t + schlag, f });
        ab.push({ art, t0: t + schlag + luecke, t1: t + 2 * schlag + luecke, f });
        t += 2 * schlag + luecke;
      }
      vorher = art;
      t += lerp(4.4, 1.5, k) * (0.7 + 0.6 * zufall.zahl());
    }
    const welt = { ab, weg: null, von: 0, enger: 0 };
    // Schaffbar muss es bleiben: Wer immer die schnellste Linie fährt, behält
    // RESERVE Meter Luft. Wo nicht, zieht der Abschnitt weniger stark an –
    // für alle gleich, ohne neue Zufallszahl.
    for (let versuch = 0; versuch < 400; versuch += 1) {
      const eng = ideallinie(welt);
      if (eng.d >= RESERVE || !eng.ab) break;
      eng.ab.f = 1 + (eng.ab.f - 1) * 0.94;
      welt.enger += 1;
    }
    // Die Tabelle des Schaums.
    const n = Math.ceil((DAUER + 14) / TAB_SCHRITT) + 1;
    const weg = new Float64Array(n);
    for (let i = 1; i < n; i += 1) {
      const tm = (i - 0.5) * TAB_SCHRITT;
      weg[i] = weg[i - 1] + tempoBei(tm) * faktorIn(welt, tm) * TAB_SCHRITT;
    }
    welt.weg = weg;
    for (const a of ab) {
      a.z0 = schaumIn(welt, a.t0);
      a.z1 = schaumIn(welt, a.t1);
    }
    return welt;
  }

  // Die schnellste Linie, nachgerechnet: Wie nah kommt der Schaum dem, der
  // immer in der Tasche pumpt, so gut wie ein geübter Mensch? Zurück kommen
  // der kleinste Abstand und der Abschnitt, in dem es so eng wurde.
  function ideallinie(welt) {
    let d = START_D;
    const eng = { d: Infinity, t: 0, ab: null };
    const dt = 0.05;
    for (let t = 0; t < DAUER; t += dt) {
      d += tempoBei(t) * (PUMP_IDEAL * tasche(d, t) - faktorIn(welt, t)) * dt;
      if (d < eng.d) {
        eng.d = d;
        eng.t = t;
      }
      if (d < RESERVE && !eng.ab) eng.ab = welt.ab.filter((a) => a.f > 1 && a.t0 <= t).pop() || null;
    }
    return eng;
  }

  // Um wie viel der Schaum zur Zeit t schneller (oder langsamer) läuft.
  function faktorIn(welt, t) {
    let f = SANFT_FAKTOR + (1 - SANFT_FAKTOR) * weich(SANFT * 0.4, SANFT, t);
    for (const a of welt.ab) {
      if (t < a.t0) break;
      if (t > a.t1) continue;
      f *= 1 + (a.f - 1) * weich(a.t0, a.t0 + RAMPE, t) * (1 - weich(a.t1 - RAMPE, a.t1, t));
    }
    return f;
  }
  const faktorBei = (t) => faktorIn(state.welt, t);

  // Wo der Schaum zur Zeit t ist (ab dem Start, in Metern).
  function schaumIn(welt, t) {
    const w = welt.weg;
    const k = clamp(t / TAB_SCHRITT, 0, w.length - 1.001);
    const i = Math.floor(k);
    return w[i] + (w[i + 1] - w[i]) * (k - i);
  }
  const schaumBei = (t) => schaumIn(state.welt, t);

  // Und umgekehrt: wann er an der Stelle z (ab dem Start) ist.
  function zeitBei(z) {
    const w = state.welt.weg;
    if (z <= 0) return z / (C0 * SANFT_FAKTOR);
    let lo = 0;
    let hi = w.length - 1;
    if (z >= w[hi]) return hi * TAB_SCHRITT;
    while (hi - lo > 1) {
      const m = (lo + hi) >> 1;
      if (w[m] <= z) lo = m;
      else hi = m;
    }
    return (lo + (z - w[lo]) / Math.max(1e-6, w[hi] - w[lo])) * TAB_SCHRITT;
  }

  // Wie viel Gischt an der Stelle z (in der Welt) die Lippe entlangläuft:
  // 0 über einer ruhigen Strecke, bis 1 über einem harten Abschnitt. Sie
  // läuft dem Abschnitt ein Stück voraus – so sieht man ihn kommen.
  function gischtBei(z) {
    const rel = z - state.z0;
    let stark = 0;
    for (const a of state.welt.ab) {
      if (a.f <= 1) continue;
      if (rel < a.z0 - 10 || rel > a.z1 + 2) continue;
      const k = weich(a.z0 - 10, a.z0 - 3, rel) * (1 - weich(a.z1 - 2, a.z1 + 2, rel));
      stark = Math.max(stark, k * clamp((a.f - 1) / 0.5, 0.45, 1));
    }
    return stark;
  }

  // Die gewürfelte Welt in Worten: die Abschnitte der ersten Minute. Im
  // Turnier bekommen alle denselben Text.
  function weltText() {
    return state.welt.ab.filter((a) => a.t0 < 60)
      .map((a) => `${a.art[0]}${a.t0.toFixed(2)}-${a.t1.toFixed(2)}×${a.f.toFixed(3)}`).join(" ");
  }

  // ---------------------------------------------------------------------------
  // Die Form der Welle
  // ---------------------------------------------------------------------------
  /*
   * Der Querschnitt an einer Stelle ist ein Bogen: Er beginnt im Tal (Winkel
   * 0), steigt als Wand nach links hinauf, und wie weit er reicht, sagt der
   * Lippenwinkel. Voraus auf der Schulter ist es ein flacher, weiter Bogen
   * (eine runde Dünung); zum Schaum hin wird er eng und steil, die Lippe
   * wirft über (ab 180 Grad ist das Dach zu) und fällt rechts als Vorhang
   * ins Tal. FORM sagt beides nach dem Abstand u vor dem Schaum: den
   * Lippenwinkel in Grad und den Radius des Bogens. Der Kamm der Welle läuft
   * gerade (bei x = -KAMM); die Mitte des Bogens (mx) folgt daraus.
   *
   * Dieselbe Form rechnet das Programm der Welle (FORM_GLSL) – aus den zwei
   * Zahlen, die jede Reihe des Netzes von hier bekommt.
   */
  const FORM = [
    [-16, 346, 2.9], [0, 338, 3.0], [5, 302, 3.1], [9, 248, 3.2], [12, 202, 3.3], [16, 154, 3.7],
    [22, 116, 4.6], [30, 88, 6.2], [45, 62, 10], [70, 46, 15], [130, 36, 20], [210, 22, 26], [300, 0, 30],
  ];
  const DREIVIERTEL = Math.PI * 1.5;
  const HOCH_WINKEL = 84 * GRAD;   // so weit hinauf reicht h = 1 in der Röhre
  const KAMM = 3.2;                // so weit links vom Nullpunkt läuft der Kamm der Welle
  const form = { lip: 0, R: 1, mx: 0 };

  // Die Form an der Stelle z der Welt (u Meter vor dem Schaum) – in form.
  function formBei(u, z) {
    const t = state.zeit;
    let lip = kurve(FORM, u, 1) * GRAD;
    let R = kurve(FORM, u, 2);
    // Keine Welle ist glatt: Die Lippe atmet, wo sie überhängt.
    const lebendig = weich(50 * GRAD, 150 * GRAD, lip) * (1 - weich(310 * GRAD, 340 * GRAD, lip));
    lip += (0.07 * Math.sin(z * 0.37 + t * 1.3) + 0.045 * Math.sin(z * 0.91 - t * 2.3) + 0.03 * Math.sin(z * 1.9 + t * 3.1)) * lebendig;
    R *= 1 + 0.035 * Math.sin(z * 0.13 + t * 0.6) * weich(14, 40, u);
    form.lip = lip * (0.35 + 0.65 * state.kraft);
    form.R = R * (0.25 + 0.75 * state.kraft);
    // Der Kamm läuft gerade: Wo die Wand flacher ist, liegt das Tal weiter
    // rechts.
    form.mx = form.R * Math.sin(Math.min(form.lip, Math.PI / 2)) - KAMM;
    return form;
  }

  // Ein Punkt des Bogens: quer (mal Radius) und hoch (mal Radius, über dem Tal).
  const querBei = (p) => (p <= DREIVIERTEL ? -Math.sin(p) : 1 + 0.1 * (p - DREIVIERTEL));
  const hochBei = (p) => 1 - Math.cos(p);

  // Wo der Surfer in der Höhe h auf dem Bogen steht (sein Winkel).
  const winkelBei = (h, lip) => clamp(h, 0, 1.15) * Math.min(lip * 0.96, HOCH_WINKEL);

  // ---------------------------------------------------------------------------
  // Teilchen: Gischt, Sprühnebel, Spritzer
  // ---------------------------------------------------------------------------
  // Alle in einem Vorrat fester Grösse – kein neues Objekt je Tropfen.
  const TEILE_MAX = 520;
  const teile = { n: 0 };
  ["x", "y", "z", "vx", "vy", "vz", "leben", "max", "gross", "wachs", "hell", "fall"].forEach((name) => { teile[name] = new Float32Array(TEILE_MAX); });

  function teil(x, y, z, vx, vy, vz, leben, gross, wachs, hell, fall) {
    if (teile.n >= TEILE_MAX) return;
    const i = teile.n;
    teile.n += 1;
    teile.x[i] = x; teile.y[i] = y; teile.z[i] = z;
    teile.vx[i] = vx; teile.vy[i] = vy; teile.vz[i] = vz;
    teile.leben[i] = leben; teile.max[i] = leben;
    teile.gross[i] = gross; teile.wachs[i] = wachs; teile.hell[i] = hell; teile.fall[i] = fall;
  }

  function teileTakt(dt) {
    for (let i = teile.n - 1; i >= 0; i -= 1) {
      teile.leben[i] -= dt;
      if (teile.leben[i] <= 0) {
        teile.n -= 1;
        const l = teile.n;
        if (i !== l) for (const name of ["x", "y", "z", "vx", "vy", "vz", "leben", "max", "gross", "wachs", "hell", "fall"]) teile[name][i] = teile[name][l];
        continue;
      }
      teile.vy[i] -= teile.fall[i] * dt;
      teile.x[i] += teile.vx[i] * dt;
      teile.y[i] += teile.vy[i] * dt;
      teile.z[i] += teile.vz[i] * dt;
      teile.gross[i] += teile.wachs[i] * dt;
    }
  }

  // Gischt von der Lippe: Der Wind vom Land bläst sie zurück über die Welle,
  // und im Gegenlicht leuchtet sie. Über einem schnellen Abschnitt ist es
  // eine weisse Fahne.
  let gischtRest = 0;
  function gischtTakt(dt) {
    const weit = 110;
    gischtRest += dt * (ruhig() ? 70 : 230);
    while (gischtRest >= 1) {
      gischtRest -= 1;
      const z = kam.z + 1 + Math.pow(Math.random(), 1.5) * weit;
      const u = z - state.zs;
      const stark = gischtBei(z);
      const f = formBei(u, z);
      const x = f.mx + f.R * querBei(f.lip);
      const y = f.R * hochBei(f.lip);
      if (f.lip > 190 * GRAD) {
        // Wo der Vorhang ins Tal schlägt, stäubt es weiss auf.
        if (f.lip > 300 * GRAD && Math.random() < 0.5) {
          teil(f.mx + f.R * (1 + Math.random() * 0.25), 0.2 + Math.random() * 0.5, z,
            0.5 + Math.random() * 2, 1 + Math.random() * 2.5, 1 + Math.random() * 3,
            0.5 + Math.random() * 0.5, 0.45 + Math.random() * 0.5, 1.6, 0.4, 3);
          continue;
        }
        // Über einem schnellen Abschnitt stäubt die ganze Kante.
        if (Math.random() < stark * 0.85) {
          teil(x + (Math.random() - 0.5) * 0.5, y + (Math.random() - 0.5) * 0.5, z,
            0.3 + Math.random() * 1.5, -0.5 + Math.random() * 2.5, -1 - Math.random() * 3,
            0.5 + Math.random() * 0.6, 0.35 + Math.random() * 0.45, 1.3, 0.7, 3.5);
          continue;
        }
        // Unter dem Dach: Tropfen, die von der Kante fallen und im
        // Gegenlicht funkeln.
        if (Math.random() < 0.4) {
          teil(x + (Math.random() - 0.5) * 0.3, y - Math.random() * 0.4, z,
            0.4 + Math.random() * 1.2, -0.5 - Math.random() * 2, -1 - Math.random() * 2,
            0.35 + Math.random() * 0.4, 0.035 + Math.random() * 0.05, 0, 1.6, 9.8);
        }
        continue;
      }
      // Wo die Lippe gerade überwirft, stäubt es am meisten.
      const kante = weich(34 * GRAD, 70 * GRAD, f.lip) * (0.45 + 0.55 * weich(60 * GRAD, 120 * GRAD, f.lip));
      if (Math.random() > (0.3 + 0.7 * stark) * kante) continue;
      const wucht = 0.7 + 1.8 * stark;
      if (Math.random() < 0.6) {
        // Die Fahne: steil hinauf, der Wind vom Land trägt sie zurück.
        teil(x + (Math.random() - 0.5) * 0.6, y + Math.random() * 0.3, z,
          -0.3 - Math.random() * 1.6, 2.2 + Math.random() * 3.6 * wucht, -1 - Math.random() * 3,
          0.9 + Math.random() * 1.1, 0.5 + Math.random() * 0.7 + 0.8 * stark, 1.5 + 1.8 * stark, 0.6 + 0.4 * stark, 1.2);
      } else {
        // Und was die Lippe nach vorn wirft: ein Schleier vor der Wand.
        teil(x + 0.2 + Math.random() * 0.5, y - Math.random() * 0.4, z,
          0.6 + Math.random() * 2.4, 0.3 + Math.random() * 1.8, -1 - Math.random() * 3,
          0.7 + Math.random() * 0.8, 0.4 + Math.random() * 0.5 + 0.6 * stark, 1.3 + 1.4 * stark, 0.45 + 0.4 * stark, 4);
      }
    }
  }

  // Der Schaumball im Rücken: Je näher er ist, desto mehr Sprühnebel schiesst
  // von hinten durch die Röhre.
  let nebelRest = 0;
  function nebelTakt(dt) {
    const d = state.zp - state.zs;
    const nah = 1 - weich(1, 5.5, d);
    if (nah <= 0.01) return;
    nebelRest += dt * nah * (ruhig() ? 14 : 46);
    const f = formBei(kam.z - state.zs, kam.z);
    while (nebelRest >= 1) {
      nebelRest -= 1;
      const w = Math.random() * Math.PI * 2;
      const r = Math.sqrt(Math.random()) * f.R * 0.85;
      teil(f.mx + Math.cos(w) * r, f.R + Math.sin(w) * r * 0.9, kam.z - 1.5 - Math.random() * 2,
        (Math.random() - 0.5) * 1.5, (Math.random() - 0.5) * 1.5, state.v + 5 + Math.random() * 9,
        0.45 + Math.random() * 0.4, 0.6 + Math.random() * 0.8, 1.8, 0.07 + 0.2 * nah, 0);
    }
  }

  // Spritzer am Brett.
  let spritzRest = 0;
  function spritzTakt(dt) {
    if (state.schritt !== "fahrt" && state.schritt !== "start") return;
    spritzRest += dt * (ruhig() ? 14 : 44) * clamp(state.v / 12, 0.4, 1.6);
    while (spritzRest >= 1) {
      spritzRest -= 1;
      const s = surfer;
      const seite = Math.random() - 0.3;
      teil(s.x + s.auf[0] * 0.05 - s.tx * 0.7 + s.sx * seite * 0.3, s.y + 0.08 - s.ty * 0.7 + s.sy * seite * 0.3, state.zp - 0.75 - Math.random() * 0.3,
        s.sx * (0.6 + Math.random() * 2.6) + s.auf[0] * 1.2, s.sy * (0.6 + Math.random() * 2.6) + s.auf[1] * (0.8 + Math.random() * 1.5), state.v * (0.25 + Math.random() * 0.3),
        0.25 + Math.random() * 0.3, 0.06 + Math.random() * 0.1, 0.35, 0.5, 6);
    }
  }

  // ---------------------------------------------------------------------------
  // Der Surfer im Raum
  // ---------------------------------------------------------------------------
  // Wo er steht und wie: der Punkt auf der Wand, die Richtung die Wand hinauf
  // (sx, sy), die Richtung von der Wand weg (auf) und seine Fahrtrichtung.
  // haltung: wie sie gerade steht (haltungBei), unten: wohin die Schwerkraft
  // in ihrem Raum zieht, psi: ihre Richtung im letzten Bild (fürs Haar).
  const surfer = { x: 0, y: 0, p: 0, R: 3, lip: 3, sx: -1, sy: 0, auf: [0, 1, 0], tx: 0, ty: 0, tz: 1, lehn: 0, haltung: null, unten: [0, -1, 0], psi: 0 };

  function surferStellen(h, z, psi, ziel = surfer) {
    const f = formBei(z - state.zs, z);
    const p = winkelBei(h, f.lip);
    ziel.p = p;
    ziel.R = f.R;
    ziel.lip = f.lip;
    ziel.x = f.mx + f.R * querBei(p);
    ziel.y = f.R * hochBei(p);
    ziel.sx = -Math.cos(p);
    ziel.sy = Math.sin(p);
    ziel.auf[0] = Math.sin(p);
    ziel.auf[1] = Math.cos(p);
    ziel.auf[2] = 0;
    const c = Math.cos(psi);
    const s = Math.sin(psi);
    ziel.tx = ziel.sx * s;
    ziel.ty = ziel.sy * s;
    ziel.tz = c;
    return ziel;
  }

  // Die Spur des Bretts auf der Wand: wo er war (z in der Welt, Winkel auf
  // dem Bogen), alle paar Dezimeter. Das Wasser zieht die Wand hinauf – die
  // Spur wandert mit.
  const SPUR_N = 56;
  const SPUR_SCHRITT = 0.3;
  const spur = { z: new Float32Array(SPUR_N), p: new Float32Array(SPUR_N), t: new Float32Array(SPUR_N), n: 0, kopf: 0, zuletzt: -1e9 };

  function spurNeu() {
    spur.n = 0;
    spur.kopf = 0;
    spur.zuletzt = -1e9;
  }

  function spurTakt() {
    if (state.zp - spur.zuletzt < SPUR_SCHRITT) return;
    spur.zuletzt = state.zp;
    spur.kopf = (spur.kopf + 1) % SPUR_N;
    spur.z[spur.kopf] = state.zp - 0.8;
    spur.p[spur.kopf] = surfer.p;
    spur.t[spur.kopf] = state.zeit;
    spur.n = Math.min(SPUR_N, spur.n + 1);
  }

  // ---------------------------------------------------------------------------
  // Die Kamera
  // ---------------------------------------------------------------------------
  // Hinter und leicht über dem Surfer, in der Röhre, mit Blick voraus die
  // Welle entlang – wie eine Helmkamera. Gezeichnet wird relativ zu ihr in z
  // (dort ist sie null): So rechnet die Grafikkarte auch nach einem Kilometer
  // mit kleinen Zahlen. x und y sind ohnehin klein.
  const view = { cssW: 0, cssH: 0, dpr: 1, frei: 0, pw: 0, ph: 0, guete: 1, fest: false, langsam: 0, schnell: 0 };
  const kam = {
    x: 0, y: 3, z: 0, roll: 0, weit: 6.5, fov: 1, seit: 1, zx: 0, zy: 3,
    rechts: [1, 0, 0], hoch: [0, 1, 0], vor: [0, 0, 1], tan: [1, 1], auge: [0, 3, 0],
    proj: new Float32Array(16), sicht: new Float32Array(16), pv: new Float32Array(16),
  };
  const KAM_WEIT = 5.8;            // so weit hinter dem Surfer, wenn Platz ist
  const KAM_RAND = 0.95;           // so viel Luft bleibt zur Wand

  function kameraTakt(dt, sofort = false) {
    const d = state.zp - state.zs;
    // Der Schaum drängt die Kamera an den Surfer heran.
    // Hochkant ist das Bild schmal: Dort rückt sie näher.
    const hochkant = clamp((1.1 - view.cssW / Math.max(1, view.cssH)) / 0.6, 0, 1);
    const weitZiel = clamp(d + 2.6, 3.3, KAM_WEIT - 1.3 * hochkant);
    const k = sofort ? 1 : 1 - Math.exp(-dt / 0.35);
    kam.weit += (weitZiel - kam.weit) * k;
    kam.z = state.zp - kam.weit;
    const s = surfer;
    // Von der Wand weg zur Mitte der Röhre, und ein Stück höher.
    let wx = s.x + s.auf[0] * 1.25 + 0.55;
    let wy = s.y + s.auf[1] * 0.75 + 0.95;
    const f = formBei(kam.z - state.zs, kam.z);
    const dx = wx - f.mx;
    const dy = wy - f.R;
    const ab = Math.hypot(dx, dy);
    const max = Math.max(0.4, f.R - KAM_RAND);
    if (ab > max) { wx = f.mx + dx * max / ab; wy = f.R + dy * max / ab; }
    wy = Math.max(wy, 0.75);
    const kq = sofort ? 1 : 1 - Math.exp(-dt / 0.28);
    kam.x += (wx - kam.x) * kq;
    kam.y += (wy - kam.y) * kq;
    // Der Blick: voraus zur Öffnung der Röhre, ein wenig zum Surfer hin.
    const v = formBei(kam.z + 16 - state.zs, kam.z + 16);
    // Am Schluss dreht sie zum Land: Dort liegt der Strand.
    const zumLand = state.schritt === "strand" ? (7 - 5.5 * hochkant) * weich(0.2, 2.6, state.zeit - state.schrittZeit) : 0;
    const zx = lerp(lerp(kam.x, s.x, 0.35), v.mx, 0.4) - 0.2 - 1.6 * hochkant + zumLand;
    const zy = lerp(kam.y, Math.min(v.R, 4.2) * 0.9, 0.5);
    kam.zx += (zx - kam.zx) * kq;
    kam.zy += (zy - kam.zy) * kq;
    const rollZiel = ruhig() ? 0 : -state.psi * 0.07 - 0.03;
    kam.roll += (rollZiel - kam.roll) * (sofort ? 1 : 1 - Math.exp(-dt / 0.4));
  }

  function kameraStellen() {
    const seit = view.cssW / Math.max(1, view.cssH);
    // 62 Grad in der Höhe – auf einem sehr breiten Bild weniger (zur Seite
    // höchstens 86), hochkant mehr (zur Seite mindestens 62: die Röhre soll
    // das Bild füllen). Tief in der Röhre wird der Blick weiter.
    const d = state.zp - state.zs;
    const tief = ruhig() ? 0 : 1 - weich(1, ROEHRE + 3, d);
    let fov = 62 * GRAD;
    fov = Math.min(fov, 2 * Math.atan(Math.tan(43 * GRAD) / seit));
    fov = Math.max(fov, Math.min(1.75, 2 * Math.atan(Math.tan(29 * GRAD) / seit)));
    fov *= 1 + 0.12 * tief;
    kam.fov = fov;
    kam.seit = seit;
    const wackel = ruhig() ? 0 : state.stoss;
    const ax = (Math.sin(state.zeit * 61) * 0.06 + Math.sin(state.zeit * 37) * 0.05) * wackel;
    const ay = Math.sin(state.zeit * 53) * 0.07 * wackel;
    const ex = kam.x + ax;
    const ey = kam.y + ay;
    // Hochkant schaut die Kamera etwas höher: Dort ist das Dach.
    const hebt = clamp((1.1 - seit) / 0.6, 0, 1) * 2.6;
    let fx = kam.zx - ex;
    let fy = kam.zy + hebt - ey;
    let fz = 16;
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
    kam.rechts[0] = rx; kam.rechts[1] = ry; kam.rechts[2] = rz;
    kam.hoch[0] = hx; kam.hoch[1] = hy; kam.hoch[2] = hz;
    kam.vor[0] = fx; kam.vor[1] = fy; kam.vor[2] = fz;
    kam.tan[0] = Math.tan(fov / 2) * seit;
    kam.tan[1] = Math.tan(fov / 2);
    const s = kam.sicht;
    s[0] = rx; s[4] = ry; s[8] = rz; s[12] = -(rx * ex + ry * ey);
    s[1] = hx; s[5] = hy; s[9] = hz; s[13] = -(hx * ex + hy * ey);
    s[2] = -fx; s[6] = -fy; s[10] = -fz; s[14] = fx * ex + fy * ey;
    s[3] = 0; s[7] = 0; s[11] = 0; s[15] = 1;
    const f = 1 / Math.tan(fov / 2);
    const NAH = 0.25;
    const FERN = 1400;
    const p = kam.proj;
    p.fill(0);
    p[0] = f / seit; p[5] = f; p[10] = (FERN + NAH) / (NAH - FERN); p[11] = -1; p[14] = (2 * FERN * NAH) / (NAH - FERN);
    const pv = kam.pv;
    for (let c = 0; c < 4; c += 1) {
      for (let r = 0; r < 4; r += 1) {
        pv[c * 4 + r] = p[r] * s[c * 4] + p[4 + r] * s[c * 4 + 1] + p[8 + r] * s[c * 4 + 2] + p[12 + r] * s[c * 4 + 3];
      }
    }
    kam.auge[0] = ex; kam.auge[1] = ey; kam.auge[2] = 0;
  }

  // Wo ein Punkt der Welt im Bild steht (in CSS-Pixeln) – oder null, wenn er
  // hinter der Kamera liegt.
  function imBild(x, y, z) {
    const pz = z - kam.z;
    const m = kam.pv;
    const w = m[3] * x + m[7] * y + m[11] * pz + m[15];
    if (w <= 0.01) return null;
    const cx = (m[0] * x + m[4] * y + m[8] * pz + m[12]) / w;
    const cy = (m[1] * x + m[5] * y + m[9] * pz + m[13]) / w;
    return { x: (cx * 0.5 + 0.5) * view.cssW, y: (0.5 - cy * 0.5) * view.cssH, w };
  }

  // ---------------------------------------------------------------------------
  // Zeichnen: die Programme
  // ---------------------------------------------------------------------------
  let gl = null;
  const bild = { ok: false, verloren: false, prog: {}, netz: {}, rausch: null, leer: null, sonne: [0, 0, 1], sonneFlach: [0, 0, 1], licht: [1, 1, 1], durch: [1, 1, 1], roehre: [0, 0, 0] };

  // Das Netz der Welle: Reihen längs der Welle (nah dicht, fern weit), in
  // jeder Reihe vier Stücke des Querschnitts.
  const REIHEN = 96;
  const REIHEN_NAH = 46;           // so viele Reihen im gleichen Abstand …
  const REIHE_SCHRITT = 0.5;       // … von einem halben Meter
  const REIHE_WACHS = 1.085;       // dahinter wächst der Abstand
  const REIHE_Z0 = -0.6;
  const STUECKE = [10, 46, 18, 12];  // Vorland, Bogen innen, Lippe aussen, Rücken

  // Was alle Programme über das Licht wissen: Sonne, Himmel, Dunst. Der
  // Dunst zieht alles Ferne in die Farbe des Himmels am Horizont dahinter.
  const LICHT = `
    uniform vec3 uSonne, uSonneFlach, uLicht, uGlut, uHimmelLicht, uAuge, uZenit, uHorizont;
    uniform float uDichte, uZeit;
    // Der Himmel ohne Wolken: für alles, was ihn spiegelt, und für den Dunst.
    vec3 himmelGrund(vec3 d) {
      float h = max(d.y, 0.0);
      float zurSonne = max(dot(d, uSonne), 0.0);
      float seite = max(dot(normalize(d.xz + vec2(1e-4)), uSonneFlach.xz), 0.0);
      vec3 c = mix(uHorizont, uZenit, 1.0 - pow(1.0 - h, 3.4));
      float band = pow(1.0 - h, 10.0);
      c = mix(c, uGlut, band * (0.3 + 0.7 * seite * seite));
      c += uLicht * (pow(zurSonne, 5.0) * 0.20 + pow(zurSonne, 48.0) * 0.40);
      return c;
    }
    vec3 dunst(vec3 farbe, vec3 ort) {
      vec3 hin = ort - uAuge;
      float weit = length(hin);
      vec3 flach = normalize(vec3(hin.x, 0.0, hin.z + 1e-4));
      return mix(himmelGrund(flach), farbe, exp(-weit * uDichte));
    }
  `;

  // Das offene Meer, flach: Es spiegelt den Himmel und glitzert zur Sonne
  // hin. Dieselbe Rechnung für das Meer bis zum Horizont (im Programm des
  // Himmels) und für die Ränder des Netzes der Welle – so gibt es keine Naht.
  const MEER = `
    uniform sampler2D uRausch;
    uniform vec2 uLauf;            // Versatz der Muster: längs der Welle, und wie weit das Wasser zur Welle geflossen ist
    uniform vec3 uTief;
    vec3 meer(vec3 ort, vec3 v, float weit) {
      vec2 m = vec2(ort.z + uLauf.x, -ort.x - uLauf.y);
      vec4 a = texture(uRausch, m * 0.023);
      vec4 b = texture(uRausch, m * 0.083 + vec2(0.31, 0.67));
      vec2 neigung = (a.gb - 0.5) * 2.4 + (b.gb - 0.5) * 1.5;
      float ruhe = 1.0 / (1.0 + weit * 0.004);
      vec3 n = normalize(vec3(neigung.y * ruhe, 1.0, -neigung.x * ruhe));
      float nv = max(dot(n, v), 0.0);
      float spiegel = 0.03 + 0.97 * pow(1.0 - nv, 4.0);
      vec3 r = reflect(-v, n);
      r.y = abs(r.y);
      vec3 c = mix(uTief, himmelGrund(r), spiegel);
      float zurSonne = max(dot(r, uSonne), 0.0);
      c += uLicht * (pow(zurSonne, 380.0) * 20.0 + pow(zurSonne, 40.0) * 0.4) * spiegel;
      return c;
    }
  `;

  // Der Himmel: ein Dreieck über das ganze Bild. Aus der Blickrichtung jedes
  // Punkts entstehen Verlauf, Sonne, Wolken und die Küste; unter dem Horizont
  // das offene Meer und – wenn die Welle ihn erreicht – der Strand.
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
    uniform vec3 uRechts, uHoch, uVor, uWolkeHell, uWolkeDunkel;
    uniform vec2 uTan;
    uniform float uStrand;         // so weit rechts liegt der Strand
    ${LICHT}
    ${MEER}
    void main() {
      vec3 d = normalize(uVor + vBild.x * uTan.x * uRechts + vBild.y * uTan.y * uHoch);
      vec3 c;
      if (d.y < 0.0) {
        float t = uAuge.y / max(-d.y, 1e-5);
        vec3 ort = uAuge + d * t;
        c = meer(ort, -d, t);
        // Der Strand: nasser Sand, der den Himmel spiegelt, dahinter heller.
        float sand = smoothstep(uStrand - 1.5, uStrand + 1.5, ort.x + 2.0 * sin(ort.z * 0.05 + uLauf.x * 0.05));
        if (sand > 0.0) {
          float trocken = smoothstep(uStrand + 6.0, uStrand + 30.0, ort.x);
          vec3 r = vec3(-d.x, -d.y, -d.z);
          vec3 hell = vec3(0.50, 0.40, 0.30) * (uHimmelLicht * 0.9 + uLicht * 0.55);
          vec3 nass = mix(vec3(0.20, 0.15, 0.12) * (uHimmelLicht + uLicht * 0.3), himmelGrund(reflect(d, vec3(0.0, 1.0, 0.0))), 0.45);
          float saum = smoothstep(2.5, 0.0, abs(ort.x - uStrand - 1.0)) * 0.6;
          c = mix(c, mix(nass, hell, trocken) + saum * (uHimmelLicht * 0.6 + uLicht * 0.4), sand);
        }
        c = dunst(c, ort);
      } else {
        float h = d.y;
        float zurSonne = max(dot(d, uSonne), 0.0);
        float seite = max(dot(normalize(d.xz + vec2(1e-4)), uSonneFlach.xz), 0.0);
        c = mix(uHorizont, uZenit, 1.0 - pow(1.0 - h, 3.4));
        float band = pow(1.0 - h, 10.0);
        c = mix(c, uGlut, band * (0.3 + 0.7 * seite * seite));

        // Wolken: zwei Lagen Rauschen, zum Horizont hin gestreckt, von unten
        // beleuchtet, wo die Sonne steht.
        vec2 uv = d.xz / (h + 0.11);
        float w1 = texture(uRausch, uv * vec2(0.045, 0.10) + vec2(uZeit * 0.0015, 0.0)).a;
        float w2 = texture(uRausch, uv * vec2(0.12, 0.26) + vec2(-uZeit * 0.0011, 0.37)).r;
        float wolke = smoothstep(0.52, 0.8, w1 * 0.7 + w2 * 0.3 + 0.04);
        wolke *= smoothstep(0.015, 0.11, h) * (1.0 - smoothstep(0.5, 0.95, h));
        float hell = clamp(pow(zurSonne, 2.5) * 0.9 + band * 0.5 + (1.0 - h) * 0.25, 0.0, 1.0);
        c = mix(c, mix(uWolkeDunkel, uWolkeHell, hell), wolke * 0.78);

        // Die Sonne: ein weiter Hof, ein enger, die Scheibe.
        c += uLicht * (pow(zurSonne, 5.0) * 0.20 + pow(zurSonne, 48.0) * 0.40 + pow(zurSonne, 500.0) * 0.9) * (1.0 - wolke * 0.5);
        c += uLicht * smoothstep(0.99945, 0.9998, zurSonne) * 3.0;

        // Die Küste: Hügel am Horizont, nur zum Land hin (rechts).
        float az = atan(d.x, d.z);
        float land = smoothstep(0.25, 0.8, d.x / length(d.xz + vec2(1e-4)));
        float fern = (0.010 + 0.07 * pow(texture(uRausch, vec2(az * 0.21 + 0.31, 0.21)).r, 1.5)) * land;
        float nahe = (0.004 + 0.04 * pow(texture(uRausch, vec2(az * 0.43 + 0.72, 0.58)).r, 1.4) + 0.006 * texture(uRausch, vec2(az * 2.9, 0.11)).a) * land;
        vec3 dunstFarbe = himmelGrund(normalize(vec3(d.x, 0.0, d.z)));
        c = mix(c, mix(dunstFarbe, uZenit * 0.5, 0.25), smoothstep(fern + 0.0025, fern - 0.0025, h) * 0.9 * step(0.001, land));
        c = mix(c, mix(dunstFarbe, uZenit * 0.3, 0.55), smoothstep(nahe + 0.002, nahe - 0.002, h) * 0.95 * step(0.001, land));
      }
      // Ein Hauch Rauschen gegen Streifen im Verlauf.
      c += (fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) / 180.0;
      aus = vec4(c, 1.0);
    }`;

  // Die Form der Welle im Programm – dieselbe wie oben (formBei, querBei).
  // F: z der Reihe, ihr Lippenwinkel, ihr Radius, ihre Gischt. Vier Stücke:
  //   0  das Vorland: flaches Wasser vor der Welle, von rechts bis ins Tal
  //   1  der Bogen innen: vom Tal die Wand hinauf bis zur Kante der Lippe
  //   2  die Lippe aussen: von der Kante zurück bis zu ihrer Wurzel
  //   3  der Rücken: von dort hinab aufs offene Meer
  // w: der Winkel auf dem Bogen, wie dick das Wasser dort ist, und wie weit
  // es vom Tal aus geflossen ist (für die Muster).
  const FORM_GLSL = `
    const float VORLAND = 34.0;
    const float RUECKEN = 80.0;
    const float WURZEL = 1.9;
    const float D_WURZEL = 1.4;
    const float D_SPITZE = 0.05;
    const float DREIVIERTEL = 4.712389;
    const float KAMM = ${KAMM.toFixed(2)};
    float mitte(float lip, float R) { return R * sin(min(lip, 1.570796)) - KAMM; }
    float quer(float p) { return p <= DREIVIERTEL ? -sin(p) : 1.0 + 0.1 * (p - DREIVIERTEL); }
    float dicke(float p, float lip, float R) {
      float wurzel = min(lip, WURZEL);
      float oben = max(lip - max(p, wurzel), 0.0);
      float unten = max(wurzel - p, 0.0);
      return 0.05 + oben * R * 0.13 + unten * R * 0.9;
    }
    vec3 ort(float k, float s, vec4 F, out vec4 w) {
      float lip = F.y;
      float R = F.z;
      float wurzel = min(lip, WURZEL);
      float hang = smoothstep(WURZEL, WURZEL + 0.7, lip);
      float mx = mitte(lip, R);
      float x, y, p, dick, lauf;
      if (k < 0.5) {
        float a = 1.0 - s;
        float vor = VORLAND * a * a;
        x = mx + vor;
        y = 0.0;
        p = 0.0;
        lauf = -vor;
        dick = dicke(0.0, lip, R) + vor * 0.5;
      } else if (k < 1.5) {
        p = lip * s;
        x = mx + R * quer(p);
        y = R * (1.0 - cos(p));
        lauf = R * p;
        dick = dicke(p, lip, R);
      } else if (k < 2.5) {
        p = mix(lip, wurzel, s);
        float Ro = R + mix(D_SPITZE, D_WURZEL, pow(s, 0.8)) * hang;
        x = mx + Ro * quer(p);
        y = R - Ro * cos(p);
        lauf = R * p;
        dick = dicke(p, lip, R);
      } else {
        float Ro = R + D_WURZEL * hang;
        float dx = RUECKEN * s * s;
        x = mx + Ro * quer(wurzel) - dx;
        y = (R - Ro * cos(wurzel)) * exp(-dx / 24.0 - dx * dx / 500.0);
        p = wurzel;
        lauf = R * wurzel + dx;
        dick = dicke(wurzel, lip, R) + dx * 0.6;
      }
      w = vec4(p, dick, lauf, 0.0);
      return vec3(x, y, F.x);
    }
  `;

  const WELLE_VS = `#version 300 es
    layout(location = 0) in vec3 aNetz;   // Stück, Stelle im Stück, Reihe
    uniform mat4 uPV;
    uniform vec4 uForm[${REIHEN}];
    uniform float uVorSchaum;             // so weit liegt die Kamera vor dem Schaum
    out vec3 vOrt;
    out vec3 vNorm;
    out vec4 vWert;                       // Winkel, Dicke, Lauf, Lippenwinkel
    out vec4 vMehr;                       // Stück, Stelle, Abstand vor dem Schaum, Radius
    out float vGischt;
    ${FORM_GLSL}
    void main() {
      float k = aNetz.x;
      float s = aNetz.y;
      int r = int(aNetz.z + 0.5);
      vec4 F = uForm[r];
      vec4 Fv = uForm[max(r - 1, 0)];
      vec4 Fn = uForm[min(r + 1, ${REIHEN - 1})];
      vec4 w, w2;
      vec3 p = ort(k, s, F, w);
      // Die Richtung der Fläche: aus zwei kleinen Schritten, einem quer und
      // einem längs.
      float e = 0.012;
      vec3 ds = ort(k, min(s + e, 1.0), F, w2) - ort(k, max(s - e, 0.0), F, w2);
      vec3 dz = ort(k, s, Fn, w2) - ort(k, s, Fv, w2);
      vec3 n = cross(ds, dz);
      float l = length(n);
      vNorm = l > 1e-9 ? n / l : vec3(0.0, 1.0, 0.0);
      vOrt = p;
      vWert = vec4(w.x, w.y, w.z, F.y);
      vMehr = vec4(k, s, F.x + uVorSchaum, F.z);
      vGischt = F.w;
      gl_Position = uPV * vec4(p, 1.0);
    }`;

  // Die Fläche der Welle. Ihre Farbe ist dreierlei: was durch das Wasser
  // scheint (dünn golden, dicker smaragdgrün, ganz dick fast schwarz), was
  // sich darauf spiegelt (der Himmel – unter dem Dach die leuchtende Röhre),
  // und der Schaum, der in Streifen die Wand hinaufzieht und an der Kante
  // der Lippe zerreisst.
  const WELLE_FS = `#version 300 es
    precision highp float;
    in vec3 vOrt;
    in vec3 vNorm;
    in vec4 vWert;
    in vec4 vMehr;
    in float vGischt;
    out vec4 aus;
    uniform vec3 uStreu, uDurch, uRoehre;
    uniform vec4 uSchatten;        // wo das Brett liegt (x, y, z vor der Kamera) und wie stark sein Schatten ist
    ${LICHT}
    ${MEER}
    void main() {
      float p = vWert.x, dick = vWert.y, lauf = vWert.z, lip = vWert.w;
      float k = vMehr.x, s = vMehr.y, u = vMehr.z, R = vMehr.w;
      vec3 hin = uAuge - vOrt;
      float weit = length(hin);
      vec3 v = hin / weit;

      // Die Muster: längs an die Welt geheftet, quer fliessen sie mit dem
      // Wasser die Wand hinauf – in Fliessrichtung lang gezogen.
      vec2 m = vec2(vOrt.z + uLauf.x, lauf - uLauf.y);
      vec4 r1 = texture(uRausch, m * vec2(0.113, 0.013) + vec2(0.0, 0.13));
      vec4 r2 = texture(uRausch, m * vec2(0.083, 0.023));
      vec4 r3 = texture(uRausch, m * vec2(0.27, 0.11) + vec2(0.5, 0.2));

      float blatt = step(0.5, k) * step(k, 2.5);
      float kante = max(lip - p, 0.0) * R;           // Meter bis zur Kante der Lippe
      float ueber = smoothstep(1.75, 2.6, lip);      // die Lippe hängt über
      float gefallen = smoothstep(3.5, 5.2, p);      // der Vorhang fällt

      // Der Vorhang reisst auf, und die Kante ist ausgefranst.
      if (blatt > 0.5) {
        float riss = r3.a * 0.5 + r1.a * 0.5;
        float schwelle = gefallen * (0.5 + 0.28 * gefallen) + (1.0 - smoothstep(0.0, 0.5, kante)) * 0.34 * ueber;
        if (riss < schwelle) discard;
      }

      // Kräuseln: Die Fläche ist nie glatt.
      vec3 n = normalize(vNorm);
      vec3 t1 = normalize(vec3(0.0, 0.0, 1.0) - n * n.z);
      vec3 t2 = cross(n, t1);
      vec2 kr = (r2.gb - 0.5) * 1.3 + (r3.gb - 0.5) * 0.9 + (r1.gb - 0.5) * vec2(1.6, 0.3);
      n = normalize(n + (t1 * kr.x + t2 * kr.y) * (0.4 / (1.0 + weit * 0.012)));
      float nv = abs(dot(n, v));
      float fres = 0.02 + 0.98 * pow(1.0 - nv, 4.0);
      vec3 r = reflect(-v, n);
      vec3 rr = normalize(vec3(r.x, abs(r.y) + 0.02, r.z));

      // Was durch das Wasser scheint: dünn golden, dicker smaragdgrün, ganz
      // dick fast nichts mehr. Das Wasser ist nicht überall gleich dick –
      // das Licht flimmert.
      vec3 durch = exp(-dick * (0.7 + 0.6 * r2.r) * vec3(2.1, 0.5, 0.95));
      // Im Blatt der Lippe ziehen Schlieren mit dem Wasser: mal dünner, mal dicker.
      durch *= mix(1.0, 0.62 + 0.76 * r1.r, blatt * ueber);
      float gegen = 0.6 + 0.4 * pow(max(dot(-v, uSonneFlach), 0.0), 2.0);
      vec3 koerper = uTief + uStreu * (0.12 + 0.4 * durch.g) + uDurch * durch * gegen;

      // Was sich spiegelt: der Himmel – unter dem Dach die Röhre selbst: oben
      // ihr leuchtendes Dach, unten dunkles Wasser, nach vorn die Öffnung.
      float dach = smoothstep(2.4, 3.6, lip) * step(k, 1.5) * (1.0 - smoothstep(R * 0.8, R * 1.25, vOrt.x - R * sin(min(lip, 1.570796)) + ${KAMM.toFixed(2)}));
      vec3 spiegel = himmelGrund(rr);
      vec3 innenwelt = mix(uTief * 1.4, uRoehre * 0.85, smoothstep(0.0, 0.9, r.y));
      float hinaus = pow(max(r.z, 0.0), 2.0) * (1.0 - 0.6 * smoothstep(0.0, 9.0, 9.0 - u));
      spiegel = mix(spiegel, innenwelt, dach * (1.0 - hinaus));

      // Dunklere Bahnen, wo das Wasser dicker die Wand hinaufzieht.
      koerper *= 1.0 - 0.3 * smoothstep(0.5, 0.8, r1.a) * (1.0 - blatt * ueber * 0.6);
      vec3 c = mix(koerper, spiegel, fres * mix(1.0, 0.55, dach));
      // Glitzern, wo die Sonne hinkommt.
      float zurSonne = max(dot(rr, uSonne), 0.0);
      c += uLicht * (pow(zurSonne, 260.0) * 9.0 + pow(zurSonne, 30.0) * 0.25) * (0.2 + 0.8 * fres) * (1.0 - dach);

      // Schaum: feine Streifen, die die Wand hinaufziehen, dazu ein Geäder
      // wie Marmor – dicht vor dem Schaum mehr –, und die weisse Kante der
      // Lippe.
      float nahSchaum = 1.0 - smoothstep(0.0, 22.0, u);
      float streifen = r1.r * 0.7 + r2.a * 0.3;
      float schwelle = mix(0.76, 0.6, nahSchaum) - 0.1 * vGischt;
      float schaum = smoothstep(schwelle, schwelle + 0.1, streifen) * (0.25 + 0.5 * max(nahSchaum, vGischt));
      float ader = (1.0 - smoothstep(0.0, 0.035, abs(r2.r * 0.6 + r3.r * 0.4 - 0.5))) * smoothstep(0.35, 0.7, r1.a);
      float ader2 = (1.0 - smoothstep(0.0, 0.05, abs(r1.a * 0.55 + r2.r * 0.45 - 0.48))) * smoothstep(0.4, 0.75, r3.r);
      // Dicht vor der Linse kein Geäder: Dort wäre es ein grober Kringel.
      schaum = max(schaum, max(ader * (0.2 + 0.55 * nahSchaum), ader2 * (0.1 + 0.3 * nahSchaum)) * smoothstep(2.0, 6.0, weit)) * step(k, 2.5);
      float rand = (1.0 - smoothstep(0.05, 0.4 + 2.8 * vGischt, kante + (r3.a - 0.5) * (0.45 + 1.6 * vGischt))) * blatt * smoothstep(0.5, 1.1, lip);
      schaum = max(schaum, rand);
      // Der Vorhang: Stränge aus fallendem Wasser.
      float strang = smoothstep(0.3, 0.8, texture(uRausch, vec2(m.x * 0.37, m.y * 0.012)).r);
      schaum = max(schaum, gefallen * blatt * max(0.1 + 0.85 * strang, smoothstep(0.55, 0.95, gefallen)));
      float nl = max(dot(n, uSonne), 0.0);
      vec3 weiss = uHimmelLicht * 0.85 + uLicht * (0.2 + 0.5 * nl) + uDurch * durch * 0.45;
      weiss = mix(weiss, uHimmelLicht * 0.3 + uRoehre * 1.1 + uDurch * durch * 0.55, dach);
      // Der fallende Vorhang steht draussen in der Abendsonne: Sie scheint
      // warm durch seine Stränge.
      weiss = mix(weiss, uHimmelLicht * 0.35 + uDurch * (0.45 + 0.75 * strang) + uLicht * 0.25, gefallen * blatt);
      // Wo der Schaum gleich anzieht, ist die Kante schneeweiss.
      weiss = mix(weiss, uHimmelLicht * 0.95 + uLicht * 0.7, vGischt * rand);
      c = mix(c, weiss, schaum * 0.9);

      // Unter dem Brett: ein weicher Schatten, länglich wie das Brett.
      vec3 zumBrett = vOrt - uSchatten.xyz;
      c *= 1.0 - uSchatten.w * exp(-dot(zumBrett.xy, zumBrett.xy) / 0.16 - zumBrett.z * zumBrett.z / 0.85) * step(0.5, k) * step(k, 1.5);

      // Vorland und Rücken gehen ins offene Meer über.
      if (k < 0.5) c = mix(meer(vOrt, v, weit), c, smoothstep(0.0, 0.5, s));
      else if (k > 2.5) c = mix(c, meer(vOrt, v, weit), smoothstep(0.45, 1.0, s));
      aus = vec4(dunst(c, vOrt), 1.0);
    }`;

  // Die Surferin: ein Netz, das in jedem Bild neu entsteht (für die Gegner
  // zwei feste Haltungen, aufrecht und geduckt, dazwischen gleiten sie).
  // uBasis stellt sie auf die Wand: quer, hoch, voraus. Jede Ecke weiss ihre
  // Farbe und ihren Stoff (Haut, Anzug, Deck, Boden, Haar, Finne, Band) –
  // dazu zwei Zahlen für sein Muster.
  const FIGUR_VS = `#version 300 es
    layout(location = 0) in vec3 aOrt0;
    layout(location = 1) in vec3 aNorm0;
    layout(location = 2) in vec3 aOrt1;
    layout(location = 3) in vec3 aNorm1;
    layout(location = 4) in vec3 aFarbe;
    layout(location = 5) in vec3 aStoff;
    uniform mat4 uPV;
    uniform mat3 uBasis;
    uniform vec3 uOrt;
    uniform float uPose;
    out vec3 vOrt;
    out vec3 vNorm;
    out vec3 vFarbe;
    out vec3 vStoff;
    void main() {
      vec3 p = mix(aOrt0, aOrt1, uPose);
      vec3 n = mix(aNorm0, aNorm1, uPose);
      vec3 w = uBasis * p + uOrt;
      vOrt = w;
      vNorm = uBasis * n;
      vFarbe = aFarbe;
      vStoff = aStoff;
      gl_Position = uPV * vec4(w, 1.0);
    }`;
  const FIGUR_FS = `#version 300 es
    precision highp float;
    in vec3 vOrt;
    in vec3 vNorm;
    in vec3 vFarbe;
    in vec3 vStoff;
    out vec4 aus;
    uniform vec4 uGeist;           // Farbe und Deckkraft eines Gegners (0: die Surferin selbst)
    uniform vec3 uRoehre;
    uniform float uDach;
    ${LICHT}
    const vec3 KORALLE = vec3(0.98, 0.42, 0.32);
    const vec3 TUERKIS = vec3(0.03, 0.6, 0.64);
    const vec3 DECK = vec3(0.94, 0.91, 0.85);
    const vec3 HOLZ = vec3(0.42, 0.26, 0.13);
    void main() {
      vec3 n = normalize(vNorm);
      vec3 v = normalize(uAuge - vOrt);
      float nv = abs(dot(n, v));
      float rand = pow(1.0 - nv, 2.6);
      if (uGeist.a > 0.0) {
        float a = uGeist.a * (0.22 + 0.78 * rand);
        aus = vec4(uGeist.rgb * a, a);
        return;
      }
      float art = floor(vStoff.x + 0.5);
      vec3 farbe = vFarbe;
      float glanz = 0.12;          // wie stark die Sonne darauf glänzt
      float haerte = 16.0;         // und wie eng
      float weich = 0.3;           // wie weit das Licht um die Kante greift
      if (art == 1.0) {
        // Neopren: matt mit einem weichen Schimmer, an der Seite ein Streifen.
        glanz = 0.2; haerte = 18.0; weich = 0.15;
        farbe = mix(farbe, KORALLE, smoothstep(0.935, 0.965, vStoff.y) * vStoff.z);
      } else if (art == 2.0 || art == 3.0) {
        float u = vStoff.y;
        float s = vStoff.z;
        if (art == 2.0) {
          // Das Deck: hell, die Kanten türkis, ein Streifen Holz in der
          // Mitte, vorn zwei Zierstreifen – und hinten das gerillte Pad.
          farbe = mix(DECK, TUERKIS, smoothstep(0.82, 0.9, abs(u)));
          float zier = max(1.0 - smoothstep(0.006, 0.01, abs(s - 0.8)), 1.0 - smoothstep(0.002, 0.005, abs(s - 0.825)));
          farbe = mix(farbe, KORALLE, zier);
          farbe = mix(farbe, HOLZ, 1.0 - smoothstep(0.014, 0.024, abs(u)));
          float pad = (1.0 - smoothstep(0.2, 0.21, s)) * smoothstep(0.012, 0.02, s) * (1.0 - smoothstep(0.7, 0.75, abs(u)));
          float rille = smoothstep(0.2, 0.8, sin(s * 280.0)) * 0.5;
          farbe = mix(farbe, vec3(0.06, 0.065, 0.075) * (1.0 + rille), pad);
          glanz = mix(0.6, 0.04, pad);
          haerte = mix(90.0, 8.0, pad);
        } else {
          // Der Boden: türkis, mit dem Streifen Holz.
          farbe = mix(TUERKIS * 0.85, HOLZ, 1.0 - smoothstep(0.014, 0.024, abs(u)));
          glanz = 0.45; haerte = 60.0;
        }
        weich = 0.1;
      } else if (art == 4.0) {
        // Haar: Strähnen, von der Sonne aufgehellt.
        float w = atan(vStoff.z, vStoff.y);
        float straehne = 0.5 + 0.5 * sin(w * 23.0 + sin(w * 7.0) * 1.5) * sin(w * 41.0 + 1.3);
        farbe *= 0.78 + 0.42 * straehne;
        glanz = 0.32; haerte = 26.0; weich = 0.35;
      } else if (art == 5.0) {
        glanz = 0.5; haerte = 70.0; weich = 0.05;
      } else if (art == 0.0) {
        // Nasse Haut.
        glanz = 0.16; haerte = 22.0; weich = 0.4;
      }
      float oben = n.y * 0.5 + 0.5;
      // Draussen leuchtet der Himmel, in der Röhre das Wasser ringsum.
      vec3 umgebung = mix(uHimmelLicht, uRoehre * 1.4 + uHimmelLicht * 0.25, uDach);
      float nl = dot(n, uSonne);
      float sonne = max((nl + weich) / (1.0 + weich), 0.0) * (1.0 - 0.55 * uDach);
      vec3 c = farbe * (umgebung * mix(0.36, 1.0, oben) + uLicht * sonne * 0.95);
      // Der Glanz der Sonne – und was glänzt, spiegelt auch den Himmel.
      vec3 hv = normalize(uSonne + v);
      c += uLicht * pow(max(dot(n, hv), 0.0), haerte) * glanz * (haerte + 2.0) / 10.0 * step(0.0, nl) * (1.0 - 0.6 * uDach);
      vec3 r = reflect(-v, n);
      vec3 spiegel = mix(himmelGrund(normalize(vec3(r.x, abs(r.y) + 0.02, r.z))), umgebung, uDach);
      c += spiegel * pow(1.0 - nv, 3.0) * glanz * 0.7;
      // Gegenlicht: An den Rändern glüht der Abend.
      c += (uGlut * 0.5 + uLicht * 0.35) * rand * (0.4 + 0.6 * oben) * (art == 2.0 || art == 3.0 ? 0.55 : 1.0);
      aus = vec4(dunst(c, vOrt), 1.0);
    }`;

  // Gischt, Sprühnebel, Spritzer: weiche Scheiben, die zur Kamera schauen –
  // im Gegenlicht hell, mit einem Hauch Rauschen, damit es keine Kugeln sind.
  const TEIL_VS = `#version 300 es
    layout(location = 0) in vec2 aEcke;
    layout(location = 1) in vec4 iA;      // x, y, z, Grösse
    layout(location = 2) in vec4 iB;      // Helligkeit, Alter (0 bis 1), Saat, –
    uniform mat4 uProj, uSicht;
    out vec2 vEcke;
    out vec3 vOrt;
    out vec4 vWie;
    void main() {
      vec4 p = uSicht * vec4(iA.xyz, 1.0);
      p.xy += aEcke * iA.w;
      vEcke = aEcke;
      vOrt = iA.xyz;
      // Dicht vor der Linse verblasst ein Teilchen – sonst wäre es ein Fleck im Bild.
      vWie = vec4(iB.xyz, smoothstep(0.8, 3.6, -p.z));
      gl_Position = uProj * p;
    }`;
  const TEIL_FS = `#version 300 es
    precision highp float;
    in vec2 vEcke;
    in vec3 vOrt;
    in vec4 vWie;
    out vec4 aus;
    uniform sampler2D uRausch;
    ${LICHT}
    void main() {
      float r = length(vEcke);
      if (r >= 1.0) discard;
      float flocke = texture(uRausch, vEcke * 0.3 + vWie.z * vec2(7.3, 3.1)).a;
      float a = pow(1.0 - r, 1.3) * smoothstep(0.15, 0.85, flocke) * 1.25;
      a *= vWie.x * vWie.w * smoothstep(0.0, 0.12, vWie.y) * (1.0 - vWie.y);
      vec3 hin = normalize(vOrt - uAuge);
      // Im Gegenlicht leuchtet Gischt heller als der Himmel dahinter.
      float gegen = pow(max(dot(hin, uSonne), 0.0), 5.0);
      vec3 c = uHimmelLicht * 0.9 + uLicht * (0.45 + 1.2 * gegen);
      a = clamp(a, 0.0, 1.0);
      aus = vec4(dunst(c, vOrt) * a, a);
    }`;

  // Die Spur des Bretts: ein Band aus Schaum auf der Wand.
  const SPUR_VS = `#version 300 es
    layout(location = 0) in vec3 aOrt;
    layout(location = 1) in vec2 aWie;    // quer (-1 bis 1), Alter (0 bis 1)
    uniform mat4 uPV;
    out vec3 vOrt;
    out vec2 vWie;
    void main() {
      vOrt = aOrt;
      vWie = aWie;
      gl_Position = uPV * vec4(aOrt, 1.0);
    }`;
  const SPUR_FS = `#version 300 es
    precision highp float;
    in vec3 vOrt;
    in vec2 vWie;
    out vec4 aus;
    uniform sampler2D uRausch;
    uniform vec2 uLauf;
    uniform vec3 uRoehre;
    uniform float uDach;
    ${LICHT}
    void main() {
      // Ein schmaler Strich Schaum, der breiter wird und zerfällt.
      float flocke = texture(uRausch, vec2((vOrt.z + uLauf.x) * 0.9, vWie.x * 0.3 + 0.2)).r;
      float a = (1.0 - smoothstep(0.1, 1.0, abs(vWie.x))) * (1.0 - smoothstep(0.1, 0.85, vWie.y)) * smoothstep(0.0, 0.03, vWie.y);
      a *= smoothstep(0.28 + 0.4 * vWie.y, 0.5 + 0.4 * vWie.y, flocke);
      vec3 c = mix(uHimmelLicht * 0.9 + uLicht * 0.5, uHimmelLicht * 0.45 + uRoehre * 0.9, uDach);
      a = clamp(a, 0.0, 1.0);
      aus = vec4(dunst(c, vOrt) * a, a);
    }`;

  // Der Schleier vor der Sonne: eine Scheibe aus Licht, die sich über alles
  // legt, was davor steht.
  const SCHEIN_VS = `#version 300 es
    layout(location = 0) in vec2 aEcke;
    uniform mat4 uProj, uSicht;
    uniform vec4 uWo;              // x, y, z, Grösse
    out vec2 vEcke;
    void main() {
      vec4 p = uSicht * vec4(uWo.xyz, 1.0);
      p.xy += aEcke * uWo.w;
      vEcke = aEcke;
      gl_Position = uProj * p;
    }`;
  const SCHEIN_FS = `#version 300 es
    precision highp float;
    in vec2 vEcke;
    out vec4 aus;
    uniform vec4 uFarbe;           // Farbe, wie hart der Rand ist
    void main() {
      float a = pow(max(1.0 - length(vEcke), 0.0), uFarbe.a);
      aus = vec4(uFarbe.rgb * a, 1.0);
    }`;

  function programm(name, vs, fs) {
    const baue = (art, quelle) => {
      const s = gl.createShader(art);
      gl.shaderSource(s, quelle);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(`Welle, Programm «${name}»: ${gl.getShaderInfoLog(s)}`);
      return s;
    };
    const p = gl.createProgram();
    gl.attachShader(p, baue(gl.VERTEX_SHADER, vs));
    gl.attachShader(p, baue(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(`Welle, Programm «${name}»: ${gl.getProgramInfoLog(p)}`);
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
  // Wo die Reihen des Netzes liegen (z vor der Kamera).
  const reiheZ = new Float32Array(REIHEN);
  {
    let z = REIHE_Z0;
    let schritt = REIHE_SCHRITT;
    for (let i = 0; i < REIHEN; i += 1) {
      reiheZ[i] = z;
      if (i >= REIHEN_NAH) schritt *= REIHE_WACHS;
      z += schritt;
    }
  }
  const formDaten = new Float32Array(REIHEN * 4);

  // Das Netz der Welle: je Ecke nur, zu welchem Stück sie gehört, wo darin,
  // und in welcher Reihe – der Rest entsteht im Programm.
  function wellenNetz() {
    const ecken = [];
    const breite = STUECKE.reduce((summe, n) => summe + n + 1, 0);
    for (let r = 0; r < REIHEN; r += 1) {
      STUECKE.forEach((n, k) => {
        for (let i = 0; i <= n; i += 1) ecken.push(k, i / n, r);
      });
    }
    const index = [];
    for (let r = 0; r < REIHEN - 1; r += 1) {
      let spalte = 0;
      for (const n of STUECKE) {
        for (let i = 0; i < n; i += 1) {
          const a = r * breite + spalte + i;
          const b = a + 1;
          const c = a + breite;
          const d = c + 1;
          index.push(a, b, d, a, d, c);
        }
        spalte += n + 1;
      }
    }
    return { ecken: new Float32Array(ecken), index: new Uint16Array(index) };
  }

  // ---------------------------------------------------------------------------
  // Die Surferin
  // ---------------------------------------------------------------------------
  /*
   * Ein Mensch auf einem Shortboard, gebaut aus glatten Flächen: der Rumpf
   * Ring um Ring vom Becken bis zum Hals, Arme und Beine als Röhren, die sich
   * an Knie und Ellbogen rund biegen, Hände, Füsse, ein Kopf mit Haar und
   * einem Pferdeschwanz, der im Fahrtwind flattert. Sie trägt einen
   * Neoprenanzug mit langen Ärmeln und kurzen Beinen, an den Seiten ein
   * Streifen in Koralle. Das Brett: 1,86 m, mit Rocker, runden Kanten,
   * türkisem Boden, drei Finnen, einem Pad am Heck und einer Leash zum
   * hinteren Knöchel.
   *
   * Gerechnet wird in ihrem eigenen Raum: x zur Wand hin (dorthin schaut
   * sie, frontside), y hinauf, z nach vorn zur Nase des Bretts. Ihr Netz
   * entsteht in jedem Bild neu aus ihrer Haltung (haltungBei) – die Zahl der
   * Ecken, die Dreiecke, Farben und Stoffe bleiben dabei immer dieselben.
   */
  const vPlus = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
  const vMinus = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const vMal = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
  const vMisch = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
  const vKreuz = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const vPunkt = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const vLang = (a) => Math.hypot(a[0], a[1], a[2]);
  const vNorm = (a) => { const l = vLang(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };

  // Die Stoffe – das Programm der Figur gibt jedem sein Licht und sein Muster.
  const STOFF = { haut: 0, anzug: 1, deck: 2, boden: 3, haar: 4, finne: 5, band: 6 };
  const HAUT = [0.6, 0.37, 0.26];
  const ANZUG = [0.034, 0.038, 0.048];
  const SCHULTER = [0.02, 0.36, 0.4];
  const HAAR = [0.46, 0.3, 0.15];
  const HAAR_SPITZE = [0.78, 0.6, 0.38];
  const FINNE = [0.07, 0.08, 0.09];
  const KORALLE = [0.98, 0.42, 0.32];

  // Ein Netz aus glatten Flächen, das in jedem Bild neu entstehen kann. Jede
  // Fläche ist ein Gitter aus Zeilen und Spalten. Beim ersten Bauen wird der
  // Plan festgehalten (Dreiecke, Farben, Stoffe, wohin jede Fläche schaut);
  // danach schreibt jedes Bauen nur Orte und Richtungen neu, in derselben
  // Reihenfolge. Die Richtung einer Ecke kommt aus ihren Nachbarn.
  const FIGUR_MAX = 5000;
  function netzSchreiber() {
    const plan = { fertig: false, index: [], wie: [], seite: [] };
    const orte = new Float32Array(FIGUR_MAX * 3);
    const spitz = new Uint8Array(FIGUR_MAX);
    let n = 0;
    let nr = 0;
    let aus = null;
    return {
      plan,
      anfang(ziel) { n = 0; nr = 0; aus = ziel; },
      ende() { plan.fertig = true; return n; },
      // ort(i, j): wo die Ecke liegt. wie(i, j): [r, g, b, Stoff, u, v] –
      // nur beim ersten Bauen gefragt. rund: die Spalten schliessen sich.
      gitter(zeilen, spalten, ort, wie, rund = true) {
        const start = n;
        for (let i = 0; i < zeilen; i += 1) {
          for (let j = 0; j < spalten; j += 1) {
            const p = ort(i, j);
            orte[n * 3] = p[0]; orte[n * 3 + 1] = p[1]; orte[n * 3 + 2] = p[2];
            n += 1;
          }
        }
        const k = (i, j) => start + i * spalten + (rund ? (j + spalten) % spalten : clamp(j, 0, spalten - 1));
        if (!plan.fertig) {
          for (let i = 0; i < zeilen; i += 1) for (let j = 0; j < spalten; j += 1) plan.wie.push(...wie(i, j));
          for (let i = 0; i < zeilen - 1; i += 1) {
            for (let j = 0; j < (rund ? spalten : spalten - 1); j += 1) {
              plan.index.push(k(i, j), k(i, j + 1), k(i + 1, j + 1), k(i, j), k(i + 1, j + 1), k(i + 1, j));
            }
          }
        }
        let mx = 0, my = 0, mz = 0;
        for (let q = start; q < n; q += 1) { mx += orte[q * 3]; my += orte[q * 3 + 1]; mz += orte[q * 3 + 2]; }
        mx /= n - start; my /= n - start; mz /= n - start;
        let summe = 0;
        for (let i = 0; i < zeilen; i += 1) {
          for (let j = 0; j < spalten; j += 1) {
            const q = k(i, j);
            const a = k(Math.min(i + 1, zeilen - 1), j) * 3, c = k(Math.max(i - 1, 0), j) * 3;
            const e = k(i, j + 1) * 3, f = k(i, j - 1) * 3;
            const ix = orte[a] - orte[c], iy = orte[a + 1] - orte[c + 1], iz = orte[a + 2] - orte[c + 2];
            const jx = orte[e] - orte[f], jy = orte[e + 1] - orte[f + 1], jz = orte[e + 2] - orte[f + 2];
            let nx = jy * iz - jz * iy, ny = jz * ix - jx * iz, nz = jx * iy - jy * ix;
            spitz[q] = 0;
            if (Math.hypot(nx, ny, nz) < 1e-12) {
              // Eine Spitze (alle Ecken der Zeile an einem Ort): Sie schaut
              // von der Mitte der Nachbarzeile weg.
              const z = i === 0 ? 1 : i === zeilen - 1 ? zeilen - 2 : i - 1;
              let sx = 0, sy = 0, sz = 0;
              for (let jj = 0; jj < spalten; jj += 1) { const r = k(z, jj) * 3; sx += orte[r]; sy += orte[r + 1]; sz += orte[r + 2]; }
              nx = orte[q * 3] - sx / spalten; ny = orte[q * 3 + 1] - sy / spalten; nz = orte[q * 3 + 2] - sz / spalten;
              spitz[q] = 1;
            } else {
              summe += nx * (orte[q * 3] - mx) + ny * (orte[q * 3 + 1] - my) + nz * (orte[q * 3 + 2] - mz);
            }
            aus[q * 6 + 3] = nx; aus[q * 6 + 4] = ny; aus[q * 6 + 5] = nz;
          }
        }
        if (plan.seite.length <= nr) plan.seite.push(summe >= 0 ? 1 : -1);
        const seite = plan.seite[nr];
        for (let q = start; q < n; q += 1) {
          const s = (spitz[q] ? 1 : seite) / (Math.hypot(aus[q * 6 + 3], aus[q * 6 + 4], aus[q * 6 + 5]) || 1);
          aus[q * 6] = orte[q * 3]; aus[q * 6 + 1] = orte[q * 3 + 1]; aus[q * 6 + 2] = orte[q * 3 + 2];
          aus[q * 6 + 3] *= s; aus[q * 6 + 4] *= s; aus[q * 6 + 5] *= s;
        }
        nr += 1;
      },
    };
  }

  /*
   * Eine Röhre längs der Punkte mitte, mit den Halbachsen r[k] ([quer,
   * tief] oder eine Zahl) und runden Kappen an beiden Enden. hinweis: wohin
   * «quer» am Anfang ungefähr zeigt – der Rahmen wird die Linie entlang
   * mitgeführt, damit sich nichts verdreht. wie(t, w): t längs (0 bis 1), w
   * der Winkel rundum (0: quer).
   */
  function roehre(b, mitte, r, hinweis, spalten, wie, kappen = 3) {
    const m = mitte.length;
    const achse = [];
    const quer = [];
    const tief = [];
    for (let k = 0; k < m; k += 1) {
      const a = vNorm(vMinus(mitte[Math.min(k + 1, m - 1)], mitte[Math.max(k - 1, 0)]));
      const vor = k ? quer[k - 1] : hinweis;
      let q = vMinus(vor, vMal(a, vPunkt(vor, a)));
      if (vLang(q) < 1e-6) q = vKreuz(a, Math.abs(a[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0]);
      q = vNorm(q);
      achse.push(a);
      quer.push(q);
      tief.push(vKreuz(a, q));
    }
    const halb = (k) => (Array.isArray(r[k]) ? r[k] : [r[k], r[k]]);
    const zeilen = m + 2 * kappen;
    const lage = (i) => {
      if (i < kappen) return { k: 0, s: Math.sin((i / kappen) * Math.PI / 2), v: -Math.cos((i / kappen) * Math.PI / 2), t: 0 };
      if (i >= kappen + m) {
        const phi = ((zeilen - 1 - i) / kappen) * Math.PI / 2;
        return { k: m - 1, s: Math.sin(phi), v: Math.cos(phi), t: 1 };
      }
      return { k: i - kappen, s: 1, v: 0, t: m > 1 ? (i - kappen) / (m - 1) : 0 };
    };
    b.gitter(zeilen, spalten, (i, j) => {
      const w = (j / spalten) * Math.PI * 2;
      const { k, s, v } = lage(i);
      const [rq, rt] = halb(k);
      const c = vPlus(mitte[k], vMal(achse[k], v * Math.min(rq, rt) * 0.9));
      return vPlus(c, vPlus(vMal(quer[k], Math.cos(w) * rq * s), vMal(tief[k], Math.sin(w) * rt * s)));
    }, (i, j) => wie(lage(i).t, (j / spalten) * Math.PI * 2));
  }

  // Punkte längs zweier Glieder (a–b–c), an den Anteilen anteile der ganzen
  // Länge – das Gelenk bei b rund gebogen.
  function gelenkLinie(a, b, c, anteile, rund = 0.06) {
    const l1 = vLang(vMinus(b, a));
    const l2 = vLang(vMinus(c, b));
    const r = Math.min(rund, l1 * 0.45, l2 * 0.45);
    const p1 = vMisch(a, b, (l1 - r) / l1);
    const p2 = vMisch(b, c, r / l2);
    return anteile.map((f) => {
      const s = f * (l1 + l2);
      if (s <= l1 - r) return vMisch(a, b, s / l1);
      if (s >= l1 + r) return vMisch(b, c, (s - l1) / l2);
      const u = (s - (l1 - r)) / (2 * r);
      return vPlus(vPlus(vMal(p1, (1 - u) * (1 - u)), vMal(b, 2 * u * (1 - u))), vMal(p2, u * u));
    });
  }

  // Zwei Glieder der Längen l1 und l2 von a nach z: wo das Gelenk liegt.
  // pol: wohin es zeigt (das Knie nach vorn, der Ellbogen nach unten).
  function gelenk(a, z, l1, l2, pol) {
    const hin = vMinus(z, a);
    const d = clamp(vLang(hin), Math.abs(l1 - l2) + 1e-3, l1 + l2 - 1e-3);
    const dir = vNorm(hin);
    const x = (l1 * l1 - l2 * l2 + d * d) / (2 * d);
    const h = Math.sqrt(Math.max(0, l1 * l1 - x * x));
    let p = vMinus(pol, vMal(dir, vPunkt(pol, dir)));
    p = vLang(p) < 1e-6 ? vKreuz(dir, [0, 0, 1]) : vNorm(p);
    return vPlus(vPlus(a, vMal(dir, x)), vMal(p, h));
  }

  // Das Brett: Umriss (halbe Breite), Dicke und Rocker längs (0 Heck, 1 Nase).
  const BRETT_LANG = 1.86;
  const BRETT_UMRISS = [[0, 0.135], [0.02, 0.15], [0.1, 0.18], [0.25, 0.222], [0.45, 0.245], [0.6, 0.24], [0.75, 0.212], [0.86, 0.165], [0.94, 0.098], [0.98, 0.045], [1, 0]];
  const BRETT_DICKE = [[0, 0.02], [0.15, 0.038], [0.4, 0.058], [0.55, 0.058], [0.8, 0.04], [1, 0.016]];
  const BRETT_ROCKER = [[0, 0.04], [0.15, 0.012], [0.35, 0], [0.6, 0.004], [0.8, 0.034], [0.92, 0.072], [1, 0.11]];
  const BRETT_UNTEN = 0.025;       // so hoch liegt sein Boden über dem Wasser
  const BRETT_STATIONEN = [0, 0.03, 0.07, 0.12, 0.18, 0.25, 0.33, 0.41, 0.5, 0.58, 0.66, 0.73, 0.8, 0.86, 0.91, 0.95, 0.975, 0.99, 1];
  const brettBei = (s) => ({ w: Math.max(0, kurve(BRETT_UMRISS, s)), t: kurve(BRETT_DICKE, s), y: BRETT_UNTEN + kurve(BRETT_ROCKER, s) });
  // Wie hoch das Deck an der Stelle z steht (in der Mitte).
  const deckBei = (z) => { const q = brettBei(clamp(z / BRETT_LANG + 0.5, 0, 1)); return q.y + q.t * 1.12; };
  const hochUndTief = (c, e) => Math.sign(c) * Math.pow(Math.abs(c), e);

  /*
   * Ihre Haltung. Zwei Stellungen, zwischen denen sie gleitet – locker
   * stehend (draussen auf der Schulter) und tief geduckt (in der Röhre) –,
   * und was dazukommt:
   *
   *   duck    0 bis 1: wie tief sie geduckt ist
   *   druck   -1 bis 1: in die Knie (Pumpen, hinauf) oder gestreckt (hinunter)
   *   lehn    wie weit sie sich zur Wand lehnt (Bogenmass) – in die Kurve
   *   roll    wie weit sich der Körper gegenüber dem Brett aufrichtet
   *   wand    0 bis 1: die hintere Hand streift die Wand
   *   arm     -1 bis 1: die Arme halten das Gleichgewicht
   *   haar    die Richtungen der Glieder des Pferdeschwanzes
   */
  const STELLUNG = [
    { becken: [-0.03, 0.87, -0.02], hals: [0.17, 1.33, 0.03], dreh: [0.28, 0.5], handV: [0.34, 0.98, 0.58], handH: [0.16, 0.92, -0.58] },
    { becken: [-0.09, 0.58, -0.04], hals: [0.27, 0.97, 0.05], dreh: [0.16, 0.36], handV: [0.5, 0.74, 0.62], handH: [0.44, 0.6, -0.5] },
  ];
  const HAAR_N = 6;
  const HAAR_GLIED = 0.055;
  const KNOECHEL_H = [0.0, 0, -0.37];
  const KNOECHEL_V = [0.03, 0, 0.3];
  const FUSS_H = vNorm([0.94, 0, 0.3]);
  const FUSS_V = vNorm([0.8, 0, 0.6]);
  const OBERSCHENKEL = 0.44;
  const SCHIENBEIN = 0.42;
  const OBERARM = 0.29;
  const UNTERARM = 0.26;

  function haltungNeu() {
    const haar = [];
    for (let i = 0; i < HAAR_N; i += 1) haar.push(vNorm([-0.25, -0.75 + i * 0.05, -0.6]));
    return { duck: 0.3, druck: 0, lehn: 0, roll: 0, wand: 0, arm: 0, zeit: 0, haar };
  }

  function haltungBei(p) {
    const k = clamp(p.duck, 0, 1);
    const A = STELLUNG[0];
    const B = STELLUNG[1];
    const L = (a, b) => vMisch(a, b, k);
    let becken = L(A.becken, B.becken);
    let hals = L(A.hals, B.hals);
    // Pumpen: in die Knie und wieder hinaus.
    becken = vPlus(becken, [-0.02 * p.druck, -0.085 * p.druck, 0]);
    hals = vPlus(hals, [0.04 * p.druck, -0.075 * p.druck, 0]);
    // Atmen, ausbalancieren: ganz wenig, immer.
    const wipp = Math.sin(p.zeit * 2.3) * 0.008;
    becken[1] += wipp;
    hals[1] += wipp * 1.4;
    let handV = L(A.handV, B.handV);
    let handH = L(A.handH, B.handH);
    handV = vPlus(handV, [0.03 * p.arm, 0.1 * p.arm + Math.sin(p.zeit * 1.7) * 0.02, -0.02 * p.arm]);
    handH = vPlus(handH, [-0.02 * p.arm, -0.08 * p.arm + Math.sin(p.zeit * 1.3 + 1) * 0.02, -0.04 * Math.abs(p.arm)]);
    // Die hintere Hand an der Wand: tief zur Seite, die Finger im Wasser.
    handH = vMisch(handH, [0.62, 0.16, -0.42], p.wand);
    const dreh = [lerp(A.dreh[0], B.dreh[0], k), lerp(A.dreh[1], B.dreh[1], k)];

    // Der Körper richtet sich auf und lehnt in die Kurve – um eine Achse
    // längs des Bretts, durch die Füsse.
    const w = p.roll + p.lehn;
    const cw = Math.cos(w);
    const sw = Math.sin(w);
    const deckH = deckBei(KNOECHEL_H[2]);
    const deckV = deckBei(KNOECHEL_V[2]);
    const drehe = (q) => {
      const x = q[0] - 0.015;
      const y = q[1] - (deckH + deckV) / 2;
      return [0.015 + x * cw + y * sw, (deckH + deckV) / 2 - x * sw + y * cw, q[2]];
    };
    const drehR = (q) => [q[0] * cw + q[1] * sw, -q[0] * sw + q[1] * cw, q[2]];
    becken = drehe(becken);
    hals = drehe(hals);
    handV = drehe(handV);
    handH = drehe(handH);

    // Becken und Schultern: offen zur Nase hin.
    const breiteB = drehR([-Math.sin(dreh[0]), 0, Math.cos(dreh[0])]);
    const breiteS = drehR([-Math.sin(dreh[1]), 0, Math.cos(dreh[1])]);
    // Die Wirbelsäule: unten folgt sie dem Becken (aufrechter), oben der Brust.
    const hoch = vNorm(vMinus(hals, becken));
    const beckenHoch = vNorm(vMisch(hoch, drehR([0, 1, 0]), 0.45));
    const schritt = vMinus(becken, vMal(beckenHoch, 0.1));
    const steuer = vPlus(becken, vMal(beckenHoch, 0.26));
    const ruecken = (t) => vPlus(vPlus(vMal(schritt, (1 - t) * (1 - t)), vMal(steuer, 2 * t * (1 - t))), vMal(hals, t * t));
    const schulter = ruecken(0.9);
    const schulterH = vMinus(schulter, vMal(breiteS, 0.168));
    const schulterV = vPlus(schulter, vMal(breiteS, 0.168));
    const huefte = ruecken(0.15);
    const hueftH = vMinus(huefte, vMal(breiteB, 0.088));
    const hueftV = vPlus(huefte, vMal(breiteB, 0.088));

    // Die Beine: die Füsse fest auf dem Deck, die Knie nach vorn.
    const knoechelH = [KNOECHEL_H[0], deckH + 0.085, KNOECHEL_H[2]];
    const knoechelV = [KNOECHEL_V[0], deckV + 0.085, KNOECHEL_V[2]];
    const knieH = gelenk(hueftH, knoechelH, OBERSCHENKEL, SCHIENBEIN, [1, 0.1, 0.55]);
    const knieV = gelenk(hueftV, knoechelV, OBERSCHENKEL, SCHIENBEIN, [1, 0.1, -0.12]);
    // Die Arme: die Ellbogen nach unten und ein wenig nach aussen.
    const zuHand = (s, h) => { const d = vMinus(h, s); const l = vLang(d); return l > OBERARM + UNTERARM - 0.01 ? vPlus(s, vMal(d, (OBERARM + UNTERARM - 0.01) / l)) : h; };
    handV = zuHand(schulterV, handV);
    handH = zuHand(schulterH, handH);
    const ellV = gelenk(schulterV, handV, OBERARM, UNTERARM, vPlus([0.1, -1, 0.2], vMal(breiteS, 0.4)));
    const ellH = gelenk(schulterH, handH, OBERARM, UNTERARM, vPlus([-0.1, -1, -0.1], vMal(breiteS, -0.5)));

    // Der Kopf: über dem Hals, der Blick die Welle entlang, ein wenig zur Wand.
    const nacken = vNorm(vMisch(hoch, [0, 1, 0], 0.55));
    const kopf = vPlus(hals, vMal(nacken, 0.15));
    const blick = vNorm([0.45, -0.12, 1]);
    const kopfVor = vNorm(vMinus(blick, vMal(nacken, vPunkt(blick, nacken))));
    const kopfSeite = vKreuz(nacken, kopfVor);

    // Der Pferdeschwanz: hinten oben am Kopf, Glied um Glied.
    const wurzel = vPlus(vPlus(kopf, vMal(nacken, 0.055)), vMal(kopfVor, -0.085));
    const haar = [wurzel];
    for (let i = 0; i < HAAR_N; i += 1) haar.push(vPlus(haar[i], vMal(p.haar[i], HAAR_GLIED)));

    return {
      becken, hals, ruecken, breiteB, breiteS, schulterH, schulterV, hueftH, hueftV, knieH, knieV, knoechelH, knoechelV,
      ellH, ellV, handH, handV, kopf, nacken, kopfVor, kopfSeite, haar,
    };
  }

  // Der Rumpf: halbe Breite, Tiefe nach vorn und nach hinten – vom Schritt
  // (0) bis zum Hals (1). Breit in den Hüften, schmal in der Taille.
  const RUMPF = [
    [0.0, 0.07, 0.05, 0.05], [0.06, 0.13, 0.08, 0.095], [0.14, 0.158, 0.085, 0.11], [0.24, 0.156, 0.082, 0.1],
    [0.34, 0.138, 0.078, 0.082], [0.44, 0.12, 0.075, 0.07], [0.54, 0.128, 0.082, 0.072], [0.64, 0.143, 0.1, 0.077],
    [0.72, 0.15, 0.106, 0.079], [0.8, 0.158, 0.088, 0.081], [0.87, 0.175, 0.074, 0.08], [0.93, 0.148, 0.06, 0.068],
    [0.97, 0.095, 0.05, 0.055], [1.0, 0.055, 0.045, 0.045],
  ];

  // Das Netz aus der Haltung j, geschrieben mit dem Schreiber b.
  function surferinBauen(b, j) {
    const ring = 18;
    // Der Rumpf, im Anzug, an beiden Seiten ein Streifen.
    b.gitter(RUMPF.length + 1, ring, (i, s) => {
      const z = Math.max(0, i - 1);
      const [t, hw, hv, hh] = RUMPF[z];
      const mitte = j.ruecken(i ? t : -0.03);
      const hoch = vNorm(vMinus(j.ruecken(Math.min(1, t + 0.03)), j.ruecken(Math.max(0, t - 0.03))));
      let q = vNorm(vMisch(j.breiteB, j.breiteS, weich(0.25, 0.85, t)));
      q = vNorm(vMinus(q, vMal(hoch, vPunkt(q, hoch))));
      const vorn = vKreuz(hoch, q);
      if (!i) return mitte;
      const w = (s / ring) * Math.PI * 2;
      const c = Math.cos(w);
      const sn = Math.sin(w);
      return vPlus(mitte, vPlus(vMal(q, hochUndTief(c, 0.8) * hw), vMal(vorn, hochUndTief(sn, 0.85) * (sn > 0 ? hv : hh))));
    }, (i, s) => [...(RUMPF[Math.max(0, i - 1)][0] >= 0.8 && Math.sin((s / ring) * Math.PI * 2) < 0.3 ? SCHULTER : ANZUG), STOFF.anzug, Math.abs(Math.cos((s / ring) * Math.PI * 2)), 1]);

    // Der Hals.
    roehre(b, [vMinus(j.hals, vMal(j.nacken, 0.04)), vPlus(j.hals, vMal(j.nacken, 0.07))], [0.043, 0.04], j.kopfSeite, 10,
      (t) => (t < 0.3 ? [...ANZUG, STOFF.anzug, 0, 0] : [...HAUT, STOFF.haut, 0, 0]), 1);

    // Der Kopf: ein wenig länger als breit, hinten voller.
    const kopfPunkt = (breit, hoch, vor, hinten, lat, w) => {
      const c = Math.cos(lat);
      const vz = Math.sin(w);
      return vPlus(j.kopf, vPlus(vPlus(vMal(j.kopfSeite, Math.cos(w) * c * breit), vMal(j.kopfVor, vz * c * (vz > 0 ? vor : hinten))), vMal(j.nacken, Math.sin(lat) * hoch)));
    };
    b.gitter(12, 14, (i, s) => kopfPunkt(0.074, 0.105, 0.092, 0.098, -Math.PI / 2 + (Math.PI * i) / 11, (s / 14) * Math.PI * 2),
      () => [...HAUT, STOFF.haut, 0, 0]);
    // Das Haar: eine Kappe, hinten bis in den Nacken, vorn bis zur Stirn.
    b.gitter(8, 16, (i, s) => {
      const w = (s / 16) * Math.PI * 2;
      const vorn = (1 + Math.sin(w)) / 2;
      const ende = -0.5 + 1.0 * Math.pow(vorn, 1.6);
      const lat = Math.PI / 2 - (Math.PI / 2 - ende) * (i / 7);
      const voll = lerp(1.09, 1.015, Math.pow(i / 7, 2));
      return kopfPunkt(0.074 * voll, 0.105 * voll, 0.092 * voll, 0.098 * voll * 1.03, lat, w);
    }, (i, s) => [...HAAR, STOFF.haar, Math.cos((s / 16) * Math.PI * 2), Math.sin((s / 16) * Math.PI * 2)], true);
    // Das Haarband und der Pferdeschwanz.
    const haar = j.haar;
    roehre(b, [vMinus(haar[0], vMal(vNorm(vMinus(haar[1], haar[0])), 0.01)), vPlus(haar[0], vMal(vNorm(vMinus(haar[1], haar[0])), 0.018))],
      [0.026, 0.026], j.kopfSeite, 8, () => [...KORALLE, STOFF.band, 0, 0], 1);
    roehre(b, haar, [0.022, 0.034, 0.036, 0.032, 0.026, 0.017, 0.007], j.kopfSeite, 9,
      (t, w) => [...vMisch(HAAR, HAAR_SPITZE, t * t), STOFF.haar, Math.cos(w), Math.sin(w)], 2);

    // Die Arme im Anzug, an der Aussenseite ein Streifen – und die Hände.
    const ARM = [0, 0.12, 0.3, 0.46, 0.53, 0.6, 0.75, 0.9, 1];
    const ARM_R = [0.049, 0.047, 0.04, 0.035, 0.034, 0.036, 0.033, 0.027, 0.024];
    for (const [schulter, ell, hand, s] of [[j.schulterH, j.ellH, j.handH, -1], [j.schulterV, j.ellV, j.handV, 1]]) {
      const aussen = vNorm(vPlus(vMal(j.breiteS, s), [0, 0.6, 0]));
      roehre(b, gelenkLinie(schulter, ell, hand, ARM, 0.05), ARM_R, aussen, 10,
        (t, w) => [...ANZUG, STOFF.anzug, Math.cos(w), 1], 2);
      const dir = vNorm(vMinus(hand, ell));
      const flach = vNorm(vKreuz(dir, vNorm(vPlus([0, 1, 0], vMal(j.breiteS, 0.3 * s)))));
      const finger = vMinus(vMal(dir, 0.92), [0, 0.35, 0]);
      roehre(b, [vMinus(hand, vMal(dir, 0.012)), vPlus(hand, vMal(dir, 0.05)), vPlus(vPlus(hand, vMal(dir, 0.1)), vMal(finger, 0.012)), vPlus(hand, vMal(vNorm(finger), 0.15))],
        [[0.025, 0.017], [0.04, 0.019], [0.037, 0.015], [0.018, 0.01]], flach, 8, () => [...HAUT, STOFF.haut, 0, 0], 2);
    }

    // Die Beine: oben im Anzug (er endet mitten am Oberschenkel), darunter
    // Haut – und die Füsse flach auf dem Deck.
    const BEIN = [0, 0.1, 0.2, 0.29, 0.3, 0.4, 0.47, 0.51, 0.56, 0.64, 0.73, 0.83, 0.93, 1];
    const BEIN_R = [[0.082, 0.085], [0.076, 0.08], [0.07, 0.074], [0.064, 0.068], [0.062, 0.066], [0.058, 0.06], [0.052, 0.054], [0.05, 0.052],
      [0.052, 0.056], [0.054, 0.06], [0.05, 0.056], [0.04, 0.042], [0.034, 0.034], [0.033, 0.032]];
    for (const [hueft, knie, knoechel, fuss, s] of [[j.hueftH, j.knieH, j.knoechelH, FUSS_H, -1], [j.hueftV, j.knieV, j.knoechelV, FUSS_V, 1]]) {
      roehre(b, gelenkLinie(hueft, knie, knoechel, BEIN, 0.07), BEIN_R, [0, 0, 1], 12,
        (t) => (t < 0.27 ? [...ANZUG, STOFF.anzug, 0, 0] : [...HAUT, STOFF.haut, 0, 0]), 2);
      const sohle = deckBei(knoechel[2]);
      const quer = vNorm(vKreuz(fuss, [0, 1, 0]));
      const ferse = [knoechel[0] - fuss[0] * 0.055, sohle + 0.032, knoechel[2] - fuss[2] * 0.055];
      roehre(b, [ferse, [knoechel[0] + fuss[0] * 0.04, sohle + 0.036, knoechel[2] + fuss[2] * 0.04],
        [knoechel[0] + fuss[0] * 0.12, sohle + 0.026, knoechel[2] + fuss[2] * 0.12], [knoechel[0] + fuss[0] * 0.18, sohle + 0.016, knoechel[2] + fuss[2] * 0.18]],
      [[0.03, 0.03], [0.04, 0.035], [0.045, 0.026], [0.03, 0.015]], quer, 8, () => [...HAUT, STOFF.haut, 0, 0], 2);
    }
    // Die Manschette der Leash am hinteren Knöchel.
    const bein = vNorm(vMinus(j.knieH, j.knoechelH));
    roehre(b, [vMinus(j.knoechelH, vMal(bein, 0.02)), vPlus(j.knoechelH, vMal(bein, 0.035))], [0.042, 0.042], [0, 0, 1], 10,
      () => [...FINNE, STOFF.finne, 0, 0], 1);

    // Das Brett: Station um Station vom Heck zur Nase; das Heck rund
    // geschlossen.
    const stationen = [-2, -1, ...BRETT_STATIONEN];
    const SP = 20;
    b.gitter(stationen.length, SP, (i, s) => {
      const st = stationen[i];
      const q = brettBei(Math.max(0, st));
      const mass = st === -2 ? 0 : st === -1 ? 0.72 : 1;
      const z = (Math.max(0, st) - 0.5) * BRETT_LANG - (st < 0 ? (st === -2 ? 0.009 : 0.005) : 0);
      const w = (s / SP) * Math.PI * 2;
      const c = Math.cos(w);
      const sn = Math.sin(w);
      const x = q.w * hochUndTief(c, 0.5) * mass;
      const quer = q.w > 1e-4 ? 1 - (x / q.w) * (x / q.w) : 0;
      const y = q.y + q.t / 2 + (q.t / 2) * hochUndTief(sn, 0.75) * mass + (sn > 0 ? q.t * 0.25 * quer : -q.t * 0.05 * quer) * mass;
      return [x, y, z];
    }, (i, s) => {
      const w = (s / SP) * Math.PI * 2;
      const st = Math.max(0, stationen[i]);
      return [0.93, 0.9, 0.84, Math.sin(w) > -1e-6 ? STOFF.deck : STOFF.boden, hochUndTief(Math.cos(w), 0.5), st];
    });

    // Drei Finnen unter dem Heck: zwei an den Seiten, leicht nach aussen
    // gekippt, eine in der Mitte.
    for (const [xs, s0, gross] of [[-0.13, 0.135, 1], [0.13, 0.135, 1], [0, 0.05, 0.9]]) {
      const z0 = (s0 - 0.5) * BRETT_LANG;
      const unten = brettBei(s0).y;
      const mitte = [0, 0.33, 0.66, 1].map((u) => [xs * (1 + 0.5 * u * Math.abs(xs)), unten + 0.008 - u * 0.11 * gross, z0 - 0.055 * gross * Math.pow(u, 1.4)]);
      roehre(b, mitte, [[0.05 * gross, 0.0055], [0.043 * gross, 0.005], [0.031 * gross, 0.004], [0.014 * gross, 0.003]], [0, 0, 1], 8,
        () => [...FINNE, STOFF.finne, 0, 0], 2);
    }

    // Die Leash: vom Knöchel aufs Deck und zum Stöpsel am Heck.
    const deckHeck = deckBei(-0.84);
    const zuHeck = [vPlus(j.knoechelH, [-0.035, -0.02, -0.01]), [-0.08, deckBei(-0.5) + 0.012, -0.5], [-0.07, deckBei(-0.68) + 0.01, -0.68], [0, deckHeck + 0.012, -0.84]];
    roehre(b, zuHeck, [0.0065, 0.0065, 0.0065, 0.0065], [0, 1, 0], 5, () => [...FINNE, STOFF.finne, 0, 0], 1);
  }

  // Der Schreiber der Surferin, ihr Netz in diesem Bild, und für die Gegner
  // zwei feste Haltungen (aufrecht, geduckt).
  const figur = { schreiber: null, ecken: 0, jetzt: null, stand: null, hocke: null, statisch: null, index: null };
  function figurPlan() {
    const b = netzSchreiber();
    figur.schreiber = b;
    const leer = new Float32Array(FIGUR_MAX * 6);
    b.anfang(leer);
    surferinBauen(b, haltungBei(haltungNeu()));
    figur.ecken = b.ende();
    figur.jetzt = new Float32Array(figur.ecken * 6);
    figur.index = new Uint16Array(b.plan.index);
    figur.statisch = new Float32Array(b.plan.wie);
    const fest = (duck) => {
      const p = haltungNeu();
      p.duck = duck;
      const raus = new Float32Array(figur.ecken * 6);
      b.anfang(raus);
      surferinBauen(b, haltungBei(p));
      return raus;
    };
    figur.stand = fest(0.25);
    figur.hocke = fest(0.95);
  }

  // Ihr Netz für dieses Bild.
  function figurJetzt(p) {
    figur.schreiber.anfang(figur.jetzt);
    surferinBauen(figur.schreiber, haltungBei(p));
    return figur.jetzt;
  }

  // Immer dieselbe Zahl zu derselben ganzen Zahl – auf jedem Gerät.
  function hashGanz(n) {
    let t = (n + 0x6d2b79f5) | 0;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  // Rauschen, das sich nahtlos wiederholt: für Wellen (mit ihrer Neigung in
  // Grün und Blau), Schaum und Wolken. Einmal gerechnet, 256 × 256.
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

  const SPUR_ECKEN = (SPUR_N + 1) * 2;
  const spurDaten = new Float32Array(SPUR_ECKEN * 5);
  const teilDaten = new Float32Array(TEILE_MAX * 8);

  function grafikBauen() {
    const P = bild.prog;
    P.himmel = programm("Himmel", HIMMEL_VS, HIMMEL_FS);
    P.welle = programm("Welle", WELLE_VS, WELLE_FS);
    P.figur = programm("Figur", FIGUR_VS, FIGUR_FS);
    P.teil = programm("Teilchen", TEIL_VS, TEIL_FS);
    P.spur = programm("Spur", SPUR_VS, SPUR_FS);
    P.schein = programm("Schein", SCHEIN_VS, SCHEIN_FS);

    const N = bild.netz;
    // Die Welle.
    const welle = wellenNetz();
    N.welle = { vao: gl.createVertexArray(), anzahl: welle.index.length };
    gl.bindVertexArray(N.welle.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, welle.ecken, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, welle.index, gl.STATIC_DRAW);

    // Die Surferin: ihr Netz kommt in jedem Bild neu (ich); die Gegner
    // fahren in zwei festen Haltungen (geist). Dreiecke, Farben und Stoffe
    // teilen sie.
    if (!figur.schreiber) figurPlan();
    const index = gl.createBuffer();
    const stoff = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, stoff);
    gl.bufferData(gl.ARRAY_BUFFER, figur.statisch, gl.STATIC_DRAW);
    const verbinde = (vao, a, c) => {
      gl.bindVertexArray(vao);
      for (const [puffer, ab] of [[a, 0], [c, 2], [stoff, 4]]) {
        gl.bindBuffer(gl.ARRAY_BUFFER, puffer);
        gl.enableVertexAttribArray(ab);
        gl.vertexAttribPointer(ab, 3, gl.FLOAT, false, 24, 0);
        gl.enableVertexAttribArray(ab + 1);
        gl.vertexAttribPointer(ab + 1, 3, gl.FLOAT, false, 24, 12);
      }
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, index);
    };
    const ich = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, ich);
    gl.bufferData(gl.ARRAY_BUFFER, figur.jetzt.byteLength, gl.DYNAMIC_DRAW);
    const stand = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, stand);
    gl.bufferData(gl.ARRAY_BUFFER, figur.stand, gl.STATIC_DRAW);
    const hocke = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, hocke);
    gl.bufferData(gl.ARRAY_BUFFER, figur.hocke, gl.STATIC_DRAW);
    N.figur = { anzahl: figur.index.length, ich: gl.createVertexArray(), puffer: ich, geist: gl.createVertexArray() };
    verbinde(N.figur.ich, ich, ich);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, figur.index, gl.STATIC_DRAW);
    verbinde(N.figur.geist, stand, hocke);

    // Die Teilchen: eine Scheibe, viele Male.
    const ecken = new Float32Array([-1, -1, 1, -1, 1, 1, -1, -1, 1, 1, -1, 1]);
    N.teil = { vao: gl.createVertexArray(), puffer: gl.createBuffer() };
    gl.bindVertexArray(N.teil.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, ecken, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, N.teil.puffer);
    gl.bufferData(gl.ARRAY_BUFFER, teilDaten.byteLength, gl.DYNAMIC_DRAW);
    for (let i = 0; i < 2; i += 1) {
      gl.enableVertexAttribArray(1 + i);
      gl.vertexAttribPointer(1 + i, 4, gl.FLOAT, false, 32, i * 16);
      gl.vertexAttribDivisor(1 + i, 1);
    }

    // Die Scheibe allein (der Schleier vor der Sonne).
    N.scheibe = { vao: gl.createVertexArray() };
    gl.bindVertexArray(N.scheibe.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, ecken, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    // Die Spur: ein Band, jedes Bild neu geschrieben.
    N.spur = { vao: gl.createVertexArray(), puffer: gl.createBuffer(), anzahl: 0 };
    gl.bindVertexArray(N.spur.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, N.spur.puffer);
    gl.bufferData(gl.ARRAY_BUFFER, spurDaten.byteLength, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 20, 0);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 20, 12);

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
    canvas.className = "wl-canvas";
    canvas.setAttribute("aria-hidden", "true");
    hud = document.createElement("canvas");
    hud.className = "wl-hud";
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
  const SONNE_SEITE = -0.045;      // die Sonne steht voraus, ein wenig links über der Schulter
  const FLUSS = 7;                 // so schnell zieht das Wasser die Wand hinauf (m/s)
  const SPUR_ALTER = 1.5;          // so lange bleibt die Spur des Bretts
  const basis = new Float32Array(9);
  const geistSurfer = { x: 0, y: 0, p: 0, R: 3, lip: 3, sx: -1, sy: 0, auf: [0, 1, 0], tx: 0, ty: 0, tz: 1 };

  function lichtSetzen(p) {
    gl.uniform3fv(p.ort("uSonne"), bild.sonne);
    gl.uniform3fv(p.ort("uSonneFlach"), bild.sonneFlach);
    gl.uniform3fv(p.ort("uLicht"), bild.licht);
    gl.uniform3fv(p.ort("uGlut"), abend.glut);
    gl.uniform3fv(p.ort("uHimmelLicht"), abend.himmelLicht);
    gl.uniform3fv(p.ort("uZenit"), abend.zenit);
    gl.uniform3fv(p.ort("uHorizont"), abend.horizont);
    gl.uniform3fv(p.ort("uAuge"), kam.auge);
    gl.uniform1f(p.ort("uDichte"), abend.dichte);
    gl.uniform1f(p.ort("uZeit"), state.zeit);
  }

  // Die Spur ins Band schreiben: vom Brett zurück, Stück um Stück älter – und
  // mit dem Wasser die Wand hinauf gewandert.
  function spurSammeln() {
    let n = 0;
    const d = spurDaten;
    const punkt = (z, p0, alter) => {
      const f = formBei(z - state.zs, z);
      const p = Math.min(p0 + FLUSS * 0.55 * alter * SPUR_ALTER / f.R, f.lip - 0.04);
      const x = f.mx + f.R * querBei(p);
      const y = f.R * hochBei(p);
      const breit = 0.04 + 0.2 * Math.pow(alter, 0.7);
      const tx = -Math.cos(p) * breit;
      const ty = Math.sin(p) * breit;
      const nx = Math.sin(p) * 0.035;
      const ny = Math.cos(p) * 0.035;
      for (const s of [-1, 1]) {
        const o = n * 5;
        d[o] = x + nx + tx * s; d[o + 1] = y + ny + ty * s; d[o + 2] = z - kam.z; d[o + 3] = s; d[o + 4] = alter;
        n += 1;
      }
    };
    if (state.schritt === "fahrt" || state.schritt === "start") punkt(state.zp - 0.8, surfer.p, 0);
    for (let i = 0; i < spur.n && n < SPUR_ECKEN - 2; i += 1) {
      const j = (spur.kopf - i + SPUR_N) % SPUR_N;
      const alter = (state.zeit - spur.t[j]) / SPUR_ALTER;
      if (alter >= 1) break;
      if (spur.z[j] < kam.z - 1) break;
      punkt(spur.z[j], spur.p[j], Math.max(0.001, alter));
    }
    bild.netz.spur.anzahl = n;
    if (n >= 4) {
      gl.bindBuffer(gl.ARRAY_BUFFER, bild.netz.spur.puffer);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, d, 0, n * 5);
    }
  }

  function teileSammeln() {
    const d = teilDaten;
    for (let i = 0; i < teile.n; i += 1) {
      const o = i * 8;
      d[o] = teile.x[i]; d[o + 1] = teile.y[i]; d[o + 2] = teile.z[i] - kam.z; d[o + 3] = teile.gross[i];
      d[o + 4] = teile.hell[i]; d[o + 5] = 1 - teile.leben[i] / teile.max[i]; d[o + 6] = (i * 0.618) % 1; d[o + 7] = 0;
    }
    if (teile.n) {
      gl.bindBuffer(gl.ARRAY_BUFFER, bild.netz.teil.puffer);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, d, 0, teile.n * 8);
    }
  }

  // Die Figur auf die Wand stellen: das Brett liegt auf dem Wasser, der
  // Körper lehnt sich zur Senkrechten und in die Kurve.
  // Wo die Senkrechte der Welt im Raum der Figur liegt (vor dem Purzeln):
  // Danach richtet sich ihr Körper auf, und danach hängt ihr Haar.
  const figurLot = [0, 1, 0];
  function figurStellen(s, lehn, purzel = 0, kipp = 0.55) {
    const P = bild.prog.figur;
    // voraus (z des Netzes): die Fahrtrichtung.
    const zx = s.tx, zy = s.ty, zz = s.tz;
    // quer (zur Wand hin): voraus × auf.
    const xx = zy * s.auf[2] - zz * s.auf[1];
    const xy = zz * s.auf[0] - zx * s.auf[2];
    const xz = zx * s.auf[1] - zy * s.auf[0];
    // hoch: von der Wand weg, zur Senkrechten hin geneigt (kipp) – aber nie
    // in die Wand hinein gekippt (an einer steilen Wand zeigt «die Wand
    // hinauf» fast senkrecht nach oben; dann bliebe von der Figur nur ein
    // Strich). Das Brett der Surferin liegt flacher auf der Wand als die
    // Gegner; aufrichten tut sich ihr Körper selbst (haltungBei).
    let yx = lerp(s.auf[0], 0, kipp) + s.sx * lehn;
    let yy = lerp(s.auf[1], 1, kipp) + s.sy * lehn;
    let yz = -zy * 0.3;
    const schief = (yx * xx + yy * xy + yz * xz) * 0.65;
    yx -= xx * schief; yy -= xy * schief; yz -= xz * schief;
    const yl = Math.hypot(yx, yy, yz) || 1;
    yx /= yl; yy /= yl; yz /= yl;
    figurLot[0] = xy; figurLot[1] = yy; figurLot[2] = zy;
    // Wer stürzt, überschlägt sich um seine Fahrtrichtung.
    const pc = Math.cos(purzel);
    const ps = Math.sin(purzel);
    basis[0] = xx * pc + yx * ps; basis[1] = xy * pc + yy * ps; basis[2] = xz * pc + yz * ps;
    basis[3] = yx * pc - xx * ps; basis[4] = yy * pc - xy * ps; basis[5] = yz * pc - xz * ps;
    basis[6] = zx; basis[7] = zy; basis[8] = zz;
    gl.uniformMatrix3fv(P.ort("uBasis"), false, basis);
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

  function zeichneWelt() {
    if (!bild.ok || !gl || gl.isContextLost()) return;
    const P = bild.prog;
    const N = bild.netz;
    abendBei(clamp(state.spielzeit / DAUER, 0, 1));
    const hoch = abend.sonne * GRAD;
    bild.sonne[0] = Math.sin(SONNE_SEITE) * Math.cos(hoch);
    bild.sonne[1] = Math.sin(hoch);
    bild.sonne[2] = Math.cos(SONNE_SEITE) * Math.cos(hoch);
    bild.sonneFlach[0] = Math.sin(SONNE_SEITE);
    bild.sonneFlach[2] = Math.cos(SONNE_SEITE);
    for (let j = 0; j < 3; j += 1) {
      bild.licht[j] = abend.licht[j] * abend.kraft;
      bild.durch[j] = abend.durch[j] * abend.kraft;
    }
    // Das Licht in der Röhre: was durch einen halben Meter Wasser kommt.
    bild.roehre[0] = bild.durch[0] * 0.39 * 0.6 + abend.streu[0] * 0.3;
    bild.roehre[1] = bild.durch[1] * 0.81 * 0.6 + abend.streu[1] * 0.3;
    bild.roehre[2] = bild.durch[2] * 0.65 * 0.6 + abend.streu[2] * 0.3;
    kameraStellen();

    // Die Form jeder Reihe des Netzes.
    for (let i = 0; i < REIHEN; i += 1) {
      const z = kam.z + reiheZ[i];
      const f = formBei(z - state.zs, z);
      formDaten[i * 4] = reiheZ[i];
      formDaten[i * 4 + 1] = f.lip;
      formDaten[i * 4 + 2] = f.R;
      formDaten[i * 4 + 3] = gischtBei(z);
    }
    spurSammeln();
    teileSammeln();
    const lauf0 = ((kam.z % 1000) + 1000) % 1000;
    const lauf1 = (state.zeit * FLUSS) % 1000;
    const dach = weich(150 * GRAD, 215 * GRAD, surfer.lip);

    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.disable(gl.CULL_FACE);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, bild.rausch);
    for (const name of ["welle", "figur", "himmel", "teil", "spur"]) {
      gl.useProgram(P[name].p);
      lichtSetzen(P[name]);
      if (name !== "himmel" && name !== "teil") gl.uniformMatrix4fv(P[name].ort("uPV"), false, kam.pv);
      if (name !== "figur") gl.uniform1i(P[name].ort("uRausch"), 0);
      if (name === "welle" || name === "himmel" || name === "spur") gl.uniform2f(P[name].ort("uLauf"), lauf0, lauf1);
      if (name === "welle" || name === "himmel") gl.uniform3fv(P[name].ort("uTief"), abend.tief);
      if (name === "welle" || name === "figur" || name === "spur") gl.uniform3fv(P[name].ort("uRoehre"), bild.roehre);
      if (name === "figur" || name === "spur") gl.uniform1f(P[name].ort("uDach"), dach);
    }

    // 1. Die Welle.
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.depthMask(true);
    gl.disable(gl.BLEND);
    gl.clear(gl.DEPTH_BUFFER_BIT);
    gl.useProgram(P.welle.p);
    gl.uniform4fv(P.welle.ort("uForm"), formDaten);
    gl.uniform1f(P.welle.ort("uVorSchaum"), kam.z - state.zs);
    gl.uniform3fv(P.welle.ort("uStreu"), abend.streu);
    gl.uniform3fv(P.welle.ort("uDurch"), bild.durch);
    const schatten = state.schritt === "fahrt" || state.schritt === "start" || state.schritt === "strand" ? 0.38 : 0;
    gl.uniform4f(P.welle.ort("uSchatten"), surfer.x, surfer.y, state.zp - kam.z - 0.1, schatten);
    gl.bindVertexArray(N.welle.vao);
    gl.drawElements(gl.TRIANGLES, N.welle.anzahl, gl.UNSIGNED_SHORT, 0);

    // 2. Der Surfer.
    // Verschluckt verschwindet er im Schaum; über die Lippe geworfen fällt
    // er, sich überschlagend, ins Tal.
    const sturz = state.schritt === "aus" ? state.zeit - state.schrittZeit : 0;
    const wurf = state.schluss === "lippe" ? sturz : 0;
    const sichtbar = state.schritt !== "aus" || sturz < (state.schluss === "lippe" ? 1.2 : 0.5);
    gl.useProgram(P.figur.p);
    if (sichtbar) {
      figurStellen(surfer, surfer.lehn * 0.5, wurf * 4.2, 0.3);
      // Ihr Körper richtet sich gegenüber dem Brett zur Senkrechten auf, ihr
      // Haar hängt nach unten.
      const hal = surfer.haltung;
      hal.roll = Math.atan2(figurLot[0], Math.max(0.05, figurLot[1])) * 0.6;
      hal.lehn = surfer.lehn * 0.7;
      surfer.unten[0] = -figurLot[0]; surfer.unten[1] = -figurLot[1]; surfer.unten[2] = -figurLot[2];
      gl.bindVertexArray(N.figur.ich);
      gl.bindBuffer(gl.ARRAY_BUFFER, N.figur.puffer);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, figurJetzt(hal));
      gl.uniform3f(P.figur.ort("uOrt"), surfer.x + 3 * wurf, Math.max(0.3, surfer.y + 3.6 * wurf - 6.5 * wurf * wurf), state.zp - kam.z);
      gl.uniform1f(P.figur.ort("uPose"), 0);
      gl.uniform4f(P.figur.ort("uGeist"), 0, 0, 0, 0);
      gl.drawElements(gl.TRIANGLES, N.figur.anzahl, gl.UNSIGNED_SHORT, 0);
    }

    // 3. Himmel und Meer dahinter, wo noch nichts steht.
    gl.depthMask(false);
    gl.useProgram(P.himmel.p);
    gl.uniform3fv(P.himmel.ort("uRechts"), kam.rechts);
    gl.uniform3fv(P.himmel.ort("uHoch"), kam.hoch);
    gl.uniform3fv(P.himmel.ort("uVor"), kam.vor);
    gl.uniform2fv(P.himmel.ort("uTan"), kam.tan);
    gl.uniform3fv(P.himmel.ort("uWolkeHell"), abend.wolkeHell);
    gl.uniform3fv(P.himmel.ort("uWolkeDunkel"), abend.wolkeDunkel);
    gl.uniform1f(P.himmel.ort("uStrand"), strandBei(state.spielzeit));
    gl.bindVertexArray(bild.leer);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    // 4. Die Spur des Bretts, dann Gischt und Sprühnebel: weich darübergelegt.
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    if (N.spur.anzahl >= 4) {
      gl.useProgram(P.spur.p);
      gl.bindVertexArray(N.spur.vao);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, N.spur.anzahl);
    }
    if (teile.n) {
      gl.useProgram(P.teil.p);
      gl.uniformMatrix4fv(P.teil.ort("uProj"), false, kam.proj);
      gl.uniformMatrix4fv(P.teil.ort("uSicht"), false, kam.sicht);
      gl.bindVertexArray(N.teil.vao);
      gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, teile.n);
    }

    // 5. Die Gegner (geist.js): Surfer aus Licht, so tief in der Röhre, wie
    // sie damals waren.
    geisterOrte.length = 0;
    if (gegner && state.phase !== "bereit") {
      gl.useProgram(P.figur.p);
      gl.bindVertexArray(N.figur.geist);
      (window.LernappGeist?.orte?.(gegner) || []).forEach((o) => {
        geisterOrte.push(o);
        // Wem im Live-Modus zugeschaut wird, der ist der Surfer selbst – kein
        // Geist dazu, nur sein Name (geist.js, namen).
        if (o.ziel) return;
        const gz = state.zs + o.c / 100;
        if (gz < kam.z + 1 || gz > kam.z + 160) return;
        const farbe = farbeAus(o.farbe);
        surferStellen(clamp(o.b / 100, 0, 1), gz, clamp((o.db || 0) * 0.075, -0.5, 0.5), geistSurfer);
        figurStellen(geistSurfer, 0);
        gl.uniform3f(P.figur.ort("uOrt"), geistSurfer.x, geistSurfer.y, gz - kam.z);
        gl.uniform1f(P.figur.ort("uPose"), o.c / 100 < ROEHRE ? 1 : 0.3);
        gl.uniform4f(P.figur.ort("uGeist"), farbe[0], farbe[1], farbe[2], 0.8 * o.blass);
        gl.drawElements(gl.TRIANGLES, N.figur.anzahl, gl.UNSIGNED_SHORT, 0);
        o.wx = geistSurfer.x;
        o.wy = geistSurfer.y;
        o.wz = gz;
      });
    }

    // 6. Der Schleier vor der Sonne, über allem.
    gl.disable(gl.DEPTH_TEST);
    gl.blendFunc(gl.ONE, gl.ONE);
    gl.useProgram(P.schein.p);
    gl.uniformMatrix4fv(P.schein.ort("uProj"), false, kam.proj);
    gl.uniformMatrix4fv(P.schein.ort("uSicht"), false, kam.sicht);
    const s = bild.sonne;
    gl.uniform4f(P.schein.ort("uWo"), kam.auge[0] + s[0] * 900, kam.auge[1] + s[1] * 900, s[2] * 900, 250);
    gl.uniform4f(P.schein.ort("uFarbe"), bild.licht[0] * 0.15 + abend.glut[0] * 0.05, bild.licht[1] * 0.15 + abend.glut[1] * 0.05, bild.licht[2] * 0.15 + abend.glut[2] * 0.05, 2.4);
    gl.bindVertexArray(N.scheibe.vao);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    gl.disable(gl.BLEND);
    gl.depthMask(true);
    gl.bindVertexArray(null);
  }

  // Wie weit rechts der Strand liegt: Die Welle läuft auf ihn zu und erreicht
  // ihn am Schluss der Runde.
  const strandBei = (t) => lerp(420, 16, Math.pow(clamp(t / DAUER, 0, 1), 0.8)) - 6 * weich(DAUER, DAUER + 3, t);

  // ---------------------------------------------------------------------------
  // Die Fläche
  // ---------------------------------------------------------------------------
  function buildPlatz() {
    feld = shell.el("div", "wl-feld");
    feld.append(canvas, hud);
    if (!bild.ok) {
      feld.append(shell.el("p", "wl-ohne", "Dieses Spiel braucht WebGL 2 – dieser Browser kann das leider nicht."));
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

  const komma = (zahl, stellen = 1) => zahl.toFixed(stellen).replace(".", ",");

  // Oben links: wie viel Luft bis zum Schaum ist, die Serie – darunter ein
  // schmaler Balken (links der Schaum, die Marke das Ende der Röhre) und ihr
  // Tempo: grün mit Pfeilen nach rechts, wenn sie dem Schaum davonfährt,
  // rot mit Pfeilen nach links, wenn er aufholt.
  const ANZEIGE_HOCH = 2.95;       // so hoch ist das Kästchen, mal die Schrift
  function zeichneAnzeige() {
    // Vor dem ersten Druck stehen dort die Sätze, wie es geht.
    if (state.phase === "bereit") return;
    const gross = clamp(view.cssH * 0.05, 15, 24);
    const x = 12;
    const y = 12 + view.frei;
    const d = Math.max(0, state.zp - state.zs);
    const inRoehre = d < ROEHRE && state.phase !== "bereit";
    const eng = d < 2.2 && state.phase !== "bereit";
    const mal = malBei(state.serie);
    const zahl = `${komma(d)} m`;
    const serie = inRoehre ? `×${komma(mal)}` : "";
    g.font = `900 ${Math.round(gross)}px system-ui, sans-serif`;
    const zw = g.measureText("00,0 m").width;
    g.font = `900 ${Math.round(gross * 0.8)}px system-ui, sans-serif`;
    const sw = g.measureText("×0,0").width;
    const breit = gross * 1.9 + zw + gross * 0.5 + sw + gross * 0.7;
    const hoch = gross * ANZEIGE_HOCH;
    g.fillStyle = "rgba(8, 14, 20, 0.5)";
    runde(x, y, breit, hoch, gross * 0.8);
    g.fill();
    // Eine kleine Welle als Zeichen.
    g.save();
    g.translate(x + gross * 0.95, y + gross * 0.86);
    g.strokeStyle = inRoehre ? "#ffd76a" : "rgba(255, 255, 255, 0.8)";
    g.lineWidth = Math.max(2, gross * 0.13);
    g.lineCap = "round";
    g.lineJoin = "round";
    g.beginPath();
    g.moveTo(-gross * 0.5, gross * 0.3);
    g.bezierCurveTo(-gross * 0.25, gross * 0.3, -gross * 0.3, -gross * 0.36, gross * 0.08, -gross * 0.36);
    g.bezierCurveTo(gross * 0.5, -gross * 0.36, gross * 0.5, gross * 0.12, gross * 0.14, gross * 0.02);
    g.stroke();
    g.restore();
    g.textAlign = "left";
    g.textBaseline = "middle";
    g.font = `900 ${Math.round(gross)}px system-ui, sans-serif`;
    g.fillStyle = eng ? "#ff8a70" : inRoehre ? "#ffffff" : "rgba(255, 255, 255, 0.72)";
    g.fillText(zahl, x + gross * 1.75, y + gross * 0.9);
    if (serie) {
      g.font = `900 ${Math.round(gross * 0.8)}px system-ui, sans-serif`;
      g.fillStyle = "#ffd76a";
      g.fillText(serie, x + gross * 1.75 + zw + gross * 0.5, y + gross * 0.92);
    }
    // Der Balken: 0 bis 18 m vor dem Schaum.
    const bx = x + gross * 0.6;
    const bw = breit - gross * 1.2;
    const by = y + gross * 1.68;
    const bh = Math.max(3, gross * 0.17);
    const wo = (m) => bx + bw * clamp(m / 18, 0, 1);
    g.fillStyle = "rgba(255, 255, 255, 0.2)";
    runde(bx, by, bw, bh, bh / 2);
    g.fill();
    const verlauf = g.createLinearGradient(bx, 0, wo(ROEHRE), 0);
    verlauf.addColorStop(0, "#ff7a5c");
    verlauf.addColorStop(0.35, "#ffd76a");
    verlauf.addColorStop(1, "rgba(255, 215, 106, 0.35)");
    g.fillStyle = verlauf;
    runde(bx, by, wo(ROEHRE) - bx, bh, bh / 2);
    g.fill();
    // Wo der Schaum gleich anzieht (ein schneller Abschnitt), steht ein
    // roter Strich über dem Balken – er wandert auf den Schaum zu.
    if (state.phase !== "bereit") {
      g.fillStyle = "#ff5a48";
      for (const a of state.welt.ab) {
        if (a.f <= 1) continue;
        const m0 = state.z0 + a.z0 - state.zs;
        const m1 = state.z0 + a.z1 - state.zs;
        if (m1 <= 0 || m0 >= 18) continue;
        const x0 = wo(Math.max(0, m0));
        runde(x0, by - bh * 1.5, Math.max(bh, wo(Math.min(18, m1)) - x0), bh, bh / 2);
        g.fill();
      }
    }
    g.fillStyle = "#ffffff";
    g.beginPath();
    g.arc(wo(d), by + bh / 2, bh * 1.25, 0, Math.PI * 2);
    g.fill();

    // Ihr Tempo – und ob sie schneller ist als der Schaum.
    const schaum = state.schritt === "fahrt" ? tempoBei(state.spielzeit) * faktorBei(state.spielzeit) : state.v;
    const vor = state.v - schaum;
    const ty = y + gross * 2.4;
    const farbe = vor > 0.4 ? "#9ff7d2" : vor < -0.4 ? "#ff9a7a" : "rgba(255, 255, 255, 0.85)";
    g.font = `900 ${Math.round(gross * 0.72)}px system-ui, sans-serif`;
    g.fillStyle = farbe;
    const tempo = `${Math.round(state.v * 3.6)} km/h`;
    g.fillText(tempo, bx, ty);
    const pfeile = Math.min(3, Math.ceil(Math.max(0, Math.abs(vor) - 0.4) / 1.6));
    let px = bx + g.measureText("000 km/h").width + gross * 0.35;
    const ph = gross * 0.26;
    for (let i = 0; i < pfeile; i += 1) {
      g.globalAlpha = 1 - i * 0.22;
      g.beginPath();
      if (vor > 0) { g.moveTo(px, ty - ph); g.lineTo(px + ph * 1.1, ty); g.lineTo(px, ty + ph); }
      else { g.moveTo(px + ph * 1.1, ty - ph); g.lineTo(px, ty); g.lineTo(px + ph * 1.1, ty + ph); }
      g.closePath();
      g.fill();
      px += ph * 1.5;
    }
    g.globalAlpha = 1;
  }

  // Wohin ein Finger lenkt: zwei Felder unten links und rechts. Vor dem
  // ersten Druck gross, mit den Sätzen dazu; während der Fahrt (auf einem
  // Gerät mit Fingern – sonst nur am Anfang) als leise Pfeile, die
  // aufleuchten, solange sie gedrückt sind.
  const fingerGeraet = Boolean(window.matchMedia?.("(pointer: coarse)")?.matches);
  function zeichneFelder(gross, deck, aktiv, texte) {
    const quer = view.cssW > view.cssH * 1.1;
    const y = view.cssH * (texte ? (quer ? 0.8 : 0.85) : 0.88);
    const rand = Math.max(gross * 1.3 + 8, view.cssW * 0.08);
    g.font = `800 ${Math.round(clamp(gross * 0.4, 12, 17))}px system-ui, sans-serif`;
    for (const [s, richtung, text] of [[-1, 1, "Halten: hinauf"], [1, -1, "Halten: hinunter"]]) {
      const x = s < 0 ? rand : view.cssW - rand;
      const an = aktiv === richtung;
      g.fillStyle = `rgba(8, 14, 20, ${(an ? 0.55 : 0.4) * deck})`;
      g.beginPath();
      g.arc(x, y, gross, 0, Math.PI * 2);
      g.fill();
      // Der Pfeil: hinauf zur Wand (links oben), hinunter ins Tal (rechts unten).
      g.save();
      g.translate(x, y);
      g.rotate(s < 0 ? -Math.PI * 0.25 : Math.PI * 0.75);
      g.strokeStyle = an ? `rgba(159, 247, 210, ${deck})` : `rgba(255, 255, 255, ${0.9 * deck})`;
      g.lineWidth = Math.max(3, gross * 0.15);
      g.lineCap = "round";
      g.lineJoin = "round";
      g.beginPath();
      g.moveTo(0, gross * 0.45);
      g.lineTo(0, -gross * 0.42);
      g.moveTo(-gross * 0.32, -gross * 0.12);
      g.lineTo(0, -gross * 0.45);
      g.lineTo(gross * 0.32, -gross * 0.12);
      g.stroke();
      g.restore();
      if (!texte) continue;
      // Der Satz darunter – nie über den Rand hinaus.
      const halb = g.measureText(text).width / 2;
      const tx = clamp(x, halb + 8, view.cssW - halb - 8);
      g.textAlign = "center";
      g.textBaseline = "top";
      g.lineWidth = 3;
      g.lineJoin = "round";
      g.strokeStyle = `rgba(8, 14, 20, ${0.7 * deck})`;
      g.strokeText(text, tx, y + gross * 1.18);
      g.fillStyle = `rgba(255, 255, 255, ${deck})`;
      g.fillText(text, tx, y + gross * 1.18);
    }
    if (!texte) return;
    // Was geschieht, wenn niemand lenkt – und wie es schnell wird: quer
    // rechts neben der Surferin, hochkant über ihr, auf einem dunklen Grund.
    const zeile = gross * 0.62;
    g.font = `800 ${Math.round(clamp(gross * 0.4, 12, 17))}px system-ui, sans-serif`;
    const breit = Math.max(...texte.map((t) => g.measureText(t).width)) + gross * 0.9;
    const hoch = zeile * texte.length + gross * 0.45;
    const mx = quer ? view.cssW * 0.66 : view.cssW / 2;
    const my = quer ? view.cssH * 0.56 : view.cssH * 0.4;
    g.fillStyle = `rgba(8, 14, 20, ${0.5 * deck})`;
    runde(mx - breit / 2, my - hoch / 2, breit, hoch, gross * 0.35);
    g.fill();
    g.textAlign = "center";
    g.textBaseline = "middle";
    texte.forEach((text, i) => {
      g.fillStyle = i ? `rgba(159, 247, 210, ${deck})` : `rgba(255, 255, 255, ${deck})`;
      g.fillText(text, mx, my + (i - (texte.length - 1) / 2) * zeile);
    });
  }

  function zeichneHinweis() {
    if (shell.live) return;
    const gross = clamp(Math.min(view.cssW, view.cssH) * 0.075, 22, 44);
    if (state.phase === "bereit") {
      const puls = ruhig() ? 0.9 : 0.75 + 0.25 * Math.sin(state.zeit * 3.2);
      zeichneFelder(gross, puls, 0, ["Loslassen: geradeaus", "Rauf und runter pumpen gibt Schwung"]);
      return;
    }
    if (state.phase !== "spiel" || state.schritt !== "fahrt") return;
    const deck = fingerGeraet ? 1 : 1 - weich(8, 12, state.spielzeit);
    if (deck <= 0) return;
    zeichneFelder(gross * 0.7, deck * (state.lenk ? 0.9 : 0.45), state.lenk, null);
  }

  // Ein Satz gross im Bild: zum Start, am Schluss.
  function zeichneKarte() {
    const k = state.karte;
    if (!k) return;
    const alter = state.zeit - k.seit;
    const deck = Math.min(1, alter / 0.4) * clamp((k.dauer - alter) / 0.6, 0, 1);
    if (deck <= 0) return;
    const gross = clamp(view.cssW * 0.06, 22, 46);
    // Unter der Anzeige oben links – auf dem Handy rückt beides tiefer.
    const y = Math.max(view.cssH * 0.2, view.frei + clamp(view.cssH * 0.05, 15, 24) * ANZEIGE_HOCH + 14 + gross * 0.9);
    g.globalAlpha = deck;
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.font = `900 ${Math.round(gross)}px system-ui, sans-serif`;
    g.lineWidth = Math.max(3, gross * 0.12);
    g.lineJoin = "round";
    g.strokeStyle = "rgba(8, 14, 20, 0.55)";
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

  // Kleine Schriften am Surfer: die Serie, wenn sie eine Stufe nimmt.
  const schriften = [];
  function schrift(text, farbe, gross) {
    schriften.push({ text, farbe, gross, leben: 1.3, max: 1.3 });
  }

  function zeichneSchriften() {
    if (!schriften.length) return;
    const p = imBild(surfer.x + surfer.auf[0] * 0.8, surfer.y + 2.1, state.zp);
    if (!p) return;
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.lineJoin = "round";
    for (const s of schriften) {
      const k = clamp(s.leben / s.max, 0, 1);
      g.globalAlpha = Math.min(1, k * 2.2);
      g.font = `900 ${Math.round(s.gross * clamp(view.cssH / 520, 0.8, 1.4))}px system-ui, sans-serif`;
      g.lineWidth = 4;
      g.strokeStyle = "rgba(8, 14, 20, 0.6)";
      g.strokeText(s.text, p.x, p.y - (1 - k) * 34);
      g.fillStyle = s.farbe;
      g.fillText(s.text, p.x, p.y - (1 - k) * 34);
    }
    g.globalAlpha = 1;
  }

  // Tropfen auf der Linse, wenn es knapp war: Sie rinnen langsam hinab und
  // trocknen.
  const tropfen = [];
  function tropfenDazu(anzahl) {
    if (ruhig()) return;
    for (let i = 0; i < anzahl && tropfen.length < 26; i += 1) {
      tropfen.push({ x: Math.random(), y: Math.random() * 0.85, r: 0.012 + Math.random() * 0.028, v: 0.01 + Math.random() * 0.05, leben: 2.2 + Math.random() * 1.6, max: 3.8 });
    }
  }

  function zeichneTropfen() {
    if (!tropfen.length) return;
    const mass = Math.min(view.cssW, view.cssH);
    for (const t of tropfen) {
      const k = clamp(t.leben / 1.2, 0, 1);
      const x = t.x * view.cssW;
      const y = t.y * view.cssH;
      const r = t.r * mass;
      const glas = g.createRadialGradient(x - r * 0.3, y - r * 0.35, r * 0.1, x, y, r);
      glas.addColorStop(0, `rgba(255, 255, 255, ${0.5 * k})`);
      glas.addColorStop(0.5, `rgba(220, 240, 245, ${0.14 * k})`);
      glas.addColorStop(0.92, `rgba(255, 255, 255, ${0.26 * k})`);
      glas.addColorStop(1, "rgba(255, 255, 255, 0)");
      g.fillStyle = glas;
      g.beginPath();
      g.ellipse(x, y, r * 0.85, r * 1.1, 0, 0, Math.PI * 2);
      g.fill();
    }
  }

  // Die Namen der Gegner an ihren Surfern (geist.js).
  function zeichneNamen() {
    if (!geisterOrte.length || !window.LernappGeist?.namen) return;
    const liste = geisterOrte.map((o) => {
      const p = o.ziel ? imBild(surfer.x, surfer.y + 2.3, state.zp) : (o.wz !== undefined ? imBild(o.wx, o.wy + 2.1, o.wz) : null);
      return { ...o, sx: p ? p.x : view.cssW / 2, sy: p ? p.y : view.cssH + 40, weit: `${komma(Math.max(0, o.c / 100))} m` };
    });
    window.LernappGeist.namen(g, liste, { breit: view.cssW, hoch: view.cssH });
  }

  function zeichneHud() {
    if (!g) return;
    g.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
    g.clearRect(0, 0, view.cssW, view.cssH);
    // Der Schaum im Nacken: Vom Rand her wird das Bild weiss.
    if (state.weiss > 0.01) {
      const r = Math.hypot(view.cssW, view.cssH) / 2;
      const innen = lerp(0.8, 0, clamp(state.weiss * 1.1, 0, 1));
      const rand = g.createRadialGradient(view.cssW / 2, view.cssH / 2, r * innen, view.cssW / 2, view.cssH / 2, r);
      rand.addColorStop(0, `rgba(240, 250, 250, ${clamp(state.weiss * 2.2 - 1.2, 0, 1)})`);
      rand.addColorStop(1, `rgba(240, 250, 250, ${clamp(state.weiss * 1.7, 0, 1)})`);
      g.fillStyle = rand;
      g.fillRect(0, 0, view.cssW, view.cssH);
    }
    zeichneTropfen();
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

  // Die Brandung: eine Schleife, die in der Röhre lauter und heller wird.
  // Nachgestellt wird sie ein paarmal je Sekunde, nicht in jedem Bild.
  let brandung = null;
  let brandungMs = -1e9;
  function brandungAn() {
    brandung = klang()?.kulisse?.("welle.brandung") || null;
    brandungMs = -1e9;
    brandungStellen();
  }

  function brandungStellen() {
    if (!brandung) return;
    const ms = performance.now();
    if (ms - brandungMs < 80) return;
    brandungMs = ms;
    const d = state.zp - state.zs;
    const tief = 1 - weich(0, ROEHRE + 4, d);
    const k = clamp(0.2 + 0.55 * tief + 0.25 * (state.v - C0) / (C1 - C0), 0, 1) * (state.schritt === "fahrt" ? 1 : 0.5);
    brandung.setze(0.15 + 0.7 * k);
    brandung.laut(0.45 + 0.55 * k);
  }

  function brandungAus() {
    brandung?.stop();
    brandung = null;
  }

  // ---------------------------------------------------------------------------
  // Der Lauf
  // ---------------------------------------------------------------------------
  function karte(gross, klein, farbe = "#ffe9b8", dauer = 2.8) {
    state.karte = { gross, klein, farbe, dauer, seit: state.zeit };
  }

  // Ein Schritt der Fahrt: der Schaum nach seiner Tabelle, der Surfer nach
  // dem, was der Finger tut.
  function physik(dt) {
    state.spielzeit += dt;
    const t = state.spielzeit;
    state.zs = state.z0 + schaumBei(t);
    const ziel = state.lenk > 0 ? PSI_AUF : state.lenk < 0 ? -PSI_AB : PSI_FREI;
    state.psi += (ziel - state.psi) * (1 - Math.exp(-dt / DREH));
    const d = state.zp - state.zs;
    const c = tempoBei(t);
    const linieTempo = c * linie(state.h) * tasche(d, t);
    let sinus = Math.sin(state.psi);
    // Unter der Lippe wird die Wand senkrecht: Hinauf geht es dort zäh.
    if (sinus > 0) sinus *= 1 - ZAEH * weich(ZAEH_AB, 1, state.h);
    // Hinunter gibt der Hang ganz, hinauf kostet er nur zum Teil.
    const hang = -HANG * steilBei(state.h) * sinus * (sinus > 0 ? HEBT : 1);
    // Schwung hält lange – nur hoch an der Wand bremst es.
    const traeg = state.v > linieTempo ? lerp(TRAEG_SCHWUNG, TRAEG_HOCH, weich(BREMS_AB, 0.9, state.h)) : TRAEG_SCHUB;
    state.v += (hang + (linieTempo - state.v) / traeg) * dt;
    state.v = clamp(state.v, V_MIN, c * V_MAX);
    state.h += state.v * sinus / WAND * dt;
    if (state.h < 0) {
      // Im Flachen geht es nicht tiefer – und kaum noch voran.
      state.h = 0;
      if (state.psi < -0.1) state.psi = -0.1;
    }
    state.zp += state.v * dt;
    schwungTakt(c);
  }

  // Schwung sichtbar machen: Bringt ein Abstieg deutlich Tempo, steht kurz
  // «Schwung!» an der Surferin – je mehr, desto grösser.
  const schwung = { ab: false, v0: 0, zuletzt: -9 };
  function schwungTakt(c) {
    const runter = state.psi < -0.25;
    if (runter && !schwung.ab) {
      schwung.ab = true;
      schwung.v0 = state.v;
    } else if (!runter && schwung.ab) {
      schwung.ab = false;
      const plus = (state.v - schwung.v0) / c;
      if (plus > SCHWUNG_ZEIGEN && state.phase === "spiel" && state.spielzeit - schwung.zuletzt > 2.4) {
        schwung.zuletzt = state.spielzeit;
        state.schwungZahl += 1;
        schrift(plus > 0.34 ? "Voller Schwung!" : "Schwung!", plus > 0.34 ? "#9ff7d2" : "#d6fff0", plus > 0.34 ? 26 : 22);
      }
    }
  }

  // Punkte gibt es nur in der Röhre: je tiefer, desto mehr, mal die Serie.
  function zaehlen(dt) {
    const d = state.zp - state.zs;
    if (d < ROEHRE) {
      if (!state.drin) {
        state.drin = true;
        if (state.phase === "spiel") ton("welle.roehre", { laut: 0.9 }, 900);
      }
      state.draussen = 0;
      state.serie += dt;
      state.roehrenzeit += dt;
      state.tiefste = Math.min(state.tiefste, d);
      const mal = malBei(state.serie);
      state.besteSerie = Math.max(state.besteSerie, mal);
      state.roh += punkteBei(d) * mal * dt;
      const stufe = Math.floor(mal + 1e-6);
      if (stufe > state.stufe) {
        state.stufe = stufe;
        if (state.phase === "spiel") schrift(`×${stufe}`, "#ffd76a", 30);
      }
    } else if (state.drin) {
      state.draussen += dt;
      if (state.draussen > GNADE) {
        state.drin = false;
        state.serie = 0;
        state.stufe = 1;
      }
    }
    // Knapp entkommen: Tropfen auf der Linse.
    if (d < 1.3) state.knapp = 1;
    else if (state.knapp && d > 2.8) {
      state.knapp = 0;
      tropfenDazu(12);
    }
  }

  // Verschluckt oder über die Lippe: Die Runde ist vorbei, der Schaum rollt
  // darüber.
  function aus(wie) {
    state.schritt = "aus";
    state.schluss = wie;
    state.schrittZeit = state.zeit;
    state.halten = false;
    state.lenk = 0;
    state.stoss = 1;
    // Ein Schwall Schaum von hinten durchs Bild.
    for (let i = 0; i < (ruhig() || wie !== "schaum" ? 8 : 30); i += 1) {
      const w = Math.random() * Math.PI * 2;
      const r = (0.5 + 0.5 * Math.sqrt(Math.random())) * 2.8;
      teil(kam.x + Math.cos(w) * r, kam.y + Math.sin(w) * r * 0.8, kam.z - 1 - Math.random() * 3,
        (Math.random() - 0.5) * 3, (Math.random() - 0.5) * 3, state.v + 8 + Math.random() * 14,
        0.5 + Math.random() * 0.6, 0.6 + Math.random() * 0.8, 2.2, 0.5, 0);
    }
    if (state.phase !== "spiel") return;
    brandungStellen();
    karte(wie === "lippe" ? "Über die Lippe" : "Verschluckt", wie === "lippe" ? "Zu hoch hinaus – die Welle wirft dich ab" : "Der Schaum war schneller", "#ff9a7a", 2.2);
    ton("welle.sturz", { laut: 1 }, 400);
    kids()?.vibrate?.([20, 30, 40]);
  }

  // Die Welle läuft am Strand aus: geschafft.
  function strand() {
    state.schritt = "strand";
    state.schluss = "strand";
    state.schrittZeit = state.zeit;
    state.halten = false;
    state.lenk = 0;
    if (state.phase !== "spiel") return;
    state.roh += BONUS;
    state.punkte = Math.floor(state.roh);
    shell.setCount(state.punkte);
    karte("Am Strand", `Die Welle läuft aus · +${BONUS}`, "#ffd76a", 3.2);
    klang()?.ton?.("meilenstein");
    kids()?.vibrate?.([20, 40, 20]);
  }

  // Vor dem ersten Druck gleitet er draussen auf der Schulter und zieht
  // ruhige Bögen – die Welt läuft, die Runde noch nicht.
  function gleiten(dt) {
    const v = C0 * SANFT_FAKTOR;
    state.z0 += v * dt;
    state.zs = state.z0;
    state.zp = state.z0 + START_D + 0.6 * Math.sin(state.zeit * 0.5);
    state.h = START_H + 0.1 * Math.sin(state.zeit * 1.15);
    state.psi = 0.16 * Math.cos(state.zeit * 1.15);
    state.v = v;
  }

  // Ihre Haltung folgt dem, was sie tut: geduckt in der Röhre, beim Hinauf
  // in den Knien, beim Hinunter gestreckt, die Arme im Gleichgewicht, tief
  // in der Röhre die hintere Hand an der Wand – und das Haar im Fahrtwind.
  function haltungTakt(dt, duck, d) {
    const hal = surfer.haltung;
    const glatt = (zeit) => 1 - Math.exp(-dt / zeit);
    hal.zeit = state.zeit;
    hal.duck += (duck - hal.duck) * glatt(0.25);
    const druck = state.psi > 0 ? 0.65 * state.psi / PSI_AUF : -0.5 * Math.min(1, -state.psi / PSI_AB);
    hal.druck += (druck - hal.druck) * glatt(0.12);
    hal.arm += (clamp(state.psi / 0.5, -1, 1) - hal.arm) * glatt(0.3);
    const wand = state.schritt === "fahrt" && d < ROEHRE - 1.5 && state.h > 0.3 ? 1 : 0;
    hal.wand += (wand - hal.wand) * glatt(0.35);
    // Das Haar: Der Fahrtwind weht es nach hinten, es flattert, die
    // Schwerkraft zieht es hinab, und dreht sie, schwingt es nach.
    const wind = clamp(state.v / 14, 0.25, 1.3);
    const dreh = clamp((state.psi - surfer.psi) / Math.max(dt, 1e-4), -3, 3);
    surfer.psi = state.psi;
    const u = surfer.unten;
    const t = state.zeit;
    for (let i = 0; i < HAAR_N; i += 1) {
      const flattern = wind * (0.22 + 0.06 * i) * (ruhig() ? 0.3 : 1);
      const ziel = vNorm([
        -0.12 + u[0] * 0.55 + flattern * (0.5 * Math.sin(t * 8.3 - i * 0.9) + 0.25 * Math.sin(t * 13.7 - i * 1.5)) - dreh * 0.12,
        0.1 * wind + u[1] * 0.55 + flattern * 0.35 * Math.sin(t * 6.1 - i * 0.7),
        -wind * (0.9 + 0.05 * i) + u[2] * 0.55,
      ]);
      hal.haar[i] = vNorm(vMisch(hal.haar[i], ziel, glatt(0.05 + 0.025 * i)));
    }
  }

  function takt(dt) {
    state.zeit += dt;
    if (state.stoss > 0) state.stoss = Math.max(0, state.stoss - dt * 1.6);

    if (state.phase === "zuschauen") {
      zuschauenTakt();
    } else if (state.phase === "spiel" && state.schritt === "fahrt") {
      const n = Math.max(1, Math.ceil(dt / TAKT - 1e-9));
      for (let i = 0; i < n && state.schritt === "fahrt"; i += 1) {
        physik(dt / n);
        zaehlen(dt / n);
        if (state.zp - state.zs < 0) aus("schaum");
        else if (state.h >= 1) aus("lippe");
        else if (state.spielzeit >= DAUER) strand();
      }
    } else if (state.phase === "bereit") {
      gleiten(dt);
    }
    const seit = state.zeit - state.schrittZeit;
    if (state.schritt === "aus") {
      // Der Schaum rollt weiter, der Surfer nicht mehr.
      state.spielzeit += dt;
      state.zs += tempoBei(state.spielzeit) * 1.15 * dt;
      state.v *= Math.exp(-dt / 0.5);
      state.zp += state.v * dt;
      if (state.schluss === "lippe") state.h = Math.min(1.08, state.h + dt * 0.4);
    } else if (state.schritt === "strand") {
      // Die Welle fällt in sich zusammen, er gleitet aus.
      state.spielzeit += dt;
      state.kraft = lerp(1, 0.12, weich(0, 3, seit));
      state.zs += tempoBei(DAUER) * lerp(1, 0.3, weich(0, 2.5, seit)) * dt;
      state.v += (tempoBei(DAUER) * lerp(1.05, 0.5, weich(0.5, 3, seit)) - state.v) * (1 - Math.exp(-dt / 0.4));
      state.zp += state.v * dt;
      state.h += (0.35 - state.h) * (1 - Math.exp(-dt / 0.6));
      state.psi *= Math.exp(-dt / 0.3);
    }

    // Der Surfer im Raum, seine Haltung: geduckt unter dem Dach, und er
    // lehnt sich in die Richtung, in die er zieht.
    surferStellen(state.h, state.zp, state.psi);
    const d = state.zp - state.zs;
    const duck = state.schritt === "strand" ? 0 : weich(ROEHRE + 5, ROEHRE - 2, d) * 0.85 + 0.15 * weich(0.1, -0.4, state.psi);
    surfer.lehn += (state.psi * 0.45 - surfer.lehn) * (1 - Math.exp(-dt / 0.18));
    haltungTakt(dt, duck, d);
    if (state.schritt === "fahrt" || state.schritt === "start") spurTakt();

    // Schaum vor der Linse: je näher er ist, desto mehr – und ganz, wenn er
    // da ist.
    const weissZiel = state.schritt === "aus" ? weich(0.05, 0.7, seit) * (state.schluss === "lippe" ? weich(0.3, 1.0, seit) : 1)
      : state.schritt === "fahrt" ? 0.42 * (1 - weich(0.2, 2.6, d)) : 0;
    state.weiss += (weissZiel - state.weiss) * (1 - Math.exp(-dt / 0.12));

    kameraTakt(dt);
    gischtTakt(dt);
    nebelTakt(dt);
    spritzTakt(dt);
    teileTakt(dt);
    for (let i = schriften.length - 1; i >= 0; i -= 1) {
      schriften[i].leben -= dt;
      if (schriften[i].leben <= 0) schriften.splice(i, 1);
    }
    for (let i = tropfen.length - 1; i >= 0; i -= 1) {
      const t = tropfen[i];
      t.leben -= dt;
      t.y += t.v * dt;
      if (t.leben <= 0) tropfen.splice(i, 1);
    }
    brandungStellen();

    if (state.phase === "spiel") {
      const punkte = Math.floor(state.roh);
      if (punkte !== state.punkte) {
        state.punkte = punkte;
        shell.setCount(punkte);
      }
      gegner?.takt(state.punkte, {
        a: Math.round((state.zp - state.z0) * 100), b: Math.round(state.h * 100), c: Math.round((state.zp - state.zs) * 100),
      });
      // Erst ausrollen lassen: den Schaum, den Strand. (Neu gerechnet – der
      // Schritt kann eben erst begonnen haben.)
      const dauer = state.zeit - state.schrittZeit;
      if ((state.schritt === "aus" && dauer > 1.5) || (state.schritt === "strand" && dauer > 3.2)) finish();
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
  // Ein aufgezeichneter Lauf auf seiner eigenen Welle: Der Zufall hält die
  // Saat (geist.js, zuschauer), startRun würfelt damit dieselben Abschnitte,
  // und Surfer und Schaum stehen Bild für Bild dort, wo sie damals waren –
  // die Strecke (a), die Höhe an der Wand (b) und der Abstand zum Schaum (c).
  function zuschauenStarten() {
    if (!zuschauer?.lauf) return;
    startRun();
    state.phase = "zuschauen";
    state.schritt = "fahrt";
    state.schrittZeit = state.zeit;
    shell.setPhase("play");
    zuschauer.los();
    brandungAn();
  }

  function zuschauenTakt() {
    const s = zuschauer.stand();
    if (!s) return;
    if (state.schritt === "fahrt") {
      state.spielzeit = (s.t || 0) / 1000;
      state.zp = state.z0 + s.a / 100;
      state.h = clamp(s.b / 100, 0, 1.15);
      const d = s.c / 100;
      state.zs = state.zp - d;
      state.v = Math.max(V_MIN, (s.va || 0) / 100);
      state.psi = clamp(Math.asin(clamp(((s.vb || 0) / 100) * WAND / Math.max(4, state.v), -0.6, 0.6)), -PSI_AB, PSI_AUF);
      state.drin = d < ROEHRE;
      // Für die Anzeige: die Serie, so wie sie gewachsen wäre.
      state.serie = state.drin ? state.serie + (state.spielzeit - (state.zuletztT || 0)) : 0;
      state.zuletztT = state.spielzeit;
      if (d < 0) aus("schaum");
      else if (state.h >= 1) aus("lippe");
      else if (state.spielzeit >= DAUER) strand();
    }
    const punkte = Math.max(0, Math.floor(s.punkte));
    if (punkte !== state.punkte) {
      state.punkte = punkte;
      shell.setCount(punkte);
    }
    if (!zuschauer.weiter()) brandungAus();
  }

  // ---------------------------------------------------------------------------
  // Der Finger
  // ---------------------------------------------------------------------------
  // Die Runde beginnt mit dem ersten Druck – oder im Live-Modus zum
  // gemeinsamen Start (game-shell.js, live.los).
  function losGehts() {
    if (state.phase !== "bereit") return;
    state.phase = "spiel";
    state.schritt = "fahrt";
    state.schrittZeit = state.zeit;
    state.spielzeit = 0;
    state.psi = 0;
    state.h = clamp(state.h, START_H - 0.05, START_H + 0.05);
    state.zp = state.z0 + START_D;
    state.v = tempoBei(0) * SANFT_FAKTOR * 1.02;
    shell.setPhase("play");
    gegner?.los();
    brandungAn();
    karte("Ab in die Röhre", "Rauf und runter pumpen gibt Schwung · Punkte nur unter dem Dach");
    kids()?.vibrate?.(8);
    lenkNeu();
  }

  // Wer links hält, fährt hinauf (dort ist die Wand), wer rechts hält,
  // hinunter – und wer loslässt, fährt geradeaus. Liegen mehrere Finger,
  // gilt der zuletzt gesetzte. Ein Finger, der über die Mitte gleitet,
  // nimmt die Richtung mit.
  const finger = new Map();
  function lenkNeu() {
    let r = 0;
    for (const richtung of finger.values()) r = richtung;
    state.lenk = state.phase === "spiel" && state.schritt === "fahrt" ? r : 0;
    state.halten = state.lenk > 0;
  }

  function fingerAuf(id, richtung = 1) {
    if (state.phase === "zuschauen" || state.phase === "ende") return;
    // Ohne Bild keine Runde (ein Browser ohne WebGL 2).
    if (!bild.ok && !bild.verloren) return;
    finger.delete(id);
    finger.set(id, richtung >= 0 ? 1 : -1);
    if (state.phase === "bereit" && !shell.live) losGehts();
    lenkNeu();
  }

  function fingerZieht(id, richtung) {
    if (!finger.has(id) || finger.get(id) === richtung) return;
    finger.set(id, richtung);
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

  // Wohin ein Finger an der Stelle x (im Fenster) lenkt: links hinauf,
  // rechts hinunter.
  function richtungBei(x) {
    const r = (feld || host).getBoundingClientRect();
    return x < r.left + r.width / 2 ? 1 : -1;
  }

  // Für die Prüfskripte und die Vorführung: lenke(1) hinauf, lenke(-1)
  // hinunter, lenke(0) geradeaus. halte(an) ist lenke(1) oder lenke(0).
  function lenke(r) {
    if (r > 0) fingerAuf("pilot", 1);
    else if (r < 0) fingerAuf("pilot", -1);
    else fingerWeg("pilot");
  }
  const halte = (an) => lenke(an ? 1 : 0);

  // ---------------------------------------------------------------------------
  // Ablauf
  // ---------------------------------------------------------------------------
  function startRun() {
    stopLoop();
    brandungAus();
    shell.closeOverlay();
    zufall.neu();
    shell.setPhase("intro");
    Object.assign(state, {
      phase: "bereit", schritt: "start", schluss: "", punkte: 0, roh: 0, z0: 0, zp: START_D, zs: 0, h: START_H, psi: 0,
      v: C0 * SANFT_FAKTOR, halten: false, lenk: 0, schwungZahl: 0, zeit: 0, spielzeit: 0, serie: 0, draussen: 0, drin: false, roehrenzeit: 0,
      tiefste: ROEHRE, besteSerie: 1, stufe: 1, kraft: 1, karte: null, stoss: 0, weiss: 0, knapp: 0, schrittZeit: 0, zuletztT: 0,
    });
    state.welt = neueWelt();
    schwung.ab = false;
    schwung.zuletzt = -9;
    teile.n = 0;
    schriften.length = 0;
    tropfen.length = 0;
    spurNeu();
    finger.clear();
    shell.setCount(0);
    gegner?.runde();

    shell.clear();
    const prompt = shell.el("p", "cm-prompt wl-prompt", "Links halten – hinauf, rechts halten – hinunter. Pumpen gibt Schwung, Punkte gibt es nur in der Röhre.");
    shell.play.append(prompt, buildPlatz());
    view.cssW = 0;
    messen();
    surferStellen(state.h, state.zp, state.psi);
    surfer.haltung = haltungNeu();
    surfer.lehn = 0;
    surfer.psi = 0;
    kam.weit = KAM_WEIT;
    kameraTakt(0, true);

    last = performance.now();
    frame = window.requestAnimationFrame(loop);
  }

  function zaehleHoch(ziel) {
    const zahl = host.querySelector(".cm-result-score");
    if (!zahl) return;
    if (ruhig() || ziel <= 1) { zahl.textContent = String(ziel); return; }
    const dauer = Math.min(900, 250 + ziel * 2);
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
    brandungAus();
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
    const sekunden = Math.min(DAUER, Math.round(state.spielzeit));
    const wie = state.schluss === "strand" ? "Bis an den Strand"
      : state.schluss === "lippe" ? `Über die Lippe nach ${sekunden} s`
        : `Verschluckt nach ${sekunden} s`;
    const roehre = state.roehrenzeit > 0.5
      ? `${Math.round(state.roehrenzeit)} s in der Röhre, bis ${komma(Math.max(0, state.tiefste))} m vor dem Schaum`
      : "nie in der Röhre";
    shell.showResult({
      label: "Deine Punkte",
      points: punkte,
      detail: rekord ? "Neuer Rekord!" : [wie, roehre, vorher ? `Bestwert ${vorher}` : ""].filter(Boolean).join(" · "),
      geist,
    });
    if (rekord) host.querySelector(".cm-result-detail")?.classList.add("wl-rekord");
    zaehleHoch(punkte);
  }

  // ---------------------------------------------------------------------------
  // Start
  // ---------------------------------------------------------------------------
  shell = shellApi.mount({
    host,
    title: "Die Welle",
    area: "konzentration",
    accent: "#00A5B5",
    accentDark: "#00707c",
    clock: false,
    onRestart: () => (zuschauer ? zuschauenStarten() : startRun()),
    live: { los: losGehts, stopp: () => finish(), zuschauen: (quelle) => { zuschauer = quelle; zuschauenStarten(); } },
  });
  zuschauer = window.LernappGeist?.zuschauer?.({
    host, spiel: "waveRide", fassung: "t2", zufall, einheit: "Punkte", nochmal: zuschauenStarten,
  }) || null;
  if (!zuschauer) {
    gegner = window.LernappGeist?.fuer?.({ spiel: "waveRide", host, art: "tempo", fassung: "t2", alle: true, zufall }) || null;
  }

  grafikStarten();
  startRun();
  zuschauer?.laden.then((da) => { if (da) zuschauenStarten(); });

  // Ein Finger im Bild: Start – und solange er liegt, lenkt er: in der
  // linken Hälfte die Wand hinauf, in der rechten hinunter. Nur Knöpfe
  // bleiben Knöpfe.
  host.addEventListener("pointerdown", (event) => {
    if (event.target.closest("button, a, input")) return;
    fingerAuf(event.pointerId, richtungBei(event.clientX));
  });
  window.addEventListener("pointermove", (event) => {
    if (finger.has(event.pointerId)) fingerZieht(event.pointerId, richtungBei(event.clientX));
  });
  window.addEventListener("pointerup", (event) => fingerWeg(event.pointerId));
  window.addEventListener("pointercancel", (event) => fingerWeg(event.pointerId));
  // Wer das Fenster verlässt, lässt auch los.
  window.addEventListener("blur", alleWeg);

  // Hinauf: Pfeil nach oben oder links, W, A, Leertaste. Hinunter: Pfeil
  // nach unten oder rechts, S, D. Enter startet nur.
  const TASTEN = new Map([
    [" ", 1], ["ArrowUp", 1], ["ArrowLeft", 1], ["w", 1], ["W", 1], ["a", 1], ["A", 1],
    ["ArrowDown", -1], ["ArrowRight", -1], ["s", -1], ["S", -1], ["d", -1], ["D", -1],
  ]);
  document.addEventListener("keydown", (event) => {
    const richtung = TASTEN.get(event.key);
    if (!richtung && event.key !== "Enter") return;
    if (document.activeElement?.tagName === "BUTTON") return;
    event.preventDefault();
    if (event.repeat) return;
    if (richtung) fingerAuf(`taste${event.key.toLowerCase()}`, richtung);
    else if (state.phase === "bereit" && !shell.live) losGehts();
  });
  document.addEventListener("keyup", (event) => {
    if (TASTEN.has(event.key)) fingerWeg(`taste${event.key.toLowerCase()}`);
  });

  // Steht das Bild (die Tafel ist da), zeichnet eine neue Grösse es einmal neu.
  const neuMessen = () => {
    messen();
    if (!frame) zeichnen();
  };
  window.addEventListener("resize", neuMessen);
  window.addEventListener("orientationchange", neuMessen);
  window.addEventListener("pagehide", () => { stopLoop(); brandungAus(); });

  // Für die Prüfskripte und die Vorführung. lenke(1 | 0 | -1) lenkt hinauf,
  // geradeaus oder hinunter (halte(true | false) ist lenke(1) oder lenke(0));
  // guete(1) hält die Schärfe fest.
  window.LernappWelle = {
    TAKT, DAUER, ROEHRE, WAND, START_D, START_H, BONUS, SERIE_MAX, SERIE_VOLL, LINIE, TASCHE_NAH, REIHEN, PUMP_IDEAL,
    state, view, kam, bild, surfer, teile, schriften, takt, zeichnen, weltText, tempoBei, faktorBei, schaumBei, gischtBei,
    linie, tasche, punkteBei, malBei, formBei, ideallinie, RESERVE, losGehts, halte, lenke, haltungNeu, figurJetzt,
    guete(wert) {
      view.fest = wert !== null && wert !== undefined;
      if (view.fest) view.guete = clamp(Number(wert) || 1, 0.3, 1);
      view.cssW = 0;
    },
  };
})();
