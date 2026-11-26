/*
 * kaminfeger.js – Kaminfeger.
 * ---------------------------------------------------------------------------
 * Eine enge Gasse bei Nacht, zwei schmale, unendlich hohe Häuser, dazwischen
 * der Mond. Ein Kaminfeger hängt an der Wand – und rutscht langsam ab. Eine
 * Regel: Ein Tipp, und er springt an die Wand gegenüber, immer im selben
 * Bogen, anderthalb Stockwerke höher. Von unten steigt der Rauch.
 *
 * Die Kunst liegt im Wann. Der Bogen ist immer derselbe, also entscheidet
 * allein der Moment des Absprungs, wo er drüben aufsetzt – und dort hängen
 * Laternen, Wirtshausschilder, Blumenkästen, Fensterläden, Fahnen, Balkone,
 * und auf manchem Sims sitzt eine Katze. Wer etwas berührt, stürzt: wer
 * darauf landet und wer hineinrutscht. Hängt gegenüber etwas genau dort, wo
 * er aufsetzen würde, muss er erst ein Stück rutschen – aber nicht zu weit.
 * Wer zu lange wartet, den holt der Rauch ein.
 *
 * Gezählt wird, wie hoch er kommt, in Metern. Schwerer wird es mit der Höhe:
 * Er rutscht schneller, der Rauch steigt schneller, und um den Weg bleibt
 * weniger Luft. Wer haarscharf an einem Hindernis landet, bekommt es gesagt.
 *
 * Gebaut wird die Gasse aus dem Zufall (zufall.js): ohne Turnier jedes Mal
 * eine andere, im Turnier für alle im selben Versuch dieselbe. Sie ist immer
 * zu schaffen, weil zuerst ein Weg entsteht und dann die Hindernisse um ihn
 * herum (naechsterBesuch): Besuch um Besuch, wo er landet, wie weit er
 * rutscht, wo er abspringt. Frei bleibt an jeder Wand, was dieser Weg
 * braucht, dazu Luft für den, der etwas früher oder später springt; in den
 * Raum dazwischen kommen die Hindernisse.
 *
 * Ein Tipp gilt zu seiner Zeit, nicht erst im nächsten Bild (tippen, voraus),
 * und ein Tipp kurz vor dem Aufsetzen gilt für den nächsten Sprung (puffer).
 *
 * Das Bild: eine Winternacht in der Altstadt. Fachwerk, Backstein und Stein,
 * in den Fenstern Licht, Schwibbögen, Sterne und Katzen, Schnee auf jedem
 * Sims; dahinter der grosse Mond, die Dächer der Stadt, weiter oben Wolken
 * und das Polarlicht. Die Stockwerke werden einmal gemalt und dann nur noch
 * aufgelegt (kacheln), der Himmel ebenso (himmelBild) – auf dem iPhone
 * rechnet der Prozessor jede gemalte Fläche, jedes Bild.
 *
 * Die Gegner (geist.js) springen als Kaminfeger aus Licht mit, und die besten
 * Läufe lassen sich anschauen (?zuschauen=): in ihrer eigenen Gasse, gebaut
 * mit derselben Saat.
 *
 * Zwölf Einheiten sind ein Meter. x zählt quer (die Wände stehen bei −HALB
 * und +HALB), y nach oben.
 */
