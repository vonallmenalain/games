/*
 * spiegelsee.js – Spiegelsee.
 * ---------------------------------------------------------------------------
 * Ein stiller Bergsee im Morgengrauen. Eine Läuferin rennt von selbst am Ufer
 * entlang nach rechts, darunter läuft ihr Spiegelbild kopfüber im Wasser mit.
 * Eine Regel: Ein Tipp lässt beide zugleich springen – die Läuferin hinauf,
 * das Spiegelbild hinab in die Tiefe des Sees, immer im selben Bogen. Einen
 * Doppelsprung gibt es nicht: Ein Tipp in der Luft verfällt.
 *
 * Aber der See zeigt nicht die Wirklichkeit. Die ersten Sekunden spiegelt er
 * treu – unten steht genau, was oben steht, und man lernt den Sprung. Dann
 * erwacht er (angesagt): Ein Lichtschimmer läuft über die Wasserlinie, unten
 * wird es Nacht mit Sternen und Mond, oben bleibt die Morgenröte – und die
 * Spiegelwelt geht eigene Wege. Unten stehen andere Hindernisse als oben,
 * und ein Sprung muss für beide Welten passen. Man liest zwei Welten
 * zugleich; das ist das Ungewohnte, das man durch Üben lernt.
 *
 * Die Bildsprache ist in beiden Welten dieselbe:
 *
 *   Was den Weg berührt, muss man überspringen – oben Steine und Baumstämme,
 *   unten, was von der Wasserlinie in die Tiefe hängt: Eiskristalle,
 *   Schilf, Wurzeln.
 *   Was frei über dem Kopf hängt, darunter springt man nicht – oben Äste und
 *   Felsdächer, unten, was tiefer im Wasser schwebt: Hechte, Quallen,
 *   Treibholz. Unter jedem liegt auf dem Weg ein Schatten, unten ein Schein
 *   auf der Wasserlinie: So weit reicht es.
 *
 * Die Abwechslung kommt aus der Welt, nicht aus einer zweiten Taste. In den
 * ersten 400 m kommt etwa alle 50 m etwas Neues (der Lehrpfad): der Stein,
 * der Ast, das Erwachen, ein Steg eine Etage höher (liegt der Weg höher,
 * liegt das Spiegelbild tiefer), ein Hecht, der durch die Wasserlinie
 * springt, die erste Gabelung, Nebel. Danach ein fester, angesagter
 * Rhythmus (RHYTHMUS):
 *
 *   Gabelung    Hinter dem Ufer beginnt ein zweiter Weg, eine Etage höher;
 *               hinauf kommt nur, wer im Fenster vor seiner Treppe springt.
 *               An einer Sackgasse führt einer der beiden sicher ins Ende –
 *               oben sieht alles heil aus, der See zeigt, welcher hält. An
 *               einer Abkürzung ist oben schwerer, dafür gibt es Meter.
 *   Spiegeltor  Ein Bogen aus Licht: Wer hindurchläuft, für den kippt das
 *               ganze Bild um die Wasserlinie – die Nachtwelt steht oben
 *               aufrecht, das Ufer hängt kopfüber im See. Das nächste Tor
 *               kippt zurück.
 *   Nebel       Er verdeckt das Ufer, aber der See zeigt es treu.
 *   Holzsteg    Lücken in den Brettern, ab dem zweiten mit Hechten darunter.
 *   Etage       Der ganze Weg eine Etage höher, mit Rampen.
 *
 * Alle 300 m eine andere Landschaft (LAND_BILD): Lärchenufer, Schilfgürtel,
 * Felsufer, Gletschersee – jede mit eigenem Himmel, Licht und Nacht und
 * eigenen Hindernissen in derselben Bildsprache. Vögel und Fischschwärme
 * ziehen ihr entgegen, ein Steinbock springt auf den Weg. Gezählt werden die
 * Meter.
 *
 * Gebaut wird die Strecke aus dem Zufall (zufall.js): ohne Turnier jedes Mal
 * eine andere, im Turnier für alle im selben Versuch dieselbe. Alles hängt
 * nur an der Spielzeit seit dem Start: Die Läuferin rennt immer gleich
 * schnell (xBei), ob sie springt oder nicht, und was sich bewegt, bewegt
 * sich nach der Spielzeit. Die Strecke ist immer zu schaffen, weil zuerst
 * ein Weg entsteht – Abschnitt um Abschnitt, wann sie abspringt
 * (naechsterAbschnitt) – und dann die Hindernisse beider Welten um ihn
 * herum, so gross, dass jeder Sprung bis zu «luft» zu früh oder zu spät noch
 * gelingt. Jeder Abschnitt wird nachgeprüft (sicher, wie im Spiel gerechnet:
 * bewege): alle Ecken der Luft, auch über den Sprung davor hinweg; an einer
 * Gabelung jeder Weg, der halten soll. Ein Tipp gilt zu seiner Zeit, nicht
 * erst im nächsten Bild (tippen, voraus).
 *
 * Das Bild: oben ein Schweizer Bergsee im Morgenlicht – Gipfel und Gletscher,
 * Hänge, Bäume, Morgennebel, Vögel. Unten erst ihr Spiegelbild, nach dem
 * Erwachen eine Nacht mit Mond, Sternen, Polarlicht, Schwebeteilchen und
 * einem Grund, auf den Licht durchs Wasser fällt. Jede grosse Fläche wird
 * einmal gemalt (gespiegelte Ebenen schon gespiegelt) und dann nur noch
 * aufgelegt, Punkt auf Punkt: Auf dem iPhone rechnet der Prozessor jede
 * gemalte Fläche, jedes Bild. Vorgemalt sind nur die Landschaft, in der sie
 * läuft, und die nächste – die nächste Stück für Stück, in Bildern mit Zeit
 * übrig. Beim ersten Start glühen die Gipfel erst auf.
 *
 * Die Gegner (geist.js) laufen als Läuferinnen aus Licht mit, und die besten
 * Läufe lassen sich anschauen (?zuschauen=): auf derselben Strecke, gebaut
 * mit derselben Saat.
 *
 * Zehn Einheiten sind ein Meter. x zählt voraus, Höhen vom Weg am Ufer weg:
 * oben nach oben, in der Spiegelwelt nach unten – beide Welten rechnen
 * gleich.
 */
(() => {
  "use strict";

  if (document.body.dataset.page !== "spiegelsee") return;

  const host = document.querySelector("#sg-stage");
  const shellApi = window.LernappGameShell;
  const cloudApi = window.LernappGameCloud;
  if (!host || !shellApi) return;

  const kids = () => window.LernappKids || null;
  const klang = () => window.ArcadeKlang || null;
  const ruhig = () => Boolean(kids()?.prefersReducedMotion?.());

  // Der Zufall. Nur die Strecke zieht daraus – der Weg und die Hindernisse.
  // Atem, Ringe, Funkeln und was aufstiebt hängen an festen Zahlen oder an
  // Math.random.
  const zufall = window.LernappZufall?.fuer?.("mirrorLake") || {
    neu() {},
    zahl: () => Math.random(),
  };

  // ---------------------------------------------------------------------------
  // Die Regeln
  // ---------------------------------------------------------------------------
  const METER = 10;
  const TOP = 24;                  // so gross ist sie, von den Sohlen bis zum Scheitel
  const LH = 4.5;                  // so breit stösst sie an (halb), Arme und Beine weniger
  const UFER = 5;                  // so hoch liegt der Weg über dem Wasser
  // Der Sprung: immer derselbe Bogen, SPRUNG Sekunden lang, HOCH hoch.
  const SPRUNG = 0.6;
  const HOCH = 40;
  // Was über dem Kopf hängt, hängt mit der Unterkante DECKE über dem Weg
  // (unten: so tief unter dem gespiegelten Weg) – wer dort mehr als
  // DECKE − TOP abhebt, stösst an.
  const DECKE = TOP + 6;
  const RAND = 3;                  // so weit darf ihre Mitte über eine Steglücke
  // Das Tempo nach der Spielzeit: von 14 Metern in der Sekunde auf bald 20;
  // in den ersten ANFAHRT Sekunden läuft sie an.
  const V0 = 140;
  const V_MAX = 215;
  const V_ZEIT = 50;
  const ANFAHRT = 0.5;
  // Die Luft: um so viele Sekunden darf jeder Sprung zu früh oder zu spät
  // kommen. Die ersten Sekunden zum Hineinfinden ±150 ms, nach 10 s ±114,
  // nach 20 s ±71, nach 30 s ±50, nach einer Minute ±32, nie unter ±30.
  const E0 = 0.15;
  const E_MIN = 0.03;
  const E_ZEIT = 14;
  const E_AB = 5;
  const SCHWER_ZEIT = 21;          // nach so vielen Sekunden sind gut sechs Zehntel der Härte da
  const SCHWER_AB = 4;
  const ERWACHEN_AB = 7.6;         // ab hier erwacht der See (mit dem nächsten Abschnitt)
  const SICHT = 250;               // so weit sieht man voraus, hoch wie quer
  const PERIODE = 480;             // so lang ist ein Stück gemaltes Ufer
  const TAKT = 1 / 240;
  const STURZ_MS = 2300;
  // Fassung der Aufzeichnung: t2 kennt Etagen, Gabelungen und das Spiegeltor
  // (c trägt die Spur und ob die Welt gekippt ist).
  const FASSUNG = "t2";
  // Eine Etage: So hoch liegt ein Steg oder Felsband über dem Weg am Ufer –
  // gut die Hälfte ihrer Grösse; die Rampen hinauf und hinab sind RAMPE lang.
  const ETAGE = 16;
  const RAMPE = 48;
  // Das Spiegeltor kippt das Bild in DREH Sekunden um die Wasserlinie.
  const DREH = 0.75;
  // Die Landschaften: bis LAND_AB das Lärchenufer, dann alle LAND_LANG die
  // nächste (Einheiten), im Kreis.
  const LAND_AB = 4000;
  const LAND_LANG = 3000;
  // So viele Meter schenkt der obere Weg einer Abkürzung.
  const BONUS = 40;

  const TOP_COUNT = 5;
  const store = cloudApi
    ? cloudApi.register({ key: "lernapp.spiegelsee", empty: { runs: 0, scores: [] }, merge: cloudApi.mergeScores(TOP_COUNT) })
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

  // Der Weg nach der Zeit: erst anlaufen, dann V0 gegen V_MAX. Geschlossen
  // gerechnet – der Ort hängt nur an der Zeit, nie an der Länge der
  // Rechenschritte.
  const tempoHaupt = (t) => V_MAX - (V_MAX - V0) * Math.exp(-t / V_ZEIT);
  const wegHaupt = (t) => V_MAX * t - (V_MAX - V0) * V_ZEIT * (1 - Math.exp(-t / V_ZEIT));
  const X_ANFAHRT = (V0 * ANFAHRT) / 2;
  const WEG_ANFAHRT = wegHaupt(ANFAHRT);
  function xBei(t) {
    if (t <= 0) return 0;
    if (t < ANFAHRT) return (V0 * t * t) / (2 * ANFAHRT);
    return X_ANFAHRT + wegHaupt(t) - WEG_ANFAHRT;
  }
  function tempoBei(t) {
    if (t <= 0) return 0;
    if (t < ANFAHRT) return (V0 * t) / ANFAHRT;
    return tempoHaupt(t);
  }
  // Und umgekehrt: wann sie an der Stelle x ist.
  function tBei(x) {
    if (x <= 0) return 0;
    if (x < X_ANFAHRT) return Math.sqrt((2 * ANFAHRT * x) / V0);
    let t = ANFAHRT + (x - X_ANFAHRT) / V0;
    for (let i = 0; i < 8; i += 1) t -= (xBei(t) - x) / tempoBei(t);
    return t;
  }

  // Der Bogen des Sprungs, tau Sekunden nach dem Absprung, über dem Boden,
  // von dem sie absprang. bogenY hört bei der Landung auf; bogenFrei fällt
  // weiter, wenn der Boden unter ihr tiefer liegt (eine Rampe hinab).
  const bogenFrei = (tau) => (tau <= 0 ? 0 : (4 * HOCH * tau * (SPRUNG - tau)) / (SPRUNG * SPRUNG));
  const bogenY = (tau) => (tau <= 0 || tau >= SPRUNG ? 0 : bogenFrei(tau));
  // Wann sie im Fallen wieder d über dem Absprung ist (und wann steigend).
  const tauRunter = (d) => SPRUNG / 2 + Math.sqrt(Math.max(0, (SPRUNG * SPRUNG) / 4 - (d * SPRUNG * SPRUNG) / (4 * HOCH)));
  const tauHoch = (d) => SPRUNG - tauRunter(d);
  // So lange nach dem Absprung (und so lange vor der Landung) ist sie höher
  // als DECKE − TOP.
  const TAU_DECKE = (SPRUNG - Math.sqrt(SPRUNG * SPRUNG - ((DECKE - TOP) * SPRUNG * SPRUNG) / HOCH)) / 2;

  const luftBei = (t) => E_MIN + (E0 - E_MIN) * Math.exp(-Math.max(0, t - E_AB) / E_ZEIT);
  const schwere = (t) => 1 - Math.exp(-Math.max(0, t - SCHWER_AB) / SCHWER_ZEIT);

  function hash01(n) {
    const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return x - Math.floor(x);
  }

  // Ein fester Zufall für das Bild: Die Landschaft sieht jedes Mal gleich aus.
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

  // Weiches Rauschen; rauschenRund wiederholt sich nach n Stützstellen.
  function rauschenRund(u, n, saat) {
    const i = Math.floor(u);
    const f = u - i;
    const a = hash01((((i % n) + n) % n) * 1.37 + saat);
    const b = hash01(((((i + 1) % n) + n) % n) * 1.37 + saat);
    return lerp(a, b, f * f * (3 - 2 * f));
  }
  function rauschen(u, saat) {
    const i = Math.floor(u);
    const f = u - i;
    return lerp(hash01(i * 1.37 + saat), hash01((i + 1) * 1.37 + saat), f * f * (3 - 2 * f));
  }

  const mix3 = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
  const rgb = (c) => `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`;
  const rgba = (c, alpha) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${alpha})`;

  // ---------------------------------------------------------------------------
  // Zustand
  // ---------------------------------------------------------------------------
  // phase:   "bereit" (noch nichts getippt), "spiel", "zuschauen", "ende"
  // schritt: "start" (sie steht), "lauf", "sturz"
  const state = {
    phase: "bereit",
    schritt: "start",
    punkte: 0,
    t: 0,                    // die Spielzeit; sie läuft bei null los
    zeit: 0,                 // die Uhr des Bildes
    // Die Läuferin (laeuferNeu): wo sie ist, wie hoch über dem Weg am Ufer
    // (A) und über ihrem Boden (y), auf welcher Spur, wann sie zuletzt
    // absprang (null: am Boden) und wann sie zuletzt landete.
    laeuferin: null,
    spruenge: 0,
    verfallen: 0,            // Tipps in der Luft
    bonus: 0,                // Meter, die Abkürzungen geschenkt haben
    weg: [],                 // der vorgeschlagene Weg (an Gabelungen der richtige bzw. der obere)
    hindernisse: [],
    bewegte: [],             // was sich bewegt: Vögel, Fische, der springende Hecht
    bewegtAlle: [],          // dasselbe, nie ausgedünnt (für kursText)
    abschnitte: [],
    stege: [],
    nebel: [],
    etagen: [],              // Spur 0 eine Etage höher: { a, b, nr, land }
    gabeln: [],              // die Gabelungen (baueGabel)
    tore: [],                // die Spiegeltore: { x, t, nr, nummer }
    freiAb: ANFAHRT,
    sauberAb: null,          // nach einer Gabelung: ab hier am Boden des Ufers, wie auch immer
    planFehler: 0,
    planLog: [],             // wo die Planung ausweichen musste (für die Prüfung)
    nebelZahl: 0,
    stegZahl: 0,
    gabelZahl: 0,
    sackZahl: 0,
    lehr: 0,                 // so viele Stationen des Lehrpfads sind gebaut
    taktAb: null,            // ab diesem Abschnitt gilt der feste Rhythmus
    langMax: 120,
    erwacheT: null,          // wann der See erwacht (aus dem Plan)
    nachWecken: 0,
    erwacht: false,
    angesagt: false,
    abschnitt: -1,
    sturz: null,
    teile: [],
    ringe: [],
    atem: [],
    schriften: [],
    ansage: null,
    ansagen: [],             // was nach der laufenden Ansage kommt
    gemeldet: {},            // was schon angesagt ist (Landschaften, Tore …)
    camX: 0,
    stoss: 0,
    stauch: 0,
    lauf: 0,                 // die Phase der Schritte
    atemUhr: 0,
    intro: null,
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
  let morgen = null;
  let wind = null;
  let schritte = null;
  let tippRinge = null;
  let ersterStart = true;

  const view = { s: 1, dpr: 1, cssW: 0, cssH: 0, frei: 0, rx: 30, wl: 300, pfad: 290, hz: 200, berg: 100 };

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
    morgen = klang()?.kulisse("spiegelsee.morgen") || null;
    morgen?.laut(0.5);
    wind = klang()?.kulisse("spiegelsee.wind") || null;
    wind?.setze(0.22);
    wind?.laut(0.3);
    schritte = klang()?.kulisse("spiegelsee.schritte", { laut: 0 }) || null;
  }

  function klangStellen() {
    const r = state.laeuferin;
    const laeuft = state.schritt === "lauf" && r.sprung === null && state.t > 0.05;
    schritte?.setze(clamp((tempoBei(state.t) - 60) / 700, 0.08, 0.26));
    schritte?.laut(laeuft ? 0.55 : 0);
  }

  function klangAus() {
    schritte?.stop();
    morgen?.stop();
    wind?.stop();
    schritte = null;
    morgen = null;
    wind = null;
  }

  // ---------------------------------------------------------------------------
  // Die Landschaften (ihr Bild: LAND_BILD)
  // ---------------------------------------------------------------------------
  const LANDSCHAFT = [
    { name: "Lärchenufer", farbe: "#ffd9b0" },
    { name: "Schilfgürtel", farbe: "#ffe8a0" },
    { name: "Felsufer", farbe: "#d8ecff" },
    { name: "Gletschersee", farbe: "#c8f4ff" },
  ];

  // ---------------------------------------------------------------------------
  // Die Hindernisse
  // ---------------------------------------------------------------------------
  /*
   * Drei Arten, in beiden Welten gleich gerechnet (welt "oben" oder "unten"):
   *
   *   boden   [a, b], h hoch (unten: so tief), der höchste Punkt bei p
   *           (Anteil), Flanken nach q. Wer es mit dem Körper (x ± LH)
   *           berührt, stürzt. Gemalt wird genau dieser Umriss (profil).
   *           Oben: Stein, Stamm, Kiste, Eisblock, Steinbock. Unten:
   *           Kristall, Schilf, Wurzel, Seerose, Zapfen, Scholle.
   *   decke   [a, b], die Kante bei DECKE: Wer darunter abhebt, stösst an.
   *           Oben: Ast, Felsdach, Netz, Weide, Föhre, Eiszapfen, Vögel.
   *           Unten: Hecht, Qualle, Treibholz, Fischschwarm.
   *   luecke  [a, b], ein fehlendes Stück im Steg: Wer am Boden mit seiner
   *           Mitte mehr als RAND über die Kante kommt, fällt ins Wasser.
   *
   * Jedes steht auf einer Spur (spur: 0 der Weg am Ufer, 1 der obere Weg
   * einer Gabelung) und auf deren Boden (g: so hoch liegt er dort über dem
   * Weg am Ufer; auf einer Etage ETAGE). Gerechnet wird von dort aus: oben
   * hinauf, in der Spiegelwelt vom gespiegelten Boden hinab. Liegt der Weg
   * höher, liegt das Spiegelbild tiefer – und was unten von der Wasserlinie
   * hängt, reicht entsprechend weiter hinab. Die Bildsprache bleibt: Was den
   * Weg berührt, überspringt man; was über dem Kopf hängt, darunter springt
   * man nicht.
   *
   * spiegel: Der See zeigt es treu (in den ersten Sekunden, im Nebel, am
   * Holzsteg). nebel: Oben verdeckt es der Nebel. ab: Es ist erst ab dieser
   * Spielzeit da (der Steinbock springt vom Fels herab). verdeckt: Oben sieht
   * man es nicht, nur im See – die Falle einer Sackgasse.
   *
   * Was sich bewegt (bewegt), steht in state.bewegte: Vögel und
   * Fischschwärme sind Decken, die ihr mit u Einheiten je Sekunde
   * entgegenziehen (zur Zeit tRef stehen sie bei [a, b]); der Hecht springt
   * im Bogen durch die Wasserlinie (springer, springerBei) – gefährlich nur
   * in dem Moment, in dem er unter ihr durchfliegt, in beiden Welten.
   */
  function profil(o, x) {
    if (x <= o.a || x >= o.b) return 0;
    const u = (x - o.a) / (o.b - o.a);
    const k = u < o.p ? (o.p - u) / o.p : (u - o.p) / (1 - o.p);
    return o.h * Math.sqrt(Math.max(0, 1 - k ** o.q));
  }

  // Der höchste Punkt zwischen x0 und x1.
  function profilMax(o, x0, x1) {
    if (x1 <= o.a || x0 >= o.b) return 0;
    const gipfel = o.a + o.p * (o.b - o.a);
    if (x0 <= gipfel && x1 >= gipfel) return o.h;
    return x1 < gipfel ? profil(o, x1) : profil(o, x0);
  }

  // Das erste Hindernis, das bei x noch reichen könnte (sie liegen nach a
  // geordnet; aus beiden Welten und Spuren dürfen sie sich überdecken,
  // darum der Blick um die grösste Länge zurück).
  function abIndex(x) {
    const liste = state.hindernisse;
    const ziel = x - state.langMax;
    let lo = 0;
    let hi = liste.length;
    while (lo < hi) {
      const m = (lo + hi) >> 1;
      if (liste[m].a < ziel) lo = m + 1; else hi = m;
    }
    return lo;
  }

  // Wo der springende Hecht zur Zeit t ist: Mitte x, Höhe y über seinem
  // Boden, wie steil er fliegt – und ob ein Stück von ihm über dem Wasser
  // ist (sonst schwimmt er nur und tut keinem etwas).
  function springerBei(o, t) {
    const d = t - o.tm;
    const y = o.hp - o.kk * d * d;
    return { x: o.xm + o.u * (o.tm - t), y, w: Math.atan2(2 * o.kk * d, o.u), raus: y + o.th > -UFER - o.g };
  }

  // Was sie (oder ihr Spiegelbild) hier trifft: x ihre Mitte, A die Höhe der
  // Sohlen über dem Weg am Ufer, luft ob sie fliegt, spur ihr Weg, t die
  // Spielzeit (für das, was sich bewegt). null heisst: nichts.
  function trifft(x, A, luft, spur = 0, t = state.t) {
    const liste = state.hindernisse;
    for (let i = abIndex(x - LH - 1); i < liste.length; i += 1) {
      const o = liste[i];
      if (o.a > x + LH + 1) break;
      if (o.b < x - LH - 1 || o.spur !== spur) continue;
      if (o.ab !== undefined && t < o.ab) continue;
      const y = A - o.g;
      if (o.kind === "luecke") {
        if (!luft && x > o.a + RAND && x < o.b - RAND) return o;
      } else if (o.kind === "boden") {
        if (profilMax(o, x - LH, x + LH) > y + 0.3) return o;
      } else if (x + LH > o.a && x - LH < o.b && y + TOP > DECKE) {
        return o;
      }
    }
    const bewegte = state.bewegte;
    for (let i = 0; i < bewegte.length; i += 1) {
      const o = bewegte[i];
      if (o.spur !== spur) continue;
      const y = A - o.g;
      if (o.kind === "springer") {
        // Über dem Wasser ist er nur eine knappe Sekunde.
        if (t < o.tm - 0.5 || t > o.tm + 0.5) continue;
        const p = springerBei(o, t);
        if (!p.raus || Math.abs(p.x - x) > LH + o.L / 2) continue;
        if (y < p.y + o.th && y + TOP > p.y - o.th) return o;
      } else {
        const d = o.u * (o.tRef - t);
        if (x + LH > o.a + d && x - LH < o.b + d && y + TOP > DECKE) return o;
      }
    }
    return null;
  }

  function einreihen(o) {
    if (o.bewegt) {
      state.bewegte.push(o);
      state.bewegtAlle.push(o);
      return;
    }
    const liste = state.hindernisse;
    let i = liste.length;
    while (i > 0 && liste[i - 1].a > o.a) i -= 1;
    liste.splice(i, 0, o);
    state.langMax = Math.max(state.langMax, o.b - o.a + 2);
  }

  // Alles eines Abschnitts wieder weg (ein Versuch hielt nicht).
  function abschnittWeg(n) {
    state.hindernisse = state.hindernisse.filter((o) => o.nr !== n);
    state.bewegte = state.bewegte.filter((o) => o.nr !== n);
    state.bewegtAlle = state.bewegtAlle.filter((o) => o.nr !== n);
    state.etagen = state.etagen.filter((e) => e.nr !== n);
    state.gabeln = state.gabeln.filter((g) => g.nr !== n);
  }

  // Die Formen der Hindernisse, die man überspringt: Höhe (leicht, schwer –
  // je von bis), wo der höchste Punkt liegt, wie rund die Flanken sind, wie
  // breit sie mindestens sind.
  const FORMEN = {
    stein: { h: [9, 12, 13, 20], p: [0.36, 0.62], q: [2, 3.2], minB: 9 },
    stamm: { h: [7, 8, 9, 11], p: [0.48, 0.52], q: [6, 9], minB: 14 },
    kiste: { h: [8, 10, 11, 14], p: [0.48, 0.52], q: [7, 10], minB: 12 },
    eisblock: { h: [10, 12, 13, 19], p: [0.35, 0.62], q: [2.6, 4], minB: 10 },
    steinbock: { h: [14, 15, 16, 18], p: [0.45, 0.55], q: [4.5, 6], minB: 15 },
    kristall: { h: [10, 13, 14, 20], p: [0.3, 0.7], q: [1.5, 2.2], minB: 9 },
    schilf: { h: [11, 13, 15, 19], p: [0.42, 0.58], q: [3, 4.5], minB: 9 },
    wurzel: { h: [9, 11, 12, 16], p: [0.3, 0.55], q: [2.4, 3.4], minB: 9 },
    seerose: { h: [10, 12, 14, 18], p: [0.4, 0.6], q: [3, 4.2], minB: 10 },
    zapfen: { h: [10, 13, 14, 20], p: [0.3, 0.7], q: [1.4, 2], minB: 9 },
    scholle: { h: [9, 11, 12, 17], p: [0.35, 0.65], q: [3.5, 5], minB: 12 },
  };
  // Und die, unter denen man durchläuft: wie lang (von bis).
  const DECKEN = {
    ast: [18, 36], dach: [38, 70], netz: [24, 42], weide: [20, 38], foehre: [20, 38], eiszapfen: [28, 52], voegel: [24, 40],
    hecht: [30, 50], qualle: [16, 32], treibholz: [34, 62], fische: [28, 46],
  };

  // Überlebt ein Sprung von t0 dieses Hindernis? Am Boden davor darf sie es
  // nicht berühren, im Flug nicht streifen, und gelandet muss sie dahinter
  // sein.
  function bodenUeberlebt(o, t0) {
    const vor = xBei(t0);
    if (profilMax(o, vor - LH, vor + LH) > 0.3) return false;
    const nach = xBei(t0 + SPRUNG);
    if (nach - LH < o.a + o.p * (o.b - o.a) || profilMax(o, nach - LH, nach + LH) > 0.3) return false;
    // Nur über dem Hindernis lohnt es sich, genau hinzusehen.
    for (let tau = 0; tau < SPRUNG; tau += 1 / 480) {
      const x = xBei(t0 + tau);
      if (x + LH < o.a) continue;
      if (x - LH > o.b) break;
      if (profilMax(o, x - LH, x + LH) > bogenY(tau) + 0.3) return false;
    }
    return true;
  }

  // Von wann bis wann ein Sprung darüber gelingt (null: nie).
  function bodenFenster(o) {
    const gipfel = o.a + o.p * (o.b - o.a);
    const mitte = tBei(gipfel) - SPRUNG / 2;
    if (!bodenUeberlebt(o, mitte)) return null;
    let a = mitte;
    let b = mitte + 0.6;
    for (let i = 0; i < 12; i += 1) { const m = (a + b) / 2; if (bodenUeberlebt(o, m)) a = m; else b = m; }
    const hi = a;
    a = mitte - 0.6;
    b = mitte;
    for (let i = 0; i < 12; i += 1) { const m = (a + b) / 2; if (bodenUeberlebt(o, m)) b = m; else a = m; }
    return { lo: b, hi };
  }

  // Ein Hindernis zum Überspringen, über das ein Sprung zwischen lo und hi
  // hinwegkommt: die Höhe nach der Schwere, die Breite so, dass genau dieses
  // Fenster bleibt.
  function bodenBauen(lo, hi, welt, art, zH, zP, zQ, k) {
    const m = FORMEN[art];
    const W = hi - lo;
    const tm = (lo + hi) / 2;
    const v = tempoBei(tm + SPRUNG / 2);
    let h = lerp(lerp(m.h[0], m.h[1], k), lerp(m.h[2], m.h[3], k), zH);
    const p = lerp(m.p[0], m.p[1], zP);
    const q = lerp(m.q[0], m.q[1], zQ);
    let w = 9;
    for (;;) {
      w = v * (SPRUNG * Math.sqrt(1 - h / HOCH) - W) - 2 * LH + 3;
      if (w >= m.minB || h <= 6) break;
      h -= 1;
    }
    w = Math.max(6, w);
    const o = { kind: "boden", art, welt, a: 0, b: 0, h, p, q, g: 0, spur: 0, saat: hash01(tm * 7.7 + (welt === "unten" ? 3.3 : 0)) };
    let mitte = xBei(tm + SPRUNG / 2);
    const setze = () => { o.a = mitte - w * p; o.b = o.a + w; };
    setze();
    for (let i = 0; i < 5; i += 1) {
      const fen = bodenFenster(o);
      if (!fen) { w *= 0.8; setze(); continue; }
      w = Math.max(6, w + (fen.hi - fen.lo - W) * v * 0.95);
      mitte += (tm - (fen.lo + fen.hi) / 2) * v;
      setze();
    }
    // Zuletzt muss das Fenster [lo, hi] ganz drin sein – sonst etwas schmaler.
    for (let i = 0; i < 24; i += 1) {
      const fen = bodenFenster(o);
      if (fen && fen.lo <= lo + 1e-4 && fen.hi >= hi - 1e-4) break;
      if (fen) mitte += (tm - (fen.lo + fen.hi) / 2) * v;
      w = Math.max(4, w - 0.8);
      setze();
    }
    return o;
  }

  function deckeBauen(a, b, welt, art, z) {
    return { kind: "decke", art, welt, a, b, g: 0, spur: 0, dick: lerp(8, 13, z), saat: hash01(a * 0.37 + (welt === "unten" ? 5.1 : 0)) };
  }

  // Eine Lücke im Steg, über die ein Sprung zwischen lo und hi hinwegkommt:
  // Wer nach hi abspringt, steht schon über der Kante; wer vor lo abspringt,
  // landet noch darin.
  function lueckeBauen(lo, hi) {
    return { kind: "luecke", art: "luecke", welt: "oben", a: xBei(hi) - RAND, b: xBei(lo + SPRUNG) + RAND, g: 0, spur: 0, spiegel: true, saat: hash01(lo * 3.7) };
  }

  // Welche Form in welcher Welt – je Landschaft (landArt) eigene, in
  // derselben Bildsprache.
  const ARTEN = [
    // Lärchenufer
    { obenBoden: ["stein", "stein", "stamm"], obenDecke: ["ast", "ast", "dach"], untenBoden: ["kristall", "schilf", "wurzel"], untenDecke: ["qualle", "hecht", "treibholz"] },
    // Schilfgürtel mit Bootshaus
    { obenBoden: ["kiste", "stein", "stamm"], obenDecke: ["netz", "weide", "weide"], untenBoden: ["seerose", "schilf", "seerose"], untenDecke: ["hecht", "qualle", "hecht"] },
    // Felsufer mit Wasserfall
    { obenBoden: ["stein", "stein", "stamm"], obenDecke: ["dach", "foehre", "foehre"], untenBoden: ["zapfen", "wurzel", "zapfen"], untenDecke: ["treibholz", "qualle", "hecht"] },
    // Gletschersee
    { obenBoden: ["eisblock", "eisblock", "stein"], obenDecke: ["eiszapfen", "eiszapfen", "dach"], untenBoden: ["scholle", "kristall", "scholle"], untenDecke: ["qualle", "qualle", "hecht"] },
  ];
  const wahl = (liste, z) => liste[Math.min(liste.length - 1, Math.floor(z * liste.length))];
  const bodenArt = (welt, z, land = 0) => wahl(ARTEN[land][welt === "oben" ? "obenBoden" : "untenBoden"], z);
  const deckeArt = (welt, z, land = 0) => wahl(ARTEN[land][welt === "oben" ? "obenDecke" : "untenDecke"], z);
  const anders = (welt) => (welt === "oben" ? "unten" : "oben");

  // ---------------------------------------------------------------------------
  // Der Boden: Etagen und Gabelungen
  // ---------------------------------------------------------------------------
  /*
   * Spur 0 ist der Weg am Ufer. Eine Etage hebt ihn eine Weile ETAGE höher
   * (ein Steg auf Pfählen, ein Felsband): eine Rampe hinauf, die sie von
   * selbst läuft, oben flach, eine Rampe hinab. Eine Gabelung legt hinter
   * den Weg einen zweiten, Spur 1, eine Etage höher: Hinauf kommt nur, wer
   * im Fenster vor seiner Kante abspringt (gabelFenster); am Ende führt eine
   * Rampe hinab, und beide Wege sind wieder einer.
   */
  // Was davon x enthält (die Listen sind nach dem Ort geordnet und
  // überlappen sich nicht).
  function suche(liste, x, von, bis) {
    for (let i = liste.length - 1; i >= 0; i -= 1) {
      const e = liste[i];
      if (von(e) > x) continue;
      return bis(e) >= x ? e : null;
    }
    return null;
  }
  const etageBei = (x) => suche(state.etagen, x, (e) => e.a, (e) => e.b);
  const gabelBei = (x) => suche(state.gabeln, x, (gb) => gb.xS, (gb) => gb.xEnde);

  // Wie hoch der Boden der Spur bei x über dem Weg am Ufer liegt.
  function bodenBei(spur, x) {
    if (spur === 1) {
      const gb = gabelBei(x);
      if (!gb) return 0;
      if (gb.xM === null || x <= gb.xM) return ETAGE;
      return ETAGE * clamp(1 - (x - gb.xM) / RAMPE, 0, 1);
    }
    const et = etageBei(x);
    if (!et) return 0;
    return ETAGE * clamp(Math.min(x - et.a, et.b - x) / RAMPE, 0, 1);
  }

  // Die Gabelung, in deren Fenster ein Absprung zur Zeit t hinaufführt.
  function gabelFenster(t) {
    for (let i = state.gabeln.length - 1; i >= 0; i -= 1) {
      const f = state.gabeln[i].fenster;
      if (t >= f.lo && t <= f.hi) return state.gabeln[i];
    }
    return null;
  }

  // ---------------------------------------------------------------------------
  // Laufen, springen, landen – im Spiel und in der Planung gleich gerechnet
  // ---------------------------------------------------------------------------
  function laeuferNeu() {
    return { x: 0, A: 0, y: 0, spur: 0, gabel: null, sprung: null, g0: 0, ziel: 0, landung: -9, absprung: -9 };
  }

  // Auf welcher Spur sie gerade zählt: im Flug hinauf schon auf dem Steg
  // (sie springt nach hinten, hinüber auf den oberen Weg).
  const spurJetzt = (L) => (L.sprung !== null ? L.ziel : L.spur);

  // Sie springt zur Zeit t ab, vom Boden ihrer Spur. Im Fenster einer
  // Gabelung landet sie oben auf dem Steg (ziel 1).
  function abheben(L, t) {
    L.sprung = t;
    L.absprung = t;
    L.g0 = bodenBei(L.spur, xBei(t));
    L.ziel = L.spur;
    if (L.spur === 0) {
      const gb = gabelFenster(t);
      if (gb) { L.ziel = 1; L.gabel = gb; }
    }
  }

  // Bringt sie von tVor zur Zeit t: Ort, Höhe, Landung (dann die Zeit der
  // Landung zurück, sonst null). Am Ende des oberen Wegs ist sie wieder am
  // Ufer (Spur 0).
  function bewege(L, t, tVor) {
    let landung = null;
    if (L.sprung !== null && t - L.sprung > SPRUNG * 0.5) {
      const x = xBei(t);
      const spur = L.ziel === 1 && L.gabel && x >= L.gabel.xE ? 1 : L.spur;
      const G = bodenBei(spur, x);
      if (L.g0 + bogenFrei(t - L.sprung) <= G + 1e-9) {
        // Auf ebenem Boden auf die Tausendstel genau, auf einer Rampe auf
        // den Schritt.
        const tl = L.sprung + tauRunter(G - L.g0);
        landung = tl > tVor && tl <= t ? tl : t;
        L.sprung = null;
        L.spur = spur;
        L.landung = landung;
      }
    }
    L.x = xBei(t);
    if (L.spur === 1 && (!L.gabel || L.x >= L.gabel.xEnde)) L.spur = 0;
    const G = bodenBei(L.spur, L.x);
    L.A = L.sprung === null ? G : L.g0 + bogenFrei(t - L.sprung);
    L.y = L.A - G;
    return landung;
  }

  // Hält der Weg? Sie springt zu den Zeiten zeiten und läuft von von bis bis
  // – wie im Spiel gerechnet. start: { spur, gabel } am Anfang; nie: diese
  // Spur darf sie nie betreten; ende: auf dieser Spur muss sie ankommen.
  function folgeHaelt(zeiten, von, bis, start = {}) {
    const L = laeuferNeu();
    L.spur = start.spur || 0;
    L.gabel = start.gabel || null;
    bewege(L, von, von);
    let j = 0;
    let t = von;
    while (t < bis - 1e-9) {
      let t2 = Math.min(bis, t + 1 / 400);
      const springt = j < zeiten.length && zeiten[j] <= t2;
      if (springt) t2 = Math.max(t, zeiten[j]);
      if (t2 > t) {
        const tl = bewege(L, t2, t);
        if (tl !== null) {
          const xl = xBei(tl);
          if (trifft(xl, bodenBei(L.spur, xl), false, L.spur, tl)) return false;
        }
        if (trifft(L.x, L.A, L.sprung !== null, spurJetzt(L), t2)) return false;
        if (start.nie !== undefined && L.spur === start.nie) return false;
      }
      t = t2;
      if (springt) {
        if (L.sprung !== null || t - L.landung < 0.004) return false;
        abheben(L, t);
        j += 1;
      }
    }
    return start.ende === undefined || L.spur === start.ende;
  }

  // Hält die Folge für jede Ecke der Luft (jeder Sprung so früh oder so
  // spät, wie er darf) und genau nach dem Weg?
  function sicher(folge, von, bis, start = {}) {
    const n = folge.length;
    const faelle = [folge.map((s) => s.t)];
    for (let m = 0; m < (1 << n); m += 1) faelle.push(folge.map((s, i) => s.t + (((m >> i) & 1) ? 0.97 : -0.97) * s.e));
    return faelle.every((zeiten) => folgeHaelt(zeiten, von, bis, start));
  }

  // ---------------------------------------------------------------------------
  // Die Strecke: der Weg, Abschnitt um Abschnitt
  // ---------------------------------------------------------------------------
  /*
   * Ein Abschnitt ist eine Lage: ein bis vier Sprünge, um die herum die
   * Hindernisse beider Welten stehen. Zuerst der Weg (wann sie abspringt,
   * zeiten), dann die Hindernisse so, dass jeder Sprung bis zu e zu früh oder
   * zu spät noch gelingt (dazu ein wenig mehr, s). Die Lagen:
   *
   *   einzeln     ein Hindernis zum Überspringen, oben oder unten
   *   beide       oben und unten zugleich eines
   *   doppel      zwei kurz hintereinander, meist in verschiedenen Welten
   *   dreifach    drei
   *   zangeVor    erst etwas über dem Kopf, gleich dahinter eines zum
   *               Überspringen – springen erst, wenn der Kopf frei ist
   *   zangeNach   erst eines zum Überspringen, gleich hinter der Landung
   *               etwas über dem Kopf: Wer zu spät springt, landet darunter
   *   klammer     beides: davor und dahinter etwas über dem Kopf
   *   hecht       ein Hecht springt durch die Wasserlinie und fliegt unter
   *               ihr hindurch, oben wie unten
   *
   * Bei den Zangen und der Klammer stehen die Teile meist in verschiedenen
   * Welten: Oben hängt ein Ast, unten ragt Schilf – das Fenster bilden
   * beide zusammen. Was über dem Kopf hängt, kann ihr auch entgegenziehen
   * (Vögel oben, ein Fischschwarm unten); was oben auf dem Weg steht, kann
   * ein Steinbock sein, der kurz vorher vom Fels herabspringt.
   *
   * Der Lehrpfad (die ersten rund 400 m): Die ersten Abschnitte spiegelt der
   * See treu (ein Stein, ein Stamm, ein Ast mit einem Stein); mit dem ersten
   * ab ERWACHEN_AB erwacht er (nach einer ruhigen Strecke), zuerst ein
   * Kristall unten allein, dann ein Stein oben mit einer Qualle unten. Dann
   * je eine Station (LEHRPFAD): bei 140 m der erste Steg eine Etage höher,
   * bei 195 m der springende Hecht, bei 245 m die erste Gabelung (eine
   * Sackgasse, oben falsch), bei 315 m Nebel – bei 400 m beginnt die zweite
   * Landschaft. Danach der feste Rhythmus (RHYTHMUS, ZWISCHEN).
   *
   * Immer gleich viele Zahlen ziehen, was auch geschieht: Die Strecke soll an
   * der Saat hängen, nicht an den Zweigen dieser Funktion.
   */
  const LEHRPFAD = [
    { ab: 1400, art: "etage" },
    { ab: 1950, art: "hecht" },
    { ab: 2450, art: "gabel" },
    { ab: 3150, art: "nebel" },
  ];
  // Nach dem Lehrpfad ein fester Rhythmus, alles angesagt: jeder vierte
  // Abschnitt ist besonders, in dieser Folge. Ein Spiegeltor (kurz nachdem
  // der Schilfgürtel beginnt), eine Abkürzung in der gekippten Welt, das
  // Tor zurück (so ist die Welt gut 250 m gekippt, und das Felsufer öffnet
  // sich aufrecht), eine Sackgasse, eine Etage, der Holzsteg, Nebel, eine
  // Etage – und von vorn. Die Sackgassen wechseln ab: Mal bricht oben der
  // Steg, mal versperrt unten ein Felssturz das Ufer.
  const RHYTHMUS = ["tor", "abkuerzung", "tor", "gabel", "etage", "steg", "nebel", "etage"];
  const BESONDERS = new Set(["nebel", "steg", "gabel", "abkuerzung", "tor"]);

  // Die Landschaft bei x: 0 das Lärchenufer, dann alle LAND_LANG die
  // nächste (landNr zählt weiter, landArt geht im Kreis).
  const landNr = (x) => (x < LAND_AB ? 0 : 1 + Math.floor((x - LAND_AB) / LAND_LANG));
  const landArt = (nr) => nr % ARTEN.length;
  const landAnfang = (nr) => (nr === 0 ? 0 : LAND_AB + (nr - 1) * LAND_LANG);

  function abschnittArt(n, x, nachWecken) {
    if (nachWecken < 2) return "";
    if (state.lehr < LEHRPFAD.length) {
      const s = LEHRPFAD[state.lehr];
      if (x < s.ab) return "";
      state.lehr += 1;
      if (state.lehr === LEHRPFAD.length) state.taktAb = n;
      return s.art;
    }
    const k = n - state.taktAb;
    if (k > 0 && k % 4 === 0) return RHYTHMUS[(k / 4 - 1) % RHYTHMUS.length];
    return "";
  }

  // Eine gewöhnliche Lage nach Gewicht (z: eine Zahl).
  function lageWaehlen(z, k0, n) {
    const gewichte = [
      ["einzeln", 1],
      ["beide", lerp(0.5, 0.25, k0)],
      ["doppel", lerp(0.5, 1.05, k0)],
      ["zangeVor", lerp(0.6, 1.05, k0)],
      ["zangeNach", lerp(0.45, 0.95, k0)],
      ["dreifach", n >= 9 ? lerp(0.1, 0.7, k0) : 0],
      ["klammer", n >= 11 ? lerp(0.05, 0.65, k0) : 0],
    ];
    let summe = 0;
    gewichte.forEach(([, w]) => { summe += w; });
    let r = z * summe;
    for (const [name, w] of gewichte) {
      r -= w;
      if (r < 0) return name;
    }
    return "einzeln";
  }

  // Baut eine Lage. p: { n, z, zz, k, e, ab (wann sie frühestens beginnt),
  // frueh (der früheste erste Sprung), vorlauf, w1, w2, a1, treu, land,
  // bewegt (was sich bewegen darf: { voegel, fische, steinbock }),
  // ersterAst, besonders }.
  function baueLage(lage, p) {
    const { z, zz, k, e, land, ab } = p;
    const { w1, w2, a1 } = p;
    const hind = [];
    const zeiten = [];
    let freiAb = 0;
    const s = (zi) => e * lerp(0.22, 0.03, k) * zi;
    const gZeit = (zi) => lerp(0.17, 0.06, k) + 0.08 * zi * (1 - k);
    // Wo ein anderes Teil das Fenster begrenzt, darf das Hindernis auf
    // dieser Seite mehr erlauben.
    const mehr = (zi) => e * (0.3 + lerp(0.7, 0.3, k) * zi);
    const ueber = (lo, hi, welt, za, zh, zp, zq, art = bodenArt(welt, za, land)) => bodenBauen(lo, hi, welt, art, zh, zp, zq, k);
    const spanne = (art, zi) => lerp(DECKEN[art][0], DECKEN[art][1], zi);
    // Was über dem Kopf hängt, kann ihr entgegenziehen: oben Vögel, unten
    // ein Fischschwarm – zur Zeit tRef steht es genau dort, wo das stille
    // stünde (die Kante, die das Fenster begrenzt, bei kante).
    const zieht = (welt, zi) => (welt === "oben" ? p.bewegt?.voegel : p.bewegt?.fische) && zi < 0.5;
    const deckeHier = (welt, art, zi, a, b, tRef, kante, zd) => {
      if (zieht(welt, zi)) {
        const neu = welt === "oben" ? "voegel" : "fische";
        const lang = spanne(neu, zd);
        const o = deckeBauen(kante === "b" ? b - lang : a, kante === "b" ? b : a + lang, welt, neu, zd);
        o.bewegt = true;
        o.tRef = tRef;
        o.u = lerp(45, 85, zi * 2);
        return o;
      }
      return deckeBauen(a, b, welt, art, zd);
    };
    let t1 = p.frueh;

    if (lage === "einzeln") {
      zeiten.push(t1);
      const bock = w1 === "oben" && p.bewegt?.steinbock && zz[2] < 0.55;
      const o = ueber(t1 - e - s(z[2]), t1 + e + s(z[3]), w1, a1, z[4], z[5], z[6], bock ? "steinbock" : undefined);
      // Der Steinbock steht vorher oben am Fels und springt gut eine
      // Sekunde, bevor sie dort ist, auf den Weg.
      if (bock) o.ab = tBei(o.a) - 1.25;
      hind.push(o);
    } else if (lage === "beide") {
      zeiten.push(t1);
      hind.push(ueber(t1 - e - s(z[2]), t1 + e + s(z[3]), "oben", z[7], z[4], z[5], z[6]));
      hind.push(ueber(t1 - e - s(z[3]), t1 + e + s(z[2]), "unten", z[8], z[6], z[4], z[5]));
    } else if (lage === "doppel" || lage === "dreifach") {
      const zahl = lage === "doppel" ? 2 : 3;
      let t = t1;
      let welt = w1;
      for (let i = 0; i < zahl; i += 1) {
        if (i > 0) {
          t += SPRUNG + 2 * e + gZeit(z[8 + i]);
          if (!p.treu && z[(10 + i) % 16] < 0.72) welt = anders(welt);
        }
        zeiten.push(t);
        hind.push(ueber(t - e - s(z[(2 + i) % 16]), t + e + s(z[(3 + i) % 16]), welt, z[(7 + i * 2) % 16], z[(4 + i) % 16], z[(5 + i) % 16], z[(6 + i) % 16]));
      }
    } else if (lage === "zangeVor" || lage === "klammer") {
      // Das obere Teil endet so, dass der früheste Sprung, der unter ihm
      // nicht anstösst, genau am Anfang des Fensters liegt.
      const art = p.ersterAst ? "ast" : deckeArt(w2, z[9], land);
      const span = spanne(art, z[10]);
      const sA = s(z[2]);
      const zeitDecke = (span + 2 * LH + 8) / tempoBei(ab + 0.5);
      t1 = Math.max(ab + 0.5 * p.vorlauf + zeitDecke + TAU_DECKE + e + sA, p.frueh);
      const tRef = t1 - e - sA + TAU_DECKE;
      const b = xBei(tRef) - LH;
      hind.push(deckeHier(w2, art, p.ersterAst ? 1 : zz[4], b - span, b, tRef, "b", z[11]));
      zeiten.push(t1);
      const sB = s(z[3]);
      if (lage === "zangeVor") {
        hind.push(ueber(t1 - e - sA - mehr(z[12]), t1 + e + sB, w1, a1, z[4], z[5], z[6]));
      } else {
        // Die Klammer: auch hinten begrenzt ein Teil über dem Kopf, in der
        // anderen Welt als das vordere.
        hind.push(ueber(t1 - e - sA - mehr(z[12]), t1 + e + sB + mehr(z[8]), w1, a1, z[4], z[5], z[6]));
        const w3 = anders(w2);
        const art2 = deckeArt(w3, z[7], land);
        const span2 = spanne(art2, z[1]);
        const tRef2 = t1 + e + sB + SPRUNG - TAU_DECKE;
        const a = xBei(tRef2) + LH;
        hind.push(deckeHier(w3, art2, zz[5], a, a + span2, tRef2, "a", z[8]));
        freiAb = tBei(a + span2 + LH) - TAU_DECKE + 0.02;
      }
    } else if (lage === "zangeNach") {
      // Erst das Hindernis, gleich hinter der Landung das Teil über dem
      // Kopf: Begrenzt wird hinten nur von ihm.
      const art = deckeArt(w2, z[9], land);
      const span = spanne(art, z[10]);
      const sB = s(z[3]);
      zeiten.push(t1);
      hind.push(ueber(t1 - e - s(z[2]), t1 + e + sB + mehr(z[12]), w1, a1, z[4], z[5], z[6]));
      const tRef = t1 + e + sB + SPRUNG - TAU_DECKE;
      const a = xBei(tRef) + LH;
      hind.push(deckeHier(w2, art, zz[4], a, a + span, tRef, "a", z[11]));
      freiAb = tBei(a + span + LH) - TAU_DECKE + 0.02;
    } else if (lage === "hecht") {
      // Ein Hecht schiesst aus dem Wasser, ihr entgegen, und fliegt in dem
      // Moment unter ihr hindurch, in dem sie am höchsten ist. Vorher
      // verrät ihn eine Bugwelle auf der Wasserlinie.
      zeiten.push(t1);
      const tm = t1 + SPRUNG / 2;
      const o = {
        kind: "springer", art: "hecht", welt: "beide", bewegt: true, g: p.g || 0, spur: 0,
        xm: xBei(tm), tm, u: lerp(50, 80, z[5]), hp: lerp(9, 12, z[6] * (1 - k * 0.4)), L: lerp(24, 30, z[7]), th: 2.6, saat: z[8],
      };
      o.kk = (o.hp + UFER + o.g + o.th) / 0.2025;
      hind.push(o);
    } else if (lage === "nebel") {
      // Nur oben, und der See zeigt alles treu. Zwischen den Sprüngen
      // hängt manchmal ein Ast, der den nächsten Sprung vorn begrenzt.
      const zahl = state.nebelZahl === 0 ? 3 : 4;
      let t = t1;
      for (let i = 0; i < zahl; i += 1) {
        let mitAst = false;
        if (i > 0) {
          mitAst = z[(4 + i) % 16] < 0.55;
          t += SPRUNG + 2 * e + (mitAst ? lerp(0.34, 0.26, k) : gZeit(z[8 + i]));
        }
        zeiten.push(t);
        const sA = s(z[(2 + i) % 16]);
        if (mitAst) {
          const b = xBei(t - e - sA + TAU_DECKE) - LH;
          const a = Math.max(xBei(zeiten[i - 1] + e + SPRUNG - TAU_DECKE) + LH, b - 34);
          hind.push(deckeBauen(a, b, "oben", deckeArt("oben", z[(9 + i) % 16] * 0.6, land), z[(9 + i) % 16]));
        }
        hind.push(ueber(t - e - sA - (mitAst ? mehr(z[(6 + i) % 16]) : 0), t + e + s(z[(3 + i) % 16]), "oben", z[(7 + i * 2) % 16], z[(4 + i) % 16], z[(5 + i) % 16], z[(6 + i) % 16]));
      }
    } else if (lage === "steg") {
      // Lücken im Steg: zwei, ab dem zweiten Steg drei – und dann unten
      // zwischen ihnen ein Hecht, der den nächsten Sprung vorn begrenzt.
      const zahl = state.stegZahl === 0 ? 2 : 3;
      const mitHecht = state.stegZahl > 0;
      let t = t1 + 0.25;
      for (let i = 0; i < zahl; i += 1) {
        if (i > 0) t += SPRUNG + 2 * e + (mitHecht ? lerp(0.3, 0.22, k) : lerp(0.16, 0.08, k) + 0.06 * z[8 + i]);
        zeiten.push(t);
        const sA = s(z[(2 + i) % 16]);
        let vorn = 0;
        if (mitHecht && i > 0) {
          const b = xBei(t - e - sA + TAU_DECKE) - LH;
          const a = Math.max(xBei(zeiten[i - 1] + e + SPRUNG - TAU_DECKE) + LH, b - 46);
          if (b - a >= 16) {
            hind.push(deckeBauen(a, b, "unten", "hecht", z[(9 + i) % 16]));
            vorn = mehr(z[(6 + i) % 16]) * 0.6;
          }
        }
        hind.push(lueckeBauen(t - e - sA - vorn, t + e + s(z[(3 + i) % 16])));
      }
      freiAb = zeiten[zeiten.length - 1] + e + SPRUNG + 0.3;
    }
    return { zeiten, hind, e, freiAb };
  }

  // Wann eine Lage frei ist: der späteste Sprung gelandet, was über dem
  // Kopf hängt, vorbei.
  const lageEnde = (v) => Math.max(v.zeiten[v.zeiten.length - 1] + v.e + SPRUNG + 0.04, v.freiAb);

  function naechsterAbschnitt() {
    const liste = state.abschnitte;
    const n = liste.length;
    const z = [];
    for (let i = 0; i < 16; i += 1) z.push(zufall.zahl());
    const zz = [];
    for (let i = 0; i < 8; i += 1) zz.push(zufall.zahl());
    const letzt = state.weg[state.weg.length - 1] || null;
    const start = state.freiAb;
    const xStart = xBei(start);
    const land = landArt(landNr(xStart + 120));
    // Erwacht der See mit diesem Abschnitt? Dann zuerst eine ruhige Strecke.
    const wecken = state.erwacheT === null && state.freiAb >= ERWACHEN_AB - 0.4;
    let ruhe = 0;
    if (wecken) {
      state.erwacheT = Math.round((state.freiAb + 0.45) * 1000) / 1000;
      ruhe = 1.6;
    }
    const treu = state.erwacheT === null;
    const nachWecken = treu || wecken ? 0 : state.nachWecken + 1;
    const art = treu || wecken ? "" : abschnittArt(n, xStart, nachWecken);
    const besonders = BESONDERS.has(art) ? art : "";
    const imTakt = state.taktAb !== null;
    const tSchaetz = state.freiAb + 0.5 + ruhe;
    const k0 = schwere(tSchaetz);
    const e0 = luftBei(tSchaetz) * (besonders ? 1.12 : 1);
    if (!treu) state.nachWecken = nachWecken;

    // Nach einer Gabelung beginnt alles neu am Ufer (sauberAb): Welcher Weg
    // es auch war, sie ist dann am Boden.
    const sauber = state.sauberAb;
    state.sauberAb = null;
    const vorher = letzt && sauber === null ? [{ t: letzt.t, e: letzt.e }] : [];
    const vonVorher = vorher.length ? letzt.t - letzt.e - 0.005 : null;

    if (art === "gabel" || art === "abkuerzung") {
      const falsch = art === "abkuerzung" ? -1 : state.sackZahl % 2 === 0 ? 1 : 0;
      if (baueGabel({ n, art: art === "gabel" ? "sackgasse" : "abkuerzung", falsch, z, zz, k0, e0, land, vorher, vonVorher, sauber, start, xStart })) return;
    }
    if (art === "tor") {
      const tg = start + 0.95;
      const nummer = state.tore.length;
      state.tore.push({ x: xBei(tg), t: tg, nr: n, nummer });
      state.freiAb = tg + DREH + 1.05;
      if (sauber !== null) state.sauberAb = state.freiAb;
      liste.push({ nr: n, lage: "tor", art, besonders, treu, wecken, start, ende: state.freiAb, t0: tg, t1: tg, e: e0, x0: xStart, land, nummer });
      return;
    }

    let lage;
    // Die Welten der Teile: w1 das erste Hindernis, w2 das andere.
    let w1 = z[13] < 0.52 ? "unten" : "oben";
    let w2 = z[14] < 0.72 ? anders(w1) : w1;
    let a1 = z[15];
    if (art === "nebel" || art === "steg" || art === "hecht") lage = art;
    else if (n === 0) { lage = "einzeln"; w1 = "oben"; a1 = 0.1; }
    else if (n === 1) { lage = "einzeln"; w1 = "oben"; a1 = 0.95; }
    else if (n === 2) { lage = "zangeVor"; w1 = "oben"; w2 = "oben"; a1 = 0.1; }
    else if (wecken) { lage = "einzeln"; w1 = "unten"; a1 = 0.1; }
    else if (nachWecken === 1) { lage = "zangeNach"; w1 = "oben"; w2 = "unten"; a1 = 0.1; }
    else if (art === "etage" && state.lehr <= 1) { lage = "einzeln"; w1 = "unten"; }
    else if (treu) lage = z[0] < 0.55 ? "einzeln" : "doppel";
    else {
      lage = lageWaehlen(z[0], k0, n);
      // Ab und zu springt ein Hecht statt eines einzelnen Hindernisses.
      if (lage === "einzeln" && imTakt && zz[3] < 0.2) lage = "hecht";
    }
    if (treu) { w1 = "oben"; w2 = "oben"; }

    // Eine Etage: erst die Rampe hinauf (sie läuft sie von selbst), gebaut
    // wird oben auf dem Steg.
    const et = art === "etage" ? { a: xStart, b: Infinity, nr: n, land, erste: state.etagen.length === 0 } : null;
    const ab = et ? tBei(xStart + RAMPE) + 0.04 : start;
    const vorlauf = et ? 0.12 + 0.2 * z[1] : ruhe + (n === 0 ? 0 : n <= 3 ? 0.62 + 0.36 * z[1] : lerp(0.55, 0.12, k0) + z[1] * lerp(0.45, 0.18, k0));
    const bewegt = imTakt ? { voegel: true, fische: true, steinbock: land === 0 || land === 2 } : null;
    const g = et ? ETAGE : 0;

    // Ein Versuch, die Lage zu bauen; weicht ihr Weg nachgeprüft ab (sicher),
    // der nächste mit kleineren Hindernissen, zuletzt ein einfacher Stein.
    let fertig = null;
    for (const [lageJetzt, mass] of [[lage, 1], [lage, 1.12], ["einzeln", 1.2], ["einzeln", 1.35]]) {
      const e = e0 * mass;
      const v = baueLage(lageJetzt, {
        n, z, zz, k: k0 / mass, e, ab, frueh: n === 0 ? 1.9 : ab + vorlauf + e, vorlauf, w1, w2, a1, treu, land, bewegt, g,
        ersterAst: n === 2,
      });
      v.hind.forEach((o) => {
        o.nr = n;
        o.g = g;
        o.spur = 0;
        o.land = land;
        if (treu || lageJetzt === "nebel" || lageJetzt === "steg") o.spiegel = true;
        if (lageJetzt === "nebel") o.nebel = true;
        einreihen(o);
      });
      let bis = v.zeiten[v.zeiten.length - 1] + v.e + SPRUNG + 0.45;
      if (et) {
        et.b = xBei(lageEnde(v) + 0.1) + RAMPE;
        state.etagen.push(et);
        bis = Math.max(bis, tBei(et.b) + 0.1);
      }
      const folge = [...vorher, ...v.zeiten.map((t) => ({ t, e: v.e }))];
      // Ab dem frühesten Absprung des letzten Sprungs davor (bis dahin ist
      // der Abschnitt davor schon geprüft), sonst kurz vor dem ersten.
      const von = vonVorher ?? Math.max(v.zeiten[0] - 0.45, sauber ?? -Infinity);
      if (sicher(folge, von, bis)) { fertig = { ...v, lage: lageJetzt }; break; }
      abschnittWeg(n);
    }
    if (!fertig) {
      // Darf nicht vorkommen (die Prüfung zählt mit) – dann eben dieser.
      state.planFehler += 1;
      state.planLog.push(`${n}:${art || lage}@${Math.round(xStart / METER)}m`);
      const v = baueLage("einzeln", { n, z, zz, k: 0, e: e0 * 1.4, ab, frueh: ab + vorlauf + e0 * 1.4, vorlauf, w1: "oben", w2, a1, treu, land, bewegt: null, g });
      v.hind.forEach((o) => { o.nr = n; o.g = g; o.spur = 0; o.land = land; if (treu) o.spiegel = true; einreihen(o); });
      if (et) { et.b = xBei(lageEnde(v) + 0.1) + RAMPE; state.etagen.push(et); }
      fertig = { ...v, lage: "einzeln" };
    }
    if (fertig.lage === "nebel") state.nebelZahl += 1;
    if (fertig.lage === "steg") state.stegZahl += 1;
    fertig.zeiten.forEach((t) => state.weg.push({ t, e: fertig.e, nr: n, spur: 0 }));
    const tLetzt = fertig.zeiten[fertig.zeiten.length - 1];
    state.freiAb = lageEnde(fertig);
    if (et) state.freiAb = Math.max(state.freiAb, tBei(et.b) + 0.03);
    const eigene = state.hindernisse.filter((o) => o.nr === n);
    if (eigene.length) {
      const xa = Math.min(...eigene.map((o) => o.a));
      const xb = Math.max(...eigene.map((o) => o.b));
      if (fertig.lage === "nebel") state.nebel.push({ a: xa - 70, b: xb + 60, nr: n });
      if (fertig.lage === "steg") state.stege.push({ a: xa - 46, b: xb + 40, nr: n });
    }
    liste.push({
      nr: n, lage: fertig.lage, art, besonders, treu, wecken, start, ende: state.freiAb, t0: fertig.zeiten[0], t1: tLetzt, e: fertig.e, x0: xStart, land,
      etage: et ? state.etagen[state.etagen.length - 1] : null, zeiten: fertig.zeiten.slice(),
    });
  }

  /*
   * Eine Gabelung. Am oberen Weg (Spur 1: ein Steg oder Felsband hinter dem
   * Ufer, eine Etage höher) führt nur ein Sprung im Fenster hinauf; wer
   * nicht springt, bleibt am Ufer (Spur 0). Beide Wege laufen eine Weile
   * nebeneinander, jeder mit eigenen Hindernissen in beiden Welten, und
   * kommen über eine Rampe wieder zusammen.
   *
   *   sackgasse   Ein Weg führt sicher ins Ende: Oben bricht der Steg ein
   *               (falsch 1: eine Lücke, länger als jeder Sprung), oder ein
   *               Felssturz, den oben Büsche verdecken, versperrt das Ufer
   *               (falsch 0: höher als jeder Sprung). Oben sieht alles heil
   *               aus; der See zeigt die Wahrheit – vom Anfang der Gabelung
   *               an, lange vor dem Fenster.
   *   abkuerzung  Beide sind offen. Oben ist es deutlich schwerer (dichtere
   *               Lagen), dafür schenkt der Steg BONUS Meter.
   *
   * Weg zuerst für beide: Jeder offene Weg wird mit allen Ecken der Luft
   * nachgeprüft; der untere darf nie auf den Steg führen (nie: 1).
   */
  function baueGabel(q) {
    const { n, art, falsch, z, zz, k0, e0, land, vorher, vonVorher, sauber, start, xStart } = q;
    const erste = state.gabelZahl === 0;
    const t2 = tauRunter(ETAGE);
    // Zahlen für die Lagen der beiden Wege, aus denen des Abschnitts.
    const zahlen = (spur, i) => z.map((v, j) => hash01(v * 13.1 + i * 7.7 + spur * 3.3 + j * 0.71));
    let versuch = 0;
    for (const mass of [1, 1.15, 1.35]) {
      const ew = Math.max(0.09, e0 * (erste ? 1.5 : 1.15)) * Math.min(mass, 1.2);
      const tw = start + (erste ? 1.0 : 0.8) + ew;
      const xE = xBei(tw - ew + t2) - RAND;
      const gb = {
        nr: n, art, falsch, land, xS: xE - 66, xE, xM: null, xEnde: Infinity, xT: null,
        fenster: { lo: tw - ew, hi: tw + ew, t: tw, e: ew }, wege: [[], []], bonus: art === "abkuerzung" ? BONUS : 0, tEnde: 0,
      };
      state.gabeln.push(gb);
      const von = vonVorher ?? Math.max(tw - ew - 0.45, sauber ?? -Infinity);
      const alt = vorher.map((s) => ({ ...s }));
      const hinauf = { t: tw, e: ew, spur: 0, hinauf: true };
      // Lage um Lage auf einer Spur, jede nachgeprüft wie ein gewöhnlicher
      // Abschnitt: mit allen Ecken der Luft, über den letzten Sprung davor
      // hinweg; hält eine nicht, eine leichtere, zuletzt ein einzelnes
      // Hindernis. pruef: { vorher, von, start } – womit die erste beginnt.
      const reihe = (spur, lagen, abT, kk, vorlaufen, pruef) => {
        let frei = abT;
        let vor = pruef.vorher;
        let vonJetzt = pruef.von;
        let startJetzt = pruef.start;
        const spruenge = [];
        for (let i = 0; i < lagen.length; i += 1) {
          let fertig = null;
          for (const [lage, m] of [[lagen[i], 1], [lagen[i], 1.12], ["einzeln", 1.25]]) {
            versuch += 1;
            const zl = zahlen(spur, i);
            const e = e0 * mass * m;
            const w1 = zl[13] < 0.52 ? "unten" : "oben";
            const v = baueLage(lage, {
              n, z: zl, zz: zl.slice(8), k: kk / (mass * m), e, ab: frei, frueh: frei + vorlaufen[i] + e, vorlauf: vorlaufen[i],
              w1, w2: zl[14] < 0.72 ? anders(w1) : w1, a1: zl[15], treu: false, land, g: spur ? ETAGE : 0,
              bewegt: state.taktAb !== null ? { voegel: true, fische: true } : null,
            });
            v.hind.forEach((o) => { o.nr = n; o.spur = spur; o.g = spur ? ETAGE : 0; o.land = land; o.versuch = versuch; einreihen(o); });
            const folge = [...vor, ...v.zeiten.map((t) => ({ t, e: v.e }))];
            if (sicher(folge, vonJetzt, lageEnde(v) + 0.45, { ...startJetzt, nie: spur ? undefined : 1 })) { fertig = v; break; }
            state.hindernisse = state.hindernisse.filter((o) => o.versuch !== versuch);
            state.bewegte = state.bewegte.filter((o) => o.versuch !== versuch);
            state.bewegtAlle = state.bewegtAlle.filter((o) => o.versuch !== versuch);
          }
          if (!fertig) return null;
          fertig.zeiten.forEach((t) => spruenge.push({ t, e: fertig.e, spur }));
          frei = lageEnde(fertig);
          const letzt = fertig.zeiten[fertig.zeiten.length - 1];
          vor = [{ t: letzt, e: fertig.e }];
          vonJetzt = letzt - fertig.e - 0.005;
          startJetzt = { spur, gabel: gb };
        }
        return { spruenge, frei, vor, von: vonJetzt };
      };
      const lagenWahl = (zi, kk, ohne) => {
        let lage = lageWaehlen(zi, kk, 20);
        if (ohne && lage === "einzeln") lage = "doppel";
        return mass > 1.2 ? "einzeln" : lage;
      };
      let oben = { spruenge: [], frei: tw + ew + t2 + 0.05, vor: [hinauf], von: tw - ew - 0.005 };
      let unten = { spruenge: [], frei: tw + ew + 0.03, vor: alt, von };
      let gut = true;
      if (falsch !== 1) {
        // Hinauf: Jeder Sprung im Fenster landet oben.
        gut = sicher([...alt, hinauf], von, tw + ew + t2 + 0.06, { spur: 0, ende: 1 });
        // Der obere Weg hält: bei der Abkürzung zwei dichte Lagen.
        const kk = art === "abkuerzung" ? Math.min(1, k0 + 0.3) : k0;
        const lagen = art === "abkuerzung" ? [lagenWahl(zz[1], kk, true), lagenWahl(zz[2], kk, true)] : [lagenWahl(zz[1], kk, false)];
        const r = gut ? reihe(1, lagen, oben.frei, kk, art === "abkuerzung" ? [0.1, lerp(0.3, 0.12, kk)] : [0.25], { vorher: [hinauf], von: tw - ew - 0.005, start: { spur: 0 } }) : null;
        if (r) oben = r; else gut = false;
      } else {
        // Der Steg bricht ein: eine Lücke, länger als jeder Sprung.
        gb.xT = xE + 52 + 24 * zz[3];
        einreihen({ kind: "luecke", art: "bruch", welt: "oben", a: gb.xT, b: gb.xT + 320, g: ETAGE, spur: 1, nr: n, verdeckt: true, saat: zz[3] });
        gb.xEnde = gb.xT + 330;
      }
      if (gut && falsch !== 0) {
        // Der untere Weg hält: bei der Abkürzung eine leichte Lage.
        const kk = art === "abkuerzung" ? k0 * 0.6 : k0;
        const lagen = art === "abkuerzung" ? [lagenWahl(zz[4], kk * 0.5, false)] : [lagenWahl(zz[4], kk, false), lagenWahl(zz[5], kk, false)];
        const r = reihe(0, lagen, unten.frei, kk, [0.28, lerp(0.5, 0.15, kk)], { vorher: alt, von, start: { spur: 0 } });
        if (r) unten = r; else gut = false;
      } else if (gut) {
        // Ein Felssturz, oben hinter Büschen: höher als jeder Sprung.
        gb.xT = xE + 18 + 30 * zz[3];
        einreihen({ kind: "boden", art: "fels", welt: "oben", a: gb.xT, b: gb.xT + 38, h: 64, p: 0.45, q: 2.6, g: 0, spur: 0, nr: n, verdeckt: true, saat: zz[3] });
      }
      if (gut) {
        // Wo die Wege wieder zusammenkommen: hinter dem Letzten auf beiden
        // (und hinter dem Felssturz).
        if (falsch !== 1) {
          let xM = xBei(oben.frei + 0.1);
          if (falsch !== 0) xM = Math.max(xM, xBei(unten.frei) + 12 - RAMPE);
          else xM = Math.max(xM, gb.xT + 80);
          gb.xM = xM;
          gb.xEnde = xM + RAMPE;
        }
        const tEnde = Math.max(falsch !== 1 ? tBei(gb.xEnde) + 0.05 : 0, falsch !== 0 ? unten.frei + 0.02 : 0);
        gb.tEnde = tEnde;
        gb.wege[0] = unten.spruenge;
        gb.wege[1] = [hinauf, ...oben.spruenge];
        // Zuletzt hinab und zusammen: vom letzten Sprung an bis zum Ende.
        if (falsch !== 1 && !sicher(oben.vor, oben.von, tEnde + 0.2, { spur: oben.spruenge.length ? 1 : 0, gabel: gb, ende: 0 })) gut = false;
        if (gut && falsch !== 0 && !sicher(unten.vor, unten.von, tEnde + 0.2, { spur: 0, nie: 1 })) gut = false;
        if (gut) {
          state.gabelZahl += 1;
          if (art === "sackgasse") state.sackZahl += 1;
          const richtig = falsch === 1 ? 0 : 1;
          gb.richtig = richtig;
          gb.wege[richtig].forEach((s) => state.weg.push({ t: s.t, e: s.e, nr: n, spur: s.spur, gabel: true }));
          state.freiAb = tEnde;
          state.sauberAb = tEnde;
          const zeitenR = gb.wege[richtig].map((s) => s.t);
          state.abschnitte.push({
            nr: n, lage: art, art: art === "abkuerzung" ? "abkuerzung" : "gabel", besonders: art === "abkuerzung" ? "abkuerzung" : "gabel", treu: false, wecken: false,
            start, ende: tEnde, t0: zeitenR[0] ?? tw, t1: zeitenR[zeitenR.length - 1] ?? tw, e: ew, x0: xStart, land, gabel: gb, zeiten: zeitenR,
          });
          return true;
        }
      }
      abschnittWeg(n);
    }
    state.planFehler += 1;
    state.planLog.push(`${n}:${art}/${falsch}@${Math.round(xStart / METER)}m`);
    return false;
  }

  // Die Strecke steht bis zur Zeit t – und immer zwei Abschnitte über den
  // laufenden hinaus (ein besonderer wird einen Abschnitt vorher angesagt).
  // Je Aufruf höchstens «mal» Abschnitte, damit kein Bild lange wartet.
  function planBis(t, mal = 40) {
    for (let i = 0; i < mal; i += 1) {
      const liste = state.abschnitte;
      const letzt = liste[liste.length - 1];
      if (letzt && letzt.ende > t && liste.length > state.abschnitt + 3) return;
      naechsterAbschnitt();
    }
  }

  function streckeNeu() {
    state.weg = [];
    state.hindernisse = [];
    state.bewegte = [];
    state.bewegtAlle = [];
    state.abschnitte = [];
    state.stege = [];
    state.nebel = [];
    state.etagen = [];
    state.gabeln = [];
    state.tore = [];
    state.freiAb = ANFAHRT;
    state.sauberAb = null;
    state.planFehler = 0;
    state.planLog = [];
    state.nebelZahl = 0;
    state.stegZahl = 0;
    state.gabelZahl = 0;
    state.sackZahl = 0;
    state.lehr = 0;
    state.taktAb = null;
    state.langMax = 120;
    state.erwacheT = null;
    state.nachWecken = 0;
    state.abschnitt = -1;
    planBis(10);
  }

  // Der Abschnitt, in dem die Zeit t liegt.
  function abschnittBei(t) {
    const liste = state.abschnitte;
    let lo = 0;
    let hi = liste.length - 1;
    if (hi < 0 || t < liste[0].start) return 0;
    while (lo < hi) {
      const m = (lo + hi + 1) >> 1;
      if (liste[m].start <= t) lo = m; else hi = m - 1;
    }
    return lo;
  }

  // Wie das Bild gekippt ist: nach jedem Spiegeltor, das sie passiert hat,
  // im Wechsel. k läuft an jedem Tor in DREH Sekunden von 0 nach 1, und
  // mass ist die Höhe des Bildes (1 aufrecht, −1 gekippt, dazwischen die
  // Drehung um die waagrechte Achse).
  function kippBei(t) {
    let zahl = 0;
    let k = 1;
    for (const tor of state.tore) {
      if (tor.t > t) break;
      zahl += 1;
      k = clamp((t - tor.t) / DREH, 0, 1);
    }
    const vorher = zahl > 0 && (zahl - 1) % 2 === 1 ? -1 : 1;
    const mass = zahl === 0 ? 1 : vorher * Math.cos(Math.PI * glatt(k));
    return { gekippt: zahl % 2 === 1, k, zahl, mass };
  }

  // Der Weg mit einer Wahl an jeder Gabelung (wahl(gabel) gibt die Spur):
  // für die Prüfung und die Vorführung.
  function wegMit(wahl) {
    const aus = [];
    state.abschnitte.forEach((a) => {
      if (a.gabel) a.gabel.wege[wahl(a.gabel)].forEach((s) => aus.push({ t: s.t, e: s.e, nr: a.nr, spur: s.spur }));
      else (a.zeiten || []).forEach((t) => aus.push({ t, e: a.e, nr: a.nr, spur: 0 }));
    });
    return aus;
  }

  // Die Strecke als Text – für die Prüfung, dass in einem Turnier alle
  // dieselbe bekommen.
  function kursText(bis = 60) {
    while (!state.abschnitte.length || state.abschnitte[state.abschnitte.length - 1].ende < bis) naechsterAbschnitt();
    const xb = xBei(bis);
    const f = (x) => x.toFixed(1);
    const teile = state.hindernisse.filter((o) => o.a < xb).map((o) => `${o.art}${o.welt === "unten" ? "_" : ""}${o.spur ? "^" : ""}${f(o.a)}-${f(o.b)}${o.h ? `/${f(o.h)}` : ""}`);
    const bewegte = state.bewegtAlle.filter((o) => (o.xm ?? o.a) < xb + 400).map((o) => `${o.art}${o.welt === "unten" ? "_" : ""}${f(o.xm ?? o.a)}@${(o.tm ?? o.tRef).toFixed(3)}/${f(o.u)}`);
    const lagen = state.abschnitte.filter((a) => a.start < bis).map((a) => a.lage);
    const etagen = state.etagen.filter((e) => e.a < xb).map((e) => `${f(e.a)}-${f(e.b)}`);
    const gabeln = state.gabeln.filter((g) => g.xS < xb).map((g) => `${g.art}/${g.falsch}@${f(g.xE)}~${g.fenster.lo.toFixed(3)}-${g.fenster.hi.toFixed(3)}>${g.xM === null ? "x" : f(g.xM)}`);
    const tore = state.tore.filter((t) => t.x < xb).map((t) => f(t.x));
    return `${teile.join(",")} | ${bewegte.join(",")} | ${lagen.join(",")} | ${etagen.join(",")} | ${gabeln.join(",")} | ${tore.join(",")} | erwacht ${state.erwacheT}`;
  }

  // ---------------------------------------------------------------------------
  // Die Fläche
  // ---------------------------------------------------------------------------
  function buildPlatz() {
    const platz = shell.el("div", "sg-platz");
    feld = shell.el("div", "sg-feld");
    canvas = document.createElement("canvas");
    canvas.className = "sg-canvas";
    canvas.setAttribute("aria-hidden", "true");
    feld.append(canvas);
    g = canvas.getContext("2d");

    // Der Hinweis vor dem ersten Tipp: zwei Ringe, die aufgehen – tippen.
    const tipp = shell.el("span", "sg-tipp");
    tipp.setAttribute("aria-hidden", "true");
    const ns = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(ns, "svg");
    svg.setAttribute("viewBox", "0 0 64 64");
    ["sg-tipp-ring", "sg-tipp-ring is-spaet"].forEach((klasse) => {
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

  // Was Platz braucht: über dem Wasser alles, was oben hängt, auch über
  // einer Etage (es muss unter die Knöpfe und Bestmarken passen – der
  // Scheitel im höchsten Sprung darf dahinter), unter dem Wasser der ganze
  // Bogen des Spiegelbilds vom Ufer aus (von einer Etage aus darf er unten
  // knapp aus dem Bild tauchen; was dort trifft, hängt höher).
  const OBEN = UFER + ETAGE + DECKE + 8;
  const UNTEN = UFER + HOCH + TOP + 6;

  function messen() {
    if (!canvas || !feld) return;
    const cssW = Math.max(80, feld.clientWidth);
    const cssH = Math.max(80, feld.clientHeight);
    const dpr = shellApi.bildpunkte(cssW, cssH, 2);
    const frei = Math.min(cssH * 0.3, shell?.frei?.(canvas) || 0);
    if (cssW === view.cssW && cssH === view.cssH && dpr === view.dpr && frei === view.frei) return;
    view.cssW = cssW;
    view.cssH = cssH;
    view.dpr = dpr;
    view.frei = frei;
    // Der Massstab: SICHT Einheiten voraus müssen ins Bild (hochkant gibt
    // das die Breite vor), und über und unter dem Wasser je BEDARF und etwas
    // Welt (quer). Ein Stück Ufer ist eine ganze Zahl Bildpunkte breit: So
    // lässt es sich auflegen, ohne gestreckt zu werden.
    const hochkant = cssH > cssW * 1.15;
    const links = Math.max(30, cssW * 0.08);
    const s0 = Math.min((cssW - links - 6) / SICHT, (cssH - frei - 8) / (OBEN + UNTEN + (hochkant ? 90 : 4)));
    view.s = Math.max(1, Math.round(PERIODE * s0 * dpr)) / (PERIODE * dpr);
    const s = view.s;
    // So weit rechts, dass genau SICHT voraus im Bild ist – quer steht sie
    // darum weiter in der Mitte.
    view.rx = Math.round(cssW - 6 - SICHT * s);
    // Die Wasserlinie: in der Mitte der freien Höhe – ein Bergsee ist ein
    // Spiegel, oben und unten gleich viel Welt.
    let wl = frei + (cssH - frei) * 0.5;
    wl = clamp(wl, frei + OBEN * s + 4, cssH - UNTEN * s);
    view.wl = Math.round(wl);
    view.pfad = view.wl - UFER * s;
    // Der Fuss der fernen Berge und wie hoch sie werden.
    view.hz = Math.round(view.pfad - Math.max((view.pfad - frei) * 0.3, (TOP + 10) * s));
    // Hochkant stehen sie unter den Bestmarken, quer reichen sie dahinter.
    view.berg = Math.max(30, (view.hz - frei * (hochkant ? 1 : 0.3)) * 0.86);
    const pw = Math.round(cssW * dpr);
    const ph = Math.round(cssH * dpr);
    if (canvas.width !== pw) canvas.width = pw;
    if (canvas.height !== ph) canvas.height = ph;
    if (tippRinge) {
      tippRinge.style.left = `${Math.round(Math.min(cssW - 40, view.rx + 0.5 * (cssW - view.rx)))}px`;
      tippRinge.style.top = `${Math.round(view.wl + (cssH - view.wl) * 0.42)}px`;
    }
    ebenenNeu();
  }

  const bildX = (x) => view.rx + (x - state.camX) * view.s;
  // Höhe y über dem Weg (oben) und Tiefe y unter dem gespiegelten Weg.
  const obenY = (y) => view.wl - (UFER + y) * view.s;
  const untenY = (y) => view.wl + (UFER + y) * view.s;
  // Für die Hindernisse der Spiegelwelt: von ihrem gespiegelten Boden aus
  // (uGrund: so hoch liegt er oben, so tief unten).
  let uGrund = 0;
  const uY = (y) => untenY(uGrund + y);

  // ---------------------------------------------------------------------------
  // Farben: wie gemalt wird
  // ---------------------------------------------------------------------------
  // "tag": die Welt am Ufer. "spiegel": ihr treues Spiegelbild im
  // Morgenlicht, dunkler und blauer. "nacht": das Ufer, wie es der erwachte
  // See zeigt (im Nebel) – dunkel, mit kalt leuchtender Kante. "glanz": das
  // Spiegelbild der Läuferin im erwachten See.
  let stil = "tag";
  const SPIEGEL_TON = [36, 46, 96];
  function ton(c) {
    if (stil === "spiegel") return mix3(c, SPIEGEL_TON, 0.42);
    if (stil === "nacht") return mix3(c, [34, 66, 124], 0.68);
    if (stil === "glanz") return mix3(c, [74, 80, 186], 0.72);
    return c;
  }
  const F = (c, a = 1) => (a >= 1 ? rgb(ton(c)) : rgba(ton(c), a));
  // Ein Licht: Im erwachten See leuchtet es kalt.
  const L = (c, a = 1) => (stil === "nacht" ? rgba([150, 248, 255], a) : F(c, a));

  // ---------------------------------------------------------------------------
  // Zeichnen: die Berge
  // ---------------------------------------------------------------------------
  /*
   * Ein Schweizer Panorama, um einen steilen Zahn (wie das Matterhorn) bei
   * 62 % der Breite. Die Gipfel stehen in Einheiten der Berghöhe, damit sie
   * hoch wie quer gleich aussehen: hochkant sieht man den Zahn und seine
   * Nachbarn, quer die ganze Kette. Jeder Gipfel hat eine Flanke im Licht
   * (links: Osten, wo die Sonne aufgeht) und eine im Schatten, getrennt von
   * einem Grat, der vom Gipfel schräg hinunterläuft; oben Schnee, dazwischen
   * Felsrippen, am breiten Massiv ein Gletscher. Die ferneren stehen tiefer
   * im Dunst.
   */
  const GIPFEL = [
    { x: -4.2, h: 0.5, l: 0.8, r: 0.9, a: 0.3, d: 0.5 },
    { x: -3.1, h: 0.6, l: 0.8, r: 0.9, a: 0.4, d: 0.15 },
    { x: -1.75, h: 0.74, l: 1.05, r: 0.8, a: 0.34, d: 0.05, gletscher: true },
    { x: -0.82, h: 0.5, l: 0.45, r: 0.45, a: 0.3, d: 0.45 },
    { x: 0, h: 1, l: 0.42, r: 0.72, a: 0.16, d: 0.2, zahn: true },
    { x: 0.52, h: 0.62, l: 0.22, r: 0.42, a: 0.2, d: 0.28 },
    { x: 1.35, h: 0.56, l: 0.62, r: 0.7, a: 0.3, d: 0.08 },
    { x: 2.35, h: 0.68, l: 0.8, r: 0.8, a: 0.35, d: 0.22 },
    { x: 3.45, h: 0.5, l: 0.75, r: 0.9, a: 0.3, d: 0.4 },
    { x: 4.5, h: 0.62, l: 0.7, r: 0.8, a: 0.3, d: 0.2 },
  ];

  // Am Schilfgürtel eine fernere, sanftere Kette mit einem Doppelgipfel; am
  // Felsufer Türme und Zinnen wie in den Dolomiten; am Gletschersee breite
  // Massive voll Eis.
  const GIPFEL_SCHILF = [
    { x: -3.6, h: 0.42, l: 1, r: 1, a: 0.3, d: 0.5 },
    { x: -2.2, h: 0.56, l: 0.9, r: 0.8, a: 0.36, d: 0.3, gletscher: true },
    { x: -1.1, h: 0.5, l: 0.6, r: 0.6, a: 0.3, d: 0.42 },
    { x: 0, h: 0.86, l: 0.7, r: 0.55, a: 0.22, d: 0.18 },
    { x: 0.42, h: 0.8, l: 0.35, r: 0.75, a: 0.2, d: 0.2 },
    { x: 1.6, h: 0.6, l: 0.8, r: 0.9, a: 0.3, d: 0.1 },
    { x: 2.9, h: 0.48, l: 0.9, r: 1, a: 0.35, d: 0.35 },
    { x: 4.1, h: 0.55, l: 0.8, r: 0.9, a: 0.3, d: 0.25 },
  ];
  const GIPFEL_FELS = [
    { x: -3.9, h: 0.6, l: 0.5, r: 0.6, a: 0.2, d: 0.45 },
    { x: -2.8, h: 0.78, l: 0.32, r: 0.4, a: 0.16, d: 0.28, zahn: true },
    { x: -2.25, h: 0.66, l: 0.25, r: 0.35, a: 0.16, d: 0.3, zahn: true },
    { x: -1.2, h: 0.92, l: 0.38, r: 0.45, a: 0.14, d: 0.12, zahn: true },
    { x: -0.55, h: 0.7, l: 0.3, r: 0.3, a: 0.15, d: 0.2, zahn: true },
    { x: 0.35, h: 1, l: 0.42, r: 0.5, a: 0.14, d: 0.05, zahn: true },
    { x: 1.2, h: 0.74, l: 0.3, r: 0.42, a: 0.16, d: 0.15, zahn: true },
    { x: 2.2, h: 0.62, l: 0.5, r: 0.6, a: 0.2, d: 0.3 },
    { x: 3.3, h: 0.8, l: 0.35, r: 0.45, a: 0.15, d: 0.22, zahn: true },
    { x: 4.4, h: 0.58, l: 0.6, r: 0.7, a: 0.25, d: 0.35 },
  ];
  const GIPFEL_EIS = [
    { x: -4, h: 0.55, l: 1, r: 1, a: 0.3, d: 0.45, gletscher: true },
    { x: -2.5, h: 0.78, l: 1.1, r: 0.9, a: 0.32, d: 0.2, gletscher: true },
    { x: -0.9, h: 0.66, l: 0.7, r: 0.6, a: 0.3, d: 0.3 },
    { x: 0.2, h: 1, l: 0.85, r: 0.95, a: 0.25, d: 0.08, gletscher: true },
    { x: 1.9, h: 0.72, l: 0.8, r: 0.9, a: 0.3, d: 0.18, gletscher: true },
    { x: 3.4, h: 0.6, l: 0.9, r: 1, a: 0.3, d: 0.35 },
  ];

  const BERG_GLUT = {
    felsLicht: [218, 128, 116], felsSchatten: [78, 72, 124], schneeLicht: [255, 206, 186], schneeSchatten: [150, 152, 212],
    dunst: [232, 168, 170], kante: [255, 240, 222], gletscher: [214, 226, 255], links: true,
  };
  const BERG_GOLD = {
    felsLicht: [228, 160, 116], felsSchatten: [98, 92, 140], schneeLicht: [255, 232, 196], schneeSchatten: [170, 170, 214],
    dunst: [238, 200, 172], kante: [255, 246, 224], gletscher: [222, 230, 250], links: true,
  };
  const BERG_FELS = {
    felsLicht: [204, 172, 146], felsSchatten: [84, 92, 128], schneeLicht: [252, 248, 244], schneeSchatten: [164, 182, 218],
    dunst: [196, 210, 230], kante: [255, 250, 238], gletscher: [214, 228, 248], links: true, schnee: 0.62, baender: true,
  };
  const BERG_EIS = {
    felsLicht: [150, 158, 186], felsSchatten: [70, 88, 128], schneeLicht: [255, 255, 255], schneeSchatten: [176, 206, 236],
    dunst: [212, 232, 246], kante: [255, 255, 255], gletscher: [178, 222, 252], links: true, schnee: 0.16,
  };
  const BERG_BLAU = {
    felsLicht: [108, 102, 154], felsSchatten: [66, 66, 116], schneeLicht: [190, 194, 230], schneeSchatten: [124, 130, 188],
    dunst: [150, 146, 192], kante: [214, 218, 244], gletscher: [170, 186, 232], links: true,
  };
  // So hoch stehen die Berge im erwachten See, gemessen an den wirklichen.
  const BERG_TRAUM = 0.58;
  const BERG_NACHT = {
    felsLicht: [24, 36, 74], felsSchatten: [10, 16, 40], schneeLicht: [76, 118, 170], schneeSchatten: [30, 48, 96],
    dunst: [12, 28, 62], kante: [150, 246, 255], gletscher: [60, 120, 170], links: false,
  };

  function gipfelPunkte(G, x0, fuss, H, z, Hx = H) {
    // Die Kanten: links vom Fuss zum Gipfel, rechts hinunter, mit Zacken.
    // Hx: der Massstab quer (im erwachten See sind sie niedriger, nicht
    // schmaler).
    const gx = x0 + G.x * Hx;
    const gy = fuss - G.h * H;
    const lx = gx - G.l * Hx;
    const rx = gx + G.r * Hx;
    const links = [];
    const rechts = [];
    const n = 14;
    for (let i = 0; i <= n; i += 1) {
      const f = i / n;
      const zack = i > 0 && i < n ? (z() - 0.5) * H * 0.05 * (1 - Math.abs(f - 0.5)) : 0;
      // Die Flanken sind unten flacher, oben steiler.
      const hoehe = Math.pow(f, G.zahn ? 1.15 : 1.35);
      links.push([lerp(lx, gx, f) + zack * 0.4, fuss - hoehe * (fuss - gy) + zack]);
    }
    for (let i = 1; i <= n; i += 1) {
      const f = i / n;
      const zack = i < n ? (z() - 0.5) * H * 0.05 * (1 - Math.abs(f - 0.5)) : 0;
      const hoehe = Math.pow(1 - f, G.zahn ? 1.05 : 1.3);
      // Die Schulter des Zahns: ein kleiner Absatz im rechten Grat.
      const absatz = G.zahn && f > 0.28 && f < 0.42 ? -H * 0.05 * Math.sin(((f - 0.28) / 0.14) * Math.PI) : 0;
      rechts.push([lerp(gx, rx, f) + zack * 0.4, fuss - hoehe * (fuss - gy) + zack + absatz]);
    }
    return { gx, gy, lx, rx, links, rechts };
  }

  function maleBerge(k, W, fuss, H, pal, Hx = H, gipfel = GIPFEL, lage = 0.62) {
    const z = wuerfel(4411);
    const x0 = W * lage;
    const reihe = gipfel.map((G, i) => ({ G, i })).sort((a, b) => b.G.d - a.G.d);
    // Die Zacken hängen an der Reihenfolge der Gipfel, nicht der Zeichnung.
    const punkte = gipfel.map((G) => gipfelPunkte(G, x0, fuss, H, z, Hx));
    reihe.forEach(({ G, i }) => {
      const P = punkte[i];
      if (P.rx < -10 || P.lx > W + 10) return;
      const umriss = () => {
        k.beginPath();
        k.moveTo(P.lx, fuss + 2);
        P.links.forEach(([x, y]) => k.lineTo(x, y));
        P.rechts.forEach(([x, y]) => k.lineTo(x, y));
        k.lineTo(P.rx, fuss + 2);
        k.closePath();
      };
      // Der Grat vom Gipfel hinunter trennt Licht und Schatten.
      const gratX = P.gx + G.a * G.r * H * (pal.links ? 1 : -1.6);
      const grat = [];
      for (let j = 0; j <= 10; j += 1) {
        const f = j / 10;
        grat.push([lerp(P.gx, gratX, f ** 0.8) + Math.sin(j * 2.1 + G.x) * H * 0.012, lerp(P.gy, fuss, f)]);
      }
      const lichtSeite = () => {
        k.beginPath();
        if (pal.links) {
          k.moveTo(P.lx - 2, fuss + 2);
          P.links.forEach(([x, y]) => k.lineTo(x, y));
          grat.forEach(([x, y]) => k.lineTo(x, y));
        } else {
          k.moveTo(P.rx + 2, fuss + 2);
          [...P.rechts].reverse().forEach(([x, y]) => k.lineTo(x, y));
          k.lineTo(P.gx, P.gy);
          grat.forEach(([x, y]) => k.lineTo(x, y));
        }
        k.closePath();
      };
      const dunst = (c, f) => mix3(c, pal.dunst, f);
      const d = G.d * 0.45;
      umriss();
      k.fillStyle = rgb(dunst(pal.felsSchatten, d));
      k.fill();
      k.save();
      umriss();
      k.clip();
      lichtSeite();
      k.fillStyle = rgb(dunst(pal.felsLicht, d));
      k.fill();
      // Der Schnee: über einer Linie mit Zacken, auf steilen Wänden nur in
      // Rinnen und Bändern.
      const schneeY = (x) => fuss - H * ((pal.schnee ?? 0.34) + 0.1 * rauschen(x / H * 3.1, 7) + 0.04 * Math.sin(x / H * 13 + G.x));
      const schnee = () => {
        k.beginPath();
        k.moveTo(P.lx - 4, schneeY(P.lx - 4));
        for (let x = P.lx - 4; x <= P.rx + 4; x += 3) k.lineTo(x, schneeY(x));
        k.lineTo(P.rx + 4, fuss - H * 1.2);
        k.lineTo(P.lx - 4, fuss - H * 1.2);
        k.closePath();
      };
      schnee();
      k.fillStyle = rgb(dunst(pal.schneeSchatten, d));
      k.fill();
      k.save();
      schnee();
      k.clip();
      lichtSeite();
      k.fillStyle = rgb(dunst(pal.schneeLicht, d * 0.8));
      k.fill();
      k.restore();
      // Felsrippen durch den Schnee: feine, auslaufende Striche vom Grat
      // schräg hinab, im Schatten dunkler als im Licht.
      const steil = G.zahn ? 1.5 : 1;
      k.lineCap = "round";
      for (let j = 0; j < (G.zahn ? 14 : 8); j += 1) {
        const f = 0.12 + z() * 0.75;
        const links = z() < 0.5;
        const seite = links ? P.links : P.rechts;
        const [sx, sy] = seite[Math.min(seite.length - 1, Math.floor(f * seite.length))];
        const lang = H * (0.04 + z() * 0.1) * steil;
        const richtung = links ? 0.3 : -0.3;
        const imLicht = links === pal.links;
        for (let m = 0; m < 3; m += 1) {
          k.strokeStyle = rgba(dunst(pal.felsSchatten, d), (imLicht ? 0.28 : 0.4) * (1 - m * 0.3));
          k.lineWidth = Math.max(0.5, H * 0.007 * (1 - m * 0.3));
          k.beginPath();
          k.moveTo(sx + richtung * lang * 0.33 * m, sy + 1 + lang * 0.33 * m);
          k.lineTo(sx + richtung * lang * 0.33 * (m + 1), sy + 1 + lang * 0.33 * (m + 1));
          k.stroke();
        }
      }
      // Fels in Bändern (am Felsufer): Schichten quer über die Türme, im
      // Schatten dunkler, und Rinnen, die sie zerschneiden.
      if (pal.baender) {
        for (let j = 0; j < 9; j += 1) {
          const y = lerp(P.gy + H * 0.08, fuss, (j + 0.5) / 9) + (z() - 0.5) * H * 0.02;
          k.strokeStyle = rgba(dunst(pal.felsSchatten, d), 0.22 + (j % 2) * 0.1);
          k.lineWidth = Math.max(0.6, H * (0.006 + (j % 3) * 0.003));
          k.beginPath();
          k.moveTo(P.lx - 4, y);
          for (let x = P.lx; x <= P.rx + 4; x += 6) k.lineTo(x, y + Math.sin(x * 0.07 + j) * H * 0.006 + (x - P.gx) * 0.05);
          k.stroke();
        }
        for (let j = 0; j < 12; j += 1) {
          const x = lerp(P.lx, P.rx, 0.1 + z() * 0.8);
          const y0 = P.gy + H * (0.1 + z() * 0.3);
          k.strokeStyle = rgba(dunst(pal.felsSchatten, d), 0.3);
          k.lineWidth = Math.max(0.6, H * 0.008);
          k.beginPath();
          k.moveTo(x, y0);
          k.lineTo(x + (z() - 0.5) * H * 0.04, lerp(y0, fuss, 0.5 + z() * 0.4));
          k.stroke();
        }
      }
      // Am breiten Massiv: ein Gletscher, der in ein Tal fliesst.
      if (G.gletscher) {
        const gx = P.gx + G.r * H * 0.38;
        const top = fuss - H * 0.5;
        const unten = fuss - H * 0.08;
        k.beginPath();
        k.moveTo(gx - H * 0.2, top);
        k.bezierCurveTo(gx - H * 0.12, top + H * 0.12, gx - H * 0.08, unten - H * 0.1, gx - H * 0.02, unten);
        k.quadraticCurveTo(gx + H * 0.03, unten + H * 0.02, gx + H * 0.06, unten - H * 0.01);
        k.bezierCurveTo(gx + H * 0.05, unten - H * 0.12, gx + H * 0.1, top + H * 0.1, gx + H * 0.18, top - H * 0.02);
        k.closePath();
        const eis = k.createLinearGradient(0, top, 0, unten);
        eis.addColorStop(0, rgba(dunst(pal.schneeLicht, d), 0.95));
        eis.addColorStop(1, rgba(dunst(pal.gletscher, d), 0.95));
        k.fillStyle = eis;
        k.fill();
        k.strokeStyle = rgba(dunst(pal.felsSchatten, d * 0.5), 0.1);
        k.lineWidth = 0.5;
        for (let j = 1; j < 4; j += 1) {
          const y = lerp(top + H * 0.08, unten - H * 0.04, j / 6);
          k.beginPath();
          k.moveTo(gx - H * 0.08, y);
          k.quadraticCurveTo(gx, y + H * 0.025, gx + H * 0.06, y - H * 0.005);
          k.stroke();
        }
      }
      // Unten in den Dunst des Tals.
      const tal = k.createLinearGradient(0, P.gy, 0, fuss);
      tal.addColorStop(0, rgba(pal.dunst, 0.04 + G.d * 0.25));
      tal.addColorStop(0.6, rgba(pal.dunst, 0.12 + G.d * 0.3));
      tal.addColorStop(1, rgba(pal.dunst, 0.75));
      k.fillStyle = tal;
      k.fillRect(P.lx - 4, P.gy - 2, P.rx - P.lx + 8, fuss - P.gy + 4);
      k.restore();
      // Die Grate fangen das erste Licht.
      k.strokeStyle = rgba(pal.kante, 0.55 * (1 - G.d * 0.6));
      k.lineWidth = 0.9;
      k.beginPath();
      const kante = pal.links ? P.links : [[P.gx, P.gy], ...P.rechts];
      kante.forEach(([x, y], j) => { if (j) k.lineTo(x, y + 0.4); else k.moveTo(x, y + 0.4); });
      k.stroke();
    });
  }

  // ---------------------------------------------------------------------------
  // Zeichnen: der Himmel über dem See – einmal gemalt, dann aufgelegt
  // ---------------------------------------------------------------------------
  /*
   * Morgendämmerung: oben noch tiefes Blau mit den letzten Sternen und der
   * Venus, dann Violett, Rosa und Pfirsich zum Horizont; links hinter den
   * Bergen geht bald die Sonne auf. Lange, dünne Wolken, von unten rosa und
   * golden beleuchtet. Davor das Panorama (maleBerge). Zwei Fassungen: vor
   * dem Alpenglühen (blau) – nur beim ersten Start, wenn die Gipfel
   * aufglühen – und glühend.
   */
  const HIMMEL_GLUT = {
    stops: [[0, [20, 28, 70]], [0.26, [40, 44, 102]], [0.48, [92, 74, 134]], [0.66, [166, 102, 144]], [0.8, [226, 138, 140]], [0.92, [246, 176, 136]], [1, [251, 208, 162]]],
    tal: [236, 188, 176], wolke: [255, 186, 160], wolkeDunkel: [116, 84, 140], sonne: [255, 206, 150],
  };
  const HIMMEL_BLAU = {
    stops: [[0, [14, 22, 60]], [0.3, [32, 42, 96]], [0.55, [64, 72, 130]], [0.75, [116, 112, 166]], [0.9, [160, 150, 188]], [1, [186, 172, 200]]],
    tal: [170, 160, 196], wolke: [176, 168, 206], wolkeDunkel: [74, 74, 124], sonne: [210, 190, 210],
  };

  // Die Morgen der anderen Landschaften: Sonnenaufgang in Gold über dem
  // Schilf (die Sonne steht schon über dem Hang), ein klarer blauer Morgen am
  // Felsufer, ein kaltes, helles Licht über dem Gletscher.
  const HIMMEL_GOLD = {
    stops: [[0, [26, 40, 92]], [0.28, [58, 76, 146]], [0.5, [132, 116, 170]], [0.68, [226, 160, 146]], [0.84, [255, 200, 140]], [1, [255, 230, 176]]],
    tal: [246, 214, 172], wolke: [255, 214, 160], wolkeDunkel: [134, 110, 150], sonne: [255, 224, 150], scheibe: true, sterne: 0.25,
  };
  const HIMMEL_KLAR = {
    stops: [[0, [28, 66, 134]], [0.35, [62, 120, 192]], [0.66, [134, 176, 220]], [0.86, [214, 214, 214]], [1, [244, 228, 196]]],
    tal: [206, 216, 228], wolke: [255, 248, 238], wolkeDunkel: [150, 168, 200], sonne: [255, 238, 206], sterne: 0,
  };
  const HIMMEL_EIS = {
    stops: [[0, [36, 80, 136]], [0.4, [96, 160, 206]], [0.72, [184, 222, 240]], [1, [238, 250, 255]]],
    tal: [222, 238, 248], wolke: [255, 255, 255], wolkeDunkel: [168, 196, 222], sonne: [255, 255, 246], sterne: 0,
  };

  function maleHimmel(k, W, H, glut, LB = LAND_BILD[0]) {
    const pal = glut ? LB.himmel : HIMMEL_BLAU;
    const hz = view.hz;
    const frei = view.frei;
    const v = k.createLinearGradient(0, 0, 0, hz);
    pal.stops.forEach(([f, c]) => v.addColorStop(f, rgb(c)));
    k.fillStyle = v;
    k.fillRect(0, 0, W, hz + 1);
    k.fillStyle = rgb(pal.tal);
    k.fillRect(0, hz, W, H - hz);
    // Links hinter den Bergen: Bald geht dort die Sonne auf.
    const sx = W * 0.16;
    const r = Math.max(W, H) * 0.75;
    k.save();
    k.translate(sx, hz);
    k.scale(1.6, 1);
    const hof = k.createRadialGradient(0, 0, 0, 0, 0, r);
    hof.addColorStop(0, rgba(pal.sonne, glut ? 0.75 : 0.25));
    hof.addColorStop(0.18, rgba(pal.sonne, glut ? 0.38 : 0.12));
    hof.addColorStop(0.5, rgba(pal.sonne, glut ? 0.08 : 0.03));
    hof.addColorStop(1, rgba(pal.sonne, 0));
    k.fillStyle = hof;
    k.fillRect(-r, -r, 2 * r, 2 * r);
    k.restore();
    // Die letzten Sterne, oben.
    const z = wuerfel(2207);
    k.fillStyle = "#ffffff";
    for (let i = 0; i < 70; i += 1) {
      const x = z() * W;
      const y = frei * 0.3 + z() ** 1.6 * (hz - frei) * 0.55;
      const a = clamp(1 - y / (hz * 0.6), 0, 1) * (0.25 + z() * 0.6);
      k.globalAlpha = a * (glut ? (pal.sterne ?? 0.75) : 1);
      const g2 = 0.5 + z() * 0.9;
      k.fillRect(x, y, g2, g2);
    }
    k.globalAlpha = 1;
    // Lange, dünne Wolken: oben im Schatten, unten im Licht der Sonne.
    for (let i = 0; i < 6; i += 1) {
      const cx = (0.1 + i * 0.17 + z() * 0.08) * W;
      const cy = frei + (hz - frei) * (0.18 + z() * 0.42);
      const lang = W * (0.12 + z() * 0.22);
      const dick = Math.max(2, (hz - frei) * (0.012 + z() * 0.018));
      for (let j = 0; j < 5; j += 1) {
        const ox = (z() - 0.5) * lang * 0.9;
        const oy = (z() - 0.5) * dick * 1.4;
        const rx = lang * (0.25 + z() * 0.35);
        const ry = dick * (0.7 + z() * 0.6);
        const w2 = k.createLinearGradient(0, cy + oy - ry, 0, cy + oy + ry);
        w2.addColorStop(0, rgba(pal.wolkeDunkel, 0.35));
        w2.addColorStop(0.55, rgba(pal.wolke, 0.5));
        w2.addColorStop(1, rgba(pal.wolke, glut ? 0.85 : 0.4));
        k.fillStyle = w2;
        k.beginPath();
        k.ellipse(cx + ox, cy + oy, rx, ry, 0, 0, TAU);
        k.fill();
      }
    }
    // Über dem Schilf ist die Sonne schon aufgegangen: eine Scheibe über dem
    // Hang, Strahlen durch den Dunst.
    if (glut && pal.scheibe) {
      const r0 = Math.max(6, view.berg * 0.07);
      const sy = hz - view.berg * 0.36;
      k.save();
      k.globalCompositeOperation = "lighter";
      for (let i = 0; i < 9; i += 1) {
        const w = -0.25 + i * 0.12 + Math.sin(i * 2.3) * 0.03;
        k.fillStyle = rgba(pal.sonne, 0.06);
        k.beginPath();
        k.moveTo(sx, sy);
        k.lineTo(sx + Math.cos(w) * W * 1.4 - r0, sy + Math.sin(w) * W * 1.4);
        k.lineTo(sx + Math.cos(w + 0.035) * W * 1.4 + r0, sy + Math.sin(w + 0.035) * W * 1.4);
        k.closePath();
        k.fill();
      }
      k.restore();
      const glanz = k.createRadialGradient(sx, sy, 0, sx, sy, r0 * 5);
      glanz.addColorStop(0, rgba([255, 250, 230], 1));
      glanz.addColorStop(0.2, rgba([255, 240, 200], 0.9));
      glanz.addColorStop(0.45, rgba(pal.sonne, 0.25));
      glanz.addColorStop(1, rgba(pal.sonne, 0));
      k.fillStyle = glanz;
      k.fillRect(sx - r0 * 5, sy - r0 * 5, r0 * 10, r0 * 10);
    }
    // Die Berge.
    maleBerge(k, W, hz, view.berg * (glut ? LB.bergH : 1), glut ? LB.berge : BERG_BLAU, view.berg, glut ? LB.gipfel : GIPFEL, glut ? LB.bergX : 0.62);
    // Morgennebel über dem Tal, am Fuss der Berge.
    const nebel = k.createLinearGradient(0, hz - view.berg * 0.18, 0, hz + 6);
    nebel.addColorStop(0, rgba(pal.tal, 0));
    nebel.addColorStop(0.75, rgba(pal.tal, 0.55));
    nebel.addColorStop(1, rgba(pal.tal, 0.9));
    k.fillStyle = nebel;
    k.fillRect(0, hz - view.berg * 0.18, W, view.berg * 0.18 + 6);
  }

  // ---------------------------------------------------------------------------
  // Zeichnen: Hänge, Wald und Ufer – Streifen, einmal gemalt, dann aufgelegt
  // ---------------------------------------------------------------------------
  /*
   * Hinter den fernen Bergen stehen drei Streifen, je näher, desto
   * schneller:
   *
   *   hang   bewaldete Hänge mit goldenen Lärchen, Felsen, einer Alphütte
   *          (Licht im Fenster, Rauch) und einer Kapelle; unten Nebel
   *   wald   Lärchen und Arven gleich hinter dem Weg, im Dunst
   *   ufer   der Weg, die Uferkante und ihr Spiegelbild (Einheiten der
   *          Strecke, PERIODE lang)
   *
   * Jeder Streifen wiederholt sich nach seiner Breite; was darauf steht, wird
   * darum um eine Breite versetzt noch einmal gemalt. Für den See gibt es
   * jeden schon gespiegelt: im Morgenlicht (dunkler, blauer, mit feinen
   * Wellen) und in der Nacht des erwachten Sees.
   */
  let ebenen = null;
  const PAR = { hang: 0.07, wald: 0.24 };

  function streifen(breit, hoch, malen) {
    const c = document.createElement("canvas");
    c.width = Math.max(8, Math.round(breit * view.dpr));
    c.height = Math.max(8, Math.round(hoch * view.dpr));
    const k = c.getContext("2d");
    k.scale(c.width / breit, c.height / hoch);
    malen(k, breit, hoch);
    fertigMalen(c);
    return c;
  }

  // Ein Browser darf das Malen aufschieben, bis das Bild gebraucht wird – dann
  // käme alles auf einmal, mitten im Spiel. Ein gelesener Bildpunkt zwingt
  // ihn, es jetzt zu tun.
  function fertigMalen(c) {
    try { c.getContext("2d").getImageData(0, 0, 1, 1); } catch { /* egal */ }
  }

  // Dasselbe in zahl Bändern (je ein Schritt): Was viel Fläche malt (Himmel,
  // Nacht), kostet so je Bild nur einen Teil.
  function streifenSchritte(breit, hoch, malen, zahl, fertig) {
    let c = null;
    const liste = [];
    for (let i = 0; i < zahl; i += 1) {
      liste.push(() => {
        if (!c) {
          c = document.createElement("canvas");
          c.width = Math.max(8, Math.round(breit * view.dpr));
          c.height = Math.max(8, Math.round(hoch * view.dpr));
        }
        const k = c.getContext("2d");
        k.setTransform(c.width / breit, 0, 0, c.height / hoch, 0, 0);
        k.save();
        k.beginPath();
        k.rect((breit * i) / zahl - 1, -1, breit / zahl + 2, hoch + 2);
        k.clip();
        malen(k, breit, hoch);
        k.restore();
        fertigMalen(c);
      });
    }
    liste.push(() => fertig(c));
    return liste;
  }

  // Eine Form an x, und noch einmal eine Breite links und rechts davon.
  const rundum = (W, malen) => { malen(-W); malen(0); malen(W); };

  // Ein Bild, auf den Kopf gestellt – und danach getönt (nach).
  function gespiegelt(bild, nach) {
    const c = document.createElement("canvas");
    c.width = bild.width;
    c.height = bild.height;
    const k = c.getContext("2d");
    k.translate(0, c.height);
    k.scale(1, -1);
    k.drawImage(bild, 0, 0);
    k.setTransform(1, 0, 0, 1, 0, 0);
    if (nach) {
      k.globalCompositeOperation = "source-atop";
      nach(k, c.width, c.height);
      k.globalCompositeOperation = "source-over";
    }
    fertigMalen(c);
    return c;
  }

  // Die Tönung des treuen Spiegels: dunkler und blauer, mit feinen hellen
  // Wellen (in Bildpunkten des Bildes).
  // Je Landschaft ein eigener Ton: am Schilf wärmer, am Gletscher ist der
  // Spiegel Eis – heller, blau, mit Rissen.
  function spiegelTon(k, w, h, saat, LB = LAND_BILD[0]) {
    k.fillStyle = rgba(LB.ton, LB.tonKraft ?? 0.36);
    k.fillRect(0, 0, w, h);
    const z = wuerfel(saat);
    const d = view.dpr;
    for (let i = 0; i < Math.round(w * h / (900 * d * d)); i += 1) {
      const x = z() * w;
      const y = z() * h;
      const lang = (6 + z() * 34) * d;
      k.fillStyle = z() < 0.6 ? "rgba(255, 236, 226, 0.11)" : "rgba(16, 20, 50, 0.16)";
      k.fillRect(x, y, lang, Math.max(1, d * 0.8));
    }
    if (LB.eisSpiegel) {
      k.strokeStyle = "rgba(240, 252, 255, 0.35)";
      k.lineWidth = Math.max(1, d * 0.8);
      for (let i = 0; i < Math.round(w / (60 * d)); i += 1) {
        let x = z() * w;
        let y = z() * h;
        let r = z() * TAU;
        k.beginPath();
        k.moveTo(x, y);
        for (let j = 0; j < 6; j += 1) {
          r += (z() - 0.5) * 1.2;
          x += Math.cos(r) * 26 * d;
          y += Math.sin(r) * 9 * d;
          k.lineTo(x, y);
        }
        k.stroke();
      }
    }
  }

  const HANG_TAG = {
    fern: [120, 102, 150], fernLicht: [226, 150, 150], nah: [64, 66, 110], nahLicht: [188, 120, 126],
    baum: [44, 50, 88], laerche: [214, 160, 84], fels: [150, 134, 168], huette: [58, 44, 66], dach: [92, 70, 86],
    fenster: [255, 206, 122], kapelle: [242, 220, 226], nebel: [240, 196, 190], rauch: [230, 210, 220],
  };
  const HANG_NACHT = {
    fern: [16, 30, 62], fernLicht: [110, 230, 240], nah: [10, 20, 44], nahLicht: [80, 200, 230],
    baum: [8, 16, 36], laerche: [54, 120, 150], fels: [30, 48, 82], huette: [8, 14, 30], dach: [16, 26, 50],
    fenster: [130, 250, 255], kapelle: [96, 140, 190], nebel: [18, 50, 92], rauch: [70, 140, 170],
  };

  // Die Hänge der anderen Landschaften. Im erwachten See dieselben Formen in
  // den Farben der Nacht (nachtVon): dunkel, mit leuchtenden Säumen.
  function nachtVon(pal, licht) {
    const aus = {};
    Object.entries(pal).forEach(([name, c]) => {
      if (!Array.isArray(c)) { aus[name] = c; return; }
      aus[name] = /Licht|fenster|kapelle|wasser|gischt/.test(name) ? mix3(licht, c, 0.2) : mix3(c, [10, 20, 46], 0.84);
    });
    aus.funken = licht;
    return aus;
  }
  const HANG_SCHILF = {
    fern: [150, 126, 150], fernLicht: [255, 204, 150], nah: [104, 112, 96], nahLicht: [240, 200, 130],
    baum: [62, 82, 68], laerche: [222, 172, 84], fels: [160, 140, 150], huette: [104, 70, 58], dach: [150, 78, 60],
    fenster: [255, 214, 140], kapelle: [248, 238, 228], nebel: [250, 220, 182], rauch: [236, 220, 214],
    see: [176, 170, 198], seeLicht: [255, 236, 198], schilf: [210, 172, 94],
  };
  const HANG_FELS = {
    fern: [126, 138, 172], fernLicht: [246, 228, 206], nah: [92, 96, 124], nahLicht: [232, 206, 180],
    baum: [36, 62, 58], laerche: [70, 104, 80], fels: [150, 146, 164], huette: [70, 56, 66], dach: [110, 80, 76],
    fenster: [255, 220, 150], kapelle: [240, 236, 230], nebel: [226, 232, 240], rauch: [236, 240, 246],
    wasser: [244, 250, 255], gischt: [255, 255, 255],
  };
  const HANG_GLETSCHER = {
    fern: [188, 208, 230], fernLicht: [255, 255, 255], nah: [126, 124, 138], nahLicht: [236, 230, 226],
    baum: [44, 66, 70], laerche: [60, 90, 84], fels: [120, 124, 142], huette: [70, 60, 70], dach: [100, 80, 80],
    fenster: [255, 226, 160], kapelle: [240, 240, 240], nebel: [232, 244, 252], rauch: [240, 246, 250],
    eis: [176, 222, 250], eisLicht: [244, 252, 255], eisTief: [86, 156, 210], schnee: [250, 252, 255],
  };

  function maleHang(k, W, voll, pal, art = "laerchen") {
    if (art === "schilf") maleHangSchilf(k, W, voll, pal);
    else if (art === "fels") maleHangFels(k, W, voll, pal);
    else if (art === "gletscher") maleHangGletscher(k, W, voll, pal);
    else maleHangLaerchen(k, W, voll, pal);
  }

  // Ein Kamm aus Rauschen, der sich nach der Breite W wiederholt.
  const kammVon = (H, W, basis, teile) => (x) => H * (basis + teile.reduce((summe, [a, n, saat]) => summe + a * rauschenRund((x / W) * n, n, saat), 0));

  function kammFuellen(k, W, H, kamm, farbe, saum, saumA = 0.55) {
    k.fillStyle = rgb(farbe);
    k.beginPath();
    k.moveTo(0, H);
    for (let x = 0; x <= W; x += 3) k.lineTo(x, kamm(x));
    k.lineTo(W, H);
    k.closePath();
    k.fill();
    if (!saum) return;
    k.strokeStyle = rgba(saum, saumA);
    k.lineWidth = 1;
    k.beginPath();
    for (let x = 0; x <= W; x += 3) { if (x) k.lineTo(x, kamm(x) + 0.5); else k.moveTo(x, kamm(x) + 0.5); }
    k.stroke();
  }

  // Unten im Hang das Tal im Nebel, deckend bis an den Weg (unterTal).
  function hangTal(k, W, voll, H, pal, ab = 0.55) {
    const nebel = k.createLinearGradient(0, H * ab, 0, H);
    nebel.addColorStop(0, rgba(pal.nebel, 0));
    nebel.addColorStop(0.6, rgba(pal.nebel, 0.38));
    nebel.addColorStop(1, rgba(pal.nebel, 0.78));
    k.fillStyle = nebel;
    k.fillRect(0, H * ab, W, H - H * ab);
    if (pal.unterTal) {
      k.fillStyle = rgb(mix3(pal.nah, pal.nebel, 0.78));
      k.fillRect(0, H, W, voll - H);
    }
  }

  // Der Schilfgürtel: sanfte Hügel mit Wiesen, Laubbäumen und Pappeln, ein
  // Dorf mit Kirche; unten der ferne See mit seinem Schilf und einem
  // Bootshaus am anderen Ufer.
  function maleHangSchilf(k, W, voll, pal) {
    const H = voll - (pal.unterTal || 0);
    const z = wuerfel(7307);
    const kammA = kammVon(H, W, 0.36, [[0.14, 4, 31], [0.05, 13, 37]]);
    const kammB = kammVon(H, W, 0.6, [[0.1, 3, 41], [0.05, 11, 43]]);
    kammFuellen(k, W, H, kammA, pal.fern, pal.fernLicht);
    // Wälder auf dem fernen Hügel: Gruppen kleiner Kronen, die sich
    // überlappen – ein Waldrand, keine Punkte.
    k.fillStyle = rgba(mix3(pal.fern, pal.baum, 0.4), 0.85);
    for (let i = 0; i < 9; i += 1) {
      const mitte = z() * W;
      const breit = W * (0.03 + z() * 0.05);
      for (let j = 0; j < 14; j += 1) {
        const x = mitte + (z() - 0.5) * breit;
        const y = kammA(x) + H * (0.02 + z() * 0.05);
        const r = H * (0.008 + z() * 0.008);
        rundum(W, (dx) => { k.beginPath(); k.ellipse(x + dx, y, r * 1.2, r, 0, 0, TAU); k.fill(); });
      }
    }
    kammFuellen(k, W, H, kammB, pal.nah, pal.nahLicht, 0.6);
    // Felder in Streifen, Hecken dazwischen.
    for (let i = 0; i < 14; i += 1) {
      const x0 = z() * W;
      const breit = W * (0.05 + z() * 0.08);
      const tief = H * (0.04 + z() * 0.1);
      const hell = z() < 0.5;
      rundum(W, (dx) => {
        k.fillStyle = hell ? rgba(pal.nahLicht, 0.16) : rgba(pal.baum, 0.18);
        k.beginPath();
        k.moveTo(x0 + dx, kammB(x0) + tief);
        k.lineTo(x0 + dx + breit, kammB(x0 + breit) + tief * 0.8);
        k.lineTo(x0 + dx + breit, kammB(x0 + breit) + tief * 1.6);
        k.lineTo(x0 + dx, kammB(x0) + tief * 1.8);
        k.closePath();
        k.fill();
      });
    }
    // Laubbäume (rund, manche golden) und schlanke Pappeln.
    for (let x = 0; x < W; x += 2.6) {
      if (z() < 0.45) continue;
      const y0 = kammB(x) + 1 + z() * H * 0.18;
      const pappel = z() < 0.22;
      const golden = z() < 0.3;
      const r = H * (0.018 + z() * 0.018);
      rundum(W, (dx) => {
        k.fillStyle = golden ? rgba(pal.laerche, 0.92) : rgba(pal.baum, 0.95);
        k.beginPath();
        if (pappel) k.ellipse(x + dx, y0 - r * 1.6, r * 0.55, r * 2.4, 0, 0, TAU);
        else k.arc(x + dx, y0 - r, r * 1.2, 0, TAU);
        k.fill();
        k.fillStyle = rgba(pal.nahLicht, 0.35);
        k.beginPath();
        if (pappel) k.ellipse(x + dx - r * 0.2, y0 - r * 2.2, r * 0.25, r * 1.2, 0, 0, TAU);
        else k.arc(x + dx - r * 0.4, y0 - r * 1.4, r * 0.55, 0, TAU);
        k.fill();
      });
    }
    // Ein Dorf mit Kirche: Häuser mit roten Dächern, ein spitzer Turm.
    const dorf = W * 0.34;
    rundum(W, (dx) => {
      for (let i = 0; i < 7; i += 1) {
        const hx = dorf + dx + (i - 3) * H * 0.07 + hash01(i * 3.3) * H * 0.03;
        const hy = kammB(dorf + (i - 3) * H * 0.07) + H * (0.04 + hash01(i * 7.1) * 0.05);
        const b = H * (0.04 + hash01(i * 1.7) * 0.02);
        k.fillStyle = rgb(pal.kapelle);
        k.fillRect(hx - b * 0.6, hy - b * 0.5, b * 1.2, b * 0.6);
        k.fillStyle = rgb(pal.dach);
        k.beginPath();
        k.moveTo(hx - b * 0.75, hy - b * 0.45);
        k.lineTo(hx, hy - b * 0.95);
        k.lineTo(hx + b * 0.75, hy - b * 0.45);
        k.closePath();
        k.fill();
        k.fillStyle = rgb(pal.fenster);
        k.fillRect(hx - b * 0.2, hy - b * 0.32, b * 0.16, b * 0.14);
      }
      const kx = dorf + dx + H * 0.02;
      const ky = kammB(dorf) + H * 0.02;
      const c = H * 0.05;
      k.fillStyle = rgb(pal.kapelle);
      k.fillRect(kx - c * 0.25, ky - c * 1.9, c * 0.5, c * 1.9);
      k.fillStyle = rgb(pal.dach);
      k.beginPath();
      k.moveTo(kx - c * 0.32, ky - c * 1.85);
      k.lineTo(kx, ky - c * 3);
      k.lineTo(kx + c * 0.32, ky - c * 1.85);
      k.closePath();
      k.fill();
    });
    // Unten der ferne See, sein Schilf und ein Bootshaus am anderen Ufer.
    const see = H * 0.86;
    k.fillStyle = rgb(pal.see);
    k.fillRect(0, see, W, H - see);
    k.fillStyle = rgba(pal.seeLicht, 0.55);
    for (let i = 0; i < Math.round(W / 6); i += 1) {
      const x = z() * W;
      const y = see + z() * (H - see);
      k.fillRect(x, y, 3 + z() * 12, 0.8);
    }
    for (let x = 0; x < W; x += 1.4) {
      if (z() < 0.25) continue;
      const hoch = H * (0.03 + z() * 0.05);
      k.strokeStyle = rgba(z() < 0.5 ? pal.schilf : mix3(pal.schilf, pal.baum, 0.5), 0.9);
      k.lineWidth = 0.8;
      k.beginPath();
      k.moveTo(x, see + 1);
      k.lineTo(x + (z() - 0.5) * 2, see + 1 - hoch);
      k.stroke();
    }
    const bx = W * 0.78;
    rundum(W, (dx) => {
      const x = bx + dx;
      const b = H * 0.09;
      k.fillStyle = rgb(pal.huette);
      k.fillRect(x - b * 0.6, see - b * 0.55, b * 1.2, b * 0.5);
      k.fillStyle = rgb(pal.dach);
      k.beginPath();
      k.moveTo(x - b * 0.78, see - b * 0.5);
      k.lineTo(x, see - b * 1);
      k.lineTo(x + b * 0.78, see - b * 0.5);
      k.closePath();
      k.fill();
      k.fillStyle = rgba([20, 14, 20], 0.8);
      k.fillRect(x - b * 0.25, see - b * 0.45, b * 0.5, b * 0.4);
      k.fillStyle = rgb(pal.huette);
      for (let i = 0; i < 4; i += 1) k.fillRect(x - b * 0.55 + i * b * 0.35, see - b * 0.08, b * 0.05, b * 0.16);
      k.fillStyle = rgba(pal.seeLicht, 0.4);
      k.fillRect(x - b * 0.6, see + b * 0.12, b * 1.2, 0.8);
    });
    hangTal(k, W, voll, H, pal, 0.7);
  }

  // Das Felsufer: zackige Grate, Wände aus hellem Fels mit Bändern, Föhren
  // auf den Simsen – und zwei Wasserfälle, die über die Wand stürzen.
  const WASSERFAELLE = [0.24, 0.71];
  function maleHangFels(k, W, voll, pal) {
    const H = voll - (pal.unterTal || 0);
    const z = wuerfel(8419);
    const zacken = (x, n, saat) => Math.abs(rauschenRund((x / W) * n, n, saat) - 0.5) * 2;
    const kammA = (x) => H * (0.24 + 0.2 * zacken(x, 7, 51) + 0.06 * rauschenRund((x / W) * 23, 23, 53));
    const kammB = (x) => H * (0.42 + 0.16 * zacken(x, 5, 57) + 0.05 * rauschenRund((x / W) * 17, 17, 59));
    kammFuellen(k, W, H, kammA, pal.fern, pal.fernLicht, 0.7);
    // Die nahe Wand: Fels, mit Bändern und Rinnen.
    kammFuellen(k, W, H, kammB, pal.fels, pal.nahLicht, 0.8);
    for (let i = 0; i < 9; i += 1) {
      const y = 0.52 + i * 0.05;
      k.strokeStyle = rgba(i % 2 ? pal.nah : pal.nahLicht, i % 2 ? 0.45 : 0.22);
      k.lineWidth = 1 + (i % 3);
      k.beginPath();
      for (let x = 0; x <= W; x += 4) {
        const yy = Math.max(kammB(x) + 2, H * (y + 0.02 * Math.sin(x / W * TAU * 3 + i)));
        if (x) k.lineTo(x, yy); else k.moveTo(x, yy);
      }
      k.stroke();
    }
    for (let i = 0; i < 40; i += 1) {
      const x = z() * W;
      const y0 = kammB(x) + 2;
      const lang = H * (0.1 + z() * 0.3);
      rundum(W, (dx) => {
        k.strokeStyle = rgba(pal.nah, 0.35);
        k.lineWidth = 1 + z();
        k.beginPath();
        k.moveTo(x + dx, y0);
        k.lineTo(x + dx + (z() - 0.5) * 6, y0 + lang);
        k.stroke();
      });
    }
    // Föhren auf den Simsen: dunkle, flache Kronen auf schlanken Stämmen.
    for (let x = 0; x < W; x += 3) {
      if (z() < 0.5) continue;
      const y0 = Math.max(kammB(x) + 4, H * (0.52 + Math.floor(z() * 8) * 0.05));
      const h = H * (0.03 + z() * 0.03);
      rundum(W, (dx) => {
        k.fillStyle = rgba(pal.baum, 0.95);
        k.beginPath();
        k.moveTo(x + dx - h * 0.35, y0);
        k.lineTo(x + dx, y0 - h);
        k.lineTo(x + dx + h * 0.35, y0);
        k.fill();
      });
    }
    // Die Wasserfälle: aus einer Kerbe im Grat über die Wand, unten Gischt.
    WASSERFAELLE.forEach((u, i) => {
      const x = W * u;
      rundum(W, (dx) => {
        const top = kammB(x) + 2;
        const breit = H * (0.018 + i * 0.006);
        const fall = k.createLinearGradient(0, top, 0, H);
        fall.addColorStop(0, rgba(pal.wasser, 0.95));
        fall.addColorStop(1, rgba(pal.wasser, 0.7));
        k.fillStyle = fall;
        k.beginPath();
        k.moveTo(x + dx - breit * 0.5, top);
        k.lineTo(x + dx + breit * 0.5, top);
        k.lineTo(x + dx + breit * 1.2, H);
        k.lineTo(x + dx - breit * 1.2, H);
        k.closePath();
        k.fill();
        k.strokeStyle = rgba(pal.nah, 0.25);
        k.lineWidth = 0.8;
        k.beginPath();
        for (let j = 0; j < 4; j += 1) {
          k.moveTo(x + dx + (j - 1.5) * breit * 0.4, top + 4);
          k.lineTo(x + dx + (j - 1.5) * breit * 0.6, H);
        }
        k.stroke();
        const gischt = k.createRadialGradient(x + dx, H, 0, x + dx, H, breit * 6);
        gischt.addColorStop(0, rgba(pal.gischt, 0.75));
        gischt.addColorStop(1, rgba(pal.gischt, 0));
        k.fillStyle = gischt;
        k.fillRect(x + dx - breit * 6, H - breit * 6, breit * 12, breit * 6);
      });
    });
    hangTal(k, W, voll, H, pal, 0.62);
  }

  // Der Gletschersee: verschneite Grate, Moränen, und eine Gletscherzunge,
  // die bis ans Wasser reicht – mit Spalten und einem blauen Abbruch.
  function maleHangGletscher(k, W, voll, pal) {
    const H = voll - (pal.unterTal || 0);
    const z = wuerfel(9521);
    const kammA = kammVon(H, W, 0.26, [[0.22, 5, 61], [0.06, 17, 63]]);
    const kammB = kammVon(H, W, 0.58, [[0.14, 4, 67], [0.06, 15, 69]]);
    kammFuellen(k, W, H, kammA, pal.fern, pal.fernLicht, 0.85);
    // Schatten im Schnee der fernen Grate.
    for (let i = 0; i < 24; i += 1) {
      const x = z() * W;
      const y = kammA(x) + H * 0.02;
      rundum(W, (dx) => {
        k.fillStyle = rgba(pal.eisTief, 0.22);
        k.beginPath();
        k.moveTo(x + dx, y);
        k.lineTo(x + dx + H * 0.05, y + H * 0.12);
        k.lineTo(x + dx - H * 0.02, y + H * 0.16);
        k.closePath();
        k.fill();
      });
    }
    kammFuellen(k, W, H, kammB, pal.nah, pal.nahLicht, 0.7);
    // Schneeflecken auf der Moräne.
    for (let i = 0; i < 50; i += 1) {
      const x = z() * W;
      const y = kammB(x) + H * (0.02 + z() * 0.25);
      const b = H * (0.02 + z() * 0.05);
      rundum(W, (dx) => {
        k.fillStyle = rgba(pal.schnee, 0.75);
        k.beginPath();
        k.ellipse(x + dx, y, b, b * 0.3, 0, 0, TAU);
        k.fill();
      });
    }
    // Die Gletscherzunge: breit von oben herab bis ans Wasser.
    const gx = W * 0.56;
    rundum(W, (dx) => {
      const x = gx + dx;
      const top = kammA(gx) + H * 0.05;
      const fuss = H * 0.93;
      k.fillStyle = rgb(pal.eis);
      k.beginPath();
      k.moveTo(x - H * 0.16, top);
      k.bezierCurveTo(x - H * 0.25, top + H * 0.3, x - H * 0.42, fuss - H * 0.2, x - H * 0.5, fuss);
      k.lineTo(x + H * 0.48, fuss);
      k.bezierCurveTo(x + H * 0.38, fuss - H * 0.25, x + H * 0.2, top + H * 0.3, x + H * 0.14, top);
      k.closePath();
      k.fill();
      // Spalten in Bögen, helle Kanten.
      for (let j = 1; j < 9; j += 1) {
        const y = lerp(top + H * 0.06, fuss - H * 0.05, j / 9);
        const halb = lerp(H * 0.16, H * 0.46, j / 9);
        k.strokeStyle = rgba(pal.eisTief, 0.55);
        k.lineWidth = 1;
        k.beginPath();
        k.moveTo(x - halb * 0.8, y);
        k.quadraticCurveTo(x, y + H * 0.03, x + halb * 0.8, y - H * 0.005);
        k.stroke();
        k.strokeStyle = rgba(pal.eisLicht, 0.7);
        k.beginPath();
        k.moveTo(x - halb * 0.8, y - 1);
        k.quadraticCurveTo(x, y + H * 0.03 - 1, x + halb * 0.8, y - H * 0.005 - 1);
        k.stroke();
      }
      // Der Abbruch am Wasser: eine blaue Wand.
      k.fillStyle = rgb(pal.eisTief);
      k.fillRect(x - H * 0.5, fuss - H * 0.05, H * 0.98, H * 0.07);
      k.fillStyle = rgba(pal.eisLicht, 0.8);
      k.fillRect(x - H * 0.5, fuss - H * 0.05, H * 0.98, 1);
    });
    // Unten das Wasser mit treibenden Schollen.
    const see = H * 0.95;
    k.fillStyle = rgb(mix3(pal.eisTief, pal.nebel, 0.4));
    k.fillRect(0, see, W, H - see);
    for (let i = 0; i < Math.round(W / 22); i += 1) {
      const x = z() * W;
      const b = H * (0.015 + z() * 0.04);
      k.fillStyle = rgba(pal.eisLicht, 0.9);
      k.fillRect(x, see + z() * (H - see) * 0.6, b, Math.max(1, b * 0.22));
    }
    hangTal(k, W, voll, H, pal, 0.72);
  }

  function maleHangLaerchen(k, W, voll, pal) {
    // Die Formen hängen an der Höhe ohne das Tal darunter (unterTal).
    const H = voll - (pal.unterTal || 0);
    const z = wuerfel(6203);
    const kammA = (x) => H * (0.3 + 0.2 * rauschenRund((x / W) * 6, 6, 3) + 0.08 * rauschenRund((x / W) * 15, 15, 9));
    const kammB = (x) => H * (0.56 + 0.16 * rauschenRund((x / W) * 5, 5, 17) + 0.06 * rauschenRund((x / W) * 19, 19, 23));
    // Der ferne Hang, mit hellem Saum im ersten Licht.
    k.fillStyle = rgb(pal.fern);
    k.beginPath();
    k.moveTo(0, H);
    for (let x = 0; x <= W; x += 3) k.lineTo(x, kammA(x));
    k.lineTo(W, H);
    k.closePath();
    k.fill();
    k.strokeStyle = rgba(pal.fernLicht, 0.55);
    k.lineWidth = 1;
    k.beginPath();
    for (let x = 0; x <= W; x += 3) { if (x) k.lineTo(x, kammA(x) + 0.5); else k.moveTo(x, kammA(x) + 0.5); }
    k.stroke();
    // Wald auf dem fernen Hang: kleine Spitzen, dicht.
    k.fillStyle = rgba(mix3(pal.fern, pal.baum, 0.5), 0.9);
    for (let x = 0; x < W; x += 2.2) {
      const y0 = kammA(x) + H * 0.04 + z() * H * 0.05;
      if (z() < 0.35) continue;
      const h = H * (0.025 + z() * 0.03);
      rundum(W, (dx) => {
        k.beginPath();
        k.moveTo(x + dx - h * 0.3, y0 + h);
        k.lineTo(x + dx, y0);
        k.lineTo(x + dx + h * 0.3, y0 + h);
        k.fill();
      });
    }
    // Felsen im fernen Hang.
    for (let i = 0; i < 6; i += 1) {
      const x = z() * W;
      const y = kammA(x) + H * (0.02 + z() * 0.06);
      const b = W * (0.02 + z() * 0.03);
      rundum(W, (dx) => {
        k.fillStyle = rgba(pal.fels, 0.55);
        k.beginPath();
        k.moveTo(x + dx - b, y + b * 0.5);
        k.lineTo(x + dx - b * 0.2, y - b * 0.2);
        k.lineTo(x + dx + b * 0.6, y + b * 0.1);
        k.lineTo(x + dx + b, y + b * 0.6);
        k.closePath();
        k.fill();
      });
    }
    // Der nahe Hang.
    k.fillStyle = rgb(pal.nah);
    k.beginPath();
    k.moveTo(0, H);
    for (let x = 0; x <= W; x += 3) k.lineTo(x, kammB(x));
    k.lineTo(W, H);
    k.closePath();
    k.fill();
    k.strokeStyle = rgba(pal.nahLicht, 0.5);
    k.lineWidth = 1;
    k.beginPath();
    for (let x = 0; x <= W; x += 3) { if (x) k.lineTo(x, kammB(x) + 0.5); else k.moveTo(x, kammB(x) + 0.5); }
    k.stroke();
    // Wald: Arven dunkel, dazwischen die goldenen Lärchen.
    for (let x = 0; x < W; x += 1.6) {
      const y0 = kammB(x) + 1 + z() * H * 0.16;
      if (z() < 0.25) continue;
      const laerche = z() < 0.34;
      const h = H * (0.035 + z() * 0.04);
      rundum(W, (dx) => {
        k.fillStyle = laerche ? rgba(pal.laerche, 0.85) : rgba(pal.baum, 0.95);
        k.beginPath();
        k.moveTo(x + dx - h * 0.28, y0 + h);
        k.lineTo(x + dx, y0);
        k.lineTo(x + dx + h * 0.28, y0 + h);
        k.fill();
      });
    }
    // Eine Alphütte mit Licht im Fenster und Rauch, und eine Kapelle.
    const huette = W * 0.27;
    const kapelle = W * 0.71;
    rundum(W, (dx) => {
      const hx = huette + dx;
      const hy = kammB(huette) + H * 0.05;
      const b = H * 0.075;
      k.fillStyle = rgb(pal.huette);
      k.fillRect(hx - b * 0.6, hy - b * 0.45, b * 1.2, b * 0.55);
      k.fillStyle = rgb(pal.dach);
      k.beginPath();
      k.moveTo(hx - b * 0.8, hy - b * 0.42);
      k.lineTo(hx, hy - b * 0.95);
      k.lineTo(hx + b * 0.8, hy - b * 0.42);
      k.closePath();
      k.fill();
      k.fillStyle = rgb(pal.fenster);
      k.fillRect(hx + b * 0.12, hy - b * 0.3, b * 0.22, b * 0.18);
      const schein = k.createRadialGradient(hx + b * 0.23, hy - b * 0.21, 0, hx + b * 0.23, hy - b * 0.21, b * 0.9);
      schein.addColorStop(0, rgba(pal.fenster, 0.4));
      schein.addColorStop(1, rgba(pal.fenster, 0));
      k.fillStyle = schein;
      k.fillRect(hx - b, hy - b * 1.2, b * 2.4, b * 2);
      k.strokeStyle = rgba(pal.rauch, 0.35);
      k.lineWidth = b * 0.12;
      k.lineCap = "round";
      k.beginPath();
      k.moveTo(hx - b * 0.35, hy - b * 0.8);
      k.bezierCurveTo(hx - b * 0.1, hy - b * 1.6, hx - b * 0.8, hy - b * 2.1, hx - b * 0.2, hy - b * 2.9);
      k.stroke();
      // Die Kapelle: weiss, mit spitzem Turm.
      const kx = kapelle + dx;
      const ky = kammB(kapelle) + H * 0.035;
      const c = H * 0.06;
      k.fillStyle = rgb(pal.kapelle);
      k.fillRect(kx - c * 0.55, ky - c * 0.5, c * 1.1, c * 0.6);
      k.fillRect(kx + c * 0.25, ky - c * 1.05, c * 0.32, c * 0.6);
      k.fillStyle = rgb(pal.dach);
      k.beginPath();
      k.moveTo(kx - c * 0.65, ky - c * 0.48);
      k.lineTo(kx - c * 0.1, ky - c * 0.85);
      k.lineTo(kx + c * 0.45, ky - c * 0.48);
      k.closePath();
      k.fill();
      k.beginPath();
      k.moveTo(kx + c * 0.2, ky - c * 1.03);
      k.lineTo(kx + c * 0.41, ky - c * 1.55);
      k.lineTo(kx + c * 0.62, ky - c * 1.03);
      k.closePath();
      k.fill();
    });
    // Nebel in den Senken, unten dicht – und darunter, bis zum Weg, das Tal
    // im Nebel (deckend: Hinter dem Hang muss kein Himmel mehr liegen).
    const tal = H;
    const nebel = k.createLinearGradient(0, H * 0.55, 0, tal);
    nebel.addColorStop(0, rgba(pal.nebel, 0));
    nebel.addColorStop(0.6, rgba(pal.nebel, 0.38));
    nebel.addColorStop(1, rgba(pal.nebel, 0.78));
    k.fillStyle = nebel;
    k.fillRect(0, H * 0.55, W, tal - H * 0.55);
    if (pal.unterTal) {
      k.fillStyle = rgb(mix3(pal.nah, pal.nebel, 0.78));
      k.fillRect(0, tal, W, voll - tal);
    }
  }

  const WALD_TAG = {
    laerche: [202, 150, 92], laercheLicht: [246, 196, 126], arve: [30, 56, 56], arveLicht: [86, 118, 104],
    stamm: [70, 56, 80], wiese: [92, 84, 124], nebel: [238, 200, 198], funken: null,
  };
  const WALD_NACHT = {
    laerche: [20, 38, 66], laercheLicht: [80, 200, 226], arve: [8, 16, 38], arveLicht: [56, 150, 196],
    stamm: [8, 14, 30], wiese: [8, 16, 36], nebel: [16, 44, 84], funken: [160, 255, 240],
  };

  // Lärchen und Arven gleich hinter dem Weg. Ihr Fuss liegt unten im
  // Streifen (vom Ufer verdeckt). Das Licht kommt von links.
  const WALD_SCHILF = {
    laerche: [214, 170, 92], laercheLicht: [255, 222, 150], arve: [70, 96, 70], arveLicht: [170, 196, 120],
    stamm: [92, 70, 66], wiese: [130, 118, 96], nebel: [252, 226, 186], funken: null,
    schilf: [196, 158, 86], schilfLicht: [255, 224, 150], kolben: [110, 70, 52], holz: [120, 86, 70], dach: [92, 66, 62], boot: [150, 76, 58],
  };
  const WALD_FELS = {
    laerche: [72, 104, 82], laercheLicht: [170, 204, 150], arve: [36, 62, 56], arveLicht: [110, 150, 120],
    stamm: [150, 92, 76], wiese: [96, 104, 110], nebel: [222, 232, 242], funken: null,
    fels: [124, 122, 142], felsLicht: [232, 212, 192], felsDunkel: [70, 72, 96], wasser: [246, 252, 255], farn: [96, 136, 84],
  };
  const WALD_EIS = {
    laerche: [56, 84, 82], laercheLicht: [176, 206, 210], arve: [40, 62, 66], arveLicht: [140, 178, 190],
    stamm: [84, 70, 72], wiese: [214, 228, 240], nebel: [234, 244, 252], funken: null,
    eis: [170, 218, 248], eisLicht: [246, 252, 255], eisTief: [90, 150, 206], schnee: [250, 252, 255], fels: [118, 124, 144],
  };

  function maleWald(k, W, H, pal, s, art = "laerchen") {
    if (art === "schilf") maleWaldSchilf(k, W, H, pal, s);
    else if (art === "fels") maleWaldFels(k, W, H, pal, s);
    else if (art === "eis") maleWaldEis(k, W, H, pal, s);
    else maleWaldLaerchen(k, W, H, pal, s);
  }

  // Lichter in den Zweigen, im erwachten See.
  function waldFunken(k, bx, top, hoch, saat, pal, s) {
    if (!pal.funken || hash01(saat * 7) >= 0.5) return;
    for (let i = 0; i < 3; i += 1) {
      const fx = bx + (hash01(saat * 3 + i) - 0.5) * hoch * 0.3;
      const fy = top + hoch * (0.2 + hash01(saat * 5 + i) * 0.6);
      const fr = Math.max(0.6, s * 0.7);
      const schein = k.createRadialGradient(fx, fy, 0, fx, fy, fr * 5);
      schein.addColorStop(0, rgba(pal.funken, 0.6));
      schein.addColorStop(1, rgba(pal.funken, 0));
      k.fillStyle = schein;
      k.fillRect(fx - fr * 5, fy - fr * 5, fr * 10, fr * 10);
      k.fillStyle = rgb(pal.funken);
      k.fillRect(fx - fr * 0.5, fy - fr * 0.5, fr, fr);
    }
  }

  function waldNebel(k, W, H, pal) {
    const nebel = k.createLinearGradient(0, H * 0.45, 0, H);
    nebel.addColorStop(0, rgba(pal.nebel, 0));
    nebel.addColorStop(0.7, rgba(pal.nebel, pal.funken ? 0.3 : 0.45));
    nebel.addColorStop(1, rgba(pal.nebel, pal.funken ? 0.55 : 0.8));
    k.fillStyle = nebel;
    k.fillRect(0, H * 0.45, W, H * 0.55);
  }

  // Der Schilfgürtel: hohes Schilf mit Rohrkolben, Weiden, ein Bootshaus auf
  // Pfählen und ein Bootssteg mit einem Ruderboot. Das Licht kommt von links.
  function maleWaldSchilf(k, W, H, pal, s) {
    const z = wuerfel(7741);
    k.fillStyle = rgb(pal.wiese);
    k.fillRect(0, H * 0.9, W, H * 0.1);
    // Weiden: runde Kronen mit hängenden Ruten.
    for (let i = 0; i < 5; i += 1) {
      const x = W * (0.08 + i * 0.2 + z() * 0.08);
      const hoch = H * (0.6 + z() * 0.3);
      const r = hoch * 0.36;
      const saat = z();
      rundum(W, (dx) => {
        const bx = x + dx;
        const top = H + 2 - hoch;
        k.strokeStyle = rgb(pal.stamm);
        k.lineWidth = Math.max(1, hoch * 0.03);
        k.beginPath();
        k.moveTo(bx, H + 2);
        k.quadraticCurveTo(bx - r * 0.1, top + hoch * 0.6, bx + r * 0.05, top + r);
        k.stroke();
        k.fillStyle = rgb(pal.arve);
        k.beginPath();
        k.ellipse(bx, top + r, r * 1.15, r, 0, 0, TAU);
        k.fill();
        k.strokeStyle = rgba(pal.arveLicht, 0.65);
        k.lineWidth = Math.max(0.6, s * 0.4);
        k.beginPath();
        for (let j = 0; j < 22; j += 1) {
          const u = j / 21;
          const rx = bx + (u - 0.5) * r * 2.1;
          const ry = top + r * (0.4 + 0.6 * Math.sin(u * Math.PI) * 0.3);
          k.moveTo(rx, ry);
          k.quadraticCurveTo(rx - r * 0.06, ry + r * 0.8, rx - r * 0.02 + hash01(saat + j) * 2, ry + r * (1.2 + hash01(saat * 3 + j) * 0.5));
        }
        k.stroke();
        waldFunken(k, bx, top, hoch, saat, pal, s);
      });
    }
    // Ein Bootshaus auf Pfählen und ein Steg mit einem Ruderboot.
    const hx = W * 0.62;
    rundum(W, (dx) => {
      const x = hx + dx;
      const b = H * 0.5;
      const boden = H * 0.82;
      k.fillStyle = rgb(pal.holz);
      for (let i = 0; i < 5; i += 1) k.fillRect(x - b * 0.5 + i * b * 0.25, boden, Math.max(1, b * 0.035), H - boden + 2);
      k.fillStyle = rgb(mix3(pal.holz, pal.dach, 0.3));
      k.fillRect(x - b * 0.55, boden - b * 0.5, b * 1.1, b * 0.52);
      k.strokeStyle = rgba(pal.dach, 0.6);
      k.lineWidth = 1;
      k.beginPath();
      for (let i = 1; i < 10; i += 1) { k.moveTo(x - b * 0.55 + i * b * 0.11, boden - b * 0.5); k.lineTo(x - b * 0.55 + i * b * 0.11, boden); }
      k.stroke();
      k.fillStyle = rgba([24, 16, 20], 0.85);
      k.fillRect(x - b * 0.2, boden - b * 0.36, b * 0.4, b * 0.36);
      k.fillStyle = rgb(pal.dach);
      k.beginPath();
      k.moveTo(x - b * 0.7, boden - b * 0.48);
      k.lineTo(x, boden - b * 0.95);
      k.lineTo(x + b * 0.7, boden - b * 0.48);
      k.closePath();
      k.fill();
      k.fillStyle = rgba(pal.laercheLicht, 0.5);
      k.beginPath();
      k.moveTo(x - b * 0.7, boden - b * 0.48);
      k.lineTo(x, boden - b * 0.95);
      k.lineTo(x - b * 0.05, boden - b * 0.88);
      k.lineTo(x - b * 0.62, boden - b * 0.46);
      k.closePath();
      k.fill();
      // Der Steg daneben, ein Boot daran.
      k.fillStyle = rgb(pal.holz);
      k.fillRect(x + b * 0.55, boden + b * 0.04, b * 0.9, b * 0.05);
      for (let i = 0; i < 4; i += 1) k.fillRect(x + b * 0.6 + i * b * 0.28, boden + b * 0.04, Math.max(1, b * 0.03), H - boden);
      k.fillStyle = rgb(pal.boot);
      k.beginPath();
      k.moveTo(x + b * 0.75, boden + b * 0.13);
      k.lineTo(x + b * 1.4, boden + b * 0.13);
      k.quadraticCurveTo(x + b * 1.3, boden + b * 0.26, x + b * 1.05, boden + b * 0.26);
      k.quadraticCurveTo(x + b * 0.8, boden + b * 0.25, x + b * 0.75, boden + b * 0.13);
      k.fill();
      waldFunken(k, x, boden - b, b, 0.3, pal, s);
    });
    // Das Schilf: dichte Halme mit Blättern, golden im Gegenlicht, Kolben.
    for (let x = 0; x < W; x += 1.1) {
      if (z() < 0.12) continue;
      const hoch = H * (0.3 + z() ** 1.4 * 0.45);
      const neig = (z() - 0.4) * hoch * 0.12;
      const hell = z();
      const kolben = z() < 0.12;
      rundum(W, (dx) => {
        const bx = x + dx;
        k.strokeStyle = rgba(hell < 0.35 ? pal.schilfLicht : pal.schilf, 0.95);
        k.lineWidth = Math.max(0.6, s * 0.3);
        k.beginPath();
        k.moveTo(bx, H + 2);
        k.quadraticCurveTo(bx + neig * 0.2, H - hoch * 0.5, bx + neig, H + 2 - hoch);
        k.stroke();
        if (hell > 0.6) {
          k.beginPath();
          k.moveTo(bx + neig * 0.1, H - hoch * 0.3);
          k.quadraticCurveTo(bx + neig * 0.6 + hoch * 0.1, H - hoch * 0.45, bx + hoch * 0.18, H - hoch * 0.25);
          k.stroke();
        }
        if (kolben) {
          k.strokeStyle = rgb(pal.kolben);
          k.lineWidth = Math.max(1.4, s * 0.9);
          k.beginPath();
          k.moveTo(bx + neig * 0.92, H + 2 - hoch * 0.92);
          k.lineTo(bx + neig * 0.97, H + 2 - hoch * 0.8);
          k.stroke();
        }
      });
    }
    waldNebel(k, W, H, pal);
  }

  // Das Felsufer: Blöcke und Wände, Föhren mit rotem Stamm und flachen
  // Kronen, Farn, ein Bach, der über die Steine fällt.
  function maleWaldFels(k, W, H, pal, s) {
    const z = wuerfel(8863);
    k.fillStyle = rgb(pal.wiese);
    k.fillRect(0, H * 0.88, W, H * 0.12);
    // Felsblöcke und Wände.
    for (let i = 0; i < 9; i += 1) {
      const x = z() * W;
      const b = W * (0.04 + z() * 0.07);
      const h = H * (0.2 + z() * 0.45);
      rundum(W, (dx) => {
        const bx = x + dx;
        k.fillStyle = rgb(pal.fels);
        k.beginPath();
        k.moveTo(bx - b, H + 2);
        k.lineTo(bx - b * 0.85, H - h * 0.7);
        k.lineTo(bx - b * 0.3, H - h);
        k.lineTo(bx + b * 0.5, H - h * 0.92);
        k.lineTo(bx + b, H - h * 0.4);
        k.lineTo(bx + b, H + 2);
        k.closePath();
        k.fill();
        k.fillStyle = rgba(pal.felsLicht, 0.55);
        k.beginPath();
        k.moveTo(bx - b * 0.85, H - h * 0.7);
        k.lineTo(bx - b * 0.3, H - h);
        k.lineTo(bx - b * 0.2, H - h * 0.8);
        k.lineTo(bx - b * 0.7, H - h * 0.5);
        k.closePath();
        k.fill();
        k.fillStyle = rgba(pal.felsDunkel, 0.6);
        k.beginPath();
        k.moveTo(bx + b * 0.5, H - h * 0.92);
        k.lineTo(bx + b, H - h * 0.4);
        k.lineTo(bx + b, H + 2);
        k.lineTo(bx + b * 0.4, H + 2);
        k.closePath();
        k.fill();
        // Ein Mittelton, Risse, Moos in den Fugen.
        k.fillStyle = rgba(mix3(pal.fels, pal.felsDunkel, 0.3), 0.6);
        k.beginPath();
        k.moveTo(bx - b * 0.2, H - h * 0.8);
        k.lineTo(bx + b * 0.5, H - h * 0.92);
        k.lineTo(bx + b * 0.4, H + 2);
        k.lineTo(bx - b * 0.1, H + 2);
        k.closePath();
        k.fill();
        k.strokeStyle = rgba(pal.felsDunkel, 0.7);
        k.lineWidth = Math.max(0.6, s * 0.4);
        k.beginPath();
        k.moveTo(bx - b * 0.1, H - h * 0.85);
        k.lineTo(bx + b * 0.05, H - h * 0.5);
        k.lineTo(bx - b * 0.05, H - h * 0.2);
        k.moveTo(bx + b * 0.6, H - h * 0.7);
        k.lineTo(bx + b * 0.75, H - h * 0.35);
        k.stroke();
        k.fillStyle = rgba(pal.farn, 0.7);
        k.beginPath();
        k.ellipse(bx - b * 0.45, H - h * 0.78, b * 0.25, h * 0.04, -0.3, 0, TAU);
        k.fill();
      });
    }
    // Ein Bach, der über die Blöcke fällt.
    const bach = W * 0.43;
    rundum(W, (dx) => {
      k.strokeStyle = rgba(pal.wasser, 0.85);
      k.lineWidth = Math.max(1.5, H * 0.025);
      k.beginPath();
      k.moveTo(bach + dx, H * 0.35);
      k.bezierCurveTo(bach + dx + H * 0.03, H * 0.55, bach + dx - H * 0.04, H * 0.75, bach + dx + H * 0.02, H + 2);
      k.stroke();
      k.strokeStyle = rgba(pal.wasser, 0.4);
      k.lineWidth = Math.max(3, H * 0.06);
      k.stroke();
    });
    // Föhren: rötlicher Stamm, Kronen in flachen, dunklen Ballen.
    for (let i = 0; i < 12; i += 1) {
      const x = z() * W;
      const hoch = H * (0.5 + z() * 0.5);
      const saat = z();
      rundum(W, (dx) => {
        const bx = x + dx;
        const top = H + 2 - hoch;
        k.strokeStyle = rgb(pal.stamm);
        k.lineWidth = Math.max(1, hoch * 0.025);
        k.beginPath();
        k.moveTo(bx, H + 2);
        k.quadraticCurveTo(bx + hoch * 0.04, top + hoch * 0.5, bx - hoch * 0.02, top + hoch * 0.1);
        k.stroke();
        // Die Krone: Ballen an kurzen Ästen, in Stockwerken, unregelmässig.
        for (let j = 0; j < 4; j += 1) {
          const f = j / 3;
          const cx = bx + (hash01(saat * 9 + j) - 0.5) * hoch * 0.3;
          const cy = top + hoch * (0.06 + f * 0.36);
          const rx = hoch * (0.16 - f * 0.03);
          k.strokeStyle = rgb(pal.stamm);
          k.lineWidth = Math.max(0.6, hoch * 0.012);
          k.beginPath();
          k.moveTo(bx, cy + rx * 0.4);
          k.lineTo(cx, cy);
          k.stroke();
          for (let m = 0; m < 4; m += 1) {
            const u = (m / 3 - 0.5) * 1.6;
            const r = rx * (0.42 + hash01(saat * 31 + j * 4 + m) * 0.2);
            const px = cx + u * rx * 0.62;
            const py = cy + Math.abs(u) * rx * 0.08 - hash01(saat * 7 + m + j) * rx * 0.1;
            k.fillStyle = rgb(pal.arve);
            k.beginPath();
            k.ellipse(px, py, r, r * 0.55, 0, 0, TAU);
            k.fill();
            k.fillStyle = rgba(pal.arveLicht, 0.45);
            k.beginPath();
            k.ellipse(px - r * 0.3, py - r * 0.2, r * 0.5, r * 0.22, 0, 0, TAU);
            k.fill();
          }
        }
        waldFunken(k, bx, top, hoch, saat, pal, s);
      });
    }
    // Farn am Fuss.
    for (let x = 0; x < W; x += 4) {
      if (z() < 0.4) continue;
      const h = H * (0.06 + z() * 0.06);
      rundum(W, (dx) => {
        k.strokeStyle = rgba(pal.farn, 0.9);
        k.lineWidth = Math.max(0.6, s * 0.35);
        k.beginPath();
        for (let j = -2; j <= 2; j += 1) {
          k.moveTo(x + dx, H + 1);
          k.quadraticCurveTo(x + dx + j * h * 0.3, H - h, x + dx + j * h * 0.6, H - h * 0.7);
        }
        k.stroke();
      });
    }
    waldNebel(k, W, H, pal);
  }

  // Der Gletschersee: verschneite Blöcke, Seracs aus Eis mit blauen
  // Schatten, Legföhren unter Schnee, Steinmänner.
  function maleWaldEis(k, W, H, pal, s) {
    const z = wuerfel(9967);
    k.fillStyle = rgb(pal.wiese);
    k.fillRect(0, H * 0.86, W, H * 0.14);
    // Seracs: Blöcke aus Eis, schräg gebrochen.
    for (let i = 0; i < 8; i += 1) {
      const x = z() * W;
      const b = W * (0.03 + z() * 0.05);
      const h = H * (0.25 + z() * 0.45);
      const kipp = (z() - 0.5) * b * 0.6;
      rundum(W, (dx) => {
        const bx = x + dx;
        k.fillStyle = rgb(pal.eis);
        k.beginPath();
        k.moveTo(bx - b, H + 2);
        k.lineTo(bx - b * 0.9 + kipp, H - h);
        k.lineTo(bx + b * 0.6 + kipp, H - h * 1.05);
        k.lineTo(bx + b, H + 2);
        k.closePath();
        k.fill();
        k.fillStyle = rgba(pal.eisTief, 0.55);
        k.beginPath();
        k.moveTo(bx + b * 0.2 + kipp, H - h * 1.02);
        k.lineTo(bx + b * 0.6 + kipp, H - h * 1.05);
        k.lineTo(bx + b, H + 2);
        k.lineTo(bx + b * 0.3, H + 2);
        k.closePath();
        k.fill();
        k.fillStyle = rgba(pal.eisLicht, 0.9);
        k.beginPath();
        k.moveTo(bx - b * 0.9 + kipp, H - h);
        k.lineTo(bx + b * 0.6 + kipp, H - h * 1.05);
        k.lineTo(bx + b * 0.5 + kipp, H - h * 0.97);
        k.lineTo(bx - b * 0.85 + kipp, H - h * 0.93);
        k.closePath();
        k.fill();
      });
    }
    // Verschneite Felsblöcke und Steinmänner.
    for (let i = 0; i < 10; i += 1) {
      const x = z() * W;
      const r = H * (0.05 + z() * 0.09);
      const mann = z() < 0.3;
      rundum(W, (dx) => {
        const bx = x + dx;
        if (mann) {
          for (let j = 0; j < 4; j += 1) {
            const rr = r * (0.5 - j * 0.09);
            const y = H - r * 0.2 - j * r * 0.55;
            k.fillStyle = rgb(pal.fels);
            k.beginPath();
            k.ellipse(bx + (j % 2) * rr * 0.2, y, rr, rr * 0.5, 0, 0, TAU);
            k.fill();
            k.fillStyle = rgba(pal.schnee, 0.9);
            k.beginPath();
            k.ellipse(bx + (j % 2) * rr * 0.2, y - rr * 0.35, rr * 0.8, rr * 0.2, 0, 0, TAU);
            k.fill();
          }
          return;
        }
        k.fillStyle = rgb(pal.fels);
        k.beginPath();
        k.ellipse(bx, H, r * 1.3, r, 0, Math.PI, TAU);
        k.fill();
        k.fillStyle = rgba(pal.schnee, 0.95);
        k.beginPath();
        k.ellipse(bx - r * 0.1, H - r * 0.75, r * 1.05, r * 0.38, 0, 0, TAU);
        k.fill();
      });
    }
    // Legföhren unter Schnee.
    for (let i = 0; i < 9; i += 1) {
      const x = z() * W;
      const hoch = H * (0.2 + z() * 0.25);
      const saat = z();
      rundum(W, (dx) => {
        const bx = x + dx;
        for (let j = 0; j < 3; j += 1) {
          const y = H + 2 - hoch * (0.3 + j * 0.3);
          const b = hoch * (0.45 - j * 0.12);
          k.fillStyle = rgb(pal.arve);
          k.beginPath();
          k.moveTo(bx - b, y + hoch * 0.18);
          k.lineTo(bx, y - hoch * 0.15);
          k.lineTo(bx + b, y + hoch * 0.18);
          k.closePath();
          k.fill();
          k.fillStyle = rgba(pal.schnee, 0.9);
          k.beginPath();
          k.moveTo(bx - b * 0.8, y + hoch * 0.1);
          k.lineTo(bx, y - hoch * 0.15);
          k.lineTo(bx + b * 0.6, y + hoch * 0.06);
          k.lineTo(bx, y - hoch * 0.05);
          k.closePath();
          k.fill();
        }
        waldFunken(k, bx, H - hoch, hoch, saat, pal, s);
      });
    }
    waldNebel(k, W, H, pal);
  }

  function maleWaldLaerchen(k, W, H, pal, s) {
    const z = wuerfel(8831);
    const baeume = [];
    let x = 0;
    while (x < W) {
      const laerche = z() < 0.62;
      baeume.push({ x, laerche, hoch: H * lerp(0.42, 0.98, z() ** 0.8), breit: lerp(0.15, 0.22, z()), saat: z(), nah: z() });
      x += W * lerp(0.03, 0.09, z());
    }
    baeume.sort((a, b) => a.nah - b.nah);
    // Eine Wiese ganz unten, im Nebel.
    k.fillStyle = rgb(pal.wiese);
    k.fillRect(0, H * 0.9, W, H * 0.1);
    baeume.forEach((b) => rundum(W, (dx) => {
      const bx = b.x + dx;
      const fuss = H + 2;
      const top = fuss - b.hoch;
      const dunst = (1 - b.nah) * 0.35;
      const nebel = pal.nebel;
      k.strokeStyle = rgb(mix3(pal.stamm, nebel, dunst));
      k.lineWidth = Math.max(0.8, b.hoch * 0.022);
      k.beginPath();
      k.moveTo(bx, fuss);
      k.lineTo(bx, top + b.hoch * 0.05);
      k.stroke();
      if (b.laerche) {
        // Die Lärche: schlank, mit hängenden Zweigen in vielen Stufen,
        // golden; links im Licht.
        const stufen = 12;
        for (let i = 0; i < stufen; i += 1) {
          const f = i / (stufen - 1);
          const y = top + b.hoch * (0.03 + f * 0.86);
          const w = b.hoch * b.breit * (0.12 + f * 0.88) * (0.75 + hash01(b.saat * 31 + i) * 0.5);
          const fall = b.hoch * (0.05 + f * 0.035);
          const zweig = (x0, rand) => {
            k.beginPath();
            k.moveTo(bx, y - fall * 0.2);
            k.quadraticCurveTo(bx + (x0 - bx) * 0.55, y - fall * 0.35, x0, y + fall * rand);
            k.quadraticCurveTo(bx + (x0 - bx) * 0.5, y + fall * 0.55, bx, y + fall * 0.45);
            k.closePath();
          };
          k.fillStyle = rgb(mix3(pal.laerche, nebel, dunst));
          zweig(bx - w, 1);
          k.fill();
          zweig(bx + w * 0.92, 1.1);
          k.fill();
          k.fillStyle = rgba(mix3(pal.laercheLicht, nebel, dunst), 0.8);
          zweig(bx - w * 0.85, 0.7);
          k.fill();
        }
      } else {
        // Die Arve: dunkel, dicht, mit Büscheln an den Enden der Äste, die
        // in Stockwerken stehen; oben breit und rund. Links im Licht.
        const stock = 8;
        const buschel = [];
        for (let i = 0; i < stock; i += 1) {
          const f = i / (stock - 1);
          const y = top + b.hoch * (0.07 + f * 0.72);
          const w = b.hoch * b.breit * (0.45 + 0.55 * Math.sin(Math.min(1, f * 1.2 + 0.25) * Math.PI * 0.75)) * 1.1;
          const r = b.hoch * (0.05 + hash01(b.saat * 13 + i) * 0.025);
          buschel.push([bx - w * (0.6 + hash01(b.saat * 7 + i) * 0.4), y, r]);
          buschel.push([bx + w * (0.55 + hash01(b.saat * 11 + i) * 0.45), y + r * 0.3, r * 0.95]);
          buschel.push([bx + (hash01(b.saat * 19 + i) - 0.5) * w * 0.5, y - r * 0.4, r * 1.1]);
        }
        k.strokeStyle = rgb(mix3(pal.stamm, nebel, dunst));
        k.lineWidth = Math.max(0.6, b.hoch * 0.01);
        k.beginPath();
        buschel.forEach(([x2, y]) => { k.moveTo(bx, y + b.hoch * 0.03); k.lineTo(x2, y); });
        k.stroke();
        // Jedes Büschel aus ein paar runden Nadelballen, unregelmässig.
        const ballen = [];
        buschel.forEach(([x2, y, r], i) => {
          for (let j = 0; j < 4; j += 1) {
            const q = hash01(b.saat * 41 + i * 4.1 + j * 1.7);
            const q2 = hash01(b.saat * 23 + i * 2.9 + j * 3.1);
            ballen.push([x2 + (q - 0.5) * r * 2.4, y + (q2 - 0.55) * r * 1.1, r * (0.5 + hash01(i * 5.3 + j + b.saat) * 0.35)]);
          }
        });
        k.fillStyle = rgb(mix3(pal.arve, nebel, dunst * 0.7));
        k.beginPath();
        ballen.forEach(([x2, y, r]) => { k.moveTo(x2 + r, y); k.arc(x2, y, r, 0, TAU); });
        k.fill();
        k.fillStyle = rgba(mix3(pal.arveLicht, nebel, dunst * 0.7), 0.55);
        k.beginPath();
        ballen.forEach(([x2, y, r]) => {
          if (x2 > bx + b.hoch * 0.04) return;
          k.moveTo(x2 - r * 0.25 + r * 0.6, y - r * 0.35);
          k.arc(x2 - r * 0.25, y - r * 0.35, r * 0.6, 0, TAU);
        });
        k.fill();
      }
      if (pal.funken && hash01(b.saat * 7) < 0.5) {
        // In der Nacht des Sees: Lichter in den Zweigen.
        for (let i = 0; i < 3; i += 1) {
          const fx = bx + (hash01(b.saat * 3 + i) - 0.5) * b.hoch * 0.3;
          const fy = top + b.hoch * (0.2 + hash01(b.saat * 5 + i) * 0.6);
          const fr = Math.max(0.6, s * 0.7);
          const schein = k.createRadialGradient(fx, fy, 0, fx, fy, fr * 5);
          schein.addColorStop(0, rgba(pal.funken, 0.6));
          schein.addColorStop(1, rgba(pal.funken, 0));
          k.fillStyle = schein;
          k.fillRect(fx - fr * 5, fy - fr * 5, fr * 10, fr * 10);
          k.fillStyle = rgb(pal.funken);
          k.fillRect(fx - fr * 0.5, fy - fr * 0.5, fr, fr);
        }
      }
    }));
    // Nebel zwischen den Stämmen, unten dicht.
    const nebel = k.createLinearGradient(0, H * 0.45, 0, H);
    nebel.addColorStop(0, rgba(pal.nebel, 0));
    nebel.addColorStop(0.7, rgba(pal.nebel, pal.funken ? 0.3 : 0.45));
    nebel.addColorStop(1, rgba(pal.nebel, pal.funken ? 0.55 : 0.8));
    k.fillStyle = nebel;
    k.fillRect(0, H * 0.45, W, H * 0.55);
  }

  // Das Ufer: oben der Weg (pfadY), ein heller Kiesweg im Reif, darunter
  // die Uferkante aus Steinen bis zum Wasser (wlY), darunter ihr
  // Spiegelbild. PERIODE Einheiten breit. Nichts davon ragt über den Weg
  // hinaus, was man für ein Hindernis halten könnte.
  // Das Ufer je Landschaft: Kies im Reif am Lärchenufer, ein Bohlenweg
  // durchs Schilf, Platten aus Fels, Schnee über Eis am Gletscher.
  const UFER_FARBE = {
    kies: { bank: [52, 42, 72], stein: [[74, 64, 98], [128, 112, 142]], glanz: [246, 188, 176], reif: [236, 242, 255], weg: [[236, 216, 212], [178, 152, 170]], korn: [[120, 96, 124], [255, 250, 250]], gras: [176, 160, 198], nass: [24, 18, 44] },
    sand: { bank: [92, 74, 66], stein: [[142, 112, 96], [196, 166, 132]], glanz: [255, 214, 170], reif: null, weg: [[214, 170, 120], [150, 106, 78]], korn: [[110, 76, 58], [255, 226, 180]], gras: [214, 176, 96], nass: [44, 30, 30], bohlen: true },
    fels: { bank: [56, 58, 82], stein: [[80, 84, 108], [150, 150, 168]], glanz: [236, 214, 196], reif: null, weg: [[200, 194, 204], [138, 134, 152]], korn: [[96, 92, 110], [240, 236, 236]], gras: [110, 146, 96], nass: [22, 24, 44], platten: true },
    schnee: { bank: [122, 156, 196], stein: [[168, 208, 238], [222, 242, 255]], glanz: [255, 255, 255], reif: [255, 255, 255], weg: [[252, 253, 255], [196, 214, 236]], korn: [[150, 180, 214], [255, 255, 255]], gras: null, nass: [40, 80, 130], zapfen: true },
  };
  function maleUfer(k, W, H, pfadY, wlY, nacht, art = "kies", saum = [120, 240, 255]) {
    const s = W / PERIODE;
    const z = wuerfel(9127);
    const bank = wlY - pfadY;
    const U = UFER_FARBE[art];
    k.fillStyle = rgb(U.bank);
    k.fillRect(0, pfadY, W, bank);
    // Die Steine der Kante, dicht an dicht, im Licht von links.
    const steine = [];
    let x = 0;
    while (x < W) {
      const r = (1.4 + z() * 2) * s;
      const y = clamp(pfadY + bank * (0.4 + z() * 0.5), pfadY + r * 0.75 + 0.6 * s, wlY + r * 0.2);
      steine.push({ x: x + r, r, y, hell: z(), flach: 0.6 + z() * 0.25 });
      x += r * (1.25 + z() * 0.8);
    }
    steine.forEach((st) => rundum(W, (dx) => {
      const c = mix3(U.stein[0], U.stein[1], st.hell);
      k.fillStyle = rgb(c);
      k.beginPath();
      k.ellipse(st.x + dx, st.y, st.r * 1.2, st.r * st.flach, 0, 0, TAU);
      k.fill();
      k.fillStyle = rgba(U.glanz, 0.45);
      k.beginPath();
      k.ellipse(st.x + dx - st.r * 0.35, st.y - st.r * st.flach * 0.4, st.r * 0.62, st.r * st.flach * 0.38, -0.2, 0, TAU);
      k.fill();
      if (U.reif) {
        k.fillStyle = rgba(U.reif, 0.55);
        k.fillRect(st.x + dx - st.r * 0.6, st.y - st.r * st.flach * 0.92, st.r * 0.9, Math.max(0.6, s * 0.35));
      }
    }));
    // Nass und dunkel, wo das Wasser die Steine berührt.
    const nass = k.createLinearGradient(0, wlY - bank * 0.35, 0, wlY);
    nass.addColorStop(0, rgba(U.nass, 0));
    nass.addColorStop(1, rgba(U.nass, 0.7));
    k.fillStyle = nass;
    k.fillRect(0, wlY - bank * 0.35, W, bank * 0.35);
    if (U.zapfen) {
      // Am Gletschersee hängen Zapfen über dem Wasser.
      k.fillStyle = "rgba(236, 248, 255, 0.9)";
      for (let x2 = 0; x2 < W; x2 += 2.4 * s) {
        const lang = (0.6 + hash01(x2 * 0.7) * 1.6) * s;
        k.beginPath();
        k.moveTo(x2, wlY - 0.6 * s);
        k.lineTo(x2 + 0.5 * s, wlY - 0.6 * s + lang);
        k.lineTo(x2 + 1 * s, wlY - 0.6 * s);
        k.fill();
      }
    }
    // Der Weg: heller Kies im Reif (oder Bohlen, Fels, Schnee), mit Körnern.
    const dick = Math.max(1.4, 1.3 * s);
    const weg = k.createLinearGradient(0, pfadY - dick * 0.5, 0, pfadY + dick);
    weg.addColorStop(0, rgb(U.weg[0]));
    weg.addColorStop(1, rgb(U.weg[1]));
    k.fillStyle = weg;
    k.fillRect(0, pfadY - dick * 0.5, W, dick * 1.5);
    if (U.bohlen) {
      // Bohlen mit Fugen, quer zum Weg, einzelne heller.
      for (let x2 = 0; x2 < W; x2 += 2.2 * s) {
        k.fillStyle = hash01(x2 * 0.31) < 0.3 ? rgba([255, 226, 176], 0.25) : rgba([70, 46, 40], 0.12);
        k.fillRect(x2, pfadY - dick * 0.5, 2.2 * s, dick * 1.5);
        k.fillStyle = "rgba(60, 38, 34, 0.55)";
        k.fillRect(x2, pfadY - dick * 0.5, Math.max(0.5, s * 0.18), dick * 1.5);
      }
    }
    if (U.platten) {
      // Fugen zwischen Platten aus Fels.
      k.fillStyle = "rgba(60, 58, 80, 0.55)";
      for (let x2 = 0; x2 < W; x2 += (6 + hash01(x2) * 9) * s) k.fillRect(x2, pfadY - dick * 0.5, Math.max(0.6, s * 0.3), dick * 1.5);
    }
    for (let i = 0; i < Math.round(W / 2.5); i += 1) {
      const kx = z() * W;
      const ky = pfadY - dick * 0.3 + z() * dick * 1.1;
      k.fillStyle = z() < 0.5 ? rgba(U.korn[0], 0.55) : rgba(U.korn[1], 0.8);
      k.fillRect(kx, ky, Math.max(0.6, s * (0.3 + z() * 0.5)), Math.max(0.6, s * 0.3));
    }
    // Gräser am hinteren Rand, niedrig, im Reif (sie sind kein Hindernis).
    for (let i = 0; i < Math.round(W / 11); i += 1) {
      const gx = z() * W;
      const hoch = (1 + z() * 1.6) * s;
      const zahl = 3 + Math.floor(z() * 3);
      if (!U.gras) continue;
      rundum(W, (dx) => {
        k.strokeStyle = rgba(U.gras, 0.9);
        k.lineWidth = Math.max(0.5, s * 0.28);
        k.beginPath();
        for (let j = 0; j < zahl; j += 1) {
          const w = (j / (zahl - 1) - 0.5) * 1.2;
          k.moveTo(gx + dx + j * s * 0.45, pfadY - dick * 0.4);
          k.quadraticCurveTo(gx + dx + j * s * 0.45 + w * hoch * 0.3, pfadY - dick * 0.4 - hoch * 0.6, gx + dx + j * s * 0.45 + w * hoch, pfadY - dick * 0.4 - hoch);
        }
        k.stroke();
      });
    }
    // Das Spiegelbild darunter: alles kopfüber, getönt.
    k.save();
    k.beginPath();
    k.rect(0, wlY, W, H - wlY);
    k.clip();
    k.translate(0, 2 * wlY);
    k.scale(1, -1);
    k.drawImage(k.canvas, 0, 0, k.canvas.width, Math.round(wlY * view.dpr), 0, 0, W, wlY);
    k.restore();
    k.fillStyle = nacht ? "rgba(6, 12, 34, 0.8)" : "rgba(28, 36, 88, 0.45)";
    k.fillRect(0, wlY, W, H - wlY);
    if (nacht) {
      // Der Saum des gespiegelten Weges leuchtet.
      k.fillStyle = rgba(saum, 0.35);
      k.fillRect(0, wlY + bank, W, Math.max(0.8, s * 0.5));
    }
  }

  // ---------------------------------------------------------------------------
  // Zeichnen: die Nacht im erwachten See – einmal gemalt
  // ---------------------------------------------------------------------------
  /*
   * Kopfüber, wie alles im See: Nahe der Wasserlinie die gespiegelten Berge
   * im Mondlicht, darunter ein Nachthimmel von Türkis über Blau zu Violett,
   * eine Milchstrasse, Sterne, der Mond mit seinem Hof und Lichtfäden wie
   * Polarlicht. Licht fällt in Bahnen von der Wasserlinie in die Tiefe, und
   * ganz unten ahnt man einen Grund mit Steinen, auf denen Licht spielt.
   */
  // Die Nächte der Landschaften: Polarlicht in Türkis (Lärchenufer), in
  // Rosé und Violett (Schilf), in Smaragd (Felsufer), in Eisblau über einem
  // Spiegel aus Eis (Gletscher).
  const NACHT_BLAU = {
    stops: [[0, [10, 30, 62]], [0.1, [12, 30, 70]], [0.32, [20, 28, 82]], [0.58, [34, 22, 86]], [0.82, [18, 12, 52]], [1, [8, 8, 28]]],
    hof: [60, 220, 210], baender: [[0.12, [70, 240, 210], 0.3], [0.3, [150, 110, 255], 0.26], [0.48, [80, 200, 255], 0.18]], strahl: [140, 240, 255], grund: [80, 230, 230], saum: [120, 240, 255],
  };
  const NACHT_ROSE = {
    stops: [[0, [28, 22, 68]], [0.12, [38, 24, 82]], [0.35, [60, 26, 94]], [0.6, [66, 22, 82]], [0.84, [28, 12, 50]], [1, [12, 6, 26]]],
    hof: [255, 150, 210], baender: [[0.12, [255, 140, 200], 0.28], [0.3, [196, 120, 255], 0.26], [0.5, [255, 196, 150], 0.16]], strahl: [255, 200, 240], grund: [255, 170, 220], saum: [255, 170, 226],
  };
  const NACHT_GRUEN = {
    stops: [[0, [8, 34, 52]], [0.12, [10, 40, 60]], [0.35, [14, 40, 74]], [0.6, [18, 30, 70]], [0.84, [8, 18, 40]], [1, [4, 10, 22]]],
    hof: [90, 255, 170], baender: [[0.12, [90, 255, 160], 0.34], [0.28, [60, 220, 200], 0.26], [0.46, [170, 255, 120], 0.16]], strahl: [160, 255, 200], grund: [110, 255, 190], saum: [120, 255, 190],
  };
  const NACHT_EIS = {
    stops: [[0, [16, 44, 82]], [0.12, [20, 54, 96]], [0.35, [28, 64, 120]], [0.6, [26, 48, 110]], [0.84, [14, 26, 66]], [1, [6, 12, 34]]],
    hof: [170, 240, 255], baender: [[0.12, [170, 240, 255], 0.3], [0.3, [120, 180, 255], 0.24], [0.5, [220, 250, 255], 0.16]], strahl: [200, 250, 255], grund: [170, 240, 255], saum: [180, 240, 255], eis: true,
  };

  function maleNacht(k, W, H, LB = LAND_BILD[0]) {
    const N = LB.nacht;
    const wl = view.wl;
    const v = k.createLinearGradient(0, 0, 0, H);
    N.stops.forEach(([f, c]) => v.addColorStop(f, rgb(c)));
    k.fillStyle = v;
    k.fillRect(0, 0, W, H);
    // Der Horizont des Sees: ein Schein.
    const hz = (wl - view.hz);
    const hof = k.createLinearGradient(0, hz - view.berg * 0.2, 0, hz + view.berg * 0.9);
    hof.addColorStop(0, rgba(N.hof, 0));
    hof.addColorStop(0.3, rgba(N.hof, 0.12));
    hof.addColorStop(1, rgba(N.hof, 0));
    k.fillStyle = hof;
    k.fillRect(0, hz - view.berg * 0.2, W, view.berg * 1.1);
    const z = wuerfel(5521);
    // Die Milchstrasse: ein schräges Band aus feinem Licht.
    for (let i = 0; i < 900; i += 1) {
      const f = z();
      const quer = (z() + z() + z() - 1.5) * 0.12;
      const x = f * W;
      const y = H * (0.88 - f * 0.4 + quer);
      if (y < hz + view.berg * 0.3) continue;
      k.fillStyle = z() < 0.5 ? "rgba(180, 200, 255, 0.16)" : "rgba(230, 200, 255, 0.12)";
      const r = 0.6 + z() * 1.8;
      k.fillRect(x, y, r, r);
    }
    // Sterne.
    for (let i = 0; i < 260; i += 1) {
      const x = z() * W;
      const y = hz + view.berg * BERG_TRAUM * 0.2 + z() * (H - hz);
      const r = 0.4 + z() ** 3 * 1.6;
      const farbe = z();
      k.fillStyle = farbe < 0.15 ? "rgba(255, 220, 200, 0.8)" : farbe < 0.35 ? "rgba(180, 240, 255, 0.85)" : "rgba(235, 240, 255, 0.75)";
      k.globalAlpha = 0.35 + z() * 0.6;
      k.fillRect(x, y, r, r);
    }
    k.globalAlpha = 1;
    // Lichtfäden: Bahnen wie Polarlicht, die aus der Tiefe wehen.
    const himmelAb = hz + view.berg * BERG_TRAUM * 0.7;
    // Jede Spalte ein Strich, der ausläuft – aus einem einmal gemalten
    // Verlauf (je Farbe), gestreckt: viel weniger Arbeit als ein Verlauf je
    // Spalte.
    N.baender.forEach(([tief, farbe, kraft], j) => {
      const y0 = himmelAb + (H - himmelAb) * tief;
      const strich = document.createElement("canvas");
      strich.width = 2;
      strich.height = 64;
      const ks = strich.getContext("2d");
      const v = ks.createLinearGradient(0, 0, 0, 64);
      v.addColorStop(0, rgba(farbe, 1));
      v.addColorStop(1, rgba(farbe, 0));
      ks.fillStyle = v;
      ks.fillRect(0, 0, 2, 64);
      for (let x = -10; x < W + 10; x += 2) {
        const u = x / W;
        const y = y0 + Math.sin(u * 5.2 + j * 2.1) * H * 0.04 + Math.sin(u * 13 + j) * H * 0.012;
        const lang = H * (0.07 + 0.05 * (0.5 + 0.5 * Math.sin(u * 9 + j * 3)));
        k.globalAlpha = clamp(kraft * (0.6 + 0.4 * Math.sin(u * 23 + j)), 0, 1);
        k.drawImage(strich, x, y, 2.2, lang);
      }
      k.globalAlpha = 1;
    });
    // Der Mond mit seinem Hof.
    // Unter den gespiegelten Gipfeln, wo die Berge niedrig sind.
    const mr = clamp(view.berg * 0.08, 7, 42);
    const mx = W * 0.22;
    const my = Math.min(H * 0.8 - mr, hz + view.berg * BERG_TRAUM * 0.75 + (H - hz - view.berg * BERG_TRAUM) * 0.3 + mr);
    const halo = k.createRadialGradient(mx, my, 0, mx, my, mr * 7);
    halo.addColorStop(0, "rgba(200, 240, 255, 0.6)");
    halo.addColorStop(0.15, "rgba(150, 220, 255, 0.3)");
    halo.addColorStop(0.45, "rgba(120, 160, 255, 0.1)");
    halo.addColorStop(1, "rgba(120, 160, 255, 0)");
    k.fillStyle = halo;
    k.fillRect(mx - mr * 7, my - mr * 7, mr * 14, mr * 14);
    k.fillStyle = "rgb(236, 244, 255)";
    k.beginPath();
    k.arc(mx, my, mr, 0, TAU);
    k.fill();
    k.fillStyle = "rgba(170, 190, 226, 0.55)";
    [[-0.3, -0.2, 0.32], [0.25, 0.1, 0.22], [-0.05, 0.4, 0.18], [0.35, -0.38, 0.14]].forEach(([dx, dy, r]) => {
      k.beginPath();
      k.arc(mx + dx * mr, my + dy * mr, r * mr, 0, TAU);
      k.fill();
    });
    // Licht, das in Bahnen durchs Wasser fällt.
    for (let i = 0; i < 7; i += 1) {
      const x0 = W * (0.05 + i * 0.15 + z() * 0.06);
      const breit = W * (0.02 + z() * 0.04);
      const lang = H * (0.5 + z() * 0.45);
      const schraeg = W * 0.12;
      const bahn = k.createLinearGradient(0, 0, 0, lang);
      bahn.addColorStop(0, rgba(N.strahl, 0.1));
      bahn.addColorStop(1, rgba(N.strahl, 0));
      k.fillStyle = bahn;
      k.beginPath();
      k.moveTo(x0, 0);
      k.lineTo(x0 + breit, 0);
      k.lineTo(x0 + breit * 3 + schraeg, lang);
      k.lineTo(x0 + schraeg, lang);
      k.closePath();
      k.fill();
    }
    // Die Berge im Mondlicht, gespiegelt – im erwachten See niedriger und
    // ferner: Er zeigt nicht die Wirklichkeit, und darunter beginnt sein
    // eigener Himmel.
    k.save();
    k.translate(0, wl);
    k.scale(1, -1);
    maleBerge(k, W, view.hz, view.berg * BERG_TRAUM * LB.bergH, BERG_NACHT, view.berg, LB.gipfel, LB.bergX);
    k.restore();
    // Ihr Fuss verschwindet im Dunst über dem Wasser, wie oben im Tal.
    const fuss = wl - view.hz;
    const dunstBand = k.createLinearGradient(0, fuss - view.berg * 0.2, 0, fuss + view.berg * BERG_TRAUM * 0.5);
    dunstBand.addColorStop(0, "rgba(14, 32, 68, 0.95)");
    dunstBand.addColorStop(0.4, "rgba(14, 34, 70, 0.8)");
    dunstBand.addColorStop(1, "rgba(14, 34, 70, 0)");
    k.fillStyle = dunstBand;
    k.fillRect(0, fuss - view.berg * 0.2, W, view.berg * (0.2 + BERG_TRAUM * 0.5));
    if (N.eis) {
      // Am Gletscher ist der Spiegel Eis: Risse, hell gesäumt, und Blau.
      const ze = wuerfel(6607);
      k.fillStyle = "rgba(120, 200, 255, 0.08)";
      k.fillRect(0, 0, W, H);
      for (let i = 0; i < 16; i += 1) {
        let x = ze() * W;
        let y = ze() * H;
        let w = ze() * TAU;
        k.strokeStyle = "rgba(220, 250, 255, 0.28)";
        k.lineWidth = 0.8 + ze() * 0.8;
        k.beginPath();
        k.moveTo(x, y);
        for (let j = 0; j < 7; j += 1) {
          w += (ze() - 0.5) * 1.1;
          x += Math.cos(w) * H * 0.05;
          y += Math.sin(w) * H * 0.02;
          k.lineTo(x, y);
        }
        k.stroke();
      }
    }
    // Der Grund: Steine, auf denen das Licht spielt, und Wasserpflanzen.
    const grund = H * 0.9;
    if (grund > hz + view.berg * BERG_TRAUM + 20) {
      const dunkel = k.createLinearGradient(0, grund - H * 0.06, 0, H);
      dunkel.addColorStop(0, "rgba(6, 10, 30, 0)");
      dunkel.addColorStop(0.5, "rgba(6, 10, 30, 0.7)");
      dunkel.addColorStop(1, "rgba(4, 6, 20, 0.95)");
      k.fillStyle = dunkel;
      k.fillRect(0, grund - H * 0.06, W, H - grund + H * 0.06);
      for (let i = 0; i < 26; i += 1) {
        const x = z() * W;
        const r = H * (0.012 + z() * 0.03);
        const y = grund + (H - grund) * (0.35 + z() * 0.7);
        k.fillStyle = "rgb(10, 18, 40)";
        k.beginPath();
        k.ellipse(x, y, r * 1.4, r, 0, 0, TAU);
        k.fill();
        k.strokeStyle = rgba(N.grund, 0.35);
        k.lineWidth = 1;
        k.beginPath();
        k.ellipse(x, y, r * 1.4, r, 0, Math.PI * 1.1, Math.PI * 1.75);
        k.stroke();
        if (z() < 0.35) {
          k.fillStyle = rgba(N.grund, 0.7);
          k.beginPath();
          k.arc(x + r * 0.4, y - r * 0.8, 1.1, 0, TAU);
          k.fill();
        }
      }
      k.strokeStyle = "rgba(40, 130, 130, 0.28)";
      k.lineWidth = 1.1;
      for (let i = 0; i < 12; i += 1) {
        const x = z() * W;
        const lang = H * (0.05 + z() * 0.08);
        k.beginPath();
        k.moveTo(x, H);
        k.bezierCurveTo(x + lang * 0.3, H - lang * 0.4, x - lang * 0.3, H - lang * 0.7, x + lang * 0.1, H - lang);
        k.stroke();
      }
      // Lichtnetz auf dem Grund.
      k.strokeStyle = rgba(N.grund, 0.12);
      k.lineWidth = 0.8;
      for (let i = 0; i < 40; i += 1) {
        const x = z() * W;
        const y = grund + z() * (H - grund);
        const r = H * (0.01 + z() * 0.02);
        k.beginPath();
        k.moveTo(x - r, y);
        k.quadraticCurveTo(x, y - r * 0.6, x + r, y + r * 0.1);
        k.stroke();
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Die Ebenen neu malen (beim Laden und wenn sich die Grösse ändert)
  // ---------------------------------------------------------------------------
  // Kleine Scheine, einmal gemalt: Licht, Atem, Glanz.
  const SCHEINE = {
    warm: [[255, 220, 170], 1, 0.8],
    kalt: [[140, 250, 255], 1, 0.8],
    violett: [[200, 140, 255], 1, 0.8],
    weiss: [[255, 255, 255], 1, 0.8],
    atem: [[246, 244, 255], 0.7, 0.6],
    staub: [[236, 220, 222], 0.7, 0.55],
  };
  function scheinAus(farbe, kraft, r) {
    const c = document.createElement("canvas");
    const n = Math.max(8, Math.round(r * 2 * view.dpr));
    c.width = n;
    c.height = n;
    const k = c.getContext("2d");
    const v = k.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2);
    v.addColorStop(0, rgba(farbe, kraft));
    v.addColorStop(0.25, rgba(farbe, kraft * 0.55));
    v.addColorStop(1, rgba(farbe, 0));
    k.fillStyle = v;
    k.fillRect(0, 0, n, n);
    return c;
  }

  function schein(name, x, y, mass = 1, alpha = 1) {
    const bild = ebenen?.scheine?.[name];
    if (!bild || alpha <= 0.01) return;
    const r = SCHEINE[name][2] * 16 * mass;
    g.globalAlpha = alpha;
    g.drawImage(bild, x - r, y - r, 2 * r, 2 * r);
    g.globalAlpha = 1;
  }

  // Der Nebel, der über das Ufer zieht: ein Grund, unten dicht und nach
  // oben dünner, an den Rändern ausgeblendet (nebelRand), und darüber
  // weiche Schwaden (nebelSchwade), die langsam ziehen.
  function nebelVerlauf(k, y, h) {
    const v = k.createLinearGradient(0, y, 0, y + h);
    v.addColorStop(0, "rgba(246, 226, 232, 0)");
    v.addColorStop(0.32, "rgba(246, 228, 234, 0.3)");
    v.addColorStop(0.55, "rgba(246, 230, 236, 0.86)");
    v.addColorStop(1, "rgba(246, 232, 238, 0.95)");
    return v;
  }

  // Was jede Landschaft malt; LANDSCHAFT trägt den Namen für die Ansage.
  const LAND_BILD = [
    {
      himmel: HIMMEL_GLUT, berge: BERG_GLUT, gipfel: GIPFEL, bergX: 0.62, bergH: 1, hang: HANG_TAG, hangNacht: HANG_NACHT, hangArt: "laerchen",
      wald: WALD_TAG, waldNacht: WALD_NACHT, waldArt: "laerchen", ufer: "kies", nacht: NACHT_BLAU, ton: [30, 40, 92],
    },
    {
      himmel: HIMMEL_GOLD, berge: BERG_GOLD, gipfel: GIPFEL_SCHILF, bergX: 0.52, bergH: 0.8, hang: HANG_SCHILF, hangNacht: nachtVon(HANG_SCHILF, [255, 170, 226]), hangArt: "schilf",
      wald: WALD_SCHILF, waldNacht: nachtVon(WALD_SCHILF, [255, 170, 226]), waldArt: "schilf", ufer: "sand", nacht: NACHT_ROSE, ton: [70, 44, 84], boot: true,
    },
    {
      himmel: HIMMEL_KLAR, berge: BERG_FELS, gipfel: GIPFEL_FELS, bergX: 0.5, bergH: 1.05, hang: HANG_FELS, hangNacht: nachtVon(HANG_FELS, [120, 255, 190]), hangArt: "fels",
      wald: WALD_FELS, waldNacht: nachtVon(WALD_FELS, [120, 255, 190]), waldArt: "fels", ufer: "fels", nacht: NACHT_GRUEN, ton: [24, 46, 92], wasserfall: true,
    },
    {
      himmel: HIMMEL_EIS, berge: BERG_EIS, gipfel: GIPFEL_EIS, bergX: 0.55, bergH: 1.05, hang: HANG_GLETSCHER, hangNacht: nachtVon(HANG_GLETSCHER, [170, 236, 255]), hangArt: "gletscher",
      wald: WALD_EIS, waldNacht: nachtVon(WALD_EIS, [170, 236, 255]), waldArt: "eis", ufer: "schnee", nacht: NACHT_EIS, ton: [104, 156, 214], tonKraft: 0.42, eisSpiegel: true,
    },
  ];
  // Eine Landschaft geht in die nächste über, wo der Weg es tut: Eine Naht
  // zieht mit dem Weg durchs Bild (links die alte, rechts die neue), mit
  // einem weichen Saum von NAHT CSS-Pixeln. So wird fast nichts doppelt
  // gemalt.
  const NAHT = 170;
  // Die Landschaften am linken und am rechten Rand des Bildes.
  const landLinks = () => landNr(state.camX - (view.rx + NAHT) / view.s);
  const landRechts = () => landNr(state.camX + (view.cssW - view.rx + NAHT) / view.s);

  /*
   * Die Ebenen. Was für alle Landschaften gleich ist (wo die Streifen liegen,
   * die Scheine, der Nebel), steht in ebenen; jede Landschaft hat ihren Satz
   * in ebenen.land[art]. Im Speicher sind nur die Sätze der Landschaft, in
   * der sie läuft, und der nächsten (auf iPhone und iPad ist der Speicher
   * für Leinwände knapp): Beim Laden wird die jetzige ganz gemalt, die
   * nächste danach Ebene um Ebene, je eine in einem Bild, das Zeit übrig
   * hat (malenWeiter) – so stockt kein Bild. Für die gekippte Welt kommen,
   * sobald ein Spiegeltor geplant ist, die aufrechte Nacht und das
   * gespiegelte Ufer dazu.
   */
  let auftraege = [];

  function ebenenNeu() {
    const W = view.cssW;
    const H = view.cssH;
    const s = view.s;
    const dpr = view.dpr;
    const wl = view.wl;
    const hangUnten = view.pfad - (view.pfad - view.hz) * 0.22;
    const hangH = Math.round(Math.max(20, (hangUnten - view.hz) + view.berg * 0.28));
    // Oben reicht der Hang bis an den Weg und deckt ab seinem Kamm alles ab.
    const tal = Math.ceil(view.pfad + 2 - hangUnten);
    const waldH = Math.round(Math.max(20, (view.pfad - view.hz) * 0.98));
    const uferOben = 8 * s;
    const uferH = uferOben + UFER * s * 2 + 8 * s;
    const breitUfer = PERIODE * s;
    const unten = H - wl;
    ebenen = {
      hangUnten,
      uferOben,
      hangTal: tal,
      // Bis dorthin muss der Himmel gelegt werden: bis unter den höchsten
      // Kamm des Hangs (bei jeder Landschaft höchstens 0,58 seiner Höhe).
      himmelBis: Math.min(wl, hangUnten - hangH + hangH * 0.6),
      mass: { W, H, s, dpr, wl, hangUnten, hangH, tal, waldH, uferOben, uferH, breitUfer, unten },
      scheine: {},
      land: {},
    };
    Object.entries(SCHEINE).forEach(([name, [farbe, kraft, r]]) => { ebenen.scheine[name] = scheinAus(farbe, kraft, r * 16); });
    // Die jetzige Landschaft gleich ganz, die nächste in Stücken.
    auftraege = [];
    const jetzt = landArt(landNr(state.camX));
    satzTeile(jetzt).forEach(([, , malen]) => malen());
    if (state.intro && jetzt === 0) {
      ebenen.himmelBlau = streifen(W, wl, (k, w, h) => maleHimmel(k, w, h, false));
      ebenen.spiegelBlau = spiegelVon(ebenen.himmelBlau, 101, LAND_BILD[0]);
    }
    vorratPlanen();
    // Der Nebel: seine Ränder und eine Schwade, je einmal gemalt.
    const nebelH = Math.round((DECKE + 40) * s * dpr);
    const rand = Math.max(8, Math.round(60 * s * dpr));
    ebenen.nebelH = nebelH;
    ebenen.nebelRand = [0, 1].map((seite) => {
      const c = document.createElement("canvas");
      c.width = rand;
      c.height = nebelH;
      const k = c.getContext("2d");
      k.fillStyle = nebelVerlauf(k, 0, nebelH);
      k.fillRect(0, 0, rand, nebelH);
      k.globalCompositeOperation = "destination-in";
      const v = k.createLinearGradient(0, 0, rand, 0);
      v.addColorStop(seite ? 1 : 0, "rgba(0, 0, 0, 0)");
      v.addColorStop(seite ? 0 : 1, "rgba(0, 0, 0, 1)");
      k.fillStyle = v;
      k.fillRect(0, 0, rand, c.height);
      return c;
    });
    ebenen.nebelSchwade = (() => {
      const r = 26 * s * dpr;
      const c = document.createElement("canvas");
      c.width = Math.round(r * 4.8);
      c.height = Math.round(r * 2);
      const k = c.getContext("2d");
      k.translate(c.width / 2, c.height / 2);
      k.scale(2.4, 1);
      const v = k.createRadialGradient(0, 0, 0, 0, 0, r);
      v.addColorStop(0, "rgba(255, 242, 246, 0.6)");
      v.addColorStop(0.5, "rgba(255, 242, 246, 0.28)");
      v.addColorStop(1, "rgba(255, 242, 246, 0)");
      k.fillStyle = v;
      k.fillRect(-r, -r, 2 * r, 2 * r);
      return c;
    })();
  }

  // Der Himmel, gespiegelt und getönt: der treue See (und unten in der
  // gekippten Welt das Ufer im Morgenlicht).
  function spiegelVon(bild, saat, LB, nurTon = null) {
    const M = ebenen.mass;
    if (nurTon) {
      spiegelTonen(nurTon, saat, LB);
      return nurTon;
    }
    const c = document.createElement("canvas");
    c.width = Math.round(M.W * M.dpr);
    c.height = Math.max(8, Math.round(Math.max(M.unten, M.wl - view.frei) * M.dpr));
    const k = c.getContext("2d");
    const hoch = bild.height;
    // Tiefer als der Himmel reicht: sein Zenit.
    k.fillStyle = rgb(mix3(LB.himmel.stops[0][1], LB.ton, 0.3));
    k.fillRect(0, 0, c.width, c.height);
    k.save();
    k.translate(0, hoch);
    k.scale(1, -1);
    k.drawImage(bild, 0, 0);
    k.restore();
    if (saat === null) return c;
    spiegelTonen(c, saat, LB);
    return c;
  }

  // Der zweite Teil: getönt, mit feinen Wellen, zur Tiefe dunkler.
  function spiegelTonen(c, saat, LB) {
    const k = c.getContext("2d");
    spiegelTon(k, c.width, c.height, saat, LB);
    const tief = k.createLinearGradient(0, 0, 0, c.height);
    tief.addColorStop(0, "rgba(10, 16, 44, 0)");
    tief.addColorStop(1, "rgba(10, 16, 44, 0.45)");
    k.fillStyle = tief;
    k.fillRect(0, 0, c.width, c.height);
    return c;
  }

  // Ein Auftrag in Schritten: je Aufruf einer (gibt true zurück, solange
  // noch etwas fehlt).
  function inSchritten(...liste) {
    let i = 0;
    return () => {
      liste[i]();
      i += 1;
      return i < liste.length;
    };
  }

  // Ein Band eines Bildes, auf den Kopf gestellt, in ein anderes: Zeile y
  // der Quelle landet bei hoch − y. So in Stücken (je ein Bild eines), und
  // nur mit dem Stück der Quelle, das es braucht: Gespiegeltes Auflegen ist
  // auf dem Prozessor teuer, ein ganzes grosses Bild auf einmal zu teuer.
  function kippBand(quelle, ziel, hoch, i, zahl) {
    const k = ziel.getContext("2d");
    // Die Zeilen der Quelle, die dieses Band füllen.
    const q0 = Math.max(0, hoch - Math.min(hoch, ziel.height));
    const von = q0 + Math.floor(((Math.min(hoch, quelle.height) - q0) * i) / zahl);
    const bis = q0 + Math.ceil(((Math.min(hoch, quelle.height) - q0) * (i + 1)) / zahl);
    if (bis <= von) return;
    k.save();
    k.setTransform(1, 0, 0, -1, 0, hoch);
    k.drawImage(quelle, 0, von, quelle.width, bis - von, 0, von, quelle.width, bis - von);
    k.restore();
    fertigMalen(ziel);
  }
  const leinwand = (w, h) => {
    const c = document.createElement("canvas");
    c.width = Math.max(8, Math.round(w));
    c.height = Math.max(8, Math.round(h));
    return c;
  };

  // Die Ebenen einer Landschaft als Aufträge: [art, name, malen].
  function satzTeile(art) {
    const LB = LAND_BILD[art];
    const M = ebenen.mass;
    const satz = () => {
      if (!ebenen.land[art]) ebenen.land[art] = { art };
      return ebenen.land[art];
    };
    const ufer = (nacht) => streifen(M.breitUfer, M.uferH, (k, w, h) => maleUfer(k, w, h, M.uferOben, M.uferOben + UFER * M.s, nacht, LB.ufer, LB.nacht.saum));
    return [
      [art, "himmel", inSchritten(...streifenSchritte(M.W, M.wl, (k, w, h) => maleHimmel(k, w, h, true, LB), 3, (c) => { satz().himmel = c; }))],
      [art, "spiegel", (() => {
        // Der Himmel gespiegelt, in vier Bändern, dann getönt.
        let c = null;
        const hoch = () => satz().himmel.height;
        const band = (i) => () => kippBand(satz().himmel, c, hoch(), i, 4);
        return inSchritten(
          () => {
            c = leinwand(M.W * M.dpr, Math.max(M.unten, M.wl - view.frei) * M.dpr);
            const k = c.getContext("2d");
            k.fillStyle = rgb(mix3(LB.himmel.stops[0][1], LB.ton, 0.3));
            k.fillRect(0, 0, c.width, c.height);
          },
          band(0), band(1), band(2), band(3),
          () => { spiegelTonen(c, 101, LB); satz().spiegel = c; },
        );
      })()],
      [art, "hang", () => { satz().hang = streifen(Math.round(M.W * 1.5), M.hangH + M.tal, (k, w, h) => maleHang(k, w, h, { ...LB.hang, unterTal: M.tal }, LB.hangArt)); }],
      [art, "hangSp", () => { const e = satz(); e.hangSp = gespiegelt(e.hang, (k, w, h) => spiegelTon(k, w, h, 202, LB)); }],
      [art, "wald", () => { satz().wald = streifen(Math.round(M.W * 1.3), M.waldH, (k, w, h) => maleWald(k, w, h, LB.wald, M.s, LB.waldArt)); }],
      [art, "waldSp", () => { const e = satz(); e.waldSp = gespiegelt(e.wald, (k, w, h) => spiegelTon(k, w, h, 303, LB)); }],
      [art, "waldNachtAuf", () => { satz().waldNachtAuf = streifen(Math.round(M.W * 1.3), M.waldH, (k, w, h) => maleWald(k, w, h, LB.waldNacht, M.s, LB.waldArt)); }],
      [art, "waldNacht", () => { const e = satz(); e.waldNacht = gespiegelt(e.waldNachtAuf); }],
      [art, "ufer", () => { satz().ufer = ufer(false); }],
      [art, "uferNacht", () => { satz().uferNacht = ufer(true); }],
      [art, "hangNacht", (() => {
        let roh = null;
        return inSchritten(
          () => { roh = streifen(Math.round(M.W * 1.5), M.hangH, (k, w, h) => maleHang(k, w, h, LB.hangNacht, LB.hangArt)); },
          () => { satz().hangNacht = gespiegelt(roh); roh = null; },
        );
      })()],
      [art, "nacht", inSchritten(...streifenSchritte(M.W, M.unten, (k, w, h) => maleNacht(k, w, h, LB), 3, (c) => {
        const k = c.getContext("2d");
        k.setTransform(1, 0, 0, 1, 0, 0);
        k.drawImage(satz().hangNacht, -Math.round(M.W * 0.2 * M.dpr), Math.round((M.wl - M.hangUnten) * M.dpr));
        fertigMalen(c);
        satz().nacht = c;
      }))],
    ];
  }

  // Für die gekippte Welt: die Nacht aufrecht (bis unter die Knöpfe) und das
  // Ufer gespiegelt.
  function kippTeile(art) {
    const LB = LAND_BILD[art];
    const M = ebenen.mass;
    const satz = () => ebenen.land[art];
    return [
      [art, "nachtAuf", (() => {
        // Aus der fertigen Nacht, aufrecht gestellt (in Bändern): Wo ihr
        // Grund wäre, geht der Himmel weiter (der Grund des Sees ist jetzt
        // oben).
        const N = LB.nacht;
        const hoch = view.frei + M.H - M.wl;
        let c = null;
        const band = (i) => () => kippBand(satz().nacht, c, c.height, i, 4);
        return inSchritten(() => {
          c = leinwand(M.W * M.dpr, hoch * M.dpr);
          const k = c.getContext("2d");
          k.fillStyle = rgb(N.stops[N.stops.length - 1][1]);
          k.fillRect(0, 0, c.width, c.height);
        }, band(0), band(1), band(2), band(3), () => {
          const k = c.getContext("2d");
          k.setTransform(M.dpr, 0, 0, M.dpr, 0, 0);
          const w = M.W;
          const h = hoch;
          const oben = rgb(N.stops[N.stops.length - 1][1]);
          const grund = h - M.unten * 0.84;
          const v = k.createLinearGradient(0, 0, 0, grund + M.unten * 0.06);
          v.addColorStop(0, oben);
          v.addColorStop(0.75, rgba(N.stops[N.stops.length - 2][1], 0.96));
          v.addColorStop(1, rgba(N.stops[N.stops.length - 2][1], 0));
          k.fillStyle = v;
          k.fillRect(0, 0, w, grund + M.unten * 0.06);
          const z = wuerfel(3301 + art);
          k.fillStyle = "#ffffff";
          for (let i = 0; i < 120; i += 1) {
            k.globalAlpha = 0.3 + z() * 0.6;
            const r = 0.5 + z() ** 3 * 1.4;
            k.fillRect(z() * w, z() * grund, r, r);
          }
          k.globalAlpha = 1;
          satz().nachtAuf = c;
        });
      })()],
      [art, "uferKipp", () => { const e = satz(); e.uferKipp = gespiegelt(e.ufer); }],
      [art, "uferNachtKipp", () => { const e = satz(); e.uferNachtKipp = gespiegelt(e.uferNacht); }],
    ];
  }

  // Ob eine Ebene schon da ist (der rohe Spiegel ist da, wenn der getönte
  // da ist).
  const schonDa = (art, name) => Boolean(ebenen.land[art]?.[name] || (name === "spiegelRoh" && ebenen.land[art]?.spiegel));

  // Welche Sätze gebraucht werden: der, in dem sie läuft, der, in den sie
  // gleitet, und sonst der nächste. Was fehlt, kommt in die Aufträge; was
  // nicht mehr gebraucht wird, geht.
  function vorratPlanen() {
    if (!ebenen?.land) return;
    const von = landLinks();
    const bis = landRechts();
    const gebraucht = [landArt(von), landArt(bis)];
    if (von === bis) gebraucht.push(landArt(von + 1));
    const kipp = state.tore.length > 0;
    Object.keys(ebenen.land).forEach((a) => { if (!gebraucht.includes(Number(a))) delete ebenen.land[a]; });
    auftraege = auftraege.filter(([art]) => gebraucht.includes(art));
    gebraucht.forEach((art) => {
      const teile = [...satzTeile(art), ...(kipp ? kippTeile(art) : [])];
      teile.forEach((teil) => {
        if (schonDa(art, teil[1]) || auftraege.some(([a, n]) => a === art && n === teil[1])) return;
        auftraege.push(teil);
      });
    });
  }

  // Das Nächste malen, solange das Bild Zeit hat (bis frist).
  function malenWeiter(frist) {
    if (!auftraege.length || performance.now() > frist) return;
    const [art, name, malen] = auftraege[0];
    if (!ebenen?.land || schonDa(art, name)) { auftraege.shift(); return; }
    const a = performance.now();
    if (!malen()) auftraege.shift();
    malLog.push([art, name, Math.round((performance.now() - a) * 10) / 10]);
    if (malLog.length > 60) malLog.shift();
  }
  // Wie lange jede Ebene zum Malen brauchte (für die Prüfung der Bildzeit).
  const malLog = [];

  const satzFertig = (e) => Boolean(e?.himmel && e.spiegel && e.hang && e.hangSp && e.wald && e.waldSp && e.waldNacht && e.waldNachtAuf && e.ufer && e.uferNacht && e.nacht);
  const kippFertig = (e) => Boolean(e?.nachtAuf && e.uferKipp && e.uferNachtKipp);

  // Was jetzt gebraucht wird und noch fehlt, sofort malen (nach einem Sprung
  // in der Zeit: beim Zuschauen, in der Prüfung).
  function satzSofort(art, mitKipp) {
    const teile = [...satzTeile(art), ...(mitKipp ? kippTeile(art) : [])];
    teile.forEach(([, name, malen]) => {
      for (let i = 0; i < 12 && !schonDa(art, name); i += 1) malen();
    });
    auftraege = auftraege.filter(([a, name]) => a !== art || !schonDa(art, name));
  }

  // Die Sätze, die jetzt im Bild sind, und wo zwischen ihnen die Naht
  // liegt (grenze: der Ort auf dem Weg).
  function landJetzt() {
    const von = landLinks();
    const bis = landRechts();
    if (!satzFertig(ebenen.land[landArt(von)]) || (kippJetzt && !kippFertig(ebenen.land[landArt(von)]))) satzSofort(landArt(von), kippJetzt);
    const A = ebenen.land[landArt(von)];
    if (von === bis) return { A, B: null, k: 0, grenze: null };
    const B = ebenen.land[landArt(bis)];
    if (!satzFertig(B) || (kippJetzt && !kippFertig(B))) return { A, B: null, k: 0, grenze: null };
    return { A, B, k: 1, grenze: landAnfang(bis) };
  }

  // Einen Streifen quer übers Bild legen (in Bildpunkten), immer wieder.
  function legeStreifen(bild, versatz, y) {
    const bw = bild.width;
    for (let x = -(((Math.round(versatz) % bw) + bw) % bw); x < canvas.width; x += bw) g.drawImage(bild, x, y);
  }

  // ---------------------------------------------------------------------------
  // Zeichnen: die Welt, je Bild aufgelegt
  // ---------------------------------------------------------------------------
  // Wie weit der See erwacht ist: 0 der treue Spiegel, 1 die Nacht.
  function nachtK() {
    if (state.erwacheT === null) return 0;
    return clamp((state.t - state.erwacheT - 0.25) / 1.7, 0, 1);
  }

  // Die Grundlage zum Zeichnen: Bildpunkte (skala 1) oder CSS-Pixel (skala
  // dpr), in der gekippten Welt um die Mitte der freien Höhe gespiegelt.
  let kippJetzt = false;
  function basis(skala = view.dpr, dx = 0) {
    if (kippJetzt) g.setTransform(skala, 0, 0, -skala, dx, Math.round((view.frei + view.cssH) * view.dpr));
    else g.setTransform(skala, 0, 0, skala, dx, 0);
  }

  function zeichneWelt() {
    const { A, B, k, grenze } = landJetzt();
    if (!A?.himmel) return;
    nahtPx = B ? Math.round(bildX(grenze) * view.dpr) : null;
    basis(1);
    if (kippJetzt) zeichneWeltGekippt(A, B, k, grenze);
    else zeichneWeltAufrecht(A, B, k, grenze);
    basis();
  }

  // Ein Satz – oder, im Übergang, links der Naht der alte, rechts der neue
  // und dazwischen ein weicher Saum (in Stufen).
  let nahtPx = null;
  function beide(A, B, k, malen) {
    if (!B || nahtPx === null) { malen(A); return; }
    const W = canvas.width;
    const breit = Math.round(NAHT * view.dpr);
    const xa = clamp(nahtPx - breit / 2, 0, W);
    const xb = clamp(nahtPx + breit / 2, 0, W);
    const stueck = (x0, x1, S, alpha = 1) => {
      if (x1 - x0 < 0.5) return;
      g.save();
      g.beginPath();
      g.rect(x0, -10000, x1 - x0, 20000);
      g.clip();
      g.globalAlpha = alpha;
      malen(S);
      g.restore();
    };
    stueck(0, xa, A);
    stueck(xb, W, B);
    const stufen = 10;
    for (let i = 0; i < stufen; i += 1) {
      const x0 = xa + ((xb - xa) * i) / stufen;
      const x1 = xa + ((xb - xa) * (i + 1)) / stufen;
      if (x1 - x0 < 0.5) continue;
      stueck(x0, x1, A);
      stueck(x0, x1, B, (i + 0.5) / stufen);
    }
  }

  // Ein Streifen am Ufer: links der Grenze der alte, rechts der neue.
  function legeUfer(A, B, grenze, name, x, y) {
    if (!B) { legeStreifen(A[name], x, y); return; }
    const gx = clamp(Math.round(bildX(grenze) * view.dpr), 0, canvas.width);
    if (gx > 0) {
      g.save();
      g.beginPath();
      g.rect(0, y - 2, gx, A[name].height + 4);
      g.clip();
      legeStreifen(A[name], x, y);
      g.restore();
    }
    if (gx < canvas.width) {
      g.save();
      g.beginPath();
      g.rect(gx, y - 2, canvas.width - gx, B[name].height + 4);
      g.clip();
      legeStreifen(B[name], x, y);
      g.restore();
    }
  }

  function zeichneWeltAufrecht(A, B, k, grenze) {
    const dpr = view.dpr;
    const s = view.s;
    const cam = state.camX * s * dpr;
    const wlPx = Math.round(view.wl * dpr);
    // Oben: der Himmel mit den Bergen – beim ersten Start glühen die Gipfel
    // von oben nach unten auf.
    const intro = state.intro && ebenen.himmelBlau ? clamp(state.intro.t / state.intro.dauer, 0, 1) : 1;
    if (intro < 1) {
      g.drawImage(ebenen.himmelBlau, 0, 0);
      g.drawImage(ebenen.spiegelBlau, 0, wlPx);
      // Die Grenze des Lichts ist weich: ein paar Streifen mit wachsender
      // Deckkraft.
      const weich = Math.round(view.berg * 0.35 * dpr);
      const front = Math.round(lerp(view.frei * 0.5 - view.berg * 0.35, view.wl, glatt(intro) ** 0.8) * dpr);
      const W2 = A.himmel.width;
      const lege = (y0, y1, alpha) => {
        const a = clamp(Math.round(y0), 0, wlPx);
        const b = clamp(Math.round(y1), 0, wlPx);
        if (b <= a) return;
        g.globalAlpha = alpha;
        g.drawImage(A.himmel, 0, a, W2, b - a, 0, a, W2, b - a);
        // Im See glüht es von der Tiefe zur Wasserlinie hin auf.
        const sa = wlPx - b;
        const sb = Math.min(A.spiegel.height, wlPx - a);
        if (sb > sa && sa >= 0) g.drawImage(A.spiegel, 0, sa, W2, sb - sa, 0, wlPx + sa, W2, sb - sa);
        g.globalAlpha = 1;
      };
      lege(0, front - weich, 1);
      for (let i = 0; i < 6; i += 1) lege(front - weich + (weich * i) / 6, front - weich + (weich * (i + 1)) / 6, 1 - (i + 0.5) / 6);
    } else {
      const bis = Math.round(ebenen.himmelBis * dpr);
      beide(A, B, k, (S) => g.drawImage(S.himmel, 0, 0, S.himmel.width, bis, 0, 0, S.himmel.width, bis));
    }
    const hangY = Math.round((ebenen.hangUnten + ebenen.hangTal) * dpr);
    beide(A, B, k, (S) => legeStreifen(S.hang, cam * PAR.hang, hangY - S.hang.height));
    zeichneLandLeben(A, B, k, "hang");
    const waldY = Math.round((view.pfad + 1) * dpr);
    beide(A, B, k, (S) => legeStreifen(S.wald, cam * PAR.wald, waldY - S.wald.height));
    // Unten: der treue Spiegel, darüber (erwacht) die Nacht.
    const n = nachtK();
    if (n < 1) {
      beide(A, B, k, (S) => {
        if (intro >= 1) g.drawImage(S.spiegel, 0, wlPx);
        legeStreifen(S.hangSp, cam * PAR.hang, 2 * wlPx - hangY);
        legeStreifen(S.waldSp, cam * PAR.wald, 2 * wlPx - waldY);
      });
    }
    const uferY = Math.round((view.pfad - ebenen.uferOben) * dpr);
    const uferX = cam - view.rx * dpr;
    legeUfer(A, B, grenze, "ufer", uferX, uferY);
    if (n > 0) {
      const front = Math.round((canvas.height - wlPx) * glatt(n) ** 0.85) + 1;
      g.save();
      if (n < 1) {
        g.beginPath();
        g.rect(0, wlPx, canvas.width, front);
        g.clip();
      }
      beide(A, B, k, (S) => {
        g.drawImage(S.nacht, 0, wlPx);
        legeStreifen(S.waldNacht, cam * PAR.wald, 2 * wlPx - waldY);
      });
      g.beginPath();
      g.rect(0, wlPx, canvas.width, canvas.height - wlPx);
      g.clip();
      legeUfer(A, B, grenze, "uferNacht", uferX, uferY);
      g.restore();
    }
    zeichneLandLeben(A, B, k, "see");
    basis();
    if (n > 0 && n < 1) {
      // Die Front der Nacht: ein heller Saum, der in die Tiefe sinkt.
      const y = view.wl + (view.cssH - view.wl) * glatt(n) ** 0.85;
      const saum = g.createLinearGradient(0, y - 30, 0, y + 8);
      saum.addColorStop(0, "rgba(140, 250, 255, 0)");
      saum.addColorStop(0.78, `rgba(190, 252, 255, ${0.75 * (1 - n * 0.6)})`);
      saum.addColorStop(1, "rgba(190, 252, 255, 0)");
      g.fillStyle = saum;
      g.fillRect(0, y - 30, view.cssW, 38);
    }
  }

  // Die gekippte Welt: oben die Nacht des Sees aufrecht, unten das Ufer im
  // Morgenlicht kopfüber, wie in einem See (der treue Spiegel). Gemalt wird
  // in Bildpunkten der gekippten Welt (basis spiegelt um die Mitte).
  function zeichneWeltGekippt(A, B, k, grenze) {
    const dpr = view.dpr;
    const s = view.s;
    const cam = state.camX * s * dpr;
    const wlPx = Math.round(view.wl * dpr);
    const spiegelPx = Math.round((view.frei + view.cssH) * dpr);
    const hangY = Math.round((ebenen.hangUnten + ebenen.hangTal) * dpr);
    const waldY = Math.round((view.pfad + 1) * dpr);
    const uferY = Math.round((view.pfad - ebenen.uferOben) * dpr);
    const uferX = cam - view.rx * dpr;
    // Hier in ungekippten Bildpunkten, mit der Kippung von basis: Was oben
    // liegen soll, liegt in diesen Zahlen unten.
    const B2 = B && kippFertig(B) ? B : null;
    // Die Nacht, aufrecht: Ihr Bild ist schon aufrecht gemalt – also hier
    // ungekippt auflegen.
    g.setTransform(1, 0, 0, 1, 0, 0);
    const wl2 = spiegelPx - wlPx;
    beide(A, B2, k, (S) => {
      g.drawImage(S.nachtAuf, 0, wl2 - S.nachtAuf.height);
      legeStreifen(S.waldNachtAuf, cam * PAR.wald, spiegelPx - 2 * wlPx + waldY - S.waldNachtAuf.height);
    });
    g.save();
    g.beginPath();
    g.rect(0, 0, canvas.width, wl2);
    g.clip();
    legeUfer(A, B2, grenze, "uferNachtKipp", uferX, spiegelPx - uferY - A.uferNachtKipp.height);
    g.restore();
    // Unten das Ufer im Morgenlicht, kopfüber: der treue Spiegel.
    g.save();
    g.beginPath();
    g.rect(0, wl2, canvas.width, canvas.height - wl2);
    g.clip();
    // Vom Himmel nur, was der Hang nicht deckt (wie aufrecht: himmelBis).
    const r0 = clamp(wlPx - Math.round(ebenen.himmelBis * dpr), 0, A.spiegel.height - 1);
    beide(A, B2, k, (S) => {
      g.drawImage(S.spiegel, 0, r0, S.spiegel.width, S.spiegel.height - r0, 0, wl2 + r0, S.spiegel.width, S.spiegel.height - r0);
      legeStreifen(S.hangSp, cam * PAR.hang, spiegelPx - hangY);
      legeStreifen(S.waldSp, cam * PAR.wald, spiegelPx - waldY);
    });
    legeUfer(A, B2, grenze, "uferKipp", uferX, spiegelPx - uferY - A.uferKipp.height);
    g.restore();
    basis(1);
  }

  // Was am Himmel und im See je Bild lebt: die Venus, Vögel, Sterne, die
  // funkeln, und Teilchen, die zur Wasserlinie hinauf schweben.
  const VOEGEL = Array.from({ length: 5 }, (_, i) => ({ dx: i * 14 + hash01(i * 3.1) * 10, dy: (i % 2) * 6 + hash01(i * 7.7) * 5, p: hash01(i * 1.3) * 6 }));
  const FUNKELN = Array.from({ length: 70 }, (_, i) => ({ x: hash01(i * 3.7 + 1), y: hash01(i * 5.3 + 2), r: 0.8 + hash01(i * 9.1) * 1.6, p: hash01(i * 2.9) * 6 }));
  const SCHWEBE = Array.from({ length: 56 }, (_, i) => ({
    x: hash01(i * 4.1 + 3), y: hash01(i * 6.7 + 5), r: 0.6 + hash01(i * 8.3) ** 2 * 2.2, v: 0.012 + hash01(i * 2.3) * 0.03, p: hash01(i * 1.7) * 6, farbe: i % 3,
  }));

  function zeichneHimmelsleben() {
    const W = view.cssW;
    const still = ruhig();
    // Die Venus, der Morgenstern.
    const vx = W * 0.86;
    const vy = view.frei + (view.hz - view.frei) * 0.14;
    schein("weiss", vx, vy, 0.28, 0.6 + (still ? 0 : 0.15 * Math.sin(state.zeit * 2.1)));
    g.fillStyle = "#ffffff";
    g.fillRect(vx - 0.9, vy - 0.9, 1.8, 1.8);
    // Ein paar Vögel ziehen langsam über den See.
    if (!still) {
      const breit = W * 1.8;
      const wo = W * 1.2 - ((state.zeit * 14 + state.camX * view.s * 0.05) % breit);
      const hoehe = view.frei + (view.hz - view.frei) * 0.34;
      const treu = nachtK() < 1;
      VOEGEL.forEach((v, i) => {
        const x = wo + v.dx;
        const y = hoehe + v.dy + Math.sin(state.zeit * 0.8 + i) * 2;
        if (x < -10 || x > W + 10) return;
        const fl = Math.sin(state.zeit * 9 + v.p) * 2.2;
        g.strokeStyle = "rgba(40, 30, 64, 0.75)";
        g.lineWidth = 1;
        g.beginPath();
        g.moveTo(x - 3.2, y - fl);
        g.quadraticCurveTo(x - 1.2, y - 1, x, y);
        g.quadraticCurveTo(x + 1.2, y - 1, x + 3.2, y - fl);
        g.stroke();
        if (treu) {
          // Im treuen Spiegel fliegen sie mit.
          const y2 = 2 * view.wl - y;
          g.strokeStyle = "rgba(30, 30, 70, 0.45)";
          g.beginPath();
          g.moveTo(x - 3.2, y2 + fl);
          g.quadraticCurveTo(x - 1.2, y2 + 1, x, y2);
          g.quadraticCurveTo(x + 1.2, y2 + 1, x + 3.2, y2 + fl);
          g.stroke();
        }
      });
    }
  }

  function zeichneSeeleben() {
    const n = nachtK();
    if (n <= 0) return;
    const W = view.cssW;
    const wl = view.wl;
    const H = view.cssH - wl;
    const still = ruhig();
    const front = wl + H * glatt(n) ** 0.85;
    // Sterne, die funkeln.
    FUNKELN.forEach((f) => {
      const ab = (view.wl - view.hz) + view.berg * BERG_TRAUM * 0.5;
      const y = wl + ab + f.y * (H - ab);
      if (y > front) return;
      const a = still ? 0.7 : 0.45 + 0.45 * Math.sin(state.zeit * (1.3 + f.p * 0.3) + f.p);
      g.globalAlpha = a * n;
      g.fillStyle = "#f4fbff";
      g.fillRect(f.x * W, y, f.r, f.r);
    });
    g.globalAlpha = 1;
    // Teilchen, die zur Wasserlinie hinauf schweben.
    if (still) return;
    SCHWEBE.forEach((p) => {
      const y = wl + 6 + (((p.y - state.zeit * p.v) % 1) + 1) % 1 * (H - 6);
      if (y > front) return;
      const x = ((((p.x * W - state.camX * view.s * 0.35 + Math.sin(state.zeit * 0.7 + p.p) * 8) % W) + W) % W);
      const a = (0.35 + 0.35 * Math.sin(state.zeit * 1.9 + p.p)) * n;
      if (p.r > 2) schein(p.farbe ? "kalt" : "violett", x, y, 0.16 * p.r, a * 0.7);
      g.globalAlpha = a;
      g.fillStyle = p.farbe === 0 ? "#e2c8ff" : "#c8fbff";
      g.fillRect(x, y, Math.max(0.8, p.r * 0.6), Math.max(0.8, p.r * 0.6));
    });
    g.globalAlpha = 1;
  }

  // Die Wasserlinie: ein heller Streif, feines Glitzern, Ringe, wo sie
  // aufsetzt – und beim Erwachen ein Licht, das darüber läuft.
  function zeichneWasserlinie() {
    const W = view.cssW;
    const wl = view.wl;
    const n = nachtK();
    const still = ruhig();
    g.fillStyle = n > 0.5 ? "rgba(170, 250, 255, 0.85)" : "rgba(255, 240, 228, 0.85)";
    g.fillRect(0, wl - 0.6, W, 1.2);
    for (let i = 0; i < 40; i += 1) {
      const lang = 3 + hash01(i * 2.3) * 12;
      const x = ((((hash01(i * 7.1) * W * 1.3 - state.camX * view.s * 0.92 + (still ? 0 : state.zeit * (4 + hash01(i) * 6))) % (W + 30)) + W + 30) % (W + 30)) - 15;
      const a = still ? 0.4 : 0.15 + 0.5 * (0.5 + 0.5 * Math.sin(state.zeit * (1.5 + hash01(i * 3)) + i));
      g.globalAlpha = a;
      g.fillStyle = n > 0.5 ? (i % 3 ? "#bffcff" : "#e6d4ff") : "#fff4ea";
      g.fillRect(x, wl + 1 + (i % 4) * 1.6, lang, 0.9);
    }
    g.globalAlpha = 1;
    // Ringe.
    state.ringe.forEach((r) => {
      const k = clamp(r.leben / r.max, 0, 1);
      const x = bildX(r.x);
      if (x < -60 || x > W + 60) return;
      const rad = (1 - k) * r.weit * view.s + 2;
      g.strokeStyle = n > 0.5 ? `rgba(170, 250, 255, ${0.65 * k})` : `rgba(255, 244, 236, ${0.6 * k})`;
      g.lineWidth = 1;
      g.beginPath();
      g.ellipse(x, wl + 1, rad, rad * 0.16, 0, 0, TAU);
      g.stroke();
    });
    // Das Erwachen: ein Licht läuft von der Läuferin aus über die Linie.
    if (state.erwacheT !== null) {
      const w = state.t - state.erwacheT;
      if (w > -0.05 && w < 1.6) {
        const x0 = bildX(state.laeuferin.x);
        const weit = Math.max(0, w) * W * 1.15;
        const kraft = clamp(1 - w / 1.6, 0, 1);
        [x0 + weit, x0 - weit * 0.6].forEach((x) => {
          schein("kalt", x, wl, 1.6, kraft);
          schein("weiss", x, wl, 0.5, kraft);
        });
        const band = g.createLinearGradient(x0 - weit * 0.6, 0, x0 + weit, 0);
        band.addColorStop(0, `rgba(170, 250, 255, ${0.2 * kraft})`);
        band.addColorStop(1, `rgba(255, 255, 255, ${0.9 * kraft})`);
        g.fillStyle = band;
        g.fillRect(x0 - weit * 0.6, wl - 1.2, weit * 1.6, 2.4);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Zeichnen: der Steg und der Nebel
  // ---------------------------------------------------------------------------
  // Ein Holzsteg über eine Bucht: Unter ihm Wasser statt Ufer, Pfähle, und
  // wo Bretter fehlen, sieht man hinab. Gespiegelt im See.
  function zeichneStege() {
    const W = view.cssW;
    const s = view.s;
    const n = nachtK();
    state.stege.forEach((st) => {
      if (bildX(st.b) < -30 || bildX(st.a) > W + 30) return;
      const luecken = state.hindernisse.filter((o) => o.kind === "luecke" && o.a >= st.a && o.b <= st.b);
      const offen = (x) => luecken.some((o) => x > o.a && x < o.b);
      [false, true].forEach((unten) => {
        const Y = unten ? untenY : obenY;
        stil = unten ? (n > 0.5 ? "nacht" : "spiegel") : "tag";
        g.save();
        g.beginPath();
        if (unten) g.rect(-10, view.wl, W + 20, view.cssH); else g.rect(-10, -10, W + 20, view.wl + 10);
        g.clip();
        // Die Bucht: Wasser statt der Uferkante.
        g.fillStyle = unten ? (n > 0.5 ? "rgb(10, 28, 56)" : F([40, 46, 92])) : "rgb(58, 66, 118)";
        const ya = Y(0.2);
        const yb = view.wl;
        g.fillRect(bildX(st.a + 6), Math.min(ya, yb), (st.b - st.a - 12) * s, Math.abs(yb - ya));
        // Pfähle – wo Bretter fehlen, nur noch Stümpfe, tiefer als der Weg.
        for (let x = st.a + 8; x < st.b - 4; x += 16) {
          const stumpf = offen(x);
          g.fillStyle = F([70, 52, 60]);
          const y0 = Y(stumpf ? -UFER + 1.2 + hash01(x) * 1.4 : -2.4);
          g.fillRect(bildX(x) - 1.1 * s, Math.min(y0, yb), 2.2 * s, Math.abs(yb - y0) + (unten ? 0 : 1));
          g.fillStyle = L([214, 160, 130], 0.5);
          g.fillRect(bildX(x) - 1.1 * s, Math.min(y0, yb), 0.6 * s, Math.abs(yb - y0));
        }
        // Lose Bretter treiben in den Lücken.
        luecken.forEach((o) => {
          for (let i = 0; i < 2; i += 1) {
            const x = o.a + (o.b - o.a) * (0.3 + i * 0.35 + hash01(o.saat * 7 + i) * 0.1);
            const dreh = (hash01(o.saat * 3 + i) - 0.5) * 0.2 + (ruhig() ? 0 : Math.sin(state.zeit * 1.3 + i) * 0.04);
            g.save();
            g.translate(bildX(x), Y(-UFER + 0.5));
            g.rotate(dreh * (unten ? -1 : 1));
            g.fillStyle = F([128, 96, 84]);
            g.fillRect(-5 * s, -0.6 * s, 10 * s, 1.2 * s);
            g.fillStyle = L([240, 196, 160], 0.6);
            g.fillRect(-5 * s, unten ? 0.3 * s : -0.6 * s, 10 * s, 0.35 * s);
            g.restore();
          }
        });
        // Das Deck: Bretter mit Fugen, vorn im Licht.
        let x = st.a;
        while (x < st.b) {
          const luecke = luecken.find((o) => o.a <= x + 0.01 && o.b > x);
          if (luecke) { x = luecke.b; continue; }
          const naechste = luecken.filter((o) => o.a > x).sort((p, q) => p.a - q.a)[0];
          const ende = Math.min(st.b, naechste ? naechste.a : st.b);
          const x0 = bildX(x);
          const x1 = bildX(ende);
          const y0 = Y(0);
          const y1 = Y(-2.6);
          // Unter den Brettern ein dunkler Balken.
          g.fillStyle = F([66, 46, 54]);
          g.fillRect(x0 + 1.5 * s, Math.min(y1, Y(-3.6)), x1 - x0 - 3 * s, Math.abs(Y(-3.6) - y1));
          g.fillStyle = F([122, 92, 82]);
          g.fillRect(x0, Math.min(y0, y1), x1 - x0, Math.abs(y1 - y0));
          g.fillStyle = L([250, 206, 170], 0.75);
          g.fillRect(x0, unten ? y0 - 0.9 : y0 - 0.2, x1 - x0, 0.9);
          g.fillStyle = F([60, 42, 50], 0.7);
          for (let f = Math.ceil(x / 5.5) * 5.5; f < ende; f += 5.5) g.fillRect(bildX(f), Math.min(y0, y1), Math.max(0.6, s * 0.4), Math.abs(y1 - y0));
          // Gesplitterte Enden an den Lücken.
          [[x, -1], [ende, 1]].forEach(([kx, seite]) => {
            if (!luecken.some((o) => Math.abs(o.a - kx) < 0.01 || Math.abs(o.b - kx) < 0.01)) return;
            g.fillStyle = F([150, 112, 96]);
            g.beginPath();
            g.moveTo(bildX(kx), y0);
            g.lineTo(bildX(kx) + seite * 1.8 * s, lerp(y0, y1, 0.3));
            g.lineTo(bildX(kx), lerp(y0, y1, 0.6));
            g.lineTo(bildX(kx) + seite * 1.2 * s, y1);
            g.lineTo(bildX(kx), y1);
            g.closePath();
            g.fill();
          });
          x = ende;
        }
        g.restore();
      });
      stil = "tag";
    });
  }

  // ---------------------------------------------------------------------------
  // Zeichnen: Stege, Felsbänder, Eisbänder – die Etagen und der obere Weg
  // ---------------------------------------------------------------------------
  /*
   * Je Landschaft ein anderer Bau, dieselbe Form: oben flach auf ETAGE, die
   * Rampen schräg. Im Lärchenufer und im Schilf ein Holzsteg auf Pfählen
   * (Bretter mit Fugen, die Kante im Morgenlicht), am Felsufer ein Felsband,
   * im Gletschersee ein Band aus Eis mit Zapfen. Der obere Weg einer
   * Gabelung steht hinter dem Ufer: Seine Pfähle (oder seine Wand) reichen
   * bis zum Weg hinab, und ein Geländer zeigt: ein anderer Weg.
   *
   * Im See dasselbe gespiegelt – treu getönt oder, im erwachten See, dunkel
   * mit leuchtender Kante (stil). An einer Sackgasse zeigt der See, welcher
   * Weg hält: Dessen Spiegelbild leuchtet von der Gabelung an, das des
   * falschen ist dunkel und zersprungen, und wo die Falle ist, fehlt es.
   */
  const BAU = ["holz", "holz", "fels", "eis"];
  const BAU_FARBE = {
    holz: { deck: [122, 92, 82], kante: [250, 206, 170], dunkel: [66, 46, 54], pfahl: [78, 58, 64], fuge: [60, 42, 50] },
    fels: { deck: [96, 90, 120], kante: [238, 196, 184], dunkel: [50, 44, 72], pfahl: [70, 64, 96], fuge: [44, 38, 64] },
    eis: { deck: [176, 214, 238], kante: [250, 254, 255], dunkel: [92, 138, 190], pfahl: [130, 182, 222], fuge: [118, 168, 210] },
  };

  // Ein Bau von x0 bis x1, die Oberkante bei hoch(x); Y bildet Höhen ab
  // (obenY oder, im See, untenY). hinten: der obere Weg einer Gabelung
  // (bis zum Weg hinab, mit Geländer). fehlt: Stücke [a, b], in denen er
  // fehlt. Aus dem Bild Ragendes wird nicht gemalt.
  function zeichneBau(x0, x1, hoch, Y, bau, wahl = {}) {
    const { hinten = false, fehlt = [], gelaender = hinten } = wahl;
    const s = view.s;
    const sa = Math.max(x0, state.camX - view.rx / s - 24);
    const sb = Math.min(x1, state.camX + (view.cssW - view.rx) / s + 24);
    if (sb <= sa) return;
    const c = BAU_FARBE[bau];
    const dick = bau === "holz" ? 2.8 : bau === "eis" ? 3.6 : 4.4;
    const fuss = hinten ? -0.5 : -UFER;
    // Die Stücke zwischen den Lücken.
    const stuecke = [];
    let von = sa;
    fehlt.slice().sort((p, q) => p[0] - q[0]).forEach(([a, b]) => {
      if (b <= von || a >= sb) return;
      if (a > von) stuecke.push([von, Math.min(a, sb)]);
      von = Math.max(von, b);
    });
    if (von < sb) stuecke.push([von, sb]);
    const rand = (x, h) => [bildX(x), Y(h)];
    const kante = (a, b, d) => {
      g.beginPath();
      for (let x = a; ; x += 4) {
        const xx = Math.min(x, b);
        const [px, py] = rand(xx, hoch(xx) - d);
        if (xx === a) g.moveTo(px, py); else g.lineTo(px, py);
        if (xx >= b) break;
      }
    };
    stuecke.forEach(([a, b]) => {
      // Pfähle (Holz, Eis) oder die Wand (Fels) bis hinab.
      if (bau === "fels") {
        // Eine Wand aus Fels: oben ein unruhiger Rand, darunter Bänder in
        // wechselndem Licht, Klüfte, nach unten dunkler.
        const rand = (x) => hoch(x) + 0.6 * Math.sin(x * 0.45) + 0.4 * Math.sin(x * 1.3);
        const wand = (d0, d1) => {
          g.beginPath();
          for (let x = a; ; x += 3) {
            const xx = Math.min(x, b);
            const y = Y(lerp(rand(xx), fuss, d0));
            if (xx === a) g.moveTo(bildX(xx), y); else g.lineTo(bildX(xx), y);
            if (xx >= b) break;
          }
          for (let x = b; ; x -= 3) {
            const xx = Math.max(x, a);
            g.lineTo(bildX(xx), Y(lerp(rand(xx), fuss, d1)));
            if (xx <= a) break;
          }
          g.closePath();
        };
        wand(0, 1);
        g.fillStyle = F(hinten ? mix3(c.deck, c.dunkel, 0.3) : c.deck);
        g.fill();
        [[0, 0.16, c.kante, 0.32], [0.3, 0.42, c.dunkel, 0.35], [0.55, 0.62, c.kante, 0.14], [0.7, 1, c.dunkel, 0.5]].forEach(([d0, d1, farbe, a2]) => {
          wand(d0, d1);
          g.fillStyle = F(farbe, a2);
          g.fill();
        });
        g.strokeStyle = F(c.fuge, 0.6);
        g.lineWidth = Math.max(0.6, s * 0.4);
        g.beginPath();
        for (let x = Math.ceil(a / 13) * 13; x < b; x += 13) {
          const z = hash01(x * 0.71);
          const h = rand(x);
          g.moveTo(bildX(x + z * 4), Y(h - 0.5));
          g.lineTo(bildX(x + z * 4 - 0.8), Y(lerp(h, fuss, 0.35)));
          g.lineTo(bildX(x + z * 4 + 0.6), Y(lerp(h, fuss, 0.7 + z * 0.25)));
        }
        g.stroke();
      } else {
        const breit = bau === "eis" ? 2.8 : 2.2;
        for (let x = Math.ceil((a - 2) / 16) * 16 + 6; x < b - 1; x += 16) {
          const h = hoch(x) - dick;
          if (h <= 0.5 && !hinten) continue;
          const y0 = Y(h);
          const y1 = Y(fuss);
          g.fillStyle = F(c.pfahl);
          g.fillRect(bildX(x) - breit * 0.5 * s, Math.min(y0, y1), breit * s, Math.abs(y1 - y0));
          g.fillStyle = L(c.kante, 0.4);
          g.fillRect(bildX(x) - breit * 0.5 * s, Math.min(y0, y1), 0.6 * s, Math.abs(y1 - y0));
          if (bau === "holz" && !hinten) {
            // Ein Querbalken zwischen zwei Pfählen.
            g.strokeStyle = F(c.dunkel, 0.8);
            g.lineWidth = Math.max(0.6, s * 0.5);
            g.beginPath();
            g.moveTo(bildX(x), Y(h - 1));
            g.lineTo(bildX(x + 16), Y(lerp(h, fuss, 0.7)));
            g.stroke();
          }
        }
        // Das Deck.
        kante(a, b, 0);
        for (let x = b; ; x -= 4) {
          const xx = Math.max(x, a);
          g.lineTo(bildX(xx), Y(hoch(xx) - dick));
          if (xx <= a) break;
        }
        g.closePath();
        g.fillStyle = F(c.deck);
        g.fill();
        // Darunter ein dunkler Balken, die Fugen der Bretter.
        g.fillStyle = F(c.dunkel, 0.85);
        kante(a, b, dick - 0.2);
        for (let x = b; ; x -= 4) {
          const xx = Math.max(x, a);
          g.lineTo(bildX(xx), Y(hoch(xx) - dick - 1.1));
          if (xx <= a) break;
        }
        g.closePath();
        g.fill();
        g.strokeStyle = F(c.fuge, bau === "eis" ? 0.4 : 0.75);
        g.lineWidth = Math.max(0.5, s * 0.35);
        g.beginPath();
        for (let x = Math.ceil(a / 5.5) * 5.5; x < b; x += 5.5) {
          const h = hoch(x);
          g.moveTo(bildX(x), Y(h));
          g.lineTo(bildX(x), Y(h - dick));
        }
        g.stroke();
        if (bau === "eis") {
          // Zapfen an der Kante.
          g.fillStyle = L(c.kante, 0.75);
          g.beginPath();
          for (let x = Math.ceil(a / 3.2) * 3.2; x < b; x += 3.2) {
            const h = hoch(x) - dick;
            const lang = 1.2 + hash01(x * 1.3) * 3.4;
            g.moveTo(bildX(x - 0.9), Y(h));
            g.lineTo(bildX(x), Y(h - lang));
            g.lineTo(bildX(x + 0.9), Y(h));
          }
          g.fill();
        }
      }
      // Die Oberkante im Licht.
      g.strokeStyle = L(c.kante, 0.85);
      g.lineWidth = Math.max(0.8, s * 0.55);
      kante(a, b, 0);
      g.stroke();
      if (bau === "fels") {
        // Gras und Moos obenauf.
        g.strokeStyle = F([120, 140, 96], 0.8);
        g.lineWidth = Math.max(0.5, s * 0.3);
        g.beginPath();
        for (let x = Math.ceil(a / 7) * 7; x < b; x += 7) {
          const h = hoch(x);
          const z = hash01(x * 0.37);
          for (let j = 0; j < 3; j += 1) {
            g.moveTo(bildX(x + j * 0.8), Y(h));
            g.lineTo(bildX(x + j * 0.8 + (j - 1) * 0.6), Y(h + 1 + z * 1.6));
          }
        }
        g.stroke();
      }
      if (gelaender) {
        // Ein Geländer: Pfosten und ein Handlauf.
        g.strokeStyle = F(bau === "eis" ? c.pfahl : c.dunkel, 0.9);
        g.lineWidth = Math.max(0.7, s * 0.5);
        g.beginPath();
        for (let x = Math.ceil(a / 12) * 12; x <= b; x += 12) {
          g.moveTo(bildX(x), Y(hoch(x)));
          g.lineTo(bildX(x), Y(hoch(x) + 7.5));
        }
        g.stroke();
        g.strokeStyle = L(c.kante, 0.6);
        g.lineWidth = Math.max(0.6, s * 0.4);
        kante(a, b, -7.5);
        g.stroke();
      }
    });
  }

  // Wie deutlich etwas einer Spur zu sehen ist: Nach der Wahl an einer
  // Gabelung tritt der andere Weg zurück.
  function spurDeutlich(spur, x) {
    const r = state.laeuferin;
    if (!r || state.phase === "bereit") return 1;
    const meine = state.schritt === "sturz" ? state.sturz.spur : spurJetzt(r);
    if (spur === meine) return 1;
    const gb = gabelBei(x);
    if (!gb) return 1;
    if (meine === 1) return 0.32;
    return state.t > gb.fenster.hi + 0.05 ? 0.32 : 1;
  }

  // Die Höhe einer Etage (Spur 0) und des oberen Wegs einer Gabelung.
  const etageHoch = (et) => (x) => ETAGE * clamp(Math.min(x - et.a, et.b - x) / RAMPE, 0, 1);
  const gabelHoch = (gb) => (x) => (gb.xM === null || x <= gb.xM ? ETAGE : ETAGE * clamp(1 - (x - gb.xM) / RAMPE, 0, 1));

  // Das Sichtbare einer Liste von Bauten (nach a geordnet).
  function sichtbareBauten(liste, a, b, fn) {
    const von = state.camX - view.rx / view.s - 60;
    const bis = state.camX + (view.cssW - view.rx) / view.s + 60;
    liste.forEach((e) => { if (b(e) > von && a(e) < bis) fn(e); });
  }

  // Die Etagen: ein Steg, Felsband oder Eisband auf dem Weg am Ufer.
  function zeichneEtagen(unten) {
    const n = nachtK();
    sichtbareBauten(state.etagen, (e) => e.a, (e) => e.b, (et) => {
      const hoch = etageHoch(et);
      stil = unten ? (n > 0.5 ? "nacht" : "spiegel") : "tag";
      zeichneBau(et.a, et.b, hoch, unten ? untenY : obenY, BAU[et.land]);
      if (unten && n > 0.5) leuchtKante(et.a, et.b, hoch, 0.5);
      stil = "tag";
    });
  }

  // Eine leuchtende Kante im erwachten See, entlang der Oberkante eines
  // gespiegelten Wegs.
  function leuchtKante(a, b, hoch, kraft, farbe = [150, 250, 255]) {
    const sa = Math.max(a, state.camX - view.rx / view.s - 10);
    const sb = Math.min(b, state.camX + (view.cssW - view.rx) / view.s + 10);
    if (sb <= sa) return;
    g.strokeStyle = rgba(farbe, kraft);
    g.lineWidth = Math.max(0.8, view.s * 0.6);
    g.beginPath();
    for (let x = sa; ; x += 4) {
      const xx = Math.min(x, sb);
      const py = untenY(hoch(xx)) + 0.5;
      if (xx === sa) g.moveTo(bildX(xx), py); else g.lineTo(bildX(xx), py);
      if (xx >= sb) break;
    }
    g.stroke();
  }

  // Die Gabelungen: der obere Weg hinter dem Ufer, seine Treppe, die
  // Absprungstelle, die Fallen – und was der See zeigt.
  function zeichneGabeln(unten) {
    const n = nachtK();
    const s = view.s;
    sichtbareBauten(state.gabeln, (gb) => gb.xS - 30, (gb) => (gb.xT !== null && gb.falsch === 1 ? gb.xT + 100 : gb.xEnde), (gb) => {
      const hoch = gabelHoch(gb);
      const bau = BAU[gb.land];
      const ende = gb.falsch === 1 ? gb.xT + 92 : gb.xEnde;
      const deutlich = spurDeutlich(1, gb.xE + 10);
      const Y = unten ? untenY : obenY;
      g.globalAlpha = deutlich;
      stil = unten ? (n > 0.5 ? "nacht" : "spiegel") : "tag";
      // Die Treppe hinauf zur Kante, hinter dem Weg.
      const stufen = 4;
      for (let i = 0; i < stufen; i += 1) {
        const x = gb.xE - 16 + i * 4;
        const h = (ETAGE * (i + 1)) / stufen;
        g.fillStyle = F(BAU_FARBE[bau].dunkel);
        g.fillRect(bildX(x), Math.min(Y(h), Y(0)), 4.2 * s, Math.abs(Y(h) - Y(0)));
        g.fillStyle = L(BAU_FARBE[bau].kante, 0.7);
        g.fillRect(bildX(x), Y(h) - (unten ? 0 : 0.6 * s), 4.2 * s, 0.6 * s);
      }
      // Der Weg selbst. Im See fehlt an der Falle ein Stück, oben (noch)
      // nicht – erst, wenn er unter ihr einbricht.
      const gebrochen = gb.falsch === 1 && (unten || state.hindernisse.some((o) => o.nr === gb.nr && o.art === "bruch" && o.gebrochen !== undefined));
      const fehlt = gebrochen ? [[gb.xT, gb.xT + 92]] : [];
      zeichneBau(gb.xE, ende, hoch, Y, bau, { hinten: true, fehlt });
      if (!unten && gb.falsch === 1 && !gebrochen) {
        // Kurz bevor sie dort ist, knackt es: Die Bretter über der Falle
        // biegen sich und reissen.
        const nah = clamp(1 - (gb.xT - state.laeuferin.x) / 60, 0, 1) * (spurJetzt(state.laeuferin) === 1 ? 1 : 0);
        if (nah > 0) {
          g.strokeStyle = rgba([40, 20, 24], 0.7 * nah);
          g.lineWidth = Math.max(0.7, s * 0.45);
          g.beginPath();
          for (let i = 0; i < 6; i += 1) {
            const x = gb.xT + 6 + i * 14;
            g.moveTo(bildX(x), Y(ETAGE));
            g.lineTo(bildX(x + 2 + hash01(i) * 3), Y(ETAGE - 1.6));
            g.lineTo(bildX(x + 1), Y(ETAGE - 2.8));
          }
          g.stroke();
        }
      }
      g.globalAlpha = 1;
      if (unten && n > 0.5) {
        // Der See zeigt, welcher Weg hält: Dessen Spiegelbild leuchtet hell,
        // das des falschen ist dunkel und zersprungen – von der Gabelung an.
        const zittern = ruhig() ? 1 : 0.8 + 0.2 * Math.sin(state.zeit * 3.1);
        const unterer = () => 0;
        if (gb.falsch === -1) {
          leuchtBand(gb.xE - 16, ende, hoch, 0.6 * zittern);
          leuchtBand(gb.xS, gb.xEnde, unterer, 0.6 * zittern);
        } else {
          const haelt = gb.falsch === 1 ? unterer : hoch;
          const ha = gb.falsch === 1 ? gb.xS : gb.xE - 16;
          const hb = gb.falsch === 1 ? gb.xT + 240 : ende;
          leuchtBand(ha, hb, haelt, zittern);
          if (gb.falsch === 1) {
            zeichneSprung(gb.xE - 16, gb.xT + 92, hoch, [255, 110, 150], 0.9, gb.nr);
            zeichneBruchkanten(gb.xT, gb.xT + 92, ETAGE);
          } else {
            zeichneSprung(gb.xS, gb.xT + 40, unterer, [255, 110, 150], 0.9, gb.nr + 7);
          }
          // Lichtperlen auf dem Weg, der hält.
          if (!ruhig()) {
            for (let i = 0; i < 10; i += 1) {
              const x = ha + ((i / 10 + state.zeit * 0.12 + hash01(gb.nr + i) * 0.1) % 1) * (hb - ha);
              schein("kalt", bildX(x), untenY(haelt(x)) + 1, 0.26, 0.7 * zittern);
            }
          }
        }
      }
      stil = "tag";
      if (!unten) {
        // Die Absprungstelle auf dem Weg: Wer hier springt, kommt hinauf.
        const xa = xBei(gb.fenster.lo);
        const xb = xBei(gb.fenster.hi);
        const vorbei = state.t > gb.fenster.hi + 0.3 && state.phase !== "bereit";
        if (!vorbei) {
          const puls = ruhig() ? 0.8 : 0.6 + 0.4 * Math.sin(state.zeit * 6);
          g.fillStyle = rgba([255, 232, 170], 0.55 * puls);
          g.fillRect(bildX(xa), obenY(0) - 0.7 * s, (xb - xa) * s, 1.4 * s);
          for (let i = 0; i < 3; i += 1) {
            const x = lerp(xa, xb, (i + 0.5) / 3);
            schein("warm", bildX(x), obenY(0.4), 0.3, 0.55 * puls);
          }
        }
        if (gb.bonus) {
          // Am Fuss der Treppe ein Schild: so viel schenkt der Steg.
          const x = gb.xE - 24;
          g.fillStyle = "rgba(60, 40, 40, 0.9)";
          g.fillRect(bildX(x) - 0.5 * s, obenY(9), 1 * s, 9 * s);
          g.fillStyle = "rgba(255, 224, 138, 0.95)";
          g.beginPath();
          g.roundRect(bildX(x) - 6 * s, obenY(13), 12 * s, 5 * s, 1.2 * s);
          g.fill();
          g.fillStyle = "rgb(70, 44, 30)";
          g.font = `800 ${Math.max(7, Math.round(3.6 * s))}px system-ui, sans-serif`;
          g.textAlign = "center";
          g.textBaseline = "middle";
          g.fillText(`+${gb.bonus}`, bildX(x), obenY(10.5));
        }
      }
    });
  }

  // Ein Weg, der hält, im erwachten See: ein breiter, weicher Schein und
  // darin eine helle Linie.
  function leuchtBand(a, b, hoch, kraft) {
    const sa = Math.max(a, state.camX - view.rx / view.s - 10);
    const sb = Math.min(b, state.camX + (view.cssW - view.rx) / view.s + 10);
    if (sb <= sa) return;
    const pfad = () => {
      g.beginPath();
      for (let x = sa; ; x += 4) {
        const xx = Math.min(x, sb);
        const py = untenY(hoch(xx)) + 0.8;
        if (xx === sa) g.moveTo(bildX(xx), py); else g.lineTo(bildX(xx), py);
        if (xx >= sb) break;
      }
    };
    g.lineCap = "round";
    [[5, 0.2], [2.6, 0.4], [1, 0.95]].forEach(([b2, a2]) => {
      g.strokeStyle = rgba([200, 255, 236], a2 * kraft);
      g.lineWidth = Math.max(0.8, view.s * b2);
      pfad();
      g.stroke();
    });
  }

  // Ein zersprungenes Spiegelbild: ein dunkles Band mit Rissen entlang
  // eines gespiegelten Wegs.
  function zeichneSprung(a, b, hoch, farbe, kraft, saat) {
    const sa = Math.max(a, state.camX - view.rx / view.s - 10);
    const sb = Math.min(b, state.camX + (view.cssW - view.rx) / view.s + 10);
    if (sb <= sa) return;
    const s = view.s;
    g.fillStyle = "rgba(6, 4, 18, 0.55)";
    g.beginPath();
    for (let x = sa; ; x += 4) {
      const xx = Math.min(x, sb);
      if (xx === sa) g.moveTo(bildX(xx), untenY(hoch(xx)) - 1.2 * s); else g.lineTo(bildX(xx), untenY(hoch(xx)) - 1.2 * s);
      if (xx >= sb) break;
    }
    for (let x = sb; ; x -= 4) {
      const xx = Math.max(x, sa);
      g.lineTo(bildX(xx), untenY(hoch(xx)) + 2.4 * s);
      if (xx <= sa) break;
    }
    g.closePath();
    g.fill();
    // Ein Riss, der zackig dem Weg folgt, mit Ästen in die Tiefe.
    g.strokeStyle = rgba(farbe, kraft);
    g.lineWidth = Math.max(0.7, s * 0.45);
    g.lineJoin = "miter";
    g.beginPath();
    let erst = true;
    for (let x = Math.ceil(sa / 4) * 4; x < sb; x += 4) {
      const z = hash01(Math.round(x) * 0.13 + saat);
      const y = untenY(hoch(x)) + (0.4 + z * 2.2) * s;
      if (erst) { g.moveTo(bildX(x), y); erst = false; } else g.lineTo(bildX(x), y);
    }
    for (let x = Math.ceil(sa / 13) * 13; x < sb; x += 13) {
      const z = hash01(x * 0.29 + saat);
      const y = untenY(hoch(x)) + (0.4 + hash01(Math.round(x) * 0.13 + saat) * 2.2) * s;
      g.moveTo(bildX(x), y);
      g.lineTo(bildX(x + 2 + z * 3), y + (3 + z * 4) * s);
      g.lineTo(bildX(x + 1 + z * 5), y + (6 + z * 5) * s);
    }
    g.stroke();
  }

  // Die Enden eines gebrochenen Stegs im See: Splitter, ein schiefer Pfahl.
  function zeichneBruchkanten(a, b, h) {
    const s = view.s;
    g.strokeStyle = "rgba(255, 140, 170, 0.8)";
    g.lineWidth = Math.max(0.8, s * 0.5);
    g.beginPath();
    [[a, 1], [b, -1]].forEach(([x, seite]) => {
      g.moveTo(bildX(x), untenY(h));
      g.lineTo(bildX(x + seite * 2.5), untenY(h - 1.2));
      g.lineTo(bildX(x + seite * 0.6), untenY(h - 2));
      g.lineTo(bildX(x + seite * 3.2), untenY(h - 3));
    });
    // Ein Pfahl, der schief im Wasser steht.
    g.moveTo(bildX(a + 30), view.wl);
    g.lineTo(bildX(a + 40), untenY(h - 6));
    g.stroke();
  }

  // Der Felssturz einer Sackgasse: oben erst zu sehen, wenn sie fast dort
  // ist (davor Büsche hinter dem Weg); im See von Anfang an.
  function zeichneFelssturz(o, unten) {
    const s = view.s;
    const n = nachtK();
    const nah = clamp(1 - (o.a - state.laeuferin.x) / 60, 0, 1);
    const sichtbar = unten ? 1 : state.schritt === "sturz" && state.sturz?.art === "fels" ? 1 : nah * nah;
    const Y = unten ? untenY : obenY;
    if (!unten) {
      // Büsche hinter dem Weg, wie überall am Ufer.
      for (let i = 0; i < 5; i += 1) {
        const x = o.a - 14 + i * 13 + hash01(o.saat * 9 + i) * 4;
        const r = 4.5 + hash01(o.saat * 5 + i) * 3;
        g.fillStyle = rgba(i % 2 ? [70, 84, 70] : [58, 72, 64], 0.9);
        g.beginPath();
        g.ellipse(bildX(x), obenY(r * 0.8 + 1), r * 1.3 * s, r * s, 0, 0, TAU);
        g.fill();
        g.fillStyle = rgba([200, 170, 150], 0.35);
        g.beginPath();
        g.ellipse(bildX(x - r * 0.4), obenY(r * 1.25 + 1), r * 0.6 * s, r * 0.4 * s, 0, 0, TAU);
        g.fill();
      }
    }
    if (sichtbar <= 0.01) return;
    g.globalAlpha *= sichtbar;
    stil = unten ? (n > 0.5 ? "nacht" : "spiegel") : "tag";
    // Brocken, übereinander gestürzt: unregelmässig rund, links im Licht,
    // rechts im Schatten, Geröll am Fuss.
    const bloecke = [[0.08, 0, 15, 13], [0.42, 0, 18, 17], [0.78, 0, 14, 12], [0.24, 11, 14, 15], [0.6, 13, 15, 16], [0.4, 26, 13, 14], [0.66, 31, 10, 11], [0.16, 23, 10, 10], [0.5, 40, 9, 9]];
    const brocken = (x, h0, b, h, i, d) => {
      g.beginPath();
      for (let j = 0; j < 9; j += 1) {
        const w = (j / 9) * TAU;
        const r = 0.82 + 0.22 * hash01(o.saat * 17 + i * 9 + j);
        const px = x + Math.cos(w) * b * 0.5 * r * d;
        const py = h0 + h * 0.5 + Math.sin(w) * h * 0.5 * r * d;
        if (j) g.lineTo(bildX(px), Y(py)); else g.moveTo(bildX(px), Y(py));
      }
      g.closePath();
    };
    bloecke.forEach(([u, h0, b, h], i) => {
      const x = o.a + u * (o.b - o.a);
      brocken(x, h0, b, h, i, 1);
      g.fillStyle = F(i % 3 ? [88, 82, 108] : [104, 96, 120]);
      g.fill();
      g.save();
      g.clip();
      g.fillStyle = L([236, 186, 170], 0.5);
      g.fillRect(bildX(x - b * 0.6), Math.min(Y(h0 + h), Y(h0)), b * 0.42 * view.s, h * view.s);
      g.fillStyle = F([46, 40, 66], 0.55);
      g.fillRect(bildX(x + b * 0.15), Math.min(Y(h0 + h), Y(h0)), b * 0.5 * view.s, h * view.s);
      g.fillStyle = F([96, 130, 86], 0.6);
      g.fillRect(bildX(x - b * 0.5), Math.min(Y(h0 + h * 1.02), Y(h0 + h * 0.86)), b * view.s, h * 0.14 * view.s);
      g.restore();
    });
    g.fillStyle = F([110, 100, 126]);
    for (let i = 0; i < 14; i += 1) {
      const x = o.a - 6 + hash01(o.saat * 5 + i) * (o.b - o.a + 12);
      const r = 0.8 + hash01(o.saat * 7 + i) * 1.6;
      g.beginPath();
      g.ellipse(bildX(x), Y(r * 0.5), r * view.s, r * 0.6 * view.s, 0, 0, TAU);
      g.fill();
    }
    if (unten && n > 0.5) {
      // Im erwachten See glühen seine Kanten warnend.
      schein("violett", bildX((o.a + o.b) / 2), untenY(24), 2.2, 0.55);
      g.strokeStyle = "rgba(255, 130, 160, 0.75)";
      g.lineWidth = Math.max(0.8, s * 0.5);
      g.beginPath();
      g.moveTo(bildX(o.a - 1), untenY(0));
      g.lineTo(bildX(o.a + 4), untenY(20));
      g.lineTo(bildX(o.a + 14), untenY(36));
      g.lineTo(bildX(o.a + 26), untenY(44));
      g.lineTo(bildX(o.b - 4), untenY(30));
      g.lineTo(bildX(o.b + 1), untenY(0));
      g.stroke();
    }
    stil = "tag";
    g.globalAlpha /= sichtbar;
  }

  // Das Spiegeltor: ein Bogen aus Licht über dem Weg, im See gespiegelt. Wo
  // sie hindurchläuft, flammt er auf.
  function zeichneTore(unten) {
    const s = view.s;
    state.tore.forEach((tor) => {
      const x = bildX(tor.x);
      if (x < -60 || x > view.cssW + 60) return;
      const Y = unten ? untenY : obenY;
      const nah = clamp(1 - Math.abs(state.laeuferin.x - tor.x) / 40, 0, 1);
      const puls = ruhig() ? 0.8 : 0.75 + 0.25 * Math.sin(state.zeit * 4 + tor.nummer);
      const hoch = DECKE + 22;
      const breit = 13;
      const kraft = (0.7 + nah * 0.6) * puls;
      // Der Schein im Bogen.
      schein("violett", x, Y(hoch * 0.55), 4.2 * s / 3, 0.35 * kraft);
      schein("kalt", x, Y(hoch * 0.55), 3 * s / 3, 0.3 * kraft);
      // Die Säulen und der Bogen: ein breiter weicher Strich, darüber ein
      // heller feiner.
      const bogen = () => {
        g.beginPath();
        g.moveTo(x - breit * s, Y(0));
        g.lineTo(x - breit * s, Y(hoch - breit));
        g.arc(x, Y(hoch - breit), breit * s, Math.PI, 0, !unten);
        g.lineTo(x + breit * s, Y(0));
      };
      g.lineCap = "round";
      [[5.5, [190, 140, 255], 0.22], [2.6, [170, 240, 255], 0.55], [1, [255, 255, 255], 0.95]].forEach(([b, farbe, a]) => {
        g.strokeStyle = rgba(farbe, a * Math.min(1, kraft));
        g.lineWidth = b * s * 0.5;
        bogen();
        g.stroke();
      });
      // Funken, die im Bogen aufsteigen.
      if (!ruhig()) {
        for (let i = 0; i < 10; i += 1) {
          const u = ((state.zeit * 0.35 + hash01(tor.nummer * 7 + i)) % 1);
          const seite = i % 2 ? 1 : -1;
          const px = x + seite * breit * s * (0.6 + 0.4 * Math.sin(u * 7 + i));
          schein("weiss", px, Y(u * hoch), 0.12, (1 - u) * 0.8 * kraft);
        }
      }
    });
  }

  function zeichneNebel() {
    if (!ebenen?.nebelRand || !state.nebel.length) return;
    const dpr = view.dpr;
    const W = view.cssW;
    const h = ebenen.nebelH;
    const y = Math.round((view.wl + 1) * dpr) - h;
    const [randL, randR] = ebenen.nebelRand;
    const rand = randL.width;
    const schwade = ebenen.nebelSchwade;
    basis(1);
    state.nebel.forEach((nb) => {
      const xa = Math.round(bildX(nb.a) * dpr);
      const xb = Math.round(bildX(nb.b) * dpr);
      if (xb < 0 || xa > W * dpr) return;
      if (xb - xa > 2 * rand) {
        g.fillStyle = nebelVerlauf(g, y, h);
        g.fillRect(Math.max(-4, xa + rand), y, Math.min(canvas.width + 4, xb - rand) - Math.max(-4, xa + rand), h);
      }
      g.drawImage(randL, xa, y);
      g.drawImage(randR, xb - rand, y);
      // Die Schwaden ziehen langsam gegen die Läuferin.
      if (ruhig()) return;
      const lang = nb.b - nb.a;
      for (let i = 0; i < Math.ceil(lang / 26); i += 1) {
        const x = nb.a + ((i * 26 + hash01(i * 3.3 + nb.nr) * 20 - state.zeit * 7) % lang + lang) % lang;
        const kraft = nebelBei(x);
        if (kraft <= 0.05) continue;
        const sx = Math.round(bildX(x) * dpr - schwade.width / 2);
        if (sx > canvas.width || sx + schwade.width < 0) continue;
        const sy = Math.round(obenY(DECKE * (0.25 + hash01(i * 7.1 + nb.nr) * 0.85)) * dpr - schwade.height / 2);
        g.globalAlpha = kraft * (0.55 + 0.35 * Math.sin(state.zeit * 0.9 + i));
        g.drawImage(schwade, sx, sy);
      }
      g.globalAlpha = 1;
    });
    basis();
  }

  // Wie dicht der Nebel an der Stelle x ist (für das, was er verdeckt).
  function nebelBei(x) {
    for (const nb of state.nebel) {
      if (x > nb.a && x < nb.b) return clamp(Math.min(x - nb.a, nb.b - x) / 60, 0, 1);
    }
    return 0;
  }

  // ---------------------------------------------------------------------------
  // Zeichnen: die Hindernisse oben
  // ---------------------------------------------------------------------------
  /*
   * Jedes wird mit Y gezeichnet (Höhe über dem Weg → Bild): oben obenY, als
   * treues Spiegelbild im See untenY – dann steht es kopfüber, wie es soll,
   * und das Licht auf ihm auch. Der Umriss ist genau der, an dem man
   * anstösst (profil bzw. DECKE).
   */
  function profilPfad(o, Y, n = 18) {
    g.beginPath();
    g.moveTo(bildX(o.a - 0.5), Y(-1.5));
    for (let i = 0; i <= n; i += 1) {
      const x = o.a + ((o.b - o.a) * i) / n;
      g.lineTo(bildX(x), Y(profil(o, x)));
    }
    g.lineTo(bildX(o.b + 0.5), Y(-1.5));
    g.closePath();
  }

  // Ein Granitblock: Flächen in verschiedenem Licht (links die Morgenröte),
  // Reif obenauf, Flechten, ein Riss.
  // Je Landschaft ein anderer Fels: Granit im Morgenrot, am Felsufer
  // dunkler Gneis mit Moos, am Gletscher mit Schnee.
  const STEIN_FARBE = [
    { grund: [92, 86, 118], licht: [196, 150, 150], glanz: [236, 176, 160], schatten: [60, 56, 92], flechte: [184, 178, 96] },
    { grund: [104, 92, 108], licht: [204, 164, 140], glanz: [246, 200, 150], schatten: [66, 58, 84], flechte: [150, 170, 90] },
    { grund: [70, 74, 92], licht: [140, 140, 150], glanz: [200, 196, 196], schatten: [40, 44, 64], flechte: [96, 150, 88] },
    { grund: [96, 108, 140], licht: [170, 186, 214], glanz: [226, 236, 250], schatten: [62, 72, 110], flechte: [200, 220, 240] },
  ];
  function zeichneStein(o, Y) {
    const s = view.s;
    const w = o.b - o.a;
    const z = (i) => hash01(o.saat * 97 + i * 13.7);
    const P = (u, v) => [bildX(o.a + u * w), Y(v * o.h)];
    const C = STEIN_FARBE[o.land || 0];
    // Sein Schatten auf dem Weg, nach rechts.
    g.fillStyle = F([40, 30, 60], 0.35);
    g.beginPath();
    const [sx, sy] = P(0.6, 0);
    g.ellipse(sx + w * 0.2 * s, sy, w * 0.6 * s, 1.2 * s, 0, 0, TAU);
    g.fill();
    profilPfad(o, Y);
    g.fillStyle = F(C.grund);
    g.fill();
    g.save();
    profilPfad(o, Y);
    g.clip();
    const flaeche = (punkte, farbe) => {
      g.fillStyle = farbe;
      g.beginPath();
      punkte.forEach(([u, v], i) => { const [x, y] = P(u, v); if (i) g.lineTo(x, y); else g.moveTo(x, y); });
      g.closePath();
      g.fill();
    };
    const p = o.p;
    flaeche([[-0.05, -0.1], [-0.05, 0.7], [p * 0.6, 1.1], [p + 0.03, 1.1], [p - 0.05 + z(1) * 0.1, 0.5], [p * 0.5 + z(2) * 0.1, -0.1]], F(C.licht));
    flaeche([[-0.05, 0.5], [p * 0.45, 1.1], [p * 0.8, 1.1], [p * 0.5, 0.64 + z(3) * 0.1]], L(C.glanz));
    flaeche([[p + 0.1, 1.1], [1.05, 0.65], [1.05, -0.1], [p + 0.1 + z(5) * 0.12, -0.1], [p + 0.2, 0.52]], F(C.schatten));
    // Reif obenauf (am Gletscher eine Kappe aus Schnee).
    const kappe = o.land === 3 ? 3.4 : 2.2;
    g.fillStyle = L([240, 244, 255], o.land === 3 ? 0.95 : 0.85);
    g.beginPath();
    for (let i = 0; i <= 12; i += 1) {
      const x = o.a + w * (0.08 + 0.84 * (i / 12));
      const y = profil(o, x);
      if (i === 0) g.moveTo(bildX(x), Y(y + 0.2)); else g.lineTo(bildX(x), Y(y + 0.2));
    }
    for (let i = 12; i >= 0; i -= 1) {
      const x = o.a + w * (0.08 + 0.84 * (i / 12));
      const y = profil(o, x);
      g.lineTo(bildX(x), Y(y - Math.min(kappe, y * (o.land === 3 ? 0.3 : 0.18)) * (0.6 + 0.4 * Math.sin(i * 1.7 + o.saat * 9))));
    }
    g.closePath();
    g.fill();
    // Flechten (Moos, Eis) und ein Riss.
    g.fillStyle = F(C.flechte, 0.7);
    for (let i = 0; i < 4; i += 1) {
      const [x, y] = P(0.15 + z(10 + i) * 0.7, 0.2 + z(14 + i) * 0.4);
      g.beginPath();
      g.arc(x, y, (0.5 + z(18 + i) * 0.7) * s, 0, TAU);
      g.fill();
    }
    g.strokeStyle = F([40, 34, 62], 0.32);
    g.lineWidth = Math.max(0.5, s * 0.3);
    g.beginPath();
    const [ax, ay] = P(0.3 + z(20) * 0.4, 0.75);
    const [bx, by] = P(0.35 + z(21) * 0.3, 0.45);
    const [cx, cy] = P(0.3 + z(22) * 0.4, 0.15);
    g.moveTo(ax, ay);
    g.lineTo(bx, by);
    g.lineTo(cx, cy);
    g.stroke();
    g.restore();
    // Der Rand im Morgenlicht.
    g.strokeStyle = L([255, 222, 200], 0.9);
    g.lineWidth = 1;
    g.beginPath();
    const gipfel = o.a + o.p * w;
    for (let i = 0; i <= 10; i += 1) {
      const x = o.a + (gipfel - o.a) * (i / 10);
      if (i === 0) g.moveTo(bildX(x), Y(profil(o, x)) + 0.3); else g.lineTo(bildX(x), Y(profil(o, x)) + 0.3);
    }
    g.stroke();
  }

  // Ein umgestürzter Lärchenstamm: Rinde mit Furchen, Moos und Reif oben,
  // vorn die Schnittfläche mit Jahrringen.
  function zeichneStamm(o, Y) {
    const s = view.s;
    const w = o.b - o.a;
    g.fillStyle = F([40, 30, 60], 0.3);
    g.fillRect(bildX(o.a + 2), Math.min(Y(0), Y(-0.6)), (w + 6) * s, 1.4 * s);
    profilPfad(o, Y);
    g.fillStyle = F([96, 64, 64]);
    g.fill();
    g.save();
    profilPfad(o, Y);
    g.clip();
    // Unten im Schatten, oben im Licht.
    g.fillStyle = F([58, 40, 52]);
    g.fillRect(bildX(o.a), Math.min(Y(0), Y(o.h * 0.4)), w * s, o.h * 0.4 * s + 1);
    g.fillStyle = L([214, 150, 128], 0.75);
    g.fillRect(bildX(o.a), Math.min(Y(o.h * 0.72), Y(o.h)), w * s, o.h * 0.28 * s);
    // Furchen in der Rinde.
    g.strokeStyle = F([46, 30, 42], 0.6);
    g.lineWidth = Math.max(0.6, s * 0.4);
    g.beginPath();
    for (let i = 1; i < 5; i += 1) {
      const y = o.h * (i / 5);
      g.moveTo(bildX(o.a), Y(y));
      for (let x = o.a; x <= o.b; x += 6) g.lineTo(bildX(x), Y(y + Math.sin(x * 0.4 + i * 2 + o.saat * 9) * 0.5));
    }
    g.stroke();
    // Moos und Reif.
    g.fillStyle = F([110, 138, 92], 0.85);
    for (let x = o.a + 4; x < o.b - 4; x += 7) {
      const r = (1.2 + hash01(x * 0.3 + o.saat) * 1.6) * s;
      g.beginPath();
      g.ellipse(bildX(x), Y(profil(o, x) - 0.4), r * 1.4, r * 0.6, 0, 0, TAU);
      g.fill();
    }
    g.fillStyle = L([242, 246, 255], 0.8);
    g.fillRect(bildX(o.a + 3), Math.min(Y(o.h + 0.1), Y(o.h - 0.7)), (w - 6) * s, 0.8 * s);
    g.restore();
    // Die Schnittfläche vorn: hell, mit Ringen.
    const ex = bildX(o.b - o.h * 0.18);
    const ey = Y(o.h / 2);
    g.fillStyle = F([226, 176, 132]);
    g.beginPath();
    g.ellipse(ex, ey, o.h * 0.22 * s, o.h * 0.5 * s, 0, 0, TAU);
    g.fill();
    g.strokeStyle = F([156, 102, 80], 0.8);
    g.lineWidth = Math.max(0.5, s * 0.3);
    for (let r = 0.32; r > 0.05; r -= 0.12) {
      g.beginPath();
      g.ellipse(ex, ey, o.h * r * 0.44 * s, o.h * r * s, 0, 0, TAU);
      g.stroke();
    }
    // Ein Aststummel obenauf.
    const st = o.a + w * (0.3 + o.saat * 0.3);
    g.strokeStyle = F([84, 58, 60]);
    g.lineWidth = Math.max(1, s * 1.2);
    g.beginPath();
    g.moveTo(bildX(st), Y(o.h - 0.5));
    g.lineTo(bildX(st + 2.5), Y(Math.min(o.h + 2.2, o.h * 1.1)));
    g.stroke();
  }

  // Ein Ast über dem Weg: der unterste, schwere Ast einer Lärche, die
  // hinter dem Weg steht (ihr Stamm und ihre Krone im Dunst – sie ist kein
  // Hindernis). Er reicht quer über den Weg, seine Nadeln hängen in Büscheln
  // hinunter, die Spitzen genau bis DECKE. Auf dem Weg liegt sein Schatten:
  // so weit reicht er.
  // Der Ast einer Lärche, die Rute einer Weide (Schilfgürtel), der Ast einer
  // Föhre (Felsufer): dieselbe Form, andere Farben.
  const AST_FARBE = {
    ast: { stamm: [104, 84, 108], krone: [[198, 150, 104], [184, 136, 98]], arm: [70, 50, 62], behang: [[190, 134, 78], [214, 156, 88]], licht: [252, 210, 140], strich: [140, 92, 60] },
    weide: { stamm: [96, 88, 92], krone: [[150, 168, 92], [128, 150, 84]], arm: [76, 66, 62], behang: [[156, 176, 90], [184, 196, 104]], licht: [236, 236, 160], strich: [96, 116, 60] },
    foehre: { stamm: [118, 82, 80], krone: [[52, 88, 72], [44, 76, 64]], arm: [82, 56, 58], behang: [[56, 98, 76], [70, 112, 84]], licht: [176, 210, 150], strich: [30, 58, 46] },
  };
  function zeichneAst(o, Y, oben) {
    const s = view.s;
    const w = o.b - o.a;
    const C = AST_FARBE[o.art] || AST_FARBE.ast;
    const rechts = o.saat >= 0.5;
    const stammX = rechts ? o.b + 4 : o.a - 4;
    const z = (i) => hash01(o.saat * 53 + i * 7.3);
    if (oben) {
      g.fillStyle = "rgba(30, 20, 50, 0.3)";
      g.beginPath();
      g.ellipse(bildX((o.a + o.b) / 2), Y(0.2), (w / 2 + 2) * s, 1.3 * s, 0, 0, TAU);
      g.fill();
    }
    const astY = DECKE + o.dick * 0.7;
    const hoch = DECKE + 64 + z(1) * 16;
    // Der Stamm: vom Weg bis in die Krone, nach oben schmaler.
    g.fillStyle = F(C.stamm);
    g.beginPath();
    g.moveTo(bildX(stammX - 2.6), Y(0));
    g.lineTo(bildX(stammX - 1.2), Y(hoch - 6));
    g.lineTo(bildX(stammX + 1.2), Y(hoch - 6));
    g.lineTo(bildX(stammX + 2.6), Y(0));
    g.closePath();
    g.fill();
    g.fillStyle = L([236, 180, 160], 0.45);
    g.beginPath();
    g.moveTo(bildX(stammX - 2.6), Y(0));
    g.lineTo(bildX(stammX - 1.2), Y(hoch - 6));
    g.lineTo(bildX(stammX - 0.4), Y(hoch - 6));
    g.lineTo(bildX(stammX - 1.4), Y(0));
    g.closePath();
    g.fill();
    // Die Krone über dem Ast: Stufen hängender Zweige, golden, im Dunst.
    const stufen = 7;
    for (let i = 0; i < stufen; i += 1) {
      const f = i / (stufen - 1);
      const y = lerp(hoch, astY + 12, f);
      const breit = lerp(3, 13, f) * (0.85 + z(i + 3) * 0.3);
      g.fillStyle = F(C.krone[i % 2 ? 0 : 1]);
      g.beginPath();
      g.moveTo(bildX(stammX), Y(y + 1.5));
      g.quadraticCurveTo(bildX(stammX - breit * 0.6), Y(y + 1), bildX(stammX - breit), Y(y - 4));
      g.quadraticCurveTo(bildX(stammX - breit * 0.3), Y(y - 2.6), bildX(stammX), Y(y - 2));
      g.quadraticCurveTo(bildX(stammX + breit * 0.3), Y(y - 2.6), bildX(stammX + breit), Y(y - 4));
      g.quadraticCurveTo(bildX(stammX + breit * 0.6), Y(y + 1), bildX(stammX), Y(y + 1.5));
      g.fill();
    }
    // Der Ast: vom Stamm quer über den Weg, zum Ende dünner und hängend.
    const ende = rechts ? o.a - 1 : o.b + 1;
    const punkt = (f) => [lerp(stammX, ende, f), astY + 2.5 - f * f * 3];
    g.strokeStyle = F(C.arm);
    g.lineCap = "round";
    for (let i = 0; i < 6; i += 1) {
      const [x0, y0] = punkt(i / 6);
      const [x1, y1] = punkt((i + 1) / 6);
      g.lineWidth = Math.max(0.8, lerp(2.6, 0.9, i / 6) * s);
      g.beginPath();
      g.moveTo(bildX(x0), Y(y0));
      g.lineTo(bildX(x1), Y(y1));
      g.stroke();
    }
    // Der Behang: Büschel hängender Zweige, golden, oben im Licht. Ihre
    // Spitzen enden genau bei DECKE (manche etwas höher) – eine klare
    // Unterkante, aber kein Lineal.
    const zahl = Math.max(4, Math.round(w / 4.2));
    for (let i = 0; i <= zahl; i += 1) {
      const f = i / zahl;
      const x = lerp(o.a + 2.2, o.b - 2.2, f) + (z(i + 7) - 0.5) * 1.2;
      const fa = clamp(Math.abs(x - stammX) / Math.abs(ende - stammX), 0, 1);
      const oberk = punkt(fa)[1] - 0.6;
      const unterk = DECKE + (i % 3 === 1 ? 1.2 + z(i) * 1.4 : z(i) * 0.4);
      const b = 2.3 + z(i + 20) * 1.1;
      const kipp = (z(i + 30) - 0.5) * 1.4;
      const buschel = () => {
        g.beginPath();
        g.moveTo(bildX(x - b * 0.7), Y(oberk));
        g.bezierCurveTo(bildX(x - b * 1.1), Y(lerp(oberk, unterk, 0.45)), bildX(x - b * 0.5 + kipp), Y(unterk + 1.2), bildX(x + kipp * 0.6), Y(unterk));
        g.bezierCurveTo(bildX(x + b * 0.5 + kipp), Y(unterk + 1.2), bildX(x + b * 1.05), Y(lerp(oberk, unterk, 0.45)), bildX(x + b * 0.7), Y(oberk));
        g.closePath();
      };
      buschel();
      g.fillStyle = F(C.behang[i % 2 ? 0 : 1]);
      g.fill();
      g.save();
      buschel();
      g.clip();
      g.fillStyle = L(C.licht, 0.8);
      g.fillRect(bildX(x - b * 1.2), Math.min(Y(oberk + 1), Y(lerp(oberk, unterk, 0.4))), b * 0.9 * s, Math.abs(Y(lerp(oberk, unterk, 0.4)) - Y(oberk + 1)));
      g.strokeStyle = F(C.strich, 0.6);
      g.lineWidth = Math.max(0.5, 0.3 * s);
      g.beginPath();
      for (let j = 0; j < 3; j += 1) {
        const u = (j - 1) * b * 0.4;
        g.moveTo(bildX(x + u), Y(oberk));
        g.quadraticCurveTo(bildX(x + u * 1.2), Y(lerp(oberk, unterk, 0.5)), bildX(x + u * 0.6 + kipp * 0.5), Y(unterk + 0.6));
      }
      g.stroke();
      g.restore();
    }
    // Reif auf dem Ast.
    g.strokeStyle = L([244, 246, 255], 0.75);
    g.lineWidth = Math.max(0.6, 0.55 * s);
    g.beginPath();
    for (let i = 0; i <= 6; i += 1) {
      const [x, y] = punkt(i / 6);
      if (i) g.lineTo(bildX(x), Y(y + 1.3 - i * 0.12)); else g.moveTo(bildX(x), Y(y + 1.3));
    }
    g.stroke();
  }

  // Ein Felsdach: eine Platte, die aus einer Felswand hinter dem Weg
  // vorspringt, die Unterseite genau bei DECKE.
  function zeichneDach(o, Y, oben) {
    const s = view.s;
    const w = o.b - o.a;
    const z = (i) => hash01(o.saat * 41 + i * 5.9);
    if (oben) {
      g.fillStyle = "rgba(30, 20, 50, 0.32)";
      g.fillRect(bildX(o.a), Y(0.3), w * s, 1.6 * s);
    }
    const yFern = oben ? -20 : view.cssH + 20;
    const dick = o.dick + 4;
    // Die Wand dahinter, am rechten Ende, vom Weg bis aus dem Bild (im
    // Dunst: Sie steht hinter dem Weg).
    const wandA = o.b - 10;
    g.fillStyle = F([124, 112, 142]);
    g.beginPath();
    g.moveTo(bildX(wandA + 6), Y(0));
    g.lineTo(bildX(wandA), Y(DECKE));
    g.lineTo(bildX(wandA - 4), Y(DECKE + dick + 6));
    g.lineTo(bildX(wandA - 2), yFern);
    g.lineTo(bildX(o.b + 24), yFern);
    g.lineTo(bildX(o.b + 22), Y(0));
    g.closePath();
    g.fill();
    // Die Platte.
    const platte = () => {
      g.beginPath();
      g.moveTo(bildX(o.a), Y(DECKE));
      for (let i = 1; i <= 8; i += 1) {
        const x = o.a + (w * i) / 8;
        g.lineTo(bildX(x), Y(DECKE + (i === 8 ? 0 : 0)));
      }
      g.lineTo(bildX(o.b + 18), Y(DECKE + 2));
      g.lineTo(bildX(o.b + 12), Y(DECKE + dick + 2));
      for (let i = 8; i >= 0; i -= 1) {
        const x = o.a + (w * i) / 8;
        g.lineTo(bildX(x), Y(DECKE + dick * (0.6 + 0.4 * (i / 8)) + Math.sin(i * 2.1 + o.saat * 7) * 1.2));
      }
      g.closePath();
    };
    platte();
    g.fillStyle = F([102, 94, 128]);
    g.fill();
    g.save();
    platte();
    g.clip();
    g.fillStyle = L([224, 170, 160], 0.7);
    g.fillRect(bildX(o.a - 2), Math.min(Y(DECKE + dick + 3), Y(DECKE + dick * 0.62)), (w + 24) * s, dick * 0.4 * s);
    g.fillStyle = F([48, 42, 72], 0.8);
    g.fillRect(bildX(o.a - 2), Math.min(Y(DECKE), Y(DECKE + dick * 0.3)), (w + 24) * s, dick * 0.3 * s);
    g.strokeStyle = F([50, 44, 76], 0.5);
    g.lineWidth = Math.max(0.6, s * 0.4);
    for (let i = 0; i < 4; i += 1) {
      const x = o.a + w * z(i);
      g.beginPath();
      g.moveTo(bildX(x), Y(DECKE + dick));
      g.lineTo(bildX(x + 2), Y(DECKE + dick * 0.4));
      g.stroke();
    }
    g.restore();
    g.fillStyle = L([244, 246, 255], 0.7);
    g.fillRect(bildX(o.a + 1), Math.min(Y(DECKE + dick * 0.6 + 0.6), Y(DECKE + dick * 0.6)), (w - 2) * s, 0.7 * s);
    g.fillStyle = F([30, 22, 44], 0.85);
    g.fillRect(bildX(o.a), Math.min(Y(DECKE), Y(DECKE + 0.7)), w * s, 0.7 * s);
  }

  // ---------------------------------------------------------------------------
  // Zeichnen: die Hindernisse der Spiegelwelt
  // ---------------------------------------------------------------------------
  /*
   * Unten leuchtet alles von innen: Was von der Wasserlinie in die Tiefe
   * hängt (Kristalle, Schilf, Wurzeln), in Türkis und Weiss; was tiefer
   * schwebt (Hecht, Quallen, Treibholz), in Violett, mit einem Schein auf
   * der Wasserlinie darüber: so weit reicht es. Gemessen wird wie oben, nur
   * kopfüber: y ist die Tiefe unter dem gespiegelten Weg (untenY).
   */
  function zeichneKristall(o) {
    const s = view.s;
    const w = o.b - o.a;
    const z = (i) => hash01(o.saat * 71 + i * 3.1);
    // Der Schleier: die ganze Form, durchscheinend – so weit reicht er.
    profilPfad(o, untenY, 20);
    g.fillStyle = "rgba(90, 220, 255, 0.22)";
    g.fill();
    schein("kalt", bildX(o.a + o.p * w), uY(o.h * 0.45), (w * 0.05 + o.h * 0.04) * s, 0.55);
    // Die Kristalle: lange Prismen mit Spitzen, ihre Spitzen auf dem Umriss.
    const zahl = Math.max(3, Math.round(w / 3.2));
    for (let i = 0; i < zahl; i += 1) {
      const x = o.a + 1.2 + (w - 2.4) * ((i + 0.5) / zahl) + (z(i) - 0.5) * 1.2;
      const tief = Math.max(2, profil(o, x));
      const b = (1.1 + z(i + 20) * 0.9);
      const x0 = bildX(x - b);
      const x1 = bildX(x + b);
      const xm = bildX(x);
      g.fillStyle = i % 2 ? "rgba(150, 240, 255, 0.85)" : "rgba(110, 214, 250, 0.85)";
      g.beginPath();
      g.moveTo(x0, view.wl);
      g.lineTo(x1, view.wl);
      g.lineTo(x1, uY(tief - b * 1.6));
      g.lineTo(xm, uY(tief));
      g.lineTo(x0, uY(tief - b * 1.6));
      g.closePath();
      g.fill();
      g.fillStyle = "rgba(240, 255, 255, 0.85)";
      g.fillRect(x0 + 0.3, view.wl, Math.max(0.7, (x1 - x0) * 0.28), (uGrund + tief - b * 1.6 + UFER) * s);
    }
    // Die Spitzen funkeln.
    g.fillStyle = "#ffffff";
    for (let i = 0; i < 3; i += 1) {
      const x = o.a + w * (0.2 + z(i + 40) * 0.6);
      const a = 0.5 + 0.5 * Math.sin(state.zeit * 3 + i * 2 + o.saat * 9);
      g.globalAlpha = a;
      g.fillRect(bildX(x) - 0.8, uY(profil(o, x)) - 2, 1.6, 1.6);
    }
    g.globalAlpha = 1;
  }

  // Von (x0, y0) in Richtung w (0: gerade in die Tiefe) bis an den Umriss,
  // ein wenig krumm: die Punkte eines Halms oder einer Wurzel.
  function bisUmriss(o, x0, y0, w, krumm, saat) {
    const pts = [[x0, y0]];
    let x = x0;
    let y = y0;
    let r = w;
    for (let i = 0; i < 90; i += 1) {
      r += krumm * (hash01(saat * 13.1 + i * 1.7) - 0.5);
      const nx = x + Math.sin(r) * 0.6;
      const ny = y + Math.cos(r) * 0.6;
      if (nx <= o.a + 0.3 || nx >= o.b - 0.3 || ny >= profil(o, nx) - 0.25) break;
      x = nx;
      y = ny;
      if (i % 2) pts.push([x, y]);
    }
    if (pts.length < 2 || pts[pts.length - 1][0] !== x) pts.push([x, y]);
    return pts;
  }

  // Eine Linie aus Punkten, die zum Ende dünner wird – in drei Stücken
  // mit je ihrer Stärke (ein Strich je Stück, nicht je Punkt).
  function auslaufend(pts, Y, b0, b1, farbe) {
    g.strokeStyle = farbe;
    const n = pts.length - 1;
    if (n < 1) return;
    const teile = Math.min(3, n);
    for (let j = 0; j < teile; j += 1) {
      const von = Math.floor((n * j) / teile);
      const bis = Math.floor((n * (j + 1)) / teile);
      g.lineWidth = Math.max(0.5, lerp(b0, b1, (j + 0.5) / teile) * view.s);
      g.beginPath();
      g.moveTo(bildX(pts[von][0]), Y(pts[von][1]));
      for (let i = von + 1; i <= bis; i += 1) g.lineTo(bildX(pts[i][0]), Y(pts[i][1]));
      g.stroke();
    }
  }

  // Schilf: Büschel, die von der Wasserlinie in die Tiefe hängen und sich
  // auffächern, mit Blättern und Rohrkolben.
  function zeichneSchilf(o) {
    const s = view.s;
    const w = o.b - o.a;
    const z = (i) => hash01(o.saat * 61 + i * 4.7);
    if (!o.gestalt) {
      const buschel = Math.max(2, Math.round(w / 7));
      const halme = [];
      const blaetter = [];
      for (let c = 0; c < buschel; c += 1) {
        const x0 = o.a + w * ((c + 0.5) / buschel) + (z(c) - 0.5) * 2;
        for (let j = 0; j < 6; j += 1) {
          const wi = lerp(-0.42, 0.42, j / 5) + (z(c * 9 + j) - 0.5) * 0.14;
          halme.push({ pts: bisUmriss(o, x0, -UFER - o.g, wi, 0.05, o.saat * 7 + c * 3 + j), kolben: z(c * 5 + j + 40) < 0.22, farbe: (c + j) % 3 });
        }
        for (let j = 0; j < 3; j += 1) {
          const seite = j % 2 ? 1 : -1;
          blaetter.push(bisUmriss(o, x0, -UFER - o.g + 1, seite * (0.75 + z(c * 3 + j + 80) * 0.4), 0.2, o.saat * 11 + c * 5 + j));
        }
      }
      o.gestalt = { halme, blaetter };
    }
    profilPfad(o, untenY, 20);
    g.fillStyle = "rgba(60, 200, 170, 0.08)";
    g.fill();
    schein("kalt", bildX(o.a + w / 2), uY(o.h * 0.4), (w * 0.05 + 0.8) * s, 0.35);
    g.lineCap = "round";
    o.gestalt.blaetter.forEach((pts) => auslaufend(pts, untenY, 1.3, 0.3, "rgba(52, 160, 140, 0.9)"));
    o.gestalt.halme.forEach((h) => {
      auslaufend(h.pts, untenY, 0.8, 0.4, h.farbe === 0 ? "rgb(110, 224, 190)" : h.farbe === 1 ? "rgb(62, 176, 156)" : "rgb(44, 136, 130)");
      if (h.kolben && h.pts.length > 5) {
        const a = h.pts[Math.floor(h.pts.length * 0.55)];
        const b = h.pts[Math.floor(h.pts.length * 0.85)];
        g.strokeStyle = "rgb(126, 82, 108)";
        g.lineWidth = Math.max(1.6, s * 1.5);
        g.beginPath();
        g.moveTo(bildX(a[0]), uY(a[1]));
        g.lineTo(bildX(b[0]), uY(b[1]));
        g.stroke();
        g.strokeStyle = "rgba(236, 176, 226, 0.75)";
        g.lineWidth = Math.max(0.5, s * 0.35);
        g.beginPath();
        g.moveTo(bildX(a[0]) - 0.6 * s, uY(a[1]));
        g.lineTo(bildX(b[0]) - 0.6 * s, uY(b[1]));
        g.stroke();
      }
      const [tx, ty] = h.pts[h.pts.length - 1];
      g.fillStyle = "rgba(190, 255, 232, 0.85)";
      g.fillRect(bildX(tx) - 0.6, uY(ty) - 0.6, 1.2, 1.2);
    });
  }

  function zeichneWurzel(o) {
    const s = view.s;
    const w = o.b - o.a;
    const z = (i) => hash01(o.saat * 43 + i * 6.1);
    if (!o.gestalt) {
      const wurzeln = [];
      const zahl = Math.max(3, Math.round(w / 6));
      for (let i = 0; i < zahl; i += 1) {
        const x0 = o.a + w * ((i + 0.5) / zahl) + (z(i) - 0.5) * 2;
        const haupt = bisUmriss(o, x0, 1 - o.g, (z(i + 5) - 0.5) * 0.5, 0.45, o.saat * 5 + i);
        wurzeln.push({ pts: haupt, dick: 1.7 });
        [0.3, 0.55].forEach((f, j) => {
          const ab = haupt[Math.floor(haupt.length * f)];
          if (!ab) return;
          const seite = (i + j) % 2 ? 1 : -1;
          wurzeln.push({ pts: bisUmriss(o, ab[0], ab[1], seite * (0.55 + z(i * 3 + j) * 0.4), 0.5, o.saat * 9 + i * 4 + j), dick: 0.9 });
        });
      }
      o.gestalt = { wurzeln };
    }
    profilPfad(o, untenY, 20);
    g.fillStyle = "rgba(90, 200, 220, 0.07)";
    g.fill();
    // Der Wurzelballen an der Wasserlinie.
    g.fillStyle = "rgb(48, 34, 60)";
    g.beginPath();
    g.moveTo(bildX(o.a - 1), view.wl);
    for (let i = 0; i <= 10; i += 1) {
      const x = o.a - 1 + (w + 2) * (i / 10);
      g.lineTo(bildX(x), untenY(Math.min(o.g + profil(o, x), 2.5 + z(i + 70) * 2)));
    }
    g.lineTo(bildX(o.b + 1), view.wl);
    g.closePath();
    g.fill();
    g.lineCap = "round";
    o.gestalt.wurzeln.forEach((r) => {
      auslaufend(r.pts, untenY, r.dick, 0.35, "rgb(64, 46, 78)");
      // Die Kante im Licht des Sees.
      g.strokeStyle = "rgba(130, 246, 240, 0.65)";
      g.lineWidth = Math.max(0.5, 0.28 * s);
      g.beginPath();
      r.pts.forEach(([px, py], j) => { if (j) g.lineTo(bildX(px) - 0.45 * s, uY(py)); else g.moveTo(bildX(px) - 0.45 * s, uY(py)); });
      g.stroke();
    });
    // Lichtpunkte im Wurzelwerk.
    for (let i = 0; i < 3; i += 1) {
      const x = o.a + w * (0.2 + z(i + 20) * 0.6);
      schein("kalt", bildX(x), uY(profil(o, x) * (0.3 + z(i + 30) * 0.5)), 0.22, 0.5 + 0.3 * Math.sin(state.zeit * 2 + i));
    }
  }

  // Was tiefer schwebt: Auf der Wasserlinie darüber liegt ein violetter
  // Schein, so breit wie es.
  function deckenSchein(o) {
    const s = view.s;
    const band = g.createLinearGradient(0, view.wl, 0, uY(0.6));
    band.addColorStop(0, "rgba(210, 150, 255, 0.5)");
    band.addColorStop(1, "rgba(210, 150, 255, 0)");
    g.fillStyle = band;
    g.fillRect(bildX(o.a), view.wl, (o.b - o.a) * s, (UFER + 0.6) * s);
  }

  function zeichneHecht(o) {
    const s = view.s;
    const w = o.b - o.a;
    deckenSchein(o);
    const mitte = DECKE + 4.8;
    const kopfLinks = o.saat < 0.6;     // meist schwimmt er ihr entgegen
    const schlag = ruhig() ? 0 : Math.sin(state.zeit * 7 + o.saat * 9) * 1.6;
    const vorn = kopfLinks ? o.a : o.b;
    const hinten = kopfLinks ? o.b : o.a;
    const X = (u) => bildX(lerp(vorn, hinten, u));
    const halb = 4.8;
    schein("violett", bildX((o.a + o.b) / 2), uY(mitte), (w * 0.05 + 1) * s, 0.45);
    // Der Körper: lang, spitz zum Maul, die Schwanzflosse hinten.
    g.fillStyle = "rgb(46, 82, 104)";
    g.beginPath();
    g.moveTo(X(0), uY(mitte + 0.4));
    g.quadraticCurveTo(X(0.12), uY(mitte - halb), X(0.35), uY(mitte - halb));
    g.quadraticCurveTo(X(0.75), uY(mitte - halb * 0.95), X(0.86), uY(mitte - 1.2 + schlag * 0.2));
    g.lineTo(X(0.86), uY(mitte + 1.2 + schlag * 0.2));
    g.quadraticCurveTo(X(0.7), uY(mitte + halb), X(0.3), uY(mitte + halb * 0.9));
    g.quadraticCurveTo(X(0.1), uY(mitte + halb * 0.6), X(0), uY(mitte + 0.4));
    g.closePath();
    g.fill();
    // Rücken (zur Wasserlinie hin) dunkler, Bauch hell, Flecken.
    g.fillStyle = "rgba(170, 220, 190, 0.35)";
    g.beginPath();
    g.ellipse(X(0.45), uY(mitte + halb * 0.45), (w * 0.3) * s, halb * 0.35 * s, 0, 0, TAU);
    g.fill();
    g.fillStyle = "rgba(190, 240, 210, 0.45)";
    for (let i = 0; i < 7; i += 1) {
      const u = 0.25 + i * 0.08;
      g.beginPath();
      g.ellipse(X(u), uY(mitte - halb * 0.2 + (i % 2) * 1.6), 0.9 * s, 0.5 * s, 0, 0, TAU);
      g.fill();
    }
    // Flossen.
    g.fillStyle = "rgb(60, 100, 112)";
    g.beginPath();
    g.moveTo(X(0.86), uY(mitte + schlag * 0.2));
    g.lineTo(X(1), uY(mitte - 3.6 + schlag));
    g.lineTo(X(0.96), uY(mitte + schlag));
    g.lineTo(X(1), uY(mitte + 3.6 + schlag));
    g.closePath();
    g.fill();
    g.beginPath();
    g.moveTo(X(0.68), uY(mitte - halb * 0.9));
    g.lineTo(X(0.78), uY(mitte - halb - 1.6));
    g.lineTo(X(0.8), uY(mitte - halb * 0.85));
    g.closePath();
    g.fill();
    // Das Auge leuchtet.
    schein("kalt", X(0.07), uY(mitte - 0.9), 0.18, 0.9);
    g.fillStyle = "#e8ffff";
    g.beginPath();
    g.arc(X(0.07), uY(mitte - 0.9), Math.max(0.8, 0.7 * s), 0, TAU);
    g.fill();
    // Die leuchtende Kante.
    g.strokeStyle = "rgba(150, 250, 255, 0.75)";
    g.lineWidth = 0.9;
    g.beginPath();
    g.moveTo(X(0), uY(mitte + 0.4));
    g.quadraticCurveTo(X(0.12), uY(mitte - halb), X(0.35), uY(mitte - halb));
    g.quadraticCurveTo(X(0.75), uY(mitte - halb * 0.95), X(0.86), uY(mitte - 1.2 + schlag * 0.2));
    g.stroke();
    g.fillStyle = "rgba(60, 30, 80, 0.9)";
    g.fillRect(bildX(o.a), uY(DECKE) - 0.35, w * s, 0.7);
  }

  function zeichneQualle(o) {
    const s = view.s;
    const w = o.b - o.a;
    deckenSchein(o);
    const zahl = Math.max(1, Math.round(w / 13));
    const breit = w / zahl;
    for (let i = 0; i < zahl; i += 1) {
      const cx = o.a + breit * (i + 0.5);
      const puls = ruhig() ? 0 : Math.sin(state.zeit * 3.2 + i * 1.7 + o.saat * 8);
      const rb = breit * 0.46 * (1 + puls * 0.06);
      const tief = DECKE + 7.5 - puls * 0.6;
      // Die Fäden wehen in die Tiefe.
      g.strokeStyle = "rgba(220, 160, 255, 0.55)";
      g.lineWidth = Math.max(0.6, s * 0.4);
      for (let j = 0; j < 5; j += 1) {
        const fx = cx - rb * 0.7 + (rb * 1.4 * j) / 4;
        g.beginPath();
        g.moveTo(bildX(fx), uY(tief));
        for (let k = 1; k <= 4; k += 1) {
          g.lineTo(bildX(fx + Math.sin(state.zeit * 2 + j + k) * 0.8), uY(tief + k * 2.6));
        }
        g.stroke();
      }
      schein("violett", bildX(cx), uY(DECKE + 4), (rb * 0.1 + 0.4) * s, 0.75);
      // Der Schirm: zur Wasserlinie hin gewölbt.
      g.fillStyle = "rgba(196, 120, 255, 0.78)";
      g.beginPath();
      g.moveTo(bildX(cx - rb), uY(tief));
      g.bezierCurveTo(bildX(cx - rb), uY(DECKE + 1), bildX(cx - rb * 0.5), uY(DECKE), bildX(cx), uY(DECKE));
      g.bezierCurveTo(bildX(cx + rb * 0.5), uY(DECKE), bildX(cx + rb), uY(DECKE + 1), bildX(cx + rb), uY(tief));
      g.quadraticCurveTo(bildX(cx), uY(tief - 1.6), bildX(cx - rb), uY(tief));
      g.closePath();
      g.fill();
      g.fillStyle = "rgba(255, 220, 255, 0.7)";
      g.beginPath();
      g.ellipse(bildX(cx - rb * 0.25), uY(DECKE + 2.4), rb * 0.32 * s, 1.1 * s, 0, 0, TAU);
      g.fill();
      g.strokeStyle = "rgba(255, 230, 255, 0.9)";
      g.lineWidth = 0.8;
      g.beginPath();
      g.moveTo(bildX(cx - rb), uY(tief));
      g.bezierCurveTo(bildX(cx - rb), uY(DECKE + 1), bildX(cx - rb * 0.5), uY(DECKE), bildX(cx), uY(DECKE));
      g.bezierCurveTo(bildX(cx + rb * 0.5), uY(DECKE), bildX(cx + rb), uY(DECKE + 1), bildX(cx + rb), uY(tief));
      g.stroke();
    }
  }

  function zeichneTreibholz(o) {
    const s = view.s;
    const w = o.b - o.a;
    const z = (i) => hash01(o.saat * 29 + i * 8.3);
    deckenSchein(o);
    schein("violett", bildX((o.a + o.b) / 2), uY(DECKE + 4), (w * 0.06 + 1) * s, 0.55);
    // Ein versunkener Ast: dick, die Kante zur Wasserlinie hin genau bei
    // DECKE, mit Gabeln und Algen, die in die Tiefe hängen.
    const dick = 5.2;
    const oben = (x) => DECKE + 0.3 * Math.sin((x - o.a) * 0.25 + o.saat * 9) + 0.3;
    const stamm = () => {
      g.beginPath();
      g.moveTo(bildX(o.a), uY(DECKE + dick * 0.5));
      for (let i = 0; i <= 10; i += 1) {
        const x = o.a + 1 + (w - 2) * (i / 10);
        g.lineTo(bildX(x), uY(oben(x)));
      }
      g.lineTo(bildX(o.b), uY(DECKE + dick * 0.45));
      for (let i = 10; i >= 0; i -= 1) {
        const x = o.a + 1 + (w - 2) * (i / 10);
        g.lineTo(bildX(x), uY(DECKE + dick * (0.85 + 0.2 * Math.sin(i * 1.3 + o.saat * 5))));
      }
      g.closePath();
    };
    // Die Gabeln, tiefer.
    g.strokeStyle = "rgb(84, 70, 110)";
    g.lineCap = "round";
    [0.3 + z(1) * 0.2, 0.65 + z(2) * 0.2].forEach((f, i) => {
      const x = o.a + w * f;
      g.lineWidth = Math.max(1, 1.5 * s);
      g.beginPath();
      g.moveTo(bildX(x), uY(DECKE + dick * 0.6));
      g.quadraticCurveTo(bildX(x + (i ? 3 : -3)), uY(DECKE + dick + 3), bildX(x + (i ? 6 : -5)), uY(DECKE + dick + 6));
      g.stroke();
    });
    stamm();
    g.fillStyle = "rgb(84, 70, 110)";
    g.fill();
    g.save();
    stamm();
    g.clip();
    g.fillStyle = "rgba(150, 140, 190, 0.6)";
    g.fillRect(bildX(o.a), uY(DECKE - 0.5), w * s, dick * 0.35 * s);
    g.strokeStyle = "rgba(40, 30, 60, 0.6)";
    g.lineWidth = Math.max(0.5, 0.35 * s);
    for (let i = 1; i < 3; i += 1) {
      g.beginPath();
      g.moveTo(bildX(o.a), uY(DECKE + dick * 0.3 * i));
      for (let x = o.a; x <= o.b; x += 5) g.lineTo(bildX(x), uY(DECKE + dick * 0.3 * i + Math.sin(x * 0.5 + i) * 0.3));
      g.stroke();
    }
    g.restore();
    // Die Kante zur Wasserlinie leuchtet.
    g.strokeStyle = "rgba(170, 252, 255, 0.95)";
    g.lineWidth = Math.max(1, 0.7 * s);
    g.beginPath();
    for (let i = 0; i <= 10; i += 1) {
      const x = o.a + 1 + (w - 2) * (i / 10);
      if (i) g.lineTo(bildX(x), uY(oben(x))); else g.moveTo(bildX(x), uY(oben(x)));
    }
    g.stroke();
    // Algen, die in die Tiefe wehen, und Moos, das leuchtet.
    g.strokeStyle = "rgba(110, 240, 190, 0.75)";
    g.lineWidth = Math.max(0.6, s * 0.4);
    for (let i = 0; i < 8; i += 1) {
      const x = o.a + w * (0.08 + i * 0.12);
      g.beginPath();
      g.moveTo(bildX(x), uY(DECKE + dick * 0.85));
      g.quadraticCurveTo(bildX(x + Math.sin(state.zeit * 1.7 + i) * 1.2), uY(DECKE + dick + 2.5), bildX(x - 0.5), uY(DECKE + dick + 3 + z(i) * 3));
      g.stroke();
    }
    g.fillStyle = "rgba(150, 255, 210, 0.8)";
    for (let i = 0; i < 5; i += 1) {
      const x = o.a + w * (0.1 + z(i + 9) * 0.8);
      g.beginPath();
      g.ellipse(bildX(x), uY(oben(x) + 0.6), 1.2 * s, 0.5 * s, 0, 0, TAU);
      g.fill();
    }
  }

  // ---------------------------------------------------------------------------
  // Zeichnen: die Hindernisse der anderen Landschaften
  // ---------------------------------------------------------------------------
  // Eine Fischkiste aus Latten am Bootssteg, ein Tau darüber (Schilfgürtel).
  function zeichneKiste(o, Y) {
    const s = view.s;
    const w = o.b - o.a;
    g.fillStyle = F([40, 30, 60], 0.3);
    g.fillRect(bildX(o.a + 2), Math.min(Y(0), Y(-0.6)), (w + 5) * s, 1.3 * s);
    profilPfad(o, Y);
    g.fillStyle = F([150, 108, 76]);
    g.fill();
    g.save();
    profilPfad(o, Y);
    g.clip();
    // Latten mit Fugen, links im Licht.
    for (let i = 0; i < 4; i += 1) {
      const y0 = o.h * (i / 4);
      g.fillStyle = F(i % 2 ? [170, 124, 86] : [158, 114, 80]);
      g.fillRect(bildX(o.a), Math.min(Y(y0), Y(y0 + o.h / 4)), w * s, (o.h / 4) * s);
      g.fillStyle = F([84, 56, 48], 0.8);
      g.fillRect(bildX(o.a), Math.min(Y(y0), Y(y0 + 0.4)), w * s, Math.max(0.6, 0.4 * s));
    }
    g.fillStyle = L([255, 214, 160], 0.55);
    g.fillRect(bildX(o.a), Math.min(Y(0), Y(o.h)), w * 0.22 * s, o.h * s);
    g.fillStyle = F([90, 62, 52]);
    [0.06, 0.94].forEach((u) => g.fillRect(bildX(o.a + w * u) - 0.9 * s, Math.min(Y(0), Y(o.h)), 1.8 * s, o.h * s));
    g.restore();
    // Ein Tau, über die Kiste geworfen.
    g.strokeStyle = F([220, 196, 140]);
    g.lineWidth = Math.max(0.8, s * 0.7);
    g.beginPath();
    g.moveTo(bildX(o.a + w * 0.3), Y(o.h + 0.2));
    g.bezierCurveTo(bildX(o.a + w * 0.45), Y(o.h * 0.4), bildX(o.a + w * 0.6), Y(o.h + 0.6), bildX(o.a + w * 0.72), Y(o.h * 0.3));
    g.stroke();
    g.strokeStyle = L([255, 236, 190], 0.8);
    g.lineWidth = Math.max(0.6, s * 0.35);
    g.beginPath();
    g.moveTo(bildX(o.a), Y(o.h) + 0.4);
    g.lineTo(bildX(o.b), Y(o.h) + 0.4);
    g.stroke();
  }

  // Ein Eisblock: Facetten im Licht, Risse innen, Schnee obenauf.
  function zeichneEisblock(o, Y) {
    const s = view.s;
    const w = o.b - o.a;
    const z = (i) => hash01(o.saat * 83 + i * 9.1);
    const P = (u, v) => [bildX(o.a + u * w), Y(v * o.h)];
    g.fillStyle = F([60, 90, 140], 0.3);
    g.beginPath();
    const [sx, sy] = P(0.6, 0);
    g.ellipse(sx + w * 0.2 * s, sy, w * 0.6 * s, 1.2 * s, 0, 0, TAU);
    g.fill();
    profilPfad(o, Y);
    g.fillStyle = F([150, 196, 230]);
    g.fill();
    g.save();
    profilPfad(o, Y);
    g.clip();
    const flaeche = (punkte, farbe) => {
      g.fillStyle = farbe;
      g.beginPath();
      punkte.forEach(([u, v], i) => { const [x, y] = P(u, v); if (i) g.lineTo(x, y); else g.moveTo(x, y); });
      g.closePath();
      g.fill();
    };
    const p = o.p;
    flaeche([[-0.05, -0.1], [-0.05, 0.75], [p * 0.7, 1.1], [p * 0.6 + z(1) * 0.1, 0.3], [p * 0.4, -0.1]], L([214, 240, 255], 0.9));
    flaeche([[p + 0.05, 1.1], [1.05, 0.7], [1.05, -0.1], [p + 0.15, -0.1]], F([96, 140, 196]));
    flaeche([[p * 0.6 + z(1) * 0.1, 0.3], [p * 0.7, 1.1], [p + 0.05, 1.1], [p + 0.15, -0.1], [p * 0.4, -0.1]], F([130, 178, 222]));
    // Risse im Eis.
    g.strokeStyle = L([255, 255, 255], 0.55);
    g.lineWidth = Math.max(0.5, s * 0.3);
    g.beginPath();
    for (let i = 0; i < 3; i += 1) {
      const [ax, ay] = P(0.2 + z(i + 4) * 0.6, 0.15 + z(i + 7) * 0.3);
      const [bx, by] = P(0.25 + z(i + 10) * 0.5, 0.5 + z(i + 13) * 0.35);
      g.moveTo(ax, ay);
      g.lineTo(bx, by);
    }
    g.stroke();
    g.restore();
    // Schnee obenauf, ein Glanz.
    g.fillStyle = L([250, 252, 255], 0.95);
    g.beginPath();
    for (let i = 0; i <= 12; i += 1) {
      const x = o.a + w * (0.06 + 0.88 * (i / 12));
      if (i === 0) g.moveTo(bildX(x), Y(profil(o, x) + 0.4)); else g.lineTo(bildX(x), Y(profil(o, x) + 0.4));
    }
    for (let i = 12; i >= 0; i -= 1) {
      const x = o.a + w * (0.06 + 0.88 * (i / 12));
      const y = profil(o, x);
      g.lineTo(bildX(x), Y(y - Math.min(2.6, y * 0.22) * (0.6 + 0.4 * Math.sin(i * 1.9 + o.saat * 7))));
    }
    g.closePath();
    g.fill();
    if (!ruhig() && stil === "tag") {
      const [gx, gy] = P(0.25, 0.7);
      schein("weiss", gx, gy, 0.12, 0.4 + 0.4 * Math.sin(state.zeit * 3 + o.saat * 7));
    }
  }

  // Ein Steinbock. Erst steht er oben am Fels über dem Weg; gut eine Sekunde,
  // bevor sie dort ist (o.ab), springt er herab und bleibt auf dem Weg
  // stehen, ihr zugewandt – dann muss sie über ihn hinweg.
  function zeichneSteinbock(o, Y, oben) {
    const s = view.s;
    const w = o.b - o.a;
    const t = state.phase === "bereit" ? 0 : state.t;
    const flug = 0.45;
    // Wo er steht: oben am Fels (fels), im Sprung, auf dem Weg.
    const fx = o.b + 10;
    const fy = DECKE + 22;
    const k = clamp((t - (o.ab - flug)) / flug, 0, 1);
    const mx = lerp(fx, (o.a + o.b) / 2, k);
    const fussY = lerp(fy, 0, k) + Math.sin(k * Math.PI) * 10;
    if (k < 1 && oben) {
      // Sein Fels, hinter dem Weg am Hang.
      g.fillStyle = F([86, 80, 104]);
      g.beginPath();
      g.moveTo(bildX(fx - 12), Y(fy - 0.5));
      g.lineTo(bildX(fx - 7), Y(fy + 1.5));
      g.lineTo(bildX(fx + 9), Y(fy + 0.8));
      g.lineTo(bildX(fx + 16), Y(fy - 14));
      g.lineTo(bildX(fx - 10), Y(fy - 10));
      g.closePath();
      g.fill();
      g.strokeStyle = L([236, 190, 176], 0.7);
      g.lineWidth = Math.max(0.6, s * 0.45);
      g.beginPath();
      g.moveTo(bildX(fx - 12), Y(fy - 0.4));
      g.lineTo(bildX(fx - 7), Y(fy + 1.6));
      g.lineTo(bildX(fx + 9), Y(fy + 0.9));
      g.stroke();
    }
    if (oben && k >= 1) {
      g.fillStyle = F([40, 30, 60], 0.32);
      g.beginPath();
      g.ellipse(bildX(mx + 2), Y(0.1), (w * 0.55) * s, 1.2 * s, 0, 0, TAU);
      g.fill();
    }
    // Der Körper: Rumpf, vier Beine, Hals und Kopf mit den grossen Hörnern,
    // nach links (ihr entgegen). Massstab: so hoch wie das Hindernis.
    const H = o.h;
    const X = (u) => bildX(mx + u * w * 0.5);
    const V = (v) => Y(fussY + v * H);
    const lauf = k > 0 && k < 1 ? 0.5 : 0;
    g.lineCap = "round";
    g.strokeStyle = F([58, 46, 44]);
    g.lineWidth = Math.max(0.9, 1.2 * s);
    g.beginPath();
    [[-0.55, -0.62 - lauf * 0.3], [-0.35, -0.42 + lauf * 0.2], [0.45, 0.55 + lauf * 0.3], [0.62, 0.72 - lauf * 0.2]].forEach(([u0, u1]) => {
      g.moveTo(X(u0), V(0.5));
      g.lineTo(X(u1), V(0.02));
    });
    g.stroke();
    // Rumpf.
    g.fillStyle = F([128, 104, 88]);
    g.beginPath();
    g.ellipse(X(0.05), V(0.62), w * 0.42 * s, H * 0.2 * s, 0, 0, TAU);
    g.fill();
    g.fillStyle = F([96, 76, 70]);
    g.beginPath();
    g.ellipse(X(0.1), V(0.52), w * 0.34 * s, H * 0.1 * s, 0, 0, TAU);
    g.fill();
    g.fillStyle = L([236, 196, 164], 0.6);
    g.beginPath();
    g.ellipse(X(-0.05), V(0.74), w * 0.3 * s, H * 0.06 * s, 0, 0, TAU);
    g.fill();
    // Hals und Kopf.
    g.fillStyle = F([118, 94, 80]);
    g.beginPath();
    g.moveTo(X(-0.3), V(0.6));
    g.lineTo(X(-0.55), V(0.9));
    g.lineTo(X(-0.72), V(0.82));
    g.lineTo(X(-0.45), V(0.5));
    g.closePath();
    g.fill();
    g.beginPath();
    g.ellipse(X(-0.7), V(0.84), w * 0.1 * s, H * 0.07 * s, -0.3, 0, TAU);
    g.fill();
    // Der Bart und das Auge.
    g.strokeStyle = F([70, 56, 52]);
    g.lineWidth = Math.max(0.5, 0.4 * s);
    g.beginPath();
    g.moveTo(X(-0.76), V(0.79));
    g.lineTo(X(-0.74), V(0.7));
    g.stroke();
    g.fillStyle = "rgba(20, 14, 20, 0.9)";
    g.fillRect(X(-0.7) - 0.4, V(0.87) - 0.4, 0.9, 0.9);
    // Die Hörner: in einem Bogen nach hinten, mit Wülsten.
    g.strokeStyle = F([196, 176, 140]);
    g.lineWidth = Math.max(0.9, 1.1 * s);
    g.beginPath();
    g.moveTo(X(-0.66), V(0.9));
    g.quadraticCurveTo(X(-0.62), V(1.32), X(-0.28), V(1.12));
    g.stroke();
    g.strokeStyle = F([110, 96, 80], 0.8);
    g.lineWidth = Math.max(0.5, 0.35 * s);
    g.beginPath();
    for (let i = 1; i < 6; i += 1) {
      const u = i / 6;
      const hx = lerp(-0.66, -0.36, u);
      const hy = lerp(0.95, 1.2, Math.sin(u * Math.PI * 0.6));
      g.moveTo(X(hx - 0.04), V(hy));
      g.lineTo(X(hx + 0.04), V(hy + 0.04));
    }
    g.stroke();
    g.strokeStyle = L([255, 236, 214], 0.7);
    g.lineWidth = Math.max(0.5, 0.35 * s);
    g.beginPath();
    g.moveTo(X(-0.68), V(0.92));
    g.quadraticCurveTo(X(-0.65), V(1.3), X(-0.32), V(1.15));
    g.stroke();
  }

  // Ein Fischernetz zwischen zwei Stangen, quer über den Weg gespannt; seine
  // Unterkante mit den Korken hängt genau bei DECKE.
  function zeichneNetz(o, Y, oben) {
    const s = view.s;
    const w = o.b - o.a;
    if (oben) {
      g.fillStyle = "rgba(30, 20, 50, 0.28)";
      g.beginPath();
      g.ellipse(bildX((o.a + o.b) / 2), Y(0.2), (w / 2 + 2) * s, 1.2 * s, 0, 0, TAU);
      g.fill();
    }
    const top = DECKE + 16 + o.dick * 0.5;
    const seil = (u) => top - Math.sin(u * Math.PI) * 3.2;
    // Die Stangen.
    [o.a - 2.5, o.b + 2.5].forEach((x) => {
      g.fillStyle = F([92, 70, 62]);
      g.fillRect(bildX(x) - 0.9 * s, Math.min(Y(0), Y(top + 6)), 1.8 * s, Math.abs(Y(top + 6) - Y(0)));
      g.fillStyle = L([240, 200, 160], 0.5);
      g.fillRect(bildX(x) - 0.9 * s, Math.min(Y(0), Y(top + 6)), 0.5 * s, Math.abs(Y(top + 6) - Y(0)));
    });
    // Das Netz: Maschen von der Leine bis zur Unterkante, leicht wehend.
    const wind = ruhig() ? 0 : Math.sin(state.zeit * 1.6 + o.saat * 6) * 0.8;
    const unterkante = (u) => DECKE + 0.6 + Math.sin(u * Math.PI) * 0.6;
    g.fillStyle = F([60, 52, 64], 0.28);
    g.beginPath();
    g.moveTo(bildX(o.a), Y(seil(0)));
    for (let i = 0; i <= 10; i += 1) g.lineTo(bildX(o.a + (w * i) / 10), Y(seil(i / 10)));
    for (let i = 10; i >= 0; i -= 1) g.lineTo(bildX(o.a + (w * i) / 10 + wind), Y(unterkante(i / 10)));
    g.closePath();
    g.fill();
    g.strokeStyle = F([210, 196, 170], 0.55);
    g.lineWidth = Math.max(0.4, 0.25 * s);
    g.beginPath();
    const maschen = Math.max(4, Math.round(w / 3.2));
    for (let i = 0; i <= maschen; i += 1) {
      const u = i / maschen;
      const x0 = o.a + w * u;
      g.moveTo(bildX(x0), Y(seil(u)));
      g.lineTo(bildX(Math.min(o.b, x0 + 9) + wind), Y(unterkante(Math.min(1, u + 9 / w))));
      g.moveTo(bildX(x0), Y(seil(u)));
      g.lineTo(bildX(Math.max(o.a, x0 - 9) + wind), Y(unterkante(Math.max(0, u - 9 / w))));
    }
    g.stroke();
    // Die Leine und die Korken an der Unterkante.
    g.strokeStyle = F([230, 210, 170]);
    g.lineWidth = Math.max(0.7, 0.5 * s);
    g.beginPath();
    for (let i = 0; i <= 10; i += 1) { const x = bildX(o.a - 2.5 + ((w + 5) * i) / 10); const y = Y(seil(i / 10)); if (i) g.lineTo(x, y); else g.moveTo(x, y); }
    g.stroke();
    for (let i = 0; i < Math.max(3, Math.round(w / 6)); i += 1) {
      const u = (i + 0.5) / Math.max(3, Math.round(w / 6));
      g.fillStyle = F([236, 136, 72]);
      g.beginPath();
      g.ellipse(bildX(o.a + w * u + wind), Y(unterkante(u) + 0.6), 1.3 * s, 0.75 * s, 0, 0, TAU);
      g.fill();
    }
  }

  // Ein Überhang aus Eis an einer Wand, darunter Zapfen; ihre Spitzen enden
  // genau bei DECKE (Gletschersee).
  function zeichneEiszapfen(o, Y, oben) {
    const s = view.s;
    const w = o.b - o.a;
    if (oben) {
      g.fillStyle = "rgba(40, 60, 110, 0.3)";
      g.fillRect(bildX(o.a), Y(0.3), w * s, 1.5 * s);
    }
    const dick = o.dick + 3;
    const unter = DECKE + 5.5;
    // Ein Serac dahinter (rechts), oben gezackt und verschneit, und die
    // Platte aus Eis, die von ihm vorspringt.
    const top = unter + dick + 16;
    g.fillStyle = F([132, 168, 210]);
    g.beginPath();
    g.moveTo(bildX(o.b + 2), Y(0));
    g.lineTo(bildX(o.b - 6), Y(unter + dick + 4));
    g.lineTo(bildX(o.b - 4), Y(top - 3));
    g.lineTo(bildX(o.b + 4), Y(top + 2));
    g.lineTo(bildX(o.b + 11), Y(top - 1));
    g.lineTo(bildX(o.b + 18), Y(top + 3));
    g.lineTo(bildX(o.b + 25), Y(top - 4));
    g.lineTo(bildX(o.b + 22), Y(0));
    g.closePath();
    g.fill();
    g.fillStyle = F([96, 140, 196], 0.7);
    g.beginPath();
    g.moveTo(bildX(o.b + 12), Y(0));
    g.lineTo(bildX(o.b + 14), Y(top - 1));
    g.lineTo(bildX(o.b + 25), Y(top - 4));
    g.lineTo(bildX(o.b + 22), Y(0));
    g.closePath();
    g.fill();
    g.fillStyle = L([250, 254, 255], 0.95);
    g.beginPath();
    g.moveTo(bildX(o.b - 4.5), Y(top - 3));
    g.lineTo(bildX(o.b + 4), Y(top + 2));
    g.lineTo(bildX(o.b + 11), Y(top - 1));
    g.lineTo(bildX(o.b + 18), Y(top + 3));
    g.lineTo(bildX(o.b + 25), Y(top - 4));
    g.lineTo(bildX(o.b + 24), Y(top - 6.5));
    g.lineTo(bildX(o.b + 11), Y(top - 3.5));
    g.lineTo(bildX(o.b - 3.5), Y(top - 5.5));
    g.closePath();
    g.fill();
    g.fillStyle = F([176, 214, 240]);
    g.beginPath();
    g.moveTo(bildX(o.a - 1), Y(unter));
    g.lineTo(bildX(o.b + 18), Y(unter + 1));
    g.lineTo(bildX(o.b + 12), Y(unter + dick + 2));
    for (let i = 8; i >= 0; i -= 1) g.lineTo(bildX(o.a + (w * i) / 8), Y(unter + dick * (0.6 + 0.4 * (i / 8)) + Math.sin(i * 2.3 + o.saat * 7)));
    g.closePath();
    g.fill();
    g.fillStyle = L([250, 254, 255], 0.9);
    g.fillRect(bildX(o.a + 1), Math.min(Y(unter + dick * 0.62 + 0.6), Y(unter + dick * 0.62)), (w - 2) * s, 0.8 * s);
    // Die Zapfen: dicht, verschieden lang, die Spitzen bei DECKE.
    const zahl = Math.max(4, Math.round(w / 2.6));
    for (let i = 0; i < zahl; i += 1) {
      const x = o.a + 0.8 + ((w - 1.6) * (i + 0.5)) / zahl;
      const z = hash01(o.saat * 41 + i * 3.7);
      const spitze = DECKE + (i % 3 === 1 ? 1.6 + z * 2 : z * 0.4);
      const b = 0.7 + z * 0.6;
      g.fillStyle = F(i % 2 ? [196, 228, 250] : [160, 204, 238]);
      g.beginPath();
      g.moveTo(bildX(x - b), Y(unter + 0.2));
      g.lineTo(bildX(x), Y(spitze));
      g.lineTo(bildX(x + b), Y(unter + 0.2));
      g.closePath();
      g.fill();
      g.fillStyle = L([255, 255, 255], 0.7);
      g.fillRect(bildX(x - b * 0.6), Math.min(Y(unter), Y(spitze + 2)), Math.max(0.5, b * 0.4 * s), Math.abs(Y(unter) - Y(spitze + 2)));
    }
  }

  // Seerosen: Blätter und Blüten auf der Wasserlinie, ihre Stiele hängen
  // in die Tiefe – so weit wie der Umriss (Schilfgürtel).
  function zeichneSeerose(o) {
    const s = view.s;
    const w = o.b - o.a;
    const z = (i) => hash01(o.saat * 67 + i * 5.3);
    if (!o.gestalt) {
      const stiele = [];
      const zahl = Math.max(4, Math.round(w / 2.6));
      for (let i = 0; i < zahl; i += 1) {
        const x0 = o.a + 0.8 + ((w - 1.6) * (i + 0.5)) / zahl;
        stiele.push(bisUmriss(o, x0, -UFER - o.g, (z(i) - 0.5) * 0.5, 0.12, o.saat * 13 + i));
      }
      o.gestalt = { stiele };
    }
    profilPfad(o, uY, 20);
    g.fillStyle = "rgba(70, 200, 160, 0.08)";
    g.fill();
    schein("kalt", bildX(o.a + w / 2), uY(o.h * 0.5), (w * 0.05 + 0.8) * s, 0.35);
    g.lineCap = "round";
    o.gestalt.stiele.forEach((pts, i) => {
      auslaufend(pts, uY, 0.9, 0.5, i % 2 ? "rgb(70, 180, 140)" : "rgb(96, 206, 160)");
      const [tx, ty] = pts[pts.length - 1];
      // Unten ein leuchtender Knoten (die Wurzel).
      g.fillStyle = "rgba(200, 255, 220, 0.85)";
      g.beginPath();
      g.arc(bildX(tx), uY(ty), Math.max(0.9, 0.7 * s), 0, TAU);
      g.fill();
    });
    // Die Blätter auf dem Wasser, von unten gesehen, und zwei Blüten.
    for (let i = 0; i < Math.max(2, Math.round(w / 7)); i += 1) {
      const x = o.a + w * ((i + 0.5) / Math.max(2, Math.round(w / 7)));
      g.fillStyle = "rgba(40, 150, 120, 0.85)";
      g.beginPath();
      g.ellipse(bildX(x), view.wl + 0.8 * s, (3 + z(i + 20) * 2) * s, 1 * s, 0, 0, TAU);
      g.fill();
      if (i % 2 === 0) {
        schein("violett", bildX(x + 1), view.wl + 1.2 * s, 0.22, 0.8);
        g.fillStyle = "rgba(255, 210, 240, 0.95)";
        g.beginPath();
        g.arc(bildX(x + 1), view.wl + 1.4 * s, Math.max(1, 0.9 * s), 0, TAU);
        g.fill();
      }
    }
  }

  // Zapfen aus Stein: dunkle Fänge, die von der Wasserlinie hängen, mit
  // leuchtenden Adern (Felsufer).
  function zeichneZapfen(o) {
    const s = view.s;
    const w = o.b - o.a;
    const z = (i) => hash01(o.saat * 59 + i * 3.9);
    profilPfad(o, uY, 20);
    g.fillStyle = "rgba(120, 255, 200, 0.14)";
    g.fill();
    schein("kalt", bildX(o.a + o.p * w), uY(o.h * 0.5), (w * 0.05 + o.h * 0.04) * s, 0.4);
    const zahl = Math.max(3, Math.round(w / 3.4));
    for (let i = 0; i < zahl; i += 1) {
      const x = o.a + 1.2 + (w - 2.4) * ((i + 0.5) / zahl) + (z(i) - 0.5) * 1.2;
      const tief = Math.max(2, profil(o, x));
      const b = 1.2 + z(i + 20);
      g.fillStyle = i % 2 ? "rgb(52, 58, 84)" : "rgb(40, 46, 70)";
      g.beginPath();
      g.moveTo(bildX(x - b), view.wl);
      g.lineTo(bildX(x + b), view.wl);
      g.lineTo(bildX(x + b * 0.4), uY(tief - b));
      g.lineTo(bildX(x), uY(tief));
      g.lineTo(bildX(x - b * 0.5), uY(tief - b * 1.4));
      g.closePath();
      g.fill();
      // Eine Ader aus Licht.
      g.strokeStyle = "rgba(130, 255, 210, 0.75)";
      g.lineWidth = Math.max(0.5, 0.3 * s);
      g.beginPath();
      g.moveTo(bildX(x - b * 0.3), view.wl + s);
      g.lineTo(bildX(x + b * 0.2), uY(tief * 0.5));
      g.lineTo(bildX(x), uY(tief - 0.4));
      g.stroke();
    }
  }

  // Die Unterseite einer Eisscholle, die auf dem Wasser treibt: ein Block
  // aus Eis, von der Wasserlinie bis zum Umriss (Gletschersee).
  function zeichneScholle(o) {
    const s = view.s;
    const w = o.b - o.a;
    profilPfad(o, uY, 20);
    g.save();
    g.clip();
    g.fillStyle = "rgba(150, 214, 255, 0.55)";
    g.fillRect(bildX(o.a - 1), view.wl, (w + 2) * s, view.cssH);
    g.fillStyle = "rgba(220, 248, 255, 0.45)";
    g.fillRect(bildX(o.a - 1), view.wl, (w + 2) * s, (UFER + o.g + o.h * 0.35) * s);
    g.strokeStyle = "rgba(255, 255, 255, 0.5)";
    g.lineWidth = Math.max(0.5, 0.3 * s);
    g.beginPath();
    for (let i = 0; i < 4; i += 1) {
      const x = o.a + w * (0.15 + hash01(o.saat * 7 + i) * 0.7);
      g.moveTo(bildX(x), view.wl);
      g.lineTo(bildX(x + 2 - hash01(i) * 4), uY(o.h * 0.8));
    }
    g.stroke();
    g.restore();
    // Die Unterkante leuchtet.
    g.strokeStyle = "rgba(200, 250, 255, 0.95)";
    g.lineWidth = Math.max(0.9, 0.6 * s);
    g.beginPath();
    for (let i = 0; i <= 16; i += 1) {
      const x = o.a + (w * i) / 16;
      if (i) g.lineTo(bildX(x), uY(profil(o, x))); else g.moveTo(bildX(x), uY(profil(o, x)));
    }
    g.stroke();
    // Oben schaut sie flach aus dem Wasser.
    g.fillStyle = "rgba(240, 250, 255, 0.95)";
    g.fillRect(bildX(o.a + 0.5), view.wl - 1.1 * s, (w - 1) * s, 1.1 * s);
  }

  // ---------------------------------------------------------------------------
  // Zeichnen: was sich bewegt
  // ---------------------------------------------------------------------------
  // Vögel, die tief über den Weg streichen, ihr entgegen (oben); ein
  // Fischschwarm in der Tiefe (unten). Beide so weit, wie sie reichen: Unter
  // den Vögeln liegt ihr Schatten, über den Fischen ein Schein.
  function zeichneBewegte(unten) {
    const von = state.camX - view.rx / view.s - 60;
    const bis = state.camX + (view.cssW - view.rx) / view.s + 60;
    const t = state.phase === "bereit" ? 0 : state.t;
    state.bewegte.forEach((o) => {
      if (o.kind === "springer") {
        zeichneSpringer(o, t, unten);
        return;
      }
      if ((o.welt === "unten") !== unten) return;
      const d = o.u * (o.tRef - t);
      const a = o.a + d;
      const b = o.b + d;
      if (b < von || a > bis) return;
      g.globalAlpha = spurDeutlich(o.spur, (a + b) / 2);
      if (unten) {
        uGrund = o.g;
        zeichneFische(o, a, b);
        uGrund = 0;
      } else zeichneVoegel(o, a, b);
      g.globalAlpha = 1;
    });
  }

  function zeichneVoegel(o, a, b) {
    const s = view.s;
    const Y = (v) => obenY(o.g + v);
    const w = b - a;
    // Der Schatten: so weit reichen sie.
    g.fillStyle = "rgba(30, 20, 50, 0.26)";
    g.beginPath();
    g.ellipse(bildX((a + b) / 2), Y(0.2), (w / 2 + 2) * s, 1.1 * s, 0, 0, TAU);
    g.fill();
    const zahl = Math.max(4, Math.round(w / 6));
    const schwarz = o.land === 1 ? [92, 74, 56] : [38, 32, 48];
    for (let i = 0; i < zahl; i += 1) {
      const u = (i + 0.5) / zahl;
      const z = hash01(o.saat * 17 + i * 3.3);
      const x = a + w * u;
      const y = DECKE + 2.2 + z * 7;
      const flug = ruhig() ? 0.4 : Math.sin(state.zeit * 14 + i * 1.7);
      const sp = 3.2 + z;
      // Rumpf und Flügel (nach links fliegend).
      g.fillStyle = F(schwarz);
      g.beginPath();
      g.ellipse(bildX(x), Y(y), 2 * s, 0.9 * s, 0, 0, TAU);
      g.fill();
      g.strokeStyle = F(schwarz);
      g.lineWidth = Math.max(0.8, 0.8 * s);
      g.lineCap = "round";
      g.beginPath();
      g.moveTo(bildX(x + 0.3), Y(y + 0.2));
      g.quadraticCurveTo(bildX(x + sp * 0.4), Y(y + 1.5 + flug * 1.8), bildX(x + sp), Y(y + flug * 2.6));
      g.stroke();
      // Der gelbe Schnabel der Alpendohle (im Schilf: Enten, grün glänzend).
      g.fillStyle = o.land === 1 ? F([70, 150, 110]) : F([250, 210, 60]);
      g.beginPath();
      g.moveTo(bildX(x - 2), Y(y + 0.3));
      g.lineTo(bildX(x - 3.2), Y(y));
      g.lineTo(bildX(x - 2), Y(y - 0.3));
      g.fill();
      g.fillStyle = L([255, 214, 190], 0.5);
      g.fillRect(bildX(x - 1.4), Y(y + 0.7), 2.4 * s, Math.max(0.5, 0.35 * s));
    }
  }

  function zeichneFische(o, a, b) {
    const s = view.s;
    const w = b - a;
    const band = g.createLinearGradient(0, view.wl, 0, uY(0.6));
    band.addColorStop(0, "rgba(210, 150, 255, 0.45)");
    band.addColorStop(1, "rgba(210, 150, 255, 0)");
    g.fillStyle = band;
    g.fillRect(bildX(a), view.wl, w * s, (UFER + uGrund + 0.6) * s);
    const zahl = Math.max(6, Math.round(w / 3.4));
    schein("violett", bildX((a + b) / 2), uY(DECKE + 5), (w * 0.05 + 1) * s, 0.4);
    for (let i = 0; i < zahl; i += 1) {
      const z = hash01(o.saat * 23 + i * 2.9);
      const x = a + 1.5 + (w - 3) * ((i + z * 0.6) / zahl);
      const y = DECKE + 1.8 + hash01(o.saat * 7 + i * 5.1) * 8.5 + (ruhig() ? 0 : Math.sin(state.zeit * 3 + i) * 0.5);
      const schlag = ruhig() ? 0 : Math.sin(state.zeit * 12 + i * 2.1) * 0.6;
      g.fillStyle = i % 3 ? "rgba(150, 230, 255, 0.9)" : "rgba(220, 180, 255, 0.9)";
      g.beginPath();
      g.moveTo(bildX(x - 2), uY(y));
      g.quadraticCurveTo(bildX(x - 0.5), uY(y - 1.1), bildX(x + 1.4), uY(y));
      g.lineTo(bildX(x + 2.6), uY(y - 0.9 + schlag));
      g.lineTo(bildX(x + 2.6), uY(y + 0.9 + schlag));
      g.lineTo(bildX(x + 1.4), uY(y));
      g.quadraticCurveTo(bildX(x - 0.5), uY(y + 1.1), bildX(x - 2), uY(y));
      g.fill();
    }
    // Die Kante zur Wasserlinie: so hoch reichen sie.
    g.fillStyle = "rgba(60, 30, 80, 0.8)";
    g.fillRect(bildX(a), uY(DECKE) - 0.35, w * s, 0.7);
  }

  // Der springende Hecht: Vorher verrät ihn eine Bugwelle auf der
  // Wasserlinie, die ihr entgegenläuft; dann schiesst er heraus, fliegt im
  // Bogen unter ihr hindurch und taucht wieder ein. Oben im Licht, im See
  // sein leuchtendes Spiegelbild.
  function zeichneSpringer(o, t, unten) {
    const s = view.s;
    const p = springerBei(o, t);
    const x = bildX(p.x);
    if (x < -80 || x > view.cssW + 80) return;
    const bisRaus = o.tm - 0.45 - t;
    if (!p.raus) {
      // Unter Wasser: nur die Bugwelle, ab 1,8 s vor dem Sprung.
      if (bisRaus > 1.8 || t > o.tm) return;
      if (!unten) {
        const kraft = clamp(1 - bisRaus / 1.8, 0, 1);
        g.strokeStyle = `rgba(255, 246, 236, ${0.75 * kraft})`;
        g.lineWidth = 1;
        g.beginPath();
        for (let i = 0; i < 3; i += 1) {
          const lang = (6 + i * 5) * s;
          g.moveTo(x - 2 * s, view.wl - 0.3);
          g.lineTo(x + lang, view.wl - 1.2 - i * 0.5);
          g.moveTo(x - 2 * s, view.wl + 0.6);
          g.lineTo(x + lang, view.wl + 1.6 + i * 0.6);
        }
        g.stroke();
      } else {
        // Sein Schatten gleich unter der Wasserlinie.
        const kraft = clamp(1 - bisRaus / 1.8, 0, 1);
        g.fillStyle = `rgba(150, 120, 255, ${0.5 * kraft})`;
        g.beginPath();
        g.ellipse(x + o.L * 0.1 * s, view.wl + 2.2 * s, o.L * 0.45 * s, 1.4 * s, 0, 0, TAU);
        g.fill();
      }
      return;
    }
    // Im Sprung: der Körper entlang seiner Flugbahn.
    const Y = unten ? untenY : obenY;
    const halb = o.L / 2;
    const dx = Math.cos(p.w) * halb;
    const dy = Math.sin(p.w) * halb;
    const kopf = [p.x - dx, o.g + p.y - dy];
    const schwanz = [p.x + dx, o.g + p.y + dy];
    g.save();
    g.beginPath();
    if (unten) g.rect(-10, view.wl, view.cssW + 20, view.cssH); else g.rect(-10, -20, view.cssW + 20, view.wl + 20);
    g.clip();
    if (unten) schein("violett", x, Y(o.g + p.y), 0.9 * s, 0.5);
    const breit = o.th * 1.15;
    const nx = -Math.sin(p.w);
    const ny = Math.cos(p.w);
    const P = (u, v) => [bildX(lerp(kopf[0], schwanz[0], u) + nx * v * breit), Y(lerp(kopf[1], schwanz[1], u) + ny * v * breit)];
    g.fillStyle = unten ? "rgba(80, 120, 170, 0.95)" : "rgb(88, 112, 84)";
    g.beginPath();
    let q = P(0, 0);
    g.moveTo(q[0], q[1]);
    [[0.12, 0.8], [0.4, 1], [0.75, 0.75], [0.88, 0.3]].forEach(([u, v]) => { q = P(u, v); g.lineTo(q[0], q[1]); });
    [[1, 0.9], [0.95, 0], [1, -0.9]].forEach(([u, v]) => { q = P(u, v); g.lineTo(q[0], q[1]); });
    [[0.88, -0.3], [0.75, -0.75], [0.4, -0.95], [0.12, -0.7]].forEach(([u, v]) => { q = P(u, v); g.lineTo(q[0], q[1]); });
    g.closePath();
    g.fill();
    // Der helle Bauch, die Flecken, das Auge.
    g.fillStyle = unten ? "rgba(200, 240, 255, 0.55)" : "rgba(232, 236, 196, 0.8)";
    g.beginPath();
    q = P(0.15, -0.4); g.moveTo(q[0], q[1]);
    q = P(0.6, -0.8); g.lineTo(q[0], q[1]);
    q = P(0.6, -0.4); g.lineTo(q[0], q[1]);
    g.closePath();
    g.fill();
    g.fillStyle = unten ? "rgba(190, 255, 240, 0.6)" : "rgba(210, 220, 160, 0.75)";
    for (let i = 0; i < 5; i += 1) {
      q = P(0.3 + i * 0.1, 0.35 - (i % 2) * 0.3);
      g.fillRect(q[0] - 0.6, q[1] - 0.6, 1.3, 1.3);
    }
    q = P(0.07, 0.3);
    g.fillStyle = unten ? "#e8ffff" : "#fff6d0";
    g.beginPath();
    g.arc(q[0], q[1], Math.max(0.8, 0.6 * s), 0, TAU);
    g.fill();
    if (!unten) {
      g.strokeStyle = "rgba(255, 236, 210, 0.85)";
      g.lineWidth = Math.max(0.6, 0.4 * s);
      g.beginPath();
      q = P(0.05, 0.6); g.moveTo(q[0], q[1]);
      q = P(0.4, 1); g.lineTo(q[0], q[1]);
      q = P(0.75, 0.75); g.lineTo(q[0], q[1]);
      g.stroke();
    } else {
      g.strokeStyle = "rgba(150, 250, 255, 0.85)";
      g.lineWidth = 0.9;
      g.beginPath();
      q = P(0, 0); g.moveTo(q[0], q[1]);
      [[0.12, 0.8], [0.4, 1], [0.75, 0.75], [0.88, 0.3]].forEach(([u, v]) => { q = P(u, v); g.lineTo(q[0], q[1]); });
      g.stroke();
    }
    g.restore();
    // Tropfen, die von ihm fliegen.
    if (!unten && !ruhig()) {
      for (let i = 0; i < 4; i += 1) {
        const tt = (state.zeit * 3 + i * 0.25) % 1;
        g.fillStyle = `rgba(240, 248, 255, ${0.8 * (1 - tt)})`;
        g.fillRect(bildX(schwanz[0] + tt * 6 + i), obenY(schwanz[1] - tt * tt * 5 + i * 0.6), 1.2, 1.2);
      }
    }
  }

  function sichtbare(fn) {
    const liste = state.hindernisse;
    const von = state.camX - view.rx / view.s - 90;
    const bis = state.camX + (view.cssW - view.rx) / view.s + 90;
    for (let i = abIndex(von); i < liste.length; i += 1) {
      const o = liste[i];
      if (o.a > bis) break;
      if (o.b < von) continue;
      fn(o);
    }
  }

  // Unten die Spiegelwelt: ihre eigenen Hindernisse und – wo der See treu
  // ist – die Spiegelbilder des Ufers. Je Spur (der obere Weg einer
  // Gabelung zuerst, er liegt hinten); der Weg, den sie nicht gewählt hat,
  // tritt zurück.
  function zeichneHindernisseUnten(spur) {
    const n = nachtK();
    g.save();
    g.beginPath();
    g.rect(-10, view.wl + 0.5, view.cssW + 20, view.cssH);
    g.clip();
    sichtbare((o) => {
      if (o.spur !== spur || o.kind === "luecke") return;
      const deutlich = spurDeutlich(spur, (o.a + o.b) / 2);
      g.globalAlpha = deutlich;
      uGrund = o.g;
      if (o.art === "fels") zeichneFelssturz(o, true);
      else if (o.welt === "unten") zeichneUnten(o);
      else if (o.spiegel) {
        stil = n > 0.5 ? "nacht" : "spiegel";
        if (n > 0.5) {
          // Im erwachten See leuchtet das treue Spiegelbild des Ufers.
          const tief = o.kind === "decke" ? DECKE + 6 : o.h * 0.5;
          schein("kalt", bildX((o.a + o.b) / 2), uY(tief), ((o.b - o.a) * 0.05 + 1.2) * view.s, 0.5 * deutlich);
        }
        zeichneOben(o, uY, false);
        stil = "tag";
      }
      uGrund = 0;
      g.globalAlpha = 1;
    });
    g.restore();
  }

  function zeichneUnten(o) {
    if (o.art === "kristall") zeichneKristall(o);
    else if (o.art === "schilf") zeichneSchilf(o);
    else if (o.art === "wurzel") zeichneWurzel(o);
    else if (o.art === "seerose") zeichneSeerose(o);
    else if (o.art === "zapfen") zeichneZapfen(o);
    else if (o.art === "scholle") zeichneScholle(o);
    else if (o.art === "hecht") zeichneHecht(o);
    else if (o.art === "qualle") zeichneQualle(o);
    else if (o.art === "treibholz") zeichneTreibholz(o);
  }

  function zeichneOben(o, Y, oben) {
    if (o.art === "stein") zeichneStein(o, Y);
    else if (o.art === "stamm") zeichneStamm(o, Y);
    else if (o.art === "kiste") zeichneKiste(o, Y);
    else if (o.art === "eisblock") zeichneEisblock(o, Y);
    else if (o.art === "steinbock") zeichneSteinbock(o, Y, oben);
    else if (o.art === "ast" || o.art === "weide" || o.art === "foehre") zeichneAst(o, Y, oben);
    else if (o.art === "dach") zeichneDach(o, Y, oben);
    else if (o.art === "netz") zeichneNetz(o, Y, oben);
    else if (o.art === "eiszapfen") zeichneEiszapfen(o, Y, oben);
  }

  function zeichneHindernisseOben(decken, spur) {
    g.save();
    g.beginPath();
    g.rect(-10, -20, view.cssW + 20, view.wl + 19.5);
    g.clip();
    sichtbare((o) => {
      if (o.welt !== "oben" || o.kind === "luecke" || o.spur !== spur) return;
      if ((o.kind === "decke") !== decken) return;
      const deutlich = spurDeutlich(spur, (o.a + o.b) / 2);
      if (o.art === "fels") {
        g.globalAlpha = deutlich;
        zeichneFelssturz(o, false);
        g.globalAlpha = 1;
        return;
      }
      const verdeckt = o.nebel ? nebelBei((o.a + o.b) / 2) : 0;
      g.globalAlpha = deutlich * (1 - verdeckt * 0.85);
      zeichneOben(o, (v) => obenY(o.g + v), true);
      g.globalAlpha = 1;
    });
    g.restore();
  }

  // ---------------------------------------------------------------------------
  // Zeichnen: die Läuferin
  // ---------------------------------------------------------------------------
  /*
   * Von der Seite, nach rechts laufend (x voraus, y nach oben, null zwischen
   * den Sohlen am Boden). Eine Jacke in Petrol, dunkle Laufhosen, weisse
   * Schuhe mit roter Sohle, ein senffarbener Wollschal, der hinter ihr weht,
   * ein Stirnband und ein kastanienroter Pferdeschwanz, der bei jedem
   * Schritt wippt. Das Licht kommt von links hinten (die Sonne hinter den
   * Bergen): eine helle Kante an Rücken und Kopf.
   *
   *   p.beine[i]  { t: Oberschenkel nach vorn, k: Knie gebeugt, f: Fuss }
   *               (0 das nahe Bein, 1 das ferne)
   *   p.arme[i]   { o: Oberarm nach vorn, u: Ellbogen gebeugt }
   *   p.lean      wie weit sie sich nach vorn lehnt
   *   p.zopf      wie der Pferdeschwanz gerade schwingt (−1 … 1)
   *   p.schal     wie sehr der Schal weht (0 hängt, 1 fliegt)
   *   p.huefte    die Höhe der Hüfte, wenn nicht die Beine sie bestimmen
   */
  const OS = 5.6;
  const US = 5.4;
  const RUMPF = 6.5;
  const OA = 3.5;
  const UA = 3.3;
  const KOPF = 2.4;
  const FUSS = 2.3;
  const FARBEN = {
    jacke: [30, 116, 132], jackeHell: [86, 186, 190], jackeDunkel: [18, 70, 88],
    hose: [44, 34, 68], hoseDunkel: [26, 20, 44],
    schuh: [246, 242, 246], sohle: [255, 98, 84],
    haut: [242, 198, 166], hautDunkel: [206, 150, 124],
    haar: [128, 52, 32], haarHell: [204, 104, 64],
    band: [255, 106, 92], schal: [244, 180, 46], schalDunkel: [196, 124, 26],
    kante: [255, 220, 192],
  };

  function bein(hx, hy, b) {
    const kx = hx + Math.sin(b.t) * OS;
    const ky = hy - Math.cos(b.t) * OS;
    const sa = b.t - b.k;
    const ax = kx + Math.sin(sa) * US;
    const ay = ky - Math.cos(sa) * US;
    const fw = sa + (b.f || 0);
    return { kx, ky, ax, ay, tx: ax + Math.cos(fw) * FUSS, ty: ay + Math.sin(fw) * FUSS, hx: ax - Math.cos(fw) * 0.6, hy: ay - Math.sin(fw) * 0.6, fw };
  }

  function zeichneLaeuferin(sx, sy, s, flip, p, wahl = {}) {
    const { geist = null, alpha = 1, kontur = null, kante = false, dreh = 0, stauch = 0, zeit = state.zeit } = wahl;
    const C = (c) => (geist || rgb(ton(c)));
    // Die Hüfte: so hoch, dass der tiefere Fuss den Boden berührt.
    const tief = (b) => {
      const j = bein(0, 0, b);
      return Math.min(j.ay - 0.55, j.ty - 0.35, j.hy - 0.35);
    };
    const hy = p.huefte ?? -Math.min(tief(p.beine[0]), tief(p.beine[1]));
    const hx = -0.3;
    const lean = p.lean;
    const sh = [hx + Math.sin(lean) * RUMPF, hy + Math.cos(lean) * RUMPF];
    const kopf = [sh[0] + Math.sin(lean + (p.kopf || 0)) * (KOPF + 1.05) + 0.25, sh[1] + Math.cos(lean + (p.kopf || 0)) * (KOPF + 1.05)];
    const B = p.beine.map((b) => bein(hx, hy, b));
    const arm = (a) => {
      const ex = sh[0] - 0.2 + Math.sin(a.o) * OA;
      const ey = sh[1] - 0.4 - Math.cos(a.o) * OA;
      const w = a.o + a.u;
      return { ex, ey, hx: ex + Math.sin(w) * UA, hy: ey - Math.cos(w) * UA };
    };
    const A = p.arme.map(arm);
    // Der Schal und der Pferdeschwanz: Ketten, die hinter ihr wehen.
    const wehen = p.schal ?? 1;
    const schalA = [sh[0] - 1.1, sh[1] + 0.6];
    const schalPunkte = (phase, lang) => {
      const pts = [schalA];
      const winkel = lerp(1.35, 0.1, wehen);
      for (let i = 1; i <= lang; i += 1) {
        const welle = Math.sin(zeit * 11 - i * 0.9 + phase) * 0.22 * i * wehen;
        pts.push([schalA[0] - Math.cos(winkel) * 1.45 * i, schalA[1] - Math.sin(winkel) * 1.45 * i + welle - (1 - wehen) * 0.1 * i]);
      }
      return pts;
    };
    const zopfA = [kopf[0] - KOPF * 0.78, kopf[1] + KOPF * 0.5];
    const zb = p.zopf || 0;
    const zopf = [zopfA, [zopfA[0] - 2.4, zopfA[1] - 0.5 + zb * 0.7], [zopfA[0] - 4.4, zopfA[1] - 1.6 + zb * 1.4], [zopfA[0] - 5.6, zopfA[1] - 3.2 + zb * 1.6]];

    g.save();
    g.globalAlpha = alpha;
    g.translate(sx, sy);
    g.scale(s, flip ? s : -s);
    if (stauch > 0) g.scale(1 + stauch * 0.08, 1 - stauch * 0.12);
    if (dreh) {
      g.translate(hx, hy);
      g.rotate(-dreh);
      g.translate(-hx, -hy);
    }
    g.lineCap = "round";
    g.lineJoin = "round";

    // pass(kf, plus, ox, oy): einmal die ganze Figur. kf gesetzt: alles in
    // dieser einen Farbe, um plus dicker – für die helle Kante und den
    // leuchtenden Umriss.
    const pass = (kf, plus, ox, oy) => {
      g.save();
      if (ox || oy) g.translate(ox, oy);
      const strich = (c, b) => { g.strokeStyle = kf || C(c); g.lineWidth = b + plus; };
      const linie = (pts, b, c) => {
        strich(c, b);
        g.beginPath();
        pts.forEach(([x, y], i) => { if (i) g.lineTo(x, y); else g.moveTo(x, y); });
        g.stroke();
      };
      const fuell = (pfad, c) => {
        pfad();
        g.fillStyle = kf || C(c);
        g.fill();
        if (kf && plus > 0) { g.strokeStyle = kf; g.lineWidth = plus; g.stroke(); }
      };
      const beinMalen = (j, fern) => {
        linie([[hx, hy], [j.kx, j.ky]], 2.6, fern ? FARBEN.hoseDunkel : FARBEN.hose);
        linie([[j.kx, j.ky], [j.ax, j.ay]], 1.9, fern ? FARBEN.hoseDunkel : FARBEN.hose);
        // Der Schuh: weiss, mit roter Sohle.
        linie([[j.hx, j.hy], [j.tx, j.ty]], 1.55, fern ? mix3(FARBEN.schuh, [120, 110, 140], 0.35) : FARBEN.schuh);
        if (!kf) {
          const nx = Math.sin(j.fw) * 0.62;
          const ny = -Math.cos(j.fw) * 0.62;
          linie([[j.hx + nx, j.hy + ny], [j.tx + nx, j.ty + ny]], 0.55, FARBEN.sohle);
        }
      };
      const armMalen = (a, fern) => {
        linie([[sh[0] - 0.2, sh[1] - 0.4], [a.ex, a.ey]], 1.6, fern ? FARBEN.jackeDunkel : FARBEN.jacke);
        linie([[a.ex, a.ey], [a.hx, a.hy]], 1.35, fern ? FARBEN.jackeDunkel : FARBEN.jacke);
        fuell(() => { g.beginPath(); g.arc(a.hx, a.hy, 0.72, 0, TAU); }, fern ? FARBEN.hautDunkel : FARBEN.haut);
      };
      // Das ferne Bein und der ferne Arm.
      beinMalen(B[1], true);
      armMalen(A[1], true);
      // Der Pferdeschwanz, hinter dem Kopf.
      strich(FARBEN.haar, 2);
      g.beginPath();
      g.moveTo(zopf[0][0], zopf[0][1]);
      g.bezierCurveTo(zopf[1][0], zopf[1][1], zopf[2][0], zopf[2][1], zopf[3][0], zopf[3][1]);
      g.stroke();
      strich(FARBEN.haar, 1.1);
      g.beginPath();
      g.moveTo(zopf[2][0], zopf[2][1]);
      g.quadraticCurveTo(zopf[3][0] + 0.3, zopf[3][1] - 0.6, zopf[3][0] - 0.8, zopf[3][1] - 1.6);
      g.stroke();
      if (!kf) {
        strich(FARBEN.haarHell, 0.5);
        g.beginPath();
        g.moveTo(zopf[0][0], zopf[0][1] + 0.5);
        g.bezierCurveTo(zopf[1][0], zopf[1][1] + 0.5, zopf[2][0], zopf[2][1] + 0.4, zopf[3][0], zopf[3][1] + 0.3);
        g.stroke();
      }
      // Die Enden des Schals, hinter dem Rumpf.
      [[0, 6, 1.25], [1.7, 5, 1.0]].forEach(([phase, lang, b], i) => {
        const pts = schalPunkte(phase, lang).map(([x, y]) => [x, y - i * 0.6]);
        linie(pts.slice(0, 3), b + 0.25, i ? FARBEN.schalDunkel : FARBEN.schal);
        linie(pts.slice(2), b, i ? FARBEN.schalDunkel : FARBEN.schal);
        if (!kf && !i) {
          // Fransen am Ende.
          const [ex, ey] = pts[pts.length - 1];
          linie([[ex, ey], [ex - 0.9, ey - 0.3]], 0.35, FARBEN.schal);
          linie([[ex, ey + 0.4], [ex - 0.9, ey + 0.3]], 0.35, FARBEN.schal);
        }
      });
      // Der Rumpf: die Jacke.
      const dx = Math.sin(lean);
      const dy = Math.cos(lean);
      fuell(() => {
        g.beginPath();
        g.moveTo(hx - dy * 1.6, hy + dx * 1.6);
        g.lineTo(sh[0] - dy * 1.85, sh[1] + dx * 1.85);
        g.quadraticCurveTo(sh[0] + dx * 0.9, sh[1] + dy * 0.9, sh[0] + dy * 1.5, sh[1] - dx * 1.5);
        g.quadraticCurveTo(hx + dx * RUMPF * 0.55 + dy * 2.1, hy + dy * RUMPF * 0.55 - dx * 2.1, hx + dy * 1.4, hy - dx * 1.4);
        g.quadraticCurveTo(hx, hy - 1.1, hx - dy * 1.6, hy + dx * 1.6);
        g.closePath();
      }, FARBEN.jacke);
      if (!kf) {
        // Ein heller Streifen an der Seite und der Saum.
        linie([[hx + dx * 1 - dy * 0.2, hy + dy * 1 + dx * 0.2], [sh[0] - dx * 0.8 - dy * 0.3, sh[1] - dy * 0.8 + dx * 0.3]], 0.45, FARBEN.jackeHell);
        linie([[hx - dy * 1.5, hy + dx * 1.5 + 0.1], [hx + dy * 1.3, hy - dx * 1.3 + 0.1]], 0.6, FARBEN.jackeDunkel);
      }
      // Das nahe Bein.
      beinMalen(B[0], false);
      // Der Hals und der Schal um ihn.
      linie([[sh[0] + 0.1, sh[1]], [kopf[0] - 0.3, kopf[1] - KOPF * 0.6]], 1.25, FARBEN.haut);
      linie([[sh[0] - 1.3, sh[1] + 0.55], [sh[0] + 1.1, sh[1] + 0.85]], 1.5, FARBEN.schal);
      // Der Kopf: Gesicht, Haar, Stirnband.
      fuell(() => { g.beginPath(); g.arc(kopf[0], kopf[1], KOPF, 0, TAU); }, FARBEN.haut);
      fuell(() => {
        g.beginPath();
        g.arc(kopf[0] - 0.12, kopf[1] + 0.05, KOPF * 1.05, Math.PI * 0.3, Math.PI * 1.32);
        g.quadraticCurveTo(kopf[0] - 0.4, kopf[1] - 0.2, kopf[0] - 0.12 + Math.cos(Math.PI * 0.3) * KOPF * 1.05, kopf[1] + 0.05 + Math.sin(Math.PI * 0.3) * KOPF * 1.05);
        g.closePath();
      }, FARBEN.haar);
      linie([[kopf[0] + KOPF * 0.86, kopf[1] + KOPF * 0.5], [kopf[0] - KOPF * 0.98, kopf[1] + KOPF * 0.18]], 0.95, FARBEN.band);
      if (!kf) {
        // Haargummi, Ohr, Auge, Nase, ein wenig Röte von der Kälte.
        fuell(() => { g.beginPath(); g.arc(zopfA[0] + 0.2, zopfA[1], 0.55, 0, TAU); }, FARBEN.band);
        fuell(() => { g.beginPath(); g.arc(kopf[0] - 0.25, kopf[1] - 0.15, 0.5, 0, TAU); }, FARBEN.hautDunkel);
        g.fillStyle = geist || "rgba(30, 20, 40, 0.95)";
        g.beginPath();
        g.arc(kopf[0] + 1.25, kopf[1] + 0.35, 0.33, 0, TAU);
        g.fill();
        fuell(() => { g.beginPath(); g.arc(kopf[0] + KOPF * 0.98, kopf[1] - 0.15, 0.42, 0, TAU); }, FARBEN.haut);
        g.fillStyle = geist || rgba(ton([255, 120, 120]), 0.35);
        g.beginPath();
        g.arc(kopf[0] + 1.0, kopf[1] - 0.75, 0.55, 0, TAU);
        g.fill();
      }
      // Der nahe Arm, vor allem.
      armMalen(A[0], false);
      g.restore();
    };

    if (kontur) pass(kontur.farbe, kontur.plus, 0, 0);
    if (kante && !geist) pass(rgba(ton(FARBEN.kante), 0.9), 0.25, -0.42, 0.38);
    pass(null, 0, 0, 0);
    g.restore();
    return { kopf, hy };
  }

  // Die Haltungen.
  function poseLauf(ph) {
    const a = ph * TAU;
    const b = (w) => ({ t: 0.12 + 0.7 * Math.sin(w), k: 0.22 + 1.6 * Math.pow(Math.max(0, Math.cos(w + 0.55)), 1.3), f: -0.1 - 0.4 * Math.max(0, Math.cos(w + 0.2)) });
    const arm = (w) => ({ o: -0.85 * Math.sin(w) + 0.12, u: 1.5 + 0.25 * Math.sin(w + 0.4) });
    return { beine: [b(a), b(a + Math.PI)], arme: [arm(a), arm(a + Math.PI)], lean: 0.2, zopf: Math.sin(a * 2 + 1.2), schal: 1, kopf: -0.08 };
  }
  function poseSprung(f) {
    const hock = Math.sin(Math.min(1, f / 0.82) * Math.PI);
    const vorn = { t: lerp(0.5, 1.2, hock), k: lerp(0.35, 1.55, hock), f: -0.1 };
    const hinten = { t: lerp(-0.45, 0.15, hock), k: lerp(0.9, 1.75, hock), f: -0.45 };
    if (f > 0.78) {
      const e = (f - 0.78) / 0.22;
      vorn.t = lerp(vorn.t, 0.42, e);
      vorn.k = lerp(vorn.k, 0.4, e);
      hinten.t = lerp(hinten.t, -0.05, e);
      hinten.k = lerp(hinten.k, 0.55, e);
    }
    return {
      beine: [vorn, hinten], arme: [{ o: lerp(-0.7, 2.1, hock), u: lerp(1.2, 0.6, hock) }, { o: lerp(1.0, 2.5, hock), u: 0.6 }],
      lean: lerp(0.28, 0.06, hock), zopf: lerp(0.8, -1, hock), schal: 1, kopf: -0.05,
    };
  }
  function poseStehen(t) {
    const atem = Math.sin(t * 2.4);
    return {
      beine: [{ t: 0.12, k: 0.16, f: 0 }, { t: -0.1, k: 0.2, f: 0 }], arme: [{ o: -0.1, u: 1.0 + 0.05 * atem }, { o: 0.2, u: 1.2 }],
      lean: 0.05, zopf: 0.15 * atem - 0.6, schal: 0.25 + 0.1 * atem, kopf: 0.02 * atem,
    };
  }
  function poseLiegt() {
    return { beine: [{ t: 0.7, k: 0.6, f: 0 }, { t: -0.35, k: 0.9, f: -0.3 }], arme: [{ o: 2.4, u: 0.4 }, { o: 1.5, u: 0.6 }], lean: 0.1, zopf: 0.5, schal: 0.6, kopf: 0.2 };
  }
  function poseKnien() {
    return { beine: [{ t: 1.45, k: 1.5, f: 0 }, { t: 0.15, k: 1.65, f: -0.4 }], arme: [{ o: 2.3, u: 2.1 }, { o: 2.0, u: 2.0 }], lean: 0.32, zopf: -0.6, schal: 0.3, kopf: 0.3, huefte: 6.1 };
  }
  function poseFallen() {
    return { beine: [{ t: 0.15, k: 0.25, f: 0.2 }, { t: -0.15, k: 0.35, f: 0.2 }], arme: [{ o: 2.9, u: 0.2 }, { o: 2.6, u: 0.3 }], lean: 0, zopf: -1, schal: 1, kopf: 0 };
  }

  function haltung() {
    const r = state.laeuferin;
    if (state.schritt === "start") return poseStehen(state.zeit);
    if (r.sprung !== null) return poseSprung(clamp((state.t - r.sprung) / SPRUNG, 0, 1));
    return poseLauf(state.lauf);
  }

  // Die Läuferin und ihr Spiegelbild. Im treuen See: dieselbe Figur,
  // dunkler und blauer. Im erwachten: im Spiegelton, mit leuchtendem Umriss
  // und ein wenig wässrig (sie wiegt sich leicht).
  function zeichneFigur() {
    const r = state.laeuferin;
    const s = view.s;
    if (state.schritt === "sturz" && state.sturz) {
      zeichneSturz();
      return;
    }
    const p = haltung();
    const sx = bildX(r.x);
    const n = nachtK();
    const still = ruhig();
    // Das Spiegelbild.
    g.save();
    g.beginPath();
    g.rect(-10, view.wl + 0.3, view.cssW + 20, view.cssH);
    g.clip();
    const sy2 = untenY(r.A);
    if (n < 1) {
      stil = "spiegel";
      zeichneLaeuferin(sx, sy2, s, true, p, { stauch: state.stauch, alpha: 1 - n });
    }
    if (n > 0) {
      stil = "glanz";
      schein("kalt", sx + 0.5 * s, untenY(r.A + TOP * 0.55), 0.9 * s, 0.4 * n);
      g.save();
      if (!still) {
        g.translate(sx, sy2);
        g.transform(1, 0, Math.sin(state.zeit * 2.3) * 0.05, 1, 0, 0);
        g.translate(-sx, -sy2);
      }
      zeichneLaeuferin(sx, sy2, s, true, p, { stauch: state.stauch, alpha: n, kontur: { farbe: "rgba(150, 250, 255, 0.85)", plus: 1.1 } });
      g.restore();
    }
    stil = "tag";
    g.restore();
    // Ihr Schatten auf dem Weg, im Sprung blasser.
    g.fillStyle = `rgba(40, 30, 60, ${clamp(0.3 - r.y * 0.006, 0.06, 0.3)})`;
    const boden = r.A - r.y;
    g.beginPath();
    g.ellipse(sx + 2 * s, obenY(boden + 0.1), (6 + r.y * 0.08) * s, 1.1 * s, 0, 0, TAU);
    g.fill();
    // Sie selbst.
    zeichneLaeuferin(sx, obenY(r.A), s, false, p, { stauch: state.stauch, kante: true });
  }

  function zeichneSturz() {
    const f = state.sturz;
    const s = view.s;
    const sx = bildX(f.x);
    const n = nachtK();
    const pose = f.warum === "glas" ? poseKnien() : f.warum === "wasser" ? poseFallen() : (f.zeit < 0.2 ? poseSprung(0.4) : poseLiegt());
    // Wer liegt, liegt auf dem Weg: um die Hüfte gedreht, und so viel tiefer.
    const lieg = f.warum === "kopf" || f.warum === "stolpern" || f.warum === "fels" ? Math.abs(Math.sin(f.dreh)) * 9.5 : 0;
    // Das Spiegelbild: Beim Glas zerspringt es, sonst fällt es mit.
    if (f.warum !== "glas" || f.zeit < 0.06) {
      g.save();
      g.beginPath();
      g.rect(-10, view.wl + 0.3, view.cssW + 20, view.cssH);
      g.clip();
      stil = n > 0.5 ? "glanz" : "spiegel";
      zeichneLaeuferin(sx, untenY(f.A - lieg), s, true, pose, { dreh: f.dreh, kontur: n > 0.5 ? { farbe: "rgba(150, 250, 255, 0.85)", plus: 1.1 } : null });
      stil = "tag";
      g.restore();
    }
    g.save();
    g.beginPath();
    g.rect(-10, -20, view.cssW + 20, view.wl + 19.6);
    g.clip();
    zeichneLaeuferin(sx, obenY(f.A - lieg), s, false, pose, { dreh: f.dreh, kante: true });
    g.restore();
  }

  // Die Gegner als Läuferinnen aus Licht (geist.js).
  function zeichneGeister() {
    if (!gegner || state.phase === "bereit") return;
    const orte = window.LernappGeist?.orte?.(gegner) || [];
    if (!orte.length) return;
    const namen = [];
    orte.forEach((o) => {
      if (o.ziel) return;
      const x = o.a;
      const sx = bildX(x);
      if (sx < -40 || sx > view.cssW + 40) return;
      const y = Math.max(0, o.b / 10);
      const fliegt = (Math.round(o.c || 0) & 1) === 1;
      const p = fliegt ? poseSprung(0.45) : poseLauf((x / 62) % 1);
      const spur = (Math.round(o.c || 0) >> 1) & 1;
      zeichneLaeuferin(sx, obenY(y), view.s, false, p, { geist: o.farbe, alpha: 0.45 * o.blass });
      const dx = x - state.laeuferin.x;
      namen.push({ ...o, sx, sy: obenY(y + TOP + 6), weit: `${dx > 0 ? "+" : ""}${Math.round(dx / METER)} m` });
    });
    window.LernappGeist.namen(g, namen, { breit: view.cssW, hoch: view.cssH });
  }

  // ---------------------------------------------------------------------------
  // Zeichnen: Atem, Teile, Risse, Schrift
  // ---------------------------------------------------------------------------
  function zeichneAtem() {
    const n = nachtK();
    state.atem.forEach((a) => {
      const k = clamp(a.leben / a.max, 0, 1);
      const r = (1 + (1 - k) * 2.4) * view.s / 6;
      const x = bildX(a.x);
      schein("atem", x, obenY(a.y), r, k * 0.55);
      // Im See haucht das Spiegelbild mit.
      schein(n > 0.5 ? "kalt" : "atem", x, untenY(a.y), r, k * (n > 0.5 ? 0.5 : 0.3));
    });
  }

  function zeichneTeile() {
    if (!state.teile.length) return;
    state.teile.forEach((t) => {
      const k = clamp(t.leben / t.max, 0, 1);
      const x = bildX(t.x);
      const y = t.unten ? untenY(t.y) : obenY(t.y);
      if (t.art === "staub") {
        schein("staub", x, y, (t.r * (1.6 - 0.8 * k) * view.s) / 11, k * t.kraft);
      } else if (t.art === "tropfen") {
        g.globalAlpha = k;
        g.fillStyle = t.unten ? "#c8fbff" : "#f4f8ff";
        g.fillRect(x - 0.6, y - 0.6, 1.3, 1.3);
        g.globalAlpha = 1;
      } else if (t.art === "nadel") {
        g.globalAlpha = Math.min(1, k * 2);
        g.strokeStyle = "rgb(214, 150, 80)";
        g.lineWidth = 0.8;
        g.beginPath();
        g.moveTo(x, y);
        g.lineTo(x + Math.cos(t.w) * 1.6 * view.s, y + Math.sin(t.w) * 1.6 * view.s);
        g.stroke();
        g.globalAlpha = 1;
      } else if (t.art === "scherbe") {
        g.globalAlpha = Math.min(1, k * 1.6);
        g.save();
        g.translate(x, y);
        g.rotate(t.w);
        g.fillStyle = "rgba(190, 250, 255, 0.55)";
        g.strokeStyle = "rgba(240, 255, 255, 0.95)";
        g.lineWidth = 0.7;
        g.beginPath();
        g.moveTo(-t.r * view.s, -t.r * 0.4 * view.s);
        g.lineTo(t.r * 0.8 * view.s, -t.r * 0.7 * view.s);
        g.lineTo(t.r * 0.2 * view.s, t.r * 0.9 * view.s);
        g.closePath();
        g.fill();
        g.stroke();
        g.restore();
        g.globalAlpha = 1;
      } else {
        g.globalAlpha = Math.min(1, k * 2);
        g.fillStyle = "rgb(110, 96, 130)";
        g.fillRect(x - t.r * view.s * 0.5, y - t.r * view.s * 0.5, t.r * view.s, t.r * view.s);
        g.globalAlpha = 1;
      }
    });
  }

  // Wenn das Spiegelbild anstösst, zerspringt der See wie Glas: Risse
  // laufen vom Aufprall über das Wasser.
  function risseBauen(cx, cy) {
    const risse = [];
    const W = view.cssW;
    const zahl = 11;
    for (let i = 0; i < zahl; i += 1) {
      const w0 = (i / zahl) * TAU + (Math.random() - 0.5) * 0.4;
      const w = Math.atan2(Math.sin(w0) * 0.55, Math.cos(w0));
      const pts = [[cx, cy]];
      let x = cx;
      let y = cy;
      let r = w;
      const lang = W * (0.35 + Math.random() * 0.65);
      let weit = 0;
      while (weit < lang) {
        const schritt = 7 + Math.random() * 14;
        r += (Math.random() - 0.5) * 0.5;
        x += Math.cos(r) * schritt;
        y += Math.sin(r) * schritt;
        weit += schritt;
        pts.push([x, y]);
        if (Math.random() < 0.18) {
          const ast = [[x, y]];
          let ax = x;
          let ay = y;
          let ar = r + (Math.random() < 0.5 ? -1 : 1) * (0.5 + Math.random() * 0.6);
          for (let j = 0; j < 3 + Math.random() * 4; j += 1) {
            ar += (Math.random() - 0.5) * 0.5;
            ax += Math.cos(ar) * (6 + Math.random() * 10);
            ay += Math.sin(ar) * (6 + Math.random() * 10);
            ast.push([ax, ay]);
          }
          risse.push({ pts: ast, ab: weit / lang });
        }
      }
      risse.push({ pts, ab: 0 });
    }
    // Ringe um den Aufprall, gebrochen.
    const ringe = [6, 13, 22].map((rr) => ({ r: rr + Math.random() * 3, von: Math.random() * TAU }));
    // Die Risse gehören an den Ort in der Welt: Gleitet die Kamera danach,
    // gleiten sie mit (wx, cx: wo der Aufprall war, in der Welt und im Bild).
    return { risse, ringe, cx, cy, wx: state.camX + (cx - view.rx) / view.s };
  }

  function zeichneRisse() {
    const f = state.sturz;
    if (!f || !f.glas) return;
    const k = clamp(f.zeit / 0.45, 0, 1);
    const { risse, ringe, cx, cy } = f.glas;
    g.save();
    g.beginPath();
    g.rect(0, view.wl + 0.5, view.cssW, view.cssH);
    g.clip();
    g.translate(bildX(f.glas.wx) - cx, 0);
    // Der Blitz des Aufpralls.
    if (f.zeit < 0.35) schein("weiss", cx, cy, 3.5, 1 - f.zeit / 0.35);
    g.lineCap = "round";
    g.lineJoin = "round";
    [[3, "rgba(120, 240, 255, 0.22)"], [1, "rgba(245, 255, 255, 0.9)"]].forEach(([b, farbe]) => {
      g.strokeStyle = farbe;
      g.lineWidth = b;
      g.beginPath();
      risse.forEach((r) => {
        const anteil = clamp((k - r.ab) / Math.max(0.05, 1 - r.ab), 0, 1);
        const n = Math.max(2, Math.ceil(r.pts.length * anteil));
        if (anteil <= 0) return;
        r.pts.slice(0, n).forEach(([x, y], i) => { if (i) g.lineTo(x, y); else g.moveTo(x, y); });
      });
      g.stroke();
    });
    g.strokeStyle = "rgba(230, 255, 255, 0.7)";
    g.lineWidth = 0.8;
    ringe.forEach((r) => {
      for (let i = 0; i < 5; i += 1) {
        const a = r.von + i * 1.3;
        g.beginPath();
        g.ellipse(cx, cy, r.r * k, r.r * 0.6 * k, 0, a, a + 0.8);
        g.stroke();
      }
    });
    // Splitter, die das Licht fangen.
    g.globalAlpha = 0.15 + 0.15 * Math.sin(state.zeit * 6);
    g.fillStyle = "#e8ffff";
    risse.forEach((r, i) => {
      if (i % 2) return;
      const [x, y] = r.pts[Math.min(r.pts.length - 1, 2 + (i % 4))];
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + 8, y + 3);
      g.lineTo(x + 3, y + 9);
      g.closePath();
      g.fill();
    });
    g.globalAlpha = 1;
    g.restore();
  }

  function zeichneSchriften(gekippt = false) {
    if (!state.schriften.length) return;
    g.lineJoin = "round";
    g.textAlign = "center";
    g.textBaseline = "middle";
    state.schriften.forEach((t) => {
      const k = clamp(t.leben / t.max, 0, 1);
      const gross = Math.round(clamp(t.gross * view.s * 0.5, 12, 22));
      g.font = `800 ${gross}px system-ui, sans-serif`;
      const x = clamp(bildX(t.x), 40, view.cssW - 40);
      // In der gekippten Welt steht sie (ihr Spiegelbild) oben aufrecht.
      const y = (gekippt ? view.frei + view.cssH - untenY(t.y) : obenY(t.y)) - (1 - k) * 14;
      g.globalAlpha = Math.min(1, k * 2.4);
      g.lineWidth = Math.max(3, gross * 0.22);
      g.strokeStyle = "rgba(24, 16, 40, 0.85)";
      g.strokeText(t.text, x, y);
      g.fillStyle = t.farbe;
      g.fillText(t.text, x, y);
    });
    g.globalAlpha = 1;
  }

  // Die Ansage oben im Bild: was kommt.
  function zeichneAnsage() {
    const an = state.ansage;
    if (!an || an.leben <= 0 || state.phase === "bereit") return;
    const W = view.cssW;
    const k = clamp(an.leben / an.max, 0, 1);
    const sicht = Math.min(1, k * 3) * Math.min(1, (an.max - an.leben) * 6);
    const y = view.frei + 26;
    g.lineJoin = "round";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.globalAlpha = sicht;
    g.font = "900 20px system-ui, sans-serif";
    let breit = g.measureText(an.text).width;
    if (an.unter) {
      g.font = "700 13px system-ui, sans-serif";
      breit = Math.max(breit, g.measureText(an.unter).width);
      g.font = "900 20px system-ui, sans-serif";
    }
    g.fillStyle = "rgba(22, 18, 46, 0.5)";
    g.beginPath();
    g.roundRect(W / 2 - breit / 2 - 16, y - 17, breit + 32, an.unter ? 54 : 34, 17);
    g.fill();
    g.lineWidth = 5;
    g.strokeStyle = "rgba(20, 16, 44, 0.8)";
    g.strokeText(an.text, W / 2, y);
    g.fillStyle = an.farbe;
    g.fillText(an.text, W / 2, y);
    if (an.unter) {
      g.font = "700 13px system-ui, sans-serif";
      g.lineWidth = 4;
      g.strokeText(an.unter, W / 2, y + 21);
      g.fillStyle = "#fff4ee";
      g.fillText(an.unter, W / 2, y + 21);
    }
    g.globalAlpha = 1;
  }

  // Die Szene, aufrecht oder gekippt.
  function szene(gekippt) {
    kippJetzt = gekippt;
    const wackel = ruhig() ? 0 : Math.sin(state.zeit * 60) * 3 * state.stoss;
    if (gekippt) {
      // Über dem gekippten Bild (unter den Knöpfen) die Tiefe der Nacht.
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.fillStyle = rgb(LAND_BILD[landArt(landNr(state.camX))].nacht.stops[5][1]);
      g.fillRect(0, 0, canvas.width, Math.ceil(view.frei * view.dpr) + 2);
    }
    zeichneWelt();
    basis();
    zeichneHimmelsleben();
    zeichneSeeleben();
    basis(view.dpr, Math.round(wackel * view.dpr));
    zeichneTore(true);
    zeichneStege();
    // Hinten der obere Weg einer Gabelung, mit allem, was dort steht.
    zeichneGabeln(true);
    zeichneGabeln(false);
    zeichneHindernisseUnten(1);
    zeichneHindernisseOben(false, 1);
    zeichneHindernisseOben(true, 1);
    // Davor der Weg am Ufer.
    zeichneEtagen(true);
    zeichneEtagen(false);
    zeichneWasserlinie();
    zeichneHindernisseUnten(0);
    zeichneBewegte(true);
    zeichneTore(false);
    zeichneHindernisseOben(false, 0);
    const imNebel = state.nebel.some((nb) => bildX(nb.b) > -10 && bildX(nb.a) < view.cssW + 10);
    if (imNebel) {
      // Im Nebel verdeckt er auch die Äste – die Läuferin bleibt davor.
      zeichneHindernisseOben(true, 0);
      zeichneNebel();
      basis(view.dpr, Math.round(wackel * view.dpr));
    }
    zeichneGeister();
    zeichneAtem();
    zeichneFigur();
    if (!imNebel) zeichneHindernisseOben(true, 0);
    zeichneBewegte(false);
    zeichneTeile();
    zeichneRisse();
    kippJetzt = false;
  }

  // Ein Puffer, so gross wie die Leinwand: In der Drehung des Spiegeltors
  // wird die Szene dort gemalt und gestaucht aufgelegt.
  let puffer = null;
  function pufferHolen() {
    if (!puffer || puffer.width !== canvas.width || puffer.height !== canvas.height) {
      puffer = document.createElement("canvas");
      puffer.width = canvas.width;
      puffer.height = canvas.height;
    }
    return puffer;
  }

  function zeichnen() {
    if (!g || !ebenen) return;
    const kipp = kippBei(state.phase === "bereit" ? 0 : state.t);
    // Wer Bewegung reduziert, dem kippt das Bild ohne Drehung.
    const m = ruhig() ? (kipp.gekippt ? -1 : 1) : kipp.mass;
    if (Math.abs(m) > 0.999) {
      szene(m < 0);
      if (puffer && kipp.k >= 1) puffer = null;
    } else {
      // Mitten in der Drehung um die waagrechte Achse (die Mitte der freien
      // Höhe): die Szene, gestaucht – nach der Hälfte schon gekippt.
      const echt = g;
      const p = pufferHolen();
      g = p.getContext("2d");
      szene(m < 0);
      g = echt;
      const dpr = view.dpr;
      const mitte = Math.round((view.frei + view.cssH) * 0.5 * dpr);
      g.setTransform(1, 0, 0, 1, 0, 0);
      const grund = g.createLinearGradient(0, 0, 0, canvas.height);
      grund.addColorStop(0, "rgb(8, 10, 32)");
      grund.addColorStop(0.5, "rgb(40, 30, 76)");
      grund.addColorStop(1, "rgb(8, 10, 32)");
      g.fillStyle = grund;
      g.fillRect(0, 0, canvas.width, canvas.height);
      // In Streifen: Was beim Drehen auf sie zukommt, wird breiter, was
      // sich entfernt, schmaler – so steht das Bild schräg im Raum.
      const streifenZahl = 64;
      const phase = glatt(kipp.k);
      const neig = Math.sin(Math.PI * phase) * (phase < 0.5 ? 1 : -1);
      for (let i = 0; i < streifenZahl; i += 1) {
        const y0 = (p.height * i) / streifenZahl;
        const y1 = (p.height * (i + 1)) / streifenZahl;
        const u = (y0 + y1) / 2 / p.height - 0.5;
        const breit = canvas.width * (1 + 0.18 * neig * u * 2);
        const ya = mitte + (y0 - mitte) * Math.abs(m);
        const yb = mitte + (y1 - mitte) * Math.abs(m);
        g.drawImage(p, 0, y0, p.width, y1 - y0, (canvas.width - breit) / 2, ya, breit, Math.max(1, yb - ya + 0.5));
      }
      // Ein Licht auf der Achse, am hellsten, wenn das Bild flach steht.
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      const y = mitte / dpr;
      const kraft = 1 - Math.abs(m);
      const band = g.createLinearGradient(0, y - 40, 0, y + 40);
      band.addColorStop(0, "rgba(200, 160, 255, 0)");
      band.addColorStop(0.5, `rgba(230, 220, 255, ${0.8 * kraft})`);
      band.addColorStop(1, "rgba(200, 160, 255, 0)");
      g.fillStyle = band;
      g.fillRect(0, y - 40, view.cssW, 80);
      g.fillStyle = `rgba(255, 255, 255, ${0.9 * kraft})`;
      g.fillRect(0, y - 0.8, view.cssW, 1.6);
    }
    g.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
    zeichneSchriften(kipp.mass < 0);
    zeichneAnsage();
  }

  // Was in einer Landschaft je Bild lebt: am Felsufer die Wasserfälle (die
  // Gischt kräuselt den Spiegel), im Schilf ein Ruderboot auf dem fernen
  // See, dessen Wellen bis ans Ufer laufen und das Spiegelbild kurz
  // kräuseln, am Gletscher treibende Schollen.
  function zeichneLandLeben(A, B, k, teil) {
    if (ruhig()) return;
    basis();
    const W = view.cssW;
    const s = view.s;
    const still = state.phase === "bereit";
    const t = state.zeit;
    const mitte = B ? clamp(((nahtPx ?? 0) / view.dpr) / view.cssW, 0, 1) : 1;
    [[A, B ? mitte : 1], [B, B ? 1 - mitte : 0]].forEach(([S, kraft]) => {
      if (!S || kraft < 0.02) return;
      const LB = LAND_BILD[S.art];
      if (LB.wasserfall && teil === "hang") {
        // Die Fälle sitzen im Hang (er zieht mit PAR.hang vorbei).
        const breitHang = S.hang.width / view.dpr;
        const hangOben = ebenen.hangUnten + ebenen.hangTal - S.hang.height / view.dpr;
        WASSERFAELLE.forEach((u, i) => {
          for (let rund = -1; rund <= 1; rund += 1) {
            const x = ((u * breitHang - state.camX * s * PAR.hang) % breitHang + breitHang) % breitHang + rund * breitHang;
            if (x < -30 || x > W + 30) continue;
            const y0 = hangOben + S.hang.height / view.dpr * 0.45;
            const y1 = ebenen.hangUnten;
            g.strokeStyle = `rgba(255, 255, 255, ${0.55 * kraft})`;
            g.lineWidth = 1;
            g.beginPath();
            for (let j = 0; j < 5; j += 1) {
              const p = ((t * 0.9 + j / 5 + i * 0.3) % 1);
              const y = lerp(y0, y1, p);
              g.moveTo(x + (j - 2) * 0.8, y);
              g.lineTo(x + (j - 2) * 1.1, Math.min(y1, y + 8));
            }
            g.stroke();
            schein("weiss", x, y1, 0.5, 0.35 * kraft * (0.7 + 0.3 * Math.sin(t * 3 + i)));
          }
        });
      }
      if (LB.wasserfall && teil === "see") {
        const breitHang = S.hang.width / view.dpr;
        WASSERFAELLE.forEach((u) => {
          for (let rund = -1; rund <= 1; rund += 1) {
            const x = ((u * breitHang - state.camX * s * PAR.hang) % breitHang + breitHang) % breitHang + rund * breitHang;
            if (x < -60 || x > W + 60) continue;
            // Die Gischt kräuselt den Spiegel darunter.
            g.strokeStyle = `rgba(220, 250, 255, ${0.28 * kraft})`;
            g.beginPath();
            for (let j = 0; j < 6; j += 1) {
              const y = view.wl + 4 + j * 5 + Math.sin(t * 2 + j) * 1.5;
              const b = 14 + j * 6;
              g.moveTo(x - b, y);
              g.quadraticCurveTo(x, y + Math.sin(t * 5 + j * 1.3) * 2, x + b, y);
            }
            g.stroke();
          }
        });
      }
      if (LB.boot && !still && teil === "hang") {
        // Das Ruderboot: Es zieht langsam über den fernen See und kommt
        // nach einer Weile wieder.
        const breitHang = S.hang.width / view.dpr;
        const yBoot = ebenen.hangUnten + ebenen.hangTal - S.hang.height / view.dpr + (S.hang.height / view.dpr - ebenen.hangTal) * 0.9;
        const x = W * 1.1 - ((t * 9 + state.camX * s * PAR.hang) % (breitHang + W * 0.4));
        if (x > -20 && x < W + 20) {
          g.fillStyle = `rgba(70, 44, 40, ${0.9 * kraft})`;
          g.beginPath();
          g.moveTo(x - 5, yBoot - 1);
          g.lineTo(x + 5, yBoot - 1);
          g.lineTo(x + 3.5, yBoot + 1);
          g.lineTo(x - 3.5, yBoot + 1);
          g.closePath();
          g.fill();
          g.fillRect(x - 0.8, yBoot - 4, 1.6, 3);
          const ruder = Math.sin(t * 3);
          g.strokeStyle = `rgba(70, 44, 40, ${0.8 * kraft})`;
          g.lineWidth = 0.8;
          g.beginPath();
          g.moveTo(x, yBoot - 2.5);
          g.lineTo(x + 4 + ruder * 2, yBoot + 1.2);
          g.stroke();
          g.strokeStyle = `rgba(255, 240, 210, ${0.5 * kraft})`;
          g.beginPath();
          for (let j = 1; j < 4; j += 1) {
            g.moveTo(x + 4 + j * 4, yBoot + 0.5 + j * 0.4);
            g.lineTo(x + 7 + j * 7, yBoot + 0.5 + j * 1.1);
          }
          g.stroke();
        }
      }
      if (LB.boot && !still && teil === "see") {
        // Seine Wellen erreichen das Ufer: Alle 7 s kräuselt sich das
        // Spiegelbild unter der Wasserlinie gut eine Sekunde lang.
        const welle = (t % 7) / 7;
        if (welle < 0.2) {
          const kw = Math.sin((welle / 0.2) * Math.PI) * kraft;
          g.strokeStyle = `rgba(255, 236, 210, ${0.35 * kw})`;
          g.lineWidth = 1;
          g.beginPath();
          for (let j = 0; j < 5; j += 1) {
            const y = view.wl + 3 + j * 4.5;
            g.moveTo(0, y);
            for (let xx = 0; xx <= W; xx += 12) g.lineTo(xx, y + Math.sin(xx * 0.08 + t * 6 + j) * 1.6);
          }
          g.stroke();
        }
      }
    });
    basis(1);
  }

  // ---------------------------------------------------------------------------
  // Was aufstiebt
  // ---------------------------------------------------------------------------
  function teile(art, x, y, n, kraft, richtung = 0, unten = false) {
    if (ruhig()) return;
    for (let i = 0; i < n; i += 1) {
      const w = Math.random() * (art === "scherbe" ? TAU : Math.PI);
      const v = (6 + Math.random() * 22) * kraft;
      const leben = art === "staub" ? 0.6 + Math.random() * 0.8 : 0.4 + Math.random() * 0.5;
      state.teile.push({
        art, x, y, unten, vx: Math.cos(w) * v + richtung, vy: Math.sin(w) * v * (art === "staub" ? 0.5 : 1.4), w: Math.random() * TAU,
        r: art === "staub" ? 4 + Math.random() * 5 * kraft : art === "scherbe" ? 1.2 + Math.random() * 2.2 : 0.8 + Math.random() * 1.2, leben, max: leben, kraft: art === "staub" ? 0.5 : 1,
        boden: unten ? 0 : bodenBei(state.laeuferin?.spur || 0, x),
      });
    }
    if (state.teile.length > 180) state.teile.splice(0, state.teile.length - 180);
  }

  function ring(x, weit = 26, leben = 1.1) {
    if (ruhig()) return;
    state.ringe.push({ x, weit, leben, max: leben });
    if (state.ringe.length > 12) state.ringe.shift();
  }

  function schrift(text, farbe, x, y, gross = 30) {
    state.schriften = [{ text, farbe, x, y, gross, leben: 0.8, max: 0.8 }];
  }

  // Eine Ansage oben im Bild. Läuft schon eine, kommt sie danach (hinten:
  // der Name einer Landschaft) oder verdrängt sie (was gleich geschieht,
  // geht vor; das Verdrängte kommt nicht wieder – es wäre dann vorbei).
  function ansage(text, unter, farbe = "#ffffff", dauer = 2.2, hinten = false) {
    const neu = { text, unter, farbe, leben: dauer, max: dauer };
    if (state.ansage && hinten) state.ansagen.push(neu);
    else state.ansage = neu;
  }

  // Was die Aufzeichnung in c trägt: ob sie springt (Bit 0), ob sie auf dem
  // oberen Weg einer Gabelung ist (Bit 1), ob die Welt gekippt ist (Bit 2),
  // darüber die Zahl der Sprünge.
  function codeC() {
    const r = state.laeuferin;
    return (r.sprung !== null ? 1 : 0) + (r.spur === 1 ? 2 : 0) + (kippBei(state.t).gekippt ? 4 : 0) + 8 * state.spruenge;
  }

  // ---------------------------------------------------------------------------
  // Springen, landen, stürzen
  // ---------------------------------------------------------------------------
  function absprung() {
    const r = state.laeuferin;
    if (r.sprung !== null) {
      // In der Luft verfällt der Tipp.
      state.verfallen += 1;
      return;
    }
    abheben(r, state.t);
    state.spruenge += 1;
    klang()?.ton?.("spiegelsee.sprung", { laut: 0.8 });
    klang()?.ton?.("spiegelsee.tauchen", { laut: 0.45, hoehe: 0.8 });
    kids()?.vibrate?.(6);
    teile("staub", r.x - 4, r.A + 0.5, 4, 0.7, -10);
    // Das Spiegelbild taucht: Tropfen an der Wasserlinie, ein Ring.
    teile("tropfen", r.x, -UFER, 5, 1, 20, true);
    ring(r.x + 6, 18, 0.8);
  }

  function landen(t) {
    const r = state.laeuferin;
    state.stauch = 1;
    klang()?.ton?.("spiegelsee.landung", { laut: 0.55 });
    const x = xBei(t);
    const G = bodenBei(r.spur, x);
    teile("staub", x - 4, G + 0.5, 5, 0.9, -14);
    teile("staub", x + 5, G + 0.5, 3, 0.6, 6);
    ring(x, 30, 1.2);
  }

  // Unten von der Abkürzung: Der Steg hat Meter geschenkt.
  function bonusErreicht(gb) {
    const r = state.laeuferin;
    state.bonus += gb.bonus;
    schrift(`+${gb.bonus} m`, "#ffe08a", r.x + 12, r.A + TOP + 10, 40);
    klang()?.ton?.("spiegelsee.bonus", { laut: 0.8 });
    kids()?.vibrate?.(10);
  }

  // Woran sie stürzt: Das Spiegelbild stösst an (der See zerspringt), durch
  // eine Lücke ins Wasser, mit dem Kopf an etwas, an den Felssturz, oder sie
  // stolpert (auch über den Hecht).
  function sturzArt(o) {
    if (o?.welt === "unten") return "glas";
    if (o?.kind === "luecke") return "wasser";
    if (o?.kind === "decke") return "kopf";
    if (o?.art === "fels") return "fels";
    return "stolpern";
  }

  function sturz(o, nurBild = false) {
    if (state.schritt === "sturz") return;
    const r = state.laeuferin;
    state.schritt = "sturz";
    const v = tempoBei(Math.max(0, state.t));
    const warum = sturzArt(o);
    const g = bodenBei(r.spur, r.x);
    state.sturz = {
      warum, art: o?.art || "stein", zeit: 0, x: r.x, A: r.A, g, spur: r.spur,
      vx: warum === "glas" ? v * 0.3 : warum === "kopf" ? -v * 0.1 : warum === "wasser" ? v * 0.35 : warum === "fels" ? -v * 0.22 : v * 0.55,
      vy: warum === "kopf" ? -10 : warum === "stolpern" ? 40 : warum === "fels" ? 26 : 0,
      dreh: 0,
      drehV: warum === "kopf" ? -4.2 : warum === "stolpern" ? 6.5 : warum === "fels" ? -5.2 : 0,
      glas: null,
    };
    state.stoss = 1;
    klangAus();
    if (warum === "glas") {
      // Wo das Spiegelbild anstösst: am Kopf (oben im Wasser) oder an den
      // Füssen (an dem, was von der Wasserlinie hängt).
      const tiefe = o.kind === "decke" ? r.A + TOP - 1 : r.A + 2;
      state.sturz.glas = risseBauen(bildX(r.x + LH), untenY(tiefe));
      klang()?.ton?.("spiegelsee.glas");
      teile("scherbe", r.x + LH, tiefe, 26, 2.6, 0, true);
    } else if (warum === "wasser") {
      if (o?.art === "bruch") {
        // Der Steg der Sackgasse bricht unter ihr ein.
        o.gebrochen = state.zeit;
        klang()?.ton?.("spiegelsee.brechen");
        teile("splitter", r.x + 4, r.A, 16, 1.6, 10);
      }
      klang()?.ton?.("spiegelsee.platsch", { verzoegerung: o?.art === "bruch" ? 0.25 : 0 });
    } else if (warum === "kopf") {
      klang()?.ton?.("spiegelsee.ast");
      teile("nadel", r.x + 3, (o?.g || 0) + DECKE, 14, 1.4, -10);
    } else if (warum === "fels") {
      klang()?.ton?.("spiegelsee.fels");
      teile("staub", r.x + 6, r.A + 8, 14, 1.6, -6);
      teile("stein", r.x + 7, r.A + 10, 10, 1.6, -4);
    } else {
      klang()?.ton?.("spiegelsee.stolpern");
      teile("staub", r.x + 5, r.A + 1, 10, 1.3, 10);
      teile("stein", r.x + 6, r.A + 2, 6, 1.2, 12);
    }
    kids()?.vibrate?.([30, 40, 70]);
    if (nurBild) return;
    stepTimer = window.setTimeout(finish, ruhig() ? 900 : STURZ_MS);
  }

  function sturzTakt(dt) {
    const f = state.sturz;
    if (!f) return;
    f.zeit += dt;
    if (f.warum === "glas") {
      // Sie bremst, sinkt auf die Knie und schaut in den zerbrochenen See.
      f.vx *= 1 - 4 * dt;
      f.x += f.vx * dt;
      f.A = Math.max(f.g, f.A - 60 * dt);
      return;
    }
    if (f.warum === "wasser") {
      // Durch die Lücke ins Wasser – und das Spiegelbild ihr entgegen.
      f.vx *= 1 - 3 * dt;
      f.vy -= 260 * dt;
      f.x += f.vx * dt;
      f.A += f.vy * dt;
      if (f.A < -UFER && !f.platsch) {
        f.platsch = true;
        teile("tropfen", f.x, -UFER + 1, 18, 2.4, 0);
        teile("tropfen", f.x, -UFER + 1, 10, 2, 0, true);
        ring(f.x, 40, 1.6);
        ring(f.x + 4, 24, 1.2);
      }
      if (f.A < -UFER - 30) f.A = -UFER - 30;
      return;
    }
    f.vy -= 260 * dt;
    f.x += f.vx * dt;
    f.A += f.vy * dt;
    f.dreh += f.drehV * dt;
    if (f.A < f.g) {
      f.A = f.g;
      if (Math.abs(f.vy) > 30) teile("staub", f.x, f.g + 0.5, 4, 1, 0);
      f.vy = Math.abs(f.vy) > 30 ? -f.vy * 0.25 : 0;
      f.vx *= 0.5;
      f.drehV *= 0.4;
    }
    if (f.A === f.g) {
      f.vx *= 1 - 5 * dt;
      // Sie bleibt liegen, flach auf dem Weg.
      const ziel = f.warum === "kopf" || f.warum === "fels" ? -1.35 : 1.35;
      f.dreh += (ziel - f.dreh) * Math.min(1, dt * 7);
    }
  }

  function physik(dt) {
    const r = state.laeuferin;
    const n = Math.max(1, Math.ceil(dt / TAKT - 1e-9));
    const h = dt / n;
    for (let i = 0; i < n; i += 1) {
      if (state.schritt === "sturz") return;
      const vor = state.t;
      state.t += h;
      const spurVor = r.spur;
      const gabelVor = r.gabel;
      const tl = bewege(r, state.t, vor);
      if (tl !== null) {
        landen(tl);
        const xl = xBei(tl);
        const o = trifft(xl, bodenBei(r.spur, xl), false, r.spur, tl);
        if (o) { sturz(o); return; }
      }
      if (spurVor === 1 && r.spur === 0 && gabelVor?.bonus) bonusErreicht(gabelVor);
      const o = trifft(r.x, r.A, r.sprung !== null, spurJetzt(r), state.t);
      if (o) {
        sturz(o);
        return;
      }
      const meter = Math.floor(r.x / METER) + state.bonus;
      if (meter !== state.punkte) {
        state.punkte = meter;
        shell.setCount(meter);
      }
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
    if (state.t < 0) return;
    absprung();
  }

  // ---------------------------------------------------------------------------
  // Zuschauen
  // ---------------------------------------------------------------------------
  function zuschauenStarten() {
    if (!zuschauer?.lauf) return;
    startRun();
    state.phase = "zuschauen";
    state.schritt = "lauf";
    state.t = 0;
    shell.setPhase("play");
    zuschauer.los();
    klangAn();
  }

  // Woran ein Lauf zu Ende ging, aus der Stelle, an der er aufhört.
  function warumAm(x, A, spur) {
    const o = trifft(x, A, A > bodenBei(spur, x) + 0.5, spur);
    if (o) return o;
    const liste = state.hindernisse;
    for (let i = abIndex(x - LH - 20); i < liste.length; i += 1) {
      const h = liste[i];
      if (h.a > x + LH + 40) break;
      if (h.b < x - LH - 20 || h.spur !== spur) continue;
      return h;
    }
    for (const m of state.bewegte) {
      const mx = m.kind === "springer" ? springerBei(m, state.t).x : (m.a + m.b) / 2 + m.u * (m.tRef - state.t);
      if (m.spur === spur && Math.abs(mx - x) < 40) return m;
    }
    return { kind: "boden", art: "stein", welt: "oben" };
  }

  // Sie steht, wo die Aufzeichnung sie hat (a: der Weg, b: die Höhe über dem
  // Weg am Ufer in Zehnteln, c: ob sie springt, auf welcher Spur, ob die
  // Welt gekippt ist, und wie viele Sprünge es sind – codeC).
  function zuschauenTakt(dt) {
    const st = zuschauer.stand();
    if (!st) return;
    const r = state.laeuferin;
    if (state.schritt !== "sturz") {
      const x = Math.max(0, st.a);
      state.t = x > 0.5 ? Math.max(state.t, tBei(x)) : state.t + dt * 0.2;
      const c = Math.max(0, Math.round(st.c));
      const fliegt = (c & 1) === 1;
      const spur = (c >> 1) & 1;
      const zahl = c >> 3;
      if (spur === 1 && r.spur !== 1) r.gabel = gabelBei(x) || r.gabel;
      if (spur === 0 && r.spur === 1 && r.gabel?.bonus) {
        schrift(`+${r.gabel.bonus} m`, "#ffe08a", x + 12, r.A + TOP + 10, 40);
        klang()?.ton?.("spiegelsee.bonus", { laut: 0.6 });
      }
      r.spur = spur;
      if (fliegt && r.sprung === null) {
        r.sprung = state.t;
        r.absprung = state.t;
        state.spruenge = zahl;
        klang()?.ton?.("spiegelsee.sprung", { laut: 0.6 });
        teile("tropfen", x, -UFER, 5, 1, 20, true);
        ring(x + 6, 18, 0.8);
      }
      if (!fliegt && r.sprung !== null) {
        r.sprung = null;
        r.landung = state.t;
        state.stauch = 1;
        ring(x, 30, 1.2);
        teile("staub", x - 4, bodenBei(spur, x) + 0.5, 5, 0.9, -14);
      }
      r.x = x;
      const G = bodenBei(spur, x);
      r.A = fliegt ? Math.max(G - 30, st.b / 10) : G;
      r.y = r.A - G;
      const punkte = Math.max(0, Math.floor(st.punkte));
      if (punkte !== state.punkte) {
        state.punkte = punkte;
        shell.setCount(punkte);
      }
      klangStellen();
    }
    if (!zuschauer.weiter() && state.schritt !== "sturz") sturz(warumAm(r.x, r.A, r.spur), true);
    if (state.schritt === "sturz") sturzTakt(dt);
  }

  // ---------------------------------------------------------------------------
  // Der Takt
  // ---------------------------------------------------------------------------
  // Ein neuer Abschnitt: Ein besonderer wird vorher angesagt, das Erwachen
  // auch, und eine neue Landschaft mit ihrem Namen.
  function abschnittPruefen() {
    const nr = abschnittBei(state.t);
    const r = state.laeuferin;
    if (state.erwacheT !== null && !state.angesagt && state.t >= state.erwacheT - 1.35) {
      state.angesagt = true;
      ansage("Der See erwacht", "Unten gelten jetzt eigene Hindernisse", "#aef8ff", 2.6);
    }
    if (state.erwacheT !== null && !state.erwacht && state.t >= state.erwacheT) {
      state.erwacht = true;
      klang()?.ton?.("spiegelsee.erwachen", { laut: 0.9 });
      kids()?.vibrate?.(12);
    }
    // Die nächste Landschaft, kurz bevor sie beginnt.
    const ln = landNr(r.x + 90);
    if (ln > 0 && !state.gemeldet[`land${ln}`]) {
      state.gemeldet[`land${ln}`] = true;
      const L = LANDSCHAFT[landArt(ln)];
      ansage(L.name, `${Math.round(landAnfang(ln) / METER)} m`, L.farbe, 2.4, true);
      klang()?.ton?.("spiegelsee.landschaft", { laut: 0.8 });
    }
    state.abschnitt = nr;
    // Was besonders ist, wird gut zwei Sekunden vorher angesagt (je einmal).
    let naechster = null;
    for (let i = nr; i < Math.min(state.abschnitte.length, nr + 4); i += 1) {
      const a = state.abschnitte[i];
      if (a.art && !state.gemeldet[`a${a.nr}`] && state.t >= a.start - 2.1 && state.t < a.start + 0.6) { naechster = a; break; }
    }
    if (!naechster) return;
    state.gemeldet[`a${naechster.nr}`] = true;
    const art = naechster.art;
    if (art === "nebel") {
      ansage("Nebel zieht auf", "Der See zeigt dir das Ufer", "#ffe6ee", 2.2);
      klang()?.ton?.("spiegelsee.nebel", { laut: 0.7 });
    } else if (art === "steg") {
      ansage("Holzsteg voraus", state.stegZahl > 1 || naechster.nr >= 40 ? "Lücken in den Brettern – unten Hechte" : "Lücken in den Brettern", "#ffd8a8", 2.2);
      klang()?.ton?.("spiegelsee.steg", { laut: 0.7 });
    } else if (art === "gabel") {
      ansage("Gabelung", "Der See zeigt, welcher Weg hält", "#c8f6ff", 2.4);
      klang()?.ton?.("spiegelsee.gabel", { laut: 0.8 });
    } else if (art === "abkuerzung") {
      ansage("Abkürzung", `Oben schwerer – dafür +${BONUS} m`, "#ffe08a", 2.4);
      klang()?.ton?.("spiegelsee.gabel", { laut: 0.8 });
    } else if (art === "tor") {
      ansage("Spiegeltor", naechster.nummer % 2 ? "Die Welten tauschen zurück" : "Die Welten tauschen", "#e6c8ff", 2.4);
      klang()?.ton?.("spiegelsee.tor", { laut: 0.8 });
    } else if (art === "etage" && naechster.etage?.erste) {
      ansage("Ein Steg – eine Etage höher", "Dein Spiegelbild taucht tiefer", "#ffd8a8", 2.2);
    } else if (art === "hecht") {
      ansage("Ein Hecht springt", "Spring über ihn, wenn er auftaucht", "#c8f6ff", 2.2);
    }
  }

  // Was die Welt tut, ob sie springt oder nicht: Durch ein Spiegeltor
  // kippt das Bild, der Hecht schiesst aus dem Wasser und taucht wieder
  // ein, Vögel kommen heran. Je einmal, mit Klang.
  function ereignisse() {
    const t = state.t;
    const gm = state.gemeldet;
    state.tore.forEach((tor) => {
      if (t < tor.t || gm[`kipp${tor.nummer}`]) return;
      gm[`kipp${tor.nummer}`] = true;
      klang()?.ton?.("spiegelsee.kippen", { laut: 0.9 });
      kids()?.vibrate?.([10, 30, 10]);
      ring(tor.x, 60, 1.6);
    });
    // Was längst vorbei ist, muss nicht mehr mitgerechnet werden.
    if (state.bewegte.length > 16) state.bewegte = state.bewegte.filter((o) => (o.tm ?? o.tRef) > t - 6);
    state.bewegte.forEach((o) => {
      const schluessel = `b${o.nr}_${(o.tm ?? o.tRef).toFixed(3)}`;
      if (o.kind === "springer") {
        if (t >= o.tm - 0.45 && t < o.tm && !gm[`${schluessel}a`]) {
          gm[`${schluessel}a`] = true;
          const p = springerBei(o, t);
          klang()?.ton?.("spiegelsee.hecht", { laut: 0.8 });
          teile("tropfen", p.x, -UFER + 0.5, 10, 1.6, -20);
          teile("tropfen", p.x, -UFER + 0.5, 6, 1.4, -20, true);
          ring(p.x, 26, 1.1);
        }
        if (t >= o.tm + 0.45 && t < o.tm + 1 && !gm[`${schluessel}b`]) {
          gm[`${schluessel}b`] = true;
          const p = springerBei(o, t);
          klang()?.ton?.("spiegelsee.tauchen", { laut: 0.6 });
          teile("tropfen", p.x, -UFER + 0.5, 8, 1.3, -10);
          ring(p.x, 30, 1.2);
        }
      } else if (o.art === "voegel" && !gm[schluessel]) {
        const d = o.u * (o.tRef - t);
        if (o.a + d < state.laeuferin.x + SICHT * 0.7) {
          gm[schluessel] = true;
          klang()?.ton?.("spiegelsee.voegel", { laut: 0.7 });
        }
      }
    });
  }

  function takt(dt, strecke = dt) {
    state.zeit += dt;
    const r = state.laeuferin;
    if (state.stoss > 0) state.stoss = Math.max(0, state.stoss - dt * 3);
    if (state.stauch > 0) state.stauch = Math.max(0, state.stauch - dt * 7);
    if (state.ansage) { state.ansage.leben -= dt; if (state.ansage.leben <= 0) state.ansage = null; }
    if (!state.ansage && state.ansagen.length) state.ansage = state.ansagen.shift();
    if (state.intro) {
      state.intro.t += dt;
      if (state.intro.t >= state.intro.dauer) {
        state.intro = null;
        host.dataset.intro = "aus";
        if (ebenen) { ebenen.himmelBlau = null; ebenen.spiegelBlau = null; }
      }
    }

    if (state.phase === "zuschauen") {
      zuschauenTakt(dt);
      abschnittPruefen();
      ereignisse();
    } else if (state.schritt === "sturz") {
      sturzTakt(dt);
    } else if (state.phase === "spiel") {
      if (strecke > 0) physik(strecke);
      if (state.schritt !== "sturz") abschnittPruefen();
      ereignisse();
      klangStellen();
    }

    // Die Schritte: je schneller, desto rascher.
    if (state.schritt === "lauf" && r.sprung === null) state.lauf = (state.lauf + dt * (1.45 + tempoBei(state.t) / 140)) % 1;
    // Der Atem in der kalten Luft.
    state.atemUhr -= dt;
    if (state.atemUhr <= 0 && state.schritt !== "sturz" && !ruhig()) {
      state.atemUhr = state.schritt === "start" ? 1.5 : 0.62;
      state.atem.push({ x: r.x + (state.schritt === "start" ? 3 : 4.2), y: r.A + 20, leben: 0.9, max: 0.9 });
      if (state.atem.length > 8) state.atem.shift();
    }
    for (let i = state.atem.length - 1; i >= 0; i -= 1) {
      const a = state.atem[i];
      a.leben -= dt;
      a.x += 6 * dt;
      a.y += 3 * dt;
      if (a.leben <= 0) state.atem.splice(i, 1);
    }
    for (let i = state.ringe.length - 1; i >= 0; i -= 1) {
      state.ringe[i].leben -= dt;
      if (state.ringe[i].leben <= 0) state.ringe.splice(i, 1);
    }
    for (let i = state.teile.length - 1; i >= 0; i -= 1) {
      const t = state.teile[i];
      if (t.art === "staub") {
        t.vx *= 1 - 1.6 * dt;
        t.vy = t.vy * (1 - 1.2 * dt) + 3 * dt;
      } else if (t.art === "scherbe") {
        // Scherben sinken in die Tiefe (unten zählt y nach unten).
        t.vy += 40 * dt;
        t.vx *= 1 - 0.8 * dt;
        t.w += dt * 4;
      } else {
        t.vy -= 160 * dt;
        t.vx *= 1 - 1.2 * dt;
        t.w += dt * 6;
      }
      t.x += t.vx * dt;
      t.y += t.vy * dt;
      if (t.art !== "staub" && t.art !== "scherbe" && t.y < (t.art === "tropfen" || t.art === "splitter" ? -UFER : t.boden)) { t.leben = Math.min(t.leben, 0.05); }
      t.leben -= dt;
      if (t.leben <= 0) state.teile.splice(i, 1);
    }
    for (let i = state.schriften.length - 1; i >= 0; i -= 1) {
      state.schriften[i].leben -= dt;
      if (state.schriften[i].leben <= 0) state.schriften.splice(i, 1);
    }

    // Die Kamera bleibt bei ihr; beim Sturz gleitet sie ein Stück zurück.
    if (state.schritt !== "sturz") state.camX = r.x;
    else if (state.sturz) {
      const ziel = state.sturz.x - Math.max(0, view.cssW * 0.36 - view.rx) / view.s;
      state.camX += (ziel - state.camX) * (1 - Math.exp(-dt * 3.2));
    }
    planBis(state.t + 9, 1);

    if (state.phase === "spiel" && state.schritt !== "sturz") {
      gegner?.takt(state.punkte, { a: Math.round(r.x), b: Math.round(r.A * 10), c: codeC() });
    }
  }

  let vorratSchluessel = "";
  function loop(now) {
    frame = window.requestAnimationFrame(loop);
    const beginn = performance.now();
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const strecke = Math.max(0, dt - voraus);
    voraus = 0;
    messen();
    takt(dt, strecke);
    zeichnen();
    // Die nächste Landschaft malen, Ebene um Ebene – wenn das Bild Zeit hat.
    const schluessel = `${landLinks()}|${landRechts()}|${state.tore.length > 0}`;
    if (schluessel !== vorratSchluessel) { vorratSchluessel = schluessel; vorratPlanen(); }
    malenWeiter(beginn + 9);
  }

  // Die Runde beginnt: mit dem ersten Tipp – oder im Live-Modus zum
  // gemeinsamen Start.
  function losGehts() {
    if (state.phase !== "bereit") return;
    state.phase = "spiel";
    state.schritt = "lauf";
    state.t = 0;
    if (state.intro) state.intro.t = Math.max(state.intro.t, state.intro.dauer - 0.4);
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
    state.t = 0;
    state.laeuferin = laeuferNeu();
    state.spruenge = 0;
    state.verfallen = 0;
    state.bonus = 0;
    state.ansagen = [];
    state.gemeldet = {};
    state.sturz = null;
    state.teile = [];
    state.ringe = [];
    state.atem = [];
    state.schriften = [];
    state.ansage = null;
    state.zeit = 0;
    state.stoss = 0;
    state.stauch = 0;
    state.lauf = 0;
    state.atemUhr = 0.4;
    state.camX = 0;
    state.erwacht = false;
    state.angesagt = false;
    streckeNeu();
    voraus = 0;
    shell.setCount(0);
    gegner?.runde();

    // Beim ersten Start glühen die Gipfel erst auf.
    state.intro = ersterStart && !zuschauer && !shell.live && !ruhig() ? { t: 0, dauer: 2.8 } : null;
    ersterStart = false;
    host.dataset.intro = state.intro ? "an" : "aus";

    shell.clear();
    const prompt = shell.el("p", "cm-prompt sg-prompt", "Tippen – du und dein Spiegelbild springen zugleich.");
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

  const WARUM = {
    stein: "Über einen Stein gestolpert",
    stamm: "Über einen Baumstamm gestolpert",
    ast: "Mit dem Kopf an einen Ast",
    dach: "Am Felsdach angestossen",
    luecke: "Durch den Steg ins Wasser",
    kristall: "Das Spiegelbild traf einen Eiskristall",
    schilf: "Das Spiegelbild blieb im Schilf hängen",
    wurzel: "Das Spiegelbild traf eine Wurzel",
    hecht: "Das Spiegelbild stiess an einen Hecht",
    qualle: "Das Spiegelbild stiess an eine Qualle",
    treibholz: "Das Spiegelbild stiess an Treibholz",
  };

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
    shell.showResult({
      label: "Deine Meter",
      points: punkte,
      detail: rekord ? "Neuer Rekord!" : `${warum ? `${warum} · ` : ""}${zeit}`,
      geist,
    });
    if (rekord) host.querySelector(".cm-result-detail")?.classList.add("sg-rekord");
    zaehleHoch(punkte);
  }

  // ---------------------------------------------------------------------------
  // Start
  // ---------------------------------------------------------------------------
  shell = shellApi.mount({
    host,
    title: "Spiegelsee",
    area: "geschwindigkeit",
    accent: "#F5A623",
    accentDark: "#b9741a",
    clock: false,
    onRestart: () => (zuschauer ? zuschauenStarten() : startRun()),
    live: { los: losGehts, stopp: () => finish(), zuschauen: (quelle) => { zuschauer = quelle; zuschauenStarten(); } },
  });
  zuschauer = window.LernappGeist?.zuschauer?.({
    host, spiel: "mirrorLake", fassung: "t2", zufall, einheit: "m", nochmal: zuschauenStarten,
  }) || null;
  if (!zuschauer) {
    gegner = window.LernappGeist?.fuer?.({ spiel: "mirrorLake", host, art: "tempo", fassung: "t2", alle: true, zufall }) || null;
  }

  startRun();
  zuschauer?.laden.then((da) => { if (da) zuschauenStarten(); });

  // Ein Tipp irgendwo aufs Bild: Sie springt. Nur Knöpfe bleiben Knöpfe.
  host.addEventListener("pointerdown", (event) => {
    if (event.target.closest("button, a, input")) return;
    const t = Math.abs(performance.now() - event.timeStamp) < 250 ? event.timeStamp : performance.now();
    tippen(t);
  });

  const TASTEN = new Set([" ", "Enter", "ArrowUp"]);
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
  window.LernappSpiegelsee = {
    METER, LH, TOP, UFER, DECKE, SPRUNG, HOCH, RAND, E_MIN, FASSUNG, ETAGE, RAMPE, DREH, BONUS, LAND_AB, LAND_LANG, state, view,
    takt, tippen, losGehts, physik, planBis, kursText, trifft, xBei, tBei, tempoBei, bogenY, luftBei, schwere, folgeHaelt, abschnittBei, nachtK,
    bodenBei, gabelBei, gabelFenster, kippBei, nebelBei, wegMit, landNr, landArt, springerBei, codeC, LEHRPFAD, malLog, satzTeile, kippTeile,
    get ebenen() { return ebenen; },
    // Eine feste Saat für die folgenden Runden (Bilder, Prüfung).
    halteSaat: (saat) => zufall.halte?.(saat),
  };
})();
