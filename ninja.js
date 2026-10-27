/*
 * ninja.js – Zeitlupen-Ninja.
 * ---------------------------------------------------------------------------
 * Ein nächtlicher Dojo-Hof, von oben gesehen, Raum über Raum. Unten steht der
 * Ninja, oben ist das Tor in den nächsten Raum. Dazwischen: Bogenschützen auf
 * den Mauern, Wurfsterne, Klingen an Pfosten, Wächter mit Laternen und
 * Fallen im Boden. Und die Zeit läuft nur, wenn der Ninja läuft: Die Welt
 * rückt genau so weit vor, wie er sich bewegt – steht er still, kriecht sie
 * mit R_MIN weiter (fast stehend, nie ganz, sonst endete die Runde nie). Wer
 * mit voller Geschwindigkeit läuft, sieht die Welt in normalem Tempo.
 *
 * Gesteuert wird mit Finger oder Maus über ein Steuerfeld am unteren Rand
 * (pad) – wie ein Joystick: Wo man es hält, dorthin läuft der Ninja, am Rand
 * mit voller Geschwindigkeit, nahe der Mitte langsam; das Feld steht dezent
 * im Bild, mit Pfeilen. Es liegt unter dem Hof (hochkant reserviert es dafür
 * einen Streifen) – oder, wo daneben Platz ist (quer), unten rechts im
 * Garten. Am Rechner gehen auch die Pfeiltasten und WASD (immer mit voller
 * Geschwindigkeit).
 *
 * Punkte: jeder Raum PUNKTE_RAUM, jede Schriftrolle PUNKTE_ROLLE (im Bild
 * «+3 Punkte»), und wer einen Raum in wenig echter Zeit schafft, bekommt den
 * Tempo-Bonus dazu (TEMPO_STUFEN), oben links gross mit seiner ablaufenden
 * Zeit: Die echte Zeit misst, wie entschlossen man war – stehen bleiben darf
 * man, solange man will, es kostet keine Punkte, nur diesen Bonus. Ein
 * Treffer beendet die Runde.
 * Damit niemand ewig in einer Ecke wartet, werden die Wachen nach LUNTE
 * Sekunden Weltzeit in einem Raum unruhig (Pfeilhagel), und nach DECKEL ist
 * man gefangen.
 *
 * Schwerer wird es von Raum zu Raum: mehr Bahnen mit Pfeilen, schnellere und
 * dichtere Salven, Schützen, die vorhalten, Klingen, Fallenreihen, Wächter
 * mit Lichtkegeln (wer hineingerät, löst einen Pfeilhagel aus), Wurfsterne,
 * die einen verfolgen, Mauerstücke, die den Weg eng machen. Neues kommt in
 * einem festen Raum zum ersten Mal (ARTEN, ab), dann gemischt. Jeder Raum
 * wird aus dem Zufall (zufall.js) gewürfelt: Er zieht genau eine Zahl und
 * baut daraus mit einer eigenen Folge alles Weitere – im Turnier bekommen
 * alle dieselben Räume. Die Prüfung (check-spiele.mjs, 4g23) lässt einen
 * Autopiloten, der die Zukunft kennt, viele Räume weit durch gewürfelte Welten
 * laufen: Jeder Raum ist schaffbar.
 *
 * Gerechnet wird in festen Schritten von TAKT (echte Zeit); jeder Schritt
 * schiebt die Welt um so viel Weltzeit weiter, wie der Ninja darin gelaufen
 * ist. Alles, was nur von der Zeit abhängt (Salven, Klingen, Fallen, Kegel
 * der Wächter), ist eine Rechnung in der Zeit des Raums (tau, beginnt beim
 * Betreten bei null); was zielt, fliegt als eigenes Ding. Beim Gang durchs
 * Tor steht die Weltzeit still.
 *
 * Welteinheiten: x von -HALB bis HALB, y zählt nach oben. Raum k beginnt bei
 * y = k · SCHRITT (Innenkante der unteren Mauer) und ist RAUM_H hoch.
 *
 * Die Gegner (geist.js) laufen als halb durchsichtige Ninjas mit (a = x,
 * b = y, c = Weltzeit in Hundertstelsekunden). Beim Zuschauen (?zuschauen=)
 * entstehen mit der Saat dieselben Räume, der Ninja steht Bild für Bild, wo
 * er war, und aus c läuft die Welt so, dass Pfeile und Klingen genau dort
 * stehen, wo sie damals waren.
 */
