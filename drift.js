/*
 * drift.js – Drift-Rennen.
 * ---------------------------------------------------------------------------
 * Ein Sportwagen jagt eine Passstrasse hinauf, Kurve um Kurve. Gelenkt wird
 * mit einem Finger: Wer ihn aufs Bild legt, driftet – der Wagen schwingt um
 * den Drehpunkt der nächsten Kurve, wie an einem unsichtbaren Seil. Wer
 * loslässt, fährt geradeaus weiter, genau in die Richtung, in die er gerade
 * zeigt.
 *
 * Die Kunst ist der Zeitpunkt, zweimal je Kurve: Drücken, wenn die Kurve
 * beginnt – zu früh oder zu spät, und das Seil ist zu lang, der Wagen trägt
 * es hinaus in die Leitplanke. Loslassen, wenn er in die neue Gerade zeigt –
 * dann lenkt er die letzten Grad selbst nach. Wer zu früh oder zu spät
 * loslässt, fährt schräg weiter, bis es kracht.
 *
 * Nach oben wird die Strasse schmaler und der Wagen schneller. Gezählt wird,
 * wie weit er kommt, in Metern. Unterwegs ändert sich die Landschaft: Wiese,
 * Wald, Fels, Schnee – je höher, desto rauer.
 *
 * Gebaut wird die Strasse aus dem Zufall (zufall.js): ohne Turnier jedes Mal
 * eine andere, im Turnier für alle im selben Versuch dieselbe. Sie besteht
 * aus Geraden und Kreisbögen, und sie ist immer fahrbar: Jede Kurve hat
 * einen Radius, den die Strasse auch mit ihrer Breite fasst, und jede
 * Gerade ist lang genug, um vor der nächsten Kurve wieder Luft zu holen.
 * Keine Kehre kommt einem anderen Stück Strasse zu nahe.
 *
 * Die Gegner (geist.js) fahren als Wagen aus Licht mit – genau so, wie sie
 * in ihrer besten Runde gefahren sind, auf ihrer eigenen Strasse. Platz 1
 * und die eigene Bestmarke stehen dazu als Zielstreifen bei ihren Metern.
 * Und die besten Fahrten lassen sich anschauen (?zuschauen=, geist.js): auf
 * ihrer eigenen Strasse, gewürfelt mit derselben Saat.
 *
 * Gerechnet wird in Welteinheiten, zehn sind ein Meter; y zählt nach oben,
 * Winkel wie in der Mathematik (0 nach rechts, ein Viertel nach oben).
 */
