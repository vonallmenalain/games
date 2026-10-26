/*
 * fallschirm.js – Fallschirm.
 * ---------------------------------------------------------------------------
 * Ein Sprung nach dem anderen aus dem Flugzeug, über einem Tal mit See, Fluss,
 * Dorf, Wäldern und Feldern. Jeder Sprung dauert nur ein paar Sekunden, jeder
 * ist schwerer als der vorige, und die Runde endet beim ersten Fehler. Die
 * Punkte der Runde sind die Summe über alle Sprünge.
 *
 * Gesehen wird alles von oben, aus einer Kamera, die mit dem Springer fällt:
 * Der Boden kommt aus der Tiefe herauf – erst ein Flickenteppich aus Feldern,
 * dann Strassen, Dächer und Bäume, zuletzt das Gras. Wolken, Vogelschwärme
 * und Ballone wachsen aus der Tiefe, und man fällt durch sie hindurch.
 *
 * Gesteuert wird mit zwei Hälften und einem Wisch: Wer links aufs Bild hält,
 * gleitet nach links, wer rechts hält, nach rechts (am Rechner ← und →). Ein
 * Wisch nach oben (Leertaste oder ↑) zieht den Schirm – und unter dem Schirm,
 * kurz vor dem Boden, fängt derselbe Wisch die Landung ab. Der Wisch ist eine
 * eigene Bewegung: Halten lenkt, Wischen lenkt nie.
 *
 * Ein Sprung hat drei Teile:
 *   1. Freier Fall. Seitlich lenken: über das Ziel und an Hindernissen vorbei
 *      (Vogelschwarm, Heissluftballon, Gewitterwolke, später andere Springer
 *      am Schirm und Segelflieger). Rot gestrichelt zeigt sich, wo ein
 *      Hindernis sein wird, wenn man seine Höhe erreicht. Wer eines berührt,
 *      gerät ins Trudeln: Die Reserve geht auf, die Runde ist vorbei.
 *   2. Ziehen. Je tiefer, desto mehr Punkte – bis 100 genau an der
 *      Mindesthöhe, und stark wachsend nahe daran (der Höhenmesser zeigt sie
 *      als rotes Feld). Darunter ist es zu spät: Die Reserve öffnet von
 *      selbst, die Runde ist vorbei. Wer gar nicht zieht, ebenso.
 *   3. Schirmflug und Landung. Gegen Wind und Böen über das Ziel halten. Die
 *      Ringe geben 50, 25 oder 10 Punkte, daneben im Gras nichts – im Wasser,
 *      in einem Baum oder auf einem Dach ist die Runde vorbei. Kurz vor dem
 *      Boden zieht sich ein Ring um den Schirm zusammen: Wer abfängt, wenn er
 *      den Schirm erreicht, setzt butterweich auf (+25) oder weich (+10); zu
 *      früh oder gar nicht abgefangen ist die Landung hart (−10).
 *
 * Schwerer wird es mit jedem Sprung: Der Fall wird schneller, die Zeit für
 * das Ziehen knapper, unter dem Schirm bleibt weniger Höhe, die Ringe werden
 * kleiner und rücken an Wasser, Wald und Dächer. Später schwimmt das Ziel
 * als Floss auf dem See oder fährt als Boot den Fluss hinunter. Es kommen
 * mehr Hindernisse, mehr Wind, Böen, und nach dem Abendrot springt man in die
 * Nacht. Oben bläst der Wind stärker als unten: Wer hoch zieht, treibt ab.
 *
 * Das Tal ist immer dasselbe – ein fester Plan, gemalt in Kacheln, die je
 * nach Höhe in einer gröberen oder feineren Auflösung entstehen und weich
 * ineinander überblenden. Was ein Sprung verlangt (wo das Ziel liegt, wo der
 * Absprung ist, Wind, Böen, Hindernisse, Wolken), würfelt der Zufall
 * (zufall.js) in festen Blöcken je Sprung: ohne Turnier jedes Mal anders, im
 * Turnier für alle im selben Versuch dasselbe.
 *
 * Die Gegner (geist.js) springen als halb durchsichtige Springer mit – so,
 * wie sie in ihrer besten Runde gesprungen sind: a ist die Lage quer zum
 * Ziel in Dezimetern, b die Höhe in Dezimetern, c sagt Sprung, Teil und
 * Winkel (Sprung × 10000 + Teil × 1000 + Winkel × 100 + 500). Und die besten
 * Läufe lassen sich anschauen (?zuschauen=): mit derselben Saat, also an
 * denselben Orten, mit denselben Hindernissen.
 *
 * Gerechnet wird in Metern: x nach Osten (im Bild nach rechts), y nach Süden
 * (im Bild nach unten), z die Höhe über dem Boden. Der Springer bleibt in der
 * Reihe seines Ziels (y); gelenkt wird nur in x.
 */
