/*
 * draht.js – Heisser Draht.
 * ---------------------------------------------------------------------------
 * Ein Kupferdraht zieht durchs Bild, und um ihn liegt ein leuchtender Ring.
 * Der Draht läuft stetig weiter; wer spielt, führt den Ring so, dass der
 * Draht ihn nie berührt. Ein Funke, ein Summen – und die Runde ist vorbei.
 *
 * Geführt wird mit dem Finger: irgendwo aufs Bild legen und ziehen. Der Ring
 * geht genau so weit mit, wie der Finger sich bewegt – er klebt nicht unter
 * dem Finger, der Finger verdeckt ihn also nie. Wer loslässt, lässt den Ring
 * an seiner Stelle stehen; der Draht läuft weiter. Mit der Tastatur schieben
 * die Pfeile den Ring gleichmässig. Wie schnell der Ring höchstens geht, ist
 * fest (V_RING) – auf jedem Gerät gleich, auch für die schnellste Hand.
 *
 * Quer läuft der Draht von rechts nach links, und der Ring geht auf und ab;
 * hochkant kommt der Draht von oben, und der Ring geht nach links und
 * rechts. Wie weit man vorausschaut, ist in der Welt gemessen überall gleich
 * (VORAUS) – also auch in der Zeit: Wo der Bildschirm mehr zeigen könnte,
 * liegt der Draht dort im Dunkeln.
 *
 * Die Welt: Der Draht ist eine Folge von Stützpunkten, dazwischen gerade
 * Stücke, an jedem Punkt ein Bogen (eine Parabel). Gebaut wird er aus dem
 * Zufall (zufall.js) in Mustern – sanfte Wellen, steile Bögen, Zickzack,
 * enge Haarnadeln, Stellen, an denen ein Magnet ihn hin und her zieht, und
 * Stellen, an denen er unter Strom zittert. Jedes Stück rechnet mit dem, was
 * der Ring kann: nie schneller quer, als er folgen kann, nie plötzlicher, als
 * eine Hand umlenkt – anfangs mit viel Luft, nach hinten mit weniger. Dazu
 * wird der Draht schneller und der Ring ein wenig enger. Gezählt werden die
 * Meter Draht, die durch den Ring gelaufen sind.
 *
 * Rückmeldung: Wer knapp am Draht ist, sieht ihn aufglimmen, und Funken
 * springen über. Wer lange sauber fährt, bekommt ein «sauber!» und eine
 * Serie, und der Ring leuchtet heller.
 *
 * Die Gegner (geist.js) fahren als Ring aus Licht mit – an ihren Metern, so
 * weit quer, wie ihr Ring damals war (a: Strecke in Welteinheiten, b: Lage
 * quer, c: 1 nach der Berührung). Platz 1 und die Bestmarke stehen dazu als
 * Linie über dem Draht. Und die besten Läufe lassen sich anschauen
 * (?zuschauen=, geist.js): Mit derselben Saat entsteht derselbe Draht, und
 * der Ring steht Bild für Bild dort, wo er damals war.
 *
 * Gerechnet wird in Welteinheiten – zehn sind ein Meter. s zählt entlang des
 * Drahts (in Laufrichtung), q quer dazu, von 0 bis BAND.
 */
