/*
 * jongleur.js – Jongleur.
 * ---------------------------------------------------------------------------
 * Ein Jongleur steht im Zirkuszelt mitten in der Manege, im Licht des
 * Scheinwerfers, und hält in jeder Hand einen Ball. Ein Tipp auf die linke
 * Bildhälfte lässt die linke Hand werfen, einer auf die rechte die rechte –
 * mit zwei Fingern auch beide zugleich. Am Rechner: A oder Pfeil links für
 * links, L, D oder Pfeil rechts für rechts. Geworfen wird wie in einer
 * Kaskade: Jeder Ball fliegt in hohem Bogen hinüber in die ANDERE Hand und
 * bleibt dort liegen, bis diese Hand ihn wieder wirft.
 *
 * Jede Hand hält höchstens ein Ding. Kommt eines in eine Hand, die noch
 * eines hält, prallen sie zusammen, eines fällt ins Sägemehl – und die
 * Runde ist vorbei. Also: wirf, bevor das nächste ankommt. Wer etwas zu
 * lange hält (eine Fackel schon nach einer halben Sekunde), lässt es fallen.
 * Ein Tipp mit leerer Hand ist ein Luftgriff: Er zählt nicht, reisst die
 * Serie, und die Hand braucht eine Fünftelsekunde, bis sie wieder greift.
 * Kurz vor der Landung getippt, ist kein Luftgriff: Die Hand wartet und wirft
 * im Augenblick des Fangs.
 *
 * Gezählt werden die Fänge. «Perfekt» ist ein Wurf, der gleich nach dem Fang
 * kommt (PERFEKT_NACH): Er zieht eine goldene Spur, bringt den Ball genau in
 * den Takt (er landet so, als wäre er im idealen Augenblick D_IDEAL nach dem
 * Fang geflogen) – und rückt ihn ein Stück in die Mitte seiner Lücke, weg
 * vom Ball davor und dem danach (korrektur). Wer perfekt wirft, jongliert
 * also immer gleichmässiger, wie ein Uhrwerk; wer zu spät wirft, bringt den
 * Takt durcheinander. Perfekte Würfe in Folge sind die Serie; alle zehn
 * regnet es Konfetti, und das Lauflicht der Lichterketten läuft mit.
 *
 * Kurz tippen ist ein gewöhnlicher Wurf. Wer länger hält (ab H_TAP), wirft
 * beim Loslassen höher – bis H_VOLL immer höher, dann nicht mehr. Ein hoher
 * Wurf ist länger in der Luft: So lässt sich ein Ball, der zu nahe hinter
 * einem anderen herfliegt, nach hinten schieben. Er zählt nicht als perfekt,
 * reisst die Serie aber auch nicht.
 *
 * Schwerer wird es mit den Fängen: Alle zehn Fänge läuft von der Seite ein
 * Clown herein, mit Trommelwirbel, und wirft ein Ding dazu – genau in die
 * grösste Lücke, die der Takt gerade hat. Man muss es in die Kaskade
 * einbauen. Höchstens DINGE_MAX sind es. Und die Schwerkraft wächst stetig:
 * Die Bögen bleiben gleich hoch, aber die Bälle fliegen schneller.
 * Später kommen statt Bällen auch andere Dinge:
 *
 *   Keule    dreht sich, fliegt höher und länger. Perfekt geworfen bleibt sie
 *            im Takt, sonst kommt sie zu spät.
 *   Fackel   brennt: Nach einer halben Sekunde in der Hand ist sie zu heiss.
 *   Kugel    schwer: fliegt flacher und schneller, und hoch werfen lässt sie
 *            sich nicht. Perfekt geworfen bleibt sie im Takt, sonst kommt
 *            sie zu früh.
 *   Apfel    Der Jongleur beisst bei jedem Fang hinein. Beim fünften ist er
 *            gegessen – und ein Ding weniger in der Luft.
 *
 * Was dazukommt, steht in einem Plan aus dem Zufall (zufall.js), Zugabe für
 * Zugabe mit immer gleich vielen Zahlen: ohne Turnier jedes Mal anders, im
 * Turnier für alle im selben Versuch derselbe. Wohin der Clown wirft, folgt
 * aus dem Takt, nicht aus dem Zufall.
 *
 * Gerechnet wird in festen Schritten (TAKT, 240 je Sekunde), und alles, was
 * zählt, ist ganzzahlig: Wann ein Ding geworfen wurde und wann es landet,
 * sind Schritte. Jedes Drücken und jedes Loslassen ist ein Zug (geist.js,
 * zuege; live-spiel.js, zug) mit dem Schritt, in dem es geschah. Beim
 * Zuschauen (Hall of Fame und Multiplayer) baut die Saat denselben Plan, und
 * jeder Zug kommt im selben Schritt – so läuft genau dieselbe Runde ab, Fang
 * für Fang, bis zum selben Zusammenstoss. Im Multiplayer werden Züge, die
 * kurz hintereinander kommen, zu einem; darum trägt dort jeder Zug die
 * letzten sechs davor mit (b), falls sie dicht davor lagen. Und kommt einer
 * zu spät, baut der Zuschauer die Runde still von vorn bis zur Stelle neu
 * (neuAufbauen).
 *
 * Gegner: wie im Turmbau als Zielmarke (geist.js, art "ziel") – die Schalter
 * oben zeigen Platz 1 und die eigene Bestmarke, und oben links steht unter
 * den Fängen ihre Zahl, mit einem Haken, sobald sie geschlagen ist.
 *
 * Die Welt in Einheiten: y zählt nach oben, der Manegenboden liegt bei 0,
 * die Mitte bei x = 0. Die Hände fangen aussen (FANG_X) und werfen innen
 * (WURF_X), auf HAND_Y. Was immer im Bild steht (SICHT_W × SICHT_H), ist
 * überall gleich gross – hochkant steht mehr Zeltdach darüber, quer mehr
 * Publikum daneben. Hohe Würfe dürfen oben aus dem Bild fliegen; ein Pfeil
 * am Rand zeigt, wo sie sind.
 *
 * Gezeichnet wird auf eine Leinwand: Zeltbahnen, Lichterketten, die Ränge
 * mit Publikum, das Sägemehl der Manege und der Scheinwerfer liegen einmal je
 * Bildgrösse fertig gemalt im Speicher (maleHintergrund); der Jongleur, der
 * Clown, die Dinge, Lichter, Blitze und Teilchen kommen jedes Bild neu dazu.
 */
