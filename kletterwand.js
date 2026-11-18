/*
 * kletterwand.js – Kletterwand. Speedklettern an einem Turm, der nicht aufhört.
 * ---------------------------------------------------------------------------
 * Ein Kletterturm in der Abendsonne, davor eine Kletterin von hinten – die
 * Kamera steht schräg hinter ihr. Wer spielt, tippt den nächsten Griff an,
 * und sie greift hin: abwechselnd mit der linken und der rechten Hand, immer
 * vom oberen Griff aus.
 *
 * Drei Dinge entscheiden:
 *
 *   Genau    Je näher am Bolzen in der Mitte des Griffs der Tipp sitzt, desto
 *            besser der Halt: «perfekt» gibt viel Kraft zurück und Schwung,
 *            «gut» etwas, «knapp» (nur die Fingerkuppen) fast nichts – und
 *            wer daneben tippt, rutscht ab. Dann ist die Runde vorbei.
 *   Schnell  Die Kraft läuft ab, solange sie hängt, und je höher, desto
 *            schneller. Jeder Griff gibt ein Stück zurück. Ist sie leer,
 *            gehen die Hände auf.
 *   Weit     Mit Schwung (perfekte Griffe hintereinander) reicht sie weiter:
 *            Dann lässt sich ein Griff überspringen – ein Sprung, bei dem
 *            beide Hände loslassen. Goldene Griffe liegen weit und sind
 *            klein; sie geben die halbe Kraft zurück.
 *
 * Es wird von selbst schwerer: Die Griffe werden kleiner und liegen weiter
 * auseinander, ab 18 Metern bröckeln manche (wer zu lange daran hängt, fällt
 * mit ihnen), ab 40 Metern gleiten manche auf einer Schiene hin und her.
 * Gezählt werden die Meter. Der Turm ist immer kletterbar: Der nächste Griff
 * der Hauptlinie liegt nie weiter weg, als sie ohne Schwung reicht.
 *
 * Die Griffe kommen aus zufall.js – ohne Turnier jedes Mal andere, im
 * Turnier für alle dieselben. Aufgezeichnet werden die Züge (geist.js,
 * zuege): jeder Griff mit seiner Güte und das Ende. Damit lassen sich die
 * besten Läufe anschauen, und im Multiplayer sehen die anderen dasselbe.
 *
 * Gezeichnet wird mit WebGL 2, ohne Bibliothek: der Himmel mit Sonne, Wolken
 * und Bergen, der Turm mit seinen Platten, die Griffe, die Kletterin (ein
 * Netz, das in jedem Bild aus ihrer Haltung neu entsteht – Arme und Beine
 * finden ihre Griffe und Tritte selbst), ihr Schatten auf der Wand, Kreide
 * und Splitter. Gerechnet wird in Metern: x nach rechts, y hinauf, z aus der
 * Wand heraus zur Kamera. Die Zahlen liegen auf einer zweiten Leinwand
 * darüber.
 */