(() => {
  "use strict";

  if (document.body.dataset.page !== "drift") return;

  const host = document.querySelector("#dt-stage");
  const shellApi = window.LernappGameShell;
  const cloudApi = window.LernappGameCloud;
  if (!host || !shellApi) return;

  const kids = () => window.LernappKids || null;
  const klang = () => window.ArcadeKlang || null;
  const ruhig = () => Boolean(kids()?.prefersReducedMotion?.());

  // Der Zufall. Nur die Strasse zieht daraus – Bäume, Rauch und Funken
  // hängen an festen Zahlen oder an Math.random, damit die Strasse nicht
  // davon abhängt, wie jemand fährt.
  const zufall = window.LernappZufall?.fuer?.("driftRace") || {
    neu() {},
    zahl: () => Math.random(),
  };

  // ---------------------------------------------------------------------------
  // Die Welt
  // ---------------------------------------------------------------------------
  const METER = 10;
  const DS = 4;                    // Abstand der Stützpunkte auf der Mittellinie
  const MIN_W = 300;               // so viel Welt ist mindestens zu sehen, quer …
  const MIN_H = 400;               // … und hoch
  const VORLAUF = 700;             // so viel Strasse liegt unter dem Start
  const START_GERADE = 320;        // die erste Gerade, bis zur ersten Kurve
  const START_S = 70;              // hier liegt die Startlinie
  const SPALT = 34;                // so viel Gras liegt mindestens zwischen zwei Stücken Strasse
  const KACHEL = 64;               // Raster, in dem Stützpunkte und Deko abgelegt werden
  const HAUPT = Math.PI / 2;       // geradeaus nach oben
  const SCHRAEG_MAX = (64 / 180) * Math.PI;   // so schräg liegt eine Gerade höchstens

  // Tempo und Breite, beide nach der Strecke: am Anfang breit und gemächlich,
  // nach einem Kilometer eng und schnell.
  const V0 = 175;
  const V_MAX = 440;
  const V_WEG = 950;               // Meter
  const BREIT0 = 128;
  const BREIT_MIN = 66;
  const BREIT_WEG = 900;
  const TAKT = 1 / 240;

  // Der Wagen, wie er trifft: die vier Ecken, etwas kleiner als gezeichnet,
  // ausgerichtet nach der Fahrtrichtung (nicht nach dem Drift).
  const HALB_B = 5.2;
  const HALB_L = 9.5;

  const TOP_COUNT = 5;
  const store = cloudApi
    ? cloudApi.register({ key: "lernapp.drift", empty: { runs: 0, scores: [] }, merge: cloudApi.mergeScores(TOP_COUNT) })
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
  const meterBei = (s) => Math.max(0, (s - START_S) / METER);
  const tempoBei = (s) => V0 + (V_MAX - V0) * (1 - Math.exp(-meterBei(s) / V_WEG));
  const breiteBei = (s) => BREIT_MIN + (BREIT0 - BREIT_MIN) * Math.exp(-meterBei(s) / BREIT_WEG);
  // Wie viel die Strasse an dieser Stelle verlangt: anfangs wenig, nach
  // oben immer mehr – nie alles.
  const schwereBei = (s) => 1 - Math.exp(-meterBei(s) / 900);
  // Wie schnell der Wagen im Drift höchstens dreht, in Bogenmass je Sekunde.
  // Daraus folgt der kleinste Radius bei einem Tempo – sonst flöge die
  // Gerade schneller vorbei, als ein Finger loslassen kann.
  const drehMaxBei = (s) => lerp(3.1, 4.1, schwereBei(s));
  // Wie genau der Wagen beim Loslassen in die Gerade zeigen muss, damit er
  // selbst nachlenkt: ein Zeitfenster um den richtigen Moment, anfangs eine
  // gute Zehntelsekunde, nach oben etwas weniger – und nie weniger als neun
  // Grad.
  const toleranzBei = (s, dreh) => Math.max((9 * Math.PI) / 180, dreh * lerp(0.13, 0.075, schwereBei(s)));
  const perfektBei = (dreh) => Math.max((2.2 * Math.PI) / 180, dreh * 0.03);

  // Der kürzeste Weg von Winkel b zu Winkel a, zwischen -π und π.
  function winkelDiff(a, b) {
    let d = (a - b) % (Math.PI * 2);
    if (d > Math.PI) d -= Math.PI * 2;
    if (d < -Math.PI) d += Math.PI * 2;
    return d;
  }

  // Immer dieselbe Zahl zu derselben Eingabe: Bäume, Steine und Flecken im
  // Gras stehen bei jedem Bild am selben Platz, ohne den Zufall der Strasse
  // anzufassen.
  function hash01(n) {
    const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return x - Math.floor(x);
  }

  const kachel = (x, y) => `${Math.floor(x / KACHEL)},${Math.floor(y / KACHEL)}`;

  // ---------------------------------------------------------------------------
  // Zustand
  // ---------------------------------------------------------------------------
  // phase:   "bereit" (noch nichts gedrückt), "spiel", "ende"
  // schritt: "start", "fahrt", "crash"
  const state = {
    phase: "bereit",
    schritt: "start",
    punkte: 0,
    meter: 0,
    spitze: 0,
    perfekt: 0,
    serie: 0,
    auto: { x: 0, y: 0, a: HAUPT, s: 0, i: 0 },
    koerper: HAUPT,       // wohin die Karosserie zeigt – im Drift schräg zur Fahrt
    drift: 0,             // der Winkel zwischen Fahrt und Karosserie
    dreh: null,           // das Seil: { kurve, r, phi, sig }
    richten: null,        // nach dem Loslassen: { ziel } – der Wagen lenkt nach
    kNr: 0,               // die nächste Kurve, um die gedriftet wird
    wartetAufLos: false,  // der Druck, der die Runde startet, driftet nicht
    bahn: null,
    spuren: [],
    teile: [],
    schriften: [],
    striche: [],
    camX: 0,
    camY: 0,
    zoom: 1,
    stoss: 0,
    zeit: 0,
    crashZeit: 0,
    dreht: 0,
  };

  let shell = null;
  let feld = null;
  let canvas = null;
  let g = null;
  let frame = null;
  let last = 0;
  let stepTimer = null;
  let gedrueckt = false;
  let gegner = null;
  // Wer eine Fahrt anschaut statt zu fahren (geist.js, zuschauer).
  let zuschauer = null;
  let asphalt = null;
  // Motor und Reifen (klang.js): zwei Schleifen, solange der Wagen fährt.
  let motor = null;
  let reifen = null;

  const view = { s: 1, grund: 1, dpr: 1, cssW: 0, cssH: 0, w: MIN_W, h: MIN_H };

  function clearStep() {
    if (stepTimer) { window.clearTimeout(stepTimer); stepTimer = null; }
  }

  function stopLoop() {
    if (frame) { window.cancelAnimationFrame(frame); frame = null; }
  }

  // ---------------------------------------------------------------------------
  // Motor und Reifen
  // ---------------------------------------------------------------------------
  // Der Motor dreht mit dem Tempo hoch. Die Reifen rutschen hörbar, so weit
  // der Wagen quer steht – geradeaus (unter knapp zwei Grad) sind sie still.
  // Mehr als ein Bogenmass quer driftet kein Wagen: Das gibt es nur beim
  // Zuschauen, wenn die Richtung aus der Aufzeichnung am Anfang kurz
  // danebenliegt, oder wenn er sich nach dem Crash dreht – dann schweigen sie.
  function klaengeAn() {
    motor = klang()?.kulisse("drift.motor") || null;
    reifen = klang()?.kulisse("drift.drift") || null;
    klaengeStellen();
  }

  function klaengeStellen() {
    motor?.setze(tempoBei(state.auto.s) / V_MAX);
    const quer = Math.abs(winkelDiff(state.koerper, state.auto.a));
    reifen?.laut(quer > 1 ? 0 : clamp((quer - 0.03) / 0.4, 0, 1));
  }

  function klaengeAus() {
    motor?.stop();
    reifen?.stop();
    motor = null;
    reifen = null;
  }

  // ---------------------------------------------------------------------------
  // Die Strasse
  // ---------------------------------------------------------------------------
  /*
   * Die Mittellinie ist eine Kette von Stützpunkten im Abstand DS, jeder mit
   * seiner Richtung a, seiner Strecke s und der Breite der Strasse dort.
   * Gebaut wird sie Stück um Stück: zuerst die Startgerade, dann immer eine
   * Kurve mit der Geraden danach.
   *
   * Eine Kurve ist ein Kreisbogen um ihren Drehpunkt. Ihr Radius ist so
   * gross, dass die Strasse innen noch Platz hat; die Gerade danach ist so
   * lang, dass man nach dem Loslassen Zeit hat, und so schräg, dass es immer
   * aufwärts geht. Ein Stück, das einem früheren zu nahe käme – eine Kehre
   * über der vorigen –, wird verworfen und anders gewürfelt.
   */
  function neueBahn() {
    return {
      proben: [],
      kurven: [],
      gitter: new Map(),
      deko: new Map(),
      kopf: { x: 0, y: -START_S - VORLAUF, a: HAUPT, s: -VORLAUF },
      gebaut: 0,
    };
  }

  // Die Stützpunkte eines Stücks, ohne sie schon abzulegen.
  function gerade(kopf, L) {
    const n = Math.max(1, Math.round(L / DS));
    const schritt = L / n;
    const dx = Math.cos(kopf.a);
    const dy = Math.sin(kopf.a);
    const punkte = [];
    for (let i = 1; i <= n; i += 1) {
      punkte.push({ x: kopf.x + dx * schritt * i, y: kopf.y + dy * schritt * i, a: kopf.a, s: kopf.s + schritt * i, k: -1 });
    }
    return punkte;
  }

  function bogen(kopf, R, sig, sweep, kNr) {
    const px = kopf.x + R * Math.cos(kopf.a + sig * HAUPT);
    const py = kopf.y + R * Math.sin(kopf.a + sig * HAUPT);
    const phi0 = kopf.a - sig * HAUPT;
    const L = R * sweep;
    const n = Math.max(2, Math.round(L / DS));
    const punkte = [];
    for (let i = 1; i <= n; i += 1) {
      const t = (sweep * i) / n;
      const phi = phi0 + sig * t;
      punkte.push({ x: px + R * Math.cos(phi), y: py + R * Math.sin(phi), a: kopf.a + sig * t, s: kopf.s + (L * i) / n, k: kNr });
    }
    return {
      punkte,
      kurve: { px, py, R, sig, a0: kopf.a, a1: kopf.a + sig * sweep, s0: kopf.s, s1: kopf.s + L, sweep },
    };
  }

  // Kommt einer der neuen Punkte einem früheren Stück Strasse zu nahe? Nah
  // beieinander dürfen nur Punkte sein, die auch auf der Strasse nah
  // beieinander liegen.
  function zuNah(bahn, neue) {
    for (const q of neue) {
      const wq = breiteBei(q.s);
      const kx = Math.floor(q.x / KACHEL);
      const ky = Math.floor(q.y / KACHEL);
      for (let ix = kx - 3; ix <= kx + 3; ix += 1) {
        for (let iy = ky - 3; iy <= ky + 3; iy += 1) {
          const liste = bahn.gitter.get(`${ix},${iy}`);
          if (!liste) continue;
          for (const j of liste) {
            const p = bahn.proben[j];
            const ds = q.s - p.s;
            const soll = Math.min(ds * 0.6, wq / 2 + p.w / 2 + SPALT);
            const dx = q.x - p.x;
            const dy = q.y - p.y;
            if (dx * dx + dy * dy < soll * soll) return true;
          }
        }
      }
    }
    return false;
  }

  // Was schon neben der Strasse steht und nun auf den Drehpunkt einer neuen
  // Kurve fiele, kommt weg.
  function raeumeDrehpunkt(bahn, kurve) {
    const kx = Math.floor(kurve.px / KACHEL);
    const ky = Math.floor(kurve.py / KACHEL);
    for (let ix = kx - 2; ix <= kx + 2; ix += 1) {
      for (let iy = ky - 2; iy <= ky + 2; iy += 1) {
        const key = `${ix},${iy}`;
        const liste = bahn.deko.get(key);
        if (!liste) continue;
        bahn.deko.set(key, liste.filter((d) => Math.hypot(d.x - kurve.px, d.y - kurve.py) >= d.r + 16));
      }
    }
  }

  function lege(bahn, punkte) {
    punkte.forEach((p) => {
      p.w = breiteBei(p.s);
      const i = bahn.proben.length;
      bahn.proben.push(p);
      const key = kachel(p.x, p.y);
      if (!bahn.gitter.has(key)) bahn.gitter.set(key, []);
      bahn.gitter.get(key).push(i);
    });
    const ende = punkte[punkte.length - 1];
    bahn.kopf = { x: ende.x, y: ende.y, a: ende.a, s: ende.s };
  }

  function naechstesStueck() {
    const bahn = state.bahn;
    if (!bahn.proben.length) {
      const start = gerade(bahn.kopf, START_GERADE + VORLAUF);
      lege(bahn, start);
      deko(bahn, start);
      return;
    }
    const kopf = bahn.kopf;
    const k = schwereBei(kopf.s);
    const w = breiteBei(kopf.s);
    const v = tempoBei(kopf.s);
    const kNr = bahn.kurven.length;

    for (let versuch = 0; versuch < 14; versuch += 1) {
      // Der Knick: mal sanft, mal eine Kehre. Wohin, entscheidet der Zufall
      // unter dem, was die Strasse aufwärts hält.
      const grad = [34, 48, 62, 80, 98, 118, 134][Math.floor(zufall.zahl() * 7)];
      const sweep = (grad * Math.PI) / 180;
      const links = kopf.a + sweep - HAUPT <= SCHRAEG_MAX;
      const rechts = HAUPT - (kopf.a - sweep) <= SCHRAEG_MAX;
      const wahl = zufall.zahl();
      if (!links && !rechts) continue;
      const sig = links && rechts ? (wahl < 0.5 ? 1 : -1) : links ? 1 : -1;
      const innen = lerp(46, 22, k);
      const R = Math.max(w / 2 + innen, v / drehMaxBei(kopf.s)) + zufall.zahl() * lerp(90, 44, k);
      const kurve = bogen(kopf, R, sig, sweep, kNr);
      const nachher = { x: kurve.punkte[kurve.punkte.length - 1].x, y: kurve.punkte[kurve.punkte.length - 1].y, a: kurve.kurve.a1, s: kurve.kurve.s1 };
      const Lmin = Math.max(lerp(210, 118, k), v * lerp(0.95, 0.46, k));
      const L = Lmin + zufall.zahl() * lerp(230, 120, k);
      const danach = gerade(nachher, L);
      if (zuNah(bahn, [...kurve.punkte, ...danach])) continue;
      bahn.kurven.push(kurve.kurve);
      raeumeDrehpunkt(bahn, kurve.kurve);
      lege(bahn, kurve.punkte);
      lege(bahn, danach);
      deko(bahn, kurve.punkte.concat(danach));
      return;
    }

    // Nichts passte: zurück in die Senkrechte, mit weitem Bogen, und ein
    // gutes Stück geradeaus. Das kommt keinem früheren Stück nahe.
    const sig = kopf.a > HAUPT ? -1 : 1;
    const sweep = Math.max(0.35, Math.abs(kopf.a - HAUPT));
    const kurve = bogen(kopf, Math.max(w / 2 + 70, v / drehMaxBei(kopf.s)), sig, sweep, kNr);
    const nachher = { x: kurve.punkte[kurve.punkte.length - 1].x, y: kurve.punkte[kurve.punkte.length - 1].y, a: kurve.kurve.a1, s: kurve.kurve.s1 };
    const danach = gerade(nachher, Math.max(220, v * 0.9));
    bahn.kurven.push(kurve.kurve);
    raeumeDrehpunkt(bahn, kurve.kurve);
    lege(bahn, kurve.punkte);
    lege(bahn, danach);
    deko(bahn, kurve.punkte.concat(danach));
  }

  function bahnBis(s) {
    while (state.bahn.kopf.s < s) naechstesStueck();
  }

  // Der Stützpunkt bei einer Strecke s, und seine Nummer.
  function indexBei(s) {
    const p = state.bahn.proben;
    bahnBis(s + DS * 2);
    let lo = 0;
    let hi = p.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (p[mid].s < s) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  }

  const probeBei = (s) => state.bahn.proben[indexBei(s)];

  // Wie weit ein Punkt von der Mittellinie entfernt ist – gesucht nur in der
  // Nähe des Stützpunkts i. Ein anderes Stück Strasse weiter weg zählt nicht:
  // Wer von der Strasse abkommt, landet im Gras, nicht auf der nächsten
  // Kehre.
  function abstand(x, y, i, fenster = 40) {
    const p = state.bahn.proben;
    let best = Infinity;
    let bi = i;
    const von = Math.max(0, i - fenster);
    const bis = Math.min(p.length - 1, i + fenster);
    for (let j = von; j <= bis; j += 1) {
      const dx = x - p[j].x;
      const dy = y - p[j].y;
      const d = dx * dx + dy * dy;
      if (d < best) { best = d; bi = j; }
    }
    return { d: Math.sqrt(best), i: bi };
  }

  // ---------------------------------------------------------------------------
  // Die Landschaft
  // ---------------------------------------------------------------------------
  // Vier Gegenden, nach der Höhe: Wiese, Wald, Fels, Schnee. Die Grenzen
  // verlaufen weich.
  const GEGENDEN = [
    { bis: 3400, boden: [118, 176, 74], dunkel: [86, 140, 52], hell: [158, 204, 98] },
    { bis: 8200, boden: [72, 128, 66], dunkel: [44, 92, 46], hell: [104, 160, 86] },
    { bis: 13500, boden: [138, 132, 112], dunkel: [104, 98, 84], hell: [176, 170, 146] },
    { bis: Infinity, boden: [226, 234, 242], dunkel: [184, 198, 216], hell: [250, 252, 255] },
  ];
  const UEBERGANG = 1400;

  function gegendBei(y) {
    for (let i = 0; i < GEGENDEN.length; i += 1) {
      if (y < GEGENDEN[i].bis) {
        const naechste = GEGENDEN[i + 1];
        const k = naechste ? clamp((y - (GEGENDEN[i].bis - UEBERGANG)) / UEBERGANG, 0, 1) : 0;
        return { i, k };
      }
    }
    return { i: GEGENDEN.length - 1, k: 0 };
  }

  function mische(a, b, k) {
    return [Math.round(lerp(a[0], b[0], k)), Math.round(lerp(a[1], b[1], k)), Math.round(lerp(a[2], b[2], k))];
  }

  function farbeBei(y, welche) {
    const { i, k } = gegendBei(y);
    const a = GEGENDEN[i][welche];
    const b = GEGENDEN[Math.min(GEGENDEN.length - 1, i + 1)][welche];
    const c = mische(a, b, k);
    return `rgb(${c[0]},${c[1]},${c[2]})`;
  }

  // Was am Rand der Strasse steht. Gewählt nach der Gegend, mit festen
  // Zahlen aus dem Ort – nicht aus dem Zufall der Strasse.
  const DEKO_ARTEN = [
    [["laub", 0.33], ["busch", 0.27], ["blumen", 0.16], ["haus", 0.06], ["stein", 0.08], ["tanne", 0.08], ["teich", 0.012]],
    [["tanne", 0.68], ["laub", 0.08], ["busch", 0.12], ["stein", 0.1], ["teich", 0.012]],
    [["stein", 0.5], ["tanne", 0.25], ["busch", 0.23], ["teich", 0.012]],
    [["schneetanne", 0.6], ["schneestein", 0.37], ["teich", 0.014]],
  ];
  const DEKO_R = { laub: 15, busch: 7, blumen: 10, haus: 17, stein: 8, tanne: 12, schneetanne: 12, schneestein: 9, teich: 46 };

  function dekoArt(y, h) {
    const { i, k } = gegendBei(y);
    const gegend = h < k ? Math.min(GEGENDEN.length - 1, i + 1) : i;
    const arten = DEKO_ARTEN[gegend];
    let r = hash01(h * 91.7 + 3.3);
    for (const [art, anteil] of arten) {
      if (r < anteil) return art;
      r -= anteil;
    }
    return arten[0][0];
  }

  // Deko neben einem neuen Stück Strasse – nie auf einer Strasse, auch nicht
  // auf einer anderen Kehre, und mit Abstand zur Leitplanke.
  function deko(bahn, punkte) {
    for (let n = 0; n < punkte.length; n += 3) {
      const p = punkte[n];
      const nr = bahn.gebaut;
      bahn.gebaut += 1;
      for (let seite = -1; seite <= 1; seite += 2) {
        const h = nr * 2 + (seite > 0 ? 1 : 0);
        if (hash01(h * 3.71 + 0.2) > 0.42) continue;
        const art = dekoArt(p.y, hash01(h * 5.3 + 1.1));
        const r = DEKO_R[art] * (0.8 + hash01(h * 7.9 + 2.4) * 0.5);
        const weg = p.w / 2 + 14 + r + Math.pow(hash01(h * 2.3 + 4.4), 1.6) * 230;
        const nx = -Math.sin(p.a) * seite;
        const ny = Math.cos(p.a) * seite;
        const x = p.x + nx * weg + (hash01(h * 6.1) - 0.5) * 16;
        const y = p.y + ny * weg + (hash01(h * 8.3) - 0.5) * 16;
        if (aufStrasse(bahn, x, y, r + 12)) continue;
        if (stoesst(bahn, x, y, r, art)) continue;
        // Und nichts auf dem Drehpunkt einer Kurve: Den soll man sehen.
        if (bahn.kurven.slice(-3).some((k) => Math.hypot(k.px - x, k.py - y) < r + 16)) continue;
        const key = kachel(x, y);
        if (!bahn.deko.has(key)) bahn.deko.set(key, []);
        bahn.deko.get(key).push({ x, y, r, art, h: hash01(h * 4.7 + 9.1), w: hash01(h * 1.3 + 7.7) * Math.PI * 2 });
      }
    }
  }

  // Teiche und Häuser stehen für sich: Nichts wächst in sie hinein. Bäume
  // dürfen einander berühren – so wird es ein Wald.
  function stoesst(bahn, x, y, r, art) {
    const gross = art === "teich" || art === "haus";
    const kx = Math.floor(x / KACHEL);
    const ky = Math.floor(y / KACHEL);
    for (let ix = kx - 2; ix <= kx + 2; ix += 1) {
      for (let iy = ky - 2; iy <= ky + 2; iy += 1) {
        const liste = bahn.deko.get(`${ix},${iy}`);
        if (!liste) continue;
        for (const d of liste) {
          const fest = gross || d.art === "teich" || d.art === "haus";
          const soll = fest ? r + d.r + 6 : (r + d.r) * 0.45;
          const dx = x - d.x;
          const dy = y - d.y;
          if (dx * dx + dy * dy < soll * soll) return true;
        }
      }
    }
    return false;
  }

  function aufStrasse(bahn, x, y, rand) {
    const kx = Math.floor(x / KACHEL);
    const ky = Math.floor(y / KACHEL);
    for (let ix = kx - 3; ix <= kx + 3; ix += 1) {
      for (let iy = ky - 3; iy <= ky + 3; iy += 1) {
        const liste = bahn.gitter.get(`${ix},${iy}`);
        if (!liste) continue;
        for (const j of liste) {
          const p = bahn.proben[j];
          const soll = p.w / 2 + rand;
          const dx = x - p.x;
          const dy = y - p.y;
          if (dx * dx + dy * dy < soll * soll) return true;
        }
      }
    }
    return false;
  }

  // ---------------------------------------------------------------------------
  // Die Fläche
  // ---------------------------------------------------------------------------
  function buildPlatz() {
    const platz = shell.el("div", "dt-platz");
    feld = shell.el("div", "dt-feld");
    canvas = document.createElement("canvas");
    canvas.className = "dt-canvas";
    canvas.setAttribute("aria-hidden", "true");
    feld.append(canvas);
    g = canvas.getContext("2d");

    // Der Hinweis vor dem ersten Druck: ein Ring, der sich füllt.
    const tipp = shell.el("span", "dt-tipp");
    tipp.setAttribute("aria-hidden", "true");
    const ns = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(ns, "svg");
    svg.setAttribute("viewBox", "0 0 64 64");
    [
      { r: 22, stroke: "rgba(255,255,255,0.45)", w: 5 },
      { r: 22, stroke: "#ffffff", w: 5, klasse: "dt-tipp-fuell" },
    ].forEach((ring) => {
      const kreis = document.createElementNS(ns, "circle");
      kreis.setAttribute("cx", "32");
      kreis.setAttribute("cy", "32");
      kreis.setAttribute("r", String(ring.r));
      kreis.setAttribute("fill", "none");
      kreis.setAttribute("stroke", ring.stroke);
      kreis.setAttribute("stroke-width", String(ring.w));
      if (ring.klasse) {
        kreis.setAttribute("class", ring.klasse);
        kreis.setAttribute("stroke-linecap", "round");
      }
      svg.append(kreis);
    });
    const punkt = document.createElementNS(ns, "circle");
    punkt.setAttribute("cx", "32");
    punkt.setAttribute("cy", "32");
    punkt.setAttribute("r", "9");
    punkt.setAttribute("fill", "#ffffff");
    svg.append(punkt);
    tipp.append(svg);
    feld.append(tipp);
    platz.append(feld);
    return platz;
  }

  // Ein feines Korn für den Asphalt – einmal gemalt, dann als Muster.
  function asphaltMuster() {
    const c = document.createElement("canvas");
    c.width = 96;
    c.height = 96;
    const m = c.getContext("2d");
    m.fillStyle = "#3d414c";
    m.fillRect(0, 0, 96, 96);
    for (let i = 0; i < 520; i += 1) {
      const x = hash01(i * 1.7) * 96;
      const y = hash01(i * 2.9 + 1) * 96;
      const hell = hash01(i * 4.1 + 2) < 0.5;
      m.fillStyle = hell ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.14)";
      m.fillRect(x, y, 1 + hash01(i * 5.3) * 1.6, 1 + hash01(i * 6.7) * 1.6);
    }
    return g.createPattern(c, "repeat");
  }

  function messen() {
    if (!canvas || !feld) return;
    const cssW = Math.max(80, feld.clientWidth);
    const cssH = Math.max(80, feld.clientHeight);
    const dpr = clamp(window.devicePixelRatio || 1, 1, 2.5);
    if (cssW === view.cssW && cssH === view.cssH && dpr === view.dpr) return;
    view.cssW = cssW;
    view.cssH = cssH;
    view.dpr = dpr;
    // Mindestens MIN_W breit und MIN_H hoch: Im Hochformat sieht man weit
    // voraus, im Querformat mehr Landschaft daneben.
    view.grund = Math.min(cssW / MIN_W, cssH / MIN_H);
    const pw = Math.round(cssW * dpr);
    const ph = Math.round(cssH * dpr);
    if (canvas.width !== pw) canvas.width = pw;
    if (canvas.height !== ph) canvas.height = ph;
    asphalt = asphaltMuster();
    skaliere();
  }

  function skaliere() {
    view.s = view.grund * state.zoom;
    view.w = view.cssW / view.s;
    view.h = view.cssH / view.s;
  }

  const wackel = () => (ruhig() ? 0 : Math.sin(state.zeit * 70) * 4 * state.stoss);

  function bildTransform() {
    g.setTransform(view.dpr, 0, 0, view.dpr, 0, wackel() * view.dpr);
  }

  function weltTransform() {
    const f = view.s * view.dpr;
    g.setTransform(f, 0, 0, -f, (view.cssW / 2 - state.camX * view.s) * view.dpr, (view.cssH / 2 + state.camY * view.s + wackel()) * view.dpr);
  }

  const bildX = (x) => view.cssW / 2 + (x - state.camX) * view.s;
  const bildY = (y) => view.cssH / 2 - (y - state.camY) * view.s;

  // Was gerade zu sehen ist, in der Welt – mit etwas Rand.
  function sicht(rand = 40) {
    return {
      x0: state.camX - view.w / 2 - rand,
      x1: state.camX + view.w / 2 + rand,
      y0: state.camY - view.h / 2 - rand,
      y1: state.camY + view.h / 2 + rand,
    };
  }

  // ---------------------------------------------------------------------------
  // Zeichnen
  // ---------------------------------------------------------------------------
  function zeichneBoden() {
    bildTransform();
    const W = view.cssW;
    const H = view.cssH;
    const s = sicht(0);
    // Von oben nach unten die Farbe der Höhe – die Gegenden ziehen vorbei.
    const verlauf = g.createLinearGradient(0, 0, 0, H);
    for (let k = 0; k <= 6; k += 1) {
      verlauf.addColorStop(k / 6, farbeBei(lerp(s.y1, s.y0, k / 6), "boden"));
    }
    g.fillStyle = verlauf;
    g.fillRect(0, -10, W, H + 20);

    // Flecken im Gras: hellere und dunklere Wolken, fest an ihrem Ort.
    weltTransform();
    const ZELLE = 110;
    const sx0 = Math.floor((s.x0 - ZELLE) / ZELLE);
    const sx1 = Math.floor((s.x1 + ZELLE) / ZELLE);
    const sy0 = Math.floor((s.y0 - ZELLE) / ZELLE);
    const sy1 = Math.floor((s.y1 + ZELLE) / ZELLE);
    for (let ix = sx0; ix <= sx1; ix += 1) {
      for (let iy = sy0; iy <= sy1; iy += 1) {
        const h = hash01(ix * 31.3 + iy * 17.9 + 0.7);
        const x = (ix + hash01(h * 11.1)) * ZELLE;
        const y = (iy + hash01(h * 13.7)) * ZELLE;
        const hell = h < 0.5;
        const schnee = gegendBei(y).i === GEGENDEN.length - 1;
        g.fillStyle = farbeBei(y, hell ? "hell" : "dunkel");
        g.globalAlpha = schnee ? 0.16 : 0.24;
        g.beginPath();
        g.ellipse(x, y, 34 + h * 40, 26 + hash01(h * 5.1) * 26, hash01(h * 3.3) * Math.PI, 0, Math.PI * 2);
        g.fill();
        // Ein paar Halme oder Blüten auf der Wiese, Kiesel im Fels.
        const gegend = gegendBei(y).i;
        if (gegend <= 2) {
          g.globalAlpha = gegend === 0 ? 0.8 : 0.5;
          for (let j = 0; j < 5; j += 1) {
            const hx = x + (hash01(h * 7.1 + j) - 0.5) * 90;
            const hy = y + (hash01(h * 9.3 + j) - 0.5) * 90;
            g.fillStyle = gegend === 0
              ? ["#fff6c2", "#ffffff", "#ffd1e8", "#fff27a"][j % 4]
              : gegend === 1 ? "#2f6b34" : "#8a8270";
            g.beginPath();
            g.arc(hx, hy, gegend === 0 ? 1.6 : 2.2, 0, Math.PI * 2);
            g.fill();
          }
        }
      }
    }
    g.globalAlpha = 1;
  }

  // Die sichtbaren Stützpunkte: der kleinste und der grösste, die im Bild
  // liegen. Dazwischen wird alles gezeichnet – auch eine Kehre, die kurz
  // aus dem Bild hinausläuft.
  function sichtbereich() {
    const bahn = state.bahn;
    const s = sicht(160);
    let i0 = Infinity;
    let i1 = -1;
    const kx0 = Math.floor(s.x0 / KACHEL);
    const kx1 = Math.floor(s.x1 / KACHEL);
    const ky0 = Math.floor(s.y0 / KACHEL);
    const ky1 = Math.floor(s.y1 / KACHEL);
    for (let ix = kx0; ix <= kx1; ix += 1) {
      for (let iy = ky0; iy <= ky1; iy += 1) {
        const liste = bahn.gitter.get(`${ix},${iy}`);
        if (!liste) continue;
        for (const j of liste) {
          if (j < i0) i0 = j;
          if (j > i1) i1 = j;
        }
      }
    }
    if (i1 < 0) return null;
    return { i0: Math.max(0, i0 - 2), i1: Math.min(bahn.proben.length - 1, i1 + 2) };
  }

  function rand(p, versatz) {
    return { x: p.x - Math.sin(p.a) * versatz, y: p.y + Math.cos(p.a) * versatz };
  }

  // Ein Band entlang der Mittellinie: von versatzA bis versatzB (links
  // positiv), als eine Fläche.
  function band(von, bis, versatzA, versatzB) {
    const p = state.bahn.proben;
    g.beginPath();
    for (let j = von; j <= bis; j += 1) {
      const r = rand(p[j], versatzA(p[j]));
      if (j === von) g.moveTo(r.x, r.y);
      else g.lineTo(r.x, r.y);
    }
    for (let j = bis; j >= von; j -= 1) {
      const r = rand(p[j], versatzB(p[j]));
      g.lineTo(r.x, r.y);
    }
    g.closePath();
  }

  function linie(von, bis, versatz) {
    const p = state.bahn.proben;
    g.beginPath();
    for (let j = von; j <= bis; j += 1) {
      const r = rand(p[j], versatz(p[j]));
      if (j === von) g.moveTo(r.x, r.y);
      else g.lineTo(r.x, r.y);
    }
  }

  function zeichneStrasse(bereich) {
    const p = state.bahn.proben;
    const { i0, i1 } = bereich;
    weltTransform();
    g.lineJoin = "round";
    g.lineCap = "butt";

    // Der Schatten der Strasse und das Bankett aus Kies.
    const kies = gegendBei(state.camY).i === GEGENDEN.length - 1 ? "#c9d2dd" : "#c4b48f";
    g.fillStyle = "rgba(0,0,0,0.18)";
    band(i0, i1, (q) => q.w / 2 + 12, (q) => -q.w / 2 - 6);
    g.fill();
    g.fillStyle = kies;
    band(i0, i1, (q) => q.w / 2 + 9, (q) => -q.w / 2 - 9);
    g.fill();

    // Der Asphalt.
    g.fillStyle = asphalt || "#3d414c";
    band(i0, i1, (q) => q.w / 2, (q) => -q.w / 2);
    g.fill();

    // Randlinien und die gestrichelte Mitte.
    g.strokeStyle = "rgba(255,255,255,0.9)";
    g.lineWidth = 2.2;
    linie(i0, i1, (q) => q.w / 2 - 4);
    g.stroke();
    linie(i0, i1, (q) => -q.w / 2 + 4);
    g.stroke();
    g.strokeStyle = "rgba(255, 214, 77, 0.9)";
    g.lineWidth = 2;
    g.setLineDash([16, 14]);
    g.lineDashOffset = p[i0].s;
    linie(i0, i1, () => 0);
    g.stroke();
    g.setLineDash([]);

    // Randsteine innen in den Kurven: rot und weiss.
    for (let j = i0; j < i1; j += 1) {
      const q = p[j];
      if (q.k < 0) continue;
      const kurve = state.bahn.kurven[q.k];
      const innen = kurve.sig * (q.w / 2 - 3);
      const a = rand(q, innen);
      const b = rand(p[j + 1], kurve.sig * (p[j + 1].w / 2 - 3));
      g.strokeStyle = Math.floor(q.s / 9) % 2 ? "#e8433a" : "#ffffff";
      g.lineWidth = 6;
      g.beginPath();
      g.moveTo(a.x, a.y);
      g.lineTo(b.x, b.y);
      g.stroke();
    }

    // Die Leitplanken, beidseits, mit Pfosten.
    g.strokeStyle = "rgba(0,0,0,0.25)";
    g.lineWidth = 4;
    linie(i0, i1, (q) => q.w / 2 + 5.5);
    g.stroke();
    linie(i0, i1, (q) => -q.w / 2 - 5.5);
    g.stroke();
    g.strokeStyle = "#dfe5ee";
    g.lineWidth = 2.4;
    linie(i0, i1, (q) => q.w / 2 + 5);
    g.stroke();
    linie(i0, i1, (q) => -q.w / 2 - 5);
    g.stroke();
    g.fillStyle = "#5b6475";
    for (let j = i0; j <= i1; j += 1) {
      if (j % 5) continue;
      [1, -1].forEach((seite) => {
        const r = rand(p[j], seite * (p[j].w / 2 + 7.5));
        g.fillRect(r.x - 1.3, r.y - 1.3, 2.6, 2.6);
      });
    }
  }

  // Die Startlinie: ein Schachbrett quer über die Strasse.
  function zeichneZielstreifen(sWo, farbeA, farbeB, alpha = 1) {
    const q = probeBei(sWo);
    weltTransform();
    g.save();
    g.translate(q.x, q.y);
    g.rotate(q.a - HAUPT);
    g.globalAlpha = alpha;
    const felder = 8;
    const breite = q.w / felder;
    for (let i = 0; i < felder; i += 1) {
      for (let j = 0; j < 2; j += 1) {
        g.fillStyle = (i + j) % 2 ? farbeA : farbeB;
        g.fillRect(-q.w / 2 + i * breite, j * 5 - 5, breite, 5);
      }
    }
    g.restore();
    g.globalAlpha = 1;
  }

  // Die Gegner: ein Streifen quer über die Strasse bei ihren Metern, mit
  // Namen daneben. Wer darüber ist, hat sie geschlagen.
  function zeichneGegner() {
    const ziele = (gegner?.gegner?.() || []).filter((ziel) => ziel.art !== "alle");
    if (!ziele.length) return;
    const s = sicht(60);
    ziele.forEach((ziel) => {
      const sWo = START_S + ziel.punkte * METER;
      const q = probeBei(sWo);
      if (q.x < s.x0 || q.x > s.x1 || q.y < s.y0 || q.y > s.y1) return;
      const geschlagen = state.punkte > ziel.punkte;
      zeichneZielstreifen(sWo, ziel.farbe, "#ffffff", geschlagen ? 0.35 : 0.95);
      bildTransform();
      const gross = Math.round(clamp(view.cssH * 0.03, 10, 14));
      g.font = `800 ${gross}px system-ui, sans-serif`;
      g.textAlign = "center";
      g.textBaseline = "middle";
      const r = rand(q, q.w / 2 + 26);
      const text = ziel.art === "eigen" ? `Bestmarke ${ziel.punkte} m` : `${ziel.name} ${ziel.punkte} m`;
      g.globalAlpha = geschlagen ? 0.45 : 1;
      g.lineWidth = 3;
      g.strokeStyle = "rgba(20, 24, 36, 0.75)";
      g.strokeText(text, bildX(r.x), bildY(r.y));
      g.fillStyle = "#ffffff";
      g.fillText(text, bildX(r.x), bildY(r.y));
      g.globalAlpha = 1;
    });
  }

  // Alle hundert Meter steht die Zahl auf dem Asphalt.
  function zeichneMarken() {
    const s = sicht(60);
    const vonM = Math.max(100, Math.ceil(meterBei(state.auto.s - view.h) / 100) * 100);
    const bisM = meterBei(state.auto.s + view.h * 1.5);
    const gross = clamp(14 * view.s, 10, 26);
    bildTransform();
    g.font = `900 ${Math.round(gross)}px system-ui, sans-serif`;
    g.textAlign = "center";
    g.textBaseline = "middle";
    for (let m = vonM; m <= bisM; m += 100) {
      const q = probeBei(START_S + m * METER);
      if (q.x < s.x0 || q.x > s.x1 || q.y < s.y0 || q.y > s.y1) continue;
      g.save();
      g.translate(bildX(q.x), bildY(q.y));
      g.rotate(-(q.a - HAUPT));
      g.fillStyle = "rgba(255,255,255,0.55)";
      g.fillText(`${m} m`, 0, 0);
      g.restore();
    }
  }

  // Pfeiltafeln aussen an jeder engen Kurve, damit man sie kommen sieht.
  function zeichneTafeln(bereich) {
    const bahn = state.bahn;
    const s = sicht(60);
    weltTransform();
    bahn.kurven.forEach((kurve) => {
      if (kurve.sweep < 1.1) return;
      const qa = probeBei(kurve.s0);
      if (qa.s > bahn.proben[bereich.i1].s || probeBei(kurve.s1).s < bahn.proben[bereich.i0].s) return;
      [0.25, 0.5, 0.75].forEach((anteil) => {
        const q = probeBei(lerp(kurve.s0, kurve.s1, anteil));
        if (q.x < s.x0 || q.x > s.x1 || q.y < s.y0 || q.y > s.y1) return;
        const r = rand(q, -kurve.sig * (q.w / 2 + 15));
        g.save();
        g.translate(r.x, r.y);
        g.rotate(q.a - HAUPT);
        g.fillStyle = "rgba(0,0,0,0.25)";
        g.fillRect(-6.5 + 1.5, -2.5 - 1.5, 13, 5);
        g.fillStyle = "#ffffff";
        g.fillRect(-6.5, -2.5, 13, 5);
        g.strokeStyle = "#e8433a";
        g.lineWidth = 1.6;
        g.beginPath();
        // Die Spitze zeigt in die Richtung der Kurve.
        const d = -kurve.sig;
        g.moveTo(-2.5 * d, -1.8);
        g.lineTo(1.5 * d, 0);
        g.lineTo(-2.5 * d, 1.8);
        g.moveTo(1.5 * -d + 3 * d, -1.8);
        g.lineTo(5 * d, 0);
        g.lineTo(1.5 * -d + 3 * d, 1.8);
        g.stroke();
        g.restore();
      });
    });
  }

  // Der Drehpunkt der nächsten Kurve: ein Pfosten im Gras, der leise
  // leuchtet – um ihn schwingt der Wagen, solange man hält.
  function zeichneDrehpunkt() {
    const kurve = aktiveKurve();
    if (!kurve || state.schritt === "crash") return;
    const s = sicht(30);
    if (kurve.px < s.x0 || kurve.px > s.x1 || kurve.py < s.y0 || kurve.py > s.y1) return;
    weltTransform();
    const puls = ruhig() ? 0.5 : 0.5 + 0.5 * Math.sin(state.zeit * 6);
    const an = Boolean(state.dreh);
    if (an) {
      g.strokeStyle = "rgba(255,255,255,0.35)";
      g.lineWidth = 1.2;
      g.setLineDash([4, 5]);
      g.beginPath();
      g.moveTo(kurve.px, kurve.py);
      g.lineTo(state.auto.x, state.auto.y);
      g.stroke();
      g.setLineDash([]);
    }
    g.fillStyle = `rgba(255, 220, 120, ${an ? 0.35 : 0.12 + puls * 0.12})`;
    g.beginPath();
    g.arc(kurve.px, kurve.py, an ? 9 : 7 + puls * 3, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "rgba(0,0,0,0.25)";
    g.beginPath();
    g.ellipse(kurve.px + 2, kurve.py - 2, 3.4, 2.6, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "#ff7a1a";
    g.beginPath();
    g.arc(kurve.px, kurve.py, 3.2, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "#ffffff";
    g.beginPath();
    g.arc(kurve.px, kurve.py, 1.4, 0, Math.PI * 2);
    g.fill();
  }

  function zeichneSpuren() {
    if (!state.spuren.length) return;
    weltTransform();
    g.lineCap = "round";
    g.strokeStyle = "rgba(20, 20, 24, 0.32)";
    g.lineWidth = 2.6;
    g.beginPath();
    state.spuren.forEach((sp) => {
      g.moveTo(sp.ax, sp.ay);
      g.lineTo(sp.bx, sp.by);
    });
    g.stroke();
  }

  // Deko in den Kacheln, die zu sehen sind. Zuerst alle Schatten, dann die
  // Dinge selbst – so fällt kein Schatten auf einen Baum daneben.
  function sichtbareDeko() {
    const s = sicht(40);
    const liste = [];
    const kx0 = Math.floor(s.x0 / KACHEL);
    const kx1 = Math.floor(s.x1 / KACHEL);
    const ky0 = Math.floor(s.y0 / KACHEL);
    const ky1 = Math.floor(s.y1 / KACHEL);
    for (let ix = kx0; ix <= kx1; ix += 1) {
      for (let iy = ky0; iy <= ky1; iy += 1) {
        const d = state.bahn.deko.get(`${ix},${iy}`);
        if (d) liste.push(...d);
      }
    }
    return liste;
  }

  function zeichneDekoSchatten(liste) {
    weltTransform();
    g.fillStyle = "rgba(10, 30, 10, 0.22)";
    liste.forEach((d) => {
      if (d.art === "blumen" || d.art === "teich") return;
      const r = d.r * (d.art === "haus" ? 1.15 : 1);
      g.beginPath();
      g.ellipse(d.x + r * 0.45, d.y - r * 0.45, r * 1.02, r * 0.86, -0.6, 0, Math.PI * 2);
      g.fill();
    });
  }

  function kreis(x, y, r, farbe) {
    g.fillStyle = farbe;
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
  }

  function zeichneDeko(liste) {
    weltTransform();
    liste.forEach((d) => {
      const { x, y, r } = d;
      switch (d.art) {
        case "teich": {
          // Ein Teich: ein Ufer aus Kies, das Wasser, ein heller Schimmer.
          // Oben im Schnee ist er zugefroren.
          const eis = gegendBei(y).i === GEGENDEN.length - 1;
          g.save();
          g.translate(x, y);
          g.rotate(d.w);
          g.fillStyle = eis ? "#d6e4f0" : "#c9b98f";
          g.beginPath();
          g.ellipse(0, 0, r * 1.08, r * 0.72, 0, 0, Math.PI * 2);
          g.fill();
          const wasser = g.createRadialGradient(-r * 0.2, r * 0.15, r * 0.1, 0, 0, r);
          wasser.addColorStop(0, eis ? "#eaf6ff" : "#5fb4e0");
          wasser.addColorStop(1, eis ? "#a9cbe6" : "#2a78b3");
          g.fillStyle = wasser;
          g.beginPath();
          g.ellipse(0, 0, r, r * 0.64, 0, 0, Math.PI * 2);
          g.fill();
          g.strokeStyle = "rgba(255,255,255,0.5)";
          g.lineWidth = 1.4;
          g.beginPath();
          g.ellipse(-r * 0.25, r * 0.18, r * 0.42, r * 0.16, 0, Math.PI * 1.1, Math.PI * 1.7);
          g.stroke();
          g.restore();
          break;
        }
        case "laub":
          kreis(x - r * 0.35, y - r * 0.15, r * 0.72, "#3f8a3a");
          kreis(x + r * 0.32, y - r * 0.2, r * 0.68, "#3a8236");
          kreis(x, y + r * 0.3, r * 0.74, "#46953f");
          kreis(x - r * 0.18, y + r * 0.32, r * 0.42, "#6cb85a");
          kreis(x - r * 0.42, y + r * 0.05, r * 0.26, "#8fd06f");
          break;
        case "busch":
          kreis(x, y, r, "#4f9a3e");
          kreis(x - r * 0.3, y + r * 0.3, r * 0.5, "#7cc25c");
          break;
        case "blumen":
          for (let i = 0; i < 6; i += 1) {
            const w = d.w + i * 1.1;
            kreis(x + Math.cos(w) * r * 0.7, y + Math.sin(w) * r * 0.7, 1.9, ["#ffffff", "#ffd1e8", "#fff27a", "#c9a7ff"][i % 4]);
          }
          break;
        case "haus": {
          // Ein Chalet, von oben: zwei Dachflächen mit First, ein Kamin,
          // davor ein Stück Garten.
          g.save();
          g.translate(x, y);
          g.rotate(d.w);
          g.fillStyle = "rgba(150, 200, 110, 0.55)";
          g.fillRect(-r * 1.1, -r * 1.05, r * 2.2, r * 2.1);
          g.fillStyle = "#8a3f22";
          g.fillRect(-r * 0.95, -r * 0.7, r * 1.9, r * 0.7);
          g.fillStyle = "#b9552e";
          g.fillRect(-r * 0.95, 0, r * 1.9, r * 0.7);
          g.strokeStyle = "rgba(0,0,0,0.18)";
          g.lineWidth = 0.6;
          for (let z = -3; z <= 3; z += 1) {
            g.beginPath();
            g.moveTo(z * r * 0.27, -r * 0.7);
            g.lineTo(z * r * 0.27, r * 0.7);
            g.stroke();
          }
          g.fillStyle = "#e9d2b0";
          g.fillRect(-r * 0.95, -0.7, r * 1.9, 1.4);
          g.fillStyle = "#5e5a57";
          g.fillRect(r * 0.42, r * 0.2, r * 0.24, r * 0.24);
          g.restore();
          break;
        }
        case "stein":
        case "schneestein": {
          g.save();
          g.translate(x, y);
          g.rotate(d.w);
          g.fillStyle = "#8b8a86";
          g.beginPath();
          g.moveTo(-r, -r * 0.2);
          g.lineTo(-r * 0.4, -r * 0.9);
          g.lineTo(r * 0.6, -r * 0.7);
          g.lineTo(r, r * 0.1);
          g.lineTo(r * 0.3, r * 0.85);
          g.lineTo(-r * 0.7, r * 0.6);
          g.closePath();
          g.fill();
          g.fillStyle = d.art === "schneestein" ? "#ffffff" : "#b3b1ab";
          g.beginPath();
          g.moveTo(-r * 0.7, 0);
          g.lineTo(-r * 0.3, -r * 0.6);
          g.lineTo(r * 0.4, -r * 0.45);
          g.lineTo(r * 0.1, r * 0.35);
          g.closePath();
          g.fill();
          g.restore();
          break;
        }
        case "tanne":
        case "schneetanne": {
          const schnee = d.art === "schneetanne";
          // Von oben eine Tanne: Ringe aus Zweigen, aussen dunkel, zur
          // Spitze hin heller, das Licht von links oben.
          for (let i = 0; i < 4; i += 1) {
            const k = 1 - i * 0.23;
            const farbe = schnee
              ? ["#2b5444", "#3a6855", "#dfe9f2", "#ffffff"][i]
              : ["#1b4f2d", "#25633a", "#327a47", "#479455"][i];
            g.fillStyle = farbe;
            g.beginPath();
            const zacken = 14;
            for (let z = 0; z < zacken * 2; z += 1) {
              const w = d.w + i * 0.4 + (z / (zacken * 2)) * Math.PI * 2;
              const rr = r * k * (z % 2 ? 0.58 : 1);
              const px = x - i * r * 0.09 + Math.cos(w) * rr;
              const py = y + i * r * 0.09 + Math.sin(w) * rr;
              if (z) g.lineTo(px, py);
              else g.moveTo(px, py);
            }
            g.closePath();
            g.fill();
          }
          break;
        }
        default:
          break;
      }
    });
  }

  // Der Wagen, von oben: ein roter Sportwagen mit weissen Streifen. Lokal
  // zeigt seine Nase nach +y.
  // Die Gegner als Geist: ein Wagen aus Licht auf seinem eigenen Weg.
  function zeichneGeister() {
    if (!gegner || state.phase === "bereit") return;
    const orte = window.LernappGeist?.orte?.(gegner) || [];
    if (!orte.length) return;
    weltTransform();
    orte.forEach((o) => {
      // Wem im Live-Modus zugeschaut wird, der ist die Figur selbst – kein
      // Geist dazu, nur sein Name (geist.js, namen).
      if (o.ziel) return;
      g.save();
      g.globalAlpha = 0.45 * o.blass;
      g.translate(o.a, o.b);
      g.rotate((o.c || 0) / 100);
      g.fillStyle = o.farbe;
      g.beginPath();
      if (g.roundRect) g.roundRect(-6.5, -12, 13, 24, 4);
      else g.rect(-6.5, -12, 13, 24);
      g.fill();
      g.globalAlpha = 0.3 * o.blass;
      g.fillStyle = "#1d2230";
      g.fillRect(-4.2, 0, 8.4, 5);
      g.restore();
    });
    bildTransform();
    const ms = gegner.zeit();
    window.LernappGeist.namen(g, orte.map((o) => {
      const d = Math.round(o.lauf.wert(ms) - state.punkte);
      return { ...o, sx: bildX(o.a), sy: bildY(o.b) - 18 * view.s, weit: `${d > 0 ? "+" : ""}${d} m` };
    }), { breit: view.cssW, hoch: view.cssH });
  }

  function zeichneAuto() {
    const auto = state.auto;
    weltTransform();
    g.save();
    g.translate(auto.x, auto.y);
    // Das Licht der Scheinwerfer, vor dem Wagen auf dem Asphalt.
    g.save();
    g.rotate(state.koerper - HAUPT);
    if (state.schritt !== "crash") {
      const licht = g.createRadialGradient(0, 30, 2, 0, 30, 34);
      licht.addColorStop(0, "rgba(255, 246, 200, 0.28)");
      licht.addColorStop(1, "rgba(255, 246, 200, 0)");
      g.fillStyle = licht;
      g.beginPath();
      g.moveTo(-5, 11);
      g.lineTo(-20, 56);
      g.lineTo(20, 56);
      g.lineTo(5, 11);
      g.closePath();
      g.fill();
    }
    // Schatten
    g.fillStyle = "rgba(0,0,0,0.32)";
    g.beginPath();
    if (g.roundRect) g.roundRect(-6.5 + 2.2, -12 - 2.2, 13, 24, 4);
    else g.rect(-6.5 + 2.2, -12 - 2.2, 13, 24);
    g.fill();
    // Räder
    g.fillStyle = "#15161b";
    [[-6.4, 6.5], [6.4, 6.5], [-6.4, -7], [6.4, -7]].forEach(([rx, ry]) => {
      g.fillRect(rx - 1.6, ry - 2.6, 3.2, 5.2);
    });
    // Karosserie
    const lack = g.createLinearGradient(-6, 0, 6, 0);
    lack.addColorStop(0, "#b8231b");
    lack.addColorStop(0.5, "#ff4a3d");
    lack.addColorStop(1, "#b8231b");
    g.fillStyle = lack;
    g.beginPath();
    g.moveTo(-5.2, 12);
    g.quadraticCurveTo(0, 13.6, 5.2, 12);
    g.quadraticCurveTo(6.4, 4, 6, -8);
    g.quadraticCurveTo(5.6, -12, 0, -12.2);
    g.quadraticCurveTo(-5.6, -12, -6, -8);
    g.quadraticCurveTo(-6.4, 4, -5.2, 12);
    g.closePath();
    g.fill();
    // Streifen
    g.fillStyle = "rgba(255,255,255,0.92)";
    g.fillRect(-1.9, -12, 1.2, 24.6);
    g.fillRect(0.7, -12, 1.2, 24.6);
    // Scheiben und Dach
    g.fillStyle = "#1d2a44";
    g.beginPath();
    g.moveTo(-4.4, 4.6);
    g.quadraticCurveTo(0, 6.4, 4.4, 4.6);
    g.lineTo(3.6, 1.4);
    g.lineTo(-3.6, 1.4);
    g.closePath();
    g.fill();
    g.fillStyle = "#c92b22";
    g.fillRect(-3.6, -4.4, 7.2, 5.8);
    g.fillStyle = "rgba(255,255,255,0.9)";
    g.fillRect(-1.9, -4.4, 1.2, 5.8);
    g.fillRect(0.7, -4.4, 1.2, 5.8);
    g.fillStyle = "#1d2a44";
    g.fillRect(-3.4, -7.2, 6.8, 2.6);
    // Scheinwerfer und Rücklichter
    g.fillStyle = "#fff8d6";
    g.fillRect(-4.6, 11, 2.2, 1.4);
    g.fillRect(2.4, 11, 2.2, 1.4);
    g.fillStyle = state.dreh ? "#ff2d2d" : "#a3171a";
    g.fillRect(-5, -12, 2.6, 1.3);
    g.fillRect(2.4, -12, 2.6, 1.3);
    if (state.dreh) {
      g.fillStyle = "rgba(255, 40, 40, 0.35)";
      g.beginPath();
      g.arc(-3.7, -12.5, 3.2, 0, Math.PI * 2);
      g.arc(3.7, -12.5, 3.2, 0, Math.PI * 2);
      g.fill();
    }
    g.restore();
    g.restore();
  }

  function zeichneTeile() {
    if (!state.teile.length) return;
    weltTransform();
    state.teile.forEach((t) => {
      const k = clamp(t.leben / t.max, 0, 1);
      g.globalAlpha = t.art === "rauch" ? k * 0.42 : k;
      g.fillStyle = t.farbe;
      g.beginPath();
      g.arc(t.x, t.y, t.r * (t.art === "rauch" ? 2.4 - k * 1.4 : 0.5 + k * 0.5), 0, Math.PI * 2);
      g.fill();
    });
    g.globalAlpha = 1;
  }

  // Tempo, das man sieht: helle Striche, die dem Wagen entgegenziehen.
  function zeichneStriche() {
    if (ruhig() || !state.striche.length) return;
    bildTransform();
    g.strokeStyle = "#ffffff";
    g.lineCap = "round";
    state.striche.forEach((s) => {
      g.globalAlpha = s.alpha;
      g.lineWidth = 1.5;
      g.beginPath();
      g.moveTo(s.x, s.y);
      g.lineTo(s.x - s.dx * s.len, s.y - s.dy * s.len);
      g.stroke();
    });
    g.globalAlpha = 1;
  }

  // Ein weiches Abdunkeln an den Rändern – der Blick bleibt beim Wagen.
  function zeichneVignette() {
    bildTransform();
    const W = view.cssW;
    const H = view.cssH;
    const v = g.createRadialGradient(W / 2, H * 0.55, Math.min(W, H) * 0.35, W / 2, H * 0.55, Math.max(W, H) * 0.75);
    v.addColorStop(0, "rgba(0,0,0,0)");
    v.addColorStop(1, "rgba(10, 16, 30, 0.38)");
    g.fillStyle = v;
    g.fillRect(0, 0, W, H);
  }

  function zeichneSchriften() {
    if (!state.schriften.length) return;
    bildTransform();
    g.textAlign = "center";
    g.textBaseline = "middle";
    state.schriften.forEach((s) => {
      const k = clamp(s.leben / s.max, 0, 1);
      const steig = (1 - k) * 30;
      const gross = s.gross * clamp(view.s, 0.8, 1.6);
      g.globalAlpha = Math.min(1, k * 2);
      g.font = `900 ${Math.round(gross)}px system-ui, sans-serif`;
      g.lineWidth = 4;
      g.strokeStyle = "rgba(20, 24, 36, 0.7)";
      g.strokeText(s.text, bildX(s.x), bildY(s.y) - steig);
      g.fillStyle = s.farbe;
      g.fillText(s.text, bildX(s.x), bildY(s.y) - steig);
    });
    g.globalAlpha = 1;
  }

  // Die Meter oben links, darunter das Tempo.
  function zeichneAnzeige() {
    if (state.schritt === "start") return;
    bildTransform();
    // Auf dem Handy liegt der obere Rand unter den Knöpfen: dann darunter.
    g.translate(0, shell?.frei?.(canvas) || 0);
    const gross = clamp(view.cssH * 0.05, 14, 24);
    g.font = `900 ${Math.round(gross)}px system-ui, sans-serif`;
    g.textAlign = "left";
    g.textBaseline = "middle";
    const text = `${state.meter} m`;
    const w = g.measureText(text).width + gross * 1.1;
    const x = 12;
    const y = 12;
    g.fillStyle = "rgba(20, 24, 36, 0.55)";
    g.beginPath();
    if (g.roundRect) g.roundRect(x, y, w, gross * 1.6, gross * 0.8);
    else g.rect(x, y, w, gross * 1.6);
    g.fill();
    g.fillStyle = "#ffffff";
    g.fillText(text, x + gross * 0.55, y + gross * 0.82);
    if (state.schritt === "fahrt") {
      const kmh = Math.round((tempoBei(state.auto.s) / METER) * 3.6);
      g.font = `800 ${Math.round(gross * 0.62)}px system-ui, sans-serif`;
      g.fillStyle = "rgba(255,255,255,0.85)";
      g.lineWidth = 3;
      g.strokeStyle = "rgba(20, 24, 36, 0.5)";
      g.strokeText(`${kmh} km/h`, x + gross * 0.2, y + gross * 2.25);
      g.fillText(`${kmh} km/h`, x + gross * 0.2, y + gross * 2.25);
    }
  }

  function zeichnen() {
    if (!g) return;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, canvas.width, canvas.height);
    zeichneBoden();
    const bereich = sichtbereich();
    const deko = sichtbareDeko();
    zeichneDekoSchatten(deko);
    if (bereich) {
      zeichneStrasse(bereich);
      zeichneZielstreifen(START_S, "#1d2230", "#ffffff");
      zeichneMarken();
      zeichneGegner();
      zeichneTafeln(bereich);
    }
    zeichneSpuren();
    zeichneDrehpunkt();
    zeichneDeko(deko);
    zeichneTeile();
    zeichneGeister();
    zeichneAuto();
    zeichneStriche();
    zeichneVignette();
    zeichneSchriften();
    zeichneAnzeige();
  }

  // ---------------------------------------------------------------------------
  // Teilchen und Schriften
  // ---------------------------------------------------------------------------
  function funken(x, y, anzahl) {
    if (ruhig()) anzahl = Math.ceil(anzahl / 3);
    const farben = ["#fff4d6", "#ffd166", "#ff8c42", "#e8433a"];
    for (let i = 0; i < anzahl; i += 1) {
      const w = Math.random() * Math.PI * 2;
      const v = 60 + Math.random() * 240;
      state.teile.push({
        art: "funke", x, y, vx: Math.cos(w) * v, vy: Math.sin(w) * v,
        r: 1.3 + Math.random() * 2, farbe: farben[i % farben.length], leben: 0.4 + Math.random() * 0.5, max: 0.9,
      });
    }
    for (let i = 0; i < anzahl / 2; i += 1) {
      state.teile.push({
        art: "rauch", x, y, vx: (Math.random() - 0.5) * 50, vy: (Math.random() - 0.5) * 50,
        r: 4 + Math.random() * 4, farbe: "#c8ccd6", leben: 0.9 + Math.random() * 0.8, max: 1.7,
      });
    }
  }

  function qualm(x, y) {
    state.teile.push({
      art: "rauch", x: x + (Math.random() - 0.5) * 3, y: y + (Math.random() - 0.5) * 3,
      vx: (Math.random() - 0.5) * 18, vy: (Math.random() - 0.5) * 18,
      r: 2.6 + Math.random() * 2, farbe: "#f2f4f8", leben: 0.7 + Math.random() * 0.4, max: 1.1,
    });
  }

  function schrift(text, x, y, farbe, gross) {
    state.schriften.push({ text, x, y, farbe, gross, leben: 1.1, max: 1.1 });
  }

  // ---------------------------------------------------------------------------
  // Der Lauf
  // ---------------------------------------------------------------------------
  // Die Kurve, um die gerade gedriftet wird: die erste, deren Ende der Wagen
  // noch nicht hinter sich hat.
  function aktiveKurve() {
    const kurven = state.bahn.kurven;
    bahnBis(state.auto.s + 600);
    while (state.kNr < kurven.length - 1 && state.auto.s > kurven[state.kNr].s1 + 6 && !(state.dreh && state.dreh.kurve === kurven[state.kNr])) {
      state.kNr += 1;
    }
    return kurven[state.kNr] || null;
  }

  // Die vier Ecken des Wagens, nach der Fahrtrichtung.
  function ecken() {
    const { x, y, a } = state.auto;
    const c = Math.cos(a);
    const s = Math.sin(a);
    return [[HALB_L, HALB_B], [HALB_L, -HALB_B], [-HALB_L, HALB_B], [-HALB_L, -HALB_B]].map(([f, l]) => ({
      x: x + c * f - s * l,
      y: y + s * f + c * l,
    }));
  }

  function physik(dt) {
    const auto = state.auto;
    const v = tempoBei(auto.s);

    if (gedrueckt && !state.wartetAufLos && !state.dreh) {
      // Das Seil: so lang, wie der Wagen jetzt vom Drehpunkt entfernt ist.
      const kurve = aktiveKurve();
      if (kurve) {
        const dx = auto.x - kurve.px;
        const dy = auto.y - kurve.py;
        state.dreh = { kurve, r: Math.max(14, Math.hypot(dx, dy)), phi: Math.atan2(dy, dx), sig: kurve.sig };
        state.richten = null;
      }
    } else if (!gedrueckt && state.dreh) {
      loslassenInDerKurve();
    }

    if (state.dreh) {
      const d = state.dreh;
      d.phi += d.sig * (v / d.r) * dt;
      auto.x = d.kurve.px + d.r * Math.cos(d.phi);
      auto.y = d.kurve.py + d.r * Math.sin(d.phi);
      auto.a = d.phi + d.sig * HAUPT;
    } else {
      if (state.richten) {
        const fehlt = winkelDiff(state.richten.ziel, auto.a);
        const schritt = 4 * dt;
        if (Math.abs(fehlt) <= schritt) {
          auto.a = state.richten.ziel;
          state.richten = null;
        } else {
          auto.a += Math.sign(fehlt) * schritt;
        }
      }
      auto.x += Math.cos(auto.a) * v * dt;
      auto.y += Math.sin(auto.a) * v * dt;
    }

    // Wo auf der Strasse der Wagen ist – und ob er noch darauf ist.
    const nah = abstand(auto.x, auto.y, auto.i, 30);
    auto.i = nah.i;
    auto.s = Math.max(auto.s, state.bahn.proben[auto.i].s);
    state.spitze = Math.max(state.spitze, v);
    for (const e of ecken()) {
      const n = abstand(e.x, e.y, auto.i, 40);
      // Bis zur Leitplanke: Wer das Bankett streift, kracht hinein.
      if (n.d > state.bahn.proben[n.i].w / 2 + 4) {
        crash(e);
        return;
      }
    }
  }

  // Losgelassen, mitten in der Kurve oder an ihrem Ende. Zeigt der Wagen
  // fast in die neue Gerade, lenkt er die letzten Grad selbst nach.
  function loslassenInDerKurve() {
    const d = state.dreh;
    state.dreh = null;
    const fehler = winkelDiff(d.kurve.a1, state.auto.a);
    const dreh = tempoBei(state.auto.s) / d.r;
    if (Math.abs(fehler) < toleranzBei(state.auto.s, dreh)) {
      state.richten = { ziel: d.kurve.a1 };
      if (Math.abs(fehler) < perfektBei(dreh)) {
        state.perfekt += 1;
        state.serie += 1;
        const text = state.serie > 1 ? `Perfekt! ×${state.serie}` : "Perfekt!";
        schrift(text, state.auto.x, state.auto.y + 30, "#ffe08a", 17);
        // Perfekt: die Harfe – nur der erste in Folge.
        if (state.serie === 1) klang()?.ton("perfekt");
      } else {
        state.serie = 0;
      }
    } else {
      state.serie = 0;
    }
  }

  function crash(wo) {
    if (state.schritt !== "fahrt") return;
    state.schritt = "crash";
    state.crashZeit = state.zeit;
    state.stoss = 1;
    state.dreh = null;
    state.richten = null;
    state.dreht = (Math.random() < 0.5 ? -1 : 1) * 7;
    state.crashV = tempoBei(state.auto.s) * 0.55;
    funken(wo.x, wo.y, 36);
    klaengeAus();
    klang()?.ton("drift.crash");
    kids()?.vibrate?.([30, 40, 60]);
    stepTimer = window.setTimeout(finish, 1200);
  }

  function takt(dt) {
    state.zeit += dt;
    if (state.stoss > 0) state.stoss = Math.max(0, state.stoss - dt * 2.4);
    const auto = state.auto;

    if (state.phase === "zuschauen") {
      zuschauenTakt();
    } else if (state.schritt === "fahrt") {
      const n = Math.max(1, Math.ceil(dt / TAKT));
      for (let i = 0; i < n && state.schritt === "fahrt"; i += 1) physik(dt / n);

      const meter = Math.floor(meterBei(auto.s));
      if (meter !== state.meter) {
        // An jeder Hundertermarke ein Pop, alle 500 m die lange Harfe.
        if (Math.floor(meter / 100) > Math.floor(state.meter / 100)) {
          if (Math.floor(meter / 100) % 5 === 0) klang()?.ton("meilenstein");
          else klang()?.ton("punkt", { laut: 0.6 });
        }
        state.meter = meter;
        state.punkte = meter;
        shell.setCount(meter);
      }
    } else if (state.schritt === "crash") {
      state.crashV = Math.max(0, (state.crashV || 0) - 520 * dt);
      auto.x += Math.cos(auto.a) * state.crashV * dt;
      auto.y += Math.sin(auto.a) * state.crashV * dt;
      state.koerper += state.dreht * dt * (state.crashV / 200 + 0.1);
      if (Math.random() < dt * 30) qualm(auto.x, auto.y);
    }

    // Die Karosserie: im Drift schräg in die Kurve, danach zurück in die
    // Fahrtrichtung.
    if (state.schritt !== "crash" && state.phase !== "zuschauen") {
      const v = tempoBei(auto.s);
      const ziel = state.dreh ? state.dreh.sig * lerp(0.36, 0.52, clamp((v - V0) / (V_MAX - V0), 0, 1)) : 0;
      state.drift += (ziel - state.drift) * (1 - Math.exp(-dt * (state.dreh ? 9 : 6)));
      state.koerper = auto.a + state.drift;
    }

    // Rauch und Gummi von den Hinterrädern, solange er quer steht.
    if (state.schritt === "fahrt" && Math.abs(state.drift) > 0.12) {
      const c = Math.cos(state.koerper);
      const s = Math.sin(state.koerper);
      const hinten = [[-7, 6.4], [-7, -6.4]].map(([f, l]) => ({ x: auto.x + c * f - s * l, y: auto.y + s * f + c * l }));
      if (state.letzteRaeder) {
        hinten.forEach((r, i) => {
          const alt = state.letzteRaeder[i];
          state.spuren.push({ ax: alt.x, ay: alt.y, bx: r.x, by: r.y });
        });
        if (state.spuren.length > 1400) state.spuren.splice(0, state.spuren.length - 1400);
      }
      state.letzteRaeder = hinten;
      if (!ruhig() && Math.random() < dt * 60) qualm(hinten[Math.random() < 0.5 ? 0 : 1].x, hinten[0].y);
    } else {
      state.letzteRaeder = null;
    }

    // Die Kamera: dem Wagen nach, ein Stück voraus in Fahrtrichtung. Je
    // schneller, desto mehr Strasse ist zu sehen.
    const v = state.schritt === "fahrt" ? tempoBei(auto.s) : 0;
    const zoomZiel = state.schritt === "start" ? 1 : lerp(1, 0.8, clamp((tempoBei(auto.s) - V0) / (V_MAX - V0), 0, 1));
    state.zoom += (zoomZiel - state.zoom) * (1 - Math.exp(-dt * 1.5));
    skaliere();
    const voraus = view.h * 0.2;
    const zielX = auto.x + Math.cos(auto.a) * voraus * 0.6;
    const zielY = auto.y + Math.sin(auto.a) * voraus + view.h * 0.08;
    const k = state.schritt === "start" ? 1 : 1 - Math.exp(-dt * 4.5);
    state.camX += (zielX - state.camX) * k;
    state.camY += (zielY - state.camY) * k;
    bahnBis(auto.s + view.h * 3 + 600);

    // Die Striche: Sie ziehen gegen die Fahrtrichtung durchs Bild, im
    // Bild gerechnet (dort zeigt y nach unten).
    const dichte = clamp((v - 240) / 180, 0, 1);
    if (!ruhig() && dichte > 0 && Math.random() < dt * 34 * dichte) {
      const dx = -Math.cos(auto.a);
      const dy = Math.sin(auto.a);
      state.striche.push({
        x: Math.random() * view.cssW, y: Math.random() * view.cssH, dx, dy, len: 24 + 70 * dichte,
        tempo: (1.4 + Math.random()) * v * view.s, alpha: 0, ziel: 0.1 + 0.22 * dichte, leben: 0.45,
      });
    }
    for (let i = state.striche.length - 1; i >= 0; i -= 1) {
      const st = state.striche[i];
      st.x += st.dx * st.tempo * dt;
      st.y += st.dy * st.tempo * dt;
      st.leben -= dt;
      st.alpha = st.ziel * clamp(Math.min(st.leben / 0.15, (0.45 - st.leben) / 0.1), 0, 1);
      if (st.leben <= 0) state.striche.splice(i, 1);
    }

    for (let i = state.teile.length - 1; i >= 0; i -= 1) {
      const t = state.teile[i];
      t.vx *= 1 - 1.8 * dt;
      t.vy *= 1 - 1.8 * dt;
      t.x += t.vx * dt;
      t.y += t.vy * dt;
      t.leben -= dt;
      if (t.leben <= 0) state.teile.splice(i, 1);
    }
    for (let i = state.schriften.length - 1; i >= 0; i -= 1) {
      state.schriften[i].leben -= dt;
      if (state.schriften[i].leben <= 0) state.schriften.splice(i, 1);
    }

    if (state.phase === "spiel") {
      gegner?.takt(state.punkte, { a: Math.round(state.auto.x), b: Math.round(state.auto.y), c: Math.round((state.koerper - HAUPT) * 100) });
    }
    klaengeStellen();
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
  // Halten und Loslassen
  // ---------------------------------------------------------------------------
  // ---------------------------------------------------------------------------
  // Zuschauen
  // ---------------------------------------------------------------------------
  // Eine aufgezeichnete Fahrt auf ihrer eigenen Strasse: Der Zufall hält die
  // Saat (geist.js, zuschauer), startRun baut damit dieselbe Strasse, und der
  // Wagen steht Bild für Bild dort, wo er damals war.
  function zuschauenStarten() {
    if (!zuschauer?.lauf) return;
    startRun();
    state.phase = "zuschauen";
    state.schritt = "fahrt";
    shell.setPhase("play");
    zuschauer.los();
    klaengeAn();
  }

  function zuschauenTakt() {
    const s = zuschauer.stand();
    if (!s) return;
    const auto = state.auto;
    auto.x = s.a;
    auto.y = s.b;
    if (Math.hypot(s.va, s.vb) > 5) auto.a = Math.atan2(s.vb, s.va);
    state.koerper = HAUPT + (s.c || 0) / 100;
    state.drift = state.koerper - auto.a;
    auto.s = START_S + Math.max(0, s.punkte) * METER;
    const meter = Math.max(0, Math.floor(s.punkte));
    if (meter !== state.meter) {
      state.meter = meter;
      state.punkte = meter;
      shell.setCount(meter);
    }
    if (!zuschauer.weiter()) klaengeAus();
  }

  // Die Runde beginnt: mit dem ersten Druck – oder im Live-Modus zum
  // gemeinsamen Start (game-shell.js, live.los).
  function losGehts() {
    if (state.phase !== "bereit") return;
    // Der erste Druck startet den Wagen. Gedriftet wird erst nach dem
    // ersten Loslassen – im Live-Modus startet er ohne Druck, dann gleich.
    state.phase = "spiel";
    state.schritt = "fahrt";
    state.wartetAufLos = gedrueckt;
    shell.setPhase("play");
    gegner?.los();
    klaengeAn();
    kids()?.vibrate?.(8);
  }

  function druecken() {
    gedrueckt = true;
    losGehts();
  }

  function loslassen() {
    gedrueckt = false;
    state.wartetAufLos = false;
  }

  // ---------------------------------------------------------------------------
  // Ablauf
  // ---------------------------------------------------------------------------
  function startRun() {
    clearStep();
    stopLoop();
    klaengeAus();
    shell.closeOverlay();
    zufall.neu();
    shell.setPhase("intro");
    state.phase = "bereit";
    state.schritt = "start";
    state.punkte = 0;
    state.meter = 0;
    state.spitze = 0;
    state.perfekt = 0;
    state.serie = 0;
    state.bahn = neueBahn();
    bahnBis(START_GERADE + 2000);
    const i0 = indexBei(10);
    const start = state.bahn.proben[i0];
    state.auto = { x: start.x, y: start.y, a: HAUPT, s: start.s, i: i0 };
    state.koerper = HAUPT;
    state.drift = 0;
    state.dreh = null;
    state.richten = null;
    state.kNr = 0;
    state.wartetAufLos = false;
    state.letzteRaeder = null;
    state.spuren = [];
    state.teile = [];
    state.schriften = [];
    state.striche = [];
    state.zoom = 1;
    state.stoss = 0;
    state.zeit = 0;
    gedrueckt = false;
    shell.setCount(0);
    gegner?.runde();

    shell.clear();
    const prompt = shell.el("p", "cm-prompt dt-prompt", "Halten – driften. Loslassen – geradeaus.");
    shell.play.append(prompt, buildPlatz());
    view.cssW = 0;
    view.cssH = 0;
    messen();
    takt(0);

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
    klaengeAus();
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
    const kmh = Math.round((state.spitze / METER) * 3.6);
    const perfekt = state.perfekt === 1 ? "1 perfekter Drift" : `${state.perfekt} perfekte Drifts`;
    shell.showResult({
      label: "Deine Meter",
      points: punkte,
      detail: rekord ? "Neuer Rekord!" : `${perfekt} · Spitze ${kmh} km/h${vorher ? ` · Bestwert ${vorher} m` : ""}`,
      geist,
    });
    if (rekord) host.querySelector(".cm-result-detail")?.classList.add("dt-rekord");
    zaehleHoch(punkte);
  }

  // ---------------------------------------------------------------------------
  // Start
  // ---------------------------------------------------------------------------
  shell = shellApi.mount({
    host,
    title: "Drift-Rennen",
    area: "geschwindigkeit",
    accent: "#F5A623",
    accentDark: "#b9741a",
    clock: false,
    onRestart: () => (zuschauer ? zuschauenStarten() : startRun()),
    live: { los: losGehts, stopp: () => finish(), zuschauen: (quelle) => { zuschauer = quelle; zuschauenStarten(); } },
  });
  zuschauer = window.LernappGeist?.zuschauer?.({
    host, spiel: "driftRace", fassung: "t1", zufall, einheit: "m", nochmal: zuschauenStarten,
  }) || null;
  if (!zuschauer) {
    gegner = window.LernappGeist?.fuer?.({ spiel: "driftRace", host, art: "tempo", alle: true, zufall }) || null;
  }

  startRun();
  zuschauer?.laden.then((da) => { if (da) zuschauenStarten(); });

  host.addEventListener("pointerdown", (event) => {
    if (event.target.closest("button, a, input")) return;
    druecken();
  });
  window.addEventListener("pointerup", loslassen);
  window.addEventListener("pointercancel", loslassen);
  window.addEventListener("blur", loslassen);

  const TASTEN = new Set([" ", "Enter", "ArrowUp"]);
  document.addEventListener("keydown", (event) => {
    if (!TASTEN.has(event.key)) return;
    if (document.activeElement?.tagName === "BUTTON") return;
    event.preventDefault();
    if (event.repeat) return;
    druecken();
  });
  document.addEventListener("keyup", (event) => {
    if (!TASTEN.has(event.key)) return;
    loslassen();
  });

  window.addEventListener("resize", messen);
  window.addEventListener("orientationchange", messen);
  window.addEventListener("pagehide", () => { clearStep(); stopLoop(); klaengeAus(); });

  // Für die Prüfskripte.
  window.LernappDrift = {
    METER, START_S, state, view, takt, druecken, loslassen,
    bahnBis, probeBei, aktiveKurve, tempoBei, breiteBei, toleranzBei, drehMaxBei, winkelDiff,
  };
})();
