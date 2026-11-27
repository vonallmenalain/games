/*
 * polwechsel.js – Polwechsel.
 * ---------------------------------------------------------------------------
 * Ein tiefer, senkrechter Schacht. Eine Stahlkugel fällt hinunter, und die
 * Wände links und rechts sind aus Magneten: rot (Nordpol), blau (Südpol),
 * dazwischen graue, unmagnetische Platten. Die Kugel ist selbst ein Magnet,
 * rot oder blau. Eine Regel: Ein Tipp polt sie um. Ungleiche Farben ziehen
 * sich an, gleiche stossen sich ab – und so entscheidet die Polung zusammen
 * mit den Farben der Wände, wo die Kugel quer im Schacht liegt:
 *
 *   zieht eine Wand an        sie klebt an dieser Wand
 *   stösst eine Wand ab,      sie fliegt an die graue Wand gegenüber
 *     die andere ist grau
 *   stossen beide ab          sie schwebt in der Mitte
 *   ziehen beide an           sie bleibt, wo sie ist
 *   ist alles grau            ebenso
 *
 * Quer durch den Schacht stehen Sperren mit einer Lücke links, in der Mitte
 * oder rechts; an manchen Magneten sitzen Stacheln. Weil die Farben der
 * Wände den Schacht hinunter wechseln, bedeutet dieselbe Polung an jeder
 * Stelle etwas anderes: Man liest die Farben voraus und polt im richtigen
 * Moment um. Gezählt wird die Tiefe in Metern.
 *
 * Jeder achte Abschnitt ist besonders, im festen Wechsel und vorher
 * angesagt: ein Stromausfall (der 8., 24., 40. – die Magnete gehen aus, die
 * Kugel fällt gerade durch eine Gasse, und wer klug ist, stellt im Dunkeln
 * schon die Polung für danach) oder ein Wechselfeld (der 16., 32., 48. – die
 * Wände wechseln im Takt ihre Farbe, und man polt im Takt mit).
 *
 * Die Kugel fällt immer gleich schnell, was auch geschieht: Die Tiefe hängt
 * nur an der Spielzeit seit dem Loslassen (yBei), und die Polung bewegt sie
 * nur quer (querSchritt). Gebaut wird der Schacht aus dem Zufall (zufall.js),
 * ohne Turnier jedes Mal ein anderer, im Turnier für alle im selben Versuch
 * derselbe. Er ist immer zu schaffen, weil zuerst ein Weg entsteht – Reihe um
 * Reihe, in welcher Bahn die Kugel ist und wann umgepolt wird
 * (naechsterAbschnitt) – und dann die Hindernisse um ihn herum, so, dass
 * jeder Tipp bis zu «luft» zu früh oder zu spät noch gelingt. Jeder
 * Abschnitt wird nachgeprüft (sicher): alle Ecken der Luft, durch den echten
 * Schacht gerechnet.
 *
 * Ein Tipp gilt zu seiner Zeit, nicht erst im nächsten Bild (tippen, voraus).
 *
 * Das Bild: ein Schacht, der sich mit der Tiefe wandelt – vom alten Labor mit
 * Kupferspulen und Messuhren ins Bergwerk mit Grubenlampen, in eine Höhle,
 * in der Magnetit glitzert, hinunter in die glühende Magmakammer und zum
 * Kern. Die Magnete leuchten von innen und werfen ihr Licht in den Schacht,
 * zwischen Kugel und Wand stehen Feldlinien, und die Kugel aus poliertem
 * Stahl spiegelt das rote und blaue Licht. Rückwand, Wände und Magnete sind
 * vorgemalt und werden Punkt auf Punkt aufgelegt (auf dem iPhone rechnet der
 * Prozessor jede gemalte Fläche, jedes Bild).
 *
 * Die Gegner (geist.js) fallen als Kugeln aus Licht mit, und die besten Läufe
 * lassen sich anschauen (?zuschauen=): im selben Schacht, gebaut mit
 * derselben Saat.
 *
 * Zehn Einheiten sind ein Meter. x zählt quer (die Wände stehen bei −HALB
 * und +HALB), y die Tiefe, nach unten.
 */