(() => {
  "use strict";

  if (document.body.dataset.page !== "climb") return;

  const host = document.querySelector("#kw-stage");
  const shellApi = window.LernappGameShell;
  const cloudApi = window.LernappGameCloud;
  if (!host || !shellApi) return;

  const kids = () => window.LernappKids || null;
  const klang = () => window.ArcadeKlang || null;
  const ruhig = () => Boolean(kids()?.prefersReducedMotion?.());

  // Der Zufall: nur die Griffe. Kreide, Splitter, Wolken und das Flattern
  // des Zopfs nehmen Math.random oder feste Zahlen.
  const zufall = window.LernappZufall?.fuer?.("speedClimb") || {
    fest: false, neu() {}, zahl: Math.random,
  };

  // ---------------------------------------------------------------------------
  // Regeln
  // ---------------------------------------------------------------------------
  const BAHN = 0.82;                // so weit links und rechts der Mitte liegen Griffe höchstens (m)
  const START_Y = 2.3;             // so hoch über dem Boden hängt der obere Startgriff
  const R_STAND = 1.05;            // so weit reicht sie ohne Schwung, vom oberen Griff aus
  const R_SPRUNG = 1.62;           // und mit vollem Schwung
  const R_HAUPT = 0.94;            // weiter liegt der nächste Griff der Hauptlinie nie

  // Wie gut ein Tipp sitzt, gemessen am Halbmesser des Griffs: bis hierher
  // perfekt, gut, knapp. Weiter draussen (bis DANEBEN) ist es ein Fehlgriff –
  // noch weiter weg galt der Tipp keinem Griff.
  const PERFEKT = 0.4;
  const PERFEKT_MIN = 0.036;       // perfekt ist nie enger als so viele Meter
  const GUT = 0.85;
  const KNAPP = 1.2;
  const DANEBEN = 2.5;
  const GUETE = ["knapp", "gut", "perfekt"];

  // Die Kraft (0 … 1): so viel läuft je Sekunde ab (unten … weit oben, und
  // über 80 Metern mit jedem Meter noch etwas mehr – so endet jede Runde),
  // so viel gibt ein Griff zurück.
  const KRAFT_AB = [0.19, 0.4];
  const KRAFT_AB_JE_METER = 0.0026;
  const KRAFT_PLUS = [0.05, 0.19, 0.32];
  const KRAFT_GOLD = 0.5;
  // Der Schwung (0 … 1): was ein Griff dazugibt, und was je Sekunde vergeht.
  const SCHWUNG_PLUS = [-1, 0.08, 0.3];
  const SCHWUNG_AB = 0.085;
  // Ein Griff, der bröckelt, hält noch so lange (unten … ganz oben).
  const BRUCH_ZEIT = [3.2, 1.25];
  // Ab hier gibt es sie: Griffe, die bröckeln, und Griffe auf der Schiene.
  const AB_BRUCH = 18;
  const AB_PENDEL = 40;

  const TOP_COUNT = 5;

  // ---------------------------------------------------------------------------
  // Rechnen
  // ---------------------------------------------------------------------------
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const lerp = (a, b, k) => a + (b - a) * k;
  const weich = (a, b, x) => { const u = clamp((x - a) / (b - a), 0, 1); return u * u * (3 - 2 * u); };
  const TAU = Math.PI * 2;
  const GRAD = Math.PI / 180;
  const zz = (a, b) => a + (b - a) * zufall.zahl();

  // Wie schwer es in dieser Höhe ist (0 am Boden, gegen 1 weit oben).
  const schwere = (meter) => 1 - Math.exp(-Math.max(0, meter) / 75);

  // ---------------------------------------------------------------------------
  // Der Turm: die Griffe
  // ---------------------------------------------------------------------------
  /*
   * Die Griffe entstehen von unten nach oben, als eine Hauptlinie: mal
   * links, mal rechts einer Mitte, die langsam wandert. Jeder Griff der
   * Hauptlinie liegt in Reichweite seines Vorgängers (R_HAUPT) – auch dann,
   * wenn einer von beiden auf seiner Schiene ganz am Rand steht. Dazu kommen
   * goldene Griffe: klein, ein Stück über einem Griff der Hauptlinie, nur mit
   * Schwung zu holen – und von jedem aus geht es auf der Hauptlinie weiter.
   *
   * Ein Griff:
   *   x, y     wo er sitzt (ein Griff auf der Schiene: ihre Mitte)
   *   r        sein Halbmesser
   *   art      "fest", "bruch" (bröckelt) oder "pendel" (gleitet hin und her)
   *   gold     ein goldener
   *   weit, tempo, phase   die Schiene: halbe Länge, wie schnell, wo er beginnt
   *   form     eine Zahl für seine Gestalt und Farbe (nur fürs Bild)
   * und was im Lauf dazukommt:
   *   gepackt  wann er zum ersten Mal gegriffen wurde (dann steht die Schiene)
   *   fx       wo er dabei stand
   *   bricht   wann er bricht
   *   weg      er ist gebrochen
   */
  function neueWand() {
    const W = { griffe: [], seite: 1, mitte: 0, letzter: null, gold: null };
    hinzu(W, { x: -0.24, y: START_Y - 0.42, r: 0.112, art: "fest", haupt: true });
    W.letzter = hinzu(W, { x: 0.2, y: START_Y, r: 0.112, art: "fest", haupt: true });
    wandBis(W, START_Y + 16);
    return W;
  }

  function hinzu(W, g) {
    const griff = { gold: false, weit: 0, tempo: 0, phase: 0, gepackt: -1, fx: g.x, bricht: -1, weg: false, haupt: false, ...g };
    griff.nr = W.griffe.length;
    // Die Gestalt kommt aus der Nummer – nicht aus dem Zufall, der die Wand baut.
    griff.form = ((griff.nr * 2654435761) >>> 0) / 4294967296;
    W.griffe.push(griff);
    return griff;
  }

  // Der Halbmesser eines Griffs in dieser Höhe: unten gut elf Zentimeter,
  // weit oben sechs – und über 120 Metern schrumpft er langsam weiter.
  function radius(meter) {
    return Math.max(0.046, lerp(0.108, 0.062, schwere(meter)) - 0.00009 * Math.max(0, meter - 120)) * zz(0.93, 1.07);
  }

  function naechsterGriff(W) {
    const v = W.letzter;
    const meter = v.y - START_Y;
    const s = schwere(meter);
    let art = "fest";
    if (meter > AB_PENDEL && zufall.zahl() < clamp((meter - AB_PENDEL) / 90, 0.06, 0.24)) art = "pendel";
    else if (meter > AB_BRUCH && zufall.zahl() < clamp((meter - AB_BRUCH) / 60, 0.08, 0.3)) art = "bruch";
    const weit = art === "pendel" ? zz(0.17, 0.28) : 0;
    // Wie weit der Vorgänger und ein goldener daneben zur Seite stehen können.
    const vor = [{ x: v.x - v.weit, y: v.y }, { x: v.x + v.weit, y: v.y }];
    if (W.gold) vor.push({ x: W.gold.x, y: W.gold.y });
    let x = 0;
    let y = 0;
    for (let versuch = 0; versuch < 30; versuch += 1) {
      // Meist wechselt die Seite, und die Mitte wandert langsam.
      const seite = zufall.zahl() < 0.82 ? -W.seite : W.seite;
      const mitte = clamp(W.mitte + zz(-0.2, 0.2), -0.4, 0.4);
      x = clamp(mitte + seite * zz(0.13, 0.33 + 0.22 * s), -BAHN + weit, BAHN - weit);
      y = v.y + zz(0.42, 0.6) + 0.2 * s;
      // Von überall, wo die Hand zuvor sein kann, in Reichweite – auch an
      // beiden Enden der eigenen Schiene.
      const fern = Math.max(...vor.flatMap((p) => [Math.hypot(x - weit - p.x, y - p.y), Math.hypot(x + weit - p.x, y - p.y)]));
      if (fern <= R_HAUPT || versuch === 29) {
        if (fern > R_HAUPT) {
          // Kein Wurf passte: dicht über den Vorgänger, ohne Schiene.
          x = clamp(v.x + (v.x > 0 ? -0.3 : 0.3), -BAHN, BAHN);
          y = v.y + 0.45;
          art = art === "pendel" ? "fest" : art;
        }
        W.seite = seite;
        W.mitte = mitte;
        break;
      }
    }
    const g = hinzu(W, {
      x, y, r: radius(meter), art, haupt: true,
      weit: art === "pendel" ? weit : 0, tempo: art === "pendel" ? zz(2.1, 3.2) + 0.8 * s : 0, phase: zz(0, TAU),
    });
    W.letzter = g;
    W.gold = null;
    // Ein goldener Griff: ein Stück darüber, zur anderen Seite hin – klein
    // und nur mit Schwung zu holen. Auf Schienen und Bröckelgriffen keiner.
    if (art === "fest" && meter > 5 && zufall.zahl() < 0.24) {
      const gx = clamp(g.x + (g.x > v.x ? 1 : -1) * zz(0.1, 0.32), -BAHN, BAHN);
      const gy = g.y + zz(0.32, 0.4);
      if (Math.hypot(gx - v.x, gy - v.y) > R_STAND + 0.06) {
        W.gold = hinzu(W, { x: gx, y: gy, r: lerp(0.07, 0.052, s), art: "fest", gold: true });
      }
    }
    return g;
  }

  function wandBis(W, y) {
    while (W.letzter.y < y) naechsterGriff(W);
  }

  // Wo ein Griff zur Zeit t ist: auf seiner Schiene unterwegs – oder dort,
  // wo er gepackt wurde.
  function griffOrt(g, t) {
    if (g.art !== "pendel") return { x: g.x, y: g.y };
    if (g.gepackt >= 0) return { x: g.fx, y: g.y };
    return { x: g.x + Math.sin(g.phase + g.tempo * t) * g.weit, y: g.y };
  }

  // Die Wand als Text – für die Prüfung, dass in einem Turnier alle dieselbe bekommen.
  function weltText(W = state.wand) {
    wandBis(W, START_Y + 60);
    return W.griffe.slice(0, 90).map((g) => `${g.art[0]}${g.gold ? "g" : ""}${g.x.toFixed(2)}/${g.y.toFixed(2)}/${g.r.toFixed(3)}`).join(" ");
  }

  // ---------------------------------------------------------------------------
  // Die Kletterin: was zählt
  // ---------------------------------------------------------------------------
  /*
   * Fürs Spiel ist sie zwei Hände an zwei Griffen. Der Griff, den sie zuletzt
   * gepackt hat, ist der Anker: Von ihm aus wird gemessen, was in Reichweite
   * liegt, und die andere Hand ist als nächste dran. Wie sie sich dabei
   * bewegt, ist Sache des Bildes (haltung) – gezählt wird sofort, beim Tipp.
   */
  function neueKletterin() {
    return {
      halt: [0, 1],                // der Griff der linken und der rechten Hand
      dran: 0,                     // welche Hand als nächste greift
      anker: 1,                    // von welchem Griff aus sie reicht
      kraft: 1,
      schwung: 0,
      hoch: 0,                     // die Meter über dem Start
      t: 0,                        // die Uhr der Runde – läuft ab dem ersten Griff
      los: false,
      aus: "",                     // warum sie fiel: "daneben", "kraft", "bruch"
      zuege: 0,
      perfekt: 0,
      kette: 0,                    // perfekte Griffe hintereinander
      spruenge: 0,
    };
  }

  const reichweite = (K) => R_STAND + (R_SPRUNG - R_STAND) * clamp(K.schwung, 0, 1);

  // Ob ein Griff jetzt in Reichweite ist: nicht gebrochen, nicht in der Hand,
  // nicht unter dem Anker, und nah genug.
  function inReichweite(W, K, g, weit = reichweite(K)) {
    if (g.weg || g.nr === K.halt[0] || g.nr === K.halt[1]) return false;
    const a = griffOrt(W.griffe[K.anker], K.t);
    const p = griffOrt(g, K.t);
    return p.y > a.y - 0.12 && Math.hypot(p.x - a.x, p.y - a.y) <= weit;
  }

  // Wie gut ein Tipp sitzt: 2 perfekt, 1 gut, 0 knapp, -1 daneben, -2 er galt
  // diesem Griff nicht.
  function gueteVon(g, abstand) {
    if (abstand <= Math.max(g.r * PERFEKT, PERFEKT_MIN)) return 2;
    if (abstand <= g.r * GUT) return 1;
    if (abstand <= g.r * KNAPP) return 0;
    return abstand <= g.r * DANEBEN ? -1 : -2;
  }

  /*
   * Ein Tipp auf die Stelle (x, y) der Wand. Gesucht wird der Griff, dem er
   * am ehesten galt (gemessen an seiner Grösse), unter allen, die im Bild
   * sein können. Heraus kommt, was geschah:
   *
   *   griff     gepackt – mit Güte, und ob es ein Sprung war
   *   daneben   knapp neben einem Griff in Reichweite: abgerutscht
   *   weit      der Griff ist zu weit weg – nichts geschieht
   *   nichts    der Tipp galt keinem Griff
   */
  function tippe(W, K, x, y) {
    if (K.aus) return { art: "nichts" };
    wandBis(W, y + 6);
    const anker = griffOrt(W.griffe[K.anker], K.t);
    let bester = null;
    let mass = Infinity;
    for (let i = W.griffe.length - 1; i >= 0; i -= 1) {
      const g = W.griffe[i];
      if (g.y < anker.y - 2.5) break;
      if (g.weg || g.nr === K.halt[0] || g.nr === K.halt[1]) continue;
      const p = griffOrt(g, K.t);
      const d = Math.hypot(p.x - x, p.y - y);
      if (d / g.r < mass) { mass = d / g.r; bester = { g, d }; }
    }
    if (!bester) return { art: "nichts" };
    const guete = gueteVon(bester.g, bester.d);
    if (guete === -2) return { art: "nichts" };
    if (!inReichweite(W, K, bester.g)) return { art: "weit", nr: bester.g.nr };
    if (guete === -1) {
      K.aus = "daneben";
      return { art: "daneben", nr: bester.g.nr };
    }
    return greife(W, K, bester.g.nr, guete);
  }

  // Sie packt den Griff: Die Hand, die dran ist, wechselt hinüber, er wird
  // der Anker, und Kraft und Schwung bekommen, was die Güte hergibt.
  function greife(W, K, nr, guete) {
    const g = W.griffe[nr];
    const von = griffOrt(W.griffe[K.anker], K.t);
    const ort = griffOrt(g, K.t);
    const sprung = Math.hypot(ort.x - von.x, ort.y - von.y) > R_STAND;
    const hand = K.dran;
    const s = schwere(ort.y - START_Y);
    K.los = true;
    if (g.gepackt < 0) {
      g.gepackt = K.t;
      g.fx = ort.x;
      if (g.art === "bruch") g.bricht = K.t + lerp(BRUCH_ZEIT[0], BRUCH_ZEIT[1], s);
    }
    K.halt[hand] = nr;
    K.anker = nr;
    K.dran = 1 - hand;
    K.kraft = Math.min(1, K.kraft + (g.gold ? KRAFT_GOLD : KRAFT_PLUS[guete]));
    K.schwung = guete === 0 ? 0 : clamp(K.schwung + SCHWUNG_PLUS[guete], 0, 1);
    // Ein Sprung kostet Schwung: Er ist danach zur Hälfte verbraucht.
    if (sprung) { K.schwung *= 0.5; K.spruenge += 1; }
    K.hoch = Math.max(K.hoch, ort.y - START_Y);
    K.zuege += 1;
    K.kette = guete === 2 ? K.kette + 1 : 0;
    if (guete === 2) K.perfekt += 1;
    wandBis(W, ort.y + 8);
    return { art: "griff", nr, guete, sprung, hand, gold: g.gold };
  }

  // Die Zeit vergeht: Die Kraft läuft ab, der Schwung vergeht, und was
  // bröckelt, bricht. Zurück kommt, was dabei geschah.
  function schritt(W, K, dt) {
    const raus = [];
    if (!K.los || K.aus) return raus;
    K.t += dt;
    const s = schwere(K.hoch);
    K.kraft -= (lerp(KRAFT_AB[0], KRAFT_AB[1], s) + KRAFT_AB_JE_METER * Math.max(0, K.hoch - 80)) * dt;
    K.schwung = Math.max(0, K.schwung - SCHWUNG_AB * dt);
    for (const nr of new Set(K.halt)) {
      const g = W.griffe[nr];
      if (g.bricht >= 0 && !g.weg && K.t >= g.bricht) {
        g.weg = true;
        raus.push({ art: "bruch", nr });
        K.aus = "bruch";
      }
    }
    if (!K.aus && K.kraft <= 0) { K.kraft = 0; K.aus = "kraft"; raus.push({ art: "kraft" }); }
    return raus;
  }

  // Bröckelgriffe, die niemand mehr hält: Sie brechen zu ihrer Zeit (fürs Bild).
  function bruchTakt(W, K) {
    const raus = [];
    const unten = W.griffe[K.anker].y - 4;
    for (let i = W.griffe.length - 1; i >= 0; i -= 1) {
      const g = W.griffe[i];
      if (g.y < unten) break;
      if (g.bricht >= 0 && !g.weg && K.t >= g.bricht && g.nr !== K.halt[0] && g.nr !== K.halt[1]) { g.weg = true; raus.push({ art: "bruch", nr: g.nr }); }
    }
    return raus;
  }

  // Der Pilot: welchen Griff er als Nächsten nähme – den höchsten in
  // Reichweite, lieber einen festen; einen goldenen, wenn die Kraft knapp ist.
  function pilot(W, K) {
    wandBis(W, W.griffe[K.anker].y + 6);
    const anker = griffOrt(W.griffe[K.anker], K.t);
    let bester = null;
    let wert = -Infinity;
    for (let i = W.griffe.length - 1; i >= 0; i -= 1) {
      const g = W.griffe[i];
      if (g.y < anker.y - 1) break;
      if (!inReichweite(W, K, g)) continue;
      const p = griffOrt(g, K.t);
      let w = p.y - anker.y;
      if (g.gold) w += K.kraft < 0.6 ? 0.5 : -0.1;
      if (g.art === "bruch") w -= 0.05;
      if (p.y <= anker.y + 0.05) w -= 2;
      if (w > wert) { wert = w; bester = g; }
    }
    return bester;
  }

  // ---------------------------------------------------------------------------
  // Zustand
  // ---------------------------------------------------------------------------
  // phase: "bereit" (noch kein Griff), "spiel", "zuschauen", "ende"
  const state = {
    phase: "bereit",
    wand: null,
    k: null,               // die Kletterin, wie sie zählt (neueKletterin)
    punkte: 0,
    zeit: 0,               // die Bildzeit – läuft immer
    endet: 0,              // seit wann die Runde endet (Bildzeit), 0: läuft
    stoss: 0,              // das Bild wackelt
    schriften: [],
    ringe: [],             // die Ringe um einen eben getippten Griff
    zone: -1,
  };

  let shell = null;
  let feld = null;
  let canvas = null;
  let hud = null;
  let g = null;
  let frame = null;
  let last = 0;
  let stepTimer = null;
  // Wem zugeschaut wird (live-spiel.js oder ein Lauf aus der Hall of Fame).
  let zuschauer = null;
  // Die Aufzeichnung der Züge (geist.js, zuege).
  let aufnahme = null;

  const view = { dpr: 1, cssW: 0, cssH: 0, frei: 0, pw: 2, ph: 2, guete: 1, fest: false, langsam: 0, schnell: 0, hoch: false };

  function clearStep() {
    if (stepTimer) { window.clearTimeout(stepTimer); stepTimer = null; }
  }

  function stopLoop() {
    if (frame) { window.cancelAnimationFrame(frame); frame = null; }
  }

  // ---------------------------------------------------------------------------
  // Die Kletterin: wie sie sich bewegt
  // ---------------------------------------------------------------------------
  /*
   * Gezählt wird beim Tipp – bewegt wird danach: Jeder Griff kommt in eine
   * Warteschlange, und sie arbeitet sie ab, so schnell sie kann. Fest sind
   * nur die vier Enden: zwei Hände an ihren Griffen, zwei Füsse auf ihren
   * Tritten. Alles dazwischen folgt:
   *
   *   Brust und Becken  hängen an Federn unter den Händen – so pendelt der
   *                     Körper nach, wenn eine Hand zugreift
   *   Ellbogen, Knie    ergeben sich aus den Längen der Glieder (gelenk)
   *   die Füsse         steigen nach, sobald ein Bein zu gestreckt oder zu
   *                     gestaucht ist – auf einen Griff, wenn einer da ist
   *   Kopf              schaut dem Griff nach, zu dem die Hand unterwegs ist
   *   Zopf und Beutel   schwingen als kleine Ketten hinterher
   */
  const GRIFF_VOR = 0.07;            // so weit steht ein Griff aus der Wand
  const fig = {
    hand: [null, null],
    fuss: [null, null],
    brust: [0, 0, 0], brustV: [0, 0, 0],
    becken: [0, 0, 0], beckenV: [0, 0, 0],
    dreh: 0, drehV: 0,
    blick: [0, 0, 0],
    zopf: [], zopfAlt: [],
    beutel: [0, 0, 0], beutelAlt: [0, 0, 0],
    warte: [],
    zug: null,
    fall: null,
    luft: 0,                 // 0: Füsse an der Wand, 1: sie fliegt (Sprung)
    zitter: 0,
    ereignisse: [],          // was das Bild dem Spiel meldet (Hand gelandet …)
  };

  // Wo die Hand einen Griff fasst, und wo ein Fuss darauf steht.
  const fassPunkt = (g, t) => { const p = griffOrt(g, t); return [p.x, p.y + g.r * 0.25, GRIFF_VOR]; };
  const trittPunkt = (g, t) => { const p = griffOrt(g, t); return [p.x, p.y + g.r * 0.7, GRIFF_VOR * 0.9]; };

  function gliedNeu(ort) {
    return { ort: [...ort], von: [...ort], zu: [...ort], k: 1, T: 0.3, bogen: 0.15, nr: -1, spaet: 0 };
  }

  // Sie hängt an den beiden Startgriffen, die Füsse an der Wand.
  function figurNeu() {
    const W = state.wand;
    const K = state.k;
    for (let h = 0; h < 2; h += 1) {
      fig.hand[h] = gliedNeu(fassPunkt(W.griffe[K.halt[h]], 0));
      fig.hand[h].nr = K.halt[h];
    }
    const ziel = ruheZiel();
    fig.brust = [...ziel.brust];
    fig.becken = [...ziel.becken];
    fig.brustV = [0, 0, 0];
    fig.beckenV = [0, 0, 0];
    fig.dreh = 0;
    fig.drehV = 0;
    for (let h = 0; h < 2; h += 1) fig.fuss[h] = gliedNeu(trittFuer(h, ziel.becken));
    fig.blick = [0, fig.brust[1] + 1.4, 0];
    fig.zopf = [];
    for (let i = 0; i <= ZOPF_N; i += 1) fig.zopf.push([fig.brust[0], fig.brust[1] + 0.3 - i * ZOPF_GLIED, fig.brust[2] + 0.12]);
    fig.zopfAlt = fig.zopf.map((p) => [...p]);
    fig.beutel = [fig.becken[0], fig.becken[1] - 0.05, fig.becken[2] + 0.13];
    fig.beutelAlt = [...fig.beutel];
    fig.warte = [];
    fig.zug = null;
    fig.fall = null;
    fig.luft = 0;
    fig.zitter = 0;
    fig.ereignisse = [];
  }

  // Wo Brust und Becken hinwollen, wenn die Hände dort sind, wo sie sind:
  // der untere Arm gebeugt, der obere fast gestreckt, das Becken darunter.
  function ruheZiel(hand = [fig.hand[0].ort, fig.hand[1].ort]) {
    const [L, R] = hand;
    const hoch = Math.max(L[1], R[1]);
    const tief = Math.min(L[1], R[1]);
    const unten = L[1] < R[1] ? L : R;
    let x = (L[0] + R[0]) / 2 * 0.65 + unten[0] * 0.35;
    let y = Math.min(tief - 0.2, hoch - 0.52) - 0.07;
    // Kein Arm darf länger werden, als er ist.
    for (let runde = 0; runde < 3; runde += 1) {
      for (let h = 0; h < 2; h += 1) {
        const seite = h ? 1 : -1;
        const schulter = [x + seite * SCHULTER_HALB, y - 0.05, 0.3];
        const gelenkH = [hand[h][0], hand[h][1] - 0.08, hand[h][2] + 0.05];
        const d = vWeit(schulter, gelenkH);
        const zuviel = d - (ARM_LANG - 0.02);
        if (zuviel > 0) {
          x += ((gelenkH[0] - schulter[0]) / d) * zuviel * 0.6;
          y += ((gelenkH[1] - schulter[1]) / d) * zuviel * 0.6;
        }
      }
    }
    const brust = [x, y, 0.3];
    const becken = [x * 0.9 + unten[0] * 0.1, y - RUMPF_LANG * 0.97, 0.335];
    return { brust, becken };
  }

  // Ein Tritt für den Fuss h unter dem Becken: ein Griff, wenn einer passt –
  // sonst die blanke Wand (auf Reibung).
  function trittFuer(h, becken, hoehe = 0.72) {
    const seite = h ? 1 : -1;
    const wunsch = [becken[0] + seite * 0.2, becken[1] - hoehe, 0.035];
    const W = state.wand;
    let bester = null;
    let mass = 0.26;
    for (let i = W.griffe.length - 1; i >= 0; i -= 1) {
      const q = W.griffe[i];
      if (q.y > wunsch[1] + 0.4) continue;
      if (q.y < wunsch[1] - 0.6) break;
      if (q.weg || q.gold || fig.hand.some((hd) => hd && hd.nr === q.nr) || fig.fuss[1 - h]?.nr === q.nr) continue;
      const p = griffOrt(q, state.k.t);
      const d = Math.hypot((p.x - wunsch[0]) * 1.1, (p.y - wunsch[1]) * 1.4);
      // Nicht über Kreuz: der linke Fuss bleibt links vom Becken.
      if ((p.x - becken[0]) * seite < 0.02) continue;
      if (d < mass) { mass = d; bester = q; }
    }
    if (bester) return Object.assign(trittPunkt(bester, state.k.t), { nr: bester.nr });
    return Object.assign(wunsch, { nr: -1 });
  }

  // Eine Feder, die nicht nachschwingt, bis auf einen Hauch: ort folgt ziel.
  function feder(ort, tempo, ziel, w, d, dt) {
    for (let i = 0; i < 3; i += 1) {
      tempo[i] += ((ziel[i] - ort[i]) * w * w - tempo[i] * 2 * d * w) * dt;
      ort[i] += tempo[i] * dt;
    }
  }

  // Ein Griff aus der Warteschlange wird zur Bewegung.
  function zugBeginnen(z) {
    const W = state.wand;
    const eilig = fig.warte.length > 0;
    const hand = fig.hand[z.hand];
    hand.von = [...hand.ort];
    // Ein Fehlgriff geht dorthin, wo getippt wurde – ins Leere.
    hand.zu = z.fehl ? [...z.ort] : fassPunkt(W.griffe[z.nr], state.k.t);
    hand.k = 0;
    hand.T = (z.sprung ? 0.42 : 0.3) * (eilig ? 0.62 : 1);
    hand.bogen = z.sprung ? 0.24 : 0.15;
    hand.spaet = z.sprung ? 0.3 : 0.08;
    hand.nr = z.fehl ? -1 : z.nr;
    fig.zug = { ...z, t: 0, T: hand.T, gelandet: false };
    if (z.sprung) {
      // Der Sprung: Auch die andere Hand lässt los und fasst daneben nach.
      const andere = fig.hand[1 - z.hand];
      andere.von = [...andere.ort];
      andere.zu = vPlus(hand.zu, [(z.hand ? -1 : 1) * 0.085, -0.02, 0]);
      andere.k = 0;
      andere.T = hand.T * 1.25;
      andere.bogen = 0.2;
      andere.spaet = 0.42;
      andere.nr = z.nr;
      fig.luft = 1;
    }
  }

  function gliedTakt(q, dt) {
    if (q.k >= 1) return false;
    q.k = Math.min(1, q.k + dt / q.T);
    // Erst lösen, dann schnell hinüber, am Schluss abbremsen.
    const e = weich(q.spaet, 1, q.k);
    const u = e * e * (3 - 2 * e) * 0.5 + e * 0.5;
    for (let i = 0; i < 3; i += 1) q.ort[i] = lerp(q.von[i], q.zu[i], u);
    q.ort[2] += Math.sin(Math.PI * u) * q.bogen;
    return q.k >= 1;
  }

  function figurTakt(dt) {
    const K = state.k;
    const W = state.wand;
    if (fig.fall) { fallTakt(dt); kettenTakt(dt); return; }

    // Die Griffe auf Schienen nehmen ihre Hand mit, bis sie gepackt sind –
    // das sind sie immer; und was unter einem Fuss bricht, ist kein Tritt mehr.
    if (!fig.zug && fig.warte.length) zugBeginnen(fig.warte.shift());
    for (let h = 0; h < 2; h += 1) {
      const hand = fig.hand[h];
      if (gliedTakt(hand, dt) && fig.zug && fig.zug.hand === h && !fig.zug.gelandet) {
        fig.zug.gelandet = true;
        fig.ereignisse.push({ art: "gelandet", ...fig.zug });
        // Das Gewicht fällt in die Hand: Brust und Becken sacken kurz nach.
        const wucht = fig.zug.sprung ? 1.6 : 0.5;
        fig.brustV[1] -= wucht * 0.6;
        fig.beckenV[1] -= wucht;
        fig.beckenV[2] += wucht * 0.5;
      }
    }
    if (fig.zug) {
      fig.zug.t += dt;
      if (fig.zug.gelandet && fig.hand[0].k >= 1 && fig.hand[1].k >= 1) fig.zug = null;
    }
    fig.luft = Math.max(0, fig.luft - dt * 2.4);

    // Brust und Becken: an Federn zu ihrer Ruhelage. Beim Sprung federt der
    // Körper härter – er schnellt hoch.
    const ziel = ruheZiel();
    const sprung = fig.zug?.sprung && !fig.zug.gelandet;
    if (sprung) {
      // Erst in die Knie, dann hinauf.
      const u = fig.zug.t / fig.zug.T;
      if (u < 0.26) { ziel.brust[1] -= 0.12; ziel.becken[1] -= 0.2; ziel.becken[2] += 0.08; }
    }
    // Müde Arme zittern.
    fig.zitter = lerp(fig.zitter, K.los && !K.aus && K.kraft < 0.28 ? 1 : 0, 1 - Math.exp(-dt * 6));
    if (fig.zitter > 0.02) {
      ziel.brust[0] += Math.sin(state.zeit * 47) * 0.006 * fig.zitter;
      ziel.brust[1] -= 0.03 * fig.zitter;
      ziel.becken[2] += 0.05 * fig.zitter;
    }
    // Atmen.
    ziel.brust[2] += Math.sin(state.zeit * 2.1) * 0.006;
    feder(fig.brust, fig.brustV, ziel.brust, sprung ? 22 : 17, 0.72, dt);
    feder(fig.becken, fig.beckenV, ziel.becken, sprung ? 15 : 11.5, 0.62, dt);
    // Der Rumpf bleibt so lang, wie er ist.
    const hin = vMinus(fig.becken, fig.brust);
    const lang = vLang(hin) || 1;
    fig.becken = vPlus(fig.brust, vMal(hin, (RUMPF_LANG * 0.97) / lang));

    // Der Rumpf dreht sich der Hand nach, die unterwegs ist.
    let drehZiel = 0;
    for (let h = 0; h < 2; h += 1) if (fig.hand[h].k < 1) drehZiel += (h ? 1 : -1) * 0.34 * Math.sin(Math.PI * fig.hand[h].k);
    fig.drehV += ((drehZiel - fig.dreh) * 190 - fig.drehV * 20) * dt;
    fig.dreh += fig.drehV * dt;

    // Die Füsse: Jeder prüft, ob sein Bein noch passt – und steigt sonst nach.
    for (let h = 0; h < 2; h += 1) {
      const fuss = fig.fuss[h];
      const seite = h ? 1 : -1;
      if (fig.luft > 0.35) {
        // Im Sprung hängen die Beine frei und schwingen nach.
        const frei = [fig.becken[0] + seite * 0.13 - fig.beckenV[0] * 0.05, fig.becken[1] - 0.74 - Math.max(0, fig.beckenV[1]) * 0.04, 0.3 + fig.luft * 0.18];
        for (let i = 0; i < 3; i += 1) fuss.ort[i] = lerp(fuss.ort[i], frei[i], 1 - Math.exp(-dt * 14));
        fuss.k = 1;
        fuss.nr = -1;
        fuss.frei = true;
        continue;
      }
      gliedTakt(fuss, dt);
      if (fuss.k < 1) continue;
      const hueft = [fig.becken[0] + seite * HUEFT_HALB, fig.becken[1], fig.becken[2]];
      const weit = vWeit(hueft, vPlus(fuss.ort, [0, 0.06, 0.1]));
      const tritt = fuss.nr >= 0 ? W.griffe[fuss.nr] : null;
      const anders = fig.fuss[1 - h];
      const zuWeit = weit > BEIN_LANG - 0.035;
      const zuNah = fuss.ort[1] > fig.becken[1] - 0.36;
      const schief = (fuss.ort[0] - fig.becken[0]) * seite < -0.04 || Math.abs(fuss.ort[0] - fig.becken[0]) > 0.5;
      // Immer nur ein Fuss in der Luft – ausser, er hat gar keinen Halt mehr.
      if (fuss.frei || (tritt && tritt.weg) || ((zuWeit || zuNah || schief) && anders.k >= 1)) {
        const neu = trittFuer(h, ruheZiel([fig.hand[0].zu, fig.hand[1].zu]).becken, zuNah ? 0.78 : 0.68);
        fuss.von = [...fuss.ort];
        fuss.zu = [neu[0], neu[1], neu[2]];
        fuss.nr = neu.nr;
        fuss.k = 0;
        fuss.T = fuss.frei ? 0.16 : 0.2;
        fuss.bogen = 0.11;
        fuss.spaet = 0;
        fuss.frei = false;
      }
    }

    // Der Blick: dem Griff nach, zu dem die Hand unterwegs ist – sonst hinauf.
    const anker = W.griffe[K.anker];
    const unterwegs = fig.hand.find((hd) => hd.k < 1);
    const schau = unterwegs ? unterwegs.zu : [griffOrt(anker, K.t).x * 0.6, fig.brust[1] + 1.5, 0];
    for (let i = 0; i < 3; i += 1) fig.blick[i] = lerp(fig.blick[i], schau[i], 1 - Math.exp(-dt * 9));

    kettenTakt(dt);
  }

  // Zopf und Kreidebeutel: kleine Ketten, die an ihrem Ansatz hängen und der
  // Bewegung nachschwingen.
  function kettenTakt(dt) {
    const j = haltungBei();
    const h = Math.min(dt, 1 / 30);
    const zieh = (ort, alt, i) => {
      const v = vMal(vMinus(ort[i], alt[i]), 0.86);
      alt[i] = [...ort[i]];
      ort[i] = vPlus(vPlus(ort[i], v), [0, -9.8 * h * h * 2.2, 0]);
    };
    fig.zopf[0] = [...j.zopfAnsatz];
    for (let i = 1; i <= ZOPF_N; i += 1) zieh(fig.zopf, fig.zopfAlt, i);
    for (let runde = 0; runde < 3; runde += 1) {
      for (let i = 1; i <= ZOPF_N; i += 1) {
        const d = vMinus(fig.zopf[i], fig.zopf[i - 1]);
        fig.zopf[i] = vPlus(fig.zopf[i - 1], vMal(vNorm(d), ZOPF_GLIED));
        // Er liegt auf dem Rücken auf, nicht darin.
        const hinter = j.hinten(fig.zopf[i]);
        if (hinter < 0.035) fig.zopf[i] = vPlus(fig.zopf[i], vMal(j.rueckenAus, 0.035 - hinter));
      }
    }
    const b = [fig.beutel];
    const ba = [fig.beutelAlt];
    zieh(b, ba, 0);
    fig.beutelAlt = ba[0];
    let d = vMinus(b[0], j.beutelAnsatz);
    let ort = vPlus(j.beutelAnsatz, vMal(vNorm(d), 0.125));
    const hinter = j.hinten(ort);
    if (hinter < 0.05) ort = vPlus(ort, vMal(j.rueckenAus, 0.05 - hinter));
    d = vMinus(ort, j.beutelAnsatz);
    fig.beutel = vPlus(j.beutelAnsatz, vMal(vNorm(d), 0.125));
  }

  // Sie fällt: Die Hände gehen auf, der Körper kippt nach hinten weg – bis
  // das Seil sie fängt. Dann sitzt sie im Gurt, die Hände am Seil, und stützt
  // sich mit den Füssen an der Wand ab.
  function fallBeginnen(grund) {
    // Nahe am Boden fällt sie weniger tief: Das Seil ist dort kürzer.
    const tief = Math.max(Math.min(fig.becken[1] - 0.3, 1.05), fig.becken[1] - 3.1);
    fig.fall = {
      t: 0, grund, start: [...fig.becken], tief, fang: false, seit: 0, ruhe: 0,
      // Hände und Füsse fallen mit dem Körper: Ihr Ort zählt von Brust und Becken aus.
      hand: fig.hand.map((q) => vMinus(q.ort, fig.brust)),
      fuss: fig.fuss.map((q) => vMinus(q.ort, fig.becken)),
    };
    fig.zug = null;
    fig.warte = [];
    fig.luft = 0;
    fig.brustV = [0.25 * (Math.random() - 0.5), 0.4, 1.5];
    fig.beckenV = [0, 0.2, 0.7];
  }

  function fallTakt(dt) {
    const f = fig.fall;
    f.t += dt;
    const bremse = Math.min(0.9, (f.start[1] - f.tief) * 0.3);
    // Bis das Seil greift, fällt sie frei; dann fängt es sie weich.
    if (fig.becken[1] > f.tief + bremse && !f.fang) {
      fig.brustV[1] -= 9.8 * dt * 0.85;
      fig.beckenV[1] -= 9.8 * dt;
      for (let i = 0; i < 3; i += 1) { fig.brust[i] += fig.brustV[i] * dt; fig.becken[i] += fig.beckenV[i] * dt; }
      fig.brustV[2] *= 1 - dt * 1.2;
    } else {
      if (!f.fang) { f.fang = true; f.seit = f.t; fig.ereignisse.push({ art: "seil" }); }
      const s = f.t - f.seit;
      // Sie pendelt aus: auf und ab im Seil, hin und her vor der Wand.
      const sitz = [f.start[0] * 0.6, f.tief + Math.sin(s * 3.1) * 0.06 * Math.exp(-s * 0.9), 0.8 + Math.sin(s * 2.2) * 0.13 * Math.exp(-s * 0.6)];
      feder(fig.becken, fig.beckenV, sitz, 7, 0.5, dt);
      feder(fig.brust, fig.brustV, vPlus(fig.becken, [0, RUMPF_LANG * 0.9, 0.2]), 9, 0.6, dt);
      fig.dreh = lerp(fig.dreh, Math.sin(s * 1.5) * 0.22 * Math.exp(-s * 0.5), 1 - Math.exp(-dt * 6));
    }
    const hin = vMinus(fig.brust, fig.becken);
    fig.brust = vPlus(fig.becken, vMal(vNorm(hin), RUMPF_LANG * 0.97));
    f.ruhe = f.fang ? weich(0.05, 0.7, f.t - f.seit) : 0;
    const ruhe = f.ruhe;
    if (!f.fang) fig.dreh *= 1 - dt * 4;
    // Das Seil läuft vorn vom Gurt hinauf – dort fassen die Hände zu.
    const hoch = vNorm(vMinus(fig.brust, fig.becken));
    const aus = vNorm(vKreuz([1, 0, 0], hoch));
    const seilUnten = vPlus(vPlus(fig.becken, vMal(hoch, 0.13)), vMal(aus, -0.11));
    const seilHin = vNorm(vMinus([fig.becken[0] * 0.35, fig.becken[1] + 16, 0.2], seilUnten));
    // Arme und Beine: Im Fallen greifen die Hände noch nach der Wand, die
    // Beine laufen in der Luft; im Seil kommt alles zur Ruhe.
    for (let h = 0; h < 2; h += 1) {
      const seite = h ? 1 : -1;
      const wild = (1 - ruhe) * Math.sin(f.t * 11 + h * 2.4);
      const wild2 = (1 - ruhe) * Math.sin(f.t * 8.3 + h * 3.6 + 1);
      const offen = [seite * (0.33 + 0.05 * wild), 0.4 + 0.13 * wild, -0.1 + 0.1 * wild2];
      // Im Seil: die rechte Hand hoch am Seil, die linke vor der Brust.
      const amSeil = vMinus(vPlus(vPlus(seilUnten, vMal(seilHin, h ? 0.62 : 0.27)), [seite * 0.012, 0, 0]), fig.brust);
      const lauf = [seite * (0.14 + 0.03 * wild), -0.77 + 0.1 * wild2, -0.04 + 0.16 * wild];
      const stemm = [seite * 0.19, -0.3 + 0.04 * h, 0.07 - fig.becken[2]];
      const eile = 1 - Math.exp(-dt * (f.fang ? 7 : 10));
      f.hand[h] = vMisch(f.hand[h], vMisch(offen, amSeil, ruhe), eile);
      f.fuss[h] = vMisch(f.fuss[h], vMisch(lauf, stemm, ruhe), eile);
      fig.hand[h].ort = vPlus(fig.brust, f.hand[h]);
      fig.fuss[h].ort = vPlus(fig.becken, f.fuss[h]);
      fig.hand[h].ort[2] = Math.max(fig.hand[h].ort[2], 0.07);
      fig.fuss[h].ort[2] = Math.max(fig.fuss[h].ort[2], 0.06);
      fig.hand[h].k = 1;
      fig.hand[h].nr = -1;
      fig.fuss[h].k = 1;
      fig.fuss[h].nr = -1;
    }
    f.seilHin = seilHin;
    const hinauf = vPlus(fig.brust, [0, 1.2, -0.4]);
    for (let i = 0; i < 3; i += 1) fig.blick[i] = lerp(fig.blick[i], hinauf[i], 1 - Math.exp(-dt * 5));
  }

  /*
   * Aus dem, was fest ist (Hände, Füsse, Brust, Becken, Drehung, Blick),
   * werden alle Gelenke – in jedem Bild neu.
   */
  function haltungBei() {
    const fallend = Boolean(fig.fall);
    const brust = fig.brust;
    const becken = fig.becken;
    const hoch = vNorm(vMinus(brust, becken));
    // Die Schultern: gedreht der greifenden Hand nach, geneigt zur höheren Hand.
    const neig = fallend ? 0 : clamp((fig.hand[1].ort[1] - fig.hand[0].ort[1]) * 0.32, -0.36, 0.36);
    let breiteS = vNorm([Math.cos(fig.dreh), neig, -Math.sin(fig.dreh)]);
    breiteS = vNorm(vMinus(breiteS, vMal(hoch, vPunkt(breiteS, hoch) * 0.6)));
    let breiteB = vNorm([Math.cos(fig.dreh * 0.35), -neig * 0.3, -Math.sin(fig.dreh * 0.35)]);
    breiteB = vNorm(vMinus(breiteB, vMal(hoch, vPunkt(breiteB, hoch))));
    // Wohin der Rücken zeigt (zur Kamera) – für Zopf und Beutel.
    const rueckenAus = vNorm(vKreuz(breiteS, hoch));

    // Die Wirbelsäule: vom Becken zum Hals, ein wenig ins Hohlkreuz.
    const hals = vPlus(brust, vMal(hoch, 0.06));
    const steuer = vPlus(vPlus(becken, vMal(hoch, RUMPF_LANG * 0.52)), vMal(rueckenAus, -0.035));
    const ruecken = (t) => vPlus(vPlus(vMal(becken, (1 - t) * (1 - t)), vMal(steuer, 2 * t * (1 - t))), vMal(hals, t * t));
    const hinten = (p) => vPunkt(vMinus(p, ruecken(0.8)), rueckenAus);

    const schulter = [vMinus(ruecken(0.9), vMal(breiteS, SCHULTER_HALB)), vPlus(ruecken(0.9), vMal(breiteS, SCHULTER_HALB))];
    const hueft = [vMinus(becken, vMal(breiteB, HUEFT_HALB)), vPlus(becken, vMal(breiteB, HUEFT_HALB))];

    // Die Arme: Wo die Hand fasst, liegt das Handgelenk darunter und davor.
    const ell = [];
    const gelenkH = [];
    const knoechelHand = [];
    const finger = [];
    const zu = [];
    for (let h = 0; h < 2; h += 1) {
      const seite = h ? 1 : -1;
      const hd = fig.hand[h];
      const fest = fallend ? 0 : weich(0.8, 1, hd.k);
      const hin = hd.k < 1 ? vNorm(vMinus(hd.zu, hd.von)) : [0, 1, 0];
      // Im Fallen ist die Hand offen; im Seil liegt sie längs daran.
      const offen = fallend ? vNorm(vMisch(vNorm(vMinus(hd.ort, schulter[h])), fig.fall.seilHin || [0, 1, 0], fig.fall.ruhe)) : hin;
      // Am Griff: Gelenk unten davor, Knöchel oben auf dem Griff, Finger dahinter.
      let gel = vMisch(vMinus(hd.ort, vMal(offen, 0.09)), vPlus(hd.ort, [seite * 0.012, -0.085, 0.045]), fest);
      // Der Arm ist nie länger, als er ist.
      const d = vMinus(gel, schulter[h]);
      const l = vLang(d);
      if (l > ARM_LANG - 0.012) gel = vPlus(schulter[h], vMal(d, (ARM_LANG - 0.012) / l));
      const kn = vMisch(vPlus(gel, vMal(offen, 0.09)), vPlus(hd.ort, [0, 0.006, 0.05]), fest);
      const sp = vMisch(vPlus(gel, vMal(offen, HAND_LANG)), vPlus(hd.ort, [0, 0.05, -0.012]), fest);
      // Der Ellbogen: nach aussen und unten, ein wenig von der Wand weg.
      ell.push(gelenk(schulter[h], gel, OBERARM, UNTERARM, [seite * 0.75, -0.55, 0.45]));
      gelenkH.push(gel);
      knoechelHand.push(kn);
      finger.push(sp);
      zu.push(fest);
    }

    // Die Beine: die Zehen auf dem Tritt, die Ferse davor; die Knie nach aussen.
    const knie = [];
    const knoechel = [];
    const ferse = [];
    const zehe = [];
    const sohle = [];
    for (let h = 0; h < 2; h += 1) {
      const seite = h ? 1 : -1;
      const fu = fig.fuss[h];
      const lose = fallend || fu.frei ? 1 : 0;
      // Im Seil stemmt sie die Sohlen gegen die Wand: die Zehen oben.
      const stemm = fallend ? fig.fall.ruhe : 0;
      let z = [...fu.ort];
      let fe = vPlus(z, vMisch(vMisch([seite * 0.045, 0.04, 0.235], [seite * 0.02, 0.19, 0.14], lose), [0, -0.18, 0.05], stemm));
      let kn = vPlus(fe, vMisch(vMisch([0, 0.07, -0.02], [0, 0.07, 0.02], lose), [0, 0.03, 0.075], stemm));
      // Das Bein ist nie länger, als es ist: Dann hebt sich der Fuss.
      const d = vMinus(kn, hueft[h]);
      const l = vLang(d);
      if (l > BEIN_LANG - 0.012) {
        const zurueck = vMal(d, (BEIN_LANG - 0.012) / l - 1);
        kn = vPlus(kn, zurueck);
        fe = vPlus(fe, zurueck);
        z = vPlus(z, zurueck);
      }
      // Die Knie: an der Wand nach aussen, im Fallen nach vorn, im Seil hinauf.
      let pol = [seite * 0.9, 0.2, 0.62];
      if (fallend) pol = vMisch(vMisch(pol, [seite * 0.45, 0.25, -0.85], weich(0.32, 0.6, becken[2])), [seite * 0.4, 1, 0.15], stemm);
      knie.push(gelenk(hueft[h], kn, OBERSCHENKEL, SCHIENBEIN, pol));
      knoechel.push(kn);
      ferse.push(fe);
      zehe.push(z);
      sohle.push(vNorm(vMisch(vMisch([0, -1, 0.25], [0, -0.6, -0.8], lose), [0, 0.1, -1], stemm)));
    }

    // Der Kopf: über dem Hals; er legt sich in den Nacken, wenn sie hinaufschaut.
    const kopfUngefaehr = vPlus(hals, vMal(hoch, 0.15));
    const schauHin = vNorm(vMinus(fig.blick, kopfUngefaehr));
    let nacken = vNorm(vMinus(hoch, vMal(schauHin, vPunkt(hoch, schauHin))));
    nacken = vNorm(vMisch(hoch, nacken, 0.55));
    const kopf = vPlus(hals, vMal(nacken, 0.15));
    let kopfVor = vMinus(schauHin, vMal(nacken, vPunkt(schauHin, nacken)));
    kopfVor = vLang(kopfVor) < 1e-4 ? vMal(rueckenAus, -1) : vNorm(kopfVor);
    // Nie weiter als zur Seite: Sie verdreht sich den Hals nicht.
    const gerade = vMal(rueckenAus, -1);
    if (vPunkt(kopfVor, gerade) < 0.25) kopfVor = vNorm(vMisch(kopfVor, gerade, 0.6));
    const kopfSeite = vKreuz(nacken, kopfVor);
    const zopfAnsatz = vPlus(vPlus(kopf, vMal(nacken, 0.07)), vMal(kopfVor, -0.085));

    // Der Beutel hängt hinten am Gurt, das Seil vorn.
    const beutelAnsatz = vPlus(ruecken(0.3), vMal(rueckenAus, 0.1));
    const seilUnten = vPlus(ruecken(0.26), vMal(rueckenAus, -0.11));
    const oben = [becken[0] * 0.35, becken[1] + 16, 0.2];
    const straff = fallend ? 1 : 0;
    const seil = [0, 0.03, 0.08, 0.16, 0.3, 0.5, 0.75, 1].map((k) => {
      const p = vMisch(seilUnten, oben, k);
      // Lose hängt es ein wenig durch und liegt am Bauch an.
      const bauch = (1 - straff) * Math.sin(Math.PI * Math.min(1, k * 6)) * 0.03;
      return [p[0] + (1 - straff) * Math.sin(k * Math.PI) * 0.12, p[1], p[2] - bauch];
    });

    return {
      brust, becken, hoch, breiteS, breiteB, rueckenAus, ruecken, hinten, hals, nacken, kopf, kopfVor, kopfSeite,
      schulter, hueft, ell, gelenk: gelenkH, knoechel_hand: knoechelHand, finger, zu,
      knie, knoechel, ferse, zehe, sohle,
      zopf: fig.zopf.length ? fig.zopf : [zopfAnsatz, ...Array.from({ length: ZOPF_N }, (_, i) => vPlus(zopfAnsatz, [0, -(i + 1) * ZOPF_GLIED, 0.02]))],
      zopfAnsatz, beutel: [beutelAnsatz, fig.beutel], beutelAnsatz, seil,
    };
  }

  // ---------------------------------------------------------------------------
  // Die Kletterin: ihr Netz
  // ---------------------------------------------------------------------------
  /*
   * Ein Mensch von hinten, gebaut aus glatten Flächen: der Rumpf Ring um Ring
   * vom Schritt bis zum Hals (breite Schultern, schmale Taille), Arme und
   * Beine als Röhren, die sich an Ellbogen und Knie rund biegen, Hände, die
   * sich um den Griff legen, Kletterschuhe, ein Kopf mit Haar und einem
   * Zopf, der nachschwingt. Sie trägt ein Top mit Ringerrücken, eine lange
   * Hose, den Klettergurt mit Beinschlaufen und hinten den Kreidebeutel; vom
   * Gurt läuft das Seil der Sicherung nach oben.
   *
   * Ihr Netz entsteht in jedem Bild neu aus ihrer Haltung (haltungBei) – die
   * Zahl der Ecken, die Dreiecke, Farben und Stoffe bleiben dabei immer
   * dieselben.
   */
  const vPlus = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
  const vMinus = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const vMal = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
  const vMisch = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
  const vKreuz = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const vPunkt = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const vLang = (a) => Math.hypot(a[0], a[1], a[2]);
  const vNorm = (a) => { const l = vLang(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
  const vWeit = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  // Den Vektor a um die Achse k (Länge 1) drehen.
  const vDreh = (a, k, w) => {
    const c = Math.cos(w);
    const s = Math.sin(w);
    return vPlus(vPlus(vMal(a, c), vMal(vKreuz(k, a), s)), vMal(k, vPunkt(k, a) * (1 - c)));
  };

  // Die Stoffe – das Programm der Figur gibt jedem sein Licht und sein Muster.
  const STOFF = { haut: 0, rumpf: 1, hose: 2, schuh: 3, haar: 4, gurt: 5, beutel: 6, hand: 7, seil: 8, band: 9 };

  // Ein Netz aus glatten Flächen, das in jedem Bild neu entstehen kann. Jede
  // Fläche ist ein Gitter aus Zeilen und Spalten. Beim ersten Bauen wird der
  // Plan festgehalten (Dreiecke, Farben, Stoffe, wohin jede Fläche schaut);
  // danach schreibt jedes Bauen nur Orte und Richtungen neu, in derselben
  // Reihenfolge. Die Richtung einer Ecke kommt aus ihren Nachbarn.
  const FIGUR_MAX = 7000;
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

  // Ein geschlossener Ring (ein Gurt um den Leib, eine Schlaufe ums Bein):
  // punkte(k) gibt für k von 0 bis 1 die Mitte des Bands, aussen(k) wohin es
  // dick wird, hoch(k) wohin es breit ist.
  function ring(b, teile, punkt, aussen, hoch, dick, breit, wie) {
    b.gitter(teile + 1, 6, (i, j) => {
      const k = (i % teile) / teile;
      const w = (j / 6) * Math.PI * 2;
      return vPlus(punkt(k), vPlus(vMal(aussen(k), Math.cos(w) * dick), vMal(hoch(k), Math.sin(w) * breit)));
    }, (i, j) => wie((i % teile) / teile, (j / 6) * Math.PI * 2));
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
  // pol: wohin es zeigt (das Knie nach aussen, der Ellbogen nach unten).
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

  // Ihre Masse (m).
  const SCHULTER_HALB = 0.185;
  const HUEFT_HALB = 0.1;
  const OBERARM = 0.3;
  const UNTERARM = 0.265;
  const HAND_LANG = 0.17;
  const OBERSCHENKEL = 0.45;
  const SCHIENBEIN = 0.43;
  const RUMPF_LANG = 0.5;            // von den Hüftgelenken bis zum Halsansatz
  const ARM_LANG = OBERARM + UNTERARM;
  const BEIN_LANG = OBERSCHENKEL + SCHIENBEIN;

  // Der Rumpf: wo längs (0 der Schritt, 1 der Halsansatz), halbe Breite,
  // Tiefe zur Wand hin (Bauch, Brust) und zur Kamera hin (Gesäss, Rücken).
  const RUMPF = [
    [-0.16, 0.06, 0.05, 0.055], [-0.1, 0.118, 0.082, 0.098], [0.0, 0.158, 0.09, 0.118], [0.1, 0.166, 0.09, 0.112],
    [0.2, 0.152, 0.086, 0.094], [0.3, 0.134, 0.082, 0.082], [0.4, 0.126, 0.082, 0.078], [0.5, 0.134, 0.088, 0.082],
    [0.6, 0.15, 0.096, 0.09], [0.7, 0.164, 0.102, 0.096], [0.79, 0.172, 0.098, 0.1], [0.87, 0.176, 0.086, 0.098],
    [0.93, 0.15, 0.07, 0.084], [0.975, 0.092, 0.054, 0.062], [1.0, 0.052, 0.046, 0.05],
  ];

  // Die Farben eines Aufzugs: Haut, Top, Hose, Schuhe, Haar, Gurt, Beutel.
  const KLEID = [
    { haut: [0.8, 0.52, 0.38], top: [0.95, 0.26, 0.2], hose: [0.1, 0.14, 0.3], schuh: [0.98, 0.8, 0.12], haar: [0.2, 0.11, 0.06], haar2: [0.5, 0.3, 0.14], gurt: [0.1, 0.42, 0.52], beutel: [0.16, 0.52, 0.6], band: [0.96, 0.96, 0.94] },
    { haut: [0.55, 0.35, 0.25], top: [0.1, 0.62, 0.7], hose: [0.12, 0.11, 0.12], schuh: [0.96, 0.33, 0.2], haar: [0.05, 0.04, 0.04], haar2: [0.16, 0.12, 0.1], gurt: [0.92, 0.72, 0.1], beutel: [0.95, 0.4, 0.2], band: [0.98, 0.8, 0.2] },
    { haut: [0.86, 0.62, 0.5], top: [0.96, 0.96, 0.94], hose: [0.16, 0.24, 0.42], schuh: [0.3, 0.85, 0.5], haar: [0.72, 0.5, 0.22], haar2: [0.95, 0.8, 0.5], gurt: [0.85, 0.2, 0.3], beutel: [0.2, 0.2, 0.25], band: [0.85, 0.2, 0.3] },
  ];
  let kleid = KLEID[0];

  const ZOPF_N = 6;
  const ZOPF_GLIED = 0.058;

  // Das Netz aus der Haltung j, geschrieben mit dem Schreiber b.
  function kletterinBauen(b, j) {
    const F = kleid;
    const ringN = 20;
    // --- Der Rumpf ---------------------------------------------------------
    // Um die Wirbelsäule; unten folgt er dem Becken, oben den Schultern.
    b.gitter(RUMPF.length + 1, ringN, (i, s) => {
      const z = Math.max(0, i - 1);
      const [t, hw, hv, hh] = RUMPF[z];
      const mitte = j.ruecken(i ? t : -0.2);
      if (!i) return mitte;
      const hoch = vNorm(vMinus(j.ruecken(t + 0.04), j.ruecken(t - 0.04)));
      let q = vNorm(vMisch(j.breiteB, j.breiteS, weich(0.2, 0.9, t)));
      q = vNorm(vMinus(q, vMal(hoch, vPunkt(q, hoch))));
      const vorn = vKreuz(hoch, q);
      const w = (s / ringN) * TAU;
      const c = Math.cos(w);
      const sn = Math.sin(w);
      const eckig = (x, e) => Math.sign(x) * Math.pow(Math.abs(x), e);
      // Hinten zwei flache Wölbungen links und rechts der Wirbelsäule.
      const ruecken = sn < 0 ? 1 - 0.1 * Math.exp(-(c * c) / 0.02) * weich(0.25, 0.6, t) : 1;
      return vPlus(mitte, vPlus(vMal(q, eckig(c, 0.82) * hw), vMal(vorn, eckig(sn, 0.86) * (sn > 0 ? hv : hh * ruecken))));
    }, (i, s) => {
      const t = RUMPF[Math.max(0, i - 1)][0];
      const w = (s / ringN) * TAU;
      // u: quer (−1 links … 1 rechts), v: längs; das Vorzeichen des Stoffs
      // sagt dem Programm, ob die Ecke hinten liegt.
      return [...F.top, STOFF.rumpf, Math.cos(w) * (Math.sin(w) > 0 ? 1 : -1) * 0.5 + (Math.sin(w) > 0 ? 2 : 0), t];
    });

    // --- Hals und Kopf -----------------------------------------------------
    roehre(b, [vMinus(j.hals, vMal(j.nacken, 0.03)), vPlus(j.hals, vMal(j.nacken, 0.08))], [0.045, 0.043], j.kopfSeite, 10,
      () => [...F.haut, STOFF.haut, 0, 0], 1);
    const kopfPunkt = (breit, hoch, vor, hinten, lat, w) => {
      const c = Math.cos(lat);
      const vz = Math.sin(w);
      return vPlus(j.kopf, vPlus(vPlus(vMal(j.kopfSeite, Math.cos(w) * c * breit), vMal(j.kopfVor, vz * c * (vz > 0 ? vor : hinten))), vMal(j.nacken, Math.sin(lat) * hoch)));
    };
    b.gitter(12, 14, (i, s) => kopfPunkt(0.076, 0.108, 0.094, 0.098, -Math.PI / 2 + (Math.PI * i) / 11, (s / 14) * TAU),
      () => [...F.haut, STOFF.haut, 0, 0]);
    // Die Ohren.
    for (const seite of [-1, 1]) {
      const mitteOhr = vPlus(j.kopf, vPlus(vMal(j.kopfSeite, seite * 0.076), vMal(j.kopfVor, -0.008)));
      roehre(b, [vPlus(mitteOhr, vMal(j.nacken, -0.022)), vPlus(mitteOhr, vMal(j.nacken, 0.024))], [[0.01, 0.018], [0.012, 0.02]], j.kopfSeite, 6,
        () => [...F.haut, STOFF.haut, 0, 0], 1);
    }
    // Das Haar: eine Kappe, hinten bis in den Nacken, vorn bis zur Stirn.
    b.gitter(9, 16, (i, s) => {
      const w = (s / 16) * TAU;
      const vorn = (1 + Math.sin(w)) / 2;
      const ende = -0.62 + 1.25 * Math.pow(vorn, 1.5);
      const lat = Math.PI / 2 - (Math.PI / 2 - ende) * (i / 8);
      const voll = lerp(1.1, 1.02, Math.pow(i / 8, 2));
      return kopfPunkt(0.076 * voll, 0.108 * voll, 0.094 * voll, 0.098 * voll * 1.04, lat, w);
    }, (i, s) => [...F.haar, STOFF.haar, Math.cos((s / 16) * TAU), Math.sin((s / 16) * TAU)], true);
    // Das Stirnband.
    ring(b, 14, (k) => {
      const w = k * TAU;
      return kopfPunkt(0.079, 0.11, 0.097, 0.102, 0.42 - 0.2 * Math.sin(w), w);
    }, (k) => vNorm(vMinus(kopfPunkt(0.079, 0.11, 0.097, 0.102, 0.42 - 0.2 * Math.sin(k * TAU), k * TAU), j.kopf)), () => j.nacken, 0.006, 0.014,
    () => [...F.band, STOFF.band, 0, 0]);
    // Der Zopf: hinten oben am Kopf, Glied um Glied – und das Band darum.
    const zopf = j.zopf;
    const zopfHin = vNorm(vMinus(zopf[1], zopf[0]));
    roehre(b, [vMinus(zopf[0], vMal(zopfHin, 0.012)), vPlus(zopf[0], vMal(zopfHin, 0.02))], [0.03, 0.03], j.kopfSeite, 8,
      () => [...F.band, STOFF.band, 0, 0], 1);
    roehre(b, zopf, [0.024, 0.038, 0.04, 0.036, 0.03, 0.02, 0.008], j.kopfSeite, 9,
      (t, w) => [...vMisch(F.haar, F.haar2, t * t), STOFF.haar, Math.cos(w), Math.sin(w)], 2);

    // --- Die Arme und die Hände --------------------------------------------
    const ARM = [0, 0.07, 0.16, 0.28, 0.4, 0.49, 0.53, 0.58, 0.68, 0.8, 0.92, 1];
    const ARM_R = [[0.06, 0.066], [0.064, 0.072], [0.058, 0.064], [0.052, 0.058], [0.047, 0.05], [0.042, 0.043], [0.041, 0.041], [0.044, 0.047],
      [0.044, 0.049], [0.037, 0.04], [0.03, 0.031], [0.027, 0.025]];
    for (let h = 0; h < 2; h += 1) {
      const seite = h ? 1 : -1;
      const schulter = j.schulter[h];
      const ell = j.ell[h];
      const gelenkH = j.gelenk[h];
      const aussen = vNorm(vPlus(vMal(j.breiteS, seite), [0, 0.2, 0.5]));
      roehre(b, gelenkLinie(schulter, ell, gelenkH, ARM, 0.05), ARM_R, aussen, 10,
        () => [...F.haut, STOFF.haut, 0, 0], 2);
      // Die Hand: vom Gelenk über die Knöchel zu den Fingern. Am Griff legen
      // sich die Finger darüber, in der Luft ist sie offen.
      const dir = vNorm(vMinus(gelenkH, ell));
      const zu = j.zu[h];
      const kn = j.knoechel_hand[h];
      const spitze = j.finger[h];
      const flach = vNorm(vKreuz(vNorm(vMinus(kn, gelenkH)), vMisch([0, 0, 1], dir, 0.3)));
      roehre(b, [vMinus(gelenkH, vMal(dir, 0.01)), vMisch(gelenkH, kn, 0.55), kn, vMisch(kn, spitze, 0.55), spitze],
        [[0.028, 0.02], [0.04, 0.02], [0.042, 0.017], [0.038, 0.014], [0.026, 0.011]], flach, 8,
        (t) => [...vMisch(F.haut, [0.95, 0.94, 0.9], 0.35 + 0.4 * t), STOFF.hand, t, zu], 2);
      // Der Daumen.
      const daumen = vPlus(vMisch(gelenkH, kn, 0.45), vMal(flach, -seite * 0.036));
      roehre(b, [daumen, vPlus(vPlus(daumen, vMal(flach, -seite * 0.03)), vMal(vNorm(vMinus(spitze, kn)), 0.035))], [0.014, 0.011], dir, 6,
        () => [...vMisch(F.haut, [0.95, 0.94, 0.9], 0.4), STOFF.hand, 0.5, zu], 1);
    }

    // --- Die Beine und die Schuhe ------------------------------------------
    const BEIN = [0, 0.08, 0.18, 0.28, 0.38, 0.46, 0.5, 0.54, 0.6, 0.68, 0.78, 0.88, 0.96, 1];
    const BEIN_R = [[0.09, 0.1], [0.094, 0.104], [0.09, 0.098], [0.082, 0.087], [0.071, 0.074], [0.061, 0.063], [0.057, 0.059], [0.058, 0.061],
      [0.06, 0.068], [0.059, 0.07], [0.051, 0.058], [0.041, 0.043], [0.036, 0.037], [0.036, 0.036]];
    for (let h = 0; h < 2; h += 1) {
      const seite = h ? 1 : -1;
      roehre(b, gelenkLinie(j.hueft[h], j.knie[h], j.knoechel[h], BEIN, 0.07), BEIN_R, vMal(j.breiteB, seite), 12,
        (t, w) => (t < 0.84 ? [...F.hose, STOFF.hose, Math.cos(w), t] : [...F.haut, STOFF.haut, 0, 0]), 2);
      // Der Schuh: von der Ferse zur Spitze, die Sohle dunkel.
      const ferse = j.ferse[h];
      const zehe = j.zehe[h];
      const fussHin = vNorm(vMinus(zehe, ferse));
      const sohle = j.sohle[h];
      const querF = vNorm(vKreuz(fussHin, sohle));
      roehre(b, [ferse, vMisch(ferse, zehe, 0.3), vMisch(ferse, zehe, 0.68), zehe],
        [[0.038, 0.04], [0.045, 0.044], [0.05, 0.034], [0.03, 0.02]], querF, 10,
        (t, w) => [...F.schuh, STOFF.schuh, Math.sin(w), t], 2);
      // Die Beinschlaufe des Gurts.
      const oben = vMisch(j.hueft[h], j.knie[h], 0.2);
      const beinHin = vNorm(vMinus(j.knie[h], j.hueft[h]));
      const q1 = vNorm(vMinus(vMal(j.breiteB, seite), vMal(beinHin, vPunkt(vMal(j.breiteB, seite), beinHin))));
      const q2 = vKreuz(beinHin, q1);
      ring(b, 12, (k) => vPlus(oben, vPlus(vMal(q1, Math.cos(k * TAU) * 0.088), vMal(q2, Math.sin(k * TAU) * 0.094))),
        (k) => vPlus(vMal(q1, Math.cos(k * TAU)), vMal(q2, Math.sin(k * TAU))), () => beinHin, 0.006, 0.019,
        () => [...F.gurt, STOFF.gurt, 0, 0]);
    }

    // --- Der Gurt, der Beutel, das Seil ------------------------------------
    {
      const t = 0.3;
      const mitte = j.ruecken(t);
      const hoch = vNorm(vMinus(j.ruecken(t + 0.04), j.ruecken(t - 0.04)));
      let q = vNorm(vMisch(j.breiteB, j.breiteS, 0.2));
      q = vNorm(vMinus(q, vMal(hoch, vPunkt(q, hoch))));
      const vorn = vKreuz(hoch, q);
      const rand = (k) => vPlus(vMal(q, Math.cos(k * TAU) * 0.142), vMal(vorn, Math.sin(k * TAU) * 0.092));
      ring(b, 18, (k) => vPlus(mitte, rand(k)), (k) => vNorm(rand(k)), () => hoch, 0.007, 0.026,
        () => [...F.gurt, STOFF.gurt, 0, 0]);
    }
    // Der Kreidebeutel hängt hinten am Gurt und schwingt mit.
    const beutel = j.beutel;
    const beutelHin = vNorm(vMinus(beutel[1], beutel[0]));
    roehre(b, [beutel[0], vPlus(beutel[0], vMal(beutelHin, 0.035)), vPlus(beutel[0], vMal(beutelHin, 0.09)), beutel[1]],
      [[0.04, 0.03], [0.058, 0.046], [0.062, 0.05], [0.045, 0.038]], j.breiteB, 10,
      (t) => (t < 0.18 ? [...F.band, STOFF.band, 0, 0] : [...F.beutel, STOFF.beutel, t, 0]), 2);
    // Das Seil der Sicherung: vorn am Gurt, hinauf bis über das Bild.
    roehre(b, j.seil, j.seil.map(() => 0.0075), [1, 0, 0], 5, (t) => [0.95, 0.35, 0.2, STOFF.seil, t, 0], 1);
  }

  // ---------------------------------------------------------------------------
  // Die Kamera
  // ---------------------------------------------------------------------------
  // Sie steht schräg rechts hinter der Kletterin, ein wenig unter ihr, und
  // schaut an ihr vorbei die Wand hinauf – so sieht man den Turm als Körper
  // und rechts daneben das Tal.
  const WAND_HALB = 1.25;          // halbe Breite des Turms (m)
  const WAND_TIEF = 2.6;           // so tief ist er
  const kam = {
    x: 0, y: 0, auge: [0, 0, 5], ziel: [0, 0, 0], pv: new Float32Array(16), inv: new Float32Array(16),
    sicht: new Float32Array(16), proj: new Float32Array(16),
  };

  function perspektive(aus, fovy, seiten, nah, fern) {
    const f = 1 / Math.tan(fovy / 2);
    aus.fill(0);
    aus[0] = f / seiten;
    aus[5] = f;
    aus[10] = (fern + nah) / (nah - fern);
    aus[11] = -1;
    aus[14] = (2 * fern * nah) / (nah - fern);
  }

  function blickAuf(aus, auge, ziel, oben) {
    const z = vNorm(vMinus(auge, ziel));
    const x = vNorm(vKreuz(oben, z));
    const y = vKreuz(z, x);
    aus[0] = x[0]; aus[1] = y[0]; aus[2] = z[0]; aus[3] = 0;
    aus[4] = x[1]; aus[5] = y[1]; aus[6] = z[1]; aus[7] = 0;
    aus[8] = x[2]; aus[9] = y[2]; aus[10] = z[2]; aus[11] = 0;
    aus[12] = -vPunkt(x, auge); aus[13] = -vPunkt(y, auge); aus[14] = -vPunkt(z, auge); aus[15] = 1;
  }

  function mal4(aus, a, b) {
    for (let s = 0; s < 4; s += 1) {
      for (let z = 0; z < 4; z += 1) {
        aus[s * 4 + z] = a[z] * b[s * 4] + a[4 + z] * b[s * 4 + 1] + a[8 + z] * b[s * 4 + 2] + a[12 + z] * b[s * 4 + 3];
      }
    }
  }

  function umkehr4(aus, m) {
    const inv = new Float64Array(16);
    inv[0] = m[5] * m[10] * m[15] - m[5] * m[11] * m[14] - m[9] * m[6] * m[15] + m[9] * m[7] * m[14] + m[13] * m[6] * m[11] - m[13] * m[7] * m[10];
    inv[4] = -m[4] * m[10] * m[15] + m[4] * m[11] * m[14] + m[8] * m[6] * m[15] - m[8] * m[7] * m[14] - m[12] * m[6] * m[11] + m[12] * m[7] * m[10];
    inv[8] = m[4] * m[9] * m[15] - m[4] * m[11] * m[13] - m[8] * m[5] * m[15] + m[8] * m[7] * m[13] + m[12] * m[5] * m[11] - m[12] * m[7] * m[9];
    inv[12] = -m[4] * m[9] * m[14] + m[4] * m[10] * m[13] + m[8] * m[5] * m[14] - m[8] * m[6] * m[13] - m[12] * m[5] * m[10] + m[12] * m[6] * m[9];
    inv[1] = -m[1] * m[10] * m[15] + m[1] * m[11] * m[14] + m[9] * m[2] * m[15] - m[9] * m[3] * m[14] - m[13] * m[2] * m[11] + m[13] * m[3] * m[10];
    inv[5] = m[0] * m[10] * m[15] - m[0] * m[11] * m[14] - m[8] * m[2] * m[15] + m[8] * m[3] * m[14] + m[12] * m[2] * m[11] - m[12] * m[3] * m[10];
    inv[9] = -m[0] * m[9] * m[15] + m[0] * m[11] * m[13] + m[8] * m[1] * m[15] - m[8] * m[3] * m[13] - m[12] * m[1] * m[11] + m[12] * m[3] * m[9];
    inv[13] = m[0] * m[9] * m[14] - m[0] * m[10] * m[13] - m[8] * m[1] * m[14] + m[8] * m[2] * m[13] + m[12] * m[1] * m[10] - m[12] * m[2] * m[9];
    inv[2] = m[1] * m[6] * m[15] - m[1] * m[7] * m[14] - m[5] * m[2] * m[15] + m[5] * m[3] * m[14] + m[13] * m[2] * m[7] - m[13] * m[3] * m[6];
    inv[6] = -m[0] * m[6] * m[15] + m[0] * m[7] * m[14] + m[4] * m[2] * m[15] - m[4] * m[3] * m[14] - m[12] * m[2] * m[7] + m[12] * m[3] * m[6];
    inv[10] = m[0] * m[5] * m[15] - m[0] * m[7] * m[13] - m[4] * m[1] * m[15] + m[4] * m[3] * m[13] + m[12] * m[1] * m[7] - m[12] * m[3] * m[5];
    inv[14] = -m[0] * m[5] * m[14] + m[0] * m[6] * m[13] + m[4] * m[1] * m[14] - m[4] * m[2] * m[13] - m[12] * m[1] * m[6] + m[12] * m[2] * m[5];
    inv[3] = -m[1] * m[6] * m[11] + m[1] * m[7] * m[10] + m[5] * m[2] * m[11] - m[5] * m[3] * m[10] - m[9] * m[2] * m[7] + m[9] * m[3] * m[6];
    inv[7] = m[0] * m[6] * m[11] - m[0] * m[7] * m[10] - m[4] * m[2] * m[11] + m[4] * m[3] * m[10] + m[8] * m[2] * m[7] - m[8] * m[3] * m[6];
    inv[11] = -m[0] * m[5] * m[11] + m[0] * m[7] * m[9] + m[4] * m[1] * m[11] - m[4] * m[3] * m[9] - m[8] * m[1] * m[7] + m[8] * m[3] * m[5];
    inv[15] = m[0] * m[5] * m[10] - m[0] * m[6] * m[9] - m[4] * m[1] * m[10] + m[4] * m[2] * m[9] + m[8] * m[1] * m[6] - m[8] * m[2] * m[5];
    const det = m[0] * inv[0] + m[1] * inv[4] + m[2] * inv[8] + m[3] * inv[12];
    for (let i = 0; i < 16; i += 1) aus[i] = inv[i] / (det || 1);
  }

  // Die Kamera folgt ihr weich; im Sturz bleibt sie ein Stück zurück.
  function kameraTakt(dt, sofort = false) {
    const zx = fig.brust[0] * 0.55;
    const zy = fig.becken[1] + 1.2;
    const k = sofort ? 1 : 1 - Math.exp(-dt * (fig.fall ? 2.2 : 5.5));
    kam.x = lerp(kam.x, zx, k);
    kam.y = lerp(kam.y, zy, k);
  }

  function kameraStellen() {
    const seiten = view.pw / view.ph;
    const wackel = state.stoss > 0 ? [Math.sin(state.zeit * 61) * state.stoss * 0.03, Math.cos(state.zeit * 53) * state.stoss * 0.03] : [0, 0];
    // Sie atmet mit: ein Hauch Bewegung, auch wenn nichts geschieht.
    const schweb = ruhig() ? 0 : Math.sin(state.zeit * 0.5) * 0.06;
    kam.ziel = [kam.x + 0.42 + wackel[0], kam.y + wackel[1], 0.1];
    kam.auge = [kam.x + 1.95 + schweb, kam.y - 1.05, 6.9];
    const weit = vWeit(kam.auge, kam.ziel);
    // Quer mindestens gut drei Meter Wand, hoch mindestens viereinhalb.
    const fovy = 2 * Math.atan(Math.max(1.56 / seiten, 2.3) / weit);
    perspektive(kam.proj, fovy, seiten, 0.3, 900);
    blickAuf(kam.sicht, kam.auge, kam.ziel, [0, 1, 0]);
    mal4(kam.pv, kam.proj, kam.sicht);
    umkehr4(kam.inv, kam.pv);
  }

  // Wo ein Punkt der Welt im Bild liegt (in CSS-Pixeln) – für die Anzeige.
  function imBild(p) {
    const m = kam.pv;
    const w = m[3] * p[0] + m[7] * p[1] + m[11] * p[2] + m[15];
    const x = (m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12]) / w;
    const y = (m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13]) / w;
    return { x: (x * 0.5 + 0.5) * view.cssW, y: (0.5 - y * 0.5) * view.cssH, vorn: w > 0 };
  }

  // Wo ein Tipp im Bild die Wand trifft (auf der Höhe der Griffe).
  function aufWand(px, py) {
    const nx = (px / view.cssW) * 2 - 1;
    const ny = 1 - (py / view.cssH) * 2;
    const m = kam.inv;
    const punkt = (z) => {
      const w = m[3] * nx + m[7] * ny + m[11] * z + m[15];
      return [(m[0] * nx + m[4] * ny + m[8] * z + m[12]) / w, (m[1] * nx + m[5] * ny + m[9] * z + m[13]) / w, (m[2] * nx + m[6] * ny + m[10] * z + m[14]) / w];
    };
    const a = punkt(-1);
    const b = punkt(1);
    const k = (GRIFF_VOR * 0.6 - a[2]) / ((b[2] - a[2]) || 1e-9);
    return { x: a[0] + (b[0] - a[0]) * k, y: a[1] + (b[1] - a[1]) * k };
  }

  // ---------------------------------------------------------------------------
  // Die Stimmungen
  // ---------------------------------------------------------------------------
  // Drei Bilder derselben Welt: der Abend über dem Tal, die Arena bei Nacht,
  // der Morgen am Fels. Jede sagt, woher das Licht kommt und in welchen
  // Farben, wie die Wand gemacht ist und was am Horizont steht.
  const STIMMUNG = {
    abend: {
      sonne: [0.66, 0.3, 0.69], sonnenBild: [0.05, 0.17, -1], licht: [1.3, 1.08, 0.72], himmelLicht: [0.27, 0.36, 0.56], gegen: [0.42, 0.42, 0.72],
      zenit: [0.1, 0.17, 0.45], horizont: [0.99, 0.62, 0.42], glut: [1.0, 0.42, 0.2], dichte: 0.018,
      wand: [0.74, 0.73, 0.71], flanke: [0.2, 0.22, 0.28], wandArt: 0, berg: [0.2, 0.2, 0.42], bergLicht: [1.0, 0.62, 0.52], tal: [0.2, 0.3, 0.22], wolke: [1.0, 0.66, 0.5], sterne: 0.0, nacht: 0,
    },
    nacht: {
      sonne: [0.5, 0.52, 0.69], sonnenBild: [0.2, 0.5, -0.8], licht: [1.25, 1.3, 1.5], himmelLicht: [0.1, 0.13, 0.26], gegen: [1.0, 0.25, 0.75],
      zenit: [0.012, 0.016, 0.05], horizont: [0.09, 0.07, 0.2], glut: [0.4, 0.14, 0.42], dichte: 0.03,
      wand: [0.34, 0.36, 0.42], flanke: [0.08, 0.09, 0.12], wandArt: 0, berg: [0.03, 0.035, 0.08], bergLicht: [0.1, 0.12, 0.24], tal: [0.025, 0.03, 0.06], wolke: [0.2, 0.2, 0.36], sterne: 1.0, nacht: 1,
    },
    fels: {
      sonne: [0.6, 0.44, 0.67], sonnenBild: [0.05, 0.2, -1], licht: [1.4, 1.12, 0.86], himmelLicht: [0.36, 0.46, 0.66], gegen: [0.42, 0.52, 0.72],
      zenit: [0.16, 0.36, 0.72], horizont: [0.86, 0.82, 0.78], glut: [1.0, 0.72, 0.5], dichte: 0.014,
      wand: [0.56, 0.5, 0.45], flanke: [0.4, 0.36, 0.33], wandArt: 1, berg: [0.3, 0.36, 0.5], bergLicht: [1.0, 0.86, 0.72], tal: [0.22, 0.32, 0.22], wolke: [1.0, 0.94, 0.9], sterne: 0.0, nacht: 0,
    },
  };
  let stimmung = STIMMUNG.abend;
  // Die Farben der Griffe wechseln alle 25 Meter.
  const ZONEN = [[0.08, 0.72, 0.82], [0.99, 0.78, 0.1], [0.95, 0.24, 0.5], [0.3, 0.8, 0.32], [0.98, 0.5, 0.12], [0.3, 0.46, 0.98], [0.93, 0.22, 0.24], [0.95, 0.95, 0.93]];
  const ZONE_HOCH = 25;
  // Wo im Tal die Wolken liegen.
  const WOLKEN_HOCH = 62;

  // ---------------------------------------------------------------------------
  // Zeichnen: die Programme
  // ---------------------------------------------------------------------------
  let gl = null;
  const bild = { ok: false, verloren: false, prog: {}, netz: {}, rausch: null, ziffern: null, schatten: null, leer: null };

  // Was alle Programme über das Licht wissen.
  const LICHT = `
    // uSonne: woher das Licht auf Wand und Kletterin fällt (schräg von vorn,
    // damit sie einen Schatten wirft). uSonnenBild: wo die Sonne am Himmel
    // steht – tief hinter dem Turm, rechts neben seiner Kante.
    uniform vec3 uSonne, uSonnenBild, uLicht, uHimmelLicht, uGegen, uAuge, uZenit, uHorizont, uGlut;
    uniform float uDichte, uZeit, uNebel, uNacht;
    vec3 himmelGrund(vec3 d) {
      float h = max(d.y, 0.0);
      float zurSonne = max(dot(d, uSonnenBild), 0.0);
      float seite = max(dot(normalize(d.xz + vec2(1e-4)), normalize(uSonnenBild.xz)), 0.0);
      vec3 c = mix(uHorizont, uZenit, 1.0 - pow(1.0 - h, 3.0));
      float band = pow(1.0 - h, 9.0);
      c = mix(c, uGlut, band * (0.25 + 0.75 * pow(seite, 6.0)) * (1.0 - uNacht * 0.4));
      c += uLicht * (pow(zurSonne, 8.0) * 0.22 + pow(zurSonne, 90.0) * 0.5) * (1.0 - uNacht);
      return c;
    }
    vec3 nebelFarbe() { return mix(uHorizont, vec3(1.0), 0.35) * (0.8 - 0.55 * uNacht); }
    vec3 dunst(vec3 farbe, vec3 ort) {
      vec3 hin = ort - uAuge;
      float weit = length(hin);
      vec3 flach = normalize(vec3(hin.x, 0.03, hin.z - 1e-3));
      vec3 c = mix(himmelGrund(flach), farbe, exp(-weit * uDichte));
      return mix(c, nebelFarbe(), uNebel * (1.0 - exp(-weit * 0.22)));
    }
    float hell(vec3 c) { return dot(c, vec3(0.3, 0.59, 0.11)); }
  `;

  // Der Schatten der Kletterin und der Griffe auf der Wand: eine Maske in
  // den Massen der Wand, weich gelesen.
  const SCHATTEN = `
    uniform sampler2D uSchatten;
    uniform vec4 uFenster;         // Mitte (x, y) und halbe Grösse des Fensters der Maske
    float schatten(vec2 xy, float weich) {
      vec2 uv = (xy - uFenster.xy) / (2.0 * uFenster.zw) + 0.5;
      if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) return 0.0;
      float rand = smoothstep(0.0, 0.04, min(min(uv.x, 1.0 - uv.x), min(uv.y, 1.0 - uv.y)));
      return (textureLod(uSchatten, uv, weich).r * 0.62 + textureLod(uSchatten, uv, weich + 1.7).r * 0.38) * rand;
    }
  `;

  // Der Himmel: ein Dreieck über das ganze Bild. Aus der Blickrichtung jedes
  // Punkts entstehen Verlauf, Wolken, Berge in drei Staffeln und das Tal –
  // und, wer hoch genug ist, das Wolkenmeer darunter und die Sterne darüber.
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
    uniform mat4 uInv;
    uniform sampler2D uRausch;
    uniform vec3 uBerg, uBergLicht, uTal, uWolke;
    uniform float uSterne, uWolkenHoch;
    ${LICHT}
    // Ein Kamm längs des Horizonts: Rauschen, zu Graten gefaltet, in vier Lagen.
    float kamm(float az, float f, float saat) {
      float h = 0.0;
      float a = 0.5;
      float summe = 0.0;
      for (int i = 0; i < 4; i += 1) {
        float n = texture(uRausch, vec2(az * f, saat)).r;
        h += (1.0 - abs(n * 2.0 - 1.0) * 1.7) * a;
        summe += a;
        a *= 0.5;
        f *= 2.17;
        saat += 0.173;
      }
      return h / summe;
    }
    void main() {
      vec4 nah = uInv * vec4(vBild, -1.0, 1.0);
      vec4 fern = uInv * vec4(vBild, 1.0, 1.0);
      vec3 d = normalize(fern.xyz / fern.w - nah.xyz / nah.w);
      vec3 c = himmelGrund(d);
      float az = atan(d.x, -d.z);
      float kante = fwidth(d.y) * 1.2 + 1e-5;
      float zurSonne = max(dot(normalize(d.xz + vec2(1e-4)), normalize(uSonne.xz)), 0.0);
      // Sterne, wenn es dunkel ist oder sie sehr hoch ist.
      if (uSterne > 0.01 && d.y > 0.0) {
        vec2 q = d.xz / (d.y + 0.35) * 46.0;
        vec2 zelle = floor(q);
        float z = fract(sin(dot(zelle, vec2(127.1, 311.7))) * 43758.5453);
        vec2 mitte = zelle + 0.5 + (vec2(fract(z * 17.3), fract(z * 91.7)) - 0.5) * 0.7;
        float punkt = smoothstep(0.09, 0.0, length(q - mitte)) * step(0.72, z);
        c += vec3(0.9, 0.95, 1.0) * punkt * uSterne * (0.5 + 0.5 * sin(uZeit * (1.5 + z * 3.0) + z * 40.0)) * smoothstep(0.0, 0.2, d.y);
      }
      // Wolken: lange Bänke über dem Horizont, von unten angeleuchtet, und
      // hohe Schleier darüber.
      if (d.y > 0.0) {
        vec2 q = d.xz / (d.y + 0.1);
        float schleier = texture(uRausch, q * vec2(0.03, 0.07) + vec2(uZeit * 0.0012, 0.0)).r * 0.6 + texture(uRausch, q * 0.11 + vec2(0.3, uZeit * 0.0016)).a * 0.4;
        float bank = texture(uRausch, vec2(az * 0.33 + uZeit * 0.0008, d.y * 2.6)).r * 0.6 + texture(uRausch, vec2(az * 1.1, d.y * 9.0 + 0.4)).a * 0.4;
        float decke = smoothstep(0.52, 0.74, schleier) * smoothstep(0.1, 0.4, d.y) * 0.55
          + smoothstep(0.5, 0.66, bank) * smoothstep(0.02, 0.07, d.y) * smoothstep(0.36, 0.12, d.y) * 0.85;
        vec3 wolke = mix(uWolke * (0.5 + 0.75 * zurSonne), uHimmelLicht * 1.4 + uWolke * 0.3, smoothstep(0.08, 0.5, d.y));
        c = mix(c, wolke, clamp(decke, 0.0, 1.0));
      }
      // Die Sonne selbst: eine Scheibe mit Hof.
      float scheibe = max(dot(d, uSonnenBild), 0.0);
      c += uLicht * (smoothstep(0.99955, 0.99985, scheibe) * 3.0 + pow(scheibe, 900.0) * 0.9) * (1.0 - uNacht);
      // Die Berge: drei Staffeln, jede dunkler und schärfer als die dahinter,
      // an ihrem Fuss der Dunst des Tals. Die fernste trägt Schnee im letzten
      // Licht. Je höher sie klettert, desto tiefer sinken die nahen.
      float hoch = uAuge.y;
      vec3 fernFarbe = himmelGrund(vec3(d.x, 0.03, d.z));
      for (int i = 0; i < 3; i += 1) {
        float fi = float(i);
        float weit = i == 0 ? 9500.0 : (i == 1 ? 3600.0 : 1150.0);
        float gipfel = i == 0 ? 3000.0 : (i == 1 ? 1150.0 : 300.0);
        float fuss = i == 0 ? 700.0 : (i == 1 ? 200.0 : 40.0);
        float f = 0.6 + fi * 0.3;
        float saat = 0.11 + fi * 0.29;
        float k = kamm(az + fi * 1.7, f, saat);
        float hoehe = fuss + (gipfel - fuss) * pow(clamp(k, 0.0, 1.0), 1.35);
        float linie = (hoehe - hoch) / weit;
        float drin = smoothstep(linie + kante, linie - kante, d.y);
        if (drin > 0.0) {
          // Wie hoch am Berg dieser Punkt liegt (0 der Talboden, 1 der höchste Gipfel).
          float amBerg = clamp((d.y * weit + hoch) / gipfel, 0.0, 1.0);
          // Fällt der Kamm zur Sonne hin ab, schaut diese Flanke ins Licht.
          float neig = kamm(az + fi * 1.7 + 0.012, f, saat) - k;
          float besonnt = smoothstep(0.012, -0.012, neig * sign(uSonnenBild.x + 0.001));
          vec3 berg = uBerg * (i == 0 ? 1.55 : (i == 1 ? 1.0 : 0.55));
          berg = mix(berg, uBergLicht * 0.62, besonnt * (i == 0 ? 0.5 : 0.3));
          if (i == 0) {
            float zacke = texture(uRausch, vec2(az * 2.3, amBerg * 1.5)).r - 0.5;
            float schnee = smoothstep(0.34, 0.4, amBerg + zacke * 0.3);
            berg = mix(berg, mix(uHimmelLicht * 1.7 + 0.12, uBergLicht * 1.3, besonnt), schnee);
          } else if (i == 2) {
            // Die nahen Hügel: Wald.
            berg = mix(berg, uTal * (0.55 + 0.5 * texture(uRausch, vec2(az * 5.0, amBerg * 2.2)).a), 0.75);
          }
          float luftig = (i == 0 ? 0.62 : (i == 1 ? 0.4 : 0.14)) + 0.3 * exp(-amBerg * (i == 0 ? 5.0 : 3.0));
          berg = mix(berg, fernFarbe, clamp(luftig, 0.0, 0.94));
          c = mix(c, berg, drin);
        }
      }
      // Das Tal: Wiesen, Wald, ein See, der den Himmel spiegelt – und über 60
      // Metern das Wolkenmeer darin.
      if (d.y < 0.0) {
        float t = hoch / -d.y;
        vec2 xz = uAuge.xz + d.xz * t;
        float fleck = texture(uRausch, xz * 0.0031).r;
        float wald = texture(uRausch, xz * 0.017 + 0.4).r;
        vec3 boden = mix(uTal * 0.9, uTal * 1.3 * vec3(1.1, 1.05, 0.8), smoothstep(0.36, 0.64, fleck));
        boden = mix(boden, uTal * vec3(0.5, 0.66, 0.5), smoothstep(0.5, 0.6, wald) * 0.5 * exp(-t * 0.004));
        boden *= 0.35 + 0.8 * hell(uLicht) * max(uSonne.y, 0.14) * 1.6 + 0.6 * hell(uHimmelLicht);
        // Der See.
        float see = smoothstep(0.6, 0.63, texture(uRausch, xz * 0.0011 + vec2(0.17, 0.63)).r) * smoothstep(120.0, 260.0, length(xz));
        vec3 r = reflect(d, vec3(0.0, 1.0, 0.0));
        vec3 wasser = himmelGrund(normalize(vec3(r.x, abs(r.y) + 0.04, r.z))) * 0.82 + uLicht * pow(max(dot(normalize(r), uSonne), 0.0), 220.0) * 2.0;
        boden = mix(boden, wasser, see);
        // Der Platz um den Turm, und sein langer Schatten.
        vec2 s = xz - vec2(0.0, -1.3);
        float platz = smoothstep(24.0, 21.0, length(s));
        float fliese = smoothstep(0.03, 0.08, abs(fract(length(s) * 0.25) - 0.5)) * 0.2 + 0.8;
        boden = mix(boden, vec3(0.55, 0.52, 0.5) * fliese * (0.35 + 0.9 * hell(uLicht) * max(uSonne.y, 0.14) * 1.5 + 0.5 * hell(uHimmelLicht)), platz);
        vec2 hin = normalize(-uSonne.xz);
        float laengs = dot(s, hin);
        float quer = abs(dot(s, vec2(-hin.y, hin.x)));
        boden *= 1.0 - 0.5 * smoothstep(1.9, 1.2, quer) * step(0.0, laengs) * smoothstep(220.0, 0.0, laengs);
        vec3 tal = mix(himmelGrund(vec3(d.x, 0.03, d.z)), boden, exp(-t * uDichte * 0.07));
        c = mix(c, tal, smoothstep(kante, -kante, d.y));
        if (hoch > uWolkenHoch) {
          float tw = (hoch - uWolkenHoch) / -d.y;
          vec2 q = uAuge.xz + d.xz * tw;
          float w = texture(uRausch, q * 0.0035 + vec2(uZeit * 0.002, 0.0)).r * 0.6 + texture(uRausch, q * 0.012 + 0.2).a * 0.4;
          float decke = smoothstep(0.36, 0.6, w);
          vec3 wolke = uWolke * (0.45 + 0.75 * smoothstep(0.4, 0.8, w)) * (0.5 + 0.6 * hell(uLicht) * 0.5) + uHimmelLicht * 0.4;
          wolke = mix(himmelGrund(vec3(d.x, 0.03, d.z)), wolke, exp(-tw * uDichte * 0.02));
          c = mix(c, wolke, decke * smoothstep(0.0, 8.0, hoch - uWolkenHoch));
        }
      } else if (hoch < uWolkenHoch) {
        // Unter den Wolken: ihre Unterseite zieht als Schleier vorüber.
        float tw = (uWolkenHoch - hoch) / (d.y + 0.02);
        vec2 q = uAuge.xz + d.xz * tw;
        float w = texture(uRausch, q * 0.0035 + vec2(uZeit * 0.002, 0.0)).r * 0.6 + texture(uRausch, q * 0.012 + 0.2).a * 0.4;
        float decke = smoothstep(0.44, 0.7, w) * smoothstep(0.0, 0.25, d.y) * 0.55 * smoothstep(40.0, 4.0, uWolkenHoch - hoch);
        c = mix(c, uWolke * 0.7 + uHimmelLicht * 0.3, decke);
      }
      c = mix(c, nebelFarbe(), uNebel);
      aus = vec4(c, 1.0);
    }`;

  // Der Turm: die Wand vorn und seine beiden Flanken. Aus dem Ort jedes
  // Punkts entstehen die Platten mit ihren Fugen, das Raster der Bohrungen,
  // die raue Oberfläche, die Meterstriche mit ihren Zahlen und die Streifen
  // in der Farbe der Zone.
  const TURM_VS = `#version 300 es
    layout(location = 0) in vec3 aOrt;     // x, y (0 unten, 1 oben), z
    layout(location = 1) in vec3 aNorm;
    uniform mat4 uPV;
    uniform vec2 uSpanne;
    out vec3 vOrt;
    out vec3 vNorm;
    void main() {
      vec3 w = vec3(aOrt.x, mix(uSpanne.x, uSpanne.y, aOrt.y), aOrt.z);
      vOrt = w;
      vNorm = aNorm;
      gl_Position = uPV * vec4(w, 1.0);
    }`;
  const TURM_FS = `#version 300 es
    precision highp float;
    in vec3 vOrt;
    in vec3 vNorm;
    out vec4 aus;
    uniform sampler2D uRausch, uZiffern;
    uniform vec3 uWand, uFlanke;
    uniform vec3 uZone[8];
    uniform float uWandArt, uStart, uZoneHoch, uHalb;
    ${LICHT}
    ${SCHATTEN}
    float ziffer(vec2 uv, float d) {
      if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) return 0.0;
      return texture(uZiffern, vec2((d + uv.x * 0.86 + 0.07) / 10.0, 1.0 - uv.y)).r;
    }
    float zahl(vec2 p, float n) {
      float a = ziffer(p, floor(n / 100.0));
      a = max(a, ziffer(p - vec2(1.0, 0.0), mod(floor(n / 10.0), 10.0)));
      a = max(a, ziffer(p - vec2(2.0, 0.0), mod(n, 10.0)));
      if (n < 100.0) a *= step(1.0, p.x);
      return a;
    }
    void main() {
      vec3 n = normalize(vNorm);
      vec2 p = vOrt.xy;
      float meter = p.y - uStart;
      float vorn = step(0.5, n.z);
      vec3 farbe = uWand;
      vec3 nn = n;
      float glanz = 0.04;
      if (vorn > 0.5) {
        vec4 r1 = texture(uRausch, p * 0.9);
        vec4 r2 = texture(uRausch, p * 3.7 + 0.31);
        if (uWandArt < 0.5) {
          // Platten von 1,25 auf 1,25 Meter, jede einen Hauch anders getönt.
          vec2 pl = vec2(p.x + 0.625, p.y) / 1.25;
          vec2 nr = floor(pl);
          vec2 in1 = fract(pl);
          float ton = fract(sin(dot(nr, vec2(12.9898, 78.233))) * 43758.5453);
          farbe *= 0.9 + 0.16 * ton;
          float fuge = min(min(in1.x, 1.0 - in1.x), min(in1.y, 1.0 - in1.y)) * 1.25;
          float breit = fwidth(p.x) * 1.2 + 0.004;
          farbe *= mix(0.45, 1.0, smoothstep(0.0, breit, fuge));
          farbe *= 1.0 + 0.1 * smoothstep(breit * 3.0, breit, fuge) * step(in1.y, 0.5);
          // Das Raster der Bohrungen, in denen die Griffe sitzen.
          vec2 loch = abs(fract(p / 0.208 + 0.5) - 0.5) * 0.208;
          float lochBreit = fwidth(p.x);
          farbe *= 1.0 - 0.55 * smoothstep(0.011 + lochBreit, 0.011 - lochBreit, length(loch)) * smoothstep(0.02, 0.006, lochBreit);
          // Die raue, gesandete Oberfläche.
          farbe *= 0.9 + 0.2 * (r2.r - 0.5) + 0.12 * (r1.a - 0.5);
          nn = normalize(vec3((r2.g - 0.5) * 0.5, (r2.b - 0.5) * 0.5, 1.0));
        } else {
          // Fels: Schichten, Risse, Flechten.
          vec4 r0 = texture(uRausch, p * vec2(0.21, 0.13));
          float schicht = texture(uRausch, vec2(p.x * 0.12, p.y * 0.55 + r0.r * 0.4)).r;
          farbe *= 0.74 + 0.5 * schicht;
          farbe = mix(farbe, farbe * vec3(1.12, 0.96, 0.82), smoothstep(0.45, 0.7, r0.a));
          float riss = smoothstep(0.035, 0.0, abs(r1.r - 0.5)) * smoothstep(0.4, 0.6, r0.g);
          farbe *= 1.0 - 0.5 * riss;
          farbe = mix(farbe, vec3(0.32, 0.36, 0.24), smoothstep(0.66, 0.78, r2.a) * smoothstep(0.5, 0.7, r0.b) * 0.5);
          nn = normalize(vec3((r1.g - 0.5) * 1.5 + (r2.g - 0.5) * 0.8, (r1.b - 0.5) * 1.5 + (r2.b - 0.5) * 0.8, 1.0));
        }
        // Die Streifen links und rechts der Bahn, in der Farbe der Zone.
        float zone = floor(max(meter, 0.0) / uZoneHoch);
        vec3 zf = uZone[int(mod(zone, 8.0))];
        float streif = smoothstep(0.03, 0.022, abs(abs(p.x) - (uHalb - 0.13)));
        // Jeden Meter ein Strich am Rand, alle fünf einer quer – mit seiner Zahl.
        float rest1 = abs(fract(meter + 0.5) - 0.5);
        float rest5 = abs(fract(meter / 5.0 + 0.5) - 0.5) * 5.0;
        float strich = smoothstep(0.012, 0.006, rest1) * step(uHalb - 0.26, abs(p.x)) * step(abs(p.x), uHalb - 0.13);
        float quer = smoothstep(0.014, 0.008, rest5) * step(abs(p.x), uHalb - 0.13) * step(0.5, meter);
        float m5 = floor(meter / 5.0 + 0.5) * 5.0;
        float ziff = zahl(vec2((p.x + uHalb - 0.36) / 0.17, (p.y - uStart - m5 - 0.05) / 0.3), m5) * step(4.5, m5);
        // Zwei schräge Bänder je Zone, zart in ihrer Farbe – an ihnen sieht
        // man, wie schnell es hinaufgeht.
        float schraeg = fract((meter + p.x * 0.8) / (uZoneHoch * 0.5));
        float band = smoothstep(0.0, 0.004, schraeg) * smoothstep(0.075, 0.071, schraeg) * step(abs(p.x), uHalb - 0.13) * step(0.0, meter);
        farbe = mix(farbe, zf, band * 0.15);
        float farbig = max(max(streif, strich), max(quer * 0.6, ziff));
        farbe = mix(farbe, zf * (0.85 + 0.2 * r2.r), farbig * 0.86);
      } else {
        // Die Flanken: dunkles Blech in Bahnen, mit einer Sicke in jeder.
        float bahn = abs(fract(vOrt.y / 1.25) - 0.5);
        farbe = uFlanke * (0.85 + 0.3 * texture(uRausch, vOrt.zy * 0.7).r);
        farbe *= 0.6 + 0.4 * smoothstep(0.01, 0.03, bahn);
        float sicke = fract(vOrt.z / 0.65);
        nn = normalize(n + vec3(0.0, 0.0, 1.0) * (smoothstep(0.42, 0.5, sicke) - smoothstep(0.5, 0.58, sicke)) * 0.6);
        glanz = 0.55;
      }
      // Unten der Sockel.
      farbe *= mix(0.55, 1.0, smoothstep(0.0, 0.35, vOrt.y));
      vec3 v = normalize(uAuge - vOrt);
      float nl = max(dot(nn, uSonne), 0.0);
      float sch = vorn > 0.5 ? schatten(p, 1.0) : 0.0;
      float sonne = nl * (1.0 - 0.86 * sch);
      vec3 c = farbe * (uHimmelLicht * (0.72 - 0.2 * sch) + uLicht * sonne + uGegen * 0.1 * max(dot(nn, vec3(0.8, 0.1, 0.5)), 0.0));
      vec3 hv = normalize(uSonne + v);
      c += uLicht * pow(max(dot(nn, hv), 0.0), 24.0) * glanz * (1.0 - sch);
      aus = vec4(dunst(c, vOrt), 1.0);
    }`;

  // Ein Griff: eine Kuppe, viele Male – jede von ihrer Zahl anders verformt.
  // Derselbe Körper, flach gedrückt und lang gezogen, ist die Schiene.
  const GRIFF_VS = `#version 300 es
    layout(location = 0) in vec3 aOrt;     // Kuppe: Scheibe (x, y) mit Halbmesser 1, z die Höhe (0 bis 1)
    layout(location = 1) in vec4 iA;       // x, y, Halbmesser, Form
    layout(location = 2) in vec4 iB;       // Art, in Reichweite (0 bis 1), Riss (0 bis 1), Länge der Schiene
    uniform mat4 uPV;
    uniform vec3 uSonne;
    uniform float uFlach, uZeit;
    uniform vec4 uFenster;
    out vec3 vOrt;
    out vec3 vNorm;
    out vec3 vLokal;
    out vec4 vWie;
    out float vForm;
    void main() {
      float f = iA.w;
      float w = atan(aOrt.y, aOrt.x);
      vec3 l = aOrt;
      vec3 nl;
      if (iB.x > 2.5) {
        // Die Schiene: ein flacher Steg.
        l = vec3(aOrt.x * (iB.w + iA.z * 0.5), aOrt.y * 0.03, aOrt.z * 0.012);
        nl = normalize(vec3(aOrt.x * 0.1, aOrt.y, 0.8));
      } else {
        float rund = 1.0 + 0.16 * sin(w * 2.0 + f * 40.0) + 0.1 * sin(w * 3.0 + f * 71.0) + 0.05 * sin(w * 5.0 + f * 13.0);
        float hoch = 0.5 + 0.34 * fract(f * 7.31);
        vec2 schub = vec2(cos(f * 50.0), sin(f * 50.0)) * 0.22 * aOrt.z;
        // Ein Riss lässt ihn zittern.
        float zitter = iB.z * iB.z * 0.05 * sin(uZeit * 70.0 + f * 100.0);
        l = vec3(aOrt.xy * rund * 0.86 + schub + vec2(zitter, 0.0), aOrt.z * hoch) * iA.z;
        float steil = 1.0 - aOrt.z;
        nl = normalize(vec3(aOrt.xy * (0.35 + steil * 1.3), 0.45 + aOrt.z * 0.9));
      }
      vec3 welt = vec3(iA.xy, 0.0) + l;
      vOrt = welt;
      vNorm = nl;
      vLokal = aOrt;
      vWie = iB;
      vForm = f;
      if (uFlach > 0.5) {
        vec2 s = welt.xy - uSonne.xy / uSonne.z * welt.z;
        gl_Position = vec4((s - uFenster.xy) / uFenster.zw, 0.0, 1.0);
      } else {
        gl_Position = uPV * vec4(welt, 1.0);
      }
    }`;
  const GRIFF_FS = `#version 300 es
    precision highp float;
    in vec3 vOrt;
    in vec3 vNorm;
    in vec3 vLokal;
    in vec4 vWie;
    in float vForm;
    out vec4 aus;
    uniform sampler2D uRausch;
    uniform vec3 uZone[8];
    uniform float uFlach, uStart, uZoneHoch;
    ${LICHT}
    ${SCHATTEN}
    void main() {
      if (uFlach > 0.5) { aus = vec4(1.0); return; }
      vec3 n = normalize(vNorm);
      vec3 v = normalize(uAuge - vOrt);
      float art = floor(vWie.x + 0.5);
      float zone = floor(max(vOrt.y - uStart, 0.0) / uZoneHoch);
      vec3 farbe = uZone[int(mod(zone, 8.0))];
      float glanz = 0.5;
      float haerte = 46.0;
      vec3 glueh = vec3(0.0);
      vec4 korn = texture(uRausch, vLokal.xy * 0.6 + vForm * 7.0);
      if (art > 2.5) {
        // Die Schiene: dunkles Metall.
        farbe = vec3(0.16, 0.17, 0.2);
        glanz = 0.9; haerte = 70.0;
      } else {
        farbe *= 0.86 + 0.28 * fract(vForm * 3.7);
        // Kunstharz: gesprenkelt.
        farbe *= 0.88 + 0.24 * korn.r;
        if (art > 1.5) {
          // Auf der Schiene: Streifen quer.
          farbe = mix(farbe, vec3(0.94), step(0.5, fract(vLokal.x * 2.2 + 0.25)) * 0.55);
        } else if (art > 0.5) {
          // Er bröckelt: grauer Stein, von Rissen durchzogen – je länger er
          // gehalten wird, desto mehr.
          farbe = mix(vec3(0.5, 0.47, 0.43), farbe, 0.22) * (0.8 + 0.3 * korn.a);
          float riss = abs(korn.g - 0.5);
          float risse = smoothstep(0.03 + 0.07 * vWie.z, 0.0, riss) + smoothstep(0.02, 0.0, abs(korn.b - 0.5)) * vWie.z;
          farbe *= 1.0 - 0.75 * clamp(risse, 0.0, 1.0);
          glueh += vec3(1.0, 0.3, 0.1) * vWie.z * vWie.z * 0.25 * clamp(risse, 0.0, 1.0);
          glanz = 0.1; haerte = 12.0;
        }
        if (vWie.w > 0.5 && art < 0.5) {
          // Golden.
          farbe = vec3(1.0, 0.78, 0.2) * (0.85 + 0.3 * korn.r);
          glanz = 1.4; haerte = 60.0;
          glueh += vec3(1.0, 0.7, 0.15) * (0.16 + 0.12 * sin(uZeit * 5.0 + vForm * 30.0));
        }
        // Der Bolzen in der Mitte: Dort sitzt der beste Halt.
        float mitte = length(vLokal.xy);
        float bolzen = smoothstep(0.21, 0.17, mitte);
        farbe = mix(farbe, vec3(0.07, 0.07, 0.08), bolzen);
        farbe = mix(farbe, vec3(0.75, 0.77, 0.8), smoothstep(0.1, 0.07, mitte));
        glanz = mix(glanz, 1.2, bolzen);
      }
      // In Reichweite leuchtet er; ausser Reichweite ist er matt und blass.
      float nah = vWie.y;
      farbe = mix(mix(vec3(hell(farbe)), farbe, 0.7) * 0.66, farbe * 1.1, nah);
      float nl = dot(n, uSonne);
      float sch = schatten(vOrt.xy, 1.0);
      float sonne = max((nl + 0.25) / 1.25, 0.0) * (1.0 - 0.8 * sch);
      vec3 c = farbe * (uHimmelLicht * (0.7 + 0.5 * n.y) + uLicht * sonne + vec3(0.2 + 0.14 * nah));
      vec3 hv = normalize(uSonne + v);
      c += uLicht * pow(max(dot(n, hv), 0.0), haerte) * glanz * (1.0 - sch) * step(0.0, nl);
      float rand = pow(1.0 - max(dot(n, v), 0.0), 2.5);
      c += uGegen * rand * 0.35 + farbe * rand * nah * 0.6;
      c += glueh;
      // Der Fuss des Griffs liegt im eigenen Schatten.
      c *= 0.62 + 0.38 * smoothstep(0.0, 0.3, vLokal.z);
      aus = vec4(dunst(c, vOrt), 1.0);
    }`;

  // Die Kletterin.
  const FIGUR_VS = `#version 300 es
    layout(location = 0) in vec3 aOrt;
    layout(location = 1) in vec3 aNorm;
    layout(location = 2) in vec3 aFarbe;
    layout(location = 3) in vec3 aStoff;
    uniform mat4 uPV;
    uniform vec3 uSonne;
    uniform float uFlach;
    uniform vec4 uFenster;
    out vec3 vOrt;
    out vec3 vNorm;
    out vec3 vFarbe;
    out vec3 vStoff;
    void main() {
      vOrt = aOrt;
      vNorm = aNorm;
      vFarbe = aFarbe;
      vStoff = aStoff;
      if (uFlach > 0.5) {
        vec2 s = aOrt.xy - uSonne.xy / uSonne.z * max(aOrt.z, 0.0);
        gl_Position = vec4((s - uFenster.xy) / uFenster.zw, 0.0, 1.0);
      } else {
        gl_Position = uPV * vec4(aOrt, 1.0);
      }
    }`;
  const FIGUR_FS = `#version 300 es
    precision highp float;
    in vec3 vOrt;
    in vec3 vNorm;
    in vec3 vFarbe;
    in vec3 vStoff;
    out vec4 aus;
    uniform float uFlach;
    uniform vec3 uHaut, uHose, uStreif, uWandLicht;
    ${LICHT}
    void main() {
      if (uFlach > 0.5) { aus = vec4(1.0); return; }
      vec3 n = normalize(vNorm);
      vec3 v = normalize(uAuge - vOrt);
      float nv = abs(dot(n, v));
      float art = floor(vStoff.x + 0.5);
      vec3 farbe = vFarbe;
      float glanz = 0.14;
      float haerte = 18.0;
      float weich = 0.32;
      float unter = 0.0;             // wie stark die Haut das Licht durchscheinen lässt
      if (art == 1.0) {
        // Der Rumpf: unten die Hose, darüber das Top mit Ringerrücken, an
        // den Schultern Haut. u: quer, über 1 liegt die Seite zur Wand.
        float hinten = step(vStoff.y, 1.0);
        float u = hinten > 0.5 ? vStoff.y * 2.0 : (vStoff.y - 2.0) * 2.0;
        float t = vStoff.z;
        float traeger = 0.5 + 0.5 * hinten;
        float oben = hinten > 0.5
          ? smoothstep(0.62, 0.9, t) * 0.92          // hinten läuft das Top zur Mitte zusammen
          : smoothstep(0.82, 0.93, t) * 0.5;
        float stoff = 1.0 - smoothstep(traeger - oben - 0.012, traeger - oben + 0.012, abs(u) * 0.5 + 0.0);
        stoff *= 1.0 - smoothstep(0.915, 0.93, t);
        // Ein Streifen Haut zwischen Top und Hose.
        float bauch = smoothstep(0.33, 0.345, t);
        vec3 top = farbe;
        // Die Naht am Rücken und ein heller Rand.
        top = mix(top, top * 1.25 + 0.06, smoothstep(0.03, 0.0, abs(t - 0.36)) * 0.6);
        vec3 hose = uHose;
        hose = mix(hose, uStreif, smoothstep(0.9, 0.93, abs(u)) * hinten * 0.0);
        farbe = t < 0.3 ? hose : mix(uHaut, top, stoff * bauch);
        float haut = t < 0.3 ? 0.0 : 1.0 - stoff * bauch;
        // Die Rinne der Wirbelsäule und die Schulterblätter.
        if (hinten > 0.5) {
          float rinne = exp(-u * u / 0.012) * smoothstep(0.3, 0.45, t) * smoothstep(0.95, 0.8, t);
          farbe *= 1.0 - 0.2 * rinne;
          float blatt = exp(-pow((abs(u) - 0.42) / 0.2, 2.0)) * exp(-pow((t - 0.74) / 0.09, 2.0));
          farbe *= 1.0 + 0.1 * blatt;
        }
        glanz = mix(0.1, 0.16, haut); haerte = mix(10.0, 20.0, haut); weich = mix(0.22, 0.36, haut);
        unter = haut;
      } else if (art == 2.0) {
        // Die Hose: an der Aussenseite ein Streifen.
        farbe = mix(farbe, uStreif, smoothstep(0.93, 0.96, vStoff.y) * 0.9);
        glanz = 0.1; haerte = 9.0; weich = 0.2;
      } else if (art == 3.0) {
        // Der Kletterschuh: unten die schwarze Sohle aus Gummi.
        farbe = mix(farbe, vec3(0.03, 0.03, 0.035), smoothstep(-0.25, -0.45, vStoff.y));
        farbe = mix(farbe, vec3(0.03, 0.03, 0.035), smoothstep(0.82, 0.9, vStoff.z));
        glanz = 0.3; haerte = 30.0; weich = 0.1;
      } else if (art == 4.0) {
        // Haar: Strähnen, vom Licht aufgehellt.
        float w = atan(vStoff.z, vStoff.y);
        float straehne = 0.5 + 0.5 * sin(w * 23.0 + sin(w * 7.0) * 1.5) * sin(w * 41.0 + 1.3);
        farbe *= 0.74 + 0.5 * straehne;
        glanz = 0.42; haerte = 30.0; weich = 0.4;
      } else if (art == 5.0 || art == 8.0) {
        // Gurt und Seil: gewebtes Band.
        farbe *= 0.86 + 0.25 * step(0.5, fract(vStoff.y * 60.0));
        glanz = 0.2; haerte = 20.0; weich = 0.15;
      } else if (art == 6.0) {
        glanz = 0.08; haerte = 8.0; weich = 0.3;
      } else if (art == 7.0) {
        // Die Hände: weiss von der Kreide.
        glanz = 0.05; haerte = 8.0; weich = 0.4; unter = 0.5;
      } else if (art == 9.0) {
        glanz = 0.25; haerte = 22.0;
      } else {
        // Haut.
        glanz = 0.24; haerte = 26.0; weich = 0.3; unter = 1.0;
      }
      float oben = n.y * 0.5 + 0.5;
      float nl = dot(n, uSonne);
      float sonne = max((nl + weich) / (1.0 + weich), 0.0);
      // Was die besonnte Wand zurückwirft, trifft sie von vorn.
      vec3 wand = uWandLicht * max(-n.z, 0.0) * 0.5;
      // Dicht an der Wand ist es dunkler.
      float eng = 1.0 - 0.42 * smoothstep(0.26, 0.02, vOrt.z) * max(-n.z * 0.7 + 0.3, 0.0);
      vec3 c = farbe * ((uHimmelLicht * mix(0.42, 1.0, oben) + wand) * eng + uLicht * sonne * 1.05);
      // Haut lässt das Licht an der Schattengrenze rötlich durchscheinen.
      c += farbe * vec3(0.5, 0.12, 0.06) * unter * smoothstep(0.35, 0.0, abs(nl + 0.08)) * 0.3 * hell(uLicht);
      vec3 hv = normalize(uSonne + v);
      c += uLicht * pow(max(dot(n, hv), 0.0), haerte) * glanz * (haerte + 2.0) / 10.0 * step(0.0, nl);
      // Das Gegenlicht zeichnet ihren Umriss.
      float rand = pow(1.0 - nv, 2.4);
      float gegenSeite = max(dot(n, normalize(vec3(-uSonne.x, 0.25, 0.4))), 0.0);
      c += uGegen * rand * (0.25 + 0.75 * gegenSeite) * 0.85;
      aus = vec4(dunst(c, vOrt), 1.0);
    }`;

  // Kreide, Staub, Splitter, Funken: Scheiben, die zur Kamera schauen.
  const TEIL_VS = `#version 300 es
    layout(location = 0) in vec2 aEcke;
    layout(location = 1) in vec4 iA;      // x, y, z, Grösse
    layout(location = 2) in vec4 iB;      // Art (0 Kreide, 1 Splitter, 2 Funke), Alter (0 bis 1), Saat, Drehung
    uniform mat4 uProj, uSicht;
    out vec2 vEcke;
    out vec3 vOrt;
    out vec4 vWie;
    void main() {
      vec4 p = uSicht * vec4(iA.xyz, 1.0);
      float c = cos(iB.w), s = sin(iB.w);
      p.xy += mat2(c, s, -s, c) * aEcke * iA.w;
      vEcke = aEcke;
      vOrt = iA.xyz;
      vWie = iB;
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
      float art = floor(vWie.x + 0.5);
      float alt = vWie.y;
      if (art == 1.0) {
        // Ein Splitter: eckig, dunkel.
        if (max(abs(vEcke.x) * 1.4 + abs(vEcke.y) * 0.6, abs(vEcke.y)) > 1.0) discard;
        vec3 c = vec3(0.45, 0.42, 0.4) * (0.5 + 0.6 * fract(vWie.z * 7.0)) * (uHimmelLicht + uLicht * 0.6);
        float a = 1.0 - smoothstep(0.75, 1.0, alt);
        aus = vec4(dunst(c, vOrt) * a, a);
        return;
      }
      if (r >= 1.0) discard;
      if (art == 2.0) {
        float a = pow(1.0 - r, 2.0) * (1.0 - alt);
        aus = vec4(vec3(1.0, 0.85, 0.4) * a * 1.6, 0.0);
        return;
      }
      float flocke = texture(uRausch, vEcke * 0.28 + vWie.z * vec2(7.3, 3.1)).a;
      float a = pow(1.0 - r, 1.2) * smoothstep(0.2, 0.8, flocke) * 0.9;
      a *= smoothstep(0.0, 0.08, alt) * (1.0 - alt) * (1.0 - alt);
      vec3 c = vec3(0.97, 0.96, 0.93) * (uHimmelLicht * 0.9 + uLicht * 0.75);
      a = clamp(a, 0.0, 1.0);
      aus = vec4(dunst(c, vOrt) * a, a);
    }`;

  // Der Rand des Bildes dunkelt ab – wie durch ein Objektiv.
  const RAND_VS = `#version 300 es
    out vec2 vBild;
    void main() {
      vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2)) * 2.0 - 1.0;
      vBild = p;
      gl_Position = vec4(p, 0.0, 1.0);
    }`;
  const RAND_FS = `#version 300 es
    precision highp float;
    in vec2 vBild;
    out vec4 aus;
    uniform vec4 uBlitz;           // Farbe und Deckkraft eines Blitzes über das ganze Bild
    void main() {
      float r = dot(vBild * vec2(0.82, 0.74), vBild * vec2(0.82, 0.74));
      float a = smoothstep(0.35, 1.25, r) * 0.5;
      aus = vec4(uBlitz.rgb * uBlitz.a * smoothstep(0.2, 1.3, r), a);
    }`;

  function programm(name, vs, fs) {
    const baue = (art, quelle) => {
      const s = gl.createShader(art);
      gl.shaderSource(s, quelle);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(`Kletterwand, Programm «${name}»: ${gl.getShaderInfoLog(s)}`);
      return s;
    };
    const p = gl.createProgram();
    gl.attachShader(p, baue(gl.VERTEX_SHADER, vs));
    gl.attachShader(p, baue(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(`Kletterwand, Programm «${name}»: ${gl.getProgramInfoLog(p)}`);
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
  const GRIFF_MAX = 160;
  const TEIL_MAX = 400;
  const griffDaten = new Float32Array(GRIFF_MAX * 8);
  const teilDaten = new Float32Array(TEIL_MAX * 8);
  const SCHATTEN_PX = 512;

  // Der Schreiber der Kletterin und ihr Netz in diesem Bild.
  const figur = { schreiber: null, ecken: 0, jetzt: null, statisch: null, index: null };
  function figurPlan() {
    const b = netzSchreiber();
    figur.schreiber = b;
    const leer = new Float32Array(FIGUR_MAX * 6);
    b.anfang(leer);
    kletterinBauen(b, haltungBei());
    figur.ecken = b.ende();
    figur.jetzt = new Float32Array(figur.ecken * 6);
    figur.index = new Uint16Array(b.plan.index);
    figur.statisch = new Float32Array(b.plan.wie);
  }

  // Die Kuppe eines Griffs: Ringe von der Scheibe am Fuss bis zum Scheitel.
  function kuppenNetz() {
    const ringe = 7;
    const spalten = 16;
    const ecken = [];
    const index = [];
    for (let i = 0; i <= ringe; i += 1) {
      const u = i / ringe;
      const r = Math.cos(u * Math.PI / 2);
      const z = Math.sin(u * Math.PI / 2);
      for (let j = 0; j < spalten; j += 1) {
        const w = (j / spalten) * TAU;
        ecken.push(Math.cos(w) * r, Math.sin(w) * r, z);
      }
    }
    for (let i = 0; i < ringe; i += 1) {
      for (let j = 0; j < spalten; j += 1) {
        const a = i * spalten + j;
        const b = i * spalten + ((j + 1) % spalten);
        index.push(a, b, b + spalten, a, b + spalten, a + spalten);
      }
    }
    return { ecken: new Float32Array(ecken), index: new Uint16Array(index) };
  }

  // Immer dieselbe Zahl zu derselben ganzen Zahl – auf jedem Gerät.
  function hashGanz(n) {
    let t = (n + 0x6d2b79f5) | 0;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  // Ein Bild aus Rauschen, das sich wiederholt: in Rot ein weiches Rauschen
  // in mehreren Lagen, in Grün und Blau seine Steigung, in Alpha ein zweites.
  function rauschBild() {
    const N = 256;
    const gitter = (zellen, saat) => {
      const werte = new Float32Array(zellen * zellen);
      for (let i = 0; i < werte.length; i += 1) werte[i] = hashGanz(i * 7919 + saat * 104729);
      return (x, y) => {
        const fx = (x / N) * zellen;
        const fy = (y / N) * zellen;
        const x0 = Math.floor(fx) % zellen;
        const y0 = Math.floor(fy) % zellen;
        const x1 = (x0 + 1) % zellen;
        const y1 = (y0 + 1) % zellen;
        const tx = fx - Math.floor(fx);
        const ty = fy - Math.floor(fy);
        const sx = tx * tx * (3 - 2 * tx);
        const sy = ty * ty * (3 - 2 * ty);
        return lerp(lerp(werte[y0 * zellen + x0], werte[y0 * zellen + x1], sx), lerp(werte[y1 * zellen + x0], werte[y1 * zellen + x1], sx), sy);
      };
    };
    const lagen = [[4, 0.5, 1], [8, 0.25, 2], [16, 0.14, 3], [32, 0.07, 4], [64, 0.04, 5]].map(([z, k, s]) => [gitter(z, s), k]);
    const zweit = [[8, 0.5, 11], [16, 0.3, 12], [64, 0.2, 13]].map(([z, k, s]) => [gitter(z, s), k]);
    const feld = new Float32Array(N * N);
    const feld2 = new Float32Array(N * N);
    for (let y = 0; y < N; y += 1) {
      for (let x = 0; x < N; x += 1) {
        let a = 0;
        let c = 0;
        for (const [f, k] of lagen) a += f(x, y) * k;
        for (const [f, k] of zweit) c += f(x, y) * k;
        feld[y * N + x] = a;
        feld2[y * N + x] = c;
      }
    }
    const px = new Uint8Array(N * N * 4);
    for (let y = 0; y < N; y += 1) {
      for (let x = 0; x < N; x += 1) {
        const i = y * N + x;
        const dx = feld[y * N + ((x + 1) % N)] - feld[y * N + ((x + N - 1) % N)];
        const dy = feld[((y + 1) % N) * N + x] - feld[((y + N - 1) % N) * N + x];
        px[i * 4] = clamp(Math.round(feld[i] * 255), 0, 255);
        px[i * 4 + 1] = clamp(Math.round(128 + dx * 900), 0, 255);
        px[i * 4 + 2] = clamp(Math.round(128 + dy * 900), 0, 255);
        px[i * 4 + 3] = clamp(Math.round(feld2[i] * 255), 0, 255);
      }
    }
    return { N, px };
  }

  // Die zehn Ziffern für die Meterzahlen an der Wand, als Schablone.
  function ziffernBild() {
    const c = document.createElement("canvas");
    c.width = 640;
    c.height = 96;
    const z = c.getContext("2d");
    z.fillStyle = "#000";
    z.fillRect(0, 0, c.width, c.height);
    z.fillStyle = "#fff";
    z.font = "900 92px system-ui, sans-serif";
    z.textAlign = "center";
    z.textBaseline = "middle";
    for (let i = 0; i < 10; i += 1) z.fillText(String(i), i * 64 + 32, 52);
    return c;
  }

  function grafikBauen() {
    const P = bild.prog;
    P.himmel = programm("Himmel", HIMMEL_VS, HIMMEL_FS);
    P.turm = programm("Turm", TURM_VS, TURM_FS);
    P.griff = programm("Griff", GRIFF_VS, GRIFF_FS);
    P.figur = programm("Figur", FIGUR_VS, FIGUR_FS);
    P.teil = programm("Teilchen", TEIL_VS, TEIL_FS);
    P.rand = programm("Rand", RAND_VS, RAND_FS);

    const N = bild.netz;
    // Der Turm: die Wand vorn, die beiden Flanken.
    const H = WAND_HALB;
    const T = -WAND_TIEF;
    const turm = new Float32Array([
      -H, 0, 0, 0, 0, 1, H, 0, 0, 0, 0, 1, H, 1, 0, 0, 0, 1, -H, 0, 0, 0, 0, 1, H, 1, 0, 0, 0, 1, -H, 1, 0, 0, 0, 1,
      H, 0, 0, 1, 0, 0, H, 0, T, 1, 0, 0, H, 1, T, 1, 0, 0, H, 0, 0, 1, 0, 0, H, 1, T, 1, 0, 0, H, 1, 0, 1, 0, 0,
      -H, 0, T, -1, 0, 0, -H, 0, 0, -1, 0, 0, -H, 1, 0, -1, 0, 0, -H, 0, T, -1, 0, 0, -H, 1, 0, -1, 0, 0, -H, 1, T, -1, 0, 0,
    ]);
    N.turm = { vao: gl.createVertexArray(), anzahl: 18 };
    gl.bindVertexArray(N.turm.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, turm, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 24, 0);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 24, 12);

    // Die Griffe: eine Kuppe, viele Male.
    const kuppe = kuppenNetz();
    N.griff = { vao: gl.createVertexArray(), puffer: gl.createBuffer(), anzahl: kuppe.index.length, n: 0 };
    gl.bindVertexArray(N.griff.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, kuppe.ecken, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, kuppe.index, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, N.griff.puffer);
    gl.bufferData(gl.ARRAY_BUFFER, griffDaten.byteLength, gl.DYNAMIC_DRAW);
    for (let i = 0; i < 2; i += 1) {
      gl.enableVertexAttribArray(1 + i);
      gl.vertexAttribPointer(1 + i, 4, gl.FLOAT, false, 32, i * 16);
      gl.vertexAttribDivisor(1 + i, 1);
    }

    // Die Kletterin: ihr Netz kommt in jedem Bild neu.
    if (!figur.schreiber) figurPlan();
    N.figur = { vao: gl.createVertexArray(), puffer: gl.createBuffer(), anzahl: figur.index.length };
    gl.bindVertexArray(N.figur.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, N.figur.puffer);
    gl.bufferData(gl.ARRAY_BUFFER, figur.jetzt.byteLength, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 24, 0);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 24, 12);
    N.figur.stoff = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, N.figur.stoff);
    gl.bufferData(gl.ARRAY_BUFFER, figur.statisch, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(2);
    gl.vertexAttribPointer(2, 3, gl.FLOAT, false, 24, 0);
    gl.enableVertexAttribArray(3);
    gl.vertexAttribPointer(3, 3, gl.FLOAT, false, 24, 12);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, figur.index, gl.STATIC_DRAW);

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

    bild.ziffern = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, bild.ziffern);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, ziffernBild());
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    // Die Maske des Schattens: ein Bild in den Massen der Wand.
    bild.schatten = { textur: gl.createTexture(), puffer: gl.createFramebuffer() };
    gl.bindTexture(gl.TEXTURE_2D, bild.schatten.textur);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, SCHATTEN_PX, SCHATTEN_PX, 0, gl.RED, gl.UNSIGNED_BYTE, null);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.bindFramebuffer(gl.FRAMEBUFFER, bild.schatten.puffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, bild.schatten.textur, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    bild.ok = true;
  }

  // Die Leinwand für die Welt entsteht einmal und bleibt über alle Runden.
  function grafikStarten() {
    canvas = document.createElement("canvas");
    canvas.className = "kw-canvas";
    canvas.setAttribute("aria-hidden", "true");
    hud = document.createElement("canvas");
    hud.className = "kw-hud";
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
  // Teilchen: Kreide, Staub, Splitter, Funken
  // ---------------------------------------------------------------------------
  const teile = [];
  function teil(art, ort, tempo, leben, gross, fall = 0) {
    if (teile.length >= TEIL_MAX) teile.shift();
    teile.push({ art, x: ort[0], y: ort[1], z: ort[2], vx: tempo[0], vy: tempo[1], vz: tempo[2], alt: 0, leben, gross, fall, saat: Math.random(), dreh: Math.random() * TAU, drall: (Math.random() - 0.5) * 8 });
  }

  function kreideWolke(ort, viel = 1) {
    if (ruhig()) return;
    for (let i = 0; i < 7 * viel; i += 1) {
      const w = Math.random() * TAU;
      teil(0, [ort[0], ort[1], ort[2] + 0.04], [Math.cos(w) * 0.35 * Math.random(), Math.sin(w) * 0.3 * Math.random() + 0.1, 0.25 + Math.random() * 0.5], 0.6 + Math.random() * 0.5, 0.07 + Math.random() * 0.09 * viel, 0.25);
    }
  }

  function funken(ort) {
    if (ruhig()) return;
    for (let i = 0; i < 12; i += 1) {
      const w = Math.random() * TAU;
      const v = 0.8 + Math.random() * 1.4;
      teil(2, [ort[0], ort[1], ort[2] + 0.06], [Math.cos(w) * v, Math.sin(w) * v, 0.4 + Math.random() * 0.6], 0.3 + Math.random() * 0.3, 0.03 + Math.random() * 0.03, 1.5);
    }
  }

  function splitter(ort, r) {
    for (let i = 0; i < 14; i += 1) {
      const w = Math.random() * TAU;
      teil(1, [ort[0] + Math.cos(w) * r * 0.5, ort[1] + Math.sin(w) * r * 0.5, 0.05], [Math.cos(w) * 0.9 * Math.random(), Math.random() * 1.2, 0.3 + Math.random() * 1.1], 0.9 + Math.random() * 0.6, r * (0.25 + Math.random() * 0.4), 9.8);
    }
    kreideWolke(ort, 1.6);
  }

  function teileTakt(dt) {
    for (let i = teile.length - 1; i >= 0; i -= 1) {
      const p = teile[i];
      p.alt += dt;
      if (p.alt >= p.leben) { teile.splice(i, 1); continue; }
      p.vy -= p.fall * dt;
      const brems = p.art === 0 ? 1 - Math.min(1, dt * 2.6) : 1;
      p.vx *= brems; p.vy *= brems; p.vz *= brems;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      p.dreh += p.drall * dt;
      if (p.art === 0) p.gross += dt * 0.12;
    }
  }

  // ---------------------------------------------------------------------------
  // Zeichnen: ein Bild
  // ---------------------------------------------------------------------------
  // Was über das Licht gilt – und wie es sich mit der Höhe ändert: In den
  // Wolken wird es neblig, weit oben dunkel, und die Sterne kommen heraus.
  const luft = { nebel: 0, sterne: 0, zenit: [0, 0, 0] };
  function luftStellen() {
    const hoch = kam.auge[1];
    const s = stimmung;
    const drin = Math.exp(-Math.pow((hoch - WOLKEN_HOCH) / 6.5, 2));
    luft.nebel = drin * 0.82;
    const weitOben = weich(140, 320, hoch);
    luft.sterne = Math.max(s.sterne, weitOben);
    for (let i = 0; i < 3; i += 1) luft.zenit[i] = lerp(s.zenit[i], [0.01, 0.015, 0.06][i], weitOben * 0.85);
  }

  function lichtSetzen(p) {
    const s = stimmung;
    gl.uniform3fv(p.ort("uSonne"), vNorm(s.sonne));
    gl.uniform3fv(p.ort("uSonnenBild"), vNorm(s.sonnenBild));
    gl.uniform3fv(p.ort("uLicht"), s.licht);
    gl.uniform3fv(p.ort("uHimmelLicht"), s.himmelLicht);
    gl.uniform3fv(p.ort("uGegen"), s.gegen);
    gl.uniform3fv(p.ort("uAuge"), kam.auge);
    gl.uniform3fv(p.ort("uZenit"), luft.zenit);
    gl.uniform3fv(p.ort("uHorizont"), s.horizont);
    gl.uniform3fv(p.ort("uGlut"), s.glut);
    gl.uniform1f(p.ort("uDichte"), s.dichte);
    gl.uniform1f(p.ort("uZeit"), state.zeit);
    gl.uniform1f(p.ort("uNebel"), luft.nebel);
    gl.uniform1f(p.ort("uNacht"), s.nacht);
  }

  // Die Griffe im Bild – und zu jedem auf einer Schiene die Schiene.
  function griffeSammeln() {
    const W = state.wand;
    const K = state.k;
    const unten = kam.y - 6.5;
    const oben = kam.y + 9.5;
    wandBis(W, oben + 1);
    let n = 0;
    const setze = (x, y, r, form, art, nah, riss, extra) => {
      if (n >= GRIFF_MAX) return;
      const i = n * 8;
      griffDaten[i] = x; griffDaten[i + 1] = y; griffDaten[i + 2] = r; griffDaten[i + 3] = form;
      griffDaten[i + 4] = art; griffDaten[i + 5] = nah; griffDaten[i + 6] = riss; griffDaten[i + 7] = extra;
      n += 1;
    };
    const lebt = !K.aus;
    for (let i = W.griffe.length - 1; i >= 0; i -= 1) {
      const q = W.griffe[i];
      if (q.y > oben) continue;
      if (q.y < unten) break;
      if (q.weg) continue;
      const p = griffOrt(q, K.t);
      const inHand = q.nr === K.halt[0] || q.nr === K.halt[1];
      const ziel = lebt && (inHand || inReichweite(W, K, q)) ? 1 : 0;
      q.nah = lerp(q.nah ?? ziel, ziel, 0.25);
      const riss = q.bricht >= 0 ? clamp((K.t - q.gepackt) / (q.bricht - q.gepackt), 0, 1) : 0;
      if (q.art === "pendel") setze(q.x, q.y, q.r, q.form, 3, 1, 0, q.weit);
      setze(p.x, p.y, q.r, q.form, q.art === "bruch" ? 1 : q.art === "pendel" ? 2 : 0, q.nah, riss, q.gold ? 1 : 0);
    }
    return n;
  }

  function teileSammeln() {
    let n = 0;
    for (const p of teile) {
      if (n >= TEIL_MAX) break;
      const i = n * 8;
      teilDaten[i] = p.x; teilDaten[i + 1] = p.y; teilDaten[i + 2] = p.z; teilDaten[i + 3] = p.gross;
      teilDaten[i + 4] = p.art; teilDaten[i + 5] = p.alt / p.leben; teilDaten[i + 6] = p.saat; teilDaten[i + 7] = p.dreh;
      n += 1;
    }
    return n;
  }

  function zeichneWelt() {
    if (!bild.ok || !gl || gl.isContextLost()) return;
    const P = bild.prog;
    const N = bild.netz;
    kameraStellen();
    luftStellen();
    const s = stimmung;
    const sonne = vNorm(s.sonne);

    // Das Netz der Kletterin für dieses Bild.
    figur.schreiber.anfang(figur.jetzt);
    kletterinBauen(figur.schreiber, haltungBei());
    gl.bindBuffer(gl.ARRAY_BUFFER, N.figur.puffer);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, figur.jetzt);
    const griffe = griffeSammeln();
    gl.bindBuffer(gl.ARRAY_BUFFER, N.griff.puffer);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, griffDaten, 0, griffe * 8);
    const teilchen = teileSammeln();
    gl.bindBuffer(gl.ARRAY_BUFFER, N.teil.puffer);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, teilDaten, 0, teilchen * 8);

    const fenster = [kam.x, fig.becken[1] + 0.6, 3.3, 3.3];
    gl.disable(gl.CULL_FACE);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, bild.rausch);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, bild.schatten.textur);
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, bild.ziffern);
    for (const name of ["himmel", "turm", "griff", "figur", "teil"]) {
      const p = P[name];
      gl.useProgram(p.p);
      lichtSetzen(p);
      gl.uniform1i(p.ort("uRausch"), 0);
      gl.uniform1i(p.ort("uSchatten"), 1);
      gl.uniform1i(p.ort("uZiffern"), 2);
      gl.uniform4fv(p.ort("uFenster"), fenster);
      gl.uniformMatrix4fv(p.ort("uPV"), false, kam.pv);
      gl.uniform1f(p.ort("uStart"), START_Y);
      gl.uniform1f(p.ort("uZoneHoch"), ZONE_HOCH);
      gl.uniform3fv(p.ort("uZone"), ZONEN.flat());
      gl.uniform1f(p.ort("uFlach"), 0);
    }

    // 1. Die Maske des Schattens: Griffe und Kletterin, entlang des Lichts
    //    auf die Wand gelegt.
    gl.bindFramebuffer(gl.FRAMEBUFFER, bild.schatten.puffer);
    gl.viewport(0, 0, SCHATTEN_PX, SCHATTEN_PX);
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.BLEND);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(P.griff.p);
    gl.uniform1f(P.griff.ort("uFlach"), 1);
    gl.bindVertexArray(N.griff.vao);
    gl.drawElementsInstanced(gl.TRIANGLES, N.griff.anzahl, gl.UNSIGNED_SHORT, 0, griffe);
    gl.uniform1f(P.griff.ort("uFlach"), 0);
    gl.useProgram(P.figur.p);
    gl.uniform1f(P.figur.ort("uFlach"), 1);
    gl.bindVertexArray(N.figur.vao);
    gl.drawElements(gl.TRIANGLES, N.figur.anzahl, gl.UNSIGNED_SHORT, 0);
    gl.uniform1f(P.figur.ort("uFlach"), 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.activeTexture(gl.TEXTURE1);
    gl.generateMipmap(gl.TEXTURE_2D);

    // 2. Das Bild: Turm, Griffe, Kletterin – und dahinter der Himmel.
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.depthMask(true);
    gl.clear(gl.DEPTH_BUFFER_BIT);
    gl.useProgram(P.himmel.p);
    gl.uniformMatrix4fv(P.himmel.ort("uInv"), false, kam.inv);
    gl.uniform3fv(P.himmel.ort("uBerg"), s.berg);
    gl.uniform3fv(P.himmel.ort("uBergLicht"), s.bergLicht);
    gl.uniform3fv(P.himmel.ort("uTal"), s.tal);
    gl.uniform3fv(P.himmel.ort("uWolke"), s.wolke);
    gl.uniform1f(P.himmel.ort("uSterne"), luft.sterne);
    gl.uniform1f(P.himmel.ort("uWolkenHoch"), WOLKEN_HOCH);

    gl.useProgram(P.turm.p);
    gl.uniform2f(P.turm.ort("uSpanne"), Math.max(0, kam.y - 70), kam.y + 110);
    gl.uniform3fv(P.turm.ort("uWand"), s.wand);
    gl.uniform3fv(P.turm.ort("uFlanke"), s.flanke);
    gl.uniform1f(P.turm.ort("uWandArt"), s.wandArt);
    gl.uniform1f(P.turm.ort("uHalb"), WAND_HALB);
    gl.bindVertexArray(N.turm.vao);
    gl.drawArrays(gl.TRIANGLES, 0, N.turm.anzahl);

    gl.useProgram(P.griff.p);
    gl.bindVertexArray(N.griff.vao);
    gl.drawElementsInstanced(gl.TRIANGLES, N.griff.anzahl, gl.UNSIGNED_SHORT, 0, griffe);

    gl.useProgram(P.figur.p);
    gl.uniform3fv(P.figur.ort("uHaut"), kleid.haut);
    gl.uniform3fv(P.figur.ort("uHose"), kleid.hose);
    gl.uniform3fv(P.figur.ort("uStreif"), kleid.top);
    gl.uniform3f(P.figur.ort("uWandLicht"), s.wand[0] * s.licht[0] * sonne[2], s.wand[1] * s.licht[1] * sonne[2], s.wand[2] * s.licht[2] * sonne[2]);
    gl.bindVertexArray(N.figur.vao);
    gl.drawElements(gl.TRIANGLES, N.figur.anzahl, gl.UNSIGNED_SHORT, 0);

    // Der Himmel zuletzt: Er füllt nur, was Turm und Kletterin frei lassen.
    gl.useProgram(P.himmel.p);
    gl.bindVertexArray(bild.leer);
    gl.depthMask(false);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.depthMask(true);

    // 3. Kreide und Splitter, und der dunkle Rand des Bildes.
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.depthMask(false);
    if (teilchen) {
      gl.useProgram(P.teil.p);
      gl.uniformMatrix4fv(P.teil.ort("uProj"), false, kam.proj);
      gl.uniformMatrix4fv(P.teil.ort("uSicht"), false, kam.sicht);
      gl.bindVertexArray(N.teil.vao);
      gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, teilchen);
    }
    gl.disable(gl.DEPTH_TEST);
    gl.useProgram(P.rand.p);
    const rot = state.k && state.k.los && !state.k.aus ? weich(0.3, 0.05, state.k.kraft) * (0.5 + 0.5 * Math.sin(state.zeit * 9)) * 0.22 : 0;
    gl.uniform4f(P.rand.ort("uBlitz"), 1, 0.15, 0.1, rot);
    gl.bindVertexArray(bild.leer);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.depthMask(true);
    gl.disable(gl.BLEND);
    gl.bindVertexArray(null);
  }

  // ---------------------------------------------------------------------------
  // Die Fläche
  // ---------------------------------------------------------------------------
  function buildPlatz() {
    feld = shell.el("div", "kw-feld");
    feld.append(canvas, hud);
    if (!bild.ok) {
      feld.append(shell.el("p", "kw-ohne", "Dieses Spiel braucht WebGL 2 – dieser Browser kann das leider nicht."));
    }
    return feld;
  }

  function messen() {
    if (!canvas || !feld) return;
    const cssW = Math.max(80, feld.clientWidth);
    const cssH = Math.max(80, feld.clientHeight);
    const dpr = clamp(window.devicePixelRatio || 1, 1, 2);
    const oben = Math.min(cssH * 0.4, shell?.frei?.(canvas) || 0);
    if (cssW === view.cssW && cssH === view.cssH && dpr === view.dpr && oben === view.frei) return;
    view.cssW = cssW;
    view.cssH = cssH;
    view.dpr = dpr;
    view.frei = oben;
    view.hoch = cssH > cssW * 1.05;
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
  // Die Anzeige
  // ---------------------------------------------------------------------------
  const GUETE_TEXT = ["Knapp", "Gut", "Perfekt!"];
  const GUETE_FARBE = ["#ff9d5c", "#e9f2ff", "#ffd84d"];
  const GRUND_TEXT = { daneben: "Daneben gegriffen", kraft: "Die Kraft war am Ende", bruch: "Der Griff ist gebrochen" };

  function schrift(text, farbe, ort, gross = 20, dauer = 1.1) {
    state.schriften.push({ text, farbe, ort: [...ort], gross, alt: 0, dauer });
    if (state.schriften.length > 8) state.schriften.shift();
  }

  function ringBei(ort, farbe, weit = 1) {
    state.ringe.push({ ort: [...ort], farbe, alt: 0, weit });
    if (state.ringe.length > 10) state.ringe.shift();
  }

  function zeichneHud() {
    const d = view.dpr;
    g.setTransform(d, 0, 0, d, 0, 0);
    g.clearRect(0, 0, view.cssW, view.cssH);
    if (!bild.ok || !state.k) return;
    const K = state.k;
    const W = state.wand;
    const u = clamp(Math.min(view.cssW, view.cssH) / 420, 0.85, 1.4);
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.lineCap = "round";

    // Vor dem ersten Griff: Ringe um die Griffe, die sie erreicht.
    if (state.phase === "bereit") {
      const puls = (state.zeit * 0.9) % 1;
      for (const q of W.griffe.slice(0, 8)) {
        if (!inReichweite(W, K, q)) continue;
        const p = imBild([q.x, q.y, GRIFF_VOR]);
        const rand = imBild([q.x + q.r, q.y, GRIFF_VOR]);
        const r = Math.abs(rand.x - p.x);
        g.strokeStyle = `rgba(255, 255, 255, ${0.85 * (1 - puls)})`;
        g.lineWidth = 2.5;
        g.beginPath();
        g.arc(p.x, p.y, r * (1.2 + puls * 1.3), 0, TAU);
        g.stroke();
      }
    }

    // Die Ringe um eben getippte Griffe.
    for (const r of state.ringe) {
      const p = imBild(r.ort);
      const k = r.alt / 0.45;
      g.strokeStyle = r.farbe;
      g.globalAlpha = 1 - k;
      g.lineWidth = 3.5 * (1 - k) + 1;
      g.beginPath();
      g.arc(p.x, p.y, (10 + 34 * k) * u * r.weit, 0, TAU);
      g.stroke();
    }
    g.globalAlpha = 1;

    // Die Schriften über den Griffen.
    for (const s of state.schriften) {
      const p = imBild(s.ort);
      const k = s.alt / s.dauer;
      g.globalAlpha = 1 - weich(0.55, 1, k);
      g.font = `900 ${Math.round(s.gross * u * (1 + 0.25 * (1 - weich(0, 0.15, k))))}px system-ui, sans-serif`;
      g.lineWidth = 5 * u;
      g.lineJoin = "round";
      g.strokeStyle = "rgba(6, 10, 26, 0.75)";
      g.strokeText(s.text, p.x, p.y - (22 + 30 * k) * u);
      g.fillStyle = s.farbe;
      g.fillText(s.text, p.x, p.y - (22 + 30 * k) * u);
    }
    g.globalAlpha = 1;

    // Der Kraftring: links neben ihr, auf Höhe der Hüfte. Aussen herum der Schwung.
    if (state.phase !== "bereit" && !fig.fall) {
      const p = imBild([fig.becken[0] - 0.62, fig.becken[1] + 0.1, 0.3]);
      const x = clamp(p.x, 34 * u, view.cssW - 34 * u);
      const y = clamp(p.y, view.frei + 40 * u, view.cssH - 40 * u);
      const r = 19 * u;
      const eng = K.kraft < 0.28;
      g.lineWidth = 6 * u;
      g.strokeStyle = "rgba(6, 10, 26, 0.55)";
      g.beginPath();
      g.arc(x, y, r, 0, TAU);
      g.stroke();
      if (!(eng && Math.sin(state.zeit * 16) > 0.5)) {
        g.strokeStyle = eng ? "#ff5a48" : K.kraft < 0.55 ? "#ffd23f" : "#5ef2a0";
        g.beginPath();
        g.arc(x, y, r, -Math.PI / 2, -Math.PI / 2 + TAU * clamp(K.kraft, 0, 1));
        g.stroke();
      }
      if (K.schwung > 0.02) {
        g.lineWidth = 3 * u;
        g.strokeStyle = "#6fd3ff";
        g.beginPath();
        g.arc(x, y, r + 7 * u, -Math.PI / 2, -Math.PI / 2 + TAU * clamp(K.schwung, 0, 1));
        g.stroke();
      }
      g.fillStyle = "#ffffff";
      g.font = `900 ${Math.round(10 * u)}px system-ui, sans-serif`;
      g.fillText("KRAFT", x, y);
    }

    // Die Meter, oben links unter den Knöpfen.
    if (state.phase !== "bereit") {
      const x = 16;
      const y = view.frei + 30 * u;
      g.textAlign = "left";
      g.font = `900 ${Math.round(30 * u)}px system-ui, sans-serif`;
      g.lineWidth = 6 * u;
      g.lineJoin = "round";
      g.strokeStyle = "rgba(6, 10, 26, 0.7)";
      const text = `${state.punkte} m`;
      g.strokeText(text, x, y);
      g.fillStyle = "#ffffff";
      g.fillText(text, x, y);
      if (K.kette >= 2) {
        g.font = `800 ${Math.round(13 * u)}px system-ui, sans-serif`;
        g.lineWidth = 4 * u;
        g.strokeText(`Perfekt ×${K.kette}`, x, y + 26 * u);
        g.fillStyle = "#ffd84d";
        g.fillText(`Perfekt ×${K.kette}`, x, y + 26 * u);
      }
      g.textAlign = "center";
    }

    // Am Ende: warum.
    if (state.endet && K.aus) {
      const seit = state.zeit - state.endet;
      g.globalAlpha = weich(0.1, 0.4, seit);
      g.font = `900 ${Math.round(26 * u)}px system-ui, sans-serif`;
      g.lineWidth = 6 * u;
      g.strokeStyle = "rgba(6, 10, 26, 0.75)";
      g.strokeText(GRUND_TEXT[K.aus] || "", view.cssW / 2, view.cssH * 0.3);
      g.fillStyle = "#ffffff";
      g.fillText(GRUND_TEXT[K.aus] || "", view.cssW / 2, view.cssH * 0.3);
      g.globalAlpha = 1;
    }
  }

  function zeichnen() {
    zeichneWelt();
    zeichneHud();
  }

  // ---------------------------------------------------------------------------
  // Klang
  // ---------------------------------------------------------------------------
  const zuletzt = new Map();
  function ton(id, o = {}, pause = 50) {
    const ms = performance.now();
    if (ms - (zuletzt.get(id) ?? -1e9) < pause) return;
    zuletzt.set(id, ms);
    klang()?.ton?.(id, o);
  }

  let wind = null;
  function windAn() {
    wind = klang()?.kulisse?.("kletterwand.wind", { laut: 0 }) || null;
  }
  function windAus() {
    wind?.stop();
    wind = null;
  }

  // ---------------------------------------------------------------------------
  // Der Ablauf einer Runde
  // ---------------------------------------------------------------------------
  /*
   * Ein Zug (geist.js, zuege; live-spiel.js, zug):
   *   c   1 ein Griff, 2 das Ende
   *   a   beim Griff: seine Nummer; am Ende: 1 daneben, 2 Kraft, 3 Bruch
   *   b   beim Griff: die Güte (0 knapp, 1 gut, 2 perfekt)
   * Die Wand kommt aus derselben Saat. Wer zuschaut, lässt dieselben Griffe
   * mit derselben Güte packen, zur selben Zeit.
   */
  const AUS_NR = { daneben: 1, kraft: 2, bruch: 3 };
  const AUS_NAME = ["", "daneben", "kraft", "bruch"];

  function meldeZug(ort) {
    if (zuschauer) return;
    aufnahme?.zug(state.punkte, ort);
    const live = window.LernappLiveSpiel;
    if (shell?.live && live?.zug && live.gestartet?.()) live.zug(state.punkte, ort);
  }

  // Ein Griff ist gepackt: zählen, zeigen, und die Bewegung in die Schlange.
  function griffGepackt(e) {
    const K = state.k;
    const q = state.wand.griffe[e.nr];
    const ort = fassPunkt(q, K.t);
    fig.warte.push({ hand: e.hand, nr: e.nr, sprung: e.sprung, guete: e.guete, gold: e.gold });
    state.punkte = Math.floor(K.hoch);
    shell.setCount(state.punkte);
    ringBei(ort, GUETE_FARBE[e.guete], e.guete === 2 ? 1.25 : 1);
    schrift(e.sprung ? "Sprung!" : GUETE_TEXT[e.guete], e.sprung ? "#6fd3ff" : GUETE_FARBE[e.guete], ort, e.guete === 2 || e.sprung ? 22 : 17);
    if (e.guete === 2) kids()?.vibrate?.(10);
    // Eine neue Zone: ihre Meterzahl steht kurz gross im Bild.
    const zone = Math.floor(K.hoch / ZONE_HOCH);
    if (zone > state.zone) {
      if (state.zone >= 0) { schrift(`${zone * ZONE_HOCH} m`, "#ffffff", [0, ort[1] + 0.9, 0], 40, 1.8); ton("meilenstein"); }
      state.zone = zone;
    }
  }

  // Die Runde endet: Sie fällt ins Seil, dann kommt das Ergebnis.
  function endeBeginnen(grund, ort = null) {
    if (state.endet) return;
    const K = state.k;
    K.aus = grund;
    state.endet = state.zeit;
    state.stoss = 1;
    if (grund === "daneben" && ort) {
      // Die Hand greift ins Leere – erst dann fällt sie.
      fig.warte = [{ hand: K.dran, fehl: true, ort: [ort[0], ort[1], GRIFF_VOR * 0.5] }];
    } else {
      fallBeginnen(grund);
    }
    ton(grund === "bruch" ? "kletterwand.bruch" : "kletterwand.fall");
    kids()?.vibrate?.([30, 40, 60]);
    if (!zuschauer) {
      meldeZug({ a: AUS_NR[grund] || 0, b: 0, c: 2 });
      clearStep();
      stepTimer = window.setTimeout(finish, 1900);
    }
  }

  // Ein Tipp auf die Stelle (px, py) des Bildes.
  function tipp(px, py) {
    if (state.phase === "ende" || state.phase === "zuschauen" || state.endet || !state.k) return;
    if (state.phase === "bereit" && shell.live) return;
    const K = state.k;
    const wo = aufWand(px, py);
    const e = tippe(state.wand, K, wo.x, wo.y);
    if (e.art === "nichts") return;
    if (e.art === "weit") {
      const q = state.wand.griffe[e.nr];
      const p = griffOrt(q, K.t);
      ringBei([p.x, p.y, GRIFF_VOR], "rgba(255, 255, 255, 0.5)", 0.7);
      schrift("zu weit", "#cfd8e6", [p.x, p.y, GRIFF_VOR], 14, 0.7);
      return;
    }
    if (state.phase === "bereit") losGehts();
    if (e.art === "daneben") {
      ringBei([wo.x, wo.y, GRIFF_VOR], "#ff5a48", 1);
      schrift("Daneben!", "#ff7a6b", [wo.x, wo.y, GRIFF_VOR], 22, 1.4);
      endeBeginnen("daneben", [wo.x, wo.y]);
      return;
    }
    ton("kletterwand.griff", { laut: 0.5 + 0.25 * e.guete });
    if (e.guete === 2) ton("kletterwand.perfekt", { laut: 0.7 });
    if (e.sprung) ton("kletterwand.sprung");
    griffGepackt(e);
    meldeZug({ a: e.nr, b: e.guete, c: 1 });
  }

  // Was das Bild meldet: Die Hand ist gelandet, das Seil hat sie gefangen.
  function ereignisseTakt() {
    for (const e of fig.ereignisse.splice(0)) {
      if (e.art === "gelandet") {
        if (e.fehl) { fallBeginnen("daneben"); continue; }
        const q = state.wand.griffe[e.nr];
        const ort = fassPunkt(q, state.k.t);
        kreideWolke(ort, e.sprung ? 2 : e.guete === 2 ? 1.3 : 0.8);
        if (e.guete === 2 || e.gold) funken(ort);
        if (e.sprung) state.stoss = Math.max(state.stoss, 0.7);
      } else if (e.art === "seil") {
        ton("kletterwand.seil");
        state.stoss = Math.max(state.stoss, 0.5);
      }
    }
  }

  function takt(dt) {
    state.zeit += dt;
    state.stoss = Math.max(0, state.stoss - dt * 3);
    const K = state.k;
    const W = state.wand;
    if (state.phase === "zuschauen") zuschauenTakt();
    if (K && (state.phase === "spiel" || state.phase === "zuschauen") && !state.endet) {
      const vorher = K.kraft;
      const geschehen = schritt(W, K, dt);
      if (state.phase === "zuschauen") {
        // Beim Zuschauen endet die Runde, wenn der Lauf es sagt – nicht früher.
        K.aus = "";
        K.kraft = Math.max(K.kraft, 0.02);
        for (const e of geschehen) if (e.art === "bruch") { const q = W.griffe[e.nr]; splitter([q.fx, q.y, 0], q.r); }
      } else {
        for (const e of geschehen) {
          if (e.art === "bruch") { const q = W.griffe[e.nr]; splitter([q.fx, q.y, 0], q.r); endeBeginnen("bruch"); }
          if (e.art === "kraft") endeBeginnen("kraft");
        }
      }
      for (const e of bruchTakt(W, K)) { const q = W.griffe[e.nr]; splitter([q.fx, q.y, 0], q.r); ton("kletterwand.bruch", { laut: 0.5 }, 200); }
      if (vorher >= 0.28 && K.kraft < 0.28 && !K.aus) ton("kletterwand.kraft");
    }
    for (const r of state.ringe) r.alt += dt;
    state.ringe = state.ringe.filter((r) => r.alt < 0.45);
    for (const s of state.schriften) s.alt += dt;
    state.schriften = state.schriften.filter((s) => s.alt < s.dauer);
    if (K) {
      figurTakt(dt);
      ereignisseTakt();
      kameraTakt(dt);
      wind?.laut(clamp(0.15 + K.hoch / 120, 0, 1) * (state.phase === "bereit" ? 0.4 : 1));
      wind?.setze(clamp(0.3 + K.hoch / 200, 0, 1));
    }
    teileTakt(dt);
  }

  // Für die Prüfung und die Zeitlupe: Die Uhr des Spiels lässt sich anhalten
  // und von Hand weiterdrehen (takt).
  let angehalten = false;
  function loop(now) {
    frame = window.requestAnimationFrame(loop);
    const sekunden = (now - last) / 1000;
    gueteTakt(sekunden);
    const dt = clamp(sekunden, 0, 0.05);
    last = now;
    messen();
    if (!angehalten) takt(dt);
    zeichnen();
  }

  // ---------------------------------------------------------------------------
  // Zuschauen
  // ---------------------------------------------------------------------------
  // Dieselbe Wand (die Saat hält geist.js oder der Abend), und Zug um Zug,
  // was der andere tat: derselbe Griff mit derselben Güte, zur selben Zeit.
  let gesehenBis = -1;
  function zuschauenTakt() {
    if (!zuschauer?.seit) return;
    const jetzt = zuschauer.jetzt();
    const K = state.k;
    for (const probe of zuschauer.seit(gesehenBis, jetzt)) {
      const frisch = jetzt - probe.t < 1500;
      if (probe.c === 1 && !state.endet) {
        const q = state.wand.griffe[probe.a] || (wandBis(state.wand, K.hoch + START_Y + 12), state.wand.griffe[probe.a]);
        if (!q || q.weg) continue;
        const e = greife(state.wand, K, probe.a, clamp(probe.b, 0, 2));
        griffGepackt(e);
        if (frisch) { ton("kletterwand.griff", { laut: 0.5 + 0.25 * e.guete }); if (e.guete === 2) ton("kletterwand.perfekt", { laut: 0.7 }); }
      } else if (probe.c === 2 && !state.endet) {
        endeBeginnen(AUS_NAME[probe.a] || "kraft");
      }
      if (probe.p !== state.punkte && probe.c === 1) { state.punkte = probe.p; shell.setCount(probe.p); }
    }
    gesehenBis = jetzt;
    zuschauer.weiter?.();
  }

  function zuschauenStarten() {
    if (!zuschauer?.seit) return;
    startRun();
    state.phase = "zuschauen";
    state.k.los = true;
    shell.setPhase("play");
    gesehenBis = -1;
    zuschauer.los?.();
    windAn();
  }

  // ---------------------------------------------------------------------------
  // Ablauf
  // ---------------------------------------------------------------------------
  // Die Runde beginnt: mit dem ersten Griff – oder im Live-Modus zum
  // gemeinsamen Start (game-shell.js, live.los).
  function losGehts() {
    if (state.phase !== "bereit") return;
    state.phase = "spiel";
    state.k.los = true;
    shell.setPhase("play");
    aufnahme?.los();
    windAn();
  }

  function startRun() {
    clearStep();
    stopLoop();
    windAus();
    shell.closeOverlay();
    zufall.neu();
    shell.setPhase("intro");
    state.wand = neueWand();
    state.k = neueKletterin();
    state.phase = "bereit";
    state.punkte = 0;
    state.endet = 0;
    state.stoss = 0;
    state.schriften = [];
    state.ringe = [];
    state.zone = -1;
    teile.length = 0;
    figurNeu();
    shell.setCount(0);

    shell.clear();
    const prompt = shell.el("p", "cm-prompt kw-prompt", "Tippe den nächsten Griff an – genau auf den Bolzen in der Mitte.");
    shell.play.append(prompt, buildPlatz());
    view.cssW = 0;
    view.cssH = 0;
    messen();
    kameraTakt(0, true);

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
    if (state.phase === "ende") return;
    // Im Live-Modus endet die Runde auch mitten im Klettern: Es zählt, was
    // bis dahin erklettert ist.
    state.phase = "ende";
    windAus();
    const K = state.k;
    const punkte = state.punkte;
    const geist = aufnahme?.ende() || null;
    const vorher = Number(store.read()?.scores?.[0]) || 0;
    const rekord = punkte > vorher;
    store.update((old) => ({
      runs: (Number(old.runs) || 0) + 1,
      scores: [...(old.scores || []), punkte].sort((x, y) => y - x).slice(0, TOP_COUNT),
    }));
    shell.showResult({
      label: "Deine Meter",
      points: punkte,
      detail: [
        rekord ? "Neuer Rekord!" : GRUND_TEXT[K.aus] || "",
        K.zuege ? `${K.perfekt} von ${K.zuege} Griffen perfekt` : "",
        K.spruenge ? `${K.spruenge} ${K.spruenge === 1 ? "Sprung" : "Sprünge"}` : "",
        !rekord && vorher ? `Bestwert ${vorher} m` : "",
      ].filter(Boolean).join(" · "),
      geist,
    });
    if (rekord) host.querySelector(".cm-result-detail")?.classList.add("kw-rekord");
    zaehleHoch(punkte);
  }

  // ---------------------------------------------------------------------------
  // Bestenliste – lokal und in der Cloud
  // ---------------------------------------------------------------------------
  const store = cloudApi
    ? cloudApi.register({ key: "lernapp.kletterwand", empty: { runs: 0, scores: [] }, merge: cloudApi.mergeScores(TOP_COUNT) })
    : {
      read: () => ({ runs: 0, scores: [] }),
      write(data) { return data; },
      update(fn) { return fn(this.read()); },
      onChange() { return () => {}; },
    };

  // ---------------------------------------------------------------------------
  // Start
  // ---------------------------------------------------------------------------
  // Welche Stimmung und welcher Aufzug: aus der Adresse (?stil=, ?kleid=),
  // sonst der Abend.
  {
    const wunsch = new URLSearchParams(window.location.search);
    if (STIMMUNG[wunsch.get("stil")]) stimmung = STIMMUNG[wunsch.get("stil")];
    if (KLEID[Number(wunsch.get("kleid"))]) kleid = KLEID[Number(wunsch.get("kleid"))];
  }

  shell = shellApi.mount({
    host,
    title: "Kletterwand",
    area: "geschwindigkeit",
    accent: "#F5A623",
    accentDark: "#b9741a",
    clock: false,
    onRestart: () => (zuschauer ? zuschauenStarten() : startRun()),
    live: { los: losGehts, stopp: () => finish(), zuschauen: (quelle) => { zuschauer = quelle; zuschauenStarten(); } },
  });
  zuschauer = window.LernappGeist?.zuschauer?.({
    host, spiel: "speedClimb", fassung: "z1", zufall, zuege: true, einheit: "m", nochmal: zuschauenStarten,
  }) || null;
  if (!zuschauer) aufnahme = window.LernappGeist?.zuege?.({ fassung: "z1", zufall }) || null;

  // Die erste Haltung braucht eine Wand: Sie entsteht hier schon einmal,
  // damit das Netz der Kletterin seinen Plan bekommt.
  state.wand = neueWand();
  state.k = neueKletterin();
  figurNeu();
  grafikStarten();
  startRun();
  zuschauer?.laden.then((da) => { if (da) zuschauenStarten(); });

  // Jeder Finger, der aufsetzt, ist ein Tipp.
  host.addEventListener("pointerdown", (event) => {
    if (event.target.closest("button, a, input")) return;
    if (!canvas) return;
    event.preventDefault();
    const r = canvas.getBoundingClientRect();
    tipp(event.clientX - r.left, event.clientY - r.top);
  });

  window.addEventListener("resize", messen);
  window.addEventListener("orientationchange", messen);
  window.addEventListener("pagehide", () => { clearStep(); stopLoop(); windAus(); });

  // Für die Prüfskripte und die Vorführung. halte(true) hält die Uhr an –
  // dann dreht sie nur noch, wer takt ruft; guete(1) hält die Schärfe fest.
  window.LernappKletterwand = {
    BAHN, START_Y, R_STAND, R_SPRUNG, R_HAUPT, PERFEKT, PERFEKT_MIN, GUT, KNAPP, DANEBEN, KRAFT_AB, KRAFT_PLUS, KRAFT_GOLD, BRUCH_ZEIT, AB_BRUCH, AB_PENDEL, ZONE_HOCH,
    state, view, fig, kam, fassPunkt, takt, zeichnen, tipp, losGehts, weltText, wandBis, neueWand, neueKletterin, griffOrt, reichweite, inReichweite,
    gueteVon, tippe, greife, schritt, bruchTakt, pilot, schwere, imBild, aufWand,
    halte: (an) => { angehalten = Boolean(an); },
    guete(wert) {
      view.fest = wert !== null && wert !== undefined;
      if (view.fest) view.guete = clamp(Number(wert) || 1, 0.3, 1);
      view.cssW = 0;
      messen();
    },
    stimmungen: Object.keys(STIMMUNG), stimme: (name) => { if (STIMMUNG[name]) stimmung = STIMMUNG[name]; }, kleide: (nr) => { if (KLEID[nr]) kleid = KLEID[nr]; },
  };
})();
