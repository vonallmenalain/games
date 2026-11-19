/*
 * freihand.js – Freihand. Zehn Blätter, ein Bleistift, kein Lineal und kein Zirkel.
 * ---------------------------------------------------------------------------
 * Auf jedem Blatt steht eine Aufgabe: ein Kreis um M, das Lot von P auf die
 * Linie, das Spiegelbild einer Figur, das Fünfeck um M. Gezeichnet wird mit
 * dem Finger (der Maus, dem Stift), in einem Zug – wer absetzt, ist fertig.
 * Danach legt der Rotstift die ideale Form darüber, und gemessen wird, wie
 * weit der Strich im Schnitt daneben liegt: in Millimetern des Blattes, auf
 * den Hundertstel genau. Bis zu hundert Punkte je Blatt, tausend im Ganzen.
 *
 * Gemessen wird in beide Richtungen (messe): wie weit der Strich von der
 * Form weg ist – und wie weit die Form vom Strich. Wer nur die halbe Form
 * zeichnet, liegt mit dem Strich richtig und verliert trotzdem; wer
 * darüber hinauskritzelt, ebenso.
 *
 * Vor jedem Blatt steht, was zu tun ist, mit einem Beispiel, das sich selbst
 * zeichnet. Die Uhr läuft erst nach einem Tipp – dann aber knapp: acht bis
 * zehn Sekunden für Überlegen und Zeichnen.
 *
 * Die Blätter kommen aus zufall.js – ohne Turnier jedes Mal andere, im
 * Turnier für alle dieselben. Aufgezeichnet werden die Züge (geist.js,
 * zuege): jedes Blatt und der Strich, Punkt um Punkt, so wie er gewertet
 * wird. Damit lassen sich die besten Runden anschauen, und im Multiplayer
 * sehen die anderen den Strich entstehen.
 *
 * Bühne, Knöpfe und Bestenliste kommen aus game-shell.js.
 */