(() => {
  "use strict";

  if (document.body.dataset.page !== "skydive") return;

  const host = document.querySelector("#fs-stage");
  const shellApi = window.LernappGameShell;
  const cloudApi = window.LernappGameCloud;
  if (!host || !shellApi) return;

  const kids = () => window.LernappKids || null;
  const ruhig = () => Boolean(kids()?.prefersReducedMotion?.());

  // Der Zufall. Nur der Plan der Sprünge zieht daraus – Staub, Funken,
  // Spritzer und das Flattern der Vögel nehmen Math.random oder feste
  // Zahlen, damit der Plan nicht davon abhängt, wie jemand springt.
  const zufall = window.LernappZufall?.fuer?.("skyDive") || {
    neu() {},
    zahl: () => Math.random(),
  };

  // ---------------------------------------------------------------------------
  // Der Sprung
  // ---------------------------------------------------------------------------
  const TAKT = 1 / 240;            // gerechnet wird in festen kleinen Schritten
  const H_AB = 900;                // Absprunghöhe (m)
  const G_FALL = 100;              // so heftig beschleunigt der Fall nach dem Absprung (m/s²)
  const V_QUER_FREI = 18;          // so schnell gleitet er im freien Fall zur Seite (m/s)
  const TAU_QUER_FREI = 0.28;      // … und so träge folgt er dem Lenken (s)
  const WIND_FREI = 0.25;          // so viel vom Wind vertreibt ihn im freien Fall
  const V_SINK = 12;               // so schnell sinkt der Schirm nahe am Boden (m/s)
  const SINK_AB = 60;              // darüber sinkt er schneller …
  const SINK_DAZU = 0.25;          // … je Meter um so viel (m/s)
  const V_QUER = 7;                // so schnell gleitet der Schirm zur Seite (m/s)
  const TAU_QUER = 0.45;
  const T_AUF = 0.8;               // so lange öffnet sich der Schirm (s)
  const TAU_AUF = 0.18;            // … und so schnell bremst er den Fall
  const V_RESERVE = 6.5;           // die Reserve: rund, klein, langsam, nicht lenkbar
  const FLARE_TAU = 0.3;           // Abfangen: so schnell bremst der Schirm …
  const FLARE_HALT = 1.4;          // … so lange trägt er …
  const V_FLARE = 1.6;             // … bis auf dieses Sinken (m/s) …
  const STALL_TAU = 0.35;          // … dann sackt er durch
  const WEICH = 3.2;               // langsamer aufgesetzt als das: butterweich
  const HART = 6.5;                // schneller als das: hart
  const R_FREI = 0.8;              // so breit trifft der Springer im Fall (halb, m)
  const R_SCHIRM = 3.4;            // … und am Schirm
  const ZUG_MAX = 100;             // Punkte für das Ziehen genau an der Mindesthöhe
  const T_INTRO = 1.5;             // so lange fliegt das Flugzeug vor jedem weiteren Sprung (s)
  const T_GELANDET = 1.9;          // so lange steht er nach einer Landung (s)
  const T_FEHLER = 1.5;            // so lange nach einem Fehler bis zur Tafel (s)
  const WARN_T = 2.4;              // so lange vorher zeigt sich, wo ein Hindernis sein wird (s)

  // Die Kamera schaut senkrecht hinunter, ein Stück hinter dem Springer.
  // SICHT_X und SICHT_H: so viel Welt steht im freien Fall in der Ebene des
  // Springers mindestens im Bild – auf jeder Form gleich viel.
  const D_FREI = 14;               // so hoch über dem Springer im freien Fall (m)
  const D_SCHIRM = 32;             // … unter dem Schirm
  const D_FLUGZEUG = 34;           // … im Flugzeug
  const SICHT_X = 7.5;
  const SICHT_H = 14;
  // Die Kamera steht ein Stück südlich: Der Springer ist im oberen Teil des
  // Bildes, der Boden unter ihm kommt von weiter unten auf ihn zu, und der
  // Schirm steht über ihm.
  const VP = 0.66;                 // dort im Bild liegt der Punkt senkrecht unter der Kamera
  const FIGUR_FREI = 0.36;         // dort steht der Springer im freien Fall
  const FIGUR_SCHIRM = 0.42;       // … und unter dem Schirm

  // Wie viel vom Schweren schon da ist: 0 beim ersten Sprung, gegen 1 ab
  // dem zwölften. Daran hängt alles, was schwerer wird – und hört dort auf,
  // wo es gerade noch zu schaffen ist.
  const anteil = (n) => 1 - Math.exp(-(n - 1) / 6);
  const vFallBei = (n) => 150 + 70 * anteil(n);
  // So viel Höhe bleibt unter dem offenen Schirm, wer genau an der
  // Mindesthöhe zieht – erst 55 m, später nur noch gut 33 m.
  const hRestBei = (n) => 55 - 22 * anteil(n);
  const verlust = (v) => V_SINK * T_AUF + (v - V_SINK) * TAU_AUF * (1 - Math.exp(-T_AUF / TAU_AUF));
  const hMinBei = (n) => Math.round((hRestBei(n) + verlust(vFallBei(n))) / 5) * 5;
  // So viel über der Mindesthöhe kostet gut einen Drittel der Punkte: erst
  // eine Drittelsekunde Fall, später eine Fünftelsekunde.
  const tauZugBei = (n) => (0.3 - 0.1 * anteil(n)) * vFallBei(n);
  const r10Bei = (n) => 15 - 8 * anteil(n);
  // Der Wind in der Höhe z, aus dem Wind am Boden: oben stärker.
  const windHoehe = (w, z) => w * (1 + Math.max(0, z) / 120);
  const sinkBei = (z) => V_SINK + Math.max(0, z - SINK_AB) * SINK_DAZU;
  // Wie lange der freie Fall bis zur Höhe z dauert – ohne Lenken für alle
  // gleich. Gerechnet mit denselben Schritten wie im Spiel, vom Absprung mit
  // V_ABSPRUNG an: Eine Formel läge um ein paar Hundertstel daneben, und ein
  // Segler mit 30 m/s wäre dann schon anderthalb Meter weiter.
  const V_ABSPRUNG = 4;
  const fallTabellen = new Map();
  function fallTabelle(n) {
    const v = vFallBei(n);
    let zs = fallTabellen.get(v);
    if (zs) return zs;
    zs = [H_AB];
    let z = H_AB;
    let vz = V_ABSPRUNG;
    while (z > -60) {
      vz += G_FALL * (1 - (vz / v) ** 2) * TAKT;
      z -= vz * TAKT;
      zs.push(z);
    }
    fallTabellen.set(v, zs);
    return zs;
  }
  const tFall = (n, z) => {
    const zs = fallTabelle(n);
    if (z >= H_AB) return 0;
    let lo = 0;
    let hi = zs.length - 1;
    while (hi - lo > 1) {
      const m = (lo + hi) >> 1;
      if (zs[m] > z) lo = m; else hi = m;
    }
    return (lo + (zs[lo] - z) / ((zs[lo] - zs[hi]) || 1)) * TAKT;
  };
  // Und umgekehrt: in welcher Höhe er nach t Sekunden Fall ist.
  const fallZ = (n, t) => {
    const zs = fallTabelle(n);
    const k = Math.max(0, t / TAKT);
    const i = Math.floor(k);
    return i >= zs.length - 1 ? zs[zs.length - 1] : lerp(zs[i], zs[i + 1], k - i);
  };

  const TOP_COUNT = 5;
  const store = cloudApi
    ? cloudApi.register({ key: "lernapp.fallschirm", empty: { runs: 0, scores: [] }, merge: cloudApi.mergeScores(TOP_COUNT) })
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
  const runde = (x, n = 1) => Math.round(x * 10 ** n) / 10 ** n;

  // Immer dieselbe Zahl zu derselben Eingabe: Bäume, Häuser, Wellen und
  // Fenster stehen bei jedem Bild am selben Platz, ohne den Zufall
  // anzufassen.
  function hash01(n) {
    const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return x - Math.floor(x);
  }
  function hash2(i, j, s = 0) {
    let h = (Math.imul(i | 0, 374761393) + Math.imul(j | 0, 668265263) + Math.imul(s | 0, 1013904223)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  }
  // Weiches Rauschen zwischen 0 und 1.
  function rauschen(x, y, s = 0) {
    const i = Math.floor(x);
    const j = Math.floor(y);
    const fx = glatt(x - i);
    const fy = glatt(y - j);
    return lerp(lerp(hash2(i, j, s), hash2(i + 1, j, s), fx), lerp(hash2(i, j + 1, s), hash2(i + 1, j + 1, s), fx), fy);
  }

  // Formen als flache Listen [x0, y0, x1, y1, …].
  function rahmen(pts) {
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    for (let k = 0; k < pts.length; k += 2) {
      x0 = Math.min(x0, pts[k]);
      x1 = Math.max(x1, pts[k]);
      y0 = Math.min(y0, pts[k + 1]);
      y1 = Math.max(y1, pts[k + 1]);
    }
    return [x0, y0, x1, y1];
  }

  function imPoly(pts, x, y) {
    let drin = false;
    const n = pts.length;
    for (let i = 0, j = n - 2; i < n; j = i, i += 2) {
      const xi = pts[i];
      const yi = pts[i + 1];
      const xj = pts[j];
      const yj = pts[j + 1];
      if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) drin = !drin;
    }
    return drin;
  }

  function abstandStrecke(px, py, ax, ay, bx, by) {
    const dx = bx - ax;
    const dy = by - ay;
    const l2 = dx * dx + dy * dy || 1;
    const u = clamp(((px - ax) * dx + (py - ay) * dy) / l2, 0, 1);
    return Math.hypot(px - ax - dx * u, py - ay - dy * u);
  }

  function abstandLinie(pts, x, y) {
    let d = Infinity;
    for (let k = 0; k + 3 < pts.length; k += 2) d = Math.min(d, abstandStrecke(x, y, pts[k], pts[k + 1], pts[k + 2], pts[k + 3]));
    return d;
  }

  // Eine Form wie ein Klecks: eine Ellipse mit welligem Rand.
  function klecks(cx, cy, rx, ry, dreh, rauh, saat, n = 120) {
    const pts = [];
    const c = Math.cos(dreh);
    const s = Math.sin(dreh);
    for (let k = 0; k < n; k += 1) {
      const a = (k / n) * Math.PI * 2;
      const f = 1 + rauh * (0.5 * Math.sin(3 * a + saat) + 0.3 * Math.sin(5 * a + saat * 1.7) + 0.2 * Math.sin(9 * a + saat * 2.3))
        + rauh * 0.6 * (rauschen(Math.cos(a) * 2.5 + saat * 3, Math.sin(a) * 2.5, 7) - 0.5);
      const lx = Math.cos(a) * rx * f;
      const ly = Math.sin(a) * ry * f;
      pts.push(cx + lx * c - ly * s, cy + lx * s + ly * c);
    }
    return pts;
  }

  // Eine Linie weicher machen (Chaikin): gerade Stücke bleiben gerade.
  function weich(pts, mal = 2) {
    let p = pts;
    for (let m = 0; m < mal; m += 1) {
      const q = [p[0], p[1]];
      for (let k = 0; k + 3 < p.length; k += 2) {
        const [ax, ay, bx, by] = [p[k], p[k + 1], p[k + 2], p[k + 3]];
        q.push(ax * 0.75 + bx * 0.25, ay * 0.75 + by * 0.25, ax * 0.25 + bx * 0.75, ay * 0.25 + by * 0.75);
      }
      q.push(p[p.length - 2], p[p.length - 1]);
      p = q;
    }
    return p;
  }

  // ---------------------------------------------------------------------------
  // Das Tal
  // ---------------------------------------------------------------------------
  /*
   * Ein fester Plan, für alle und immer derselbe: der See im Nordwesten mit
   * drei Inseln, der Fluss, der aus ihm nach Osten fliesst, das Dorf mit dem
   * Platz in der Mitte, der Flugplatz im Süden, Wälder mit Lichtungen,
   * dazwischen Felder, Höfe mit Obstgärten, Strassen und Alleen. Gespeichert
   * sind die groben Dinge (Formen, Häuser, einzelne Bäume); die vielen Bäume
   * in Wäldern und Obstgärten entstehen an festen Rasterpunkten, erst wenn
   * eine Kachel sie braucht. Ein Raster (RASTER) sagt schnell, was wo liegt.
   */
  const RASTER = 250;
  const FELD = 150;                // so gross ist ein Feld, ungefähr
  const FELD_N = 24;               // so viele Felder je Richtung von der Mitte (±3600 m)
  const OBST = 9;                  // so weit stehen die Bäume im Obstgarten auseinander
  const WALD_G = 4.6;              // … und im Wald
  const DORF = { x: 650, y: 150, r: 440 };
  const PLATZ = { x: 650, y: 130, halb: 21 };

  const WELT = {
    zaehler: 0,
    see: null,
    inseln: [],
    fluss: null,
    strassen: [],
    bruecken: [],
    waelder: [],
    lichtungen: [],
    felder: [],
    haeuser: [],
    baeume: [],
    lampen: [],
    siedlung: null,
    flugplatz: null,
    orte: { wiese: [], acker: [], strand: [], insel: [], lichtung: [], dorf: [], floss: [], boot: [] },
  };
  const index = new Map();
  let abfrage = 0;

  const zellKey = (ci, cj) => (ci + 512) * 1024 + (cj + 512);

  function eintragen(art, f) {
    WELT.zaehler += 1;
    f.nr = WELT.zaehler;
    f.q = 0;
    const [x0, y0, x1, y1] = f.bb;
    for (let ci = Math.floor(x0 / RASTER); ci <= Math.floor(x1 / RASTER); ci += 1) {
      for (let cj = Math.floor(y0 / RASTER); cj <= Math.floor(y1 / RASTER); cj += 1) {
        const key = zellKey(ci, cj);
        let zelle = index.get(key);
        if (!zelle) { zelle = {}; index.set(key, zelle); }
        (zelle[art] || (zelle[art] = [])).push(f);
      }
    }
    return f;
  }

  // Was von einer Art im Rechteck liegt – in der Reihenfolge, in der es
  // entstand (so überdecken sich die Dinge immer gleich).
  function finde(art, x0, y0, x1, y1) {
    abfrage += 1;
    const raus = [];
    for (let ci = Math.floor(x0 / RASTER); ci <= Math.floor(x1 / RASTER); ci += 1) {
      for (let cj = Math.floor(y0 / RASTER); cj <= Math.floor(y1 / RASTER); cj += 1) {
        const liste = index.get(zellKey(ci, cj))?.[art];
        if (!liste) continue;
        for (const f of liste) {
          if (f.q === abfrage) continue;
          f.q = abfrage;
          const b = f.bb;
          if (b[0] > x1 || b[2] < x0 || b[1] > y1 || b[3] < y0) continue;
          raus.push(f);
        }
      }
    }
    if (raus.length > 1) raus.sort((a, b) => a.nr - b.nr);
    return raus;
  }

  // Die Felder: ein verschobenes Raster, jedes Feld ein Viereck mit einem
  // schmalen Rain ringsum. Was wächst, sagt eine feste Zahl je Feld.
  const FELDARTEN = [
    { art: "wiese", farben: ["#86c35e", "#7fbd58", "#8fca66"], furche: null, gewicht: 0.27 },
    { art: "weizen", farben: ["#e3c56b", "#dbbb5e", "#e9cf7d"], furche: "#c7a54d", gewicht: 0.17 },
    { art: "gruen", farben: ["#a4d063", "#9bca5b"], furche: "#87b84c", gewicht: 0.14 },
    { art: "acker", farben: ["#a98460", "#9c7754", "#b28d66"], furche: "#87643f", gewicht: 0.13 },
    { art: "raps", farben: ["#efd93f", "#e6cf36"], furche: "#d1ba2b", gewicht: 0.05 },
    { art: "mais", farben: ["#62a046", "#6caa4f"], furche: "#4f873a", gewicht: 0.1 },
    { art: "obst", farben: ["#90c76c", "#88c165"], furche: null, gewicht: 0.09 },
    { art: "heu", farben: ["#c9d77c", "#bfcf72"], furche: "#a9b95c", gewicht: 0.05 },
  ];
  function feldArt(u) {
    let summe = 0;
    for (const a of FELDARTEN) {
      summe += a.gewicht;
      if (u < summe) return a;
    }
    return FELDARTEN[0];
  }
  const feldEcke = (i, j) => [i * FELD + (hash2(i, j, 21) - 0.5) * 66, j * FELD + (hash2(i, j, 22) - 0.5) * 66];

  // Die Orte, an denen Ziele liegen können (ohne die beweglichen): Dort
  // gibt es keinen Obstgarten und keinen Hof daneben.
  const FESTE_ORTE = [
    { art: "wiese", x: -760, y: 600 }, { art: "wiese", x: -420, y: 600 }, { art: "wiese", x: -980, y: 560 },
    { art: "acker", x: -2180, y: 620 }, { art: "acker", x: 1450, y: 700 }, { art: "acker", x: -260, y: 1560 }, { art: "acker", x: 2350, y: -1000 },
    { art: "dorf", x: PLATZ.x, y: PLATZ.y },
  ];

  function baueWelt() {
    // Der See und seine Inseln.
    const see = klecks(-1050, -850, 800, 430, 0.12, 0.11, 2.1, 180);
    WELT.see = eintragen("see", { pts: see, bb: rahmen(see) });
    [[-1250, -880, 30], [-780, -760, 24], [-1500, -985, 38]].forEach(([x, y, r], k) => {
      const pts = klecks(x, y, r, r * 0.86, k * 1.3, 0.1, 4 + k, 48);
      const insel = { x, y, r, pts, bb: rahmen(pts), baeume: [] };
      // Bäume am Rand – nördlich und südlich, nie in der Reihe des Ziels.
      [-2.3, -1.75, -1.2, -0.75, 0.85, 1.3, 1.85, 2.35].forEach((a, m) => {
        if (hash2(k, m, 31) < 0.25) return;
        insel.baeume.push({ x: x + Math.cos(a) * r * 0.62, y: y + Math.sin(a) * r * 0.6, r: 3 + hash2(k, m, 32) * 1.6 });
      });
      WELT.inseln.push(eintragen("insel", insel));
      WELT.orte.insel.push({ art: "insel", x, y });
    });

    // Der Fluss: aus dem See nach Osten, ein gerades Stück für die Boote.
    const fluss = weich([-430, -640, -200, -560, 60, -470, 300, -432, 600, -430, 900, -430, 1150, -385, 1400, -250,
      1600, -20, 1750, 250, 1900, 600, 2200, 950, 2700, 1200, 3600, 1500, 5200, 1950], 3);
    WELT.fluss = eintragen("fluss", { pts: fluss, breite: 24, bb: rahmen(fluss).map((v, i) => v + (i < 2 ? -20 : 20)) });

    // Die Strassen.
    [
      { art: "haupt", breite: 7, pts: [-5200, 300, -2600, 262, -1600, 236, -900, 268, -400, 236, 100, 214, 650, 205, 1200, 240, 2000, 330, 3000, 380, 5200, 430] },
      { art: "haupt", breite: 6, pts: [-3000, -620, -2300, -470, -1900, -390, -1400, -330, -1000, -318, -600, -350, -300, -430, -170, -150, 100, 214] },
      { art: "haupt", breite: 6, pts: [600, -2600, 700, -1500, 860, -800, 1010, -425, 900, -170, 650, -40, 650, 90, 650, 205, 600, 600, 430, 950, 300, 1600, 250, 2600] },
      { art: "weg", breite: 4, pts: [-560, 236, -560, 650] },
      { art: "weg", breite: 4, pts: [-2050, 255, -2120, 900, -2300, 1500] },
      { art: "weg", breite: 4, pts: [1250, 240, 1330, 900, 1500, 1500] },
      { art: "weg", breite: 4, pts: [-1300, 240, -1250, -320] },
      { art: "weg", breite: 4, pts: [2000, 330, 2150, -300, 2350, -1400] },
      { art: "weg", breite: 3.5, pts: [420, 205, 380, 20, 300, -120] },
      { art: "weg", breite: 3.5, pts: [880, 205, 960, 430, 1000, 700] },
      { art: "weg", breite: 3.5, pts: [500, 205, 520, 400] },
      { art: "weg", breite: 4, pts: [-2600, -350, -2900, 600, -2700, 1400] },
    ].forEach((s) => {
      const pts = weich(s.pts, 2);
      WELT.strassen.push(eintragen("strasse", { ...s, pts, bb: rahmen(pts).map((v, i) => v + (i < 2 ? -6 : 6)) }));
    });

    // Brücken: wo eine Strasse den Fluss kreuzt.
    for (const s of WELT.strassen) {
      for (let k = 0; k + 3 < s.pts.length; k += 2) {
        const ax = s.pts[k];
        const ay = s.pts[k + 1];
        const bx = s.pts[k + 2];
        const by = s.pts[k + 3];
        const fp = WELT.fluss.pts;
        for (let m = 0; m + 3 < fp.length; m += 2) {
          const t = schnitt(ax, ay, bx, by, fp[m], fp[m + 1], fp[m + 2], fp[m + 3]);
          if (!t) continue;
          const winkel = Math.atan2(by - ay, bx - ax);
          WELT.bruecken.push(eintragen("bruecke", { x: t.x, y: t.y, winkel, lang: 40, breit: s.breite + 3, bb: [t.x - 24, t.y - 24, t.x + 24, t.y + 24] }));
        }
      }
    }

    // Wälder: ein paar grosse, von Hand gesetzt, dazu viele kleine aus
    // festen Zahlen – nicht im See, nicht im Dorf, nicht auf dem Flugplatz.
    const waelder = [
      [1500, -1100, 650, 420, 0.3], [-1500, 1000, 520, 330, -0.2], [450, 1180, 380, 230, 0.1], [2250, -250, 300, 430, 0.2],
      [-850, -1720, 900, 260, 0.05], [-2650, -150, 380, 560, 0.4], [2650, 1650, 520, 380, 0], [-150, 2350, 720, 300, 0.2],
      [-2400, 1850, 500, 420, 0.5], [3000, -1600, 600, 500, 0.1], [-3100, -1700, 560, 520, 0.3], [1100, 2400, 500, 330, 0.6],
    ];
    for (let ci = -7; ci <= 7; ci += 1) {
      for (let cj = -7; cj <= 7; cj += 1) {
        const x = ci * 500 + (hash2(ci, cj, 41) - 0.5) * 300;
        const y = cj * 500 + (hash2(ci, cj, 42) - 0.5) * 300;
        const aussen = Math.abs(x) > 2600 || Math.abs(y) > 2400;
        if (hash2(ci, cj, 43) > (aussen ? 0.55 : 0.32)) continue;
        const r = aussen ? 160 + hash2(ci, cj, 44) * 260 : 50 + hash2(ci, cj, 44) * 120;
        if (imPoly(see, x, y) || Math.hypot(x - DORF.x, y - DORF.y) < DORF.r + r + 40) continue;
        if (x > -1150 && x < 0 && y > 380 && y < 820) continue;   // Flugplatz
        if (abstandLinie(WELT.fluss.pts, x, y) < r + 40) continue;
        if (FESTE_ORTE.some((o) => Math.hypot(o.x - x, o.y - y) < r + 160)) continue;
        if (WELT.strassen.some((s) => s.art === "haupt" && abstandLinie(s.pts, x, y) < r * 0.7)) continue;
        waelder.push([x, y, r, r * (0.6 + hash2(ci, cj, 45) * 0.5), hash2(ci, cj, 46) * 3]);
      }
    }
    waelder.forEach(([x, y, rx, ry, dreh], k) => {
      const pts = klecks(x, y, rx, ry, dreh, 0.16, 10 + k * 1.7, rx > 300 ? 160 : 72);
      WELT.waelder.push(eintragen("wald", { pts, bb: rahmen(pts) }));
    });
    [[1350, -1050, 26], [1700, -1240, 30], [-1450, 980, 25], [420, 1170, 23]].forEach(([x, y, r]) => {
      WELT.lichtungen.push(eintragen("lichtung", { x, y, r, bb: [x - r - 4, y - r - 4, x + r + 4, y + r + 4] }));
      WELT.orte.lichtung.push({ art: "lichtung", x, y });
    });

    // Das Dorf: ein Grund aus Gärten, der Platz, Häuser um den Platz, an den
    // Strassen und eine Kirche.
    const siedlung = klecks(DORF.x, DORF.y, DORF.r, DORF.r * 0.78, 0.2, 0.14, 5.5, 90);
    WELT.siedlung = eintragen("siedlung", { pts: siedlung, bb: rahmen(siedlung) });
    const P = PLATZ;
    const haus = (x, y, w, h, winkel, art = 0) => {
      const c = Math.cos(winkel);
      const s = Math.sin(winkel);
      const ecken = [];
      [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([u, v]) => ecken.push(x + (u * w / 2) * c - (v * h / 2) * s, y + (u * w / 2) * s + (v * h / 2) * c));
      const nr = WELT.haeuser.length;
      return eintragen("haus", {
        x, y, w, h, winkel, ecken, bb: rahmen(ecken).map((v, i) => v + (i < 2 ? -3 : 3)),
        dach: art === 1 ? 4 : art === 2 ? 5 : Math.floor(hash2(nr, 7, 51) * 4),
        art, licht: hash2(nr, 7, 52) < 0.6, hoehe: art === 1 ? 9 : 6 + hash2(nr, 7, 53) * 3,
      });
    };
    const passt = (x, y, w, h) => {
      const r = Math.hypot(w, h) / 2;
      if (WELT.haeuser.some((q) => Math.hypot(q.x - x, q.y - y) < (r + Math.hypot(q.w, q.h) / 2) * 0.82)) return false;
      if (WELT.strassen.some((s) => abstandLinie(s.pts, x, y) < s.breite / 2 + Math.min(w, h) / 2 + 1.5)) return false;
      if (abstandLinie(WELT.fluss.pts, x, y) < 26 + r) return false;
      if (Math.abs(x - P.x) < P.halb + 4 + r && Math.abs(y - P.y) < P.halb + 4 + r) return false;
      return true;
    };
    const setze = (x, y, w, h, winkel, art) => { if (passt(x, y, w, h)) WELT.haeuser.push(haus(x, y, w, h, winkel, art)); };
    // Um den Platz: in der Reihe des Platzes Dächer links und rechts.
    [-24, 0, 24].forEach((dy) => {
      WELT.haeuser.push(haus(P.x - P.halb - 10, P.y + dy, 11, 21, 0));
      WELT.haeuser.push(haus(P.x + P.halb + 10, P.y + dy, 11, 21, 0));
    });
    [-1, 1].forEach((seite) => {
      WELT.haeuser.push(haus(P.x + seite * 19, P.y - P.halb - 10, 14, 11, 0));
      WELT.haeuser.push(haus(P.x + seite * 19, P.y + P.halb + 10, 14, 11, 0));
    });
    WELT.haeuser.push(haus(P.x + 62, P.y - 66, 30, 13, 0.05, 1));     // die Kirche …
    WELT.haeuser.push(haus(P.x + 42, P.y - 66, 8, 8, 0.05, 2));       // … und ihr Turm
    for (const s of WELT.strassen) {
      let weg = 0;
      for (let k = 0; k + 3 < s.pts.length; k += 2) {
        const ax = s.pts[k];
        const ay = s.pts[k + 1];
        const bx = s.pts[k + 2];
        const by = s.pts[k + 3];
        const l = Math.hypot(bx - ax, by - ay);
        const winkel = Math.atan2(by - ay, bx - ax);
        const nx = -Math.sin(winkel);
        const ny = Math.cos(winkel);
        for (let u = 0; u < l; u += 2) {
          weg += 2;
          const x = ax + (bx - ax) * (u / l);
          const y = ay + (by - ay) * (u / l);
          const d = Math.hypot(x - DORF.x, y - DORF.y);
          if (d > DORF.r || weg % 20 !== 0) continue;
          [-1, 1].forEach((seite) => {
            const h = hash2(Math.round(x), Math.round(y), 55 + seite);
            if (h > 1.05 - d / DORF.r * 0.75) return;
            const tief = 9 + hash2(Math.round(x), Math.round(y), 57) * 4;
            const lang = 10 + hash2(Math.round(x), Math.round(y), 58) * 6;
            const ab = s.breite / 2 + 3.5 + tief / 2;
            setze(x + nx * seite * ab, y + ny * seite * ab, lang, tief, winkel, 0);
          });
        }
      }
    }
    WELT.orte.dorf.push({ art: "dorf", x: P.x, y: P.y });

    // Der Flugplatz: eine Graspiste, ein Hangar, die Wiese zum Landen.
    WELT.flugplatz = eintragen("flugplatz", { x0: -1050, x1: -100, y0: 470, y1: 760, piste: [-1000, -150, 700, 15], bb: [-1060, 460, -90, 770] });
    WELT.haeuser.push(haus(-600, 660, 40, 22, 0, 3));
    FESTE_ORTE.filter((o) => o.art === "wiese" || o.art === "acker").forEach((o) => WELT.orte[o.art].push({ art: o.art, x: o.x, y: o.y }));

    // Die Felder.
    for (let i = -FELD_N; i < FELD_N; i += 1) {
      for (let j = -FELD_N; j < FELD_N; j += 1) {
        const ecken = [feldEcke(i, j), feldEcke(i + 1, j), feldEcke(i + 1, j + 1), feldEcke(i, j + 1)];
        const mx = ecken.reduce((s, e) => s + e[0], 0) / 4;
        const my = ecken.reduce((s, e) => s + e[1], 0) / 4;
        const pts = [];
        ecken.forEach(([x, y]) => {
          const d = Math.hypot(x - mx, y - my) || 1;
          pts.push(x + ((mx - x) / d) * 1.8, y + ((my - y) / d) * 1.8);
        });
        let a = feldArt(hash2(i, j, 23));
        // Ein Obstgarten nur im offenen Land: nicht nahe an einem Ziel, nicht
        // unter dem See, einem Wald, dem Dorf oder dem Flugplatz.
        if (a.art === "obst" && (FESTE_ORTE.some((o) => Math.hypot(o.x - mx, o.y - my) < 260)
          || ecken.some(([x, y]) => imPoly(see, x, y) || imPoly(siedlung, x, y) || (x > -1120 && x < -30 && y > 400 && y < 830)
            || finde("wald", x, y, x, y).some((w) => imPoly(w.pts, x, y)) || WELT.lichtungen.some((l) => Math.hypot(l.x - x, l.y - y) < 200)))) a = FELDARTEN[0];
        const kante = hash2(i, j, 25) < 0.5 ? 0 : 1;
        const winkel = Math.atan2(ecken[kante + 1][1] - ecken[kante][1], ecken[kante + 1][0] - ecken[kante][0]);
        WELT.felder.push(eintragen("feld", {
          pts, bb: rahmen(pts), i, j, art: a.art, furche: a.furche, winkel,
          farbe: a.farben[Math.floor(hash2(i, j, 24) * a.farben.length)],
        }));
      }
    }

    // Höfe: ein Wohnhaus, eine Scheune – nicht im See, nicht im Wald, nicht
    // im Dorf und nicht nahe an einem Ziel.
    for (let i = -18; i <= 18; i += 1) {
      for (let j = -18; j <= 18; j += 1) {
        if (hash2(i, j, 61) > 0.07) continue;
        const [x, y] = feldEcke(i, j);
        if (!frei(x, y, 70)) continue;
        const w = hash2(i, j, 62) * Math.PI;
        WELT.haeuser.push(haus(x, y, 18, 12, w, 0));
        const c = Math.cos(w);
        const s = Math.sin(w);
        WELT.haeuser.push(haus(x + c * 4 - s * 22, y + s * 4 + c * 22, 28, 14, w, 3));
        for (let m = 0; m < 4; m += 1) {
          const bx = x - c * (16 + m * 7) + s * 8;
          const by = y - s * (16 + m * 7) - c * 8;
          WELT.baeume.push(eintragen("baum", { x: bx, y: by, r: 3.6 + hash2(i, m, 63) * 1.4, bb: [bx - 6, by - 6, bx + 6, by + 6], ton: hash2(i, m, 64) }));
        }
      }
    }

    // Alleen und einzelne Bäume in den Wiesen.
    for (const s of WELT.strassen) {
      if (s.art !== "haupt") continue;
      let weg = 0;
      for (let k = 0; k + 3 < s.pts.length; k += 2) {
        const ax = s.pts[k];
        const ay = s.pts[k + 1];
        const bx = s.pts[k + 2];
        const by = s.pts[k + 3];
        const l = Math.hypot(bx - ax, by - ay);
        const nx = -(by - ay) / (l || 1);
        const ny = (bx - ax) / (l || 1);
        for (let u = 0; u < l; u += 1) {
          weg += 1;
          if (weg % 21 !== 0) continue;
          const x = ax + (bx - ax) * (u / l);
          const y = ay + (by - ay) * (u / l);
          if (rauschen(x / 700, y / 700, 65) < 0.55) continue;
          [-1, 1].forEach((seite) => {
            const tx = x + nx * seite * (s.breite / 2 + 5);
            const ty = y + ny * seite * (s.breite / 2 + 5);
            if (!frei(tx, ty, 20)) return;
            WELT.baeume.push(eintragen("baum", { x: tx, y: ty, r: 3.4 + hash2(Math.round(tx), Math.round(ty), 66) * 1.2, bb: [tx - 6, ty - 6, tx + 6, ty + 6], ton: hash2(Math.round(tx), 3, 67) }));
          });
        }
      }
    }
    for (const f of WELT.felder) {
      if (f.art !== "wiese" || Math.abs(f.i) > 20 || Math.abs(f.j) > 20) continue;
      const anzahl = Math.floor(hash2(f.i, f.j, 71) * 3);
      for (let m = 0; m < anzahl; m += 1) {
        const x = f.bb[0] + 10 + hash2(f.i, f.j, 72 + m) * (f.bb[2] - f.bb[0] - 20);
        const y = f.bb[1] + 10 + hash2(f.i, f.j, 75 + m) * (f.bb[3] - f.bb[1] - 20);
        if (!imPoly(f.pts, x, y) || !frei(x, y, 30)) continue;
        WELT.baeume.push(eintragen("baum", { x, y, r: 4 + hash2(f.i, m, 78) * 2.2, bb: [x - 8, y - 8, x + 8, y + 8], ton: hash2(f.j, m, 79) }));
      }
    }

    // Die Lampen im Dorf: alle 32 m an den Strassen.
    for (const s of WELT.strassen) {
      let weg = 0;
      for (let k = 0; k + 3 < s.pts.length; k += 2) {
        const ax = s.pts[k];
        const ay = s.pts[k + 1];
        const bx = s.pts[k + 2];
        const by = s.pts[k + 3];
        const l = Math.hypot(bx - ax, by - ay);
        for (let u = 0; u < l; u += 1) {
          weg += 1;
          if (weg % 32 !== 0) continue;
          const x = ax + (bx - ax) * (u / l);
          const y = ay + (by - ay) * (u / l);
          if (Math.hypot(x - DORF.x, y - DORF.y) < DORF.r * 0.95) WELT.lampen.push(eintragen("lampe", { x, y, bb: [x, y, x, y] }));
        }
      }
    }

    // Die beweglichen Ziele und der Strand: Floss auf dem See, Boot auf dem
    // Fluss, Badeplatz am Ufer.
    WELT.orte.floss.push({ art: "floss", x: -1150, y: -700, spiel: 260 }, { art: "floss", x: -1000, y: -1060, spiel: 240 });
    WELT.orte.boot.push({ art: "boot", x: 470, y: -430, richtung: 1 });
    [[-1000, 1], [-870, 1], [-790, -1]].forEach(([y, seite]) => {
      // Das Ufer in dieser Reihe suchen und ein Stück daneben ins Gras.
      let x = -1050;
      while (imPoly(see, x + seite * 2, y)) x += seite * 2;
      WELT.orte.strand.push({ art: "strand", x: x + seite * 25, y });
    });
  }

  // Wo sich zwei Strecken kreuzen – oder null.
  function schnitt(ax, ay, bx, by, cx, cy, dx, dy) {
    const r1 = bx - ax;
    const s1 = by - ay;
    const r2 = dx - cx;
    const s2 = dy - cy;
    const n = r1 * s2 - s1 * r2;
    if (Math.abs(n) < 1e-9) return null;
    const t = ((cx - ax) * s2 - (cy - ay) * r2) / n;
    const u = ((cx - ax) * s1 - (cy - ay) * r1) / n;
    if (t < 0 || t > 1 || u < 0 || u > 1) return null;
    return { x: ax + r1 * t, y: ay + s1 * t };
  }

  // Ist hier Platz für einen Hof oder einen Baum? Nicht im See, im Fluss, im
  // Wald, im Dorf, auf dem Flugplatz, auf einer Strasse oder nahe an einem
  // Ziel.
  function frei(x, y, rand) {
    if (WELT.see && imPoly(WELT.see.pts, x, y)) return false;
    if (WELT.fluss && abstandLinie(WELT.fluss.pts, x, y) < 12 + rand) return false;
    if (Math.hypot(x - DORF.x, y - DORF.y) < DORF.r + rand) return false;
    if (x > -1100 && x < -50 && y > 420 && y < 810) return false;
    if (FESTE_ORTE.some((o) => Math.hypot(o.x - x, o.y - y) < 110 + rand)) return false;
    if (WELT.orte.lichtung.some((o) => Math.hypot(o.x - x, o.y - y) < 60)) return false;
    for (const w of finde("wald", x - rand, y - rand, x + rand, y + rand)) if (imPoly(w.pts, x, y)) return false;
    for (const s of finde("strasse", x - rand, y - rand, x + rand, y + rand)) if (abstandLinie(s.pts, x, y) < s.breite / 2 + 6) return false;
    return true;
  }

  // Das Feld, in dem ein Punkt liegt – oder null.
  function feldBei(x, y) {
    for (const f of finde("feld", x, y, x, y)) if (imPoly(f.pts, x, y)) return f;
    return null;
  }

  // Die Bäume eines Obstgartens: in Reihen längs der Furchenrichtung.
  function obstBaeume(f, x0, y0, x1, y1, fn) {
    const c = Math.cos(f.winkel);
    const s = Math.sin(f.winkel);
    const [bx0, by0, bx1, by1] = f.bb;
    const mx = (bx0 + bx1) / 2;
    const my = (by0 + by1) / 2;
    const R = Math.hypot(bx1 - bx0, by1 - by0) / 2;
    for (let u = -Math.ceil(R / OBST); u <= Math.ceil(R / OBST); u += 1) {
      for (let v = -Math.ceil(R / OBST); v <= Math.ceil(R / OBST); v += 1) {
        const x = mx + (u * c - v * s) * OBST;
        const y = my + (u * s + v * c) * OBST;
        if (x < x0 - 5 || x > x1 + 5 || y < y0 - 5 || y > y1 + 5) continue;
        if (!imPoly(f.pts, x, y)) continue;
        // Ein Rand von Gras zum Nachbarfeld.
        let nah = false;
        for (let k = 0; k < 8 && !nah; k += 2) {
          if (abstandStrecke(x, y, f.pts[k], f.pts[k + 1], f.pts[(k + 2) % 8], f.pts[(k + 3) % 8]) < 5) nah = true;
        }
        if (nah) continue;
        fn(x, y, 2.6 + hash2(u + f.i * 50, v + f.j * 50, 81) * 0.9, hash2(u, v, 82 + f.i));
      }
    }
  }

  // Die Bäume im Wald: an festen Rasterpunkten, wo Wald ist und keine
  // Lichtung.
  function waldBaeume(waelder, x0, y0, x1, y1, fn) {
    for (let gi = Math.floor(x0 / WALD_G) - 1; gi <= Math.floor(x1 / WALD_G) + 1; gi += 1) {
      for (let gj = Math.floor(y0 / WALD_G) - 1; gj <= Math.floor(y1 / WALD_G) + 1; gj += 1) {
        const x = (gi + 0.1 + 0.8 * hash2(gi, gj, 12)) * WALD_G;
        const y = (gj + 0.1 + 0.8 * hash2(gi, gj, 13)) * WALD_G;
        if (!imWaldListe(waelder, x, y)) continue;
        fn(x, y, 2.3 + 1.5 * hash2(gi, gj, 14), hash2(gi, gj, 15));
      }
    }
  }

  function imLichtung(x, y) {
    for (const l of WELT.lichtungen) if ((x - l.x) ** 2 + (y - l.y) ** 2 < l.r * l.r) return true;
    return false;
  }

  function imWaldListe(waelder, x, y) {
    for (const w of waelder) {
      const b = w.bb;
      if (x < b[0] || x > b[2] || y < b[1] || y > b[3]) continue;
      if (imPoly(w.pts, x, y)) return !imLichtung(x, y);
    }
    return false;
  }

  /*
   * Worauf man an der Stelle (x, y) landet:
   *   "dach"    auf einem Haus
   *   "baum"    in einem Baum: im Wald, im Obstgarten, an einer Allee
   *   "wasser"  im See oder im Fluss (nicht auf einer Brücke)
   *   "boden"   Gras, Acker, Strasse, Sand, Pflaster – alles, wo man steht
   */
  function untergrund(x, y) {
    for (const h of finde("haus", x, y, x, y)) {
      const c = Math.cos(-h.winkel);
      const s = Math.sin(-h.winkel);
      const lx = (x - h.x) * c - (y - h.y) * s;
      const ly = (x - h.x) * s + (y - h.y) * c;
      if (Math.abs(lx) <= h.w / 2 && Math.abs(ly) <= h.h / 2) return "dach";
    }
    for (const b of finde("baum", x - 7, y - 7, x + 7, y + 7)) if (Math.hypot(b.x - x, b.y - y) < b.r) return "baum";
    for (const i of finde("insel", x, y, x, y)) {
      for (const b of i.baeume) if (Math.hypot(b.x - x, b.y - y) < b.r) return "baum";
      if (imPoly(i.pts, x, y)) return "boden";
    }
    if (imWaldListe(finde("wald", x, y, x, y), x, y)) return "baum";
    const f = feldBei(x, y);
    if (f && f.art === "obst") {
      let drin = false;
      obstBaeume(f, x - 4, y - 4, x + 4, y + 4, (bx, by, r) => { if (Math.hypot(bx - x, by - y) < r) drin = true; });
      if (drin) return "baum";
    }
    for (const b of finde("bruecke", x, y, x, y)) {
      const c = Math.cos(-b.winkel);
      const s = Math.sin(-b.winkel);
      const lx = (x - b.x) * c - (y - b.y) * s;
      const ly = (x - b.x) * s + (y - b.y) * c;
      if (Math.abs(lx) <= b.lang / 2 && Math.abs(ly) <= b.breit / 2) return "boden";
    }
    if (abstandLinie(WELT.fluss.pts, x, y) < WELT.fluss.breite / 2) return "wasser";
    if (imPoly(WELT.see.pts, x, y)) return "wasser";
    return "boden";
  }

  // Wie weit man in der Reihe eines Ortes nach links und rechts im Trockenen
  // landet (m) – höchstens 80.
  function freiInReihe(x, y) {
    let links = 0;
    let rechts = 0;
    while (links < 80 && untergrund(x - links - 0.5, y) === "boden") links += 0.5;
    while (rechts < 80 && untergrund(x + rechts + 0.5, y) === "boden") rechts += 0.5;
    return { links, rechts };
  }

  baueWelt();
  for (const art of ["wiese", "acker", "strand", "insel", "lichtung", "dorf"]) {
    for (const o of WELT.orte[art]) Object.assign(o, freiInReihe(o.x, o.y));
  }

  // ---------------------------------------------------------------------------
  // Die Kacheln
  // ---------------------------------------------------------------------------
  /*
   * Der Boden steht in Kacheln zu KACHEL × KACHEL Bildpunkten. Stufe L deckt
   * je Kachel 2048 / 2^L Meter: Stufe 0 zwei Kilometer, Stufe 9 vier Meter.
   * Aus der Höhe nimmt die Kamera eine grobe Stufe, nahe am Boden eine feine –
   * immer die, deren Bildpunkte gerade nicht gröber sind als die des
   * Bildschirms. Eine Kachel, die noch fehlt, steht einstweilen aus einer
   * gröberen da und blendet weich ein, sobald sie gemalt ist. Gemalt wird je
   * Bild nur, was in ein paar Millisekunden passt, das Nötigste zuerst, und
   * bald Gebrauchtes schon vorher. Höchstens KACHELN_MAX liegen im Speicher.
   * Weil das Tal immer dasselbe ist, bleiben sie über Sprünge und Runden.
   */
  const KACHEL = 256;
  const L_MAX = 9;
  const KACHELN_MAX = 130;
  const BUDGET_MS = 4;
  const EINBLENDEN = 0.22;
  const kachelMeter = (L) => 2048 / 2 ** L;
  const kachelKey = (L, i, j) => `${L}/${i}/${j}`;
  const kacheln = new Map();
  const kachelPool = [];
  let kachelWunsch = [];
  let bildNr = 0;
  let uhr = 0;                     // die Wanduhr in Sekunden, für das Einblenden
  // Wie lange das Malen dauert (ms) – für die Prüfung der Bildrate.
  const leistung = { bilder: 0, zeichnen: 0, kacheln: 0, stufen: [] };

  const FARBE = {
    wiese: "#7fbb57",
    wald: "#2c5631",
    wasser: "#3a7cab",
    sand: "#ddcb9c",
    schlamm: "#b9a77c",
    asphalt: "#90959c",
    asphaltRand: "#686c73",
    weg: "#c8b089",
    pflaster: "#cbbfa9",
    garten: "#8cbd67",
    piste: "#9fd376",
    schatten: "rgba(16, 32, 18, 0.3)",
  };
  // Dächer: die Seite zur Sonne (oben links) und die im Schatten.
  const DAECHER = [
    ["#cf5d42", "#a2432f"],
    ["#b34a33", "#853526"],
    ["#858b95", "#61656f"],
    ["#b8763f", "#8d572c"],
    ["#7487a0", "#56637b"],
    ["#69ab95", "#4b8270"],
  ];
  const SCHEUNE = ["#a87650", "#80583a"];
  const KRONEN = ["#3f7a3a", "#4b8a40", "#356c35", "#58934a", "#447f3d"];
  const LICHT = { x: -0.7071, y: -0.7071 };   // die Sonne steht oben links

  function pfad(cg, pts) {
    cg.beginPath();
    cg.moveTo(pts[0], pts[1]);
    for (let k = 2; k < pts.length; k += 2) cg.lineTo(pts[k], pts[k + 1]);
    cg.closePath();
  }

  function linie(cg, pts) {
    cg.beginPath();
    cg.moveTo(pts[0], pts[1]);
    for (let k = 2; k < pts.length; k += 2) cg.lineTo(pts[k], pts[k + 1]);
  }

  // --- Muster: Gras, Kronendach, Pflaster ----------------------------------
  // Jedes als kleine Leinwand, die sich nahtlos wiederholt, in mehreren
  // Grössen; über setTransform an die Welt geheftet (ein Muster-Bildpunkt ist
  // so und so viele Meter) – so passt es über Kachelgrenzen hinweg.
  const muster = { gras: [], wald: [], pflaster: [], wasser: [], ok: false };

  function musterLeinwand(px, malen) {
    const c = document.createElement("canvas");
    c.width = px;
    c.height = px;
    const cg = c.getContext("2d");
    // Dreimal je Richtung, damit es über den Rand hinweg passt.
    for (const dx of [-px, 0, px]) {
      for (const dy of [-px, 0, px]) {
        cg.save();
        cg.translate(dx, dy);
        malen(cg, px);
        cg.restore();
      }
    }
    return c;
  }

  function baueMuster() {
    const probe = document.createElement("canvas").getContext("2d");
    const mach = (c, meterJePx) => {
      const p = probe.createPattern(c, "repeat");
      if (!p || typeof p.setTransform !== "function" || typeof DOMMatrix !== "function") return null;
      p.setTransform(new DOMMatrix([meterJePx, 0, 0, meterJePx, 0, 0]));
      return p;
    };
    // Gras: ein graues Rauschen aus Halmen, das über jede Farbe gelegt wird
    // («overlay»). 4 m je Muster.
    for (const px of [128, 64, 32]) {
      const c = musterLeinwand(px, (cg, n) => {
        const k = n / 128;
        for (let m = 0; m < 900; m += 1) {
          const x = hash01(m * 3.1 + 1) * n;
          const y = hash01(m * 5.7 + 2) * n;
          const hell = hash01(m * 7.3);
          cg.strokeStyle = hell < 0.5 ? `rgba(40, 40, 40, ${0.35 + hell * 0.4})` : `rgba(235, 235, 235, ${0.2 + (hell - 0.5) * 0.5})`;
          cg.lineWidth = Math.max(0.6, 1.3 * k);
          cg.beginPath();
          cg.moveTo(x, y);
          cg.lineTo(x + (hash01(m * 2.3) - 0.5) * 5 * k, y - (3 + hash01(m * 1.9) * 5) * k);
          cg.stroke();
        }
      });
      muster.gras.push({ p: mach(c, 4 / px), pxJeM: px / 4 });
    }
    // Das Dach eines Waldes: Kronen dicht an dicht. 46 m je Muster.
    for (const px of [256, 128, 64]) {
      const c = musterLeinwand(px, (cg, n) => {
        const k = n / 46;
        for (let durch = 0; durch < 3; durch += 1) {
          for (let m = 0; m < 150; m += 1) {
            const x = hash01(m * 3.3 + 7) * n;
            const y = hash01(m * 4.9 + 3) * n;
            const r = (2 + hash01(m * 6.1) * 1.7) * k;
            if (durch === 0) {
              cg.fillStyle = "rgba(8, 24, 10, 0.45)";
              cg.beginPath();
              cg.arc(x + r * 0.4, y + r * 0.4, r, 0, Math.PI * 2);
              cg.fill();
            } else if (durch === 1) {
              cg.fillStyle = KRONEN[m % KRONEN.length];
              cg.beginPath();
              cg.arc(x, y, r, 0, Math.PI * 2);
              cg.fill();
            } else {
              cg.fillStyle = "rgba(190, 230, 140, 0.22)";
              cg.beginPath();
              cg.arc(x - r * 0.3, y - r * 0.3, r * 0.5, 0, Math.PI * 2);
              cg.fill();
            }
          }
        }
      });
      muster.wald.push({ p: mach(c, 46 / px), pxJeM: px / 46 });
    }
    // Pflaster: Steine in Reihen. 2 m je Muster.
    for (const px of [64, 32]) {
      const c = musterLeinwand(px, (cg, n) => {
        const st = n / 8;
        for (let r = 0; r < 8; r += 1) {
          for (let q = 0; q < 8; q += 1) {
            const x = q * st + (r % 2) * st * 0.5;
            const hell = hash2(q, r, 91);
            cg.fillStyle = `rgba(${150 + hell * 40}, ${140 + hell * 35}, ${125 + hell * 30}, 1)`;
            cg.fillRect(x + 0.6, r * st + 0.6, st - 1.2, st - 1.2);
          }
        }
      });
      muster.pflaster.push({ p: mach(c, 2 / px), pxJeM: px / 2 });
    }
    muster.ok = muster.gras.every((m) => m.p) && muster.wald.every((m) => m.p);
  }

  // Die passende Grösse eines Musters für s Bildpunkte je Meter: die
  // kleinste, die nicht gröber ist.
  function musterFuer(liste, s) {
    let wahl = liste[0];
    for (const m of liste) if (m.pxJeM >= s * 0.9) wahl = m;
    return wahl.p;
  }

  // --- Was in eine Kachel gehört --------------------------------------------
  function furchen(cg, f, s) {
    // Abstand: ein Vielfaches von 1.8 m, aber nie enger als 3 Bildpunkte –
    // so bleiben die Furchen beim Wechsel der Stufe an ihrem Platz.
    let ab = 1.8;
    while (ab * s < 3) ab *= 2;
    const c = Math.cos(f.winkel);
    const sn = Math.sin(f.winkel);
    const [bx0, by0, bx1, by1] = f.bb;
    const R = Math.hypot(bx1 - bx0, by1 - by0) / 2 + 2;
    const mx = Math.round((bx0 + bx1) / 2 / 1.8) * 1.8;
    const my = Math.round((by0 + by1) / 2 / 1.8) * 1.8;
    cg.save();
    pfad(cg, f.pts);
    cg.clip();
    cg.strokeStyle = f.furche;
    cg.globalAlpha = clamp((s - 0.9) / 1.5, 0, 1) * 0.75;
    cg.lineWidth = Math.max(0.35, ab * 0.4);
    cg.beginPath();
    for (let v = -Math.ceil(R / ab) * ab; v <= R; v += ab) {
      cg.moveTo(mx - c * R - sn * v, my - sn * R + c * v);
      cg.lineTo(mx + c * R - sn * v, my + sn * R + c * v);
    }
    cg.stroke();
    cg.restore();
    cg.globalAlpha = 1;
  }

  // Bäume: erst alle Schatten, dann alle Kronen.
  function maleBaeume(cg, liste, s) {
    if (!liste.length) return;
    cg.fillStyle = FARBE.schatten;
    cg.beginPath();
    for (const b of liste) {
      cg.moveTo(b.x + b.r * 0.55 + b.r, b.y + b.r * 0.55);
      cg.ellipse(b.x + b.r * 0.55, b.y + b.r * 0.55, b.r, b.r * 0.92, 0, 0, Math.PI * 2);
    }
    cg.fill();
    for (const b of liste) {
      const farbe = KRONEN[Math.floor(b.ton * KRONEN.length) % KRONEN.length];
      cg.fillStyle = farbe;
      cg.beginPath();
      cg.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      cg.fill();
      if (b.r * s >= 7) {
        // Nah: eine Krone aus Ballen, mit Licht oben links.
        cg.fillStyle = "rgba(20, 50, 20, 0.25)";
        for (let m = 0; m < 5; m += 1) {
          const a = m * 1.256 + b.ton * 6;
          cg.beginPath();
          cg.arc(b.x + Math.cos(a) * b.r * 0.45, b.y + Math.sin(a) * b.r * 0.45, b.r * 0.45, 0, Math.PI * 2);
          cg.fill();
        }
        cg.fillStyle = farbe;
        for (let m = 0; m < 5; m += 1) {
          const a = m * 1.256 + b.ton * 6 + 0.3;
          cg.beginPath();
          cg.arc(b.x + Math.cos(a) * b.r * 0.38 - b.r * 0.06, b.y + Math.sin(a) * b.r * 0.38 - b.r * 0.06, b.r * 0.42, 0, Math.PI * 2);
          cg.fill();
        }
      }
      if (b.r * s >= 2.5) {
        cg.fillStyle = "rgba(205, 240, 150, 0.32)";
        cg.beginPath();
        cg.arc(b.x - b.r * 0.32, b.y - b.r * 0.32, b.r * 0.48, 0, Math.PI * 2);
        cg.fill();
      }
    }
  }

  function maleHaus(cg, h, s) {
    const [hell, dunkel] = h.art === 3 ? SCHEUNE : DAECHER[h.dach];
    cg.save();
    cg.translate(h.x, h.y);
    cg.rotate(h.winkel);
    const w = h.w / 2;
    const d = h.h / 2;
    if (h.art === 2) {
      // Der Turm: ein Zeltdach aus vier Dreiecken.
      [[0, -1], [1, 0], [0, 1], [-1, 0]].forEach(([nx, ny], m) => {
        const wx = nx * Math.cos(h.winkel) - ny * Math.sin(h.winkel);
        const wy = nx * Math.sin(h.winkel) + ny * Math.cos(h.winkel);
        const licht = wx * LICHT.x + wy * LICHT.y;
        cg.fillStyle = licht > 0.2 ? hell : licht > -0.2 ? (m % 2 ? hell : dunkel) : dunkel;
        cg.beginPath();
        cg.moveTo(0, 0);
        const ecken = [[-w, -d], [w, -d], [w, d], [-w, d]];
        cg.lineTo(...ecken[m]);
        cg.lineTo(...ecken[(m + 1) % 4]);
        cg.closePath();
        cg.fill();
      });
      cg.fillStyle = "#e9d38a";
      cg.beginPath();
      cg.arc(0, 0, 0.6, 0, Math.PI * 2);
      cg.fill();
      cg.restore();
      return;
    }
    // Ein Satteldach: der First entlang der langen Seite.
    const laengs = w >= d;
    const nx = laengs ? 0 : -1;
    const ny = laengs ? -1 : 0;
    const wx = nx * Math.cos(h.winkel) - ny * Math.sin(h.winkel);
    const wy = nx * Math.sin(h.winkel) + ny * Math.cos(h.winkel);
    const ersteHell = wx * LICHT.x + wy * LICHT.y > 0;
    cg.fillStyle = ersteHell ? hell : dunkel;
    if (laengs) cg.fillRect(-w, -d, w * 2, d); else cg.fillRect(-w, -d, w, d * 2);
    cg.fillStyle = ersteHell ? dunkel : hell;
    if (laengs) cg.fillRect(-w, 0, w * 2, d); else cg.fillRect(0, -d, w, d * 2);
    if (s >= 3) {
      // Ziegelreihen und der First.
      cg.strokeStyle = "rgba(40, 20, 10, 0.18)";
      cg.lineWidth = Math.max(0.06, 0.6 / s);
      cg.beginPath();
      const schritt = s >= 8 ? 0.45 : 0.9;
      if (laengs) for (let y = -d + schritt; y < d; y += schritt) { cg.moveTo(-w, y); cg.lineTo(w, y); }
      else for (let x = -w + schritt; x < w; x += schritt) { cg.moveTo(x, -d); cg.lineTo(x, d); }
      cg.stroke();
      cg.strokeStyle = "rgba(255, 240, 220, 0.35)";
      cg.lineWidth = Math.max(0.1, 1 / s);
      cg.beginPath();
      if (laengs) { cg.moveTo(-w, 0); cg.lineTo(w, 0); } else { cg.moveTo(0, -d); cg.lineTo(0, d); }
      cg.stroke();
    }
    if (s >= 2.5 && h.art === 0) {
      // Ein Kamin.
      const kx = laengs ? w * 0.45 : -w * 0.4;
      const ky = laengs ? -d * 0.45 : d * 0.4;
      cg.fillStyle = "rgba(0, 0, 0, 0.25)";
      cg.fillRect(kx - 0.35, ky - 0.35, 1.3, 1.3);
      cg.fillStyle = "#8a5040";
      cg.fillRect(kx - 0.6, ky - 0.6, 1.2, 1.2);
    }
    if (h.art === 1) {
      // Die Kirche: ein Kreuz auf dem First.
      cg.fillStyle = "#e9d38a";
      cg.fillRect(w - 2.5, -0.25, 1.6, 0.5);
      cg.fillRect(w - 1.95, -0.7, 0.5, 1.4);
    }
    cg.restore();
  }

  function maleKachel(cg, L, i, j) {
    const T = kachelMeter(L);
    const x0 = i * T;
    const y0 = j * T;
    const x1 = x0 + T;
    const y1 = y0 + T;
    const s = KACHEL / T;
    cg.setTransform(s, 0, 0, s, -x0 * s, -y0 * s);
    cg.lineJoin = "round";
    cg.lineCap = "round";
    const rand = 10;
    const bx0 = x0 - rand;
    const by0 = y0 - rand;
    const bx1 = x1 + rand;
    const by1 = y1 + rand;
    const trifft = (bb) => !(bb[0] > bx1 || bb[2] < bx0 || bb[1] > by1 || bb[3] < by0);

    // Der Grund: Wiese. Jenseits der Felder ein Wald, so weit das Auge reicht.
    cg.fillStyle = FARBE.wiese;
    cg.fillRect(x0, y0, T, T);
    const ausserhalb = FELD_N * FELD - 40;
    if (x0 < -ausserhalb || x1 > ausserhalb || y0 < -ausserhalb || y1 > ausserhalb) {
      cg.fillStyle = FARBE.wald;
      cg.beginPath();
      cg.rect(x0, y0, T, T);
      cg.rect(ausserhalb, -ausserhalb, -2 * ausserhalb, 2 * ausserhalb);
      cg.fill("evenodd");
    }

    // Die Felder, mit Furchen, wo etwas in Reihen wächst.
    const felder = finde("feld", bx0, by0, bx1, by1);
    for (const f of felder) {
      pfad(cg, f.pts);
      cg.fillStyle = f.farbe;
      cg.fill();
      if (f.furche && s >= 0.9) furchen(cg, f, s);
    }
    // Aus der Nähe: Halme über allem, was wächst.
    if (s >= 5 && muster.ok) {
      cg.globalCompositeOperation = "overlay";
      cg.globalAlpha = 0.5;
      cg.fillStyle = musterFuer(muster.gras, s);
      cg.fillRect(x0, y0, T, T);
      cg.globalAlpha = 1;
      cg.globalCompositeOperation = "source-over";
    }

    // Der Flugplatz: gemähtes Gras in Streifen, die Piste, Markierungen.
    const fp = WELT.flugplatz;
    if (trifft(fp.bb)) {
      for (let x = fp.x0; x < fp.x1; x += 24) {
        cg.fillStyle = Math.round(x / 24) % 2 ? "#8cc865" : "#83c05d";
        cg.fillRect(x, fp.y0, Math.min(24, fp.x1 - x), fp.y1 - fp.y0);
      }
      const [px0, px1, py, ph] = fp.piste;
      cg.fillStyle = FARBE.piste;
      cg.fillRect(px0, py - ph, px1 - px0, ph * 2);
      cg.fillStyle = "#ffffff";
      for (let x = px0; x <= px1; x += 50) {
        cg.fillRect(x - 1.5, py - ph - 0.6, 3, 1.2);
        cg.fillRect(x - 1.5, py + ph - 0.6, 3, 1.2);
      }
      for (const ende of [px0 + 6, px1 - 9]) for (let m = -3; m <= 3; m += 1) cg.fillRect(ende, py + m * 3.6 - 0.8, 3, 1.6);
    }

    // Obstgärten: Bäume in Reihen.
    if (s >= 0.8) {
      const obst = [];
      for (const f of felder) if (f.art === "obst") obstBaeume(f, bx0, by0, bx1, by1, (x, y, r, ton) => obst.push({ x, y, r, ton }));
      maleBaeume(cg, obst, s);
    }

    // Der Grund des Dorfes: Gärten.
    if (trifft(WELT.siedlung.bb)) {
      pfad(cg, WELT.siedlung.pts);
      cg.fillStyle = FARBE.garten;
      cg.fill();
    }

    // Die Wälder: von weit oben eine dunkle Fläche, näher ein Kronendach,
    // ganz nah jeder Baum.
    const waelder = finde("wald", bx0, by0, bx1, by1);
    if (waelder.length) {
      cg.fillStyle = FARBE.wald;
      for (const w of waelder) {
        pfad(cg, w.pts);
        cg.fill();
      }
      if (s >= 3.2) {
        const baeume = [];
        waldBaeume(waelder, bx0, by0, bx1, by1, (x, y, r, ton) => baeume.push({ x, y, r, ton }));
        maleBaeume(cg, baeume, s);
      } else if (s >= 0.45 && muster.ok) {
        cg.save();
        cg.beginPath();
        for (const w of waelder) {
          cg.moveTo(w.pts[0], w.pts[1]);
          for (let k = 2; k < w.pts.length; k += 2) cg.lineTo(w.pts[k], w.pts[k + 1]);
          cg.closePath();
        }
        cg.clip();
        cg.globalAlpha = clamp((s - 0.45) / 0.6, 0, 1);
        cg.fillStyle = musterFuer(muster.wald, s);
        cg.fillRect(x0, y0, T, T);
        cg.globalAlpha = 1;
        cg.restore();
      }
      // Die Lichtungen: Gras in einem Ring aus Schatten.
      for (const l of finde("lichtung", bx0, by0, bx1, by1)) {
        cg.fillStyle = "#86c160";
        cg.beginPath();
        cg.arc(l.x, l.y, l.r, 0, Math.PI * 2);
        cg.fill();
        if (s >= 1) {
          const h = cg.createRadialGradient(l.x, l.y, l.r * 0.6, l.x, l.y, l.r);
          h.addColorStop(0, "rgba(10, 30, 10, 0)");
          h.addColorStop(1, "rgba(10, 30, 10, 0.3)");
          cg.fillStyle = h;
          cg.fill();
        }
      }
    }

    // Der See: ein Sandstrand, flaches Wasser am Ufer, Wellen.
    const see = WELT.see;
    if (trifft(see.bb)) {
      pfad(cg, see.pts);
      cg.lineWidth = 9;
      cg.strokeStyle = FARBE.sand;
      cg.stroke();
      cg.fillStyle = FARBE.wasser;
      cg.fill();
      cg.save();
      cg.clip();
      cg.lineWidth = 70;
      cg.strokeStyle = "rgba(88, 158, 196, 0.45)";
      cg.stroke();
      cg.lineWidth = 24;
      cg.strokeStyle = "rgba(122, 190, 214, 0.55)";
      cg.stroke();
      wellen(cg, bx0, by0, bx1, by1, s, (x, y) => imPoly(see.pts, x, y));
      cg.restore();
      for (const insel of finde("insel", bx0, by0, bx1, by1)) {
        pfad(cg, insel.pts);
        cg.lineWidth = 10;
        cg.strokeStyle = "rgba(122, 190, 214, 0.7)";
        cg.stroke();
        cg.fillStyle = FARBE.sand;
        cg.fill();
        const innen = [];
        for (let k = 0; k < insel.pts.length; k += 2) innen.push(insel.x + (insel.pts[k] - insel.x) * 0.84, insel.y + (insel.pts[k + 1] - insel.y) * 0.84);
        pfad(cg, innen);
        cg.fillStyle = "#86c160";
        cg.fill();
        maleBaeume(cg, insel.baeume.map((b, m) => ({ ...b, ton: (m * 0.37) % 1 })), s);
      }
    }

    // Der Fluss: Ufer, Wasser, eine tiefere Rinne in der Mitte.
    const fl = WELT.fluss;
    if (trifft(fl.bb)) {
      linie(cg, fl.pts);
      cg.strokeStyle = FARBE.schlamm;
      cg.lineWidth = fl.breite + 7;
      cg.stroke();
      cg.strokeStyle = "#4688b6";
      cg.lineWidth = fl.breite;
      cg.stroke();
      cg.strokeStyle = "rgba(40, 100, 150, 0.5)";
      cg.lineWidth = fl.breite * 0.45;
      cg.stroke();
      // Wellen nur auf dem Wasser: je Welle geprüft.
      if (s >= 1.2) wellen(cg, bx0, by0, bx1, by1, s, (x, y) => abstandLinie(fl.pts, x, y) < fl.breite / 2 - 1.5, 0.6);
    }

    // Die Strassen: erst alle Ränder, dann der Belag, dann die Mittellinie.
    const strassen = finde("strasse", bx0, by0, bx1, by1);
    for (const st of strassen) {
      linie(cg, st.pts);
      cg.strokeStyle = st.art === "haupt" ? FARBE.asphaltRand : "rgba(120, 100, 70, 0.5)";
      cg.lineWidth = st.breite + (st.art === "haupt" ? 1.4 : 0.8);
      cg.stroke();
    }
    for (const st of strassen) {
      linie(cg, st.pts);
      cg.strokeStyle = st.art === "haupt" ? FARBE.asphalt : FARBE.weg;
      cg.lineWidth = st.breite;
      cg.stroke();
      if (st.art === "haupt" && s >= 2) {
        cg.setLineDash([3, 5]);
        cg.strokeStyle = "rgba(255, 255, 255, 0.85)";
        cg.lineWidth = 0.25;
        cg.stroke();
        cg.setLineDash([]);
      }
    }
    for (const b of finde("bruecke", bx0, by0, bx1, by1)) {
      cg.save();
      cg.translate(b.x, b.y);
      cg.rotate(b.winkel);
      cg.fillStyle = "rgba(0, 0, 0, 0.3)";
      cg.fillRect(-b.lang / 2 + 1.5, -b.breit / 2 + 1.5, b.lang, b.breit);
      cg.fillStyle = "#b9b4aa";
      cg.fillRect(-b.lang / 2, -b.breit / 2, b.lang, b.breit);
      cg.fillStyle = FARBE.asphalt;
      cg.fillRect(-b.lang / 2, -b.breit / 2 + 1, b.lang, b.breit - 2);
      cg.fillStyle = "#e4dfd2";
      cg.fillRect(-b.lang / 2, -b.breit / 2, b.lang, 0.6);
      cg.fillRect(-b.lang / 2, b.breit / 2 - 0.6, b.lang, 0.6);
      cg.restore();
    }

    // Der Dorfplatz: Pflaster, eingefasst.
    const P = PLATZ;
    if (P.x + P.halb + 2 > bx0 && P.x - P.halb - 2 < bx1 && P.y + P.halb + 2 > by0 && P.y - P.halb - 2 < by1) {
      cg.fillStyle = "#a99e8b";
      cg.fillRect(P.x - P.halb - 1, P.y - P.halb - 1, P.halb * 2 + 2, P.halb * 2 + 2);
      cg.fillStyle = FARBE.pflaster;
      cg.fillRect(P.x - P.halb, P.y - P.halb, P.halb * 2, P.halb * 2);
      if (s >= 6 && muster.ok) {
        cg.globalAlpha = 0.6;
        cg.fillStyle = musterFuer(muster.pflaster, s);
        cg.fillRect(P.x - P.halb, P.y - P.halb, P.halb * 2, P.halb * 2);
        cg.globalAlpha = 1;
      }
      // Der Brunnen am Nordrand.
      cg.fillStyle = "#8f8a80";
      cg.beginPath();
      cg.arc(P.x, P.y - P.halb + 4, 2.6, 0, Math.PI * 2);
      cg.fill();
      cg.fillStyle = "#5fa6cf";
      cg.beginPath();
      cg.arc(P.x, P.y - P.halb + 4, 2, 0, Math.PI * 2);
      cg.fill();
    }

    // Die Häuser: erst die Schatten, dann die Dächer.
    const haeuser = finde("haus", bx0, by0, bx1, by1);
    cg.fillStyle = FARBE.schatten;
    for (const h of haeuser) {
      const o = h.hoehe * 0.3;
      cg.beginPath();
      cg.moveTo(h.ecken[0] + o, h.ecken[1] + o);
      for (let k = 2; k < 8; k += 2) cg.lineTo(h.ecken[k] + o, h.ecken[k + 1] + o);
      cg.closePath();
      cg.fill();
    }
    for (const h of haeuser) maleHaus(cg, h, s);

    // Einzelne Bäume: Alleen, Höfe, Wiesen.
    maleBaeume(cg, finde("baum", bx0, by0, bx1, by1), s);
  }

  // Wellen auf dem Wasser: kleine helle Bögen an festen Punkten.
  function wellen(cg, x0, y0, x1, y1, s, aufWasser, dichte = 1) {
    if (s < 1.2) return;
    const G = s >= 6 ? 4 : s >= 2.5 ? 9 : 20;
    cg.strokeStyle = "rgba(220, 240, 255, 0.32)";
    cg.lineWidth = Math.max(0.15, 1.1 / s);
    cg.beginPath();
    for (let gi = Math.floor(x0 / G); gi <= Math.floor(x1 / G); gi += 1) {
      for (let gj = Math.floor(y0 / G); gj <= Math.floor(y1 / G); gj += 1) {
        if (hash2(gi, gj, 95) > 0.55 * dichte) continue;
        const x = (gi + hash2(gi, gj, 96)) * G;
        const y = (gj + hash2(gi, gj, 97)) * G;
        if (!aufWasser(x, y)) continue;
        const l = G * (0.25 + hash2(gi, gj, 98) * 0.25);
        cg.moveTo(x - l, y);
        cg.quadraticCurveTo(x, y - l * 0.35, x + l, y);
      }
    }
    cg.stroke();
  }

  function kachelMalen(L, i, j) {
    let c = kachelPool.pop();
    if (!c) {
      c = document.createElement("canvas");
      c.width = KACHEL;
      c.height = KACHEL;
    }
    const cg = c.getContext("2d");
    cg.setTransform(1, 0, 0, 1, 0, 0);
    const t0 = performance.now();
    maleKachel(cg, L, i, j);
    const ms = performance.now() - t0;
    leistung.stufen[L] = Math.max(leistung.stufen[L] || 0, Math.round(ms));
    kacheln.set(kachelKey(L, i, j), { c, L, i, j, geboren: uhr, benutzt: bildNr });
  }

  // Zu viele im Speicher? Die am längsten nicht gebrauchten gehen – die
  // groben (Stufe 0 bis 2) bleiben.
  function kachelnAufraeumen() {
    if (kacheln.size <= KACHELN_MAX) return;
    const alte = [...kacheln.entries()].filter(([, k]) => k.L > 2 && k.benutzt < bildNr).sort((a, b) => a[1].benutzt - b[1].benutzt);
    for (const [key, k] of alte) {
      if (kacheln.size <= KACHELN_MAX * 0.85) break;
      kacheln.delete(key);
      if (kachelPool.length < 24) kachelPool.push(k.c);
    }
  }

  // Malen, was gewünscht ist, solange die Zeit reicht – mindestens eine.
  function kachelnMalen(budget = BUDGET_MS) {
    const t0 = performance.now();
    while (kachelWunsch.length) {
      const w = kachelWunsch.shift();
      if (kacheln.has(kachelKey(w.L, w.i, w.j))) continue;
      kachelMalen(w.L, w.i, w.j);
      if (performance.now() - t0 > budget) break;
    }
    kachelnAufraeumen();
  }

  // Die Stufe für s Bildpunkte (CSS) je Meter am Boden.
  const stufeFuer = (sCss) => clamp(Math.ceil(Math.log2(Math.max(1e-6, sCss * view.dpr * 8))), 0, L_MAX);

  // Kacheln für einen Ausschnitt vormerken (für den nächsten Sprung).
  function vormerken(x0, y0, x1, y1, L, vorrang = 9) {
    const T = kachelMeter(L);
    for (let i = Math.floor(x0 / T); i <= Math.floor(x1 / T); i += 1) {
      for (let j = Math.floor(y0 / T); j <= Math.floor(y1 / T); j += 1) {
        if (!kacheln.has(kachelKey(L, i, j))) kachelWunsch.push({ L, i, j, v: vorrang });
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Der Plan
  // ---------------------------------------------------------------------------
  /*
   * Was ein Sprung verlangt, wird Sprung um Sprung gewürfelt – und jeder
   * zieht genau Z_JE_SPRUNG Zahlen, auch wenn er nicht alle braucht. So hängt
   * der Plan nur an der Saat, nicht daran, wie weit jemand kommt.
   *
   *   art, ort     wo das Ziel liegt: Flugplatz, Wiese, Strand, Insel,
   *                Lichtung, Dorfplatz, Floss, Boot – je später, desto heikler
   *   x0, y        das Ziel beim Absprung; Floss und Boot fahren mit beweg m/s
   *   ab           so weit neben dem Ziel springt man ab (x)
   *   wind         der Wind am Boden (m/s, + nach Osten) – oben stärker
   *   boeen        unter dem Schirm: wann (s nach dem Öffnen), wohin, wie stark
   *   hindernisse  im Fall: wo man ihnen begegnet (Höhe z, Lage x), Breite,
   *                Dicke, Tempo
   *   wolken       die Saat der Wolken (nur zum Ansehen)
   *
   * Die Hindernisse liegen auf dem Weg vom Absprung zum Ziel, je eines in
   * einem eigenen Zeitfenster des Falls, und immer so, dass ein Weg frei
   * bleibt (setzeHindernisse). Wer bewegt ist (Vögel, Ballon, Segler, ein
   * Schirm), ist so gesetzt, dass er dort ist, wenn der Springer im freien
   * Fall seine Höhe erreicht: Der Fall ist ohne Ziehen für alle gleich
   * schnell.
   */
  const Z_JE_SPRUNG = 48;
  const HINDERNIS = {
    voegel: { r: 4.5, dz: 2.5 },
    ballon: { r: 7.5, dz: 8 },
    gewitter: { r: 14, dz: 26 },
    schirm: { r: 3.6, dz: 3 },
    segler: { r: 8, dz: 1.5 },
  };
  const V_ANDERER = 10.5;          // so schnell sinkt ein anderer Springer am Schirm
  const ORTSNAME = {
    wiese: "Flugplatz", acker: "Wiese", strand: "Strand am See", insel: "Insel im See",
    lichtung: "Lichtung im Wald", dorf: "Dorfplatz", floss: "Floss auf dem See", boot: "Boot auf dem Fluss",
  };
  const DECK = { floss: 5.5, boot: 7.5 };   // halbe Länge des Decks (m)

  function artFuer(n, u) {
    const liste = n === 1 ? ["wiese"]
      : n === 2 ? ["wiese", "acker"]
        : n === 3 ? ["acker", "strand", "insel"]
          : n === 4 ? ["insel", "lichtung", "strand", "dorf"]
            : n <= 6 ? ["insel", "lichtung", "dorf", "strand", "floss"]
              : ["insel", "lichtung", "dorf", "floss", "boot", "strand", "floss", "boot"];
    return liste[Math.min(liste.length - 1, Math.floor(u * liste.length))];
  }

  // Mengen von Strecken auf der x-Achse: [[a, b], …], sortiert, ohne Überlappung.
  function vereinen(menge) {
    const s = menge.slice().sort((p, q) => p[0] - q[0]);
    const raus = [];
    for (const [a, b] of s) {
      if (raus.length && a <= raus[raus.length - 1][1]) raus[raus.length - 1][1] = Math.max(raus[raus.length - 1][1], b);
      else raus.push([a, b]);
    }
    return raus;
  }
  function abziehen(menge, a, b) {
    const raus = [];
    for (const [p, q] of menge) {
      if (q <= a || p >= b) raus.push([p, q]);
      else {
        if (p < a) raus.push([p, a]);
        if (q > b) raus.push([b, q]);
      }
    }
    return raus;
  }

  /*
   * Die Hindernisse eines Sprungs – immer so, dass ein Weg frei bleibt.
   * Gerechnet wird, wohin der Springer bis zu jedem Hindernis kommen kann
   * (eine Menge von Strecken in x, die mit der Zeit wächst, so schnell er
   * gleitet). Vorsichtig gerechnet: als müsste er jedes Mal erst ganz
   * umsteuern (das kostet ihn 2 · TAU_QUER_FREI), und mit dem Wind, der ihn
   * im Fall vertreibt – gegen den Wind kommt er weniger weit. Ein Hindernis
   * sperrt in dieser Menge seine Breite; es darf nur dorthin, wo danach noch
   * mindestens 7 m frei bleiben, und am Schluss muss das Ziel noch
   * erreichbar sein. Sonst rückt es zur Seite oder fällt weg. Zwischen zwei
   * Hindernissen liegt mindestens eine Dreiviertelsekunde Fall.
   */
  function setzeHindernisse(n, z, { v, hMin, ort, x0, ab, wind, zielX, linieX, anzahlWunsch }) {
    const tA = tFall(n, H_AB - 170);
    const tB = tFall(n, hMin + 130);
    for (let anzahl = Math.min(anzahlWunsch, Math.floor((tB - tA) / 0.75)); anzahl >= 0; anzahl -= 1) {
      const liste = [];
      let menge = [[x0 + ab, x0 + ab]];
      let tVor = 0;
      const dehnen = (t0, t1) => {
        const dt = t1 - t0;
        const frei = Math.max(0, dt - 2 * TAU_QUER_FREI * (1 - Math.exp(-dt / TAU_QUER_FREI)));
        const w = windHoehe(wind, fallZ(n, (t0 + t1) / 2)) * WIND_FREI;
        menge = vereinen(menge.map(([a, b]) => [a + (w - V_QUER_FREI) * frei, b + (w + V_QUER_FREI) * frei]));
      };
      const slot = (tB - tA) / Math.max(1, anzahl);
      for (let m = 0; m < anzahl; m += 1) {
        const u = z.slice(18 + m * 6, 24 + m * 6);
        const arten = ["voegel"];
        if (n >= 3) arten.push("ballon");
        if (n >= 5) arten.push("schirm", "voegel");
        if (n >= 6) arten.push("segler");
        if (n >= 4 && m === 0) arten.push("gewitter", "gewitter");
        const was = arten[Math.min(arten.length - 1, Math.floor(u[0] * arten.length))];
        const H = HINDERNIS[was];
        let zz = fallZ(n, tA + slot * (m + 0.2 + 0.6 * u[1]));
        if (was === "gewitter") zz = Math.min(zz, H_AB - 230);
        const tK = tFall(n, zz);
        const durch = (2 * H.dz) / Math.max(20, v - (was === "schirm" ? V_ANDERER : 0));
        dehnen(tVor, tK - durch / 2);
        const W = H.r + R_FREI + 0.8;
        const v1 = (u[2] - 0.5) * 1.2 * (H.r + R_FREI);
        const v2 = (Math.sign(v1) || 1) * (H.r + R_FREI) * 1.15;
        let gewaehlt = null;
        for (const versatz of [v1, -v1, v2, -v2]) {
          const ox = linieX(zz) + versatz;
          const rest = abziehen(menge, ox - W, ox + W);
          if (rest.reduce((sum, [a, b]) => sum + b - a, 0) >= 7) { gewaehlt = { ox, rest }; break; }
        }
        if (!gewaehlt) continue;
        menge = gewaehlt.rest;
        tVor = tK + durch / 2;
        const richtung = u[3] < 0.5 ? -1 : 1;
        const vx = was === "voegel" ? richtung * lerp(2, 5, u[4])
          : was === "ballon" ? richtung * lerp(0.8, 2, u[4])
            : was === "segler" ? richtung * lerp(26, 34, u[4])
              : was === "schirm" ? richtung * lerp(0.5, 2, u[4]) : 0;
        liste.push({
          art: was, z: zz, tK, x: gewaehlt.ox, vx, r: H.r, dz: H.dz,
          y: ort.y + (u[5] - 0.5) * (was === "segler" ? 4 : 10), saat: Math.floor(u[5] * 1e6), getroffen: false,
        });
      }
      // Am Schluss muss das Ziel erreichbar bleiben: bis zum Ziehen gleiten,
      // unter dem Schirm noch ein Stück.
      const tZug = tFall(n, hMin + 15);
      dehnen(tVor, tZug);
      const tLand = tZug + 0.8 + 2.5;
      const zx = zielX(tLand);
      if (menge.some(([a, b]) => zx >= a - 10 && zx <= b + 10)) return liste;
    }
    return [];
  }

  function neuerSprung() {
    const p = state.plan;
    const n = p.spruenge.length + 1;
    const z = [];
    for (let i = 0; i < Z_JE_SPRUNG; i += 1) z.push(zufall.zahl());
    const k = anteil(n);
    const art = artFuer(n, z[0]);
    const liste = WELT.orte[art];
    const ort = liste[Math.min(liste.length - 1, Math.floor(z[1] * liste.length))];
    const v = vFallBei(n);
    const hMin = hMinBei(n);

    // Das Ziel – auf dem Wasser fährt es.
    let beweg = 0;
    let x0 = ort.x;
    if (art === "floss") {
      beweg = (z[2] < 0.5 ? -1 : 1) * lerp(1.0, 2.0, z[3]);
      x0 = ort.x + (z[4] - 0.5) * 2 * ort.spiel * 0.6 - beweg * 10;
    } else if (art === "boot") {
      beweg = ort.richtung * lerp(1.8, 2.8, z[3]);
      x0 = ort.x + z[4] * 60;
    }
    const deck = DECK[art] || 0;
    const frei = deck ? deck : Math.min(ort.links, ort.rechts);
    const r10 = Math.max(2.2, Math.min(r10Bei(n), frei - 1.2));
    const r25 = r10 * 0.5;
    const r50 = Math.max(0.7, r10 * 0.2);

    // Der Absprung: links oder rechts neben dem Ziel.
    const ab = (z[5] < 0.5 ? -1 : 1) * lerp(14, 24, z[6]) * (1 + 1.5 * k);

    // Der Wind am Boden. Floss und Boot fahren schon – dort weniger.
    const wMax = lerp(0.5, 2.6, k) * (beweg ? 0.7 : 1);
    const wind = (z[7] < 0.5 ? -1 : 1) * lerp(0.35, 1, z[8]) * wMax;

    // Böen unter dem Schirm: ab dem dritten Sprung eine, später zwei.
    const boeen = [];
    if (n >= 3) {
      boeen.push({ t: lerp(0.7, 1.7, z[9]), dir: z[10] < 0.5 ? -1 : 1, staerke: lerp(1.4, 2.6, z[11]) * (0.6 + 0.4 * k), dauer: lerp(0.9, 1.4, z[12]) });
    }
    if (n >= 6 && z[13] < 0.65) {
      boeen.push({ t: lerp(2.3, 3.3, z[14]), dir: z[15] < 0.5 ? -1 : 1, staerke: lerp(1.4, 2.4, z[16]) * (0.6 + 0.4 * k), dauer: lerp(0.8, 1.2, z[17]) });
    }

    // Die Hindernisse: je eines in einem eigenen Zeitfenster des Falls.
    const anzahlWunsch = n <= 1 ? 0 : n === 2 ? 1 : n <= 4 ? 2 : n <= 7 ? 3 : 4;
    const zielX = (ts) => x0 + beweg * ts;
    const unten = hMin + 180;
    const linieX = (zz) => zielX(tFall(n, zz)) + ab * clamp((zz - unten) / (H_AB - unten), 0, 1);
    const hindernisse = setzeHindernisse(n, z, { v, hMin, ort, x0, ab, wind, zielX, linieX, anzahlWunsch });

    p.spruenge.push({
      n, art, ort, x0, y: ort.y, beweg, deck, r10, r25, r50, ab, wind, boeen, hindernisse, v, hMin,
      tau: tauZugBei(n), wolken: Math.floor(z[47] * 1e9),
    });
  }

  function planBis(n) {
    while (state.plan.spruenge.length < n) neuerSprung();
    return state.plan.spruenge;
  }

  const sprungDaten = (n) => planBis(n)[n - 1];
  const zielXBei = (sp, ts) => sp.x0 + sp.beweg * Math.max(0, ts);

  // Wo ein Hindernis zur Zeit ts (seit dem Absprung) ist.
  function hindernisLage(h, ts) {
    const x = h.x + h.vx * (ts - h.tK);
    const z = h.art === "schirm" ? h.z + V_ANDERER * (h.tK - ts) : h.z;
    return { x, z };
  }

  // Die Welt der Runde als Text: die ersten acht Sprünge, gerundet. Im
  // Turnier bekommt jeder denselben.
  function weltText() {
    return planBis(8).map((sp) => `${sp.n}:${sp.art}@${Math.round(sp.x0)},${Math.round(sp.y)}`
      + ` ab${runde(sp.ab)} w${runde(sp.wind, 2)} v${runde(sp.beweg, 2)}`
      + ` b[${sp.boeen.map((b) => `${runde(b.t, 2)}:${b.dir}:${runde(b.staerke, 2)}`).join(",")}]`
      + ` h[${sp.hindernisse.map((h) => `${h.art}:${Math.round(h.z)}/${runde(h.x)}/${runde(h.vx)}`).join(",")}]`).join(" | ");
  }

  // ---------------------------------------------------------------------------
  // Zustand
  // ---------------------------------------------------------------------------
  // phase:   "bereit" (vor dem ersten Absprung), "spiel", "zuschauen", "ende"
  // schritt: "flugzeug", "frei", "auf" (der Schirm öffnet sich), "schirm",
  //          "gelandet", und die Fehler "reserve", "platsch", "baum", "dach"
  const TEILE = ["flugzeug", "frei", "auf", "schirm", "gelandet", "reserve", "platsch", "baum", "dach"];
  const FEHLER = new Set(["reserve", "platsch", "baum", "dach"]);
  const state = {
    phase: "bereit",
    schritt: "flugzeug",
    sprung: 1,
    sp: null,
    plan: { spruenge: [] },
    punkte: 0,
    sprungPunkte: 0,
    serie: [],               // je Sprung: { zug, ring, flare, summe }
    j: null,                 // der Springer
    flugzeug: null,          // { x, y, vy }
    t: 0,                    // Zeit im Schritt (s)
    ts: 0,                   // Zeit seit dem Absprung
    tSchirm: -1,             // Zeit, seit der Schirm ganz offen ist
    zug: null,               // { z, punkte } – wo gezogen wurde
    flare: null,             // { t0, vz0 } – wann abgefangen wurde
    landung: null,
    grund: "",
    lenkung: 0,
    aktion: false,           // ein Wisch wartet auf den nächsten Rechenschritt
    wind: { x: 0, boe: 0, warn: 0, dir: 0 },
    wolken: [],
    teile: [],
    schriften: [],
    striche: [],
    banner: null,
    lupe: 0,
    stoss: 0,
    blitz: 0,
    weiss: 0,
    jubel: -9,
    zeit: 0,
    echt: 0,
    rest: 0,
  };

  const neuerSpringer = () => ({
    x: 0, y: 0, z: H_AB, vx: 0, vz: 0, w: 0, neig: 0, auf: 0, reserve: 0, trudel: 0, steht: 0, flatter: 0,
  });

  let shell = null;
  let feld = null;
  let canvas = null;
  let g = null;
  let frame = null;
  let last = 0;
  let stepTimer = null;
  // Die Gegner (geist.js): wer als halb durchsichtiger Springer mitspringt.
  let gegner = null;
  // Wer eine Runde anschaut statt zu springen (geist.js, zuschauer).
  let zuschauer = null;

  const view = { cssW: 0, cssH: 0, dpr: 1, frei: 0, hu: 0, K: 26, F: 364 };
  const kam = { x: 0, y: 0, z: H_AB + D_FLUGZEUG, D: D_FLUGZEUG, fig: FIGUR_FREI, vpX: 0, vpY: 0, F: 364 };

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
  // in echter Zeit – die Prüfskripte rechnen ganze Runden am Stück.
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
  const fahrtwind = schleife("fallschirm.freifall");
  const propeller = schleife("fallschirm.flugzeug");
  function klangAus() {
    fahrtwind.aus();
    propeller.aus();
  }
  const V_FALL_MAX = 220;          // so schnell fällt man höchstens (vFallBei) – für den Fahrtwind

  // Perfekt in Folge – perfekt gezogen, mitten ins Ziel: zuerst die Harfe,
  // ab der zweiten die Leiter, Stufe um Stufe.
  let perfektFolge = 0;
  function perfektTon(perfekt, o = {}) {
    if (!perfekt) { perfektFolge = 0; return; }
    perfektFolge += 1;
    // Nur der erste in Folge – danach nicht jedes Mal ein Ton dazu.
    if (perfektFolge === 1) ton("perfekt", o, 100);
  }

  // Jedes Bild: der Propeller, solange das Flugzeug im Bild ist (leiser, je
  // weiter es weg ist), und im freien Fall der Fahrtwind – lauter, je
  // schneller und je tiefer.
  function klangTakt() {
    const j = state.j;
    const an = j && state.sp && !FEHLER.has(state.schritt)
      && (state.phase === "spiel" || (state.phase === "zuschauen" && !zuschauer?.fertig?.()));
    if (an && state.flugzeug) propeller.an(0.6, state.schritt === "flugzeug" ? 1 : clamp(1 - state.ts / 4, 0, 1));
    else propeller.aus();
    if (an && state.schritt === "frei") {
      fahrtwind.an(clamp(0.15 + 0.45 * Math.max(0, j.vz) / V_FALL_MAX + 0.4 * (1 - j.z / H_AB), 0, 1));
    } else fahrtwind.aus();
  }

  // ---------------------------------------------------------------------------
  // Die Fläche und die Kamera
  // ---------------------------------------------------------------------------
  let knoepfe = null;
  let promptKnoten = null;

  function buildPlatz() {
    feld = shell.el("div", "fs-feld");
    canvas = document.createElement("canvas");
    canvas.className = "fs-canvas";
    canvas.setAttribute("aria-hidden", "true");
    feld.append(canvas);
    g = canvas.getContext("2d");

    // Die zwei Knöpfe unten links und rechts und in der Mitte der Wisch.
    // Gedrückt wird die ganze Hälfte des Bildes – die Knöpfe zeigen nur, wo,
    // und leuchten, solange ein Finger darauf liegt.
    knoepfe = shell.el("div", "fs-tipp");
    knoepfe.setAttribute("aria-hidden", "true");
    const ns = "http://www.w3.org/2000/svg";
    const zeichen = (d) => {
      const svg = document.createElementNS(ns, "svg");
      svg.setAttribute("viewBox", "0 0 24 24");
      const weg = document.createElementNS(ns, "path");
      weg.setAttribute("d", d);
      weg.setAttribute("fill", "none");
      weg.setAttribute("stroke", "currentColor");
      weg.setAttribute("stroke-width", "3");
      weg.setAttribute("stroke-linecap", "round");
      weg.setAttribute("stroke-linejoin", "round");
      svg.append(weg);
      return svg;
    };
    const links = shell.el("span", "fs-knopf fs-knopf-l");
    links.append(zeichen("M14.5 5.5 8 12l6.5 6.5"));
    const wisch = shell.el("span", "fs-wisch");
    wisch.append(zeichen("M6 14l6-6 6 6M6 20l6-6 6 6"), shell.el("span", "fs-wisch-text", "Schirm"));
    const rechts = shell.el("span", "fs-knopf fs-knopf-r");
    rechts.append(zeichen("M9.5 5.5 16 12l-6.5 6.5"));
    knoepfe.append(links, wisch, rechts);
    feld.append(knoepfe);
    return feld;
  }

  function messen() {
    if (!canvas || !feld) return;
    const cssW = Math.max(80, feld.clientWidth);
    const cssH = Math.max(80, feld.clientHeight);
    const dpr = clamp(window.devicePixelRatio || 1, 1, 2);
    // Auf dem Handy reicht die Leinwand unter die Knöpfe oben (game-shell.js,
    // frei). Gemalt wird dort auch – aber die Anzeige rückt darunter.
    const frei = Math.min(cssH * 0.4, shell?.frei?.(canvas) || 0);
    if (cssW === view.cssW && cssH === view.cssH && dpr === view.dpr && frei === view.frei) return;
    view.cssW = cssW;
    view.cssH = cssH;
    view.dpr = dpr;
    view.frei = frei;
    view.hu = cssH - frei;
    // So viele Bildpunkte je Meter in der Ebene des Springers im freien
    // Fall: Mindestens SICHT_X links und rechts und SICHT_H in der Höhe
    // stehen immer im Bild.
    view.K = Math.min(cssW / (2 * SICHT_X), view.hu / SICHT_H);
    view.F = view.K * D_FREI;
    kam.F = view.F;
    const pw = Math.round(cssW * dpr);
    const ph = Math.round(cssH * dpr);
    if (canvas.width !== pw) canvas.width = pw;
    if (canvas.height !== ph) canvas.height = ph;
    sprites.schluessel = "";
  }

  const wackelX = () => (ruhig() ? 0 : Math.cos(state.echt * 53) * 3 * state.stoss);
  const wackelY = () => (ruhig() ? 0 : Math.sin(state.echt * 71) * 4 * state.stoss);

  // Die Kamera folgt dem Springer: im freien Fall nah, unter dem Schirm
  // weiter weg, im Flugzeug dazwischen. Seitlich hinkt sie ein wenig nach –
  // so sieht man, wohin er gleitet.
  function kameraFolgt(dt, sofort = false) {
    const j = state.j;
    const sch = state.schritt;
    const imFall = sch === "frei" || (sch === "reserve" && j.auf < 0.2 && j.reserve < 0.3);
    const dZiel = sch === "flugzeug" ? D_FLUGZEUG : imFall ? D_FREI : D_SCHIRM;
    const figZiel = sch === "flugzeug" || imFall ? FIGUR_FREI : FIGUR_SCHIRM;
    const tauD = sch === "frei" ? 0.9 : 0.45;
    const k = sofort ? 1 : 1 - Math.exp(-dt / tauD);
    kam.D += (dZiel - kam.D) * k;
    kam.fig += (figZiel - kam.fig) * k;
    const tauX = sch === "frei" ? 0.12 : sch === "flugzeug" ? 0.05 : 0.22;
    kam.x += (j.x - kam.x) * (sofort ? 1 : 1 - Math.exp(-dt / tauX));
    if (sch === "flugzeug") kam.x = j.x;
    kam.z = j.z + kam.D;
    kam.y = j.y - ((kam.fig - VP) * view.hu * kam.D) / kam.F;
    kam.vpX = view.cssW / 2 + wackelX();
    kam.vpY = view.frei + VP * view.hu + wackelY();
  }

  // Ein Punkt der Welt im Bild (CSS-Pixel), mit k Bildpunkten je Meter in
  // seiner Tiefe – oder null, wenn er hinter der Kamera liegt.
  function proj(x, y, z, nah = 0.6) {
    const d = kam.z - z;
    if (d < nah) return null;
    const k = kam.F / d;
    return { x: kam.vpX + (x - kam.x) * k, y: kam.vpY + (y - kam.y) * k, k, d };
  }

  // ---------------------------------------------------------------------------
  // Die gemalten Bilder im Speicher
  // ---------------------------------------------------------------------------
  /*
   * Wolken, Schein und weiche Schatten sind teuer zu malen und sehen immer
   * gleich aus: Sie liegen fertig in kleinen Leinwänden und werden im Bild
   * nur noch kopiert (und dabei gross oder klein gezogen).
   */
  const sprites = { schluessel: "", wolken: [], gewitter: [], schein: {}, klecks: null };

  function leinwand(w, h) {
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return { c, g: c.getContext("2d") };
  }

  function baueSprites() {
    if (sprites.wolken.length) return;
    // Wolken: Ballen aus weichen Kreisen, oben hell, unten bläulich grau.
    const wolke = (saat, dunkel) => {
      const W = 320;
      const H = 220;
      const { c, g: cg } = leinwand(W, H);
      const ballen = [];
      for (let m = 0; m < 26; m += 1) {
        const a = hash01(saat * 13 + m * 1.7);
        const b = hash01(saat * 7 + m * 2.9);
        const x = W * (0.18 + a * 0.64);
        const y = H * (0.3 + b * 0.4);
        const r = H * (0.12 + hash01(saat + m * 3.3) * 0.16) * (1 - Math.abs(a - 0.5) * 0.8);
        ballen.push([x, y, r]);
      }
      // Erst der Schatten der Unterseite, dann die Ballen, dann Licht.
      for (const durch of [0, 1, 2]) {
        for (const [x, y, r] of ballen) {
          const verlauf = cg.createRadialGradient(x - r * 0.25, y - r * 0.3, r * 0.1, x, y, r);
          if (durch === 0) {
            verlauf.addColorStop(0, dunkel ? "rgba(40, 44, 62, 0.9)" : "rgba(150, 165, 195, 0.5)");
            verlauf.addColorStop(1, "rgba(150, 165, 195, 0)");
            cg.fillStyle = verlauf;
            cg.beginPath();
            cg.arc(x + r * 0.15, y + r * 0.35, r * 1.05, 0, Math.PI * 2);
            cg.fill();
          } else if (durch === 1) {
            verlauf.addColorStop(0, dunkel ? "rgba(92, 98, 120, 1)" : "rgba(255, 255, 255, 1)");
            verlauf.addColorStop(0.65, dunkel ? "rgba(70, 76, 98, 0.95)" : "rgba(244, 247, 252, 0.95)");
            verlauf.addColorStop(1, dunkel ? "rgba(60, 66, 88, 0)" : "rgba(225, 232, 245, 0)");
            cg.fillStyle = verlauf;
            cg.beginPath();
            cg.arc(x, y, r, 0, Math.PI * 2);
            cg.fill();
          } else {
            const licht = cg.createRadialGradient(x - r * 0.35, y - r * 0.4, 0, x - r * 0.35, y - r * 0.4, r * 0.7);
            licht.addColorStop(0, dunkel ? "rgba(140, 150, 180, 0.35)" : "rgba(255, 255, 255, 0.7)");
            licht.addColorStop(1, "rgba(255, 255, 255, 0)");
            cg.fillStyle = licht;
            cg.beginPath();
            cg.arc(x - r * 0.35, y - r * 0.4, r * 0.7, 0, Math.PI * 2);
            cg.fill();
          }
        }
      }
      return c;
    };
    for (let v = 0; v < 4; v += 1) sprites.wolken.push(wolke(v + 1, false));
    for (let v = 0; v < 2; v += 1) sprites.gewitter.push(wolke(v + 11, true));
    // Schein: ein weicher Kreis in einer Farbe, für Lichter und Glanz.
    const schein = (farbe) => {
      const { c, g: cg } = leinwand(64, 64);
      const v = cg.createRadialGradient(32, 32, 0, 32, 32, 32);
      v.addColorStop(0, farbe);
      v.addColorStop(0.25, farbe.replace(/[\d.]+\)$/, "0.55)"));
      v.addColorStop(1, farbe.replace(/[\d.]+\)$/, "0)"));
      cg.fillStyle = v;
      cg.fillRect(0, 0, 64, 64);
      return c;
    };
    sprites.schein = {
      warm: schein("rgba(255, 214, 140, 1)"),
      weiss: schein("rgba(255, 255, 255, 1)"),
      rot: schein("rgba(255, 80, 60, 1)"),
      gruen: schein("rgba(90, 255, 140, 1)"),
      gold: schein("rgba(255, 200, 70, 1)"),
      blau: schein("rgba(150, 190, 255, 1)"),
    };
    // Ein weicher dunkler Fleck: Schatten von Wolken.
    const { c, g: cg } = leinwand(64, 64);
    const v = cg.createRadialGradient(32, 32, 4, 32, 32, 32);
    v.addColorStop(0, "rgba(10, 20, 40, 1)");
    v.addColorStop(0.6, "rgba(10, 20, 40, 0.6)");
    v.addColorStop(1, "rgba(10, 20, 40, 0)");
    cg.fillStyle = v;
    cg.fillRect(0, 0, 64, 64);
    sprites.klecks = c;
  }

  // Die Wolken eines Sprungs: zwei bis drei Schichten, in die man fällt –
  // aus der Saat des Sprungs, nur zum Ansehen.
  function wolkenFuer(sp) {
    const liste = [];
    const s = sp.wolken % 100000;
    const schichten = 2 + (hash2(s, 1, 101) < 0.5 ? 1 : 0);
    for (let m = 0; m < schichten; m += 1) {
      const zz = [720, 500, 300][m] + (hash2(s, m, 102) - 0.5) * 80;
      const anzahl = 6 + Math.floor(hash2(s, m, 103) * 5);
      for (let q = 0; q < anzahl; q += 1) {
        const h = (o) => hash2(s * 7 + m, q, 104 + o);
        // Eine je Schicht liegt im Weg – durch die fällt man hindurch.
        const imWeg = q === 0;
        liste.push({
          x: sp.x0 + sp.ab * 0.6 + (imWeg ? (h(1) - 0.5) * 30 : (h(1) - 0.5) * 900),
          y: sp.y + (imWeg ? (h(2) - 0.5) * 20 : (h(2) - 0.5) * 1100),
          z: zz + (h(3) - 0.5) * 40,
          w: imWeg ? 70 + h(4) * 50 : 90 + h(4) * 170,
          v: Math.floor(h(5) * 4),
          spiegel: h(6) < 0.5,
        });
      }
    }
    return liste;
  }

  // ---------------------------------------------------------------------------
  // Tageszeit
  // ---------------------------------------------------------------------------
  // Morgen, Mittag, Abendrot, Nacht – je Sprung ein Stück weiter. Über das
  // ganze Bild kommt eine Farbe («multiply»), dazu Dunst in der Höhe und
  // nachts die Lichter.
  const TAGESZEITEN = [
    { tint: [255, 238, 214], dunst: [216, 230, 246], dunstA: 0.36, licht: 0 },
    { tint: [255, 255, 255], dunst: [206, 226, 248], dunstA: 0.3, licht: 0 },
    { tint: [255, 190, 138], dunst: [255, 198, 152], dunstA: 0.36, licht: 0.3 },
    { tint: [52, 64, 120], dunst: [16, 22, 52], dunstA: 0.4, licht: 1 },
  ];
  const tagBei = (n) => (n <= 2 ? 0.15 * (n - 1) : n <= 5 ? 1 : n === 6 ? 1.45 : n === 7 ? 1.95 : n === 8 ? 2.35 : n === 9 ? 2.75 : 3);

  function tageszeit() {
    const t = clamp(state.tag || 0, 0, 3);
    const a = Math.floor(t);
    const b = Math.min(3, a + 1);
    const f = t - a;
    const A = TAGESZEITEN[a];
    const B = TAGESZEITEN[b];
    const mix = (p, q) => p.map((v, i) => Math.round(lerp(v, q[i], f)));
    return { tint: mix(A.tint, B.tint), dunst: mix(A.dunst, B.dunst), dunstA: lerp(A.dunstA, B.dunstA, f), licht: lerp(A.licht, B.licht, f) };
  }
  const rgba = (c, a) => `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${a})`;

  // ---------------------------------------------------------------------------
  // Abfangen: wie weich es wird
  // ---------------------------------------------------------------------------
  // Das Sinken nach dem Abfangen, t Sekunden danach, wer mit v0 sank.
  function flareSinken(t, v0) {
    if (t < FLARE_HALT) return V_FLARE + (v0 - V_FLARE) * Math.exp(-t / FLARE_TAU);
    const vh = V_FLARE + (v0 - V_FLARE) * Math.exp(-FLARE_HALT / FLARE_TAU);
    return vh + (V_SINK * 0.95 - vh) * (1 - Math.exp(-(t - FLARE_HALT) / STALL_TAU));
  }
  // In welcher Höhe abgefangen butterweich (oder weich) aufsetzt – einmal
  // ausgerechnet, mit denselben Schritten wie im Spiel.
  const FLARE_BAND = (() => {
    const aufsetzen = (h) => {
      let z = h;
      let t = 0;
      let vz = V_SINK;
      while (z > 0 && t < 6) {
        vz = flareSinken(t, V_SINK);
        z -= vz * TAKT;
        t += TAKT;
      }
      return vz;
    };
    const band = { butter: [99, 0], weich: [99, 0] };
    for (let h = 0.2; h <= 20; h += 0.05) {
      const v = aufsetzen(h);
      if (v < WEICH) { band.butter[0] = Math.min(band.butter[0], h); band.butter[1] = Math.max(band.butter[1], h); }
      if (v < HART) { band.weich[0] = Math.min(band.weich[0], h); band.weich[1] = Math.max(band.weich[1], h); }
    }
    return band;
  })();

  // ---------------------------------------------------------------------------
  // Zeichnen: der Boden
  // ---------------------------------------------------------------------------
  let vorgemerkt = [];

  // Eine Kachel, die fehlt, aus der nächsten gröberen, die da ist.
  function ersatz(L, i, j, ax, ay, w, h) {
    for (let m = 1; m <= L; m += 1) {
      const k = kacheln.get(kachelKey(L - m, i >> m, j >> m));
      if (!k) continue;
      const teil = KACHEL / 2 ** m;
      k.benutzt = bildNr;
      g.drawImage(k.c, (i - ((i >> m) << m)) * teil, (j - ((j >> m) << m)) * teil, teil, teil, ax, ay, w, h);
      return;
    }
    g.fillStyle = FARBE.wiese;
    g.fillRect(ax, ay, w, h);
  }

  function zeichneBoden() {
    g.setTransform(1, 0, 0, 1, 0, 0);
    const sCss = kam.F / Math.max(0.5, kam.z);
    const L = stufeFuer(sCss);
    const T = kachelMeter(L);
    const dpr = view.dpr;
    const wx0 = kam.x - kam.vpX / sCss;
    const wx1 = kam.x + (view.cssW - kam.vpX) / sCss;
    const wy0 = kam.y - kam.vpY / sCss;
    const wy1 = kam.y + (view.cssH - kam.vpY) / sCss;
    const bx = (x) => Math.round((kam.vpX + (x - kam.x) * sCss) * dpr);
    const by = (y) => Math.round((kam.vpY + (y - kam.y) * sCss) * dpr);
    const mx = state.j.x;
    const my = state.j.y;
    const wunsch = [];
    for (let i = Math.floor(wx0 / T); i <= Math.floor(wx1 / T); i += 1) {
      for (let j = Math.floor(wy0 / T); j <= Math.floor(wy1 / T); j += 1) {
        const ax = bx(i * T);
        const ay = by(j * T);
        const ex = bx((i + 1) * T);
        const ey = by((j + 1) * T);
        if (ex <= ax || ey <= ay) continue;
        const k = kacheln.get(kachelKey(L, i, j));
        const a = k ? clamp((uhr - k.geboren) / EINBLENDEN, 0, 1) : 0;
        if (a < 1) ersatz(L, i, j, ax, ay, ex - ax, ey - ay);
        if (k) {
          k.benutzt = bildNr;
          g.globalAlpha = a;
          g.drawImage(k.c, ax, ay, ex - ax, ey - ay);
          g.globalAlpha = 1;
        } else {
          wunsch.push({ L, i, j, v: Math.hypot((i + 0.5) * T - mx, (j + 0.5) * T - my) / T });
        }
      }
    }
    wunsch.sort((a, b) => a.v - b.v);
    // Bald gebraucht: die nächstfeinere Stufe, im Fall um den Punkt unter
    // dem Springer, wohin das Bild sich zusammenzieht.
    const lage = Math.log2(Math.max(1e-6, sCss * dpr * 8)) - (L - 1);
    if (L < L_MAX && lage > 0.5) {
      const T2 = kachelMeter(L + 1);
      const sx0 = mx + (wx0 - mx) * 0.55;
      const sx1 = mx + (wx1 - mx) * 0.55;
      const sy0 = my + (wy0 - my) * 0.55;
      const sy1 = my + (wy1 - my) * 0.55;
      for (let i = Math.floor(sx0 / T2); i <= Math.floor(sx1 / T2); i += 1) {
        for (let j = Math.floor(sy0 / T2); j <= Math.floor(sy1 / T2); j += 1) {
          if (!kacheln.has(kachelKey(L + 1, i, j))) wunsch.push({ L: L + 1, i, j, v: 5 + Math.hypot((i + 0.5) * T2 - mx, (j + 0.5) * T2 - my) / T2 });
        }
      }
    }
    vorgemerkt = vorgemerkt.filter((w) => !kacheln.has(kachelKey(w.L, w.i, w.j)));
    kachelWunsch = wunsch.concat(vorgemerkt);
  }

  // ---------------------------------------------------------------------------
  // Zeichnen: am Boden
  // ---------------------------------------------------------------------------
  function flach() {
    g.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
  }

  function kreis(x, y, r) {
    g.beginPath();
    g.arc(x, y, Math.max(0.1, r), 0, Math.PI * 2);
  }

  function zeichneWolkenSchatten() {
    const T = tageszeit();
    const a = 0.16 * (1 - T.licht);
    if (a < 0.01 || !sprites.klecks) return;
    g.globalAlpha = a;
    for (const w of state.wolken) {
      const p = proj(w.x + w.z * 0.35, w.y + w.z * 0.35, 0);
      if (!p) continue;
      const b = w.w * p.k * 0.9;
      const h = b * 0.62;
      if (p.x + b < 0 || p.x - b > view.cssW || p.y + h < 0 || p.y - h > view.cssH) continue;
      g.drawImage(sprites.klecks, p.x - b / 2, p.y - h / 2, b, h);
    }
    g.globalAlpha = 1;
  }

  const zielXJetzt = () => (state.sp ? zielXBei(state.sp, state.ts) : 0);

  // Das Ziel: Ringe auf dem Gras, auf dem Floss oder dem Boot, der Windsack
  // daneben, am Flugplatz Leute, die zuschauen.
  function zeichneZielplatz() {
    const sp = state.sp;
    if (!sp) return;
    const tx = zielXJetzt();
    const p = proj(tx, sp.y, 0);
    if (!p) return;
    const k = p.k;
    if (sp.art === "floss") maleFloss(p, k, sp);
    if (sp.art === "boot") maleBoot(p, k, sp);
    const r10 = sp.r10 * k;
    if (r10 > 1.2) {
      g.fillStyle = "rgba(255, 252, 244, 0.97)";
      kreis(p.x, p.y, r10);
      g.fill();
      if (r10 > 10) {
        g.strokeStyle = "rgba(240, 138, 36, 0.55)";
        g.lineWidth = Math.max(1, 0.12 * k);
        kreis(p.x, p.y, (sp.r10 + sp.r25) / 2 * k);
        g.stroke();
      }
      g.strokeStyle = "#f08a24";
      g.lineWidth = Math.max(1, 0.3 * k);
      kreis(p.x, p.y, r10);
      g.stroke();
      g.fillStyle = "#ffa733";
      kreis(p.x, p.y, sp.r25 * k);
      g.fill();
      g.fillStyle = "#e3452d";
      kreis(p.x, p.y, sp.r50 * k);
      g.fill();
      g.fillStyle = "#ffffff";
      kreis(p.x, p.y, Math.max(0.8, 0.16 * k));
      g.fill();
      if (k > 9) {
        g.font = `900 ${Math.round(clamp(k * 0.9, 9, 22))}px system-ui, sans-serif`;
        g.textAlign = "center";
        g.textBaseline = "middle";
        g.fillStyle = "rgba(170, 70, 20, 0.85)";
        g.fillText("10", p.x, p.y + (sp.r25 + sp.r10) / 2 * k);
        g.fillStyle = "rgba(255, 255, 255, 0.92)";
        g.fillText("25", p.x, p.y + (sp.r50 + sp.r25) / 2 * k);
      }
    }
    // Aus der Höhe: ein Leuchtring, damit man das Ziel findet.
    if (r10 < 16 && state.schritt !== "gelandet") {
      const puls = (state.echt * 1.4) % 1;
      g.strokeStyle = `rgba(255, 170, 60, ${0.85 * (1 - puls)})`;
      g.lineWidth = 2.2;
      kreis(p.x, p.y, 6 + puls * 16);
      g.stroke();
      g.strokeStyle = "rgba(255, 255, 255, 0.85)";
      g.lineWidth = 1.5;
      kreis(p.x, p.y, Math.max(4, r10 + 3));
      g.stroke();
    }
    maleWindsack(tx + (sp.deck || sp.r10) + 4, sp.y - (sp.deck ? 3 : 7), sp.deck ? 3.2 : 0);
    if (sp.art === "wiese") maleZuschauer(tx, sp.y);
  }

  function maleFloss(p, k, sp) {
    const L = sp.deck;
    const B = 4.6;
    // Kielwasser hinter dem Floss.
    const dir = Math.sign(sp.beweg) || 1;
    g.strokeStyle = "rgba(230, 245, 255, 0.45)";
    g.lineWidth = Math.max(1, 0.35 * k);
    for (let m = 1; m <= 3; m += 1) {
      const versatz = (state.echt * 0.8 + m / 3) % 1;
      const r = (L + m * 3 + versatz * 3) * k;
      g.globalAlpha = 0.6 * (1 - versatz * 0.6) / m;
      g.beginPath();
      g.ellipse(p.x - dir * (m * 1.5) * k, p.y, r, r * 0.6, 0, dir > 0 ? Math.PI * 0.7 : -Math.PI * 0.3, dir > 0 ? Math.PI * 1.3 : Math.PI * 0.3);
      g.stroke();
    }
    g.globalAlpha = 1;
    g.fillStyle = "rgba(0, 30, 50, 0.28)";
    g.fillRect(p.x - L * k + 0.6 * k, p.y - B * k + 0.6 * k, L * 2 * k, B * 2 * k);
    // Stämme quer.
    const stamm = (L * 2) / 7;
    for (let m = 0; m < 7; m += 1) {
      g.fillStyle = m % 2 ? "#b98652" : "#a8743f";
      const x = p.x + (-L + m * stamm) * k;
      g.beginPath();
      if (g.roundRect) g.roundRect(x + 0.05 * k, p.y - B * k, stamm * k - 0.1 * k, B * 2 * k, stamm * k * 0.45);
      else g.rect(x, p.y - B * k, stamm * k, B * 2 * k);
      g.fill();
    }
    g.fillStyle = "rgba(60, 35, 15, 0.55)";
    g.fillRect(p.x - L * k, p.y - B * 0.62 * k, L * 2 * k, 0.25 * k);
    g.fillRect(p.x - L * k, p.y + B * 0.55 * k, L * 2 * k, 0.25 * k);
    // Fähnchen an den Ecken.
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([u, v], m) => {
      const x = p.x + u * (L - 0.4) * k;
      const y = p.y + v * (B - 0.4) * k;
      g.fillStyle = "#ff8a2a";
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + 1.3 * k * (0.8 + Math.sin(state.echt * 7 + m) * 0.2), y - 0.35 * k);
      g.lineTo(x, y - 0.7 * k);
      g.fill();
    });
  }

  function maleBoot(p, k, sp) {
    const L = sp.deck + 1.2;
    const B = 2.7;
    const dir = Math.sign(sp.beweg) || 1;
    // Gischt am Bug und Kielwasser.
    g.fillStyle = "rgba(235, 248, 255, 0.5)";
    for (let m = 0; m < 6; m += 1) {
      const u = (state.echt * 1.5 + m / 6) % 1;
      const x = p.x - dir * (L + u * 14) * k;
      const s = (1 + u * 3) * k;
      g.globalAlpha = 0.6 * (1 - u);
      g.beginPath();
      g.ellipse(x, p.y - (1.2 + u * 2.4) * k, s, s * 0.4, 0, 0, Math.PI * 2);
      g.ellipse(x, p.y + (1.2 + u * 2.4) * k, s, s * 0.4, 0, 0, Math.PI * 2);
      g.fill();
    }
    g.globalAlpha = 1;
    const rumpf = (o) => {
      g.beginPath();
      g.moveTo(p.x + dir * (L + 2.2) * k + o, p.y + o);
      g.quadraticCurveTo(p.x + dir * L * k + o, p.y - B * k + o, p.x + dir * (L - 3) * k + o, p.y - B * k + o);
      g.lineTo(p.x - dir * L * k + o, p.y - B * k + o);
      g.lineTo(p.x - dir * L * k + o, p.y + B * k + o);
      g.lineTo(p.x + dir * (L - 3) * k + o, p.y + B * k + o);
      g.quadraticCurveTo(p.x + dir * L * k + o, p.y + B * k + o, p.x + dir * (L + 2.2) * k + o, p.y + o);
      g.closePath();
    };
    rumpf(0.7 * k);
    g.fillStyle = "rgba(0, 30, 50, 0.3)";
    g.fill();
    rumpf(0);
    g.fillStyle = "#f4f6f8";
    g.fill();
    g.strokeStyle = "#2f6fa8";
    g.lineWidth = Math.max(1, 0.35 * k);
    g.stroke();
    g.fillStyle = "#c79a64";
    g.fillRect(p.x - (L - 0.4) * k, p.y - (B - 0.5) * k, (L * 2 - 0.8) * k, (B * 2 - 1) * k);
    g.strokeStyle = "rgba(90, 60, 30, 0.35)";
    g.lineWidth = Math.max(0.5, 0.08 * k);
    g.beginPath();
    for (let y = -B + 1.1; y < B - 0.5; y += 0.6) {
      g.moveTo(p.x - (L - 0.4) * k, p.y + y * k);
      g.lineTo(p.x + (L - 0.4) * k, p.y + y * k);
    }
    g.stroke();
    // Der Motor am Heck.
    g.fillStyle = "#3b3f48";
    g.fillRect(p.x - dir * (L + 0.9) * k - 0.6 * k, p.y - 0.6 * k, 1.2 * k, 1.2 * k);
  }

  // Der Windsack: ein Mast, und der Sack zeigt, wohin der Wind weht – je
  // stärker, desto gestreckter.
  function maleWindsack(x, y, hoch) {
    const fuss = proj(x, y, hoch);
    const kopf = proj(x, y, hoch + 6);
    if (!fuss || !kopf || kopf.k < 0.25) return;
    const w = state.wind;
    const staerke = clamp(Math.abs(w.x) / 4.5, 0.12, 1);
    const dir = Math.sign(w.x) || 1;
    g.strokeStyle = "#e9edf2";
    g.lineWidth = Math.max(1, 0.18 * kopf.k);
    g.beginPath();
    g.moveTo(fuss.x, fuss.y);
    g.lineTo(kopf.x, kopf.y);
    g.stroke();
    const k = kopf.k;
    const lang = 3.6 * k;
    const flattern = Math.sin(state.echt * (6 + staerke * 10)) * (1.1 - staerke) * 0.6;
    const a = dir > 0 ? flattern * 0.5 : Math.PI - flattern * 0.5;
    const hang = (1 - staerke) * 1.2;
    const ex = kopf.x + Math.cos(a) * lang;
    const ey = kopf.y + Math.sin(a) * lang + hang * k;
    for (let m = 0; m < 4; m += 1) {
      const u0 = m / 4;
      const u1 = (m + 1) / 4;
      const r0 = (0.55 - u0 * 0.3) * k;
      const r1 = (0.55 - u1 * 0.3) * k;
      const x0 = lerp(kopf.x, ex, u0);
      const y0 = lerp(kopf.y, ey, u0 * u0);
      const x1 = lerp(kopf.x, ex, u1);
      const y1 = lerp(kopf.y, ey, u1 * u1);
      g.fillStyle = m % 2 ? "#ffffff" : "#ff7a1e";
      g.beginPath();
      g.moveTo(x0, y0 - r0);
      g.lineTo(x1, y1 - r1);
      g.lineTo(x1, y1 + r1);
      g.lineTo(x0, y0 + r0);
      g.closePath();
      g.fill();
    }
  }

  // Die Leute am Flugplatz – sie springen, wenn jemand gut landet.
  function maleZuschauer(tx, ty) {
    const p0 = proj(tx, ty, 0);
    if (!p0 || p0.k < 2.2) return;
    const jubel = clamp(1 - (state.echt - state.jubel) / 2.4, 0, 1);
    const FARBEN = ["#e9483b", "#3b7de9", "#f0c02b", "#39a85b", "#a157d6", "#ff8a3d", "#ffffff", "#2bb3c0"];
    for (let m = 0; m < 14; m += 1) {
      const x = tx - 20 + m * 3.1 + (hash01(m * 3.1) - 0.5) * 1.2;
      const y = ty + 24 + hash01(m * 5.3) * 4;
      const hupf = jubel > 0 ? Math.abs(Math.sin(state.echt * 9 + m * 1.7)) * 0.5 * jubel : 0;
      const p = proj(x, y, 1.6 + hupf);
      if (!p) continue;
      const k = p.k;
      g.fillStyle = "rgba(0, 0, 0, 0.22)";
      kreis(p.x + 0.35 * k, p.y + 0.35 * k, 0.32 * k);
      g.fill();
      g.fillStyle = FARBEN[m % FARBEN.length];
      g.beginPath();
      g.ellipse(p.x, p.y + 0.1 * k, 0.32 * k, 0.22 * k, 0, 0, Math.PI * 2);
      g.fill();
      if (jubel > 0.05) {
        g.strokeStyle = FARBEN[m % FARBEN.length];
        g.lineWidth = Math.max(1, 0.1 * k);
        g.beginPath();
        g.moveTo(p.x - 0.25 * k, p.y);
        g.lineTo(p.x - 0.4 * k, p.y - 0.5 * k);
        g.moveTo(p.x + 0.25 * k, p.y);
        g.lineTo(p.x + 0.4 * k, p.y - 0.5 * k);
        g.stroke();
      }
      g.fillStyle = hash01(m * 7.7) < 0.5 ? "#5a3a22" : "#e8c07a";
      kreis(p.x, p.y - 0.05 * k, 0.15 * k);
      g.fill();
    }
  }

  // Der Schatten des Springers (und seines Schirms) auf dem Boden: Die
  // Sonne steht schräg, der Schatten liegt ein Stück daneben – und rückt
  // heran, je tiefer er kommt. Beim Aufsetzen treffen sie sich.
  function zeichneSpringerSchatten() {
    const j = state.j;
    const sch = state.schritt;
    if (sch === "flugzeug" || j.z > 420) return;
    const T = tageszeit();
    const a = 0.3 * (1 - T.licht * 0.85) * clamp((420 - j.z) / 200, 0, 1);
    if (a < 0.01) return;
    g.fillStyle = `rgba(10, 25, 15, ${a})`;
    const schirm = j.auf > 0.3 && !FEHLER.has(sch) && sch !== "gelandet";
    if (schirm) {
      const zs = j.z + 5.4;
      const p = proj(j.x + zs * 0.35, j.y - 1.8 + zs * 0.35, 0);
      if (p) {
        g.save();
        g.translate(p.x, p.y);
        g.rotate(j.neig * 0.22);
        g.beginPath();
        g.ellipse(0, 0, SPANN / 2 * p.k * j.auf, TIEFE / 2 * p.k * 0.9, 0, 0, Math.PI * 2);
        g.fill();
        g.restore();
      }
    }
    if (j.z > 0.2) {
      const p = proj(j.x + j.z * 0.35, j.y + j.z * 0.35, 0);
      if (p) {
        g.beginPath();
        g.ellipse(p.x, p.y, (schirm ? 0.35 : 0.8) * p.k, (schirm ? 0.35 : 0.9) * p.k, j.w, 0, Math.PI * 2);
        g.fill();
      }
    }
  }

  function zeichneDunst() {
    const T = tageszeit();
    const a = T.dunstA * clamp((kam.z - 90) / 750, 0, 1);
    if (a > 0.01) {
      g.fillStyle = rgba(T.dunst, a);
      g.fillRect(0, 0, view.cssW, view.cssH);
    }
  }

  // ---------------------------------------------------------------------------
  // Zeichnen: der Springer, sein Schirm, das Flugzeug
  // ---------------------------------------------------------------------------
  const ANZUG = { haupt: "#f5a623", dunkel: "#2a2f3d", hell: "#ffd27a", helm: "#f4f4f6" };
  const SCHIRM_FARBEN = ["#ff7a1e", "#ffffff", "#1e5fb4", "#ffffff", "#ffb02e", "#ffffff", "#1e5fb4", "#ffffff", "#ff7a1e"];
  const ANDERE_FARBEN = ["#7a3fd1", "#ffd23f", "#7a3fd1", "#ffd23f", "#7a3fd1", "#ffd23f", "#7a3fd1", "#ffd23f", "#7a3fd1"];

  function glied(ax, ay, bx, by, dicke, farbe, rand) {
    g.lineCap = "round";
    if (rand) {
      g.strokeStyle = rand;
      g.lineWidth = dicke + 0.06;
      g.beginPath();
      g.moveTo(ax, ay);
      g.lineTo(bx, by);
      g.stroke();
    }
    g.strokeStyle = farbe;
    g.lineWidth = dicke;
    g.beginPath();
    g.moveTo(ax, ay);
    g.lineTo(bx, by);
    g.stroke();
  }

  // Der Springer im freien Fall, von oben auf den Rücken gesehen: Arme und
  // Beine gespreizt, der Kopf nach Norden. Gezeichnet in Metern um den
  // Rumpf; der Anzug flattert, die Arme folgen dem Lenken. zug: 0..1, wie
  // weit die rechte Hand zum Griff greift.
  function koerperFrei(neig, zug, farbe = null, flatter = true) {
    const f = flatter && !ruhig() ? state.echt * 17 : 0;
    const w1 = Math.sin(f) * 0.025;
    const w2 = Math.sin(f * 1.3 + 1) * 0.025;
    const haupt = farbe || ANZUG.haupt;
    const rand = farbe ? null : "rgba(40, 20, 0, 0.35)";
    const dunkel = farbe || ANZUG.dunkel;
    // Beine: Knie nach aussen, Füsse hinten.
    glied(-0.13, 0.34, -0.42 + w1, 0.76, 0.2, haupt, rand);
    glied(-0.42 + w1, 0.76, -0.3, 1.12 + w2, 0.17, haupt, rand);
    glied(0.13, 0.34, 0.42 - w2, 0.76, 0.2, haupt, rand);
    glied(0.42 - w2, 0.76, 0.3, 1.12 + w1, 0.17, haupt, rand);
    g.fillStyle = dunkel;
    kreis(-0.3, 1.16 + w2, 0.1);
    g.fill();
    kreis(0.3, 1.16 + w1, 0.1);
    g.fill();
    // Arme: Ellbogen nach aussen, Hände vorn – beim Lenken hebt sich die
    // eine Seite, die andere sinkt.
    const l = 1 + neig * 0.12;
    const r = 1 - neig * 0.12;
    glied(-0.22, -0.28, -0.64 * l + w2, -0.3, 0.17, haupt, rand);
    glied(-0.64 * l + w2, -0.3, -0.58 * l, -0.72 + w1, 0.15, haupt, rand);
    const hx = lerp(0.58 * r, 0.24, zug);
    const hy = lerp(-0.72 + w2, 0.3, zug);
    glied(0.22, -0.28, lerp(0.64 * r - w1, 0.5, zug), lerp(-0.3, -0.05, zug), 0.17, haupt, rand);
    glied(lerp(0.64 * r - w1, 0.5, zug), lerp(-0.3, -0.05, zug), hx, hy, 0.15, haupt, rand);
    g.fillStyle = dunkel;
    kreis(-0.58 * l, -0.74 + w1, 0.08);
    g.fill();
    kreis(hx, hy - 0.02, 0.08);
    g.fill();
    // Der Rumpf mit dem Gurtzeug und dem Container auf dem Rücken.
    g.fillStyle = haupt;
    g.beginPath();
    g.ellipse(0, 0.03, 0.25, 0.4, 0, 0, Math.PI * 2);
    g.fill();
    if (!farbe) {
      g.fillStyle = ANZUG.dunkel;
      g.beginPath();
      if (g.roundRect) g.roundRect(-0.19, -0.24, 0.38, 0.52, 0.08);
      else g.rect(-0.19, -0.24, 0.38, 0.52);
      g.fill();
      g.fillStyle = "rgba(255, 255, 255, 0.14)";
      g.fillRect(-0.15, -0.2, 0.3, 0.05);
      // Der Griff unten rechts – an dem wird gezogen.
      g.fillStyle = zug > 0.4 ? "rgba(0,0,0,0)" : "#ff4b2b";
      kreis(0.13, 0.3, 0.055);
      g.fill();
    }
    // Der Kopf mit dem Helm.
    g.fillStyle = farbe || ANZUG.helm;
    kreis(0, -0.46, 0.15);
    g.fill();
    if (!farbe) {
      g.fillStyle = "#1d2230";
      g.fillRect(-0.15, -0.5, 0.3, 0.045);
      g.fillStyle = "rgba(255,255,255,0.7)";
      kreis(-0.05, -0.51, 0.045);
      g.fill();
    }
  }

  // Der Springer unter dem Schirm: hängend, die Hände oben an den Leinen.
  function koerperHaengt(abfang, farbe = null) {
    const haupt = farbe || ANZUG.haupt;
    const dunkel = farbe || ANZUG.dunkel;
    const hand = lerp(-0.6, -0.2, abfang);
    glied(-0.12, 0.2, -0.14, 0.62, 0.16, dunkel);
    glied(0.12, 0.2, 0.14, 0.62, 0.16, dunkel);
    glied(-0.2, -0.2, -0.3, hand, 0.13, haupt);
    glied(0.2, -0.2, 0.3, hand, 0.13, haupt);
    g.fillStyle = haupt;
    g.beginPath();
    g.ellipse(0, 0, 0.24, 0.3, 0, 0, Math.PI * 2);
    g.fill();
    if (!farbe) {
      g.fillStyle = ANZUG.dunkel;
      g.fillRect(-0.17, -0.18, 0.34, 0.36);
    }
    g.fillStyle = farbe || ANZUG.helm;
    kreis(0, -0.3, 0.15);
    g.fill();
  }

  // Der Schirm: neun Zellen nebeneinander, von oben gesehen. Vorn (oben im
  // Bild) die Eintrittskante mit den Öffnungen, das Tuch gewölbt: Die Mitte
  // liegt im Licht, die Enden hängen tiefer und im Schatten. auf: 0..1, wie
  // weit er offen ist; neig: die Schräglage beim Lenken – die innere Seite
  // sinkt und wird dunkler.
  const SPANN = 8.4;
  const TIEFE = 3.3;

  function schirmKanten(spann, tiefe, neig, n) {
    const vorn = [];
    const hinten = [];
    for (let i = 0; i <= n; i += 1) {
      const u = (i / n) * 2 - 1;
      const x = u * (spann / 2) * (1 - 0.07 * u * u);
      const sinkt = 0.2 * tiefe * u * u + neig * u * 0.14 * tiefe;
      vorn.push([x, -tiefe / 2 * (1 - 0.3 * u * u) + sinkt]);
      hinten.push([x, tiefe / 2 * (1 - 0.2 * u * u) + sinkt]);
    }
    return { vorn, hinten };
  }

  function maleSchirm(p, k, auf, neig, farben, alpha = 1, atmen = true) {
    const ss = clamp((auf - 0.3) / 0.55, 0, 1);
    const spann = SPANN * (0.12 + 0.88 * (1 - (1 - ss) * (1 - ss))) * (1 + (ss > 0.85 && auf < 1 ? Math.sin((auf - 0.85) * 40) * 0.04 : 0));
    const tiefe = TIEFE * clamp((auf - 0.2) / 0.35, 0.25, 1);
    const puls = atmen && !ruhig() ? 1 + Math.sin(state.echt * 4.2) * 0.014 : 1;
    const n = farben.length;
    const { vorn, hinten } = schirmKanten(spann, tiefe, neig, n);
    g.save();
    g.translate(p.x, p.y);
    g.rotate(neig * 0.22);
    g.scale(k * puls, k * (2 - puls));
    g.globalAlpha = alpha;
    // Die Form: vorn gebläht, hinten fast gerade.
    const umriss = () => {
      g.beginPath();
      g.moveTo(vorn[0][0], vorn[0][1]);
      for (let i = 0; i < n; i += 1) {
        const [x0, y0] = vorn[i];
        const [x1, y1] = vorn[i + 1];
        g.quadraticCurveTo((x0 + x1) / 2, (y0 + y1) / 2 - tiefe * 0.06, x1, y1);
      }
      g.quadraticCurveTo(hinten[n][0] + tiefe * 0.08, (vorn[n][1] + hinten[n][1]) / 2, hinten[n][0], hinten[n][1]);
      for (let i = n; i > 0; i -= 1) {
        const [x0, y0] = hinten[i];
        const [x1, y1] = hinten[i - 1];
        g.quadraticCurveTo((x0 + x1) / 2, (y0 + y1) / 2 + tiefe * 0.03, x1, y1);
      }
      g.quadraticCurveTo(hinten[0][0] - tiefe * 0.08, (vorn[0][1] + hinten[0][1]) / 2, vorn[0][0], vorn[0][1]);
      g.closePath();
    };
    // Die Zellen.
    for (let i = 0; i < n; i += 1) {
      const [a0, b0] = vorn[i];
      const [a1, b1] = vorn[i + 1];
      const [c1, d1] = hinten[i + 1];
      const [c0, d0] = hinten[i];
      const um = ((i + 0.5) / n) * 2 - 1;
      g.beginPath();
      g.moveTo(a0, b0);
      g.quadraticCurveTo((a0 + a1) / 2, (b0 + b1) / 2 - tiefe * 0.06, a1, b1);
      g.lineTo(c1, d1);
      g.quadraticCurveTo((c0 + c1) / 2, (d0 + d1) / 2 + tiefe * 0.03, c0, d0);
      g.closePath();
      g.fillStyle = farben[i];
      g.fill();
      const dunkel = 0.03 + 0.3 * um * um + Math.max(0, neig * um) * 0.22;
      if (dunkel > 0.02) {
        g.fillStyle = `rgba(12, 18, 40, ${dunkel})`;
        g.fill();
      }
    }
    g.save();
    umriss();
    g.clip();
    // Licht von vorn oben, Schatten zur Hinterkante.
    const licht = g.createLinearGradient(0, -tiefe / 2, 0, tiefe / 2 + tiefe * 0.2);
    licht.addColorStop(0, "rgba(255, 255, 255, 0.42)");
    licht.addColorStop(0.3, "rgba(255, 255, 255, 0.08)");
    licht.addColorStop(0.75, "rgba(0, 0, 0, 0.04)");
    licht.addColorStop(1, "rgba(0, 0, 0, 0.26)");
    g.fillStyle = licht;
    g.fillRect(-spann, -tiefe, spann * 2, tiefe * 2.4);
    // Die Öffnungen an der Eintrittskante.
    g.fillStyle = "rgba(20, 16, 30, 0.42)";
    for (let i = 0; i < n; i += 1) {
      const [a0, b0] = vorn[i];
      const [a1, b1] = vorn[i + 1];
      const mx = (a0 + a1) / 2;
      const my = (b0 + b1) / 2 - tiefe * 0.02;
      g.beginPath();
      g.ellipse(mx, my, Math.abs(a1 - a0) * 0.36, tiefe * 0.05, Math.atan2(b1 - b0, a1 - a0), 0, Math.PI * 2);
      g.fill();
    }
    g.restore();
    // Rippen, eine Naht quer, der Umriss.
    g.strokeStyle = "rgba(30, 24, 30, 0.28)";
    g.lineWidth = 0.035;
    g.beginPath();
    for (let i = 1; i < n; i += 1) {
      g.moveTo(vorn[i][0], vorn[i][1]);
      g.lineTo(hinten[i][0], hinten[i][1]);
    }
    g.stroke();
    g.strokeStyle = "rgba(30, 24, 30, 0.12)";
    g.beginPath();
    for (let i = 0; i <= n; i += 1) {
      const y = lerp(vorn[i][1], hinten[i][1], 0.42);
      if (i) g.lineTo(vorn[i][0], y); else g.moveTo(vorn[i][0], y);
    }
    g.stroke();
    umriss();
    g.strokeStyle = "rgba(20, 16, 24, 0.55)";
    g.lineWidth = 0.05;
    g.stroke();
    // Der kleine Hilfsschirm, zusammengefallen, hinten auf dem Tuch.
    if (auf > 0.5) {
      g.strokeStyle = "rgba(255, 255, 255, 0.7)";
      g.lineWidth = 0.05;
      g.beginPath();
      g.moveTo(0, tiefe * 0.2);
      g.lineTo(0.1, tiefe * 0.62);
      g.stroke();
      g.fillStyle = "#ffffff";
      kreis(0.12, tiefe * 0.68, 0.24);
      g.fill();
      g.strokeStyle = "#ff7a1e";
      g.lineWidth = 0.06;
      g.stroke();
    }
    g.restore();
    g.globalAlpha = 1;
  }

  // Die Reserve: rund, weiss und rot – sie geht von selbst auf.
  function maleReserve(p, k, auf, alpha = 1) {
    const r = 3.4 * clamp(auf, 0.1, 1) * k;
    g.globalAlpha = alpha;
    for (let m = 0; m < 12; m += 1) {
      g.fillStyle = m % 2 ? "#ffffff" : "#e3452d";
      g.beginPath();
      g.moveTo(p.x, p.y);
      g.arc(p.x, p.y, r, (m / 12) * Math.PI * 2 + state.echt * 0.3, ((m + 1) / 12) * Math.PI * 2 + state.echt * 0.3);
      g.closePath();
      g.fill();
    }
    const v = g.createRadialGradient(p.x - r * 0.3, p.y - r * 0.3, r * 0.1, p.x, p.y, r);
    v.addColorStop(0, "rgba(255, 255, 255, 0.35)");
    v.addColorStop(1, "rgba(0, 0, 0, 0.25)");
    g.fillStyle = v;
    kreis(p.x, p.y, r);
    g.fill();
    g.fillStyle = "#ffffff";
    kreis(p.x, p.y, r * 0.12);
    g.fill();
    g.globalAlpha = 1;
  }

  // Leinen vom Schirm zu den Schultern: aus vier Reihen unter dem Tuch.
  function maleLeinen(pS, kS, pJ, kJ, neig, alpha = 1) {
    g.strokeStyle = `rgba(28, 28, 40, ${0.5 * alpha})`;
    g.lineWidth = Math.max(0.6, 0.035 * kS);
    g.beginPath();
    const c = Math.cos(neig * 0.22);
    const s = Math.sin(neig * 0.22);
    for (const u of [-0.88, -0.55, -0.2, 0.2, 0.55, 0.88]) {
      for (const v of [-0.25, 0.3]) {
        const lx = u * SPANN / 2 * 0.95;
        const ly = v * TIEFE + 0.2 * TIEFE * u * u;
        g.moveTo(pS.x + (lx * c - ly * s) * kS, pS.y + (lx * s + ly * c) * kS);
        g.lineTo(pJ.x + Math.sign(u) * 0.22 * kJ, pJ.y - 0.3 * kJ);
      }
    }
    g.stroke();
  }

  // Das Flugzeug von oben: Hochdecker, weiss mit oranger Linie, die Tür
  // rechts offen.
  function maleFlugzeug(p, k, licht) {
    g.save();
    g.translate(p.x, p.y);
    g.scale(k, k);
    // Flügel.
    g.fillStyle = "#e9edf2";
    g.beginPath();
    if (g.roundRect) g.roundRect(-8.2, -1.6, 16.4, 2.1, 0.8);
    else g.rect(-8.2, -1.6, 16.4, 2.1);
    g.fill();
    g.fillStyle = "#f08a24";
    g.fillRect(-8.2, -0.25, 16.4, 0.35);
    g.fillStyle = "rgba(0, 0, 0, 0.12)";
    g.fillRect(-8.2, 0.1, 16.4, 0.4);
    // Rumpf.
    g.fillStyle = "#f6f8fa";
    g.beginPath();
    g.moveTo(0, -5.6);
    g.bezierCurveTo(0.95, -5.4, 0.95, -3, 0.85, 0);
    g.lineTo(0.3, 6);
    g.lineTo(-0.3, 6);
    g.lineTo(-0.85, 0);
    g.bezierCurveTo(-0.95, -3, -0.95, -5.4, 0, -5.6);
    g.fill();
    g.fillStyle = "#f08a24";
    g.fillRect(-0.15, -5.2, 0.3, 11);
    // Leitwerk.
    g.fillStyle = "#e9edf2";
    g.beginPath();
    g.moveTo(-2.8, 5.8);
    g.lineTo(2.8, 5.8);
    g.lineTo(2.4, 4.9);
    g.lineTo(-2.4, 4.9);
    g.closePath();
    g.fill();
    // Fenster und die offene Tür rechts.
    g.fillStyle = "#2b3546";
    for (let m = 0; m < 4; m += 1) {
      g.fillRect(-0.85, -2.8 + m * 0.9, 0.18, 0.5);
      g.fillRect(0.67, -2.8 + m * 0.9, 0.18, 0.5);
    }
    g.fillStyle = "#11151e";
    g.fillRect(0.55, 1, 0.4, 1.5);
    // Propeller: eine verwischte Scheibe.
    g.fillStyle = "rgba(40, 40, 50, 0.25)";
    g.beginPath();
    g.ellipse(0, -5.75, 1.6, 0.22, 0, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = "rgba(30, 30, 40, 0.6)";
    g.lineWidth = 0.1;
    const dreh = state.echt * 40;
    g.beginPath();
    g.moveTo(-Math.cos(dreh) * 1.5, -5.75);
    g.lineTo(Math.cos(dreh) * 1.5, -5.75);
    g.stroke();
    g.fillStyle = "#3a3f4a";
    kreis(0, -5.7, 0.22);
    g.fill();
    g.restore();
    if (licht > 0.05) {
      lichtPunkt(p.x - 8.1 * k, p.y - 0.6 * k, 1.4 * k, "rot", licht);
      lichtPunkt(p.x + 8.1 * k, p.y - 0.6 * k, 1.4 * k, "gruen", licht);
      if (Math.sin(state.echt * 7) > 0.6) lichtPunkt(p.x, p.y + 2, 2.4 * k, "weiss", licht);
    }
  }

  const lichter = [];
  // Ein Licht, das nach der Tageszeit (multiply) hell dazukommt.
  function lichtPunkt(x, y, r, art, staerke) {
    lichter.push({ x, y, r, art, a: staerke });
  }

  // Der Springer – mit allem, was zu ihm gehört.
  function zeichneSpringer(liste) {
    const j = state.j;
    state.schirmOben = null;
    const sch = state.schritt;
    const pJ = proj(j.x, j.y, j.z);
    if (!pJ) return;
    if (sch === "flugzeug" && state.flugzeug) return;   // er sitzt im Flugzeug
    const imWasser = sch === "platsch";
    const amBoden = j.z <= 0.05;
    const tag = tageszeit();
    // Die Reserve.
    if (j.reserve > 0) {
      const pR = proj(j.x, j.y - 0.4, j.z + 4.2 * clamp(j.reserve * 1.4, 0, 1));
      if (pR) {
        liste.push({ d: pR.d, malen: () => {
          maleLeinen({ x: pR.x, y: pR.y }, pR.k * 0.4, pJ, pJ.k, 0, j.reserve);
          maleReserve(pR, pR.k, j.reserve);
        } });
      }
    }
    // Der Hauptschirm: oben, ein Stück nach vorn (Norden).
    const offen = j.auf > 0.02 && !FEHLER.has(sch) ? j.auf : (FEHLER.has(sch) && sch !== "reserve" ? 1 : 0);
    if (offen > 0) {
      let pS;
      let neig = j.neig;
      if (amBoden || sch === "gelandet" || sch === "baum" || sch === "dach" || imWasser) {
        // Nach der Landung fällt er zusammen und legt sich hin.
        const sinkt = clamp(state.t / 0.9, 0, 1);
        const hoehe = sch === "baum" ? 7.5 : sch === "dach" ? 7 : (1 - sinkt) * 5.4;
        pS = proj(j.x + j.ablage * sinkt, j.y - 1.8 - 3 * sinkt, hoehe + 0.1);
        neig = 0;
        if (pS) {
          liste.push({ d: pS.d + 0.01, malen: () => {
            g.save();
            g.translate(pS.x, pS.y);
            g.scale(1, 1 - sinkt * 0.45);
            g.translate(-pS.x, -pS.y);
            maleSchirm(pS, pS.k * (1 + sinkt * 0.15), 1, 0, SCHIRM_FARBEN, 1, false);
            g.restore();
          } });
        }
      } else {
        pS = proj(j.x, j.y - 1.8 * j.auf, j.z + 5.4 * clamp(j.auf * 1.3, 0.15, 1));
        if (pS) {
          // Der Hilfsschirm zieht beim Öffnen voraus.
          if (j.auf < 0.55) {
            const pH = proj(j.x, j.y - 1.2, j.z + 2 + j.auf * 14);
            if (pH) liste.push({ d: pH.d, malen: () => {
              g.strokeStyle = "rgba(255, 255, 255, 0.7)";
              g.lineWidth = 1;
              g.beginPath();
              g.moveTo(pJ.x, pJ.y);
              g.lineTo(pH.x, pH.y);
              g.stroke();
              g.fillStyle = "#ffffff";
              kreis(pH.x, pH.y, 0.45 * pH.k);
              g.fill();
              g.strokeStyle = "#ff7a1e";
              g.lineWidth = Math.max(1, 0.1 * pH.k);
              g.stroke();
            } });
          }
          state.schirmOben = pS.y - TIEFE * 0.6 * pS.k;
          liste.push({ d: pS.d, malen: () => {
            if (j.auf > 0.25) maleLeinen(pS, pS.k, pJ, pJ.k, neig);
            maleSchirm(pS, pS.k, j.auf, neig, SCHIRM_FARBEN);
          } });
        }
      }
    }
    // Der Springer selbst.
    liste.push({ d: pJ.d, malen: () => {
      g.save();
      g.translate(pJ.x, pJ.y);
      if (imWasser) {
        // Im Wasser: Kopf und Arme, Ringe um ihn.
        const u = (state.echt * 0.9) % 1;
        g.strokeStyle = `rgba(230, 245, 255, ${0.7 * (1 - u)})`;
        g.lineWidth = 1.5;
        kreis(0, 0, (0.5 + u * 1.6) * pJ.k);
        g.stroke();
        g.scale(pJ.k, pJ.k);
        g.fillStyle = ANZUG.haupt;
        g.beginPath();
        g.ellipse(-0.35, Math.sin(state.echt * 3) * 0.05, 0.3, 0.1, 0.4, 0, Math.PI * 2);
        g.ellipse(0.35, -Math.sin(state.echt * 3) * 0.05, 0.3, 0.1, -0.4, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = ANZUG.helm;
        kreis(0, 0, 0.17);
        g.fill();
      } else if (amBoden || sch === "gelandet") {
        // Er steht: Kopf, Schultern, und er winkt.
        g.scale(pJ.k, pJ.k);
        g.fillStyle = "rgba(0, 0, 0, 0.25)";
        g.beginPath();
        g.ellipse(0.35, 0.35, 0.45, 0.3, 0.6, 0, Math.PI * 2);
        g.fill();
        const winkt = sch === "gelandet" && state.landung?.ring > 0 ? Math.sin(state.echt * 10) * 0.25 : 0;
        glied(0.24, 0, 0.42 + winkt, -0.5, 0.12, ANZUG.haupt);
        glied(-0.24, 0, -0.36, 0.25, 0.12, ANZUG.haupt);
        g.fillStyle = ANZUG.haupt;
        g.beginPath();
        g.ellipse(0, 0, 0.3, 0.17, 0, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = ANZUG.dunkel;
        g.fillRect(-0.15, -0.05, 0.3, 0.17);
        g.fillStyle = ANZUG.helm;
        kreis(0, -0.02, 0.15);
        g.fill();
      } else if (j.auf > 0.6 || j.reserve > 0.6 || sch === "baum" || sch === "dach") {
        g.rotate(j.w * 0.4);
        g.scale(pJ.k, pJ.k);
        koerperHaengt(state.flare ? clamp((state.tSchirm - state.flare.t0) / 0.2, 0, 1) : 0);
      } else {
        g.rotate(j.w + j.trudel);
        g.scale(pJ.k, pJ.k);
        koerperFrei(j.neig, clamp(j.auf * 4, 0, 1));
      }
      g.restore();
      // Nachts blitzt am Helm ein Licht.
      if (tag.licht > 0.4 && !amBoden && Math.sin(state.echt * 6.5) > 0.85) lichtPunkt(pJ.x, pJ.y - 0.4 * pJ.k, 0.45 * pJ.k + 5, "weiss", tag.licht);
    } });
  }

  // ---------------------------------------------------------------------------
  // Zeichnen: Hindernisse, Wolken, Geister
  // ---------------------------------------------------------------------------
  function zeichneHindernisse(liste) {
    const sp = state.sp;
    if (!sp) return;
    for (const h of sp.hindernisse) {
      const lage = hindernisLage(h, state.ts);
      if (lage.z > kam.z - 1) continue;
      const p = proj(lage.x, h.y, lage.z, 1);
      if (!p) continue;
      const gross = (h.art === "gewitter" ? 30 : h.r) * p.k;
      if (p.x + gross < -20 || p.x - gross > view.cssW + 20 || p.y + gross < -20 || p.y - gross > view.cssH + 20) continue;
      liste.push({ d: p.d, malen: () => maleHindernis(h, lage, p) });
    }
  }

  function maleHindernis(h, lage, p) {
    const k = p.k;
    const nah = clamp((p.d - 1) / 6, 0, 1);
    g.globalAlpha = nah;
    if (h.art === "voegel") {
      // Ein Schwarm: jeder Vogel ein schlagendes V.
      for (let m = 0; m < 14; m += 1) {
        const dx = (hash2(h.saat, m, 1) - 0.5) * 9;
        const dy = (hash2(h.saat, m, 2) - 0.5) * 12;
        const dz = (hash2(h.saat, m, 3) - 0.5) * 3;
        const q = proj(lage.x + dx + Math.sin(state.echt * 1.3 + m) * 0.6, h.y + dy, lage.z + dz, 1);
        if (!q) continue;
        const kk = q.k;
        const schlag = Math.sin(state.echt * 12 + m * 2.1);
        const dir = Math.sign(h.vx) || 1;
        g.strokeStyle = h.y < -500 ? "#f1f3f6" : "#3a3330";
        g.lineWidth = Math.max(1, 0.12 * kk);
        g.lineJoin = "round";
        g.beginPath();
        g.moveTo(q.x - 0.5 * kk, q.y - (0.25 + schlag * 0.25) * kk * dir);
        g.lineTo(q.x, q.y);
        g.lineTo(q.x + 0.5 * kk, q.y - (0.25 + schlag * 0.25) * kk * dir);
        g.stroke();
        g.fillStyle = g.strokeStyle;
        kreis(q.x, q.y, 0.1 * kk);
        g.fill();
      }
    } else if (h.art === "ballon") {
      // Der Korb hängt tiefer: zuerst.
      const pk = proj(lage.x, h.y + 1.5, lage.z - 13, 1);
      if (pk) {
        g.strokeStyle = "rgba(60, 40, 30, 0.6)";
        g.lineWidth = Math.max(0.5, 0.05 * k);
        g.beginPath();
        for (const [u, v] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
          g.moveTo(pk.x + u * 0.6 * pk.k, pk.y + v * 0.6 * pk.k);
          g.lineTo(p.x + u * 4.5 * k, p.y + v * 4.5 * k);
        }
        g.stroke();
        g.fillStyle = "#8a5a2b";
        g.fillRect(pk.x - 0.7 * pk.k, pk.y - 0.7 * pk.k, 1.4 * pk.k, 1.4 * pk.k);
      }
      const r = h.r * k;
      const FARBEN = h.saat % 2 ? ["#e3452d", "#ffd23f"] : ["#2b7de9", "#ffffff"];
      for (let m = 0; m < 14; m += 1) {
        g.fillStyle = FARBEN[m % 2];
        g.beginPath();
        g.moveTo(p.x, p.y);
        g.arc(p.x, p.y, r, (m / 14) * Math.PI * 2, ((m + 1) / 14) * Math.PI * 2);
        g.closePath();
        g.fill();
      }
      const v = g.createRadialGradient(p.x - r * 0.35, p.y - r * 0.35, r * 0.1, p.x, p.y, r);
      v.addColorStop(0, "rgba(255, 255, 255, 0.45)");
      v.addColorStop(0.6, "rgba(255, 255, 255, 0)");
      v.addColorStop(1, "rgba(0, 0, 0, 0.35)");
      g.fillStyle = v;
      kreis(p.x, p.y, r);
      g.fill();
      g.fillStyle = FARBEN[0];
      kreis(p.x, p.y, r * 0.18);
      g.fill();
    } else if (h.art === "gewitter") {
      // Eine dunkle Wolke, in der es blitzt.
      const b = 48 * k;
      const sprite = sprites.gewitter[h.saat % 2];
      g.drawImage(sprite, p.x - b / 2, p.y - b * 0.35, b, b * 0.7);
      g.save();
      g.translate(p.x, p.y);
      g.scale(-1, 1);
      g.globalAlpha = nah * 0.8;
      g.drawImage(sprites.gewitter[(h.saat + 1) % 2], -b * 0.4, -b * 0.3, b * 0.8, b * 0.56);
      g.restore();
      g.globalAlpha = nah;
      const takt = (state.echt * 1.15 + (h.saat % 7) * 0.13) % 1;
      if (takt < 0.12) {
        const s = Math.floor(state.echt * 1.15 + (h.saat % 7) * 0.13);
        g.strokeStyle = "rgba(255, 250, 210, 0.95)";
        g.lineWidth = Math.max(1.2, 0.35 * k);
        g.beginPath();
        let x = p.x + (hash2(s, h.saat, 5) - 0.5) * 12 * k;
        let y = p.y - 8 * k;
        g.moveTo(x, y);
        for (let m = 0; m < 6; m += 1) {
          x += (hash2(s, m, 6) - 0.5) * 6 * k;
          y += 3 * k;
          g.lineTo(x, y);
        }
        g.stroke();
        if (!ruhig()) lichtPunkt(p.x, p.y, 26 * k, "blau", 0.9);
      }
    } else if (h.art === "segler") {
      const dir = Math.sign(h.vx) || 1;
      g.save();
      g.translate(p.x, p.y);
      g.scale(k * dir, k);
      g.fillStyle = "rgba(0, 0, 0, 0.12)";
      g.fillRect(-0.6, -8, 1.3, 16.2);
      g.fillStyle = "#f6f8fa";
      g.beginPath();
      g.moveTo(0.9, -8);
      g.lineTo(1.5, -8);
      g.lineTo(1.6, 8);
      g.lineTo(1.0, 8);
      g.closePath();
      g.fill();
      g.fillStyle = "#e3452d";
      g.fillRect(1.0, -8, 0.55, 1.2);
      g.fillRect(1.0, 6.8, 0.6, 1.2);
      g.fillStyle = "#f6f8fa";
      g.beginPath();
      g.ellipse(0, 0, 4, 0.45, 0, 0, Math.PI * 2);
      g.fill();
      g.fillRect(-4, -1.4, 0.6, 2.8);
      g.fillStyle = "#6fb6e9";
      g.beginPath();
      g.ellipse(2.4, 0, 0.9, 0.3, 0, 0, Math.PI * 2);
      g.fill();
      g.restore();
    } else if (h.art === "schirm") {
      // Ein anderer Springer, schon am Schirm.
      const pj = proj(lage.x + 0.2, h.y + 1.8, lage.z - 5.4, 1);
      if (pj) {
        maleLeinen(p, k, pj, pj.k, 0, nah);
        g.save();
        g.translate(pj.x, pj.y);
        g.scale(pj.k, pj.k);
        koerperHaengt(0, "#3d3f6e");
        g.restore();
      }
      maleSchirm(p, k, 1, Math.sin(state.echt * 0.7 + h.saat) * 0.3, ANDERE_FARBEN, nah);
    }
    g.globalAlpha = 1;
  }

  function zeichneWolken(liste) {
    const T = tageszeit();
    const nacht = T.licht;
    for (const w of state.wolken) {
      const p = proj(w.x, w.y, w.z, 2);
      if (!p) continue;
      const b = w.w * p.k;
      const h = b * 0.69;
      if (b > view.cssW * 9 || p.x + b / 2 < 0 || p.x - b / 2 > view.cssW || p.y + h / 2 < 0 || p.y - h / 2 > view.cssH) continue;
      const a = clamp((p.d - 4) / 34, 0, 1) * (0.92 - nacht * 0.35);
      if (a < 0.02) continue;
      liste.push({ d: p.d, malen: () => {
        g.globalAlpha = a;
        if (w.spiegel) {
          g.save();
          g.translate(p.x, p.y);
          g.scale(-1, 1);
          g.drawImage(sprites.wolken[w.v], -b / 2, -h / 2, b, h);
          g.restore();
        } else {
          g.drawImage(sprites.wolken[w.v], p.x - b / 2, p.y - h / 2, b, h);
        }
        g.globalAlpha = 1;
      } });
    }
  }

  // Die Gegner (geist.js): halb durchsichtige Springer in ihrer Farbe, auf
  // ihrem eigenen Weg – in der Welt dieses Sprungs neben dem eigenen Ziel.
  function zeichneGeister(liste) {
    if (!gegner || state.phase === "bereit" || !state.sp) return;
    const orte = window.LernappGeist?.orte?.(gegner) || [];
    if (!orte.length) return;
    const namen = [];
    orte.forEach((o) => {
      // Wem im Live-Modus zugeschaut wird, der ist der Springer selbst –
      // kein Geist dazu, nur sein Name (geist.js, namen).
      const lage = cLesen(o.c || 0);
      const x = state.sp.x0 + o.a / 10;
      const z = o.b / 10;
      const p = proj(x, state.sp.y, Math.max(0, z), 1.5);
      if (!p) {
        namen.push({ ...o, sx: view.cssW / 2 + (x - kam.x) * view.K * 0.3, sy: view.frei - 40, weit: "" });
        return;
      }
      namen.push({ ...o, sx: p.x, sy: p.y - (lage.teil >= 2 ? 6 : 1.4) * p.k - 4, weit: "" });
      if (o.ziel) return;
      liste.push({ d: p.d + 0.02, malen: () => {
        g.globalAlpha = 0.42 * o.blass;
        if (lage.teil >= 2 && lage.teil !== 4 && lage.teil !== 5) {
          const pS = proj(x, state.sp.y - 1.8, Math.max(0, z) + 5.4, 1.5);
          if (pS) maleSchirm(pS, pS.k, 1, lage.winkel, Array(9).fill(o.farbe), 0.42 * o.blass, false);
        }
        g.globalAlpha = 0.5 * o.blass;
        g.save();
        g.translate(p.x, p.y);
        g.rotate(lage.winkel);
        g.scale(p.k, p.k);
        if (lage.teil >= 2) koerperHaengt(0, o.farbe);
        else koerperFrei(0, 0, o.farbe, false);
        g.restore();
        g.globalAlpha = 1;
      } });
    });
    geisterNamen = namen;
  }
  let geisterNamen = [];

  // Fahrtwind: Striche in der Luft, die am Springer vorbeiziehen.
  function zeichneStriche() {
    const j = state.j;
    const vz = j.vz;
    if (!state.striche.length) return;
    const a = clamp((vz - 20) / 150, 0, 1) * 0.3 + (state.schritt === "schirm" ? 0.1 : 0);
    if (a < 0.02) return;
    g.strokeStyle = `rgba(255, 255, 255, ${a})`;
    g.lineWidth = 1.2;
    g.beginPath();
    const lang = clamp(view.K * 1.4, 22, 60);
    for (const s of state.striche) {
      const p0 = proj(s.x, s.y, s.z, 1);
      const p1 = proj(s.x - state.wind.x * 0.05, s.y, s.z + Math.max(0.6, vz * 0.022 * s.l), 1);
      if (!p0 || !p1) continue;
      // Nah an der Kamera würden sie zu langen Fäden: gekürzt.
      const dx = p1.x - p0.x;
      const dy = p1.y - p0.y;
      const l = Math.hypot(dx, dy);
      const f = l > lang ? lang / l : 1;
      g.moveTo(p0.x, p0.y);
      g.lineTo(p0.x + dx * f, p0.y + dy * f);
    }
    g.stroke();
  }

  // Teilchen: Staub, Gras, Spritzer, Blätter, Konfetti, Funken.
  function zeichneTeile() {
    for (const t of state.teile) {
      const p = proj(t.x, t.y, t.z, 1);
      if (!p) continue;
      const k = clamp(t.leben / t.max, 0, 1);
      if (t.art === "staub") {
        g.globalAlpha = k * 0.5;
        g.fillStyle = t.farbe;
        kreis(p.x, p.y, t.r * p.k * (2.2 - k * 1.2));
        g.fill();
      } else if (t.art === "konfetti" || t.art === "blatt") {
        g.globalAlpha = Math.min(1, k * 2);
        g.fillStyle = t.farbe;
        g.save();
        g.translate(p.x, p.y);
        g.rotate(t.dreh);
        g.scale(1, Math.cos(t.dreh * 1.7));
        g.fillRect(-t.r * p.k, -t.r * p.k * 0.5, t.r * p.k * 2, t.r * p.k);
        g.restore();
      } else {
        g.globalAlpha = k;
        g.fillStyle = t.farbe;
        kreis(p.x, p.y, Math.max(0.6, t.r * p.k * (0.5 + k * 0.5)));
        g.fill();
      }
    }
    g.globalAlpha = 1;
  }

  // Die Tageszeit über allem, dann die Lichter.
  function zeichneTageszeit() {
    const T = tageszeit();
    if (T.tint.some((v) => v < 250)) {
      g.globalCompositeOperation = "multiply";
      g.fillStyle = rgba(T.tint, 1);
      g.fillRect(0, 0, view.cssW, view.cssH);
      g.globalCompositeOperation = "source-over";
    }
    // Nachts: Fenster, Lampen, die Lichter rund ums Ziel.
    if (T.licht > 0.05 && kam.z < 2500) {
      const sCss = kam.F / kam.z;
      const x0 = kam.x - kam.vpX / sCss;
      const x1 = kam.x + (view.cssW - kam.vpX) / sCss;
      const y0 = kam.y - kam.vpY / sCss;
      const y1 = kam.y + (view.cssH - kam.vpY) / sCss;
      const gr = clamp(sCss * 6, 1.5, 14);
      for (const h of finde("haus", x0, y0, x1, y1)) {
        if (!h.licht) continue;
        const p = proj(h.x, h.y, 0);
        if (p) lichtPunkt(p.x, p.y, gr * 1.6, "warm", T.licht * 0.75);
      }
      for (const l of finde("lampe", x0, y0, x1, y1)) {
        const p = proj(l.x, l.y, 0);
        if (p) lichtPunkt(p.x, p.y, gr * 1.2, "warm", T.licht * 0.9);
      }
      const sp = state.sp;
      if (sp) {
        const tx = zielXJetzt();
        const r = (sp.deck || sp.r10) + 1.5;
        const pm = proj(tx, sp.y, 0);
        if (pm) lichtPunkt(pm.x, pm.y, Math.max(10, r * 1.5 * pm.k), "warm", T.licht * 0.55);
        for (let m = 0; m < 16; m += 1) {
          const a = (m / 16) * Math.PI * 2;
          const p = proj(tx + Math.cos(a) * r, sp.y + Math.sin(a) * r * (sp.deck ? 0.8 : 1), 0.3);
          if (p) lichtPunkt(p.x, p.y, Math.max(3, 0.9 * p.k), m % 2 ? "warm" : "gold", T.licht);
        }
      }
    }
    if (lichter.length) {
      g.globalCompositeOperation = "lighter";
      for (const l of lichter) {
        g.globalAlpha = clamp(l.a, 0, 1);
        const sprite = sprites.schein[l.art] || sprites.schein.weiss;
        g.drawImage(sprite, l.x - l.r, l.y - l.r, l.r * 2, l.r * 2);
      }
      g.globalAlpha = 1;
      g.globalCompositeOperation = "source-over";
      lichter.length = 0;
    }
  }

  // ---------------------------------------------------------------------------
  // Zeichnen: was über allem liegt
  // ---------------------------------------------------------------------------
  // Wo ein Hindernis sein wird, wenn man seine Höhe erreicht: ein
  // gestrichelter Umriss in der Ebene des Springers – rot, wenn es trifft.
  function zeichneWarnungen() {
    const sp = state.sp;
    const j = state.j;
    if (!sp || (state.schritt !== "frei" && state.schritt !== "auf" && state.schritt !== "schirm")) return;
    const pJ = proj(j.x, j.y, j.z);
    if (!pJ) return;
    const vz = Math.max(1, j.vz);
    const rJ = state.schritt === "frei" ? R_FREI : R_SCHIRM;
    for (const h of sp.hindernisse) {
      if (h.getroffen) continue;
      const lage = hindernisLage(h, state.ts);
      const oben = lage.z + h.dz;
      if (j.z < lage.z - h.dz) continue;
      const bis = Math.max(0, (j.z - oben) / Math.max(1, vz - (h.art === "schirm" ? V_ANDERER : 0)));
      if (bis > WARN_T) continue;
      const dann = hindernisLage(h, state.ts + bis);
      const trifft = Math.abs(j.x - dann.x) < h.r + rJ;
      const x = pJ.x + (dann.x - j.x) * pJ.k;
      const a = clamp(1 - bis / WARN_T, 0, 1);
      g.globalAlpha = (trifft ? 0.35 : 0.2) + a * (trifft ? 0.65 : 0.45);
      g.setLineDash([5, 6]);
      g.lineDashOffset = -state.echt * 30;
      g.strokeStyle = trifft ? "#ff4a3a" : "#ffffff";
      g.lineWidth = trifft ? 2.5 : 1.5;
      g.beginPath();
      g.ellipse(x, pJ.y, h.r * pJ.k, Math.min(h.r, 2.5) * pJ.k * 0.45 + 5, 0, 0, Math.PI * 2);
      g.stroke();
      g.setLineDash([]);
      if (trifft) {
        g.fillStyle = "rgba(255, 74, 58, 0.1)";
        g.fill();
      }
      g.globalAlpha = 1;
    }
  }

  // Der Ring zum Abfangen: Er zieht sich um den Schirm zusammen und trifft
  // den grünen Ring genau dann, wenn Abfangen butterweich wird.
  function zeichneAbfangRing() {
    const j = state.j;
    if (state.schritt !== "schirm" || state.flare || j.z > FLARE_BAND.butter[1] + 14) return;
    const pJ = proj(j.x, j.y, j.z);
    if (!pJ) return;
    const R = clamp(Math.min(view.cssW, view.hu) * 0.16, 44, 110);
    const mitte = (FLARE_BAND.butter[0] + FLARE_BAND.butter[1]) / 2;
    const proM = R * 0.09;
    const cy = pJ.y - 1.5 * pJ.k;
    const innen = R - (mitte - FLARE_BAND.butter[0]) * proM;
    const aussen = R + (FLARE_BAND.butter[1] - mitte) * proM;
    const da = j.z <= FLARE_BAND.butter[1] && j.z >= FLARE_BAND.butter[0];
    g.strokeStyle = da ? "rgba(90, 255, 140, 0.7)" : "rgba(90, 255, 140, 0.35)";
    g.lineWidth = aussen - innen;
    kreis(pJ.x, cy, (aussen + innen) / 2);
    g.stroke();
    const r = Math.max(4, R + (j.z - mitte) * proM);
    g.strokeStyle = da ? "#5aff8c" : "#ffffff";
    g.lineWidth = 3;
    kreis(pJ.x, cy, r);
    g.stroke();
    if (state.sprung <= 2) {
      g.font = `900 ${Math.round(clamp(R * 0.2, 12, 18))}px system-ui, sans-serif`;
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.lineWidth = 4;
      g.strokeStyle = "rgba(10, 20, 30, 0.6)";
      g.strokeText("Abfangen: wisch hoch!", pJ.x, cy + aussen + 16);
      g.fillStyle = "#ffffff";
      g.fillText("Abfangen: wisch hoch!", pJ.x, cy + aussen + 16);
    }
  }

  function schrift(text, farbe, gross, dauer = 1.4, dy = 0) {
    for (const alt of state.schriften) if (alt.leben > alt.max * 0.4 && Math.abs(alt.dy - dy) < 30) dy -= 30;
    state.schriften.push({ text, farbe, gross, leben: dauer, max: dauer, dy });
    if (state.schriften.length > 6) state.schriften.shift();
  }

  function zeichneSchriften() {
    if (!state.schriften.length) return;
    const j = state.j;
    const pJ = proj(j.x, j.y, Math.max(0, j.z)) || { x: view.cssW / 2, y: view.frei + view.hu * 0.4 };
    const oben = Math.min(pJ.y - 0.9 * pJ.k, state.schirmOben ?? Infinity) - 22;
    g.textAlign = "center";
    g.textBaseline = "middle";
    for (const s of state.schriften) {
      const k = clamp(s.leben / s.max, 0, 1);
      const alter = s.max - s.leben;
      const pop = alter < 0.16 && !ruhig() ? 0.6 + (alter / 0.16) * 0.4 + Math.sin((alter / 0.16) * Math.PI) * 0.25 : 1;
      const gross = Math.round(s.gross * clamp(view.hu / 700, 0.85, 1.5) * pop);
      const x = clamp(pJ.x, 90, view.cssW - 90);
      const y = Math.max(view.frei + gross + 40, oben + s.dy - (1 - k) * 26);
      g.globalAlpha = Math.min(1, k * 2.5);
      g.font = `900 ${gross}px system-ui, sans-serif`;
      g.lineWidth = Math.max(3, gross * 0.2);
      g.lineJoin = "round";
      g.strokeStyle = "rgba(15, 20, 35, 0.78)";
      g.strokeText(s.text, x, y);
      g.fillStyle = s.farbe;
      g.fillText(s.text, x, y);
    }
    g.globalAlpha = 1;
  }

  // Ein Band quer durchs Bild: welcher Sprung, wohin.
  function zeichneBanner() {
    const b = state.banner;
    if (!b) return;
    const k = clamp(b.leben / b.max, 0, 1);
    const ein = clamp((b.max - b.leben) / 0.25, 0, 1);
    const a = Math.min(ein, clamp(k * 3, 0, 1));
    if (a <= 0) return;
    const y = view.frei + view.hu * 0.2;
    const gross = Math.round(clamp(view.hu * 0.075, 24, 46));
    g.globalAlpha = a;
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.font = `900 ${gross}px system-ui, sans-serif`;
    g.lineWidth = Math.max(4, gross * 0.18);
    g.lineJoin = "round";
    g.strokeStyle = "rgba(15, 20, 35, 0.7)";
    const dx = (1 - ein) * -30;
    g.strokeText(b.titel, view.cssW / 2 + dx, y);
    g.fillStyle = "#ffffff";
    g.fillText(b.titel, view.cssW / 2 + dx, y);
    const klein = Math.round(gross * 0.42);
    g.font = `800 ${klein}px system-ui, sans-serif`;
    g.lineWidth = Math.max(3, klein * 0.25);
    g.strokeText(b.unter, view.cssW / 2 - dx, y + gross * 0.8);
    g.fillStyle = "#ffd27a";
    g.fillText(b.unter, view.cssW / 2 - dx, y + gross * 0.8);
    g.globalAlpha = 1;
  }

  // Oben links, unter den Knöpfen: die Punkte, darunter der Sprung und der
  // Wind. Rechts der Höhenmesser.
  function zeichneAnzeige() {
    if (state.phase === "bereit") return;
    flach();
    g.translate(0, view.frei);
    const gross = clamp(view.hu * 0.05, 14, 24);
    g.font = `900 ${Math.round(gross)}px system-ui, sans-serif`;
    g.textAlign = "left";
    g.textBaseline = "middle";
    const text = String(state.punkte);
    const x = 12;
    let y = 12;
    const w = g.measureText(text).width + gross * 2.1;
    const hoch = gross * 1.6;
    g.fillStyle = "rgba(14, 18, 30, 0.6)";
    g.beginPath();
    if (g.roundRect) g.roundRect(x, y, w, hoch, hoch / 2);
    else g.rect(x, y, w, hoch);
    g.fill();
    // Ein kleiner Schirm vor der Zahl.
    const sx = x + gross * 0.85;
    const sy = y + hoch / 2;
    g.fillStyle = "#ff8a2a";
    g.beginPath();
    g.ellipse(sx, sy - gross * 0.12, gross * 0.46, gross * 0.24, 0, Math.PI, 0);
    g.fill();
    g.strokeStyle = "#ffffff";
    g.lineWidth = 1.2;
    g.beginPath();
    g.moveTo(sx - gross * 0.4, sy - gross * 0.1);
    g.lineTo(sx, sy + gross * 0.32);
    g.lineTo(sx + gross * 0.4, sy - gross * 0.1);
    g.stroke();
    g.fillStyle = "#ffffff";
    g.fillText(text, x + gross * 1.5, sy + 1);
    y += hoch + 6;

    const klein = Math.round(gross * 0.62);
    g.font = `900 ${klein}px system-ui, sans-serif`;
    const pille = (inhalt, farbe, schrift) => {
      const pw = g.measureText(inhalt).width + klein * 1.4;
      const ph = klein * 1.7;
      g.fillStyle = farbe;
      g.beginPath();
      if (g.roundRect) g.roundRect(x, y, pw, ph, ph / 2);
      else g.rect(x, y, pw, ph);
      g.fill();
      g.fillStyle = schrift;
      g.fillText(inhalt, x + klein * 0.7, y + ph / 2 + 1);
      y += ph + 5;
    };
    if (state.sp) pille(`Sprung ${state.sprung} · ${ORTSNAME[state.sp.art]}`, "rgba(14, 18, 30, 0.55)", "#ffffff");
    const w2 = state.wind;
    const unter = state.schritt === "schirm" || state.schritt === "auf";
    if (unter && Math.abs(w2.x) > 0.3) {
      const pfeil = w2.x > 0 ? "→" : "←";
      pille(`Wind ${pfeil} ${Math.abs(w2.x).toFixed(1)} m/s`, "rgba(14, 18, 30, 0.55)", "#cfe6ff");
    }
    if (w2.warn > 0 || w2.boe > 0.15) {
      const blink = w2.warn > 0 && Math.sin(state.echt * 14) < 0 ? 0.55 : 0.95;
      pille(w2.dir > 0 ? "Böe  →" : "←  Böe", `rgba(255, 255, 255, ${blink})`, "#1b2a44");
    }
    g.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
    zeichneHoehenmesser();
  }

  // Der Höhenmesser: eine runde Uhr. Im Fall zeigt sie die ganze Höhe mit
  // der Mindesthöhe als rotem Feld und dem Feld der vielen Punkte darüber;
  // unter dem Schirm die Höhe bis zum Boden. Die Skala ist unten gestreckt –
  // dort, wo es darauf ankommt.
  function zeichneHoehenmesser() {
    const sp = state.sp;
    if (!sp) return;
    const j = state.j;
    const sch = state.schritt;
    const R = clamp(Math.min(view.cssW, view.hu) * 0.115, 30, 64);
    const cx = view.cssW - R - 12;
    const cy = clamp(view.frei + view.hu * FIGUR_FREI, view.frei + R + 60, view.cssH - R - 100);
    const imFall = sch === "flugzeug" || sch === "frei" || (sch === "reserve" && j.auf < 0.3);
    const H = imFall ? H_AB : Math.max(60, state.hSkala || 60);
    const winkel = (h) => -Math.PI / 2 + (1 - Math.sqrt(clamp(h / H, 0, 1))) * Math.PI * 2 * 0.92;
    g.fillStyle = "rgba(14, 18, 30, 0.62)";
    kreis(cx, cy, R);
    g.fill();
    g.strokeStyle = "rgba(255, 255, 255, 0.55)";
    g.lineWidth = 1.5;
    g.stroke();
    const bogen = (h0, h1, farbe, dicke) => {
      g.strokeStyle = farbe;
      g.lineWidth = dicke;
      g.beginPath();
      g.arc(cx, cy, R - dicke / 2 - 3, winkel(h1), winkel(h0));
      g.stroke();
    };
    if (imFall) {
      // Das Feld der Punkte über der Mindesthöhe, nach oben verblassend.
      for (let m = 0; m < 6; m += 1) {
        const h0 = sp.hMin + m * sp.tau * 0.5;
        const a = Math.exp(-(m * 0.5 + 0.25));
        bogen(h0, h0 + sp.tau * 0.5, `rgba(255, ${170 + m * 12}, 50, ${a})`, R * 0.2);
      }
      bogen(0, sp.hMin, "#ff3b30", R * 0.2);
    } else {
      bogen(FLARE_BAND.weich[0], FLARE_BAND.weich[1], "rgba(90, 255, 140, 0.4)", R * 0.2);
      bogen(FLARE_BAND.butter[0], FLARE_BAND.butter[1], "#5aff8c", R * 0.2);
    }
    // Striche.
    g.strokeStyle = "rgba(255, 255, 255, 0.6)";
    g.lineWidth = 1;
    g.beginPath();
    const marken = imFall ? [0, 100, 200, 300, 500, 700, 900] : [0, 10, 20, 50, 100, 200];
    for (const h of marken) {
      if (h > H) continue;
      const a = winkel(h);
      g.moveTo(cx + Math.cos(a) * (R - 3), cy + Math.sin(a) * (R - 3));
      g.lineTo(cx + Math.cos(a) * (R - 9), cy + Math.sin(a) * (R - 9));
    }
    g.stroke();
    // Der Zeiger.
    const a = winkel(Math.max(0, j.z));
    g.strokeStyle = "#ffffff";
    g.lineWidth = 3;
    g.lineCap = "round";
    g.beginPath();
    g.moveTo(cx - Math.cos(a) * R * 0.15, cy - Math.sin(a) * R * 0.15);
    g.lineTo(cx + Math.cos(a) * (R - 6), cy + Math.sin(a) * (R - 6));
    g.stroke();
    // Die Höhe als Zahl.
    const zahl = Math.max(0, Math.round(j.z));
    const rot = imFall && j.z < sp.hMin;
    g.font = `900 ${Math.round(R * 0.42)}px system-ui, sans-serif`;
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillStyle = "rgba(14, 18, 30, 0.75)";
    kreis(cx, cy, R * 0.36);
    g.fill();
    g.fillStyle = rot ? "#ff6a5a" : "#ffffff";
    g.fillText(String(zahl), cx, cy + 1);
    g.font = `800 ${Math.round(R * 0.2)}px system-ui, sans-serif`;
    g.fillStyle = "rgba(255, 255, 255, 0.7)";
    g.fillText("m", cx, cy + R * 0.52);
  }

  function zeichnen() {
    if (!g) return;
    bildNr += 1;
    baueSprites();
    zeichneBoden();
    flach();
    zeichneWolkenSchatten();
    zeichneZielplatz();
    zeichneSpringerSchatten();
    zeichneDunst();
    // Alles in der Luft, von hinten nach vorn.
    const liste = [];
    zeichneWolken(liste);
    zeichneHindernisse(liste);
    zeichneGeister(liste);
    if (state.flugzeug) {
      const f = state.flugzeug;
      const p = proj(f.x, f.y, f.z, 3);
      if (p) liste.push({ d: p.d, malen: () => {
        maleFlugzeug(p, p.k, tageszeit().licht);
        if (state.schritt === "flugzeug") {
          // Er sitzt in der Tür, bereit.
          g.save();
          g.translate(p.x + 1.15 * p.k, p.y + 1.75 * p.k);
          g.rotate(Math.PI / 2 + Math.sin(state.echt * 2) * 0.05);
          g.scale(p.k * 0.85, p.k * 0.85);
          koerperHaengt(0);
          g.restore();
        }
      } });
    }
    zeichneSpringer(liste);
    liste.push({ d: kam.D + 6, malen: zeichneStriche });
    liste.sort((a, b) => b.d - a.d);
    for (const o of liste) o.malen();
    zeichneTeile();
    zeichneTageszeit();
    if (geisterNamen.length) {
      window.LernappGeist?.namen?.(g, geisterNamen, { breit: view.cssW, hoch: view.cssH });
      geisterNamen = [];
    }
    if (state.weiss > 0.01) {
      const T = tageszeit();
      const nebel = [lerp(250, T.dunst[0], T.licht), lerp(252, T.dunst[1], T.licht), lerp(255, T.dunst[2] + 30, T.licht)].map(Math.round);
      g.fillStyle = rgba(nebel, state.weiss * (ruhig() ? 0.5 : 0.85));
      g.fillRect(0, 0, view.cssW, view.cssH);
    }
    if (state.blitz > 0.01 && !ruhig()) {
      g.fillStyle = `rgba(255, 250, 235, ${state.blitz * 0.3})`;
      g.fillRect(0, 0, view.cssW, view.cssH);
    }
    zeichneWarnungen();
    zeichneAbfangRing();
    zeichneSchriften();
    zeichneAnzeige();
    flach();
    zeichneBanner();
  }

  // ---------------------------------------------------------------------------
  // Teilchen
  // ---------------------------------------------------------------------------
  const TEILE_MAX = 220;

  function teil(t) {
    if (state.teile.length >= TEILE_MAX) state.teile.shift();
    state.teile.push(t);
  }

  function staub(x, y, anzahl, farben = ["#d9c9a0", "#bfa877", "#e8dcc0"]) {
    if (ruhig()) anzahl = Math.ceil(anzahl / 3);
    for (let i = 0; i < anzahl; i += 1) {
      const w = Math.random() * Math.PI * 2;
      const v = 1.5 + Math.random() * 4;
      teil({ art: "staub", x: x + (Math.random() - 0.5) * 1.5, y: y + (Math.random() - 0.5) * 1.5, z: 0.2,
        vx: Math.cos(w) * v, vy: Math.sin(w) * v, vz: 0.5 + Math.random() * 1.5, r: 0.35 + Math.random() * 0.4,
        farbe: farben[i % farben.length], leben: 0.8 + Math.random() * 0.6, max: 1.4, dreh: 0 });
    }
  }

  function spritzer(x, y, anzahl) {
    if (ruhig()) anzahl = Math.ceil(anzahl / 3);
    for (let i = 0; i < anzahl; i += 1) {
      const w = Math.random() * Math.PI * 2;
      const v = 1 + Math.random() * 4;
      teil({ art: "tropfen", x, y, z: 0.3, vx: Math.cos(w) * v, vy: Math.sin(w) * v, vz: 3 + Math.random() * 6,
        r: 0.12 + Math.random() * 0.12, farbe: i % 3 ? "#d9f0ff" : "#ffffff", leben: 0.9, max: 0.9, dreh: 0, schwer: true });
    }
  }

  function blaetter(x, y, z, anzahl) {
    if (ruhig()) anzahl = Math.ceil(anzahl / 3);
    const farben = ["#4b8a40", "#6aa84c", "#3f7a3a", "#9bbf3f"];
    for (let i = 0; i < anzahl; i += 1) {
      teil({ art: "blatt", x, y, z, vx: (Math.random() - 0.5) * 6, vy: (Math.random() - 0.5) * 6, vz: Math.random() * 3,
        r: 0.18 + Math.random() * 0.1, farbe: farben[i % farben.length], leben: 1.6, max: 1.6, dreh: Math.random() * 6, schweben: true });
    }
  }

  function konfetti(x, y, anzahl) {
    if (ruhig()) anzahl = Math.ceil(anzahl / 3);
    const farben = ["#ffd23f", "#ff5e5b", "#3bc9db", "#a9e34b", "#ffffff", "#ff922b"];
    for (let i = 0; i < anzahl; i += 1) {
      const w = Math.random() * Math.PI * 2;
      teil({ art: "konfetti", x, y, z: 0.5, vx: Math.cos(w) * (1 + Math.random() * 3), vy: Math.sin(w) * (1 + Math.random() * 3),
        vz: 4 + Math.random() * 5, r: 0.12 + Math.random() * 0.08, farbe: farben[i % farben.length], leben: 1.8, max: 1.8, dreh: Math.random() * 6, schweben: true });
    }
  }

  function federn(x, y, z, anzahl) {
    for (let i = 0; i < (ruhig() ? 3 : anzahl); i += 1) {
      teil({ art: "blatt", x, y, z, vx: (Math.random() - 0.5) * 8, vy: (Math.random() - 0.5) * 8, vz: (Math.random() - 0.5) * 6,
        r: 0.15, farbe: i % 2 ? "#e6e9f0" : "#6e6660", leben: 1.4, max: 1.4, dreh: Math.random() * 6, schweben: true });
    }
  }

  // ---------------------------------------------------------------------------
  // Der Sprung
  // ---------------------------------------------------------------------------
  // Ein neuer Sprung beginnt im Flugzeug: Es fliegt von Süden heran, bis die
  // Tür über der Reihe des Ziels ist – dann springt er. Beim ersten Sprung
  // wartet es dort, bis jemand tippt.
  function sprungBeginnen(n, ersterSprung = false) {
    const sp = sprungDaten(n);
    state.sp = sp;
    state.sprung = n;
    state.tag = tagBei(n);
    state.schritt = "flugzeug";
    state.t = 0;
    state.ts = 0;
    state.tSchirm = -1;
    state.hSkala = 60;
    state.zug = null;
    state.flare = null;
    state.landung = null;
    state.sprungPunkte = 0;
    state.aktion = false;
    sp.hindernisse.forEach((h) => { h.getroffen = false; });
    state.wind = { x: windHoehe(sp.wind, H_AB) * 0.25, boe: 0, warn: 0, dir: Math.sign(sp.wind) || 1 };
    state.wolken = wolkenFuer(sp);
    const j = neuerSpringer();
    j.x = sp.x0 + sp.ab;
    j.y = sp.y;
    j.z = H_AB;
    state.j = j;
    state.flugzeug = { x: j.x - 1.15, y: sp.y - 1.75 + (ersterSprung ? 0 : 45 * T_INTRO), z: H_AB, vy: ersterSprung ? 0 : -45 };
    j.y = state.flugzeug.y + 1.75;
    state.striche = [];
    for (let m = 0; m < 26; m += 1) state.striche.push({ x: j.x + (Math.random() - 0.5) * 26, y: j.y + (Math.random() - 0.5) * 26, z: j.z - Math.random() * 45, l: 0.5 + Math.random() });
    if (!ersterSprung) {
      state.weiss = 1;
      state.banner = { titel: `Sprung ${n}`, unter: `${ORTSNAME[sp.art]} · mindestens ${sp.hMin} m`, leben: 2.3, max: 2.3 };
    }
    state.teile = state.teile.filter((t) => t.art === "konfetti");
    kameraFolgt(0, true);
    // Was das Bild beim Absprung braucht, schon jetzt malen lassen.
    const sCss = kam.F / (H_AB + D_FLUGZEUG);
    const L = stufeFuer(sCss);
    vorgemerkt = [];
    const breit = view.cssW / sCss / 2 + 50;
    const hoch = view.cssH / sCss;
    vormerken(j.x - breit, j.y - hoch, j.x + breit, j.y + hoch * 0.6, L);
    vormerken(j.x - breit * 0.5, j.y - hoch * 0.4, j.x + breit * 0.5, j.y + hoch * 0.3, Math.min(L_MAX, L + 1));
  }

  function absprung() {
    const j = state.j;
    const f = state.flugzeug;
    state.schritt = "frei";
    state.t = 0;
    state.ts = 0;
    j.x = f.x + 1.15;
    j.y = state.sp.y;
    j.z = H_AB;
    j.vz = V_ABSPRUNG;
    j.vx = 0;
    f.vy = -45;
    if (state.sprung === 1) state.banner = { titel: "Sprung 1", unter: `${ORTSNAME[state.sp.art]} · mindestens ${state.sp.hMin} m`, leben: 2.1, max: 2.1 };
    kids()?.vibrate?.(8);
  }

  // Ziehen: über der Mindesthöhe öffnet der Schirm, und es gibt Punkte – je
  // tiefer, desto mehr. Darunter ist es zu spät.
  function ziehen() {
    const sp = state.sp;
    const j = state.j;
    if (j.z < sp.hMin) {
      automat("Zu tief gezogen!");
      return;
    }
    const punkte = Math.round(ZUG_MAX * Math.exp(-(j.z - sp.hMin) / sp.tau));
    state.zug = { z: j.z, punkte };
    state.punkte += punkte;
    state.sprungPunkte += punkte;
    shell.setCount(state.punkte);
    oeffnenZeigen(punkte);
    state.schritt = "auf";
    state.t = 0;
    state.vAuf = j.vz;
    kids()?.vibrate?.([20, 30, 40]);
  }

  function oeffnenZeigen(punkte) {
    state.stoss = 0.9;
    if (!ruhig()) state.lupe = 0.35;
    const gut = punkte >= 70;
    schrift(punkte >= 95 ? `Perfekt! +${punkte}` : `Schirm auf! +${punkte}`, gut ? "#ffd23f" : "#ffffff", gut ? 26 : 21, 1.6);
    // Der Ruck des Schirms – und nach ihm die Harfe, wenn es perfekt war.
    fahrtwind.aus();
    ton("fallschirm.schirm");
    perfektTon(punkte >= 95, { laut: 0.9, verzoegerung: 0.3 });
  }

  // Abfangen: einmal je Sprung, kurz vor dem Boden.
  function abfangen() {
    if (state.flare || state.schritt !== "schirm") return;
    state.flare = { t0: state.tSchirm, v0: state.j.vz };
    kids()?.vibrate?.(10);
  }

  // Etwas ging schief: Die Reserve geht von selbst auf.
  function automat(grund, trudeln = false) {
    const j = state.j;
    state.schritt = "reserve";
    state.t = 0;
    state.grund = grund;
    j.auf = 0;
    if (trudeln) j.trudelW = (Math.random() < 0.5 ? -1 : 1) * 9;
    fehlerZeigen("reserve", grund);
  }

  function fehlerZeigen(art, grund) {
    state.stoss = 1;
    state.blitz = 0.6;
    if (!ruhig()) state.lupe = 0.25;
    schrift(grund, "#ff9a7a", 26, 1.8);
    const j = state.j;
    if (art === "platsch") spritzer(j.x, j.y, 34);
    if (art === "baum") blaetter(j.x, j.y, 7, 26);
    if (art === "dach") staub(j.x, j.y, 14, ["#c4553d", "#9d3f2c", "#e8dcc0"]);
    // Die Runde ist vorbei: Die Reserve geht mit einem Ruck auf, auf Baum und
    // Dach schlägt er auf – und dazu der Fehler.
    klangAus();
    perfektTon(false);
    if (art === "reserve") ton("fallschirm.schirm", { laut: 0.8 });
    else if (art !== "platsch") ton("fallschirm.landung", { laut: 1.1 });
    ton("fehler", { verzoegerung: 0.2 }, 300);
    if (state.phase !== "zuschauen") kids()?.vibrate?.([30, 40, 60]);
  }

  // Ein Hindernis getroffen: Federn, Funken – und er trudelt.
  function treffer(h) {
    h.getroffen = true;
    const j = state.j;
    if (h.art === "voegel") federn(j.x, j.y, j.z, 18);
    const grund = { voegel: "Vogelschwarm!", ballon: "Gegen den Ballon!", gewitter: "Blitz!", segler: "Gegen den Segler!", schirm: "In einen Schirm!" }[h.art];
    automat(grund, true);
  }

  function kollision() {
    const j = state.j;
    const sp = state.sp;
    const rJ = lerp(R_FREI, R_SCHIRM, clamp(j.auf, 0, 1));
    const oben = j.auf > 0.4 ? 3 : 0;
    for (const h of sp.hindernisse) {
      if (h.getroffen) continue;
      const lage = hindernisLage(h, state.ts);
      if (j.z + oben < lage.z - h.dz || j.z > lage.z + h.dz) continue;
      if (Math.abs(j.x - lage.x) < h.r + rJ) {
        treffer(h);
        return;
      }
    }
  }

  // Aufsetzen: Wo – im Ring, daneben, im Wasser, im Baum, auf dem Dach? Und
  // wie weich?
  function landen() {
    const sp = state.sp;
    const j = state.j;
    j.z = 0;
    const tx = zielXJetzt();
    const dx = j.x - tx;
    const grund = sp.deck && Math.abs(dx) <= sp.deck ? "boden" : untergrund(j.x, j.y);
    if (grund !== "boden") {
      const art = grund === "wasser" ? "platsch" : grund;
      state.schritt = art;
      state.t = 0;
      state.grund = grund === "wasser" ? "Ins Wasser!" : grund === "baum" ? "Im Baum gelandet!" : "Auf dem Dach gelandet!";
      j.ablage = 0;
      fehlerZeigen(art, state.grund);
      return;
    }
    const a = Math.abs(dx);
    const ring = a <= sp.r50 ? 50 : a <= sp.r25 ? 25 : a <= sp.r10 ? 10 : 0;
    const flare = j.vz < WEICH ? 25 : j.vz < HART ? 10 : -10;
    const dazu = Math.max(-(state.zug?.punkte || 0), ring + flare);
    state.punkte += dazu;
    state.sprungPunkte += dazu;
    shell.setCount(state.punkte);
    state.landung = { dx, ring, flare, vz: j.vz };
    state.serie.push({ zug: state.zug?.punkte || 0, ring, flare, summe: state.sprungPunkte });
    state.schritt = "gelandet";
    state.t = 0;
    landungZeigen(ring, flare);
  }

  function landungZeigen(ring, flare) {
    const j = state.j;
    j.ablage = (Math.sign(state.wind.x) || 1) * 2.2;
    staub(j.x, j.y, flare < 0 ? 26 : 14);
    if (ring === 50) konfetti(j.x, j.y, 46);
    if (ring > 0) state.jubel = state.echt;
    state.stoss = flare < 0 ? 0.7 : 0.25;
    schrift(ring === 50 ? "Mitte! +50" : ring ? `Ring +${ring}` : "Daneben", ring === 50 ? "#ffd23f" : ring ? "#ffffff" : "#cfd8e3", ring === 50 ? 28 : 22, 1.7, 0);
    schrift(flare === 25 ? "Butterweich +25" : flare === 10 ? "Weich +10" : "Hart −10", flare === 25 ? "#7dff9e" : flare === 10 ? "#c7f7d2" : "#ff9a7a", 19, 1.7, 34);
    // Aufsetzen: weich oder hart. Dazu, was der Ring bringt – die Mitte ist
    // perfekt.
    ton("fallschirm.landung", { laut: flare === 25 ? 0.7 : flare === 10 ? 0.9 : 1.2 });
    perfektTon(ring === 50, { laut: 0.9 });
    if (ring > 0 && ring < 50) ton("punkt", {}, 100);
    if (state.phase !== "zuschauen") kids()?.vibrate?.(flare < 0 ? [30, 20, 30] : 14);
  }

  // Der Wind unter dem Schirm: unten schwach, oben stärker, dazu Böen, die
  // sich kurz vorher ankündigen (der Windsack dreht, oben blinkt «Böe»).
  function windLage() {
    const sp = state.sp;
    const w = state.wind;
    const j = state.j;
    let boe = 0;
    let warn = 0;
    if (state.tSchirm >= 0) {
      for (const b of sp.boeen) {
        const t = state.tSchirm - b.t;
        if (t < -0.8 || t > b.dauer) continue;
        w.dir = b.dir;
        if (t < 0) warn = Math.max(warn, 1 + t / 0.8);
        else {
          const s = Math.sin((Math.PI * t) / b.dauer);
          boe += b.dir * b.staerke * s * s;
        }
      }
    }
    w.boe = Math.abs(boe);
    w.warn = warn;
    w.x = windHoehe(sp.wind, Math.max(0, j.z)) + boe;
  }

  // Ein Rechenschritt.
  function schrittRechnen(h) {
    const j = state.j;
    const sp = state.sp;
    const sch = state.schritt;
    state.t += h;
    if (sch !== "flugzeug") state.ts += h;
    const f = state.flugzeug;
    if (f) {
      f.y += f.vy * h;
      if (sch === "flugzeug") {
        j.x = f.x + 1.15;
        j.y = f.y + 1.75;
      } else if (state.ts > 4) state.flugzeug = null;
    }
    const lenk = state.lenkung;
    j.neig += (lenk - j.neig) * (1 - Math.exp(-h / 0.16));
    if (sch === "flugzeug") {
      if (state.phase === "spiel" && state.t >= T_INTRO) absprung();
      else if (state.aktion && state.phase === "bereit" && !shell.live) losGehts();
    } else if (sch === "frei") {
      j.vz += G_FALL * (1 - (j.vz / sp.v) ** 2) * h;
      j.z -= j.vz * h;
      const zielVx = lenk * V_QUER_FREI + windHoehe(sp.wind, j.z) * WIND_FREI;
      j.vx += (zielVx - j.vx) * (1 - Math.exp(-h / TAU_QUER_FREI));
      j.x += j.vx * h;
      j.w += (-lenk * 0.38 + Math.sin(state.zeit * 1.3) * 0.04 - j.w) * (1 - Math.exp(-h / 0.2));
      state.wind.x = windHoehe(sp.wind, j.z) * WIND_FREI;
      kollision();
      if (state.schritt === "frei") {
        if (state.aktion && state.ts > 0.6) ziehen();
        else if (j.z < sp.hMin - 10) automat("Nicht gezogen!");
      }
    } else if (sch === "auf") {
      j.auf = clamp(state.t / T_AUF, 0, 1);
      const v = sinkBei(j.z);
      j.vz = v + (state.vAuf - v) * Math.exp(-state.t / TAU_AUF);
      j.z -= j.vz * h;
      windLage();
      const zielVx = lenk * V_QUER * 0.5 + state.wind.x * j.auf;
      j.vx += (zielVx - j.vx) * (1 - Math.exp(-h / 0.3));
      j.x += j.vx * h;
      j.w += (-lenk * 0.2 - j.w) * (1 - Math.exp(-h / 0.3));
      kollision();
      if (state.schritt === "auf") {
        if (j.z <= 0) landen();
        else if (state.t >= T_AUF) {
          state.schritt = "schirm";
          state.t = 0;
          state.tSchirm = 0;
          state.hSkala = Math.ceil(j.z / 10) * 10;
          j.auf = 1;
        }
      }
    } else if (sch === "schirm") {
      state.tSchirm += h;
      windLage();
      if (state.aktion) abfangen();
      const v = sinkBei(j.z);
      if (state.flare) j.vz = flareSinken(state.tSchirm - state.flare.t0, state.flare.v0);
      else j.vz += (v - j.vz) * (1 - Math.exp(-h / 0.4));
      const bremse = state.flare && state.tSchirm - state.flare.t0 < FLARE_HALT ? 0.5 : 1;
      const zielVx = lenk * V_QUER * bremse + state.wind.x;
      j.vx += (zielVx - j.vx) * (1 - Math.exp(-h / TAU_QUER));
      j.x += j.vx * h;
      j.z -= j.vz * h;
      j.w += (lenk * 0.5 - j.w) * (1 - Math.exp(-h / 0.3));
      kollision();
      if (state.schritt === "schirm" && j.z <= 0) landen();
    } else if (sch === "reserve") {
      j.reserve = clamp(j.reserve + h / 0.5, 0, 1);
      const v = j.reserve > 0.3 ? V_RESERVE : j.vz;
      j.vz += (v - j.vz) * (1 - Math.exp(-h / 0.2));
      j.trudelW = (j.trudelW || 0) * Math.exp(-h / 0.8);
      j.trudel += j.trudelW * h;
      if (j.z > 0) {
        j.z = Math.max(0, j.z - j.vz * h);
        j.x += windHoehe(sp.wind, j.z) * 0.6 * h;
        if (j.z === 0) {
          staub(j.x, j.y, 16);
          state.stoss = 0.6;
        }
      }
      if (state.phase === "spiel" && state.t >= T_FEHLER) finish();
    } else if (FEHLER.has(sch)) {
      if (state.phase === "spiel" && state.t >= T_FEHLER) finish();
    } else if (sch === "gelandet") {
      if (sp.deck && state.landung) j.x = zielXJetzt() + state.landung.dx;
      if (state.phase === "spiel" && state.t >= T_GELANDET) sprungBeginnen(state.sprung + 1);
    }
    state.aktion = false;
  }

  // c: Sprung, Teil des Sprungs und Winkel in einer ganzen Zahl.
  function cKodieren() {
    const j = state.j;
    let teilNr = TEILE.indexOf(state.schritt);
    if (state.schritt === "schirm" && state.flare) teilNr = 9;
    const winkel = state.schritt === "frei" ? j.w + j.trudel : state.schritt === "schirm" || state.schritt === "auf" ? j.neig * 0.5 : 0;
    return state.sprung * 10000 + teilNr * 1000 + clamp(Math.round(winkel * 100), -400, 400) + 500;
  }

  function cLesen(c) {
    const sprung = Math.floor(c / 10000);
    const rest = c - sprung * 10000;
    const teilNr = Math.floor(rest / 1000);
    return { sprung, teil: teilNr, winkel: (rest - teilNr * 1000 - 500) / 100 };
  }

  function effekteTakt(dt) {
    const j = state.j;
    if (state.stoss > 0) state.stoss = Math.max(0, state.stoss - dt * 2.4);
    if (state.blitz > 0) state.blitz = Math.max(0, state.blitz - dt * 3);
    // Durch eine Wolke: alles weiss.
    let weiss = 0;
    for (const w of state.wolken) {
      if (Math.abs(kam.z - w.z) < 12 && Math.abs(kam.x - w.x) < w.w * 0.3 && Math.abs(kam.y - w.y) < w.w * 0.22) weiss = 0.42;
    }
    if (weiss > state.weiss) state.weiss += (weiss - state.weiss) * (1 - Math.exp(-dt / 0.05));
    else state.weiss += (weiss - state.weiss) * (1 - Math.exp(-dt / 0.18));
    // Blitze nahe an einer Gewitterwolke.
    const sp = state.sp;
    if (sp && !ruhig()) {
      for (const h of sp.hindernisse) {
        if (h.art !== "gewitter") continue;
        const nah = clamp(1 - Math.abs(j.z - h.z) / 160, 0, 1);
        const takt = (state.echt * 1.15 + (h.saat % 7) * 0.13) % 1;
        if (nah > 0 && takt < 0.05) state.blitz = Math.max(state.blitz, nah * 0.7);
      }
    }
    // Fahrtwind: Luft, an der er vorbeifällt.
    for (const s of state.striche) {
      s.x += (state.wind.x - (state.schritt === "schirm" ? j.vx : 0)) * dt * 0.3;
      if (s.z > kam.z - 1.5 || s.z < j.z - 50 || Math.abs(s.x - j.x) > 18) {
        s.x = j.x + (Math.random() - 0.5) * 26;
        s.y = j.y + (Math.random() - 0.5) * 30;
        s.z = j.z - 12 - Math.random() * 36;
        s.l = 0.5 + Math.random();
      }
    }
    for (let i = state.teile.length - 1; i >= 0; i -= 1) {
      const t = state.teile[i];
      if (t.schwer) t.vz -= 14 * dt;
      else if (t.schweben) { t.vz = Math.max(t.vz - 4 * dt, -1.6); t.vx += Math.sin(t.leben * 5) * 3 * dt; }
      else t.vz -= 1.5 * dt;
      t.vx *= 1 - 1.4 * dt;
      t.vy *= 1 - 1.4 * dt;
      t.x += t.vx * dt;
      t.y += t.vy * dt;
      t.z = Math.max(0.05, t.z + t.vz * dt);
      t.dreh += dt * 5;
      t.leben -= dt;
      if (t.leben <= 0) state.teile.splice(i, 1);
    }
    for (let i = state.schriften.length - 1; i >= 0; i -= 1) {
      state.schriften[i].leben -= dt;
      if (state.schriften[i].leben <= 0) state.schriften.splice(i, 1);
    }
    if (state.banner) {
      state.banner.leben -= dt;
      if (state.banner.leben <= 0) state.banner = null;
    }
  }

  function takt(dt) {
    state.echt += dt;
    if (state.lupe > 0) {
      state.lupe -= dt;
      dt *= 0.3;
    }
    state.zeit += dt;
    if (state.phase === "zuschauen") {
      zuschauenTakt(dt);
    } else {
      state.rest += dt;
      while (state.rest > TAKT * 0.999) {
        schrittRechnen(TAKT);
        state.rest -= TAKT;
      }
    }
    effekteTakt(dt);
    kameraFolgt(dt);
    klangTakt();
    const bald = state.phase === "spiel" && state.sp && ((state.schritt === "frei" && state.j.z < state.sp.hMin + 2.5 * state.sp.tau)
      || (state.schritt === "schirm" && !state.flare && state.j.z < FLARE_BAND.butter[1] + 14));
    if (knoepfe && bald !== wischBald) {
      wischBald = bald;
      knoepfe.querySelector(".fs-wisch")?.classList.toggle("ist-bald", bald);
    }
    if (state.phase === "spiel" && state.sp) {
      gegner?.takt(state.punkte, { a: Math.round((state.j.x - state.sp.x0) * 10), b: Math.round(Math.max(0, state.j.z) * 10), c: cKodieren() });
    }
  }

  function loop(now) {
    frame = window.requestAnimationFrame(loop);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    uhr = now / 1000;
    messen();
    if (!angehalten) takt(dt);
    const t0 = performance.now();
    zeichnen();
    const t1 = performance.now();
    kachelnMalen(ersteBilder > 0 ? 30 : BUDGET_MS);
    if (ersteBilder > 0) ersteBilder -= 1;
    // Wie lange ein Bild braucht – für die Prüfung der Bildrate.
    leistung.bilder += 1;
    leistung.zeichnen += t1 - t0;
    leistung.kacheln += performance.now() - t1;
  }
  let ersteBilder = 0;
  let wischBald = false;
  // Für das Standbild der Startseite: die Welt bleibt stehen, gemalt wird weiter.
  let angehalten = false;

  // ---------------------------------------------------------------------------
  // Zuschauen
  // ---------------------------------------------------------------------------
  // Eine aufgezeichnete Runde mit ihrem eigenen Plan: Der Zufall hält die
  // Saat (geist.js, zuschauer), startRun würfelt damit dieselben Sprünge, und
  // der Springer steht Bild für Bild dort, wo er damals war. Aus c kommen
  // Sprung und Teil des Sprungs: Damit beginnt jeder Sprung zur selben Zeit,
  // der Schirm geht auf, er landet – mit allem, was dazugehört.
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
    const lage = cLesen(Math.round(s.c || 0));
    const n = Math.max(1, lage.sprung || 1);
    if (n !== state.sprung) sprungBeginnen(n, n === 1);
    const j = state.j;
    const sp = state.sp;
    const neu = TEILE[lage.teil === 9 ? 3 : lage.teil] || "flugzeug";
    state.t += dt;
    if (state.schritt !== "flugzeug") state.ts += dt;
    if (state.flugzeug) {
      state.flugzeug.y += state.flugzeug.vy * dt;
      if (state.ts > 4) state.flugzeug = null;
    }
    if (neu !== state.schritt) {
      const alt = state.schritt;
      state.schritt = neu;
      state.t = 0;
      if (neu === "frei") { state.ts = 0; if (state.flugzeug) state.flugzeug.vy = -45; j.auf = 0; }
      if (neu === "auf") { j.auf = 0; oeffnenZeigen(Math.max(0, Math.floor(s.punkte) - state.punkte)); }
      if (neu === "schirm") { j.auf = 1; state.tSchirm = 0; state.hSkala = Math.ceil(Math.max(1, s.b / 10) / 10) * 10; }
      if (neu === "gelandet") {
        const dx = sp.x0 + s.a / 10 - zielXJetzt();
        const a = Math.abs(dx);
        state.landung = { dx, ring: a <= sp.r50 ? 50 : a <= sp.r25 ? 25 : a <= sp.r10 ? 10 : 0 };
        j.z = 0;
        landungZeigen(state.landung.ring, Math.abs(s.vb || 0) / 10 < WEICH ? 25 : Math.abs(s.vb || 0) / 10 < HART ? 10 : -10);
      }
      if (FEHLER.has(neu)) {
        const grund = neu === "platsch" ? "Ins Wasser!" : neu === "baum" ? "Im Baum gelandet!" : neu === "dach" ? "Auf dem Dach gelandet!"
          : alt === "frei" && j.z < sp.hMin - 9 ? "Nicht gezogen!" : alt === "frei" && j.z < sp.hMin ? "Zu tief gezogen!" : "Getroffen!";
        j.auf = neu === "reserve" ? 0 : 1;
        fehlerZeigen(neu, grund);
      }
    }
    if (neu === "auf") j.auf = clamp(j.auf + dt / T_AUF, 0, 1);
    if (neu === "schirm") {
      state.tSchirm += dt;
      if (lage.teil === 9 && !state.flare) state.flare = { t0: state.tSchirm, v0: V_SINK };
    }
    if (neu === "reserve") j.reserve = clamp(j.reserve + dt / 0.5, 0, 1);
    if (neu !== "flugzeug") {
      j.x = sp.x0 + s.a / 10;
      j.z = Math.max(0, s.b / 10);
      j.vx = (s.va || 0) / 10;
      j.vz = Math.max(0, -(s.vb || 0) / 10);
    } else if (state.flugzeug) {
      j.x = state.flugzeug.x + 1.15;
      j.y = state.flugzeug.y + 1.75;
    }
    if (neu === "frei") j.w = lage.winkel;
    else j.neig = clamp(lage.winkel * 2, -1, 1);
    if (neu === "schirm" || neu === "auf") windLage();
    const punkte = Math.max(0, Math.floor(s.punkte));
    if (punkte !== state.punkte) {
      state.punkte = punkte;
      shell.setCount(punkte);
    }
    zuschauer.weiter?.();
  }

  // ---------------------------------------------------------------------------
  // Eingabe
  // ---------------------------------------------------------------------------
  // Die linke Hälfte des Bildes lenkt nach links, die rechte nach rechts –
  // jeder Finger für sich, der letzte gilt. Wer einen Finger rasch nach oben
  // wischt, zieht (oder fängt ab); dieser Finger lenkt dann nicht mehr.
  const WISCH_PX = 26;
  const WISCH_MS = 450;
  const finger = [];

  function lenkeNeu() {
    const aktiv = finger.filter((f) => !f.wisch);
    state.lenkung = aktiv.length ? aktiv[aktiv.length - 1].r : 0;
    knoepfe?.querySelector(".fs-knopf-l")?.classList.toggle("ist-an", state.lenkung < 0);
    knoepfe?.querySelector(".fs-knopf-r")?.classList.toggle("ist-an", state.lenkung > 0);
  }

  function fingerAuf(id, r, x = 0, y = 0) {
    const da = finger.findIndex((f) => f.id === id);
    if (da >= 0) finger.splice(da, 1);
    finger.push({ id, r, x0: x, y0: y, t0: performance.now(), wisch: false });
    lenkeNeu();
    if (state.phase === "bereit" && !shell.live) losGehts();
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

  // Der Wisch: ziehen im Fall, abfangen unter dem Schirm.
  function aktion() {
    if (state.phase === "bereit") { if (!shell.live) losGehts(); return; }
    if (state.phase !== "spiel") return;
    state.aktion = true;
    const w = knoepfe?.querySelector(".fs-wisch");
    if (w) {
      w.classList.remove("ist-an");
      void w.offsetWidth;
      w.classList.add("ist-an");
    }
  }

  // Für die Prüfskripte und die Vorführung: lenken wie mit einem Finger –
  // -1 links, 1 rechts, 0 loslassen.
  function lenke(r) {
    finger.length = 0;
    if (r) finger.push({ id: "auto", r: Math.sign(r), x0: 0, y0: 0, t0: 0, wisch: false });
    lenkeNeu();
    if (r && state.phase === "bereit" && !shell.live) losGehts();
  }

  // Die Runde beginnt: mit der ersten Eingabe – oder im Live-Modus zum
  // gemeinsamen Start (game-shell.js, live.los). Er springt.
  function losGehts() {
    if (state.phase !== "bereit") return;
    state.phase = "spiel";
    shell.setPhase("play");
    gegner?.los();
    absprung();
  }

  // ---------------------------------------------------------------------------
  // Ablauf
  // ---------------------------------------------------------------------------
  const promptText = () => (window.matchMedia?.("(pointer: coarse)")?.matches
    ? "Halten: lenken – wisch hoch: Schirm auf!"
    : "← → lenken – Leertaste: Schirm auf!");

  function startRun() {
    clearStep();
    stopLoop();
    klangAus();
    perfektFolge = 0;
    shell.closeOverlay();
    zufall.neu();
    shell.setPhase("intro");
    state.phase = "bereit";
    state.plan = { spruenge: [] };
    state.punkte = 0;
    state.serie = [];
    state.grund = "";
    state.teile = [];
    state.schriften = [];
    state.banner = null;
    state.lupe = 0;
    state.stoss = 0;
    state.blitz = 0;
    state.weiss = 0;
    state.zeit = 0;
    state.echt = 0;
    state.rest = 0;
    state.jubel = -9;
    state.lenkung = 0;
    state.aktion = false;
    finger.length = 0;
    shell.setCount(0);
    gegner?.runde();

    shell.clear();
    promptKnoten = shell.el("p", "cm-prompt fs-prompt", promptText());
    shell.play.append(promptKnoten, buildPlatz());
    view.cssW = 0;
    view.cssH = 0;
    messen();
    planBis(2);
    sprungBeginnen(1, true);
    ersteBilder = 3;
    angehalten = false;
    wischBald = false;

    last = performance.now();
    frame = window.requestAnimationFrame(loop);
  }

  function zaehleHoch(ziel) {
    const zahl = host.querySelector(".cm-result-score");
    if (!zahl) return;
    if (ruhig() || ziel <= 1) { zahl.textContent = String(ziel); return; }
    const dauer = Math.min(900, 200 + ziel * 1.2);
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
    klangAus();
    alleWeg();
    const punkte = state.punkte;
    const geist = gegner?.ende(punkte) || null;
    const vorher = Number(store.read()?.scores?.[0]) || 0;
    const rekord = punkte > vorher;
    store.update((old) => ({
      runs: (Number(old.runs) || 0) + 1,
      scores: [...(old.scores || []), punkte].sort((x, y) => y - x).slice(0, TOP_COUNT),
    }));
    const n = state.serie.length;
    const grund = state.grund ? state.grund.replace(/!$/, "") : "";
    const best = vorher ? `Bestwert ${vorher}` : "";
    shell.showResult({
      label: "Deine Punkte",
      points: punkte,
      detail: rekord ? "Neuer Rekord!" : [`${n} ${n === 1 ? "Landung" : "Landungen"}`, grund, best].filter(Boolean).join(" · "),
      geist,
    });
    if (rekord) host.querySelector(".cm-result-detail")?.classList.add("fs-rekord");
    zaehleHoch(punkte);
  }

  // ---------------------------------------------------------------------------
  // Start
  // ---------------------------------------------------------------------------
  shell = shellApi.mount({
    host,
    title: "Fallschirm",
    area: "geschwindigkeit",
    accent: "#F5A623",
    accentDark: "#b9741a",
    clock: false,
    onRestart: () => (zuschauer ? zuschauenStarten() : startRun()),
    live: { los: losGehts, stopp: () => finish(), zuschauen: (quelle) => { zuschauer = quelle; zuschauenStarten(); } },
  });
  zuschauer = window.LernappGeist?.zuschauer?.({
    host, spiel: "skyDive", fassung: "t1", zufall, einheit: "Punkte", nochmal: zuschauenStarten,
  }) || null;
  if (!zuschauer) {
    gegner = window.LernappGeist?.fuer?.({ spiel: "skyDive", host, art: "tempo", alle: true, zufall }) || null;
  }

  baueMuster();
  startRun();
  zuschauer?.laden.then((da) => { if (da) zuschauenStarten(); });

  host.addEventListener("pointerdown", (event) => {
    if (event.target.closest("button, a, input")) return;
    const rahmen = (feld || host).getBoundingClientRect();
    fingerAuf(event.pointerId, event.clientX < rahmen.left + rahmen.width / 2 ? -1 : 1, event.clientX, event.clientY);
  });
  window.addEventListener("pointermove", (event) => {
    const f = finger.find((q) => q.id === event.pointerId);
    if (!f || f.wisch) return;
    const hoch = f.y0 - event.clientY;
    if (hoch > WISCH_PX && hoch > Math.abs(event.clientX - f.x0) * 1.2 && performance.now() - f.t0 < WISCH_MS) {
      f.wisch = true;
      lenkeNeu();
      aktion();
    }
  });
  window.addEventListener("pointerup", (event) => fingerWeg(event.pointerId));
  window.addEventListener("pointercancel", (event) => fingerWeg(event.pointerId));
  // Wer das Fenster verlässt, nimmt auch die Finger vom Bild.
  window.addEventListener("blur", alleWeg);

  // Pfeil links oder A, Pfeil rechts oder D lenken. Leertaste, ↑, W oder
  // Enter ziehen (und fangen ab). Steht der Fokus auf einem Knopf, gilt die
  // Taste dem Knopf.
  const seiteDerTaste = (event) => {
    if (event.key === "ArrowLeft" || event.code === "KeyA") return -1;
    if (event.key === "ArrowRight" || event.code === "KeyD") return 1;
    return 0;
  };
  const istAktion = (event) => event.key === " " || event.key === "ArrowUp" || event.key === "Enter" || event.code === "KeyW";
  document.addEventListener("keydown", (event) => {
    const r = seiteDerTaste(event);
    const los = istAktion(event);
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
  window.addEventListener("pagehide", () => { clearStep(); stopLoop(); });

  // Für die Prüfskripte. lenke(r) lenkt wie ein Finger (-1, 0, 1), wisch()
  // zieht oder fängt ab, takt(dt) rechnet weiter. springer ist der Springer
  // (x, y, z, vx, vz, auf), sprungDaten(n) der Plan eines Sprungs.
  window.LernappFallschirm = {
    H_AB, TAKT, R_FREI, R_SCHIRM, V_QUER, V_QUER_FREI, TAU_QUER_FREI, WIND_FREI, V_ABSPRUNG, V_SINK, FLARE_BAND, HINDERNIS, WELT,
    state, view, kam, takt, lenke, wisch: aktion, losGehts, weltText, planBis, sprungDaten,
    untergrund, zielX: zielXJetzt, hindernisLage, tFall, vFallBei, hMinBei, windHoehe, sinkBei, flareSinken,
    kacheln: () => kacheln.size,
    anhalten: (an = true) => { angehalten = Boolean(an); },
    leistung,
    get springer() { return state.j; },
  };
})();
