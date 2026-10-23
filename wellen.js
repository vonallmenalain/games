/*
 * wellen.js – Wellenreiter.
 * ---------------------------------------------------------------------------
 * Ein Surfer reitet nach rechts über die Dünung: Wellenberg, Wellental,
 * Wellenberg. Wer den Finger aufs Bild legt, drückt das Brett ins Wasser – es
 * wird schwer, schiesst die Wellenfront hinab und holt Tempo; in der Luft
 * fällt es wie ein Stein. Wer loslässt, nimmt das Gewicht heraus: Das Brett
 * trägt den Schwung den nächsten Berg hinauf und hebt am Kamm ab.
 *
 * Der Trick ist die Landung. Wer auf der Rückseite eines Kamms aufsetzt, im
 * selben Winkel, in dem das Wasser abfällt, gleitet ohne Bremsen weiter und
 * bekommt Schub dazu: Perfekt! Drei perfekte Landungen hintereinander, und
 * er ist im Flow – das Brett leuchtet, zieht eine Spur aus Licht, ist
 * schneller und jede weitere perfekte Landung gibt mehr. Wer schräg ins
 * Wasser klatscht, verliert Tempo, und der Flow ist weg.
 *
 * Eine Uhr gibt es nicht. Von links rollt die Brecherwelle heran – eine
 * Wand aus Wasser mit überschlagender Lippe und einer Walze aus Schaum an
 * ihrem Fuss. Sie wird mit der Zeit schneller, und weiter als gut hundert
 * Meter fällt sie nie zurück. Holt sie den Surfer ein, ist die Runde vorbei.
 * Gezählt wird, wie weit er kommt, in Metern; oben links steht, wie viel
 * Vorsprung er noch hat.
 *
 * Die Dünung kommt aus dem Zufall (zufall.js): ohne Turnier jedes Mal eine
 * andere, im Turnier für alle im selben Versuch dieselbe. Nach hinten werden
 * die Wellen höher, länger und unregelmässiger, ab und zu kommt ein Set –
 * eine besonders grosse. Die Wellen laufen dabei selbst langsam nach rechts
 * (DRIFT): Gerechnet wird in ihrem Mass (u), gezeichnet und gezählt in dem
 * des Meeres (x = u + DRIFT · Zeit). Und der Tag zieht mit der Strecke
 * vorbei – Vormittag, goldener Abend mit der Sonnenstrasse auf dem Wasser,
 * Mondnacht mit leuchtendem Plankton im Schaum, Morgenrot.
 *
 * Die Gegner (geist.js) surfen als Schatten aus Licht mit – so, wie sie in
 * ihrer besten Runde gesurft sind. Platz 1 und die eigene Bestmarke treiben
 * dazu als Boje mit Fähnchen bei ihren Metern. Und die besten Fahrten lassen
 * sich anschauen (?zuschauen=, geist.js): über ihrer eigenen Dünung,
 * gewürfelt mit derselben Saat, mit derselben Brecherwelle im Nacken.
 *
 * Gerechnet wird in Welteinheiten, zehn sind ein Meter; y zählt nach oben.
 */
