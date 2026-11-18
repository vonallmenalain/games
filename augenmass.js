/*
 * augenmass.js – Augenmass. Zehn Blätter, ein Stift, kein Lineal.
 *
 * Auf dem Zeichentisch liegt eine Blaupause, und auf jedem Blatt steht eine
 * Aufgabe: Wo ist der Mittelpunkt des Kreises? Wo trifft die Kugel nach der
 * Bande die Wand? Wo landet der Ball? Wer spielt, setzt den Finger auf das
 * Blatt, schiebt das Fadenkreuz an die Stelle und lässt los. Danach wird
 * nachgemessen: Die Lösung zeichnet sich ein, dazwischen steht, wie viele
 * Millimeter es daneben war.
 *
 * Zehn Aufgaben je Runde, bis zu zehn Punkte je Aufgabe – und die zehn sind
 * schwer: Sie gelten für gut einen halben Millimeter auf einem Blatt von
 * zehn Zentimetern, auf einem Handy also für zwei Bildpunkte. Danach fällt
 * es steil (punkteFuer). Ein Raster gibt es auf dem Blatt nicht, und keine
 * Aufgabe liegt gerade im Bild: Was sich abzählen liesse, wäre kein
 * Augenmass mehr.
 *
 * Mit einem Lineal ist keine Aufgabe getan. Was sich bloss abmessen liesse
 * (die Mitte einer Strecke, ein Drittel, eine Linie verlängern), gibt es
 * nicht mehr; überall muss etwas in Gedanken gebaut oder vorhergesagt
 * werden. Zwei leichte Blätter zum Einsehen (der Mittelpunkt eines Kreises
 * oder Rechtecks, ein halber Winkel, das Lot), dann vier mittlere
 * (spiegeln, die vierte Ecke, der Schwerpunkt, das gleichseitige Dreieck,
 * eine Vierteldrehung, der Treffpunkt zweier Kugeln, ein Bogen bis zur
 * Wand, die Bande), am Schluss vier schwere: der Mittelpunkt eines Bogens
 * oder dreier Punkte, der Inkreis, zwei Banden, über die Bande ins Loch,
 * die Flugbahn eines Balls, die halbe Fläche, das Rad, das eine Umdrehung
 * rollt – und der Tunnel, in dem eine Kugel verschwindet und man tippt,
 * wenn sie beim Pfeil sein müsste. Welche Aufgaben kommen und wie sie
 * liegen, würfelt der Zufall; in einem Turnier bekommen alle dieselben
 * zehn Blätter (zufall.js).
 *
 * Vor jedem Blatt steht, was zu tun ist (die Vorschau): der Name der
 * Aufgabe, ein Satz dazu und ein Beispiel, das sich selbst löst – eine
 * andere Aufgabe derselben Art, mit ihren Hilfslinien und der richtigen
 * Stelle. Die Uhr läuft dabei nicht. Erst ein Tipp legt das Blatt hin
 * (blattLos); wer gar nicht tippt, bekommt es nach VORSCHAU Sekunden.
 *
 * Dann ist die Zeit knapp: sechs Sekunden für ein leichtes Blatt, sieben
 * für ein mittleres, acht für ein schweres. Ist sie um, zählt die Stelle,
 * an der das Fadenkreuz gerade steht – wer noch gar nicht getippt hat,
 * bekommt nichts. Im Tunnel rollt die Kugel von selbst los, sobald das
 * Blatt daliegt, und wartet auf niemanden.
 *
 * Unter dem Finger sieht man nichts: Auf einem Handy steht das Fadenkreuz
 * darum nicht unter dem Finger, sondern VERSATZ Bildpunkte darüber, an
 * einem Stiel. Der Finger hält den Griff, zieht – und das Fadenkreuz geht
 * frei sichtbar mit, einen Bildpunkt für jeden des Fingers. Loslassen ist
 * die Antwort; wer nur kurz antippt, setzt das Fadenkreuz bloss hin. Maus
 * und Stift zeigen wie eh und je genau dorthin, wo sie stehen.
 *
 * Aufgezeichnet werden die Züge (geist.js, zuege): jede Vorschau, jedes
 * neue Blatt, das Fadenkreuz unterwegs und die Antwort. Damit lassen sich die besten Läufe
 * anschauen, und im Multiplayer sehen die anderen dasselbe (live-spiel.js).
 *
 * Bühne, Knöpfe und Bestenliste kommen aus game-shell.js.
 */
