/*
 * holzfaeller.js – Holzfäller.
 * ---------------------------------------------------------------------------
 * Holzfäller-Show auf einer Waldlichtung zur goldenen Stunde: Von unten
 * fliegen Baumstämme in hohem Bogen ins Bild, drehen sich in der Luft und
 * fallen zurück. Jeder trägt einen roten Farbstrich. Wer mit einem geraden
 * Wisch quer durch den Stamm fährt, schneidet ihn – je näher am Strich,
 * desto mehr Punkte: mitten durch den Strich ist «Perfekt» (10), daneben
 * gibt es 9 bis 1, je nach Abstand. Die Maus schneidet genauso (Taste
 * drücken, ziehen, loslassen). Die Leertaste wirft nur den ersten Stamm hoch.
 *
 * Ein Schnitt zählt, wenn die Klinge den Stamm ganz durchquert – auf der
 * einen Längsseite hinein, auf der anderen hinaus – und dabei schnell genug
 * ist: Ein Finger, der still liegt, schneidet nicht. Wo die Klinge die Mitte
 * der sichtbaren Seite kreuzt, dort ist der Schnitt. Eine Klinge kann in
 * einem Zug mehrere Stämme schneiden.
 *
 * Perfekte Schnitte in Folge sind eine Serie: Ab dem dritten zählt jeder
 * Schnitt doppelt, ab dem sechsten dreifach, bis fünffach. Ein Schnitt, der
 * nicht perfekt ist, beendet die Serie. Goldene Stämme zählen doppelt.
 *
 * Fehler kosten eine der drei Äxte oben rechts; ohne Axt ist Feierabend:
 *   Verpasst  ein Stamm mit offenem Strich fällt hinunter,
 *   Daneben   der Schnitt liegt weit neben dem Strich (mehr als DANEBEN),
 *   Ast       die Klinge fährt durch einen Astknoten,
 *   Nagel     die Klinge fährt durch einen Nagelstamm – Stämme mit
 *             Eisenbändern und Nägeln tragen keinen Strich und bleiben ganz.
 *
 * Schwerer wird es Welle um Welle: Die Stämme fliegen schneller (mehr
 * Schwerkraft), drehen sich stärker, kommen zu zweit und zu dritt, tragen
 * Äste immer näher am Strich, und dazwischen fliegen Nagelstämme. Stämme mit
 * zwei Strichen brauchen zwei Schnitte: Nach dem ersten fliegt das Stück mit
 * dem zweiten Strich noch einmal hoch. Die nächste Welle kommt, sobald die
 * letzte erledigt ist, spätestens nach ihrer Zeit. Nie stehen mehr als drei
 * Schnitte in einer Welle an.
 *
 * Die Welt – jeder Stamm, sein Wurf, seine Striche, Äste und Nägel – kommt
 * aus dem Zufall (zufall.js), Welle für Welle, und jede Welle zieht immer
 * gleich viele Zahlen: ohne Turnier jede Runde anders, im Turnier für alle
 * im selben Versuch dieselbe.
 *
 * Gerechnet wird in festen Schritten (TAKT, 240 je Sekunde) und in
 * Welteinheiten: x von der Mitte nach rechts, y vom vorderen Rand der
 * Lichtung nach oben. Das Feld (FELD_HALB, OBEN) steht in jeder Form ganz im
 * Bild; hochkant steht mehr Himmel darüber, quer mehr Wald daneben.
 *
 * Gegner und Wiedergabe: Das Spiel hat keine Figur. Jeder Schnitt ist ein
 * Zug (geist.js, zuege; live-spiel.js, zug) – mit dem Schritt, in dem er
 * geschah, dem Stück, der Stelle und dem Winkel der Klinge. Wer zuschaut
 * (Hall of Fame, Multiplayer), baut mit derselben Saat dieselbe Welt und
 * setzt jeden Schnitt in genau seinem Schritt ein; dazwischen rechnet er
 * dieselben Schritte. So fliegen dieselben Stämme und dieselben Hälften, und
 * am Schluss steht derselbe Endstand. Platz 1 und die eigene Bestmarke
 * stehen oben als Zielmarke (geist.js, art "ziel").
 *
 * Gezeichnet wird auf eine Leinwand. Himmel, Wald, Lichtung, Vordergrund,
 * Sonnenstrahlen, Rinde und Jahresringe sind einmal je Bildgrösse vorgemalt;
 * je Bild wird nur kopiert, gedreht und gestreckt.
 */
