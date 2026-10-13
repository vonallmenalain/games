/*
 * schwerkraft.js – Schwerkraft-Läufer.
 * ---------------------------------------------------------------------------
 * Ein kleiner Roboter rennt durch einen Neon-Korridor, von allein und immer
 * schneller. Ein Tipp, und die Schwerkraft kehrt sich um: Er fällt an die
 * Decke und rennt dort kopfüber weiter. Noch ein Tipp, und er fällt zurück.
 *
 * Im Weg liegen Lücken, in die er ins Leere stürzt, Stacheln und Blöcke –
 * und bald auch beides zugleich:
 *
 *   Zickzack   Lücken oben und unten im Wechsel. Wer zu früh wechselt,
 *              landet im Loch auf der anderen Seite; wer zu spät wechselt,
 *              fällt in das auf seiner. Dazwischen ein schmales Fenster.
 *   Steg       Boden und Decke fehlen, in der Mitte liegt ein Steg. Vom
 *              Boden springt man unter ihn, von der Decke auf ihn – im
 *              richtigen Moment, sonst stösst man an seine Stirn.
 *   Stacheln   Später trägt eine Seite des Stegs Stacheln: Dann zählt, von
 *              wo man kommt.
 *
 * Gezählt wird, wie weit er kommt, in Metern.
 *
 * Gebaut wird der Korridor aus dem Zufall (zufall.js): ohne Turnier jedes
 * Mal ein anderer, im Turnier für alle im selben Versuch derselbe. Jedes
 * Stück ist aus der Fallzeit gerechnet: Wie weit er fliegt, bis er drüben
 * ist, folgt aus dem Tempo an dieser Stelle – das Fenster, in dem ein
 * Wechsel gelingt, wird nach hinten schmaler, nie zu.
 *
 * Die Gegner (geist.js) laufen als Läufer aus Licht mit – genau so, wie sie
 * in ihrer besten Runde gelaufen sind, durch ihren eigenen Korridor. Platz 1
 * und die eigene Bestmarke stehen dazu als Linie quer durch den Korridor.
 * Überholt wird hier niemand: Alle laufen gleich schnell. Die Schalter sagen
 * deshalb nur, wie weit die Gegner gekommen sind (gleichschritt).
 *
 * Und die besten Läufe lassen sich anschauen (?zuschauen=, geist.js): in
 * ihrem eigenen Korridor, gewürfelt mit derselben Saat.
 *
 * Gerechnet wird in Welteinheiten, zehn sind ein Meter; y zählt nach oben,
 * der Boden liegt bei 0, die Decke bei HOCH.
 */