(() => {
  "use strict";

  if (document.body.dataset.page !== "wire") return;

  const host = document.querySelector("#hd-stage");
  const shellApi = window.LernappGameShell;
  const cloudApi = window.LernappGameCloud;
  if (!host || !shellApi) return;

  const kids = () => window.LernappKids || null;
  const ruhig = () => Boolean(kids()?.prefersReducedMotion?.());

  // Der Zufall. Ohne Turnier jedes Mal ein anderer Draht, im Turnier für alle
  // im selben Versuch derselbe. Nur der Draht zieht daraus – Funken, Blitze
  // und Glanz würfeln Math.random, damit der Draht nicht davon abhängt, wie
  // jemand spielt.
  const zufall = window.LernappZufall?.fuer?.("wireLoop") || {
    neu() {},
    zahl: () => Math.random(),
  };

  // ---------------------------------------------------------------------------
  // Die Welt
  // ---------------------------------------------------------------------------
  const METER = 10;
  const BAND = 240;                // so breit ist die Welt quer zum Draht
  const RAND = 46;                 // so nah kommt der Draht nie an den Rand
  const VORLAUF = 400;             // so viel Draht liegt hinter dem Start
  const VORAUS = 300;              // so weit sieht man voraus – überall gleich
  const HINTEN = [0.18, 0.5];      // so viel vom Bild liegt hinter dem Ring
  const DS = 4;                    // Abstand der Punkte, mit denen der Draht gezeichnet wird
  const DRAHT_R = 3.2;             // Halbe Dicke des Drahts
  const RING_DICK = 5;             // Dicke des Rings, aussen an seiner Öffnung
  const RING_TIEF = 0.42;          // so schräg steht der Ring: Breite zu Höhe im Bild
  const R0 = 30;                   // Öffnung des Rings am Anfang (Halbmesser) …
  const R_MIN = 20;                // … und ganz hinten
  const R_WEG = 900;               // Meter, nach denen gut sechs Zehntel davon weg sind
  const START_Q = BAND / 2;

  // Tempo des Drahts, nach der Strecke: Wer gleich weit kommt, war gleich
  // schnell.
  const V0 = 100;
  const V_MAX = 225;
  const V_WEG = 850;

  // Der Ring: höchstens so schnell quer (Finger), so gleichmässig mit den
  // Pfeilen, und so weit darf der Finger ihm vorauseilen.
  const V_RING = 360;
  const V_TASTE = 260;
  const VORSPRUNG = 30;
  const TAKT = 1 / 240;

  // Was der Draht vom Ring verlangt, nach der Schwere: so viel seiner
  // Höchstgeschwindigkeit quer, so starkes Umlenken (Welteinheiten/s²).
  const SCHWER_WEG = 600;
  const V_OK = [0.26, 0.62];
  const A_OK = [900, 3400];
  const GERADE_BIS = 200;          // bis hier geht es geradeaus

  // Rückmeldung
  const KNAPP = 0.3;               // weniger Luft als das – der Draht glimmt
  const SAUBER = 500;              // so weit ohne knappe Stelle: «sauber!»
  const ZITTER_HZ = 12;
  const TEILE_MAX = 170;
  const PIXEL_MAX = 2.4e6;

  // Das Licht kommt von dort (in der Welt): Danach richten sich Glanz und
  // Schatten des Drahts.
  const LICHT_S = -0.3;
  const LICHT_Q = -0.95;
  const SCHATTEN = 6;              // so hoch liegt der Draht über dem Brett
  const PARALLAXE = 0.85;
  const KACHEL = 320;

  const TOP_COUNT = 5;
  const store = cloudApi
    ? cloudApi.register({ key: "lernapp.draht", empty: { runs: 0, scores: [] }, merge: cloudApi.mergeScores(TOP_COUNT) })
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
  const meterBei = (s) => Math.max(0, s / METER);
  const tempoBei = (s) => V0 + (V_MAX - V0) * (1 - Math.exp(-meterBei(s) / V_WEG));
  const schwereBei = (s) => 1 - Math.exp(-meterBei(s) / SCHWER_WEG);
  const radiusBei = (s) => R_MIN + (R0 - R_MIN) * Math.exp(-meterBei(s) / R_WEG);
  const vOkBei = (s) => V_RING * lerp(V_OK[0], V_OK[1], schwereBei(s));
  const aOkBei = (s) => lerp(A_OK[0], A_OK[1], schwereBei(s));

  // Immer dieselbe Zahl zu derselben Eingabe – für das Brett, ohne den Zufall
  // des Drahts anzufassen.
  function hash01(n) {
    const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return x - Math.floor(x);
  }

  // ---------------------------------------------------------------------------
  // Zustand
  // ---------------------------------------------------------------------------
  // phase:   "bereit" (noch nichts gedrückt), "spiel", "zuschauen", "ende"
  // schritt: "start", "fahrt", "crash"
  const state = {
    phase: "bereit",
    schritt: "start",
    punkte: 0,            // dasselbe wie meter
    meter: 0,
    S: 0,                 // so weit ist der Draht durch den Ring gelaufen
    q: START_Q,           // wo der Ring quer steht
    ziel: START_Q,        // wohin der Finger ihn zieht
    draht: null,
    frei: 1,              // wie viel Luft der Ring in diesem Bild hatte (Anteil)
    glimm: 0,
    seite: 1,             // auf welcher Seite der Draht dem Ring am nächsten war
    teile: [],
    schriften: [],
    stoss: 0,
    zeit: 0,
    crashZeit: 0,
    kontakt: null,
    grund: "",
    sauberAb: 0,
    sauberN: 0,
    knappZeit: -9,
    glanz: 0,
  };

  let shell = null;
  let feld = null;
  let canvas = null;
  let g = null;
  let promptEl = null;
  let frame = null;
  let last = 0;
  let stepTimer = null;
  // Die Gegner (geist.js): wer als Geist mitfährt und als Linie am Draht steht.
  let gegner = null;
  // Wer einen Lauf anschaut statt zu spielen (geist.js, zuschauer).
  let zuschauer = null;
  // Der Finger, der gerade führt, und die Pfeile.
  let zeiger = null;
  let tasteMinus = false;
  let tastePlus = false;

  const view = {
    k: 1, dpr: 1, cssW: 0, cssH: 0, frei: 0, hoch: false, ox: 0, oy: 0, vorPx: 0, hintenPx: 0,
  };

  function clearStep() {
    if (stepTimer) { window.clearTimeout(stepTimer); stepTimer = null; }
  }

  function stopLoop() {
    if (frame) { window.cancelAnimationFrame(frame); frame = null; }
  }

  // ---------------------------------------------------------------------------
  // Der Draht
  // ---------------------------------------------------------------------------
  /*
   * Stützpunkte { s, q, f }: dazwischen gerade Stücke, an jedem Punkt ein
   * Bogen, der f vor dem Punkt beginnt und f danach endet – eine Parabel, die
   * in beide Stücke glatt übergeht. Quer geht der Draht dort, wo der Ring
   * gerade ist, mit dem Tempo mal der Steigung; im Bogen lenkt er um mit
   * Tempo² mal Knick durch die Bogenlänge. Beides hält anhaengen() unter dem,
   * was der Ring an dieser Stelle können muss.
   *
   * Dazu die Bewegung (beweg): Abschnitte, in denen der Draht schwingt (ein
   * Magnet zieht ihn, langsam – dem folgt man) oder zittert (unter Strom,
   * schnell und wenig – dem weicht man aus, in der Mitte). Beide hängen nicht
   * an der Uhr, sondern daran, wie weit der Draht gelaufen ist (S): beim
   * Zuschauen schwingt er genau wie damals.
   */
  function neuerDraht() {
    return { punkte: [{ s: -VORLAUF, q: START_Q, f: 0 }], beweg: [], letzte: "", muster: 0 };
  }

  // Ein Stück Draht ans Ende: dq quer, höchstens so steil wie mWunsch und
  // erlaubt. rund (0–1): wie weich der Bogen am Anfang des Stücks ist – 1 so
  // weich wie möglich, 0 so scharf wie erlaubt.
  function anhaengen(dq, mWunsch, rund, laenge = 0) {
    const P = state.draht.punkte;
    const a = P[P.length - 1];
    const vor = P.length > 1 ? P[P.length - 2] : null;
    const ziel = clamp(a.q + dq, RAND, BAND - RAND);
    dq = ziel - a.q;
    const dsIn = vor ? a.s - vor.s : Infinity;
    const mIn = vor ? (a.q - vor.q) / dsIn : 0;
    // Gerechnet mit dem Tempo ein Stück weiter vorn: Es steigt nur.
    const v = tempoBei(a.s + 300);
    const vOk = vOkBei(a.s);
    const aOk = aOkBei(a.s);
    const mMax = Math.min(mWunsch, vOk / v);
    // Nie ganz kurz: Ein weicher Bogen braucht Platz, auch wenn quer wenig
    // geschieht.
    let ds = Math.max(laenge, 24 + 36 * rund, mMax > 0 ? Math.abs(dq) / mMax : 0);
    // Länger, bis beide Bögen Platz haben: der am Anfang (Knick zum
    // vorigen Stück) und der am Ende (Platz für jeden Knick danach).
    for (let n = 0; n < 60 && ds < 2000; n += 1) {
      const m = dq / ds;
      const fNoetig = (v * v * Math.abs(m - mIn)) / (2 * aOk);
      if (Math.abs(m) <= (aOk * ds) / (2 * v * v) && fNoetig <= Math.min(dsIn, ds) / 2) break;
      ds *= 1.1;
    }
    const m = dq / ds;
    const fNoetig = (v * v * Math.abs(m - mIn)) / (2 * aOk);
    const fMax = Math.min(dsIn, ds) / 2;
    if (vor) a.f = clamp(Math.max(fNoetig, fMax * rund, Math.min(3, fMax)), 0, fMax);
    const neu = { s: a.s + ds, q: ziel, f: 0 };
    P.push(neu);
    return neu;
  }

  // Ein Abschnitt, in dem der Draht sich bewegt, auf einem geraden Stück.
  // Erst rückt der Draht dafür zur Mitte, wenn er zu weit draussen ist.
  function bewegterAbschnitt(art, k) {
    const d = state.draht;
    const P = d.punkte;
    const z = () => zufall.zahl();
    const versatz = (z() - 0.5) * (art === "zittert" ? 40 : 30);
    const a = P[P.length - 1];
    if (Math.abs(a.q - START_Q) > (art === "zittert" ? 45 : 30)) {
      anhaengen(START_Q + versatz - a.q, lerp(0.6, 1.4, k), 0.8);
    }
    const start = P[P.length - 1];
    const L = art === "zittert" ? lerp(150, 230, k) : lerp(240, 180, k);
    const ende = anhaengen(0, 0, 0, L);
    // Erst nach dem Bogen am Anfang – dort ist der Draht schon gerade.
    const s0 = start.s + start.f + 4;
    const s1 = ende.s;
    const vMitte = tempoBei((s0 + s1) / 2);
    if (art === "zittert") {
      // So wenig, dass in der Mitte immer genug Luft bleibt.
      const B = lerp(0.22, 0.38, k) * (radiusBei(s1) - DRAHT_R);
      d.beweg.push({ art, s0, s1, B, w: (2 * Math.PI * ZITTER_HZ) / vMitte, ph: z() * Math.PI * 2 });
    } else {
      // Quer höchstens B·(2πf + πv/L), umlenken höchstens
      // B·((2πf + πv/L)² + (πv/L)²) – beides unter dem, was der Ring hier
      // können muss.
      const v = tempoBei(s1 + 100);
      const hz = lerp(0.45, 0.9, k);
      const w = 2 * Math.PI * hz;
      const geo = (Math.PI * v) / (s1 - s0);
      let B = lerp(14, 34, k) * lerp(0.75, 1, z());
      B = Math.min(B, (vOkBei(s0) * 0.9) / (w + geo), (aOkBei(s0) * 0.8) / ((w + geo) ** 2 + geo * geo),
        Math.min(start.q, BAND - start.q) - R0 - 8);
      d.beweg.push({ art, s0, s1, B: Math.max(4, B), w: w / vMitte, ph: z() * Math.PI * 2 });
    }
    anhaengen(0, 0, 0, 40);
  }

  // Das nächste Muster. Welche es gibt, hängt an der Strecke: anfangs nur
  // Wellen, dann Bögen, Zickzack, Schwingen, Haarnadeln, Zittern.
  function neuesMuster() {
    const d = state.draht;
    const P = d.punkte;
    const a = P[P.length - 1];
    const s = a.s;
    const z = () => zufall.zahl();
    d.muster += 1;
    if (s < GERADE_BIS) {
      anhaengen(0, 0, 1, GERADE_BIS - s);
      return;
    }
    const k = schwereBei(s);
    const m = meterBei(s);

    // Der erste Bogen führt weg von der Mitte: Wer nichts tut, berührt hier.
    if (!d.letzte) {
      const richtung = z() < 0.5 ? -1 : 1;
      anhaengen(richtung * lerp(48, 64, z()), 0.5, 1);
      d.letzte = "bogen";
      return;
    }

    const arten = [
      ["welle", 1],
      ["bogen", m > 60 ? 0.8 : 0],
      ["pause", m > 140 && d.letzte !== "pause" ? 0.25 : 0],
      ["zickzack", m > 160 ? lerp(0.4, 1.1, k) : 0],
      ["schwingt", m > 260 && d.letzte !== "schwingt" ? 0.5 : 0],
      ["haarnadel", m > 340 ? lerp(0.3, 0.9, k) : 0],
      ["zittert", m > 450 && d.letzte !== "zittert" ? 0.45 : 0],
    ];
    let summe = 0;
    arten.forEach(([, gewicht]) => { summe += gewicht; });
    let wahl = z() * summe;
    let art = "welle";
    for (const [name, gewicht] of arten) {
      if (wahl < gewicht) { art = name; break; }
      wahl -= gewicht;
    }
    d.letzte = art;
    const ende = () => P[P.length - 1];

    if (art === "welle") {
      const n = 2 + Math.floor(z() * 3);
      const A = lerp(20, 52, k) * lerp(0.7, 1, z());
      const c = clamp(a.q + (z() - 0.5) * lerp(70, 130, k), RAND + A, BAND - RAND - A);
      let seite = z() < 0.5 ? 1 : -1;
      const mW = lerp(0.45, 1.3, k);
      for (let i = 0; i < n; i += 1) {
        anhaengen(c + seite * A - ende().q, mW, 1);
        seite = -seite;
      }
    } else if (art === "bogen") {
      const weit = lerp(45, 100, k) * lerp(0.75, 1, z());
      const hoch = a.q - weit >= RAND;
      const tief = a.q + weit <= BAND - RAND;
      const wuerfel = z();
      const richtung = hoch && tief ? (wuerfel < 0.5 ? -1 : 1) : (a.q - RAND > BAND - RAND - a.q ? -1 : 1);
      const rund = lerp(0.9, 0.25, k);
      anhaengen(richtung * weit, lerp(0.7, 2.2, k), rund);
      anhaengen(0, 0, rund, lerp(70, 30, k));
    } else if (art === "pause") {
      anhaengen(0, 0, 1, lerp(90, 40, k));
    } else if (art === "zickzack") {
      const n = 3 + Math.floor(z() * lerp(2, 5, k));
      const A = lerp(22, 44, k) * lerp(0.8, 1, z());
      const c = clamp(a.q, RAND + A, BAND - RAND - A);
      const mW = lerp(1.0, 2.4, k);
      let seite = z() < 0.5 ? 1 : -1;
      for (let i = 0; i < n; i += 1) {
        anhaengen(c + seite * A - ende().q, mW, 0);
        seite = -seite;
      }
      anhaengen(c - ende().q, mW, 0);
      anhaengen(0, 0, 0.5, 30);
    } else if (art === "haarnadel") {
      anhaengen(0, 0, 0.5, 24);
      const H0 = lerp(70, 130, k) * lerp(0.8, 1, z());
      const raumOben = a.q - RAND;
      const raumUnten = BAND - RAND - a.q;
      const richtung = raumOben > raumUnten ? -1 : 1;
      const H = Math.min(H0, Math.max(raumOben, raumUnten));
      const mW = lerp(1.6, 3.2, k);
      anhaengen(richtung * H, mW, 0);
      anhaengen(-richtung * H, mW, 0);
      anhaengen(0, 0, 0.5, 30);
    } else {
      bewegterAbschnitt(art, k);
    }
  }

  // Draht bis s – und so weit darüber hinaus, dass sich bis s nichts mehr
  // ändert (der Bogen am letzten Punkt steht erst mit dem nächsten fest).
  function drahtBis(s) {
    const P = state.draht.punkte;
    while (P.length < 3 || P[P.length - 2].s < s) neuesMuster();
  }

  // Wo im Draht s liegt: Gesucht wird ab dem letzten Fund, denn gefragt wird
  // fast immer der Reihe nach.
  let suchI = 0;
  function index(s) {
    const P = state.draht.punkte;
    let i = clamp(suchI, 0, P.length - 2);
    while (i > 0 && P[i].s > s) i -= 1;
    while (i < P.length - 2 && P[i + 1].s <= s) i += 1;
    suchI = i;
    return i;
  }

  // Die Steigung beim letzten Aufruf von basis() – ohne ein neues Objekt je
  // Frage.
  let steig = 0;

  function bogen(e, m0, m1, s) {
    const t = (s - (e.s - e.f)) / (2 * e.f);
    const qa = e.q - m0 * e.f;
    const qb = e.q + m1 * e.f;
    steig = (1 - t) * m0 + t * m1;
    return (1 - t) * (1 - t) * qa + 2 * t * (1 - t) * e.q + t * t * qb;
  }

  // Die Mitte des Drahts bei s, ohne Bewegung.
  function basis(s) {
    const P = state.draht.punkte;
    if (s <= P[0].s) { steig = 0; return P[0].q; }
    const i = index(s);
    const a = P[i];
    const b = P[i + 1];
    const m = (b.q - a.q) / (b.s - a.s);
    if (a.f > 0 && i > 0 && s < a.s + a.f) {
      const p = P[i - 1];
      return bogen(a, (a.q - p.q) / (a.s - p.s), m, s);
    }
    if (b.f > 0 && i + 2 < P.length && s > b.s - b.f) {
      const c = P[i + 2];
      return bogen(b, m, (c.q - b.q) / (c.s - b.s), s);
    }
    steig = m;
    return a.q + m * Math.min(s - a.s, b.s - a.s);
  }

  // Wie weit der Draht bei s gerade ausgelenkt ist, wenn er S weit gelaufen
  // ist. Eine stehende Welle: an den Enden still, in der Mitte am meisten.
  let bewegAb = 0;
  function bewegung(s, S, mitZittern) {
    const B = state.draht.beweg;
    let d = 0;
    for (let i = bewegAb; i < B.length; i += 1) {
      const b = B[i];
      if (b.s0 > s) break;
      if (s >= b.s1 || (!mitZittern && b.art === "zittert")) continue;
      // Das Schwingen läuft an den Enden weich aus (sin²) – sonst bekäme der
      // Ring dort einen Ruck. Das Zittern darf hart beginnen: Ihm folgt
      // niemand.
      const h = Math.sin((Math.PI * (s - b.s0)) / (b.s1 - b.s0));
      d += b.B * (b.art === "schwingt" ? h * h : h) * Math.sin(b.w * (S - b.s0) + b.ph);
    }
    return d;
  }

  // Wie weit der Draht bei s höchstens zittert (für das Bild und den
  // Autopiloten).
  function zitterHuelle(s) {
    const B = state.draht.beweg;
    for (let i = bewegAb; i < B.length; i += 1) {
      const b = B[i];
      if (b.s0 > s) break;
      if (b.art === "zittert" && s < b.s1) return b.B * Math.sin((Math.PI * (s - b.s0)) / (b.s1 - b.s0));
    }
    return 0;
  }

  // Wie viel Platz der Ring bei s quer hat: seine Öffnung, weniger der
  // halben Dicke des Drahts – an einer steilen Stelle schneidet der Ring den
  // Draht schräg, dann etwas mehr.
  function toleranz(s) {
    basis(s);
    return radiusBei(s) - DRAHT_R * Math.sqrt(1 + steig * steig);
  }

  // ---------------------------------------------------------------------------
  // Die Fläche
  // ---------------------------------------------------------------------------
  function buildPlatz() {
    // Die Leinwand liegt über der ganzen Spielfläche (styles.css, .hd-feld).
    feld = shell.el("div", "hd-feld");
    canvas = document.createElement("canvas");
    canvas.className = "hd-canvas";
    canvas.setAttribute("aria-hidden", "true");
    feld.append(canvas);
    g = canvas.getContext("2d");

    // Der Hinweis vor dem ersten Zug: ein Ring, der sich füllt.
    const tipp = shell.el("span", "hd-tipp");
    tipp.setAttribute("aria-hidden", "true");
    const ns = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(ns, "svg");
    svg.setAttribute("viewBox", "0 0 64 64");
    [
      { r: 22, stroke: "rgba(255,255,255,0.45)", w: 5 },
      { r: 22, stroke: "#ffffff", w: 5, klasse: "hd-tipp-fuell" },
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
    return feld;
  }

  /*
   * Die Bildform entscheidet die Richtung: quer läuft der Draht nach links,
   * hochkant nach unten. Quer zum Draht passt immer das ganze Band ins Bild;
   * entlang steht der Ring so, dass vor ihm genau VORAUS Welt liegt – und
   * wo das Bild dafür zu lang ist, liegt der Rest im Dunkeln. So schaut man
   * auf jedem Bildschirm gleich weit voraus.
   */
  function messen() {
    if (!canvas || !feld) return;
    const cssW = Math.max(80, feld.clientWidth);
    const cssH = Math.max(80, feld.clientHeight);
    // Höchstens PIXEL_MAX Bildpunkte: Auf einem grossen, dichten Bildschirm
    // wird die Leinwand etwas weicher, aber nicht langsamer.
    const dpr = Math.max(1, Math.min(clamp(window.devicePixelRatio || 1, 1, 2.5), Math.sqrt(PIXEL_MAX / (cssW * cssH))));
    // Auf dem Handy reicht die Leinwand unter die Knöpfe oben (game-shell.js,
    // frei). Gemalt wird dort auch – aber was zählt, steht darunter.
    const frei = Math.min(cssH * 0.4, shell?.frei?.(canvas) || 0);
    if (cssW === view.cssW && cssH === view.cssH && dpr === view.dpr && frei === view.frei) return;
    view.cssW = cssW;
    view.cssH = cssH;
    view.dpr = dpr;
    view.frei = frei;
    view.hoch = cssH > cssW * 1.05;
    if (!view.hoch) {
      const quer = cssH - frei;
      view.k = Math.min(quer / BAND, (cssW * (1 - HINTEN[0])) / VORAUS);
      const hinten = clamp(1 - (VORAUS * view.k) / cssW, HINTEN[0], HINTEN[1]);
      view.ox = cssW * hinten;
      view.oy = frei + (quer - BAND * view.k) / 2;
      view.vorPx = cssW - view.ox;
      view.hintenPx = view.ox;
    } else {
      const lang = cssH - frei;
      view.k = Math.min(cssW / BAND, (lang * (1 - HINTEN[0])) / VORAUS);
      const hinten = clamp(1 - (VORAUS * view.k) / lang, HINTEN[0], HINTEN[1]);
      view.oy = cssH - lang * hinten;
      view.ox = (cssW - BAND * view.k) / 2;
      view.vorPx = view.oy - frei;
      view.hintenPx = cssH - view.oy;
    }
    const pw = Math.round(cssW * dpr);
    const ph = Math.round(cssH * dpr);
    if (canvas.width !== pw) canvas.width = pw;
    if (canvas.height !== ph) canvas.height = ph;
    if (promptEl) promptEl.style.top = `${Math.round(frei + 10)}px`;
  }

  // Wie weit die Welt vorn und hinten im Bild ist (in Welteinheiten).
  const sichtVor = () => view.vorPx / view.k;
  const sichtHinten = () => view.hintenPx / view.k;

  const wackelX = () => (ruhig() ? 0 : Math.cos(state.zeit * 53) * 3.5 * state.stoss);
  const wackelY = () => (ruhig() ? 0 : Math.sin(state.zeit * 70) * 3.5 * state.stoss);

  // Das Bild ohne alles: für die Anzeige.
  function flachTransform() {
    g.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
  }

  // Das Bild mit Kamerastoss.
  function bildTransform() {
    g.setTransform(view.dpr, 0, 0, view.dpr, wackelX() * view.dpr, wackelY() * view.dpr);
  }

  // Die Welt: s entlang, q quer – quer gedreht oder nicht, je nach Bild. ws,
  // wq verschieben (in Welteinheiten), etwa für den Schatten.
  function weltTransform(ws = 0, wq = 0) {
    const d = view.dpr;
    const k = view.k;
    const wx = wackelX();
    const wy = wackelY();
    if (!view.hoch) g.setTransform(k * d, 0, 0, k * d, (view.ox + (ws - state.S) * k + wx) * d, (view.oy + wq * k + wy) * d);
    else g.setTransform(0, -k * d, k * d, 0, (view.ox + wq * k + wx) * d, (view.oy - (ws - state.S) * k + wy) * d);
  }

  const bildX = (s, q) => (view.hoch ? view.ox + q * view.k : view.ox + (s - state.S) * view.k);
  const bildY = (s, q) => (view.hoch ? view.oy - (s - state.S) * view.k : view.oy + q * view.k);

  // ---------------------------------------------------------------------------
  // Vorgemalt: Brett, Abdunkeln, Licht
  // ---------------------------------------------------------------------------
  const bilder = { schluessel: "", brett: null, licht: null, glut: null };

  function leinwand(w, h, q) {
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.ceil(w * q));
    c.height = Math.max(1, Math.ceil(h * q));
    const cg = c.getContext("2d");
    cg.scale(q, q);
    return { c, g: cg, w, h };
  }

  // Ein Lichtfleck: in der Mitte farbig, nach aussen nichts.
  function lichtfleck(r, gr, b) {
    const L = leinwand(64, 64, 1);
    const v = L.g.createRadialGradient(32, 32, 0, 32, 32, 32);
    v.addColorStop(0, `rgba(${r}, ${gr}, ${b}, 0.9)`);
    v.addColorStop(0.35, `rgba(${r}, ${gr}, ${b}, 0.35)`);
    v.addColorStop(1, `rgba(${r}, ${gr}, ${b}, 0)`);
    L.g.fillStyle = v;
    L.g.fillRect(0, 0, 64, 64);
    return L.c;
  }

  // Eine Kachel der Werkbank: dunkle Lochrasterplatine, Leiterbahnen mit
  // Lötaugen, Chips, Widerstände. In x (Laufrichtung) wiederholt sie sich –
  // was über den Rand ragt, steht gegenüber wieder da; in y (quer) bleibt
  // alles drin, denn dort liegt eine andere Kachel daneben (variante).
  function baueKachel(q, variante) {
    const T = KACHEL;
    const L = leinwand(T, T, q);
    const cg = L.g;
    const h = (n) => hash01(n + variante * 71.3);
    cg.fillStyle = "#141d2b";
    cg.fillRect(0, 0, T, T);
    // Ein paar dunklere und hellere Flecken – Abnutzung.
    for (let i = 0; i < 5; i += 1) {
      const r = 30 + h(i * 7.1 + 3) * 50;
      const x = h(i * 3.7 + 1) * T;
      const y = r + h(i * 5.3 + 2) * (T - 2 * r);
      for (const ox of [-T, 0, T]) {
        const v = cg.createRadialGradient(x + ox, y, 0, x + ox, y, r);
        v.addColorStop(0, i % 2 ? "rgba(40, 60, 84, 0.3)" : "rgba(0, 0, 0, 0.28)");
        v.addColorStop(1, "rgba(0, 0, 0, 0)");
        cg.fillStyle = v;
        cg.fillRect(x + ox - r, y - r, r * 2, r * 2);
      }
    }
    // Lochraster
    for (let y = 8; y < T; y += 16) {
      for (let x = 8; x < T; x += 16) {
        cg.fillStyle = "rgba(2, 5, 10, 0.55)";
        cg.beginPath();
        cg.arc(x, y, 1.7, 0, Math.PI * 2);
        cg.fill();
        if (h(x * 0.37 + y * 1.91) < 0.16) {
          cg.strokeStyle = "rgba(214, 130, 66, 0.18)";
          cg.lineWidth = 1.2;
          cg.beginPath();
          cg.arc(x, y, 3.4, 0, Math.PI * 2);
          cg.stroke();
        }
      }
    }
    // Leiterbahnen: Stücke auf dem Raster, um 45° abknickend; quer prallen
    // sie vom Rand der Kachel ab.
    cg.lineCap = "round";
    cg.lineJoin = "round";
    const n0 = 5 + Math.floor(h(0.5) * 3);
    for (let n = 0; n < n0; n += 1) {
      let x = 8 + Math.floor(h(n * 3.3 + 1) * (T / 16)) * 16;
      let y = 24 + Math.floor(h(n * 5.1 + 2) * (T / 16 - 2)) * 16;
      const punkte = [[x, y]];
      let richtung = Math.floor(h(n * 7.7 + 3) * 8);
      for (let j = 0; j < 4; j += 1) {
        const lang = (1 + Math.floor(h(n * 11.3 + j * 1.7) * 3)) * 16;
        const w = (richtung * Math.PI) / 4;
        let dy = Math.round(Math.sin(w)) * lang;
        if (y + dy < 16 || y + dy > T - 16) dy = -dy;
        x += Math.round(Math.cos(w)) * lang;
        y += dy;
        punkte.push([x, y]);
        richtung = (richtung + (h(n * 13.1 + j * 2.3) < 0.5 ? 1 : 7)) % 8;
      }
      for (const ox of [-T, 0, T]) {
        cg.strokeStyle = "rgba(27, 167, 166, 0.16)";
        cg.lineWidth = 2.4;
        cg.beginPath();
        punkte.forEach(([px, py], i) => (i ? cg.lineTo(px + ox, py) : cg.moveTo(px + ox, py)));
        cg.stroke();
        [punkte[0], punkte[punkte.length - 1]].forEach(([px, py]) => {
          cg.fillStyle = "rgba(27, 167, 166, 0.2)";
          cg.beginPath();
          cg.arc(px + ox, py, 4, 0, Math.PI * 2);
          cg.fill();
          cg.fillStyle = "rgba(2, 5, 10, 0.7)";
          cg.beginPath();
          cg.arc(px + ox, py, 1.7, 0, Math.PI * 2);
          cg.fill();
        });
      }
    }
    // Bauteile: ein, zwei Chips, ein paar Widerstände und Kondensatoren.
    const teile = [];
    const chips = 1 + Math.floor(h(9.1) * 2);
    for (let i = 0; i < chips; i += 1) teile.push({ art: "chip", w: 36 + Math.floor(h(i * 2.9 + 4) * 3) * 8, h: 22 });
    for (let i = 0; i < 3; i += 1) teile.push({ art: "widerstand", liegt: h(i * 4.1 + 6) < 0.6 });
    for (let i = 0; i < 2; i += 1) teile.push({ art: "elko" });
    teile.forEach((t, i) => {
      const x0 = h(i * 6.7 + 11) * T;
      const y = 30 + h(i * 8.3 + 12) * (T - 60);
      for (const ox of [-T, 0, T]) {
        const x = x0 + ox;
        if (t.art === "chip") {
          cg.fillStyle = "rgba(160, 175, 190, 0.16)";
          for (let p = 0; p < t.w / 8; p += 1) {
            cg.fillRect(x - t.w / 2 + 3 + p * 8, y - t.h / 2 - 4, 3, 4);
            cg.fillRect(x - t.w / 2 + 3 + p * 8, y + t.h / 2, 3, 4);
          }
          cg.fillStyle = "rgba(6, 9, 15, 0.85)";
          cg.fillRect(x - t.w / 2, y - t.h / 2, t.w, t.h);
          cg.fillStyle = "rgba(120, 140, 160, 0.22)";
          cg.beginPath();
          cg.arc(x - t.w / 2 + 5, y - t.h / 2 + 5, 1.6, 0, Math.PI * 2);
          cg.fill();
        } else if (t.art === "widerstand") {
          const w = t.liegt ? 26 : 8;
          const hh = t.liegt ? 8 : 26;
          cg.fillStyle = "rgba(150, 125, 95, 0.2)";
          cg.fillRect(x - w / 2, y - hh / 2, w, hh);
          cg.fillStyle = "rgba(210, 90, 60, 0.22)";
          if (t.liegt) cg.fillRect(x - 4, y - hh / 2, 3, hh);
          else cg.fillRect(x - w / 2, y - 4, w, 3);
        } else {
          cg.fillStyle = "rgba(40, 70, 120, 0.35)";
          cg.beginPath();
          cg.arc(x, y, 8, 0, Math.PI * 2);
          cg.fill();
          cg.strokeStyle = "rgba(170, 190, 220, 0.18)";
          cg.lineWidth = 1.5;
          cg.stroke();
        }
      }
    });
    return L;
  }

  // Die Auflösung des Bretts im Speicher: höchstens etwa 1.25-fach, und
  // immer so, dass es um einen ganzen Faktor vergrössert ins Bild kommt –
  // dann geht das ohne Glätten, und das ist viel schneller.
  const bildFaktor = () => Math.max(1, Math.round(view.dpr / 1.25));

  function vorgemalt() {
    const q = view.dpr / bildFaktor();
    const schluessel = `${view.cssW}|${view.cssH}|${view.hoch}|${q}`;
    if (bilder.schluessel === schluessel) return bilder;
    bilder.schluessel = schluessel;
    const T = KACHEL;
    // Das Brett als ein Streifen, eine Kachel länger als das Bild in
    // Laufrichtung: Je Bild wird er nur verschoben und einmal gezeichnet.
    // Quer liegen drei verschiedene Kacheln nebeneinander, entlang
    // wiederholt sich jede; hochkant stehen sie gedreht.
    const kacheln = [0, 1, 2].map((v) => baueKachel(q, v));
    const bw = (view.hoch ? view.cssW : view.cssW + T) + 8;
    const bh = (view.hoch ? view.cssH + T : view.cssH) + 8;
    const brett = leinwand(bw, bh, q);
    const cg = brett.g;
    if (!view.hoch) {
      for (let y = 0, r = 0; y < bh; y += T, r += 1) {
        for (let x = 0; x < bw; x += T) cg.drawImage(kacheln[r % 3].c, x, y, T, T);
      }
    } else {
      for (let x = 0, r = 0; x < bw; x += T, r += 1) {
        for (let y = 0; y < bh; y += T) {
          cg.save();
          cg.translate(x + T, y);
          cg.rotate(Math.PI / 2);
          cg.drawImage(kacheln[r % 3].c, 0, 0, T, T);
          cg.restore();
        }
      }
    }
    // Quer zum Draht zu den Rändern hin dunkler – gleich ins Brett gemalt,
    // denn quer bewegt es sich nicht.
    const v = view.hoch ? cg.createLinearGradient(4, 0, view.cssW + 4, 0) : cg.createLinearGradient(0, 4, 0, view.cssH + 4);
    v.addColorStop(0, "rgba(3, 6, 12, 0.7)");
    v.addColorStop(0.22, "rgba(3, 6, 12, 0)");
    v.addColorStop(0.78, "rgba(3, 6, 12, 0)");
    v.addColorStop(1, "rgba(3, 6, 12, 0.7)");
    cg.fillStyle = v;
    cg.fillRect(0, 0, bw, bh);
    bilder.brett = brett;
    if (!bilder.licht) {
      bilder.licht = lichtfleck(60, 235, 220);
      bilder.glut = lichtfleck(255, 150, 60);
    }
    return bilder;
  }

  // ---------------------------------------------------------------------------
  // Zeichnen
  // ---------------------------------------------------------------------------
  function zeichneBrett() {
    const b = vorgemalt();
    bildTransform();
    const T = KACHEL;
    const weg = (((state.S * view.k * PARALLAXE) % T) + T) % T;
    // Auf ganze Bildpunkte: so geht der Streifen ohne Glätten ins Bild.
    const px = (z) => Math.round(z * view.dpr) / view.dpr;
    const x = px(view.hoch ? -4 : -4 - weg);
    const y = px(view.hoch ? -4 + weg - T : -4);
    g.imageSmoothingEnabled = false;
    g.drawImage(b.brett.c, x, y, b.brett.w, b.brett.h);
    g.imageSmoothingEnabled = true;
  }

  // Ein Lichtfleck im Bild, additiv.
  function licht(bild, sx, sy, r, alpha) {
    if (alpha <= 0.005) return;
    g.globalAlpha = Math.min(1, alpha);
    g.drawImage(bild, sx - r, sy - r, r * 2, r * 2);
  }

  // Das Licht des Rings auf dem Brett – und bei knappen Stellen die Glut.
  function zeichneLicht() {
    bildTransform();
    g.globalCompositeOperation = "lighter";
    const sx = bildX(state.S, state.q);
    const sy = bildY(state.S, state.q);
    const R = radiusBei(state.S) * view.k;
    const crash = state.schritt === "crash";
    const ct = crash ? state.zeit - state.crashZeit : 9;
    licht(bilder.licht, sx, sy, R * (2.8 + state.glanz * 0.7 + Math.min(5, state.sauberN) * 0.12),
      (crash ? 0.25 : 0.45 + Math.min(5, state.sauberN) * 0.05 + state.glanz * 0.3) * (1 - state.glimm * 0.4));
    if (state.glimm > 0.02) licht(bilder.glut, sx, sy, R * 3, state.glimm * 0.55);
    if (crash && state.kontakt) {
      const kx = bildX(state.kontakt.s, state.kontakt.q);
      const ky = bildY(state.kontakt.s, state.kontakt.q);
      licht(bilder.glut, kx, ky, R * (3 + ct * 3), Math.max(0, 1 - ct * 0.9));
    }
    g.globalAlpha = 1;
    g.globalCompositeOperation = "source-over";
  }

  // Alle hundert Meter eine Marke am Rand des Bandes, alle fünfzig ein Strich.
  function zeichneMarken() {
    const von = Math.ceil(meterBei(state.S - sichtHinten()) / 50) * 50;
    const bis = meterBei(state.S + Math.min(sichtVor(), VORAUS));
    if (von > bis) return;
    bildTransform();
    const gross = Math.round(clamp(Math.min(view.cssW, view.cssH) * 0.03, 10, 14));
    g.font = `800 ${gross}px system-ui, sans-serif`;
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.lineCap = "round";
    for (let m = Math.max(50, von); m <= bis; m += 50) {
      const s = m * METER;
      const x0 = bildX(s, BAND - 4);
      const y0 = bildY(s, BAND - 4);
      const x1 = bildX(s, BAND - 16);
      const y1 = bildY(s, BAND - 16);
      g.strokeStyle = m % 100 ? "rgba(27, 167, 166, 0.3)" : "rgba(95, 230, 220, 0.55)";
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(x0, y0);
      g.lineTo(x1, y1);
      g.stroke();
      if (m % 100) continue;
      const tx = bildX(s, BAND - 26);
      const ty = bildY(s, BAND - 26);
      g.fillStyle = "rgba(95, 230, 220, 0.7)";
      g.fillText(`${m} m`, view.hoch ? tx - gross * 0.6 : tx, view.hoch ? ty : ty - gross * 0.3);
    }
  }

  // Die Stellen, an denen sich der Draht bewegt: Magnete an beiden Seiten,
  // die leuchten, wenn sie ziehen; vor dem Zitterdraht Blitzschilder.
  function zeichneStellen() {
    const B = state.draht.beweg;
    const von = state.S - sichtHinten() - 60;
    const bis = state.S + Math.min(sichtVor(), VORAUS) + 40;
    bildTransform();
    const k = view.k;
    for (let i = bewegAb; i < B.length; i += 1) {
      const b = B[i];
      if (b.s0 > bis) break;
      if (b.s1 < von) continue;
      if (b.art === "schwingt") {
        const sm = (b.s0 + b.s1) / 2;
        const zug = Math.sin(b.w * (state.S - b.s0) + b.ph);
        const mitte = basis(sm);
        const weit = b.B + R0 + 16;
        for (let seite = -1; seite <= 1; seite += 2) {
          const q = clamp(mitte + seite * weit, 12, BAND - 12);
          zeichneMagnet(bildX(sm, q), bildY(sm, q), seite, k, Math.max(0, zug * seite));
        }
      } else {
        [b.s0, b.s1].forEach((s) => {
          [12, BAND - 12].forEach((q) => zeichneSchild(bildX(s, q), bildY(s, q), k));
        });
      }
    }
  }

  // Ein Hufeisenmagnet, die Öffnung zum Draht. an: wie stark er gerade zieht.
  function zeichneMagnet(x, y, seite, k, an) {
    const gr = 11 * k;
    g.save();
    g.translate(x, y);
    // Quer liegt das Band senkrecht: Die Öffnung zeigt nach oben oder unten.
    if (!view.hoch) g.rotate(seite < 0 ? Math.PI / 2 : -Math.PI / 2);
    else g.rotate(seite < 0 ? 0 : Math.PI);
    if (an > 0.02) {
      g.globalCompositeOperation = "lighter";
      licht(bilder.glut, gr * 0.9, 0, gr * 2.4, an * 0.7);
      g.globalAlpha = 1;
      g.globalCompositeOperation = "source-over";
    }
    g.lineCap = "butt";
    g.strokeStyle = "#7a1f22";
    g.lineWidth = gr * 0.62;
    g.beginPath();
    g.arc(0, 0, gr * 0.62, Math.PI / 2, (Math.PI * 3) / 2);
    g.stroke();
    g.strokeStyle = `rgb(${Math.round(lerp(196, 255, an))}, ${Math.round(lerp(52, 120, an))}, ${Math.round(lerp(52, 80, an))})`;
    g.lineWidth = gr * 0.46;
    g.stroke();
    g.fillStyle = "#d9dee6";
    g.fillRect(0, -gr * 0.93, gr * 0.5, gr * 0.62);
    g.fillRect(0, gr * 0.31, gr * 0.5, gr * 0.62);
    g.restore();
  }

  // Ein gelbes Dreieck mit Blitz.
  function zeichneSchild(x, y, k) {
    const r = 8 * k;
    g.fillStyle = "#ffd23f";
    g.strokeStyle = "#2a2200";
    g.lineWidth = Math.max(1, r * 0.14);
    g.beginPath();
    g.moveTo(x, y - r);
    g.lineTo(x + r * 0.95, y + r * 0.7);
    g.lineTo(x - r * 0.95, y + r * 0.7);
    g.closePath();
    g.fill();
    g.stroke();
    g.fillStyle = "#2a2200";
    g.beginPath();
    g.moveTo(x + r * 0.12, y - r * 0.55);
    g.lineTo(x - r * 0.28, y + r * 0.12);
    g.lineTo(x - r * 0.02, y + r * 0.12);
    g.lineTo(x - r * 0.14, y + r * 0.6);
    g.lineTo(x + r * 0.28, y - r * 0.05);
    g.lineTo(x + r * 0.02, y - r * 0.05);
    g.closePath();
    g.fill();
  }

  // Die Glanzpunkte eines Bildes (ohne neue Objekte je Bild).
  const GLANZ_MAX = 80;
  const glanzS = new Float32Array(GLANZ_MAX);
  const glanzQ = new Float32Array(GLANZ_MAX);
  const glanzA = new Float32Array(GLANZ_MAX);
  const glanzM = new Float32Array(GLANZ_MAX);

  // Der Draht: Schatten auf dem Brett, dunkle Kante, Kupfer, ein heller
  // Streifen zum Licht hin, Glanzpunkte, wo er quer zum Licht liegt, ein
  // feines Glimmen von Strom – und wo er zittert, der Schleier seiner
  // Bewegung.
  function zeichneDraht() {
    const S = state.S;
    const von = Math.floor((S - sichtHinten() - 10) / DS) * DS;
    const bis = S + sichtVor() + 10;
    const pfad = new Path2D();
    let zpfad = null;
    let nGlanz = 0;
    for (let s = von; s <= bis + DS; s += DS) {
      const qb = basis(s);
      const m = steig;
      const q = qb + bewegung(s, S, true);
      if (s === von) pfad.moveTo(s, q);
      else pfad.lineTo(s, q);
      // Glanz: wo die Richtung des Drahts quer zum Licht steht.
      const quer = Math.abs(LICHT_S + LICHT_Q * m) / Math.sqrt(1 + m * m);
      if (quer < 0.14 && nGlanz < GLANZ_MAX) {
        glanzS[nGlanz] = s;
        glanzQ[nGlanz] = q;
        glanzM[nGlanz] = m;
        glanzA[nGlanz] = 1 - quer / 0.14;
        nGlanz += 1;
      }
      const hz = zitterHuelle(s);
      if (hz > 0) {
        if (!zpfad) { zpfad = new Path2D(); zpfad.moveTo(s, q); } else zpfad.lineTo(s, q);
      }
    }

    // Wo er zittert: der Schleier, so weit er ausschlägt, und die Ruhelage.
    zeichneZitterSchleier(von, bis);

    const crash = state.schritt === "crash";
    const ct = crash ? state.zeit - state.crashZeit : 9;
    const D = DRAHT_R * 2;
    g.lineCap = "round";
    g.lineJoin = "round";
    weltTransform(LICHT_S * -SCHATTEN, LICHT_Q * -SCHATTEN);
    g.strokeStyle = "rgba(0, 0, 0, 0.42)";
    g.lineWidth = D * 1.25;
    g.stroke(pfad);

    weltTransform();
    g.strokeStyle = "#3a1806";
    g.lineWidth = D + 1.4;
    g.stroke(pfad);
    g.strokeStyle = "#b85b24";
    g.lineWidth = D;
    g.stroke(pfad);
    weltTransform(LICHT_S * DRAHT_R * 0.32, LICHT_Q * DRAHT_R * 0.32);
    g.strokeStyle = "#e48a48";
    g.lineWidth = D * 0.5;
    g.stroke(pfad);
    weltTransform(LICHT_S * DRAHT_R * 0.55, LICHT_Q * DRAHT_R * 0.55);
    g.strokeStyle = "rgba(255, 236, 205, 0.9)";
    g.lineWidth = 0.9;
    g.stroke(pfad);

    weltTransform();
    g.globalCompositeOperation = "lighter";
    // Strom: ein feines Glimmen, das langsam pulsiert.
    const puls = 0.06 + 0.035 * Math.sin(state.zeit * 3.1);
    g.strokeStyle = `rgba(40, 220, 205, ${puls.toFixed(3)})`;
    g.lineWidth = D * 2.2;
    g.stroke(pfad);
    // Unter Strom: blaues Flackern um den Draht, ein heller Kern.
    if (zpfad) {
      const flacker = ruhig() ? 0.3 : 0.18 + Math.random() * 0.25;
      g.strokeStyle = `rgba(110, 175, 255, ${flacker.toFixed(3)})`;
      g.lineWidth = D * 2.4;
      g.stroke(zpfad);
      g.strokeStyle = "rgba(200, 230, 255, 0.55)";
      g.lineWidth = D * 0.3;
      g.stroke(zpfad);
    }
    // Glanz: kurze helle Striche entlang des Drahts, auf der Seite zum Licht.
    g.strokeStyle = "rgba(255, 246, 228, 0.95)";
    g.lineWidth = DRAHT_R * 0.7;
    for (let i = 0; i < nGlanz; i += 1) {
      const n = 1 / Math.sqrt(1 + glanzM[i] * glanzM[i]);
      const ls = 3.4 * n;
      const lq = 3.4 * glanzM[i] * n;
      const s = glanzS[i] + LICHT_S * DRAHT_R * 0.45;
      const q = glanzQ[i] + LICHT_Q * DRAHT_R * 0.45;
      g.globalAlpha = glanzA[i] * 0.7;
      g.beginPath();
      g.moveTo(s - ls, q - lq);
      g.lineTo(s + ls, q + lq);
      g.stroke();
    }
    g.globalAlpha = 1;
    // Die Berührung: Der ganze Draht blitzt weiss auf und glüht nach.
    if (crash) {
      const blitz = Math.max(0, 1 - ct * 2.6);
      if (blitz > 0) {
        g.strokeStyle = `rgba(255, 250, 235, ${blitz.toFixed(3)})`;
        g.lineWidth = D * 1.4;
        g.stroke(pfad);
      }
    }
    g.globalCompositeOperation = "source-over";
    zeichneGlimmen();
  }

  // Der Schleier über dem Zitterdraht: so weit, wie er ausschlägt.
  function zeichneZitterSchleier(von, bis) {
    const B = state.draht.beweg;
    for (let i = bewegAb; i < B.length; i += 1) {
      const b = B[i];
      if (b.s0 > bis) break;
      if (b.art !== "zittert" || b.s1 < von) continue;
      const a0 = Math.max(b.s0, von);
      const a1 = Math.min(b.s1, bis);
      if (a1 <= a0) continue;
      weltTransform();
      g.beginPath();
      for (let s = a0; s <= a1; s += DS) g.lineTo(s, basis(s) - zitterHuelle(s) - DRAHT_R);
      for (let s = a1; s >= a0; s -= DS) g.lineTo(s, basis(s) + zitterHuelle(s) + DRAHT_R);
      g.closePath();
      g.globalCompositeOperation = "lighter";
      g.fillStyle = "rgba(120, 180, 255, 0.16)";
      g.fill();
      g.globalCompositeOperation = "source-over";
    }
  }

  // Knapp am Draht: Er glimmt neben dem Ring auf, und Funken springen über.
  function zeichneGlimmen() {
    const gl = state.glimm;
    if (gl < 0.02 || state.schritt === "crash") return;
    const S = state.S;
    const pfad = new Path2D();
    for (let s = Math.floor((S - 48) / DS) * DS, n = 0; s <= S + 48; s += DS, n += 1) {
      const q = basis(s) + bewegung(s, S, true);
      if (!n) pfad.moveTo(s, q);
      else pfad.lineTo(s, q);
    }
    weltTransform();
    g.globalCompositeOperation = "lighter";
    g.lineCap = "butt";
    // Zu den Enden hin verlöschend – ein Verlauf entlang des Drahts.
    const verlauf = (r, gr, b, a) => {
      const v = g.createLinearGradient(S - 48, 0, S + 48, 0);
      v.addColorStop(0, `rgba(${r}, ${gr}, ${b}, 0)`);
      v.addColorStop(0.5, `rgba(${r}, ${gr}, ${b}, ${a.toFixed(3)})`);
      v.addColorStop(1, `rgba(${r}, ${gr}, ${b}, 0)`);
      return v;
    };
    g.strokeStyle = verlauf(255, 140, 50, gl * 0.6);
    g.lineWidth = DRAHT_R * 5;
    g.stroke(pfad);
    g.strokeStyle = verlauf(255, 235, 180, gl * 0.85);
    g.lineWidth = DRAHT_R * 1.2;
    g.stroke(pfad);
    // Ein Blitz vom Draht zum nahen Rand des Rings.
    if (gl > 0.35 && !ruhig()) {
      const w = basis(S) + bewegung(S, S, true);
      const rand = state.q + state.seite * radiusBei(S);
      const n = 5;
      g.strokeStyle = `rgba(190, 240, 255, ${Math.min(1, gl).toFixed(3)})`;
      g.lineWidth = 0.9;
      for (let bogen2 = 0; bogen2 < 2; bogen2 += 1) {
        g.beginPath();
        g.moveTo(S, w);
        for (let i = 1; i < n; i += 1) {
          g.lineTo(S + (Math.random() - 0.5) * 7, lerp(w, rand, i / n) + (Math.random() - 0.5) * 2);
        }
        g.lineTo(S + (Math.random() - 0.5) * 3, rand);
        g.stroke();
      }
    }
    g.globalCompositeOperation = "source-over";
  }

  // Die Farbe des Rings: Türkis, bei knappen Stellen wärmer, nach der
  // Berührung rot.
  function ringFarbe(hell) {
    const gl = Math.sqrt(state.glimm);
    let r = lerp(40, 255, gl);
    let gr = lerp(225, 150, gl);
    let b = lerp(210, 50, gl);
    if (state.schritt === "crash") {
      const blink = Math.sin((state.zeit - state.crashZeit) * 30) > 0 ? 1 : 0.75;
      r = 255 * blink;
      gr = 80 * blink;
      b = 60 * blink;
    }
    const f = hell ? 1 : 0.55;
    return `rgb(${Math.round(r * f)}, ${Math.round(gr * f)}, ${Math.round(b * f)})`;
  }

  // Der Ring, schräg gesehen: die hintere Hälfte vor dem Draht gezeichnet,
  // die vordere danach – so läuft der Draht durch ihn hindurch.
  function zeichneRing(vorne) {
    const S = state.S;
    const R = radiusBei(S);
    const rm = R + RING_DICK / 2;
    const e = rm * RING_TIEF;
    const a0 = vorne ? Math.PI / 2 : -Math.PI / 2;
    let zittern = 0;
    if (state.schritt === "crash" && !ruhig()) zittern = Math.sin(state.zeit * 90) * 1.2 * Math.max(0, 1 - (state.zeit - state.crashZeit) * 2);
    const q = state.q + zittern;
    g.lineCap = "round";
    if (!vorne) {
      // Sein Schatten auf dem Brett.
      weltTransform(LICHT_S * -SCHATTEN * 1.3, LICHT_Q * -SCHATTEN * 1.3);
      g.strokeStyle = "rgba(0, 0, 0, 0.35)";
      g.lineWidth = RING_DICK + 1;
      g.beginPath();
      g.ellipse(S, q, e, rm, 0, 0, Math.PI * 2);
      g.stroke();
    }
    weltTransform();
    g.beginPath();
    g.ellipse(S, q, e, rm, 0, a0, a0 + Math.PI);
    g.strokeStyle = "rgba(2, 22, 24, 0.9)";
    g.lineWidth = RING_DICK + 2;
    g.stroke();
    g.strokeStyle = ringFarbe(vorne);
    g.lineWidth = RING_DICK;
    g.stroke();
    if (vorne) {
      // Ein heller Streifen auf der Vorderseite – Neon.
      g.globalCompositeOperation = "lighter";
      g.beginPath();
      g.ellipse(S, q, e, rm, 0, a0 + 0.25, a0 + Math.PI - 0.25);
      g.strokeStyle = state.schritt === "crash" ? "rgba(255, 220, 200, 0.7)" : "rgba(210, 255, 250, 0.85)";
      g.lineWidth = RING_DICK * 0.32;
      g.stroke();
      // Die Serie: Funkeln, das um den Ring läuft.
      const n = state.schritt === "fahrt" ? Math.min(6, state.sauberN) : 0;
      if (n >= 2) {
        g.fillStyle = "rgba(255, 245, 200, 0.9)";
        for (let i = 0; i < n; i += 1) {
          const w = state.zeit * 2.6 + (i * Math.PI * 2) / n;
          g.beginPath();
          g.arc(S + e * Math.cos(w), q + rm * Math.sin(w), 1.6 + 0.6 * Math.sin(state.zeit * 9 + i), 0, Math.PI * 2);
          g.fill();
        }
      }
      g.globalCompositeOperation = "source-over";
    }
  }

  // Die Gegner als Geist (geist.js): ein Ring aus Licht an ihrer Stelle –
  // an ihrem eigenen Draht, nicht an diesem.
  function zeichneGeister() {
    if (!gegner || state.phase === "bereit") return;
    const orte = window.LernappGeist?.orte?.(gegner) || [];
    if (!orte.length) return;
    weltTransform();
    const von = state.S - sichtHinten() - 40;
    const bis = state.S + sichtVor() + 40;
    orte.forEach((o) => {
      // Wem im Live-Modus zugeschaut wird, der ist die Figur selbst – kein
      // Geist dazu, nur sein Name (geist.js, namen).
      if (o.ziel) return;
      if (o.a < von || o.a > bis) return;
      const rm = radiusBei(o.a) + RING_DICK / 2;
      g.globalAlpha = 0.55 * o.blass;
      g.strokeStyle = o.farbe;
      g.lineWidth = RING_DICK * 0.8;
      g.beginPath();
      g.ellipse(o.a, o.b, rm * RING_TIEF, rm, 0, 0, Math.PI * 2);
      g.stroke();
      if (o.c >= 1) {
        g.fillStyle = o.farbe;
        g.globalAlpha = 0.25 * o.blass;
        g.fill();
      }
    });
    g.globalAlpha = 1;
    flachTransform();
    window.LernappGeist.namen(g, orte.map((o) => {
      const R = radiusBei(o.a) + RING_DICK;
      const sx = bildX(o.a, o.b);
      const sy = view.hoch ? bildY(o.a, o.b) - R * RING_TIEF * view.k - 6 : bildY(o.a, o.b - R) - 6;
      const dx = o.a - state.S;
      return { ...o, sx, sy, weit: `${dx > 0 ? "+" : ""}${Math.round(dx / METER)} m` };
    }), { breit: view.cssW, hoch: view.cssH });
  }

  // Platz 1 und die Bestmarke: eine Linie quer über das Band bei ihren
  // Metern. Wer hindurch ist, hat sie geschlagen – dann wird sie blass.
  function zeichneTore() {
    if (!gegner) return;
    const ziele = (gegner.gegner?.() || []).filter((ziel) => ziel.art !== "alle");
    if (!ziele.length) return;
    const gross = Math.round(clamp(Math.min(view.cssW, view.cssH) * 0.03, 10, 14));
    ziele.forEach((ziel) => {
      const s = ziel.punkte * METER;
      if (s < state.S - sichtHinten() - 20 || s > state.S + Math.min(sichtVor(), VORAUS) + 20) return;
      const geschlagen = state.punkte > ziel.punkte;
      bildTransform();
      g.globalAlpha = geschlagen ? 0.35 : 0.9;
      g.strokeStyle = ziel.farbe;
      g.lineWidth = 3;
      g.setLineDash([8, 6]);
      g.beginPath();
      g.moveTo(bildX(s, 4), bildY(s, 4));
      g.lineTo(bildX(s, BAND - 4), bildY(s, BAND - 4));
      g.stroke();
      g.setLineDash([]);
      const text = ziel.art === "eigen" ? `Bestmarke ${ziel.punkte} m` : `${ziel.name} ${ziel.punkte} m`;
      g.font = `800 ${gross}px system-ui, sans-serif`;
      g.textAlign = view.hoch ? "left" : "center";
      g.textBaseline = view.hoch ? "bottom" : "top";
      const tx = bildX(s, 6);
      const ty = bildY(s, 6) + (view.hoch ? -4 : 4);
      g.lineWidth = 3;
      g.strokeStyle = "rgba(10, 14, 24, 0.8)";
      g.strokeText(text, tx, ty);
      g.fillStyle = ziel.farbe;
      g.fillText(text, tx, ty);
    });
    g.globalAlpha = 1;
  }

  function zeichneTeile() {
    if (!state.teile.length) return;
    weltTransform();
    g.globalCompositeOperation = "lighter";
    g.lineCap = "round";
    state.teile.forEach((t) => {
      const k = clamp(t.leben / t.max, 0, 1);
      g.globalAlpha = k;
      g.strokeStyle = t.farbe;
      g.lineWidth = t.r * (0.5 + k * 0.5);
      g.beginPath();
      g.moveTo(t.s, t.q);
      g.lineTo(t.s - t.vs * 0.03, t.q - t.vq * 0.03);
      g.stroke();
    });
    g.globalAlpha = 1;
    g.globalCompositeOperation = "source-over";
  }

  // Wo das Licht nicht hinreicht: Hinter VORAUS liegt der Draht im Dunkeln.
  function zeichneDunkel() {
    const ueber = view.vorPx - VORAUS * view.k;
    if (ueber <= 1) return;
    bildTransform();
    const weich = Math.min(VORAUS * view.k * 0.12, 60);
    const grenze = VORAUS * view.k;
    if (!view.hoch) {
      const x = view.ox + grenze;
      const v = g.createLinearGradient(x - weich, 0, x, 0);
      v.addColorStop(0, "rgba(7, 10, 17, 0)");
      v.addColorStop(1, "rgba(7, 10, 17, 0.97)");
      g.fillStyle = v;
      g.fillRect(x - weich, -10, weich, view.cssH + 20);
      g.fillStyle = "rgba(7, 10, 17, 0.97)";
      g.fillRect(x - 0.5, -10, view.cssW - x + 20, view.cssH + 20);
    } else {
      const y = view.oy - grenze;
      const v = g.createLinearGradient(0, y + weich, 0, y);
      v.addColorStop(0, "rgba(7, 10, 17, 0)");
      v.addColorStop(1, "rgba(7, 10, 17, 0.97)");
      g.fillStyle = v;
      g.fillRect(-10, y, view.cssW + 20, weich);
      g.fillStyle = "rgba(7, 10, 17, 0.97)";
      g.fillRect(-10, -20, view.cssW + 20, y + 20.5);
    }
  }

  // Wo Schriften stehen: mitten im Stück hinter dem Ring – dort verdecken
  // sie nichts, was noch kommt.
  function schriftOrt() {
    if (!view.hoch) {
      return { x: Math.max(60, view.ox * 0.5), y: clamp(bildY(state.S, state.q), view.frei + 40, view.cssH - 30) };
    }
    return { x: clamp(bildX(state.S, state.q), 70, view.cssW - 70), y: Math.min(view.cssH - 30, view.oy + (view.cssH - view.oy) * 0.55) };
  }

  function zeichneSchriften() {
    if (!state.schriften.length) return;
    bildTransform();
    g.textAlign = "center";
    g.textBaseline = "middle";
    const basisGross = clamp(Math.min(view.cssW, view.cssH) * 0.06, 18, 34);
    state.schriften.forEach((s, i) => {
      const k = clamp(s.leben / s.max, 0, 1);
      const steig2 = (1 - k) * 22;
      const pop = 1 + Math.max(0, (k - 0.82) / 0.18) * 0.35;
      g.globalAlpha = Math.min(1, k * 2.2);
      g.font = `900 ${Math.round(basisGross * s.gross * pop)}px system-ui, sans-serif`;
      // Mehrere zugleich: die neueste unten, die älteren darüber.
      const y = s.y - steig2 - (state.schriften.length - 1 - i) * basisGross * 1.1;
      g.lineWidth = 5;
      g.lineJoin = "round";
      g.strokeStyle = "rgba(6, 10, 18, 0.75)";
      g.strokeText(s.text, s.x, y);
      g.fillStyle = s.farbe;
      g.fillText(s.text, s.x, y);
    });
    g.globalAlpha = 1;
  }

  // Die Meter oben links – die eigentliche Zahl der Runde. Daneben, solange
  // sie hält, die Serie sauberer Abschnitte.
  function zeichneAnzeige() {
    flachTransform();
    // Auf dem Handy liegt der obere Rand unter den Knöpfen: dann darunter.
    g.translate(0, shell?.frei?.(canvas) || 0);
    const gross = clamp(view.cssH * 0.05, 14, 24);
    g.font = `900 ${Math.round(gross)}px system-ui, sans-serif`;
    g.textAlign = "left";
    g.textBaseline = "middle";
    const text = `${state.meter} m`;
    const w = g.measureText(text).width + gross * 1.1;
    const x = 12;
    const y = 12;
    g.fillStyle = "rgba(6, 10, 18, 0.6)";
    g.beginPath();
    if (g.roundRect) g.roundRect(x, y, w, gross * 1.6, gross * 0.8);
    else g.rect(x, y, w, gross * 1.6);
    g.fill();
    g.fillStyle = "#ffffff";
    g.fillText(text, x + gross * 0.55, y + gross * 0.82);
    if (state.sauberN > 0 && state.schritt === "fahrt") {
      const serie = `×${state.sauberN}`;
      const klein = Math.round(gross * 0.75);
      g.font = `900 ${klein}px system-ui, sans-serif`;
      const sw = g.measureText(serie).width + klein;
      const sx = x + w + 6;
      g.fillStyle = `rgba(95, 230, 220, ${(0.8 + state.glanz * 0.2).toFixed(3)})`;
      g.beginPath();
      if (g.roundRect) g.roundRect(sx, y + gross * 0.2, sw, gross * 1.2, gross * 0.6);
      else g.rect(sx, y + gross * 0.2, sw, gross * 1.2);
      g.fill();
      g.fillStyle = "#04221f";
      g.fillText(serie, sx + klein * 0.5, y + gross * 0.82);
    }
  }

  function zeichnen() {
    if (!g) return;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, canvas.width, canvas.height);
    g.globalAlpha = 1;
    g.globalCompositeOperation = "source-over";
    zeichneBrett();
    zeichneLicht();
    zeichneMarken();
    zeichneStellen();
    zeichneTore();
    zeichneRing(false);
    zeichneDraht();
    zeichneGeister();
    zeichneRing(true);
    zeichneTeile();
    zeichneDunkel();
    zeichneSchriften();
    zeichneAnzeige();
  }

  // ---------------------------------------------------------------------------
  // Teilchen und Schriften
  // ---------------------------------------------------------------------------
  // Funken in der Welt; sie fallen im Bild nach unten.
  function funken(s, q, anzahl, staerke, farben) {
    if (ruhig()) anzahl = Math.ceil(anzahl / 3);
    for (let i = 0; i < anzahl; i += 1) {
      const w = Math.random() * Math.PI * 2;
      const v = (40 + Math.random() * 220) * staerke;
      state.teile.push({
        s, q, vs: Math.cos(w) * v, vq: Math.sin(w) * v,
        r: 0.9 + Math.random() * 1.6, farbe: farben[i % farben.length], leben: 0.35 + Math.random() * 0.55, max: 0.9,
      });
    }
    if (state.teile.length > TEILE_MAX) state.teile.splice(0, state.teile.length - TEILE_MAX);
  }

  const FUNKEN = ["#fff6d8", "#ffd166", "#ff9a3c", "#ffe9a8"];
  const GLITZER = ["#c9fff8", "#5fe6dc", "#ffffff"];

  function schrift(text, farbe, gross = 1) {
    const ort = schriftOrt();
    state.schriften.push({ text, x: ort.x, y: ort.y, farbe, gross, leben: 1.15, max: 1.15 });
    if (state.schriften.length > 4) state.schriften.shift();
  }

  // ---------------------------------------------------------------------------
  // Der Lauf
  // ---------------------------------------------------------------------------
  const tasteRichtung = () => (tastePlus ? 1 : 0) - (tasteMinus ? 1 : 0);

  function physik(h) {
    const st = state;
    st.S += tempoBei(st.S) * h;
    const richtung = tasteRichtung();
    if (richtung) {
      st.q += richtung * V_TASTE * h;
      st.ziel = st.q;
    } else {
      const max = V_RING * h;
      st.q += clamp(st.ziel - st.q, -max, max);
    }
    const R = radiusBei(st.S);
    st.q = clamp(st.q, R + 2, BAND - R - 2);
    st.ziel = clamp(st.ziel, R + 2, BAND - R - 2);
    pruefeBeruehrung(true);
  }

  // Berührt der Draht den Ring? Dort, wo der Ring ist (s = S), quer.
  function pruefeBeruehrung(echt) {
    const st = state;
    const mitte = basis(st.S) + bewegung(st.S, st.S, true);
    const tol = radiusBei(st.S) - DRAHT_R * Math.sqrt(1 + steig * steig);
    const ab = mitte - st.q;
    const frei = (tol - Math.abs(ab)) / tol;
    if (frei < st.frei) {
      st.frei = frei;
      st.seite = ab < 0 ? -1 : 1;
    }
    if (echt && Math.abs(ab) >= tol) beruehrt(ab);
    return ab;
  }

  function beruehrt(ab) {
    if (state.schritt !== "fahrt") return;
    state.schritt = "crash";
    state.crashZeit = state.zeit;
    state.stoss = 1;
    const seite = ab < 0 ? -1 : 1;
    const R = radiusBei(state.S);
    state.kontakt = { s: state.S, q: state.q + seite * R, seite };
    state.glimm = 0;
    // Woran es lag: Der Draht stand neben dem Ring – dorthin hätte er früher
    // gemusst.
    const wo = view.hoch ? (seite < 0 ? "links" : "rechts") : (seite < 0 ? "oben" : "unten");
    const zitter = zitterHuelle(state.S) > 0;
    const schwingt = state.draht.beweg.some((b) => b.art === "schwingt" && state.S >= b.s0 && state.S < b.s1);
    state.grund = zitter
      ? "Am Zitterdraht berührt – dort genau in die Mitte"
      : `${wo[0].toUpperCase()}${wo.slice(1)} berührt – früher nach ${wo}${schwingt ? " (Magnet)" : ""}`;
    funken(state.kontakt.s, state.kontakt.q, 46, 1.2, FUNKEN);
    funken(state.kontakt.s, state.kontakt.q, 14, 0.6, ["#ffffff", "#bfe8ff"]);
    schrift("Berührt!", "#ff8a5c", 1.15);
    if (state.phase === "spiel") {
      kids()?.playJingle?.("retry");
      kids()?.vibrate?.([45, 30, 45, 30, 90]);
      stepTimer = window.setTimeout(finish, 1100);
    }
  }

  // Glimmen, «knapp!», «sauber!» – aus der Luft, die der Ring in diesem
  // Bild hatte. Mit Ton nur im eigenen Spiel.
  function rueckmeldung(dt, mitTon) {
    const st = state;
    const nah = clamp(1 - st.frei / KNAPP, 0, 1);
    st.glimm += (nah - st.glimm) * Math.min(1, dt * (nah > st.glimm ? 22 : 6));
    if (nah > 0) {
      st.sauberN = 0;
      st.sauberAb = st.S;
      // Funken springen über.
      if (!ruhig() && Math.random() < dt * 30 * nah) {
        funken(st.S, st.q + st.seite * radiusBei(st.S), 2, 0.5, FUNKEN);
      }
    } else if (st.S - st.sauberAb >= SAUBER) {
      st.sauberN += 1;
      st.sauberAb = st.S;
      st.glanz = 1;
      schrift(st.sauberN > 1 ? `sauber ×${st.sauberN}` : "sauber!", "#7ff7ea", 0.9);
      funken(st.S, st.q, 16, 0.5, GLITZER);
      if (mitTon) kids()?.playJingle?.("correct");
    }
    if (st.frei < 0.1 && st.zeit - st.knappZeit > 1.4) {
      st.knappZeit = st.zeit;
      schrift("knapp!", "#ffb35c", 0.8);
      if (mitTon) kids()?.vibrate?.(12);
    }
    st.glanz = Math.max(0, st.glanz - dt * 1.3);
  }

  function zaehle(mitTon) {
    const meter = Math.floor(meterBei(state.S));
    if (meter === state.meter) return;
    if (Math.floor(meter / 100) > Math.floor(state.meter / 100)) {
      schrift(`${Math.floor(meter / 100) * 100} m`, "#5fe6dc", 1);
      if (mitTon) kids()?.playJingle?.("star");
    }
    state.meter = meter;
    state.punkte = meter;
    shell.setCount(meter);
  }

  function takt(dt) {
    state.zeit += dt;
    if (state.stoss > 0) state.stoss = Math.max(0, state.stoss - dt * 2.2);

    if (state.phase === "zuschauen") {
      zuschauenTakt(dt);
    } else if (state.schritt === "fahrt") {
      state.frei = 1;
      const n = Math.max(1, Math.ceil(dt / TAKT - 1e-9));
      for (let i = 0; i < n && state.schritt === "fahrt"; i += 1) physik(dt / n);
      if (state.schritt === "fahrt") rueckmeldung(dt, true);
      zaehle(true);
    } else if (state.schritt === "start") {
      // Vor dem ersten Zug schwebt der Ring am Draht, und der Draht summt.
      state.q = START_Q + (ruhig() ? 0 : Math.sin(state.zeit * 2.2) * 2.5);
      state.ziel = state.q;
    }

    // Funken: Sie fallen im Bild nach unten – quer ist das q, hochkant -s.
    const gs = view.hoch ? -320 : 0;
    const gq = view.hoch ? 0 : 320;
    for (let i = state.teile.length - 1; i >= 0; i -= 1) {
      const t = state.teile[i];
      t.vs = (t.vs + gs * dt) * (1 - 1.2 * dt);
      t.vq = (t.vq + gq * dt) * (1 - 1.2 * dt);
      t.s += t.vs * dt;
      t.q += t.vq * dt;
      t.leben -= dt;
      if (t.leben <= 0) state.teile.splice(i, 1);
    }
    for (let i = state.schriften.length - 1; i >= 0; i -= 1) {
      state.schriften[i].leben -= dt;
      if (state.schriften[i].leben <= 0) state.schriften.splice(i, 1);
    }

    // Was ganz hinter dem Bild liegt, muss niemand mehr fragen.
    const B = state.draht.beweg;
    while (bewegAb < B.length && B[bewegAb].s1 < state.S - 1200) bewegAb += 1;
    drahtBis(state.S + Math.max(VORAUS, sichtVor()) + 200);

    if (state.phase === "spiel") {
      gegner?.takt(state.punkte, { a: Math.round(state.S), b: Math.round(state.q), c: state.schritt === "crash" ? 1 : 0 });
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
  // Ein aufgezeichneter Lauf an seinem eigenen Draht: Der Zufall hält die
  // Saat (geist.js, zuschauer), startRun baut damit denselben Draht, und der
  // Ring steht Bild für Bild dort, wo er damals war. Glimmen und Funken
  // folgen aus derselben Rechnung wie im Spiel – nur ohne Ton.
  function zuschauenStarten() {
    if (!zuschauer?.lauf) return;
    startRun();
    state.phase = "zuschauen";
    state.schritt = "fahrt";
    shell.setPhase("play");
    zuschauer.los();
  }

  function zuschauenTakt(dt) {
    const s = zuschauer.stand();
    if (!s) return;
    if (state.schritt === "fahrt") {
      state.S = Math.max(0, s.a);
      state.q = s.b;
      state.ziel = s.b;
      drahtBis(state.S + Math.max(VORAUS, sichtVor()) + 200);
      state.frei = 1;
      const ab = pruefeBeruehrung(false);
      if (s.c >= 1) beruehrt(ab);
      else rueckmeldung(dt, false);
    }
    const meter = Math.max(0, Math.floor(s.punkte));
    if (meter !== state.meter) {
      state.meter = meter;
      state.punkte = meter;
      shell.setCount(meter);
    }
    zuschauer.weiter();
  }

  // ---------------------------------------------------------------------------
  // Ziehen und Tasten
  // ---------------------------------------------------------------------------
  // Die Runde beginnt: mit dem ersten Zug – oder im Live-Modus zum
  // gemeinsamen Start (game-shell.js, live.los).
  function losGehts() {
    if (state.phase !== "bereit") return;
    state.phase = "spiel";
    state.schritt = "fahrt";
    state.q = START_Q;
    state.ziel = START_Q;
    state.sauberAb = state.S;
    shell.setPhase("play");
    gegner?.los();
    kids()?.vibrate?.(8);
  }

  function druecken() {
    if (state.phase === "zuschauen") return;
    // Im Live-Modus beginnt die Runde für alle zugleich (live.los).
    if (!shell.live) losGehts();
  }

  function loslassen() {
    zeiger = null;
    tasteMinus = false;
    tastePlus = false;
  }

  // Der Finger hat sich quer um dq bewegt (Welteinheiten): Der Ring geht
  // genau so weit mit – so schnell er kann. Was der Finger ihm weiter
  // vorauseilt, verfällt.
  function ziehe(dq) {
    if (state.phase === "bereit") druecken();
    if (state.phase !== "spiel" || state.schritt !== "fahrt") return;
    state.ziel = clamp(state.ziel + dq, state.q - VORSPRUNG, state.q + VORSPRUNG);
  }

  // Für Prüfung und Vorführung: Der Ring soll nach q – er fährt hin, so
  // schnell er kann.
  function setzeRing(q) {
    if (state.phase !== "spiel" || state.schritt !== "fahrt") return;
    state.ziel = clamp(q, 0, BAND);
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
    state.S = 0;
    state.q = START_Q;
    state.ziel = START_Q;
    state.draht = neuerDraht();
    suchI = 0;
    bewegAb = 0;
    state.frei = 1;
    state.glimm = 0;
    state.seite = 1;
    state.teile = [];
    state.schriften = [];
    state.stoss = 0;
    state.zeit = 0;
    state.crashZeit = 0;
    state.kontakt = null;
    state.grund = "";
    state.sauberAb = 0;
    state.sauberN = 0;
    state.knappZeit = -9;
    state.glanz = 0;
    zeiger = null;
    tasteMinus = false;
    tastePlus = false;
    drahtBis(VORAUS + 400);
    shell.setCount(0);
    gegner?.runde();

    shell.clear();
    promptEl = shell.el("p", "cm-prompt hd-prompt", "Ziehen – der Ring folgt. Den Draht nie berühren!");
    shell.play.append(promptEl, buildPlatz());
    view.cssW = 0;
    view.cssH = 0;
    messen();
    drahtBis(state.S + Math.max(VORAUS, sichtVor()) + 200);

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
    const best = vorher ? `Bestwert ${vorher} m` : "";
    shell.showResult({
      label: "Deine Meter",
      points: punkte,
      detail: rekord ? "Neuer Rekord!" : [state.grund, best].filter(Boolean).join(" · "),
      geist,
    });
    if (rekord) host.querySelector(".cm-result-detail")?.classList.add("hd-rekord");
    zaehleHoch(punkte);
  }

  // ---------------------------------------------------------------------------
  // Start
  // ---------------------------------------------------------------------------
  shell = shellApi.mount({
    host,
    title: "Heisser Draht",
    area: "konzentration",
    accent: "#1BA7A6",
    accentDark: "#137978",
    clock: false,
    onRestart: () => (zuschauer ? zuschauenStarten() : startRun()),
    live: { los: losGehts, stopp: () => finish(), zuschauen: (quelle) => { zuschauer = quelle; zuschauenStarten(); } },
  });
  zuschauer = window.LernappGeist?.zuschauer?.({
    host, spiel: "wireLoop", fassung: "t1", zufall, einheit: "m", nochmal: zuschauenStarten,
  }) || null;
  if (!zuschauer) {
    gegner = window.LernappGeist?.fuer?.({ spiel: "wireLoop", host, art: "tempo", alle: true, zufall }) || null;
  }

  startRun();
  zuschauer?.laden.then((da) => { if (da) zuschauenStarten(); });

  // Ein Finger irgendwo aufs Bild: Er führt ab jetzt, relativ – wie weit er
  // sich bewegt, so weit geht der Ring. Ein neuer Finger übernimmt.
  host.addEventListener("pointerdown", (event) => {
    if (event.target.closest("button, a, input")) return;
    if (state.phase === "zuschauen") return;
    zeiger = { id: event.pointerId, x: event.clientX, y: event.clientY };
    druecken();
  });
  window.addEventListener("pointermove", (event) => {
    if (!zeiger || event.pointerId !== zeiger.id) return;
    const dx = event.clientX - zeiger.x;
    const dy = event.clientY - zeiger.y;
    zeiger.x = event.clientX;
    zeiger.y = event.clientY;
    if (view.k > 0) ziehe((view.hoch ? dx : dy) / view.k);
  });
  const fingerWeg = (event) => {
    if (zeiger && event.pointerId === zeiger.id) zeiger = null;
  };
  window.addEventListener("pointerup", fingerWeg);
  window.addEventListener("pointercancel", fingerWeg);
  // Wer das Fenster verlässt, nimmt auch Finger und Tasten weg.
  window.addEventListener("blur", loslassen);

  // Die Pfeile schieben den Ring: auf und links weniger q, ab und rechts
  // mehr. Leertaste und Enter beginnen nur.
  const TASTEN = { ArrowUp: -1, ArrowLeft: -1, ArrowDown: 1, ArrowRight: 1, " ": 0, Enter: 0 };
  document.addEventListener("keydown", (event) => {
    if (!(event.key in TASTEN)) return;
    if (document.activeElement?.tagName === "BUTTON") return;
    event.preventDefault();
    if (event.repeat) return;
    if (TASTEN[event.key] < 0) tasteMinus = true;
    if (TASTEN[event.key] > 0) tastePlus = true;
    druecken();
  });
  document.addEventListener("keyup", (event) => {
    if (!(event.key in TASTEN)) return;
    if (TASTEN[event.key] < 0) tasteMinus = false;
    if (TASTEN[event.key] > 0) tastePlus = false;
  });

  window.addEventListener("resize", messen);
  window.addEventListener("orientationchange", messen);
  window.addEventListener("pagehide", () => { clearStep(); stopLoop(); });

  // Für die Prüfskripte und die Vorführung. Strecken in Metern, quer in
  // Welteinheiten (0 bis BAND).
  window.LernappDraht = {
    METER, BAND, TAKT, V_RING, V_TASTE, VORAUS, DRAHT_R, state, view, takt, druecken, loslassen, ziehe, setzeRing,
    drahtBis,
    saat: () => zufall.saat?.() ?? null,
    // Die Mitte des Drahts bei meter, so wie er gerade liegt – mit dem
    // Schwingen, ohne das Zittern (dem folgt man nicht, dem weicht man aus).
    drahtBei: (meter) => basis(meter * METER) + bewegung(meter * METER, state.S, false),
    // Wie weit er dort höchstens zittert.
    zitterBei: (meter) => zitterHuelle(meter * METER),
    // Wie viel Luft der Ring dort quer hat (ohne Zittern).
    toleranzBei: (meter) => toleranz(meter * METER),
    tempoBei: (meter) => tempoBei(meter * METER),
    radiusBei: (meter) => radiusBei(meter * METER),
    // Was der Draht dem Ring abverlangt: quer (Welteinheiten/s) und
    // umlenken (Welteinheiten/s²), an der Stelle meter.
    vOkBei: (meter) => vOkBei(meter * METER),
    aOkBei: (meter) => aOkBei(meter * METER),
  };
})();