(() => {
  "use strict";

  if (document.body.dataset.page !== "ninja") return;

  const host = document.querySelector("#nj-stage");
  const shellApi = window.LernappGameShell;
  const cloudApi = window.LernappGameCloud;
  if (!host || !shellApi) return;

  const kids = () => window.LernappKids || null;
  const ruhig = () => Boolean(kids()?.prefersReducedMotion?.());

  // Der Zufall. Ohne Turnier jedes Mal andere Räume, im Turnier für alle im
  // selben Versuch dieselben. Nur die Räume ziehen daraus – Funken, Rauch
  // und Blüten würfeln Math.random oder hängen an festen Zahlen.
  const zufall = window.LernappZufall?.fuer?.("timeNinja") || {
    neu() {},
    zahl: () => Math.random(),
  };

  // ---------------------------------------------------------------------------
  // Die Welt
  // ---------------------------------------------------------------------------
  const HALB = 120;                // der Hof: x von -120 bis 120
  const RAUM_H = 250;              // vom unteren Tor bis zum oberen
  const WAND = 16;                 // so dick sind die Mauern
  const SCHRITT = RAUM_H + WAND;   // so weit liegt ein Raum über dem vorigen
  const TOR = 46;                  // so breit ist ein Tor
  const SICHT_B = 2 * (HALB + WAND) + 12;   // so breit steht immer alles im Bild
  const SICHT_H = RAUM_H + 2 * WAND + 10;   // und so hoch
  const TAKT = 1 / 240;            // ein Rechenschritt (echte Zeit)

  const V_MAX = 120;               // so schnell läuft der Ninja höchstens (je s)
  const R_MIN = 0.07;              // so schnell läuft die Welt, wenn er steht
  const R_NINJA = 7;               // so breit ist er an Mauern und Säulen
  const R_TREFF = 5.5;             // und für Pfeile, Sterne, Klingen: ein wenig schmaler, als er aussieht
  // Das Steuerfeld (Bildpunkte): so gross, so weit vom Rand. Nahe der Mitte
  // steht er (PAD_TOT), ab PAD_VOLL (Anteil bis zum Rand) läuft er voll.
  const PAD_MIN = 104;
  const PAD_MAX = 156;
  const PAD_RAND = 14;
  const PAD_TOT = 0.16;
  const PAD_VOLL = 0.72;
  const WECHSEL = 0.55;            // so lange (echt) dauert der Gang durchs Tor
  const KAMERA = 0.85;             // und der Schwenk in den nächsten Raum
  const AUS_DAUER = 1.7;           // so lange (echt) nach dem Treffer, bis die Tafel kommt
  const AUS_TEMPO = 0.05;          // so langsam läuft die Welt dann noch

  const PFEIL_L = 16;              // so lang ist ein Pfeil
  const FIGUR = 1.3;               // so gross stehen Schützen und Wächter im Bild (nur Bild)
  const NINJA_BILD = 1.22;         // und der Ninja – getroffen wird er nur in R_TREFF
  const SALVE_ABSTAND = 0.2;       // so dicht folgen die Pfeile einer Salve aufeinander
  const HAGEL_V = 205;             // so schnell fliegt der Pfeilhagel
  const LUNTE = 12;                // nach so viel Weltzeit in einem Raum: Pfeilhagel
  const LUNTE_TAKT = 1.3;          // und dann immer wieder
  const DECKEL = 24;               // und hier ist Schluss

  const PUNKTE_RAUM = 10;
  const PUNKTE_ROLLE = 3;
  // Wer einen Raum in so viel echter Zeit schafft, bekommt so viel dazu –
  // blitzschnell doppelt so viel wie für den Raum selbst. Bis Oktober 2026
  // waren es 5, 3 und 1: zu wenig, als dass sich Durchlaufen lohnte.
  const TEMPO_STUFEN = [[4, 10, "Blitzschnell"], [7, 6, "Entschlossen"], [12, 3, "Ruhig"]];
  // Die Stufe gerade – und ihre Farbe (Gold, Hellblau, Sand).
  const tempoStufe = (echt) => TEMPO_STUFEN.findIndex(([bis]) => echt <= bis);
  const TEMPO_FARBEN = ["#ffd23f", "#bfe3ff", "#e6dcc6"];

  // Was es in einem Raum geben kann, ab welchem Raum, was es kostet (das
  // Budget wächst mit jedem Raum) und wie oft höchstens.
  const ARTEN = [
    { art: "salve", ab: 0, kosten: 1, max: (k) => Math.min(4, 2 + Math.floor(k / 6)), gewicht: 3 },
    { art: "pfeil", ab: 1, kosten: 1.2, max: (k) => Math.min(4, 1 + Math.floor(k / 4)), gewicht: 2.4 },
    { art: "klinge", ab: 1, kosten: 1.1, max: (k) => Math.min(3, 1 + Math.floor(k / 7)), gewicht: 2 },
    { art: "falle", ab: 2, kosten: 1.2, max: (k) => Math.min(3, 1 + Math.floor(k / 8)), gewicht: 1.8 },
    { art: "wache", ab: 3, kosten: 1.4, max: (k) => Math.min(2, 1 + Math.floor(k / 10)), gewicht: 1.4 },
    { art: "stern", ab: 4, kosten: 1.3, max: (k) => Math.min(3, 1 + Math.floor(k / 7)), gewicht: 1.4 },
    { art: "jaeger", ab: 6, kosten: 1.9, max: (k) => Math.min(2, 1 + Math.floor(k / 10)), gewicht: 1.2 },
  ];
  const BUDGET = (k) => Math.min(14, 1.6 + 0.65 * k);
  // Wie viel vom Schweren schon da ist: 0 im ersten Raum, gegen 1 später.
  const SCHWERE = (k) => 1 - Math.exp(-k / 12);

  const TOP_COUNT = 5;
  const store = cloudApi
    ? cloudApi.register({ key: "lernapp.ninja", empty: { runs: 0, scores: [] }, merge: cloudApi.mergeScores(TOP_COUNT) })
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
  const weich = (t) => t * t * (3 - 2 * t);
  const PI2 = Math.PI * 2;

  // Immer dieselbe Zahl zu derselben Eingabe: Steine, Planken und Bäume
  // stehen bei jedem Bild am selben Platz, ohne den Zufall anzufassen.
  function hash01(n) {
    const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return x - Math.floor(x);
  }

  // Die eigene Zahlenfolge eines Raums (mulberry32): Jeder Raum zieht genau
  // eine Zahl aus dem Zufall und würfelt mit ihr alles Weitere.
  function folge(saat) {
    let a = saat >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function abstandStrecke(px, py, ax, ay, bx, by) {
    const dx = bx - ax;
    const dy = by - ay;
    const l2 = dx * dx + dy * dy || 1e-9;
    const u = clamp(((px - ax) * dx + (py - ay) * dy) / l2, 0, 1);
    return Math.hypot(px - ax - dx * u, py - ay - dy * u);
  }

  function abstandRechteck(px, py, q) {
    const dx = Math.max(q[0] - px, 0, px - q[2]);
    const dy = Math.max(q[1] - py, 0, py - q[3]);
    return Math.hypot(dx, dy);
  }

  function winkelDiff(a, b) {
    let d = (a - b) % PI2;
    if (d > Math.PI) d -= PI2;
    if (d < -Math.PI) d += PI2;
    return d;
  }

  // Wie weit ein Strahl von (ox, oy) in Richtung (dx, dy) bis zu einem Kreis
  // oder einem Rechteck kommt – oder Infinity.
  function strahlKreis(ox, oy, dx, dy, c) {
    const fx = ox - c.x;
    const fy = oy - c.y;
    const b = fx * dx + fy * dy;
    const q = fx * fx + fy * fy - c.r * c.r;
    if (q < 0) return 0;
    const d = b * b - q;
    if (d < 0 || b > 0) return Infinity;
    return -b - Math.sqrt(d);
  }

  function strahlRechteck(ox, oy, dx, dy, q) {
    let t0 = -Infinity;
    let t1 = Infinity;
    if (Math.abs(dx) < 1e-9) {
      if (ox < q[0] || ox > q[2]) return Infinity;
    } else {
      const a = (q[0] - ox) / dx;
      const b = (q[2] - ox) / dx;
      t0 = Math.max(t0, Math.min(a, b));
      t1 = Math.min(t1, Math.max(a, b));
    }
    if (Math.abs(dy) < 1e-9) {
      if (oy < q[1] || oy > q[3]) return Infinity;
    } else {
      const a = (q[1] - oy) / dy;
      const b = (q[3] - oy) / dy;
      t0 = Math.max(t0, Math.min(a, b));
      t1 = Math.min(t1, Math.max(a, b));
    }
    if (t1 < Math.max(0, t0)) return Infinity;
    return Math.max(0, t0);
  }

  // ---------------------------------------------------------------------------
  // Zustand
  // ---------------------------------------------------------------------------
  // phase:   "bereit" (noch nichts gezogen), "spiel", "zuschauen", "ende"
  // schritt: "lauf", "wechsel" (durchs Tor), "aus" (getroffen)
  const state = {
    phase: "bereit",
    schritt: "lauf",
    punkte: 0,
    geschafft: 0,         // so viele Räume
    rollenZahl: 0,
    tempoBonus: 0,
    raeume: [],           // die gewürfelten Räume
    raum: 0,              // in diesem steht er
    W: 0,                 // die Weltzeit seit dem Start
    tau: 0,               // die Zeit des Raums
    rate: R_MIN,          // so schnell lief die Welt im letzten Schritt
    echtRaum: 0,          // so viel echte Zeit im Raum
    ninja: { x: 0, y: 14, wvx: 0, wvy: 0, blick: Math.PI / 2, blickZiel: Math.PI / 2, lauf: 0, schwung: 0 },
    steuer: null,         // Richtung von aussen (Prüfung): { x, y }, Länge bis 1
    plan: [],             // oder Schritt für Schritt (Vorführung)
    planI: 0,
    pfeile: [],           // was gezielt fliegt: Pfeile und Hagel
    sterne: [],
    wachen: [],           // je Wächter: Alarm, Hagel, Ruhe
    rollen: [],           // je Rolle: eingesammelt?
    lunte: LUNTE,
    wechsel: null,
    grund: "",
    sim: false,           // beim Vorausrechnen: keine Effekte
    akku: 0,
    // Für das Bild
    zeit: 0,
    echt: 0,
    weltFrame: 0,
    tempo: R_MIN,         // geglättet, für die Farben
    ausEcht: 0,
    aus: null,
    tuerZu: -9,
    teile: [],
    schriften: [],
    nachbilder: [],
    nachbildUhr: 0,
    blaetter: [],
    stecken: [],
    stoss: 0,
    blitz: 0,
    zs: null,             // beim Zuschauen
  };

  let shell = null;
  let feld = null;
  let canvas = null;
  let g = null;
  let frame = null;
  let last = 0;
  let gegner = null;
  let zuschauer = null;
  let promptKnoten = null;

  const view = { s: 1, dpr: 1, cssW: 0, cssH: 0, frei: 0, mx: 0, my: 0, xb: 160, versatz: 0 };
  const kam = { y: RAUM_H / 2, von: RAUM_H / 2, nach: RAUM_H / 2, t: 1 };
  const tasten = { links: false, rechts: false, hoch: false, runter: false };
  // Das Steuerfeld (messen setzt, wo es steht): welcher Finger es hält (id),
  // wohin (richtung, Länge bis 1 = volles Tempo) und wo der Knopf steht.
  // hinweis: wann jemand daneben getippt hat – dann winkt es kurz.
  const pad = { x: 0, y: 0, halb: 60, seitlich: false, id: null, knopfX: 0, knopfY: 0, richtung: { x: 0, y: 0 }, hinweis: -9 };

  function stopLoop() {
    if (frame) { window.cancelAnimationFrame(frame); frame = null; }
  }

  // ---------------------------------------------------------------------------
  // Klänge (klang.js)
  // ---------------------------------------------------------------------------
  // Beim Zuschauen klingt es wie gespielt, beim Vorausrechnen (sim) nie.
  // Jeder Klang hat eine Mindestpause in echter Zeit.
  const klang = () => window.ArcadeKlang || null;
  const zuletzt = new Map();
  function ton(id, o = {}, pause = 80) {
    if (state.sim) return;
    const ms = performance.now();
    if (ms - (zuletzt.get(id) ?? -1e9) < pause) return;
    zuletzt.set(id, ms);
    klang()?.ton?.(id, o);
  }

  // Eine Kulisse, die mit der Runde läuft: an() jedes Bild – weitergegeben
  // höchstens alle 50 ms –, aus() am Ende. Hat die Tafel oder der Neustart
  // sie gestoppt, holt an() sie neu (ohne Ton nur alle zwei Sekunden).
  function schleife(id) {
    let k = null;
    let ms = -1e9;
    let neu = -1e9;
    return {
      an(wert, laut = 1) {
        const jetzt = performance.now();
        if (jetzt - ms < 50) return;
        ms = jetzt;
        if (!k || (!k.laeuft && jetzt - neu > 2000)) { k = klang()?.kulisse?.(id) || null; neu = jetzt; }
        k?.setze(wert);
        k?.laut(laut);
      },
      aus() { k?.stop(); k = null; ms = -1e9; },
    };
  }

  // Der Herzschlag: so schnell, wie die Welt gerade läuft – steht der Ninja,
  // schlägt es langsam und tief.
  const herz = schleife("ninja.zeit");
  function klangTakt() {
    const an = !state.sim && ((state.phase === "spiel" && state.schritt !== "aus")
      || (state.phase === "zuschauen" && !state.zs?.ende && !zuschauer?.fertig?.()));
    if (an) herz.an(clamp(state.tempo, 0, 1));
    else herz.aus();
  }

  // Ein Geschoss, das nah am Ninja vorbeizischt – einmal je Pfeil oder
  // Stern, tiefer, je langsamer die Welt läuft. Was weiter weg fliegt,
  // bleibt still.
  const NAH = 36;                  // so nah zischt ein Geschoss hörbar vorbei (R_NINJA 7)
  function zisch(d) {
    ton("ninja.pfeil", { laut: 0.5 + 0.5 * clamp(1 - d / NAH, 0, 1), hoehe: 0.7 + 0.3 * clamp(state.rate, 0, 1) }, 150);
  }
  function zischPruefen(lx, ly) {
    if (state.sim || state.schritt !== "lauf" || (state.phase !== "spiel" && state.phase !== "zuschauen")) return;
    for (const p of state.pfeile) {
      if (p.zischt || p.weg < 0) continue;
      // Wo der Pfeil dem Ninja am nächsten kommt, und wie nah.
      const t = (lx - p.ox) * p.dx + (ly - p.oy) * p.dy;
      const d = Math.abs((lx - p.ox) * p.dy - (ly - p.oy) * p.dx);
      if (d < NAH && t <= p.L && p.weg >= t - 14 && p.weg <= t + PFEIL_L) {
        p.zischt = true;
        zisch(d);
      }
    }
    for (const st of state.sterne) {
      if (st.zischt) continue;
      const d = Math.hypot(lx - st.x, ly - st.y);
      if (d < NAH) {
        st.zischt = true;
        zisch(d);
      }
    }
  }

  // Ein Raum in Blitzschnell, mehrere in Folge: zuerst die Harfe, dann die
  // Leiter, Stufe um Stufe.
  let blitzFolge = 0;

  // ---------------------------------------------------------------------------
  // Die Räume
  // ---------------------------------------------------------------------------
  const aktRaum = () => state.raeume[state.raum];

  function raumBis(k) {
    while (state.raeume.length <= k) state.raeume.push(neuerRaum(state.raeume.length));
  }

  // Die Mauern eines Raums als Rechtecke [x0, y0, x1, y1] in seinen
  // Koordinaten: unten zu (das Tor hinter ihm hat sich geschlossen), links,
  // rechts, oben mit dem Tor.
  function baueMauern(r) {
    const a = r.torO - TOR / 2;
    const b = r.torO + TOR / 2;
    r.mauern = [
      [-HALB - WAND, -WAND, HALB + WAND, 0],
      [-HALB - WAND, -WAND, -HALB, RAUM_H + WAND],
      [HALB, -WAND, HALB + WAND, RAUM_H + WAND],
      [-HALB - WAND, RAUM_H, a, RAUM_H + WAND],
      [b, RAUM_H, HALB + WAND, RAUM_H + WAND],
    ];
  }

  // Wie weit (x, y) im Hof vom nächsten festen Ding entfernt ist.
  function abstandFest(r, x, y) {
    let d = Math.min(x + HALB, HALB - x, y, RAUM_H - y);
    for (const q of r.stuecke) d = Math.min(d, abstandRechteck(x, y, q));
    for (const c of r.kreise) d = Math.min(d, Math.hypot(x - c.x, y - c.y) - c.r);
    return d;
  }

  const nahEinAus = (r, x, y, d) => Math.hypot(x - r.ein.x, y - r.ein.y) < d || Math.hypot(x - r.aus.x, y - r.aus.y) < d;

  // Wie weit ein Pfeil von (ox, oy) aus fliegt, bis er in einer Mauer, einer
  // Säule oder einem Pfosten stecken bleibt.
  function strahl(r, ox, oy, dx, dy) {
    let t = 900;
    if (dx > 1e-9) t = Math.min(t, (HALB - ox) / dx);
    else if (dx < -1e-9) t = Math.min(t, (-HALB - ox) / dx);
    if (dy > 1e-9) t = Math.min(t, (RAUM_H - oy) / dy);
    else if (dy < -1e-9) t = Math.min(t, -oy / dy);
    for (const q of r.stuecke) t = Math.min(t, strahlRechteck(ox, oy, dx, dy, q));
    for (const c of r.kreise) t = Math.min(t, strahlKreis(ox, oy, dx, dy, c));
    return Math.max(0, t);
  }

  // Steckt (x, y) mit dem Halbmesser rad in etwas Festem? Für Sterne.
  function festBei(r, x, y, rad) {
    if (x < -HALB + rad || x > HALB - rad || y < rad || y > RAUM_H - rad) return true;
    for (const q of r.stuecke) if (abstandRechteck(x, y, q) < rad) return true;
    for (const c of r.kreise) if (Math.hypot(x - c.x, y - c.y) < c.r + rad) return true;
    return false;
  }

  /*
   * Ein Raum. Er zieht genau eine Zahl aus dem Zufall; alles andere würfelt
   * seine eigene Folge (folge). Was wo steht, hält Abstand zum Eingang (ein)
   * und zum Ausgang (aus) – dort beginnt und endet man immer in Ruhe.
   *
   *   saeulen   runde Säulen: Deckung vor Pfeilen, Hindernis für den Ninja
   *   stuecke   Mauerstücke von der Seite: machen den Weg eng
   *   salven    Schützen, die immer in dieselbe Richtung schiessen, im Takt
   *   schuetzen zielen auf den Ninja: Pfeile, Wurfsterne, Jäger (verfolgen)
   *   klingen   drehen sich an einem Pfosten (oder pendeln)
   *   wachen    mit Laterne und Lichtkegel; wer hineingerät: Pfeilhagel
   *   fallen    Klappen im Boden, die sich im Takt öffnen
   *   rollen    Schriftrollen zum Einsammeln
   */
  function neuerRaum(k) {
    const saat = Math.floor(zufall.zahl() * 4294967296) >>> 0;
    const z = folge(saat);
    const zw = (a, b) => lerp(a, b, z());
    const vorher = k > 0 ? state.raeume[k - 1] : null;
    const torU = vorher ? vorher.torO : 0;
    const D = SCHWERE(k);
    let torO = 0;
    for (let i = 0; i < 16; i += 1) {
      torO = Math.round(zw(-80, 80));
      if (k === 0 ? Math.abs(torO) >= 24 : Math.abs(torO - torU) >= 40) break;
    }
    const r = {
      k, saat, y0: k * SCHRITT, torU, torO, D,
      ein: { x: torU, y: 14 },
      aus: { x: torO, y: RAUM_H - 8 },
      saeulen: [], stuecke: [], kreise: [], belegt: [],
      salven: [], schuetzen: [], klingen: [], wachen: [], fallen: [], rollen: [],
      boden: ["stein", "kies", "holz"][Math.floor(hash01(k * 7.31 + 2.2) * 3)],
      laternen: [],
      tauStand: 0,
    };
    baueMauern(r);

    // Säulen: ab dem zweiten Raum, später mehr.
    const nSaeulen = k === 0 ? 0 : Math.floor(z() * (k < 3 ? 2.2 : 3.6));
    for (let i = 0; i < nSaeulen; i += 1) {
      for (let v = 0; v < 14; v += 1) {
        const c = { x: zw(-92, 92), y: zw(64, RAUM_H - 64), r: zw(9, 14), art: z() < 0.5 ? "holz" : "stein" };
        if (nahEinAus(r, c.x, c.y, c.r + 42)) continue;
        if (abstandFest(r, c.x, c.y) - c.r < 30) continue;
        r.saeulen.push(c);
        r.kreise.push(c);
        break;
      }
    }

    // Mauerstücke: ab Raum 5, abwechselnd von links und rechts – der Weg
    // schlängelt sich.
    if (k >= 4 && z() < 0.35 + 0.4 * D) {
      const n = k >= 8 && z() < 0.55 ? 2 : 1;
      let seite = z() < 0.5 ? -1 : 1;
      for (let i = 0; i < n; i += 1) {
        for (let v = 0; v < 14; v += 1) {
          const y = zw(72, RAUM_H - 76);
          const lang = zw(64, 150);
          const x0 = seite < 0 ? -HALB : HALB - lang;
          const q = [x0, y - 7, x0 + lang, y + 7];
          if (r.stuecke.some((p) => Math.abs((p[1] + p[3]) / 2 - y) < 58)) continue;
          if (r.saeulen.some((c) => abstandRechteck(c.x, c.y, q) - c.r < 32)) continue;
          if (abstandRechteck(r.ein.x, r.ein.y, q) < 50 || abstandRechteck(r.aus.x, r.aus.y, q) < 46) continue;
          r.stuecke.push(q);
          break;
        }
        seite = -seite;
      }
    }

    // Die Gefahren, nach Budget.
    const v = 125 + 175 * D;
    const P = 2.4 - 1.3 * D;
    const lead = clamp((k - 3) / 7, 0, 1);
    const zahl = { salve: 0, pfeil: 0, klinge: 0, falle: 0, wache: 0, stern: 0, jaeger: 0 };
    const baue = (art) => {
      let ok = false;
      if (art === "salve") ok = neueSalve(r, z, k, v, P);
      else if (art === "pfeil" || art === "stern" || art === "jaeger") ok = neuerSchuetze(r, z, k, art, v, P, lead);
      else if (art === "klinge") ok = neueKlinge(r, z, k);
      else if (art === "falle") ok = neueFallen(r, z, k);
      else if (art === "wache") ok = neueWache(r, z);
      if (ok) zahl[art] += 1;
      return ok;
    };
    if (k === 0) {
      // Der erste Raum: ein Schütze, der langsam zielt, und eine Bahn.
      neuerSchuetze(r, z, k, "pfeil", 108, 2.8, 0, { nurSeite: true, phi: 1.3 });
      neueSalve(r, z, k, 118, 2.3);
    } else {
      let rest = BUDGET(k);
      // Jeder Raum hat einen, der zielt: Wer stehen bleibt, wird getroffen.
      const zielArt = k >= 6 && z() < 0.35 ? "jaeger" : k >= 4 && z() < 0.4 ? "stern" : "pfeil";
      if (baue(zielArt)) rest -= ARTEN.find((a) => a.art === zielArt).kosten;
      // Was in diesem Raum zum ersten Mal kommt, kommt sicher.
      for (const a of ARTEN) {
        if (a.ab === k && a.ab > 0 && zahl[a.art] === 0 && baue(a.art)) rest -= a.kosten;
      }
      for (let versuch = 0; versuch < 30 && rest > 0.45; versuch += 1) {
        const moegliche = ARTEN.filter((a) => k >= a.ab && zahl[a.art] < a.max(k) && a.kosten <= rest + 0.35);
        if (!moegliche.length) break;
        let wahl = z() * moegliche.reduce((s, a) => s + a.gewicht, 0);
        let a = moegliche[0];
        for (const m of moegliche) { wahl -= m.gewicht; if (wahl <= 0) { a = m; break; } }
        if (baue(a.art)) rest -= a.kosten;
        else rest -= 0.25;
      }
    }

    // Schriftrollen.
    const nRollen = 1 + (k >= 5 && z() < 0.4 ? 1 : 0);
    for (let i = 0; i < nRollen; i += 1) neueRolle(r, z);

    // Laternen an den Mauern (nur fürs Bild).
    for (const seite of [-1, 1]) {
      for (const f of [0.3, 0.74]) {
        if (hash01(k * 3.7 + seite * 1.3 + f * 9) < 0.72) r.laternen.push({ x: seite * HALB, y: RAUM_H * f + (hash01(k + f) - 0.5) * 30 });
      }
    }

    // Der Weg zum Tor: ein Raster mit dem Abstand zum Ausgang. Kommt man vom
    // Eingang nicht hin (sollte nicht sein), fällt das letzte Hindernis weg.
    for (let v2 = 0; v2 < 6; v2 += 1) {
      r.feld = wegFeld(r);
      if (Number.isFinite(wegZumTor(r, r.ein.x, r.ein.y))) break;
      const weg = r.stuecke.pop() || r.saeulen.pop();
      if (!weg) break;
      r.kreise = r.kreise.filter((c) => c !== weg);
    }
    r.rollen = r.rollen.filter((q) => Number.isFinite(wegZumTor(r, q.x, q.y)));
    return r;
  }

  // Ein Platz auf der Mauer für einen Schützen: links, rechts oder oben (nicht
  // am Tor), nicht zu nah am nächsten.
  function wandPlatz(r, z, nurSeite = false) {
    for (let v = 0; v < 18; v += 1) {
      const oben = !nurSeite && z() < 0.32;
      let p;
      if (oben) {
        const x = lerp(-HALB + 18, HALB - 18, z());
        if (Math.abs(x - r.torO) < TOR / 2 + 16) continue;
        p = { x, y: RAUM_H - 1, seite: 0 };
      } else {
        const seite = z() < 0.5 ? -1 : 1;
        p = { x: seite * (HALB - 1), y: lerp(44, RAUM_H - 26, z()), seite };
        const anStueck = r.stuecke.some((q) => (seite < 0 ? q[0] <= -HALB + 1 : q[2] >= HALB - 1) && p.y > q[1] - 18 && p.y < q[3] + 18);
        if (anStueck) continue;
      }
      if (r.belegt.some((b) => Math.hypot(b.x - p.x, b.y - p.y) < 30)) continue;
      r.belegt.push(p);
      return p;
    }
    return null;
  }

  // Eine Bahn: Ein Schütze schiesst im Takt immer in dieselbe Richtung –
  // quer durch den Raum oder von oben herab.
  function neueSalve(r, z, k, v, P) {
    for (let t = 0; t < 16; t += 1) {
      const vonOben = k >= 3 && z() < 0.3;
      let ox;
      let oy;
      let dx;
      let dy;
      let seite;
      if (vonOben) {
        ox = lerp(-HALB + 24, HALB - 24, z());
        oy = RAUM_H - 1;
        if (Math.abs(ox - r.torO) < TOR / 2 + 14 || Math.abs(ox - r.torU) < 34) continue;
        const a = (z() - 0.5) * 0.4;
        dx = Math.sin(a);
        dy = -Math.cos(a);
        seite = 0;
      } else {
        seite = z() < 0.5 ? -1 : 1;
        oy = lerp(52, RAUM_H - 48, z());
        ox = seite * (HALB - 1);
        const a = (z() - 0.5) * (k >= 3 ? 0.5 : 0.2);
        dx = -seite * Math.cos(a);
        dy = Math.sin(a);
      }
      if (r.belegt.some((b) => Math.hypot(b.x - ox, b.y - oy) < 28)) continue;
      if (seite !== 0 && r.stuecke.some((q) => oy > q[1] - 18 && oy < q[3] + 18)) continue;
      const L = strahl(r, ox, oy, dx, dy);
      if (L < 60) continue;
      const ex = ox + dx * L;
      const ey = oy + dy * L;
      if (abstandStrecke(r.ein.x, r.ein.y, ox, oy, ex, ey) < 30) continue;
      if (abstandStrecke(r.aus.x, r.aus.y, ox, oy, ex, ey) < 22) continue;
      // Zwei fast gleiche Bahnen dicht nebeneinander wären eine Wand.
      const zuNah = r.salven.some((s) => Math.abs(s.dx * dy - s.dy * dx) < 0.5
        && abstandStrecke(ox, oy, s.ox - s.dx * 400, s.oy - s.dy * 400, s.ox + s.dx * 400, s.oy + s.dy * 400) < 34);
      if (zuNah) continue;
      const vs = v * lerp(0.88, 1.1, z());
      const n = 1 + (k >= 4 && z() < 0.3 + 0.4 * r.D ? 1 : 0) + (k >= 9 && z() < 0.2 + 0.4 * r.D ? 1 : 0);
      const Ps = Math.max(0.9, P * lerp(0.85, 1.2, z()), (110 / vs) + (n - 1) * SALVE_ABSTAND);
      r.belegt.push({ x: ox, y: oy });
      r.salven.push({ ox, oy, dx, dy, v: vs, P: Ps, phi: z() * Ps, n, L, seite });
      return true;
    }
    return false;
  }

  // Ein Schütze, der zielt: Pfeil, Wurfstern oder Jäger (ein Stern, der
  // seinem Ziel nachfliegt, bis er stecken bleibt oder müde wird).
  function neuerSchuetze(r, z, k, art, v, P, lead, { nurSeite = false, phi = null } = {}) {
    const p = wandPlatz(r, z, nurSeite);
    if (!p) return false;
    const D = r.D;
    const s = { x: p.x, y: p.y, seite: p.seite, art, lead, n: 1, faecher: 0, wende: 0, leben: 9 };
    if (art === "pfeil") {
      s.v = v * lerp(0.92, 1.06, z());
      s.P = Math.max(0.95, lerp(1.7, 2.6, z()) * (1 - 0.45 * D));
      if (k >= 7 && z() < 0.25 + 0.3 * D) { s.n = k >= 12 && z() < 0.4 ? 3 : 2; s.faecher = 0.15; }
    } else if (art === "stern") {
      s.v = 135 + 85 * D;
      s.P = Math.max(1.1, lerp(1.9, 2.8, z()) * (1 - 0.4 * D));
      if (k >= 9 && z() < 0.25 + 0.3 * D) { s.n = 3; s.faecher = 0.22; }
    } else {
      s.v = 80 + 35 * D;
      s.wende = 2.0 + 1.4 * D;
      s.leben = 4.2 + 1.5 * D;
      s.P = Math.max(2.0, 3.6 - 1.4 * D);
      s.lead = 0;
    }
    if (k === 0) { s.v = v; s.P = P; }
    s.phi = phi ?? lerp(0.9, 1.7, z());
    r.schuetzen.push(s);
    return true;
  }

  // Eine Klinge an einem Pfosten: dreht sich, später mit zwei Armen, oder
  // pendelt hin und her.
  function neueKlinge(r, z, k) {
    for (let t = 0; t < 18; t += 1) {
      const doppel = k >= 7 && z() < 0.4;
      const pendel = !doppel && k >= 2 && z() < 0.3;
      const L = lerp(30, 60, z()) * (0.92 + 0.18 * r.D);
      const x = lerp(-HALB + L + 8, HALB - L - 8, z());
      const yMin = Math.max(L + 8, 50);
      const yMax = Math.min(RAUM_H - L - 8, RAUM_H - 50);
      if (yMax < yMin) continue;
      const y = lerp(yMin, yMax, z());
      if (Math.hypot(x - r.ein.x, y - r.ein.y) < L + 32) continue;
      if (Math.hypot(x - r.aus.x, y - r.aus.y) < L + 26) continue;
      if (abstandFest(r, x, y) < L + 6) continue;
      if (r.klingen.some((b) => Math.hypot(b.x - x, b.y - y) < b.L + L + 14)) continue;
      let w = lerp(1.3, 2.3, z()) * (0.85 + 0.45 * r.D) * (z() < 0.5 ? -1 : 1);
      if (doppel) w = Math.sign(w) * Math.min(Math.abs(w), 1.6);
      const b = {
        x, y, L, w, phi: z() * PI2, arme: doppel ? 2 : 1, post: 6,
        pendel: pendel ? { amp: lerp(0.9, 1.4, z()), w: lerp(1.8, 2.8, z()), basis: z() * PI2 } : null,
      };
      r.klingen.push(b);
      r.kreise.push({ x, y, r: 6, art: "pfosten" });
      return true;
    }
    return false;
  }

  const klingenWinkel = (b, tau) => (b.pendel ? b.pendel.basis + b.pendel.amp * Math.sin(b.pendel.w * tau + b.phi) : b.phi + b.w * tau);
  // Wie schnell sich die Klinge gerade dreht (rad je s Weltzeit).
  const klingenTempo = (b, tau) => (b.pendel ? b.pendel.amp * b.pendel.w * Math.cos(b.pendel.w * tau + b.phi) : b.w);

  // Eine Reihe Fallen quer durch den Raum, je 30 breit. Früh nur ein Teil der
  // Reihe, später die ganze; im Takt öffnen sie sich als Welle, im Wechsel
  // oder durcheinander.
  function neueFallen(r, z, k) {
    for (let t = 0; t < 14; t += 1) {
      const h = 28;
      const b = 30;
      const y0 = lerp(66, RAUM_H - 98, z());
      if (r.fallen.some((f) => Math.abs(f.y0 - y0) < h + 34)) continue;
      if (r.stuecke.some((q) => q[3] > y0 - 12 && q[1] < y0 + h + 12)) continue;
      const teil = k < 5 ? Math.floor(lerp(4, 7, z())) : 8;
      const start = teil < 8 ? (z() < 0.5 ? 0 : 8 - teil) : 0;
      const Pf = lerp(2.4, 1.4, r.D) * lerp(0.9, 1.1, z());
      const offen = lerp(0.3, 0.55, r.D);
      const muster = ["welle", "wechsel", "durcheinander"][Math.floor(z() * (k >= 6 ? 3 : 2))];
      const dir = z() < 0.5 ? 1 : -1;
      const phi = z();
      let gebaut = 0;
      for (let i = start; i < start + teil; i += 1) {
        const x0 = -HALB + i * b;
        const zufallPh = z();
        if (r.kreise.some((c) => c.x > x0 - c.r - 2 && c.x < x0 + b + c.r + 2 && c.y > y0 - c.r - 2 && c.y < y0 + h + c.r + 2)) continue;
        const ph = muster === "welle" ? phi + (dir * i) / 8 : muster === "wechsel" ? phi + (i % 2) * 0.5 : zufallPh;
        r.fallen.push({ x0, y0, b, h, P: Pf, phi: (((ph % 1) + 1) % 1) * Pf, offen });
        gebaut += 1;
      }
      return gebaut > 0;
    }
    return false;
  }

  // Wo im Takt eine Falle steht: 0 bis 1. Ab 1 - offen ist sie offen, kurz
  // davor (WARNEN) knarrt und glimmt sie.
  const WARNEN = 0.4;
  const fallenU = (f, tau) => (((tau + f.phi) / f.P) % 1 + 1) % 1;
  const fallenOffen = (f, tau) => fallenU(f, tau) >= 1 - f.offen;

  // Ein Wächter an der Seite, mit Laterne. Der Kegel schwenkt hin und her.
  function neueWache(r, z) {
    for (let t = 0; t < 18; t += 1) {
      const seite = z() < 0.5 ? -1 : 1;
      const x = seite * (HALB - 14);
      const y = lerp(70, RAUM_H - 46, z());
      const R = lerp(92, 132, z()) * (0.95 + 0.25 * r.D);
      if (Math.hypot(x - r.ein.x, y - r.ein.y) < R + 14) continue;
      if (Math.hypot(x - r.aus.x, y - r.aus.y) < R + 8) continue;
      if (r.saeulen.some((c) => Math.hypot(c.x - x, c.y - y) < c.r + 22)) continue;
      if (r.stuecke.some((q) => abstandRechteck(x, y, q) < 20)) continue;
      if (r.wachen.some((w) => Math.hypot(w.x - x, w.y - y) < 64)) continue;
      if (r.klingen.some((b) => Math.hypot(b.x - x, b.y - y) < b.L + 16)) continue;
      const wache = {
        x, y, R, seite,
        alpha: lerp(0.3, 0.4 + 0.08 * r.D, z()),
        basis: (seite < 0 ? 0 : Math.PI) + (z() - 0.5) * 0.5,
        amp: lerp(0.55, 1.0, z()),
        w: lerp(0.9, 1.6, z()),
        phi: z() * PI2,
      };
      r.wachen.push(wache);
      r.kreise.push({ x, y, r: 8, art: "wache" });
      return true;
    }
    return false;
  }

  const wachenWinkel = (w, tau) => w.basis + w.amp * Math.sin(w.w * tau + w.phi);
  // Die Laterne hängt vor dem Wächter: Von dort geht der Kegel aus.
  const laterneX = (w, a) => w.x + Math.cos(a) * 9;
  const laterneY = (w, a) => w.y + Math.sin(a) * 9;

  function neueRolle(r, z) {
    for (let t = 0; t < 24; t += 1) {
      const x = lerp(-HALB + 16, HALB - 16, z());
      const y = lerp(46, RAUM_H - 40, z());
      if (abstandFest(r, x, y) < 13) continue;
      if (Math.hypot(x - r.ein.x, y - r.ein.y) < 52) continue;
      if (r.rollen.some((q) => Math.hypot(q.x - x, q.y - y) < 50)) continue;
      r.rollen.push({ x, y });
      return;
    }
  }

  // Der Weg zum Tor: Abstand jedes Rasterpunkts (FELD Einheiten) zum
  // Ausgang, um alles Feste herum. Für die Prüfung (der Autopilot weiss so,
  // wohin) und dafür, dass jeder Raum einen Weg hat.
  const FELD = 6;
  const FX = Math.round((2 * HALB) / FELD) + 1;
  const FY = Math.ceil((RAUM_H + WAND) / FELD) + 1;
  function wegFeld(r) {
    const n = FX * FY;
    const d = new Float32Array(n).fill(Infinity);
    const frei = new Uint8Array(n);
    const rechtecke = r.mauern.concat(r.stuecke);
    for (let j = 0; j < FY; j += 1) {
      for (let i = 0; i < FX; i += 1) {
        const x = -HALB + i * FELD;
        const y = j * FELD;
        let ok = y <= RAUM_H + WAND;
        for (const q of rechtecke) if (ok && abstandRechteck(x, y, q) < R_NINJA + 0.5) ok = false;
        for (const c of r.kreise) if (ok && Math.hypot(x - c.x, y - c.y) < c.r + R_NINJA + 0.5) ok = false;
        frei[j * FX + i] = ok ? 1 : 0;
        if (ok && y >= RAUM_H + 4) d[j * FX + i] = 0;
      }
    }
    // Hin und her streichen, bis sich nichts mehr ändert (8 Nachbarn).
    const D1 = FELD;
    const D2 = FELD * Math.SQRT2;
    for (let runde = 0; runde < 40; runde += 1) {
      let neu = false;
      for (let dir = 0; dir < 2; dir += 1) {
        for (let jj = 0; jj < FY; jj += 1) {
          const j = dir ? FY - 1 - jj : jj;
          for (let ii = 0; ii < FX; ii += 1) {
            const i = dir ? FX - 1 - ii : ii;
            const idx = j * FX + i;
            if (!frei[idx]) continue;
            let best = d[idx];
            for (let dj = -1; dj <= 1; dj += 1) {
              const j2 = j + dj;
              if (j2 < 0 || j2 >= FY) continue;
              for (let di = -1; di <= 1; di += 1) {
                const i2 = i + di;
                if ((!di && !dj) || i2 < 0 || i2 >= FX) continue;
                const idx2 = j2 * FX + i2;
                if (!frei[idx2]) continue;
                const c = d[idx2] + (di && dj ? D2 : D1);
                if (c < best) best = c;
              }
            }
            if (best < d[idx]) { d[idx] = best; neu = true; }
          }
        }
      }
      if (!neu) break;
    }
    return d;
  }

  // Wie weit es von (x, y) im Raum r noch bis zum Tor ist (über das Raster).
  function wegZumTor(r, x, y) {
    if (!r.feld) return Infinity;
    const fi = (x + HALB) / FELD;
    const fj = y / FELD;
    const i0 = clamp(Math.floor(fi), 0, FX - 2);
    const j0 = clamp(Math.floor(fj), 0, FY - 2);
    let best = Infinity;
    for (let dj = 0; dj <= 1; dj += 1) {
      for (let di = 0; di <= 1; di += 1) {
        const v = r.feld[(j0 + dj) * FX + i0 + di];
        if (!Number.isFinite(v)) continue;
        const px = -HALB + (i0 + di) * FELD;
        const py = (j0 + dj) * FELD;
        best = Math.min(best, v + Math.hypot(px - x, py - y));
      }
    }
    return best;
  }

  // ---------------------------------------------------------------------------
  // Die Gefahren im Lauf der Zeit
  // ---------------------------------------------------------------------------
  // Die Pfeile einer Bahn zur Zeit tau: fn(spitzeX, spitzeY, weg) für jeden,
  // der gerade fliegt. Rein aus der Zeit gerechnet – keiner muss gemerkt
  // werden.
  function salvenPfeile(s, tau, fn) {
    if (tau < s.phi) return;
    const flug = s.L / s.v;
    const iVon = Math.max(0, Math.floor((tau - flug - s.phi - (s.n - 1) * SALVE_ABSTAND) / s.P));
    const iBis = Math.floor((tau - s.phi) / s.P);
    for (let i = iVon; i <= iBis; i += 1) {
      for (let j = 0; j < s.n; j += 1) {
        const t = tau - (s.phi + i * s.P + j * SALVE_ABSTAND);
        if (t < 0 || t > flug) continue;
        const weg = s.v * t;
        if (fn(s.ox + s.dx * weg, s.oy + s.dy * weg, weg)) return;
      }
    }
  }

  // Die Pfeile, die in einer Wand stecken (nur Bild): wie lange schon.
  function salvenStecken(s, tau, fn) {
    if (tau < s.phi) return;
    const flug = s.L / s.v;
    const iVon = Math.max(0, Math.floor((tau - flug - 2.2 - s.phi - (s.n - 1) * SALVE_ABSTAND) / s.P));
    const iBis = Math.floor((tau - flug - s.phi) / s.P);
    for (let i = iVon; i <= iBis; i += 1) {
      for (let j = 0; j < s.n; j += 1) {
        const t = tau - (s.phi + i * s.P + j * SALVE_ABSTAND) - flug;
        if (t < 0 || t > 2.2) continue;
        fn(t, j);
      }
    }
  }

  // Wie lange es noch dauert, bis ein Schütze schiesst (Weltzeit).
  function bisSchuss(s, tau) {
    if (tau < s.phi) return s.phi - tau;
    const u = (tau - s.phi) % s.P;
    return s.P - u;
  }

  // Sieht der Wächter w den Punkt (x, y)? Im Kegel und nichts dazwischen.
  function imKegel(r, w, tau, x, y) {
    const a = wachenWinkel(w, tau);
    const lx = laterneX(w, a);
    const ly = laterneY(w, a);
    const dx = x - lx;
    const dy = y - ly;
    const d = Math.hypot(dx, dy);
    if (d > w.R + 3 || d < 1) return false;
    if (Math.abs(winkelDiff(Math.atan2(dy, dx), a)) > w.alpha + Math.asin(Math.min(1, 3 / d))) return false;
    for (const c of r.kreise) {
      if (c.art === "wache" && Math.hypot(c.x - w.x, c.y - w.y) < 1) continue;
      if (abstandStrecke(c.x, c.y, lx, ly, x, y) < c.r) return false;
    }
    for (const q of r.stuecke) {
      if (strahlRechteck(lx, ly, dx / d, dy / d, q) < d) return false;
    }
    return true;
  }

  /*
   * Was den Ninja an (x, y) gerade trifft – oder null. Mit Art und Richtung,
   * aus der es kam (für den Schnitt im Bild).
   */
  function gefahrBei(r, x, y, tau) {
    const grenzePfeil = R_TREFF + 1.2;
    let treffer = null;
    for (const s of r.salven) {
      salvenPfeile(s, tau, (px, py, weg) => {
        const l = Math.min(PFEIL_L, weg);
        if (abstandStrecke(x, y, px, py, px - s.dx * l, py - s.dy * l) < grenzePfeil) {
          treffer = { art: "pfeil", dx: s.dx, dy: s.dy };
          return true;
        }
        return false;
      });
      if (treffer) return treffer;
    }
    for (const p of state.pfeile) {
      if (p.weg <= 0) continue;
      const px = p.ox + p.dx * p.weg;
      const py = p.oy + p.dy * p.weg;
      const l = Math.min(PFEIL_L, p.weg);
      if (abstandStrecke(x, y, px, py, px - p.dx * l, py - p.dy * l) < grenzePfeil) return { art: "pfeil", dx: p.dx, dy: p.dy };
    }
    for (const st of state.sterne) {
      if (Math.hypot(x - st.x, y - st.y) < R_TREFF + 4.5) return { art: "stern", dx: st.vx / st.v, dy: st.vy / st.v };
    }
    for (const b of r.klingen) {
      if (Math.hypot(x - b.x, y - b.y) > b.L + R_TREFF + 3) continue;
      const a = klingenWinkel(b, tau);
      for (let arm = 0; arm < b.arme; arm += 1) {
        const ux = Math.cos(a + arm * Math.PI);
        const uy = Math.sin(a + arm * Math.PI);
        if (abstandStrecke(x, y, b.x + ux * b.post, b.y + uy * b.post, b.x + ux * b.L, b.y + uy * b.L) < R_TREFF + 2.4) {
          const dreh = Math.sign(klingenTempo(b, tau)) || 1;
          return { art: "klinge", dx: -uy * dreh, dy: ux * dreh };
        }
      }
    }
    for (const f of r.fallen) {
      if (x >= f.x0 && x <= f.x0 + f.b && y >= f.y0 && y <= f.y0 + f.h && fallenOffen(f, tau)) return { art: "falle", dx: 0, dy: -1 };
    }
    return null;
  }

  // ---------------------------------------------------------------------------
  // Ein Schritt
  // ---------------------------------------------------------------------------
  // Der Ninja geht (mx, my) weit – an Mauern, Säulen, Pfosten und Wächtern
  // gleitet er entlang.
  function bewege(r, mx, my) {
    const n = state.ninja;
    let x = n.x + mx;
    let y = n.y - r.y0 + my;
    for (let runde = 0; runde < 3; runde += 1) {
      for (const q of r.mauern) [x, y] = schiebeAusRechteck(x, y, q);
      for (const q of r.stuecke) [x, y] = schiebeAusRechteck(x, y, q);
      for (const c of r.kreise) {
        const dx = x - c.x;
        const dy = y - c.y;
        const d = Math.hypot(dx, dy);
        const min = c.r + R_NINJA;
        if (d < min && d > 1e-6) { x = c.x + (dx / d) * min; y = c.y + (dy / d) * min; }
      }
    }
    n.x = x;
    n.y = y + r.y0;
  }

  function schiebeAusRechteck(x, y, q) {
    const cx = clamp(x, q[0], q[2]);
    const cy = clamp(y, q[1], q[3]);
    const dx = x - cx;
    const dy = y - cy;
    const d = Math.hypot(dx, dy);
    if (d >= R_NINJA) return [x, y];
    if (d > 1e-6) return [cx + (dx / d) * R_NINJA, cy + (dy / d) * R_NINJA];
    // Mitten drin: zur nächsten Kante hinaus.
    const raus = [x - q[0], q[2] - x, y - q[1], q[3] - y];
    const m = Math.min(...raus);
    if (m === raus[0]) return [q[0] - R_NINJA, y];
    if (m === raus[1]) return [q[2] + R_NINJA, y];
    if (m === raus[2]) return [x, q[1] - R_NINJA];
    return [x, q[3] + R_NINJA];
  }

  // Woher die Eingabe kommt: ein Plan Schritt für Schritt (Vorführung), eine
  // Richtung von aussen (Prüfung), die Tasten – oder der Finger.
  function eingabe() {
    if (state.planI < state.plan.length) return state.plan[state.planI++];
    if (state.steuer) return state.steuer;
    if (pad.id !== null) return pad.richtung;
    const x = (tasten.rechts ? 1 : 0) - (tasten.links ? 1 : 0);
    const y = (tasten.hoch ? 1 : 0) - (tasten.runter ? 1 : 0);
    if (x || y) return { x, y };
    return null;
  }

  function schritt() {
    if (state.schritt === "wechsel") { wechselSchritt(); return; }
    if (state.schritt === "aus") { welt(TAKT * AUS_TEMPO); return; }
    const r = aktRaum();
    const n = state.ninja;
    const smax = V_MAX * TAKT;
    let mx = 0;
    let my = 0;
    const e = eingabe();
    if (e) {
      const l = Math.hypot(e.x, e.y);
      if (l > 1e-6) {
        const f = (Math.min(1, l) * smax) / l;
        mx = e.x * f;
        my = e.y * f;
      }
    }
    const ax = n.x;
    const ay = n.y;
    if (mx || my) bewege(r, mx, my);
    const weg = Math.hypot(n.x - ax, n.y - ay);
    // Die Zeit läuft mit dem Weg – und nie ganz still.
    const rate = clamp(weg / smax, R_MIN, 1);
    const w = rate * TAKT;
    state.rate = rate;
    // Wie schnell er in der Welt läuft (für Schützen, die vorhalten).
    const k = Math.min(1, w / 0.06);
    n.wvx += ((n.x - ax) / w - n.wvx) * k;
    n.wvy += ((n.y - ay) / w - n.wvy) * k;
    if (weg > 1e-4) {
      n.blickZiel = Math.atan2(n.y - ay, n.x - ax);
      n.lauf += weg * 0.38;
    }
    state.echtRaum += TAKT;
    welt(w);
    if (state.schritt === "lauf") pruefeNinja(r);
  }

  /*
   * Die Welt rückt um w Weltzeit vor: Schützen schiessen, was fliegt, fliegt,
   * Wächter schauen, und nach LUNTE kommt der Hagel. Im Spiel und beim
   * Zuschauen gleich – dort steht der Ninja, wo er damals stand.
   */
  function welt(w) {
    const r = aktRaum();
    const tau0 = state.tau;
    state.W += w;
    state.tau += w;
    state.weltFrame += w;
    const tau = state.tau;
    const n = state.ninja;
    const lx = n.x;
    const ly = n.y - r.y0;
    if (state.schritt === "wechsel") return;

    for (const s of r.schuetzen) {
      if (tau < s.phi) continue;
      const k1 = Math.floor((tau - s.phi) / s.P);
      const k0 = tau0 < s.phi ? -1 : Math.floor((tau0 - s.phi) / s.P);
      if (k1 > k0 && state.schritt !== "aus") feuern(r, s, lx, ly);
    }

    for (let i = state.pfeile.length - 1; i >= 0; i -= 1) {
      const p = state.pfeile[i];
      p.weg += p.v * w;
      if (p.weg >= p.L) {
        if (!state.sim) {
          stecken(r, p.ox + p.dx * p.L, p.oy + p.dy * p.L, p.dx, p.dy);
          funken(r.y0, p.ox + p.dx * p.L, p.oy + p.dy * p.L, 4, ["#ffe2a8", "#ffffff"], 70);
        }
        state.pfeile.splice(i, 1);
      }
    }

    for (let i = state.sterne.length - 1; i >= 0; i -= 1) {
      const st = state.sterne[i];
      st.alter += w;
      if (st.wende > 0 && state.schritt !== "aus") {
        const soll = Math.atan2(ly - st.y, lx - st.x);
        const ist = Math.atan2(st.vy, st.vx);
        const a = ist + clamp(winkelDiff(soll, ist), -st.wende * w, st.wende * w);
        st.vx = Math.cos(a) * st.v;
        st.vy = Math.sin(a) * st.v;
      }
      st.x += st.vx * w;
      st.y += st.vy * w;
      st.dreh += w * 15;
      if (!state.sim && st.wende > 0) {
        st.spurUhr += w;
        if (st.spurUhr > 0.025) {
          st.spurUhr = 0;
          st.spur.push(st.x, st.y);
          if (st.spur.length > 20) st.spur.splice(0, 2);
        }
      }
      if (st.alter > st.leben || festBei(r, st.x, st.y, 3)) {
        if (!state.sim) {
          funken(r.y0, st.x, st.y, 6, ["#ffffff", "#c8b8ff", "#ffe2a8"], 90);
          if (st.alter <= st.leben) stecken(r, st.x, st.y, st.vx / st.v, st.vy / st.v, true);
        }
        state.sterne.splice(i, 1);
      }
    }
    zischPruefen(lx, ly);

    for (let i = 0; i < r.wachen.length; i += 1) {
      const wa = r.wachen[i];
      const st = state.wachen[i];
      if (!st) continue;
      if (st.hagel > 0 && tau >= st.hagel) {
        st.hagel = -1;
        if (state.schritt !== "aus") hagel(r, lx, ly, wa);
      }
      if (tau < st.ruhe || state.schritt === "aus") continue;
      if (imKegel(r, wa, tau, lx, ly)) {
        st.alarm = tau;
        st.hagel = tau + 0.45;
        st.ruhe = tau + 2.6;
        if (!state.sim) {
          schrift("Entdeckt!", wa.x + (wa.seite < 0 ? 30 : -30), wa.y + 18, r.y0, "#ff8a6a", 17, 1.1);
          kids()?.vibrate?.(14);
        }
      }
    }

    if (tau >= state.lunte && state.schritt !== "aus") {
      state.lunte += LUNTE_TAKT;
      hagel(r, lx, ly, null);
      if (!state.sim && tau < LUNTE + LUNTE_TAKT) schrift("Die Wachen sind wach!", 0, RAUM_H - 40, r.y0, "#ffb08a", 15, 1.6);
    }
  }

  // Ein Schütze schiesst: auf den Ninja – oder, wer vorhält, dorthin, wo er
  // bald ist, wenn er so weiterläuft.
  function feuern(r, s, lx, ly) {
    const n = state.ninja;
    let tx = lx;
    let ty = ly;
    if (s.lead > 0) {
      const t = Math.hypot(lx - s.x, ly - s.y) / s.v;
      tx += n.wvx * t * s.lead;
      ty += n.wvy * t * s.lead;
    }
    const a0 = Math.atan2(ty - s.y, tx - s.x);
    for (let j = 0; j < s.n; j += 1) {
      const a = a0 + (j - (s.n - 1) / 2) * s.faecher;
      const dx = Math.cos(a);
      const dy = Math.sin(a);
      if (s.art === "pfeil") {
        state.pfeile.push({ ox: s.x, oy: s.y, dx, dy, v: s.v, weg: 0, L: strahl(r, s.x, s.y, dx, dy), art: "pfeil" });
      } else {
        state.sterne.push({ x: s.x + dx * 3, y: s.y + dy * 3, vx: dx * s.v, vy: dy * s.v, v: s.v, wende: s.wende, alter: 0, leben: s.leben, dreh: 0, spur: [], spurUhr: 0 });
      }
    }
  }

  // Der Pfeilhagel: von oben, aus fünf Richtungen auf einen Punkt. Wer dort
  // bleibt, ist getroffen; wer weggeht, nicht.
  function hagel(r, zx, zy, quelle) {
    const xs = [-96, -52, -8, 36, 80];
    for (let i = 0; i < 5; i += 1) {
      let ox = xs[i] + (quelle ? (quelle.seite || 0) * 6 : 0);
      if (Math.abs(ox - r.torO) < TOR / 2 + 4) ox += ox < r.torO ? -TOR / 2 : TOR / 2;
      ox = clamp(ox, -HALB + 6, HALB - 6);
      const oy = RAUM_H - 1;
      const tx = zx + (i - 2) * 4;
      const ty = zy;
      const d = Math.hypot(tx - ox, ty - oy) || 1;
      const dx = (tx - ox) / d;
      const dy = (ty - oy) / d;
      state.pfeile.push({ ox, oy, dx, dy, v: HAGEL_V, weg: -i * 0.06 * HAGEL_V, L: strahl(r, ox, oy, dx, dy), art: "hagel" });
    }
  }

  function pruefeNinja(r) {
    const n = state.ninja;
    const lx = n.x;
    const ly = n.y - r.y0;
    if (state.tau >= DECKEL) { treffer("gefangen", 0, -1); return; }
    const t = gefahrBei(r, lx, ly, state.tau);
    if (t) { treffer(t.art, t.dx, t.dy); return; }
    for (let i = 0; i < r.rollen.length; i += 1) {
      if (state.rollen[i]) continue;
      const q = r.rollen[i];
      if (Math.hypot(lx - q.x, ly - q.y) < R_NINJA + 7) rolle(r, i);
    }
    if (ly > RAUM_H + 3) raumGeschafft(r);
  }

  function rolle(r, i) {
    state.rollen[i] = true;
    state.rollenZahl += 1;
    state.punkte += PUNKTE_ROLLE;
    if (state.sim) return;
    const q = r.rollen[i];
    shell.setCount(state.punkte);
    schrift(`+${PUNKTE_ROLLE} Punkte`, q.x, q.y + 16, r.y0, "#ffe08a", 18, 1.2);
    funken(r.y0, q.x, q.y, 16, ["#fff4c2", "#ffd23f", "#ffb02e", "#ffffff"], 120, true);
    ton("ninja.rolle");
    kids()?.vibrate?.(10);
  }

  // Durchs Tor: Punkte, und der Gang in den nächsten Raum. Die Weltzeit steht
  // dabei still.
  function raumGeschafft(r) {
    const n = state.ninja;
    state.schritt = "wechsel";
    state.wechsel = { t: 0, vonX: n.x, vonY: n.y, nachX: r.torO, nachY: (r.k + 1) * SCHRITT + 14 };
    state.geschafft += 1;
    const i = tempoStufe(state.echtRaum);
    const stufe = TEMPO_STUFEN[i] || null;
    const bonus = stufe ? stufe[1] : 0;
    state.punkte += PUNKTE_RAUM + bonus;
    state.tempoBonus += bonus;
    r.tauStand = state.tau;
    raumBis(r.k + 3);
    if (state.sim) return;
    shell.setCount(state.punkte);
    schrift(`+${PUNKTE_RAUM}`, r.torO, RAUM_H + 26, r.y0, "#ffffff", 22, 1.2);
    if (stufe) schrift(`Tempo-Bonus +${bonus}`, r.torO, RAUM_H + 2, r.y0, TEMPO_FARBEN[i], i === 0 ? 18 : 16, 1.5);
    funken(r.y0, r.torO, RAUM_H + 8, 14, ["#c8ffd4", "#ffffff", "#ffe08a"], 110, true);
    // Ein Raum geschafft. Blitzschnell dazu: nach der langen Harfe die kurze
    // (nur beim ersten blitzschnellen Raum in Folge).
    ton("meilenstein", {}, 500);
    blitzFolge = i === 0 ? blitzFolge + 1 : 0;
    if (blitzFolge === 1) ton("perfekt", { laut: 0.8, verzoegerung: 0.4 }, 100);
    kids()?.vibrate?.(12);
    kameraZu(r.k + 1);
  }

  function wechselSchritt() {
    const w = state.wechsel;
    const n = state.ninja;
    w.t += TAKT / WECHSEL;
    const f = weich(Math.min(1, w.t));
    const ax = n.x;
    const ay = n.y;
    n.x = lerp(w.vonX, w.nachX, f);
    n.y = lerp(w.vonY, w.nachY, f);
    n.lauf += Math.hypot(n.x - ax, n.y - ay) * 0.38;
    n.blickZiel = Math.PI / 2;
    state.rate = 0;
    if (w.t >= 1) raumBetreten(state.raum + 1);
  }

  function raumBetreten(k) {
    raumBis(k + 3);
    state.raum = k;
    const r = aktRaum();
    state.tau = 0;
    state.echtRaum = 0;
    state.pfeile = [];
    state.sterne = [];
    state.wachen = r.wachen.map(() => ({ alarm: -9, hagel: -1, ruhe: 0 }));
    state.rollen = r.rollen.map(() => false);
    state.lunte = LUNTE;
    state.schritt = "lauf";
    state.wechsel = null;
    if (!state.sim) {
      state.tuerZu = state.echt;
      state.stecken = [];
    }
  }

  // Getroffen. Im Bild: ein Schnitt quer durchs Bild, Rauch – und wo der
  // Ninja stand, liegt ein Holzklotz (der alte Trick der Ninjas).
  const GRUENDE = {
    pfeil: ["Pfeil!", "Vom Pfeil getroffen"],
    stern: ["Wurfstern!", "Vom Wurfstern getroffen"],
    klinge: ["Klinge!", "Die Klinge war schneller"],
    falle: ["Falle!", "In die Falle gefallen"],
    gefangen: ["Gefangen!", "Zu lange gezögert"],
  };

  function treffer(art, dx, dy) {
    if (state.schritt === "aus") return;
    state.schritt = "aus";
    state.grund = art;
    if (state.sim) return;
    const n = state.ninja;
    state.ausEcht = state.echt;
    // Der Schnitt geht quer zu dem, was traf – aber immer schräg durchs Bild.
    const quer = Math.atan2(dy, dx) + Math.PI / 2;
    const schraeg = Math.round((quer - Math.PI / 4) / (Math.PI / 2)) * (Math.PI / 2) + Math.PI / 4;
    state.aus = { x: n.x, y: n.y, winkel: quer + winkelDiff(schraeg, quer) * 0.75, t0: state.echt, art, dreh: (Math.random() - 0.5) * 2 };
    state.stoss = 1;
    state.blitz = 1;
    const r = aktRaum();
    const ly = n.y - r.y0;
    rauch(n.x, n.y, 18);
    for (let i = 0; i < (ruhig() ? 6 : 18); i += 1) {
      const w = Math.random() * PI2;
      const v = 30 + Math.random() * 90;
      teil({ art: "blatt", x: n.x, y: n.y, vx: Math.cos(w) * v, vy: Math.sin(w) * v, r: 2 + Math.random() * 1.6,
        farbe: ["#ffc1d6", "#ff9fbf", "#ffe0ea"][i % 3], leben: 1.6, max: 1.6, dreh: Math.random() * 6, echt: true });
    }
    schrift(GRUENDE[art]?.[0] || "Erwischt!", n.x, ly + 26, r.y0, "#ff8a6a", 24, 1.6);
    // Getroffen: Ende der Runde, das Herz steht still.
    herz.aus();
    ton("ninja.treffer", {}, 300);
    kids()?.vibrate?.([30, 40, 60]);
  }

  // ---------------------------------------------------------------------------
  // Teilchen und Schriften
  // ---------------------------------------------------------------------------
  const TEILE_MAX = 220;

  function teil(t) {
    if (state.sim) return;
    if (state.teile.length >= TEILE_MAX) state.teile.shift();
    state.teile.push(t);
  }

  // Funken an (x, y) im Raum mit dem Boden y0. Sie fliegen in Weltzeit – und
  // stehen in der Luft, wenn die Zeit steht.
  function funken(y0, x, y, anzahl, farben, tempo = 100, echt = false) {
    if (state.sim) return;
    if (ruhig()) anzahl = Math.ceil(anzahl / 3);
    for (let i = 0; i < anzahl; i += 1) {
      const w = Math.random() * PI2;
      const v = tempo * (0.35 + Math.random() * 0.8);
      teil({ art: "funke", x, y: y + y0, vx: Math.cos(w) * v, vy: Math.sin(w) * v, r: 0.9 + Math.random() * 1.3,
        farbe: farben[i % farben.length], leben: 0.35 + Math.random() * 0.35, max: 0.7, dreh: 0, echt });
    }
  }

  function rauch(x, y, anzahl) {
    if (ruhig()) anzahl = Math.ceil(anzahl / 2);
    for (let i = 0; i < anzahl; i += 1) {
      const w = Math.random() * PI2;
      const v = 10 + Math.random() * 40;
      teil({ art: "rauch", x: x + Math.cos(w) * 3, y: y + Math.sin(w) * 3, vx: Math.cos(w) * v, vy: Math.sin(w) * v,
        r: 5 + Math.random() * 6, farbe: i % 3 ? "#d9dbe6" : "#aab0c4", leben: 0.9 + Math.random() * 0.6, max: 1.5, dreh: 0, echt: true });
    }
  }

  // Ein Pfeil oder Stern bleibt stecken (nur Bild).
  function stecken(r, x, y, dx, dy, stern = false) {
    if (state.sim) return;
    state.stecken.push({ x, y: y + r.y0, dx, dy, stern, alter: 0, dreh: Math.random() * 6 });
    if (state.stecken.length > 40) state.stecken.shift();
  }

  function schrift(text, x, y, y0, farbe, gross, dauer = 1.1) {
    if (state.sim) return;
    let wy = y + y0;
    for (const alt of state.schriften) {
      if (alt.leben > alt.max * 0.5 && Math.abs(alt.x - x) < 90 && Math.abs(alt.y - wy) < 18) wy = alt.y + 20;
    }
    state.schriften.push({ text, x, y: wy, farbe, gross, leben: dauer, max: dauer });
    if (state.schriften.length > 7) state.schriften.shift();
  }

  // ---------------------------------------------------------------------------
  // Die Fläche
  // ---------------------------------------------------------------------------
  function buildPlatz() {
    feld = shell.el("div", "nj-feld");
    canvas = document.createElement("canvas");
    canvas.className = "nj-canvas";
    canvas.setAttribute("aria-hidden", "true");
    feld.append(canvas);
    g = canvas.getContext("2d");
    return feld;
  }

  const kamZiel = (k) => k * SCHRITT + RAUM_H / 2 + view.versatz;

  function messen() {
    if (!canvas || !feld) return;
    const cssW = Math.max(80, feld.clientWidth);
    const cssH = Math.max(80, feld.clientHeight);
    const dpr = clamp(window.devicePixelRatio || 1, 1, 2.5);
    // Auf dem Handy reicht die Leinwand unter die Knöpfe oben (game-shell.js,
    // frei). Gemalt wird dort auch – aber der Hof steht darunter.
    const frei = Math.min(cssH * 0.4, shell?.frei?.(canvas) || 0);
    if (cssW === view.cssW && cssH === view.cssH && dpr === view.dpr && frei === view.frei) return;
    view.cssW = cssW;
    view.cssH = cssH;
    view.dpr = dpr;
    view.frei = frei;
    // Das Steuerfeld: so gross, wie der Platz erlaubt. Steht neben dem Hof
    // genug frei (quer), kommt es unten rechts in den Garten, und der Hof
    // bleibt, wie er ist; sonst unter den Hof, der dafür unten einen
    // Streifen abgibt – hochkant ist er ohnehin durch die Breite begrenzt.
    const halb = clamp(Math.min(cssW, cssH) * 0.28, PAD_MIN, PAD_MAX) / 2;
    const s0 = Math.min(cssW / SICHT_B, (cssH - frei) / SICHT_H);
    const neben = (cssW - SICHT_B * s0) / 2;
    const unterRand = PAD_RAND + sicherUnten();
    pad.halb = halb;
    pad.seitlich = neben >= 2 * (halb + PAD_RAND);
    pad.x = pad.seitlich ? cssW - neben / 2 : cssW / 2;
    pad.y = cssH - unterRand - halb;
    view.unten = pad.seitlich ? 0 : 2 * halb + PAD_RAND + unterRand;
    // «… schaut gerade zu» (geist.js) steht unten links neben dem Steuerfeld.
    feld.closest(".cm-stage")?.style.setProperty("--gz-breit", pad.seitlich ? "" : `${Math.max(90, Math.floor(cssW / 2 - halb - 22))}px`);
    const nutzH = cssH - frei - view.unten;
    // Der ganze Raum – Mauern, Tore – steht immer im Bild, gleich gross in
    // Welteinheiten. Was übrig ist, zeigt hochkant den nächsten Raum (darum
    // rückt der Hof ein wenig nach unten) und quer den Garten daneben.
    view.s = Math.min(cssW / SICHT_B, nutzH / SICHT_H);
    view.mx = cssW / 2;
    view.my = frei + nutzH / 2;
    view.xb = cssW / (2 * view.s) + 8;
    view.versatz = clamp((nutzH / view.s - SICHT_H) * 0.3, 0, 72);
    const pw = Math.round(cssW * dpr);
    const ph = Math.round(cssH * dpr);
    if (canvas.width !== pw) canvas.width = pw;
    if (canvas.height !== ph) canvas.height = ph;
    bilder.schluessel = "";
    kam.nach = kamZiel(state.raum);
    if (kam.t >= 1) kam.y = kam.nach;
    blaetterVerteilen();
  }

  // Wie viel unten das Handy selbst braucht (der Strich zum Wischen).
  function sicherUnten() {
    const probe = document.createElement("div");
    probe.style.cssText = "position:fixed;bottom:0;height:0;padding-bottom:env(safe-area-inset-bottom,0px);visibility:hidden;pointer-events:none";
    document.body.append(probe);
    const h = probe.getBoundingClientRect().height || 0;
    probe.remove();
    return Math.min(40, h);
  }

  function kameraZu(k) {
    kam.von = kam.y;
    kam.nach = kamZiel(k);
    kam.t = ruhig() ? 1 : 0;
    if (kam.t >= 1) kam.y = kam.nach;
  }

  const wackelX = () => (ruhig() ? 0 : Math.cos(state.echt * 53) * 3 * state.stoss);
  const wackelY = () => (ruhig() ? 0 : Math.sin(state.echt * 71) * 3 * state.stoss);

  function flachTransform() {
    g.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
  }

  // Nach dem Treffer fährt die Kamera langsam an die Stelle heran.
  function bildTransform() {
    const a = state.aus;
    if (a && !ruhig()) {
      const z = 1 + 0.14 * weich(clamp((state.echt - a.t0) / 0.9, 0, 1));
      const cx = bildX(a.x);
      const cy = bildY(a.y);
      g.setTransform(view.dpr * z, 0, 0, view.dpr * z, (cx * (1 - z) + wackelX()) * view.dpr, (cy * (1 - z) + wackelY()) * view.dpr);
      return;
    }
    g.setTransform(view.dpr, 0, 0, view.dpr, wackelX() * view.dpr, wackelY() * view.dpr);
  }

  const bildX = (x) => view.mx + x * view.s;
  const bildY = (y) => view.my - (y - kam.y) * view.s;
  const weltX = (sx) => (sx - view.mx) / view.s;
  const weltY = (sy) => kam.y - (sy - view.my) / view.s;

  // ---------------------------------------------------------------------------
  // Die gemalten Bilder im Speicher
  // ---------------------------------------------------------------------------
  /*
   * Boden, Mauern, Säulen, Laternen und der Garten daneben stehen still. Jeder
   * Raum liegt deshalb fertig gemalt in einer Leinwand – so breit wie das
   * Bild, so hoch wie ein Raum mit seiner unteren Mauer – und wird jedes Bild
   * nur kopiert. Gemalt wird ein Raum erst, wenn er ins Bild kommt; höchstens
   * fünf liegen im Speicher. Die Farben der stehenden Zeit (kühl, blass)
   * kommen als Überzug dazu, nicht als zweites Bild.
   */
  const bilder = { schluessel: "", map: new Map() };

  function leinwand(w, h, q) {
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.ceil(w * q));
    c.height = Math.max(1, Math.ceil(h * q));
    const cg = c.getContext("2d");
    cg.scale(q, q);
    return { c, g: cg };
  }

  function raumBild(k) {
    const schluessel = `${view.cssW}|${view.cssH}|${view.dpr}|${view.s}`;
    if (bilder.schluessel !== schluessel) {
      bilder.schluessel = schluessel;
      bilder.map.clear();
    }
    let b = bilder.map.get(k);
    if (b) return b;
    if (bilder.map.size >= 5) {
      // Der am weitesten entfernte Raum macht Platz.
      let weit = null;
      for (const kk of bilder.map.keys()) if (weit === null || Math.abs(kk - state.raum) > Math.abs(weit - state.raum)) weit = kk;
      bilder.map.delete(weit);
    }
    b = maleRaum(k);
    bilder.map.set(k, b);
    return b;
  }

  const PLANKEN = ["#6a4a36", "#74533d", "#634431", "#7a5841", "#6c4c37"];
  const STEINE = ["#596070", "#626a7a", "#545a68", "#69707d", "#5d6371"];

  function maleRaum(k) {
    const s = view.s;
    const xb = view.xb;
    const W = 2 * xb * s;
    const H = SCHRITT * s;
    const q = Math.min(view.dpr, Math.sqrt(2.6e6 / Math.max(1, W * H)));
    const { c, g: cg } = leinwand(W, H, q);
    const y0 = k * SCHRITT;
    const X = (x) => (x + xb) * s;
    const Y = (y) => (y0 + RAUM_H - y) * s;

    maleGarten(cg, k, X, Y, s, xb, y0 - WAND, y0 + RAUM_H);
    if (k < 0) return { c, k };
    raumBis(k);
    const r = state.raeume[k];

    // Der Boden des Hofs.
    cg.save();
    cg.beginPath();
    cg.rect(X(-HALB), Y(y0 + RAUM_H), 2 * HALB * s, RAUM_H * s);
    cg.clip();
    maleBoden(cg, r, X, Y, s);
    // Licht und Schatten: Der Mond steht oben links – die Mauern werfen
    // ihren Schatten nach unten rechts. Und die Laternen leuchten warm.
    const schatten = (x0, yA, x1, yB, gx0, gy0, gx1, gy1, staerke) => {
      const v = cg.createLinearGradient(gx0, gy0, gx1, gy1);
      v.addColorStop(0, `rgba(4, 8, 22, ${staerke})`);
      v.addColorStop(1, "rgba(4, 8, 22, 0)");
      cg.fillStyle = v;
      cg.fillRect(x0, yA, x1 - x0, yB - yA);
    };
    schatten(X(-HALB), Y(y0 + RAUM_H), X(HALB), Y(y0 + RAUM_H - 22), 0, Y(y0 + RAUM_H), 0, Y(y0 + RAUM_H - 22), 0.55);
    schatten(X(-HALB), Y(y0 + RAUM_H), X(-HALB + 18), Y(y0), X(-HALB), 0, X(-HALB + 18), 0, 0.5);
    schatten(X(HALB - 8), Y(y0 + RAUM_H), X(HALB), Y(y0), X(HALB), 0, X(HALB - 8), 0, 0.32);
    schatten(X(-HALB), Y(y0 + 8), X(HALB), Y(y0), 0, Y(y0), 0, Y(y0 + 8), 0.3);
    for (const c2 of r.kreise) {
      if (c2.art === "wache") continue;
      cg.fillStyle = "rgba(4, 8, 22, 0.42)";
      cg.beginPath();
      cg.ellipse(X(c2.x + c2.r * 0.45), Y(y0 + c2.y - c2.r * 0.55), c2.r * s * 1.05, c2.r * s * 0.95, -0.6, 0, PI2);
      cg.fill();
    }
    for (const q2 of r.stuecke) {
      cg.fillStyle = "rgba(4, 8, 22, 0.4)";
      cg.fillRect(X(q2[0] + 4), Y(y0 + q2[1]), (q2[2] - q2[0]) * s, 6 * s);
    }
    cg.globalCompositeOperation = "lighter";
    {
      // Mondlicht von oben links.
      const mond = cg.createRadialGradient(X(-HALB), Y(y0 + RAUM_H), 10, X(-HALB), Y(y0 + RAUM_H), 320 * s);
      mond.addColorStop(0, "rgba(150, 175, 235, 0.13)");
      mond.addColorStop(1, "rgba(150, 175, 235, 0)");
      cg.fillStyle = mond;
      cg.fillRect(X(-HALB), Y(y0 + RAUM_H), 2 * HALB * s, RAUM_H * s);
    }
    for (const l of r.laternen) {
      const lx = X(l.x - Math.sign(l.x) * 5);
      const ly = Y(y0 + l.y);
      const rad = 74 * s;
      const hof = cg.createRadialGradient(lx, ly, 2, lx, ly, rad);
      hof.addColorStop(0, "rgba(255, 170, 90, 0.36)");
      hof.addColorStop(0.4, "rgba(255, 140, 70, 0.12)");
      hof.addColorStop(1, "rgba(255, 140, 70, 0)");
      cg.fillStyle = hof;
      cg.fillRect(lx - rad, ly - rad, rad * 2, rad * 2);
    }
    // Das Tor oben: ein Hauch Licht vom nächsten Hof.
    {
      const tx = X(r.torO);
      const ty = Y(y0 + RAUM_H);
      const rad = 46 * s;
      const hof = cg.createRadialGradient(tx, ty, 2, tx, ty, rad);
      hof.addColorStop(0, "rgba(150, 255, 190, 0.2)");
      hof.addColorStop(1, "rgba(150, 255, 190, 0)");
      cg.fillStyle = hof;
      cg.fillRect(tx - rad, ty - rad, rad * 2, rad * 2);
    }
    cg.globalCompositeOperation = "source-over";
    cg.restore();

    // Die Rahmen der Fallen (die Klappen malt das Bild, sie bewegen sich).
    for (const f of r.fallen) {
      cg.fillStyle = "#1c1f26";
      cg.fillRect(X(f.x0), Y(y0 + f.y0 + f.h), f.b * s, f.h * s);
    }

    // Die Mauern: unten (mit dem Tor, durch das er kam), links, rechts.
    maleMauer(cg, X, Y, s, -HALB - WAND, y0 - WAND, r.torU - TOR / 2, y0, true);
    maleMauer(cg, X, Y, s, r.torU + TOR / 2, y0 - WAND, HALB + WAND, y0, true);
    maleTorrahmen(cg, X, Y, s, r.torU, y0);
    maleMauer(cg, X, Y, s, -HALB - WAND, y0 - WAND, -HALB, y0 + RAUM_H, false);
    maleMauer(cg, X, Y, s, HALB, y0 - WAND, HALB + WAND, y0 + RAUM_H, false);
    for (const q2 of r.stuecke) maleMauer(cg, X, Y, s, q2[0], y0 + q2[1], q2[2], y0 + q2[3], true, true);

    // Säulen und Pfosten.
    for (const c2 of r.saeulen) maleSaeule(cg, X(c2.x), Y(y0 + c2.y), c2.r * s, c2.art, s);
    for (const b of r.klingen) maleSaeule(cg, X(b.x), Y(y0 + b.y), b.post * s, "pfosten", s);

    // Die Laternen an den Mauern: rotes Papier, schwarze Ringe.
    for (const l of r.laternen) {
      const lx = X(l.x - Math.sign(l.x) * 3.5);
      const ly = Y(y0 + l.y);
      cg.fillStyle = "rgba(0, 0, 0, 0.35)";
      cg.beginPath();
      cg.ellipse(lx + 1.5 * s, ly + 1.5 * s, 3.6 * s, 4.6 * s, 0, 0, PI2);
      cg.fill();
      const papier = cg.createRadialGradient(lx, ly, 0.5, lx, ly, 4.6 * s);
      papier.addColorStop(0, "#ffe2a6");
      papier.addColorStop(0.55, "#ff8a4a");
      papier.addColorStop(1, "#b8322a");
      cg.fillStyle = papier;
      cg.beginPath();
      cg.ellipse(lx, ly, 3.4 * s, 4.4 * s, 0, 0, PI2);
      cg.fill();
      cg.fillStyle = "#1b1416";
      cg.fillRect(lx - 2.4 * s, ly - 4.6 * s, 4.8 * s, 1.1 * s);
      cg.fillRect(lx - 2.4 * s, ly + 3.5 * s, 4.8 * s, 1.1 * s);
    }
    return { c, k };
  }

  function maleBoden(cg, r, X, Y, s) {
    const y0 = r.y0;
    const k = r.k;
    const links = X(-HALB);
    const oben = Y(y0 + RAUM_H);
    const breit = 2 * HALB * s;
    const hoch = RAUM_H * s;
    if (r.boden === "holz") {
      // Dielen, der Länge nach, mit versetzten Stössen und Maserung.
      cg.fillStyle = "#2f2119";
      cg.fillRect(links, oben, breit, hoch);
      const B = 12;
      for (let i = 0; i < 20; i += 1) {
        const x = -HALB + i * B;
        let y = y0 - hash01(k * 31.7 + i * 1.3) * 70;
        for (let n = 0; y < y0 + RAUM_H && n < 12; n += 1) {
          const lang = 48 + hash01(k * 17.3 + i * 3.1 + n * 7.7) * 92;
          const ton = hash01(k * 5.3 + i * 1.7 + n * 2.9);
          cg.fillStyle = PLANKEN[Math.floor(ton * PLANKEN.length)];
          cg.fillRect(X(x) + 0.45 * s, Y(y + lang) + 0.45 * s, (B - 0.9) * s, (lang - 0.9) * s);
          // Maserung: feine helle und dunkle Linien.
          cg.lineWidth = Math.max(0.5, 0.35 * s);
          for (let m = 0; m < 3; m += 1) {
            const mx = x + 2.5 + m * 3.4 + hash01(i * 9.1 + n * 4.3 + m) * 1.5;
            cg.strokeStyle = m % 2 ? "rgba(0, 0, 0, 0.16)" : "rgba(255, 220, 180, 0.06)";
            cg.beginPath();
            cg.moveTo(X(mx), Y(y + 1));
            const welle = hash01(i * 2.7 + n + m * 3.3) * 2 - 1;
            cg.bezierCurveTo(X(mx + welle), Y(y + lang * 0.33), X(mx - welle), Y(y + lang * 0.66), X(mx + welle * 0.5), Y(y + lang - 1));
            cg.stroke();
          }
          if (hash01(i * 13.1 + n * 5.9 + k) < 0.25) {
            cg.fillStyle = "rgba(20, 10, 6, 0.35)";
            cg.beginPath();
            cg.ellipse(X(x + B / 2 + (hash01(i + n) - 0.5) * 5), Y(y + lang * hash01(n * 3.3 + i)), 1.2 * s, 2 * s, 0, 0, PI2);
            cg.fill();
          }
          // Nägel an den Enden.
          cg.fillStyle = "rgba(10, 8, 6, 0.6)";
          for (const ny of [y + 2.5, y + lang - 2.5]) {
            cg.beginPath();
            cg.arc(X(x + 3), Y(ny), 0.55 * s, 0, PI2);
            cg.arc(X(x + B - 3), Y(ny), 0.55 * s, 0, PI2);
            cg.fill();
          }
          y += lang;
        }
      }
    } else if (r.boden === "kies") {
      // Geharkter Kies, um Säulen und Pfosten in Kreisen.
      cg.fillStyle = "#4a5366";
      cg.fillRect(links, oben, breit, hoch);
      cg.lineWidth = Math.max(0.6, 0.85 * s);
      for (let y = y0 + 2; y < y0 + RAUM_H; y += 3.4) {
        const n = Math.round((y - y0) / 3.4);
        cg.strokeStyle = n % 2 ? "rgba(0, 0, 0, 0.28)" : "rgba(220, 232, 255, 0.13)";
        cg.beginPath();
        for (let x = -HALB; x <= HALB; x += 8) {
          const yy = y + Math.sin(x * 0.045 + y * 0.013 + k) * 0.9;
          if (x === -HALB) cg.moveTo(X(x), Y(yy));
          else cg.lineTo(X(x), Y(yy));
        }
        cg.stroke();
      }
      const ringe = r.kreise.filter((c2) => c2.art !== "wache");
      for (const c2 of ringe) {
        cg.fillStyle = "#4a5366";
        cg.beginPath();
        cg.arc(X(c2.x), Y(y0 + c2.y), (c2.r + 15) * s, 0, PI2);
        cg.fill();
        for (let m = 0; m < 4; m += 1) {
          cg.strokeStyle = m % 2 ? "rgba(0, 0, 0, 0.3)" : "rgba(220, 232, 255, 0.14)";
          cg.beginPath();
          cg.arc(X(c2.x), Y(y0 + c2.y), (c2.r + 3.5 + m * 3.4) * s, 0, PI2);
          cg.stroke();
        }
      }
      // Einzelne Steinchen.
      for (let n = 0; n < 90; n += 1) {
        const x = -HALB + hash01(k * 3.3 + n * 1.7) * 2 * HALB;
        const y = y0 + hash01(k * 5.1 + n * 2.3) * RAUM_H;
        cg.fillStyle = n % 3 ? "rgba(220, 228, 245, 0.14)" : "rgba(0, 0, 0, 0.25)";
        cg.beginPath();
        cg.arc(X(x), Y(y), (0.5 + hash01(n * 7.7) * 0.7) * s, 0, PI2);
        cg.fill();
      }
    } else {
      // Steinplatten mit Fugen und etwas Moos.
      cg.fillStyle = "#2a2f38";
      cg.fillRect(links, oben, breit, hoch);
      const PB = 24;
      const PH = 20;
      for (let j = 0; j * PH < RAUM_H + PH; j += 1) {
        const versatz = j % 2 ? PB / 2 : 0;
        for (let i = -1; i * PB < 2 * HALB + PB; i += 1) {
          const x0 = -HALB + i * PB + versatz;
          const y = y0 + j * PH;
          const h = (a) => (hash01(k * 1.9 + i * 3.7 + j * 5.3 + a * 1.1) - 0.5) * 2.2;
          const ton = hash01(k * 2.3 + i * 7.1 + j * 1.3);
          cg.fillStyle = STEINE[Math.floor(ton * STEINE.length)];
          cg.beginPath();
          cg.moveTo(X(x0 + 0.9 + h(1)), Y(y + 0.9 + h(2)));
          cg.lineTo(X(x0 + PB - 0.9 + h(3)), Y(y + 0.9 + h(4)));
          cg.lineTo(X(x0 + PB - 0.9 + h(5)), Y(y + PH - 0.9 + h(6)));
          cg.lineTo(X(x0 + 0.9 + h(7)), Y(y + PH - 0.9 + h(8)));
          cg.closePath();
          cg.fill();
          cg.strokeStyle = "rgba(255, 255, 255, 0.05)";
          cg.lineWidth = Math.max(0.5, 0.6 * s);
          cg.beginPath();
          cg.moveTo(X(x0 + 1.5 + h(7)), Y(y + PH - 1.5 + h(8)));
          cg.lineTo(X(x0 + PB - 1.5 + h(5)), Y(y + PH - 1.5 + h(6)));
          cg.stroke();
          if (ton < 0.18) {
            cg.fillStyle = "rgba(70, 110, 70, 0.35)";
            cg.beginPath();
            cg.ellipse(X(x0 + 1 + h(1)), Y(y + PH / 2), 1.8 * s, 3.5 * s, 0, 0, PI2);
            cg.fill();
          }
        }
      }
    }
  }

  // Eine Mauer von oben: ein Dach aus runden Ziegeln mit First in der Mitte,
  // am Rand ein Streifen weisser Putz.
  function maleMauer(cg, X, Y, s, x0, ya, x1, yb, waagrecht, stueck = false) {
    if (x1 - x0 < 0.5 || yb - ya < 0.5) return;
    const l = X(x0);
    const o = Y(yb);
    const b = (x1 - x0) * s;
    const h = (yb - ya) * s;
    cg.fillStyle = "#9a978d";
    cg.fillRect(l, o, b, h);
    const putz = 2.2 * s;
    cg.fillStyle = "#1f2532";
    if (waagrecht) cg.fillRect(l, o + putz, b, h - 2 * putz);
    else cg.fillRect(l + putz, o, b - 2 * putz, h);
    // Die Ziegelreihen quer zum First.
    cg.lineWidth = Math.max(0.6, 0.9 * s);
    cg.strokeStyle = "rgba(120, 135, 165, 0.22)";
    cg.beginPath();
    if (waagrecht) {
      for (let x = x0 + 1.6; x < x1; x += 3.2) {
        cg.moveTo(X(x), o + putz + 0.5);
        cg.lineTo(X(x), o + h - putz - 0.5);
      }
    } else {
      for (let y = ya + 1.6; y < yb; y += 3.2) {
        cg.moveTo(l + putz + 0.5, Y(y));
        cg.lineTo(l + b - putz - 0.5, Y(y));
      }
    }
    cg.stroke();
    // Der First.
    cg.fillStyle = "#3a4254";
    if (waagrecht) cg.fillRect(l, o + h / 2 - 1.4 * s, b, 2.8 * s);
    else cg.fillRect(l + b / 2 - 1.4 * s, o, 2.8 * s, h);
    cg.fillStyle = "rgba(190, 205, 235, 0.22)";
    if (waagrecht) cg.fillRect(l, o + h / 2 - 1.4 * s, b, 0.8 * s);
    else cg.fillRect(l + b / 2 - 1.4 * s, o, 0.8 * s, h);
    // Die Enden der Ziegel an der Traufe.
    cg.fillStyle = "#2c3343";
    if (waagrecht) {
      for (let x = x0 + 1.6; x < x1 - 0.5; x += 3.2) {
        cg.beginPath();
        cg.arc(X(x), o + putz + 0.9 * s, 1.1 * s, 0, PI2);
        cg.arc(X(x), o + h - putz - 0.9 * s, 1.1 * s, 0, PI2);
        cg.fill();
      }
    } else {
      for (let y = ya + 1.6; y < yb - 0.5; y += 3.2) {
        cg.beginPath();
        cg.arc(l + putz + 0.9 * s, Y(y), 1.1 * s, 0, PI2);
        cg.arc(l + b - putz - 0.9 * s, Y(y), 1.1 * s, 0, PI2);
        cg.fill();
      }
    }
    if (stueck) {
      // Ein Mauerstück im Hof: die Stirnseite mit Putz.
      cg.fillStyle = "#9a978d";
      if (x0 <= -HALB + 0.5) cg.fillRect(X(x1) - putz, o, putz, h);
      else cg.fillRect(X(x0), o, putz, h);
    }
  }

  // Der Rahmen eines Tors: Schwelle aus Stein, Pfosten aus rotem Holz.
  function maleTorrahmen(cg, X, Y, s, tx, y0) {
    const l = X(tx - TOR / 2);
    const o = Y(y0);
    cg.fillStyle = "#4e4c49";
    cg.fillRect(l, o, TOR * s, WAND * s);
    cg.strokeStyle = "rgba(0, 0, 0, 0.3)";
    cg.lineWidth = Math.max(0.5, 0.7 * s);
    cg.beginPath();
    for (let x = tx - TOR / 2 + 7.6; x < tx + TOR / 2; x += 7.6) {
      cg.moveTo(X(x), o);
      cg.lineTo(X(x), o + WAND * s);
    }
    cg.stroke();
    for (const seite of [-1, 1]) {
      const px = X(tx + seite * (TOR / 2 + 1.2));
      cg.fillStyle = "rgba(0, 0, 0, 0.35)";
      cg.fillRect(px - 2.6 * s + 1.2 * s, o - 1 * s + 1.2 * s, 5.2 * s, (WAND + 2) * s);
      cg.fillStyle = "#7a2b1f";
      cg.fillRect(px - 2.6 * s, o - 1 * s, 5.2 * s, (WAND + 2) * s);
      cg.fillStyle = "rgba(255, 180, 140, 0.18)";
      cg.fillRect(px - 2.6 * s, o - 1 * s, 1.2 * s, (WAND + 2) * s);
    }
  }

  function maleSaeule(cg, x, y, rad, art, s) {
    cg.save();
    if (art === "stein") {
      cg.fillStyle = "#5c6068";
      cg.beginPath();
      for (let i = 0; i < 8; i += 1) {
        const a = (i / 8) * PI2 + Math.PI / 8;
        const px = x + Math.cos(a) * rad;
        const py = y + Math.sin(a) * rad;
        if (i) cg.lineTo(px, py); else cg.moveTo(px, py);
      }
      cg.closePath();
      cg.fill();
      const licht = cg.createLinearGradient(x - rad, y - rad, x + rad, y + rad);
      licht.addColorStop(0, "rgba(255, 255, 255, 0.18)");
      licht.addColorStop(1, "rgba(0, 0, 0, 0.3)");
      cg.fillStyle = licht;
      cg.fill();
      cg.strokeStyle = "rgba(0, 0, 0, 0.35)";
      cg.lineWidth = Math.max(0.6, 0.6 * s);
      cg.beginPath();
      cg.arc(x, y, rad * 0.55, 0, PI2);
      cg.stroke();
      cg.fillStyle = "rgba(80, 120, 80, 0.4)";
      cg.beginPath();
      cg.ellipse(x + rad * 0.4, y + rad * 0.5, rad * 0.35, rad * 0.22, 0.5, 0, PI2);
      cg.fill();
    } else {
      const holz = art === "pfosten";
      const grund = cg.createRadialGradient(x - rad * 0.35, y - rad * 0.35, rad * 0.1, x, y, rad);
      grund.addColorStop(0, holz ? "#6a5a52" : "#8a5a3c");
      grund.addColorStop(1, holz ? "#2a2524" : "#4a2c1d");
      cg.fillStyle = grund;
      cg.beginPath();
      cg.arc(x, y, rad, 0, PI2);
      cg.fill();
      cg.strokeStyle = holz ? "rgba(200, 210, 230, 0.35)" : "rgba(0, 0, 0, 0.3)";
      cg.lineWidth = Math.max(0.6, (holz ? 1.1 : 0.5) * s);
      for (let m = 1; m <= (holz ? 1 : 3); m += 1) {
        cg.beginPath();
        cg.arc(x, y, rad * (holz ? 0.82 : m * 0.25), 0, PI2);
        cg.stroke();
      }
      if (holz) {
        cg.fillStyle = "#c9cfdb";
        cg.beginPath();
        cg.arc(x, y, rad * 0.28, 0, PI2);
        cg.fill();
      }
    }
    cg.restore();
  }

  // Der Garten um den Hof: Moos, Steine, Büsche, Kirschbäume, Steinlaternen,
  // ab und zu ein Teich. Alles in Feldern, die genau in einen Raum passen,
  // damit die Bilder der Räume nahtlos aneinanderstossen.
  function maleGarten(cg, k, X, Y, s, xb, yu, yo) {
    cg.fillStyle = "#16231f";
    cg.fillRect(X(-xb), Y(yo), 2 * xb * s, (yo - yu) * s);
    // Moos in Flecken.
    for (let n = 0; n < 70; n += 1) {
      const x = -xb + hash01(k * 9.1 + n * 1.3) * 2 * xb;
      const y = yu + hash01(k * 4.7 + n * 2.9) * (yo - yu);
      cg.fillStyle = n % 2 ? "rgba(40, 70, 52, 0.45)" : "rgba(28, 46, 40, 0.6)";
      cg.beginPath();
      cg.ellipse(X(x), Y(y), (6 + hash01(n * 3.1 + k) * 14) * s, (4 + hash01(n * 5.3) * 8) * s, hash01(n) * 3, 0, PI2);
      cg.fill();
    }
    if (k < 0) {
      // Der Vorhof: ein Weg aus Trittsteinen hinauf zum ersten Tor, links und
      // rechts eine Steinlaterne, davor ein rotes Tor.
      for (let y = yo - 8; y > yu; y -= 15) {
        const x = Math.sin(y * 0.05) * 6;
        cg.fillStyle = "rgba(0, 0, 0, 0.35)";
        cg.beginPath();
        cg.ellipse(X(x + 1.2), Y(y - 1.2), 9 * s, 5.5 * s, 0, 0, PI2);
        cg.fill();
        cg.fillStyle = "#5a5e66";
        cg.beginPath();
        cg.ellipse(X(x), Y(y), 9 * s, 5.5 * s, 0, 0, PI2);
        cg.fill();
      }
      if (k === -1) {
        steinlaterne(cg, X(-40), Y(yo - 40), s);
        steinlaterne(cg, X(40), Y(yo - 40), s);
        // Das rote Tor (Torii) von oben: zwei Pfosten, ein Balken quer.
        const ty = Y(yo - 110);
        cg.fillStyle = "rgba(0, 0, 0, 0.4)";
        cg.fillRect(X(-46) + 3 * s, ty - 4 * s + 3 * s, 92 * s, 8 * s);
        cg.fillStyle = "#a8291f";
        cg.fillRect(X(-46), ty - 4 * s, 92 * s, 8 * s);
        cg.fillStyle = "#1c1416";
        cg.fillRect(X(-50), ty - 4 * s, 100 * s, 2.4 * s);
        cg.fillStyle = "#c63a2c";
        for (const x of [-30, 30]) {
          cg.beginPath();
          cg.arc(X(x), ty + 2 * s, 3.6 * s, 0, PI2);
          cg.fill();
        }
      }
    }
    // Felder links und rechts der Mauern (im Vorhof überall ausser am Weg).
    const zeilen = 4;
    const zh = (yo - yu) / zeilen;
    const ab = k < 0 ? 22 : HALB + WAND + 4;
    for (const seite of [-1, 1]) {
      for (let spalte = 0; ab + spalte * 64 < xb + 30; spalte += 1) {
        const xa = ab + spalte * 64;
        for (let zeile = 0; zeile < zeilen; zeile += 1) {
          const h = (a) => hash01(k * 13.7 + seite * 5.1 + spalte * 3.3 + zeile * 7.9 + a * 1.37);
          const cx = seite * (xa + 14 + h(1) * 36);
          const cy = yu + zeile * zh + zh * (0.3 + h(2) * 0.4);
          const wahl = h(3);
          if (k < 0 && Math.abs(cx) < 70 && cy > yo - 130) continue;
          if (wahl < 0.2) kirschbaum(cg, X(cx), Y(cy), s, Math.min(zh * 0.42, 22 + h(4) * 10), k * 31 + spalte * 7 + zeile + seite);
          else if (wahl < 0.3) steinlaterne(cg, X(cx), Y(cy), s);
          else if (wahl < 0.6) busch(cg, X(cx), Y(cy), s, 8 + h(5) * 8, k * 17 + spalte * 3 + zeile * 5 + seite);
          else if (wahl < 0.68) teich(cg, X(cx), Y(cy), s, Math.min(zh * 0.36, 16 + h(6) * 8));
          else if (wahl < 0.82) {
            for (let n = 0; n < 3; n += 1) {
              cg.fillStyle = "#4b4f57";
              cg.beginPath();
              cg.ellipse(X(cx + (n - 1) * 9), Y(cy + Math.sin(n * 2 + h(7) * 6) * 5), 4.5 * s, 3.2 * s, h(n) * 3, 0, PI2);
              cg.fill();
            }
          }
        }
      }
    }
  }

  function kirschbaum(cg, x, y, s, rad, nr) {
    cg.fillStyle = "rgba(0, 0, 0, 0.45)";
    cg.beginPath();
    cg.ellipse(x + rad * 0.3 * s, y + rad * 0.3 * s, rad * s * 1.05, rad * s * 0.95, 0, 0, PI2);
    cg.fill();
    cg.strokeStyle = "#3a2420";
    cg.lineCap = "round";
    for (let i = 0; i < 5; i += 1) {
      const a = hash01(nr * 3.1 + i) * PI2;
      cg.lineWidth = (2.6 - i * 0.3) * s;
      cg.beginPath();
      cg.moveTo(x, y);
      cg.lineTo(x + Math.cos(a) * rad * 0.7 * s, y + Math.sin(a) * rad * 0.7 * s);
      cg.stroke();
    }
    const farben = ["#7d3a55", "#b65a7a", "#de86a6", "#f2a9c3", "#ffd0df"];
    for (let schicht = 0; schicht < 5; schicht += 1) {
      cg.fillStyle = farben[schicht];
      const anzahl = 9 - schicht;
      for (let i = 0; i < anzahl; i += 1) {
        const a = hash01(nr * 7.7 + i * 2.1 + schicht) * PI2;
        const d = hash01(nr * 5.3 + i * 1.9 + schicht * 3) * rad * (0.75 - schicht * 0.1);
        const rr = rad * (0.42 - schicht * 0.05) * (0.8 + hash01(i + schicht * 9) * 0.4);
        cg.beginPath();
        cg.arc(x + (Math.cos(a) * d - schicht * 1.2) * s, y + (Math.sin(a) * d - schicht * 1.2) * s, rr * s, 0, PI2);
        cg.fill();
      }
    }
  }

  function steinlaterne(cg, x, y, s) {
    cg.fillStyle = "rgba(0, 0, 0, 0.45)";
    cg.fillRect(x - 5 * s + 2 * s, y - 5 * s + 2 * s, 10 * s, 10 * s);
    cg.save();
    cg.globalCompositeOperation = "lighter";
    const hof = cg.createRadialGradient(x, y, 1, x, y, 34 * s);
    hof.addColorStop(0, "rgba(255, 190, 110, 0.4)");
    hof.addColorStop(1, "rgba(255, 150, 80, 0)");
    cg.fillStyle = hof;
    cg.fillRect(x - 34 * s, y - 34 * s, 68 * s, 68 * s);
    cg.restore();
    cg.fillStyle = "#6f7177";
    cg.beginPath();
    cg.moveTo(x - 7 * s, y);
    cg.lineTo(x, y - 7 * s);
    cg.lineTo(x + 7 * s, y);
    cg.lineTo(x, y + 7 * s);
    cg.closePath();
    cg.fill();
    cg.fillStyle = "#8a8c92";
    cg.fillRect(x - 3.6 * s, y - 3.6 * s, 7.2 * s, 7.2 * s);
    cg.fillStyle = "#ffd28a";
    cg.fillRect(x - 1.8 * s, y - 1.8 * s, 3.6 * s, 3.6 * s);
  }

  function busch(cg, x, y, s, rad, nr) {
    cg.fillStyle = "rgba(0, 0, 0, 0.4)";
    cg.beginPath();
    cg.ellipse(x + 2 * s, y + 2 * s, rad * s, rad * s * 0.85, 0, 0, PI2);
    cg.fill();
    const farben = ["#1d3427", "#26442f", "#2f5338"];
    for (let schicht = 0; schicht < 3; schicht += 1) {
      cg.fillStyle = farben[schicht];
      for (let i = 0; i < 5; i += 1) {
        const a = hash01(nr * 2.3 + i * 1.7 + schicht) * PI2;
        const d = rad * 0.45 * hash01(nr + i * 3.1);
        cg.beginPath();
        cg.arc(x + (Math.cos(a) * d - schicht) * s, y + (Math.sin(a) * d - schicht) * s, rad * (0.55 - schicht * 0.1) * s, 0, PI2);
        cg.fill();
      }
    }
  }

  function teich(cg, x, y, s, rad) {
    cg.fillStyle = "#3d4048";
    cg.beginPath();
    cg.ellipse(x, y, (rad + 2.5) * s, (rad * 0.7 + 2.5) * s, 0.2, 0, PI2);
    cg.fill();
    const wasser = cg.createRadialGradient(x - rad * 0.3 * s, y - rad * 0.2 * s, 1, x, y, rad * s);
    wasser.addColorStop(0, "#1f3a52");
    wasser.addColorStop(1, "#0a1522");
    cg.fillStyle = wasser;
    cg.beginPath();
    cg.ellipse(x, y, rad * s, rad * 0.7 * s, 0.2, 0, PI2);
    cg.fill();
    // Der Mond im Wasser.
    cg.fillStyle = "rgba(225, 235, 255, 0.55)";
    cg.beginPath();
    cg.ellipse(x - rad * 0.3 * s, y - rad * 0.15 * s, 3 * s, 2.2 * s, 0.2, 0, PI2);
    cg.fill();
    cg.fillStyle = "#2f6a3a";
    cg.beginPath();
    cg.arc(x + rad * 0.4 * s, y + rad * 0.2 * s, 2.4 * s, 0.4, PI2);
    cg.fill();
    cg.fillStyle = "#f08a3a";
    cg.beginPath();
    cg.ellipse(x + rad * 0.1 * s, y + rad * 0.3 * s, 1.8 * s, 0.8 * s, 0.6, 0, PI2);
    cg.fill();
  }

  // Die Vignette: dunkle Ränder, einmal gemalt.
  const vignette = { schluessel: "", c: null };
  function vignetteBild() {
    const schluessel = `${view.cssW}|${view.cssH}|${view.dpr}`;
    if (vignette.schluessel === schluessel) return vignette.c;
    vignette.schluessel = schluessel;
    const W = view.cssW;
    const H = view.cssH;
    const { c, g: cg } = leinwand(W, H, view.dpr);
    const v = cg.createRadialGradient(W / 2, view.my, Math.min(W, H) * 0.3, W / 2, view.my, Math.hypot(W, H) * 0.62);
    v.addColorStop(0, "rgba(0, 0, 0, 0)");
    v.addColorStop(1, "rgba(2, 4, 12, 0.48)");
    cg.fillStyle = v;
    cg.fillRect(0, 0, W, H);
    vignette.c = c;
    return c;
  }

  // ---------------------------------------------------------------------------
  // Zeichnen
  // ---------------------------------------------------------------------------
  // Welche Räume gerade im Bild stehen (mit dem Vorhof als -1).
  function raeumeImBild() {
    const oben = kam.y + view.my / view.s;
    const unten = kam.y - (view.cssH - view.my) / view.s;
    const von = Math.floor((unten + WAND) / SCHRITT);
    const bis = Math.floor((oben + WAND) / SCHRITT);
    return [Math.max(-2, von), bis];
  }

  /*
   * Die Kulisse: alles, was gerade stillsteht – die Räume im Bild, im
   * nächsten Raum, was kommt (Fallen, Klingen, Wächter und Schützen, noch
   * reglos), im vorigen, wie es zuletzt war, und das Halbdunkel über beiden.
   * Steht die Kamera, liegt das fertig in einer Leinwand von der Grösse des
   * Bildes: Jedes Bild beginnt mit einem einzigen Kopieren, ohne Skalieren.
   * Nur während des Schwenks wird sie Bild für Bild neu gemalt.
   */
  const kulisse = { c: null, schluessel: "" };

  function maleKulisse(von, bis) {
    const s = view.s;
    for (let k = von; k <= bis; k += 1) {
      const b = raumBild(k);
      g.drawImage(b.c, bildX(-view.xb), bildY(k * SCHRITT + RAUM_H), 2 * view.xb * s, SCHRITT * s);
    }
    const nachbar = state.raeume[state.raum + 1];
    const vorher = state.raeume[state.raum - 1];
    if (vorher) {
      zeichneFallen(vorher, vorher.tauStand, 0.85);
      zeichneKlingen(vorher, vorher.tauStand, 0.85, false);
    }
    if (nachbar) {
      zeichneFallen(nachbar, 0, 0.85);
      zeichneKlingen(nachbar, 0, 0.85, false);
      zeichneKegel(nachbar, 0, 0.35);
      zeichneWachen(nachbar, 0);
      zeichneSchuetzen(nachbar, 0, false);
      zeichneTore(nachbar, false);
    }
    zeichneDaemmer(von, bis);
    // Die dunklen Ränder gehören zur Kulisse – ein Durchgang weniger je Bild.
    g.save();
    g.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
    g.drawImage(vignetteBild(), 0, 0, view.cssW, view.cssH);
    g.restore();
  }

  function zeichneHintergrund(von, bis) {
    raumBis(Math.max(0, bis + 1));
    const bewegt = Boolean(state.aus) || state.stoss > 0;
    if (kam.t < 1 || !g) {
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.fillStyle = "#0b0f18";
      g.fillRect(0, 0, canvas.width, canvas.height);
      bildTransform();
      maleKulisse(von, bis);
      return;
    }
    const schluessel = `${bilder.schluessel}|${view.my}|${view.versatz}|${kam.y}|${state.raum}|${von}|${bis}|${state.raeume[state.raum - 1]?.tauStand ?? ""}`;
    if (!kulisse.c || kulisse.c.width !== canvas.width || kulisse.c.height !== canvas.height || kulisse.schluessel !== schluessel) {
      if (!kulisse.c) kulisse.c = document.createElement("canvas");
      kulisse.c.width = canvas.width;
      kulisse.c.height = canvas.height;
      kulisse.schluessel = schluessel;
      const haupt = g;
      g = kulisse.c.getContext("2d");
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.fillStyle = "#0b0f18";
      g.fillRect(0, 0, canvas.width, canvas.height);
      g.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
      maleKulisse(von, bis);
      g = haupt;
    }
    g.setTransform(1, 0, 0, 1, 0, 0);
    if (bewegt) {
      g.fillStyle = "#0b0f18";
      g.fillRect(0, 0, canvas.width, canvas.height);
      bildTransform();
      g.drawImage(kulisse.c, 0, 0, view.cssW, view.cssH);
    } else {
      g.drawImage(kulisse.c, 0, 0);
    }
  }

  // Die Klappen der Fallen: zu (Holz, Eisen), kurz vor dem Öffnen knarrend
  // und rot glimmend, offen ein Loch mit Spitzen.
  function zeichneFallen(r, tau, alpha = 1) {
    const s = view.s;
    for (const f of r.fallen) {
      const u = fallenU(f, tau);
      const auf = 1 - f.offen;
      const warn = auf - WARNEN / f.P;
      const x = bildX(f.x0);
      const y = bildY(r.y0 + f.y0 + f.h);
      const w = f.b * s;
      const h = f.h * s;
      g.globalAlpha = alpha;
      if (u >= auf) {
        // Offen: das Loch, die Spitzen, die Klappen hängen an den Seiten.
        const k = (u - auf) / f.offen;
        const klappe = k < 0.12 ? 1 - k / 0.12 : k > 0.9 ? (k - 0.9) / 0.1 : 0;
        g.fillStyle = "#040507";
        g.fillRect(x + 1.2 * s, y + 1.2 * s, w - 2.4 * s, h - 2.4 * s);
        g.fillStyle = "rgba(200, 210, 225, 0.55)";
        for (let i = 0; i < 3; i += 1) {
          for (let j = 0; j < 3; j += 1) {
            const px = x + w * (0.22 + i * 0.28);
            const py = y + h * (0.22 + j * 0.28);
            g.beginPath();
            g.moveTo(px, py - 2 * s);
            g.lineTo(px + 1.4 * s, py + 1.2 * s);
            g.lineTo(px - 1.4 * s, py + 1.2 * s);
            g.closePath();
            g.fill();
          }
        }
        const kw = (w / 2 - 1.2 * s) * klappe + 1.6 * s;
        g.fillStyle = "#4a3022";
        g.fillRect(x + 1.2 * s, y + 1.2 * s, kw, h - 2.4 * s);
        g.fillRect(x + w - 1.2 * s - kw, y + 1.2 * s, kw, h - 2.4 * s);
      } else {
        let jx = 0;
        let glimm = 0;
        if (u >= warn) {
          glimm = (u - warn) / (auf - warn);
          if (!ruhig()) jx = Math.sin(state.echt * 70 + f.x0) * 0.5 * s * glimm;
        }
        g.fillStyle = "#4e3324";
        g.fillRect(x + 1.2 * s + jx, y + 1.2 * s, w - 2.4 * s, h - 2.4 * s);
        g.fillStyle = "rgba(255, 220, 180, 0.07)";
        g.fillRect(x + 1.2 * s + jx, y + 1.2 * s, w - 2.4 * s, 1.2 * s);
        g.fillStyle = "#1d1410";
        g.fillRect(x + w / 2 - 0.5 * s + jx, y + 1.2 * s, 1 * s, h - 2.4 * s);
        g.fillStyle = "#2a2f38";
        g.fillRect(x + 1.2 * s + jx, y + h * 0.25, w - 2.4 * s, 1.6 * s);
        g.fillRect(x + 1.2 * s + jx, y + h * 0.7, w - 2.4 * s, 1.6 * s);
        g.fillStyle = "#8a93a3";
        for (const px of [0.18, 0.82]) {
          for (const py of [0.28, 0.73]) {
            g.beginPath();
            g.arc(x + w * px + jx, y + h * py, 0.8 * s, 0, PI2);
            g.fill();
          }
        }
        if (glimm > 0) {
          g.strokeStyle = `rgba(255, ${Math.round(110 - 60 * glimm)}, 50, ${0.25 + 0.6 * glimm})`;
          g.lineWidth = Math.max(1, 1.2 * s);
          g.strokeRect(x + 1.5 * s + jx, y + 1.5 * s, w - 3 * s, h - 3 * s);
        }
      }
    }
    g.globalAlpha = 1;
  }

  // Die Kegel der Wächter: warmes Licht – oder rot, wenn sie Alarm schlagen.
  // Hinter Säulen liegt Schatten.
  function zeichneKegel(r, tau, alpha = 1) {
    const s = view.s;
    for (let i = 0; i < r.wachen.length; i += 1) {
      const w = r.wachen[i];
      const st = r === aktRaum() ? state.wachen[i] : null;
      const a = wachenWinkel(w, tau);
      const lx = laterneX(w, a);
      const ly = laterneY(w, a);
      const x = bildX(lx);
      const y = bildY(r.y0 + ly);
      const alarm = st && st.alarm > -9 ? clamp(1 - (tau - st.alarm) / 2.6, 0, 1) : 0;
      const R = w.R * s;
      g.save();
      g.globalAlpha = alpha;
      g.globalCompositeOperation = "lighter";
      const v = g.createRadialGradient(x, y, 2, x, y, R);
      const farbe = alarm > 0 ? `255, ${Math.round(210 - 150 * alarm)}, ${Math.round(120 - 80 * alarm)}` : "255, 214, 130";
      v.addColorStop(0, `rgba(${farbe}, 0.36)`);
      v.addColorStop(0.7, `rgba(${farbe}, 0.14)`);
      v.addColorStop(1, `rgba(${farbe}, 0)`);
      g.fillStyle = v;
      g.beginPath();
      g.moveTo(x, y);
      g.arc(x, y, R, -a - w.alpha, -a + w.alpha);
      g.closePath();
      g.fill();
      g.globalCompositeOperation = "source-over";
      // Die Ränder des Kegels, damit man ihn auch auf hellem Boden sieht.
      g.strokeStyle = alarm > 0 ? "rgba(255, 90, 60, 0.55)" : "rgba(255, 220, 140, 0.3)";
      g.lineWidth = Math.max(1, 0.8 * s);
      g.setLineDash([3 * s, 3 * s]);
      g.beginPath();
      g.moveTo(x + Math.cos(-a - w.alpha) * R * 0.15, y + Math.sin(-a - w.alpha) * R * 0.15);
      g.lineTo(x + Math.cos(-a - w.alpha) * R, y + Math.sin(-a - w.alpha) * R);
      g.moveTo(x + Math.cos(-a + w.alpha) * R * 0.15, y + Math.sin(-a + w.alpha) * R * 0.15);
      g.lineTo(x + Math.cos(-a + w.alpha) * R, y + Math.sin(-a + w.alpha) * R);
      g.stroke();
      g.setLineDash([]);
      // Schatten hinter Säulen und Pfosten.
      g.beginPath();
      g.moveTo(x, y);
      g.arc(x, y, R, -a - w.alpha, -a + w.alpha);
      g.closePath();
      g.clip();
      g.fillStyle = "rgba(8, 12, 24, 0.5)";
      for (const c of r.kreise) {
        if (c.art === "wache") continue;
        const dx = c.x - lx;
        const dy = c.y - ly;
        const d = Math.hypot(dx, dy);
        if (d > w.R + c.r || d <= c.r) continue;
        const mitte = Math.atan2(dy, dx);
        const halb = Math.asin(c.r / d);
        const p1 = mitte - halb;
        const p2 = mitte + halb;
        const t = Math.sqrt(d * d - c.r * c.r);
        g.beginPath();
        g.moveTo(bildX(lx + Math.cos(p1) * t), bildY(r.y0 + ly + Math.sin(p1) * t));
        g.lineTo(bildX(lx + Math.cos(p1) * (w.R + 20)), bildY(r.y0 + ly + Math.sin(p1) * (w.R + 20)));
        g.lineTo(bildX(lx + Math.cos(p2) * (w.R + 20)), bildY(r.y0 + ly + Math.sin(p2) * (w.R + 20)));
        g.lineTo(bildX(lx + Math.cos(p2) * t), bildY(r.y0 + ly + Math.sin(p2) * t));
        g.closePath();
        g.fill();
      }
      g.restore();
    }
  }

  // Die Laternen flackern – in Weltzeit: Steht die Zeit, steht die Flamme.
  function zeichneFlackern(r) {
    const s = view.s;
    g.globalCompositeOperation = "lighter";
    for (const l of r.laternen) {
      const f = 0.5 + 0.5 * Math.sin(state.W * 11 + l.y) * Math.sin(state.W * 7.3 + l.x);
      const x = bildX(l.x - Math.sign(l.x) * 4);
      const y = bildY(r.y0 + l.y);
      const rad = (20 + f * 6) * s;
      const hof = g.createRadialGradient(x, y, 1, x, y, rad);
      hof.addColorStop(0, `rgba(255, 190, 110, ${0.22 + f * 0.12})`);
      hof.addColorStop(1, "rgba(255, 150, 80, 0)");
      g.fillStyle = hof;
      g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    }
    g.globalCompositeOperation = "source-over";
  }

  // Die Flügel eines Tors: offen (an die Mauer geklappt) bis zu (quer).
  function zeichneTuer(tx, wy, zu, s) {
    for (const seite of [-1, 1]) {
      const px = bildX(tx + seite * TOR / 2);
      const py = bildY(wy);
      // zu = 0: der Flügel steht senkrecht nach oben (offen), 1: quer im Tor.
      const a = lerp(Math.PI / 2, seite < 0 ? 0 : Math.PI, zu);
      const lang = (TOR / 2 - 0.6) * s;
      g.save();
      g.translate(px, py);
      g.rotate(-a);
      g.fillStyle = "rgba(0, 0, 0, 0.3)";
      g.fillRect(1 * s, -1.6 * s + 1.2 * s, lang, 3.2 * s);
      g.fillStyle = "#3e261a";
      g.fillRect(0, -1.6 * s, lang, 3.2 * s);
      g.fillStyle = "#23272e";
      g.fillRect(lang * 0.2, -1.6 * s, 1.2 * s, 3.2 * s);
      g.fillRect(lang * 0.75, -1.6 * s, 1.2 * s, 3.2 * s);
      g.restore();
    }
  }

  function zeichneTore(r, aktiv) {
    const s = view.s;
    // Der nächste Raum: sein Ausgang ist noch zu.
    if (!aktiv) { zeichneTuer(r.torO, r.y0 + RAUM_H + WAND / 2, 1, s); return; }
    // Unten: hinter ihm geht das Tor zu. Oben steht es offen.
    const zu = state.tuerZu > -9 ? weich(clamp((state.echt - state.tuerZu - 0.15) / 0.45, 0, 1)) : 1;
    zeichneTuer(r.torU, r.y0 - WAND / 2, zu, s);
    zeichneTuer(r.torO, r.y0 + RAUM_H + WAND / 2, 0, s);
    // Oben: offen, und auf dem Boden davor leuchten Pfeile zum Ausgang.
    const tx = bildX(r.torO);
    const ty = bildY(r.y0 + RAUM_H);
    const puls = 0.5 + 0.5 * Math.sin(state.echt * 4);
    g.save();
    g.globalCompositeOperation = "lighter";
    const hof = g.createRadialGradient(tx, ty, 2, tx, ty, 34 * s);
    hof.addColorStop(0, `rgba(140, 255, 180, ${0.22 + 0.1 * puls})`);
    hof.addColorStop(1, "rgba(140, 255, 180, 0)");
    g.fillStyle = hof;
    g.fillRect(tx - 34 * s, ty - 34 * s, 68 * s, 68 * s);
    g.restore();
    for (let i = 0; i < 3; i += 1) {
      const k = (state.echt * 0.8 + i / 3) % 1;
      const y = bildY(r.y0 + RAUM_H - 26 + k * 20);
      g.strokeStyle = `rgba(170, 255, 200, ${0.5 * Math.sin(k * Math.PI)})`;
      g.lineWidth = Math.max(1.2, 1.6 * s);
      g.lineCap = "round";
      g.beginPath();
      g.moveTo(tx - 6 * s, y + 3 * s);
      g.lineTo(tx, y - 2 * s);
      g.lineTo(tx + 6 * s, y + 3 * s);
      g.stroke();
    }
  }

  // Die Schriftrollen: Papier, rote Enden, goldene Schnur – sie schweben und
  // glänzen.
  function zeichneRollen(r, aktiv) {
    const s = view.s;
    for (let i = 0; i < r.rollen.length; i += 1) {
      if (aktiv && state.rollen[i]) continue;
      if (!aktiv && r.k < state.raum) continue;
      const q = r.rollen[i];
      const x = bildX(q.x);
      const y = bildY(r.y0 + q.y) + (ruhig() ? 0 : Math.sin(state.echt * 2.6 + i * 2) * 1.2 * s);
      g.save();
      g.globalCompositeOperation = "lighter";
      const glanz = 0.24 + 0.12 * Math.sin(state.echt * 3.1 + i);
      const hof = g.createRadialGradient(x, y, 1, x, y, 15 * s);
      hof.addColorStop(0, `rgba(255, 215, 120, ${glanz})`);
      hof.addColorStop(1, "rgba(255, 200, 90, 0)");
      g.fillStyle = hof;
      g.fillRect(x - 15 * s, y - 15 * s, 30 * s, 30 * s);
      g.restore();
      g.save();
      g.translate(x, y);
      g.rotate(-0.35);
      g.fillStyle = "rgba(0, 0, 0, 0.35)";
      g.fillRect(-6.5 * s + 1.5 * s, -2.2 * s + 2 * s, 13 * s, 4.4 * s);
      g.fillStyle = "#efe2c2";
      g.fillRect(-6 * s, -2.2 * s, 12 * s, 4.4 * s);
      g.fillStyle = "rgba(120, 90, 50, 0.35)";
      g.fillRect(-6 * s, 0.9 * s, 12 * s, 1.3 * s);
      g.fillStyle = "#b83226";
      g.fillRect(-7.4 * s, -2.7 * s, 1.8 * s, 5.4 * s);
      g.fillRect(5.6 * s, -2.7 * s, 1.8 * s, 5.4 * s);
      g.fillStyle = "#e8b84a";
      g.fillRect(-0.6 * s, -2.4 * s, 1.2 * s, 4.8 * s);
      g.restore();
    }
  }

  // Eine Klinge am Pfosten: Stahl, leicht gebogen, mit einem Bogen aus Licht
  // dort, wo sie eben noch war – je schneller die Zeit, desto länger.
  function zeichneKlingen(r, tau, alpha = 1, spur = true) {
    const s = view.s;
    for (const b of r.klingen) {
      const px = bildX(b.x);
      const py = bildY(r.y0 + b.y);
      const a = klingenWinkel(b, tau);
      const om = klingenTempo(b, tau);
      g.globalAlpha = alpha;
      for (let arm = 0; arm < b.arme; arm += 1) {
        const w = a + arm * Math.PI;
        const bogen = spur && !ruhig() ? clamp(om * 0.09 * state.tempo, -1.1, 1.1) : 0;
        if (Math.abs(bogen) > 0.02) {
          g.fillStyle = "rgba(220, 235, 255, 0.16)";
          g.beginPath();
          g.arc(px, py, b.L * s, -w, -(w - bogen), bogen < 0);
          g.arc(px, py, b.post * s, -(w - bogen), -w, bogen > 0);
          g.closePath();
          g.fill();
        }
        g.save();
        g.translate(px, py);
        g.rotate(-w);
        g.fillStyle = "rgba(0, 0, 0, 0.28)";
        g.beginPath();
        g.moveTo(b.post * s + 2 * s, 2.4 * s);
        g.lineTo(b.L * s + 2 * s, 1.5 * s);
        g.lineTo(b.post * s + 2 * s, 5 * s);
        g.fill();
        // Die Angel am Pfosten, dann die Klinge: Schneide vorne hell.
        g.fillStyle = "#2a2d33";
        g.fillRect(b.post * s - 1 * s, -1.6 * s, 6 * s, 3.2 * s);
        g.fillStyle = "#b9c3d1";
        g.beginPath();
        g.moveTo((b.post + 4.5) * s, -1.4 * s);
        g.quadraticCurveTo(b.L * 0.6 * s, -1.2 * s, b.L * s, 0);
        g.quadraticCurveTo(b.L * 0.62 * s, 3.4 * s, (b.post + 4.5) * s, 2.2 * s);
        g.closePath();
        g.fill();
        g.strokeStyle = "#f2f7ff";
        g.lineWidth = Math.max(0.8, 0.8 * s);
        g.beginPath();
        g.moveTo((b.post + 5) * s, 1.9 * s);
        g.quadraticCurveTo(b.L * 0.62 * s, 3.1 * s, b.L * s, 0);
        g.stroke();
        g.strokeStyle = "rgba(60, 70, 90, 0.6)";
        g.lineWidth = Math.max(0.5, 0.45 * s);
        g.beginPath();
        g.moveTo((b.post + 5) * s, -0.6 * s);
        g.quadraticCurveTo(b.L * 0.6 * s, -0.4 * s, b.L * 0.95 * s, 0);
        g.stroke();
        g.restore();
      }
      // Der Pfosten darüber.
      g.fillStyle = "#26282e";
      g.beginPath();
      g.arc(px, py, b.post * s * 0.9, 0, PI2);
      g.fill();
      g.fillStyle = "#c9cfdb";
      g.beginPath();
      g.arc(px, py, b.post * s * 0.35, 0, PI2);
      g.fill();
      g.globalAlpha = 1;
    }
  }

  // Eine Figur von oben – Schütze, Werfer, Wächter: Schatten, Körper mit
  // Schultern, Kopf mit Helm, Kapuze oder Strohhut. blick: wohin sie schaut
  // (Weltwinkel). Gezeichnet etwas grösser als die Welt (FIGUR).
  function zeichneWaechterFigur(x, y, blick, s0, art, gefahr = 0) {
    const s = s0 * FIGUR;
    g.save();
    g.translate(x, y);
    if (gefahr > 0.02) {
      // Wer gleich schiesst, steht in rotem Licht.
      g.globalCompositeOperation = "lighter";
      const hof = g.createRadialGradient(0, 0, 1, 0, 0, 13 * s);
      hof.addColorStop(0, `rgba(255, 70, 50, ${0.45 * gefahr})`);
      hof.addColorStop(1, "rgba(255, 70, 50, 0)");
      g.fillStyle = hof;
      g.fillRect(-13 * s, -13 * s, 26 * s, 26 * s);
      g.globalCompositeOperation = "source-over";
    }
    g.fillStyle = "rgba(0, 0, 0, 0.42)";
    g.beginPath();
    g.ellipse(1.8 * s, 2 * s, 7.6 * s, 6.4 * s, 0, 0, PI2);
    g.fill();
    g.rotate(-blick);
    const werfer = art === "stern" || art === "jaeger";
    const koerper = werfer ? "#2b2e3d" : art === "wache" ? "#3c4c6a" : "#8a3226";
    const dunkel = werfer ? "#1b1d27" : art === "wache" ? "#28344c" : "#5e2018";
    // Körper und Schultern.
    g.fillStyle = dunkel;
    g.beginPath();
    g.ellipse(-0.5 * s, 0, 4.6 * s, 7.2 * s, 0, 0, PI2);
    g.fill();
    g.fillStyle = koerper;
    g.beginPath();
    g.ellipse(0, 0, 4 * s, 6.4 * s, 0, 0, PI2);
    g.fill();
    if (werfer) {
      g.fillStyle = art === "jaeger" ? "#a66bff" : "#7b4fd6";
      g.fillRect(-1 * s, -6 * s, 2 * s, 12 * s);
    } else if (art !== "wache") {
      // Die Platten der Rüstung, mit goldenen Schnüren.
      g.strokeStyle = "rgba(255, 200, 120, 0.45)";
      g.lineWidth = Math.max(0.6, 0.5 * s);
      for (const yy of [-4.2, 4.2]) {
        g.beginPath();
        g.arc(-0.5 * s, yy * s, 2.4 * s, 0, PI2);
        g.stroke();
      }
    } else {
      g.fillStyle = "#c9b48a";
      g.fillRect(-0.6 * s, -5.6 * s, 1.2 * s, 11.2 * s);
    }
    // Kopf.
    if (art === "wache") {
      // Der Strohhut: breit, mit Rippen.
      g.fillStyle = "rgba(0, 0, 0, 0.3)";
      g.beginPath();
      g.arc(1.2 * s, 1 * s, 6.4 * s, 0, PI2);
      g.fill();
      g.fillStyle = "#c9a066";
      g.beginPath();
      g.arc(0.6 * s, 0, 6.4 * s, 0, PI2);
      g.fill();
      g.strokeStyle = "#8c6b3e";
      g.lineWidth = Math.max(0.5, 0.45 * s);
      g.beginPath();
      for (let i = 0; i < 10; i += 1) {
        const a = (i / 10) * PI2;
        g.moveTo(0.6 * s, 0);
        g.lineTo(0.6 * s + Math.cos(a) * 6.2 * s, Math.sin(a) * 6.2 * s);
      }
      g.stroke();
      g.fillStyle = "#e0bf86";
      g.beginPath();
      g.arc(0.6 * s, 0, 1.6 * s, 0, PI2);
      g.fill();
    } else if (werfer) {
      // Die Kapuze, vorne ein heller Schlitz.
      g.fillStyle = "#14151d";
      g.beginPath();
      g.arc(0.6 * s, 0, 4 * s, 0, PI2);
      g.fill();
      g.fillStyle = "#f0f0f4";
      g.fillRect(3.3 * s, -1.8 * s, 1 * s, 3.6 * s);
    } else {
      // Der Helm, vorne die goldene Sichel.
      g.fillStyle = "#1c1d24";
      g.beginPath();
      g.arc(0.4 * s, 0, 4.2 * s, 0, PI2);
      g.fill();
      g.fillStyle = "rgba(255, 255, 255, 0.12)";
      g.beginPath();
      g.arc(-0.4 * s, -1.2 * s, 2.4 * s, 0, PI2);
      g.fill();
      g.strokeStyle = "#e8b84a";
      g.lineWidth = Math.max(0.8, 0.9 * s);
      g.beginPath();
      g.moveTo(5.8 * s, -3.6 * s);
      g.quadraticCurveTo(3 * s, 0, 5.8 * s, 3.6 * s);
      g.stroke();
    }
    g.restore();
  }

  // Die Schützen auf den Mauern: Sie spannen den Bogen, bevor sie schiessen;
  // wer zielt, zeigt mit einer roten Linie, wohin.
  function zeichneSchuetzen(r, tau, aktiv) {
    const s = view.s;
    const n = state.ninja;
    const nx = n.x;
    const ny = n.y - r.y0;
    const kalt = kaelte();
    const figurOrt = (wx, wy, seite) => (seite === 0 ? [wx, RAUM_H + WAND / 2] : [seite * (HALB + WAND / 2), wy]);
    // Die festen Bahnen: ihr Weg ist immer zu sehen, deutlicher, wenn die
    // Zeit steht.
    for (const sv of r.salven) {
      const [fx, fy] = figurOrt(sv.ox, sv.oy, sv.seite);
      const blick = Math.atan2(sv.dy, sv.dx);
      if (aktiv) {
        g.strokeStyle = `rgba(255, 120, 100, ${0.07 + 0.13 * kalt})`;
        g.lineWidth = Math.max(1, 1.2 * s);
        g.setLineDash([2 * s, 5 * s]);
        g.beginPath();
        g.moveTo(bildX(sv.ox), bildY(r.y0 + sv.oy));
        g.lineTo(bildX(sv.ox + sv.dx * sv.L), bildY(r.y0 + sv.oy + sv.dy * sv.L));
        g.stroke();
        g.setLineDash([]);
      }
      const spann = aktiv ? clamp(1 - bisSchuss(sv, tau) / 0.5, 0, 1) : 0;
      zeichneWaechterFigur(bildX(fx), bildY(r.y0 + fy), blick, s, "salve", spann * 0.6);
      zeichneBogen(bildX(fx), bildY(r.y0 + fy), blick, spann, s);
    }
    for (const sc of r.schuetzen) {
      const [fx, fy] = figurOrt(sc.x, sc.y, sc.seite);
      const bis = aktiv ? bisSchuss(sc, tau) : 9;
      const ziel = aktiv && state.schritt === "lauf" && state.phase !== "bereit";
      const blick = ziel ? Math.atan2(ny - sc.y, nx - sc.x) : sc.seite === 0 ? -Math.PI / 2 : sc.seite < 0 ? 0 : Math.PI;
      zeichneWaechterFigur(bildX(fx), bildY(r.y0 + fy), blick, s, sc.art, ziel ? clamp(1 - bis / 0.55, 0, 1) : 0);
      if (sc.art === "pfeil") {
        const spann = ziel ? clamp(1 - bis / 0.55, 0, 1) : 0;
        zeichneBogen(bildX(fx), bildY(r.y0 + fy), blick, spann, s);
        if (spann > 0) {
          g.strokeStyle = `rgba(255, 70, 60, ${spann * (0.35 + 0.45 * kalt)})`;
          g.lineWidth = Math.max(1, 1.1 * s);
          g.setLineDash([4 * s, 3 * s]);
          g.beginPath();
          g.moveTo(bildX(sc.x), bildY(r.y0 + sc.y));
          g.lineTo(bildX(nx), bildY(r.y0 + ny));
          g.stroke();
          g.setLineDash([]);
        }
      } else {
        // Der Werfer hält den nächsten Stern in der Hand.
        const hx = bildX(fx) + Math.cos(-blick) * 8 * s;
        const hy = bildY(r.y0 + fy) + Math.sin(-blick) * 8 * s;
        zeichneStern(hx, hy, state.W * 3, s * 0.85, sc.art === "jaeger");
        if (ziel && bis < 0.55) {
          const k = clamp(1 - bis / 0.55, 0, 1);
          g.strokeStyle = sc.art === "jaeger" ? `rgba(180, 120, 255, ${k * 0.7})` : `rgba(255, 70, 60, ${k * (0.35 + 0.45 * kalt)})`;
          g.lineWidth = Math.max(1, 1.1 * s);
          g.setLineDash([2 * s, 3 * s]);
          g.beginPath();
          g.moveTo(bildX(sc.x), bildY(r.y0 + sc.y));
          g.lineTo(bildX(nx), bildY(r.y0 + ny));
          g.stroke();
          g.setLineDash([]);
        }
      }
    }
  }

  function zeichneBogen(x, y, blick, spann, s0) {
    const s = s0 * FIGUR;
    g.save();
    g.translate(x, y);
    g.rotate(-blick);
    g.strokeStyle = "#c9925a";
    g.lineWidth = Math.max(1.2, 1.4 * s);
    g.lineCap = "round";
    g.beginPath();
    g.arc(-1 * s, 0, 8.6 * s, -1.0, 1.0);
    g.stroke();
    const ex = -1 * s + Math.cos(1.0) * 8.6 * s;
    const ey = Math.sin(1.0) * 8.6 * s;
    const zug = (3.6 - spann * 6.5) * s;
    g.strokeStyle = "rgba(240, 236, 225, 0.85)";
    g.lineWidth = Math.max(0.6, 0.45 * s);
    g.beginPath();
    g.moveTo(ex, -ey);
    g.lineTo(zug, 0);
    g.lineTo(ex, ey);
    g.stroke();
    if (spann > 0.05) {
      g.strokeStyle = "#e3d3ae";
      g.lineWidth = Math.max(0.8, 0.8 * s);
      g.beginPath();
      g.moveTo(zug, 0);
      g.lineTo(zug + 12 * s, 0);
      g.stroke();
      g.fillStyle = "#f2f6fb";
      g.beginPath();
      g.moveTo(zug + 14.5 * s, 0);
      g.lineTo(zug + 11.5 * s, -1.5 * s);
      g.lineTo(zug + 11.5 * s, 1.5 * s);
      g.closePath();
      g.fill();
    }
    g.restore();
  }

  function zeichneWachen(r, tau) {
    const s = view.s;
    for (let i = 0; i < r.wachen.length; i += 1) {
      const w = r.wachen[i];
      const a = wachenWinkel(w, tau);
      zeichneWaechterFigur(bildX(w.x), bildY(r.y0 + w.y), a, s, "wache");
      const lx = bildX(laterneX(w, a));
      const ly = bildY(r.y0 + laterneY(w, a));
      g.fillStyle = "#3a2a1a";
      g.beginPath();
      g.arc(lx, ly, 3.4 * s, 0, PI2);
      g.fill();
      g.fillStyle = "#ffe6a8";
      g.beginPath();
      g.arc(lx, ly, 2.6 * s, 0, PI2);
      g.fill();
      const st = r === aktRaum() ? state.wachen[i] : null;
      if (st && st.alarm > -9 && tau - st.alarm < 1.6) {
        // Ein rotes Ausrufezeichen über dem Kopf.
        const k = clamp((tau - st.alarm) / 0.15, 0, 1);
        const x = bildX(w.x);
        const y = bildY(r.y0 + w.y + 14);
        g.fillStyle = "#ff5a3c";
        g.font = `900 ${Math.round(14 * clamp(s, 0.8, 1.6) * (0.6 + 0.4 * k))}px system-ui, sans-serif`;
        g.textAlign = "center";
        g.textBaseline = "middle";
        g.lineWidth = 3;
        g.strokeStyle = "rgba(20, 10, 10, 0.7)";
        g.strokeText("!", x, y);
        g.fillText("!", x, y);
      }
    }
  }

  // Ein Pfeil: Spitze aus Stahl, Schaft, rote Federn. Dahinter eine Schliere
  // (je schneller die Zeit, desto länger), davor – wenn die Zeit steht – sein
  // Weg bis zur Wand.
  function zeichnePfeil(r, px, py, dx, dy, weg, L, v, hagel = false) {
    const s = view.s;
    const kalt = kaelte();
    const l = Math.min(PFEIL_L, weg);
    const sx = bildX(px);
    const sy = bildY(r.y0 + py);
    const ux = dx;
    const uy = -dy;
    if (kalt > 0.05 && L > weg) {
      g.strokeStyle = hagel ? `rgba(255, 120, 90, ${0.5 * kalt})` : `rgba(255, 235, 220, ${0.32 * kalt})`;
      g.lineWidth = Math.max(1, 0.9 * s);
      g.setLineDash([3 * s, 4 * s]);
      g.beginPath();
      g.moveTo(sx, sy);
      g.lineTo(sx + ux * (L - weg) * s, sy + uy * (L - weg) * s);
      g.stroke();
      g.setLineDash([]);
      // Wo er einschlagen wird: ein kleines Kreuz.
      const ex = sx + ux * (L - weg) * s;
      const ey = sy + uy * (L - weg) * s;
      g.strokeStyle = `rgba(255, 140, 110, ${0.5 * kalt})`;
      g.beginPath();
      g.moveTo(ex - 2.5 * s, ey - 2.5 * s);
      g.lineTo(ex + 2.5 * s, ey + 2.5 * s);
      g.moveTo(ex + 2.5 * s, ey - 2.5 * s);
      g.lineTo(ex - 2.5 * s, ey + 2.5 * s);
      g.stroke();
    }
    const schliere = ruhig() ? 0 : Math.min(weg - l, v * 0.07 * state.tempo);
    if (schliere > 1) {
      const tx = sx - ux * l * s;
      const ty = sy - uy * l * s;
      for (let i = 0; i < 3; i += 1) {
        g.strokeStyle = `rgba(255, 240, 225, ${0.22 - i * 0.06})`;
        g.lineWidth = Math.max(1, (2.4 - i * 0.6) * s);
        g.beginPath();
        g.moveTo(tx - ux * schliere * s * (i / 3), ty - uy * schliere * s * (i / 3));
        g.lineTo(tx - ux * schliere * s * ((i + 1) / 3), ty - uy * schliere * s * ((i + 1) / 3));
        g.stroke();
      }
    }
    g.save();
    g.translate(sx, sy);
    g.rotate(Math.atan2(uy, ux));
    g.fillStyle = "rgba(0, 0, 0, 0.3)";
    g.fillRect(-l * s + 1.5 * s, 1.5 * s - 0.5 * s, l * s, 1 * s);
    g.strokeStyle = "#d8c8a2";
    g.lineWidth = Math.max(1, 1 * s);
    g.beginPath();
    g.moveTo(-l * s, 0);
    g.lineTo(-1 * s, 0);
    g.stroke();
    g.fillStyle = hagel ? "#ff8a6a" : "#e8eef5";
    g.beginPath();
    g.moveTo(1.6 * s, 0);
    g.lineTo(-2.6 * s, -1.6 * s);
    g.lineTo(-2.6 * s, 1.6 * s);
    g.closePath();
    g.fill();
    if (l > 10) {
      g.fillStyle = "#d8443c";
      g.beginPath();
      g.moveTo(-l * s, 0);
      g.lineTo(-l * s + 4.5 * s, 0);
      g.lineTo(-l * s + 2 * s, -2 * s);
      g.lineTo(-l * s - 0.6 * s, -2 * s);
      g.closePath();
      g.moveTo(-l * s, 0);
      g.lineTo(-l * s + 4.5 * s, 0);
      g.lineTo(-l * s + 2 * s, 2 * s);
      g.lineTo(-l * s - 0.6 * s, 2 * s);
      g.closePath();
      g.fill();
    }
    g.restore();
  }

  function zeichnePfeile(r) {
    const tau = state.tau;
    for (const sv of r.salven) {
      salvenPfeile(sv, tau, (px, py, weg) => {
        zeichnePfeil(r, px, py, sv.dx, sv.dy, weg, sv.L, sv.v);
        return false;
      });
      salvenStecken(sv, tau, (t) => {
        const px = sv.ox + sv.dx * sv.L;
        const py = sv.oy + sv.dy * sv.L;
        zeichneSteckend(r.y0, px, py, sv.dx, sv.dy, t / 2.2, false, 0);
      });
    }
    for (const p of state.pfeile) {
      if (p.weg <= 0) continue;
      zeichnePfeil(r, p.ox + p.dx * p.weg, p.oy + p.dy * p.weg, p.dx, p.dy, p.weg, p.L, p.v, p.art === "hagel");
    }
    for (const st of state.stecken) zeichneSteckend(0, st.x, st.y, st.dx, st.dy, st.alter / 3, st.stern, st.dreh);
  }

  // Was in einer Wand steckt: ein Pfeil, halb drin, oder ein Stern.
  function zeichneSteckend(y0, x, y, dx, dy, alter, stern, dreh) {
    if (alter >= 1) return;
    const s = view.s;
    g.globalAlpha = clamp((1 - alter) * 2, 0, 1);
    if (stern) {
      zeichneStern(bildX(x), bildY(y0 + y), dreh, s * 0.85, false);
    } else {
      const sx = bildX(x);
      const sy = bildY(y0 + y);
      g.save();
      g.translate(sx, sy);
      g.rotate(Math.atan2(-dy, dx));
      g.strokeStyle = "#d8c8a2";
      g.lineWidth = Math.max(1, 1 * s);
      g.beginPath();
      g.moveTo(-11 * s, 0);
      g.lineTo(0, 0);
      g.stroke();
      g.fillStyle = "#d8443c";
      g.fillRect(-12 * s, -1.6 * s, 4 * s, 3.2 * s);
      g.restore();
    }
    g.globalAlpha = 1;
  }

  function zeichneStern(x, y, dreh, s, jaeger) {
    g.save();
    g.translate(x, y);
    g.rotate(dreh);
    g.fillStyle = jaeger ? "#d9ccff" : "#dfe5ee";
    g.beginPath();
    for (let i = 0; i < 8; i += 1) {
      const a = (i / 8) * PI2;
      const rad = (i % 2 ? 1.8 : 5.6) * s;
      if (i) g.lineTo(Math.cos(a) * rad, Math.sin(a) * rad);
      else g.moveTo(Math.cos(a) * rad, Math.sin(a) * rad);
    }
    g.closePath();
    g.fill();
    g.strokeStyle = "rgba(40, 45, 60, 0.6)";
    g.lineWidth = Math.max(0.5, 0.5 * s);
    g.stroke();
    g.fillStyle = "#2a2d36";
    g.beginPath();
    g.arc(0, 0, 1.2 * s, 0, PI2);
    g.fill();
    g.restore();
  }

  function zeichneSterne(r) {
    const s = view.s;
    for (const st of state.sterne) {
      const x = bildX(st.x);
      const y = bildY(r.y0 + st.y);
      if (st.wende > 0) {
        // Ein Jäger zieht eine violette Spur und leuchtet.
        if (st.spur.length >= 4) {
          g.strokeStyle = "rgba(170, 110, 255, 0.35)";
          g.lineWidth = Math.max(1, 2 * s);
          g.lineCap = "round";
          g.beginPath();
          g.moveTo(bildX(st.spur[0]), bildY(r.y0 + st.spur[1]));
          for (let i = 2; i < st.spur.length; i += 2) g.lineTo(bildX(st.spur[i]), bildY(r.y0 + st.spur[i + 1]));
          g.lineTo(x, y);
          g.stroke();
        }
        g.save();
        g.globalCompositeOperation = "lighter";
        const hof = g.createRadialGradient(x, y, 1, x, y, 13 * s);
        hof.addColorStop(0, "rgba(170, 110, 255, 0.45)");
        hof.addColorStop(1, "rgba(170, 110, 255, 0)");
        g.fillStyle = hof;
        g.fillRect(x - 13 * s, y - 13 * s, 26 * s, 26 * s);
        g.restore();
        // Wird er müde, blinkt er.
        if (st.leben - st.alter < 0.8 && Math.sin(state.echt * 30) < 0) g.globalAlpha = 0.5;
      } else if (kaelte() > 0.05) {
        g.strokeStyle = `rgba(255, 235, 220, ${0.28 * kaelte()})`;
        g.lineWidth = Math.max(1, 0.9 * s);
        g.setLineDash([3 * s, 4 * s]);
        g.beginPath();
        g.moveTo(x, y);
        g.lineTo(x + (st.vx / st.v) * 60 * s, y - (st.vy / st.v) * 60 * s);
        g.stroke();
        g.setLineDash([]);
      }
      zeichneStern(x, y, st.dreh, s, st.wende > 0);
      g.globalAlpha = 1;
    }
  }

  /*
   * Der Ninja von oben: Schatten, Füsse (im Lauf abwechselnd vorn), Körper,
   * Hände, das Schwert auf dem Rücken, der Kopf mit rotem Stirnband, dessen
   * Enden im Lauf flattern. art: "ninja", "geist" (in der Farbe des Gegners,
   * halb durchsichtig) oder "bild" (ein Nachbild, nur der Umriss).
   */
  function zeichneFigur(x, y, blick, lauf, schwung, s, art = "ninja", farbe = null) {
    g.save();
    g.translate(x, y);
    const bein = Math.sin(lauf) * 3.6 * schwung;
    if (art === "ninja") {
      g.fillStyle = "rgba(0, 0, 0, 0.42)";
      g.beginPath();
      g.ellipse(2 * s, 2.2 * s, 8.6 * s, 7.2 * s, 0, 0, PI2);
      g.fill();
    }
    g.rotate(-blick);
    if (art === "bild") {
      g.fillStyle = farbe;
      g.beginPath();
      g.ellipse(0, 0, 5.4 * s, 8 * s, 0, 0, PI2);
      g.fill();
      g.beginPath();
      g.arc(1 * s, 0, 4.6 * s, 0, PI2);
      g.fill();
      g.restore();
      return;
    }
    const geist = art === "geist";
    const dunkel = geist ? farbe : "#141a2e";
    const koerper = geist ? farbe : "#1f2744";
    // Füsse.
    g.fillStyle = dunkel;
    g.beginPath();
    g.ellipse(bein * s, -3.2 * s, 2.8 * s, 1.7 * s, 0, 0, PI2);
    g.ellipse(-bein * s, 3.2 * s, 2.8 * s, 1.7 * s, 0, 0, PI2);
    g.fill();
    // Körper (Schultern), mit hellem Rand im Mondlicht.
    g.fillStyle = koerper;
    g.beginPath();
    g.ellipse(0, 0, 5.4 * s, 8 * s, 0, 0, PI2);
    g.fill();
    if (!geist) {
      g.strokeStyle = "rgba(170, 205, 255, 0.55)";
      g.lineWidth = Math.max(0.8, 0.7 * s);
      g.stroke();
      g.fillStyle = "rgba(120, 150, 220, 0.18)";
      g.beginPath();
      g.ellipse(0.8 * s, -2.4 * s, 3.6 * s, 4.6 * s, 0, 0, PI2);
      g.fill();
      // Das Schwert quer über den Rücken.
      g.strokeStyle = "#3b1d1a";
      g.lineWidth = Math.max(1, 1.5 * s);
      g.lineCap = "round";
      g.beginPath();
      g.moveTo(-6 * s, 5 * s);
      g.lineTo(2.5 * s, -6.5 * s);
      g.stroke();
      g.strokeStyle = "#d9d2c3";
      g.lineWidth = Math.max(1, 1.2 * s);
      g.beginPath();
      g.moveTo(3 * s, -7.2 * s);
      g.lineTo(5.2 * s, -10 * s);
      g.stroke();
      g.fillStyle = "#e8b84a";
      g.beginPath();
      g.arc(2.6 * s, -6.7 * s, 1.1 * s, 0, PI2);
      g.fill();
    }
    // Hände: im Lauf schwingen sie gegen die Füsse.
    g.fillStyle = dunkel;
    g.beginPath();
    g.arc((1.5 - bein * 0.9) * s, -7.6 * s, 2 * s, 0, PI2);
    g.arc((1.5 + bein * 0.9) * s, 7.6 * s, 2 * s, 0, PI2);
    g.fill();
    // Die Enden des Stirnbands: Sie wehen hinter ihm.
    const wehen = Math.sin(state.echt * 13 + lauf) * (1 + schwung * 1.5);
    g.strokeStyle = geist ? "rgba(255, 255, 255, 0.7)" : "#d8322c";
    g.lineWidth = Math.max(1, 1.1 * s);
    g.lineCap = "round";
    g.beginPath();
    g.moveTo(-3.8 * s, -0.6 * s);
    g.quadraticCurveTo(-8 * s, (-1.5 + wehen) * s, (-11 - schwung * 3) * s, (-2.2 + wehen * 1.4) * s);
    g.moveTo(-3.8 * s, 0.6 * s);
    g.quadraticCurveTo(-8.5 * s, (1.2 - wehen) * s, (-10.5 - schwung * 3) * s, (2.4 - wehen * 1.2) * s);
    g.stroke();
    // Der Kopf mit Kapuze, Augenschlitz und Stirnband: vorne über der
    // Stirn, hinten der Knoten.
    g.fillStyle = geist ? farbe : "#2c3658";
    g.beginPath();
    g.arc(1 * s, 0, 4.7 * s, 0, PI2);
    g.fill();
    if (!geist) {
      g.fillStyle = "rgba(190, 210, 255, 0.16)";
      g.beginPath();
      g.arc(0.2 * s, -1.2 * s, 2.8 * s, 0, PI2);
      g.fill();
      g.fillStyle = "#e6c4a0";
      g.beginPath();
      g.ellipse(4.5 * s, 0, 0.9 * s, 2.4 * s, 0, 0, PI2);
      g.fill();
      g.fillStyle = "#141a2e";
      g.fillRect(4.6 * s, -1.6 * s, 0.7 * s, 0.9 * s);
      g.fillRect(4.6 * s, 0.7 * s, 0.7 * s, 0.9 * s);
    }
    g.strokeStyle = geist ? "rgba(255, 255, 255, 0.8)" : "#d8322c";
    g.lineWidth = Math.max(0.8, 0.85 * s);
    g.beginPath();
    g.arc(1 * s, 0, 4.25 * s, -2.2, 2.2);
    g.stroke();
    g.fillStyle = geist ? "rgba(255, 255, 255, 0.8)" : "#d8322c";
    g.beginPath();
    g.arc(-3.3 * s, 0, 1.2 * s, 0, PI2);
    g.fill();
    g.restore();
  }

  // Der Holzklotz, der nach dem Treffer dort liegt, wo der Ninja stand.
  function zeichneKlotz(x, y, dreh, k, s) {
    g.save();
    g.translate(x, y);
    g.rotate(dreh);
    const gross = 1 + (1 - k) * 0.35;
    g.scale(gross, gross);
    g.fillStyle = "rgba(0, 0, 0, 0.4)";
    g.fillRect(-7 * s + 1.5 * s, -3.2 * s + 1.5 * s, 14 * s, 6.4 * s);
    g.fillStyle = "#7a5236";
    g.fillRect(-7 * s, -3.2 * s, 14 * s, 6.4 * s);
    g.fillStyle = "#5e3d27";
    g.fillRect(-7 * s, 1.2 * s, 14 * s, 2 * s);
    g.fillStyle = "#c79a68";
    for (const ex of [-7, 7]) {
      g.beginPath();
      g.ellipse(ex * s, 0, 1.4 * s, 3.2 * s, 0, 0, PI2);
      g.fill();
    }
    g.strokeStyle = "#8a6440";
    g.lineWidth = Math.max(0.5, 0.4 * s);
    g.beginPath();
    g.ellipse(7 * s, 0, 0.7 * s, 1.8 * s, 0, 0, PI2);
    g.stroke();
    g.restore();
  }

  function zeichneNinja() {
    const n = state.ninja;
    const s = view.s * NINJA_BILD;
    if (state.aus) {
      const t = state.echt - state.aus.t0;
      zeichneKlotz(bildX(state.aus.x), bildY(state.aus.y), state.aus.dreh + t * 0.3, clamp(t / 0.3, 0, 1), s);
      return;
    }
    // Ein Hauch Mondlicht um ihn: Er ist auf jedem Boden zu finden.
    const x = bildX(n.x);
    const y = bildY(n.y);
    g.save();
    g.globalCompositeOperation = "lighter";
    const hof = g.createRadialGradient(x, y, 2, x, y, 20 * s);
    hof.addColorStop(0, "rgba(150, 185, 255, 0.2)");
    hof.addColorStop(1, "rgba(150, 185, 255, 0)");
    g.fillStyle = hof;
    g.fillRect(x - 20 * s, y - 20 * s, 40 * s, 40 * s);
    g.restore();
    for (const b of state.nachbilder) {
      const k = 1 - b.alter / 0.24;
      if (k <= 0) continue;
      zeichneFigur(bildX(b.x), bildY(b.y), b.blick, b.lauf, 1, s, "bild", `rgba(120, 190, 255, ${0.28 * k})`);
    }
    zeichneFigur(bildX(n.x), bildY(n.y), n.blick, n.lauf, n.schwung, s, "ninja");
  }

  // Die Gegner (geist.js): halb durchsichtige Ninjas auf ihrem eigenen Weg.
  function zeichneGeister() {
    if (!gegner || state.phase === "bereit") return;
    const orte = window.LernappGeist?.orte?.(gegner) || [];
    if (!orte.length) return;
    const s = view.s;
    orte.forEach((o) => {
      // Wem im Live-Modus zugeschaut wird, der ist der Ninja selbst – kein
      // Geist dazu, nur sein Name (geist.js, namen).
      if (o.ziel) return;
      const x = bildX(o.a);
      const y = bildY(o.b);
      if (x < -30 || x > view.cssW + 30 || y < -30 || y > view.cssH + 30) return;
      const blick = Math.hypot(o.da, o.db) > 0.3 ? Math.atan2(o.db, o.da) : Math.PI / 2;
      g.globalAlpha = 0.45 * o.blass;
      zeichneFigur(x, y, blick, (o.a + o.b) * 0.38, Math.hypot(o.da, o.db) > 0.3 ? 1 : 0, s * NINJA_BILD, "geist", o.farbe);
      g.globalAlpha = 1;
    });
    window.LernappGeist.namen(g, orte.map((o) => ({ ...o, sx: bildX(o.a), sy: bildY(o.b) - 11 * s, weit: "" })), { breit: view.cssW, hoch: view.cssH });
  }

  // Kirschblütenblätter in der Luft. Sie treiben in Weltzeit: Steht die
  // Zeit, stehen sie mitten in der Luft.
  const BLATT_FARBEN = ["#ffc1d6", "#ff9fbf", "#ffe0ea", "#f7b0c8"];
  function blaetterVerteilen() {
    const n = Math.round(clamp((view.cssW * view.cssH) / 9000, 40, 90));
    while (state.blaetter.length < n) {
      state.blaetter.push({
        x: (Math.random() - 0.5) * view.cssW / view.s,
        y: kam.y + (Math.random() - 0.5) * view.cssH / view.s,
        h: Math.random(),
        dreh: Math.random() * PI2,
        flatter: Math.random() * PI2,
        farbe: BLATT_FARBEN[state.blaetter.length % BLATT_FARBEN.length],
        gross: 1.6 + Math.random() * 1.4,
      });
    }
    state.blaetter.length = n;
  }

  function blaetterTakt(wdt) {
    const wx = 16 + 8 * Math.sin(state.W * 0.31);
    const wy = -12 + 5 * Math.cos(state.W * 0.23);
    const halbW = view.cssW / view.s / 2 + 20;
    const halbH = view.cssH / view.s / 2 + 20;
    const mitteY = kam.y + (view.cssH / 2 - view.my) / -view.s;
    for (const b of state.blaetter) {
      b.flatter += wdt * (2.2 + b.h);
      b.dreh += wdt * (1.4 + b.h);
      b.x += (wx * (0.6 + b.h * 0.6) + Math.sin(b.flatter) * 14) * wdt;
      b.y += (wy * (0.6 + b.h * 0.6) + Math.cos(b.flatter * 0.7) * 6) * wdt;
      if (b.x > halbW) b.x -= 2 * halbW;
      if (b.x < -halbW) b.x += 2 * halbW;
      if (b.y < mitteY - halbH) b.y += 2 * halbH;
      if (b.y > mitteY + halbH) b.y -= 2 * halbH;
    }
  }

  // Gemalt je Farbe in einem einzigen Pfad: Jedes Blatt ist ein kleines
  // gedrehtes Viereck mit runden Seiten, die Ecken von Hand gerechnet.
  function zeichneBlaetter() {
    const s = view.s;
    const cx = view.cssW / 2;
    const cy = view.cssH / 2;
    for (let f = 0; f < BLATT_FARBEN.length; f += 1) {
      g.fillStyle = BLATT_FARBEN[f];
      g.globalAlpha = 0.8;
      g.beginPath();
      for (let i = f; i < state.blaetter.length; i += BLATT_FARBEN.length) {
        const b = state.blaetter[i];
        // Höhere Blätter sind näher: grösser und etwas nach aussen verschoben.
        const px = bildX(b.x);
        const py = bildY(b.y);
        const x = px + (px - cx) * b.h * 0.12;
        const y = py + (py - cy) * b.h * 0.12;
        if (x < -10 || x > view.cssW + 10 || y < -10 || y > view.cssH + 10) continue;
        const r = b.gross * (1 + b.h * 0.7) * s;
        const q = r * (0.25 + 0.5 * Math.abs(Math.cos(b.flatter)));
        const ux = Math.cos(b.dreh);
        const uy = Math.sin(b.dreh);
        g.moveTo(x - ux * r, y - uy * r);
        g.quadraticCurveTo(x - uy * q * 1.4, y + ux * q * 1.4, x + ux * r, y + uy * r);
        g.quadraticCurveTo(x + uy * q * 1.4, y - ux * q * 1.4, x - ux * r, y - uy * r);
      }
      g.fill();
    }
    g.globalAlpha = 1;
  }

  function zeichneTeile() {
    if (!state.teile.length) return;
    const s = view.s;
    for (let durchgang = 0; durchgang < 2; durchgang += 1) {
      if (durchgang) g.globalCompositeOperation = "lighter";
      for (const t of state.teile) {
        const hell = t.art === "funke";
        if (hell !== Boolean(durchgang)) continue;
        const k = clamp(t.leben / t.max, 0, 1);
        const x = bildX(t.x);
        const y = bildY(t.y);
        g.fillStyle = t.farbe;
        if (t.art === "rauch") {
          g.globalAlpha = k * 0.5;
          g.beginPath();
          g.arc(x, y, t.r * s * (2 - k), 0, PI2);
          g.fill();
        } else if (t.art === "blatt") {
          g.globalAlpha = Math.min(1, k * 2);
          g.save();
          g.translate(x, y);
          g.rotate(t.dreh);
          g.beginPath();
          g.ellipse(0, 0, t.r * s, t.r * s * 0.5, 0, 0, PI2);
          g.fill();
          g.restore();
        } else {
          g.globalAlpha = k;
          g.beginPath();
          g.arc(x, y, t.r * s * (0.5 + k * 0.5), 0, PI2);
          g.fill();
        }
      }
    }
    g.globalAlpha = 1;
    g.globalCompositeOperation = "source-over";
  }

  function zeichneSchriften() {
    if (!state.schriften.length) return;
    g.textAlign = "center";
    g.textBaseline = "middle";
    for (const sch of state.schriften) {
      const k = clamp(sch.leben / sch.max, 0, 1);
      const alter = sch.max - sch.leben;
      const pop = alter < 0.15 && !ruhig() ? 0.6 + (alter / 0.15) * 0.4 + Math.sin((alter / 0.15) * Math.PI) * 0.25 : 1;
      const steig = (1 - k) * 22;
      const gross = Math.round(sch.gross * clamp(view.s, 0.85, 1.6) * pop);
      g.font = `900 ${gross}px system-ui, sans-serif`;
      const halb = g.measureText(sch.text).width / 2 + 6;
      const x = clamp(bildX(sch.x), halb, view.cssW - halb);
      const y = Math.max(view.frei + gross, bildY(sch.y) - steig);
      g.globalAlpha = Math.min(1, k * 2.5);
      g.lineWidth = Math.max(3, gross * 0.2);
      g.lineJoin = "round";
      g.strokeStyle = "rgba(8, 10, 22, 0.8)";
      g.strokeText(sch.text, x, y);
      g.fillStyle = sch.farbe;
      g.fillText(sch.text, x, y);
    }
    g.globalAlpha = 1;
  }

  // Wie sehr die Zeit gerade steht: 0 (sie läuft) bis 1 (sie steht).
  const kaelte = () => weich(clamp((1 - state.tempo) / (1 - R_MIN), 0, 1));

  // Steht die Zeit, wird die Welt kühl und blass: ein Überzug, der Rot und
  // Grün dämpft (ein einziger Durchgang, «multiply»). Was gefährlich ist,
  // kommt erst danach ins Bild – es bleibt kräftig.
  function zeichneKaelte() {
    const k = kaelte();
    if (k < 0.02) return;
    flachTransform();
    g.globalCompositeOperation = "multiply";
    g.fillStyle = `rgb(${Math.round(255 - 105 * k)}, ${Math.round(255 - 70 * k)}, ${Math.round(255 - 18 * k)})`;
    g.fillRect(0, 0, view.cssW, view.cssH);
    g.globalCompositeOperation = "source-over";
  }

  // Die Räume, in denen er nicht ist, liegen im Halbdunkel.
  function zeichneDaemmer(von, bis) {
    for (let k = Math.max(-2, von); k <= bis; k += 1) {
      const nah = k === state.raum ? 1 : 0;
      const ziel = kam.t < 1 && k === state.raum - 1 ? 1 - weich(kam.t) : 0;
      const a = 0.42 * (1 - Math.max(nah * (kam.t < 1 ? weich(kam.t) : 1), ziel));
      if (a < 0.01) continue;
      const oben = bildY(k * SCHRITT + RAUM_H);
      const unten = bildY(k * SCHRITT - WAND);
      g.fillStyle = `rgba(4, 6, 14, ${a})`;
      g.fillRect(-10, oben, view.cssW + 20, unten - oben);
    }
  }

  // Der Schnitt nach dem Treffer: Eine Linie quer durchs Bild, und das Bild
  // klafft für einen Augenblick entlang der Linie auseinander.
  let schnittBild = null;
  function zeichneSchnitt() {
    const a = state.aus;
    if (!a) return;
    const t = state.echt - a.t0;
    const x = bildX(a.x);
    const y = bildY(a.y);
    const ux = Math.cos(-a.winkel);
    const uy = Math.sin(-a.winkel);
    const lang = Math.hypot(view.cssW, view.cssH);
    if (!ruhig() && t < 0.9) {
      const auf = Math.sin(clamp(t / 0.9, 0, 1) * Math.PI) * 9;
      if (auf > 0.3) {
        if (!schnittBild || schnittBild.width !== canvas.width || schnittBild.height !== canvas.height) {
          schnittBild = document.createElement("canvas");
          schnittBild.width = canvas.width;
          schnittBild.height = canvas.height;
        }
        const sg = schnittBild.getContext("2d");
        sg.setTransform(1, 0, 0, 1, 0, 0);
        sg.clearRect(0, 0, schnittBild.width, schnittBild.height);
        sg.drawImage(canvas, 0, 0);
        g.setTransform(1, 0, 0, 1, 0, 0);
        g.fillStyle = "#06070c";
        g.fillRect(0, 0, canvas.width, canvas.height);
        flachTransform();
        for (const seite of [-1, 1]) {
          g.save();
          g.beginPath();
          const nx = -uy * seite;
          const ny = ux * seite;
          g.moveTo(x - ux * lang, y - uy * lang);
          g.lineTo(x + ux * lang, y + uy * lang);
          g.lineTo(x + ux * lang + nx * lang, y + uy * lang + ny * lang);
          g.lineTo(x - ux * lang + nx * lang, y - uy * lang + ny * lang);
          g.closePath();
          g.clip();
          g.drawImage(schnittBild, (ux * seite * auf * 0.6 + nx * auf * 0.5), (uy * seite * auf * 0.6 + ny * auf * 0.5), view.cssW, view.cssH);
          g.restore();
        }
      }
    }
    flachTransform();
    if (t < 0.6) {
      // Die Klinge fährt durchs Bild: ein heller Strich mit rotem Schein.
      const k = t / 0.6;
      const halb = lang * Math.min(1, t / 0.07);
      g.lineCap = "round";
      g.globalCompositeOperation = "lighter";
      g.strokeStyle = `rgba(255, 90, 70, ${0.45 * (1 - k)})`;
      g.lineWidth = Math.max(2, 18 * (1 - k));
      g.beginPath();
      g.moveTo(x - ux * halb, y - uy * halb);
      g.lineTo(x + ux * halb, y + uy * halb);
      g.stroke();
      g.globalCompositeOperation = "source-over";
      g.strokeStyle = `rgba(255, 255, 255, ${1 - k * k})`;
      g.lineWidth = Math.max(1, 4.5 * (1 - k));
      g.stroke();
    }
  }

  // Vor dem ersten Zug: ein Ring um den Ninja, der pulsiert, und Pfeile in
  // alle Richtungen – wohin man will (das Steuerfeld unten winkt dazu).
  function zeichneHinweis() {
    if (state.phase !== "bereit" || shell.live) return;
    const n = state.ninja;
    const s = view.s;
    const x = bildX(n.x);
    const y = bildY(n.y);
    const k = (state.echt * 0.8) % 1;
    g.strokeStyle = `rgba(255, 255, 255, ${0.6 * (1 - k)})`;
    g.lineWidth = Math.max(1.5, 2 * s);
    g.beginPath();
    g.arc(x, y, (11 + k * 14) * s, 0, PI2);
    g.stroke();
    g.strokeStyle = "rgba(255, 255, 255, 0.85)";
    g.lineWidth = Math.max(1.5, 1.8 * s);
    g.lineCap = "round";
    for (let i = 0; i < 4; i += 1) {
      const a = (i / 4) * PI2 + Math.PI / 2;
      const d = (19 + Math.sin(state.echt * 3) * 1.5) * s;
      const px = x + Math.cos(a) * d;
      const py = y - Math.sin(a) * d;
      g.beginPath();
      g.moveTo(px - Math.cos(a - 0.6) * 4 * s, py + Math.sin(a - 0.6) * 4 * s);
      g.lineTo(px, py);
      g.lineTo(px - Math.cos(a + 0.6) * 4 * s, py + Math.sin(a + 0.6) * 4 * s);
      g.stroke();
    }
  }

  // Oben links, unter den Knöpfen: die Punkte mit einer kleinen Uhr, deren
  // Zeiger mit der Weltzeit läuft (und fast steht, wenn der Ninja steht),
  // darunter gross der Tempo-Bonus dieses Raums – die Zahl, die es gerade
  // gäbe, und ein Balken, der bis zur nächsten Stufe abläuft: Wer stehen
  // bleibt, sieht ihn schrumpfen –, dann der Raum.
  function zeichneAnzeige() {
    if (state.phase === "bereit") return;
    flachTransform();
    g.translate(0, view.frei);
    const gross = clamp(view.cssH * 0.045, 14, 22);
    g.font = `900 ${Math.round(gross)}px system-ui, sans-serif`;
    g.textAlign = "left";
    g.textBaseline = "middle";
    const text = String(state.punkte);
    const x = 12;
    let y = 10;
    const w = g.measureText(text).width + gross * 2.2;
    const hoch = gross * 1.6;
    const pille = (px, py, pw, ph, farbe) => {
      g.fillStyle = farbe;
      g.beginPath();
      if (g.roundRect) g.roundRect(px, py, pw, ph, ph / 2);
      else g.rect(px, py, pw, ph);
      g.fill();
    };
    pille(x, y, w, hoch, "rgba(10, 14, 28, 0.62)");
    const ux = x + gross * 0.85;
    const uy = y + hoch / 2;
    const ur = gross * 0.48;
    g.strokeStyle = "rgba(255, 255, 255, 0.35)";
    g.lineWidth = 2;
    g.beginPath();
    g.arc(ux, uy, ur, 0, PI2);
    g.stroke();
    g.strokeStyle = state.tempo > 0.5 ? "#ffcf6b" : "#9fd2ff";
    g.beginPath();
    g.arc(ux, uy, ur, -Math.PI / 2, -Math.PI / 2 + PI2 * clamp(state.tempo, 0, 1));
    g.stroke();
    const zeiger = state.W * 2.2 - Math.PI / 2;
    g.strokeStyle = "#ffffff";
    g.lineWidth = 2;
    g.lineCap = "round";
    g.beginPath();
    g.moveTo(ux, uy);
    g.lineTo(ux + Math.cos(zeiger) * ur * 0.7, uy + Math.sin(zeiger) * ur * 0.7);
    g.stroke();
    g.fillStyle = "#ffffff";
    g.fillText(text, x + gross * 1.6, uy + 1);
    y += hoch + 6;

    const klein = Math.round(gross * 0.62);
    g.font = `800 ${klein}px system-ui, sans-serif`;
    const zeile = (inhalt, farbe, schrift) => {
      const pw = g.measureText(inhalt).width + klein * 1.4;
      const ph = klein * 1.7;
      pille(x, y, pw, ph, farbe);
      g.fillStyle = schrift;
      g.fillText(inhalt, x + klein * 0.7, y + ph / 2 + 1);
      y += ph + 5;
    };
    if (state.phase === "spiel" && state.schritt === "lauf") {
      const i = tempoStufe(state.echtRaum);
      const stufe = TEMPO_STUFEN[i] || null;
      const von = i > 0 ? TEMPO_STUFEN[i - 1][0] : 0;
      const rest = stufe ? clamp((stufe[0] - state.echtRaum) / (stufe[0] - von), 0, 1) : 0;
      const farbe = stufe ? TEMPO_FARBEN[i] : "rgba(205, 210, 225, 0.5)";
      // So breit wie «+10» und die Beschriftung – die Pille springt nicht,
      // wenn die Stufe wechselt.
      g.font = `900 ${Math.round(gross * 1.2)}px system-ui, sans-serif`;
      const zw = g.measureText(`+${TEMPO_STUFEN[0][1]}`).width;
      g.font = `900 ${Math.round(gross * 0.5)}px system-ui, sans-serif`;
      const lw = g.measureText("TEMPO-BONUS").width;
      const pw = gross * 1.75 + zw + lw;
      const ph = gross * 2.1;
      pille(x, y, pw, ph, "rgba(10, 14, 28, 0.74)");
      g.strokeStyle = farbe;
      g.lineWidth = 2;
      g.beginPath();
      if (g.roundRect) g.roundRect(x + 1, y + 1, pw - 2, ph - 2, (ph - 2) / 2);
      else g.rect(x + 1, y + 1, pw - 2, ph - 2);
      g.stroke();
      const zahl = `+${stufe ? stufe[1] : 0}`;
      g.font = `900 ${Math.round(gross * 1.2)}px system-ui, sans-serif`;
      g.fillStyle = farbe;
      g.fillText(zahl, x + gross * 0.6, y + ph / 2 + 1);
      const lx = x + gross * 0.6 + zw + gross * 0.45;
      g.font = `900 ${Math.round(gross * 0.5)}px system-ui, sans-serif`;
      g.fillStyle = stufe ? "#ffffff" : "rgba(230, 236, 247, 0.6)";
      g.fillText("TEMPO-BONUS", lx, y + ph * 0.36);
      const bw = x + pw - gross * 0.6 - lx;
      const bh = Math.max(4, gross * 0.22);
      const by = y + ph * 0.66 - bh / 2;
      pille(lx, by, bw, bh, "rgba(255, 255, 255, 0.16)");
      if (rest > 0) pille(lx, by, Math.max(bh, bw * rest), bh, farbe);
      y += ph + 6;
    }
    zeile(`Raum ${state.raum + 1}`, "rgba(10, 14, 28, 0.55)", "#e6ecf7");
  }

  // Das Steuerfeld: ein feines Quadrat mit Pfeilen in alle vier Richtungen
  // und einem Kreis in der Mitte, wo er stehen bleibt. Hält es ein Finger,
  // zeigt ein Knopf, wohin er führt, und der Pfeil in diese Richtung
  // leuchtet. Vor dem Start und nach einem Tipp daneben winkt es.
  function zeichnePad() {
    if (state.phase !== "spiel" && state.phase !== "bereit") return;
    flachTransform();
    const { x, y, halb } = pad;
    const aktiv = pad.id !== null;
    const winkt = !aktiv && !ruhig() && (state.phase === "bereit" || state.echt - pad.hinweis < 1.2);
    const puls = winkt ? 0.5 + 0.5 * Math.sin(state.echt * 6) : 0;
    g.save();
    g.globalAlpha = aktiv ? 1 : 0.7 + 0.3 * puls;
    g.fillStyle = aktiv ? "rgba(8, 12, 24, 0.42)" : "rgba(8, 12, 24, 0.3)";
    g.strokeStyle = `rgba(255, 255, 255, ${aktiv ? 0.4 : 0.24 + 0.2 * puls})`;
    g.lineWidth = 1.5;
    g.beginPath();
    if (g.roundRect) g.roundRect(x - halb, y - halb, 2 * halb, 2 * halb, halb * 0.3);
    else g.rect(x - halb, y - halb, 2 * halb, 2 * halb);
    g.fill();
    g.stroke();
    g.strokeStyle = "rgba(255, 255, 255, 0.2)";
    g.lineWidth = 1;
    g.beginPath();
    g.arc(x, y, halb * PAD_TOT * 1.25, 0, PI2);
    g.stroke();
    const r = pad.richtung;
    const st = Math.hypot(r.x, r.y);
    const spitze = halb * 0.17;
    for (const [dx, dy] of [[0, 1], [1, 0], [0, -1], [-1, 0]]) {
      const an = aktiv && st > 0 ? Math.max(0, (r.x * dx + r.y * dy) / st) : 0;
      const px = x + dx * halb * 0.7;
      const py = y - dy * halb * 0.7;
      g.strokeStyle = `rgba(255, 255, 255, ${0.4 + 0.6 * an})`;
      g.lineWidth = 2.5;
      g.lineCap = "round";
      g.lineJoin = "round";
      g.beginPath();
      g.moveTo(px - dy * spitze - dx * spitze * 0.6, py - dx * spitze + dy * spitze * 0.6);
      g.lineTo(px + dx * spitze * 0.4, py - dy * spitze * 0.4);
      g.lineTo(px + dy * spitze - dx * spitze * 0.6, py + dx * spitze + dy * spitze * 0.6);
      g.stroke();
    }
    if (aktiv) {
      g.strokeStyle = "rgba(255, 255, 255, 0.35)";
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(pad.knopfX, pad.knopfY);
      g.stroke();
      g.fillStyle = "rgba(255, 255, 255, 0.9)";
      g.strokeStyle = "#3FA34D";
      g.lineWidth = 3;
      g.beginPath();
      g.arc(pad.knopfX, pad.knopfY, halb * 0.24, 0, PI2);
      g.fill();
      g.stroke();
    }
    g.restore();
  }

  function zeichnen() {
    if (!g) return;
    const [von, bis] = raeumeImBild();
    zeichneHintergrund(von, bis);
    bildTransform();
    const r = aktRaum();
    const nachbar = state.raeume[state.raum + 1];
    zeichneFallen(r, state.tau);
    zeichneKaelte();
    bildTransform();
    zeichneFlackern(r);
    if (nachbar) zeichneRollen(nachbar, false);
    zeichneKegel(r, state.tau);
    zeichneTore(r, true);
    zeichneRollen(r, true);
    zeichneKlingen(r, state.tau);
    zeichneWachen(r, state.tau);
    zeichneSchuetzen(r, state.tau, state.phase !== "bereit");
    zeichnePfeile(r);
    zeichneSterne(r);
    zeichneGeister();
    zeichneNinja();
    zeichneTeile();
    zeichneBlaetter();
    zeichneSchriften();
    zeichneHinweis();
    zeichneSchnitt();
    flachTransform();
    if (state.blitz > 0.01 && !ruhig()) {
      g.fillStyle = `rgba(255, 240, 235, ${state.blitz * 0.35})`;
      g.fillRect(0, 0, view.cssW, view.cssH);
    }
    zeichneAnzeige();
    zeichnePad();
  }

  // ---------------------------------------------------------------------------
  // Der Takt
  // ---------------------------------------------------------------------------
  function takt(dt) {
    state.echt += dt;
    state.weltFrame = 0;
    if (state.phase === "zuschauen") {
      zuschauenTakt(dt);
    } else if (state.phase === "spiel") {
      state.akku += dt;
      let n = Math.floor(state.akku / TAKT + 1e-7);
      state.akku -= n * TAKT;
      if (n > 48) { n = 48; state.akku = 0; }
      for (let i = 0; i < n; i += 1) schritt();
    } else if (state.phase === "bereit") {
      // Vor dem ersten Zug steht die Welt fast: Nur die Blätter schweben.
      state.weltFrame = dt * R_MIN;
    }
    const n = state.ninja;
    // Das Tempo der Welt fürs Bild: geglättet.
    const ziel = state.phase === "spiel" || state.phase === "zuschauen" ? (state.schritt === "wechsel" ? state.tempo : state.rate) : R_MIN;
    state.tempo += (ziel - state.tempo) * Math.min(1, dt / 0.12);
    n.schwung += ((state.rate > 0.2 || state.schritt === "wechsel" ? 1 : 0) - n.schwung) * Math.min(1, dt / 0.08);
    n.blick += winkelDiff(n.blickZiel, n.blick) * Math.min(1, dt / 0.06);
    if (state.stoss > 0) state.stoss = Math.max(0, state.stoss - dt * 2.6);
    if (state.blitz > 0) state.blitz = Math.max(0, state.blitz - dt * 3.5);
    if (kam.t < 1) {
      kam.t = Math.min(1, kam.t + dt / KAMERA);
      kam.y = lerp(kam.von, kam.nach, weich(kam.t));
    }

    // Nachbilder, wenn er schnell läuft.
    state.nachbildUhr += dt;
    if (!ruhig() && !state.aus && state.rate > 0.55 && state.nachbildUhr > 0.035 && state.phase !== "bereit") {
      state.nachbildUhr = 0;
      state.nachbilder.push({ x: n.x, y: n.y, blick: n.blick, lauf: n.lauf, alter: 0 });
      if (state.nachbilder.length > 6) state.nachbilder.shift();
    }
    for (let i = state.nachbilder.length - 1; i >= 0; i -= 1) {
      state.nachbilder[i].alter += dt;
      if (state.nachbilder[i].alter > 0.24) state.nachbilder.splice(i, 1);
    }

    const wdt = state.weltFrame;
    blaetterTakt(wdt);
    for (let i = state.teile.length - 1; i >= 0; i -= 1) {
      const t = state.teile[i];
      const h = t.echt ? dt : wdt;
      if (t.art === "rauch") { t.vx *= 1 - 2.5 * h; t.vy *= 1 - 2.5 * h; }
      else if (t.art === "blatt") { t.vx *= 1 - 1.2 * h; t.vy = t.vy * (1 - 1.2 * h) - 12 * h; t.dreh += h * 5; }
      else { t.vx *= 1 - 2 * h; t.vy *= 1 - 2 * h; }
      t.x += t.vx * h;
      t.y += t.vy * h;
      t.leben -= h;
      if (t.leben <= 0) state.teile.splice(i, 1);
    }
    for (const st of state.stecken) st.alter += wdt;
    for (let i = state.schriften.length - 1; i >= 0; i -= 1) {
      state.schriften[i].leben -= dt;
      if (state.schriften[i].leben <= 0) state.schriften.splice(i, 1);
    }

    klangTakt();

    if (state.phase === "spiel") {
      if (state.schritt !== "aus") {
        gegner?.takt(state.punkte, { a: Math.round(n.x), b: Math.round(n.y), c: Math.round(state.W * 100) });
      } else if (state.echt - state.ausEcht >= AUS_DAUER) {
        finish();
      }
    }
  }

  function loop(now) {
    frame = window.requestAnimationFrame(loop);
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
    last = now;
    messen();
    takt(dt);
    zeichnen();
  }

  // ---------------------------------------------------------------------------
  // Zuschauen
  // ---------------------------------------------------------------------------
  /*
   * Eine aufgezeichnete Runde in ihren eigenen Räumen: Der Zufall hält die
   * Saat (geist.js, zuschauer), startRun würfelt damit dieselben Räume, und
   * der Ninja steht Bild für Bild dort, wo er damals war. Die Weltzeit kommt
   * aus c – zwischen zwei Proben läuft sie mit dem Weg des Ninjas weiter,
   * sanft zur aufgezeichneten gezogen. Im Tor stand sie still: Dort gilt sie
   * genau, und der nächste Raum beginnt zur selben Weltzeit wie damals. Was
   * zielt, zielt auf den Ninja von damals.
   */
  function zuschauenStarten() {
    if (!zuschauer?.lauf) return;
    startRun();
    state.phase = "zuschauen";
    state.schritt = "lauf";
    state.zs = { W: 0, start: true, ende: false, frieren: false, frierW: 0 };
    shell.setPhase("play");
    zuschauer.los();
  }

  function zuschauenTakt(dt) {
    const s = zuschauer.stand();
    if (!s) return;
    const n = state.ninja;
    const zs = state.zs;
    if (zs.start) {
      zs.start = false;
      n.x = s.a;
      n.y = s.b;
    }
    raumBis(state.raum + 3);
    const r = aktRaum();
    const cZiel = Math.max(0, (Number(s.c) || 0) / 100);
    const imTor = s.b - r.y0 > RAUM_H - 2;
    let W = zs.W;
    // Nach dem Tor steht die Zeit, bis die Aufzeichnung sie wieder laufen
    // lässt – so lange, wie der Ninja damals noch in den Raum ging.
    if (zs.frieren && cZiel > zs.frierW + 0.005) zs.frieren = false;
    if (imTor || zs.frieren) {
      W = Math.max(W, cZiel);
    } else {
      const v = Math.hypot(s.va || 0, s.vb || 0);
      W += clamp(v / V_MAX, R_MIN, 1) * dt;
      W += (cZiel - W) * Math.min(1, dt / 0.25);
      W = Math.max(zs.W, W);
    }
    const dW = W - zs.W;
    const altX = n.x;
    const altY = n.y;
    const teile = Math.max(1, Math.min(400, Math.ceil(dW / TAKT)));
    const rate = dt > 0 ? clamp(dW / dt, 0, 1) : 0;
    state.rate = imTor ? 0 : Math.max(R_MIN, rate);
    if (Math.hypot(s.va || 0, s.vb || 0) > 8) n.blickZiel = Math.atan2(s.vb, s.va);
    // Wie schnell er in der Welt lief – für die Schützen, die vorhalten.
    if (dW > 1e-5) {
      n.wvx = (s.a - altX) / dW;
      n.wvy = (s.b - altY) / dW;
    }
    for (let i = 1; i <= teile; i += 1) {
      const f = i / teile;
      n.x = lerp(altX, s.a, f);
      n.y = lerp(altY, s.b, f);
      if (n.y >= (state.raum + 1) * SCHRITT + 2) zuschauRaum();
      if (dW > 0) welt(dW / teile);
      const rr = aktRaum();
      for (let j = 0; j < rr.rollen.length; j += 1) {
        if (!state.rollen[j] && Math.hypot(n.x - rr.rollen[j].x, n.y - rr.y0 - rr.rollen[j].y) < R_NINJA + 7) {
          state.rollen[j] = true;
          funken(rr.y0, rr.rollen[j].x, rr.rollen[j].y, 16, ["#fff4c2", "#ffd23f", "#ffb02e", "#ffffff"], 120, true);
          ton("ninja.rolle");
        }
      }
    }
    n.lauf += Math.hypot(n.x - altX, n.y - altY) * 0.38;
    zs.W = W;
    const punkte = Math.max(0, Math.floor(s.punkte || 0));
    if (punkte !== state.punkte) {
      state.punkte = punkte;
      shell.setCount(punkte);
    }
    // Der Treffer: Die Aufzeichnung endet AUS_DAUER danach.
    const dauer = zuschauer.lauf?.dauer;
    if (!zs.ende && Number.isFinite(dauer) && s.t >= dauer - AUS_DAUER * 1000 + 50) {
      zs.ende = true;
      state.schritt = "aus";
      state.ausEcht = state.echt;
      state.aus = { x: n.x, y: n.y, winkel: n.blick, t0: state.echt, art: "", dreh: 0.4 };
      state.stoss = 1;
      state.blitz = 1;
      rauch(n.x, n.y, 18);
      herz.aus();
      ton("ninja.treffer", {}, 300);
    }
    zuschauer.weiter();
  }

  // Beim Zuschauen in den nächsten Raum: Die Weltzeit hier ist genau die von
  // damals – sie stand im Tor still.
  function zuschauRaum() {
    const r = aktRaum();
    const geschafft = state.raum + 1;
    r.tauStand = state.tau;
    raumBetreten(geschafft);
    state.geschafft = geschafft;
    state.zs.frieren = true;
    state.zs.frierW = state.W;
    schrift(`+${PUNKTE_RAUM}`, r.torO, RAUM_H + 26, r.y0, "#ffffff", 22, 1.2);
    ton("meilenstein", {}, 500);
    kameraZu(geschafft);
  }

  // ---------------------------------------------------------------------------
  // Eingabe
  // ---------------------------------------------------------------------------
  // Die Runde beginnt: mit dem ersten Zug – oder im Live-Modus zum
  // gemeinsamen Start (game-shell.js, live.los).
  function losGehts() {
    if (state.phase !== "bereit") return;
    state.phase = "spiel";
    state.schritt = "lauf";
    state.echtRaum = 0;
    state.akku = 0;
    shell.setPhase("play");
    gegner?.los();
    kids()?.vibrate?.(8);
  }

  // Das Steuerfeld, gehalten an (px, py) Bildpunkten: die Richtung – in der
  // Mitte steht er, ab PAD_VOLL zum Rand läuft er voll; über den Rand hinaus
  // bleibt der Knopf am Rand.
  function padRichtung(px, py) {
    const vx = clamp((px - pad.x) / pad.halb, -1, 1);
    const vy = clamp((pad.y - py) / pad.halb, -1, 1);
    pad.knopfX = pad.x + vx * pad.halb;
    pad.knopfY = pad.y - vy * pad.halb;
    const l = Math.hypot(vx, vy);
    if (l < PAD_TOT) {
      pad.richtung = { x: 0, y: 0 };
      return;
    }
    const m = clamp((l - PAD_TOT) / (PAD_VOLL - PAD_TOT), 0, 1);
    pad.richtung = { x: (vx / l) * m, y: (vy / l) * m };
    // Die Runde beginnt mit dem ersten Schritt – im Live-Modus zum
    // gemeinsamen Start.
    if (state.phase === "bereit" && !shell.live) losGehts();
  }

  function padLos() {
    pad.id = null;
    pad.richtung = { x: 0, y: 0 };
  }

  // ---------------------------------------------------------------------------
  // Ablauf
  // ---------------------------------------------------------------------------
  function startRun() {
    stopLoop();
    herz.aus();
    blitzFolge = 0;
    shell.closeOverlay();
    zufall.neu();
    shell.setPhase("intro");
    state.phase = "bereit";
    state.schritt = "lauf";
    state.punkte = 0;
    state.geschafft = 0;
    state.rollenZahl = 0;
    state.tempoBonus = 0;
    state.raeume = [];
    raumBis(3);
    state.W = 0;
    state.rate = R_MIN;
    state.tempo = R_MIN;
    state.ninja = { x: state.raeume[0].ein.x, y: state.raeume[0].ein.y, wvx: 0, wvy: 0, blick: Math.PI / 2, blickZiel: Math.PI / 2, lauf: 0, schwung: 0 };
    state.steuer = null;
    state.plan = [];
    state.planI = 0;
    state.sim = false;
    state.grund = "";
    state.aus = null;
    state.ausEcht = 0;
    state.teile = [];
    state.schriften = [];
    state.nachbilder = [];
    state.stecken = [];
    state.stoss = 0;
    state.blitz = 0;
    state.zeit = 0;
    state.echt = 0;
    state.akku = 0;
    state.zs = null;
    raumBetreten(0);
    state.tuerZu = -9;
    tasten.links = tasten.rechts = tasten.hoch = tasten.runter = false;
    padLos();
    shell.setCount(0);
    gegner?.runde();

    shell.clear();
    promptKnoten = shell.el("p", "cm-prompt nj-prompt", "Steuern im Feld unten – die Zeit läuft nur, wenn du läufst.");
    shell.play.append(promptKnoten, buildPlatz());
    view.cssW = 0;
    view.cssH = 0;
    kam.t = 1;
    messen();
    kam.y = kamZiel(0);
    kam.nach = kam.y;

    last = performance.now();
    frame = window.requestAnimationFrame(loop);
  }

  function zaehleHoch(ziel) {
    const zahl = host.querySelector(".cm-result-score");
    if (!zahl) return;
    if (ruhig() || ziel <= 1) { zahl.textContent = String(ziel); return; }
    const dauer = Math.min(800, 160 + ziel * 4);
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
    stopLoop();
    if (state.phase === "ende" || state.phase === "zuschauen") return;
    state.phase = "ende";
    herz.aus();
    const punkte = state.punkte;
    const geist = gegner?.ende(punkte) || null;
    const vorher = Number(store.read()?.scores?.[0]) || 0;
    const rekord = punkte > vorher;
    store.update((old) => ({
      runs: (Number(old.runs) || 0) + 1,
      scores: [...(old.scores || []), punkte].sort((x, y) => y - x).slice(0, TOP_COUNT),
    }));
    const grund = GRUENDE[state.grund]?.[1] || "";
    const raeume = state.geschafft === 1 ? "1 Raum" : `${state.geschafft} Räume`;
    const best = vorher ? `Bestwert ${vorher}` : "";
    shell.showResult({
      label: "Deine Punkte",
      points: punkte,
      detail: rekord ? "Neuer Rekord!" : [grund, raeume, best].filter(Boolean).join(" · "),
      geist,
    });
    if (rekord) host.querySelector(".cm-result-detail")?.classList.add("nj-rekord");
    zaehleHoch(punkte);
  }

  // ---------------------------------------------------------------------------
  // Start
  // ---------------------------------------------------------------------------
  shell = shellApi.mount({
    host,
    title: "Zeitlupen-Ninja",
    area: "problemloesen",
    accent: "#3FA34D",
    accentDark: "#2c7337",
    clock: false,
    onRestart: () => (zuschauer ? zuschauenStarten() : startRun()),
    live: { los: losGehts, stopp: () => finish(), zuschauen: (quelle) => { zuschauer = quelle; zuschauenStarten(); } },
  });
  zuschauer = window.LernappGeist?.zuschauer?.({
    host, spiel: "timeNinja", fassung: "t1", zufall, einheit: "Punkte", nochmal: zuschauenStarten,
  }) || null;
  if (!zuschauer) {
    gegner = window.LernappGeist?.fuer?.({ spiel: "timeNinja", host, art: "tempo", alle: true, zufall }) || null;
  }

  startRun();
  zuschauer?.laden.then((da) => { if (da) zuschauenStarten(); });

  // Finger oder Maus aufs Steuerfeld (etwas grosszügiger als gezeichnet):
  // Es führt, bis er loslässt – auch wenn er dabei hinausrutscht, dann am
  // Rand, mit vollem Tempo. Ein neuer Finger übernimmt. Anderswo aufs Bild
  // getippt, winkt das Feld.
  const imBild = (event) => {
    const rect = canvas?.getBoundingClientRect();
    if (!rect?.width) return null;
    const k = view.cssW / rect.width;
    return { x: (event.clientX - rect.left) * k, y: (event.clientY - rect.top) * k };
  };
  host.addEventListener("pointerdown", (event) => {
    if (event.target.closest("button, a, input")) return;
    if (state.phase === "zuschauen" || state.phase === "ende") return;
    const p = imBild(event);
    if (!p) return;
    const griff = pad.halb + 28;
    if (Math.abs(p.x - pad.x) > griff || Math.abs(p.y - pad.y) > griff) {
      pad.hinweis = state.echt;
      return;
    }
    event.preventDefault();
    pad.id = event.pointerId;
    padRichtung(p.x, p.y);
  });
  window.addEventListener("pointermove", (event) => {
    if (pad.id === null || event.pointerId !== pad.id) return;
    const p = imBild(event);
    if (p) padRichtung(p.x, p.y);
  });
  const fingerWeg = (event) => {
    if (pad.id !== null && event.pointerId === pad.id) padLos();
  };
  window.addEventListener("pointerup", fingerWeg);
  window.addEventListener("pointercancel", fingerWeg);

  // Pfeile und WASD: immer mit voller Geschwindigkeit, solange sie gedrückt
  // sind.
  const TASTEN = {
    ArrowLeft: "links", ArrowRight: "rechts", ArrowUp: "hoch", ArrowDown: "runter",
    a: "links", d: "rechts", w: "hoch", s: "runter", A: "links", D: "rechts", W: "hoch", S: "runter",
  };
  document.addEventListener("keydown", (event) => {
    const art = TASTEN[event.key];
    if (!art) return;
    if (document.activeElement?.tagName === "BUTTON") return;
    event.preventDefault();
    if (state.phase === "zuschauen" || state.phase === "ende") return;
    tasten[art] = true;
    if (state.phase === "bereit" && !shell.live) losGehts();
  });
  document.addEventListener("keyup", (event) => {
    const art = TASTEN[event.key];
    if (art) tasten[art] = false;
  });
  // Wer das Fenster verlässt, lässt auch Finger und Tasten los.
  window.addEventListener("blur", () => {
    padLos();
    tasten.links = tasten.rechts = tasten.hoch = tasten.runter = false;
  });

  window.addEventListener("resize", messen);
  window.addEventListener("orientationchange", messen);
  window.addEventListener("pagehide", stopLoop);

  // Die gewürfelte Welt als Text: die ersten vier Räume mit ihren Toren und
  // allem, was darin steht, gerundet. Im Turnier für alle derselbe.
  function weltText() {
    raumBis(3);
    const z = (x) => Math.round(x);
    return state.raeume.slice(0, 4).map((r) => [
      `R${r.k} ${z(r.torU)}>${z(r.torO)}`,
      r.saeulen.map((c) => `o${z(c.x)}/${z(c.y)}`).join(","),
      r.stuecke.map((q) => `m${z(q[0])}/${z(q[1])}/${z(q[2])}`).join(","),
      r.salven.map((s) => `s${z(s.ox)}/${z(s.oy)}/${z(s.v)}/${s.P.toFixed(2)}/${s.n}`).join(","),
      r.schuetzen.map((s) => `${s.art[0]}${z(s.x)}/${z(s.y)}/${z(s.v)}/${s.P.toFixed(2)}`).join(","),
      r.klingen.map((b) => `k${z(b.x)}/${z(b.y)}/${z(b.L)}/${b.w.toFixed(2)}`).join(","),
      r.wachen.map((w) => `w${z(w.x)}/${z(w.y)}/${z(w.R)}`).join(","),
      r.fallen.map((f) => `f${z(f.x0)}/${z(f.y0)}/${f.P.toFixed(2)}`).join(","),
      r.rollen.map((q) => `r${z(q.x)}/${z(q.y)}`).join(","),
    ].join(" ")).join(" | ");
  }

  // Für die Prüfskripte und die Vorführung. Koordinaten in Welteinheiten (y
  // nach oben, Raum k ab k · SCHRITT). steuere(x, y): eine Richtung (Länge
  // bis 1 = volles Tempo) wie mit den Tasten, null lässt los; plane(liste):
  // eine Eingabe je Rechenschritt. schritt() rechnet genau einen Schritt.
  // sichern()/zurueck(): der ganze Lauf zum Vorausrechnen, mit sim(true)
  // ohne Bild und Ton.
  window.LernappNinja = {
    HALB, RAUM_H, WAND, SCHRITT, TOR, TAKT, V_MAX, R_MIN, R_NINJA, R_TREFF, LUNTE, DECKEL,
    state, view, kam, takt, schritt, losGehts, weltText, raumBis,
    // Wo das Steuerfeld steht (Bildpunkte der Leinwand) – für die Prüfung.
    pad: () => ({ x: pad.x, y: pad.y, halb: pad.halb, seitlich: pad.seitlich }),
    saat: () => zufall.saat?.() ?? null,
    halte: (saat) => zufall.halte?.(saat),
    get ninja() { return state.ninja; },
    raum: (k = state.raum) => { raumBis(k); return state.raeume[k]; },
    steuere: (x, y) => { state.steuer = x === null || x === undefined ? null : { x, y }; },
    plane: (liste) => { state.plan = liste.slice(); state.planI = 0; },
    sim: (an) => { state.sim = Boolean(an); },
    gefahrBei: (x, y) => gefahrBei(aktRaum(), x, y - aktRaum().y0, state.tau),
    wegZumTor: (x, y, k = state.raum) => { raumBis(k); return wegZumTor(state.raeume[k], x, y - state.raeume[k].y0); },
    sichern() {
      return {
        ninja: { ...state.ninja },
        W: state.W, tau: state.tau, raum: state.raum, schritt: state.schritt, punkte: state.punkte,
        geschafft: state.geschafft, rollenZahl: state.rollenZahl, tempoBonus: state.tempoBonus,
        echtRaum: state.echtRaum, rate: state.rate, lunte: state.lunte, grund: state.grund, akku: state.akku,
        wechsel: state.wechsel ? { ...state.wechsel } : null,
        pfeile: state.pfeile.map((p) => ({ ...p })),
        sterne: state.sterne.map((st) => ({ ...st, spur: [] })),
        wachen: state.wachen.map((w) => ({ ...w })),
        rollen: state.rollen.slice(),
      };
    },
    zurueck(k) {
      Object.assign(state, {
        ...k,
        ninja: { ...k.ninja },
        wechsel: k.wechsel ? { ...k.wechsel } : null,
        pfeile: k.pfeile.map((p) => ({ ...p })),
        sterne: k.sterne.map((st) => ({ ...st, spur: [] })),
        wachen: k.wachen.map((w) => ({ ...w })),
        rollen: k.rollen.slice(),
      });
    },
    bildX, bildY, weltX, weltY,
    // Für Bilder zum Anschauen: das Bild anhalten und einmal malen.
    anhalten: stopLoop,
    zeichnen: () => { messen(); zeichnen(); },
  };
})();