(() => {
  "use strict";

  if (document.body.dataset.page !== "eye") return;

  const host = document.querySelector("#am-stage");
  const shellApi = window.LernappGameShell;
  const cloudApi = window.LernappGameCloud;
  if (!host || !shellApi) return;

  const kids = () => window.LernappKids || null;
  const klang = () => window.ArcadeKlang || null;
  const ruhig = () => Boolean(kids()?.prefersReducedMotion?.());

  // Der Zufall: welche zehn Aufgaben kommen und wie sie auf dem Blatt
  // liegen. Funken und das Korn des Papiers nehmen Math.random.
  const zufall = window.LernappZufall?.fuer?.("eyeMeasure") || {
    fest: false, neu() {}, zahl: Math.random,
  };

  // ---------------------------------------------------------------------------
  // Regeln
  // ---------------------------------------------------------------------------
  // Das Blatt ist ein Quadrat von 100 × 100 Millimetern – so gross, wie der
  // Bildschirm es hergibt. Gerechnet wird überall in diesen Millimetern: Ein
  // Millimeter daneben ist auf jedem Gerät gleich viel.
  const BLATT = 100;
  // So viel Rand bleibt um jede Figur frei.
  const RAND = 7;

  // Wie nah ist nah genug? Die zehn gibt es bis 0,6 mm, die neun bis 1,1 mm,
  // und so fort – oben eng, unten weit. Wer grob danebenliegt, verliert für
  // jeden weiteren Millimeter weniger; wer fast trifft, für jeden mehr.
  const GRENZEN = [0.6, 1.1, 1.7, 2.4, 3.2, 4.2, 5.5, 7.2, 9.5, 12.5];
  const PUNKTE_JE_BLATT = GRENZEN.length;
  // Wie eine Antwort heisst – für Farbe und Zählung.
  const WIE = ["daneben", "weit", "weit", "weit", "nah", "nah", "knapp", "knapp", "fast", "fast", "genau"];

  // Die Aufgaben nach Schwere. Jede Runde zieht zwei leichte, vier mittlere
  // und vier schwere – jede Art höchstens einmal. Keine davon ist mit einem
  // Lineal getan: Überall muss etwas in Gedanken gebaut werden – ein Lot,
  // ein Spiegelbild, ein Abprall, eine Flugbahn.
  const LEICHT = ["kreis", "rechteck", "winkel", "lot"];
  const MITTEL = ["spiegel", "eck", "schwerpunkt", "dreieck", "drehen", "treffpunkt", "kurve", "bande"];
  const SCHWER = ["bogen", "doppelbande", "zielbande", "tunnel", "wurf", "umkreis", "inkreis", "halbieren", "rad"];
  const PLAN = [2, 4, 4];
  const BLAETTER = PLAN[0] + PLAN[1] + PLAN[2];

  // So lange hat ein Blatt: die leichten sechs Sekunden, die mittleren
  // sieben, die schweren acht. Je einfacher die Aufgabe, desto weniger Zeit
  // bleibt, ein Werkzeug anzulegen. (Im Tunnel ist die Kugel die Uhr.)
  const ZEITEN = [6, 7, 8];
  const ZEIT = Math.max(...ZEITEN);
  // So lange zeichnet sich ein neues Blatt ein; erst danach läuft die Zeit.
  const EINZUG = 0.55;
  // Ab wann ein Blatt einen Tipp annimmt – nicht den, der noch dem letzten galt.
  const SPERRE = 0.3;
  // So lange steht die Lösung da.
  const ZEIGEN_MS = 1900;
  // So lange steht die Vorschau eines Blattes höchstens da (Sekunden) – eine
  // Runde soll von selbst zu Ende gehen. In den letzten VOR_ZAEHLT Sekunden
  // zählt sie sichtbar herunter; ein Tipp gilt erst nach VOR_SPERRE.
  const VORSCHAU = 30;
  const VOR_ZAEHLT = 5;
  const VOR_SPERRE = 0.35;
  // So lange nach dem Hinlegen wartet die Kugel im Tunnel, bis sie losrollt.
  const TUNNEL_START = 0.5;
  // Der Finger auf dem Handy: So viele Bildpunkte (CSS) steht das Fadenkreuz
  // über ihm – gut ein Zentimeter, genug, dass die Fingerkuppe es nicht
  // verdeckt. Tiefer als VERSATZ_RAND über dem unteren Bildrand kommt kein
  // Finger; reicht der Platz unter dem Blatt nicht für den ganzen Versatz
  // (Handy quer), schrumpft er auf den letzten Fingerbreiten (versatzBei).
  const VERSATZ = 80;
  const VERSATZ_RAND = 12;
  // Der Griff unter dem Finger, als Ring gemalt (Halbmesser in Bildpunkten).
  const GRIFF_R = 30;
  // Ein Antippen ist keine Antwort: kürzer als TIPP_MS und weniger als
  // TIPP_WEG Bildpunkte weit. Es setzt das Fadenkreuz nur hin.
  const TIPP_MS = 400;
  const TIPP_WEG = 10;
  // So lange steht nach einem Antippen der Hinweis «Halten und ziehen» da.
  const WINK_MS = 3200;
  const TOP_COUNT = 5;

  // ---------------------------------------------------------------------------
  // Rechnen
  // ---------------------------------------------------------------------------
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const lerp = (a, b, k) => a + (b - a) * k;
  const weich = (u) => u * u * (3 - 2 * u);
  const TAU = Math.PI * 2;
  const GRAD = Math.PI / 180;

  const P = (x, y) => ({ x, y });
  const richt = (w) => P(Math.cos(w), Math.sin(w));
  const plus = (a, b, k = 1) => P(a.x + b.x * k, a.y + b.y * k);
  const zwischen = (a, b, k = 0.5) => P(a.x + (b.x - a.x) * k, a.y + (b.y - a.y) * k);
  const abstand = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const dreh = (p, w) => P(p.x * Math.cos(w) - p.y * Math.sin(w), p.x * Math.sin(w) + p.y * Math.cos(w));

  const einheit = (a, b) => {
    const l = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    return P((b.x - a.x) / l, (b.y - a.y) / l);
  };

  const zz = (a, b) => a + (b - a) * zufall.zahl();
  // Ein Winkel, der nicht gerade im Bild liegt: Waagrecht und senkrecht
  // gäben die Ränder des Blattes ein Lineal ab.
  function schief(von = 0, bis = TAU) {
    let w = zz(von, bis);
    for (let i = 0; i < 12; i += 1) {
      const rest = ((w % (Math.PI / 2)) + Math.PI / 2) % (Math.PI / 2);
      if (rest > 0.14 && rest < Math.PI / 2 - 0.14) break;
      w = zz(von, bis);
    }
    return w;
  }

  // Der nächste Punkt auf der Strecke a–b.
  function aufStrecke(p, a, b) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const k = clamp(((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1), 0, 1);
    return P(a.x + dx * k, a.y + dy * k);
  }

  // Wie nah sich zwei Strecken kommen (für Figuren, die sich nicht kreuzen sollen).
  function streckenAbstand(a, b, c, d) {
    let klein = Infinity;
    for (let i = 0; i <= 12; i += 1) {
      const p = zwischen(a, b, i / 12);
      const q = zwischen(c, d, i / 12);
      klein = Math.min(klein, abstand(p, aufStrecke(p, c, d)), abstand(q, aufStrecke(q, a, b)));
    }
    return klein;
  }

  // Kreuzen sich die Strecken p1–p2 und q1–q2 (mitten, nicht bloss an einem Ende)?
  function kreuzen(p1, p2, q1, q2) {
    const seite = (a, b, c) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
    const d1 = seite(q1, q2, p1);
    const d2 = seite(q1, q2, p2);
    const d3 = seite(p1, p2, q1);
    const d4 = seite(p1, p2, q2);
    return d1 * d2 < 0 && d3 * d4 < 0;
  }

  // Ein Dreieck, wie es sich gut ansehen lässt: kein Winkel unter 28 Grad,
  // keine Seite über 80 mm, schief im Blatt. Die Seite a–b ist die untere,
  // c die Spitze. Taugt der Wurf nichts, kommt null zurück.
  function dreieckRoh() {
    const breit = zz(50, 76);
    const a = P(0, 0);
    const b = P(breit, 0);
    const c = P(zz(0.18, 0.82) * breit, -zz(32, 60));
    if (Math.max(abstand(a, c), abstand(b, c)) > 80) return null;
    const winkel = (p, q, r) => Math.acos(((q.x - p.x) * (r.x - p.x) + (q.y - p.y) * (r.y - p.y)) / (abstand(p, q) * abstand(p, r)));
    if (Math.min(winkel(a, b, c), winkel(b, a, c), winkel(c, a, b)) < 28 * GRAD) return null;
    const w = schief(0, TAU);
    [a, b, c].forEach((p) => Object.assign(p, dreh(p, w)));
    return [a, b, c];
  }

  // Wo die Figur Platz hat: Alle Punkte (und Kreise) zusammen ergeben einen
  // Kasten; der wird an eine zufällige Stelle des Blattes geschoben. Passt
  // er nicht, kommt falsch zurück – dann würfelt die Aufgabe neu.
  function einpassen(punkte, kreise = []) {
    let x0 = Infinity;
    let x1 = -Infinity;
    let y0 = Infinity;
    let y1 = -Infinity;
    punkte.forEach((p) => { x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y); });
    kreise.forEach((k) => { x0 = Math.min(x0, k.m.x - k.r); x1 = Math.max(x1, k.m.x + k.r); y0 = Math.min(y0, k.m.y - k.r); y1 = Math.max(y1, k.m.y + k.r); });
    const frei = BLATT - 2 * RAND;
    const passt = x1 - x0 <= frei && y1 - y0 <= frei;
    // Passt er nicht, kommt er in die Mitte – besser als gar nicht.
    const dx = passt ? zz(RAND - x0, BLATT - RAND - x1) : (BLATT - x0 - x1) / 2;
    const dy = passt ? zz(RAND - y0, BLATT - RAND - y1) : (BLATT - y0 - y1) / 2;
    new Set(punkte).forEach((p) => { p.x += dx; p.y += dy; });
    return passt;
  }

  // Bis zu achtzigmal würfeln, bis eine Figur aufs Blatt passt und nichts
  // sich kreuzt, was sich nicht kreuzen soll. `roh` gibt die Aufgabe mit
  // ihren Punkten zurück – oder null, wenn der Wurf nichts taugt.
  function wuerfle(roh) {
    let letzte = null;
    for (let i = 0; i < 80; i += 1) {
      const a = roh();
      if (!a) continue;
      letzte = a;
      if (einpassen(a.punkte, a.kreise || [])) return a;
    }
    return letzte;
  }

  // ---------------------------------------------------------------------------
  // Die Aufgaben
  // ---------------------------------------------------------------------------
  /*
   * Eine Aufgabe ist eine Zeichnung und eine Stelle:
   *
   *   figur     was auf dem Blatt steht (Strecken, Bögen, Punkte …)
   *   ziel      die richtige Stelle
   *   bahn      worauf das Fadenkreuz läuft: eine Strecke { a, b }, ein Bogen
   *             { m, r, von, bis } – oder nichts, dann ist das Blatt frei
   *   loesung   was sich beim Nachmessen einzeichnet
   *   mass      wie streng gemessen wird: 1 heisst Millimeter für
   *             Millimeter, kleiner ist nachsichtiger (bei den schweren)
   *
   * Die Zeichnung besteht aus wenigen Zeichen (zeichneTeil):
   *   s      Strecke a–b          k      Bogen um m von … bis
   *   pfeil  Strecke mit Spitze   p      Punkt, wahlweise mit Namen
   *   poly   Linienzug            tick   Strich quer zur Richtung w
   *   wand   Wand mit Schraffur   eck    rechter Winkel
   *   gleich Zeichen «gleich lang» mitten auf a–b
   */
  const BAU = {
    // Der Mittelpunkt eines Kreises.
    kreis() {
      return wuerfle(() => {
        const r = zz(20, 36);
        const m = P(0, 0);
        const w = zz(0, Math.PI / 2);
        const d1 = [plus(m, richt(w), -r), plus(m, richt(w), r)];
        const d2 = [plus(m, richt(w + Math.PI / 2), -r), plus(m, richt(w + Math.PI / 2), r)];
        return {
          art: "kreis", kurz: "Mittelpunkt", frage: "Wo ist der Mittelpunkt des Kreises?",
          punkte: [m, ...d1, ...d2], kreise: [{ m, r }],
          figur: [{ t: "k", m, r, von: w, bis: w + TAU }],
          bahn: null, ziel: m,
          loesung: [{ t: "s", a: d1[0], b: d1[1], stil: "strich" }, { t: "s", a: d2[0], b: d2[1], stil: "strich" }, { t: "p", p: m }],
          mass: 1,
        };
      });
    },

    // Die Mitte eines Rechtecks, das schief im Blatt liegt.
    rechteck() {
      return wuerfle(() => {
        const u = zz(44, 68);
        const v = zz(24, 42);
        const w = schief(0, Math.PI);
        const e1 = richt(w);
        const e2 = richt(w + Math.PI / 2);
        const m = P(0, 0);
        const ecke = (i, j) => plus(plus(m, e1, (i * u) / 2), e2, (j * v) / 2);
        const [a, b, c, d] = [ecke(-1, -1), ecke(1, -1), ecke(1, 1), ecke(-1, 1)];
        return {
          art: "rechteck", kurz: "Rechteck", frage: "Wo ist die Mitte des Rechtecks?",
          punkte: [m, a, b, c, d],
          figur: [{ t: "poly", pkte: [a, b, c, d], zu: true }],
          bahn: null, ziel: m,
          loesung: [{ t: "s", a, b: c, stil: "strich" }, { t: "s", a: b, b: d, stil: "strich" }, { t: "p", p: m }],
          mass: 1,
        };
      });
    },

    // Einen Winkel halbieren: Wo trifft die Mitte den Bogen?
    winkel() {
      return wuerfle(() => {
        const r = zz(36, 50);
        const al = zz(40, 140) * GRAD;
        const w0 = zz(0, TAU);
        const v = P(0, 0);
        const e1 = plus(v, richt(w0), r + 9);
        const e2 = plus(v, richt(w0 + al), r + 9);
        const ziel = plus(v, richt(w0 + al / 2), r);
        const aussen = plus(v, richt(w0 + al / 2), r + 9);
        const rund = [0.25, 0.75].map((k) => plus(v, richt(w0 + al * k), r));
        return {
          art: "winkel", kurz: "Winkel", frage: "Halbiere den Winkel: Wo liegt die Mitte auf dem Bogen?",
          punkte: [v, e1, e2, ziel, aussen, ...rund],
          figur: [{ t: "s", a: v, b: e1 }, { t: "s", a: v, b: e2 }, { t: "k", m: v, r, von: w0, bis: w0 + al, stil: "duenn" }, { t: "p", p: v }],
          bahn: { m: v, r, von: w0, bis: w0 + al }, ziel,
          loesung: [
            { t: "s", a: v, b: aussen, stil: "strich" },
            { t: "k", m: v, r: r * 0.3, von: w0, bis: w0 + al / 2, stil: "duenn" },
            { t: "k", m: v, r: r * 0.36, von: w0 + al / 2, bis: w0 + al, stil: "duenn" },
          ],
          mass: 1,
        };
      });
    },

    // Das Lot: der kürzeste Weg von einem Punkt zu einer Linie.
    lot() {
      return wuerfle(() => {
        const lang = zz(60, 84);
        const a = P(-lang / 2, 0);
        const b = P(lang / 2, 0);
        const f = P((zz(0.25, 0.75) - 0.5) * lang, 0);
        const p = P(f.x, (zufall.zahl() < 0.5 ? -1 : 1) * zz(22, 42));
        const w = schief(0, TAU);
        const alle = [a, b, f, p];
        alle.forEach((q) => Object.assign(q, dreh(q, w)));
        return {
          art: "lot", kurz: "Lot", frage: "Der kürzeste Weg von P zur Linie: Wo kommt er an?",
          punkte: alle,
          figur: [{ t: "s", a, b }, { t: "p", p, name: "P", weg: P(p.x - f.x, p.y - f.y) }],
          bahn: { a, b }, ziel: f,
          loesung: [{ t: "s", a: p, b: f, stil: "strich" }, { t: "eck", p: f, zu1: p, zu2: b }],
          mass: 1,
        };
      });
    },

    // Einen Punkt an einer Linie spiegeln.
    spiegel() {
      return wuerfle(() => {
        const a = P(-42, 0);
        const b = P(42, 0);
        const f = P((zz(0.3, 0.7) - 0.5) * 60, 0);
        const weit = (zufall.zahl() < 0.5 ? -1 : 1) * zz(14, 30);
        const p = P(f.x, weit);
        const ziel = P(f.x, -weit);
        const w = schief(0, Math.PI);
        const alle = [a, b, f, p, ziel];
        alle.forEach((q) => Object.assign(q, dreh(q, w)));
        return {
          art: "spiegel", kurz: "Spiegeln", frage: "Spiegle den Punkt P an der Linie.",
          punkte: alle,
          figur: [{ t: "s", a, b, stil: "achse" }, { t: "p", p, name: "P", weg: P(p.x - f.x, p.y - f.y) }],
          bahn: null, ziel,
          loesung: [
            { t: "s", a: p, b: ziel, stil: "strich" }, { t: "eck", p: f, zu1: ziel, zu2: b },
            { t: "gleich", a: p, b: f }, { t: "gleich", a: f, b: ziel }, { t: "p", p: ziel },
          ],
          mass: 0.9,
        };
      });
    },

    // Der Mittelpunkt eines Bogens – vom Kreis ist nur ein Stück da.
    bogen() {
      return wuerfle(() => {
        const r = zz(30, 42);
        const al = zz(80, 130) * GRAD;
        const w0 = zz(0, TAU);
        const m = P(0, 0);
        const rund = [0, 0.25, 0.5, 0.75, 1].map((k) => plus(m, richt(w0 + al * k), r));
        return {
          art: "bogen", kurz: "Bogen", frage: "Wo ist der Mittelpunkt dieses Bogens?",
          punkte: [m, ...rund],
          figur: [{ t: "k", m, r, von: w0, bis: w0 + al }],
          bahn: null, ziel: m,
          loesung: [
            { t: "k", m, r, von: w0 + al, bis: w0 + TAU, stil: "strich" },
            { t: "s", a: m, b: rund[0], stil: "strich" }, { t: "s", a: m, b: rund[4], stil: "strich" }, { t: "p", p: m },
          ],
          mass: 0.6,
        };
      });
    },

    // Die vierte Ecke eines Rechtecks.
    eck() {
      return wuerfle(() => {
        const u = zz(34, 56);
        const v = zz(22, 40);
        const w = schief(0, TAU);
        const b = P(0, 0);
        const a = plus(b, richt(w), u);
        const c = plus(b, richt(w + Math.PI / 2), v);
        const d = P(a.x + c.x, a.y + c.y);
        return {
          art: "eck", kurz: "Vierte Ecke", frage: "Wo ist die vierte Ecke des Rechtecks?",
          punkte: [a, b, c, d],
          figur: [{ t: "s", a, b }, { t: "s", a: b, b: c }, { t: "eck", p: b, zu1: a, zu2: c }, { t: "p", p: a }, { t: "p", p: b }, { t: "p", p: c }],
          bahn: null, ziel: d,
          loesung: [{ t: "s", a, b: d, stil: "strich" }, { t: "s", a: c, b: d, stil: "strich" }, { t: "eck", p: d, zu1: a, zu2: c }, { t: "p", p: d }],
          mass: 0.9,
        };
      });
    },

    // Wo balanciert das Dreieck? Im Schwerpunkt – dort kreuzen sich die
    // Linien von jeder Ecke zur Mitte der Seite gegenüber.
    schwerpunkt() {
      return wuerfle(() => {
        const ecken = dreieckRoh();
        if (!ecken) return null;
        const [a, b, c] = ecken;
        const g = P((a.x + b.x + c.x) / 3, (a.y + b.y + c.y) / 3);
        const ma = zwischen(b, c);
        const mb = zwischen(a, c);
        const mc = zwischen(a, b);
        return {
          art: "schwerpunkt", kurz: "Schwerpunkt", frage: "Wo balanciert das Dreieck auf einer Nadelspitze?",
          punkte: [a, b, c, g, ma, mb, mc],
          figur: [{ t: "poly", pkte: [a, b, c], zu: true }],
          bahn: null, ziel: g,
          loesung: [
            { t: "s", a, b: ma, stil: "strich" }, { t: "s", a: b, b: mb, stil: "strich" }, { t: "s", a: c, b: mc, stil: "strich" },
            { t: "gleich", a: b, b: ma }, { t: "gleich", a: ma, b: c }, { t: "gleich", a, b: mb }, { t: "gleich", a: mb, b: c },
            { t: "gleich", a, b: mc }, { t: "gleich", a: mc, b }, { t: "p", p: g },
          ],
          mass: 0.85,
        };
      });
    },

    // Ein gleichseitiges Dreieck über einer Strecke: Wo ist die dritte Ecke?
    // Es gibt zwei – beide gelten (auch).
    dreieck() {
      return wuerfle(() => {
        const lang = zz(32, 46);
        const w = schief(0, Math.PI);
        const m = P(0, 0);
        const a = plus(m, richt(w), -lang / 2);
        const b = plus(m, richt(w), lang / 2);
        const hoch = (lang * Math.sqrt(3)) / 2;
        const c1 = plus(m, richt(w + Math.PI / 2), hoch);
        const c2 = plus(m, richt(w + Math.PI / 2), -hoch);
        const loesung = (c) => [
          { t: "s", a, b: c, stil: "strich" }, { t: "s", a: b, b: c, stil: "strich" },
          { t: "gleich", a, b }, { t: "gleich", a, b: c }, { t: "gleich", a: b, b: c }, { t: "p", p: c },
        ];
        return {
          art: "dreieck", kurz: "Gleichseitig", frage: "Gleichseitiges Dreieck: Wo ist die dritte Ecke? Beide Seiten gelten.",
          punkte: [a, b, c1, c2],
          figur: [{ t: "s", a, b }, { t: "p", p: a }, { t: "p", p: b }],
          bahn: null, ziel: c1, loesung: loesung(c1),
          auch: { ziel: c2, loesung: loesung(c2) },
          mass: 0.85,
        };
      });
    },

    // Einen Punkt um einen anderen drehen: eine Vierteldrehung.
    drehen() {
      return wuerfle(() => {
        const r = zz(22, 40);
        const w0 = zz(0, TAU);
        const sinn = zufall.zahl() < 0.5 ? 1 : -1;
        const z = P(0, 0);
        const p = plus(z, richt(w0), r);
        const ziel = plus(z, richt(w0 + (sinn * Math.PI) / 2), r);
        const bauch = plus(z, richt(w0 + (sinn * Math.PI) / 4), r);
        return {
          art: "drehen", kurz: "Drehen", frage: "Dreh P um Z: eine Vierteldrehung in Pfeilrichtung. Wo landet P?",
          punkte: [z, p, ziel, bauch],
          figur: [
            { t: "s", a: z, b: p, stil: "duenn" },
            { t: "p", p: z, name: "Z", weg: richt(w0 + Math.PI + (sinn * Math.PI) / 4) },
            { t: "p", p, name: "P", weg: richt(w0) },
            { t: "kpfeil", m: z, r: 10.5, von: w0 + sinn * 0.28, bis: w0 + sinn * 1.28 },
          ],
          bahn: null, ziel,
          loesung: [
            { t: "k", m: z, r, von: w0, bis: w0 + (sinn * Math.PI) / 2, stil: "strich" }, { t: "s", a: z, b: ziel },
            { t: "eck", p: z, zu1: p, zu2: ziel }, { t: "gleich", a: z, b: p }, { t: "gleich", a: z, b: ziel }, { t: "p", p: ziel },
          ],
          mass: 0.85,
        };
      });
    },

    // Zwei Kugeln rollen aufeinander zu, verschieden schnell: Wo treffen sie sich?
    treffpunkt() {
      return wuerfle(() => {
        const lang = zz(56, 80);
        // Nie die Mitte: Eine der beiden ist deutlich schneller.
        const q = zufall.zahl() < 0.5 ? zz(0.24, 0.42) : zz(0.58, 0.76);
        const a = P(-lang / 2, 0);
        const b = P(lang / 2, 0);
        const ziel = P(-lang / 2 + q * lang, 0);
        const tempo = 26;
        const a1 = P(a.x, -6.5);
        const a2 = P(a.x + q * tempo, -6.5);
        const b1 = P(b.x, -6.5);
        const b2 = P(b.x - (1 - q) * tempo, -6.5);
        const w = schief(0, TAU);
        const alle = [a, b, ziel, a1, a2, b1, b2];
        alle.forEach((p) => Object.assign(p, dreh(p, w)));
        return {
          art: "treffpunkt", kurz: "Treffpunkt", frage: "Die Pfeile zeigen das Tempo der Kugeln. Wo treffen sie sich?",
          punkte: alle,
          figur: [{ t: "s", a, b, stil: "duenn" }, { t: "pfeil", a: a1, b: a2 }, { t: "pfeil", a: b1, b: b2 }, { t: "kugel", p: a }, { t: "kugel", p: b }],
          bahn: { a, b }, ziel, rollen: [[a, ziel], [b, ziel]],
          loesung: [{ t: "tick", p: ziel, w, l: 3.4 }],
          mass: 0.8,
        };
      });
    },

    // Einen Bogen in Gedanken weiterführen: Wo trifft er die Wand? Ein
    // Lineal hilft hier nicht – der Bogen ist krumm.
    kurve() {
      return wuerfle(() => {
        const r = zz(30, 46);
        const sinn = zufall.zahl() < 0.5 ? 1 : -1;
        const w0 = zz(0, TAU);
        const sicht = zz(45, 70) * GRAD;
        const fort = zz(35, 60) * GRAD;
        const m = P(0, 0);
        const w1 = w0 + sinn * sicht;
        const w2 = w1 + sinn * fort;
        const h = plus(m, richt(w2), r);
        const quer = dreh(richt(w2 + (sinn * Math.PI) / 2), zz(55, 125) * GRAD);
        const lang = zz(42, 54);
        const teil = zz(0.3, 0.7);
        const a = plus(h, quer, -lang * teil);
        const b = plus(h, quer, lang * (1 - teil));
        const rund = [0, 0.33, 0.66, 1].map((k) => plus(m, richt(w0 + sinn * sicht * k), r));
        const versteckt = [0.25, 0.5, 0.75].map((k) => plus(m, richt(w1 + sinn * fort * k), r));
        // Die Wand steht frei vom Bogen, den man sieht – und der Bogen trifft
        // sie nicht schon vorher.
        if (rund.some((p) => abstand(p, aufStrecke(p, a, b)) < 9)) return null;
        const seite = (p) => (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x);
        if (versteckt.some((p) => seite(p) * seite(rund[3]) <= 0)) return null;
        return {
          art: "kurve", kurz: "Bogen weiter", frage: "Der Bogen läuft gleichmässig weiter. Wo trifft er die Wand?",
          punkte: [m, ...rund, ...versteckt, h, a, b],
          figur: [{ t: "kpfeil", m, r, von: w0, bis: w1 }, { t: "wand", a, b, von: rund[3], ziel: true }],
          bahn: { a, b }, ziel: h,
          loesung: [{ t: "k", m, r, von: w1, bis: w2, stil: "strich" }],
          mass: 0.7,
        };
      });
    },

    // Die Bande: Die Kugel prallt ab – wo trifft sie die Wand?
    bande() {
      return wuerfle(() => {
        const th = zz(20, 55) * GRAD;
        const hoch = zz(22, 36);
        const b = P(0, 0);
        const s = P(-hoch * Math.tan(th), -hoch);
        const hin = richt(-Math.PI / 2 + th);        // nach dem Abprall: nach rechts oben
        const z = plus(b, hin, zz(30, 46));
        const quer = dreh(hin, zz(55, 125) * GRAD);
        const w1 = plus(z, quer, -zz(12, 30));
        const w2 = plus(z, quer, zz(12, 30));
        // Die Wand steht über der Bande und rechts vom Weg der Kugel.
        if (Math.max(w1.y, w2.y) > -6 || Math.min(w1.x, w2.x) < 5) return null;
        const b1 = P(s.x - zz(4, 10), 0);
        const b2 = P(zz(14, 26), 0);
        const w = zz(0, TAU);
        const alle = [b, s, z, w1, w2, b1, b2];
        alle.forEach((q) => Object.assign(q, dreh(q, w)));
        return {
          art: "bande", kurz: "Bande", frage: "Die Kugel prallt an der Bande ab. Wo trifft sie die gelbe Wand?",
          punkte: alle,
          figur: [{ t: "wand", a: b1, b: b2, von: s }, { t: "wand", a: w1, b: w2, von: b, ziel: true }, { t: "pfeil", a: s, b }, { t: "kugel", p: s }],
          bahn: { a: w1, b: w2 }, ziel: z, rollen: [[s, b, z]],
          loesung: [{ t: "s", a: b, b: z, stil: "strich" }, { t: "winkel", p: b, zu1: b1, zu2: s }, { t: "winkel", p: b, zu1: z, zu2: b2 }],
          mass: 0.7,
        };
      });
    },

    // Zwei Banden hintereinander.
    doppelbande() {
      return wuerfle(() => {
        const th = zz(24, 48) * GRAD;
        const hoch = zz(18, 28);
        const b1 = P(0, 0);
        const s = P(-hoch * Math.tan(th), -hoch);
        const d1 = richt(-Math.PI / 2 + th);         // nach der ersten Bande: nach rechts oben
        const b2 = plus(b1, d1, zz(26, 38));
        // Die zweite Bande: Die Kugel trifft sie unter diesem Winkel und
        // läuft danach nach links oben weiter.
        const ein = zz(26, 54) * GRAD;
        const t2 = dreh(d1, -ein);
        const d2 = dreh(d1, -2 * ein);
        const z = plus(b2, d2, zz(24, 36));
        const quer = dreh(d2, zz(55, 125) * GRAD);
        const w1 = plus(z, quer, -zz(10, 22));
        const w2 = plus(z, quer, zz(10, 22));
        const c1 = P(s.x - zz(3, 8), 0);
        const c2 = P(zz(9, 16), 0);
        const k1 = plus(b2, t2, -zz(9, 15));
        const k2 = plus(b2, t2, zz(9, 15));
        // Alles steht über der ersten Bande, nichts kreuzt sich, was sich
        // nicht kreuzen soll, und die Wand steht frei.
        if (Math.max(w1.y, w2.y, k1.y, k2.y) > -5) return null;
        if (kreuzen(s, b1, w1, w2) || kreuzen(b1, b2, w1, w2) || kreuzen(s, b1, k1, k2) || kreuzen(w1, w2, k1, k2)) return null;
        if (streckenAbstand(w1, w2, k1, k2) < 5 || streckenAbstand(w1, w2, s, b1) < 5 || streckenAbstand(w1, w2, b1, b2) < 4) return null;
        if (abstand(s, aufStrecke(s, k1, k2)) < 6 || abstand(s, aufStrecke(s, b2, z)) < 4) return null;
        const zuB1 = (k1.x - b2.x) * (b1.x - b2.x) + (k1.y - b2.y) * (b1.y - b2.y) > 0 ? k1 : k2;
        const zuZ = zuB1 === k1 ? k2 : k1;
        const w = zz(0, TAU);
        const alle = [b1, b2, s, z, w1, w2, c1, c2, k1, k2];
        alle.forEach((q) => Object.assign(q, dreh(q, w)));
        return {
          art: "doppelbande", kurz: "Zwei Banden", frage: "Die Kugel prallt an beiden Banden ab. Wo trifft sie die gelbe Wand?",
          punkte: alle,
          figur: [
            { t: "wand", a: c1, b: c2, von: s }, { t: "wand", a: k1, b: k2, von: b1 }, { t: "wand", a: w1, b: w2, von: b2, ziel: true },
            { t: "pfeil", a: s, b: b1 }, { t: "kugel", p: s },
          ],
          bahn: { a: w1, b: w2 }, ziel: z, rollen: [[s, b1, b2, z]],
          loesung: [
            { t: "s", a: b1, b: b2, stil: "strich" }, { t: "s", a: b2, b: z, stil: "strich" },
            { t: "winkel", p: b1, zu1: c1, zu2: s }, { t: "winkel", p: b1, zu1: b2, zu2: c2 },
            { t: "winkel", p: b2, zu1: zuB1, zu2: b1 }, { t: "winkel", p: b2, zu1: z, zu2: zuZ },
          ],
          mass: 0.55,
        };
      });
    },

    // Über die Bande ins Loch: Wo muss die Kugel die Bande treffen?
    zielbande() {
      return wuerfle(() => {
        const ha = zz(16, 34);
        let hb = zz(16, 34);
        // Nie gleich weit von der Bande: Sonst wäre es bloss die Mitte.
        if (Math.abs(ha - hb) < 6) hb = ha > 25 ? ha - zz(7, 9) : ha + zz(7, 9);
        const weit = zz(34, 58);
        const a = P(0, -ha);
        const b = P(weit, -hb);
        const x = P((weit * ha) / (ha + hb), 0);
        const c1 = P(-zz(5, 9), 0);
        const c2 = P(weit + zz(5, 9), 0);
        const w = zz(0, TAU);
        const alle = [a, b, x, c1, c2];
        alle.forEach((q) => Object.assign(q, dreh(q, w)));
        return {
          art: "zielbande", kurz: "Über Bande", frage: "Die Kugel soll über die Bande ins Loch. Wo muss sie die Bande treffen?",
          punkte: alle,
          figur: [{ t: "wand", a: c1, b: c2, von: a, ziel: true }, { t: "loch", p: b }, { t: "kugel", p: a }],
          bahn: { a: c1, b: c2 }, ziel: x, rollen: [[a, x, b]],
          loesung: [
            { t: "s", a, b: x, stil: "strich" }, { t: "s", a: x, b, stil: "strich" },
            { t: "winkel", p: x, zu1: c1, zu2: a }, { t: "winkel", p: x, zu1: b, zu2: c2 },
          ],
          mass: 0.75,
        };
      });
    },

    // Der Wurf: Der Ball ist ein Stück geflogen – wo landet er?
    wurf() {
      return wuerfle(() => {
        const hoch = zz(22, 36);
        const xa = zz(18, 28);
        const k = hoch / (xa * xa);
        const steil = (2 * hoch) / xa;
        // So viel tiefer als der Abwurf liegt der Boden (höher: negativ).
        const tiefer = zz(-9, 14);
        const xd = xa * (1 + zz(0.12, 0.3));
        const wurzel = Math.sqrt(steil * steil + 4 * k * tiefer);
        const xl = (steil + wurzel) / (2 * k);
        if (xl - xd < 9 || xl > 74) return null;
        const seite = zufall.zahl() < 0.5 ? 1 : -1;
        const ort = (x) => P(seite * x, -(x * steil - k * x * x));
        const flug = [];
        for (let i = 0; i <= 14; i += 1) flug.push(ort((xd * i) / 14));
        const rest = [];
        for (let i = 0; i <= 12; i += 1) rest.push(ort(xd + ((xl - xd) * i) / 12));
        const ziel = rest[rest.length - 1];
        // Liegt der Boden höher als der Abwurf, beginnt er erst hinter der
        // Stelle, an der der Ball auf dem Weg nach oben seine Höhe kreuzt.
        const ab = tiefer < 0 ? (steil - wurzel) / (2 * k) + 4 : -Infinity;
        const g1 = P(seite * Math.max(xl - zz(11, 20), ab), tiefer);
        const g2 = P(seite * (xl + zz(7, 12)), tiefer);
        const r1 = P(seite * -7, 0);
        const r2 = P(seite * 3.5, 0);
        const oben1 = P(0, -10);
        const oben2 = P(ziel.x, tiefer - 10);
        return {
          art: "wurf", kurz: "Wurf", frage: "Der Ball fliegt weiter, wie er begonnen hat. Wo landet er?",
          punkte: [...flug, ...rest, g1, g2, r1, r2, oben1, oben2],
          figur: [
            { t: "wand", a: r1, b: r2, von: oben1 }, { t: "wand", a: g1, b: g2, von: oben2, ziel: true },
            { t: "poly", pkte: flug, stil: "punkt" }, { t: "kugel", p: flug[flug.length - 1] },
          ],
          bahn: { a: g1, b: g2 }, ziel, rollen: [rest],
          loesung: [{ t: "poly", pkte: rest, stil: "punkt" }],
          mass: 0.6,
        };
      });
    },

    // Der Kreis durch drei Punkte: Wo ist sein Mittelpunkt?
    umkreis() {
      return wuerfle(() => {
        const r = zz(24, 36);
        const m = P(0, 0);
        const w1 = zz(0, TAU);
        const g1 = zz(50, 150) * GRAD;
        const g2 = zz(50, 150) * GRAD;
        // Nie alle drei eng beisammen auf einem kurzen Bogen.
        if (TAU - g1 - g2 > 230 * GRAD) return null;
        const pkte = [w1, w1 + g1, w1 + g1 + g2].map((w) => plus(m, richt(w), r));
        return {
          art: "umkreis", kurz: "Drei Punkte", frage: "Ein Kreis geht durch alle drei Punkte. Wo ist sein Mittelpunkt?",
          punkte: [m, ...pkte], kreise: [{ m, r }],
          figur: pkte.map((p) => ({ t: "p", p, gross: true })),
          bahn: null, ziel: m,
          loesung: [{ t: "k", m, r, von: w1, bis: w1 + TAU, stil: "strich" }, ...pkte.map((p) => ({ t: "s", a: m, b: p, stil: "strich" })), { t: "p", p: m }],
          mass: 0.7,
        };
      });
    },

    // Der grösste Kreis, der ins Dreieck passt: Wo ist seine Mitte?
    inkreis() {
      return wuerfle(() => {
        const ecken = dreieckRoh();
        if (!ecken) return null;
        const [a, b, c] = ecken;
        const la = abstand(b, c);
        const lb = abstand(a, c);
        const lc = abstand(a, b);
        const umfang = la + lb + lc;
        const m = P((la * a.x + lb * b.x + lc * c.x) / umfang, (la * a.y + lb * b.y + lc * c.y) / umfang);
        const r = Math.abs((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)) / umfang;
        // Wo der Kreis die Seiten berührt.
        const fuss = (p, q) => {
          const e = einheit(p, q);
          return plus(p, e, (m.x - p.x) * e.x + (m.y - p.y) * e.y);
        };
        const f = [fuss(a, b), fuss(b, c), fuss(a, c)];
        return {
          art: "inkreis", kurz: "Inkreis", frage: "Wo ist die Mitte des grössten Kreises, der ins Dreieck passt?",
          punkte: [a, b, c, m, ...f],
          figur: [{ t: "poly", pkte: [a, b, c], zu: true }],
          bahn: null, ziel: m,
          loesung: [{ t: "k", m, r, von: 0, bis: TAU }, ...f.map((p) => ({ t: "s", a: m, b: p, stil: "strich" })), { t: "p", p: m }],
          mass: 0.8,
        };
      });
    },

    // Die Fläche halbieren: ein Schnitt parallel zur Grundseite. Auf halber
    // Höhe liegt er nicht – oben ist das Dreieck schmal.
    halbieren() {
      return wuerfle(() => {
        const ecken = dreieckRoh();
        if (!ecken) return null;
        const [a, b, c] = ecken;
        const m = zwischen(a, b);
        const teil = Math.SQRT1_2;
        const ziel = zwischen(c, m, teil);
        const s1 = zwischen(c, a, teil);
        const s2 = zwischen(c, b, teil);
        const oben = zwischen(c, ziel, 0.62);
        const unten = zwischen(ziel, m, 0.5);
        return {
          art: "halbieren", kurz: "Fläche halbieren", frage: "Schneide parallel zu g so, dass beide Teile gleich viel Fläche haben.",
          punkte: [a, b, c, m, ziel, s1, s2, oben, unten],
          figur: [{ t: "poly", pkte: [a, b, c], zu: true }, { t: "s", a: c, b: m, stil: "achse" }, { t: "text", p: m, text: "g", weg: P(m.x - c.x, m.y - c.y) }],
          bahn: { a: c, b: m }, ziel, schnitt: { a, b, c },
          loesung: [
            { t: "flaeche", pkte: [c, s1, s2] }, { t: "s", a: s1, b: s2 },
            { t: "text", p: oben, text: "½", weg: P(0, 0) }, { t: "text", p: unten, text: "½", weg: P(0, 0) },
          ],
          mass: 0.8,
        };
      });
    },

    // Das Rad rollt eine Umdrehung weit: gut dreimal sein Durchmesser.
    rad() {
      return wuerfle(() => {
        const r = zz(6.5, 9.6);
        const umfang = TAU * r;
        const seite = zufall.zahl() < 0.5 ? 1 : -1;
        const kipp = zz(-0.22, 0.22);
        const x0 = r + 2;
        const p0 = P(seite * x0, 0);
        const ziel = P(seite * (x0 + umfang), 0);
        const m0 = P(seite * x0, -r);
        const m1 = P(seite * (x0 + umfang), -r);
        const g1 = P(0, 0);
        const g2 = P(seite * (x0 + umfang + r + 2), 0);
        const oben = P(seite * x0, -3 * r);
        const unten = P(seite * x0, 12);
        const pf1 = P(seite * (x0 + r + 3), -r * 1.9);
        const pf2 = P(seite * (x0 + r + 13), -r * 1.9);
        const merk = P(seite * (x0 + umfang / 2), 15.5);
        const alle = [p0, ziel, m0, m1, g1, g2, oben, unten, pf1, pf2, merk];
        alle.forEach((q) => Object.assign(q, dreh(q, kipp)));
        return {
          art: "rad", kurz: "Rad", frage: "Das Rad rollt genau eine Umdrehung weit. Wo berührt es dann den Boden?",
          punkte: alle, kreise: [{ m: m0, r }, { m: m1, r }],
          figur: [{ t: "wand", a: g1, b: g2, von: oben, ziel: true }, { t: "rad", m: m0, r, zu: p0 }, { t: "pfeil", a: pf1, b: pf2 }],
          bahn: { a: g1, b: g2 }, ziel, rad: { m0, m1, r, p0, sinn: seite }, lineal: { a: p0, b: ziel, zu: unten },
          loesung: [{ t: "text", p: merk, text: "3,14 × Durchmesser", weg: P(0, 0) }],
          mass: 0.7,
        };
      });
    },

    // Der Tunnel: Die Kugel rollt hinein – und der Tipp sagt, wann sie beim
    // Pfeil sein muss.
    tunnel() {
      return wuerfle(() => {
        const lang = 84;
        const a = P(0, 0);
        const b = P(lang, 0);
        const s1 = zz(26, 36);
        const sm = s1 + zz(18, 40);
        const v = zz(26, 38);
        const hoch = 6.5;
        const w = zz(-0.4, 0.4) + (zufall.zahl() < 0.5 ? Math.PI : 0);
        const kasten = [P(s1, -hoch), P(lang, -hoch), P(lang, hoch), P(s1, hoch)];
        const ziel = P(sm, 0);
        // Der Pfeil steht immer oben im Bild.
        const oben = Math.cos(w) >= 0 ? -1 : 1;
        const spitze = P(sm, oben * (hoch + 1.5));
        const fuss = P(sm, oben * (hoch + 9));
        const alle = [a, b, ziel, spitze, fuss, ...kasten];
        alle.forEach((q) => Object.assign(q, dreh(q, w)));
        return {
          art: "tunnel", kurz: "Tunnel", frage: "Tippe, wenn die Kugel beim Pfeil sein muss.",
          punkte: alle,
          figur: [],
          bahn: null, ziel, a, b, kasten, spitze, fuss, s1, sm, v, lang, start: 0.3,
          loesung: [],
          mass: 0.7,
        };
      });
    },
  };

  // Die Reihe mischen, ohne die Liste selbst zu ändern.
  /*
   * Was zu tun ist, Art für Art – der Satz der Vorschau. Die Frage über dem
   * Blatt ist kurz, weil die Uhr läuft; hier läuft sie nicht.
   */
  const TUN = {
    kreis: "Setz das Fadenkreuz dorthin, wo der Mittelpunkt des Kreises liegt.",
    rechteck: "Setz das Fadenkreuz auf die Mitte des Rechtecks – dort, wo sich die Diagonalen kreuzen.",
    winkel: "Teile den Winkel in zwei gleiche Hälften: Schieb das Fadenkreuz auf die Stelle des Bogens, die genau in der Mitte liegt.",
    lot: "Der kürzeste Weg von P zur Linie trifft sie im rechten Winkel. Schieb das Fadenkreuz auf die Stelle der Linie, an der er ankommt.",
    spiegel: "Die Linie ist ein Spiegel. Setz das Fadenkreuz dorthin, wo das Spiegelbild von P liegt: genau gegenüber, gleich weit hinter der Linie.",
    eck: "Drei Ecken eines Rechtecks sind da. Setz das Fadenkreuz dorthin, wo die vierte liegen muss.",
    schwerpunkt: "Setz das Fadenkreuz auf den Schwerpunkt des Dreiecks – die Stelle, auf der es im Gleichgewicht läge.",
    dreieck: "Die Strecke ist eine Seite eines Dreiecks mit drei gleich langen Seiten. Setz das Fadenkreuz auf die dritte Ecke – links oder rechts davon, beides gilt.",
    drehen: "P dreht sich um Z: eine Vierteldrehung in Pfeilrichtung, immer gleich weit von Z weg. Setz das Fadenkreuz dorthin, wo P landet.",
    treffpunkt: "Zwei Kugeln rollen aufeinander zu. Der längere Pfeil gehört der schnelleren. Schieb das Fadenkreuz dorthin, wo sie sich treffen.",
    kurve: "Der Bogen läuft mit derselben Krümmung weiter. Schieb das Fadenkreuz auf die Stelle der Wand, an der er ankommt.",
    bande: "Die Kugel prallt an der Bande ab wie Licht an einem Spiegel. Schieb das Fadenkreuz auf die Stelle der gelben Wand, die sie danach trifft.",
    bogen: "Der Bogen ist ein Stück eines Kreises. Setz das Fadenkreuz auf den Mittelpunkt dieses Kreises.",
    doppelbande: "Die Kugel prallt nacheinander an zwei Banden ab. Schieb das Fadenkreuz auf die Stelle der gelben Wand, die sie am Schluss trifft.",
    zielbande: "Die Kugel soll über die Bande ins Loch. Schieb das Fadenkreuz auf die Stelle der Bande, an der sie abprallen muss.",
    wurf: "Der Ball fliegt im Bogen weiter, so wie er begonnen hat. Schieb das Fadenkreuz auf die Stelle, an der er landet.",
    umkreis: "Durch die drei Punkte geht genau ein Kreis. Setz das Fadenkreuz auf seinen Mittelpunkt – er ist von allen dreien gleich weit weg.",
    inkreis: "Ins Dreieck passt ein grösster Kreis, der alle drei Seiten berührt. Setz das Fadenkreuz auf seinen Mittelpunkt.",
    halbieren: "Ein Schnitt parallel zur Seite g teilt das Dreieck in zwei Teile. Schieb ihn so, dass beide gleich viel Fläche haben.",
    rad: "Das Rad rollt genau eine Umdrehung weit. Schieb das Fadenkreuz auf die Stelle am Boden, die es dann berührt.",
    tunnel: "Die Kugel rollt gleichmässig in den Tunnel, dann sieht man sie nicht mehr. Tippe in dem Augenblick, in dem sie beim Pfeil sein muss.",
  };

  function mische(liste) {
    const kopie = [...liste];
    for (let i = kopie.length - 1; i > 0; i -= 1) {
      const j = Math.floor(zufall.zahl() * (i + 1));
      [kopie[i], kopie[j]] = [kopie[j], kopie[i]];
    }
    return kopie;
  }

  // Die zehn Blätter einer Runde – alle auf einmal gewürfelt, damit beim
  // Zuschauen dieselben entstehen, egal wie lange jemand für eines braucht.
  // Zu jedem Blatt gehört ein Beispiel für die Vorschau: eine zweite Aufgabe
  // derselben Art. Die Beispiele werden erst nach den zehn Blättern
  // gewürfelt – so bleiben die Blätter einer Saat dieselben wie zuvor.
  function aufgabenFuer() {
    const reihe = [LEICHT, MITTEL, SCHWER].flatMap((arten, stufe) => mische(arten).slice(0, PLAN[stufe]).map((art) => ({ art, zeit: ZEITEN[stufe] })));
    const blaetter = reihe.map(({ art, zeit }, nr) => ({ ...BAU[art](), nr, zeit }));
    blaetter.forEach((a) => { a.beispiel = BAU[a.art](); });
    return blaetter;
  }

  // Die Runde als Text – für die Prüfung, dass in einem Turnier alle
  // dieselben Blätter bekommen.
  function weltText(blaetter = state.blaetter) {
    return (blaetter || []).map((a) => `${a.art}:${a.ziel.x.toFixed(2)}/${a.ziel.y.toFixed(2)}`).join(" ");
  }

  // Wo die Kugel im Tunnel t Sekunden nach dem Loslassen ist (als Weg auf
  // der Schiene). Vor dem Loslassen (t < 0) steht sie am Anfang.
  function kugelWeg(a, t) {
    return clamp((t - a.start) * a.v, 0, a.lang);
  }

  // Wie lange nach dem Loslassen die Kugel am Ende der Schiene ist – dann
  // ist die Aufgabe vorbei.
  const tunnelEnde = (a) => a.start + a.lang / a.v;

  // Aus einem Weg auf der Schiene wird ein Ort auf dem Blatt.
  const tunnelOrt = (a, s) => zwischen(a.a, a.b, s / a.lang);

  // Das Fadenkreuz läuft auf der Bahn der Aufgabe – oder frei über das Blatt.
  function aufBahn(a, p) {
    const bahn = a.bahn;
    if (!bahn) return P(clamp(p.x, 0, BLATT), clamp(p.y, 0, BLATT));
    if (bahn.r) {
      // Auf dem Bogen: der Winkel zum Finger, gehalten zwischen den Enden.
      let w = Math.atan2(p.y - bahn.m.y, p.x - bahn.m.x);
      const mitte = (bahn.von + bahn.bis) / 2;
      while (w < mitte - Math.PI) w += TAU;
      while (w > mitte + Math.PI) w -= TAU;
      return plus(bahn.m, richt(clamp(w, bahn.von, bahn.bis)), bahn.r);
    }
    return aufStrecke(p, bahn.a, bahn.b);
  }

  // Wie viele Millimeter die Antwort neben der Lösung liegt. Im Tunnel ist
  // die Antwort die Stelle der Kugel beim Tipp.
  function daneben(a, antwort) {
    if (!antwort) return Infinity;
    return abstand(antwort, a.ziel);
  }

  // Manche Aufgaben haben zwei richtige Stellen (die dritte Ecke liegt
  // links oder rechts der Strecke). Es gilt die, die der Antwort näher ist.
  function richte(a, antwort) {
    if (!a.auch || !antwort || abstand(antwort, a.auch.ziel) >= abstand(antwort, a.ziel)) return;
    const andere = { ziel: a.ziel, loesung: a.loesung };
    a.ziel = a.auch.ziel;
    a.loesung = a.auch.loesung;
    a.auch = andere;
    a.stempel = null;
  }

  function punkteFuer(mm, mass = 1) {
    const streng = mm * mass;
    // Das Härchen: 1,1 mm sind in Fliesskomma nicht immer 1,1.
    for (let i = 0; i < GRENZEN.length; i += 1) if (streng <= GRENZEN[i] + 1e-9) return PUNKTE_JE_BLATT - i;
    return 0;
  }

  // ---------------------------------------------------------------------------
  // Zustand
  // ---------------------------------------------------------------------------
  // phase: "bereit" (vor dem ersten Tipp), "vorschau" (was zu tun ist – die
  // Uhr läuft noch nicht), "aufgabe", "zeigen" (die Lösung steht da),
  // "zuschauen", "ende"
  const state = {
    phase: "bereit",
    blaetter: null,        // die zehn Aufgaben der Runde
    index: 0,
    punkte: 0,
    liste: [],             // je Blatt { punkte, mm } – null, solange es offen ist
    t0: 0,                 // wann das Blatt begann (performance.now)
    vorSeit: 0,            // wann seine Vorschau begann
    tZeig: 0,              // wann die Lösung begann
    zeiger: null,          // das Fadenkreuz { x, y } in Millimetern
    griff: null,           // der Finger darauf { id, art, versetzt, px, py, px0, py0, weit, seit }
    wink: null,            // nach einem blossen Antippen: wo der Griff liegt { px, py, seit }
    eingabe: "",           // womit zuletzt getippt wurde: "touch", "mouse", "pen"
    antwort: null,         // die Antwort { x, y } – null: keine
    wertung: null,         // { mm, punkte }, sobald die Lösung dasteht
    serie: 0,              // genaue Treffer hintereinander
    funken: [],
    tickBei: 0,            // für welche Sekunde es zuletzt getickt hat
    schieber: 0,           // was der Messschieber gerade zeigt, in Millimetern
    imTunnel: false,
    los: 0,                // wann die Kugel im Tunnel losgelassen wurde (performance.now), 0: noch nicht
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

  const view = { dpr: 1, cssW: 0, cssH: 0, frei: 0, s: 3, x0: 0, y0: 0, seite: 300, hoch: false, guete: 1, u: 1 };

  const blatt = () => state.blaetter?.[state.index] || null;
  // Wie lange das Blatt schon daliegt, in Sekunden.
  const seit = (jetzt = performance.now()) => (jetzt - state.t0) / 1000;
  // Wie lange die Kugel im Tunnel schon rollt – negativ, solange sie wartet.
  const tunnelZeit = (jetzt = performance.now()) => (state.los ? (jetzt - state.los) / 1000 : -1);

  function clearStep() {
    if (stepTimer) { window.clearTimeout(stepTimer); stepTimer = null; }
  }

  function stopLoop() {
    if (frame) { window.cancelAnimationFrame(frame); frame = null; }
  }

  // ---------------------------------------------------------------------------
  // Bestenliste – lokal und in der Cloud
  // ---------------------------------------------------------------------------
  const store = cloudApi
    ? cloudApi.register({ key: "lernapp.augenmass", empty: { runs: 0, scores: [] }, merge: cloudApi.mergeScores(TOP_COUNT) })
    : {
      read: () => ({ runs: 0, scores: [] }),
      write(data) { return data; },
      update(fn) { return fn(this.read()); },
      onChange() { return () => {}; },
    };

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

  // Die Antwort steht: erst der Stift, einen Wimpernschlag später, wie nah
  // es war – genau die Harfe, nah ein Punkt, weit daneben der Fehler.
  function antwortKlang(punkte) {
    ton("augenmass.mass");
    const spaeter = { verzoegerung: 0.32 };
    if (punkte === PUNKTE_JE_BLATT) {
      state.serie += 1;
      ton(state.serie >= 3 ? "meilenstein" : "perfekt", spaeter);
      return;
    }
    state.serie = 0;
    if (punkte >= 4) ton("punkt", spaeter);
    else ton("fehler", spaeter);
  }

  // ---------------------------------------------------------------------------
  // Funken – für die genauen Treffer
  // ---------------------------------------------------------------------------
  function funkenBei(ort) {
    if (ruhig()) return;
    for (let i = 0; i < 18; i += 1) {
      const w = Math.random() * TAU;
      const v = 14 + Math.random() * 26;
      state.funken.push({ x: ort.x, y: ort.y, vx: Math.cos(w) * v, vy: Math.sin(w) * v, alt: 0, leben: 0.5 + Math.random() * 0.45 });
    }
  }

  // ---------------------------------------------------------------------------
  // Die Züge – für die Aufzeichnung und für die anderen im Multiplayer
  // ---------------------------------------------------------------------------
  /*
   * Ein Zug (geist.js, zuege; live-spiel.js, zug) bei jedem neuen Blatt und
   * jeder Antwort, dazwischen die Lage des Fadenkreuzes (zehnmal je Sekunde):
   *
   *   c   das wievielte Blatt × 4 + was gerade ist: 0 es liegt da, 2 das
   *       Fadenkreuz ist unterwegs (im Tunnel: die Kugel rollt), 1 die
   *       Antwort steht, 3 die Zeit war um und niemand hatte getippt
   *   a   wo das Fadenkreuz steht, quer – in Tausendsteln eines Millimeters
   *   b   dasselbe von oben
   *
   * Die Vorschau eines Blattes ist der Zug 0 mit a = 1: Noch liegt es nicht
   * da, zu sehen ist, was zu tun sein wird. (Aufzeichnungen von vor der
   * Vorschau haben diesen Zug nicht – dort liegt das Blatt gleich da.)
   *
   * Die Blätter kommen aus derselben Saat. Wer zuschaut, würfelt sie in
   * derselben Reihe, lässt das Fadenkreuz zwischen zwei Lagen gleiten und
   * rechnet die Punkte der Antwort selbst.
   */
  const ZUG_MM = 1000;

  function ortJetzt(was) {
    const z = state.zeiger;
    return { a: z ? Math.round(z.x * ZUG_MM) : 0, b: z ? Math.round(z.y * ZUG_MM) : 0, c: state.index * 4 + was };
  }

  function meldeZug(was, vorschau = false) {
    if (zuschauer) return;
    const ort = vorschau ? { a: 1, b: 0, c: state.index * 4 } : ortJetzt(was);
    aufnahme?.zug(state.punkte, ort);
    const live = window.LernappLiveSpiel;
    if (shell?.live && live?.zug && live.gestartet?.()) live.zug(state.punkte, ort);
  }

  function meldeLage() {
    if (zuschauer || state.phase !== "aufgabe" || !state.zeiger) return;
    const ort = ortJetzt(2);
    aufnahme?.lage(state.punkte, ort);
    window.LernappLiveSpiel?.lage?.(state.punkte, ort);
  }

  // ---------------------------------------------------------------------------
  // Ablauf
  // ---------------------------------------------------------------------------
  // Das nächste Blatt kündigt sich an: erst die Vorschau – was zu tun ist,
  // mit einem Beispiel. Die Uhr läuft noch nicht.
  function blattAuf(index) {
    clearStep();
    state.index = index;
    state.phase = "vorschau";
    state.vorSeit = performance.now();
    state.t0 = state.vorSeit;
    state.zeiger = null;
    state.griff = null;
    state.wink = null;
    state.antwort = null;
    state.wertung = null;
    spur.length = 0;
    state.tickBei = 0;
    state.imTunnel = false;
    state.los = 0;
    const a = blatt();
    if (status) status.textContent = `Blatt ${index + 1} von ${BLAETTER}: ${a.kurz}. ${TUN[a.art] || a.frage} Tippe, wenn du bereit bist.`;
    ton("augenmass.blatt");
    meldeZug(0, true);
  }

  // Der Tipp nach der Vorschau: Jetzt liegt das Blatt auf dem Tisch, und
  // seine Uhr läuft.
  function blattLos() {
    if (state.phase !== "vorschau") return;
    state.phase = "aufgabe";
    state.t0 = performance.now();
    const a = blatt();
    if (status) status.textContent = `Blatt ${state.index + 1} von ${BLAETTER}: ${a.frage}`;
    ton("augenmass.setzen");
    meldeZug(0);
  }

  // Die Antwort – ort ist die Stelle auf dem Blatt, oder null, wenn die Zeit
  // um war und niemand getippt hatte.
  function antworte(ort) {
    if (state.phase !== "aufgabe") return;
    clearStep();
    const a = blatt();
    state.phase = "zeigen";
    state.tZeig = performance.now();
    state.griff = null;
    state.wink = null;
    // Gerechnet wird mit der Stelle, wie sie aufgezeichnet wird (auf ein
    // Tausendstel Millimeter): So misst die Wiedergabe genau dasselbe, auch
    // wenn eine Antwort haarscharf auf einer Punktgrenze liegt.
    const rund = (wert) => Math.round(wert * ZUG_MM) / ZUG_MM;
    state.antwort = ort ? P(rund(ort.x), rund(ort.y)) : null;
    state.zeiger = ort ? P(rund(ort.x), rund(ort.y)) : null;
    richte(a, state.antwort);
    const mm = daneben(a, state.antwort);
    const punkte = state.antwort ? punkteFuer(mm, a.mass) : 0;
    state.wertung = { mm, punkte };
    state.liste[state.index] = { mm, punkte };
    state.punkte += punkte;
    shell.setCount(state.punkte);
    meldeZug(state.antwort ? 1 : 3);
    antwortKlang(punkte);
    if (punkte === PUNKTE_JE_BLATT) { funkenBei(a.ziel); kids()?.vibrate?.([14, 40, 22]); } else if (punkte >= 4) kids()?.vibrate?.(12);
    if (status) status.textContent = state.antwort ? `${mm.toFixed(1)} Millimeter daneben: ${punkte} Punkte.` : "Zeit um: 0 Punkte.";

    stepTimer = window.setTimeout(weiter, ZEIGEN_MS);
  }

  // Die Lösung hat lange genug dagestanden: das nächste Blatt – oder, nach
  // dem zehnten, das Ergebnis.
  function weiter() {
    if (state.phase !== "zeigen") return;
    clearStep();
    if (state.index + 1 >= BLAETTER) finish();
    else blattAuf(state.index + 1);
  }

  // Die Kugel im Tunnel rollt los – von selbst, kurz nachdem das Blatt
  // daliegt: Was zu tun ist, stand in der Vorschau.
  function kugelLos(ms) {
    if (state.los) return;
    state.los = ms;
    meldeZug(2);
  }

  // Im Tunnel ist der Tipp die Antwort, ein Augenblick: wo die Kugel gerade
  // ist. Ein Tipp, solange sie noch zu sehen ist (oder noch gar nicht
  // rollt), gilt nicht – der war ein Versehen.
  function tippTunnel(zeitstempel) {
    const a = blatt();
    const nun = performance.now();
    const ms = zeitstempel > 0 && Math.abs(zeitstempel - nun) < 400 ? zeitstempel : nun;
    if (!state.los) return;
    const weg = kugelWeg(a, tunnelZeit(ms));
    if (weg < a.s1) return;
    antworte(tunnelOrt(a, weg));
  }

  // Das Fadenkreuz setzen – auf die Bahn der Aufgabe, wenn sie eine hat.
  function setzeZeiger(ort) {
    const a = blatt();
    if (!a) return;
    state.zeiger = aufBahn(a, ort);
    // Die letzten Stellen des Fingers, für das Abheben (ruhigeStelle): das
    // letzte Viertel einer Sekunde – und die eine Stelle davor. Wer das
    // Fadenkreuz hält und hinschaut, bewegt den Finger oft lange nicht.
    const nun = performance.now();
    spur.push({ t: nun, x: state.zeiger.x, y: state.zeiger.y });
    while (spur.length > 2 && nun - spur[1].t > 250) spur.shift();
    meldeLage();
  }

  // Beim Abheben rollt die Fingerkuppe ab, und die letzte gemeldete Stelle
  // liegt oft einen Bildpunkt neben der, auf der der Finger geruht hat – bei
  // einem halben Millimeter für die zehn Punkte ist das zu viel. Hat der
  // Finger zuletzt stillgehalten (weniger als ein guter Millimeter in den
  // letzten Augenblicken), zählt darum die Stelle von kurz vor dem Abheben.
  const spur = [];
  const ABHEBEN_MS = 70;
  function ruhigeStelle(zuletzt) {
    const nun = performance.now();
    let frueher = null;
    for (let i = spur.length - 1; i >= 0; i -= 1) {
      if (nun - spur[i].t >= ABHEBEN_MS) { frueher = spur[i]; break; }
    }
    if (!frueher) return zuletzt;
    const still = spur.every((p) => p.t < frueher.t || Math.hypot(p.x - frueher.x, p.y - frueher.y) < 1.2);
    return still && Math.hypot(zuletzt.x - frueher.x, zuletzt.y - frueher.y) < 1.2 ? P(frueher.x, frueher.y) : zuletzt;
  }

  // Was die Uhr tut, Bild für Bild: Die Vorschau wartet auf den Tipp (aber
  // nicht ewig). Danach läuft die Zeit des Blattes ab – im Tunnel rollt
  // stattdessen die Kugel bis ans Ende.
  function uhrTakt() {
    if (state.phase === "vorschau") {
      if (performance.now() - state.vorSeit >= VORSCHAU * 1000) blattLos();
      return;
    }
    if (state.phase !== "aufgabe") return;
    const a = blatt();
    const t = seit();
    if (a.art === "tunnel") {
      // Die Kugel rollt los, sobald das Blatt daliegt.
      if (!state.los) {
        if (t >= EINZUG + TUNNEL_START) kugelLos(performance.now());
        return;
      }
      const rollt = tunnelZeit();
      const drin = kugelWeg(a, rollt) >= a.s1;
      if (drin && !state.imTunnel) { state.imTunnel = true; ton("augenmass.tunnel"); }
      // Die Kugel ist am Ende der Schiene, und niemand hat getippt.
      if (rollt >= tunnelEnde(a)) antworte(null);
      return;
    }
    const rest = EINZUG + a.zeit - t;
    // Die letzten drei Sekunden ticken.
    const sekunde = Math.ceil(rest);
    if (rest > 0 && sekunde <= 3 && sekunde !== state.tickBei) { state.tickBei = sekunde; ton("augenmass.tick"); }
    if (rest <= 0) antworte(state.zeiger);
  }

  function takt(dt) {
    if (state.phase === "zuschauen") zuschauenTakt();
    else uhrTakt();
    // Der Messschieber fährt auf, was gemessen wurde, und beim nächsten
    // Blatt wieder zu.
    const mm = state.wertung && Number.isFinite(state.wertung.mm) ? state.wertung.mm : 0;
    state.schieber += (mm - state.schieber) * (1 - Math.exp(-9 * dt));
    if (Math.abs(mm - state.schieber) < 0.004) state.schieber = mm;
    // Die Funken fliegen aus und verglühen.
    for (let i = state.funken.length - 1; i >= 0; i -= 1) {
      const f = state.funken[i];
      f.alt += dt;
      if (f.alt >= f.leben) { state.funken.splice(i, 1); continue; }
      f.x += f.vx * dt;
      f.y += f.vy * dt;
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
    const platz = shell.el("div", "am-platz");
    feld = shell.el("div", "am-feld");
    canvas = document.createElement("canvas");
    canvas.className = "am-canvas";
    canvas.setAttribute("aria-hidden", "true");
    feld.append(canvas);
    g = canvas.getContext("2d");
    platz.append(feld);
    return platz;
  }

  let papierAlt = null;

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
    // Das Blatt: ein Quadrat, so gross wie möglich. Darüber die Frage und
    // die Uhr, darunter die zehn Kästchen.
    const u = clamp(Math.min(cssW, cssH - frei) / 400, 0.72, 1.3);
    const fuss = Math.round(54 * u);
    // Auf einem flachen Bild (Handy quer) steht die Frage links neben dem
    // Blatt statt darüber – so bleibt dem Blatt die ganze Höhe.
    const hoehe = cssH - frei - fuss - Math.round(24 * u);
    view.flach = !view.hoch && cssH - frei < 520 && (cssW - hoehe) / 2 >= 200;
    const kopf = Math.round((view.flach ? 24 : 82) * u);
    const seite = Math.max(120, Math.min(cssW - 28, cssH - frei - kopf - fuss));
    view.u = u;
    view.seite = seite;
    view.s = seite / BLATT;
    view.x0 = Math.round((cssW - seite) / 2);
    // Der Messschieber: hoch unter den Kästchen, quer rechts neben dem
    // Blatt – wo dafür Platz ist.
    const rest = Math.max(0, cssH - frei - kopf - fuss - seite);
    const rechts = cssW - view.x0 - seite;
    view.schieber = null;
    let unten = 0;
    if (rechts >= 250) {
      const breit = Math.min(300, rechts - 44);
      view.schieber = { x: view.x0 + seite + (rechts - breit) / 2, y: 0, w: breit };
    } else {
      const breit = Math.min(seite * 0.84, 330 * u);
      if (rest >= breit * 0.36 + 26 * u) {
        unten = breit * 0.36 + 14 * u;
        view.schieber = { x: view.x0 + (seite - breit) / 2, y: 0, w: breit };
      }
    }
    view.y0 = Math.round(frei + kopf + (rest - unten) * 0.5);
    if (view.schieber) view.schieber.y = unten ? view.y0 + seite + fuss + 4 * u : view.y0 + seite * 0.16;
    view.lw = clamp(view.s * 0.5, 1.5, 2.6);
    const pw = Math.round(cssW * dpr);
    const ph = Math.round(cssH * dpr);
    if (canvas.width !== pw) canvas.width = pw;
    if (canvas.height !== ph) canvas.height = ph;
    papierAlt = null;
  }

  // Vom Blatt ins Bild und zurück.
  const X = (x) => view.x0 + x * view.s;
  const Y = (y) => view.y0 + y * view.s;

  // Wo der Finger im Bild ist.
  function fingerOrt(event) {
    const r = canvas.getBoundingClientRect();
    return { px: event.clientX - r.left, py: event.clientY - r.top };
  }

  /*
   * Der Versatz: Das Fadenkreuz steht VERSATZ Bildpunkte über dem Finger.
   * Ist unter dem Blatt weniger Platz als das (Handy quer), käme es nie an
   * dessen unteren Rand. Dann schrumpft der Versatz auf dem letzten Stück
   * gleichmässig – über einen Weg dreimal so lang wie das, was fehlt, sodass
   * das Fadenkreuz dort nur um ein Drittel schneller läuft als der Finger.
   */
  function versatzMass() {
    const grund = view.cssH - VERSATZ_RAND;
    const unten = Math.max(0, grund - (view.y0 + view.seite) - 2);
    const fehlt = Math.max(0, VERSATZ - unten);
    return { grund, fehlt, ab: grund - fehlt * 3 };
  }

  // Wie weit das Fadenkreuz über einem Finger auf der Höhe py steht.
  function versatzBei(py) {
    const { fehlt, ab } = versatzMass();
    return fehlt ? VERSATZ - fehlt * clamp((py - ab) / (fehlt * 3), 0, 1) : VERSATZ;
  }

  // Umgekehrt: auf welcher Höhe der Finger liegt, wenn das Fadenkreuz auf zy steht.
  function fingerBei(zy) {
    const { grund, fehlt, ab } = versatzMass();
    if (!fehlt || zy + VERSATZ <= ab) return zy + VERSATZ;
    const py = (zy + VERSATZ + ab / 3) / (1 + 1 / 3);
    return py <= grund ? py : zy + VERSATZ - fehlt;
  }

  // Die Stelle des Blattes, auf die ein Zeiger zeigt – versetzt: die über dem Finger.
  function blattOrt(event, versetzt = false) {
    const { px, py } = fingerOrt(event);
    return P((px - view.x0) / view.s, (py - (versetzt ? versatzBei(py) : 0) - view.y0) / view.s);
  }

  // ---------------------------------------------------------------------------
  // Das Papier
  // ---------------------------------------------------------------------------
  /*
   * Die Blaupause: ein Blau, das zur Mitte heller wird, darin das Korn des
   * Papiers, ein paar Fasern und Wolken, wie sie beim Belichten entstehen.
   * Ein Raster hat das Blatt absichtlich nicht – daran liesse sich abzählen,
   * was hier geschätzt werden soll. Das Bild wird einmal gemalt und danach
   * Bild für Bild nur noch hingelegt.
   */
  function papierBild() {
    if (papierAlt) return papierAlt;
    const c = document.createElement("canvas");
    c.width = canvas.width;
    c.height = canvas.height;
    const p = c.getContext("2d");
    const d = view.dpr;
    const W = c.width;
    const H = c.height;
    const grund = p.createLinearGradient(0, 0, 0, H);
    grund.addColorStop(0, "#174c97");
    grund.addColorStop(0.5, "#113d80");
    grund.addColorStop(1, "#0b2d66");
    p.fillStyle = grund;
    p.fillRect(0, 0, W, H);
    // Das Licht der Lampe: von oben links.
    const mx = (view.x0 + view.seite * 0.38) * d;
    const my = (view.y0 + view.seite * 0.3) * d;
    const licht = p.createRadialGradient(mx, my, 0, mx, my, Math.max(W, H) * 0.8);
    licht.addColorStop(0, "rgba(118, 178, 255, 0.34)");
    licht.addColorStop(0.45, "rgba(90, 150, 240, 0.1)");
    licht.addColorStop(1, "rgba(90, 150, 240, 0)");
    p.fillStyle = licht;
    p.fillRect(0, 0, W, H);
    // Wolken: grosse, kaum sichtbare Flecken.
    for (let i = 0; i < 16; i += 1) {
      const x = Math.random() * W;
      const y = Math.random() * H;
      const r = (0.12 + Math.random() * 0.22) * Math.max(W, H);
      const hell = Math.random() < 0.5;
      const fleck = p.createRadialGradient(x, y, 0, x, y, r);
      fleck.addColorStop(0, hell ? "rgba(150, 195, 255, 0.05)" : "rgba(3, 14, 44, 0.07)");
      fleck.addColorStop(1, hell ? "rgba(150, 195, 255, 0)" : "rgba(3, 14, 44, 0)");
      p.fillStyle = fleck;
      p.fillRect(x - r, y - r, 2 * r, 2 * r);
    }
    // Das Korn und die Fasern.
    const flaeche = (W * H) / (d * d);
    for (let i = 0; i < flaeche / 260; i += 1) {
      p.fillStyle = Math.random() < 0.6 ? "rgba(200, 225, 255, 0.05)" : "rgba(2, 10, 36, 0.08)";
      const gross = (0.6 + Math.random() * 1.1) * d;
      p.fillRect(Math.random() * W, Math.random() * H, gross, gross);
    }
    p.lineWidth = 0.6 * d;
    for (let i = 0; i < flaeche / 2600; i += 1) {
      const x = Math.random() * W;
      const y = Math.random() * H;
      const w = Math.random() * Math.PI;
      const lang = (5 + Math.random() * 16) * d;
      p.strokeStyle = Math.random() < 0.5 ? "rgba(205, 228, 255, 0.045)" : "rgba(2, 10, 36, 0.06)";
      p.beginPath();
      p.moveTo(x, y);
      p.quadraticCurveTo(x + Math.cos(w) * lang * 0.5 + (Math.random() - 0.5) * 4 * d, y + Math.sin(w) * lang * 0.5 + (Math.random() - 0.5) * 4 * d, x + Math.cos(w) * lang, y + Math.sin(w) * lang);
      p.stroke();
    }
    // Die Ränder dunkeln ab.
    const rand = p.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.hypot(W, H) * 0.62);
    rand.addColorStop(0, "rgba(2, 10, 34, 0)");
    rand.addColorStop(1, "rgba(2, 10, 34, 0.55)");
    p.fillStyle = rand;
    p.fillRect(0, 0, W, H);

    // Der Rahmen des Bogens: eine kräftige und eine feine Linie.
    const linie = (einzug, breite, farbe) => {
      p.strokeStyle = farbe;
      p.lineWidth = breite * d;
      p.strokeRect(einzug * d, einzug * d, W - 2 * einzug * d, H - 2 * einzug * d);
    };
    linie(7, 1.4, "rgba(190, 220, 255, 0.4)");
    linie(11.5, 0.7, "rgba(190, 220, 255, 0.22)");

    // Das Zeichenfeld: ein Hauch heller, mit Passmarken an den vier Ecken.
    const fx = view.x0 * d;
    const fy = view.y0 * d;
    const fs = view.seite * d;
    p.fillStyle = "rgba(170, 210, 255, 0.035)";
    p.fillRect(fx, fy, fs, fs);
    p.strokeStyle = "rgba(200, 228, 255, 0.16)";
    p.lineWidth = 0.8 * d;
    p.strokeRect(fx, fy, fs, fs);
    p.strokeStyle = "rgba(215, 235, 255, 0.6)";
    p.lineWidth = 1.3 * d;
    const m = 9 * d;
    [[0, 0, 1, 1], [1, 0, -1, 1], [1, 1, -1, -1], [0, 1, 1, -1]].forEach(([ex, ey, rx, ry]) => {
      const x = fx + ex * fs;
      const y = fy + ey * fs;
      p.beginPath();
      p.moveTo(x - rx * m * 0.6, y);
      p.lineTo(x + rx * m, y);
      p.moveTo(x, y - ry * m * 0.6);
      p.lineTo(x, y + ry * m);
      p.stroke();
    });
    papierAlt = c;
    return c;
  }

  // ---------------------------------------------------------------------------
  // Die Zeichen
  // ---------------------------------------------------------------------------
  const WEISS = "#f1f7ff";
  const WEISS_GLANZ = "rgba(140, 195, 255, 0.2)";
  const GRUEN = "#5ef2b0";
  const GRUEN_GLANZ = "rgba(94, 242, 176, 0.2)";
  const GELB = "#ffd84d";
  const ZIELWAND = "#ffe08a";
  const ZIELWAND_GLANZ = "rgba(255, 216, 77, 0.2)";
  const FARBE = { genau: "#ffd84d", fast: "#5ef2b0", knapp: "#b9f06c", nah: "#ffb84d", weit: "#ff8a5c", daneben: "#ff6480" };
  const MONO = 'ui-monospace, "SF Mono", Menlo, Consolas, monospace';
  const SERIF = 'Georgia, "Times New Roman", serif';

  function strichelung(stil) {
    const s = view.s;
    if (stil === "strich") g.setLineDash([s * 1.7, s * 1.3]);
    else if (stil === "achse") g.setLineDash([s * 3.2, s * 1.1, s * 0.5, s * 1.1]);
    // Gepunktet: die Spur eines Balls. Die runden Enden machen aus jedem
    // Strichlein einen Punkt.
    else if (stil === "punkt") g.setLineDash([0.01, s * 2]);
    else g.setLineDash([]);
  }

  // Ein Zeichen der Zeichnung, zu k (0 … 1) gezeichnet – so entsteht jedes
  // Blatt Strich für Strich, wie von einem Plotter. `fein`: der Durchgang
  // mit der scharfen Linie; davor kommt einer mit dem breiten Schein.
  function zeichneTeil(t, k, farbe, fein) {
    if (k <= 0) return;
    const s = view.s;
    const breite = fein ? view.lw : view.lw * 3.4;
    g.lineWidth = t.stil === "duenn" ? breite * 0.6 : breite;
    strichelung(t.stil);
    switch (t.t) {
      case "s":
      case "pfeil": {
        const ex = lerp(t.a.x, t.b.x, k);
        const ey = lerp(t.a.y, t.b.y, k);
        g.beginPath();
        g.moveTo(X(t.a.x), Y(t.a.y));
        g.lineTo(X(ex), Y(ey));
        g.stroke();
        if (t.t === "pfeil" && k > 0.7) {
          const e = einheit(t.a, t.b);
          const lang = 3.2 * s * clamp((k - 0.7) / 0.3, 0, 1);
          g.beginPath();
          g.moveTo(X(ex) - (e.x * 1 - e.y * 0.42) * lang, Y(ey) - (e.y * 1 + e.x * 0.42) * lang);
          g.lineTo(X(ex), Y(ey));
          g.lineTo(X(ex) - (e.x * 1 + e.y * 0.42) * lang, Y(ey) - (e.y * 1 - e.x * 0.42) * lang);
          g.stroke();
        }
        break;
      }
      case "k":
      case "kpfeil": {
        // Ein Bogen – in die Richtung, in die seine Winkel laufen. Als
        // «kpfeil» mit einer Spitze am Ende.
        const bis = lerp(t.von, t.bis, k);
        g.beginPath();
        g.arc(X(t.m.x), Y(t.m.y), t.r * s, t.von, bis, t.bis < t.von);
        g.stroke();
        if (t.t === "kpfeil" && k > 0.7) {
          const sinn = t.bis < t.von ? -1 : 1;
          const e = P(-Math.sin(bis) * sinn, Math.cos(bis) * sinn);
          const ex = X(t.m.x + Math.cos(bis) * t.r);
          const ey = Y(t.m.y + Math.sin(bis) * t.r);
          const lang = Math.min(3.2, t.r * 0.42) * s * clamp((k - 0.7) / 0.3, 0, 1);
          g.beginPath();
          g.moveTo(ex - (e.x - e.y * 0.42) * lang, ey - (e.y + e.x * 0.42) * lang);
          g.lineTo(ex, ey);
          g.lineTo(ex - (e.x + e.y * 0.42) * lang, ey - (e.y - e.x * 0.42) * lang);
          g.stroke();
        }
        break;
      }
      case "poly": {
        const pkte = t.zu ? [...t.pkte, t.pkte[0]] : t.pkte;
        const weit = k * (pkte.length - 1);
        g.beginPath();
        g.moveTo(X(pkte[0].x), Y(pkte[0].y));
        for (let i = 1; i < pkte.length; i += 1) {
          const teil = clamp(weit - (i - 1), 0, 1);
          if (teil <= 0) break;
          g.lineTo(X(lerp(pkte[i - 1].x, pkte[i].x, teil)), Y(lerp(pkte[i - 1].y, pkte[i].y, teil)));
        }
        g.stroke();
        break;
      }
      case "tick": {
        const n = richt(t.w + Math.PI / 2);
        g.beginPath();
        g.moveTo(X(t.p.x - n.x * t.l * k), Y(t.p.y - n.y * t.l * k));
        g.lineTo(X(t.p.x + n.x * t.l * k), Y(t.p.y + n.y * t.l * k));
        g.stroke();
        break;
      }
      case "gleich": {
        // Zwei kurze Striche quer über die Mitte: «gleich lang».
        const e = einheit(t.a, t.b);
        const mitte = zwischen(t.a, t.b);
        g.lineWidth = breite * 0.7;
        [-0.55, 0.55].forEach((ab) => {
          const q = plus(mitte, e, ab);
          g.beginPath();
          g.moveTo(X(q.x + e.y * 1.5 * k), Y(q.y - e.x * 1.5 * k));
          g.lineTo(X(q.x - e.y * 1.5 * k), Y(q.y + e.x * 1.5 * k));
          g.stroke();
        });
        break;
      }
      case "eck": {
        // Der rechte Winkel: ein kleines Quadrat in der Ecke.
        const e1 = einheit(t.p, t.zu1);
        const e2 = einheit(t.p, t.zu2);
        const l = 3 * k;
        g.lineWidth = breite * 0.7;
        g.beginPath();
        g.moveTo(X(t.p.x + e1.x * l), Y(t.p.y + e1.y * l));
        g.lineTo(X(t.p.x + (e1.x + e2.x) * l), Y(t.p.y + (e1.y + e2.y) * l));
        g.lineTo(X(t.p.x + e2.x * l), Y(t.p.y + e2.y * l));
        g.stroke();
        break;
      }
      case "winkel": {
        // Ein kleiner Bogen zwischen zwei Richtungen – für «gleicher Winkel».
        const w1 = Math.atan2(t.zu1.y - t.p.y, t.zu1.x - t.p.x);
        let w2 = Math.atan2(t.zu2.y - t.p.y, t.zu2.x - t.p.x);
        while (w2 - w1 > Math.PI) w2 -= TAU;
        while (w2 - w1 < -Math.PI) w2 += TAU;
        g.lineWidth = breite * 0.7;
        g.beginPath();
        g.arc(X(t.p.x), Y(t.p.y), 6.5 * s, w1, lerp(w1, w2, k), w2 < w1);
        g.stroke();
        break;
      }
      case "wand": {
        // Eine Wand: ein kräftiger Strich, dahinter die Schraffur. Die Wand,
        // auf der die Antwort liegt, ist gelb wie das Fadenkreuz.
        if (t.ziel) g.strokeStyle = fein ? ZIELWAND : ZIELWAND_GLANZ;
        g.lineWidth = breite * 1.5;
        const ex = lerp(t.a.x, t.b.x, k);
        const ey = lerp(t.a.y, t.b.y, k);
        g.beginPath();
        g.moveTo(X(t.a.x), Y(t.a.y));
        g.lineTo(X(ex), Y(ey));
        g.stroke();
        if (!fein) { g.strokeStyle = farbe; break; }
        const e = einheit(t.a, t.b);
        let n = P(-e.y, e.x);
        // Die Schraffur liegt auf der Seite, die von der Figur wegzeigt.
        if ((t.von.x - t.a.x) * n.x + (t.von.y - t.a.y) * n.y > 0) n = P(-n.x, -n.y);
        const lang = abstand(t.a, t.b) * k;
        g.lineWidth = breite * 0.55;
        g.beginPath();
        for (let weg = 1.2; weg < lang; weg += 3) {
          const q = plus(t.a, e, weg);
          g.moveTo(X(q.x), Y(q.y));
          g.lineTo(X(q.x + n.x * 2.6 - e.x * 1.8), Y(q.y + n.y * 2.6 - e.y * 1.8));
        }
        g.stroke();
        g.strokeStyle = farbe;
        break;
      }
      case "flaeche": {
        // Eine Fläche, zart gefüllt.
        if (!fein) break;
        g.save();
        g.globalAlpha *= 0.2 * k;
        g.fillStyle = farbe;
        g.beginPath();
        t.pkte.forEach((q, i) => (i ? g.lineTo(X(q.x), Y(q.y)) : g.moveTo(X(q.x), Y(q.y))));
        g.closePath();
        g.fill();
        g.restore();
        break;
      }
      case "loch": {
        // Das Loch, in das die Kugel soll: dunkel, mit hellem Rand.
        const r = 3.1 * s * clamp(k * 2, 0, 1);
        g.setLineDash([]);
        g.beginPath();
        g.arc(X(t.p.x), Y(t.p.y), r, 0, TAU);
        if (fein) { g.fillStyle = "#061a3d"; g.fill(); }
        g.stroke();
        break;
      }
      case "rad": {
        // Beim Nachmessen rollt es los (zeichneLoesung).
        if (fein && !state.wertung) zeichneRad(t.m, t.r, Math.atan2(t.zu.y - t.m.y, t.zu.x - t.m.x), clamp(k * 1.6, 0, 1));
        break;
      }
      case "p": {
        if (!fein) break;
        const r = (t.gross ? 1.7 : 1.15) * s * clamp(k * 2, 0, 1);
        g.fillStyle = farbe;
        g.beginPath();
        g.arc(X(t.p.x), Y(t.p.y), r, 0, TAU);
        g.fill();
        if (t.name) schrift(t.name, t.p, t.weg, k, farbe);
        break;
      }
      case "text": {
        if (fein) schrift(t.text, t.p, t.weg, k, farbe);
        break;
      }
      case "kugel": {
        // Beim Nachmessen rollt sie los (zeichneLoesung).
        if (fein && !state.wertung) zeichneKugel(t.p, clamp(k * 2, 0, 1));
        break;
      }
      default:
    }
  }

  // Ein Name neben einem Punkt: kursiv wie im Geometrieheft.
  function schrift(text, p, weg, k, farbe) {
    if (k < 0.5) return;
    const l = Math.hypot(weg?.x || 0, weg?.y || 0);
    // Ohne Richtung: schräg nach oben. Mit einer Richtung der Länge null:
    // genau auf dem Punkt.
    const e = l ? P(weg.x / l, weg.y / l) : weg ? P(0, 0) : P(0.7, -0.7);
    g.save();
    g.globalAlpha *= clamp((k - 0.5) * 2, 0, 1);
    g.fillStyle = farbe;
    g.font = `italic 700 ${Math.round(clamp(view.s * 4.6, 13, 22))}px ${SERIF}`;
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText(text, X(p.x + e.x * 4.2), Y(p.y + e.y * 4.2));
    g.restore();
  }

  // Die Kugel: hell, mit einem Glanzlicht.
  function zeichneKugel(p, k = 1, farbe = "#e8f1ff") {
    const r = 2.3 * view.s * k;
    if (r <= 0.2) return;
    const x = X(p.x);
    const y = Y(p.y);
    g.save();
    g.setLineDash([]);
    g.fillStyle = "rgba(160, 205, 255, 0.16)";
    g.beginPath();
    g.arc(x, y, r * 1.9, 0, TAU);
    g.fill();
    const lack = g.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r);
    lack.addColorStop(0, "#ffffff");
    lack.addColorStop(0.5, farbe);
    lack.addColorStop(1, "#7f9cc9");
    g.fillStyle = lack;
    g.beginPath();
    g.arc(x, y, r, 0, TAU);
    g.fill();
    g.restore();
  }

  // Das Rad: Felge, Nabe, sechs Speichen – und ein Ventil, an dem man sieht,
  // wie weit es sich gedreht hat.
  function zeichneRad(m, r, winkel, k = 1) {
    const s = view.s;
    const x = X(m.x);
    const y = Y(m.y);
    g.save();
    g.globalAlpha *= k;
    g.setLineDash([]);
    g.lineCap = "round";
    [[WEISS_GLANZ, view.lw * 3.4], [WEISS, view.lw]].forEach(([farbe, breite]) => {
      g.strokeStyle = farbe;
      g.lineWidth = breite;
      g.beginPath();
      g.arc(x, y, r * s, 0, TAU);
      g.stroke();
    });
    g.strokeStyle = "rgba(241, 247, 255, 0.55)";
    g.lineWidth = view.lw * 0.6;
    g.beginPath();
    for (let i = 1; i < 6; i += 1) {
      const w = winkel + (i * TAU) / 6;
      g.moveTo(x, y);
      g.lineTo(x + Math.cos(w) * r * s, y + Math.sin(w) * r * s);
    }
    g.stroke();
    g.strokeStyle = "#ff9d6c";
    g.lineWidth = view.lw * 1.1;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + Math.cos(winkel) * r * s, y + Math.sin(winkel) * r * s);
    g.stroke();
    g.fillStyle = "#ff9d6c";
    g.beginPath();
    g.arc(x + Math.cos(winkel) * r * s * 0.86, y + Math.sin(winkel) * r * s * 0.86, Math.max(2, 0.8 * s), 0, TAU);
    g.fill();
    g.fillStyle = WEISS;
    g.beginPath();
    g.arc(x, y, Math.max(2, 0.9 * s), 0, TAU);
    g.fill();
    g.restore();
  }

  // Wo eine Kugel auf ihrem Weg ist, wenn sie den Anteil k davon hinter sich hat.
  function aufWeg(pkte, k) {
    let ganz = 0;
    for (let i = 1; i < pkte.length; i += 1) ganz += abstand(pkte[i - 1], pkte[i]);
    let weit = k * ganz;
    for (let i = 1; i < pkte.length; i += 1) {
      const stueck = abstand(pkte[i - 1], pkte[i]);
      if (weit <= stueck || i === pkte.length - 1) return zwischen(pkte[i - 1], pkte[i], stueck ? clamp(weit / stueck, 0, 1) : 0);
      weit -= stueck;
    }
    return pkte[pkte.length - 1];
  }

  // Eine Liste von Zeichen, nacheinander eingezeichnet: K ist der Fortschritt
  // des Ganzen, jedes Zeichen hat darin sein Fenster.
  function zeichneTeile(teile, K, farbe, glanz) {
    const n = teile.length;
    if (!n) return;
    const anteil = (i) => clamp((K - i / (n + 1.2)) / (2.2 / (n + 1.2)), 0, 1);
    g.lineCap = "round";
    g.lineJoin = "round";
    g.strokeStyle = glanz;
    teile.forEach((t, i) => zeichneTeil(t, anteil(i), glanz, false));
    g.strokeStyle = farbe;
    teile.forEach((t, i) => zeichneTeil(t, anteil(i), farbe, true));
    g.setLineDash([]);
    // Die Spitze des Stifts: ein heller Punkt dort, wo gerade gezeichnet wird.
    if (K > 0 && K < 1) {
      const i = teile.findIndex((t, nr) => anteil(nr) > 0 && anteil(nr) < 1 && stiftOrt(t, anteil(nr)));
      const ort = i >= 0 ? stiftOrt(teile[i], anteil(i)) : null;
      if (ort) {
        g.save();
        g.globalCompositeOperation = "lighter";
        const r = 9 * view.u;
        const schein = g.createRadialGradient(X(ort.x), Y(ort.y), 0, X(ort.x), Y(ort.y), r);
        schein.addColorStop(0, "rgba(255, 255, 255, 0.95)");
        schein.addColorStop(0.25, glanz);
        schein.addColorStop(1, "rgba(255, 255, 255, 0)");
        g.fillStyle = schein;
        g.beginPath();
        g.arc(X(ort.x), Y(ort.y), r, 0, TAU);
        g.fill();
        g.restore();
      }
    }
  }

  // Wo der Stift bei einem Zeichen gerade ist.
  function stiftOrt(t, k) {
    if (t.t === "s" || t.t === "pfeil" || t.t === "wand") return zwischen(t.a, t.b, k);
    if (t.t === "k" || t.t === "kpfeil") return plus(t.m, richt(lerp(t.von, t.bis, k)), t.r);
    if (t.t === "poly") {
      const pkte = t.zu ? [...t.pkte, t.pkte[0]] : t.pkte;
      const weit = k * (pkte.length - 1);
      const i = Math.min(pkte.length - 2, Math.floor(weit));
      return zwischen(pkte[i], pkte[i + 1], weit - i);
    }
    return null;
  }

  // ---------------------------------------------------------------------------
  // Der Tunnel
  // ---------------------------------------------------------------------------
  // Die Schiene, die Kugel darauf, darüber der Tunnel mit seiner Schraffur
  // und der Pfeil. Beim Nachmessen wird der Tunnel durchsichtig. Im Beispiel
  // der Vorschau sagt `bsp`, wo die Kugel ist – dort gibt es keine Antwort.
  function zeichneTunnel(a, K, zeigt, tz, bsp = null) {
    const s = view.s;
    const e = einheit(a.a, a.b);
    const n = P(-e.y, e.x);
    const hoch = abstand(a.kasten[0], a.kasten[3]) / 2;
    const ort = (weg, quer) => P(a.a.x + e.x * weg + n.x * quer, a.a.y + e.y * weg + n.y * quer);
    g.lineCap = "round";
    g.lineJoin = "round";
    g.setLineDash([]);
    // Die Schiene mit ihren beiden Prellböcken.
    [[WEISS_GLANZ, view.lw * 3.4], [WEISS, view.lw]].forEach(([farbe, breite]) => {
      g.strokeStyle = farbe;
      g.lineWidth = breite;
      const bis = ort(a.lang * K, 2.6);
      g.beginPath();
      g.moveTo(X(ort(0, 2.6).x), Y(ort(0, 2.6).y));
      g.lineTo(X(bis.x), Y(bis.y));
      [0, K >= 1 ? a.lang : -1].forEach((weg) => {
        if (weg < 0) return;
        g.moveTo(X(ort(weg, 2.6).x), Y(ort(weg, 2.6).y));
        g.lineTo(X(ort(weg, -1.2).x), Y(ort(weg, -1.2).y));
      });
      g.stroke();
    });
    // Die Kugel: unterwegs nach der Uhr, beim Nachmessen dort, wo sie beim
    // Tipp war.
    let kugel = bsp ? bsp.kugel : null;
    if (!bsp) kugel = zeigt ? state.antwort || tunnelOrt(a, a.lang) : tunnelOrt(a, kugelWeg(a, tunnelZeit()));
    if (kugel && K > 0.3) zeichneKugel(kugel, clamp((K - 0.3) * 3, 0, 1), zeigt && (bsp || state.antwort) ? GELB : "#e8f1ff");
    // Der Tunnel.
    const decke = zeigt ? lerp(1, 0.22, clamp(tz / 0.35, 0, 1)) : 1;
    const auf = clamp((K - 0.25) / 0.6, 0, 1);
    if (auf > 0) {
      const ende = lerp(a.s1, a.lang, auf);
      const ecken = [ort(a.s1, -hoch), ort(ende, -hoch), ort(ende, hoch), ort(a.s1, hoch)];
      g.beginPath();
      ecken.forEach((q, i) => (i ? g.lineTo(X(q.x), Y(q.y)) : g.moveTo(X(q.x), Y(q.y))));
      g.closePath();
      g.globalAlpha = decke;
      g.fillStyle = "#0f3a7c";
      g.fill();
      g.globalAlpha = 1;
      // Die Schraffur: schräge Striche, jeder an den Kanten des Tunnels gekappt.
      g.strokeStyle = "rgba(205, 228, 255, 0.34)";
      g.lineWidth = view.lw * 0.55;
      g.beginPath();
      for (let weg = a.s1 - 2 * hoch + 1.5; weg < ende; weg += 3.2) {
        const von = Math.max(weg, a.s1);
        const bis = Math.min(weg + 2 * hoch, ende);
        if (bis <= von) continue;
        const p1 = ort(von, hoch - (von - weg));
        const p2 = ort(bis, hoch - (bis - weg));
        g.moveTo(X(p1.x), Y(p1.y));
        g.lineTo(X(p2.x), Y(p2.y));
      }
      g.stroke();
      [[WEISS_GLANZ, view.lw * 3.4], [WEISS, view.lw]].forEach(([farbe, breite]) => {
        g.strokeStyle = farbe;
        g.lineWidth = breite;
        g.beginPath();
        ecken.forEach((q, i) => (i ? g.lineTo(X(q.x), Y(q.y)) : g.moveTo(X(q.x), Y(q.y))));
        g.closePath();
        g.stroke();
      });
    }
    // Der Pfeil und sein Strich quer durch den Tunnel.
    const marke = clamp((K - 0.6) / 0.4, 0, 1);
    if (marke > 0) {
      g.globalAlpha = marke;
      g.strokeStyle = GRUEN;
      g.lineWidth = view.lw * 0.8;
      g.setLineDash([s * 1.2, s * 1.1]);
      g.beginPath();
      g.moveTo(X(ort(a.sm, -hoch).x), Y(ort(a.sm, -hoch).y));
      g.lineTo(X(ort(a.sm, hoch).x), Y(ort(a.sm, hoch).y));
      g.stroke();
      g.setLineDash([]);
      g.lineWidth = view.lw * 1.2;
      const ep = einheit(a.fuss, a.spitze);
      const lang = 3.4 * s;
      g.beginPath();
      g.moveTo(X(a.fuss.x), Y(a.fuss.y));
      g.lineTo(X(a.spitze.x), Y(a.spitze.y));
      g.moveTo(X(a.spitze.x) - (ep.x - ep.y * 0.5) * lang, Y(a.spitze.y) - (ep.y + ep.x * 0.5) * lang);
      g.lineTo(X(a.spitze.x), Y(a.spitze.y));
      g.lineTo(X(a.spitze.x) - (ep.x + ep.y * 0.5) * lang, Y(a.spitze.y) - (ep.y - ep.x * 0.5) * lang);
      g.stroke();
      g.globalAlpha = 1;
    }
  }

  // ---------------------------------------------------------------------------
  // Das Fadenkreuz und sein Griff
  // ---------------------------------------------------------------------------
  function zeichneZeiger(a) {
    const z = state.zeiger;
    if (!z) return;
    const x = X(z.x);
    const y = Y(z.y);
    g.save();
    g.setLineDash([]);
    g.lineCap = "butt";
    if (a.schnitt) {
      // Beim Halbieren der Fläche: der Schnitt, wie er jetzt läge – parallel
      // zur Grundseite durchs Fadenkreuz.
      const d = a.schnitt;
      const teil = clamp(abstand(d.c, z) / (abstand(d.c, zwischen(d.a, d.b)) || 1), 0, 1);
      const p1 = zwischen(d.c, d.a, teil);
      const p2 = zwischen(d.c, d.b, teil);
      [["rgba(4, 16, 48, 0.55)", 4.5], [GELB, 2]].forEach(([farbe, breite]) => {
        g.strokeStyle = farbe;
        g.lineWidth = breite;
        g.beginPath();
        g.moveTo(X(p1.x), Y(p1.y));
        g.lineTo(X(p2.x), Y(p2.y));
        g.stroke();
      });
    } else if (a.bahn) {
      // Auf einer Bahn: ein Reiter quer zu ihr.
      const quer = a.bahn.r ? einheit(a.bahn.m, z) : (() => { const e = einheit(a.bahn.a, a.bahn.b); return P(-e.y, e.x); })();
      const lang = 15 * view.u;
      [["rgba(4, 16, 48, 0.55)", 4.5], [GELB, 2]].forEach(([farbe, breite]) => {
        g.strokeStyle = farbe;
        g.lineWidth = breite;
        g.beginPath();
        g.moveTo(x - quer.x * lang, y - quer.y * lang);
        g.lineTo(x + quer.x * lang, y + quer.y * lang);
        g.stroke();
      });
    } else {
      // Frei auf dem Blatt: zwei Haarlinien über das ganze Feld, in der
      // Mitte vier kräftige Striche mit einer Lücke – der Punkt bleibt frei.
      g.strokeStyle = "rgba(255, 216, 77, 0.2)";
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(view.x0, y);
      g.lineTo(view.x0 + view.seite, y);
      g.moveTo(x, view.y0);
      g.lineTo(x, view.y0 + view.seite);
      g.stroke();
      const innen = 4.5 * view.u;
      const aussen = 17 * view.u;
      [["rgba(4, 16, 48, 0.55)", 4.5], [GELB, 2]].forEach(([farbe, breite]) => {
        g.strokeStyle = farbe;
        g.lineWidth = breite;
        g.beginPath();
        [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy]) => {
          g.moveTo(x + dx * innen, y + dy * innen);
          g.lineTo(x + dx * aussen, y + dy * aussen);
        });
        g.stroke();
      });
    }
    g.strokeStyle = GELB;
    g.lineWidth = 1.5;
    g.beginPath();
    g.arc(x, y, 9.5 * view.u, 0, TAU);
    g.stroke();
    g.fillStyle = GELB;
    g.beginPath();
    g.arc(x, y, 1.1, 0, TAU);
    g.fill();
    g.restore();
  }

  /*
   * Der Griff: ein Ring unter dem Finger und ein Stiel hinauf zum
   * Fadenkreuz. So sieht man, dass es am Finger hängt, auch wenn es nicht
   * dort steht. Vom Ring bleibt um die Fingerkuppe ein Rand zu sehen.
   */
  function zeichneGriffBei(px, py, stark = 1) {
    const z = state.zeiger;
    if (!z) return;
    const zx = X(z.x);
    const zy = Y(z.y);
    const weit = Math.hypot(px - zx, py - zy);
    const frei = 20 * view.u;
    g.save();
    g.lineCap = "round";
    if (weit > GRIFF_R + frei + 6) {
      const ex = (px - zx) / weit;
      const ey = (py - zy) / weit;
      [["rgba(4, 16, 48, 0.55)", 5, []], [GELB, 2.2, [2, 6]]].forEach(([farbe, breite, strich]) => {
        g.strokeStyle = farbe;
        g.lineWidth = breite;
        g.setLineDash(strich);
        g.globalAlpha = stark * (strich.length ? 0.95 : 0.8);
        g.beginPath();
        g.moveTo(zx + ex * frei, zy + ey * frei);
        g.lineTo(px - ex * GRIFF_R, py - ey * GRIFF_R);
        g.stroke();
      });
    }
    g.setLineDash([]);
    g.globalAlpha = stark;
    g.fillStyle = "rgba(255, 216, 77, 0.14)";
    g.beginPath();
    g.arc(px, py, GRIFF_R, 0, TAU);
    g.fill();
    [["rgba(4, 16, 48, 0.5)", 5], [GELB, 2.2]].forEach(([farbe, breite]) => {
      g.strokeStyle = farbe;
      g.lineWidth = breite;
      g.beginPath();
      g.arc(px, py, GRIFF_R, 0, TAU);
      g.stroke();
    });
    g.restore();
  }

  // Der Griff unter dem Finger – oder, nach einem blossen Antippen, dort, wo
  // er liegen blieb: mit dem Hinweis, was zu tun ist.
  function zeichneGriff() {
    const griff = state.griff;
    if (griff?.versetzt) { zeichneGriffBei(griff.px, griff.py); return; }
    const wink = state.wink;
    if (!wink || !state.zeiger || state.phase !== "aufgabe") return;
    const t = performance.now() - wink.seit;
    const puls = ruhig() ? 0 : 0.5 + 0.5 * Math.sin(t / 170);
    zeichneGriffBei(wink.px, wink.py, 0.6 + 0.4 * puls);
    if (t > WINK_MS) return;
    const u = view.u;
    const da = clamp(t / 140, 0, 1) * clamp((WINK_MS - t) / 400, 0, 1);
    const gross = Math.round(clamp(14 * u, 12.5, 16));
    g.save();
    g.setLineDash([]);
    g.font = `800 ${gross}px system-ui, sans-serif`;
    g.textAlign = "center";
    g.textBaseline = "middle";
    const text = "Halten und ziehen";
    const breit = g.measureText(text).width + gross * 1.8;
    const hoch = Math.round(gross * 2);
    const x = clamp(wink.px, breit / 2 + 6, view.cssW - breit / 2 - 6);
    // Unter dem Griff, wo der Finger war – ist dort kein Platz, über dem Fadenkreuz.
    let y = wink.py + GRIFF_R + 10 + hoch / 2;
    if (y + hoch / 2 > view.cssH - 6) y = Y(state.zeiger.y) - 30 * u - hoch / 2;
    g.globalAlpha = da;
    rundesFeld(x - breit / 2, y - hoch / 2, breit, hoch, hoch / 2);
    g.fillStyle = "rgba(4, 16, 48, 0.88)";
    g.fill();
    g.strokeStyle = GELB;
    g.lineWidth = 1.2;
    g.stroke();
    g.fillStyle = "#ffffff";
    g.fillText(text, x, y + 1);
    g.restore();
  }

  // ---------------------------------------------------------------------------
  // Das Nachmessen
  // ---------------------------------------------------------------------------
  // Der Massstab legt sich an die Strecke: Millimeter für Millimeter, jeder
  // fünfte Strich länger, jeder zehnte mit Zahl.
  function zeichneLineal(lineal, k) {
    if (k <= 0) return;
    const s = view.s;
    const e = einheit(lineal.a, lineal.b);
    let n = P(-e.y, e.x);
    // Er liegt auf der Seite der Strecke, auf der mehr Blatt ist.
    // Oder dort, wo die Aufgabe ihn haben will (zu).
    const mitte = zwischen(lineal.a, lineal.b);
    const hin = lineal.zu || P(BLATT / 2, BLATT / 2);
    if ((hin.x - mitte.x) * n.x + (hin.y - mitte.y) * n.y < 0) n = P(-n.x, -n.y);
    const lang = abstand(lineal.a, lineal.b);
    const breit = 8.5;
    const ab = 1 + (1 - k) * 5;
    const ort = (weg, quer) => P(lineal.a.x + e.x * weg + n.x * (ab + quer), lineal.a.y + e.y * weg + n.y * (ab + quer));
    g.save();
    g.globalAlpha = k;
    g.setLineDash([]);
    const ecken = [ort(-2, 0), ort(lang + 2, 0), ort(lang + 2, breit), ort(-2, breit)];
    g.beginPath();
    ecken.forEach((q, i) => (i ? g.lineTo(X(q.x), Y(q.y)) : g.moveTo(X(q.x), Y(q.y))));
    g.closePath();
    g.fillStyle = "rgba(255, 232, 150, 0.1)";
    g.fill();
    g.strokeStyle = "rgba(255, 232, 150, 0.5)";
    g.lineWidth = 1;
    g.stroke();
    g.strokeStyle = "rgba(255, 238, 180, 0.75)";
    g.lineWidth = Math.max(0.7, s * 0.14);
    g.beginPath();
    // Unter drei Bildpunkten je Millimeter nur jeder zweite Strich.
    const schritt = s < 3 ? 2 : 1;
    for (let mm = 0; mm <= lang + 1e-6; mm += schritt) {
      const hoch = mm % 10 === 0 ? 3.6 : mm % 5 === 0 ? 2.6 : 1.5;
      const p1 = ort(mm, 0);
      const p2 = ort(mm, hoch);
      g.moveTo(X(p1.x), Y(p1.y));
      g.lineTo(X(p2.x), Y(p2.y));
    }
    g.stroke();
    g.fillStyle = "rgba(255, 238, 180, 0.85)";
    g.font = `600 ${Math.round(clamp(s * 2.9, 8, 13))}px ${MONO}`;
    g.textAlign = "center";
    g.textBaseline = "middle";
    for (let mm = 0; mm <= lang + 1e-6; mm += 10) {
      const q = ort(mm, 6);
      g.fillText(String(mm / 10), X(q.x), Y(q.y));
    }
    g.restore();
  }

  // Wo der Stempel steht: rund um die richtige Stelle dort, wo am wenigsten
  // von der Zeichnung liegt – und ganz auf dem Blatt.
  function stempelOrt(a) {
    if (a.stempel) return [X(a.stempel.x), Y(a.stempel.y)];
    const weit = (56 * view.u) / view.s + 3;
    const halb = (58 * view.u) / view.s;
    let bester = null;
    let mass = -Infinity;
    for (let i = 0; i < 12; i += 1) {
      const w = -Math.PI / 2 + (i * TAU) / 12;
      const ort = P(clamp(a.ziel.x + Math.cos(w) * weit * 1.15, halb, BLATT - halb), clamp(a.ziel.y + Math.sin(w) * weit, 9, BLATT - 9));
      // Ein Stempel ist breiter als hoch: quer zählt der Abstand weniger.
      const nah = (q) => Math.hypot((q.x - ort.x) * 0.55, q.y - ort.y);
      let frei = Math.min(nah(a.ziel) * 0.9, state.antwort ? nah(state.antwort) : Infinity);
      a.punkte.forEach((q) => { frei = Math.min(frei, nah(q)); });
      // Oben ist besser als unten: Dort steht kein Finger.
      frei += Math.sin(w) < 0 ? 1.5 : 0;
      if (frei > mass) { mass = frei; bester = ort; }
    }
    a.stempel = bester;
    return [X(bester.x), Y(bester.y)];
  }

  // Der Weg zur Lösung, ohne die eigene Antwort: die Hilfslinien, was rollt,
  // und die richtige Stelle. So steht er beim Nachmessen da – und im
  // Beispiel der Vorschau.
  function zeichneLoesungsweg(a, tz) {
    const s = view.s;
    const K = ruhig() ? 1 : weich(clamp(tz / 0.6, 0, 1));
    if (a.lineal) zeichneLineal(a.lineal, ruhig() ? 1 : weich(clamp(tz / 0.4, 0, 1)));
    zeichneTeile(a.loesung, K, GRUEN, GRUEN_GLANZ);
    // Was rollt, rollt jetzt: die Kugel über die Bande, der Ball durch die
    // Luft, zwei Kugeln aufeinander zu – jede ihren ganzen Weg.
    const rollt = ruhig() ? 1 : clamp((tz - 0.1) / 0.95, 0, 1);
    if (a.rollen) a.rollen.forEach((weg) => zeichneKugel(aufWeg(weg, rollt)));
    if (a.rad) {
      const k = weich(rollt);
      zeichneRad(zwischen(a.rad.m0, a.rad.m1, k), a.rad.r, Math.atan2(a.rad.p0.y - a.rad.m0.y, a.rad.p0.x - a.rad.m0.x) + a.rad.sinn * TAU * k);
    }
    // Die richtige Stelle: ein Ring, der sich zuzieht, und ein Punkt.
    const kz = ruhig() ? 1 : clamp((tz - 0.2) / 0.35, 0, 1);
    if (kz > 0) {
      g.strokeStyle = GRUEN;
      g.lineWidth = 1.6;
      g.globalAlpha = kz;
      g.beginPath();
      g.arc(X(a.ziel.x), Y(a.ziel.y), (2.6 + (1 - kz) * 7) * s, 0, TAU);
      g.stroke();
      g.fillStyle = GRUEN;
      g.beginPath();
      g.arc(X(a.ziel.x), Y(a.ziel.y), Math.max(1.6, 0.6 * s), 0, TAU);
      g.fill();
      g.globalAlpha = 1;
    }
  }

  function zeichneLoesung(a, tz) {
    const w = state.wertung;
    const wie = WIE[w.punkte];
    const farbe = FARBE[wie];
    zeichneLoesungsweg(a, tz);
    // Die eigene Stelle: ein kleines Kreuz – und der Strich zur richtigen.
    const an = state.antwort;
    if (an) {
      const km = ruhig() ? 1 : clamp((tz - 0.3) / 0.3, 0, 1);
      if (km > 0 && w.mm > 0.05) {
        g.strokeStyle = farbe;
        g.lineWidth = 2.2;
        g.beginPath();
        g.moveTo(X(an.x), Y(an.y));
        g.lineTo(X(lerp(an.x, a.ziel.x, km)), Y(lerp(an.y, a.ziel.y, km)));
        g.stroke();
      }
      const arm = 5 * view.u;
      [["rgba(4, 16, 48, 0.6)", 4.5], [GELB, 2]].forEach(([f, breite]) => {
        g.strokeStyle = f;
        g.lineWidth = breite;
        g.beginPath();
        g.moveTo(X(an.x) - arm, Y(an.y) - arm);
        g.lineTo(X(an.x) + arm, Y(an.y) + arm);
        g.moveTo(X(an.x) + arm, Y(an.y) - arm);
        g.lineTo(X(an.x) - arm, Y(an.y) + arm);
        g.stroke();
      });
    }
    // Der Stempel: die Punkte, darunter die Millimeter.
    const ks = ruhig() ? 1 : clamp((tz - 0.4) / 0.2, 0, 1);
    if (ks > 0) {
      const u = view.u;
      const [sx, sy] = stempelOrt(a);
      const gross = 1 + (1 - ks) * (1 - ks) * 0.9;
      g.save();
      g.translate(sx, sy);
      g.rotate(-0.07);
      g.scale(gross, gross);
      g.globalAlpha = ks;
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.lineJoin = "round";
      const text = w.punkte === PUNKTE_JE_BLATT ? "+10" : w.punkte ? `+${w.punkte}` : "0";
      g.font = `900 ${Math.round(34 * u)}px system-ui, sans-serif`;
      g.strokeStyle = "rgba(4, 16, 48, 0.85)";
      g.lineWidth = 6 * u;
      g.strokeText(text, 0, -7 * u);
      g.fillStyle = farbe;
      g.fillText(text, 0, -7 * u);
      const unter = !an ? "Zeit um" : w.punkte === PUNKTE_JE_BLATT ? `Genau! ${w.mm.toFixed(1)} mm` : `${w.mm.toFixed(1)} mm daneben`;
      g.font = `800 ${Math.round(13 * u)}px system-ui, sans-serif`;
      g.lineWidth = 4 * u;
      g.strokeText(unter, 0, 17 * u);
      g.fillStyle = "#f1f7ff";
      g.fillText(unter, 0, 17 * u);
      g.restore();
    }
  }

  // ---------------------------------------------------------------------------
  // Das Blatt
  // ---------------------------------------------------------------------------
  function zeichneBlatt() {
    const a = blatt();
    if (!a) return;
    const zeigt = Boolean(state.wertung);
    const t = seit();
    const tz = (performance.now() - state.tZeig) / 1000;
    const K = ruhig() || zeigt ? 1 : weich(clamp(t / EINZUG, 0, 1));
    // Was über das Blatt hinausginge (der ganze Kreis zu einem Bogen), endet
    // an seinem Rand.
    g.save();
    g.beginPath();
    g.rect(view.x0, view.y0, view.seite, view.seite);
    g.clip();
    if (a.art === "tunnel") zeichneTunnel(a, K, zeigt, tz);
    else zeichneTeile(a.figur, K, WEISS, WEISS_GLANZ);
    if (zeigt) zeichneLoesung(a, tz);
    g.restore();
    if (!zeigt) { zeichneZeiger(a); zeichneGriff(); }
  }

  // ---------------------------------------------------------------------------
  // Die Vorschau
  // ---------------------------------------------------------------------------
  // Ob gerade die Vorschau eines Blattes dasteht – beim Spielen oder bei
  // dem, dem zugeschaut wird.
  const inVorschau = () => state.phase === "vorschau" || (state.phase === "zuschauen" && zuschau.vor);

  /*
   * Das Beispiel: eine zweite Aufgabe derselben Art, klein in einem Kasten,
   * und sie löst sich selbst – erst steht die Figur da, dann zeichnen sich
   * die Hilfslinien ein, was rollt, rollt, und die richtige Stelle leuchtet
   * auf. Danach von vorn. Gemalt wird mit denselben Handgriffen wie das
   * Blatt, nur verkleinert in den Kasten gelegt.
   */
  function zeichneBeispiel(b, x, y, kante, t) {
    if (!b) return;
    const k = kante / view.seite;
    g.save();
    rundesFeld(x, y, kante, kante, 10 * view.u);
    g.clip();
    g.translate(x, y);
    g.scale(k, k);
    g.translate(-view.x0, -view.y0);
    if (b.art === "tunnel") {
      // Die Kugel rollt hinein; ist sie beim Pfeil, wird der Tunnel
      // durchsichtig – dort war der Tipp fällig.
      const bis = b.start + b.sm / b.v;
      const tt = ruhig() ? bis + 1 : t % (bis + 1.9);
      const zeigt = tt >= bis;
      zeichneTunnel(b, 1, zeigt, tt - bis, { kugel: tunnelOrt(b, kugelWeg(b, Math.min(tt, bis))) });
      if (zeigt) zeichneLoesungsweg(b, tt - bis);
    } else {
      const tt = ruhig() ? 9 : t % 3.8;
      zeichneTeile(b.figur, 1, WEISS, WEISS_GLANZ);
      if (tt >= 0.9) zeichneLoesungsweg(b, tt - 0.9);
    }
    g.restore();
  }

  // Die Vorschau füllt das Blatt: oben das Beispiel, darunter der Satz, was
  // zu tun ist, ganz unten der Ruf zum Tippen.
  function zeichneVorschau() {
    const a = blatt();
    if (!a) return;
    const u = view.u;
    const S = view.seite;
    const x0 = view.x0;
    const y0 = view.y0;
    const t = (performance.now() - state.vorSeit) / 1000;
    const da = ruhig() ? 1 : weich(clamp(t / 0.3, 0, 1));
    const mitte = x0 + S / 2;
    g.save();
    g.setLineDash([]);
    g.textBaseline = "middle";
    // Der Ruf unten: ein Feld, das atmet. In den letzten Sekunden zählt es.
    const rest = VORSCHAU - t;
    const zaehlt = state.phase === "vorschau" && rest <= VOR_ZAEHLT;
    const ruf = zaehlt ? `Los geht's in ${Math.max(1, Math.ceil(rest))} …` : "Tippe, wenn du bereit bist";
    const rufGross = Math.round(clamp(S * 0.043, 13, 18));
    const rufHoch = Math.round(rufGross * 2.1);
    const rufY = y0 + S - rufHoch - Math.round(8 * u);
    // Der Satz: so gross, wie zwischen Beispiel und Ruf Platz ist. Auf einem
    // flachen Bild (Handy quer) steht er links neben dem Blatt, unter dem
    // Namen der Aufgabe – und das Beispiel bekommt das Blatt für sich.
    const flach = Boolean(view.flach);
    const kante = Math.round(S * (flach ? 0.72 : 0.56));
    const kx = Math.round(mitte - kante / 2);
    const ky = y0 + Math.round(S * 0.045);
    const satz = TUN[a.art] || a.frage;
    const oben = flach ? y0 + S * 0.42 + Math.round(26 * u) : ky + kante + Math.round(10 * u);
    const unten = flach ? y0 + S : rufY;
    const satzBreit = flach ? x0 - Math.round(44 * u) : S - Math.round(26 * u);
    const satzX = flach ? x0 / 2 : mitte;
    let gross = Math.round(flach ? clamp(15 * u, 12, 16) : clamp(S * 0.043, 12.5, 19));
    let zeilen = [];
    for (; gross >= 10; gross -= 1) {
      g.font = `700 ${gross}px system-ui, sans-serif`;
      zeilen = umbrechen(satz, satzBreit);
      if (zeilen.length * gross * 1.28 <= unten - oben - 6 * u) break;
    }
    // Der Kasten des Beispiels.
    g.globalAlpha = da;
    rundesFeld(kx, ky, kante, kante, 10 * u);
    g.fillStyle = "rgba(4, 16, 48, 0.3)";
    g.fill();
    g.strokeStyle = "rgba(200, 225, 255, 0.4)";
    g.lineWidth = 1.2;
    g.stroke();
    zeichneBeispiel(a.beispiel, kx, ky, kante, t);
    g.globalAlpha = 0.75 * da;
    g.fillStyle = "#cfe3ff";
    g.textAlign = "left";
    g.font = `700 ${Math.round(10 * u)}px ${MONO}`;
    g.fillText("BEISPIEL", kx + 10 * u, ky + 13 * u);
    // Der Satz.
    g.globalAlpha = da;
    g.fillStyle = "#ffffff";
    g.textAlign = "center";
    g.font = `700 ${gross}px system-ui, sans-serif`;
    // Unter dem Beispiel in der Mitte des freien Platzes, links neben dem
    // Blatt gleich unter dem Namen.
    const satzMitte = flach ? oben + (zeilen.length * gross * 1.28) / 2 : (oben + rufY) / 2;
    zeilen.forEach((zeile, i) => g.fillText(zeile, satzX, satzMitte + (i - (zeilen.length - 1) / 2) * gross * 1.28));
    // Der Ruf – nur für den, der spielt.
    if (state.phase === "vorschau") {
      g.font = `800 ${rufGross}px system-ui, sans-serif`;
      const breit = g.measureText(ruf).width + rufGross * 2.2;
      const puls = ruhig() ? 0 : 0.5 + 0.5 * Math.sin(t * 3.4);
      rundesFeld(mitte - breit / 2, rufY, breit, rufHoch, rufHoch / 2);
      g.fillStyle = zaehlt ? "rgba(255, 184, 77, 0.95)" : `rgba(94, 242, 176, ${0.82 + 0.16 * puls})`;
      g.fill();
      g.fillStyle = "#04162e";
      g.fillText(ruf, mitte, rufY + rufHoch / 2 + 1);
    }
    g.restore();
  }

  // Vor dem ersten Tipp: ein Kreis mit Fadenkreuz, das langsam ins Ziel
  // findet – das ganze Spiel in einem Bild.
  function zeichneTitel() {
    const zeit = performance.now() / 1000;
    const m = P(50, 46);
    const K = ruhig() ? 1 : weich(clamp((zeit - titelSeit) / 1.1, 0, 1));
    zeichneTeile([
      { t: "k", m, r: 27, von: -1.2, bis: -1.2 + TAU },
      { t: "s", a: P(14, 82), b: P(86, 82) }, { t: "tick", p: P(14, 82), w: 0, l: 2.2 }, { t: "tick", p: P(86, 82), w: 0, l: 2.2 },
    ], K, WEISS, WEISS_GLANZ);
    zeichneTeile([
      { t: "s", a: P(50, 15), b: P(50, 77), stil: "strich" }, { t: "s", a: P(19, 46), b: P(81, 46), stil: "strich" },
      { t: "tick", p: P(50, 82), w: 0, l: 3.4 }, { t: "gleich", a: P(14, 82), b: P(50, 82) }, { t: "gleich", a: P(50, 82), b: P(86, 82) },
    ], clamp(K * 1.6 - 0.6, 0, 1), GRUEN, GRUEN_GLANZ);
    // Das Fadenkreuz kreist um die Mitte und zieht sich zu.
    const weit = ruhig() ? 0 : 5 * (0.5 + 0.5 * Math.cos(zeit * 0.9));
    state.zeiger = P(m.x + Math.cos(zeit * 1.7) * weit, m.y + Math.sin(zeit * 1.7) * weit);
    g.globalAlpha = K;
    zeichneZeiger({ bahn: null });
    g.globalAlpha = 1;
    // Auf einem Handy hängt es am Griff: So wird nachher gezogen.
    if (mitFinger()) {
      zeichneGriffBei(X(state.zeiger.x), Y(state.zeiger.y) + VERSATZ, K);
      g.save();
      g.globalAlpha = 0.7 * K;
      g.fillStyle = "#cfe3ff";
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.font = `700 ${Math.round(10.5 * view.u)}px ${MONO}`;
      g.fillText("HALTEN · ZIEHEN · LOSLASSEN", X(50), Y(91));
      g.restore();
    }
    state.zeiger = null;
  }
  let titelSeit = 0;
  // Ob mit dem Finger gespielt wird: woran zuletzt getippt wurde – und davor,
  // was das Gerät von sich sagt.
  const mitFinger = () => (state.eingabe ? state.eingabe === "touch" : Boolean(window.matchMedia?.("(pointer: coarse)").matches));

  // ---------------------------------------------------------------------------
  // Die Anzeige
  // ---------------------------------------------------------------------------
  // Die Frage in höchstens zwei Zeilen: an der Leerstelle geteilt, die beide
  // am gleichmässigsten macht.
  function zeilenFuer(text, breit) {
    if (g.measureText(text).width <= breit) return [text];
    const worte = text.split(" ");
    let beste = [text];
    let mass = Infinity;
    for (let i = 1; i < worte.length; i += 1) {
      const eins = worte.slice(0, i).join(" ");
      const zwei = worte.slice(i).join(" ");
      const lang = Math.max(g.measureText(eins).width, g.measureText(zwei).width);
      if (lang < mass) { mass = lang; beste = [eins, zwei]; }
    }
    return beste;
  }

  // So viele Zeilen, wie es braucht: Wort für Wort, bis die Zeile voll ist.
  function umbrechen(text, breit) {
    const zeilen = [];
    let zeile = "";
    text.split(" ").forEach((wort) => {
      const probe = zeile ? `${zeile} ${wort}` : wort;
      if (zeile && g.measureText(probe).width > breit) { zeilen.push(zeile); zeile = wort; } else zeile = probe;
    });
    if (zeile) zeilen.push(zeile);
    return zeilen;
  }

  function rundesFeld(x, y, w, h, r) {
    g.beginPath();
    if (g.roundRect) g.roundRect(x, y, w, h, r); else g.rect(x, y, w, h);
  }

  function zeichneAnzeige() {
    const u = view.u;
    const a = blatt();
    const laeuft = state.phase !== "bereit";
    const zeigt = Boolean(state.wertung);
    const links = view.x0;
    const breit = view.seite;
    g.setLineDash([]);
    g.textBaseline = "middle";

    if (laeuft && a) {
      // In der Vorschau steht oben der Name der Aufgabe, und die Uhr ist
      // voll: Sie läuft erst, wenn das Blatt daliegt.
      const vor = inVorschau();
      const t = vor ? (performance.now() - state.vorSeit) / 1000 : seit();
      const da = ruhig() ? 1 : clamp(t / 0.3, 0, 1);
      // «Blatt 3 / 10» klein darüber, dann die Frage. Auf einem flachen
      // Bild steht beides links neben dem Blatt.
      const fx = view.flach ? links / 2 : links + breit / 2;
      const gross = Math.round((view.flach ? 19 : 17) * u);
      g.font = `800 ${gross}px system-ui, sans-serif`;
      const platz = Math.min(view.cssW - 24, breit + 8);
      const frage = vor ? a.kurz : a.frage;
      const zeilen = view.flach ? umbrechen(frage, links - 56) : zeilenFuer(frage, platz);
      // Passt sie auch in zwei Zeilen nicht, wird die Schrift kleiner.
      const weit = Math.max(...zeilen.map((zeile) => g.measureText(zeile).width));
      if (!view.flach && weit > platz) g.font = `800 ${Math.floor((gross * platz) / weit)}px system-ui, sans-serif`;
      const abstand = Math.round(gross * 1.2);
      const mitte = (view.flach ? view.y0 + view.seite * 0.42 : view.y0 - 36 * u) + (1 - da) * 5;
      g.textAlign = "center";
      g.globalAlpha = da;
      g.fillStyle = "#ffffff";
      zeilen.forEach((zeile, i) => g.fillText(zeile, fx, mitte + (i - (zeilen.length - 1) / 2) * abstand));
      g.globalAlpha = 0.55 * da;
      g.fillStyle = "#cfe3ff";
      g.font = `700 ${Math.round(10.5 * u)}px ${MONO}`;
      g.fillText(`BLATT ${String(state.index + 1).padStart(2, "0")} / ${BLAETTER}${vor && a.art !== "tunnel" ? ` · ${a.zeit} SEKUNDEN` : ""}`, fx, view.flach ? mitte - (zeilen.length / 2) * abstand - 16 * u : view.y0 - 63 * u);
      g.globalAlpha = 1;

      // Die Uhr des Blattes: ein Strich, der kürzer wird. Im Tunnel gibt es
      // keinen – dort ist die Kugel die Uhr.
      const dauer = a.zeit || ZEIT;
      if (a.art !== "tunnel") {
        const rest = vor ? 1 : zeigt ? clamp((EINZUG + dauer - (state.tZeig - state.t0) / 1000) / dauer, 0, 1) : clamp((EINZUG + dauer - t) / dauer, 0, 1);
        const y = view.y0 - 10 * u;
        const hoch = Math.max(2.5, 3 * u);
        rundesFeld(links, y - hoch / 2, breit, hoch, hoch / 2);
        g.fillStyle = "rgba(200, 225, 255, 0.14)";
        g.fill();
        const knapp = !zeigt && !vor && rest * dauer <= 3;
        g.fillStyle = zeigt || vor ? "rgba(200, 225, 255, 0.4)" : knapp ? (Math.floor(t * 4) % 2 ? "#ff8a5c" : "#ffb84d") : "#e6f1ff";
        if (rest > 0.004) {
          rundesFeld(links, y - hoch / 2, breit * rest, hoch, hoch / 2);
          g.fill();
        }
      }
    }

    // Die zehn Kästchen: was jedes Blatt gebracht hat.
    const luecke = Math.round(5 * u);
    const kante = Math.min(Math.round(31 * u), Math.floor((breit - 9 * luecke) / BLAETTER));
    const kx = links + (breit - (BLAETTER * kante + (BLAETTER - 1) * luecke)) / 2;
    const ky = view.y0 + view.seite + Math.round(13 * u);
    g.textAlign = "center";
    g.font = `800 ${Math.round(kante * 0.5)}px system-ui, sans-serif`;
    for (let i = 0; i < BLAETTER; i += 1) {
      const eintrag = state.liste[i];
      const x = kx + i * (kante + luecke);
      const dran = laeuft && i === state.index;
      rundesFeld(x, ky, kante, kante, 5 * u);
      if (eintrag) {
        const farbe = FARBE[WIE[eintrag.punkte]];
        g.globalAlpha = 0.2;
        g.fillStyle = farbe;
        g.fill();
        g.globalAlpha = 1;
        g.strokeStyle = farbe;
        g.lineWidth = 1.5;
        g.stroke();
        g.fillStyle = farbe;
        g.fillText(String(eintrag.punkte), x + kante / 2, ky + kante / 2 + 0.5);
      } else {
        g.strokeStyle = dran ? "rgba(255, 255, 255, 0.9)" : "rgba(200, 225, 255, 0.28)";
        g.lineWidth = dran ? 1.8 : 1;
        g.stroke();
        if (dran) {
          g.fillStyle = "rgba(255, 255, 255, 0.85)";
          g.beginPath();
          g.arc(x + kante / 2, ky + kante / 2, 2.2 * u, 0, TAU);
          g.fill();
        }
      }
    }

    // Das Schriftfeld – wie unten rechts auf jedem Plan. Neben dem Blatt,
    // wo Platz ist, sonst als Zeile darunter.
    const nr = String(Math.min(BLAETTER, state.index + 1)).padStart(2, "0");
    const rechts = view.cssW - (links + breit);
    g.fillStyle = "rgba(205, 228, 255, 0.5)";
    g.strokeStyle = "rgba(190, 220, 255, 0.3)";
    g.lineWidth = 1;
    if (rechts >= 190) {
      const w = Math.min(236, rechts - 44);
      const h = 102;
      const x = view.cssW - 24 - w;
      const y = view.y0 + view.seite - h;
      g.strokeRect(x, y, w, h);
      g.beginPath();
      g.moveTo(x, y + 30);
      g.lineTo(x + w, y + 30);
      g.moveTo(x, y + 66);
      g.lineTo(x + w, y + 66);
      g.moveTo(x + w * 0.5, y + 30);
      g.lineTo(x + w * 0.5, y + h);
      g.stroke();
      g.textAlign = "left";
      g.font = `800 13px ${MONO}`;
      g.fillStyle = "rgba(225, 240, 255, 0.75)";
      g.fillText("AUGENMASS", x + 10, y + 16);
      g.font = `600 9.5px ${MONO}`;
      g.fillStyle = "rgba(205, 228, 255, 0.5)";
      g.fillText("BLATT", x + 10, y + 41);
      g.fillText("MASSSTAB", x + w * 0.5 + 10, y + 41);
      g.fillText("PUNKTE", x + 10, y + 77);
      g.fillText("TOLERANZ", x + w * 0.5 + 10, y + 77);
      g.font = `700 13px ${MONO}`;
      g.fillStyle = "rgba(225, 240, 255, 0.8)";
      g.fillText(`${nr} / ${BLAETTER}`, x + 10, y + 55);
      g.fillText("1 : 1", x + w * 0.5 + 10, y + 55);
      g.fillText(String(state.punkte).padStart(3, "0"), x + 10, y + 91);
      g.fillText(`± ${GRENZEN[0].toFixed(1).replace(".", ",")} mm`, x + w * 0.5 + 10, y + 91);
    } else if (view.cssH - (view.schieber ? view.schieber.y + view.schieber.w * 0.36 : ky + kante) > 30 * u) {
      g.textAlign = "center";
      g.font = `600 ${Math.round(9.5 * u)}px ${MONO}`;
      g.globalAlpha = 0.8;
      g.fillText(`AUGENMASS · BLATT ${nr}/${BLAETTER} · M 1:1 · ± ${GRENZEN[0].toFixed(1).replace(".", ",")} MM`, links + breit / 2, view.cssH - 22 * u);
      g.globalAlpha = 1;
    }
    zeichneSchieber();

    // Die Stückliste links daneben, wo Platz ist: jedes Blatt mit seinen
    // Millimetern und Punkten. Was noch kommt, bleibt verdeckt.
    if (links >= 210 && laeuft && !view.flach) {
      const w = Math.min(236, links - 48);
      const x = links - 28 - w;
      const zeile = Math.min(24, (view.seite - 30) / BLAETTER);
      let y = view.y0 + 8;
      g.textAlign = "left";
      g.font = `700 10px ${MONO}`;
      g.fillStyle = "rgba(205, 228, 255, 0.5)";
      g.fillText("NR  AUFGABE", x, y);
      g.textAlign = "right";
      g.fillText("MM   PKT", x + w, y);
      g.beginPath();
      g.moveTo(x, y + 9);
      g.lineTo(x + w, y + 9);
      g.stroke();
      y += 9 + zeile * 0.7;
      g.font = `600 12px ${MONO}`;
      for (let i = 0; i < BLAETTER; i += 1) {
        const eintrag = state.liste[i];
        const dran = i === state.index;
        const farbe = eintrag ? FARBE[WIE[eintrag.punkte]] : dran ? "#ffffff" : "rgba(205, 228, 255, 0.35)";
        g.fillStyle = farbe;
        g.textAlign = "left";
        const name = eintrag || dran ? state.blaetter[i].kurz : "· · ·";
        g.fillText(`${String(i + 1).padStart(2, "0")}  ${name}`, x, y + i * zeile);
        if (eintrag) {
          g.textAlign = "right";
          const mm = Number.isFinite(eintrag.mm) ? eintrag.mm.toFixed(1) : "–";
          g.fillText(`${mm}   ${String(eintrag.punkte).padStart(2, " ")}`, x + w, y + i * zeile);
        }
      }
    }
  }

  // Der Messschieber: Er fährt nach jeder Antwort so weit auf, wie sie
  // daneben lag, und zeigt die Millimeter an. Kleine Abstände sieht man
  // kaum – darum öffnet er sich nach der Wurzel: Ein Zehntel ist schon ein
  // Spalt.
  function zeichneSchieber() {
    const ms = view.schieber;
    if (!ms) return;
    const e = ms.w / 100;
    const w = state.wertung;
    const farbe = w ? FARBE[WIE[w.punkte]] : "#f1f7ff";
    const spalt = Math.sqrt(clamp(state.schieber / GRENZEN[GRENZEN.length - 1], 0, 1)) * 38 * e;
    const xs = 10 * e + spalt;
    g.save();
    g.translate(ms.x, ms.y);
    g.setLineDash([]);
    g.lineJoin = "round";
    g.lineCap = "round";
    const flaeche = "rgba(170, 208, 255, 0.11)";
    const kante = "rgba(222, 238, 255, 0.72)";
    g.lineWidth = Math.max(1, 0.55 * e);
    const form = (pkte, fuellung = flaeche) => {
      g.beginPath();
      pkte.forEach(([x, y], i) => (i ? g.lineTo(x * e, y * e) : g.moveTo(x * e, y * e)));
      g.closePath();
      g.fillStyle = fuellung;
      g.fill();
      g.strokeStyle = kante;
      g.stroke();
    };
    // Die Schiene und die feste Backe.
    form([[0, 9], [100, 9], [100, 18], [0, 18]]);
    form([[2, 18], [10, 18], [10, 34], [7, 34], [2, 25]]);
    form([[2, 9], [10, 9], [10, 2], [8, 2], [2, 6]]);
    // Der Spalt: so breit, wie es daneben war.
    if (spalt > 0.6) {
      g.globalAlpha = 0.6;
      g.fillStyle = farbe;
      g.fillRect(10 * e, 20.5 * e, spalt, 11 * e);
      g.globalAlpha = 1;
    }
    // Der Schieber mit seiner Backe, der Anzeige und dem Rädchen.
    g.translate(xs, 0);
    form([[0, 18], [0, 34], [3, 34], [8, 25], [8, 18]]);
    form([[0, 9], [0, 2], [2, 2], [8, 6], [8, 9]]);
    form([[0, 5.5], [42, 5.5], [42, 21.5], [0, 21.5]], "rgba(20, 60, 122, 0.96)");
    form([[9, 8], [39, 8], [39, 19], [9, 19]], "#06182e");
    g.beginPath();
    g.arc(4.6 * e, 13.5 * e, 2.2 * e, 0, TAU);
    g.fillStyle = flaeche;
    g.fill();
    g.stroke();
    g.fillStyle = farbe;
    g.textBaseline = "middle";
    g.textAlign = "right";
    g.font = `700 ${Math.round(8.2 * e)}px ${MONO}`;
    const zahl = w && !Number.isFinite(w.mm) ? "--.--" : state.schieber.toFixed(2);
    g.fillText(zahl, 32.5 * e, 13.9 * e);
    g.font = `700 ${Math.round(3.6 * e)}px ${MONO}`;
    g.textAlign = "left";
    g.globalAlpha = 0.8;
    g.fillText("mm", 33.3 * e, 16 * e);
    g.restore();
  }

  function zeichneFunken() {
    if (!state.funken.length) return;
    g.save();
    g.globalCompositeOperation = "lighter";
    g.fillStyle = GELB;
    state.funken.forEach((f) => {
      const k = 1 - f.alt / f.leben;
      g.globalAlpha = k;
      g.beginPath();
      g.arc(X(f.x), Y(f.y), (0.5 + k * 0.9) * view.u * 2, 0, TAU);
      g.fill();
    });
    g.restore();
  }

  function zeichnen() {
    if (!g) return;
    const d = view.dpr;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalAlpha = 1;
    g.globalCompositeOperation = "source-over";
    g.drawImage(papierBild(), 0, 0);
    g.setTransform(d, 0, 0, d, 0, 0);
    if (state.phase === "bereit") zeichneTitel();
    else if (inVorschau()) zeichneVorschau();
    else zeichneBlatt();
    zeichneFunken();
    zeichneAnzeige();
  }

  // ---------------------------------------------------------------------------
  // Zuschauen
  // ---------------------------------------------------------------------------
  // Dieselben zehn Blätter (die Saat hält geist.js oder der Abend), und Zug
  // um Zug, was der andere tut: Das Fadenkreuz gleitet zwischen zwei Lagen,
  // die Antwort wird hier noch einmal nachgemessen.
  const zuschau = { index: -1, was: -1, vor: false };

  function zuschauenTakt() {
    zuschauer?.weiter?.();
    const jetzt = zuschauer?.jetzt?.();
    const probe = zuschauer?.letzte?.(jetzt);
    if (!probe) return;
    const index = clamp(Math.floor(probe.c / 4), 0, BLAETTER - 1);
    const was = probe.c - Math.floor(probe.c / 4) * 4;
    const nun = performance.now();
    // Zu hören ist, was beim anderen gerade geschieht – nicht, was beim
    // Einsteigen schon zurückliegt.
    const frisch = jetzt - probe.t < 1500;
    // Die Vorschau: der Zug «es liegt da» mit a = 1.
    const vor = was === 0 && probe.a === 1;
    if (index !== zuschau.index) {
      zuschau.index = index;
      zuschau.was = -1;
      zuschau.vor = vor;
      state.index = index;
      state.zeiger = null;
      state.antwort = null;
      state.wertung = null;
      // Wann das Blatt begann: beim Zug «neues Blatt» genau, sonst etwa.
      state.t0 = nun - (jetzt - (was === 0 ? probe.t : probe.t - 1000 * EINZUG));
      state.vorSeit = state.t0;
      state.imTunnel = false;
      state.los = 0;
      if (status) status.textContent = `Blatt ${index + 1} von ${BLAETTER}: ${blatt().frage}`;
      if (frisch) ton("augenmass.blatt");
    } else if (zuschau.vor && !vor) {
      // Der andere hat getippt: Jetzt liegt das Blatt da.
      zuschau.vor = false;
      state.t0 = nun - (jetzt - (was === 0 ? probe.t : probe.t - 1000 * EINZUG));
      if (frisch && was === 0) ton("augenmass.setzen");
    }
    const a = blatt();
    if (was === 1 || was === 3) {
      if (zuschau.was !== was) {
        zuschau.was = was;
        state.antwort = was === 1 ? P(probe.a / ZUG_MM, probe.b / ZUG_MM) : null;
        state.zeiger = state.antwort ? P(state.antwort.x, state.antwort.y) : null;
        richte(a, state.antwort);
        const mm = daneben(a, state.antwort);
        const punkte = state.antwort ? punkteFuer(mm, a.mass) : 0;
        state.wertung = { mm, punkte };
        state.liste[index] = { mm, punkte };
        state.tZeig = nun - (jetzt - probe.t);
        if (frisch) {
          antwortKlang(punkte);
          if (punkte === PUNKTE_JE_BLATT) funkenBei(a.ziel);
        }
      }
    } else {
      zuschau.was = was;
      state.wertung = null;
      state.antwort = null;
      if (a.art === "tunnel") {
        // Im Tunnel heisst der Zug: Die Kugel ist losgelassen.
        state.zeiger = null;
        if (was === 2 && !state.los) state.los = nun - (jetzt - probe.t);
      } else if (was === 2) {
        // Zwischen zwei Lagen gleitet das Fadenkreuz.
        let x = probe.a / ZUG_MM;
        let y = probe.b / ZUG_MM;
        const nach = zuschauer.naechste?.(jetzt);
        if (nach && Math.floor(nach.c / 4) === index && nach.c % 4 !== 0 && nach.c % 4 !== 3 && nach.t > probe.t) {
          const k = clamp((jetzt - probe.t) / (nach.t - probe.t), 0, 1);
          x += (nach.a / ZUG_MM - x) * k;
          y += (nach.b / ZUG_MM - y) * k;
        }
        state.zeiger = P(x, y);
      } else {
        state.zeiger = null;
      }
      if (a.art === "tunnel" && frisch && !state.imTunnel && kugelWeg(a, tunnelZeit()) >= a.s1) { state.imTunnel = true; ton("augenmass.tunnel"); }
    }
    if (probe.p !== state.punkte) {
      state.punkte = probe.p;
      shell.setCount(probe.p);
    }
  }

  // Ab jetzt die Blätter des anderen: dieselben Aufgaben, und wo er tippt.
  function zuschauenStarten() {
    if (!zuschauer?.letzte) return;
    startRun();
    state.phase = "zuschauen";
    shell.setPhase("play");
    zuschau.index = -1;
    zuschau.was = -1;
    zuschauer.los?.();
  }

  // ---------------------------------------------------------------------------
  // Ablauf
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
    shell.closeOverlay();
    zufall.neu();
    shell.setPhase("intro");
    state.blaetter = aufgabenFuer();
    state.phase = "bereit";
    state.index = 0;
    state.punkte = 0;
    state.liste = new Array(BLAETTER).fill(null);
    state.zeiger = null;
    state.griff = null;
    state.wink = null;
    state.antwort = null;
    state.wertung = null;
    state.serie = 0;
    state.schieber = 0;
    state.funken = [];
    state.t0 = performance.now();
    titelSeit = performance.now() / 1000;
    shell.setCount(0);

    shell.clear();
    const prompt = shell.el("p", "cm-prompt am-prompt", "Zehn Blätter, kein Lineal. Tippe, um zu beginnen.");
    status = shell.el("p", "am-status");
    status.setAttribute("role", "status");
    status.setAttribute("aria-live", "polite");
    shell.play.append(prompt, status, buildPlatz());
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
    const dauer = Math.min(800, 200 + ziel * 6);
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
    stopLoop();
    if (state.phase === "ende") return;
    // Im Live-Modus endet die Runde auch mitten in einem Blatt: Es zählt,
    // was bis dahin gemessen ist.
    state.phase = "ende";
    state.griff = null;
    state.wink = null;
    zeichnen();
    const punkte = state.punkte;
    const geist = aufnahme?.ende() || null;
    const vorher = Number(store.read()?.scores?.[0]) || 0;
    const rekord = punkte > vorher;
    store.update((old) => ({
      runs: (Number(old.runs) || 0) + 1,
      scores: [...(old.scores || []), punkte].sort((x, y) => y - x).slice(0, TOP_COUNT),
    }));
    const gemessen = state.liste.filter((e) => e && Number.isFinite(e.mm));
    const schnitt = gemessen.length ? gemessen.reduce((summe, e) => summe + e.mm, 0) / gemessen.length : 0;
    const genau = state.liste.filter((e) => e && e.punkte === PUNKTE_JE_BLATT).length;
    shell.showResult({
      label: "Deine Punkte",
      points: punkte,
      detail: [
        rekord ? "Neuer Rekord!" : "",
        genau ? `${genau}× genau` : "",
        gemessen.length ? `im Schnitt ${schnitt.toFixed(1).replace(".", ",")} mm daneben` : "",
        !rekord && vorher ? `Bestwert ${vorher}` : "",
      ].filter(Boolean).join(" · "),
      geist,
    });
    if (rekord) host.querySelector(".cm-result-detail")?.classList.add("am-rekord");
    zaehleHoch(punkte);
  }

  // ---------------------------------------------------------------------------
  // Start
  // ---------------------------------------------------------------------------
  shell = shellApi.mount({
    host,
    title: "Augenmass",
    area: "konzentration",
    accent: "#3F8CFF",
    accentDark: "#1f5fd0",
    clock: false,
    onRestart: () => (zuschauer ? zuschauenStarten() : startRun()),
    live: { los: losGehts, stopp: () => finish(), zuschauen: (quelle) => { zuschauer = quelle; zuschauenStarten(); } },
  });
  zuschauer = window.LernappGeist?.zuschauer?.({
    host, spiel: "eyeMeasure", fassung: "z2", zufall, zuege: true, nochmal: zuschauenStarten,
  }) || null;
  if (!zuschauer) aufnahme = window.LernappGeist?.zuege?.({ fassung: "z2", zufall }) || null;

  startRun();
  zuschauer?.laden.then((da) => { if (da) zuschauenStarten(); });

  // --- Tippen, Halten, Ziehen, Loslassen -----------------------------------------
  // Der erste Tipp auf ein Blatt beendet seine Vorschau. Danach hält der
  // Finger das Fadenkreuz am Griff: Es steht über ihm (blattOrt, versetzt),
  // geht beim Ziehen mit, und das Loslassen ist die Antwort. Ein blosses
  // Antippen setzt es nur hin. Mit der Maus schwebt es schon vor dem Klick
  // mit, genau unter dem Zeiger. Im Tunnel ist der Tipp selbst die Antwort.
  const offen = () => state.phase === "aufgabe" && seit() >= SPERRE;
  // Ob die Vorschau schon einen Tipp annimmt – nicht den, der noch dem
  // letzten Blatt galt.
  const bereitZumLos = () => state.phase === "vorschau" && performance.now() - state.vorSeit >= VOR_SPERRE * 1000;

  host.addEventListener("pointerdown", (event) => {
    if (event.target.closest("button, a, input")) return;
    state.eingabe = event.pointerType || "mouse";
    if (state.phase === "bereit") {
      if (!shell.live && !zuschauer) losGehts();
      return;
    }
    // Der Tipp nach der Vorschau legt das Blatt hin.
    if (state.phase === "vorschau") {
      if (bereitZumLos()) blattLos();
      return;
    }
    if (!offen() || !canvas) return;
    event.preventDefault();
    if (blatt().art === "tunnel") { tippTunnel(event.timeStamp); return; }
    // Ein zweiter Finger nimmt dem ersten das Fadenkreuz nicht weg.
    if (state.griff) return;
    const ort = fingerOrt(event);
    state.griff = {
      id: event.pointerId, art: state.eingabe, versetzt: state.eingabe === "touch",
      ...ort, px0: ort.px, py0: ort.py, weit: 0, seit: performance.now(),
    };
    state.wink = null;
    // Ein neuer Griff: Wo das Fadenkreuz davor stand, zählt beim Abheben nicht mit.
    spur.length = 0;
    try { host.setPointerCapture(event.pointerId); } catch { /* egal */ }
    setzeZeiger(blattOrt(event, state.griff.versetzt));
    ton("augenmass.setzen");
  });

  host.addEventListener("pointermove", (event) => {
    if (state.phase !== "aufgabe" || !canvas || blatt().art === "tunnel") return;
    const griff = state.griff;
    if (griff) {
      if (event.pointerId !== griff.id) return;
      Object.assign(griff, fingerOrt(event));
      griff.weit = Math.max(griff.weit, Math.hypot(griff.px - griff.px0, griff.py - griff.py0));
      setzeZeiger(blattOrt(event, griff.versetzt));
    } else if (event.pointerType === "mouse" && offen()) {
      state.wink = null;
      setzeZeiger(blattOrt(event));
    }
  });

  host.addEventListener("pointerup", (event) => {
    const griff = state.griff;
    if (!griff || event.pointerId !== griff.id) return;
    if (state.phase !== "aufgabe") { state.griff = null; return; }
    // Nur angetippt: Das Fadenkreuz bleibt stehen, wo es ist – die Antwort
    // ist das noch nicht. Der Griff bleibt liegen und sagt, was zu tun ist.
    if (griff.versetzt && griff.weit < TIPP_WEG && performance.now() - griff.seit < TIPP_MS) {
      state.griff = null;
      state.wink = { px: griff.px0, py: griff.py0, seit: performance.now() };
      return;
    }
    const zuletzt = aufBahn(blatt(), blattOrt(event, griff.versetzt));
    antworte(griff.art === "mouse" ? zuletzt : ruhigeStelle(zuletzt));
  });

  host.addEventListener("pointercancel", (event) => {
    if (state.griff && event.pointerId === state.griff.id) state.griff = null;
  });

  // --- Tastatur ------------------------------------------------------------------
  // Pfeile schieben das Fadenkreuz (mit Umschalt in Sprüngen), Enter oder
  // die Leertaste antworten – und beenden davor die Vorschau. Im Tunnel ist
  // die Taste der Tipp.
  const SCHRITT = 0.25;
  document.addEventListener("keydown", (event) => {
    const pfeil = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[event.key];
    const los = event.key === "Enter" || event.key === " ";
    if (!pfeil && !los) return;
    if (document.activeElement?.tagName === "BUTTON") return;
    if (state.phase === "bereit") {
      if (los && !shell.live && !zuschauer) { event.preventDefault(); losGehts(); }
      return;
    }
    if (state.phase === "vorschau") {
      if (los && !event.repeat && bereitZumLos()) { event.preventDefault(); blattLos(); }
      return;
    }
    if (!offen()) return;
    event.preventDefault();
    const a = blatt();
    if (a.art === "tunnel") {
      if (los && !event.repeat) tippTunnel(event.timeStamp);
      return;
    }
    if (pfeil) {
      const weit = SCHRITT * (event.shiftKey ? 8 : 1);
      const von = state.zeiger || (a.bahn ? aufBahn(a, P(BLATT / 2, BLATT / 2)) : P(BLATT / 2, BLATT / 2));
      state.wink = null;
      setzeZeiger(P(von.x + pfeil[0] * weit, von.y + pfeil[1] * weit));
      return;
    }
    if (state.zeiger && !event.repeat) antworte(state.zeiger);
  });

  window.addEventListener("resize", messen);
  window.addEventListener("orientationchange", messen);
  window.addEventListener("pagehide", () => { clearStep(); stopLoop(); });

  // Für die Prüfskripte und die Vorführung.
  window.LernappAugenmass = {
    BLATT, RAND, GRENZEN, WIE, PLAN, LEICHT, MITTEL, SCHWER, BLAETTER, ZEIT, ZEITEN, EINZUG, SPERRE, ZEIGEN_MS, PUNKTE_JE_BLATT,
    VORSCHAU, VOR_ZAEHLT, VOR_SPERRE, TUNNEL_START, TUN, VERSATZ, VERSATZ_RAND, GRIFF_R, TIPP_MS, TIPP_WEG, versatzBei, fingerBei,
    state, view, blatt, seit, aufgabenFuer, weltText, punkteFuer, daneben, aufBahn, kugelWeg, tunnelZeit, tunnelOrt, tunnelEnde,
    losGehts, blattLos, antworte, weiter, setzeZeiger, tippTunnel, zeichnen, BAU,
    // Wo eine Stelle des Blattes auf dem Bildschirm liegt.
    imBild: (ort) => {
      const r = canvas.getBoundingClientRect();
      return { x: r.left + X(ort.x), y: r.top + Y(ort.y) };
    },
    // Wo der Finger liegen muss, damit das Fadenkreuz auf dieser Stelle steht.
    imGriff: (ort) => {
      const r = canvas.getBoundingClientRect();
      return { x: r.left + X(ort.x), y: r.top + fingerBei(Y(ort.y)) };
    },
  };
})();