(() => {
  "use strict";

  if (document.body.dataset.page !== "juggle") return;

  const host = document.querySelector("#jg-stage");
  const shellApi = window.LernappGameShell;
  const cloudApi = window.LernappGameCloud;
  if (!host || !shellApi) return;

  const kids = () => window.LernappKids || null;
  // Wer weniger Bewegung eingestellt hat, bekommt keinen Stoss aufs Bild,
  // keine Zeitlupe, weniger Konfetti und kaum Blitze. Die Bälle fliegen
  // trotzdem – das ist das Spiel.
  const ruhig = () => Boolean(kids()?.prefersReducedMotion?.());

  // Der Zufall. Ohne Turnier in der Adresse ist das Math.random; im Turnier
  // und im Live-Modus bekommt jeder denselben Plan (zufall.js). Nur der Plan
  // zieht daraus – Funken, Konfetti und Blitze würfeln Math.random oder
  // hängen an einer festen Zahl (hash01).
  const zufall = window.LernappZufall?.fuer?.("juggler") || { neu() {}, zahl: () => Math.random() };

  // ---------------------------------------------------------------------------
  // Die Welt
  // ---------------------------------------------------------------------------
  const HZ = 240;
  const TAKT = 1 / HZ;             // ein Schritt der Rechnung
  const sek = (s) => Math.round(s * HZ);

  const BODEN_SICHT = 62;          // so viel Boden und Publikum steht unter der Manege im Bild
  const OBEN = 352;                // so hoch reicht, was immer im Bild steht
  const SICHT_W = 300;
  const SICHT_H = OBEN + BODEN_SICHT;
  const HAND_Y = 96;               // auf dieser Höhe fangen und werfen die Hände
  const FANG_X = 68;               // aussen wird gefangen …
  const WURF_X = 36;               // … innen geworfen
  const SCHULTER_X = 22;
  const SCHULTER_Y = 128;
  const OBERARM = 32;
  const H_NORM = 185;              // so hoch steigt ein gewöhnlicher Wurf über die Hände
  const CLOWN_X = 158;             // dort steht der Clown, wenn er wirft (auf schmalen Bildern weiter innen)

  // Der Takt. Alles in Schritten.
  const PERFEKT_NACH = sek(0.1);   // so lange nach dem Fang ist ein Wurf perfekt
  const FRUEH = sek(0.09);         // so kurz vor dem Fang gedrückt, wartet die Hand (kein Luftgriff)
  const D_IDEAL = sek(0.04);       // der ideale Augenblick nach dem Fang
  const SPERRE = sek(0.22);        // so lange greift eine Hand nach einem Luftgriff nicht
  const H_TAP = sek(0.17);         // kürzer gehalten: ein gewöhnlicher Wurf
  const H_VOLL = sek(0.5);         // so lange gehalten: der höchste Wurf
  const HOCH_MAX = 0.45;           // der höchste Wurf fliegt so viel länger
  const HALTEN_MAX = sek(1.6);     // länger gehalten, fällt es
  const FACKEL_MAX = sek(0.5);     // die Fackel schon nach einer halben Sekunde
  const FLUG_MIN = sek(0.3);
  // Der Takt aller: Ein perfekter Wurf rückt KAPPA des Wegs in die Mitte
  // seiner Lücke, höchstens um KORR_MAX seiner Flugzeit.
  const KAPPA = 0.8;
  const KORR_MAX = 0.15;

  // Die Flugzeit eines gewöhnlichen Wurfs in Sekunden, nach Fängen: erst
  // schnell kürzer, dann stetig weiter, nie unter F_MIN.
  const F0 = 1.3;
  const F_END = 0.8;
  const F_WEG = 60;
  const F_JE = 0.0006;
  const F_MIN = 0.62;

  // Die Zugaben des Clowns.
  const START_DINGE = 2;
  const DINGE_MAX = 10;
  const ZUGABE_JE = 10;            // alle so viele Fänge ein Ding dazu
  const TROMMEL = sek(1.1);        // so lange wirbelt die Trommel, bevor er zielt
  const CLOWN_FLUG = sek(1.0);     // so lange fliegt sein Wurf
  const APFEL_FAENGE = 5;          // beim fünften Fang ist der Apfel gegessen
  const ZAHLEN_JE_ZUGABE = 4;      // so viele Zufallszahlen zieht jede Zugabe, immer gleich viele

  // Was die Dinge können: flug – wie lange ein gewöhnlicher Wurf fliegt
  // (Anteil), hoehe – wie hoch der Bogen im Bild aussieht.
  const ART = {
    ball: { flug: 1, hoehe: 1, name: "Ball", r: 14 },
    keule: { flug: 1.15, hoehe: 1.08, name: "Keule", r: 16, lang: 54 },
    fackel: { flug: 1, hoehe: 1.06, name: "Fackel", r: 15, lang: 46 },
    kugel: { flug: 0.85, hoehe: 0.62, name: "Kugel", r: 15.5 },
    apfel: { flug: 1, hoehe: 1, name: "Apfel", r: 14.5 },
  };
  // Wie hoch über der Hand ein Ding liegt (seine Mitte): Bälle auf dem
  // Handschuh, Keule und Fackel am Griff gehalten.
  const auflage = (art) => (ART[art].lang ? ART[art].lang * 0.5 + 2 : ART[art].r * 0.75);
  const ANSAGE = {
    ball: ["Ein Ball mehr!", ""],
    keule: ["Eine Keule!", "Sie fliegt länger – wirf sie perfekt."],
    fackel: ["Eine Fackel!", "Heiss! Gleich weiterwerfen."],
    kugel: ["Eine schwere Kugel!", "Fliegt flach – hoch geht nicht."],
    apfel: ["Ein Apfel!", "Mmh – fünfmal fangen, dann ist er weg."],
  };
  const FARBEN = [
    { name: "rot", haupt: "#ff3b4e", hell: "#ff95a0", dunkel: "#a8102a" },
    { name: "gelb", haupt: "#ffc928", hell: "#ffe68f", dunkel: "#c27f00" },
    { name: "blau", haupt: "#3d8bff", hell: "#a5c9ff", dunkel: "#1846a8" },
    { name: "gruen", haupt: "#35d07f", hell: "#9ef2c3", dunkel: "#0f7d43" },
    { name: "lila", haupt: "#a45cff", hell: "#d6b3ff", dunkel: "#5f22b5" },
    { name: "orange", haupt: "#ff8a2a", hell: "#ffc493", dunkel: "#b84d00" },
    { name: "pink", haupt: "#ff5fb4", hell: "#ffb0da", dunkel: "#b51b6d" },
    { name: "tuerkis", haupt: "#22d3e0", hell: "#a3f3f8", dunkel: "#087e8a" },
  ];

  // Die Züge (meldeZug): c = Nummer × 8 + was.
  const ZUG_START = 0;
  const ZUG_DRUCK = 1;             // 1 links, 2 rechts
  const ZUG_LOS = 3;               // 3 links, 4 rechts
  const ZUG_ENDE = 5;
  const ZUG_VORHER = 6;            // so viele Züge davor trägt jeder im Multiplayer mit (b)

  const AUFHOLEN_MAX = 48;         // so viele Schritte holt ein Bild höchstens auf
  const ENDE_MS = 1700;            // vom Fehler bis zur Tafel
  const TOP_COUNT = 5;
  const TAU = Math.PI * 2;

  const store = cloudApi
    ? cloudApi.register({ key: "lernapp.jongleur", empty: { runs: 0, scores: [] }, merge: cloudApi.mergeScores(TOP_COUNT) })
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
  const mod = (a, n) => ((a % n) + n) % n;
  const flugZeit = (k) => Math.max(F_MIN, F_END + (F0 - F_END) * Math.exp(-k / F_WEG) - F_JE * k);
  const flugTicks = (k) => Math.round(flugZeit(k) * HZ);

  // Immer dieselbe Zahl zu derselben Eingabe: Publikum, Sägemehl und
  // Lichter stehen bei jedem Bild am selben Platz, ohne den Zufall
  // anzufassen.
  function hash01(n) {
    const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return x - Math.floor(x);
  }

  // ---------------------------------------------------------------------------
  // Zustand
  // ---------------------------------------------------------------------------
  // phase: "bereit"    der Jongleur wartet mit zwei Bällen, noch nichts getippt
  //        "spiel"     die Runde läuft
  //        "ende"      ein Fehler, Zeitlupe, gleich kommt die Tafel
  //        "zuschauen" die Runde eines anderen, Zug um Zug
  //
  // Ein Ding: ort "hand" (in haende[hand]), "flug" (unterwegs zur hand),
  // "clown" (noch beim Clown) oder "weg" (gegessen).
  function neueHand() {
    return {
      ding: null,                 // die id des Dings in der Hand
      gedrueckt: false,
      druckTick: 0,
      druckArt: "",               // "halten", "vorgriff", "leer", "gesperrt"
      sperreBis: -1,
      losAusstehend: false,       // vor der Landung losgelassen: wirft beim Fang
    };
  }

  // Wie die Hände, der Körper und der Clown im Bild stehen – nur fürs Bild.
  function neuesBild() {
    return {
      haende: [-1, 1].map((seite) => ({ x: seite * FANG_X, y: HAND_Y, vx: 0, vy: 0, wurf: -9, fang: -9, druck: -9, laden: 0 })),
      bob: 0, bobV: 0, lean: 0, leanZiel: 0,
      clownX: 0, clownSichtbar: false, clownSeite: 1, clownWurf: -9, clownWinke: -9,
      jubelBis: -9, schreckBis: -9, kauenBis: -9, blinzeln: 2,
      tippL: -9, tippR: -9,
    };
  }

  const state = {
    phase: "bereit",
    tick: 0,
    losMs: 0,
    uhrRest: 0,
    punkte: 0,                    // die Fänge
    serie: 0,
    besteSerie: 0,
    perfekte: 0,
    meisteDinge: START_DINGE,
    dinge: [],
    haende: [neueHand(), neueHand()],
    naechsteId: 0,
    plan: [],
    zugaben: 0,                   // so viele Zugaben haben begonnen
    zugabeAb: ZUGABE_JE,          // ab so vielen Fängen kommt die nächste
    zugabe: null,
    fehler: null,
    fertig: false,
    zugNr: 0,
    zugVerlauf: [],
    stumm: false,                 // beim Nachbauen ohne Bild und Ton
    // Nur fürs Bild:
    bild: neuesBild(),
    echt: 0,
    zeit: 0,
    lupe: 0,
    stoss: 0,
    glanz: 0,
    ansage: null,
    teile: [],
    schriften: [],
    wellen: [],
    faelle: [],
    blitze: [],
    jubel: 0,
    tippGezeigt: false,
  };

  let shell = null;
  let feld = null;
  let canvas = null;
  let g = null;
  let promptKnoten = null;
  let frame = null;
  let last = 0;
  let stepTimer = null;
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

  const view = { s: 1, dpr: 1, cssW: 0, cssH: 0, w: SICHT_W, h: SICHT_H, frei: 0, camX: 0, camY: -BODEN_SICHT };

  function clearStep() {
    if (stepTimer) { window.clearTimeout(stepTimer); stepTimer = null; }
  }

  function stopLoop() {
    if (frame) { window.cancelAnimationFrame(frame); frame = null; }
  }

  const dingVon = (id) => (id === null || id === undefined ? null : state.dinge.find((d) => d.id === id) || null);
  const aktiv = (d) => d.ort === "hand" || d.ort === "flug" || d.ort === "clown";
  const anzahlDinge = () => state.dinge.reduce((n, d) => n + (aktiv(d) ? 1 : 0), 0);

  // ---------------------------------------------------------------------------
  // Der Plan
  // ---------------------------------------------------------------------------
  /*
   * Was der Clown bringt, Zugabe für Zugabe – jede zieht genau
   * ZAHLEN_JE_ZUGABE Zahlen, auch wenn sie nicht alle braucht. So hängt der
   * Plan nur an der Saat, nicht daran, wie weit jemand kommt.
   *
   *   art    die ersten zwei Zugaben sind Bälle, die dritte ein Ball, eine
   *          Keule oder ein Apfel, danach alles
   *   farbe  die Farbe (die ersten zwei gehören den Bällen vom Start)
   *   seite  von wo der Clown hereinkommt
   */
  function neueZugabe() {
    const i = state.plan.length;
    const z = [];
    for (let k = 0; k < ZAHLEN_JE_ZUGABE; k += 1) z.push(zufall.zahl());
    let art = "ball";
    if (i === 2) art = z[0] < 0.45 ? "ball" : z[0] < 0.75 ? "keule" : "apfel";
    else if (i >= 3) {
      const wahl = [["ball", 0.3], ["keule", 0.2], ["fackel", 0.18], ["kugel", 0.16], ["apfel", 0.16]];
      let rest = z[0];
      art = wahl[wahl.length - 1][0];
      for (const [name, anteil] of wahl) {
        if (rest < anteil) { art = name; break; }
        rest -= anteil;
      }
    }
    state.plan.push({
      art,
      farbe: 2 + Math.floor(z[1] * (FARBEN.length - 2)),
      seite: z[2] < 0.5 ? -1 : 1,
      hut: z[3],
    });
  }

  function planBis(n) {
    while (state.plan.length < n) neueZugabe();
  }

  // Für das Turnier: die gewürfelte Welt dieser Runde als Text.
  function weltText() {
    planBis(20);
    return state.plan.slice(0, 20).map((e, i) => `${i + START_DINGE + 1}:${e.art}/${FARBEN[e.farbe].name}/${e.seite < 0 ? "L" : "R"}`).join(" ");
  }

  // ---------------------------------------------------------------------------
  // Die Rechnung: Werfen, Fangen, der Takt
  // ---------------------------------------------------------------------------
  function neuesDing(art, farbe) {
    const d = {
      id: state.naechsteId,
      art,
      farbe,
      ort: "hand",
      hand: 0,
      fangTick: 0,
      start: false,               // seit dem Start in der Hand, noch nie gefangen
      faenge: 0,
      von: 0,                     // woher geworfen: 0/1 die Hand, -1 der Clown
      wurfTick: 0,
      landTick: 0,
      perfekt: false,
      hoch: false,
      // Nur fürs Bild: der Bogen.
      x0: 0, y0: 0, x1: 0, y1: 0, bogen: H_NORM, dreh0: 0, drehungen: 0, spin: 0,
      quetsch: 0,
    };
    state.naechsteId += 1;
    state.dinge.push(d);
    return d;
  }

  /*
   * Wann ein Ding als Nächstes in einer Hand ankommt – wenn ab jetzt jeder
   * Wurf perfekt käme. Daraus rechnen der Takt (korrektur), der Clown
   * (zielen) und das Bild (die Warnungen). { tick, hand } oder null.
   */
  function ankunft(d) {
    const T = state.tick;
    const FT = flugTicks(state.punkte);
    if (d.ort === "flug") return { tick: d.landTick, hand: d.hand };
    if (d.ort === "hand") {
      const imFenster = !d.start && T <= d.fangTick + PERFEKT_NACH;
      const land = imFenster ? d.fangTick + D_IDEAL + FT : T + Math.round(FT * ART[d.art].flug);
      return { tick: Math.max(land, T + 1), hand: 1 - d.hand };
    }
    if (d.ort === "clown" && state.zugabe && state.zugabe.landTick > 0) return { tick: state.zugabe.landTick, hand: state.zugabe.hand };
    return null;
  }

  /*
   * Der gleichmässige Takt. Im Takt, den alle perfekt geworfenen Dinge
   * haben, kommt jedes alle zwei Zyklen (P) in derselben Hand an. Die
   * Ankünfte aller anderen in der Zielhand, auf eine Runde von P gelegt, und
   * das Ding, das gerade fliegt, bei a0: Es rückt um KAPPA in die Mitte
   * zwischen das Ding davor und das danach. So kommt es keinem zu nahe, und
   * von Wurf zu Wurf werden die Abstände gleicher.
   */
  function korrektur(dWurf, a0, zielHand, FT) {
    const C = FT + D_IDEAL;
    const P = 2 * C;
    let vor = Infinity;
    let nach = Infinity;
    for (const d of state.dinge) {
      if (d === dWurf || !aktiv(d)) continue;
      const a = ankunft(d);
      if (!a) continue;
      const r = mod((a.hand === zielHand ? a.tick : a.tick + C) - a0, P);
      nach = Math.min(nach, r);
      vor = Math.min(vor, P - r);
    }
    if (!Number.isFinite(nach)) return 0;
    const grenze = KORR_MAX * FT;
    return Math.round(clamp((KAPPA * (nach - vor)) / 2, -grenze, grenze));
  }

  // Wann in einer Hand das Nächste landet (Schritt) – oder null.
  function naechsteLandung(h) {
    let best = null;
    for (const d of state.dinge) {
      if (d.ort === "flug" && d.hand === h && (best === null || d.landTick < best)) best = d.landTick;
    }
    return best;
  }

  /*
   * Ein Wurf aus Hand h. haltT: wie lange gedrückt war (Schritte), druckT:
   * wann gedrückt wurde. Kurz getippt, zählt der Augenblick des Drückens –
   * vor dem Fang gedrückt, der des Fangs; lange gehalten, der des Loslassens.
   */
  function werfen(h, haltT, druckT) {
    const hd = state.haende[h];
    const d = dingVon(hd.ding);
    if (!d) return;
    const T = state.tick;
    const FT = flugTicks(state.punkte);
    const art = ART[d.art];
    hd.ding = null;
    let land;
    let perfekt = false;
    let hoch = false;
    if (haltT >= H_TAP && d.art !== "kugel") {
      hoch = true;
      const u = clamp((haltT - H_TAP) / (H_VOLL - H_TAP), 0, 1);
      land = T + Math.round(FT * art.flug * (1 + HOCH_MAX * u));
    } else {
      const wurfT = Math.max(druckT, d.fangTick);
      if (!d.start && wurfT - d.fangTick <= PERFEKT_NACH) {
        perfekt = true;
        const a0 = d.fangTick + D_IDEAL + FT;
        land = a0 + korrektur(d, a0, 1 - h, FT);
      } else {
        land = wurfT + Math.round(FT * art.flug);
        // Die zwei Bälle vom Start rücken auch in den Takt.
        if (d.start) land += korrektur(d, land, 1 - h, FT);
      }
    }
    land = Math.max(land, T + FLUG_MIN);
    const vorher = d.start;
    d.ort = "flug";
    d.hand = 1 - h;
    d.von = h;
    d.wurfTick = T;
    d.landTick = land;
    d.perfekt = perfekt;
    d.hoch = hoch;
    d.start = false;
    if (perfekt) {
      state.serie += 1;
      state.perfekte += 1;
      state.besteSerie = Math.max(state.besteSerie, state.serie);
    } else if (!hoch && !vorher) {
      state.serie = 0;
    }
    wurfBild(d, h, FT);
  }

  // Ein Druck auf Hand h – im Schritt state.tick. Gibt zurück, ob er etwas
  // bewirkt (nur dann ist er ein Zug): Ein Druck, solange die Hand nach
  // einem Luftgriff gesperrt ist, bewirkt nichts, sein Loslassen auch nicht.
  function druck(h) {
    const hd = state.haende[h];
    if (hd.gedrueckt) return false;
    hd.gedrueckt = true;
    hd.druckTick = state.tick;
    if (state.tick < hd.sperreBis) { hd.druckArt = "gesperrt"; return false; }
    hd.losAusstehend = false;
    if (hd.ding !== null) { hd.druckArt = "halten"; druckBild(h); return true; }
    const landung = naechsteLandung(h);
    if (landung !== null && landung - state.tick <= FRUEH) { hd.druckArt = "vorgriff"; druckBild(h); return true; }
    // Ein Luftgriff: zählt nicht, reisst die Serie, und die Hand braucht
    // einen Augenblick.
    hd.druckArt = "leer";
    hd.sperreBis = state.tick + SPERRE;
    const hatte = state.serie;
    state.serie = 0;
    luftgriffBild(h, hatte);
    return true;
  }

  // Loslassen: Wer etwas hält, wirft. Gibt zurück, ob der Druck dazu ein Zug
  // war.
  function los(h) {
    const hd = state.haende[h];
    if (!hd.gedrueckt) return false;
    hd.gedrueckt = false;
    const art = hd.druckArt;
    hd.druckArt = "";
    if (art === "halten" && hd.ding !== null) werfen(h, state.tick - hd.druckTick, hd.druckTick);
    else if (art === "vorgriff") hd.losAusstehend = true;
    return art !== "gesperrt";
  }

  // Ein Ding kommt in Hand d.hand an: gefangen – oder Zusammenstoss.
  function ankommen(d, T) {
    const h = d.hand;
    const hd = state.haende[h];
    if (hd.ding !== null) {
      fehler("stoss", h, d);
      return;
    }
    const vomClown = d.von === -1;
    // Nur fürs Bild: Ein Ball liegt so in der Hand, wie er gedreht ankam.
    if (ART[d.art].r && d.art !== "keule" && d.art !== "fackel") d.dreh0 = (d.dreh0 || 0) + d.spin * (d.landTick - d.wurfTick) * TAKT;
    d.ort = "hand";
    d.fangTick = T;
    d.faenge += 1;
    hd.ding = d.id;
    state.punkte += 1;
    if (vomClown) state.zugabe = null;
    state.meisteDinge = Math.max(state.meisteDinge, anzahlDinge());
    fangBild(d, h, vomClown);
    if (d.art === "apfel" && d.faenge >= APFEL_FAENGE) {
      // Gegessen: Die Hand ist sofort wieder frei.
      d.ort = "weg";
      hd.ding = null;
      hd.losAusstehend = false;
      if (hd.gedrueckt && hd.druckArt === "vorgriff") hd.druckArt = "leer";
      apfelBild(h);
      return;
    }
    if (hd.losAusstehend) {
      hd.losAusstehend = false;
      werfen(h, 0, T);
    } else if (hd.gedrueckt && hd.druckArt === "vorgriff") {
      hd.druckArt = "halten";
    }
  }

  // Die Runde ist vorbei: art "stoss" (zwei in einer Hand), "heiss" (die
  // Fackel), "lange" (zu lange gehalten).
  function fehler(art, h, d) {
    if (state.fehler) return;
    state.fehler = { art, hand: h, id: d ? d.id : -1, tick: state.tick };
    if (state.phase === "spiel") {
      state.phase = "ende";
      meldeZug(ZUG_ENDE);
      clearStep();
      stepTimer = window.setTimeout(finish, ENDE_MS);
    }
    fehlerBild(art, h, d);
  }

  // Der Clown: Trommelwirbel, zielen, warten bis zum Takt, werfen.
  function starteZugabe(T) {
    planBis(state.zugaben + 1);
    const e = state.plan[state.zugaben];
    state.zugaben += 1;
    const d = neuesDing(e.art, e.farbe);
    d.ort = "clown";
    d.von = -1;
    state.zugabe = { phase: "trommel", beginn: T, id: d.id, seite: e.seite, nr: state.zugaben, wurfTick: 0, landTick: 0, hand: 0 };
    trommelBild(e);
  }

  /*
   * Wohin der Clown wirft: in die Mitte der grössten Lücke, die der Takt in
   * einer Hand lässt – die Ankünfte aller Dinge (als käme ab jetzt jeder Wurf
   * perfekt) auf eine Runde von P gelegt. Frühestens nach CLOWN_FLUG; bis
   * dahin wartet er und wiegt sich im Takt.
   */
  function zielen(z, T) {
    const FT = flugTicks(state.punkte);
    const C = FT + D_IDEAL;
    const P = 2 * C;
    const basis = T + CLOWN_FLUG;
    let best = null;
    for (const h of [0, 1]) {
      const rel = [];
      for (const d of state.dinge) {
        if (d.id === z.id || !aktiv(d)) continue;
        const a = ankunft(d);
        if (!a) continue;
        rel.push(mod((a.hand === h ? a.tick : a.tick + C) - basis, P));
      }
      rel.sort((x, y) => x - y);
      if (!rel.length) {
        best = best || { luecke: P, mitte: 0, hand: z.seite < 0 ? 1 : 0 };
        continue;
      }
      for (let i = 0; i < rel.length; i += 1) {
        const von = rel[i];
        const bis = i + 1 < rel.length ? rel[i + 1] : rel[0] + P;
        const luecke = bis - von;
        const mitte = mod(von + luecke / 2, P);
        if (!best || luecke > best.luecke + 1 || (Math.abs(luecke - best.luecke) <= 1 && mitte < best.mitte)) {
          best = { luecke, mitte, hand: h };
        }
      }
    }
    z.hand = best.hand;
    z.landTick = basis + Math.round(best.mitte);
    z.wurfTick = z.landTick - CLOWN_FLUG;
  }

  function zugabeSchritt(T) {
    const z = state.zugabe;
    if (!z) {
      if (state.punkte >= state.zugabeAb) {
        state.zugabeAb += ZUGABE_JE;
        if (anzahlDinge() < DINGE_MAX) starteZugabe(T);
      }
      return;
    }
    if (z.phase === "trommel" && T >= z.beginn + TROMMEL) {
      zielen(z, T);
      z.phase = "warten";
    }
    if (z.phase === "warten" && T >= z.wurfTick) {
      z.phase = "flug";
      const d = dingVon(z.id);
      d.ort = "flug";
      d.hand = z.hand;
      d.wurfTick = T;
      d.landTick = z.landTick;
      d.perfekt = false;
      d.hoch = false;
      clownWurfBild(d, z);
    }
  }

  // Ein Schritt der Rechnung.
  function simSchritt() {
    if (state.fehler) return;
    state.tick += 1;
    const T = state.tick;
    // Was jetzt landet, der Reihe nach.
    const landend = state.dinge.filter((d) => d.ort === "flug" && d.landTick <= T)
      .sort((a, b) => a.landTick - b.landTick || a.id - b.id);
    for (const d of landend) {
      ankommen(d, T);
      if (state.fehler) return;
    }
    // Zu lange gehalten?
    for (const h of [0, 1]) {
      const d = dingVon(state.haende[h].ding);
      if (!d) continue;
      const grenze = d.art === "fackel" ? FACKEL_MAX : HALTEN_MAX;
      if (T - d.fangTick > grenze) {
        fehler(d.art === "fackel" ? "heiss" : "lange", h, d);
        return;
      }
    }
    zugabeSchritt(T);
  }

  // Alles auf Anfang – derselbe Plan bleibt.
  function simZuruecksetzen() {
    state.tick = 0;
    state.uhrRest = 0;
    state.punkte = 0;
    state.serie = 0;
    state.besteSerie = 0;
    state.perfekte = 0;
    state.meisteDinge = START_DINGE;
    state.dinge = [];
    state.haende = [neueHand(), neueHand()];
    state.naechsteId = 0;
    state.zugaben = 0;
    state.zugabeAb = ZUGABE_JE;
    state.zugabe = null;
    state.fehler = null;
    state.zugNr = 0;
    state.zugVerlauf = [];
    for (let h = 0; h < START_DINGE; h += 1) {
      const d = neuesDing("ball", h);
      d.ort = "hand";
      d.hand = h;
      d.start = true;
      d.fangTick = 0;
      state.haende[h].ding = d.id;
    }
  }

  // ---------------------------------------------------------------------------
  // Was die Rechnung im Bild auslöst
  // ---------------------------------------------------------------------------
  const zeigen = () => !state.stumm;
  const zuschauend = () => state.phase === "zuschauen";
  const klang = (fn) => { if (zeigen() && !zuschauend()) fn(kids()); };
  const brumm = (muster) => { if (zeigen() && !zuschauend()) kids()?.vibrate?.(muster); };
  const jetzt = () => state.tick * TAKT;

  // Der Bogen: von der Hand, die wirft, zur Fangstelle der anderen.
  function wurfBild(d, h, FT) {
    const seite = h === 0 ? -1 : 1;
    const hv = state.bild.haende[h];
    const f = Math.max(TAKT, (d.landTick - d.wurfTick) * TAKT);
    const ruhe = FT * TAKT;
    d.x0 = zeigen() ? hv.x : seite * WURF_X;
    d.y0 = (zeigen() ? hv.y : HAND_Y) + auflage(d.art);
    d.x1 = -seite * FANG_X;
    d.y1 = HAND_Y + auflage(d.art);
    d.bogen = H_NORM * (f / ruhe) ** 2 * ART[d.art].hoehe;
    // Bälle drehen sich, Keule und Fackel schlagen ganze Runden: gefangen
    // stehen sie wieder aufrecht.
    d.dreh0 = d.art === "keule" || d.art === "fackel" ? 0 : (d.dreh0 || 0);
    d.drehungen = d.hoch ? 2 : 1;
    d.spin = -seite * (5 + (d.hoch ? 4 : 0));
    if (!zeigen()) return;
    hv.wurf = jetzt();
    hv.vy += d.hoch ? 220 : 150;
    hv.laden = 0;
    state.bild.leanZiel = -seite * 2.5;
    if (d.perfekt) {
      if (state.serie >= 2) funken(d.x0, d.y0, 6, ["#fff4c2", "#ffd23f"], 90);
      if (state.serie > 0 && state.serie % 10 === 0) serieFest();
      else if (state.serie > 0 && state.serie % 5 === 0) klang((k) => k?.playJingle?.("correct"));
    }
    if (d.hoch) welle(d.x0, d.y0, "hoch");
  }

  function druckBild(h) {
    if (!zeigen()) return;
    state.bild.haende[h].druck = jetzt();
  }

  function luftgriffBild(h, hatte) {
    if (!zeigen()) return;
    const hv = state.bild.haende[h];
    welle(hv.x, hv.y + 4, "luft");
    hv.vy -= 60;
    schrift("Luftgriff", hv.x, hv.y + 34, "#e8eef5", 12, 0.6);
    if (hatte >= 3) schrift("Serie vorbei", 0, 228, "#e8eef5", 13, 0.8);
  }

  function fangBild(d, h, vomClown) {
    if (!zeigen()) return;
    const hv = state.bild.haende[h];
    const seite = h === 0 ? -1 : 1;
    hv.fang = jetzt();
    hv.vy -= d.art === "kugel" ? 170 : 95;
    d.quetsch = 1;
    state.bild.bobV -= d.art === "kugel" ? 34 : 18;
    state.bild.leanZiel = seite * 2.5;
    welle(d.x1, d.y1 - 2, "fang");
    klang((k) => k?.playStarSound?.(h));
    brumm(d.art === "kugel" ? 14 : 6);
    if (d.art === "fackel") funken(d.x1, d.y1 + 16, 6, ["#ffd36b", "#ff8a2a", "#ffefb0"], 110);
    if (d.art === "apfel" && d.faenge > 1 && d.faenge < APFEL_FAENGE) {
      krumen(d.x1, d.y1 + 8);
      state.bild.kauenBis = state.echt + 0.6;
    }
    if (vomClown) {
      schrift(`${anzahlDinge()} Dinge!`, 0, 214, "#ffffff", 21, 1.3);
      state.bild.jubelBis = state.echt + 1.3;
      state.jubel = Math.max(state.jubel, 1);
      funken(d.x1, d.y1, 16, ["#ffffff", "#9ff2f8", "#ffd23f"], 170);
      klang((k) => k?.playJingle?.("unlock"));
    }
    if (state.punkte % 50 === 0) {
      schrift(`${state.punkte} Fänge!`, 0, 236, "#ffffff", 22, 1.4);
      state.jubel = Math.max(state.jubel, 0.8);
    }
    if (state.punkte > 0) setzeZahl();
  }

  function apfelBild(h) {
    if (!zeigen()) return;
    const hv = state.bild.haende[h];
    krumen(hv.x, hv.y + 10);
    krumen(0, 140);
    state.bild.kauenBis = state.echt + 1.4;
    state.bild.jubelBis = state.echt + 1.4;
    schrift("Mmh, gegessen!", 0, 214, "#ffe68f", 17, 1.2);
  }

  // Alle zehn perfekten Würfe Konfetti, alle 25 auch eine Schrift.
  function serieFest() {
    if (state.serie % 25 === 0) schrift(`Perfekt ×${state.serie}`, 0, 262, "#ffd23f", 22, 1.3);
    konfetti(ruhig() ? 14 : 50);
    state.jubel = Math.max(state.jubel, 1);
    state.bild.jubelBis = state.echt + 1.4;
    klang((k) => k?.playJingle?.("unlock"));
    brumm([10, 30, 10]);
  }

  function trommelBild(e) {
    if (!zeigen()) return;
    const [titel, satz] = ANSAGE[e.art];
    state.ansage = { titel, satz, art: e.art, t: state.echt, nr: state.zugaben + START_DINGE };
    const B = state.bild;
    // Steht er noch auf derselben Seite, läuft er gleich wieder herein.
    if (!B.clownSichtbar || B.clownSeite !== e.seite) B.clownX = e.seite * (view.w / 2 + 50);
    B.clownSeite = e.seite;
    B.clownSichtbar = true;
    B.clownWurf = -9;
    B.schreckBis = state.echt + 0.5;
  }

  function clownWurfBild(d, z) {
    const seite = z.seite;
    d.x0 = seite * (clownStand() - 14);
    d.y0 = 168 + auflage(d.art);
    d.x1 = (z.hand === 0 ? -1 : 1) * FANG_X;
    d.y1 = HAND_Y + auflage(d.art);
    d.bogen = 95 + Math.abs(d.x1 - d.x0) * 0.2;
    d.dreh0 = 0;
    d.drehungen = 1;
    d.spin = -seite * 6;
    if (!zeigen()) return;
    state.bild.clownWurf = state.echt;
    schrift("Hepp!", d.x0, d.y0 + 40, "#ffffff", 15, 0.7);
  }

  function fehlerBild(art, h, d) {
    if (!zeigen()) return;
    const t = jetzt();
    state.stoss = 1;
    state.glanz = 0;
    if (!ruhig()) state.lupe = 1;
    state.bild.schreckBis = state.echt + 9;
    state.ansage = null;
    const texte = { stoss: zuschauend() ? "Zusammenstoss!" : "Zusammenstoss!", heiss: "Autsch, heiss!", lange: "Zu lange gehalten!" };
    schrift(texte[art], 0, 250, "#ff9a7a", 24, 2.2);
    // Alles fällt: was fliegt, fliegt weiter und fällt dann hinunter, was in
    // den Händen liegt, rutscht heraus – und der Stoss schleudert.
    const hv = state.bild.haende[h];
    for (const x of state.dinge) {
      if (!aktiv(x) || x.ort === "clown") continue;
      let px; let py; let vx; let vy;
      if (x.ort === "flug") {
        const o = bahnOrt(x, t);
        px = o.x; py = o.y; vx = o.vx; vy = o.vy;
      } else {
        const hx = state.bild.haende[x.hand];
        px = hx.x; py = hx.y + auflage(x.art); vx = (x.hand === 0 ? -1 : 1) * 30; vy = 40;
      }
      if (x === d && art === "stoss") {
        // Der ankommende prallt am gehaltenen ab, nach aussen und hoch.
        const seite = h === 0 ? -1 : 1;
        vx = seite * (120 + Math.random() * 60);
        vy = 260;
        px = hv.x;
        py = hv.y + auflage(x.art) * 2;
      } else if (x.ort === "hand" && x.hand === h) {
        vx = (h === 0 ? 1 : -1) * 50;
        vy = 150;
      }
      state.faelle.push({
        art: x.art, farbe: x.farbe, faenge: x.faenge, x: px, y: py, vx, vy,
        dreh: x.dreh0 || 0, w: (Math.random() - 0.5) * 14, tief: -18 + Math.random() * 36, ruhe: false,
      });
      x.ort = "boden";
    }
    funken(hv.x, hv.y + 12, 18, ["#ffffff", "#ffb3a8", "#ffd23f"], 220);
    welle(hv.x, hv.y + 10, "stoss");
    klang((k) => k?.playJingle?.("retry"));
    brumm([30, 40, 60]);
  }

  // ---------------------------------------------------------------------------
  // Die Züge: aufzeichnen, melden, nachbauen
  // ---------------------------------------------------------------------------
  /*
   * Ein Zug (geist.js, zuege; live-spiel.js, zug) – sofort, bei jedem
   * Drücken und Loslassen:
   *
   *   a   der Schritt, in dem es geschah
   *   c   die laufende Nummer × 8 + was: 0 Start, 1/2 Druck links/rechts,
   *       3/4 Loslassen links/rechts, 5 das Ende
   *   b   im Multiplayer die bis zu sechs Züge davor, wenn sie höchstens 15
   *       Schritte zurückliegen: je 1 + was + 8 × wie viele Schritte davor,
   *       in Stellen zu 256. Dort werden Züge, die innert 40 ms kommen, zu
   *       einem (live-spiel.js, zug) – so ist keiner verloren. In der
   *       Aufzeichnung für die Hall of Fame fehlt keiner; dort ist b null.
   *   p   die Fänge bis dahin
   */
  function meldeZug(was) {
    if (state.phase === "zuschauen" || state.stumm) return;
    const T = state.tick;
    let b = 0;
    let stelle = 1;
    for (let i = 1; i <= ZUG_VORHER; i += 1) {
      const e = state.zugVerlauf[state.zugVerlauf.length - i];
      if (!e || T - e.tick > 15) break;
      b += (1 + e.was + 8 * (T - e.tick)) * stelle;
      stelle *= 256;
    }
    const ort = { a: T, b, c: state.zugNr * 8 + was };
    zugProtokoll.push({ t: Math.round(T / 0.24), ...ort, p: state.punkte });
    state.zugVerlauf.push({ tick: T, was });
    if (state.zugVerlauf.length > ZUG_VORHER) state.zugVerlauf.shift();
    state.zugNr += 1;
    aufnahme?.zug(state.punkte, { ...ort, b: 0 });
    const live = window.LernappLiveSpiel;
    if (shell?.live && live?.zug && live.gestartet?.()) live.zug(state.punkte, ort);
  }

  // Für die Prüfskripte: die Züge der laufenden Runde, wie sie hinausgingen.
  let zugProtokoll = [];

  // Eine Eingabe im Spiel: rechnen und melden.
  function eingabe(h, runter) {
    const zaehlt = runter ? druck(h) : los(h);
    if (zaehlt) meldeZug(runter ? ZUG_DRUCK + h : ZUG_LOS + h);
  }

  // Ein Zug des anderen: Drücken oder Loslassen, im selben Schritt.
  function zugAnwenden(e) {
    const was = e.was;
    if (was === ZUG_DRUCK || was === ZUG_DRUCK + 1) druck(was - ZUG_DRUCK);
    else if (was === ZUG_LOS || was === ZUG_LOS + 1) los(was - ZUG_LOS);
  }

  // Ein angekommener Zug, und die, die ihm im Multiplayer verloren gingen
  // (aus b, falls sie dicht davor lagen).
  let zugErwartet = 0;
  function zugAuspacken(z) {
    const nr = Math.floor(z.c / 8);
    const was = mod(z.c, 8);
    const raus = [];
    if (nr > zugErwartet) {
      const fehlen = nr - zugErwartet;
      const vorher = [];
      let rest = Math.max(0, Math.round(z.b || 0));
      for (let i = 1; i <= ZUG_VORHER && rest > 0; i += 1) {
        const code = rest % 256;
        rest = Math.floor(rest / 256);
        if (!code) break;
        vorher.push({ was: (code - 1) % 8, a: z.a - Math.floor((code - 1) / 8) });
      }
      for (let i = Math.min(fehlen, vorher.length); i >= 1; i -= 1) {
        const v = vorher[i - 1];
        raus.push({ nr: nr - i, was: v.was, a: v.a, t: z.t });
      }
    }
    if (nr >= zugErwartet) {
      raus.push({ nr, was, a: z.a, t: z.t, p: z.p });
      zugErwartet = nr + 1;
    }
    return raus;
  }

  // Die Züge, die in diesem Schritt dran sind.
  function zuegeAnwenden() {
    while (zugNaechster < zugListe.length && zugListe[zugNaechster].a <= state.tick) {
      zugAnwenden(zugListe[zugNaechster]);
      zugNaechster += 1;
    }
  }

  // Kam ein Zug zu spät (sein Schritt ist hier schon vorbei), baut die Runde
  // sich still von vorn bis hierher neu – mit allen Zügen, die es gibt.
  function neuAufbauen() {
    const bis = state.tick;
    state.stumm = true;
    simZuruecksetzen();
    zugNaechster = 0;
    while (state.tick < bis && !state.fehler) {
      zuegeAnwenden();
      simSchritt();
    }
    state.stumm = false;
  }

  /*
   * Jedes Bild beim Zuschauen: die Züge, die inzwischen da sind (beim
   * Anschauen aus der Hall of Fame alle, im Multiplayer, was angekommen
   * ist), und so viele Schritte, wie der andere zu dieser Zeit gespielt hatte
   * – geschätzt vom letzten Zug aus, der schon vorbei ist.
   */
  function zuschauenTakt() {
    if (!zuschauer?.seit) return;
    const jetztMs = zuschauer.jetzt();
    let spaet = false;
    for (const z of zuschauer.seit(gesehenBis, Infinity)) {
      gesehenBis = z.t;
      for (const e of zugAuspacken(z)) {
        zugListe.push(e);
        if (e.a < state.tick) spaet = true;
      }
    }
    if (spaet) {
      zugListe.sort((x, y) => x.nr - y.nr);
      neuAufbauen();
    }
    while (zugAnker + 1 < zugListe.length && zugListe[zugAnker + 1].t <= jetztMs) zugAnker += 1;
    const anker = zugListe[zugAnker];
    const verzug = zuschauer.live ? 60 : 4;
    const ziel = Math.floor(anker ? anker.a + (jetztMs - anker.t) * 0.24 : jetztMs * 0.24) - verzug;
    for (let n = 0; n < 2400 && state.tick < ziel && !state.fehler; n += 1) {
      zuegeAnwenden();
      simSchritt();
    }
    if (!state.fehler) zuegeAnwenden();
    setzeZahl();
    // Eine Runde aus der Hall of Fame: am Schluss die Tafel.
    zuschauer.weiter?.();
  }

  // Ab jetzt die Runde des anderen: von vorn, mit derselben Welt (dieselbe
  // Saat), und dann Zug um Zug, wie er gespielt hat.
  function zuschauenStarten() {
    if (!zuschauer?.lauf || !zuschauer.seit) return;
    startRun();
    state.phase = "zuschauen";
    shell.setPhase("play");
    gesehenBis = -Infinity;
    zugListe = [];
    zugNaechster = 0;
    zugAnker = -1;
    zugErwartet = 0;
    zuschauer.los?.();
    zuschauenTakt();
  }

  // ---------------------------------------------------------------------------
  // Die Fläche
  // ---------------------------------------------------------------------------
  function buildFeld() {
    feld = shell.el("div", "jg-feld");
    canvas = document.createElement("canvas");
    canvas.className = "jg-canvas";
    canvas.setAttribute("aria-hidden", "true");
    feld.append(canvas);
    g = canvas.getContext("2d");
    return feld;
  }

  function messen() {
    if (!canvas || !feld) return;
    const cssW = Math.max(80, feld.clientWidth);
    const cssH = Math.max(80, feld.clientHeight);
    const dpr = clamp(window.devicePixelRatio || 1, 1, 2.5);
    // Auf dem Handy reicht die Leinwand unter die Knöpfe oben (game-shell.js,
    // frei). Gemalt wird dort auch – aber die Manege steht darunter.
    const frei = Math.min(cssH * 0.4, shell?.frei?.(canvas) || 0);
    if (cssW === view.cssW && cssH === view.cssH && dpr === view.dpr && frei === view.frei) return;
    view.cssW = cssW;
    view.cssH = cssH;
    view.dpr = dpr;
    view.frei = frei;
    view.s = Math.min(cssW / SICHT_W, (cssH - frei) / SICHT_H);
    view.w = cssW / view.s;
    view.h = cssH / view.s;
    view.camX = -view.w / 2;
    view.camY = -BODEN_SICHT;
    const pw = Math.round(cssW * dpr);
    const ph = Math.round(cssH * dpr);
    if (canvas.width !== pw) canvas.width = pw;
    if (canvas.height !== ph) canvas.height = ph;
    bilder.schluessel = "";
    sprites.schluessel = "";
  }

  const wackelX = () => (ruhig() ? 0 : Math.cos(state.echt * 53) * 3 * state.stoss);
  const wackelY = () => (ruhig() ? 0 : Math.sin(state.echt * 71) * 4 * state.stoss);
  const bildX = (x) => (x - view.camX) * view.s;
  const bildY = (y) => view.cssH - (y - view.camY) * view.s;

  // Bildpunkte (CSS), ohne und mit Kamerastoss.
  function flachTransform() {
    g.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
  }
  function bildTransform() {
    g.setTransform(view.dpr, 0, 0, view.dpr, wackelX() * view.dpr, wackelY() * view.dpr);
  }
  // Welteinheiten, y nach oben – für Jongleur, Clown und Dinge.
  function weltTransform() {
    const k = view.dpr * view.s;
    g.setTransform(k, 0, 0, -k, view.dpr * (-view.camX * view.s + wackelX()), view.dpr * (view.cssH + view.camY * view.s + wackelY()));
  }

  // ---------------------------------------------------------------------------
  // Die gemalten Bilder im Speicher
  // ---------------------------------------------------------------------------
  /*
   * Das Zelt steht still: Zeltbahnen, Lichterketten (ohne ihr Leuchten),
   * die Ränge mit dem Publikum, die Bande, das Sägemehl und der Kegel des
   * Scheinwerfers liegen in einer Leinwand, genau so gross wie die im Bild –
   * jedes Bild ist ein Kopieren. Die vorderste Reihe Publikum liegt in einer
   * zweiten: Sie steht vor der Manege.
   */
  const bilder = { schluessel: "", hinten: null, vorne: null, kegel: null, lampen: [], sitze: [], vorneReihe: [], glimmen: {}, blitz: null };

  function leinwand(w, h, q) {
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.ceil(w * q));
    c.height = Math.max(1, Math.ceil(h * q));
    const cg = c.getContext("2d");
    cg.scale(q, q);
    return { c, g: cg };
  }

  function bauBilder() {
    const schluessel = `${view.cssW}|${view.cssH}|${view.dpr}|${view.frei}`;
    if (bilder.schluessel === schluessel) return;
    bilder.schluessel = schluessel;
    bilder.lampen = [];
    bilder.sitze = [];
    bilder.vorneReihe = [];
    bilder.hinten = maleHintergrund();
    bilder.vorne = maleVorne();
    bilder.kegel = maleKegel();
    bilder.glimmen = {};
    ["#ffe9a8", "#ff8f7a", "#9ff2f8", "#ffd23f", "#d6b3ff"].forEach((farbe) => { bilder.glimmen[farbe] = maleGlimmen(farbe); });
    bilder.blitz = maleBlitz();
  }

  // Die Zeltbahnen: rot und creme, vom Zeltgipfel über dem Bild fächerförmig
  // hinunter bis zu den Rängen, oben im Dunkeln.
  function maleHintergrund() {
    const W = view.cssW;
    const H = view.cssH;
    const s = view.s;
    const { c, g: cg } = leinwand(W, H, view.dpr);
    const X = bildX;
    const Y = bildY;

    const grund = cg.createLinearGradient(0, 0, 0, H);
    grund.addColorStop(0, "#14060d");
    grund.addColorStop(0.55, "#2a0b16");
    grund.addColorStop(1, "#1a0710");
    cg.fillStyle = grund;
    cg.fillRect(0, 0, W, H);

    const gipfelX = W / 2;
    const gipfelY = Math.min(Y(OBEN + 260), -H * 0.15);
    const rangOben = Y(176);
    const bahnen = 26;
    for (let i = -bahnen; i <= bahnen; i += 1) {
      const w0 = (i / bahnen) * 1.25;
      const w1 = ((i + 1) / bahnen) * 1.25;
      const unten = rangOben + 6;
      const lang = unten - gipfelY;
      const xa = gipfelX + Math.tan(w0) * lang;
      const xb = gipfelX + Math.tan(w1) * lang;
      if (Math.max(xa, xb) < -40 || Math.min(xa, xb) > W + 40) continue;
      const rot = i % 2 === 0;
      const bahn = cg.createLinearGradient(xa, 0, xb, 0);
      if (rot) {
        bahn.addColorStop(0, "#5c0d1d");
        bahn.addColorStop(0.5, "#8a1628");
        bahn.addColorStop(1, "#5a0c1b");
      } else {
        bahn.addColorStop(0, "#7d5a36");
        bahn.addColorStop(0.5, "#c49a5c");
        bahn.addColorStop(1, "#7a5734");
      }
      cg.fillStyle = bahn;
      cg.beginPath();
      cg.moveTo(gipfelX, gipfelY);
      cg.lineTo(xa, unten);
      // Der Stoff hängt zwischen den Masten ein wenig durch.
      cg.quadraticCurveTo((xa + xb) / 2, unten + 10 * s, xb, unten);
      cg.closePath();
      cg.fill();
    }
    // Oben dunkel, unten im Widerschein der Manege.
    const dach = cg.createLinearGradient(0, 0, 0, rangOben);
    dach.addColorStop(0, "rgba(10, 2, 8, 0.92)");
    dach.addColorStop(0.55, "rgba(14, 3, 10, 0.55)");
    dach.addColorStop(1, "rgba(30, 8, 14, 0.18)");
    cg.fillStyle = dach;
    cg.fillRect(0, 0, W, rangOben + 12);

    // Zwei Masten mit Seilen, wo die Breite reicht.
    [-1, 1].forEach((seite) => {
      const mx = X(seite * 232);
      if (mx < -20 || mx > W + 20) return;
      const m = cg.createLinearGradient(mx - 6 * s, 0, mx + 6 * s, 0);
      m.addColorStop(0, "#5a3b16");
      m.addColorStop(0.5, "#d9a441");
      m.addColorStop(1, "#5a3b16");
      cg.fillStyle = m;
      cg.fillRect(mx - 5 * s, 0, 10 * s, rangOben + 4);
      cg.strokeStyle = "rgba(230, 200, 140, 0.25)";
      cg.lineWidth = Math.max(1, 1.2 * s);
      cg.beginPath();
      for (let k = 0; k < 4; k += 1) {
        cg.moveTo(mx, Y(OBEN - 40 - k * 60));
        cg.lineTo(X(seite * (232 - 80 - k * 30)), rangOben);
      }
      cg.stroke();
    });

    // Lichterketten quer durchs Zelt – die Lämpchen glimmen nur hier, ihr
    // Leuchten kommt jedes Bild dazu (zeichneLampen).
    const farben = ["#ffe9a8", "#ff8f7a", "#9ff2f8", "#ffd23f", "#d6b3ff"];
    const ketten = [
      { y0: Math.max(view.frei + 10, Y(OBEN + 120)), durch: 0.16 },
      { y0: Math.max(view.frei + 40, Y(OBEN + 30)), durch: 0.12 },
      { y0: Y(OBEN - 70), durch: 0.07 },
    ];
    ketten.forEach((k, ki) => {
      const durch = H * k.durch;
      const punkt = (u) => ({ x: -0.04 * W + u * W * 1.08, y: k.y0 + durch * 4 * u * (1 - u) });
      cg.strokeStyle = "rgba(20, 10, 14, 0.9)";
      cg.lineWidth = Math.max(1, 1.1 * s);
      cg.beginPath();
      for (let u = 0; u <= 1.0001; u += 0.02) {
        const p = punkt(u);
        if (u === 0) cg.moveTo(p.x, p.y); else cg.lineTo(p.x, p.y);
      }
      cg.stroke();
      const abstand = Math.max(18, 26 * s);
      const anzahl = Math.ceil((W * 1.08) / abstand);
      for (let n = 0; n <= anzahl; n += 1) {
        const p = punkt(n / anzahl);
        const farbe = farben[(n + ki * 2) % farben.length];
        const r = Math.max(1.8, 2.6 * s);
        cg.fillStyle = "#2a1a18";
        cg.fillRect(p.x - r * 0.45, p.y, r * 0.9, r * 0.9);
        cg.fillStyle = farbe;
        cg.globalAlpha = 0.55;
        cg.beginPath();
        cg.arc(p.x, p.y + r * 1.6, r, 0, TAU);
        cg.fill();
        cg.globalAlpha = 1;
        bilder.lampen.push({ x: p.x, y: p.y + r * 1.6, farbe, r, n: n + ki * 100 });
      }
    });

    // Die Ränge: Reihen von Köpfen und Schultern, oben kleiner und dunkler,
    // unten im Licht der Manege.
    const reihen = 5;
    for (let r = reihen - 1; r >= 0; r -= 1) {
      const y = 48 + r * 26;
      const kopf = 7.2 - r * 0.7;
      const hell = 1 - r / reihen;
      const stufe = cg.createLinearGradient(0, Y(y + 22), 0, Y(y - 6));
      stufe.addColorStop(0, `rgb(${Math.round(30 + 22 * hell)}, ${Math.round(10 + 8 * hell)}, ${Math.round(24 + 16 * hell)})`);
      stufe.addColorStop(1, `rgb(${Math.round(18 + 14 * hell)}, ${Math.round(6 + 4 * hell)}, ${Math.round(16 + 10 * hell)})`);
      cg.fillStyle = stufe;
      cg.fillRect(0, Y(y + 22), W, (28) * s);
      const abst = 15 - r * 0.8;
      const von = Math.floor(-view.w / 2 / abst) - 1;
      const bis = Math.ceil(view.w / 2 / abst) + 1;
      for (let n = von; n <= bis; n += 1) {
        const h = (k) => hash01(n * 7.31 + r * 113.7 + k * 3.17);
        const x = n * abst + (h(1) - 0.5) * abst * 0.5;
        const kopfY = y + 8 + h(2) * 4;
        const ton = 0.35 + 0.65 * hell;
        const farbe = `rgb(${Math.round((40 + h(3) * 40) * ton)}, ${Math.round((22 + h(4) * 22) * ton)}, ${Math.round((48 + h(5) * 46) * ton)})`;
        cg.fillStyle = farbe;
        cg.beginPath();
        cg.ellipse(X(x), Y(kopfY - kopf * 1.5), kopf * 1.35 * s, kopf * 0.9 * s, 0, Math.PI, TAU);
        cg.fill();
        cg.beginPath();
        cg.arc(X(x), Y(kopfY), kopf * s, 0, TAU);
        cg.fill();
        // Ein Hauch Licht von unten auf den Gesichtern der vorderen Reihen.
        if (r < 2) {
          cg.fillStyle = `rgba(255, 200, 150, ${0.08 + 0.08 * hell})`;
          cg.beginPath();
          cg.arc(X(x), Y(kopfY - kopf * 0.25), kopf * 0.75 * s, 0, Math.PI);
          cg.fill();
        }
        bilder.sitze.push({ x: X(x), y: Y(kopfY + kopf * 0.2), r: kopf * s });
      }
    }

    // Die Bande zwischen Rängen und Manege: dunkelrot mit goldenem Handlauf.
    cg.fillStyle = "#4a0d18";
    cg.fillRect(0, Y(44), W, 12 * s);
    cg.fillStyle = "#e0b04a";
    cg.fillRect(0, Y(44), W, Math.max(1.5, 2.2 * s));
    cg.fillStyle = "rgba(0, 0, 0, 0.35)";
    cg.fillRect(0, Y(33), W, 3 * s);

    // Die Manege: Sägemehl in einer Ellipse, in der Mitte heller.
    const mx = X(0);
    const my = Y(4);
    const rx = 268 * s;
    const ry = 50 * s;
    cg.fillStyle = "#2a1408";
    cg.fillRect(0, Y(34), W, H - Y(34));
    const mehl = cg.createRadialGradient(mx, my, 10 * s, mx, my, rx);
    mehl.addColorStop(0, "#e9bf7f");
    mehl.addColorStop(0.45, "#c98f4e");
    mehl.addColorStop(1, "#6d3f1c");
    cg.save();
    cg.translate(mx, my);
    cg.scale(1, ry / rx);
    cg.fillStyle = mehl;
    cg.beginPath();
    cg.arc(0, 0, rx, 0, TAU);
    cg.fill();
    cg.restore();
    // Körnchen im Sägemehl.
    for (let n = 0; n < 420; n += 1) {
      const w = hash01(n * 2.13) * TAU;
      const rr = Math.sqrt(hash01(n * 5.71 + 1));
      const px = mx + Math.cos(w) * rx * rr * 0.98;
      const py = my + Math.sin(w) * ry * rr * 0.98;
      cg.fillStyle = hash01(n * 9.3) < 0.5 ? "rgba(255, 236, 190, 0.35)" : "rgba(90, 50, 20, 0.3)";
      cg.fillRect(px, py, Math.max(1, 1.3 * s), Math.max(1, 0.9 * s));
    }
    // Die ausgetretene Spur der Pferde, rundherum.
    cg.strokeStyle = "rgba(80, 40, 15, 0.25)";
    cg.lineWidth = 9 * s;
    cg.beginPath();
    cg.ellipse(mx, my, rx * 0.8, ry * 0.8, 0, 0, TAU);
    cg.stroke();

    // Der Manegenrand: oben rot mit Goldkante, vorne ein Band mit Sternen.
    cg.lineWidth = 7 * s;
    cg.strokeStyle = "#b51d2e";
    cg.beginPath();
    cg.ellipse(mx, my, rx + 4 * s, ry + 3 * s, 0, 0, TAU);
    cg.stroke();
    cg.lineWidth = Math.max(1, 1.6 * s);
    cg.strokeStyle = "#f0c254";
    cg.beginPath();
    cg.ellipse(mx, my, rx + 7.5 * s, ry + 6 * s, 0, 0, TAU);
    cg.stroke();
    const bandOben = my + ry + 6 * s;
    const band = cg.createLinearGradient(0, bandOben, 0, bandOben + 15 * s);
    band.addColorStop(0, "#c62436");
    band.addColorStop(1, "#6e0c19");
    cg.fillStyle = band;
    cg.beginPath();
    cg.ellipse(mx, my, rx + 7.5 * s, ry + 6 * s, 0, 0, Math.PI);
    cg.lineTo(mx - rx - 7.5 * s, my + 15 * s);
    cg.ellipse(mx, my + 15 * s, rx + 7.5 * s, ry + 6 * s, 0, Math.PI, 0, true);
    cg.closePath();
    cg.fill();
    cg.fillStyle = "#f0c254";
    for (let n = -9; n <= 9; n += 1) {
      const w = Math.PI / 2 - n * 0.16;
      const sx = mx + Math.cos(w) * (rx + 7.5 * s);
      const sy = my + Math.sin(w) * (ry + 6 * s) + 7.5 * s;
      stern(cg, sx, sy, 3.2 * s * (1 - Math.abs(n) * 0.03));
    }

    // Der Scheinwerfer: ein Kegel von oben auf den Jongleur und ein heller
    // Fleck im Sägemehl.
    cg.globalCompositeOperation = "lighter";
    const fleck = cg.createRadialGradient(mx, my, 4 * s, mx, my, 130 * s);
    fleck.addColorStop(0, "rgba(255, 240, 200, 0.42)");
    fleck.addColorStop(0.6, "rgba(255, 220, 160, 0.14)");
    fleck.addColorStop(1, "rgba(255, 220, 160, 0)");
    cg.save();
    cg.translate(mx, my);
    cg.scale(1, 0.32);
    cg.fillStyle = fleck;
    cg.beginPath();
    cg.arc(0, 0, 130 * s, 0, TAU);
    cg.fill();
    cg.restore();
    const kegelOben = Math.min(0, Y(OBEN + 200));
    [[0.07, 104], [0.06, 86], [0.07, 66]].forEach(([alpha, breit]) => {
      const k = cg.createLinearGradient(0, kegelOben, 0, my);
      k.addColorStop(0, `rgba(255, 245, 215, ${alpha * 1.6})`);
      k.addColorStop(1, `rgba(255, 235, 190, ${alpha * 0.5})`);
      cg.fillStyle = k;
      cg.beginPath();
      cg.moveTo(mx - 10 * s, kegelOben);
      cg.lineTo(mx + 10 * s, kegelOben);
      cg.lineTo(mx + breit * s, my);
      cg.lineTo(mx - breit * s, my);
      cg.closePath();
      cg.fill();
    });
    cg.globalCompositeOperation = "source-over";
    return c;
  }

  function stern(cg, x, y, r) {
    cg.beginPath();
    for (let k = 0; k < 10; k += 1) {
      const w = -Math.PI / 2 + (k * Math.PI) / 5;
      const rr = k % 2 ? r * 0.45 : r;
      if (k) cg.lineTo(x + Math.cos(w) * rr, y + Math.sin(w) * rr);
      else cg.moveTo(x + Math.cos(w) * rr, y + Math.sin(w) * rr);
    }
    cg.closePath();
    cg.fill();
  }

  // Die vorderste Reihe Publikum: Schattenrisse vor der Manege, oben im
  // Gegenlicht.
  function maleVorne() {
    const W = view.cssW;
    const s = view.s;
    const oben = Math.floor(bildY(-26));
    const H = Math.max(4, view.cssH - oben);
    const { c, g: cg } = leinwand(W, H, view.dpr);
    const abst = 26;
    const von = Math.floor(-view.w / 2 / abst) - 1;
    const bis = Math.ceil(view.w / 2 / abst) + 1;
    for (let n = von; n <= bis; n += 1) {
      const h = (k) => hash01(n * 4.77 + k * 9.13 + 50);
      const x = bildX(n * abst + (h(1) - 0.5) * 10);
      const kopfY = bildY(-46 - h(2) * 8) - oben;
      const r = (10 + h(3) * 3) * s;
      cg.fillStyle = "#07040a";
      cg.beginPath();
      cg.ellipse(x, kopfY + r * 2.2, r * 2, r * 1.5, 0, Math.PI, TAU);
      cg.fill();
      cg.fillRect(x - r * 2, kopfY + r * 2.2, r * 4, H);
      cg.beginPath();
      cg.arc(x, kopfY, r, 0, TAU);
      cg.fill();
      // Haare oder Mütze, damit nicht alle gleich aussehen.
      if (h(4) < 0.3) {
        cg.beginPath();
        cg.ellipse(x, kopfY - r * 0.55, r * 1.05, r * 0.6, 0, Math.PI, TAU);
        cg.fill();
      } else if (h(4) < 0.45) {
        cg.beginPath();
        cg.arc(x + r * 0.6, kopfY - r * 0.5, r * 0.55, 0, TAU);
        cg.arc(x - r * 0.6, kopfY - r * 0.5, r * 0.55, 0, TAU);
        cg.fill();
      }
      // Gegenlicht am Rand.
      cg.strokeStyle = "rgba(255, 190, 130, 0.28)";
      cg.lineWidth = Math.max(1, 1.2 * s);
      cg.beginPath();
      cg.arc(x, kopfY, r, Math.PI * 1.15, Math.PI * 1.85);
      cg.stroke();
      bilder.vorneReihe.push({ x, y: kopfY + oben, r, n });
    }
    return { c, oben };
  }

  // Der Kegel des zweiten Scheinwerfers – für den Clown.
  function maleKegel() {
    const s = view.s;
    const breit = 70 * s;
    const hoch = Math.max(40, bildY(0) + 10);
    const { c, g: cg } = leinwand(breit * 2 + 4, hoch, view.dpr);
    const k = cg.createLinearGradient(0, 0, 0, hoch);
    k.addColorStop(0, "rgba(255, 240, 200, 0.2)");
    k.addColorStop(1, "rgba(255, 230, 180, 0.08)");
    cg.fillStyle = k;
    cg.beginPath();
    cg.moveTo(breit - 6 * s, 0);
    cg.lineTo(breit + 6 * s, 0);
    cg.lineTo(breit * 2, hoch);
    cg.lineTo(0, hoch);
    cg.closePath();
    cg.fill();
    return { c, breit, hoch };
  }

  function maleGlimmen(farbe) {
    const r = Math.max(6, 11 * view.s);
    const { c, g: cg } = leinwand(r * 2, r * 2, view.dpr);
    const v = cg.createRadialGradient(r, r, 0, r, r, r);
    v.addColorStop(0, "rgba(255, 255, 255, 0.95)");
    v.addColorStop(0.18, farbe);
    v.addColorStop(1, "rgba(0, 0, 0, 0)");
    cg.fillStyle = v;
    cg.fillRect(0, 0, r * 2, r * 2);
    return { c, r };
  }

  // Ein Kamerablitz: ein heller Stern mit Hof.
  function maleBlitz() {
    const r = Math.max(10, 20 * view.s);
    const { c, g: cg } = leinwand(r * 2, r * 2, view.dpr);
    const v = cg.createRadialGradient(r, r, 0, r, r, r);
    v.addColorStop(0, "rgba(255, 255, 255, 1)");
    v.addColorStop(0.15, "rgba(230, 240, 255, 0.8)");
    v.addColorStop(1, "rgba(200, 220, 255, 0)");
    cg.fillStyle = v;
    cg.fillRect(0, 0, r * 2, r * 2);
    cg.strokeStyle = "rgba(255, 255, 255, 0.8)";
    cg.lineWidth = Math.max(1, r * 0.06);
    cg.beginPath();
    cg.moveTo(r, r * 0.15);
    cg.lineTo(r, r * 1.85);
    cg.moveTo(r * 0.15, r);
    cg.lineTo(r * 1.85, r);
    cg.stroke();
    return { c, r };
  }

  // Die Dinge: einmal je Grösse gemalt, mit Muster (dreht sich mit) und Licht
  // (dreht sich nicht).
  const sprites = { schluessel: "", bilder: new Map(), licht: new Map() };

  function sprite(art, farbe, biss = 0) {
    const schluessel = `${view.s}|${view.dpr}`;
    if (sprites.schluessel !== schluessel) {
      sprites.schluessel = schluessel;
      sprites.bilder = new Map();
      sprites.licht = new Map();
    }
    const k = `${art}|${farbe}|${biss}`;
    let b = sprites.bilder.get(k);
    if (!b) {
      b = maleDing(art, farbe, biss);
      sprites.bilder.set(k, b);
    }
    return b;
  }

  function lichtSprite(r) {
    const k = String(r);
    let b = sprites.licht.get(k);
    if (b) return b;
    const R = r * view.s;
    const D = Math.ceil(R * 2 + 4);
    const { c, g: cg } = leinwand(D, D, view.dpr);
    cg.translate(D / 2, D / 2);
    const schatten = cg.createRadialGradient(-R * 0.3, -R * 0.35, R * 0.2, 0, 0, R);
    schatten.addColorStop(0, "rgba(0, 0, 0, 0)");
    schatten.addColorStop(0.7, "rgba(0, 0, 0, 0.08)");
    schatten.addColorStop(1, "rgba(10, 5, 20, 0.5)");
    cg.fillStyle = schatten;
    cg.beginPath();
    cg.arc(0, 0, R, 0, TAU);
    cg.fill();
    const glanz = cg.createRadialGradient(-R * 0.38, -R * 0.42, 0, -R * 0.38, -R * 0.42, R * 0.6);
    glanz.addColorStop(0, "rgba(255, 255, 255, 0.9)");
    glanz.addColorStop(0.35, "rgba(255, 255, 255, 0.35)");
    glanz.addColorStop(1, "rgba(255, 255, 255, 0)");
    cg.fillStyle = glanz;
    cg.beginPath();
    cg.arc(0, 0, R, 0, TAU);
    cg.fill();
    b = { c, D };
    sprites.licht.set(k, b);
    return b;
  }

  function maleDing(art, farbe, biss) {
    const s = view.s;
    const F = FARBEN[farbe] || FARBEN[0];
    if (art === "keule" || art === "fackel") {
      const L = ART[art].lang * s;
      const B = (art === "keule" ? 18 : 16) * s;
      const { c, g: cg } = leinwand(B + 4, L + 4, view.dpr);
      cg.translate(B / 2 + 2, L + 2);
      if (art === "keule") {
        // Griff, Knauf und der bauchige Körper – weiss mit Streifen.
        const koerper = cg.createLinearGradient(-B / 2, 0, B / 2, 0);
        koerper.addColorStop(0, "#d8dce6");
        koerper.addColorStop(0.35, "#ffffff");
        koerper.addColorStop(1, "#aeb4c4");
        cg.fillStyle = koerper;
        cg.beginPath();
        cg.moveTo(-2.2 * s, -2 * s);
        cg.bezierCurveTo(-2.6 * s, -L * 0.4, -B / 2, -L * 0.62, -B / 2 + 0.5 * s, -L * 0.8);
        cg.bezierCurveTo(-B / 2 + 1 * s, -L * 0.98, B / 2 - 1 * s, -L * 0.98, B / 2 - 0.5 * s, -L * 0.8);
        cg.bezierCurveTo(B / 2, -L * 0.62, 2.6 * s, -L * 0.4, 2.2 * s, -2 * s);
        cg.closePath();
        cg.fill();
        cg.save();
        cg.clip();
        cg.fillStyle = F.haupt;
        cg.fillRect(-B, -L * 0.74, B * 2, L * 0.1);
        cg.fillRect(-B, -L * 0.52, B * 2, L * 0.06);
        cg.fillRect(-B, -L * 0.36, B * 2, L * 0.36);
        cg.restore();
        cg.fillStyle = F.dunkel;
        cg.beginPath();
        cg.ellipse(0, -1.5 * s, 3.4 * s, 2.4 * s, 0, 0, TAU);
        cg.fill();
        cg.strokeStyle = "rgba(20, 10, 30, 0.45)";
        cg.lineWidth = Math.max(0.8, 0.8 * s);
        cg.stroke();
      } else {
        // Die Fackel: Holzstiel, Metallband, oben der Docht (die Flamme kommt
        // jedes Bild neu dazu).
        const holz = cg.createLinearGradient(-3 * s, 0, 3 * s, 0);
        holz.addColorStop(0, "#6b3d18");
        holz.addColorStop(0.5, "#b07a3e");
        holz.addColorStop(1, "#5a3010");
        cg.fillStyle = holz;
        cg.beginPath();
        cg.moveTo(-2.4 * s, 0);
        cg.lineTo(-3.4 * s, -L * 0.78);
        cg.lineTo(3.4 * s, -L * 0.78);
        cg.lineTo(2.4 * s, 0);
        cg.closePath();
        cg.fill();
        cg.fillStyle = "#c9ced8";
        cg.fillRect(-3.8 * s, -L * 0.82, 7.6 * s, 4 * s);
        cg.fillRect(-3.2 * s, -L * 0.18, 6.4 * s, 2.2 * s);
        cg.fillStyle = "#2a1a14";
        cg.beginPath();
        cg.ellipse(0, -L * 0.9, 5 * s, 6 * s, 0, 0, TAU);
        cg.fill();
      }
      return { c, w: B + 4, h: L + 4, ax: B / 2 + 2, ay: L + 2 };
    }
    const r = ART[art].r;
    const R = r * s;
    const D = Math.ceil(R * 2 + 4);
    const { c, g: cg } = leinwand(D, D, view.dpr);
    cg.translate(D / 2, D / 2);
    if (art === "kugel") {
      const eisen = cg.createRadialGradient(-R * 0.3, -R * 0.3, R * 0.1, 0, 0, R);
      eisen.addColorStop(0, "#6b7286");
      eisen.addColorStop(0.6, "#33384a");
      eisen.addColorStop(1, "#15171f");
      cg.fillStyle = eisen;
      cg.beginPath();
      cg.arc(0, 0, R, 0, TAU);
      cg.fill();
      cg.strokeStyle = "rgba(200, 210, 230, 0.25)";
      cg.lineWidth = Math.max(0.8, 1.1 * s);
      cg.beginPath();
      cg.ellipse(0, 0, R * 0.98, R * 0.35, 0.3, 0, TAU);
      cg.stroke();
      cg.fillStyle = "rgba(230, 235, 245, 0.75)";
      cg.font = `900 ${Math.max(6, R * 0.55)}px system-ui, sans-serif`;
      cg.textAlign = "center";
      cg.textBaseline = "middle";
      cg.fillText("kg", 0, R * 0.12);
    } else if (art === "apfel") {
      const haut = cg.createRadialGradient(-R * 0.35, -R * 0.3, R * 0.1, 0, 0, R);
      haut.addColorStop(0, "#ff6a6a");
      haut.addColorStop(0.6, "#e01e35");
      haut.addColorStop(1, "#8e0c1f");
      cg.fillStyle = haut;
      cg.beginPath();
      cg.moveTo(0, -R * 0.72);
      cg.bezierCurveTo(R * 0.6, -R * 1.1, R * 1.15, -R * 0.5, R * 0.98, R * 0.15);
      cg.bezierCurveTo(R * 0.85, R * 0.85, R * 0.3, R * 1.05, 0, R * 0.9);
      cg.bezierCurveTo(-R * 0.3, R * 1.05, -R * 0.85, R * 0.85, -R * 0.98, R * 0.15);
      cg.bezierCurveTo(-R * 1.15, -R * 0.5, -R * 0.6, -R * 1.1, 0, -R * 0.72);
      cg.fill();
      // Die Bisse: Stücke weg, darunter hell das Fruchtfleisch.
      for (let n = 0; n < biss; n += 1) {
        const w = -0.2 + n * 1.25;
        const bx = Math.cos(w) * R * 1.02;
        const by = Math.sin(w) * R * 0.95;
        cg.globalCompositeOperation = "destination-out";
        cg.beginPath();
        cg.arc(bx, by, R * 0.42, 0, TAU);
        cg.fill();
        cg.globalCompositeOperation = "source-atop";
        cg.fillStyle = "#fff1cc";
        cg.beginPath();
        cg.arc(bx, by, R * 0.55, 0, TAU);
        cg.fill();
        cg.globalCompositeOperation = "source-over";
      }
      cg.strokeStyle = "#5a3412";
      cg.lineWidth = Math.max(1, 1.6 * s);
      cg.beginPath();
      cg.moveTo(0, -R * 0.68);
      cg.quadraticCurveTo(R * 0.05, -R * 1.05, R * 0.2, -R * 1.18);
      cg.stroke();
      cg.fillStyle = "#3fbf4a";
      cg.beginPath();
      cg.ellipse(R * 0.42, -R * 1.02, R * 0.32, R * 0.15, -0.5, 0, TAU);
      cg.fill();
    } else {
      // Ein Jonglierball: eine Farbe, dazu zwei helle Flächen wie Nähte.
      cg.fillStyle = F.haupt;
      cg.beginPath();
      cg.arc(0, 0, R, 0, TAU);
      cg.fill();
      cg.save();
      cg.clip();
      cg.fillStyle = F.hell;
      cg.beginPath();
      cg.ellipse(-R * 0.15, 0, R * 0.38, R * 1.05, 0, 0, TAU);
      cg.fill();
      cg.fillStyle = F.dunkel;
      cg.globalAlpha = 0.35;
      cg.beginPath();
      cg.ellipse(R * 0.85, 0, R * 0.38, R * 1.05, 0, 0, TAU);
      cg.fill();
      cg.globalAlpha = 1;
      cg.restore();
      cg.strokeStyle = "rgba(30, 10, 30, 0.35)";
      cg.lineWidth = Math.max(0.8, R * 0.07);
      cg.beginPath();
      cg.arc(0, 0, R - cg.lineWidth / 2, 0, TAU);
      cg.stroke();
    }
    return { c, w: D, h: D, ax: D / 2, ay: D / 2, rund: true, R };
  }

  // ---------------------------------------------------------------------------
  // Zeichnen
  // ---------------------------------------------------------------------------
  // Wo ein fliegendes Ding zur Zeit t ist (Sekunden der Runde), und wie
  // schnell es sich bewegt.
  function bahnOrt(d, t) {
    const t0 = d.wurfTick * TAKT;
    const f = Math.max(1e-3, (d.landTick - d.wurfTick) * TAKT);
    const u = clamp((t - t0) / f, 0, 1);
    return {
      x: d.x0 + (d.x1 - d.x0) * u,
      y: d.y0 + (d.y1 - d.y0) * u + 4 * d.bogen * u * (1 - u),
      vx: (d.x1 - d.x0) / f,
      vy: ((d.y1 - d.y0) + 4 * d.bogen * (1 - 2 * u)) / f,
      u,
    };
  }

  // Wie ein Ding gedreht ist: Bälle rollen, Keulen und Fackeln schlagen
  // ganze Runden.
  function drehung(d, t) {
    if (d.ort !== "flug") return d.dreh0 || 0;
    const o = bahnOrt(d, t);
    if (d.art === "keule" || d.art === "fackel") return d.dreh0 + Math.sign(d.spin || 1) * TAU * d.drehungen * o.u;
    return (d.dreh0 || 0) + d.spin * (t - d.wurfTick * TAKT);
  }

  // Ein Ding im Bild, in Welteinheiten (weltTransform ist gesetzt). Keule
  // und Fackel stehen in der Hand auf ihrem Griff; fliegend (mitte) drehen
  // sie sich um ihre Mitte.
  function zeichneDing(art, farbe, faenge, x, y, winkel, sx, sy, alpha = 1, t = state.zeit, mitte = false) {
    const biss = art === "apfel" ? clamp(faenge - 1, 0, APFEL_FAENGE - 2) : 0;
    const b = sprite(art, farbe, biss);
    const k = 1 / view.s;
    g.save();
    g.globalAlpha = alpha;
    g.translate(x, y);
    if (b.rund) {
      g.scale(sx, sy);
      g.save();
      g.rotate(winkel);
      g.scale(k, -k);
      g.drawImage(b.c, -b.ax, -b.ay, b.w, b.h);
      g.restore();
      // Licht und Glanz drehen sich nicht mit: Das Licht kommt von oben.
      if (art !== "apfel") {
        const l = lichtSprite(ART[art].r);
        g.scale(k, -k);
        g.drawImage(l.c, -l.D / 2, -l.D / 2, l.D, l.D);
      }
    } else {
      const L = ART[art].lang;
      g.rotate(winkel);
      g.scale(sx, sy);
      if (mitte) g.translate(0, -L / 2);
      g.save();
      g.scale(k, -k);
      g.drawImage(b.c, -b.ax, -b.ay, b.w, b.h);
      g.restore();
      if (art === "fackel") {
        // Die Flamme: ein paar Zungen, die flackern, im Licht zusammengezählt.
        g.translate(0, L * 0.9);
        g.rotate(-winkel * 0.7);
        flamme(t);
      }
    }
    g.restore();
  }

  function flamme(t) {
    g.globalCompositeOperation = "lighter";
    const zungen = [["rgba(255, 120, 30, 0.75)", 9, 20, 0], ["rgba(255, 190, 60, 0.85)", 6.5, 15, 1.7], ["rgba(255, 245, 200, 0.95)", 3.6, 9, 3.1]];
    zungen.forEach(([farbe, b, h, ph]) => {
      const fl = 1 + Math.sin(t * 23 + ph) * 0.12 + Math.sin(t * 37 + ph * 2) * 0.08;
      g.fillStyle = farbe;
      g.beginPath();
      g.moveTo(-b, 0);
      g.quadraticCurveTo(-b * 0.9, h * 0.6 * fl, Math.sin(t * 11 + ph) * 2, h * fl);
      g.quadraticCurveTo(b * 0.9, h * 0.6 * fl, b, 0);
      g.quadraticCurveTo(0, -b * 0.8, -b, 0);
      g.fill();
    });
    g.globalCompositeOperation = "source-over";
  }

  function zeichneHintergrund() {
    g.setTransform(1, 0, 0, 1, 0, 0);
    const dx = Math.round(wackelX() * view.dpr);
    const dy = Math.round(wackelY() * view.dpr);
    if (dx || dy) {
      g.fillStyle = "#14060d";
      g.fillRect(0, 0, canvas.width, canvas.height);
    }
    g.drawImage(bilder.hinten, dx, dy);
  }

  // Die Lichterketten leuchten: sanftes Flackern, und in einer Serie läuft
  // ein Lauflicht durch.
  function zeichneLampen() {
    bildTransform();
    g.globalCompositeOperation = "lighter";
    const t = state.echt;
    const lauf = clamp((state.serie - 2) / 8, 0, 1);
    for (const l of bilder.lampen) {
      const flacker = 0.55 + 0.25 * Math.sin(t * 2.1 + l.n * 1.7) + 0.2 * Math.sin(t * 5.3 + l.n * 0.9);
      const welle = lauf > 0 ? Math.max(0, Math.cos(t * 7 - l.n * 0.55)) ** 6 * lauf : 0;
      const a = clamp(flacker * 0.4 + welle * 0.9 + state.jubel * 0.3, 0, 1);
      const b = bilder.glimmen[l.farbe];
      if (!b || a < 0.05) continue;
      g.globalAlpha = a;
      const r = b.r * (0.8 + welle * 0.5);
      g.drawImage(b.c, l.x - r, l.y - r, r * 2, r * 2);
    }
    g.globalAlpha = 1;
    g.globalCompositeOperation = "source-over";
  }

  // Oben im Zelt, wo hochkant viel Platz ist: zwei Trapeze, die leise
  // schaukeln.
  function zeichneTrapeze() {
    const unten = bildY(OBEN + 70);
    if (unten < view.frei + 60) return;
    bildTransform();
    const s = view.s;
    [[-1, 0], [1, 1.9]].forEach(([seite, phase]) => {
      const ax = view.cssW / 2 + seite * view.cssW * 0.3;
      const ay = 0;
      const lang = Math.max(40, unten - ay - 30 * s);
      const w = (ruhig() ? 0 : Math.sin(state.echt * 0.9 + phase) * 0.07) + seite * 0.02;
      const breit = 34 * s;
      const bx = ax + Math.sin(w) * lang;
      const by = ay + Math.cos(w) * lang;
      g.strokeStyle = "rgba(200, 170, 120, 0.45)";
      g.lineWidth = Math.max(1, 1.2 * s);
      g.beginPath();
      g.moveTo(ax - breit / 2, ay);
      g.lineTo(bx - (breit / 2) * Math.cos(w), by + (breit / 2) * Math.sin(w));
      g.moveTo(ax + breit / 2, ay);
      g.lineTo(bx + (breit / 2) * Math.cos(w), by - (breit / 2) * Math.sin(w));
      g.stroke();
      g.strokeStyle = "rgba(240, 194, 84, 0.7)";
      g.lineWidth = Math.max(2, 3.4 * s);
      g.lineCap = "round";
      g.beginPath();
      g.moveTo(bx - (breit / 2) * Math.cos(w), by + (breit / 2) * Math.sin(w));
      g.lineTo(bx + (breit / 2) * Math.cos(w), by - (breit / 2) * Math.sin(w));
      g.stroke();
    });
  }

  // Kamerablitze im Publikum – mehr, je besser es läuft.
  function zeichneBlitze() {
    if (!state.blitze.length) return;
    bildTransform();
    g.globalCompositeOperation = "lighter";
    const b = bilder.blitz;
    for (const f of state.blitze) {
      const k = clamp(1 - f.alter / f.max, 0, 1);
      g.globalAlpha = k * k;
      const r = b.r * f.gross * (0.7 + 0.3 * k);
      g.drawImage(b.c, f.x - r, f.y - r, r * 2, r * 2);
    }
    g.globalAlpha = 1;
    g.globalCompositeOperation = "source-over";
  }

  // Der zweite Scheinwerfer folgt dem Clown.
  function zeichneClownLicht() {
    const B = state.bild;
    if (!B.clownSichtbar) return;
    bildTransform();
    const k = bilder.kegel;
    const x = bildX(B.clownX);
    g.globalCompositeOperation = "lighter";
    g.globalAlpha = 0.9;
    g.drawImage(k.c, x - k.breit - 2, bildY(0) + 10 - k.hoch, k.breit * 2 + 4, k.hoch);
    g.save();
    g.translate(x, bildY(2));
    g.scale(1, 0.3);
    const fl = g.createRadialGradient(0, 0, 2, 0, 0, 60 * view.s);
    fl.addColorStop(0, "rgba(255, 240, 200, 0.35)");
    fl.addColorStop(1, "rgba(255, 240, 200, 0)");
    g.fillStyle = fl;
    g.beginPath();
    g.arc(0, 0, 60 * view.s, 0, TAU);
    g.fill();
    g.restore();
    g.globalAlpha = 1;
    g.globalCompositeOperation = "source-over";
  }

  // Schatten am Boden: der Jongleur und jedes Ding, das fliegt.
  function zeichneSchatten(t) {
    weltTransform();
    g.fillStyle = "rgba(40, 15, 5, 0.38)";
    g.beginPath();
    g.ellipse(state.bild.lean * 0.5, 1, 30, 6, 0, 0, TAU);
    g.fill();
    for (const d of state.dinge) {
      if (d.ort !== "flug") continue;
      const o = bahnOrt(d, t);
      const hoch = clamp(o.y / 400, 0, 1);
      g.fillStyle = `rgba(40, 15, 5, ${0.22 - hoch * 0.14})`;
      g.beginPath();
      g.ellipse(o.x, 2, 9 * (1 - hoch * 0.4), 2.4 * (1 - hoch * 0.4), 0, 0, TAU);
      g.fill();
    }
  }

  // ---------------------------------------------------------------------------
  // Der Jongleur
  // ---------------------------------------------------------------------------
  // Wo der Ellbogen steht: Er hängt an der Seite des Körpers, leicht nach
  // aussen – wie bei jemandem, der jongliert –, und wandert erst nach aussen
  // und oben, wenn die Hand weit hinaus oder über die Schulter geht. Der
  // Unterarm zeigt dazu oft nach vorn, zum Publikum: Im Bild ist er dann
  // kürzer.
  function ellbogen(sx, sy, hx, hy, l1, seite) {
    const hoch = clamp((hy - (sy - 34)) / 70, 0, 1);
    const weit = clamp((Math.abs(hx - sx) - 30) / 40, 0, 1);
    const w = (0.18 + 0.55 * weit + 1.1 * hoch) * seite;
    return { x: sx + Math.sin(w) * l1, y: sy - Math.cos(w) * l1 };
  }

  // Wie dem Jongleur zumute ist: "froh" vor dem Start, "konzentriert" beim
  // Jonglieren, "panik", wenn eine Hand gleich doppelt belegt wird, "jubel"
  // nach Konfetti und neuen Bällen, "schock" nach dem Fehler.
  function stimmung() {
    const B = state.bild;
    if (state.fehler) return "schock";
    if (state.phase === "bereit") return "froh";
    if (state.echt < B.jubelBis) return "jubel";
    const T = state.tick;
    for (const h of [0, 1]) {
      const hd = state.haende[h];
      const landung = naechsteLandung(h);
      if (landung === null) continue;
      if (hd.ding !== null && landung - T < sek(0.2) && T - (dingVon(hd.ding)?.fangTick ?? T) > PERFEKT_NACH) return "panik";
      const d = dingVon(hd.ding);
      if (d && d.art === "fackel" && T - d.fangTick > FACKEL_MAX * 0.6) return "panik";
    }
    if (state.echt < B.schreckBis) return "staunen";
    return "konzentriert";
  }

  // Wohin er schaut: auf das Ding, das als Nächstes landet.
  function blickZiel(t) {
    let best = null;
    for (const d of state.dinge) {
      if (d.ort !== "flug") continue;
      if (!best || d.landTick < best.landTick) best = d;
    }
    if (!best) return { x: 0, y: 260 };
    const o = bahnOrt(best, t);
    return { x: o.x, y: o.y };
  }

  function zeichneJongleur(t) {
    const B = state.bild;
    const laune = stimmung();
    weltTransform();
    const ox = B.lean;
    const oy = B.bob;
    const schock = laune === "schock";

    // Beine und Schuhe.
    const knie = Math.max(0, -oy) * 0.8;
    g.lineCap = "round";
    g.lineJoin = "round";
    g.strokeStyle = "#1c1f3d";
    g.lineWidth = 12;
    [-1, 1].forEach((seite) => {
      g.beginPath();
      g.moveTo(ox * 0.6 + seite * 9, 66 + oy);
      g.quadraticCurveTo(ox * 0.3 + seite * (14 + knie), 36 + oy * 0.6, seite * 13, 9);
      g.stroke();
    });
    g.fillStyle = "#14101c";
    [-1, 1].forEach((seite) => {
      g.beginPath();
      g.ellipse(seite * 16, 4, 11, 5.5, 0, 0, TAU);
      g.fill();
    });
    g.fillStyle = "rgba(255, 255, 255, 0.25)";
    [-1, 1].forEach((seite) => {
      g.beginPath();
      g.ellipse(seite * 18, 6.5, 4, 1.5, 0, 0, TAU);
      g.fill();
    });

    // Der Rumpf: türkis mit goldenem Saum, roter Schärpe und Knöpfen.
    const rx = ox;
    const ry = oy;
    const rumpf = g.createLinearGradient(rx - 24, 0, rx + 24, 0);
    rumpf.addColorStop(0, "#006b77");
    rumpf.addColorStop(0.45, "#00b8c9");
    rumpf.addColorStop(1, "#005662");
    g.fillStyle = rumpf;
    g.beginPath();
    g.moveTo(rx - 15, 60 + ry);
    g.quadraticCurveTo(rx - 19, 96 + ry, rx - 24, 128 + ry);
    g.quadraticCurveTo(rx, 140 + ry, rx + 24, 128 + ry);
    g.quadraticCurveTo(rx + 19, 96 + ry, rx + 15, 60 + ry);
    g.closePath();
    g.fill();
    g.strokeStyle = "#f2c14e";
    g.lineWidth = 2.2;
    g.beginPath();
    g.moveTo(rx - 4, 64 + ry);
    g.lineTo(rx - 9, 130 + ry);
    g.moveTo(rx + 4, 64 + ry);
    g.lineTo(rx + 9, 130 + ry);
    g.stroke();
    g.fillStyle = "#f2c14e";
    for (let k = 0; k < 3; k += 1) {
      g.beginPath();
      g.arc(rx, 82 + k * 14 + ry, 2.1, 0, TAU);
      g.fill();
    }
    g.fillStyle = "#b8192d";
    g.beginPath();
    g.moveTo(rx - 16, 58 + ry);
    g.lineTo(rx + 16, 58 + ry);
    g.lineTo(rx + 15.5, 68 + ry);
    g.lineTo(rx - 15.5, 68 + ry);
    g.closePath();
    g.fill();
    // Kragen und Fliege.
    g.fillStyle = "#ffffff";
    g.beginPath();
    g.moveTo(rx - 10, 132 + ry);
    g.lineTo(rx, 124 + ry);
    g.lineTo(rx + 10, 132 + ry);
    g.lineTo(rx, 137 + ry);
    g.closePath();
    g.fill();
    g.fillStyle = "#d81f36";
    g.beginPath();
    g.moveTo(rx, 130 + ry);
    g.lineTo(rx - 8, 135 + ry);
    g.lineTo(rx - 8, 125 + ry);
    g.closePath();
    g.moveTo(rx, 130 + ry);
    g.lineTo(rx + 8, 135 + ry);
    g.lineTo(rx + 8, 125 + ry);
    g.closePath();
    g.fill();
    g.beginPath();
    g.arc(rx, 130 + ry, 2.4, 0, TAU);
    g.fill();

    zeichneKopf(t, laune, rx, ry);

    // Die Arme: Ärmel, Manschette, Handschuh – und was die Hand hält.
    [0, 1].forEach((h) => {
      const seite = h === 0 ? -1 : 1;
      const hv = B.haende[h];
      const sx = rx + seite * SCHULTER_X;
      const sy = SCHULTER_Y + ry;
      let hx = hv.x;
      let hy = hv.y;
      if (schock) { hx = lerp(hx, seite * 44, 0.6); hy = lerp(hy, 168, 0.6); }
      const e = ellbogen(sx, sy, hx, hy, OBERARM, seite);
      g.strokeStyle = "#00909f";
      g.lineWidth = 10;
      g.beginPath();
      g.moveTo(sx, sy);
      g.lineTo(e.x, e.y);
      g.lineTo(hx, hy);
      g.stroke();
      g.strokeStyle = "rgba(255, 255, 255, 0.14)";
      g.lineWidth = 3;
      g.beginPath();
      g.moveTo(sx, sy + 2);
      g.lineTo(e.x, e.y + 2);
      g.stroke();
      const ux = hx - e.x;
      const uy = hy - e.y;
      const ul = Math.hypot(ux, uy) || 1;
      g.strokeStyle = "#ffffff";
      g.lineWidth = 11;
      g.beginPath();
      g.moveTo(hx - (ux / ul) * 7, hy - (uy / ul) * 7);
      g.lineTo(hx - (ux / ul) * 4, hy - (uy / ul) * 4);
      g.stroke();
      // Ein heisses Ding: die Hand glüht rot.
      const d = dingVon(state.haende[h].ding);
      const heiss = d && d.art === "fackel" ? clamp((state.tick - d.fangTick) / FACKEL_MAX, 0, 1) : 0;
      g.fillStyle = heiss > 0.3 ? `rgb(255, ${Math.round(255 - heiss * 120)}, ${Math.round(255 - heiss * 150)})` : "#fbfbf7";
      g.beginPath();
      g.arc(hx, hy, 6.8, 0, TAU);
      g.fill();
      g.strokeStyle = "rgba(30, 30, 50, 0.35)";
      g.lineWidth = 1.2;
      g.stroke();
      g.fillStyle = "#fbfbf7";
      g.beginPath();
      g.ellipse(hx - seite * 5, hy + 3, 2.6, 4, seite * 0.5, 0, TAU);
      g.fill();
      if (state.haende[h].gedrueckt && !schock) {
        // Gedrückt: ein Ring um die Hand.
        g.strokeStyle = "rgba(159, 242, 248, 0.7)";
        g.lineWidth = 1.6;
        g.beginPath();
        g.arc(hx, hy, 10 + hv.laden * 5, 0, TAU);
        g.stroke();
      }
    });
  }

  function zeichneKopf(t, laune, rx, ry) {
    const B = state.bild;
    const kx = rx * 1.15;
    const ky = 152 + ry * 1.05;
    g.fillStyle = "#e9b48c";
    g.fillRect(kx - 4, ky - 18, 8, 8);
    // Ohren, Haare, Gesicht.
    g.fillStyle = "#f2c49c";
    g.beginPath();
    g.arc(kx - 16.5, ky, 4, 0, TAU);
    g.arc(kx + 16.5, ky, 4, 0, TAU);
    g.fill();
    const haut = g.createRadialGradient(kx - 5, ky + 6, 3, kx, ky, 19);
    haut.addColorStop(0, "#ffdcbc");
    haut.addColorStop(1, "#eab48a");
    g.fillStyle = haut;
    g.beginPath();
    g.ellipse(kx, ky, 16.5, 18, 0, 0, TAU);
    g.fill();
    g.fillStyle = "#4a2614";
    g.beginPath();
    g.ellipse(kx - 14, ky + 6, 5, 8, 0.3, 0, TAU);
    g.ellipse(kx + 14, ky + 6, 5, 8, -0.3, 0, TAU);
    g.fill();
    // Rote Backen, beim Jubel kräftiger.
    g.fillStyle = laune === "jubel" ? "rgba(255, 90, 90, 0.45)" : "rgba(255, 110, 110, 0.25)";
    g.beginPath();
    g.ellipse(kx - 10, ky - 6, 4, 2.6, 0, 0, TAU);
    g.ellipse(kx + 10, ky - 6, 4, 2.6, 0, 0, TAU);
    g.fill();

    // Die Augen folgen dem Ding, das als Nächstes landet.
    const ziel = blickZiel(t);
    const gx = ziel.x - kx;
    const gy = ziel.y - ky;
    const gl = Math.hypot(gx, gy) || 1;
    const px = (gx / gl) * 1.9;
    const py = (gy / gl) * 2.1;
    const blinzelt = laune === "froh" && (state.echt % 3.4) < 0.12;
    [-1, 1].forEach((seite) => {
      const ax = kx + seite * 6.5;
      const ay = ky + 3;
      if (laune === "jubel") {
        g.strokeStyle = "#2a1a1a";
        g.lineWidth = 2;
        g.beginPath();
        g.arc(ax, ay - 1, 3.6, 0.2, Math.PI - 0.2);
        g.stroke();
        return;
      }
      const gross = laune === "panik" || laune === "schock" || laune === "staunen" ? 1.25 : 1;
      const zu = laune === "konzentriert" ? 0.82 : 1;
      g.fillStyle = "#ffffff";
      g.beginPath();
      g.ellipse(ax, ay, 3.9 * gross, (blinzelt ? 0.6 : 4.8 * zu) * gross, 0, 0, TAU);
      g.fill();
      if (!blinzelt) {
        g.fillStyle = "#2a1a1a";
        g.beginPath();
        g.arc(ax + px, ay + py * zu, (laune === "panik" || laune === "schock" ? 1.6 : 2.2), 0, TAU);
        g.fill();
        g.fillStyle = "#ffffff";
        g.beginPath();
        g.arc(ax + px + 0.8, ay + py * zu + 0.9, 0.7, 0, TAU);
        g.fill();
      }
      // Lider beim Konzentrieren.
      if (laune === "konzentriert") {
        g.fillStyle = "#eab48a";
        g.beginPath();
        g.ellipse(ax, ay + 4.2, 4.6, 2.2, 0, 0, TAU);
        g.fill();
      }
      // Brauen: konzentriert innen tief, bei Panik innen hoch.
      g.strokeStyle = "#4a2614";
      g.lineWidth = 2.1;
      g.beginPath();
      const innen = ax - seite * 3.5;
      const aussen = ax + seite * 4.5;
      if (laune === "konzentriert") {
        g.moveTo(innen, ay + 7.2);
        g.quadraticCurveTo(ax, ay + 9.4, aussen, ay + 8.6);
      } else if (laune === "panik" || laune === "schock") {
        g.moveTo(innen, ay + 11.8);
        g.lineTo(aussen, ay + 9.2);
      } else {
        g.moveTo(ax - 4, ay + 8.5);
        g.quadraticCurveTo(ax, ay + 10.5, ax + 4, ay + 8.5);
      }
      g.stroke();
    });

    // Nase, Schnurrbart, Mund.
    g.fillStyle = "#e3a07a";
    g.beginPath();
    g.ellipse(kx, ky - 3, 2.8, 3.4, 0, 0, TAU);
    g.fill();
    const wackel = laune === "panik" ? Math.sin(state.echt * 40) * 0.8 : laune === "jubel" ? 1.5 : 0;
    g.fillStyle = "#3a1d10";
    [-1, 1].forEach((seite) => {
      g.beginPath();
      g.moveTo(kx, ky - 6);
      g.quadraticCurveTo(kx + seite * 7, ky - 4 + wackel, kx + seite * 11, ky - 8 + wackel);
      g.quadraticCurveTo(kx + seite * 13, ky - 10.5 + wackel, kx + seite * 11, ky - 11 + wackel * 0.5);
      g.quadraticCurveTo(kx + seite * 9, ky - 8 + wackel, kx + seite * 6, ky - 9);
      g.quadraticCurveTo(kx + seite * 2, ky - 9.5, kx, ky - 8);
      g.closePath();
      g.fill();
    });
    const my = ky - 12;
    if (laune === "jubel") {
      g.fillStyle = "#6a1220";
      g.beginPath();
      g.moveTo(kx - 6, my + 1.5);
      g.quadraticCurveTo(kx, my - 7, kx + 6, my + 1.5);
      g.closePath();
      g.fill();
      g.fillStyle = "#ff7a8a";
      g.beginPath();
      g.ellipse(kx, my - 3, 2.6, 1.5, 0, 0, TAU);
      g.fill();
    } else if (laune === "panik" || laune === "schock" || laune === "staunen") {
      g.fillStyle = "#4a0c16";
      g.beginPath();
      g.ellipse(kx, my - 1.5, laune === "staunen" ? 2 : 2.8, laune === "schock" ? 4 : 3, 0, 0, TAU);
      g.fill();
    } else if (laune === "konzentriert") {
      g.strokeStyle = "#5a1a20";
      g.lineWidth = 1.7;
      g.beginPath();
      g.arc(kx, my + 4, 4.2, Math.PI + 0.75, TAU - 0.75);
      g.stroke();
      // Die Zunge im Mundwinkel, wenn es richtig viel wird.
      if (anzahlDinge() >= 6 || state.echt < B.kauenBis) {
        g.fillStyle = "#ff7a8a";
        g.beginPath();
        g.ellipse(kx + 3.6, my - 1, 1.8, 2.2, 0.4, 0, TAU);
        g.fill();
      }
    } else {
      g.strokeStyle = "#5a1a20";
      g.lineWidth = 1.8;
      g.beginPath();
      g.arc(kx, my + 3, 4.5, Math.PI + 0.5, TAU - 0.5);
      g.stroke();
    }
    // Kauen: der Mund mahlt.
    if (state.echt < B.kauenBis && laune !== "schock") {
      const k = Math.abs(Math.sin(state.echt * 18));
      g.fillStyle = "#6a1220";
      g.beginPath();
      g.ellipse(kx, my, 3, 0.8 + k * 1.8, 0, 0, TAU);
      g.fill();
    }
    // Schweiss bei Panik.
    if (laune === "panik") {
      g.fillStyle = "rgba(160, 220, 255, 0.9)";
      const sy = ky + 10 - ((state.echt * 30) % 14);
      g.beginPath();
      g.moveTo(kx + 15, sy + 4);
      g.quadraticCurveTo(kx + 18, sy - 1, kx + 15, sy - 2);
      g.quadraticCurveTo(kx + 12, sy - 1, kx + 15, sy + 4);
      g.fill();
    }

    // Der Zylinder, leicht schief – beim Schreck hüpft er.
    const hutHoch = laune === "schock" ? 9 + Math.sin(Math.min(1, (state.echt - (B.schreckBis - 9)) * 3) * Math.PI) * 6 : 0;
    g.save();
    g.translate(kx + 1, ky + 15 + hutHoch);
    g.rotate(laune === "schock" ? 0.25 : -0.09 + B.lean * 0.01);
    g.fillStyle = "#2e1033";
    g.beginPath();
    g.ellipse(0, 0, 18.5, 3.8, 0, 0, TAU);
    g.fill();
    const hut = g.createLinearGradient(-12, 0, 12, 0);
    hut.addColorStop(0, "#1f0a24");
    hut.addColorStop(0.5, "#4a1a52");
    hut.addColorStop(1, "#1f0a24");
    g.fillStyle = hut;
    g.fillRect(-12, 1, 24, 22);
    g.beginPath();
    g.ellipse(0, 23, 12, 2.6, 0, 0, TAU);
    g.fill();
    g.fillStyle = "#f2c14e";
    g.fillRect(-12, 2, 24, 4.5);
    g.restore();
  }

  // ---------------------------------------------------------------------------
  // Der Clown
  // ---------------------------------------------------------------------------
  // Wo der Clown steht, wenn er wirft: auf schmalen Bildern weiter innen.
  const clownStand = () => Math.min(CLOWN_X, view.w / 2 - 34);

  function zeichneClown(t) {
    const B = state.bild;
    if (!B.clownSichtbar) return;
    const z = state.zugabe;
    const seite = B.clownSeite;
    const cx = B.clownX;
    weltTransform();
    const tanz = Math.sin(state.echt * 9) * 2;
    const trommelt = z && z.phase === "trommel";
    const wurfSeit = state.echt - B.clownWurf;
    const winkt = wurfSeit >= 0.35 && wurfSeit < 1.1;
    const hopsen = trommelt ? Math.abs(Math.sin(state.echt * 14)) * 2 : Math.abs(Math.sin(state.echt * 6)) * 1.5;
    const y0 = hopsen;
    g.lineCap = "round";
    g.lineJoin = "round";
    // Grosse rote Schuhe, gestreifte Hosen.
    g.fillStyle = "#d61f2c";
    [-1, 1].forEach((k) => {
      g.beginPath();
      g.ellipse(cx + k * 13 - seite * 4, 5, 14, 6.5, 0, 0, TAU);
      g.fill();
    });
    g.strokeStyle = "#2f63d6";
    g.lineWidth = 11;
    [-1, 1].forEach((k) => {
      g.beginPath();
      g.moveTo(cx + k * 8, 58 + y0);
      g.lineTo(cx + k * 12, 10);
      g.stroke();
    });
    // Der runde Bauch mit Tupfen.
    g.fillStyle = "#ffd23f";
    g.beginPath();
    g.ellipse(cx, 84 + y0, 26, 32, 0, 0, TAU);
    g.fill();
    g.fillStyle = "#e8433a";
    [[-10, 92], [9, 100], [-4, 74], [12, 78], [-14, 70], [2, 108], [-12, 106]].forEach(([dx, dy]) => {
      g.beginPath();
      g.arc(cx + dx, dy + y0, 3.2, 0, TAU);
      g.fill();
    });
    // Rüschenkragen.
    g.fillStyle = "#ffffff";
    for (let k = -3; k <= 3; k += 1) {
      g.beginPath();
      g.arc(cx + k * 6.5, 114 + y0 - Math.abs(k) * 1.2, 5, 0, TAU);
      g.fill();
    }
    // Kopf: weiss geschminkt, rote Nase, Lachen, bunte Lockenperücke.
    const kx = cx;
    const ky = 132 + y0;
    g.fillStyle = "#fff4ea";
    g.beginPath();
    g.arc(kx, ky, 15, 0, TAU);
    g.fill();
    const locken = ["#ff4f9a", "#ffb02e", "#3fd07f", "#3d8bff", "#a45cff"];
    for (let k = 0; k < 9; k += 1) {
      const w = Math.PI * (0.05 + (k / 8) * 0.9);
      g.fillStyle = locken[k % locken.length];
      g.beginPath();
      g.arc(kx + Math.cos(w) * 15, ky + Math.sin(w) * 13 + 2, 6.5, 0, TAU);
      g.fill();
    }
    g.fillStyle = "#2a1a2a";
    [-1, 1].forEach((k) => {
      g.beginPath();
      g.ellipse(kx + k * 5 + seite * -1.5, ky + 3, 1.8, 3, 0, 0, TAU);
      g.fill();
    });
    g.strokeStyle = "#2a1a2a";
    g.lineWidth = 1.4;
    [-1, 1].forEach((k) => {
      g.beginPath();
      g.moveTo(kx + k * 5 - 2.5, ky + 8.5);
      g.lineTo(kx + k * 5 + 2.5, ky + 9.5);
      g.stroke();
    });
    g.fillStyle = "#e8263a";
    g.beginPath();
    g.moveTo(kx - 9, ky - 4);
    g.quadraticCurveTo(kx, ky - 15, kx + 9, ky - 4);
    g.quadraticCurveTo(kx, ky - 8, kx - 9, ky - 4);
    g.fill();
    const nase = g.createRadialGradient(kx - 1, ky + 1, 0.5, kx, ky, 5);
    nase.addColorStop(0, "#ff8a8a");
    nase.addColorStop(1, "#d10f24");
    g.fillStyle = nase;
    g.beginPath();
    g.arc(kx, ky - 0.5, 4.6, 0, TAU);
    g.fill();
    // Ein spitzer Hut.
    g.fillStyle = "#3fd07f";
    g.beginPath();
    g.moveTo(kx - 7 - seite * 2, ky + 14);
    g.lineTo(kx + 7 - seite * 2, ky + 14);
    g.lineTo(kx - seite * 6, ky + 34);
    g.closePath();
    g.fill();
    g.fillStyle = "#ffd23f";
    g.beginPath();
    g.arc(kx - seite * 6, ky + 35, 3, 0, TAU);
    g.fill();

    // Die Arme: einer hält das Ding hoch (zittert beim Trommelwirbel),
    // wirft es dann zur Hand hinüber; danach winkt er.
    const sx = cx - seite * 18;
    const sy = 108 + y0;
    let hx;
    let hy;
    if (z && (z.phase === "trommel" || z.phase === "warten")) {
      const zittern = trommelt ? Math.sin(state.echt * 50) * 1.6 : 0;
      hx = cx - seite * 14 + zittern + (z.phase === "warten" ? tanz * 0.5 : 0);
      hy = 168 + y0 + (z.phase === "warten" ? Math.sin(state.echt * 6) * 3 : 0);
    } else if (wurfSeit < 0.35) {
      const k = clamp(wurfSeit / 0.35, 0, 1);
      hx = cx - seite * lerp(14, 40, k);
      hy = lerp(168, 130, k) + y0;
    } else if (winkt) {
      hx = cx - seite * 20 + Math.sin(state.echt * 14) * 5;
      hy = 160 + y0;
    } else {
      hx = cx - seite * 24;
      hy = 80 + y0;
    }
    g.strokeStyle = "#ffd23f";
    g.lineWidth = 9;
    g.beginPath();
    g.moveTo(sx, sy);
    g.quadraticCurveTo((sx + hx) / 2 - seite * 4, (sy + hy) / 2, hx, hy);
    g.stroke();
    const ax = cx + seite * 18;
    g.beginPath();
    g.moveTo(ax, sy);
    g.lineTo(ax + seite * 10, sy - 26 + tanz);
    g.stroke();
    g.fillStyle = "#ffffff";
    g.beginPath();
    g.arc(hx, hy, 6, 0, TAU);
    g.arc(ax + seite * 10, sy - 28 + tanz, 6, 0, TAU);
    g.fill();
    if (z && (z.phase === "trommel" || z.phase === "warten")) {
      const d = dingVon(z.id);
      if (d) zeichneDing(d.art, d.farbe, 0, hx, hy + auflage(d.art), 0, 1, 1, 1, state.echt, true);
    }
  }

  // ---------------------------------------------------------------------------
  // Die Dinge
  // ---------------------------------------------------------------------------
  // Die Spur hinter einem fliegenden Ding: golden nach einem perfekten Wurf,
  // feurig hinter der Fackel, sonst ein heller Hauch.
  function zeichneSpur(d, t) {
    const t0 = d.wurfTick * TAKT;
    const lang = d.perfekt ? 0.2 : 0.13;
    const n = 12;
    let farbe = [255, 255, 255, 0.4];
    let breit = ART[d.art].r * 1.5;
    if (d.perfekt) { farbe = [255, 196, 60, 0.7]; breit = ART[d.art].r * 1.55; }
    if (d.art === "fackel") { farbe = [255, 130, 30, 0.85]; breit = ART[d.art].r * 1.6; }
    if (d.hoch) farbe = [159, 242, 248, 0.7];
    // Ein Band entlang des Wegs, vorne so breit wie das Ding, hinten spitz.
    const punkte = [];
    for (let i = 0; i <= n; i += 1) {
      const ti = t - (lang * i) / n;
      punkte.push(bahnOrt(d, Math.max(ti, t0)));
      if (ti <= t0) break;
    }
    if (punkte.length < 3) return;
    const links = [];
    const rechts = [];
    const m = punkte.length - 1;
    for (let i = 0; i <= m; i += 1) {
      const a = punkte[Math.max(0, i - 1)];
      const b = punkte[Math.min(m, i + 1)];
      let dx = b.x - a.x;
      let dy = b.y - a.y;
      const l = Math.hypot(dx, dy) || 1;
      dx /= l;
      dy /= l;
      const w = breit * 0.5 * (1 - i / (n + 1)) ** 0.9;
      links.push(punkte[i].x - dy * w, punkte[i].y + dx * w);
      rechts.push(punkte[i].x + dy * w, punkte[i].y - dx * w);
    }
    const ende = punkte[m];
    const v = g.createLinearGradient(punkte[0].x, punkte[0].y, ende.x, ende.y);
    const [r, gr, bl, al] = farbe;
    v.addColorStop(0, `rgba(${r}, ${gr}, ${bl}, ${al})`);
    v.addColorStop(1, `rgba(${r}, ${gr}, ${bl}, 0)`);
    g.globalCompositeOperation = d.perfekt || d.art === "fackel" ? "lighter" : "source-over";
    g.fillStyle = v;
    g.beginPath();
    g.moveTo(links[0], links[1]);
    for (let i = 2; i < links.length; i += 2) g.lineTo(links[i], links[i + 1]);
    for (let i = rechts.length - 2; i >= 0; i -= 2) g.lineTo(rechts[i], rechts[i + 1]);
    g.closePath();
    g.fill();
    g.globalCompositeOperation = "source-over";
  }

  // Wo ein Ding in der Hand liegt: auf dem Handschuh, kurz nach dem Fang noch
  // auf dem Weg dorthin.
  function inDerHand(d, t) {
    const hv = state.bild.haende[d.hand];
    const ziel = { x: hv.x, y: hv.y + auflage(d.art) };
    const seit = t - d.fangTick * TAKT;
    if (seit < 0.05 && !d.start && d.faenge > 0) {
      const k = clamp(seit / 0.05, 0, 1);
      return { x: lerp(d.x1, ziel.x, k), y: lerp(d.y1, ziel.y, k) };
    }
    return ziel;
  }

  function zeichneDinge(t) {
    weltTransform();
    // Erst die Spuren, dann die Dinge.
    for (const d of state.dinge) if (d.ort === "flug") zeichneSpur(d, t);
    const T = state.tick;
    // Warnungen: zwei, die zu dicht nacheinander in derselben Hand landen.
    const dicht = new Set();
    for (const h of [0, 1]) {
      const an = state.dinge.filter((d) => d.ort === "flug" && d.hand === h).sort((a, b) => a.landTick - b.landTick);
      for (let i = 1; i < an.length; i += 1) {
        if (an[i].landTick - an[i - 1].landTick < sek(0.11)) { dicht.add(an[i].id); dicht.add(an[i - 1].id); }
      }
    }
    // Das erste Mal, dass zwei zu dicht kommen: ein Tipp, wie man sie
    // auseinanderbringt – in den ersten Runden.
    if (dicht.size && state.phase === "spiel" && !state.tippGezeigt && tippRunden < 3) {
      state.tippGezeigt = true;
      tippRunden += 1;
      schrift("Tipp: lange halten wirft höher", 0, 26, "#9ff2f8", 13, 2.6);
    }
    for (const d of state.dinge) {
      if (d.ort === "flug") {
        const o = bahnOrt(d, t);
        const tempo = Math.hypot(o.vx, o.vy);
        const zieh = ruhig() ? 0 : Math.min(0.12, tempo / 6000);
        const winkel = drehung(d, t);
        g.save();
        g.translate(o.x, o.y);
        if (zieh > 0.005 && (d.art === "ball" || d.art === "kugel" || d.art === "apfel")) {
          const zw = Math.atan2(o.vy, o.vx);
          g.rotate(zw);
          g.scale(1 + zieh, 1 - zieh * 0.6);
          g.rotate(-zw);
        }
        if (d.perfekt && (d.art === "ball" || d.art === "kugel" || d.art === "apfel")) {
          g.globalCompositeOperation = "lighter";
          const r = ART[d.art].r;
          const hof = g.createRadialGradient(0, 0, r * 0.6, 0, 0, r * 2.2);
          hof.addColorStop(0, "rgba(255, 200, 80, 0.35)");
          hof.addColorStop(1, "rgba(255, 160, 40, 0)");
          g.fillStyle = hof;
          g.fillRect(-r * 2.2, -r * 2.2, r * 4.4, r * 4.4);
          g.globalCompositeOperation = "source-over";
        }
        if (dicht.has(d.id) && Math.sin(state.echt * 22) > -0.2) {
          g.strokeStyle = "rgba(255, 80, 80, 0.95)";
          g.lineWidth = 2.4;
          g.beginPath();
          g.arc(0, 0, ART[d.art].r + 4, 0, TAU);
          g.stroke();
        }
        g.restore();
        zeichneDing(d.art, d.farbe, d.faenge, o.x, o.y, winkel, 1, 1, 1, t, true);
        if (bildY(o.y) < view.frei + 2) zeichnePfeil(d, o);
      } else if (d.ort === "hand") {
        const p = inDerHand(d, t);
        const hd = state.haende[d.hand];
        const halten = (T - d.fangTick) * TAKT;
        let winkel = d.art === "keule" || d.art === "fackel" ? (d.hand === 0 ? 0.22 : -0.22) : (d.dreh0 || 0);
        // Zu lange gehalten: Es wackelt.
        const grenze = (d.art === "fackel" ? FACKEL_MAX : HALTEN_MAX) * TAKT;
        const warn = clamp((halten - grenze * 0.55) / (grenze * 0.45), 0, 1);
        if (warn > 0 && !ruhig()) winkel += Math.sin(state.echt * 30) * 0.12 * warn;
        const q = d.quetsch || 0;
        const sx = 1 + q * 0.22;
        const sy = 1 - q * 0.2;
        zeichneDing(d.art, d.farbe, d.faenge, p.x, p.y - q * 2, winkel, sx, sy, 1, t, true);
        // Gleich kommt das nächste, und das hier liegt noch: ein roter Ring.
        const landung = naechsteLandung(d.hand);
        const knapp = landung !== null && landung - T < sek(0.3) && !hd.gedrueckt;
        if ((knapp || warn > 0.3) && !state.fehler) {
          const puls = 0.6 + 0.4 * Math.sin(state.echt * 18);
          g.strokeStyle = `rgba(255, 90, 80, ${0.85 * puls})`;
          g.lineWidth = 2.4;
          g.beginPath();
          g.arc(p.x, p.y, ART[d.art].r + 6 + puls * 2, 0, TAU);
          g.stroke();
        }
      }
    }
  }

  let tippRunden = 0;

  // Ein hoher Wurf über dem Bildrand: ein Pfeil zeigt, wo er ist.
  function zeichnePfeil(d, o) {
    const sy = view.frei + 10;
    const sx = bildX(o.x);
    const F = FARBEN[d.farbe] || FARBEN[0];
    g.save();
    bildTransform();
    g.fillStyle = d.art === "ball" ? F.haupt : "#ffffff";
    g.strokeStyle = "rgba(0, 0, 0, 0.5)";
    g.lineWidth = 1.5;
    g.beginPath();
    g.moveTo(sx, sy);
    g.lineTo(sx - 7, sy + 10);
    g.lineTo(sx + 7, sy + 10);
    g.closePath();
    g.fill();
    g.stroke();
    g.restore();
    weltTransform();
  }

  // Beim Halten: der Bogen, den der Wurf jetzt nähme, gepunktet.
  function zeichneVorschau(t) {
    for (const h of [0, 1]) {
      const hd = state.haende[h];
      if (!hd.gedrueckt || hd.druckArt !== "halten") continue;
      const d = dingVon(hd.ding);
      if (!d || d.art === "kugel") continue;
      const halt = state.tick - hd.druckTick;
      if (halt < H_TAP * 0.6) continue;
      const u = clamp((halt - H_TAP) / (H_VOLL - H_TAP), 0, 1);
      const FT = flugTicks(state.punkte);
      const f = FT * ART[d.art].flug * (1 + HOCH_MAX * u) * TAKT;
      const seite = h === 0 ? -1 : 1;
      const hv = state.bild.haende[h];
      const x0 = hv.x;
      const y0 = hv.y + 8;
      const x1 = -seite * FANG_X;
      const y1 = HAND_Y + 8;
      const bogen = H_NORM * (f / (FT * TAKT)) ** 2 * ART[d.art].hoehe;
      weltTransform();
      g.fillStyle = `rgba(159, 242, 248, ${0.35 + 0.4 * clamp(halt / H_TAP, 0, 1)})`;
      for (let k = 1; k < 24; k += 1) {
        const v = k / 24;
        const x = x0 + (x1 - x0) * v;
        const y = y0 + (y1 - y0) * v + 4 * bogen * v * (1 - v);
        g.beginPath();
        g.arc(x, y, 1.6, 0, TAU);
        g.fill();
      }
      g.strokeStyle = "rgba(159, 242, 248, 0.8)";
      g.lineWidth = 1.6;
      g.beginPath();
      g.arc(x1, y1, 9, 0, TAU);
      g.stroke();
      // Die Kraftanzeige: ein Bogen um die Hand.
      g.strokeStyle = u >= 1 ? "#ffd23f" : "#9ff2f8";
      g.lineWidth = 3;
      g.beginPath();
      g.arc(hv.x, hv.y, 14, Math.PI / 2, Math.PI / 2 + TAU * clamp(halt / H_VOLL, 0, 1));
      g.stroke();
    }
  }

  // Wohin der Clown wirft: ein gestrichelter Ring an der Hand.
  function zeichneClownZiel() {
    const z = state.zugabe;
    if (!z || (z.phase !== "warten" && z.phase !== "flug") || state.fehler) return;
    const d = dingVon(z.id);
    if (!d || d.ort === "boden") return;
    weltTransform();
    const x = (z.hand === 0 ? -1 : 1) * FANG_X;
    const y = HAND_Y + auflage(d.art);
    const puls = 0.5 + 0.5 * Math.sin(state.echt * 10);
    g.strokeStyle = `rgba(255, 230, 120, ${0.5 + 0.4 * puls})`;
    g.lineWidth = 2;
    g.setLineDash([4, 3]);
    g.beginPath();
    g.arc(x, y, ART[d.art].r + 7 + puls * 3, 0, TAU);
    g.stroke();
    g.setLineDash([]);
  }

  // Nach dem Fehler: alles fällt ins Sägemehl, hüpft und rollt aus.
  function zeichneFaelle() {
    if (!state.faelle.length) return;
    weltTransform();
    for (const f of state.faelle) {
      g.fillStyle = "rgba(40, 15, 5, 0.3)";
      g.beginPath();
      g.ellipse(f.x, f.tief + 1, 9, 2.5, 0, 0, TAU);
      g.fill();
    }
    for (const f of state.faelle) zeichneDing(f.art, f.farbe, f.faenge, f.x, f.y, f.dreh, 1, 1, 1, state.zeit, true);
  }

  // ---------------------------------------------------------------------------
  // Teilchen, Wellen, Schriften
  // ---------------------------------------------------------------------------
  const TEILE_MAX = 220;

  function teil(t) {
    if (state.stumm) return;
    if (state.teile.length >= TEILE_MAX) state.teile.shift();
    state.teile.push(t);
  }

  function funken(x, y, anzahl, farben, tempo = 160) {
    if (state.stumm) return;
    if (ruhig()) anzahl = Math.ceil(anzahl / 3);
    for (let i = 0; i < anzahl; i += 1) {
      const w = Math.random() * TAU;
      const v = tempo * (0.4 + Math.random() * 0.8);
      teil({ art: "funke", x, y, vx: Math.cos(w) * v, vy: Math.sin(w) * v, r: 1.2 + Math.random() * 1.8,
        farbe: farben[i % farben.length], leben: 0.35 + Math.random() * 0.4, max: 0.75, dreh: 0, w: 0 });
    }
  }

  function krumen(x, y) {
    if (state.stumm) return;
    for (let i = 0; i < (ruhig() ? 3 : 8); i += 1) {
      teil({ art: "krume", x, y, vx: (Math.random() - 0.5) * 120, vy: 40 + Math.random() * 90, r: 1.2 + Math.random() * 1.4,
        farbe: i % 2 ? "#fff1cc" : "#e01e35", leben: 0.7, max: 0.7, dreh: Math.random() * 6, w: 0 });
    }
  }

  function staub(x, y, anzahl) {
    if (state.stumm) return;
    for (let i = 0; i < (ruhig() ? Math.ceil(anzahl / 3) : anzahl); i += 1) {
      const w = Math.random() * Math.PI;
      const v = 20 + Math.random() * 70;
      teil({ art: "staub", x: x + (Math.random() - 0.5) * 10, y, vx: Math.cos(w) * v, vy: Math.sin(w) * v * 0.5,
        r: 2.5 + Math.random() * 3, farbe: i % 2 ? "#e9c58f" : "#c99a5c", leben: 0.6 + Math.random() * 0.4, max: 1, dreh: 0, w: 0 });
    }
  }

  // Konfetti: fällt von oben über das ganze Bild, flattert und dreht sich.
  function konfetti(anzahl) {
    if (state.stumm) return;
    const farben = ["#ff3b4e", "#ffc928", "#3d8bff", "#35d07f", "#a45cff", "#ff8a2a", "#22d3e0", "#ffffff"];
    const oben = view.camY + view.h;
    for (let i = 0; i < anzahl; i += 1) {
      teil({ art: "konfetti", x: (Math.random() - 0.5) * Math.min(view.w, 700), y: oben + Math.random() * 60,
        vx: (Math.random() - 0.5) * 60, vy: -40 - Math.random() * 60, r: 2.5 + Math.random() * 2.5,
        farbe: farben[i % farben.length], leben: 2.6 + Math.random(), max: 3.6, dreh: Math.random() * TAU, w: (Math.random() - 0.5) * 12 });
    }
  }

  function welle(x, y, art) {
    if (state.stumm) return;
    state.wellen.push({ x, y, art, alter: 0, max: art === "luft" ? 0.35 : art === "stoss" ? 0.6 : 0.4 });
    if (state.wellen.length > 10) state.wellen.shift();
  }

  function schrift(text, x, y, farbe, gross, dauer = 1.1) {
    if (state.stumm) return;
    for (const alt of state.schriften) {
      if (alt.leben > alt.max * 0.5 && Math.abs(alt.x - x) < 90 && Math.abs(alt.y - y) < 24) y = alt.y + 26;
    }
    state.schriften.push({ text, x, y, farbe, gross, leben: dauer, max: dauer });
    if (state.schriften.length > 6) state.schriften.shift();
  }

  function zeichneTeile() {
    if (!state.teile.length) return;
    weltTransform();
    for (let durchgang = 0; durchgang < 2; durchgang += 1) {
      if (durchgang) g.globalCompositeOperation = "lighter";
      for (const t of state.teile) {
        const hell = t.art === "funke";
        if (hell !== Boolean(durchgang)) continue;
        const k = clamp(t.leben / t.max, 0, 1);
        g.fillStyle = t.farbe;
        if (t.art === "konfetti") {
          g.globalAlpha = Math.min(1, t.leben * 1.5);
          g.save();
          g.translate(t.x, t.y);
          g.rotate(t.dreh);
          g.scale(1, Math.cos(t.dreh * 2.3));
          g.fillRect(-t.r, -t.r * 0.6, t.r * 2, t.r * 1.2);
          g.restore();
        } else if (t.art === "staub") {
          g.globalAlpha = k * 0.5;
          g.beginPath();
          g.arc(t.x, t.y, t.r * (2 - k), 0, TAU);
          g.fill();
        } else {
          g.globalAlpha = k;
          g.beginPath();
          g.arc(t.x, t.y, t.r * (0.4 + k * 0.6), 0, TAU);
          g.fill();
        }
      }
    }
    g.globalAlpha = 1;
    g.globalCompositeOperation = "source-over";
  }

  function zeichneWellen() {
    if (!state.wellen.length) return;
    weltTransform();
    for (const w of state.wellen) {
      const u = clamp(w.alter / w.max, 0, 1);
      const gross = w.art === "stoss" ? 40 : w.art === "luft" ? 14 : 22;
      g.globalAlpha = (1 - u) * 0.9;
      g.strokeStyle = w.art === "luft" ? "#e8eef5" : w.art === "stoss" ? "#ff6a5a" : w.art === "hoch" ? "#9ff2f8" : "#ffffff";
      g.lineWidth = (w.art === "stoss" ? 4 : 2.6) * (1 - u * 0.6);
      if (w.art === "luft") g.setLineDash([3, 3]);
      g.beginPath();
      g.arc(w.x, w.y, 6 + u * gross, 0, TAU);
      g.stroke();
      if (w.art === "luft") {
        g.setLineDash([]);
        g.beginPath();
        g.moveTo(w.x - 4, w.y - 4);
        g.lineTo(w.x + 4, w.y + 4);
        g.moveTo(w.x + 4, w.y - 4);
        g.lineTo(w.x - 4, w.y + 4);
        g.stroke();
      }
    }
    g.setLineDash([]);
    g.globalAlpha = 1;
  }

  function zeichneSchriften() {
    if (!state.schriften.length) return;
    bildTransform();
    g.textAlign = "center";
    g.textBaseline = "middle";
    for (const sch of state.schriften) {
      const k = clamp(sch.leben / sch.max, 0, 1);
      const alter = sch.max - sch.leben;
      const pop = alter < 0.15 && !ruhig() ? 0.6 + (alter / 0.15) * 0.4 + Math.sin((alter / 0.15) * Math.PI) * 0.25 : 1;
      const gross = Math.round(sch.gross * clamp(view.s, 0.9, 1.6) * pop);
      g.font = `900 ${gross}px system-ui, sans-serif`;
      const breit = g.measureText(sch.text).width;
      const x = clamp(bildX(sch.x), breit / 2 + 6, view.cssW - breit / 2 - 6);
      const y = Math.max(view.frei + gross, bildY(sch.y) - (1 - k) * 22);
      g.globalAlpha = Math.min(1, k * 2.5);
      g.lineWidth = Math.max(3, gross * 0.2);
      g.lineJoin = "round";
      g.strokeStyle = "rgba(30, 8, 16, 0.8)";
      g.strokeText(sch.text, x, y);
      g.fillStyle = sch.farbe;
      g.fillText(sch.text, x, y);
    }
    g.globalAlpha = 1;
  }

  // Die Ansage der Zugabe: Trommelwirbel, dann was kommt.
  function zeichneAnsage() {
    const a = state.ansage;
    if (!a) return;
    const alter = state.echt - a.t;
    const dauer = 2.4;
    if (alter > dauer) { state.ansage = null; return; }
    bildTransform();
    const ein = clamp(alter / 0.2, 0, 1);
    const aus = clamp((dauer - alter) / 0.3, 0, 1);
    g.globalAlpha = Math.min(ein, aus);
    g.textAlign = "center";
    g.textBaseline = "middle";
    const gross = Math.round(clamp(view.cssW * 0.045, 15, 26));
    // Über den Bögen, wenn dort Platz ist (hochkant) – sonst neben dem
    // Jongleur, auf der Seite gegenüber dem Clown (quer).
    let x = view.cssW / 2;
    let y = bildY(OBEN + 50);
    if (y < view.frei + gross * 1.5) {
      const seite = -state.bild.clownSeite;
      const innen = bildX(seite * (FANG_X + 30));
      const aussen = seite > 0 ? view.cssW - 8 : 8;
      x = (innen + aussen) / 2;
      y = bildY(205);
    }
    const trommel = alter < TROMMEL * TAKT;
    const text = trommel ? "Trrrrommelwirbel …" : a.titel;
    g.font = `900 ${gross}px system-ui, sans-serif`;
    const zitter = trommel && !ruhig() ? Math.sin(state.echt * 60) * 1.5 : 0;
    g.lineWidth = Math.max(3, gross * 0.22);
    g.lineJoin = "round";
    g.strokeStyle = "rgba(30, 8, 16, 0.85)";
    g.strokeText(text, x + zitter, y);
    g.fillStyle = trommel ? "#ffe68f" : "#ffffff";
    g.fillText(text, x + zitter, y);
    if (!trommel && a.satz) {
      const klein = Math.round(gross * 0.6);
      g.font = `800 ${klein}px system-ui, sans-serif`;
      g.lineWidth = Math.max(2.5, klein * 0.25);
      g.strokeText(a.satz, x, y + gross * 1.05);
      g.fillStyle = "#ffe68f";
      g.fillText(a.satz, x, y + gross * 1.05);
    }
    g.globalAlpha = 1;
  }

  // Vor dem Start: Ringe um die zwei Bälle, die zeigen, wo man tippt.
  function zeichneStartHinweis() {
    if (state.phase !== "bereit" || shell?.live) return;
    weltTransform();
    const puls = (state.echt % 1.4) / 1.4;
    [0, 1].forEach((h) => {
      const hv = state.bild.haende[h];
      g.strokeStyle = `rgba(255, 255, 255, ${0.8 * (1 - puls)})`;
      g.lineWidth = 2.4;
      g.beginPath();
      g.arc(hv.x, hv.y + 9, 16 + puls * 16, 0, TAU);
      g.stroke();
    });
    bildTransform();
    const gross = Math.round(clamp(view.s * 13, 12, 20));
    g.font = `900 ${gross}px system-ui, sans-serif`;
    g.textAlign = "center";
    g.textBaseline = "middle";
    [[-1, "◀ links"], [1, "rechts ▶"]].forEach(([seite, text]) => {
      const x = bildX(seite * (FANG_X + 34));
      const y = bildY(HAND_Y - 34);
      g.lineWidth = 4;
      g.strokeStyle = "rgba(20, 8, 16, 0.75)";
      g.strokeText(text, x, y);
      g.fillStyle = "#ffffff";
      g.fillText(text, x, y);
    });
  }

  // Ein Tipp: Die Bildhälfte leuchtet kurz auf.
  function zeichneTippLicht() {
    const B = state.bild;
    const k = [clamp(1 - (state.echt - B.tippL) / 0.18, 0, 1), clamp(1 - (state.echt - B.tippR) / 0.18, 0, 1)];
    if (!k[0] && !k[1]) return;
    flachTransform();
    [0, 1].forEach((h) => {
      if (!k[h]) return;
      const x0 = h ? view.cssW / 2 : 0;
      const v = g.createLinearGradient(h ? view.cssW : 0, 0, view.cssW / 2, 0);
      v.addColorStop(0, `rgba(159, 242, 248, ${0.16 * k[h]})`);
      v.addColorStop(1, "rgba(159, 242, 248, 0)");
      g.fillStyle = v;
      g.fillRect(x0, 0, view.cssW / 2, view.cssH);
    });
  }

  // Die vorderste Reihe Publikum – und wenn es jubelt, gehen die Arme hoch.
  function zeichneVorne() {
    const v = bilder.vorne;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.drawImage(v.c, Math.round(wackelX() * view.dpr), Math.round((v.oben + wackelY()) * view.dpr));
    if (state.jubel < 0.05) return;
    bildTransform();
    g.strokeStyle = "#07040a";
    g.lineCap = "round";
    for (const p of bilder.vorneReihe) {
      if (hash01(p.n * 3.3) > 0.55 + state.jubel * 0.4) continue;
      const w = Math.sin(state.echt * 9 + p.n) * 0.25;
      g.lineWidth = p.r * 0.7;
      const hoch = p.r * (2.2 + state.jubel * 0.8);
      [-1, 1].forEach((seite) => {
        g.beginPath();
        g.moveTo(p.x + seite * p.r * 1.3, p.y + p.r * 1.8);
        g.lineTo(p.x + seite * p.r * (1.6 + w), p.y - hoch * state.jubel);
        g.stroke();
      });
    }
  }

  // Oben links, unter den Knöpfen: die Fänge, darunter wie viele Dinge
  // fliegen, die Serie und – wenn eingeschaltet – die Zielmarken.
  function zeichneAnzeige() {
    if (state.phase === "bereit") return;
    flachTransform();
    g.translate(0, shell?.frei?.(canvas) || 0);
    const gross = clamp(view.cssH * 0.05, 14, 24);
    g.font = `900 ${Math.round(gross)}px system-ui, sans-serif`;
    g.textAlign = "left";
    g.textBaseline = "middle";
    const text = String(state.punkte);
    const x = 12;
    let y = 12;
    const w = g.measureText(text).width + gross * 2.1;
    const hoch = gross * 1.6;
    g.fillStyle = "rgba(20, 8, 18, 0.6)";
    g.beginPath();
    if (g.roundRect) g.roundRect(x, y, w, hoch, hoch / 2);
    else g.rect(x, y, w, hoch);
    g.fill();
    // Drei kleine Bälle im Bogen vor der Zahl.
    const bx = x + gross * 0.82;
    const by = y + hoch / 2;
    ["#ff3b4e", "#ffc928", "#22d3e0"].forEach((farbe, i) => {
      const w2 = Math.PI * (1.15 + i * 0.35);
      g.fillStyle = farbe;
      g.beginPath();
      g.arc(bx + Math.cos(w2) * gross * 0.3, by + 2 + Math.sin(w2) * gross * 0.32, gross * 0.17, 0, TAU);
      g.fill();
    });
    g.fillStyle = "#ffffff";
    g.fillText(text, x + gross * 1.5, by + 1);
    y += hoch + 6;

    const klein = Math.round(gross * 0.62);
    g.font = `900 ${klein}px system-ui, sans-serif`;
    const pille = (inhalt, farbe, schrift, rand = null) => {
      const pw = g.measureText(inhalt).width + klein * 1.4;
      const ph = klein * 1.7;
      g.fillStyle = farbe;
      g.beginPath();
      if (g.roundRect) g.roundRect(x, y, pw, ph, ph / 2);
      else g.rect(x, y, pw, ph);
      g.fill();
      if (rand) {
        g.strokeStyle = rand;
        g.lineWidth = 1.5;
        g.stroke();
      }
      g.fillStyle = schrift;
      g.fillText(inhalt, x + klein * 0.7, y + ph / 2 + 1);
      y += ph + 5;
      return pw;
    };
    // Wie viele Dinge gerade im Spiel sind, als Punkte in ihren Farben.
    const im = state.dinge.filter((d) => aktiv(d) && d.ort !== "clown");
    if (im.length) {
      const ph = klein * 1.7;
      const r = klein * 0.32;
      const pw = im.length * r * 2.6 + klein * 1.1;
      g.fillStyle = "rgba(20, 8, 18, 0.55)";
      g.beginPath();
      if (g.roundRect) g.roundRect(x, y, pw, ph, ph / 2);
      else g.rect(x, y, pw, ph);
      g.fill();
      im.forEach((d, i) => {
        g.fillStyle = d.art === "ball" ? FARBEN[d.farbe].haupt : d.art === "kugel" ? "#6b7286" : d.art === "apfel" ? "#e01e35" : d.art === "fackel" ? "#ff8a2a" : "#ffffff";
        g.beginPath();
        g.arc(x + klein * 0.55 + r + i * r * 2.6, y + ph / 2, r, 0, TAU);
        g.fill();
      });
      y += ph + 5;
    }
    if (state.serie >= 2) pille(`Perfekt ×${state.serie}`, "rgba(255, 200, 60, 0.92)", "#3a2400");
    // Die Zielmarken der Gegner (geist.js): wie viele Fänge sie hatten.
    const ziele = (gegner?.gegner?.() || []).filter((ziel) => !ziel.ziel);
    ziele.forEach((ziel) => {
      const geschafft = state.punkte > ziel.punkte;
      g.globalAlpha = geschafft ? 0.5 : 1;
      const name = ziel.art === "eigen" ? "Bestmarke" : ziel.name;
      pille(`${name} ${ziel.punkte}${geschafft ? " ✓" : ""}`, "rgba(20, 8, 18, 0.55)", ziel.farbe, ziel.farbe);
      g.globalAlpha = 1;
    });
  }

  function zeichnen() {
    if (!g) return;
    bauBilder();
    // Was im Bild steht, steht zur Zeit der Rechnung – zwischen zwei
    // Schritten weich weitergerechnet.
    const t = bildZeit();
    g.setTransform(1, 0, 0, 1, 0, 0);
    zeichneHintergrund();
    zeichneTrapeze();
    zeichneLampen();
    zeichneBlitze();
    zeichneClownLicht();
    zeichneSchatten(t);
    zeichneClown(t);
    zeichneJongleur(t);
    zeichneClownZiel();
    zeichneVorschau(t);
    zeichneDinge(t);
    zeichneFaelle();
    zeichneTeile();
    zeichneWellen();
    zeichneVorne();
    zeichneTippLicht();
    zeichneStartHinweis();
    zeichneSchriften();
    zeichneAnsage();
    if (state.glanz > 0.01 && !ruhig()) {
      flachTransform();
      g.fillStyle = `rgba(255, 235, 180, ${state.glanz * 0.12})`;
      g.fillRect(0, 0, view.cssW, view.cssH);
    }
    zeichneAnzeige();
  }

  function bildZeit() {
    if (state.phase === "spiel" && state.losMs) {
      const echt = (performance.now() - state.losMs) / (TAKT * 1000);
      return (state.tick + clamp(echt - state.tick, 0, 1)) * TAKT;
    }
    return state.tick * TAKT;
  }

  // ---------------------------------------------------------------------------
  // Was sich nur im Bild bewegt
  // ---------------------------------------------------------------------------
  // Die Hände folgen weich ihrem Ziel (eine gedämpfte Feder): Vor dem Fang
  // gehen sie dem Ding entgegen, beim Fang geben sie nach, mit dem Ding
  // schöpfen sie nach innen, beim Halten holen sie tief aus, beim Wurf
  // schnellen sie hoch.
  function haendeBewegen(dt, t) {
    const B = state.bild;
    const T = state.tick;
    [0, 1].forEach((h) => {
      const seite = h === 0 ? -1 : 1;
      const hv = B.haende[h];
      const hd = state.haende[h];
      const d = dingVon(hd.ding);
      let tx = seite * FANG_X;
      let ty = HAND_Y;
      if (state.phase === "bereit") {
        tx = seite * (FANG_X - 8);
        ty = HAND_Y + (ruhig() ? 0 : Math.sin(state.echt * 2.4 + h * 1.6) * 3);
      } else if (d) {
        const seit = t - d.fangTick * TAKT;
        const k = clamp(seit / 0.14, 0, 1);
        tx = seite * lerp(FANG_X, WURF_X + 4, glatt(k));
        ty = HAND_Y - 5 * Math.sin(k * Math.PI);
        if (d.art === "kugel") ty -= 6 * (1 - k);
        if (hd.gedrueckt && hd.druckArt === "halten" && d.art !== "kugel") {
          const u = clamp((T - hd.druckTick) / H_VOLL, 0, 1);
          hv.laden = u;
          tx = seite * (WURF_X + 2);
          ty = HAND_Y - 22 * glatt(u);
        }
      } else {
        const nachWurf = t - hv.wurf;
        if (nachWurf < 0.16) {
          tx = seite * WURF_X;
          ty = HAND_Y + 14 * (1 - nachWurf / 0.16);
        }
        const landung = naechsteLandung(h);
        if (landung !== null && landung * TAKT - t < 0.24) {
          tx = seite * FANG_X;
          ty = HAND_Y + 4;
        }
      }
      if (state.fehler) { tx = seite * 44; ty = 168; }
      // Die Feder in kleinen Schritten: Auch nach einem langen Bild schwingt
      // sie nicht auf.
      const w = 30;
      const n = Math.max(1, Math.ceil(dt / TAKT));
      const h2 = dt / n;
      for (let i = 0; i < n; i += 1) {
        hv.vx += (w * w * (tx - hv.x) - 2 * w * hv.vx) * h2;
        hv.vy += (w * w * (ty - hv.y) - 2 * w * hv.vy) * h2;
        hv.x += hv.vx * h2;
        hv.y += hv.vy * h2;
      }
    });
    // Der Körper wippt beim Fang in den Knien und lehnt sich zur fangenden
    // Hand.
    const kb = 16;
    const nb = Math.max(1, Math.ceil(dt / TAKT));
    for (let i = 0; i < nb; i += 1) {
      B.bobV += (-kb * kb * B.bob - 2 * 0.5 * kb * B.bobV) * (dt / nb);
      B.bob += B.bobV * (dt / nb);
    }
    B.lean += (B.leanZiel - B.lean) * Math.min(1, dt * 6);
    B.leanZiel *= Math.max(0, 1 - dt * 2);
    // Der Clown läuft herein, wartet mit dem Ding, wirft, winkt kurz und
    // läuft wieder hinaus.
    if (B.clownSichtbar) {
      const z = state.zugabe;
      const draussen = B.clownSeite * (view.w / 2 + 60);
      const bleibt = (z && (z.phase === "trommel" || z.phase === "warten")) || state.echt - B.clownWurf < 1.1;
      const zielX = bleibt ? B.clownSeite * clownStand() : draussen;
      B.clownX += clamp(zielX - B.clownX, -dt * 420, dt * 420);
      if (!bleibt && Math.abs(B.clownX - draussen) < 2) B.clownSichtbar = false;
    }
  }

  function effekte(dt) {
    state.echt += dt;
    let h = dt;
    if (state.lupe > 0) {
      state.lupe = Math.max(0, state.lupe - dt * 1.2);
      h = dt * lerp(1, 0.25, clamp(state.lupe * 1.5, 0, 1));
    }
    state.zeit += h;
    if (state.stoss > 0) state.stoss = Math.max(0, state.stoss - dt * 2.5);
    if (state.glanz > 0) state.glanz = Math.max(0, state.glanz - dt * 2);
    if (state.jubel > 0) state.jubel = Math.max(0, state.jubel - dt * 0.7);
    const t = bildZeit();
    haendeBewegen(dt, t);
    for (const d of state.dinge) if (d.quetsch > 0) d.quetsch = Math.max(0, d.quetsch - dt * 7);

    // Was nach dem Fehler fällt.
    for (const f of state.faelle) {
      if (f.ruhe) continue;
      f.vy -= 900 * h;
      f.x += f.vx * h;
      f.y += f.vy * h;
      f.dreh += f.w * h;
      const boden = f.tief + ART[f.art].r * 0.8;
      if (f.y < boden) {
        f.y = boden;
        if (f.vy < -80) {
          staub(f.x, f.tief + 2, 6);
          f.vy = -f.vy * 0.42;
          f.w = f.vx / 12;
        } else {
          f.vy = 0;
        }
        f.vx *= 0.82;
        if (Math.abs(f.vx) < 4 && f.vy === 0) f.ruhe = true;
      }
    }

    // Kamerablitze: im Spiel ab und zu, in der Serie und beim Jubel öfter.
    const rate = state.phase === "bereit" ? 0.6 : 0.9 + state.serie * 0.12 + state.jubel * 8 + anzahlDinge() * 0.25;
    if (!ruhig() && bilder.sitze.length && Math.random() < dt * rate) {
      const p = bilder.sitze[Math.floor(Math.random() * bilder.sitze.length)];
      state.blitze.push({ x: p.x, y: p.y, alter: 0, max: 0.14 + Math.random() * 0.08, gross: 0.6 + Math.random() * 0.6 });
    }
    for (let i = state.blitze.length - 1; i >= 0; i -= 1) {
      state.blitze[i].alter += dt;
      if (state.blitze[i].alter > state.blitze[i].max) state.blitze.splice(i, 1);
    }

    // Funken der Fackeln.
    if (!ruhig()) {
      for (const d of state.dinge) {
        if (d.art !== "fackel" || (d.ort !== "flug" && d.ort !== "hand")) continue;
        if (Math.random() > dt * 22) continue;
        const p = d.ort === "flug" ? bahnOrt(d, t) : inDerHand(d, t);
        const w = drehung(d, t);
        teil({ art: "funke", x: p.x - Math.sin(w) * 20, y: p.y + Math.cos(w) * 20, vx: (Math.random() - 0.5) * 40, vy: 30 + Math.random() * 40,
          r: 1 + Math.random() * 1.4, farbe: Math.random() < 0.5 ? "#ffb347" : "#ffe28a", leben: 0.4, max: 0.5, dreh: 0, w: 0 });
      }
    }

    for (let i = state.teile.length - 1; i >= 0; i -= 1) {
      const p = state.teile[i];
      if (p.art === "funke") p.vy -= 260 * h;
      else if (p.art === "krume") p.vy -= 500 * h;
      else if (p.art === "konfetti") {
        p.vy = Math.max(p.vy - 120 * h, -55);
        p.vx += Math.sin(p.leben * 4 + p.dreh) * 40 * h;
        p.dreh += p.w * h;
      } else if (p.art === "staub") p.vy -= 10 * h;
      if (p.art !== "konfetti") p.vx *= 1 - 1.5 * h;
      p.x += p.vx * h;
      p.y += p.vy * h;
      p.leben -= h;
      if (p.leben <= 0) state.teile.splice(i, 1);
    }
    for (let i = state.wellen.length - 1; i >= 0; i -= 1) {
      state.wellen[i].alter += h;
      if (state.wellen[i].alter > state.wellen[i].max) state.wellen.splice(i, 1);
    }
    for (let i = state.schriften.length - 1; i >= 0; i -= 1) {
      state.schriften[i].leben -= h;
      if (state.schriften[i].leben <= 0) state.schriften.splice(i, 1);
    }
  }

  function setzeZahl() {
    if (zeigen()) shell?.setCount(state.punkte);
  }

  // ---------------------------------------------------------------------------
  // Die Schleife
  // ---------------------------------------------------------------------------
  // Die Runde folgt der echten Zeit seit dem Start (losMs) in festen
  // Schritten – so passen die Züge, die mit der echten Zeit aufgezeichnet
  // werden, zur Runde. Hängt ein Bild (oder war die Seite verborgen), holt
  // sie höchstens AUFHOLEN_MAX Schritte auf; der Rest fällt weg – die Bälle
  // stehen dann einen Augenblick still, statt ungesehen zu fallen.
  function aufholen() {
    if (state.phase !== "spiel") return;
    let soll = Math.floor((performance.now() - state.losMs) / (TAKT * 1000));
    if (soll - state.tick > AUFHOLEN_MAX) {
      state.losMs += (soll - state.tick - AUFHOLEN_MAX) * TAKT * 1000;
      soll = state.tick + AUFHOLEN_MAX;
    }
    while (state.tick < soll && state.phase === "spiel") simSchritt();
  }

  function loop(now) {
    frame = window.requestAnimationFrame(loop);
    const dt = clamp((now - last) / 1000, 0, 0.05);
    last = now;
    messen();
    if (state.phase === "spiel") {
      aufholen();
      gegner?.takt(state.punkte);
    } else if (state.phase === "zuschauen") zuschauenTakt();
    effekte(dt);
    zeichnen();
  }

  // Für die Prüfskripte: ein Schritt ohne requestAnimationFrame. Die Runde
  // rückt genau um dt vor (losMs wandert mit, sonst holte die Schleife sie
  // danach auf die echte Zeit zurück).
  function takt(dt) {
    const h = clamp(Number(dt) || 0, 0, 0.05);
    if (state.phase === "spiel") {
      state.uhrRest += h;
      const n = Math.floor(state.uhrRest / TAKT + 1e-6);
      state.uhrRest = Math.max(0, state.uhrRest - n * TAKT);
      state.losMs -= n * TAKT * 1000;
      for (let i = 0; i < n && state.phase === "spiel"; i += 1) simSchritt();
      if (state.phase === "spiel") gegner?.takt(state.punkte);
    } else if (state.phase === "zuschauen") zuschauenTakt();
    effekte(h);
  }

  // ---------------------------------------------------------------------------
  // Tippen
  // ---------------------------------------------------------------------------
  // Die Runde beginnt: mit dem ersten Druck – oder im Live-Modus zum
  // gemeinsamen Start (game-shell.js, live.los).
  function losGehts() {
    if (state.phase !== "bereit") return;
    state.phase = "spiel";
    state.tick = 0;
    state.uhrRest = 0;
    state.losMs = performance.now();
    shell.setPhase("play");
    gegner?.los();
    aufnahme?.los();
    meldeZug(ZUG_START);
    kids()?.vibrate?.(8);
  }

  // Eine Hand drücken (runter) oder loslassen – vom Finger, von der Taste
  // oder aus den Prüfskripten. Der erste Druck startet die Runde und gilt
  // zugleich.
  function hand(h, runter) {
    if (state.phase === "zuschauen" || state.phase === "ende") return;
    if (state.phase === "bereit") {
      if (!runter || shell.live) return;
      losGehts();
    }
    if (state.phase !== "spiel") return;
    if (runter) {
      if (h === 0) state.bild.tippL = state.echt; else state.bild.tippR = state.echt;
    }
    eingabe(h, runter);
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
    state.losMs = 0;
    state.plan = [];
    planBis(20);
    simZuruecksetzen();
    zugProtokoll = [];
    state.fertig = false;
    state.stumm = false;
    state.tippGezeigt = false;
    state.bild = neuesBild();
    state.lupe = 0;
    state.stoss = 0;
    state.glanz = 0;
    state.jubel = 0;
    state.ansage = null;
    state.teile = [];
    state.schriften = [];
    state.wellen = [];
    state.faelle = [];
    state.blitze = [];
    gedrueckt.clear();
    tastenUnten[0].clear();
    tastenUnten[1].clear();
    shell.setCount(0);
    gegner?.runde();

    shell.clear();
    promptKnoten = shell.el("p", "cm-prompt jg-prompt", "Tipp auf eine Seite – diese Hand wirft.");
    shell.play.append(promptKnoten, buildFeld());
    view.cssW = 0;
    view.cssH = 0;
    messen();

    last = performance.now();
    frame = window.requestAnimationFrame(loop);
  }

  function grundText() {
    const f = state.fehler;
    if (!f) return "";
    if (f.art === "heiss") return "Die Fackel war zu heiss";
    if (f.art === "lange") return "Zu lange gehalten";
    return "Zusammenstoss";
  }

  // Die Zahl auf der Tafel läuft von null hoch.
  function zaehleHoch(ziel) {
    const zahl = host.querySelector(".cm-result-score");
    if (!zahl) return;
    if (ruhig() || ziel <= 1) { zahl.textContent = String(ziel); return; }
    const dauer = Math.min(800, 160 + ziel * 8);
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
    if (state.phase === "zuschauen") return;
    clearStep();
    if (state.fertig) return;
    state.fertig = true;
    state.phase = "ende";
    stopLoop();
    if (g) zeichnen();
    const punkte = state.punkte;
    const geist = aufnahme?.ende(gegner?.ende(punkte) || null) || null;
    const vorher = Number(store.read()?.scores?.[0]) || 0;
    const rekord = punkte > vorher;
    store.update((old) => ({
      runs: (Number(old.runs) || 0) + 1,
      scores: [...(old.scores || []), punkte].sort((a, b) => b - a).slice(0, TOP_COUNT),
    }));
    kids()?.playJingle?.("win");
    const teile = [grundText(), `${state.meisteDinge} Dinge`, state.besteSerie >= 3 ? `Serie ${state.besteSerie}` : "", vorher ? `Bestwert ${vorher}` : ""];
    shell.showResult({
      label: "Deine Fänge",
      points: punkte,
      detail: rekord ? "Neuer Rekord!" : teile.filter(Boolean).join(" · "),
      geist,
    });
    if (rekord) host.querySelector(".cm-result-detail")?.classList.add("jg-rekord");
    zaehleHoch(punkte);
  }

  // ---------------------------------------------------------------------------
  // Start
  // ---------------------------------------------------------------------------
  // Kein Startknopf: Der Jongleur steht mit zwei Bällen bereit, und der
  // erste Tipp wirft.
  shell = shellApi.mount({
    host,
    title: "Jongleur",
    area: "konzentration",
    accent: "#00A5B5",
    accentDark: "#00707c",
    clock: false,
    onRestart: () => (zuschauer ? zuschauenStarten() : startRun()),
    live: { los: losGehts, stopp: () => finish(), zuschauen: (quelle) => { zuschauer = quelle; zuschauenStarten(); } },
  });
  zuschauer = window.LernappGeist?.zuschauer?.({
    host, spiel: "juggler", fassung: "z1", zufall, einheit: "Fänge", zuege: true, nochmal: zuschauenStarten,
  }) || null;
  if (!zuschauer) {
    gegner = window.LernappGeist?.fuer?.({ spiel: "juggler", host, art: "ziel" }) || null;
    aufnahme = window.LernappGeist?.zuege?.({ fassung: "z1", zufall }) || null;
  }

  // --- Eingabe ---------------------------------------------------------------
  // Getippt wird auf der ganzen Bühne: die linke Hälfte für die linke Hand,
  // die rechte für die rechte – jeder Finger für sich. Eine Hand ist
  // gedrückt, solange ein Finger auf ihrer Seite liegt. Nur Knöpfe bleiben
  // Knöpfe. Vor dem Druck holt die Runde bis jetzt auf: Er gilt in dem
  // Schritt, in dem der Finger kam, nicht im letzten Bild.
  const gedrueckt = new Map();
  const tastenUnten = [new Set(), new Set()];
  const zaehle = (h) => [...gedrueckt.values()].filter((x) => x === h).length + tastenUnten[h].size;

  function seiteBei(clientX) {
    const r = host.getBoundingClientRect();
    return clientX < r.left + r.width / 2 ? 0 : 1;
  }

  host.addEventListener("pointerdown", (event) => {
    if (event.target.closest("button, a, input")) return;
    const h = seiteBei(event.clientX);
    const vorher = zaehle(h);
    gedrueckt.set(event.pointerId, h);
    if (vorher > 0) return;
    aufholen();
    hand(h, true);
  });
  const fingerWeg = (event) => {
    if (!gedrueckt.has(event.pointerId)) return;
    const h = gedrueckt.get(event.pointerId);
    gedrueckt.delete(event.pointerId);
    if (zaehle(h) > 0) return;
    aufholen();
    hand(h, false);
  };
  window.addEventListener("pointerup", fingerWeg);
  window.addEventListener("pointercancel", fingerWeg);

  // A oder Pfeil links für die linke Hand, L, D oder Pfeil rechts für die
  // rechte. Leertaste und Enter starten nur. Steht der Fokus auf einem
  // Knopf, gilt die Taste dem Knopf.
  const TASTEN_LINKS = new Set(["KeyA", "ArrowLeft"]);
  const TASTEN_RECHTS = new Set(["KeyL", "KeyD", "ArrowRight"]);
  document.addEventListener("keydown", (event) => {
    const links = TASTEN_LINKS.has(event.code) || event.key === "ArrowLeft";
    const rechts = TASTEN_RECHTS.has(event.code) || event.key === "ArrowRight";
    const start = event.key === " " || event.key === "Enter";
    if (!links && !rechts && !start) return;
    if (document.activeElement?.tagName === "BUTTON") return;
    event.preventDefault();
    if (event.repeat) return;
    if (start) {
      if (state.phase === "bereit" && !shell.live) losGehts();
      return;
    }
    const h = links ? 0 : 1;
    const vorher = zaehle(h);
    tastenUnten[h].add(event.code || event.key);
    if (vorher > 0) return;
    aufholen();
    hand(h, true);
  });
  document.addEventListener("keyup", (event) => {
    const code = event.code || event.key;
    for (const h of [0, 1]) {
      if (!tastenUnten[h].has(code)) continue;
      tastenUnten[h].delete(code);
      if (zaehle(h) > 0) continue;
      aufholen();
      hand(h, false);
    }
  });
  // Wer das Fenster verlässt, lässt alles los.
  window.addEventListener("blur", () => {
    for (const h of [0, 1]) {
      const war = zaehle(h) > 0;
      tastenUnten[h].clear();
      for (const [id, x] of [...gedrueckt]) if (x === h) gedrueckt.delete(id);
      if (war) hand(h, false);
    }
  });

  window.addEventListener("resize", messen);
  window.addEventListener("orientationchange", messen);
  window.addEventListener("pagehide", () => { clearStep(); stopLoop(); });

  startRun();
  zuschauer?.laden.then((da) => { if (da) zuschauenStarten(); });

  // Für die Prüfskripte: der Zustand, ein Schritt ohne Bild (takt), Drücken
  // und Loslassen (druecke(0|1), loslassen(0|1), tippe(0|1) – beides im
  // selben Schritt), was als Nächstes landet (naechsteLandung, ankunft) und
  // die Welt (weltText, planBis).
  window.LernappJongleur = {
    HZ, TAKT, PERFEKT_NACH, D_IDEAL, FRUEH, H_TAP, H_VOLL, DINGE_MAX, HALTEN_MAX, FACKEL_MAX,
    state, view, takt, losGehts,
    druecke: (h) => hand(h, true),
    loslassen: (h) => hand(h, false),
    tippe(h) { hand(h, true); hand(h, false); },
    naechsteLandung, ankunft, anzahlDinge, flugZeit, flugTicks, weltText, planBis, dingVon,
    zugProtokoll: () => zugProtokoll.slice(),
    // Zuschauen mit einer eigenen Quelle – wie live.zuschauen im Multiplayer.
    zuschauenMit(quelle) { zuschauer = quelle; zuschauenStarten(); },
  };
})();
