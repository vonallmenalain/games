/*
 * seifenblase.js – Seifenblase.
 * ---------------------------------------------------------------------------
 * Ein Sommerabend im Garten. Aus dem Ring über der Schale steigt eine
 * Seifenblase auf – langsam, von selbst, durch eine Welt voller Dinge, an
 * denen sie zerplatzt. Man berührt sie nie. Eine Regel: Ein Tipp irgendwo
 * aufs Bild bläst einen kurzen Luftstoss von der Stelle des Fingers weg, und
 * die Blase treibt vom Finger fort – umso stärker, je näher man tippt. Unter
 * ihr getippt steigt sie schneller, links von ihr treibt sie nach rechts,
 * über ihr bremst sie. Man schiebt, indem man daneben tippt; das ist
 * ungewohnt und wird mit Übung sehr genau. Wer sie selbst trifft, dem
 * zerplatzt sie unter dem Finger.
 *
 * Die Blase hat Auftrieb (sie steigt immer ein wenig schneller), Luft-
 * widerstand (ein Stoss klingt ab) und treibt im Seitenwind, den Pollen,
 * Samen und Blätter zeigen. Zu viele Tipps kurz hintereinander schaukeln sie
 * auf. Von unten steigt der Abendnebel: Wer zu lange bremst, den holt er ein.
 * Zerplatzen lässt sie alles Spitze, Harte und Nasse – Dornen, Nadeln,
 * Kanten, Spinnennetze, Tropfen, Wespen, Vögel, Wolken – und der Rand des
 * Feldes: Hecke, Stamm, Hauswand, Gewitterregen. Was sie trifft, trifft sie
 * genau dort, wo es gemalt ist: Jedes Hindernis besteht aus Kreisen, Stäben
 * und Vielecken (prims), und dieselben werden gerechnet und gemalt.
 *
 * Die Reise geht nach oben, und die Welt wechselt mit der Höhe: der Garten
 * im Abendlicht (Rosen, Brennnesseln, ein tropfender Gartenschlauch), die
 * Baumkrone (Äste, Tannenzweige, Spinnennetze mit Tau, Wespen), die Dächer
 * der Altstadt (Balkone, Vordächer mit Kaminen und tropfenden Rinnen,
 * Antennen, Schwalben) und der Abendhimmel (Wolkenbänke, Wolkenfetzen,
 * Mauersegler, die ersten Sterne). Jeder achte Abschnitt ist besonders, im
 * festen Wechsel und vorher angesagt: ein Aufwind – eine warme Säule, die
 * die Blase schnell durch eine enge Stelle trägt – oder eine Böe, ein
 * starker Seitenwind, gegen den man von der Windseite tippen muss.
 *
 * Gebaut wird die Welt aus dem Zufall (zufall.js): ohne Turnier jedes Mal
 * eine andere, im Turnier für alle im selben Versuch dieselbe. Sie hängt nur
 * an der Saat, die Runde nur an Spielzeit, Saat und den Tipps (Zeit und Ort
 * in der Welt). Sie ist immer zu schaffen, weil zuerst ein Weg entsteht –
 * eine Gasse, die Reihe um Reihe hinaufführt, mit einem Zeitplan, wann eine
 * Blase auf ihr wo ist (wegX, zeitplan) – und dann die Hindernisse um sie
 * herum, so weit weg, dass wer «marge» daneben oder «luft» zu früh oder zu
 * spät ist, noch durchkommt. Jeder Abschnitt wird nachgeprüft (sicher): die
 * ganze Breite der Gasse, und bei allem, was sich bewegt, auch zu früh und
 * zu spät. Die Gasse wird mit der Zeit enger, die Blase schneller.
 *
 * Das Bild: Der Himmel, die Ferne, die Kulissen der vier Welten, die Ränder
 * und der Nebel werden einmal gemalt und dann nur noch aufgelegt, Punkt auf
 * Punkt – auf dem iPhone rechnet der Prozessor jede gemalte Fläche, jedes
 * Bild. Jedes Hindernis wird beim ersten Erscheinen in ein eigenes Bild
 * gemalt. Die schillernde Blase selbst ist ein vorgerechneter Seifenfilm
 * (Farben dünner Schichten, filmBild), der sich in ihr dreht, mit einer
 * Maske, die zum Rand hin mehr spiegelt, darüber Glanz und Fensterkreuz.
 * Beim ersten Start wächst sie erst aus dem Ring.
 *
 * Die Gegner (geist.js) steigen als Blasen aus Licht mit, und die besten
 * Läufe lassen sich anschauen (?zuschauen=): in derselben Welt, gebaut mit
 * derselben Saat; die Luftstösse stehen in der Aufzeichnung, mit Richtung
 * und Abstand des Fingers, und sind beim Zuschauen zu sehen.
 *
 * Eine Einheit ist ein Zentimeter, hundert sind ein Meter. x zählt quer (die
 * Ränder stehen bei −RAND und +RAND), y nach oben; die Blase startet bei 0.
 */