(() => {
  "use strict";

  if (document.body.dataset.page !== "lumber") return;

  const host = document.querySelector("#hl-stage");
  const shellApi = window.LernappGameShell;
  const cloudApi = window.LernappGameCloud;
  if (!host || !shellApi) return;

  const kids = () => window.LernappKids || null;
  // Wer weniger Bewegung eingestellt hat, bekommt kein Wackeln, keine
  // Blitze, keine Zeitlupe und weniger Späne. Die Stämme fliegen trotzdem.
  const ruhig = () => Boolean(kids()?.prefersReducedMotion?.());

  // Der Zufall. Ohne Turnier in der Adresse ist das Math.random; im Turnier
  // und im Live-Modus bekommt jeder dieselben Wellen. Nur der Plan zieht
  // daraus – Späne, Funken und das Taumeln der fertigen Stücke würfeln
  // Math.random oder hängen an einer festen Zahl (hash01).
  const zufall = window.LernappZufall?.fuer?.("lumberCut") || { neu() {}, zahl: () => Math.random() };

  // ---------------------------------------------------------------------------
  // Die Welt
  // ---------------------------------------------------------------------------
  const TAKT = 1 / 240;            // ein Schritt der Rechnung
  const FELD_HALB = 150;           // das Feld reicht von x = -150 bis 150
  const BODEN = 30;                // so viel steht unter dem vorderen Rand im Bild
  const OBEN = 380;                // so hoch reicht das Feld, das immer im Bild steht
  const SICHT_W = 2 * FELD_HALB + 24;
  const SICHT_H = OBEN + BODEN;
  const HORIZONT = 70;             // dort endet die Lichtung hinten, und der Wald beginnt
  const START_Y = -125;            // dort beginnen die Würfe, unter dem Bild
  const SCHWEBE_Y = 200;           // dort schwebt der erste Stamm vor dem Start
  const AUFHOLEN_MAX = 48;         // so viele Schritte holt ein Bild höchstens auf

  // Der Schnitt und die Punkte (in Einheiten entlang des Stamms).
  const PERFEKT = 3.5;             // halbe Breite des roten Strichs: so nah ist «Perfekt»
  const DANEBEN = 24;              // weiter weg ist der Schnitt ein Fehler – anfangs; später enger (danebenBei)
  const KLINGE_MIN = 100;          // so schnell muss die Klinge sein (Einheiten je s)
  const LEBEN = 3;                 // drei Äxte
  const SERIE_JE = 3;              // so viele Perfekte in Folge für den nächsten Faktor
  const FAKTOR_MAX = 5;
  const TRENN = 55;                // so schnell fliegen zwei Hälften auseinander
  const SCHUB = 45;                // so stark schiebt die Klinge sie mit
  const DREH = 2.6;                // so stark drehen sie sich vom Schnitt weg
  const RAST_HUB = 70;             // so hoch fliegt ein Stück mit offenem Strich noch

  // Der Plan: Welle um Welle, jede zieht ZAHLEN_JE_WELLE Zahlen.
  const ZAHLEN_JE_WELLE = 100;
  const ZAHLEN_JE_STAMM = 18;
  const ZWEI_AB = 3;               // ab dieser Welle manchmal zwei Stämme
  const AST_AB = 4;                // … Äste
  const GOLD_AB = 6;               // … goldene Stämme
  const NAGEL_AB = 8;              // … Nagelstämme
  const DOPPEL_AB = 12;            // … Stämme mit zwei Strichen
  const DREI_AB = 18;              // … drei Stämme
  const VIER_AB = 45;              // … vier Stämme
  const FRUEH = Math.round(0.4 / TAKT);       // so lange nach dem letzten Schnitt kommt die nächste Welle früher
  const MIN_LUECKE = Math.round(0.7 / TAKT);  // so kurz ist der Abstand zweier Wellen höchstens

  // Die Bilder im Speicher.
  const STREIFEN_L = 360;          // so lang ist ein vorgemalter Rindenstreifen
  const R_TEX = 16;                // und so dick
  const TEILE_MAX = 320;

  const TOP_COUNT = 5;
  const store = cloudApi
    ? cloudApi.register({ key: "lernapp.holzfaeller", empty: { runs: 0, scores: [] }, merge: cloudApi.mergeScores(TOP_COUNT) })
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
  // Wie viel vom Schweren schon da ist: 0 am Anfang, gegen 1.
  const schwereBei = (w) => 1 - Math.exp(-w / 22);
  // Die Schwerkraft wächst erst schnell, dann stetig weiter, ohne Deckel:
  // Die Stämme fliegen schneller und kürzer.
  const gBei = (w) => 430 + 520 * schwereBei(w) + 3 * w;
  const drehBei = (w) => 0.35 + 2.6 * schwereBei(w) + 0.008 * w;
  const lueckeBei = (w) => Math.max(1.1, 2.55 - 1.45 * schwereBei(w));
  // So nah darf ein Ast an einen Strich: anfangs weit weg, später knapp.
  const astAbstandBei = (w) => Math.max(6.5, 20 - 15 * schwereBei(w));
  // Ab wann ein Schnitt «daneben» ist: anfangs grosszügig, später eng.
  const danebenBei = (w) => Math.max(12, DANEBEN - 13 * schwereBei(w));
  // So viele Schnitte verlangt eine Welle höchstens – nie mehr, als eine
  // ruhige, schnelle Hand in ihrer Zeit schafft.
  const schnitteBei = (w) => (w < 30 ? 3 : 4);

  // Immer dieselbe Zahl zu derselben Eingabe – für Bäume, Rinde und Späne,
  // ohne den Zufall anzufassen.
  function hash01(n) {
    const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return x - Math.floor(x);
  }

  // Aus einer Zahl des Zufalls eine Kette weiterer – ganzzahlig gerechnet
  // (mulberry32), also auf jedem Gerät dieselben. Damit würfelt ein Stamm
  // seine Äste und Nägel, ohne dass die Welle mehr Zahlen zieht.
  function kette(z) {
    let a = Math.floor(z * 4294967296) >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // ---------------------------------------------------------------------------
  // Zustand
  // ---------------------------------------------------------------------------
  // phase: "bereit" (der erste Stamm schwebt), "spiel", "zuschauen", "ende".
  // aus:   die dritte Axt ist weg – die Stücke fliegen noch, geschnitten wird
  //        nicht mehr.
  const state = {
    phase: "bereit",
    aus: false,
    fertig: false,
    tick: 0,
    losMs: 0,
    uhrRest: 0,
    punkte: 0,
    schnitte: 0,
    perfekte: 0,
    serie: 0,
    besteSerie: 0,
    fehler: 0,
    grund: "",
    plan: { wellen: [], stamme: [] },
    welle: 1,             // die nächste Welle, die losfliegt
    welleTick: 0,         // wann die letzte losflog
    welleBis: 0,          // wann ihr letzter Stamm losflog
    letzteAktion: 0,      // wann zuletzt geschnitten wurde oder etwas fiel
    wartend: [],          // Stämme der Welle, die gleich losfliegen
    stuecke: [],          // was in der Luft ist: Stämme und Stücke
    naechsteId: 1,
    erstmals: {},         // welche Neuheit schon angesagt ist
    // Nur fürs Bild:
    schriften: [],
    ringe: [],
    banner: null,
    stoss: 0,
    blitz: 0,
    blitzFarbe: "255, 214, 120",
    lupe: 1,
    echt: 0,
    anzeige: 0,
    pop: 0,
    axtWeg: [-9, -9, -9],
    letztePerfekt: -9,
    // Was geschah, Schritt für Schritt – Schnitte und Fehler. Die Prüfung
    // vergleicht es mit der Wiedergabe.
    protokoll: [],
  };

  let shell = null;
  let feld = null;
  let canvas = null;
  let g = null;
  let frame = null;
  let last = 0;
  let stepTimer = null;
  let promptKnoten = null;
  // Die Gegner (geist.js): Platz 1 und die eigene Bestmarke als Zielmarke.
  let gegner = null;
  // Die Aufzeichnung der Züge (geist.js, zuege) und wer gerade eine Runde
  // anschaut (geist.js, zuschauer – oder im Multiplayer die Quelle des
  // anderen).
  let aufnahme = null;
  let zuschauer = null;
  let gesehenBis = -Infinity;
  let zugListe = [];
  let zugNaechster = 0;
  let zugAnker = -1;

  const view = { s: 1, dpr: 1, cssW: 0, cssH: 0, w: SICHT_W, h: SICHT_H, frei: 0, camX: 0, camY: -BODEN };

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
  // in echter Zeit: Ein Wisch durch drei Stämme klingt einmal, und die
  // Prüfskripte, die viele Schnitte am Stück rechnen, bleiben leise.
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

  // Der Wald im Hintergrund: Vögel und Wind, solange die Runde läuft – nach
  // der dritten Axt ist Feierabend.
  const wald = schleife("holzfaeller.wald");
  function klangTakt() {
    const an = !state.aus && (state.phase === "spiel" || (state.phase === "zuschauen" && !zuschauer?.fertig?.()));
    if (an) wald.an(0.4, 0.8);
    else wald.aus();
  }

  // ---------------------------------------------------------------------------
  // Der Plan
  // ---------------------------------------------------------------------------
  /*
   * Welle um Welle, und jede zieht genau ZAHLEN_JE_WELLE Zahlen: acht für die
   * Welle (wie viele Stämme, ob ein Nagelstamm, ein Doppelstrich, ein
   * goldener dabei ist, Reihenfolge, Abstände) und je ZAHLEN_JE_STAMM für bis
   * zu fünf Stämme. So hängt der Plan nur an der Saat.
   *
   * Wie viele: erst einer, ab Welle 3 manchmal zwei, ab 18 auch drei, ab 45
   * drei oder vier, dazu ab Welle 8 oft ein Nagelstamm. Ein Doppelstrich
   * zählt als zwei Schnitte; mehr als schnitteBei verlangt keine Welle.
   *
   * Ein Stamm fliegt auf einer Wurfparabel: von x0 unter dem Bild hinauf zum
   * Scheitel (xp, yp) und wieder hinunter. Der Scheitel liegt so, dass er
   * immer ganz im Feld bleibt, und die Plätze einer Welle sind über das Feld
   * verteilt. Der Winkel ist so gewählt, dass er im Scheitel steht, wie der
   * Plan es will (anfangs fast waagrecht, später beliebig).
   */
  function neueWelle() {
    const p = state.plan;
    const w = p.wellen.length;
    const z = [];
    for (let i = 0; i < ZAHLEN_JE_WELLE; i += 1) z.push(zufall.zahl());
    const s = schwereBei(w);
    const g0 = gBei(w);
    const welle = { nr: w, g: g0, stamme: [] };
    const stammZahlen = (k) => z.slice(8 + k * ZAHLEN_JE_STAMM, 8 + (k + 1) * ZAHLEN_JE_STAMM);
    if (w === 0) {
      welle.stamme.push(ersterStamm(stammZahlen(0)));
    } else {
      let n = 1;
      if (w >= VIER_AB) n = 3 + (z[0] < 0.6 ? 1 : 0);
      else if (w >= DREI_AB) n = 2 + (z[0] < (w >= 30 ? 0.7 : 0.4) ? 1 : 0);
      else if (w >= 8) n = 1 + (z[0] < 0.75 ? 1 : 0);
      else if (w >= ZWEI_AB) n = 1 + (z[0] < 0.4 ? 1 : 0);
      const nagel = w >= NAGEL_AB && z[1] < 0.3 + 0.3 * s ? 1 : 0;
      // Ein Doppelstrich nur, wenn die Welle dann nicht mehr Schnitte verlangt als erlaubt.
      const doppelt = w >= DOPPEL_AB && n < schnitteBei(w) && z[2] < 0.2 + 0.25 * s ? Math.floor(z[3] * n) : -1;
      const gold = w >= GOLD_AB && z[4] < 0.14 ? Math.floor(z[5] * n) : -1;
      const m = n + nagel;
      const r = kette(z[6]);
      // Welche Art in welcher Reihenfolge fliegt, und auf welchem Platz.
      const arten = [];
      for (let k = 0; k < m; k += 1) arten.push(k < n ? "holz" : "nagel");
      const plaetze = arten.map((_, k) => k);
      for (const liste of [arten, plaetze]) {
        for (let i = liste.length - 1; i > 0; i -= 1) {
          const j = Math.floor(r() * (i + 1));
          [liste[i], liste[j]] = [liste[j], liste[i]];
        }
      }
      let versatz = 0;
      let holz = 0;
      for (let k = 0; k < m; k += 1) {
        const art = arten[k];
        const nr = art === "holz" ? holz : -2;
        if (art === "holz") holz += 1;
        welle.stamme.push(stammVorlage(w, s, g0, stammZahlen(k), {
          art, platz: plaetze[k], von: m, doppelt: nr === doppelt, gold: nr === gold, versatz,
        }));
        versatz += Math.max(0.14, lerp(0.26, 0.5, z[7] * 0.5 + r() * 0.5) - 0.14 * s);
      }
    }
    p.wellen.push(welle);
    welle.stamme.forEach((st) => { st.nr = p.stamme.length; p.stamme.push(st); });
  }

  const SORTEN = ["eiche", "birke", "foehre"];

  // Der erste Stamm: Er schwebt vor dem Start mitten im Bild, waagrecht, mit
  // seinem Strich – wer ihn schneidet, beginnt die Runde.
  function ersterStamm(zz) {
    const L = 124;
    return {
      welle: 0, versatz: 0, art: "holz", variante: SORTEN[Math.floor(zz[12] * 3)], L, R: 15, g: gBei(0),
      x0: 0, xp: 0, yp: SCHWEBE_Y, vx: 0, vy0: 0, om: 0, w0: 0, kipp: 0.3,
      marken: [(zz[10] * 2 - 1) * 0.2 * L], knoten: [], naegel: [], baender: [], daneben: DANEBEN,
      gold: false, doppelt: false, rOff: zz[17] * (STREIFEN_L - L - 2), schwebt: true,
    };
  }

  function stammVorlage(w, s, g0, zz, { art, platz, von, doppelt, gold, versatz }) {
    const L = lerp(108, 136, zz[3]);
    const R = lerp(12.5, 16, zz[4]);
    // Der Scheitel: auf seinem Platz, und so, dass Anfang und Ende des Wurfs
    // im Feld liegen (|x| ≤ 100 – dann steht auch jeder Strich hochkant im Bild).
    const basis = von === 1 ? lerp(-50, 50, zz[0]) : -70 + (140 * (platz + 0.5)) / von + (zz[0] - 0.5) * 30;
    let xp = clamp(basis, -90, 90);
    let x0 = clamp(xp + (zz[1] - 0.5) * 120, -100, 100);
    if (2 * xp - x0 > 100) x0 = 2 * xp - 100;
    if (2 * xp - x0 < -100) x0 = 2 * xp + 100;
    x0 = clamp(x0, -100, 100);
    xp = clamp(xp, (x0 - 100) / 2, (x0 + 100) / 2);
    // Der Scheitel bleibt so tief, dass auch ein senkrechter Stamm unter OBEN bleibt.
    const yp = w < 5 ? lerp(220, 275, zz[2]) : lerp(175, 292, zz[2]);
    const vy0 = Math.sqrt(2 * g0 * (yp - START_Y));
    const tp = vy0 / g0;
    const om = (zz[6] < 0.5 ? -1 : 1) * drehBei(w) * lerp(0.65, 1.2, zz[5]);
    const wScheitel = w < 5 ? (zz[7] - 0.5) * 0.6 : (zz[7] - 0.5) * Math.PI;
    const variante = art === "nagel" ? "nagel" : gold ? "gold" : SORTEN[Math.floor(zz[12] * 3)];
    const marken = [];
    if (art !== "nagel") {
      if (doppelt) marken.push(-lerp(0.17, 0.4, zz[10]) * L, lerp(0.17, 0.4, zz[11]) * L);
      else marken.push((zz[10] * 2 - 1) * (0.18 + 0.2 * s) * L);
    }
    // Äste: nie zu nah an einem Strich, nie aufeinander.
    const knoten = [];
    if (w >= AST_AB && zz[13] < 0.45 + 0.45 * s) {
      const r = kette(zz[14]);
      const anzahl = 1 + Math.floor(r() * (1 + 2 * s));
      const abstand = astAbstandBei(w);
      for (let versuch = 0; versuch < 10 && knoten.length < anzahl; versuch += 1) {
        const rk = lerp(3.8, 5.6, r());
        const u = lerp(-0.42, 0.42, r()) * L;
        const a = lerp(0.6, 2.55, r());
        if (marken.some((m) => Math.abs(u - m) < abstand + rk)) continue;
        if (knoten.some((k) => Math.abs(u - k.u) < k.r + rk + 4)) continue;
        knoten.push({ u, a, r: rk });
      }
    }
    // Der Nagelstamm: zwei Eisenbänder und vier, fünf Nägel.
    const naegel = [];
    const baender = [];
    if (art === "nagel") {
      const r = kette(zz[15]);
      baender.push(-lerp(0.26, 0.34, r()) * L, lerp(0.26, 0.34, r()) * L);
      const anzahl = 4 + Math.floor(r() * 2);
      for (let i = 0; i < anzahl; i += 1) naegel.push({ u: lerp(-0.42, 0.42, (i + r() * 0.8) / anzahl) * L, a: lerp(0.55, 2.6, r()) });
    }
    return {
      welle: w, versatz, art, variante, L, R, g: g0, x0, xp, yp, vx: (xp - x0) / tp, vy0,
      om, w0: wScheitel - om * tp, kipp: (zz[8] < 0.5 ? -1 : 1) * lerp(0.22, 0.36, zz[9]),
      marken, knoten, naegel, baender, daneben: danebenBei(w), gold: Boolean(gold), doppelt: Boolean(doppelt),
      rOff: zz[17] * (STREIFEN_L - L - 2), schwebt: false,
    };
  }

  function planBis(w) {
    while (state.plan.wellen.length <= w) neueWelle();
  }

  // ---------------------------------------------------------------------------
  // Stämme und Stücke
  // ---------------------------------------------------------------------------
  /*
   * Ein Stück ist ein Stamm oder ein Teil davon: der Abschnitt [u0, u1] des
   * Stamms (u entlang der Achse, von seiner Mitte aus), mit Ort (x, y) seiner
   * Mitte, Tempo, Winkel w (gegen den Uhrzeiger, y oben) und Drehung om. kipp
   * dreht ihn ein wenig aus dem Bild heraus, damit eine Stirnseite zu sehen
   * ist; fertige Stücke taumeln (kippW). Was entlang der Achse liegt,
   * erscheint im Bild um cos(kipp) verkürzt, und was vorne auf der Rinde
   * liegt (Strich, Äste), um R · sin(kipp) zur fernen Stirnseite verschoben.
   */
  function neuesStueck(v, u0, u1) {
    return {
      id: state.naechsteId++, v, variante: v.variante, L: v.L, R: v.R, g: v.g,
      u0, u1, mitte: (u0 + u1) / 2,
      x: 0, y: 0, vx: 0, vy: 0, w: 0, om: 0, kipp: v.kipp, kippW: 0,
      marken: [], nagel: v.art === "nagel", getroffen: false, fertig: false, offen: false, schwebt: false,
      endeA: "alt", endeB: "alt", glanzA: 0, glanzB: 0, weg: false,
    };
  }

  // Ein Stamm aus dem Plan fliegt los.
  function wirf(v) {
    const p = neuesStueck(v, -v.L / 2, v.L / 2);
    p.x = v.x0;
    p.y = START_Y;
    p.vx = v.vx;
    p.vy = v.vy0;
    p.w = v.w0;
    p.om = v.om;
    p.marken = v.marken.map((u) => ({ u, offen: true }));
    p.offen = p.marken.length > 0;
    if (v.schwebt) {
      p.x = 0;
      p.y = SCHWEBE_Y;
      p.vx = 0;
      p.vy = 0;
      p.w = 0;
      p.om = 0;
      p.schwebt = true;
    }
    state.stuecke.push(p);
    return p;
  }

  // Der erste Stamm fliegt ohne Schnitt los: Leertaste oder Live-Start.
  function ersterWurf() {
    const p = state.stuecke.find((x) => x.schwebt);
    if (!p) return;
    p.schwebt = false;
    p.vy = 230;
    p.om = 0.5;
  }

  // Wo im Bild des Stücks (x entlang der Achse, verkürzt; v quer) ein Punkt
  // der Welt liegt.
  function lokal(p, wx, wy) {
    const dx = wx - p.x;
    const dy = wy - p.y;
    const c = Math.cos(p.w);
    const s = Math.sin(p.w);
    return { x: dx * c + dy * s, v: -dx * s + dy * c };
  }

  // Und zurück: ein Punkt im Bild des Stücks als Ort in der Welt.
  function weltVon(p, x, v) {
    const c = Math.cos(p.w);
    const s = Math.sin(p.w);
    return { x: p.x + x * c - v * s, y: p.y + x * s + v * c };
  }

  // Der Ort auf der sichtbaren Seite (Mitte der Rinde), der zu u gehört.
  function vorneX(p, u) {
    return (u - p.mitte) * Math.cos(p.kipp) - p.R * Math.sin(p.kipp);
  }

  // Wie weit ein Stück über und unter seiner Mitte reicht.
  function ausdehnungY(p) {
    const hl = ((p.u1 - p.u0) / 2) * Math.abs(Math.cos(p.kipp));
    return Math.abs(Math.sin(p.w)) * hl + p.R * (1 + Math.abs(Math.sin(p.kipp)) * 0.4) + 2;
  }

  // ---------------------------------------------------------------------------
  // Die Fläche
  // ---------------------------------------------------------------------------
  function buildPlatz() {
    feld = shell.el("div", "hl-feld");
    canvas = document.createElement("canvas");
    canvas.className = "hl-canvas";
    canvas.setAttribute("aria-hidden", "true");
    feld.append(canvas);
    g = canvas.getContext("2d");
    return feld;
  }

  function messen() {
    if (!canvas || !feld) return;
    const cssW = Math.max(80, feld.clientWidth);
    const cssH = Math.max(80, feld.clientHeight);
    const dpr = clamp(window.devicePixelRatio || 1, 1, 2);
    // Auf dem Handy reicht die Leinwand unter die Knöpfe oben (game-shell.js,
    // frei). Gemalt wird dort auch – aber das Feld steht darunter.
    const frei = Math.min(cssH * 0.4, shell?.frei?.(canvas) || 0);
    if (cssW === view.cssW && cssH === view.cssH && dpr === view.dpr && frei === view.frei) return;
    view.cssW = cssW;
    view.cssH = cssH;
    view.dpr = dpr;
    view.frei = frei;
    const nutzH = cssH - frei;
    // Das ganze Feld steht immer im Bild, gleich gross in Welteinheiten.
    view.s = Math.min(cssW / SICHT_W, nutzH / SICHT_H);
    view.w = cssW / view.s;
    view.h = cssH / view.s;
    view.camX = -view.w / 2;
    view.camY = -BODEN;
    const pw = Math.round(cssW * dpr);
    const ph = Math.round(cssH * dpr);
    if (canvas.width !== pw) canvas.width = pw;
    if (canvas.height !== ph) canvas.height = ph;
    bilder.schluessel = "";
    lichter.length = 0;
  }

  const wackelX = () => (ruhig() ? 0 : Math.cos(state.echt * 57) * 3 * state.stoss);
  const wackelY = () => (ruhig() ? 0 : Math.sin(state.echt * 73) * 4.5 * state.stoss);

  function flachTransform() {
    g.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
  }

  function bildTransform() {
    g.setTransform(view.dpr, 0, 0, view.dpr, wackelX() * view.dpr, wackelY() * view.dpr);
  }

  const bildX = (x) => (x - view.camX) * view.s;
  const bildY = (y) => view.cssH - (y - view.camY) * view.s;
  const weltX = (sx) => sx / view.s + view.camX;
  const weltY = (sy) => (view.cssH - sy) / view.s + view.camY;

  // ---------------------------------------------------------------------------
  // Die gemalten Bilder im Speicher
  // ---------------------------------------------------------------------------
  /*
   * Was sich nicht bewegt, liegt fertig gemalt in Leinwänden, genau so gross
   * wie die Leinwand im Bild: der Hintergrund (Himmel, Sonne, Berge, Wald,
   * Lichtung mit Holzstapeln und Fahnen), der Vordergrund (Farne unten, die
   * Ecken etwas dunkler) und die Sonnenstrahlen (halbe Auflösung). Dazu die
   * Rinde je Holzart als langer Streifen, aus dem jedes Stück seinen
   * Abschnitt nimmt, und die Stirnseiten mit ihren Jahresringen – alt und
   * frisch geschnitten.
   */
  const bilder = { schluessel: "", hinten: null, vorne: null, strahlen: null, rinde: {}, rindeQ: 0 };
  const scheiben = {};
  let lichtStreifen = null;
  const lichter = [];

  function leinwand(w, h, q) {
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.ceil(w * q));
    c.height = Math.max(1, Math.ceil(h * q));
    const cg = c.getContext("2d");
    cg.scale(q, q);
    return { c, g: cg };
  }

  // Eine Leinwand so gross wie die im Bild, in CSS-Pixeln bemalt.
  function bildLeinwand(q = view.dpr) {
    const { c, g: cg } = leinwand(view.cssW, view.cssH, q);
    if (q === view.dpr && (c.width !== canvas.width || c.height !== canvas.height)) {
      c.width = canvas.width;
      c.height = canvas.height;
      cg.scale(c.width / view.cssW, c.height / view.cssH);
    }
    return { c, g: cg };
  }

  function sicherBilder() {
    const schluessel = `${view.cssW}|${view.cssH}|${view.dpr}|${view.s}`;
    if (bilder.schluessel === schluessel && bilder.hinten) return;
    bilder.schluessel = schluessel;
    bilder.hinten = maleHintergrund();
    bilder.vorne = maleVordergrund();
    bilder.strahlen = maleStrahlen();
    const q = Math.min(3.2, Math.round(view.s * view.dpr * 20) / 20);
    if (q !== bilder.rindeQ) {
      bilder.rindeQ = q;
      bilder.rinde = {};
    }
  }

  // Die Sonne: tief, rechts, halb hinter den Tannen.
  const sonneX = () => view.cssW * (view.cssW > view.cssH ? 0.74 : 0.7);
  const sonneY = () => bildY(HORIZONT + 78);

  const HIMMEL = ["#1c2c55", "#3d4a7b", "#b56579", "#f19a5c", "#ffd98c"];

  // Eine Tanne als Schattenriss: sechs Etagen, unten breit, oben spitz.
  function tanne(cg, x, fuss, hoch, breit) {
    cg.beginPath();
    const stufen = 6;
    for (let i = 0; i < stufen; i += 1) {
      const k = i / stufen;
      const unten = fuss - hoch * (0.08 + k * 0.78);
      const oben = unten - hoch * (0.3 - k * 0.08);
      const b = breit * 0.5 * (1 - k * 0.8);
      cg.moveTo(x - b, unten);
      cg.quadraticCurveTo(x - b * 0.3, unten - (unten - oben) * 0.5, x, oben);
      cg.quadraticCurveTo(x + b * 0.3, unten - (unten - oben) * 0.5, x + b, unten);
      cg.quadraticCurveTo(x, unten - hoch * 0.03, x - b, unten);
    }
    cg.rect(x - breit * 0.045, fuss - hoch * 0.1, breit * 0.09, hoch * 0.1);
    cg.fill();
  }

  // Eine Bergkette als Linie aus zwei Wellen.
  function kamm(cg, basis, hoehe, f1, f2, phase, farbe) {
    cg.fillStyle = farbe;
    cg.beginPath();
    cg.moveTo(0, view.cssH);
    for (let x = 0; x <= view.cssW + 8; x += 6) {
      const wx = weltX(x);
      cg.lineTo(x, basis - hoehe * (0.55 + 0.3 * Math.sin(wx * f1 + phase) + 0.15 * Math.sin(wx * f2 + phase * 2.3)));
    }
    cg.lineTo(view.cssW, view.cssH);
    cg.closePath();
    cg.fill();
  }

  // Die Stirnseite eines Stamms als Scheibe: Rinde aussen, Jahresringe,
  // Kern, ein, zwei Risse. Alt (an den Enden des Stamms, verwittert) oder
  // frisch (eben geschnitten, hell).
  const SCHEIBE_FARBEN = {
    eiche: { holz: "#e7bf84", rand: "#d3a564", kern: "#c58f52", ring: "120, 74, 30", rinde: "#4a3320" },
    birke: { holz: "#f2e3c2", rand: "#e2cd9f", kern: "#d9b98a", ring: "150, 112, 60", rinde: "#e8e2d4" },
    foehre: { holz: "#f0c98e", rand: "#e0ac68", kern: "#cf8a4e", ring: "150, 80, 30", rinde: "#6a341c" },
    gold: { holz: "#ffe08a", rand: "#f2c04e", kern: "#e3a63a", ring: "150, 96, 20", rinde: "#8a5a14" },
    nagel: { holz: "#c9aa80", rand: "#b08e62", kern: "#9c7a50", ring: "90, 64, 34", rinde: "#3a3430" },
  };

  function scheibe(sorte, frisch) {
    const schluessel = `${sorte}|${frisch ? 1 : 0}`;
    if (scheiben[schluessel]) return scheiben[schluessel];
    const D = 128;
    const r = 61;
    const { c, g: cg } = leinwand(D, D, 1);
    const F = SCHEIBE_FARBEN[sorte] || SCHEIBE_FARBEN.eiche;
    cg.translate(D / 2, D / 2);
    cg.fillStyle = F.rinde;
    cg.beginPath();
    cg.arc(0, 0, r, 0, Math.PI * 2);
    cg.fill();
    if (sorte === "birke") {
      cg.strokeStyle = "#3a332c";
      cg.lineWidth = 1.5;
      cg.beginPath();
      cg.arc(0, 0, r - 1, 0, Math.PI * 2);
      cg.stroke();
    }
    const innen = r * 0.88;
    const holz = cg.createRadialGradient(0, 0, 0, 0, 0, innen);
    holz.addColorStop(0, F.kern);
    holz.addColorStop(0.45, F.holz);
    holz.addColorStop(1, F.rand);
    cg.fillStyle = holz;
    cg.beginPath();
    cg.arc(0, 0, innen, 0, Math.PI * 2);
    cg.fill();
    // Die Jahresringe: leicht unrund, jeder dritte kräftiger.
    const n = 15;
    for (let i = 1; i < n; i += 1) {
      const rr = innen * Math.pow(i / n, 0.9);
      cg.strokeStyle = `rgba(${F.ring}, ${0.22 + (i % 3 === 0 ? 0.22 : 0) + hash01(i * 3.1 + sorte.length) * 0.12})`;
      cg.lineWidth = i % 4 === 0 ? 1.7 : 0.9;
      cg.beginPath();
      for (let k = 0; k <= 60; k += 1) {
        const a = (k / 60) * Math.PI * 2;
        const wob = 1 + Math.sin(a * 3 + i * 1.7) * 0.02 + Math.sin(a * 7 + i) * 0.012 + (i / n) * Math.sin(a * 2 + 1) * 0.03;
        const x = Math.cos(a) * rr * wob;
        const y = Math.sin(a) * rr * wob;
        if (k) cg.lineTo(x, y);
        else cg.moveTo(x, y);
      }
      cg.stroke();
    }
    cg.fillStyle = `rgba(${F.ring}, 0.7)`;
    cg.beginPath();
    cg.arc(1.5, -1, 2.6, 0, Math.PI * 2);
    cg.fill();
    // Risse vom Kern nach aussen.
    cg.strokeStyle = `rgba(${F.ring}, ${frisch ? 0.45 : 0.75})`;
    cg.lineWidth = frisch ? 1 : 1.6;
    const risse = frisch ? 1 : 3;
    for (let i = 0; i < risse; i += 1) {
      const a = hash01(i * 5.7 + sorte.length * 2) * Math.PI * 2;
      cg.beginPath();
      cg.moveTo(Math.cos(a) * 4, Math.sin(a) * 4);
      cg.lineTo(Math.cos(a + 0.08) * innen * 0.5, Math.sin(a + 0.08) * innen * 0.5);
      cg.lineTo(Math.cos(a - 0.03) * innen * (0.75 + hash01(i) * 0.2), Math.sin(a - 0.03) * innen * (0.75 + hash01(i) * 0.2));
      cg.stroke();
    }
    // Licht von oben links, und das Alte etwas grauer und dunkler.
    const licht = cg.createLinearGradient(-r, -r, r, r);
    licht.addColorStop(0, frisch ? "rgba(255, 250, 230, 0.35)" : "rgba(255, 240, 210, 0.12)");
    licht.addColorStop(0.55, "rgba(0, 0, 0, 0)");
    licht.addColorStop(1, "rgba(40, 20, 0, 0.28)");
    cg.fillStyle = licht;
    cg.beginPath();
    cg.arc(0, 0, r, 0, Math.PI * 2);
    cg.fill();
    if (!frisch) {
      cg.fillStyle = "rgba(70, 58, 50, 0.3)";
      cg.beginPath();
      cg.arc(0, 0, innen, 0, Math.PI * 2);
      cg.fill();
    }
    scheiben[schluessel] = c;
    return c;
  }

  // Die Rinde je Holzart als langer Streifen (STREIFEN_L × 2·R_TEX
  // Einheiten), in der Auflösung des Bildes. Längs laufen Furchen und
  // Grate; die Birke hat Querstriche, die Föhre Platten.
  const RINDE_FARBEN = {
    eiche: { grund: "#5d4029", furche: "#2f1f12", grat: "#8a6544", fleck: "rgba(130, 150, 90, 0.35)" },
    foehre: { grund: "#7c3f22", furche: "#311708", grat: "#b76a3a", fleck: "rgba(190, 120, 70, 0.35)" },
    birke: { grund: "#ebe6da", furche: "#2d2721", grat: "#ffffff", fleck: "rgba(60, 50, 40, 0.8)" },
    gold: { grund: "#c4922a", furche: "#734c0c", grat: "#ffe48c", fleck: "rgba(255, 246, 200, 0.7)" },
    nagel: { grund: "#4b443e", furche: "#221d1a", grat: "#6f665d", fleck: "rgba(120, 110, 100, 0.4)" },
  };

  function rinde(sorte) {
    if (bilder.rinde[sorte]) return bilder.rinde[sorte];
    const q = bilder.rindeQ || 2;
    const L = STREIFEN_L;
    const H = 2 * R_TEX;
    const { c, g: cg } = leinwand(L, H, q);
    const F = RINDE_FARBEN[sorte] || RINDE_FARBEN.eiche;
    const zz = (n) => hash01(n * 1.618 + sorte.length * 31.7);
    cg.fillStyle = F.grund;
    cg.fillRect(0, 0, L, H);
    if (sorte === "birke") {
      // Graue Schlieren längs, dunkle Querstriche, schwarze Flecken.
      for (let i = 0; i < 26; i += 1) {
        cg.fillStyle = `rgba(150, 140, 125, ${0.12 + zz(i) * 0.15})`;
        cg.fillRect(0, zz(i + 50) * H, L, 0.6 + zz(i + 90) * 1.6);
      }
      for (let i = 0; i < 150; i += 1) {
        cg.fillStyle = `rgba(40, 34, 28, ${0.45 + zz(i + 200) * 0.45})`;
        cg.fillRect(zz(i + 300) * L, zz(i + 400) * H, 2.5 + zz(i + 500) * 7, 0.5 + zz(i + 600) * 0.9);
      }
      for (let i = 0; i < 22; i += 1) {
        const x = zz(i + 700) * L;
        const y = zz(i + 800) < 0.5 ? zz(i + 900) * 6 : H - zz(i + 900) * 6;
        cg.fillStyle = F.fleck;
        cg.beginPath();
        cg.ellipse(x, y, 2 + zz(i + 1000) * 4, 1.5 + zz(i + 1100) * 3, zz(i) * 3, 0, Math.PI * 2);
        cg.fill();
      }
    } else {
      // Eiche, Föhre, Gold, Nagelstamm: tiefe, lange Furchen längs, die sich
      // teilen und wieder treffen; dazwischen helle Grate und Flecken. Die
      // Föhre hat dazu längliche, orange leuchtende Platten.
      if (sorte === "foehre") {
        for (let i = 0; i < 60; i += 1) {
          cg.fillStyle = i % 3 ? "rgba(196, 112, 60, 0.55)" : "rgba(150, 80, 40, 0.5)";
          cg.beginPath();
          cg.ellipse(zz(i + 1200) * L, zz(i + 1300) * H, 6 + zz(i + 1400) * 12, 1.2 + zz(i + 1500) * 1.6, 0, 0, Math.PI * 2);
          cg.fill();
        }
      }
      for (let i = 0; i < 40; i += 1) {
        cg.fillStyle = i % 2 ? "rgba(255, 230, 190, 0.07)" : "rgba(0, 0, 0, 0.09)";
        cg.beginPath();
        cg.ellipse(zz(i + 900) * L, zz(i + 950) * H, 8 + zz(i + 990) * 24, 2 + zz(i + 1030) * 4, 0, 0, Math.PI * 2);
        cg.fill();
      }
      const furchen = 14;
      for (let f = 0; f < furchen; f += 1) {
        let x = -10 - zz(f * 3.3) * 30;
        while (x < L + 10) {
          const lang = 18 + zz(f * 11 + x * 0.13) * 60;
          const y0 = ((f + 0.5) * H) / furchen + (zz(f * 5 + x * 0.07) - 0.5) * 2.2;
          const dick = 0.5 + zz(f * 7 + x * 0.21) * 1.3;
          const welle = zz(f * 9 + x * 0.3) * 6;
          const oben = [];
          const unten = [];
          for (let k = 0; k <= 8; k += 1) {
            const px = x + (lang * k) / 8;
            const py = y0 + Math.sin(px * 0.11 + welle) * 0.9 + Math.sin(px * 0.37 + f) * 0.4;
            const w = dick * Math.sin((Math.PI * k) / 8) + 0.15;
            oben.push([px, py - w]);
            unten.push([px, py + w]);
          }
          cg.fillStyle = F.grat;
          cg.globalAlpha = 0.5;
          cg.beginPath();
          oben.forEach(([px, py], i) => (i ? cg.lineTo(px, py - 0.7) : cg.moveTo(px, py - 0.7)));
          for (let i = oben.length - 1; i >= 0; i -= 1) cg.lineTo(oben[i][0], oben[i][1] - 0.15);
          cg.fill();
          cg.globalAlpha = 1;
          cg.fillStyle = F.furche;
          cg.beginPath();
          oben.forEach(([px, py], i) => (i ? cg.lineTo(px, py) : cg.moveTo(px, py)));
          for (let i = unten.length - 1; i >= 0; i -= 1) cg.lineTo(unten[i][0], unten[i][1]);
          cg.closePath();
          cg.fill();
          x += lang + 2 + zz(f * 13 + x) * 10;
        }
      }
      cg.strokeStyle = F.furche;
      cg.lineWidth = 0.5;
      cg.globalAlpha = 0.6;
      for (let i = 0; i < 50; i += 1) {
        const x = zz(i + 40) * L;
        const y = zz(i + 140) * H;
        cg.beginPath();
        cg.moveTo(x, y);
        cg.lineTo(x + (zz(i) - 0.5) * 1.5, y + 1.2 + zz(i + 9) * 2);
        cg.stroke();
      }
      cg.globalAlpha = 1;
      for (let i = 0; i < 22; i += 1) {
        cg.fillStyle = F.fleck;
        cg.beginPath();
        cg.ellipse(zz(i + 240) * L, zz(i + 340) * H, 1 + zz(i + 440) * 3.5, 0.6 + zz(i + 540) * 1.4, 0, 0, Math.PI * 2);
        cg.fill();
      }
    }
    bilder.rinde[sorte] = { c, q };
    return bilder.rinde[sorte];
  }

  // Das Licht auf der Rundung des Stamms: hell oben (die Sonne steht hoch
  // genug), dunkel unten – als schmaler Streifen, gestreckt über jedes Stück.
  function licht() {
    if (lichtStreifen) return lichtStreifen;
    const { c, g: cg } = leinwand(4, 64, 1);
    const verlauf = cg.createLinearGradient(0, 0, 0, 64);
    verlauf.addColorStop(0, "rgba(255, 226, 170, 0.5)");
    verlauf.addColorStop(0.12, "rgba(255, 236, 190, 0.28)");
    verlauf.addColorStop(0.32, "rgba(255, 255, 255, 0.04)");
    verlauf.addColorStop(0.55, "rgba(0, 0, 0, 0.02)");
    verlauf.addColorStop(0.85, "rgba(25, 12, 0, 0.36)");
    verlauf.addColorStop(1, "rgba(15, 6, 0, 0.6)");
    cg.fillStyle = verlauf;
    cg.fillRect(0, 0, 4, 64);
    lichtStreifen = c;
    return c;
  }

  function maleHintergrund() {
    const { c, g: cg } = bildLeinwand();
    const W = view.cssW;
    const H = view.cssH;
    const s = view.s;
    const X = bildX;
    const Y = bildY;
    const hor = Y(HORIZONT);
    const sx = sonneX();
    const sy = sonneY();

    // Der Himmel der goldenen Stunde.
    const himmel = cg.createLinearGradient(0, 0, 0, hor);
    himmel.addColorStop(0, HIMMEL[0]);
    himmel.addColorStop(0.32, HIMMEL[1]);
    himmel.addColorStop(0.6, HIMMEL[2]);
    himmel.addColorStop(0.82, HIMMEL[3]);
    himmel.addColorStop(1, HIMMEL[4]);
    cg.fillStyle = himmel;
    cg.fillRect(0, 0, W, hor + 2);
    // Ein paar erste Sterne ganz oben, wo es schon dunkel wird.
    cg.fillStyle = "#fff6e0";
    for (let n = 0; n < 40; n += 1) {
      const y = hash01(n * 5.3 + 2) * hor * 0.3;
      cg.globalAlpha = (0.2 + hash01(n * 9.1) * 0.5) * (1 - y / (hor * 0.3));
      cg.fillRect(hash01(n * 3.7 + 1) * W, y, 1.3, 1.3);
    }
    cg.globalAlpha = 1;

    // Die Sonne mit ihrem Hof.
    const hof = cg.createRadialGradient(sx, sy, 4, sx, sy, 260 * s);
    hof.addColorStop(0, "rgba(255, 236, 170, 0.75)");
    hof.addColorStop(0.25, "rgba(255, 196, 110, 0.35)");
    hof.addColorStop(1, "rgba(255, 150, 80, 0)");
    cg.fillStyle = hof;
    cg.fillRect(0, 0, W, H);

    // Lange Wolkenstreifen, von unten rosa-golden beleuchtet.
    for (let n = 0; n < 6; n += 1) {
      const y = hor * (0.18 + hash01(n * 7.7) * 0.45);
      const x = hash01(n * 3.3 + 4) * W;
      const b = (90 + hash01(n * 2.1) * 160) * s;
      const h = (4 + hash01(n * 1.3) * 6) * s;
      const wolke = cg.createLinearGradient(0, y - h, 0, y + h);
      wolke.addColorStop(0, "rgba(255, 210, 170, 0.0)");
      wolke.addColorStop(0.5, "rgba(255, 196, 150, 0.45)");
      wolke.addColorStop(1, "rgba(200, 110, 130, 0.35)");
      cg.fillStyle = wolke;
      cg.beginPath();
      cg.ellipse(x, y, b, h, 0, 0, Math.PI * 2);
      cg.fill();
    }

    cg.fillStyle = "#fff6d8";
    cg.beginPath();
    cg.arc(sx, sy, 19 * s, 0, Math.PI * 2);
    cg.fill();
    const kern = cg.createRadialGradient(sx, sy, 0, sx, sy, 34 * s);
    kern.addColorStop(0, "rgba(255, 255, 240, 0.9)");
    kern.addColorStop(1, "rgba(255, 230, 160, 0)");
    cg.fillStyle = kern;
    cg.fillRect(sx - 40 * s, sy - 40 * s, 80 * s, 80 * s);

    // Berge im Dunst.
    kamm(cg, Y(HORIZONT + 40), 90 * s, 0.009, 0.023, 1.3, "rgba(170, 110, 140, 0.75)");
    kamm(cg, Y(HORIZONT + 20), 70 * s, 0.013, 0.031, 4.1, "rgba(120, 80, 120, 0.85)");

    // Der ferne Wald: kleine Tannen in Violett, dahinter Dunst.
    cg.fillStyle = "#5a4366";
    for (let x = Math.floor(weltX(0) / 9) * 9 - 9; x < weltX(W) + 9; x += 9) {
      const h = 24 + hash01(x * 0.31) * 26;
      tanne(cg, X(x + hash01(x) * 6), Y(HORIZONT + 4), h * s, h * 0.42 * s);
    }
    const dunst = cg.createLinearGradient(0, Y(HORIZONT + 60), 0, hor);
    dunst.addColorStop(0, "rgba(255, 190, 130, 0)");
    dunst.addColorStop(1, "rgba(255, 196, 130, 0.45)");
    cg.fillStyle = dunst;
    cg.fillRect(0, Y(HORIZONT + 60), W, hor - Y(HORIZONT + 60));

    // Der Wald hinter der Lichtung: zwei Reihen hoher Tannen. Wo sie die
    // Sonne sehen, glüht ihr Rand. Vor der Sonne bleibt eine Lücke.
    const sonneWX = weltX(sx);
    [
      { schritt: 34, hoch: [120, 190], farbe: "#2f3c46", rand: 0.55, versatz: 0 },
      { schritt: 46, hoch: [160, 250], farbe: "#1b252b", rand: 0.85, versatz: 17 },
    ].forEach((reihe, ri) => {
      for (let x = Math.floor(weltX(0) / reihe.schritt) * reihe.schritt - reihe.schritt; x < weltX(W) + reihe.schritt; x += reihe.schritt) {
        const wx = x + reihe.versatz + (hash01(x * 0.7 + ri) - 0.5) * reihe.schritt * 0.6;
        if (Math.abs(wx - sonneWX) < 26 + ri * 6) continue;
        const h = lerp(reihe.hoch[0], reihe.hoch[1], hash01(wx * 0.13 + ri * 5)) * s;
        const b = h * (0.36 + hash01(wx * 0.29) * 0.08);
        const fx = X(wx);
        const fy = Y(HORIZONT - 4 - ri * 6);
        const nah = clamp(1 - Math.abs(fx - sx) / (W * 0.6), 0, 1);
        const zur = Math.sign(sx - fx) || 1;
        cg.fillStyle = `rgba(255, 170, 90, ${reihe.rand * (0.25 + nah * 0.75)})`;
        tanne(cg, fx + zur * 1.6, fy, h, b);
        cg.fillStyle = reihe.farbe;
        tanne(cg, fx, fy, h, b);
      }
    });
    // Der warme Schein der Sonne über dem Wald.
    cg.globalCompositeOperation = "lighter";
    const schein = cg.createRadialGradient(sx, sy, 10, sx, sy, 200 * s);
    schein.addColorStop(0, "rgba(255, 200, 120, 0.35)");
    schein.addColorStop(1, "rgba(255, 160, 80, 0)");
    cg.fillStyle = schein;
    cg.fillRect(0, 0, W, H);
    cg.globalCompositeOperation = "source-over";

    // Die Lichtung: warm beschienen hinten, dunkler vorne.
    const boden = cg.createLinearGradient(0, hor, 0, H);
    boden.addColorStop(0, "#c99b57");
    boden.addColorStop(Math.min(0.95, (Y(0) - hor) / Math.max(1, H - hor)), "#8c6534");
    boden.addColorStop(1, "#4a331c");
    cg.fillStyle = boden;
    cg.fillRect(0, hor, W, H - hor);
    const bodenLicht = cg.createRadialGradient(sx, hor, 10, sx, hor, 260 * s);
    bodenLicht.addColorStop(0, "rgba(255, 220, 150, 0.5)");
    bodenLicht.addColorStop(1, "rgba(255, 200, 120, 0)");
    cg.fillStyle = bodenLicht;
    cg.fillRect(0, hor, W, H - hor);
    // Gras am Waldrand, Sägemehl und Späne auf der Lichtung.
    cg.strokeStyle = "rgba(70, 80, 30, 0.8)";
    cg.lineWidth = Math.max(1, 0.8 * s);
    cg.beginPath();
    for (let x = 0; x < W; x += 2.5) {
      const h = hash01(x * 0.71 + 3);
      cg.moveTo(x, hor + 1);
      cg.lineTo(x + (h - 0.5) * 3, hor - (2 + h * 6) * s);
    }
    cg.stroke();
    for (let n = 0; n < 70; n += 1) {
      const wy = hash01(n * 4.3) * (HORIZONT - 6);
      const tief = 1 - wy / HORIZONT;
      cg.fillStyle = `rgba(240, 214, 160, ${0.18 + hash01(n * 2.2) * 0.25})`;
      cg.beginPath();
      cg.ellipse(hash01(n * 6.1 + 1) * W, Y(wy), (6 + hash01(n) * 18) * s * (0.5 + tief), (1.5 + hash01(n * 1.7) * 2.5) * s * (0.5 + tief), 0, 0, Math.PI * 2);
      cg.fill();
    }
    for (let n = 0; n < 90; n += 1) {
      const wy = hash01(n * 8.3 + 7) * HORIZONT;
      cg.fillStyle = n % 3 ? "rgba(236, 200, 140, 0.8)" : "rgba(120, 80, 40, 0.7)";
      cg.save();
      cg.translate(hash01(n * 3.9 + 2) * W, Y(wy));
      cg.rotate(hash01(n * 2.7) * 3);
      cg.fillRect(-1.6 * s, -0.5 * s, 3.2 * s, 1 * s);
      cg.restore();
    }

    // Die Fahnenkette der Holzfäller-Show zwischen zwei Masten – die Masten
    // stehen immer im Bild, hochkant am Rand des Felds.
    const mastX = Math.min(FELD_HALB + 26, view.w / 2 - 10);
    [-1, 1].forEach((seite) => {
      cg.fillStyle = "#4a3020";
      cg.fillRect(X(seite * mastX) - 2 * s, Y(OBEN + 4), 4 * s, Y(0) - Y(OBEN + 4));
      cg.fillStyle = "rgba(255, 190, 110, 0.5)";
      cg.fillRect(X(seite * mastX) + (seite < 0 ? 1 : -2) * s, Y(OBEN + 4), 1 * s, Y(0) - Y(OBEN + 4));
      cg.fillStyle = "#ffcf3f";
      cg.beginPath();
      cg.arc(X(seite * mastX), Y(OBEN + 5), 3 * s, 0, Math.PI * 2);
      cg.fill();
    });
    const seil = (k) => ({ x: lerp(-mastX, mastX, k), y: OBEN - 4 - Math.sin(k * Math.PI) * 22 });
    cg.strokeStyle = "rgba(60, 40, 30, 0.9)";
    cg.lineWidth = Math.max(1, 0.9 * s);
    cg.beginPath();
    for (let k = 0; k <= 1.0001; k += 0.05) {
      const p = seil(k);
      if (k) cg.lineTo(X(p.x), Y(p.y));
      else cg.moveTo(X(p.x), Y(p.y));
    }
    cg.stroke();
    const FAHNEN = ["#e8432f", "#ffcf3f", "#1fa9b5", "#f6efe0"];
    for (let i = 1; i < 16; i += 1) {
      const k = i / 16;
      const a = seil(k - 0.022);
      const b = seil(k + 0.022);
      const m = seil(k);
      cg.fillStyle = FAHNEN[i % FAHNEN.length];
      cg.beginPath();
      cg.moveTo(X(a.x), Y(a.y));
      cg.lineTo(X(b.x), Y(b.y));
      cg.lineTo(X(m.x + 1), Y(m.y - 13));
      cg.closePath();
      cg.fill();
      cg.fillStyle = "rgba(0, 0, 0, 0.18)";
      cg.beginPath();
      cg.moveTo(X(m.x), Y(m.y - 1));
      cg.lineTo(X(b.x), Y(b.y));
      cg.lineTo(X(m.x + 1), Y(m.y - 13));
      cg.closePath();
      cg.fill();
    }

    // Holzstapel: Stämme von vorne, mit ihren Jahresringen.
    const stapel = (x, y, r, reihen) => {
      for (let reihe = 0; reihe < reihen; reihe += 1) {
        const anzahl = reihen - reihe + 1;
        for (let i = 0; i < anzahl; i += 1) {
          const cx = x + (i - (anzahl - 1) / 2) * r * 2.02 + (hash01(reihe * 7 + i) - 0.5) * r * 0.2;
          const cy = y + r + reihe * r * 1.72;
          const rr = r * (0.9 + hash01(reihe * 3 + i * 5) * 0.2);
          cg.fillStyle = "rgba(30, 18, 8, 0.6)";
          cg.beginPath();
          cg.arc(X(cx), Y(cy) + 0.8 * s, rr * s * 1.04, 0, Math.PI * 2);
          cg.fill();
          cg.drawImage(scheibe(SORTEN[(reihe + i) % 3], false), X(cx) - rr * s, Y(cy) - rr * s, rr * 2 * s, rr * 2 * s);
        }
      }
    };
    // Der Hackklotz mit der Axt.
    const klotz = (x, y) => {
      const b = 17;
      const h = 15;
      cg.fillStyle = "rgba(30, 18, 8, 0.45)";
      cg.beginPath();
      cg.ellipse(X(x), Y(y), (b + 5) * s, 3.5 * s, 0, 0, Math.PI * 2);
      cg.fill();
      const seiten = cg.createLinearGradient(X(x - b), 0, X(x + b), 0);
      seiten.addColorStop(0, "#3d2a19");
      seiten.addColorStop(0.6, "#6d4a2c");
      seiten.addColorStop(1, "#4a321e");
      cg.fillStyle = seiten;
      cg.fillRect(X(x - b), Y(y + h), b * 2 * s, h * s);
      cg.drawImage(scheibe("eiche", false), X(x - b), Y(y + h) - 4.5 * s, b * 2 * s, 9 * s);
      // Die Axt steckt im Klotz.
      cg.save();
      cg.translate(X(x + 3), Y(y + h + 1));
      cg.rotate(-0.55);
      cg.fillStyle = "#b07a40";
      cg.fillRect(-1.3 * s, -30 * s, 2.6 * s, 30 * s);
      cg.fillStyle = "#c4ccd6";
      cg.beginPath();
      cg.moveTo(-1.5 * s, -2 * s);
      cg.lineTo(9 * s, -5 * s);
      cg.quadraticCurveTo(11 * s, 1 * s, 9 * s, 6 * s);
      cg.lineTo(-1.5 * s, 4 * s);
      cg.closePath();
      cg.fill();
      cg.restore();
    };
    // Ein Sägebock mit einem Stamm darauf.
    const bock = (x, y) => {
      cg.strokeStyle = "#4a3020";
      cg.lineWidth = 2.4 * s;
      cg.beginPath();
      [-14, 14].forEach((dx) => {
        cg.moveTo(X(x + dx - 6), Y(y));
        cg.lineTo(X(x + dx + 6), Y(y + 20));
        cg.moveTo(X(x + dx + 6), Y(y));
        cg.lineTo(X(x + dx - 6), Y(y + 20));
      });
      cg.stroke();
      cg.fillStyle = "#6d4a2c";
      cg.fillRect(X(x - 30), Y(y + 26), 60 * s, 9 * s);
      cg.drawImage(scheibe("eiche", true), X(x + 27), Y(y + 26), 6 * s, 9 * s);
    };
    // Die Hütte der Holzfäller (nur quer im Bild).
    const huette = (x, y) => {
      const b = 70;
      const h = 42;
      cg.fillStyle = "#4b301c";
      cg.fillRect(X(x - b / 2), Y(y + h), b * s, h * s);
      for (let i = 0; i < 7; i += 1) {
        cg.fillStyle = i % 2 ? "#5d3b22" : "#553520";
        cg.fillRect(X(x - b / 2), Y(y + h - i * 6), b * s, 5.2 * s);
      }
      cg.fillStyle = "#2b1c12";
      cg.beginPath();
      cg.moveTo(X(x - b / 2 - 8), Y(y + h));
      cg.lineTo(X(x), Y(y + h + 30));
      cg.lineTo(X(x + b / 2 + 8), Y(y + h));
      cg.closePath();
      cg.fill();
      cg.fillStyle = "#ffcf73";
      cg.fillRect(X(x - 20), Y(y + 30), 12 * s, 11 * s);
      cg.fillRect(X(x + 9), Y(y + 30), 12 * s, 11 * s);
      cg.fillStyle = "rgba(255, 200, 100, 0.25)";
      cg.beginPath();
      cg.arc(X(x - 14), Y(y + 25), 22 * s, 0, Math.PI * 2);
      cg.arc(X(x + 15), Y(y + 25), 22 * s, 0, Math.PI * 2);
      cg.fill();
      cg.fillStyle = "#3a2414";
      cg.fillRect(X(x - 5), Y(y + 22), 10 * s, 22 * s);
    };
    const links = weltX(0);
    const rechts = weltX(W);
    if (links < -260) huette(-300, 40);
    if (rechts > 220) stapel(258, 30, 7, 3);
    if (links < -200) bock(-215, 14);
    if (rechts > 330) stapel(360, 40, 6, 2);
    stapel(112, 18, 8, 3);
    klotz(-118, 10);

    // Grosse Stämme ganz aussen und Zweige, die von oben ins Bild hängen.
    // Die Föhren am Rand der Lichtung: Stämme, oben unscharf im Laub,
    // auf der Seite zur Sonne warm beschienen.
    [-1, 1].forEach((seite) => {
      for (let n = 0; n < 3; n += 1) {
        const wx = seite * (FELD_HALB + 95 + n * 150 + hash01(n * 3 + seite) * 50);
        if (Math.abs(bildX(wx) - W / 2) > W / 2 + 40) continue;
        const b = (20 + hash01(n * 7 + seite) * 10) * s;
        const fx = X(wx);
        const fuss = Y(HORIZONT * 0.35 + n * 8);
        const zur = Math.sign(sx - fx) || 1;
        cg.fillStyle = "rgba(30, 18, 8, 0.4)";
        cg.beginPath();
        cg.ellipse(fx, fuss, b * 1.4, b * 0.22, 0, 0, Math.PI * 2);
        cg.fill();
        const st = cg.createLinearGradient(fx - b / 2, 0, fx + b / 2, 0);
        st.addColorStop(0, zur < 0 ? "#b0703a" : "#24180f");
        st.addColorStop(zur < 0 ? 0.18 : 0.35, "#4a2e1a");
        st.addColorStop(zur < 0 ? 0.65 : 0.82, "#3a2416");
        st.addColorStop(1, zur > 0 ? "#b0703a" : "#24180f");
        cg.fillStyle = st;
        cg.beginPath();
        cg.moveTo(fx - b * 0.36, 0);
        cg.lineTo(fx + b * 0.36, 0);
        cg.lineTo(fx + b * 0.5, fuss);
        cg.lineTo(fx - b * 0.5, fuss);
        cg.closePath();
        cg.fill();
        cg.strokeStyle = "rgba(20, 10, 4, 0.45)";
        cg.lineWidth = Math.max(1, 0.7 * s);
        cg.beginPath();
        for (let i = 0; i < 26; i += 1) {
          const k = hash01(i * 2.7 + n);
          const y = hash01(i * 5.3 + n) * fuss;
          const x = fx + (k - 0.5) * b * 0.8;
          cg.moveTo(x, y);
          cg.lineTo(x + (hash01(i) - 0.5) * 2, y + (6 + hash01(i * 3) * 14) * s);
        }
        cg.stroke();
        // Ein abgebrochener Ast.
        const ay = fuss * (0.35 + hash01(n * 9 + seite) * 0.3);
        cg.strokeStyle = "#2c1b10";
        cg.lineWidth = b * 0.18;
        cg.beginPath();
        cg.moveTo(fx + zur * b * 0.3, ay);
        cg.lineTo(fx + zur * b * 1.1, ay - b * 0.35);
        cg.stroke();
      }
    });
    const zweig = (x0, y0, richtung, lang, dick) => {
      cg.strokeStyle = "#141c1a";
      cg.lineWidth = dick;
      cg.lineCap = "round";
      cg.beginPath();
      cg.moveTo(x0, y0);
      const x1 = x0 + richtung * lang;
      const y1 = y0 + lang * 0.28;
      cg.quadraticCurveTo(x0 + richtung * lang * 0.5, y0 - lang * 0.05, x1, y1);
      cg.stroke();
      cg.lineWidth = Math.max(1, dick * 0.3);
      cg.beginPath();
      for (let k = 0.08; k < 1; k += 0.045) {
        const px = x0 + richtung * lang * k;
        const py = y0 + lang * 0.28 * k * k - lang * 0.05 * Math.sin(k * Math.PI);
        const l = lang * 0.16 * (1 - k * 0.6);
        cg.moveTo(px, py);
        cg.lineTo(px + richtung * l * 0.35, py + l);
        cg.moveTo(px, py);
        cg.lineTo(px - richtung * l * 0.2, py + l * 0.9);
      }
      cg.stroke();
    };
    const zw = Math.max(70, Math.min(W, H) * 0.32);
    zweig(-8, 6, 1, zw, 5);
    zweig(-8, zw * 0.45, 1, zw * 0.7, 4);
    zweig(W + 8, 10, -1, zw * 0.9, 5);
    zweig(W + 8, zw * 0.5, -1, zw * 0.6, 4);
    return c;
  }

  // Vorne: Farne und Gras am unteren Rand, die Ecken etwas dunkler. Darüber
  // fliegen die Späne, dahinter tauchen die Stämme auf.
  function maleVordergrund() {
    const { c, g: cg } = bildLeinwand();
    const W = view.cssW;
    const H = view.cssH;
    const s = view.s;
    const unten = H;
    const kante = bildY(-2);
    cg.fillStyle = "#2a2014";
    cg.beginPath();
    cg.moveTo(0, unten);
    for (let x = 0; x <= W + 6; x += 6) cg.lineTo(x, kante + (6 + Math.sin(x * 0.07) * 4 + hash01(x) * 4) * s);
    cg.lineTo(W, unten);
    cg.closePath();
    cg.fill();
    // Farnwedel: ein Stiel, links und rechts Fiedern.
    const wedel = (x, y, lang, neig, farbe) => {
      cg.strokeStyle = farbe;
      cg.lineCap = "round";
      cg.lineWidth = Math.max(1, 1.3 * s);
      const ex = x + Math.sin(neig) * lang;
      const ey = y - Math.cos(neig) * lang;
      cg.beginPath();
      cg.moveTo(x, y);
      cg.quadraticCurveTo(x + Math.sin(neig) * lang * 0.3, y - lang * 0.7, ex, ey);
      cg.stroke();
      cg.lineWidth = Math.max(1, 1.8 * s);
      cg.beginPath();
      for (let k = 0.15; k < 0.98; k += 0.09) {
        const px = lerp(x, ex, k) + Math.sin(neig) * lang * 0.3 * Math.sin(k * Math.PI) * 0.4;
        const py = lerp(y, ey, k);
        const l = lang * 0.24 * (1 - k * 0.8);
        cg.moveTo(px, py);
        cg.lineTo(px - l, py - l * 0.25);
        cg.moveTo(px, py);
        cg.lineTo(px + l, py - l * 0.25);
      }
      cg.stroke();
    };
    for (let n = 0; n < Math.ceil(W / (14 * s)) + 2; n += 1) {
      const x = n * 14 * s + (hash01(n * 2.3) - 0.5) * 10 * s;
      const lang = (14 + hash01(n * 5.1) * 20) * s;
      wedel(x, unten + 4, lang + (H - kante) * 0.6, (hash01(n * 1.9) - 0.5) * 1.3, n % 3 ? "#1f2a14" : "#2f3a18");
      wedel(x + 5 * s, unten + 4, lang * 0.8 + (H - kante) * 0.5, (hash01(n * 4.4) - 0.5) * 1.1, "rgba(150, 120, 50, 0.55)");
    }
    // Die Ecken etwas dunkler – der Blick geht in die Mitte.
    const vignette = cg.createRadialGradient(W / 2, H * 0.55, Math.min(W, H) * 0.35, W / 2, H * 0.55, Math.hypot(W, H) * 0.62);
    vignette.addColorStop(0, "rgba(20, 10, 0, 0)");
    vignette.addColorStop(1, "rgba(20, 10, 0, 0.42)");
    cg.fillStyle = vignette;
    cg.fillRect(0, 0, W, H);
    return c;
  }

  // Die Sonnenstrahlen: helle Keile von der Sonne in die Lichtung, in halber
  // Auflösung – sie sind ohnehin weich.
  function maleStrahlen() {
    const { c, g: cg } = bildLeinwand(Math.max(0.5, view.dpr * 0.5));
    const sx = sonneX();
    const sy = sonneY();
    const weit = Math.max(view.cssW, view.cssH) * 0.95;
    const mitte = Math.atan2(bildY(100) - sy, bildX(0) - sx);
    for (let i = 0; i < 9; i += 1) {
      const a = mitte + (i / 8 - 0.5) * 2.2 + (hash01(i * 3.3) - 0.5) * 0.14;
      const b = 0.018 + hash01(i * 7.1) * 0.045;
      const verlauf = cg.createRadialGradient(sx, sy, 0, sx, sy, weit * (0.5 + hash01(i * 2.9) * 0.5));
      verlauf.addColorStop(0, "rgba(255, 228, 170, 0.2)");
      verlauf.addColorStop(0.3, "rgba(255, 214, 150, 0.08)");
      verlauf.addColorStop(1, "rgba(255, 200, 120, 0)");
      cg.fillStyle = verlauf;
      cg.beginPath();
      cg.moveTo(sx, sy);
      cg.lineTo(sx + Math.cos(a - b) * weit, sy + Math.sin(a - b) * weit);
      cg.lineTo(sx + Math.cos(a + b) * weit, sy + Math.sin(a + b) * weit);
      cg.closePath();
      cg.fill();
    }
    return c;
  }

  // ---------------------------------------------------------------------------
  // Zeichnen
  // ---------------------------------------------------------------------------
  function zeichneHintergrund() {
    g.setTransform(1, 0, 0, 1, 0, 0);
    const dx = Math.round(wackelX() * view.dpr);
    const dy = Math.round(wackelY() * view.dpr);
    if (dx || dy) {
      g.fillStyle = "#2a2014";
      g.fillRect(0, 0, canvas.width, canvas.height);
    }
    g.drawImage(bilder.hinten, dx, dy);
  }

  // Die Strahlen atmen langsam, und im Licht treiben Staubkörner.
  function zeichneStrahlen() {
    flachTransform();
    g.globalCompositeOperation = "lighter";
    g.globalAlpha = ruhig() ? 0.7 : 0.62 + Math.sin(state.echt * 0.6) * 0.18 + Math.sin(state.echt * 1.7) * 0.05;
    g.drawImage(bilder.strahlen, 0, 0, view.cssW, view.cssH);
    g.globalAlpha = 1;
    if (!lichter.length) {
      for (let i = 0; i < 38; i += 1) {
        lichter.push({ x: Math.random() * view.cssW, y: Math.random() * bildY(10), r: 0.6 + Math.random() * 1.6, p: Math.random() * 6, v: 4 + Math.random() * 9 });
      }
    }
    for (const l of lichter) {
      const funkeln = 0.35 + 0.65 * Math.abs(Math.sin(state.echt * 0.9 + l.p));
      g.fillStyle = `rgba(255, 226, 160, ${0.5 * funkeln})`;
      g.fillRect(l.x, l.y, l.r, l.r);
    }
    g.globalCompositeOperation = "source-over";
  }

  // Der Schatten jedes Stücks vorne auf der Lichtung – weg von der Sonne.
  function zeichneSchatten() {
    bildTransform();
    const s = view.s;
    g.fillStyle = "rgb(30, 16, 4)";
    for (const p of state.stuecke) {
      if (p.y > OBEN + 40 || p.y < -60) continue;
      const hoch = clamp(p.y / 380, 0, 1);
      const breit = (((p.u1 - p.u0) / 2) * Math.abs(Math.cos(p.w) * Math.cos(p.kipp)) + p.R) * (1 - hoch * 0.4);
      g.globalAlpha = 0.28 * (1 - hoch * 0.75);
      g.beginPath();
      g.ellipse(bildX(p.x - p.y * 0.18), bildY(2), breit * s, 3.2 * s * (1 - hoch * 0.4), 0, 0, Math.PI * 2);
      g.fill();
    }
    g.globalAlpha = 1;
  }

  // Der Strich (oder ein Eisenband): ein Band rund um den Stamm. Vorne sieht
  // man seine halbe Ellipse, zur fernen Stirnseite hin gebogen.
  function bandPfad(xu, halb, bogen, R) {
    g.beginPath();
    for (let k = 0; k <= 10; k += 1) {
      const a = (Math.PI * k) / 10;
      const x = xu - halb + bogen * Math.sin(a);
      const y = -R * Math.cos(a);
      if (k) g.lineTo(x, y);
      else g.moveTo(x, y);
    }
    for (let k = 10; k >= 0; k -= 1) {
      const a = (Math.PI * k) / 10;
      g.lineTo(xu + halb + bogen * Math.sin(a), -R * Math.cos(a));
    }
    g.closePath();
  }

  /*
   * Ein Stück im Bild: Körper mit Rinde (verkürzt um cos(kipp)), das Licht
   * der Rundung, Striche, Äste und Nägel, die Kontur, und die Stirnseite,
   * die zum Betrachter zeigt – frisch, wo geschnitten wurde. Gezeichnet wird
   * im Bild des Stücks: x entlang der Achse, y quer (nach unten).
   */
  function zeichneStueck(p, hinweis) {
    const s = view.s;
    const cosK = Math.cos(p.kipp);
    const sinK = Math.sin(p.kipp);
    const cK = Math.abs(cosK) < 0.03 ? (cosK < 0 ? -0.03 : 0.03) : cosK;
    const R = p.R * s;
    const xa = (p.u0 - p.mitte) * cK * s;
    const xb = (p.u1 - p.mitte) * cK * s;
    const nahB = sinK >= 0;
    const xNah = nahB ? xb : xa;
    const xFern = nahB ? xa : xb;
    const e = Math.max(0.8, Math.abs(sinK) * R);
    const fernLinks = xFern < xNah || (xFern === xNah && !nahB);
    const bogen = -sinK * R;
    const sorte = p.variante;

    g.save();
    g.translate(bildX(p.x), bildY(p.y));
    g.rotate(-p.w);
    // Der Körper: oben und unten gerade, an der fernen Seite rund.
    g.beginPath();
    g.moveTo(xNah, -R);
    g.lineTo(xFern, -R);
    g.ellipse(xFern, 0, e, R, 0, -Math.PI / 2, Math.PI / 2, fernLinks);
    g.lineTo(xNah, R);
    g.closePath();
    g.save();
    g.clip();
    const tex = rinde(sorte);
    g.save();
    g.scale(cK, 1);
    const sx = (p.v.rOff + (p.u0 + p.L / 2)) * tex.q;
    const sw = Math.max(1, (p.u1 - p.u0) * tex.q);
    g.drawImage(tex.c, sx, 0, sw, tex.c.height, (p.u0 - p.mitte) * s - e / Math.abs(cK), -R, (p.u1 - p.u0) * s + (2 * e) / Math.abs(cK), 2 * R);
    g.restore();
    // Das Licht: oben hell, unten dunkel – je nachdem, wie der Stamm liegt.
    const oben = clamp(0.5 + 0.5 * Math.cos(p.w), 0, 1);
    const links = Math.min(xa, xb) - e;
    const breite = Math.abs(xb - xa) + 2 * e;
    const streifen = licht();
    if (oben > 0.02) {
      g.globalAlpha = oben;
      g.drawImage(streifen, links, -R, breite, 2 * R);
    }
    if (oben < 0.98) {
      g.globalAlpha = 1 - oben;
      g.save();
      g.scale(1, -1);
      g.drawImage(streifen, links, -R, breite, 2 * R);
      g.restore();
    }
    g.globalAlpha = 1;
    // Die Eisenbänder des Nagelstamms.
    for (const u of p.v.baender) {
      if (u < p.u0 || u > p.u1) continue;
      const xu = (u - p.mitte) * cK * s;
      bandPfad(xu, 3.2 * Math.abs(cK) * s, bogen, R);
      g.fillStyle = "#7d8691";
      g.fill();
      g.strokeStyle = "rgba(20, 24, 30, 0.7)";
      g.lineWidth = Math.max(1, 0.7 * s);
      g.stroke();
      bandPfad(xu - 0.8 * s, 1 * Math.abs(cK) * s, bogen, R * 0.8);
      g.fillStyle = "rgba(220, 230, 240, 0.55)";
      g.fill();
      for (let k = 1; k < 4; k += 1) {
        const a = (Math.PI * k) / 4;
        g.fillStyle = "#c9d1da";
        g.beginPath();
        g.arc(xu + bogen * Math.sin(a), -R * Math.cos(a), 1 * s, 0, Math.PI * 2);
        g.fill();
      }
    }
    // Die roten Striche.
    for (const m of p.marken) {
      const xu = (m.u - p.mitte) * cK * s;
      const halb = PERFEKT * Math.abs(cK) * s;
      if (m.offen) {
        bandPfad(xu, halb + 1.3, bogen, R);
        g.fillStyle = "rgba(255, 240, 220, 0.55)";
        g.fill();
      }
      bandPfad(xu, halb, bogen, R);
      g.fillStyle = m.offen ? "#ff3426" : "#c8281e";
      g.fill();
      g.strokeStyle = "rgba(110, 0, 0, 0.55)";
      g.lineWidth = Math.max(0.8, 0.5 * s);
      g.stroke();
      bandPfad(xu - halb * 0.35, halb * 0.3, bogen, R * 0.7);
      g.fillStyle = "rgba(255, 170, 150, 0.6)";
      g.fill();
      if (hinweis && m.offen) {
        bandPfad(xu, halb + 2.5 + Math.sin(state.echt * 5) * 1.5, bogen, R * 1.02);
        g.strokeStyle = `rgba(255, 245, 210, ${0.5 + Math.sin(state.echt * 5) * 0.3})`;
        g.lineWidth = 1.5;
        g.stroke();
      }
    }
    // Die Äste: dunkle Knoten mit hellem Rand.
    for (const k of p.v.knoten) {
      if (k.u < p.u0 + 1 || k.u > p.u1 - 1) continue;
      const x = (k.u - p.mitte) * cK * s + bogen * Math.sin(k.a);
      const y = -R * Math.cos(k.a);
      const rx = k.r * s * Math.max(0.45, Math.abs(cK));
      const ry = k.r * s * Math.max(0.35, Math.sin(k.a));
      g.fillStyle = "#8a5d34";
      g.beginPath();
      g.ellipse(x, y, rx * 1.18, ry * 1.18, 0, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = "#24140a";
      g.beginPath();
      g.ellipse(x, y, rx * 0.82, ry * 0.82, 0, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = "rgba(160, 110, 60, 0.7)";
      g.lineWidth = Math.max(0.7, 0.45 * s);
      g.beginPath();
      g.ellipse(x, y, rx * 0.5, ry * 0.5, 0, 0, Math.PI * 2);
      g.stroke();
      g.fillStyle = "rgba(255, 220, 170, 0.35)";
      g.beginPath();
      g.ellipse(x - rx * 0.3, y - ry * 0.35, rx * 0.25, ry * 0.18, 0, 0, Math.PI * 2);
      g.fill();
    }
    // Die Nägel: Köpfe aus Eisen, die in der Sonne blitzen.
    for (const n of p.v.naegel) {
      if (n.u < p.u0 || n.u > p.u1) continue;
      const x = (n.u - p.mitte) * cK * s + bogen * Math.sin(n.a);
      const y = -R * Math.cos(n.a);
      const r = 2.6 * s;
      g.fillStyle = "#1c2026";
      g.beginPath();
      g.arc(x + 0.5, y + 0.6, r * 1.1, 0, Math.PI * 2);
      g.fill();
      const kopf = g.createRadialGradient(x - r * 0.35, y - r * 0.4, 0, x, y, r);
      kopf.addColorStop(0, "#f4f8fc");
      kopf.addColorStop(0.5, "#a9b3be");
      kopf.addColorStop(1, "#56606c");
      g.fillStyle = kopf;
      g.beginPath();
      g.arc(x, y, r, 0, Math.PI * 2);
      g.fill();
    }
    g.restore();
    // Die Kontur.
    g.strokeStyle = sorte === "birke" ? "rgba(60, 50, 40, 0.75)" : "rgba(25, 12, 4, 0.7)";
    g.lineWidth = Math.max(1, 0.7 * s);
    g.stroke();
    // Aststummel an der Kante, und krumme Nägel, die herausstehen.
    for (const k of p.v.knoten) {
      if (k.u < p.u0 + 2 || k.u > p.u1 - 2 || Math.abs(Math.cos(k.a)) < 0.6) continue;
      const x = (k.u - p.mitte) * cK * s + bogen * Math.sin(k.a);
      const seite = Math.cos(k.a) > 0 ? -1 : 1;
      const b = k.r * s * 0.9 * Math.max(0.5, Math.abs(cK));
      g.fillStyle = sorte === "birke" ? "#d8d2c4" : "#4a321c";
      g.beginPath();
      g.moveTo(x - b, seite * R * 0.92);
      g.lineTo(x - b * 0.7, seite * (R + 6 * s));
      g.lineTo(x + b * 0.7, seite * (R + 5 * s));
      g.lineTo(x + b, seite * R * 0.92);
      g.closePath();
      g.fill();
      g.fillStyle = "#e3bf86";
      g.beginPath();
      g.ellipse(x, seite * (R + 5.5 * s), b * 0.72, 1.4 * s, 0, 0, Math.PI * 2);
      g.fill();
    }
    for (const n of p.v.naegel) {
      if (n.u < p.u0 || n.u > p.u1 || Math.abs(Math.cos(n.a)) < 0.7) continue;
      const x = (n.u - p.mitte) * cK * s;
      const seite = Math.cos(n.a) > 0 ? -1 : 1;
      g.strokeStyle = "#b9c2cc";
      g.lineWidth = Math.max(1, 0.9 * s);
      g.beginPath();
      g.moveTo(x, seite * R * 0.9);
      g.lineTo(x + 1.5 * s, seite * (R + 5 * s));
      g.lineTo(x + 4 * s, seite * (R + 7 * s));
      g.stroke();
    }
    // Die Stirnseite vorne.
    const frisch = (nahB ? p.endeB : p.endeA) === "frisch";
    g.drawImage(scheibe(sorte, frisch), xNah - e, -R, 2 * e, 2 * R);
    const glanz = nahB ? p.glanzB : p.glanzA;
    if (glanz > 0.02) {
      g.globalCompositeOperation = "lighter";
      g.globalAlpha = glanz;
      g.fillStyle = "#ffd96a";
      g.beginPath();
      g.ellipse(xNah, 0, e, R, 0, 0, Math.PI * 2);
      g.fill();
      g.globalAlpha = 1;
      g.globalCompositeOperation = "source-over";
    }
    g.restore();
  }

  function zeichneStuecke() {
    bildTransform();
    // Erst die fertigen Stücke, dann was noch zu schneiden ist – obenauf.
    for (const p of state.stuecke) if (p.fertig && !p.nagel) zeichneStueck(p, false);
    for (const p of state.stuecke) if (p.nagel) zeichneStueck(p, false);
    for (const p of state.stuecke) if (!p.fertig && !p.nagel) zeichneStueck(p, state.phase === "bereit");
    // Der Nagelstamm blitzt ab und zu.
    g.globalCompositeOperation = "lighter";
    for (const p of state.stuecke) {
      if (!p.nagel || p.getroffen) continue;
      const k = (state.echt * 0.9 + p.id * 0.37) % 1;
      if (k > 0.18) continue;
      const n = p.v.naegel[p.id % Math.max(1, p.v.naegel.length)];
      if (!n) continue;
      const o = weltVon(p, vorneX(p, n.u) + p.R * Math.sin(p.kipp) * (1 - Math.sin(n.a)), p.R * Math.cos(n.a));
      const a = Math.sin((k / 0.18) * Math.PI);
      const x = bildX(o.x);
      const y = bildY(o.y);
      const l = 9 * view.s * a;
      g.strokeStyle = `rgba(255, 255, 255, ${0.9 * a})`;
      g.lineWidth = 1.4;
      g.beginPath();
      g.moveTo(x - l, y);
      g.lineTo(x + l, y);
      g.moveTo(x, y - l);
      g.lineTo(x, y + l);
      g.stroke();
    }
    g.globalCompositeOperation = "source-over";
  }

  // Vor dem Start: Eine Klinge aus Licht fährt immer wieder durch den Strich
  // des schwebenden Stamms – so geht das.
  function zeichneHinweis() {
    if (state.phase !== "bereit") return;
    const p = state.stuecke.find((x) => x.schwebt);
    const m = p?.marken[0];
    if (!m) return;
    const zyklus = 1.9;
    const k = (state.echt % zyklus) / zyklus;
    if (k > 0.55) return;
    const q = clamp(k / 0.42, 0, 1);
    const ease = 1 - (1 - q) * (1 - q);
    const mitte = weltVon(p, vorneX(p, m.u), 0);
    const nx = -Math.sin(p.w);
    const ny = Math.cos(p.w);
    const l = p.R + 26;
    const ax = bildX(mitte.x + nx * l);
    const ay = bildY(mitte.y + ny * l);
    const bx = bildX(mitte.x - nx * l);
    const by = bildY(mitte.y - ny * l);
    const kx = lerp(ax, bx, ease);
    const ky = lerp(ay, by, ease);
    const aus = k > 0.42 ? 1 - (k - 0.42) / 0.13 : 1;
    flachTransform();
    g.lineCap = "round";
    g.strokeStyle = `rgba(255, 255, 255, ${0.25 * aus})`;
    g.lineWidth = 9;
    g.beginPath();
    g.moveTo(ax, ay);
    g.lineTo(kx, ky);
    g.stroke();
    g.strokeStyle = `rgba(255, 255, 255, ${0.85 * aus})`;
    g.lineWidth = 3;
    g.stroke();
    g.fillStyle = `rgba(255, 255, 255, ${0.9 * aus})`;
    g.beginPath();
    g.arc(kx, ky, 9, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = `rgba(30, 20, 10, ${0.5 * aus})`;
    g.lineWidth = 2;
    g.stroke();
  }

  // Teilchen: Sägemehl, Späne, Rindenstücke, Splitter (normal) und Funken
  // und Goldglanz (leuchtend, «lighter»).
  function zeichneTeile() {
    bildTransform();
    const s = view.s;
    for (let durchgang = 0; durchgang < 2; durchgang += 1) {
      if (durchgang) g.globalCompositeOperation = "lighter";
      for (const t of teile) {
        if (!t.an) continue;
        const hell = t.art === "funke" || t.art === "glanz";
        if (hell !== Boolean(durchgang)) continue;
        const k = clamp(t.leben / t.max, 0, 1);
        const x = bildX(t.x);
        const y = bildY(t.y);
        g.fillStyle = t.farbe;
        if (t.art === "wolke") {
          // Ein Hauch Sägemehl, der sich ausbreitet und vergeht.
          g.globalAlpha = k * k * 0.42;
          g.beginPath();
          g.arc(x, y, t.r * s * (3.2 - k * 2.2), 0, Math.PI * 2);
          g.fill();
        } else if (t.art === "staub") {
          g.globalAlpha = Math.min(1, k * 1.6);
          const r = t.r * s;
          g.fillRect(x - r / 2, y - r / 2, r, r);
        } else if (t.art === "funke") {
          g.globalAlpha = k;
          g.strokeStyle = t.farbe;
          g.lineWidth = Math.max(1, t.r * s * 0.6);
          g.beginPath();
          g.moveTo(x, y);
          g.lineTo(x - t.vx * 0.022 * s, y + t.vy * 0.022 * s);
          g.stroke();
        } else if (t.art === "glanz") {
          g.globalAlpha = k;
          const r = t.r * s * (0.5 + k);
          g.beginPath();
          g.moveTo(x, y - r * 2);
          g.lineTo(x + r * 0.4, y - r * 0.4);
          g.lineTo(x + r * 2, y);
          g.lineTo(x + r * 0.4, y + r * 0.4);
          g.lineTo(x, y + r * 2);
          g.lineTo(x - r * 0.4, y + r * 0.4);
          g.lineTo(x - r * 2, y);
          g.lineTo(x - r * 0.4, y - r * 0.4);
          g.closePath();
          g.fill();
        } else {
          g.globalAlpha = Math.min(1, k * 2.5);
          g.save();
          g.translate(x, y);
          g.rotate(t.dreh);
          const l = t.r * s * t.lang;
          g.fillRect(-l / 2, -t.r * s * 0.22, l, t.r * s * 0.44);
          if (t.art === "span") {
            g.fillStyle = "rgba(90, 50, 20, 0.6)";
            g.fillRect(-l / 2, t.r * s * 0.1, l, t.r * s * 0.12);
          }
          g.restore();
        }
      }
    }
    g.globalAlpha = 1;
    g.globalCompositeOperation = "source-over";
  }

  // Ringe am Schnitt: weiss, golden bei «Perfekt», rot beim Fehler.
  function zeichneRinge() {
    if (!state.ringe.length) return;
    bildTransform();
    const s = view.s;
    for (const r of state.ringe) {
      const u = clamp(r.alter / r.max, 0, 1);
      const rad = (8 + u * (r.art === "perfekt" ? 60 : 38)) * s;
      g.globalAlpha = (1 - u) * 0.95;
      g.strokeStyle = r.art === "perfekt" ? "#ffd23f" : r.art === "fehler" ? "#ff5a3c" : "#fff4e0";
      g.lineWidth = (r.art === "perfekt" ? 5 : 3.2) * (1 - u * 0.7) * s;
      g.beginPath();
      g.arc(bildX(r.x), bildY(r.y), rad, 0, Math.PI * 2);
      g.stroke();
    }
    g.globalAlpha = 1;
  }

  // Die Klingen: eine leuchtende Spur hinter jedem Finger, vorne breit,
  // hinten spitz.
  function zeichneKlingen() {
    const jetzt = performance.now() / 1000;
    flachTransform();
    for (const [id, spur] of spuren) {
      const pts = spur.punkte.filter((q) => jetzt - q.t < 0.12);
      if (pts.length < 2) {
        if (!pts.length && !klingen.has(id)) spuren.delete(id);
        continue;
      }
      const n = pts.length;
      const breit = clamp(2.2 + view.s * 1.3, 3, 5.5);
      const rand = (faktor) => {
        const links = [];
        const rechts = [];
        for (let i = 0; i < n; i += 1) {
          const a = pts[Math.max(0, i - 1)];
          const b = pts[Math.min(n - 1, i + 1)];
          let dx = b.x - a.x;
          let dy = b.y - a.y;
          const l = Math.hypot(dx, dy) || 1;
          dx /= l;
          dy /= l;
          const alter = clamp((jetzt - pts[i].t) / 0.12, 0, 1);
          const w = breit * faktor * Math.pow(i / (n - 1), 0.7) * (1 - alter * 0.6);
          links.push([pts[i].x - dy * w, pts[i].y + dx * w]);
          rechts.push([pts[i].x + dy * w, pts[i].y - dx * w]);
        }
        g.beginPath();
        links.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
        for (let i = rechts.length - 1; i >= 0; i -= 1) g.lineTo(rechts[i][0], rechts[i][1]);
        g.closePath();
      };
      g.globalCompositeOperation = "lighter";
      g.fillStyle = spur.gold ? "rgba(255, 190, 60, 0.32)" : "rgba(120, 220, 255, 0.28)";
      rand(3.2);
      g.fill();
      g.fillStyle = spur.gold ? "rgba(255, 220, 120, 0.5)" : "rgba(170, 240, 255, 0.45)";
      rand(1.7);
      g.fill();
      g.globalCompositeOperation = "source-over";
      g.fillStyle = "rgba(255, 255, 255, 0.96)";
      rand(0.75);
      g.fill();
    }
  }

  function zeichneVordergrund() {
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.drawImage(bilder.vorne, Math.round(wackelX() * view.dpr * 0.4), Math.round(wackelY() * view.dpr * 0.4));
  }

  function zeichneSchriften() {
    if (!state.schriften.length) return;
    bildTransform();
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.lineJoin = "round";
    for (const sch of state.schriften) {
      const k = clamp(sch.leben / sch.max, 0, 1);
      const alter = sch.max - sch.leben;
      const pop = alter < 0.16 && !ruhig() ? 0.55 + (alter / 0.16) * 0.45 + Math.sin((alter / 0.16) * Math.PI) * 0.3 : 1;
      const steig = (1 - k) * 26;
      const gross = Math.round(sch.gross * clamp(view.s, 0.85, 1.5) * pop);
      const halb = gross * sch.text.length * 0.32 + 6;
      const x = clamp(bildX(sch.x), halb, view.cssW - halb);
      const y = clamp(bildY(sch.y) - steig, view.frei + gross, view.cssH - gross);
      g.globalAlpha = Math.min(1, k * 2.5);
      g.font = `900 ${gross}px system-ui, sans-serif`;
      g.lineWidth = Math.max(3, gross * 0.2);
      g.strokeStyle = "rgba(30, 14, 4, 0.8)";
      g.strokeText(sch.text, x, y);
      g.fillStyle = sch.farbe;
      g.fillText(sch.text, x, y);
      if (sch.unter) {
        const klein = Math.round(gross * 0.5);
        g.font = `800 ${klein}px system-ui, sans-serif`;
        g.lineWidth = Math.max(2.5, klein * 0.22);
        g.strokeText(sch.unter, x, y + gross * 0.82);
        g.fillStyle = sch.unterFarbe || "#ffffff";
        g.fillText(sch.unter, x, y + gross * 0.82);
      }
    }
    g.globalAlpha = 1;
  }

  // Ein Banner oben in der Mitte: Neues kommt, oder Feierabend.
  function zeichneBanner() {
    const b = state.banner;
    if (!b) return;
    const k = clamp(b.leben / b.max, 0, 1);
    const alter = b.max - b.leben;
    const ein = clamp(alter / 0.25, 0, 1);
    flachTransform();
    const gross = Math.round(clamp(view.cssW * 0.045, 16, 26) * (b.gross || 1));
    g.font = `900 ${gross}px system-ui, sans-serif`;
    g.textAlign = "center";
    g.textBaseline = "middle";
    const w = g.measureText(b.text).width + gross * 1.6;
    const h = gross * 1.9;
    const x = view.cssW / 2;
    const y = Math.max(view.frei + h, bildY(OBEN - 35)) + (1 - ein) * -18;
    g.globalAlpha = Math.min(1, k * 3) * ein;
    g.fillStyle = "rgba(25, 14, 6, 0.72)";
    g.beginPath();
    if (g.roundRect) g.roundRect(x - w / 2, y - h / 2, w, h, h / 2);
    else g.rect(x - w / 2, y - h / 2, w, h);
    g.fill();
    g.strokeStyle = b.farbe;
    g.lineWidth = 2;
    g.stroke();
    g.fillStyle = b.farbe;
    g.fillText(b.text, x, y + 1);
    g.globalAlpha = 1;
  }

  // Eine kleine Axt für die Anzeige.
  function axtZeichen(x, y, gr, farbe, kopf) {
    g.save();
    g.translate(x, y);
    g.rotate(-0.55);
    g.fillStyle = farbe;
    g.beginPath();
    if (g.roundRect) g.roundRect(-gr * 0.08, -gr * 0.45, gr * 0.16, gr * 0.95, gr * 0.06);
    else g.rect(-gr * 0.08, -gr * 0.45, gr * 0.16, gr * 0.95);
    g.fill();
    g.fillStyle = kopf;
    g.beginPath();
    g.moveTo(-gr * 0.1, -gr * 0.42);
    g.lineTo(gr * 0.34, -gr * 0.58);
    g.quadraticCurveTo(gr * 0.46, -gr * 0.36, gr * 0.36, -gr * 0.1);
    g.lineTo(-gr * 0.1, -gr * 0.2);
    g.closePath();
    g.fill();
    g.restore();
  }

  // Oben links die Punkte (sie zählen hoch), darunter die Serie; oben
  // rechts die drei Äxte.
  function zeichneAnzeige() {
    if (state.phase === "bereit") return;
    flachTransform();
    g.translate(0, view.frei);
    const gross = clamp(view.cssH * 0.048, 15, 24);
    g.font = `900 ${Math.round(gross)}px system-ui, sans-serif`;
    g.textAlign = "left";
    g.textBaseline = "middle";
    const text = String(Math.round(state.anzeige));
    const x = 12;
    let y = 10;
    const pop = 1 + state.pop * 0.18;
    const w = g.measureText(text).width + gross * 2.2;
    const hoch = gross * 1.6;
    g.fillStyle = "rgba(25, 14, 6, 0.6)";
    g.beginPath();
    if (g.roundRect) g.roundRect(x, y, w, hoch, hoch / 2);
    else g.rect(x, y, w, hoch);
    g.fill();
    // Eine kleine Stirnseite vor der Zahl.
    const bx = x + gross * 0.85;
    const by = y + hoch / 2;
    g.drawImage(scheibe("eiche", true), bx - gross * 0.45, by - gross * 0.45, gross * 0.9, gross * 0.9);
    g.save();
    g.translate(x + gross * 1.55, by + 1);
    g.scale(pop, pop);
    g.fillStyle = state.pop > 0.05 ? "#ffe9a8" : "#ffffff";
    g.fillText(text, 0, 0);
    g.restore();
    y += hoch + 6;
    const klein = Math.round(gross * 0.64);
    g.font = `900 ${klein}px system-ui, sans-serif`;
    const faktor = Math.min(FAKTOR_MAX, 1 + Math.floor(state.serie / SERIE_JE));
    if (state.serie > 0) {
      const inhalt = faktor > 1 ? `Serie ×${faktor}` : "Serie";
      const pw = g.measureText(inhalt).width + klein * 1.4 + klein * 2.1;
      const ph = klein * 1.75;
      g.fillStyle = faktor > 1 ? "rgba(255, 200, 60, 0.94)" : "rgba(25, 14, 6, 0.6)";
      g.beginPath();
      if (g.roundRect) g.roundRect(x, y, pw, ph, ph / 2);
      else g.rect(x, y, pw, ph);
      g.fill();
      g.fillStyle = faktor > 1 ? "#3a2400" : "#ffd96a";
      g.fillText(inhalt, x + klein * 0.7, y + ph / 2 + 1);
      // Wie weit es bis zum nächsten Faktor ist: drei Punkte.
      const schon = state.serie % SERIE_JE;
      const px = x + pw - klein * 1.9;
      for (let i = 0; i < SERIE_JE; i += 1) {
        g.fillStyle = faktor >= FAKTOR_MAX || i < schon ? (faktor > 1 ? "#3a2400" : "#ffd96a") : "rgba(255, 255, 255, 0.3)";
        g.beginPath();
        g.arc(px + i * klein * 0.6, y + ph / 2, klein * 0.2, 0, Math.PI * 2);
        g.fill();
      }
    }
    // Die Äxte.
    const ag = clamp(gross * 1.25, 18, 30);
    for (let i = 0; i < LEBEN; i += 1) {
      const weg = i >= LEBEN - state.fehler;
      const seit = state.echt - state.axtWeg[LEBEN - 1 - i];
      let ax = view.cssW - 14 - ag * 0.55 - i * (ag * 0.95);
      let ay = 10 + hoch / 2;
      if (weg && seit < 0.6 && !ruhig()) {
        ax += Math.sin(seit * 60) * 4 * (1 - seit / 0.6);
        ay += seit * seit * 40;
      }
      g.fillStyle = "rgba(25, 14, 6, 0.5)";
      g.beginPath();
      g.arc(ax, ay, ag * 0.58, 0, Math.PI * 2);
      g.fill();
      if (weg) {
        g.globalAlpha = 0.35;
        axtZeichen(ax, ay + ag * 0.05, ag * 0.85, "#7a6a5a", "#6a6f78");
        g.globalAlpha = 1;
        g.strokeStyle = "#ff5a3c";
        g.lineWidth = 2.4;
        g.beginPath();
        g.moveTo(ax - ag * 0.3, ay - ag * 0.3);
        g.lineTo(ax + ag * 0.3, ay + ag * 0.3);
        g.stroke();
      } else {
        axtZeichen(ax, ay + ag * 0.05, ag * 0.85, "#c98e4c", "#dfe6ee");
      }
    }
  }

  function zeichnen() {
    if (!g) return;
    sicherBilder();
    g.setTransform(1, 0, 0, 1, 0, 0);
    zeichneHintergrund();
    zeichneStrahlen();
    zeichneSchatten();
    zeichneStuecke();
    zeichneVordergrund();
    zeichneTeile();
    zeichneRinge();
    zeichneHinweis();
    zeichneKlingen();
    zeichneSchriften();
    if (state.blitz > 0.01 && !ruhig()) {
      flachTransform();
      g.fillStyle = `rgba(${state.blitzFarbe}, ${state.blitz * 0.24})`;
      g.fillRect(0, 0, view.cssW, view.cssH);
    }
    zeichneBanner();
    zeichneAnzeige();
  }

  // ---------------------------------------------------------------------------
  // Teilchen und Schriften
  // ---------------------------------------------------------------------------
  // Ein fester Vorrat: Ein neues Teilchen nimmt den Platz des ältesten.
  const teile = [];
  for (let i = 0; i < TEILE_MAX; i += 1) teile.push({ an: false });
  let teilNr = 0;

  function teil(art, x, y, vx, vy, leben, r, farbe, lang = 1) {
    const t = teile[teilNr];
    teilNr = (teilNr + 1) % TEILE_MAX;
    t.an = true;
    t.art = art;
    t.x = x;
    t.y = y;
    t.vx = vx;
    t.vy = vy;
    t.leben = leben;
    t.max = leben;
    t.r = r;
    t.farbe = farbe;
    t.lang = lang;
    t.dreh = Math.random() * 6.28;
    t.w = (Math.random() - 0.5) * 22;
  }

  const SPAN_FARBEN = {
    eiche: ["#f3d39c", "#e7bf84", "#fff0cf", "#d6a465"],
    birke: ["#f6ead0", "#fff8e8", "#e8d6b0", "#f2e3c2"],
    foehre: ["#f6d39c", "#f0c98e", "#ffe6bd", "#e0ac68"],
    gold: ["#ffe48c", "#fff2c0", "#f7c84a", "#ffd96a"],
    nagel: ["#c9aa80", "#d9bf98", "#b08e62", "#e0caa6"],
  };

  // Sägemehl, Späne und Rinde – entlang der Schnittlinie, gespritzt in
  // Richtung der Klinge und seitlich aus dem Spalt.
  function spaene(p, ort, winkel, staerke) {
    const anzahl = Math.round((ruhig() ? 10 : 34) * staerke);
    const bx = Math.cos(winkel);
    const by = Math.sin(winkel);
    const ax = Math.cos(p.w);
    const ay = Math.sin(p.w);
    const farben = SPAN_FARBEN[p.variante] || SPAN_FARBEN.eiche;
    for (let i = 0; i < (ruhig() ? 2 : 6); i += 1) {
      const q = (Math.random() - 0.5) * 1.6 * p.R;
      teil("wolke", ort.x + bx * q, ort.y + by * q, bx * (20 + Math.random() * 50) + p.vx * 0.3, by * 30 + 25 + p.vy * 0.3,
        0.55 + Math.random() * 0.35, 4 + Math.random() * 4, farben[i % farben.length]);
    }
    for (let i = 0; i < anzahl; i += 1) {
      const q = (Math.random() - 0.5) * 2 * p.R;
      const tempo = 60 + Math.random() * 280;
      const seite = Math.random() < 0.5 ? -1 : 1;
      teil("staub", ort.x + bx * q, ort.y + by * q,
        bx * tempo * 0.75 + ax * seite * tempo * 0.45 + p.vx * 0.4,
        by * tempo * 0.75 + ay * seite * tempo * 0.45 + p.vy * 0.4 + 40,
        0.45 + Math.random() * 0.6, 0.9 + Math.random() * 1.6, farben[i % farben.length]);
    }
    const spaeneAnzahl = Math.round((ruhig() ? 3 : 9) * staerke);
    for (let i = 0; i < spaeneAnzahl; i += 1) {
      const q = (Math.random() - 0.5) * 2 * p.R;
      const tempo = 120 + Math.random() * 200;
      const a = winkel + (Math.random() - 0.5) * 1.8;
      teil("span", ort.x + bx * q, ort.y + by * q, Math.cos(a) * tempo + p.vx * 0.3, Math.sin(a) * tempo + 120 + p.vy * 0.3,
        0.7 + Math.random() * 0.5, 2.2 + Math.random() * 2.2, farben[(i + 1) % farben.length], 1.6 + Math.random());
    }
    const rindeAnzahl = Math.round((ruhig() ? 2 : 5) * staerke);
    const RINDE = { eiche: "#3b2716", birke: "#e8e2d4", foehre: "#6a341c", gold: "#a8781a", nagel: "#2e2924" };
    for (let i = 0; i < rindeAnzahl; i += 1) {
      const seite = Math.random() < 0.5 ? -1 : 1;
      const a = winkel + seite * (0.6 + Math.random() * 0.8);
      const tempo = 90 + Math.random() * 160;
      teil("rinde", ort.x - Math.sin(p.w) * p.R * seite, ort.y + Math.cos(p.w) * p.R * seite,
        Math.cos(a) * tempo, Math.sin(a) * tempo + 80, 0.8 + Math.random() * 0.4, 2 + Math.random() * 2, RINDE[p.variante] || RINDE.eiche, 1.2);
    }
  }

  function funken(x, y, anzahl, farben, tempo = 220) {
    if (ruhig()) anzahl = Math.ceil(anzahl / 3);
    for (let i = 0; i < anzahl; i += 1) {
      const a = Math.random() * Math.PI * 2;
      const v = tempo * (0.4 + Math.random() * 0.9);
      teil("funke", x, y, Math.cos(a) * v, Math.sin(a) * v + 60, 0.3 + Math.random() * 0.4, 1 + Math.random() * 1.4, farben[i % farben.length]);
    }
  }

  function glanz(x, y, anzahl, streu) {
    if (ruhig()) anzahl = Math.ceil(anzahl / 3);
    for (let i = 0; i < anzahl; i += 1) {
      const a = Math.random() * Math.PI * 2;
      const v = 40 + Math.random() * 140;
      teil("glanz", x + (Math.random() - 0.5) * streu, y + (Math.random() - 0.5) * streu, Math.cos(a) * v, Math.sin(a) * v + 30,
        0.5 + Math.random() * 0.5, 0.8 + Math.random(), i % 2 ? "#fff3c2" : "#ffd23f");
    }
  }

  function splitter(p, ort) {
    for (let i = 0; i < (ruhig() ? 3 : 10); i += 1) {
      const a = Math.random() * Math.PI * 2;
      const v = 80 + Math.random() * 200;
      teil("splitter", ort.x, ort.y, Math.cos(a) * v, Math.sin(a) * v + 100, 0.8 + Math.random() * 0.4, 1.4 + Math.random(), i % 2 ? "#2a170a" : "#8a5d34", 3 + Math.random() * 2);
    }
  }

  function ring(x, y, art) {
    state.ringe.push({ x, y, art, alter: 0, max: art === "perfekt" ? 0.55 : 0.4 });
    if (state.ringe.length > 8) state.ringe.shift();
  }

  function schrift(text, x, y, farbe, gross, dauer = 1.1, unter = "", unterFarbe = "") {
    // Kommen zwei zugleich an dieselbe Stelle, steht die neue darüber – so
    // weit, dass sich nichts überdeckt.
    for (let versuch = 0; versuch < 4; versuch += 1) {
      const alt = state.schriften.find((a) => a.leben > a.max * 0.35 && Math.abs(a.x - x) < 130 && Math.abs(a.y - y) < 34);
      if (!alt) break;
      y = alt.y + 36;
    }
    state.schriften.push({ text, x, y, farbe, gross, leben: dauer, max: dauer, unter, unterFarbe });
    if (state.schriften.length > 7) state.schriften.shift();
  }

  function banner(text, farbe = "#ffe9a8", dauer = 1.9, gross = 1) {
    state.banner = { text, farbe, leben: dauer, max: dauer, gross };
  }

  // Die Klingenspuren im Bild (CSS-Pixel), je Zeiger.
  const spuren = new Map();
  let spurNr = 0;

  function spurPunkt(id, x, y, t = performance.now() / 1000) {
    let spur = spuren.get(id);
    if (!spur) {
      spur = { punkte: [], gold: false };
      spuren.set(id, spur);
    }
    spur.punkte.push({ x, y, t });
    if (spur.punkte.length > 24) spur.punkte.shift();
    return spur;
  }

  // Eine Spur entlang einer Strecke in der Welt, als wäre eben eine Klinge
  // dort durchgefahren – für den Autopiloten und beim Zuschauen.
  function spurStrecke(ax, ay, bx, by, gold = false) {
    const id = `z${spurNr += 1}`;
    const jetzt = performance.now() / 1000;
    for (let i = 0; i <= 6; i += 1) {
      const k = i / 6;
      spurPunkt(id, bildX(lerp(ax, bx, k)) + wackelX(), bildY(lerp(ay, by, k)) + wackelY(), jetzt - 0.05 + k * 0.05);
    }
    spuren.get(id).gold = gold;
    if (spuren.size > 12) spuren.delete(spuren.keys().next().value);
  }

  // ---------------------------------------------------------------------------
  // Der Schnitt
  // ---------------------------------------------------------------------------
  // Wo die Klinge die Mitte der sichtbaren Seite kreuzt, in der Welt.
  function schnittOrt(p, u) {
    return weltVon(p, vorneX(p, u), 0);
  }

  /*
   * Trifft ein Schnitt bei u mit der Klinge im Winkel winkel (in der Welt)
   * einen Ast? Die Klinge ist im Bild des Stücks eine Gerade durch die Mitte
   * der sichtbaren Seite; wo sie auf der Höhe eines Astes steht, darf sie
   * ihm nicht näher kommen als sein Rand.
   */
  function astGetroffen(p, u, winkel) {
    if (!p.v.knoten.length) return null;
    const cosK = Math.cos(p.kipp);
    const sinK = Math.sin(p.kipp);
    const xc = vorneX(p, u);
    const d = winkel - p.w;
    const sd = Math.sin(d);
    const steig = clamp(Math.cos(d) / (Math.abs(sd) < 1e-3 ? (sd < 0 ? -1e-3 : 1e-3) : sd), -1.2, 1.2);
    for (const k of p.v.knoten) {
      if (k.u < p.u0 || k.u > p.u1) continue;
      const vk = p.R * Math.cos(k.a);
      const xk = (k.u - p.mitte) * cosK - p.R * Math.sin(k.a) * sinK;
      if (Math.abs(xc + steig * vk - xk) < k.r * Math.max(0.45, Math.abs(cosK)) * 0.95 + 0.4) return k;
    }
    return null;
  }

  // Was ein Schnitt bei u ergäbe – ohne ihn auszuführen.
  function bewerten(p, u, winkel) {
    if (p.nagel) return { art: "nagel", d: 0, m: null };
    let m = null;
    let d = Infinity;
    for (const mk of p.marken) {
      if (!mk.offen) continue;
      const dd = Math.abs(u - mk.u);
      if (dd < d) { d = dd; m = mk; }
    }
    if (astGetroffen(p, u, winkel)) return { art: "ast", d, m };
    if (!m || d > p.v.daneben) return { art: "daneben", d, m };
    return { art: d <= PERFEKT ? "perfekt" : "gut", d, m };
  }

  // Ein Teil des Stücks p, von u0 bis u1, nach dem Schnitt: am selben Ort wie
  // vorher, mit dem Tempo, das es als Teil des drehenden Stücks hatte – und
  // dazu auseinander, mit der Klinge mit und vom Schnitt weg gedreht.
  function teilVon(p, u0, u1, seite, winkel) {
    const q = neuesStueck(p.v, u0, u1);
    const ax = Math.cos(p.w);
    const ay = Math.sin(p.w);
    const bx = Math.cos(winkel);
    const by = Math.sin(winkel);
    const d = (q.mitte - p.mitte) * Math.cos(p.kipp);
    const rx = ax * d;
    const ry = ay * d;
    const quer = ax * by - ay * bx;
    q.x = p.x + rx;
    q.y = p.y + ry;
    q.vx = p.vx - p.om * ry + ax * TRENN * seite + bx * SCHUB;
    q.vy = p.vy + p.om * rx + ay * TRENN * seite + by * SCHUB + 40;
    q.w = p.w;
    q.om = p.om - seite * DREH * quer;
    q.kipp = p.kipp;
    q.endeA = seite > 0 ? "frisch" : p.endeA;
    q.endeB = seite < 0 ? "frisch" : p.endeB;
    q.glanzA = seite > 0 ? 1 : 0;
    q.glanzB = seite < 0 ? 1 : 0;
    return q;
  }

  // Ein fertiges Stück taumelt davon: Es dreht sich aus dem Bild heraus, und
  // man sieht seine Schnittfläche. Fest aus seiner Nummer, nicht gewürfelt.
  function taumeln(q, seite) {
    q.fertig = true;
    q.offen = false;
    q.kippW = seite * (4 + hash01(q.id * 1.37) * 5);
    q.om += seite * (0.8 + hash01(q.id * 2.91) * 1.6);
  }

  /*
   * Der Schnitt: das Stück p bei u (entlang seiner Achse), die Klinge im
   * Winkel winkel. Im Spiel und beim Zuschauen derselbe Weg – was er
   * bewirkt, hängt nur an p, u und winkel. Gibt zurück, was es war.
   */
  function schneide(p, u, winkel) {
    if (state.aus || p.fertig || p.weg || (!p.offen && !p.nagel)) return null;
    state.letzteAktion = state.tick;
    const ort = schnittOrt(p, u);
    const zuschauen = state.phase === "zuschauen";
    if (zuschauen) {
      // Beim Zuschauen gibt es keinen Finger: Die Klinge fährt dort durch,
      // wo damals geschnitten wurde.
      const l = p.R + 30;
      const dx = Math.cos(winkel) * l;
      const dy = Math.sin(winkel) * l;
      spurStrecke(ort.x - dx, ort.y - dy, ort.x + dx, ort.y + dy, bewerten(p, u, winkel).art === "perfekt");
    }
    if (p.nagel) {
      // Die Klinge prallt ab: Funken, der Stamm wird weggeschlagen.
      p.getroffen = true;
      p.fertig = true;
      const seite = Math.sin(winkel - p.w) < 0 ? -1 : 1;
      p.om += seite * 7;
      p.vx += Math.cos(winkel) * 90;
      p.vy += 80 + Math.sin(winkel) * 50;
      p.kippW = seite * 3;
      funken(ort.x, ort.y, 26, ["#fff4c2", "#ffd23f", "#ff9f1c", "#ffffff"], 260);
      ring(ort.x, ort.y, "fehler");
      fehler("nagel", ort.x, ort.y);
      return { art: "nagel", punkte: 0 };
    }
    const b = bewerten(p, u, winkel);
    const fehlschnitt = b.art === "ast" || b.art === "daneben";
    const a = teilVon(p, p.u0, u, -1, winkel);
    const c = teilVon(p, u, p.u1, 1, winkel);
    for (const mk of p.marken) {
      if (mk === b.m && !fehlschnitt) {
        a.marken.push({ u: mk.u, offen: false });
        c.marken.push({ u: mk.u, offen: false });
        continue;
      }
      (mk.u < u ? a : c).marken.push({ u: mk.u, offen: fehlschnitt ? false : mk.offen });
    }
    p.weg = true;
    p.fertig = true;
    p.offen = false;
    const i = state.stuecke.indexOf(p);
    if (i >= 0) state.stuecke.splice(i, 1, a, c);
    else state.stuecke.push(a, c);
    // Golden glänzt die Schnittfläche nur nach einem perfekten Schnitt.
    if (b.art !== "perfekt") {
      a.glanzB = 0;
      c.glanzA = 0;
    }
    for (const [q, seite] of [[a, -1], [c, 1]]) {
      q.offen = q.marken.some((m) => m.offen);
      if (!q.offen) { taumeln(q, seite); continue; }
      // Das Stück mit dem zweiten Strich fliegt noch einmal hoch – nicht
      // über das Feld hinaus, und nicht so schnell zur Seite, dass es aus
      // dem Feld fiele.
      const hoch = ausdehnungY(q);
      const luft = Math.max(0, OBEN - 8 - q.y - hoch);
      const vMax = Math.sqrt(2 * q.g * luft);
      q.vy = Math.min(Math.max(q.vy, Math.sqrt(2 * q.g * Math.min(RAST_HUB, luft))), vMax);
      const zeit = (q.vy + Math.sqrt(q.vy * q.vy + 2 * q.g * Math.max(0, q.y + 40))) / q.g;
      q.vx = clamp(q.vx, (-100 - q.x) / zeit, (100 - q.x) / zeit);
      q.om *= 0.5;
    }
    spaene(p, ort, winkel, fehlschnitt ? 0.7 : 1);
    // Die Klinge geht durch den Stamm – auch daneben und durch den Ast (dort
    // kommt der Fehler dazu).
    ton("holzfaeller.schnitt", { laut: b.art === "perfekt" ? 1 : fehlschnitt ? 0.8 : 0.9 }, 45);
    if (fehlschnitt) {
      if (b.art === "ast") splitter(p, ort);
      ring(ort.x, ort.y, "fehler");
      fehler(b.art, ort.x, ort.y);
      return { art: b.art, punkte: 0, d: b.d };
    }
    // Punkte: 10 für «Perfekt», sonst 9 bis 1 nach dem Abstand – mal der
    // Serie, mal zwei für Gold.
    const perfekt = b.art === "perfekt";
    const faktorVorher = Math.min(FAKTOR_MAX, 1 + Math.floor(state.serie / SERIE_JE));
    if (perfekt) {
      state.serie += 1;
      state.perfekte += 1;
      state.letztePerfekt = state.echt;
    } else {
      if (state.serie >= SERIE_JE) schrift("Serie vorbei", ort.x, ort.y - 34, "#f2e6d8", 13, 0.9);
      state.serie = 0;
    }
    state.besteSerie = Math.max(state.besteSerie, state.serie);
    const faktor = Math.min(FAKTOR_MAX, 1 + Math.floor(state.serie / SERIE_JE));
    const basis = perfekt ? 10 : Math.max(1, Math.round(9 - (8 * (b.d - PERFEKT)) / (p.v.daneben - PERFEKT)));
    const gold = p.variante === "gold" ? 2 : 1;
    const dazu = basis * faktor * gold;
    state.punkte += dazu;
    state.schnitte += 1;
    state.pop = 1;
    const unter = [faktor > 1 ? `Serie ×${faktor}` : "", gold > 1 ? "Gold ×2" : ""].filter(Boolean).join(" · ");
    if (perfekt) {
      schrift(`PERFEKT ${dazu}`, ort.x, ort.y + p.R + 22, "#ffd23f", 21, 1.15, unter, "#fff3c2");
      glanz(ort.x, ort.y, 18, p.R * 2);
      ring(ort.x, ort.y, "perfekt");
      state.blitz = 0.9;
      state.blitzFarbe = "255, 214, 120";
      state.stoss = Math.max(state.stoss, 0.75);
      // Zum Schnitt: ein neuer Faktor ist ein Meilenstein, sonst die Harfe –
      // und ab dem zweiten Perfekten in Folge die Leiter, Stufe um Stufe.
      if (faktor > faktorVorher) {
        banner(`Serie ×${faktor}!`, "#ffd23f", 1.2, 1.1);
        ton("meilenstein", {}, 400);
      } else if (state.serie >= 2) ton("serie", { stufe: state.serie, laut: 0.9 }, 100);
      else ton("perfekt", { laut: 0.9 }, 100);
      if (!zuschauen) kids()?.vibrate?.([8, 24, 8]);
    } else {
      const wort = basis >= 8 ? "SUPER" : basis >= 5 ? "GUT" : "KNAPP";
      schrift(`${wort} ${dazu}`, ort.x, ort.y + p.R + 20, basis >= 8 ? "#fff1d6" : "#f2e6d8", basis >= 5 ? 18 : 16, 1, unter, "#ffe9a8");
      ring(ort.x, ort.y, "gut");
      state.stoss = Math.max(state.stoss, 0.45);
      if (!zuschauen) kids()?.vibrate?.(10);
    }
    if (gold > 1) glanz(ort.x, ort.y, 14, p.R * 3);
    state.protokoll.push(`${state.tick}:${p.id}:${b.art}:${dazu}`);
    return { art: b.art, punkte: dazu, d: b.d };
  }

  // Ein Fehler kostet eine Axt; die dritte beendet die Runde.
  const FEHLER_TEXT = { verpasst: "VERPASST!", daneben: "DANEBEN!", ast: "AST!", nagel: "NAGEL!" };

  function fehler(art, x, y) {
    if (state.aus) return;
    state.protokoll.push(`${state.tick}:${art}`);
    state.fehler += 1;
    state.grund = art;
    state.letzteAktion = state.tick;
    state.axtWeg[state.fehler - 1] = state.echt;
    if (state.serie >= SERIE_JE) schrift("Serie vorbei", x, y - 34, "#f2e6d8", 13, 0.9);
    state.serie = 0;
    state.stoss = 1.1;
    state.blitz = 1;
    state.blitzFarbe = "255, 70, 40";
    schrift(FEHLER_TEXT[art] || "FEHLER!", x, clamp(y, 22, OBEN - 20) + 18, "#ff7a5c", 22, 1.3);
    const zuschauen = state.phase === "zuschauen";
    // Eine Axt weniger: Klinge auf Eisen – die letzte am lautesten.
    ton("holzfaeller.nagel", { laut: state.fehler >= LEBEN ? 1.2 : 1 }, 150);
    if (!zuschauen) kids()?.vibrate?.([30, 40, 60]);
    if (state.fehler >= LEBEN) {
      state.aus = true;
      wald.aus();
      state.uhrRest = 0;
      if (!ruhig()) state.lupe = 0.3;
      banner("Feierabend!", "#ffe9a8", 2.4, 1.25);
      if (state.phase === "spiel") stepTimer = window.setTimeout(finish, 1600);
    }
  }

  function verpasst(p) {
    p.offen = false;
    p.fertig = true;
    state.letzteAktion = state.tick;
    fehler("verpasst", clamp(p.x, -FELD_HALB + 20, FELD_HALB - 20), 6);
  }

  // ---------------------------------------------------------------------------
  // Der Rechenschritt
  // ---------------------------------------------------------------------------
  // Was eine Welle neu bringt, wird beim ersten Mal angesagt.
  function ansagen(welle) {
    const holz = welle.stamme.filter((v) => v.art === "holz");
    const neu = [];
    if (welle.stamme.some((v) => v.art === "nagel")) neu.push(["nagel", "Nagelstamm: nicht schneiden!"]);
    if (holz.some((v) => v.doppelt)) neu.push(["doppelt", "Zwei Striche: zweimal schneiden!"]);
    if (holz.some((v) => v.gold)) neu.push(["gold", "Goldstamm zählt doppelt!"]);
    if (welle.stamme.some((v) => v.knoten.length)) neu.push(["ast", "Äste nicht treffen!"]);
    if (holz.length >= 3) neu.push(["drei", "Drei auf einmal!"]);
    else if (holz.length === 2) neu.push(["zwei", "Zwei auf einmal!"]);
    for (const [art, text] of neu) {
      if (state.erstmals[art]) continue;
      state.erstmals[art] = true;
      banner(text, art === "nagel" ? "#ffb4a0" : "#ffe9a8", 2);
      return;
    }
  }

  function starteWelle() {
    const w = state.welle;
    planBis(w + 1);
    const welle = state.plan.wellen[w];
    state.welle += 1;
    state.welleTick = state.tick;
    let bis = state.tick;
    for (const v of welle.stamme) {
      const tick = state.tick + Math.round(v.versatz / TAKT);
      state.wartend.push({ tick, v });
      bis = Math.max(bis, tick);
    }
    state.welleBis = bis;
    state.wartend.sort((a, b) => a.tick - b.tick);
    ansagen(welle);
  }

  // Die nächste Welle kommt nach ihrer Zeit – oder früher, wenn nichts mehr
  // offen ist: Wer schnell schneidet, wartet nicht.
  function pruefeWelle() {
    const seit = state.tick - state.welleTick;
    const max = Math.max(Math.round(lueckeBei(state.welle) / TAKT), state.welleBis - state.welleTick + Math.round(0.6 / TAKT));
    if (seit >= max) { starteWelle(); return; }
    if (seit < MIN_LUECKE || state.tick - state.letzteAktion < FRUEH || state.wartend.length) return;
    for (const p of state.stuecke) if (p.offen) return;
    starteWelle();
  }

  function simSchritt() {
    state.tick += 1;
    if (!state.aus) pruefeWelle();
    while (state.wartend.length && state.wartend[0].tick <= state.tick) {
      const { v } = state.wartend.shift();
      if (!state.aus) wirf(v);
    }
    let raus = 0;
    for (const p of state.stuecke) {
      if (p.schwebt) continue;
      p.vy -= p.g * TAKT;
      p.x += p.vx * TAKT;
      p.y += p.vy * TAKT;
      p.w += p.om * TAKT;
      if (p.kippW) p.kipp += p.kippW * TAKT;
      if (p.glanzA > 0) p.glanzA = Math.max(0, p.glanzA - TAKT * 2.5);
      if (p.glanzB > 0) p.glanzB = Math.max(0, p.glanzB - TAKT * 2.5);
      if ((p.vy < 0 && p.y + ausdehnungY(p) < -BODEN - 2) || Math.abs(p.x) > 3000) {
        p.weg = true;
        raus += 1;
        if (p.offen && !p.fertig) verpasst(p);
      }
    }
    if (raus) state.stuecke = state.stuecke.filter((p) => !p.weg);
  }

  // Im Spiel folgt die Rechnung der echten Zeit seit dem Start (losMs), in
  // festen Schritten – so passen die Züge, die mit der echten Zeit
  // aufgezeichnet werden. Hängt ein Bild, holt sie höchstens AUFHOLEN_MAX
  // Schritte auf; der Rest fällt weg.
  function aufholen() {
    if (state.phase !== "spiel" || state.aus) return;
    let soll = Math.floor((performance.now() - state.losMs) / (TAKT * 1000));
    if (soll - state.tick > AUFHOLEN_MAX) {
      state.losMs += (soll - state.tick - AUFHOLEN_MAX) * TAKT * 1000;
      soll = state.tick + AUFHOLEN_MAX;
    }
    while (state.tick < soll && state.phase === "spiel" && !state.aus) simSchritt();
  }

  // Nach der dritten Axt: Die Stücke fliegen in Zeitlupe weiter, dann
  // wieder schneller – nur noch fürs Bild.
  function nachlauf(dt) {
    state.uhrRest += dt * state.lupe;
    const n = Math.min(240, Math.floor(state.uhrRest / TAKT + 1e-6));
    state.uhrRest -= n * TAKT;
    for (let i = 0; i < n; i += 1) simSchritt();
  }

  // Was nur fürs Bild ist: Teilchen, Schriften, Spuren, Wackeln, Blitz.
  function effekte(dt) {
    state.echt += dt;
    if (state.aus && state.lupe < 1) state.lupe = Math.min(1, state.lupe + dt * 0.45);
    const h = dt * (state.aus ? state.lupe : 1);
    if (state.stoss > 0) state.stoss = Math.max(0, state.stoss - dt * 4.5);
    if (state.blitz > 0) state.blitz = Math.max(0, state.blitz - dt * 4);
    if (state.pop > 0) state.pop = Math.max(0, state.pop - dt * 4);
    state.anzeige += (state.punkte - state.anzeige) * Math.min(1, dt * 9);
    if (Math.abs(state.punkte - state.anzeige) < 0.5) state.anzeige = state.punkte;
    for (const t of teile) {
      if (!t.an) continue;
      if (t.art === "wolke") { t.vx *= 1 - 2.5 * h; t.vy *= 1 - 2.5 * h; }
      else if (t.art === "staub") { t.vy -= 260 * h; t.vx *= 1 - 2.4 * h; t.vy *= 1 - 1.2 * h; }
      else if (t.art === "glanz") { t.vy -= 40 * h; t.vx *= 1 - 2 * h; t.vy *= 1 - 2 * h; }
      else if (t.art === "funke") t.vy -= 420 * h;
      else { t.vy -= 620 * h; t.vx *= 1 - 0.5 * h; }
      t.x += t.vx * h;
      t.y += t.vy * h;
      t.dreh += t.w * h;
      t.leben -= h;
      if (t.leben <= 0 || t.y < -BODEN - 20) t.an = false;
    }
    for (let i = state.ringe.length - 1; i >= 0; i -= 1) {
      state.ringe[i].alter += h;
      if (state.ringe[i].alter > state.ringe[i].max) state.ringe.splice(i, 1);
    }
    for (let i = state.schriften.length - 1; i >= 0; i -= 1) {
      state.schriften[i].leben -= dt;
      if (state.schriften[i].leben <= 0) state.schriften.splice(i, 1);
    }
    if (state.banner) {
      state.banner.leben -= dt;
      if (state.banner.leben <= 0) state.banner = null;
    }
    for (const l of lichter) {
      l.y -= l.v * dt;
      l.x += Math.sin(state.echt * 0.7 + l.p) * 6 * dt;
      if (l.y < -4) { l.y = bildY(8); l.x = Math.random() * view.cssW; }
    }
    // Ein goldener Stamm glitzert.
    if (!ruhig()) {
      for (const p of state.stuecke) {
        if (p.variante !== "gold" || p.fertig || Math.random() > dt * 10) continue;
        const u = lerp(p.u0, p.u1, Math.random());
        const o = weltVon(p, vorneX(p, u), (Math.random() - 0.5) * p.R * 1.6);
        teil("glanz", o.x, o.y, 0, 10, 0.45, 1 + Math.random(), "#fff3c2");
      }
    }
    klangTakt();
  }

  let gezeigt = 0;
  function punkteZeigen() {
    if (gezeigt === state.punkte) return;
    gezeigt = state.punkte;
    shell.setCount(state.punkte);
  }

  function loop(now) {
    frame = window.requestAnimationFrame(loop);
    const dt = clamp((now - last) / 1000, 0, 0.05);
    last = now;
    messen();
    if (state.phase === "spiel" && !state.aus) {
      aufholen();
      gegner?.takt(state.punkte);
    } else if (state.phase === "zuschauen") zuschauenTakt(dt);
    else if (state.aus) nachlauf(dt);
    punkteZeigen();
    effekte(dt);
    zeichnen();
  }

  // Für die Prüfskripte: ein Schritt ohne requestAnimationFrame. Die Runde
  // rückt genau um dt vor (losMs wandert mit, sonst holte die Schleife sie
  // danach auf die echte Zeit zurück).
  function takt(dt) {
    const h = clamp(Number(dt) || 0, 0, 0.05);
    if (state.phase === "spiel" && !state.aus) {
      state.uhrRest += h;
      const n = Math.floor(state.uhrRest / TAKT + 1e-6);
      state.uhrRest = Math.max(0, state.uhrRest - n * TAKT);
      state.losMs -= n * TAKT * 1000;
      for (let i = 0; i < n && !state.aus; i += 1) simSchritt();
      if (state.aus) state.uhrRest = 0;
      gegner?.takt(state.punkte);
    } else if (state.phase === "zuschauen") zuschauenTakt(h);
    else if (state.aus) nachlauf(h);
    punkteZeigen();
    effekte(h);
  }

  // ---------------------------------------------------------------------------
  // Die Klinge
  // ---------------------------------------------------------------------------
  /*
   * Je Zeiger eine Klinge. Jede Bewegung ist eine Strecke von der letzten
   * Lage zur neuen. Geprüft wird sie im Bild jedes Stücks – und zwar von
   * dort, wo der Finger beim letzten Mal relativ zum Stück war, bis dorthin,
   * wo er jetzt relativ zu ihm ist (lokal). So zählt die Bewegung gegen das
   * fliegende Stück, nicht gegen den Bildschirm.
   *
   * Im Bild eines Stücks ist sein Körper ein Rechteck: x von einem Ende zum
   * anderen (verkürzt), v von -R bis R. Geht die Klinge oben hinein und
   * unten hinaus (oder umgekehrt), ist das ein Schnitt – an der Stelle, wo
   * sie die Mitte (v = 0) kreuzt. Rein und auf derselben Seite wieder
   * hinaus, oder durch eine Stirnseite, ist kein Schnitt.
   */
  const klingen = new Map();

  // Eine Strecke gegen ein Rechteck (Liang–Barsky): wo sie hinein- und wo
  // sie hinausgeht, und durch welche Kante – oder null.
  const KANTEN = ["links", "rechts", "unten", "oben"];
  function clipStrecke(ax, av, bx, bv, x0, x1, R) {
    let t0 = 0;
    let t1 = 1;
    let e0 = null;
    let e1 = null;
    const dx = bx - ax;
    const dv = bv - av;
    const ps = [-dx, dx, -dv, dv];
    const qs = [ax - x0, x1 - ax, av + R, R - av];
    for (let i = 0; i < 4; i += 1) {
      const p = ps[i];
      const q = qs[i];
      if (p === 0) {
        if (q < 0) return null;
        continue;
      }
      const r = q / p;
      if (p < 0) {
        if (r > t1) return null;
        if (r > t0) { t0 = r; e0 = KANTEN[i]; }
      } else {
        if (r < t0) return null;
        if (r < t1) { t1 = r; e1 = KANTEN[i]; }
      }
    }
    return { t0, t1, e0, e1 };
  }

  // Ob ein Stück jetzt geschnitten werden kann.
  function schneidbar(p) {
    if (p.fertig || p.weg || state.aus) return false;
    if (!p.offen && !(p.nagel && !p.getroffen)) return false;
    if (state.phase === "spiel") return true;
    return state.phase === "bereit" && p.schwebt && !shell.live;
  }

  // Durchquert die Strecke (im Bild des Stücks: von A nach B) das Stück?
  // k merkt sich, wo die Klinge hineinging, falls sie noch drin ist.
  function durchquert(p, k, A, B, ax, ay, bx, by) {
    const cosK = Math.cos(p.kipp);
    const x0 = (p.u0 - p.mitte) * cosK;
    const x1 = (p.u1 - p.mitte) * cosK;
    const r = clipStrecke(A.x, A.v, B.x, B.v, Math.min(x0, x1), Math.max(x0, x1), p.R);
    if (!r) { k.drin.delete(p.id); return null; }
    let ein = k.drin.get(p.id) || null;
    if (r.e0) {
      ein = {
        kante: r.e0, x: A.x + (B.x - A.x) * r.t0, v: A.v + (B.v - A.v) * r.t0,
        wx: ax + (bx - ax) * r.t0, wy: ay + (by - ay) * r.t0,
      };
    }
    if (!r.e1) {
      if (ein) k.drin.set(p.id, ein);
      return null;
    }
    k.drin.delete(p.id);
    if (!ein) return null;
    const aus = { kante: r.e1, x: A.x + (B.x - A.x) * r.t1, v: A.v + (B.v - A.v) * r.t1 };
    const quer = (ein.kante === "oben" && aus.kante === "unten") || (ein.kante === "unten" && aus.kante === "oben");
    if (!quer || ein.v === aus.v) return null;
    const xc = ein.x + ((aus.x - ein.x) * ein.v) / (ein.v - aus.v);
    const u = clamp(p.mitte + (xc + p.R * Math.sin(p.kipp)) / cosK, p.u0 + 0.5, p.u1 - 0.5);
    let dx = bx - ein.wx;
    let dy = by - ein.wy;
    if (Math.hypot(dx, dy) < 0.5) { dx = bx - ax; dy = by - ay; }
    return { p, u, winkel: Math.atan2(dy, dx) };
  }

  // Die Klinge fährt von (ax, ay) nach (bx, by) – in der Welt. Jeder Schnitt
  // geschieht sofort, in diesem Schritt.
  function klingeStrecke(k, ax, ay, bx, by, schnell, wenn) {
    const raus = [];
    for (const p of state.stuecke.slice()) {
      if (!schneidbar(p)) { k.lokal.delete(p.id); k.drin.delete(p.id); continue; }
      const neu = lokal(p, bx, by);
      const alt = k.lokal.get(p.id) || lokal(p, ax, ay);
      k.lokal.set(p.id, neu);
      if (!schnell) { k.drin.delete(p.id); continue; }
      const t = durchquert(p, k, alt, neu, ax, ay, bx, by);
      if (!t) continue;
      const e = wenn(t);
      if (e) raus.push(e);
    }
    return raus;
  }

  /*
   * Ein Schnitt aus der Eingabe: Der erste beginnt die Runde. Stelle und
   * Winkel werden gerundet – genau so, wie sie im Zug stehen –, damit die
   * Wiedergabe dasselbe rechnet. Dann geht der Zug hinaus.
   */
  function eingabeSchnitt(t) {
    if (state.phase === "bereit") {
      if (shell.live) return null;
      losGehts(false);
    }
    const u = Math.round(t.u * 4) / 4;
    const winkel = Math.round(t.winkel * 100) / 100;
    const id = t.p.id;
    const e = schneide(t.p, u, winkel);
    if (!e) return null;
    meldeZug({ a: state.tick, b: id * 1024 + Math.round(u * 4) + 512, c: Math.round(winkel * 100) + 1000 });
    return { id, ...e };
  }

  function klingeAn(id, sx, sy, zeit) {
    klingen.set(id, {
      wx: weltX(sx - wackelX()), wy: weltY(sy - wackelY()), zeit, lokal: new Map(), drin: new Map(),
    });
    spuren.delete(id);
    spurPunkt(id, sx, sy);
  }

  function klingeZieh(id, sx, sy, zeit) {
    const k = klingen.get(id);
    if (!k) return [];
    const spur = spurPunkt(id, sx, sy);
    const wx = weltX(sx - wackelX());
    const wy = weltY(sy - wackelY());
    const dt = Math.max(0, zeit - k.zeit) / 1000;
    const weit = Math.hypot(wx - k.wx, wy - k.wy);
    const schnell = dt <= 0 ? weit > 0 : weit / dt >= KLINGE_MIN;
    const raus = klingeStrecke(k, k.wx, k.wy, wx, wy, schnell, eingabeSchnitt);
    if (raus.some((e) => e.art === "perfekt")) spur.gold = true;
    k.wx = wx;
    k.wy = wy;
    k.zeit = zeit;
    return raus;
  }

  // ---------------------------------------------------------------------------
  // Im Multiplayer und in der Hall of Fame: Zug um Zug
  // ---------------------------------------------------------------------------
  /*
   * Ein Zug (geist.js, zuege; live-spiel.js, zug) – sofort, wenn etwas
   * geschieht:
   *
   *   a   der Schritt der Runde (TAKT), in dem es geschah
   *   b   beim Start: 1, wenn der erste Stamm ohne Schnitt hochflog, sonst 0;
   *       beim Schnitt: Nummer des Stücks × 1024 + Stelle × 4 + 512 (die
   *       Stelle in Einheiten entlang des Stamms, auf ein Viertel gerundet)
   *   c   beim Start 0; beim Schnitt der Winkel der Klinge × 100 + 1000
   *   p   die Punkte bis dahin
   *
   * Wer zuschaut, hat dieselbe Welt (dieselbe Saat), rechnet dieselben
   * Schritte und setzt jeden Schnitt in genau seinem Schritt ein. Die
   * Nummern der Stücke zählen in derselben Reihenfolge hoch, die Folgen
   * eines Schnitts hängen nur an Stück, Stelle und Winkel.
   */
  const liveWarte = [];
  let liveTimer = null;

  function meldeZug(ort) {
    if (state.phase === "zuschauen") return;
    aufnahme?.zug(state.punkte, ort);
    if (!shell?.live) return;
    liveWarte.push({ p: state.punkte, ort });
    if (!liveTimer) liveHinaus();
  }

  // Zwei Züge kurz nacheinander würden im Multiplayer zu einem (live-spiel.js,
  // ZUG_MS) – und ein Schnitt ginge verloren. Hier geht jeder einzeln hinaus.
  function liveHinaus() {
    liveTimer = null;
    const z = liveWarte.shift();
    if (!z) return;
    const live = window.LernappLiveSpiel;
    if (live?.zug && live.gestartet?.()) live.zug(z.p, z.ort);
    liveTimer = window.setTimeout(liveHinaus, 45);
  }

  function zugAnwenden(z) {
    if (z.c === 0) {
      if (z.b === 1) ersterWurf();
    } else {
      const id = Math.floor(z.b / 1024);
      const u = ((z.b % 1024) - 512) / 4;
      const winkel = (z.c - 1000) / 100;
      const p = state.stuecke.find((x) => x.id === id);
      if (p) schneide(p, u, winkel);
    }
    if (Number.isFinite(z.p) && z.p !== state.punkte) state.punkte = z.p;
  }

  // Jedes Bild: die Züge, die inzwischen da sind (beim Anschauen aus der
  // Hall of Fame alle, im Multiplayer, was angekommen ist), und so viele
  // Schritte, wie der andere zu dieser Zeit gespielt hatte – geschätzt vom
  // letzten Zug aus, der schon vorbei ist.
  function zuschauenTakt(dt) {
    if (!zuschauer?.seit) return;
    const jetzt = zuschauer.jetzt();
    const neu = zuschauer.seit(gesehenBis, Infinity);
    for (const z of neu) {
      gesehenBis = z.t;
      zugListe.push(z);
    }
    while (zugAnker + 1 < zugListe.length && zugListe[zugAnker + 1].t <= jetzt) zugAnker += 1;
    const anker = zugListe[zugAnker];
    const verzug = zuschauer.live ? 24 : 4;
    const ziel = Math.floor(anker ? anker.a + (jetzt - anker.t) * 0.24 : jetzt * 0.24) - verzug;
    const anwenden = () => {
      while (zugNaechster < zugListe.length && zugListe[zugNaechster].a <= state.tick) {
        zugAnwenden(zugListe[zugNaechster]);
        zugNaechster += 1;
      }
    };
    anwenden();
    if (state.aus) nachlauf(dt);
    else {
      for (let n = 0; n < 480 && state.tick < ziel && !state.aus; n += 1) {
        simSchritt();
        anwenden();
      }
    }
    // Eine Runde aus der Hall of Fame: am Schluss die Tafel.
    if (zugNaechster >= zugListe.length) zuschauer.weiter?.();
  }

  // Ab jetzt die Runde des anderen: von vorn, mit derselben Welt (dieselbe
  // Saat), und dann Zug um Zug, wie er geschnitten hat.
  function zuschauenStarten() {
    if (!zuschauer?.lauf || !zuschauer.seit) return;
    startRun();
    state.phase = "zuschauen";
    shell.setPhase("play");
    gesehenBis = -Infinity;
    zugListe = [];
    zugNaechster = 0;
    zugAnker = -1;
    zuschauer.los?.();
    zuschauenTakt(0);
  }

  // ---------------------------------------------------------------------------
  // Ablauf
  // ---------------------------------------------------------------------------
  // Die Runde beginnt: mit dem ersten Schnitt durch den schwebenden Stamm
  // (mitWurf falsch) – oder mit der Leertaste und im Live-Modus zum
  // gemeinsamen Start (game-shell.js, live.los): Dann fliegt der erste
  // Stamm hoch, und man muss ihn erwischen.
  function losGehts(mitWurf = true) {
    if (state.phase !== "bereit") return;
    state.phase = "spiel";
    state.tick = 0;
    state.uhrRest = 0;
    state.losMs = performance.now();
    state.welleTick = 0;
    state.welleBis = 0;
    state.letzteAktion = 0;
    shell.setPhase("play");
    gegner?.los();
    aufnahme?.los();
    meldeZug({ a: 0, b: mitWurf ? 1 : 0, c: 0 });
    if (mitWurf) ersterWurf();
    kids()?.vibrate?.(8);
  }

  function startRun() {
    clearStep();
    stopLoop();
    wald.aus();
    shell.closeOverlay();
    zufall.neu();
    shell.setPhase("intro");
    Object.assign(state, {
      phase: "bereit", aus: false, fertig: false, tick: 0, losMs: 0, uhrRest: 0,
      punkte: 0, schnitte: 0, perfekte: 0, serie: 0, besteSerie: 0, fehler: 0, grund: "",
      plan: { wellen: [], stamme: [] }, welle: 1, welleTick: 0, welleBis: 0, letzteAktion: 0,
      wartend: [], stuecke: [], naechsteId: 1, erstmals: {},
      schriften: [], ringe: [], banner: null, stoss: 0, blitz: 0, lupe: 1, echt: 0, anzeige: 0, pop: 0,
      axtWeg: [-9, -9, -9], letztePerfekt: -9, protokoll: [],
    });
    teile.forEach((t) => { t.an = false; });
    klingen.clear();
    spuren.clear();
    liveWarte.length = 0;
    planBis(10);
    wirf(state.plan.wellen[0].stamme[0]);
    gezeigt = 0;
    shell.setCount(0);
    gegner?.runde();

    shell.clear();
    promptKnoten = shell.el("p", "cm-prompt hl-prompt", "Wisch quer durch den roten Strich!");
    shell.play.append(promptKnoten, buildPlatz());
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
    const dauer = Math.min(900, 200 + ziel * 2);
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

  const GRUND_TEXT = { verpasst: "Stamm verpasst", daneben: "Daneben geschnitten", ast: "Ast getroffen", nagel: "Nagel getroffen" };

  function finish() {
    if (state.phase === "zuschauen") return;
    clearStep();
    if (state.fertig) return;
    state.fertig = true;
    state.phase = "ende";
    stopLoop();
    wald.aus();
    if (g) zeichnen();
    const punkte = state.punkte;
    const geist = aufnahme?.ende(gegner?.ende(punkte) || null) || null;
    const vorher = Number(store.read()?.scores?.[0]) || 0;
    const rekord = punkte > vorher;
    store.update((old) => ({
      runs: (Number(old.runs) || 0) + 1,
      scores: [...(old.scores || []), punkte].sort((x, y) => y - x).slice(0, TOP_COUNT),
    }));
    const teileText = [
      GRUND_TEXT[state.grund] || "",
      state.schnitte ? `${state.schnitte} Schnitte, ${state.perfekte} perfekt` : "",
      vorher ? `Bestwert ${vorher}` : "",
    ].filter(Boolean).join(" · ");
    shell.showResult({
      label: "Deine Punkte",
      points: punkte,
      detail: rekord ? "Neuer Rekord!" : teileText || null,
      geist,
    });
    if (rekord) host.querySelector(".cm-result-detail")?.classList.add("hl-rekord");
    zaehleHoch(punkte);
  }

  // ---------------------------------------------------------------------------
  // Start
  // ---------------------------------------------------------------------------
  shell = shellApi.mount({
    host,
    title: "Holzfäller",
    area: "konzentration",
    accent: "#00A5B5",
    accentDark: "#00707c",
    clock: false,
    onRestart: () => (zuschauer ? zuschauenStarten() : startRun()),
    live: { los: () => losGehts(true), stopp: () => finish(), zuschauen: (quelle) => { zuschauer = quelle; zuschauenStarten(); } },
  });
  zuschauer = window.LernappGeist?.zuschauer?.({
    host, spiel: "lumberCut", fassung: "z1", zufall, zuege: true, einheit: "Punkte", nochmal: zuschauenStarten,
  }) || null;
  if (!zuschauer) {
    gegner = window.LernappGeist?.fuer?.({ spiel: "lumberCut", host, art: "ziel" }) || null;
    aufnahme = window.LernappGeist?.zuege?.({ fassung: "z1", zufall }) || null;
  }

  startRun();
  zuschauer?.laden.then((da) => { if (da) zuschauenStarten(); });

  // --- Eingabe ---------------------------------------------------------------
  // Jeder Finger ist eine eigene Klinge (pointerdown/-move/-up je Zeiger),
  // die Maus mit gedrückter Taste auch. Nur Knöpfe bleiben Knöpfe. Vor jeder
  // Bewegung holt die Runde bis jetzt auf: Der Schnitt gilt in dem Schritt,
  // in dem der Finger kam. Die Zwischenlagen eines Bildes (getCoalescedEvents)
  // zählen mit – die Klinge folgt dem Finger genauer.
  function bildPunkt(event) {
    const rect = canvas.getBoundingClientRect();
    return { x: (event.clientX - rect.left) * (view.cssW / (rect.width || 1)), y: (event.clientY - rect.top) * (view.cssH / (rect.height || 1)) };
  }

  host.addEventListener("pointerdown", (event) => {
    if (event.target.closest("button, a, input")) return;
    if (!canvas || state.phase === "ende" || state.phase === "zuschauen") return;
    aufholen();
    const { x, y } = bildPunkt(event);
    klingeAn(event.pointerId, x, y, event.timeStamp);
    try { host.setPointerCapture(event.pointerId); } catch { /* dann eben ohne */ }
  });

  host.addEventListener("pointermove", (event) => {
    if (!klingen.has(event.pointerId) || !canvas) return;
    aufholen();
    const liste = event.getCoalescedEvents?.() || [];
    for (const e of liste.length ? liste : [event]) {
      const { x, y } = bildPunkt(e);
      klingeZieh(event.pointerId, x, y, e.timeStamp);
    }
  });

  const loslassen = (event) => {
    if (!klingen.has(event.pointerId) || !canvas) return;
    aufholen();
    const { x, y } = bildPunkt(event);
    klingeZieh(event.pointerId, x, y, event.timeStamp);
    klingen.delete(event.pointerId);
  };
  host.addEventListener("pointerup", loslassen);
  host.addEventListener("pointercancel", (event) => { klingen.delete(event.pointerId); });

  // Die Leertaste (oder Enter) wirft den ersten Stamm hoch – geschnitten
  // wird mit Finger oder Maus. Steht der Fokus auf einem Knopf, gilt die
  // Taste dem Knopf.
  document.addEventListener("keydown", (event) => {
    if (event.key !== " " && event.key !== "Enter") return;
    if (document.activeElement?.tagName === "BUTTON") return;
    event.preventDefault();
    if (event.repeat) return;
    if (state.phase === "bereit" && !shell.live) losGehts(true);
  });

  window.addEventListener("resize", messen);
  window.addEventListener("orientationchange", messen);
  window.addEventListener("pagehide", () => { clearStep(); stopLoop(); });

  // ---------------------------------------------------------------------------
  // Für die Prüfskripte
  // ---------------------------------------------------------------------------
  /*
   * wischen([[x, y], …]) fährt eine Klinge durch Punkte der Welt – alle im
   * selben Schritt, also ein Wisch so schnell wie ein Blitz – und gibt die
   * Schnitte zurück. probe(ax, ay, bx, by) sagt, was ein gerader Wisch
   * schneiden würde, ohne ihn auszuführen. ziele() nennt jeden offenen Strich
   * mit einem Wisch quer hindurch (a → b), wie lange sein Stück noch fliegt
   * (rest, s) und ob er im Bild steht (sichtbar).
   */
  let testNr = 0;
  function wischen(punkte) {
    const id = `t${testNr += 1}`;
    const jetzt = performance.now();
    const bild = (q) => [bildX(q[0]) + wackelX(), bildY(q[1]) + wackelY()];
    const [x0, y0] = bild(punkte[0]);
    klingeAn(id, x0, y0, jetzt);
    const raus = [];
    for (let i = 1; i < punkte.length; i += 1) {
      const [x, y] = bild(punkte[i]);
      raus.push(...klingeZieh(id, x, y, jetzt));
    }
    klingen.delete(id);
    const spur = spuren.get(id);
    if (spur) {
      spuren.delete(id);
      const [a, b] = [punkte[0], punkte[punkte.length - 1]];
      spurStrecke(a[0], a[1], b[0], b[1], raus.some((e) => e.art === "perfekt"));
    }
    return raus;
  }

  function probe(ax, ay, bx, by) {
    const raus = [];
    const k = { lokal: new Map(), drin: new Map() };
    for (const p of state.stuecke) {
      if (!schneidbar(p)) continue;
      const t = durchquert(p, k, lokal(p, ax, ay), lokal(p, bx, by), ax, ay, bx, by);
      if (!t) continue;
      const u = Math.round(t.u * 4) / 4;
      const winkel = Math.round(t.winkel * 100) / 100;
      const b = bewerten(p, u, winkel);
      raus.push({ id: p.id, nagel: p.nagel, art: b.art, d: b.d, u });
    }
    return raus;
  }

  function ziele() {
    const raus = [];
    for (const p of state.stuecke) {
      if (!p.offen || p.fertig) continue;
      const rest = (p.vy + Math.sqrt(Math.max(0, p.vy * p.vy + 2 * p.g * (p.y + 5)))) / p.g;
      for (const m of p.marken) {
        if (!m.offen) continue;
        const o = weltVon(p, vorneX(p, m.u), 0);
        const nx = -Math.sin(p.w);
        const ny = Math.cos(p.w);
        const l = p.R + 12;
        raus.push({
          id: p.id, u: m.u, x: o.x, y: o.y, ax: o.x + nx * l, ay: o.y + ny * l, bx: o.x - nx * l, by: o.y - ny * l,
          rest: p.schwebt ? Infinity : rest, sichtbar: o.y > 4 && o.y < OBEN && Math.abs(o.x) < FELD_HALB + 10,
          // Ein Schritt um eine Einheit entlang des Stamms, im Bild.
          ex: Math.cos(p.w) * Math.cos(p.kipp), ey: Math.sin(p.w) * Math.cos(p.kipp),
        });
      }
    }
    return raus;
  }

  // Die gewürfelte Welt dieser Runde: die ersten zwanzig Stämme mit Wurf,
  // Strichen, Ästen und Nägeln.
  function weltText() {
    planBis(10);
    return state.plan.stamme.slice(0, 20).map((v) => [
      `${v.welle}.${v.art[0]}${v.variante[0]}`,
      `${v.L.toFixed(1)}/${v.R.toFixed(1)}`,
      `${v.x0.toFixed(1)}>${v.xp.toFixed(1)}^${v.yp.toFixed(1)}`,
      `${v.om.toFixed(2)}@${v.w0.toFixed(2)}`,
      v.marken.map((u) => u.toFixed(1)).join(","),
      v.knoten.map((k) => k.u.toFixed(1)).join(","),
      v.naegel.length,
      v.versatz.toFixed(2),
    ].join(":")).join(" ");
  }

  window.LernappHolzfaeller = {
    TAKT, PERFEKT, DANEBEN, LEBEN, FELD_HALB, OBEN,
    state, view, takt, wischen, probe, ziele, weltText, planBis, losGehts, schneide, gBei, lueckeBei, bildX, bildY,
  };
})();