(() => {
  "use strict";

  if (document.body.dataset.page !== "chimney") return;

  const host = document.querySelector("#kf-stage");
  const shellApi = window.LernappGameShell;
  const cloudApi = window.LernappGameCloud;
  if (!host || !shellApi) return;

  const kids = () => window.LernappKids || null;
  const klang = () => window.ArcadeKlang || null;
  const ruhig = () => Boolean(kids()?.prefersReducedMotion?.());

  // Der Zufall. Nur die Gasse zieht daraus – der Weg und die Hindernisse.
  // Schnee, Russ, Funken und welche Fenster leuchten hängen an Math.random
  // oder an festen Zahlen.
  const zufall = window.LernappZufall?.fuer?.("chimneySweep") || {
    neu() {},
    zahl: () => Math.random(),
  };

  // ---------------------------------------------------------------------------
  // Die Regeln
  // ---------------------------------------------------------------------------
  const METER = 12;
  const GASSE = 64;                // so breit ist die Gasse
  const HALB = GASSE / 2;
  const HAUS = 62;                 // so breit ist jedes der beiden Häuser
  const STOCK = 34;                // ein Stockwerk
  const KOERPER = 12;              // halbe Höhe des Kaminfegers
  const ARM = 5.5;                 // so weit hängt seine Mitte von der Wand weg
  const WEITE = GASSE - 2 * ARM;   // so weit fliegt er quer
  // Der Sprung: immer derselbe Bogen. HUB höher landet er, als er absprang.
  const SPRUNG_ZEIT = 0.36;
  const HUB = 50;
  const G = 900;
  const VY0 = (HUB + (G * SPRUNG_ZEIT * SPRUNG_ZEIT) / 2) / SPRUNG_ZEIT;
  const HALT = 0.14;               // so lange hält er nach dem Aufsetzen, bevor er rutscht
  const PUFFER = 0.13;             // ein Tipp so kurz vor dem Aufsetzen gilt danach
  // Wie schnell er rutscht, wie schnell der Rauch steigt und wie viel Luft
  // um den geplanten Weg bleibt (LUFT, nach oben und nach unten) – alles
  // nach der Höhe. Das Fenster für einen Sprung, der warten muss, ist
  // LUFT / Rutschen vor und nach dem besten Moment: am Start gut eine halbe
  // Sekunde, nach 50 Metern 200 ms, nach 100 Metern 120, nach 250 Metern 65.
  // Die ersten Meter sind zum Hineinfinden: viel Luft, er rutscht langsam,
  // und Hindernisse hängen erst vereinzelt (EINSTIEG, naechsterBesuch).
  const RUTSCH0 = 24;
  const RUTSCH_MAX = 72;
  const RUTSCH_WEG = 110;          // Meter, nach denen gut sechs Zehntel des Zuwachses da sind
  const RUTSCH_ZU = 320;           // so schnell kommt er ins Rutschen
  const RAUCH0 = 9;
  const RAUCH_MAX = 36;
  const RAUCH_WEG = 120;
  const RAUM = 92;                 // höchstens so weit bleibt der Rauch unter dem höchsten Punkt
  const LUFT0 = 13;
  const LUFT_MIN = 4;
  const LUFT_WEG = 75;
  const EINSTIEG = 4;              // so viele Besuche lang hängt noch gar nichts
  // Wer warten muss, rutscht so viel weiter, als die Luft verzeiht.
  const WARTE_MIN = 6;
  const WARTE_MAX = 13;
  const MUSS = 10;                 // so lang ist ein Hindernis mindestens
  const KNAPP = 2.6;               // so nah an einem Hindernis gelandet: «haarscharf»
  const START_Y = 34;
  const TAKT = 1 / 240;
  const STURZ_MS = 1200;

  const TOP_COUNT = 5;
  const store = cloudApi
    ? cloudApi.register({ key: "lernapp.kaminfeger", empty: { runs: 0, scores: [] }, merge: cloudApi.mergeScores(TOP_COUNT) })
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
  const glatt = (k) => { const t = clamp(k, 0, 1); return t * t * (3 - 2 * t); };
  const meterBei = (y) => Math.max(0, (y - START_Y) / METER);
  const rutschBei = (y) => RUTSCH0 + (RUTSCH_MAX - RUTSCH0) * (1 - Math.exp(-meterBei(y) / RUTSCH_WEG));
  const rauchBei = (y) => RAUCH0 + (RAUCH_MAX - RAUCH0) * (1 - Math.exp(-meterBei(y) / RAUCH_WEG));
  const luftBei = (y) => LUFT_MIN + (LUFT0 - LUFT_MIN) * Math.exp(-meterBei(y) / LUFT_WEG);
  const schwereBei = (y) => 1 - Math.exp(-meterBei(y) / 100);

  function hash01(n) {
    const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return x - Math.floor(x);
  }

  const mix3 = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
  const rgb = (c) => `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`;
  const rgba = (c, alpha) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${alpha})`;

  // ---------------------------------------------------------------------------
  // Zustand
  // ---------------------------------------------------------------------------
  // phase:   "bereit" (noch nichts getippt), "spiel", "zuschauen", "ende"
  // schritt: "start" (er steht auf dem Sims), "halt", "rutsch", "flug", "sturz"
  const state = {
    phase: "bereit",
    schritt: "start",
    punkte: 0,
    hoch: START_Y,          // der höchste Punkt bisher
    spruenge: 0,
    knappe: 0,
    reihe: 0,
    // Der Kaminfeger: wo er ist, an welcher Wand (−1 links, 1 rechts), wie
    // lange er noch hält, wie schnell er rutscht, wie lange er schon fliegt.
    kf: { x: -HALB + ARM, y: START_Y, seite: -1, halt: 0, vr: 0, flug: 0, y0: START_Y, x0: -HALB + ARM },
    puffer: false,
    rauch: -200,            // so hoch steht der Rauch
    plan: [],
    hindernisse: { "-1": [], 1: [] },
    sturz: null,
    teile: [],
    schriften: [],
    zeit: 0,
    camY: 0,
    stoss: 0,
    stauch: 0,
  };

  let shell = null;
  let feld = null;
  let canvas = null;
  let g = null;
  let frame = null;
  let last = 0;
  let voraus = 0;
  let stepTimer = null;
  let gegner = null;
  let zuschauer = null;
  let kratzen = null;
  let nacht = null;

  const view = { s: 1, dpr: 1, cssW: 0, cssH: 0, w: 150, h: 330, frei: 0 };

  function clearStep() {
    if (stepTimer) { window.clearTimeout(stepTimer); stepTimer = null; }
  }

  function stopLoop() {
    if (frame) { window.cancelAnimationFrame(frame); frame = null; }
  }

  // ---------------------------------------------------------------------------
  // Klang
  // ---------------------------------------------------------------------------
  function klangAn() {
    nacht = klang()?.kulisse("kaminfeger.nacht") || null;
    nacht?.setze(0.25);
    nacht?.laut(0.5);
    kratzen = klang()?.kulisse("kaminfeger.rutschen", { laut: 0 }) || null;
  }

  function klangStellen() {
    const rutscht = state.schritt === "rutsch";
    kratzen?.setze(rutscht ? clamp(state.kf.vr / RUTSCH_MAX, 0, 1) : 0);
    kratzen?.laut(rutscht ? 0.7 : 0);
  }

  function klangAus() {
    kratzen?.stop();
    nacht?.stop();
    kratzen = null;
    nacht = null;
  }

  // ---------------------------------------------------------------------------
  // Die Gasse
  // ---------------------------------------------------------------------------
  /*
   * Zuerst der Weg, dann die Hindernisse. Ein Besuch ist ein Halt an einer
   * Wand: wo er landet (L), wie weit er rutscht (d), wo er abspringt
   * (t = L − d). Der nächste liegt gegenüber, HUB über dem Absprung.
   *
   * Frei bleibt an der Wand, was der Besuch braucht, und darum herum die
   * Luft e: von «unten» (t − e − Körper) bis «oben» (L + e + Körper). Wer
   * bis zu e früher oder später abspringt als geplant, kommt durch – auch
   * über mehrere Besuche, an denen er sofort weiterspringt und so hoch oder
   * tief bleibt, wie er ist (hoch, tief).
   *
   * Hindernisse hängen im Raum zwischen zwei freien Stücken derselben Wand:
   *
   *   muss    Wartet ein Besuch (d > 0), hängt gegenüber gleich über der
   *           Landung ein Hindernis: Wer sofort springt, landet darin. Er
   *           muss erst rutschen – mindestens d − e.
   *   zange   Gleich unter einem freien Stück: Wer zu tief landet oder zu
   *           weit rutscht, ist darin. Mit einem «muss» zusammen bleibt für
   *           den Absprung genau das Fenster von zweimal e.
   *   sonst   manchmal eines irgendwo dazwischen.
   *
   * Wie oft, hängt an der Höhe: Unten in der Gasse hängt wenig – die ersten
   * EINSTIEG Besuche gar nichts, danach muss selten gewartet werden, und
   * eine Zange ist die Ausnahme. Weiter oben wird es dicht.
   *
   * Dass für ein «muss» immer Platz ist, liegt an den Massen: Zwei Besuche
   * an derselben Wand liegen 2 · HUB minus dem Gerutschten auseinander, und
   * gewartet wird höchstens e + WARTE_MAX. Wäre es zu eng – weil die
   * Besuche davor schon gerutscht sind oder weil gegenüber noch eines
   * unterkommen muss –, wartet dieser Besuch nicht.
   *
   * Was wie weit in die Gasse ragt (tief), richtet sich danach, wie nah
   * darunter jemand abspringt (kopf): Unter einem Balkon springt niemand
   * los, der gleich durch ihn hindurchflöge – dort hängt nur Flaches.
   */
  const ARTEN = [
    { art: "ilex", min: 9, max: 30, tief: 6, kopf: 0, oft: 2 },
    { art: "laden", min: 12, max: 30, tief: 8, kopf: 0, oft: 3 },
    { art: "fahne", min: 14, max: 26, tief: 9, kopf: 0, oft: 4 },
    { art: "kasten", min: 9, max: 14.5, tief: 9, kopf: 0, oft: 5 },
    { art: "katze", min: 9.5, max: 13, tief: 9, kopf: 0, oft: 6 },
    { art: "rohr", min: 9.5, max: 13.5, tief: 9, kopf: 0, oft: 4 },
    { art: "vogelhaus", min: 11, max: 16.5, tief: 9, kopf: 0, oft: 5 },
    { art: "laterne", min: 12, max: 17, tief: 12, kopf: 20, oft: 8 },
    { art: "waesche", min: 11, max: 16, tief: 17, kopf: 28, oft: 6 },
    { art: "balkon", min: 14, max: 24, tief: 16, kopf: 28, oft: 9 },
    { art: "schild", min: 15, max: 21, tief: 18, kopf: 28, oft: 9 },
  ];

  // Ein Hindernis an die Wand: von y0 an, so lang – die Art nach der Länge
  // und danach, wie viel Kopffreiheit der Absprung darunter hat.
  function haenge(seite, y0, lang, kopf, z) {
    let summe = 0;
    const moeglich = ARTEN.filter((a) => lang >= a.min && lang <= a.max && kopf >= a.kopf);
    moeglich.forEach((a) => { summe += a.oft; });
    let art = moeglich[moeglich.length - 1] || ARTEN[0];
    let r = z * summe;
    for (const a of moeglich) {
      r -= a.oft;
      if (r < 0) { art = a; break; }
    }
    state.hindernisse[seite].push({ y0, y1: y0 + lang, art: art.art, tief: art.tief, saat: (z * 7919) % 1 });
  }

  function naechsterBesuch() {
    const plan = state.plan;
    const n = plan.length;
    const v = plan[n - 1];
    const L = v.t + HUB;
    const seite = -v.seite;
    const k = schwereBei(L);
    const e = luftBei(L);
    // Immer gleich viele Zahlen ziehen, was auch geschieht: Die Gasse soll
    // an der Saat hängen, nicht an den Zweigen dieser Funktion.
    const z = [zufall.zahl(), zufall.zahl(), zufall.zahl(), zufall.zahl(), zufall.zahl(), zufall.zahl()];
    const drunter = n >= 2 ? plan[n - 2] : null;          // der letzte Besuch an dieser Wand
    const muss = n >= 3 && plan[n - 3].warten;            // über ihm muss etwas hängen
    let d = 0;
    if (n > EINSTIEG && z[0] < lerp(0.14, 0.62, k)) {
      d = e + lerp(WARTE_MIN, WARTE_MAX, z[1]);
      // Platz für das Hindernis, das über dem letzten Besuch an dieser Wand
      // hängen muss …
      if (muss && L - d - e - KOERPER - drunter.oben < MUSS) d = 0;
      // … und für das an der Wand gegenüber, wenn der Besuch davor gewartet
      // hat: Es hängt unter der nächsten Landung dort, und die liegt um d
      // tiefer.
      if (d > 0 && drunter.warten && L - d + HUB - e - KOERPER - v.oben < MUSS) d = 0;
    }
    // Wie weit er hier über oder unter dem Weg sein darf. Wer zu früh oder
    // zu spät abgesprungen ist, bleibt es an allen Besuchen, an denen er
    // sofort weiterspringt – erst wo er warten muss, rutscht er wieder auf
    // den Weg. Die Luft wird mit der Höhe kleiner; für ihn gilt weiter die,
    // mit der er abweichen durfte.
    const hoch = Math.max(e, v.warten ? v.e : v.hoch);
    const tief = d > 0 ? e : Math.max(e, v.tief);
    const neu = { seite, L, d, t: L - d, e, hoch, tief, warten: d > 0, unten: L - d - tief - KOERPER, oben: L + hoch + KOERPER };
    plan.push(neu);
    if (!drunter || n < EINSTIEG) return;

    const von = drunter.oben;
    const bis = neu.unten;
    const raum = bis - von;
    if (raum < MUSS) return;
    // Wie viel Kopffreiheit ein Hindernis ab y0 dem Absprung darunter lässt
    // (meist springt dort niemand von ganz oben im freien Stück ab).
    const kopf = (y0) => y0 - von + drunter.hoch * 0.5;
    const zange = z[2] < lerp(0.1, 0.85, k);
    if (muss && zange && raum <= 30) {
      haenge(seite, von, raum, kopf(von), z[3]);
      return;
    }
    let frei = raum;
    if (muss) {
      const lang = Math.min(frei, lerp(10, 19, z[3]));
      haenge(seite, von, lang, kopf(von), z[3]);
      frei -= lang + 3;
    }
    if (zange && frei >= 9) {
      const lang = Math.min(frei, lerp(9, 18, z[4]));
      haenge(seite, bis - lang, lang, kopf(bis - lang), z[4]);
    } else if (!muss && !zange && raum >= 16 && z[5] < lerp(0.25, 0.6, k)) {
      const lang = Math.min(raum - 6, lerp(9, 18, z[4]));
      const y0 = von + 3 + (raum - 6 - lang) * z[3];
      haenge(seite, y0, lang, kopf(y0), z[5] / lerp(0.25, 0.6, k));
    }
  }

  function planBis(y) {
    const plan = state.plan;
    while (plan[plan.length - 1].t < y) naechsterBesuch();
  }

  function gasseNeu() {
    const e = luftBei(START_Y);
    state.plan = [{ seite: -1, L: START_Y, d: 0, t: START_Y, e, hoch: e, tief: 0, warten: false, unten: START_Y - KOERPER, oben: START_Y + e + KOERPER }];
    // Unten in der Gasse brennt eine Laterne – unter der ersten Landung.
    state.hindernisse = { "-1": [], 1: [{ y0: 12, y1: 28, art: "laterne", tief: 12, saat: 0.4 }] };
    planBis(900);
  }

  // Steht an dieser Wand in dieser Höhe etwas im Weg? (y: die Mitte des
  // Kaminfegers.)
  function trifft(seite, y) {
    const liste = state.hindernisse[seite];
    for (let i = liste.length - 1; i >= 0; i -= 1) {
      const h = liste[i];
      if (h.y1 < y - KOERPER - 80) break;
      if (y + KOERPER > h.y0 && y - KOERPER < h.y1) return h;
    }
    return null;
  }

  // Wie nah das nächste Hindernis über oder unter ihm hängt.
  function abstand(seite, y) {
    const liste = state.hindernisse[seite];
    let nah = Infinity;
    for (let i = liste.length - 1; i >= 0; i -= 1) {
      const h = liste[i];
      if (h.y1 < y - KOERPER - 80) break;
      nah = Math.min(nah, h.y0 >= y + KOERPER ? h.y0 - y - KOERPER : y - KOERPER - h.y1);
    }
    return nah;
  }

  // Die Gasse als Text – für die Prüfung, dass in einem Turnier alle
  // dieselbe bekommen.
  function gasseText(bis = 1500) {
    planBis(bis);
    const text = (seite) => state.hindernisse[seite].filter((h) => h.y0 < bis).map((h) => `${h.art}:${h.y0.toFixed(1)}-${h.y1.toFixed(1)}`).join(",");
    return `${text(-1)} | ${text(1)}`;
  }

  // ---------------------------------------------------------------------------
  // Die Fläche
  // ---------------------------------------------------------------------------
  function buildPlatz() {
    const platz = shell.el("div", "kf-platz");
    feld = shell.el("div", "kf-feld");
    canvas = document.createElement("canvas");
    canvas.className = "kf-canvas";
    canvas.setAttribute("aria-hidden", "true");
    feld.append(canvas);
    g = canvas.getContext("2d");

    // Der Hinweis vor dem ersten Tipp: zwei Ringe, die aufgehen – tippen.
    const tipp = shell.el("span", "kf-tipp");
    tipp.setAttribute("aria-hidden", "true");
    const ns = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(ns, "svg");
    svg.setAttribute("viewBox", "0 0 64 64");
    ["kf-tipp-ring", "kf-tipp-ring is-spaet"].forEach((klasse) => {
      const kreis = document.createElementNS(ns, "circle");
      kreis.setAttribute("class", klasse);
      kreis.setAttribute("cx", "32");
      kreis.setAttribute("cy", "32");
      kreis.setAttribute("r", "14");
      kreis.setAttribute("fill", "none");
      kreis.setAttribute("stroke", "#ffffff");
      kreis.setAttribute("stroke-width", "4");
      svg.append(kreis);
    });
    const punkt = document.createElementNS(ns, "circle");
    punkt.setAttribute("cx", "32");
    punkt.setAttribute("cy", "32");
    punkt.setAttribute("r", "8");
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
    const dpr = shellApi.bildpunkte(cssW, cssH, 2);
    const frei = Math.min(cssH * 0.4, shell?.frei?.(canvas) || 0);
    if (cssW === view.cssW && cssH === view.cssH && dpr === view.dpr && frei === view.frei) return;
    view.cssW = cssW;
    view.cssH = cssH;
    view.dpr = dpr;
    view.frei = frei;
    // Hochkant füllt die Gasse gut vier Zehntel der Breite; quer stehen die
    // zwei Häuser als Türme im Bild, links und rechts der offene Himmel.
    const s = Math.max(cssH / 330, Math.min((0.44 * cssW) / GASSE, cssH / 200));
    // Ein Stockwerk ist eine ganze Zahl Bildpunkte hoch: So lassen sich die
    // Kacheln der Häuser auflegen, ohne dass sie gestreckt werden.
    view.s = Math.max(1, Math.round(STOCK * s * dpr)) / (STOCK * dpr);
    view.w = cssW / view.s;
    view.h = cssH / view.s;
    const pw = Math.round(cssW * dpr);
    const ph = Math.round(cssH * dpr);
    if (canvas.width !== pw) canvas.width = pw;
    if (canvas.height !== ph) canvas.height = ph;
    kachelnNeu();
  }

  const bildX = (x) => view.cssW / 2 + x * view.s;
  const bildY = (y) => view.cssH - (y - state.camY) * view.s;
  // Wo im Bild er steht: ein Drittel über dem unteren Rand.
  const camZiel = () => state.kf.y - view.h * 0.33;

  // ---------------------------------------------------------------------------
  // Zeichnen: Himmel, Mond, die Stadt
  // ---------------------------------------------------------------------------
  // Der Himmel nach der Höhe: unten in der Gasse wärmer, weiter oben tiefe
  // Nacht, ganz oben das Polarlicht.
  const HIMMEL = [
    { m: 0, oben: [12, 18, 56], mitte: [28, 52, 110], unten: [86, 96, 150], polar: 0 },
    { m: 50, oben: [8, 12, 44], mitte: [18, 38, 96], unten: [52, 84, 150], polar: 0 },
    { m: 130, oben: [5, 8, 32], mitte: [12, 26, 78], unten: [34, 62, 128], polar: 0.6 },
    { m: 260, oben: [3, 4, 20], mitte: [9, 16, 58], unten: [26, 44, 108], polar: 1 },
  ];

  function himmelBei(m) {
    for (let i = 0; i < HIMMEL.length - 1; i += 1) {
      const a = HIMMEL[i];
      const b = HIMMEL[i + 1];
      if (m <= b.m) {
        const k = glatt((m - a.m) / (b.m - a.m));
        return { oben: mix3(a.oben, b.oben, k), mitte: mix3(a.mitte, b.mitte, k), unten: mix3(a.unten, b.unten, k), polar: lerp(a.polar, b.polar, k) };
      }
    }
    return HIMMEL[HIMMEL.length - 1];
  }

  const STERNE = Array.from({ length: 90 }, (_, i) => ({
    x: hash01(i * 3.1 + 1), y: hash01(i * 5.7 + 2), r: 0.6 + hash01(i * 7.3 + 3) * 1.4, t: hash01(i * 9.9) * 6,
  }));

  // Wo der Mond steht: hochkant mitten über der Gasse, quer im offenen
  // Himmel rechts von den Häusern.
  function mondOrt() {
    const W = view.cssW;
    const H = view.cssH;
    const offen = view.w > GASSE + 2 * HAUS + 90;
    const r = Math.min(W, H) * (offen ? 0.17 : 0.2);
    return {
      x: offen ? bildX(HALB + HAUS) + (W - bildX(HALB + HAUS)) * 0.52 : W / 2 + view.s * 4,
      y: H * 0.24 + (state.camY * view.s) * 0.012,
      r,
    };
  }

  /*
   * Der Himmel wird nicht jedes Bild gemalt: Verlauf, Mondhof und Polarlicht
   * füllen das ganze Bild, und auf dem iPhone rechnet jede solche Fläche
   * der Prozessor (gemessen: die Hälfte der Zeit eines Bildes). Er steht
   * darum in einem eigenen Bild (himmelBild) und wird nur neu gemalt, wenn
   * er sich sichtbar geändert hat – alle paar Meter Höhe, oder ein paar
   * Mal je Sekunde, solange das Polarlicht weht. Jedes Bild wird er nur
   * aufgelegt; darüber funkeln einzeln die Sterne, und der Mond wandert.
   */
  let himmelBild = null;
  let himmelG = null;
  const himmelStand = { m: -99, zeit: -99, mondY: -99 };

  function himmelMalen(farben) {
    const W = view.cssW;
    const H = view.cssH;
    const verlauf = g.createLinearGradient(0, 0, 0, H);
    verlauf.addColorStop(0, rgb(farben.oben));
    verlauf.addColorStop(0.55, rgb(farben.mitte));
    verlauf.addColorStop(1, rgb(farben.unten));
    g.fillStyle = verlauf;
    g.fillRect(0, 0, W, H);

    if (farben.polar > 0.02) zeichnePolarlicht(farben.polar);

    // Der Mond: gross, mit Hof und seinen Meeren.
    const mond = mondOrt();
    const hof = g.createRadialGradient(mond.x, mond.y, mond.r * 0.6, mond.x, mond.y, mond.r * 3.2);
    hof.addColorStop(0, "rgba(190, 214, 255, 0.5)");
    hof.addColorStop(0.3, "rgba(150, 184, 255, 0.18)");
    hof.addColorStop(1, "rgba(150, 184, 255, 0)");
    g.fillStyle = hof;
    g.fillRect(mond.x - mond.r * 3.2, mond.y - mond.r * 3.2, mond.r * 6.4, mond.r * 6.4);
  }

  // Der Mond selbst wird jedes Bild gemalt: Er wandert mit der Höhe, und
  // seine Scheibe ist billig – der Hof darum steht im vorgemalten Himmel.
  function zeichneMond() {
    const mond = mondOrt();
    g.fillStyle = "#f4f6ff";
    g.beginPath();
    g.arc(mond.x, mond.y, mond.r, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "rgba(170, 186, 230, 0.42)";
    g.beginPath();
    [[-0.34, -0.26, 0.3], [0.26, 0.08, 0.24], [-0.1, 0.44, 0.19], [0.42, -0.42, 0.14], [-0.5, 0.2, 0.1]].forEach(([dx, dy, r]) => {
      g.moveTo(mond.x + (dx + r) * mond.r, mond.y + dy * mond.r);
      g.arc(mond.x + dx * mond.r, mond.y + dy * mond.r, r * mond.r, 0, Math.PI * 2);
    });
    g.fill();
  }

  function zeichneHimmel(farben, m) {
    const W = view.cssW;
    const H = view.cssH;
    if (!himmelBild || himmelBild.width !== canvas.width || himmelBild.height !== canvas.height) {
      himmelBild = document.createElement("canvas");
      himmelBild.width = canvas.width;
      himmelBild.height = canvas.height;
      himmelG = himmelBild.getContext("2d");
      himmelStand.m = -99;
    }
    const mondY = mondOrt().y;
    const weht = farben.polar > 0.02 && !ruhig();
    if (Math.abs(m - himmelStand.m) > 3 || Math.abs(mondY - himmelStand.mondY) > 2.5 || state.zeit < himmelStand.zeit
      || (weht && state.zeit - himmelStand.zeit > 0.18)) {
      himmelStand.m = m;
      himmelStand.zeit = state.zeit;
      himmelStand.mondY = mondY;
      const haupt = g;
      g = himmelG;
      g.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
      himmelMalen(farben);
      g = haupt;
    }
    // Auflegen, Punkt auf Punkt.
    g.save();
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.drawImage(himmelBild, 0, 0);
    g.restore();

    g.fillStyle = "#ffffff";
    const still = ruhig();
    for (let i = 0; i < STERNE.length; i += 1) {
      const st = STERNE[i];
      const funkeln = still ? 0.8 : 0.55 + 0.45 * Math.sin(state.zeit * 1.9 + st.t);
      g.globalAlpha = funkeln * (0.5 + 0.5 * (1 - st.y));
      const y = (st.y * H + state.camY * view.s * 0.006) % H;
      g.fillRect(st.x * W, y, st.r, st.r);
    }
    g.globalAlpha = 1;
    // Alle paar Sekunden eine Sternschnuppe.
    if (!still) {
      const nr = Math.floor(state.zeit / 7);
      const lauf = (state.zeit - nr * 7) / 0.6;
      if (nr > 0 && lauf < 1) {
        const x0 = W * (0.15 + 0.7 * hash01(nr * 3.3));
        const y0 = H * (0.05 + 0.3 * hash01(nr * 7.7));
        const seite = hash01(nr * 5.1) > 0.5 ? 1 : -1;
        const lang = Math.min(W, H) * 0.22;
        const x = x0 + seite * lang * lauf;
        const y = y0 + lang * 0.45 * lauf;
        const schweif = g.createLinearGradient(x, y, x - seite * lang * 0.45, y - lang * 0.2);
        schweif.addColorStop(0, `rgba(255, 255, 255, ${0.9 * (1 - lauf)})`);
        schweif.addColorStop(1, "rgba(255, 255, 255, 0)");
        g.strokeStyle = schweif;
        g.lineWidth = 1.6;
        g.lineCap = "round";
        g.beginPath();
        g.moveTo(x, y);
        g.lineTo(x - seite * lang * 0.45, y - lang * 0.2);
        g.stroke();
      }
    }
    zeichneMond();
  }

  function zeichnePolarlicht(kraft) {
    const W = view.cssW;
    const H = view.cssH;
    const t = ruhig() ? 0 : state.zeit;
    [[0.5, [90, 255, 170], 0], [0.34, [70, 220, 255], 2.1], [0.2, [170, 120, 255], 4.4]].forEach(([hoehe, farbe, phase]) => {
      const fuss = H * hoehe;
      const hoch = H * 0.3;
      const verlauf = g.createLinearGradient(0, fuss - hoch, 0, fuss);
      verlauf.addColorStop(0, rgba(farbe, 0));
      verlauf.addColorStop(0.6, rgba(farbe, 0.26 * kraft));
      verlauf.addColorStop(1, rgba(farbe, 0));
      g.fillStyle = verlauf;
      g.beginPath();
      const welle = (x) => Math.sin(x * 0.011 + t * 0.35 + phase) * H * 0.03 + Math.sin(x * 0.027 - t * 0.22 + phase * 2) * H * 0.015;
      g.moveTo(-10, fuss + welle(-10));
      for (let x = 0; x <= W + 20; x += 24) g.lineTo(x, fuss + welle(x));
      for (let x = W + 20; x >= -10; x -= 24) g.lineTo(x, fuss - hoch + welle(x * 1.3) * 1.6);
      g.closePath();
      g.fill();
    });
  }

  // Die Stadt dahinter: Berge, dann Dächer mit Kirchturm und leuchtenden
  // Fenstern. Sie sinkt langsamer als die Gasse – bis sie unten verschwindet.
  function zeichneStadt(farben) {
    const W = view.cssW;
    const H = view.cssH;
    const s = view.s;
    const sink = state.camY * s;
    // Berge, weit weg.
    const bergY = H * 0.82 + sink * 0.05;
    if (bergY < H + 80 * s) {
      g.fillStyle = rgb(mix3(farben.unten, [16, 26, 70], 0.6));
      g.beginPath();
      g.moveTo(-10, H + 10);
      const breit = 46 * s;
      for (let i = -1; i * breit < W + breit; i += 1) {
        const hoch = (22 + 30 * hash01(i * 2.7 + 5)) * s;
        g.lineTo(i * breit + breit * 0.5 * hash01(i * 4.1), bergY - hoch);
        g.lineTo((i + 0.6) * breit, bergY - hoch * (0.3 + 0.3 * hash01(i * 6.3)));
      }
      g.lineTo(W + 10, H + 10);
      g.closePath();
      g.fill();
    }
    // Die Dächer der Stadt.
    const fuss = H * 0.93 + sink * 0.2;
    if (fuss > H + 90 * s) return;
    const dunkel = rgb(mix3(farben.unten, [8, 12, 40], 0.82));
    const breit = 17 * s;
    const fenster = [];
    g.fillStyle = dunkel;
    g.beginPath();
    for (let i = -1; i * breit < W + breit; i += 1) {
      const x = i * breit;
      const z = hash01(i * 3.7 + 1);
      const hoch = (16 + 26 * z) * s;
      const turm = hash01(i * 9.1) > 0.92;
      g.rect(x, fuss - hoch, breit + 1, hoch + H);
      // Der Giebel.
      g.moveTo(x - 1 * s, fuss - hoch);
      g.lineTo(x + breit / 2, fuss - hoch - (turm ? 34 : 9 + 6 * z) * s);
      g.lineTo(x + breit + 1 * s, fuss - hoch);
      g.closePath();
      // Ein Kamin.
      if (z > 0.4) g.rect(x + breit * 0.68, fuss - hoch - 9 * s, 2.6 * s, 8 * s);
      for (let j = 0; j < 3; j += 1) {
        if (hash01(i * 5.3 + j * 7.7) > 0.55) fenster.push([x + breit * (0.22 + 0.36 * (j % 2)), fuss - hoch + (5 + j * 6) * s]);
      }
    }
    g.fill();
    g.fillStyle = "rgba(255, 204, 120, 0.9)";
    g.beginPath();
    fenster.forEach(([x, y]) => g.rect(x, y, 2.2 * s, 2.8 * s));
    g.fill();
  }

  // Wolkenbänke in bestimmten Höhen (die erste nach gut hundert Metern): Man
  // steigt durch sie hindurch. Jede ist ein Umriss aus Kuppen, nach unten
  // läuft sie aus. Gemalt wird zweimal:
  // hinter den Häusern dicht, davor noch einmal als dünner Schleier.
  const BAENKE = [[1240, 0.9, 0], [2300, 0.85, 3], [3500, 0.9, 7], [4800, 0.85, 11], [6300, 0.9, 17], [8000, 0.85, 23]];
  const umrissY = new Float64Array(900);
  function zeichneWolken(farben, vorn) {
    const W = view.cssW;
    const H = view.cssH;
    const s = view.s;
    const mitte = state.camY + view.h / 2;
    BAENKE.forEach(([hoehe, par, saat]) => {
      const p = vorn ? par * 1.5 : par;
      const oben = H * 0.5 - (hoehe - mitte) * s * p;
      if (oben > H + 40 * s || oben < -120 * s) return;
      const zug = ruhig() ? 0 : state.zeit * (vorn ? 9 : 4 + (saat % 5));
      const schritt = Math.max(3, 2.4 * s);
      const breit = (vorn ? 64 : 34) * s;
      let n = 0;
      for (let x = -schritt; x <= W + schritt && n < umrissY.length; x += schritt) {
        const m = Math.floor((x + zug * s) / breit);
        let y = oben + 16 * s;
        for (let j = m - 1; j <= m + 1; j += 1) {
          const cx = (j + 0.5 + (hash01(j * 3.3 + saat + (vorn ? 50 : 0)) - 0.5) * 0.6) * breit - zug * s;
          const r = breit * (0.42 + 0.5 * hash01(j * 5.1 + saat));
          const dx = x - cx;
          if (Math.abs(dx) < r) y = Math.min(y, oben + r * 0.62 - Math.sqrt(r * r - dx * dx));
        }
        umrissY[n] = y;
        n += 1;
      }
      const flaeche = (runter, farbe, kraft, tief) => {
        const verlauf = g.createLinearGradient(0, oben - 20 * s, 0, oben + tief * s);
        verlauf.addColorStop(0, rgba(farbe, kraft));
        verlauf.addColorStop(0.45, rgba(farbe, kraft * 0.8));
        verlauf.addColorStop(1, rgba(farbe, 0));
        g.fillStyle = verlauf;
        g.beginPath();
        g.moveTo(-schritt, umrissY[0] + runter);
        for (let i = 1; i < n; i += 1) g.lineTo(-schritt + i * schritt, umrissY[i] + runter);
        g.lineTo(W + schritt, oben + tief * s);
        g.lineTo(-schritt, oben + tief * s);
        g.closePath();
        g.fill();
      };
      if (vorn) flaeche(0, mix3(farben.unten, [200, 214, 255], 0.7), 0.24, 50);
      else flaeche(0, mix3(farben.unten, [214, 224, 255], 0.72), 0.8, 64);
    });
  }

  // ---------------------------------------------------------------------------
  // Zeichnen: die zwei Häuser
  // ---------------------------------------------------------------------------
  /*
   * Ein Stockwerk ist eine Kachel: Wand, Balken, ein Fenster – hell oder
   * dunkel. Je Bauart gibt es acht Kacheln, einmal gemalt (kachelnNeu), dann
   * je Bild nur noch aufgelegt. Drei Bauarten wechseln sich nach oben ab:
   * Fachwerk, Backstein, Stein.
   */
  const BAUARTEN = [
    { name: "fachwerk", wand: [22, 28, 66], balken: [44, 56, 112], kante: [96, 120, 190] },
    { name: "backstein", wand: [30, 24, 58], balken: [58, 44, 96], kante: [128, 108, 180] },
    { name: "stein", wand: [18, 30, 62], balken: [38, 62, 110], kante: [100, 140, 196] },
  ];
  const JE_BAUART = 8;
  const STOCK_JE_BAUART = 13;
  let kacheln = null;

  function kachelnNeu() {
    const f = view.s * view.dpr;
    // Gemalt wird nur, was von einem Haus im Bild ist: hochkant gut zwei
    // Drittel seiner Breite, von der Gasse her.
    const sicht = Math.min(HAUS, Math.ceil((view.w - GASSE) / 2) + 1);
    const bw = Math.max(8, Math.round(sicht * f));
    const bh = Math.max(8, Math.round(STOCK * f));
    // Zwei Bilder: das linke Haus und das rechte, sein Spiegel. Gespiegelt
    // aufzulegen kostete auf dem iPhone jedes Bild.
    const bild = (gespiegelt) => {
      const c = document.createElement("canvas");
      c.width = bw * JE_BAUART;
      c.height = bh * BAUARTEN.length;
      const k = c.getContext("2d");
      BAUARTEN.forEach((bau, zeile) => {
        for (let nr = 0; nr < JE_BAUART; nr += 1) {
          k.save();
          k.translate(nr * bw + (gespiegelt ? bw : 0), zeile * bh);
          k.scale(gespiegelt ? -1 : 1, 1);
          k.beginPath();
          k.rect(0, 0, bw, bh);
          k.clip();
          k.scale(bw / sicht, bh / STOCK);
          k.translate(sicht - HAUS, 0);
          maleStockwerk(k, bau, nr);
          k.restore();
        }
      });
      return c;
    };
    kacheln = { links: bild(false), rechts: bild(true), bw, bh };
  }

  // Ein Stockwerk in seinen eigenen Massen: HAUS breit, STOCK hoch, y nach
  // unten. Die Gasse liegt rechts (für das rechte Haus wird gespiegelt).
  function maleStockwerk(k, bau, nr) {
    const hell = nr % 2 === 0;
    const z = (n) => hash01(nr * 7.31 + n * 3.17 + bau.wand[0]);
    const tief = rgb(mix3(bau.wand, [0, 0, 0], 0.45));
    k.fillStyle = rgb(bau.wand);
    k.fillRect(0, 0, HAUS, STOCK);
    k.strokeStyle = rgb(bau.balken);
    k.lineCap = "butt";
    if (bau.name === "fachwerk") {
      // Schwelle, Pfosten, Streben.
      k.lineWidth = 2.4;
      k.beginPath();
      k.moveTo(0, 1.2);
      k.lineTo(HAUS, 1.2);
      k.stroke();
      k.lineWidth = 1.7;
      k.beginPath();
      [6, 23, 43, 57].forEach((x) => { k.moveTo(x, 0); k.lineTo(x, STOCK); });
      if (z(1) > 0.5) { k.moveTo(6, STOCK); k.lineTo(23, 2.4); } else { k.moveTo(23, STOCK); k.lineTo(6, 2.4); }
      if (z(2) > 0.5) { k.moveTo(43, 2.4); k.lineTo(57, STOCK); } else { k.moveTo(43, STOCK); k.lineTo(57, 2.4); }
      k.stroke();
    } else if (bau.name === "backstein") {
      // Lagen aus Backstein, versetzt.
      k.lineWidth = 0.5;
      k.globalAlpha = 0.7;
      k.beginPath();
      for (let i = 0; i * 3.4 <= STOCK; i += 1) {
        const y = i * 3.4;
        k.moveTo(0, y);
        k.lineTo(HAUS, y);
        for (let x = i % 2 ? 4 : 0; x < HAUS; x += 8) { k.moveTo(x, y); k.lineTo(x, y + 3.4); }
      }
      k.stroke();
      k.globalAlpha = 1;
      k.lineWidth = 2.2;
      k.beginPath();
      k.moveTo(0, 1.1);
      k.lineTo(HAUS, 1.1);
      k.stroke();
    } else {
      // Quader aus Stein.
      k.lineWidth = 0.7;
      k.globalAlpha = 0.8;
      k.beginPath();
      for (let i = 0; i * 8.5 <= STOCK; i += 1) {
        const y = i * 8.5;
        k.moveTo(0, y);
        k.lineTo(HAUS, y);
        for (let x = i % 2 ? 9 : 0; x < HAUS; x += 18) { k.moveTo(x, y); k.lineTo(x, y + 8.5); }
      }
      k.stroke();
      k.globalAlpha = 1;
    }
    // Das Fenster: ein Rahmen, das Kreuz, hell oder dunkel – und was darin
    // zu sehen ist.
    const fx = 26 + (z(3) - 0.5) * 3;
    const fy = 8.4;
    const fw = 14.6;
    const fh = 18.6;
    k.fillStyle = tief;
    k.beginPath();
    k.roundRect(fx - 1.7, fy - 1.7, fw + 3.4, fh + 3.4, bau.name === "stein" ? [7, 7, 0.6, 0.6] : 0.6);
    k.fill();
    const scheibe = () => {
      k.beginPath();
      k.roundRect(fx, fy, fw, fh, bau.name === "stein" ? [5.6, 5.6, 0, 0] : 0);
    };
    // Was im Fenster zu sehen ist, steht je Kachel fest: vier helle, vier
    // dunkle je Bauart, und jede Bauart mischt anders.
    const reihe = BAUARTEN.indexOf(bau);
    const was = hell ? [0, 5, 1, 2, 5, 3, 4, 5][(nr / 2 + reihe * 3) % 8] : (nr - 1) / 2 === reihe % 4 ? 0 : (nr - 1) / 2 === (reihe + 2) % 4 ? 1 : 2;
    if (hell) {
      const licht = k.createLinearGradient(0, fy, 0, fy + fh);
      licht.addColorStop(0, "#ffeab0");
      licht.addColorStop(1, "#ffb055");
      k.fillStyle = licht;
      scheibe();
      k.fill();
      k.save();
      scheibe();
      k.clip();
      // Was vor dem Licht steht.
      k.fillStyle = tief;
      if (was === 0) {
        // Vorhänge.
        k.beginPath();
        k.moveTo(fx, fy);
        k.lineTo(fx + 5.4, fy);
        k.quadraticCurveTo(fx + 4.6, fy + 9, fx + 1.4, fy + fh);
        k.lineTo(fx, fy + fh);
        k.closePath();
        k.moveTo(fx + fw, fy);
        k.lineTo(fx + fw - 5.4, fy);
        k.quadraticCurveTo(fx + fw - 4.6, fy + 9, fx + fw - 1.4, fy + fh);
        k.lineTo(fx + fw, fy + fh);
        k.closePath();
        k.fill();
      } else if (was === 1) {
        // Eine Katze, die hinausschaut.
        k.beginPath();
        k.ellipse(fx + 5.2, fy + fh - 2.8, 3.4, 3.2, 0, 0, Math.PI * 2);
        k.arc(fx + 6.4, fy + fh - 7.2, 2.2, 0, Math.PI * 2);
        k.moveTo(fx + 4.6, fy + fh - 8.4);
        k.lineTo(fx + 5, fy + fh - 10.6);
        k.lineTo(fx + 6.3, fy + fh - 9.2);
        k.lineTo(fx + 7.6, fy + fh - 10.6);
        k.lineTo(fx + 8.3, fy + fh - 8.4);
        k.fill();
      } else if (was === 2) {
        // Ein Schwibbogen mit Kerzen.
        k.lineWidth = 1;
        k.strokeStyle = tief;
        k.beginPath();
        k.arc(fx + fw / 2, fy + fh - 0.4, 5.4, Math.PI, 0);
        k.stroke();
        k.fillRect(fx + 1.4, fy + fh - 1.4, fw - 2.8, 1.4);
        k.fillStyle = "#fffbe0";
        for (let i = 0; i < 5; i += 1) {
          const w = Math.PI * (0.14 + 0.18 * i);
          k.fillRect(fx + fw / 2 - Math.cos(w) * 5.4 - 0.4, fy + fh - 0.4 - Math.sin(w) * 5.4 - 2.6, 0.8, 1.9);
        }
      } else if (was === 3) {
        // Jemand am Fenster: Kopf und Schultern.
        k.beginPath();
        k.arc(fx + fw * 0.55, fy + fh - 9.4, 2.7, 0, Math.PI * 2);
        k.ellipse(fx + fw * 0.55, fy + fh - 1.6, 5.2, 5.6, 0, 0, Math.PI * 2);
        k.fill();
      } else if (was === 4) {
        // Eine Lichterkette, die durchhängt.
        k.strokeStyle = tief;
        k.lineWidth = 0.5;
        k.beginPath();
        k.moveTo(fx, fy + 1.4);
        k.quadraticCurveTo(fx + fw / 2, fy + 6.4, fx + fw, fy + 1.4);
        k.stroke();
        ["#e0433c", "#2f9e6a", "#3f7fe0", "#e0433c", "#2f9e6a", "#3f7fe0"].forEach((farbe, i) => {
          const u = (i + 0.5) / 6;
          k.fillStyle = farbe;
          k.beginPath();
          k.arc(fx + fw * u, fy + 1.4 + 5 * (1 - (2 * u - 1) * (2 * u - 1)) * 0.5 + 0.8, 0.85, 0, Math.PI * 2);
          k.fill();
        });
      }
      k.restore();
    } else {
      k.fillStyle = rgb(mix3(bau.wand, [70, 100, 170], 0.32));
      scheibe();
      k.fill();
      k.save();
      scheibe();
      k.clip();
      // Ein Schimmer vom Mond in der Scheibe.
      k.fillStyle = "rgba(190, 210, 255, 0.16)";
      k.beginPath();
      k.moveTo(fx + 2, fy + fh);
      k.lineTo(fx + 8.6, fy);
      k.lineTo(fx + 11.6, fy);
      k.lineTo(fx + 5, fy + fh);
      k.closePath();
      k.fill();
      if (was <= 1) {
        // Im dunklen Zimmer brennt ein Stern.
        const sx = fx + fw / 2;
        const sy = fy + 6.6;
        const schein = k.createRadialGradient(sx, sy, 0.5, sx, sy, 8);
        schein.addColorStop(0, "rgba(255, 190, 110, 0.7)");
        schein.addColorStop(1, "rgba(255, 190, 110, 0)");
        k.fillStyle = schein;
        k.fillRect(sx - 8, sy - 8, 16, 16);
        k.fillStyle = was === 0 ? "#ffd27a" : "#ff8a6b";
        k.beginPath();
        for (let i = 0; i < 16; i += 1) {
          const w = (i / 16) * Math.PI * 2 - Math.PI / 2;
          const r = i % 2 ? 1.5 : 3.8;
          if (i === 0) k.moveTo(sx + Math.cos(w) * r, sy + Math.sin(w) * r);
          else k.lineTo(sx + Math.cos(w) * r, sy + Math.sin(w) * r);
        }
        k.closePath();
        k.fill();
        k.fillStyle = tief;
        k.fillRect(sx - 0.15, fy, 0.3, 3);
      }
      k.restore();
    }
    // Das Fensterkreuz.
    k.strokeStyle = tief;
    k.lineWidth = 1.1;
    k.beginPath();
    k.moveTo(fx + fw / 2, fy);
    k.lineTo(fx + fw / 2, fy + fh);
    k.moveTo(fx, fy + fh * 0.4);
    k.lineTo(fx + fw, fy + fh * 0.4);
    k.stroke();
    // Das Sims darunter – und der Schnee, der darauf liegt.
    k.fillStyle = rgb(bau.balken);
    k.fillRect(fx - 3.2, fy + fh + 1.7, fw + 6.4, 1.8);
    k.fillStyle = "rgba(232, 240, 255, 0.95)";
    k.beginPath();
    k.roundRect(fx - 3.4, fy + fh + 0.5, fw + 6.8, 1.7, 0.85);
    k.fill();
    if (z(6) > 0.6) {
      // Eiszapfen am Sims.
      k.fillStyle = "rgba(205, 222, 255, 0.85)";
      k.beginPath();
      for (let i = 0; i < 4; i += 1) {
        const x = fx - 1.6 + i * (3.6 + z(7 + i) * 1.6);
        k.moveTo(x, fy + fh + 3.4);
        k.lineTo(x + 0.6, fy + fh + 5.2 + z(11 + i) * 2.6);
        k.lineTo(x + 1.2, fy + fh + 3.4);
      }
      k.fill();
    }
    // Die Kante zur Gasse: Eckquader, vom Mond beschienen.
    k.fillStyle = rgb(mix3(bau.wand, bau.kante, 0.5));
    k.fillRect(HAUS - 3.4, 0, 3.4, STOCK);
    k.fillStyle = rgb(bau.kante);
    k.fillRect(HAUS - 1, 0, 1, STOCK);
    k.fillStyle = rgb(mix3(bau.wand, [0, 0, 0], 0.3));
    for (let y = 0; y < STOCK; y += 6.8) k.fillRect(HAUS - 3.4, y, 2.4, 0.5);
  }

  // Welche Kachel ein Stockwerk zeigt. Unten in der Gasse brennt in den
  // meisten Fenstern Licht, weiter oben in jedem zweiten.
  function kachelFuer(stock, seite) {
    const a = hash01(stock * 12.9898 + seite * 78.233 + 4.1);
    const b = hash01(stock * 39.3468 + seite * 11.135 + 9.7);
    const hell = b < (stock < 9 ? 0.72 : 0.5);
    return 2 * (Math.floor(a * 4) % 4) + (hell ? 0 : 1);
  }

  function zeichneHaeuser() {
    if (!kacheln) return;
    const s = view.s;
    const dpr = view.dpr;
    const erstes = Math.max(0, Math.floor(state.camY / STOCK));
    const letztes = Math.floor((state.camY + view.h) / STOCK) + 1;
    // Punkt auf Punkt: Jede Kachel liegt auf ganzen Bildpunkten und wird
    // nicht gestreckt (view.s ist in messen() so gewählt, dass ein Stockwerk
    // eine ganze Zahl Bildpunkte hoch ist).
    const breit = kacheln.bw / dpr;
    const hoch = kacheln.bh / dpr;
    const raster = (x) => Math.round(x * dpr) / dpr;
    const xl = raster(bildX(-HALB)) - breit;
    const xr = raster(bildX(HALB));
    const boden0 = raster(bildY(0));
    for (let stock = erstes; stock <= letztes; stock += 1) {
      const bau = Math.floor(stock / STOCK_JE_BAUART) % BAUARTEN.length;
      const y = boden0 - (stock + 1) * hoch;
      const nl = kachelFuer(stock, -1);
      const nr = kachelFuer(stock, 1);
      g.drawImage(kacheln.links, nl * kacheln.bw, bau * kacheln.bh, kacheln.bw, kacheln.bh, xl, y, breit, hoch);
      g.drawImage(kacheln.rechts, nr * kacheln.bw, bau * kacheln.bh, kacheln.bw, kacheln.bh, xr, y, breit, hoch);
    }
    // Quer stehen die Häuser frei: ihre äussere Kante, im Schatten.
    if (xl > 0) {
      g.fillStyle = "rgba(4, 6, 24, 0.55)";
      g.fillRect(xl, 0, 2.2 * s, view.cssH);
      g.fillRect(xr + breit - 2.2 * s, 0, 2.2 * s, view.cssH);
    }
    // Die Gasse unten: das Pflaster und das Sims, auf dem er beginnt.
    const boden = bildY(0);
    if (boden < view.cssH + 4) {
      g.fillStyle = "#0b0f2c";
      g.fillRect(0, boden, view.cssW, view.cssH - boden + 4);
      g.fillStyle = "rgba(255, 190, 110, 0.16)";
      g.fillRect(bildX(-HALB), boden, GASSE * s, 3 * s);
    }
    const sims = bildY(START_Y - KOERPER);
    g.fillStyle = "#070a20";
    g.fillRect(bildX(-HALB), sims, 14 * s, 2.8 * s);
    g.fillStyle = SCHNEE;
    g.beginPath();
    g.roundRect(bildX(-HALB), sims - 1.1 * s, 14.4 * s, 1.6 * s, 0.8 * s);
    g.fill();
  }

  // ---------------------------------------------------------------------------
  // Zeichnen: die Hindernisse
  // ---------------------------------------------------------------------------
  // Jedes ragt von seiner Wand in die Gasse – als Scherenschnitt, mit einer
  // hellen Kante vom Mond, Schnee obenauf und dem, was an ihm leuchtet.
  // Gemalt wird in eigenen Massen: x von der Wand weg, y nach oben, null am
  // unteren Ende. Was gemalt ist, füllt an der Wand die ganze Länge: Wo der
  // Kaminfeger hängt, ist nichts frei, was nach frei aussieht.
  const SCHWARZ = "#070a20";
  const DUNKEL = "#121942";
  const KANTE = "rgba(150, 178, 245, 0.92)";
  const SCHNEE = "#eef3ff";
  const GOLD = "#ffcf7a";

  // Schnee obenauf: ein weicher Streifen.
  function schnee(x0, y, breit, dick = 1.5) {
    g.fillStyle = SCHNEE;
    g.beginPath();
    g.roundRect(x0 - 0.4, y - 0.25, breit + 0.8, dick, dick / 2);
    g.fill();
  }

  function maleHindernis(h, lang) {
    g.fillStyle = SCHWARZ;
    g.strokeStyle = SCHWARZ;
    g.lineCap = "round";
    g.lineJoin = "round";
    const t = ruhig() ? 0 : state.zeit;
    if (h.art === "laden") {
      // Ein offener Fensterladen, von der Kante gesehen: Rahmen, Lamellen.
      g.fillStyle = "#0e3a36";
      g.fillRect(0, 0, 8, lang);
      g.fillStyle = "#06201f";
      g.fillRect(0, 0, 8, 1.2);
      g.fillRect(0, lang - 1.2, 8, 1.2);
      g.fillRect(0, 0, 1.2, lang);
      g.fillRect(6.6, 0, 1.4, lang);
      g.fillStyle = "#2f8a72";
      for (let y = 2.3; y < lang - 2.2; y += 2.3) g.fillRect(1.9, y, 4.2, 0.85);
      g.fillStyle = KANTE;
      g.fillRect(7.4, 0, 0.6, lang);
      schnee(0, lang, 8);
    } else if (h.art === "ilex") {
      // Ein Spalier mit Stechpalme: stachlige Blätter, rote Beeren.
      g.strokeStyle = "#1c2558";
      g.lineWidth = 0.7;
      g.beginPath();
      g.moveTo(5.2, 0);
      g.lineTo(5.2, lang);
      for (let y = 1.5; y < lang; y += 4.5) { g.moveTo(0, y); g.lineTo(5.2, y); }
      g.stroke();
      const n = Math.max(4, Math.round(lang / 2.1));
      for (let i = 0; i < n; i += 1) {
        const z1 = hash01(h.saat * 91 + i * 3.7);
        const z2 = hash01(h.saat * 53 + i * 7.1);
        const y = 1.6 + ((lang - 3.2) * i) / (n - 1);
        const x = 1.4 + z1 * 3.6;
        const w = (z2 - 0.5) * 2.2;
        // Ein Blatt: eine Raute mit Zacken.
        g.save();
        g.translate(x, y);
        g.rotate(w);
        g.fillStyle = i % 3 === 0 ? "#1f6a4c" : "#124634";
        g.beginPath();
        g.moveTo(-2.6, 0);
        g.lineTo(-1.2, 0.5);
        g.lineTo(-0.9, 1.5);
        g.lineTo(0, 0.7);
        g.lineTo(0.9, 1.5);
        g.lineTo(1.2, 0.5);
        g.lineTo(2.6, 0);
        g.lineTo(1.2, -0.5);
        g.lineTo(0.9, -1.5);
        g.lineTo(0, -0.7);
        g.lineTo(-0.9, -1.5);
        g.lineTo(-1.2, -0.5);
        g.closePath();
        g.fill();
        g.restore();
      }
      g.fillStyle = "#ff4d5e";
      g.beginPath();
      for (let i = 0; i < n; i += 2) {
        const x = 1.6 + hash01(h.saat * 37 + i * 5.3) * 3.4;
        const y = 2.2 + ((lang - 4.4) * i) / (n - 1);
        g.moveTo(x + 0.85, y);
        g.arc(x, y, 0.85, 0, Math.PI * 2);
        g.moveTo(x + 1.9, y + 0.7);
        g.arc(x + 1.1, y + 0.7, 0.8, 0, Math.PI * 2);
      }
      g.fill();
      schnee(0.4, lang - 0.6, 5.2, 1.3);
    } else if (h.art === "kasten") {
      // Ein Blumenkasten: der Kasten, darüber Weihnachtssterne.
      const hoch = 4.6;
      g.strokeStyle = SCHWARZ;
      g.lineWidth = 0.8;
      const rot = ["#ff4d5e", "#ff7a6b", "#ffe9d6", "#ff4d5e"];
      for (let i = 0; i < 4; i += 1) {
        const x = 1.5 + i * 2.2;
        const oben = hoch + (lang - hoch - 1.9) * (0.62 + 0.38 * hash01(h.saat * 31 + i * 3.3));
        const wiegen = Math.sin(t * 1.6 + i + h.saat * 7) * 0.4;
        g.beginPath();
        g.moveTo(x, hoch - 0.4);
        g.quadraticCurveTo(x + wiegen * 0.4, (hoch + oben) / 2, x + wiegen, oben);
        g.stroke();
        g.fillStyle = "#1f6a4c";
        g.beginPath();
        g.ellipse(x + 0.9, (hoch + oben) / 2, 1.1, 0.5, 0.5, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = rot[(i + Math.floor(h.saat * 4)) % rot.length];
        g.beginPath();
        for (let b = 0; b < 5; b += 1) {
          const w = (b / 5) * Math.PI * 2 + i;
          g.moveTo(x + wiegen, oben);
          g.ellipse(x + wiegen + Math.cos(w) * 0.9, oben + Math.sin(w) * 0.9, 1.05, 0.5, w, 0, Math.PI * 2);
        }
        g.fill();
        g.fillStyle = GOLD;
        g.fillRect(x + wiegen - 0.3, oben - 0.3, 0.6, 0.6);
      }
      g.fillStyle = SCHWARZ;
      g.fillRect(0, 0, 9, hoch);
      g.fillStyle = DUNKEL;
      g.fillRect(0.9, 1, 7.2, hoch - 2);
      g.fillStyle = KANTE;
      g.fillRect(8.4, 0, 0.6, hoch);
      schnee(0, hoch, 9, 1.2);
    } else if (h.art === "katze") {
      // Eine Katze auf dem Sims. Sie blinzelt.
      const f = (lang - 1.8) / 10.4;
      g.fillStyle = SCHWARZ;
      g.fillRect(0, 0, 9.4, 1.8);
      g.fillStyle = KANTE;
      g.fillRect(8.8, 0, 0.6, 1.8);
      schnee(0, 1.8, 2, 1.1);
      schnee(7.2, 1.8, 2.2, 1.1);
      g.save();
      g.translate(4.6, 1.7);
      g.scale(f, f);
      g.fillStyle = SCHWARZ;
      g.beginPath();
      g.ellipse(0, 3.2, 2.9, 3.4, 0, 0, Math.PI * 2);
      g.arc(1, 7.6, 2.2, 0, Math.PI * 2);
      g.moveTo(-0.9, 8.6);
      g.lineTo(-0.5, 10.4);
      g.lineTo(0.7, 9.4);
      g.moveTo(1.4, 9.5);
      g.lineTo(2.6, 10.4);
      g.lineTo(3, 8.5);
      g.fill();
      // Der Schwanz, um die Pfoten gelegt.
      g.lineWidth = 1.2;
      g.strokeStyle = SCHWARZ;
      g.beginPath();
      g.moveTo(-2.4, 1.4);
      g.quadraticCurveTo(-4.2, 0.4, -1.2 + Math.sin(t * 1.3 + h.saat * 9) * 0.5, 0.5);
      g.stroke();
      // Der helle Rand zum Mond und die Augen.
      g.strokeStyle = KANTE;
      g.lineWidth = 0.4;
      g.beginPath();
      g.arc(1, 7.6, 2.2, -0.9, 0.7);
      g.stroke();
      const blinzelt = !ruhig() && (state.zeit + h.saat * 5) % 3.4 < 0.14;
      if (!blinzelt) {
        g.fillStyle = "#ffe36b";
        g.beginPath();
        g.ellipse(0.5, 7.8, 0.5, 0.62, 0, 0, Math.PI * 2);
        g.ellipse(2, 7.8, 0.5, 0.62, 0, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = SCHWARZ;
        g.fillRect(0.38, 7.3, 0.24, 1);
        g.fillRect(1.88, 7.3, 0.24, 1);
      }
      g.restore();
    } else if (h.art === "rohr") {
      // Ein Ofenrohr: aus der Wand, ums Knie, nach oben – und es glüht.
      g.fillStyle = SCHWARZ;
      g.fillRect(0, 1.2, 8.6, 4.2);
      g.fillRect(4.4, 1.2, 4.2, lang - 3);
      g.beginPath();
      g.moveTo(3.2, lang - 1.8);
      g.lineTo(9.4, lang - 1.8);
      g.lineTo(7.4, lang);
      g.lineTo(5.2, lang);
      g.closePath();
      g.fill();
      g.fillStyle = KANTE;
      g.fillRect(8, 1.2, 0.6, lang - 3);
      g.fillStyle = "rgba(150, 178, 245, 0.45)";
      g.fillRect(0, 4.9, 4.4, 0.5);
      g.fillRect(4.4, 3.2, 4.2, 0.5);
      g.fillRect(4.4, lang - 4.4, 4.2, 0.5);
      // Die Glut unter der Haube.
      const glut = 0.75 + 0.25 * Math.sin(t * 7 + h.saat * 11);
      g.fillStyle = `rgba(255, 138, 60, ${glut})`;
      g.fillRect(4.6, lang - 2.6, 3.8, 0.8);
      const schein = g.createRadialGradient(6.5, lang - 2.2, 0.5, 6.5, lang - 2.2, 9);
      schein.addColorStop(0, `rgba(255, 150, 70, ${0.4 * glut})`);
      schein.addColorStop(1, "rgba(255, 150, 70, 0)");
      g.fillStyle = schein;
      g.fillRect(-2.5, lang - 11.2, 18, 18);
      // Rauchwölkchen darüber – nur Bild, sie tun nichts.
      if (!ruhig()) {
        for (let i = 0; i < 3; i += 1) {
          const lauf = ((t * 0.5 + i / 3 + h.saat) % 1 + 1) % 1;
          g.fillStyle = `rgba(190, 200, 235, ${0.3 * (1 - lauf)})`;
          g.beginPath();
          g.arc(6.4 + Math.sin(lauf * 5 + i) * 1.6, lang + 1 + lauf * 9, 1.2 + lauf * 2, 0, Math.PI * 2);
          g.fill();
        }
      }
      schnee(0, 5.4, 4.2, 1.1);
    } else if (h.art === "fahne") {
      // Eine Fahne an kurzer Stange: rot mit weissem Kreuz, unten gezackt.
      const weht = Math.sin(t * 1.8 + h.saat * 7) * 0.5;
      g.fillStyle = "#c92a3a";
      g.beginPath();
      g.moveTo(1.3, lang - 1.5);
      g.lineTo(8.3, lang - 1.5);
      g.lineTo(8.3 + weht, 2.6);
      g.lineTo(4.8 + weht, 0);
      g.lineTo(1.3 + weht, 2.6);
      g.closePath();
      g.fill();
      g.fillStyle = "rgba(60, 8, 30, 0.45)";
      g.beginPath();
      g.moveTo(1.3, lang - 1.5);
      g.lineTo(3.4, lang - 1.5);
      g.lineTo(3.4 + weht, 1.1);
      g.lineTo(1.3 + weht, 2.6);
      g.closePath();
      g.fill();
      g.fillStyle = "#f4f6ff";
      g.fillRect(4.3 + weht * 0.2, lang - 9, 1.2, 4.4);
      g.fillRect(2.7 + weht * 0.2, lang - 7.4, 4.4, 1.2);
      g.strokeStyle = SCHWARZ;
      g.lineWidth = 1.2;
      g.beginPath();
      g.moveTo(0, lang - 0.9);
      g.lineTo(9, lang - 0.9);
      g.stroke();
      g.fillStyle = GOLD;
      g.beginPath();
      g.arc(9, lang - 0.9, 0.9, 0, Math.PI * 2);
      g.fill();
      schnee(0.4, lang - 0.3, 7.6, 1.1);
    } else if (h.art === "vogelhaus") {
      // Ein Vogelhaus auf seinem Brett – mit einem Rotkehlchen davor.
      const first = lang - 4.4;
      g.fillStyle = SCHWARZ;
      g.fillRect(0, 0, 9.4, 1.3);
      g.fillStyle = "#1d2658";
      g.fillRect(1.4, 1.3, 6.2, first - 1.3);
      g.fillStyle = KANTE;
      g.fillRect(7, 1.3, 0.6, first - 1.3);
      g.fillStyle = SCHWARZ;
      g.beginPath();
      g.arc(4.5, 1.3 + (first - 1.3) * 0.58, 1.35, 0, Math.PI * 2);
      g.fill();
      g.beginPath();
      g.moveTo(0, first);
      g.lineTo(9.2, first);
      g.lineTo(4.6, lang);
      g.closePath();
      g.fill();
      g.fillStyle = SCHNEE;
      g.beginPath();
      g.moveTo(0.2, first + 0.9);
      g.lineTo(4.6, lang + 0.5);
      g.lineTo(9, first + 0.9);
      g.lineTo(8, first + 0.5);
      g.lineTo(4.6, lang - 1);
      g.lineTo(1.2, first + 0.5);
      g.closePath();
      g.fill();
      // Das Rotkehlchen: Es wippt.
      const wippt = ruhig() ? 0 : Math.max(0, Math.sin(t * 5 + h.saat * 9)) * 0.3;
      g.fillStyle = "#6a5a52";
      g.beginPath();
      g.ellipse(8.1, 2.5 + wippt, 1.3, 1.15, 0.2, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = "#ff7a45";
      g.beginPath();
      g.arc(8.7, 2.5 + wippt, 0.75, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = SCHWARZ;
      g.fillRect(8.5, 3 + wippt, 0.3, 0.3);
    } else if (h.art === "laterne") {
      // Eine Wandlaterne: die Platte an der Wand, der Arm, das Licht.
      const unten = Math.max(1.8, lang - 12.4);
      const oben = lang - 3.6;
      const schein = g.createRadialGradient(8.6, (unten + oben) / 2, 1, 8.6, (unten + oben) / 2, 24);
      schein.addColorStop(0, "rgba(255, 214, 130, 0.55)");
      schein.addColorStop(0.4, "rgba(255, 196, 110, 0.16)");
      schein.addColorStop(1, "rgba(255, 190, 100, 0)");
      g.fillStyle = schein;
      g.fillRect(-15.4, (unten + oben) / 2 - 24, 48, 48);
      g.fillStyle = SCHWARZ;
      g.fillRect(0, 0, 1.5, lang);
      g.lineWidth = 1.4;
      g.beginPath();
      g.moveTo(0.6, lang - 1);
      g.lineTo(8.6, lang - 1);
      g.lineTo(8.6, oben + 1);
      g.moveTo(0.8, unten + 1);
      g.quadraticCurveTo(4.4, unten + 2, 5, oben - 1);
      g.stroke();
      // Das Dach, das Glas, der Fuss.
      g.beginPath();
      g.moveTo(4.4, oben);
      g.lineTo(12.8, oben);
      g.lineTo(10.4, oben + 2);
      g.lineTo(6.8, oben + 2);
      g.closePath();
      g.fill();
      g.fillStyle = "#ffd98a";
      g.fillRect(5.4, unten + 1.4, 6.4, oben - unten - 1.4);
      g.fillStyle = "#fff6d6";
      g.fillRect(7.6, unten + 2.4, 2, Math.max(1, oben - unten - 4));
      g.fillStyle = SCHWARZ;
      g.fillRect(8.3, unten + 1.4, 0.6, oben - unten - 1.4);
      g.fillRect(5, unten + 1.4, 0.6, oben - unten - 1.4);
      g.fillRect(11.6, unten + 1.4, 0.6, oben - unten - 1.4);
      g.fillRect(4.8, unten, 7.6, 1.5);
      g.fillRect(7.6, unten - 1.4, 2, 1.5);
      schnee(4.6, oben + 1.9, 8, 1.3);
    } else if (h.art === "waesche") {
      // Eine Stange mit Wäsche: ein Hemd, eine Socke – steif gefroren.
      g.lineWidth = 1.3;
      g.beginPath();
      g.moveTo(0, lang - 0.9);
      g.lineTo(17, lang - 0.9);
      g.stroke();
      g.fillStyle = KANTE;
      g.fillRect(0, lang - 0.5, 17, 0.4);
      const wehen = Math.sin(t * 2.1 + h.saat * 5) * 0.7;
      g.fillStyle = "#e9eeff";
      g.beginPath();
      g.moveTo(2.4, lang - 1.5);
      g.lineTo(9.6, lang - 1.5);
      g.lineTo(11.6, lang - 4.8);
      g.lineTo(9.6, lang - 5.8);
      g.lineTo(9.2 + wehen, 0.5);
      g.lineTo(2.8 + wehen, 0.5);
      g.lineTo(2.4, lang - 5.8);
      g.lineTo(0.4, lang - 4.8);
      g.closePath();
      g.fill();
      g.fillStyle = "rgba(120, 140, 200, 0.5)";
      g.fillRect(5.7 + wehen * 0.5, 0.5, 0.5, lang - 3);
      g.fillStyle = "#ff6b6b";
      g.beginPath();
      g.moveTo(12.8, lang - 1.5);
      g.lineTo(15, lang - 1.5);
      g.lineTo(15 + wehen * 0.5, lang - 7);
      g.lineTo(17 + wehen * 0.5, lang - 8.2);
      g.lineTo(16.4 + wehen * 0.5, lang - 9.4);
      g.lineTo(12.8 + wehen * 0.5, lang - 8.8);
      g.closePath();
      g.fill();
      g.fillStyle = "#fff";
      g.fillRect(12.8, lang - 2.8, 2.2, 0.8);
    } else if (h.art === "balkon") {
      // Ein Balkon: die Platte, das Geländer – und ein Bäumchen mit Lichtern.
      g.fillRect(0, 0, 16, 2.8);
      g.fillStyle = KANTE;
      g.fillRect(0, 2.3, 16, 0.5);
      g.fillRect(15.4, 0, 0.6, 2.8);
      // Das Bäumchen im Topf.
      const baum = Math.min(lang - 5, 11);
      g.fillStyle = SCHWARZ;
      g.fillRect(4.6, 2.8, 2.8, 2);
      g.fillStyle = "#124634";
      g.beginPath();
      g.moveTo(6, 4.4 + baum);
      g.lineTo(9.6, 4.6);
      g.lineTo(2.4, 4.6);
      g.closePath();
      g.fill();
      const lichter = [[5.2, 0.25, "#ffe36b"], [6.9, 0.45, "#ff6b6b"], [5.8, 0.68, "#ffe36b"], [7.6, 0.14, "#8fd0ff"], [4.2, 0.1, "#ff6b6b"]];
      lichter.forEach(([x, hoehe, farbe], i) => {
        g.globalAlpha = ruhig() ? 1 : 0.55 + 0.45 * Math.sin(t * 3 + i * 2.1 + h.saat * 9);
        g.fillStyle = farbe;
        g.fillRect(x - 0.35, 4.6 + baum * hoehe, 0.8, 0.8);
      });
      g.globalAlpha = 1;
      // Das Geländer davor.
      g.strokeStyle = SCHWARZ;
      g.lineWidth = 0.9;
      g.beginPath();
      for (let x = 2.4; x <= 15.5; x += 2.6) { g.moveTo(x, 2.8); g.lineTo(x, lang - 0.9); }
      g.stroke();
      g.fillStyle = SCHWARZ;
      g.fillRect(0, lang - 1.5, 16, 1.5);
      g.fillRect(14.6, 2.8, 1.4, lang - 2.8);
      g.fillStyle = KANTE;
      g.fillRect(15.4, 2.8, 0.6, lang - 2.8);
      schnee(0, lang, 16, 1.6);
    } else {
      // Ein Wirtshausschild am schmiedeeisernen Ausleger.
      g.fillRect(0, lang - 9, 1.4, 9);
      g.lineWidth = 1.5;
      g.beginPath();
      g.moveTo(0, lang - 1);
      g.lineTo(18, lang - 1);
      g.moveTo(0.8, lang - 8);
      g.quadraticCurveTo(8, lang - 7.4, 10.5, lang - 1.6);
      g.stroke();
      g.lineWidth = 0.9;
      g.beginPath();
      g.arc(3.6, lang - 3.6, 1.5, 0, Math.PI * 2);
      g.stroke();
      schnee(1, lang - 0.2, 17, 1.3);
      const pendel = Math.sin(t * 1.7 + h.saat * 9) * 0.05;
      const hoch = lang - 2.8;
      g.save();
      g.translate(10.6, lang - 1.6);
      g.rotate(pendel);
      g.strokeStyle = SCHWARZ;
      g.lineWidth = 0.7;
      g.beginPath();
      g.moveTo(-4, 0);
      g.lineTo(-4, -2);
      g.moveTo(4, 0);
      g.lineTo(4, -2);
      g.stroke();
      // Die Tafel: schwarz mit goldenem Rand, darin das Zeichen.
      g.fillStyle = SCHWARZ;
      g.beginPath();
      g.roundRect(-6.6, -1.8 - hoch, 13.2, hoch, 3);
      g.fill();
      g.strokeStyle = GOLD;
      g.lineWidth = 0.55;
      g.beginPath();
      g.roundRect(-5.5, -0.7 - hoch, 11, hoch - 2.2, 2.2);
      g.stroke();
      const my = -1.8 - hoch / 2;
      const r = Math.min(4.2, hoch / 2 - 2.6);
      g.fillStyle = GOLD;
      g.strokeStyle = GOLD;
      const was = Math.floor(h.saat * 3);
      g.beginPath();
      if (was === 0) {
        // Ein Stern.
        for (let i = 0; i < 10; i += 1) {
          const w = (i / 10) * Math.PI * 2 + Math.PI / 2;
          const rr = i % 2 ? r * 0.42 : r;
          if (i === 0) g.moveTo(Math.cos(w) * rr, my + Math.sin(w) * rr);
          else g.lineTo(Math.cos(w) * rr, my + Math.sin(w) * rr);
        }
        g.closePath();
        g.fill();
      } else if (was === 1) {
        // Ein Schlüssel.
        g.lineWidth = r * 0.3;
        g.arc(-r * 0.55, my, r * 0.42, 0, Math.PI * 2);
        g.moveTo(-r * 0.1, my);
        g.lineTo(r, my);
        g.moveTo(r * 0.55, my);
        g.lineTo(r * 0.55, my - r * 0.5);
        g.moveTo(r * 0.92, my);
        g.lineTo(r * 0.92, my - r * 0.4);
        g.stroke();
      } else {
        // Eine Brezel.
        g.lineWidth = r * 0.26;
        g.arc(-r * 0.42, my - r * 0.15, r * 0.42, 0, Math.PI * 2);
        g.moveTo(r * 0.84, my - r * 0.15);
        g.arc(r * 0.42, my - r * 0.15, r * 0.42, 0, Math.PI * 2);
        g.moveTo(-r * 0.7, my + r * 0.8);
        g.quadraticCurveTo(0, my - r * 0.4, r * 0.7, my + r * 0.8);
        g.stroke();
      }
      g.restore();
    }
  }

  function zeichneHindernisse() {
    const s = view.s;
    const unten = state.camY - 40;
    const oben = state.camY + view.h + 30;
    for (const seite of [-1, 1]) {
      const liste = state.hindernisse[seite];
      for (let i = liste.length - 1; i >= 0; i -= 1) {
        const h = liste[i];
        if (h.y1 < unten) break;
        if (h.y0 > oben) continue;
        g.save();
        g.translate(bildX(seite * HALB), bildY(h.y0));
        g.scale(-seite * s, -s);
        maleHindernis(h, h.y1 - h.y0);
        g.restore();
      }
    }
  }

  // Alle zehn Meter eine Marke an der Wand.
  function zeichneMarken() {
    const s = view.s;
    const schritt = 10 * METER;
    const erste = Math.max(1, Math.ceil((state.camY - START_Y) / schritt));
    g.font = `800 ${Math.round(clamp(5.6 * s, 9, 15))}px system-ui, sans-serif`;
    g.textAlign = "center";
    g.textBaseline = "middle";
    for (let n = erste; START_Y + n * schritt < state.camY + view.h + 10; n += 1) {
      const y = bildY(START_Y + n * schritt);
      for (const seite of [-1, 1]) {
        const x = bildX(seite * (HALB + 11.5));
        g.fillStyle = "rgba(8, 11, 34, 0.82)";
        g.beginPath();
        g.roundRect(x - 8.5 * s, y - 4.2 * s, 17 * s, 8.4 * s, 2 * s);
        g.fill();
        g.fillStyle = "rgba(255, 214, 140, 0.95)";
        g.fillText(`${n * 10} m`, x, y + 0.3 * s);
      }
      g.fillStyle = "rgba(255, 214, 140, 0.22)";
      g.fillRect(bildX(-HALB), y - 0.25 * s, GASSE * s, 0.5 * s);
    }
  }

  // ---------------------------------------------------------------------------
  // Zeichnen: der Rauch
  // ---------------------------------------------------------------------------
  // Er steigt von unten: oben wogen Schwaden, darunter ist es dicht. In ihm
  // glimmen Funken.
  function zeichneRauch() {
    const W = view.cssW;
    const H = view.cssH;
    const s = view.s;
    const oben = bildY(state.rauch);
    if (oben > H + 30 * s) return;
    const t = ruhig() ? 0 : state.zeit;
    const schritt = Math.max(5, 4 * s);
    // Die Glut darunter leuchtet herauf.
    const glut = g.createLinearGradient(0, oben - 58 * s, 0, oben + 6 * s);
    glut.addColorStop(0, "rgba(255, 120, 60, 0)");
    glut.addColorStop(1, "rgba(255, 120, 60, 0.3)");
    g.fillStyle = glut;
    g.fillRect(0, oben - 58 * s, W, 64 * s);
    for (let lage = 0; lage < 3; lage += 1) {
      const hoehe = oben - (2 - lage) * 9 * s;
      g.fillStyle = ["rgba(58, 52, 86, 0.55)", "rgba(40, 34, 64, 0.8)", "rgba(24, 20, 42, 0.96)"][lage];
      g.beginPath();
      g.moveTo(-10, H + 10);
      for (let x = -10; x <= W + schritt; x += schritt) {
        const u = x / s;
        const welle = Math.sin(u * 0.09 + t * (0.9 + lage * 0.3) + lage * 2.1) * 4.2 + Math.sin(u * 0.21 - t * 1.3 + lage) * 2.2 + Math.sin(u * 0.043 + t * 0.5) * 3;
        g.lineTo(x, hoehe - welle * s);
      }
      g.lineTo(W + 10, H + 10);
      g.closePath();
      g.fill();
    }
    if (ruhig()) return;
    for (let i = 0; i < 14; i += 1) {
      const dauer = 1.6 + hash01(i * 3.3) * 1.6;
      const lauf = ((t + hash01(i * 8.1) * dauer) % dauer) / dauer;
      const x = (hash01(i * 5.5 + Math.floor((t + hash01(i * 8.1) * dauer) / dauer) * 1.7) - 0.5) * (GASSE + 2 * HAUS);
      g.globalAlpha = (1 - lauf) * 0.9;
      g.fillStyle = i % 3 ? "#ffb35a" : "#ff7a4a";
      g.fillRect(bildX(x + Math.sin(t * 2 + i) * 3), oben + (8 - lauf * 34) * s, 1.1 * s, 1.1 * s);
    }
    g.globalAlpha = 1;
  }

  // ---------------------------------------------------------------------------
  // Zeichnen: der Kaminfeger
  // ---------------------------------------------------------------------------
  /*
   * Ein Scherenschnitt: schwarz, mit Zylinder, die Leiter auf dem Rücken,
   * der Besen mit der Kugel am Gürtel – und ein rotes Halstuch, an dem man
   * ihn auch vor einer dunklen Wand findet. Er schaut von seiner Wand weg in
   * die Gasse (x nach vorn, y nach oben, null in seiner Mitte); für die
   * rechte Wand wird gespiegelt.
   *
   *   pose   "wand" (er hängt), "rutsch", "flug" (ein Salto, dreh 0 bis 1),
   *          "steh" (auf dem Sims), "sturz"
   */
  function zeichneFeger(sx, sy, s, seite, pose, wahl = {}) {
    const { geist = null, alpha = 1, dreh = 0, stauch = 0, wehen = 0 } = wahl;
    const schwarz = geist || "#05071a";
    const kante = geist || "rgba(158, 184, 250, 0.95)";
    const tuch = geist || "#ff4d5e";
    const haut = geist || "#f2cfae";
    const holz = geist || "#27306a";
    g.save();
    g.globalAlpha = alpha;
    g.translate(sx, sy);
    g.scale(-seite * s, -s);
    if (pose === "flug" || pose === "sturz") g.rotate(-dreh * Math.PI * 2);
    if (stauch > 0) {
      // Beim Aufsetzen federt er in die Knie – die Füsse bleiben, wo sie sind.
      g.translate(0, -KOERPER);
      g.scale(1 + stauch * 0.1, 1 - stauch * 0.12);
      g.translate(0, KOERPER);
    }
    g.lineCap = "round";
    g.lineJoin = "round";
    const hockt = pose === "flug";
    const glied = (x0, y0, x1, y1, x2, y2, dick) => {
      g.lineWidth = dick;
      g.beginPath();
      g.moveTo(x0, y0);
      g.lineTo(x1, y1);
      g.lineTo(x2, y2);
      g.stroke();
    };
    const schuh = (x, y, w) => {
      g.save();
      g.translate(x, y);
      g.rotate(w);
      g.beginPath();
      g.roundRect(-1, -1.1, 3.6, 2.1, 1);
      g.fill();
      g.restore();
    };

    // Die Leiter auf dem Rücken, zur Wand hin.
    if (!hockt && pose !== "sturz") {
      g.strokeStyle = holz;
      g.lineWidth = 0.75;
      g.beginPath();
      g.moveTo(-4.3, -6.5);
      g.lineTo(-2.3, 8.6);
      g.moveTo(-2.2, -6.8);
      g.lineTo(-0.2, 8.3);
      for (let i = 0; i < 5; i += 1) {
        g.moveTo(-4 + i * 0.42, -4.4 + i * 3.1);
        g.lineTo(-1.9 + i * 0.42, -4.7 + i * 3.1);
      }
      g.stroke();
    }

    g.strokeStyle = schwarz;
    g.fillStyle = schwarz;
    // Die Beine.
    if (hockt) {
      glied(0.4, -3, 4.2, -2, 1.8, -6.2, 2.6);
      glied(-0.4, -3.2, 3.2, -4, 0.2, -7, 2.6);
      schuh(1.2, -6.6, 0.5);
    } else if (pose === "steh") {
      glied(1, -3.2, 1.4, -7.4, 1.4, -11, 2.6);
      glied(-1, -3.2, -1.3, -7.4, -1.3, -11, 2.6);
      schuh(1, -11, 0);
      schuh(-1.7, -11, 0);
    } else if (pose === "sturz") {
      glied(0.8, -3, 4.6, -6.4, 7, -10, 2.6);
      glied(-0.8, -3, -4.4, -7, -7.4, -8.4, 2.6);
    } else {
      // An der Wand: beide Füsse dagegen gestemmt, die Knie in der Gasse.
      const tief = pose === "rutsch" ? 0.9 : 0;
      glied(0.8, -3, 3.4, -6.6 - tief, -3.4, -8.4 - tief, 2.6);
      glied(-0.4, -3.4, 1.6, -9.4 - tief, -3.4, -10.9, 2.6);
      schuh(-4.4, -8 - tief, 1.35);
      schuh(-4.4, -10.6, 1.35);
    }

    // Der Rumpf: eine Jacke mit hellem Rand zum Mond.
    const rumpf = () => {
      g.beginPath();
      g.ellipse(0.1, -0.2, 3.1, 4.3, hockt ? 0.5 : 0.06, 0, Math.PI * 2);
      g.fill();
    };
    g.fillStyle = kante;
    g.save();
    g.translate(0.55, 0.3);
    rumpf();
    g.restore();
    g.fillStyle = schwarz;
    rumpf();
    if (!geist) {
      // Der Gürtel und zwei Knöpfe aus Messing.
      g.fillStyle = "#ffcf7a";
      g.fillRect(1.6, 0.8, 0.8, 0.8);
      g.fillRect(1.9, -1.2, 0.8, 0.8);
      g.fillRect(-2.6, -3, 5.6, 0.7);
    }

    // Die Arme – und in der freien Hand der Besen mit der Kugel.
    g.strokeStyle = schwarz;
    let hand = null;
    if (hockt) {
      glied(0.8, 2, 4, 0, 2.8, -3.6, 2.1);
    } else if (pose === "steh") {
      glied(-0.6, 2.2, -3.2, 0, -3.4, -3, 2.1);
      glied(0.8, 2.2, 3.4, -0.4, 4.2, -3, 2.1);
      hand = [4.2, -3];
    } else if (pose === "sturz") {
      glied(0.6, 2.2, 4.8, 5, 7.2, 8.6, 2.1);
      glied(-0.6, 2.2, -4.6, 4.6, -7.4, 7.4, 2.1);
    } else {
      // Eine Hand an der Wand über dem Kopf, eine frei.
      glied(-0.6, 2.4, -3.2, 5.6, -4.9, 8, 2.1);
      glied(0.8, 2.2, 3.6, 0, 4.4, -2.6, 2.1);
      hand = [4.4, -2.6];
    }
    if (hand) {
      const bx = hand[0] + 0.4 - wehen * 1.4;
      const by = hand[1] - 4.4 + Math.abs(wehen) * 0.6;
      g.lineWidth = 0.6;
      g.beginPath();
      g.moveTo(hand[0], hand[1]);
      g.lineTo(bx, by);
      g.stroke();
      g.fillStyle = schwarz;
      g.beginPath();
      for (let i = 0; i < 14; i += 1) {
        const w = (i / 14) * Math.PI * 2;
        const r = i % 2 ? 2.5 : 1.3;
        if (i === 0) g.moveTo(bx + Math.cos(w) * r, by + Math.sin(w) * r);
        else g.lineTo(bx + Math.cos(w) * r, by + Math.sin(w) * r);
      }
      g.closePath();
      g.fill();
    }

    // Das Halstuch, das im Wind steht.
    g.fillStyle = tuch;
    g.beginPath();
    g.moveTo(2.4, 2.6);
    g.lineTo(-1.6, 3.4);
    g.quadraticCurveTo(-4.4 - wehen * 2, 3 + wehen, -7.2 - wehen * 3, 1.6 + wehen * 2.6);
    g.quadraticCurveTo(-4.4 - wehen * 2, 1.4 + wehen * 0.6, -1.2, 1.9);
    g.lineTo(2.2, 1.6);
    g.closePath();
    g.fill();

    // Der Kopf.
    g.fillStyle = haut;
    g.beginPath();
    g.arc(0.9, 5.3, 2.7, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = schwarz;
    // Das Haar im Nacken.
    g.beginPath();
    g.arc(0.3, 5.9, 2.75, Math.PI * 0.5, Math.PI * 1.45);
    g.fill();
    if (!geist) {
      // Ein Auge, die Nase, ein Fleck Russ auf der Wange.
      g.fillStyle = "#1a1220";
      g.beginPath();
      g.arc(2.3, 5.6, 0.48, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = "rgba(30, 24, 40, 0.35)";
      g.beginPath();
      g.ellipse(1.5, 4, 0.9, 0.55, 0.3, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = "#e4b792";
      g.beginPath();
      g.arc(3.6, 4.9, 0.55, 0, Math.PI * 2);
      g.fill();
    }
    // Der Zylinder, ein wenig in den Nacken geschoben.
    g.save();
    g.translate(0.7, 7.3);
    g.rotate(-0.12);
    g.fillStyle = kante;
    g.fillRect(-1.6, 0.6, 4.6, 4.2);
    g.fillStyle = schwarz;
    g.beginPath();
    g.roundRect(-3.8, -0.3, 7.8, 1.2, 0.6);
    g.fill();
    g.fillRect(-2.2, 0.6, 4.6, 4.2);
    g.fillStyle = tuch;
    g.fillRect(-2.2, 0.9, 4.6, 1);
    g.restore();
    g.restore();
  }

  function zeichneFigur() {
    const k = state.kf;
    const s = view.s;
    const sx = bildX(k.x);
    const sy = bildY(k.y);
    const t = ruhig() ? 0 : state.zeit;
    if (state.schritt === "sturz" && state.sturz) {
      const f = state.sturz;
      zeichneFeger(sx, sy, s, k.seite, "sturz", { dreh: f.dreh, wehen: 0.8 });
      // Der Zylinder fliegt für sich.
      g.save();
      g.translate(bildX(f.hutX), bildY(f.hutY));
      g.rotate(f.hutDreh);
      g.scale(s, s);
      g.fillStyle = "#05071a";
      g.beginPath();
      g.roundRect(-3.9, -0.6, 7.8, 1.2, 0.6);
      g.fill();
      g.fillRect(-2.3, -4.8, 4.6, 4.2);
      g.fillStyle = "#ff4d5e";
      g.fillRect(-2.3, -1.9, 4.6, 1);
      g.restore();
      return;
    }
    if (state.schritt === "flug") {
      const u = clamp(k.flug / SPRUNG_ZEIT, 0, 1);
      zeichneFeger(sx, sy, s, k.seite, "flug", { dreh: ruhig() ? 0 : glatt(u), wehen: 1 });
      return;
    }
    if (state.schritt === "start") {
      zeichneFeger(sx, sy, s, k.seite, "steh", { wehen: 0.25 + Math.sin(t * 2.2) * 0.2 });
      return;
    }
    zeichneFeger(sx, sy, s, k.seite, state.schritt === "rutsch" ? "rutsch" : "wand", {
      stauch: state.stauch,
      wehen: state.schritt === "rutsch" ? -0.7 + Math.sin(t * 9) * 0.15 : 0.2 + Math.sin(t * 2.4) * 0.2,
    });
  }

  // Die Gegner als Geist (geist.js): ein Kaminfeger aus Licht.
  function zeichneGeister() {
    if (!gegner || state.phase === "bereit") return;
    const orte = window.LernappGeist?.orte?.(gegner) || [];
    if (!orte.length) return;
    const namen = [];
    orte.forEach((o) => {
      if (o.ziel) return;
      const x = o.a / 10;
      const sx = bildX(x);
      const sy = bildY(o.b);
      if (sy < -40 || sy > view.cssH + 40) return;
      const wie = o.c & 3;
      const seite = (o.c & 4) ? 1 : -1;
      const u = clamp((x * seite + HALB - ARM) / WEITE, 0, 1);
      zeichneFeger(sx, sy, view.s, seite, wie === 3 ? "flug" : wie === 2 ? "rutsch" : "wand", { geist: o.farbe, alpha: 0.6 * o.blass, dreh: wie === 3 ? 1 - u : 0 });
      const dy = o.b - state.kf.y;
      namen.push({ ...o, sx, sy: sy - 17 * view.s, weit: `${dy > 0 ? "+" : ""}${Math.round(dy / METER)} m` });
    });
    window.LernappGeist.namen(g, namen, { breit: view.cssW, hoch: view.cssH });
  }

  // ---------------------------------------------------------------------------
  // Zeichnen: Russ, Funken, Schnee, Schrift
  // ---------------------------------------------------------------------------
  function zeichneTeile() {
    if (!state.teile.length) return;
    state.teile.forEach((t) => {
      const k = clamp(t.leben / t.max, 0, 1);
      g.globalAlpha = t.art === "russ" ? k * 0.55 : k;
      g.fillStyle = t.art === "russ" ? "#0a0c22" : t.art === "funke" ? "#ffe9a3" : "#ffb35a";
      g.beginPath();
      g.arc(bildX(t.x), bildY(t.y), Math.max(0.6, t.r * view.s * (t.art === "russ" ? 1.6 - 0.6 * k : k)), 0, Math.PI * 2);
      g.fill();
    });
    g.globalAlpha = 1;
  }

  const FLOCKEN = Array.from({ length: 70 }, (_, i) => ({
    x: hash01(i * 2.9 + 4), y: hash01(i * 6.1 + 7), r: 0.5 + hash01(i * 8.3) * 1.1, v: 0.04 + hash01(i * 4.7) * 0.07, w: hash01(i * 1.3) * 6,
  }));

  function zeichneSchnee() {
    if (ruhig()) return;
    const W = view.cssW;
    const H = view.cssH;
    g.fillStyle = "rgba(236, 242, 255, 0.85)";
    g.beginPath();
    FLOCKEN.forEach((f) => {
      const y = ((f.y + state.zeit * f.v + (state.camY * view.s * 0.5) / H) % 1 + 1) % 1;
      const x = ((f.x + Math.sin(state.zeit * 0.7 + f.w) * 0.02) % 1 + 1) % 1;
      const r = f.r * Math.max(1, view.s * 0.42);
      g.moveTo(x * W + r, y * H);
      g.arc(x * W, y * H, r, 0, Math.PI * 2);
    });
    g.fill();
  }

  function zeichneSchriften() {
    if (!state.schriften.length) return;
    const k0 = state.kf;
    g.textAlign = "center";
    g.textBaseline = "middle";
    state.schriften.forEach((t) => {
      const k = clamp(t.leben / t.max, 0, 1);
      const gross = Math.round(clamp(t.gross * view.s * 0.42, 12, 28));
      g.font = `900 ${gross}px system-ui, sans-serif`;
      const halb = g.measureText(t.text).width / 2 + 8;
      const x = clamp(bildX(0), halb, view.cssW - halb);
      const y = bildY(k0.y) - (24 + (1 - k) * 10) * view.s;
      g.globalAlpha = Math.min(1, k * 2.4);
      g.lineWidth = Math.max(3, gross * 0.22);
      g.strokeStyle = "rgba(6, 8, 30, 0.9)";
      g.strokeText(t.text, x, y);
      g.fillStyle = t.farbe;
      g.fillText(t.text, x, y);
    });
    g.globalAlpha = 1;
  }

  // Vor dem ersten Tipp: der Bogen, den jeder Sprung nimmt – gepunktet.
  function zeichneBogen() {
    if (state.phase !== "bereit") return;
    const k = state.kf;
    g.fillStyle = "rgba(255, 255, 255, 0.75)";
    g.beginPath();
    for (let i = 1; i <= 9; i += 1) {
      const tau = (i / 10) * SPRUNG_ZEIT;
      const x = k.x - k.seite * WEITE * (tau / SPRUNG_ZEIT);
      const y = k.y + VY0 * tau - (G * tau * tau) / 2;
      const r = (0.9 + 0.5 * Math.sin(state.zeit * 4 - i * 0.7)) * view.s;
      g.moveTo(bildX(x) + r, bildY(y));
      g.arc(bildX(x), bildY(y), r, 0, Math.PI * 2);
    }
    g.fill();
  }

  function zeichnen() {
    if (!g) return;
    const wackel = ruhig() ? 0 : Math.sin(state.zeit * 64) * 4 * state.stoss;
    g.setTransform(view.dpr, 0, 0, view.dpr, 0, Math.round(wackel * view.dpr));
    g.globalAlpha = 1;
    const m = meterBei(state.camY + view.h * 0.33);
    const farben = himmelBei(m);
    zeichneHimmel(farben, m);
    zeichneStadt(farben);
    zeichneWolken(farben, false);
    zeichneHaeuser();
    zeichneMarken();
    zeichneHindernisse();
    zeichneBogen();
    zeichneGeister();
    zeichneFigur();
    zeichneTeile();
    zeichneWolken(farben, true);
    zeichneRauch();
    zeichneSchnee();
    zeichneSchriften();
  }

  // ---------------------------------------------------------------------------
  // Was aufstiebt
  // ---------------------------------------------------------------------------
  function teile(art, x, y, n, kraft, richtung = 0) {
    if (ruhig()) return;
    for (let i = 0; i < n; i += 1) {
      const w = Math.random() * Math.PI * 2;
      const v = (8 + Math.random() * 26) * kraft;
      const leben = art === "russ" ? 0.5 + Math.random() * 0.5 : 0.3 + Math.random() * 0.4;
      state.teile.push({
        art, x, y, vx: Math.cos(w) * v + richtung * 26 * kraft, vy: Math.sin(w) * v + (art === "russ" ? 10 : 0),
        r: art === "russ" ? 1.3 + Math.random() * 1.5 : 0.7 + Math.random() * 0.5, leben, max: leben,
      });
    }
    if (state.teile.length > 140) state.teile.splice(0, state.teile.length - 140);
  }

  function schrift(text, farbe, gross) {
    state.schriften = [{ text, farbe, gross, leben: 0.8, max: 0.8 }];
  }

  // ---------------------------------------------------------------------------
  // Springen, landen, rutschen, stürzen
  // ---------------------------------------------------------------------------
  function absprung() {
    const k = state.kf;
    // Im Fluss: noch im Halt weitergesprungen – der Sprung klingt mit jedem
    // solchen in Folge ein wenig höher.
    state.reihe = state.schritt === "halt" && state.spruenge > 0 ? state.reihe + 1 : 0;
    state.schritt = "flug";
    state.puffer = false;
    k.flug = 0;
    k.y0 = k.y;
    k.x0 = k.x;
    k.vr = 0;
    state.spruenge += 1;
    klang()?.ton?.("kaminfeger.sprung", { hoehe: 0.92 + Math.min(8, state.reihe) * 0.035 });
    teile("russ", k.x + k.seite * 2, k.y - 8, 5, 0.8, k.seite);
  }

  function landen() {
    const k = state.kf;
    k.seite = -k.seite;
    k.x = k.seite * (HALB - ARM);
    k.y = k.y0 + HUB;
    k.flug = 0;
    planBis(k.y + 700);
    const im = trifft(k.seite, k.y);
    if (im) {
      sturz("geprallt");
      return;
    }
    state.schritt = "halt";
    k.halt = HALT;
    k.vr = 0;
    state.stauch = 1;
    if (k.y > state.hoch) {
      state.hoch = k.y;
      const meter = Math.floor(meterBei(k.y));
      if (meter !== state.punkte) {
        state.punkte = meter;
        shell.setCount(meter);
      }
    }
    klang()?.ton?.("kaminfeger.landung");
    teile("russ", k.x + k.seite * 3, k.y - 9, 4, 0.7, -k.seite);
    // Haarscharf: so nah an einem Hindernis gelandet, dass kaum eine Hand
    // dazwischen passt.
    if (state.phase === "spiel" && abstand(k.seite, k.y) < KNAPP) {
      state.knappe += 1;
      klang()?.ton?.("kaminfeger.knapp", { hoehe: 1 + Math.min(6, state.knappe - 1) * 0.04 });
      schrift("Haarscharf!", "#ffe08a", 40);
      teile("funke", k.x + k.seite * 2, k.y, 9, 1);
      kids()?.vibrate?.(10);
    }
    // Ein Tipp kurz vor dem Aufsetzen gilt jetzt.
    if (state.puffer && state.phase === "spiel") absprung();
  }

  function sturz(warum, nurBild = false) {
    if (state.schritt === "sturz") return;
    const k = state.kf;
    state.schritt = "sturz";
    state.sturz = {
      warum, vx: -k.seite * (warum === "rauch" ? 6 : 34), vy: warum === "geprallt" ? 60 : 20, dreh: 0, drehV: -k.seite * (1.2 + Math.random() * 0.8),
      hutX: k.x, hutY: k.y + 10, hutVx: k.seite * 16, hutVy: 120, hutDreh: 0,
    };
    state.stoss = 1;
    state.puffer = false;
    klangAus();
    klang()?.ton?.("kaminfeger.sturz");
    klang()?.ton?.("kaminfeger.fall", { verzoegerung: 0.1 });
    kids()?.vibrate?.([30, 40, 60]);
    teile("russ", k.x, k.y, 14, 1.4);
    if (nurBild) return;
    stepTimer = window.setTimeout(finish, ruhig() ? 500 : STURZ_MS);
  }

  function sturzTakt(dt) {
    const f = state.sturz;
    const k = state.kf;
    if (!f) return;
    f.vy -= 620 * dt;
    k.x = clamp(k.x + f.vx * dt, -HALB + ARM, HALB - ARM);
    k.y += f.vy * dt;
    f.dreh += f.drehV * dt;
    f.hutVy -= 360 * dt;
    f.hutX += f.hutVx * dt;
    f.hutY += f.hutVy * dt;
    f.hutDreh += 5 * dt;
  }

  function physik(dt) {
    const k = state.kf;
    const n = Math.max(1, Math.ceil(dt / TAKT - 1e-9));
    const h = dt / n;
    for (let i = 0; i < n; i += 1) {
      if (state.schritt === "sturz") return;
      if (state.schritt === "flug") {
        k.flug += h;
        if (k.flug >= SPRUNG_ZEIT - 1e-9) {
          landen();
        } else {
          const u = k.flug / SPRUNG_ZEIT;
          k.x = k.x0 - k.seite * WEITE * u;
          k.y = k.y0 + VY0 * k.flug - (G * k.flug * k.flug) / 2;
        }
      } else if (state.schritt === "halt") {
        k.halt -= h;
        if (k.halt <= 0) state.schritt = "rutsch";
      } else if (state.schritt === "rutsch") {
        k.vr = Math.min(rutschBei(k.y), k.vr + RUTSCH_ZU * h);
        k.y -= k.vr * h;
        if (trifft(k.seite, k.y)) {
          sturz("gerutscht");
          return;
        }
      }
      // Der Rauch steigt – und bleibt nie weiter als RAUM zurück.
      if (state.phase === "spiel") {
        state.rauch = Math.max(state.rauch + rauchBei(state.hoch) * h, state.hoch - RAUM);
        if (state.schritt !== "flug" && state.schritt !== "sturz" && k.y - KOERPER * 0.4 < state.rauch) {
          sturz("rauch");
          return;
        }
      }
    }
  }

  // Der Tipp – zu der Zeit, zu der er geschah (jetzt, wie performance.now).
  function tippen(jetzt) {
    if (state.phase === "zuschauen" || state.phase === "ende") return;
    if (state.phase === "bereit") {
      losGehts();
      absprung();
      return;
    }
    if (state.phase !== "spiel" || state.schritt === "sturz") return;
    if (Number.isFinite(jetzt) && last) {
      const mehr = clamp((jetzt - last) / 1000 - voraus, 0, 0.05);
      if (mehr > 0) {
        physik(mehr);
        voraus += mehr;
      }
      if (state.schritt === "sturz") return;
    }
    if (state.schritt === "flug") {
      // Kurz vor dem Aufsetzen: Der Tipp gilt für den nächsten Sprung.
      if (SPRUNG_ZEIT - state.kf.flug <= PUFFER) state.puffer = true;
      return;
    }
    absprung();
  }

  // ---------------------------------------------------------------------------
  // Zuschauen
  // ---------------------------------------------------------------------------
  function zuschauenStarten() {
    if (!zuschauer?.lauf) return;
    startRun();
    state.phase = "zuschauen";
    state.schritt = "halt";
    shell.setPhase("play");
    zuschauer.los();
    klangAn();
  }

  function zuschauenTakt(dt) {
    const s = zuschauer.stand();
    if (!s) return;
    const k = state.kf;
    if (state.schritt !== "sturz") {
      const wie = s.c & 3;
      const seite = (s.c & 4) ? 1 : -1;
      const vorher = state.schritt;
      k.x = s.a / 10;
      k.y = s.b;
      k.seite = seite;
      state.schritt = wie === 3 ? "flug" : wie === 2 ? "rutsch" : wie === 1 ? "halt" : "start";
      if (state.schritt === "flug") k.flug = clamp((k.x * seite + HALB - ARM) / WEITE, 0, 1) * SPRUNG_ZEIT * -1 + SPRUNG_ZEIT;
      if (vorher === "flug" && state.schritt !== "flug") { state.stauch = 1; teile("russ", k.x + k.seite * 3, k.y - 7, 4, 0.7, -k.seite); }
      k.vr = state.schritt === "rutsch" ? rutschBei(k.y) : 0;
      if (k.y > state.hoch) state.hoch = k.y;
      // Der Rauch folgt dem höchsten Punkt, wie im Spiel.
      state.rauch = Math.max(state.rauch + rauchBei(state.hoch) * dt, state.hoch - RAUM);
      const punkte = Math.max(0, Math.floor(s.punkte));
      if (punkte !== state.punkte) {
        state.punkte = punkte;
        shell.setCount(punkte);
      }
      klangStellen();
    }
    if (!zuschauer.weiter() && state.schritt !== "sturz") sturz("ende", true);
    if (state.schritt === "sturz") sturzTakt(dt);
  }

  // ---------------------------------------------------------------------------
  // Der Takt
  // ---------------------------------------------------------------------------
  function takt(dt, strecke = dt) {
    state.zeit += dt;
    const k = state.kf;
    if (state.stoss > 0) state.stoss = Math.max(0, state.stoss - dt * 3.2);
    if (state.stauch > 0) state.stauch = Math.max(0, state.stauch - dt * 9);

    if (state.phase === "zuschauen") {
      zuschauenTakt(dt);
    } else if (state.schritt === "sturz") {
      sturzTakt(dt);
    } else if (state.phase === "spiel") {
      if (strecke > 0) physik(strecke);
      klangStellen();
      if (state.schritt === "rutsch" && !ruhig() && Math.random() < dt * 26) teile("glut", k.x + k.seite * 4, k.y - 8, 1, 0.5, -k.seite);
    }

    for (let i = state.teile.length - 1; i >= 0; i -= 1) {
      const t = state.teile[i];
      t.vy -= (t.art === "russ" ? -6 : 120) * dt;
      t.vx *= 1 - 2 * dt;
      t.x += t.vx * dt;
      t.y += t.vy * dt;
      t.leben -= dt;
      if (t.leben <= 0) state.teile.splice(i, 1);
    }
    for (let i = state.schriften.length - 1; i >= 0; i -= 1) {
      state.schriften[i].leben -= dt;
      if (state.schriften[i].leben <= 0) state.schriften.splice(i, 1);
    }

    // Die Kamera folgt ihm weich – beim Sturz bleibt sie stehen.
    if (state.schritt !== "sturz") {
      const ziel = Math.max(camZiel(), state.phase === "bereit" ? -8 : -1e9);
      state.camY += (ziel - state.camY) * (1 - Math.exp(-(state.phase === "bereit" ? 30 : 7) * dt));
    }
    planBis(state.camY + view.h + 400);

    if (state.phase === "spiel" && state.schritt !== "sturz") {
      const wie = state.schritt === "flug" ? 3 : state.schritt === "rutsch" ? 2 : state.schritt === "halt" ? 1 : 0;
      gegner?.takt(state.punkte, { a: Math.round(k.x * 10), b: Math.round(k.y), c: wie + (k.seite > 0 ? 4 : 0) });
    }
  }

  function loop(now) {
    frame = window.requestAnimationFrame(loop);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const strecke = Math.max(0, dt - voraus);
    voraus = 0;
    messen();
    takt(dt, strecke);
    zeichnen();
  }

  // Die Runde beginnt: mit dem ersten Tipp (er springt gleich) – oder im
  // Live-Modus zum gemeinsamen Start: Dann steht er noch auf dem Sims, und
  // der Rauch steigt schon.
  function losGehts() {
    if (state.phase !== "bereit") return;
    state.phase = "spiel";
    shell.setPhase("play");
    gegner?.los();
    klangAn();
    kids()?.vibrate?.(8);
  }

  // ---------------------------------------------------------------------------
  // Ablauf
  // ---------------------------------------------------------------------------
  function startRun() {
    clearStep();
    stopLoop();
    klangAus();
    shell.closeOverlay();
    zufall.neu();
    shell.setPhase("intro");
    state.phase = "bereit";
    state.schritt = "start";
    state.punkte = 0;
    state.hoch = START_Y;
    state.spruenge = 0;
    state.knappe = 0;
    state.reihe = 0;
    state.kf = { x: -HALB + ARM, y: START_Y, seite: -1, halt: 0, vr: 0, flug: 0, y0: START_Y, x0: -HALB + ARM };
    state.puffer = false;
    state.rauch = START_Y - RAUM - 30;
    state.sturz = null;
    state.teile = [];
    state.schriften = [];
    state.zeit = 0;
    state.stoss = 0;
    state.stauch = 0;
    gasseNeu();
    voraus = 0;
    shell.setCount(0);
    gegner?.runde();

    shell.clear();
    const prompt = shell.el("p", "cm-prompt kf-prompt", "Tippen – er springt an die Wand gegenüber. Berühre nichts!");
    shell.play.append(prompt, buildPlatz());
    view.cssW = 0;
    view.cssH = 0;
    messen();
    state.camY = Math.max(camZiel(), -8);

    last = performance.now();
    frame = window.requestAnimationFrame(loop);
  }

  function zaehleHoch(ziel) {
    const zahl = host.querySelector(".cm-result-score");
    if (!zahl) return;
    if (ruhig() || ziel <= 1) { zahl.textContent = String(ziel); return; }
    const dauer = Math.min(800, 160 + ziel * 6);
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

  const WARUM = { geprallt: "Auf einem Hindernis gelandet", gerutscht: "In ein Hindernis gerutscht", rauch: "Vom Rauch eingeholt" };

  function finish() {
    clearStep();
    stopLoop();
    klangAus();
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
    const spruenge = `${state.spruenge} ${state.spruenge === 1 ? "Sprung" : "Sprünge"}`;
    const warum = WARUM[state.sturz?.warum] || "";
    shell.showResult({
      label: "Deine Meter",
      points: punkte,
      detail: rekord ? "Neuer Rekord!" : `${warum ? `${warum} · ` : ""}${spruenge} · ${state.knappe} haarscharf`,
      geist,
    });
    if (rekord) host.querySelector(".cm-result-detail")?.classList.add("kf-rekord");
    zaehleHoch(punkte);
  }

  // ---------------------------------------------------------------------------
  // Start
  // ---------------------------------------------------------------------------
  shell = shellApi.mount({
    host,
    title: "Kaminfeger",
    area: "geschwindigkeit",
    accent: "#F5A623",
    accentDark: "#b9741a",
    clock: false,
    onRestart: () => (zuschauer ? zuschauenStarten() : startRun()),
    live: { los: losGehts, stopp: () => finish(), zuschauen: (quelle) => { zuschauer = quelle; zuschauenStarten(); } },
  });
  zuschauer = window.LernappGeist?.zuschauer?.({
    host, spiel: "chimneySweep", fassung: "t1", zufall, einheit: "m", nochmal: zuschauenStarten,
  }) || null;
  if (!zuschauer) {
    gegner = window.LernappGeist?.fuer?.({ spiel: "chimneySweep", host, art: "tempo", alle: true, zufall }) || null;
  }

  startRun();
  zuschauer?.laden.then((da) => { if (da) zuschauenStarten(); });

  // Ein Tipp irgendwo aufs Bild: Er springt. Nur Knöpfe bleiben Knöpfe.
  host.addEventListener("pointerdown", (event) => {
    if (event.target.closest("button, a, input")) return;
    const t = Math.abs(performance.now() - event.timeStamp) < 250 ? event.timeStamp : performance.now();
    tippen(t);
  });

  const TASTEN = new Set([" ", "Enter", "ArrowUp", "ArrowLeft", "ArrowRight"]);
  document.addEventListener("keydown", (event) => {
    if (!TASTEN.has(event.key)) return;
    if (document.activeElement?.tagName === "BUTTON") return;
    event.preventDefault();
    if (event.repeat) return;
    tippen(performance.now());
  });

  window.addEventListener("resize", messen);
  window.addEventListener("orientationchange", messen);
  window.addEventListener("pagehide", () => { clearStep(); stopLoop(); klangAus(); });

  // Für die Prüfskripte und die Vorführung.
  window.LernappKaminfeger = {
    METER, HUB, KOERPER, HALT, SPRUNG_ZEIT, START_Y, RAUM, LUFT0, LUFT_MIN, state, view,
    takt, tippen, losGehts, physik, planBis, trifft, abstand, gasseText, rutschBei, rauchBei, luftBei,
  };
})();
