/*
 * skispringen.js – Skispringen.
 * ---------------------------------------------------------------------------
 * Eine Runde ist eine Serie von Sprüngen auf immer grösseren Schanzen: HS 100,
 * 120, 140, 165, die Skiflugschanzen HS 185 und 215 und schliesslich HS 240,
 * auf der es dann bleibt. Gezählt werden die Meter aller Sprünge zusammen.
 * Die Runde endet bei einem Sturz – oder wenn ein Sprung die grüne
 * Qualifikationslinie nicht erreicht.
 *
 * Jeder Sprung hat drei Momente:
 *
 *   Absprung   Der Anlauf läuft von selbst, in der Hocke, immer schneller. Ein
 *              Ring zieht sich auf die Schanzenkante zusammen; wer tippt, wenn
 *              er sie trifft, springt mit voller Kraft («Perfekt», und einen
 *              Wimpernschlag lang Zeitlupe). Zu früh steht er zu früh auf und
 *              springt schwach und in Rücklage, zu spät kippt er über die
 *              Kante nach vorne – und ohne Tipp fällt er einfach hinunter.
 *   Flug       Der Körperwinkel muss im grünen Bereich des Bogens bleiben, der
 *              über dem Springer steht. Rechts halten (Pfeil rechts) lehnt ihn
 *              nach vorne, links halten (Pfeil links) nach hinten – der Kopf
 *              geht dorthin, wo man drückt. Von selbst bleibt er nicht
 *              liegen: Jede Abweichung wächst, und Böen drehen ihn. Sie sind
 *              als Luftschlieren zu sehen: Schlieren, die hinunterziehen,
 *              drücken ihn nach vorne, solche, die hinaufziehen, nach hinten.
 *              Je näher am Ideal, desto mehr Auftrieb und desto weiter.
 *              Zu weit vorne überschlägt er sich (Sturz), zu weit hinten
 *              reisst die Strömung ab, und er sackt durch.
 *   Landung    Kurz vor dem Boden beide Seiten zugleich (oder Leertaste, ↑):
 *              der Telemark. Auch hier zieht sich ein Ring zusammen. Zu früh
 *              richtet er sich zu früh auf und landet hart, zu spät wackelt
 *              er, und ohne Telemark stürzt er. Ein perfekter Telemark gibt
 *              ein paar Meter dazu, und das Publikum jubelt.
 *
 * Absprung und Telemark sind also «tippen» und «beide», gelehnt wird mit
 * einer Seite: Das kommt sich nie in die Quere. Beide Seiten zugleich halten
 * lehnt nicht und landet erst, wenn der Boden nah ist.
 *
 * Schwerer wird es mit jedem Sprung: grössere Schanzen (längere Flüge, mehr
 * Zeit für Böen), ein engeres Fenster an der Kante, stärkere Böen und eine
 * unruhigere Lage, öfter Rückenwind – und die Qualifikationslinie rückt nach
 * hinten. Dazu wird es Abend, und ab dem fünften Sprung springt man unter
 * Flutlicht in die Nacht.
 *
 * Wind und Böen jedes Sprungs kommen aus dem Zufall (zufall.js), Sprung um
 * Sprung, jeder zieht immer gleich viele Zahlen: ohne Turnier jedes Mal
 * anders, im Turnier für alle im selben Versuch dieselben. Die Schanzen
 * selbst sind immer dieselben.
 *
 * Gerechnet wird in Metern. x zählt nach vorne (rechts), y nach oben; die
 * Schanzenkante jeder Schanze liegt bei 0/0. In der Aufzeichnung stehen die
 * Schanzen hintereinander, ABSTAND Meter auseinander. Die Flugbahn läuft um
 * TEMPO schneller als in echt; Absprung, Lage und Telemark zählen in der
 * Zeit des Spiels.
 *
 * Die Gegner (geist.js) springen als halb durchsichtige Springer mit – so,
 * wie sie in ihrer besten Runde gesprungen sind (a, b: Ort in Dezimetern,
 * die Schanzen hintereinander; c: Winkel der Ski mal 100). Zu sehen ist,
 * wer auf derselben Schanze springt. Und die besten Runden lassen sich
 * anschauen (?zuschauen=, geist.js): mit derselben Saat, also mit demselben
 * Wind und denselben Böen.
 */