(() => {
  "use strict";

  if (document.body.dataset.page !== "seifenblase") return;

  const host = document.querySelector("#sb-stage");
  const shellApi = window.LernappGameShell;
  const cloudApi = window.LernappGameCloud;
  if (!host || !shellApi) return;

  const kids = () => window.LernappKids || null;
  const klang = () => window.ArcadeKlang || null;
  const ruhig = () => Boolean(kids()?.prefersReducedMotion?.());

  // Der Zufall. Nur die Welt zieht daraus – der Weg, die Hindernisse, der
  // Wind. Glitzer, Tröpfchen, Pollen und Glühwürmchen hängen an festen
  // Zahlen oder an Math.random.
  const zufall = window.LernappZufall?.fuer?.("soapBubble") || {
    neu() {},
    zahl: () => Math.random(),
  };

  // ---------------------------------------------------------------------------
  // Die Regeln
  // ---------------------------------------------------------------------------
  const METER = 100;
  const R = 7;                     // so gross ist sie (Halbmesser)
  const RH = R * 0.97;             // so nah darf etwas kommen – sie wabert ein wenig
  const RAND = 60;                 // die Ränder des Feldes, links und rechts
  // Der Luftwiderstand: So schnell gleicht sie sich dem Wind (quer) und
  // ihrem Auftrieb (hoch) an – ein Stoss ist nach 0,65 s auf gut ein Drittel
  // abgeklungen. Ein Stoss von J Einheiten je Sekunde trägt sie so um
  // J × TAU weit.
  const TAU_X = 0.65;
  const TAU_Y = 0.65;
  // Der Luftstoss: J0 dicht neben ihr, halb so stark D0 weiter weg, ab DMAX
  // nichts mehr. Wer näher als BERUEHRT an ihre Mitte tippt, trifft sie.
  const J0 = 80;
  const D0 = 22;
  const DMAX = 95;
  const BERUEHRT = R * 0.85;
  // Der Auftrieb nach der Spielzeit: von 38 cm in der Sekunde auf bald einen
  // Meter und mehr.
  const V0 = 38;
  const V_MAX = 125;
  const V_ZEIT = 55;
  // Die Marge: so weit darf sie neben der Gasse sein (je Seite). Die ersten
  // Sekunden 22 cm, nach 20 s gut 11, nach 40 s 6,5, nie unter 4,5.
  const M0 = 22;
  const M_MIN = 4.5;
  const M_ZEIT = 16;
  const M_AB = 5;
  // Die Luft: so viel zu früh oder zu spät darf sie bei allem sein, was sich
  // bewegt (Tropfen, Wespen, Vögel) – von 0,36 s gegen 0,12 s.
  const E0 = 0.36;
  const E_MIN = 0.12;
  const E_ZEIT = 20;
  const E_AB = 4;
  const SCHWER_ZEIT = 20;          // nach so vielen Sekunden sind gut sechs Zehntel der Härte da
  const SCHWER_AB = 4;
  const AUF = 3;                   // so viel schneller trägt der Aufwind
  // Die Tropfen: schwellen SCHWELL Sekunden lang an, dann fallen sie.
  const G_TROPFEN = 620;
  const R_TROPFEN = 2.3;
  const SCHWELL = 0.55;
  const FALL = 300;
  // So viel sieht man über der Blase voraus und unter ihr – auf jedem Gerät
  // gleich viel voraus, damit niemand mehr sieht als der andere.
  const SICHT_OBEN = 135;
  const SICHT_UNTEN = 62;
  const FELD_SICHT = 132;          // hochkant ist so viel quer im Bild
  const PLATEAU = 20;              // so lang führt die Gasse gerade durch eine Reihe
  const TAKT = 1 / 240;
  const PLAN_DT = 1 / 30;
  const STURZ_MS = 2100;
  // Die Fassung der Aufzeichnung: t2 seit Punkten mit Tempofaktor und der
  // Rennstrecke – Läufe in t1 (Meter, andere Welt) passen nicht mehr dazu.
  // Sie steht auch wörtlich bei zuschauer und fuer (unten), wo
  // scripts/pruefen.mjs sie mit mini-games.js (ANSEHBAR) vergleicht.
  const FASSUNG = "t2";
  // Die Welten nach der Höhe (in Einheiten), und wie weit sie ineinander
  // übergehen.
  const WELTEN = ["garten", "baum", "dach", "himmel"];
  const WELT_AB = [0, 700, 1700, 3800];
  const WELT_NAME = ["Der Garten", "Die Baumkrone", "Über den Dächern", "Der Abendhimmel"];
  const UEBERGANG = 140;

  const TOP_COUNT = 5;
  const store = cloudApi
    ? cloudApi.register({ key: "lernapp.seifenblase", empty: { runs: 0, scores: [] }, merge: cloudApi.mergeScores(TOP_COUNT) })
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

  const vAuf = (t) => V_MAX - (V_MAX - V0) * Math.exp(-Math.max(0, t) / V_ZEIT);
  const margeBei = (t) => M_MIN + (M0 - M_MIN) * Math.exp(-Math.max(0, t - M_AB) / M_ZEIT);
  const luftBei = (t) => E_MIN + (E0 - E_MIN) * Math.exp(-Math.max(0, t - E_AB) / E_ZEIT);
  const schwere = (t) => 1 - Math.exp(-Math.max(0, t - SCHWER_AB) / SCHWER_ZEIT);
  // So weit unter dem Zeitplan steigt der Nebel: am Start anderthalb Meter,
  // bald gut siebzig Zentimeter.
  const abstandNebel = (t) => 72 + 80 * Math.exp(-Math.max(0, t) / 10);

  /*
   * Die Punkte: die Höhe (in Dezimetern) mal dem Tempofaktor. Der Faktor
   * misst, wie viel schneller man im Mittel gestiegen ist als eine Blase,
   * die nur getragen wird – so schnell steigt auch der Nebel: je km/h mehr
   * im Durchschnitt TEMPO_K mehr, nie unter 1, nie über FAKTOR_MAX.
   * Linear im Tempo, nicht im Verhältnis: Wer in den ersten Sekunden
   * davonfliegt und dann zerplatzt, bekommt so viel, aber nicht mehr als
   * einer, der deutlich weiter kommt; wer gleich weit kommt und schneller
   * ist, liegt klar vorn. Der Faktor hängt nur an Höhe und Spielzeit;
   * Geister, Zuschauen und Turnier rechnen gleich.
   */
  const TEMPO_K = 0.2;
  const FAKTOR_MAX = 2;
  const KMH = 0.036;               // cm/s in km/h
  // So hoch ist eine nur getragene Blase nach t Sekunden.
  const hTrag = (t) => V_MAX * t - (V_MAX - V0) * V_ZEIT * (1 - Math.exp(-t / V_ZEIT));
  function faktorBei(h, t) {
    const tt = Math.max(1, t);
    const mehr = (Math.max(0, h) / tt - hTrag(tt) / tt) * KMH;
    return clamp(1 + TEMPO_K * mehr, 1, FAKTOR_MAX);
  }
  // Eine Zahl mit Komma, wie man sie hier schreibt.
  const zahlText = (x, stellen = 1) => x.toFixed(stellen).replace(".", ",");
  const punkteBei = (h, t) => Math.round((Math.max(0, h) / 10) * faktorBei(h, t));

  // Wie stark ein Luftstoss aus dem Abstand d (zur Mitte der Blase) ist, und
  // umgekehrt, wie weit weg man für einen Stoss der Stärke j tippt.
  function stossBei(d) {
    if (d >= DMAX) return 0;
    const q = (Math.max(d, R) - R) / D0;
    return (J0 / (1 + q * q)) * glatt((DMAX - d) / 25);
  }
  function abstandFuer(j) {
    let lo = R;
    let hi = DMAX;
    for (let i = 0; i < 22; i += 1) {
      const m = (lo + hi) / 2;
      if (stossBei(m) > j) lo = m; else hi = m;
    }
    return (lo + hi) / 2;
  }

  function hash01(n) {
    const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return x - Math.floor(x);
  }

  // Ein fester Zufall für das Bild: die Landschaft sieht jedes Mal gleich aus.
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

  // Welche Welt in der Höhe y – und wie weit es schon die nächste ist.
  function weltBei(y) {
    let i = 0;
    while (i + 1 < WELT_AB.length && y >= WELT_AB[i + 1]) i += 1;
    return i;
  }
  function weltMix(y) {
    for (let i = 1; i < WELT_AB.length; i += 1) {
      const d = y - WELT_AB[i];
      if (Math.abs(d) < UEBERGANG) return { a: i - 1, b: i, k: glatt((d + UEBERGANG) / (2 * UEBERGANG)) };
    }
    const w = weltBei(y);
    return { a: w, b: w, k: 0 };
  }

  // ---------------------------------------------------------------------------
  // Formen: Kreise, Stäbe, Vielecke – gerechnet und gemalt
  // ---------------------------------------------------------------------------
  // k: 0 Kreis (x, y, r), 1 Stab (von x1, y1 bis x2, y2, dick r), 2 Vieleck
  // (pts). rolle sagt, wie es gemalt wird.
  const kreis = (x, y, r, rolle) => ({ k: 0, x, y, r, rolle });
  const stab = (x1, y1, x2, y2, r, rolle) => ({ k: 1, x1, y1, x2, y2, r, rolle });
  const poly = (pts, rolle) => ({ k: 2, pts, rolle });

  function primBox(p) {
    if (p.k === 0) { p.x0 = p.x - p.r; p.x1 = p.x + p.r; p.y0 = p.y - p.r; p.y1 = p.y + p.r; return p; }
    if (p.k === 1) {
      p.x0 = Math.min(p.x1, p.x2) - p.r; p.x1b = Math.max(p.x1, p.x2) + p.r;
      p.y0 = Math.min(p.y1, p.y2) - p.r; p.y1b = Math.max(p.y1, p.y2) + p.r;
      return p;
    }
    let x0 = Infinity; let x1 = -Infinity; let y0 = Infinity; let y1 = -Infinity;
    p.pts.forEach(([x, y]) => { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); });
    p.x0 = x0; p.x1 = x1; p.y0 = y0; p.y1 = y1;
    return p;
  }
  // Die rechte und obere Kante (beim Stab heissen x1, y1 schon anders).
  const rechts = (p) => (p.k === 1 ? p.x1b : p.x1);
  const oben = (p) => (p.k === 1 ? p.y1b : p.y1);

  function schiebe(p, dx, dy) {
    if (p.k === 0) { p.x += dx; p.y += dy; } else if (p.k === 1) { p.x1 += dx; p.x2 += dx; p.y1 += dy; p.y2 += dy; } else p.pts = p.pts.map(([x, y]) => [x + dx, y + dy]);
    return primBox(p);
  }

  function abstandStrecke(px, py, x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const l2 = dx * dx + dy * dy;
    let u = l2 > 0 ? ((px - x1) * dx + (py - y1) * dy) / l2 : 0;
    u = u < 0 ? 0 : u > 1 ? 1 : u;
    const ex = x1 + u * dx - px;
    const ey = y1 + u * dy - py;
    return Math.sqrt(ex * ex + ey * ey);
  }

  function imPoly(px, py, pts) {
    let drin = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i, i += 1) {
      const xi = pts[i][0]; const yi = pts[i][1]; const xj = pts[j][0]; const yj = pts[j][1];
      if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) drin = !drin;
    }
    return drin;
  }

  // Wie weit der Punkt (x, y) von der Form weg ist (negativ: drin).
  function abstandForm(p, x, y) {
    if (p.k === 0) return Math.hypot(x - p.x, y - p.y) - p.r;
    if (p.k === 1) return abstandStrecke(x, y, p.x1, p.y1, p.x2, p.y2) - p.r;
    if (imPoly(x, y, p.pts)) return -1;
    const pts = p.pts;
    let d = Infinity;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i, i += 1) d = Math.min(d, abstandStrecke(x, y, pts[j][0], pts[j][1], pts[i][0], pts[i][1]));
    return d;
  }

  // Trifft eine Blase mit Halbmesser r an (x, y) eine der Formen? Dann die.
  function formTrifft(prims, x, y, r) {
    for (let i = 0; i < prims.length; i += 1) {
      const p = prims[i];
      if (p.x0 > x + r || rechts(p) < x - r || p.y0 > y + r || oben(p) < y - r) continue;
      if (abstandForm(p, x, y) < r) return p;
    }
    return null;
  }

  // Eine Kurve (quadratisch, von a über c nach b) als Punkte.
  function bogen(ax, ay, cx, cy, bx, by, n) {
    const pts = [];
    for (let i = 0; i <= n; i += 1) {
      const u = i / n;
      const a = (1 - u) * (1 - u);
      const b = 2 * (1 - u) * u;
      const c = u * u;
      pts.push([a * ax + b * cx + c * bx, a * ay + b * cy + c * by]);
    }
    return pts;
  }

  // Ein Punkt auf der Linie pts, so weit d vom Anfang – mit Richtung
  // (tx, ty), Normale (nx, ny: links davon) und dem Anteil u.
  function entlang(pts, d) {
    let rest = d;
    for (let i = 1; i < pts.length; i += 1) {
      const dx = pts[i][0] - pts[i - 1][0];
      const dy = pts[i][1] - pts[i - 1][1];
      const l = Math.hypot(dx, dy) || 1e-6;
      if (rest <= l || i === pts.length - 1) {
        const f = clamp(rest / l, 0, 1);
        return { x: pts[i - 1][0] + dx * f, y: pts[i - 1][1] + dy * f, tx: dx / l, ty: dy / l, nx: -dy / l, ny: dx / l, u: (i - 1 + f) / (pts.length - 1) };
      }
      rest -= l;
    }
    const p = pts[pts.length - 1];
    return { x: p[0], y: p[1], tx: 1, ty: 0, nx: 0, ny: 1, u: 1 };
  }
  function laenge(pts) {
    let l = 0;
    for (let i = 1; i < pts.length; i += 1) l += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    return l;
  }

  // Ein Blatt vom Stiel (x, y) in Richtung w: spitz, am breitesten vor der
  // Mitte. zacken > 0: gesägt (Brennnessel), die Zähne gehören zur Form.
  function blattForm(x, y, w, lang, breit, { n = 7, zacken = 0, herz = 0 } = {}) {
    const c = Math.cos(w);
    const s = Math.sin(w);
    const l = [];
    const r = [];
    for (let i = 1; i < n; i += 1) {
      const u = i / n;
      let hb = (breit / 2) * Math.pow(Math.sin(Math.PI * Math.pow(u, 0.8 + herz * 0.3)), 0.8);
      if (zacken && i % 2 === 0) hb += zacken;
      const ax = x + c * lang * u;
      const ay = y + s * lang * u;
      l.push([ax - s * hb, ay + c * hb]);
      r.push([ax + s * hb, ay - c * hb]);
    }
    return [[x, y], ...l, [x + c * lang, y + s * lang], ...r.reverse()];
  }

  // Ein Band um eine Linie: so breit wie die Nadeln eines Zweigs lang sind.
  function huelle(pts, r0, r1) {
    const l = [];
    const r = [];
    const n = pts.length;
    for (let i = 0; i < n; i += 1) {
      const a = pts[Math.max(0, i - 1)];
      const b = pts[Math.min(n - 1, i + 1)];
      const dx = b[0] - a[0];
      const dy = b[1] - a[1];
      const len = Math.hypot(dx, dy) || 1;
      const nx = -dy / len;
      const ny = dx / len;
      const rr = lerp(r0, r1, i / (n - 1));
      l.push([pts[i][0] + nx * rr, pts[i][1] + ny * rr]);
      r.push([pts[i][0] - nx * rr, pts[i][1] - ny * rr]);
    }
    const e = pts[n - 1];
    const v = pts[n - 2];
    const len = Math.hypot(e[0] - v[0], e[1] - v[1]) || 1;
    const spitze = [e[0] + ((e[0] - v[0]) / len) * r1 * 0.9, e[1] + ((e[1] - v[1]) / len) * r1 * 0.9];
    return [...l, spitze, ...r.reverse()];
  }

  // ---------------------------------------------------------------------------
  // Zustand
  // ---------------------------------------------------------------------------
  // phase:   "bereit" (noch nichts getippt), "spiel", "zuschauen", "ende"
  // schritt: "start" (sie schwebt über dem Ring), "flug", "geplatzt"
  const state = {
    phase: "bereit",
    schritt: "start",
    punkte: 0,
    hoechste: 0,             // so hoch war sie schon (für die Punkte)
    tacho: 0,                // was die Nadel zeigt (km/h, gedämpft)
    t: 0,                    // die Spielzeit; sie läuft bei null los
    zeit: 0,                 // die Uhr des Bildes
    // Die Blase: Ort, Tempo, und wie sie wabert (Richtung, Stärke, seit wann).
    blase: { x: 0, y: 0, vx: 0, vy: V0, ww: 0, wa: 0, wt: 9 },
    stoesse: 0,              // so viele Luftstösse
    letzterStoss: null,      // { w: Richtung vom Finger, d: Abstand }
    weg: [],                 // die Gasse: [{ y, x, ph }]
    plan: null,              // der Zeitplan: wo eine Blase auf der Gasse wann ist
    hindernisse: [],         // was steht (nach y0 geordnet)
    beweger: [],             // was sich bewegt
    abschnitte: [],
    aufwinde: [],
    boeen: [],
    letzte: { y: 0, x: 0 },  // die letzte Reihe, über der weitergebaut wird
    windPhase: [0, 0],
    langMax: 60,
    langMaxB: 60,
    planFehler: 0,
    zahlAufwind: 0,
    zahlBoee: 0,
    abschnitt: -1,
    welt: 0,
    geplatzt: null,
    teile: [],
    stossBilder: [],
    schriften: [],
    ansage: null,
    camY: 0,
    pollen: [],
    intro: null,
    pilotBis: 0,
    naechste: 0,
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
  let abend = null;
  let wind = null;
  let tippRinge = null;
  let ersterStart = true;
  let ebenen = null;
  let teilId = 0;

  // s: Bildpunkte je Einheit; blaseY: wo im Bild die Blase steht (von oben).
  const view = { s: 1, dpr: 1, cssW: 0, cssH: 0, frei: 0, blaseY: 300, camBild: 0 };

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
    abend = klang()?.kulisse("seifenblase.abend") || null;
    abend?.laut(0.4);
    wind = klang()?.kulisse("seifenblase.wind") || null;
    wind?.setze(0.15);
    wind?.laut(0.2);
  }

  function klangStellen() {
    const y = state.blase.y;
    // Die Grillen gehören in den Garten, der Wind wird mit der Höhe lauter.
    abend?.laut(0.42 * (1 - glatt((y - 300) / 900)));
    const w = Math.abs(windBei(y, state.t));
    wind?.setze(clamp(0.12 + w / 90, 0.12, 0.9));
    wind?.laut(clamp(0.16 + y / 6000 + w / 140, 0.16, 0.6));
  }

  function klangAus() {
    abend?.stop();
    wind?.stop();
    abend = null;
    wind = null;
  }

  // ---------------------------------------------------------------------------
  // Wind und Aufwind – nur nach Höhe, Zeit und Saat
  // ---------------------------------------------------------------------------
  // Der Seitenwind: erst ab dreieinhalb Metern, dann stärker bis gut 25 cm
  // in der Sekunde – zwei Wellen, die mit der Zeit wandern. Dazu die Böen.
  function windBei(y, t) {
    const a = 26 * glatt((y - 350) / 2200);
    let w = 0;
    if (a > 0) w = a * (0.62 * Math.sin(y / 170 + state.windPhase[0] + 0.45 * t) + 0.38 * Math.sin(y / 61 + state.windPhase[1] - 0.8 * t));
    for (let i = 0; i < state.boeen.length; i += 1) {
      const b = state.boeen[i];
      if (y > b.y0 - 60 && y < b.y1 + 60) w += b.w * glatt((y - b.y0 + 40) / 80) * glatt((b.y1 + 40 - y) / 80);
    }
    return clamp(w, -70, 70);
  }

  // Wie sehr der Aufwind dort trägt: 1 mitten in der Säule, 0 daneben.
  function aufwindBei(x, y) {
    for (let i = 0; i < state.aufwinde.length; i += 1) {
      const a = state.aufwinde[i];
      if (y < a.y0 - 40 || y > a.y1 + 40) continue;
      const kx = glatt((a.b - Math.abs(x - a.x)) / 6 + 0.5);
      const ky = glatt((y - a.y0 + 30) / 60) * glatt((a.y1 + 30 - y) / 60);
      return kx * ky;
    }
    return 0;
  }

  // ---------------------------------------------------------------------------
  // Die Gasse und ihr Zeitplan
  // ---------------------------------------------------------------------------
  // Die Mitte der Gasse in der Höhe y: durch jede Reihe gerade (pd unter und
  // pu über ihr – so weit, wie ihre Teile nahe der Lücke reichen),
  // dazwischen ein weicher Bogen.
  function wegX(y) {
    const w = state.weg;
    if (!w.length) return 0;
    let lo = 0;
    let hi = w.length - 1;
    if (y <= w[0].y) return w[0].x;
    while (lo < hi) {
      const m = (lo + hi + 1) >> 1;
      if (w[m].y <= y) lo = m; else hi = m - 1;
    }
    const a = w[lo];
    const b = w[lo + 1];
    if (!b) return a.x;
    const y0 = a.y + a.pu;
    const y1 = b.y - b.pd;
    if (y <= y0) return a.x;
    if (y >= y1) return b.x;
    return lerp(a.x, b.x, glatt((y - y0) / (y1 - y0)));
  }

  /*
   * Der Zeitplan: Wie eine Blase steigt, die nur getragen wird und genau der
   * Gasse folgt (der Auftrieb, im Aufwind mehr). Gerechnet wie die Blase
   * selbst, im selben Takt, und alle PLAN_DT festgehalten. Nach ihm richtet
   * sich, was sich bewegt (es soll vorbei sein, wenn sie kommt), und der
   * Nebel steigt ihm nach.
   */
  function planNeu() {
    return { ys: [0], sim: { t: 0, y: 0, vy: V0 } };
  }

  function zeitplanBis(yZiel) {
    const p = state.plan;
    let { t, y, vy } = p.sim;
    while (y < yZiel && p.ys.length < 30 * 900) {
      for (let i = 0; i < 8; i += 1) {
        const k = aufwindBei(wegX(y), y);
        const ziel = vAuf(t) * (1 + (AUF - 1) * k);
        vy += (ziel - vy) * (TAKT / TAU_Y);
        y += vy * TAKT;
        t += TAKT;
      }
      p.ys.push(y);
    }
    p.sim = { t, y, vy };
  }

  // Wo die Blase des Zeitplans zur Zeit t ist – und wann sie in der Höhe y.
  function yRef(t) {
    const ys = state.plan.ys;
    const f = Math.max(0, t) / PLAN_DT;
    const i = Math.floor(f);
    if (i + 1 < ys.length) return lerp(ys[i], ys[i + 1], f - i);
    const tl = (ys.length - 1) * PLAN_DT;
    return ys[ys.length - 1] + vAuf(tl) * (t - tl);
  }
  function tRef(y) {
    const ys = state.plan.ys;
    if (y <= 0) return 0;
    if (y >= ys[ys.length - 1]) {
      const tl = (ys.length - 1) * PLAN_DT;
      return tl + (y - ys[ys.length - 1]) / vAuf(tl);
    }
    let lo = 0;
    let hi = ys.length - 1;
    while (hi - lo > 1) {
      const m = (lo + hi) >> 1;
      if (ys[m] <= y) lo = m; else hi = m;
    }
    return (lo + (y - ys[lo]) / Math.max(1e-6, ys[hi] - ys[lo])) * PLAN_DT;
  }
  // Wann sie in der Höhe y wäre, ohne dass der Plan schon so weit steht.
  function tSchaetzen(y) {
    const p = state.plan;
    if (y <= p.sim.y) return tRef(y);
    let { t, y: yy, vy } = p.sim;
    while (yy < y) {
      vy += (vAuf(t) - vy) * ((TAKT * 4) / TAU_Y);
      yy += vy * TAKT * 4;
      t += TAKT * 4;
    }
    return t;
  }

  // Wo der Nebel steht: dem Zeitplan nach, um abstandNebel darunter.
  const nebelY = (t) => yRef(t) - abstandNebel(t);

  // ---------------------------------------------------------------------------
  // Die Hindernisse: was steht
  // ---------------------------------------------------------------------------
  /*
   * Ein Teil wächst vom Rand herein: seite −1 von links, +1 von rechts, bis
   * spitze – keine Form ragt weiter in die Gasse. Was zuletzt doch weiter
   * ragt (eine Blüte, ein Blatt), wird mitsamt dem Teil zurückgeschoben
   * (teilFertig). Jedes Teil zeichnet eine Welt, aus Formen, die genau so
   * gemalt werden: Stiele und Äste als Stäbe, Dornen, Blätter, Nadeln,
   * Dächer als Vielecke, Blüten, Rinnen und Wolken als Kreise.
   */
  function teilFertig(o, spitze) {
    o.prims.forEach(primBox);
    const innen = o.seite < 0 ? Math.max(...o.prims.map(rechts)) : Math.min(...o.prims.map((p) => p.x0));
    const dx = spitze - innen;
    o.prims.forEach((p) => schiebe(p, dx, 0));
    if (o.tropf) o.tropf.x += dx;
    if (o.rauch) o.rauch.x += dx;
    if (o.deko?.zweige) o.deko.zweige.forEach((z) => { z.pts = z.pts.map(([x, y]) => [x + dx, y]); });
    if (o.deko?.netz) {
      const n = o.deko.netz;
      n.nabe[0] += dx;
      n.rahmen = n.rahmen.map(([x, y]) => [x + dx, y]);
    }
    o.box = {
      x0: Math.min(...o.prims.map((p) => p.x0)), x1: Math.max(...o.prims.map(rechts)),
      y0: Math.min(...o.prims.map((p) => p.y0)), y1: Math.max(...o.prims.map(oben)),
    };
    o.id = (teilId += 1);
    return o;
  }

  // Die Rose: ein Trieb vom Rand, mit Dornen, gefiederten Blättern und einer
  // Blüte oder Knospe an der Spitze.
  function baueRose(s, spitze, y, z1, z2, z3) {
    const P = [];
    const bx = s * 76;
    const by = y + (z1 - 0.5) * 22;
    const tx = spitze;
    const cx = lerp(bx, tx, 0.5);
    const cy = lerp(by, y, 0.5) + 5 + (z2 - 0.5) * 14;
    const pts = bogen(bx, by, cx, cy, tx, y, 10);
    for (let i = 0; i < pts.length - 1; i += 1) P.push(stab(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], lerp(1.75, 0.95, i / 9), "stiel"));
    const L = laenge(pts);
    // Die Dornen: alle gut sechs Zentimeter, im Wechsel oben und unten,
    // zum Rand hin gebogen.
    let seite = z2 < 0.5 ? 1 : -1;
    for (let d = 7 + z3 * 3; d < L - 5; d += 6 + hash01(d * 3.1 + z1) * 2.5) {
      const e = entlang(pts, d);
      const r = lerp(1.75, 0.95, e.u) * 0.75;
      const nx = e.nx * seite;
      const ny = e.ny * seite;
      const cx0 = e.x + nx * r;
      const cy0 = e.y + ny * r;
      P.push(poly([[cx0 - e.tx * 1.3, cy0 - e.ty * 1.3], [cx0 + nx * 2.9 - e.tx * 1.2, cy0 + ny * 2.9 - e.ty * 1.2], [cx0 + e.tx * 1.2, cy0 + e.ty * 1.2]], "dorn"));
      seite = -seite;
    }
    // Zwei gefiederte Blätter: ein Stielchen, drei Fiedern.
    [0.3 + z1 * 0.1, 0.62 + z2 * 0.08].forEach((u, i) => {
      if (L * u < 14) return;
      const e = entlang(pts, L * u);
      const sg = i % 2 === 0 ? 1 : -1;
      const dx = e.nx * sg * 0.75 + e.tx * 0.65;
      const dy = e.ny * sg * 0.75 + e.ty * 0.65;
      const dl = Math.hypot(dx, dy);
      const w = Math.atan2(dy / dl, dx / dl);
      const ex = e.x + (dx / dl) * 4.2;
      const ey = e.y + (dy / dl) * 4.2;
      P.push(stab(e.x, e.y, ex, ey, 0.42, "stielchen"));
      P.push(poly(blattForm(ex, ey, w, 6.4, 3.7), "fieder"));
      const mx = lerp(e.x, ex, 0.55);
      const my = lerp(e.y, ey, 0.55);
      P.push(poly(blattForm(mx, my, w + 0.95, 4.9, 2.9), "fieder"));
      P.push(poly(blattForm(mx, my, w - 0.95, 4.9, 2.9), "fieder"));
    });
    // Die Spitze: eine offene Blüte oder eine Knospe.
    const e = entlang(pts, L);
    const bluete = z3 < 0.62;
    if (bluete) {
      const r = 5.3 + 1.3 * z2;
      P.push(kreis(tx + e.tx * (r * 0.75), y + e.ty * (r * 0.75), r, "bluete"));
    } else {
      P.push(poly(blattForm(tx - e.tx * 0.5, y - e.ty * 0.5, Math.atan2(e.ty, e.tx), 6.6, 4.3, { n: 8 }), "knospe"));
    }
    return { art: "rose", welt: 0, seite: s, prims: P, deko: { farbe: z1 < 0.45 ? 0 : z1 < 0.8 ? 1 : 2 } };
  }

  // Die Brennnessel: ein Stängel dicht am Rand, gesägte Blätter, die in die
  // Gasse hängen – das mittlere reicht am weitesten.
  function baueNessel(s, spitze, y, z1, z2) {
    const P = [];
    const sx = s * 63.5;
    P.push(stab(sx, y - 46, sx, y + 46, 1.5, "stengel"));
    const w0 = s < 0 ? 0 : Math.PI;
    const lang = Math.abs(spitze - sx) - 2;
    [-31 + z1 * 6, 0, 29 - z2 * 6].forEach((dy, i) => {
      const l = i === 1 ? lang : lang * (0.62 + 0.1 * hash01(i + z1));
      const yy = y + dy;
      const bx = sx - s * 2.2;
      P.push(stab(sx, yy + 1.2, bx, yy, 0.55, "stengel"));
      P.push(poly(blattForm(bx, yy, w0 + s * (0.18 + 0.12 * z2), l, Math.min(13, l * 0.5), { n: 14, zacken: 0.9, herz: 0.6 }), "nessel"));
    });
    return { art: "nessel", welt: 0, seite: s, prims: P };
  }

  // Der Gartenschlauch: über die Hecke gehängt, in einem Bogen herein, vorn
  // die Messingdüse, die tropft.
  function baueSchlauch(s, spitze, y, z1) {
    const P = [];
    const dx = spitze + s * 2.2;
    const pts = bogen(s * 74, y + 30, lerp(s * 62, dx, 0.5), y + 40 + z1 * 8, dx, y + 9, 10);
    for (let i = 0; i < pts.length - 1; i += 1) P.push(stab(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], 1.9, "schlauch"));
    P.push(poly([[dx - 2.1, y + 9.5], [dx + 2.1, y + 9.5], [dx + 1.1, y + 2.2], [dx - 1.1, y + 2.2]], "duese"));
    return { art: "schlauch", welt: 0, seite: s, prims: P, tropf: { x: dx, y: y + 2 } };
  }

  // Ein Ast der Buche: vom Stamm her dick, Zweige mit Blättern, die Spitze
  // belaubt. tropft: am Blatt vorn hängt Tau, der fällt.
  function baueAst(s, spitze, y, z1, z2, z3, tropft = false) {
    const P = [];
    const bx = s * 80;
    const by = y + (z1 - 0.5) * 20;
    const tx = spitze + s * 6;
    const pts = bogen(bx, by, lerp(bx, tx, 0.45), lerp(by, y, 0.5) + (z2 - 0.4) * 14, tx, y, 9);
    for (let i = 0; i < pts.length - 1; i += 1) P.push(stab(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], lerp(3.6, 0.75, i / 8), "ast"));
    const L = laenge(pts);
    const blaetter = (x, y0, w, n) => {
      for (let i = 0; i < n; i += 1) {
        const ww = w + (i - (n - 1) / 2) * 0.75;
        P.push(poly(blattForm(x, y0, ww, 6.8 + hash01(x * 0.7 + i) * 1.2, 4.3), "blatt"));
      }
    };
    let sg = z3 < 0.5 ? 1 : -1;
    [0.42, 0.66, 0.86].forEach((u, i) => {
      if (L * u < 18 || (i === 2 && L < 60)) return;
      const e = entlang(pts, L * u);
      const w = Math.atan2(e.ty, e.tx) + sg * (0.65 + 0.25 * hash01(i + z1));
      const l = lerp(16, 9, u) * (0.85 + 0.3 * hash01(i * 3 + z2));
      const mx = e.x + Math.cos(w) * l * 0.55;
      const my = e.y + Math.sin(w) * l * 0.55;
      const ex = e.x + Math.cos(w + sg * 0.15) * l;
      const ey = e.y + Math.sin(w + sg * 0.15) * l;
      P.push(stab(e.x, e.y, mx, my, 1.1, "zweig"));
      P.push(stab(mx, my, ex, ey, 0.6, "zweig"));
      blaetter(ex, ey, w + sg * 0.15, 3);
      sg = -sg;
    });
    const e = entlang(pts, L);
    const w = Math.atan2(e.ty, e.tx);
    let tropf = null;
    if (tropft) {
      // Das vorderste Blatt hängt: von seiner Spitze fällt der Tau.
      const wt = w + (s < 0 ? -1 : 1) * 1.05;
      P.push(poly(blattForm(tx, y, wt, 7.4, 4.4), "blatt"));
      P.push(poly(blattForm(tx, y, w + s * 0.55, 6.6, 4.1), "blatt"));
      tropf = { x: tx + Math.cos(wt) * 7.4, y: y + Math.sin(wt) * 7.4 - 0.4 };
    } else {
      blaetter(tx, y, w, 2);
    }
    return { art: "ast", welt: 1, seite: s, prims: P, tropf };
  }

  // Ein Tannenzweig: der Trieb mit seinen Seitentrieben, darum die Nadeln –
  // gerechnet als Band so breit, wie die Nadeln lang sind.
  function baueTanne(s, spitze, y, z1, z2) {
    const P = [];
    const zweige = [];
    const bx = s * 78;
    const by = y + 4 + (z1 - 0.5) * 14;
    const tx = spitze + s * 2;
    const pts = bogen(bx, by, lerp(bx, tx, 0.5), lerp(by, y, 0.5) - 6, tx, y, 12);
    zweige.push({ pts, r0: 3.3, r1: 2.3 });
    const L = laenge(pts);
    let sg = z2 < 0.5 ? 1 : -1;
    for (let d = 12; d < L - 7; d += 8 + hash01(d + z1) * 2) {
      const e = entlang(pts, d);
      const w = Math.atan2(e.ty, e.tx) + sg * (0.7 + 0.15 * hash01(d * 2.3));
      const l = lerp(14, 6, e.u) * (0.85 + 0.3 * hash01(d * 1.7 + z2));
      const sp = [];
      for (let i = 0; i <= 4; i += 1) {
        const f = i / 4;
        const ww = w - sg * 0.12 * f;
        sp.push([e.x + Math.cos(ww) * l * f, e.y + Math.sin(ww) * l * f]);
      }
      zweige.push({ pts: sp, r0: 2.7, r1: 1.9 });
      sg = -sg;
    }
    zweige.forEach((z) => P.push(poly(huelle(z.pts, z.r0, z.r1), "nadeln")));
    return { art: "tanne", welt: 1, seite: s, prims: P, deko: { zweige } };
  }

  // Ein Spinnennetz zwischen zwei Zweigen vom Stamm; vorn hält es ein Faden
  // an der Spitze. Gerechnet wird der Rahmen – durch die Maschen passt keine
  // Blase.
  function baueNetz(s, spitze, y, z1, z2) {
    const P = [];
    const innen = (k) => lerp(s * 62, spitze, k);
    const oPts = bogen(s * 76, y + 14 + z1 * 4, innen(0.5), y + 18, innen(0.86), y + 13 + z2 * 4, 6);
    const uPts = bogen(s * 76, y - 17 - z2 * 3, innen(0.35), y - 21, innen(0.62), y - 19 - z1 * 3, 5);
    for (let i = 0; i < oPts.length - 1; i += 1) P.push(stab(oPts[i][0], oPts[i][1], oPts[i + 1][0], oPts[i + 1][1], lerp(1.15, 0.5, i / 5), "zweig"));
    for (let i = 0; i < uPts.length - 1; i += 1) P.push(stab(uPts[i][0], uPts[i][1], uPts[i + 1][0], uPts[i + 1][1], lerp(1.15, 0.55, i / 4), "zweig"));
    const a = entlang(oPts, laenge(oPts) * 0.93);
    const b = entlang(oPts, laenge(oPts) * 0.42);
    const c = entlang(uPts, laenge(uPts) * 0.45);
    const d = entlang(uPts, laenge(uPts) * 0.97);
    const rahmen = [[b.x, b.y - 0.6], [a.x, a.y - 0.6], [spitze, y - 1], [d.x, d.y + 0.6], [c.x, c.y + 0.6]];
    P.push(poly(rahmen, "netz"));
    const nabe = [lerp(lerp(b.x, a.x, 0.5), spitze, 0.42), lerp(lerp(b.y, c.y, 0.5), y, 0.3)];
    return { art: "netz", welt: 1, seite: s, prims: P, deko: { netz: { rahmen, nabe } } };
  }

  // Ein Balkon: Platte, Konsole, Geländer – und oft ein Blumenkasten mit
  // Geranien, der am weitesten hereinragt.
  function baueBalkon(s, spitze, y, z1, z2) {
    const P = [];
    const kasten = z1 < 0.62;
    const vorn = spitze + s * (kasten ? 6.5 : 0.9);
    const w = s * 61;
    P.push(poly([[w, y - 2.2], [vorn, y - 2.2], [vorn, y + 1.8], [w, y + 1.8]], "platte"));
    P.push(poly([[w, y - 2.2], [lerp(w, vorn, 0.32), y - 2.2], [w, y - 13]], "konsole"));
    P.push(stab(w, y + 19, vorn, y + 19, 0.9, "gelaender"));
    P.push(stab(w, y + 4.5, vorn, y + 4.5, 0.45, "gelaender"));
    const n = Math.max(2, Math.round(Math.abs(vorn - w) / 4.6));
    for (let i = 1; i <= n; i += 1) {
      const x = lerp(w, vorn, i / n);
      P.push(stab(x, y + 1.8, x, y + 19, i === n ? 0.75 : 0.5, "gelaender"));
    }
    if (kasten) {
      const k0 = vorn;
      const k1 = vorn - s * 5.6;
      P.push(poly([[k0, y + 11], [k1, y + 11.6], [k1, y + 18.4], [k0, y + 18.4]], "kasten"));
      for (let i = 0; i < 5; i += 1) {
        const x = lerp(k0 + s * 0.5, k1 - s * 0.6, (i + 0.5) / 5) + (hash01(i + z2) - 0.5) * 1.2;
        P.push(kreis(x, y + 20.2 + hash01(i * 3 + z2) * 2.6, 1.9 + hash01(i * 7 + z1) * 0.9, i % 2 ? "blumen" : "laub"));
      }
    }
    return { art: "balkon", welt: 2, seite: s, prims: P, deko: { kasten, farbe: z2 } };
  }

  // Ein Vordach aus Ziegeln, das von der Wand herab in die Gasse ragt; vorn
  // die Rinne. Oft mit Kamin (der raucht), manchmal tropft die Rinne.
  function baueDach(s, spitze, y, z1, z2, tropft = false) {
    const P = [];
    const steig = 14 + 20 * z1;
    const fx = spitze + s * 4.4;
    const wx = s * 68;
    const wy = y + steig;
    const l = Math.hypot(fx - wx, y - wy);
    const nx = -(y - wy) / l * (s < 0 ? -1 : 1);
    const ny = (fx - wx) / l * (s < 0 ? -1 : 1);
    const d = 2.8;
    P.push(poly([[wx + nx * d, wy + ny * d], [fx + nx * d, y + ny * d], [fx - nx * d, y - ny * d], [wx - nx * d, wy - ny * d]], "dach"));
    // Zwei Streben tragen es von der Wand.
    [0.18, 0.42].forEach((u) => {
      if (Math.abs(fx - wx) * u < 10) return;
      const ax = lerp(wx, fx, u);
      const ay = lerp(wy, y, u) - d * 0.8;
      P.push(stab(s * 61, ay - 10 - u * 14, ax, ay, 0.8, "balken"));
    });
    const rinne = kreis(fx - s * 2.0, y - 1.2, 2.2, "rinne");
    P.push(rinne);
    let rauch = null;
    if (z2 < 0.5 && Math.abs(fx - wx) > 48) {
      const u = 0.34;
      const kx = lerp(wx, fx, u);
      const ky = lerp(wy, y, u);
      const b = 5.5;
      const top = ky + 26;
      P.push(poly([[kx - b, ky - 2], [kx + b, ky - 2], [kx + b, top], [kx - b, top]], "kamin"));
      P.push(poly([[kx - b - 1.2, top], [kx + b + 1.2, top], [kx + b + 1.2, top + 2.2], [kx - b - 1.2, top + 2.2]], "kamin"));
      rauch = { x: kx, y: top + 2.2 };
    }
    const tropf = tropft ? { x: fx - s * 2.0, y: y - 3.4 } : null;
    return { art: "dach", welt: 2, seite: s, prims: P, rauch, tropf, deko: { steig } };
  }

  // Eine Fernsehantenne an der Wand: der Mast, ein waagrechtes Rohr, darauf
  // die Stäbe – hinten lang, nach vorn kürzer.
  function baueAntenne(s, spitze, y, z1) {
    const P = [];
    const mx = s * 61.6;
    P.push(stab(mx, y - 15, mx, y + 13, 1.0, "mast"));
    P.push(stab(s * 66, y - 10, mx, y - 10, 0.75, "mast"));
    P.push(stab(s * 66, y + 6, mx, y + 6, 0.75, "mast"));
    const vx = spitze + s * 0.9;
    P.push(stab(mx, y, vx, y, 0.62, "rohr"));
    const n = 6 + Math.floor(z1 * 4);
    for (let i = 0; i < n; i += 1) {
      const x = lerp(mx - s * 3.2, vx + s * 1.6, i / (n - 1));
      const h = i === 0 ? 11 : lerp(9, 4.5, i / (n - 1));
      P.push(stab(x, y - h, x, y + h, 0.4, "element"));
    }
    P.push(kreis(vx, y, 0.9, "rohr"));
    return { art: "antenne", welt: 2, seite: s, prims: P };
  }

  // Eine Wolkenbank vom Rand herein: Ballen um Ballen, der vorderste genau
  // an der Spitze. Was nass ist, lässt sie zerplatzen.
  function baueWolke(s, spitze, y, z1, z2, z3) {
    const P = [];
    let r = 7 + 3 * z1;
    let x = spitze + s * r;
    let yy = y + (z2 - 0.5) * 5;
    P.push(kreis(x, yy, r, "wolke"));
    let i = 0;
    while (s < 0 ? x - r > s * 80 : x + r < s * 80) {
      i += 1;
      const rn = Math.min(16, r * (1.04 + 0.12 * hash01(i * 3 + z3)) + 1);
      x += s * (r * 0.75 + rn * 0.35);
      const dy = (hash01(i * 5.1 + z1) - 0.5) * 12;
      P.push(kreis(x, yy + dy, rn, "wolke"));
      if (hash01(i * 7.7 + z2) < 0.6) P.push(kreis(x - s * rn * 0.4, yy + dy + rn * 0.55, rn * 0.62, "wolke"));
      r = rn;
      if (i > 12) break;
    }
    return { art: "wolke", welt: 3, seite: s, prims: P };
  }

  // So weit reicht jede Art vom Rand in die Gasse.
  const REICHT = { rose: 125, nessel: 32, schlauch: 90, ast: 125, tanne: 82, netz: 64, balkon: 96, dach: 125, antenne: 112, wolke: 130 };

  // Ein Teil für die Welt w, von der Seite s bis zur Spitze.
  function teilBauen(w, s, spitze, y, z1, z2, z3, oben = 0) {
    const reicht = Math.abs(spitze - s * RAND);
    if (reicht < 3) return null;
    let o;
    if (w === 0) {
      o = reicht <= REICHT.nessel && z3 < 0.55 ? baueNessel(s, spitze, y, z1, z2) : baueRose(s, spitze, y, z1, z2, z3);
    } else if (w === 1) {
      const art = z3 < 0.42 ? "ast" : z3 < 0.74 ? "tanne" : "netz";
      if (art === "netz" && reicht <= REICHT.netz) o = baueNetz(s, spitze, y, z1, z2);
      else if (art === "tanne" && reicht <= REICHT.tanne) o = baueTanne(s, spitze, y, z1, z2);
      else o = baueAst(s, spitze, y, z1, z2, z3);
    } else if (w === 2) {
      const hoch = oben > 0.45;
      const art = z3 < (hoch ? 0.2 : 0.5) ? "balkon" : z3 < (hoch ? 0.68 : 0.78) ? "dach" : "antenne";
      if (art === "balkon" && reicht <= REICHT.balkon) o = baueBalkon(s, spitze, y, z1, z2);
      else if (art === "antenne" && reicht <= REICHT.antenne) o = baueAntenne(s, spitze, y, z1);
      else o = baueDach(s, spitze, y, z1, z2);
    } else {
      o = baueWolke(s, spitze, y, z1, z2, z3);
    }
    return teilFertig(o, spitze);
  }

  function einreihen(o) {
    const liste = state.hindernisse;
    let i = liste.length;
    while (i > 0 && liste[i - 1].box.y0 > o.box.y0) i -= 1;
    liste.splice(i, 0, o);
    state.langMax = Math.max(state.langMax, o.box.y1 - o.box.y0 + 2);
  }

  // ---------------------------------------------------------------------------
  // Die Hindernisse: was sich bewegt
  // ---------------------------------------------------------------------------
  /*
   * Alles bewegt sich auf festen Bahnen, nach der Spielzeit: Wespen fliegen
   * eine Acht, Schwalben und Mauersegler ziehen Schleifen, Wolkenfetzen
   * treiben quer, Tropfen schwellen an einer Düse, einem Blatt, einer Rinne
   * und fallen dann, immer im selben Takt. Wann genau, entscheidet der Bau
   * (phasenSuchen): so, dass sie weg sind, wenn die Blase des Zeitplans
   * kommt – auch wer luft zu früh oder zu spät ist.
   */
  function bewegerOrt(m, t) {
    if (m.art === "wespe") {
      const a = m.w * t + m.ph;
      return { x: m.xc + m.A * Math.sin(a), y: m.yc + m.B * Math.sin(2 * a), dir: Math.cos(a) * m.sinn >= 0 ? 1 : -1, schlag: t * 34 };
    }
    if (m.art === "schwalbe" || m.art === "segler") {
      const a = m.w * t + m.ph;
      return { x: m.xc + m.A * Math.cos(a) * m.sinn, y: m.yc + m.B * Math.sin(a), dir: -Math.sin(a) * m.sinn >= 0 ? 1 : -1, schlag: t * m.schlagT + m.ph };
    }
    // Der Wolkenfetzen treibt quer.
    return { x: m.x0 + m.u * (t - m.tc), y: m.yc, dir: 1, schlag: 0 };
  }

  // Die Formen eines Bewegers, nach vorn (+x) gerichtet, um seine Mitte.
  function bewegerForm(m, o) {
    if (m.art === "wespe") {
      const f = Math.sin(o.schlag) * 0.7;
      return [
        kreis(3.5, 0.5, 1.25, "kopf"), kreis(1.25, 0.15, 1.55, "brust"),
        kreis(-1.4, -0.35, 1.95, "leib"), kreis(-3.5, -0.85, 1.4, "leib"),
        poly([[1.4, 1.1], [-0.6, 4.6 + f], [-3.4, 4.4 + f * 0.8], [-0.4, 1.0]], "fluegel"),
      ];
    }
    if (m.art === "schwalbe" || m.art === "segler") {
      const k = m.art === "segler" ? 1.12 : 1;
      const auf = Math.sin(o.schlag);
      const ty = (auf > 0 ? 8.6 * auf : 5.8 * auf) * k;
      const tx = (m.art === "segler" ? -7.5 : -6.2) * k;
      const form = [
        stab(-3.4 * k, 0, 3.2 * k, 0.35, 1.45 * k, "koerper"), kreis(4.2 * k, 0.7, 1.4 * k, "kopf"),
        poly([[1.8 * k, 0.8], [-0.4 * k, ty * 0.62 + 0.6], [tx, ty], [-2.1 * k, 0.5]], "fluegel"),
      ];
      if (m.art === "schwalbe") form.push(poly([[-3.2, 0.7], [-10.6, 2.8], [-8.0, 0.2], [-10.9, -2.1], [-3.2, -0.9]], "schwanz"));
      else form.push(poly([[-3.4 * k, 0.8], [-6.6 * k, 1.4], [-5.4 * k, 0.1], [-6.6 * k, -1.2], [-3.4 * k, -0.9]], "schwanz"));
      return form;
    }
    return m.puffs.map((p) => kreis(p[0], p[1], p[2], "fetzen"));
  }

  // Die Tropfen eines Tropfers zur Zeit t: f(x, y, r, schwellend).
  function tropfenBei(m, t, f) {
    const kMin = Math.floor((t - m.ph - m.tMax) / m.P);
    const kMax = Math.floor((t - m.ph) / m.P);
    for (let k = kMin; k <= kMax; k += 1) {
      const tau = t - (m.ph + k * m.P);
      if (tau < 0) continue;
      if (tau < SCHWELL) {
        const r = R_TROPFEN * (0.35 + 0.65 * (tau / SCHWELL));
        if (f(m.x, m.y - r, r, true)) return true;
      } else {
        const tf = tau - SCHWELL;
        const y = m.y - R_TROPFEN - 0.5 * G_TROPFEN * tf * tf;
        if (m.y - y > FALL) continue;
        if (f(m.x, y, R_TROPFEN, false)) return true;
      }
    }
    return false;
  }

  function bewegerTrifft(m, x, y, t, r) {
    if (m.art === "tropfen") return tropfenBei(m, t, (tx, ty, tr) => Math.hypot(x - tx, y - ty) < r + tr);
    const o = bewegerOrt(m, t);
    const lx = (x - o.x) * o.dir;
    const ly = y - o.y;
    if (Math.abs(lx) > m.gross + r || Math.abs(ly) > m.gross + r) return false;
    const prims = bewegerForm(m, o);
    for (let i = 0; i < prims.length; i += 1) if (abstandForm(prims[i], lx, ly) < r) return true;
    return false;
  }

  function bewegerEinreihen(m) {
    const liste = state.beweger;
    let i = liste.length;
    while (i > 0 && liste[i - 1].y0 > m.y0) i -= 1;
    liste.splice(i, 0, m);
    state.langMaxB = Math.max(state.langMaxB, m.y1 - m.y0 + 2);
  }

  function abIndex(liste, y, schluessel) {
    let lo = 0;
    let hi = liste.length;
    while (lo < hi) {
      const m = (lo + hi) >> 1;
      if (schluessel(liste[m]) < y) lo = m + 1; else hi = m;
    }
    return lo;
  }
  const yVonTeil = (o) => o.box.y0;
  const yVonBeweger = (m) => m.y0;

  // Was die Blase hier zur Zeit t trifft (der Rand, was steht, was sich
  // bewegt) – null heisst: nichts. r: wie nah es kommen darf.
  function trifft(x, y, t, r = RH) {
    if (Math.abs(x) + r > RAND) return { art: "rand", welt: weltBei(y) };
    // Unten beim Start: der Gartentisch und der Rasen.
    if (y - r < -35 && Math.abs(x) < 38 && y > -42) return { art: "tisch" };
    if (y - r < -118) return { art: "rasen" };
    const L = state.hindernisse;
    for (let i = abIndex(L, y - r - state.langMax, yVonTeil); i < L.length; i += 1) {
      const o = L[i];
      if (o.box.y0 > y + r) break;
      if (o.box.y1 < y - r || o.box.x0 > x + r || o.box.x1 < x - r) continue;
      const p = formTrifft(o.prims, x, y, r);
      if (p) return { art: o.art, rolle: p.rolle, o };
    }
    const B = state.beweger;
    for (let i = abIndex(B, y - r - state.langMaxB, yVonBeweger); i < B.length; i += 1) {
      const m = B[i];
      if (m.y0 > y + r) break;
      if (m.y1 < y - r) continue;
      if (bewegerTrifft(m, x, y, t, r)) return { art: m.art, m };
    }
    return null;
  }

  // ---------------------------------------------------------------------------
  // Die Welt: der Weg, Abschnitt um Abschnitt
  // ---------------------------------------------------------------------------
  /*
   * Ein Abschnitt ist eine Lage aus einer bis drei Reihen. Eine Reihe ist
   * ein Tor: von links ein Teil bis an die Gasse, von rechts eins, dazwischen
   * die Lücke – so breit wie die Blase und die Marge auf jeder Seite. Zuerst
   * der Weg (wo die Lücken liegen, und wie die Gasse dazwischen hinüber-
   * schwingt, nie schneller, als eine Blase quer kann), dann die Teile. Die
   * Lagen:
   *
   *   tor        eine Reihe
   *   gerade     die Rennstrecke (der 2. und 3. Abschnitt): zwei Reihen,
   *              die Lücken weit und fast genau übereinander
   *   doppel     zwei, die Lücken versetzt
   *   treppe     drei im Zickzack
   *   tropfen    zwei Reihen; das obere Teil tropft (Düse, Blatt, Rinne)
   *              mitten durch die untere Lücke – erst nach dem Tropfen
   *              hindurch
   *   flieger    eine Reihe, darüber kreuzt etwas die Gasse: Wespe,
   *              Schwalbe, Mauersegler, Wolkenfetzen
   *
   * Jeder achte Abschnitt ist besonders, im Wechsel: der 8., 24., 40. ein
   * Aufwind (eine warme Säule, die schnell durch zwei enge Lücken trägt –
   * wer neben ihr steigt, den holt der Nebel ein), der 16., 32., 48. eine Böe
   * (ein starker Seitenwind über drei Reihen, deren Lücken gegen den Wind
   * wandern).
   *
   * Immer gleich viele Zahlen ziehen, was auch geschieht: Die Welt soll an
   * der Saat hängen, nicht an den Zweigen dieser Funktion.
   */
  function naechsterAbschnitt() {
    const n = state.abschnitte.length;
    const z = [];
    for (let i = 0; i < 24; i += 1) z.push(zufall.zahl());
    const nr = n + 1;
    const besonders = nr % 8 === 0 ? ((nr / 8) % 2 === 1 ? "aufwind" : "boee") : "";
    const vor = { ...state.letzte };
    const tS = tSchaetzen(vor.y + 120);
    const k0 = schwere(tS);
    const m0 = margeBei(tS);
    const e0 = luftBei(tS);
    const v0 = vAuf(tS);
    const welt = weltBei(vor.y + 100);

    let lage;
    if (besonders) lage = besonders;
    else if (n === 0) lage = "tor";
    else if (n >= 1 && n <= 2) lage = "gerade";
    else if (n === 3) lage = "doppel";
    else if (n === 4) lage = "tropfen";
    else {
      const gewichte = [
        ["tor", 1],
        ["doppel", lerp(0.55, 1.05, k0)],
        ["treppe", n >= 6 ? lerp(0.15, 0.75, k0) : 0],
        ["tropfen", welt <= 2 ? lerp(0.3, 0.55, k0) : 0],
        ["flieger", welt >= 1 || n >= 5 ? lerp(0.3, 0.85, k0) : 0],
      ];
      let summe = 0;
      gewichte.forEach(([, w]) => { summe += w; });
      let r = z[0] * summe;
      lage = gewichte[0][0];
      for (const [name, w] of gewichte) {
        r -= w;
        if (r < 0) { lage = name; break; }
      }
    }

    let fertig = null;
    for (const [lageJetzt, mass] of [[lage, 1], [lage, 1.3], ["tor", 1.7]]) {
      const merk = merken(n);
      const v = bauen(lageJetzt, mass, { n, z, vor, k0, m0, e0, v0, welt });
      if (v && sicher(v.von, v.bis)) { fertig = { ...v, lage: lageJetzt }; break; }
      zurueck(merk);
    }
    if (!fertig) {
      // Darf nicht vorkommen (die Prüfung zählt mit) – dann eben ein weites Tor.
      state.planFehler += 1;
      fertig = { ...bauen("tor", 2.4, { n, z, vor, k0, m0, e0, v0, welt }), lage: "tor" };
    }
    if (fertig.lage === "aufwind") state.zahlAufwind += 1;
    if (fertig.lage === "boee") state.zahlBoee += 1;
  }

  // Was ein Abschnitt verändert, um es zurückzunehmen, wenn er nicht hält.
  function merken(n) {
    return {
      n, weg: state.weg.length, vorPu: state.weg[state.weg.length - 1].pu, ys: state.plan.ys.length, sim: { ...state.plan.sim }, letzte: { ...state.letzte },
      abschnitte: state.abschnitte.length, langMax: state.langMax, langMaxB: state.langMaxB,
    };
  }
  function zurueck(m) {
    state.weg.length = m.weg;
    state.weg[state.weg.length - 1].pu = m.vorPu;
    state.plan.ys.length = m.ys;
    state.plan.sim = m.sim;
    state.letzte = m.letzte;
    state.abschnitte.length = m.abschnitte;
    state.hindernisse = state.hindernisse.filter((o) => o.nr !== m.n);
    state.beweger = state.beweger.filter((o) => o.nr !== m.n);
    state.aufwinde = state.aufwinde.filter((o) => o.nr !== m.n);
    state.boeen = state.boeen.filter((o) => o.nr !== m.n);
    state.langMax = m.langMax;
    state.langMaxB = m.langMaxB;
  }

  /*
   * Eine Lage bauen. Gibt zurück, welche Höhen nachzuprüfen sind. mass > 1:
   * der zweite Versuch, mit mehr Luft und mehr Abstand.
   */
  function bauen(lage, mass, ctx) {
    const { n, z, vor, k0, m0, e0, v0, welt } = ctx;
    const k = k0 / mass;
    let m = m0 * (lage === "aufwind" || lage === "boee" ? 1.12 : 1) * Math.min(1.5, mass);
    const e = e0 * mass;
    const xMax = RAND - R - m - 2.5;
    const reihen = [];
    let y = vor.y;
    let x = vor.x;
    let von = vor.y - 40;
    // Im zweiten und dritten Versuch bleibt die Gasse über der letzten Reihe
    // länger gerade – oft ragte dort ein Teil hinein.
    const vorWp = state.weg[state.weg.length - 1];
    if (mass > 1 && vorWp.pu > 0) vorWp.pu = Math.max(vorWp.pu, PLATEAU + 12 * Math.min(2, (mass - 1) / 0.3));
    // Der Abstand der Reihen: am Anfang fast zwei Meter, später gut einer –
    // aber nie weniger, als die Blase in gut einer Sekunde steigt.
    const abstand = (zi) => Math.max(lerp(175, 112, k), v0 * lerp(1.6, 1.1, k)) * Math.pow(mass, 0.3) * (0.9 + 0.2 * zi);
    // Wie weit die nächste Lücke daneben liegt – so weit, wie eine Blase quer
    // kommt, solange sie von Reihe zu Reihe steigt.
    const versatz = (dy, zi, zr) => {
      const zeit = Math.max(0.3, (dy - 2 * PLATEAU) / v0);
      const max = (lerp(30, 55, k) * zeit) / 1.5;
      let d = Math.min(max, lerp(16, 30, k) + zi * lerp(18, 50, k));
      let sg = zr < 0.7 ? (x > 0 ? -1 : 1) : (x > 0 ? 1 : -1);
      if (Math.abs(x + sg * d) > xMax) sg = -sg;
      d = Math.min(d, Math.abs(xMax - sg * x));
      return clamp(x + sg * d, -xMax, xMax);
    };
    const neueReihe = (yr, gx, mr, i, extra = {}) => {
      const wp = { y: yr, x: gx, pu: PLATEAU, pd: PLATEAU };
      reihen.push({ y: yr, x: gx, m: mr, i, wp, ...extra });
      state.weg.push(wp);
      y = yr;
      x = gx;
    };

    if (lage === "gerade") {
      // Die Rennstrecke am Anfang: zwei Abschnitte zu zwei Reihen, die
      // Lücken fast genau über der letzten und weiter als sonst – wer viel
      // von unten bläst, fliegt hier schnell durch und holt sich den Faktor.
      // Dahinter kommt die Baumkrone wie bisher; wer dort noch rast, lebt
      // gefährlich.
      m *= 1.15;
      const xg = RAND - R - m - 2.5;
      for (let i = 0; i < 2; i += 1) {
        const dy = abstand(z[1 + i]) * (i > 0 ? 0.9 : 1);
        neueReihe(y + dy, clamp(x + (z[4 + i] - 0.5) * 10, -xg, xg), m, i);
      }
    } else if (lage === "tor" || lage === "doppel" || lage === "treppe") {
      const zahl = lage === "tor" ? 1 : lage === "doppel" ? 2 : 3;
      for (let i = 0; i < zahl; i += 1) {
        const dy = (n === 0 && i === 0 ? 120 : abstand(z[1 + i])) * (i > 0 ? 0.82 : 1);
        let gx = versatz(dy, z[4 + i], z[7 + i]);
        if (n === 0 && i === 0) gx = (z[1] < 0.5 ? 1 : -1) * 25;
        neueReihe(y + dy, gx, m, i);
      }
    } else if (lage === "tropfen") {
      // Unten die Lücke, darüber das Teil, das in sie hineintropft; die
      // nächste Lücke auf der anderen Seite des Tropfens.
      const dy = abstand(z[1]);
      const gxA = clamp(versatz(dy, z[4], z[7]), -xMax + 10, xMax - 10);
      neueReihe(y + dy, gxA, m, 0);
      const sQ = gxA < 0 ? -1 : 1;
      const tx = gxA + (z[10] - 0.5) * 5;
      const dyB = 62 + z[11] * 18;
      const gxB = clamp(tx - sQ * (2.5 + R + m + 3 + z[12] * 10), -xMax, xMax);
      neueReihe(y + dyB, gxB, m, 1, { quelle: { s: sQ, x: tx } });
    } else if (lage === "flieger") {
      const dy = abstand(z[1]);
      neueReihe(y + dy, versatz(dy, z[4], z[7]), m, 0);
      // Darüber kreuzt es; die Gasse führt gerade hindurch, dann erst die
      // nächste Reihe.
      const yc = y + PLATEAU + R + 18 + z[17] * 10;
      reihen[0].flieger = yc;
      state.weg.push({ y: yc + 30, x, pu: 0, pd: 0 });
      y = yc + 30;
    } else if (lage === "aufwind") {
      // Erst das Tor in die Säule, darin zwei enge Lücken genau darüber.
      const dy = abstand(z[1]);
      const xc = clamp(versatz(dy, z[4], z[7]), -(xMax - 8), xMax - 8);
      const mi = Math.max(3.2, m0 * 0.55);
      neueReihe(y + dy, xc, m, 0);
      const yA = y;
      neueReihe(yA + 110, xc, mi, 1);
      neueReihe(yA + 210, xc, mi, 2);
      state.weg.push({ y: yA + 300, x: xc, pu: 0, pd: 0 });
      state.aufwinde.push({ nr: n, x: xc, b: R + 11, y0: yA - 30, y1: yA + 300 });
      y = yA + 300;
    } else if (lage === "boee") {
      // Die Böe bläst quer; die Lücken wandern ihr entgegen.
      const sg = z[2] < 0.5 ? 1 : -1;
      const w = sg * (34 + 14 * k0);
      const y0 = y + abstand(z[1]) * 0.55;
      let gx = clamp(x + sg * 14, -xMax, xMax);
      for (let i = 0; i < 3; i += 1) {
        neueReihe(y0 + 80 + i * 120, gx, m, i);
        gx = clamp(gx - sg * (20 + 8 * z[3 + i]), -xMax, xMax);
      }
      state.boeen.push({ nr: n, y0, y1: y0 + 420, w });
    }

    state.letzte = { y, x };
    const yTop = y;
    // Im Aufwind gilt überall die Marge der engen Lücken.
    if (lage === "aufwind") m = Math.min(...reihen.map((r) => r.m));
    // Der Abschnitt beginnt über der letzten Reihe: Bis dorthin gilt die
    // Marge, für die sie gebaut ist.
    state.abschnitte.push({ nr: n, lage, besonders: lage === "aufwind" || lage === "boee" ? lage : "", y0: vor.y + Math.max(PLATEAU, vorWp.pu) + R, y1: yTop, m, e, t0: 0 });

    // Die Teile jeder Reihe – die Welt nach der Höhe, die Art aus der Saat.
    const tropfer = [];
    reihen.forEach((r, i) => {
      const gh = R + r.m + 0.6;
      const w = weltBei(r.y);
      const za = z[13 + ((i * 3) % 10)];
      const zb = z[14 + ((i * 3) % 9)];
      const zc = z[15 + ((i * 3) % 8)];
      const hoch = clamp((r.y - WELT_AB[2]) / (WELT_AB[3] - WELT_AB[2]), 0, 1);
      let hochNah = r.y;
      let tiefNah = r.y;
      // Auf der Rennstrecke hängt der Gartenschlauch über die Hecke – hier
      // ohne Tropfen, damit nichts den Raser im Takt erwischt.
      const schlauchSeite = lage === "gerade" && n === 1 && i === 1 && w === 0 ? (z[7] < 0.5 ? -1 : 1) : 0;
      [-1, 1].forEach((s) => {
        const spitze = r.x + s * gh;
        let o = null;
        if (s === schlauchSeite) {
          const q = baueSchlauch(s, spitze, r.y, za);
          delete q.tropf;
          o = teilFertig(q, spitze);
        } else if (r.quelle && r.quelle.s === s) {
          // Das Teil, das tropft: Düse im Garten, Blatt im Baum, Rinne am Dach.
          const sp = s < 0 ? Math.min(spitze, r.quelle.x + 2.4) : Math.max(spitze, r.quelle.x - 2.4);
          const q = w === 0 ? baueSchlauch(s, sp, r.y, za) : w === 1 ? baueAst(s, sp, r.y, za, zb, zc, true) : baueDach(s, sp, r.y, za, 0.9, true);
          o = teilFertig(q, sp);
        } else {
          o = teilBauen(w, s, spitze, r.y, s < 0 ? za : zb, s < 0 ? zb : zc, s < 0 ? zc : za, hoch);
        }
        if (!o) return;
        o.nr = n;
        einreihen(o);
        // Wie hoch und tief das Teil nahe der Lücke reicht.
        o.prims.forEach((p) => {
          const nah = s < 0 ? rechts(p) > spitze - 28 : p.x0 < spitze + 28;
          if (!nah) return;
          hochNah = Math.max(hochNah, oben(p));
          tiefNah = Math.min(tiefNah, p.y0);
        });
        if (o.tropf) tropfer.push(o);
      });
      r.wp.pu = clamp(hochNah - r.y + 3, PLATEAU, 38);
      r.wp.pd = clamp(r.y - tiefNah + 3, PLATEAU, 38);
    });
    zeitplanBis(yTop + 30);
    state.abschnitte[state.abschnitte.length - 1].t0 = tRef(state.abschnitte[state.abschnitte.length - 1].y0);

    // Was sich bewegt, zuletzt – nach dem fertigen Weg und seinem Zeitplan.
    tropfer.forEach((o) => {
      // Der Tropfer: so oft, dass zwischen zwei Tropfen Zeit genug ist, durch
      // die Spalte zu steigen.
      const tr = { nr: n, art: "tropfen", x: o.tropf.x, y: o.tropf.y, P: 1.5, ph: 0, tMax: SCHWELL + Math.sqrt((2 * FALL) / G_TROPFEN), y0: o.tropf.y - FALL - 3, y1: o.tropf.y + 3, gross: 3 };
      tr.P = tropfTakt(tr, e) + 0.3 * z[16];
      von = Math.min(von, tr.y0);
      if (phasenSuchen(tr, e, tr.P)) bewegerEinreihen(tr);
    });
    reihen.forEach((r) => {
      if (!r.flieger) return;
      const fl = fliegerBauen(r, weltBei(r.y), z, n, k);
      if (!fl) return;
      von = Math.min(von, fl.y0);
      if (phasenSuchen(fl, e, fl.periode)) bewegerEinreihen(fl);
    });
    return { von, bis: yTop + PLATEAU + R + 10, m, e };
  }

  // Wie lange die Blase des Zeitplans unter dem Tropfer in seiner Spalte
  // ist – so lang und etwas mehr muss der Takt der Tropfen sein.
  function tropfTakt(tr, e) {
    let t0 = null;
    let t1 = null;
    for (let y = tr.y - FALL; y < tr.y; y += 2) {
      const drin = Math.abs(wegX(y) - tr.x) < R + R_TROPFEN + 8;
      if (drin) {
        const t = tRef(y);
        if (t0 === null) t0 = t;
        t1 = t;
      }
    }
    const lang = t0 === null ? 0.4 : t1 - t0;
    return clamp(lang + 2 * e + 0.55, 1.2, 3.2);
  }

  // Was über einer Reihe die Gasse kreuzt, je nach Welt.
  function fliegerBauen(r, w, z, n, k) {
    const yc = r.flieger;
    const xc = r.x;
    if (w <= 1) {
      // Eine Wespe fliegt eine Acht über der Lücke.
      const periode = lerp(2.4, 1.7, k);
      return { nr: n, art: "wespe", xc: clamp(xc + (z[18] - 0.5) * 16, -40, 40), yc, A: 26 + z[19] * 12, B: 4.5, w: TAU / periode, ph: 0, sinn: z[20] < 0.5 ? 1 : -1, periode, gross: 7, y0: yc - 11, y1: yc + 11 };
    }
    if (w === 2) {
      const periode = lerp(3.0, 2.3, k);
      return { nr: n, art: "schwalbe", xc: (z[18] - 0.5) * 20, yc, A: 56 + z[19] * 18, B: 9 + z[21] * 8, w: TAU / periode, ph: 0, sinn: z[20] < 0.5 ? 1 : -1, schlagT: 13, periode, gross: 12, y0: yc - 30, y1: yc + 30 };
    }
    if (z[22] < 0.45) {
      // Ein Wolkenfetzen treibt quer durch.
      const u = (z[20] < 0.5 ? 1 : -1) * (16 + 8 * z[19]);
      const puffs = [[0, 0, 7.5], [-8, -1.5, 5.5], [8.5, 0.5, 6], [3, 4.5, 5]];
      return { nr: n, art: "fetzen", x0: xc, yc, u, tc: tRef(yc), puffs, periode: 6, gross: 16, y0: yc - 12, y1: yc + 12 };
    }
    const periode = lerp(2.1, 1.6, k);
    return { nr: n, art: "segler", xc: (z[18] - 0.5) * 24, yc, A: 74 + z[19] * 16, B: 6 + z[21] * 6, w: TAU / periode, ph: 0, sinn: z[20] < 0.5 ? 1 : -1, schlagT: 20, periode, gross: 12, y0: yc - 24, y1: yc + 24 };
  }

  /*
   * Die Phase eines Bewegers so wählen, dass er die Gasse frei lässt, wenn
   * die Blase des Zeitplans kommt – zu früh oder zu spät bis luft, quer
   * bis zur Marge. Zwölf Phasen werden der Reihe nach versucht.
   */
  function phasenSuchen(mv, e, periode) {
    for (let i = 0; i < 12; i += 1) {
      const f = ((i * 5) % 12) / 12;
      if (mv.art === "fetzen") mv.tc = tRef(mv.yc) + (f - 0.5) * 2 * 2.6 + (f < 0.5 ? -1.4 : 1.4);
      else if (mv.art === "tropfen") mv.ph = f * periode;
      else mv.ph = f * TAU;
      if (bewegerFrei(mv, e)) return true;
    }
    return false;
  }

  function bewegerFrei(mv, e) {
    const y0 = Math.max(0, mv.y0 - RH);
    const y1 = mv.y1 + RH;
    for (let y = y0; y <= y1; y += 1.2) {
      const x = wegX(y);
      const m = margeAn(y);
      const t = tRef(y);
      const n = Math.max(1, Math.ceil((2 * m) / 2.5));
      for (let j = 0; j <= 8; j += 1) {
        const tt = t + (j / 4 - 1) * e;
        for (let i = 0; i <= n; i += 1) {
          if (bewegerTrifft(mv, x - m + (2 * m * i) / n, y, tt, RH + 0.3)) return false;
        }
      }
    }
    return true;
  }

  // Die Marge und die Luft in der Höhe y: die ihres Abschnitts.
  function abschnittBei(y) {
    const liste = state.abschnitte;
    let lo = 0;
    let hi = liste.length - 1;
    if (hi < 0 || y < liste[0].y0) return 0;
    while (lo < hi) {
      const m = (lo + hi + 1) >> 1;
      if (liste[m].y0 <= y) lo = m; else hi = m - 1;
    }
    return lo;
  }
  const margeAn = (y) => state.abschnitte[abschnittBei(y)]?.m ?? M0;
  const luftAn = (y) => state.abschnitte[abschnittBei(y)]?.e ?? E0;

  /*
   * Hält die Gasse? Von y0 bis y1, alle anderthalb Zentimeter: quer über die
   * ganze Marge (alle zweieinhalb Zentimeter) frei von allem, was steht, und
   * vom Rand – und bei allem, was sich bewegt, auch zu früh und zu spät.
   */
  function sicher(y0, y1) {
    zeitplanBis(y1 + 20);
    for (let y = Math.max(0, y0); y <= y1; y += 1.5) {
      const x = wegX(y);
      const m = margeAn(y);
      const e = luftAn(y);
      const n = Math.max(1, Math.ceil((2 * m) / 2.5));
      const t = tRef(y);
      for (let i = 0; i <= n; i += 1) {
        const xx = x - m + (2 * m * i) / n;
        if (Math.abs(xx) + RH + 0.2 > RAND) return false;
        const L = state.hindernisse;
        for (let j = abIndex(L, y - RH - state.langMax, yVonTeil); j < L.length; j += 1) {
          const o = L[j];
          if (o.box.y0 > y + RH + 0.3) break;
          if (o.box.y1 < y - RH - 0.3 || o.box.x0 > xx + RH + 0.3 || o.box.x1 < xx - RH - 0.3) continue;
          if (formTrifft(o.prims, xx, y, RH + 0.3)) return false;
        }
      }
      const B = state.beweger;
      for (let j = abIndex(B, y - RH - state.langMaxB, yVonBeweger); j < B.length; j += 1) {
        const mv = B[j];
        if (mv.y0 > y + RH) break;
        if (mv.y1 < y - RH) continue;
        for (let q = 0; q <= 8; q += 1) {
          const tt = t + (q / 4 - 1) * e;
          for (let i = 0; i <= n; i += 1) if (bewegerTrifft(mv, x - m + (2 * m * i) / n, y, tt, RH + 0.3)) return false;
        }
      }
    }
    return true;
  }

  // Die Welt steht bis zur Höhe y – je Aufruf höchstens «mal» Abschnitte,
  // damit kein Bild lange wartet.
  function planBis(y, mal = 40) {
    for (let i = 0; i < mal && state.letzte.y < y; i += 1) naechsterAbschnitt();
  }

  function weltNeu() {
    state.weg = [{ y: 0, x: 0, pu: 30, pd: 30 }];
    state.plan = planNeu();
    state.hindernisse = [];
    state.beweger = [];
    state.abschnitte = [];
    state.aufwinde = [];
    state.boeen = [];
    state.letzte = { y: 0, x: 0 };
    state.windPhase = [zufall.zahl() * TAU, zufall.zahl() * TAU];
    state.langMax = 60;
    state.langMaxB = 60;
    state.planFehler = 0;
    state.zahlAufwind = 0;
    state.zahlBoee = 0;
    state.abschnitt = -1;
    planBis(900);
  }

  // Die Welt als Text – für die Prüfung, dass in einem Turnier alle
  // dieselbe bekommen.
  function kursText(bis = 60) {
    zeitplanBis(0);
    while (tSchaetzen(state.letzte.y) < bis) naechsterAbschnitt();
    const yb = yRef(bis);
    const teile = state.hindernisse.filter((o) => o.box.y0 < yb).map((o) => `${o.art}${o.box.x0.toFixed(1)}/${o.box.x1.toFixed(1)}/${o.box.y0.toFixed(1)}`);
    const flieger = state.beweger.filter((m) => m.y0 < yb).map((m) => `${m.art}${(m.ph ?? m.tc).toFixed(3)}`);
    const lagen = state.abschnitte.filter((a) => a.y0 < yb).map((a) => a.lage);
    return `${teile.join(",")} | ${flieger.join(",")} | ${lagen.join(",")} | ${state.weg.filter((w) => w.y < yb).map((w) => w.x.toFixed(2)).join(",")}`;
  }

  // ---------------------------------------------------------------------------
  // Die Fläche
  // ---------------------------------------------------------------------------
  function buildPlatz() {
    const platz = shell.el("div", "sb-platz");
    feld = shell.el("div", "sb-feld");
    canvas = document.createElement("canvas");
    canvas.className = "sb-canvas";
    canvas.setAttribute("aria-hidden", "true");
    feld.append(canvas);
    g = canvas.getContext("2d");

    // Der Hinweis vor dem ersten Tipp: zwei Ringe unter der Blase – von dort
    // bläst ein Tipp sie hinauf.
    const tipp = shell.el("span", "sb-tipp");
    tipp.setAttribute("aria-hidden", "true");
    const ns = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(ns, "svg");
    svg.setAttribute("viewBox", "0 0 64 64");
    ["sb-tipp-ring", "sb-tipp-ring is-spaet"].forEach((klasse) => {
      const k = document.createElementNS(ns, "circle");
      k.setAttribute("class", klasse);
      k.setAttribute("cx", "32");
      k.setAttribute("cy", "32");
      k.setAttribute("r", "14");
      k.setAttribute("fill", "none");
      k.setAttribute("stroke", "#ffffff");
      k.setAttribute("stroke-width", "4");
      svg.append(k);
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
    const frei = Math.min(cssH * 0.3, shell?.frei?.(canvas) || 0);
    if (cssW === view.cssW && cssH === view.cssH && dpr === view.dpr && frei === view.frei) return;
    view.cssW = cssW;
    view.cssH = cssH;
    view.dpr = dpr;
    view.frei = frei;
    // Der Massstab: hochkant gibt die Breite das Feld vor, quer die Höhe –
    // über der Blase sieht man auf jedem Gerät gleich weit voraus.
    view.s = Math.min(cssW / FELD_SICHT, (cssH - frei - 6) / (SICHT_OBEN + SICHT_UNTEN));
    view.blaseY = Math.round(frei + Math.min(SICHT_OBEN * view.s, 0.62 * (cssH - frei)));
    const pw = Math.round(cssW * dpr);
    const ph = Math.round(cssH * dpr);
    if (canvas.width !== pw) canvas.width = pw;
    if (canvas.height !== ph) canvas.height = ph;
    if (tippRinge) {
      tippRinge.style.left = `${Math.round(cssW / 2)}px`;
      tippRinge.style.top = `${Math.round(view.blaseY + 24 * view.s)}px`;
    }
    ebenenNeu();
    // Steht die Schleife (auf der Tafel nach dem Platzen), malt niemand
    // nach – also hier, sonst bliebe die Leinwand nach dem Drehen leer.
    if (!frame) zeichnen();
  }

  const bildX = (x) => view.cssW / 2 + x * view.s;
  const bildY = (y) => view.cssH - (y - state.camY) * view.s;
  const camZiel = () => state.blase.y - (view.cssH - view.blaseY) / view.s;

  // ---------------------------------------------------------------------------
  // Malen: die Farben des Abends
  // ---------------------------------------------------------------------------
  // Das Licht kommt tief von links (die Sonne steht über dem Horizont):
  // warm auf allem, was nach links schaut, violett im Schatten.
  const LICHT = [255, 196, 128];
  const SCHATTEN = [74, 52, 96];

  // Kleine Scheine, einmal gemalt: Licht, Glanz, Glühwürmchen, Bokeh.
  const SCHEINE = {
    warm: [[255, 214, 150], 1, 0.8],
    gold: [[255, 186, 90], 1, 0.8],
    weiss: [[255, 255, 255], 1, 0.8],
    kalt: [[190, 226, 255], 1, 0.8],
    gruen: [[214, 255, 140], 1, 0.8],
    rosa: [[255, 170, 200], 0.9, 0.8],
    nebel: [[236, 230, 250], 0.7, 0.8],
  };
  function scheinAus(farbe, kraft, r) {
    const c = document.createElement("canvas");
    const n = Math.max(8, Math.round(r * 2 * view.dpr));
    c.width = n;
    c.height = n;
    const k = c.getContext("2d");
    const v = k.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2);
    v.addColorStop(0, rgba(farbe, kraft));
    v.addColorStop(0.25, rgba(farbe, kraft * 0.5));
    v.addColorStop(1, rgba(farbe, 0));
    k.fillStyle = v;
    k.fillRect(0, 0, n, n);
    return c;
  }
  // r in CSS-Pixeln.
  function schein(name, x, y, r, alpha = 1) {
    const bild = ebenen?.scheine?.[name];
    if (!bild || alpha <= 0.01) return;
    g.globalAlpha = Math.min(1, alpha);
    g.drawImage(bild, x - r, y - r, 2 * r, 2 * r);
    g.globalAlpha = 1;
  }

  // Eine leere Leinwand von w × h CSS-Pixeln (in Bildpunkten).
  function leinwand(w, h) {
    const c = document.createElement("canvas");
    c.width = Math.max(2, Math.round(w * view.dpr));
    c.height = Math.max(2, Math.round(h * view.dpr));
    return c;
  }

  // ---------------------------------------------------------------------------
  // Malen: der Himmel – ein hohes Bild, das langsam hinabgleitet
  // ---------------------------------------------------------------------------
  /*
   * Der ganze Abendhimmel der Reise steht in einem einzigen hohen Bild: unten
   * die Sonne über den Alpen, goldene und rosa Wolkenbänke, darüber Flieder
   * und Violett, ganz oben die Nacht mit Mond und Sternen. Steigt die Blase,
   * gleitet es mit einem Zwanzigstel ihres Tempos hinab – die Sonne sinkt
   * hinter den Garten, der Himmel wird tief.
   */
  const HIMMEL_HOCH = 7000;
  const PH = 0.055;
  // Über den Dächern: So weit von der Mitte beginnen die fernen Wände der
  // Gasse (Anteil des halben Feldes); dazwischen Himmel und Dachlandschaft,
  // die sehr langsam hinabgleitet (PD).
  const GASSE_INNEN = 0.55;
  const PD = 0.022;

  function maleHimmel(k, W, Ht, H) {
    // Die Farben von unten (0) nach oben, in Bildhöhen über dem unteren Rand.
    const stufen = [
      [0, [255, 212, 150]], [0.3, [252, 178, 138]], [0.75, [228, 142, 156]], [1.15, [176, 124, 178]],
      [1.5, [118, 98, 170]], [1.9, [64, 62, 136]], [2.4, [34, 36, 96]], [3, [18, 20, 60]],
    ];
    const v = k.createLinearGradient(0, Ht, 0, 0);
    stufen.forEach(([u, c]) => v.addColorStop(clamp((u * H) / Ht, 0, 1), rgb(c)));
    k.fillStyle = v;
    k.fillRect(0, 0, W, Ht);
    const rnd = wuerfel(4711);
    // Die Sonne tief links, mit grossem warmem Hof.
    const sx = W * 0.24;
    const sy = Ht - H * 0.3;
    const sr = Math.max(18, Math.min(W, H) * 0.06);
    k.globalCompositeOperation = "lighter";
    [[sr * 14, [255, 150, 80], 0.32], [sr * 6, [255, 190, 110], 0.4], [sr * 2.4, [255, 230, 170], 0.6]].forEach(([r, c, a]) => {
      const h = k.createRadialGradient(sx, sy, 0, sx, sy, r);
      h.addColorStop(0, rgba(c, a));
      h.addColorStop(1, rgba(c, 0));
      k.fillStyle = h;
      k.fillRect(sx - r, sy - r, 2 * r, 2 * r);
    });
    k.globalCompositeOperation = "source-over";
    k.fillStyle = "rgb(255, 246, 220)";
    k.beginPath();
    k.arc(sx, sy, sr, 0, TAU);
    k.fill();
    // Strahlen, die die Sonne durch den Dunst wirft.
    k.globalCompositeOperation = "lighter";
    // Jeder Strahl aus drei Keilen ineinander: so hat er weiche Ränder.
    for (let i = 0; i < 9; i += 1) {
      const w = -Math.PI / 2 + (rnd() - 0.5) * 2.4;
      const l = H * (0.7 + rnd() * 0.6);
      const b = 0.03 + rnd() * 0.05;
      const gr = k.createLinearGradient(sx, sy, sx + Math.cos(w) * l, sy + Math.sin(w) * l);
      gr.addColorStop(0, "rgba(255, 220, 160, 0.07)");
      gr.addColorStop(0.6, "rgba(255, 220, 160, 0.03)");
      gr.addColorStop(1, "rgba(255, 220, 160, 0)");
      k.fillStyle = gr;
      [1, 0.62, 0.3].forEach((f) => {
        k.beginPath();
        k.moveTo(sx, sy);
        k.lineTo(sx + Math.cos(w - b * f) * l, sy + Math.sin(w - b * f) * l);
        k.lineTo(sx + Math.cos(w + b * f) * l, sy + Math.sin(w + b * f) * l);
        k.closePath();
        k.fill();
      });
    }
    k.globalCompositeOperation = "source-over";
    // Wolkenbänke: unten golden von unten angestrahlt, oben flieder.
    for (let i = 0; i < 16; i += 1) {
      const u = 0.12 + Math.pow(rnd(), 1.25) * 2.4;
      const cy = Ht - u * H;
      const cx = rnd() * W;
      const breit = W * (0.25 + rnd() * 0.5);
      const hoch = H * (0.012 + rnd() * 0.025);
      const warm = clamp(1 - u / 1.6, 0, 1);
      for (let j = 0; j < 7; j += 1) {
        const ex = cx + (rnd() - 0.5) * breit;
        const ey = cy + (rnd() - 0.5) * hoch * 2;
        const rx = breit * (0.12 + rnd() * 0.18);
        const ry = hoch * (0.8 + rnd());
        const c1 = mix3([150, 110, 170], [255, 170, 130], warm);
        const c2 = mix3([200, 150, 200], [255, 214, 160], warm);
        k.save();
        k.translate(ex, ey);
        k.scale(rx / ry, 1);
        const h = k.createRadialGradient(0, ry * 0.35, 0, 0, 0, ry);
        h.addColorStop(0, rgba(c2, 0.55));
        h.addColorStop(0.6, rgba(c1, 0.35));
        h.addColorStop(1, rgba(c1, 0));
        k.fillStyle = h;
        k.beginPath();
        k.arc(0, 0, ry, 0, TAU);
        k.fill();
        k.restore();
      }
    }
    // Die Alpen am Horizont: ein Kamm in Blauviolett, die Gipfel rosa.
    const fuss = Ht - H * 0.18;
    k.beginPath();
    k.moveTo(0, Ht);
    let gx = 0;
    const kamm = [];
    while (gx <= W + 20) {
      const h = H * (0.05 + 0.13 * Math.pow(Math.abs(Math.sin(gx * 0.011 + 1.3) * Math.sin(gx * 0.0047 + 0.4)), 0.8) + 0.025 * rnd());
      kamm.push([gx, fuss - h]);
      k.lineTo(gx, fuss - h);
      gx += 6 + rnd() * 12;
    }
    k.lineTo(W, Ht);
    k.closePath();
    const bg = k.createLinearGradient(0, fuss - H * 0.2, 0, fuss);
    bg.addColorStop(0, "rgb(150, 120, 176)");
    bg.addColorStop(1, "rgb(196, 150, 176)");
    k.fillStyle = bg;
    k.fill();
    k.fillStyle = "rgba(255, 196, 196, 0.55)";
    for (let i = 1; i < kamm.length - 1; i += 1) {
      const [x, y] = kamm[i];
      if (y < kamm[i - 1][1] && y < kamm[i + 1][1] && fuss - y > H * 0.1) {
        k.beginPath();
        k.moveTo(x, y);
        k.lineTo(x - (fuss - y) * 0.22, y + (fuss - y) * 0.3);
        k.lineTo(x + (fuss - y) * 0.06, y + (fuss - y) * 0.22);
        k.closePath();
        k.fill();
      }
    }
    // Dunst über dem Horizont.
    const d = k.createLinearGradient(0, fuss - H * 0.1, 0, Ht);
    d.addColorStop(0, "rgba(255, 210, 170, 0)");
    d.addColorStop(1, "rgba(255, 210, 170, 0.6)");
    k.fillStyle = d;
    k.fillRect(0, fuss - H * 0.1, W, Ht - fuss + H * 0.1);
    // Sterne: je höher, desto mehr.
    for (let i = 0; i < 260; i += 1) {
      const u = 1.15 + rnd() * (Ht / H - 1.15);
      const y = Ht - u * H;
      if (y < 0) continue;
      const a = clamp((u - 1.15) / 0.8, 0, 1) * (0.35 + 0.65 * rnd());
      k.fillStyle = `rgba(255, 250, 235, ${a})`;
      const r = 0.6 + rnd() * rnd() * 1.6;
      k.fillRect(rnd() * W, y, r * view.dpr * 0.6, r * view.dpr * 0.6);
    }
    // Die Mondsichel.
    const mx = W * 0.76;
    const my = Ht - Math.min(Ht / H - 0.3, 1.75) * H;
    const mr = Math.max(10, Math.min(W, H) * 0.035);
    const hof = k.createRadialGradient(mx, my, 0, mx, my, mr * 5);
    hof.addColorStop(0, "rgba(220, 220, 255, 0.25)");
    hof.addColorStop(1, "rgba(220, 220, 255, 0)");
    k.fillStyle = hof;
    k.fillRect(mx - mr * 5, my - mr * 5, mr * 10, mr * 10);
    // Die Sichel in einem eigenen kleinen Bild: Scheibe, davon der Schatten
    // weggenommen – so bleibt der Himmel hinter ihr, wie er ist.
    const sichel = document.createElement("canvas");
    sichel.width = Math.ceil(mr * 2 + 4);
    sichel.height = sichel.width;
    const q = sichel.getContext("2d");
    const m = sichel.width / 2;
    q.fillStyle = "rgb(250, 244, 222)";
    q.beginPath();
    q.arc(m, m, mr, 0, TAU);
    q.fill();
    q.globalCompositeOperation = "destination-out";
    q.beginPath();
    q.arc(m + mr * 0.45, m - mr * 0.2, mr * 0.92, 0, TAU);
    q.fill();
    k.drawImage(sichel, mx - m, my - m);
  }

  // Die Ferne: Hügel und das Dorf im Tal, hinter dem Garten.
  function maleFerne(k, W, H) {
    const rnd = wuerfel(99);
    const s = view.dpr;
    // Das Bild reicht bis an den unteren Rand; Hügel und Dorf stehen im
    // oberen Teil (O), darunter das Tal.
    const O = H * 0.75;
    // Zwei Hügelzüge im Dunst.
    [[0.35, [176, 132, 170], 0.9], [0.55, [140, 104, 150], 1]].forEach(([hh, c, a], j) => {
      k.fillStyle = rgba(c, a);
      k.beginPath();
      k.moveTo(0, H);
      for (let x = 0; x <= W + 8; x += 8) k.lineTo(x, O * (1 - hh) + Math.sin(x * 0.006 + j * 2) * O * 0.05 + Math.sin(x * 0.017 + j) * O * 0.02);
      k.lineTo(W, H);
      k.closePath();
      k.fill();
    });
    // Das Dorf: Häuser mit Giebeln, warme Fenster, die Kirche.
    const basis = O * 0.72;
    let x = -10;
    while (x < W + 10) {
      const b = (18 + rnd() * 22) * s;
      const h = (12 + rnd() * 16) * s;
      const dachH = h * (0.5 + rnd() * 0.4);
      const y = basis + (rnd() - 0.5) * 10 * s;
      k.fillStyle = rgb(mix3([92, 60, 98], [120, 70, 90], rnd()));
      k.fillRect(x, y - h, b, h + H);
      k.fillStyle = rgb(mix3([116, 56, 70], [140, 72, 72], rnd()));
      k.beginPath();
      k.moveTo(x - 2 * s, y - h);
      k.lineTo(x + b / 2, y - h - dachH);
      k.lineTo(x + b + 2 * s, y - h);
      k.closePath();
      k.fill();
      // Licht am Giebel von links.
      k.strokeStyle = "rgba(255, 190, 130, 0.5)";
      k.lineWidth = 1 * s;
      k.beginPath();
      k.moveTo(x - 2 * s, y - h);
      k.lineTo(x + b / 2, y - h - dachH);
      k.stroke();
      for (let i = 0; i < 3; i += 1) {
        if (rnd() < 0.45) {
          k.fillStyle = `rgba(255, ${200 + rnd() * 40}, 120, 0.9)`;
          k.fillRect(x + b * (0.2 + i * 0.25), y - h * (0.35 + rnd() * 0.3), 2.2 * s, 2.6 * s);
        }
      }
      if (rnd() < 0.12) {
        // Die Kirche mit dem Wetterhahn.
        const tb = 9 * s;
        const tx = x + b + 6 * s;
        const th = 46 * s;
        k.fillStyle = "rgb(96, 64, 102)";
        k.fillRect(tx, y - th, tb, th + H);
        k.fillStyle = "rgb(70, 92, 100)";
        k.beginPath();
        k.moveTo(tx - 2 * s, y - th);
        k.lineTo(tx + tb / 2, y - th - 26 * s);
        k.lineTo(tx + tb + 2 * s, y - th);
        k.closePath();
        k.fill();
        k.fillStyle = "rgb(230, 180, 90)";
        k.fillRect(tx + tb / 2 - 0.5 * s, y - th - 33 * s, 1 * s, 7 * s);
        k.beginPath();
        k.moveTo(tx + tb / 2 - 2.5 * s, y - th - 33 * s);
        k.lineTo(tx + tb / 2 + 3 * s, y - th - 34.5 * s);
        k.lineTo(tx + tb / 2 + 1.5 * s, y - th - 31 * s);
        k.closePath();
        k.fill();
        x += 14 * s;
      }
      // Bäume dazwischen, rund.
      if (rnd() < 0.5) {
        k.fillStyle = rgb(mix3([70, 70, 90], [90, 86, 96], rnd()));
        k.beginPath();
        k.arc(x + b + 3 * s, y - 10 * s, (7 + rnd() * 6) * s, 0, TAU);
        k.fill();
      }
      x += b + (2 + rnd() * 8) * s;
    }
    // Das Tal unter dem Dorf: Wiesen und runde Bäume im Abenddunst.
    const tal = k.createLinearGradient(0, basis, 0, H);
    tal.addColorStop(0, "rgb(126, 96, 116)");
    tal.addColorStop(1, "rgb(96, 82, 104)");
    k.fillStyle = tal;
    k.fillRect(0, basis + 4 * s, W, H - basis);
    // Wiesenstreifen und Hecken im Tal, dazwischen runde Bäume mit hellem
    // Scheitel.
    for (let i = 0; i < 7; i += 1) {
      const y = basis + 10 * s + (i / 7) * (H - basis);
      k.fillStyle = rgba(i % 2 ? [150, 116, 120] : [116, 96, 116], 0.6);
      k.beginPath();
      k.moveTo(0, y);
      for (let x = 0; x <= W + 10; x += 10) k.lineTo(x, y + Math.sin(x * 0.01 + i * 1.7) * 6 * s);
      k.lineTo(W, y + 30 * s);
      k.lineTo(0, y + 30 * s);
      k.closePath();
      k.fill();
    }
    for (let i = 0; i < 24; i += 1) {
      const x = rnd() * W;
      const y = basis + 10 * s + rnd() * (H - basis);
      const r = (4 + rnd() * 5) * s * (0.6 + (y - basis) / (H - basis));
      k.fillStyle = rgba(mix3([84, 84, 92], [104, 96, 104], rnd()), 0.75);
      k.beginPath();
      k.arc(x, y, r, 0, TAU);
      k.fill();
      k.fillStyle = "rgba(255, 190, 150, 0.35)";
      k.beginPath();
      k.arc(x - r * 0.25, y - r * 0.3, r * 0.55, 0, TAU);
      k.fill();
    }
    // Dunst über dem Dorf.
    const d = k.createLinearGradient(0, O * 0.3, 0, H);
    d.addColorStop(0, "rgba(255, 200, 170, 0)");
    d.addColorStop(1, "rgba(255, 190, 160, 0.3)");
    k.fillStyle = d;
    k.fillRect(0, O * 0.3, W, H - O * 0.3);
  }

  // ---------------------------------------------------------------------------
  // Malen: die Kulissen der vier Welten – Kacheln, die sich nach oben
  // wiederholen
  // ---------------------------------------------------------------------------
  // In ein Bild malen, das oben und unten nahtlos weitergeht: jede Form
  // dreimal, eine Kachel höher und tiefer.
  const dreimal = (Hk, malen) => { malen(0); malen(-Hk); malen(Hk); };

  // Ein Laubbüschel als Umriss aus Blattspitzen: aussen die Spitzen, innen
  // die Kerben dazwischen, mit runden Bögen – so liest es sich als Laub.
  function laubForm(k, x, y, r, rnd, n = 13) {
    const pts = [];
    const w0 = rnd() * TAU;
    for (let i = 0; i < n; i += 1) {
      const w = w0 + (i / n) * TAU;
      pts.push([w, r * (0.92 + rnd() * 0.14)]);
    }
    k.beginPath();
    for (let i = 0; i <= n; i += 1) {
      const [w, rr] = pts[i % n];
      const tx = x + Math.cos(w) * rr;
      const ty = y + Math.sin(w) * rr;
      if (i === 0) k.moveTo(tx, ty);
      else {
        // Von der vorigen Spitze über einen Blattbogen zu dieser.
        const [wp] = pts[i - 1];
        const wq = wp + (((w - wp + TAU) % TAU) / 2);
        k.quadraticCurveTo(x + Math.cos(wq) * r * 1.06, y + Math.sin(wq) * r * 1.06, x + Math.cos(wq) * r * 0.8, y + Math.sin(wq) * r * 0.8);
        k.quadraticCurveTo(x + Math.cos(wq + 0.08) * r * 1.04, y + Math.sin(wq + 0.08) * r * 1.04, tx, ty);
      }
    }
    k.closePath();
  }

  // Ein einzelnes Blatt (Bildpunkte): eine Spitzellipse.
  function blattKlein(k, x, y, w, l, b) {
    k.beginPath();
    k.moveTo(x, y);
    k.quadraticCurveTo(x + Math.cos(w) * l * 0.5 - Math.sin(w) * b, y + Math.sin(w) * l * 0.5 + Math.cos(w) * b, x + Math.cos(w) * l, y + Math.sin(w) * l);
    k.quadraticCurveTo(x + Math.cos(w) * l * 0.5 + Math.sin(w) * b, y + Math.sin(w) * l * 0.5 - Math.cos(w) * b, x, y);
    k.fill();
  }

  // Die Farben des Laubs im Abendlicht: tief im Schatten, die Mitte, die
  // Sonnenseite und die Lichtkante. dunst > 0: fern, im Abenddunst.
  function laubFarben(dunst = 0, art = 0) {
    const d = [222, 172, 176];
    const basis = art === 1
      ? { tief: [30, 58, 42], mitte: [60, 104, 52], hell: [138, 172, 66], kante: [255, 222, 140] }
      : { tief: [36, 64, 40], mitte: [74, 114, 48], hell: [158, 182, 70], kante: [255, 214, 128] };
    if (!dunst) return basis;
    // Im Dunst: blasser und mit weniger Kontrast zwischen Schatten und Licht.
    return { tief: mix3(basis.tief, d, dunst), mitte: mix3(basis.mitte, d, dunst * 0.92), hell: mix3(basis.hell, d, dunst * 0.8), kante: mix3(basis.kante, d, dunst * 0.6) };
  }

  // Eine Baumkrone aus Laubbüscheln: hinten und unten rechts dunkel, vorn
  // oben links im Abendlicht, mit einer Lichtkante und einzelnen Blättern am
  // Rand. r in Bildpunkten.
  function krone(k, x, y, r, rnd, pal, alpha = 1) {
    const n = Math.round(9 + r / 5);
    const buesche = [];
    for (let i = 0; i < n; i += 1) {
      const w = rnd() * TAU;
      const d = Math.sqrt(rnd()) * r * 0.6;
      buesche.push([x + Math.cos(w) * d, y + Math.sin(w) * d * 0.82, r * (0.3 + rnd() * 0.14)]);
    }
    // Hinten (weg vom Licht) zuerst.
    buesche.sort((a, b) => (b[0] + b[1]) - (a[0] + a[1]));
    k.globalAlpha = alpha;
    k.fillStyle = rgb(pal.tief);
    buesche.forEach(([bx, by, br]) => { laubForm(k, bx, by, br * 1.06, rnd); k.fill(); });
    buesche.forEach(([bx, by, br]) => {
      const licht = clamp(0.5 - ((bx - x) + (by - y)) / (r * 1.4), 0, 1);
      k.fillStyle = rgb(mix3(pal.tief, pal.mitte, 0.55 + 0.45 * licht));
      laubForm(k, bx - br * 0.06, by - br * 0.08, br * 0.9, rnd);
      k.fill();
      k.fillStyle = rgb(mix3(pal.mitte, pal.hell, 0.35 + 0.65 * licht));
      laubForm(k, bx - br * 0.24, by - br * 0.28, br * 0.52, rnd, 9);
      k.fill();
      // Einzelne Blätter am Rand zur Sonne, mit Licht an der Kante.
      if (licht > 0.35) {
        for (let j = 0; j < 6; j += 1) {
          const w = Math.PI * 1.25 + (rnd() - 0.5) * 1.9;
          const lx = bx + Math.cos(w) * br * (0.7 + rnd() * 0.2);
          const ly = by + Math.sin(w) * br * (0.7 + rnd() * 0.2);
          k.fillStyle = rgb(mix3(pal.hell, pal.kante, 0.25 + 0.4 * rnd()));
          blattKlein(k, lx, ly, w + (rnd() - 0.5) * 0.8, br * 0.34, br * 0.1);
        }
      }
    });
    k.globalAlpha = 1;
  }

  // Ein Ast als sich verjüngende Form, mit Licht oben. Breiten in Bildpunkten.
  function astForm(k, x0, y0, cx, cy, x1, y1, b0, b1, farbe, licht) {
    const n = 14;
    const l = [];
    const r = [];
    for (let i = 0; i <= n; i += 1) {
      const u = i / n;
      const x = (1 - u) * (1 - u) * x0 + 2 * (1 - u) * u * cx + u * u * x1;
      const y = (1 - u) * (1 - u) * y0 + 2 * (1 - u) * u * cy + u * u * y1;
      const dx = 2 * (1 - u) * (cx - x0) + 2 * u * (x1 - cx);
      const dy = 2 * (1 - u) * (cy - y0) + 2 * u * (y1 - cy);
      const len = Math.hypot(dx, dy) || 1;
      const b = lerp(b0, b1, u) / 2;
      l.push([x - (dy / len) * b, y + (dx / len) * b]);
      r.push([x + (dy / len) * b, y - (dx / len) * b]);
    }
    k.fillStyle = farbe;
    k.beginPath();
    [...l, ...r.reverse()].forEach(([x, y], i) => (i ? k.lineTo(x, y) : k.moveTo(x, y)));
    k.closePath();
    k.fill();
    if (licht) {
      k.strokeStyle = licht;
      k.lineWidth = Math.max(1, b1 * 0.5);
      k.beginPath();
      (y1 < y0 ? r : l).forEach(([x, y], i) => (i ? k.lineTo(x, y) : k.moveTo(x, y)));
      k.stroke();
    }
  }

  function maleKulisse(k, W, Hk, welt) {
    const rnd = wuerfel(1000 + welt * 77);
    const s = view.s * view.dpr;
    const mitte = W / 2;
    const feldB = RAND * s;
    // Wie weit draussen: hochkant liegt der Rand des Bildes knapp neben dem
    // Feld, quer weit davon.
    const aussen = Math.max(feldB * 1.15, W / 2);
    if (welt === 0) {
      // Der Garten: Apfelbäume links und rechts, ihr Stamm gleich hinter dem
      // Rand, Äste, die das Laub tragen, Äpfel; quer weiter draussen mehr
      // Bäume im Abenddunst. Dazwischen der Himmel und eine Lichterkette.
      const pal = laubFarben(0.5, 0);
      const fern = laubFarben(0.68, 0);
      for (let i = 0; i < 6; i += 1) {
        // Weiter draussen (quer sichtbar): Bäume im Dunst, mit Stamm.
        const seite = i % 2 ? 1 : -1;
        const x = mitte + seite * (feldB * 1.35 + rnd() * Math.max(feldB * 0.3, aussen - feldB * 1.2));
        const y = rnd() * Hk;
        const r = s * (13 + rnd() * 9);
        dreimal(Hk, (dy) => {
          astForm(k, x, y + dy + r * 2.2, x + seite * s * 2, y + dy + r, x, y + dy, s * 3.5, s * 1.8, rgba(mix3([76, 58, 62], [222, 172, 176], 0.65), 1), null);
          krone(k, x, y + dy, r, wuerfel(i * 31 + 9), fern, 0.85);
        });
      }
      [-1, 1].forEach((seite, j) => {
        const sx = mitte + seite * feldB * (0.97 + rnd() * 0.05);
        // Der Stamm, im Dunst, mit Licht auf der linken Seite.
        k.fillStyle = rgb(mix3([84, 62, 60], [222, 172, 176], 0.45));
        k.fillRect(sx - s * 2.2, 0, s * 4.4, Hk);
        k.fillStyle = "rgba(255, 210, 170, 0.3)";
        k.fillRect(sx - s * 2.2, 0, s * 0.9, Hk);
        // Kronen an Ästen vom Stamm herein.
        for (let i = 0; i < 3; i += 1) {
          const y = (i + 0.2 + rnd() * 0.6) * (Hk / 3);
          const kx = mitte + seite * feldB * (0.74 + rnd() * 0.14);
          const ky = y - s * (8 + rnd() * 10);
          const r = s * (14 + rnd() * 6);
          const saat = j * 100 + i * 13 + 5;
          dreimal(Hk, (dy) => {
            astForm(k, sx, y + dy + s * 18, lerp(sx, kx, 0.5), y + dy + s * 6, kx, ky + dy + r * 0.3, s * 2.8, s * 1.1, rgb(mix3([86, 64, 62], [222, 172, 176], 0.45)), null);
            krone(k, kx, ky + dy, r, wuerfel(saat), pal, 0.9);
            // Äpfel im Laub, mit Glanz.
            const ra = wuerfel(saat + 50);
            for (let q = 0; q < 5; q += 1) {
              const ax = kx + (ra() - 0.5) * r * 1.2;
              const ay = ky + dy + (ra() - 0.2) * r * 0.9;
              k.fillStyle = "rgb(214, 110, 104)";
              k.beginPath();
              k.arc(ax, ay, s * 1.1, 0, TAU);
              k.fill();
              k.fillStyle = "rgba(255, 220, 180, 0.6)";
              k.beginPath();
              k.arc(ax - s * 0.35, ay - s * 0.35, s * 0.32, 0, TAU);
              k.fill();
            }
          });
        }
      });
      // Bokeh: helle runde Flecken, wo die Sonne durchs Laub fällt.
      k.globalCompositeOperation = "lighter";
      for (let i = 0; i < 22; i += 1) {
        const seite = i % 2 ? 1 : -1;
        const x = mitte + seite * feldB * (0.5 + rnd() * 0.7);
        const y = rnd() * Hk;
        const r = s * (2 + rnd() * 4);
        dreimal(Hk, (dy) => {
          const h = k.createRadialGradient(x, y + dy, r * 0.7, x, y + dy, r);
          h.addColorStop(0, "rgba(255, 220, 150, 0.2)");
          h.addColorStop(1, "rgba(255, 220, 150, 0)");
          k.fillStyle = h;
          k.fillRect(x - r, y + dy - r, 2 * r, 2 * r);
        });
      }
      // Die Lichterkette im Bogen von Stamm zu Stamm.
      const yk = Hk * 0.4;
      const xa = mitte - feldB * 0.97;
      const xb = mitte + feldB * 0.97;
      const ketteY = (x) => yk + Math.sin(((x - xa) / (xb - xa)) * Math.PI) * s * 16;
      k.globalCompositeOperation = "source-over";
      k.strokeStyle = "rgba(50, 36, 44, 0.6)";
      k.lineWidth = Math.max(1, s * 0.25);
      k.beginPath();
      for (let x = xa; x <= xb; x += 4) k.lineTo(x, ketteY(x));
      k.stroke();
      k.globalCompositeOperation = "lighter";
      for (let x = xa + s * 6; x < xb - s * 3; x += s * 11) {
        const y = ketteY(x) + s * 1.6;
        const farbe = [[255, 220, 140], [255, 170, 120], [255, 236, 180]][Math.round(x / s) % 3];
        const h = k.createRadialGradient(x, y, 0, x, y, s * 6);
        h.addColorStop(0, rgba(farbe, 0.95));
        h.addColorStop(0.18, rgba(farbe, 0.5));
        h.addColorStop(1, rgba(farbe, 0));
        k.fillStyle = h;
        k.fillRect(x - s * 6, y - s * 6, s * 12, s * 12);
      }
      k.globalCompositeOperation = "source-over";
    } else if (welt === 1) {
      // Die Baumkrone: dicke Äste wachsen von den Stämmen herein und tragen
      // Laub, schräg fallen goldene Strahlen hindurch.
      const pal = laubFarben(0.48, 1);
      const fern = laubFarben(0.66, 1);
      for (let i = 0; i < 6; i += 1) {
        const seite = i % 2 ? 1 : -1;
        const x = mitte + seite * (feldB * 1.3 + rnd() * Math.max(feldB * 0.3, aussen - feldB * 1.1));
        const y = rnd() * Hk;
        const r = s * (12 + rnd() * 9);
        dreimal(Hk, (dy) => krone(k, x, y + dy, r, wuerfel(i * 23 + 1), fern, 0.85));
      }
      for (let i = 0; i < 6; i += 1) {
        const seite = i % 2 ? 1 : -1;
        const y = (i + 0.3 + rnd() * 0.4) * (Hk / 6);
        const x0 = mitte + seite * feldB * 1.05;
        const x1 = mitte + seite * feldB * (0.55 + rnd() * 0.15);
        const y1 = y - s * (16 + rnd() * 20);
        const saat = i * 17 + 3;
        const r1 = s * (11 + rnd() * 5);
        const r2 = s * (9 + rnd() * 4);
        const astFarbe = rgb(mix3([80, 66, 66], [222, 172, 176], 0.45));
        dreimal(Hk, (dy) => {
          astForm(k, x0, y + dy, lerp(x0, x1, 0.45), y + dy - s * 4, x1, y1 + dy, s * 4.2, s * 1.2, astFarbe, null);
          // Ein Seitenzweig und Laub an beiden Enden.
          const mx = lerp(x0, x1, 0.55);
          const my = lerp(y, y1, 0.5) + dy;
          astForm(k, mx, my, mx - seite * s * 6, my - s * 10, mx - seite * s * 3, my - s * 20, s * 1.8, s * 0.7, astFarbe, null);
          krone(k, mx - seite * s * 3, my - s * 22, r2, wuerfel(saat + 7), pal, 0.9);
          krone(k, x1, y1 + dy - r1 * 0.2, r1, wuerfel(saat), pal, 0.9);
        });
      }
      // Lichtstrahlen, schräg von links oben.
      k.globalCompositeOperation = "lighter";
      for (let i = 0; i < 5; i += 1) {
        const x = mitte + (rnd() - 0.6) * feldB * 1.6;
        const y = rnd() * Hk;
        const w = 0.5 + rnd() * 0.25;
        const l = Hk * 0.8;
        const b = s * (5 + rnd() * 9);
        dreimal(Hk, (dy) => {
          k.save();
          k.translate(x, y + dy);
          k.rotate(w);
          const gr = k.createLinearGradient(-l / 2, 0, l / 2, 0);
          gr.addColorStop(0, "rgba(255, 214, 140, 0)");
          gr.addColorStop(0.5, "rgba(255, 214, 140, 0.13)");
          gr.addColorStop(1, "rgba(255, 214, 140, 0)");
          k.fillStyle = gr;
          k.fillRect(-l / 2, -b / 2, l, b);
          k.restore();
        });
      }
      for (let i = 0; i < 22; i += 1) {
        const x = mitte + (rnd() - 0.5) * feldB * 2.2;
        const y = rnd() * Hk;
        const r = s * (1.5 + rnd() * 3);
        dreimal(Hk, (dy) => {
          const h = k.createRadialGradient(x, y + dy, r * 0.6, x, y + dy, r);
          h.addColorStop(0, "rgba(255, 226, 150, 0.22)");
          h.addColorStop(1, "rgba(255, 226, 150, 0)");
          k.fillStyle = h;
          k.fillRect(x - r, y + dy - r, 2 * r, 2 * r);
        });
      }
      k.globalCompositeOperation = "source-over";
    } else if (welt === 2) {
      // Über den Dächern: Die Gasse geht nach hinten weiter. Links und rechts
      // die Wände der ferneren Häuser – je weiter weg, desto näher zur Mitte,
      // die Fenster schmaler, blasser im Dunst –, je Stockwerk ein Sims,
      // Fenster mit Läden, Licht in einzelnen. Die linke Wand liegt im
      // Schatten, die rechte fängt das Abendlicht. In der Mitte bleibt es
      // offen: dort der Himmel und die Dachlandschaft (dachBild).
      const innen = feldB * GASSE_INNEN;
      const geschoss = s * 62;
      const dunst = [196, 150, 186];
      [-1, 1].forEach((seite) => {
        const putz = seite < 0 ? mix3([176, 128, 110], SCHATTEN, 0.35) : mix3([226, 170, 130], [255, 200, 150], 0.15);
        const xa = mitte + seite * innen;
        const xb = seite < 0 ? 0 : W;
        // Die ferne Wand, von hinten (innen) nach vorn (zum Rand) heller.
        const gr = k.createLinearGradient(xa, 0, mitte + seite * feldB * 1.1, 0);
        gr.addColorStop(0, rgb(mix3(putz, dunst, 0.5)));
        gr.addColorStop(1, rgb(putz));
        k.fillStyle = gr;
        k.fillRect(Math.min(xa, xb), 0, Math.abs(xb - xa), Hk);
        // Fensterreihen: je weiter hinten, desto schmaler und dichter.
        const tiefe = [0.1, 0.36, 0.56, 0.72];
        for (let gy = 0; gy < Hk; gy += geschoss) {
          // Der Sims über dem Stockwerk und sein Schatten.
          k.fillStyle = rgba(mix3(putz, [255, 236, 210], 0.4), 0.9);
          k.fillRect(Math.min(xa, xb), gy, Math.abs(xb - xa), s * 2.2);
          k.fillStyle = "rgba(50, 26, 50, 0.25)";
          k.fillRect(Math.min(xa, xb), gy + s * 2.2, Math.abs(xb - xa), s * 2.4);
          tiefe.forEach((t, j) => {
            const xm = mitte + seite * lerp(feldB * 1.15, innen, t);
            const fb = s * lerp(13, 3.5, t);
            const fh = s * lerp(26, 22, t);
            const fy = gy + s * 14;
            const an = hash01(j * 7.3 + gy * 0.013 + seite) < 0.32;
            const nebel = t * 0.55;
            // Läden, Rahmen, Glas, Fensterbank.
            k.fillStyle = rgba(mix3([62, 104, 82], dunst, nebel), 0.95);
            k.fillRect(xm - fb * 0.95, fy, fb * 1.9, fh);
            k.fillStyle = rgb(mix3(an ? [255, 200, 120] : [60, 52, 84], dunst, nebel * 0.7));
            k.fillRect(xm - fb * 0.5, fy + s * 1, fb, fh - s * 2);
            if (an) {
              k.fillStyle = "rgba(255, 236, 170, 0.5)";
              k.fillRect(xm - fb * 0.5, fy + s * 1, fb * 0.35, fh - s * 2);
            }
            k.fillStyle = rgba(mix3([240, 226, 206], dunst, nebel), 0.95);
            k.fillRect(xm - fb * 0.62, fy + fh - s * 0.5, fb * 1.24, s * 1.6);
            k.fillRect(xm - s * 0.25, fy + s * 1, s * 0.5, fh - s * 2);
          });
        }
        // Die Kante hinten, wo die Gasse um die Ecke geht: ein Schattenstreif.
        k.fillStyle = "rgba(40, 22, 50, 0.35)";
        k.fillRect(seite < 0 ? xa - s * 2 : xa, 0, s * 2, Hk);
        // Ganz aussen (quer sichtbar): Häuser von vorn, mit Fensterreihen.
        const aussenX = mitte + seite * feldB * 1.15;
        if ((seite < 0 && aussenX > 0) || (seite > 0 && aussenX < W)) {
          const x0 = seite < 0 ? 0 : aussenX;
          const x1 = seite < 0 ? aussenX : W;
          k.fillStyle = rgb(mix3([200, 154, 140], dunst, 0.3));
          k.fillRect(x0, 0, x1 - x0, Hk);
          for (let gy = 0; gy < Hk; gy += geschoss) {
            k.fillStyle = "rgba(250, 230, 210, 0.6)";
            k.fillRect(x0, gy, x1 - x0, s * 2);
            for (let fx = x0 + s * 10; fx < x1 - s * 10; fx += s * 26) {
              const an = hash01(fx * 0.31 + gy * 0.07) < 0.3;
              k.fillStyle = "rgba(70, 104, 84, 0.9)";
              k.fillRect(fx - s * 9, gy + s * 14, s * 18, s * 24);
              k.fillStyle = an ? "rgb(255, 204, 124)" : "rgb(78, 66, 96)";
              k.fillRect(fx - s * 5, gy + s * 15, s * 10, s * 22);
              k.fillStyle = "rgba(240, 226, 206, 0.9)";
              k.fillRect(fx - s * 6, gy + s * 37, s * 12, s * 1.4);
            }
          }
        }
      });
    } else if (welt === 4) {
      // (Der Abendhimmel hat keine Kulisse: Seine Schleier stehen im Himmel.)
      for (let i = 0; i < 18; i += 1) {
        const seite = i % 2 ? 1 : -1;
        const x = mitte + seite * feldB * (0.6 + rnd() * 1.4);
        const y = rnd() * Hk;
        const rx = s * (30 + rnd() * 40);
        const ry = s * (5 + rnd() * 7);
        const c = mix3([170, 120, 190], [255, 160, 170], rnd() * 0.6);
        dreimal(Hk, (dy) => {
          k.save();
          k.translate(x, y + dy);
          k.scale(rx / ry, 1);
          const h = k.createRadialGradient(0, ry * 0.3, 0, 0, 0, ry);
          h.addColorStop(0, rgba(c, 0.4));
          h.addColorStop(1, rgba(c, 0));
          k.fillStyle = h;
          k.beginPath();
          k.arc(0, 0, ry, 0, TAU);
          k.fill();
          k.restore();
        });
      }
    }
  }

  // Die Dachlandschaft hinter der Gasse: Giebel und Walmdächer aus Ziegeln,
  // Gauben mit Licht, Kamine mit Rauch und frei der Kirchturm mit Uhr,
  // Spitzhelm und Wetterhahn – alles im Abenddunst, oben vom Licht gesäumt.
  function maleDachlandschaft(k, W, H) {
    const rnd = wuerfel(3141);
    const s = view.s * view.dpr;
    const mitte = W / 2;
    const dunst = [206, 156, 186];
    const fuss = H;
    // Hinten der Turm, frei, etwas rechts der Mitte: über den hinteren
    // Dächern die Glockenstube mit Schallfenstern und Uhr, darauf der Helm.
    const tx = mitte + s * 12;
    const tb = s * 13;
    const spitze = H * 0.03;
    const turmOben = H * 0.2;
    const turmFarbe = mix3([170, 130, 130], dunst, 0.35);
    k.fillStyle = rgb(turmFarbe);
    k.fillRect(tx - tb / 2, turmOben, tb, H - turmOben);
    k.fillStyle = "rgba(255, 206, 150, 0.4)";
    k.fillRect(tx - tb / 2, turmOben, s * 2, H - turmOben);
    k.fillStyle = "rgba(60, 30, 60, 0.2)";
    k.fillRect(tx + tb / 2 - s * 2.5, turmOben, s * 2.5, H - turmOben);
    // Gesims unter dem Helm.
    k.fillStyle = rgb(mix3([230, 210, 190], dunst, 0.3));
    k.fillRect(tx - tb / 2 - s * 1, turmOben, tb + s * 2, s * 1.6);
    // Schallfenster.
    k.fillStyle = rgb(mix3([60, 46, 70], dunst, 0.25));
    [-1, 1].forEach((q) => {
      const fx = tx + q * tb * 0.22;
      const f0 = turmOben + H * 0.035;
      const f1 = turmOben + H * 0.09;
      k.beginPath();
      k.moveTo(fx - s * 1.7, f1);
      k.lineTo(fx - s * 1.7, f0 + s * 1.7);
      k.arc(fx, f0 + s * 1.7, s * 1.7, Math.PI, 0);
      k.lineTo(fx + s * 1.7, f1);
      k.closePath();
      k.fill();
    });
    // Die Uhr.
    const uy = turmOben + H * 0.14;
    k.fillStyle = "rgb(250, 238, 206)";
    k.beginPath();
    k.arc(tx, uy, s * 3.6, 0, TAU);
    k.fill();
    k.strokeStyle = "rgb(200, 160, 80)";
    k.lineWidth = Math.max(1, s * 0.5);
    k.stroke();
    k.strokeStyle = "rgb(70, 50, 60)";
    k.beginPath();
    k.moveTo(tx, uy);
    k.lineTo(tx, uy - s * 2.6);
    k.moveTo(tx, uy);
    k.lineTo(tx + s * 1.9, uy + s * 0.8);
    k.stroke();
    // Der Spitzhelm aus Kupfer, grün angelaufen, links im Licht.
    k.fillStyle = rgb(mix3([80, 136, 122], dunst, 0.25));
    k.beginPath();
    k.moveTo(tx - tb / 2 - s * 1.2, turmOben);
    k.lineTo(tx, spitze);
    k.lineTo(tx + tb / 2 + s * 1.2, turmOben);
    k.closePath();
    k.fill();
    k.fillStyle = "rgba(255, 214, 150, 0.45)";
    k.beginPath();
    k.moveTo(tx - tb / 2 - s * 1.2, turmOben);
    k.lineTo(tx, spitze);
    k.lineTo(tx - s * 0.8, turmOben);
    k.closePath();
    k.fill();
    // Stange und Wetterhahn.
    k.strokeStyle = "rgb(230, 180, 90)";
    k.lineWidth = Math.max(1, s * 0.5);
    k.beginPath();
    k.moveTo(tx, spitze);
    k.lineTo(tx, spitze - s * 7);
    k.stroke();
    k.fillStyle = "rgb(240, 192, 96)";
    k.beginPath();
    k.moveTo(tx - s * 3, spitze - s * 7.5);
    k.quadraticCurveTo(tx - s * 1, spitze - s * 11, tx + s * 1.2, spitze - s * 9.5);
    k.lineTo(tx + s * 3.2, spitze - s * 11.5);
    k.lineTo(tx + s * 2.2, spitze - s * 7);
    k.closePath();
    k.fill();
    // Drei Reihen Dächer: hinten blasser, vorn wärmer.
    [[0.5, 0.58, 18, 14], [0.66, 0.38, 22, 16], [0.82, 0.18, 26, 20]].forEach(([traufeAnteil, nebel, b0, bz]) => {
      let x = -s * 10;
      while (x < W + s * 10) {
        const b = s * (b0 + rnd() * bz);
        const traufe = H * traufeAnteil + (rnd() - 0.5) * s * 6;
        const firsth = s * (12 + rnd() * 12);
        const walm = rnd() < 0.4;
        const wand = rgb(mix3(mix3([214, 170, 140], [196, 150, 150], rnd()), dunst, nebel));
        const ziegel = mix3(mix3([164, 74, 58], [130, 70, 70], rnd()), dunst, nebel);
        // Die Wand bis unten.
        k.fillStyle = wand;
        k.fillRect(x, traufe, b, fuss - traufe);
        // Schatten an der rechten Hauskante.
        k.fillStyle = "rgba(60, 30, 60, 0.18)";
        k.fillRect(x + b - s * 2, traufe, s * 2, fuss - traufe);
        for (let fy = traufe + s * 7; fy < fuss; fy += s * 18) {
          for (let fx = x + s * 6; fx < x + b - s * 8; fx += s * 11) {
            k.fillStyle = hash01(fx * 0.2 + fy * 0.3) < 0.3 ? "rgb(255, 208, 130)" : rgb(mix3([80, 66, 96], dunst, nebel));
            k.fillRect(fx, fy, s * 4, s * 6);
          }
        }
        // Das Dach: Giebel oder Walm, mit Ziegelreihen und Lichtkante.
        k.fillStyle = rgb(ziegel);
        k.beginPath();
        k.moveTo(x, traufe);
        if (walm) {
          k.lineTo(x + b * 0.3, traufe - firsth);
          k.lineTo(x + b * 0.7, traufe - firsth);
        } else {
          k.lineTo(x + b / 2, traufe - firsth);
        }
        k.lineTo(x + b, traufe);
        k.closePath();
        k.fill();
        k.strokeStyle = rgba(mix3(ziegel, [60, 20, 30], 0.4), 0.5);
        k.lineWidth = Math.max(1, s * 0.35);
        for (let q = 1; q < 5; q += 1) {
          const yq = traufe - (firsth * q) / 5;
          const halb = (b / 2) * (1 - q / 5) + (walm ? b * 0.2 * (q / 5) : 0);
          k.beginPath();
          k.moveTo(x + b / 2 - halb, yq);
          k.lineTo(x + b / 2 + halb, yq);
          k.stroke();
        }
        k.strokeStyle = "rgba(255, 210, 160, 0.6)";
        k.lineWidth = Math.max(1, s * 0.6);
        k.beginPath();
        k.moveTo(x, traufe);
        k.lineTo(walm ? x + b * 0.3 : x + b / 2, traufe - firsth);
        k.stroke();
        // Eine Gaube mit Licht.
        if (rnd() < 0.45) {
          const gx = x + b * (0.35 + rnd() * 0.2);
          const gy = traufe - firsth * 0.45;
          k.fillStyle = wand;
          k.fillRect(gx - s * 3, gy - s * 4, s * 6, s * 6);
          k.fillStyle = "rgb(255, 208, 130)";
          k.fillRect(gx - s * 1.6, gy - s * 2.6, s * 3.2, s * 3.8);
          k.fillStyle = rgb(ziegel);
          k.beginPath();
          k.moveTo(gx - s * 4, gy - s * 4);
          k.lineTo(gx, gy - s * 7.5);
          k.lineTo(gx + s * 4, gy - s * 4);
          k.closePath();
          k.fill();
        }
        // Ein Kamin mit Rauch, der im Wind treibt.
        if (rnd() < 0.6) {
          const kx = x + b * (0.6 + rnd() * 0.2);
          const ky = traufe - firsth * (walm ? 0.9 : 0.55);
          k.fillStyle = rgb(mix3([140, 80, 70], dunst, nebel));
          k.fillRect(kx - s * 2.5, ky - s * 9, s * 5, s * 10);
          k.fillStyle = rgb(mix3([100, 70, 76], dunst, nebel));
          k.fillRect(kx - s * 3.1, ky - s * 10, s * 6.2, s * 1.4);
          for (let q = 0; q < 6; q += 1) {
            const r = s * (2.5 + q * 1.6);
            const rx = kx + q * s * 3.5;
            const ry = ky - s * 12 - q * s * 5.5;
            const h = k.createRadialGradient(rx, ry, 0, rx, ry, r);
            h.addColorStop(0, `rgba(236, 222, 236, ${0.42 - q * 0.05})`);
            h.addColorStop(1, "rgba(236, 222, 236, 0)");
            k.fillStyle = h;
            k.fillRect(rx - r, ry - r, 2 * r, 2 * r);
          }
        }
        x += b * (0.78 + rnd() * 0.2);
      }
    });
    // Unten geht es in den Dunst über.
    const d = k.createLinearGradient(0, H * 0.55, 0, H);
    d.addColorStop(0, "rgba(214, 160, 186, 0)");
    d.addColorStop(1, "rgba(214, 160, 186, 0.55)");
    k.fillStyle = d;
    k.fillRect(0, H * 0.55, W, H * 0.45);
  }

  // Kaminrauch für die Hindernisse: eine Fahne, die aufsteigt und weiter
  // wird – einmal gemalt (in Einheiten 18 × 60, Bildpunkte).
  function maleRauchfahne(k, w, h, s) {
    for (let q = 0; q < 9; q += 1) {
      const f = q / 8;
      const r = s * (2.6 + f * 6.5);
      const x = w * 0.35 + f * w * 0.3 + Math.sin(q * 1.3) * s * 1.2;
      const y = h - s * 3 - f * (h - s * 12);
      const g2 = k.createRadialGradient(x, y, 0, x, y, r);
      g2.addColorStop(0, `rgba(236, 226, 240, ${0.5 * (1 - f * 0.8)})`);
      g2.addColorStop(1, "rgba(236, 226, 240, 0)");
      k.fillStyle = g2;
      k.fillRect(x - r, y - r, 2 * r, 2 * r);
    }
  }

  // ---------------------------------------------------------------------------
  // Malen: die Ränder des Feldes – Hecke, Stämme, Hauswände, Gewitter
  // ---------------------------------------------------------------------------
  /*
   * Ein Streifen je Seite und Welt, RAND_PERIODE hoch, nahtlos nach oben.
   * Die innere Kante steht genau bei ±RAND: Dort zerplatzt die Blase. Quer
   * und auf dem Tablet sieht man sie breit; hochkant nur einen Saum.
   */
  const RAND_PERIODE = 320;
  const RAND_TIEF = 46;

  function maleRand(k, welt, seite, Wb, Hb) {
    const s = view.s * view.dpr;
    const rnd = wuerfel(500 + welt * 31 + (seite > 0 ? 7 : 0));
    // x: Einheiten von der Kante nach aussen (0 = Kante); in Bildpunkten im
    // Streifen von innen (seite: wo die Kante im Bild ist).
    const X = (u) => (seite < 0 ? Wb - u * s : u * s);
    const Y = (v) => Hb - v * s;
    const T = RAND_TIEF;
    const kachel = (malen) => { malen(0); malen(RAND_PERIODE); malen(-RAND_PERIODE); };
    if (welt === 0) {
      // Eine Hecke: dunkles Laub, nach innen eine klare Kante aus Zweigen
      // mit Dornen.
      const TH = 18;
      const grund = k.createLinearGradient(X(0), 0, X(TH), 0);
      grund.addColorStop(0, seite < 0 ? "rgb(70, 40, 50)" : "rgb(44, 66, 38)");
      grund.addColorStop(0.6, seite < 0 ? "rgba(70, 40, 50, 0.85)" : "rgba(44, 66, 38, 0.85)");
      grund.addColorStop(1, "rgba(40, 50, 40, 0)");
      k.fillStyle = grund;
      k.fillRect(Math.min(X(0), X(TH)), 0, TH * s, Hb);
      for (let i = 0; i < 110; i += 1) {
        const u = Math.pow(rnd(), 1.4) * (TH - 3) + 1.5;
        const v = rnd() * RAND_PERIODE;
        const w = rnd() * TAU;
        const l = 3.5 + rnd() * 3;
        const c = seite < 0 ? mix3([86, 50, 58], [130, 66, 70], rnd()) : mix3([56, 92, 46], [96, 124, 58], rnd());
        kachel((dv) => {
          k.fillStyle = rgba(mix3(c, LICHT, u < 6 ? 0.25 : 0), clamp(1.3 - u / TH, 0, 1));
          k.beginPath();
          k.ellipse(X(u), Y(v + dv), l * s * 0.5, l * s * 0.28, w, 0, TAU);
          k.fill();
        });
      }
      // Die Kante: ein Zweig mit Dornen, gerade hinauf.
      k.strokeStyle = "rgb(84, 60, 44)";
      k.lineWidth = s * 1.6;
      k.beginPath();
      k.moveTo(X(0.8), 0);
      k.lineTo(X(0.8), Hb);
      k.stroke();
      k.fillStyle = "rgb(120, 70, 60)";
      for (let v = 2; v < RAND_PERIODE; v += 7) {
        k.beginPath();
        k.moveTo(X(0.8), Y(v));
        k.lineTo(X(0), Y(v + 1.8));
        k.lineTo(X(0.8), Y(v + 2.4));
        k.closePath();
        k.fill();
      }
    } else if (welt === 1) {
      // Links der Stamm der Buche, glatt und grau; rechts die Tanne, rau und
      // rotbraun.
      const buche = seite < 0;
      const gr = k.createLinearGradient(X(0), 0, X(T * 0.8), 0);
      gr.addColorStop(0, buche ? "rgb(150, 138, 132)" : "rgb(126, 78, 60)");
      gr.addColorStop(0.18, buche ? "rgb(118, 108, 110)" : "rgb(98, 58, 48)");
      gr.addColorStop(1, buche ? "rgb(60, 54, 66)" : "rgb(48, 30, 34)");
      k.fillStyle = gr;
      k.fillRect(Math.min(X(0), X(T * 0.8)), 0, T * 0.8 * s, Hb);
      // Licht an der Kante.
      k.fillStyle = buche ? "rgba(255, 210, 160, 0.35)" : "rgba(255, 170, 120, 0.3)";
      k.fillRect(Math.min(X(0), X(1.4)), 0, 1.4 * s, Hb);
      for (let i = 0; i < 60; i += 1) {
        const u = 1 + rnd() * (T * 0.75);
        const v = rnd() * RAND_PERIODE;
        kachel((dv) => {
          if (buche) {
            k.strokeStyle = "rgba(70, 60, 70, 0.35)";
            k.lineWidth = s * 0.4;
            k.beginPath();
            k.moveTo(X(u), Y(v + dv));
            k.lineTo(X(u + 2 + rnd() * 3), Y(v + dv));
            k.stroke();
            if (rnd() < 0.2) {
              k.fillStyle = "rgba(110, 140, 70, 0.45)";
              k.beginPath();
              k.arc(X(u), Y(v + dv), s * (1.5 + rnd() * 2), 0, TAU);
              k.fill();
            }
          } else {
            k.fillStyle = "rgba(40, 22, 24, 0.5)";
            k.fillRect(Math.min(X(u), X(u + 3)), Y(v + dv), 3 * s, s * (4 + rnd() * 6));
          }
        });
      }
    } else if (welt === 2) {
      // Die Hauswand an der Gasse: warmer Verputz, je Stockwerk ein Sims mit
      // Schatten darunter, Fenster mit Läden und Bank, Licht in einzelnen,
      // ein Fallrohr; an der Kante dezente Ecksteine.
      const putz = seite < 0 ? [206, 160, 122] : [210, 156, 146];
      const gr = k.createLinearGradient(X(0), 0, X(T), 0);
      gr.addColorStop(0, rgb(mix3(putz, LICHT, 0.2)));
      gr.addColorStop(0.3, rgb(putz));
      gr.addColorStop(1, rgb(mix3(putz, SCHATTEN, 0.5)));
      k.fillStyle = gr;
      k.fillRect(Math.min(X(0), X(T)), 0, T * s, Hb);
      // Der Verputz: feine helle und dunkle Flecken.
      for (let i = 0; i < 260; i += 1) {
        k.fillStyle = i % 2 ? "rgba(255, 240, 220, 0.07)" : "rgba(90, 50, 70, 0.06)";
        const g2 = (1 + rnd() * 2.5) * s;
        k.fillRect(Math.min(X(0), X(T)) + rnd() * T * s, rnd() * Hb, g2, g2 * 0.7);
      }
      for (let v = 0; v < RAND_PERIODE; v += 160) {
        kachel((dv) => {
          // Der Sims: ein heller Streif, oben im Licht, darunter Schatten.
          const ys = Y(v + dv + 7);
          k.fillStyle = rgb(mix3(putz, [255, 238, 214], 0.45));
          k.fillRect(Math.min(X(0), X(T)), ys, T * s, 4 * s);
          k.fillStyle = "rgba(255, 230, 196, 0.7)";
          k.fillRect(Math.min(X(0), X(T)), ys, T * s, 0.8 * s);
          const sch = k.createLinearGradient(0, ys + 4 * s, 0, ys + 10 * s);
          sch.addColorStop(0, "rgba(60, 28, 50, 0.38)");
          sch.addColorStop(1, "rgba(60, 28, 50, 0)");
          k.fillStyle = sch;
          k.fillRect(Math.min(X(0), X(T)), ys + 4 * s, T * s, 6 * s);
          // Ein Fenster: Laibung, Läden, Glas (manchmal Licht), Kreuz, Bank.
          const u0 = 15;
          const u1 = 33;
          const v0 = v + dv + 46;
          const v1 = v + dv + 92;
          const an = hash01(v * 0.13 + seite * 3 + welt) < 0.5;
          const rx = (u) => Math.min(X(u), X(u + 0.001));
          k.fillStyle = "rgb(58, 96, 74)";
          k.fillRect(Math.min(X(u0 - 8), X(u1 + 8)), Y(v1), (u1 - u0 + 16) * s, (v1 - v0) * s);
          k.strokeStyle = "rgba(30, 50, 40, 0.6)";
          k.lineWidth = Math.max(1, s * 0.3);
          for (let q = v0 + 4; q < v1; q += 4) {
            [[u0 - 8, u0], [u1, u1 + 8]].forEach(([a, b]) => { k.beginPath(); k.moveTo(X(a), Y(q)); k.lineTo(X(b), Y(q)); k.stroke(); });
          }
          k.fillStyle = "rgb(120, 86, 80)";
          k.fillRect(Math.min(X(u0), X(u1)), Y(v1), (u1 - u0) * s, (v1 - v0) * s);
          k.fillStyle = an ? "rgb(255, 206, 128)" : "rgb(66, 60, 92)";
          k.fillRect(Math.min(X(u0 + 1.6), X(u1 - 1.6)), Y(v1 - 1.6), (u1 - u0 - 3.2) * s, (v1 - v0 - 3.2) * s);
          if (an) {
            const h = k.createRadialGradient(X((u0 + u1) / 2), Y((v0 + v1) / 2), 0, X((u0 + u1) / 2), Y((v0 + v1) / 2), 30 * s);
            h.addColorStop(0, "rgba(255, 220, 150, 0.35)");
            h.addColorStop(1, "rgba(255, 220, 150, 0)");
            k.fillStyle = h;
            k.fillRect(Math.min(X(u0 - 14), X(u1 + 14)), Y(v1 + 14), (u1 - u0 + 28) * s, (v1 - v0 + 28) * s);
          }
          k.fillStyle = "rgb(236, 224, 206)";
          k.fillRect(Math.min(X((u0 + u1) / 2 - 0.5), X((u0 + u1) / 2 + 0.5)), Y(v1 - 1.6), 1 * s, (v1 - v0 - 3.2) * s);
          k.fillRect(Math.min(X(u0 + 1.6), X(u1 - 1.6)), Y(v0 + (v1 - v0) * 0.62), (u1 - u0 - 3.2) * s, 1 * s);
          k.fillRect(Math.min(X(u0 - 2), X(u1 + 2)), Y(v0 + 0.5), (u1 - u0 + 4) * s, 2.4 * s);
          k.fillStyle = "rgba(60, 30, 50, 0.3)";
          k.fillRect(Math.min(X(u0 - 2), X(u1 + 2)), Y(v0 - 1.9), (u1 - u0 + 4) * s, 2 * s);
          void rx;
        });
      }
      // Ecksteine an der Kante, dezent: nur etwas heller, feine Fugen.
      for (let v = 0; v < RAND_PERIODE; v += 16) {
        const b = (v / 16) % 2 ? 6 : 9;
        kachel((dv) => {
          k.fillStyle = rgba(mix3(putz, [250, 236, 214], 0.35), 0.75);
          k.fillRect(Math.min(X(0), X(b)), Y(v + dv + 15.2), b * s, 15.2 * s);
          k.fillStyle = "rgba(90, 60, 70, 0.22)";
          k.fillRect(Math.min(X(0), X(b)), Y(v + dv + 16), b * s, 0.8 * s);
          k.fillRect(seite < 0 ? X(b) : X(b) - 0.6 * s, Y(v + dv + 16), 0.6 * s, 16 * s);
        });
      }
      // Ein Fallrohr dicht an der Ecke, mit Schellen.
      k.fillStyle = "rgb(140, 142, 150)";
      k.fillRect(Math.min(X(10.6), X(12.8)), 0, 2.2 * s, Hb);
      k.fillStyle = "rgba(255, 230, 200, 0.45)";
      k.fillRect(Math.min(X(10.6), X(11.2)), 0, 0.6 * s, Hb);
      for (let v = 30; v < RAND_PERIODE; v += 80) {
        kachel((dv) => {
          k.fillStyle = "rgb(100, 100, 110)";
          k.fillRect(Math.min(X(10), X(13.4)), Y(v + dv + 1), 3.4 * s, 1 * s);
        });
      }
    } else {
      // Gewittertürme: dunkle Wolkenballen, deren Rand genau an der Kante
      // steht, als eine Masse; darin weiche, hellere Wölbungen.
      const ballenR = [];
      for (let i = 0; i < 30; i += 1) {
        const r = 6 + rnd() * 12;
        const u = r + rnd() * (T - r) * (i < 12 ? 0.05 : 1);
        const v = (i / 30) * RAND_PERIODE + rnd() * 6;
        ballenR.push([u, v, r]);
      }
      kachel((dv) => {
        k.fillStyle = "rgb(70, 60, 104)";
        k.beginPath();
        ballenR.forEach(([u, v, r]) => { k.moveTo(X(u) + r * s, Y(v + dv)); k.arc(X(u), Y(v + dv), r * s, 0, TAU); });
        k.fill();
        ballenR.forEach(([u, v, r]) => {
          const x = X(u + r * 0.2 * (seite < 0 ? -1 : 1));
          const y = Y(v + dv + r * 0.3);
          const h = k.createRadialGradient(x, y, 0, x, y, r * s * 0.7);
          h.addColorStop(0, "rgba(140, 120, 170, 0.45)");
          h.addColorStop(1, "rgba(140, 120, 170, 0)");
          k.fillStyle = h;
          k.fillRect(x - r * s, y - r * s, 2 * r * s, 2 * r * s);
        });
      });
      // Der Regenschleier an der Kante.
      const gr = k.createLinearGradient(X(0), 0, X(5), 0);
      gr.addColorStop(0, "rgba(150, 160, 220, 0.85)");
      gr.addColorStop(1, "rgba(90, 80, 130, 0.0)");
      k.fillStyle = gr;
      k.fillRect(Math.min(X(0), X(5)), 0, 5 * s, Hb);
      k.strokeStyle = "rgba(215, 225, 255, 0.6)";
      k.lineWidth = Math.max(1, s * 0.22);
      for (let i = 0; i < 90; i += 1) {
        const u = rnd() * 7;
        const v = rnd() * RAND_PERIODE;
        kachel((dv) => {
          k.beginPath();
          k.moveTo(X(u), Y(v + dv));
          k.lineTo(X(u + 0.5), Y(v + dv - 7));
          k.stroke();
        });
      }
      // Ein Blitz flackert im Inneren (gemalt als heller Schein).
      k.globalCompositeOperation = "lighter";
      const bv = RAND_PERIODE * 0.4;
      const h = k.createRadialGradient(X(T * 0.6), Y(bv), 0, X(T * 0.6), Y(bv), 26 * s);
      h.addColorStop(0, "rgba(200, 190, 255, 0.35)");
      h.addColorStop(1, "rgba(200, 190, 255, 0)");
      k.fillStyle = h;
      k.fillRect(0, 0, Wb, Hb);
      k.globalCompositeOperation = "source-over";
    }
  }

  // ---------------------------------------------------------------------------
  // Malen: der Boden beim Start – Rasen, Tisch, Schale und Ring
  // ---------------------------------------------------------------------------
  const BODEN_UNTEN = -150;
  const BODEN_OBEN = 10;
  const RING = { x: 0, y: -15, r: 5.6 };

  function maleBoden(k, W) {
    const s = view.s * view.dpr;
    const X = (x) => W / 2 + x * s;
    const Y = (y) => (BODEN_OBEN - y) * s;
    const rnd = wuerfel(2024);
    // Der Rasen.
    const rasenY = -118;
    const gr = k.createLinearGradient(0, Y(rasenY + 6), 0, Y(BODEN_UNTEN));
    gr.addColorStop(0, "rgb(120, 150, 62)");
    gr.addColorStop(0.3, "rgb(78, 110, 50)");
    gr.addColorStop(1, "rgb(40, 62, 38)");
    k.fillStyle = gr;
    k.fillRect(0, Y(rasenY + 2), W, Y(BODEN_UNTEN) - Y(rasenY + 2));
    k.lineCap = "round";
    for (let i = 0; i < W / (s * 0.9); i += 1) {
      const x = rnd() * W;
      const h = (3 + rnd() * 6) * s;
      const y = Y(rasenY + 2) + rnd() * s * 6;
      k.strokeStyle = rgb(mix3([70, 110, 44], [190, 200, 90], rnd() * rnd()));
      k.lineWidth = s * 0.35;
      k.beginPath();
      k.moveTo(x, y);
      k.quadraticCurveTo(x + (rnd() - 0.5) * s * 3, y - h * 0.6, x + (rnd() - 0.3) * s * 3, y - h);
      k.stroke();
    }
    // Ein Blumenbeet: Lavendel und Ringelblumen.
    for (let i = 0; i < 40; i += 1) {
      const x = (rnd() - 0.5) * 2 * (W / 2 / s);
      if (Math.abs(x) < 40) continue;
      const lav = rnd() < 0.55;
      const h = 10 + rnd() * 16;
      k.strokeStyle = "rgb(80, 110, 60)";
      k.lineWidth = s * 0.4;
      k.beginPath();
      k.moveTo(X(x), Y(rasenY));
      k.lineTo(X(x + (rnd() - 0.5) * 3), Y(rasenY + h));
      k.stroke();
      if (lav) {
        k.fillStyle = rgb(mix3([140, 110, 200], [176, 140, 230], rnd()));
        for (let j = 0; j < 5; j += 1) { k.beginPath(); k.arc(X(x), Y(rasenY + h - j * 1.3), s * 0.9, 0, TAU); k.fill(); }
      } else {
        k.fillStyle = rgb(mix3([255, 150, 40], [255, 200, 60], rnd()));
        k.beginPath();
        k.arc(X(x), Y(rasenY + h), s * 2.2, 0, TAU);
        k.fill();
        k.fillStyle = "rgb(150, 70, 20)";
        k.beginPath();
        k.arc(X(x), Y(rasenY + h), s * 0.8, 0, TAU);
        k.fill();
      }
    }
    // Der Gartentisch aus Holz.
    const holz = (x0, y0, x1, y1, c) => {
      k.fillStyle = c;
      k.fillRect(X(x0), Y(y1), (x1 - x0) * s, (y1 - y0) * s);
    };
    holz(-30, -118, -26.5, -38, "rgb(108, 70, 50)");
    holz(26.5, -118, 30, -38, "rgb(90, 58, 46)");
    holz(-30, -110, 30, -107, "rgb(84, 54, 44)");
    holz(-38, -40, 38, -35, "rgb(150, 98, 62)");
    k.fillStyle = "rgba(255, 200, 140, 0.55)";
    k.fillRect(X(-38), Y(-35), 76 * s, 1 * s);
    for (let x = -36; x < 38; x += 9) {
      k.fillStyle = "rgba(70, 40, 30, 0.45)";
      k.fillRect(X(x), Y(-35), 0.4 * s, 5 * s);
    }
    // Schatten unter dem Tisch.
    k.fillStyle = "rgba(30, 30, 40, 0.3)";
    k.beginPath();
    k.ellipse(X(4), Y(-119), 40 * s, 3 * s, 0, 0, TAU);
    k.fill();
    // Die Schale mit Seifenwasser.
    k.fillStyle = "rgb(70, 120, 170)";
    k.beginPath();
    k.moveTo(X(-12), Y(-25));
    k.quadraticCurveTo(X(-11), Y(-35), X(0), Y(-35));
    k.quadraticCurveTo(X(11), Y(-35), X(12), Y(-25));
    k.closePath();
    k.fill();
    k.fillStyle = "rgba(255, 220, 170, 0.5)";
    k.beginPath();
    k.ellipse(X(-6), Y(-29), 2.2 * s, 3.6 * s, 0.5, 0, TAU);
    k.fill();
    k.fillStyle = "rgb(220, 236, 250)";
    k.beginPath();
    k.ellipse(X(0), Y(-25), 12 * s, 1.6 * s, 0, 0, TAU);
    k.fill();
    // Schaum, mit kleinen Bläschen.
    for (let i = 0; i < 14; i += 1) {
      const x = (rnd() - 0.5) * 20;
      const r = 0.6 + rnd() * 1.4;
      k.strokeStyle = "rgba(255, 255, 255, 0.85)";
      k.lineWidth = s * 0.2;
      k.beginPath();
      k.arc(X(x), Y(-24.4 + r * 0.6), r * s, 0, TAU);
      k.stroke();
    }
    // Der Stiel des Rings, schräg in die Schale.
    k.strokeStyle = "rgb(52, 138, 200)";
    k.lineWidth = s * 1.5;
    k.beginPath();
    k.moveTo(X(RING.x + 0.3), Y(RING.y - RING.r * 0.3));
    k.quadraticCurveTo(X(2.5), Y(-22), X(7.5), Y(-27.5));
    k.stroke();
  }

  // Der Ring (vor der Blase gemalt, damit sie aus ihm wächst).
  function zeichneRing() {
    const s = view.s;
    const x = bildX(RING.x);
    const y = bildY(RING.y);
    if (y > view.cssH + 40 || y < -40) return;
    g.lineWidth = s * 1.2;
    g.strokeStyle = "rgb(60, 150, 210)";
    g.beginPath();
    g.ellipse(x, y, RING.r * s, RING.r * s * 0.32, 0, 0, TAU);
    g.stroke();
    g.strokeStyle = "rgba(255, 230, 200, 0.6)";
    g.lineWidth = s * 0.4;
    g.beginPath();
    g.ellipse(x, y, RING.r * s, RING.r * s * 0.32, 0, Math.PI * 1.05, Math.PI * 1.6);
    g.stroke();
  }

  // ---------------------------------------------------------------------------
  // Malen: der Nebel
  // ---------------------------------------------------------------------------
  const NEBEL_HOCH = 58;
  const NEBEL_KANTE = 26;          // so weit unter dem oberen Rand des Bilds ist die Grenze

  function maleNebel(k, W, Hn) {
    const s = view.s * view.dpr;
    const kante = NEBEL_KANTE * s;
    const gr = k.createLinearGradient(0, 0, 0, Hn);
    gr.addColorStop(0, "rgba(236, 226, 246, 0)");
    gr.addColorStop((kante * 0.55) / Hn, "rgba(236, 226, 246, 0.18)");
    gr.addColorStop(kante / Hn, "rgba(240, 232, 250, 0.72)");
    gr.addColorStop((kante + 16 * s) / Hn, "rgba(226, 216, 240, 0.92)");
    gr.addColorStop(1, "rgba(206, 196, 228, 0.97)");
    k.fillStyle = gr;
    k.fillRect(0, 0, W, Hn);
    // Schwaden auf der Grenze.
    const rnd = wuerfel(77);
    for (let i = 0; i < 26; i += 1) {
      const x = rnd() * W;
      const r = s * (8 + rnd() * 16);
      const y = kante + (rnd() - 0.3) * s * 8;
      const h = k.createRadialGradient(x, y, 0, x, y, r);
      h.addColorStop(0, "rgba(255, 250, 255, 0.5)");
      h.addColorStop(1, "rgba(255, 250, 255, 0)");
      k.fillStyle = h;
      k.fillRect(x - r, y - r, 2 * r, 2 * r);
    }
    // Feine Tröpfchen, die glitzern.
    for (let i = 0; i < 160; i += 1) {
      k.fillStyle = `rgba(255, 255, 255, ${0.25 + rnd() * 0.5})`;
      const r = s * (0.25 + rnd() * 0.35);
      k.fillRect(rnd() * W, kante + rnd() * (Hn - kante), r, r);
    }
  }

  // ---------------------------------------------------------------------------
  // Malen: die Blase – vorgerechnet
  // ---------------------------------------------------------------------------
  /*
   * Der Seifenfilm: ein Bild, dreimal so breit wie die Blase, in den Farben
   * dünner Schichten – für jede Dicke die Farbe, die das Licht dort zeigt
   * (Rot, Grün und Blau löschen sich bei verschiedenen Dicken aus). Oben ist
   * der Film dünner (er läuft ab), dazu Wirbel. Je Bild wird er in die Blase
   * gedreht und verschoben, durch eine Maske, die zum Rand hin mehr spiegelt
   * – so wandern die Regenbogenfarben, ohne je neu gerechnet zu werden.
   */
  function filmBild(n) {
    const c = document.createElement("canvas");
    c.width = n;
    c.height = n;
    const k = c.getContext("2d");
    const bild = k.createImageData(n, n);
    const d = bild.data;
    const lam = [640, 532, 455];
    for (let j = 0; j < n; j += 1) {
      for (let i = 0; i < n; i += 1) {
        const u = (i / n) * 3 - 1.5;
        const v = (j / n) * 3 - 1.5;
        const wirbel = Math.sin(3.1 * u + 1.7 * Math.sin(2.3 * v + 0.4)) + Math.sin(2.6 * v + 1.4 * Math.sin(3.4 * u + 1.1)) * 0.8 + Math.sin(5.3 * (u + v) + 0.7) * 0.25;
        const dicke = 420 + 230 * v + 150 * wirbel;
        const o = (j * n + i) * 4;
        for (let q = 0; q < 3; q += 1) {
          const sn = Math.sin((TAU * 1.33 * Math.max(60, dicke)) / lam[q]);
          d[o + q] = 70 + 185 * sn * sn;
        }
        d[o + 3] = 255;
      }
    }
    k.putImageData(bild, 0, 0);
    return c;
  }

  // Die Maske: in der Mitte durchsichtig, zum Rand hin spiegelnd.
  function maskeBild(n, r) {
    const c = document.createElement("canvas");
    c.width = n;
    c.height = n;
    const k = c.getContext("2d");
    const v = k.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, r);
    v.addColorStop(0, "rgba(0, 0, 0, 0.05)");
    v.addColorStop(0.5, "rgba(0, 0, 0, 0.1)");
    v.addColorStop(0.75, "rgba(0, 0, 0, 0.26)");
    v.addColorStop(0.9, "rgba(0, 0, 0, 0.62)");
    v.addColorStop(0.97, "rgba(0, 0, 0, 0.9)");
    v.addColorStop(1, "rgba(0, 0, 0, 0.0)");
    k.fillStyle = v;
    k.beginPath();
    k.arc(n / 2, n / 2, r, 0, TAU);
    k.fill();
    return c;
  }

  // Der Glanz: ein heller Fleck, das gespiegelte Fensterkreuz, ein kleiner
  // Gegenschein unten rechts und der dünne Rand.
  function glanzBild(n, r) {
    const c = document.createElement("canvas");
    c.width = n;
    c.height = n;
    const k = c.getContext("2d");
    const m = n / 2;
    // Der Rand: innen eine zarte dunkle Linie (dort bricht das Licht),
    // aussen ein feiner heller Saum.
    k.strokeStyle = "rgba(50, 30, 70, 0.22)";
    k.lineWidth = Math.max(1, r * 0.05);
    k.beginPath();
    k.arc(m, m, r * 0.94, 0, TAU);
    k.stroke();
    k.strokeStyle = "rgba(255, 255, 255, 0.6)";
    k.lineWidth = Math.max(1, r * 0.03);
    k.beginPath();
    k.arc(m, m, r * 0.99, 0, TAU);
    k.stroke();
    // Der Abend spiegelt sich unten warm.
    k.strokeStyle = "rgba(255, 200, 140, 0.5)";
    k.lineWidth = Math.max(1, r * 0.08);
    k.beginPath();
    k.arc(m, m, r * 0.93, Math.PI * 0.15, Math.PI * 0.85);
    k.stroke();
    // Das Fenster: vier gewölbte Scheiben oben links.
    k.save();
    k.translate(m - r * 0.42, m - r * 0.44);
    k.rotate(-0.35);
    const fb = r * 0.21;
    const fh = r * 0.25;
    k.fillStyle = "rgba(255, 255, 255, 0.62)";
    for (let i = 0; i < 2; i += 1) {
      for (let j = 0; j < 2; j += 1) {
        const x0 = (i - 1) * fb * 1.08;
        const y0 = (j - 1) * fh * 1.08;
        k.beginPath();
        k.moveTo(x0 + fb * 0.1, y0);
        k.quadraticCurveTo(x0 + fb * 0.5, y0 - fh * 0.12, x0 + fb, y0 + fh * 0.05);
        k.lineTo(x0 + fb * 0.95, y0 + fh);
        k.quadraticCurveTo(x0 + fb * 0.5, y0 + fh * 1.06, x0, y0 + fh * 0.95);
        k.closePath();
        k.fill();
      }
    }
    k.restore();
    // Der Glanzpunkt, weich.
    const gl = k.createRadialGradient(m - r * 0.36, m - r * 0.5, 0, m - r * 0.36, m - r * 0.5, r * 0.32);
    gl.addColorStop(0, "rgba(255, 255, 255, 0.9)");
    gl.addColorStop(1, "rgba(255, 255, 255, 0)");
    k.fillStyle = gl;
    k.fillRect(0, 0, n, n);
    // Der Gegenschein unten rechts.
    const gg = k.createRadialGradient(m + r * 0.5, m + r * 0.52, 0, m + r * 0.5, m + r * 0.52, r * 0.18);
    gg.addColorStop(0, "rgba(255, 240, 220, 0.75)");
    gg.addColorStop(1, "rgba(255, 240, 220, 0)");
    k.fillStyle = gg;
    k.fillRect(0, 0, n, n);
    return c;
  }

  // ---------------------------------------------------------------------------
  // Die Ebenen neu malen (beim Laden und wenn sich die Grösse ändert)
  // ---------------------------------------------------------------------------
  function ebenenNeu() {
    const W = view.cssW;
    const H = view.cssH;
    const s = view.s;
    const dpr = view.dpr;
    ebenen = { scheine: {}, teile: new Map(), fetzen: new Map() };
    Object.entries(SCHEINE).forEach(([name, [farbe, kraft, r]]) => { ebenen.scheine[name] = scheinAus(farbe, kraft, r * 16); });
    // Der Himmel: ein hohes Bild.
    const zug = Math.ceil(HIMMEL_HOCH * s * PH);
    ebenen.himmel = leinwand(W, H + zug);
    maleHimmel(ebenen.himmel.getContext("2d"), ebenen.himmel.width, ebenen.himmel.height, H * dpr);
    // Die Ferne.
    ebenen.ferneH = Math.round(H * 0.56);
    // Ab dort (Bildpunkte im Bild der Ferne) deckt sie: unter den Hügeln.
    ebenen.ferneDicht = Math.round(H * 0.56 * 0.75 * 0.52 * dpr);
    ebenen.ferne = leinwand(W, ebenen.ferneH);
    maleFerne(ebenen.ferne.getContext("2d"), ebenen.ferne.width, ebenen.ferne.height);
    // Die Dachlandschaft hinter der Gasse.
    ebenen.dachH = Math.round(H * 0.55);
    // Ab dort (Bildpunkte) deckt sie: unter der Traufe der hinteren Reihe.
    ebenen.dachDicht = Math.round((H * 0.55 * 0.5 + 4 * s) * dpr);
    ebenen.dach = leinwand(W, ebenen.dachH);
    maleDachlandschaft(ebenen.dach.getContext("2d"), ebenen.dach.width, ebenen.dach.height);
    ebenen.gasseL = Math.max(0, Math.round((W / 2 - RAND * s * GASSE_INNEN) * dpr));
    ebenen.rauch = leinwand(18 * s, 60 * s);
    maleRauchfahne(ebenen.rauch.getContext("2d"), ebenen.rauch.width, ebenen.rauch.height, s * dpr);
    // Die Kulissen der vier Welten.
    ebenen.kulisseH = Math.round(H * 1.15);
    ebenen.kulisse = WELTEN.map((_, w) => {
      if (w === 3) return leinwand(1, 1);
      const c = leinwand(W, ebenen.kulisseH);
      maleKulisse(c.getContext("2d"), c.width, c.height, w);
      return c;
    });
    // Die Ränder: so breit, wie das Bild neben dem Feld zeigt.
    const breitRand = Math.max(4, W / 2 / s - RAND) + 2;
    ebenen.randB = Math.min(breitRand, RAND_TIEF + 4);
    ebenen.rand = WELTEN.map((_, w) => [-1, 1].map((seite) => {
      const c = leinwand(ebenen.randB * s, RAND_PERIODE * s);
      maleRand(c.getContext("2d"), w, seite, c.width, c.height);
      return c;
    }));
    // Der Boden beim Start.
    ebenen.boden = leinwand(W, (BODEN_OBEN - BODEN_UNTEN) * s);
    maleBoden(ebenen.boden.getContext("2d"), ebenen.boden.width);
    // Der Nebel.
    ebenen.nebel = leinwand(W, NEBEL_HOCH * s);
    maleNebel(ebenen.nebel.getContext("2d"), ebenen.nebel.width, ebenen.nebel.height);
    // Die Blase.
    const rb = R * s * dpr;
    const nb = Math.ceil(rb * 2 + 4);
    ebenen.blaseN = nb;
    ebenen.film = filmBild(Math.ceil(rb * 3.2));
    ebenen.maske = maskeBild(nb, rb);
    ebenen.glanz = glanzBild(nb, rb);
    // Ein Löwenzahnsamen: ein Schirmchen aus feinen Strahlen, ein Stiel.
    ebenen.samen = leinwand(s * 6, s * 6);
    {
      const k = ebenen.samen.getContext("2d");
      const m = ebenen.samen.width / 2;
      const r = s * 2.4 * dpr;
      k.strokeStyle = "rgba(255, 250, 235, 0.8)";
      k.lineWidth = Math.max(1, 0.6 * dpr);
      k.beginPath();
      for (let j = 0; j < 7; j += 1) {
        const a = -Math.PI / 2 + (j - 3) * 0.32;
        k.moveTo(m, m * 1.1);
        k.lineTo(m + Math.cos(a) * r, m * 1.1 + Math.sin(a) * r);
      }
      k.moveTo(m, m * 1.1);
      k.lineTo(m, m * 1.1 + s * 2 * dpr);
      k.stroke();
    }
    // Der Tacho: ein Messinstrument aus Messing, einmal gemalt.
    ebenen.tachoR = Math.round(clamp(Math.min(W, H) * 0.13, 44, 72));
    ebenen.tacho = tachoBild(ebenen.tachoR);
    ebenen.tachoNabe = tachoNabeBild(ebenen.tachoR);
    ebenen.tachoZahl = leinwand(ebenen.tachoR * 1.2, ebenen.tachoR * 0.5);
    ebenen.tachoSchild = leinwand(tachoMasse(ebenen.tachoR).b, tachoMasse(ebenen.tachoR).schildH);
    ebenen.tachoZahlText = "";
    ebenen.tachoSchildText = "";
    ebenen.blaseTmp = document.createElement("canvas");
    ebenen.blaseTmp.width = nb;
    ebenen.blaseTmp.height = nb;
  }

  // ---------------------------------------------------------------------------
  // Malen: die Teile – jedes einmal in ein eigenes Bild
  // ---------------------------------------------------------------------------
  // Eine Form als Pfad (in Einheiten, y nach oben – die Leinwand ist
  // entsprechend gestellt).
  function pfad(k, p) {
    k.beginPath();
    if (p.k === 0) k.arc(p.x, p.y, p.r, 0, TAU);
    else if (p.k === 2) {
      k.moveTo(p.pts[0][0], p.pts[0][1]);
      for (let i = 1; i < p.pts.length; i += 1) k.lineTo(p.pts[i][0], p.pts[i][1]);
      k.closePath();
    }
  }
  function strich(k, p, farbe, f = 1, dy = 0) {
    k.strokeStyle = farbe;
    k.lineWidth = p.r * 2 * f;
    k.beginPath();
    k.moveTo(p.x1, p.y1 + dy);
    k.lineTo(p.x2, p.y2 + dy);
    k.stroke();
  }
  const rollen = (o, ...namen) => o.prims.filter((p) => namen.includes(p.rolle));

  // Stäbe, die aneinander anschliessen (ein Stiel, ein Ast), als eine glatte,
  // sich verjüngende Form – mit Licht auf der Seite zur Sonne (links oben)
  // und Schatten gegenüber. Die Form ist genau die der Stäbe.
  function kette(k, stabs, farbe, licht, schatten) {
    const ketten = [];
    let akt = null;
    stabs.forEach((p) => {
      const ende = akt?.pts[akt.pts.length - 1];
      if (ende && Math.hypot(ende[0] - p.x1, ende[1] - p.y1) < 0.01) {
        akt.pts.push([p.x2, p.y2]);
        akt.r.push(p.r);
      } else {
        akt = { pts: [[p.x1, p.y1], [p.x2, p.y2]], r: [p.r] };
        ketten.push(akt);
      }
    });
    ketten.forEach(({ pts, r }) => {
      const n = pts.length;
      const rr = pts.map((_, i) => (i === 0 ? r[0] : i === n - 1 ? r[n - 2] : Math.max(r[i - 1], r[i])));
      const nor = pts.map((_, i) => {
        const a = pts[Math.max(0, i - 1)];
        const b = pts[Math.min(n - 1, i + 1)];
        const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
        return [-(b[1] - a[1]) / l, (b[0] - a[0]) / l];
      });
      const rand = (f, sg) => pts.map(([x, y], i) => [x + nor[i][0] * rr[i] * f * sg, y + nor[i][1] * rr[i] * f * sg]);
      const li = rand(1, 1);
      const re = rand(1, -1);
      k.fillStyle = farbe;
      k.beginPath();
      [...li, ...re.reverse()].forEach(([x, y], i) => (i ? k.lineTo(x, y) : k.moveTo(x, y)));
      k.closePath();
      k.fill();
      k.beginPath();
      k.arc(pts[0][0], pts[0][1], rr[0], 0, TAU);
      k.arc(pts[n - 1][0], pts[n - 1][1], rr[n - 1], 0, TAU);
      k.fill();
      // Welche Seite schaut zur Sonne?
      const sonne = nor[Math.floor(n / 2)][0] * -0.6 + nor[Math.floor(n / 2)][1] * 0.8 > 0 ? 1 : -1;
      [[licht, sonne], [schatten, -sonne]].forEach(([c, sg]) => {
        if (!c) return;
        const linie = rand(0.55, sg);
        k.strokeStyle = c;
        k.lineWidth = Math.max(0.15, rr[Math.floor(n / 2)] * 0.5);
        k.beginPath();
        linie.forEach(([x, y], i) => (i ? k.lineTo(x, y) : k.moveTo(x, y)));
        k.stroke();
      });
    });
  }

  // Die Licht- und Schattenkante einer Form: oben links warm.
  function lichtKante(k, p, farbe, b) {
    k.save();
    pfad(k, p);
    k.clip();
    k.translate(b * 0.7, -b * 0.7);
    k.strokeStyle = farbe;
    k.lineWidth = b * 2;
    pfad(k, p);
    k.stroke();
    k.restore();
  }

  function maleTeil(k, o) {
    k.lineCap = "round";
    k.lineJoin = "round";
    const art = o.art;
    if (art === "rose") {
      kette(k, rollen(o, "stiel"), "rgb(48, 78, 34)", "rgba(180, 206, 110, 0.55)", "rgba(20, 40, 20, 0.4)");
      rollen(o, "stielchen").forEach((p) => strich(k, p, "rgb(60, 92, 40)"));
      rollen(o, "fieder").forEach((p) => {
        pfad(k, p);
        k.fillStyle = "rgb(56, 96, 44)";
        k.fill();
        lichtKante(k, p, "rgba(196, 220, 120, 0.55)", 0.5);
        // Die Mittelrippe.
        const a = p.pts[0];
        const b = p.pts[Math.floor(p.pts.length / 2)];
        k.strokeStyle = "rgba(170, 200, 110, 0.6)";
        k.lineWidth = 0.22;
        k.beginPath();
        k.moveTo(a[0], a[1]);
        k.lineTo(b[0], b[1]);
        k.stroke();
      });
      rollen(o, "dorn").forEach((p) => {
        pfad(k, p);
        k.fillStyle = "rgb(128, 52, 46)";
        k.fill();
        k.fillStyle = "rgba(255, 190, 150, 0.6)";
        const t = p.pts[1];
        k.beginPath();
        k.arc(t[0], t[1], 0.35, 0, TAU);
        k.fill();
      });
      rollen(o, "knospe").forEach((p) => {
        pfad(k, p);
        k.fillStyle = "rgb(190, 40, 70)";
        k.fill();
        lichtKante(k, p, "rgba(255, 170, 150, 0.6)", 0.7);
        // Kelchblätter um die Knospe.
        k.fillStyle = "rgb(60, 100, 44)";
        const a = p.pts[0];
        k.beginPath();
        k.arc(a[0], a[1], 1.4, 0, TAU);
        k.fill();
      });
      rollen(o, "bluete").forEach((p) => {
        // Eine offene Rose: der Grund, aussen fünf weite Blütenblätter, innen
        // engere, in der Mitte die eingerollten; Licht von links oben.
        const farben = [[[120, 14, 40], [214, 44, 74], [255, 120, 130]], [[176, 58, 100], [240, 120, 160], [255, 196, 214]], [[200, 104, 30], [250, 176, 70], [255, 226, 150]]][o.deko?.farbe || 0];
        const [tief, mitte, hell] = farben;
        pfad(k, p);
        k.fillStyle = rgb(tief);
        k.fill();
        k.save();
        pfad(k, p);
        k.clip();
        const blatt = (w, d, rx, ry, c) => {
          const x = p.x + Math.cos(w) * d;
          const y = p.y + Math.sin(w) * d;
          const lichtK = clamp(0.5 + (Math.cos(w - 2.4) * 0.5), 0, 1);
          const v = k.createRadialGradient(x - Math.cos(w) * rx * 0.3, y - Math.sin(w) * rx * 0.3, rx * 0.1, x, y, rx);
          v.addColorStop(0, rgb(mix3(c, hell, 0.15 + 0.4 * lichtK)));
          v.addColorStop(1, rgb(mix3(c, tief, 0.35)));
          k.fillStyle = v;
          k.beginPath();
          k.ellipse(x, y, rx, ry, w, 0, TAU);
          k.fill();
          k.strokeStyle = rgba(tief, 0.55);
          k.lineWidth = 0.22;
          k.beginPath();
          k.ellipse(x, y, rx, ry, w, -1.2, 1.2);
          k.stroke();
        };
        for (let i = 0; i < 5; i += 1) blatt(i * 1.2566 + 0.3, p.r * 0.52, p.r * 0.56, p.r * 0.44, mitte);
        for (let i = 0; i < 5; i += 1) blatt(i * 1.2566 + 0.95, p.r * 0.3, p.r * 0.38, p.r * 0.3, mix3(mitte, tief, 0.2));
        // Die Mitte: eingerollt.
        k.strokeStyle = rgba(tief, 0.85);
        k.lineWidth = 0.32;
        k.beginPath();
        for (let w = 0; w < 9; w += 0.25) {
          const rr = p.r * 0.03 * w;
          const x = p.x + Math.cos(w * 1.3) * rr;
          const y = p.y + Math.sin(w * 1.3) * rr;
          if (w) k.lineTo(x, y); else k.moveTo(x, y);
        }
        k.stroke();
        k.restore();
        lichtKante(k, p, rgba(hell, 0.6), 0.7);
      });
    } else if (art === "nessel") {
      rollen(o, "stengel").forEach((p) => strich(k, p, "rgb(70, 96, 46)"));
      rollen(o, "nessel").forEach((p) => {
        pfad(k, p);
        const a = p.pts[0];
        const b = p.pts[Math.floor(p.pts.length / 2)];
        const v = k.createLinearGradient(a[0], a[1], b[0], b[1]);
        v.addColorStop(0, "rgb(52, 84, 40)");
        v.addColorStop(1, "rgb(84, 120, 52)");
        k.fillStyle = v;
        k.fill();
        lichtKante(k, p, "rgba(210, 230, 140, 0.5)", 0.45);
        // Adern und Brennhaare.
        k.strokeStyle = "rgba(160, 196, 110, 0.55)";
        k.lineWidth = 0.25;
        k.beginPath();
        k.moveTo(a[0], a[1]);
        k.lineTo(b[0], b[1]);
        const n = p.pts.length;
        for (let i = 2; i < n / 2 - 1; i += 2) {
          const m = [lerp(a[0], b[0], i / (n / 2)), lerp(a[1], b[1], i / (n / 2))];
          k.moveTo(m[0], m[1]);
          k.lineTo(lerp(m[0], p.pts[i + 1][0], 0.8), lerp(m[1], p.pts[i + 1][1], 0.8));
          k.moveTo(m[0], m[1]);
          k.lineTo(lerp(m[0], p.pts[n - i - 1][0], 0.8), lerp(m[1], p.pts[n - i - 1][1], 0.8));
        }
        k.stroke();
        k.strokeStyle = "rgba(240, 250, 220, 0.6)";
        k.lineWidth = 0.12;
        k.beginPath();
        for (let i = 1; i < n - 1; i += 1) {
          const q = p.pts[i];
          k.moveTo(lerp(q[0], b[0], 0.15), lerp(q[1], b[1], 0.15));
          k.lineTo(lerp(q[0], b[0], 0.02), lerp(q[1], b[1], 0.02));
        }
        k.stroke();
      });
    } else if (art === "schlauch") {
      kette(k, rollen(o, "schlauch"), "rgb(40, 116, 66)", "rgba(170, 236, 170, 0.7)", "rgba(16, 50, 30, 0.55)");
      rollen(o, "duese").forEach((p) => {
        pfad(k, p);
        const v = k.createLinearGradient(p.x0, 0, rechts(p), 0);
        v.addColorStop(0, "rgb(255, 210, 120)");
        v.addColorStop(0.5, "rgb(200, 150, 60)");
        v.addColorStop(1, "rgb(120, 80, 30)");
        k.fillStyle = v;
        k.fill();
      });
    } else if (art === "ast") {
      kette(k, rollen(o, "ast"), "rgb(92, 80, 80)", "rgba(230, 196, 160, 0.55)", "rgba(40, 30, 44, 0.45)");
      kette(k, rollen(o, "zweig"), "rgb(100, 82, 74)", "rgba(230, 190, 150, 0.45)", null);
      rollen(o, "blatt").forEach((p, i) => {
        pfad(k, p);
        const c = [[62, 110, 44], [86, 130, 46], [112, 142, 50]][i % 3];
        k.fillStyle = rgb(c);
        k.fill();
        lichtKante(k, p, "rgba(255, 220, 130, 0.55)", 0.55);
        const a = p.pts[0];
        const b = p.pts[Math.floor(p.pts.length / 2)];
        k.strokeStyle = "rgba(200, 220, 140, 0.55)";
        k.lineWidth = 0.2;
        k.beginPath();
        k.moveTo(a[0], a[1]);
        k.lineTo(b[0], b[1]);
        const n = p.pts.length;
        for (let j = 2; j < n / 2 - 1; j += 1) {
          const m = [lerp(a[0], b[0], j / (n / 2)), lerp(a[1], b[1], j / (n / 2))];
          k.moveTo(m[0], m[1]);
          k.lineTo(lerp(m[0], p.pts[j + 1][0], 0.75), lerp(m[1], p.pts[j + 1][1], 0.75));
          k.moveTo(m[0], m[1]);
          k.lineTo(lerp(m[0], p.pts[n - j - 1][0], 0.75), lerp(m[1], p.pts[n - j - 1][1], 0.75));
        }
        k.stroke();
      });
    } else if (art === "tanne") {
      // Die Nadeln: dicht an dicht vom Trieb bis an den Rand der Hülle, nach
      // vorn geneigt, in drei Grüntönen; die Spitzen jung und hell, oben
      // fängt sie das Abendlicht.
      const zweige = o.deko.zweige;
      rollen(o, "nadeln").forEach((p) => {
        pfad(k, p);
        k.fillStyle = "rgba(26, 52, 38, 0.9)";
        k.fill();
      });
      const gruen = ["rgb(34, 70, 46)", "rgb(46, 88, 54)", "rgb(58, 104, 60)"];
      zweige.forEach((z, zi) => {
        const L = laenge(z.pts);
        let q = 0;
        for (let d = 0.2; d < L; d += 0.42) {
          const e = entlang(z.pts, d);
          const rn = lerp(z.r0, z.r1, e.u);
          const jung = e.u > 0.7;
          [1, -1].forEach((sg) => {
            q += 1;
            const f = 0.78 + 0.2 * hash01(q * 1.7 + zi);
            const vorn = rn * (0.25 + 0.3 * hash01(q * 2.3 + zi));
            const tx = e.x + e.nx * sg * rn * f + e.tx * vorn;
            const ty = e.y + e.ny * sg * rn * f + e.ty * vorn;
            const obenAuf = e.ny * sg > 0.2;
            k.strokeStyle = jung ? (q % 2 ? "rgb(126, 176, 84)" : "rgb(104, 156, 70)") : obenAuf && q % 3 === 0 ? "rgb(120, 130, 70)" : gruen[q % 3];
            k.lineWidth = 0.3;
            k.beginPath();
            k.moveTo(e.x, e.y);
            k.lineTo(tx, ty);
            k.stroke();
          });
        }
        k.strokeStyle = "rgb(104, 66, 48)";
        k.lineWidth = zi === 0 ? 0.9 : 0.55;
        k.beginPath();
        z.pts.forEach(([x, y], i) => (i ? k.lineTo(x, y) : k.moveTo(x, y)));
        k.stroke();
      });
    } else if (art === "netz") {
      kette(k, rollen(o, "zweig"), "rgb(96, 78, 70)", "rgba(230, 190, 150, 0.5)", "rgba(40, 30, 40, 0.35)");
      const { rahmen, nabe } = o.deko.netz;
      // Speichen von der Nabe an den Rahmen, nach ihrer Richtung geordnet.
      const speichen = [];
      for (let i = 0; i < rahmen.length; i += 1) {
        const a = rahmen[i];
        const b = rahmen[(i + 1) % rahmen.length];
        const n = Math.max(2, Math.round(Math.hypot(b[0] - a[0], b[1] - a[1]) / 4.5));
        for (let j = 0; j < n; j += 1) speichen.push([lerp(a[0], b[0], j / n), lerp(a[1], b[1], j / n)]);
      }
      speichen.sort((p, q) => Math.atan2(p[1] - nabe[1], p[0] - nabe[0]) - Math.atan2(q[1] - nabe[1], q[0] - nabe[0]));
      // Der Rahmen: etwas kräftiger.
      k.strokeStyle = "rgba(255, 250, 240, 0.7)";
      k.lineWidth = 0.16;
      k.beginPath();
      rahmen.forEach(([x, y], i) => (i ? k.lineTo(x, y) : k.moveTo(x, y)));
      k.closePath();
      k.stroke();
      k.strokeStyle = "rgba(255, 250, 240, 0.5)";
      k.lineWidth = 0.1;
      k.beginPath();
      speichen.forEach(([x, y]) => { k.moveTo(nabe[0], nabe[1]); k.lineTo(x, y); });
      k.stroke();
      // Die Fangspirale: von Speiche zu Speiche, leicht zur Nabe hin
      // durchhängend.
      k.strokeStyle = "rgba(255, 246, 232, 0.55)";
      k.lineWidth = 0.09;
      k.beginPath();
      const ring = (r, i) => [lerp(nabe[0], speichen[i % speichen.length][0], r), lerp(nabe[1], speichen[i % speichen.length][1], r)];
      for (let r = 0.16; r < 0.95; r += 0.062) {
        const [x0, y0] = ring(r, 0);
        k.moveTo(x0, y0);
        for (let i = 1; i <= speichen.length; i += 1) {
          const a = ring(r, i - 1);
          const b = ring(r + 0.004, i);
          const mx = lerp(nabe[0], (a[0] + b[0]) / 2, 0.93);
          const my = lerp(nabe[1], (a[1] + b[1]) / 2, 0.93);
          k.quadraticCurveTo(mx, my, b[0], b[1]);
        }
      }
      k.stroke();
      // Tautropfen auf der Spirale, die das Abendlicht fangen.
      for (let i = 0; i < 44; i += 1) {
        const r = 0.2 + hash01(i * 3.3 + o.id) * 0.74;
        const [x, y] = ring(r, Math.floor(hash01(i * 7.1 + o.id) * speichen.length));
        k.fillStyle = i % 4 ? "rgba(255, 238, 205, 0.95)" : "rgba(200, 236, 255, 0.95)";
        k.beginPath();
        k.arc(x, y, 0.22 + hash01(i + o.id) * 0.22, 0, TAU);
        k.fill();
      }
      // Die Spinne in der Nabe: Hinterleib, Kopfbrust, acht Beine.
      k.strokeStyle = "rgb(46, 34, 36)";
      k.lineWidth = 0.2;
      k.beginPath();
      for (let i = 0; i < 4; i += 1) {
        [1, -1].forEach((sg) => {
          const w = (i - 1.5) * 0.45;
          k.moveTo(nabe[0], nabe[1] + 0.4);
          k.quadraticCurveTo(nabe[0] + sg * 1.4, nabe[1] + 0.9 + w * 1.6, nabe[0] + sg * 2.4, nabe[1] - 0.2 + w * 2.6);
        });
      }
      k.stroke();
      k.fillStyle = "rgb(56, 40, 40)";
      k.beginPath();
      k.ellipse(nabe[0], nabe[1] - 0.9, 0.95, 1.25, 0, 0, TAU);
      k.fill();
      k.fillStyle = "rgb(40, 30, 32)";
      k.beginPath();
      k.arc(nabe[0], nabe[1] + 0.55, 0.62, 0, TAU);
      k.fill();
      k.fillStyle = "rgba(255, 200, 150, 0.55)";
      k.beginPath();
      k.arc(nabe[0] - 0.35, nabe[1] - 0.5, 0.3, 0, TAU);
      k.fill();
    } else if (art === "balkon") {
      rollen(o, "konsole").forEach((p) => { pfad(k, p); k.fillStyle = "rgb(150, 136, 130)"; k.fill(); });
      rollen(o, "platte").forEach((p) => {
        pfad(k, p);
        k.fillStyle = "rgb(190, 180, 170)";
        k.fill();
        lichtKante(k, p, "rgba(255, 220, 180, 0.6)", 0.6);
      });
      rollen(o, "gelaender").forEach((p) => strich(k, p, "rgb(44, 40, 52)"));
      rollen(o, "gelaender").forEach((p) => strich(k, p, "rgba(255, 200, 150, 0.4)", 0.4, p.r * 0.3));
      rollen(o, "kasten").forEach((p) => {
        pfad(k, p);
        k.fillStyle = "rgb(176, 90, 60)";
        k.fill();
        lichtKante(k, p, "rgba(255, 190, 140, 0.6)", 0.6);
      });
      rollen(o, "laub").forEach((p) => { pfad(k, p); k.fillStyle = "rgb(60, 110, 50)"; k.fill(); lichtKante(k, p, "rgba(190, 230, 120, 0.5)", 0.5); });
      rollen(o, "blumen").forEach((p) => {
        pfad(k, p);
        k.fillStyle = o.deko.farbe < 0.5 ? "rgb(220, 40, 60)" : "rgb(240, 90, 150)";
        k.fill();
        k.fillStyle = "rgba(255, 220, 220, 0.6)";
        for (let i = 0; i < 4; i += 1) {
          k.beginPath();
          k.arc(p.x + Math.cos(i * 1.6) * p.r * 0.5, p.y + Math.sin(i * 1.6) * p.r * 0.5, p.r * 0.22, 0, TAU);
          k.fill();
        }
      });
    } else if (art === "dach") {
      rollen(o, "kamin").forEach((p, i) => {
        pfad(k, p);
        k.fillStyle = i ? "rgb(110, 90, 90)" : "rgb(156, 80, 62)";
        k.fill();
        if (!i) {
          // Backsteine.
          k.save();
          pfad(k, p);
          k.clip();
          k.strokeStyle = "rgba(80, 40, 40, 0.6)";
          k.lineWidth = 0.25;
          for (let y = p.y0; y < oben(p); y += 2.2) {
            k.beginPath();
            k.moveTo(p.x0, y);
            k.lineTo(rechts(p), y);
            k.stroke();
            for (let x = p.x0 + ((Math.round((y - p.y0) / 2.2) % 2) * 2.2); x < rechts(p); x += 4.4) {
              k.beginPath();
              k.moveTo(x, y);
              k.lineTo(x, y + 2.2);
              k.stroke();
            }
          }
          k.restore();
          lichtKante(k, p, "rgba(255, 180, 120, 0.5)", 0.8);
        }
      });
      rollen(o, "balken").forEach((p) => strich(k, p, "rgb(96, 62, 48)"));
      rollen(o, "balken").forEach((p) => strich(k, p, "rgba(255, 190, 140, 0.4)", 0.35, p.r * 0.35));
      rollen(o, "dach").forEach((p) => {
        // Ziegel in Reihen: oben die Kante im Licht, darunter Ziegel um
        // Ziegel, unten das Holz der Traufe.
        pfad(k, p);
        k.fillStyle = "rgb(140, 58, 46)";
        k.fill();
        k.save();
        pfad(k, p);
        k.clip();
        const [a, b, c, dd] = p.pts;
        const l = Math.hypot(b[0] - a[0], b[1] - a[1]);
        const ux = (b[0] - a[0]) / l;
        const uy = (b[1] - a[1]) / l;
        const tx = (dd[0] - a[0]);
        const ty = (dd[1] - a[1]);
        for (let q = 0; q < l; q += 3.4) {
          const x = a[0] + ux * q;
          const y = a[1] + uy * q;
          k.fillStyle = Math.floor(q / 3.4) % 3 === 1 ? "rgb(172, 74, 54)" : Math.floor(q / 3.4) % 3 === 2 ? "rgb(156, 66, 50)" : "rgb(184, 86, 60)";
          k.beginPath();
          k.moveTo(x, y);
          k.lineTo(x + ux * 3.0, y + uy * 3.0);
          k.quadraticCurveTo(x + ux * 3.3 + tx * 0.6, y + uy * 3.3 + ty * 0.6, x + ux * 1.6 + tx * 0.78, y + uy * 1.6 + ty * 0.78);
          k.quadraticCurveTo(x - ux * 0.2 + tx * 0.6, y - uy * 0.2 + ty * 0.6, x, y);
          k.fill();
          k.strokeStyle = "rgba(255, 200, 150, 0.45)";
          k.lineWidth = 0.3;
          k.beginPath();
          k.moveTo(x + ux * 0.4 + tx * 0.08, y + uy * 0.4 + ty * 0.08);
          k.lineTo(x + ux * 2.6 + tx * 0.08, y + uy * 2.6 + ty * 0.08);
          k.stroke();
        }
        // Die Traufe aus Holz.
        k.fillStyle = "rgb(96, 62, 50)";
        k.beginPath();
        k.moveTo(dd[0], dd[1]);
        k.lineTo(c[0], c[1]);
        k.lineTo(c[0] - tx * 0.22, c[1] - ty * 0.22);
        k.lineTo(dd[0] - tx * 0.22, dd[1] - ty * 0.22);
        k.closePath();
        k.fill();
        k.strokeStyle = "rgba(255, 210, 160, 0.75)";
        k.lineWidth = 0.55;
        k.beginPath();
        k.moveTo(a[0], a[1]);
        k.lineTo(b[0], b[1]);
        k.stroke();
        k.restore();
      });
      rollen(o, "rinne").forEach((p) => {
        // Die Rinne aus Zink: ein Rohr, oben offen und dunkel.
        const v = k.createLinearGradient(p.x - p.r, p.y + p.r, p.x + p.r, p.y - p.r);
        v.addColorStop(0, "rgb(236, 214, 190)");
        v.addColorStop(0.45, "rgb(160, 156, 164)");
        v.addColorStop(1, "rgb(86, 84, 104)");
        pfad(k, p);
        k.fillStyle = v;
        k.fill();
        k.fillStyle = "rgb(56, 52, 70)";
        k.beginPath();
        k.ellipse(p.x, p.y + p.r * 0.45, p.r * 0.78, p.r * 0.35, 0, 0, TAU);
        k.fill();
      });
    } else if (art === "antenne") {
      rollen(o, "mast").forEach((p) => strich(k, p, "rgb(110, 110, 120)"));
      rollen(o, "rohr").forEach((p) => (p.k === 1 ? strich(k, p, "rgb(170, 170, 180)") : (pfad(k, p), (k.fillStyle = "rgb(170, 170, 180)"), k.fill())));
      rollen(o, "element").forEach((p) => strich(k, p, "rgb(196, 196, 206)"));
      rollen(o, "element", "mast", "rohr").forEach((p) => { if (p.k === 1) strich(k, p, "rgba(255, 200, 150, 0.55)", 0.35, 0); });
    } else if (art === "wolke") {
      // Quellwolken: alle Ballen als eine Form – unten golden angestrahlt,
      // oben flieder –, darin weiche, hellere Wölbungen hinten wie vorn, und
      // nur auf dem äusseren Rand ein Lichtsaum. Gemalt wird genau die
      // Fläche der Kreise.
      const ballen = rollen(o, "wolke");
      const y0 = Math.min(...ballen.map((p) => p.y - p.r));
      const y1 = Math.max(...ballen.map((p) => p.y + p.r));
      const x0 = Math.min(...ballen.map((p) => p.x - p.r));
      const x1 = Math.max(...ballen.map((p) => p.x + p.r));
      k.save();
      k.beginPath();
      ballen.forEach((p) => { k.moveTo(p.x + p.r, p.y); k.arc(p.x, p.y, p.r, 0, TAU); });
      k.clip();
      const v = k.createLinearGradient(0, y0, 0, y1);
      v.addColorStop(0, "rgb(255, 188, 150)");
      v.addColorStop(0.35, "rgb(240, 168, 172)");
      v.addColorStop(0.75, "rgb(204, 146, 190)");
      v.addColorStop(1, "rgb(176, 136, 196)");
      k.fillStyle = v;
      k.fillRect(x0, y0, x1 - x0, y1 - y0);
      // Schatten zwischen den Wölbungen (unten rechts jedes Ballens).
      ballen.forEach((p) => {
        const h = k.createRadialGradient(p.x + p.r * 0.45, p.y - p.r * 0.5, 0, p.x + p.r * 0.45, p.y - p.r * 0.5, p.r * 0.9);
        h.addColorStop(0, "rgba(130, 90, 150, 0.3)");
        h.addColorStop(1, "rgba(130, 90, 150, 0)");
        k.fillStyle = h;
        k.fillRect(p.x - p.r * 0.5, p.y - p.r * 1.4, p.r * 2, p.r * 1.9);
      });
      // Weiche helle Wölbungen, oben links jedes Ballens, geschichtet.
      ballen.forEach((p, i) => {
        for (let j = 0; j < 3; j += 1) {
          const w = Math.PI * (0.55 + 0.25 * j) + hash01(i * 7 + j + (o.id || 0)) * 0.4;
          const rr = p.r * (0.45 - j * 0.08);
          const x = p.x + Math.cos(w) * p.r * 0.38;
          const y = p.y + Math.sin(w) * p.r * 0.38;
          const h = k.createRadialGradient(x, y, 0, x, y, rr);
          h.addColorStop(0, "rgba(255, 236, 226, 0.4)");
          h.addColorStop(0.6, "rgba(255, 226, 220, 0.16)");
          h.addColorStop(1, "rgba(255, 226, 220, 0)");
          k.fillStyle = h;
          k.fillRect(x - rr, y - rr, 2 * rr, 2 * rr);
        }
      });
      // Der Lichtsaum: nur wo der Rand eines Ballens aussen liegt.
      k.lineCap = "round";
      ballen.forEach((p) => {
        for (let w = 0; w < TAU; w += 0.16) {
          const mx = p.x + Math.cos(w + 0.08) * (p.r - 0.2);
          const my = p.y + Math.sin(w + 0.08) * (p.r - 0.2);
          if (ballen.some((q) => q !== p && Math.hypot(mx - q.x, my - q.y) < q.r - 0.1)) continue;
          // Licht kommt von unten links: dort am stärksten.
          const licht = clamp(0.3 - Math.cos(w) * 0.45 - Math.sin(w) * 0.45, 0, 1);
          if (licht < 0.05) continue;
          k.strokeStyle = `rgba(255, 220, 186, ${0.4 * licht * licht})`;
          k.lineWidth = 1.6;
          k.beginPath();
          k.arc(p.x, p.y, p.r - 0.45, w, w + 0.17);
          k.stroke();
        }
      });
      k.restore();
    }
  }

  // Das Bild eines Teils, einmal gemalt (in Bildpunkten, mit einem Rand).
  function teilBild(o) {
    let b = ebenen.teile.get(o.id);
    if (b) return b;
    const s = view.s * view.dpr;
    const rand = 2;
    const w = Math.ceil((o.box.x1 - o.box.x0 + 2 * rand) * s);
    const h = Math.ceil((o.box.y1 - o.box.y0 + 2 * rand) * s);
    const c = document.createElement("canvas");
    c.width = Math.max(2, w);
    c.height = Math.max(2, h);
    const k = c.getContext("2d");
    k.setTransform(s, 0, 0, -s, (-o.box.x0 + rand) * s, (o.box.y1 + rand) * s);
    maleTeil(k, o);
    b = { c, x0: o.box.x0 - rand, y1: o.box.y1 + rand };
    ebenen.teile.set(o.id, b);
    return b;
  }

  // ---------------------------------------------------------------------------
  // Zeichnen: die Welt, je Bild aufgelegt
  // ---------------------------------------------------------------------------
  // Eine Kachel quer übers Bild legen, so oft, wie sie in die Höhe passt.
  // rahmen: so weit links und rechts deckt ohnehin der Rand (Bildpunkte).
  function legeKachel(bild, versatz, alpha = 1, rahmen = 0) {
    const h = bild.height;
    const b = bild.width - 2 * rahmen;
    let y = (((Math.round(versatz) % h) + h) % h) - h;
    g.globalAlpha = alpha;
    for (; y < canvas.height; y += h) {
      if (rahmen) g.drawImage(bild, rahmen, 0, b, h, rahmen, y, b, h);
      else g.drawImage(bild, 0, y);
    }
    g.globalAlpha = 1;
  }

  function zeichneWelt() {
    const dpr = view.dpr;
    const s = view.s;
    g.setTransform(1, 0, 0, 1, 0, 0);
    const cam = Math.max(0, state.camY) * s * dpr;
    // Der Himmel: ein Fenster aus dem hohen Bild.
    const H = canvas.height;
    const hh = ebenen.himmel.height;
    const yH = clamp(Math.round(hh - H - cam * PH - Math.min(0, state.camY) * s * dpr * PH), 0, hh - H);
    const yMitte = state.camY + (view.cssH / s) * 0.5;
    const wm = weltMix(yMitte);
    const vK = cam * 0.42;
    // Über den Dächern decken die Wände der Gasse die Seiten: Himmel und
    // Dachlandschaft nur in der Mitte, die Wände nur an den Seiten – so wird
    // jeder Bildpunkt einmal gelegt.
    const gasse = wm.a === 2 && wm.b === 2 && ebenen.gasseL > 0;
    // Stämme und Hauswände am Rand decken; reichen sie bis an den Rand des
    // Bildes, wird dahinter nichts gelegt.
    const wand = Math.round((view.cssW / 2 - RAND * s) * dpr);
    const draussen = Math.round((view.cssW / 2 - (RAND + ebenen.randB) * s) * dpr);
    const rahmen = wm.a >= 1 && wm.b <= 2 && draussen <= 0 ? Math.max(0, wand) : 0;
    const xL = gasse ? ebenen.gasseL : rahmen;
    const bM = canvas.width - 2 * xL;
    // Die Ferne deckt unten alles: Bis dorthin genügt der Himmel.
    const yF = Math.round(H - ebenen.ferne.height + cam * 0.16);
    const yD = Math.round(H - ebenen.dach.height * 0.92 + (state.camY - (WELT_AB[2] - 300)) * s * dpr * PD);
    // Unter der Ferne und (in der Gasse) unter der Dachlandschaft deckt es.
    const hH = clamp(Math.min(yF + ebenen.ferneDicht, gasse ? yD + ebenen.dachDicht : H), 1, H);
    g.drawImage(ebenen.himmel, xL, yH, bM, hH, xL, 0, bM, hH);
    if (wm.a === 2 || wm.b === 2) {
      const a = wm.a === 2 ? 1 - wm.k : wm.k;
      if (yD < H) {
        g.globalAlpha = a;
        g.drawImage(ebenen.dach, xL, 0, bM, ebenen.dach.height, xL, yD, bM, ebenen.dach.height);
        g.globalAlpha = 1;
      }
    }
    if (gasse) {
      // Die Wände an der Gasse decken, was hinter ihnen liegt: Die Kulisse
      // kommt nur dazwischen (und quer noch draussen neben ihnen).
      const bild = ebenen.kulisse[2];
      const h = bild.height;
      const W = canvas.width;
      const stuecke = [[Math.max(0, wand), xL]];
      if (draussen > 0) stuecke.push([0, draussen + 2]);
      let y = (((Math.round(vK) % h) + h) % h) - h;
      for (; y < H; y += h) {
        stuecke.forEach(([a, b]) => {
          if (b <= a) return;
          g.drawImage(bild, a, 0, b - a, h, a, y, b - a, h);
          g.drawImage(bild, W - b, 0, b - a, h, W - b, y, b - a, h);
        });
      }
      return;
    }
    // Die Ferne sinkt hinab, bis sie weg ist.
    if (yF < H) g.drawImage(ebenen.ferne, 0, yF);
    // Die Kulisse der Welt; zwischen zwei Welten beide. Im Abendhimmel gibt
    // es keine (seine Schleier stehen schon im Himmel).
    if (wm.k < 1 && wm.a < 3) legeKachel(ebenen.kulisse[wm.a], vK, 1, rahmen);
    if (wm.k > 0 && wm.b < 3) legeKachel(ebenen.kulisse[wm.b], vK, wm.k, rahmen);
  }

  // Die Ränder des Feldes, nach der Welt in ihrer Höhe.
  function zeichneRaender() {
    const dpr = view.dpr;
    const s = view.s;
    const sp = s * dpr;
    const breit = ebenen.randB;
    const yMitte = state.camY + (view.cssH / s) * 0.5;
    const wm = weltMix(yMitte);
    const xl = Math.round((view.cssW / 2 - (RAND + breit) * s) * dpr);
    const xr = Math.round((view.cssW / 2 + RAND * s) * dpr);
    const per = ebenen.rand[0][0].height;
    const versatz = Math.round(state.camY * sp);
    g.setTransform(1, 0, 0, 1, 0, 0);
    [[wm.a, 1 - wm.k], [wm.b, wm.k]].forEach(([w, a]) => {
      if (a <= 0.01) return;
      const [li, re] = ebenen.rand[w];
      g.globalAlpha = a;
      let y = (((versatz % per) + per) % per) - per;
      for (; y < canvas.height; y += per) {
        g.drawImage(li, xl, y);
        g.drawImage(re, xr, y);
      }
    });
    g.globalAlpha = 1;
    // Quer: draussen neben dem Feld etwas dunkler – dort spielt nichts.
    if (xl > 0) {
      g.fillStyle = "rgba(20, 12, 34, 0.16)";
      g.fillRect(0, 0, xl, canvas.height);
      g.fillRect(xr + Math.round(breit * sp), 0, canvas.width - xr - Math.round(breit * sp), canvas.height);
    }
  }

  function zeichneBoden() {
    const top = bildY(BODEN_OBEN);
    if (top > view.cssH) return;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.drawImage(ebenen.boden, 0, Math.round(top * view.dpr));
  }

  // Die Teile im Bild, aus ihren Bildern.
  function zeichneTeile() {
    const s = view.s;
    const dpr = view.dpr;
    const unten = state.camY - 4;
    const ganzOben = state.camY + view.cssH / s + 4;
    const L = state.hindernisse;
    g.setTransform(1, 0, 0, 1, 0, 0);
    for (let i = abIndex(L, unten - state.langMax, yVonTeil); i < L.length; i += 1) {
      const o = L[i];
      if (o.box.y0 > ganzOben) break;
      if (o.box.y1 < unten) continue;
      const b = teilBild(o);
      g.drawImage(b.c, Math.round(bildX(b.x0) * dpr), Math.round(bildY(b.y1) * dpr));
    }
  }

  // Rauch aus den Kaminen: harmlos, weich, er treibt mit dem Wind.
  function zeichneRauch() {
    const s = view.s;
    const unten = state.camY - 40;
    const ganzOben = state.camY + view.cssH / s + 40;
    g.setTransform(1, 0, 0, 1, 0, 0);
    const bild = ebenen.rauch;
    state.hindernisse.forEach((o) => {
      if (!o.rauch || o.rauch.y < unten || o.rauch.y > ganzOben) return;
      // Zwei Fahnen, die versetzt aufsteigen und vergehen.
      for (let i = 0; i < 2; i += 1) {
        const f = (state.zeit * 0.4 + i * 0.5) % 1;
        const x = bildX(o.rauch.x + windBei(o.rauch.y, state.t) * 0.15 * f) - bild.width / view.dpr * 0.35;
        const y = bildY(o.rauch.y + f * 14) - bild.height / view.dpr;
        g.globalAlpha = Math.sin(f * Math.PI) * 0.9;
        g.drawImage(bild, Math.round(x * view.dpr), Math.round(y * view.dpr));
      }
    });
    g.globalAlpha = 1;
  }

  // Was sich bewegt: Tropfen, Wespen, Vögel, Fetzen.
  function zeichneBeweger() {
    const s = view.s;
    const unten = state.camY - 20;
    const ganzOben = state.camY + view.cssH / s + 20;
    const t = state.t;
    g.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
    state.beweger.forEach((m) => {
      if (m.y1 < unten || m.y0 > ganzOben) return;
      if (m.art === "tropfen") {
        tropfenBei(m, t, (x, y, r, schwell) => {
          const sx = bildX(x);
          const sy = bildY(y);
          const fade = schwell ? 1 : clamp((FALL - (m.y - y)) / 80, 0, 1);
          g.globalAlpha = fade;
          g.fillStyle = "rgba(170, 210, 255, 0.55)";
          g.beginPath();
          g.arc(sx, sy, r * s, 0, TAU);
          g.fill();
          g.strokeStyle = "rgba(255, 255, 255, 0.85)";
          g.lineWidth = Math.max(0.6, r * s * 0.18);
          g.beginPath();
          g.arc(sx, sy, r * s * 0.92, Math.PI * 0.15, Math.PI * 0.95);
          g.stroke();
          g.fillStyle = "rgba(255, 255, 255, 0.95)";
          g.beginPath();
          g.arc(sx - r * s * 0.35, sy - r * s * 0.35, r * s * 0.28, 0, TAU);
          g.fill();
          g.globalAlpha = 1;
          return false;
        });
        return;
      }
      const o = bewegerOrt(m, t);
      if (m.art === "fetzen") { zeichneFetzen(m, o); return; }
      g.save();
      g.translate(bildX(o.x), bildY(o.y));
      g.scale(s * o.dir, -s);
      zeichneTier(m, bewegerForm(m, o));
      g.restore();
    });
  }

  function zeichneTier(m, form) {
    g.lineCap = "round";
    g.lineJoin = "round";
    const fl = form.filter((p) => p.rolle === "fluegel");
    if (m.art === "wespe") {
      fl.forEach((p) => { pfad(g, p); g.fillStyle = "rgba(230, 240, 255, 0.55)"; g.fill(); g.strokeStyle = "rgba(255, 255, 255, 0.7)"; g.lineWidth = 0.15; g.stroke(); });
      form.forEach((p) => {
        if (p.rolle === "fluegel") return;
        pfad(g, p);
        g.fillStyle = p.rolle === "brust" ? "rgb(70, 50, 30)" : p.rolle === "kopf" ? "rgb(240, 190, 40)" : "rgb(250, 200, 30)";
        g.fill();
        if (p.rolle === "leib") {
          g.save();
          pfad(g, p);
          g.clip();
          g.fillStyle = "rgb(30, 24, 20)";
          for (let x = p.x - p.r; x < p.x + p.r; x += 1.3) g.fillRect(x, p.y - p.r, 0.6, 2 * p.r);
          g.restore();
        }
      });
      g.strokeStyle = "rgb(30, 24, 20)";
      g.lineWidth = 0.2;
      g.beginPath();
      g.moveTo(4.2, 1.2);
      g.lineTo(5.6, 2.8);
      g.stroke();
      return;
    }
    // Schwalbe und Mauersegler: dunkel, die Schwalbe mit hellem Bauch und
    // roter Kehle.
    const dunkel = m.art === "schwalbe" ? "rgb(30, 34, 70)" : "rgb(48, 40, 46)";
    form.forEach((p) => {
      if (p.k === 1) strich(g, p, dunkel);
      else { pfad(g, p); g.fillStyle = dunkel; g.fill(); }
    });
    if (m.art === "schwalbe") {
      g.fillStyle = "rgb(236, 230, 220)";
      g.beginPath();
      g.ellipse(0.2, -0.6, 3, 0.9, 0, 0, TAU);
      g.fill();
      g.fillStyle = "rgb(190, 80, 50)";
      g.beginPath();
      g.arc(4.6, 0.1, 0.8, 0, TAU);
      g.fill();
    }
    g.fillStyle = "rgba(255, 190, 140, 0.45)";
    fl.forEach((p) => { g.beginPath(); g.moveTo(p.pts[0][0], p.pts[0][1]); g.lineTo(p.pts[2][0], p.pts[2][1]); g.lineTo(p.pts[1][0], p.pts[1][1]); g.closePath(); g.fill(); });
  }

  function zeichneFetzen(m, o) {
    let b = ebenen.fetzen.get(m);
    const s = view.s * view.dpr;
    if (!b) {
      const c = document.createElement("canvas");
      c.width = Math.ceil(40 * s);
      c.height = Math.ceil(30 * s);
      const k = c.getContext("2d");
      k.setTransform(s, 0, 0, -s, 20 * s, 15 * s);
      maleTeil(k, { art: "wolke", prims: m.puffs.map((p) => kreis(p[0], p[1], p[2], "wolke")) });
      b = c;
      ebenen.fetzen.set(m, b);
    }
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.drawImage(b, Math.round((bildX(o.x) - 20 * view.s) * view.dpr), Math.round((bildY(o.y) - 15 * view.s) * view.dpr));
    g.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
  }

  // Der Aufwind: eine Säule warmer, flimmernder Luft – ein Lichtband,
  // Hitzelinien, die aufwärts wabern, und Funken, die steigen.
  function zeichneAufwinde() {
    const s = view.s;
    const unten = state.camY - 40;
    const ganzOben = state.camY + view.cssH / s + 40;
    g.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
    state.aufwinde.forEach((a) => {
      if (a.y1 + 30 < unten || a.y0 - 30 > ganzOben) return;
      const x0 = bildX(a.x - a.b - 4);
      const x1 = bildX(a.x + a.b + 4);
      const y0 = bildY(a.y1 + 30);
      const y1 = bildY(a.y0 - 30);
      const v = g.createLinearGradient(x0, 0, x1, 0);
      v.addColorStop(0, "rgba(255, 170, 90, 0)");
      v.addColorStop(0.25, "rgba(255, 180, 100, 0.2)");
      v.addColorStop(0.5, "rgba(255, 214, 150, 0.3)");
      v.addColorStop(0.75, "rgba(255, 180, 100, 0.2)");
      v.addColorStop(1, "rgba(255, 170, 90, 0)");
      g.fillStyle = v;
      g.fillRect(x0, y0, x1 - x0, y1 - y0);
      // Die Ränder der Säule: zwei warme Lichtsäume.
      g.fillStyle = "rgba(255, 220, 160, 0.4)";
      [a.x - a.b, a.x + a.b].forEach((x) => g.fillRect(bildX(x) - 1, bildY(a.y1 + 10), 2, bildY(a.y0 - 10) - bildY(a.y1 + 10)));
      if (ruhig()) return;
      // Hitzelinien: senkrecht, wabernd, sie ziehen nach oben.
      g.lineWidth = Math.max(1.2, s * 0.5);
      for (let i = 0; i < 5; i += 1) {
        const lx = a.x + (i - 2) * (a.b * 0.42);
        g.strokeStyle = `rgba(255, 246, 220, ${0.4 + 0.12 * (i % 2)})`;
        g.beginPath();
        const ya = Math.max(a.y0 - 20, unten);
        const yb = Math.min(a.y1 + 20, ganzOben);
        for (let y = ya; y <= yb; y += 4) {
          const x = lx + Math.sin(y * 0.11 - state.zeit * 7 + i * 1.7) * 1.8;
          if (y === ya) g.moveTo(bildX(x), bildY(y)); else g.lineTo(bildX(x), bildY(y));
        }
        g.stroke();
      }
      for (let i = 0; i < 60; i += 1) {
        const f = (state.zeit * (0.35 + hash01(i) * 0.3) + hash01(i * 3.7)) % 1;
        const y = a.y0 - 20 + f * (a.y1 - a.y0 + 40);
        if (y < unten || y > ganzOben) continue;
        const x = a.x + (hash01(i * 5.1) - 0.5) * a.b * 1.7 + Math.sin(state.zeit * 3 + i) * 2;
        schein("gold", bildX(x), bildY(y), 3.6 * s, 0.95 * Math.sin(f * Math.PI));
        g.fillStyle = `rgba(255, 250, 220, ${0.9 * Math.sin(f * Math.PI)})`;
        g.fillRect(bildX(x) - 1, bildY(y) - 1, 2, 2);
      }
    });
  }

  // Die Böe: Windstreifen und Blätter, die quer durchs Band jagen.
  function zeichneBoeen() {
    const s = view.s;
    const unten = state.camY - 20;
    const ganzOben = state.camY + view.cssH / s + 20;
    g.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
    state.boeen.forEach((b) => {
      if (b.y1 + 40 < unten || b.y0 - 40 > ganzOben || ruhig()) return;
      const breit = view.cssW / s + 80;
      const sg = Math.sign(b.w);
      g.lineCap = "round";
      for (let i = 0; i < 36; i += 1) {
        const y = b.y0 - 20 + hash01(i * 2.3) * (b.y1 - b.y0 + 40);
        if (y < unten || y > ganzOben) continue;
        const l = 22 + hash01(i * 7.1) * 30;
        const f = (state.zeit * (Math.abs(b.w) / 55) * (0.8 + hash01(i) * 0.5) + hash01(i * 1.7)) % 1;
        const x = -breit / 2 + (sg > 0 ? f : 1 - f) * breit;
        const kante = glatt((y - b.y0 + 30) / 60) * glatt((b.y1 + 30 - y) / 60);
        g.strokeStyle = `rgba(255, 255, 255, ${0.5 * kante})`;
        g.lineWidth = Math.max(1.2, s * 0.45);
        g.beginPath();
        g.moveTo(bildX(x), bildY(y));
        g.quadraticCurveTo(bildX(x - sg * l * 0.5), bildY(y + 1.5 + Math.sin(i) * 1.5), bildX(x - sg * l), bildY(y + Math.sin(i * 3) * 2.5));
        g.stroke();
      }
      // Blätter und Blütenblätter, die der Wind mitreisst.
      for (let i = 0; i < 16; i += 1) {
        const y = b.y0 + hash01(i * 4.7) * (b.y1 - b.y0) + Math.sin(state.zeit * 3 + i) * 6;
        if (y < unten || y > ganzOben) continue;
        const f = (state.zeit * (Math.abs(b.w) / 70) * (0.7 + hash01(i * 2.9) * 0.6) + hash01(i * 5.3)) % 1;
        const x = -breit / 2 + (sg > 0 ? f : 1 - f) * breit;
        g.save();
        g.translate(bildX(x), bildY(y));
        g.rotate(state.zeit * 6 * sg + i);
        g.scale(1, 0.35 + Math.abs(Math.sin(state.zeit * 5 + i)) * 0.6);
        g.fillStyle = ["rgba(240, 120, 150, 0.9)", "rgba(150, 190, 80, 0.9)", "rgba(230, 180, 70, 0.9)"][i % 3];
        g.beginPath();
        g.ellipse(0, 0, s * 1.8, s * 0.9, 0, 0, TAU);
        g.fill();
        g.restore();
      }
    });
  }

  // Pollen, Samen, Blätter: Sie zeigen den Wind.
  function pollenNeu() {
    state.pollen = Array.from({ length: 44 }, (_, i) => ({ x: (hash01(i * 3.1) - 0.5) * 300, y: hash01(i * 7.3) * 300 - 60, p: hash01(i * 1.9) * TAU, art: i % 4 }));
  }

  function pollenTakt(dt) {
    const s = view.s;
    const breit = view.cssW / s / 2 + 12;
    const unten = state.camY - 10;
    const hoch = view.cssH / s + 20;
    state.pollen.forEach((p) => {
      p.x += (windBei(p.y, state.t) * 0.95 + Math.sin(state.zeit * 0.9 + p.p) * 4) * dt;
      p.y += (3 + Math.sin(state.zeit * 0.7 + p.p * 2) * 4) * dt;
      if (p.y < unten) p.y += hoch;
      if (p.y > unten + hoch) p.y -= hoch;
      if (p.x < -breit) p.x += 2 * breit;
      if (p.x > breit) p.x -= 2 * breit;
    });
  }

  function zeichnePollen() {
    const s = view.s;
    g.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
    const w = weltBei(state.camY + view.cssH / s / 2);
    state.pollen.forEach((p, i) => {
      const x = bildX(p.x);
      const y = bildY(p.y);
      if (p.art === 0 && w <= 1) {
        // Ein Löwenzahnsamen (einmal gemalt).
        const b = ebenen.samen;
        g.drawImage(b, Math.round((x - b.width / 2 / view.dpr) * view.dpr) / view.dpr, Math.round((y - b.height * 0.55 / view.dpr) * view.dpr) / view.dpr, b.width / view.dpr, b.height / view.dpr);
      } else if (p.art === 1 && w === 1) {
        // Ein Blatt, das sich dreht.
        g.save();
        g.translate(x, y);
        g.rotate(state.zeit * 2 + p.p);
        g.scale(1, Math.abs(Math.sin(state.zeit * 1.7 + p.p)) + 0.2);
        g.fillStyle = i % 3 ? "rgba(190, 170, 60, 0.85)" : "rgba(120, 150, 60, 0.85)";
        g.beginPath();
        g.ellipse(0, 0, s * 1.6, s * 0.8, 0, 0, TAU);
        g.fill();
        g.restore();
      } else {
        schein(w >= 3 ? "kalt" : "warm", x, y, s * 1.2, 0.7);
      }
    });
  }

  // Glühwürmchen im Garten.
  function zeichneGluehwuermchen() {
    if (state.camY > 700 || ruhig()) return;
    const s = view.s;
    g.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
    for (let i = 0; i < 14; i += 1) {
      const x = (hash01(i * 4.3) - 0.5) * 110 + Math.sin(state.zeit * 0.5 + i) * 10;
      const y = -100 + hash01(i * 2.7) * 520 + Math.sin(state.zeit * 0.7 + i * 2) * 8;
      const an = 0.5 + 0.5 * Math.sin(state.zeit * 2.4 + i * 1.3);
      schein("gruen", bildX(x), bildY(y), s * 3.2, an * 0.8);
    }
  }

  function zeichneNebel() {
    const y = nebelY(state.t) + NEBEL_KANTE;
    const top = bildY(y);
    if (top > view.cssH) return;
    g.setTransform(1, 0, 0, 1, 0, 0);
    const py = Math.round(top * view.dpr);
    g.drawImage(ebenen.nebel, 0, py);
    if (py + ebenen.nebel.height < canvas.height) {
      g.fillStyle = "rgba(206, 196, 228, 0.97)";
      g.fillRect(0, py + ebenen.nebel.height, canvas.width, canvas.height - py - ebenen.nebel.height);
    }
    // Schwaden, die über der Grenze wallen (klein, damit sie wenig kosten).
    g.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
    if (ruhig()) return;
    const s = view.s;
    const yg = bildY(nebelY(state.t));
    if (yg > view.cssH + 10 * s) return;
    for (let i = 0; i < 9; i += 1) {
      const x = ((hash01(i * 3.1) + state.zeit * 0.025 * (i % 2 ? 1 : -1) + 1) % 1) * view.cssW;
      schein("nebel", x, yg + Math.sin(state.zeit + i) * 3 * s, s * (6 + 3 * hash01(i)), 0.55);
    }
  }

  // Die Höhenmarken am rechten Rand, alle fünf Meter.
  function zeichneMarken() {
    const s = view.s;
    g.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
    const von = Math.ceil(state.camY / 500) * 500;
    const bis = state.camY + view.cssH / s;
    g.font = "700 11px system-ui, sans-serif";
    g.textAlign = "right";
    g.textBaseline = "bottom";
    for (let y = Math.max(500, von); y < bis; y += 500) {
      const sy = bildY(y);
      if (sy < view.frei + 10) continue;
      const x1 = bildX(RAND) - 3;
      g.strokeStyle = "rgba(255, 255, 255, 0.28)";
      g.lineWidth = 1;
      g.setLineDash([3, 5]);
      g.beginPath();
      g.moveTo(x1 - 26, sy);
      g.lineTo(x1, sy);
      g.stroke();
      g.setLineDash([]);
      g.fillStyle = "rgba(255, 255, 255, 0.6)";
      g.fillText(`${y / METER} m`, x1, sy - 2);
    }
  }

  // ---------------------------------------------------------------------------
  // Zeichnen: die Blase, ihre Luftstösse, ihr Platzen
  // ---------------------------------------------------------------------------
  function blaseMalen(x, y, gross = 1, alpha = 1, geist = null) {
    const s = view.s;
    const dpr = view.dpr;
    const b = state.blase;
    const n = ebenen.blaseN;
    const tmp = ebenen.blaseTmp;
    // Wie sie wabert: nach einem Stoss in seiner Richtung gestaucht, dann
    // schwingend; dazu ein leises Atmen.
    const still = ruhig();
    const a = geist || still ? 0 : b.wa * Math.exp(-b.wt / 0.45) * Math.cos(TAU * 3.2 * b.wt);
    const atem = still ? 0 : 0.014 * Math.sin(state.zeit * 5.3);
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (geist) {
      g.globalAlpha = alpha;
      g.strokeStyle = geist;
      g.lineWidth = 1.5;
      g.beginPath();
      g.arc(x, y, R * s * gross, 0, TAU);
      g.stroke();
      g.globalAlpha = alpha * 0.25;
      g.fillStyle = geist;
      g.fill();
      g.globalAlpha = 1;
      return;
    }
    // Der Film, gedreht und verschoben, durch die Maske.
    const k = tmp.getContext("2d");
    k.setTransform(1, 0, 0, 1, 0, 0);
    k.globalCompositeOperation = "source-over";
    k.clearRect(0, 0, n, n);
    const f = ebenen.film;
    k.translate(n / 2, n / 2);
    k.rotate(state.zeit * 0.45 + b.x * 0.01);
    k.translate(Math.sin(state.zeit * 0.31) * n * 0.12, Math.cos(state.zeit * 0.23) * n * 0.1);
    k.drawImage(f, -f.width / 2, -f.height / 2);
    k.setTransform(1, 0, 0, 1, 0, 0);
    k.globalCompositeOperation = "destination-in";
    k.drawImage(ebenen.maske, 0, 0);
    k.globalCompositeOperation = "source-over";
    g.save();
    g.translate(x, y);
    g.rotate(b.ww);
    g.scale((1 + a + atem) * gross, (1 - a * 0.9 - atem) * gross);
    g.rotate(-b.ww);
    g.globalAlpha = alpha * 0.92;
    g.drawImage(tmp, -n / 2 / dpr, -n / 2 / dpr, n / dpr, n / dpr);
    g.globalAlpha = alpha;
    g.drawImage(ebenen.glanz, -n / 2 / dpr, -n / 2 / dpr, n / dpr, n / dpr);
    g.restore();
    g.globalAlpha = 1;
  }

  function zeichneBlase() {
    const b = state.blase;
    if (state.schritt === "geplatzt") {
      // Im ersten Augenblick reisst die Haut auf und weitet sich – dann ist
      // sie fort.
      const z = state.geplatzt?.zeit ?? 1;
      if (z < 0.09 && !ruhig()) blaseMalen(bildX(state.geplatzt.x), bildY(state.geplatzt.y), 1 + z * 4, 1 - z / 0.09);
      return;
    }
    let x = bildX(b.x);
    let y = bildY(b.y);
    let gross = 1;
    if (state.intro) {
      // Sie wächst aus dem Ring und löst sich.
      const t = state.intro.t;
      const k = glatt(t / 1.3);
      gross = 0.15 + 0.85 * k;
      const hoch = RING.y + R * gross * 0.9 + glatt((t - 1.3) / 1.1) * (0 - RING.y - R * 0.9);
      y = bildY(hoch);
    } else if (state.phase === "bereit") {
      y += Math.sin(state.zeit * 1.6) * 1.2 * view.s;
      x += Math.sin(state.zeit * 1.1) * 0.6 * view.s;
    }
    blaseMalen(x, y, gross);
  }

  // Die Luftstösse: ein Wirbel am Finger, Linien zur Blase.
  function zeichneStoesse() {
    const s = view.s;
    g.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
    g.lineCap = "round";
    state.stossBilder.forEach((st) => {
      const k = clamp(st.zeit / 0.38, 0, 1);
      const fx = bildX(st.fx);
      const fy = bildY(st.fy);
      const bx = bildX(st.bx);
      const by = bildY(st.by);
      const dx = bx - fx;
      const dy = by - fy;
      const l = Math.hypot(dx, dy) || 1;
      const ux = dx / l;
      const uy = dy / l;
      // Der Ring am Finger.
      g.strokeStyle = `rgba(255, 255, 255, ${0.7 * (1 - k)})`;
      g.lineWidth = 1.6;
      g.beginPath();
      g.arc(fx, fy, (2 + k * 9) * s, 0, TAU);
      g.stroke();
      schein("weiss", fx, fy, 6 * s, 0.4 * (1 - k));
      // Luftlinien, die vom Finger zur Blase ziehen.
      const kraft = clamp(st.kraft / J0, 0.15, 1);
      for (let i = -2; i <= 2; i += 1) {
        const off = i * 2.2 * s;
        const kopf = clamp(k * 1.25 - Math.abs(i) * 0.06, 0, 1);
        const schwanz = clamp(kopf - 0.35, 0, 1);
        const krumm = i * 0.12;
        const p = (f) => [fx + dx * f - uy * off * (1 + f * 0.6) + uy * Math.sin(f * Math.PI) * krumm * l * 0.2, fy + dy * f + ux * off * (1 + f * 0.6) - ux * Math.sin(f * Math.PI) * krumm * l * 0.2];
        const [x0, y0] = p(schwanz);
        const [x1, y1] = p(kopf * 0.92);
        g.strokeStyle = `rgba(255, 255, 255, ${0.6 * kraft * (1 - k * 0.8)})`;
        g.lineWidth = 1.2;
        g.beginPath();
        g.moveTo(x0, y0);
        g.lineTo(x1, y1);
        g.stroke();
      }
    });
  }

  // Was beim Platzen aufstiebt: Tröpfchen, Fetzen des Films.
  function zeichneTeilchen() {
    if (!state.teile.length) return;
    const s = view.s;
    g.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
    state.teile.forEach((t) => {
      const k = clamp(t.leben / t.max, 0, 1);
      const x = bildX(t.x);
      const y = bildY(t.y);
      if (t.art === "troepfchen") {
        g.globalAlpha = k;
        g.fillStyle = t.farbe;
        const r = 0.5 + 0.9 * k;
        g.beginPath();
        g.arc(x, y, r, 0, TAU);
        g.fill();
      } else if (t.art === "ring") {
        g.globalAlpha = k * t.kraft;
        g.strokeStyle = "rgba(255, 255, 255, 0.9)";
        g.lineWidth = 1.2 * k + 0.3;
        g.beginPath();
        g.arc(x, y, t.r * s, 0, TAU);
        g.stroke();
      } else if (t.art === "blitz") {
        schein("weiss", x, y, t.r * s, k * 0.9);
      } else if (t.art === "fetzen") {
        g.globalAlpha = k * 0.8;
        g.strokeStyle = t.farbe;
        g.lineWidth = 1;
        g.beginPath();
        g.arc(x, y, 1.6 * s, t.w, t.w + 1.4);
        g.stroke();
      }
      g.globalAlpha = 1;
    });
  }

  // Die Gegner als Blasen aus Licht (geist.js).
  function zeichneGeister() {
    if (!gegner || state.phase === "bereit") return;
    const orte = window.LernappGeist?.orte?.(gegner) || [];
    if (!orte.length) return;
    const namen = [];
    orte.forEach((o) => {
      if (o.ziel) return;
      const x = o.a / 4;
      const y = o.b / 2;
      const sx = bildX(x);
      const sy = bildY(y);
      if (sx > -40 && sx < view.cssW + 40 && sy > -40 && sy < view.cssH + 40) blaseMalen(sx, sy, 1, 0.5 * o.blass, o.farbe);
      const dy = y - state.blase.y;
      namen.push({ ...o, sx, sy: sy - R * view.s - 6, weit: `${dy > 0 ? "+" : ""}${Math.round(dy / METER)} m` });
    });
    window.LernappGeist.namen(g, namen, { breit: view.cssW, hoch: view.cssH });
  }

  function zeichneSchriften() {
    if (!state.schriften.length) return;
    g.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
    g.lineJoin = "round";
    g.textAlign = "center";
    g.textBaseline = "middle";
    state.schriften.forEach((t) => {
      const k = clamp(t.leben / t.max, 0, 1);
      const gross = t.gross;
      g.font = `900 ${gross}px system-ui, sans-serif`;
      const x = view.cssW / 2;
      const y = view.frei + (view.blaseY - view.frei) * 0.42 - (1 - k) * 10;
      g.globalAlpha = Math.min(1, k * 2.4) * Math.min(1, (t.max - t.leben) * 5);
      g.lineWidth = Math.max(4, gross * 0.22);
      g.strokeStyle = "rgba(40, 20, 50, 0.7)";
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
    g.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
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
    g.fillStyle = "rgba(40, 22, 56, 0.5)";
    g.beginPath();
    g.roundRect(W / 2 - breit / 2 - 16, y - 17, breit + 32, an.unter ? 54 : 34, 17);
    g.fill();
    g.lineWidth = 5;
    g.strokeStyle = "rgba(36, 18, 50, 0.8)";
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

  function zeichnen() {
    if (!g || !ebenen) return;
    zeichneWelt();
    zeichneGluehwuermchen();
    zeichneRaender();
    zeichneBoden();
    zeichneAufwinde();
    zeichneRauch();
    zeichneTeile();
    zeichneBeweger();
    zeichneBoeen();
    zeichneMarken();
    zeichneGeister();
    if (state.intro || state.blase.y < 40) {
      g.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
      zeichneRing();
    }
    zeichneStoesse();
    zeichneBlase();
    zeichneTeilchen();
    zeichnePollen();
    zeichneNebel();
    zeichneTacho();
    g.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
    zeichneSchriften();
    zeichneAnsage();
  }

  // ---------------------------------------------------------------------------
  // Der Tacho
  // ---------------------------------------------------------------------------
  /*
   * Unten links ein kleines Messinstrument aus Messing: das Zifferblatt
   * zeigt, wie schnell die Blase gerade steigt (0 bis TACHO_MAX km/h, die
   * Nadel gedämpft), eine fliederfarbene Marke das Ø, das die Blase von
   * selbst hätte (darunter bleibt der Faktor bei ×1), eine goldene das
   * eigene Ø. Liegt die goldene rechts der fliederfarbenen, zählt jeder
   * Meter mehr. Darunter ein Schild mit dem Faktor, dem Ø und
   * den Punkten. Das Gehäuse, die Skala und das Schild sind vorgemalt; je
   * Bild kommen nur Nadel, Marken und Zahlen dazu.
   */
  const TACHO_MAX = 10;
  const tachoWinkel = (kmh) => Math.PI * (0.75 + 1.5 * clamp(kmh / TACHO_MAX, 0, 1.03));

  // Masse in CSS-Pixeln, bezogen auf den Halbmesser r des Zifferblatts.
  const tachoMasse = (r) => ({ b: Math.round(r * 2.5), h: Math.round(r * 3.05), cx: Math.round(r * 1.25), cy: Math.round(r * 1.2), schildY: Math.round(r * 2.18), schildH: Math.round(r * 0.82) });

  function tachoBild(r) {
    const m = tachoMasse(r);
    const c = leinwand(m.b, m.h);
    const k = c.getContext("2d");
    const d = view.dpr;
    k.scale(d, d);
    const { cx, cy } = m;
    // Schatten, Messingring, Zifferblatt.
    k.fillStyle = "rgba(30, 14, 30, 0.35)";
    k.beginPath();
    k.arc(cx + r * 0.05, cy + r * 0.08, r * 1.12, 0, TAU);
    k.fill();
    const ring = k.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
    ring.addColorStop(0, "rgb(255, 228, 150)");
    ring.addColorStop(0.45, "rgb(196, 146, 60)");
    ring.addColorStop(1, "rgb(110, 72, 30)");
    k.fillStyle = ring;
    k.beginPath();
    k.arc(cx, cy, r * 1.1, 0, TAU);
    k.fill();
    const blatt = k.createRadialGradient(cx - r * 0.25, cy - r * 0.35, r * 0.1, cx, cy, r);
    blatt.addColorStop(0, "rgb(255, 250, 236)");
    blatt.addColorStop(0.8, "rgb(244, 230, 204)");
    blatt.addColorStop(1, "rgb(214, 192, 160)");
    k.fillStyle = blatt;
    k.beginPath();
    k.arc(cx, cy, r * 0.97, 0, TAU);
    k.fill();
    // Ein Farbband: ruhig, dann warm, oben rot.
    k.lineWidth = r * 0.1;
    for (let v = 0; v < TACHO_MAX; v += 0.25) {
      const f = v / TACHO_MAX;
      k.strokeStyle = rgb(f < 0.5 ? mix3([150, 190, 160], [240, 190, 90], f * 2) : mix3([240, 190, 90], [214, 70, 60], (f - 0.5) * 2));
      k.beginPath();
      k.arc(cx, cy, r * 0.8, tachoWinkel(v), tachoWinkel(v + 0.26));
      k.stroke();
    }
    // Striche und Zahlen.
    k.strokeStyle = "rgb(60, 40, 40)";
    k.fillStyle = "rgb(60, 40, 40)";
    k.textAlign = "center";
    k.textBaseline = "middle";
    k.font = `800 ${Math.round(r * 0.22)}px system-ui, sans-serif`;
    for (let v = 0; v <= TACHO_MAX; v += 0.5) {
      const w = tachoWinkel(v);
      const lang = v % 2 === 0 ? 0.2 : v % 1 === 0 ? 0.13 : 0.08;
      k.lineWidth = v % 1 === 0 ? Math.max(1, r * 0.035) : Math.max(0.7, r * 0.02);
      k.beginPath();
      k.moveTo(cx + Math.cos(w) * r * 0.92, cy + Math.sin(w) * r * 0.92);
      k.lineTo(cx + Math.cos(w) * r * (0.92 - lang), cy + Math.sin(w) * r * (0.92 - lang));
      k.stroke();
      if (v % 2 === 0 && v > 0 && v < TACHO_MAX) k.fillText(String(v), cx + Math.cos(w) * r * 0.58, cy + Math.sin(w) * r * 0.58);
    }
    k.font = `700 ${Math.round(r * 0.16)}px system-ui, sans-serif`;
    k.fillStyle = "rgb(120, 90, 70)";
    k.fillText("km/h", cx, cy + r * 0.74);
    // Ein Glanz auf dem Glas.
    const glas = k.createLinearGradient(cx - r, cy - r, cx + r * 0.2, cy + r * 0.2);
    glas.addColorStop(0, "rgba(255, 255, 255, 0.35)");
    glas.addColorStop(0.5, "rgba(255, 255, 255, 0.05)");
    glas.addColorStop(1, "rgba(255, 255, 255, 0)");
    k.fillStyle = glas;
    k.beginPath();
    k.arc(cx, cy, r * 0.97, Math.PI * 0.95, Math.PI * 1.85);
    k.closePath();
    k.fill();
    // Das Schild darunter, aus Messing.
    const sy = m.schildY;
    const sh = m.schildH;
    const schild = k.createLinearGradient(0, sy, 0, sy + sh);
    schild.addColorStop(0, "rgb(250, 220, 150)");
    schild.addColorStop(0.5, "rgb(206, 156, 70)");
    schild.addColorStop(1, "rgb(150, 100, 40)");
    k.fillStyle = "rgba(30, 14, 30, 0.3)";
    k.beginPath();
    k.roundRect(r * 0.08, sy + r * 0.06, m.b - r * 0.12, sh, r * 0.18);
    k.fill();
    k.fillStyle = schild;
    k.beginPath();
    k.roundRect(r * 0.04, sy, m.b - r * 0.08, sh, r * 0.18);
    k.fill();
    k.fillStyle = "rgb(250, 238, 210)";
    k.beginPath();
    k.roundRect(r * 0.12, sy + r * 0.08, m.b - r * 0.24, sh - r * 0.16, r * 0.12);
    k.fill();
    return c;
  }

  // Wo der Tacho steht (in Bildpunkten): unten links, unter der Blase –
  // dort ist nur, was sie schon hinter sich hat.
  function tachoOrt() {
    const r = ebenen?.tachoR || 0;
    const m = tachoMasse(r);
    return { x: 8, y: Math.round(view.cssH - m.h - 8), b: m.b, h: m.h, r };
  }
  function zeichneTacho() {
    if (!ebenen?.tacho || state.intro) return;
    const r = ebenen.tachoR;
    const m = tachoMasse(r);
    const { x: x0, y: y0 } = tachoOrt();
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.drawImage(ebenen.tacho, Math.round(x0 * view.dpr), Math.round(y0 * view.dpr));
    g.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
    const cx = x0 + m.cx;
    const cy = y0 + m.cy;
    const t = Math.max(0.1, state.t);
    const laeuft = state.phase === "spiel" || state.phase === "zuschauen" || state.phase === "ende";
    const schnitt = laeuft ? (state.hoechste / t) * KMH : 0;
    const vonSelbst = laeuft ? (hTrag(Math.max(1, t)) / Math.max(1, t)) * KMH : 0;
    // Die Marken am Rand: das Ø, das sie von selbst hätte (flieder), und
    // das eigene (gold).
    [[vonSelbst, "rgb(150, 110, 200)"], [schnitt, "rgb(214, 150, 40)"]].forEach(([v, farbe]) => {
      if (!laeuft) return;
      const w = tachoWinkel(v);
      const ax = cx + Math.cos(w) * r * 0.99;
      const ay = cy + Math.sin(w) * r * 0.99;
      g.fillStyle = farbe;
      g.beginPath();
      g.moveTo(ax, ay);
      g.lineTo(cx + Math.cos(w - 0.08) * r * 1.16, cy + Math.sin(w - 0.08) * r * 1.16);
      g.lineTo(cx + Math.cos(w + 0.08) * r * 1.16, cy + Math.sin(w + 0.08) * r * 1.16);
      g.closePath();
      g.fill();
    });
    // Die Nadel.
    const w = tachoWinkel(state.tacho);
    g.strokeStyle = "rgba(40, 20, 20, 0.3)";
    g.lineCap = "round";
    g.lineWidth = Math.max(2, r * 0.07);
    g.beginPath();
    g.moveTo(cx + 1.5, cy + 2);
    g.lineTo(cx + Math.cos(w) * r * 0.8 + 1.5, cy + Math.sin(w) * r * 0.8 + 2);
    g.stroke();
    g.strokeStyle = "rgb(200, 40, 40)";
    g.lineWidth = Math.max(1.6, r * 0.055);
    g.beginPath();
    g.moveTo(cx - Math.cos(w) * r * 0.15, cy - Math.sin(w) * r * 0.15);
    g.lineTo(cx + Math.cos(w) * r * 0.82, cy + Math.sin(w) * r * 0.82);
    g.stroke();
    g.setTransform(1, 0, 0, 1, 0, 0);
    const d = view.dpr;
    g.drawImage(ebenen.tachoNabe, Math.round((cx - r * 0.14) * d), Math.round((cy - r * 0.14) * d));
    // Die Zahlen: das Tempo jetzt im Fenster unten, auf dem Schild Faktor,
    // Ø und Punkte – je als kleines Bild, neu gemalt nur, wenn sich ein
    // Text ändert (Schrift setzen ist teuer, und sie ändert sich selten).
    const f = laeuft ? faktorBei(state.hoechste, t) : 1;
    const zahl = zahlText(state.tacho);
    if (ebenen.tachoZahlText !== zahl) {
      ebenen.tachoZahlText = zahl;
      const k = ebenen.tachoZahl.getContext("2d");
      k.setTransform(d, 0, 0, d, 0, 0);
      k.clearRect(0, 0, r * 1.2, r * 0.5);
      k.textAlign = "center";
      k.textBaseline = "middle";
      k.fillStyle = "rgb(60, 36, 36)";
      k.font = `900 ${Math.round(r * 0.3)}px system-ui, sans-serif`;
      k.fillText(zahl, r * 0.6, r * 0.25);
    }
    g.drawImage(ebenen.tachoZahl, Math.round((cx - r * 0.6) * d), Math.round((cy + r * 0.22) * d));
    const schild = `${zahlText(f, 2)}|${zahlText(schnitt)}|${state.punkte}`;
    if (ebenen.tachoSchildText !== schild) {
      ebenen.tachoSchildText = schild;
      const k = ebenen.tachoSchild.getContext("2d");
      k.setTransform(d, 0, 0, d, 0, 0);
      k.clearRect(0, 0, m.b, m.schildH);
      const sy = m.schildH / 2;
      k.textBaseline = "middle";
      k.fillStyle = f > 1.005 ? "rgb(170, 70, 20)" : "rgb(90, 66, 50)";
      k.textAlign = "left";
      k.font = `900 ${Math.round(r * 0.34)}px system-ui, sans-serif`;
      const faktorText = `×${zahlText(f, 2)}`;
      k.fillText(faktorText, r * 0.2, sy + r * 0.01);
      // Rechts Ø und Punkte – bei vielen Stellen etwas kleiner, damit
      // nichts in den Faktor läuft.
      const rechts = m.b - r * 0.18;
      const platz = rechts - (r * 0.2 + k.measureText(faktorText).width + r * 0.12);
      k.textAlign = "right";
      k.fillStyle = "rgb(80, 56, 44)";
      [[`Ø ${zahlText(schnitt)} km/h`, 0.18, 700, sy - r * 0.16], [`${state.punkte} Punkte`, 0.21, 800, sy + r * 0.17]].forEach(([text, gross, dick, y]) => {
        let px = Math.round(r * gross);
        k.font = `${dick} ${px}px system-ui, sans-serif`;
        const breit = k.measureText(text).width;
        if (breit > platz) {
          px = Math.max(8, Math.floor((px * platz) / breit));
          k.font = `${dick} ${px}px system-ui, sans-serif`;
        }
        k.fillText(text, rechts, y);
      });
    }
    g.drawImage(ebenen.tachoSchild, Math.round(x0 * d), Math.round((y0 + m.schildY) * d));
    g.setTransform(d, 0, 0, d, 0, 0);
  }

  // Die Nabe der Nadel, einmal gemalt.
  function tachoNabeBild(r) {
    const c = leinwand(r * 0.28, r * 0.28);
    const k = c.getContext("2d");
    k.scale(view.dpr, view.dpr);
    const n = r * 0.14;
    const nabe = k.createRadialGradient(n - r * 0.03, n - r * 0.03, 0, n, n, r * 0.12);
    nabe.addColorStop(0, "rgb(255, 230, 160)");
    nabe.addColorStop(1, "rgb(140, 90, 30)");
    k.fillStyle = nabe;
    k.beginPath();
    k.arc(n, n, r * 0.12, 0, TAU);
    k.fill();
    return c;
  }

  // ---------------------------------------------------------------------------
  // Der Luftstoss
  // ---------------------------------------------------------------------------
  // Ein Tipp an (fx, fy) in der Welt. Gibt zurück, wie stark er war.
  function stoss(fx, fy) {
    const b = state.blase;
    const dx = b.x - fx;
    const dy = b.y - fy;
    const d = Math.hypot(dx, dy);
    if (d < BERUEHRT) {
      platzen({ art: "finger" });
      return 0;
    }
    const j = stossBei(d);
    state.stoesse += 1;
    const w = Math.atan2(fy - b.y, fx - b.x);
    state.letzterStoss = { w, d };
    stossZeigen(fx, fy, j);
    if (j <= 0.01) return 0;
    b.vx += (dx / d) * j;
    b.vy += (dy / d) * j;
    // Sie wabert: in der Richtung des Stosses gestaucht, je stärker, desto mehr.
    b.ww = Math.atan2(dy, dx);
    b.wa = Math.min(0.14, b.wa * Math.exp(-b.wt / 0.45) * 0.6 + (j / J0) * 0.1);
    b.wt = 0;
    klang()?.ton?.("seifenblase.pusten", { laut: 0.25 + 0.5 * (j / J0), hoehe: 0.9 + 0.3 * (j / J0) });
    kids()?.vibrate?.(4);
    return j;
  }

  function stossZeigen(fx, fy, j) {
    if (ruhig()) return;
    const b = state.blase;
    state.stossBilder.push({ fx, fy, bx: b.x, by: b.y, kraft: j, zeit: 0 });
    if (state.stossBilder.length > 6) state.stossBilder.shift();
  }

  // ---------------------------------------------------------------------------
  // Platzen
  // ---------------------------------------------------------------------------
  function platzen(was, nurBild = false) {
    if (state.schritt === "geplatzt") return;
    const b = state.blase;
    state.schritt = "geplatzt";
    state.geplatzt = { ...was, zeit: 0, x: b.x, y: b.y };
    klangAus();
    // Ein Ring aus feinsten Tröpfchen, ein Blitz, ein Nachhall.
    if (!ruhig()) {
      for (let i = 0; i < 72; i += 1) {
        const w = (i / 72) * TAU + Math.random() * 0.1;
        const v = 50 + Math.random() * 110;
        const leben = 0.35 + Math.random() * 0.45;
        const c = ["rgb(255, 255, 255)", "rgb(170, 236, 255)", "rgb(255, 190, 240)", "rgb(255, 246, 170)", "rgb(190, 255, 200)"][i % 5];
        state.teile.push({ art: "troepfchen", x: b.x + Math.cos(w) * R, y: b.y + Math.sin(w) * R, vx: Math.cos(w) * v + b.vx * 0.3, vy: Math.sin(w) * v + b.vy * 0.3, leben, max: leben, farbe: c });
      }
      for (let i = 0; i < 10; i += 1) {
        const w = Math.random() * TAU;
        const leben = 0.6 + Math.random() * 0.5;
        state.teile.push({ art: "fetzen", x: b.x + Math.cos(w) * R * 0.8, y: b.y + Math.sin(w) * R * 0.8, vx: Math.cos(w) * 20, vy: Math.sin(w) * 20 + 10, w, leben, max: leben, farbe: ["#ff9ad5", "#9ae6ff", "#fff09a", "#b8ff9a"][i % 4] });
      }
      state.teile.push({ art: "blitz", x: b.x, y: b.y, r: 30, vx: 0, vy: 0, leben: 0.2, max: 0.2 });
      state.teile.push({ art: "ring", x: b.x, y: b.y, r: R, wachs: 60, vx: 0, vy: 0, leben: 0.45, max: 0.45, kraft: 1 });
      state.teile.push({ art: "ring", x: b.x, y: b.y, r: R * 0.6, wachs: 34, warte: 0.32, vx: 0, vy: 0, leben: 0.6, max: 0.6, kraft: 0.45 });
    }
    klang()?.ton?.("seifenblase.platzen", { laut: 0.9, hoehe: 1.3 });
    klang()?.ton?.("seifenblase.nachhall", { laut: 0.35, verzoegerung: 0.3 });
    if (was.art === "tropfen" || was.art === "nebel") klang()?.ton?.("seifenblase.tropfen", { laut: 0.5 });
    kids()?.vibrate?.([20, 30, 50]);
    if (nurBild) return;
    if (state.phase === "spiel") {
      // Woran sie zerplatzt ist, steht als Letztes in der Aufzeichnung.
      gegner?.takt(state.punkte, { a: Math.round(b.x * 4), b: Math.round(b.y * 2), c: -(1 + Math.max(0, ARTEN.indexOf(was.art))) });
    }
    stepTimer = window.setTimeout(finish, ruhig() ? 900 : STURZ_MS);
  }

  const ARTEN = ["rand", "nebel", "finger", "tisch", "rasen", "rose", "nessel", "schlauch", "tropfen", "ast", "tanne", "netz", "wespe", "balkon", "dach", "antenne", "schwalbe", "wolke", "segler", "fetzen"];

  // ---------------------------------------------------------------------------
  // Die Physik
  // ---------------------------------------------------------------------------
  function physik(dt) {
    const b = state.blase;
    const n = Math.max(1, Math.ceil(dt / TAKT - 1e-9));
    const h = dt / n;
    for (let i = 0; i < n; i += 1) {
      if (state.schritt === "geplatzt") return;
      const k = aufwindBei(b.x, b.y);
      const w = windBei(b.y, state.t) * (1 - 0.85 * k);
      const ziel = vAuf(state.t) * (1 + (AUF - 1) * k);
      b.vx += (w - b.vx) * (h / TAU_X);
      b.vy += (ziel - b.vy) * (h / TAU_Y);
      b.x += b.vx * h;
      b.y += b.vy * h;
      state.t += h;
      b.wt += h;
      // Die Punkte zuerst: Auch der Schritt, in dem sie zerplatzt, zählt –
      // so passen sie genau zu Höhe und Zeit auf der Tafel.
      if (b.y > state.hoechste) state.hoechste = b.y;
      const punkte = punkteBei(state.hoechste, state.t);
      if (punkte !== state.punkte) {
        state.punkte = punkte;
        shell.setCount(punkte);
      }
      const o = trifft(b.x, b.y, state.t);
      if (o) { platzen(o); return; }
      if (b.y - RH < nebelY(state.t)) { platzen({ art: "nebel" }); return; }
    }
  }

  /*
   * Ein Tipp an der Stelle (sx, sy) des Bildes (CSS-Pixel) – zu der Zeit, zu
   * der er geschah (jetzt, wie performance.now). Der Ort zählt, wie er im
   * letzten Bild war: Dorthin hat der Finger gezielt.
   */
  function tippen(jetzt, sx = view.cssW / 2, sy = view.blaseY + 30 * view.s) {
    const x = (sx - view.cssW / 2) / view.s;
    const y = view.camBild + (view.cssH - sy) / view.s;
    return tippeWelt(x, y, jetzt);
  }

  function tippeWelt(x, y, jetzt) {
    if (state.phase === "zuschauen" || state.phase === "ende") return 0;
    if (state.phase === "bereit") {
      losGehts();
      // Der erste Tipp startet – und bläst schon, wenn er die Blase nicht trifft.
      if (Math.hypot(x - state.blase.x, y - state.blase.y) < R * 1.4) return 0;
    }
    if (state.phase !== "spiel" || state.schritt === "geplatzt") return 0;
    if (Number.isFinite(jetzt) && last) {
      const mehr = clamp((jetzt - last) / 1000 - voraus, 0, 0.05);
      if (mehr > 0) {
        physik(mehr);
        voraus += mehr;
      }
      if (state.schritt === "geplatzt") return 0;
    }
    return stoss(x, y);
  }

  /*
   * Der Autopilot: wohin er tippen würde, um der Gasse zu folgen (für die
   * Prüfung und die Vorführung). Er regelt das Tempo: quer so schnell, wie
   * die Gasse dort schwenkt, dazu was ihm zur Mitte fehlt (in 0,3 s
   * aufgeholt); hoch nur, wenn er dem Zeitplan um mehr als ein Drittel der
   * Luft voraus oder hinterher ist. Ein Stoss ändert das Tempo sofort – er
   * tippt so nah, dass es genau der fehlende Unterschied ist.
   */
  function pilot({ abstand = 0.1, vor = 0.1, zeit = 0.3, maxJ = J0 * 0.97, raser = 0 } = {}) {
    const b = state.blase;
    if (state.phase !== "spiel" || state.schritt !== "flug") return null;
    if (state.t < state.pilotBis) return null;
    const k = aufwindBei(b.x, b.y);
    const w = windBei(b.y, state.t) * (1 - 0.85 * k);
    const yv = b.y + b.vy * vor;
    const xv = b.x + b.vx * vor;
    const steig = (wegX(yv + 2) - wegX(yv - 2)) / 4;
    // Bis zum nächsten Tipp zieht der Wind das Tempo zu sich: So viel mehr
    // muss der Stoss geben, damit es im Mittel stimmt.
    const mittel = (TAU_X / abstand) * (1 - Math.exp(-abstand / TAU_X));
    const vxSoll = steig * b.vy + (wegX(yv) - xv) / zeit;
    const dvx = w + (vxSoll - w) / mittel - b.vx;
    const vRef = (yRef(state.t + vor + 0.05) - yRef(state.t + vor - 0.05)) / 0.1;
    const ey = yRef(state.t + vor) - yv;
    const tFehler = -ey / Math.max(20, vRef);
    // Der Raser will nicht dem Zeitplan folgen, sondern so schnell steigen:
    // raser cm/s – dafür bläst er immer wieder von unten.
    const vz = vAuf(state.t) * (1 + (AUF - 1) * k);
    const dvyRaser = vz + (raser - vz) / mittel - b.vy;
    // raser < 0: nur quer steuern, die Höhe lassen, wie sie ist.
    const dvy = raser > 0 ? (Math.abs(raser - b.vy) > 14 ? dvyRaser : 0) : raser < 0 ? 0 : Math.abs(tFehler) > luftAn(b.y) * 0.3 ? vRef + ey / (zeit + 0.1) - b.vy : 0;
    const betrag = Math.hypot(dvx, dvy);
    if (betrag < 4) return null;
    const d = abstandFuer(Math.min(betrag, maxJ));
    state.pilotBis = state.t + abstand;
    const dx = -(dvx / betrag) * d;
    const dy = -(dvy / betrag) * d;
    return { x: b.x + dx, y: b.y + dy, dx, dy };
  }

  // ---------------------------------------------------------------------------
  // Zuschauen
  // ---------------------------------------------------------------------------
  function zuschauenStarten() {
    if (!zuschauer?.lauf) return;
    startRun();
    state.phase = "zuschauen";
    state.schritt = "flug";
    state.t = 0;
    shell.setPhase("play");
    zuschauer.los();
    klangAn();
  }

  // Sie steht, wo die Aufzeichnung sie hat (a: quer in Vierteln, b: die Höhe
  // in Halben, c: die Luftstösse und woher der letzte kam; am Schluss
  // negativ, woran sie zerplatzt ist).
  function zuschauenTakt(dt) {
    const st = zuschauer.stand();
    if (!st) return;
    const b = state.blase;
    if (state.schritt !== "geplatzt") {
      state.t = Math.max(state.t, st.t / 1000);
      b.x = st.a / 4;
      b.y = st.b / 2;
      if (b.y > state.hoechste) state.hoechste = b.y;
      b.vx = st.va / 4;
      b.vy = st.vb / 2;
      b.wt += dt;
      const c = Math.round(st.c || 0);
      let punkte = Math.max(0, Math.floor(st.punkte));
      if (c < 0) {
        platzen({ art: ARTEN[-c - 1] || "rand" }, true);
        // Das Platzen erscheint schon auf halbem Weg zur letzten Probe, die
        // Punkte stehen dort noch einen Schritt zurück – also die letzten.
        const lauf = zuschauer.lauf;
        if (lauf?.wert) punkte = Math.max(punkte, Math.floor(lauf.wert(lauf.dauer)));
      } else {
        const zahl = Math.floor(c / 1024);
        while (state.stoesse < zahl) {
          state.stoesse += 1;
          // Woher der Finger kam: Richtung und Abstand.
          const w = ((Math.floor(c / 32) % 32) / 32) * TAU;
          const d = (c % 32) * 3 + R;
          const fx = b.x + Math.cos(w) * d;
          const fy = b.y + Math.sin(w) * d;
          const j = stossBei(d);
          stossZeigen(fx, fy, j);
          b.ww = Math.atan2(-Math.sin(w), -Math.cos(w));
          b.wa = Math.min(0.14, (j / J0) * 0.1);
          b.wt = 0;
          klang()?.ton?.("seifenblase.pusten", { laut: 0.2 + 0.4 * (j / J0) });
        }
      }
      if (punkte !== state.punkte) {
        state.punkte = punkte;
        shell.setCount(punkte);
      }
      klangStellen();
    }
    if (!zuschauer.weiter() && state.schritt !== "geplatzt") {
      platzen(trifft(b.x, b.y, state.t, RH + 3) || { art: "rand" }, true);
    }
  }

  // ---------------------------------------------------------------------------
  // Der Takt
  // ---------------------------------------------------------------------------
  // Ein neuer Abschnitt: Ein besonderer wird vorher angesagt; eine neue Welt
  // bekommt ihren Namen.
  function abschnittPruefen() {
    const y = state.blase.y;
    const w = weltBei(y);
    if (w !== state.welt) {
      state.welt = w;
      schrift(WELT_NAME[w], "#fff6e0", 26, 2.4);
      klang()?.ton?.("seifenblase.welt", { laut: 0.7 });
    }
    const nr = abschnittBei(y);
    if (nr === state.abschnitt) return;
    state.abschnitt = nr;
    const naechster = state.abschnitte[nr + 1];
    if (naechster?.besonders === "aufwind") {
      ansage("Aufwind voraus", "Warme Luft trägt dich durch die Enge", "#ffd79a", 2.4);
      klang()?.ton?.("seifenblase.ansage", { laut: 0.7 });
    } else if (naechster?.besonders === "boee") {
      const b = state.boeen.find((q) => q.nr === naechster.nr);
      ansage(b && b.w > 0 ? "Böe von links" : "Böe von rechts", "Tippe von der Windseite dagegen", "#cfe8ff", 2.4);
      klang()?.ton?.("seifenblase.ansage", { laut: 0.7 });
    }
    const a = state.abschnitte[nr];
    if (a?.besonders === "aufwind") klang()?.ton?.("seifenblase.aufwind", { laut: 0.6 });
    if (a?.besonders === "boee") klang()?.ton?.("seifenblase.boee", { laut: 0.7 });
  }

  function takt(dt, strecke = dt) {
    state.zeit += dt;
    const b = state.blase;
    if (state.ansage) { state.ansage.leben -= dt; if (state.ansage.leben <= 0) state.ansage = null; }
    if (state.intro) {
      state.intro.t += dt;
      if (state.intro.t >= state.intro.dauer) {
        state.intro = null;
        host.dataset.intro = "aus";
      }
    }

    if (state.phase === "zuschauen") {
      zuschauenTakt(dt);
      abschnittPruefen();
    } else if (state.phase === "spiel" && state.schritt !== "geplatzt") {
      if (strecke > 0) physik(strecke);
      if (state.schritt !== "geplatzt") abschnittPruefen();
      klangStellen();
    }
    if (state.geplatzt) state.geplatzt.zeit += dt;

    for (let i = state.stossBilder.length - 1; i >= 0; i -= 1) {
      state.stossBilder[i].zeit += dt;
      if (state.stossBilder[i].zeit > 0.45) state.stossBilder.splice(i, 1);
    }
    for (let i = state.teile.length - 1; i >= 0; i -= 1) {
      const t = state.teile[i];
      if (t.warte > 0) { t.warte -= dt; continue; }
      if (t.art === "ring") t.r += t.wachs * dt;
      t.vx *= 1 - 2.2 * dt;
      t.vy = t.vy * (1 - 2.2 * dt) - (t.art === "troepfchen" ? 60 : 12) * dt;
      t.x += t.vx * dt;
      t.y += t.vy * dt;
      t.leben -= dt;
      if (t.leben <= 0) state.teile.splice(i, 1);
    }
    for (let i = state.schriften.length - 1; i >= 0; i -= 1) {
      state.schriften[i].leben -= dt;
      if (state.schriften[i].leben <= 0) state.schriften.splice(i, 1);
    }
    pollenTakt(dt);
    // Die Nadel des Tachos folgt dem Steigen, gedämpft.
    const kmh = state.schritt === "geplatzt" || state.phase === "bereit" ? 0 : Math.max(0, b.vy) * KMH;
    state.tacho += (kmh - state.tacho) * (1 - Math.exp(-dt * 6));

    // Die Kamera folgt der Blase; steigt sie schnell (Aufwind), rascher.
    if (state.phase === "bereit") state.camY = camZiel();
    else if (state.schritt !== "geplatzt") {
      const ziel = camZiel();
      const rate = ziel > state.camY ? 7 : 4;
      state.camY += (ziel - state.camY) * (1 - Math.exp(-dt * rate));
      // Nie so, dass sie oben unter die Knöpfe gerät.
      const sy = bildY(b.y);
      if (sy < view.frei + 30) state.camY += (view.frei + 30 - sy) / view.s;
    }
    planBis(Math.max(state.camY + view.cssH / view.s + 500, yRef(state.t + 8)), 1);

    if (state.phase === "spiel" && state.schritt !== "geplatzt") {
      const ls = state.letzterStoss;
      const c = state.stoesse * 1024 + (ls ? (((Math.round((ls.w / TAU) * 32) % 32) + 32) % 32) * 32 + clamp(Math.round((ls.d - R) / 3), 0, 31) : 0);
      gegner?.takt(state.punkte, { a: Math.round(b.x * 4), b: Math.round(b.y * 2), c });
    }
  }

  function loop(now) {
    frame = window.requestAnimationFrame(loop);
    // Der erste Takt nach dem Start kann vor dem Start liegen (der Zeitstempel
    // des Bildes ist älter) – dann eben null.
    const dt = clamp((now - last) / 1000, 0, 0.05);
    last = Math.max(last, now);
    const strecke = Math.max(0, dt - voraus);
    voraus = 0;
    messen();
    takt(dt, strecke);
    view.camBild = state.camY;
    zeichnen();
  }

  // Die Runde beginnt: mit dem ersten Tipp – oder im Live-Modus zum
  // gemeinsamen Start.
  function losGehts() {
    if (state.phase !== "bereit") return;
    state.phase = "spiel";
    state.schritt = "flug";
    state.t = 0;
    state.blase.vy = V0;
    if (state.intro) { state.intro = null; host.dataset.intro = "aus"; }
    shell.setPhase("play");
    gegner?.los();
    klangAn();
    kids()?.vibrate?.(8);
  }

  // ---------------------------------------------------------------------------
  // Ablauf
  // ---------------------------------------------------------------------------
  function schrift(text, farbe, gross = 24, dauer = 1.6) {
    state.schriften = [{ text, farbe, gross, leben: dauer, max: dauer }];
  }

  function ansage(text, unter, farbe = "#ffffff", dauer = 2.2) {
    state.ansage = { text, unter, farbe, leben: dauer, max: dauer };
  }

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
    state.hoechste = 0;
    state.tacho = 0;
    state.t = 0;
    state.zeit = 0;
    state.blase = { x: 0, y: 0, vx: 0, vy: V0, ww: 0, wa: 0, wt: 9 };
    state.stoesse = 0;
    state.letzterStoss = null;
    state.geplatzt = null;
    state.teile = [];
    state.stossBilder = [];
    state.schriften = [];
    state.ansage = null;
    state.welt = 0;
    state.pilotBis = 0;
    weltNeu();
    pollenNeu();
    if (ebenen) { ebenen.teile = new Map(); ebenen.fetzen = new Map(); }
    voraus = 0;
    shell.setCount(0);
    gegner?.runde();

    // Beim ersten Start wächst die Blase erst aus dem Ring.
    state.intro = ersterStart && !zuschauer && !shell.live && !ruhig() ? { t: 0, dauer: 2.6 } : null;
    ersterStart = false;
    host.dataset.intro = state.intro ? "an" : "aus";

    shell.clear();
    const prompt = shell.el("p", "cm-prompt sb-prompt", "Tippe neben die Blase – der Luftstoss treibt sie vom Finger weg. Nie berühren!");
    shell.play.append(prompt, buildPlatz());
    view.cssW = 0;
    view.cssH = 0;
    messen();
    state.camY = camZiel();
    view.camBild = state.camY;

    last = performance.now();
    frame = window.requestAnimationFrame(loop);
  }

  function zaehleHoch(ziel) {
    const zahl = host.querySelector(".cm-result-score");
    if (!zahl) return;
    if (ruhig() || ziel <= 1) { zahl.textContent = String(ziel); return; }
    const dauer = Math.min(900, 160 + ziel * 8);
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
    rand: ["An der Hecke zerplatzt", "Am Baumstamm zerplatzt", "An der Hauswand zerplatzt", "Im Gewitterregen zerplatzt"],
    nebel: "Vom Nebel eingeholt",
    finger: "Mit dem Finger berührt",
    tisch: "Auf dem Gartentisch zerplatzt",
    rasen: "Im Gras zerplatzt",
    rose: "An einer Rose zerplatzt",
    nessel: "An einer Brennnessel zerplatzt",
    schlauch: "Am Gartenschlauch zerplatzt",
    tropfen: "Ein Wassertropfen traf sie",
    ast: "An einem Ast zerplatzt",
    tanne: "In die Tannennadeln geraten",
    netz: "Im Spinnennetz hängen geblieben",
    wespe: "Eine Wespe flog hinein",
    balkon: "Am Balkon zerplatzt",
    dach: "An der Dachkante zerplatzt",
    antenne: "An einer Antenne zerplatzt",
    schwalbe: "Eine Schwalbe flog hindurch",
    wolke: "In einer Wolke zerplatzt",
    segler: "Ein Mauersegler flog hindurch",
    fetzen: "In einen Wolkenfetzen geraten",
  };
  const WARUM_ROLLE = { dorn: "An einem Rosendorn zerplatzt", kamin: "Am Kamin zerplatzt", rinne: "An der Dachrinne zerplatzt" };

  function warumText(was) {
    if (!was) return "";
    if (was.rolle && WARUM_ROLLE[was.rolle]) return WARUM_ROLLE[was.rolle];
    const w = WARUM[was.art];
    if (Array.isArray(w)) return w[was.welt ?? weltBei(state.geplatzt?.y || 0)] || w[0];
    return w || "";
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
    const warum = warumText(state.geplatzt);
    // Wie die Punkte zustande kamen: Höhe, Zeit, Ø-Tempo und Faktor.
    const t = Math.max(0.1, state.t);
    const rechnung = `${zahlText(state.hoechste / METER)} m in ${Math.round(t)} s · Ø ${zahlText((state.hoechste / t) * KMH)} km/h · ×${zahlText(faktorBei(state.hoechste, t), 2)}`;
    shell.showResult({
      label: "Deine Punkte",
      points: punkte,
      detail: rekord ? `Neuer Rekord! · ${rechnung}` : `${warum ? `${warum} · ` : ""}${rechnung}`,
      geist,
    });
    if (rekord) host.querySelector(".cm-result-detail")?.classList.add("sb-rekord");
    zaehleHoch(punkte);
  }

  // ---------------------------------------------------------------------------
  // Start
  // ---------------------------------------------------------------------------
  shell = shellApi.mount({
    host,
    title: "Seifenblase",
    area: "geschwindigkeit",
    accent: "#F5A623",
    accentDark: "#b9741a",
    clock: false,
    onRestart: () => (zuschauer ? zuschauenStarten() : startRun()),
    live: { los: losGehts, stopp: () => finish(), zuschauen: (quelle) => { zuschauer = quelle; zuschauenStarten(); } },
  });
  zuschauer = window.LernappGeist?.zuschauer?.({
    host, spiel: "soapBubble", fassung: "t2", zufall, einheit: "Punkte", nochmal: zuschauenStarten,
  }) || null;
  if (!zuschauer) {
    gegner = window.LernappGeist?.fuer?.({ spiel: "soapBubble", host, art: "tempo", fassung: "t2", alle: true, zufall }) || null;
  }

  startRun();
  zuschauer?.laden.then((da) => { if (da) zuschauenStarten(); });

  // Ein Tipp irgendwo aufs Bild: Von dort kommt der Luftstoss. Nur Knöpfe
  // bleiben Knöpfe.
  host.addEventListener("pointerdown", (event) => {
    if (event.target.closest("button, a, input")) return;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width) return;
    const t = Math.abs(performance.now() - event.timeStamp) < 250 ? event.timeStamp : performance.now();
    tippen(t, (event.clientX - rect.left) * (view.cssW / rect.width), (event.clientY - rect.top) * (view.cssH / rect.height));
  });

  // Mit der Tastatur: ein Stoss aus mittlerem Abstand – ← schiebt nach
  // links, → nach rechts, ↑ und Leertaste hinauf, ↓ bremst.
  const TASTEN = { ArrowLeft: [1, 0], ArrowRight: [-1, 0], ArrowUp: [0, -1], " ": [0, -1], Enter: [0, -1], ArrowDown: [0, 1] };
  document.addEventListener("keydown", (event) => {
    const r = TASTEN[event.key];
    if (!r) return;
    if (document.activeElement?.tagName === "BUTTON") return;
    event.preventDefault();
    if (event.repeat) return;
    const b = state.blase;
    tippeWelt(b.x + r[0] * 24, b.y + r[1] * 24, performance.now());
  });

  window.addEventListener("resize", messen);
  window.addEventListener("orientationchange", messen);
  window.addEventListener("pagehide", () => { clearStep(); stopLoop(); klangAus(); });

  // Für die Prüfskripte und die Vorführung. tippeWelt(x, y) nimmt
  // Weltkoordinaten, tippen(jetzt, sx, sy) CSS-Pixel der Leinwand.
  window.LernappSeifenblase = {
    METER, R, RH, RAND, J0, D0, DMAX, BERUEHRT, TAU_X, TAU_Y, FASSUNG, state, view,
    takt, tippen, tippeWelt, losGehts, physik, planBis, kursText, trifft, wegX, yRef, tRef, nebelY, windBei, aufwindBei,
    vAuf, margeBei, luftBei, stossBei, abstandFuer, pilot, faktorBei, punkteBei, hTrag, KMH, tachoOrt, bildX, bildY, abschnittBei, bewegerOrt, tropfenBei,
  };
})();