(() => {
  "use strict";

  if (document.body.dataset.page !== "polwechsel") return;

  const host = document.querySelector("#pw-stage");
  const shellApi = window.LernappGameShell;
  const cloudApi = window.LernappGameCloud;
  if (!host || !shellApi) return;

  const kids = () => window.LernappKids || null;
  const klang = () => window.ArcadeKlang || null;
  const ruhig = () => Boolean(kids()?.prefersReducedMotion?.());

  // Der Zufall. Nur der Schacht zieht daraus – Reihen, Farben, Hindernisse.
  // Funken, Staub und was glitzert hängen an Math.random oder an festen
  // Zahlen.
  const zufall = window.LernappZufall?.fuer?.("poleSwitch") || {
    neu() {},
    zahl: () => Math.random(),
  };

  // ---------------------------------------------------------------------------
  // Die Regeln
  // ---------------------------------------------------------------------------
  const METER = 10;
  const HALB = 30;                 // halbe lichte Weite des Schachts
  const R = 6;                     // Halbmesser der Kugel
  const XW = HALB - R;             // so weit quer liegt sie an einer Wand
  const TOL = 2.5;                 // so weit neben ihrer Bahn passt sie noch durch eine Lücke
  const DICKE = 5;                 // so dick ist eine Sperre
  const STACHEL = 4.5;             // so weit ragen Stacheln in den Schacht
  const BLOCK = 7;                 // so breit ist ein Magnet in der Wand
  const TAKT = 1 / 240;
  // Die Kräfte quer. Eine Wand, die anzieht oder abstösst, wirkt mit
  // A0 + A1 · e^(−d/KD) (d: wie weit die Kugel von ihr weg ist) – je näher,
  // desto stärker. Stossen beide ab, hält sie die Mitte wie eine Feder (W);
  // wirkt nichts oder ziehen beide, bremst sie nur aus (HALT_D). Von Wand zu
  // Wand braucht sie so 0,16 s (die eine zieht, die andere stösst), 0,2 s
  // (nur eine stösst) oder 0,3 s (nur eine zieht); in die Mitte 0,24 s.
  const A0 = 1000;
  const A1 = 2600;
  const KD = 14;
  const DAEMPF = 2;
  const W = 16;
  const HALT_D = 12;
  // Das Fallen: erst anlaufen, dann V0, ab V_AB Sekunden schneller, gegen
  // V_MAX – 4,8 m/s am Start, 6,4 nach 10 s, 9,7 nach 20 s, 12 nach 30 s,
  // 17 nach einer Minute.
  const V0 = 48;
  const V_MAX = 200;
  const V_ZEIT = 36;
  const V_AB = 6;
  const ANLAUF = 0.5;
  // Die Luft: um so viele Sekunden darf jeder Tipp zu früh oder zu spät
  // kommen. Die ersten sieben Sekunden ±250 ms (und um den Weg noch mehr
  // Platz, EINSTIEG), dann rasch enger: nach 10 s ±134, nach 15 s ±81, nach
  // 20 s ±62. Ab E_SPAET Sekunden wird es noch einmal stetig enger (sonst
  // fiele ein sehr genauer Spieler minutenlang): nach 30 s ±40, nach 45 s
  // ±26, nach einer Minute ±20, ab gut 90 s nie unter ±13.
  const E0 = 0.25;
  const E_SPAET_MIN = 0.018;
  const E_ZEIT = 3;
  const E_AB = 7;
  const E_SPAET = 20;
  const E_SPAET_ZEIT = 75;
  const E_MIN = 0.013;
  const SCHWER_ZEIT = 20;          // nach so vielen Sekunden sind gut sechs Zehntel der Härte da
  const SCHWER_AB = 4;
  const EINSTIEG = 9;              // so lange ist um den Weg mehr Platz als die Luft
  const MIN_HOCH = 26;             // so hoch ist eine Reihe mindestens (und 0,3 s lang)
  const SICHT = 128;               // so weit sieht man unter die Kugel, hoch wie quer
  const KACHEL = 8;                // ein Stück Wand, auf ganze Bildpunkte gerundet
  const STURZ_MS = 1900;
  const FASSUNG = "t1";

  // Die Zonen, nach der Tiefe in Metern.
  const ZONEN = [
    { name: "Labor", ab: 0 },
    { name: "Bergwerk", ab: 70 },
    { name: "Kristallhöhle", ab: 180 },
    { name: "Magmakammer", ab: 330 },
    { name: "Glühender Kern", ab: 520 },
  ];

  const TOP_COUNT = 5;
  const store = cloudApi
    ? cloudApi.register({ key: "lernapp.polwechsel", empty: { runs: 0, scores: [] }, merge: cloudApi.mergeScores(TOP_COUNT) })
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
  const TAU = Math.PI * 2;

  // Die Tiefe nach der Zeit, geschlossen gerechnet: Sie hängt nur an der
  // Zeit, nie an der Länge der Rechenschritte.
  const Y_ANLAUF = (V0 * ANLAUF) / 2;
  const Y_AB = Y_ANLAUF + V0 * (V_AB - ANLAUF);
  function yBei(t) {
    if (t <= 0) return 0;
    if (t < ANLAUF) return (V0 * t * t) / (2 * ANLAUF);
    if (t < V_AB) return Y_ANLAUF + V0 * (t - ANLAUF);
    const u = t - V_AB;
    return Y_AB + V_MAX * u - (V_MAX - V0) * V_ZEIT * (1 - Math.exp(-u / V_ZEIT));
  }
  function tempoBei(t) {
    if (t <= 0) return 0;
    if (t < ANLAUF) return (V0 * t) / ANLAUF;
    if (t < V_AB) return V0;
    return V_MAX - (V_MAX - V0) * Math.exp(-(t - V_AB) / V_ZEIT);
  }
  // Und umgekehrt: wann sie in der Tiefe y ist.
  function tBei(y) {
    if (y <= 0) return 0;
    if (y < Y_ANLAUF) return Math.sqrt((2 * ANLAUF * y) / V0);
    if (y < Y_AB) return ANLAUF + (y - Y_ANLAUF) / V0;
    let t = V_AB + (y - Y_AB) / V0;
    for (let i = 0; i < 8; i += 1) t -= (yBei(t) - y) / tempoBei(t);
    return t;
  }
  const luftBei = (t) => {
    const basis = E_SPAET_MIN + (E0 - E_SPAET_MIN) / (1 + Math.max(0, t - E_AB) / E_ZEIT);
    return Math.max(E_MIN, basis / (1 + Math.max(0, t - E_SPAET) / E_SPAET_ZEIT));
  };
  const schwere = (t) => 1 - Math.exp(-Math.max(0, t - SCHWER_AB) / SCHWER_ZEIT);
  const zoneBei = (y) => {
    const m = y / METER;
    let z = 0;
    for (let i = 1; i < ZONEN.length; i += 1) if (m >= ZONEN[i].ab) z = i;
    return z;
  };

  function hash01(n) {
    const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return x - Math.floor(x);
  }

  // Ein fester Zufall für das Bild: Die Wände sehen jedes Mal gleich aus.
  function wuerfel(saat) {
    let a = saat >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const mix3 = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
  const rgb = (c) => `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`;
  const rgba = (c, alpha) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${alpha})`;

  // ---------------------------------------------------------------------------
  // Zustand
  // ---------------------------------------------------------------------------
  // phase:   "bereit" (sie hängt noch), "spiel", "zuschauen", "ende"
  // schritt: "start", "fall", "sturz"
  const state = {
    phase: "bereit",
    schritt: "start",
    punkte: 0,
    t: 0,                    // die Spielzeit seit dem Loslassen
    zeit: 0,                 // die Uhr des Bildes
    // Die Kugel: quer x (und wie schnell), die Tiefe y, die Polung p (1 rot,
    // −1 blau), puls nach dem Umpolen, an welcher Wand sie liegt (kontakt).
    kugel: { x: 0, v: 0, y: 0, p: 1, puls: 0, kontakt: 0 },
    umpolungen: 0,
    knappe: 0,
    reihen: [],
    sperren: [],
    stacheln: [],
    weg: [],
    abschnitte: [],
    plan: null,
    planFehler: 0,
    zone: 0,
    sturz: null,
    teile: [],
    schriften: [],
    ansage: null,
    angesagt: -1,
    camY: 0,
    stoss: 0,
    flimmern: 0,
    strom: 1,                // beim ersten Start gehen die Magnete von oben nach unten an
    stromAus: false,
    letzterTakt: -1,
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
  let brummen = null;
  let wind = null;
  let tippRinge = null;
  let ersterStart = true;

  const view = { s: 1, dpr: 1, cssW: 0, cssH: 0, frei: 0, kugelY: 200, mitteX: 200 };

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
    brummen = klang()?.kulisse("polwechsel.brummen", { laut: 0 }) || null;
    wind = klang()?.kulisse("polwechsel.wind", { laut: 0 }) || null;
  }

  // Das Brummen folgt dem Feld um die Kugel, der Wind dem Tempo.
  function klangStellen() {
    const k = state.kugel;
    const faellt = state.schritt === "fall" && state.t > 0;
    const r = faellt ? reiheBei(state.t) : null;
    let feldKraft = 0;
    if (r) {
      const cl = farbe(r, -1, state.t);
      const cr = farbe(r, 1, state.t);
      if (cl) feldKraft += 0.5 + 0.5 * Math.exp(-(k.x + XW) / 18);
      if (cr) feldKraft += 0.5 + 0.5 * Math.exp(-(XW - k.x) / 18);
    }
    brummen?.setze(clamp(0.25 + feldKraft * 0.35, 0, 1));
    brummen?.laut(faellt ? clamp(feldKraft * 0.45, 0, 0.55) : 0);
    wind?.setze(clamp(tempoBei(state.t) / V_MAX, 0.15, 1));
    wind?.laut(faellt ? 0.35 + 0.3 * tempoBei(state.t) / V_MAX : 0);
  }

  function klangAus() {
    brummen?.stop();
    wind?.stop();
    brummen = null;
    wind = null;
  }

  // ---------------------------------------------------------------------------
  // Die Regel und die Bewegung quer
  // ---------------------------------------------------------------------------
  // Farben: 1 rot (Nordpol), −1 blau (Südpol), 0 grau. Wohin die Kugel mit
  // der Polung p will: −1 an die linke Wand, 1 an die rechte, 0 in die
  // Mitte, null: bleibt, wo sie ist.
  function zielBahn(cl, cr, p) {
    const zL = cl !== 0 && cl !== p;
    const zR = cr !== 0 && cr !== p;
    const sL = cl !== 0 && cl === p;
    const sR = cr !== 0 && cr === p;
    if (zL && zR) return null;
    if (zL) return -1;
    if (zR) return 1;
    if (sL && sR) return 0;
    if (sL) return 1;
    if (sR) return -1;
    return null;
  }
  const kraft = (d) => A0 + A1 * Math.exp(-d / KD);

  // Ein Schritt quer. Zurück: wie schnell sie an eine Wand schlug (oder 0).
  function querSchritt(k, cl, cr, h) {
    const z = zielBahn(cl, cr, k.p);
    let a;
    if (z === null) a = -HALT_D * k.v;
    else if (z === 0) a = -W * W * k.x - 2 * W * k.v;
    else {
      const zieht = z < 0 ? cl !== 0 && cl !== k.p : cr !== 0 && cr !== k.p;
      const stoesst = z < 0 ? cr !== 0 && cr === k.p : cl !== 0 && cl === k.p;
      a = z * ((zieht ? kraft(Math.abs(z * XW - k.x)) : 0) + (stoesst ? kraft(Math.abs(z * XW + k.x)) : 0)) - DAEMPF * k.v;
    }
    k.v += a * h;
    k.x += k.v * h;
    let stoss = 0;
    if (k.x < -XW) { k.x = -XW; if (k.v < 0) { stoss = -k.v; k.v = 0; } }
    if (k.x > XW) { k.x = XW; if (k.v > 0) { stoss = k.v; k.v = 0; } }
    return stoss;
  }

  // ---------------------------------------------------------------------------
  // Der Schacht: Reihen und Hindernisse
  // ---------------------------------------------------------------------------
  /*
   * Eine Reihe ist ein Stück Schacht mit einem Magneten links und einem
   * rechts (cl, cr), von der Zeit t0 bis t1 – die Kugel fällt ja immer gleich
   * schnell, also ist eine Zeit zugleich eine Tiefe (y0, y1). Besondere
   * Reihen:
   *
   *   aus       Stromausfall: beide Wände grau.
   *   wechsel   Wechselfeld: ab w0 wechseln beide Wände alle P Sekunden ihre
   *             Farbe, wn Mal.
   *
   * Die Hindernisse:
   *
   *   sperre    Eine Platte quer durch den Schacht, DICKE hoch, mit einer
   *             Lücke links, in der Mitte oder rechts (luecke −1, 0, 1).
   *   stachel   Stacheln an einem Magneten, von y0 bis y1: Wer dort an der
   *             Wand liegt, ist hin.
   */
  function farbe(r, seite, t) {
    if (r.art === "aus") return 0;
    let c = seite < 0 ? r.cl : r.cr;
    if (r.art === "wechsel" && t >= r.w0) {
      const n = Math.min(r.wn, Math.floor((t - r.w0) / r.P) + 1);
      if (n % 2 === 1) c = -c;
    }
    return c;
  }

  // Die Reihe zur Zeit t (die Reihen schliessen lückenlos aneinander).
  let reiheHint = 0;
  function reiheBei(t) {
    const l = state.reihen;
    let i = clamp(reiheHint, 0, l.length - 1);
    while (i > 0 && t < l[i].t0) i -= 1;
    while (i < l.length - 1 && t >= l[i].t1) i += 1;
    reiheHint = i;
    return l[i];
  }

  function plattenFuer(luecke) {
    if (luecke === -1) return [[-XW + R + TOL, HALB]];
    if (luecke === 1) return [[-HALB, XW - R - TOL]];
    return [[-HALB, -R - TOL], [R + TOL, HALB]];
  }

  // Eine Sperre, die die Kugel ab der Zeit t0 berührt (ihre Unterkante an
  // der Oberkante der Platte).
  function sperreBei(t0, luecke, nr) {
    const y0 = yBei(t0) + R;
    const y1 = y0 + DICKE;
    return { art: "sperre", y0, y1, t0, t1: tBei(y1 + R), luecke, platten: plattenFuer(luecke), nr };
  }

  function trifftSperre(s, x, y) {
    if (y + R <= s.y0 || y - R >= s.y1) return false;
    const r2 = (R - 0.4) * (R - 0.4);
    for (const [a, b] of s.platten) {
      const dx = clamp(x, a, b) - x;
      const dy = clamp(y, s.y0, s.y1) - y;
      if (dx * dx + dy * dy < r2) return true;
    }
    return false;
  }
  function trifftStachel(st, x, y) {
    if (y + R - 1 <= st.y0 || y - R + 1 >= st.y1) return false;
    return st.seite < 0 ? x - R < -HALB + STACHEL - 0.8 : x + R > HALB - STACHEL + 0.8;
  }
  // Was die Kugel bei (x, y) trifft.
  function trifft(x, y) {
    const sp = state.sperren;
    for (let i = indexAb(sp, y - R - DICKE - 1); i < sp.length && sp[i].y0 < y + R; i += 1) {
      if (trifftSperre(sp[i], x, y)) return sp[i];
    }
    const st = state.stacheln;
    for (let i = indexAb(st, y - 600); i < st.length; i += 1) {
      if (st[i].y0 > y + R) break;
      if (trifftStachel(st[i], x, y)) return st[i];
    }
    return null;
  }
  // Der erste Eintrag einer nach y0 sortierten Liste, der bei y oder tiefer beginnt.
  function indexAb(liste, y) {
    let lo = 0;
    let hi = liste.length;
    while (lo < hi) {
      const m = (lo + hi) >> 1;
      if (liste[m].y0 < y) lo = m + 1; else hi = m;
    }
    return lo;
  }
  // Wie knapp sie an einer Sperre vorbei ist (quer, in Einheiten).
  function abstandSperre(s, x) {
    let nah = Infinity;
    for (const [a, b] of s.platten) {
      if (x < a) nah = Math.min(nah, a - x - R);
      else if (x > b) nah = Math.min(nah, x - b - R);
      else nah = 0;
    }
    return nah;
  }

  // ---------------------------------------------------------------------------
  // Der Schacht: der Weg, Abschnitt um Abschnitt
  // ---------------------------------------------------------------------------
  /*
   * Ein Abschnitt beginnt, wenn die Kugel in ihrer Bahn angekommen ist (T).
   * In ihrer Reihe kommt zuerst ein Hindernis, das genau diese Bahn frei
   * lässt – eine Sperre, zwei kurz hintereinander (die Zange) oder Stacheln
   * an den anderen Wänden –, dann die Grenze zur nächsten Reihe. Deren
   * Farben und die Polung danach geben die neue Bahn; ist die Polung eine
   * andere, ist dort ein Tipp geplant, genau an der Grenze.
   *
   * Die Grenze liegt so, dass die Kugel ihre Bahn erst verlässt, wenn sie am
   * Hindernis vorbei ist – auch wer um die ganze Luft zu früh tippt. Und das
   * nächste Hindernis kommt erst, wenn sie in der neuen Bahn ist – auch wer
   * um die ganze Luft zu spät tippt. Wie sie sich bei einem Tipp zu früh, zur
   * Zeit oder zu spät bewegt, wird genau nachgerechnet (uebergangAb), von der
   * Kugel aus, wie sie nach dem Plan gerade ist. Am Anfang (EINSTIEG) bleibt
   * um den Weg noch etwas mehr Platz.
   *
   * Die Lagen kommen nach und nach: zuerst nur Wände in zwei Farben (dann
   * geht es nach links oder rechts), ab dem fünften Abschnitt gleiche Farben
   * (die Mitte), ab dem neunten graue Wände, später auch Reihen, in denen
   * beide Wände ziehen und sie bleibt, wo sie ist.
   *
   * Immer gleich viele Zahlen ziehen, was auch geschieht: Der Schacht soll an
   * der Saat hängen, nicht an den Zweigen dieser Funktion.
   */
  const GEGEN = [[1, -1], [-1, 1]];
  const GLEICH = [[1, 1], [-1, -1]];
  const HALB_GRAU = [[1, 0], [-1, 0], [0, 1], [0, -1]];

  function waehle(gewichte, z) {
    let summe = 0;
    gewichte.forEach(([, w]) => { summe += w; });
    let r = z * summe;
    for (const [name, w] of gewichte) { r -= w; if (r < 0) return name; }
    return gewichte[gewichte.length - 1][0];
  }

  function neueReihe(t0, cfg) {
    const r = { t0, t1: Infinity, y0: yBei(t0), y1: Infinity, cl: cfg.cl, cr: cfg.cr, art: cfg.art || "", nr: state.reihen.length };
    if (cfg.art === "wechsel") { r.w0 = cfg.w0; r.P = cfg.P; r.wn = cfg.wn; }
    state.reihen.push(r);
    return r;
  }
  function schliesseReihe(t1) {
    const r = state.reihen[state.reihen.length - 1];
    r.t1 = t1;
    r.y1 = yBei(t1);
  }

  // Eine Reihe ist mindestens 0,3 s lang und gut zwei Kugeln hoch.
  const minReihe = (t0) => Math.max(t0 + 0.3, tBei(yBei(t0) + MIN_HOCH));
  // Wie lange die Kugel an einer Sperre vorbei braucht, die sie ab t0 berührt.
  const vorbei = (t0) => tBei(yBei(t0) + 2 * R + DICKE) - t0;

  // Wie die Kugel von Reihe a in Reihe b kommt, ganz für sich: die Grenze bei
  // 0, getippt bei delta (oder nicht), vorher ruht sie in ihrer Bahn. Zurück:
  // wann sie ihre Bahn frühestens verlässt (weg), wann sie spätestens in der
  // neuen angekommen ist (an) und wann sie dort ruht (ruhe).
  // Die Zeitpunkte, zu denen ein Tipp in der Luft e kommen darf: dicht,
  // denn wie lange sie unterwegs ist, wächst nicht immer mit dem Abstand
  // (wer ganz früh tippt, schlägt vielleicht drüben an und kehrt früher
  // um als einer, der etwas später tippt).
  function tippZeiten(e0) {
    const e = e0 + 0.0015;
    const n = Math.min(40, Math.max(8, Math.ceil((2 * e) / 0.005)));
    return Array.from({ length: n + 1 }, (_, i) => -e + (2 * e * i) / n);
  }

  function uebergang(a, b, p, bahn, nach, tippen, e0) {
    const deltas = tippen ? tippZeiten(e0) : [null];
    let weg = Infinity;
    let an = -Infinity;
    let ruhe = -Infinity;
    for (const d of deltas) {
      const k = { x: bahn * XW, v: 0, p };
      let t = -0.6;
      let w = Infinity;
      let nichtDa = -0.6;
      let unruhig = -0.6;
      let getippt = d === null;
      while (t < 1.4) {
        // Ein Tipp gilt genau zu seiner Zeit, wie im Spiel: Der Schritt wird
        // dort geteilt.
        let h = TAKT;
        if (!getippt && d < t + h) {
          if (d - t > 1e-9) h = d - t;
          else { k.p = -k.p; getippt = true; continue; }
        }
        const c = t < 0 ? a : b;
        querSchritt(k, farbe(c, -1, t), farbe(c, 1, t), h);
        t += h;
        if (w === Infinity && Math.abs(k.x - bahn * XW) > TOL) w = t;
        if (Math.abs(k.x - nach * XW) > TOL) nichtDa = t;
        if (Math.abs(k.x - nach * XW) > 0.8 || Math.abs(k.v) > 8) unruhig = t;
      }
      if (nichtDa > 1.3 || unruhig > 1.3) return null;
      weg = Math.min(weg, w);
      an = Math.max(an, nichtDa);
      ruhe = Math.max(ruhe, unruhig);
    }
    return { weg, an, ruhe };
  }

  // Dasselbe genau: von der Kugel, wie sie nach dem Plan ist (start), durch
  // die Reihen bis zur Grenze tb und dann b, getippt bei tb + delta.
  function uebergangAb(start, b, tb, bahn, nach, tippen, e0) {
    const deltas = tippen ? tippZeiten(e0) : [null];
    let weg = Infinity;
    let an = -Infinity;
    let ruhe = -Infinity;
    for (const d of deltas) {
      const k = { x: start.x, v: start.v, p: start.p };
      let t = start.t;
      let w = Infinity;
      let nichtDa = start.t;
      let unruhig = start.t;
      let getippt = d === null;
      while (t < tb + 1.4) {
        let h = TAKT;
        if (!getippt && tb + d < t + h) {
          if (tb + d - t > 1e-9) h = tb + d - t;
          else { k.p = -k.p; getippt = true; continue; }
        }
        let cl;
        let cr;
        if (t < tb) { const r = reiheBei(t); cl = farbe(r, -1, t); cr = farbe(r, 1, t); } else { cl = farbe(b, -1, t); cr = farbe(b, 1, t); }
        querSchritt(k, cl, cr, h);
        t += h;
        if (w === Infinity && Math.abs(k.x - bahn * XW) > TOL) w = t;
        if (Math.abs(k.x - nach * XW) > TOL) nichtDa = t;
        if (Math.abs(k.x - nach * XW) > 0.8 || Math.abs(k.v) > 8) unruhig = t;
      }
      if (nichtDa > tb + 1.3 || unruhig > tb + 1.3) return null;
      weg = Math.min(weg, w);
      an = Math.max(an, nichtDa);
      ruhe = Math.max(ruhe, unruhig);
    }
    return { weg, an, ruhe };
  }

  function naechsterAbschnitt() {
    const n = state.abschnitte.length + 1;
    const z = [];
    for (let i = 0; i < 16; i += 1) z.push(zufall.zahl());
    const pl = state.plan;
    const T = pl.t;
    const k0 = schwere(T);
    const e0 = luftBei(T);
    const besonders = n % 8 === 0 ? ((n / 8) % 2 === 1 ? "aus" : "wechsel") : "";
    const reihe = state.reihen[state.reihen.length - 1];
    const vorher = {
      sperren: state.sperren.length, stacheln: state.stacheln.length, weg: state.weg.length, reihen: state.reihen.length, reihe: { ...reihe },
    };

    let lageArt = "";
    const versuch = (mass, einfach) => {
      lageArt = besonders && !einfach ? besonders : "";
      const k = k0 / mass;
      const e = e0 * mass;
      const neuS = [];
      const neuSt = [];
      const neuW = [];
      const neuR = [];
      let tEnde;
      let ende;
      const sanft = Math.max(0, 1 - T / EINSTIEG);
      const slackA = ((0.2 + 0.16 * z[1]) * sanft + 0.01) * mass + 0.05 * (mass - 1);
      const slackB = ((0.14 + 0.1 * z[2]) * sanft + 0.01) * mass + 0.05 * (mass - 1);
      if (besonders === "aus" && !einfach) {
        // Stromausfall: eine gerade Gasse in der Bahn, in der sie ist –
        // drei Sperren mit der Lücke, wo sie ist.
        const bahn = pl.bahn;
        const t0 = Math.max(T + slackA + 0.25, minReihe(reihe.t0));
        const dauer = lerp(2.4, 1.7, k);
        for (let i = 0; i < 3; i += 1) neuS.push(sperreBei(t0 + 0.35 + (i * (dauer - 0.9)) / 2, bahn, n));
        // Danach ist der Strom wieder da, und wohin es geht, entscheidet die
        // Polung, die man im Dunkeln gestellt hat. Der geplante Tipp liegt
        // im Dunkeln; die Luft reicht fast über die ganze Gasse.
        const cl = z[3] < 0.5 ? 1 : -1;
        const cfg = { cl, cr: -cl };
        const pNeu = z[4] < 0.6 ? -pl.p : pl.p;
        const nach = zielBahn(cfg.cl, cfg.cr, pNeu);
        const tAn = t0 + dauer;
        if (pNeu !== pl.p) neuW.push({ t: t0 + dauer * 0.55, e: Math.min(dauer * 0.4, 0.7), nr: n, aus: true });
        const ue = uebergang({ cl: 0, cr: 0 }, cfg, pNeu, bahn, nach, false, 0);
        if (!ue) return null;
        neuR.push({ t: t0, cfg: { cl: 0, cr: 0, art: "aus" } }, { t: tAn, cfg });
        tEnde = tAn + Math.max(0.004, ue.an) + 0.004;
        ende = { bahn: nach, p: pNeu, ruhe: tAn + Math.max(0.01, ue.ruhe) + 0.01 };
      } else if (besonders === "wechsel" && !einfach) {
        // Wechselfeld: Die Wände wechseln im Takt die Farbe. Es beginnt so,
        // dass sie mit ihrer Polung bleibt, wo sie ist (an einer Wand).
        if (pl.bahn === 0) return null;
        const bahn = pl.bahn;
        const cfg = { cl: bahn < 0 ? -pl.p : pl.p, cr: 0, art: "wechsel" };
        cfg.cr = -cfg.cl;
        const t0 = Math.max(T + slackA * 0.5 + 0.05, minReihe(reihe.t0));
        // Ein Wechsel mit Tipp hält sie in ihrer Bahn; einer ohne trägt sie
        // hinüber (von Wand zu Wand).
        const a = { cl: cfg.cl, cr: cfg.cr };
        const b = { cl: -cfg.cl, cr: -cfg.cr };
        const ue = uebergang(a, b, pl.p, bahn, bahn, true, e);
        const ueOhne = uebergang(a, b, pl.p, bahn, -bahn, false, 0);
        if (!ue || !ueOhne) return null;
        // Ab dem zweiten Wechselfeld gemischt: Manche Takte ohne Tipp.
        const zweite = state.abschnitte.some((x) => x.besonders === "wechsel");
        const pass = vorbei(t0 + 1);
        const wegMin = Math.min(ue.weg, ueOhne.weg);
        const breit = Math.max(ue.an, ueOhne.an) - wegMin + pass + lerp(0.1, 0.02, k) * mass;
        const P = Math.round(Math.max(breit, lerp(0.6, 0.4, k)) * 100) / 100;
        const wn = zweite ? 5 : 4;
        cfg.w0 = t0 + P;
        cfg.P = P;
        cfg.wn = wn;
        neuR.push({ t: t0, cfg });
        let b0 = bahn;
        let p0 = pl.p;
        // Vor dem ersten Wechsel eine Sperre in der Bahn, dann eine nach jedem.
        neuS.push(sperreBei(t0 + (P - pass) / 2 - 0.02, b0, n));
        for (let i = 0; i < wn; i += 1) {
          const tw = cfg.w0 + i * P;
          const halten = !zweite || z[5 + i] < 0.6;
          if (halten) { neuW.push({ t: tw, e, nr: n, wechsel: true }); p0 = -p0; } else b0 = -b0;
          const u = halten ? ue : ueOhne;
          neuS.push(sperreBei(tw + (u.an + P + wegMin) / 2 - pass / 2, b0, n));
        }
        const tAus = cfg.w0 + (wn - 1) * P + P * 0.92;
        // Danach eine gewöhnliche Reihe in den Farben des letzten Takts.
        const fl = farbe(cfg, -1, tAus);
        neuR.push({ t: tAus, cfg: { cl: fl, cr: -fl } });
        tEnde = tAus + 0.05;
        ende = { bahn: b0, p: p0, ruhe: tAus + 0.05 };
      } else {
        // Ein gewöhnlicher Abschnitt: was in dieser Reihe steht, dann die
        // nächste Reihe.
        const bahn = pl.bahn;
        let art = "sperre";
        if (!einfach && n >= 4) art = waehle([["sperre", 3], ["stachel", lerp(1.1, 0.5, k)], ["zange", n >= 10 ? lerp(0.4, 1.8, k) : 0]], z[3]);
        lageArt = art;
        let tFrei;
        // Die erste Sperre kommt nicht gleich nach dem Loslassen: Erst sieht
        // man die Kugel an die Wand fliegen.
        const o0 = T + slackA + (n === 1 ? 0.6 : 0);
        if (art === "sperre") {
          neuS.push(sperreBei(o0, bahn, n));
          tFrei = neuS[0].t1;
        } else if (art === "zange") {
          // Gleich nach der Ankunft eine Sperre, kurz danach die zweite.
          neuS.push(sperreBei(T + 0.02, bahn, n));
          const t2 = Math.max(neuS[0].t1 + slackA, T + 0.02 + vorbei(T) + 0.05);
          neuS.push(sperreBei(t2, bahn, n));
          tFrei = neuS[1].t1;
        } else {
          // Stacheln an den Wänden, an denen sie nicht ist.
          const lang = lerp(0.55, 0.35, k) + 0.3 * z[4];
          const y0 = yBei(o0) + R - 1;
          const y1 = yBei(o0 + lang) - R + 1;
          [-1, 1].forEach((s) => { if (s !== bahn) neuSt.push({ art: "stachel", seite: s, y0, y1, nr: n }); });
          tFrei = o0 + lang;
        }
        // Die nächste Reihe. Vor einem Wechselfeld an eine Wand (dort
        // beginnt es).
        let wahl = "gegen";
        if (!einfach && n >= 4) {
          const vorWechsel = (n + 1) % 16 === 0;
          wahl = waehle([
            ["gegen", 3],
            ["gleich", n >= 5 && !vorWechsel ? lerp(0.8, 1.3, k) : 0],
            ["halbgrau", n >= 9 ? lerp(0.6, 1.4, k) : 0],
            ["grau", n >= 14 && !vorWechsel ? 0.25 : 0],
          ], z[5]);
        }
        let paar;
        if (n === 1) paar = [1, -1];
        else if (wahl === "gegen") paar = GEGEN[z[6] < 0.5 ? 0 : 1];
        else if (wahl === "gleich") paar = GLEICH[z[6] < 0.5 ? 0 : 1];
        else if (wahl === "halbgrau") paar = HALB_GRAU[Math.floor(z[6] * 4) % 4];
        else paar = [0, 0];
        const cfg = { cl: paar[0], cr: paar[1] };
        // Die Polung danach: ein Tipp oder nicht. Der erste Abschnitt will
        // einen, der zweite keinen.
        const pTipp = n === 1 ? 1 : n === 2 ? 0 : lerp(0.62, 0.85, k);
        let pNeu = z[7] < pTipp ? -pl.p : pl.p;
        let nach = zielBahn(cfg.cl, cfg.cr, pNeu);
        if (nach === null) {
          // Beide ziehen (oder alles grau): Sie bleibt, wo sie ist. Im Plan
          // nur an einer Wand, und erst später; sonst die andere Polung.
          const bleiben = bahn !== 0 && (wahl === "grau" || n >= 12) && z[8] < 0.5;
          if (bleiben) nach = bahn;
          else {
            pNeu = -pNeu;
            nach = zielBahn(cfg.cl, cfg.cr, pNeu);
            if (nach === null) { if (bahn === 0) return null; nach = bahn; }
          }
        }
        const tippen = pNeu !== pl.p;
        const ue = uebergang({ cl: reihe.cl, cr: reihe.cr }, cfg, pl.p, bahn, nach, tippen, e);
        if (!ue) return null;
        // Die Grenze: Frühestens verlässt sie ihre Bahn, wenn sie am
        // Hindernis vorbei ist.
        let tb = tFrei + slackB - (ue.weg === Infinity ? 0 : ue.weg);
        tb = Math.max(tb, tFrei + slackB * 0.5, pl.ruhe + (tippen ? e : 0) + 0.02, minReihe(reihe.t0));
        // Genau nachgerechnet, von der Kugel, wie sie ist: Verlässt sie ihre
        // Bahn zu früh, rückt die Grenze nach.
        let ex = null;
        for (let i = 0; i < 4; i += 1) {
          ex = uebergangAb(pl.zustand, cfg, tb, bahn, nach, tippen, e);
          if (!ex) return null;
          const fehlt = tFrei + slackB * 0.5 + 0.004 - ex.weg;
          if (fehlt <= 0) break;
          tb += fehlt;
          ex = null;
        }
        if (!ex) return null;
        const an = ex.an - tb + 0.008 * mass;
        const ruhe = ex.ruhe - tb + 0.008 * mass;
        if (tippen) neuW.push({ t: tb, e, nr: n });
        neuR.push({ t: tb, cfg });
        tEnde = tb + Math.max(0.004, an) + 0.004;
        ende = { bahn: nach, p: pNeu, ruhe: tb + Math.max(0.01, ruhe) + 0.01 };
      }
      return { neuS, neuSt, neuW, neuR, tEnde, ende, e, art: lageArt };
    };

    const zuruecksetzen = () => {
      state.sperren.length = vorher.sperren;
      state.stacheln.length = vorher.stacheln;
      state.weg.length = vorher.weg;
      state.reihen.length = vorher.reihen;
      Object.assign(state.reihen[state.reihen.length - 1], vorher.reihe);
    };
    const anwenden = (v) => {
      v.neuR.forEach((r) => { schliesseReihe(r.t); neueReihe(r.t, r.cfg); });
      v.neuS.forEach((s) => state.sperren.push(s));
      v.neuSt.forEach((s) => state.stacheln.push(s));
      v.neuW.forEach((w) => state.weg.push(w));
    };
    // Ein Versuch; hält er nicht (sicher), einer mit mehr Luft, zuletzt
    // einer ohne Besonderes.
    let fertig = null;
    const vorig = state.abschnitte[state.abschnitte.length - 1] || null;
    for (const [mass, einfach] of [[1, false], [1.15, false], [1.3, true], [1.6, true], [2.2, true]]) {
      const v = versuch(mass, einfach);
      if (!v) continue;
      anwenden(v);
      if (sicher(vorig ? vorig.start : pl.zustand, v.tEnde, v.ende)) { fertig = v; break; }
      zuruecksetzen();
    }
    if (!fertig) {
      // Darf nicht vorkommen (die Prüfung zählt mit) – dann eben dieser.
      state.planFehler += 1;
      fertig = versuch(3, true);
      anwenden(fertig);
    }
    state.sperren.sort((a, b) => a.y0 - b.y0);
    state.stacheln.sort((a, b) => a.y0 - b.y0);
    const start = pl.zustand;
    state.abschnitte.push({ nr: n, t0: T, t1: fertig.tEnde, besonders: fertig.art === besonders ? besonders : "", art: fertig.art, bahn: pl.bahn, e: fertig.e, start });
    // Wo die Kugel nach dem Plan am Ende ist – genau, mit den geplanten Tipps.
    const nach = laufPlan(start, fertig.tEnde);
    state.plan = { t: fertig.tEnde, ruhe: Math.max(fertig.tEnde, fertig.ende.ruhe), bahn: fertig.ende.bahn, p: fertig.ende.p, zustand: nach };
  }

  // Die Kugel genau nach dem Plan, von start bis bis.
  function laufPlan(start, bis) {
    const k = { x: start.x, v: start.v, p: start.p };
    const z = state.weg.filter((w) => w.t >= start.t - 1e-9).map((w) => w.t);
    let j = 0;
    let t = start.t;
    while (t < bis - 1e-9) {
      let h = Math.min(TAKT, bis - t);
      if (j < z.length && z[j] < t + h) {
        if (z[j] - t > 1e-9) h = z[j] - t;
        else { k.p = -k.p; j += 1; continue; }
      }
      const r = reiheBei(t);
      querSchritt(k, farbe(r, -1, t), farbe(r, 1, t), h);
      t += h;
    }
    return { t, x: k.x, v: k.v, p: k.p };
  }

  // Hält der Plan von start bis bis? Jeder geplante Tipp so früh oder so
  // spät, wie er darf (alle Ecken), durch den echten Schacht – jeder Tipp
  // genau zu seiner Zeit.
  function sicher(start, bis, ende) {
    const tipps = state.weg.filter((w) => w.t >= start.t - 1e-9 && w.t - w.e <= bis);
    const n = tipps.length;
    // Die ganze Luft und noch 1,5 ms dazu: Im Spiel rechnet jedes Bild in
    // seinen eigenen Schritten.
    const luft = (w) => w.e + 0.0015;
    const proben = [];
    // Alle Ecken …
    for (let m = 0; m < (1 << n); m += 1) proben.push(tipps.map((w, i) => w.t + (((m >> i) & 1) ? 1 : -1) * luft(w)));
    // … alle gleich weit daneben, und jeder einzeln dazwischen.
    for (let f = -0.75; f <= 0.76; f += 0.25) proben.push(tipps.map((w) => w.t + f * luft(w)));
    tipps.forEach((_, j) => {
      for (const f of [-0.85, -0.6, -0.35, 0.35, 0.6, 0.85]) proben.push(tipps.map((w, i) => w.t + (i === j ? f * luft(w) : 0)));
    });
    return proben.every((zeiten) => folgeHaelt(start, zeiten, bis, ende));
  }
  function folgeHaelt(start, zeiten, bis, ende) {
    const k = { x: start.x, v: start.v, p: start.p };
    const z = [...zeiten].sort((a, b) => a - b);
    let j = 0;
    let t = start.t;
    while (t < bis) {
      let h = TAKT;
      if (j < z.length && z[j] < t + h) {
        if (z[j] - t > 1e-9) h = z[j] - t;
        else { k.p = -k.p; j += 1; continue; }
      }
      const r = reiheBei(t);
      querSchritt(k, farbe(r, -1, t), farbe(r, 1, t), h);
      t += h;
      if (trifft(k.x, yBei(t))) return false;
    }
    return !ende || Math.abs(k.x - ende.bahn * XW) <= TOL * 1.6;
  }

  // Der Schacht steht bis zur Zeit t. Je Aufruf höchstens «mal» Abschnitte,
  // damit kein Bild lange wartet.
  function planBis(t, mal = 60) {
    for (let i = 0; i < mal && state.plan.t < t; i += 1) naechsterAbschnitt();
  }

  // Ein neuer Schacht. Die erste Reihe: rot links, blau rechts; die rote
  // Kugel hängt in der Mitte und fliegt nach dem Loslassen an die blaue Wand.
  function schachtNeu() {
    state.reihen = [];
    state.sperren = [];
    state.stacheln = [];
    state.weg = [];
    state.abschnitte = [];
    state.planFehler = 0;
    reiheHint = 0;
    neueReihe(-30, { cl: 1, cr: -1 });
    const k = { x: 0, v: 0, p: 1 };
    let t = 0;
    let da = 0;
    while (t < 1.5) {
      querSchritt(k, 1, -1, TAKT);
      t += TAKT;
      if (Math.abs(k.x - XW) > TOL) da = t;
    }
    const z = { x: 0, v: 0, p: 1 };
    let u = 0;
    while (u < da + 0.02 - 1e-9) { querSchritt(z, 1, -1, TAKT); u += TAKT; }
    state.plan = { t: u, ruhe: u, bahn: 1, p: 1, zustand: { t: u, x: z.x, v: z.v, p: 1 } };
    planBis(8);
  }

  // Der Abschnitt zur Zeit t.
  function abschnittBei(t) {
    const l = state.abschnitte;
    let lo = 0;
    let hi = l.length - 1;
    if (hi < 0 || t < l[0].t0) return 0;
    while (lo < hi) {
      const m = (lo + hi + 1) >> 1;
      if (l[m].t0 <= t) lo = m; else hi = m - 1;
    }
    return lo;
  }

  // Der Schacht als Text – für die Prüfung, dass in einem Turnier alle
  // denselben bekommen.
  function kursText(bis = 60) {
    planBis(bis + 1, 400);
    const reihen = state.reihen.filter((r) => r.t0 < bis).map((r) => `${r.art || ""}${r.cl},${r.cr}@${r.y0.toFixed(1)}`);
    const sperren = state.sperren.filter((s) => s.t0 < bis).map((s) => `s${s.luecke}@${s.y0.toFixed(1)}`);
    const stacheln = state.stacheln.filter((s) => s.y0 < yBei(bis)).map((s) => `t${s.seite}@${s.y0.toFixed(1)}-${s.y1.toFixed(1)}`);
    return `${reihen.join(",")} | ${sperren.join(",")} | ${stacheln.join(",")}`;
  }

  // ---------------------------------------------------------------------------
  // Die Fläche
  // ---------------------------------------------------------------------------
  function buildPlatz() {
    const platz = shell.el("div", "pw-platz");
    feld = shell.el("div", "pw-feld");
    canvas = document.createElement("canvas");
    canvas.className = "pw-canvas";
    canvas.setAttribute("aria-hidden", "true");
    feld.append(canvas);
    g = canvas.getContext("2d");

    // Der Hinweis vor dem ersten Tipp: zwei Ringe, die aufgehen – tippen.
    const tipp = shell.el("span", "pw-tipp");
    tipp.setAttribute("aria-hidden", "true");
    const ns = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(ns, "svg");
    svg.setAttribute("viewBox", "0 0 64 64");
    ["pw-tipp-ring", "pw-tipp-ring is-spaet"].forEach((klasse) => {
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
    tippRinge = tipp;
    feld.append(tipp);
    platz.append(feld);
    return platz;
  }

  function messen() {
    if (!canvas || !feld) return;
    const cssW = Math.max(80, feld.clientWidth);
    const cssH = Math.max(80, feld.clientHeight);
    const dpr = shellApi.bildpunkte(cssW, cssH, 2);
    const frei = Math.min(cssH * 0.35, shell?.frei?.(canvas) || 0);
    if (cssW === view.cssW && cssH === view.cssH && dpr === view.dpr && frei === view.frei) return;
    view.cssW = cssW;
    view.cssH = cssH;
    view.dpr = dpr;
    view.frei = frei;
    // Die Kugel steht gut ein Fünftel unter dem, was oben über dem Schacht
    // liegt (Knöpfe, Gegner); unter ihr muss man SICHT Einheiten weit sehen –
    // hoch wie quer gleich weit, fair. Hochkant gibt meist das die Grösse
    // vor, sonst die Breite des Schachts. Quer ist wenig Höhe: Dort steht der
    // Schacht, wo über ihm am wenigsten liegt – in der Mitte, rechts oder
    // links. Ein Stück Wand ist eine ganze Zahl Bildpunkte hoch: So lassen
    // sich die vorgemalten Wände auflegen, ohne gestreckt zu werden.
    const breitE = 2 * (HALB + BLOCK + 3);
    const quer = cssW > cssH * 1.25;
    const lage = (mitte, oben) => {
      const kugelY = Math.max(oben + (cssH - oben) * (quer ? 0.08 : 0.2) + 6, cssH * 0.2);
      const s1 = (cssH - kugelY - 6) / SICHT;
      const s2 = (Math.min(mitte, cssW - mitte) * 2 * 0.97) / breitE;
      return { mitte, kugelY, s0: Math.max(0.5, Math.min(s1, s2)) };
    };
    let beste = lage(cssW / 2, frei);
    if (quer) {
      // Zweimal: Wie breit der Schacht ist, hängt an der Grösse, und was
      // über ihm liegt, an seiner Breite.
      const kandidaten = [];
      for (const wo of [0.5, 1, 0]) {
        let l = beste;
        for (let i = 0; i < 2; i += 1) {
          const halb = (breitE / 2) * l.s0;
          const mitte = wo === 0.5 ? cssW / 2 : wo === 1 ? cssW - halb - 4 : halb + 4;
          l = lage(mitte, freiUeber(mitte - halb, mitte + halb));
        }
        kandidaten.push(l);
      }
      beste = kandidaten.reduce((a, b) => (b.s0 > a.s0 * 1.08 ? b : a));
    }
    view.mitteX = Math.round(beste.mitte);
    view.s = Math.max(1, Math.floor(KACHEL * beste.s0 * dpr)) / (KACHEL * dpr);
    view.kugelY = Math.round(beste.kugelY);
    const pw = Math.round(cssW * dpr);
    const ph = Math.round(cssH * dpr);
    if (canvas.width !== pw) canvas.width = pw;
    if (canvas.height !== ph) canvas.height = ph;
    if (tippRinge) {
      tippRinge.style.left = `${view.mitteX}px`;
      tippRinge.style.top = `${Math.round(lerp(view.kugelY, cssH, 0.62))}px`;
    }
    bilderNeu();
  }

  const bildX = (x) => view.mitteX + x * view.s;

  // Wie weit oben über dem Streifen von x0 bis x1 etwas liegt (Knöpfe,
  // Gegner, Leisten) – gemessen, nicht gerechnet.
  function freiUeber(x0, x1) {
    let unten = 0;
    try {
      const r0 = canvas.getBoundingClientRect();
      host.querySelectorAll(".cm-bar > *, .gs-leiste > *, .lv-leiste > *, .gz-leiste > *, .cm-time").forEach((e) => {
        if (e.hidden) return;
        const r = e.getBoundingClientRect();
        if (!r.width || !r.height) return;
        if (r.right - r0.left < x0 || r.left - r0.left > x1) return;
        unten = Math.max(unten, r.bottom - r0.top);
      });
    } catch { unten = view.frei; }
    return Math.min(view.cssH * 0.35, unten);
  }
  const bildY = (y) => view.kugelY + (y - state.camY) * view.s;

  // ---------------------------------------------------------------------------
  // Vorgemalt: Rückwand, Wände, Magnete, Sperren, Kugel
  // ---------------------------------------------------------------------------
  /*
   * Alles, was gross ist, wird einmal gemalt und dann je Bild nur noch
   * aufgelegt, Punkt auf Punkt:
   *
   *   rueck     die Rückwand des Schachts je Zone, RUECK Einheiten hoch, sie
   *             zieht langsamer vorbei als die Wände (PAR) – sie ist weiter weg
   *   wand      die Wände links und rechts der Magnete je Zone, WAND hoch
   *   magnet    die Magnete: Kappe oben, ein Stück KACHEL hoch, Kappe unten,
   *             je Farbe (rot, blau, grau, aus) und Seite
   *   sperre    die Platten je Zone, lang (Lücke an einer Wand) und kurz
   *             (Lücke in der Mitte), an der linken und an der rechten Wand
   *   stachel   ein Stück Stacheln je Seite
   *   kugel     die Kugel je Polung, ihr Schein und ihr Schweif
   *
   * Die Zonen werden erst gemalt, wenn sie ins Bild kommen.
   */
  const RUECK = 24 * KACHEL;
  const WAND = 20 * KACHEL;
  const PAR = 0.5;
  const KAPPE = 1.5;
  let bilder = null;

  function leinwand(wPx, hPx) {
    const c = document.createElement("canvas");
    c.width = Math.max(2, Math.round(wPx));
    c.height = Math.max(2, Math.round(hPx));
    return c;
  }

  function bilderNeu() {
    const f = view.s * view.dpr;
    bilder = {
      f,
      rueck: [],
      wand: [],
      seiteL: Math.max(0, view.mitteX - (HALB + BLOCK) * view.s),
      seiteR: Math.max(0, view.cssW - view.mitteX - (HALB + BLOCK) * view.s),
      magnet: {},
      sperre: [],
      stachel: null,
      kugel: null,
      schein: {},
      etikett: {},
    };
    ["rot", "blau", "grau", "aus"].forEach((art) => {
      bilder.magnet[art] = { l: maleMagnet(art, -1), r: maleMagnet(art, 1) };
    });
    bilder.stachel = { l: maleStachel(-1), r: maleStachel(1) };
    bilder.kugel = { 1: maleKugel(1), [-1]: maleKugel(-1), 0: maleKugel(0) };
    bilder.schein = {
      1: scheinBild([255, 70, 90], 1, 2.3 * R * f),
      [-1]: scheinBild([70, 150, 255], 1, 2.3 * R * f),
      funke: scheinBild([255, 230, 170], 1, 3 * f),
      lampe: scheinBild([255, 200, 130], 0.9, 12 * f),
      glut: scheinBild([255, 150, 60], 0.9, 9 * f),
    };
    bilder.etikett = { 1: maleEtikett("N", [255, 214, 218]), [-1]: maleEtikett("S", [214, 236, 255]) };
    licht = null;
  }

  function scheinBild(farbe, kraft, r) {
    const n = Math.max(4, Math.round(r * 2));
    const c = leinwand(n, n);
    const k = c.getContext("2d");
    const v = k.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2);
    v.addColorStop(0, rgba(farbe, kraft));
    v.addColorStop(0.3, rgba(farbe, kraft * 0.62));
    v.addColorStop(0.6, rgba(farbe, kraft * 0.22));
    v.addColorStop(1, rgba(farbe, 0));
    k.fillStyle = v;
    k.fillRect(0, 0, n, n);
    return c;
  }

  // Ein Bild in Einheiten der Welt bemalen: f Bildpunkte je Einheit.
  function inEinheiten(wE, hE, malen) {
    const f = bilder.f;
    const c = leinwand(wE * f, hE * f);
    const k = c.getContext("2d");
    k.scale(c.width / wE, c.height / hE);
    malen(k, wE, hE);
    return c;
  }

  // Die Zonen vormalen, eine je Bild: auf dem Startbild alle, die gleich
  // kommen, im Spiel immer die nächste – lange bevor sie ins Bild kommt.
  // Was weit oben liegt, wird wieder freigegeben.
  function zonenVormalen() {
    if (!bilder) return;
    const z = zoneBei(state.camY);
    for (let i = 0; i < ZONEN.length; i += 1) {
      if (i < z - 1) { bilder.rueck[i] = null; bilder.wand[i] = null; bilder.sperre[i] = null; }
    }
    for (let i = Math.max(0, z); i <= Math.min(ZONEN.length - 1, z + 1); i += 1) {
      if (!bilder.rueck[i]) { rueckFuer(i); return; }
      if (!bilder.wand[i] && (bilder.seiteL >= 1 || bilder.seiteR >= 1)) { wandFuer(i); return; }
      if (!bilder.sperre[i]) { sperreFuer(i); return; }
    }
  }

  // Die Rückwand und die Wände einer Zone – erst, wenn sie gebraucht werden.
  function rueckFuer(z) {
    if (!bilder.rueck[z]) bilder.rueck[z] = inEinheiten(2 * HALB, RUECK, (k, w, h) => maleRueckwand(k, w, h, z));
    return bilder.rueck[z];
  }
  function wandFuer(z) {
    if (bilder.seiteL < 1 && bilder.seiteR < 1) return null;
    if (!bilder.wand[z]) {
      // Gemalt wird von der Kante der Magnete nach aussen; die linke Wand
      // also gespiegelt (gespiegelt aufzulegen kostete auf dem iPhone jedes
      // Bild).
      const l = inEinheiten(Math.ceil(bilder.seiteL / view.s) + 1, WAND, (k, w, h) => { k.translate(w, 0); k.scale(-1, 1); maleWand(k, w, h, z, 0); });
      const r = inEinheiten(Math.ceil(bilder.seiteR / view.s) + 1, WAND, (k, w, h) => maleWand(k, w, h, z, 1));
      bilder.wand[z] = { l, r };
    }
    return bilder.wand[z];
  }
  function sperreFuer(z) {
    if (!bilder.sperre[z]) {
      const lang = HALB - (-XW + R + TOL);
      const kurz = HALB - (R + TOL);
      const mal = (laenge, seite) => inEinheiten(laenge + 1, DICKE + 3, (k) => maleSperre(k, laenge, seite, z));
      bilder.sperre[z] = { lang, kurz, langL: mal(lang, -1), langR: mal(lang, 1), kurzL: mal(kurz, -1), kurzR: mal(kurz, 1) };
    }
    return bilder.sperre[z];
  }

  // --- Die Farben der Zonen ---------------------------------------------------
  // Gedämpft und eher dunkel: Leuchten sollen die Magnete und die Kugel.
  const PALETTE = [
    { grund: [30, 40, 40], tief: [14, 20, 22], licht: [255, 196, 128], fuge: [18, 26, 27], akzent: [176, 110, 60] },
    { grund: [44, 37, 32], tief: [18, 15, 13], licht: [255, 186, 102], fuge: [28, 23, 20], akzent: [120, 84, 52] },
    { grund: [27, 24, 42], tief: [10, 9, 18], licht: [190, 176, 255], fuge: [17, 15, 28], akzent: [150, 140, 200] },
    { grund: [36, 28, 28], tief: [14, 10, 10], licht: [255, 150, 60], fuge: [22, 16, 16], akzent: [255, 128, 40] },
    { grund: [44, 34, 24], tief: [18, 12, 8], licht: [255, 214, 140], fuge: [28, 20, 14], akzent: [255, 190, 90] },
  ];

  // Eine Form oben, unten und noch einmal eine Höhe versetzt (die Bilder
  // wiederholen sich nach ihrer Höhe).
  const rundum = (h, malen) => { malen(-h); malen(0); malen(h); };
  // Dasselbe für eine Form um y mit Halbmesser r: Nur, was über einen Rand
  // ragt, wird ein zweites Mal gemalt.
  const rundumNah = (h, y, r, malen) => { malen(0); if (y - r < 0) malen(h); if (y + r > h) malen(-h); };

  // Fels: Schichten, darin unregelmässige Steine, jeder mit einer hellen
  // Kante oben und einem Schatten unten, und feine Risse. Ruhig im Ton: Er
  // ist Hintergrund.
  function fels(k, w, h, basis, saat, { dichte = 1, groesse = 1, kontrast = 1 } = {}) {
    const z = wuerfel(saat);
    k.fillStyle = rgb(basis);
    k.fillRect(0, 0, w, h);
    // Schichten.
    for (let i = 0; i < 7; i += 1) {
      const y0 = (i / 7) * h + z() * 8;
      const dick = 6 + z() * 14;
      const ton = (z() - 0.5) * 0.16 * kontrast;
      k.fillStyle = ton > 0 ? `rgba(255, 240, 220, ${ton})` : `rgba(0, 0, 0, ${-ton})`;
      rundum(h, (o) => {
        k.beginPath();
        for (let x = -2; x <= w + 2; x += 3) k.lineTo(x, y0 + o + Math.sin(x * 0.09 + i * 1.7) * 2.5);
        for (let x = w + 2; x >= -2; x -= 3) k.lineTo(x, y0 + o + dick + Math.sin(x * 0.07 + i) * 2);
        k.closePath();
        k.fill();
      });
    }
    // Steine.
    const n = Math.round((w * h * dichte) / (16 * groesse * groesse));
    for (let i = 0; i < n; i += 1) {
      const x = z() * w;
      const y = z() * h;
      const r = (1.4 + z() * 3.6) * groesse;
      const ecken = 5 + Math.floor(z() * 3);
      const pts = [];
      const dreh = z() * TAU;
      for (let j = 0; j < ecken; j += 1) {
        const a = dreh + (j / ecken) * TAU;
        const rr = r * (0.65 + z() * 0.5);
        pts.push([Math.cos(a) * rr, Math.sin(a) * rr * 0.8]);
      }
      const ton = (z() - 0.5) * 0.22 * kontrast;
      rundumNah(h, y, r * 1.2, (o) => {
        k.beginPath();
        pts.forEach(([px, py]) => k.lineTo(x + px, y + o + py));
        k.closePath();
        k.fillStyle = ton > 0 ? `rgba(255, 236, 214, ${ton})` : `rgba(0, 0, 0, ${-ton})`;
        k.fill();
        k.strokeStyle = `rgba(0, 0, 0, ${0.22 * kontrast})`;
        k.lineWidth = 0.3;
        k.stroke();
        // Licht von oben links.
        k.strokeStyle = `rgba(255, 240, 220, ${0.07 * kontrast})`;
        k.beginPath();
        for (let j = 0; j < pts.length; j += 1) if (pts[j][1] < 0) k.lineTo(x + pts[j][0], y + o + pts[j][1]);
        k.stroke();
      });
    }
    // Risse.
    k.strokeStyle = `rgba(0, 0, 0, ${0.3 * kontrast})`;
    k.lineWidth = 0.35;
    for (let i = 0; i < Math.round(w * h / 1400); i += 1) {
      let x = z() * w;
      let y = z() * h;
      k.beginPath();
      k.moveTo(x, y);
      for (let j = 0; j < 5; j += 1) { x += (z() - 0.5) * 7; y += 2 + z() * 5; k.lineTo(x, y); }
      k.stroke();
    }
  }

  // Ein glühender Riss: ein Zickzack in kleinen Schritten, der seine Richtung
  // hält, mit Ästen; aussen ein Schein, innen eine helle Linie.
  function riss(k, h, z, x0, y0, laenge, farbe, kraft) {
    const zweig = (x, y, richtung, n, dick) => {
      const pts = [[x, y]];
      let a = richtung;
      for (let j = 0; j < n; j += 1) {
        a += (z() - 0.5) * 0.9;
        a = clamp(a, 0.35, Math.PI - 0.35);
        x += Math.cos(a) * (1.4 + z() * 1.8);
        y += Math.sin(a) * (1.4 + z() * 1.8);
        pts.push([x, y]);
        if (dick > 0.5 && z() < 0.12) zweig(x, y, a + (z() < 0.5 ? -0.9 : 0.9), Math.round(n * 0.4), dick * 0.6);
      }
      rundum(h, (o) => {
        k.strokeStyle = rgba(farbe, 0.12 * kraft);
        k.lineWidth = 2.6 * dick;
        k.beginPath(); pts.forEach(([px, py]) => k.lineTo(px, py + o)); k.stroke();
        k.strokeStyle = rgba(mix3(farbe, [255, 240, 200], 0.5), 0.55 * kraft);
        k.lineWidth = 0.45 * dick;
        k.beginPath(); pts.forEach(([px, py]) => k.lineTo(px, py + o)); k.stroke();
      });
    };
    zweig(x0, y0, Math.PI / 2 + (z() - 0.5) * 0.8, laenge, 1);
  }

  // Ein weicher Lichtkegel (vorgemalt, also darf er ein Verlauf sein).
  function kegel(k, x, y, r, farbe, alpha) {
    const v = k.createRadialGradient(x, y, 0, x, y, r);
    v.addColorStop(0, rgba(farbe, alpha));
    v.addColorStop(0.4, rgba(farbe, alpha * 0.35));
    v.addColorStop(1, rgba(farbe, 0));
    k.fillStyle = v;
    k.fillRect(x - r, y - r, 2 * r, 2 * r);
  }

  // --- Die Rückwand ---------------------------------------------------------
  function maleRueckwand(k, w, h, z) {
    const p = PALETTE[z];
    k.fillStyle = rgb(p.grund);
    k.fillRect(0, 0, w, h);
    const zz = wuerfel(101 + z * 17);
    if (z === 0) {
      // Das alte Labor: glasierte Kacheln, eine Kupferleitung, Messuhren,
      // eine Spule auf einem Bord und eine Lampe im Drahtkorb.
      for (let y = 0; y < h; y += 6) {
        for (let x = 0; x < w; x += 6) {
          const t = hash01(x * 3.1 + y * 7.7);
          k.fillStyle = rgb(mix3(p.grund, [52, 66, 64], 0.15 + 0.3 * t));
          k.fillRect(x + 0.3, y + 0.3, 5.4, 5.4);
          k.fillStyle = "rgba(255,255,255,0.035)";
          k.fillRect(x + 0.6, y + 0.6, 4.8, 0.6);
        }
      }
      // Eine Leiste aus Kupfer, alle halbe Höhe.
      [0, h / 2].forEach((y0) => {
        k.fillStyle = "rgba(150, 92, 50, 0.45)";
        k.fillRect(0, y0 + 44, w, 1.2);
        k.fillStyle = "rgba(0,0,0,0.25)";
        k.fillRect(0, y0 + 45.2, w, 0.8);
      });
      // Die Kupferleitung, senkrecht, nah an der rechten Wand, mit Schellen.
      const lx = w * 0.9;
      k.fillStyle = "rgb(96, 58, 36)";
      k.fillRect(lx - 1, 0, 2, h);
      k.fillStyle = "rgba(255, 190, 130, 0.22)";
      k.fillRect(lx - 0.6, 0, 0.5, h);
      for (let y = 6; y < h; y += 24) { k.fillStyle = "rgb(52, 46, 42)"; k.fillRect(lx - 1.6, y, 3.2, 1.4); }
      // Zwei Messuhren.
      [[w * 0.26, 22], [w * 0.62, 118]].forEach(([x, y], i) => {
        k.fillStyle = "rgb(122, 96, 52)";
        k.beginPath(); k.arc(x, y, 4.6, 0, TAU); k.fill();
        k.fillStyle = "rgb(168, 160, 136)";
        k.beginPath(); k.arc(x, y, 3.8, 0, TAU); k.fill();
        k.strokeStyle = "rgba(40, 30, 20, 0.7)";
        k.lineWidth = 0.25;
        for (let j = 0; j < 9; j += 1) {
          const a = Math.PI * (0.8 + j * 0.175);
          k.beginPath(); k.moveTo(x + Math.cos(a) * 3.1, y + Math.sin(a) * 3.1); k.lineTo(x + Math.cos(a) * 3.6, y + Math.sin(a) * 3.6); k.stroke();
        }
        k.strokeStyle = "rgb(150, 40, 30)";
        k.lineWidth = 0.4;
        const a = Math.PI * (1.15 + 0.5 * i);
        k.beginPath(); k.moveTo(x, y); k.lineTo(x + Math.cos(a) * 3, y + Math.sin(a) * 3); k.stroke();
      });
      // Eine Spule auf einem Bord.
      const sx = w * 0.18;
      const sy = 92;
      k.fillStyle = "rgb(48, 34, 26)";
      k.fillRect(sx - 7, sy + 5, 16, 1.6);
      k.fillStyle = "rgb(60, 60, 66)";
      k.fillRect(sx - 5, sy - 5, 1.4, 10);
      k.fillRect(sx + 4.6, sy - 5, 1.4, 10);
      for (let i = 0; i < 9; i += 1) {
        k.fillStyle = i % 2 ? "rgb(150, 84, 44)" : "rgb(178, 104, 56)";
        k.fillRect(sx - 3.6 + i, sy - 4.2, 1, 8.4);
      }
      k.fillStyle = "rgba(255, 210, 160, 0.18)";
      k.fillRect(sx - 3.6, sy - 3.6, 9, 1.2);
      // Ein Kabel, das durchhängt.
      k.strokeStyle = "rgb(16, 18, 20)";
      k.lineWidth = 0.8;
      k.beginPath(); k.moveTo(0, 150); k.quadraticCurveTo(w * 0.4, 172, w * 0.78, 156); k.stroke();
      // Die Lampe im Drahtkorb, mit ihrem warmen Schein.
      const lx2 = w * 0.42;
      const ly = 64;
      kegel(k, lx2, ly + 4, 26, p.licht, 0.22);
      k.strokeStyle = "rgb(20, 20, 22)";
      k.lineWidth = 0.4;
      k.beginPath(); k.moveTo(lx2, ly - 9); k.lineTo(lx2, ly - 2); k.stroke();
      k.fillStyle = "rgb(255, 226, 170)";
      k.beginPath(); k.arc(lx2, ly + 1, 1.7, 0, TAU); k.fill();
      k.strokeStyle = "rgba(30, 28, 26, 0.9)";
      k.lineWidth = 0.3;
      for (let i = -2; i <= 2; i += 1) { k.beginPath(); k.moveTo(lx2 + i * 0.9, ly - 2); k.lineTo(lx2 + i * 1.2, ly + 3.4); k.stroke(); }
    } else if (z === 1) {
      // Das Bergwerk: Fels mit Schichten, Erzadern, Türstöcke aus Holz und
      // Grubenlampen.
      fels(k, w, h, p.grund, 11, { kontrast: 0.7 });
      // Erzadern mit Pyrit, das ein wenig glänzt.
      for (let i = 0; i < 3; i += 1) {
        const y0 = (i + 0.5) * (h / 3) + zz() * 20;
        k.strokeStyle = "rgba(110, 96, 70, 0.6)";
        k.lineWidth = 0.9;
        k.beginPath();
        const pts = [];
        for (let x = -2; x <= w + 2; x += 4) { const y = y0 + Math.sin(x * 0.09 + i * 2) * 6 + (zz() - 0.5) * 2; pts.push([x, y]); k.lineTo(x, y); }
        k.stroke();
        k.fillStyle = "rgba(230, 200, 120, 0.55)";
        pts.forEach(([x, y]) => { if (zz() < 0.4) k.fillRect(x + zz() * 3, y - 0.4, 0.6, 0.6); });
      }
      // Türstöcke: eine Kappe quer, darunter eine Lampe.
      [20, 20 + h / 2].forEach((y0) => {
        k.fillStyle = "rgb(78, 56, 36)";
        k.fillRect(0, y0, w, 3);
        k.fillStyle = "rgba(255, 210, 150, 0.14)";
        k.fillRect(0, y0, w, 0.6);
        k.strokeStyle = "rgba(30, 18, 10, 0.5)";
        k.lineWidth = 0.22;
        for (let x = 2; x < w; x += 5) { k.beginPath(); k.moveTo(x, y0 + 1); k.lineTo(x + 3, y0 + 1.2); k.stroke(); }
        k.fillStyle = "rgba(0,0,0,0.2)";
        k.fillRect(0, y0 + 3, w, 0.8);
        const lx = w * (y0 < h / 2 ? 0.35 : 0.65);
        kegel(k, lx, y0 + 9, 22, p.licht, 0.2);
        k.strokeStyle = "rgb(14, 12, 10)";
        k.lineWidth = 0.35;
        k.beginPath(); k.moveTo(lx, y0 + 4.4); k.lineTo(lx, y0 + 7); k.stroke();
        k.fillStyle = "rgb(60, 52, 40)";
        k.fillRect(lx - 1.2, y0 + 7, 2.4, 1.2);
        k.fillStyle = "rgb(255, 214, 150)";
        k.beginPath(); k.arc(lx, y0 + 9.2, 1.1, 0, TAU); k.fill();
      });
    } else if (z === 2) {
      // Die Kristallhöhle: dunkler Fels, darin Drusen aus Magnetit –
      // schwarze Oktaeder mit hellen Kanten.
      fels(k, w, h, p.grund, 21, { kontrast: 0.9 });
      k.strokeStyle = "rgba(120, 110, 190, 0.12)";
      k.lineWidth = 0.5;
      for (let i = 0; i < 5; i += 1) {
        const x0 = zz() * w;
        k.beginPath();
        for (let y = -4; y <= h + 4; y += 6) k.lineTo(x0 + Math.sin(y * 0.07 + i) * 8, y);
        k.stroke();
      }
      for (let d = 0; d < 6; d += 1) {
        const cx = (0.12 + 0.76 * zz()) * w;
        const cy = (d + zz() * 0.6) * (h / 6);
        kegel(k, cx, cy, 14, [120, 100, 200], 0.12);
        for (let i = 0; i < 6; i += 1) {
          const x = cx + (zz() - 0.5) * 9;
          const y = cy + (zz() - 0.5) * 7;
          const r = 1.3 + zz() * 2.6;
          rundum(h, (o) => kristall(k, x, y + o, r, zz() * 0.6 - 0.3));
        }
      }
    } else {
      // Die Magmakammer: Basaltsäulen, zwischen ihnen hier und da ein
      // glühender Riss. Der Kern: dunkles Eisen, von glühenden Adern
      // durchzogen – heller, goldener.
      const heiss = z === 4;
      if (!heiss) {
        const saeule = 7;
        for (let x = -saeule / 2; x < w + saeule; x += saeule) {
          const t = hash01(x * 1.7 + z);
          k.fillStyle = rgb(mix3(p.grund, [56, 46, 46], 0.2 + 0.4 * t));
          k.fillRect(x + 0.3, 0, saeule - 0.6, h);
          k.fillStyle = "rgba(255, 220, 190, 0.05)";
          k.fillRect(x + 0.6, 0, 1, h);
          k.fillStyle = "rgba(0,0,0,0.3)";
          k.fillRect(x + saeule - 1.2, 0, 0.9, h);
          for (let y = hash01(x) * 20; y < h; y += 14 + hash01(x + y) * 12) {
            k.fillStyle = "rgba(0,0,0,0.35)";
            k.fillRect(x + 0.3, y, saeule - 0.6, 0.7);
          }
        }
        for (let i = 0; i < 3; i += 1) riss(k, h, zz, zz() * w, zz() * h, 14, p.akzent, 0.7);
      } else {
        fels(k, w, h, p.grund, 61, { kontrast: 0.6, groesse: 1.6 });
        for (let i = 0; i < 3; i += 1) riss(k, h, zz, zz() * w, zz() * h, 16, [255, 196, 90], 0.55);
        for (let i = 0; i < 4; i += 1) kegel(k, zz() * w, zz() * h, 18, [255, 170, 70], 0.08);
      }
    }
    // Zu den Magneten hin dunkler: Dort fällt ihr eigenes Licht hin.
    const v = k.createLinearGradient(0, 0, w, 0);
    v.addColorStop(0, rgba(p.tief, 0.75));
    v.addColorStop(0.2, rgba(p.tief, 0.15));
    v.addColorStop(0.8, rgba(p.tief, 0.15));
    v.addColorStop(1, rgba(p.tief, 0.75));
    k.fillStyle = v;
    k.fillRect(0, 0, w, h);
    k.fillStyle = rgba(p.tief, 0.32);
    k.fillRect(0, 0, w, h);
  }

  // Ein Kristall aus Magnetit: ein Oktaeder, schwarz, mit hellen Kanten.
  function kristall(k, x, y, r, dreh) {
    k.save();
    k.translate(x, y);
    k.rotate(dreh);
    k.fillStyle = "rgb(16, 15, 24)";
    k.beginPath(); k.moveTo(0, -r * 1.3); k.lineTo(r, 0); k.lineTo(0, r * 1.3); k.lineTo(-r, 0); k.closePath(); k.fill();
    k.fillStyle = "rgba(150, 140, 210, 0.22)";
    k.beginPath(); k.moveTo(0, -r * 1.3); k.lineTo(r, 0); k.lineTo(0, 0); k.closePath(); k.fill();
    k.strokeStyle = "rgba(210, 206, 255, 0.55)";
    k.lineWidth = 0.25;
    k.beginPath(); k.moveTo(0, -r * 1.3); k.lineTo(r, 0); k.lineTo(0, r * 1.3); k.moveTo(0, -r * 1.3); k.lineTo(0, r * 1.3); k.stroke();
    k.restore();
  }

  // --- Die Wände links und rechts -------------------------------------------
  // In Einheiten von der Kante der Magnete (x = 0) nach aussen (x = w).
  function maleWand(k, w, h, z, seite) {
    const p = PALETTE[z];
    k.fillStyle = rgb(mix3(p.grund, p.tief, 0.35));
    k.fillRect(0, 0, w, h);
    const zz = wuerfel(301 + z * 13 + seite * 7);
    if (z === 0) {
      // Mauerwerk aus grossen, dunklen Quadern, eine Kabelrinne.
      for (let y = 0; y < h; y += 8) {
        const versatz = (y / 8) % 2 ? 7 : 0;
        for (let x = -versatz; x < w; x += 14) {
          k.fillStyle = rgb(mix3(p.grund, p.tief, 0.25 + 0.35 * hash01(x * 1.3 + y * 2.9)));
          k.fillRect(x + 0.4, y + 0.4, 13.2, 7.2);
        }
      }
      k.fillStyle = "rgb(22, 24, 26)";
      k.fillRect(3.5, 0, 3, h);
      k.fillStyle = "rgba(180, 110, 60, 0.4)";
      k.fillRect(4.1, 0, 0.6, h);
      k.fillRect(5.3, 0, 0.6, h);
    } else if (z === 1) {
      fels(k, w, h, mix3(p.grund, p.tief, 0.3), 31 + seite, { groesse: 1.3 });
      // Ein Stempel aus Holz längs an den Magneten.
      k.fillStyle = "rgb(54, 38, 24)";
      k.fillRect(0.8, 0, 4.2, h);
      k.fillStyle = "rgba(255, 200, 140, 0.08)";
      k.fillRect(1, 0, 0.6, h);
      for (let y = 12; y < h; y += 40) { k.fillStyle = "rgb(30, 26, 24)"; k.fillRect(0.6, y, 4.6, 1.2); }
    } else if (z === 2) {
      fels(k, w, h, mix3(p.grund, p.tief, 0.3), 41 + seite, { groesse: 1.3 });
      for (let i = 0; i < 9; i += 1) {
        const x = 3 + zz() * (w - 4);
        const y = zz() * h;
        rundum(h, (o) => kristall(k, x, y + o, 1.4 + zz() * 2.2, zz() - 0.5));
      }
    } else {
      fels(k, w, h, mix3(p.grund, p.tief, 0.3), 51 + z + seite, { groesse: 1.5, kontrast: 0.9 });
      const n = Math.max(2, Math.round(w / 9));
      for (let i = 0; i < n; i += 1) riss(k, h, zz, 3 + zz() * (w - 3), zz() * h, 20, z === 4 ? [255, 196, 90] : p.akzent, 1);
    }
    // Nach aussen dunkler; an der Kante zu den Magneten eine Schiene aus
    // Stahl.
    const v = k.createLinearGradient(0, 0, w, 0);
    v.addColorStop(0, "rgba(0,0,0,0)");
    v.addColorStop(Math.min(1, 26 / w), "rgba(0,0,0,0.35)");
    v.addColorStop(1, "rgba(0,0,0,0.78)");
    k.fillStyle = v;
    k.fillRect(0, 0, w, h);
    k.fillStyle = "rgb(30, 33, 38)";
    k.fillRect(0, 0, 1.2, h);
    k.fillStyle = "rgba(200, 210, 230, 0.12)";
    k.fillRect(0.2, 0, 0.3, h);
  }

  // --- Die Magnete ----------------------------------------------------------
  /*
   * Ein Magnet in der Wand: vorn die Wicklung aus Kupfer, zum Schacht hin
   * der Polschuh, der in seiner Farbe leuchtet. Gemalt wird ein Stück von
   * KAPPE + KACHEL + KAPPE Einheiten, aufgelegt: die obere Kappe, so viele
   * Stücke, wie hineinpassen (das letzte abgeschnitten), die untere Kappe.
   * Rot ist der Nordpol, blau der Südpol, grau ist unmagnetisch, «aus» ist
   * ein Magnet ohne Strom.
   */
  const FARBEN = {
    rot: { pol: [255, 64, 84], kern: [255, 214, 218], wicklung: [120, 46, 40] },
    blau: { pol: [60, 150, 255], kern: [214, 236, 255], wicklung: [54, 60, 96] },
    grau: { pol: [128, 136, 150], kern: [176, 184, 198], wicklung: [64, 68, 76] },
    aus: { pol: [52, 54, 60], kern: [70, 72, 80], wicklung: [34, 30, 30] },
  };
  function maleMagnet(art, seite) {
    const ganz = maleMagnetGanz(art, seite);
    // In drei Stücke geschnitten, auf ganze Bildpunkte: Kappe, Stück, Kappe.
    const kap = Math.max(1, Math.round(KAPPE * bilder.f));
    const mitte = Math.round(KACHEL * bilder.f);
    const stueck = (y0, h) => {
      const c = leinwand(ganz.width, h);
      c.getContext("2d").drawImage(ganz, 0, y0, ganz.width, h, 0, 0, ganz.width, h);
      return c;
    };
    return { oben: stueck(0, kap), mitte: stueck(kap, mitte), unten: stueck(ganz.height - kap, kap), kap };
  }
  function maleMagnetGanz(art, seite) {
    const f = FARBEN[art];
    return inEinheiten(BLOCK, 2 * KAPPE + KACHEL, (k, w, h) => {
      if (seite > 0) { k.translate(w, 0); k.scale(-1, 1); }
      // Der Polschuh liegt rechts (am Schacht), aussen links die Wicklung.
      const stueck = (y0, hoch) => {
        k.fillStyle = "rgb(24, 26, 31)";
        k.fillRect(0, y0, w, hoch);
        if (art === "grau") {
          k.fillStyle = "rgb(78, 84, 96)";
          k.fillRect(0.6, y0, w - 0.6, hoch);
          k.fillStyle = "rgba(255,255,255,0.08)";
          k.fillRect(0.6, y0, 1, hoch);
        } else {
          for (let y = y0; y < y0 + hoch; y += 1) {
            const t = (Math.floor(y) % 2) ? 0.85 : 1;
            k.fillStyle = rgb(mix3(f.wicklung, [0, 0, 0], 1 - t));
            k.fillRect(0.6, y, w - 2.6, 0.8);
          }
          if (art !== "aus") {
            const v = k.createLinearGradient(0.6, 0, w, 0);
            v.addColorStop(0, rgba(f.pol, 0.12));
            v.addColorStop(0.65, rgba(f.pol, 0.45));
            v.addColorStop(1, rgba(f.pol, 0.85));
            k.fillStyle = v;
            k.fillRect(0.6, y0, w - 0.6, hoch);
          }
        }
        // Der Polschuh.
        k.fillStyle = rgb(f.pol);
        k.fillRect(w - 2, y0, 2, hoch);
        k.fillStyle = rgb(f.kern);
        k.fillRect(w - 1.1, y0, 0.55, hoch);
      };
      stueck(KAPPE, KACHEL);
      // Die Kappen: rund, mit einem Niet.
      const kappe = (y0, oben) => {
        k.save();
        k.beginPath();
        k.rect(0, y0, w, KAPPE);
        k.clip();
        stueck(oben ? y0 : y0 - KACHEL, KACHEL + KAPPE);
        k.restore();
        k.fillStyle = "rgb(20, 22, 26)";
        k.fillRect(0, oben ? y0 : y0 + KAPPE - 0.5, w, 0.5);
        k.fillStyle = "rgba(200, 206, 220, 0.25)";
        k.beginPath(); k.arc(w * 0.35, y0 + KAPPE / 2, 0.35, 0, TAU); k.fill();
      };
      kappe(0, true);
      kappe(KAPPE + KACHEL, false);
    });
  }

  // N oder S auf dem Magneten: hell, klein, damit man es auch ohne Farben liest.
  function maleEtikett(text, farbe) {
    const f = bilder.f;
    const n = Math.max(6, Math.round(4.4 * f));
    const c = leinwand(n, n);
    const k = c.getContext("2d");
    k.font = `900 ${Math.round(n * 0.8)}px system-ui, sans-serif`;
    k.textAlign = "center";
    k.textBaseline = "middle";
    k.fillStyle = "rgba(10, 10, 14, 0.55)";
    k.fillText(text, n / 2 + n * 0.04, n / 2 + n * 0.06);
    k.fillStyle = rgba(farbe, 0.92);
    k.fillText(text, n / 2, n / 2);
    return c;
  }

  // --- Die Stacheln ---------------------------------------------------------
  function maleStachel(seite) {
    return inEinheiten(STACHEL + 1, KACHEL, (k, w, h) => {
      if (seite > 0) { k.translate(w, 0); k.scale(-1, 1); }
      // An der Wand (x = 0) eine Leiste, die Spitzen zeigen in den Schacht.
      k.fillStyle = "rgb(40, 42, 48)";
      k.fillRect(0, 0, 1, h);
      for (let i = 0; i < 2; i += 1) {
        const y0 = i * (h / 2);
        k.fillStyle = "rgb(150, 156, 168)";
        k.beginPath(); k.moveTo(0.6, y0 + 0.3); k.lineTo(STACHEL + 0.6, y0 + h / 4); k.lineTo(0.6, y0 + h / 2 - 0.3); k.closePath(); k.fill();
        k.fillStyle = "rgba(255, 255, 255, 0.55)";
        k.beginPath(); k.moveTo(0.6, y0 + 0.3); k.lineTo(STACHEL + 0.6, y0 + h / 4); k.lineTo(0.6, y0 + h / 4); k.closePath(); k.fill();
        k.strokeStyle = "rgba(10, 10, 14, 0.8)";
        k.lineWidth = 0.25;
        k.beginPath(); k.moveTo(0.6, y0 + 0.3); k.lineTo(STACHEL + 0.6, y0 + h / 4); k.lineTo(0.6, y0 + h / 2 - 0.3); k.stroke();
      }
    });
  }

  // --- Die Sperren ----------------------------------------------------------
  // Eine Platte, laenge lang, an der Wand der Seite (−1 links, 1 rechts); ihr
  // freies Ende ist die Kante der Lücke – dort ist sie hell.
  function maleSperre(k, laenge, seite, z) {
    const w = laenge + 1;
    if (seite > 0) { k.translate(w, 0); k.scale(-1, 1); }
    // Gemalt von der Wand (x = 0) zum freien Ende (x = laenge), oben y = 0.
    const d = DICKE;
    k.fillStyle = "rgba(0, 0, 0, 0.35)";
    k.fillRect(0, d, laenge - 0.5, 1.6);
    k.fillStyle = "rgba(0, 0, 0, 0.18)";
    k.fillRect(0, d + 1.6, laenge - 1.2, 1.2);
    const v = k.createLinearGradient(0, 0, 0, d);
    if (z === 0) {
      v.addColorStop(0, "rgb(170, 178, 190)");
      v.addColorStop(0.5, "rgb(118, 126, 140)");
      v.addColorStop(1, "rgb(70, 76, 88)");
      k.fillStyle = v;
      k.fillRect(0, 0, laenge, d);
      k.fillStyle = "rgba(255,255,255,0.5)";
      k.fillRect(0, 0, laenge, 0.5);
      k.fillStyle = "rgb(196, 150, 70)";
      for (let x = 3; x < laenge - 6; x += 6) { k.beginPath(); k.arc(x, d / 2, 0.45, 0, TAU); k.fill(); }
      // Am freien Ende gelb-schwarz.
      k.save();
      k.beginPath(); k.rect(laenge - 5, 0, 5, d); k.clip();
      k.fillStyle = "rgb(240, 196, 40)";
      k.fillRect(laenge - 5, 0, 5, d);
      k.fillStyle = "rgb(24, 24, 26)";
      for (let x = laenge - 8; x < laenge + 4; x += 2.4) { k.beginPath(); k.moveTo(x, d); k.lineTo(x + 1.2, d); k.lineTo(x + 1.2 + d, 0); k.lineTo(x + d, 0); k.closePath(); k.fill(); }
      k.restore();
    } else if (z === 1) {
      v.addColorStop(0, "rgb(150, 110, 70)");
      v.addColorStop(1, "rgb(84, 58, 36)");
      k.fillStyle = v;
      k.fillRect(0, 0, laenge, d);
      k.strokeStyle = "rgba(40, 24, 12, 0.55)";
      k.lineWidth = 0.25;
      for (let i = 1; i < 4; i += 1) { k.beginPath(); k.moveTo(0, i * d / 4); for (let x = 0; x <= laenge; x += 4) k.lineTo(x, i * d / 4 + Math.sin(x * 0.4 + i) * 0.3); k.stroke(); }
      for (let x = 6; x < laenge - 3; x += 12) { k.fillStyle = "rgb(40, 40, 44)"; k.fillRect(x, 0, 1.4, d); k.fillStyle = "rgba(255,255,255,0.15)"; k.fillRect(x, 0, 1.4, 0.4); }
      k.fillStyle = "rgb(214, 178, 120)";
      k.fillRect(laenge - 1.2, 0, 1.2, d);
      k.fillStyle = "rgba(255, 230, 180, 0.5)";
      k.fillRect(0, 0, laenge, 0.45);
    } else if (z === 2) {
      v.addColorStop(0, "rgb(70, 64, 104)");
      v.addColorStop(1, "rgb(24, 22, 40)");
      k.fillStyle = v;
      k.beginPath(); k.moveTo(0, 0); k.lineTo(laenge - 2.5, 0); k.lineTo(laenge, d / 2); k.lineTo(laenge - 2.5, d); k.lineTo(0, d); k.closePath(); k.fill();
      k.strokeStyle = "rgba(220, 214, 255, 0.85)";
      k.lineWidth = 0.35;
      k.beginPath(); k.moveTo(0, 0.2); k.lineTo(laenge - 2.5, 0.2); k.lineTo(laenge, d / 2); k.lineTo(laenge - 2.5, d - 0.2); k.stroke();
      k.strokeStyle = "rgba(180, 170, 255, 0.35)";
      for (let x = 5; x < laenge - 3; x += 7) { k.beginPath(); k.moveTo(x, 0); k.lineTo(x + 2, d); k.stroke(); }
    } else {
      const heiss = z === 4;
      v.addColorStop(0, heiss ? "rgb(110, 84, 60)" : "rgb(88, 72, 70)");
      v.addColorStop(1, heiss ? "rgb(52, 36, 24)" : "rgb(36, 28, 28)");
      k.fillStyle = v;
      k.fillRect(0, 0, laenge, d);
      k.strokeStyle = heiss ? "rgba(255, 230, 160, 0.85)" : "rgba(255, 150, 60, 0.85)";
      k.lineWidth = 0.4;
      k.beginPath();
      for (let x = 0; x < laenge; x += 3) k.lineTo(x, d * 0.55 + Math.sin(x * 0.9) * 0.9);
      k.stroke();
      k.fillStyle = heiss ? "rgb(255, 226, 150)" : "rgb(255, 160, 70)";
      k.fillRect(laenge - 1, 0, 1, d);
      k.fillStyle = "rgba(255, 220, 180, 0.3)";
      k.fillRect(0, 0, laenge, 0.45);
    }
  }

  // --- Die Kugel ------------------------------------------------------------
  /*
   * Polierter Stahl: oben hell (Licht von oben aus dem Schacht), unten
   * dunkel, ein heller Horizont, Glanzlichter – und ihre Polung als Farbe,
   * wie eloxiert, mit einem leuchtenden Ring um den Bauch. Was sich bewegt
   * (das rote und blaue Licht der Wände auf ihren Seiten), kommt je Bild
   * dazu.
   */
  function maleKugel(p) {
    const f = bilder.f;
    const rand = 1.2;
    const n = Math.max(8, Math.round(2 * (R + rand) * f));
    const c = leinwand(n, n);
    const k = c.getContext("2d");
    k.scale(n / (2 * (R + rand)), n / (2 * (R + rand)));
    k.translate(R + rand, R + rand);
    // p = 0: ohne Strom, nach dem Sturz – grau.
    const farbe = p > 0 ? [235, 64, 82] : p < 0 ? [52, 128, 240] : [70, 72, 80];
    const hell = p > 0 ? [255, 190, 196] : p < 0 ? [190, 222, 255] : [120, 122, 130];
    // Der Körper.
    let v = k.createRadialGradient(-R * 0.35, -R * 0.45, R * 0.1, 0, 0, R);
    v.addColorStop(0, "rgb(250, 252, 255)");
    v.addColorStop(0.35, "rgb(176, 182, 194)");
    v.addColorStop(0.75, "rgb(84, 90, 102)");
    v.addColorStop(1, "rgb(30, 32, 40)");
    k.fillStyle = v;
    k.beginPath(); k.arc(0, 0, R, 0, TAU); k.fill();
    // Die Umgebung im Stahl: unten dunkel, ein heller Horizont.
    k.save();
    k.beginPath(); k.arc(0, 0, R, 0, TAU); k.clip();
    k.fillStyle = "rgba(10, 12, 18, 0.55)";
    k.beginPath(); k.ellipse(0, R * 0.55, R * 1.2, R * 0.62, 0, 0, TAU); k.fill();
    k.fillStyle = "rgba(255, 255, 255, 0.18)";
    k.fillRect(-R, R * 0.02, 2 * R, R * 0.1);
    // Die Polung, wie eloxiert.
    k.globalCompositeOperation = "source-atop";
    k.fillStyle = rgba(farbe, 0.58);
    k.fillRect(-R, -R, 2 * R, 2 * R);
    k.globalCompositeOperation = "source-over";
    // Der leuchtende Ring um den Bauch.
    k.strokeStyle = rgba(hell, 0.95);
    k.lineWidth = R * 0.16;
    k.beginPath(); k.ellipse(0, R * 0.08, R * 0.98, R * 0.3, 0, 0, Math.PI); k.stroke();
    k.strokeStyle = rgba(hell, 0.35);
    k.beginPath(); k.ellipse(0, R * 0.08, R * 0.98, R * 0.3, 0, Math.PI, TAU); k.stroke();
    k.restore();
    // Glanzlichter.
    v = k.createRadialGradient(-R * 0.38, -R * 0.48, 0, -R * 0.38, -R * 0.48, R * 0.5);
    v.addColorStop(0, "rgba(255, 255, 255, 0.95)");
    v.addColorStop(1, "rgba(255, 255, 255, 0)");
    k.fillStyle = v;
    k.beginPath(); k.arc(-R * 0.38, -R * 0.48, R * 0.5, 0, TAU); k.fill();
    k.fillStyle = "rgba(255, 255, 255, 0.95)";
    k.beginPath(); k.ellipse(-R * 0.36, -R * 0.5, R * 0.16, R * 0.1, -0.6, 0, TAU); k.fill();
    // Der Rand.
    k.strokeStyle = "rgba(10, 12, 16, 0.7)";
    k.lineWidth = R * 0.06;
    k.beginPath(); k.arc(0, 0, R - R * 0.03, 0, TAU); k.stroke();
    return { bild: c, rand };
  }

  // ---------------------------------------------------------------------------
  // Zeichnen
  // ---------------------------------------------------------------------------
  // Ein vorgemaltes Bild, das sich nach per Bildpunkten wiederholt, in die
  // Zeilen y0 bis y1 legen (alles in Bildpunkten des Geräts): Die Zeile Y
  // zeigt die Zeile (Y − o) des Bildes.
  function lege(bild, o, x, y0, y1) {
    const per = bild.height;
    let y = y0;
    while (y < y1) {
      const ty = (((y - o) % per) + per) % per;
      const h = Math.min(per - ty, y1 - y);
      g.drawImage(bild, 0, ty, bild.width, h, x, y, bild.width, h);
      y += h;
    }
  }

  // Wo die Tiefe 0 im Bild liegt, in Bildpunkten des Geräts – gerundet: So
  // liegt alles, was vorgemalt ist, Punkt auf Punkt.
  const nullY = () => Math.round((view.kugelY - state.camY * view.s) * view.dpr);
  const geraetY = (y) => nullY() + Math.round(y * bilder.f);
  const sichtOben = () => state.camY - view.kugelY / view.s;
  const sichtUnten = () => state.camY + (view.cssH - view.kugelY) / view.s;

  // Das Licht der Magnete im Schacht: ein Streifen je Farbe und Wand, KACHEL
  // hoch, einmal gemalt und Stück um Stück aufgelegt (ein Verlauf über die
  // ganze Höhe kostete auf dem iPhone jedes Bild Millisekunden).
  let licht = null;
  function lichtFuer() {
    if (licht) return licht;
    const weit = 21;
    const mk = (farbe, a, seite) => inEinheiten(weit, KACHEL, (k, w, h) => {
      const v = seite < 0 ? k.createLinearGradient(0, 0, w, 0) : k.createLinearGradient(w, 0, 0, 0);
      v.addColorStop(0, rgba(farbe, a));
      v.addColorStop(0.16, rgba(farbe, a * 0.5));
      v.addColorStop(0.5, rgba(farbe, a * 0.14));
      v.addColorStop(1, rgba(farbe, 0));
      k.fillStyle = v;
      k.fillRect(0, 0, w, h);
    });
    licht = {
      1: { l: mk([255, 60, 80], 0.72, -1), r: mk([255, 60, 80], 0.72, 1) },
      [-1]: { l: mk([60, 140, 255], 0.78, -1), r: mk([60, 140, 255], 0.78, 1) },
      weit,
    };
    return licht;
  }

  // --- Rückwand und Wände ---------------------------------------------------
  function zeichneRueckwand() {
    const dpr = view.dpr;
    const f = bilder.f;
    const x = Math.round(bildX(-HALB) * dpr);
    const oR = Math.round((view.kugelY - state.camY * PAR * view.s) * dpr);
    const H = canvas.height;
    // Die Zonen der Rückwand: Sie wechseln, wenn die Kugel die Grenze
    // erreicht (dort, wo sie im Bild steht).
    const uVon = (0 - oR) / f;
    const uBis = (H - oR) / f;
    for (let z = 0; z < ZONEN.length; z += 1) {
      const a = ZONEN[z].ab * METER * PAR;
      const b = z + 1 < ZONEN.length ? ZONEN[z + 1].ab * METER * PAR : Infinity;
      if (b < uVon || a > uBis) continue;
      const y0 = z === 0 ? 0 : Math.max(0, oR + Math.round(a * f));
      const y1 = Math.min(H, b === Infinity ? H : oR + Math.round(b * f));
      if (y1 > y0) lege(rueckFuer(z), oR, x, y0, y1);
    }
  }

  function zeichneWaende() {
    const dpr = view.dpr;
    const f = bilder.f;
    const o = nullY();
    const H = canvas.height;
    const xl = Math.round(bildX(-HALB - BLOCK) * dpr);
    const xr = Math.round(bildX(HALB + BLOCK) * dpr);
    const yVon = sichtOben();
    const yBis = sichtUnten();
    for (let z = 0; z < ZONEN.length; z += 1) {
      const a = ZONEN[z].ab * METER;
      const b = z + 1 < ZONEN.length ? ZONEN[z + 1].ab * METER : Infinity;
      if (b < yVon || a > yBis) continue;
      const w = wandFuer(z);
      if (!w) return;
      const y0 = Math.max(0, z === 0 ? 0 : o + Math.round(a * f));
      const y1 = Math.min(H, b === Infinity ? H : o + Math.round(b * f));
      if (y1 <= y0) continue;
      lege(w.l, o, xl - w.l.width, y0, y1);
      lege(w.r, o, xr, y0, y1);
    }
  }

  // An jeder Zonengrenze ein Träger quer durch den Schacht – in der Wand
  // (mit dem Schacht) und in der Rückwand (langsamer).
  function zeichneGrenzen() {
    const s = view.s;
    const yVon = sichtOben() - 10;
    const yBis = sichtUnten() + 10;
    for (let z = 1; z < ZONEN.length; z += 1) {
      const y = ZONEN[z].ab * METER;
      // In der Rückwand: dort, wo sie mit PAR vorbeizieht.
      const yR = view.kugelY + (y * PAR - state.camY * PAR) * s;
      if (yR > -20 && yR < view.cssH + 20) {
        g.fillStyle = "rgb(22, 24, 28)";
        g.fillRect(bildX(-HALB), yR - 2.5 * s, 2 * HALB * s, 5 * s);
        g.fillStyle = "rgba(210, 220, 240, 0.12)";
        g.fillRect(bildX(-HALB), yR - 2.5 * s, 2 * HALB * s, 0.6 * s);
        g.fillStyle = "rgba(255, 210, 150, 0.7)";
        for (let x = -HALB + 6; x < HALB; x += 12) g.fillRect(bildX(x), yR - 0.5 * s, 1.2 * s, 1.2 * s);
      }
      if (y < yVon || y > yBis) continue;
      const by = bildY(y);
      g.fillStyle = "rgb(26, 28, 34)";
      g.fillRect(0, by - 3 * s, bildX(-HALB - BLOCK), 6 * s);
      g.fillRect(bildX(HALB + BLOCK), by - 3 * s, view.cssW, 6 * s);
      g.fillStyle = "rgba(210, 220, 240, 0.16)";
      g.fillRect(0, by - 3 * s, bildX(-HALB - BLOCK), 0.7 * s);
      g.fillRect(bildX(HALB + BLOCK), by - 3 * s, view.cssW, 0.7 * s);
    }
  }

  // Oben im Schacht: die Decke des Labors und der Halter, an dem die Kugel
  // vor dem Loslassen hängt.
  function zeichneDecke() {
    const s = view.s;
    const yd = -26;
    if (bildY(yd) < -40) return;
    const by = bildY(yd);
    g.fillStyle = "rgb(18, 20, 24)";
    g.fillRect(0, 0, view.cssW, Math.max(0, by - 4 * s));
    g.fillStyle = "rgb(40, 44, 52)";
    g.fillRect(0, by - 4 * s, view.cssW, 5 * s);
    g.fillStyle = "rgba(220, 228, 245, 0.18)";
    g.fillRect(0, by - 4 * s, view.cssW, 0.7 * s);
    g.fillStyle = "rgb(200, 160, 60)";
    for (let x = -HALB - BLOCK; x <= HALB + BLOCK; x += 6) {
      g.fillRect(bildX(x), by + 1 * s, 3 * s, 1 * s);
    }
    // Der Halter: ein Kabel, ein Elektromagnet aus Kupfer.
    const hx = bildX(0);
    const unten = bildY(state.phase === "bereit" ? -R + 0.4 : -R - 1.5);
    g.strokeStyle = "rgb(14, 14, 16)";
    g.lineWidth = Math.max(1, 0.8 * s);
    g.beginPath(); g.moveTo(hx, by + s); g.lineTo(hx, unten - 4 * s); g.stroke();
    g.fillStyle = "rgb(52, 56, 64)";
    g.fillRect(hx - 3.2 * s, unten - 4.4 * s, 6.4 * s, 4.4 * s);
    g.fillStyle = "rgb(168, 100, 54)";
    for (let i = 0; i < 4; i += 1) g.fillRect(hx - 2.8 * s, unten - 4 * s + i * 1 * s, 5.6 * s, 0.6 * s);
    g.fillStyle = state.phase === "bereit" ? "rgb(255, 90, 100)" : "rgb(70, 72, 80)";
    g.fillRect(hx - 3.2 * s, unten - 0.7 * s, 6.4 * s, 0.7 * s);
    // Eine Lampe an der Decke.
    if (bilder.schein.lampe) {
      const sch = bilder.schein.lampe;
      g.globalCompositeOperation = "lighter";
      g.globalAlpha = 0.55;
      g.drawImage(sch, bildX(-HALB * 0.55) - sch.width / view.dpr / 2, by + 3 * s - sch.height / view.dpr / 2, sch.width / view.dpr, sch.height / view.dpr);
      g.globalAlpha = 1;
      g.globalCompositeOperation = "source-over";
    }
  }

  // --- Die Magnete ----------------------------------------------------------
  // Welche Farbe ein Magnet gerade zeigt: aus, solange der Strom noch nicht
  // da ist (beim ersten Start) oder wenn es nach einem Sturz flackert.
  function magnetArt(r, seite) {
    if (r.art === "aus") return "aus";
    if (state.flimmern > 0 && (state.flimmern < 0.25 || Math.sin(state.zeit * 70 + r.nr) > 0.2)) return "aus";
    if (state.strom < 1 && r.y0 > sichtOben() + state.strom * (sichtUnten() - sichtOben() + 40) - 20) return "aus";
    const c = farbe(r, seite, state.t);
    return c > 0 ? "rot" : c < 0 ? "blau" : "grau";
  }

  // Ein Wechselfeld: kurz vor jedem Wechsel lädt es sich auf (heller), beim
  // Wechsel blitzt es.
  function wechselLicht(r) {
    if (r.art !== "wechsel") return { lade: 0, blitz: 0 };
    const t = state.t;
    const n = Math.floor((t - r.w0) / r.P) + 1;
    const naechster = n < r.wn ? r.w0 + Math.max(0, n) * r.P : Infinity;
    const letzter = n >= 1 ? r.w0 + (Math.min(n, r.wn) - 1) * r.P : -Infinity;
    return { lade: clamp(1 - (naechster - t) / 0.32, 0, 1), blitz: clamp(1 - (t - letzter) / 0.16, 0, 1) };
  }

  function zeichneMagnete() {
    const dpr = view.dpr;
    const f = bilder.f;
    const s = view.s;
    const o = nullY();
    const H = canvas.height;
    const xl = Math.round(bildX(-HALB - BLOCK) * dpr);
    const xr = Math.round(bildX(HALB) * dpr);
    const kap = bilder.magnet.rot.l.kap;
    const yVon = sichtOben() - 4;
    const yBis = sichtUnten() + 4;
    const lt = lichtFuer();
    const reihen = state.reihen;
    const sichtbar = [];
    for (let i = Math.max(0, reiheHint - 40); i < reihen.length; i += 1) {
      const r = reihen[i];
      if (r.y0 > yBis) break;
      if (r.y1 < yVon) continue;
      sichtbar.push(r);
    }
    // Zuerst das Licht in den Schacht (es fällt auf die Rückwand) …
    g.setTransform(1, 0, 0, 1, 0, Math.round(wackel() * dpr));
    g.globalCompositeOperation = "lighter";
    const lxL = Math.round(bildX(-HALB) * dpr);
    const lxR = Math.round(bildX(HALB) * dpr);
    sichtbar.forEach((r) => {
      const wl = wechselLicht(r);
      const ya = o + Math.round(r.y0 * f);
      const y0 = Math.max(0, ya);
      const y1 = Math.min(H, r.y1 === Infinity ? H : o + Math.round(r.y1 * f));
      if (y1 <= y0) return;
      [-1, 1].forEach((seite) => {
        const art = magnetArt(r, seite);
        if (art !== "rot" && art !== "blau") return;
        const bild = lt[art === "rot" ? 1 : -1][seite < 0 ? "l" : "r"];
        g.globalAlpha = clamp(0.7 + wl.lade * 0.3 + wl.blitz * 0.3, 0, 1);
        lege(bild, ya, seite < 0 ? lxL : lxR - bild.width, y0, y1);
      });
    });
    g.globalAlpha = 1;
    g.globalCompositeOperation = "source-over";
    // … dann die Magnete selbst, Punkt auf Punkt.
    sichtbar.forEach((r) => {
      const ya = o + Math.round(r.y0 * f);
      const yb = r.y1 === Infinity ? H + 10 : o + Math.round(r.y1 * f);
      const y0 = Math.max(ya, -kap - 2);
      const y1 = Math.min(yb, H + kap + 2);
      if (y1 <= y0) return;
      [-1, 1].forEach((seite) => {
        const m = bilder.magnet[magnetArt(r, seite)][seite < 0 ? "l" : "r"];
        const x = seite < 0 ? xl : xr;
        // Kappe oben, Stücke, Kappe unten.
        if (ya >= -kap) g.drawImage(m.oben, x, ya);
        const vonM = Math.max(ya + kap, y0);
        const bisM = Math.min(yb - kap, y1);
        if (bisM > vonM) lege(m.mitte, ya + kap, x, vonM, bisM);
        if (yb - kap <= H) g.drawImage(m.unten, x, yb - kap);
      });
      // N oder S, wenn der Magnet hoch genug ist.
      if (r.art !== "aus" && (r.y1 - r.y0) > 22) {
        const ym = o + Math.round(((r.y0 + Math.min(r.y1, r.y0 + 60)) / 2) * f);
        [-1, 1].forEach((seite) => {
          const art = magnetArt(r, seite);
          const et = art === "rot" ? bilder.etikett[1] : art === "blau" ? bilder.etikett[-1] : null;
          if (!et) return;
          const xm = Math.round(bildX(seite * (HALB + BLOCK / 2 + 0.6)) * dpr - et.width / 2);
          g.drawImage(et, xm, ym - (et.height >> 1));
        });
      }
    });
    // Ein Wechselfeld: Rauten auf den Magneten, die sich vor jedem Wechsel
    // aufladen, und ein Blitz beim Wechsel. Ein Stromausfall: Der Schacht ist
    // dort dunkel, auf den toten Magneten blinken Notlichter.
    g.setTransform(dpr, 0, 0, dpr, 0, Math.round(wackel() * dpr));
    sichtbar.forEach((r) => {
      const y0 = Math.max(-10, bildY(r.y0));
      const y1 = Math.min(view.cssH + 10, bildY(Math.min(r.y1, yBis + 50)));
      if (y1 <= y0) return;
      if (r.art === "wechsel") {
        const wl = wechselLicht(r);
        g.fillStyle = `rgba(255, 255, 255, ${0.5 * wl.blitz + 0.12 * wl.lade})`;
        g.fillRect(bildX(-HALB - 2), y0, 2 * s, y1 - y0);
        g.fillRect(bildX(HALB), y0, 2 * s, y1 - y0);
        g.fillStyle = `rgba(255, 246, 220, ${0.3 + 0.7 * Math.max(wl.lade, wl.blitz)})`;
        const d = 1.1 * s;
        for (let y = r.y0 + 4; y < Math.min(r.y1, yBis + 10) - 2; y += 7) {
          const yy = bildY(y);
          if (yy < -5 || yy > view.cssH + 5) continue;
          [-1, 1].forEach((seite) => {
            const x = bildX(seite * (HALB + BLOCK * 0.5));
            g.beginPath(); g.moveTo(x, yy - d); g.lineTo(x + d, yy); g.lineTo(x, yy + d); g.lineTo(x - d, yy); g.closePath(); g.fill();
          });
        }
      } else if (r.art === "aus") {
        g.fillStyle = "rgba(2, 3, 6, 0.42)";
        g.fillRect(bildX(-HALB), y0, 2 * HALB * s, y1 - y0);
        for (let y = r.y0 + 10; y < Math.min(r.y1, yBis + 10) - 4; y += 30) {
          const yy = bildY(y);
          const an = ruhig() || Math.sin(state.zeit * 3 + y * 0.1) > -0.2;
          g.fillStyle = an ? "rgba(150, 255, 140, 0.9)" : "rgba(60, 90, 60, 0.8)";
          [-1, 1].forEach((seite) => g.fillRect(bildX(seite * (HALB + BLOCK * 0.5)) - 0.8 * s, yy - 0.8 * s, 1.6 * s, 1.6 * s));
        }
      }
    });
    zeichneSpaene(sichtbar);
  }

  // Eisenspäne auf den Magneten neben der Kugel: Sie richten sich nach dem
  // Feld – zur Kugel hin, wenn er sie anzieht, quer, wenn er sie abstösst.
  function zeichneSpaene(sichtbar) {
    if (state.schritt === "sturz" || state.phase === "bereit") return;
    const k = state.kugel;
    const s = view.s;
    const bx = bildX(k.x);
    const by = bildY(k.y);
    g.lineWidth = Math.max(0.8, 0.28 * s);
    g.strokeStyle = "rgba(14, 12, 16, 0.55)";
    g.beginPath();
    sichtbar.forEach((r) => {
      if (r.y1 < k.y - 26 || r.y0 > k.y + 26) return;
      [-1, 1].forEach((seite) => {
        const c = farbe(r, seite, state.t);
        if (!c || magnetArt(r, seite) === "aus") return;
        const zieht = c !== k.p;
        for (let i = 0; i < 9; i += 1) {
          const yy = k.y - 22 + i * 5.5 + (hash01(r.nr * 3 + i) - 0.5) * 2;
          if (yy < r.y0 + 1 || yy > r.y1 - 1) continue;
          const xx = seite * (HALB + 1.2 + hash01(r.nr + i * 7) * 3.6);
          const px = bildX(xx);
          const py = bildY(yy);
          let a = Math.atan2(by - py, bx - px);
          if (!zieht) a += Math.PI / 2 * (yy < k.y ? -1 : 1) * 0.8;
          const l = 1.1 * s;
          g.moveTo(px - Math.cos(a) * l, py - Math.sin(a) * l);
          g.lineTo(px + Math.cos(a) * l, py + Math.sin(a) * l);
        }
      });
    });
    g.stroke();
  }

  // --- Stacheln und Sperren -------------------------------------------------
  function zeichneHindernisse() {
    const dpr = view.dpr;
    const f = bilder.f;
    const o = nullY();
    const H = canvas.height;
    const yVon = sichtOben() - 10;
    const yBis = sichtUnten() + 10;
    g.setTransform(1, 0, 0, 1, 0, Math.round(wackel() * dpr));
    const lx = Math.round(bildX(-HALB) * dpr) - Math.round(0.6 * f);
    const rx = Math.round(bildX(HALB) * dpr) + Math.round(0.6 * f);
    state.stacheln.forEach((st) => {
      if (st.y1 < yVon || st.y0 > yBis) return;
      const bild = st.seite < 0 ? bilder.stachel.l : bilder.stachel.r;
      const ya = o + Math.round(st.y0 * f);
      const yb = o + Math.round(st.y1 * f);
      lege(bild, ya, st.seite < 0 ? lx : rx - bild.width, Math.max(0, ya), Math.min(H, yb));
    });
    const sp = state.sperren;
    for (let i = indexAb(sp, yVon); i < sp.length && sp[i].y0 < yBis; i += 1) {
      const s = sp[i];
      const b = sperreFuer(zoneBei(s.y0));
      const y = o + Math.round(s.y0 * f);
      const xL = Math.round(bildX(-HALB) * dpr);
      const xR = Math.round(bildX(HALB) * dpr);
      if (s.luecke === -1) g.drawImage(b.langR, xR - b.langR.width, y);
      else if (s.luecke === 1) g.drawImage(b.langL, xL, y);
      else { g.drawImage(b.kurzL, xL, y); g.drawImage(b.kurzR, xR - b.kurzR.width, y); }
    }
    g.setTransform(dpr, 0, 0, dpr, 0, Math.round(wackel() * dpr));
  }

  // --- Feldlinien -----------------------------------------------------------
  /*
   * Zwischen Kugel und Wand: Zieht die Wand an, laufen feine Bögen von der
   * Kugel zum Magneten, und Licht fliesst darauf zur Wand. Stösst sie ab,
   * biegen die Linien von der Kugel und vom Magneten auseinander, und
   * dazwischen bleibt ein Spalt. Je näher, desto heller.
   */
  function zeichneFeldlinien() {
    if (state.schritt === "sturz" || state.phase === "bereit" || state.strom < 1) return;
    const k = state.kugel;
    const r = reiheBei(Math.max(0, state.t));
    if (!r) return;
    const s = view.s;
    const bx = bildX(k.x);
    const by = bildY(k.y);
    const uhr = ruhig() ? 0.4 : state.zeit;
    g.globalCompositeOperation = "lighter";
    g.lineCap = "round";
    const ROT = [255, 110, 128];
    const BLAU = [110, 176, 255];
    [-1, 1].forEach((seite) => {
      const c = farbe(r, seite, state.t);
      if (!c || magnetArt(r, seite) === "aus") return;
      const zieht = c !== k.p;
      const wx = bildX(seite * HALB);
      const abstand = Math.abs(seite * XW - k.x);
      const nah = 1 - abstand / (2 * XW);
      const farbeW = c > 0 ? ROT : BLAU;
      const farbeK = k.p > 0 ? ROT : BLAU;
      if (zieht) {
        // Ungleich: Linien verbinden Kugel und Magnet, die Farbe geht von der
        // einen in die andere über, und Lichtperlen fliessen zur Wand.
        if (abstand < 1.5) {
          // Sie klebt: kurze Bögen um die Stelle, an der sie anliegt.
          g.strokeStyle = rgba(mix3(farbeW, [255, 255, 255], 0.4), 0.45);
          g.lineWidth = Math.max(1, 0.3 * s);
          [-1, 1].forEach((i) => {
            g.beginPath();
            g.arc(wx, by + i * R * 0.75 * s, R * 0.6 * s, seite > 0 ? Math.PI * 0.55 : -Math.PI * 0.45, seite > 0 ? Math.PI * 1.45 : Math.PI * 0.45);
            g.stroke();
          });
          return;
        }
        const alpha = 0.3 + 0.45 * nah;
        const verlauf = g.createLinearGradient(bx, 0, wx, 0);
        verlauf.addColorStop(0, rgba(farbeK, alpha));
        verlauf.addColorStop(1, rgba(farbeW, alpha));
        const breit = g.createLinearGradient(bx, 0, wx, 0);
        breit.addColorStop(0, rgba(farbeK, alpha * 0.22));
        breit.addColorStop(1, rgba(farbeW, alpha * 0.22));
        const spreiz = (3 + abstand * 0.2) * s;
        const kurven = [-1, 0, 1].map((i) => {
          const th = (seite > 0 ? 0 : Math.PI) + i * 0.5 * seite;
          const x0 = bx + Math.cos(th) * R * s;
          const y0 = by + Math.sin(th) * R * s;
          return [x0, y0, lerp(x0, wx, 0.5), by + i * spreiz * 0.45, wx, by + i * spreiz];
        });
        [[breit, Math.max(2.5, 1.3 * s)], [verlauf, Math.max(1, 0.3 * s)]].forEach(([stil, dick]) => {
          g.strokeStyle = stil;
          g.lineWidth = dick;
          g.beginPath();
          kurven.forEach(([x0, y0, cx, cy, x1, y1]) => { g.moveTo(x0, y0); g.quadraticCurveTo(cx, cy, x1, y1); });
          g.stroke();
        });
        g.fillStyle = "#ffffff";
        kurven.forEach(([x0, y0, cx, cy, x1, y1], i) => {
          for (const versatz of [0, 0.5]) {
            const u = (((uhr * 1.6 + i * 0.29 + versatz) % 1) + 1) % 1;
            const v = 1 - u;
            g.globalAlpha = clamp(Math.sin(u * Math.PI) * (0.5 + nah), 0, 1);
            const d = 0.55 * s;
            g.fillRect(v * v * x0 + 2 * v * u * cx + u * u * x1 - d / 2, v * v * y0 + 2 * v * u * cy + u * u * y1 - d / 2, d, d);
          }
        });
        g.globalAlpha = 1;
      } else {
        // Gleich: Wellen laufen von der Kugel und vom Magneten aufeinander zu
        // und stossen sich in der Mitte – in der gemeinsamen Farbe.
        const mitte = Math.abs(wx - bx) - R * s;
        const alpha = 0.22 + 0.4 * nah;
        g.strokeStyle = rgba(farbeK, 1);
        g.lineWidth = Math.max(1, 0.32 * s);
        for (let i = 0; i < 3; i += 1) {
          const u = (((uhr * 1.3 + i / 3) % 1) + 1) % 1;
          g.globalAlpha = alpha * (1 - u) * Math.min(1, u * 5);
          // Von der Wand her …
          const rw = 2 * s + u * mitte * 0.5;
          g.beginPath();
          g.arc(wx, by, rw, seite > 0 ? Math.PI - 0.55 : -0.55, seite > 0 ? Math.PI + 0.55 : 0.55);
          g.stroke();
          // … und von der Kugel.
          const rk = R * s + 1 + u * mitte * 0.45;
          g.beginPath();
          g.arc(bx, by, rk, seite > 0 ? -0.6 : Math.PI - 0.6, seite > 0 ? 0.6 : Math.PI + 0.6);
          g.stroke();
        }
        g.globalAlpha = 1;
      }
    });
    g.globalCompositeOperation = "source-over";
  }

  // --- Die Kugel ------------------------------------------------------------
  function zeichneKugel() {
    const k = state.kugel;
    const s = view.s;
    const dpr = view.dpr;
    const sturz = state.schritt === "sturz" ? state.sturz : null;
    let x = sturz ? sturz.x : k.x;
    const y = sturz ? sturz.y : k.y;
    const r = state.phase !== "bereit" && state.t > 0 ? reiheBei(state.t) : null;
    // Ziehen beide Wände, zittert sie.
    if (r && !sturz && !ruhig()) {
      const cl = farbe(r, -1, state.t);
      const cr = farbe(r, 1, state.t);
      if (cl && cr && cl !== k.p && cr !== k.p) x += Math.sin(state.zeit * 95) * 0.25;
    }
    const bx = bildX(x);
    const by = bildY(y);
    if (by < -40 || by > view.cssH + 40) return;
    const p = sturz ? 0 : k.p;
    // Der Schweif beim schnellen Fall.
    const v = sturz ? 0 : tempoBei(state.t);
    if (v > 60 && !ruhig()) {
      const lang = Math.min(5.5 * R, (v - 50) * 0.055) * s;
      const verlauf = g.createLinearGradient(0, by - lang, 0, by);
      const farbeS = p > 0 ? [255, 110, 126] : [110, 170, 255];
      verlauf.addColorStop(0, rgba(farbeS, 0));
      verlauf.addColorStop(1, rgba(farbeS, 0.32));
      g.fillStyle = verlauf;
      g.beginPath();
      g.moveTo(bx - R * 0.8 * s, by);
      g.lineTo(bx - R * 0.35 * s, by - lang);
      g.lineTo(bx + R * 0.35 * s, by - lang);
      g.lineTo(bx + R * 0.8 * s, by);
      g.closePath();
      g.fill();
    }
    // Ihr Schein – Punkt auf Punkt, ohne umzurechnen.
    if (p) {
      const sch = bilder.schein[p];
      g.save();
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.globalCompositeOperation = "lighter";
      g.globalAlpha = 0.62 + 0.38 * k.puls;
      g.drawImage(sch, Math.round(bx * dpr - sch.width / 2), Math.round((by + wackel()) * dpr - sch.height / 2));
      g.restore();
    }
    // Die Kugel selbst, Punkt auf Punkt.
    const kb = bilder.kugel[p];
    g.save();
    g.setTransform(1, 0, 0, 1, 0, 0);
    const gx = Math.round(bx * dpr - kb.bild.width / 2);
    const gy = Math.round(by * dpr - kb.bild.height / 2 + wackel() * dpr);
    if (sturz) {
      g.translate(Math.round(bx * dpr), Math.round(by * dpr));
      g.rotate(sturz.dreh);
      g.globalAlpha = clamp(1 - sturz.zeit / 1.6, 0.25, 1);
      g.drawImage(kb.bild, -kb.bild.width / 2, -kb.bild.height / 2);
    } else {
      g.drawImage(kb.bild, gx, gy);
    }
    g.restore();
    if (sturz) return;
    // Das Licht der Wände auf ihren Seiten.
    if (r) {
      g.globalCompositeOperation = "lighter";
      g.lineWidth = Math.max(1, 0.7 * s);
      [-1, 1].forEach((seite) => {
        const art = magnetArt(r, seite);
        if (art !== "rot" && art !== "blau") return;
        const nah = 1 - Math.abs(seite * XW - k.x) / (2 * XW);
        g.strokeStyle = art === "rot" ? `rgba(255, 90, 110, ${0.25 + 0.5 * nah})` : `rgba(90, 160, 255, ${0.25 + 0.5 * nah})`;
        g.beginPath();
        g.arc(bx, by, R * 0.86 * s, seite > 0 ? -0.9 : Math.PI - 0.9, seite > 0 ? 0.9 : Math.PI + 0.9);
        g.stroke();
      });
      g.globalCompositeOperation = "source-over";
    }
    // Der Puls nach dem Umpolen.
    if (k.puls > 0 && !ruhig()) {
      const u = 1 - k.puls;
      g.strokeStyle = k.p > 0 ? `rgba(255, 120, 136, ${k.puls * 0.9})` : `rgba(120, 186, 255, ${k.puls * 0.9})`;
      g.lineWidth = Math.max(1.5, (1.2 - u) * s);
      g.beginPath(); g.arc(bx, by, R * s * (1 + u * 1.4), 0, TAU); g.stroke();
    }
  }

  // Wohin ein Tipp sie jetzt brächte: ein dezenter Ring in der anderen Farbe.
  function zeichneVorschau() {
    if (state.phase !== "spiel" || state.schritt !== "fall") return;
    const k = state.kugel;
    const r = reiheBei(state.t);
    const z = zielBahn(farbe(r, -1, state.t), farbe(r, 1, state.t), -k.p);
    if (z === null || Math.abs(z * XW - k.x) < 4) return;
    const s = view.s;
    const x = bildX(z * XW);
    const y = bildY(k.y);
    g.setLineDash([1.6 * s, 1.6 * s]);
    g.strokeStyle = k.p > 0 ? "rgba(120, 186, 255, 0.42)" : "rgba(255, 120, 136, 0.42)";
    g.lineWidth = Math.max(1, 0.35 * s);
    g.beginPath(); g.arc(x, y, R * s * 0.92, 0, TAU); g.stroke();
    g.setLineDash([]);
  }

  // Die Gegner als Geist: eine Kugel aus Licht in ihrer Farbe.
  function zeichneGeister() {
    if (!gegner || state.phase === "bereit") return;
    const orte = window.LernappGeist?.orte?.(gegner) || [];
    if (!orte.length) return;
    const namen = [];
    const s = view.s;
    orte.forEach((o) => {
      if (o.ziel) return;
      const sx = bildX(o.a / 10);
      const sy = bildY(o.b);
      if (sy < -40 || sy > view.cssH + 40) return;
      g.globalAlpha = 0.55 * o.blass;
      g.strokeStyle = o.farbe;
      g.lineWidth = Math.max(1.5, 0.5 * s);
      g.beginPath(); g.arc(sx, sy, R * s, 0, TAU); g.stroke();
      g.fillStyle = (o.c & 1) ? "rgba(255, 90, 110, 0.35)" : "rgba(90, 160, 255, 0.35)";
      g.beginPath(); g.arc(sx, sy, R * s * 0.7, 0, TAU); g.fill();
      g.globalAlpha = 1;
      const dy = o.b - state.kugel.y;
      namen.push({ ...o, sx, sy: sy - (R + 6) * s, weit: `${dy > 0 ? "+" : ""}${Math.round(dy / METER)} m` });
    });
    window.LernappGeist.namen(g, namen, { breit: view.cssW, hoch: view.cssH });
  }

  // --- Funken, Staub, Glut --------------------------------------------------
  function zeichneTeile() {
    if (!state.teile.length) return;
    g.globalCompositeOperation = "lighter";
    state.teile.forEach((t) => {
      const k = clamp(t.leben / t.max, 0, 1);
      g.globalAlpha = k;
      g.fillStyle = t.art === "funke" ? "rgb(255, 236, 180)" : t.art === "rot" ? "rgb(255, 110, 120)" : t.art === "blau" ? "rgb(120, 180, 255)" : "rgb(255, 170, 80)";
      const r = Math.max(0.6, t.r * view.s * (0.5 + 0.5 * k));
      g.fillRect(bildX(t.x) - r / 2, bildY(t.y) - r / 2, r, r);
    });
    g.globalAlpha = 1;
    g.globalCompositeOperation = "source-over";
  }

  // Was in der Luft des Schachts schwebt, je nach Zone: Staub im Licht,
  // Glitzern im Magnetit, aufsteigende Glut.
  const STAEUBE = Array.from({ length: 34 }, (_, i) => ({ x: hash01(i * 2.3 + 1), y: hash01(i * 4.1 + 2), r: 0.5 + hash01(i * 5.9) * 0.9, w: hash01(i * 7.7) * 6 }));
  function zeichneLuft() {
    if (ruhig()) return;
    const z = zoneBei(state.camY);
    const s = view.s;
    const breit = 2 * HALB * s;
    const x0 = bildX(-HALB);
    const H = view.cssH;
    g.globalCompositeOperation = "lighter";
    STAEUBE.forEach((d, i) => {
      let y;
      let a;
      let farbeT;
      if (z >= 3) {
        // Glut steigt auf.
        y = (((d.y - state.zeit * (0.05 + d.r * 0.04) - state.camY * s * 0.0009) % 1) + 1) % 1;
        a = 0.5 * (0.5 + 0.5 * Math.sin(state.zeit * 3 + d.w));
        farbeT = z === 4 ? "255, 220, 150" : "255, 150, 70";
      } else if (z === 2) {
        // Glitzern: an festen Stellen der Rückwand, kurz aufblitzend.
        y = (((d.y - state.camY * PAR * s / H) % 1) + 1) % 1;
        a = Math.max(0, Math.sin(state.zeit * (1.3 + d.r) + d.w * 3)) ** 8;
        farbeT = "220, 216, 255";
      } else {
        y = (((d.y - state.camY * s * 0.0004 + state.zeit * 0.01) % 1) + 1) % 1;
        a = 0.22;
        farbeT = "255, 226, 190";
      }
      const x = x0 + ((d.x + Math.sin(state.zeit * 0.4 + d.w) * 0.03) % 1) * breit;
      const r = d.r * Math.max(1, s * 0.35) * (z === 2 ? 1.5 : 1);
      g.fillStyle = `rgba(${farbeT}, ${a})`;
      g.fillRect(x - r / 2, y * H - r / 2, r, r);
      if (z === 2 && a > 0.3) {
        g.fillRect(x - r * 2, y * H - 0.3, r * 4, 0.6);
        g.fillRect(x - 0.3, y * H - r * 2, 0.6, r * 4);
      }
    });
    g.globalCompositeOperation = "source-over";
  }

  // --- Schrift ----------------------------------------------------------------
  function zeichneSchriften() {
    if (!state.schriften.length) return;
    const k0 = state.kugel;
    g.textAlign = "center";
    g.textBaseline = "middle";
    state.schriften.forEach((t) => {
      const k = clamp(t.leben / t.max, 0, 1);
      const gross = Math.round(clamp(t.gross * view.s * 0.32, 13, 26));
      g.font = `900 ${gross}px system-ui, sans-serif`;
      const x = clamp(bildX(k0.x), 60, view.cssW - 60);
      const y = bildY(k0.y) - (R + 6 + (1 - k) * 6) * view.s;
      g.globalAlpha = Math.min(1, k * 2.4);
      g.lineWidth = Math.max(3, gross * 0.22);
      g.strokeStyle = "rgba(6, 8, 16, 0.9)";
      g.strokeText(t.text, x, y);
      g.fillStyle = t.farbe;
      g.fillText(t.text, x, y);
    });
    g.globalAlpha = 1;
  }

  // Eine Ansage: gross, mitten im Schacht unter der Kugel.
  function zeichneAnsage() {
    const a = state.ansage;
    if (!a) return;
    const k = clamp(a.leben / a.max, 0, 1);
    const ein = clamp((a.max - a.leben) / 0.25, 0, 1);
    const gross = Math.round(clamp(view.cssW * 0.075, 18, 34));
    const y = lerp(view.kugelY, view.cssH, 0.46);
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.globalAlpha = Math.min(1, k * 3) * ein;
    g.font = `900 ${gross}px system-ui, sans-serif`;
    g.lineWidth = Math.max(3, gross * 0.2);
    g.strokeStyle = "rgba(6, 8, 16, 0.85)";
    g.strokeText(a.text, view.cssW / 2, y);
    g.fillStyle = a.farbe;
    g.fillText(a.text, view.cssW / 2, y);
    if (a.unter) {
      const klein = Math.round(gross * 0.5);
      g.font = `700 ${klein}px system-ui, sans-serif`;
      g.lineWidth = Math.max(2.5, klein * 0.22);
      g.strokeText(a.unter, view.cssW / 2, y + gross * 0.95);
      g.fillStyle = "rgba(240, 240, 250, 0.95)";
      g.fillText(a.unter, view.cssW / 2, y + gross * 0.95);
    }
    g.globalAlpha = 1;
  }

  // Wie das Bild nach einem Sturz zittert.
  const wackel = () => (ruhig() ? 0 : Math.sin(state.zeit * 64) * 3 * state.stoss);

  function zeichnen() {
    if (!g || !bilder) return;
    const dpr = view.dpr;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalAlpha = 1;
    g.globalCompositeOperation = "source-over";
    zeichneRueckwand();
    g.setTransform(dpr, 0, 0, dpr, 0, Math.round(wackel() * dpr));
    zeichneLuft();
    g.setTransform(1, 0, 0, 1, 0, Math.round(wackel() * dpr));
    zeichneWaende();
    g.setTransform(dpr, 0, 0, dpr, 0, Math.round(wackel() * dpr));
    zeichneGrenzen();
    zeichneMagnete();
    zeichneHindernisse();
    zeichneDecke();
    zeichneFeldlinien();
    zeichneGeister();
    zeichneVorschau();
    zeichneKugel();
    zeichneTeile();
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    // Nach einem Sturz wird es dunkel.
    if (state.sturz) {
      g.fillStyle = `rgba(4, 4, 8, ${clamp((state.sturz.zeit - 0.5) / 1.2, 0, 0.55)})`;
      g.fillRect(0, 0, view.cssW, view.cssH);
    }
    zeichneSchriften();
    zeichneAnsage();
  }

  // ---------------------------------------------------------------------------
  // Was aufstiebt
  // ---------------------------------------------------------------------------
  function teile(art, x, y, n, kraft, richtung = 0) {
    if (ruhig()) return;
    for (let i = 0; i < n; i += 1) {
      const w = Math.random() * TAU;
      const v = (10 + Math.random() * 40) * kraft;
      const leben = 0.25 + Math.random() * 0.45;
      state.teile.push({
        art, x, y, vx: Math.cos(w) * v + richtung * 40 * kraft, vy: Math.sin(w) * v - 20 * kraft,
        r: 0.6 + Math.random() * 0.7, leben, max: leben,
      });
    }
    if (state.teile.length > 180) state.teile.splice(0, state.teile.length - 180);
  }

  function schrift(text, farbe, gross = 34) {
    state.schriften = [{ text, farbe, gross, leben: 0.8, max: 0.8 }];
  }

  function ansage(text, unter, farbe = "#ffffff", dauer = 2) {
    state.ansage = { text, unter, farbe, leben: dauer, max: dauer };
  }

  // ---------------------------------------------------------------------------
  // Umpolen, fallen, stürzen
  // ---------------------------------------------------------------------------
  function umpolen() {
    const k = state.kugel;
    k.p = -k.p;
    k.puls = 1;
    state.umpolungen += 1;
    klang()?.ton?.("polwechsel.umpolen", { hoehe: k.p > 0 ? 1.08 : 0.92 });
    teile(k.p > 0 ? "rot" : "blau", k.x, k.y, 7, 0.7);
    kids()?.vibrate?.(6);
  }

  // Sie schlägt an eine Wand: ein Klack, Funken an der Stelle.
  function anschlag(stoss) {
    const k = state.kugel;
    const seite = k.x < 0 ? -1 : 1;
    klang()?.ton?.("polwechsel.anschlag", { laut: clamp(stoss / 320, 0.25, 1) });
    teile("funke", seite * HALB, k.y, Math.round(clamp(stoss / 40, 3, 10)), 0.9, -seite);
  }

  const WARUM = {
    sperre: "An einer Sperre zerschellt",
    stachel: "In die Stacheln gezogen",
  };

  function sturz(o, nurBild = false) {
    if (state.schritt === "sturz") return;
    const k = state.kugel;
    state.schritt = "sturz";
    const art = o?.art === "stachel" ? "stachel" : "sperre";
    const v = tempoBei(Math.max(0.5, state.t));
    // Sie prallt ab: an einer Sperre zurück nach oben, an Stacheln von der
    // Wand weg – und fällt dann ins Dunkel.
    const weg = art === "stachel" ? -o.seite : (Math.abs(k.x) < 1 ? (Math.random() < 0.5 ? -1 : 1) : -Math.sign(k.x));
    state.sturz = {
      art, zeit: 0, x: k.x, y: k.y, vx: weg * (40 + Math.random() * 30), vy: art === "sperre" ? -v * 0.35 - 30 : -20,
      dreh: 0, drehV: weg * (6 + Math.random() * 4), seite: o?.seite || 0,
    };
    state.stoss = 1;
    state.flimmern = 0.8;
    klangAus();
    klang()?.ton?.("polwechsel.sturz");
    klang()?.ton?.("polwechsel.funken", { verzoegerung: 0.05 });
    klang()?.ton?.("polwechsel.fall", { verzoegerung: 0.35 });
    kids()?.vibrate?.([30, 40, 70]);
    teile("funke", k.x, k.y + (art === "sperre" ? R : 0), 26, 2.2);
    teile(k.p > 0 ? "rot" : "blau", k.x, k.y, 12, 1.4);
    if (nurBild) return;
    stepTimer = window.setTimeout(finish, ruhig() ? 900 : STURZ_MS);
  }

  function sturzTakt(dt) {
    const f = state.sturz;
    if (!f) return;
    f.zeit += dt;
    f.vy += 260 * dt;
    f.vx *= 1 - 1.2 * dt;
    f.x += f.vx * dt;
    f.y += f.vy * dt;
    f.dreh += f.drehV * dt;
    // Die Wände halten sie im Schacht.
    if (f.x < -XW) { f.x = -XW; f.vx = Math.abs(f.vx) * 0.4; }
    if (f.x > XW) { f.x = XW; f.vx = -Math.abs(f.vx) * 0.4; }
    if (f.zeit < 0.5 && !ruhig() && Math.random() < dt * 30) teile("funke", f.x, f.y, 1, 0.6);
  }

  // Knapp vorbei: Wie nah sie einer Sperre kam, die sie gerade passiert.
  function knappPruefen() {
    const k = state.kugel;
    const sp = state.sperren;
    while (state.naechste < sp.length && sp[state.naechste].y1 < k.y - R) {
      const s = sp[state.naechste];
      if (state.phase === "spiel" && state.naechsteNah < 1.1) {
        state.knappe += 1;
        schrift("Knapp!", "#ffe08a", 34);
        klang()?.ton?.("polwechsel.funken", { laut: 0.6 });
        teile("funke", clamp(k.x, -XW, XW), s.y1, 8, 0.9);
      }
      state.naechste += 1;
      state.naechsteNah = Infinity;
    }
    const s = sp[state.naechste];
    if (s && k.y + R > s.y0) state.naechsteNah = Math.min(state.naechsteNah, abstandSperre(s, k.x));
  }

  function physik(dt) {
    const k = state.kugel;
    const n = Math.max(1, Math.ceil(dt / TAKT - 1e-9));
    const h = dt / n;
    for (let i = 0; i < n; i += 1) {
      if (state.schritt === "sturz") return;
      const r = reiheBei(state.t);
      const stoss = querSchritt(k, farbe(r, -1, state.t), farbe(r, 1, state.t), h);
      state.t += h;
      k.y = yBei(state.t);
      if (stoss > 45) anschlag(stoss);
      const o = trifft(k.x, k.y);
      if (o) {
        sturz(o);
        return;
      }
    }
    knappPruefen();
    const meter = Math.floor(k.y / METER);
    if (meter !== state.punkte) {
      state.punkte = meter;
      shell.setCount(meter);
    }
  }

  // Der Tipp – zu der Zeit, zu der er geschah (jetzt, wie performance.now).
  function tippen(jetzt) {
    if (state.phase === "zuschauen" || state.phase === "ende") return;
    if (state.phase === "bereit") {
      losGehts();
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
    umpolen();
  }

  // ---------------------------------------------------------------------------
  // Zuschauen
  // ---------------------------------------------------------------------------
  function zuschauenStarten() {
    if (!zuschauer?.lauf) return;
    startRun();
    state.phase = "zuschauen";
    state.schritt = "fall";
    state.strom = 1;
    shell.setPhase("play");
    zuschauer.los();
    klangAn();
  }

  // Woran ein Lauf zu Ende ging, aus der Stelle, an der er aufhört.
  function warumAm(x, y) {
    const o = trifft(x, y);
    if (o) return o;
    // Liegt sie an einer Wand mit Stacheln, waren es die Stacheln.
    const seite = x <= -XW + 1.5 ? -1 : x >= XW - 1.5 ? 1 : 0;
    const st = seite ? state.stacheln.find((s) => s.seite === seite && s.y0 < y + R + 6 && s.y1 > y - R - 6) : null;
    if (st) return st;
    const sp = state.sperren;
    const s = sp[indexAb(sp, y - R - DICKE)];
    return s || { art: "sperre", luecke: 0 };
  }

  // Die Kugel steht, wo die Aufzeichnung sie hat (a: quer in Zehnteln, b:
  // die Tiefe, c: die Polung im untersten Bit, darüber wie oft umgepolt).
  function zuschauenTakt(dt) {
    const s = zuschauer.stand();
    if (!s) return;
    const k = state.kugel;
    if (state.schritt !== "sturz") {
      k.x = clamp(s.a / 10, -XW, XW);
      k.y = Math.max(0, s.b);
      state.t = k.y > 0.5 ? Math.max(state.t, tBei(k.y)) : state.t;
      const c = Math.max(0, Math.round(s.c));
      const p = (c & 1) ? 1 : -1;
      const wie = c >> 1;
      if (wie > state.umpolungen) {
        state.umpolungen = wie;
        k.p = p;
        k.puls = 1;
        klang()?.ton?.("polwechsel.umpolen", { hoehe: p > 0 ? 1.08 : 0.92, laut: 0.7 });
      }
      k.p = p;
      const punkte = Math.max(0, Math.floor(s.punkte));
      if (punkte !== state.punkte) {
        state.punkte = punkte;
        shell.setCount(punkte);
      }
      klangStellen();
    }
    if (!zuschauer.weiter() && state.schritt !== "sturz") sturz(warumAm(k.x, k.y), true);
    if (state.schritt === "sturz") sturzTakt(dt);
  }

  // ---------------------------------------------------------------------------
  // Der Takt
  // ---------------------------------------------------------------------------
  // Was angesagt wird: eine neue Zone, wenn die Kugel hineinfällt; ein
  // Stromausfall oder ein Wechselfeld, bevor es kommt. Und was dabei klingt.
  function ereignisse() {
    const k = state.kugel;
    const z = zoneBei(k.y);
    if (z !== state.zone) {
      state.zone = z;
      ansage(ZONEN[z].name, `${ZONEN[z].ab} m`, "#ffe3b0", 2.2);
      klang()?.ton?.("polwechsel.zone");
    }
    const reihen = state.reihen;
    for (let i = Math.max(0, reiheHint - 1); i < reihen.length; i += 1) {
      const r = reihen[i];
      if (r.t0 > state.t + 1.7) break;
      if (!r.art || r.nr <= state.angesagt) continue;
      state.angesagt = r.nr;
      if (r.art === "aus") ansage("Stromausfall voraus", "gerade durch – im Dunkeln vorpolen", "#c8f0a0", 2);
      else ansage("Wechselfeld", "im Takt umpolen", "#ffd27a", 2);
      klang()?.ton?.("polwechsel.ansage");
    }
    const r = reiheBei(state.t);
    const aus = r.art === "aus";
    if (aus !== state.stromAus) {
      state.stromAus = aus;
      klang()?.ton?.(aus ? "polwechsel.stromaus" : "polwechsel.stroman");
      [-1, 1].forEach((seite) => teile("funke", seite * HALB, k.y + 6, 8, 1, -seite));
    }
    if (r.art === "wechsel" && state.t >= r.w0) {
      const n = Math.min(r.wn, Math.floor((state.t - r.w0) / r.P) + 1);
      const nr = r.nr * 100 + n;
      if (nr !== state.letzterTakt) {
        state.letzterTakt = nr;
        klang()?.ton?.("polwechsel.takt");
      }
    }
  }

  function takt(dt, strecke = dt) {
    state.zeit += dt;
    const k = state.kugel;
    if (state.stoss > 0) state.stoss = Math.max(0, state.stoss - dt * 3);
    if (k.puls > 0) k.puls = Math.max(0, k.puls - dt * 4);
    if (state.flimmern > 0) state.flimmern = Math.max(0, state.flimmern - dt);
    if (state.strom < 1) state.strom = Math.min(1, state.strom + dt / 1.3);
    if (state.ansage) { state.ansage.leben -= dt; if (state.ansage.leben <= 0) state.ansage = null; }

    if (state.phase === "zuschauen") {
      zuschauenTakt(dt);
      if (state.schritt !== "sturz") ereignisse();
    } else if (state.schritt === "sturz") {
      sturzTakt(dt);
    } else if (state.phase === "spiel") {
      if (strecke > 0) physik(strecke);
      if (state.schritt !== "sturz") {
        ereignisse();
        // Klebt sie an einer Wand, die sie anzieht, schleift sie: Funken.
        const r = reiheBei(state.t);
        const seite = k.x <= -XW + 0.01 ? -1 : k.x >= XW - 0.01 ? 1 : 0;
        if (seite && !ruhig()) {
          const c = farbe(r, seite, state.t);
          if (c && c !== k.p && Math.random() < dt * (8 + tempoBei(state.t) * 0.12)) {
            teile("glut", seite * HALB, k.y - R * 0.3, 1, 0.5, -seite);
          }
        }
      }
      klangStellen();
    }

    for (let i = state.teile.length - 1; i >= 0; i -= 1) {
      const t = state.teile[i];
      t.vy += 120 * dt;
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

    // Die Kamera bleibt bei der Kugel; nach einem Sturz bleibt sie stehen.
    if (state.schritt !== "sturz") state.camY = k.y;
    // Höchstens ein Abschnitt je Bild (der Plan reicht sechs Sekunden voraus).
    planBis(state.t + 6, 1);

    if (state.phase === "spiel" && state.schritt !== "sturz") {
      gegner?.takt(state.punkte, { a: Math.round(k.x * 10), b: Math.round(k.y), c: (k.p > 0 ? 1 : 0) + 2 * state.umpolungen });
    }
  }

  function loop(now) {
    frame = window.requestAnimationFrame(loop);
    // Das erste Bild nach dem Start kann einen Zeitstempel vor «last» haben:
    // nie rückwärts.
    const dt = clamp((now - last) / 1000, 0, 0.05);
    last = now;
    const strecke = Math.max(0, dt - voraus);
    voraus = 0;
    messen();
    takt(dt, strecke);
    zonenVormalen();
    zeichnen();
  }

  // Die Runde beginnt: mit dem ersten Tipp (der Halter lässt los) – oder im
  // Live-Modus zum gemeinsamen Start.
  function losGehts() {
    if (state.phase !== "bereit") return;
    state.phase = "spiel";
    state.schritt = "fall";
    state.t = 0;
    state.strom = 1;
    shell.setPhase("play");
    gegner?.los();
    klangAn();
    klang()?.ton?.("polwechsel.anschlag", { laut: 0.5 });
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
    state.t = 0;
    state.kugel = { x: 0, v: 0, y: 0, p: 1, puls: 0, kontakt: 0 };
    state.umpolungen = 0;
    state.knappe = 0;
    state.naechste = 0;
    state.naechsteNah = Infinity;
    state.zone = 0;
    state.sturz = null;
    state.teile = [];
    state.schriften = [];
    state.ansage = null;
    state.angesagt = -1;
    state.zeit = 0;
    state.stoss = 0;
    state.flimmern = 0;
    state.stromAus = false;
    state.letzterTakt = -1;
    state.camY = 0;
    schachtNeu();
    voraus = 0;
    shell.setCount(0);
    gegner?.runde();

    // Beim ersten Start gehen die Magnete von oben nach unten an.
    state.strom = ersterStart && !zuschauer && !shell.live && !ruhig() ? 0 : 1;
    if (state.strom < 1) klang()?.ton?.("polwechsel.stroman", { verzoegerung: 0.15 });
    ersterStart = false;

    shell.clear();
    const prompt = shell.el("p", "cm-prompt pw-prompt", "Tippen polt die Kugel um – ungleich zieht an, gleich stösst ab.");
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
    const dauer = Math.min(900, 160 + ziel * 2);
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
    const warum = WARUM[state.sturz?.art] || "";
    const zeit = `${Math.max(0, Math.round(state.t))} s`;
    const mal = `${state.umpolungen}-mal umgepolt`;
    shell.showResult({
      label: "Deine Meter",
      points: punkte,
      detail: rekord ? "Neuer Rekord!" : `${warum ? `${warum} · ` : ""}${zeit} · ${mal}`,
      geist,
    });
    if (rekord) host.querySelector(".cm-result-detail")?.classList.add("pw-rekord");
    zaehleHoch(punkte);
  }

  // ---------------------------------------------------------------------------
  // Start
  // ---------------------------------------------------------------------------
  shell = shellApi.mount({
    host,
    title: "Polwechsel",
    area: "geschwindigkeit",
    accent: "#F5A623",
    accentDark: "#b9741a",
    clock: false,
    onRestart: () => (zuschauer ? zuschauenStarten() : startRun()),
    live: { los: losGehts, stopp: () => finish(), zuschauen: (quelle) => { zuschauer = quelle; zuschauenStarten(); } },
  });
  zuschauer = window.LernappGeist?.zuschauer?.({
    host, spiel: "poleSwitch", fassung: FASSUNG, zufall, einheit: "m", nochmal: zuschauenStarten,
  }) || null;
  if (!zuschauer) {
    gegner = window.LernappGeist?.fuer?.({ spiel: "poleSwitch", host, art: "tempo", alle: true, zufall }) || null;
  }

  startRun();
  zuschauer?.laden.then((da) => { if (da) zuschauenStarten(); });

  // Ein Tipp irgendwo aufs Bild: Sie polt um. Nur Knöpfe bleiben Knöpfe.
  host.addEventListener("pointerdown", (event) => {
    if (event.target.closest("button, a, input")) return;
    const t = Math.abs(performance.now() - event.timeStamp) < 250 ? event.timeStamp : performance.now();
    tippen(t);
  });

  const TASTEN = new Set([" ", "Enter", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"]);
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
  window.LernappPolwechsel = {
    METER, R, XW, HALB, TOL, DICKE, E_MIN, FASSUNG, ZONEN, state, view,
    takt, tippen, losGehts, physik, planBis, kursText, trifft, zielBahn, farbe, reiheBei, abschnittBei,
    yBei, tBei, tempoBei, luftBei, schwere, zoneBei,
    saat: () => zufall.saat?.(), halteSaat: (saat) => zufall.halte?.(saat),
  };
})();