(() => {
  "use strict";

  if (document.body.dataset.page !== "sketch") return;

  const host = document.querySelector("#fh-stage");
  const shellApi = window.LernappGameShell;
  const cloudApi = window.LernappGameCloud;
  if (!host || !shellApi) return;

  const kids = () => window.LernappKids || null;
  const klang = () => window.ArcadeKlang || null;
  const ruhig = () => Boolean(kids()?.prefersReducedMotion?.());

  // Der Zufall: welche zehn Aufgaben kommen und wie sie auf dem Blatt
  // liegen. Die Beispiele der Vorschau, das Korn des Papiers und die Funken
  // nehmen Math.random.
  const zufall = window.LernappZufall?.fuer?.("freeHand") || {
    fest: false, neu() {}, zahl: Math.random,
  };

  // ---------------------------------------------------------------------------
  // Regeln
  // ---------------------------------------------------------------------------
  // Das Blatt ist ein Quadrat von 100 × 100 Millimetern – so gross, wie der
  // Bildschirm es hergibt. Gerechnet wird überall in diesen Millimetern.
  const BLATT = 100;
  // So viel Rand bleibt um jede Figur frei.
  const RAND = 9;

  // Wie viele Punkte es für welche Abweichung gibt (Millimeter im Schnitt →
  // Punkte), dazwischen geradlinig. Hundert gibt es nur bis drei Zehntel –
  // das ist auf einem Handy ein einziger Bildpunkt.
  const KNOTEN = [[0.3, 100], [0.6, 92], [1.0, 80], [1.5, 66], [2.2, 50], [3.2, 33], [4.5, 18], [6.5, 6], [8.5, 0]];
  const PUNKTE_JE_BLATT = 100;
  // Ab so vielen Punkten ist ein Blatt «haargenau».
  const GENAU = 92;

  // Die Aufgaben nach Schwere. Jede Runde zieht zwei leichte, vier mittlere
  // und vier schwere – jede Art höchstens einmal.
  const LEICHT = ["gerade", "kreis", "lot", "parallele"];
  const MITTEL = ["quadrat", "dreieck", "halbieren", "spiegel", "bogen", "kreisfrei", "mitte"];
  const SCHWER = ["umkreis", "drehen", "doppelt", "tangente", "welle", "fuenfeck"];
  const PLAN = [2, 4, 4];
  const BLAETTER = PLAN[0] + PLAN[1] + PLAN[2];
  const STUFE = ["leicht", "mittel", "schwer"];

  // So lange hat ein Blatt (Sekunden) – fürs Überlegen und fürs Zeichnen.
  const ZEITEN = [8, 9, 10];
  // So lange legt sich ein neues Blatt hin; erst danach läuft die Zeit.
  const EINZUG = 0.5;
  // Ab wann ein Blatt einen Strich annimmt – nicht den Tipp, der es hinlegte.
  const SPERRE = 0.25;
  // So lange steht die Lösung da.
  const ZEIGEN_MS = 2600;
  // So lange steht die Vorschau eines Blattes höchstens da (Sekunden) – eine
  // Runde soll von selbst zu Ende gehen. In den letzten VOR_ZAEHLT Sekunden
  // zählt sie sichtbar herunter; ein Tipp gilt erst nach VOR_SPERRE.
  const VORSCHAU = 30;
  const VOR_ZAEHLT = 5;
  const VOR_SPERRE = 0.35;

  // Ein Strich, der kürzer ist (Millimeter), war ein Versehen: Er wird
  // weggewischt und zählt nicht als Antwort.
  const STRICH_MIN = 6;
  // Gewertet (und aufgezeichnet) wird der Strich als Linienzug aus höchstens
  // so vielen Punkten, jeder auf ein Zwanzigstelmillimeter gerundet.
  const STRICH_PUNKTE = 48;
  const ZUG_MM = 20;
  // Wie eng der Linienzug dem Finger folgt (Millimeter): bis zum 24. Punkt
  // auf gut ein Zehntel, danach mit jedem Punkt etwas grosszügiger – ein
  // sauberer Kreis braucht dreissig Punkte, nur Gekritzel käme an die Grenze.
  const TREUE = 0.12;
  // In diesen Schritten (Millimeter) werden Strich und Form abgetastet.
  const TAKT = 0.5;

  // Wie streng eine Art gemessen wird: Die Abweichung zählt mal diese Zahl.
  // Eine Gerade zwischen zwei Punkten ist leichter zu treffen als ein
  // Fünfeck, das es noch gar nicht gibt.
  const MASS = {
    gerade: 1.5, kreis: 1.1, lot: 1.3, parallele: 1.2,
    quadrat: 1, dreieck: 1, halbieren: 1.2, spiegel: 1, bogen: 1.1, kreisfrei: 1.8, mitte: 1.1,
    umkreis: 0.9, drehen: 0.85, doppelt: 0.85, tangente: 1, welle: 0.9, fuenfeck: 0.85,
  };

  const TOP_COUNT = 5;

  // ---------------------------------------------------------------------------
  // Rechnen
  // ---------------------------------------------------------------------------
  const clamp = (wert, min, max) => Math.max(min, Math.min(max, wert));
  const lerp = (a, b, k) => a + (b - a) * k;
  const weich = (a, b, x) => { const u = clamp((x - a) / (b - a), 0, 1); return u * u * (3 - 2 * u); };
  const TAU = Math.PI * 2;
  const GRAD = Math.PI / 180;

  const P = (x, y) => ({ x, y });
  const plus = (p, v, k = 1) => P(p.x + v.x * k, p.y + v.y * k);
  const minus = (p, q) => P(p.x - q.x, p.y - q.y);
  const mal = (v, k) => P(v.x * k, v.y * k);
  const laenge = (v) => Math.hypot(v.x, v.y);
  const abstand = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
  const richt = (w) => P(Math.cos(w), Math.sin(w));
  const quer = (v) => P(-v.y, v.x);
  const dreh = (v, w) => P(v.x * Math.cos(w) - v.y * Math.sin(w), v.x * Math.sin(w) + v.y * Math.cos(w));

  // Der nächste Punkt der Strecke a–b zu p.
  function aufStrecke(p, a, b) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const l2 = dx * dx + dy * dy;
    const t = l2 > 1e-12 ? clamp(((p.x - a.x) * dx + (p.y - a.y) * dy) / l2, 0, 1) : 0;
    return P(a.x + dx * t, a.y + dy * t);
  }

  // Der nächste Punkt eines Linienzugs zu p – und wie weit er weg ist.
  function naechster(p, weg) {
    let best = weg[0];
    let d2 = Infinity;
    for (let i = 1; i < weg.length; i += 1) {
      const q = aufStrecke(p, weg[i - 1], weg[i]);
      const e = (q.x - p.x) * (q.x - p.x) + (q.y - p.y) * (q.y - p.y);
      if (e < d2) { d2 = e; best = q; }
    }
    if (weg.length === 1) d2 = (best.x - p.x) * (best.x - p.x) + (best.y - p.y) * (best.y - p.y);
    return { ort: best, weit: Math.sqrt(d2) };
  }

  const wegLaenge = (weg) => { let l = 0; for (let i = 1; i < weg.length; i += 1) l += abstand(weg[i - 1], weg[i]); return l; };

  // Punkte längs eines Linienzugs, alle schritt Millimeter – der erste und
  // der letzte Punkt sind immer dabei.
  function abtasten(weg, schritt = TAKT) {
    const raus = [P(weg[0].x, weg[0].y)];
    let rest = schritt;
    for (let i = 1; i < weg.length; i += 1) {
      const a = weg[i - 1];
      const b = weg[i];
      const l = abstand(a, b);
      let s = rest;
      while (s <= l) { raus.push(P(a.x + ((b.x - a.x) * s) / l, a.y + ((b.y - a.y) * s) / l)); s += schritt; }
      rest = s - l;
    }
    const ende = weg[weg.length - 1];
    if (abstand(raus[raus.length - 1], ende) > 1e-6) raus.push(P(ende.x, ende.y));
    return raus;
  }

  // Der Anfang eines Linienzugs: so viel davon, wie der Anteil k seiner Länge.
  function teilWeg(weg, k) {
    if (k >= 1) return weg;
    const ziel = wegLaenge(weg) * Math.max(0, k);
    const raus = [weg[0]];
    let l = 0;
    for (let i = 1; i < weg.length; i += 1) {
      const d = abstand(weg[i - 1], weg[i]);
      if (l + d >= ziel) {
        const t = d > 1e-9 ? (ziel - l) / d : 0;
        raus.push(P(lerp(weg[i - 1].x, weg[i].x, t), lerp(weg[i - 1].y, weg[i].y, t)));
        return raus;
      }
      raus.push(weg[i]);
      l += d;
    }
    return raus;
  }

  // Ein Kreis (oder ein Bogen davon) als Linienzug, in Stücken von gut einem
  // Millimeter.
  function kreisWeg(m, r, von = 0, bis = von + TAU) {
    const n = Math.max(16, Math.ceil((Math.abs(bis - von) * r) / 1.2));
    const raus = [];
    for (let i = 0; i <= n; i += 1) raus.push(plus(m, richt(von + ((bis - von) * i) / n), r));
    return raus;
  }

  // Der Kreis, der am besten durch die Punkte geht (kleinste Quadrate).
  function kreisFit(punkte) {
    const n = punkte.length;
    let mx = 0;
    let my = 0;
    for (const p of punkte) { mx += p.x; my += p.y; }
    mx /= n; my /= n;
    let suu = 0, suv = 0, svv = 0, suuu = 0, svvv = 0, suvv = 0, svuu = 0;
    for (const p of punkte) {
      const u = p.x - mx;
      const v = p.y - my;
      suu += u * u; suv += u * v; svv += v * v;
      suuu += u * u * u; svvv += v * v * v; suvv += u * v * v; svuu += v * u * u;
    }
    const det = suu * svv - suv * suv;
    if (Math.abs(det) < 1e-9) return { m: P(mx, my), r: 0 };
    const a = (suuu + suvv) / 2;
    const b = (svvv + svuu) / 2;
    const uc = (a * svv - b * suv) / det;
    const vc = (b * suu - a * suv) / det;
    return { m: P(mx + uc, my + vc), r: Math.sqrt(uc * uc + vc * vc + (suu + svv) / n) };
  }

  // ---------------------------------------------------------------------------
  // Die Aufgaben
  // ---------------------------------------------------------------------------
  /*
   * Jede Art baut ihr Blatt erst im Rohen, um den Nullpunkt herum: was
   * gegeben ist (teile) und was zu zeichnen wäre (ziele – eine oder mehrere
   * Formen, die alle gelten: das Quadrat links oder rechts der Strecke).
   * Danach wird das Ganze aufs Blatt gelegt (lege): irgendwo, wo es mit Rand
   * hineinpasst.
   *
   * Ein Teil des Gegebenen:
   *   { t: "strecke", a, b, stil }     stil: "" | "strich" | "spiegel"
   *   { t: "weg", pkte, zu }           ein Linienzug (zu: geschlossen)
   *   { t: "punkt", p, name }          ein Punkt mit seinem Buchstaben
   *   { t: "kreuz", p, name }          ein Mittelpunkt
   *   { t: "kreis", m, r, stil }
   *   { t: "bogen", m, r, von, bis, stil }
   *   { t: "pfeil", m, r, von, bis }   ein Bogen mit Spitze: die Drehrichtung
   *   { t: "text", p, text }
   *
   * r ist der Zufall, eine Funktion wie Math.random.
   */
  const zw = (r, a, b) => a + (b - a) * r();
  const mal1 = (r) => (r() < 0.5 ? -1 : 1);

  const BAU = {
    gerade(r) {
      const b = mal(richt(zw(r, 0, TAU)), zw(r, 55, 80));
      return { teile: [{ t: "punkt", p: P(0, 0), name: "A" }, { t: "punkt", p: b, name: "B" }], ziele: [[P(0, 0), b]] };
    },
    kreis(r) {
      const w = zw(r, 0, TAU);
      const radius = zw(r, 20, 30);
      return {
        teile: [{ t: "kreuz", p: P(0, 0), name: "M" }, { t: "punkt", p: mal(richt(w), radius), name: "P" }],
        ziele: [kreisWeg(P(0, 0), radius, w)],
      };
    },
    lot(r) {
      const u = richt(zw(r, 0, TAU));
      const lang = zw(r, 66, 84);
      const fuss = mal(u, lang * zw(r, 0.25, 0.75));
      const p = plus(fuss, quer(u), zw(r, 22, 40) * mal1(r));
      return { teile: [{ t: "strecke", a: P(0, 0), b: mal(u, lang) }, { t: "punkt", p, name: "P" }], ziele: [[p, fuss]] };
    },
    parallele(r) {
      const u = richt(zw(r, 0, TAU));
      const d = mal(u, zw(r, 42, 60));
      const p = plus(plus(P(0, 0), quer(u), zw(r, 16, 30) * mal1(r)), u, zw(r, -10, 10));
      return {
        teile: [{ t: "strecke", a: P(0, 0), b: d, enden: true }, { t: "punkt", p, name: "P" }],
        ziele: [[p, plus(p, d)], [p, minus(p, d)]],
      };
    },
    quadrat(r) {
      const u = richt(zw(r, 0, TAU));
      const s = zw(r, 30, 42);
      const b = mal(u, s);
      const n = mal(quer(u), s);
      return {
        teile: [{ t: "strecke", a: P(0, 0), b, enden: true }],
        ziele: [[b, plus(b, n), n, P(0, 0)], [b, minus(b, n), mal(n, -1), P(0, 0)]],
      };
    },
    dreieck(r) {
      const u = richt(zw(r, 0, TAU));
      const s = zw(r, 38, 54);
      const b = mal(u, s);
      const hoch = mal(quer(u), (s * Math.sqrt(3)) / 2);
      const m = mal(u, s / 2);
      return {
        teile: [{ t: "strecke", a: P(0, 0), b, enden: true }],
        ziele: [[P(0, 0), plus(m, hoch), b], [P(0, 0), minus(m, hoch), b]],
      };
    },
    halbieren(r) {
      const w = zw(r, 0, TAU);
      const oeffnung = zw(r, 40, 130) * GRAD;
      const rho = zw(r, 36, 46);
      return {
        teile: [
          { t: "strecke", a: P(0, 0), b: mal(richt(w), 56) },
          { t: "strecke", a: P(0, 0), b: mal(richt(w + oeffnung), 56) },
          { t: "bogen", m: P(0, 0), r: rho, von: w, bis: w + oeffnung, stil: "strich" },
          { t: "punkt", p: P(0, 0), name: "S" },
        ],
        ziele: [[P(0, 0), mal(richt(w + oeffnung / 2), rho)]],
      };
    },
    spiegel(r) {
      const u = richt(zw(r, 0, TAU));
      const n = quer(u);
      // Drei Ecken auf einer Seite des Spiegels, der Reihe nach an ihm entlang.
      const lagen = [zw(r, -30, -16), zw(r, -7, 7), zw(r, 16, 30)];
      const tiefen = [zw(r, 8, 30), zw(r, 8, 30), zw(r, 8, 30)];
      if (Math.abs(tiefen[1] - (tiefen[0] + tiefen[2]) / 2) < 7) tiefen[1] = tiefen[1] > 19 ? tiefen[1] - 10 : tiefen[1] + 10;
      const figur = lagen.map((t, i) => plus(mal(u, t), n, tiefen[i]));
      return {
        teile: [{ t: "strecke", a: mal(u, -44), b: mal(u, 44), stil: "spiegel" }, { t: "weg", pkte: figur }],
        ziele: [lagen.map((t, i) => plus(mal(u, t), n, -tiefen[i]))],
      };
    },
    bogen(r) {
      const w = zw(r, 0, TAU);
      const radius = zw(r, 24, 34);
      const sinn = mal1(r);
      const weite = zw(r, 100, 200) * GRAD * sinn;
      return {
        teile: [
          { t: "kreuz", p: P(0, 0), name: "M" },
          { t: "punkt", p: mal(richt(w), radius), name: "A" },
          { t: "punkt", p: mal(richt(w + weite), radius), name: "B" },
          { t: "pfeil", m: P(0, 0), r: radius * 0.45, von: w, bis: w + 42 * GRAD * sinn },
        ],
        ziele: [kreisWeg(P(0, 0), radius, w, w + weite)],
      };
    },
    kreisfrei() {
      // Die Münze liegt fest in einer Ecke; der Kreis darf überallhin.
      return { teile: [{ t: "kreis", m: P(0, 0), r: 9, stil: "muenze" }], ziele: [], frei: { rMin: 18 } };
    },
    mitte(r) {
      const u = richt(zw(r, 0, TAU));
      const halb = zw(r, 15, 25);
      const rho = zw(r, 26, 34);
      return {
        teile: [
          { t: "punkt", p: mal(u, -halb), name: "A" }, { t: "punkt", p: mal(u, halb), name: "B" },
          { t: "kreis", m: P(0, 0), r: rho, stil: "strich" },
        ],
        ziele: [[mal(quer(u), -rho), mal(quer(u), rho)]],
      };
    },
    umkreis(r) {
      const radius = zw(r, 20, 30);
      const a = zw(r, 0, TAU);
      const b = a + zw(r, 70, 160) * GRAD;
      const c = b + zw(r, 70, 160) * GRAD;
      return {
        teile: [a, b, c].map((w, i) => ({ t: "punkt", p: mal(richt(w), radius), name: "ABC"[i] })),
        ziele: [kreisWeg(P(0, 0), radius, a)],
      };
    },
    drehen(r) {
      const w = zw(r, 0, TAU);
      const sinn = mal1(r);
      const figur = [zw(r, -34, -20), zw(r, -8, 8), zw(r, 20, 34)].map((grad, i) => mal(richt(w + grad * GRAD), i === 1 ? zw(r, 16, 24) : zw(r, 26, 38)));
      return {
        teile: [
          { t: "kreuz", p: P(0, 0), name: "Z" }, { t: "weg", pkte: figur },
          { t: "pfeil", m: P(0, 0), r: 9, von: w, bis: w + 90 * GRAD * sinn },
        ],
        ziele: [figur.map((p) => dreh(p, 90 * GRAD * sinn))],
      };
    },
    doppelt(r) {
      const w = zw(r, 0, TAU);
      const ecken = [zw(r, -42, -22), zw(r, -6, 6), zw(r, 22, 42)].map((grad, i) => mal(richt(w + grad * GRAD), i === 1 ? zw(r, 9, 12) : zw(r, 15, 19)));
      return {
        teile: [{ t: "kreuz", p: P(0, 0), name: "Z" }, { t: "weg", pkte: ecken, zu: true }],
        ziele: [[...ecken, ecken[0]].map((p) => mal(p, 2))],
      };
    },
    tangente(r) {
      const w = zw(r, 0, TAU);
      const radius = zw(r, 14, 22);
      const weit = radius * zw(r, 2.2, 3);
      const p = mal(richt(w), weit);
      const alpha = Math.acos(radius / weit);
      return {
        teile: [{ t: "kreis", m: P(0, 0), r: radius }, { t: "punkt", p, name: "P" }],
        ziele: [[p, mal(richt(w + alpha), radius)], [p, mal(richt(w - alpha), radius)]],
      };
    },
    welle(r) {
      const hoch = zw(r, 8, 12) * mal1(r);
      const lang = zw(r, 18, 23);
      const da = lang * 1.25;
      const ende = da + lang * zw(r, 1.75, 2.25);
      const y = (x) => hoch * Math.sin((x / lang) * TAU);
      const stueck = (von, bis) => { const pkte = []; const n = Math.ceil(bis - von); for (let i = 0; i <= n; i += 1) { const x = von + ((bis - von) * i) / n; pkte.push(P(x, y(x))); } return pkte; };
      const rand = Math.abs(hoch) + 7;
      return {
        teile: [
          { t: "weg", pkte: stueck(0, da) },
          { t: "strecke", a: P(ende, -rand), b: P(ende, rand), stil: "strich" },
        ],
        ziele: [stueck(da, ende)],
      };
    },
    fuenfeck(r) {
      const w = zw(r, 0, TAU);
      const radius = zw(r, 22, 30);
      const ecken = [0, 1, 2, 3, 4, 5].map((i) => mal(richt(w + (i * TAU) / 5), radius));
      return { teile: [{ t: "kreuz", p: P(0, 0), name: "M" }, { t: "punkt", p: ecken[0], name: "P" }], ziele: [ecken] };
    },
  };

  const KURZ = {
    gerade: "Gerade", kreis: "Kreis", lot: "Lot", parallele: "Parallele",
    quadrat: "Quadrat", dreieck: "Dreieck", halbieren: "Winkel halbieren", spiegel: "Spiegelbild", bogen: "Bogen",
    kreisfrei: "Freier Kreis", mitte: "Mittelsenkrechte",
    umkreis: "Umkreis", drehen: "Drehen", doppelt: "Doppelt so gross", tangente: "Tangente", welle: "Welle", fuenfeck: "Fünfeck",
  };

  // Was zu tun ist – ein Satz je Art.
  const TUN = {
    gerade: "Zieh eine gerade Linie von A nach B.",
    kreis: "Zieh einen Kreis um M, der durch P geht.",
    lot: "Zieh von P den kürzesten Weg zur Linie: Er trifft sie im rechten Winkel.",
    parallele: "Zieh von P aus eine Strecke: parallel zur Linie und genau so lang.",
    quadrat: "Die Strecke ist eine Seite eines Quadrats. Zeichne die drei anderen – links oder rechts davon.",
    dreieck: "Die Strecke ist eine Seite eines Dreiecks mit drei gleich langen Seiten. Zeichne die beiden anderen.",
    halbieren: "Zieh vom Scheitel S die Linie, die den Winkel in zwei gleiche Hälften teilt – bis zum Bogen.",
    spiegel: "Die doppelte Linie ist ein Spiegel. Zeichne das Spiegelbild der Figur auf die andere Seite.",
    bogen: "Zieh den Kreisbogen um M von A nach B – in Pfeilrichtung, immer gleich weit von M weg.",
    kreisfrei: "Zeichne einen Kreis, so rund du kannst – irgendwo, aber mindestens doppelt so gross wie die Münze.",
    mitte: "Zieh durch den Ring die Linie, die von A und B überall gleich weit weg ist – von Rand zu Rand.",
    umkreis: "Zieh den Kreis, der durch alle drei Punkte geht.",
    drehen: "Dreh die Figur um Z: eine Vierteldrehung in Pfeilrichtung. Zeichne sie dort, wo sie landet.",
    doppelt: "Streck das Dreieck von Z aus aufs Doppelte: Jede Ecke liegt doppelt so weit von Z weg.",
    tangente: "Zieh von P die Linie, die den Kreis gerade noch berührt – bis zum Berührpunkt.",
    welle: "Führ die Welle weiter bis zur gestrichelten Linie: gleich hoch, gleich lang.",
    fuenfeck: "Zeichne das regelmässige Fünfeck um M: fünf gleiche Seiten, eine Ecke liegt bei P.",
  };

  // Alle Punkte eines Teils – für die Lage auf dem Blatt (ein Kreis mit
  // seinem Rand).
  function teilPunkte(t) {
    if (t.t === "strecke") return [t.a, t.b];
    if (t.t === "weg") return t.pkte;
    if (t.t === "kreis") return [P(t.m.x - t.r, t.m.y - t.r), P(t.m.x + t.r, t.m.y + t.r)];
    if (t.t === "bogen" || t.t === "pfeil") return kreisWeg(t.m, t.r, t.von, t.bis);
    return [t.p];
  }

  // Ein Teil verschoben und (wenn es nicht anders passt) verkleinert.
  function teilNach(t, k, dx, dy) {
    const f = (p) => P(p.x * k + dx, p.y * k + dy);
    const neu = { ...t };
    for (const name of ["a", "b", "p", "m"]) if (t[name]) neu[name] = f(t[name]);
    if (t.pkte) neu.pkte = t.pkte.map(f);
    if (t.r) neu.r = t.r * k;
    return neu;
  }

  const imBlatt = (weg, rand = 3) => weg.every((p) => p.x >= rand && p.x <= BLATT - rand && p.y >= rand && p.y <= BLATT - rand);

  // Aus dem Rohen ein Blatt: irgendwo hingelegt, wo alles mit Rand hineinpasst.
  function lege(art, r) {
    const roh = BAU[art](r);
    const stufe = LEICHT.includes(art) ? 0 : MITTEL.includes(art) ? 1 : 2;
    const a = { art, stufe, kurz: KURZ[art], frage: TUN[art], zeit: ZEITEN[stufe], mass: MASS[art] || 1, frei: roh.frei || null };
    if (art === "kreisfrei") {
      // Die Münze in einer der vier Ecken.
      const ecke = P(r() < 0.5 ? 17 : 83, r() < 0.5 ? 17 : 83);
      a.teile = roh.teile.map((t) => teilNach(t, 1, ecke.x, ecke.y));
      a.ziele = [];
      return a;
    }
    const alle = [...roh.teile.flatMap(teilPunkte), ...roh.ziele[0]];
    const x0 = Math.min(...alle.map((p) => p.x));
    const x1 = Math.max(...alle.map((p) => p.x));
    const y0 = Math.min(...alle.map((p) => p.y));
    const y1 = Math.max(...alle.map((p) => p.y));
    const platz = BLATT - 2 * RAND;
    const k = Math.min(1, platz / Math.max(x1 - x0, 1), platz / Math.max(y1 - y0, 1));
    const dx = RAND - x0 * k + (platz - (x1 - x0) * k) * r();
    const dy = RAND - y0 * k + (platz - (y1 - y0) * k) * r();
    a.teile = roh.teile.map((t) => teilNach(t, k, dx, dy));
    // Die zweite Form gilt nur, wenn auch sie aufs Blatt passt.
    a.ziele = roh.ziele.map((weg) => weg.map((p) => P(p.x * k + dx, p.y * k + dy))).filter((weg, i) => i === 0 || imBlatt(weg));
    return a;
  }

  function mische(liste) {
    const kopie = [...liste];
    for (let i = kopie.length - 1; i > 0; i -= 1) {
      const j = Math.floor(zufall.zahl() * (i + 1));
      [kopie[i], kopie[j]] = [kopie[j], kopie[i]];
    }
    return kopie;
  }

  // Die zehn Blätter einer Runde: zwei leichte, vier mittlere, vier schwere.
  function aufgabenFuer() {
    const r = () => zufall.zahl();
    const arten = [...mische(LEICHT).slice(0, PLAN[0]), ...mische(MITTEL).slice(0, PLAN[1]), ...mische(SCHWER).slice(0, PLAN[2])];
    return arten.map((art) => lege(art, r));
  }

  /*
   * Die Testrunde (?alle in der Adresse; im Adminbereich «▶ Alle Aufgaben»):
   * jede Art einmal, die leichten zuerst, dann die mittleren, dann die
   * schweren. Zum Ausprobieren: Sie geht in keine Bestenliste und wird nicht
   * aufgezeichnet; oben steht der Knopf «Überspringen». ?alle=kreis,welle
   * nimmt nur diese Arten. Im Turnier, im Live-Modus und beim Zuschauen gibt
   * es sie nicht.
   */
  const TESTRUNDE = (() => {
    const p = new URLSearchParams(window.location.search);
    if (!p.has("alle") || p.has("turnier") || p.has("live") || p.has("zuschauen") || zufall.fest) return null;
    const alle = [...LEICHT, ...MITTEL, ...SCHWER];
    const wunsch = String(p.get("alle") || "").toLowerCase().split(/[\s,]+/).filter(Boolean);
    const arten = alle.filter((art) => wunsch.includes(art));
    return arten.length ? arten : alle;
  })();
  const testBlaetter = () => { const r = () => zufall.zahl(); return TESTRUNDE.map((art) => lege(art, r)); };

  // Die Runde als Text – für die Prüfung, dass in einem Turnier alle dieselbe bekommen.
  function weltText(blaetter = state.blaetter) {
    return (blaetter || []).map((a) => {
      const p = teilPunkte(a.teile[0])[0];
      const z = a.ziele[0]?.[0] || p;
      return `${a.art}:${p.x.toFixed(2)}/${p.y.toFixed(2)}/${z.x.toFixed(2)}/${z.y.toFixed(2)}`;
    }).join(" ");
  }

  // ---------------------------------------------------------------------------
  // Messen
  // ---------------------------------------------------------------------------
  function punkteFuer(mm, mass = 1) {
    const streng = mm * mass;
    if (!(streng >= 0)) return 0;
    if (streng <= KNOTEN[0][0]) return PUNKTE_JE_BLATT;
    for (let i = 1; i < KNOTEN.length; i += 1) {
      if (streng <= KNOTEN[i][0]) {
        const [x0, p0] = KNOTEN[i - 1];
        const [x1, p1] = KNOTEN[i];
        // Das Härchen: 1,0 mm sind in Fliesskomma nicht immer 1,0.
        return Math.round(lerp(p0, p1, (streng - x0) / (x1 - x0)) - 1e-9);
      }
    }
    return 0;
  }

  const mittel = (liste) => liste.reduce((s, x) => s + x, 0) / Math.max(1, liste.length);

  /*
   * Der Strich gegen die Form. Beide werden alle halben Millimeter
   * abgetastet; gemessen wird, wie weit die Punkte des Strichs im Schnitt
   * von der Form weg sind (hin) und die Punkte der Form vom Strich (her).
   * Die Abweichung ist das Mittel aus beidem. Gelten mehrere Formen, zählt
   * die, der der Strich am nächsten kommt.
   *
   * Heraus kommt { mm, punkte, ziel, hin, her } – mm auf den Hundertstel.
   */
  function messe(a, strich) {
    if (!strich || strich.length < 2) return { mm: Infinity, punkte: 0, ziel: a.ziele[0] || null, hin: Infinity, her: Infinity };
    const s = abtasten(strich);
    let formen = a.ziele.map((weg) => ({ weg, mal: 1, dazu: 0 }));
    if (a.frei) {
      // Der freie Kreis wird an dem Kreis gemessen, der am besten durch den
      // Strich geht. Ist er kleiner als verlangt, zählt die Abweichung mehr –
      // und jeder fehlende Millimeter des Halbmessers einen halben dazu.
      const k = kreisFit(s);
      const radius = clamp(k.r, 1, 70);
      formen = [{ weg: kreisWeg(k.m, radius), mal: Math.pow(Math.max(1, a.frei.rMin / radius), 2), dazu: Math.max(0, a.frei.rMin - radius) * 0.5 }];
    }
    let best = null;
    for (const form of formen) {
      const hin = mittel(s.map((p) => naechster(p, form.weg).weit));
      const her = mittel(abtasten(form.weg).map((p) => naechster(p, strich).weit));
      const mm = ((hin + her) / 2) * form.mal + form.dazu;
      if (!best || mm < best.mm) best = { mm, ziel: form.weg, hin, her };
    }
    best.mm = Math.round(best.mm * 100) / 100;
    best.punkte = punkteFuer(best.mm, a.mass);
    return best;
  }

  /*
   * Der Strich, wie er gewertet wird: nicht jede Regung des Fingers, sondern
   * ein Linienzug, der ihm auf gut ein Zehntelmillimeter folgt. Ein neuer
   * Punkt entsteht, sobald die Gerade vom letzten Punkt zum Finger das, was
   * dazwischen gezeichnet wurde, nicht mehr trifft. So wird er Punkt um
   * Punkt gemeldet, während er entsteht – und wer zuschaut, misst denselben.
   */
  const rund = (wert) => Math.round(wert * ZUG_MM) / ZUG_MM;
  const treue = (n) => TREUE * Math.pow(1.12, Math.max(0, n - 24));

  function schreiberNeu(p) {
    const start = P(rund(p.x), rund(p.y));
    return { punkte: [start], puffer: [], zuletzt: start };
  }

  // Der Finger ist bei p: Gibt den neuen Punkt des Linienzugs zurück, wenn
  // einer fällig ist – sonst null.
  function schreibe(s, p) {
    const anker = s.punkte[s.punkte.length - 1];
    const q = P(rund(p.x), rund(p.y));
    if (q.x === s.zuletzt.x && q.y === s.zuletzt.y) return null;
    let neu = null;
    if (s.punkte.length < STRICH_PUNKTE - 1 && s.puffer.length) {
      const grenze = treue(s.punkte.length);
      let weit = 0;
      for (const z of s.puffer) weit = Math.max(weit, abstand(z, aufStrecke(z, anker, q)));
      if (weit > grenze) {
        neu = s.puffer[s.puffer.length - 1];
        s.punkte.push(neu);
        s.puffer = [];
      }
    }
    s.puffer.push(q);
    s.zuletzt = q;
    return neu;
  }

  // Der Finger hebt ab: Der letzte Punkt gehört dazu.
  function schliesse(s) {
    const anker = s.punkte[s.punkte.length - 1];
    if (s.zuletzt.x === anker.x && s.zuletzt.y === anker.y) return null;
    s.punkte.push(s.zuletzt);
    s.puffer = [];
    return s.zuletzt;
  }

  // ---------------------------------------------------------------------------
  // Zustand
  // ---------------------------------------------------------------------------
  // phase: "bereit" (vor dem ersten Tipp), "vorschau" (was zu tun ist – die
  // Uhr läuft noch nicht), "aufgabe", "zeigen" (die Lösung steht da),
  // "warten" (beim Zuschauen, bevor der erste Zug da ist), "ende"
  const state = {
    phase: "bereit",
    blaetter: null,        // die zehn Aufgaben der Runde
    index: 0,
    punkte: 0,
    liste: [],             // je Blatt { punkte, mm, strich, ziel } – null, solange es offen ist
    t0: 0,                 // wann das Blatt begann (performance.now)
    vorSeit: 0,            // wann seine Vorschau begann
    tZeig: 0,              // wann die Lösung begann
    gewendet: 0,           // wann zuletzt umgeblättert wurde
    roh: [],               // der Strich, wie der Finger ihn zog – fürs Bild
    schreiber: null,       // der Linienzug, der gewertet wird (schreiberNeu)
    zieht: null,           // welcher Zeiger gerade zeichnet
    stift: null,           // wo die Spitze des Bleistifts ist { x, y } in Millimetern
    stiftSeit: 0,          // wann sie zuletzt bewegt wurde
    tempo: 0,              // wie schnell sie fährt (mm/s, geglättet)
    eingabe: "",           // womit zuletzt gezeichnet wurde: "touch", "mouse", "pen"
    wertung: null,         // { mm, punkte, ziel, strich, fransen, stempel }, sobald die Lösung dasteht
    verworfen: 0,          // wann zuletzt ein zu kurzer Strich weggewischt wurde
    genaue: 0,             // haargenaue Blätter dieser Runde
    tickBei: 0,            // für welche Sekunde es zuletzt getickt hat
    funken: [],
    beispiel: null,        // das Beispiel der Vorschau { teile, weg }
  };

  let shell = null;
  let feld = null;
  let canvas = null;
  let g = null;
  let status = null;
  let frame = null;
  let last = 0;
  let stepTimer = null;
  // Wem zugeschaut wird: im Multiplayer nach den eigenen zehn Blättern
  // (live-spiel.js), oder ein Lauf aus der Hall of Fame (geist.js, zuschauer).
  let zuschauer = null;
  // Die Aufzeichnung der Züge (geist.js, zuege).
  let aufnahme = null;

  const view = { dpr: 1, cssW: 0, cssH: 0, frei: 0, s: 3, x0: 0, y0: 0, seite: 300, u: 1, hoch: true, flach: false, text: null, mappe: null, guete: 1 };

  const blatt = () => state.blaetter?.[state.index] || null;
  // Wie viele Blätter die Runde hat: zehn – in der Testrunde alle.
  const anzahl = () => state.blaetter?.length || BLAETTER;
  // Wie lange das Blatt schon daliegt, in Sekunden.
  const seit = (jetzt = performance.now()) => (jetzt - state.t0) / 1000;
  const offen = () => state.phase === "aufgabe" && !zuschauer;

  function clearStep() {
    if (stepTimer) { window.clearTimeout(stepTimer); stepTimer = null; }
  }

  function stopLoop() {
    if (frame) { window.cancelAnimationFrame(frame); frame = null; }
  }

  // ---------------------------------------------------------------------------
  // Klang
  // ---------------------------------------------------------------------------
  const zuletzt = new Map();
  function ton(id, o = {}, pause = 60) {
    const ms = performance.now();
    if (ms - (zuletzt.get(id) ?? -1e9) < pause) return;
    zuletzt.set(id, ms);
    klang()?.ton?.(id, o);
  }

  // Der Bleistift kratzt übers Papier – so laut, wie er schnell ist.
  let kratzen = null;
  function kratzenAn() {
    if (!kratzen) kratzen = klang()?.kulisse?.("freihand.stift", { laut: 0 }) || null;
  }
  function kratzenAus() {
    kratzen?.stop();
    kratzen = null;
  }

  function antwortKlang(punkte) {
    ton("freihand.stempel");
    if (punkte >= GENAU) ton("freihand.genau", { laut: 0.9 });
    else if (punkte >= 50) ton("freihand.gut", { laut: 0.5 + punkte / 200 });
    else ton("freihand.daneben", { laut: 0.6 });
  }

  function funkenBei(ort) {
    if (ruhig()) return;
    for (let i = 0; i < 22; i += 1) {
      const w = Math.random() * TAU;
      const v = 14 + Math.random() * 46;
      state.funken.push({ x: ort.x, y: ort.y, vx: Math.cos(w) * v, vy: Math.sin(w) * v - 10, alt: 0, leben: 0.5 + Math.random() * 0.5, gross: 0.5 + Math.random() * 0.8 });
    }
  }

  // ---------------------------------------------------------------------------
  // Die Züge
  // ---------------------------------------------------------------------------
  /*
   * Ein Zug (geist.js, zuege; live-spiel.js, zug):
   *   c   Blatt mal acht, plus was geschah:
   *         0  die Vorschau des Blattes steht da
   *         1  das Blatt liegt, seine Uhr läuft
   *         2  der Stift setzt auf (a, b: wo)
   *         3  ein weiterer Punkt des Strichs
   *         4  die Spitze dazwischen (nur fürs Bild – eine Lage)
   *         5  abgesetzt: der letzte Punkt, der Strich wird gewertet
   *         6  die Zeit war um, ohne Strich
   *         7  der Strich war zu kurz und ist weggewischt
   *   a, b   die Stelle in Zwanzigstelmillimetern
   * Die Blätter kommen aus derselben Saat. Wer zuschaut, baut den Strich
   * aus denselben Punkten und misst ihn selbst.
   */
  const zugOrt = (was, ort) => ({ a: ort ? Math.round(ort.x * ZUG_MM) : 0, b: ort ? Math.round(ort.y * ZUG_MM) : 0, c: state.index * 8 + was });

  function meldeZug(was, ort = null) {
    if (zuschauer) return;
    const zug = zugOrt(was, ort);
    aufnahme?.zug(state.punkte, zug);
    const live = window.LernappLiveSpiel;
    if (shell?.live && live?.zug && live.gestartet?.()) live.zug(state.punkte, zug);
  }

  function meldeLage(ort) {
    if (zuschauer) return;
    const zug = zugOrt(4, ort);
    aufnahme?.lage(state.punkte, zug);
    window.LernappLiveSpiel?.lage?.(state.punkte, zug);
  }

  // ---------------------------------------------------------------------------
  // Ablauf
  // ---------------------------------------------------------------------------
  function strichWeg() {
    state.roh = [];
    state.schreiber = null;
    state.zieht = null;
  }

  // Das Beispiel der Vorschau: ein zweites Blatt derselben Art – mit seiner
  // Lösung, die ein Bleistift von selbst zeichnet.
  function beispielFuer(a) {
    const b = lege(a.art, Math.random);
    const weg = b.ziele[0] || kreisWeg(P(54, 54), 26, Math.random() * TAU);
    return { teile: b.teile, weg, lang: wegLaenge(weg) };
  }

  // Das nächste Blatt kündigt sich an: erst die Vorschau – was zu tun ist,
  // mit einem Beispiel. Die Uhr läuft noch nicht.
  function blattAuf(index) {
    clearStep();
    state.index = index;
    state.phase = "vorschau";
    state.vorSeit = performance.now();
    state.t0 = state.vorSeit;
    state.gewendet = state.vorSeit;
    strichWeg();
    state.wertung = null;
    state.tickBei = 0;
    state.verworfen = 0;
    const a = blatt();
    state.beispiel = beispielFuer(a);
    if (status) status.textContent = `Blatt ${index + 1} von ${anzahl()}: ${a.kurz}. ${a.frage} Tippe, wenn du bereit bist.`;
    ton("freihand.blatt");
    meldeZug(0);
  }

  // Der Tipp nach der Vorschau: Jetzt liegt das Blatt da, und seine Uhr läuft.
  function blattLos() {
    if (state.phase !== "vorschau") return;
    state.phase = "aufgabe";
    state.t0 = performance.now();
    const a = blatt();
    if (status) status.textContent = `Blatt ${state.index + 1} von ${anzahl()}: ${a.frage}`;
    ton("freihand.tick");
    meldeZug(1);
  }

  const aufsBlatt = (p) => P(clamp(p.x, 0, BLATT), clamp(p.y, 0, BLATT));

  // Der Stift setzt auf: Der Strich beginnt.
  function stiftAb(ort, zeiger = 0, art = "mouse") {
    if (!offen() || state.zieht !== null || seit() < SPERRE) return false;
    const p = aufsBlatt(ort);
    state.zieht = zeiger;
    state.eingabe = art;
    state.roh = [p];
    state.schreiber = schreiberNeu(p);
    state.stift = p;
    state.stiftSeit = performance.now();
    state.tempo = 0;
    state.verworfen = 0;
    kratzenAn();
    meldeZug(2, state.schreiber.punkte[0]);
    return true;
  }

  // Der Stift fährt weiter.
  function stiftZu(ort) {
    if (state.zieht === null || state.phase !== "aufgabe") return;
    const p = aufsBlatt(ort);
    const vor = state.roh[state.roh.length - 1];
    const weg = abstand(vor, p);
    if (weg < 0.1) return;
    const jetzt = performance.now();
    const dt = Math.max(0.004, (jetzt - state.stiftSeit) / 1000);
    state.tempo += (weg / dt - state.tempo) * 0.35;
    state.stiftSeit = jetzt;
    state.roh.push(p);
    state.stift = p;
    const neu = schreibe(state.schreiber, p);
    if (neu) meldeZug(3, neu);
    else meldeLage(p);
  }

  // Der Stift hebt ab: Das ist die Antwort – ausser, es war nur ein Tupfer.
  function stiftAuf() {
    if (state.zieht === null) return;
    state.zieht = null;
    state.tempo = 0;
    if (state.phase !== "aufgabe" || !state.schreiber) return;
    schliesse(state.schreiber);
    const strich = state.schreiber.punkte;
    if (wegLaenge(strich) < STRICH_MIN) {
      state.roh = [];
      state.schreiber = null;
      state.verworfen = performance.now();
      meldeZug(7);
      return;
    }
    antworte(strich);
  }

  // Wo der Stempel hinkommt: an die Stelle des Blattes, die am weitesten von
  // allem Gezeichneten weg ist.
  function stempelOrt(a, strich, ziel) {
    const umriss = (t) => (t.t === "kreis" ? kreisWeg(t.m, t.r).filter((_, i) => i % 3 === 0) : t.t === "strecke" ? abtasten([t.a, t.b], 4) : t.t === "weg" ? abtasten(t.pkte, 4) : teilPunkte(t));
    const besetzt = [...a.teile.flatMap(umriss), ...(strich ? abtasten(strich, 3) : []), ...(ziel ? abtasten(ziel, 3) : [])];
    let best = P(78, 22);
    let frei = -1;
    for (const k of [P(79, 21), P(21, 21), P(79, 79), P(21, 79), P(50, 19), P(50, 81), P(19, 50), P(81, 50), P(50, 50)]) {
      const nah = Math.min(...besetzt.map((p) => abstand(p, k)), 99);
      if (nah > frei) { frei = nah; best = k; }
    }
    return best;
  }

  // Die Fransen: von Stellen des Strichs hinüber zur Form – man sieht, wo er
  // daneben lag.
  function fransenFuer(strich, ziel) {
    if (!strich || !ziel) return [];
    return abtasten(strich, 1.3).map((p) => ({ a: p, b: naechster(p, ziel).ort })).filter((f) => abstand(f.a, f.b) > 0.25);
  }

  // Die Antwort – strich ist der Linienzug, oder null, wenn die Zeit um war
  // und niemand gezeichnet hatte. soll: die Punkte, wie sie gezählt wurden
  // (beim Zuschauen – dort gilt, was der Lauf sagt).
  function antworte(strich, soll = null) {
    if (state.phase !== "aufgabe") return;
    clearStep();
    const a = blatt();
    state.phase = "zeigen";
    state.tZeig = performance.now();
    state.zieht = null;
    state.tempo = 0;
    const m = messe(a, strich);
    const punkte = strich && Number.isFinite(soll) && soll >= 0 && soll <= PUNKTE_JE_BLATT ? soll : m.punkte;
    state.wertung = { mm: m.mm, punkte, ziel: m.ziel, strich, fransen: fransenFuer(strich, m.ziel), stempel: stempelOrt(a, strich, m.ziel) };
    state.liste[state.index] = { mm: m.mm, punkte, strich, ziel: m.ziel };
    if (strich) state.roh = strich;
    state.punkte += punkte;
    if (punkte >= GENAU) state.genaue += 1;
    shell.setCount(state.punkte);
    meldeZug(strich ? 5 : 6, strich ? strich[strich.length - 1] : null);
    antwortKlang(punkte);
    if (punkte >= GENAU) { funkenBei(state.wertung.stempel); kids()?.vibrate?.([14, 40, 22]); } else if (punkte >= 50) kids()?.vibrate?.(12);
    if (status) status.textContent = strich ? `Im Schnitt ${m.mm.toFixed(2).replace(".", ",")} Millimeter daneben: ${punkte} Punkte.` : "Zeit um: 0 Punkte.";
    if (!zuschauer) stepTimer = window.setTimeout(weiter, ZEIGEN_MS);
  }

  // Die Lösung hat lange genug dagestanden: das nächste Blatt – oder, nach
  // dem zehnten, das Ergebnis.
  function weiter() {
    if (state.phase !== "zeigen" || zuschauer) return;
    clearStep();
    if (state.index + 1 >= anzahl()) finish();
    else blattAuf(state.index + 1);
  }

  // Überspringen (nur in der Testrunde): zur Vorschau des nächsten Blattes,
  // ohne das jetzige zu zeichnen – nach dem letzten zur Tafel.
  function ueberspringe() {
    if (!TESTRUNDE || zuschauer) return;
    if (state.phase === "bereit") { losGehts(); return; }
    if (state.phase !== "vorschau" && state.phase !== "aufgabe" && state.phase !== "zeigen") return;
    clearStep();
    strichWeg();
    kratzenAus();
    if (!state.liste[state.index]) state.liste[state.index] = { punkte: 0, mm: null, uebersprungen: true };
    if (state.index + 1 >= anzahl()) finish();
    else blattAuf(state.index + 1);
  }

  function uhrTakt() {
    if (zuschauer) return;
    if (state.phase === "vorschau") {
      if (performance.now() - state.vorSeit >= VORSCHAU * 1000) blattLos();
      return;
    }
    if (state.phase !== "aufgabe") return;
    const rest = EINZUG + blatt().zeit - seit();
    // Die letzten drei Sekunden ticken.
    const sekunde = Math.ceil(rest);
    if (rest > 0 && sekunde <= 3 && sekunde !== state.tickBei) { state.tickBei = sekunde; ton("freihand.tick"); }
    // Ist die Zeit um, zählt der Strich, wie er dasteht.
    if (rest <= 0) {
      if (state.zieht !== null) stiftAuf();
      if (state.phase === "aufgabe") antworte(null);
    }
  }

  function takt(dt) {
    if (zuschauer && state.phase !== "ende") zuschauenTakt();
    else uhrTakt();
    // Steht der Stift, verstummt das Kratzen.
    if (performance.now() - state.stiftSeit > 90) state.tempo *= Math.exp(-dt * 18);
    const fahrt = state.zieht !== null || (zuschauer && state.phase === "aufgabe") ? clamp(state.tempo / 160, 0, 1) : 0;
    kratzen?.laut(fahrt);
    kratzen?.setze(clamp(0.25 + fahrt * 0.75, 0, 1));
    for (let i = state.funken.length - 1; i >= 0; i -= 1) {
      const f = state.funken[i];
      f.alt += dt;
      if (f.alt >= f.leben) { state.funken.splice(i, 1); continue; }
      f.x += f.vx * dt;
      f.y += f.vy * dt;
      f.vy += 60 * dt;
      f.vx *= 1 - 2.2 * dt;
      f.vy *= 1 - 2.2 * dt;
    }
  }

  // Flüssig vor scharf: Stockt das Bild über eine gute Sekunde, wird es
  // gröber gemalt statt langsamer – und bleibt so für den Rest des Besuchs.
  let bildZeit = 1 / 60;
  let zaeh = 0;
  function gueteTakt(sekunden) {
    if (sekunden > 0.2 || document.hidden) { zaeh = 0; return; }
    bildZeit += (sekunden - bildZeit) * 0.06;
    zaeh = bildZeit > 0.024 ? zaeh + sekunden : 0;
    if (zaeh > 1.2 && view.guete > 0.5) {
      view.guete *= 0.8;
      view.cssW = 0;
      zaeh = 0;
      bildZeit = 1 / 60;
    }
  }

  function loop(now) {
    frame = window.requestAnimationFrame(loop);
    gueteTakt((now - last) / 1000);
    const dt = clamp((now - last) / 1000, 0, 0.05);
    last = now;
    messen();
    takt(dt);
    zeichnen();
  }

  // ---------------------------------------------------------------------------
  // Die Fläche
  // ---------------------------------------------------------------------------
  function buildPlatz() {
    const platz = shell.el("div", "fh-platz");
    feld = shell.el("div", "fh-feld");
    canvas = document.createElement("canvas");
    canvas.className = "fh-canvas";
    canvas.setAttribute("aria-hidden", "true");
    feld.append(canvas);
    g = canvas.getContext("2d");
    status = shell.el("p", "cm-sr");
    status.setAttribute("aria-live", "polite");
    platz.append(feld, status);
    return platz;
  }

  function messen() {
    if (!canvas || !feld) return;
    const cssW = Math.max(80, feld.clientWidth);
    const cssH = Math.max(80, feld.clientHeight);
    // Feine Linien wollen Bildpunkte: bis zur dreifachen Dichte, aber nie
    // viel mehr als gut drei Millionen.
    const dpr = clamp(Math.min(window.devicePixelRatio || 1, Math.sqrt(3.4e6 / (cssW * cssH))), 1, 3) * view.guete;
    const frei = Math.min(cssH * 0.3, shell?.frei?.(canvas) || 0);
    if (cssW === view.cssW && cssH === view.cssH && dpr === view.dpr && frei === view.frei) return;
    view.cssW = cssW;
    view.cssH = cssH;
    view.dpr = dpr;
    view.frei = frei;
    view.hoch = cssH > cssW * 1.05;
    const u = clamp(Math.min(cssW, cssH - frei) / 400, 0.72, 1.3);
    view.u = u;
    const hoehe = cssH - frei;
    // Auf einem breiten Bild steht die Frage links neben dem Blatt und die
    // Mappe rechts – so bleibt dem Blatt die ganze Höhe.
    view.flach = !view.hoch && cssW >= hoehe * 1.5;
    let seite;
    if (view.flach) {
      seite = Math.max(120, Math.min(hoehe - Math.round(26 * u), cssW * 0.5));
      view.x0 = Math.round((cssW - seite) / 2);
      view.y0 = Math.round(frei + (hoehe - seite) / 2);
      const spalte = view.x0 - Math.round(36 * u);
      view.text = { x: Math.round(18 * u), y: view.y0 + Math.round(6 * u), w: Math.min(spalte, 340) };
      const breit = Math.min(spalte, 250 * u);
      view.mappe = { x: Math.round(view.x0 + seite + (cssW - view.x0 - seite - breit) / 2), y: view.y0 + Math.round(8 * u), w: breit, h: seite - Math.round(16 * u), spalten: 2 };
    } else {
      const kopf = Math.round(102 * u);
      let fuss = Math.round(74 * u);
      seite = Math.max(120, Math.min(cssW - 24, hoehe - kopf - fuss - 8));
      // Bleibt unter dem Blatt Platz (ein hohes Handy), liegt die Mappe in
      // zwei Reihen da – so sind die Blättchen gross genug, um etwas zu sehen.
      const zweiReihen = Math.round(2 * ((seite - 4 * 8) / 5 + 15 * u + 8) + 22 * u);
      const reihen = hoehe - kopf - seite - 8 >= zweiReihen ? 2 : 1;
      if (reihen === 2) fuss = zweiReihen;
      const rest = Math.max(0, hoehe - kopf - fuss - seite);
      view.x0 = Math.round((cssW - seite) / 2);
      view.y0 = Math.round(frei + kopf + rest * 0.42);
      view.text = { x: view.x0 + 2, y: view.y0 - kopf + Math.round(4 * u), w: seite - 4 };
      view.mappe = { x: view.x0, y: view.y0 + seite + Math.round(20 * u), w: seite, h: fuss - Math.round(22 * u), spalten: reihen === 2 ? 5 : 10 };
    }
    view.seite = seite;
    view.s = seite / BLATT;
    const pw = Math.round(cssW * dpr);
    const ph = Math.round(cssH * dpr);
    if (canvas.width !== pw) canvas.width = pw;
    if (canvas.height !== ph) canvas.height = ph;
    papier = null;
  }

  // Die Stelle des Blattes, auf die ein Zeiger zeigt.
  function blattOrt(event) {
    const r = canvas.getBoundingClientRect();
    return P((event.clientX - r.left - view.x0) / view.s, (event.clientY - r.top - view.y0) / view.s);
  }

  // ---------------------------------------------------------------------------
  // Zeichnen
  // ---------------------------------------------------------------------------
  const TINTE = "#26314b";
  const TINTE_ZART = "rgba(38, 49, 75, 0.5)";
  const ROT = "#d5352b";
  const GRAPHIT = "#2e2f35";
  const GOLD = "#c98a12";
  const SERIF = 'Georgia, "Times New Roman", serif';
  const SANS = "system-ui, sans-serif";
  const STUFEN_FARBE = ["#3aa56b", "#d99a1c", "#d5352b"];

  // Das Papier: einmal gemalt, mit seinem Schatten, dem Korn und zwei
  // Streifen Klebband – danach nur noch hingelegt.
  let papier = null;
  const PAPIER_RAND = 26;
  function papierBild() {
    if (papier) return papier;
    const d = view.dpr;
    const seite = view.seite;
    const rand = PAPIER_RAND;
    const c = document.createElement("canvas");
    c.width = Math.round((seite + rand * 2) * d);
    c.height = Math.round((seite + rand * 2) * d);
    const z = c.getContext("2d");
    z.scale(d, d);
    z.translate(rand, rand);
    const r = Math.max(3, seite * 0.012);
    const form = () => { z.beginPath(); z.roundRect ? z.roundRect(0, 0, seite, seite, r) : z.rect(0, 0, seite, seite); };
    z.save();
    z.shadowColor = "rgba(0, 0, 0, 0.5)";
    z.shadowBlur = 20;
    z.shadowOffsetY = 7;
    z.fillStyle = "#f4ecdb";
    form();
    z.fill();
    z.restore();
    const verlauf = z.createLinearGradient(0, 0, seite, seite);
    verlauf.addColorStop(0, "#f8f1e2");
    verlauf.addColorStop(1, "#ece2cc");
    z.fillStyle = verlauf;
    form();
    z.fill();
    z.save();
    form();
    z.clip();
    // Das Korn: helle und dunkle Fasern.
    const n = Math.round(seite * seite * 0.012);
    for (let i = 0; i < n; i += 1) {
      const x = Math.random() * seite;
      const y = Math.random() * seite;
      const lang = 1 + Math.random() * 5;
      const w = Math.random() * Math.PI;
      z.strokeStyle = Math.random() < 0.5 ? "rgba(120, 96, 60, 0.05)" : "rgba(255, 255, 255, 0.16)";
      z.lineWidth = 0.6;
      z.beginPath();
      z.moveTo(x, y);
      z.lineTo(x + Math.cos(w) * lang, y + Math.sin(w) * lang);
      z.stroke();
    }
    // Zum Rand hin ein Hauch dunkler.
    const rund = z.createRadialGradient(seite / 2, seite / 2, seite * 0.35, seite / 2, seite / 2, seite * 0.78);
    rund.addColorStop(0, "rgba(120, 90, 40, 0)");
    rund.addColorStop(1, "rgba(120, 90, 40, 0.13)");
    z.fillStyle = rund;
    z.fillRect(0, 0, seite, seite);
    z.restore();
    z.strokeStyle = "rgba(90, 70, 40, 0.25)";
    z.lineWidth = 1;
    form();
    z.stroke();
    // Das Klebband oben links und rechts.
    for (const [x, w] of [[seite * 0.1, -0.5], [seite * 0.9, 0.42]]) {
      z.save();
      z.translate(x, 0);
      z.rotate(w);
      z.fillStyle = "rgba(232, 214, 150, 0.72)";
      z.fillRect(-seite * 0.075, -seite * 0.024, seite * 0.15, seite * 0.048);
      z.fillStyle = "rgba(255, 255, 255, 0.25)";
      z.fillRect(-seite * 0.075, -seite * 0.024, seite * 0.15, seite * 0.012);
      z.restore();
    }
    papier = c;
    return c;
  }

  // Der Graphit: ein Muster aus dunklem Korn, damit der Strich nach
  // Bleistift aussieht und nicht nach Filzstift.
  let graphit = null;
  function graphitMuster() {
    if (graphit !== null) return graphit || GRAPHIT;
    try {
      const c = document.createElement("canvas");
      c.width = 96;
      c.height = 96;
      const z = c.getContext("2d");
      const bild = z.createImageData(96, 96);
      for (let i = 0; i < bild.data.length; i += 4) {
        const k = Math.random();
        bild.data[i] = 40 + k * 14;
        bild.data[i + 1] = 41 + k * 14;
        bild.data[i + 2] = 48 + k * 14;
        bild.data[i + 3] = k < 0.14 ? 120 : 205 + k * 50;
      }
      z.putImageData(bild, 0, 0);
      graphit = g.createPattern(c, "repeat");
    } catch { graphit = false; }
    return graphit || GRAPHIT;
  }

  // Im Blatt zeichnen: Danach gelten Millimeter, der Nullpunkt ist seine
  // linke obere Ecke.
  function aufBlatt(x0, y0, s, tun) {
    g.save();
    g.translate(x0, y0);
    g.scale(s, s);
    // Das Korn des Graphits bleibt so fein wie die Bildpunkte.
    const muster = graphitMuster();
    if (muster && muster.setTransform) { try { muster.setTransform(new DOMMatrix().scale(1 / (s * view.dpr))); } catch { /* dann eben grob */ } }
    tun();
    g.restore();
  }

  function pfad(pkte, zu = false) {
    g.beginPath();
    pkte.forEach((p, i) => (i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y)));
    if (zu) g.closePath();
  }

  // Der Strich des Bleistifts: weich durch die Punkte, mit einem breiten,
  // blassen Saum darunter.
  function zeichneStrich(pkte, k = 1, weichZiehen = true) {
    if (!pkte || pkte.length < 2) return;
    g.save();
    g.lineCap = "round";
    g.lineJoin = "round";
    g.beginPath();
    g.moveTo(pkte[0].x, pkte[0].y);
    if (weichZiehen && pkte.length > 2) {
      for (let i = 1; i < pkte.length - 1; i += 1) g.quadraticCurveTo(pkte[i].x, pkte[i].y, (pkte[i].x + pkte[i + 1].x) / 2, (pkte[i].y + pkte[i + 1].y) / 2);
      g.lineTo(pkte[pkte.length - 1].x, pkte[pkte.length - 1].y);
    } else {
      for (let i = 1; i < pkte.length; i += 1) g.lineTo(pkte[i].x, pkte[i].y);
    }
    g.globalAlpha = 0.1 * k;
    g.strokeStyle = GRAPHIT;
    g.lineWidth = 1.7;
    g.stroke();
    g.globalAlpha = k;
    g.strokeStyle = graphitMuster();
    g.lineWidth = 0.78;
    g.stroke();
    g.restore();
  }

  // Was auf dem Blatt gegeben ist, in Tinte. k: wie weit es schon da ist.
  function zeichneTeile(teile, k = 1, mitSchrift = true, dick = 1) {
    const alle = teile.flatMap(teilPunkte);
    const mx = mittel(alle.map((p) => p.x));
    const my = mittel(alle.map((p) => p.y));
    const schrift = (text, p, weit = 4.4) => {
      if (!mitSchrift) return;
      let weg = P(p.x - mx, p.y - my);
      weg = laenge(weg) < 0.5 ? P(0.6, -0.8) : mal(weg, 1 / laenge(weg));
      g.font = `italic 600 5.2px ${SERIF}`;
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillStyle = TINTE;
      g.fillText(text, clamp(p.x + weg.x * weit, 4, BLATT - 4), clamp(p.y + weg.y * weit, 4.5, BLATT - 4));
    };
    g.save();
    g.globalAlpha = k;
    g.lineCap = "round";
    g.lineJoin = "round";
    g.strokeStyle = TINTE;
    g.fillStyle = TINTE;
    for (const t of teile) {
      g.lineWidth = 0.5 * dick;
      g.setLineDash(t.stil === "strich" ? [1.8, 1.5] : []);
      if (t.t === "strecke") {
        if (t.stil === "spiegel") {
          // Der Spiegel: eine doppelte Linie.
          const n = mal(quer(minus(t.b, t.a)), 0.55 / abstand(t.a, t.b));
          g.lineWidth = 0.34 * dick;
          for (const seite of [-1, 1]) { pfad([plus(t.a, n, seite), plus(t.b, n, seite)]); g.stroke(); }
        } else {
          pfad([t.a, t.b]);
          g.stroke();
        }
        if (t.enden) {
          g.setLineDash([]);
          for (const p of [t.a, t.b]) { g.beginPath(); g.arc(p.x, p.y, 0.95, 0, TAU); g.fill(); }
        }
      } else if (t.t === "weg") {
        pfad(t.pkte, t.zu);
        g.stroke();
        if (t.pkte.length <= 6) for (const p of t.pkte) { g.beginPath(); g.arc(p.x, p.y, 0.8, 0, TAU); g.fill(); }
      } else if (t.t === "punkt") {
        g.beginPath();
        g.arc(t.p.x, t.p.y, 1.05, 0, TAU);
        g.fill();
        if (t.name) schrift(t.name, t.p);
      } else if (t.t === "kreuz") {
        g.lineWidth = 0.42 * dick;
        pfad([P(t.p.x - 1.7, t.p.y), P(t.p.x + 1.7, t.p.y)]);
        g.stroke();
        pfad([P(t.p.x, t.p.y - 1.7), P(t.p.x, t.p.y + 1.7)]);
        g.stroke();
        if (t.name) schrift(t.name, t.p, 4.8);
      } else if (t.t === "kreis") {
        if (t.stil === "muenze") {
          // Die Münze: Messing, mit Rand und einer Eins.
          const glanz = g.createRadialGradient(t.m.x - t.r * 0.35, t.m.y - t.r * 0.4, t.r * 0.1, t.m.x, t.m.y, t.r);
          glanz.addColorStop(0, "#f6dc8a");
          glanz.addColorStop(0.7, "#cfa23a");
          glanz.addColorStop(1, "#9a7320");
          g.fillStyle = glanz;
          g.beginPath(); g.arc(t.m.x, t.m.y, t.r, 0, TAU); g.fill();
          g.strokeStyle = "rgba(90, 62, 10, 0.75)";
          g.lineWidth = 0.4 * dick;
          g.stroke();
          g.beginPath(); g.arc(t.m.x, t.m.y, t.r * 0.8, 0, TAU);
          g.lineWidth = 0.25 * dick;
          g.stroke();
          g.fillStyle = "rgba(90, 62, 10, 0.8)";
          g.font = `700 ${t.r * 1.05}px ${SERIF}`;
          g.textAlign = "center";
          g.textBaseline = "middle";
          g.fillText("1", t.m.x, t.m.y + t.r * 0.06);
          g.strokeStyle = TINTE;
          g.fillStyle = TINTE;
        } else {
          g.beginPath(); g.arc(t.m.x, t.m.y, t.r, 0, TAU); g.stroke();
        }
      } else if (t.t === "bogen") {
        g.beginPath(); g.arc(t.m.x, t.m.y, t.r, t.von, t.bis, t.bis < t.von); g.stroke();
      } else if (t.t === "pfeil") {
        // Die Drehrichtung: ein Bogen mit Spitze.
        g.strokeStyle = TINTE_ZART;
        g.fillStyle = TINTE_ZART;
        g.lineWidth = 0.45 * dick;
        g.beginPath(); g.arc(t.m.x, t.m.y, t.r, t.von, t.bis, t.bis < t.von); g.stroke();
        const ende = plus(t.m, richt(t.bis), t.r);
        const hin = mal(quer(richt(t.bis)), t.bis < t.von ? -1 : 1);
        const breit = richt(t.bis);
        g.beginPath();
        g.moveTo(ende.x + hin.x * 2.4, ende.y + hin.y * 2.4);
        g.lineTo(ende.x + breit.x * 1.3 - hin.x * 0.3, ende.y + breit.y * 1.3 - hin.y * 0.3);
        g.lineTo(ende.x - breit.x * 1.3 - hin.x * 0.3, ende.y - breit.y * 1.3 - hin.y * 0.3);
        g.closePath();
        g.fill();
        g.strokeStyle = TINTE;
        g.fillStyle = TINTE;
      } else if (t.t === "text") {
        schrift(t.text, t.p, 0);
      }
    }
    g.restore();
  }

  // Der Bleistift selbst: die Spitze bei p (in Bildpunkten), schräg in der Hand.
  function zeichneStift(px, py, k = 1, gross = 1) {
    const u = view.u * gross;
    g.save();
    g.translate(px, py);
    g.rotate(-0.62);
    g.globalAlpha = k;
    const lang = 150 * u;
    const dick = 6.2 * u;
    const kegel = 20 * u;
    // Der Schatten auf dem Papier.
    g.save();
    g.rotate(0.13);
    g.fillStyle = "rgba(0, 0, 0, 0.16)";
    g.beginPath();
    g.moveTo(0, 0);
    g.lineTo(dick, -kegel);
    g.lineTo(dick, -lang);
    g.lineTo(-dick, -lang);
    g.lineTo(-dick, -kegel);
    g.closePath();
    g.fill();
    g.restore();
    // Das Holz und die Mine.
    g.fillStyle = "#e7c391";
    g.beginPath(); g.moveTo(0, 0); g.lineTo(dick, -kegel); g.lineTo(-dick, -kegel); g.closePath(); g.fill();
    g.fillStyle = "#2b2c31";
    g.beginPath(); g.moveTo(0, 0); g.lineTo(dick * 0.33, -kegel * 0.33); g.lineTo(-dick * 0.33, -kegel * 0.33); g.closePath(); g.fill();
    // Der Schaft: drei Flächen des Sechskants.
    const flaechen = [["#b3261e", -dick, -dick * 0.36], ["#e2473c", -dick * 0.36, dick * 0.36], ["#c8332a", dick * 0.36, dick]];
    for (const [farbe, a, b] of flaechen) { g.fillStyle = farbe; g.fillRect(a, -lang + 18 * u, b - a, lang - 18 * u - kegel); }
    // Die Zwinge und der Radiergummi.
    g.fillStyle = "#c9ccd4";
    g.fillRect(-dick, -lang + 8 * u, dick * 2, 10 * u);
    g.fillStyle = "rgba(0, 0, 0, 0.18)";
    g.fillRect(-dick, -lang + 11 * u, dick * 2, 1.4 * u);
    g.fillRect(-dick, -lang + 14.5 * u, dick * 2, 1.4 * u);
    g.fillStyle = "#e8a0a8";
    g.beginPath();
    g.roundRect ? g.roundRect(-dick, -lang - 4 * u, dick * 2, 12 * u, 3 * u) : g.rect(-dick, -lang - 4 * u, dick * 2, 12 * u);
    g.fill();
    g.restore();
  }

  // Der Text in Zeilen, die in die Breite passen.
  function umbrechen(text, breit) {
    const zeilen = [];
    let zeile = "";
    for (const wort of text.split(" ")) {
      const neu = zeile ? `${zeile} ${wort}` : wort;
      if (zeile && g.measureText(neu).width > breit) { zeilen.push(zeile); zeile = wort; } else zeile = neu;
    }
    if (zeile) zeilen.push(zeile);
    return zeilen;
  }

  // Die Vorschau, auf dem leeren Blatt: was zu tun ist, und ein Beispiel,
  // das sich selbst zeichnet. (In Millimetern.)
  function zeichneVorschau(a, k) {
    const jetzt = performance.now();
    const t = (jetzt - state.vorSeit) / 1000;
    g.save();
    g.globalAlpha = k;
    g.textAlign = "center";
    g.textBaseline = "alphabetic";
    g.fillStyle = STUFEN_FARBE[a.stufe];
    g.font = `700 3.3px ${SANS}`;
    g.fillText(`${TESTRUNDE ? "TESTRUNDE" : "BLATT"} ${state.index + 1} VON ${anzahl()}  ·  ${STUFE[a.stufe].toUpperCase()}`, 50, 10.5);
    g.fillStyle = TINTE;
    g.font = `italic 700 8.4px ${SERIF}`;
    g.fillText(a.kurz, 50, 20.5);
    g.font = `500 4px ${SANS}`;
    const zeilen = umbrechen(a.frage, 84);
    zeilen.forEach((zeile, i) => g.fillText(zeile, 50, 27.5 + i * 5.1));
    // Das Beispiel: ein kleines Blatt im Blatt.
    const oben = 27.5 + zeilen.length * 5.1 - 1.5;
    const kante = Math.min(52, 88 - oben);
    const x = 50 - kante / 2;
    g.fillStyle = "rgba(255, 255, 255, 0.5)";
    g.strokeStyle = "rgba(38, 49, 75, 0.28)";
    g.lineWidth = 0.3;
    g.setLineDash([1.4, 1.2]);
    g.beginPath();
    g.roundRect ? g.roundRect(x, oben, kante, kante, 1.6) : g.rect(x, oben, kante, kante);
    g.fill();
    g.stroke();
    g.setLineDash([]);
    g.restore();
    const b = state.beispiel;
    if (b) {
      // Der Bleistift zeichnet die Lösung, hält inne, und beginnt von vorn.
      const dauer = clamp(b.lang / 55, 1.1, 2.6);
      const lauf = t % (dauer + 1.3);
      const anteil = ruhig() ? 1 : weich(0, 1, clamp((lauf - 0.35) / dauer, 0, 1));
      const s = kante / BLATT;
      g.save();
      g.globalAlpha = k;
      g.translate(x, oben);
      g.scale(s, s);
      zeichneTeile(b.teile, 1);
      const bisher = teilWeg(b.weg, anteil);
      g.lineCap = "round";
      g.lineJoin = "round";
      g.strokeStyle = GRAPHIT;
      g.lineWidth = 1.5;
      pfad(bisher);
      g.stroke();
      g.restore();
      if (!ruhig() && anteil > 0 && anteil < 1) {
        const spitze = bisher[bisher.length - 1];
        state.beispielStift = P(x + spitze.x * s, oben + spitze.y * s);
      } else state.beispielStift = null;
    }
    // Unten: wie es weitergeht.
    const rest = VORSCHAU - t;
    g.save();
    g.textAlign = "center";
    g.globalAlpha = k * (rest <= VOR_ZAEHLT ? 1 : 0.55 + 0.45 * Math.sin(jetzt / 320) ** 2);
    g.fillStyle = rest <= VOR_ZAEHLT ? ROT : TINTE;
    g.font = `700 4.1px ${SANS}`;
    g.fillText(rest <= VOR_ZAEHLT ? `Es geht los in ${Math.max(1, Math.ceil(rest))}` : zuschauer ? "gleich geht es los" : "Tippe, wenn du bereit bist", 50, 95);
    g.restore();
  }

  // Das Blatt vor der ersten Runde: der Titel, und darunter zeichnet sich
  // immer wieder ein Kreis.
  function zeichneTitel() {
    const jetzt = performance.now();
    g.save();
    g.textAlign = "center";
    g.fillStyle = TINTE;
    g.font = `italic 700 13px ${SERIF}`;
    g.fillText("Freihand", 50, 24);
    g.font = `500 4.1px ${SANS}`;
    g.fillText(TESTRUNDE ? `Testrunde: alle ${anzahl()} Blätter.` : "Zehn Blätter. Ein Strich je Blatt.", 50, 32.5);
    g.fillText(TESTRUNDE ? "Es zählt nichts." : "Kein Lineal, kein Zirkel.", 50, 37.8);
    g.restore();
    // Der Kreis, der nie ganz rund wird.
    const lauf = ruhig() ? 1 : ((jetzt / 1000) % 4.2) / 2.6;
    const kreis = [];
    for (let i = 0; i <= 90; i += 1) {
      const w = -1.9 + (i / 90) * TAU * 1.02;
      const r = 19 + Math.sin(w * 2 + 0.7) * 0.7 + Math.sin(w * 5) * 0.25 + (i / 90) * 0.9;
      kreis.push(P(50 + Math.cos(w) * r, 64 + Math.sin(w) * r));
    }
    const bisher = teilWeg(kreis, weich(0, 1, clamp(lauf, 0, 1)));
    zeichneStrich(bisher, 1, false);
    state.beispielStift = lauf < 1 ? bisher[bisher.length - 1] : null;
    g.save();
    g.textAlign = "center";
    g.globalAlpha = 0.55 + 0.45 * Math.sin(jetzt / 320) ** 2;
    g.fillStyle = TINTE;
    g.font = `700 4.1px ${SANS}`;
    g.fillText(zuschauer ? "gleich geht es los" : shell?.live ? "gleich geht es los" : "Tippe, um zu beginnen", 50, 95);
    g.restore();
  }

  // Die Lösung: Der Rotstift zieht die ideale Form, die Fransen zeigen, wo
  // der Strich daneben lag, und der Stempel sagt, was es dafür gibt.
  function zeichneLoesung(tz) {
    const w = state.wertung;
    if (!w) return;
    if (w.ziel) {
      const anteil = ruhig() ? 1 : weich(0, 1, clamp((tz - 0.12) / 0.62, 0, 1));
      const fr = weich(0.45, 0.95, tz);
      if (fr > 0 && w.fransen.length) {
        g.save();
        g.globalAlpha = 0.34 * fr;
        g.strokeStyle = ROT;
        g.lineWidth = 0.22;
        g.beginPath();
        for (const f of w.fransen) { g.moveTo(f.a.x, f.a.y); g.lineTo(f.b.x, f.b.y); }
        g.stroke();
        g.restore();
      }
      g.save();
      g.lineCap = "round";
      g.lineJoin = "round";
      g.strokeStyle = ROT;
      g.lineWidth = 0.55;
      g.globalAlpha = 0.92;
      pfad(teilWeg(w.ziel, anteil));
      g.stroke();
      g.restore();
    }
    // Der Stempel: fällt aufs Papier und federt nach.
    const ts = tz - 0.62;
    if (ts <= 0) return;
    const fall = ruhig() ? 1 : 1 + 0.9 * Math.exp(-ts * 16) * Math.cos(ts * 20);
    const farbe = !w.strich ? "#8a8f9c" : w.punkte >= GENAU ? GOLD : w.punkte >= 66 ? "#2f8f5b" : w.punkte >= 33 ? "#3a5fb0" : ROT;
    g.save();
    g.translate(w.stempel.x, w.stempel.y);
    g.rotate(((state.index * 37) % 17 - 8) * 0.018);
    g.scale(fall, fall);
    g.globalAlpha = clamp(ts * 9, 0, 1) * 0.9;
    g.strokeStyle = farbe;
    g.fillStyle = farbe;
    g.lineWidth = 0.75;
    g.beginPath(); g.arc(0, 0, 11.4, 0, TAU); g.stroke();
    g.lineWidth = 0.3;
    g.beginPath(); g.arc(0, 0, 9.9, 0, TAU); g.stroke();
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.font = `800 ${w.punkte >= 100 ? 9.4 : 11}px ${SANS}`;
    g.fillText(w.strich ? String(w.punkte) : "0", 0, -1);
    g.font = `700 ${w.strich && w.punkte >= GENAU ? 2.2 : 2.75}px ${SANS}`;
    g.fillText(!w.strich ? "ZEIT UM" : w.punkte >= GENAU ? "HAARGENAU" : `Ø ${w.mm.toFixed(2).replace(".", ",")} mm`, 0, 6.2);
    g.restore();
  }

  // Ein Blättchen der Mappe: der Strich und die Form, ganz klein.
  function blaettchen(i, x, y, kante, schrift) {
    // Übersprungen (Testrunde): wie offen, mit einem Strich statt der Zahl.
    const weg = state.liste[i]?.uebersprungen;
    const e = weg ? null : state.liste[i];
    const dran = i === state.index && state.phase !== "ende" && state.phase !== "bereit" && state.phase !== "warten";
    g.save();
    g.beginPath();
    g.roundRect ? g.roundRect(x, y, kante, kante, Math.max(2, kante * 0.1)) : g.rect(x, y, kante, kante);
    if (e) {
      g.fillStyle = "#f2e9d6";
      g.fill();
      const s = kante / BLATT;
      g.save();
      g.translate(x, y);
      g.scale(s, s);
      g.lineCap = "round";
      g.lineJoin = "round";
      // Was gegeben war, zart; darüber die Form und der Strich.
      zeichneTeile(state.blaetter[i].teile, 0.55, false, 3.2);
      if (e.ziel) { g.strokeStyle = "rgba(213, 53, 43, 0.75)"; g.lineWidth = 2.6; pfad(e.ziel); g.stroke(); }
      if (e.strich) { g.strokeStyle = GRAPHIT; g.lineWidth = 3.4; pfad(e.strich); g.stroke(); }
      g.restore();
    } else {
      g.fillStyle = dran ? "rgba(244, 236, 219, 0.2)" : "rgba(244, 236, 219, 0.07)";
      g.fill();
      g.strokeStyle = dran ? "#f4ecdb" : "rgba(244, 236, 219, 0.22)";
      g.lineWidth = dran ? 1.6 : 1;
      g.stroke();
    }
    g.textAlign = "center";
    g.textBaseline = "top";
    g.font = `700 ${schrift}px ${SANS}`;
    g.fillStyle = e ? (e.punkte >= GENAU ? "#ffd166" : "#e9edf6") : "rgba(233, 237, 246, 0.4)";
    g.fillText(e ? String(e.punkte) : weg ? "–" : String(i + 1), x + kante / 2, y + kante + Math.max(2, schrift * 0.25));
    g.restore();
  }

  // Die Mappe: zehn Blättchen, eines je Blatt.
  function zeichneMappe() {
    const m = view.mappe;
    if (!m) return;
    // Hat die Runde mehr als zehn Blätter (die Testrunde), zeigt die Mappe
    // die zehn, zu denen das jetzige gehört.
    const ab = Math.floor(Math.min(state.index, anzahl() - 1) / BLAETTER) * BLAETTER;
    const zeichneBlaettchen = (i, ...rest) => { if (ab + i < anzahl()) blaettchen(ab + i, ...rest); };
    if (m.spalten === 10) {
      const luft = Math.max(3, m.w * 0.014);
      const schrift = clamp(m.w / 33, 9, 13);
      const kante = Math.min((m.w - luft * 9) / 10, m.h - schrift - 5);
      const breit = kante * 10 + luft * 9;
      for (let i = 0; i < BLAETTER; i += 1) zeichneBlaettchen(i, m.x + (m.w - breit) / 2 + i * (kante + luft), m.y, kante, schrift);
    } else if (m.spalten === 5) {
      const luft = 8;
      const schrift = Math.round(13 * view.u);
      const kante = (m.w - luft * 4) / 5;
      const hoch = kante + schrift + 10;
      for (let i = 0; i < BLAETTER; i += 1) zeichneBlaettchen(i, m.x + (i % 5) * (kante + luft), m.y + Math.floor(i / 5) * hoch, kante, schrift);
    } else {
      const reihe = m.h / 5;
      const schrift = clamp(reihe * 0.2, 9, 14);
      const luft = 8;
      const kante = Math.max(12, Math.min((m.w - luft) / 2, reihe - schrift - 8));
      const hoch = kante + schrift + 8;
      const x0 = m.x + (m.w - kante * 2 - luft) / 2;
      const y0 = m.y + Math.max(0, (m.h - hoch * 5) / 2);
      for (let i = 0; i < BLAETTER; i += 1) zeichneBlaettchen(i, x0 + (i % 2) * (kante + luft), y0 + Math.floor(i / 2) * hoch, kante, schrift);
    }
  }

  // Über dem Blatt (oder links daneben): welches Blatt, was zu tun ist.
  function zeichneKopf() {
    const a = blatt();
    const t = view.text;
    if (!a || !t || state.phase === "bereit" || state.phase === "warten" || state.phase === "ende") return;
    const u = view.u;
    g.save();
    g.textAlign = "left";
    g.textBaseline = "top";
    g.font = `700 ${Math.round(11.5 * u)}px ${SANS}`;
    g.fillStyle = STUFEN_FARBE[a.stufe];
    g.fillText(`${TESTRUNDE ? "TEST" : "BLATT"} ${state.index + 1}/${anzahl()}  ·  ${STUFE[a.stufe].toUpperCase()}`, t.x, t.y);
    g.fillStyle = "#f4f1e8";
    g.font = `italic 700 ${Math.round(22 * u)}px ${SERIF}`;
    g.fillText(a.kurz, t.x, t.y + 16 * u);
    if (state.phase !== "vorschau") {
      g.font = `500 ${Math.round(13.5 * u)}px ${SANS}`;
      g.fillStyle = "rgba(233, 237, 246, 0.82)";
      umbrechen(a.frage, t.w).slice(0, view.flach ? 8 : 3).forEach((zeile, i) => g.fillText(zeile, t.x, t.y + 44 * u + i * 17 * u));
    }
    g.restore();
  }

  // Die Uhr: ein Balken unter dem Blatt, der abläuft.
  function zeichneUhr() {
    if (state.phase !== "aufgabe") return;
    const a = blatt();
    const rest = clamp((EINZUG + a.zeit - seit()) / a.zeit, 0, 1);
    const eng = rest * a.zeit <= 3;
    const hoch = Math.max(4, 5 * view.u);
    const y = view.y0 + view.seite + Math.round(7 * view.u);
    g.save();
    g.fillStyle = "rgba(244, 236, 219, 0.14)";
    g.beginPath();
    g.roundRect ? g.roundRect(view.x0, y, view.seite, hoch, hoch / 2) : g.rect(view.x0, y, view.seite, hoch);
    g.fill();
    g.fillStyle = eng ? "#ff6a5c" : "#f4ecdb";
    g.globalAlpha = eng ? 0.75 + 0.25 * Math.sin(performance.now() / 90) ** 2 : 0.9;
    g.beginPath();
    g.roundRect ? g.roundRect(view.x0, y, Math.max(hoch, view.seite * rest), hoch, hoch / 2) : g.rect(view.x0, y, view.seite * rest, hoch);
    g.fill();
    g.restore();
  }

  function zeichneFunken() {
    if (!state.funken.length) return;
    g.save();
    for (const f of state.funken) {
      g.globalAlpha = clamp(1 - f.alt / f.leben, 0, 1);
      g.fillStyle = "#ffcf5a";
      g.beginPath();
      g.arc(view.x0 + f.x * view.s, view.y0 + f.y * view.s, f.gross * view.u * 2.2, 0, TAU);
      g.fill();
    }
    g.restore();
  }

  function zeichnen() {
    if (!g || !view.cssW) return;
    const d = view.dpr;
    const jetzt = performance.now();
    g.setTransform(d, 0, 0, d, 0, 0);
    // Der Tisch: dunkel, mit einem Lichtkegel über dem Blatt.
    g.fillStyle = "#12141c";
    g.fillRect(0, 0, view.cssW, view.cssH);
    const licht = g.createRadialGradient(view.x0 + view.seite / 2, view.y0 + view.seite * 0.4, view.seite * 0.2, view.x0 + view.seite / 2, view.y0 + view.seite / 2, view.seite * 1.25);
    licht.addColorStop(0, "rgba(255, 226, 170, 0.13)");
    licht.addColorStop(1, "rgba(255, 226, 170, 0)");
    g.fillStyle = licht;
    g.fillRect(0, 0, view.cssW, view.cssH);

    // Das Blatt – ein frisches rutscht von rechts herein.
    const wende = ruhig() ? 1 : weich(0, 1, clamp((jetzt - state.gewendet) / 420, 0, 1));
    const schub = (1 - wende) * view.seite * 0.5;
    const neig = (1 - wende) * 0.05;
    const bild = papierBild();
    g.save();
    g.translate(view.x0 + view.seite / 2 + schub, view.y0 + view.seite / 2);
    g.rotate(neig);
    g.globalAlpha = 0.25 + 0.75 * wende;
    g.drawImage(bild, -view.seite / 2 - PAPIER_RAND, -view.seite / 2 - PAPIER_RAND, view.seite + PAPIER_RAND * 2, view.seite + PAPIER_RAND * 2);
    g.restore();

    state.beispielStift = null;
    const a = blatt();
    aufBlatt(view.x0 + schub, view.y0, view.s, () => {
      if (state.phase === "bereit" || state.phase === "warten") zeichneTitel();
      else if (state.phase === "vorschau" && a) zeichneVorschau(a, wende);
      else if (a && (state.phase === "aufgabe" || state.phase === "zeigen" || state.phase === "ende")) {
        const da = state.phase === "aufgabe" ? weich(0, 1, clamp(seit() / EINZUG, 0, 1)) : 1;
        zeichneTeile(a.teile, da);
        const wisch = state.verworfen ? clamp((jetzt - state.verworfen) / 1400, 0, 1) : 1;
        if (wisch < 1 && !state.roh.length) {
          g.save();
          g.globalAlpha = 1 - wisch;
          g.textAlign = "center";
          g.fillStyle = ROT;
          g.font = `700 4px ${SANS}`;
          g.fillText("Zieh die Form in einem Zug.", 50, 95);
          g.restore();
        }
        // Wer zuschaut, sieht die Spitze zwischen zwei Punkten weiterfahren.
        const strich = zuschauer && state.phase === "aufgabe" && state.roh.length && state.stift ? [...state.roh, state.stift] : state.roh;
        zeichneStrich(strich, 1, state.phase === "aufgabe" && !zuschauer);
        if (state.phase !== "aufgabe") zeichneLoesung((jetzt - state.tZeig) / 1000);
      }
    });

    zeichneKopf();
    zeichneUhr();
    zeichneMappe();
    zeichneFunken();

    // Der Bleistift: in der Hand, solange gezeichnet wird – und im Beispiel.
    let spitze = null;
    if (state.beispielStift) spitze = P(view.x0 + state.beispielStift.x * view.s, view.y0 + state.beispielStift.y * view.s);
    else if (state.phase === "aufgabe" && state.stift && (state.zieht !== null || state.eingabe !== "touch" || zuschauer)) spitze = P(view.x0 + state.stift.x * view.s, view.y0 + state.stift.y * view.s);
    if (spitze) zeichneStift(spitze.x + (state.beispielStift ? schub : 0), spitze.y, 1, state.beispielStift ? 0.56 : 1);
  }

  // ---------------------------------------------------------------------------
  // Zuschauen
  // ---------------------------------------------------------------------------
  // Dieselben Blätter (die Saat hält geist.js oder der Abend), und Zug um Zug,
  // was der andere tat: derselbe Strich aus denselben Punkten, zur selben Zeit.
  let gesehenBis = -1;
  function zuschauenTakt() {
    if (!zuschauer?.seit) return;
    const jetzt = zuschauer.jetzt();
    for (const zug of zuschauer.seit(gesehenBis, jetzt)) {
      const was = ((zug.c % 8) + 8) % 8;
      const index = clamp(Math.floor(zug.c / 8), 0, BLAETTER - 1);
      const ort = P(zug.a / ZUG_MM, zug.b / ZUG_MM);
      // Wann das hier gewesen wäre – so laufen Uhr und Bild wie beim anderen.
      const damals = performance.now() - Math.max(0, jetzt - zug.t);
      if (was === 0) {
        blattAuf(index);
        state.vorSeit = damals;
        state.gewendet = damals;
      } else if (was === 1) {
        if (state.index !== index || state.phase !== "vorschau") blattAuf(index);
        blattLos();
        state.t0 = damals;
      } else if (state.phase === "aufgabe" && state.index === index) {
        if (was === 2) {
          state.roh = [ort];
          state.stift = ort;
          kratzenAn();
        } else if (was === 3 || was === 4) {
          const vor = state.stift || ort;
          state.tempo += (abstand(vor, ort) / 0.12 - state.tempo) * 0.5;
          state.stiftSeit = performance.now();
          if (was === 3 && state.roh.length) state.roh.push(ort);
          state.stift = ort;
        } else if (was === 7) {
          state.roh = [];
          state.verworfen = damals;
        } else if (was === 5 && state.roh.length) {
          const vor = state.roh[state.roh.length - 1];
          if (vor.x !== ort.x || vor.y !== ort.y) state.roh.push(ort);
          antworte(state.roh.length > 1 ? state.roh : null, zug.p - state.punkte);
          state.tZeig = damals;
        } else if (was === 6 || was === 5) {
          antworte(null);
          state.tZeig = damals;
        }
      }
      if (zug.p !== state.punkte && (was === 5 || was === 6)) { state.punkte = zug.p; shell.setCount(zug.p); }
    }
    gesehenBis = jetzt;
    zuschauer.weiter?.();
  }

  function zuschauenStarten() {
    if (!zuschauer?.seit) return;
    startRun();
    state.phase = "warten";
    shell.setPhase("play");
    gesehenBis = -1;
    zuschauer.los?.();
  }

  // ---------------------------------------------------------------------------
  // Ablauf der Runde
  // ---------------------------------------------------------------------------
  // Die Runde beginnt: mit dem ersten Tipp – oder im Live-Modus zum
  // gemeinsamen Start (game-shell.js, live.los).
  function losGehts() {
    if (state.phase !== "bereit") return;
    shell.setPhase("play");
    aufnahme?.los();
    blattAuf(0);
  }

  function startRun() {
    clearStep();
    stopLoop();
    kratzenAus();
    shell.closeOverlay();
    zufall.neu();
    shell.setPhase("intro");
    state.blaetter = TESTRUNDE ? testBlaetter() : aufgabenFuer();
    state.phase = "bereit";
    state.index = 0;
    state.punkte = 0;
    state.liste = new Array(anzahl()).fill(null);
    state.wertung = null;
    state.genaue = 0;
    state.funken = [];
    state.stift = null;
    state.beispiel = null;
    state.gewendet = performance.now();
    strichWeg();
    shell.setCount(0);

    shell.clear();
    const prompt = shell.el("p", "cm-prompt fh-prompt", TESTRUNDE
      ? `Testrunde: alle ${anzahl()} Blätter nacheinander – nichts wird gespeichert.`
      : "Zeichne jede Form in einem Zug – so genau du kannst.");
    shell.play.append(prompt, buildPlatz());
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
    const dauer = Math.min(900, 250 + ziel);
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
    if (zuschauer) return;
    clearStep();
    if (state.phase === "ende") return;
    // Im Live-Modus endet die Runde auch mitten in einem Blatt: Es zählt, was
    // bis dahin gezeichnet ist.
    state.phase = "ende";
    state.zieht = null;
    kratzenAus();
    const punkte = state.punkte;
    if (TESTRUNDE) { testEnde(punkte); return; }
    const geist = aufnahme?.ende() || null;
    const vorher = Number(store.read()?.scores?.[0]) || 0;
    const rekord = punkte > vorher;
    store.update((old) => ({
      runs: (Number(old.runs) || 0) + 1,
      scores: [...(old.scores || []), punkte].sort((x, y) => y - x).slice(0, TOP_COUNT),
    }));
    // Das beste Blatt der Runde, und wie weit die Striche im Schnitt daneben lagen.
    const fertig = state.liste.map((e, i) => (e ? { ...e, kurz: state.blaetter[i].kurz } : null)).filter(Boolean);
    const bestes = fertig.reduce((b, e) => (!b || e.punkte > b.punkte ? e : b), null);
    const gezeichnet = fertig.filter((e) => e.strich);
    shell.showResult({
      label: "Deine Punkte",
      points: punkte,
      detail: [
        rekord ? "Neuer Rekord!" : "",
        bestes && bestes.punkte > 0 ? `Bestes Blatt: ${bestes.kurz} ${bestes.punkte}` : "",
        gezeichnet.length ? `im Schnitt ${mittel(gezeichnet.map((e) => e.mm)).toFixed(1).replace(".", ",")} mm daneben` : "",
        state.genaue ? `${state.genaue} haargenau` : "",
        !rekord && vorher ? `Bestwert ${vorher}` : "",
      ].filter(Boolean).join(" · "),
      geist,
    });
    if (rekord) host.querySelector(".cm-result-detail")?.classList.add("fh-rekord");
    zaehleHoch(punkte);
  }

  // Die Tafel der Testrunde: die Punkte, wie genau, was übersprungen wurde
  // und welche Blätter schwach waren – ohne Bestenliste und Aufzeichnung.
  function testEnde(punkte) {
    const fertig = state.liste.map((e, i) => (e ? { ...e, kurz: state.blaetter[i].kurz } : null)).filter(Boolean);
    const gezeichnet = fertig.filter((e) => e.strich);
    const weg = fertig.filter((e) => e.uebersprungen).length;
    const schwach = fertig.filter((e) => !e.uebersprungen && e.punkte < 50).map((e) => `${e.kurz} ${e.punkte}`);
    shell.showResult({
      label: "Testrunde",
      points: punkte,
      detail: [
        gezeichnet.length ? `im Schnitt ${mittel(gezeichnet.map((e) => e.mm)).toFixed(1).replace(".", ",")} mm daneben` : "",
        state.genaue ? `${state.genaue} haargenau` : "",
        weg ? `${weg} übersprungen` : "",
        schwach.length ? `unter 50: ${schwach.join(", ")}` : "",
        "nichts gespeichert",
      ].filter(Boolean).join(" · "),
      eintragen: false,
    });
    zaehleHoch(punkte);
  }

  // ---------------------------------------------------------------------------
  // Bestenliste – lokal und in der Cloud
  // ---------------------------------------------------------------------------
  const store = cloudApi
    ? cloudApi.register({ key: "lernapp.freihand", empty: { runs: 0, scores: [] }, merge: cloudApi.mergeScores(TOP_COUNT) })
    : {
      read: () => ({ runs: 0, scores: [] }),
      write(data) { return data; },
      update(fn) { return fn(this.read()); },
      onChange() { return () => {}; },
    };

  // ---------------------------------------------------------------------------
  // Start
  // ---------------------------------------------------------------------------
  shell = shellApi.mount({
    host,
    title: "Freihand",
    area: "konzentration",
    accent: "#E0533D",
    accentDark: "#a9331f",
    clock: false,
    onRestart: () => (zuschauer ? zuschauenStarten() : startRun()),
    live: { los: losGehts, stopp: () => finish(), zuschauen: (quelle) => { zuschauer = quelle; zuschauenStarten(); } },
  });
  zuschauer = window.LernappGeist?.zuschauer?.({
    host, spiel: "freeHand", fassung: "z1", zufall, zuege: true, einheit: "Punkte", nochmal: zuschauenStarten,
  }) || null;
  // Die Testrunde wird nicht aufgezeichnet – und hat oben den Knopf «Überspringen».
  if (TESTRUNDE) shell.ueberspringen(ueberspringe);
  if (!zuschauer && !TESTRUNDE) aufnahme = window.LernappGeist?.zuege?.({ fassung: "z1", zufall }) || null;

  startRun();
  zuschauer?.laden.then((da) => { if (da) zuschauenStarten(); });

  // Ein Tipp: beginnen, das Blatt hinlegen, die Lösung überspringen – oder
  // der Stift setzt auf.
  function tippe(event = null) {
    if (zuschauer) return;
    const jetzt = performance.now();
    if (state.phase === "bereit") {
      if (!shell.live) losGehts();
    } else if (state.phase === "vorschau") {
      if (jetzt - state.vorSeit >= VOR_SPERRE * 1000) blattLos();
    } else if (state.phase === "zeigen") {
      if (jetzt - state.tZeig >= 900) weiter();
    } else if (state.phase === "aufgabe" && event) {
      const ort = blattOrt(event);
      // Knapp neben dem Blatt angesetzt gilt noch – der Rand ist dann der Anfang.
      if (ort.x < -6 || ort.x > BLATT + 6 || ort.y < -6 || ort.y > BLATT + 6) return;
      if (stiftAb(ort, event.pointerId, event.pointerType || "mouse")) {
        try { canvas.setPointerCapture(event.pointerId); } catch { /* dann eben ohne */ }
      }
    }
  }

  host.addEventListener("pointerdown", (event) => {
    if (event.target.closest("button, a, input")) return;
    if (!canvas || (event.pointerType === "mouse" && event.button !== 0)) return;
    event.preventDefault();
    tippe(event);
  });
  host.addEventListener("pointermove", (event) => {
    if (!canvas || zuschauer) return;
    if (state.zieht === event.pointerId) {
      // Alle Stellen, die der Zeiger seit dem letzten Bild durchlief.
      const alle = event.getCoalescedEvents?.() || [];
      for (const e of alle.length ? alle : [event]) stiftZu(blattOrt(e));
    } else if (state.zieht === null && state.phase === "aufgabe" && event.pointerType !== "touch") {
      // Mit der Maus schwebt der Bleistift schon über dem Blatt.
      state.eingabe = event.pointerType || "mouse";
      state.stift = aufsBlatt(blattOrt(event));
    }
  });
  const hebeAb = (event) => { if (state.zieht === event.pointerId) stiftAuf(); };
  host.addEventListener("pointerup", hebeAb);
  host.addEventListener("pointercancel", hebeAb);
  window.addEventListener("keydown", (event) => {
    if (event.repeat || (event.key !== " " && event.key !== "Enter")) return;
    if (event.target.closest?.("button, a, input") || host.querySelector(".cm-overlay")) return;
    if (state.phase === "bereit" || state.phase === "vorschau" || state.phase === "zeigen") { event.preventDefault(); tippe(); }
  });

  window.addEventListener("resize", messen);
  window.addEventListener("orientationchange", messen);
  window.addEventListener("pagehide", () => { clearStep(); stopLoop(); kratzenAus(); });

  // Für die Prüfskripte und die Vorführung: stiftAb, stiftZu und stiftAuf
  // zeichnen wie ein Finger, in Millimetern des Blattes.
  window.LernappFreihand = {
    BLATT, RAND, KNOTEN, GENAU, LEICHT, MITTEL, SCHWER, PLAN, BLAETTER, ZEITEN, EINZUG, SPERRE, VORSCHAU, STRICH_MIN, STRICH_PUNKTE, ZUG_MM, MASS, TUN,
    state, view, BAU, lege, aufgabenFuer, weltText, punkteFuer, messe, kreisFit, kreisWeg, abtasten, wegLaenge, naechster, teilPunkte,
    schreiberNeu, schreibe, schliesse, losGehts, blattLos, stiftAb, stiftZu, stiftAuf, weiter, takt, zeichnen,
    testrunde: () => TESTRUNDE, ueberspringe,
  };
})();