(() => {
  "use strict";

  if (document.body.dataset.page !== "waves") return;

  const host = document.querySelector("#wr-stage");
  const shellApi = window.LernappGameShell;
  const cloudApi = window.LernappGameCloud;
  if (!host || !shellApi) return;

  const kids = () => window.LernappKids || null;
  const ruhig = () => Boolean(kids()?.prefersReducedMotion?.());

  // Der Zufall. Nur die Dünung zieht daraus – Gischt, Funkeln, Möwen und
  // Delfine würfeln Math.random oder hängen an einer festen Zahl, damit die
  // Wellen nicht davon abhängen, wie jemand surft.
  const zufall = window.LernappZufall?.fuer?.("waveRider") || {
    neu() {},
    zahl: () => Math.random(),
  };

  // ---------------------------------------------------------------------------
  // Die Welt
  // ---------------------------------------------------------------------------
  const METER = 20;
  const SICHT_H = 360;
  const SICHT_W_MIN = 460;
  const SURFER_AN = 0.42;          // so weit vom linken Rand surft er …
  const SURFER_AN_NAH = 0.6;       // … und so weit, wenn die Welle nah ist
  const START_U = 0;
  const TAKT = 1 / 240;
  const DRIFT = 32;                // so schnell laufen die Wellen nach rechts

  // Schwer und leicht. Leicht fliegt das Brett weit über den Kamm, schwer
  // fällt es wie ein Stein – und schiesst die Wellenfront hinab.
  const G_LEICHT = 950;
  const G_SCHWER = 3400;
  const V_MIN = 190;               // langsamer wird er nie – er paddelt
  const V_MAX = 1100;
  // Das Wasser bremst: obenauf kaum, ins Wasser gedrückt mehr – und wer
  // die Wellenfront hinauf drückt, gräbt das Brett ein (BERGAUF, mal der
  // Steigung).
  const REIBUNG_SCHWER = 120;
  const REIBUNG_LEICHT = 45;
  const BERGAUF = 700;
  const PERFEKT_WINKEL = 0.46;     // so flach muss er auf dem Wasser landen
  const SCHLECHT_WINKEL = 0.66;    // so steiler klatscht es
  // Im Flow: ein steter Schub, mehr Höchsttempo.
  const FLOW_SCHUB = 130;
  const FLOW_TEMPO = 1.25;

  // Die Brecherwelle. Sie beginnt gut zwanzig Meter hinter ihm, wird jede
  // Sekunde ein wenig schneller und fällt nie weiter zurück als
  // BRECHER_WEIT. FANG ist, wo ihr Vorhang vor der Wand ins Wasser schlägt:
  // Wer dort ist, den hat sie.
  const BRECHER_START = 420;
  const BRECHER_V0 = 280;
  const BRECHER_PLUS = 2.6;          // so viel schneller je Sekunde
  const BRECHER_VMAX = 1150;
  const BRECHER_WEIT = 1150;
  const FANG = 110;

  // Ein Tag auf dem Meer, in Metern: Vormittag, Mittag, goldener Abend,
  // Nacht, Morgenrot – dann wieder von vorn.
  const TAG_STRECKE = 3600;
  const FERN_RAND = 80;            // so weit steht die ferne Leinwand über (Pixel)
  const TAG_START = 0.06;

  const TOP_COUNT = 5;
  const store = cloudApi
    ? cloudApi.register({ key: "lernapp.wellen", empty: { runs: 0, scores: [] }, merge: cloudApi.mergeScores(TOP_COUNT) })
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
  const meterBei = (x) => Math.max(0, (x - START_U) / METER);
  const schwereBei = (u) => 1 - Math.exp(-meterBei(u) / 1500);
  const brecherTempo = (t) => Math.min(BRECHER_VMAX, BRECHER_V0 + BRECHER_PLUS * t);

  // Immer dieselbe Zahl zu derselben Eingabe: Sterne, Glitzer und Inseln
  // stehen bei jedem Bild am selben Platz, ohne die Dünung anzufassen.
  function hash01(n) {
    const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return x - Math.floor(x);
  }

  const misch = (a, b, k) => [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)];
  const rgb = (c, a = 1) => (a >= 1
    ? `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`
    : `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a.toFixed(3)})`);

  // ---------------------------------------------------------------------------
  // Zustand
  // ---------------------------------------------------------------------------
  // phase: "bereit" (noch nichts gedrückt), "spiel", "aus" (die Welle hat ihn),
  //        "ende", "zuschauen"
  const state = {
    phase: "bereit",
    punkte: 0,
    meter: 0,
    perfekt: 0,
    landungen: { perfekt: 0, gut: 0, hart: 0 },
    serie: 0,
    flow: false,
    flowZeit: -9,         // wann der Flow zuletzt anging – für die Einblendung
    flowAusZeit: -9,      // … und wann er zuletzt ausging
    s: { u: START_U, y: 0, vu: 0, vy: 0 },
    winkel: 0,
    hocke: 0,             // 0 gestreckt … 1 geduckt (gezeichnet, nicht gerechnet)
    amBoden: true,
    flugZeit: 0,
    flugHoehe: 0,         // wie hoch er über dem Wasser war, seit er abhob
    lauf: 0,              // Sekunden seit dem Start – nach ihnen laufen die Wellen
    brecher: { x: START_U - BRECHER_START, v: BRECHER_V0 },
    knapp: Infinity,      // der kleinste Vorsprung seit dem letzten «Knapp!»
    wipe: null,
    wellen: [],           // Extrempunkte { u, y }, abwechselnd Tal und Kamm
    kielwasser: [],       // Schaum, den das Brett hinterlässt { u, y, alter }
    spur: [],             // im Flow: wo er war – ein Band aus Licht { x, y }
    kielTakt: 0,
    teile: [],
    tropfen: [],          // Wasser auf der Linse, wenn die Welle nah ist
    schriften: [],
    camX: 0,
    camY: 0,
    anker: SURFER_AN,
    zoom: 1,
    zeit: 0,
    tag: TAG_START,
    stoss: 0,
  };

  let shell = null;
  let feld = null;
  let canvas = null;
  let g = null;
  // Die Fläche – Himmel, fernes Meer, Wasser, der Körper der Brecherwelle –
  // ist weich und gross. Sie liegt auf einer eigenen Leinwand unter der
  // anderen und wird auf feinen Bildschirmen mit halber Auflösung gemalt;
  // vergrössert wird sie beim Zusammensetzen des Bildes. Das kostet ein
  // Viertel. Alles mit Kanten kommt scharf auf die Leinwand darüber.
  let grund = null;
  let gGrund = null;
  let grundDpr = 1;
  let frame = null;
  let last = 0;
  let stepTimer = null;
  let gedrueckt = false;
  // Die Gegner (geist.js): wer als Schatten mitsurft und als Boje treibt.
  let gegner = null;
  // Wer eine Fahrt anschaut statt zu surfen (geist.js, zuschauer).
  let zuschauer = null;

  // Wie fein gemalt wird: höchstens zwei Bildpunkte je Pixel. Läuft das Bild
  // auf einem Gerät eine Weile zu langsam, malt es gröber – flüssig geht vor
  // scharf.
  let schaerfe = 2;
  let langsam = 0;

  const view = { s: 1, s0: 1, dpr: 1, cssW: 0, cssH: 0, w: SICHT_W_MIN, h: SICHT_H, w0: SICHT_W_MIN, h0: SICHT_H, frei: 0 };

  function clearStep() {
    if (stepTimer) { window.clearTimeout(stepTimer); stepTimer = null; }
  }

  function stopLoop() {
    if (frame) { window.cancelAnimationFrame(frame); frame = null; }
  }

  // ---------------------------------------------------------------------------
  // Die Dünung
  // ---------------------------------------------------------------------------
  /*
   * Die Wasseroberfläche ist eine Kette von Tälern und Kämmen, verbunden mit
   * einer Kosinuskurve – glatt, ohne Knick. Je weiter hinten, desto höher und
   * länger, und desto öfter ein Set. Steiler als etwa drei zu zwei wird keine
   * Flanke, und kein Kamm wird spitz: Sonst gäbe es Wände, an denen das
   * Brett nur noch abprallt, und Kämme, über die es bei jedem Tempo hüpft.
   */
  function neuerPunkt() {
    const w = state.wellen;
    if (!w.length) {
      // Der Start: oben auf einem Kamm, vor ihm eine lange Flanke hinab.
      w.push({ u: START_U - 560, y: -60 }, { u: START_U - 210, y: 110 }, { u: START_U + 230, y: -90 });
      return;
    }
    const vor = w[w.length - 1];
    const kamm = vor.y < (w[w.length - 2]?.y ?? 0);   // nach einem Tal kommt ein Kamm
    const k = schwereBei(vor.u);
    let weit = lerp(220, 340, k) * (0.8 + zufall.zahl() * 0.42);
    let hoch = lerp(95, 205, k) * (0.62 + zufall.zahl() * 0.55);
    // Ein Set: ab und zu eine besonders grosse Welle.
    if (zufall.zahl() < lerp(0.05, 0.22, k)) {
      hoch *= 1.35;
      weit *= 1.15;
    }
    // Die Mitte der Dünung bleibt bei 0: Täler unter, Kämme über ihr.
    const y = kamm ? clamp(vor.y + hoch, 25, 245) : clamp(vor.y - hoch, -235, -25);
    weit = Math.max(weit, Math.abs(y - vor.y) * 1.1);
    w.push({ u: vor.u + weit, y });
  }

  function wellenBis(u) {
    while (!state.wellen.length || state.wellen[state.wellen.length - 1].u < u) neuerPunkt();
  }

  function abschnitt(u) {
    wellenBis(u + 10);
    const w = state.wellen;
    let lo = 0;
    let hi = w.length - 1;
    while (lo < hi - 1) {
      const mid = (lo + hi) >> 1;
      if (w[mid].u <= u) lo = mid;
      else hi = mid;
    }
    return lo;
  }

  function duenungBei(u) {
    const i = abschnitt(u);
    const a = state.wellen[i];
    const b = state.wellen[i + 1];
    const k = clamp((u - a.u) / (b.u - a.u), 0, 1);
    return a.y + (b.y - a.y) * (1 - Math.cos(Math.PI * k)) / 2;
  }

  function duenungSteigung(u) {
    const i = abschnitt(u);
    const a = state.wellen[i];
    const b = state.wellen[i + 1];
    const L = b.u - a.u;
    const k = clamp((u - a.u) / L, 0, 1);
    return ((b.y - a.y) * Math.PI * Math.sin(Math.PI * k)) / (2 * L);
  }

  /*
   * Die Brecherwelle saugt das Wasser vor sich an: In den letzten FLACH_WEIT
   * vor ihrer Wand wird die Dünung flacher, hinter ihr bleibt nur ein Rest.
   * Das ist das Wasser, auf dem er surft (und gezeichnet wird) – so steht
   * die Wand immer auf ruhigem Wasser, und wer sie im Nacken hat, bekommt
   * von den Wellen weniger Schwung.
   */
  const FLACH_WEIT = 520;
  const FLACH_REST = 0.15;
  const flach = { f: 1, df: 0 };

  function flachBei(u) {
    const d = u - (state.brecher.x - DRIFT * state.lauf + 40);
    if (d >= FLACH_WEIT) { flach.f = 1; flach.df = 0; return flach; }
    if (d <= 0) { flach.f = FLACH_REST; flach.df = 0; return flach; }
    const k = d / FLACH_WEIT;
    flach.f = FLACH_REST + (1 - FLACH_REST) * k * k * (3 - 2 * k);
    flach.df = ((1 - FLACH_REST) * 6 * k * (1 - k)) / FLACH_WEIT;
    return flach;
  }

  function wasserBei(u) {
    return duenungBei(u) * flachBei(u).f;
  }

  function steigungBei(u) {
    const { f, df } = flachBei(u);
    return duenungSteigung(u) * f + (df ? duenungBei(u) * df : 0);
  }

  // Vom Meer (x) in das Mass der Wellen (u), und die Oberfläche an einer
  // Stelle des Meeres.
  const lageU = (x) => x - DRIFT * state.lauf;
  const wasserAbs = (x) => wasserBei(lageU(x));
  const absX = () => state.s.u + DRIFT * state.lauf;

  // Das Kräuseln obenauf: nur gezeichnet, nicht gerechnet.
  function kraeuseln(x) {
    if (ruhig()) return 0;
    return Math.sin(x * 0.083 - state.zeit * 2.3) * 1.3 + Math.sin(x * 0.21 + state.zeit * 3.4) * 0.6;
  }

  // ---------------------------------------------------------------------------
  // Die Fläche
  // ---------------------------------------------------------------------------
  function buildPlatz() {
    const platz = shell.el("div", "wr-platz");
    feld = shell.el("div", "wr-feld");
    canvas = document.createElement("canvas");
    canvas.className = "wr-canvas";
    canvas.setAttribute("aria-hidden", "true");
    g = canvas.getContext("2d");
    // Die Leinwand für die Fläche liegt hinter der anderen.
    grund = document.createElement("canvas");
    grund.className = "wr-canvas";
    grund.setAttribute("aria-hidden", "true");
    grund.style.position = "absolute";
    grund.style.inset = "0";
    grund.style.zIndex = "-1";
    gGrund = grund.getContext("2d", { alpha: false });
    feld.append(canvas, grund);

    // Der Hinweis vor dem ersten Druck: ein Ring, der sich füllt – halten,
    // nicht tippen.
    const tipp = shell.el("span", "wr-tipp");
    tipp.setAttribute("aria-hidden", "true");
    const ns = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(ns, "svg");
    svg.setAttribute("viewBox", "0 0 64 64");
    [
      { r: 22, stroke: "rgba(255,255,255,0.5)", w: 5 },
      { r: 22, stroke: "#ffffff", w: 5, klasse: "wr-tipp-fuell" },
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

  function messen() {
    if (!canvas || !feld) return;
    const cssW = Math.max(80, feld.clientWidth);
    const cssH = Math.max(80, feld.clientHeight);
    const dpr = Math.min(schaerfe, clamp(window.devicePixelRatio || 1, 1, 2));
    // Auf dem Handy reicht die Leinwand unter die Knöpfe oben (game-shell.js,
    // frei). Gemalt wird dort auch – aber die Anzeige steht darunter.
    const frei = Math.min(cssH * 0.4, shell?.frei?.(canvas) || 0);
    if (cssW === view.cssW && cssH === view.cssH && dpr === view.dpr && frei === view.frei) return;
    view.cssW = cssW;
    view.cssH = cssH;
    view.dpr = dpr;
    view.frei = frei;
    // Mindestens SICHT_H hoch und SICHT_W_MIN breit.
    view.w0 = Math.max(SICHT_H * (cssW / cssH), SICHT_W_MIN);
    view.h0 = view.w0 / (cssW / cssH);
    // Der Massstab ohne Zoom – an ihm zieht der Hintergrund vorbei.
    view.s0 = cssW / view.w0;
    skaliere();
    const pw = Math.round(cssW * dpr);
    const ph = Math.round(cssH * dpr);
    if (canvas.width !== pw) canvas.width = pw;
    if (canvas.height !== ph) canvas.height = ph;
    // Bei einfacher Auflösung spart die zweite Leinwand nichts: Dann malt
    // die eine alles.
    grundDpr = dpr >= 1.5 ? Math.max(1, dpr / 2) : dpr;
    const allein = grundDpr >= dpr;
    grund.style.display = allein ? "none" : "";
    grund.width = allein ? 1 : Math.round(cssW * grundDpr);
    grund.height = allein ? 1 : Math.round(cssH * grundDpr);
  }

  function skaliere() {
    view.w = view.w0 * state.zoom;
    view.h = view.h0 * state.zoom;
    view.s = view.cssW / view.w;
  }

  // Beim Malen auf die ferne Leinwand: ohne Wackeln, um den Rand versetzt.
  let fernMalen = false;
  const wackel = () => (ruhig() || fernMalen ? 0 : Math.sin(state.zeit * 61) * 4 * state.stoss);

  function bildTransform() {
    g.setTransform(view.dpr, 0, 0, view.dpr, 0, (wackel() + (fernMalen ? FERN_RAND : 0)) * view.dpr);
  }

  function weltTransform() {
    const f = view.s * view.dpr;
    g.setTransform(f, 0, 0, -f, -state.camX * f, (view.cssH + state.camY * view.s + wackel()) * view.dpr);
  }

  const bildX = (x) => (x - state.camX) * view.s;
  const bildY = (y) => view.cssH - (y - state.camY) * view.s;

  // ---------------------------------------------------------------------------
  // Vorgezeichnet
  // ---------------------------------------------------------------------------
  // Was jedes Bild gleich aussieht, wird einmal auf eine eigene Leinwand
  // gemalt und dann nur noch gestempelt: Schaumflocken, Glanz, Wolken. Ein
  // weicher Rand aus einem radialen Verlauf kostet beim Malen – einmal.
  const sprites = { fertig: false };

  function sprite(breit, hoch, malen) {
    const c = document.createElement("canvas");
    c.width = breit;
    c.height = hoch;
    malen(c.getContext("2d"), breit, hoch);
    return c;
  }

  function weicherPunkt(farbe, innen = 0.95, haerte = 0.35) {
    return sprite(64, 64, (c) => {
      const v = c.createRadialGradient(32, 32, 0, 32, 32, 32);
      v.addColorStop(0, rgb(farbe, innen));
      v.addColorStop(haerte, rgb(farbe, innen * 0.85));
      v.addColorStop(1, rgb(farbe, 0));
      c.fillStyle = v;
      c.fillRect(0, 0, 64, 64);
    });
  }

  // Ein Funkeln: ein heller Punkt mit vier Strahlen.
  function sternSprite(farbe) {
    return sprite(32, 32, (c) => {
      const kern = c.createRadialGradient(16, 16, 0, 16, 16, 7);
      kern.addColorStop(0, rgb(farbe, 1));
      kern.addColorStop(1, rgb(farbe, 0));
      c.fillStyle = kern;
      c.fillRect(0, 0, 32, 32);
      [[0, 16, 32, 16], [16, 0, 16, 32]].forEach(([x0, y0, x1, y1], i) => {
        const strahl = c.createLinearGradient(x0, y0, x1, y1);
        strahl.addColorStop(0, rgb(farbe, 0));
        strahl.addColorStop(0.5, rgb(farbe, 1));
        strahl.addColorStop(1, rgb(farbe, 0));
        c.fillStyle = strahl;
        if (i === 0) c.fillRect(0, 15, 32, 2);
        else c.fillRect(15, 4, 2, 24);
      });
    });
  }

  // Eine Wolke aus weichen Bäuschen, unten etwas dunkler – in drei Farben:
  // weiss für den Tag, pfirsich für den Abend, blaugrau für die Nacht.
  function wolkenSprite(nr, oben, unten) {
    return sprite(300, 130, (c) => {
      const puffs = 6 + (nr % 3);
      for (let i = 0; i < puffs; i += 1) {
        const px = 50 + (i / (puffs - 1)) * 200 + (hash01(nr * 13.1 + i) - 0.5) * 30;
        const r = 26 + hash01(nr * 7.7 + i * 3.3) * 30 * (1 - Math.abs(i / (puffs - 1) - 0.5));
        const py = 82 - r * 0.55 - hash01(nr * 5.3 + i) * 12;
        const v = c.createRadialGradient(px, py - r * 0.2, r * 0.15, px, py, r);
        v.addColorStop(0, rgb(oben, 0.95));
        v.addColorStop(0.6, rgb(misch(oben, unten, 0.5), 0.75));
        v.addColorStop(1, rgb(unten, 0));
        c.fillStyle = v;
        c.beginPath();
        c.arc(px, py, r, 0, Math.PI * 2);
        c.fill();
      }
    });
  }

  function bauSprites() {
    if (sprites.fertig) return;
    sprites.schaum = weicherPunkt([255, 255, 255], 0.9, 0.3);
    sprites.glanz = weicherPunkt([255, 255, 255], 1, 0.08);
    sprites.plankton = weicherPunkt([110, 255, 230], 1, 0.12);
    sprites.stern = sternSprite([255, 252, 236]);
    sprites.sternNacht = sternSprite([150, 255, 235]);
    // Der Schein unter Sonne und Mond: zur Mitte hell, nach unten blasser –
    // mittags weiss, abends orange, nachts silbern.
    sprites.strasse = [[255, 244, 210], [255, 146, 70], [190, 210, 255]].map(strasseSprite);
    sprites.wolken = [0, 1, 2].map((nr) => [
      wolkenSprite(nr, [255, 255, 255], [214, 228, 245]),
      wolkenSprite(nr, [255, 214, 170], [236, 128, 120]),
      wolkenSprite(nr, [70, 84, 130], [30, 36, 70]),
    ]);
    sprites.fertig = true;
  }

  function strasseSprite(farbe) {
    return sprite(64, 128, (c) => {
      const quer = c.createLinearGradient(0, 0, 64, 0);
      quer.addColorStop(0, rgb(farbe, 0));
      quer.addColorStop(0.5, rgb(farbe, 1));
      quer.addColorStop(1, rgb(farbe, 0));
      c.fillStyle = quer;
      c.fillRect(0, 0, 64, 128);
      c.globalCompositeOperation = "destination-in";
      const laengs = c.createLinearGradient(0, 0, 0, 128);
      laengs.addColorStop(0, "rgba(0, 0, 0, 1)");
      laengs.addColorStop(1, "rgba(0, 0, 0, 0)");
      c.fillStyle = laengs;
      c.fillRect(0, 0, 64, 128);
    });
  }

  // ---------------------------------------------------------------------------
  // Die Farben des Tages
  // ---------------------------------------------------------------------------
  // tag läuft von 0 bis 1 und wieder von vorn. Jede Farbe wird zwischen zwei
  // Stützstellen gemischt; gold sagt, wie golden das Licht ist, nacht, wie
  // dunkel es ist (Sterne, Mond, leuchtendes Plankton).
  const TAGESZEITEN = [
    { k: 0.0, oben: [96, 176, 246], unten: [196, 236, 255], fern: [104, 196, 220], nah: [52, 196, 214], tief: [10, 74, 128], insel: [96, 150, 160], gold: 0, nacht: 0 },
    { k: 0.3, oben: [52, 150, 238], unten: [172, 226, 255], fern: [70, 182, 222], nah: [30, 182, 210], tief: [6, 62, 118], insel: [86, 140, 156], gold: 0, nacht: 0 },
    { k: 0.46, oben: [82, 116, 196], unten: [255, 206, 140], fern: [160, 160, 172], nah: [44, 150, 182], tief: [12, 48, 98], insel: [120, 112, 140], gold: 1, nacht: 0 },
    { k: 0.58, oben: [64, 56, 132], unten: [255, 126, 96], fern: [180, 110, 120], nah: [52, 110, 156], tief: [16, 32, 82], insel: [86, 60, 104], gold: 1, nacht: 0.15 },
    { k: 0.68, oben: [14, 18, 52], unten: [44, 44, 98], fern: [30, 38, 80], nah: [16, 52, 98], tief: [3, 14, 42], insel: [20, 22, 48], gold: 0.1, nacht: 1 },
    { k: 0.86, oben: [8, 12, 40], unten: [32, 36, 84], fern: [22, 32, 72], nah: [12, 44, 88], tief: [2, 10, 36], insel: [14, 18, 42], gold: 0, nacht: 1 },
    { k: 0.95, oben: [86, 104, 178], unten: [255, 182, 162], fern: [150, 140, 170], nah: [40, 130, 170], tief: [8, 46, 100], insel: [90, 90, 130], gold: 0.6, nacht: 0.2 },
    { k: 1.0, oben: [96, 176, 246], unten: [196, 236, 255], fern: [104, 196, 220], nah: [52, 196, 214], tief: [10, 74, 128], insel: [96, 150, 160], gold: 0, nacht: 0 },
  ];

  const farben = {};
  function farbenBei(tag) {
    let i = 0;
    while (i < TAGESZEITEN.length - 2 && tag > TAGESZEITEN[i + 1].k) i += 1;
    const a = TAGESZEITEN[i];
    const b = TAGESZEITEN[i + 1];
    const k = clamp((tag - a.k) / (b.k - a.k), 0, 1);
    // Weich statt linear: kein Knick an den Stützstellen.
    const w = k * k * (3 - 2 * k);
    for (const name of ["oben", "unten", "fern", "nah", "tief", "insel"]) farben[name] = misch(a[name], b[name], w);
    farben.gold = lerp(a.gold, b.gold, w);
    farben.nacht = lerp(a.nacht, b.nacht, w);
    return farben;
  }

  // Die Sonne zieht von links nach rechts übers Bild und geht bei tag 0.66
  // unter; der Mond kommt in der Nacht.
  function gestirn(tag) {
    const sonne = (tag + 0.08) / 0.74;
    const mond = (tag - 0.6) / 0.38;
    return { sonne, mond };
  }

  // ---------------------------------------------------------------------------
  // Zeichnen: Himmel und fernes Meer
  // ---------------------------------------------------------------------------
  const STERNE = Array.from({ length: 110 }, (_, i) => ({
    x: hash01(i * 3.1 + 1), y: hash01(i * 5.7 + 2), r: 0.4 + hash01(i * 7.3 + 3) * 1.2, ph: hash01(i * 9.1) * 6.3,
  }));
  const WOLKEN = Array.from({ length: 5 }, (_, i) => ({
    x: (i + 0.15 + hash01(i * 3.3 + 1) * 0.6) / 5, y: 0.05 + hash01(i * 5.1 + 2) * 0.22, s: 0.55 + hash01(i * 7.7) * 0.6, nr: i % 3,
  }));
  // Die Inseln am Horizont: eine Reihe, die sich wiederholt.
  const INSEL_ABSTAND = 560;
  const INSELN = Array.from({ length: 6 }, (_, i) => ({
    x: i * INSEL_ABSTAND + hash01(i * 3.7 + 0.4) * 260,
    breit: 80 + hash01(i * 5.1) * 140,
    hoch: 12 + hash01(i * 2.3) * 18,
    palmen: 1 + Math.floor(hash01(i * 7.9) * 3),
    turm: i === 2,
  }));
  const MOEWEN = Array.from({ length: 5 }, (_, i) => ({
    x: hash01(i * 4.4 + 1), y: 0.1 + hash01(i * 6.2) * 0.22, tempo: 0.6 + hash01(i * 2.9) * 0.8, ph: hash01(i * 8.8) * 6,
  }));

  // Wo der Horizont im Bild liegt: ein gutes Drittel von oben, er zieht der
  // Kamera nur ein wenig nach.
  function horizontY() {
    const H = view.cssH;
    const ziel = H * 0.34 + view.frei * 0.5 + (state.camY + 200) * view.s0 * 0.1;
    return clamp(ziel, H * 0.2 + view.frei * 0.6, H * 0.52);
  }

  function zeichneHimmel(f, hy) {
    bildTransform();
    const W = view.cssW;
    const H = view.cssH;
    const verlauf = g.createLinearGradient(0, 0, 0, hy);
    verlauf.addColorStop(0, rgb(f.oben));
    verlauf.addColorStop(1, rgb(f.unten));
    g.fillStyle = verlauf;
    g.fillRect(0, -FERN_RAND, W, hy + 2 + FERN_RAND);

    // Sterne in der Nacht, sie funkeln.
    if (f.nacht > 0.05) {
      g.fillStyle = "#ffffff";
      STERNE.forEach((st) => {
        const a = f.nacht * (0.55 + 0.45 * Math.sin(state.zeit * 1.7 + st.ph));
        if (a <= 0.02) return;
        g.globalAlpha = a;
        g.fillRect(st.x * W, st.y * hy * 0.95, st.r, st.r);
      });
      g.globalAlpha = 1;
    }

    const { sonne, mond } = gestirn(state.tag);
    const min = Math.min(W, H);
    // Die Sonne mit ihrem Hof, abends gross und orange.
    if (sonne > -0.05 && sonne < 1.05) {
      const sx = W * lerp(0.12, 0.92, sonne);
      const sy = hy - Math.sin(Math.PI * clamp(sonne, 0, 1)) * hy * 0.78 + min * 0.02;
      const sr = min * lerp(0.045, 0.07, f.gold);
      const warm = f.gold;
      const hof = g.createRadialGradient(sx, sy, sr * 0.4, sx, sy, sr * lerp(4, 7, warm));
      hof.addColorStop(0, `rgba(255, ${Math.round(lerp(250, 196, warm))}, ${Math.round(lerp(200, 120, warm))}, ${lerp(0.55, 0.75, warm)})`);
      hof.addColorStop(1, "rgba(255, 190, 140, 0)");
      g.fillStyle = hof;
      g.fillRect(sx - sr * 7, sy - sr * 7, sr * 14, sr * 14);
      g.fillStyle = `rgb(255, ${Math.round(lerp(250, 168, warm))}, ${Math.round(lerp(214, 96, warm))})`;
      g.beginPath();
      g.arc(sx, sy, sr, 0, Math.PI * 2);
      g.fill();
    }
    // Der Mond, mit Kratern und einem kühlen Hof.
    if (mond > 0 && mond < 1 && f.nacht > 0.1) {
      const mx = W * lerp(0.15, 0.85, mond);
      const my = hy - Math.sin(Math.PI * mond) * hy * 0.7 + min * 0.03;
      const mr = min * 0.04;
      g.globalAlpha = f.nacht;
      const hof = g.createRadialGradient(mx, my, mr * 0.6, mx, my, mr * 5);
      hof.addColorStop(0, "rgba(200, 220, 255, 0.4)");
      hof.addColorStop(1, "rgba(200, 220, 255, 0)");
      g.fillStyle = hof;
      g.fillRect(mx - mr * 5, my - mr * 5, mr * 10, mr * 10);
      g.fillStyle = "#f2f4ff";
      g.beginPath();
      g.arc(mx, my, mr, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = "rgba(170, 180, 215, 0.55)";
      [[-0.3, -0.2, 0.22], [0.25, 0.15, 0.16], [0.05, 0.42, 0.12], [-0.38, 0.3, 0.1]].forEach(([dx, dy, r]) => {
        g.beginPath();
        g.arc(mx + dx * mr, my + dy * mr, r * mr, 0, Math.PI * 2);
        g.fill();
      });
      g.globalAlpha = 1;
    }

    // Wolken: drei Farben übereinander gestempelt, je nach Tageszeit. Sie
    // sind so fern, dass sie nur mit dem Wind ziehen.
    const breite = W + 420;
    const tagA = clamp(1 - f.gold - f.nacht, 0, 1);
    WOLKEN.forEach((w) => {
      const x = ((w.x * breite - state.zeit * 6) % breite + breite) % breite - 260;
      const y = w.y * hy;
      const s = w.s * min / 380;
      const bw = 300 * s;
      const bh = 130 * s;
      const sp = sprites.wolken[w.nr];
      if (tagA > 0.01) { g.globalAlpha = tagA * 0.9; g.drawImage(sp[0], x, y, bw, bh); }
      if (f.gold > 0.01) { g.globalAlpha = f.gold * 0.95; g.drawImage(sp[1], x, y, bw, bh); }
      if (f.nacht > 0.01) { g.globalAlpha = f.nacht * 0.8; g.drawImage(sp[2], x, y, bw, bh); }
    });
    g.globalAlpha = 1;
  }

  // Möwen, bei Tag.
  function zeichneMoewen(f, hy) {
    bildTransform();
    const W = view.cssW;
    const weg = state.camX * view.s0;
    const moewenA = 1 - f.nacht;
    if (moewenA > 0.05) {
      g.strokeStyle = rgb(misch([50, 60, 80], f.unten, 0.2), 0.8 * moewenA);
      g.lineWidth = 1.6;
      g.lineCap = "round";
      MOEWEN.forEach((m, i) => {
        const x = ((m.x * (W + 200) - weg * 0.18 + state.zeit * 14 * m.tempo) % (W + 200) + W + 200) % (W + 200) - 100;
        const y = m.y * hy + Math.sin(state.zeit * 0.7 + m.ph) * 6;
        const schlag = Math.sin(state.zeit * (7 + i) + m.ph) * 0.6;
        const sp = 7 + i % 3 * 2;
        g.beginPath();
        g.moveTo(x - sp, y - sp * 0.2 + schlag * sp * 0.5);
        g.quadraticCurveTo(x - sp * 0.45, y - sp * 0.5 - schlag * sp * 0.3, x, y);
        g.quadraticCurveTo(x + sp * 0.45, y - sp * 0.5 - schlag * sp * 0.3, x + sp, y - sp * 0.2 + schlag * sp * 0.5);
        g.stroke();
      });
    }
  }

  // Eine Insel am Horizont: ein flacher Buckel, Palmen, und auf einer ein
  // Leuchtturm, dessen Strahl in der Nacht über das Meer streicht.
  function insel(ix, hy, it, s, farbe, f) {
    const b = it.breit * s;
    const h = it.hoch * s;
    g.fillStyle = farbe;
    g.beginPath();
    g.moveTo(ix - b / 2, hy + 1);
    g.bezierCurveTo(ix - b * 0.3, hy - h * 1.1, ix + b * 0.2, hy - h * 1.2, ix + b / 2, hy + 1);
    g.closePath();
    g.fill();
    g.strokeStyle = farbe;
    g.lineCap = "round";
    for (let p = 0; p < it.palmen; p += 1) {
      const px = ix + (p - (it.palmen - 1) / 2) * b * 0.22 + b * 0.05;
      const fuss = hy - h * 0.8;
      const neig = (p % 2 ? 1 : -1) * 6 * s;
      const kx = px + neig;
      const ky = fuss - 26 * s - p * 4 * s;
      g.lineWidth = 2.2 * s;
      g.beginPath();
      g.moveTo(px, fuss);
      g.quadraticCurveTo(px + neig * 0.2, fuss - 14 * s, kx, ky);
      g.stroke();
      // Die Wedel wiegen sich im Wind.
      const wind = ruhig() ? 0 : Math.sin(state.zeit * 1.6 + p + it.x) * 0.12;
      g.lineWidth = 1.6 * s;
      for (let w = 0; w < 6; w += 1) {
        const a = -Math.PI * 0.95 + (w / 5) * Math.PI * 0.9 + wind;
        const l = (12 + (w % 2) * 3) * s;
        g.beginPath();
        g.moveTo(kx, ky);
        g.quadraticCurveTo(kx + Math.cos(a) * l * 0.6, ky + Math.sin(a) * l * 0.6 - 4 * s, kx + Math.cos(a) * l, ky + Math.sin(a) * l * 0.4 + 5 * s);
        g.stroke();
      }
    }
    if (it.turm) {
      const tx = ix + b * 0.28;
      const fuss = hy - h * 0.55;
      const th = 30 * s;
      g.fillStyle = farbe;
      g.beginPath();
      g.moveTo(tx - 4 * s, fuss);
      g.lineTo(tx - 2.6 * s, fuss - th);
      g.lineTo(tx + 2.6 * s, fuss - th);
      g.lineTo(tx + 4 * s, fuss);
      g.closePath();
      g.fill();
      if (f.nacht > 0.1) {
        // Das Licht oben, und sein Strahl, der sich dreht.
        const lx = tx;
        const ly = fuss - th - 2 * s;
        const dreh = state.zeit * 0.9;
        const richt = Math.cos(dreh);
        g.save();
        g.globalCompositeOperation = "lighter";
        g.globalAlpha = f.nacht * 0.5 * Math.abs(richt);
        const lang = 260 * s;
        const strahl = g.createLinearGradient(lx, ly, lx + richt * lang, ly);
        strahl.addColorStop(0, "rgba(255, 240, 180, 0.9)");
        strahl.addColorStop(1, "rgba(255, 240, 180, 0)");
        g.fillStyle = strahl;
        g.beginPath();
        g.moveTo(lx, ly);
        g.lineTo(lx + richt * lang, ly - 14 * s);
        g.lineTo(lx + richt * lang, ly + 10 * s);
        g.closePath();
        g.fill();
        g.globalAlpha = f.nacht;
        g.drawImage(sprites.glanz, lx - 7 * s, ly - 7 * s, 14 * s, 14 * s);
        g.restore();
      }
    }
  }

  // Ein Delfin, der ab und zu im fernen Meer springt – wann und wo, sagt die
  // Uhr der Runde, nicht der Zufall der Dünung.
  function delfin(W, hy, H, f) {
    const takt = 7;
    const nr = Math.floor(state.zeit / takt);
    if (hash01(nr * 1.7 + 0.3) < 0.35) return;
    const k = (state.zeit - nr * takt) / 1.3;
    if (k < 0 || k > 1) return;
    const s = Math.min(W, H) / 420;
    const x0 = W * (0.45 + hash01(nr * 3.1) * 0.45);
    const tiefe = hy + (H - hy) * (0.06 + hash01(nr * 5.9) * 0.08);
    const x = x0 + k * 60 * s;
    const y = tiefe - Math.sin(Math.PI * k) * 34 * s;
    const w = Math.atan2(-Math.cos(Math.PI * k) * 34 * Math.PI, 60);
    g.save();
    g.translate(x, y);
    g.rotate(w);
    g.fillStyle = rgb(misch(f.tief, f.fern, 0.25), 0.95);
    g.beginPath();
    g.moveTo(12 * s, 0);
    g.quadraticCurveTo(4 * s, -4 * s, -8 * s, -1 * s);
    g.lineTo(-13 * s, -4 * s);
    g.lineTo(-11 * s, 0.5 * s);
    g.lineTo(-13 * s, 4 * s);
    g.lineTo(-8 * s, 1.5 * s);
    g.quadraticCurveTo(2 * s, 4 * s, 12 * s, 0);
    g.moveTo(0, -3 * s);
    g.lineTo(-3 * s, -8 * s);
    g.lineTo(-4 * s, -2.5 * s);
    g.fill();
    g.restore();
    // Spritzer beim Auftauchen und Eintauchen.
    if (k < 0.15 || k > 0.85) {
      const sx = k < 0.5 ? x0 : x0 + 60 * s;
      g.fillStyle = `rgba(255, 255, 255, ${0.7 * (1 - Math.abs(k - (k < 0.5 ? 0 : 1)) / 0.15)})`;
      g.beginPath();
      g.ellipse(sx, tiefe, 8 * s, 2 * s, 0, 0, Math.PI * 2);
      g.fill();
    }
  }

  // Wo die Strasse aus Licht liegt (unter Sonne oder Mond) und wie hell sie ist.
  function lichtStrasse(f, W) {
    const { sonne, mond } = gestirn(state.tag);
    if (sonne > 0 && sonne < 1) {
      return {
        stx: W * lerp(0.12, 0.92, sonne),
        staerke: lerp(0.2, 0.9, f.gold) * (1 - f.nacht),
        farbe: misch([255, 250, 220], [255, 170, 90], f.gold),
        mondLicht: false,
      };
    }
    if (mond > 0 && mond < 1 && f.nacht > 0.2) {
      return { stx: W * lerp(0.15, 0.85, mond), staerke: 0.5 * f.nacht, farbe: [210, 225, 255], mondLicht: true };
    }
    return null;
  }

  // Das ferne Meer: Verlauf, Dunst auf der Kimm und der Schein unter Sonne
  // oder Mond. Langsam – es liegt mit dem Himmel auf der fernen Leinwand.
  function zeichneMeerFlaeche(f, hy) {
    bildTransform();
    const W = view.cssW;
    const H = view.cssH;
    const meer = g.createLinearGradient(0, hy, 0, H);
    meer.addColorStop(0, rgb(f.fern));
    meer.addColorStop(1, rgb(misch(f.nah, f.tief, 0.45)));
    g.fillStyle = meer;
    g.fillRect(0, hy, W, H - hy + FERN_RAND);
    // Ein heller Dunst auf der Kimm.
    const dunst = g.createLinearGradient(0, hy - 12, 0, hy + 10);
    dunst.addColorStop(0, rgb(f.unten, 0));
    dunst.addColorStop(0.5, rgb(misch(f.unten, [255, 255, 255], 0.3), 0.55));
    dunst.addColorStop(1, rgb(f.fern, 0));
    g.fillStyle = dunst;
    g.fillRect(0, hy - 12, W, 22);

    const l = lichtStrasse(f, W);
    if (!l || l.staerke <= 0.02) return;
    const s = Math.min(W, H) / 420;
    g.save();
    g.globalCompositeOperation = "lighter";
    // Ein weicher Schein, der zum Betrachter hin breiter wird – in Scheiben
    // gestempelt, jede etwas breiter als die darüber.
    const lagen = l.mondLicht
      ? [[sprites.strasse[2], 1]]
      : [[sprites.strasse[0], 1 - f.gold], [sprites.strasse[1], f.gold]];
    const scheiben = 28;
    lagen.forEach(([schein, anteil]) => {
      if (anteil < 0.02) return;
      for (let i = 0; i < scheiben; i += 1) {
        const k0 = i / scheiben;
        const k1 = (i + 1) / scheiben;
        const y0 = hy + k0 * (H - hy);
        const breit = (10 + Math.pow(k1, 1.2) * 220) * s;
        g.globalAlpha = l.staerke * 0.42 * anteil;
        g.drawImage(schein, 0, k0 * 128, 64, 128 / scheiben, l.stx - breit / 2, y0, breit, (H - hy) / scheiben + 0.5);
      }
    });
    g.restore();
  }

  // Was sich in der Ferne schnell bewegt, kommt jedes Bild: die Inseln, das
  // Funkeln auf der Strasse aus Licht, ab und zu ein Delfin.
  function zeichneFernesMeer(f, hy) {
    bildTransform();
    const W = view.cssW;
    const H = view.cssH;

    // Die Inseln.
    const weg = state.camX * view.s0;
    const periode = INSELN.length * INSEL_ABSTAND;
    const s = Math.min(W, H) / 420;
    const inselFarbe = rgb(misch(f.insel, f.unten, 0.28));
    INSELN.forEach((it) => {
      const ix = ((it.x - weg * 0.07) % periode + periode) % periode - 200;
      if (ix < -250 || ix > W + 250) return;
      insel(ix, hy, it, s, inselFarbe, f);
    });

    // Funkeln auf der Strasse aus Licht: jeder Funke an seinem Platz, er
    // blitzt auf und vergeht.
    const l = lichtStrasse(f, W);
    if (l && l.staerke > 0.02) {
      const { stx, staerke, farbe } = l;
      g.save();
      g.globalCompositeOperation = "lighter";
      g.fillStyle = rgb(farbe);
      for (let i = 0; i < 90; i += 1) {
        const tiefe = Math.pow(hash01(i * 1.37 + 0.5), 1.4);
        const blitz = Math.sin(state.zeit * (1.6 + hash01(i * 3.3) * 2.6) + i * 1.9);
        if (blitz < 0.15) continue;
        const y = hy + 1 + tiefe * (H - hy);
        const dx = (hash01(i * 2.71) - 0.5) * 2 * (3 + tiefe * 100) * s;
        const breit = (2 + hash01(i * 5.1) * 6 + tiefe * 12) * s * blitz;
        g.globalAlpha = staerke * blitz * (1 - tiefe * 0.5);
        g.fillRect(stx + dx - breit / 2, y, breit, Math.max(1, (0.8 + tiefe * 1.4) * s));
      }
      g.restore();
    }
    if (1 - f.nacht > 0.2) delfin(W, hy, H, f);
  }

  // ---------------------------------------------------------------------------
  // Zeichnen: das Wasser, auf dem er surft
  // ---------------------------------------------------------------------------
  // Die Oberfläche wird je Bild einmal abgetastet – etwa alle sechs
  // Bildpunkte – und für Füllung, Glanzkante und Schaum benutzt.
  const PUNKTE = new Float32Array(2 * 800);
  let punkteN = 0;

  function oberflaecheAbtasten() {
    const x0 = state.camX - 12;
    const x1 = state.camX + view.w + 12;
    wellenBis(lageU(x1) + 600);
    const schritt = Math.max(2, 6 / view.s);
    punkteN = 0;
    for (let x = x0; ; x += schritt) {
      const xx = Math.min(x, x1);
      PUNKTE[punkteN * 2] = xx;
      PUNKTE[punkteN * 2 + 1] = wasserAbs(xx) + kraeuseln(xx);
      punkteN += 1;
      if (xx >= x1 || punkteN >= 799) break;
    }
  }

  function oberflaechePfad(dy = 0, ab = 0) {
    g.moveTo(PUNKTE[ab * 2], PUNKTE[ab * 2 + 1] + dy);
    for (let i = ab + 1; i < punkteN; i += 1) g.lineTo(PUNKTE[i * 2], PUNKTE[i * 2 + 1] + dy);
  }

  // Wo das Meer vor der Brecherwelle beginnt: Links davon verdeckt sie es,
  // dort wird keine Kante, kein Schaum und kein Glitzern gezeichnet.
  const meerAb = () => state.brecher.x + 36;

  function kanteAb() {
    const x = meerAb();
    let i = 0;
    while (i < punkteN - 2 && PUNKTE[i * 2] < x) i += 1;
    return i;
  }

  // Die Füllung des Wassers: oben hell und durchscheinend, unten tief. Der
  // Verlauf hängt an der Höhe in der Welt – ein hoher Kamm ist heller als ein
  // tiefes Tal. Die Brecherwelle ist mit demselben gefüllt.
  function macheVerlauf(f) {
    const wasser = g.createLinearGradient(0, 250, 0, Math.min(-260, state.camY - 40));
    wasser.addColorStop(0, rgb(misch(f.nah, [235, 255, 250], 0.25)));
    wasser.addColorStop(0.32, rgb(f.nah));
    wasser.addColorStop(0.7, rgb(misch(f.nah, f.tief, 0.65)));
    wasser.addColorStop(1, rgb(f.tief));
    wasserVerlauf = wasser;
  }

  // Das Wasser liegt über dem Fuss der Brecherwelle: Wo sie unter die
  // Oberfläche reicht, verschwindet sie darin – ohne Kante.
  function zeichneWasser(f) {
    weltTransform();
    const unten = state.camY - 40;
    const x0 = PUNKTE[0];
    const x1 = PUNKTE[(punkteN - 1) * 2];
    g.fillStyle = wasserVerlauf;
    g.beginPath();
    oberflaechePfad();
    g.lineTo(x1, unten);
    g.lineTo(x0, unten);
    g.closePath();
    g.fill();

    g.save();
    g.clip();
    // Licht im Wasser: Unter jedem Kamm scheint es hell durch – dort ist die
    // Welle dünn. In der Nacht leuchtet das Plankton.
    const licht = f.nacht > 0.5 ? [60, 255, 210] : misch([150, 255, 228], [255, 206, 150], f.gold * 0.7);
    const lichtA = f.nacht > 0.5 ? 0.2 : 0.34;
    const w = state.wellen;
    const uLinks = lageU(state.camX - 300);
    const uRechts = lageU(state.camX + view.w + 300);
    for (let i = 1; i < w.length - 1; i += 1) {
      const p = w[i];
      if (p.u < uLinks) continue;
      if (p.u > uRechts) break;
      if (!(p.y > w[i - 1].y && p.y > w[i + 1].y)) continue;
      const cx = p.u + DRIFT * state.lauf;
      const cy = wasserBei(p.u) - 34;
      const r = 110 + (p.y - Math.min(w[i - 1].y, w[i + 1].y)) * 0.35;
      const schein = g.createRadialGradient(cx, cy, 4, cx, cy, r);
      schein.addColorStop(0, rgb(licht, lichtA));
      schein.addColorStop(0.55, rgb(licht, lichtA * 0.35));
      schein.addColorStop(1, rgb(licht, 0));
      g.fillStyle = schein;
      g.fillRect(cx - r, cy - r, r * 2, r * 2);
    }

    // Lagen im Wasser: hellere Bänder unter der Oberfläche, die der Welle
    // folgen – das Wasser bekommt Tiefe.
    g.lineJoin = "round";
    g.lineCap = "round";
    [[-16, 9, 0.1], [-44, 14, 0.06], [-90, 20, 0.04]].forEach(([dy, breit, a]) => {
      g.strokeStyle = rgb(misch(f.nah, [255, 255, 255], 0.5), a * (1 - f.nacht * 0.5));
      g.lineWidth = breit;
      g.beginPath();
      oberflaechePfad(dy);
      g.stroke();
    });
    g.restore();

  }

  // Die Kante des Wassers: Glanz, Schaumlinie, Glitzern und Schaumkronen –
  // scharf über der gröber gemalten Fläche.
  function zeichneWasserKante(f) {
    weltTransform();
    const ab = kanteAb();
    // Glanzkante und Schaumlinie.
    g.strokeStyle = `rgba(255, 255, 255, ${lerp(0.28, 0.14, f.nacht)})`;
    g.lineWidth = 6 / view.s;
    g.beginPath();
    oberflaechePfad(-3.5 / view.s, ab);
    g.stroke();
    g.strokeStyle = f.nacht > 0.5
      ? `rgba(150, 255, 235, ${lerp(0.8, 0.9, f.nacht)})`
      : "rgba(255, 255, 255, 0.85)";
    g.lineWidth = 2.2 / view.s;
    g.beginPath();
    oberflaechePfad(0, ab);
    g.stroke();

    // Glitzern: kleine Sterne knapp unter der Oberfläche, die an der Welle
    // haften, mitlaufen und aufblitzen. Nahe der Sonne mehr.
    const { sonne } = gestirn(state.tag);
    const sonneX = sonne > 0 && sonne < 1 ? state.camX + view.w * lerp(0.12, 0.92, sonne) : null;
    g.save();
    g.globalCompositeOperation = "lighter";
    const raster = 11;
    const u0 = Math.floor(lageU(state.camX) / raster);
    const u1 = Math.ceil(lageU(state.camX + view.w) / raster);
    const stern = f.nacht > 0.5 ? sprites.sternNacht : sprites.stern;
    const px = 1 / view.s;
    for (let i = u0; i <= u1; i += 1) {
      const h = hash01(i * 0.731 + 5.5);
      const x = i * raster + DRIFT * state.lauf + (hash01(i * 3.7) - 0.5) * raster;
      if (x < meerAb()) continue;
      const nahSonne = sonneX === null ? 0 : clamp(1 - Math.abs(x - sonneX) / (view.w * 0.3), 0, 1);
      if (h < 0.84 - nahSonne * 0.3) continue;
      const blitz = Math.sin(state.zeit * (2.2 + h * 3) + i * 2.1);
      if (blitz < 0.2) continue;
      const y = wasserAbs(x) + kraeuseln(x) - (2 + hash01(i * 1.9) * 9) * px;
      const r = (3 + h * 5 + nahSonne * 4) * px * blitz;
      g.globalAlpha = Math.min(1, blitz * (0.55 + nahSonne * 0.45) * (1 - f.nacht * 0.4));
      g.drawImage(stern, x - r, y - r, r * 2, r * 2);
    }
    g.restore();

    // Schaumkronen auf den Kämmen.
    zeichneKronen(f);
  }

  function zeichneKronen(f) {
    const w = state.wellen;
    const uLinks = lageU(state.camX - 80);
    const uRechts = lageU(state.camX + view.w + 80);
    const nacht = f.nacht > 0.5;
    const flocke = nacht ? sprites.plankton : sprites.schaum;
    g.save();
    if (nacht) g.globalCompositeOperation = "lighter";
    for (let i = 1; i < w.length - 1; i += 1) {
      const p = w[i];
      if (p.u < uLinks) continue;
      if (p.u > uRechts) break;
      if (!(p.y > w[i - 1].y && p.y > w[i + 1].y)) continue;
      if (p.u + DRIFT * state.lauf - 30 < meerAb()) continue;
      // Je höher der Kamm, desto mehr Schaum – und er schäumt nach vorn über,
      // in Richtung der Wellen.
      const menge = clamp((p.y + 20) / 200, 0.35, 1);
      const n = Math.round(6 + menge * 10);
      for (let j = 0; j < n; j += 1) {
        const k = j / (n - 1);
        const u = p.u - 30 + k * (50 + 70 * menge) + Math.sin(state.zeit * 2.2 + j * 1.3 + i) * 3;
        const x = u + DRIFT * state.lauf;
        const y = wasserBei(u) - 1 + hash01(i * 3.1 + j) * 4 - k * k * 6;
        const r = (6 + hash01(i * 5.7 + j * 2.1) * 9) * (0.75 + menge * 0.6) * (1 - Math.abs(k - 0.35) * 0.7);
        g.globalAlpha = (nacht ? 0.6 : 0.8) * (0.65 + 0.35 * Math.sin(state.zeit * 3 + j));
        g.drawImage(flocke, x - r, y - r * 0.7, r * 2, r * 1.4);
      }
    }
    g.restore();
  }

  // Die Spur aus Schaum, die das Brett hinterlässt – sie haftet am Wasser und
  // läuft mit der Welle mit.
  function zeichneKielwasser(f) {
    if (!state.kielwasser.length) return;
    weltTransform();
    const nacht = f.nacht > 0.5;
    g.save();
    if (nacht || state.flow) g.globalCompositeOperation = "lighter";
    const flocke = nacht ? sprites.plankton : sprites.schaum;
    state.kielwasser.forEach((p) => {
      const k = clamp(1 - p.alter / 1.6, 0, 1);
      if (k <= 0) return;
      const x = p.u + DRIFT * state.lauf;
      if (x < meerAb()) return;
      const r = (3 + (1 - k) * 9) * p.breit;
      g.globalAlpha = k * (nacht ? 0.75 : 0.6);
      g.drawImage(flocke, x - r, wasserBei(p.u) - r * 0.45, r * 2, r);
      if (p.flow) {
        g.globalAlpha = k * 0.55;
        g.drawImage(sprites.glanz, x - r * 0.6, wasserBei(p.u) + 1 - r * 0.3, r * 1.2, r * 0.6);
      }
    });
    g.restore();
  }

  // ---------------------------------------------------------------------------
  // Zeichnen: die Brecherwelle
  // ---------------------------------------------------------------------------
  /*
   * Eine Wand aus Wasser, gemessen ab ihrer Vorderkante (x = 0): Hinten ein
   * breiter Rücken, vorn ein Kamm, dessen Lippe nach rechts überschlägt und
   * als Vorhang ins Wasser fällt. Zwischen Wand und Vorhang die Röhre, durch
   * die das Licht scheint; am Fuss die Walze aus Schaum. Die Höhe zählt ab der
   * Mitte der Dünung, nach hinten wird sie mit den Wellen höher. Gefüllt wird
   * sie mit demselben Verlauf wie das Meer: Wo sie Wasser verdeckt, sieht man
   * keine Kante.
   */
  const brecherHoehe = () => lerp(250, 370, schwereBei(state.brecher.x));
  let wasserVerlauf = null;

  // Ein Punkt auf einer kubischen Kurve – für den Schaum entlang der Lippe.
  const kubisch = (p0, p1, p2, p3, t) => {
    const m = 1 - t;
    return m * m * m * p0 + 3 * m * m * t * p1 + 3 * m * t * t * p2 + t * t * t * p3;
  };

  // Unten endet sie knapp unter der Mitte der Dünung: Tiefer ist ohnehin
  // Wasser, mit demselben Verlauf gemalt.
  function brecherPfad(H) {
    const boden = -H * 0.16 - 50;
    g.beginPath();
    g.moveTo(-2600, boden);
    g.lineTo(-2600, H * 0.66);
    g.bezierCurveTo(-1500, H * 0.68, -650, H * 0.8, -240, H * 0.95);
    g.bezierCurveTo(-130, H * 1.03, 30, H * 1.05, 92, H * 0.9);
    g.bezierCurveTo(124, H * 0.8, 130, H * 0.62, 110, H * 0.5);
    g.bezierCurveTo(100, H * 0.58, 80, H * 0.65, 52, H * 0.66);
    g.bezierCurveTo(10, H * 0.67, -28, H * 0.5, -24, H * 0.28);
    g.bezierCurveTo(-20, H * 0.08, 0, -H * 0.04, 40, -H * 0.16);
    g.lineTo(40, boden);
    g.closePath();
  }

  // vorn: Vorhang, Kante und Schaum – scharf, vor dem Surfer. Sonst der
  // Körper der Welle, mit der Fläche des Meeres gröber gemalt.
  function zeichneBrecher(f, vorn) {
    const b = state.brecher;
    if (b.x + 260 < state.camX || b.x - 300 > state.camX + view.w) return;
    const H = brecherHoehe();
    const z = state.zeit;
    const nacht = f.nacht > 0.5;
    const flocke = nacht ? sprites.plankton : sprites.schaum;
    const licht = nacht ? [70, 255, 215] : misch([170, 255, 232], [255, 214, 160], f.gold * 0.7);
    weltTransform();
    g.save();
    g.translate(b.x, 0);

    // Hinten (in der Fläche, gröber gemalt): Körper, Licht und Röhre.
    if (!vorn) {
      // Der Körper, mit dem Verlauf des Meeres.
      g.fillStyle = wasserVerlauf;
      brecherPfad(H);
      g.fill();

      g.save();
      g.clip();
      // Licht durch die dünne Wand unter dem Kamm.
      const schein = g.createRadialGradient(10, H * 0.82, 6, 10, H * 0.82, H * 0.62);
      schein.addColorStop(0, rgb(licht, nacht ? 0.35 : 0.55));
      schein.addColorStop(0.6, rgb(licht, nacht ? 0.1 : 0.16));
      schein.addColorStop(1, rgb(licht, 0));
      g.fillStyle = schein;
      g.fillRect(10 - H * 0.62, H * 0.2, H * 1.24, H * 1.24);
      g.restore();

      // Die Röhre: zwischen Wand und Vorhang, innen hell, wo das Licht durch
      // den Vorhang fällt.
      const roehre = g.createRadialGradient(56, H * 0.3, 4, 40, H * 0.34, H * 0.42);
      roehre.addColorStop(0, rgb(misch(misch(f.nah, licht, 0.7), [255, 255, 255], nacht ? 0 : 0.25)));
      roehre.addColorStop(0.45, rgb(misch(f.nah, licht, 0.4)));
      roehre.addColorStop(1, rgb(misch(f.nah, f.tief, 0.55)));
      g.fillStyle = roehre;
      g.beginPath();
      g.moveTo(110, H * 0.5);
      g.bezierCurveTo(100, H * 0.58, 80, H * 0.65, 52, H * 0.66);
      g.bezierCurveTo(10, H * 0.67, -28, H * 0.5, -24, H * 0.28);
      g.bezierCurveTo(-20, H * 0.08, 0, -H * 0.04, 40, -H * 0.16);
      g.lineTo(124, -H * 0.16);
      g.quadraticCurveTo(116, H * 0.26, 110, H * 0.5);
      g.closePath();
      g.fill();
      g.restore();
      return;
    }

    // Der Vorhang: Wasser, das von der Lippe fällt – man sieht hindurch.
    const wackeln = ruhig() ? 0 : Math.sin(z * 8) * 2;
    const vorhang = g.createLinearGradient(0, H * 0.52, 0, 0);
    vorhang.addColorStop(0, "rgba(255, 255, 255, 0.75)");
    vorhang.addColorStop(0.5, rgb(misch(licht, [255, 255, 255], 0.5), 0.45));
    vorhang.addColorStop(1, "rgba(255, 255, 255, 0.2)");
    g.fillStyle = vorhang;
    g.beginPath();
    g.moveTo(98, H * 0.52);
    g.quadraticCurveTo(116 + wackeln, H * 0.24, 112, -4);
    g.lineTo(130, -4);
    g.quadraticCurveTo(124 + wackeln, H * 0.26, 112, H * 0.5);
    g.closePath();
    g.fill();

    // Eine helle Kante entlang Kamm und Lippe.
    g.strokeStyle = nacht ? "rgba(150, 255, 235, 0.9)" : "rgba(255, 255, 255, 0.85)";
    g.lineWidth = 3 / view.s;
    g.beginPath();
    g.moveTo(-2600, H * 0.66);
    g.bezierCurveTo(-1500, H * 0.68, -650, H * 0.8, -240, H * 0.95);
    g.bezierCurveTo(-130, H * 1.03, 30, H * 1.05, 92, H * 0.9);
    g.bezierCurveTo(124, H * 0.8, 130, H * 0.62, 110, H * 0.5);
    g.stroke();

    // Schaum: auf dem Rücken, auf der Lippe, die Fahne aus Gischt, die der
    // Wind vom Kamm nach hinten weht, und die Walze am Fuss.
    if (nacht) g.globalCompositeOperation = "lighter";
    const viel = ruhig() ? 0.5 : 1;
    for (let i = 0; i < 14 * viel; i += 1) {
      const t = i / (14 * viel - 1);
      const x = kubisch(-240, -130, 30, 92, t);
      const y = kubisch(H * 0.95, H * 1.03, H * 1.05, H * 0.9, t) + Math.sin(z * 5 + i * 1.7) * 3;
      const r = 9 + hash01(i * 3.3) * 10 + t * 8;
      g.globalAlpha = 0.8;
      g.drawImage(flocke, x - r, y - r * 0.8, r * 2, r * 1.6);
    }
    for (let i = 0; i < 16 * viel; i += 1) {
      const h = hash01(i * 2.9 + 0.7);
      const k = (z * (0.45 + h * 0.35) + h) % 1;
      const x = 70 - k * (180 + h * 120);
      const y = H * (0.98 + k * (0.22 + h * 0.12));
      const r = (8 + h * 10) * (1 + k * 1.4);
      g.globalAlpha = (1 - k) * 0.55;
      g.drawImage(flocke, x - r, y - r, r * 2, r * 2);
    }
    for (let i = 0; i < 10 * viel; i += 1) {
      const t = 0.45 + hash01(i * 7.7) * 0.5;
      const x = kubisch(-2600, -1500, -650, -240, t);
      const y = kubisch(H * 0.66, H * 0.68, H * 0.8, H * 0.95, t) + Math.sin(z * 2 + i) * 3;
      const r = 14 + hash01(i * 1.3) * 18;
      g.globalAlpha = 0.45;
      g.drawImage(flocke, x - r, y - r * 0.5, r * 2, r);
    }
    // Die Walze: wirbelnder Schaum am Fuss, vorn am dichtesten. Sie liegt
    // auf dem Wasser davor, wie hoch die Dünung dort auch steht – so sieht
    // man nicht, wo die Wand aufhört und das Meer beginnt.
    const walze = Math.round(34 * viel);
    for (let i = 0; i < walze; i += 1) {
      const h = hash01(i * 7.13);
      const kreis = z * (2.4 + h * 1.5) + i * 1.1;
      const x = -40 + h * 230 + Math.cos(kreis) * 12;
      const boden = Math.max(-H * 0.06, wasserAbs(b.x + x));
      const y = boden + hash01(i * 2.7) * H * 0.24 * (1 - Math.abs(x - 110) / 280) + Math.sin(kreis) * 9;
      const r = 14 + hash01(i * 4.1) * 20;
      g.globalAlpha = 0.7 + 0.25 * Math.sin(kreis * 1.3);
      g.drawImage(flocke, x - r, y - r, r * 2, r * 2);
    }
    // Spritzer, wo der Vorhang aufschlägt.
    for (let i = 0; i < 10 * viel; i += 1) {
      const h = hash01(i * 5.3 + 2.1);
      const k = (z * (0.9 + h * 0.6) + h) % 1;
      const x = 120 + k * (40 + h * 70);
      const y = Math.max(0, wasserAbs(b.x + x)) + H * (0.08 + Math.sin(Math.PI * k) * (0.18 + h * 0.14));
      const r = 6 + h * 8;
      g.globalAlpha = (1 - k) * 0.85;
      g.drawImage(flocke, x - r, y - r, r * 2, r * 2);
    }
    g.globalAlpha = 1;
    g.globalCompositeOperation = "source-over";
    g.restore();
  }

  // Ist die Welle noch nicht im Bild: ein Schleier aus Gischt am linken Rand,
  // je näher sie kommt, desto dichter.
  function zeichneBrecherRand(f) {
    const abstand = state.camX - (state.brecher.x + 60);
    if (abstand <= 0 || state.phase === "bereit") return;
    const nah = clamp(1 - luecke() / 700, 0, 1) * clamp(abstand / 60, 0, 1);
    if (nah <= 0.01) return;
    bildTransform();
    const breit = view.cssW * 0.16;
    const schleier = g.createLinearGradient(0, 0, breit, 0);
    schleier.addColorStop(0, `rgba(255, 255, 255, ${0.42 * nah})`);
    schleier.addColorStop(1, "rgba(255, 255, 255, 0)");
    g.fillStyle = schleier;
    g.fillRect(0, 0, breit, view.cssH);
    // Und Gischt, die von links ins Bild weht.
    const flocke = f.nacht > 0.5 ? sprites.plankton : sprites.schaum;
    const n = ruhig() ? 4 : 12;
    for (let i = 0; i < n; i += 1) {
      const h = hash01(i * 4.7 + 1);
      const lauf = (state.zeit * (0.5 + h * 0.6) + h) % 1;
      const x = lauf * breit * 1.4 - 20;
      const y = view.cssH * (0.25 + hash01(i * 2.3) * 0.75) - lauf * 40;
      const r = 10 + h * 22;
      g.globalAlpha = nah * (1 - lauf) * 0.8;
      g.drawImage(flocke, x - r, y - r, r * 2, r * 2);
    }
    g.globalAlpha = 1;
  }

  // ---------------------------------------------------------------------------
  // Zeichnen: der Surfer
  // ---------------------------------------------------------------------------
  const GROESSE = 1.3;
  const SURFER_RGB = {
    anzug: [21, 56, 92], akzent: [255, 122, 61], haut: [233, 185, 139], haar: [59, 36, 20],
    deck: [255, 246, 224], streifen: [255, 90, 54], rand: [226, 181, 127], finne: [38, 48, 62],
  };
  const FARBEN_SURFER = {};
  // In der Nacht hellt das Mondlicht ihn auf – sonst wäre er nur ein Schatten.
  function surferFarben(f) {
    for (const [name, c] of Object.entries(SURFER_RGB)) {
      const dunkel = name === "anzug" || name === "haar" || name === "finne";
      FARBEN_SURFER[name] = rgb(misch(c, dunkel ? [96, 128, 200] : [170, 190, 235], f.nacht * (dunkel ? 0.62 : 0.3)));
    }
    return FARBEN_SURFER;
  }

  function brett(f, glanz) {
    g.fillStyle = f.rand;
    g.beginPath();
    g.moveTo(-17, 0.4);
    g.quadraticCurveTo(-18, 3, -14.5, 3.4);
    g.lineTo(11, 3.4);
    g.quadraticCurveTo(17, 3.4, 19.5, 6.2);
    g.quadraticCurveTo(17.5, 1.4, 12, 0);
    g.lineTo(-14, 0);
    g.quadraticCurveTo(-17, 0, -17, 0.4);
    g.closePath();
    g.fill();
    g.fillStyle = f.deck;
    g.beginPath();
    g.moveTo(-16, 1.8);
    g.quadraticCurveTo(-16.4, 3.1, -14.2, 3.3);
    g.lineTo(11, 3.3);
    g.quadraticCurveTo(16, 3.3, 18.6, 5.4);
    g.quadraticCurveTo(16, 2.2, 11.5, 1.6);
    g.lineTo(-14, 1.6);
    g.closePath();
    g.fill();
    g.fillStyle = f.streifen;
    g.fillRect(-13, 2.1, 25, 0.75);
    g.fillStyle = f.finne;
    g.beginPath();
    g.moveTo(-12, 0.2);
    g.lineTo(-15.5, -3.4);
    g.lineTo(-11, 0.2);
    g.closePath();
    g.fill();
    if (glanz > 0) {
      g.strokeStyle = `rgba(255, 255, 255, ${glanz})`;
      g.lineWidth = 0.7;
      g.beginPath();
      g.moveTo(-10, 3.2);
      g.lineTo(9, 3.2);
      g.stroke();
    }
  }

  // Der Surfer, die Füsse auf dem Brett bei (0, 0), das Brett entlang x.
  // hocke: 0 gestreckt … 1 geduckt; flug: 0 auf dem Wasser … 1 in der Luft
  // (Arme hoch); dreh: beim Wipeout der Körper für sich.
  function surfer(x, y, winkel, hocke, flug, f, alpha, dreh = 0) {
    g.save();
    g.globalAlpha = alpha;
    g.translate(x, y);
    g.rotate(winkel);
    g.scale(GROESSE, GROESSE);
    if (!dreh) brett(f, 0.6);
    if (dreh) g.rotate(dreh);
    g.lineCap = "round";
    g.lineJoin = "round";
    const hx = lerp(-0.5, 1.2, hocke);
    const hy = lerp(16.5, 10.5, hocke) + 3.4;
    const fussH = -7;
    const fussV = 6.5;
    const knie = lerp(9.5, 6.8, hocke) + 3.4;
    // Beine
    g.strokeStyle = f.anzug;
    g.lineWidth = 3.1;
    g.beginPath();
    g.moveTo(fussH, 3.6);
    g.lineTo(lerp(-6, -2.8, hocke), knie);
    g.lineTo(hx - 1, hy);
    g.moveTo(fussV, 3.6);
    g.lineTo(lerp(5.4, 9, hocke), knie);
    g.lineTo(hx + 1, hy);
    g.stroke();
    // Rumpf, nach vorn geneigt.
    const neig = lerp(0.18, 0.78, hocke) + flug * 0.06;
    const sx = hx + Math.sin(neig) * 11.5;
    const sy = hy + Math.cos(neig) * 11.5;
    g.lineWidth = 4.4;
    g.beginPath();
    g.moveTo(hx, hy);
    g.lineTo(sx, sy);
    g.stroke();
    g.strokeStyle = f.akzent;
    g.lineWidth = 1.2;
    g.beginPath();
    g.moveTo(hx + 1.3, hy + 2);
    g.lineTo(sx + 1.2, sy - 1);
    g.stroke();
    // Arme: auf dem Wasser zur Balance ausgestreckt, in der Luft hoch.
    const wedel = Math.sin(state.zeit * 3.1) * 0.15;
    g.strokeStyle = f.anzug;
    g.lineWidth = 2.4;
    g.beginPath();
    const vorn = lerp(-0.55, 0.9, flug) + wedel;
    const hinten = lerp(2.5, 2.1, flug) - wedel;
    g.moveTo(sx, sy);
    g.lineTo(sx + Math.cos(vorn) * 5.5, sy + Math.sin(vorn) * 5.5);
    g.lineTo(sx + Math.cos(vorn) * 10.5, sy + Math.sin(vorn) * 10.5 + 1);
    g.moveTo(sx, sy);
    g.lineTo(sx + Math.cos(hinten) * 5.5, sy + Math.sin(hinten) * 5.5);
    g.lineTo(sx + Math.cos(hinten) * 10, sy + Math.sin(hinten) * 10 + flug * 2);
    g.stroke();
    // Kopf mit Haar.
    const kx = sx + Math.sin(neig) * 4.4;
    const ky = sy + Math.cos(neig) * 4.4;
    g.fillStyle = f.haut;
    g.beginPath();
    g.arc(kx, ky, 3.3, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = f.haar;
    g.beginPath();
    g.arc(kx - 0.4, ky + 0.8, 3.4, Math.PI * 0.15, Math.PI * 1.1);
    g.fill();
    g.restore();
  }

  // Der Geist: derselbe Surfer, ganz in seiner Farbe.
  function geistFarben(farbe) {
    return { anzug: farbe, akzent: farbe, haut: farbe, haar: farbe, deck: farbe, streifen: farbe, rand: farbe, finne: farbe };
  }

  function zeichneSurfer(f) {
    const sv = state.s;
    surferFarben(f);
    if (state.wipe) {
      const w = state.wipe;
      weltTransform();
      // Das Brett fliegt für sich davon.
      g.save();
      g.translate(w.bx, w.by);
      g.rotate(w.bdreh);
      g.scale(GROESSE, GROESSE);
      brett(FARBEN_SURFER, 0.4);
      g.restore();
      if (w.sichtbar > 0) surfer(w.x, w.y, 0, 0.2, 1, FARBEN_SURFER, w.sichtbar, w.dreh);
      return;
    }
    weltTransform();
    const x = absX();
    let y = sv.y;
    if (state.amBoden) y += kraeuseln(x) * 0.8 - (gedrueckt ? 0.8 : 0);
    // Im Flow ein Leuchten ums Brett; in der Nacht leuchtet das Plankton,
    // wo es das Wasser aufwühlt.
    if (state.flow || (f.nacht > 0.3 && state.amBoden)) {
      g.save();
      g.globalCompositeOperation = "lighter";
      if (state.flow) {
        g.globalAlpha = 0.55 + 0.2 * Math.sin(state.zeit * 9);
        g.drawImage(sprites.glanz, x - 44, y - 16, 88, 40);
      }
      if (f.nacht > 0.3 && state.amBoden) {
        g.globalAlpha = f.nacht * 0.7;
        g.drawImage(sprites.plankton, x - 40, y - 14, 80, 30);
      }
      g.restore();
    }
    const flug = state.amBoden ? 0 : clamp(state.flugZeit * 4, 0, 1);
    zeichneSpur();
    surfer(x, y, state.winkel, state.hocke, flug, FARBEN_SURFER, 1);
  }

  function zeichneSpur() {
    const n = state.spur.length;
    if (n < 2) return;
    g.save();
    g.globalCompositeOperation = "lighter";
    g.lineCap = "round";
    for (let i = 1; i < n; i += 1) {
      const k = i / (n - 1);
      const a = state.spur[i - 1];
      const b = state.spur[i];
      g.strokeStyle = `rgba(110, 255, 210, ${(k * 0.55).toFixed(3)})`;
      g.lineWidth = 1 + k * 8;
      g.beginPath();
      g.moveTo(a.x, a.y);
      g.lineTo(b.x, b.y);
      g.stroke();
    }
    g.restore();
  }

  // Die Gegner (geist.js): Surfer aus Licht auf ihrem Weg – über ihrer
  // eigenen Dünung, nicht über dieser. Im Multiplayer ist die Dünung
  // dieselbe: Dann liegen sie auf dem Wasser.
  function zeichneGeister() {
    if (!gegner || state.phase === "bereit") return;
    const orte = window.LernappGeist?.orte?.(gegner) || [];
    if (!orte.length) return;
    weltTransform();
    const gleicheWelt = Boolean(shell.live);
    const liste = orte.map((o) => {
      const x = START_U + o.a;
      let y = o.b;
      if (gleicheWelt) {
        const boden = wasserAbs(x);
        if (y - boden < 3) y = boden;
      }
      return { ...o, x, y };
    });
    liste.forEach((o) => {
      // Wem im Multiplayer zugeschaut wird, der ist der Surfer selbst – kein
      // Geist dazu, nur sein Name (geist.js, namen).
      if (o.ziel) return;
      surfer(o.x, o.y, (o.c || 0) / 100, 0.3, 0, geistFarben(o.farbe), 0.42 * o.blass);
    });
    window.LernappGeist.namen(g, liste.map((o) => {
      const dx = o.x - absX();
      return { ...o, sx: bildX(o.x), sy: bildY(o.y + 42), weit: `${dx > 0 ? "+" : ""}${Math.round(dx / METER)} m` };
    }), { breit: view.cssW, hoch: view.cssH });
  }

  // Alle hundert Meter eine kleine gelbe Boje, und Platz 1 und die eigene
  // Bestmarke als grosse Boje mit Fähnchen bei ihren Metern.
  function zeichneBojen() {
    const ziele = shell.live ? [] : (gegner?.gegner?.() || []).filter((z) => z.art !== "alle" && z.punkte > 0);
    const links = state.camX - 40;
    const rechts = state.camX + view.w + 40;
    bildTransform();
    const gross = Math.round(clamp(view.cssH * 0.026, 10, 13));
    g.textAlign = "center";
    g.textBaseline = "bottom";
    const schwanken = (x) => (ruhig() ? 0 : Math.sin(state.zeit * 2.2 + x * 0.01) * 0.18);

    const von = Math.max(100, Math.ceil(meterBei(links) / 100) * 100);
    for (let m = von; START_U + m * METER <= rechts; m += 100) {
      const x = START_U + m * METER;
      const sx = bildX(x);
      const sy = bildY(wasserAbs(x) + kraeuseln(x));
      const s = clamp(view.s, 0.7, 1.4);
      g.save();
      g.translate(sx, sy);
      g.rotate(schwanken(x));
      g.fillStyle = "#ffd23f";
      g.beginPath();
      g.ellipse(0, -4 * s, 6 * s, 7 * s, 0, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = "#e2731c";
      g.fillRect(-6 * s, -5 * s, 12 * s, 2.5 * s);
      g.restore();
      g.font = `800 ${gross}px system-ui, sans-serif`;
      g.fillStyle = "rgba(255, 255, 255, 0.9)";
      g.fillText(`${m} m`, sx, sy - 14 * s);
    }

    ziele.forEach((z) => {
      const x = START_U + z.punkte * METER;
      if (x < links || x > rechts) return;
      const sx = bildX(x);
      const sy = bildY(wasserAbs(x) + kraeuseln(x));
      const s = clamp(view.s, 0.75, 1.5);
      g.save();
      g.translate(sx, sy);
      g.rotate(schwanken(x) * 1.3);
      g.fillStyle = "#ffffff";
      g.beginPath();
      g.ellipse(0, -6 * s, 9 * s, 10 * s, 0, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = z.farbe;
      g.fillRect(-9 * s, -8 * s, 18 * s, 4 * s);
      g.strokeStyle = "#3a3f55";
      g.lineWidth = 1.6 * s;
      g.beginPath();
      g.moveTo(0, -14 * s);
      g.lineTo(0, -42 * s);
      g.stroke();
      const wehen = ruhig() ? 0 : Math.sin(state.zeit * 6) * 2 * s;
      g.fillStyle = z.farbe;
      g.beginPath();
      g.moveTo(0, -42 * s);
      g.quadraticCurveTo(10 * s, -40 * s + wehen, 20 * s, -37 * s + wehen);
      g.lineTo(0, -30 * s);
      g.closePath();
      g.fill();
      g.restore();
      const text = `${z.art === "eigen" ? "Bestmarke" : z.name} ${z.punkte} m`;
      g.font = `900 ${gross}px system-ui, sans-serif`;
      g.lineWidth = 3;
      g.strokeStyle = "rgba(20, 30, 60, 0.6)";
      g.strokeText(text, sx, sy - 46 * s);
      g.fillStyle = "#ffffff";
      g.fillText(text, sx, sy - 46 * s);
    });
  }

  // ---------------------------------------------------------------------------
  // Zeichnen: Teilchen, Linse, Schriften, Anzeige
  // ---------------------------------------------------------------------------
  function zeichneTeile(f) {
    if (!state.teile.length) return;
    weltTransform();
    const nacht = f.nacht > 0.5;
    state.teile.forEach((t) => {
      const k = clamp(t.leben / t.max, 0, 1);
      if (t.art === "tropfen") {
        g.globalAlpha = Math.min(1, k * 1.6);
        g.fillStyle = nacht ? "#9ffff0" : t.farbe;
        g.fillRect(t.x - t.r / 2, t.y - t.r / 2, t.r, t.r);
      } else if (t.art === "gischt") {
        g.globalAlpha = k * 0.7;
        const r = t.r * (1.8 - k * 0.8);
        g.drawImage(nacht ? sprites.plankton : sprites.schaum, t.x - r, t.y - r, r * 2, r * 2);
      } else if (t.art === "funke") {
        g.save();
        g.globalCompositeOperation = "lighter";
        g.globalAlpha = k;
        const r = t.r * (0.6 + k * 0.6);
        g.drawImage(sprites.glanz, t.x - r * 2, t.y - r * 2, r * 4, r * 4);
        g.restore();
      }
    });
    g.globalAlpha = 1;
  }

  // Wasser auf der Linse, wenn die Welle ganz nah ist.
  function zeichneTropfen() {
    if (!state.tropfen.length) return;
    bildTransform();
    state.tropfen.forEach((t) => {
      const k = clamp(t.leben / t.max, 0, 1);
      // Ein Tropfen: innen klar, am Rand ein Hauch, oben links ein Glanzpunkt.
      g.globalAlpha = Math.min(1, k * 2) * 0.45;
      const v = g.createRadialGradient(t.x, t.y, t.r * 0.2, t.x, t.y, t.r);
      v.addColorStop(0, "rgba(255, 255, 255, 0.05)");
      v.addColorStop(0.8, "rgba(255, 255, 255, 0.18)");
      v.addColorStop(1, "rgba(255, 255, 255, 0.55)");
      g.fillStyle = v;
      g.beginPath();
      g.ellipse(t.x, t.y, t.r, t.r * 1.12, 0, 0, Math.PI * 2);
      g.fill();
      g.globalAlpha = Math.min(1, k * 2) * 0.8;
      g.fillStyle = "#ffffff";
      g.beginPath();
      g.arc(t.x - t.r * 0.35, t.y - t.r * 0.4, t.r * 0.18, 0, Math.PI * 2);
      g.fill();
    });
    g.globalAlpha = 1;
  }

  function zeichneSchriften() {
    if (!state.schriften.length) return;
    bildTransform();
    g.textAlign = "center";
    g.textBaseline = "middle";
    state.schriften.forEach((s) => {
      const k = clamp(s.leben / s.max, 0, 1);
      const pop = 1 + Math.max(0, (k - 0.85) * 4);
      g.globalAlpha = Math.min(1, k * 2);
      g.font = `900 ${Math.round(s.gross * clamp(view.s, 0.85, 1.5) * pop)}px system-ui, sans-serif`;
      g.lineWidth = 4;
      g.strokeStyle = "rgba(10, 30, 60, 0.6)";
      const x = bildX(s.x);
      const y = bildY(s.y) - (1 - k) * 34;
      g.strokeText(s.text, x, y);
      g.fillStyle = s.farbe;
      g.fillText(s.text, x, y);
    });
    g.globalAlpha = 1;
  }

  // Wie nah die Welle ist: in Welteinheiten (luecke) und in Metern.
  const luecke = () => Math.max(0, absX() - state.brecher.x - FANG);
  const vorsprung = () => luecke() / METER;

  function pille(x, y, w, h, farbe) {
    g.fillStyle = farbe;
    g.beginPath();
    if (g.roundRect) g.roundRect(x, y, w, h, h / 2);
    else g.rect(x, y, w, h);
    g.fill();
  }

  // Eine kleine Welle als Zeichen: ein Bogen, der sich überschlägt.
  function wellenZeichen(x, y, r, farbe) {
    g.strokeStyle = farbe;
    g.lineWidth = r * 0.28;
    g.lineCap = "round";
    g.beginPath();
    g.moveTo(x - r, y + r * 0.55);
    g.quadraticCurveTo(x - r * 0.2, y + r * 0.5, x - r * 0.1, y - r * 0.2);
    g.quadraticCurveTo(x + r * 0.1, y - r * 0.85, x + r * 0.75, y - r * 0.45);
    g.quadraticCurveTo(x + r * 0.2, y - r * 0.45, x + r * 0.25, y + r * 0.05);
    g.stroke();
  }

  function zeichneAnzeige() {
    if (state.phase === "bereit") return;
    bildTransform();
    // Auf dem Handy liegt der obere Rand unter den Knöpfen: dann darunter.
    g.translate(0, shell?.frei?.(canvas) || 0);
    const W = view.cssW;
    const H = view.cssH;
    const gross = clamp(H * 0.05, 14, 24);

    g.font = `900 ${Math.round(gross)}px system-ui, sans-serif`;
    g.textAlign = "left";
    g.textBaseline = "middle";
    const text = `${state.meter} m`;
    const w = g.measureText(text).width + gross * 1.1;
    pille(12, 12, w, gross * 1.6, "rgba(8, 30, 60, 0.5)");
    g.fillStyle = "#ffffff";
    g.fillText(text, 12 + gross * 0.55, 12 + gross * 0.82);

    // Darunter: wie viel Vorsprung vor der Welle – und der Flow.
    const klein = Math.round(gross * 0.62);
    const y = 12 + gross * 1.6 + 6;
    const h = klein * 1.8;
    const m = Math.round(vorsprung());
    const gefahr = clamp(1 - luecke() / 800, 0, 1);
    const puls = gefahr > 0.6 && !ruhig() ? 0.5 + 0.5 * Math.sin(state.zeit * 10) : 0;
    const farbe = misch(misch([20, 60, 90], [210, 120, 20], clamp(gefahr * 1.5, 0, 1)), [220, 40, 40], clamp(gefahr * 2 - 1, 0, 1));
    g.font = `800 ${klein}px system-ui, sans-serif`;
    const welle = `${m} m`;
    const tw = g.measureText(welle).width;
    const bw = h * 1.05 + tw + klein * 0.9;
    pille(12, y, bw, h, rgb(farbe, 0.62 + puls * 0.3));
    wellenZeichen(12 + h * 0.55, y + h * 0.52, h * 0.32, "#ffffff");
    g.fillStyle = "#ffffff";
    g.fillText(welle, 12 + h * 1.0, y + h * 0.54);

    // Der Flow: drei Punkte, die sich mit jeder perfekten Landung füllen –
    // oder, im Flow, was es bringt.
    const fx = 12 + bw + 8;
    if (state.flow) {
      const titel = `Flow ×${state.serie}`;
      const tw2 = g.measureText(titel).width;
      const bw2 = tw2 + klein * 1.4;
      const verlauf = g.createLinearGradient(fx, y, fx + bw2, y);
      verlauf.addColorStop(0, "#26d0ce");
      verlauf.addColorStop(1, "#6effc8");
      g.fillStyle = verlauf;
      g.beginPath();
      if (g.roundRect) g.roundRect(fx, y, bw2, h, h / 2);
      else g.rect(fx, y, bw2, h);
      g.fill();
      g.fillStyle = "#04363a";
      g.fillText(titel, fx + klein * 0.7, y + h * 0.54);
    } else {
      const label = "Flow";
      const lw = g.measureText(label).width;
      const bw2 = klein * 0.7 + 3 * klein * 1.05 + klein * 0.4 + lw + klein * 0.8;
      pille(fx, y, bw2, h, "rgba(8, 30, 60, 0.45)");
      for (let i = 0; i < 3; i += 1) {
        const cx = fx + klein * 0.7 + klein * 0.45 + i * klein * 1.05;
        g.beginPath();
        g.arc(cx, y + h / 2, klein * 0.36, 0, Math.PI * 2);
        g.fillStyle = i < state.serie ? "#6effc8" : "rgba(255, 255, 255, 0.25)";
        g.fill();
      }
      g.fillStyle = state.serie ? "#c8fff0" : "rgba(255, 255, 255, 0.75)";
      g.fillText(label, fx + klein * 0.7 + 3 * klein * 1.05 + klein * 0.4, y + h * 0.54);
    }

    // Die Einblendung, wenn der Flow angeht oder ausgeht.
    const seitBeginn = state.zeit - state.flowZeit;
    const seitEnde = state.zeit - state.flowAusZeit;
    const banner = seitBeginn < 2.2
      ? { titel: "FLOW!", text: "Schneller – und jede perfekte Landung gibt mehr", farbe: "#6effc8", t: seitBeginn, dauer: 2.2 }
      : seitEnde < 1.8
        ? { titel: "Flow weg", text: "Schräg gelandet – drei perfekte, und du bist wieder drin", farbe: "#e0f4ff", t: seitEnde, dauer: 1.8 }
        : null;
    if (banner) {
      const a = Math.min(1, banner.t * 5, (banner.dauer - banner.t) * 3);
      g.globalAlpha = clamp(a, 0, 1);
      const titelGross = Math.round(clamp(W * 0.09, 26, 48));
      const by = H * 0.24;
      g.textAlign = "center";
      g.font = `900 ${titelGross}px system-ui, sans-serif`;
      g.lineWidth = 5;
      g.strokeStyle = "rgba(4, 40, 60, 0.55)";
      g.strokeText(banner.titel, W / 2, by);
      g.fillStyle = banner.farbe;
      g.fillText(banner.titel, W / 2, by);
      g.font = `800 ${Math.round(clamp(W * 0.032, 12, 17))}px system-ui, sans-serif`;
      g.lineWidth = 4;
      g.strokeStyle = "rgba(4, 30, 60, 0.6)";
      g.strokeText(banner.text, W / 2, by + titelGross * 0.85, W - 24);
      g.fillStyle = "#ffffff";
      g.fillText(banner.text, W / 2, by + titelGross * 0.85, W - 24);
      g.globalAlpha = 1;
    }
  }

  // Ist die Welle nah, pulsiert der Rand des Bildes – erst weiss, dann rot.
  function zeichneGefahr() {
    if (state.phase !== "spiel" && state.phase !== "zuschauen") return;
    const l = luecke();
    if (l > 600) return;
    const k = clamp(1 - l / 600, 0, 1);
    const puls = ruhig() ? 0.6 : 0.6 + 0.4 * Math.sin(state.zeit * (6 + k * 6));
    bildTransform();
    const W = view.cssW;
    const H = view.cssH;
    const farbe = misch([255, 255, 255], [255, 60, 50], clamp(k * 1.4 - 0.3, 0, 1));
    const a = 0.46 * k * puls;
    // Vier Streifen am Rand statt einer Fläche über das ganze Bild: Was in
    // der Mitte durchsichtig wäre, wird gar nicht erst gemalt.
    const d = Math.min(W, H) * 0.16;
    [[0, d], [H, H - d]].forEach(([y0, y1]) => {
      const v = g.createLinearGradient(0, y0, 0, y1);
      v.addColorStop(0, rgb(farbe, a));
      v.addColorStop(1, rgb(farbe, 0));
      g.fillStyle = v;
      g.fillRect(0, Math.min(y0, y1), W, d);
    });
    [[0, d], [W, W - d]].forEach(([x0, x1]) => {
      const v = g.createLinearGradient(x0, 0, x1, 0);
      v.addColorStop(0, rgb(farbe, a));
      v.addColorStop(1, rgb(farbe, 0));
      g.fillStyle = v;
      g.fillRect(Math.min(x0, x1), 0, d, H);
    });
  }

  /*
   * Der Hintergrund – Himmel, Sonne, Mond, Sterne, Wolken, das ferne Meer mit
   * dem Schein darauf – ändert sich langsam. Er wird nur jedes sechste Bild
   * neu gemalt, auf eine eigene Leinwand, die oben und unten FERN_RAND
   * übersteht; dazwischen wird sie nur gestempelt, um so viel verschoben, wie
   * der Horizont seither gewandert ist. Was sich schnell bewegt – Möwen,
   * Inseln, Funkeln, Delfine –, kommt jedes Bild darüber.
   */
  const fern = { leinwand: null, g: null, hy: 0, alter: 99, dpr: 0, breit: 0, hoch: 0 };

  function zeichneFerne(f, hy) {
    const breit = Math.round(view.cssW * view.dpr);
    const hoch = Math.round((view.cssH + 2 * FERN_RAND) * view.dpr);
    if (!fern.leinwand) {
      fern.leinwand = document.createElement("canvas");
      fern.g = fern.leinwand.getContext("2d", { alpha: false });
    }
    fern.alter += 1;
    if (fern.alter >= 6 || fern.dpr !== view.dpr || fern.breit !== breit || fern.hoch !== hoch || Math.abs(hy - fern.hy) > 24) {
      if (fern.breit !== breit || fern.hoch !== hoch) {
        fern.leinwand.width = breit;
        fern.leinwand.height = hoch;
      }
      Object.assign(fern, { alter: 0, dpr: view.dpr, breit, hoch, hy });
      const haupt = g;
      g = fern.g;
      fernMalen = true;
      zeichneHimmel(f, hy);
      zeichneMeerFlaeche(f, hy);
      fernMalen = false;
      g = haupt;
    }
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.drawImage(fern.leinwand, 0, Math.round((hy - fern.hy - FERN_RAND + wackel()) * view.dpr));
    zeichneMoewen(f, hy);
    zeichneFernesMeer(f, hy);
  }

  function zeichnen() {
    if (!g) return;
    bauSprites();
    const f = farbenBei(state.tag);
    const hy = horizontY();
    oberflaecheAbtasten();
    const haupt = g;
    const dprHaupt = view.dpr;
    const getrennt = grund.style.display !== "none";
    if (getrennt) {
      g = gGrund;
      view.dpr = grundDpr;
    }
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.fillStyle = rgb(f.tief);
    g.fillRect(0, 0, g.canvas.width, g.canvas.height);
    zeichneFerne(f, hy);
    weltTransform();
    macheVerlauf(f);
    zeichneBrecher(f, false);
    zeichneWasser(f);
    if (getrennt) {
      g = haupt;
      view.dpr = dprHaupt;
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.clearRect(0, 0, canvas.width, canvas.height);
    }
    zeichneWasserKante(f);
    zeichneKielwasser(f);
    zeichneBojen();
    zeichneGeister();
    zeichneSurfer(f);
    zeichneTeile(f);
    zeichneBrecher(f, true);
    zeichneBrecherRand(f);
    zeichneTropfen();
    zeichneSchriften();
    zeichneGefahr();
    zeichneAnzeige();
  }

  // ---------------------------------------------------------------------------
  // Teilchen und Schriften
  // ---------------------------------------------------------------------------
  const TEILE_MAX = 240;

  function teil(t) {
    if (state.teile.length >= TEILE_MAX) state.teile.shift();
    state.teile.push(t);
  }

  // Spritzer: kleine Tropfen, die nach hinten oben fliegen und fallen.
  function spritzer(x, y, anzahl, vx, vy, streu, farbe = "#ffffff") {
    if (ruhig()) anzahl = Math.ceil(anzahl / 3);
    for (let i = 0; i < anzahl; i += 1) {
      teil({
        art: "tropfen", x: x + (Math.random() - 0.5) * 6, y: y + Math.random() * 3,
        vx: vx + (Math.random() - 0.5) * streu, vy: vy + (Math.random() - 0.3) * streu,
        r: 1 + Math.random() * 1.8, farbe, leben: 0.4 + Math.random() * 0.45, max: 0.85,
      });
    }
  }

  function gischt(x, y, anzahl, vx = 0, vy = 40) {
    if (ruhig()) anzahl = Math.ceil(anzahl / 3);
    for (let i = 0; i < anzahl; i += 1) {
      teil({
        art: "gischt", x: x + (Math.random() - 0.5) * 14, y: y + Math.random() * 4,
        vx: vx * (0.4 + Math.random() * 0.6) + (Math.random() - 0.5) * 50, vy: vy * (0.5 + Math.random()),
        r: 4 + Math.random() * 6, leben: 0.6 + Math.random() * 0.5, max: 1.1,
      });
    }
  }

  function funken(x, y, anzahl, farbe) {
    if (ruhig()) anzahl = Math.ceil(anzahl / 3);
    for (let i = 0; i < anzahl; i += 1) {
      const w = Math.random() * Math.PI;
      const v = 60 + Math.random() * 180;
      teil({ art: "funke", x, y, vx: Math.cos(w) * v, vy: Math.sin(w) * v, r: 2 + Math.random() * 2.5, farbe, leben: 0.5 + Math.random() * 0.4, max: 0.9 });
    }
  }

  function schrift(text, x, y, farbe, gross) {
    state.schriften.push({ text, x, y, farbe, gross, leben: 1.15, max: 1.15 });
  }

  // ---------------------------------------------------------------------------
  // Die Fahrt
  // ---------------------------------------------------------------------------
  // Gerechnet wird im Mass der Wellen (u): Dort steht die Dünung still, und
  // es ist dieselbe Rechnung wie auf festen Hügeln.
  function physik(dt) {
    const v = state.s;
    const gEff = gedrueckt ? G_SCHWER : G_LEICHT;
    v.vy -= gEff * dt;
    if (state.flow) {
      const tempo = Math.max(1, Math.hypot(v.vu, v.vy));
      v.vu += (v.vu / tempo) * FLOW_SCHUB * dt;
      v.vy += (v.vy / tempo) * FLOW_SCHUB * dt;
    }
    v.u += v.vu * dt;
    v.y += v.vy * dt;
    // Luft- und Wasserwiderstand: kaum spürbar, bei hohem Tempo mehr.
    const schnell = Math.hypot(v.vu, v.vy);
    const bremse = 1 - (0.01 + Math.max(0, schnell - (state.flow ? 940 : 760)) * 0.0005) * dt;
    v.vu *= bremse;
    v.vy *= bremse;

    const boden = wasserBei(v.u);
    if (v.y <= boden) {
      const s = steigungBei(v.u);
      const len = Math.hypot(1, s);
      const tx = 1 / len;
      const ty = s / len;
      const nx = -s / len;
      const ny = 1 / len;
      const vn = v.vu * nx + v.vy * ny;
      const vt = v.vu * tx + v.vy * ty;
      // Ein Hüpfer zählt nicht als Landung – erst ein richtiger Flug.
      if (!state.amBoden && state.flugZeit > 0.3 && state.flugHoehe > 14) landung(vn, vt, s);
      if (vn < 0) {
        v.vu -= vn * nx;
        v.vy -= vn * ny;
      }
      v.y = boden;
      state.amBoden = true;
      state.flugZeit = 0;
      state.flugHoehe = 0;
      // Das Wasser bremst, je schwerer, desto mehr.
      const t0 = v.vu * tx + v.vy * ty;
      if (t0 > 0) {
        const reibung = gedrueckt ? REIBUNG_SCHWER + BERGAUF * Math.max(0, ty) : REIBUNG_LEICHT;
        const weniger = Math.min(t0, reibung * dt);
        v.vu -= weniger * tx;
        v.vy -= weniger * ty;
      }
      // Er paddelt, wenn er zu langsam wird – stehen bleibt er nie.
      const jetzt = v.vu * tx + v.vy * ty;
      if (jetzt < V_MIN) {
        v.vu += (V_MIN - jetzt) * tx;
        v.vy += (V_MIN - jetzt) * ty;
      }
    } else if (v.y > boden + 1.5) {
      if (state.amBoden && v.vy > 160) {
        // Er hebt ab: ein Spritzer vom Kamm.
        spritzer(absX(), boden, 10, -v.vu * 0.15, 140, 120);
      }
      state.amBoden = false;
      state.flugZeit += dt;
      state.flugHoehe = Math.max(state.flugHoehe, v.y - boden);
    }
    const tempo = Math.hypot(v.vu, v.vy);
    const hoechstens = state.flow ? V_MAX * FLOW_TEMPO : V_MAX;
    if (tempo > hoechstens) {
      v.vu *= hoechstens / tempo;
      v.vy *= hoechstens / tempo;
    }
  }

  // Wie er landet: auf der Rückseite eines Kamms, im Winkel des Wassers, ist
  // es perfekt. Schräg hinein klatscht es und kostet Tempo.
  function landung(vn, vt, steigung) {
    const v = state.s;
    const x = absX();
    const winkel = Math.atan2(Math.abs(vn), Math.max(1, Math.abs(vt)));
    if (steigung < -0.05 && winkel < PERFEKT_WINKEL && vt > 0) {
      state.perfekt += 1;
      state.landungen.perfekt += 1;
      state.serie += 1;
      const schub = state.flow ? 1.12 : 1.08;
      v.vu *= schub;
      v.vy *= schub;
      if (state.serie >= 3 && !state.flow) {
        state.flow = true;
        state.flowZeit = state.zeit;
        kids()?.playJingle?.("win");
      } else if (state.flow) {
        schrift(`Perfekt! ×${state.serie}`, x, v.y + 46, "#6effc8", 16);
        kids()?.playJingle?.("star");
      } else {
        schrift(`Perfekt! ${state.serie}/3`, x, v.y + 46, "#ffffff", 16);
        kids()?.playJingle?.("star");
      }
      // Eine Fontäne nach hinten oben, und Glanz.
      spritzer(x - 8, v.y, 22, -v.vu * 0.25, 260, 160);
      funken(x, v.y + 6, 8, "#ffffff");
      kids()?.vibrate?.(10);
    } else if (winkel > SCHLECHT_WINKEL) {
      state.landungen.hart += 1;
      if (state.flow) state.flowAusZeit = state.zeit;
      else if (state.serie > 0) schrift("Geklatscht – Serie weg", x, v.y + 46, "#e0f0ff", 13);
      state.serie = 0;
      state.flow = false;
      v.vu *= 0.84;
      v.vy *= 0.84;
      gischt(x, v.y, 12, -v.vu * 0.3, 90);
      spritzer(x, v.y, 18, 0, 220, 220);
      state.stoss = Math.max(state.stoss, 0.25);
      kids()?.vibrate?.(18);
    } else {
      state.landungen.gut += 1;
      spritzer(x, v.y, 10, -v.vu * 0.2, 160, 120);
      gischt(x, v.y, 4, -v.vu * 0.2, 40);
    }
  }

  // Die Welle rückt nach: mit ihrem Tempo, aber nie weiter zurück als
  // BRECHER_WEIT. dl ist die Zeit der Runde, die vergangen ist.
  function brecherTakt(dl) {
    const b = state.brecher;
    b.v = brecherTempo(state.lauf);
    b.x += b.v * dl;
    b.x = Math.max(b.x, absX() - BRECHER_WEIT);
  }

  function pruefeFang() {
    const abstand = absX() - state.brecher.x;
    if (abstand > FANG) {
      // Knapp entkommen? Ein kurzer Ruf.
      state.knapp = Math.min(state.knapp, abstand);
      if (state.knapp < FANG + 35 && abstand > FANG + 110) {
        schrift("Knapp!", absX(), state.s.y + 60, "#ffe08a", 18);
        kids()?.playJingle?.("unlock");
        state.knapp = Infinity;
      }
      return;
    }
    wipeout();
  }

  // Die Welle hat ihn: Er wirbelt durch die Gischt, das Brett fliegt davon.
  function wipeout() {
    if (state.phase !== "spiel") return;
    state.phase = "aus";
    wirbeln();
    kids()?.playJingle?.("retry");
    kids()?.vibrate?.([30, 40, 60]);
    stepTimer = window.setTimeout(finish, 1150);
  }

  function wirbeln() {
    const x = absX();
    const v = state.s;
    state.wipe = {
      zeit: state.zeit, x, y: v.y + 8, vx: 160 + Math.max(0, v.vu) * 0.2, vy: 330, dreh: 0, sichtbar: 1,
      bx: x + 4, by: v.y + 4, bvx: 300, bvy: 480, bdreh: 0,
    };
    state.flow = false;
    state.stoss = 1;
    gischt(x, v.y + 10, 30, 160, 140);
    spritzer(x, v.y + 10, 40, 120, 340, 300);
  }

  function wipeTakt(dt) {
    const w = state.wipe;
    if (!w) return;
    // Er fliegt nach vorn oben, dreht sich und verschwindet in der Walze.
    w.vy -= 900 * dt;
    w.x += w.vx * dt;
    w.y += w.vy * dt;
    const boden = wasserAbs(w.x);
    if (w.y < boden - 6) {
      w.y = boden - 6;
      w.vy = 0;
      w.vx = state.brecher.v * 0.9;
      w.sichtbar = Math.max(0, w.sichtbar - dt * 1.6);
    }
    w.dreh += dt * 9;
    w.bvy -= 900 * dt;
    w.bx += w.bvx * dt;
    w.by += w.bvy * dt;
    w.bdreh += dt * 11;
    const bb = wasserAbs(w.bx);
    if (w.by < bb) { w.by = bb; w.bvy = Math.abs(w.bvy) * 0.25; w.bvx *= 0.6; }
    if (Math.random() < dt * 30) gischt(w.x, boden, 1, 120, 60);
  }

  function takt(dt) {
    state.zeit += dt;
    if (state.stoss > 0) state.stoss = Math.max(0, state.stoss - dt * 2.2);
    const sv = state.s;

    if (state.phase === "spiel") {
      state.lauf += dt;
      const n = Math.max(1, Math.ceil(dt / TAKT));
      for (let i = 0; i < n; i += 1) physik(dt / n);
      brecherTakt(dt);
      pruefeFang();
      const meter = Math.floor(meterBei(absX()));
      if (meter !== state.meter) {
        if (Math.floor(meter / 100) > Math.floor(state.meter / 100)) kids()?.playJingle?.("tap");
        state.meter = meter;
        state.punkte = meter;
        shell.setCount(meter);
      }
      gegner?.takt(state.punkte, { a: Math.round(absX() - START_U), b: Math.round(sv.y), c: Math.round(state.winkel * 100) });
    } else if (state.phase === "zuschauen") {
      zuschauenTakt(dt);
    } else if (state.phase === "aus") {
      state.lauf += dt;
      brecherTakt(dt);
      wipeTakt(dt);
    } else if (state.phase === "bereit") {
      // Vor dem ersten Druck wartet er oben auf dem Kamm und wippt.
      sv.y = wasserBei(sv.u);
    }

    // Das Brett: auf dem Wasser im Winkel der Welle, in der Luft in der
    // Richtung seines Flugs. Weich nachgeführt, damit nichts zuckt.
    if (state.phase !== "zuschauen" && state.phase !== "aus") {
      const ziel = state.amBoden
        ? Math.atan(steigungBei(sv.u))
        : Math.atan2(sv.vy, Math.max(1, sv.vu)) * 0.85;
      state.winkel += (ziel - state.winkel) * (1 - Math.exp(-dt * (state.amBoden ? 22 : 9)));
      state.hocke += ((gedrueckt ? 1 : state.amBoden ? 0.35 : 0) - state.hocke) * (1 - Math.exp(-dt * 12));
    }
    if (state.phase === "bereit") {
      state.winkel = Math.atan(steigungBei(sv.u)) + (ruhig() ? 0 : Math.sin(state.zeit * 2.2) * 0.04);
      state.hocke = 0.5 + (ruhig() ? 0 : Math.sin(state.zeit * 2.2) * 0.15);
    }

    // Kielwasser und Spray, solange er auf dem Wasser ist.
    if ((state.phase === "spiel" || state.phase === "zuschauen") && state.amBoden) {
      state.kielTakt += dt;
      while (state.kielTakt >= 1 / 40) {
        state.kielTakt -= 1 / 40;
        state.kielwasser.push({ u: sv.u - Math.cos(state.winkel) * 14, alter: 0, breit: gedrueckt ? 1.25 : 1, flow: state.flow });
        if (state.kielwasser.length > 70) state.kielwasser.shift();
      }
      const tempo = Math.hypot(sv.vu, sv.vy);
      const menge = tempo * dt / (gedrueckt ? 12 : 24);
      if (Math.random() < menge % 1 || menge >= 1) {
        const x = absX() - Math.cos(state.winkel) * 15;
        spritzer(x, sv.y + 2, Math.max(1, Math.floor(menge)), -tempo * 0.25, 120 + (gedrueckt ? 120 : 30), 90, state.flow ? "#d6fff4" : "#ffffff");
      }
    }
    state.kielwasser.forEach((p) => { p.alter += dt; });
    // Das Band aus Licht im Flow: Es wächst hinter ihm her und vergeht danach.
    if (state.flow && !state.wipe && dt > 0) state.spur.push({ x: absX() - Math.cos(state.winkel) * 10, y: sv.y + 7, t: state.zeit });
    while (state.spur.length && (state.zeit - state.spur[0].t > 0.15 || state.spur.length > 40)) state.spur.shift();
    while (state.kielwasser.length && state.kielwasser[0].alter > 1.6) state.kielwasser.shift();

    for (let i = state.teile.length - 1; i >= 0; i -= 1) {
      const t = state.teile[i];
      if (t.art === "gischt") { t.vy -= 120 * dt; t.vx *= 1 - 1.5 * dt; } else if (t.art === "funke") { t.vy -= 200 * dt; } else t.vy -= 900 * dt;
      t.x += t.vx * dt;
      t.y += t.vy * dt;
      t.leben -= dt;
      if (t.leben <= 0) state.teile.splice(i, 1);
    }
    for (let i = state.schriften.length - 1; i >= 0; i -= 1) {
      state.schriften[i].leben -= dt;
      if (state.schriften[i].leben <= 0) state.schriften.splice(i, 1);
    }

    // Die Welle ganz nah: Gischt spritzt auf die Linse.
    const l = luecke();
    if ((state.phase === "spiel" || state.phase === "zuschauen" || state.phase === "aus") && l < 280 && !ruhig() && Math.random() < dt * (state.phase === "aus" ? 14 : 5)) {
      state.tropfen.push({ x: Math.random() * view.cssW * 0.55, y: Math.random() * view.cssH, r: 5 + Math.random() * 10, leben: 1.4, max: 1.4 });
      if (state.tropfen.length > 9) state.tropfen.shift();
    }
    for (let i = state.tropfen.length - 1; i >= 0; i -= 1) {
      const t = state.tropfen[i];
      t.leben -= dt;
      t.y += dt * (8 + (1.4 - t.leben) * 40);
      if (t.leben <= 0) state.tropfen.splice(i, 1);
    }
    if (l < 160 && state.phase !== "bereit") state.stoss = Math.max(state.stoss, 0.15 * (1 - l / 160));

    // Der Tag zieht mit der Strecke vorbei.
    state.tag = (TAG_START + state.meter / TAG_STRECKE) % 1;

    kamera(dt);
  }

  // Die Kamera: der Surfer bei gut zwei Fünfteln der Breite, die Mitte der
  // Dünung bei gut einem Drittel der Höhe – tiefer, wenn die Täler es
  // verlangen. Fliegt er hoch, zoomt sie heraus. Ist die Welle nah, rückt er
  // nach rechts und sie zoomt heraus, bis man die Welle ganz sieht. Vor dem
  // Start sieht man sie immer: Sie wartet hinter ihm.
  function kamera(dt) {
    const sv = state.s;
    const x = state.wipe ? state.wipe.x : absX();
    const y = state.wipe ? state.wipe.y : sv.y;
    // Kommt die Welle näher, rückt er nach rechts: Man soll sie sehen.
    const d = x - state.brecher.x;
    let anker = clamp(SURFER_AN + ((0.95 * view.w - d) / view.w) * 0.32, SURFER_AN, SURFER_AN_NAH);
    if (state.phase === "bereit") anker = clamp((d + 60) / view.w + 0.1, SURFER_AN, 0.7);
    if (state.wipe) anker = 0.5;
    state.anker += (anker - state.anker) * (state.zeit < 0.05 ? 1 : 1 - Math.exp(-dt * 2.5));
    let tief = Infinity;
    for (let xx = x - view.w * state.anker; xx <= x + view.w * (1 - state.anker); xx += 20) tief = Math.min(tief, wasserAbs(xx));
    let noetig = (y - (tief - 30)) / 0.72;
    // Ist die Brecherwelle im Bild, dann ganz – mit ihrem Kamm.
    const brecherDa = state.brecher.x + 180 > state.camX;
    if (brecherDa) noetig = Math.max(noetig, brecherHoehe() + 50 - (tief - 30));
    let zoomZiel = clamp(noetig / view.h0, 1, 1.9);
    // Vor dem Start so weit, dass Surfer und Welle nebeneinander Platz haben.
    if (state.phase === "bereit") zoomZiel = clamp((d + 200) / (view.w0 * 0.75), zoomZiel, 1.4);
    if (state.phase !== "bereit" && luecke() < 600) zoomZiel = Math.max(zoomZiel, 1.12);
    const k = state.zeit < 0.05 ? 1 : 1 - Math.exp(-dt * 2.2);
    state.zoom += (zoomZiel - state.zoom) * k;
    skaliere();
    state.camX = x - view.w * state.anker;
    let zielY = Math.max(Math.min(tief - 30, -view.h * 0.35), y - (view.h - view.frei / view.s) * 0.72);
    if (brecherDa) zielY = Math.max(zielY, Math.min(tief - 30, brecherHoehe() + 50 - view.h));
    state.camY += (zielY - state.camY) * (state.zeit < 0.05 ? 1 : 1 - Math.exp(-dt * 4));
    // Ganz aus dem Bild fliegt er nie: unten ein Rand, oben einer unter den
    // Knöpfen (game-shell.js, frei).
    const oben = view.h - view.frei / view.s;
    state.camY = clamp(state.camY, y + 60 - oben, y - 40);
  }

  function loop(now) {
    frame = window.requestAnimationFrame(loop);
    const roh = (now - last) / 1000;
    const dt = Math.min(0.05, roh);
    last = now;
    if ((state.phase === "spiel" || state.phase === "zuschauen") && roh < 0.25 && schaerfe > 1) {
      langsam = roh > 1 / 40 ? langsam + roh : Math.max(0, langsam - roh * 0.5);
      if (langsam > 1.2) {
        schaerfe = Math.max(1, Math.min(view.dpr, schaerfe) - 0.25);
        langsam = 0;
      }
    }
    messen();
    takt(dt);
    zeichnen();
  }

  // ---------------------------------------------------------------------------
  // Zuschauen
  // ---------------------------------------------------------------------------
  // Eine aufgezeichnete Fahrt über ihrer eigenen Dünung: Der Zufall hält die
  // Saat (geist.js, zuschauer), startRun baut damit dieselben Wellen, und der
  // Surfer ist Bild für Bild dort, wo er damals war. Die Brecherwelle rückt
  // nach derselben Rechnung nach – mit seinem Weg – und holt ihn am Ende ein.
  function zuschauenStarten() {
    if (!zuschauer?.lauf) return;
    startRun();
    state.phase = "zuschauen";
    shell.setPhase("play");
    zuschauer.los();
  }

  function zuschauenTakt(dt) {
    // Nach dem Ende: Die Welle rollt über ihn hinweg, wie damals.
    if (state.wipe) {
      state.lauf += dt;
      brecherTakt(dt);
      wipeTakt(dt);
      zuschauer.weiter();
      return;
    }
    const s = zuschauer.stand();
    if (!s) return;
    const sv = state.s;
    const lauf = Math.max(0, (s.t || 0) / 1000);
    const dl = Math.max(0, lauf - state.lauf);
    state.lauf = lauf;
    const x = START_U + s.a;
    sv.u = x - DRIFT * state.lauf;
    const boden = wasserBei(sv.u);
    const warAmBoden = state.amBoden;
    state.amBoden = s.b - boden < 3;
    sv.y = state.amBoden ? boden : s.b;
    sv.vu = s.va - DRIFT;
    sv.vy = s.vb;
    if (state.amBoden) state.flugZeit = 0;
    else state.flugZeit += 1 / 60;
    if (!warAmBoden && state.amBoden && Math.abs(s.vb) > 120) spritzer(x, sv.y, 12, -sv.vu * 0.2, 180, 140);
    state.winkel = (s.c || 0) / 100;
    // Ob er gedrückt hat, verrät die Beschleunigung: schwer fällt er schneller.
    const schwer = state.amBoden ? Math.atan(steigungBei(sv.u)) < -0.15 : s.ab < -1600;
    gedrueckt = schwer;
    state.hocke += ((schwer ? 1 : state.amBoden ? 0.35 : 0) - state.hocke) * 0.2;
    const meter = Math.max(0, Math.floor(s.punkte));
    if (meter !== state.meter) {
      state.meter = meter;
      state.punkte = meter;
      shell.setCount(meter);
    }
    brecherTakt(dl);
    // Am Ende holt ihn die Welle ein – auch hier. (Rechnet die Wiedergabe
    // die Welle ein wenig voraus, wartet sie bis zum Ende des Laufs.)
    if (zuschauer.fertig?.() || absX() - state.brecher.x <= FANG * 0.5) wirbeln();
    zuschauer.weiter();
  }

  // ---------------------------------------------------------------------------
  // Halten und Loslassen
  // ---------------------------------------------------------------------------
  // Die Runde beginnt: mit dem ersten Druck – oder im Live-Modus zum
  // gemeinsamen Start (game-shell.js, live.los).
  function losGehts() {
    if (state.phase !== "bereit") return;
    state.phase = "spiel";
    state.s.vu = 190;
    shell.setPhase("play");
    gegner?.los();
    kids()?.vibrate?.(8);
  }

  function druecken() {
    if (state.phase === "zuschauen") return;
    gedrueckt = true;
    // Im Live-Modus beginnt die Runde für alle zugleich (live.los).
    if (!shell.live) losGehts();
  }

  function loslassen() {
    if (state.phase === "zuschauen") return;
    gedrueckt = false;
  }

  // ---------------------------------------------------------------------------
  // Ablauf
  // ---------------------------------------------------------------------------
  function startRun() {
    clearStep();
    stopLoop();
    shell.closeOverlay();
    zufall.neu();
    shell.setPhase("intro");
    state.phase = "bereit";
    state.punkte = 0;
    state.meter = 0;
    state.perfekt = 0;
    state.landungen = { perfekt: 0, gut: 0, hart: 0 };
    state.serie = 0;
    state.flow = false;
    state.flowZeit = -9;
    state.flowAusZeit = -9;
    state.lauf = 0;
    state.wellen = [];
    wellenBis(4000);
    state.s = { u: START_U - 150, y: 0, vu: 0, vy: 0 };
    state.s.y = wasserBei(state.s.u);
    state.winkel = Math.atan(steigungBei(state.s.u));
    state.hocke = 0.5;
    state.amBoden = true;
    state.flugZeit = 0;
    state.flugHoehe = 0;
    state.brecher = { x: absX() - BRECHER_START, v: BRECHER_V0 };
    state.knapp = Infinity;
    state.wipe = null;
    state.kielwasser = [];
    state.spur = [];
    state.kielTakt = 0;
    state.teile = [];
    state.tropfen = [];
    state.schriften = [];
    state.zoom = 1;
    state.anker = SURFER_AN;
    state.zeit = 0;
    state.stoss = 0;
    state.tag = TAG_START;
    gedrueckt = false;
    shell.setCount(0);
    gegner?.runde();

    shell.clear();
    const prompt = shell.el("p", "cm-prompt wr-prompt", "Halten – ins Wasser drücken. Loslassen – abheben.");
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
    const dauer = Math.min(900, 200 + ziel);
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
    kids()?.playJingle?.("win");
    const perfekt = state.perfekt === 1 ? "1 perfekte Landung" : `${state.perfekt} perfekte Landungen`;
    shell.showResult({
      label: "Deine Meter",
      points: punkte,
      detail: rekord ? "Neuer Rekord!" : `${perfekt}${vorher ? ` · Bestwert ${vorher} m` : ""}`,
      geist,
    });
    if (rekord) host.querySelector(".cm-result-detail")?.classList.add("wr-rekord");
    zaehleHoch(punkte);
  }

  // ---------------------------------------------------------------------------
  // Start
  // ---------------------------------------------------------------------------
  shell = shellApi.mount({
    host,
    title: "Wellenreiter",
    area: "geschwindigkeit",
    accent: "#F5A623",
    accentDark: "#b9741a",
    clock: false,
    onRestart: () => (zuschauer ? zuschauenStarten() : startRun()),
    live: { los: losGehts, stopp: () => finish(), zuschauen: (quelle) => { zuschauer = quelle; zuschauenStarten(); } },
  });
  zuschauer = window.LernappGeist?.zuschauer?.({
    host, spiel: "waveRider", fassung: "t1", zufall, einheit: "m", nochmal: zuschauenStarten,
  }) || null;
  if (!zuschauer) {
    gegner = window.LernappGeist?.fuer?.({ spiel: "waveRider", host, art: "tempo", alle: true, zufall }) || null;
  }

  startRun();
  zuschauer?.laden.then((da) => { if (da) zuschauenStarten(); });

  host.addEventListener("pointerdown", (event) => {
    if (event.target.closest("button, a, input")) return;
    druecken();
  });
  window.addEventListener("pointerup", loslassen);
  window.addEventListener("pointercancel", loslassen);
  // Wer das Fenster verlässt, nimmt auch den Finger vom Brett.
  window.addEventListener("blur", loslassen);

  const TASTEN = new Set([" ", "Enter", "ArrowDown"]);
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
  window.addEventListener("pagehide", () => { clearStep(); stopLoop(); });

  // Für die Prüfskripte.
  window.LernappWellen = {
    METER, DRIFT, FANG, BRECHER_WEIT, G_LEICHT, G_SCHWER, PERFEKT_WINKEL, SCHLECHT_WINKEL,
    state, view, takt, druecken, loslassen,
    wellenBis, wasserBei, steigungBei, brecherTempo, absX, vorsprung,
    get gedrueckt() { return gedrueckt; },
  };
})();