(() => {
  "use strict";

  if (document.body.dataset.page !== "skijump") return;

  const host = document.querySelector("#sj-stage");
  const shellApi = window.LernappGameShell;
  const cloudApi = window.LernappGameCloud;
  if (!host || !shellApi) return;

  const kids = () => window.LernappKids || null;
  const ruhig = () => Boolean(kids()?.prefersReducedMotion?.());

  // Der Zufall. Nur der Plan zieht daraus – Wind, Böen, die Unruhe in der
  // Luft. Schneestaub, Zuschauer und Funken nehmen Math.random oder feste
  // Zahlen, damit der Plan nicht davon abhängt, wie jemand springt.
  const zufall = window.LernappZufall?.fuer?.("skiJump") || {
    neu() {},
    zahl: () => Math.random(),
  };

  // ---------------------------------------------------------------------------
  // Die Welt
  // ---------------------------------------------------------------------------
  const TAKT = 1 / 240;            // gerechnet wird in festen kleinen Schritten
  const ABSTAND = 2000;            // so weit liegen die Schanzen in der Aufzeichnung auseinander (m)
  const G = 9.81;
  const TEMPO = 1.15;              // die Flugbahn läuft so viel schneller als echt
  const ANLAUF_TEMPO = 1.3;        // der Anlauf noch etwas mehr – er soll kurz sein
  const HS_LISTE = [100, 120, 140, 165, 185, 215, 240];

  // Auf HS 100. Grössere Schanzen sind ähnlich gebaut: Längen wachsen mit
  // der Grösse f = HS / 100, Tempo mit ihrer Wurzel, Auftrieb und
  // Luftwiderstand fallen mit f – so fliegt man überall gleich weit, gemessen
  // an der Schanze.
  const V_KANTE = 24.5;            // m/s an der Kante
  const SPRUNG = 2.5;              // m/s quer zum Tisch: die volle Absprungkraft
  const CL = 0.00215;              // Auftrieb (je m/s im Quadrat)
  const CD = 0.001;                // Luftwiderstand
  const TISCH = 11;                // so steil fällt der Schanzentisch (Grad)

  // Die Lage in der Luft, in Grad: 0 ist ideal, plus vorne, minus hinten.
  const R_DREH = 85;               // so schnell lehnt er sich auf Druck (Grad/s)
  const DREH_TAU = 0.09;           // so weich setzt das Lehnen ein (s)
  const UEBERSCHLAG = 32;          // so weit vorne überschlägt er sich
  const ABRISS = -22;              // so weit hinten reisst die Strömung ab
  const RUECKLAGE = -45;           // weiter zurück geht es nicht
  const IDEAL = 6;                 // so weit vom Ideal ist «grün»
  const ANSTELL = 30;              // so steil stehen die Ski im Ideal zur Flugbahn (Grad)

  // Absprung und Telemark (s, in der Zeit des Spiels).
  const SPAET_MAX = 0.13;          // so lange nach der Kante zählt ein Tipp noch
  const FRUEH_MAX = 0.45;          // früher getippt springt er nicht schwächer
  const RING_ANLAUF = 0.85;        // so lange vor der Kante zieht sich der Ring zusammen
  const TELE_FENSTER = 0.95;       // so lange vor dem Boden lässt sich landen
  const TELE_ZIEL = 0.2;           // hier treffen sich die Ringe: mitten im perfekten Fenster
  const TELE_KNAPP = 0.07;         // kürzer davor ist es zu spät
  const TELE_GUT = 0.6;            // länger davor ist es zu früh

  const TOP_COUNT = 5;
  const store = cloudApi
    ? cloudApi.register({ key: "lernapp.skispringen", empty: { runs: 0, scores: [] }, merge: cloudApi.mergeScores(TOP_COUNT) })
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
  const rad = (d) => (d * Math.PI) / 180;
  const grad = (r) => (r * 180) / Math.PI;
  const glatt = (u) => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u));
  const naeher = (wert, ziel, rate, dt) => wert + (ziel - wert) * (1 - Math.exp(-rate * dt));

  // Zwei Farben (#rrggbb) gemischt: k = 0 die erste, 1 die zweite.
  function mische(a, b, k) {
    const zahl = (h, i) => parseInt(h.slice(1 + i * 2, 3 + i * 2), 16);
    const teil = (i) => Math.round(zahl(a, i) + (zahl(b, i) - zahl(a, i)) * k).toString(16).padStart(2, "0");
    return `#${teil(0)}${teil(1)}${teil(2)}`;
  }

  // Immer dieselbe Zahl zu derselben Eingabe: Bäume, Zuschauer, Sterne.
  function hash01(n) {
    const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return x - Math.floor(x);
  }

  // Wie es mit jedem Sprung schwerer wird (n zählt ab 0).
  const hsBei = (n) => HS_LISTE[Math.min(n, HS_LISTE.length - 1)];
  const schwer = (n, tau) => 1 - Math.exp(-n / tau);
  const perfektBei = (n) => lerp(0.05, 0.024, schwer(n, 4));        // ± so genau ist «perfekt» an der Kante
  const gutBei = (n) => lerp(0.125, 0.07, schwer(n, 4));            // ± so genau ist «gut»
  const unruheBei = (n) => Math.min(1.55, 0.85 + 0.075 * n);        // so schnell wächst eine Abweichung (1/s)
  const boeenBei = (n) => Math.min(5, 1 + Math.floor(n * 0.75));    // so viele Böen je Sprung
  const boeStaerkeBei = (n) => Math.min(66, 24 + 7 * n);            // so stark drehen sie (Grad/s)
  const driftBei = (n) => Math.min(13, 4 + 1.3 * n);                // so stark zieht es ihn von selbst (Grad/s)
  const rueckenBei = (n) => (n < 2 ? 0 : Math.min(2.8, 0.5 + 0.33 * n)); // so viel Rückenwind ist möglich (m/s)
  // Die Qualifikation: erst rasch nach hinten, ab dem siebten Sprung langsamer –
  // aber immer weiter, bis über HS hinaus.
  const qualiAnteil = (n) => (n <= 6 ? 0.68 + 0.042 * n : 0.932 + 0.012 * (n - 6));
  const qualiBei = (n) => Math.round(hsBei(n) * qualiAnteil(n));
  const teleObenBei = (n) => Math.max(0.22, 0.36 - 0.014 * n);      // so früh ist ein Telemark noch perfekt
  const bonusBei = (n) => Math.max(3, Math.round(hsBei(n) * 0.025)); // so viel bringt ein perfekter Telemark
  const abzugBei = (n) => Math.max(2, Math.round(hsBei(n) * 0.02));  // so viel kostet eine harte oder wackelige Landung
  // Die Tageszeit: Morgen, Mittag, Nachmittag, Abendrot, Dämmerung (mit
  // Flutlicht), Nacht.
  const tagBei = (n) => Math.min(5, n);
  // Das Tempo an der Kante, wie es die Anzeige nennt (km/h): echte Werte –
  // gerechnet wird mit dem Tempo, das die Schanze braucht.
  const kmhKante = (HS) => 78 + HS * 0.1;
  const flutlichtBei = (n) => n >= 4;

  // ---------------------------------------------------------------------------
  // Zustand
  // ---------------------------------------------------------------------------
  // phase:   "bereit" (noch nichts getippt), "spiel", "zuschauen", "ende"
  // schritt: "start" (oben auf dem Balken), "anlauf", "flug", "auslauf",
  //          "sturz", "wechsel" (zur nächsten Schanze)
  const state = {
    phase: "bereit",
    schritt: "start",
    punkte: 0,               // die Meter aller Sprünge, mit Telemark – die Zahl der Runde
    nr: 0,                   // der wievielte Sprung (ab 0)
    sch: null,               // die Schanze dieses Sprungs
    plan: [],                // Wind und Böen je Sprung
    sprung: null,            // was bei diesem Sprung geschah: Absprung, Telemark, Weite
    sprunge: [],             // die Weiten der Sprünge bisher
    sp: null,                // der Springer
    lenkung: 0,              // -1 hinten, 0, 1 vorne
    beide: false,            // beide Seiten gedrückt
    anflug: false,           // der Boden ist nah: jetzt lässt sich landen
    tauVoraus: 9,            // so lange noch bis zum Boden (vorausgerechnet)
    startRest: 0,
    weiterIn: 0,
    aus: "",                 // warum die Runde endet: "sturz", "quali"
    grund: "",
    blende: 0,               // schwarz zwischen zwei Schanzen
    blendeZiel: 0,
    tv: null,                // die Weitenanzeige unten
    karte: 0,                // die Karte mit Schanze und Wind vor dem Sprung
    ring: null,              // der Ring an der Kante nach dem Tipp
    teile: [],
    schriften: [],
    striche: [],
    jubel: 0,
    stoss: 0,
    blitz: 0,
    zeitlupe: 0,
    zeit: 0,
    echt: 0,
  };

  let shell = null;
  let feld = null;
  let canvas = null;
  let g = null;
  let knoepfe = null;
  let frame = null;
  let last = 0;
  // Die Gegner (geist.js): wer als halb durchsichtiger Springer mitspringt.
  let gegner = null;
  // Wer eine Runde anschaut statt zu spielen (geist.js, zuschauer).
  let zuschauer = null;

  const view = { dpr: 1, cssW: 0, cssH: 0, frei: 0, nutzH: 0, minD: 1 };
  // Die Kamera: welcher Punkt der Welt in der Mitte der Fläche steht, wie
  // viele Bildpunkte ein Meter ist (z), und wo der Springer im Bild stehen
  // soll (ax, ay: Anteile der Fläche).
  const kam = { x: 0, y: 0, z: 10, ax: 0.5, ay: 0.5, bereit: false };

  function stopLoop() {
    if (frame) { window.cancelAnimationFrame(frame); frame = null; }
  }

  // ---------------------------------------------------------------------------
  // Die Schanzen
  // ---------------------------------------------------------------------------
  /*
   * Eine Schanze sind zwei Linien, die sich an der Kante (0/0) treffen:
   *
   *   anlauf   von der Kante zurück hinauf: der Tisch (TISCH Grad), die
   *            Rundung, dann gerade mit 35 Grad bis zum Startbalken. u zählt
   *            die Meter von der Kante aus.
   *   hang     der Aufsprunghang, gemessen ab dem Fuss der Kante: erst
   *            flach (der Vorbau), dann steil (36 Grad) bis kurz vor dem
   *            K-Punkt, ab da langsam flacher, nach HS die Rundung in den
   *            Auslauf und am Ende ein kleiner Gegenhang. s zählt die Meter
   *            am Hang entlang – das ist die Weite.
   *
   * Je grösser die Schanze, desto länger der Hang (alles mal f); der Anlauf
   * wächst langsamer mit, damit er nicht ewig dauert.
   */
  function baueSchanze(n) {
    const HS = hsBei(n);
    const f = HS / 100;
    const K = Math.round((HS * 0.9) / 5) * 5;
    const h0 = 2.4 * f;
    const beta = (s) => {
      const k1 = 0.3 * K;
      if (s < k1) return lerp(rad(8), rad(36), glatt(s / k1));
      if (s < 0.92 * K) return rad(36);
      if (s < HS) return rad(36) - rad(5.5) * glatt((s - 0.92 * K) / (HS - 0.92 * K));
      const rund = HS * 0.5;
      if (s < HS + rund) return rad(30.5) * (1 - glatt((s - HS) / rund));
      const flach = HS + rund + HS * 0.32;
      if (s < flach) return 0;
      return -rad(7) * glatt((s - flach) / (HS * 0.12));
    };
    const ds = 0.5 * f;
    const hang = [{ s: 0, x: 0, y: -h0, b: beta(0) }];
    let x = 0;
    let y = -h0;
    for (let s = ds; s <= HS * 2.45; s += ds) {
      const b = beta(s - ds / 2);
      x += Math.cos(b) * ds;
      y -= Math.sin(b) * ds;
      hang.push({ s, x, y, b: beta(s) });
    }
    // Der Anlauf: von der Kante zurück.
    const L = 36 * f ** 0.6;
    const tisch = 5.5 * f ** 0.6;
    const bogen = 17 * f ** 0.6;
    const theta = (u) => (u < tisch ? rad(TISCH) : u < bogen ? lerp(rad(TISCH), rad(35), glatt((u - tisch) / (bogen - tisch))) : rad(35));
    const du = 0.25 * f ** 0.6;
    const anlauf = [{ u: 0, x: 0, y: 0, b: rad(TISCH) }];
    let ax = 0;
    let ay = 0;
    for (let u = du; u <= L + 6 * f ** 0.6 + du; u += du) {
      const b = theta(u - du / 2);
      ax -= Math.cos(b) * du;
      ay += Math.sin(b) * du;
      anlauf.push({ u, x: ax, y: ay, b: theta(u) });
    }
    const bei = (s) => hangBeiS({ hang }, s);
    return {
      n, HS, K, f, h0, hang, anlauf, L,
      vKante: V_KANTE * Math.sqrt(f),
      quali: qualiBei(n),
      kPunkt: bei(K),
      hsPunkt: bei(HS),
      qualiPunkt: bei(qualiBei(n)),
      auslaufS: HS * 1.78,           // dort kommt er spätestens zum Stehen
      tribuene: HS * 1.84,           // dort beginnt die Tribüne
      ende: hang[hang.length - 1],
    };
  }

  // Der Hang unter x: Höhe, Weite und Gefälle.
  function hangBei(sch, x) {
    const h = sch.hang;
    if (x <= 0) return { y: h[0].y, s: 0, b: h[0].b };
    if (x >= h[h.length - 1].x) {
      const e = h[h.length - 1];
      return { y: e.y - Math.tan(e.b) * (x - e.x), s: e.s + (x - e.x), b: e.b };
    }
    let lo = 0;
    let hi = h.length - 1;
    while (hi - lo > 1) {
      const m = (lo + hi) >> 1;
      if (h[m].x <= x) lo = m; else hi = m;
    }
    const a = h[lo];
    const c = h[hi];
    const u = (x - a.x) / (c.x - a.x || 1);
    return { y: a.y + (c.y - a.y) * u, s: a.s + (c.s - a.s) * u, b: a.b + (c.b - a.b) * u };
  }

  // Der Punkt am Hang bei der Weite s.
  function hangBeiS(sch, s) {
    const h = sch.hang;
    const ds = h[1].s - h[0].s;
    const i = clamp(Math.floor(s / ds), 0, h.length - 2);
    const a = h[i];
    const c = h[i + 1];
    const u = clamp((s - a.s) / ds, 0, 1);
    return { x: a.x + (c.x - a.x) * u, y: a.y + (c.y - a.y) * u, b: a.b + (c.b - a.b) * u, s };
  }

  // Der Punkt im Anlauf, u Meter vor der Kante.
  function anlaufBei(sch, u) {
    const a = sch.anlauf;
    const du = a[1].u - a[0].u;
    const i = clamp(Math.floor(u / du), 0, a.length - 2);
    const p = a[i];
    const q = a[i + 1];
    const k = clamp((u - p.u) / du, 0, 1);
    return { x: p.x + (q.x - p.x) * k, y: p.y + (q.y - p.y) * k, b: p.b + (q.b - p.b) * k };
  }

  // Der Boden unter x, wo auch immer: im Anlauf oder am Hang.
  function bodenBei(sch, x) {
    if (x < 0) {
      const a = sch.anlauf;
      let lo = 0;
      let hi = a.length - 1;
      while (hi - lo > 1) {
        const m = (lo + hi) >> 1;
        if (a[m].x >= x) lo = m; else hi = m;
      }
      const p = a[lo];
      const q = a[hi];
      const k = (x - p.x) / (q.x - p.x || -1);
      return { y: p.y + (q.y - p.y) * k, s: 0, b: p.b + (q.b - p.b) * k };
    }
    return hangBei(sch, x);
  }

  // ---------------------------------------------------------------------------
  // Der Plan
  // ---------------------------------------------------------------------------
  /*
   * Je Sprung zieht der Plan genau ZAHLEN_JE_SPRUNG Zahlen, auch wenn er sie
   * nicht alle braucht – so hängt er nur an der Saat, nicht daran, wie weit
   * jemand kommt.
   *
   *   wind    der stete Wind in m/s: plus Gegenwind (trägt), minus
   *           Rückenwind. Die ersten zwei Sprünge immer mit etwas Gegenwind.
   *   drift   wohin es den Springer von selbst zieht (Grad/s)
   *   boeen   Stellen am Hang (von, bis: Weite in m), an denen er gedreht
   *           wird: dreh > 0 nach vorne (Abwind, die Schlieren ziehen
   *           hinunter), dreh < 0 nach hinten (Aufwind). Gleichmässig über
   *           den Hang verteilt, nie übereinander.
   */
  const ZAHLEN_JE_SPRUNG = 24;

  function neuerSprung(n) {
    const z = [];
    for (let i = 0; i < ZAHLEN_JE_SPRUNG; i += 1) z.push(zufall.zahl());
    const HS = hsBei(n);
    const rueck = rueckenBei(n);
    const wind = n < 2 ? lerp(0.3, 1.4, z[0]) : lerp(-rueck, 1.6, z[0] * 0.55 + z[1] * 0.45);
    const drift = (z[2] < 0.5 ? -1 : 1) * driftBei(n) * lerp(0.5, 1, z[3]);
    const boeen = [];
    const anzahl = boeenBei(n);
    for (let i = 0; i < anzahl; i += 1) {
      const q = z.slice(4 + i * 4, 8 + i * 4);
      const mitte = lerp(0.16, 0.9, (i + 0.15 + q[0] * 0.7) / anzahl) * HS;
      const breite = lerp(0.06, 0.12, q[1]) * HS;
      const dir = q[2] < 0.5 ? -1 : 1;
      boeen.push({ von: mitte - breite / 2, bis: mitte + breite / 2, dreh: dir * boeStaerkeBei(n) * lerp(0.7, 1, q[3]) });
    }
    return { n, HS, wind, drift, boeen };
  }

  function planBis(n) {
    while (state.plan.length <= n) state.plan.push(neuerSprung(state.plan.length));
  }

  // Die Böen eines Sprungs als Strecken in x – einmal gerechnet, wenn die
  // Schanze steht.
  function boeenIm(sch, plan) {
    return plan.boeen.map((b) => {
      const a = hangBeiS(sch, b.von);
      const c = hangBeiS(sch, b.bis);
      return { ...b, x0: a.x, x1: c.x };
    });
  }

  // Was die Böen an der Stelle x tun: drehen (Grad/s) und tragen (m/s wie
  // Gegenwind) – an- und abschwellend über ihre Breite.
  function boeBei(x) {
    const liste = state.boeen || [];
    for (const b of liste) {
      if (x <= b.x0 || x >= b.x1) continue;
      const u = (x - b.x0) / (b.x1 - b.x0);
      const s = Math.sin(Math.PI * u);
      const k = s * s;
      return { dreh: b.dreh * k, auf: -Math.sign(b.dreh) * 1.2 * k, k, b };
    }
    return { dreh: 0, auf: 0, k: 0, b: null };
  }

  // Die gewürfelte Welt in Worten: Wind, Zug und Böen der ersten vier
  // Sprünge. Im Turnier bekommen alle denselben Text.
  function weltText() {
    planBis(3);
    return state.plan.slice(0, 4).map((p) => `HS${p.HS} w${p.wind.toFixed(2)} d${p.drift.toFixed(1)} `
      + p.boeen.map((b) => `${Math.round(b.von)}-${Math.round(b.bis)}:${b.dreh.toFixed(1)}`).join(",")).join(" | ");
  }

  // ---------------------------------------------------------------------------
  // Die Fläche
  // ---------------------------------------------------------------------------
  let promptKnoten = null;

  function buildPlatz() {
    feld = shell.el("div", "sj-feld");
    canvas = document.createElement("canvas");
    canvas.className = "sj-canvas";
    canvas.setAttribute("aria-hidden", "true");
    feld.append(canvas);
    g = canvas.getContext("2d");

    // Die zwei Knöpfe unten links und rechts: links lehnt zurück, rechts
    // nach vorne. Gedrückt wird die ganze Hälfte des Bildes; die Knöpfe
    // zeigen nur, wo, und leuchten, solange ein Finger darauf liegt. Kurz
    // vor dem Boden leuchten beide: jetzt beide für den Telemark.
    knoepfe = shell.el("div", "sj-tipp");
    knoepfe.setAttribute("aria-hidden", "true");
    const ns = "http://www.w3.org/2000/svg";
    [-1, 1].forEach((seite) => {
      const knopf = shell.el("span", `sj-knopf ${seite < 0 ? "sj-knopf-l" : "sj-knopf-r"}`);
      const svg = document.createElementNS(ns, "svg");
      svg.setAttribute("viewBox", "0 0 24 24");
      // Ein Bogen mit Pfeil: links gegen die Uhr (zurück), rechts mit ihr (vor).
      const bogen = document.createElementNS(ns, "path");
      bogen.setAttribute("d", seite < 0 ? "M17.5 15.5A7 7 0 1 0 7 7.2" : "M6.5 15.5A7 7 0 1 1 17 7.2");
      bogen.setAttribute("fill", "none");
      bogen.setAttribute("stroke", "currentColor");
      bogen.setAttribute("stroke-width", "2.6");
      bogen.setAttribute("stroke-linecap", "round");
      const spitze = document.createElementNS(ns, "path");
      spitze.setAttribute("d", seite < 0 ? "M3.6 5.4 7.6 3.2 8.6 8z" : "M20.4 5.4 16.4 3.2 15.4 8z");
      spitze.setAttribute("fill", "currentColor");
      svg.append(bogen, spitze);
      knopf.append(svg);
      knoepfe.append(knopf);
    });
    feld.append(knoepfe);
    return feld;
  }

  function messen() {
    if (!canvas || !feld) return;
    const cssW = Math.max(80, feld.clientWidth);
    const cssH = Math.max(80, feld.clientHeight);
    const dpr = clamp(window.devicePixelRatio || 1, 1, 2.5);
    // Auf dem Handy reicht die Leinwand unter die Knöpfe oben (game-shell.js,
    // frei). Gemalt wird dort auch – aber der Springer steht darunter.
    const frei = Math.min(cssH * 0.4, shell?.frei?.(canvas) || 0);
    if (cssW === view.cssW && cssH === view.cssH && dpr === view.dpr && frei === view.frei) return;
    view.cssW = cssW;
    view.cssH = cssH;
    view.dpr = dpr;
    view.frei = frei;
    view.nutzH = cssH - frei;
    view.minD = Math.min(cssW, view.nutzH);
    const pw = Math.round(cssW * dpr);
    const ph = Math.round(cssH * dpr);
    if (canvas.width !== pw) canvas.width = pw;
    if (canvas.height !== ph) canvas.height = ph;
    bilder.schluessel = "";
    kam.bereit = false;
  }

  const wackelX = () => (ruhig() ? 0 : Math.sin(state.echt * 61) * 7 * state.stoss * state.stoss);
  const wackelY = () => (ruhig() ? 0 : Math.cos(state.echt * 47) * 7 * state.stoss * state.stoss);

  // Welt (Meter, y nach oben) auf die Leinwand (CSS-Pixel, y nach unten).
  // ox, oy stellt kameraSetzen einmal je Bild.
  const bildX = (x) => x * kam.z + view.ox;
  const bildY = (y) => view.oy - y * kam.z;

  function kameraSetzen() {
    view.ox = view.cssW / 2 - kam.x * kam.z + wackelX();
    view.oy = view.frei + view.nutzH / 2 + kam.y * kam.z + wackelY();
  }

  function flach() {
    g.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
  }

  /*
   * Wohin die Kamera will. Oben am Balken und im Anlauf nah am Springer, im
   * Flug weit genug, dass unter ihm und vor ihm der Hang zu sehen ist – je
   * höher er fliegt, desto weiter zieht sie auf. Der Springer steht dabei
   * links oben im Bild: Vor ihm liegt, wohin er fliegt.
   */
  function kameraZiel(sp, schritt) {
    const sch = state.sch;
    const D = view.minD;
    const zMax = D / 16;
    const zMin = D / 150;
    let z = D / 30;
    let ax = 0.4;
    let ay = 0.42;
    if (schritt === "start") {
      z = D / 24;
      ax = 0.36;
      ay = 0.4;
    } else if (schritt === "anlauf") {
      const k = sch ? clamp(sp.v / sch.vKante, 0, 1) : 0;
      z = D / lerp(26, 36, k);
      ax = lerp(0.36, 0.4, k);
      ay = 0.4;
    } else if (schritt === "flug") {
      const v = Math.max(15, Math.hypot(sp.vx, sp.vy));
      const vor = clamp(v * 0.65, 12, 40);
      const unten = sch ? sp.y - hangBei(sch, sp.x + vor).y : 10;
      ax = view.cssW > view.nutzH ? 0.3 : 0.26;
      ay = 0.3;
      const zV = (view.nutzH * (0.88 - ay)) / Math.max(9, unten + 6);
      const zH = (view.cssW * (0.94 - ax)) / Math.max(10, vor + 5);
      z = Math.min(zV, zH);
    } else {
      z = D / 38;
      ax = 0.42;
      ay = 0.48;
    }
    return { z: clamp(z, zMin, zMax), ax, ay };
  }

  function kameraTakt(dt, sp, schritt, sofort = false) {
    if (!sp) return;
    const ziel = kameraZiel(sp, schritt);
    if (sofort || !kam.bereit) {
      kam.z = ziel.z;
      kam.ax = ziel.ax;
      kam.ay = ziel.ay;
      kam.bereit = true;
    } else {
      // Aufziehen geht weich, Heranfahren etwas schneller.
      kam.z = naeher(kam.z, ziel.z, ziel.z < kam.z ? 1.7 : 2.6, dt);
      kam.ax = naeher(kam.ax, ziel.ax, 2.2, dt);
      kam.ay = naeher(kam.ay, ziel.ay, 2.2, dt);
    }
    // Der Springer steht genau dort, wo er stehen soll – die Welt zieht
    // unter ihm durch. So zittert er nie.
    kam.x = sp.x + ((0.5 - kam.ax) * view.cssW) / kam.z;
    kam.y = sp.y - ((0.5 - kam.ay) * view.nutzH) / kam.z;
  }

  // ---------------------------------------------------------------------------
  // Die gemalten Bilder im Speicher
  // ---------------------------------------------------------------------------
  /*
   * Was weit weg ist, steht still oder zieht langsam: der Himmel, die
   * Alpen, die Hügel davor. Sie liegen je Tageszeit fertig gemalt in
   * Leinwänden – der Himmel so gross wie das Bild, die drei Bergketten als
   * Streifen, die sich nahtlos aneinanderreihen. Im Bild werden sie nur
   * kopiert, jede mit ihrer eigenen Verschiebung (Parallaxe): die Alpen
   * kaum, die Wälder davor mehr. Gemalt wird eine Tageszeit erst, wenn sie
   * gebraucht wird (zwischen zwei Sprüngen, hinter der Blende), und
   * höchstens zwei liegen im Speicher.
   */
  const TAGESZEITEN = [
    {
      name: "morgen",
      himmel: ["#41558f", "#c98fae", "#fdd6a6"],
      gestirn: { art: "sonne", fx: 0.18, fy: 0.62, r: 26, kern: "#fff3d6", hof: "rgba(255, 196, 140, 0.55)" },
      sterne: 0,
      wolke: "#ffe2d4",
      fern: { fels: "#8b84aa", schatten: "#5f5b86", schnee: "#ffeae2", schneeSchatten: "#b7a7cd", dunst: "rgba(253, 214, 186, 0.55)" },
      mitte: { grund: "#5d6d8e", hell: "#7383a3", schnee: "#e7e2ef", wald: "#3f5468" },
      nah: { grund: "#2f4a4c", wald: "#24403f", licht: "#ffd38a" },
      hang: ["#fff8f4", "#cfd2ec"], baum: ["#3b5b4f", "#26413a"], bau: ["#c9c3d6", "#8e88a6"], gelaende: "#e7e3f1",
    },
    {
      name: "mittag",
      himmel: ["#1f63c7", "#5aa6ee", "#cfe7ff"],
      gestirn: { art: "sonne", fx: 0.78, fy: 0.14, r: 20, kern: "#fffbe8", hof: "rgba(255, 245, 200, 0.5)" },
      sterne: 0,
      wolke: "#ffffff",
      fern: { fels: "#7d8ea8", schatten: "#5a6a88", schnee: "#ffffff", schneeSchatten: "#bdd0ea", dunst: "rgba(214, 233, 255, 0.55)" },
      mitte: { grund: "#4f7088", hell: "#6a8ca0", schnee: "#f2f7fc", wald: "#2f5a4f" },
      nah: { grund: "#2e5a44", wald: "#1f4a37", licht: "#ffd38a" },
      hang: ["#ffffff", "#c7d9f0"], baum: ["#2f6248", "#1d4634"], bau: ["#d6dbe3", "#8f9bab"], gelaende: "#eef4fb",
    },
    {
      name: "nachmittag",
      himmel: ["#2f5fb3", "#86b1e2", "#f7e2bc"],
      gestirn: { art: "sonne", fx: 0.82, fy: 0.3, r: 22, kern: "#fff3cf", hof: "rgba(255, 220, 150, 0.55)" },
      sterne: 0,
      wolke: "#fff6e8",
      fern: { fels: "#8a8aa4", schatten: "#5d6182", schnee: "#fff9ee", schneeSchatten: "#c5c7de", dunst: "rgba(250, 232, 200, 0.55)" },
      mitte: { grund: "#5a6f86", hell: "#7a8ea0", schnee: "#f5f1ea", wald: "#355749" },
      nah: { grund: "#33533f", wald: "#244533", licht: "#ffd38a" },
      hang: ["#fffaf2", "#cbd4ea"], baum: ["#335c45", "#203f30"], bau: ["#d8d4cf", "#958f8c"], gelaende: "#f1eee8",
    },
    {
      name: "abendrot",
      himmel: ["#2a2766", "#c2517a", "#ffb066"],
      gestirn: { art: "sonne", fx: 0.86, fy: 0.74, r: 34, kern: "#ffd27a", hof: "rgba(255, 140, 80, 0.6)" },
      sterne: 0.15,
      wolke: "#ffb7a0",
      // Alpenglühen: Die Gipfel leuchten rosa.
      fern: { fels: "#7a5a86", schatten: "#4a3a6a", schnee: "#ffc6b0", schneeSchatten: "#a77aa6", dunst: "rgba(255, 160, 130, 0.45)" },
      mitte: { grund: "#4c3f6c", hell: "#6a4f7c", schnee: "#e6b9c6", wald: "#2e2a4e" },
      nah: { grund: "#28284a", wald: "#1c1d3a", licht: "#ffcf7a" },
      hang: ["#ffe9e2", "#b9a6cc"], baum: ["#2e3a4c", "#1e2636"], bau: ["#c9a8b4", "#7a6082"], gelaende: "#e6d2dc",
    },
    {
      name: "daemmerung",
      himmel: ["#0d1236", "#36307a", "#b85f88"],
      gestirn: null,
      sterne: 0.55,
      wolke: "#6c5a96",
      fern: { fels: "#3f3c70", schatten: "#2a2852", schnee: "#a9a5d8", schneeSchatten: "#6e6aa6", dunst: "rgba(150, 110, 170, 0.4)" },
      mitte: { grund: "#25285a", hell: "#30336a", schnee: "#8d8cc2", wald: "#181c40" },
      nah: { grund: "#141a38", wald: "#0e1430", licht: "#ffcf7a" },
      hang: ["#dfe5fb", "#8c93c4"], baum: ["#1d2a40", "#121c2e"], bau: ["#8e93b8", "#4e5480"], gelaende: "#a7acd2",
      flutlicht: true,
    },
    {
      name: "nacht",
      himmel: ["#02040f", "#0a1236", "#1c2a5a"],
      gestirn: { art: "mond", fx: 0.22, fy: 0.16, r: 15, kern: "#f4f1ff", hof: "rgba(170, 180, 255, 0.28)" },
      sterne: 1,
      wolke: "#2c3766",
      fern: { fels: "#1f2550", schatten: "#151a3c", schnee: "#7c86b8", schneeSchatten: "#4b5488", dunst: "rgba(60, 80, 150, 0.35)" },
      mitte: { grund: "#141a3c", hell: "#1b2248", schnee: "#525c90", wald: "#0e1430" },
      nah: { grund: "#0b1028", wald: "#070b1e", licht: "#ffcf7a" },
      hang: ["#e4ebff", "#7d89bd"], baum: ["#14203a", "#0b1426"], bau: ["#7a82aa", "#3d4470"], gelaende: "#6f78a6",
      flutlicht: true,
    },
  ];

  const bilder = { schluessel: "", tage: new Map(), q: 1 };

  function leinwand(w, h, q) {
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.ceil(w * q));
    c.height = Math.max(1, Math.ceil(h * q));
    const cg = c.getContext("2d");
    cg.scale(q, q);
    return { c, g: cg };
  }

  // Die Bilder einer Tageszeit – gemalt, wenn sie zum ersten Mal gebraucht
  // werden. Ändert sich die Grösse der Fläche, wird neu gemalt.
  function tagesBilder(i) {
    const schluessel = `${view.cssW}|${view.cssH}|${view.dpr}`;
    if (bilder.schluessel !== schluessel) {
      bilder.schluessel = schluessel;
      bilder.tage.clear();
      bilder.q = Math.min(view.dpr, 1.5);
    }
    let b = bilder.tage.get(i);
    if (!b) {
      if (bilder.tage.size >= 2) {
        // Die am weitesten entfernte Tageszeit macht Platz.
        let weg = null;
        bilder.tage.forEach((_, k) => { if (weg === null || Math.abs(k - i) > Math.abs(weg - i)) weg = k; });
        bilder.tage.delete(weg);
      }
      b = maleTag(i);
      bilder.tage.set(i, b);
    }
    return b;
  }

  // So breit ist ein Streifen der Berge, bevor er sich wiederholt.
  const streifenBreite = () => Math.round(Math.max(view.cssW, 640) * 1.6);

  function maleTag(i) {
    const T = TAGESZEITEN[i];
    const q = bilder.q;
    const W = view.cssW;
    const H = view.cssH;
    const TW = streifenBreite();

    // Der Himmel: Verlauf, Gestirn mit Hof, Sterne.
    const himmel = leinwand(W, H, q);
    let cg = himmel.g;
    const verlauf = cg.createLinearGradient(0, 0, 0, H);
    verlauf.addColorStop(0, T.himmel[0]);
    verlauf.addColorStop(0.55, T.himmel[1]);
    verlauf.addColorStop(1, T.himmel[2]);
    cg.fillStyle = verlauf;
    cg.fillRect(0, 0, W, H);
    if (T.sterne > 0) {
      cg.fillStyle = "#ffffff";
      const anzahl = Math.round((W * H) / 2600);
      for (let n = 0; n < anzahl; n += 1) {
        const y = hash01(n * 5.3 + 2) ** 1.6 * H * 0.75;
        cg.globalAlpha = T.sterne * (0.25 + hash01(n * 9.1) * 0.7) * (1 - y / (H * 0.8));
        cg.beginPath();
        cg.arc(hash01(n * 3.7 + 1) * W, y, 0.45 + hash01(n * 7.7) * 1.05, 0, Math.PI * 2);
        cg.fill();
      }
      cg.globalAlpha = 1;
    }
    if (T.gestirn) {
      const s = T.gestirn;
      const x = W * s.fx;
      const y = H * s.fy;
      const r = s.r * clamp(Math.min(W, H) / 420, 0.8, 1.6);
      const hof = cg.createRadialGradient(x, y, r * 0.4, x, y, r * 6);
      hof.addColorStop(0, s.hof);
      hof.addColorStop(1, "rgba(0,0,0,0)");
      cg.fillStyle = hof;
      cg.fillRect(x - r * 6, y - r * 6, r * 12, r * 12);
      cg.fillStyle = s.kern;
      cg.beginPath();
      cg.arc(x, y, r, 0, Math.PI * 2);
      cg.fill();
      if (s.art === "mond") {
        cg.fillStyle = T.himmel[1];
        cg.beginPath();
        cg.arc(x + r * 0.45, y - r * 0.25, r * 0.88, 0, Math.PI * 2);
        cg.fill();
      }
    }

    // Die Alpen: spitze Gipfel mit Schnee, die Sonnenseite heller. Einer
    // ist das Horn – steil, schief, unverkennbar –, ein Stück daneben
    // stehen drei Gipfel in einer Reihe.
    const fernH = Math.round(H * 0.46);
    const fern = leinwand(TW, fernH, q);
    cg = fern.g;
    const sonneLinks = !T.gestirn || T.gestirn.fx < 0.5;
    const gipfel = [];
    const zahl = 9;
    for (let n = 0; n < zahl; n += 1) {
      const h = (k) => hash01(n * 17.3 + k * 4.1 + 7);
      gipfel.push({
        x: ((n + 0.2 + h(1) * 0.6) / zahl) * TW,
        h: fernH * lerp(0.4, 0.74, h(2)),
        wl: fernH * lerp(0.55, 0.95, h(3)),
        wr: fernH * lerp(0.55, 0.95, h(4)),
        saat: n * 31 + 5,
      });
    }
    gipfel.push({ x: TW * 0.32, h: fernH * 0.95, wl: fernH * 0.42, wr: fernH * 0.62, saat: 901, horn: true });
    gipfel.push({ x: TW * 0.71, h: fernH * 0.8, wl: fernH * 0.6, wr: fernH * 0.35, saat: 911 });
    gipfel.push({ x: TW * 0.78, h: fernH * 0.86, wl: fernH * 0.35, wr: fernH * 0.4, saat: 921 });
    gipfel.push({ x: TW * 0.86, h: fernH * 0.83, wl: fernH * 0.38, wr: fernH * 0.55, saat: 931 });
    gipfel.sort((a, b) => b.h - a.h);
    for (const p of gipfel) {
      for (const versatz of [-TW, 0, TW]) maleGipfel(cg, p.x + versatz, fernH, p, T.fern, sonneLinks);
    }
    // Dunst am Fuss der Berge.
    const dunst = cg.createLinearGradient(0, fernH * 0.55, 0, fernH);
    dunst.addColorStop(0, "rgba(0,0,0,0)");
    dunst.addColorStop(1, T.fern.dunst);
    cg.fillStyle = dunst;
    cg.fillRect(0, fernH * 0.55, TW, fernH * 0.45);

    // Die Voralpen davor: runde Rücken mit Wald und Schneefeldern.
    const mitteH = Math.round(H * 0.42);
    const mitte = leinwand(TW, mitteH, q);
    cg = mitte.g;
    const welle = (x, a, b, c) => Math.sin((x / TW) * Math.PI * 4 + a) * 0.18 + Math.sin((x / TW) * Math.PI * 10 + b) * 0.08 + Math.sin((x / TW) * Math.PI * 22 + c) * 0.03;
    const rueckenY = (x) => mitteH * (0.42 - welle(x, 1.3, 0.4, 2.2));
    // Licht von oben: die Rücken heller als ihr Fuss.
    const licht = cg.createLinearGradient(0, mitteH * 0.15, 0, mitteH * 0.7);
    licht.addColorStop(0, T.mitte.hell);
    licht.addColorStop(1, T.mitte.grund);
    cg.fillStyle = licht;
    cg.beginPath();
    cg.moveTo(0, mitteH);
    for (let x = 0; x <= TW; x += 4) cg.lineTo(x, rueckenY(x));
    cg.lineTo(TW, mitteH);
    cg.closePath();
    cg.fill();
    cg.save();
    cg.clip();
    // Schnee auf den hohen Rücken: ein Band unter dem Grat, nach unten
    // ausgefranst.
    cg.fillStyle = T.mitte.schnee;
    cg.globalAlpha = 0.85;
    cg.beginPath();
    const grenze = mitteH * 0.36;
    for (let x = 0; x <= TW; x += 4) cg.lineTo(x, rueckenY(x) - 1);
    for (let x = TW; x >= 0; x -= 4) {
      const y = rueckenY(x);
      const tief = Math.max(0, grenze - y) * 0.9 + (y < grenze ? mitteH * 0.025 * Math.sin(x * 0.21) * Math.sin(x * 0.047) : 0);
      cg.lineTo(x, y + Math.max(0, tief));
    }
    cg.closePath();
    cg.fill();
    cg.globalAlpha = 1;
    // Wald an den Flanken.
    cg.fillStyle = T.mitte.wald;
    for (let x = -10; x <= TW + 10; x += 4) {
      const y = Math.max(rueckenY(x) + mitteH * 0.12, mitteH * 0.52 + Math.sin(x * 0.02) * mitteH * 0.05);
      const hb = mitteH * (0.035 + hash01(x * 0.71) * 0.03);
      cg.beginPath();
      cg.moveTo(x - hb * 0.4, y + hb * 0.2);
      cg.lineTo(x, y - hb);
      cg.lineTo(x + hb * 0.4, y + hb * 0.2);
      cg.fill();
    }
    cg.fillRect(0, mitteH * 0.57, TW, mitteH * 0.43);
    cg.restore();
    const dunst2 = cg.createLinearGradient(0, mitteH * 0.3, 0, mitteH);
    dunst2.addColorStop(0, "rgba(0,0,0,0)");
    dunst2.addColorStop(1, T.fern.dunst);
    cg.fillStyle = dunst2;
    cg.fillRect(0, mitteH * 0.3, TW, mitteH * 0.7);

    // Ganz vorne: Hügel mit dichtem Tannenwald und ein paar Hütten – abends
    // und nachts brennt in ihnen Licht.
    const nahH = Math.round(H * 0.4);
    const nah = leinwand(TW, nahH, q);
    cg = nah.g;
    const nahY = (x) => nahH * (0.5 - Math.sin((x / TW) * Math.PI * 6 + 0.7) * 0.1 - Math.sin((x / TW) * Math.PI * 14 + 2.1) * 0.05);
    cg.fillStyle = T.nah.grund;
    cg.beginPath();
    cg.moveTo(0, nahH);
    for (let x = 0; x <= TW; x += 6) cg.lineTo(x, nahY(x));
    cg.lineTo(TW, nahH);
    cg.closePath();
    cg.fill();
    cg.fillStyle = T.nah.wald;
    for (let x = -12; x <= TW + 12; x += 7) {
      const hb = nahH * (0.09 + hash01(x * 0.37 + 3) * 0.08);
      const y = nahY(x) + nahH * 0.05;
      cg.beginPath();
      cg.moveTo(x - hb * 0.32, y + hb * 0.15);
      cg.lineTo(x, y - hb);
      cg.lineTo(x + hb * 0.32, y + hb * 0.15);
      cg.fill();
    }
    cg.fillRect(0, nahH * 0.55, TW, nahH * 0.45);
    const nachts = i >= 4;
    for (let n = 0; n < 5; n += 1) {
      const hx = ((n + 0.3 + hash01(n * 5.7) * 0.4) / 5) * TW;
      const hy = nahY(hx) + nahH * 0.1;
      const hb = nahH * 0.075;
      cg.fillStyle = nachts ? "#1a1f36" : "#6b4a3a";
      cg.fillRect(hx - hb, hy - hb * 0.8, hb * 2, hb * 0.8);
      cg.fillStyle = nachts ? "#2a3150" : "#f2f2f2";
      cg.beginPath();
      cg.moveTo(hx - hb * 1.25, hy - hb * 0.75);
      cg.lineTo(hx, hy - hb * 1.5);
      cg.lineTo(hx + hb * 1.25, hy - hb * 0.75);
      cg.closePath();
      cg.fill();
      cg.fillStyle = nachts || i === 3 ? T.nah.licht : "rgba(30, 30, 40, 0.5)";
      cg.fillRect(hx - hb * 0.6, hy - hb * 0.55, hb * 0.35, hb * 0.3);
      cg.fillRect(hx + hb * 0.25, hy - hb * 0.55, hb * 0.35, hb * 0.3);
    }

    // Wolken: drei Bäusche, die langsam ziehen.
    const wolken = [0, 1, 2].map((n) => {
      const ww = 150 + n * 40;
      const wh = 74;
      const w = leinwand(ww, wh, q);
      w.g.fillStyle = T.wolke;
      w.g.globalAlpha = i >= 4 ? 0.5 : 0.9;
      for (let k = 0; k < 7; k += 1) {
        const r = wh * (0.22 + hash01(n * 7 + k) * 0.18);
        const x = ww * (0.15 + (k / 6) * 0.7);
        w.g.beginPath();
        w.g.ellipse(x, wh * 0.56 - r * 0.45 * Math.sin((k / 6) * Math.PI), r * 1.3, r, 0, 0, Math.PI * 2);
        w.g.fill();
      }
      return { c: w.c, w: ww, h: wh };
    });

    // Tannen: drei schlanke und drei im Schatten (für den Wald vorne am
    // Hang), fertig gemalt – im Bild nur noch kopiert.
    const baeume = [0, 1, 2, 3, 4, 5].map((n) => maleTanne(T, n % 3, n >= 3, i >= 4, q));

    return { himmel: himmel.c, fern: fern.c, mitte: mitte.c, nah: nah.c, wolken, baeume, TW, fernH, mitteH, nahH, T };
  }

  // Eine Tanne, unten in der Mitte verankert: vier Stufen Äste, links im
  // Licht, rechts im Schatten, oben Schnee darauf.
  const TANNE_H = 200;
  const TANNE_B = 0.86;
  function maleTanne(T, variante, dunkel, nacht, q) {
    const S = TANNE_H;
    const W = S * TANNE_B;
    const { c, g: cg } = leinwand(W, S, q);
    const mitte = W / 2;
    const breit = [1, 0.82, 1.1][variante];
    const hell = dunkel ? mische(T.baum[0], T.baum[1], 0.5) : T.baum[0];
    const schatten = dunkel ? mische(T.baum[1], "#000000", 0.25) : T.baum[1];
    cg.fillStyle = "#3b2c25";
    cg.fillRect(mitte - S * 0.03, S * 0.78, S * 0.06, S * 0.22);
    for (let k = 0; k < 4; k += 1) {
      const unten = S * (0.86 - k * 0.2);
      const spitze = S * (0.5 - k * 0.15);
      const halb = (W / 2) * (1 - k * 0.2) * breit * (k === 0 ? 0.98 : 1);
      // Die Stufe, unten gezackt.
      const stufe = () => {
        cg.beginPath();
        cg.moveTo(mitte, spitze);
        cg.lineTo(mitte + halb, unten);
        for (let j = 1; j <= 6; j += 1) cg.lineTo(mitte + halb - (2 * halb * j) / 6, unten - (j % 2 ? S * 0.035 : 0));
        cg.closePath();
      };
      cg.fillStyle = hell;
      stufe();
      cg.fill();
      cg.save();
      stufe();
      cg.clip();
      cg.fillStyle = schatten;
      cg.fillRect(mitte, 0, W, S);
      // Schnee auf der Stufe: ein Band unter der Kante, links mehr.
      cg.fillStyle = nacht ? "rgba(190, 200, 245, 0.55)" : "rgba(255, 255, 255, 0.9)";
      cg.beginPath();
      cg.moveTo(mitte, spitze);
      cg.lineTo(mitte - halb * 1.02, unten);
      cg.lineTo(mitte - halb * 0.7, unten - S * 0.02);
      cg.lineTo(mitte - halb * 0.15, spitze + (unten - spitze) * 0.45);
      cg.lineTo(mitte + halb * 0.35, spitze + (unten - spitze) * 0.38);
      cg.lineTo(mitte + halb * 0.2, spitze + (unten - spitze) * 0.15);
      cg.closePath();
      cg.fill();
      cg.restore();
    }
    return { c, w: W, h: S };
  }

  // Ein Gipfel: Fels mit Sonnen- und Schattenseite, oben Schnee mit
  // zackigem Rand. Die Grate zittern ein wenig (feste Zahlen).
  function maleGipfel(cg, cx, unten, p, F, sonneLinks) {
    const spitze = { x: cx + (p.horn ? p.wl * 0.08 : 0), y: unten - p.h };
    const grat = (von, bis, saat, hoch) => {
      const pkt = [];
      const n = 9;
      for (let k = 1; k < n; k += 1) {
        const t = k / n;
        const j = (hash01(saat + k * 1.7) - 0.5) * p.h * 0.08 + (hash01(saat + k * 3.1) > 0.75 ? -p.h * 0.04 : 0);
        // Das Horn steigt erst flach, dann steil: die Kurve hängt durch.
        const ty = p.horn ? (hoch ? t ** 1.6 : 1 - (1 - t) ** 1.6) : t;
        pkt.push({ x: lerp(von.x, bis.x, t) + j * 0.4, y: lerp(von.y, bis.y, ty) + j });
      }
      return pkt;
    };
    const fussL = { x: cx - p.wl, y: unten };
    const fussR = { x: cx + p.wr, y: unten };
    const links = grat(fussL, spitze, p.saat, true);
    const rechts = grat(spitze, fussR, p.saat + 50, false);
    const umriss = [fussL, ...links, spitze, ...rechts, fussR];
    cg.save();
    cg.beginPath();
    umriss.forEach((q, k) => (k ? cg.lineTo(q.x, q.y) : cg.moveTo(q.x, q.y)));
    cg.closePath();
    cg.fillStyle = F.schatten;
    cg.fill();
    cg.clip();
    // Die Sonnenseite: vom Gipfel schräg hinunter.
    const mitteFuss = { x: cx + (sonneLinks ? -1 : 1) * p.wl * 0.05 + (p.horn ? p.wl * 0.2 : 0), y: unten };
    const sonnenSeite = () => {
      cg.beginPath();
      cg.moveTo(spitze.x, spitze.y);
      (sonneLinks ? [...links].reverse() : rechts).forEach((q) => cg.lineTo(q.x, q.y));
      cg.lineTo(sonneLinks ? fussL.x : fussR.x, unten);
      cg.lineTo(mitteFuss.x, mitteFuss.y);
      cg.closePath();
    };
    cg.fillStyle = F.fels;
    sonnenSeite();
    cg.fill();
    // Der Schnee: bis zur Schneegrenze, mit Zacken nach unten – auf der
    // Schattenseite bläulich, auf der Sonnenseite hell.
    const grenze = unten - p.h * (p.horn ? 0.42 : 0.5);
    const schneeFlaeche = () => {
      cg.beginPath();
      cg.moveTo(cx - p.wl * 1.2, unten - p.h * 1.2);
      cg.lineTo(cx + p.wr * 1.2, unten - p.h * 1.2);
      const schritte = 14;
      for (let k = schritte; k >= 0; k -= 1) {
        const x = cx - p.wl + ((p.wl + p.wr) * k) / schritte;
        const zacke = (k % 2 ? 1 : -0.4) * p.h * 0.07 * (0.5 + hash01(p.saat + k * 2.3));
        cg.lineTo(x, grenze + zacke + Math.abs(x - spitze.x) * 0.25);
      }
      cg.closePath();
    };
    cg.fillStyle = F.schneeSchatten;
    schneeFlaeche();
    cg.fill();
    cg.clip();
    cg.fillStyle = F.schnee;
    sonnenSeite();
    cg.fill();
    cg.restore();
  }

  // ---------------------------------------------------------------------------
  // Zeichnen: was weit weg ist
  // ---------------------------------------------------------------------------
  // Die Ebenen: wie stark sie der Kamera folgen (Bildpunkte je Meter, quer
  // und hoch) und wo ihr Fuss im Bild steht (Anteil der Höhe).
  const EBENEN = [
    { art: "fern", px: 0.5, py: 0.22, fuss: 0.66 },
    { art: "mitte", px: 1.4, py: 0.55, fuss: 0.8 },
    { art: "nah", px: 3.2, py: 1.1, fuss: 0.98 },
  ];

  function zeichneHintergrund() {
    const B = tagesBilder(tagBei(state.nr));
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.drawImage(B.himmel, 0, 0, canvas.width, canvas.height);
    flach();
    const W = view.cssW;
    const H = view.cssH;
    const yRef = state.sch ? state.sch.kPunkt.y * 0.5 : 0;
    const dy = kam.y - yRef;
    // Die Wolken ziehen langsam, unabhängig vom Springer.
    B.wolken.forEach((w, n) => {
      const breite = W + w.w * 2;
      const x = ((((n * 0.37 + 0.1) * breite - state.echt * (4 + n * 2) - kam.x * 0.2) % breite) + breite) % breite - w.w;
      const y = H * (0.08 + n * 0.09) + dy * 0.1;
      g.drawImage(w.c, x, y, w.w, w.h);
    });
    for (const e of EBENEN) {
      const bild = B[e.art];
      const hoch = B[`${e.art}H`];
      const TW = B.TW;
      const oben = Math.round(H * e.fuss - hoch + dy * e.py);
      const x0 = (((-kam.x * e.px) % TW) + TW) % TW - TW;
      for (let x = x0; x < W; x += TW) g.drawImage(bild, Math.round(x), oben, TW, hoch);
      if (e.art === "nah" && oben + hoch < H) {
        g.fillStyle = B.T.nah.wald;
        g.fillRect(0, oben + hoch - 1, W, H - oben - hoch + 1);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Zeichnen: die Schanze
  // ---------------------------------------------------------------------------
  const tz = () => TAGESZEITEN[tagBei(state.nr)];

  // Was von der Welt gerade im Bild ist (x in Metern).
  const sichtVon = () => (0 - view.ox) / kam.z;
  const sichtBis = () => (view.cssW - view.ox) / kam.z;

  // Das Gelände unter dem Anlauf: ein verschneiter Hang, der hinter der
  // Kante zum Aufsprunghang abfällt.
  const gelaendeY = (sch, x) => -sch.h0 - 1 + Math.max(0, -x) * Math.tan(rad(17));

  // Eine Tanne der Höhe h (m), ihr Fuss bei (x, y).
  function tanne(x, y, h, variante, dunkel = false) {
    const bild = tagesBilder(tagBei(state.nr)).baeume[(((variante % 3) + 3) % 3) + (dunkel ? 3 : 0)];
    const hoch = h * kam.z;
    const breit = hoch * TANNE_B;
    const X = bildX(x);
    if (X + breit < 0 || X - breit > view.cssW) return;
    g.drawImage(bild.c, X - breit / 2, bildY(y) - hoch, breit, hoch);
  }

  function zeichneSchanze() {
    const sch = state.sch;
    if (!sch) return;
    const T = tz();
    const z = kam.z;
    const nacht = tagBei(state.nr) >= 4;
    const von = sichtVon() - 20;
    const bis = sichtBis() + 20;
    const tief = bildY(sch.ende.y - 400);

    // Das Gelände hinter und unter dem Anlauf: ein verschneiter Waldhang.
    const gel = g.createLinearGradient(0, bildY(gelaendeY(sch, -sch.L)), 0, bildY(-sch.h0 - 30 * sch.f));
    gel.addColorStop(0, T.gelaende);
    gel.addColorStop(1, T.hang[1]);
    g.fillStyle = gel;
    g.beginPath();
    const links = Math.min(von, -sch.L * 1.6);
    g.moveTo(bildX(links), bildY(gelaendeY(sch, links)));
    g.lineTo(bildX(0), bildY(gelaendeY(sch, 0)));
    g.lineTo(bildX(8), bildY(-sch.h0 - 6));
    g.lineTo(bildX(8), tief);
    g.lineTo(bildX(links), tief);
    g.closePath();
    g.fill();

    // Bäume hinter Anlauf und Hang – ihr Fuss liegt etwas über dem Hang:
    // Sie stehen an seinen Seiten.
    const abst = 6.5 * Math.sqrt(sch.f);
    for (let n = Math.floor(von / abst); n <= Math.ceil(bis / abst); n += 1) {
      const h = (k) => hash01(n * 7.31 + k * 1.93 + sch.n * 0.7);
      const x = (n + h(1) * 0.8) * abst;
      if (h(2) < 0.35) continue;
      if (x > hangBeiS(sch, sch.tribuene - sch.HS * 0.05).x) continue;  // dort steht das Publikum
      const grund = x < 0 ? gelaendeY(sch, x) + 0.6 : hangBei(sch, x).y - 0.4 + h(3) * 1.5;
      tanne(x, grund, (6 + h(4) * 6) * Math.sqrt(sch.f) * 0.85, n);
    }

    zeichneRichterturm(sch, T, nacht);
    if (flutlichtBei(state.nr)) zeichneMasten(sch, T);
    zeichnePublikum(sch, T, nacht);
    zeichneZaun(sch, T, von, bis);
    zeichneFahnen(sch);

    // Der Aufsprunghang.
    const h = sch.hang;
    const ds = h[1].s - h[0].s;
    const schritt = Math.max(1, Math.floor(2.5 / (ds * z)));
    const i0 = clamp(Math.floor(hangBei(sch, Math.max(0, von)).s / ds) - 1, 0, h.length - 2) || 0;
    const i1 = clamp(Math.ceil(hangBei(sch, Math.max(0, bis)).s / ds) + 1, i0 + 1, h.length - 1) || h.length - 1;
    const oberkante = Math.min(bildY(h[i0].y), bildY(h[i1].y));
    const verlauf = g.createLinearGradient(0, oberkante, 0, oberkante + Math.max(80, view.cssH * 0.75));
    verlauf.addColorStop(0, T.hang[0]);
    verlauf.addColorStop(0.55, T.hang[1]);
    verlauf.addColorStop(1, mische(T.hang[1], T.baum[1], 0.45));
    g.fillStyle = verlauf;
    g.beginPath();
    g.moveTo(bildX(h[i0].x), tief);
    for (let i = i0; i <= i1; i += schritt) g.lineTo(bildX(h[i].x), bildY(h[i].y));
    g.lineTo(bildX(h[i1].x), bildY(h[i1].y));
    g.lineTo(bildX(h[i1].x), tief);
    g.closePath();
    g.fill();
    // Die Oberfläche: ein helles Band, darunter ein feiner Schatten, darauf
    // Licht.
    g.lineJoin = "round";
    g.strokeStyle = nacht ? "rgba(235, 240, 255, 0.4)" : "rgba(255, 255, 255, 0.55)";
    g.lineWidth = Math.max(4, 1.6 * z);
    g.beginPath();
    for (let i = i0; i <= i1; i += schritt) {
      const X = bildX(h[i].x);
      const Y = bildY(h[i].y) + Math.max(2, 0.8 * z);
      if (i === i0) g.moveTo(X, Y); else g.lineTo(X, Y);
    }
    g.stroke();
    g.strokeStyle = "rgba(60, 80, 140, 0.22)";
    g.lineWidth = Math.max(2, 0.5 * z);
    g.beginPath();
    for (let i = i0; i <= i1; i += schritt) {
      const X = bildX(h[i].x);
      const Y = bildY(h[i].y) + Math.max(1.5, 0.35 * z);
      if (i === i0) g.moveTo(X, Y); else g.lineTo(X, Y);
    }
    g.stroke();
    g.strokeStyle = nacht ? "rgba(240, 245, 255, 0.95)" : "#ffffff";
    g.lineWidth = Math.max(1.2, 0.18 * z);
    g.beginPath();
    for (let i = i0; i <= i1; i += schritt) {
      const X = bildX(h[i].x);
      const Y = bildY(h[i].y);
      if (i === i0) g.moveTo(X, Y); else g.lineTo(X, Y);
    }
    g.stroke();

    zeichneFlanke(sch, von, bis);
    zeichneMarken(sch, von, bis);
    zeichneAnlauf(sch, T);
  }

  // Der Wald an der Flanke des Hangs, auf unserer Seite: Tannen tief unter
  // der Oberfläche, ihre Spitzen bleiben ein gutes Stück darunter – sie
  // geben dem Hang Tiefe und verdecken nie, wo der Springer landet.
  function zeichneFlanke(sch, von, bis) {
    const wf = Math.sqrt(sch.f);
    const abst = 3.4 * wf;
    const unterkante = view.cssH + 20;
    for (let n = Math.floor(Math.max(1, von) / abst); n <= Math.ceil(bis / abst); n += 1) {
      for (let reihe = 0; reihe < 3; reihe += 1) {
        const h = (k) => hash01(n * 3.73 + reihe * 17.1 + k * 2.17 + sch.n);
        const x = (n + h(1) * 0.9) * abst;
        if (x < 4 || h(2) < 0.25) continue;
        const flaeche = hangBei(sch, x).y;
        const tief = (9 + reihe * 9 + h(3) * 7) * wf;
        const hoehe = (5 + h(4) * 4) * wf;
        const fuss = flaeche - tief;
        if (fuss + hoehe > flaeche - 2.5 * wf) continue;
        if (bildY(fuss + hoehe) > unterkante) continue;
        tanne(x, fuss, hoehe, n + reihe, reihe > 0);
      }
    }
  }

  // Der Richterturm neben dem Hang, auf Höhe des K-Punkts: sein Fuss steht
  // hinter dem Hang, die Kabine mit den Fenstern schaut darüber.
  function zeichneRichterturm(sch, T, nacht) {
    const x = sch.kPunkt.x * 0.56;
    const grund = hangBei(sch, x).y - 1;
    const wf = Math.sqrt(sch.f);
    const hoch = 8.5 * wf;
    const breit = 5.2 * wf;
    const z = kam.z;
    if (bildX(x + breit) < -10 || bildX(x - breit) > view.cssW + 10) return;
    g.fillStyle = T.bau[1];
    g.fillRect(bildX(x - breit * 0.32), bildY(grund + hoch), breit * 0.64 * z, hoch * z);
    const kabine = 3.2 * wf;
    g.fillStyle = T.bau[0];
    g.fillRect(bildX(x - breit / 2), bildY(grund + hoch + kabine), breit * z, kabine * z);
    g.fillStyle = nacht ? "#ffd98a" : "rgba(40, 60, 90, 0.75)";
    for (let n = 0; n < 4; n += 1) {
      g.fillRect(bildX(x - breit / 2 + 0.35 * wf + (n * (breit - 0.7 * wf)) / 4), bildY(grund + hoch + kabine * 0.82),
        ((breit - 0.7 * wf) / 4 - 0.25 * wf) * z, kabine * 0.48 * z);
    }
    g.fillStyle = T.bau[1];
    g.fillRect(bildX(x - breit / 2 - 0.4 * wf), bildY(grund + hoch + kabine + 0.5 * wf), (breit + 0.8 * wf) * z, 0.5 * wf * z);
  }

  // Die Masten des Flutlichts: hinter dem Hang, mit Lampen oben.
  function mastOrte(sch) {
    const orte = [];
    for (let s = sch.K * 0.08; s < sch.HS * 1.45; s += sch.HS * 0.22) {
      const p = hangBeiS(sch, s);
      orte.push({ x: p.x, y: p.y + 2, h: 26 * Math.sqrt(sch.f) });
    }
    orte.push({ x: -sch.L * 0.55, y: gelaendeY(sch, -sch.L * 0.55), h: 22 * Math.sqrt(sch.f) });
    return orte;
  }

  function zeichneMasten(sch, T) {
    const z = kam.z;
    for (const m of mastOrte(sch)) {
      if (bildX(m.x) < -60 || bildX(m.x) > view.cssW + 60) continue;
      g.strokeStyle = T.bau[1];
      g.lineWidth = Math.max(1.5, 0.45 * z);
      g.beginPath();
      g.moveTo(bildX(m.x), bildY(m.y));
      g.lineTo(bildX(m.x), bildY(m.y + m.h));
      g.stroke();
      g.fillStyle = T.bau[1];
      g.fillRect(bildX(m.x - 1.8), bildY(m.y + m.h + 1.2), 3.6 * z, 1.4 * z);
      g.fillStyle = "#fffbe6";
      for (let k = 0; k < 3; k += 1) {
        g.beginPath();
        g.arc(bildX(m.x - 1.2 + k * 1.2), bildY(m.y + m.h + 0.5), Math.max(1.2, 0.45 * z), 0, Math.PI * 2);
        g.fill();
      }
    }
  }

  // Das Licht der Masten: ein Hof um die Lampen und ein heller Kegel auf
  // den Hang, zusammengezählt («lighter»). Nach allem anderen gemalt – es
  // fällt auch auf den Springer.
  function zeichneFlutlicht() {
    const sch = state.sch;
    if (!sch || !flutlichtBei(state.nr)) return;
    const z = kam.z;
    g.globalCompositeOperation = "lighter";
    for (const m of mastOrte(sch)) {
      const lx = bildX(m.x);
      const ly = bildY(m.y + m.h + 0.5);
      if (lx < -view.cssW * 0.5 || lx > view.cssW * 1.5) continue;
      const r = Math.max(14, 6 * z);
      const hof = g.createRadialGradient(lx, ly, 1, lx, ly, r);
      hof.addColorStop(0, "rgba(255, 250, 220, 0.85)");
      hof.addColorStop(1, "rgba(255, 250, 220, 0)");
      g.fillStyle = hof;
      g.fillRect(lx - r, ly - r, r * 2, r * 2);
      const fuss = hangBeiS(sch, hangBei(sch, Math.max(0, m.x)).s + sch.HS * 0.1);
      const kegel = g.createLinearGradient(0, ly, 0, bildY(fuss.y));
      kegel.addColorStop(0, "rgba(255, 248, 220, 0.13)");
      kegel.addColorStop(1, "rgba(255, 248, 220, 0.04)");
      g.fillStyle = kegel;
      g.beginPath();
      g.moveTo(lx - 0.8 * z, ly);
      g.lineTo(lx + 0.8 * z, ly);
      g.lineTo(bildX(fuss.x + sch.HS * 0.08), bildY(fuss.y));
      g.lineTo(bildX(fuss.x - sch.HS * 0.12), bildY(fuss.y + 4));
      g.closePath();
      g.fill();
    }
    g.globalCompositeOperation = "source-over";
  }

  // Das Publikum im Auslauf: Reihen von Köpfen hinter dem Zaun, dazwischen
  // Fahnen – viele mit Schweizer Kreuz. Nach einem guten Sprung hüpfen sie.
  const FAHNEN = [
    { grund: "#e8262f", kreuz: true },
    { grund: "#e8262f", kreuz: true },
    { grund: "#1f5fd6", streifen: "#ffffff" },
    { grund: "#ffcc1a", streifen: "#1f9a4c" },
    { grund: "#e8262f", kreuz: true },
    { grund: "#ffffff", streifen: "#e8262f" },
  ];

  function zeichnePublikum(sch, T, nacht) {
    const z = kam.z;
    const s0 = sch.tribuene;
    const s1 = s0 + sch.HS * 0.34;
    const p0 = hangBeiS(sch, s0);
    const p1 = hangBeiS(sch, s1);
    if (bildX(p1.x) < -20 || bildX(p0.x) > view.cssW + 20) return;
    const REIHEN = 5;
    const STUFE = 1.35;
    // Die Tribüne: Stufen aus Beton, oben ein Dach.
    const stufe = (s, r) => hangBeiS(sch, s).y + 0.9 + r * STUFE;
    g.fillStyle = T.bau[1];
    g.beginPath();
    g.moveTo(bildX(p0.x), bildY(p0.y - 1));
    for (let s = s0; s <= s1 + 0.01; s += 2) g.lineTo(bildX(hangBeiS(sch, s).x), bildY(stufe(s, REIHEN) + 1.2));
    g.lineTo(bildX(p1.x), bildY(p1.y - 1));
    g.closePath();
    g.fill();
    g.strokeStyle = T.bau[0];
    g.lineWidth = Math.max(1, 0.12 * z);
    g.beginPath();
    for (let r = 0; r <= REIHEN; r += 1) {
      for (let s = s0; s <= s1 + 0.01; s += 2) {
        const p = hangBeiS(sch, s);
        if (s === s0) g.moveTo(bildX(p.x), bildY(stufe(s, r) - 0.15)); else g.lineTo(bildX(p.x), bildY(stufe(s, r) - 0.15));
      }
    }
    g.stroke();
    // Das Dach über der Tribüne, auf zwei Stützen.
    const dachY = (s) => stufe(s, REIHEN) + 3.4;
    g.fillStyle = "#c0392b";
    g.beginPath();
    g.moveTo(bildX(p0.x - 1), bildY(dachY(s0)));
    g.lineTo(bildX(p1.x + 1), bildY(dachY(s1)));
    g.lineTo(bildX(p1.x + 1), bildY(dachY(s1) + 0.9));
    g.lineTo(bildX(p0.x - 1), bildY(dachY(s0) + 0.9));
    g.closePath();
    g.fill();
    g.strokeStyle = T.bau[1];
    g.lineWidth = Math.max(1, 0.25 * z);
    g.beginPath();
    [0.04, 0.96].forEach((k) => {
      const p = hangBeiS(sch, lerp(s0, s1, k));
      g.moveTo(bildX(p.x), bildY(stufe(lerp(s0, s1, k), REIHEN)));
      g.lineTo(bildX(p.x), bildY(dachY(lerp(s0, s1, k))));
    });
    g.stroke();
    // Die Leute, Reihe um Reihe – nach einem guten Sprung hüpfen sie.
    const kopf = Math.max(0.9, 0.3 * z);
    const jubel = state.jubel;
    const abst = Math.max(0.8, 2.6 / z);
    for (let r = REIHEN - 1; r >= 0; r -= 1) {
      for (let s = s0 + 0.5; s < s1 - 0.3; s += abst) {
        const n = Math.round(s / abst) * 13 + r * 101;
        if (hash01(n * 1.7) < 0.1) continue;
        const p = hangBeiS(sch, s);
        const X = bildX(p.x + (hash01(n) - 0.5) * 0.3);
        if (X < -10 || X > view.cssW + 10) continue;
        const hupf = jubel > 0 ? Math.max(0, Math.sin(state.echt * (9 + hash01(n * 3) * 5) + n)) * 0.45 * jubel : 0;
        const Y = bildY(stufe(s, r) + 1 + hupf);
        const farbe = ["#e8262f", "#f5a623", "#2f6fd6", "#ffffff", "#2e9a5a", "#7a3fd0", "#20232c"][Math.floor(hash01(n * 2.3) * 7)];
        g.fillStyle = nacht ? "#3a4066" : farbe;
        g.fillRect(X - kopf * 0.9, Y, kopf * 1.8, kopf * 2.4);
        g.fillStyle = nacht ? "#4a5078" : "#f1c7a0";
        g.beginPath();
        g.arc(X, Y - kopf * 0.4, kopf * 0.75, 0, Math.PI * 2);
        g.fill();
        if (jubel > 0.3 && hash01(n * 5.1) < 0.35) {
          g.strokeStyle = nacht ? "#3a4066" : farbe;
          g.lineWidth = kopf * 0.5;
          g.beginPath();
          g.moveTo(X - kopf * 0.8, Y + kopf * 0.2);
          g.lineTo(X - kopf * 1.3, Y - kopf * 1.6);
          g.moveTo(X + kopf * 0.8, Y + kopf * 0.2);
          g.lineTo(X + kopf * 1.3, Y - kopf * 1.6);
          g.stroke();
        }
      }
    }
    // Die Fahnen über den Köpfen: geschwenkt, wenn sie jubeln.
    const fs = Math.max(5, sch.HS * 0.045);
    for (let s = s0 + fs * 0.6, n = 0; s < s1 - 1; s += fs, n += 1) {
      const F = FAHNEN[n % FAHNEN.length];
      const schwenk = jubel > 0 ? Math.sin(state.echt * 7 + n) * 0.5 * jubel : 0;
      zeichneFahne(hangBeiS(sch, s).x, stufe(s, 1 + (n % 3)) + 4.2, 2.2, 1.4, F, -1 + schwenk, 0.55 + jubel * 0.45, n);
    }
    // Vorne die Bande.
    g.fillStyle = "#1d2742";
    g.beginPath();
    g.moveTo(bildX(p0.x), bildY(p0.y + 0.2));
    for (let s = s0; s <= s1 + 0.01; s += 2) g.lineTo(bildX(hangBeiS(sch, s).x), bildY(hangBeiS(sch, s).y + 1.25));
    g.lineTo(bildX(p1.x), bildY(p1.y + 0.2));
    g.closePath();
    g.fill();
    if (z > 4) {
      g.font = `900 ${Math.round(0.8 * z)}px system-ui, sans-serif`;
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillStyle = "#F5A623";
      for (let s = s0 + 4; s < s1 - 3; s += 9) {
        const p = hangBeiS(sch, s);
        g.fillText("arcade", bildX(p.x), bildY(p.y + 0.72));
      }
    }
  }

  // Eine Fahne an einer Stange: oben links am Mast, weht in Richtung dir
  // (-1 links, 1 rechts), stark 0 (hängt) bis 1 (steht waagrecht).
  function zeichneFahne(x, y, breit, hoch, F, dir, stark, n) {
    const z = kam.z;
    const X = bildX(x);
    const Y = bildY(y);
    if (X < -40 || X > view.cssW + 40) return;
    g.strokeStyle = "#d8d8d8";
    g.lineWidth = Math.max(1, 0.12 * z);
    g.beginPath();
    g.moveTo(X, Y);
    g.lineTo(X, Y + 3.2 * z);
    g.stroke();
    const w = breit * z;
    const h = hoch * z;
    const d = dir < 0 ? -1 : 1;
    const haengt = (1 - clamp(stark, 0, 1)) * 0.9;
    const welle = (u) => Math.sin(state.echt * (5 + stark * 6) + u * 5 + n) * (0.08 + stark * 0.12) * h * u;
    const punkt = (u, v) => {
      const xx = X + d * u * w * (1 - haengt * 0.6);
      const yy = Y + v * h + u * haengt * h * 1.2 + welle(u);
      return [xx, yy];
    };
    g.fillStyle = F.grund;
    g.beginPath();
    let q = punkt(0, 0);
    g.moveTo(q[0], q[1]);
    for (let u = 0.25; u <= 1.001; u += 0.25) { q = punkt(u, 0); g.lineTo(q[0], q[1]); }
    for (let u = 1; u >= -0.001; u -= 0.25) { q = punkt(u, 1); g.lineTo(q[0], q[1]); }
    g.closePath();
    g.fill();
    if (h < 3) return;
    if (F.kreuz) {
      // Das Schweizer Kreuz in der Mitte.
      const m = punkt(0.5, 0.5);
      const a = h * 0.18;
      const b = h * 0.55;
      g.fillStyle = "#ffffff";
      g.fillRect(m[0] - a / 2, m[1] - b / 2, a, b);
      g.fillRect(m[0] - b / 2, m[1] - a / 2, b, a);
    } else if (F.streifen) {
      g.fillStyle = F.streifen;
      g.beginPath();
      q = punkt(0, 0.36);
      g.moveTo(q[0], q[1]);
      for (let u = 0.25; u <= 1.001; u += 0.25) { q = punkt(u, 0.36); g.lineTo(q[0], q[1]); }
      for (let u = 1; u >= -0.001; u -= 0.25) { q = punkt(u, 0.64); g.lineTo(q[0], q[1]); }
      g.closePath();
      g.fill();
    }
  }

  // Der Zaun am Rand des Hangs, mit Werbebanden nahe der Landung.
  function zeichneZaun(sch, T, von, bis) {
    const z = kam.z;
    if (z < 2.5) return;
    const s0 = Math.max(sch.K * 0.25, hangBei(sch, Math.max(0, von)).s);
    const s1 = Math.min(sch.HS * 1.95, hangBei(sch, Math.max(0, bis)).s);
    if (s1 <= s0) return;
    g.strokeStyle = tagBei(state.nr) >= 4 ? "rgba(150, 160, 200, 0.7)" : "rgba(70, 80, 110, 0.55)";
    g.lineWidth = Math.max(1, 0.1 * z);
    g.beginPath();
    for (let s = Math.ceil(s0 / 3) * 3; s < s1; s += 3) {
      const p = hangBeiS(sch, s);
      g.moveTo(bildX(p.x), bildY(p.y + 0.3));
      g.lineTo(bildX(p.x), bildY(p.y + 1.5));
    }
    g.stroke();
    // Die Banden: farbige Felder zwischen 0.8 K und HS.
    const farben = ["#e8262f", "#ffffff", "#1d2742", "#F5A623"];
    for (let s = Math.ceil(Math.max(s0, sch.K * 0.75) / 6) * 6, n = 0; s < Math.min(s1, sch.HS * 1.1); s += 6, n += 1) {
      const a = hangBeiS(sch, s);
      const c = hangBeiS(sch, s + 5.6);
      g.fillStyle = farben[Math.floor(s / 6) % farben.length];
      g.beginPath();
      g.moveTo(bildX(a.x), bildY(a.y + 0.4));
      g.lineTo(bildX(c.x), bildY(c.y + 0.4));
      g.lineTo(bildX(c.x), bildY(c.y + 1.4));
      g.lineTo(bildX(a.x), bildY(a.y + 1.4));
      g.closePath();
      g.fill();
    }
    g.strokeStyle = "rgba(255, 255, 255, 0.6)";
    g.lineWidth = Math.max(1, 0.08 * z);
    g.beginPath();
    for (let s = s0; s <= s1; s += 2) {
      const p = hangBeiS(sch, s);
      if (s === s0) g.moveTo(bildX(p.x), bildY(p.y + 1.5)); else g.lineTo(bildX(p.x), bildY(p.y + 1.5));
    }
    g.stroke();
  }

  // Die Windfahnen am Hang: grün bei Gegenwind (er trägt), rot bei
  // Rückenwind – wie im Fernsehen. Sie zeigen, wohin die Luft zieht.
  function zeichneFahnen(sch) {
    const plan = state.plan[state.nr];
    if (!plan) return;
    const w = plan.wind;
    const F = { grund: w >= 0 ? "#2fd36b" : "#ff4b3e" };
    const stark = clamp(Math.abs(w) / 2, 0.15, 1);
    [0.22, 0.45, 0.68, 0.9, 1.08].forEach((k, n) => {
      const p = hangBeiS(sch, sch.K * k);
      zeichneFahne(p.x, p.y + 4.2, 1.6, 0.9, F, w >= 0 ? -1 : 1, stark, n * 3);
    });
  }

  // Die Marken am Hang: blaue Striche alle 5 m, Tafeln alle 10 m, der
  // K-Punkt rot, HS dunkel, die Qualifikation als grüne Lichtwand.
  function zeichneMarken(sch, von, bis) {
    const z = kam.z;
    const s0 = Math.max(sch.K * 0.4, hangBei(sch, Math.max(0, von)).s);
    const s1 = Math.min(sch.HS * 1.15, hangBei(sch, Math.max(0, bis)).s);
    if (z > 2) {
      g.strokeStyle = "rgba(40, 90, 210, 0.55)";
      g.lineWidth = Math.max(1, 0.16 * z);
      g.beginPath();
      for (let s = Math.ceil(s0 / 5) * 5; s <= s1; s += 5) {
        const p = hangBeiS(sch, s);
        const nx = -Math.sin(p.b);
        const ny = -Math.cos(p.b);
        g.moveTo(bildX(p.x), bildY(p.y));
        g.lineTo(bildX(p.x + nx * 0.7), bildY(p.y + ny * 0.7));
      }
      g.stroke();
    }
    const schrift = clamp(z * 0.75, 0, 13);
    if (schrift >= 7) {
      g.font = `800 ${Math.round(schrift)}px system-ui, sans-serif`;
      g.textAlign = "center";
      g.textBaseline = "middle";
      for (let s = Math.ceil(s0 / 10) * 10; s <= s1; s += 10) {
        const p = hangBeiS(sch, s);
        const X = bildX(p.x);
        const Y = bildY(p.y + 2.4);
        g.fillStyle = "rgba(255, 255, 255, 0.92)";
        g.fillRect(X - schrift * 1.2, Y - schrift * 0.65, schrift * 2.4, schrift * 1.3);
        g.fillStyle = "#1d2742";
        g.fillText(String(s), X, Y + 0.5);
      }
    }
    // K und HS: ein Strich über den Hang und eine Tafel.
    const marke = (p, farbe, text) => {
      const X = bildX(p.x);
      const Y = bildY(p.y);
      if (X < -40 || X > view.cssW + 40) return;
      g.strokeStyle = farbe;
      g.lineWidth = Math.max(2, 0.4 * z);
      g.beginPath();
      g.moveTo(X, Y + Math.max(2, 0.4 * z));
      g.lineTo(X, Y - Math.max(10, 3.2 * z));
      g.stroke();
      const gross = clamp(z * 0.8, 9, 13);
      g.font = `900 ${Math.round(gross)}px system-ui, sans-serif`;
      const w = g.measureText(text).width + gross * 0.9;
      g.fillStyle = farbe;
      g.fillRect(X - w / 2, Y - Math.max(10, 3.2 * z) - gross * 1.4, w, gross * 1.4);
      g.fillStyle = "#ffffff";
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillText(text, X, Y - Math.max(10, 3.2 * z) - gross * 0.68);
    };
    marke(sch.kPunkt, "#e8262f", `K ${sch.K}`);
    marke(sch.hsPunkt, "#1d2742", `HS ${sch.HS}`);
    // Die Qualifikationslinie: eine grüne Wand aus Licht über dem Hang.
    const q = sch.qualiPunkt;
    const X = bildX(q.x);
    if (X > -40 && X < view.cssW + 40) {
      const Y = bildY(q.y);
      const hoch = Math.max(30, 9 * Math.sqrt(sch.f) * z);
      const puls = 0.75 + Math.sin(state.echt * 4) * 0.12;
      const licht = g.createLinearGradient(0, Y, 0, Y - hoch);
      licht.addColorStop(0, `rgba(60, 255, 140, ${0.55 * puls})`);
      licht.addColorStop(1, "rgba(60, 255, 140, 0)");
      g.fillStyle = licht;
      const b = Math.max(3, 0.7 * z);
      g.fillRect(X - b / 2, Y - hoch, b, hoch);
      g.fillStyle = "#3dff8c";
      g.fillRect(X - b * 0.2, Y - hoch * 0.9, b * 0.4, hoch * 0.9);
      g.strokeStyle = "#3dff8c";
      g.lineWidth = Math.max(2, 0.35 * z);
      g.beginPath();
      g.moveTo(X - 1.2 * z, Y + 0.3 * z);
      g.lineTo(X + 1.2 * z, Y - 0.6 * z);
      g.stroke();
    }
  }

  // Der Anlauf: Turm und Bahn, der Tisch mit der Kante, oben die
  // Starthütte mit dem Balken und der Ampel.
  function zeichneAnlauf(sch, T) {
    const z = kam.z;
    const a = sch.anlauf;
    const dick = 1.3 * Math.sqrt(sch.f);
    const schritt = Math.max(1, Math.floor(2 / ((a[1].u - a[0].u) * z)));
    const ende = Math.min(a.length - 1, Math.ceil(sch.L / (a[1].u - a[0].u)) + 2);
    // Die Stützen: von der Bahn hinunter ins Gelände, mit Streben.
    g.strokeStyle = T.bau[1];
    g.lineWidth = Math.max(1.2, 0.35 * z);
    g.beginPath();
    let vorher = null;
    for (let u = 3; u < sch.L; u += 3.2) {
      const p = anlaufBei(sch, u);
      const unten = gelaendeY(sch, p.x);
      if (p.y - dick <= unten + 0.3) { vorher = null; continue; }
      g.moveTo(bildX(p.x), bildY(p.y - dick));
      g.lineTo(bildX(p.x), bildY(unten));
      if (vorher) {
        g.moveTo(bildX(vorher.x), bildY(vorher.y - dick));
        g.lineTo(bildX(p.x), bildY(Math.max(unten, (p.y - dick + unten) / 2)));
      }
      vorher = p;
    }
    g.stroke();
    // Die Bahn: ein Band mit heller Spur oben.
    g.fillStyle = T.bau[1];
    g.beginPath();
    for (let i = 0; i <= ende; i += schritt) g.lineTo(bildX(a[i].x), bildY(a[i].y));
    g.lineTo(bildX(a[ende].x), bildY(a[ende].y - dick));
    for (let i = ende; i >= 0; i -= schritt) g.lineTo(bildX(a[i].x), bildY(a[i].y - dick));
    g.lineTo(bildX(0), bildY(-dick));
    g.closePath();
    g.fill();
    g.fillStyle = T.bau[0];
    g.beginPath();
    for (let i = 0; i <= ende; i += schritt) g.lineTo(bildX(a[i].x), bildY(a[i].y + 0.05));
    g.lineTo(bildX(a[ende].x), bildY(a[ende].y - dick * 0.45));
    for (let i = ende; i >= 0; i -= schritt) g.lineTo(bildX(a[i].x), bildY(a[i].y - dick * 0.45));
    g.closePath();
    g.fill();
    // Die Spur: hell, mit einer blauen Linie in der Mitte.
    g.strokeStyle = "#f4f8ff";
    g.lineWidth = Math.max(1.5, 0.28 * z);
    g.beginPath();
    for (let i = 0; i <= ende; i += schritt) {
      if (i === 0) g.moveTo(bildX(a[i].x), bildY(a[i].y)); else g.lineTo(bildX(a[i].x), bildY(a[i].y));
    }
    g.stroke();
    // Die Kante: rot-weiss, damit man sie sieht.
    g.fillStyle = "#e8262f";
    g.fillRect(bildX(-0.08), bildY(0.1), Math.max(2, 0.3 * z), Math.max(3, (dick + 0.1) * z));
    g.fillStyle = "#ffffff";
    g.fillRect(bildX(-0.08), bildY(-dick * 0.45), Math.max(2, 0.3 * z), Math.max(1, dick * 0.2 * z));
    // Der Turm oben: eine Plattform hinter dem Balken auf vier Beinen mit
    // Kreuzstreben, darauf die Starthütte.
    const oben = anlaufBei(sch, sch.L);
    const hx = oben.x - 2.4;
    const hy = oben.y + 0.6;
    const deckL = oben.x - 5.8;
    const deckR = oben.x + 0.3;
    const deckY = oben.y + 0.15;
    const fussL = gelaendeY(sch, deckL) - 0.5;
    const fussR = gelaendeY(sch, deckR - 0.6) - 0.5;
    g.strokeStyle = T.bau[1];
    g.lineWidth = Math.max(1.2, 0.32 * z);
    g.beginPath();
    for (const [bx, fy] of [[deckL + 0.4, fussL], [deckR - 0.6, fussR]]) {
      g.moveTo(bildX(bx), bildY(deckY));
      g.lineTo(bildX(bx), bildY(fy));
    }
    const stock = 3.2;
    for (let yy = deckY; yy > Math.max(fussL, fussR) + 0.5; yy -= stock) {
      const unten = Math.max(yy - stock, Math.max(fussL, fussR));
      g.moveTo(bildX(deckL + 0.4), bildY(yy));
      g.lineTo(bildX(deckR - 0.6), bildY(unten));
      g.moveTo(bildX(deckR - 0.6), bildY(yy));
      g.lineTo(bildX(deckL + 0.4), bildY(unten));
    }
    g.stroke();
    g.fillStyle = T.bau[1];
    g.fillRect(bildX(deckL), bildY(deckY), (deckR - deckL) * z, Math.max(2, 0.45 * z));
    g.fillStyle = T.bau[1];
    g.fillRect(bildX(hx - 2.6), bildY(hy + 3.2), 3.4 * z, 3.6 * z);
    g.fillStyle = "#c0392b";
    g.beginPath();
    g.moveTo(bildX(hx - 3.1), bildY(hy + 3.2));
    g.lineTo(bildX(hx - 0.9), bildY(hy + 4.6));
    g.lineTo(bildX(hx + 1.3), bildY(hy + 3.2));
    g.closePath();
    g.fill();
    g.fillStyle = tagBei(state.nr) >= 3 ? "#ffd98a" : "rgba(30, 40, 60, 0.7)";
    g.fillRect(bildX(hx - 1.9), bildY(hy + 2.5), 1.1 * z, 1 * z);
    // Die Ampel neben dem Balken.
    const ax = oben.x + 1.6;
    const ay = oben.y + 0.2;
    g.strokeStyle = "#3a3f55";
    g.lineWidth = Math.max(1, 0.12 * z);
    g.beginPath();
    g.moveTo(bildX(ax), bildY(ay));
    g.lineTo(bildX(ax), bildY(ay + 2.6));
    g.stroke();
    g.fillStyle = "#20232c";
    g.fillRect(bildX(ax - 0.35), bildY(ay + 3.6), 0.7 * z, 1.2 * z);
    const gruen = state.schritt !== "start" || state.phase === "zuschauen";
    g.fillStyle = gruen ? "#4b2020" : "#ff3b30";
    g.beginPath();
    g.arc(bildX(ax), bildY(ay + 3.3), Math.max(1.2, 0.22 * z), 0, Math.PI * 2);
    g.fill();
    g.fillStyle = gruen ? "#3dff8c" : "#1f4b30";
    g.beginPath();
    g.arc(bildX(ax), bildY(ay + 2.75), Math.max(1.2, 0.22 * z), 0, Math.PI * 2);
    g.fill();
  }

  // Die Böen als Luftschlieren: Striche, die hinunterziehen (Abwind, er
  // kippt nach vorne) oder hinauf (Aufwind, er kippt nach hinten).
  function zeichneBoeen() {
    const sch = state.sch;
    if (!sch || !state.boeen) return;
    const z = kam.z;
    const zeit = state.echt;
    const hoehe = 20 * sch.f ** 0.7;
    const sp = state.sp;
    for (const b of state.boeen) {
      if (bildX(b.x1) < -20 || bildX(b.x0) > view.cssW + 20) continue;
      // Was hinter dem Springer liegt, verblasst: Es zählt nicht mehr.
      const vorbei = sp && sp.x > 0 ? clamp(1 - (sp.x - b.x1) / (12 * Math.sqrt(sch.f)), 0, 1) : 1;
      if (vorbei <= 0) continue;
      const runter = b.dreh > 0;
      const farbe = runter ? "255, 196, 120" : "150, 225, 255";
      const stark = Math.abs(b.dreh) / 66;
      // Ein Hauch Farbe über der ganzen Stelle.
      const mx = (b.x0 + b.x1) / 2;
      const grund = hangBei(sch, mx).y;
      const saeule = g.createLinearGradient(0, bildY(grund + hoehe), 0, bildY(grund));
      saeule.addColorStop(0, `rgba(${farbe}, 0)`);
      saeule.addColorStop(0.5, `rgba(${farbe}, ${(0.035 + stark * 0.04) * vorbei})`);
      saeule.addColorStop(1, `rgba(${farbe}, 0)`);
      g.fillStyle = saeule;
      g.fillRect(bildX(b.x0), bildY(grund + hoehe), (b.x1 - b.x0) * z, hoehe * z);
      const anzahl = 11;
      g.lineCap = "round";
      for (let n = 0; n < anzahl; n += 1) {
        const h = (k) => hash01(n * 3.17 + k * 7.1 + b.x0 * 0.13);
        const u = h(1);
        const x = lerp(b.x0, b.x1, u);
        const boden = hangBei(sch, x).y;
        const lauf = ((zeit * (0.55 + h(2) * 0.5) + h(3)) % 1);
        const yy = runter ? boden + hoehe * (1 - lauf) : boden + 1 + hoehe * lauf;
        const lang = (1.5 + h(4) * 1.7) * Math.sqrt(sch.f);
        const sinU = Math.sin(Math.PI * u);
        const a = Math.sin(Math.PI * lauf) * sinU * (0.4 + stark * 0.45) * vorbei;
        if (a < 0.03) continue;
        const X = bildX(x);
        const Y = bildY(yy);
        const d = (runter ? 1 : -1) * lang * z;
        g.strokeStyle = `rgba(${farbe}, ${a})`;
        g.lineWidth = Math.max(1.2, 0.18 * z);
        g.beginPath();
        g.moveTo(X, Y - d);
        g.quadraticCurveTo(X + Math.sin(zeit * 3 + n) * 0.6 * z, Y - d / 2, X, Y);
        g.stroke();
        // Eine kleine Pfeilspitze vorne.
        const p = Math.max(2, 0.45 * z);
        g.beginPath();
        g.moveTo(X - p, Y - Math.sign(d) * p);
        g.lineTo(X, Y);
        g.lineTo(X + p, Y - Math.sign(d) * p);
        g.stroke();
      }
      g.lineCap = "butt";
    }
  }

  // ---------------------------------------------------------------------------
  // Der Springer
  // ---------------------------------------------------------------------------
  /*
   * Ein Gerippe in Metern, im Rahmen der Ski: x nach vorne, y nach oben, der
   * Fuss bei 0. Eine Haltung sagt, wo die Hüfte steht (hx, hy), wie weit die
   * Füsse auseinander sind (sp, der Telemark), wie der Rumpf, die Arme und
   * der Kopf stehen (Grad) und wie weit der hintere Ski zum V aufgeht (v).
   * Die Knie rechnet zeichneSpringer aus Hüfte und Fuss. Zwischen den
   * Haltungen wird weich überblendet: Hocke → Absprung → V-Stil → Telemark.
   * Die Arme schwingen dabei über unten (darum Winkel über 360).
   */
  const KOERPER = { ober: 0.47, unter: 0.47, rumpf: 0.6, arm: 0.6, hals: 0.21, kopf: 0.13 };
  const POSEN = {
    sitzen: { hx: -0.34, hy: 0.44, sp: 0, rumpf: 72, armV: 282, armH: 268, kopf: -6, v: 0 },
    hocke: { hx: -0.2, hy: 0.5, sp: 0, rumpf: 10, armV: 192, armH: 186, kopf: 16, v: 0 },
    absprung: { hx: 0.16, hy: 0.88, sp: 0, rumpf: 52, armV: 385, armH: 396, kopf: 4, v: 0 },
    flug: { hx: 0.86, hy: 0.36, sp: 0, rumpf: 16, armV: 196, armH: 203, kopf: 16, v: 11 },
    abriss: { hx: 0.55, hy: 0.66, sp: 0, rumpf: 48, armV: 455, armH: 510, kopf: -6, v: 15 },
    lande: { hx: 0.26, hy: 0.84, sp: 0.14, rumpf: 50, armV: 410, armH: 490, kopf: 0, v: 2 },
    telemark: { hx: 0.05, hy: 0.62, sp: 0.64, rumpf: 80, armV: 385, armH: 515, kopf: -8, v: 0 },
    hart: { hx: -0.12, hy: 0.48, sp: 0, rumpf: 34, armV: 405, armH: 420, kopf: 8, v: 0 },
    stehen: { hx: 0.02, hy: 0.9, sp: 0.08, rumpf: 86, armV: 622, armH: 638, kopf: 0, v: 0 },
    jubel: { hx: 0.02, hy: 0.92, sp: 0.08, rumpf: 88, armV: 430, armH: 472, kopf: -14, v: 0 },
    sturz: { hx: 0.42, hy: 0.42, sp: 0.5, rumpf: 150, armV: 470, armH: 380, kopf: 30, v: 30 },
  };
  const POSE_FELDER = ["hx", "hy", "sp", "rumpf", "armV", "armH", "kopf", "v"];

  // Die Haltung weich zur Zielhaltung ziehen (rate je s).
  function poseZu(pose, ziel, rate, dt) {
    const k = 1 - Math.exp(-rate * dt);
    for (const f of POSE_FELDER) pose[f] += (ziel[f] - pose[f]) * k;
  }

  // So gross wird der Springer gezeichnet (Bildpunkte je Meter): grösser
  // als echt, und nie kleiner als knapp 40 Bildpunkte hoch.
  const figurMass = () => Math.max(kam.z * 1.35, 21, view.minD * 0.045);

  // Das Knie zwischen Hüfte H und Fuss A, nach vorne gebeugt.
  function knie(H, A) {
    const l1 = KOERPER.ober;
    const l2 = KOERPER.unter;
    const dx = H[0] - A[0];
    const dy = H[1] - A[1];
    const d = clamp(Math.hypot(dx, dy), 0.2, (l1 + l2) * 0.999);
    const phi = Math.atan2(dy, dx);
    const alpha = Math.acos(clamp((l2 * l2 + d * d - l1 * l1) / (2 * l2 * d), -1, 1));
    return [A[0] + l2 * Math.cos(phi - alpha), A[1] + l2 * Math.sin(phi - alpha)];
  }

  const FARBEN = {
    anzug: "#e3262f", anzugD: "#a3151d", streifen: "#ffffff", helm: "#f6f6f6", visier: "#ffbf2e",
    ski: "#1d2742", skiD: "#3a4568", skiStreifen: "#F5A623", schuh: "#20232c", haut: "#f1c7a0",
  };

  /*
   * Der Springer an (x, y), die Ski im Winkel winkel (Bogenmass, gegen die
   * Uhr), in der Haltung pose. farbe: als Geist, ganz in dieser Farbe.
   */
  function zeichneSpringer(x, y, winkel, pose, { farbe = null, alpha = 1, fs = figurMass() } = {}) {
    const X = bildX(x);
    const Y = bildY(y);
    if (X < -fs * 3 || X > view.cssW + fs * 3 || Y < -fs * 3 || Y > view.cssH + fs * 3) return;
    const F = farbe ? { anzug: farbe, anzugD: farbe, streifen: farbe, helm: farbe, visier: "#ffffff", ski: farbe, skiD: farbe, skiStreifen: farbe, schuh: farbe, haut: farbe } : FARBEN;
    g.save();
    g.globalAlpha = alpha;
    g.translate(X, Y);
    g.rotate(-winkel);
    g.scale(fs, -fs);
    g.lineCap = "round";
    g.lineJoin = "round";
    const vA = [pose.sp / 2, 0.08];
    const hA = [-pose.sp / 2, 0.08];
    const H = [pose.hx, pose.hy];
    const kV = knie(H, vA);
    const kH = knie(H, hA);
    const r = rad(pose.rumpf);
    const S = [H[0] + KOERPER.rumpf * Math.cos(r), H[1] + KOERPER.rumpf * Math.sin(r)];
    const kr = rad(pose.rumpf + pose.kopf);
    const K = [S[0] + KOERPER.hals * Math.cos(kr), S[1] + KOERPER.hals * Math.sin(kr)];
    const hand = (w) => [S[0] + KOERPER.arm * Math.cos(rad(w)), S[1] + KOERPER.arm * Math.sin(rad(w))];
    const linie = (a, b, breit, farbeL) => {
      g.strokeStyle = farbeL;
      g.lineWidth = breit;
      g.beginPath();
      g.moveTo(a[0], a[1]);
      g.lineTo(b[0], b[1]);
      g.stroke();
    };
    const dick = Math.max(0.055, 2.2 / fs);
    const ski = (A, w, farbeS, streifen) => {
      g.save();
      g.translate(A[0], 0);
      g.rotate(w);
      g.fillStyle = farbeS;
      g.beginPath();
      g.moveTo(-0.95, 0);
      g.lineTo(1.18, 0);
      g.quadraticCurveTo(1.4, 0, 1.5, 0.13);
      g.lineTo(1.44, 0.15);
      g.quadraticCurveTo(1.34, dick, 1.18, dick);
      g.lineTo(-0.95, dick);
      g.closePath();
      g.fill();
      if (streifen) {
        g.fillStyle = streifen;
        g.fillRect(-0.7, dick * 0.55, 1.75, Math.max(0.018, dick * 0.35));
      }
      g.fillStyle = F.schuh;
      g.fillRect(-0.12, dick, 0.32, 0.05);
      g.restore();
    };
    const schuh = (A) => {
      g.fillStyle = F.schuh;
      g.beginPath();
      g.ellipse(A[0] + 0.05, A[1] + 0.02, 0.15, 0.08, 0, 0, Math.PI * 2);
      g.fill();
    };
    // Hinten: der zweite Ski (im V aufgeklappt), Bein und Arm.
    ski(hA, rad(pose.v), F.skiD, null);
    linie(H, kH, 0.16, F.anzugD);
    linie(kH, hA, 0.14, F.anzugD);
    schuh(hA);
    linie(S, hand(pose.armH), 0.105, F.anzugD);
    // Der Rumpf mit einem weissen Streifen.
    linie(H, S, 0.27, F.anzug);
    if (!farbe) {
      g.strokeStyle = F.streifen;
      g.lineWidth = 0.05;
      g.beginPath();
      g.moveTo(H[0] + Math.cos(r) * 0.08 - Math.sin(r) * 0.05, H[1] + Math.sin(r) * 0.08 + Math.cos(r) * 0.05);
      g.lineTo(S[0] - Math.cos(r) * 0.06 - Math.sin(r) * 0.05, S[1] - Math.sin(r) * 0.06 + Math.cos(r) * 0.05);
      g.stroke();
    }
    // Der Helm mit Visier nach vorne.
    g.fillStyle = F.helm;
    g.beginPath();
    g.arc(K[0], K[1], KOERPER.kopf, 0, Math.PI * 2);
    g.fill();
    if (!farbe) {
      g.fillStyle = F.anzug;
      g.beginPath();
      g.arc(K[0], K[1], KOERPER.kopf, kr + 0.9, kr + 2.2);
      g.lineTo(K[0], K[1]);
      g.closePath();
      g.fill();
    }
    g.strokeStyle = F.visier;
    g.lineWidth = 0.075;
    g.beginPath();
    g.arc(K[0], K[1], KOERPER.kopf * 0.8, kr - 0.85, kr + 0.35);
    g.stroke();
    // Vorne: Bein, Ski, Arm.
    linie(H, kV, 0.17, F.anzug);
    linie(kV, vA, 0.15, F.anzug);
    schuh(vA);
    ski(vA, 0, F.ski, F.skiStreifen);
    const hv = hand(pose.armV);
    linie(S, hv, 0.115, F.anzug);
    g.fillStyle = farbe ? farbe : "#20232c";
    g.beginPath();
    g.arc(hv[0], hv[1], 0.065, 0, Math.PI * 2);
    g.fill();
    g.restore();
  }

  // Der Schatten am Hang: je näher, desto dunkler und kleiner.
  function zeichneSchatten() {
    const sp = state.sp;
    const sch = state.sch;
    if (!sp || !sch || sp.x < 0) return;
    if (state.schritt !== "flug" && state.phase !== "zuschauen") return;
    const boden = hangBei(sch, sp.x);
    const hoch = sp.y - boden.y;
    if (hoch < 0.05 || hoch > 60) return;
    const fs = figurMass();
    const k = clamp(1 - hoch / 30, 0.15, 1);
    g.save();
    g.translate(bildX(sp.x + 0.5), bildY(boden.y));
    g.rotate(boden.b);
    g.fillStyle = `rgba(20, 30, 70, ${0.32 * k})`;
    g.beginPath();
    g.ellipse(0, -0.1 * fs, fs * (1.25 - 0.4 * k), fs * 0.13, 0, 0, Math.PI * 2);
    g.fill();
    g.restore();
  }

  // Die Gegner (geist.js): halb durchsichtige Springer in ihrer Farbe – nur,
  // wer gerade auf derselben Schanze springt.
  function zeichneGeister() {
    if (!gegner || state.phase === "bereit" || !state.sch) return;
    const orte = window.LernappGeist?.orte?.(gegner) || [];
    if (!orte.length) return;
    const sch = state.sch;
    const da = [];
    orte.forEach((o) => {
      // Wem im Live-Modus zugeschaut wird, der ist der Springer selbst.
      if (o.ziel) return;
      const wx = o.a / 10;
      const nr = Math.floor((wx + ABSTAND / 2) / ABSTAND);
      // Zwischen zwei Schanzen springt die Aufzeichnung: dort nicht zeigen.
      if (nr !== sch.n || Math.abs(o.da) > 400) return;
      const x = wx - nr * ABSTAND;
      const y = o.b / 10;
      const pose = posenGeist(sch, x, y);
      zeichneSpringer(x, y, (o.c || 0) / 100, pose, { farbe: o.farbe, alpha: 0.45 * o.blass });
      da.push({ ...o, sx: bildX(x), sy: bildY(y) - figurMass() * 1.2, weit: "" });
    });
    if (da.length) window.LernappGeist.namen(g, da, { breit: view.cssW, hoch: view.cssH });
  }

  // Wie ein Springer dasteht, nur aus seinem Ort: im Anlauf in der Hocke,
  // in der Luft im V, am Boden aufrecht.
  function posenGeist(sch, x, y) {
    if (x < -0.3) return POSEN.hocke;
    return y > bodenBei(sch, x).y + 0.6 ? POSEN.flug : POSEN.stehen;
  }

  // ---------------------------------------------------------------------------
  // Zeichnen: Anzeigen
  // ---------------------------------------------------------------------------
  // Der Bogen über dem Springer: wie er liegt. Grün ist ideal, gelb und
  // orange kostet Weite, rot vorne ist der Überschlag, blau hinten der
  // Strömungsabriss. Der Zeiger kippt nach rechts, wenn er nach vorne kippt.
  const BOGEN = 38;                // so viel Grad je Seite zeigt der Bogen
  function zeichneBogen() {
    const sp = state.sp;
    if (!sp || state.bogen <= 0.01) return;
    const fs = figurMass();
    const cx = bildX(sp.x) + Math.cos(sp.winkel) * fs * 0.4;
    const cy = bildY(sp.y) - fs * 1.05;
    const r = clamp(fs * 1.25, 30, 54);
    const winkelBei = (k) => rad(-90 + (clamp(k, -BOGEN, BOGEN) / BOGEN) * 52);
    g.save();
    g.globalAlpha = state.bogen;
    g.lineCap = "butt";
    // Im gefährlichen Bereich glüht der Bogen: rot vorne, blau hinten.
    const gefahr = clamp((Math.abs(state.sp.k) - 16) / 10, 0, 1);
    g.strokeStyle = gefahr > 0 && !ruhig()
      ? (state.sp.k > 0 ? `rgba(255, 59, 48, ${0.35 + 0.35 * gefahr * (0.5 + 0.5 * Math.sin(state.echt * 18))})` : `rgba(74, 168, 255, ${0.35 + 0.35 * gefahr * (0.5 + 0.5 * Math.sin(state.echt * 18))})`)
      : "rgba(10, 14, 30, 0.55)";
    g.lineWidth = 11 + gefahr * 4;
    g.beginPath();
    g.arc(cx, cy, r, winkelBei(-BOGEN) - 0.04, winkelBei(BOGEN) + 0.04);
    g.stroke();
    const feld = (von, bis, farbe) => {
      g.strokeStyle = farbe;
      g.lineWidth = 6;
      g.beginPath();
      g.arc(cx, cy, r, winkelBei(von), winkelBei(bis));
      g.stroke();
    };
    feld(-BOGEN, ABRISS, "#4aa8ff");
    feld(ABRISS, -14, "#ff9f1c");
    feld(-14, -IDEAL, "#ffd23f");
    feld(-IDEAL, IDEAL, "#3dff8c");
    feld(IDEAL, 14, "#ffd23f");
    feld(14, 24, "#ff9f1c");
    feld(24, BOGEN, "#ff3b30");
    // Der Zeiger.
    const k = sp.k;
    const w = winkelBei(k);
    const gruen = Math.abs(k) <= IDEAL;
    g.strokeStyle = "#ffffff";
    g.lineWidth = 3;
    g.lineCap = "round";
    g.beginPath();
    g.moveTo(cx + Math.cos(w) * (r - 10), cy + Math.sin(w) * (r - 10));
    g.lineTo(cx + Math.cos(w) * (r + 9), cy + Math.sin(w) * (r + 9));
    g.stroke();
    g.fillStyle = gruen ? "#3dff8c" : Math.abs(k) > 22 ? "#ff3b30" : "#ffd23f";
    g.beginPath();
    g.arc(cx + Math.cos(w) * (r + 9), cy + Math.sin(w) * (r + 9), 4.5, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = "rgba(10, 14, 30, 0.7)";
    g.lineWidth = 1.5;
    g.stroke();
    g.restore();
  }

  // Die Ringe: an der Kante (Absprung) und am Boden (Telemark). Ein Ring
  // zieht sich zusammen; wenn er den festen Ring trifft, ist der Moment.
  function zeichneRinge() {
    const sp = state.sp;
    const sch = state.sch;
    if (!sp || !sch) return;
    const ring = (X, Y, rest, voll, farbe, text) => {
      const r0 = 13;
      const r = r0 + Math.max(0, rest / voll) * 64;
      const a = clamp(1.25 - rest / voll, 0, 1);
      g.lineWidth = 3;
      g.strokeStyle = "rgba(255, 255, 255, 0.9)";
      g.beginPath();
      g.arc(X, Y, r0, 0, Math.PI * 2);
      g.stroke();
      g.strokeStyle = `rgba(${farbe}, ${a})`;
      g.lineWidth = 4;
      g.beginPath();
      g.arc(X, Y, r, 0, Math.PI * 2);
      g.stroke();
      if (text) {
        g.font = "900 14px system-ui, sans-serif";
        g.textAlign = "center";
        g.textBaseline = "middle";
        g.lineWidth = 4;
        g.strokeStyle = "rgba(10, 14, 30, 0.7)";
        g.globalAlpha = a;
        g.strokeText(text, X, Y + r0 + 20);
        g.fillStyle = "#ffffff";
        g.fillText(text, X, Y + r0 + 20);
        g.globalAlpha = 1;
      }
    };
    const ersterSprung = state.nr === 0 && state.phase === "spiel";
    if (state.schritt === "anlauf" && state.phase === "spiel" && !state.sprung?.getippt) {
      const rest = zeitBisKante();
      if (rest < RING_ANLAUF) ring(bildX(0), bildY(0), rest, RING_ANLAUF, "255, 210, 63", ersterSprung ? "Tippen!" : "");
    }
    if (state.anflug && state.schritt === "flug" && state.sprung && state.sprung.tele < 0 && state.phase === "spiel") {
      const ziel = state.landeOrt;
      if (ziel) ring(bildX(ziel.x), bildY(ziel.y), Math.max(0, state.tauVoraus - TELE_ZIEL), TELE_FENSTER - TELE_ZIEL, "120, 230, 255", ersterSprung ? "Beide!" : "");
    }
    // Wie der Absprung war: ein Ring, der aufgeht.
    const r = state.ring;
    if (r) {
      const u = clamp((state.echt - r.t) / 0.5, 0, 1);
      g.globalAlpha = 1 - u;
      g.strokeStyle = r.farbe;
      g.lineWidth = 4 * (1 - u) + 1;
      g.beginPath();
      g.arc(bildX(r.x), bildY(r.y), 13 + u * 40, 0, Math.PI * 2);
      g.stroke();
      g.globalAlpha = 1;
    }
  }

  function zeichneTeile() {
    if (!state.teile.length) return;
    const z = kam.z;
    for (let durchgang = 0; durchgang < 2; durchgang += 1) {
      if (durchgang) g.globalCompositeOperation = "lighter";
      for (const t of state.teile) {
        const hell = t.art === "funke";
        if (hell !== Boolean(durchgang)) continue;
        const k = clamp(t.leben / t.max, 0, 1);
        const X = bildX(t.x);
        const Y = bildY(t.y);
        if (X < -30 || X > view.cssW + 30 || Y < -30 || Y > view.cssH + 30) continue;
        g.fillStyle = t.farbe;
        if (t.art === "wolke") {
          g.globalAlpha = k * 0.55;
          g.beginPath();
          g.arc(X, Y, Math.max(1.5, t.r * z * (1.9 - k * 0.9)), 0, Math.PI * 2);
          g.fill();
        } else if (t.art === "ski") {
          g.globalAlpha = Math.min(1, k * 3);
          g.save();
          g.translate(X, Y);
          g.rotate(-t.dreh);
          const fs = figurMass();
          g.fillRect(-1.1 * fs, -0.04 * fs, 2.4 * fs, Math.max(2, 0.07 * fs));
          g.restore();
        } else {
          g.globalAlpha = Math.min(1, k * 1.6);
          g.beginPath();
          g.arc(X, Y, Math.max(0.8, t.r * z * (0.5 + k * 0.5)), 0, Math.PI * 2);
          g.fill();
        }
      }
    }
    g.globalAlpha = 1;
    g.globalCompositeOperation = "source-over";
  }

  // Unter Flutlicht schneit es leise: Flocken im Bild, die mit der Kamera
  // vorbeiziehen (nah: schneller als der Hang).
  const flocken = { liste: [], kx: 0, ky: 0 };
  function flockenTakt(dt) {
    if (tagBei(state.nr) < 4 || ruhig()) { flocken.liste.length = 0; return; }
    const W = view.cssW;
    const H = view.cssH;
    if (!flocken.liste.length) {
      for (let n = 0; n < 70; n += 1) {
        flocken.liste.push({ x: Math.random() * W, y: Math.random() * H, r: 0.8 + Math.random() * 1.8, v: 18 + Math.random() * 30, p: Math.random() * 6 });
      }
      flocken.kx = kam.x;
      flocken.ky = kam.y;
    }
    const dx = (kam.x - flocken.kx) * kam.z;
    const dy = (kam.y - flocken.ky) * kam.z;
    flocken.kx = kam.x;
    flocken.ky = kam.y;
    // Ein Sprung der Kamera (neue Schanze) zieht die Flocken nicht mit.
    const sprung = Math.abs(dx) > W || Math.abs(dy) > H;
    for (const f of flocken.liste) {
      const nah = f.r / 2.6;
      if (!sprung) {
        f.x -= dx * (0.6 + nah * 0.8);
        f.y += dy * (0.6 + nah * 0.8);
      }
      f.p += dt;
      f.x += Math.sin(f.p * 1.3) * 10 * dt;
      f.y += f.v * dt;
      f.x = ((f.x % W) + W) % W;
      f.y = ((f.y % H) + H) % H;
    }
  }

  function zeichneFlocken() {
    if (!flocken.liste.length) return;
    g.fillStyle = "rgba(235, 240, 255, 0.75)";
    g.beginPath();
    for (const f of flocken.liste) {
      g.moveTo(f.x + f.r, f.y);
      g.arc(f.x, f.y, f.r, 0, Math.PI * 2);
    }
    g.fill();
  }

  // Die Speed-Linien: helle Striche, die am Springer vorbeiziehen.
  function zeichneStriche() {
    if (!state.striche.length) return;
    g.lineCap = "round";
    for (const s of state.striche) {
      const k = clamp(s.leben / s.max, 0, 1);
      g.strokeStyle = `rgba(255, 255, 255, ${0.5 * Math.sin(Math.PI * k)})`;
      g.lineWidth = s.dick;
      g.beginPath();
      g.moveTo(s.x, s.y);
      g.lineTo(s.x + s.dx, s.y + s.dy);
      g.stroke();
    }
    g.lineCap = "butt";
  }

  function zeichneSchriften() {
    if (!state.schriften.length) return;
    g.textAlign = "center";
    g.textBaseline = "middle";
    for (const sch of state.schriften) {
      const k = clamp(sch.leben / sch.max, 0, 1);
      const alter = sch.max - sch.leben;
      const pop = alter < 0.15 && !ruhig() ? 0.6 + (alter / 0.15) * 0.4 + Math.sin((alter / 0.15) * Math.PI) * 0.25 : 1;
      const gross = Math.round(sch.gross * clamp(view.minD / 380, 0.9, 1.5) * pop);
      const sp = sch.folgt ? state.sp : null;
      const X0 = sp ? bildX(sp.x) : bildX(sch.x);
      const Y0 = sp ? bildY(sp.y) - figurMass() * 2.6 : bildY(sch.y);
      const x = clamp(X0, gross * sch.text.length * 0.3 + 8, view.cssW - gross * sch.text.length * 0.3 - 8);
      const y = clamp(Y0 - (1 - k) * 20, view.frei + gross, view.cssH - gross * 3);
      g.globalAlpha = Math.min(1, k * 2.5);
      g.font = `900 ${gross}px system-ui, sans-serif`;
      g.lineWidth = Math.max(3, gross * 0.2);
      g.lineJoin = "round";
      g.strokeStyle = "rgba(10, 14, 30, 0.75)";
      g.strokeText(sch.text, x, y);
      g.fillStyle = sch.farbe;
      g.fillText(sch.text, x, y);
    }
    g.globalAlpha = 1;
  }

  function pille(text, x, y, gross, grund, schrift, mitte = false) {
    g.font = `900 ${gross}px system-ui, sans-serif`;
    const w = g.measureText(text).width + gross * 1.4;
    const h = gross * 1.7;
    const x0 = mitte ? x - w / 2 : x;
    g.fillStyle = grund;
    g.beginPath();
    if (g.roundRect) g.roundRect(x0, y, w, h, h / 2);
    else g.rect(x0, y, w, h);
    g.fill();
    g.fillStyle = schrift;
    g.textAlign = "left";
    g.textBaseline = "middle";
    g.fillText(text, x0 + gross * 0.7, y + h / 2 + 1);
    return h;
  }

  // Oben links, unter den Knöpfen: die Meter, darunter der Sprung und der
  // Wind.
  function zeichneAnzeige() {
    if (state.phase === "bereit") return;
    flach();
    g.translate(0, view.frei);
    const gross = clamp(view.cssH * 0.05, 14, 24);
    g.font = `900 ${Math.round(gross)}px system-ui, sans-serif`;
    const text = `${state.punkte} m`;
    const x = 12;
    let y = 12;
    const w = g.measureText(text).width + gross * 2.2;
    const hoch = gross * 1.6;
    g.fillStyle = "rgba(12, 16, 34, 0.6)";
    g.beginPath();
    if (g.roundRect) g.roundRect(x, y, w, hoch, hoch / 2);
    else g.rect(x, y, w, hoch);
    g.fill();
    // Ein kleiner Springer im V vor der Zahl.
    const bx = x + gross * 0.85;
    const by = y + hoch / 2;
    g.strokeStyle = "#F5A623";
    g.lineWidth = Math.max(2, gross * 0.12);
    g.lineCap = "round";
    g.beginPath();
    g.moveTo(bx - gross * 0.42, by + gross * 0.18);
    g.lineTo(bx + gross * 0.42, by - gross * 0.12);
    g.moveTo(bx - gross * 0.42, by + gross * 0.32);
    g.lineTo(bx + gross * 0.38, by + gross * 0.06);
    g.stroke();
    g.fillStyle = "#ffffff";
    g.beginPath();
    g.arc(bx + gross * 0.28, by - gross * 0.3, gross * 0.13, 0, Math.PI * 2);
    g.fill();
    g.lineCap = "butt";
    g.fillStyle = "#ffffff";
    g.textAlign = "left";
    g.textBaseline = "middle";
    g.fillText(text, x + gross * 1.6, by + 1);
    y += hoch + 6;
    const klein = Math.round(gross * 0.6);
    const sch = state.sch;
    if (sch) y += pille(`Sprung ${state.nr + 1} · HS ${sch.HS}`, x, y, klein, "rgba(12, 16, 34, 0.55)", "#ffffff") + 5;
    // Im Anlauf und gleich nach der Kante: das Tempo, wie im Fernsehen.
    const sp = state.sp;
    if (sch && sp && (state.schritt === "anlauf" || (state.schritt === "flug" && sp.tf < 1))) {
      const kmh = (state.schritt === "anlauf" ? sp.v / sch.vKante : 1) * kmhKante(sch.HS);
      y += pille(`${kmh.toFixed(1)} km/h`, x, y, klein, "rgba(12, 16, 34, 0.55)", "#ffd23f") + 5;
    }
    const plan = state.plan[state.nr];
    if (plan && state.schritt !== "wechsel") {
      const w2 = plan.wind;
      const pfeil = w2 >= 0 ? "←" : "→";
      const wort = w2 >= 0 ? "Gegenwind" : "Rückenwind";
      pille(`${pfeil} ${wort} ${Math.abs(w2).toFixed(1)}`, x, y, klein, w2 >= 0 ? "rgba(47, 211, 107, 0.9)" : "rgba(255, 75, 62, 0.92)", w2 >= 0 ? "#0b2a17" : "#ffffff");
    }
  }

  // Unten in der Mitte, wie im Fernsehen: vor dem Sprung die Schanze, nach
  // dem Sprung die Weite.
  function zeichneTv() {
    const tv = state.tv;
    if (!tv) return;
    const ein = clamp(tv.alter / 0.25, 0, 1);
    const aus = clamp((tv.dauer - tv.alter) / 0.3, 0, 1);
    const k = Math.min(ein, aus);
    if (k <= 0) return;
    flach();
    const W = view.cssW;
    const knopf = clamp(Math.min(W, view.cssH) * 0.15, 54, 76);
    const breit = Math.min(W - 24, 420);
    const gross = clamp(view.minD * 0.075, 22, 40);
    const klein = Math.round(clamp(gross * 0.42, 11, 15));
    const zeile1 = klein * 1.55;
    const zeile2 = zeile1 + gross * 1.02;
    const zeile3 = zeile2 + klein * 1.65;
    const hoch = zeile3 + klein * 0.85;
    const unten = view.cssH - 14 - knopf - 14;
    const x = (W - breit) / 2 - (1 - ein) * 40 * (ruhig() ? 0 : 1);
    const y = unten - hoch;
    g.globalAlpha = k;
    g.fillStyle = "rgba(10, 14, 30, 0.84)";
    g.beginPath();
    if (g.roundRect) g.roundRect(x, y, breit, hoch, 12);
    else g.rect(x, y, breit, hoch);
    g.fill();
    g.fillStyle = tv.farbe || "#F5A623";
    g.fillRect(x, y + 10, 5, hoch - 20);
    g.textBaseline = "alphabetic";
    g.textAlign = "left";
    g.fillStyle = "rgba(255, 255, 255, 0.7)";
    g.font = `800 ${klein}px system-ui, sans-serif`;
    g.fillText(tv.oben, x + 18, y + zeile1);
    g.fillStyle = "#ffffff";
    g.font = `900 ${Math.round(gross)}px system-ui, sans-serif`;
    g.fillText(tv.gross, x + 18, y + zeile2);
    if (tv.rechts) {
      g.textAlign = "right";
      g.font = `900 ${Math.round(gross * 0.55)}px system-ui, sans-serif`;
      g.fillStyle = tv.rechtsFarbe || "#ffffff";
      g.fillText(tv.rechts, x + breit - 16, y + zeile2 - gross * 0.08);
    }
    g.textAlign = "left";
    g.font = `800 ${klein}px system-ui, sans-serif`;
    g.fillStyle = tv.untenFarbe || "rgba(255, 255, 255, 0.85)";
    g.fillText(tv.unten, x + 18, y + zeile3);
    g.globalAlpha = 1;
  }

  function zeichnen() {
    if (!g) return;
    kameraSetzen();
    g.setTransform(1, 0, 0, 1, 0, 0);
    zeichneHintergrund();
    flach();
    zeichneSchanze();
    zeichneBoeen();
    zeichneSchatten();
    zeichneGeister();
    const sp = state.sp;
    if (sp) zeichneSpringer(sp.x, sp.y, sp.winkel, sp.pose);
    zeichneTeile();
    zeichneFlutlicht();
    zeichneFlocken();
    zeichneStriche();
    zeichneRinge();
    zeichneBogen();
    zeichneSchriften();
    if (state.blitz > 0.01 && !ruhig()) {
      g.fillStyle = `rgba(255, 250, 235, ${state.blitz * 0.25})`;
      g.fillRect(0, 0, view.cssW, view.cssH);
    }
    zeichneTv();
    zeichneAnzeige();
    if (state.blende > 0.005) {
      flach();
      g.fillStyle = `rgba(8, 10, 22, ${state.blende})`;
      g.fillRect(0, 0, view.cssW, view.cssH);
    }
  }

  // ---------------------------------------------------------------------------
  // Teilchen und Schriften
  // ---------------------------------------------------------------------------
  const TEILE_MAX = 240;
  const STRICHE_MAX = 40;

  function teil(t) {
    if (state.teile.length >= TEILE_MAX) state.teile.shift();
    state.teile.push(t);
  }

  // Pulverschnee, der von den Ski stiebt.
  function schnee(x, y, vx, vy, anzahl, streu = 1) {
    if (ruhig()) anzahl = Math.ceil(anzahl / 3);
    const nacht = tagBei(state.nr) >= 4;
    for (let i = 0; i < anzahl; i += 1) {
      teil({
        art: "flocke", x: x + (Math.random() - 0.5) * 0.6, y: y + Math.random() * 0.3,
        vx: vx * (0.3 + Math.random() * 0.5) + (Math.random() - 0.5) * 6 * streu,
        vy: vy * (0.3 + Math.random() * 0.4) + Math.random() * 5 * streu,
        r: 0.06 + Math.random() * 0.1, farbe: nacht ? "#dfe6ff" : "#ffffff", leben: 0.5 + Math.random() * 0.5, max: 1,
      });
    }
  }

  // Eine Wolke aus Schneestaub: bei der Landung und beim Sturz.
  function staub(x, y, anzahl, kraft = 1) {
    if (ruhig()) anzahl = Math.ceil(anzahl / 3);
    const nacht = tagBei(state.nr) >= 4;
    for (let i = 0; i < anzahl; i += 1) {
      const w = Math.PI * (0.05 + Math.random() * 0.9);
      const v = (2 + Math.random() * 7) * kraft;
      teil({
        art: "wolke", x: x + (Math.random() - 0.5) * 1.5, y: y + 0.2,
        vx: Math.cos(w) * v + 4 * kraft, vy: Math.sin(w) * v * 0.7,
        r: 0.35 + Math.random() * 0.5, farbe: nacht ? "#cdd6f5" : i % 3 ? "#ffffff" : "#e3ecfa", leben: 0.8 + Math.random() * 0.7, max: 1.5,
      });
    }
  }

  function funken(x, y, anzahl, farben) {
    if (ruhig()) anzahl = Math.ceil(anzahl / 3);
    for (let i = 0; i < anzahl; i += 1) {
      const w = Math.random() * Math.PI * 2;
      const v = 3 + Math.random() * 6;
      teil({ art: "funke", x, y, vx: Math.cos(w) * v, vy: Math.sin(w) * v, r: 0.08 + Math.random() * 0.1,
        farbe: farben[i % farben.length], leben: 0.4 + Math.random() * 0.4, max: 0.8 });
    }
  }

  function schrift(text, farbe, gross, dauer = 1.2, { x = 0, y = 0, folgt = true } = {}) {
    state.schriften.push({ text, farbe, gross, x, y, folgt, leben: dauer, max: dauer });
    if (state.schriften.length > 4) state.schriften.shift();
  }

  function tvZeigen(inhalt, dauer) {
    state.tv = { ...inhalt, alter: 0, dauer };
  }

  // Die Karte vor dem Sprung: Schanze, Qualifikation, Wind.
  function karteZeigen(dauer) {
    const sch = state.sch;
    const plan = state.plan[state.nr];
    if (!sch || !plan) return;
    const gegen = plan.wind >= 0;
    tvZeigen({
      oben: `SPRUNG ${state.nr + 1}${sch.HS >= 185 ? " · SKIFLUG" : ""}`,
      gross: `HS ${sch.HS}`,
      rechts: `Quali ${sch.quali} m`,
      rechtsFarbe: "#3dff8c",
      unten: `${gegen ? "Gegenwind" : "Rückenwind"} ${Math.abs(plan.wind).toFixed(1)} m/s · K ${sch.K}`,
      untenFarbe: gegen ? "#9ff5bd" : "#ffb0a8",
      farbe: "#F5A623",
      karte: true,
    }, dauer);
  }

  // ---------------------------------------------------------------------------
  // Der Sprung
  // ---------------------------------------------------------------------------
  function neuerSpringer(sch) {
    const oben = anlaufBei(sch, sch.L);
    return {
      x: oben.x, y: oben.y, vx: 0, vy: 0, v: 0, u: sch.L, s: 0,
      k: 0, kw: 0, tf: 0, winkel: -oben.b, dreh: 0, drehW: 0, sturz: false,
      pose: { ...POSEN.sitzen }, poseZiel: POSEN.sitzen, poseRate: 6,
    };
  }

  function neuerSprungZustand() {
    return {
      getippt: false, tippZeit: -1, kanteZeit: -1, abgesprungen: false, verpasst: false, art: "",
      kraft: 0, tele: -1, landung: "", weite: 0, bonus: 0, quali: true, landeZeit: -1,
    };
  }

  // Eine Schanze aufbauen: für den ersten Sprung und jeden weiteren – im
  // Spiel und beim Zuschauen.
  function schanzeAufbauen(nr) {
    planBis(nr + 1);
    state.nr = nr;
    state.sch = baueSchanze(nr);
    state.boeen = boeenIm(state.sch, state.plan[nr]);
    state.sp = neuerSpringer(state.sch);
    state.sprung = neuerSprungZustand();
    state.anflug = false;
    state.tauVoraus = 9;
    state.landeOrt = null;
    state.bogen = 0;
    state.teile = [];
    state.striche = [];
    state.ring = null;
    kam.bereit = false;
  }

  // Zeit bis zur Kante (in der Zeit des Spiels) – für den Ring und den
  // Autopiloten der Tests.
  function zeitBisKante() {
    const sp = state.sp;
    const sch = state.sch;
    if (!sp || !sch || state.schritt !== "anlauf") return 9;
    const a = anlaufBeschl(sch);
    const t = (-sp.v + Math.sqrt(sp.v * sp.v + 2 * a * Math.max(0, sp.u))) / a;
    return t / ANLAUF_TEMPO;
  }

  // Gleichmässig schneller im Anlauf: so, dass er an der Kante genau vKante
  // hat. Wer zu früh aufsteht, bremst sich (Luftwiderstand).
  const anlaufBeschl = (sch) => (sch.vKante * sch.vKante) / (2 * sch.L) * (state.sprung?.getippt ? 0.72 : 1);

  function anlaufen() {
    state.schritt = "anlauf";
    const sp = state.sp;
    sp.v = 0;
    sp.u = state.sch.L;
    sp.poseZiel = POSEN.hocke;
    sp.poseRate = 5;
    kids()?.vibrate?.(8);
  }

  function anlaufSchritt(h) {
    const sp = state.sp;
    const sch = state.sch;
    const hp = h * ANLAUF_TEMPO;
    const uVor = sp.u;
    sp.v = Math.min(sch.vKante * 1.02, sp.v + anlaufBeschl(sch) * hp);
    sp.u -= sp.v * hp;
    if (sp.u > 0) {
      const p = anlaufBei(sch, sp.u);
      sp.x = p.x;
      sp.y = p.y;
      sp.winkel = -p.b;
      sp.vx = Math.cos(p.b) * sp.v;
      sp.vy = -Math.sin(p.b) * sp.v;
      return;
    }
    // Die Kante: genau dort, wo er sie in diesem Schritt überquert hat.
    const anteil = uVor / Math.max(1e-6, uVor - sp.u);
    state.sprung.kanteZeit = state.zeit - h + h * anteil;
    const t = rad(TISCH);
    sp.x = 0;
    sp.y = 0;
    sp.vx = Math.cos(t) * sp.v;
    sp.vy = -Math.sin(t) * sp.v;
    sp.tf = 0;
    sp.winkel = -t;
    state.schritt = "flug";
    if (state.sprung.getippt) abspringen(state.sprung.tippZeit - state.sprung.kanteZeit);
  }

  /*
   * Der Absprung, e Sekunden nach der Kante (negativ: davor). Wie genau,
   * entscheidet die Kraft quer zum Tisch und wie er in der Luft liegt: Zu
   * früh steht er auf und liegt hinten, zu spät ist er schon über die Kante
   * gekippt und liegt vorne.
   */
  function abspringen(e) {
    const sp = state.sp;
    const sch = state.sch;
    const sprung = state.sprung;
    const n = state.nr;
    const perf = perfektBei(n);
    const gut = gutBei(n);
    const a = Math.abs(e);
    let q;
    let art;
    if (a <= perf) { q = 1; art = "perfekt"; }
    else if (a <= gut) { q = 1 - 0.13 * ((a - perf) / (gut - perf)); art = "gut"; }
    else if (e < 0) { q = Math.max(0.25, 0.87 - ((a - gut) / (FRUEH_MAX - gut)) * 0.62); art = "frueh"; }
    else { q = Math.max(0.2, 0.87 - ((a - gut) / Math.max(0.01, SPAET_MAX - gut)) * 0.67); art = "spaet"; }
    sprung.abgesprungen = true;
    sprung.art = art;
    sprung.kraft = q;
    sprung.e = e;
    const t = rad(TISCH);
    const kraft = SPRUNG * Math.sqrt(sch.f) * q;
    sp.vx += Math.sin(t) * kraft;
    sp.vy += Math.cos(t) * kraft;
    if (art === "perfekt") { sp.k = e * 30; sp.kw = 0; }
    else if (art === "gut") { sp.k = e * 55; sp.kw = 0; }
    else if (art === "frueh") { sp.k = -Math.min(18, 6 + a * 35); sp.kw = -6; }
    else { sp.k = Math.max(sp.k, Math.min(18, 6 + a * 80)); sp.kw = Math.max(sp.kw, 14); }
    sp.poseZiel = POSEN.absprung;
    sp.poseRate = 16;
    if (state.phase !== "spiel") return;
    const farbe = { perfekt: "#3dff8c", gut: "#ffffff", frueh: "#ffb347", spaet: "#ffb347" }[art];
    state.ring = { x: 0, y: 0, t: state.echt, farbe };
    if (art === "perfekt") {
      schrift("Perfekt!", "#ffd23f", 24, 1.1);
      funken(0, 0.3, 16, ["#fff4c2", "#ffd23f", "#ffb02e"]);
      if (!ruhig()) state.zeitlupe = 0.5;
      state.blitz = 0.6;
      kids()?.playJingle?.("correct");
      kids()?.vibrate?.(16);
    } else if (art === "gut") {
      schrift("Gut", "#ffffff", 20, 0.9);
      kids()?.playJingle?.("star");
      kids()?.vibrate?.(10);
    } else {
      schrift(art === "frueh" ? "Zu früh" : "Zu spät", "#ffb347", 20, 1);
      kids()?.vibrate?.(8);
    }
  }

  // Kein Tipp bis SPAET_MAX nach der Kante: Er kippt einfach hinunter.
  function verpasst() {
    const sp = state.sp;
    state.sprung.verpasst = true;
    state.sprung.art = "verpasst";
    sp.k = Math.max(sp.k, 7);
    sp.kw = Math.max(sp.kw, 24);
    if (state.phase !== "spiel") return;
    schrift("Verpasst!", "#ff7a6b", 22, 1.1);
    kids()?.vibrate?.([20, 30]);
  }

  // Was die Luft mit ihm macht: Auftrieb quer zur Flugbahn, Widerstand
  // dagegen. Je näher die Lage am Ideal, desto mehr trägt sie; hinten reisst
  // die Strömung ab. Gegenwind und Aufwind tragen mehr, Rückenwind weniger.
  function luftKraft(x, vx, vy, k, tf, tele, sturz) {
    const sch = state.sch;
    const plan = state.plan[state.nr];
    let fl = 0;
    let fd = 1.6;
    if (!sturz) {
      fl = Math.max(0.1, 1 - 0.75 * (k / 20) ** 2);
      fd = 1 + (k / 18) ** 2;
      if (k < ABRISS) { fl *= 0.45; fd *= 1.5; }
      fl *= 0.35 + 0.65 * glatt(tf / 0.45);
      if (tele) { fl *= 0.4; fd *= 1.3; }
      fl *= 1 + 0.06 * plan.wind + 0.06 * boeBei(x).auf;
    }
    const cl = CL / sch.f;
    const cd = CD / sch.f;
    const v = Math.hypot(vx, vy);
    return { ax: -cd * fd * v * vx - cl * fl * v * vy, ay: -G - cd * fd * v * vy + cl * fl * v * vx };
  }

  // Wie steil die Ski zur Flugbahn stehen: nach dem Absprung flach, im V
  // dann ANSTELL – minus, was er nach vorne lehnt.
  const skiWinkel = (sp) => Math.atan2(sp.vy, sp.vx) + rad(lerp(4, ANSTELL, glatt(sp.tf / 0.45)) - sp.k);

  function flugSchritt(h) {
    const sp = state.sp;
    const sch = state.sch;
    const sprung = state.sprung;
    const plan = state.plan[state.nr];
    sp.tf += h;
    if (!sprung.abgesprungen && !sprung.verpasst && sp.tf > SPAET_MAX) verpasst();
    if (!sp.sturz) {
      // Die Lage: Druck, Böe und Zug drehen ihn, und jede Abweichung wächst
      // von selbst (er liegt nie ruhig).
      const ziel = state.lenkung * R_DREH + boeBei(sp.x).dreh + plan.drift;
      sp.kw += (ziel - sp.kw) * (1 - Math.exp(-h / DREH_TAU));
      sp.k += (sp.kw + unruheBei(state.nr) * sp.k) * h;
      if (sp.k < RUECKLAGE) { sp.k = RUECKLAGE; sp.kw = Math.max(0, sp.kw); }
      if (sp.k >= UEBERSCHLAG) ueberschlag();
      if (sp.k < ABRISS && !sprung.abriss && sprung.tele < 0 && state.phase === "spiel") {
        sprung.abriss = true;
        schrift("Strömungsabriss!", "#8fd3ff", 20, 1.2);
        kids()?.vibrate?.([12, 20, 12]);
      }
    }
    const hp = h * TEMPO;
    const kraft = luftKraft(sp.x, sp.vx, sp.vy, sp.k, sp.tf, sprung.tele >= 0, sp.sturz);
    sp.vx += kraft.ax * hp;
    sp.vy += kraft.ay * hp;
    sp.x += sp.vx * hp;
    sp.y += sp.vy * hp;
    if (sp.sturz) {
      sp.winkel += sp.drehW * h;
    } else {
      let w = skiWinkel(sp);
      // Zur Landung legt er die Ski an den Hang.
      if (sprung.tele >= 0) {
        const f = glatt((state.zeit - sprung.tele) / 0.25) * 0.85;
        w = lerp(w, -hangBei(sch, sp.x + 2).b, f);
      }
      sp.winkel = w;
    }
    const boden = bodenBei(sch, sp.x);
    if (sp.y <= boden.y) landen();
  }

  // Er liegt zu weit vorne: Überschlag. Er dreht sich vornüber und fällt.
  function ueberschlag() {
    const sp = state.sp;
    sp.sturz = true;
    sp.drehW = -7;
    state.grund = "Überschlag";
    if (state.phase !== "spiel") return;
    schrift("Überschlag!", "#ff7a6b", 24, 1.3);
    kids()?.vibrate?.([30, 40, 60]);
  }

  // Bis zum Boden vorausrechnen (ohne Druck): Wann und wo kommt er auf? Für
  // den Ring am Boden und den Autopiloten der Tests.
  function vorausLandung() {
    const sp = state.sp;
    const sch = state.sch;
    if (!sp || !sch || state.schritt !== "flug") return { tau: 9, x: 0, y: 0 };
    let x = sp.x;
    let y = sp.y;
    let vx = sp.vx;
    let vy = sp.vy;
    const h = 1 / 120;
    const tele = state.sprung.tele >= 0;
    for (let t = 0; t < 1.6; t += h) {
      const a = luftKraft(x, vx, vy, sp.k, sp.tf + t, tele, sp.sturz);
      vx += a.ax * h * TEMPO;
      vy += a.ay * h * TEMPO;
      x += vx * h * TEMPO;
      y += vy * h * TEMPO;
      const b = bodenBei(sch, x);
      if (y <= b.y) return { tau: t + h, x, y: b.y };
    }
    return { tau: 9, x, y };
  }

  // Der Telemark: beide Seiten (oder Leertaste) – nur, wenn der Boden nah
  // ist. Er legt die Ski an und richtet sich auf; der Auftrieb geht weg.
  function telemark() {
    const sprung = state.sprung;
    if (state.phase !== "spiel" || state.schritt !== "flug" || !state.anflug || sprung.tele >= 0 || state.sp.sturz) return false;
    sprung.tele = state.zeit;
    state.sp.poseZiel = POSEN.lande;
    state.sp.poseRate = 12;
    kids()?.vibrate?.(8);
    return true;
  }

  /*
   * Er kommt auf. Die Weite ist, wo seine Füsse den Hang berühren. Wie gut
   * die Landung war, sagt die Zeit seit dem Telemark: zu kurz wackelt er,
   * im Fenster ist es ein Telemark (Bonus), lang davor landet er hart.
   * Ohne Telemark, nach einem Überschlag, in tiefer Rücklage oder zu steil
   * auf flachem Hang stürzt er.
   */
  function landen() {
    const sp = state.sp;
    const sch = state.sch;
    const sprung = state.sprung;
    const n = state.nr;
    const boden = hangBei(sch, Math.max(0, sp.x));
    sp.x = Math.max(0, sp.x);
    sp.y = boden.y;
    const weite = Math.round(boden.s);
    const pfad = Math.atan2(-sp.vy, sp.vx);
    const steil = grad(pfad - boden.b);
    let art;
    let bonus = 0;
    let grund = "";
    if (sp.sturz) { art = "sturz"; grund = state.grund || "Überschlag"; }
    else if (sp.k < -34) { art = "sturz"; grund = "Rücklage"; }
    else if (steil > 40) { art = "sturz"; grund = "Zu hart gelandet"; }
    else if (sprung.tele < 0) { art = "sturz"; grund = "Kein Telemark"; }
    else {
      const tau = state.zeit - sprung.tele;
      const oben = Math.max(0.14, teleObenBei(n) - Math.max(0, steil - 22) * 0.012);
      if (tau < TELE_KNAPP) { art = "wackel"; bonus = -abzugBei(n); }
      else if (tau <= oben) { art = "telemark"; bonus = bonusBei(n); }
      else if (tau <= TELE_GUT) { art = "sauber"; }
      else { art = "hart"; bonus = -abzugBei(n); }
      sprung.tau = tau;
    }
    sprung.landung = art;
    sprung.weite = weite;
    sprung.bonus = bonus;
    sprung.quali = weite >= sch.quali;
    sprung.landeZeit = state.zeit;
    const v = Math.hypot(sp.vx, sp.vy);
    sp.v = v * Math.cos(rad(clamp(steil, 0, 80)));
    sp.s = boden.s;
    state.anflug = false;
    state.punkte += Math.max(0, weite + bonus);
    state.sprunge.push(weite);
    shell.setCount(state.punkte);
    state.stoss = art === "sturz" ? 1 : art === "hart" ? 0.7 : 0.35;
    staub(sp.x, sp.y, art === "sturz" ? 34 : 22, art === "sturz" ? 1.4 : 1);
    kids()?.vibrate?.(art === "sturz" ? [30, 40, 60] : art === "telemark" ? [10, 30, 14] : 14);

    const oben = `SPRUNG ${n + 1} · HS ${sch.HS}`;
    const qualiText = sprung.quali ? `Quali ${sch.quali} m ✓` : `Quali ${sch.quali} m – nicht erreicht`;
    const qualiFarbe = sprung.quali ? "#9ff5bd" : "#ffb0a8";
    if (art === "sturz") {
      state.schritt = "sturz";
      state.aus = "sturz";
      state.grund = grund;
      sp.sturz = true;
      sp.drehW = sp.drehW || -5;
      sp.poseZiel = POSEN.sturz;
      sp.poseRate = 10;
      state.weiterIn = 2.1;
      if (!ruhig()) state.zeitlupe = 0.45;
      // Die Ski fliegen davon.
      for (let i = 0; i < 2; i += 1) {
        teil({ art: "ski", x: sp.x, y: sp.y + 0.4, vx: sp.vx * (0.5 + i * 0.25), vy: 5 + i * 3, r: 0, dreh: sp.winkel,
          drehW: (i ? 9 : -7), farbe: i ? FARBEN.skiD : FARBEN.ski, leben: 1.8, max: 1.8 });
      }
      schrift(grund === "Kein Telemark" ? "Sturz – kein Telemark" : `Sturz – ${grund}`, "#ff7a6b", 22, 1.8);
      tvZeigen({ oben, gross: `${weite} m`, rechts: "Sturz", rechtsFarbe: "#ff7a6b", unten: qualiText, untenFarbe: qualiFarbe, farbe: "#ff3b30" }, state.weiterIn);
      kids()?.playJingle?.("retry");
      return;
    }
    state.schritt = "auslauf";
    state.weiterIn = sprung.quali ? 2.5 : 2.4;
    if (!sprung.quali) state.aus = "quali";
    sp.poseZiel = art === "hart" ? POSEN.hart : POSEN.telemark;
    sp.poseRate = 16;
    const rechts = { telemark: `+${bonus} Telemark`, sauber: "Gelandet", hart: `${bonus} hart`, wackel: `${bonus} wackelig` }[art];
    const rechtsFarbe = { telemark: "#ffd23f", sauber: "#ffffff", hart: "#ffb347", wackel: "#ffb347" }[art];
    tvZeigen({ oben, gross: `${weite} m`, rechts, rechtsFarbe, unten: qualiText, untenFarbe: qualiFarbe, farbe: sprung.quali ? "#3dff8c" : "#ff3b30" }, state.weiterIn);
    if (art === "telemark") {
      schrift("Telemark!", "#ffd23f", 24, 1.2);
      funken(sp.x, sp.y + 1.2, 18, ["#fff4c2", "#ffd23f", "#ffffff"]);
      state.jubel = 1;
      kids()?.playJingle?.("unlock");
    } else if (art === "hart") {
      schrift("Hart gelandet", "#ffb347", 20, 1.1);
    } else if (art === "wackel") {
      schrift("Wackelig", "#ffb347", 20, 1.1);
    }
    if (weite >= sch.HS) {
      schrift(`Schanzenrekord? ${weite} m!`, "#ffffff", 18, 1.6, { folgt: false, x: sp.x, y: sp.y + 12 });
      state.jubel = 1;
    } else if (sprung.quali && art !== "telemark") {
      state.jubel = Math.max(state.jubel, 0.5);
    }
    if (!sprung.quali) {
      kids()?.playJingle?.("retry");
    } else if (art !== "telemark") {
      kids()?.playJingle?.("star");
    }
  }

  // Am Boden: Er gleitet den Hang hinunter und bremst im Auslauf.
  function auslaufSchritt(h) {
    const sp = state.sp;
    const sch = state.sch;
    const hp = h * TEMPO;
    const p = hangBeiS(sch, sp.s);
    const bremse = p.b < rad(4) ? (sp.sturz ? 12 : 11) : p.b < rad(20) ? 6 : sp.sturz ? 3 : 0;
    sp.v = Math.max(0, sp.v + (G * Math.sin(p.b) - 0.003 * sp.v * sp.v - bremse) * hp);
    sp.s = Math.min(sch.auslaufS, sp.s + sp.v * hp);
    if (sp.s >= sch.auslaufS) sp.v = 0;
    const q = hangBeiS(sch, sp.s);
    sp.x = q.x;
    sp.y = q.y;
    sp.vx = Math.cos(q.b) * sp.v;
    sp.vy = -Math.sin(q.b) * sp.v;
    if (sp.sturz) {
      sp.drehW *= 1 - 1.8 * h;
      sp.winkel += sp.drehW * h;
    } else {
      sp.winkel = -q.b;
      // Nach dem Telemark richtet er sich auf – nach einem guten Sprung
      // mit den Armen oben.
      if (state.zeit - state.sprung.landeZeit > 0.7) {
        sp.poseZiel = state.sprung.landung === "telemark" ? POSEN.jubel : POSEN.stehen;
        sp.poseRate = 5;
      }
    }
    state.weiterIn -= h;
    if (state.weiterIn <= 0 && state.phase === "spiel") {
      if (state.aus) finish();
      else wechselBeginnen();
    }
  }

  function wechselBeginnen() {
    state.schritt = "wechsel";
    state.blendeZiel = 1;
    // Die nächste Tageszeit schon jetzt malen – hinter der Blende.
    planBis(state.nr + 2);
  }

  function naechsterSprung() {
    schanzeAufbauen(state.nr + 1);
    tagesBilder(tagBei(state.nr));
    state.schritt = "start";
    state.startRest = 1.3;
    state.blendeZiel = 0;
    karteZeigen(state.startRest + 1.4);
    if (state.nr === 4) schrift("Flutlicht an!", "#fff6c8", 20, 1.6, { folgt: false, x: state.sp.x + 6, y: state.sp.y + 6 });
  }

  // Ein Schritt der Rechnung – je nachdem, wo der Sprung steht.
  function schrittTakt(h) {
    switch (state.schritt) {
      case "start":
        state.startRest -= h;
        if (state.startRest <= 0) anlaufen();
        break;
      case "anlauf":
        anlaufSchritt(h);
        break;
      case "flug":
        flugSchritt(h);
        break;
      case "auslauf":
      case "sturz":
        auslaufSchritt(h);
        break;
      case "wechsel":
        if (state.blende >= 0.97) naechsterSprung();
        break;
      default:
        break;
    }
  }

  // Die Haltung, die zum Augenblick gehört.
  function poseWaehlen() {
    const sp = state.sp;
    if (!sp) return;
    if (state.schritt === "flug" && !sp.sturz && state.sprung.tele < 0) {
      if (sp.tf > 0.22 || !state.sprung.abgesprungen) {
        sp.poseZiel = sp.k < ABRISS ? POSEN.abriss : POSEN.flug;
        sp.poseRate = sp.k < ABRISS ? 6 : 5;
      }
    }
    if (state.schritt === "anlauf" && state.sprung.getippt) {
      sp.poseZiel = POSEN.absprung;
      sp.poseRate = 10;
    }
  }

  // ---------------------------------------------------------------------------
  // Der Takt
  // ---------------------------------------------------------------------------
  function takt(dtEcht) {
    let dt = dtEcht;
    state.echt += dtEcht;
    if (state.zeitlupe > 0) {
      state.zeitlupe = Math.max(0, state.zeitlupe - dtEcht);
      dt = dtEcht * 0.35;
    }
    state.zeit += dt;
    if (state.stoss > 0) state.stoss = Math.max(0, state.stoss - dtEcht * 2.5);
    if (state.blitz > 0) state.blitz = Math.max(0, state.blitz - dtEcht * 3);
    if (state.jubel > 0) state.jubel = Math.max(0, state.jubel - dtEcht * 0.4);

    if (state.phase === "zuschauen") {
      zuschauenTakt(dt);
    } else if (state.phase === "spiel") {
      const n = Math.max(1, Math.ceil(dt / TAKT - 1e-9));
      for (let i = 0; i < n && state.phase === "spiel"; i += 1) schrittTakt(dt / n);
      if (state.schritt === "flug" && state.phase === "spiel") {
        const v = vorausLandung();
        state.tauVoraus = v.tau;
        state.anflug = v.tau <= TELE_FENSTER;
        state.landeOrt = state.anflug ? { x: v.x, y: v.y } : null;
        if (state.anflug && state.beide) telemark();
      } else {
        state.anflug = false;
      }
    } else if (state.phase === "bereit" && state.sp) {
      state.sp.poseZiel = POSEN.sitzen;
    }
    const sp = state.sp;
    if (sp) {
      if (state.phase !== "zuschauen") poseWaehlen();
      poseZu(sp.pose, sp.poseZiel, sp.poseRate, dt);
    }
    // Der Bogen erscheint in der Luft und geht bei der Landung.
    const bogenZiel = state.schritt === "flug" && sp && !sp.sturz && state.sprung?.tele < 0 ? 1 : 0;
    state.bogen = clamp((state.bogen || 0) + (bogenZiel ? dt * 5 : -dt * 4), 0, 1);
    state.blende = clamp(state.blende + Math.sign(state.blendeZiel - state.blende) * dtEcht * 3.2, 0, 1);
    if (Math.abs(state.blende - state.blendeZiel) < 0.02) state.blende = state.blendeZiel;
    if (knoepfe) knoepfe.classList.toggle("ist-beide", state.anflug && state.phase === "spiel" && state.sprung?.tele < 0);
    nebenbei(dt);
    if (sp) kameraTakt(dt, sp, state.schritt === "wechsel" ? "auslauf" : state.schritt);
    flockenTakt(dt);

    if (state.phase === "spiel" && sp) {
      gegner?.takt(state.punkte, {
        a: Math.round((state.nr * ABSTAND + sp.x) * 10),
        b: Math.round(sp.y * 10),
        c: Math.round(sp.winkel * 100),
      });
    }
  }

  // Was nebenher geschieht: Teilchen, Schriften, Speed-Linien, Schnee
  // unter den Ski.
  function nebenbei(dt) {
    const sp = state.sp;
    if (state.tv) {
      state.tv.alter += dt;
      if (state.tv.alter > state.tv.dauer) state.tv = null;
    }
    for (let i = state.teile.length - 1; i >= 0; i -= 1) {
      const t = state.teile[i];
      if (t.art === "wolke") { t.vy -= 1.5 * dt; t.vx *= 1 - 1.2 * dt; t.vy *= 1 - 1.2 * dt; }
      else if (t.art === "ski") { t.vy -= G * dt; t.dreh += t.drehW * dt; }
      else { t.vy -= (t.art === "funke" ? 6 : 9) * dt; t.vx *= 1 - 1.5 * dt; }
      t.x += t.vx * dt;
      t.y += t.vy * dt;
      if (t.art === "ski" && state.sch) {
        const b = bodenBei(state.sch, t.x).y;
        if (t.y < b + 0.1) { t.y = b + 0.1; t.vy = Math.abs(t.vy) * 0.3; t.vx *= 0.7; t.drehW *= 0.6; }
      }
      t.leben -= dt;
      if (t.leben <= 0) state.teile.splice(i, 1);
    }
    for (let i = state.schriften.length - 1; i >= 0; i -= 1) {
      state.schriften[i].leben -= dt;
      if (state.schriften[i].leben <= 0) state.schriften.splice(i, 1);
    }
    for (let i = state.striche.length - 1; i >= 0; i -= 1) {
      const s = state.striche[i];
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.leben -= dt;
      if (s.leben <= 0) state.striche.splice(i, 1);
    }
    if (state.ring && state.echt - state.ring.t > 0.6) state.ring = null;
    if (!sp || ruhig()) return;
    const v = Math.hypot(sp.vx, sp.vy);
    // Speed-Linien im Flug, im Bild: Sie ziehen schneller vorbei als der Hang.
    if (state.schritt === "flug" && v > 12 && state.striche.length < STRICHE_MAX && Math.random() < dt * 28) {
      const fs = figurMass();
      const dx = sp.vx / v;
      const dy = -sp.vy / v;
      const tempo = Math.max(500, v * kam.z * 1.6);
      const lang = clamp(v * kam.z * 0.12, 18, 90);
      state.striche.push({
        x: bildX(sp.x) + dx * (60 + Math.random() * 120) + (Math.random() - 0.5) * fs * 6,
        y: bildY(sp.y) + dy * (60 + Math.random() * 120) + (Math.random() - 0.5) * fs * 5,
        vx: -dx * tempo, vy: -dy * tempo, dx: -dx * lang, dy: -dy * lang,
        dick: 1 + Math.random() * 1.5, leben: 0.28, max: 0.28,
      });
    }
    // Pulverschnee im Anlauf und im Auslauf, hinten an den Ski.
    const amBoden = state.schritt === "anlauf" || state.schritt === "auslauf" || state.schritt === "sturz";
    if (amBoden && v > 4 && Math.random() < dt * (state.schritt === "anlauf" ? 30 : 50)) {
      const w = sp.winkel;
      schnee(sp.x - Math.cos(w) * 0.9, sp.y + 0.1, -sp.vx * 0.3, Math.abs(sp.vy) * 0.2 + 1.5, state.schritt === "anlauf" ? 1 : 2);
    }
  }

  function loop(now) {
    frame = window.requestAnimationFrame(loop);
    // Nie rückwärts: Der Zeitstempel eines Bildes kann vor dem letzten
    // Neustart liegen.
    const dt = clamp((now - last) / 1000, 0, 0.05);
    last = now;
    messen();
    takt(dt);
    zeichnen();
  }

  // ---------------------------------------------------------------------------
  // Zuschauen
  // ---------------------------------------------------------------------------
  // Eine aufgezeichnete Runde mit ihrem eigenen Plan: Der Zufall hält die
  // Saat (geist.js, zuschauer), startRun würfelt damit denselben Wind und
  // dieselben Böen, und der Springer steht Bild für Bild dort, wo er damals
  // war. Aus a folgt die Schanze, aus dem Ort die Haltung; wo er aufkommt,
  // zeigt die Anzeige seine Weite.
  function zuschauenStarten() {
    if (!zuschauer?.lauf) return;
    startRun();
    state.phase = "zuschauen";
    shell.setPhase("play");
    zuschauer.los();
  }

  function zuschauenTakt(dt) {
    const s = zuschauer.stand();
    if (!s) return;
    const wx = s.a / 10;
    const nr = Math.max(0, Math.floor((wx + ABSTAND / 2) / ABSTAND));
    if (nr !== state.nr) {
      schanzeAufbauen(nr);
      state.schritt = "start";
      state.blende = 0.8;
      karteZeigen(2.4);
    }
    const sp = state.sp;
    const sch = state.sch;
    // Nie neben die Schanze, auch wenn die Aufzeichnung springt.
    const x = clamp(wx - nr * ABSTAND, anlaufBei(sch, sch.L).x, sch.ende.x);
    const y = clamp(s.b / 10, sch.ende.y - 50, 200);
    sp.x = x;
    sp.y = y;
    sp.vx = (s.va || 0) / 10;
    sp.vy = (s.vb || 0) / 10;
    sp.winkel = (s.c || 0) / 100;
    const boden = bodenBei(sch, x);
    const luft = x > 0.05 && y > boden.y + 0.35;
    const v = Math.hypot(sp.vx, sp.vy);
    // Die Karte vor dem Sprung geht, sobald er fliegt.
    if (state.tv?.karte && (luft || x > 0)) state.tv.dauer = Math.min(state.tv.dauer, state.tv.alter + 0.3);
    if (x <= 0.05 && state.schritt !== "flug" && state.schritt !== "auslauf") {
      state.schritt = v < 0.8 && x < anlaufBei(sch, sch.L * 0.9).x ? "start" : "anlauf";
      sp.poseZiel = state.schritt === "start" ? POSEN.sitzen : POSEN.hocke;
      sp.poseRate = 6;
      sp.tf = 0;
    } else if (luft) {
      state.schritt = "flug";
      sp.tf += dt;
      // Die Lage aus dem Winkel der Ski.
      const anstell = lerp(4, ANSTELL, glatt(sp.tf / 0.45));
      sp.k = clamp(grad(Math.atan2(sp.vy, sp.vx) + rad(anstell) - sp.winkel), -45, 45);
      sp.poseZiel = sp.k < ABRISS ? POSEN.abriss : sp.tf < 0.22 ? POSEN.absprung : POSEN.flug;
      sp.poseRate = 8;
    } else if (x >= 0) {
      if (state.schritt === "flug") {
        // Gelandet: Staub, Stoss, die Weite.
        const weite = Math.round(hangBei(sch, x).s);
        state.sprung.weite = weite;
        state.sprung.landeZeit = state.zeit;
        state.stoss = 0.4;
        staub(x, y, 20);
        const quali = weite >= sch.quali;
        tvZeigen({
          oben: `SPRUNG ${nr + 1} · HS ${sch.HS}`, gross: `${weite} m`, rechts: "",
          unten: quali ? `Quali ${sch.quali} m ✓` : `Quali ${sch.quali} m – nicht erreicht`,
          untenFarbe: quali ? "#9ff5bd" : "#ffb0a8", farbe: quali ? "#3dff8c" : "#ff3b30",
        }, 2.6);
        state.sprung.punkteVor = state.punkte;
      }
      state.schritt = "auslauf";
      // Liegen die Ski quer zum Hang, ist er gestürzt.
      const quer = Math.abs(((sp.winkel + boden.b + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI) > 0.7;
      const seit = state.zeit - state.sprung.landeZeit;
      sp.poseZiel = quer ? POSEN.sturz : seit < 0.7 ? POSEN.telemark : POSEN.stehen;
      sp.poseRate = quer ? 10 : 8;
      if (quer && seit < 1.5) state.sprung.quer = true;
    }
    // Was der Sprung brachte, steht genau in der Aufzeichnung (die Weite aus
    // dem Ort ist auf einen Meter ungenau): Weite und Telemark zusammen.
    const punkte = Math.max(0, Math.floor(s.punkte));
    if (punkte !== state.punkte) {
      const dazu = punkte - (state.sprung.punkteVor ?? state.punkte);
      if (state.tv && state.sprung.weite) {
        state.tv.gross = `${dazu} m`;
        state.tv.rechts = state.sprung.quer ? "Sturz" : "";
        state.tv.rechtsFarbe = "#ff7a6b";
        if (!state.sprung.quer && dazu > state.sprung.weite + 1) state.jubel = 1;
      }
      state.punkte = punkte;
      shell.setCount(punkte);
    }
    if (state.sprung.quer && state.tv && !state.tv.rechts && state.tv.gross !== "") {
      state.tv.rechts = "Sturz";
      state.tv.rechtsFarbe = "#ff7a6b";
    }
    zuschauer.weiter();
  }

  // ---------------------------------------------------------------------------
  // Tippen und Halten
  // ---------------------------------------------------------------------------
  // Die Runde beginnt: mit dem ersten Tipp – oder im Live-Modus zum
  // gemeinsamen Start (game-shell.js, live.los). Der Springer stösst sich
  // sofort vom Balken ab.
  function losGehts() {
    if (state.phase !== "bereit") return;
    state.phase = "spiel";
    shell.setPhase("play");
    gegner?.los();
    anlaufen();
    karteZeigen(1.5);
  }

  // Ein Tipp an der Kante: Absprung. Davor merkt er sich nur, wann – die
  // Kraft kommt an der Kante (anlaufSchritt). Danach, im kurzen Fenster
  // hinter der Kante, springt er gleich.
  function tippen() {
    const sprung = state.sprung;
    if (state.schritt === "anlauf" && !sprung.getippt) {
      // Viel zu früh zählt nicht: Erst im letzten Stück steht er auf.
      if (zeitBisKante() > FRUEH_MAX + 0.25) return;
      sprung.getippt = true;
      sprung.tippZeit = state.zeit;
      return;
    }
    if (state.schritt === "flug" && !sprung.abgesprungen && !sprung.verpasst) {
      abspringen(state.zeit - sprung.kanteZeit);
    }
  }

  // Ein neuer Druck (Finger oder Taste).
  function druck() {
    if (state.phase === "zuschauen" || state.phase === "ende") return;
    if (state.phase === "bereit") {
      if (!shell.live) losGehts();
      return;
    }
    tippen();
  }

  const finger = [];

  function lenkeNeu() {
    const l = finger.some((f) => f.r < 0);
    const r = finger.some((f) => f.r > 0);
    state.beide = l && r;
    state.lenkung = state.beide ? 0 : l ? -1 : r ? 1 : 0;
    knoepfe?.querySelector(".sj-knopf-l")?.classList.toggle("ist-an", l);
    knoepfe?.querySelector(".sj-knopf-r")?.classList.toggle("ist-an", r);
    if (state.beide) telemark();
  }

  function fingerAuf(id, r) {
    const da = finger.findIndex((f) => f.id === id);
    if (da >= 0) finger.splice(da, 1);
    finger.push({ id, r });
    druck();
    lenkeNeu();
  }

  function fingerWeg(id) {
    const da = finger.findIndex((f) => f.id === id);
    if (da < 0) return;
    finger.splice(da, 1);
    lenkeNeu();
  }

  function alleWeg() {
    finger.length = 0;
    lenkeNeu();
  }

  // Leertaste, Pfeil hoch oder runter, Enter: Start, Absprung, Telemark.
  function aktion() {
    const sprung = state.sprung;
    if (state.phase === "spiel" && state.schritt === "flug" && (sprung.abgesprungen || sprung.verpasst)) {
      telemark();
      return;
    }
    druck();
  }

  // Für die Prüfskripte und die Vorführung: lehnen wie mit einem Finger –
  // -1 zurück, 1 vor, 0 loslassen.
  function lenke(r) {
    const vorher = finger.find((f) => f.id === "auto");
    finger.length = 0;
    if (r) finger.push({ id: "auto", r: Math.sign(r) });
    if (r && !vorher) druck();
    lenkeNeu();
  }

  // ---------------------------------------------------------------------------
  // Ablauf
  // ---------------------------------------------------------------------------
  function startRun() {
    stopLoop();
    shell.closeOverlay();
    zufall.neu();
    shell.setPhase("intro");
    state.phase = "bereit";
    state.schritt = "start";
    state.punkte = 0;
    state.plan = [];
    state.sprunge = [];
    state.aus = "";
    state.grund = "";
    state.blende = 0;
    state.blendeZiel = 0;
    state.tv = null;
    state.schriften = [];
    state.jubel = 0;
    state.stoss = 0;
    state.blitz = 0;
    state.zeitlupe = 0;
    state.zeit = 0;
    state.echt = 0;
    state.lenkung = 0;
    state.beide = false;
    planBis(4);
    schanzeAufbauen(0);
    shell.setCount(0);
    gegner?.runde();

    shell.clear();
    promptKnoten = shell.el("p", "cm-prompt sj-prompt", "Kante: tippen · Luft: halten · Landen: beide");
    shell.play.append(promptKnoten, buildPlatz());
    finger.length = 0;
    lenkeNeu();
    view.cssW = 0;
    view.cssH = 0;
    messen();
    karteZeigen(1e9);

    last = performance.now();
    frame = window.requestAnimationFrame(loop);
  }

  function zaehleHoch(ziel) {
    const zahl = host.querySelector(".cm-result-score");
    if (!zahl) return;
    if (ruhig() || ziel <= 1) { zahl.textContent = String(ziel); return; }
    const dauer = Math.min(900, 200 + ziel * 0.6);
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
    kids()?.playJingle?.("win");
    const anzahl = state.sprunge.length;
    const weitester = anzahl ? Math.max(...state.sprunge) : 0;
    const grund = state.aus === "sturz" ? "Sturz" : state.aus === "quali" ? "Quali verpasst" : "";
    const sprunge = anzahl === 1 ? "1 Sprung" : `${anzahl} Sprünge`;
    shell.showResult({
      label: "Deine Meter",
      points: punkte,
      detail: rekord ? "Neuer Rekord!" : [`${sprunge}, weitester ${weitester} m`, grund, vorher ? `Bestwert ${vorher}` : ""].filter(Boolean).join(" · "),
      geist,
    });
    if (rekord) host.querySelector(".cm-result-detail")?.classList.add("sj-rekord");
    zaehleHoch(punkte);
  }

  // ---------------------------------------------------------------------------
  // Start
  // ---------------------------------------------------------------------------
  shell = shellApi.mount({
    host,
    title: "Skispringen",
    area: "geschwindigkeit",
    accent: "#F5A623",
    accentDark: "#b9741a",
    clock: false,
    onRestart: () => (zuschauer ? zuschauenStarten() : startRun()),
    live: { los: losGehts, stopp: () => finish(), zuschauen: (quelle) => { zuschauer = quelle; zuschauenStarten(); } },
  });
  zuschauer = window.LernappGeist?.zuschauer?.({
    host, spiel: "skiJump", fassung: "t1", zufall, einheit: "Meter", nochmal: zuschauenStarten,
  }) || null;
  if (!zuschauer) {
    gegner = window.LernappGeist?.fuer?.({ spiel: "skiJump", host, art: "tempo", alle: true, zufall }) || null;
  }

  startRun();
  zuschauer?.laden.then((da) => { if (da) zuschauenStarten(); });

  // Die linke Hälfte des Bildes lehnt zurück, die rechte nach vorne – jeder
  // Finger für sich (pointerdown je Zeiger). Jeder neue Finger ist auch ein
  // Tipp: Start, Absprung. Liegen Finger auf beiden Seiten, lehnt er nicht –
  // und nah am Boden ist das der Telemark. Nur Knöpfe bleiben Knöpfe.
  host.addEventListener("pointerdown", (event) => {
    if (event.target.closest("button, a, input")) return;
    const rahmen = (feld || host).getBoundingClientRect();
    fingerAuf(event.pointerId, event.clientX < rahmen.left + rahmen.width / 2 ? -1 : 1);
  });
  window.addEventListener("pointerup", (event) => fingerWeg(event.pointerId));
  window.addEventListener("pointercancel", (event) => fingerWeg(event.pointerId));
  // Wer das Fenster verlässt, nimmt auch die Finger vom Bild.
  window.addEventListener("blur", alleWeg);

  // Pfeil links oder A lehnt zurück, Pfeil rechts oder D nach vorne; beide
  // zugleich landen. Leertaste, Pfeil hoch und runter, Enter: Start,
  // Absprung, Telemark. Steht der Fokus auf einem Knopf, gilt die Taste dem
  // Knopf.
  const seiteDerTaste = (event) => {
    if (event.key === "ArrowLeft" || event.code === "KeyA") return -1;
    if (event.key === "ArrowRight" || event.code === "KeyD") return 1;
    return 0;
  };
  const AKTION = new Set([" ", "Enter", "ArrowUp", "ArrowDown"]);
  document.addEventListener("keydown", (event) => {
    const r = seiteDerTaste(event);
    const los = AKTION.has(event.key) || event.code === "KeyW" || event.code === "KeyS";
    if (!r && !los) return;
    if (document.activeElement?.tagName === "BUTTON") return;
    event.preventDefault();
    if (event.repeat) return;
    if (r) fingerAuf(r < 0 ? "taste-l" : "taste-r", r);
    else aktion();
  });
  document.addEventListener("keyup", (event) => {
    const r = seiteDerTaste(event);
    if (r) fingerWeg(r < 0 ? "taste-l" : "taste-r");
  });

  window.addEventListener("resize", messen);
  window.addEventListener("orientationchange", messen);
  window.addEventListener("pagehide", stopLoop);

  // Für die Prüfskripte und die Vorführung. lenke(r) lehnt (-1 zurück, 1
  // vor, 0 los), aktion() ist Leertaste (Start, Absprung, Telemark).
  // zeitBisKante() und vorausLandung() sagen, wann der Moment ist.
  window.LernappSkispringen = {
    TAKT, ABSTAND, HS_LISTE, IDEAL, UEBERSCHLAG, ABRISS, TELE_ZIEL, TELE_FENSTER,
    state, view, kam, takt, zeichnen, weltText, losGehts, lenke, aktion, tippen, telemark,
    zeitBisKante, vorausLandung, planBis, hsBei, qualiBei, perfektBei, gutBei, boeBei, hangBei, bildX, bildY,
  };
})();