(() => {
  "use strict";

  if (document.body.dataset.page !== "gravity") return;

  const host = document.querySelector("#sl-stage");
  const shellApi = window.LernappGameShell;
  const cloudApi = window.LernappGameCloud;
  if (!host || !shellApi) return;

  const kids = () => window.LernappKids || null;
  const ruhig = () => Boolean(kids()?.prefersReducedMotion?.());

  const zufall = window.LernappZufall?.fuer?.("gravityRun") || {
    neu() {},
    zahl: () => Math.random(),
  };

  // ---------------------------------------------------------------------------
  // Die Welt
  // ---------------------------------------------------------------------------
  const HOCH = 170;                // von Boden zu Decke
  const MITTE = HOCH / 2;          // hier liegt ein Steg …
  const DICK = 8;                  // … so dick
  const STEG_U = MITTE - DICK / 2; // seine Unterseite
  const STEG_O = MITTE + DICK / 2; // seine Oberseite
  const SICHT_H = 300;
  const WELT_W = 440;              // so viel Korridor ist mindestens zu sehen
  const WELT_W_MAX = 780;
  const LAEUFER_AN = 0.2;          // so weit vom linken Rand rennt er
  // Im Hochformat weniger Korridor, dafür gross: Der Läufer rennt weiter
  // links, damit vor ihm möglichst viel bleibt. Quer sieht man weiter.
  const WELT_W_HOCH = 290;
  const LAEUFER_AN_HOCH = 0.13;
  const METER = 10;
  const BREIT = 16;                // der Läufer: so breit …
  const GROSS = 22;                // … und so hoch
  const STACHEL = 12;              // so hoch ragen Stacheln
  const LEISTE = 14;               // so dick sind Boden und Decke
  const SCHWER = 2600;             // so stark zieht es
  const VORLAUF = 400;             // freier Korridor vor dem Start
  const START_FREI = 380;          // und danach, bevor das Erste kommt
  const TAKT = 1 / 240;

  const V0 = 270;
  const V_MAX = 560;
  const V_WEG = 700;               // Meter

  // Wie lange er fällt: von einer Seite zur anderen, vom Boden unter den
  // Steg (oder von der Decke auf ihn), und vom Steg weg.
  const fallZeit = (weg) => Math.sqrt((2 * weg) / SCHWER);
  const WECHSEL = fallZeit(HOCH - GROSS);
  const ZUM_STEG = fallZeit(STEG_U - GROSS);
  const VOM_STEG = fallZeit(STEG_O);

  const HELP = [
    "Schwerkraft-Läufer. Der Roboter rennt von allein.",
    "Tippe aufs Bild, dann kehrt sich die Schwerkraft um: Er fällt an die Decke und rennt dort weiter. Tippe noch einmal, und er fällt zurück auf den Boden.",
    "Weich den Lücken, den Stacheln und den Blöcken aus. Fehlen Boden und Decke, spring auf den Steg in der Mitte – vom Boden landest du darunter, von der Decke darauf.",
    "Es wird immer schneller. Es zählt, wie weit du kommst, in Metern.",
  ].join(" ");

  const TOP_COUNT = 5;
  const store = cloudApi
    ? cloudApi.register({ key: "lernapp.schwerkraft", empty: { runs: 0, scores: [] }, merge: cloudApi.mergeScores(TOP_COUNT) })
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
  const meterBei = (x) => Math.max(0, x / METER);
  const tempoBei = (x) => V0 + (V_MAX - V0) * (1 - Math.exp(-meterBei(x) / V_WEG));
  const schwereBei = (x) => 1 - Math.exp(-meterBei(x) / 450);
  // Was davon abhängt: die Zeit zum Reagieren auf einem freien Stück, das
  // Fenster, in dem ein Wechsel gelingt, und wie lange er mindestens steht,
  // bevor er wieder wechseln muss – alles in Sekunden.
  const reagierenBei = (k) => lerp(0.42, 0.18, k);
  const fensterBei = (k) => lerp(0.26, 0.11, k);
  const stehenBei = (k) => lerp(0.28, 0.09, k);

  function hash01(n) {
    const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return x - Math.floor(x);
  }

  // ---------------------------------------------------------------------------
  // Zustand
  // ---------------------------------------------------------------------------
  // phase:   "bereit", "spiel", "ende"
  // schritt: "start", "lauf", "aus"
  const state = {
    phase: "bereit",
    schritt: "start",
    punkte: 0,
    meter: 0,
    wechsel: 0,
    l: null,              // der Läufer (neuerLaeufer)
    drehung: 0,           // 0 am Boden, π an der Decke – dazwischen im Fall
    vorgemerkt: 0,        // ein Tipp kurz vor der Landung gilt danach
    bahnen: [[], []],     // Boden, Decke: { x0, x1, art }
    bloecke: [],          // { x0, x1, bahn, hoch }
    stege: [],            // { x0, x1, oben, unten } – "fest" oder "stachel"
    kopf: 0,
    ort: null,            // wo er am Ende des Gebauten sein muss: 0, 1 oder offen
    grund: "",
    teile: [],
    schatten: [],
    schriften: [],
    camX: 0,
    stoss: 0,
    zeit: 0,
    endeZeit: 0,
    puls: 0,
  };

  let shell = null;
  let feld = null;
  let canvas = null;
  let g = null;
  let frame = null;
  let last = 0;
  let stepTimer = null;
  let gegner = null;
  // Wer einen Lauf anschaut statt zu spielen (geist.js, zuschauer).
  let zuschauer = null;

  const view = { s: 1, dpr: 1, cssW: 0, cssH: 0, w: WELT_W, h: SICHT_H, y0: 0, an: LAEUFER_AN };

  function clearStep() {
    if (stepTimer) { window.clearTimeout(stepTimer); stepTimer = null; }
  }

  function stopLoop() {
    if (frame) { window.cancelAnimationFrame(frame); frame = null; }
  }

  // ---------------------------------------------------------------------------
  // Der Korridor
  // ---------------------------------------------------------------------------
  /*
   * Boden und Decke sind je eine Kette von Stücken: fest, Lücke oder
   * Stacheln, ohne Fuge. Dazu kommen Blöcke, die auf einem festen Stück
   * stehen, und Stege in der Mitte. Gebaut wird in Stücken, jedes mit einem
   * Anlauf davor:
   *
   *   Seitenwechsel  eine Seite versperrt (Lücke, Stacheln oder Blöcke),
   *                  die andere frei – dort muss man sein
   *   Zickzack       Lücken oben und unten im Wechsel; jeder Wechsel hat
   *                  ein Fenster: früher landet man im Loch drüben, später
   *                  fällt man in das hüben
   *   Steg           Boden und Decke fehlen, ein Steg in der Mitte trägt –
   *                  von unten oder oben, oder nur von einer Seite, wenn
   *                  die andere Stacheln hat
   *
   * Der Anlauf ist kurz, wenn der Läufer schon auf der richtigen Seite sein
   * muss, und so lang wie ein Wechsel und die Zeit zum Reagieren, wenn er
   * erst hinüber muss. So gibt es immer einen Weg.
   */
  function lege(bahn, x0, x1, art) {
    if (x1 <= x0 + 0.01) return;
    const liste = state.bahnen[bahn];
    const vor = liste[liste.length - 1];
    if (vor && vor.art === art && Math.abs(vor.x1 - x0) < 0.01) vor.x1 = x1;
    else liste.push({ x0, x1, art });
  }

  function frei(x0, x1) {
    lege(0, x0, x1, "fest");
    lege(1, x0, x1, "fest");
  }

  // Eine Seite von x0 bis x1: fest, wo eines der festen Stücke liegt, sonst
  // die Gefahr. Stacheln greifen weiter als Lücken: Wer abspringt, ist noch
  // einen Moment in ihrer Höhe, und wer ankommt, schon einen Moment vorher.
  // Die festen Stücke reichen dort also etwas weiter, damit das Fenster für
  // den Wechsel dasselbe bleibt.
  function fuelle(bahn, x0, x1, feste, gefahr, v) {
    const vorher = gefahr === "stachel" ? 8 + v * 0.012 : 0;
    const nachher = gefahr === "stachel" ? 6 + v * 0.095 : 0;
    let x = x0;
    feste.forEach(([a, b]) => {
      const von = clamp(a - vorher, x, x1);
      const bis = clamp(b + nachher, x, x1);
      if (bis <= von) return;
      lege(bahn, x, von, gefahr);
      lege(bahn, von, bis, "fest");
      x = bis;
    });
    lege(bahn, x, x1, gefahr);
  }

  const gefahrBei = (k) => (zufall.zahl() < lerp(0.15, 0.45, k) ? "stachel" : "luecke");

  function anlauf(seite, k, v) {
    const x = state.kopf;
    const hinueber = seite !== null && state.ort !== seite;
    const lang = hinueber ? v * (WECHSEL + reagierenBei(k)) + BREIT * 2 : v * reagierenBei(k) * 0.5;
    if (hinueber || state.ort === null) {
      frei(x, x + lang);
    } else {
      lege(state.ort, x, x + lang, "fest");
      lege(1 - state.ort, x, x + lang, "luecke");
    }
    state.kopf = x + lang;
  }

  function seitenwechsel(k, v) {
    const zuletzt = state.ort;
    // Meist ist gerade die Seite versperrt, auf der er ist.
    const bahn = zuletzt !== null && zufall.zahl() < lerp(0.8, 0.7, k) ? zuletzt : zufall.zahl() < 0.5 ? 0 : 1;
    const frei1 = 1 - bahn;
    anlauf(frei1, k, v);
    const x = state.kopf;
    const lang = v * lerp(0.45, 1.0, zufall.zahl()) * lerp(1, 0.8, k);
    const wahl = zufall.zahl();
    const art = wahl < 0.42 ? "luecke" : wahl < 0.72 ? "stachel" : "block";
    if (art === "block") {
      // Ein bis drei Blöcke; der letzte schliesst mit dem Stück ab.
      lege(bahn, x, x + lang, "fest");
      lege(frei1, x, x + lang, "fest");
      const anzahl = 1 + Math.floor(zufall.zahl() * 3);
      const hoch = lerp(46, 64, zufall.zahl());
      const breite = Math.min(70, lang / (anzahl * 1.6));
      for (let i = 0; i < anzahl; i += 1) {
        const bx = anzahl === 1 ? x : x + ((lang - breite) * i) / (anzahl - 1);
        state.bloecke.push({ x0: bx, x1: bx + breite, bahn, hoch });
      }
    } else {
      lege(bahn, x, x + lang, art);
      lege(frei1, x, x + lang, "fest");
    }
    state.kopf = x + lang;
    state.ort = frei1;
  }

  function zickzack(k, v) {
    const seite0 = state.ort ?? (zufall.zahl() < 0.5 ? 0 : 1);
    const anzahl = 2 + Math.floor(zufall.zahl() * lerp(2.2, 4.2, k));
    const gefahr = [gefahrBei(k), gefahrBei(k)];
    anlauf(seite0, k, v);
    const x0 = state.kopf;
    const fenster = v * fensterBei(k);
    const flug = v * WECHSEL;
    const feste = [[], []];
    let seite = seite0;
    let ab = x0;          // ab hier trägt seine Seite
    let spaet = x0;       // spätestens hier ist er gelandet
    for (let i = 0; i < anzahl; i += 1) {
      const von = spaet + v * stehenBei(k) * (0.8 + zufall.zahl() * 0.6);
      const bis = von + fenster;
      // Hüben trägt es bis zum Ende des Fensters, drüben ab der frühesten
      // Landung – wer zu spät abspringt, rennt noch ein paar Zentimeter
      // über die Kante (und darf dort noch tippen), landet also später.
      feste[seite].push([ab, bis]);
      ab = von + flug;
      spaet = bis + flug + BREIT / 2 + v * 0.08;
      seite = 1 - seite;
    }
    const ende = spaet + v * reagierenBei(k) * 0.6;
    feste[seite].push([ab, ende]);
    fuelle(0, x0, ende, feste[0], gefahr[0], v);
    fuelle(1, x0, ende, feste[1], gefahr[1], v);
    state.kopf = ende;
    state.ort = seite;
  }

  function steg(k, v) {
    const stacheln = meterBei(state.kopf) >= 250 && zufall.zahl() < lerp(0.25, 0.5, k)
      ? (zufall.zahl() < 0.5 ? "oben" : "unten")
      : null;
    // Oben Stacheln: Er muss vom Boden kommen und darunter hängen. Unten
    // Stacheln: von der Decke, und obendrauf.
    const seite = stacheln === "oben" ? 0 : stacheln === "unten" ? 1 : null;
    const gefahr = [gefahrBei(k), gefahrBei(k)];
    anlauf(seite, k, v);
    const x0 = state.kopf;
    const fenster = v * fensterBei(k) * 1.15;
    const kurz = v * ZUM_STEG;
    // Ab d0 fehlen Boden und Decke. Wer im Fenster davor abspringt, landet
    // am Steg; wer früher springt, stösst an seine Stirn oder fliegt vorbei.
    const d0 = x0 + v * stehenBei(k) * (1 + zufall.zahl() * 0.5) + fenster;
    const s0 = d0 - fenster + kurz;
    const d1 = d0 + v * lerp(0.6, 1.2, zufall.zahl()) * lerp(1, 0.9, k);
    const s1 = Math.max(d1, s0 + 60) + v * lerp(0.22, 0.08, k);
    const ende = s1 + v * (VOM_STEG + reagierenBei(k) * 0.5);
    fuelle(0, x0, ende, [[x0, d0], [d1, ende]], gefahr[0], v);
    fuelle(1, x0, ende, [[x0, d0], [d1, ende]], gefahr[1], v);
    state.stege.push({
      x0: s0, x1: s1,
      oben: stacheln === "oben" ? "stachel" : "fest",
      unten: stacheln === "unten" ? "stachel" : "fest",
    });
    state.kopf = ende;
    state.ort = null;
  }

  function naechsterAbschnitt() {
    const x = state.kopf;
    if (x < START_FREI) {
      frei(-VORLAUF, START_FREI);
      state.kopf = START_FREI;
      state.ort = null;
      return;
    }
    const k = schwereBei(x);
    const v = tempoBei(x);
    const m = meterBei(x);
    const wahl = zufall.zahl();
    const zz = m < 40 ? 0 : lerp(0.34, 0.4, k);
    const st = m < 90 ? 0 : lerp(0.24, 0.3, k);
    if (wahl < zz) zickzack(k, v);
    else if (wahl < zz + st) steg(k, v);
    else seitenwechsel(k, v);
  }

  function korridorBis(x) {
    while (state.kopf < x) naechsterAbschnitt();
  }

  // Das Stück einer Seite an einer Stelle.
  function stueckBei(bahn, x) {
    korridorBis(x + 40);
    const liste = state.bahnen[bahn];
    let lo = 0;
    let hi = liste.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (liste[mid].x0 <= x) lo = mid;
      else hi = mid - 1;
    }
    return liste[lo];
  }

  // Fester Boden unter den Füssen? Ein wenig grosszügig: Steht er mit der
  // Fussspitze noch über dem Rand, hält es.
  function traegt(bahn, x) {
    const a = stueckBei(bahn, x - BREIT / 2 + 3);
    const b = stueckBei(bahn, x + BREIT / 2 - 3);
    return a.art !== "luecke" || b.art !== "luecke";
  }

  // Was in der Nähe einer Stelle liegt: Stege und Blöcke sind nach ihrem
  // Anfang geordnet, gesucht wird von hinten.
  function nahe(liste, x, rand) {
    const raus = [];
    for (let i = liste.length - 1; i >= 0; i -= 1) {
      const d = liste[i];
      if (d.x0 > x + rand) continue;
      if (d.x0 < x - 2000) break;
      if (d.x1 >= x - rand) raus.push(d);
    }
    return raus;
  }

  // Steht er (mit der Fussspitze) auf einem Steg?
  const aufSteg = (steg, x) => x + BREIT / 2 - 3 > steg.x0 && x - BREIT / 2 + 3 < steg.x1;

  // ---------------------------------------------------------------------------
  // Die Fläche
  // ---------------------------------------------------------------------------
  function buildPlatz() {
    const platz = shell.el("div", "sl-platz");
    feld = shell.el("div", "sl-feld");
    canvas = document.createElement("canvas");
    canvas.className = "sl-canvas";
    canvas.setAttribute("aria-hidden", "true");
    feld.append(canvas);
    g = canvas.getContext("2d");

    const tipp = shell.el("span", "sl-tipp");
    tipp.setAttribute("aria-hidden", "true");
    const ns = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(ns, "svg");
    svg.setAttribute("viewBox", "0 0 64 64");
    const ring = document.createElementNS(ns, "circle");
    ring.setAttribute("cx", "32");
    ring.setAttribute("cy", "32");
    ring.setAttribute("r", "22");
    ring.setAttribute("fill", "none");
    ring.setAttribute("stroke", "#ffffff");
    ring.setAttribute("stroke-width", "4");
    ring.setAttribute("class", "sl-tipp-ring");
    const punkt = document.createElementNS(ns, "circle");
    punkt.setAttribute("cx", "32");
    punkt.setAttribute("cy", "32");
    punkt.setAttribute("r", "9");
    punkt.setAttribute("fill", "#ffffff");
    svg.append(ring, punkt);
    tipp.append(svg);
    feld.append(tipp);
    platz.append(feld);
    return platz;
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
    const hochformat = cssH > cssW * 1.05;
    view.w = hochformat ? WELT_W_HOCH : clamp(SICHT_H * (cssW / cssH), WELT_W, WELT_W_MAX);
    view.an = hochformat ? LAEUFER_AN_HOCH : LAEUFER_AN;
    view.s = cssW / view.w;
    view.h = cssH / view.s;
    // Der Korridor steht in der Mitte.
    view.y0 = HOCH / 2 - view.h / 2;
    const pw = Math.round(cssW * dpr);
    const ph = Math.round(cssH * dpr);
    if (canvas.width !== pw) canvas.width = pw;
    if (canvas.height !== ph) canvas.height = ph;
  }

  const wackel = () => (ruhig() ? 0 : Math.sin(state.zeit * 70) * 4 * state.stoss);

  function bildTransform() {
    g.setTransform(view.dpr, 0, 0, view.dpr, 0, wackel() * view.dpr);
  }

  function weltTransform() {
    const f = view.s * view.dpr;
    g.setTransform(f, 0, 0, -f, -state.camX * f, (view.cssH + view.y0 * view.s + wackel()) * view.dpr);
  }

  const bildX = (x) => (x - state.camX) * view.s;
  const bildY = (y) => view.cssH - (y - view.y0) * view.s;

  // ---------------------------------------------------------------------------
  // Zeichnen
  // ---------------------------------------------------------------------------
  const STERNE = Array.from({ length: 70 }, (_, i) => ({
    x: hash01(i * 3.1 + 1), y: hash01(i * 5.7 + 2), r: 0.4 + hash01(i * 7.3 + 3) * 1.1,
  }));

  // Der Hintergrund: ein Himmel von Violett nach Pink, die gestreifte Sonne,
  // Berge mit Neonkante und unten ein Gitter, das auf einen zuläuft.
  function zeichneHimmel() {
    bildTransform();
    const W = view.cssW;
    const H = view.cssH;
    const horizont = bildY(HOCH * 0.38);
    const verlauf = g.createLinearGradient(0, 0, 0, horizont);
    verlauf.addColorStop(0, "#0b0424");
    verlauf.addColorStop(0.55, "#3a0b5c");
    verlauf.addColorStop(1, "#c02a78");
    g.fillStyle = verlauf;
    g.fillRect(0, -10, W, horizont + 10);

    STERNE.forEach((s) => {
      const x = ((s.x * (W + 20) - state.camX * view.s * 0.04) % (W + 20) + W + 20) % (W + 20) - 10;
      const y = s.y * horizont * 0.7;
      g.globalAlpha = 0.6;
      g.fillStyle = "#ffffff";
      g.beginPath();
      g.arc(x, y, s.r, 0, Math.PI * 2);
      g.fill();
    });
    g.globalAlpha = 1;

    // Die Sonne, mit Streifen, die nach unten breiter werden.
    const sr = Math.min(W, H) * 0.22;
    const sx = W * 0.62 - ((state.camX * view.s * 0.02) % (W * 1.2));
    const sy = horizont - sr * 0.35;
    const sonnenX = ((sx % (W + sr * 4)) + W + sr * 4) % (W + sr * 4) - sr * 2;
    const glanz = g.createRadialGradient(sonnenX, sy, sr * 0.6, sonnenX, sy, sr * 1.8);
    glanz.addColorStop(0, "rgba(255, 120, 160, 0.45)");
    glanz.addColorStop(1, "rgba(255, 120, 160, 0)");
    g.fillStyle = glanz;
    g.fillRect(sonnenX - sr * 2, sy - sr * 2, sr * 4, sr * 4);
    g.save();
    g.beginPath();
    g.arc(sonnenX, sy, sr, 0, Math.PI * 2);
    g.clip();
    const sonne = g.createLinearGradient(0, sy - sr, 0, sy + sr);
    sonne.addColorStop(0, "#ffe66b");
    sonne.addColorStop(0.5, "#ff8a4c");
    sonne.addColorStop(1, "#ff3d8b");
    g.fillStyle = sonne;
    g.fillRect(sonnenX - sr, sy - sr, sr * 2, sr * 2);
    g.fillStyle = "#3a0b5c";
    for (let i = 0; i < 6; i += 1) {
      const y = sy + sr * (0.05 + i * 0.17);
      g.fillRect(sonnenX - sr, y, sr * 2, 1.5 + i * 1.6);
    }
    g.restore();

    // Berge mit Neonkante. Sie ziehen langsam vorbei, und jeder Gipfel
    // bleibt dabei an seinem Platz in dieser fernen Welt: Die Punkte des
    // Kamms gehören zu den Bergen, nicht zum Bildschirm – sonst rechnete
    // jedes Bild die Höhen an anderen Stellen neu, und der Kamm zitterte.
    const zug = state.camX * view.s * 0.08;
    const schritt = 18;
    g.fillStyle = "#1a0633";
    g.strokeStyle = "#ff4fd8";
    g.lineWidth = 1.5;
    g.beginPath();
    g.moveTo(-schritt, horizont);
    for (let i = Math.floor(zug / schritt) - 1; ; i += 1) {
      const x = i * schritt - zug;
      const wx = (i * schritt) / 70;
      const hoehe = (Math.abs(Math.sin(wx * 0.7)) * 0.6 + hash01(Math.floor(wx * 2)) * 0.4) * sr * 0.6;
      g.lineTo(x, horizont - hoehe);
      if (x > W + schritt) break;
    }
    g.lineTo(W + schritt * 2, horizont);
    g.closePath();
    g.fill();
    g.stroke();

    // Das Gitter darunter.
    const grund = g.createLinearGradient(0, horizont, 0, H);
    grund.addColorStop(0, "#22053d");
    grund.addColorStop(1, "#090114");
    g.fillStyle = grund;
    g.fillRect(0, horizont, W, H - horizont + 10);
    g.strokeStyle = "rgba(255, 79, 216, 0.5)";
    g.lineWidth = 1;
    const tiefe = H - horizont;
    const lauf = (state.camX * 0.02) % 1;
    for (let i = 0; i < 12; i += 1) {
      const k = (i + 1 - lauf) / 12;
      const y = horizont + tiefe * k * k;
      g.globalAlpha = 0.2 + k * 0.6;
      g.beginPath();
      g.moveTo(0, y);
      g.lineTo(W, y);
      g.stroke();
    }
    g.globalAlpha = 0.45;
    for (let i = -10; i <= 10; i += 1) {
      const versatz = ((state.camX * view.s * 0.3) % 60) / 60;
      const unten = W / 2 + (i - versatz) * W * 0.18;
      g.beginPath();
      g.moveTo(W / 2 + (i - versatz) * W * 0.02, horizont);
      g.lineTo(unten, H);
      g.stroke();
    }
    g.globalAlpha = 1;
  }

  // Boden und Decke: Leisten mit leuchtender Kante. Lücken bleiben offen,
  // Stacheln glühen rot.
  function zeichneKorridor() {
    const x0 = state.camX - 40;
    const x1 = state.camX + view.w + 40;
    korridorBis(x1 + 200);
    weltTransform();

    // Ein Hauch von Glas im Korridor.
    g.fillStyle = "rgba(20, 0, 40, 0.35)";
    g.fillRect(x0, 0, x1 - x0, HOCH);

    const puls = ruhig() ? 0.7 : 0.6 + 0.4 * Math.abs(Math.sin(state.puls));
    [0, 1].forEach((bahn) => {
      const flaeche = bahn === 0 ? 0 : HOCH;
      const nach = bahn === 0 ? -1 : 1;
      const farbe = bahn === 0 ? "0, 240, 255" : "255, 79, 216";
      state.bahnen[bahn].forEach((st) => {
        if (st.x1 < x0 || st.x0 > x1) return;
        const a = Math.max(st.x0, x0);
        const b = Math.min(st.x1, x1);
        if (st.art === "luecke") {
          // Das Loch: Wo die Leiste fehlt, glimmt eine rote Linie, und an
          // beiden Rändern steht eine Warnkante.
          g.strokeStyle = `rgba(255, 70, 100, ${0.35 + 0.25 * puls})`;
          g.lineWidth = 1.4 / view.s;
          g.setLineDash([6, 6]);
          g.beginPath();
          g.moveTo(a, flaeche);
          g.lineTo(b, flaeche);
          g.stroke();
          g.setLineDash([]);
          g.fillStyle = "#ff4664";
          [st.x0, st.x1].forEach((kante) => {
            if (kante < x0 || kante > x1) return;
            g.fillRect(kante - 1.5, flaeche, 3, nach * LEISTE);
          });
          return;
        }
        // Die Leiste.
        const leiste = g.createLinearGradient(0, flaeche, 0, flaeche + nach * LEISTE);
        leiste.addColorStop(0, `rgba(${farbe}, 0.55)`);
        leiste.addColorStop(1, "rgba(20, 4, 40, 0.95)");
        g.fillStyle = leiste;
        g.fillRect(a, flaeche, b - a, nach * LEISTE);
        // Fugen
        g.strokeStyle = `rgba(${farbe}, 0.25)`;
        g.lineWidth = 1 / view.s;
        for (let fx = Math.ceil(a / 40) * 40; fx < b; fx += 40) {
          g.beginPath();
          g.moveTo(fx, flaeche);
          g.lineTo(fx, flaeche + nach * LEISTE);
          g.stroke();
        }
        // Die leuchtende Kante.
        g.strokeStyle = `rgba(${farbe}, ${0.25 * puls})`;
        g.lineWidth = 6 / view.s;
        g.beginPath();
        g.moveTo(a, flaeche);
        g.lineTo(b, flaeche);
        g.stroke();
        g.strokeStyle = `rgb(${farbe})`;
        g.lineWidth = 1.8 / view.s;
        g.stroke();
        if (st.art === "stachel") {
          g.fillStyle = "#ff3355";
          g.beginPath();
          for (let sx = Math.ceil(a / 10) * 10; sx + 10 <= b + 0.01; sx += 10) {
            g.moveTo(sx, flaeche);
            g.lineTo(sx + 5, flaeche - nach * STACHEL);
            g.lineTo(sx + 10, flaeche);
          }
          g.fill();
          g.strokeStyle = `rgba(255, 120, 140, ${0.5 * puls})`;
          g.lineWidth = 1.2 / view.s;
          g.stroke();
        }
      });
    });

    // Die Stege: schmale Leisten in der Mitte, grün leuchtend, oben und
    // unten begehbar – ausser wo Stacheln stehen.
    state.stege.forEach((st) => {
      if (st.x1 < x0 || st.x0 > x1) return;
      const w = st.x1 - st.x0;
      const koerper = g.createLinearGradient(0, STEG_U, 0, STEG_O);
      koerper.addColorStop(0, "rgba(10, 60, 45, 0.95)");
      koerper.addColorStop(0.5, "rgba(30, 110, 80, 0.95)");
      koerper.addColorStop(1, "rgba(10, 60, 45, 0.95)");
      g.fillStyle = koerper;
      g.fillRect(st.x0, STEG_U, w, DICK);
      g.strokeStyle = `rgba(120, 255, 170, ${0.28 * puls})`;
      g.lineWidth = 7 / view.s;
      g.strokeRect(st.x0, STEG_U, w, DICK);
      g.strokeStyle = "#78ffaa";
      g.lineWidth = 1.8 / view.s;
      g.strokeRect(st.x0, STEG_U, w, DICK);
      // Leuchtpunkte an den Enden, damit man die Stirn sieht.
      g.fillStyle = "#eafff2";
      [st.x0 + 3, st.x1 - 3].forEach((ex) => {
        g.beginPath();
        g.arc(ex, MITTE, 1.8, 0, Math.PI * 2);
        g.fill();
      });
      [["oben", STEG_O, 1], ["unten", STEG_U, -1]].forEach(([seite, flaeche, nach]) => {
        if (st[seite] !== "stachel") return;
        g.fillStyle = "#ff3355";
        g.beginPath();
        for (let sx = st.x0 + 2; sx + 10 <= st.x1 - 2 + 0.01; sx += 10) {
          g.moveTo(sx, flaeche);
          g.lineTo(sx + 5, flaeche + nach * STACHEL);
          g.lineTo(sx + 10, flaeche);
        }
        g.fill();
        g.strokeStyle = `rgba(255, 120, 140, ${0.5 * puls})`;
        g.lineWidth = 1.2 / view.s;
        g.stroke();
      });
    });

    // Die Blöcke: dunkel, mit Neonrand und Warnstreifen.
    state.bloecke.forEach((b) => {
      if (b.x1 < x0 || b.x0 > x1) return;
      const y0 = b.bahn === 0 ? 0 : HOCH - b.hoch;
      g.fillStyle = "#1c0a33";
      g.fillRect(b.x0, y0, b.x1 - b.x0, b.hoch);
      g.save();
      g.beginPath();
      g.rect(b.x0, y0, b.x1 - b.x0, b.hoch);
      g.clip();
      g.strokeStyle = "rgba(255, 200, 60, 0.35)";
      g.lineWidth = 4;
      for (let s = -b.hoch; s < b.x1 - b.x0; s += 12) {
        g.beginPath();
        g.moveTo(b.x0 + s, y0);
        g.lineTo(b.x0 + s + b.hoch, y0 + b.hoch);
        g.stroke();
      }
      g.restore();
      g.strokeStyle = `rgba(255, 200, 60, ${0.3 * puls})`;
      g.lineWidth = 6 / view.s;
      g.strokeRect(b.x0, y0, b.x1 - b.x0, b.hoch);
      g.strokeStyle = "#ffc83c";
      g.lineWidth = 1.6 / view.s;
      g.strokeRect(b.x0, y0, b.x1 - b.x0, b.hoch);
    });
  }

  // Alle hundert Meter eine Marke; die Gegner als Linie quer hindurch.
  function zeichneMarken() {
    bildTransform();
    const gross = Math.round(clamp(view.cssH * 0.03, 10, 14));
    g.font = `800 ${gross}px system-ui, sans-serif`;
    g.textAlign = "center";
    g.textBaseline = "top";
    const von = Math.max(100, Math.ceil(meterBei(state.camX) / 100) * 100);
    for (let m = von; m <= meterBei(state.camX + view.w); m += 100) {
      const sx = bildX(m * METER);
      g.fillStyle = "rgba(0, 240, 255, 0.7)";
      g.fillText(`${m} m`, sx, bildY(0) + LEISTE * view.s + 4);
    }
    const ziele = (gegner?.gegner?.() || []).filter((ziel) => ziel.art !== "alle");
    ziele.forEach((ziel) => {
      const x = ziel.punkte * METER;
      if (x < state.camX - 20 || x > state.camX + view.w + 20) return;
      const sx = bildX(x);
      const geschlagen = state.punkte > ziel.punkte;
      g.globalAlpha = geschlagen ? 0.35 : 0.95;
      g.strokeStyle = ziel.farbe;
      g.lineWidth = 3;
      g.setLineDash([8, 6]);
      g.beginPath();
      g.moveTo(sx, bildY(HOCH));
      g.lineTo(sx, bildY(0));
      g.stroke();
      g.setLineDash([]);
      const text = ziel.art === "eigen" ? `Bestmarke ${ziel.punkte} m` : `${ziel.name} ${ziel.punkte} m`;
      g.textBaseline = "bottom";
      g.lineWidth = 3;
      g.strokeStyle = "rgba(11, 4, 36, 0.8)";
      g.strokeText(text, sx, bildY(HOCH) - LEISTE * view.s - 4);
      g.fillStyle = ziel.farbe;
      g.fillText(text, sx, bildY(HOCH) - LEISTE * view.s - 4);
      g.textBaseline = "top";
    });
    g.globalAlpha = 1;
  }

  // Die Gegner als Geist: ein Läufer aus Licht auf seinem eigenen Weg.
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
      g.globalAlpha = 0.6 * o.blass;
      g.translate(o.a, o.b + GROSS / 2);
      g.rotate((o.c || 0) / 100);
      g.fillStyle = o.farbe;
      g.beginPath();
      if (g.roundRect) g.roundRect(-BREIT / 2, -GROSS / 2 + 4, BREIT, GROSS - 4, 4);
      else g.rect(-BREIT / 2, -GROSS / 2 + 4, BREIT, GROSS - 4);
      g.fill();
      g.restore();
    });
    bildTransform();
    window.LernappGeist.namen(g, orte.map((o) => {
      const dx = o.a - state.l.x;
      const oben = (o.c || 0) > 157;
      return { ...o, sx: bildX(o.a), sy: bildY(oben ? o.b - 6 : o.b + GROSS + 6), weit: `${dx > 0 ? "+" : ""}${Math.round(dx / METER)} m` };
    }), { breit: view.cssW, hoch: view.cssH });
  }

  // Der Läufer: ein Würfel-Roboter mit leuchtendem Visier. Gezeichnet in der
  // Welt, um seine Mitte gedreht – an der Decke steht er kopf.
  function zeichneLaeufer(l, drehung, alpha = 1, nachbild = false) {
    weltTransform();
    g.save();
    g.globalAlpha = alpha;
    g.translate(l.x, l.y + GROSS / 2);
    g.rotate(drehung);
    const lauf = state.l.steht && state.schritt === "lauf" && !nachbild ? Math.sin(state.zeit * 28) : 0;
    if (nachbild) {
      g.fillStyle = state.l.richtung > 0 ? "rgba(255, 79, 216, 0.5)" : "rgba(0, 240, 255, 0.5)";
      g.fillRect(-BREIT / 2, -GROSS / 2, BREIT, GROSS);
      g.restore();
      return;
    }
    // Beine
    g.strokeStyle = "#cfd6ff";
    g.lineWidth = 2.4;
    g.lineCap = "round";
    g.beginPath();
    g.moveTo(-3.5, -GROSS / 2 + 5);
    g.lineTo(-3.5 + lauf * 3, -GROSS / 2);
    g.moveTo(3.5, -GROSS / 2 + 5);
    g.lineTo(3.5 - lauf * 3, -GROSS / 2);
    g.stroke();
    // Körper
    const k = g.createLinearGradient(-BREIT / 2, 0, BREIT / 2, 0);
    k.addColorStop(0, "#5b5fe0");
    k.addColorStop(1, "#8f7bff");
    g.fillStyle = k;
    g.beginPath();
    if (g.roundRect) g.roundRect(-BREIT / 2, -GROSS / 2 + 4, BREIT, GROSS - 4, 4);
    else g.rect(-BREIT / 2, -GROSS / 2 + 4, BREIT, GROSS - 4);
    g.fill();
    // Visier, nach vorn
    g.fillStyle = "#0b0424";
    g.fillRect(-1, 2, BREIT / 2 + 0.5, 7);
    g.fillStyle = state.l.richtung > 0 ? "#ff4fd8" : "#00f0ff";
    g.fillRect(1.5, 4, 5.5, 3);
    g.fillStyle = "rgba(255,255,255,0.8)";
    g.fillRect(5, 4.5, 1.2, 1.2);
    // Antenne
    g.strokeStyle = "#cfd6ff";
    g.lineWidth = 1.2;
    g.beginPath();
    g.moveTo(-3, GROSS / 2);
    g.lineTo(-4.5, GROSS / 2 + 4);
    g.stroke();
    g.fillStyle = state.l.richtung > 0 ? "#ff4fd8" : "#00f0ff";
    g.beginPath();
    g.arc(-4.5, GROSS / 2 + 4.5, 1.6, 0, Math.PI * 2);
    g.fill();
    g.restore();
  }

  function zeichneTeile() {
    if (!state.teile.length) return;
    weltTransform();
    state.teile.forEach((t) => {
      const k = clamp(t.leben / t.max, 0, 1);
      g.globalAlpha = k;
      g.fillStyle = t.farbe;
      g.fillRect(t.x - t.r / 2, t.y - t.r / 2, t.r, t.r);
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
      g.globalAlpha = Math.min(1, k * 2);
      g.font = `900 ${Math.round(s.gross * clamp(view.s, 0.8, 1.6))}px system-ui, sans-serif`;
      g.lineWidth = 4;
      g.strokeStyle = "rgba(11, 4, 36, 0.8)";
      g.strokeText(s.text, bildX(s.x), bildY(s.y) - (1 - k) * 24);
      g.fillStyle = s.farbe;
      g.fillText(s.text, bildX(s.x), bildY(s.y) - (1 - k) * 24);
    });
    g.globalAlpha = 1;
  }

  function zeichneAnzeige() {
    if (state.schritt === "start") return;
    bildTransform();
    const gross = clamp(view.cssH * 0.05, 14, 24);
    g.font = `900 ${Math.round(gross)}px system-ui, sans-serif`;
    g.textAlign = "left";
    g.textBaseline = "middle";
    const text = `${state.meter} m`;
    const w = g.measureText(text).width + gross * 1.1;
    g.fillStyle = "rgba(11, 4, 36, 0.6)";
    g.beginPath();
    if (g.roundRect) g.roundRect(12, 12, w, gross * 1.6, gross * 0.8);
    else g.rect(12, 12, w, gross * 1.6);
    g.fill();
    g.fillStyle = "#ffffff";
    g.fillText(text, 12 + gross * 0.55, 12 + gross * 0.82);
  }

  function zeichnen() {
    if (!g) return;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, canvas.width, canvas.height);
    zeichneHimmel();
    zeichneKorridor();
    zeichneMarken();
    state.schatten.forEach((s) => zeichneLaeufer(s, s.drehung, s.alpha, true));
    zeichneGeister();
    zeichneTeile();
    if (!(state.schritt === "aus" && state.grund !== "loch" && state.zeit - state.endeZeit > 0.1)) {
      zeichneLaeufer(state.l, state.drehung);
    }
    zeichneSchriften();
    zeichneAnzeige();
  }

  // ---------------------------------------------------------------------------
  // Teilchen und Schriften
  // ---------------------------------------------------------------------------
  function funken(x, y, farbe, anzahl, nach = 0) {
    if (ruhig()) anzahl = Math.ceil(anzahl / 3);
    for (let i = 0; i < anzahl; i += 1) {
      const w = Math.random() * Math.PI * 2;
      const v = 40 + Math.random() * 160;
      state.teile.push({
        x, y, vx: Math.cos(w) * v - 60, vy: Math.sin(w) * v + nach * 60,
        r: 1.6 + Math.random() * 2.4, farbe, leben: 0.4 + Math.random() * 0.4, max: 0.8,
      });
    }
  }

  function schrift(text, x, y, farbe, gross) {
    state.schriften.push({ text, x, y, farbe, gross, leben: 1.1, max: 1.1 });
  }

  // ---------------------------------------------------------------------------
  // Der Lauf
  // ---------------------------------------------------------------------------
  // Der Läufer als eigenes Ding, damit sich sein Weg auch vorausrechnen
  // lässt (für die Prüfskripte): wo er ist, wohin es ihn zieht, ob er steht
  // und worauf – null heisst Boden oder Decke, sonst der Steg.
  function neuerLaeufer() {
    return { x: 0, y: 0, vy: 0, richtung: -1, steht: true, auf: null, losgelassen: -1, zeit: 0 };
  }

  // Darf er jetzt umkehren? Wenn er steht – oder eben erst über eine Kante
  // gelaufen ist.
  const kannKehren = (l) => l.steht || (Math.abs(l.vy) < 200 && l.zeit - l.losgelassen < 0.08);

  function kehre(l) {
    l.richtung = -l.richtung;
    l.steht = false;
    l.auf = null;
  }

  // Ein Schritt. Gibt zurück, woran er scheitert – "loch", "stachel",
  // "block" –, sonst null.
  function bewege(l, dt) {
    l.zeit += dt;
    l.x += tempoBei(l.x) * dt;
    const r = l.richtung;
    if (l.steht) {
      const traegtNoch = l.auf ? aufSteg(l.auf, l.x) : traegt(r < 0 ? 0 : 1, l.x);
      if (!traegtNoch) {
        // Kein Boden mehr unter den Füssen: Er fällt hinaus.
        l.steht = false;
        l.auf = null;
        l.losgelassen = l.zeit;
      }
    }
    const stege = nahe(state.stege, l.x, BREIT);
    if (!l.steht) {
      const vorher = l.y;
      l.vy += r * SCHWER * dt;
      l.y += l.vy * dt;
      // Landen: auf einem Steg, wenn er von oben kommt, darunter, wenn von
      // unten – sonst am Boden oder an der Decke, wo es trägt.
      let steg = null;
      if (r < 0) {
        steg = stege.find((st) => vorher >= STEG_O - 0.01 && l.y <= STEG_O && aufSteg(st, l.x)) || null;
        if (steg) l.y = STEG_O;
      } else {
        steg = stege.find((st) => vorher + GROSS <= STEG_U + 0.01 && l.y + GROSS >= STEG_U && aufSteg(st, l.x)) || null;
        if (steg) l.y = STEG_U - GROSS;
      }
      let gelandet = Boolean(steg);
      if (!gelandet && r < 0 && l.y <= 0 && l.y > -8 && traegt(0, l.x)) {
        l.y = 0;
        gelandet = true;
      } else if (!gelandet && r > 0 && l.y + GROSS >= HOCH && l.y + GROSS < HOCH + 8 && traegt(1, l.x)) {
        l.y = HOCH - GROSS;
        gelandet = true;
      }
      if (gelandet) {
        l.vy = 0;
        l.steht = true;
        l.auf = steg;
        if (steg && (r < 0 ? steg.oben : steg.unten) === "stachel") return "stachel";
      }
      if (l.y < -70 || l.y > HOCH + 70) return "loch";
    }

    // Stacheln: auf ihnen stehen, oder in sie hineinfallen.
    const fussX0 = l.x - BREIT / 2 + 3;
    const fussX1 = l.x + BREIT / 2 - 3;
    for (const b of [0, 1]) {
      const dran = b === 0 ? l.y < STACHEL - 2 && l.y > -6 : l.y + GROSS > HOCH - STACHEL + 2 && l.y + GROSS < HOCH + 6;
      if (!dran) continue;
      if (stueckBei(b, fussX0).art === "stachel" || stueckBei(b, fussX1).art === "stachel") return "stachel";
    }
    // Die Stirn eines Stegs.
    for (const st of stege) {
      if (l.x + BREIT / 2 - 2 > st.x0 && l.x - BREIT / 2 + 2 < st.x1 && l.y + GROSS - 2 > STEG_U && l.y + 2 < STEG_O) return "block";
    }
    // Blöcke.
    for (const b of nahe(state.bloecke, l.x, BREIT)) {
      const y0 = b.bahn === 0 ? 0 : HOCH - b.hoch;
      const y1 = y0 + b.hoch;
      if (l.x + BREIT / 2 - 2 > b.x0 && l.x - BREIT / 2 + 2 < b.x1 && l.y + GROSS - 2 > y0 && l.y + 2 < y1) return "block";
    }
    return null;
  }

  function umkehren() {
    const l = state.l;
    kehre(l);
    state.wechsel += 1;
    state.puls += 0.5;
    funken(l.x, l.richtung > 0 ? l.y : l.y + GROSS, l.richtung > 0 ? "#00f0ff" : "#ff4fd8", 6, -l.richtung);
    kids()?.playJingle?.("tap");
  }

  function aus(grund) {
    if (state.schritt !== "lauf") return;
    const l = state.l;
    state.schritt = "aus";
    state.grund = grund;
    state.endeZeit = state.zeit;
    if (grund !== "loch") {
      state.stoss = 1;
      funken(l.x + BREIT / 2, l.y + GROSS / 2, "#ff3355", 22);
      funken(l.x + BREIT / 2, l.y + GROSS / 2, "#8f7bff", 16);
    } else {
      schrift("Ins Leere!", l.x + 40, HOCH / 2, "#ff7aa8", 15);
    }
    kids()?.playJingle?.("retry");
    kids()?.vibrate?.([30, 40, 60]);
    stepTimer = window.setTimeout(finish, grund === "loch" ? 900 : 1100);
  }

  function physik(dt) {
    const l = state.l;
    const stand = l.steht;
    const grund = bewege(l, dt);
    if (grund) { aus(grund); return; }
    if (!stand && l.steht) landung(l);
    // Ein Tipp kurz vor der Landung gilt jetzt.
    if (l.steht && state.vorgemerkt && l.zeit - state.vorgemerkt < 0.12) {
      state.vorgemerkt = 0;
      umkehren();
    }
  }

  function landung(l) {
    const y = l.richtung < 0 ? l.y : l.y + GROSS;
    funken(l.x, y, l.auf ? "#78ffaa" : l.richtung < 0 ? "#00f0ff" : "#ff4fd8", 5, l.richtung < 0 ? 1 : -1);
    kids()?.vibrate?.(6);
  }

  function takt(dt) {
    state.zeit += dt;
    if (state.stoss > 0) state.stoss = Math.max(0, state.stoss - dt * 2.4);
    state.puls += dt * (tempoBei(state.l.x) / 120);

    if (state.phase === "zuschauen") {
      zuschauenTakt();
    } else if (state.schritt === "lauf") {
      const n = Math.max(1, Math.ceil(dt / TAKT));
      for (let i = 0; i < n && state.schritt === "lauf"; i += 1) physik(dt / n);
      const meter = Math.floor(meterBei(state.l.x));
      if (meter !== state.meter) {
        if (Math.floor(meter / 100) > Math.floor(state.meter / 100)) {
          schrift(`${Math.floor(meter / 100) * 100} m`, state.l.x + 60, HOCH / 2, "#00f0ff", 16);
          kids()?.playJingle?.("star");
        }
        state.meter = meter;
        state.punkte = meter;
        shell.setCount(meter);
      }
    } else if (state.schritt === "start") {
      state.l.y = 0;
    } else if (state.schritt === "aus" && state.grund === "loch") {
      state.l.vy += state.l.richtung * SCHWER * dt;
      state.l.y += state.l.vy * dt;
      state.l.x += tempoBei(state.l.x) * dt * 0.5;
    }

    // Die Drehung folgt der Schwerkraft: im Fall zügig, am Boden sofort.
    // Beim Zuschauen kommt sie aus der Aufzeichnung.
    if (state.phase !== "zuschauen") {
      const ziel = state.l.richtung > 0 ? Math.PI : 0;
      const zug = state.l.steht || state.schritt !== "lauf" ? 30 : 16;
      state.drehung += (ziel - state.drehung) * (1 - Math.exp(-dt * zug));
    }

    // Nachbilder im Fall.
    if (!ruhig() && state.schritt === "lauf" && !state.l.steht) {
      state.schatten.push({ x: state.l.x, y: state.l.y, drehung: state.drehung, alpha: 0.35 });
    }
    for (let i = state.schatten.length - 1; i >= 0; i -= 1) {
      state.schatten[i].alpha -= dt * 2.2;
      if (state.schatten[i].alpha <= 0) state.schatten.splice(i, 1);
    }
    for (let i = state.teile.length - 1; i >= 0; i -= 1) {
      const t = state.teile[i];
      t.x += t.vx * dt;
      t.y += t.vy * dt;
      t.leben -= dt;
      if (t.leben <= 0) state.teile.splice(i, 1);
    }
    for (let i = state.schriften.length - 1; i >= 0; i -= 1) {
      state.schriften[i].leben -= dt;
      if (state.schriften[i].leben <= 0) state.schriften.splice(i, 1);
    }

    if (state.schritt !== "aus") state.camX = state.l.x - view.w * view.an;
    korridorBis(state.camX + view.w + 400);
    if (state.phase === "spiel") {
      gegner?.takt(state.punkte, { a: Math.round(state.l.x), b: Math.round(state.l.y), c: Math.round(state.drehung * 100) });
    }
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
  // Zuschauen
  // ---------------------------------------------------------------------------
  // Ein aufgezeichneter Lauf, in seinem eigenen Korridor: Der Zufall hält die
  // Saat (geist.js, zuschauer), startRun baut damit denselben Korridor, und
  // der Läufer steht Bild für Bild dort, wo er damals war.
  function zuschauenStarten() {
    if (!zuschauer?.lauf) return;
    startRun();
    state.phase = "zuschauen";
    state.schritt = "lauf";
    shell.setPhase("play");
    zuschauer.los();
  }

  function zuschauenTakt() {
    const s = zuschauer.stand();
    if (!s) return;
    const l = state.l;
    l.x = s.a;
    l.y = s.b;
    l.vy = s.vb;
    l.steht = Math.abs(s.vb) < 8;
    state.drehung = (s.c || 0) / 100;
    l.richtung = state.drehung > Math.PI / 2 ? 1 : -1;
    const meter = Math.max(0, Math.floor(s.punkte));
    if (meter !== state.meter) {
      state.meter = meter;
      state.punkte = meter;
      shell.setCount(meter);
    }
    zuschauer.weiter();
  }

  // ---------------------------------------------------------------------------
  // Tippen
  // ---------------------------------------------------------------------------
  // Der erste Tipp: Er rennt los – oder im Live-Modus der gemeinsame Start
  // (game-shell.js, live.los).
  function losGehts() {
    if (state.phase !== "bereit") return;
    state.phase = "spiel";
    state.schritt = "lauf";
    shell.setPhase("play");
    gegner?.los();
    kids()?.vibrate?.(8);
  }

  function tippen() {
    if (state.phase === "ende" || state.phase === "zuschauen") return;
    if (state.phase === "bereit") {
      losGehts();
      return;
    }
    if (state.schritt !== "lauf") return;
    // Am Boden, oder eben erst über eine Kante: Er kehrt um. In der Luft
    // merkt er sich den Tipp für die Landung.
    if (kannKehren(state.l)) umkehren();
    else state.vorgemerkt = state.l.zeit;
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
    state.schritt = "start";
    state.punkte = 0;
    state.meter = 0;
    state.wechsel = 0;
    state.l = neuerLaeufer();
    state.drehung = 0;
    state.vorgemerkt = 0;
    state.bahnen = [[], []];
    state.bloecke = [];
    state.stege = [];
    state.kopf = -VORLAUF;
    state.ort = null;
    state.grund = "";
    state.teile = [];
    state.schatten = [];
    state.schriften = [];
    state.stoss = 0;
    state.zeit = 0;
    state.puls = 0;
    shell.setCount(0);
    gegner?.runde();

    shell.clear();
    const prompt = shell.el("p", "cm-prompt sl-prompt", "Tippen – Schwerkraft umkehren.");
    shell.play.append(prompt, buildPlatz());
    view.cssW = 0;
    view.cssH = 0;
    messen();
    korridorBis(view.w * 3);
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
    const kmh = Math.round((tempoBei(state.l.x) / METER) * 3.6);
    shell.showResult({
      label: "Deine Meter",
      points: punkte,
      detail: rekord ? "Neuer Rekord!" : `${state.wechsel} Wechsel · ${kmh} km/h${vorher ? ` · Bestwert ${vorher} m` : ""}`,
      speech: `${punkte} Meter.${rekord ? " Das ist dein neuer Rekord!" : vorher ? ` Dein Bestwert sind ${vorher} Meter.` : ""}`,
      geist,
    });
    if (rekord) host.querySelector(".cm-result-detail")?.classList.add("sl-rekord");
    zaehleHoch(punkte);
  }

  // ---------------------------------------------------------------------------
  // Start
  // ---------------------------------------------------------------------------
  shell = shellApi.mount({
    host,
    title: "Schwerkraft-Läufer",
    area: "zahlbuchstabe",
    accent: "#E8543F",
    accentDark: "#a8321f",
    help: HELP,
    clock: false,
    onRestart: () => (zuschauer ? zuschauenStarten() : startRun()),
    live: { los: losGehts, stopp: () => finish(), zuschauen: (quelle) => { zuschauer = quelle; zuschauenStarten(); } },
  });
  zuschauer = window.LernappGeist?.zuschauer?.({
    host, spiel: "gravityRun", fassung: "t1", zufall, einheit: "m", nochmal: zuschauenStarten,
  }) || null;
  if (!zuschauer) {
    gegner = window.LernappGeist?.fuer?.({ spiel: "gravityRun", host, art: "tempo", alle: true, zufall, gleichschritt: true }) || null;
  }

  startRun();
  zuschauer?.laden.then((da) => { if (da) zuschauenStarten(); });

  host.addEventListener("pointerdown", (event) => {
    if (event.target.closest("button, a, input")) return;
    tippen();
  });

  const TASTEN = new Set([" ", "Enter", "ArrowUp", "ArrowDown"]);
  document.addEventListener("keydown", (event) => {
    if (!TASTEN.has(event.key)) return;
    if (document.activeElement?.tagName === "BUTTON") return;
    event.preventDefault();
    if (event.repeat) return;
    tippen();
  });

  window.addEventListener("resize", messen);
  window.addEventListener("orientationchange", messen);
  window.addEventListener("pagehide", () => { clearStep(); stopLoop(); });

  // Für die Prüfskripte.
  window.LernappSchwerkraft = {
    HOCH, GROSS, BREIT, WECHSEL, ZUM_STEG, METER, STEG_U, STEG_O, state, view, takt, tippen, korridorBis, stueckBei, traegt, tempoBei,
    neuerLaeufer, bewege, kehre, kannKehren, schwereBei, fensterBei,
  };
})();
